import type {
  SupabaseClient,
} from "@supabase/supabase-js";


export type TraditionalMatchupPlayer = {
  playerId: number;

  fullName: string;

  position: string;

  teamAbbreviation:
    string | null;

  headshotUrl:
    string | null;

  lineupSlot: string;

  slotIndex: number;

  fantasyPoints: number;

  projectedPoints: number;

  isLive: boolean;

  isFinal: boolean;

  isLocked: boolean;

  status:
    | "scheduled"
    | "live"
    | "final";
};


export type TraditionalMatchupTeam = {
  fantasyTeamId: number;

  teamName: string;

  points: number;

  projectedPoints: number;

  isWinner: boolean;

  isMyTeam: boolean;

  starters:
    TraditionalMatchupPlayer[];
};


export type TraditionalMatchupRow = {
  matchupId: number;

  week: number;

  home:
    TraditionalMatchupTeam;

  away:
    TraditionalMatchupTeam;

  isLive: boolean;

  isFinal: boolean;

  tied: boolean;

  status:
    | "scheduled"
    | "live"
    | "final";

  isMyMatchup: boolean;
};


export type TraditionalMatchupsData = {
  activeWeek: number;

  selectedWeek: number;

  regularSeasonWeeks: number;

  matchups:
    TraditionalMatchupRow[];

  myMatchup:
    TraditionalMatchupRow |
    null;
};


type MatchupDbRow = {
  id: number;

  week: number;

  home_fantasy_team_id: number;

  away_fantasy_team_id: number;

  home_points:
    number |
    string |
    null;

  away_points:
    number |
    string |
    null;

  is_live:
    boolean |
    null;

  is_final:
    boolean |
    null;

  winner_fantasy_team_id:
    number |
    null;

  tied:
    boolean |
    null;
};


type FantasyTeamRow = {
  id: number;

  team_name: string;
};


type SeasonStateRow = {
  active_week:
    number | null;
};


type LeagueSettingsRow = {
  regular_season_weeks:
    number | null;
};


type WeeklyLineupRow = {
  fantasy_team_id: number;

  player_id: number;

  lineup_slot: string;

  slot_index: number;

  is_locked: boolean;
};


type PlayerRow = {
  id: number;

  full_name: string;

  primary_position: string;

  team_abbreviation:
    string | null;

  headshot_url:
    string | null;
};


type PlayerScoreRow = {
  nfl_player_id: number;

  fantasy_points:
    number |
    string |
    null;

  is_live:
    boolean |
    null;

  is_final:
    boolean |
    null;
};

type WeeklyProjectionRow = {
  player_id: number;

  projected_points:
    number |
    string |
    null;
};



function numericValue(
  value:
    number |
    string |
    null
) {
  if (
    value ===
    null
  ) {
    return 0;
  }


  const parsed =
    Number(
      value
    );


  return Number.isFinite(
    parsed
  )
    ? parsed
    : 0;
}


function normalizePosition(
  position: string
) {
  if (
    position.toUpperCase() ===
    "PK"
  ) {
    return "K";
  }


  return position.toUpperCase();
}


function getStatus(
  isLive: boolean,
  isFinal: boolean
):
  | "scheduled"
  | "live"
  | "final" {
  if (
    isFinal
  ) {
    return "final";
  }


  if (
    isLive
  ) {
    return "live";
  }


  return "scheduled";
}


function isStarterSlot(
  lineupSlot: string
) {
  return ![
    "BENCH",
    "BN",
    "IR",
  ].includes(
    lineupSlot.toUpperCase()
  );
}


function slotSortOrder(
  slot: string
) {
  const order:
    Record<
      string,
      number
    > = {
      QB: 1,
      RB: 2,
      WR: 3,
      TE: 4,
      FLEX: 5,
      SUPERFLEX: 6,
      K: 7,
      DST: 8,
    };


  return (
    order[
      slot.toUpperCase()
    ] ??
    99
  );
}


