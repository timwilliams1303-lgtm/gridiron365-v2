import type {
  SupabaseClient,
} from "@supabase/supabase-js";


export type TraditionalHomeMatchup = {
  id: number;

  week: number;

  homeFantasyTeamId: number;

  homeTeamName: string;

  homePoints: number;

  awayFantasyTeamId: number;

  awayTeamName: string;

  awayPoints: number;

  isLive: boolean;

  isFinal: boolean;

  tied: boolean;

  winnerFantasyTeamId:
    number | null;

  isUserHomeTeam: boolean;
};


export type TraditionalHomeData = {
  teamCount: number;

  maxTeams: number;

  regularSeasonWeeks: number;

  openTeamSpots: number;

  activeWeek: number;

  phase: string;

  regularSeasonComplete:
    boolean;

  playoffsStarted:
    boolean;

  seasonComplete:
    boolean;

  lastCompletedWeek:
    number | null;

  rosterCount: number;

  injuredRosterPlayers:
    number;

  currentMatchup:
    TraditionalHomeMatchup |
    null;
};


type LeagueSettingsRow = {
  max_teams:
    number | null;

  regular_season_weeks:
    number | null;
};


type SeasonStateRow = {
  active_week:
    number | null;

  phase:
    string | null;

  regular_season_complete:
    boolean | null;

  playoffs_started:
    boolean | null;

  season_complete:
    boolean | null;

  last_completed_week:
    number | null;
};


type MatchupRow = {
  id: number;

  week: number;

  home_fantasy_team_id:
    number;

  away_fantasy_team_id:
    number;

  home_points:
    number | string | null;

  away_points:
    number | string | null;

  is_live:
    boolean | null;

  is_final:
    boolean | null;

  winner_fantasy_team_id:
    number | null;

  tied:
    boolean | null;
};


function toNumber(
  value:
    | number
    | string
    | null
    | undefined
) {
  if (
    value === null ||
    value === undefined
  ) {
    return 0;
  }

  const parsed =
    Number(value);

  return Number.isFinite(
    parsed
  )
    ? parsed
    : 0;
}


