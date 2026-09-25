import { redirect } from "next/navigation";

import NhlTraditionalNewSeason from "@/components/nhl-traditional/NhlTraditionalNewSeason";
import { requireLeagueMember } from "@/lib/leagues/requireLeagueMember";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type PageProps = {
  params: Promise<{
    leagueId: string;
  }>;
};

type SettingsRow = {
  league_format: string | null;
};

type SeasonStateRow = {
  season: number;
  season_complete: boolean | null;
  champion_fantasy_team_id: number | null;
};

export default async function NhlTraditionalNewSeasonPage({
  params,
}: PageProps) {
  const { leagueId } = await params;

  const access = await requireLeagueMember(leagueId);

  if (String(access.league.leagueType) !== "nhl_traditional") {
    redirect(`/league/${leagueId}`);
  }

  const sourceSeason = Number(access.league.season);

  if (!Number.isInteger(sourceSeason)) {
    throw new Error("NHL Traditional league season is invalid.");
  }

  const supabase = await createSupabaseServerClient();

  const [
    settingsResult,
    seasonStateResult,
  ] = await Promise.all([
    supabase
      .from("nhl_traditional_settings")
      .select("league_format")
      .eq("league_id", leagueId)
      .maybeSingle(),

    supabase
      .from("nhl_traditional_season_state")
      .select(
        [
          "season",
          "season_complete",
          "champion_fantasy_team_id",
        ].join(",")
      )
      .eq("league_id", leagueId)
      .eq("season", sourceSeason)
      .maybeSingle(),
  ]);

  if (settingsResult.error) {
    throw new Error(
      `Unable to load NHL Traditional settings: ${settingsResult.error.message}`
    );
  }

  if (seasonStateResult.error) {
    throw new Error(
      `Unable to load NHL Traditional season state: ${seasonStateResult.error.message}`
    );
  }

  const settings =
    settingsResult.data as SettingsRow | null;

  const seasonState =
    seasonStateResult.data as SeasonStateRow | null;

  if (!settings) {
    throw new Error(
      "NHL Traditional league settings are missing."
    );
  }

  if (!seasonState) {
    throw new Error(
      `NHL Traditional season state for ${sourceSeason} is missing.`
    );
  }

  const normalizedLeagueFormat = String(
    settings.league_format ?? ""
  )
    .trim()
    .toLowerCase();

  if (
    normalizedLeagueFormat !== "dynasty" &&
    normalizedLeagueFormat !== "redraft"
  ) {
    throw new Error(
      `Unsupported NHL Traditional league format: ${
        settings.league_format ?? "unknown"
      }`
    );
  }

  return (
    <NhlTraditionalNewSeason
      leagueId={leagueId}
      sourceSeason={sourceSeason}
      leagueFormat={normalizedLeagueFormat}
      isCommissioner={Boolean(access.isCommissioner)}
      sourceSeasonComplete={
        seasonState.season_complete === true
      }
      championRecorded={
        seasonState.champion_fantasy_team_id != null
      }
    />
  );
}