import { NextRequest, NextResponse } from "next/server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireLeagueMember } from "@/lib/leagues/requireLeagueMember";

export const dynamic = "force-dynamic";

function jsonError(message: string, status: number) {
  return NextResponse.json(
    { success: false, error: message },
    {
      status,
      headers: { "Cache-Control": "no-store, max-age=0" },
    },
  );
}

async function requireCommissioner(leagueId: string) {
  const access = await requireLeagueMember(leagueId);

  if (String(access.league.leagueType) !== "greyhound") {
    throw new Error("GREYHOUND_ONLY");
  }

  if (!access.isCommissioner) {
    throw new Error("COMMISSIONER_ONLY");
  }

  return access;
}

function numberValue(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function lower(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

export async function GET(request: NextRequest) {
  try {
    const leagueId = request.nextUrl.searchParams.get("leagueId")?.trim();

    if (!leagueId) {
      return jsonError("leagueId is required.", 400);
    }

    const access = await requireCommissioner(leagueId);
    const admin = createSupabaseAdminClient();

    const { data: cardsRaw, error: cardsError } = await admin
      .from("greyhound_cards")
      .select(
        "id,track_id,race_date,session,scheduled_first_post,card_status,total_races,commissioner_confirmed_at",
      )
      .order("race_date", { ascending: false })
      .order("id", { ascending: false })
      .limit(12);

    if (cardsError) throw cardsError;

    const cards = cardsRaw ?? [];
    const cardIds = cards.map((row) => Number(row.id));
    const trackIds = Array.from(
      new Set(
        cards
          .map((row) => Number(row.track_id))
          .filter((value) => Number.isFinite(value)),
      ),
    );

    const [tracksResult, racesResult] = await Promise.all([
      trackIds.length > 0
        ? admin
            .from("greyhound_tracks")
            .select("id,code,name,timezone")
            .in("id", trackIds)
        : Promise.resolve({ data: [], error: null }),
      cardIds.length > 0
        ? admin
            .from("greyhound_races")
            .select(
              "id,card_id,race_number,grade,distance_yards,scheduled_post_time,actual_post_time,race_status",
            )
            .in("card_id", cardIds)
            .order("race_number", { ascending: true })
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (tracksResult.error) throw tracksResult.error;
    if (racesResult.error) throw racesResult.error;

    const races = racesResult.data ?? [];
    const raceIds = races.map((row) => Number(row.id));

    const [entriesResult, replacementsResult, wagersResult] =
      await Promise.all([
        raceIds.length > 0
          ? admin
              .from("greyhound_entries")
              .select(
                "id,race_id,dog_id,box_number,morning_line_odds,kennel,trainer,weight,entry_status,scratch_detected_at,source_entry_key",
              )
              .in("race_id", raceIds)
              .order("box_number", { ascending: true })
          : Promise.resolve({ data: [], error: null }),
        raceIds.length > 0
          ? admin
              .from("greyhound_scratch_replacements")
              .select(
                "id,wager_id,race_id,scratched_entry_id,replacement_entry_id,alternate_used,replacement_status,original_selected_entry_ids,resulting_selected_entry_ids,detected_at,applied_at,notes,created_at",
              )
              .in("race_id", raceIds)
              .order("created_at", { ascending: false })
          : Promise.resolve({ data: [], error: null }),
        admin
          .from("greyhound_league_wager_display")
          .select(
            "wager_id,league_id,fantasy_team_id,racing_card_id,race_id,wager_status,grading_status,total_cost,official_return,selected_entry_ids,alternate_1,alternate_2,refund_reason,updated_at",
          )
          .eq("league_id", leagueId)
          .order("updated_at", { ascending: false })
          .limit(500),
      ]);

    if (entriesResult.error) throw entriesResult.error;
    if (replacementsResult.error) throw replacementsResult.error;
    if (wagersResult.error) throw wagersResult.error;

    const entries = entriesResult.data ?? [];
    const replacements = replacementsResult.data ?? [];
    const leagueWagers = wagersResult.data ?? [];

    const dogIds = Array.from(
      new Set(
        entries
          .map((row) => (row.dog_id == null ? null : Number(row.dog_id)))
          .filter((value): value is number => value != null),
      ),
    );

    const { data: dogsRaw, error: dogsError } =
      dogIds.length > 0
        ? await admin
            .from("greyhound_dogs")
            .select("id,display_name")
            .in("id", dogIds)
        : { data: [], error: null };

    if (dogsError) throw dogsError;

    const tracksById = new Map(
      (tracksResult.data ?? []).map((row) => [
        Number(row.id),
        {
          id: Number(row.id),
          code: String(row.code ?? ""),
          name: String(row.name ?? row.code ?? "Track"),
          timezone: row.timezone ?? null,
        },
      ]),
    );

    const dogNames = new Map(
      (dogsRaw ?? []).map((row) => [
        Number(row.id),
        String(row.display_name ?? `Dog ${row.id}`),
      ]),
    );

    const entriesById = new Map(
      entries.map((row) => [
        Number(row.id),
        {
          id: Number(row.id),
          raceId: Number(row.race_id),
          dogId: row.dog_id == null ? null : Number(row.dog_id),
          dogName:
            row.dog_id == null
              ? `Box ${row.box_number}`
              : dogNames.get(Number(row.dog_id)) ?? `Dog ${row.dog_id}`,
          boxNumber: Number(row.box_number),
          morningLineOdds: row.morning_line_odds ?? null,
          kennel: row.kennel ?? null,
          trainer: row.trainer ?? null,
          weight: row.weight == null ? null : numberValue(row.weight),
          entryStatus: String(row.entry_status ?? ""),
          scratchDetectedAt: row.scratch_detected_at ?? null,
          sourceEntryKey: row.source_entry_key ?? null,
        },
      ]),
    );

    const entriesByRace = new Map<number, Array<Record<string, unknown>>>();
    for (const entry of entriesById.values()) {
      const bucket = entriesByRace.get(entry.raceId) ?? [];
      bucket.push(entry);
      entriesByRace.set(entry.raceId, bucket);
    }

    const replacementsByRace = new Map<
      number,
      Array<Record<string, unknown>>
    >();

    for (const replacement of replacements) {
      const raceId = Number(replacement.race_id);
      const scratched = entriesById.get(
        Number(replacement.scratched_entry_id),
      );
      const replacementEntry =
        replacement.replacement_entry_id == null
          ? null
          : entriesById.get(Number(replacement.replacement_entry_id));

      const bucket = replacementsByRace.get(raceId) ?? [];
      bucket.push({
        id: Number(replacement.id),
        wagerId: Number(replacement.wager_id),
        scratchedEntryId: Number(replacement.scratched_entry_id),
        scratchedDogName:
          scratched?.dogName ??
          `Entry ${replacement.scratched_entry_id}`,
        scratchedBoxNumber: scratched?.boxNumber ?? null,
        replacementEntryId:
          replacement.replacement_entry_id == null
            ? null
            : Number(replacement.replacement_entry_id),
        replacementDogName:
          replacementEntry?.dogName ?? null,
        replacementBoxNumber:
          replacementEntry?.boxNumber ?? null,
        alternateUsed:
          replacement.alternate_used == null
            ? null
            : Number(replacement.alternate_used),
        replacementStatus: String(
          replacement.replacement_status ?? "",
        ),
        originalSelectedEntryIds:
          replacement.original_selected_entry_ids ?? [],
        resultingSelectedEntryIds:
          replacement.resulting_selected_entry_ids ?? [],
        detectedAt: replacement.detected_at ?? null,
        appliedAt: replacement.applied_at ?? null,
        notes: replacement.notes ?? null,
        createdAt: replacement.created_at ?? null,
      });

      replacementsByRace.set(raceId, bucket);
    }

    const wagersByRace = new Map<number, typeof leagueWagers>();
    for (const wager of leagueWagers) {
      const raceId = Number(wager.race_id);
      const bucket = wagersByRace.get(raceId) ?? [];
      bucket.push(wager);
      wagersByRace.set(raceId, bucket);
    }

    const racesByCard = new Map<number, Array<Record<string, unknown>>>();

    for (const race of races) {
      const raceId = Number(race.id);
      const raceEntries = (entriesByRace.get(raceId) ?? []).sort(
        (a, b) =>
          Number(a.boxNumber ?? 0) - Number(b.boxNumber ?? 0),
      );
      const raceReplacements = replacementsByRace.get(raceId) ?? [];
      const raceWagers = wagersByRace.get(raceId) ?? [];

      const scratchedEntries = raceEntries.filter(
        (entry) => lower(entry.entryStatus) !== "active",
      );

      const affectedWagers = raceWagers.filter((wager) => {
        const selected = Array.isArray(wager.selected_entry_ids)
          ? wager.selected_entry_ids.map(Number)
          : [];

        return scratchedEntries.some((entry) =>
          selected.includes(Number(entry.id)),
        );
      });

      const bucket = racesByCard.get(Number(race.card_id)) ?? [];
      bucket.push({
        id: raceId,
        raceNumber: Number(race.race_number),
        grade: race.grade ?? null,
        distanceYards:
          race.distance_yards == null ? null : Number(race.distance_yards),
        scheduledPostTime: race.scheduled_post_time ?? null,
        actualPostTime: race.actual_post_time ?? null,
        raceStatus: String(race.race_status ?? ""),
        entries: raceEntries,
        scratchSummary: {
          totalEntries: raceEntries.length,
          activeEntries: raceEntries.filter(
            (entry) => lower(entry.entryStatus) === "active",
          ).length,
          changedEntries: scratchedEntries.length,
          replacementRows: raceReplacements.length,
          affectedLeagueWagers: affectedWagers.length,
          noActionReplacements: raceReplacements.filter(
            (row) => lower(row.replacementStatus) === "no_action",
          ).length,
        },
        replacements: raceReplacements,
      });

      racesByCard.set(Number(race.card_id), bucket);
    }

    const cardsPayload = cards.map((card) => {
      const cardRaces = (racesByCard.get(Number(card.id)) ?? []).sort(
        (a, b) =>
          Number(a.raceNumber ?? 0) - Number(b.raceNumber ?? 0),
      );

      return {
        id: Number(card.id),
        raceDate: String(card.race_date),
        session: String(card.session ?? ""),
        scheduledFirstPost: card.scheduled_first_post ?? null,
        cardStatus: String(card.card_status ?? ""),
        totalRaces: Number(card.total_races ?? cardRaces.length),
        commissionerConfirmedAt: card.commissioner_confirmed_at ?? null,
        track: tracksById.get(Number(card.track_id)) ?? null,
        scratchSummary: {
          racesWithChanges: cardRaces.filter(
            (race) =>
              Number(
                (race.scratchSummary as { changedEntries?: number })
                  ?.changedEntries ?? 0,
              ) > 0,
          ).length,
          changedEntries: cardRaces.reduce(
            (sum, race) =>
              sum +
              Number(
                (race.scratchSummary as { changedEntries?: number })
                  ?.changedEntries ?? 0,
              ),
            0,
          ),
          replacementRows: cardRaces.reduce(
            (sum, race) =>
              sum +
              Number(
                (race.scratchSummary as { replacementRows?: number })
                  ?.replacementRows ?? 0,
              ),
            0,
          ),
          noActionReplacements: cardRaces.reduce(
            (sum, race) =>
              sum +
              Number(
                (race.scratchSummary as {
                  noActionReplacements?: number;
                })?.noActionReplacements ?? 0,
              ),
            0,
          ),
        },
        races: cardRaces,
      };
    });

    const summary = {
      cards: cardsPayload.length,
      races: races.length,
      entries: entries.length,
      activeEntries: entries.filter(
        (row) => lower(row.entry_status) === "active",
      ).length,
      changedEntries: entries.filter(
        (row) => lower(row.entry_status) !== "active",
      ).length,
      replacements: replacements.length,
      noActionReplacements: replacements.filter(
        (row) => lower(row.replacement_status) === "no_action",
      ).length,
    };

    return NextResponse.json(
      {
        success: true,
        league: {
          id: leagueId,
          name: access.league.name,
        },
        summary,
        cards: cardsPayload,
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      },
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to load Greyhound Scratches & Changes.";

    if (message === "GREYHOUND_ONLY") {
      return jsonError(
        "This endpoint is only available for Greyhound leagues.",
        400,
      );
    }

    if (message === "COMMISSIONER_ONLY") {
      return jsonError(
        "Only the commissioner can access Scratches & Changes.",
        403,
      );
    }

    console.error(
      "[greyhound/commissioner/scratches-changes] GET failed",
      error,
    );

    return jsonError(message, 500);
  }
}
