"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  createBrowserClient,
} from "@supabase/ssr";

import {
  useParams,
  useRouter,
} from "next/navigation";


type DraftStatus =
  | "scheduled"
  | "countdown"
  | "live"
  | "completed"
  | "cancelled";


type WorkspaceTab =
  | "players"
  | "queue"
  | "rankings"
  | "board"
  | "chat";


type DraftRow = {
  id: string;

  league_id: string;

  season: number;

  status:
    DraftStatus;

  scheduled_at:
    string |
    null;

  started_at:
    string |
    null;

  completed_at:
    string |
    null;

  total_rounds:
    number;

  current_round:
    number;

  current_pick:
    number;

  current_overall_pick:
    number;

  pick_timer_seconds:
    number;

  cpu_pick_seconds:
    number;

  is_paused:
    boolean;

  paused_at:
    string |
    null;

  pick_started_at:
    string |
    null;

  pick_deadline_at:
    string |
    null;

  paused_remaining_seconds:
    number |
    null;
};


type DraftSlotRow = {
  id: number;

  draft_id: string;

  league_id: string;

  fantasy_team_id:
    number;

  draft_slot:
    number;

  is_cpu:
    boolean;

  auto_pick:
    boolean;

  joined_at:
    string |
    null;
};


type DraftPickRow = {
  id: number;

  draft_id: string;

  league_id: string;

  season: number;

  round_number:
    number;

  pick_in_round:
    number;

  overall_pick:
    number;

  draft_slot:
    number;

  fantasy_team_id:
    number;

  player_id:
    number;

  pick_type:
    "manual" |
    "auto" |
    "cpu" |
    "commissioner";

  picked_by:
    string |
    null;

  picked_at:
    string;
};


type FantasyTeamRow = {
  id: number;

  team_name: string;

  owner_id:
    string |
    null;

  active:
    boolean;
};


type PlayerRow = {
  id: number;

  full_name:
    string;

  first_name:
    string |
    null;

  last_name:
    string |
    null;

  primary_position:
    string;

  team_abbreviation:
    string |
    null;

  status:
    string;

  is_active:
    boolean;

  headshot_url:
    string |
    null;
};


type RankingRow = {
  player_id: number;

  rank: number;

  projected_points:
    number |
    null;
};


type MyRankingRow = {
  player_id: number;

  rank: number;
};


type RosterSettingRow = {
  starting_qb:
    number;

  starting_rb:
    number;

  starting_wr:
    number;

  starting_te:
    number;

  starting_flex:
    number;

  starting_superflex:
    number;

  starting_k:
    number;

  starting_dst:
    number;

  bench_slots:
    number;

  ir_slots:
    number;

  max_qb:
    number;

  max_rb:
    number;

  max_wr:
    number;

  max_te:
    number;

  max_k:
    number;

  max_dst:
    number;
};


type DraftChatMessageRow = {
  id: number;

  draft_id: string;

  league_id: string;

  user_id: string;

  message: string;

  created_at: string;
};


type DraftPlayerProfile = {
  playerId: number;

  lastSeason: number;

  projectionSeason: number;

  projectedPoints:
    number |
    null;

  actual: {
    gamesPlayed:
      number;

    passingAttempts:
      number;

    passingCompletions:
      number;

    passingYards:
      number;

    passingTouchdowns:
      number;

    passingInterceptions:
      number;

    rushingAttempts:
      number;

    rushingYards:
      number;

    rushingTouchdowns:
      number;

    receivingTargets:
      number;

    receptions:
      number;

    receivingYards:
      number;

    receivingTouchdowns:
      number;

    fumbles:
      number;

    fumblesLost:
      number;

    fieldGoalsMade:
      number;

    fieldGoalsAttempted:
      number;

    extraPointsMade:
      number;

    extraPointsAttempted:
      number;

    dstSacks:
      number;

    dstInterceptions:
      number;

    dstFumbleRecoveries:
      number;

    dstTouchdowns:
      number;

    dstSafeties:
      number;

    dstBlockedKicks:
      number;

    dstPointsAllowed:
      number;

    dstYardsAllowed:
      number;
  };
};


type LeagueAccessRow = {
  commissioner_user_id:
    string |
    null;
};


type InjuryRow = {
  nfl_player_id:
    number |
    null;

  status:
    string |
    null;

  injury_type:
    string |
    null;

  injury_location:
    string |
    null;

  injury_detail:
    string |
    null;

  injury_date:
    string |
    null;

  return_date:
    string |
    null;

  source_updated_at:
    string |
    null;

  updated_at:
    string |
    null;
};


type ProjectionRow = {
  nfl_player_id: number;
  passing_attempts: number | string | null;
  passing_completions: number | string | null;
  passing_yards: number | string | null;
  passing_touchdowns: number | string | null;
  passing_interceptions: number | string | null;
  rushing_attempts: number | string | null;
  rushing_yards: number | string | null;
  rushing_touchdowns: number | string | null;
  receiving_targets: number | string | null;
  receptions: number | string | null;
  receiving_yards: number | string | null;
  receiving_touchdowns: number | string | null;
  fumbles: number | string | null;
  fumbles_lost: number | string | null;
  field_goals_made: number | string | null;
  field_goals_attempted: number | string | null;
  extra_points_made: number | string | null;
  extra_points_attempted: number | string | null;
};


type ScoringSettingsRow = {
  passing_yards_per_point: number | string | null;
  passing_td_points: number | string | null;
  passing_interception_points: number | string | null;
  passing_two_point_points: number | string | null;
  passing_completion_points: number | string | null;
  passing_incompletion_points: number | string | null;
  rushing_yards_per_point: number | string | null;
  rushing_td_points: number | string | null;
  rushing_two_point_points: number | string | null;
  rushing_attempt_points: number | string | null;
  receiving_yards_per_point: number | string | null;
  receiving_td_points: number | string | null;
  receiving_two_point_points: number | string | null;
  reception_points: number | string | null;
  receiving_target_points: number | string | null;
  passing_first_down_points: number | string | null;
  rushing_first_down_points: number | string | null;
  receiving_first_down_points: number | string | null;
  fumble_points: number | string | null;
  fumble_lost_points: number | string | null;
  extra_point_made_points: number | string | null;
  extra_point_missed_points: number | string | null;
  field_goal_missed_points: number | string | null;
  kick_return_yards_per_point: number | string | null;
  punt_return_yards_per_point: number | string | null;
  kick_return_td_points: number | string | null;
  punt_return_td_points: number | string | null;
  offensive_fumble_recovery_td_points: number | string | null;
  fractional_scoring_enabled: boolean | null;
  decimal_places: number | null;
};


type ClockState = {
  draftId: string;

  status:
    DraftStatus;

  isPaused:
    boolean;

  round:
    number;

  pickInRound:
    number;

  overallPick:
    number;

  draftSlot:
    number |
    null;

  fantasyTeamId:
    number |
    null;

  isCpu:
    boolean;

  autoPick:
    boolean;

  pickStartedAt:
    string |
    null;

  pickDeadlineAt:
    string |
    null;

  secondsRemaining:
    number;

  serverNow:
    string;
};


type PlayerView = {
  id: number;

  name: string;

  position: string;

  team:
    string;

  headshot:
    string |
    null;

  defaultRank:
    number;

  myRank:
    number |
    null;

  projectedPoints:
    number |
    null;

  byeWeek:
    number |
    null;

  injuryStatus:
    string |
    null;

  injuryType:
    string |
    null;

  injuryLocation:
    string |
    null;

  injuryDetail:
    string |
    null;

  injuryDate:
    string |
    null;

  injuryReturnDate:
    string |
    null;
};


const supabase =
  createBrowserClient(
    process.env
      .NEXT_PUBLIC_SUPABASE_URL!,
    process.env
      .NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
      process.env
        .NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );


function numberValue(
  value:
    number |
    string |
    null |
    undefined,
  fallback =
    0
) {
  if (
    value ===
      null ||
    value ===
      undefined
  ) {
    return fallback;
  }


  const parsed =
    Number(
      value
    );


  return Number.isFinite(
    parsed
  )
    ? parsed
    : fallback;
}


function divideByRate(
  amount:
    number,
  unitsPerPoint:
    number
) {
  if (
    !Number.isFinite(
      unitsPerPoint
    ) ||
    unitsPerPoint <=
      0
  ) {
    return 0;
  }


  return (
    amount /
    unitsPerPoint
  );
}


function roundProjectedPoints(
  value:
    number,
  settings:
    ScoringSettingsRow
) {
  if (
    !Number.isFinite(
      value
    )
  ) {
    return null;
  }


  if (
    settings
      .fractional_scoring_enabled ===
    false
  ) {
    return Math.round(
      value
    );
  }


  const requestedPlaces =
    Number(
      settings
        .decimal_places ??
      2
    );


  const places =
    Math.min(
      4,
      Math.max(
        0,
        Number.isFinite(
          requestedPlaces
        )
          ? requestedPlaces
          : 2
      )
    );


  const multiplier =
    10 **
    places;


  return (
    Math.round(
      value *
      multiplier
    ) /
    multiplier
  );
}


function calculateLeagueProjectedPoints(
  projection:
    ProjectionRow,
  settings:
    ScoringSettingsRow
) {
  const passingAttempts =
    numberValue(
      projection
        .passing_attempts
    );

  const passingCompletions =
    numberValue(
      projection
        .passing_completions
    );

  const passingIncompletions =
    Math.max(
      0,
      passingAttempts -
      passingCompletions
    );


  const passingPoints =
    divideByRate(
      numberValue(
        projection
          .passing_yards
      ),
      numberValue(
        settings
          .passing_yards_per_point
      )
    ) +
    (
      numberValue(
        projection
          .passing_touchdowns
      ) *
      numberValue(
        settings
          .passing_td_points
      )
    ) +
    (
      numberValue(
        projection
          .passing_interceptions
      ) *
      numberValue(
        settings
          .passing_interception_points
      )
    ) +
    (
      passingCompletions *
      numberValue(
        settings
          .passing_completion_points
      )
    ) +
    (
      passingIncompletions *
      numberValue(
        settings
          .passing_incompletion_points
      )
    );


  const rushingPoints =
    divideByRate(
      numberValue(
        projection
          .rushing_yards
      ),
      numberValue(
        settings
          .rushing_yards_per_point
      )
    ) +
    (
      numberValue(
        projection
          .rushing_touchdowns
      ) *
      numberValue(
        settings
          .rushing_td_points
      )
    ) +
    (
      numberValue(
        projection
          .rushing_attempts
      ) *
      numberValue(
        settings
          .rushing_attempt_points
      )
    );


  const receivingPoints =
    divideByRate(
      numberValue(
        projection
          .receiving_yards
      ),
      numberValue(
        settings
          .receiving_yards_per_point
      )
    ) +
    (
      numberValue(
        projection
          .receiving_touchdowns
      ) *
      numberValue(
        settings
          .receiving_td_points
      )
    ) +
    (
      numberValue(
        projection
          .receptions
      ) *
      numberValue(
        settings
          .reception_points
      )
    ) +
    (
      numberValue(
        projection
          .receiving_targets
      ) *
      numberValue(
        settings
          .receiving_target_points
      )
    );


  const fumblePoints =
    (
      numberValue(
        projection
          .fumbles
      ) *
      numberValue(
        settings
          .fumble_points
      )
    ) +
    (
      numberValue(
        projection
          .fumbles_lost
      ) *
      numberValue(
        settings
          .fumble_lost_points
      )
    );


  const extraPointsMade =
    numberValue(
      projection
        .extra_points_made
    );

  const extraPointsAttempted =
    numberValue(
      projection
        .extra_points_attempted
    );

  const extraPointsMissed =
    Math.max(
      0,
      extraPointsAttempted -
      extraPointsMade
    );


  const fieldGoalsMade =
    numberValue(
      projection
        .field_goals_made
    );

  const fieldGoalsAttempted =
    numberValue(
      projection
        .field_goals_attempted
    );

  const fieldGoalsMissed =
    Math.max(
      0,
      fieldGoalsAttempted -
      fieldGoalsMade
    );


  /*
   * league_scoring_settings does not contain a single
   * field_goal_made_points column. Made field-goal
   * scoring is expected to be represented by kicking
   * rules (usually distance bands).
   *
   * Since there are currently no league_scoring_rules
   * rows, use the standard 3 points per made FG as the
   * temporary baseline. Once kicking-distance projection
   * distributions are stored, this can use the exact
   * league rule bands instead.
   */
  const standardFieldGoalMadePoints =
    3;


  const kickingPoints =
    (
      extraPointsMade *
      numberValue(
        settings
          .extra_point_made_points
      )
    ) +
    (
      extraPointsMissed *
      numberValue(
        settings
          .extra_point_missed_points
      )
    ) +
    (
      fieldGoalsMade *
      standardFieldGoalMadePoints
    ) +
    (
      fieldGoalsMissed *
      numberValue(
        settings
          .field_goal_missed_points
      )
    );


  const total =
    passingPoints +
    rushingPoints +
    receivingPoints +
    fumblePoints +
    kickingPoints;


  return roundProjectedPoints(
    total,
    settings
  );
}


function compactName(
  fullName: string
) {
  const parts =
    fullName
      .trim()
      .split(
        /\s+/
      );


  if (
    parts.length <=
    1
  ) {
    return fullName;
  }


  return `${parts[0][0]}. ${parts.slice(1).join(" ")}`;
}


function formatClock(
  seconds: number
) {
  const safe =
    Math.max(
      0,
      Math.floor(
        seconds
      )
    );


  const minutes =
    Math.floor(
      safe /
      60
    );


  const remaining =
    safe %
    60;


  return `${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`;
}


function positionOrder(
  position: string
) {
  const order =
    [
      "QB",
      "RB",
      "WR",
      "TE",
      "K",
      "DST",
    ];


  const index =
    order.indexOf(
      position
    );


  return index ===
    -1
      ? 99
      : index;
}


function getInjuryDisplay(
  status:
    string |
    null |
    undefined
) {
  const normalized =
    (
      status ??
      ""
    )
      .trim()
      .toUpperCase();


  if (
    !normalized ||
    [
      "ACTIVE",
      "HEALTHY",
      "NORMAL",
    ].includes(
      normalized
    )
  ) {
    return null;
  }


  if (
    normalized.includes(
      "QUESTION"
    ) ||
    normalized ===
      "Q"
  ) {
    return {
      code:
        "Q",

      label:
        "Questionable",
    };
  }


  if (
    normalized.includes(
      "DOUBT"
    ) ||
    normalized ===
      "D"
  ) {
    return {
      code:
        "D",

      label:
        "Doubtful",
    };
  }


  if (
    normalized ===
      "O" ||
    normalized.includes(
      "OUT"
    )
  ) {
    return {
      code:
        "O",

      label:
        "Out",
    };
  }


  if (
    normalized.includes(
      "INJURED RESERVE"
    ) ||
    normalized ===
      "IR"
  ) {
    return {
      code:
        "IR",

      label:
        "Injured Reserve",
    };
  }


  if (
    normalized.includes(
      "PUP"
    ) ||
    normalized.includes(
      "PHYSICALLY UNABLE"
    )
  ) {
    return {
      code:
        "PUP",

      label:
        "Physically Unable to Perform",
    };
  }


  if (
    normalized.includes(
      "SUSPEND"
    ) ||
    normalized ===
      "SUS"
  ) {
    return {
      code:
        "SUS",

      label:
        "Suspended",
    };
  }


  if (
    normalized.includes(
      "DAY-TO-DAY"
    ) ||
    normalized.includes(
      "DAY TO DAY"
    )
  ) {
    return {
      code:
        "DTD",

      label:
        "Day-to-Day",
    };
  }


  return {
    code:
      normalized.length <=
      4
        ? normalized
        : "INJ",

    label:
      status ??
      "Injury status",
  };
}


function InjuryBadge({
  status,
  onClick,
}: {
  status:
    string |
    null |
    undefined;

  onClick?:
    () => void;
}) {
  const display =
    getInjuryDisplay(
      status
    );


  if (
    !display
  ) {
    return (
      <span
        style={
          styles.injuryHealthy
        }
        title="No injury designation"
      >
        —
      </span>
    );
  }


  return (
    <button
      type="button"
      style={{
        ...styles.injuryBadge,
        ...(onClick
          ? styles.injuryBadgeClickable
          : {}),
      }}
      title={`${display.code} — ${display.label}`}
      aria-label={`View ${display.label} injury report`}
      onClick={(event) => {
        event.stopPropagation();
        onClick?.();
      }}
    >
      {display.code}
    </button>
  );
}



