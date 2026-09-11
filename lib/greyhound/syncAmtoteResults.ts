import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  getAmtoteRaceResult,
  getAmtoteRaceResults,
  getAmtoteRaces,
  g365TrackCodeForAmtote,
  type AmtoteDetailedRaceResult,
  type AmtoteRaceResultRow,
  type AmtoteTrackId,
  type G365GreyhoundTrackCode,
} from "@/lib/greyhound/amtote";

type SupportedWagerType =
  | "win"
  | "place"
  | "show"
  | "exacta"
  | "perfecta"
  | "quinella"
  | "trifecta"
  | "superfecta";

type ResultTrackSync = {
  trackId: AmtoteTrackId;
  trackCode: G365GreyhoundTrackCode;
  raceDate: string;
  session: string;
  cardId: number | null;
  racesAvailable: number;
  racesProcessed: number;
  raceResultRowsUpserted: number;
  dogResultRowsUpserted: number;
  payoutsUpserted: number;
  racesSettled: number;
  skippedRaces: number;
  skipped: boolean;
  skipReason: string | null;
  failed: boolean;
  errorMessage: string | null;
};

export type SyncAmtoteGreyhoundResultsResult = {
  success: boolean;
  syncedAt: string;
  tracks: ResultTrackSync[];
};

type PayoutRecord = {
  wagerType: SupportedWagerType;
  combination: string;
  baseAmount: number;
  payout: number;
  sourceKey: string;
};