export async function getTraditionalHomeData(
  supabase: SupabaseClient,
  leagueId: string,
  season: number,
  fantasyTeamId:
    number | null
): Promise<TraditionalHomeData> {
  /*
   * =======================================================
   * LEAGUE SETTINGS
   * =======================================================
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
        `
          max_teams,
          regular_season_weeks
        `
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
   * =======================================================
   * ACTIVE TEAM COUNT
   * =======================================================
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


  /*
   * =======================================================
   * SEASON STATE
   * =======================================================
   */

  const {
    data:
      seasonStateData,

    error:
      seasonStateError,
  } =
    await supabase
      .from(
        "traditional_season_state"
      )
      .select(
        `
          active_week,
          phase,
          regular_season_complete,
          playoffs_started,
          season_complete,
          last_completed_week
        `
      )
      .eq(
        "league_id",
        leagueId
      )
      .eq(
        "season",
        season
      )
      .maybeSingle();


  if (seasonStateError) {
    throw new Error(
      `Could not load Traditional season state: ${seasonStateError.message}`
    );
  }


  const seasonState =
    seasonStateData as
      SeasonStateRow |
      null;


  const activeWeek =
    seasonState
      ?.active_week ??
    1;


  /*
   * =======================================================
   * USER ROSTER
   * =======================================================
   */

  let rosterCount =
    0;

  let injuredRosterPlayers =
    0;


  if (
    fantasyTeamId !== null
  ) {
    const {
      count,
      error,
    } =
      await supabase
        .from(
          "team_rosters"
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
          "fantasy_team_id",
          fantasyTeamId
        );


    if (error) {
      throw new Error(
        `Could not count roster players: ${error.message}`
      );
    }


    rosterCount =
      count ??
      0;


    /*
     * Get roster player IDs so we can
     * count current injuries.
     */

    const {
      data:
        rosterPlayers,

      error:
        rosterPlayersError,
    } =
      await supabase
        .from(
          "team_rosters"
        )
        .select(
          "player_id"
        )
        .eq(
          "league_id",
          leagueId
        )
        .eq(
          "fantasy_team_id",
          fantasyTeamId
        );


    if (
      rosterPlayersError
    ) {
      throw new Error(
        `Could not load roster players: ${rosterPlayersError.message}`
      );
    }


    const playerIds =
      (
        rosterPlayers ??
        []
      )
        .map(
          (
            row
          ) =>
            Number(
              row.player_id
            )
        )
        .filter(
          (
            playerId
          ) =>
            Number.isFinite(
              playerId
            )
        );


    if (
      playerIds.length >
      0
    ) {
      const {
        count:
          injuryCount,

        error:
          injuryError,
      } =
        await supabase
          .from(
            "current_nfl_player_injuries"
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
            "season",
            season
          )
          .in(
            "nfl_player_id",
            playerIds
          );


      if (injuryError) {
        throw new Error(
          `Could not count roster injuries: ${injuryError.message}`
        );
      }


      injuredRosterPlayers =
        injuryCount ??
        0;
    }
  }


  /*
   * =======================================================
   * CURRENT MATCHUP
   * =======================================================
   */

  let currentMatchup:
    TraditionalHomeMatchup |
    null =
      null;


  if (
    fantasyTeamId !== null
  ) {
    const {
      data:
        matchupData,

      error:
        matchupError,
    } =
      await supabase
        .from(
          "traditional_matchups"
        )
        .select(
          `
            id,
            week,
            home_fantasy_team_id,
            away_fantasy_team_id,
            home_points,
            away_points,
            is_live,
            is_final,
            winner_fantasy_team_id,
            tied
          `
        )
        .eq(
          "league_id",
          leagueId
        )
        .eq(
          "season",
          season
        )
        .eq(
          "week",
          activeWeek
        )
        .or(
          `home_fantasy_team_id.eq.${fantasyTeamId},away_fantasy_team_id.eq.${fantasyTeamId}`
        )
        .maybeSingle();


    if (matchupError) {
      throw new Error(
        `Could not load current matchup: ${matchupError.message}`
      );
    }


    const matchup =
      matchupData as
        MatchupRow |
        null;


    if (matchup) {
      const teamIds = [
        matchup
          .home_fantasy_team_id,

        matchup
          .away_fantasy_team_id,
      ];


      const {
        data:
          teamRows,

        error:
          teamRowsError,
      } =
        await supabase
          .from(
            "fantasy_teams"
          )
          .select(
            `
              id,
              team_name
            `
          )
          .in(
            "id",
            teamIds
          );


      if (teamRowsError) {
        throw new Error(
          `Could not load matchup team names: ${teamRowsError.message}`
        );
      }


      const teamNames =
        new Map<
          number,
          string
        >();


      for (
        const team
        of teamRows ??
        []
      ) {
        teamNames.set(
          Number(
            team.id
          ),
          String(
            team.team_name
          )
        );
      }


      currentMatchup = {
        id:
          matchup.id,

        week:
          matchup.week,

        homeFantasyTeamId:
          matchup
            .home_fantasy_team_id,

        homeTeamName:
          teamNames.get(
            matchup
              .home_fantasy_team_id
          ) ??
          "Home Team",

        homePoints:
          toNumber(
            matchup
              .home_points
          ),

        awayFantasyTeamId:
          matchup
            .away_fantasy_team_id,

        awayTeamName:
          teamNames.get(
            matchup
              .away_fantasy_team_id
          ) ??
          "Away Team",

        awayPoints:
          toNumber(
            matchup
              .away_points
          ),

        isLive:
          matchup
            .is_live ??
          false,

        isFinal:
          matchup
            .is_final ??
          false,

        tied:
          matchup
            .tied ??
          false,

        winnerFantasyTeamId:
          matchup
            .winner_fantasy_team_id,

        isUserHomeTeam:
          matchup
            .home_fantasy_team_id ===
          fantasyTeamId,
      };
    }
  }


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

    activeWeek,

    phase:
      seasonState
        ?.phase ??
      "regular_season",

    regularSeasonComplete:
      seasonState
        ?.regular_season_complete ??
      false,

    playoffsStarted:
      seasonState
        ?.playoffs_started ??
      false,

    seasonComplete:
      seasonState
        ?.season_complete ??
      false,

    lastCompletedWeek:
      seasonState
        ?.last_completed_week ??
      null,

    rosterCount,

    injuredRosterPlayers,

    currentMatchup,
  };
}