export async function getTraditionalMatchupsData(
  supabase:
    SupabaseClient,
  leagueId: string,
  season: number,
  selectedWeekInput:
    number | null,
  myFantasyTeamId:
    number | null
): Promise<TraditionalMatchupsData> {
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
    seasonState
      ?.active_week ??
    1;


  /*
   * =====================================================
   * REGULAR SEASON LENGTH
   * =====================================================
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
        "regular_season_weeks"
      )
      .eq(
        "league_id",
        leagueId
      )
      .maybeSingle();


  if (
    settingsError
  ) {
    throw new Error(
      `Could not load league settings: ${settingsError.message}`
    );
  }


  const settings =
    settingsData as
      LeagueSettingsRow |
      null;


  const regularSeasonWeeks =
    settings
      ?.regular_season_weeks ??
    14;


  /*
   * =====================================================
   * SELECTED WEEK
   * =====================================================
   */

  const requestedWeek =
    selectedWeekInput ??
    activeWeek;


  const selectedWeek =
    Math.min(
      regularSeasonWeeks,
      Math.max(
        1,
        requestedWeek
      )
    );


  /*
   * =====================================================
   * REFRESH MATCHUP TOTALS
   * =====================================================
   */

  const {
    error:
      refreshError,
  } =
    await supabase.rpc(
      "refresh_traditional_week_matchups",
      {
        p_league_id:
          leagueId,

        p_season:
          season,

        p_week:
          selectedWeek,
      }
    );


  if (
    refreshError
  ) {
    throw new Error(
      `Could not refresh matchup scores: ${refreshError.message}`
    );
  }


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
        "id, team_name"
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


  const teamNames =
    new Map<
      number,
      string
    >();


  for (
    const team
    of fantasyTeams
  ) {
    teamNames.set(
      team.id,
      team.team_name
    );
  }


  /*
   * =====================================================
   * MATCHUPS
   * =====================================================
   */

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
      .select(`
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
      `)
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
        selectedWeek
      )
      .order(
        "id",
        {
          ascending:
            true,
        }
      );


  if (
    matchupError
  ) {
    throw new Error(
      `Could not load Traditional matchups: ${matchupError.message}`
    );
  }


  const matchupRows =
    (
      matchupData ??
      []
    ) as MatchupDbRow[];


  /*
   * =====================================================
   * WEEKLY STARTING LINEUPS
   * =====================================================
   */

  const {
    data:
      lineupData,

    error:
      lineupError,
  } =
    await supabase
      .from(
        "weekly_lineups"
      )
      .select(`
        fantasy_team_id,
        player_id,
        lineup_slot,
        slot_index,
        is_locked
      `)
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
        selectedWeek
      );


  if (
    lineupError
  ) {
    throw new Error(
      `Could not load weekly lineups: ${lineupError.message}`
    );
  }


  const lineupRows =
    (
      lineupData ??
      []
    ) as WeeklyLineupRow[];


  const starterRows =
    lineupRows.filter(
      (
        row
      ) =>
        isStarterSlot(
          row.lineup_slot
        )
    );


  /*
   * =====================================================
   * PLAYER INFORMATION
   * =====================================================
   */

  const playerIds =
    Array.from(
      new Set(
        starterRows.map(
          (
            row
          ) =>
            row.player_id
        )
      )
    );


  const playerMap =
    new Map<
      number,
      PlayerRow
    >();


  if (
    playerIds.length >
    0
  ) {
    const {
      data:
        playerData,

      error:
        playerError,
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
          headshot_url
        `)
        .in(
          "id",
          playerIds
        );


    if (
      playerError
    ) {
      throw new Error(
        `Could not load matchup players: ${playerError.message}`
      );
    }


    for (
      const player
      of (
        playerData ??
        []
      ) as PlayerRow[]
    ) {
      playerMap.set(
        player.id,
        player
      );
    }
  }


  /*
   * =====================================================
   * WEEKLY PROJECTIONS
   * =====================================================
   */

  const projectionMap =
    new Map<
      number,
      number
    >();


  if (
    playerIds.length >
    0
  ) {
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
        .select(`
          player_id,
          projected_points
        `)
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
          selectedWeek
        )
        .in(
          "player_id",
          playerIds
        );


    if (
      projectionError
    ) {
      throw new Error(
        `Could not load weekly projections: ${projectionError.message}`
      );
    }


    for (
      const row
      of (
        projectionData ??
        []
      ) as WeeklyProjectionRow[]
    ) {
      projectionMap.set(
        Number(
          row.player_id
        ),
        numericValue(
          row.projected_points
        )
      );
    }
  }


  /*
   * =====================================================
   * PLAYER FANTASY SCORES
   * =====================================================
   */

  const scoreMap =
    new Map<
      number,
      PlayerScoreRow
    >();


  if (
    playerIds.length >
    0
  ) {
    const {
      data:
        scoreData,

      error:
        scoreError,
    } =
      await supabase
        .from(
          "fantasy_player_game_scores"
        )
        .select(`
          nfl_player_id,
          fantasy_points,
          is_live,
          is_final
        `)
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
          selectedWeek
        )
        .in(
          "nfl_player_id",
          playerIds
        );


    if (
      scoreError
    ) {
      throw new Error(
        `Could not load player fantasy scores: ${scoreError.message}`
      );
    }


    for (
      const score
      of (
        scoreData ??
        []
      ) as PlayerScoreRow[]
    ) {
      scoreMap.set(
        score.nfl_player_id,
        score
      );
    }
  }


  /*
   * =====================================================
   * BUILD STARTERS BY FANTASY TEAM
   * =====================================================
   */

  const startersByTeam =
    new Map<
      number,
      TraditionalMatchupPlayer[]
    >();


  for (
    const lineup
    of starterRows
  ) {
    const player =
      playerMap.get(
        lineup.player_id
      );


    const score =
      scoreMap.get(
        lineup.player_id
      );


    const isLive =
      score
        ?.is_live ??
      false;


    const isFinal =
      score
        ?.is_final ??
      false;


    const starter:
      TraditionalMatchupPlayer = {
        playerId:
          lineup.player_id,

        fullName:
          player
            ?.full_name ??
          "Unknown Player",

        position:
          normalizePosition(
            player
              ?.primary_position ??
            "—"
          ),

        teamAbbreviation:
          player
            ?.team_abbreviation ??
          null,

        headshotUrl:
          player
            ?.headshot_url ??
          null,

        lineupSlot:
          lineup.lineup_slot,

        slotIndex:
          lineup.slot_index,

        fantasyPoints:
          numericValue(
            score
              ?.fantasy_points ??
            null
          ),

        projectedPoints:
          projectionMap.get(
            lineup.player_id
          ) ??
          0,

        isLive,

        isFinal,

        isLocked:
          lineup.is_locked,

        status:
          getStatus(
            isLive,
            isFinal
          ),
      };


    const existing =
      startersByTeam.get(
        lineup.fantasy_team_id
      ) ??
      [];


    existing.push(
      starter
    );


    startersByTeam.set(
      lineup.fantasy_team_id,
      existing
    );
  }


  /*
   * Sort each lineup in normal fantasy order.
   */

  for (
    const [
      teamId,
      starters,
    ]
    of startersByTeam
  ) {
    starters.sort(
      (
        a,
        b
      ) => {
        const slotDifference =
          slotSortOrder(
            a.lineupSlot
          ) -
          slotSortOrder(
            b.lineupSlot
          );


        if (
          slotDifference !==
          0
        ) {
          return slotDifference;
        }


        return (
          a.slotIndex -
          b.slotIndex
        );
      }
    );


    startersByTeam.set(
      teamId,
      starters
    );
  }


  /*
   * =====================================================
   * NORMALIZE MATCHUPS
   * =====================================================
   */

  const matchups:
    TraditionalMatchupRow[] =
      matchupRows.map(
        (
          matchup
        ) => {
          const isLive =
            matchup
              .is_live ??
            false;


          const isFinal =
            matchup
              .is_final ??
            false;


          const tied =
            matchup
              .tied ??
            false;


          const homeIsWinner =
            isFinal &&
            !tied &&
            matchup
              .winner_fantasy_team_id ===
              matchup
                .home_fantasy_team_id;


          const awayIsWinner =
            isFinal &&
            !tied &&
            matchup
              .winner_fantasy_team_id ===
              matchup
                .away_fantasy_team_id;


          const isMyMatchup =
            myFantasyTeamId !==
              null &&
            (
              matchup
                .home_fantasy_team_id ===
                myFantasyTeamId ||
              matchup
                .away_fantasy_team_id ===
                myFantasyTeamId
            );


          return {
            matchupId:
              matchup.id,

            week:
              matchup.week,

            home: {
              fantasyTeamId:
                matchup
                  .home_fantasy_team_id,

              teamName:
                teamNames.get(
                  matchup
                    .home_fantasy_team_id
                ) ??
                "Home Team",

              points:
                numericValue(
                  matchup
                    .home_points
                ),

              projectedPoints:
                (
                  startersByTeam.get(
                    matchup
                      .home_fantasy_team_id
                  ) ??
                  []
                ).reduce(
                  (
                    total,
                    player
                  ) =>
                    total +
                    player.projectedPoints,
                  0
                ),

              isWinner:
                homeIsWinner,

              isMyTeam:
                myFantasyTeamId !==
                  null &&
                matchup
                  .home_fantasy_team_id ===
                  myFantasyTeamId,

              starters:
                startersByTeam.get(
                  matchup
                    .home_fantasy_team_id
                ) ??
                [],
            },

            away: {
              fantasyTeamId:
                matchup
                  .away_fantasy_team_id,

              teamName:
                teamNames.get(
                  matchup
                    .away_fantasy_team_id
                ) ??
                "Away Team",

              points:
                numericValue(
                  matchup
                    .away_points
                ),

              projectedPoints:
                (
                  startersByTeam.get(
                    matchup
                      .away_fantasy_team_id
                  ) ??
                  []
                ).reduce(
                  (
                    total,
                    player
                  ) =>
                    total +
                    player.projectedPoints,
                  0
                ),

              isWinner:
                awayIsWinner,

              isMyTeam:
                myFantasyTeamId !==
                  null &&
                matchup
                  .away_fantasy_team_id ===
                  myFantasyTeamId,

              starters:
                startersByTeam.get(
                  matchup
                    .away_fantasy_team_id
                ) ??
                [],
            },

            isLive,

            isFinal,

            tied,

            status:
              getStatus(
                isLive,
                isFinal
              ),

            isMyMatchup,
          };
        }
      );


  const myMatchup =
    matchups.find(
      (
        matchup
      ) =>
        matchup.isMyMatchup
    ) ??
    null;


  return {
    activeWeek,

    selectedWeek,

    regularSeasonWeeks,

    matchups,

    myMatchup,
  };
}