export default function TraditionalDraftPage() {
  const params =
    useParams<{
      leagueId: string;
    }>();


  const leagueId =
    params.leagueId;


  const router =
    useRouter();


  const [
    loading,
    setLoading,
  ] =
    useState(
      true
    );


  const [
    error,
    setError,
  ] =
    useState<
      string |
      null
    >(
      null
    );


  const [
    draft,
    setDraft,
  ] =
    useState<
      DraftRow |
      null
    >(
      null
    );


  const [
    slots,
    setSlots,
  ] =
    useState<
      DraftSlotRow[]
    >(
      []
    );


  const [
    picks,
    setPicks,
  ] =
    useState<
      DraftPickRow[]
    >(
      []
    );


  const [
    teams,
    setTeams,
  ] =
    useState<
      FantasyTeamRow[]
    >(
      []
    );


  const [
    players,
    setPlayers,
  ] =
    useState<
      PlayerRow[]
    >(
      []
    );


  const [
    byeWeekByTeam,
    setByeWeekByTeam,
  ] =
    useState<
      Record<
        string,
        number |
        null
      >
    >(
      {}
    );


  const [
    defaultRankings,
    setDefaultRankings,
  ] =
    useState<
      RankingRow[]
    >(
      []
    );


  const [
    myRankings,
    setMyRankings,
  ] =
    useState<
      MyRankingRow[]
    >(
      []
    );


  const [
    rosterSettings,
    setRosterSettings,
  ] =
    useState<
      RosterSettingRow |
      null
    >(
      null
    );


  const [
    currentUserId,
    setCurrentUserId,
  ] =
    useState<
      string |
      null
    >(
      null
    );


  const [
    myTeamId,
    setMyTeamId,
  ] =
    useState<
      number |
      null
    >(
      null
    );


  const [
    activeTab,
    setActiveTab,
  ] =
    useState<
      WorkspaceTab
    >(
      "players"
    );


  const [
    selectedPlayerId,
    setSelectedPlayerId,
  ] =
    useState<
      number |
      null
    >(
      null
    );


  const [
    profilePlayerId,
    setProfilePlayerId,
  ] =
    useState<
      number |
      null
    >(
      null
    );


  const [
    playerProfile,
    setPlayerProfile,
  ] =
    useState<
      DraftPlayerProfile |
      null
    >(
      null
    );


  const [
    profileLoading,
    setProfileLoading,
  ] =
    useState(
      false
    );


  const [
    injuryReportPlayerId,
    setInjuryReportPlayerId,
  ] =
    useState<
      number |
      null
    >(
      null
    );


  const [
    injuries,
    setInjuries,
  ] =
    useState<
      InjuryRow[]
    >(
      []
    );


  const [
    projections,
    setProjections,
  ] =
    useState<
      ProjectionRow[]
    >(
      []
    );


  const [
    scoringSettings,
    setScoringSettings,
  ] =
    useState<
      ScoringSettingsRow |
      null
    >(
      null
    );


  const [
    isCommissioner,
    setIsCommissioner,
  ] =
    useState(
      false
    );


  const [
    queueIds,
    setQueueIds,
  ] =
    useState<
      number[]
    >(
      []
    );


  const [
    search,
    setSearch,
  ] =
    useState(
      ""
    );


  const [
    positionFilter,
    setPositionFilter,
  ] =
    useState(
      "ALL"
    );


  const [
    teamFilter,
    setTeamFilter,
  ] =
    useState(
      "ALL"
    );


  const [
    rosterTeamId,
    setRosterTeamId,
  ] =
    useState<
      number |
      null
    >(
      null
    );


  const [
    onlineUserIds,
    setOnlineUserIds,
  ] =
    useState<
      string[]
    >(
      []
    );


  const [
    clock,
    setClock,
  ] =
    useState<
      ClockState |
      null
    >(
      null
    );


  const [
    localSeconds,
    setLocalSeconds,
  ] =
    useState(
      0
    );


  const [
    working,
    setWorking,
  ] =
    useState(
      false
    );


  const [
    autoPickWorking,
    setAutoPickWorking,
  ] =
    useState(
      false
    );


  const [
    collapsedWorkspace,
    setCollapsedWorkspace,
  ] =
    useState(
      false
    );




  const [
    turnSoundsOn,
    setTurnSoundsOn,
  ] =
    useState(
      true
    );


  const [
    muted,
    setMuted,
  ] =
    useState(
      false
    );


  const [
    unreadChatCount,
    setUnreadChatCount,
  ] =
    useState(
      0
    );


  const [
    chatMessages,
    setChatMessages,
  ] =
    useState<
      DraftChatMessageRow[]
    >(
      []
    );


  const [
    chatSending,
    setChatSending,
  ] =
    useState(
      false
    );


  const lastChatMessageIdRef =
    useRef<
      number |
      null
    >(
      null
    );


  const lastTurnAnnouncedRef =
    useRef<
      number |
      null
    >(
      null
    );


  const realtimeConnectedRef =
    useRef(
      false
    );


  /*
   * Difference between Supabase/database time and this browser's local clock.
   * Every visible countdown uses database time so two different devices do
   * not drift just because their operating-system clocks differ.
   */
  const serverTimeOffsetMsRef =
    useRef(
      0
    );


  /*
   * Prevent repeated zero-second drive calls for the same overall pick.
   * Every browser may reach zero at nearly the same moment, but the database
   * remains authoritative and idempotent. This ref simply avoids local spam.
   */
  const drivenAtZeroPickRef =
    useRef<
      number |
      null
    >(
      null
    );


  const driveInFlightRef =
    useRef(
      false
    );


  const zeroRetryTimerRef =
    useRef<
      number |
      null
    >(
      null
    );


  const teamMap =
    useMemo(
      () =>
        new Map(
          teams.map(
            (
              team
            ) => [
              team.id,
              team,
            ] as const
          )
        ),
      [
        teams,
      ]
    );


  const playerMap =
    useMemo(
      () =>
        new Map(
          players.map(
            (
              player
            ) => [
              player.id,
              player,
            ] as const
          )
        ),
      [
        players,
      ]
    );


  const defaultRankingMap =
    useMemo(
      () =>
        new Map(
          defaultRankings.map(
            (
              row
            ) => [
              row.player_id,
              row,
            ] as const
          )
        ),
      [
        defaultRankings,
      ]
    );


  const myRankingMap =
    useMemo(
      () =>
        new Map(
          myRankings.map(
            (
              row
            ) => [
              row.player_id,
              row.rank,
            ] as const
          )
        ),
      [
        myRankings,
      ]
    );


  const draftedPlayerIds =
    useMemo(
      () =>
        new Set(
          picks.map(
            (
              pick
            ) =>
              Number(
                pick.player_id
              )
          )
        ),
      [
        picks,
      ]
    );


  const injuryMap =
    useMemo(
      () =>
        new Map(
          injuries
            .filter(
              (row) =>
                row.nfl_player_id !==
                null
            )
            .map(
              (row) => [
                row.nfl_player_id as number,
                row,
              ] as const
            )
        ),
      [
        injuries,
      ]
    );


  const projectionMap =
    useMemo(
      () =>
        new Map(
          projections.map(
            (row) => [
              row.nfl_player_id,
              row,
            ] as const
          )
        ),
      [
        projections,
      ]
    );


  const playerViews =
    useMemo(
      () => {
        return players
          .filter(
            (
              player
            ) =>
              player.is_active &&
              [
                "QB",
                "RB",
                "WR",
                "TE",
                "K",
                "DST",
              ].includes(
                player.primary_position
              )
          )
          .map(
            (
              player
            ): PlayerView => {
              const defaultRow =
                defaultRankingMap.get(
                  player.id
                );


              return {
                id:
                  player.id,

                name:
                  player.full_name,

                position:
                  player.primary_position,

                team:
                  player.team_abbreviation ??
                  "FA",

                headshot:
                  player.headshot_url,

                defaultRank:
                  defaultRow
                    ?.rank ??
                  99999,

                myRank:
                  myRankingMap.get(
                    player.id
                  ) ??
                  null,

                projectedPoints:
                  (() => {
                    const projection =
                      projectionMap.get(
                        player.id
                      );

                    if (
                      projection &&
                      scoringSettings
                    ) {
                      return calculateLeagueProjectedPoints(
                        projection,
                        scoringSettings
                      );
                    }

                    const fallback =
                      defaultRow
                        ?.projected_points ??
                      null;

                    return fallback ===
                      null
                      ? null
                      : Number(
                          fallback
                        );
                  })(),

                byeWeek:
                  player.team_abbreviation
                    ? byeWeekByTeam[
                        player.team_abbreviation
                      ] ??
                      null
                    : null,

                injuryStatus:
                  injuryMap.get(
                    player.id
                  )?.status ??
                  (
                    player.status !==
                    "ACTIVE"
                      ? player.status
                      : null
                  ),

                injuryType:
                  injuryMap.get(
                    player.id
                  )?.injury_type ??
                  null,

                injuryLocation:
                  injuryMap.get(
                    player.id
                  )?.injury_location ??
                  null,

                injuryDetail:
                  injuryMap.get(
                    player.id
                  )?.injury_detail ??
                  null,

                injuryDate:
                  injuryMap.get(
                    player.id
                  )?.injury_date ??
                  null,

                injuryReturnDate:
                  injuryMap.get(
                    player.id
                  )?.return_date ??
                  null,
              };
            }
          )
          .sort(
            (
              a,
              b
            ) => {
              if (
                a.defaultRank !==
                b.defaultRank
              ) {
                return (
                  a.defaultRank -
                  b.defaultRank
                );
              }


              return a.name.localeCompare(
                b.name
              );
            }
          );
      },
      [
        players,
        defaultRankingMap,
        myRankingMap,
        byeWeekByTeam,
        injuryMap,
        projectionMap,
        scoringSettings,
      ]
    );


  const availablePlayers =
    useMemo(
      () => {
        const searchLower =
          search
            .trim()
            .toLowerCase();


        return playerViews.filter(
          (
            player
          ) => {
            if (
              draftedPlayerIds.has(
                player.id
              )
            ) {
              return false;
            }


            if (
              positionFilter !==
                "ALL" &&
              player.position !==
                positionFilter
            ) {
              return false;
            }


            if (
              teamFilter !==
                "ALL" &&
              player.team !==
                teamFilter
            ) {
              return false;
            }


            if (
              searchLower &&
              !`${player.name} ${player.position} ${player.team}`
                .toLowerCase()
                .includes(
                  searchLower
                )
            ) {
              return false;
            }


            return true;
          }
        );
      },
      [
        playerViews,
        draftedPlayerIds,
        positionFilter,
        teamFilter,
        search,
      ]
    );


  const selectedPlayer =
    useMemo(
      () =>
        playerViews.find(
          (
            player
          ) =>
            player.id ===
            selectedPlayerId
        ) ??
        null,
      [
        playerViews,
        selectedPlayerId,
      ]
    );


  const profilePlayer =
    useMemo(
      () =>
        playerViews.find(
          (
            player
          ) =>
            player.id ===
            profilePlayerId
        ) ??
        null,
      [
        playerViews,
        profilePlayerId,
      ]
    );


  const injuryReportPlayer =
    useMemo(
      () =>
        playerViews.find(
          (player) =>
            player.id ===
            injuryReportPlayerId
        ) ??
        null,
      [
        playerViews,
        injuryReportPlayerId,
      ]
    );


  const currentTeamId =
    clock
      ?.fantasyTeamId ??
    null;


  const currentSlot =
    useMemo(
      () =>
        slots.find(
          (
            slot
          ) =>
            slot.draft_slot ===
              clock
                ?.draftSlot
        ) ??
        null,
      [
        slots,
        clock,
      ]
    );


  const currentTeam =
    currentTeamId
      ? teamMap.get(
          currentTeamId
        ) ??
        null
      : null;


  const mySlot =
    useMemo(
      () =>
        slots.find(
          (
            slot
          ) =>
            slot.fantasy_team_id ===
            myTeamId
        ) ??
        null,
      [
        slots,
        myTeamId,
      ]
    );


  const isCurrentOwnerTurn =
    Boolean(
      draft
        ?.status ===
        "live" &&
      !draft.is_paused &&
      currentTeam
        ?.owner_id &&
      currentTeam.owner_id ===
        currentUserId &&
      !currentSlot
        ?.is_cpu
    );


  const isMyTurn =
    Boolean(
      isCurrentOwnerTurn
    );


  /*
   * The commissioner may make the current selection for a human owner who is
   * drafting in person. CPU slots remain automatic.
   */
  const canDraft =
    Boolean(
      draft
        ?.status ===
        "live" &&
      !draft.is_paused &&
      selectedPlayer &&
      !working &&
      !currentSlot
        ?.is_cpu &&
      (
        (
          isMyTurn &&
          !currentSlot
            ?.auto_pick
        ) ||
        isCommissioner
      )
    );


  const latestPick =
    picks.length >
    0
      ? picks[
          picks.length -
            1
        ]
      : null;


  const upcomingPicks =
    useMemo(
      () => {
        if (
          !draft ||
          !slots.length
        ) {
          return [];
        }


        const teamCount =
          slots.length;


        const result:
          Array<{
            overallPick:
              number;

            round:
              number;

            pickInRound:
              number;

            draftSlot:
              number;

            fantasyTeamId:
              number;
          }> =
            [];


        const totalPicks =
          teamCount *
          draft.total_rounds;


        for (
          let overall =
            draft.current_overall_pick;
          overall <=
            Math.min(
              totalPicks,
              draft.current_overall_pick +
                11
            );
          overall +=
          1
        ) {
          const round =
            Math.floor(
              (
                overall -
                1
              ) /
              teamCount
            ) +
            1;


          const pickInRound =
            (
              (
                overall -
                1
              ) %
              teamCount
            ) +
            1;


          const draftSlot =
            round %
              2 ===
            1
              ? pickInRound
              : teamCount -
                pickInRound +
                1;


          const slot =
            slots.find(
              (
                row
              ) =>
                row.draft_slot ===
                draftSlot
            );


          if (
            slot
          ) {
            result.push({
              overallPick:
                overall,

              round,

              pickInRound,

              draftSlot,

              fantasyTeamId:
                slot.fantasy_team_id,
            });
          }
        }


        return result;
      },
      [
        draft,
        slots,
      ]
    );


  const displayedRosterTeamId =
    rosterTeamId ??
    myTeamId ??
    teams[0]
      ?.id ??
    null;


  const displayedRosterPicks =
    useMemo(
      () =>
        picks.filter(
          (
            pick
          ) =>
            pick.fantasy_team_id ===
            displayedRosterTeamId
        ),
      [
        picks,
        displayedRosterTeamId,
      ]
    );


  const loadStaticData =
    useCallback(
      async () => {
        setLoading(
          true
        );

        setError(
          null
        );


        const {
          data:
            userData,
        } =
          await supabase.auth
            .getUser();


        const userId =
          userData.user
            ?.id ??
          null;


        if (
          !userId
        ) {
          setError(
            "You must be signed in."
          );

          setLoading(
            false
          );

          return;
        }


        setCurrentUserId(
          userId
        );


        const {
          data:
            draftData,

          error:
            draftError,
        } =
          await supabase
            .from(
              "league_drafts"
            )
            .select(
              "*"
            )
            .eq(
              "league_id",
              leagueId
            )
            .order(
              "season",
              {
                ascending:
                  false,
              }
            )
            .limit(
              1
            )
            .maybeSingle();


        if (
          draftError
        ) {
          setError(
            draftError.message
          );

          setLoading(
            false
          );

          return;
        }


        if (
          !draftData
        ) {
          setError(
            "Draft has not been created for this league yet."
          );

          setLoading(
            false
          );

          return;
        }


        const loadedDraft =
          draftData as DraftRow;


        setDraft(
          loadedDraft
        );


        const [
          slotResult,
          teamResult,
          playerResult,
          defaultRankingResult,
          myRankingResult,
          rosterSettingResult,
          byeWeekResult,
          injuryResult,
          projectionResult,
          scoringResult,
          leagueAccessResult,
        ] =
          await Promise.all([
            supabase
              .from(
                "league_draft_slots"
              )
              .select(
                "*"
              )
              .eq(
                "draft_id",
                loadedDraft.id
              )
              .order(
                "draft_slot"
              ),

            supabase
              .from(
                "fantasy_teams"
              )
              .select(
                "id, team_name, owner_id, active"
              )
              .eq(
                "league_id",
                leagueId
              )
              .eq(
                "active",
                true
              ),

            supabase
              .from(
                "nfl_players"
              )
              .select(
                "id, full_name, first_name, last_name, primary_position, team_abbreviation, status, is_active, headshot_url"
              )
              .eq(
                "is_active",
                true
              ),

            supabase
              .from(
                "traditional_default_draft_rankings"
              )
              .select(
                "player_id, rank, projected_points"
              )
              .eq(
                "season",
                loadedDraft.season
              )
              .order(
                "rank"
              ),

            supabase
              .from(
                "traditional_draft_rankings"
              )
              .select(
                "player_id, rank"
              )
              .eq(
                "league_id",
                leagueId
              )
              .eq(
                "season",
                loadedDraft.season
              )
              .eq(
                "user_id",
                userId
              )
              .order(
                "rank"
              ),

            supabase
              .from(
                "traditional_roster_settings"
              )
              .select(
                "*"
              )
              .eq(
                "league_id",
                leagueId
              )
              .maybeSingle(),

            supabase.rpc(
              "get_nfl_team_bye_weeks",
              {
                p_season:
                  loadedDraft.season,
              }
            ),

            supabase
              .from(
                "current_nfl_player_injuries"
              )
              .select(
                "nfl_player_id, status, injury_type, injury_location, injury_detail, injury_date, return_date, source_updated_at, updated_at"
              )
              .eq(
                "season",
                loadedDraft.season
              ),

            supabase
              .from(
                "nfl_player_season_projections"
              )
              .select(
                "nfl_player_id, passing_attempts, passing_completions, passing_yards, passing_touchdowns, passing_interceptions, rushing_attempts, rushing_yards, rushing_touchdowns, receiving_targets, receptions, receiving_yards, receiving_touchdowns, fumbles, fumbles_lost, field_goals_made, field_goals_attempted, extra_points_made, extra_points_attempted"
              )
              .eq(
                "season",
                loadedDraft.season
              ),

            supabase
              .from(
                "league_scoring_settings"
              )
              .select(
                "passing_yards_per_point, passing_td_points, passing_interception_points, passing_two_point_points, passing_completion_points, passing_incompletion_points, rushing_yards_per_point, rushing_td_points, rushing_two_point_points, rushing_attempt_points, receiving_yards_per_point, receiving_td_points, receiving_two_point_points, reception_points, receiving_target_points, passing_first_down_points, rushing_first_down_points, receiving_first_down_points, fumble_points, fumble_lost_points, extra_point_made_points, extra_point_missed_points, field_goal_missed_points, kick_return_yards_per_point, punt_return_yards_per_point, kick_return_td_points, punt_return_td_points, offensive_fumble_recovery_td_points, fractional_scoring_enabled, decimal_places"
              )
              .eq(
                "league_id",
                leagueId
              )
              .maybeSingle(),

            supabase
              .from(
                "leagues"
              )
              .select(
                "commissioner_user_id"
              )
              .eq(
                "id",
                leagueId
              )
              .maybeSingle(),
          ]);


        for (
          const result
          of [
            slotResult,
            teamResult,
            playerResult,
            defaultRankingResult,
            myRankingResult,
            rosterSettingResult,
            byeWeekResult,
            injuryResult,
            projectionResult,
            scoringResult,
            leagueAccessResult,
          ]
        ) {
          if (
            result.error
          ) {
            setError(
              result.error
                .message
            );

            setLoading(
              false
            );

            return;
          }
        }


        const loadedTeams =
          (
            teamResult.data ??
            []
          ) as FantasyTeamRow[];


        const ownedTeam =
          loadedTeams.find(
            (
              team
            ) =>
              team.owner_id ===
              userId
          ) ??
          null;


        setSlots(
          (
            slotResult.data ??
            []
          ) as DraftSlotRow[]
        );

        setTeams(
          loadedTeams
        );

        setPlayers(
          (
            playerResult.data ??
            []
          ) as PlayerRow[]
        );


        setByeWeekByTeam(
          Object.fromEntries(
            (
              (
                byeWeekResult.data ??
                []
              ) as Array<{
                abbreviation:
                  string;

                bye_week:
                  number |
                  null;
              }>
            ).map(
              (
                row
              ) => [
                row.abbreviation,
                row.bye_week,
              ]
            )
          )
        );


        setDefaultRankings(
          (
            defaultRankingResult.data ??
            []
          ) as RankingRow[]
        );

        setMyRankings(
          (
            myRankingResult.data ??
            []
          ) as MyRankingRow[]
        );

        setInjuries(
          (
            injuryResult.data ??
            []
          ) as InjuryRow[]
        );

        setProjections(
          (
            projectionResult.data ??
            []
          ) as ProjectionRow[]
        );

        setScoringSettings(
          (
            scoringResult.data ??
            null
          ) as ScoringSettingsRow | null
        );

        setIsCommissioner(
          (
            leagueAccessResult.data as LeagueAccessRow | null
          )?.commissioner_user_id ===
            userId
        );

        setRosterSettings(
          rosterSettingResult.data as RosterSettingRow
        );

        setMyTeamId(
          ownedTeam
            ?.id ??
            null
        );

        setRosterTeamId(
          ownedTeam
            ?.id ??
            loadedTeams[0]
              ?.id ??
            null
        );


        setLoading(
          false
        );
      },
      [
        leagueId,
      ]
    );


  const updateServerClockOffset =
    useCallback(
      (
        serverNow:
          string |
          null |
          undefined,
        requestStartedAt:
          number,
        responseReceivedAt:
          number
      ) => {
        if (
          !serverNow
        ) {
          return;
        }


        /*
         * Estimate the browser time corresponding to the server timestamp
         * using the midpoint of the request. This avoids making the displayed
         * clock reach zero early simply because the RPC took time to return.
         */
        const midpoint =
          requestStartedAt +
          (
            responseReceivedAt -
            requestStartedAt
          ) /
            2;


        serverTimeOffsetMsRef.current =
          new Date(
            serverNow
          ).getTime() -
          midpoint;
      },
      []
    );


  const driveDraftNow =
    useCallback(
      async () => {
        if (
          !draft?.id ||
          driveInFlightRef.current
        ) {
          return null;
        }


        driveInFlightRef.current =
          true;


        try {
          const requestStartedAt =
            Date.now();


          const {
            data,
            error,
          } =
            await supabase.rpc(
              "drive_traditional_draft",
              {
                p_draft_id:
                  draft.id,
              }
            );


          const responseReceivedAt =
            Date.now();


          if (
            error
          ) {
            console.error(
              "Live draft driver failed:",
              error
            );

            setError(
              error.message
            );

            return null;
          }


          const result =
            data as
              | {
                  success?: boolean;
                  pickProcessed?: boolean;
                  reason?: string;
                  clock?: ClockState;
                }
              | null;


          if (
            result?.clock
          ) {
            updateServerClockOffset(
              result.clock.serverNow,
              requestStartedAt,
              responseReceivedAt
            );

            setClock(
              result.clock
            );
          }


          return result;
        } finally {
          driveInFlightRef.current =
            false;
        }
      },
      [
        draft?.id,
        updateServerClockOffset,
      ]
    );


  const refreshLiveState =
    useCallback(
      async (
        drive:
          boolean
      ) => {
        if (
          !draft
        ) {
          return;
        }


        if (
          drive &&
          draft.status ===
            "live" &&
          !draft.is_paused
        ) {
          await supabase.rpc(
            "drive_traditional_draft",
            {
              p_draft_id:
                draft.id,
            }
          );
        }


        const clockRequestStartedAt =
          Date.now();


        const [
          draftResult,
          pickResult,
          clockResult,
          slotResult,
        ] =
          await Promise.all([
            supabase
              .from(
                "league_drafts"
              )
              .select(
                "*"
              )
              .eq(
                "id",
                draft.id
              )
              .single(),

            supabase
              .from(
                "league_draft_picks"
              )
              .select(
                "*"
              )
              .eq(
                "draft_id",
                draft.id
              )
              .order(
                "overall_pick"
              ),

            supabase.rpc(
              "get_traditional_draft_clock_state",
              {
                p_draft_id:
                  draft.id,
              }
            ),

            supabase
              .from(
                "league_draft_slots"
              )
              .select(
                "*"
              )
              .eq(
                "draft_id",
                draft.id
              )
              .order(
                "draft_slot"
              ),
          ]);


        if (
          draftResult.error
        ) {
          setError(
            draftResult.error
              .message
          );

          return;
        }


        if (
          pickResult.error
        ) {
          setError(
            pickResult.error
              .message
          );

          return;
        }


        if (
          clockResult.error
        ) {
          setError(
            clockResult.error
              .message
          );

          return;
        }


        setDraft(
          draftResult.data as DraftRow
        );

        setPicks(
          (
            pickResult.data ??
            []
          ) as DraftPickRow[]
        );

        const clockResponseReceivedAt =
          Date.now();


        const nextClock =
          clockResult.data as
            ClockState;


        updateServerClockOffset(
          nextClock.serverNow,
          clockRequestStartedAt,
          clockResponseReceivedAt
        );


        setClock(
          nextClock
        );

        setSlots(
          (
            slotResult.data ??
            []
          ) as DraftSlotRow[]
        );
      },
      [
        draft,
        updateServerClockOffset,
      ]
    );




  useEffect(
    () => {
      void loadStaticData();
    },
    [
      loadStaticData,
    ]
  );


  useEffect(
    () => {
      if (
        !draft?.id
      ) {
        return;
      }


      const draftId =
        draft.id;


      const realtimeChannel =
        supabase
          .channel(
            `traditional-draft-live:${draftId}`
          )
          .on(
            "postgres_changes",
            {
              event:
                "UPDATE",

              schema:
                "public",

              table:
                "league_draft_slots",

              filter:
                `draft_id=eq.${draftId}`,
            },
            (
              payload
            ) => {
              const updated =
                payload.new as
                  DraftSlotRow;


              setSlots(
                (
                  current
                ) =>
                  current.map(
                    (
                      slot
                    ) =>
                      slot.id ===
                      updated.id
                        ? {
                            ...slot,
                            ...updated,
                          }
                        : slot
                  )
              );
            }
          )
          .on(
            "postgres_changes",
            {
              event:
                "UPDATE",

              schema:
                "public",

              table:
                "league_drafts",

              filter:
                `id=eq.${draftId}`,
            },
            async (
              payload
            ) => {
              const updatedDraft =
                payload.new as
                  DraftRow;


              setDraft(
                updatedDraft
              );


              const {
                data:
                  clockData,
              } =
                await supabase.rpc(
                  "get_traditional_draft_clock_state",
                  {
                    p_draft_id:
                      draftId,
                  }
                );


              if (
                clockData
              ) {
                const nextClock =
                  clockData as
                    ClockState;


                /*
                 * Realtime payload follow-up RPC does not expose exact network
                 * timing here. Keep the existing calibrated offset from the
                 * normal snapshot/driver calls and update only if it has not
                 * been calibrated yet.
                 */
                if (
                  nextClock.serverNow &&
                  serverTimeOffsetMsRef.current ===
                    0
                ) {
                  serverTimeOffsetMsRef.current =
                    new Date(
                      nextClock.serverNow
                    ).getTime() -
                    Date.now();
                }


                setClock(
                  nextClock
                );
              }
            }
          )
          .on(
            "postgres_changes",
            {
              event:
                "INSERT",

              schema:
                "public",

              table:
                "league_draft_picks",

              filter:
                `draft_id=eq.${draftId}`,
            },
            async (
              payload
            ) => {
              const rawInserted =
                payload.new as
                  DraftPickRow;


              const inserted: DraftPickRow =
                {
                  ...rawInserted,

                  id:
                    Number(
                      rawInserted.id
                    ),

                  player_id:
                    Number(
                      rawInserted.player_id
                    ),

                  fantasy_team_id:
                    Number(
                      rawInserted.fantasy_team_id
                    ),

                  draft_slot:
                    Number(
                      rawInserted.draft_slot
                    ),

                  overall_pick:
                    Number(
                      rawInserted.overall_pick
                    ),

                  round_number:
                    Number(
                      rawInserted.round_number
                    ),

                  pick_in_round:
                    Number(
                      rawInserted.pick_in_round
                    ),
                };


              setSelectedPlayerId(
                (
                  current
                ) =>
                  current ===
                  inserted.player_id
                    ? null
                    : current
              );


              setQueueIds(
                (
                  current
                ) =>
                  current.filter(
                    (
                      playerId
                    ) =>
                      playerId !==
                      inserted.player_id
                  )
              );


              setPicks(
                (
                  current
                ) => {
                  if (
                    current.some(
                      (
                        pick
                      ) =>
                        pick.id ===
                        inserted.id
                    )
                  ) {
                    return current;
                  }


                  return [
                    ...current,
                    inserted,
                  ].sort(
                    (
                      a,
                      b
                    ) =>
                      a.overall_pick -
                      b.overall_pick
                  );
                }
              );


              const {
                data:
                  clockData,
              } =
                await supabase.rpc(
                  "get_traditional_draft_clock_state",
                  {
                    p_draft_id:
                      draftId,
                  }
                );


              if (
                clockData
              ) {
                const nextClock =
                  clockData as
                    ClockState;


                /*
                 * Realtime payload follow-up RPC does not expose exact network
                 * timing here. Keep the existing calibrated offset from the
                 * normal snapshot/driver calls and update only if it has not
                 * been calibrated yet.
                 */
                if (
                  nextClock.serverNow &&
                  serverTimeOffsetMsRef.current ===
                    0
                ) {
                  serverTimeOffsetMsRef.current =
                    new Date(
                      nextClock.serverNow
                    ).getTime() -
                    Date.now();
                }


                setClock(
                  nextClock
                );
              }


            }
          )
          .on(
            "postgres_changes",
            {
              event:
                "DELETE",

              schema:
                "public",

              table:
                "league_draft_picks",
            },
            (
              payload
            ) => {
              const deleted =
                payload.old as
                  Partial<DraftPickRow>;


              if (
                deleted.draft_id &&
                deleted.draft_id !==
                  draftId
              ) {
                return;
              }


              if (
                deleted.id ===
                undefined ||
                deleted.id ===
                null
              ) {
                return;
              }


              const deletedId =
                Number(
                  deleted.id
                );


              setPicks(
                (
                  current
                ) =>
                  current.filter(
                    (
                      pick
                    ) =>
                      Number(
                        pick.id
                      ) !==
                      deletedId
                  )
              );
            }
          )
          .subscribe(
            (
              status
            ) => {
              realtimeConnectedRef.current =
                status ===
                "SUBSCRIBED";


            }
          );


      return () => {
        realtimeConnectedRef.current =
          false;

        void supabase.removeChannel(
          realtimeChannel
        );
      };
    },
    [
      draft?.id,
    ]
  );


  useEffect(
    () => {
      if (
        !draft?.id ||
        !currentUserId
      ) {
        setOnlineUserIds(
          []
        );

        return;
      }


      const channel =
        supabase.channel(
          `traditional-draft-presence:${draft.id}`,
          {
            config: {
              presence: {
                key:
                  currentUserId,
              },
            },
          }
        );


      const syncPresence =
        () => {
          const state =
            channel.presenceState();

          setOnlineUserIds(
            Object.keys(
              state
            )
          );
        };


      const touchPresence =
        async () => {
          await supabase.rpc(
            "touch_traditional_draft_presence",
            {
              p_draft_id:
                draft.id,
            }
          );


          /*
           * Any connected draft room may run this safe sweep. Only owners who
           * previously had a presence heartbeat and have since gone stale are
           * moved to Auto-Pick.
           */
          await supabase.rpc(
            "sweep_traditional_draft_offline_members",
            {
              p_draft_id:
                draft.id,
            }
          );
        };


      const markMeOffline =
        () => {
          void supabase.rpc(
            "mark_my_traditional_draft_offline",
            {
              p_draft_id:
                draft.id,
            }
          );
        };


      channel
        .on(
          "presence",
          {
            event:
              "sync",
          },
          syncPresence
        )
        .on(
          "presence",
          {
            event:
              "join",
          },
          syncPresence
        )
        .on(
          "presence",
          {
            event:
              "leave",
          },
          syncPresence
        )
        .subscribe(
          async (
            status
          ) => {
            if (
              status ===
              "SUBSCRIBED"
            ) {
              await channel.track({
                user_id:
                  currentUserId,

                league_id:
                  leagueId,

                draft_id:
                  draft.id,

                online_at:
                  new Date()
                    .toISOString(),
              });


              await touchPresence();
            }
          }
        );


      const presenceHeartbeat =
        window.setInterval(
          () => {
            void touchPresence();
          },
          3000
        );


      window.addEventListener(
        "pagehide",
        markMeOffline
      );


      return () => {
        window.clearInterval(
          presenceHeartbeat
        );

        window.removeEventListener(
          "pagehide",
          markMeOffline
        );

        markMeOffline();

        void channel.untrack();

        void supabase.removeChannel(
          channel
        );
      };
    },
    [
      draft?.id,
      currentUserId,
      leagueId,
    ]
  );


  useEffect(
    () => {
      if (
        !draft?.id
      ) {
        return;
      }


      /*
       * One authoritative snapshot when this draft first loads.
       * After that, Realtime drives the visible UI.
       */
      void refreshLiveState(
        false
      );
    },
    [
      draft?.id,
    ]
  );


  useEffect(
    () => {
      drivenAtZeroPickRef.current =
        null;
    },
    [
      draft?.current_overall_pick,
    ]
  );


  useEffect(
    () => {
      if (
        !draft ||
        draft.status !==
          "live"
      ) {
        return;
      }


      /*
       * LIGHTWEIGHT DRAFT DRIVER
       *
       * Do not reload all visible draft state every second.
       * That caused the tracker to continually re-render/flicker.
       *
       * This heartbeat only asks the authoritative database to process a
       * pick if one is actually due. Any real change is then broadcast to
       * every draft room through Supabase Realtime.
       */
      const timer =
        window.setInterval(
          () => {
            if (
              draft.is_paused
            ) {
              return;
            }


            void driveDraftNow();
          },
          750
        );


      return () => {
        window.clearInterval(
          timer
        );
      };
    },
    [
      draft?.id,
      draft?.status,
      draft?.is_paused,
      driveDraftNow,
    ]
  );


  useEffect(
    () => {
      if (
        !draft?.id
      ) {
        return;
      }


      const recover =
        () => {
          if (
            document.visibilityState ===
            "visible"
          ) {
            void refreshLiveState(
              false
            );
          }
        };


      const handleOnline =
        () => {
          void refreshLiveState(
            false
          );
        };


      window.addEventListener(
        "focus",
        recover
      );

      window.addEventListener(
        "online",
        handleOnline
      );

      document.addEventListener(
        "visibilitychange",
        recover
      );


      return () => {
        window.removeEventListener(
          "focus",
          recover
        );

        window.removeEventListener(
          "online",
          handleOnline
        );

        document.removeEventListener(
          "visibilitychange",
          recover
        );
      };
    },
    [
      draft?.id,
    ]
  );


  useEffect(
    () => {
      if (
        !clock
      ) {
        setLocalSeconds(
          0
        );

        return;
      }


      /*
       * A paused draft has no running deadline. In that case the database's
       * authoritative saved remaining value is the correct display.
       */
      if (
        clock.isPaused
      ) {
        setLocalSeconds(
          Math.max(
            0,
            Number(
              clock.secondsRemaining ??
              0
            )
          )
        );

        return;
      }


      /*
       * A live turn must always count down from the shared database deadline.
       * Do NOT restart from secondsRemaining on each browser.
       */
      if (
        !clock.pickDeadlineAt
      ) {
        setLocalSeconds(
          Math.max(
            0,
            Number(
              clock.secondsRemaining ??
              0
            )
          )
        );

        return;
      }


      const deadline =
        new Date(
          clock.pickDeadlineAt
        ).getTime();


      const tick =
        () => {
          const authoritativeNow =
            Date.now() +
            serverTimeOffsetMsRef.current;


          setLocalSeconds(
            Math.max(
              0,
              Math.ceil(
                (
                  deadline -
                  authoritativeNow
                ) /
                1000
              )
            )
          );
        };


      tick();


      const timer =
        window.setInterval(
          tick,
          100
        );


      return () => {
        window.clearInterval(
          timer
        );
      };
    },
    [
      clock,
    ]
  );


  /*
   * IMMEDIATE ZERO-SECOND DRIVER
   *
   * Important: a browser can visually reach 0 a few hundred milliseconds
   * before PostgreSQL considers the deadline due because of network latency.
   * If the first drive call says "not due yet", retry until the database
   * actually processes the pick instead of permanently marking this pick as
   * already driven.
   */
  useEffect(
    () => {
      if (
        !draft ||
        !clock ||
        draft.status !==
          "live" ||
        draft.is_paused ||
        clock.isPaused ||
        !clock.pickDeadlineAt ||
        localSeconds >
          0
      ) {
        return;
      }


      const overallPick =
        Number(
          clock.overallPick ??
          draft.current_overall_pick
        );


      let cancelled =
        false;


      const clearRetry =
        () => {
          if (
            zeroRetryTimerRef.current !==
            null
          ) {
            window.clearTimeout(
              zeroRetryTimerRef.current
            );

            zeroRetryTimerRef.current =
              null;
          }
        };


      const attemptDrive =
        async () => {
          if (
            cancelled
          ) {
            return;
          }


          const result =
            await driveDraftNow();


          if (
            cancelled
          ) {
            return;
          }


          if (
            result?.pickProcessed
          ) {
            drivenAtZeroPickRef.current =
              overallPick;

            clearRetry();

            await refreshLiveState(
              false
            );

            return;
          }


          /*
           * The visible clock can hit 0 just before the database deadline.
           * Keep trying until PostgreSQL confirms the pick was processed.
           */
          drivenAtZeroPickRef.current =
            null;


          zeroRetryTimerRef.current =
            window.setTimeout(
              () => {
                void attemptDrive();
              },
              250
            );
        };


      if (
        drivenAtZeroPickRef.current !==
        overallPick
      ) {
        drivenAtZeroPickRef.current =
          overallPick;

        void attemptDrive();
      }


      return () => {
        cancelled =
          true;

        clearRetry();
      };
    },
    [
      draft?.id,
      draft?.status,
      draft?.is_paused,
      draft?.current_overall_pick,
      clock?.overallPick,
      clock?.isPaused,
      clock?.pickDeadlineAt,
      localSeconds,
      driveDraftNow,
      refreshLiveState,
    ]
  );


  useEffect(
    () => {
      if (
        activeTab ===
        "chat" &&
        unreadChatCount >
        0
      ) {
        setUnreadChatCount(
          0
        );
      }
    },
    [
      activeTab,
      unreadChatCount,
    ]
  );


  const loadDraftChat =
    useCallback(
      async (
        notify:
          boolean
      ) => {
        if (
          !draft
        ) {
          return;
        }


        const {
          data,
          error:
            chatError,
        } =
          await supabase
            .from(
              "traditional_draft_chat_messages"
            )
            .select(
              "id, draft_id, league_id, user_id, message, created_at"
            )
            .eq(
              "draft_id",
              draft.id
            )
            .order(
              "id",
              {
                ascending:
                  true,
              }
            )
            .limit(
              250
            );


        if (
          chatError
        ) {
          setError(
            chatError.message
          );

          return;
        }


        const rows =
          (
            data ??
            []
          ) as DraftChatMessageRow[];


        const newestId =
          rows.length >
            0
            ? rows[
                rows.length -
                  1
              ].id
            : null;


        if (
          notify &&
          activeTab !==
            "chat" &&
          lastChatMessageIdRef.current !==
            null &&
          newestId !==
            null &&
          newestId >
            lastChatMessageIdRef.current
        ) {
          const incomingCount =
            rows.filter(
              (
                row
              ) =>
                row.id >
                  (
                    lastChatMessageIdRef.current ??
                    0
                  ) &&
                row.user_id !==
                  currentUserId
            ).length;


          if (
            incomingCount >
            0
          ) {
            setUnreadChatCount(
              (
                count
              ) =>
                count +
                incomingCount
            );
          }
        }


        lastChatMessageIdRef.current =
          newestId;


        setChatMessages(
          rows
        );
      },
      [
        draft,
        activeTab,
        currentUserId,
      ]
    );


  useEffect(
    () => {
      if (
        !draft
      ) {
        return;
      }


      void loadDraftChat(
        false
      );


      const timer =
        window.setInterval(
          () => {
            void loadDraftChat(
              true
            );
          },
          1500
        );


      return () => {
        window.clearInterval(
          timer
        );
      };
    },
    [
      draft?.id,
      loadDraftChat,
    ]
  );


  useEffect(
    () => {
      if (
        !turnSoundsOn ||
        muted ||
        !isCurrentOwnerTurn ||
        !clock ||
        lastTurnAnnouncedRef.current ===
          clock.overallPick
      ) {
        return;
      }


      lastTurnAnnouncedRef.current =
        clock.overallPick;


      try {
        const synth =
          window.speechSynthesis;


        if (
          synth
        ) {
          synth.cancel();

          const utterance =
            new SpeechSynthesisUtterance(
              "Your turn"
            );


          utterance.rate =
            1.02;

          utterance.volume =
            0.9;

          synth.speak(
            utterance
          );
        }
      } catch {
        // Audio should never block drafting.
      }
    },
    [
      turnSoundsOn,
      muted,
      isCurrentOwnerTurn,
      clock,
    ]
  );


  async function openPlayerProfile(
    playerId: number
  ) {
    if (
      !draft
    ) {
      return;
    }


    setProfilePlayerId(
      playerId
    );

    setPlayerProfile(
      null
    );

    setProfileLoading(
      true
    );

    setError(
      null
    );


    const {
      data,
      error:
        profileError,
    } =
      await supabase.rpc(
        "get_traditional_draft_player_profile",
        {
          p_player_id:
            playerId,

          p_projection_season:
            draft.season,
        }
      );


    if (
      profileError
    ) {
      setError(
        profileError.message
      );
    } else {
      setPlayerProfile(
        data as DraftPlayerProfile
      );
    }


    setProfileLoading(
      false
    );
  }


  async function handleManualDraft(
    playerId?: number
  ) {
    if (
      !draft ||
      !isMyTurn ||
      currentSlot?.auto_pick ||
      working
    ) {
      return;
    }


    const targetPlayerId =
      playerId ??
      selectedPlayer?.id ??
      null;


    if (
      !targetPlayerId ||
      draftedPlayerIds.has(
        targetPlayerId
      )
    ) {
      return;
    }


    setWorking(
      true
    );

    setError(
      null
    );


    const {
      error:
        pickError,
    } =
      await supabase.rpc(
        "make_traditional_draft_pick",
        {
          p_draft_id:
            draft.id,

          p_player_id:
            targetPlayerId,

          p_pick_type:
            (
              isCommissioner &&
              currentTeam
                ?.owner_id !==
                currentUserId
            )
              ? "commissioner"
              : "manual",
        }
      );


    if (
      pickError
    ) {
      setError(
        pickError.message
      );
    } else {
      setSelectedPlayerId(
        null
      );

      setQueueIds(
        (current) =>
          current.filter(
            (id) =>
              id !==
              targetPlayerId
          )
      );

      await refreshLiveState(
        false
      );
    }


    setWorking(
      false
    );
  }


  async function undoLastPick() {
    if (
      !draft ||
      !isCommissioner ||
      working ||
      picks.length === 0
    ) {
      return;
    }

    const lastPick =
      picks[
        picks.length - 1
      ];

    const playerName =
      playerMap.get(
        lastPick.player_id
      )?.full_name ??
      `pick #${lastPick.overall_pick}`;

    const confirmed =
      window.confirm(
        `Undo ${playerName}? The draft will be paused at the restored pick.`
      );

    if (
      !confirmed
    ) {
      return;
    }

    setWorking(
      true
    );

    setError(
      null
    );

    const {
      error:
        undoError,
    } =
      await supabase.rpc(
        "undo_last_draft_pick",
        {
          p_draft_id:
            draft.id,
        }
      );

    if (
      undoError
    ) {
      setError(
        undoError.message
      );
    } else {
      await refreshLiveState(
        false
      );
    }

    setWorking(
      false
    );
  }


  function completeDraftAndOpenMyTeam() {
    if (
      !draft ||
      draft.status !==
        "completed"
    ) {
      return;
    }


    /*
     * Draft completion is owned by the database.
     *
     * make_traditional_draft_pick marks the draft completed on
     * the final scheduled selection, and the database completion
     * trigger initializes Week 1 and refreshes the first matchup.
     *
     * This button is navigation only so it can never duplicate
     * draft-completion or lineup-initialization work.
     */
    router.push(
      `/league/${leagueId}/team`
    );
  }


  async function toggleAutoPick() {
    if (
      !draft ||
      !mySlot ||
      mySlot.is_cpu
    ) {
      return;
    }


    setAutoPickWorking(
      true
    );

    setError(
      null
    );


    const next =
      !mySlot.auto_pick;


    const {
      error:
        autoPickError,
    } =
      await supabase.rpc(
        "set_traditional_draft_auto_pick",
        {
          p_draft_id:
            draft.id,

          p_enabled:
            next,
        }
      );


    if (
      autoPickError
    ) {
      setError(
        autoPickError.message
      );
    } else {
      await refreshLiveState(
        false
      );
    }


    setAutoPickWorking(
      false
    );
  }

  async function handleStartDraft() {
    if (
      !draft ||
      !isCommissioner
    ) {
      return;
    }


    setWorking(
      true
    );

    setError(
      null
    );


    const {
      error:
        startError,
    } =
      await supabase.rpc(
        "commissioner_start_traditional_draft",
        {
          p_league_id:
            leagueId,
        }
      );


    if (
      startError
    ) {
      setError(
        startError.message
      );
    } else {
      await refreshLiveState(
        false
      );
    }


    setWorking(
      false
    );
  }


  async function handlePauseResume() {
    if (
      !draft ||
      !isCommissioner
    ) {
      return;
    }


    setWorking(
      true
    );

    setError(
      null
    );


    const functionName =
      draft.is_paused
        ? "resume_traditional_draft"
        : "pause_traditional_draft";


    const {
      error:
        pauseError,
    } =
      await supabase.rpc(
        functionName,
        {
          p_draft_id:
            draft.id,
        }
      );


    if (
      pauseError
    ) {
      setError(
        pauseError.message
      );
    } else {
      await refreshLiveState(
        false
      );
    }


    setWorking(
      false
    );
  }




  async function sendDraftChatMessage(
    message: string
  ) {
    if (
      !draft ||
      !message.trim() ||
      chatSending
    ) {
      return;
    }


    setChatSending(
      true
    );

    setError(
      null
    );


    const {
      error:
        sendError,
    } =
      await supabase.rpc(
        "send_traditional_draft_chat_message",
        {
          p_draft_id:
            draft.id,

          p_message:
            message.trim(),
        }
      );


    if (
      sendError
    ) {
      setError(
        sendError.message
      );
    } else {
      await loadDraftChat(
        false
      );
    }


    setChatSending(
      false
    );
  }


  function toggleQueue(
    playerId: number
  ) {
    setQueueIds(
      (
        current
      ) =>
        current.includes(
          playerId
        )
          ? current.filter(
              (
                id
              ) =>
                id !==
                playerId
            )
          : [
              ...current,
              playerId,
            ]
    );
  }


  function moveQueuePlayer(
    playerId: number,
    direction:
      "up" |
      "down"
  ) {
    setQueueIds(
      (
        current
      ) => {
        const index =
          current.indexOf(
            playerId
          );


        if (
          index <
          0
        ) {
          return current;
        }


        const nextIndex =
          direction ===
            "up"
            ? index -
              1
            : index +
              1;


        if (
          nextIndex <
            0 ||
          nextIndex >=
            current.length
        ) {
          return current;
        }


        const next =
          [
            ...current,
          ];


        [
          next[
            index
          ],
          next[
            nextIndex
          ],
        ] = [
          next[
            nextIndex
          ],
          next[
            index
          ],
        ];


        return next;
      }
    );
  }


  const picksUntilMyNextPick =
    (() => {
      if (
        !draft ||
        !mySlot ||
        slots.length ===
          0
      ) {
        return null;
      }


      const teamCount =
        slots.length;


      const currentOverall =
        draft.current_overall_pick;


      const maxOverall =
        draft.total_rounds *
        teamCount;


      for (
        let overall =
          currentOverall +
          1;
        overall <=
        maxOverall;
        overall +=
          1
      ) {
        const round =
          Math.floor(
            (
              overall -
              1
            ) /
              teamCount
          ) +
          1;


        const pickInRound =
          (
            (
              overall -
              1
            ) %
              teamCount
          ) +
          1;


        const draftSlot =
          round %
            2 ===
          1
            ? pickInRound
            : teamCount -
              pickInRound +
              1;


        if (
          draftSlot ===
          mySlot.draft_slot
        ) {
          return overall -
            currentOverall;
        }
      }


      return null;
    })();


  if (
    loading
  ) {
    return (
      <main
        style={
          styles.page
        }
      >
        <div
          style={
            styles.loadingCard
          }
        >
          Loading Live Draft…
        </div>
      </main>
    );
  }


  if (
    !draft
  ) {
    return (
      <main
        style={
          styles.page
        }
      >
        <div
          style={
            styles.errorCard
          }
        >
          {error ??
            "Draft could not be loaded."}
        </div>
      </main>
    );
  }


  const teamCount =
    slots.length;


  const totalPicks =
    teamCount *
    draft.total_rounds;


  const progress =
    totalPicks >
    0
      ? Math.min(
          100,
          (
            picks.length /
            totalPicks
          ) *
            100
        )
      : 0;


  return (
    <main
      style={
        styles.page
      }
    >
      <style jsx global>{`
        .g365-available-player-scroll {
          scrollbar-width: auto;
          scrollbar-color: #ff6a18 #181b1f;
        }

        .g365-available-player-scroll::-webkit-scrollbar {
          width: 12px;
        }

        .g365-available-player-scroll::-webkit-scrollbar-track {
          background: #181b1f;
          border-left: 1px solid rgba(255,255,255,.05);
        }

        .g365-available-player-scroll::-webkit-scrollbar-thumb {
          background: linear-gradient(180deg,#b51c18,#ff6a18);
          border-radius: 999px;
          border: 3px solid #181b1f;
        }

        .g365-available-player-scroll::-webkit-scrollbar-thumb:hover {
          background: #ff7a24;
        }
      `}</style>
      <div
        style={
          styles.shell
        }
      >
        <header
          style={
            styles.topHeader
          }
        >
          <div
            style={
              styles.brandBlock
            }
          >
            <div
              style={
                styles.brandBadge
              }
            >
              G365
            </div>

            <div>
              <div
                style={
                  styles.brandTitle
                }
              >
                LIVE DRAFT
              </div>

              <div
                style={
                  styles.brandSub
                }
              >
                2026 • Snake Draft • {teamCount || 12} Teams
              </div>
            </div>
          </div>


          <div
            style={
              styles.headerStatus
            }
          >
            <span>
              ROUND{" "}
              <strong>
                {draft.current_round}
              </strong>
            </span>

            <span
              style={
                styles.dot
              }
            >
              •
            </span>

            <span>
              PICK{" "}
              <strong>
                {draft.current_overall_pick}
              </strong>
            </span>

            <span
              style={
                styles.dot
              }
            >
              •
            </span>

            <span
              style={{
                ...styles.statusPill,

                ...(draft.status ===
                "live"
                  ? styles.statusLive
                  : draft.status ===
                      "completed"
                    ? styles.statusComplete
                    : styles.statusScheduled),
              }}
            >
              {draft.is_paused
                ? "PAUSED"
                : draft.status.toUpperCase()}
            </span>
          </div>


          <div
            style={
              styles.headerActions
            }
          >
            {draft.status ===
              "scheduled" &&
            isCommissioner ? (
              <button
                type="button"
                onClick={
                  () => {
                    void handleStartDraft();
                  }
                }
                disabled={
                  working
                }
                style={
                  styles.primaryButton
                }
              >
                START DRAFT
              </button>
            ) : null}

            {isCommissioner &&
            draft.status ===
              "live" ? (
              <button
                type="button"
                onClick={
                  () => {
                    void handlePauseResume();
                  }
                }
                disabled={
                  working
                }
                style={
                  styles.secondaryButton
                }
              >
                {draft.is_paused
                  ? "▶ RESUME"
                  : "Ⅱ PAUSE"}
              </button>
            ) : null}

            {isCommissioner &&
            picks.length >
              0 ? (
              <button
                type="button"
                onClick={() => {
                  void undoLastPick();
                }}
                disabled={
                  working
                }
                style={
                  styles.undoButton
                }
                title="Undo the most recent draft pick and pause the draft"
              >
                ↶ UNDO LAST PICK
              </button>
            ) : null}


            {draft.status ===
            "completed" ? (
              <button
                type="button"
                onClick={
                  completeDraftAndOpenMyTeam
                }
                style={
                  styles.completeButton
                }
                title="Draft complete — open My Team"
              >
                ✓ DRAFT COMPLETE • GO TO MY TEAM
              </button>
            ) : null}
          </div>
        </header>


        {error ? (
          <div
            style={
              styles.errorStrip
            }
          >
            {error}
          </div>
        ) : null}


        {mySlot &&
        !mySlot.is_cpu &&
        mySlot.auto_pick ? (
          <div
            style={
              styles.autoPickNotice
            }
          >
            <div>
              <strong
                style={
                  styles.autoPickNoticeTitle
                }
              >
                YOUR TEAM IS ON AUTO-PICK
              </strong>

              <span
                style={
                  styles.autoPickNoticeText
                }
              >
                Your previous clock expired or you turned Auto-Pick on. Gridiron365 will make your picks automatically until you turn it off.
              </span>
            </div>

            <button
              type="button"
              disabled={
                autoPickWorking
              }
              onClick={
                () => {
                  void toggleAutoPick();
                }
              }
              style={{
                ...styles.autoPickNoticeButton,

                ...(autoPickWorking
                  ? styles.buttonDisabled
                  : {}),
              }}
            >
              {autoPickWorking
                ? "UPDATING..."
                : "TURN AUTO-PICK OFF"}
            </button>
          </div>
        ) : null}


        <section
          style={
            styles.draftTrain
          }
        >
          {upcomingPicks.map(
            (
              item
            ) => {
              const team =
                teamMap.get(
                  item.fantasyTeamId
                );


              const current =
                item.overallPick ===
                draft.current_overall_pick;

              const isMyDraftSlot =
                myTeamId !==
                  null &&
                item.fantasyTeamId ===
                  myTeamId;

              const slot =
                slots.find(
                  (
                    row
                  ) =>
                    row.draft_slot ===
                    item.draftSlot
                ) ??
                null;

              const ownerIsOnline =
                Boolean(
                  team
                    ?.owner_id &&
                  onlineUserIds.includes(
                    team.owner_id
                  )
                );

              const participationLabel =
                slot
                  ?.is_cpu
                  ? "CPU"
                  : slot
                      ?.auto_pick
                    ? "AUTO-PICK"
                    : ownerIsOnline
                      ? current
                        ? "ONLINE • PICKING"
                        : "ONLINE • MANUAL"
                      : "OFFLINE • MANUAL";


              return (
                <div
                  key={
                    item.overallPick
                  }
                  style={{
                    ...styles.trainCard,

                    ...(isMyDraftSlot
                      ? styles.trainCardCurrent
                      : {}),
                  }}
                >
                  <div
                    style={
                      styles.trainPickNumber
                    }
                  >
                    {item.overallPick}
                  </div>

                  <div
                    style={
                      styles.trainStatus
                    }
                  >
                    {isMyDraftSlot
                      ? "YOUR PICK"
                      : current
                        ? "ON THE CLOCK"
                        : "UP NEXT"}
                  </div>

                  <strong
                    style={
                      styles.trainTeamName
                    }
                  >
                    {team
                      ?.team_name ??
                      `Team ${item.draftSlot}`}
                  </strong>

                  <span
                    style={
                      styles.trainMeta
                    }
                  >
                    R{item.round} • S{item.draftSlot}
                  </span>

                  <span
                    style={{
                      ...styles.trainPresence,

                      ...(ownerIsOnline &&
                      !slot?.is_cpu &&
                      !slot?.auto_pick
                        ? styles.trainPresenceOnline
                        : {}),

                      ...(slot?.auto_pick
                        ? styles.trainPresenceAuto
                        : {}),
                    }}
                  >
                    {participationLabel}
                  </span>
                </div>
              );
            }
          )}
        </section>


        <section
          style={
            styles.mainGrid
          }
        >
          <aside
            style={
              styles.historySidebar
            }
          >
            <section
              style={
                styles.panel
              }
            >
              <div
                style={
                  styles.panelHeader
                }
              >
                DRAFT HISTORY
              </div>

              <DraftHistorySidebar
                draft={
                  draft
                }
                slots={
                  slots
                }
                picks={
                  picks
                }
                teamMap={
                  teamMap
                }
                playerMap={
                  playerMap
                }
              />
            </section>
          </aside>


          <section
            style={
              styles.workspace
            }
          >
            <div
              style={
                styles.workspaceHeader
              }
            >
              <div>
                <span
                  style={
                    styles.workspaceEyebrow
                  }
                >
                  DRAFT WORKSPACE
                </span>

                <div
                  style={
                    styles.workspaceSub
                  }
                >
                  {picks.length} of {totalPicks} picks completed
                </div>
              </div>

              <button
                type="button"
                onClick={
                  () =>
                    setCollapsedWorkspace(
                      (
                        value
                      ) =>
                        !value
                    )
                }
                style={
                  styles.collapseButton
                }
              >
                {collapsedWorkspace
                  ? "＋"
                  : "−"}
              </button>
            </div>


            {!collapsedWorkspace ? (
              <>
                <div
                  style={
                    styles.workspaceControlGrid
                  }
                >
                  <div
                    style={
                      styles.workspaceControlCard
                    }
                  >
                    <span
                      style={
                        styles.workspaceControlLabel
                      }
                    >
                      ON THE CLOCK
                    </span>

                    <div
                      style={
                        styles.workspaceClockRow
                      }
                    >
                      <div
                        style={
                          styles.workspaceClockTeam
                        }
                      >
                        <strong>
                          {currentTeam
                            ?.team_name ??
                            "Waiting"}
                        </strong>

                        <span>
                          Round {draft.current_round}
                          {" • "}
                          Pick {draft.current_overall_pick}
                        </span>
                      </div>

                      <strong
                        style={{
                          ...styles.workspaceClockValue,

                          ...(localSeconds <=
                          10
                            ? styles.clockUrgent
                            : {}),
                        }}
                      >
                        {formatClock(
                          localSeconds
                        )}
                      </strong>
                    </div>

                    <div
                      style={
                        styles.nextPickCountdown
                      }
                    >
                      <span>
                        YOUR NEXT PICK
                      </span>

                      <strong>
                        {isMyTurn
                          ? "YOU'RE UP"
                          : picksUntilMyNextPick ===
                              null
                            ? "DRAFT COMPLETE"
                            : picksUntilMyNextPick ===
                                1
                              ? "1 PICK AWAY"
                              : `${picksUntilMyNextPick} PICKS AWAY`}
                      </strong>
                    </div>

                    <div
                      style={
                        styles.workspaceControlFoot
                      }
                    >
                      {clock
                        ?.isCpu
                        ? `${draft.cpu_pick_seconds} SECONDS • CPU`
                        : `${draft.pick_timer_seconds} SECONDS • HUMAN`}
                    </div>
                  </div>


                  <div
                    style={
                      styles.workspaceControlCard
                    }
                  >
                    <span
                      style={
                        styles.workspaceControlLabel
                      }
                    >
                      PICK CONTROL
                    </span>

                    {selectedPlayer ? (
                      <div
                        style={
                          styles.workspaceSelectedPlayer
                        }
                      >
                        <PlayerAvatar
                          player={
                            selectedPlayer
                          }
                          size={
                            34
                          }
                        />

                        <div>
                          <strong>
                            {selectedPlayer.name}
                          </strong>

                          <span>
                            {selectedPlayer.position}
                            {" • "}
                            {selectedPlayer.team}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div
                        style={
                          styles.workspaceWaitingText
                        }
                      >
                        {isMyTurn
                          ? "Waiting for you to make your selection."
                          : currentTeam
                            ? `Waiting for ${currentTeam.team_name}.`
                            : "Waiting for the draft to begin."}
                      </div>
                    )}

                    <div
                      style={
                        styles.workspaceMode
                      }
                    >
                      {clock
                        ?.isCpu
                        ? "CPU"
                        : clock
                            ?.autoPick
                          ? "AUTO-PICK"
                          : "HUMAN"}
                    </div>
                  </div>


                  <div
                    style={
                      styles.workspaceControlCard
                    }
                  >
                    <span
                      style={
                        styles.workspaceControlLabel
                      }
                    >
                      AUTO PICK
                    </span>

                    <strong
                      style={
                        styles.settingTitle
                      }
                    >
                      My Auto-Pick
                    </strong>

                    <div
                      style={
                        styles.settingHelp
                      }
                    >
                      Uses My Rankings first, then default rankings.
                    </div>

                    <button
                      type="button"
                      disabled={
                        !mySlot ||
                        mySlot.is_cpu ||
                        autoPickWorking
                      }
                      onClick={
                        () => {
                          void toggleAutoPick();
                        }
                      }
                      style={{
                        ...styles.toggle,

                        ...(mySlot
                          ?.auto_pick
                          ? styles.toggleOn
                          : {}),
                      }}
                    >
                      <span
                        style={{
                          ...styles.toggleKnob,

                          ...(mySlot
                            ?.auto_pick
                            ? styles.toggleKnobOn
                            : {}),
                        }}
                      />

                      <span>
                        {mySlot
                          ?.auto_pick
                          ? "ON"
                          : "OFF"}
                      </span>
                    </button>
                  </div>


                  <div
                    style={
                      styles.workspaceControlCard
                    }
                  >
                    <span
                      style={
                        styles.workspaceControlLabel
                      }
                    >
                      AUDIO OPTIONS
                    </span>

                    <AudioOptionRow
                      label="Your Turn Voice"
                      enabled={
                        turnSoundsOn &&
                        !muted
                      }
                      onToggle={
                        () =>
                          setTurnSoundsOn(
                            (
                              value
                            ) =>
                              !value
                          )
                      }
                    />

                    <AudioOptionRow
                      label="Mute All"
                      enabled={
                        muted
                      }
                      onToggle={
                        () =>
                          setMuted(
                            (
                              value
                            ) =>
                              !value
                          )
                      }
                    />
                  </div>
                </div>


                <div
                  style={
                    styles.progressTrack
                  }
                >
                  <div
                    style={{
                      ...styles.progressFill,
                      width:
                        `${progress}%`,
                    }}
                  />
                </div>


                <div
                  style={
                    styles.tabs
                  }
                >
                  {[
                    [
                      "players",
                      "AVAILABLE PLAYERS",
                    ],
                    [
                      "queue",
                      `QUEUE (${queueIds.length})`,
                    ],
                    [
                      "rankings",
                      "MY RANKINGS",
                    ],
                    [
                      "board",
                      "DRAFT BOARD",
                    ],
                    [
                      "chat",
                      "CHAT",
                    ],
                  ].map(
                    (
                      [
                        key,
                        label,
                      ]
                    ) => (
                      <button
                        key={
                          key
                        }
                        type="button"
                        onClick={
                          () =>
                            setActiveTab(
                              key as WorkspaceTab
                            )
                        }
                        style={{
                          ...styles.tabButton,

                          ...(activeTab ===
                          key
                            ? styles.tabButtonActive
                            : {}),
                        }}
                      >
                        <span>
                          {label}
                        </span>

                        {key ===
                          "chat" &&
                        unreadChatCount >
                          0 ? (
                          <span
                            style={
                              styles.chatBadge
                            }
                          >
                            {unreadChatCount >
                            9
                              ? "9+"
                              : unreadChatCount}
                          </span>
                        ) : null}
                      </button>
                    )
                  )}
                </div>


                <div
                  style={{
                    ...styles.workspaceBody,

                    ...(activeTab ===
                    "board"
                      ? styles.workspaceBodyBoard
                      : {}),
                  }}
                >
                  {activeTab ===
                  "players" ? (
                    <PlayersPanel
                      players={
                        availablePlayers
                      }
                      selectedPlayerId={
                        selectedPlayerId
                      }
                      selectedPlayer={
                        selectedPlayer
                      }
                      queuedIds={
                        queueIds
                      }
                      canDraft={
                        canDraft
                      }
                      working={
                        working
                      }
                      search={
                        search
                      }
                      positionFilter={
                        positionFilter
                      }
                      teamFilter={
                        teamFilter
                      }
                      onSearch={
                        setSearch
                      }
                      onPositionFilter={
                        setPositionFilter
                      }
                      onTeamFilter={
                        setTeamFilter
                      }
                      onSelect={
                        setSelectedPlayerId
                      }
                      onQueue={
                        toggleQueue
                      }
                      onDraftPlayer={
                        () => {
                          void handleManualDraft();
                        }
                      }
                      onOpenProfile={
                        (
                          playerId
                        ) => {
                          void openPlayerProfile(
                            playerId
                          );
                        }
                      }
                      onOpenInjuryReport={
                        (playerId) => {
                          setInjuryReportPlayerId(
                            playerId
                          );
                        }
                      }
                    />
                  ) : null}


                  {activeTab ===
                  "queue" ? (
                    <QueuePanel
                      queueIds={
                        queueIds
                      }
                      playerViews={
                        playerViews
                      }
                      draftedPlayerIds={
                        draftedPlayerIds
                      }
                      selectedPlayerId={
                        selectedPlayerId
                      }
                      onSelect={
                        setSelectedPlayerId
                      }
                      onRemove={
                        toggleQueue
                      }
                      onMove={
                        moveQueuePlayer
                      }
                      canDraft={
                        isMyTurn &&
                        !currentSlot?.auto_pick &&
                        !working
                      }
                      working={
                        working
                      }
                      onDraft={(playerId) => {
                        void handleManualDraft(
                          playerId
                        );
                      }}
                    />
                  ) : null}


                  {activeTab ===
                  "rankings" ? (
                    <RankingsPanel
                      players={
                        playerViews
                      }
                      draftedPlayerIds={
                        draftedPlayerIds
                      }
                      selectedPlayerId={
                        selectedPlayerId
                      }
                      onSelect={
                        setSelectedPlayerId
                      }
                      canDraft={
                        isMyTurn &&
                        !currentSlot?.auto_pick &&
                        !working
                      }
                      working={
                        working
                      }
                      onDraft={(playerId) => {
                        void handleManualDraft(
                          playerId
                        );
                      }}
                      onOpenProfile={(playerId) => {
                        void openPlayerProfile(
                          playerId
                        );
                      }}
                    />
                  ) : null}


                  {activeTab ===
                  "board" ? (
                    <DraftBoardPanel
                      draft={
                        draft
                      }
                      slots={
                        slots
                      }
                      picks={
                        picks
                      }
                      teamMap={
                        teamMap
                      }
                      playerMap={
                        playerMap
                      }
                      myTeamId={
                        myTeamId
                      }
                    />
                  ) : null}


                  {activeTab ===
                  "chat" ? (
                    <DraftChatPanel
                      messages={
                        chatMessages
                      }
                      currentUserId={
                        currentUserId
                      }
                      teams={
                        teams
                      }
                      sending={
                        chatSending
                      }
                      onSend={
                        (
                          message
                        ) => {
                          void sendDraftChatMessage(
                            message
                          );
                        }
                      }
                    />
                  ) : null}
                </div>
              </>
            ) : null}
          </section>


          <aside
            style={
              styles.rightColumn
            }
          >
            <section
              style={
                styles.panel
              }
            >
              <div
                style={
                  styles.rosterPanelHeader
                }
              >
                <div>
                  <div
                    style={
                      styles.rosterPanelEyebrow
                    }
                  >
                    LEAGUE ROSTERS
                  </div>

                  <strong
                    style={
                      styles.rosterPanelTitle
                    }
                  >
                    {(
                      rosterTeamId ??
                      myTeamId
                    )
                      ? teamMap.get(
                          (
                            rosterTeamId ??
                            myTeamId
                          ) as number
                        )
                          ?.team_name ??
                        "Roster"
                      : "Roster"}
                  </strong>
                </div>

                <select
                  value={
                    rosterTeamId ??
                    myTeamId ??
                    ""
                  }
                  onChange={(
                    event
                  ) => {
                    const nextId =
                      Number(
                        event.target.value
                      );

                    if (
                      Number.isFinite(
                        nextId
                      ) &&
                      nextId >
                        0
                    ) {
                      setRosterTeamId(
                        nextId
                      );
                    }
                  }}
                  style={
                    styles.rosterSelect
                  }
                  aria-label="View league roster"
                >
                  {teams
                    .filter(
                      (
                        team
                      ) =>
                        team.active
                    )
                    .sort(
                      (
                        a,
                        b
                      ) =>
                        a.team_name.localeCompare(
                          b.team_name
                        )
                    )
                    .map(
                      (
                        team
                      ) => (
                        <option
                          key={
                            team.id
                          }
                          value={
                            team.id
                          }
                        >
                          {team.id ===
                          myTeamId
                            ? `${team.team_name} (My Team)`
                            : team.team_name}
                        </option>
                      )
                    )}
                </select>
              </div>

              <MyRosterPanel
                teamName={
                  (
                    rosterTeamId ??
                    myTeamId
                  )
                    ? teamMap.get(
                        (
                          rosterTeamId ??
                          myTeamId
                        ) as number
                      )
                        ?.team_name ??
                      "Roster"
                    : "Roster"
                }
                picks={
                  picks.filter(
                    (
                      pick
                    ) =>
                      pick.fantasy_team_id ===
                      (
                        rosterTeamId ??
                        myTeamId
                      )
                  )
                }
                playerMap={
                  playerMap
                }
                settings={
                  rosterSettings
                }
                byeWeekByTeam={
                  byeWeekByTeam
                }
              />
            </section>
          </aside>
        </section>


        {injuryReportPlayer ? (
          <InjuryReportModal
            player={
              injuryReportPlayer
            }
            onClose={() => {
              setInjuryReportPlayerId(
                null
              );
            }}
          />
        ) : null}


        {profilePlayerId ? (
          <PlayerProfileModal
            player={
              profilePlayer
            }
            profile={
              playerProfile
            }
            loading={
              profileLoading
            }
            projection={
              profilePlayer
                ? projectionMap.get(profilePlayer.id) ?? null
                : null
            }
            onClose={
              () => {
                setProfilePlayerId(
                  null
                );

                setPlayerProfile(
                  null
                );
              }
            }
          />
        ) : null}
      </div>
    </main>
  );
}


