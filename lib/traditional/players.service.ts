import type {
  SupabaseClient,
} from "@supabase/supabase-js";


export type TraditionalPlayerBrowserRow = {
  playerId: number;

  fullName: string;

  position: string;

  teamAbbreviation:
    string | null;

  headshotUrl:
    string | null;

  nflStatus:
    string | null;

  isActive: boolean;

  injuryStatus:
    string | null;

  injuryDetail:
    string | null;

  isRostered: boolean;

  fantasyTeamId:
    number | null;

  fantasyTeamName:
    string | null;

  isMyPlayer: boolean;

  isOnWaivers: boolean;

  waiverUntil:
    string | null;

  defaultRank:
    number | null;

  seasonFantasyPoints:
    number;

  weeklyProjectedPoints:
    number | null;

  weeklyRank:
    number | null;

  opponentAbbreviation:
    string | null;

  homeOrAway:
    string | null;

  kickoffAt:
    string | null;

  isBye:
    boolean;
};


export type TraditionalPlayersData = {
  players:
    TraditionalPlayerBrowserRow[];

  totalPlayers: number;

  freeAgents: number;

  rosteredPlayers: number;

  injuredPlayers: number;

  waiverPlayers: number;

  teams:
    string[];

  activeWeek: number;

  waiverType: string;
};


type NflPlayerRow = {
  id: number;

  full_name: string;

  primary_position: string;

  team_abbreviation:
    string | null;

  headshot_url:
    string | null;

  status:
    string | null;

  is_active:
    boolean | null;
};


type TeamRosterRow = {
  fantasy_team_id: number;

  player_id: number;
};


type FantasyTeamRow = {
  id: number;

  team_name: string;
};


type InjuryRow = {
  nfl_player_id: number;

  status:
    string | null;

  injury_detail:
    string | null;
};


type SeasonStateRow = {
  active_week:
    number | null;
};


type WaiverSettingsRow = {
  waiver_type:
    string | null;
};


type PlayerWaiverStatusRow = {
  player_id: number;

  waiver_until: string;
};


type DefaultRankingRow = {
  player_id: number;
  rank: number;
};


type FantasyScoreRow = {
  nfl_player_id: number;
  fantasy_points:
    number |
    string |
    null;
};


type WeeklyProjectionRow = {
  player_id: number;
  opponent_abbreviation: string | null;
  home_or_away: string | null;
  kickoff_at: string | null;
  is_bye: boolean | null;
  projected_points: number | string | null;
};


async function loadFantasyPlayers(
  supabase:
    SupabaseClient
) {
  const rows:
    NflPlayerRow[] =
      [];


  const pageSize =
    1000;


  let start =
    0;


  while (true) {
    const end =
      start +
      pageSize -
      1;


    const {
      data,
      error,
    } =
      await supabase
        .from(
          "nfl_players"
        )
        .select(`
          id,
          full_name,
          primary_position,
          team_abbreviation,
          headshot_url,
          status,
          is_active
        `)
        .in(
          "primary_position",
          [
            "QB",
            "RB",
            "WR",
            "TE",
            "K",
            "PK",
            "DST",
            "FB",
          ]
        )
        .order(
          "full_name",
          {
            ascending:
              true,
          }
        )
        .range(
          start,
          end
        );


    if (error) {
      throw new Error(
        `Could not load NFL players: ${error.message}`
      );
    }


    const page =
      (
        data ??
        []
      ) as NflPlayerRow[];


    rows.push(
      ...page
    );


    if (
      page.length <
      pageSize
    ) {
      break;
    }


    start +=
      pageSize;
  }


  return rows;
}


