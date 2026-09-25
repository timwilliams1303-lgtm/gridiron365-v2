import { redirect } from "next/navigation";

import NhlDynastyKeepers from "@/components/nhl-traditional/NhlDynastyKeepers";
import { requireLeagueMember } from "@/lib/leagues/requireLeagueMember";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type PageProps = {
  params: Promise<{
    leagueId: string;
  }>;
};

type SeasonStateRow = {
  phase: string | null;
};

type SettingsRow = {
  league_format: string | null;
};

export default async function NhlDynastyKeepersPage({
  params,
}: PageProps) {
  const { leagueId } = await params;

  const access =
    await requireLeagueMember(leagueId);

  if (
    String(access.league.leagueType) !==
    "nhl_traditional"
  ) {
    redirect(`/league/${leagueId}`);
  }

  const fantasyTeamId =
    access.fantasyTeam?.id ?? null;

  if (fantasyTeamId == null) {
    redirect(
      `/league/${leagueId}/nhl/offseason`
    );
  }

  const season =
    Number(access.league.season);

  if (!Number.isFinite(season)) {
    redirect(
      `/league/${leagueId}/nhl`
    );
  }

  const supabase =
    await createSupabaseServerClient();

  const [
    seasonStateResult,
    settingsResult,
  ] = await Promise.all([
    supabase
      .from(
        "nhl_traditional_season_state"
      )
      .select("phase")
      .eq("league_id", leagueId)
      .eq("season", season)
      .maybeSingle(),

    supabase
      .from(
        "nhl_traditional_settings"
      )
      .select("league_format")
      .eq("league_id", leagueId)
      .maybeSingle(),
  ]);

  if (seasonStateResult.error) {
    throw new Error(
      `Unable to load NHL season state: ${seasonStateResult.error.message}`
    );
  }

  if (settingsResult.error) {
    throw new Error(
      `Unable to load NHL league settings: ${settingsResult.error.message}`
    );
  }

  const seasonState =
    seasonStateResult.data as
      | SeasonStateRow
      | null;

  const settings =
    settingsResult.data as
      | SettingsRow
      | null;

  const phase =
    String(
      seasonState?.phase ?? ""
    )
      .trim()
      .toLowerCase();

  const leagueFormat =
    String(
      settings?.league_format ?? ""
    )
      .trim()
      .toLowerCase();

  /*
   * Keepers exist only inside the actual
   * Dynasty offseason.
   */
  if (
    phase !== "offseason" ||
    leagueFormat !== "dynasty"
  ) {
    redirect(
      `/league/${leagueId}/nhl/offseason`
    );
  }

  /*
   * The league's current season is the
   * completed/source season.
   *
   * Keeper selections target the next season.
   */
  const targetSeason =
    season + 1;

  return (
    <NhlDynastyKeepers
      leagueId={leagueId}
      fantasyTeamId={Number(fantasyTeamId)}
      sourceSeason={season}
      targetSeason={targetSeason}
    />
  );
}