function normalizeCombination(value: string): string {
  return value
    .trim()
    .replace(/[^0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function numericBox(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value.trim());

  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 8
    ? parsed
    : null;
}

function detailedTopFour(
  result: AmtoteDetailedRaceResult,
): Array<{ box: number; finish: number; row: AmtoteRaceResultRow }> {
  return result.rows
    .map((row) => ({
      box: numericBox(row.text),
      finish: row.finishPosition,
      row,
    }))
    .filter(
      (
        item,
      ): item is {
        box: number;
        finish: number;
        row: AmtoteRaceResultRow;
      } =>
        item.box !== null &&
        item.finish !== null &&
        item.finish >= 1 &&
        item.finish <= 4 &&
        (item.row.template ?? "").trim().toLowerCase() ===
          "winplacshow",
    )
    .sort((a, b) => a.finish - b.finish);
}

function arraysEqual(a: number[], b: number[]) {
  return (
    a.length === b.length &&
    a.every((value, index) => value === b[index])
  );
}

function exoticWagerType(
  template: string | null,
): SupportedWagerType | null {
  const normalized = (template ?? "").trim().toLowerCase();

  if (normalized === "exacta") return "exacta";
  if (normalized === "perfecta") return "perfecta";
  if (normalized === "quinella") return "quinella";
  if (normalized === "trifecta") return "trifecta";
  if (normalized === "superfecta") return "superfecta";

  return null;
}

function buildPayoutRecords(args: {
  trackId: AmtoteTrackId;
  raceDate: string;
  raceNumber: number;
  result: AmtoteDetailedRaceResult;
}): PayoutRecord[] {
  const payouts: PayoutRecord[] = [];

  for (const row of args.result.rows) {
    const sortKey = row.sort ?? 999;
    const template = (row.template ?? "").trim().toLowerCase();

    if (template === "winplacshow") {
      const box = numericBox(row.text);
      if (box === null) continue;

      // AmTote's US W/P/S fields are the published $2 return.
      const wpsBase = 2;

      if (row.winPayout !== null && row.winPayout > 0) {
        payouts.push({
          wagerType: "win",
          combination: String(box),
          baseAmount: wpsBase,
          payout: row.winPayout,
          sourceKey:
            `amtote:${args.trackId}:${args.raceDate}:${args.raceNumber}:row:${sortKey}:win`,
        });
      }

      if (row.placePayout !== null && row.placePayout > 0) {
        payouts.push({
          wagerType: "place",
          combination: String(box),
          baseAmount: wpsBase,
          payout: row.placePayout,
          sourceKey:
            `amtote:${args.trackId}:${args.raceDate}:${args.raceNumber}:row:${sortKey}:place`,
        });
      }

      if (row.showPayout !== null && row.showPayout > 0) {
        payouts.push({
          wagerType: "show",
          combination: String(box),
          baseAmount: wpsBase,
          payout: row.showPayout,
          sourceKey:
            `amtote:${args.trackId}:${args.raceDate}:${args.raceNumber}:row:${sortKey}:show`,
        });
      }

      continue;
    }

    const wagerType = exoticWagerType(row.template);
    if (!wagerType) continue;

    const rawCombination = (row.text ?? "").trim();

    // AmTote sometimes publishes an informational "BOX" payout row in
    // addition to the actual winning combination. G365 grades the user's
    // generated combinations, so the informational BOX row is ignored.
    if (!rawCombination || rawCombination.toUpperCase() === "BOX") {
      continue;
    }

    const combination = normalizeCombination(rawCombination);

    if (!combination) continue;
    if (row.baseAmount === null || row.baseAmount <= 0) continue;
    if (row.payout === null || row.payout < 0) continue;

    payouts.push({
      wagerType,
      combination,
      baseAmount: row.baseAmount,
      payout: row.payout,
      sourceKey:
        `amtote:${args.trackId}:${args.raceDate}:${args.raceNumber}:row:${sortKey}:${wagerType}`,
    });
  }

  return payouts;
}

async function syncOneTrackResults(
  trackId: AmtoteTrackId,
): Promise<ResultTrackSync> {
  const supabase = createSupabaseAdminClient();
  const trackCode = g365TrackCodeForAmtote(trackId);

  const feedCard = await getAmtoteRaces(trackId);

  const { data: track, error: trackError } = await supabase
    .from("greyhound_tracks")
    .select("id, code")
    .eq("code", trackCode)
    .eq("active", true)
    .maybeSingle();

  if (trackError) throw trackError;

  if (!track) {
    throw new Error(
      `Active G365 Greyhound track ${trackCode} was not found.`,
    );
  }

  const { data: card, error: cardError } = await supabase
    .from("greyhound_cards")
    .select(
      "id, race_date, session, card_status, import_status, commissioner_confirmed_at",
    )
    .eq("track_id", track.id)
    .eq("race_date", feedCard.raceDate)
    .eq("session", feedCard.session)
    .maybeSingle();

  if (cardError) throw cardError;

  if (!card) {
    return {
      trackId,
      trackCode,
      raceDate: feedCard.raceDate,
      session: feedCard.session,
      cardId: null,
      racesAvailable: 0,
      racesProcessed: 0,
      raceResultRowsUpserted: 0,
      dogResultRowsUpserted: 0,
      payoutsUpserted: 0,
      racesSettled: 0,
      skippedRaces: 0,
      skipped: true,
      skipReason:
        "No exact G365 card exists for the AmTote track/date/session.",
      failed: false,
      errorMessage: null,
    };
  }

  // Final is terminal for the results worker. Once a card is final,
  // do not call GetRaceResults/GetRaceResult again and do not re-run
  // settlement, payout upserts, dog-result upserts, or bankroll refreshes.
  if (card.card_status === "final") {
    return {
      trackId,
      trackCode,
      raceDate: feedCard.raceDate,
      session: feedCard.session,
      cardId: Number(card.id),
      racesAvailable: 0,
      racesProcessed: 0,
      raceResultRowsUpserted: 0,
      dogResultRowsUpserted: 0,
      payoutsUpserted: 0,
      racesSettled: 0,
      skippedRaces: 0,
      skipped: true,
      skipReason: "Card is final.",
      failed: false,
      errorMessage: null,
    };
  }

  if (card.card_status === "cancelled") {
    return {
      trackId,
      trackCode,
      raceDate: feedCard.raceDate,
      session: feedCard.session,
      cardId: Number(card.id),
      racesAvailable: 0,
      racesProcessed: 0,
      raceResultRowsUpserted: 0,
      dogResultRowsUpserted: 0,
      payoutsUpserted: 0,
      racesSettled: 0,
      skippedRaces: 0,
      skipped: true,
      skipReason: "Card is cancelled.",
      failed: false,
      errorMessage: null,
    };
  }

  const summary = await getAmtoteRaceResults(
    trackId,
    feedCard.raceDate,
  );

  if (summary.raceDate !== feedCard.raceDate) {
    throw new Error(
      `${trackCode} date safety check failed. GetRaces=${feedCard.raceDate}, GetRaceResults=${summary.raceDate}.`,
    );
  }

  if (!["imported", "updated"].includes(card.import_status)) {
    return {
      trackId,
      trackCode,
      raceDate: feedCard.raceDate,
      session: feedCard.session,
      cardId: Number(card.id),
      racesAvailable: summary.rows.length,
      racesProcessed: 0,
      raceResultRowsUpserted: 0,
      dogResultRowsUpserted: 0,
      payoutsUpserted: 0,
      racesSettled: 0,
      skippedRaces: 0,
      skipped: true,
      skipReason: `Card import status is ${card.import_status}.`,
      failed: false,
      errorMessage: null,
    };
  }

  const { data: savedRaces, error: racesError } = await supabase
    .from("greyhound_races")
    .select("id, race_number, race_status")
    .eq("card_id", card.id)
    .order("race_number", { ascending: true });

  if (racesError) throw racesError;

  const savedRaceByNumber = new Map<number, {
    id: number;
    race_number: number;
    race_status: string;
  }>();

  for (const race of savedRaces ?? []) {
    savedRaceByNumber.set(Number(race.race_number), {
      id: Number(race.id),
      race_number: Number(race.race_number),
      race_status: String(race.race_status),
    });
  }

  let racesProcessed = 0;
  let raceResultRowsUpserted = 0;
  let dogResultRowsUpserted = 0;
  let payoutsUpserted = 0;
  let racesSettled = 0;
  let skippedRaces = 0;

  for (const summaryRace of summary.rows) {
    if (summaryRace.topFour.length < 4) {
      skippedRaces += 1;
      continue;
    }

    const savedRace = savedRaceByNumber.get(
      summaryRace.raceNumber,
    );

    if (!savedRace) {
      skippedRaces += 1;
      continue;
    }

    if (
      savedRace.race_status === "cancelled" ||
      savedRace.race_status === "no_contest"
    ) {
      skippedRaces += 1;
      continue;
    }

    const detailed = await getAmtoteRaceResult(
      trackId,
      feedCard.raceDate,
      summaryRace.raceNumber,
    );

    if (detailed.raceDate !== feedCard.raceDate) {
      throw new Error(
        `${trackCode} Race ${summaryRace.raceNumber} detailed result date mismatch. Expected ${feedCard.raceDate}, got ${detailed.raceDate}.`,
      );
    }

    if (detailed.raceNumber !== summaryRace.raceNumber) {
      throw new Error(
        `${trackCode} detailed result race mismatch. Expected Race ${summaryRace.raceNumber}, got Race ${detailed.raceNumber}.`,
      );
    }

    if (!detailed.reportReady) {
      skippedRaces += 1;
      continue;
    }

    const topFourRows = detailedTopFour(detailed);
    const detailedBoxes = topFourRows.map((item) => item.box);

    if (
      topFourRows.length < 4 ||
      !arraysEqual(
        detailedBoxes,
        summaryRace.topFour.slice(0, 4),
      )
    ) {
      throw new Error(
        `${trackCode} Race ${summaryRace.raceNumber} result cross-check failed. Summary=${summaryRace.topFour.join("-")}, Detailed=${detailedBoxes.join("-") || "none"}.`,
      );
    }

    for (const item of topFourRows) {
      const sourceResultKey =
        `amtote:${trackId}:${feedCard.raceDate}:${summaryRace.raceNumber}:finish:${item.finish}`;

      const { error: resultError } = await supabase.rpc(
        "upsert_greyhound_race_result",
        {
          p_race_id: savedRace.id,
          p_box_number: item.box,
          p_finish_position: item.finish,
          p_final_odds_text: null,
          p_final_odds_decimal: null,
          p_official_time: null,
          p_result_status: "official",
          p_is_dead_heat: false,
          p_source_result_key: sourceResultKey,
        },
      );

      if (resultError) {
        throw new Error(
          `${trackCode} Race ${summaryRace.raceNumber} Box ${item.box} result upsert failed: ${resultError.message}`,
        );
      }

      raceResultRowsUpserted += 1;

      const { error: dogResultError } = await supabase.rpc(
        "upsert_greyhound_dog_result_from_race",
        {
          p_race_id: savedRace.id,
          p_box_number: item.box,
        },
      );

      if (dogResultError) {
        throw new Error(
          `${trackCode} Race ${summaryRace.raceNumber} Box ${item.box} dog-result upsert failed: ${dogResultError.message}`,
        );
      }

      dogResultRowsUpserted += 1;
    }

    const payouts = buildPayoutRecords({
      trackId,
      raceDate: feedCard.raceDate,
      raceNumber: summaryRace.raceNumber,
      result: detailed,
    });

    for (const payout of payouts) {
      const { error: payoutError } = await supabase.rpc(
        "upsert_greyhound_mutuel_payout",
        {
          p_race_id: savedRace.id,
          p_wager_type: payout.wagerType,
          p_winning_combination: payout.combination,
          p_published_base_amount: payout.baseAmount,
          p_published_payout: payout.payout,
          p_source: "amtote",
          p_source_payout_key: payout.sourceKey,
          p_payout_status: "official",
        },
      );

      if (payoutError) {
        throw new Error(
          `${trackCode} Race ${summaryRace.raceNumber} ${payout.wagerType} payout upsert failed: ${payoutError.message}`,
        );
      }

      payoutsUpserted += 1;
    }

    const { error: settleError } = await supabase.rpc(
      "settle_greyhound_race",
      {
        p_race_id: savedRace.id,
      },
    );

    if (settleError) {
      throw new Error(
        `${trackCode} Race ${summaryRace.raceNumber} settlement failed: ${settleError.message}`,
      );
    }

    racesProcessed += 1;
    racesSettled += 1;
  }

  return {
    trackId,
    trackCode,
    raceDate: feedCard.raceDate,
    session: feedCard.session,
    cardId: Number(card.id),
    racesAvailable: summary.rows.length,
    racesProcessed,
    raceResultRowsUpserted,
    dogResultRowsUpserted,
    payoutsUpserted,
    racesSettled,
    skippedRaces,
    skipped: false,
    skipReason: null,
    failed: false,
    errorMessage: null,
  };
}

export async function syncAmtoteGreyhoundResults(
  trackIds: AmtoteTrackId[] = ["WEM", "TSE"],
): Promise<SyncAmtoteGreyhoundResultsResult> {
  const tracks: ResultTrackSync[] = [];

  for (const trackId of trackIds) {
    try {
      tracks.push(await syncOneTrackResults(trackId));
    } catch (error) {
      tracks.push({
        trackId,
        trackCode: g365TrackCodeForAmtote(trackId),
        raceDate: "",
        session:
          trackId === "TSE" ? "evening" : "afternoon",
        cardId: null,
        racesAvailable: 0,
        racesProcessed: 0,
        raceResultRowsUpserted: 0,
        dogResultRowsUpserted: 0,
        payoutsUpserted: 0,
        racesSettled: 0,
        skippedRaces: 0,
        skipped: false,
        skipReason: null,
        failed: true,
        errorMessage:
          error instanceof Error
            ? error.message
            : "Unknown AmTote results sync error.",
      });
    }
  }

  return {
    success: tracks.every((track) => !track.failed),
    syncedAt: new Date().toISOString(),
    tracks,
  };
}
