import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  refreshGreyhoundH2HMatchups,
  type GreyhoundH2HRefreshResult,
} from "@/lib/greyhound/refreshGreyhoundH2HMatchups";

export type RefreshAllGreyhoundH2HResult = {
  leaguesChecked: number;
  leaguesRefreshed: number;
  leaguesFailed: number;
  results: Array<
    GreyhoundH2HRefreshResult & {
      error?: string;
    }
  >;
};

export async function refreshAllGreyhoundH2HMatchups(): Promise<RefreshAllGreyhoundH2HResult> {
  const admin = createSupabaseAdminClient();

  const { data, error } = await admin
    .from("greyhound_league_settings")
    .select("league_id")
    .eq("game_format", "team_head_to_head");

  if (error) throw error;

  const leagueIds = Array.from(
    new Set(
      (data ?? [])
        .map((row) => String(row.league_id ?? "").trim())
        .filter(Boolean),
    ),
  );

  const results: RefreshAllGreyhoundH2HResult["results"] = [];
  let leaguesRefreshed = 0;
  let leaguesFailed = 0;

  for (const leagueId of leagueIds) {
    try {
      const result = await refreshGreyhoundH2HMatchups(leagueId);
      results.push(result);
      leaguesRefreshed += 1;
    } catch (error) {
      leaguesFailed += 1;
      results.push({
        leagueId,
        matchupsChecked: 0,
        matchupsFinalized: 0,
        activeMatchups: 0,
        scheduledMatchups: 0,
        blockedMatchups: 0,
        error:
          error instanceof Error
            ? error.message
            : "Unable to refresh Greyhound Head-to-Head matchups.",
      });
    }
  }

  return {
    leaguesChecked: leagueIds.length,
    leaguesRefreshed,
    leaguesFailed,
    results,
  };
}
