import { createHash } from "node:crypto";
import { NextResponse } from "next/server";

import { requireLeagueMember } from "@/lib/leagues/requireLeagueMember";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type PastPerformance = {
  raceDate?: string | null;
  performanceCode?: string | null;
  trackCode?: string | null;
  distanceYards?: number | null;
  condition?: string | null;
  weight?: number | null;
  boxNumber?: number | null;
  runningPositions?: number[] | null;
  finishPosition?: number | null;
  marginText?: string | null;
  finishTime?: number | null;
  speedRating?: number | null;
  odds?: string | null;
  grade?: string | null;
  comment?: string | null;
  rawText?: string | null;
};

type RunnerHistory = {
  name?: string;
  trainer?: string | null;
  kennel?: string | null;
  programBlock?: string | null;
  programBlockImageDataUrl?: string | null;
  history?: PastPerformance[];
};

type RequestBody = {
  leagueId?: string;
  programTrack?: string | null;
  programDate?: string | null;
  runners?: RunnerHistory[];
};

type ExistingHistoryRow = {
  id: number;
  source_key: string | null;
  race_date: string | null;
  performance_code: string | null;
  track_code: string | null;
  distance_yards: number | null;
  box_number: number | null;
  running_positions: unknown;
  finish_position: number | null;
  margin_text: string | null;
  finish_time: number | null;
  speed_rating: number | null;
  odds: string | null;
  grade: string | null;
  comment: string | null;
  raw_text: string | null;
};

function clean(value: unknown): string | null {
  const result = String(value ?? "").replace(/\s+/g, " ").trim();
  return result || null;
}

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function runningPositionsOrEmpty(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((position) => Number(position))
    .filter(
      (position) =>
        Number.isInteger(position) &&
        position >= 1 &&
        position <= 8,
    )
    .slice(0, 8);
}

function isoDateOrNull(value: unknown): string | null {
  const result = clean(value);
  return result && /^\d{4}-\d{2}-\d{2}$/.test(result)
    ? result
    : null;
}

function trackCode(value: unknown): string | null {
  const normalized = clean(value)?.toUpperCase() ?? null;

  if (!normalized) return null;
  if (["WHEELING", "GWD", "WD"].includes(normalized)) return "WD";
  if (["TRI-STATE", "TRI STATE", "GTS", "TS"].includes(normalized)) {
    return "TS";
  }

  return normalized.slice(0, 12);
}

/*
 * A historical start's identity must NOT depend on parsed result details.
 *
 * finish_time, raw_text, calls, margin, odds, grade, etc. can improve when
 * OCR/parser logic improves. If any of those fields are part of source_key,
 * re-importing the same program creates a second row instead of enriching
 * the existing start.
 */
function historyIdentity(
  dogId: number,
  row: {
    race_date?: unknown;
    performance_code?: unknown;
    track_code?: unknown;
    distance_yards?: unknown;
    box_number?: unknown;
  },
): string {
  return [
    dogId,
    isoDateOrNull(row.race_date),
    clean(row.performance_code)?.toUpperCase() ?? "",
    trackCode(row.track_code),
    numberOrNull(row.distance_yards),
    numberOrNull(row.box_number),
  ].join("|");
}

function stableSourceKey(
  dogId: number,
  row: {
    race_date?: unknown;
    performance_code?: unknown;
    track_code?: unknown;
    distance_yards?: unknown;
    box_number?: unknown;
  },
): string {
  return createHash("sha256")
    .update(`commissioner_program|${historyIdentity(dogId, row)}`)
    .digest("hex");
}

function rowQuality(row: {
  running_positions?: unknown;
  finish_position?: unknown;
  margin_text?: unknown;
  finish_time?: unknown;
  speed_rating?: unknown;
  odds?: unknown;
  grade?: unknown;
  comment?: unknown;
  raw_text?: unknown;
}): number {
  const calls = runningPositionsOrEmpty(row.running_positions);

  return (
    calls.length * 10 +
    (numberOrNull(row.finish_position) !== null ? 5 : 0) +
    (clean(row.margin_text) ? 2 : 0) +
    (numberOrNull(row.finish_time) !== null ? 5 : 0) +
    (numberOrNull(row.speed_rating) !== null ? 2 : 0) +
    (clean(row.odds) ? 2 : 0) +
    (clean(row.grade) ? 2 : 0) +
    (clean(row.comment) ? 1 : 0) +
    (clean(row.raw_text) ? 1 : 0)
  );
}

function incomingRowQuality(row: PastPerformance): number {
  return rowQuality({
    running_positions: row.runningPositions,
    finish_position: row.finishPosition,
    margin_text: row.marginText,
    finish_time: row.finishTime,
    speed_rating: row.speedRating,
    odds: row.odds,
    grade: row.grade,
    comment: row.comment,
    raw_text: row.rawText,
  });
}