function PlayerAvatar({
  player,
  size = 34,
}: {
  player: {
    name: string;

    headshot:
      string |
      null;
  };

  size?: number;
}) {
  if (
    player.headshot
  ) {
    return (
      <img
        src={
          player.headshot
        }
        alt=""
        style={{
          width:
            size,

          height:
            size,

          borderRadius:
            "50%",

          objectFit:
            "cover",

          background:
            "#25282d",
        }}
      />
    );
  }


  return (
    <div
      style={{
        width:
          size,

        height:
          size,

        display:
          "flex",

        alignItems:
          "center",

        justifyContent:
          "center",

        flex:
          "0 0 auto",

        borderRadius:
          "50%",

        background:
          "linear-gradient(135deg,#2c2f34,#181a1e)",

        color:
          "#ff7a1b",

        fontSize:
          Math.max(
            8,
            size *
              0.28
          ),

        fontWeight:
          950,
      }}
    >
      {player.name
        .slice(
          0,
          1
        )
        .toUpperCase()}
    </div>
  );
}



function AudioOptionRow({
  label,
  enabled,
  onToggle,
}: {
  label: string;

  enabled:
    boolean;

  onToggle:
    () => void;
}) {
  return (
    <div
      style={
        styles.audioOptionRow
      }
    >
      <span>
        {label}
      </span>

      <button
        type="button"
        onClick={
          onToggle
        }
        style={{
          ...styles.miniToggle,

          ...(enabled
            ? styles.miniToggleOn
            : {}),
        }}
      >
        <span>
          {enabled
            ? "ON"
            : "OFF"}
        </span>

        <i
          style={{
            ...styles.miniToggleDot,

            ...(enabled
              ? styles.miniToggleDotOn
              : {}),
          }}
        />
      </button>
    </div>
  );
}


