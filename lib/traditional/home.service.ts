import type {
  SupabaseClient,
} from "@supabase/supabase-js";


export type TraditionalHomeData = {
  teamCount: number;

  maxTeams: number;

  regularSeasonWeeks: number;

  openTeamSpots: number;
};


type LeagueSettingsRow = {
  max_teams: number | null;
  regular_season_weeks: number | null;
};


export async function getTraditionalHomeData(
  supabase: SupabaseClient,
  leagueId: string
): Promise<TraditionalHomeData> {
  /*
   * Get league settings.
   */
  const {
    data:
      settingsData,

    error:
      settingsError,
  } =
    await supabase
      .from(
        "league_settings"
      )
      .select(
        "max_teams, regular_season_weeks"
      )
      .eq(
        "league_id",
        leagueId
      )
      .maybeSingle();


  if (settingsError) {
    throw new Error(
      `Could not load league settings: ${settingsError.message}`
    );
  }


  const settings =
    settingsData as
      LeagueSettingsRow |
      null;


  /*
   * Count active teams.
   *
   * This is a server-side count only.
   * We do not need to download every team row.
   */
  const {
    count:
      teamCount,

    error:
      teamCountError,
  } =
    await supabase
      .from(
        "fantasy_teams"
      )
      .select(
        "id",
        {
          count:
            "exact",

          head:
            true,
        }
      )
      .eq(
        "league_id",
        leagueId
      )
      .eq(
        "active",
        true
      );


  if (teamCountError) {
    throw new Error(
      `Could not count fantasy teams: ${teamCountError.message}`
    );
  }


  const maxTeams =
    settings
      ?.max_teams ??
    12;


  const currentTeamCount =
    teamCount ??
    0;


  return {
    teamCount:
      currentTeamCount,

    maxTeams,

    regularSeasonWeeks:
      settings
        ?.regular_season_weeks ??
      14,

    openTeamSpots:
      Math.max(
        0,
        maxTeams -
          currentTeamCount
      ),
  };
}