function mergePreferIncoming<T>(
  incoming: T | null,
  existing: T | null,
): T | null {
  return incoming ?? existing;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as RequestBody | null;
    const leagueId = clean(body?.leagueId);

    if (!leagueId) {
      return NextResponse.json(
        { success: false, message: "leagueId is required." },
        { status: 400 },
      );
    }

    const access = await requireLeagueMember(leagueId);

    if (String(access.league.leagueType) !== "greyhound") {
      return NextResponse.json(
        {
          success: false,
          message:
            "This endpoint is only available for Greyhound leagues.",
        },
        { status: 400 },
      );
    }

    if (!access.isCommissioner) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Only the league commissioner can import program history.",
        },
        { status: 403 },
      );
    }

    const admin = createSupabaseAdminClient();
    const programDate = isoDateOrNull(body?.programDate);
    const programTrackCode = trackCode(body?.programTrack);
    const runners = Array.isArray(body?.runners) ? body.runners : [];

    let imported = 0;
    let inserted = 0;
    let updated = 0;
    let duplicatesRemoved = 0;
    let dogsTouched = 0;

    for (const runner of runners) {
      const name = clean(runner.name);
      if (!name) continue;

      const history = Array.isArray(runner.history)
        ? runner.history.filter(
            (row): row is PastPerformance =>
              Boolean(row && typeof row === "object"),
          )
        : [];

      const programBlock = String(runner.programBlock ?? "").trim();
      const programBlockImageDataUrl =
        String(runner.programBlockImageDataUrl ?? "").trim();

      if (
        history.length === 0 &&
        !programBlock &&
        !programBlockImageDataUrl
      ) {
        continue;
      }

      const { data: dogIdRaw, error: dogError } = await admin.rpc(
        "upsert_greyhound_dog",
        {
          p_display_name: name,
          p_kennel: clean(runner.kennel),
          p_trainer: clean(runner.trainer),
        },
      );

      if (dogError) throw dogError;

      const dogId = Number(dogIdRaw);

      if (!Number.isInteger(dogId) || dogId <= 0) {
        throw new Error(`Could not locate Greyhound ${name}.`);
      }

      dogsTouched += 1;

      // Save the official source block independently of structured parsing.
      if (programBlock || programBlockImageDataUrl) {
        let blockQuery = admin
          .from("greyhound_dog_program_blocks")
          .select("id,program_block_image_data_url")
          .eq("dog_id", dogId)
          .eq("program_track_code", programTrackCode ?? "UNKNOWN");

        blockQuery = programDate
          ? blockQuery.eq("program_date", programDate)
          : blockQuery.is("program_date", null);

        const { data: existingBlocks, error: existingBlockError } =
          await blockQuery.order("id", { ascending: false }).limit(1);

        if (existingBlockError) throw existingBlockError;

        if (existingBlocks?.[0]) {
          const { error: blockUpdateError } = await admin
            .from("greyhound_dog_program_blocks")
            .update({
              kennel: clean(runner.kennel),
              trainer: clean(runner.trainer),
              program_block_text:
                programBlock ||
                "Official imported program visual block",
              program_block_image_data_url:
                programBlockImageDataUrl || null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existingBlocks[0].id);

          if (blockUpdateError) throw blockUpdateError;
        } else {
          const { error: blockInsertError } = await admin
            .from("greyhound_dog_program_blocks")
            .insert({
              dog_id: dogId,
              program_track_code: programTrackCode ?? "UNKNOWN",
              program_date: programDate,
              kennel: clean(runner.kennel),
              trainer: clean(runner.trainer),
              program_block_text:
                programBlock ||
                "Official imported program visual block",
              program_block_image_data_url:
                programBlockImageDataUrl || null,
              source: "commissioner_program",
            });

          if (blockInsertError) throw blockInsertError;
        }
      }

      /*
       * Deduplicate this request semantically before touching the database.
       * When OCR/native parsing both found the same start, keep the richer
       * version rather than whichever happened to appear first.
       */
      const incomingByIdentity = new Map<string, PastPerformance>();

      for (const row of history) {
        const normalizedIdentityRow = {
          race_date: isoDateOrNull(row.raceDate),
          performance_code: clean(row.performanceCode),
          track_code: trackCode(row.trackCode),
          distance_yards: numberOrNull(row.distanceYards),
          box_number: numberOrNull(row.boxNumber),
        };

        const identity = historyIdentity(dogId, normalizedIdentityRow);
        const current = incomingByIdentity.get(identity);

        if (!current || incomingRowQuality(row) > incomingRowQuality(current)) {
          incomingByIdentity.set(identity, row);
        }
      }

      /*
       * Load all commissioner-program rows for this dog. This lets the route
       * reconcile rows written by the OLD source-key formula too, including
       * duplicates already in the table.
       */
      const { data: existingRaw, error: existingError } = await admin
        .from("greyhound_dog_program_history")
        .select(
          [
            "id",
            "source_key",
            "race_date",
            "performance_code",
            "track_code",
            "distance_yards",
            "box_number",
            "running_positions",
            "finish_position",
            "margin_text",
            "finish_time",
            "speed_rating",
            "odds",
            "grade",
            "comment",
            "raw_text",
          ].join(","),
        )
        .eq("dog_id", dogId)
        .eq("source", "commissioner_program");

      if (existingError) throw existingError;

      const existingRows =
        (existingRaw ?? []) as unknown as ExistingHistoryRow[];
      const existingByIdentity = new Map<string, ExistingHistoryRow[]>();

      for (const row of existingRows) {
        const identity = historyIdentity(dogId, row);
        const bucket = existingByIdentity.get(identity) ?? [];
        bucket.push(row);
        existingByIdentity.set(identity, bucket);
      }

      for (const [identity, incoming] of incomingByIdentity) {
        const matches = existingByIdentity.get(identity) ?? [];

        /*
         * If duplicates already exist, keep the richest existing row as the
         * canonical physical record. We update that row in place so foreign
         * references (if ever added) are safer than delete-and-reinsert.
         */
        const canonical =
          matches.length > 0
            ? [...matches].sort((a, b) => {
                const qualityDifference = rowQuality(b) - rowQuality(a);
                return qualityDifference !== 0
                  ? qualityDifference
                  : a.id - b.id;
              })[0]
            : null;

        const normalizedRaceDate = isoDateOrNull(incoming.raceDate);
        const normalizedPerformanceCode = clean(incoming.performanceCode);
        const normalizedTrackCode = trackCode(incoming.trackCode);
        const normalizedDistance = numberOrNull(incoming.distanceYards);
        const normalizedBox = numberOrNull(incoming.boxNumber);
        const normalizedCalls = runningPositionsOrEmpty(
          incoming.runningPositions,
        );

        const payload = {
          dog_id: dogId,
          source_key: stableSourceKey(dogId, {
            race_date: normalizedRaceDate,
            performance_code: normalizedPerformanceCode,
            track_code: normalizedTrackCode,
            distance_yards: normalizedDistance,
            box_number: normalizedBox,
          }),
          source: "commissioner_program",
          program_track_code: programTrackCode,
          program_date: programDate,
          race_date: normalizedRaceDate,
          performance_code: normalizedPerformanceCode,
          track_code: normalizedTrackCode,
          distance_yards: normalizedDistance,
          condition: mergePreferIncoming(
            clean(incoming.condition),
            null,
          ),
          weight: numberOrNull(incoming.weight),
          box_number: normalizedBox,
          running_positions:
            normalizedCalls.length > 0
              ? normalizedCalls
              : runningPositionsOrEmpty(canonical?.running_positions),
          finish_position: mergePreferIncoming(
            numberOrNull(incoming.finishPosition),
            numberOrNull(canonical?.finish_position),
          ),
          margin_text: mergePreferIncoming(
            clean(incoming.marginText),
            clean(canonical?.margin_text),
          ),
          finish_time: mergePreferIncoming(
            numberOrNull(incoming.finishTime),
            numberOrNull(canonical?.finish_time),
          ),
          speed_rating: mergePreferIncoming(
            numberOrNull(incoming.speedRating),
            numberOrNull(canonical?.speed_rating),
          ),
          odds: mergePreferIncoming(
            clean(incoming.odds),
            clean(canonical?.odds),
          ),
          grade: mergePreferIncoming(
            clean(incoming.grade),
            clean(canonical?.grade),
          ),
          comment: mergePreferIncoming(
            clean(incoming.comment),
            clean(canonical?.comment),
          ),
          raw_text: mergePreferIncoming(
            clean(incoming.rawText),
            clean(canonical?.raw_text),
          ),
          updated_at: new Date().toISOString(),
        };

        if (canonical) {
          const duplicateIds = matches
            .filter((row) => row.id !== canonical.id)
            .map((row) => row.id);

          /*
           * Remove old duplicate copies FIRST. Their old source_key values may
           * differ, but one of them could already own the new stable key.
           */
          if (duplicateIds.length > 0) {
            const { error: deleteError } = await admin
              .from("greyhound_dog_program_history")
              .delete()
              .in("id", duplicateIds);

            if (deleteError) throw deleteError;
            duplicatesRemoved += duplicateIds.length;
          }

          const { error: updateError } = await admin
            .from("greyhound_dog_program_history")
            .update(payload)
            .eq("id", canonical.id);

          if (updateError) throw updateError;
          updated += 1;
        } else {
          const { error: insertError } = await admin
            .from("greyhound_dog_program_history")
            .insert(payload);

          if (insertError) throw insertError;
          inserted += 1;
        }

        imported += 1;
      }
    }

    return NextResponse.json({
      success: true,
      imported,
      inserted,
      updated,
      duplicatesRemoved,
      dogsTouched,
      message:
        `${imported} unique program-history starts saved for ` +
        `${dogsTouched} Greyhounds (${inserted} inserted, ${updated} updated, ` +
        `${duplicatesRemoved} duplicate rows removed).`,
    });
  } catch (error) {
    console.error("Greyhound program-history import failed:", error);

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Greyhound program history could not be imported.",
      },
      { status: 500 },
    );
  }
}