export async function getTraditionalPlayersData(
  supabase:
    SupabaseClient,
  leagueId: string,
  season: number,
  myFantasyTeamId:
    number | null
): Promise<TraditionalPlayersData> {
  /*
   * =====================================================
   * NFL PLAYER POOL
   * =====================================================
   */

  const nflPlayers =
    await loadFantasyPlayers(
      supabase
    );


  const playerIds =
    nflPlayers.map(
      (
        player
      ) =>
        player.id
    );


  /*
   * =====================================================
   * ACTIVE WEEK
   * =====================================================
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
        "active_week"
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


  if (
    seasonStateError
  ) {
    throw new Error(
      `Could not load active week: ${seasonStateError.message}`
    );
  }


  const seasonState =
    seasonStateData as
      SeasonStateRow |
      null;


  const activeWeek =
    Math.max(
      1,
      Math.min(
        18,
        Number(
          seasonState
            ?.active_week ??
          1
        )
      )
    );


  /*
   * =====================================================
   * WAIVER SETTINGS
   * =====================================================
   */

  const {
    data:
      waiverSettingsData,

    error:
      waiverSettingsError,
  } =
    await supabase
      .from(
        "traditional_waiver_settings"
      )
      .select(
        "waiver_type"
      )
      .eq(
        "league_id",
        leagueId
      )
      .maybeSingle();


  if (
    waiverSettingsError
  ) {
    throw new Error(
      `Could not load waiver settings: ${waiverSettingsError.message}`
    );
  }


  const waiverSettings =
    waiverSettingsData as
      WaiverSettingsRow |
      null;


  /*
   * =====================================================
   * FANTASY TEAMS
   * =====================================================
   */

  const {
    data:
      fantasyTeamData,

    error:
      fantasyTeamError,
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
      .eq(
        "league_id",
        leagueId
      )
      .eq(
        "active",
        true
      );


  if (
    fantasyTeamError
  ) {
    throw new Error(
      `Could not load fantasy teams: ${fantasyTeamError.message}`
    );
  }


  const fantasyTeams =
    (
      fantasyTeamData ??
      []
    ) as FantasyTeamRow[];


  const fantasyTeamNames =
    new Map<
      number,
      string
    >();


  for (
    const team
    of fantasyTeams
  ) {
    fantasyTeamNames.set(
      team.id,
      team.team_name
    );
  }


  /*
   * =====================================================
   * ROSTER OWNERSHIP
   * =====================================================
   */

  const {
    data:
      rosterData,

    error:
      rosterError,
  } =
    await supabase
      .from(
        "team_rosters"
      )
      .select(
        `
          fantasy_team_id,
          player_id
        `
      )
      .eq(
        "league_id",
        leagueId
      );


  if (
    rosterError
  ) {
    throw new Error(
      `Could not load league rosters: ${rosterError.message}`
    );
  }


  const rosterRows =
    (
      rosterData ??
      []
    ) as TeamRosterRow[];


  const rosterByPlayer =
    new Map<
      number,
      number
    >();


  for (
    const roster
    of rosterRows
  ) {
    rosterByPlayer.set(
      roster.player_id,
      roster.fantasy_team_id
    );
  }


  /*
   * =====================================================
   * PLAYER WAIVER STATUS
   * =====================================================
   */

  const {
    data:
      playerWaiverData,

    error:
      playerWaiverError,
  } =
    await supabase
      .from(
        "traditional_player_waiver_status"
      )
      .select(
        `
          player_id,
          waiver_until
        `
      )
      .eq(
        "league_id",
        leagueId
      )
      .gt(
        "waiver_until",
        new Date().toISOString()
      );


  if (
    playerWaiverError
  ) {
    throw new Error(
      `Could not load player waiver status: ${playerWaiverError.message}`
    );
  }


  const playerWaiverRows =
    (
      playerWaiverData ??
      []
    ) as PlayerWaiverStatusRow[];


  const waiverByPlayer =
    new Map<
      number,
      PlayerWaiverStatusRow
    >();


  for (
    const waiver
    of playerWaiverRows
  ) {
    waiverByPlayer.set(
      waiver.player_id,
      waiver
    );
  }


  /*
   * =====================================================
   * CURRENT INJURY DATA
   * =====================================================
   */

  const injuryByPlayer =
    new Map<
      number,
      InjuryRow
    >();


  const injuryChunkSize =
    250;


  for (
    let index = 0;
    index <
    playerIds.length;
    index +=
    injuryChunkSize
  ) {
    const chunk =
      playerIds.slice(
        index,
        index +
          injuryChunkSize
      );


    if (
      chunk.length ===
      0
    ) {
      continue;
    }


    const {
      data:
        injuryData,

      error:
        injuryError,
    } =
      await supabase
        .from(
          "current_nfl_player_injuries"
        )
        .select(`
          nfl_player_id,
          status,
          injury_detail
        `)
        .eq(
          "season",
          season
        )
        .in(
          "nfl_player_id",
          chunk
        );


    if (
      injuryError
    ) {
      throw new Error(
        `Could not load player injuries: ${injuryError.message}`
      );
    }


    for (
      const injury
      of (
        injuryData ??
        []
      ) as InjuryRow[]
    ) {
      injuryByPlayer.set(
        injury.nfl_player_id,
        injury
      );
    }
  }


  /*
   * =====================================================
   * DEFAULT RANKINGS
   * =====================================================
   */

  const {
    data:
      defaultRankingData,

    error:
      defaultRankingError,
  } =
    await supabase
      .from(
        "traditional_default_draft_rankings"
      )
      .select(
        `
          player_id,
          rank
        `
      )
      .eq(
        "season",
        season
      );


  if (
    defaultRankingError
  ) {
    throw new Error(
      `Could not load default player rankings: ${defaultRankingError.message}`
    );
  }


  const defaultRankByPlayer =
    new Map<
      number,
      number
    >();


  for (
    const row
    of (
      defaultRankingData ??
      []
    ) as DefaultRankingRow[]
  ) {
    defaultRankByPlayer.set(
      row.player_id,
      row.rank
    );
  }


  /*
   * =====================================================
   * LEAGUE SEASON FANTASY POINTS
   * =====================================================
   *
   * fantasy_player_game_scores is already calculated
   * using this league's scoring settings. Sum only
   * regular-season rows (season_type = 2).
   */

  const seasonFantasyPointsByPlayer =
    new Map<
      number,
      number
    >();


  const scorePageSize =
    1000;


  let scoreStart =
    0;


  while (
    true
  ) {
    const {
      data:
        fantasyScoreData,

      error:
        fantasyScoreError,
    } =
      await supabase
        .from(
          "fantasy_player_game_scores"
        )
        .select(
          `
            nfl_player_id,
            fantasy_points
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
          "season_type",
          2
        )
        .range(
          scoreStart,
          scoreStart +
            scorePageSize -
            1
        );


    if (
      fantasyScoreError
    ) {
      throw new Error(
        `Could not load season fantasy points: ${fantasyScoreError.message}`
      );
    }


    const scorePage =
      (
        fantasyScoreData ??
        []
      ) as FantasyScoreRow[];


    for (
      const score
      of scorePage
    ) {
      const points =
        Number(
          score.fantasy_points ??
          0
        );


      seasonFantasyPointsByPlayer.set(
        score.nfl_player_id,
        (
          seasonFantasyPointsByPlayer.get(
            score.nfl_player_id
          ) ??
          0
        ) +
        (
          Number.isFinite(
            points
          )
            ? points
            : 0
        )
      );
    }


    if (
      scorePage.length <
      scorePageSize
    ) {
      break;
    }


    scoreStart +=
      scorePageSize;
  }



  /*
   * =====================================================
   * LEAGUE-SPECIFIC WEEKLY PROJECTIONS
   * =====================================================
   *
   * This is the authoritative ranking source for the
   * Players page. projected_points has already been
   * calculated for this league's commissioner scoring.
   */

  const weeklyProjectionByPlayer =
    new Map<
      number,
      WeeklyProjectionRow
    >();


  const projectionPageSize =
    1000;


  let projectionStart =
    0;


  while (true) {
    const {
      data:
        projectionData,

      error:
        projectionError,
    } =
      await supabase
        .from(
          "traditional_weekly_player_projections"
        )
        .select(
          `
            player_id,
            opponent_abbreviation,
            home_or_away,
            kickoff_at,
            is_bye,
            projected_points
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
          "season_type",
          2
        )
        .eq(
          "week",
          activeWeek
        )
        .range(
          projectionStart,
          projectionStart +
            projectionPageSize -
            1
        );


    if (projectionError) {
      throw new Error(
        `Could not load Week ${activeWeek} projections: ${projectionError.message}`
      );
    }


    const projectionPage =
      (
        projectionData ??
        []
      ) as WeeklyProjectionRow[];


    for (
      const projection
      of projectionPage
    ) {
      weeklyProjectionByPlayer.set(
        projection.player_id,
        projection
      );
    }


    if (
      projectionPage.length <
      projectionPageSize
    ) {
      break;
    }


    projectionStart +=
      projectionPageSize;
  }


  /*
   * =====================================================
   * NORMALIZE PLAYER BROWSER DATA
   * =====================================================
   */

  const players:
    TraditionalPlayerBrowserRow[] =
      nflPlayers.map(
        (
          player
        ) => {
          const fantasyTeamId =
            rosterByPlayer.get(
              player.id
            ) ??
            null;


          const injury =
            injuryByPlayer.get(
              player.id
            );


          const waiver =
            waiverByPlayer.get(
              player.id
            );


          const weeklyProjection =
            weeklyProjectionByPlayer.get(
              player.id
            );


          const normalizedPosition =
            player
              .primary_position ===
            "PK"
              ? "K"
              : player
                  .primary_position;


          return {
            playerId:
              player.id,

            fullName:
              player.full_name,

            position:
              normalizedPosition,

            teamAbbreviation:
              player
                .team_abbreviation,

            headshotUrl:
              player
                .headshot_url,

            nflStatus:
              player.status,

            isActive:
              player
                .is_active ??
              false,

            injuryStatus:
              injury?.status ?? null,

            injuryDetail:
              injury
                ?.injury_detail ??
              null,

            isRostered:
              fantasyTeamId !==
              null,

            fantasyTeamId,

            fantasyTeamName:
              fantasyTeamId !==
              null
                ? fantasyTeamNames.get(
                    fantasyTeamId
                  ) ??
                  "Rostered"
                : null,

            isMyPlayer:
              fantasyTeamId !==
                null &&
              myFantasyTeamId !==
                null &&
              fantasyTeamId ===
                myFantasyTeamId,

            isOnWaivers:
              waiver !==
              undefined,

            waiverUntil:
              waiver
                ?.waiver_until ??
              null,

            defaultRank:
              defaultRankByPlayer.get(
                player.id
              ) ??
              null,

            seasonFantasyPoints:
              seasonFantasyPointsByPlayer.get(
                player.id
              ) ??
              0,

            weeklyProjectedPoints:
              weeklyProjection
                ?.projected_points !==
                  null &&
              weeklyProjection
                ?.projected_points !==
                  undefined
                ? Number(
                    weeklyProjection
                      .projected_points
                  )
                : null,

            weeklyRank:
              null,

            opponentAbbreviation:
              weeklyProjection
                ?.opponent_abbreviation ??
              null,

            homeOrAway:
              weeklyProjection
                ?.home_or_away ??
              null,

            kickoffAt:
              weeklyProjection
                ?.kickoff_at ??
              null,

            isBye:
              weeklyProjection
                ?.is_bye ??
              false,
          };
        }
      );


  /*
   * =====================================================
   * AVAILABLE PLAYER POOL ONLY
   * =====================================================
   *
   * Once a player belongs to any fantasy roster in this
   * league, the player must not appear on the Players tab.
   */

  const availablePlayers =
    players.filter(
      (
        player
      ) =>
        !player.isRostered
    );


  /*
   * Rank the Players page by the selected/active week's
   * league-specific projected fantasy points. Players
   * without a projection sort after projected players.
   */

  availablePlayers.sort(
    (a, b) => {
      const aProjection =
        a.weeklyProjectedPoints;

      const bProjection =
        b.weeklyProjectedPoints;


      if (
        aProjection !== null ||
        bProjection !== null
      ) {
        if (aProjection === null) {
          return 1;
        }

        if (bProjection === null) {
          return -1;
        }

        if (
          bProjection !==
          aProjection
        ) {
          return (
            bProjection -
            aProjection
          );
        }
      }


      const aRank =
        a.defaultRank ??
        Number.MAX_SAFE_INTEGER;

      const bRank =
        b.defaultRank ??
        Number.MAX_SAFE_INTEGER;


      if (aRank !== bRank) {
        return aRank - bRank;
      }


      return a.fullName.localeCompare(
        b.fullName
      );
    }
  );


  for (
    let index = 0;
    index < availablePlayers.length;
    index += 1
  ) {
    availablePlayers[index].weeklyRank =
      index + 1;
  }


  /*
   * Build NFL team filter list.
   */

  const teamSet =
    new Set<string>();


  for (
    const player
    of availablePlayers
  ) {
    if (
      player.teamAbbreviation
    ) {
      teamSet.add(
        player.teamAbbreviation
      );
    }
  }


  return {
    players:
      availablePlayers,

    totalPlayers:
      availablePlayers.length,

    freeAgents:
      availablePlayers.filter(
        (
          player
        ) =>
          !player.isRostered &&
          !player.isOnWaivers
      ).length,

    rosteredPlayers:
      0,

    injuredPlayers:
      availablePlayers.filter(
        (
          player
        ) =>
          Boolean(
            player.injuryStatus
          )
      ).length,

    waiverPlayers:
      availablePlayers.filter(
        (
          player
        ) =>
          player.isOnWaivers &&
          !player.isRostered
      ).length,

    teams:
      Array.from(
        teamSet
      ).sort(),

    activeWeek,

    waiverType:
      waiverSettings
        ?.waiver_type ??
      "rolling",
  };
}