function DraftHistorySidebar({
  draft,
  slots,
  picks,
  teamMap,
  playerMap,
}: {
  draft:
    DraftRow;

  slots:
    DraftSlotRow[];

  picks:
    DraftPickRow[];

  teamMap:
    Map<
      number,
      FantasyTeamRow
    >;

  playerMap:
    Map<
      number,
      PlayerRow
    >;
}) {
  const teamCount =
    slots.length;


  const round =
    Math.max(
      1,
      draft.current_round
    );


  const rows =
    Array.from(
      {
        length:
          teamCount,
      },
      (
        _,
        index
      ) => {
        const pickInRound =
          index +
          1;


        const draftSlot =
          round %
            2 ===
          1
            ? pickInRound
            : teamCount -
              pickInRound +
              1;


        const slot =
          slots.find(
            (
              row
            ) =>
              row.draft_slot ===
              draftSlot
          );


        const overallPick =
          (
            round -
            1
          ) *
            teamCount +
          pickInRound;


        const pick =
          picks.find(
            (
              row
            ) =>
              row.overall_pick ===
              overallPick
          );


        return {
          overallPick,
          round,
          pickInRound,
          slot,
          pick,
        };
      }
    );


  return (
    <div
      style={
        styles.historySidebarBody
      }
    >
      <div
        style={
          styles.historyRoundLabel
        }
      >
        ROUND {round}
      </div>

      <div
        style={
          styles.historySidebarRows
        }
      >
        {rows.map(
          (
            row
          ) => {
            const team =
              row.slot
                ? teamMap.get(
                    row.slot
                      .fantasy_team_id
                  )
                : null;


            const player =
              row.pick
                ? playerMap.get(
                    row.pick
                      .player_id
                  )
                : null;


            const current =
              row.overallPick ===
              draft.current_overall_pick &&
              draft.status ===
                "live";


            return (
              <div
                key={
                  row.overallPick
                }
                style={{
                  ...styles.historySidebarRow,

                  ...(current
                    ? styles.historySidebarRowCurrent
                    : {}),
                }}
              >
                <span
                  style={
                    styles.historySidebarPick
                  }
                >
                  {row.overallPick}
                </span>

                {player ? (
                  <PlayerAvatar
                    player={{
                      name:
                        player.full_name,

                      headshot:
                        player.headshot_url,
                    }}
                    size={
                      34
                    }
                  />
                ) : (
                  <div
                    style={
                      styles.historyEmptyAvatar
                    }
                  >
                    {team
                      ?.team_name
                      ?.slice(
                        0,
                        1
                      )
                      .toUpperCase() ??
                      "T"}
                  </div>
                )}

                <div
                  style={
                    styles.historySidebarText
                  }
                >
                  <span>
                    {team
                      ?.team_name ??
                      "TBD"}
                  </span>

                  <strong>
                    {player
                      ?.full_name ??
                      (current
                        ? "ON THE CLOCK"
                        : "--")}
                  </strong>

                  <small>
                    R{row.round} • P{row.pickInRound}
                    {" • "}
                    {player
                      ? `${player.primary_position} • ${player.team_abbreviation ?? "FA"}`
                      : `Slot ${row.slot?.draft_slot ?? "-"}`}
                  </small>
                </div>
              </div>
            );
          }
        )}
      </div>
    </div>
  );
}


