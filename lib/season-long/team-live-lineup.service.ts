import type { SupabaseClient } from "@supabase/supabase-js";

export type SeasonLongLiveStats = {
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
  defensiveTotalTackles: number;
  defensiveTacklesForLoss: number;
  dstSacks: number;
  dstInterceptions: number;
  dstFumbleRecoveries: number;
  dstTouchdowns: number;
  dstSafeties: number;
  dstBlockedKicks: number;
  dstPointsAllowed: number;
  dstYardsAllowed: number;
};

export type SeasonLongGameContext = {
  nflGameId: number;
  statusName: string | null;
  statusDetail: string | null;
  statusCompleted: boolean;
  isActuallyLive: boolean;
  period: number | null;
  clock: string | null;
};

export type SeasonLongLiveLineupPlayer = {
  playerId: number;
  lineupSlot: string;
  slotIndex: number;
  fullName: string;
  position: string;
  jerseyNumber: string | null;
  teamAbbreviation: string | null;
  opponentAbbreviation: string | null;
  opponentPrefix: "vs" | "@" | null;
  projectedPoints: number;
  fantasyPoints: number;
  salary: number | null;
  nflGameId: number | null;
  gameStartAt: string | null;
  isLocked: boolean;
  scoreIsLive: boolean;
  scoreIsFinal: boolean;
  isRevealed: boolean;
  gameContext: SeasonLongGameContext | null;
  stats: SeasonLongLiveStats;
};

export type SeasonLongTeamLiveLineupData = {
  team: {
    id: number;
    teamName: string;
    isMyTeam: boolean;
  };
  season: number;
  week: number;
  selectionMode: "salary" | "no_salary";
  entryStatus: string;
  weekPoints: number;
  projectedPoints: number;
  salaryUsed: number | null;
  lineupPlayerCount: number;
  isFinal: boolean;
  players: SeasonLongLiveLineupPlayer[];
  hasLiveGames: boolean;
  shouldAutoRefresh: boolean;
};

type TeamRow = {
  id: number;
  team_name: string;
  active: boolean | null;
};

type EntryRow = {
  status: string | null;
  salary_used: number | string | null;
  projected_points: number | string | null;
};

type WeeklyScoreRow = {
  fantasy_points: number | string | null;
  salary_used: number | string | null;
  lineup_player_count: number | null;
  is_final: boolean | null;
};

type LineupRow = {
  player_id: number;
  lineup_slot: string;
  slot_index: number;
  salary_at_selection: number | string | null;
  projected_points_at_selection: number | string | null;
  nfl_game_id: number | null;
  game_start_at: string | null;
  opponent_abbreviation: string | null;
  home_or_away: string | null;
  is_locked: boolean | null;
};

type PlayerRow = {
  id: number;
  full_name: string;
  primary_position: string | null;
  team_abbreviation: string | null;
  jersey_number: string | null;
};

type ScoreRow = {
  nfl_game_id: number;
  nfl_player_id: number;
  player_game_stat_id: number | null;
  fantasy_points: number | string | null;
  is_live: boolean | null;
  is_final: boolean | null;
};

type StatsRow = {
  id: number;
  nfl_game_id: number;
  nfl_player_id: number;
  game_status: string | null;
  passing_attempts: number | null;
  passing_completions: number | null;
  passing_yards: number | null;
  passing_touchdowns: number | null;
  passing_interceptions: number | null;
  rushing_attempts: number | null;
  rushing_yards: number | null;
  rushing_touchdowns: number | null;
  receiving_targets: number | null;
  receptions: number | null;
  receiving_yards: number | null;
  receiving_touchdowns: number | null;
  fumbles_lost: number | null;
  field_goals_made: number | null;
  field_goals_attempted: number | null;
  extra_points_made: number | null;
  extra_points_attempted: number | null;
  defensive_total_tackles: number | null;
  defensive_tackles_for_loss: number | null;
  dst_sacks: number | string | null;
  dst_interceptions: number | null;
  dst_fumble_recoveries: number | null;
  dst_touchdowns: number | null;
  dst_safeties: number | null;
  dst_blocked_kicks: number | null;
  dst_points_allowed: number | null;
  dst_yards_allowed: number | null;
};

