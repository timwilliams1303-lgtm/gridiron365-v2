import type {
  SupabaseClient,
} from "@supabase/supabase-js";


export type MatchupDetailGameContext = {
  nflGameId: number;

  espnEventId:
    string |
    null;

  statusName:
    string |
    null;

  statusDetail:
    string |
    null;

  statusCompleted: boolean;

  homeScore: number;

  awayScore: number;

  hasLiveContext: boolean;

  isActuallyLive: boolean;

  possessionTeam: {
    id:
      number |
      null;

    espnTeamId:
      string |
      null;

    abbreviation:
      string |
      null;

    displayName:
      string |
      null;

    shortDisplayName:
      string |
      null;

    logoUrl:
      string |
      null;
  } | null;

  period:
    number |
    null;

  clock:
    string |
    null;

  down:
    number |
    null;

  distance:
    number |
    null;

  downLabel:
    string |
    null;

  yardLine:
    number |
    null;

  yardsToEndzone:
    number |
    null;

  redZone: boolean;

  latestPlay: {
    espnPlayId:
      string |
      null;

    sequenceNumber:
      number |
      null;

    scoringPlay: boolean;

    scoreValue:
      number |
      null;

    statYardage:
      number |
      null;

    text:
      string |
      null;

    shortText:
      string |
      null;
  } | null;
};


export type MatchupDetailPlayer = {
  playerId: number;

  espnPlayerId:
    string |
    null;

  fullName: string;

  position: string;

  teamAbbreviation:
    string |
    null;

  headshotUrl:
    string |
    null;

  lineupSlot: string;

  slotIndex: number;

  isStarter: boolean;

  isLocked: boolean;

  fantasyPoints: number;

  basePoints: number;

  customRulePoints: number;

  scoreIsLive: boolean;

  scoreIsFinal: boolean;

  gameStatus:
    string |
    null;

  nflGameId:
    number |
    null;

  nflOpponent:
    string |
    null;

  opponentPrefix:
    "vs" |
    "@" |
    null;

  kickoffAt:
    string |
    null;

  projectedPoints: number;

  projectionSource:
    "weekly" |
    "season_average" |
    "none";

  injuryStatus:
    string |
    null;

  injuryType:
    string |
    null;

  injuryDetail:
    string |
    null;

  hasPossession: boolean;

  isRedZone: boolean;

  involvedInLatestPlay: boolean;

  gameContext:
    MatchupDetailGameContext |
    null;

  stats: {
    passingAttempts: number;

    passingCompletions: number;

    passingYards: number;

    passingTouchdowns: number;

    passingInterceptions: number;

    rushingAttempts: number;

    rushingYards: number;

    rushingTouchdowns: number;

    receivingTargets: number;

    receptions: number;

    receivingYards: number;

    receivingTouchdowns: number;

    fumblesLost: number;

    fieldGoalsMade: number;

    fieldGoalsAttempted: number;

    extraPointsMade: number;

    extraPointsAttempted: number;

    dstSacks: number;

    dstInterceptions: number;

    dstFumbleRecoveries: number;

    dstTouchdowns: number;

    dstSafeties: number;

    dstBlockedKicks: number;

    dstPointsAllowed: number;

    dstYardsAllowed: number;
  };
};


export type MatchupDetailTeam = {
  fantasyTeamId: number;

  teamName: string;

  points: number;

  projectedPoints: number;

  expectedFinalPoints: number;

  isMyTeam: boolean;

  isWinner: boolean;

  starters:
    MatchupDetailPlayer[];

  bench:
    MatchupDetailPlayer[];

  playersLive: number;

  playersFinal: number;

  playersRemaining: number;
};


export type TraditionalMatchupDetailData = {
  matchupId: number;

  leagueId: string;

  season: number;

  week: number;

  status:
    | "scheduled"
    | "live"
    | "final";

  isLive: boolean;

  isFinal: boolean;

  tied: boolean;

  home:
    MatchupDetailTeam;

  away:
    MatchupDetailTeam;

  liveGames:
    MatchupDetailGameContext[];

  redZoneGames:
    MatchupDetailGameContext[];

  recentScoringPlays: Array<{
    nflGameId: number;

    espnPlayId: string;

    period:
      number |
      null;

    clock:
      string |
      null;

    possessionTeamAbbreviation:
      string |
      null;

    scoreValue:
      number |
      null;

    text:
      string |
      null;

    participantEspnPlayerIds:
      string[];
  }>;
};