function MyRosterPanel({
  teamName,
  picks,
  playerMap,
  settings,
  byeWeekByTeam,
}: {
  teamName:
    string;

  picks:
    DraftPickRow[];

  playerMap:
    Map<
      number,
      PlayerRow
    >;

  settings:
    RosterSettingRow |
    null;

  byeWeekByTeam:
    Record<
      string,
      number |
      null
    >;
}) {
  const drafted =
    [...picks]
      .sort(
        (
          a,
          b
        ) =>
          a.overall_pick -
          b.overall_pick
      )
      .map(
        (
          pick
        ) => ({
          pick,

          player:
            playerMap.get(
              pick.player_id
            ) ??
            null,
        })
      );


  const counts =
    {
      QB:
        drafted.filter(
          (
            row
          ) =>
            row.player
              ?.primary_position ===
            "QB"
        ).length,

      RB:
        drafted.filter(
          (
            row
          ) =>
            row.player
              ?.primary_position ===
            "RB"
        ).length,

      WR:
        drafted.filter(
          (
            row
          ) =>
            row.player
              ?.primary_position ===
            "WR"
        ).length,

      TE:
        drafted.filter(
          (
            row
          ) =>
            row.player
              ?.primary_position ===
            "TE"
        ).length,

      K:
        drafted.filter(
          (
            row
          ) =>
            row.player
              ?.primary_position ===
            "K"
        ).length,

      DST:
        drafted.filter(
          (
            row
          ) =>
            row.player
              ?.primary_position ===
            "DST"
        ).length,
    };


  const remaining =
    drafted.map(
      (
        row
      ) => ({
        ...row,

        used:
          false,
      })
    );


  function takePosition(
    position:
      string
  ) {
    const match =
      remaining.find(
        (
          row
        ) =>
          !row.used &&
          row.player
            ?.primary_position ===
            position
      );


    if (
      match
    ) {
      match.used =
        true;
    }


    return match ??
      null;
  }


  function takeEligible(
    positions:
      string[]
  ) {
    const match =
      remaining.find(
        (
          row
        ) =>
          !row.used &&
          Boolean(
            row.player &&
            positions.includes(
              row.player
                .primary_position
            )
          )
      );


    if (
      match
    ) {
      match.used =
        true;
    }


    return match ??
      null;
  }


  const rosterRows:
    Array<{
      slot: string;

      player:
        PlayerRow |
        null;
    }> =
      [];


  function addSlots(
    slot:
      string,
    count:
      number,
    position:
      string
  ) {
    for (
      let i =
        0;
      i <
      count;
      i +=
      1
    ) {
      rosterRows.push({
        slot,

        player:
          takePosition(
            position
          )
            ?.player ??
          null,
      });
    }
  }


  addSlots(
    "QB",
    settings
      ?.starting_qb ??
      1,
    "QB"
  );

  addSlots(
    "RB",
    settings
      ?.starting_rb ??
      2,
    "RB"
  );

  addSlots(
    "WR",
    settings
      ?.starting_wr ??
      2,
    "WR"
  );

  addSlots(
    "TE",
    settings
      ?.starting_te ??
      1,
    "TE"
  );


  for (
    let i =
      0;
    i <
    (
      settings
        ?.starting_flex ??
      0
    );
    i +=
    1
  ) {
    rosterRows.push({
      slot:
        "FLEX",

      player:
        takeEligible(
          [
            "RB",
            "WR",
            "TE",
          ]
        )
          ?.player ??
        null,
    });
  }


  for (
    let i =
      0;
    i <
    (
      settings
        ?.starting_superflex ??
      0
    );
    i +=
    1
  ) {
    rosterRows.push({
      slot:
        "SFLEX",

      player:
        takeEligible(
          [
            "QB",
            "RB",
            "WR",
            "TE",
          ]
        )
          ?.player ??
        null,
    });
  }


  addSlots(
    "K",
    settings
      ?.starting_k ??
      1,
    "K"
  );

  addSlots(
    "DST",
    settings
      ?.starting_dst ??
      1,
    "DST"
  );


  for (
    let i =
      0;
    i <
    (
      settings
        ?.bench_slots ??
      6
    );
    i +=
    1
  ) {
    rosterRows.push({
      slot:
        "BN",

      player:
        takeEligible(
          [
            "QB",
            "RB",
            "WR",
            "TE",
            "K",
            "DST",
          ]
        )
          ?.player ??
        null,
    });
  }


  const totalSlots =
    rosterRows.length;


  return (
    <div
      style={
        styles.myRosterPanel
      }
    >
      <div
        style={
          styles.myRosterTeam
        }
      >
        <strong>
          {teamName}
        </strong>

        <span>
          {picks.length} / {totalSlots} PLAYERS
        </span>
      </div>


      <div
        style={
          styles.rosterCountGrid
        }
      >
        {(
          [
            "QB",
            "RB",
            "WR",
            "TE",
            "K",
            "DST",
          ] as const
        ).map(
          (
            position
          ) => (
            <div
              key={
                position
              }
              style={
                styles.rosterCountChip
              }
            >
              <span>
                {position}
              </span>

              <strong>
                {counts[
                  position
                ]}
              </strong>
            </div>
          )
        )}
      </div>


      <div
        style={
          styles.rosterPlayerHeader
        }
      >
        <span>
          POS
        </span>

        <span>
          PLAYER
        </span>

        <span>
          BYE
        </span>
      </div>


      <div
        style={
          styles.rosterPlayerRows
        }
      >
        {rosterRows.map(
          (
            row,
            index
          ) => (
            <div
              key={
                `${row.slot}-${index}`
              }
              style={
                styles.rosterPlayerRow
              }
            >
              <span
                style={
                  styles.rosterSlot
                }
              >
                {row.slot}
              </span>

              <div
                style={
                  styles.rosterPlayerIdentity
                }
              >
                {row.player ? (
                  <>
                    <PlayerAvatar
                      player={{
                        name:
                          row.player
                            .full_name,

                        headshot:
                          row.player
                            .headshot_url,
                      }}
                      size={
                        27
                      }
                    />

                    <strong>
                      {compactName(
                        row.player
                          .full_name
                      )}
                    </strong>
                  </>
                ) : (
                  <span
                    style={
                      styles.rosterEmptyPlayer
                    }
                  >
                    --
                  </span>
                )}
              </div>

              <span
                style={
                  styles.rosterBye
                }
              >
                {row.player
                  ?.team_abbreviation
                  ? byeWeekByTeam[
                      row.player
                        .team_abbreviation
                    ] ??
                    "—"
                  : "—"}
              </span>
            </div>
          )
        )}
      </div>
    </div>
  );
}


function DraftChatPanel({
  messages,
  currentUserId,
  teams,
  sending,
  onSend,
}: {
  messages:
    DraftChatMessageRow[];

  currentUserId:
    string |
    null;

  teams:
    FantasyTeamRow[];

  sending:
    boolean;

  onSend:
    (
      message: string
    ) => void;
}) {
  const [
    value,
    setValue,
  ] =
    useState(
      ""
    );


  const scrollRef =
    useRef<
      HTMLDivElement |
      null
    >(
      null
    );


  const ownerTeamMap =
    useMemo(
      () =>
        new Map(
          teams
            .filter(
              (
                team
              ) =>
                Boolean(
                  team.owner_id
                )
            )
            .map(
              (
                team
              ) => [
                team.owner_id!,
                team.team_name,
              ] as const
            )
        ),
      [
        teams,
      ]
    );


  useEffect(
    () => {
      const node =
        scrollRef.current;


      if (
        node
      ) {
        node.scrollTop =
          node.scrollHeight;
      }
    },
    [
      messages,
    ]
  );


  function submit() {
    const message =
      value.trim();


    if (
      !message ||
      sending
    ) {
      return;
    }


    onSend(
      message
    );

    setValue(
      ""
    );
  }


  return (
    <div
      style={
        styles.chatPanel
      }
    >
      <div
        ref={
          scrollRef
        }
        style={
          styles.chatMessages
        }
      >
        {messages.map(
          (
            message
          ) => {
            const mine =
              message.user_id ===
              currentUserId;


            const name =
              ownerTeamMap.get(
                message.user_id
              ) ??
              "League Member";


            return (
              <div
                key={
                  message.id
                }
                style={{
                  ...styles.chatMessageRow,

                  ...(mine
                    ? styles.chatMessageRowMine
                    : {}),
                }}
              >
                <div
                  style={
                    styles.chatMessageMeta
                  }
                >
                  <strong>
                    {mine
                      ? "YOU"
                      : name}
                  </strong>

                  <span>
                    {new Date(
                      message.created_at
                    ).toLocaleTimeString(
                      [],
                      {
                        hour:
                          "numeric",
                        minute:
                          "2-digit",
                      }
                    )}
                  </span>
                </div>

                <div
                  style={
                    styles.chatBubble
                  }
                >
                  {message.message}
                </div>
              </div>
            );
          }
        )}


        {messages.length ===
        0 ? (
          <div
            style={
              styles.emptyBody
            }
          >
            No messages yet. Start the draft chat.
          </div>
        ) : null}
      </div>


      <div
        style={
          styles.chatComposer
        }
      >
        <input
          value={
            value
          }
          onChange={
            (
              event
            ) =>
              setValue(
                event.target
                  .value
              )
          }
          onKeyDown={
            (
              event
            ) => {
              if (
                event.key ===
                "Enter"
              ) {
                event.preventDefault();

                submit();
              }
            }
          }
          maxLength={
            500
          }
          placeholder="Message the league..."
          style={
            styles.chatInput
          }
        />

        <button
          type="button"
          disabled={
            !value.trim() ||
            sending
          }
          onClick={
            submit
          }
          style={{
            ...styles.chatSendButton,

            ...(
              !value.trim() ||
              sending
                ? styles.buttonDisabled
                : {}
            ),
          }}
        >
          {sending
            ? "SENDING…"
            : "SEND"}
        </button>
      </div>
    </div>
  );
}

function PlayersPanel({
  players,
  selectedPlayerId,
  selectedPlayer,
  queuedIds,
  canDraft,
  working,
  search,
  positionFilter,
  teamFilter,
  onSearch,
  onPositionFilter,
  onTeamFilter,
  onSelect,
  onQueue,
  onDraftPlayer,
  onOpenProfile,
  onOpenInjuryReport,
}: {
  players:
    PlayerView[];

  selectedPlayerId:
    number |
    null;

  selectedPlayer:
    PlayerView |
    null;

  queuedIds:
    number[];

  canDraft:
    boolean;

  working:
    boolean;

  search: string;

  positionFilter:
    string;

  teamFilter:
    string;

  onSearch:
    (
      value: string
    ) => void;

  onPositionFilter:
    (
      value: string
    ) => void;

  onTeamFilter:
    (
      value: string
    ) => void;

  onSelect:
    (
      id: number
    ) => void;

  onQueue:
    (
      id: number
    ) => void;

  onDraftPlayer:
    () => void;

  onOpenProfile:
    (
      playerId: number
    ) => void;

  onOpenInjuryReport:
    (
      playerId: number
    ) => void;
}) {
  const teams =
    Array.from(
      new Set(
        players.map(
          (
            player
          ) =>
            player.team
        )
      )
    ).sort();


  return (
    <div
      style={
        styles.playerPanel
      }
    >
      <div
        style={
          styles.filters
        }
      >
        <input
          value={
            search
          }
          onChange={
            (
              event
            ) =>
              onSearch(
                event.target
                  .value
              )
          }
          placeholder="Search players..."
          style={
            styles.searchInput
          }
        />

        <select
          value={
            positionFilter
          }
          onChange={
            (
              event
            ) =>
              onPositionFilter(
                event.target
                  .value
              )
          }
          style={
            styles.filterSelect
          }
        >
          <option
            value="ALL"
          >
            All Positions
          </option>

          {[
            "QB",
            "RB",
            "WR",
            "TE",
            "K",
            "DST",
          ].map(
            (
              position
            ) => (
              <option
                key={
                  position
                }
                value={
                  position
                }
              >
                {position}
              </option>
            )
          )}
        </select>

        <select
          value={
            teamFilter
          }
          onChange={
            (
              event
            ) =>
              onTeamFilter(
                event.target
                  .value
              )
          }
          style={
            styles.filterSelect
          }
        >
          <option
            value="ALL"
          >
            All Teams
          </option>

          {teams.map(
            (
              team
            ) => (
              <option
                key={
                  team
                }
                value={
                  team
                }
              >
                {team}
              </option>
            )
          )}
        </select>

        <div
          style={
            styles.showing
          }
        >
          Showing {players.length} available players
        </div>
      </div>


      <div
        style={
          styles.availableDraftActionBar
        }
      >
        <div
          style={
            styles.availableDraftSelection
          }
        >
          <span>
            SELECTED PLAYER
          </span>

          <strong>
            {selectedPlayer
              ? `${compactName(selectedPlayer.name)} • ${selectedPlayer.position} • ${selectedPlayer.team}`
              : "Choose a player below"}
          </strong>
        </div>

        <button
          type="button"
          disabled={
            !canDraft
          }
          onClick={
            onDraftPlayer
          }
          style={{
            ...styles.availableDraftButton,

            ...(!canDraft
              ? styles.buttonDisabled
              : {}),
          }}
        >
          {working
            ? "DRAFTING…"
            : selectedPlayer
              ? `DRAFT ${compactName(selectedPlayer.name).toUpperCase()}`
              : "DRAFT PLAYER"}
        </button>
      </div>


      <div
        style={
          styles.playerTableHeader
        }
      >
        <span>
          RANK
        </span>

        <span>
          PLAYER
        </span>

        <span>
          POS
        </span>

        <span>
          TEAM
        </span>

        <span>
          BYE
        </span>

        <span>
          INJ
        </span>

        <span>
          PROJ
        </span>

        <span>
          QUEUE
        </span>
      </div>


      <div
        className="g365-available-player-scroll"
        style={
          styles.playerRows
        }
      >
        {players
          .slice(
            0,
            350
          )
          .map(
            (
              player
            ) => {
              const selected =
                selectedPlayerId ===
                player.id;


              const queued =
                queuedIds.includes(
                  player.id
                );


              return (
                <div
                  key={
                    player.id
                  }
                  role="button"
                  tabIndex={
                    0
                  }
                  onClick={
                    () =>
                      onSelect(
                        player.id
                      )
                  }
                  style={{
                    ...styles.playerRow,

                    ...(selected
                      ? styles.playerRowSelected
                      : {}),
                  }}
                >
                  <span
                    style={
                      styles.rankNumber
                    }
                  >
                    {player.defaultRank <
                    99999
                      ? player.defaultRank
                      : "—"}
                  </span>

                  <div
                    style={
                      styles.playerIdentity
                    }
                  >
                    <PlayerAvatar
                      player={
                        player
                      }
                    />

                    <div
                      style={
                        styles.playerIdentityText
                      }
                    >
                      <button
                        type="button"
                        onClick={
                          (
                            event
                          ) => {
                            event.stopPropagation();

                            onOpenProfile(
                              player.id
                            );
                          }
                        }
                        style={
                          styles.playerNameButton
                        }
                        title={`View ${player.name} stats`}
                      >
                        {player.name}
                      </button>

                      <span>
                        {player.myRank
                          ? `My Rank #${player.myRank}`
                          : canDraft
                            ? "Available"
                            : "Available player"}
                      </span>
                    </div>
                  </div>

                  <span
                    style={{
                      ...styles.positionBadge,
                      ...positionBadgeStyle(
                        player.position
                      ),
                    }}
                  >
                    {player.position}
                  </span>

                  <span
                    style={
                      styles.teamText
                    }
                  >
                    {player.team}
                  </span>

                  <span
                    style={
                      styles.byeWeekText
                    }
                  >
                    {player.byeWeek ??
                      "—"}
                  </span>

                  <InjuryBadge
                    status={
                      player.injuryStatus
                    }
                    onClick={
                      getInjuryDisplay(
                        player.injuryStatus
                      )
                        ? () =>
                            onOpenInjuryReport(
                              player.id
                            )
                        : undefined
                    }
                  />

                  <span
                    style={
                      styles.projectionText
                    }
                  >
                    {player.projectedPoints ??
                      "—"}
                  </span>

                  <button
                    type="button"
                    onClick={
                      (
                        event
                      ) => {
                        event.stopPropagation();

                        onQueue(
                          player.id
                        );
                      }
                    }
                    style={{
                      ...styles.queueButton,

                      ...(queued
                        ? styles.queueButtonActive
                        : {}),
                    }}
                  >
                    {queued
                      ? "✓"
                      : "+"}
                  </button>
                </div>
              );
            }
          )}
      </div>


    </div>
  );
}


function InjuryReportModal({
  player,
  onClose,
}: {
  player:
    PlayerView;

  onClose:
    () => void;
}) {
  const injury =
    getInjuryDisplay(
      player.injuryStatus
    );

  if (
    !injury
  ) {
    return null;
  }

  return (
    <div
      style={
        styles.injuryReportOverlay
      }
      onMouseDown={
        onClose
      }
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={`${player.name} injury report`}
        style={
          styles.injuryReportModal
        }
        onMouseDown={(event) =>
          event.stopPropagation()
        }
      >
        <div
          style={
            styles.injuryReportHeader
          }
        >
          <div>
            <span
              style={
                styles.injuryReportEyebrow
              }
            >
              INJURY REPORT
            </span>

            <strong
              style={
                styles.injuryReportName
              }
            >
              {player.name}
            </strong>

            <span
              style={
                styles.injuryReportMeta
              }
            >
              {player.position} • {player.team}
            </span>
          </div>

          <button
            type="button"
            onClick={
              onClose
            }
            style={
              styles.injuryReportClose
            }
            aria-label="Close injury report"
          >
            ×
          </button>
        </div>

        <div
          style={
            styles.injuryReportBody
          }
        >
          <div
            style={
              styles.injuryReportStatusRow
            }
          >
            <span
              style={
                styles.injuryBadge
              }
            >
              {injury.code}
            </span>

            <div
              style={
                styles.injuryReportStatusText
              }
            >
              <strong>
                {injury.label}
              </strong>
              <span>
                Current designation
              </span>
            </div>
          </div>

          <div
            style={
              styles.injuryReportGrid
            }
          >
            <div>
              <span>TYPE</span>
              <strong>
                {player.injuryType ?? injury.label}
              </strong>
            </div>
            <div>
              <span>LOCATION</span>
              <strong>
                {player.injuryLocation ?? "—"}
              </strong>
            </div>
            <div>
              <span>INJURY DATE</span>
              <strong>
                {player.injuryDate ?? "—"}
              </strong>
            </div>
            <div>
              <span>RETURN DATE</span>
              <strong>
                {player.injuryReturnDate ?? "—"}
              </strong>
            </div>
          </div>

          <div
            style={
              styles.injuryReportDetail
            }
          >
            <span>REPORT</span>
            <p>
              {player.injuryDetail ??
                "No additional injury report details are currently available."}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}


function PlayerProfileModal({
  player,
  profile,
  loading,
  projection,
  onClose,
}: {
  player:
    PlayerView |
    null;

  profile:
    DraftPlayerProfile |
    null;

  loading:
    boolean;

  projection:
    ProjectionRow |
    null;

  onClose:
    () => void;
}) {
  if (
    !player
  ) {
    return null;
  }


  const actual =
    profile
      ?.actual ??
    null;


  const position =
    player.position;


  const statRows:
    Array<[
      string,
      string |
      number
    ]> =
      [];


  const projectedStatRows:
    Array<[
      string,
      string | number
    ]> =
      [];


  const projectedValue = (
    value: number | string | null | undefined
  ) => {
    const numeric = numberValue(value);
    return numeric.toFixed(1);
  };


  if (projection) {
    if (position === "QB") {
      projectedStatRows.push(
        ["PASS ATT", projectedValue(projection.passing_attempts)],
        ["COMPLETIONS", projectedValue(projection.passing_completions)],
        ["PASS YARDS", projectedValue(projection.passing_yards)],
        ["PASS TD", projectedValue(projection.passing_touchdowns)],
        ["INT", projectedValue(projection.passing_interceptions)],
        ["CARRIES", projectedValue(projection.rushing_attempts)],
        ["RUSH YARDS", projectedValue(projection.rushing_yards)],
        ["RUSH TD", projectedValue(projection.rushing_touchdowns)]
      );
    } else if (["RB", "WR", "TE"].includes(position)) {
      projectedStatRows.push(
        ["CARRIES", projectedValue(projection.rushing_attempts)],
        ["RUSH YARDS", projectedValue(projection.rushing_yards)],
        ["RUSH TD", projectedValue(projection.rushing_touchdowns)],
        ["TARGETS", projectedValue(projection.receiving_targets)],
        ["RECEPTIONS", projectedValue(projection.receptions)],
        ["REC YARDS", projectedValue(projection.receiving_yards)],
        ["REC TD", projectedValue(projection.receiving_touchdowns)]
      );
    } else if (position === "K") {
      projectedStatRows.push(
        ["FG MADE", projectedValue(projection.field_goals_made)],
        ["FG ATT", projectedValue(projection.field_goals_attempted)],
        ["XP MADE", projectedValue(projection.extra_points_made)],
        ["XP ATT", projectedValue(projection.extra_points_attempted)]
      );
    }
  }


  if (
    actual
  ) {
    if (
      position ===
        "QB"
    ) {
      statRows.push(
        [
          "Games",
          actual.gamesPlayed,
        ],
        [
          "Comp / Att",
          `${actual.passingCompletions} / ${actual.passingAttempts}`,
        ],
        [
          "Pass Yards",
          actual.passingYards,
        ],
        [
          "Pass TD",
          actual.passingTouchdowns,
        ],
        [
          "INT",
          actual.passingInterceptions,
        ],
        [
          "Rush Att",
          actual.rushingAttempts,
        ],
        [
          "Rush Yards",
          actual.rushingYards,
        ],
        [
          "Rush TD",
          actual.rushingTouchdowns,
        ]
      );
    } else if (
      [
        "RB",
        "WR",
        "TE",
      ].includes(
        position
      )
    ) {
      statRows.push(
        [
          "Games",
          actual.gamesPlayed,
        ],
        [
          "Carries",
          actual.rushingAttempts,
        ],
        [
          "Rush Yards",
          actual.rushingYards,
        ],
        [
          "Rush TD",
          actual.rushingTouchdowns,
        ],
        [
          "Targets",
          actual.receivingTargets,
        ],
        [
          "Receptions",
          actual.receptions,
        ],
        [
          "Rec Yards",
          actual.receivingYards,
        ],
        [
          "Rec TD",
          actual.receivingTouchdowns,
        ]
      );
    } else if (
      position ===
        "K"
    ) {
      statRows.push(
        [
          "Games",
          actual.gamesPlayed,
        ],
        [
          "FG Made",
          actual.fieldGoalsMade,
        ],
        [
          "FG Att",
          actual.fieldGoalsAttempted,
        ],
        [
          "XP Made",
          actual.extraPointsMade,
        ],
        [
          "XP Att",
          actual.extraPointsAttempted,
        ]
      );
    } else if (
      position ===
        "DST"
    ) {
      statRows.push(
        [
          "Games",
          actual.gamesPlayed,
        ],
        [
          "Sacks",
          actual.dstSacks,
        ],
        [
          "INT",
          actual.dstInterceptions,
        ],
        [
          "Fumble Rec",
          actual.dstFumbleRecoveries,
        ],
        [
          "TD",
          actual.dstTouchdowns,
        ],
        [
          "Safeties",
          actual.dstSafeties,
        ],
        [
          "Blocked Kicks",
          actual.dstBlockedKicks,
        ],
        [
          "Pts Allowed",
          actual.dstPointsAllowed,
        ]
      );
    }
  }


  return (
    <div
      style={
        styles.profileOverlay
      }
      onMouseDown={
        onClose
      }
    >
      <div
        style={
          styles.profileModal
        }
        onMouseDown={
          (
            event
          ) =>
            event.stopPropagation()
        }
      >
        <div
          style={
            styles.profileHeader
          }
        >
          <div
            style={
              styles.profileIdentity
            }
          >
            <PlayerAvatar
              player={
                player
              }
              size={
                58
              }
            />

            <div>
              <strong
                style={
                  styles.profileName
                }
              >
                {player.name}
              </strong>

              <div
                style={
                  styles.profileMeta
                }
              >
                {player.position}
                {" • "}
                {player.team}
                {" • "}
                BYE {player.byeWeek ?? "—"}
              </div>

              <div
                style={
                  styles.profileInjuryLine
                }
              >
                <span>
                  Injury:
                </span>

                <InjuryBadge
                  status={
                    player.injuryStatus
                  }
                />
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={
              onClose
            }
            style={
              styles.profileClose
            }
          >
            ×
          </button>
        </div>


        {loading ? (
          <div
            style={
              styles.profileLoading
            }
          >
            Loading player stats…
          </div>
        ) : (
          <div
            style={
              styles.profileContent
            }
          >
            <section
              style={
                styles.profileSection
              }
            >
              <div
                style={
                  styles.profileSectionHeader
                }
              >
                {profile?.lastSeason ?? "LAST"} ACTUAL STATS
              </div>

              <div
                style={
                  styles.profileStatsGrid
                }
              >
                {statRows.length >
                0 ? (
                  statRows.map(
                    (
                      [
                        label,
                        value,
                      ]
                    ) => (
                      <div
                        key={
                          label
                        }
                        style={
                          styles.profileStatCard
                        }
                      >
                        <span>
                          {label}
                        </span>

                        <strong>
                          {value}
                        </strong>
                      </div>
                    )
                  )
                ) : (
                  <div
                    style={
                      styles.profileNoStats
                    }
                  >
                    No completed regular-season stats are stored for this player.
                  </div>
                )}
              </div>
            </section>


            <section
              style={
                styles.profileSection
              }
            >
              <div
                style={
                  styles.profileSectionHeader
                }
              >
                {profile?.projectionSeason ?? "CURRENT"} PROJECTED STATS
              </div>

              <div
                style={
                  styles.profileStatsGrid
                }
              >
                {projectedStatRows.length > 0 ? (
                  projectedStatRows.map(([label, value]) => (
                    <div
                      key={label}
                      style={
                        styles.profileStatCard
                      }
                    >
                      <span>
                        {label}
                      </span>

                      <strong>
                        {value}
                      </strong>
                    </div>
                  ))
                ) : (
                  <div
                    style={
                      styles.profileNoStats
                    }
                  >
                    Detailed projected stats are not available for this player.
                  </div>
                )}
              </div>

              <div
                style={
                  styles.projectionHero
                }
              >
                <span>
                  PROJECTED FANTASY POINTS
                </span>

                <strong>
                  {profile
                    ?.projectedPoints ??
                    player.projectedPoints ??
                    "—"}
                </strong>
              </div>

            </section>
          </div>
        )}
      </div>
    </div>
  );
}


function QueuePanel({
  queueIds,
  playerViews,
  draftedPlayerIds,
  selectedPlayerId,
  onSelect,
  onRemove,
  onMove,
  canDraft,
  working,
  onDraft,
}: {
  queueIds: number[];
  playerViews: PlayerView[];
  draftedPlayerIds: Set<number>;
  selectedPlayerId: number | null;
  onSelect: (id: number) => void;
  onRemove: (id: number) => void;
  onMove: (id: number, direction: "up" | "down") => void;
  canDraft: boolean;
  working: boolean;
  onDraft: (id: number) => void;
}) {
  const rows =
    queueIds
      .map((id) =>
        playerViews.find(
          (player) =>
            player.id === id
        )
      )
      .filter(
        (player): player is PlayerView =>
          Boolean(player) &&
          !draftedPlayerIds.has(
            player!.id
          )
      );

  return (
    <div style={styles.simplePanel}>
      <div style={styles.simplePanelHeader}>
        <div>
          <strong>My Queue</strong>
          <span>Draft directly from your saved pick order</span>
        </div>
        <span style={styles.countBadge}>{rows.length}</span>
      </div>

      {rows.map((player, index) => (
        <div
          key={player.id}
          onClick={() => onSelect(player.id)}
          style={{
            ...styles.queueRow,
            ...(selectedPlayerId === player.id
              ? styles.playerRowSelected
              : {}),
          }}
        >
          <span style={styles.queuePosition}>{index + 1}</span>
          <PlayerAvatar player={player} />
          <div style={styles.queueIdentity}>
            <strong>{player.name}</strong>
            <span>
              {player.position} • {player.team} • Proj {player.projectedPoints ?? "—"}
            </span>
          </div>
          <div style={styles.queueMoveControls}>
            <button
              type="button"
              disabled={index === 0}
              onClick={(event) => {
                event.stopPropagation();
                onMove(player.id, "up");
              }}
              style={{
                ...styles.queueMoveButton,
                ...(index === 0 ? styles.buttonDisabled : {}),
              }}
              aria-label="Move player up"
            >↑</button>
            <button
              type="button"
              disabled={index === rows.length - 1}
              onClick={(event) => {
                event.stopPropagation();
                onMove(player.id, "down");
              }}
              style={{
                ...styles.queueMoveButton,
                ...(index === rows.length - 1 ? styles.buttonDisabled : {}),
              }}
              aria-label="Move player down"
            >↓</button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onRemove(player.id);
              }}
              style={styles.removeQueueButton}
              aria-label="Remove player from queue"
            >×</button>
            <button
              type="button"
              disabled={!canDraft || working}
              onClick={(event) => {
                event.stopPropagation();
                onDraft(player.id);
              }}
              style={{
                ...styles.inlineDraftButton,
                ...(!canDraft || working ? styles.buttonDisabled : {}),
              }}
            >
              {working ? "DRAFTING…" : "DRAFT PLAYER"}
            </button>
          </div>
        </div>
      ))}

      {rows.length === 0 ? (
        <div style={styles.emptyBody}>
          Add available players to your queue.
        </div>
      ) : null}
    </div>
  );
}



