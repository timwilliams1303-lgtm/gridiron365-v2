import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  archiveCompletedGreyhoundCompetitions,
  type GreyhoundArchiveResult,
} from "@/lib/greyhound/archiveCompletedCompetitions";
import { refreshAllGreyhoundH2HMatchups } from "@/lib/greyhound/refreshAllGreyhoundH2HMatchups";
import { refreshAllGreyhoundTournamentRounds } from "@/lib/greyhound/refreshAllGreyhoundTournamentRounds";
import { refreshAllGreyhoundRoundSurvivorRounds } from "@/lib/greyhound/refreshAllGreyhoundRoundSurvivorRounds";
import { processGreyhoundDailySurvivorRace } from "@/lib/greyhound/processGreyhoundDailySurvivorRace";
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
  competitionArchives: GreyhoundArchiveResult[];
  h2hRefresh: {
    leaguesChecked: number;
    leaguesRefreshed: number;
    leaguesFailed: number;
    results: Array<{
      leagueId: string;
      matchupsChecked: number;
      matchupsFinalized: number;
      activeMatchups: number;
      scheduledMatchups: number;
      blockedMatchups: number;
      error?: string;
    }>;
  } | null;
  roundSurvivorRefresh: {
    leaguesChecked: number;
    roundsChecked: number;
    roundsRefreshed: number;
    roundsFailed: number;
    results: Array<{
      success: boolean;
      leagueId: string;
      roundId: number;
      roundNumber: number;
      status:
        | "scheduled"
        | "active"
        | "final"
        | "blocked_tie"
        | "blocked_no_next_round";
      eliminatedParticipantId: number | null;
      championParticipantId: number | null;
      blockedTieParticipantIds: number[];
      scores: Array<{
        participantId: number;
        participantName: string;
        totalWagered: number;
        totalReturned: number;
        net: number;
        rank: number;
      }>;
      error?: string;
    }>;
  } | null;
  tournamentRefresh: {
    leaguesChecked: number;
    roundsChecked: number;
    roundsRefreshed: number;
    roundsFailed: number;
    results: Array<{
      success: boolean;
      leagueId: string;
      roundId: number;
      roundNumber: number;
      status:
        | "scheduled"
        | "active"
        | "final"
        | "blocked_cutoff_tie"
        | "blocked_missing_advance_count"
        | "blocked_no_next_round";
      advanceCount: number | null;
      advancedParticipantIds: number[];
      eliminatedParticipantIds: number[];
      championParticipantId: number | null;
      tiedCutoffParticipantIds: number[];
      scores: Array<{
        participantId: number;
        participantName: string;
        totalWagered: number;
        totalReturned: number;
        net: number;
        rank: number;
      }>;
      error?: string;
    }>;
  } | null;
};

type PayoutRecord = {
  wagerType: SupportedWagerType;
  combination: string;
  baseAmount: number;
  payout: number;
  sourceKey: string;
};