type MatchupRow = {
  id: number;

  league_id: string;

  season: number;

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

  is_live: boolean;

  is_final: boolean;

  winner_fantasy_team_id:
    number |
    null;

  tied: boolean;
};


type FantasyTeamRow = {
  id: number;

  team_name: string;
};


type LineupRow = {
  fantasy_team_id: number;

  player_id: number;

  lineup_slot: string;

  slot_index: number;

  is_locked: boolean;
};


type PlayerRow = {
  id: number;

  espn_player_id:
    string |
    null;

  full_name: string;

  primary_position: string;

  team_abbreviation:
    string |
    null;

  headshot_url:
    string |
    null;
};


type ScoreRow = {
  nfl_game_id: number;

  nfl_player_id: number;

  base_points:
    number |
    string |
    null;

  custom_rule_points:
    number |
    string |
    null;

  fantasy_points:
    number |
    string |
    null;

  is_live: boolean;

  is_final: boolean;
};


type StatsRow = {
  nfl_game_id: number;

  nfl_player_id: number;

  game_status:
    string |
    null;

  passing_attempts:
    number |
    null;

  passing_completions:
    number |
    null;

  passing_yards:
    number |
    null;

  passing_touchdowns:
    number |
    null;

  passing_interceptions:
    number |
    null;

  rushing_attempts:
    number |
    null;

  rushing_yards:
    number |
    null;

  rushing_touchdowns:
    number |
    null;

  receiving_targets:
    number |
    null;

  receptions:
    number |
    null;

  receiving_yards:
    number |
    null;

  receiving_touchdowns:
    number |
    null;

  fumbles_lost:
    number |
    null;

  field_goals_made:
    number |
    null;

  field_goals_attempted:
    number |
    null;

  extra_points_made:
    number |
    null;

  extra_points_attempted:
    number |
    null;

  dst_sacks:
    number |
    string |
    null;

  dst_interceptions:
    number |
    null;

  dst_fumble_recoveries:
    number |
    null;

  dst_touchdowns:
    number |
    null;

  dst_safeties:
    number |
    null;

  dst_blocked_kicks:
    number |
    null;

  dst_points_allowed:
    number |
    null;

  dst_yards_allowed:
    number |
    null;
};


type NflGameRow = {
  id: number;

  home_team_id: number;

  away_team_id: number;

  status_name:
    string |
    null;

  status_completed: boolean;

  kickoff_at:
    string |
    null;
};


type NflTeamRow = {
  id: number;

  abbreviation: string;

  espn_team_id:
    string |
    null;
};


type InjuryRow = {
  nfl_player_id: number;

  status:
    string |
    null;

  injury_type:
    string |
    null;

  injury_detail:
    string |
    null;
};


type ScoringPlayRow = {
  nfl_game_id: number;

  espn_play_id: string;

  period:
    number |
    null;

  clock_display:
    string |
    null;

  possession_team_espn_id:
    string |
    null;

  score_value:
    number |
    null;

  play_text:
    string |
    null;

  participant_espn_player_ids:
    string[] |
    null;
};


function numberValue(
  value:
    number |
    string |
    null |
    undefined
) {
  const parsed =
    Number(
      value ??
      0
    );


  return Number.isFinite(
    parsed
  )
    ? parsed
    : 0;
}


function normalizePosition(
  value: string
) {
  const upper =
    value.toUpperCase();


  return upper ===
    "PK"
    ? "K"
    : upper;
}


function isStarterSlot(
  value: string
) {
  return ![
    "BENCH",
    "BN",
    "IR",
  ].includes(
    value.toUpperCase()
  );
}


function slotSort(
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
      BENCH: 20,
      BN: 20,
      IR: 30,
    };


  return (
    order[
      slot.toUpperCase()
    ] ??
    99
  );
}