function RankingsPanel({
  players,
  draftedPlayerIds,
  selectedPlayerId,
  onSelect,
  canDraft,
  working,
  onDraft,
  onOpenProfile,
}: {
  players: PlayerView[];
  draftedPlayerIds: Set<number>;
  selectedPlayerId: number | null;
  onSelect: (id: number) => void;
  canDraft: boolean;
  working: boolean;
  onDraft: (id: number) => void;
  onOpenProfile: (id: number) => void;
}) {
  const ranked =
    players
      .filter((player) => player.myRank !== null)
      .sort(
        (a, b) =>
          (a.myRank ?? 99999) -
          (b.myRank ?? 99999)
      );

  return (
    <div style={styles.simplePanel}>
      <div style={styles.simplePanelHeader}>
        <div>
          <strong>My Rankings</strong>
          <span>Personal Auto-Pick priority • draft directly from this list</span>
        </div>
        <span style={styles.countBadge}>{ranked.length}</span>
      </div>

      {ranked.map((player) => {
        const drafted =
          draftedPlayerIds.has(player.id);

        return (
          <div
            key={player.id}
            onClick={() => {
              if (!drafted) onSelect(player.id);
            }}
            style={{
              ...styles.rankingRow,
              ...(selectedPlayerId === player.id
                ? styles.playerRowSelected
                : {}),
              ...(drafted ? styles.rankingRowDrafted : {}),
            }}
          >
            <span style={styles.rankNumber}>{player.myRank}</span>
            <PlayerAvatar player={player} />
            <div style={styles.queueIdentity}>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onOpenProfile(player.id);
                }}
                style={styles.playerNameButton}
              >
                {player.name}
              </button>
              <span>
                {player.position} • {player.team} • Bye {player.byeWeek ?? "—"} • Proj {player.projectedPoints ?? "—"}
              </span>
            </div>
            <span style={drafted ? styles.draftedTag : styles.availableTag}>
              {drafted ? "DRAFTED" : "AVAILABLE"}
            </span>
            <button
              type="button"
              disabled={drafted || !canDraft || working}
              onClick={(event) => {
                event.stopPropagation();
                onDraft(player.id);
              }}
              style={{
                ...styles.inlineDraftButton,
                ...(drafted || !canDraft || working
                  ? styles.buttonDisabled
                  : {}),
              }}
            >
              {working ? "DRAFTING…" : "DRAFT PLAYER"}
            </button>
          </div>
        );
      })}

      {ranked.length === 0 ? (
        <div style={styles.emptyBody}>
          No personal rankings have been saved yet. Auto-Pick will use default rankings.
        </div>
      ) : null}
    </div>
  );
}



function RosterPanel({
  teams,
  teamId,
  onTeamId,
  picks,
  playerMap,
  settings,
}: {
  teams:
    FantasyTeamRow[];

  teamId:
    number |
    null;

  onTeamId:
    (
      id: number
    ) => void;

  picks:
    DraftPickRow[];

  playerMap:
    Map<
      number,
      PlayerRow
    >;

  settings:
    RosterSettingRow |
    null;
}) {
  const grouped =
    groupPicksByPosition(
      picks,
      playerMap
    );


  return (
    <div
      style={
        styles.simplePanel
      }
    >
      <div
        style={
          styles.rosterToolbar
        }
      >
        <div>
          <strong>
            Roster View
          </strong>

          <span>
            Drafted players by fantasy team
          </span>
        </div>

        <select
          value={
            teamId ??
            ""
          }
          onChange={
            (
              event
            ) =>
              onTeamId(
                Number(
                  event.target
                    .value
                )
              )
          }
          style={
            styles.filterSelect
          }
        >
          {teams.map(
            (
              team
            ) => (
              <option
                key={
                  team.id
                }
                value={
                  team.id
                }
              >
                {team.team_name}
              </option>
            )
          )}
        </select>
      </div>

      <RosterGroups
        grouped={
          grouped
        }
        settings={
          settings
        }
      />
    </div>
  );
}


function HistoryPanel({
  picks,
  teamMap,
  playerMap,
}: {
  picks:
    DraftPickRow[];

  teamMap:
    Map<
      number,
      FantasyTeamRow
    >;

  playerMap:
    Map<
      number,
      PlayerRow
    >;
}) {
  return (
    <div
      style={
        styles.historyList
      }
    >
      {[...
        picks
      ]
        .reverse()
        .map(
          (
            pick
          ) => {
            const player =
              playerMap.get(
                pick.player_id
              );

            const team =
              teamMap.get(
                pick.fantasy_team_id
              );


            return (
              <div
                key={
                  pick.id
                }
                style={
                  styles.historyRow
                }
              >
                <div
                  style={
                    styles.historyPickNumber
                  }
                >
                  {pick.overall_pick}
                </div>

                <PlayerAvatar
                  player={{
                    name:
                      player
                        ?.full_name ??
                      "Player",

                    headshot:
                      player
                        ?.headshot_url ??
                      null,
                  }}
                  size={
                    38
                  }
                />

                <div
                  style={
                    styles.historyPlayer
                  }
                >
                  <strong>
                    {player
                      ?.full_name ??
                      `Player ${pick.player_id}`}
                  </strong>

                  <span>
                    {player
                      ?.primary_position ??
                      "—"}
                    {" • "}
                    {player
                      ?.team_abbreviation ??
                      "FA"}
                  </span>
                </div>

                <div
                  style={
                    styles.historyTeam
                  }
                >
                  <strong>
                    {team
                      ?.team_name ??
                      "Team"}
                  </strong>

                  <span>
                    Round {pick.round_number}, Pick {pick.pick_in_round}
                  </span>
                </div>

                <span
                  style={
                    styles.pickTypeTag
                  }
                >
                  {pick.pick_type.toUpperCase()}
                </span>
              </div>
            );
          }
        )}

      {picks.length ===
      0 ? (
        <div
          style={
            styles.emptyBody
          }
        >
          Draft history will appear after the first selection.
        </div>
      ) : null}
    </div>
  );
}


function DraftBoardPanel({
  draft,
  slots,
  picks,
  teamMap,
  playerMap,
  myTeamId,
}: {
  draft:
    DraftRow;

  slots:
    DraftSlotRow[];

  picks:
    DraftPickRow[];

  teamMap:
    Map<
      number,
      FantasyTeamRow
    >;

  playerMap:
    Map<
      number,
      PlayerRow
    >;

  myTeamId:
    number |
    null;
}) {
  const pickMap =
    new Map(
      picks.map(
        (
          pick
        ) => [
          `${pick.round_number}-${pick.draft_slot}`,
          pick,
        ] as const
      )
    );


  return (
    <div
      style={
        styles.boardOuter
      }
    >
      <div
        style={
          styles.boardHeader
        }
      >
        <div>
          <span
            style={
              styles.workspaceEyebrow
            }
          >
            LIVE DRAFT
          </span>

          <strong
            style={
              styles.boardTitle
            }
          >
            Draft Board
          </strong>
        </div>

        <span
          style={
            styles.boardProgressText
          }
        >
          {picks.length} of {slots.length * draft.total_rounds} picks completed
        </span>
      </div>


      <div
        className="g365-draft-board-scroll"
        style={
          styles.boardScroll
        }
      >
        <div
          style={{
            ...styles.boardGrid,

            gridTemplateColumns:
              `76px repeat(${slots.length}, minmax(148px, 148px))`,
          }}
        >
          <div
            style={
              styles.boardCorner
            }
          >
            ROUND
          </div>

          {slots.map(
            (
              slot
            ) => {
              const team =
                teamMap.get(
                  slot.fantasy_team_id
                );


              const mine =
                slot.fantasy_team_id ===
                myTeamId;


              return (
                <div
                  key={
                    `header-${slot.id}`
                  }
                  style={{
                    ...styles.boardTeamHeader,

                    ...(mine
                      ? styles.boardTeamHeaderMine
                      : {}),
                  }}
                >
                  <span>
                    #{slot.draft_slot}
                  </span>

                  <strong>
                    {team
                      ?.team_name ??
                      `Team ${slot.draft_slot}`}
                  </strong>
                </div>
              );
            }
          )}


          {Array.from(
            {
              length:
                draft.total_rounds,
            },
            (
              _,
              index
            ) =>
              index +
              1
          ).flatMap(
            (
              round
            ) => {
              const row:
                React.ReactNode[] =
                  [];


              row.push(
                <div
                  key={
                    `round-${round}`
                  }
                  style={
                    styles.boardRoundCell
                  }
                >
                  <strong>
                    {round}
                  </strong>

                  <span>
                    {round %
                      2 ===
                    1
                      ? "→"
                      : "←"}
                  </span>
                </div>
              );


              slots.forEach(
                (
                  slot
                ) => {
                  const pick =
                    pickMap.get(
                      `${round}-${slot.draft_slot}`
                    );


                  const player =
                    pick
                      ? playerMap.get(
                          pick.player_id
                        )
                      : null;


                  const teamCount =
                    slots.length;


                  const pickInRound =
                    round %
                      2 ===
                    1
                      ? slot.draft_slot
                      : teamCount -
                        slot.draft_slot +
                        1;


                  const overall =
                    (
                      round -
                      1
                    ) *
                      teamCount +
                    pickInRound;


                  const current =
                    overall ===
                    draft.current_overall_pick &&
                    draft.status ===
                      "live";


                  const mine =
                    slot.fantasy_team_id ===
                    myTeamId;


                  row.push(
                    <div
                      key={
                        `cell-${round}-${slot.draft_slot}`
                      }
                      style={{
                        ...styles.boardCell,

                        ...(current
                          ? styles.boardCellCurrent
                          : {}),

                        ...(mine
                          ? styles.boardCellMine
                          : {}),
                      }}
                    >
                      <span
                        style={
                          styles.boardPickNumber
                        }
                      >
                        {round}.{String(pickInRound).padStart(2, "0")}
                      </span>

                      {pick ? (
                        <>
                          <strong
                            style={
                              styles.boardPlayerName
                            }
                          >
                            {player
                              ?.full_name ??
                              `Player ${pick.player_id}`}
                          </strong>

                          <span
                            style={
                              styles.boardPlayerMeta
                            }
                          >
                            {player
                              ?.primary_position ??
                              "—"}
                            {" • "}
                            {player
                              ?.team_abbreviation ??
                              "FA"}
                          </span>
                        </>
                      ) : (
                        <span
                          style={
                            styles.boardOpen
                          }
                        >
                          {current
                            ? "ON CLOCK"
                            : "Open"}
                        </span>
                      )}
                    </div>
                  );
                }
              );


              return row;
            }
          )}
        </div>
      </div>
    </div>
  );
}


function MiniRoster({
  picks,
  playerMap,
  settings,
}: {
  picks:
    DraftPickRow[];

  playerMap:
    Map<
      number,
      PlayerRow
    >;

  settings:
    RosterSettingRow |
    null;
}) {
  const grouped =
    groupPicksByPosition(
      picks,
      playerMap
    );


  const counts =
    [
      [
        "QB",
        grouped.QB.length,
        settings
          ?.starting_qb ??
          1,
      ],
      [
        "RB",
        grouped.RB.length,
        settings
          ?.starting_rb ??
          2,
      ],
      [
        "WR",
        grouped.WR.length,
        settings
          ?.starting_wr ??
          2,
      ],
      [
        "TE",
        grouped.TE.length,
        settings
          ?.starting_te ??
          1,
      ],
      [
        "K",
        grouped.K.length,
        settings
          ?.starting_k ??
          1,
      ],
      [
        "DST",
        grouped.DST.length,
        settings
          ?.starting_dst ??
          1,
      ],
    ] as const;


  return (
    <div
      style={
        styles.miniRoster
      }
    >
      <div
        style={
          styles.positionBreakdown
        }
      >
        {counts.map(
          (
            [
              position,
              count,
              target,
            ]
          ) => (
            <div
              key={
                position
              }
              style={
                styles.positionCount
              }
            >
              <span>
                {position}
              </span>

              <strong>
                {count}
              </strong>

              <small>
                / {target}
              </small>
            </div>
          )
        )}
      </div>


      <div
        style={
          styles.miniRosterPlayers
        }
      >
        {picks
          .slice(
            -10
          )
          .map(
            (
              pick
            ) => {
              const player =
                playerMap.get(
                  pick.player_id
                );


              return (
                <div
                  key={
                    pick.id
                  }
                  style={
                    styles.miniRosterPlayer
                  }
                >
                  <span
                    style={
                      styles.positionBadgeSmall
                    }
                  >
                    {player
                      ?.primary_position ??
                      "—"}
                  </span>

                  <strong>
                    {player
                      ?.full_name ??
                      `Player ${pick.player_id}`}
                  </strong>
                </div>
              );
            }
          )}

        {picks.length ===
        0 ? (
          <div
            style={
              styles.mutedText
            }
          >
            Your drafted roster will appear here.
          </div>
        ) : null}
      </div>
    </div>
  );
}


function groupPicksByPosition(
  picks:
    DraftPickRow[],
  playerMap:
    Map<
      number,
      PlayerRow
    >
) {
  const grouped:
    Record<
      string,
      PlayerRow[]
    > = {
      QB: [],
      RB: [],
      WR: [],
      TE: [],
      K: [],
      DST: [],
    };


  picks.forEach(
    (
      pick
    ) => {
      const player =
        playerMap.get(
          pick.player_id
        );


      if (
        player &&
        grouped[
          player.primary_position
        ]
      ) {
        grouped[
          player.primary_position
        ].push(
          player
        );
      }
    }
  );


  return grouped as {
    QB:
      PlayerRow[];

    RB:
      PlayerRow[];

    WR:
      PlayerRow[];

    TE:
      PlayerRow[];

    K:
      PlayerRow[];

    DST:
      PlayerRow[];
  };
}


function RosterGroups({
  grouped,
  settings,
}: {
  grouped:
    ReturnType<
      typeof groupPicksByPosition
    >;

  settings:
    RosterSettingRow |
    null;
}) {
  return (
    <div
      style={
        styles.rosterGroups
      }
    >
      {[
        "QB",
        "RB",
        "WR",
        "TE",
        "K",
        "DST",
      ].map(
        (
          position
        ) => (
          <section
            key={
              position
            }
            style={
              styles.rosterGroup
            }
          >
            <div
              style={
                styles.rosterGroupHeader
              }
            >
              <strong>
                {position}
              </strong>

              <span>
                {
                  grouped[
                    position as keyof typeof grouped
                  ].length
                }
              </span>
            </div>

            <div
              style={
                styles.rosterGroupPlayers
              }
            >
              {
                grouped[
                  position as keyof typeof grouped
                ].map(
                  (
                    player
                  ) => (
                    <div
                      key={
                        player.id
                      }
                      style={
                        styles.rosterGroupPlayer
                      }
                    >
                      <PlayerAvatar
                        player={{
                          name:
                            player.full_name,

                          headshot:
                            player.headshot_url,
                        }}
                        size={
                          30
                        }
                      />

                      <div>
                        <strong>
                          {player.full_name}
                        </strong>

                        <span>
                          {player.team_abbreviation ??
                            "FA"}
                        </span>
                      </div>
                    </div>
                  )
                )
              }

              {
                grouped[
                  position as keyof typeof grouped
                ].length ===
                0 ? (
                  <span
                    style={
                      styles.mutedText
                    }
                  >
                    Empty
                  </span>
                ) : null
              }
            </div>
          </section>
        )
      )}

      <div
        style={
          styles.rosterNote
        }
      >
        Draft rounds:{" "}
        {settings
          ? settings.starting_qb +
            settings.starting_rb +
            settings.starting_wr +
            settings.starting_te +
            settings.starting_flex +
            settings.starting_superflex +
            settings.starting_k +
            settings.starting_dst +
            settings.bench_slots
          : "—"}
      </div>
    </div>
  );
}


function positionBadgeStyle(
  position: string
) {
  if (
    position ===
    "QB"
  ) {
    return {
      color:
        "#ffb339",

      background:
        "rgba(255,179,57,.09)",
    };
  }


  if (
    position ===
    "RB"
  ) {
    return {
      color:
        "#47dc8d",

      background:
        "rgba(71,220,141,.09)",
    };
  }


  if (
    position ===
    "WR"
  ) {
    return {
      color:
        "#63a9ff",

      background:
        "rgba(99,169,255,.09)",
    };
  }


  if (
    position ===
    "TE"
  ) {
    return {
      color:
        "#d790ff",

      background:
        "rgba(215,144,255,.09)",
    };
  }


  return {
    color:
      "#d8dbe0",

    background:
      "rgba(255,255,255,.06)",
  };
}


