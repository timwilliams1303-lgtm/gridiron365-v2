import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  refreshGreyhoundTournamentRound,
  type TournamentRoundRefreshResult,
} from "@/lib/greyhound/refreshGreyhoundTournamentRound";

export type RefreshAllGreyhoundTournamentRoundsResult = {
  leaguesChecked: number;
  roundsChecked: number;
  roundsRefreshed: number;
  roundsFailed: number;
  results: Array<
    TournamentRoundRefreshResult & {
      error?: string;
    }
  >;
};

export async function refreshAllGreyhoundTournamentRounds(): Promise<RefreshAllGreyhoundTournamentRoundsResult> {
  const admin = createSupabaseAdminClient();

  const { data: settingsRows, error: settingsError } = await admin
    .from("greyhound_league_settings")
    .select("league_id")
    .eq("game_format", "tournament");

  if (settingsError) throw settingsError;

  const leagueIds = Array.from(
    new Set(
      (settingsRows ?? [])
        .map((row) => String(row.league_id ?? "").trim())
        .filter(Boolean),
    ),
  );

  const results: RefreshAllGreyhoundTournamentRoundsResult["results"] = [];
  let roundsChecked = 0;
  let roundsRefreshed = 0;
  let roundsFailed = 0;

  for (const leagueId of leagueIds) {
    const { data: rounds, error: roundsError } = await admin
      .from("greyhound_competition_rounds")
      .select("id,status")
      .eq("league_id", leagueId)
      .in("status", ["scheduled", "active"])
      .order("round_number", { ascending: true });

    if (roundsError) {
      roundsFailed += 1;
      results.push({
        success: false,
        leagueId,
        roundId: 0,
        roundNumber: 0,
        status: "scheduled",
        advanceCount: null,
        advancedParticipantIds: [],
        eliminatedParticipantIds: [],
        championParticipantId: null,
        tiedCutoffParticipantIds: [],
        cutoffAdvanceSlots: 0,
        scores: [],
        error: roundsError.message,
      });
      continue;
    }

    for (const round of rounds ?? []) {
      roundsChecked += 1;

      try {
        const result = await refreshGreyhoundTournamentRound(
          leagueId,
          Number(round.id),
        );

        results.push(result);
        roundsRefreshed += 1;
      } catch (error) {
        roundsFailed += 1;
        results.push({
          success: false,
          leagueId,
          roundId: Number(round.id),
          roundNumber: 0,
          status: "scheduled",
          advanceCount: null,
          advancedParticipantIds: [],
          eliminatedParticipantIds: [],
          championParticipantId: null,
          tiedCutoffParticipantIds: [],
          cutoffAdvanceSlots: 0,
          scores: [],
          error:
            error instanceof Error
              ? error.message
              : "Unable to refresh Greyhound Tournament round.",
        });
      }
    }
  }

  return {
    leaguesChecked: leagueIds.length,
    roundsChecked,
    roundsRefreshed,
    roundsFailed,
    results,
  };
}