function isLiveGameStatus(
  statusName:
    string |
    null
) {
  const value =
    (
      statusName ??
      ""
    ).toUpperCase();


  return (
    value.includes(
      "IN_PROGRESS"
    ) ||
    value.includes(
      "HALFTIME"
    ) ||
    value.includes(
      "END_PERIOD"
    )
  );
}


/*
 * =========================================================
 * TEMPORARY LIVE MATCHUP UI TEST
 * =========================================================
 *
 * REMOVE after preseason live-matchup testing is complete.
 *
 * This does NOT change the matchup's official scoring.
 * It only allows Joe Milton III to use stored preseason
 * game/stats/context data so the Matchup Detail UI can be
 * validated before the regular season begins.
 */

const LIVE_UI_TEST = {
  enabled: true,
  leagueId:
    "984564ec-abcf-41e5-bab2-ac383da512b5",
  fantasyTeamId: 1,
  nflPlayerId: 263,
  nflGameId: 318,
  season: 2026,
  seasonType: 1,
  week: 2,
} as const;


export async function getTraditionalMatchupDetailData(
  supabase:
    SupabaseClient,
  leagueId: string,
  matchupId: number,
  myFantasyTeamId:
    number |
    null
): Promise<TraditionalMatchupDetailData> {
  /*
   * =====================================================
   * MATCHUP
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
        league_id,
        season,
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
        "id",
        matchupId
      )
      .eq(
        "league_id",
        leagueId
      )
      .maybeSingle();


  if (
    matchupError
  ) {
    throw new Error(
      `Could not load matchup: ${matchupError.message}`
    );
  }


  if (
    !matchupData
  ) {
    throw new Error(
      "Traditional matchup was not found."
    );
  }


  const matchup =
    matchupData as
      MatchupRow;


  /*
   * Refresh score before displaying.
   */

  const {
    error:
      refreshError,
  } =
    await supabase.rpc(
      "refresh_traditional_matchup",
      {
        p_matchup_id:
          matchupId,
      }
    );


  if (
    refreshError
  ) {
    throw new Error(
      `Could not refresh matchup: ${refreshError.message}`
    );
  }


  /*
   * Reload after refresh.
   */

  const {
    data:
      refreshedData,

    error:
      refreshedError,
  } =
    await supabase
      .from(
        "traditional_matchups"
      )
      .select(`
        id,
        league_id,
        season,
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
        "id",
        matchupId
      )
      .single();


  if (
    refreshedError
  ) {
    throw new Error(
      `Could not reload matchup: ${refreshedError.message}`
    );
  }


  const refreshed =
    refreshedData as
      MatchupRow;


  const fantasyTeamIds = [
    refreshed
      .home_fantasy_team_id,

    refreshed
      .away_fantasy_team_id,
  ];


  /*
   * =====================================================
   * TEAM NAMES
   * =====================================================
   */

  const {
    data:
      teamData,

    error:
      teamError,
  } =
    await supabase
      .from(
        "fantasy_teams"
      )
      .select(
        "id, team_name"
      )
      .in(
        "id",
        fantasyTeamIds
      );


  if (
    teamError
  ) {
    throw new Error(
      `Could not load matchup teams: ${teamError.message}`
    );
  }


  const teamMap =
    new Map<
      number,
      FantasyTeamRow
    >();


  for (
    const team
    of (
      teamData ??
      []
    ) as FantasyTeamRow[]
  ) {
    teamMap.set(
      team.id,
      team
    );
  }


  /*
   * =====================================================
   * LINEUPS
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
        refreshed.season
      )
      .eq(
        "week",
        refreshed.week
      )
      .in(
        "fantasy_team_id",
        fantasyTeamIds
      );


  if (
    lineupError
  ) {
    throw new Error(
      `Could not load matchup lineups: ${lineupError.message}`
    );
  }


  const lineups =
    (
      lineupData ??
      []
    ) as LineupRow[];


  const playerIds =
    Array.from(
      new Set(
        lineups.map(
          (
            row
          ) =>
            row.player_id
        )
      )
    );


  /*
   * =====================================================
   * PLAYERS
   * =====================================================
   */

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
          espn_player_id,
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
   * FANTASY SCORES
   * =====================================================
   */

  const scoreMap =
    new Map<
      number,
      ScoreRow
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
          nfl_game_id,
          nfl_player_id,
          base_points,
          custom_rule_points,
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
          refreshed.season
        )
        .eq(
          "season_type",
          2
        )
        .eq(
          "week",
          refreshed.week
        )
        .in(
          "nfl_player_id",
          playerIds
        );


    if (
      scoreError
    ) {
      throw new Error(
        `Could not load matchup scores: ${scoreError.message}`
      );
    }


    for (
      const score
      of (
        scoreData ??
        []
      ) as ScoreRow[]
    ) {
      scoreMap.set(
        score.nfl_player_id,
        score
      );
    }
  }


  /*
   * =====================================================
   * PLAYER GAME STATS
   * =====================================================
   */

  const statsMap =
    new Map<
      number,
      StatsRow
    >();


  if (
    playerIds.length >
    0
  ) {
    const {
      data:
        statsData,

      error:
        statsError,
    } =
      await supabase
        .from(
          "nfl_player_game_stats"
        )
        .select(`
          nfl_game_id,
          nfl_player_id,
          game_status,
          passing_attempts,
          passing_completions,
          passing_yards,
          passing_touchdowns,
          passing_interceptions,
          rushing_attempts,
          rushing_yards,
          rushing_touchdowns,
          receiving_targets,
          receptions,
          receiving_yards,
          receiving_touchdowns,
          fumbles_lost,
          field_goals_made,
          field_goals_attempted,
          extra_points_made,
          extra_points_attempted,
          dst_sacks,
          dst_interceptions,
          dst_fumble_recoveries,
          dst_touchdowns,
          dst_safeties,
          dst_blocked_kicks,
          dst_points_allowed,
          dst_yards_allowed
        `)
        .eq(
          "season",
          refreshed.season
        )
        .eq(
          "season_type",
          2
        )
        .eq(
          "week",
          refreshed.week
        )
        .in(
          "nfl_player_id",
          playerIds
        );


    if (
      statsError
    ) {
      throw new Error(
        `Could not load player game stats: ${statsError.message}`
      );
    }


    for (
      const stat
      of (
        statsData ??
        []
      ) as StatsRow[]
    ) {
      statsMap.set(
        stat.nfl_player_id,
        stat
      );
    }
  }


  /*
   * =====================================================
   * TEMPORARY PRESEASON LIVE UI TEST STATS
   * =====================================================
   */

  const liveUiTestEnabled =
    LIVE_UI_TEST.enabled &&
    leagueId ===
      LIVE_UI_TEST.leagueId &&
    refreshed.season ===
      2026 &&
    refreshed.week ===
      1 &&
    lineups.some(
      (
        row
      ) =>
        row.fantasy_team_id ===
          LIVE_UI_TEST.fantasyTeamId &&
        row.player_id ===
          LIVE_UI_TEST.nflPlayerId
    );


  if (
    liveUiTestEnabled
  ) {
    const {
      data:
        testStatsData,

      error:
        testStatsError,
    } =
      await supabase
        .from(
          "nfl_player_game_stats"
        )
        .select(`
          nfl_game_id,
          nfl_player_id,
          game_status,
          passing_attempts,
          passing_completions,
          passing_yards,
          passing_touchdowns,
          passing_interceptions,
          rushing_attempts,
          rushing_yards,
          rushing_touchdowns,
          receiving_targets,
          receptions,
          receiving_yards,
          receiving_touchdowns,
          fumbles_lost,
          field_goals_made,
          field_goals_attempted,
          extra_points_made,
          extra_points_attempted,
          dst_sacks,
          dst_interceptions,
          dst_fumble_recoveries,
          dst_touchdowns,
          dst_safeties,
          dst_blocked_kicks,
          dst_points_allowed,
          dst_yards_allowed
        `)
        .eq(
          "nfl_game_id",
          LIVE_UI_TEST.nflGameId
        )
        .eq(
          "nfl_player_id",
          LIVE_UI_TEST.nflPlayerId
        )
        .eq(
          "season",
          LIVE_UI_TEST.season
        )
        .eq(
          "season_type",
          LIVE_UI_TEST.seasonType
        )
        .eq(
          "week",
          LIVE_UI_TEST.week
        )
        .maybeSingle();


    if (
      testStatsError
    ) {
      console.error(
        "Could not load temporary live UI test stats:",
        testStatsError
      );
    }


    if (
      testStatsData
    ) {
      statsMap.set(
        LIVE_UI_TEST.nflPlayerId,
        testStatsData as StatsRow
      );
    }
  }


  /*
   * =====================================================
   * INJURIES
   * =====================================================
   */

  const injuryMap =
    new Map<
      number,
      InjuryRow
    >();


  if (
    playerIds.length >
    0
  ) {
    const {
      data:
        injuryData,
    } =
      await supabase
        .from(
          "current_nfl_player_injuries"
        )
        .select(`
          nfl_player_id,
          status,
          injury_type,
          injury_detail
        `)
        .eq(
          "season",
          refreshed.season
        )
        .in(
          "nfl_player_id",
          playerIds
        );


    for (
      const injury
      of (
        injuryData ??
        []
      ) as InjuryRow[]
    ) {
      injuryMap.set(
        injury.nfl_player_id,
        injury
      );
    }
  }


  /*
   * =====================================================
   * NFL TEAMS
   * =====================================================
   */

  const {
    data:
      nflTeamData,

    error:
      nflTeamError,
  } =
    await supabase
      .from(
        "nfl_teams"
      )
      .select(`
        id,
        abbreviation,
        espn_team_id
      `);


  if (
    nflTeamError
  ) {
    throw new Error(
      `Could not load NFL teams: ${nflTeamError.message}`
    );
  }


  const nflTeams =
    (
      nflTeamData ??
      []
    ) as NflTeamRow[];


  const nflTeamByAbbreviation =
    new Map<
      string,
      NflTeamRow
    >();


  for (
    const team
    of nflTeams
  ) {
    nflTeamByAbbreviation.set(
      team.abbreviation,
      team
    );
  }


  /*
   * =====================================================
   * NFL GAMES
   * =====================================================
   */

  const gameIds =
    Array.from(
      new Set(
        [
          ...Array.from(
            scoreMap.values()
          ).map(
            (
              score
            ) =>
              score.nfl_game_id
          ),

          ...Array.from(
            statsMap.values()
          ).map(
            (
              stat
            ) =>
              stat.nfl_game_id
          ),
        ].filter(
          (
            id
          ) =>
            Number.isInteger(
              id
            )
        )
      )
    );


  /*
   * Keep game 318 available to the temporary UI test even
   * if no production fantasy score row exists for it.
   */

  if (
    liveUiTestEnabled &&
    !gameIds.includes(
      LIVE_UI_TEST.nflGameId
    )
  ) {
    gameIds.push(
      LIVE_UI_TEST.nflGameId
    );
  }


  const gameMap =
    new Map<
      number,
      NflGameRow
    >();


  if (
    gameIds.length >
    0
  ) {
    const {
      data:
        gameData,

      error:
        gameError,
    } =
      await supabase
        .from(
          "nfl_games"
        )
        .select(`
          id,
          home_team_id,
          away_team_id,
          status_name,
          status_completed,
          kickoff_at
        `)
        .in(
          "id",
          gameIds
        );


    if (
      gameError
    ) {
      throw new Error(
        `Could not load NFL games: ${gameError.message}`
      );
    }


    for (
      const game
      of (
        gameData ??
        []
      ) as NflGameRow[]
    ) {
      gameMap.set(
        game.id,
        game
      );
    }
  }


  /*
   * =====================================================
   * GAME CONTEXT
   * =====================================================
   */

  const contextMap =
    new Map<
      number,
      MatchupDetailGameContext
    >();


  for (
    const gameId
    of gameIds
  ) {
    const {
      data:
        contextData,

      error:
        contextError,
    } =
      await supabase.rpc(
        "get_current_nfl_game_context",
        {
          p_nfl_game_id:
            gameId,
        }
      );


    if (
      contextError
    ) {
      continue;
    }


    const raw =
      contextData as
        Omit<
          MatchupDetailGameContext,
          "isActuallyLive"
        >;


    contextMap.set(
      gameId,
      {
        ...raw,

        isActuallyLive:
          !raw.statusCompleted &&
          isLiveGameStatus(
            raw.statusName
          ),
      }
    );
  }


  /*
   * =====================================================
   * RECENT SCORING PLAYS
   * =====================================================
   *
   * IMPORTANT:
   *
   * Only show scoring plays involving a STARTING fantasy
   * player in THIS matchup.
   *
   * We intentionally do not show every scoring play from an
   * NFL game merely because one matchup player is playing in
   * that NFL game.
   *
   * Bench-player scoring plays are also excluded because bench
   * points do not count toward the fantasy matchup.
   */

  let recentScoringPlays:
    TraditionalMatchupDetailData[
      "recentScoringPlays"
    ] =
      [];


  const matchupStarterEspnPlayerIds =
    Array.from(
      new Set(
        lineups
          .filter(
            (
              lineup
            ) =>
              isStarterSlot(
                lineup.lineup_slot
              )
          )
          .map(
            (
              lineup
            ) =>
              playerMap.get(
                lineup.player_id
              )
                ?.espn_player_id ??
              null
          )
          .filter(
            (
              espnPlayerId
            ):
              espnPlayerId is string =>
                Boolean(
                  espnPlayerId
                )
          )
      )
    );


  if (
    gameIds.length >
      0 &&
    matchupStarterEspnPlayerIds.length >
      0
  ) {
    const {
      data:
        scoringData,

      error:
        scoringError,
    } =
      await supabase
        .from(
          "nfl_game_plays"
        )
        .select(`
          nfl_game_id,
          espn_play_id,
          period,
          clock_display,
          possession_team_espn_id,
          score_value,
          play_text,
          participant_espn_player_ids
        `)
        .in(
          "nfl_game_id",
          gameIds
        )
        .eq(
          "scoring_play",
          true
        )
        .overlaps(
          "participant_espn_player_ids",
          matchupStarterEspnPlayerIds
        )
        .order(
          "sequence_number",
          {
            ascending:
              false,
          }
        )
        .limit(
          12
        );


    if (
      !scoringError
    ) {
      recentScoringPlays =
        (
          scoringData ??
          []
        ).map(
          (
            raw
          ) => {
            const play =
              raw as
                ScoringPlayRow;


            const possessionTeam =
              nflTeams.find(
                (
                  team
                ) =>
                  team.espn_team_id ===
                  play
                    .possession_team_espn_id
              );


            return {
              nflGameId:
                play.nfl_game_id,

              espnPlayId:
                play.espn_play_id,

              period:
                play.period,

              clock:
                play
                  .clock_display,

              possessionTeamAbbreviation:
                possessionTeam
                  ?.abbreviation ??
                null,

              scoreValue:
                play
                  .score_value,

              text:
                play
                  .play_text,

              participantEspnPlayerIds:
                play
                  .participant_espn_player_ids ??
                [],
            };
          }
        );
    }
  }


  /*
   * =====================================================
   * BUILD PLAYER
   * =====================================================
   */

  function buildPlayer(
    lineup:
      LineupRow
  ):
    MatchupDetailPlayer {
    const player =
      playerMap.get(
        lineup.player_id
      );


    const score =
      scoreMap.get(
        lineup.player_id
      );


    const stats =
      statsMap.get(
        lineup.player_id
      );


    const injury =
      injuryMap.get(
        lineup.player_id
      );


    const nflGameId =
      score
        ?.nfl_game_id ??
      stats
        ?.nfl_game_id ??
      null;


    const game =
      nflGameId !==
        null
        ? gameMap.get(
            nflGameId
          )
        : undefined;


    const context =
      nflGameId !==
        null
        ? contextMap.get(
            nflGameId
          ) ??
          null
        : null;


    const playerTeam =
      player
        ?.team_abbreviation
        ? nflTeamByAbbreviation.get(
            player
              .team_abbreviation
          )
        : undefined;


    let opponent:
      string |
      null =
        null;


    if (
      game &&
      playerTeam
    ) {
      const opponentTeamId =
        game.home_team_id ===
          playerTeam.id
          ? game.away_team_id
          : game.home_team_id;


      opponent =
        nflTeams.find(
          (
            team
          ) =>
            team.id ===
            opponentTeamId
        )
          ?.abbreviation ??
        null;
    }


    let opponentPrefix:
      "vs" |
      "@" |
      null =
        null;

    if (
      game &&
      playerTeam
    ) {
      opponentPrefix =
        game.home_team_id ===
          playerTeam.id
          ? "vs"
          : "@";
    }

    const kickoffAt =
      game
        ?.kickoff_at ??
      null;

    /*
     * Projection values are intentionally safe fallbacks until
     * the projection source is wired back into this service.
     * This restores the current matchup-page contract without
     * inventing projection data.
     */
    const projectedPoints = 0;

    const projectionSource:
      MatchupDetailPlayer[
        "projectionSource"
      ] =
        "none";

    const hasPossession =
      Boolean(
        context
          ?.isActuallyLive &&
        context
          ?.possessionTeam
          ?.abbreviation &&
        context
          .possessionTeam
          .abbreviation ===
          player
            ?.team_abbreviation
      );


    const isRedZone =
      Boolean(
        hasPossession &&
        context
          ?.redZone
      );


    const involvedInLatestPlay =
      Boolean(
        context
          ?.isActuallyLive &&
        player
          ?.espn_player_id &&
        context
          ?.latestPlay &&
        recentScoringPlays.some(
          (
            play
          ) =>
            play.espnPlayId ===
              context
                .latestPlay
                ?.espnPlayId &&
            play
              .participantEspnPlayerIds
              .includes(
                player
                  .espn_player_id as string
              )
        )
      );


    return {
      playerId:
        lineup.player_id,

      espnPlayerId:
        player
          ?.espn_player_id ??
        null,

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

      isStarter:
        isStarterSlot(
          lineup.lineup_slot
        ),

      isLocked:
        lineup.is_locked,

      fantasyPoints:
        numberValue(
          score
            ?.fantasy_points
        ),

      basePoints:
        numberValue(
          score
            ?.base_points
        ),

      customRulePoints:
        numberValue(
          score
            ?.custom_rule_points
        ),

      scoreIsLive:
        score
          ?.is_live ??
        false,

      scoreIsFinal:
        score
          ?.is_final ??
        false,

      gameStatus:
        stats
          ?.game_status ??
        game
          ?.status_name ??
        null,

      nflGameId,

      nflOpponent:
        opponent,

      opponentPrefix,

      kickoffAt,

      projectedPoints,

      projectionSource,

      injuryStatus:
        injury
          ?.status ??
        null,

      injuryType:
        injury
          ?.injury_type ??
        null,

      injuryDetail:
        injury
          ?.injury_detail ??
        null,

      hasPossession,

      isRedZone,

      involvedInLatestPlay,

      gameContext:
        context,

      stats: {
        passingAttempts:
          stats
            ?.passing_attempts ??
          0,

        passingCompletions:
          stats
            ?.passing_completions ??
          0,

        passingYards:
          stats
            ?.passing_yards ??
          0,

        passingTouchdowns:
          stats
            ?.passing_touchdowns ??
          0,

        passingInterceptions:
          stats
            ?.passing_interceptions ??
          0,

        rushingAttempts:
          stats
            ?.rushing_attempts ??
          0,

        rushingYards:
          stats
            ?.rushing_yards ??
          0,

        rushingTouchdowns:
          stats
            ?.rushing_touchdowns ??
          0,

        receivingTargets:
          stats
            ?.receiving_targets ??
          0,

        receptions:
          stats
            ?.receptions ??
          0,

        receivingYards:
          stats
            ?.receiving_yards ??
          0,

        receivingTouchdowns:
          stats
            ?.receiving_touchdowns ??
          0,

        fumblesLost:
          stats
            ?.fumbles_lost ??
          0,

        fieldGoalsMade:
          stats
            ?.field_goals_made ??
          0,

        fieldGoalsAttempted:
          stats
            ?.field_goals_attempted ??
          0,

        extraPointsMade:
          stats
            ?.extra_points_made ??
          0,

        extraPointsAttempted:
          stats
            ?.extra_points_attempted ??
          0,

        dstSacks:
          numberValue(
            stats
              ?.dst_sacks
          ),

        dstInterceptions:
          stats
            ?.dst_interceptions ??
          0,

        dstFumbleRecoveries:
          stats
            ?.dst_fumble_recoveries ??
          0,

        dstTouchdowns:
          stats
            ?.dst_touchdowns ??
          0,

        dstSafeties:
          stats
            ?.dst_safeties ??
          0,

        dstBlockedKicks:
          stats
            ?.dst_blocked_kicks ??
          0,

        dstPointsAllowed:
          stats
            ?.dst_points_allowed ??
          0,

        dstYardsAllowed:
          stats
            ?.dst_yards_allowed ??
          0,
      },
    };
  }


  function buildTeam(
    fantasyTeamId:
      number,
    points:
      number |
      string |
      null,
    isWinner:
      boolean
  ):
    MatchupDetailTeam {
    const allPlayers =
      lineups
        .filter(
          (
            row
          ) =>
            row.fantasy_team_id ===
              fantasyTeamId
        )
        .map(
          buildPlayer
        )
        .sort(
          (
            a,
            b
          ) =>
            slotSort(
              a.lineupSlot
            ) -
              slotSort(
                b.lineupSlot
              ) ||
            a.slotIndex -
              b.slotIndex
        );


    const starters =
      allPlayers.filter(
        (
          player
        ) =>
          player.isStarter
      );


    const bench =
      allPlayers.filter(
        (
          player
        ) =>
          !player.isStarter
      );


    const playersLive =
      starters.filter(
        (
          player
        ) =>
          player
            .gameContext
            ?.isActuallyLive
      ).length;


    const playersFinal =
      starters.filter(
        (
          player
        ) =>
          player
            .scoreIsFinal ||
          player
            .gameContext
            ?.statusCompleted
      ).length;


    const playersRemaining =
      Math.max(
        0,
        starters.length -
          playersFinal
      );

    const projectedPoints =
      starters.reduce(
        (
          total,
          player
        ) =>
          total +
          player.projectedPoints,
        0
      );

    const expectedFinalPoints =
      starters.reduce(
        (
          total,
          player
        ) =>
          total +
          (
            player.scoreIsFinal ||
            player.gameContext
              ?.statusCompleted
              ? player.fantasyPoints
              : player.fantasyPoints +
                player.projectedPoints
          ),
        0
      );


    return {
      fantasyTeamId,

      teamName:
        teamMap.get(
          fantasyTeamId
        )
          ?.team_name ??
        "Unknown Team",

      points:
        numberValue(
          points
        ),

      projectedPoints,

      expectedFinalPoints,

      isMyTeam:
        myFantasyTeamId !==
          null &&
        fantasyTeamId ===
          myFantasyTeamId,

      isWinner,

      starters,

      bench,

      playersLive,

      playersFinal,

      playersRemaining,
    };
  }


  const tied =
    refreshed.tied ??
    false;


  const homeIsWinner =
    refreshed.is_final &&
    !tied &&
    refreshed
      .winner_fantasy_team_id ===
      refreshed
        .home_fantasy_team_id;


  const awayIsWinner =
    refreshed.is_final &&
    !tied &&
    refreshed
      .winner_fantasy_team_id ===
      refreshed
        .away_fantasy_team_id;


  const liveGames =
    Array.from(
      contextMap.values()
    ).filter(
      (
        context
      ) =>
        context.isActuallyLive
    );


  const redZoneGames =
    liveGames.filter(
      (
        context
      ) =>
        context.redZone
    );


  return {
    matchupId:
      refreshed.id,

    leagueId,

    season:
      refreshed.season,

    week:
      refreshed.week,

    status:
      refreshed.is_final
        ? "final"
        : refreshed.is_live
          ? "live"
          : "scheduled",

    isLive:
      refreshed.is_live,

    isFinal:
      refreshed.is_final,

    tied,

    home:
      buildTeam(
        refreshed
          .home_fantasy_team_id,
        refreshed
          .home_points,
        homeIsWinner
      ),

    away:
      buildTeam(
        refreshed
          .away_fantasy_team_id,
        refreshed
          .away_points,
        awayIsWinner
      ),

    liveGames,

    redZoneGames,

    recentScoringPlays,
  };
}