const styles = {
  page: {
    minHeight:
      "calc(100vh - 70px)",

    padding:
      "12px 14px 30px",

    background:
      "radial-gradient(circle at 50% -10%,rgba(255,72,15,.09),transparent 28%),#090a0c",

    color:
      "#f7f8fa",
  },


  shell: {
    width:
      "min(1600px,100%)",

    margin:
      "0 auto",

    display:
      "grid",

    gap:
      "10px",
  },


  topHeader: {
    minHeight:
      "64px",

    padding:
      "10px 12px",

    display:
      "grid",

    gridTemplateColumns:
      "minmax(240px,1fr) auto minmax(240px,1fr)",

    alignItems:
      "center",

    gap:
      "12px",

    border:
      "1px solid rgba(255,255,255,.07)",

    borderRadius:
      "8px",

    background:
      "linear-gradient(180deg,#15171a,#0f1113)",
  },


  brandBlock: {
    display:
      "flex",

    alignItems:
      "center",

    gap:
      "10px",
  },


  brandBadge: {
    width:
      "44px",

    height:
      "44px",

    display:
      "flex",

    alignItems:
      "center",

    justifyContent:
      "center",

    borderRadius:
      "9px",

    background:
      "linear-gradient(135deg,#ad1717,#ff6512)",

    color:
      "#fff",

    fontSize: "12px",

    fontWeight:
      1000,

    boxShadow:
      "0 0 28px rgba(255,77,15,.18)",
  },


  brandTitle: {
    color:
      "#fff",

    fontSize: "13px",

    fontWeight:
      1000,

    letterSpacing:
      ".06em",
  },


  brandSub: {
    marginTop:
      "2px",

    color:
      "#757c86",

    fontSize: "11px",
  },


  headerStatus: {
    display:
      "flex",

    alignItems:
      "center",

    justifyContent:
      "center",

    gap:
      "8px",

    color:
      "#8f969f",

    fontSize: "12px",
  },


  dot: {
    color:
      "#4f555d",
  },


  statusPill: {
    padding:
      "4px 7px",

    borderRadius:
      "999px",

    fontSize: "11px",

    fontWeight:
      950,
  },


  statusLive: {
    color:
      "#56de8f",

    background:
      "rgba(50,210,120,.09)",

    border:
      "1px solid rgba(50,210,120,.15)",
  },


  statusComplete: {
    color:
      "#66b2ff",

    background:
      "rgba(75,145,255,.08)",

    border:
      "1px solid rgba(75,145,255,.14)",
  },


  statusScheduled: {
    color:
      "#ff9b43",

    background:
      "rgba(255,130,25,.08)",

    border:
      "1px solid rgba(255,130,25,.14)",
  },


  headerActions: {
    display:
      "flex",

    justifyContent:
      "flex-end",

    gap:
      "7px",
  },


  primaryButton: {
    border:
      0,

    borderRadius:
      "6px",

    padding:
      "8px 12px",

    background:
      "linear-gradient(135deg,#ad1717,#ff6512)",

    color:
      "#fff",

    fontSize: "11px",

    fontWeight:
      950,

    cursor:
      "pointer",
  },


  undoButton: {
    border:
      "1px solid rgba(255,85,70,.36)",

    borderRadius:
      "6px",

    padding:
      "8px 12px",

    background:
      "rgba(180,25,20,.12)",

    color:
      "#ff8175",

    fontSize: "11px",

    fontWeight:
      950,

    cursor:
      "pointer",
  },


  completeButton: {
    border:
      "1px solid rgba(60,210,125,.30)",

    borderRadius:
      "6px",

    padding:
      "8px 12px",

    background:
      "rgba(45,190,110,.12)",

    color:
      "#67e59a",

    fontSize: "11px",

    fontWeight:
      950,

    cursor:
      "pointer",
  },


  secondaryButton: {
    border:
      "1px solid rgba(255,122,25,.2)",

    borderRadius:
      "6px",

    padding:
      "8px 12px",

    background:
      "#191b1e",

    color:
      "#ff8c2d",

    fontSize: "11px",

    fontWeight:
      950,

    cursor:
      "pointer",
  },


  errorStrip: {
    padding:
      "8px 10px",

    border:
      "1px solid rgba(255,80,65,.2)",

    borderRadius:
      "6px",

    background:
      "rgba(255,70,55,.045)",

    color:
      "#ff7770",

    fontSize: "11px",
  },


  autoPickNotice: {
    padding:
      "10px 12px",

    display:
      "flex",

    alignItems:
      "center",

    justifyContent:
      "space-between",

    gap:
      "12px",

    flexWrap:
      "wrap" as const,

    border:
      "1px solid rgba(255,132,35,.38)",

    borderRadius:
      "7px",

    background:
      "linear-gradient(135deg,rgba(190,35,15,.18),rgba(255,115,15,.09))",

    boxShadow:
      "inset 0 0 22px rgba(255,85,10,.05)",
  },


  autoPickNoticeTitle: {
    display:
      "block",

    color:
      "#ffffff",

    fontSize:
      "12px",

    fontWeight:
      1000,

    letterSpacing:
      ".045em",
  },


  autoPickNoticeText: {
    display:
      "block",

    marginTop:
      "3px",

    maxWidth:
      "760px",

    color:
      "#f0f2f4",

    fontSize:
      "11px",

    lineHeight:
      1.4,
  },


  autoPickNoticeButton: {
    minHeight:
      "34px",

    padding:
      "0 12px",

    border:
      "1px solid rgba(255,143,55,.45)",

    borderRadius:
      "6px",

    background:
      "linear-gradient(135deg,#c91c18,#ff5a0a,#ff8a22)",

    color:
      "#ffffff",

    fontSize:
      "9px",

    fontWeight:
      1000,

    letterSpacing:
      ".04em",

    cursor:
      "pointer",
  },


  draftTrain: {
    overflowX:
      "auto" as const,

    display:
      "grid",

    gridAutoFlow:
      "column",

    gridAutoColumns:
      "minmax(122px,1fr)",

    gap:
      "6px",

    padding:
      "7px",

    border:
      "1px solid rgba(255,255,255,.065)",

    borderRadius:
      "7px",

    background:
      "#0f1113",
  },


  trainCard: {
    minHeight:
      "62px",

    padding:
      "7px 8px",

    display:
      "grid",

    gap:
      "2px",

    border:
      "1px solid rgba(255,255,255,.055)",

    borderRadius:
      "6px",

    background:
      "#141619",
  },


  trainCardCurrent: {
    border:
      "1px solid rgba(255,102,20,.55)",

    background:
      "linear-gradient(135deg,rgba(180,25,20,.17),rgba(255,100,15,.07))",

    boxShadow:
      "inset 0 0 18px rgba(255,70,10,.05)",
  },


  trainPickNumber: {
    color:
      "#646b74",

    fontSize: "11px",

    fontWeight:
      900,
  },


  trainStatus: {
    color:
      "#ff7d22",

    fontSize: "11px",

    fontWeight:
      950,
  },


  trainTeamName: {
    overflow:
      "hidden",

    textOverflow:
      "ellipsis",

    whiteSpace:
      "nowrap" as const,

    color:
      "#e5e7ea",

    fontSize: "12px",
  },


  trainMeta: {
    color:
      "#7a818a",

    fontSize: "11px",
  },


  trainPresence: {
    marginTop:
      "3px",

    padding:
      "3px 5px",

    alignSelf:
      "flex-start",

    border:
      "1px solid rgba(255,255,255,.08)",

    borderRadius:
      "5px",

    background:
      "rgba(255,255,255,.035)",

    color:
      "#8b929b",

    fontSize:
      "8px",

    fontWeight:
      950,

    letterSpacing:
      ".035em",

    whiteSpace:
      "nowrap" as const,
  },


  trainPresenceOnline: {
    borderColor:
      "rgba(66,217,130,.28)",

    background:
      "rgba(35,190,100,.09)",

    color:
      "#56e391",
  },


  trainPresenceAuto: {
    borderColor:
      "rgba(255,125,34,.30)",

    background:
      "rgba(255,100,15,.08)",

    color:
      "#ff912f",
  },


  mainGrid: {
    display:
      "grid",

    gridTemplateColumns:
      "288px minmax(0,1fr) 330px",

    gap:
      "9px",

    alignItems:
      "start",
  },


  controlColumn: {
    display:
      "grid",

    gap:
      "8px",
  },


  rightColumn: {
    display:
      "grid",

    gap:
      "8px",
  },


  panel: {
    overflow:
      "hidden",

    border:
      "1px solid rgba(255,255,255,.07)",

    borderRadius:
      "7px",

    background:
      "linear-gradient(180deg,#15171a,#101214)",
  },


  panelHeader: {
    padding:
      "8px 9px",

    borderBottom:
      "1px solid rgba(255,255,255,.055)",

    color:
      "#ff7d22",

    fontSize: "11px",

    fontWeight:
      1000,

    letterSpacing:
      ".06em",
  },


  rosterPanelHeader: {
    padding:
      "9px",

    display:
      "flex",

    alignItems:
      "center",

    justifyContent:
      "space-between",

    gap:
      "8px",

    borderBottom:
      "1px solid rgba(255,255,255,.055)",
  },


  rosterPanelEyebrow: {
    color:
      "#ff7d22",

    fontSize:
      "8px",

    fontWeight:
      1000,

    letterSpacing:
      ".06em",
  },


  rosterPanelTitle: {
    display:
      "block",

    marginTop:
      "2px",

    maxWidth:
      "155px",

    overflow:
      "hidden",

    textOverflow:
      "ellipsis",

    whiteSpace:
      "nowrap" as const,

    color:
      "#ffffff",

    fontSize:
      "11px",
  },


  rosterSelect: {
    maxWidth:
      "150px",

    minHeight:
      "30px",

    padding:
      "0 8px",

    border:
      "1px solid rgba(255,125,34,.28)",

    borderRadius:
      "6px",

    outline:
      "none",

    background:
      "#111317",

    color:
      "#ffffff",

    fontSize:
      "9px",

    fontWeight:
      850,
  },


  clockArea: {
    padding:
      "13px 10px",

    textAlign:
      "center" as const,

    borderBottom:
      "1px solid rgba(255,255,255,.05)",
  },


  clockLabel: {
    color:
      "#6c737c",

    fontSize: "11px",

    fontWeight:
      950,
  },


  clockValue: {
    marginTop:
      "3px",

    color:
      "#f7f8f9",

    fontSize: "32px",

    fontWeight:
      1000,

    fontVariantNumeric:
      "tabular-nums",
  },


  clockUrgent: {
    color:
      "#ff5c4f",

    textShadow:
      "0 0 18px rgba(255,60,40,.18)",
  },


  clockRound: {
    color:
      "#6e757e",

    fontSize: "11px",

    fontWeight:
      800,
  },


  onClockTeam: {
    padding:
      "10px",

    display:
      "flex",

    gap:
      "8px",

    alignItems:
      "center",
  },


  teamGlyph: {
    width:
      "38px",

    height:
      "38px",

    display:
      "flex",

    alignItems:
      "center",

    justifyContent:
      "center",

    borderRadius:
      "9px",

    background:
      "linear-gradient(135deg,#3a1917,#201515)",

    color:
      "#ff7e25",

    fontSize: "12px",

    fontWeight:
      1000,
  },


  onClockText: {
    minWidth:
      0,

    display:
      "grid",

    gap:
      "2px",
  },


  smallLabel: {
    color:
      "#666d76",

    fontSize: "11px",

    fontWeight:
      950,
  },


  onClockName: {
    overflow:
      "hidden",

    textOverflow:
      "ellipsis",

    whiteSpace:
      "nowrap" as const,

    color:
      "#f1f2f4",

    fontSize: "12px",
  },


  onClockMode: {
    color:
      "#ff8428",

    fontSize: "11px",

    fontWeight:
      900,
  },


  selectedPlayerBox: {
    minHeight:
      "62px",

    padding:
      "9px",

    display:
      "flex",

    alignItems:
      "center",

    gap:
      "8px",
  },


  selectedPlayerText: {
    minWidth:
      0,

    display:
      "grid",

    gap:
      "3px",

    color:
      "#f3f4f5",

    fontSize: "12px",
  },


  noSelection: {
    color:
      "#656c75",

    fontSize: "11px",
  },


  draftButton: {
    width:
      "calc(100% - 18px)",

    margin:
      "0 9px 9px",

    border:
      0,

    borderRadius:
      "6px",

    padding:
      "9px",

    background:
      "linear-gradient(135deg,#b31b17,#ff6412)",

    color:
      "#fff",

    fontSize: "11px",

    fontWeight:
      1000,

    cursor:
      "pointer",
  },


  buttonDisabled: {
    opacity:
      0.35,

    cursor:
      "not-allowed",
  },


  lastPickBox: {
    padding:
      "8px 9px",

    display:
      "grid",

    gap:
      "3px",

    borderTop:
      "1px solid rgba(255,255,255,.05)",

    color:
      "#d9dce0",

    fontSize: "11px",
  },


  settingRow: {
    padding:
      "10px",

    display:
      "flex",

    alignItems:
      "center",

    justifyContent:
      "space-between",

    gap:
      "10px",
  },


  settingTitle: {
    color:
      "#e8eaed",

    fontSize: "12px",
  },


  settingHelp: {
    marginTop:
      "3px",

    color:
      "#696f78",

    fontSize: "11px",

    lineHeight:
      1.45,
  },


  toggle: {
    minWidth:
      "64px",

    padding:
      "5px 7px",

    display:
      "flex",

    alignItems:
      "center",

    justifyContent:
      "space-between",

    gap:
      "5px",

    border:
      "1px solid rgba(255,255,255,.08)",

    borderRadius:
      "999px",

    background:
      "#202327",

    color:
      "#777f88",

    fontSize: "11px",

    fontWeight:
      950,

    cursor:
      "pointer",
  },


  toggleOn: {
    border:
      "1px solid rgba(255,112,20,.27)",

    background:
      "rgba(255,95,15,.09)",

    color:
      "#ff8426",
  },


  toggleKnob: {
    width:
      "10px",

    height:
      "10px",

    borderRadius:
      "50%",

    background:
      "#777d85",
  },


  toggleKnobOn: {
    background:
      "#ff7120",

    boxShadow:
      "0 0 8px rgba(255,90,15,.35)",
  },


  audioButtons: {
    padding:
      "8px",

    display:
      "grid",

    gridTemplateColumns:
      "1fr 1fr",

    gap:
      "5px",
  },


  audioButton: {
    minHeight:
      "30px",

    border:
      "1px solid rgba(255,255,255,.07)",

    borderRadius:
      "5px",

    background:
      "#181a1d",

    color:
      "#727982",

    fontSize: "11px",

    fontWeight:
      900,

    cursor:
      "pointer",
  },


  audioButtonActive: {
    color:
      "#ff8425",

    border:
      "1px solid rgba(255,120,20,.18)",

    background:
      "rgba(255,100,15,.05)",
  },


  workspace: {
    minWidth:
      0,

    overflow:
      "hidden",

    border:
      "1px solid rgba(255,255,255,.07)",

    borderRadius:
      "7px",

    background:
      "linear-gradient(180deg,#15171a,#101214)",
  },


  workspaceHeader: {
    minHeight:
      "48px",

    padding:
      "8px 10px",

    display:
      "flex",

    justifyContent:
      "space-between",

    alignItems:
      "center",

    borderBottom:
      "1px solid rgba(255,255,255,.055)",
  },


  workspaceEyebrow: {
    color:
      "#ff7e22",

    fontSize: "11px",

    fontWeight:
      1000,

    letterSpacing:
      ".05em",
  },


  workspaceSub: {
    marginTop:
      "2px",

    color:
      "#6d747d",

    fontSize: "11px",
  },


  collapseButton: {
    width:
      "26px",

    height:
      "26px",

    border:
      "1px solid rgba(255,255,255,.07)",

    borderRadius:
      "5px",

    background:
      "#191b1e",

    color:
      "#9ba1a9",

    cursor:
      "pointer",
  },


  progressTrack: {
    height:
      "3px",

    background:
      "#24272b",
  },


  progressFill: {
    height:
      "100%",

    background:
      "linear-gradient(90deg,#b71917,#ff6512)",
  },


  tabs: {
    overflowX:
      "auto" as const,

    display:
      "flex",

    gap:
      "2px",

    padding:
      "6px 7px",

    borderBottom:
      "1px solid rgba(255,255,255,.05)",
  },


  tabButton: {
    flex:
      "0 0 auto",

    border:
      0,

    borderRadius:
      "4px",

    padding:
      "7px 8px",

    background:
      "transparent",

    color:
      "#6f7680",

    fontSize: "11px",

    fontWeight:
      950,

    cursor:
      "pointer",
  },


  tabButtonActive: {
    background:
      "rgba(255,100,15,.07)",

    color:
      "#ff8425",
  },


  workspaceBody: {
    minHeight:
      "610px",

    maxHeight:
      "72vh",

    overflow:
      "hidden",
  },


  workspaceBodyBoard: {
    overflow:
      "hidden",
  },


  playerPanel: {
    height:
      "100%",

    minHeight:
      0,

    overflow:
      "hidden",

    display:
      "grid",

    gridTemplateRows:
      "auto auto auto auto",
  },


  filters: {
    padding:
      "8px",

    display:
      "grid",

    gridTemplateColumns:
      "minmax(180px,1fr) 120px 110px auto",

    gap:
      "6px",

    alignItems:
      "center",
  },


  searchInput: {
    minWidth:
      0,

    padding:
      "8px 9px",

    border:
      "1px solid rgba(255,255,255,.07)",

    borderRadius:
      "5px",

    outline:
      "none",

    background:
      "#0f1113",

    color:
      "#e8eaed",

    fontSize: "12px",
  },


  filterSelect: {
    padding:
      "7px 8px",

    border:
      "1px solid rgba(255,255,255,.07)",

    borderRadius:
      "5px",

    background:
      "#15171a",

    color:
      "#c7cbd0",

    fontSize: "11px",
  },


  showing: {
    color:
      "#737a83",

    fontSize: "11px",

    textAlign:
      "right" as const,
  },


  playerTableHeader: {
    padding:
      "7px 9px",

    display:
      "grid",

    gridTemplateColumns:
      "52px minmax(220px,1fr) 54px 54px 44px 48px 66px 46px",

    gap:
      "6px",

    borderTop:
      "1px solid rgba(255,255,255,.045)",

    borderBottom:
      "1px solid rgba(255,255,255,.045)",

    color:
      "#59606a",

    fontSize: "12px",

    fontWeight:
      950,
  },


  playerRows: {
    height:
      "440px",

    minHeight:
      "300px",

    maxHeight:
      "calc(72vh - 265px)",

    overflowY:
      "scroll" as const,

    overflowX:
      "hidden" as const,

    overscrollBehavior:
      "contain" as const,

    scrollbarGutter:
      "stable" as const,

    WebkitOverflowScrolling:
      "touch" as const,
  },


  playerRow: {
    minHeight:
      "49px",

    padding:
      "6px 9px",

    display:
      "grid",

    gridTemplateColumns:
      "52px minmax(220px,1fr) 54px 54px 44px 48px 66px 46px",

    gap:
      "6px",

    alignItems:
      "center",

    borderBottom:
      "1px solid rgba(255,255,255,.035)",

    cursor:
      "pointer",
  },


  playerRowSelected: {
    background:
      "linear-gradient(90deg,rgba(180,25,18,.11),rgba(255,100,15,.035))",

    boxShadow:
      "inset 2px 0 #ff6a18",
  },


  rankNumber: {
    color:
      "#6e757e",

    fontSize: "12px",

    fontWeight:
      900,
  },


  playerIdentity: {
    minWidth:
      0,

    display:
      "flex",

    alignItems:
      "center",

    gap:
      "8px",
  },


  playerIdentityText: {
    minWidth:
      0,

    display:
      "grid",

    gap:
      "2px",

    color:
      "#e8eaed",

    fontSize: "13px",
  },


  positionBadge: {
    width:
      "fit-content",

    padding:
      "3px 5px",

    borderRadius:
      "4px",

    fontSize: "12px",

    fontWeight:
      1000,
  },


  teamText: {
    color:
      "#9ca2aa",

    fontSize: "12px",
  },


  projectionText: {
    color:
      "#858c95",

    fontSize: "12px",
  },


  queueButton: {
    width:
      "26px",

    height:
      "26px",

    border:
      "1px solid rgba(255,255,255,.07)",

    borderRadius:
      "5px",

    background:
      "#1a1c1f",

    color:
      "#777e87",

    cursor:
      "pointer",
  },


  queueButtonActive: {
    color:
      "#ff8426",

    border:
      "1px solid rgba(255,120,25,.2)",

    background:
      "rgba(255,100,15,.05)",
  },


  simplePanel: {
    height:
      "100%",

    overflowY:
      "auto" as const,
  },


  simplePanelHeader: {
    padding:
      "12px",

    display:
      "flex",

    alignItems:
      "center",

    justifyContent:
      "space-between",

    borderBottom:
      "1px solid rgba(255,255,255,.05)",

    color:
      "#e8eaed",

    fontSize: "12px",
  },


  countBadge: {
    padding:
      "3px 6px",

    borderRadius:
      "999px",

    background:
      "rgba(255,110,15,.07)",

    color:
      "#ff8425",

    fontSize: "11px",
  },


  queueRow: {
    minHeight:
      "50px",

    padding:
      "7px 10px",

    display:
      "grid",

    gridTemplateColumns:
      "30px 34px minmax(0,1fr) minmax(220px,auto)",

    gap:
      "8px",

    alignItems:
      "center",

    borderBottom:
      "1px solid rgba(255,255,255,.04)",

    cursor:
      "pointer",
  },


  queuePosition: {
    color:
      "#ff8326",

    fontSize: "12px",

    fontWeight:
      950,
  },


  queueIdentity: {
    minWidth:
      0,

    display:
      "grid",

    gap:
      "2px",

    color:
      "#e8eaed",

    fontSize: "12px",
  },


  removeQueueButton: {
    width:
      "26px",

    height:
      "26px",

    border:
      "1px solid rgba(255,255,255,.06)",

    borderRadius:
      "5px",

    background:
      "#191b1e",

    color:
      "#7c838c",

    cursor:
      "pointer",
  },


  emptyBody: {
    padding:
      "34px 14px",

    color:
      "#666d76",

    fontSize: "11px",

    textAlign:
      "center" as const,
  },


  rankingRow: {
    width:
      "100%",

    padding:
      "7px 10px",

    display:
      "grid",

    gridTemplateColumns:
      "42px 34px minmax(0,1fr) auto auto",

    gap:
      "8px",

    alignItems:
      "center",

    border:
      0,

    borderBottom:
      "1px solid rgba(255,255,255,.04)",

    background:
      "transparent",

    color:
      "inherit",

    textAlign:
      "left" as const,

    cursor:
      "pointer",
  },


  rankingRowDrafted: {
    opacity:
      0.38,
  },


  draftedTag: {
    color:
      "#ff6b60",

    fontSize: "11px",

    fontWeight:
      950,
  },


  availableTag: {
    color:
      "#55d58b",

    fontSize: "11px",

    fontWeight:
      950,
  },


  rosterToolbar: {
    padding:
      "10px",

    display:
      "flex",

    justifyContent:
      "space-between",

    alignItems:
      "center",

    gap:
      "10px",

    borderBottom:
      "1px solid rgba(255,255,255,.05)",

    color:
      "#e8eaed",

    fontSize: "12px",
  },


  rosterGroups: {
    padding:
      "9px",

    display:
      "grid",

    gridTemplateColumns:
      "repeat(3,minmax(0,1fr))",

    gap:
      "8px",
  },


  rosterGroup: {
    overflow:
      "hidden",

    border:
      "1px solid rgba(255,255,255,.055)",

    borderRadius:
      "6px",

    background:
      "#0f1113",
  },


  rosterGroupHeader: {
    padding:
      "7px 8px",

    display:
      "flex",

    justifyContent:
      "space-between",

    borderBottom:
      "1px solid rgba(255,255,255,.045)",

    color:
      "#ff8425",

    fontSize: "11px",
  },


  rosterGroupPlayers: {
    minHeight:
      "72px",

    padding:
      "6px",

    display:
      "grid",

    gap:
      "5px",
  },


  rosterGroupPlayer: {
    display:
      "flex",

    gap:
      "7px",

    alignItems:
      "center",

    color:
      "#dfe2e5",

    fontSize: "11px",
  },


  rosterNote: {
    gridColumn:
      "1 / -1",

    color:
      "#666d76",

    fontSize: "11px",
  },


  historyList: {
    height:
      "100%",

    overflowY:
      "auto" as const,
  },


  historyRow: {
    minHeight:
      "54px",

    padding:
      "7px 10px",

    display:
      "grid",

    gridTemplateColumns:
      "40px 38px minmax(180px,1fr) minmax(160px,1fr) auto",

    gap:
      "8px",

    alignItems:
      "center",

    borderBottom:
      "1px solid rgba(255,255,255,.04)",
  },


  historyPickNumber: {
    color:
      "#ff8425",

    fontSize: "12px",

    fontWeight:
      1000,
  },


  historyPlayer: {
    display:
      "grid",

    gap:
      "2px",

    color:
      "#e8eaed",

    fontSize: "12px",
  },


  historyTeam: {
    display:
      "grid",

    gap:
      "2px",

    color:
      "#9ba1a9",

    fontSize: "11px",
  },


  pickTypeTag: {
    padding:
      "3px 5px",

    borderRadius:
      "4px",

    background:
      "rgba(255,110,15,.06)",

    color:
      "#ff8426",

    fontSize: "11px",

    fontWeight:
      950,
  },


  boardOuter: {
    height:
      "100%",

    display:
      "grid",

    gridTemplateRows:
      "auto minmax(0,1fr)",
  },


  boardHeader: {
    padding:
      "9px 10px",

    display:
      "flex",

    justifyContent:
      "space-between",

    alignItems:
      "center",

    borderBottom:
      "1px solid rgba(255,255,255,.045)",
  },


  boardTitle: {
    display:
      "block",

    marginTop:
      "2px",

    color:
      "#f1f2f4",

    fontSize: "12px",
  },


  boardProgressText: {
    color:
      "#6c737c",

    fontSize: "11px",
  },


  boardScroll: {
    overflow:
      "auto" as const,

    scrollbarGutter:
      "stable",

    paddingBottom:
      "5px",
  },


  boardGrid: {
    width:
      "max-content",

    display:
      "grid",

    alignItems:
      "stretch",
  },


  boardCorner: {
    position:
      "sticky" as const,

    left:
      0,

    zIndex:
      4,

    padding:
      "7px",

    display:
      "flex",

    alignItems:
      "center",

    justifyContent:
      "center",

    borderRight:
      "1px solid rgba(255,255,255,.06)",

    borderBottom:
      "1px solid rgba(255,255,255,.06)",

    background:
      "#111315",

    color:
      "#626973",

    fontSize: "11px",

    fontWeight:
      950,
  },


  boardTeamHeader: {
    minHeight:
      "54px",

    padding:
      "7px",

    display:
      "grid",

    alignContent:
      "center",

    gap:
      "3px",

    borderRight:
      "1px solid rgba(255,255,255,.05)",

    borderBottom:
      "1px solid rgba(255,255,255,.06)",

    background:
      "#121417",

    color:
      "#bdc2c8",

    fontSize: "11px",
  },


  boardTeamHeaderMine: {
    background:
      "linear-gradient(180deg,rgba(180,25,18,.14),rgba(255,100,15,.03))",

    boxShadow:
      "inset 0 -2px #ff6f1b",
  },


  boardRoundCell: {
    position:
      "sticky" as const,

    left:
      0,

    zIndex:
      3,

    minHeight:
      "72px",

    display:
      "grid",

    placeContent:
      "center",

    gap:
      "2px",

    borderRight:
      "1px solid rgba(255,255,255,.06)",

    borderBottom:
      "1px solid rgba(255,255,255,.05)",

    background:
      "#101214",

    color:
      "#7c838d",

    fontSize: "11px",

    textAlign:
      "center" as const,
  },


  boardCell: {
    minHeight:
      "72px",

    padding:
      "7px",

    display:
      "grid",

    alignContent:
      "center",

    gap:
      "3px",

    borderRight:
      "1px solid rgba(255,255,255,.04)",

    borderBottom:
      "1px solid rgba(255,255,255,.04)",

    background:
      "#0f1113",
  },


  boardCellMine: {
    background:
      "rgba(255,95,15,.023)",
  },


  boardCellCurrent: {
    outline:
      "1px solid #ff6d1b",

    outlineOffset:
      "-2px",

    background:
      "linear-gradient(135deg,rgba(180,25,18,.16),rgba(255,95,15,.06))",
  },


  boardPickNumber: {
    color:
      "#565d66",

    fontSize: "11px",

    fontWeight:
      900,
  },


  boardPlayerName: {
    overflow:
      "hidden",

    textOverflow:
      "ellipsis",

    whiteSpace:
      "nowrap" as const,

    color:
      "#e6e8eb",

    fontSize: "11px",
  },


  boardPlayerMeta: {
    color:
      "#747b85",

    fontSize: "11px",
  },


  boardOpen: {
    color:
      "#4e555e",

    fontSize: "11px",
  },


  placeholderPanel: {
    height:
      "100%",

    padding:
      "30px",

    display:
      "grid",

    placeContent:
      "center",

    gap:
      "6px",

    color:
      "#777e87",

    fontSize: "11px",

    textAlign:
      "center" as const,
  },


  miniRoster: {
    padding:
      "8px",
  },


  positionBreakdown: {
    display:
      "grid",

    gridTemplateColumns:
      "repeat(3,1fr)",

    gap:
      "5px",

    marginBottom:
      "8px",
  },


  positionCount: {
    padding:
      "6px",

    display:
      "flex",

    alignItems:
      "baseline",

    justifyContent:
      "center",

    gap:
      "3px",

    border:
      "1px solid rgba(255,255,255,.05)",

    borderRadius:
      "5px",

    background:
      "#111315",

    color:
      "#7a818b",

    fontSize: "11px",
  },


  miniRosterPlayers: {
    display:
      "grid",

    gap:
      "4px",
  },


  miniRosterPlayer: {
    minHeight:
      "28px",

    padding:
      "4px 6px",

    display:
      "grid",

    gridTemplateColumns:
      "32px minmax(0,1fr)",

    gap:
      "5px",

    alignItems:
      "center",

    borderBottom:
      "1px solid rgba(255,255,255,.035)",

    color:
      "#d9dde1",

    fontSize: "11px",
  },


  positionBadgeSmall: {
    color:
      "#ff8426",

    fontSize: "11px",

    fontWeight:
      950,
  },


  miniHistory: {
    padding:
      "7px",

    display:
      "grid",

    gap:
      "4px",
  },


  miniHistoryRow: {
    minHeight:
      "35px",

    display:
      "grid",

    gridTemplateColumns:
      "28px minmax(0,1fr)",

    gap:
      "5px",

    alignItems:
      "center",

    borderBottom:
      "1px solid rgba(255,255,255,.035)",
  },


  miniHistoryPick: {
    color:
      "#ff8425",

    fontSize: "11px",

    fontWeight:
      950,
  },


  miniHistoryText: {
    minWidth:
      0,

    display:
      "grid",

    gap:
      "2px",

    color:
      "#dce0e4",

    fontSize: "11px",
  },


  mutedText: {
    color:
      "#646b74",

    fontSize: "11px",
  },


  loadingCard: {
    width:
      "min(720px,100%)",

    margin:
      "60px auto",

    padding:
      "24px",

    border:
      "1px solid rgba(255,255,255,.07)",

    borderRadius:
      "8px",

    background:
      "#121416",

    color:
      "#8e959e",

    textAlign:
      "center" as const,
  },


  errorCard: {
    width:
      "min(720px,100%)",

    margin:
      "60px auto",

    padding:
      "24px",

    border:
      "1px solid rgba(255,80,65,.16)",

    borderRadius:
      "8px",

    background:
      "#121416",

    color:
      "#ff756d",

    textAlign:
      "center" as const,
  },


  historySidebar: {
    minWidth:
      0,
  },


  historySidebarBody: {
    maxHeight:
      "760px",

    overflowY:
      "auto" as const,
  },


  historyRoundLabel: {
    padding:
      "9px 10px",

    borderBottom:
      "1px solid rgba(255,255,255,.05)",

    color:
      "#6488b0",

    fontSize: "11px",

    fontWeight:
      950,
  },


  historySidebarRows: {
    display:
      "grid",
  },


  historySidebarRow: {
    minHeight:
      "62px",

    padding:
      "7px 8px",

    display:
      "grid",

    gridTemplateColumns:
      "25px 34px minmax(0,1fr)",

    alignItems:
      "center",

    gap:
      "7px",

    borderBottom:
      "1px solid rgba(255,255,255,.045)",
  },


  historySidebarRowCurrent: {
    background:
      "linear-gradient(90deg,rgba(185,25,18,.11),rgba(255,100,15,.025))",

    boxShadow:
      "inset 2px 0 #ff6d18",
  },


  historySidebarPick: {
    color:
      "#f2f3f5",

    fontSize: "12px",

    fontWeight:
      1000,

    textAlign:
      "center" as const,
  },


  historyEmptyAvatar: {
    width:
      "34px",

    height:
      "34px",

    display:
      "flex",

    alignItems:
      "center",

    justifyContent:
      "center",

    borderRadius:
      "50%",

    background:
      "#1e2125",

    color:
      "#747b84",

    fontSize: "11px",

    fontWeight:
      950,
  },


  historySidebarText: {
    minWidth:
      0,

    display:
      "grid",

    gap:
      "2px",

    color:
      "#a8aeb6",

    fontSize: "11px",
  },


  workspaceControlGrid: {
    padding:
      "8px",

    display:
      "grid",

    gridTemplateColumns:
      "1.15fr .9fr .9fr 1fr",

    gap:
      "7px",

    borderBottom:
      "1px solid rgba(255,255,255,.05)",
  },


  workspaceControlCard: {
    minHeight:
      "118px",

    padding:
      "10px",

    display:
      "grid",

    alignContent:
      "start",

    gap:
      "7px",

    border:
      "1px solid rgba(255,255,255,.06)",

    borderRadius:
      "6px",

    background:
      "#111315",
  },


  workspaceControlLabel: {
    color:
      "#ff7820",

    fontSize: "11px",

    fontWeight:
      1000,

    letterSpacing:
      ".04em",
  },


  workspaceClockRow: {
    display:
      "flex",

    alignItems:
      "center",

    justifyContent:
      "space-between",

    gap:
      "8px",
  },


  workspaceClockTeam: {
    minWidth:
      0,

    display:
      "grid",

    gap:
      "3px",

    color:
      "#f1f2f3",

    fontSize: "12px",
  },


  workspaceClockValue: {
    color:
      "#ff5447",

    fontSize: "23px",

    fontWeight:
      1000,

    fontVariantNumeric:
      "tabular-nums",
  },


  workspaceControlFoot: {
    color:
      "#747b84",

    fontSize: "11px",

    fontWeight:
      900,

    textAlign:
      "right" as const,
  },


  workspaceSelectedPlayer: {
    display:
      "flex",

    alignItems:
      "center",

    gap:
      "7px",

    color:
      "#eef0f2",

    fontSize: "11px",
  },


  workspaceWaitingText: {
    color:
      "#d6d9dd",

    fontSize: "12px",

    fontWeight:
      800,

    lineHeight:
      1.45,
  },


  workspaceMode: {
    marginTop:
      "auto",

    color:
      "#ff7820",

    fontSize: "11px",

    fontWeight:
      1000,
  },


  audioOptionRow: {
    display:
      "flex",

    alignItems:
      "center",

    justifyContent:
      "space-between",

    gap:
      "8px",

    color:
      "#aeb3ba",

    fontSize: "11px",
  },


  miniToggle: {
    minWidth:
      "46px",

    padding:
      "3px 5px",

    display:
      "flex",

    alignItems:
      "center",

    justifyContent:
      "space-between",

    gap:
      "4px",

    border:
      "1px solid rgba(255,255,255,.07)",

    borderRadius:
      "999px",

    background:
      "#1c1f23",

    color:
      "#6e757e",

    fontSize: "11px",

    cursor:
      "pointer",
  },


  miniToggleOn: {
    color:
      "#64db91",

    border:
      "1px solid rgba(60,210,120,.18)",
  },


  miniToggleDot: {
    width:
      "8px",

    height:
      "8px",

    borderRadius:
      "50%",

    background:
      "#6c737c",
  },


  miniToggleDotOn: {
    background:
      "#58df8d",

    boxShadow:
      "0 0 7px rgba(80,220,140,.35)",
  },


  chatBadge: {
    minWidth:
      "14px",

    height:
      "14px",

    padding:
      "0 3px",

    display:
      "inline-flex",

    alignItems:
      "center",

    justifyContent:
      "center",

    borderRadius:
      "999px",

    background:
      "#b61f20",

    color:
      "#fff",

    fontSize: "11px",

    fontWeight:
      1000,
  },


  availableDraftFooter: {
    padding:
      "8px",

    display:
      "grid",

    gap:
      "5px",

    borderTop:
      "1px solid rgba(255,255,255,.05)",

    background:
      "#0e1012",
  },


  availableDraftButton: {
    width:
      "100%",

    border:
      0,

    borderRadius:
      "5px",

    padding:
      "9px",

    background:
      "linear-gradient(90deg,#c8191c,#ff5f08)",

    color:
      "#fff",

    fontSize: "12px",

    fontWeight:
      1000,

    cursor:
      "pointer",
  },


  availableDraftHint: {
    color:
      "#77808a",

    fontSize: "11px",

    textAlign:
      "center" as const,
  },


  myRosterPanel: {
    display:
      "grid",
  },


  myRosterTeam: {
    padding:
      "10px",

    display:
      "grid",

    gap:
      "3px",

    borderBottom:
      "1px solid rgba(255,255,255,.05)",

    color:
      "#f1f2f3",

    fontSize: "12px",
  },


  rosterCountGrid: {
    padding:
      "8px",

    display:
      "grid",

    gridTemplateColumns:
      "repeat(3,minmax(0,1fr))",

    gap:
      "5px",

    borderBottom:
      "1px solid rgba(255,255,255,.05)",
  },


  rosterCountChip: {
    minHeight:
      "34px",

    padding:
      "5px",

    display:
      "flex",

    alignItems:
      "center",

    justifyContent:
      "space-between",

    gap:
      "5px",

    border:
      "1px solid rgba(255,255,255,.055)",

    borderRadius:
      "5px",

    background:
      "#111315",

    color:
      "#7f8790",

    fontSize: "11px",
  },


  rosterPlayerHeader: {
    padding:
      "7px 8px",

    display:
      "grid",

    gridTemplateColumns:
      "40px minmax(0,1fr) 32px",

    gap:
      "6px",

    borderBottom:
      "1px solid rgba(255,255,255,.05)",

    color:
      "#666d76",

    fontSize: "11px",

    fontWeight:
      950,
  },


  rosterPlayerRows: {
    maxHeight:
      "640px",

    overflowY:
      "auto" as const,
  },


  rosterPlayerRow: {
    minHeight:
      "42px",

    padding:
      "6px 8px",

    display:
      "grid",

    gridTemplateColumns:
      "40px minmax(0,1fr) 32px",

    gap:
      "6px",

    alignItems:
      "center",

    borderBottom:
      "1px solid rgba(255,255,255,.04)",
  },


  rosterSlot: {
    color:
      "#f0f2f4",

    fontSize: "11px",

    fontWeight:
      950,
  },


  rosterPlayerIdentity: {
    minWidth:
      0,

    display:
      "flex",

    alignItems:
      "center",

    gap:
      "6px",

    color:
      "#dfe2e5",

    fontSize: "11px",
  },


  rosterEmptyPlayer: {
    color:
      "#5d646d",
  },


  rosterBye: {
    color:
      "#8c939c",

    fontSize: "11px",

    textAlign:
      "right" as const,
  },


  chatTestButton: {
    margin:
      "8px auto 0",

    border:
      "1px solid rgba(255,110,20,.16)",

    borderRadius:
      "5px",

    padding:
      "6px 8px",

    background:
      "rgba(255,95,15,.05)",

    color:
      "#ff8425",

    fontSize: "11px",

    fontWeight:
      950,

    cursor:
      "pointer",
  },



  availableDraftActionBar: {
    padding:
      "8px 10px",

    display:
      "grid",

    gridTemplateColumns:
      "minmax(0,1fr) minmax(190px,260px)",

    alignItems:
      "center",

    gap:
      "10px",

    borderBottom:
      "1px solid rgba(255,255,255,.07)",

    background:
      "#101214",
  },


  availableDraftSelection: {
    minWidth:
      0,

    display:
      "grid",

    gap:
      "3px",

    color:
      "#7d858e",

    fontSize: "11px",

    fontWeight:
      900,
  },



  queueMoveControls: {
    display:
      "grid",

    gridTemplateColumns:
      "repeat(3,28px)",

    gap:
      "4px",

    justifyContent:
      "end",
  },


  queueMoveButton: {
    width:
      "28px",

    height:
      "28px",

    border:
      "1px solid rgba(255,255,255,.07)",

    borderRadius:
      "5px",

    background:
      "#191b1e",

    color:
      "#c4c9cf",

    fontSize: "12px",

    fontWeight:
      1000,

    cursor:
      "pointer",
  },


  chatPanel: {
    height:
      "100%",

    minHeight:
      0,

    display:
      "grid",

    gridTemplateRows:
      "minmax(0,1fr) auto",

    background:
      "#0f1113",
  },


  chatMessages: {
    minHeight:
      0,

    padding:
      "10px",

    display:
      "grid",

    alignContent:
      "start",

    gap:
      "8px",

    overflowY:
      "auto" as const,
  },


  chatMessageRow: {
    maxWidth:
      "78%",

    display:
      "grid",

    gap:
      "4px",
  },


  chatMessageRowMine: {
    marginLeft:
      "auto",
  },


  chatMessageMeta: {
    display:
      "flex",

    alignItems:
      "center",

    gap:
      "7px",

    color:
      "#7a818a",

    fontSize: "11px",
  },


  chatBubble: {
    padding:
      "8px 10px",

    border:
      "1px solid rgba(255,255,255,.06)",

    borderRadius:
      "8px",

    background:
      "#17191c",

    color:
      "#eef0f2",

    fontSize: "12px",

    lineHeight:
      1.45,

    overflowWrap:
      "anywhere" as const,
  },


  chatComposer: {
    padding:
      "9px",

    display:
      "grid",

    gridTemplateColumns:
      "minmax(0,1fr) 82px",

    gap:
      "7px",

    borderTop:
      "1px solid rgba(255,255,255,.06)",

    background:
      "#111315",
  },


  chatInput: {
    minWidth:
      0,

    padding:
      "9px 10px",

    border:
      "1px solid rgba(255,255,255,.08)",

    borderRadius:
      "6px",

    outline:
      "none",

    background:
      "#0c0e10",

    color:
      "#f1f2f4",

    fontSize: "12px",
  },


  chatSendButton: {
    border:
      0,

    borderRadius:
      "6px",

    background:
      "linear-gradient(135deg,#b71d1b,#ff6512)",

    color:
      "#fff",

    fontSize: "11px",

    fontWeight:
      1000,

    cursor:
      "pointer",
  },



  nextPickCountdown: {
    marginTop:
      "2px",

    padding:
      "7px 8px",

    display:
      "flex",

    alignItems:
      "center",

    justifyContent:
      "space-between",

    gap:
      "8px",

    border:
      "1px solid rgba(255,105,20,.12)",

    borderRadius:
      "5px",

    background:
      "rgba(255,95,15,.045)",

    color:
      "#8b929b",

    fontSize: "11px",

    fontWeight:
      900,
  },



  byeWeekText: {
    color:
      "#c0c5cb",

    fontSize: "11px",

    fontWeight:
      850,

    textAlign:
      "center" as const,
  },


  injuryHealthy: {
    color:
      "#505760",

    fontSize: "11px",

    textAlign:
      "center" as const,
  },


  injuryBadge: {
    width:
      "fit-content",

    minWidth:
      "25px",

    padding:
      "3px 5px",

    display:
      "inline-flex",

    alignItems:
      "center",

    justifyContent:
      "center",

    border:
      "1px solid rgba(255,182,60,.22)",

    borderRadius:
      "4px",

    background:
      "rgba(255,164,35,.08)",

    color:
      "#ffb14a",

    fontSize: "11px",

    fontWeight:
      1000,

    cursor:
      "help",
  },



  injuryBadgeClickable: {
    cursor:
      "pointer",

    textDecoration:
      "underline",

    textUnderlineOffset:
      "2px",
  },


  inlineDraftButton: {
    minHeight:
      "30px",

    padding:
      "6px 9px",

    border:
      0,

    borderRadius:
      "5px",

    background:
      "linear-gradient(135deg,#ad1717,#ff6512)",

    color:
      "#fff",

    fontSize: "11px",

    fontWeight:
      950,

    cursor:
      "pointer",

    whiteSpace:
      "nowrap" as const,
  },


  injuryReportOverlay: {
    position:
      "fixed" as const,
    inset:
      0,
    zIndex:
      1000,
    display:
      "grid",
    placeItems:
      "center",
    padding:
      "20px",
    background:
      "rgba(0,0,0,.76)",
  },

  injuryReportModal: {
    width:
      "min(620px,96vw)",
    maxHeight:
      "88vh",
    overflowY:
      "auto" as const,
    border:
      "1px solid rgba(255,125,35,.28)",
    borderRadius:
      "12px",
    background:
      "linear-gradient(180deg,#17191d,#0f1114)",
    boxShadow:
      "0 28px 80px rgba(0,0,0,.55)",
  },

  injuryReportHeader: {
    display:
      "flex",
    justifyContent:
      "space-between",
    gap:
      "14px",
    padding:
      "18px",
    borderBottom:
      "1px solid rgba(255,255,255,.07)",
  },

  injuryReportEyebrow: {
    display:
      "block",
    color:
      "#ff8425",
    fontSize: "11px",
    fontWeight:
      1000,
    letterSpacing:
      ".08em",
  },

  injuryReportName: {
    display:
      "block",
    marginTop:
      "5px",
    color:
      "#fff",
    fontSize: "20px",
  },

  injuryReportMeta: {
    display:
      "block",
    marginTop:
      "5px",
    color:
      "#aab0b8",
    fontSize: "12px",
  },

  injuryReportClose: {
    width:
      "34px",
    height:
      "34px",
    border:
      "1px solid rgba(255,255,255,.1)",
    borderRadius:
      "7px",
    background:
      "#1d2024",
    color:
      "#fff",
    fontSize: "20px",
    cursor:
      "pointer",
  },

  injuryReportBody: {
    display:
      "grid",
    gap:
      "16px",
    padding:
      "18px",
  },

  injuryReportStatusRow: {
    display:
      "flex",
    alignItems:
      "center",
    gap:
      "12px",
  },

  injuryReportStatusText: {
    display:
      "grid",
    gap:
      "2px",
    color:
      "#fff",
    fontSize: "13px",
  },

  injuryReportGrid: {
    display:
      "grid",
    gridTemplateColumns:
      "repeat(2,minmax(0,1fr))",
    gap:
      "10px",
  },

  injuryReportDetail: {
    padding:
      "14px",
    border:
      "1px solid rgba(255,255,255,.07)",
    borderRadius:
      "8px",
    background:
      "#111317",
    color:
      "#c8cdd4",
    fontSize: "12px",
    lineHeight:
      1.55,
  },


  playerNameButton: {
    width:
      "fit-content",

    maxWidth:
      "100%",

    padding:
      0,

    border:
      0,

    background:
      "transparent",

    color:
      "#f0f2f4",

    font:
      "inherit",

    fontWeight:
      950,

    textAlign:
      "left" as const,

    cursor:
      "pointer",

    textDecoration:
      "underline",

    textDecorationColor:
      "rgba(255,120,35,.45)",

    textUnderlineOffset:
      "2px",
  },


  profileOverlay: {
    position:
      "fixed" as const,

    inset:
      0,

    zIndex:
      1000,

    padding:
      "28px",

    display:
      "flex",

    alignItems:
      "center",

    justifyContent:
      "center",

    background:
      "rgba(0,0,0,.74)",

    backdropFilter:
      "blur(3px)",
  },


  profileModal: {
    width:
      "min(760px,96vw)",

    maxHeight:
      "88vh",

    overflowY:
      "auto" as const,

    border:
      "1px solid rgba(255,110,25,.18)",

    borderRadius:
      "10px",

    background:
      "linear-gradient(180deg,#17191c,#0f1113)",

    boxShadow:
      "0 24px 80px rgba(0,0,0,.5)",
  },


  profileHeader: {
    padding:
      "14px",

    display:
      "flex",

    alignItems:
      "center",

    justifyContent:
      "space-between",

    gap:
      "14px",

    borderBottom:
      "1px solid rgba(255,255,255,.06)",
  },


  profileIdentity: {
    display:
      "flex",

    alignItems:
      "center",

    gap:
      "12px",
  },


  profileName: {
    color:
      "#f5f6f7",

    fontSize: "17px",

    fontWeight:
      1000,
  },


  profileMeta: {
    marginTop:
      "4px",

    color:
      "#ffffff",

    fontSize: "15px",
  },


  profileInjuryLine: {
    marginTop:
      "7px",

    display:
      "flex",

    alignItems:
      "center",

    gap:
      "7px",

    color:
      "#ffffff",

    fontSize: "15px",

    fontWeight:
      850,
  },


  profileClose: {
    width:
      "34px",

    height:
      "34px",

    border:
      "1px solid rgba(255,255,255,.07)",

    borderRadius:
      "6px",

    background:
      "#1b1d20",

    color:
      "#c6cbd1",

    fontSize: "18px",

    cursor:
      "pointer",
  },


  profileLoading: {
    padding:
      "40px",

    color:
      "#ffffff",

    fontSize: "15px",

    textAlign:
      "center" as const,
  },


  profileContent: {
    padding:
      "12px",

    display:
      "grid",

    gap:
      "12px",
  },


  profileSection: {
    overflow:
      "hidden",

    border:
      "1px solid rgba(255,255,255,.055)",

    borderRadius:
      "7px",

    background:
      "#111315",
  },


  profileSectionHeader: {
    padding:
      "10px 11px",

    borderBottom:
      "1px solid rgba(255,255,255,.08)",

    color:
      "#ffffff",

    fontSize: "15px",

    fontWeight:
      1000,
  },


  profileStatsGrid: {
    padding:
      "10px",

    display:
      "grid",

    gridTemplateColumns:
      "repeat(4,minmax(0,1fr))",

    gap:
      "7px",
  },


  profileStatCard: {
    minHeight:
      "76px",

    padding:
      "11px",

    display:
      "grid",

    alignContent:
      "center",

    gap:
      "6px",

    border:
      "1px solid rgba(255,255,255,.09)",

    borderRadius:
      "6px",

    background:
      "#0d0f11",

    color:
      "#ffffff",

    fontSize: "15px",
  },


  profileNoStats: {
    gridColumn:
      "1 / -1",

    padding:
      "25px",

    color:
      "#ffffff",

    fontSize: "15px",

    textAlign:
      "center" as const,
  },


  projectionHero: {
    margin:
      "12px",

    padding:
      "18px",

    display:
      "grid",

    gap:
      "5px",

    border:
      "1px solid rgba(255,108,20,.13)",

    borderRadius:
      "7px",

    background:
      "linear-gradient(135deg,rgba(183,28,23,.12),rgba(255,102,12,.04))",

    color:
      "#9ca3ab",

    fontSize: "11px",

    textAlign:
      "center" as const,
  },


  profileProjectionNote: {
    padding:
      "0 12px 14px",

    color:
      "#737b84",

    fontSize: "11px",

    lineHeight:
      1.5,
  },

} as const;