type GreyhoundCardRow = {
  id: number;
  race_date: string;
  session: string;
  card_status: string;
  import_status: string;
  automation_enabled: boolean;
  commissioner_confirmed_at: string | null;
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

  // GetRaces is still used to identify the feed's current date.
  // We do NOT assume that the current feed date is the only card that may
  // still need results. AmTote can advance to the next card while the prior
  // G365 card still needs final result/payout processing.
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

  // Prefer the oldest confirmed, automation-enabled, non-terminal card for
  // this track up through the current AmTote feed date. This allows a prior
  // card to finish settling even after GetRaces has advanced to the next day.
  const { data: unfinishedCards, error: unfinishedError } = await supabase
    .from("greyhound_cards")
    .select(
      "id, race_date, session, card_status, import_status, automation_enabled, commissioner_confirmed_at",
    )
    .eq("track_id", track.id)
    .eq("automation_enabled", true)
    .not("commissioner_confirmed_at", "is", null)
    .neq("card_status", "final")
    .neq("card_status", "cancelled")
    .lte("race_date", feedCard.raceDate)
    .order("race_date", { ascending: true })
    .order("id", { ascending: true })
    .limit(1);

  if (unfinishedError) throw unfinishedError;

  let card: GreyhoundCardRow | null =
    unfinishedCards && unfinishedCards.length > 0
      ? (unfinishedCards[0] as GreyhoundCardRow)
      : null;

  // If there is no unfinished card, fall back to the exact card represented
  // by GetRaces. This preserves the terminal "Card is final" fast-stop path.
  if (!card) {
    const { data: currentCard, error: currentCardError } = await supabase
      .from("greyhound_cards")
      .select(
        "id, race_date, session, card_status, import_status, automation_enabled, commissioner_confirmed_at",
      )
      .eq("track_id", track.id)
      .eq("race_date", feedCard.raceDate)
      .eq("session", feedCard.session)
      .maybeSingle();

    if (currentCardError) throw currentCardError;

    card = currentCard as GreyhoundCardRow | null;
  }

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
        "No unfinished or exact current G365 card exists for the AmTote track/date/session.",
      failed: false,
      errorMessage: null,
    };
  }

  const targetRaceDate = String(card.race_date);
  const targetSession = String(card.session);

  // Final is terminal for the results worker. Once a card is final,
  // do not call GetRaceResults/GetRaceResult again and do not re-run
  // settlement, payout upserts, dog-result upserts, or bankroll refreshes.
  if (card.card_status === "final") {
    return {
      trackId,
      trackCode,
      raceDate: targetRaceDate,
      session: targetSession,
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
      raceDate: targetRaceDate,
      session: targetSession,
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

  if (!["imported", "updated"].includes(card.import_status)) {
    return {
      trackId,
      trackCode,
      raceDate: targetRaceDate,
      session: targetSession,
      cardId: Number(card.id),
      racesAvailable: 0,
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

  // Query results for the stored G365 card date, not blindly for the current
  // GetRaces date. GetRaceResults supports historical dates and this is what
  // prevents an unfinished card from being stranded after feed rollover.
  const summary = await getAmtoteRaceResults(
    trackId,
    targetRaceDate,
  );

  if (summary.raceDate !== targetRaceDate) {
    throw new Error(
      `${trackCode} date safety check failed. Target=${targetRaceDate}, GetRaceResults=${summary.raceDate}.`,
    );
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
      targetRaceDate,
      summaryRace.raceNumber,
    );

    if (detailed.raceDate !== targetRaceDate) {
      throw new Error(
        `${trackCode} Race ${summaryRace.raceNumber} detailed result date mismatch. Expected ${targetRaceDate}, got ${detailed.raceDate}.`,
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
        `amtote:${trackId}:${targetRaceDate}:${summaryRace.raceNumber}:finish:${item.finish}`;

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
      raceDate: targetRaceDate,
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

    try {
      await processGreyhoundDailySurvivorRace(savedRace.id);
    } catch (error) {
      console.error(
        `[greyhound/results-sync] Daily Survivor Race ${summaryRace.raceNumber} processing failed`,
        error,
      );
    }

    racesProcessed += 1;
    racesSettled += 1;
  }

  return {
    trackId,
    trackCode,
    raceDate: targetRaceDate,
    session: targetSession,
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

  let competitionArchives: GreyhoundArchiveResult[] = [];
  let h2hRefresh: SyncAmtoteGreyhoundResultsResult["h2hRefresh"] = null;
  let roundSurvivorRefresh:
    SyncAmtoteGreyhoundResultsResult["roundSurvivorRefresh"] = null;
  let tournamentRefresh:
    SyncAmtoteGreyhoundResultsResult["tournamentRefresh"] = null;

  try {
    h2hRefresh = await refreshAllGreyhoundH2HMatchups();
  } catch (error) {
    console.error(
      "[greyhound/results-sync] Head-to-Head refresh failed",
      error,
    );
  }

  try {
    roundSurvivorRefresh =
      await refreshAllGreyhoundRoundSurvivorRounds();
  } catch (error) {
    console.error(
      "[greyhound/results-sync] Round Survivor refresh failed",
      error,
    );
  }

  try {
    tournamentRefresh =
      await refreshAllGreyhoundTournamentRounds();
  } catch (error) {
    console.error(
      "[greyhound/results-sync] Tournament refresh failed",
      error,
    );
  }

  try {
    competitionArchives =
      await archiveCompletedGreyhoundCompetitions();
  } catch (error) {
    competitionArchives = [
      {
        leagueId: "all",
        archived: false,
        competitionNumber: null,
        reason:
          error instanceof Error
            ? error.message
            : "Unknown Greyhound archive scan error.",
      },
    ];
  }

  return {
    success: tracks.every((track) => !track.failed),
    syncedAt: new Date().toISOString(),
    tracks,
    competitionArchives,
    h2hRefresh,
    roundSurvivorRefresh,
    tournamentRefresh,
  };
}
