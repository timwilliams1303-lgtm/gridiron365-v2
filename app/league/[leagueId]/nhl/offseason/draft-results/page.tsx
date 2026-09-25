import { redirect } from "next/navigation";

import NhlTraditionalDraftResults from "@/components/nhl-traditional/NhlTraditionalDraftResults";
import { requireLeagueMember } from "@/lib/leagues/requireLeagueMember";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type PageProps = {
  params: Promise<{
    leagueId: string;
  }>;
  searchParams: Promise<{
    season?: string | string[];
  }>;
};

type DraftLookupRow = {
  season: number;
};

export default async function NhlTraditionalDraftResultsPage({
  params,
  searchParams,
}: PageProps) {
  const { leagueId } = await params;
  const query = await searchParams;

  const access = await requireLeagueMember(leagueId);

  if (String(access.league.leagueType) !== "nhl_traditional") {
    redirect(`/league/${leagueId}`);
  }

  const currentSeason = Number(access.league.season);

  if (!Number.isFinite(currentSeason)) {
    redirect(`/league/${leagueId}/nhl`);
  }

  const requestedSeasonRaw = Array.isArray(query.season)
    ? query.season[0]
    : query.season;

  const requestedSeason =
    requestedSeasonRaw != null && requestedSeasonRaw.trim() !== ""
      ? Number(requestedSeasonRaw)
      : null;

  if (
    requestedSeason != null &&
    (!Number.isInteger(requestedSeason) ||
      requestedSeason < 1900 ||
      requestedSeason > currentSeason + 1)
  ) {
    redirect(`/league/${leagueId}/nhl/offseason/draft-results`);
  }

  const supabase = await createSupabaseServerClient();

  let draftSeason: number | null = requestedSeason;

  /*
   * No season in the URL:
   * show the newest completed draft for this league.
   *
   * This works both before activation (for example, completed 2027
   * annual draft while league.season is still 2026) and after
   * activation (league.season becomes 2027).
   */
  if (draftSeason == null) {
    const { data, error } = await supabase
      .from("nhl_traditional_drafts")
      .select("season")
      .eq("league_id", leagueId)
      .eq("status", "completed")
      .lte("season", currentSeason + 1)
      .order("season", { ascending: false })
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(
        `Unable to locate NHL Draft Results: ${error.message}`
      );
    }

    draftSeason = (data as DraftLookupRow | null)?.season ?? null;
  }

  /*
   * If there is no completed draft yet, keep the current offseason
   * workflow useful by pointing at the next-season draft shell.
   * Once a draft is completed, the latest completed season above wins.
   */
  if (draftSeason == null) {
    draftSeason = currentSeason + 1;
  }

  /*
   * Keeper selections for an annual Dynasty draft are stored against
   * source season = draft season - 1. Startup/Redraft drafts simply
   * return no keeper rows, which is correct.
   */
  const sourceSeason = draftSeason - 1;

  return (
    <NhlTraditionalDraftResults
      leagueId={leagueId}
      sourceSeason={sourceSeason}
      draftSeason={draftSeason}
    />
  );
}