function numberValue(value: number | string | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizePosition(value: string | null | undefined): string {
  const position = (value ?? "").trim().toUpperCase();
  return position === "PK" ? "K" : position || "—";
}

function scoreKey(playerId: number, gameId: number | null): string {
  return `${playerId}:${gameId ?? "none"}`;
}

function isLiveStatus(value: string | null | undefined): boolean {
  const status = (value ?? "").toUpperCase();
  return (
    status.includes("IN_PROGRESS") ||
    status.includes("HALFTIME") ||
    status.includes("END_PERIOD") ||
    status.includes("DELAYED")
  );
}

function emptyStats(): SeasonLongLiveStats {
  return {
    passingAttempts: 0,
    passingCompletions: 0,
    passingYards: 0,
    passingTouchdowns: 0,
    passingInterceptions: 0,
    rushingAttempts: 0,
    rushingYards: 0,
    rushingTouchdowns: 0,
    receivingTargets: 0,
    receptions: 0,
    receivingYards: 0,
    receivingTouchdowns: 0,
    fumblesLost: 0,
    fieldGoalsMade: 0,
    fieldGoalsAttempted: 0,
    extraPointsMade: 0,
    extraPointsAttempted: 0,
    defensiveTotalTackles: 0,
    defensiveTacklesForLoss: 0,
    dstSacks: 0,
    dstInterceptions: 0,
    dstFumbleRecoveries: 0,
    dstTouchdowns: 0,
    dstSafeties: 0,
    dstBlockedKicks: 0,
    dstPointsAllowed: 0,
    dstYardsAllowed: 0,
  };
}

function normalizeStats(row: StatsRow | null | undefined): SeasonLongLiveStats {
  if (!row) return emptyStats();

  return {
    passingAttempts: numberValue(row.passing_attempts),
    passingCompletions: numberValue(row.passing_completions),
    passingYards: numberValue(row.passing_yards),
    passingTouchdowns: numberValue(row.passing_touchdowns),
    passingInterceptions: numberValue(row.passing_interceptions),
    rushingAttempts: numberValue(row.rushing_attempts),
    rushingYards: numberValue(row.rushing_yards),
    rushingTouchdowns: numberValue(row.rushing_touchdowns),
    receivingTargets: numberValue(row.receiving_targets),
    receptions: numberValue(row.receptions),
    receivingYards: numberValue(row.receiving_yards),
    receivingTouchdowns: numberValue(row.receiving_touchdowns),
    fumblesLost: numberValue(row.fumbles_lost),
    fieldGoalsMade: numberValue(row.field_goals_made),
    fieldGoalsAttempted: numberValue(row.field_goals_attempted),
    extraPointsMade: numberValue(row.extra_points_made),
    extraPointsAttempted: numberValue(row.extra_points_attempted),
    defensiveTotalTackles: numberValue(row.defensive_total_tackles),
    defensiveTacklesForLoss: numberValue(row.defensive_tackles_for_loss),
    dstSacks: numberValue(row.dst_sacks),
    dstInterceptions: numberValue(row.dst_interceptions),
    dstFumbleRecoveries: numberValue(row.dst_fumble_recoveries),
    dstTouchdowns: numberValue(row.dst_touchdowns),
    dstSafeties: numberValue(row.dst_safeties),
    dstBlockedKicks: numberValue(row.dst_blocked_kicks),
    dstPointsAllowed: numberValue(row.dst_points_allowed),
    dstYardsAllowed: numberValue(row.dst_yards_allowed),
  };
}

function normalizeGameContext(gameId: number, raw: unknown): SeasonLongGameContext | null {
  if (!raw || typeof raw !== "object") return null;

  const value = raw as Record<string, unknown>;
  const statusName =
    typeof value.statusName === "string"
      ? value.statusName
      : typeof value.status_name === "string"
        ? value.status_name
        : null;

  const statusDetail =
    typeof value.statusDetail === "string"
      ? value.statusDetail
      : typeof value.status_detail === "string"
        ? value.status_detail
        : null;

  const statusCompleted = Boolean(
    value.statusCompleted ?? value.status_completed ?? false
  );

  const rawPeriod = value.period;
  const period =
    typeof rawPeriod === "number"
      ? rawPeriod
      : Number.isFinite(Number(rawPeriod))
        ? Number(rawPeriod)
        : null;

  const clock =
    typeof value.clock === "string"
      ? value.clock
      : typeof value.clockDisplay === "string"
        ? value.clockDisplay
        : typeof value.clock_display === "string"
          ? value.clock_display
          : null;

  return {
    nflGameId: gameId,
    statusName,
    statusDetail,
    statusCompleted,
    isActuallyLive: !statusCompleted && isLiveStatus(statusName),
    period,
    clock,
  };
}

export async function getSeasonLongTeamLiveLineupData(
  supabase: SupabaseClient,
  input: {
    leagueId: string;
    fantasyTeamId: number;
    viewerFantasyTeamId: number | null;
    season: number;
    week: number;
    selectionMode: "salary" | "no_salary";
    activeWeek: number;
  }
): Promise<SeasonLongTeamLiveLineupData> {
  const {
    leagueId,
    fantasyTeamId,
    viewerFantasyTeamId,
    season,
    week,
    selectionMode,
    activeWeek,
  } = input;

  const [teamResult, entryResult, weeklyScoreResult, lineupResult] =
    await Promise.all([
      supabase
        .from("fantasy_teams")
        .select("id, team_name, active")
        .eq("league_id", leagueId)
        .eq("id", fantasyTeamId)
        .maybeSingle(),

      supabase
        .from("season_long_weekly_entries")
        .select("status, salary_used, projected_points")
        .eq("league_id", leagueId)
        .eq("fantasy_team_id", fantasyTeamId)
        .eq("season", season)
        .eq("week", week)
        .maybeSingle(),

      supabase
        .from("season_long_weekly_scores")
        .select("fantasy_points, salary_used, lineup_player_count, is_final")
        .eq("league_id", leagueId)
        .eq("fantasy_team_id", fantasyTeamId)
        .eq("season", season)
        .eq("week", week)
        .maybeSingle(),

      supabase
        .from("season_long_weekly_lineups")
        .select(`
          player_id,
          lineup_slot,
          slot_index,
          salary_at_selection,
          projected_points_at_selection,
          nfl_game_id,
          game_start_at,
          opponent_abbreviation,
          home_or_away,
          is_locked
        `)
        .eq("league_id", leagueId)
        .eq("fantasy_team_id", fantasyTeamId)
        .eq("season", season)
        .eq("week", week)
        .order("lineup_slot", { ascending: true })
        .order("slot_index", { ascending: true }),
    ]);

  if (teamResult.error) {
    throw new Error(`Could not load Season-Long team: ${teamResult.error.message}`);
  }
  if (!teamResult.data) {
    throw new Error("Season-Long team was not found in this league.");
  }
  if (entryResult.error) {
    throw new Error(`Could not load Season-Long entry: ${entryResult.error.message}`);
  }
  if (weeklyScoreResult.error) {
    throw new Error(
      `Could not load Season-Long weekly score: ${weeklyScoreResult.error.message}`
    );
  }
  if (lineupResult.error) {
    throw new Error(`Could not load Season-Long lineup: ${lineupResult.error.message}`);
  }

  const team = teamResult.data as TeamRow;
  const entry = entryResult.data as EntryRow | null;
  const weeklyScore = weeklyScoreResult.data as WeeklyScoreRow | null;
  const lineup = (lineupResult.data ?? []) as LineupRow[];

  const playerIds = Array.from(new Set(lineup.map((row) => row.player_id)));
  const gameIds = Array.from(
    new Set(
      lineup
        .map((row) => row.nfl_game_id)
        .filter((id): id is number => typeof id === "number" && Number.isInteger(id))
    )
  );

  const playerMap = new Map<number, PlayerRow>();

  if (playerIds.length > 0) {
    const playerResult = await supabase
      .from("nfl_players")
      .select(`
        id,
        full_name,
        primary_position,
        team_abbreviation,
        jersey_number
      `)
      .in("id", playerIds);

    if (playerResult.error) {
      throw new Error(`Could not load NFL players: ${playerResult.error.message}`);
    }

    for (const player of (playerResult.data ?? []) as PlayerRow[]) {
      playerMap.set(player.id, player);
    }
  }

  const scoreMap = new Map<string, ScoreRow>();
  const scoreByPlayerMap = new Map<number, ScoreRow>();

  if (playerIds.length > 0) {
    const scoreResult = await supabase
      .from("fantasy_player_game_scores")
      .select(`
        nfl_game_id,
        nfl_player_id,
        player_game_stat_id,
        fantasy_points,
        is_live,
        is_final
      `)
      .eq("league_id", leagueId)
      .eq("season", season)
      .eq("season_type", 2)
      .eq("week", week)
      .in("nfl_player_id", playerIds);

    if (scoreResult.error) {
      throw new Error(
        `Could not load Season-Long player fantasy scores: ${scoreResult.error.message}`
      );
    }

    for (const row of (scoreResult.data ?? []) as ScoreRow[]) {
      scoreMap.set(scoreKey(row.nfl_player_id, row.nfl_game_id), row);
      scoreByPlayerMap.set(row.nfl_player_id, row);
    }
  }

  const statsSelect = `
    id,
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
    defensive_total_tackles,
    defensive_tackles_for_loss,
    dst_sacks,
    dst_interceptions,
    dst_fumble_recoveries,
    dst_touchdowns,
    dst_safeties,
    dst_blocked_kicks,
    dst_points_allowed,
    dst_yards_allowed
  `;

  const statsById = new Map<number, StatsRow>();
  const statsByPlayerGame = new Map<string, StatsRow>();

  const linkedStatIds = Array.from(
    new Set(
      Array.from(scoreMap.values())
        .map((row) => row.player_game_stat_id)
        .filter(
          (id): id is number => typeof id === "number" && Number.isInteger(id)
        )
    )
  );

  if (linkedStatIds.length > 0) {
    const linkedStatsResult = await supabase
      .from("nfl_player_game_stats")
      .select(statsSelect)
      .in("id", linkedStatIds);

    if (linkedStatsResult.error) {
      throw new Error(
        `Could not load linked NFL player stats: ${linkedStatsResult.error.message}`
      );
    }

    for (const row of (linkedStatsResult.data ?? []) as StatsRow[]) {
      statsById.set(row.id, row);
      statsByPlayerGame.set(scoreKey(row.nfl_player_id, row.nfl_game_id), row);
    }
  }

  if (playerIds.length > 0 && gameIds.length > 0) {
    const fallbackStatsResult = await supabase
      .from("nfl_player_game_stats")
      .select(statsSelect)
      .eq("season", season)
      .eq("season_type", 2)
      .eq("week", week)
      .in("nfl_player_id", playerIds)
      .in("nfl_game_id", gameIds);

    if (fallbackStatsResult.error) {
      throw new Error(
        `Could not load NFL player game stats: ${fallbackStatsResult.error.message}`
      );
    }

    for (const row of (fallbackStatsResult.data ?? []) as StatsRow[]) {
      const key = scoreKey(row.nfl_player_id, row.nfl_game_id);
      if (!statsByPlayerGame.has(key)) {
        statsByPlayerGame.set(key, row);
      }
    }
  }

  const gameContextMap = new Map<number, SeasonLongGameContext>();

  await Promise.all(
    gameIds.map(async (gameId) => {
      const contextResult = await supabase.rpc("get_current_nfl_game_context", {
        p_nfl_game_id: gameId,
      });

      if (contextResult.error) return;

      const normalized = normalizeGameContext(gameId, contextResult.data);
      if (normalized) gameContextMap.set(gameId, normalized);
    })
  );

  const isMyTeam = viewerFantasyTeamId === fantasyTeamId;
  const now = Date.now();

  const players: SeasonLongLiveLineupPlayer[] = lineup.map((row) => {
    const player = playerMap.get(row.player_id);
    const exactScore = row.nfl_game_id
      ? scoreMap.get(scoreKey(row.player_id, row.nfl_game_id))
      : undefined;
    const score = exactScore ?? scoreByPlayerMap.get(row.player_id);

    const linkedStat =
      typeof score?.player_game_stat_id === "number"
        ? statsById.get(score.player_game_stat_id)
        : undefined;

    const fallbackStat = row.nfl_game_id
      ? statsByPlayerGame.get(scoreKey(row.player_id, row.nfl_game_id))
      : undefined;

    const stat = linkedStat ?? fallbackStat;
    const context = row.nfl_game_id
      ? gameContextMap.get(row.nfl_game_id) ?? null
      : null;

    const startedByClock =
      row.game_start_at !== null &&
      Number.isFinite(new Date(row.game_start_at).getTime()) &&
      now >= new Date(row.game_start_at).getTime();

    const isRevealed =
      isMyTeam ||
      startedByClock ||
      Boolean(row.is_locked) ||
      Boolean(score?.is_live) ||
      Boolean(score?.is_final) ||
      Boolean(context?.isActuallyLive) ||
      Boolean(context?.statusCompleted);

    const homeAway = (row.home_or_away ?? "").toLowerCase();
    const opponentPrefix: "vs" | "@" | null =
      homeAway === "away" ? "@" : row.opponent_abbreviation ? "vs" : null;

    return {
      playerId: row.player_id,
      lineupSlot: row.lineup_slot,
      slotIndex: row.slot_index,
      fullName: isRevealed ? player?.full_name ?? "Unknown Player" : "Hidden until kickoff",
      position: isRevealed ? normalizePosition(player?.primary_position) : "—",
      jerseyNumber: isRevealed ? player?.jersey_number ?? null : null,
      teamAbbreviation: isRevealed ? player?.team_abbreviation ?? null : null,
      opponentAbbreviation: row.opponent_abbreviation,
      opponentPrefix,
      projectedPoints: numberValue(row.projected_points_at_selection),
      fantasyPoints: numberValue(score?.fantasy_points),
      salary:
        selectionMode === "salary" ? numberValue(row.salary_at_selection) : null,
      nflGameId: row.nfl_game_id,
      gameStartAt: row.game_start_at,
      isLocked: Boolean(row.is_locked),
      scoreIsLive: Boolean(score?.is_live),
      scoreIsFinal: Boolean(score?.is_final),
      isRevealed,
      gameContext: context,
      stats: normalizeStats(stat),
    };
  });

  const playerPointRowsPresent = Array.from(scoreMap.values()).length > 0;
  const playerPoints = players.reduce((total, player) => total + player.fantasyPoints, 0);
  const projectedPoints = players.reduce(
    (total, player) => total + player.projectedPoints,
    0
  );
  const salaryUsed =
    selectionMode === "salary"
      ? players.reduce((total, player) => total + (player.salary ?? 0), 0)
      : null;

  const hasLiveGames = players.some(
    (player) => player.gameContext?.isActuallyLive || player.scoreIsLive
  );

  const allFinal =
    players.length > 0 &&
    players.every(
      (player) => player.gameContext?.statusCompleted || player.scoreIsFinal
    );

  return {
    team: {
      id: team.id,
      teamName: team.team_name,
      isMyTeam,
    },
    season,
    week,
    selectionMode,
    entryStatus: entry?.status ?? "not_started",
    weekPoints: playerPointRowsPresent
      ? Number(playerPoints.toFixed(2))
      : numberValue(weeklyScore?.fantasy_points),
    projectedPoints: Number(
      (projectedPoints || numberValue(entry?.projected_points)).toFixed(2)
    ),
    salaryUsed:
      selectionMode === "salary"
        ? Number(
            (salaryUsed ?? numberValue(entry?.salary_used ?? weeklyScore?.salary_used)).toFixed(0)
          )
        : null,
    lineupPlayerCount: players.length || weeklyScore?.lineup_player_count || 0,
    isFinal: allFinal || Boolean(weeklyScore?.is_final),
    players,
    hasLiveGames,
    shouldAutoRefresh: week === activeWeek && !allFinal,
  };
}
