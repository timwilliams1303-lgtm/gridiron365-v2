import { NextRequest, NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const NHL_API_BASE = "https://api-web.nhle.com/v1";
const ALLOWED_SEASONS = new Set([2023, 2024, 2025]);

/*
 * Maximum number of NEW games processed in one request.
 *
 * The v8 importer preserves the validated historical backfill fixes,
 * excludes shootout-attempt "goal" events before official hockey-goal
 * reconciliation, and keeps goalie-only upward goal reconciliation for
 * legitimate goalie goals. Use a 250-game ceiling to reduce the number
 * of manual historical backfill requests.
 */
const MAX_BATCH_SIZE = 250;
const DEFAULT_BATCH_SIZE = 5;

type JsonObject = Record<string, unknown>;

type DbGame = {
  id: number;
  nhl_game_id: string | null;
  season: number;
  season_type: string | null;
  home_team_id: number;
  away_team_id: number;
  home_score: number | null;
  away_score: number | null;
  status_completed: boolean | null;
  is_shootout: boolean | null;
};

type DbPlayer = {
  id: number;
  nhl_player_id: number | string | null;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  position: string | null;
  position_group: string | null;
  team_id: number | null;
  active: boolean | null;
};

type DbTeam = {
  id: number;
  nhl_team_id: number | string | null;
  abbreviation: string | null;
};

type PositionGroup =
  | "FORWARD"
  | "DEFENSE"
  | "GOALIE"
  | null;

type PlayerAccumulator = {
  nhlPlayerId: string;
  internalPlayerId: number;
  internalTeamId: number | null;

  position: string | null;
  positionGroup: PositionGroup;

  goals: number;
  pbpGoals: number;
  assists: number;
  points: number;
  plusMinus: number;
  penaltyMinutes: number;

  powerPlayGoals: number;
  powerPlayAssists: number;
  powerPlayPoints: number;

  shortHandedGoals: number;
  shortHandedAssists: number;
  shortHandedPoints: number;

  gameWinningGoals: number;

  shotsOnGoal: number;
  hits: number;
  blockedShots: number;
  takeaways: number;
  giveaways: number;

  faceoffWins: number;
  faceoffLosses: number;

  shifts: number;
  timeOnIceSeconds: number;

  goalieStarted: boolean;
  goalieDecision: string | null;

  saves: number;
  shotsAgainst: number;
  goalsAgainst: number;
  savePercentage: number | null;
  goalieMinutesSeconds: number;

  goalieWin: number;
  goalieLoss: number;
  goalieOvertimeLoss: number;
  shutout: number;

  rawBoxscore: JsonObject | null;
};

type GoalStrength = "PP" | "SH" | "EV";

type GoalEvent = {
  scorerId: string;
  assistIds: string[];
  scoringTeamId: number | null;
  awayScore: number;
  homeScore: number;
  sortOrder: number;
  strength: GoalStrength;
};

function isObject(
  value: unknown,
): value is JsonObject {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function asObject(
  value: unknown,
): JsonObject {
  return isObject(value) ? value : {};
}

function asArray(
  value: unknown,
): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(
  value: unknown,
): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();

    return trimmed.length > 0
      ? trimmed
      : null;
  }

  if (
    typeof value === "number" &&
    Number.isFinite(value)
  ) {
    return String(value);
  }

  return null;
}

function asNumber(
  value: unknown,
): number {
  if (
    typeof value === "number" &&
    Number.isFinite(value)
  ) {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value
      .trim()
      .replace(/,/g, "")
      .replace(/%$/, "");

    if (!normalized) {
      return 0;
    }

    const parsed = Number(normalized);

    return Number.isFinite(parsed)
      ? parsed
      : 0;
  }

  return 0;
}

function asNullableNumber(
  value: unknown,
): number | null {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const parsed = asNumber(value);

  return Number.isFinite(parsed)
    ? parsed
    : null;
}

function asBoolean(
  value: unknown,
): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value !== 0;
  }

  if (typeof value === "string") {
    const normalized = value
      .trim()
      .toLowerCase();

    return (
      normalized === "true" ||
      normalized === "1" ||
      normalized === "yes"
    );
  }

  return false;
}

function firstDefined(
  object: JsonObject,
  keys: string[],
): unknown {
  for (const key of keys) {
    if (
      Object.prototype.hasOwnProperty.call(
        object,
        key,
      ) &&
      object[key] !== null &&
      object[key] !== undefined
    ) {
      return object[key];
    }
  }

  return undefined;
}

function localizedString(
  value: unknown,
): string | null {
  if (typeof value === "string") {
    return asString(value);
  }

  const object = asObject(value);

  return (
    asString(object.default) ??
    asString(object.en) ??
    null
  );
}

function parseTimeToSeconds(
  value: unknown,
): number {
  const text = asString(value);

  if (!text) {
    return 0;
  }

  const parts = text
    .split(":")
    .map(Number);

  if (
    parts.length < 2 ||
    parts.length > 3 ||
    parts.some(
      (part) => !Number.isFinite(part),
    )
  ) {
    return 0;
  }

  if (parts.length === 2) {
    return Math.round(
      parts[0] * 60 + parts[1],
    );
  }

  return Math.round(
    parts[0] * 3600 +
      parts[1] * 60 +
      parts[2],
  );
}

function normalizePosition(
  value: unknown,
): string | null {
  const raw = asString(value);

  if (!raw) {
    return null;
  }

  const position = raw.toUpperCase();

  if (
    position === "C" ||
    position === "LW" ||
    position === "RW" ||
    position === "D" ||
    position === "G"
  ) {
    return position;
  }

  if (position === "L") {
    return "LW";
  }

  if (position === "R") {
    return "RW";
  }

  return position;
}

function normalizePositionGroup(
  value: unknown,
  position?: string | null,
): PositionGroup {
  const raw = asString(value);

  if (raw) {
    const normalized =
      raw.toUpperCase();

    if (
      normalized === "FORWARD" ||
      normalized === "F"
    ) {
      return "FORWARD";
    }

    if (
      normalized === "DEFENSE" ||
      normalized === "DEFENCE" ||
      normalized === "D"
    ) {
      return "DEFENSE";
    }

    if (
      normalized === "GOALIE" ||
      normalized === "G"
    ) {
      return "GOALIE";
    }
  }

  if (
    position === "C" ||
    position === "LW" ||
    position === "RW"
  ) {
    return "FORWARD";
  }

  if (position === "D") {
    return "DEFENSE";
  }

  if (position === "G") {
    return "GOALIE";
  }

  return null;
}

function isValidNhlPlayerId(
  value: string | null,
): value is string {
  return Boolean(
    value &&
      /^\d{6,}$/.test(value),
  );
}

function extractPlayerId(
  object: JsonObject,
): string | null {
  const value = asString(
    firstDefined(object, [
      "playerId",
      "nhlPlayerId",
    ]),
  );

  return isValidNhlPlayerId(value)
    ? value
    : null;
}

async function fetchNhlJson(
  path: string,
): Promise<JsonObject> {
  const response = await fetch(
    `${NHL_API_BASE}${path}`,
    {
      method: "GET",

      headers: {
        Accept: "application/json",
        "User-Agent":
          "Gridiron365/1.0",
      },

      cache: "no-store",

      signal:
        AbortSignal.timeout(30000),
    },
  );

  if (!response.ok) {
    throw new Error(
      `NHL HTTP ${response.status} for ${path}`,
    );
  }

  const json: unknown =
    await response.json();

  if (!isObject(json)) {
    throw new Error(
      `Unexpected NHL response for ${path}`,
    );
  }

  return json;
}

async function loadAllPlayers(
  supabase: SupabaseClient,
): Promise<DbPlayer[]> {
  const allRows: DbPlayer[] = [];
  const pageSize = 1000;

  for (
    let from = 0;
    ;
    from += pageSize
  ) {
    const { data, error } =
      await supabase
        .from("nhl_players")
        .select(
          "id, nhl_player_id, first_name, last_name, display_name, position, position_group, team_id, active",
        )
        .not(
          "nhl_player_id",
          "is",
          null,
        )
        .order("id", {
          ascending: true,
        })
        .range(
          from,
          from + pageSize - 1,
        );

    if (error) {
      throw new Error(
        `Failed loading NHL players: ${error.message}`,
      );
    }

    const rows =
      (data ?? []) as DbPlayer[];

    allRows.push(...rows);

    if (rows.length < pageSize) {
      break;
    }
  }

  return allRows;
}

async function loadAllTeams(
  supabase: SupabaseClient,
): Promise<DbTeam[]> {
  const { data, error } =
    await supabase
      .from("nhl_teams")
      .select(
        "id, nhl_team_id, abbreviation",
      )
      .not(
        "nhl_team_id",
        "is",
        null,
      )
      .order("id", {
        ascending: true,
      });

  if (error) {
    throw new Error(
      `Failed loading NHL teams: ${error.message}`,
    );
  }

  return (data ?? []) as DbTeam[];
}

/*
 * Load all completed regular-season games
 * for the requested historical season.
 *
 * We paginate so Supabase's normal row
 * response ceiling does not prevent us from
 * seeing the entire 1,312-game season.
 */
async function loadAllHistoricalGames(
  supabase: SupabaseClient,
  season: number,
): Promise<DbGame[]> {
  const allGames: DbGame[] = [];
  const pageSize = 1000;

  for (
    let from = 0;
    ;
    from += pageSize
  ) {
    const { data, error } =
      await supabase
        .from("nhl_games")
        .select(
          "id, nhl_game_id, season, season_type, home_team_id, away_team_id, home_score, away_score, status_completed, is_shootout",
        )
        .eq("season", season)
        .eq(
          "season_type",
          "regular",
        )
        .eq(
          "status_completed",
          true,
        )
        .not(
          "nhl_game_id",
          "is",
          null,
        )
        .order("id", {
          ascending: true,
        })
        .range(
          from,
          from + pageSize - 1,
        );

    if (error) {
      throw new Error(
        `Failed loading NHL games: ${error.message}`,
      );
    }

    const rows =
      (data ?? []) as DbGame[];

    allGames.push(...rows);

    if (rows.length < pageSize) {
      break;
    }
  }

  return allGames;
}

/*
 * Load the set of games that already contain
 * historical player-game stats.
 *
 * This is deliberately paginated independently
 * of the game query.
 *
 * The previous candidate-window approach could
 * repeatedly select already-populated games.
 * This version builds one authoritative set of
 * completed game IDs first, then selects only
 * genuinely unprocessed games.
 */
async function loadGamesWithExistingStats(
  supabase: SupabaseClient,
  gameIds: number[],
): Promise<Set<number>> {
  const completed =
    new Set<number>();

  if (gameIds.length === 0) {
    return completed;
  }

  /*
   * Query game IDs in chunks to avoid oversized
   * PostgREST IN filters.
   */
  const idChunkSize = 200;

  for (
    let start = 0;
    start < gameIds.length;
    start += idChunkSize
  ) {
    const chunk = gameIds.slice(
      start,
      start + idChunkSize,
    );

    let from = 0;
    const pageSize = 1000;

    for (;;) {
      const { data, error } =
        await supabase
          .from(
            "nhl_player_game_stats",
          )
          .select("nhl_game_id")
          .in(
            "nhl_game_id",
            chunk,
          )
          .order("nhl_game_id", {
            ascending: true,
          })
          .range(
            from,
            from + pageSize - 1,
          );

      if (error) {
        throw new Error(
          `Failed checking existing NHL player stats: ${error.message}`,
        );
      }

      const rows = data ?? [];

      for (const row of rows) {
        const id = Number(
          row.nhl_game_id,
        );

        if (Number.isFinite(id)) {
          completed.add(id);
        }
      }

      if (rows.length < pageSize) {
        break;
      }

      from += pageSize;
    }
  }

  return completed;
}

function collectReferencedPlayerIds(
  boxscore: JsonObject,
  playByPlay: JsonObject,
): Set<string> {
  const ids = new Set<string>();

  function walk(
    value: unknown,
    depth = 0,
  ): void {
    if (depth > 12) {
      return;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        walk(
          item,
          depth + 1,
        );
      }

      return;
    }

    if (!isObject(value)) {
      return;
    }

    const playerKeys = [
      "playerId",
      "scoringPlayerId",
      "assist1PlayerId",
      "assist2PlayerId",
      "winningPlayerId",
      "losingPlayerId",
      "goalieInNetId",
      "blockingPlayerId",
      "shootingPlayerId",
      "committedByPlayerId",
      "drawnByPlayerId",
    ];

    for (const key of playerKeys) {
      const id = asString(
        value[key],
      );

      if (
        isValidNhlPlayerId(id)
      ) {
        ids.add(id);
      }
    }

    for (
      const child of
      Object.values(value)
    ) {
      if (
        Array.isArray(child) ||
        isObject(child)
      ) {
        walk(
          child,
          depth + 1,
        );
      }
    }
  }

  walk(boxscore);
  walk(playByPlay);

  return ids;
}

async function ensureHistoricalPlayer(
  supabase: SupabaseClient,
  playerMap: Map<string, DbPlayer>,
  teamMap: Map<string, number>,
  externalPlayerId: string,
): Promise<DbPlayer | null> {
  const existing =
    playerMap.get(
      externalPlayerId,
    );

  if (existing) {
    return existing;
  }

  let landing: JsonObject;

  try {
    landing =
      await fetchNhlJson(
        `/player/${encodeURIComponent(
          externalPlayerId,
        )}/landing`,
      );
  } catch (error) {
    console.warn(
      `[NHL historical backfill] Could not fetch player ${externalPlayerId}`,
      error,
    );

    return null;
  }

  const firstName =
    localizedString(
      landing.firstName,
    );

  const lastName =
    localizedString(
      landing.lastName,
    );

  const displayName =
    [firstName, lastName]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    `NHL Player ${externalPlayerId}`;

  const position =
    normalizePosition(
      firstDefined(landing, [
        "position",
        "positionCode",
      ]),
    );

  const positionGroup =
    normalizePositionGroup(
      null,
      position,
    );

  const currentTeamId =
    asString(
      firstDefined(landing, [
        "currentTeamId",
        "teamId",
      ]),
    );

  const internalTeamId =
    currentTeamId
      ? teamMap.get(
          currentTeamId,
        ) ?? null
      : null;

  const insertRow = {
    nhl_player_id:
      Number(externalPlayerId),

    espn_athlete_id: null,

    team_id:
      internalTeamId,

    first_name:
      firstName,

    last_name:
      lastName,

    display_name:
      displayName,

    short_name:
      displayName,

    jersey_number:
      asString(
        landing.sweaterNumber,
      ),

    position,

    position_group:
      positionGroup,

    shoots_catches:
      asString(
        firstDefined(landing, [
          "shootsCatches",
          "shootsCatchesCode",
        ]),
      ),

    // The historical stats importer may discover a player while processing an
    // old game even though that player is still active today. The NHL landing
    // endpoint is authoritative for current player status. Do not classify a
    // player as historical merely because this route discovered him during a
    // historical backfill.
    active: asBoolean(landing.isActive),

    status: asBoolean(landing.isActive)
      ? "active"
      : "historical",

    injury_status: null,

    headshot_url:
      asString(
        landing.headshot,
      ),

    provider_data: {
      provider: "nhl",
      historicalBackfill: true,
      nhlPlayerId:
        externalPlayerId,
      landing,
    },

    updated_at:
      new Date().toISOString(),
  };

  const {
    data: inserted,
    error: insertError,
  } = await supabase
    .from("nhl_players")
    .insert(insertRow)
    .select(
      "id, nhl_player_id, first_name, last_name, display_name, position, position_group, team_id, active",
    )
    .single();

  if (insertError) {
    const {
      data: recovered,
      error: recoveryError,
    } = await supabase
      .from("nhl_players")
      .select(
        "id, nhl_player_id, first_name, last_name, display_name, position, position_group, team_id, active",
      )
      .eq(
        "nhl_player_id",
        Number(
          externalPlayerId,
        ),
      )
      .maybeSingle();

    if (
      recoveryError ||
      !recovered
    ) {
      throw new Error(
        `Failed creating historical NHL player ${externalPlayerId}: ${insertError.message}`,
      );
    }

    const player =
      recovered as DbPlayer;

    playerMap.set(
      externalPlayerId,
      player,
    );

    return player;
  }

  const player =
    inserted as DbPlayer;

  playerMap.set(
    externalPlayerId,
    player,
  );

  return player;
}

async function ensureReferencedPlayers(
  supabase: SupabaseClient,
  playerMap: Map<string, DbPlayer>,
  teamMap: Map<string, number>,
  referencedIds: Set<string>,
): Promise<{
  created: string[];
  unresolved: string[];
}> {
  const created: string[] = [];
  const unresolved: string[] = [];

  for (const id of referencedIds) {
    if (playerMap.has(id)) {
      continue;
    }

    const player =
      await ensureHistoricalPlayer(
        supabase,
        playerMap,
        teamMap,
        id,
      );

    if (player) {
      created.push(id);
    } else {
      unresolved.push(id);
    }
  }

  return {
    created,
    unresolved,
  };
}

function createAccumulator(
  player: DbPlayer,
  teamId: number | null,
): PlayerAccumulator {
  const position =
    normalizePosition(
      player.position,
    );

  return {
    nhlPlayerId:
      String(
        player.nhl_player_id,
      ),

    internalPlayerId:
      player.id,

    // Historical player-game team identity must come from the
    // game itself. Never fall back to the player's current team.
    internalTeamId:
      teamId,

    position,

    positionGroup:
      normalizePositionGroup(
        player.position_group,
        position,
      ),

    goals: 0,
    pbpGoals: 0,
    assists: 0,
    points: 0,
    plusMinus: 0,
    penaltyMinutes: 0,

    powerPlayGoals: 0,
    powerPlayAssists: 0,
    powerPlayPoints: 0,

    shortHandedGoals: 0,
    shortHandedAssists: 0,
    shortHandedPoints: 0,

    gameWinningGoals: 0,

    shotsOnGoal: 0,
    hits: 0,
    blockedShots: 0,
    takeaways: 0,
    giveaways: 0,

    faceoffWins: 0,
    faceoffLosses: 0,

    shifts: 0,
    timeOnIceSeconds: 0,

    goalieStarted: false,
    goalieDecision: null,

    saves: 0,
    shotsAgainst: 0,
    goalsAgainst: 0,
    savePercentage: null,
    goalieMinutesSeconds: 0,

    goalieWin: 0,
    goalieLoss: 0,
    goalieOvertimeLoss: 0,
    shutout: 0,

    rawBoxscore: null,
  };
}

function getOrCreateAccumulator(
  accumulators: Map<
    string,
    PlayerAccumulator
  >,
  playerMap: Map<string, DbPlayer>,
  externalPlayerId: string,
  teamId: number | null,
): PlayerAccumulator | null {
  if (
    !isValidNhlPlayerId(
      externalPlayerId,
    )
  ) {
    return null;
  }

  const existing =
    accumulators.get(
      externalPlayerId,
    );

  if (existing) {
    if (
      existing.internalTeamId ===
        null &&
      teamId !== null
    ) {
      existing.internalTeamId =
        teamId;
    }

    return existing;
  }

  const player =
    playerMap.get(
      externalPlayerId,
    );

  if (!player) {
    return null;
  }

  const accumulator =
    createAccumulator(
      player,
      teamId,
    );

  accumulators.set(
    externalPlayerId,
    accumulator,
  );

  return accumulator;
}

function collectBoxscoreObjects(
  value: unknown,
  result: JsonObject[],
  depth = 0,
): void {
  if (depth > 10) {
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectBoxscoreObjects(
        item,
        result,
        depth + 1,
      );
    }

    return;
  }

  if (!isObject(value)) {
    return;
  }

  result.push(value);

  for (
    const child of
    Object.values(value)
  ) {
    if (
      Array.isArray(child) ||
      isObject(child)
    ) {
      collectBoxscoreObjects(
        child,
        result,
        depth + 1,
      );
    }
  }
}

function looksLikeSkaterRow(
  row: JsonObject,
): boolean {
  const playerId =
    extractPlayerId(row);

  if (!playerId) {
    return false;
  }

  return (
    "goals" in row ||
    "assists" in row ||
    "points" in row ||
    "sog" in row ||
    "shotsOnGoal" in row ||
    "plusMinus" in row ||
    "pim" in row ||
    "hits" in row
  );
}

function looksLikeGoalieRow(
  row: JsonObject,
): boolean {
  const playerId =
    extractPlayerId(row);

  if (!playerId) {
    return false;
  }

  return (
    "saves" in row ||
    "shotsAgainst" in row ||
    "goalsAgainst" in row ||
    "savePctg" in row ||
    "savePercentage" in row
  );
}

function collectTeamPlayerRows(
  teamStats: unknown,
): JsonObject[] {
  const objects: JsonObject[] = [];

  collectBoxscoreObjects(
    teamStats,
    objects,
  );

  return objects.filter(
    (row) =>
      looksLikeSkaterRow(row) ||
      looksLikeGoalieRow(row),
  );
}

function applySkaterBoxscore(
  accumulator:
    PlayerAccumulator,
  row: JsonObject,
): void {
  accumulator.goals =
    asNumber(row.goals);

  accumulator.assists =
    asNumber(row.assists);

  accumulator.points =
    asNumber(row.points);

  if (
    accumulator.points === 0 &&
    (accumulator.goals > 0 ||
      accumulator.assists > 0)
  ) {
    accumulator.points =
      accumulator.goals +
      accumulator.assists;
  }

  accumulator.plusMinus =
    asNumber(
      firstDefined(row, [
        "plusMinus",
        "plus_minus",
      ]),
    );

  accumulator.penaltyMinutes =
    asNumber(
      firstDefined(row, [
        "pim",
        "penaltyMinutes",
      ]),
    );

  accumulator.shotsOnGoal =
    asNumber(
      firstDefined(row, [
        "sog",
        "shotsOnGoal",
        "shots",
      ]),
    );

  accumulator.hits =
    asNumber(row.hits);

  accumulator.blockedShots =
    asNumber(
      firstDefined(row, [
        "blockedShots",
        "blocks",
        "blocked",
      ]),
    );

  accumulator.takeaways =
    asNumber(
      firstDefined(row, [
        "takeaways",
        "takeAways",
      ]),
    );

  accumulator.giveaways =
    asNumber(
      firstDefined(row, [
        "giveaways",
        "giveAways",
      ]),
    );

  accumulator.shifts =
    asNumber(row.shifts);

  accumulator.timeOnIceSeconds =
    parseTimeToSeconds(
      firstDefined(row, [
        "toi",
        "timeOnIce",
      ]),
    );

  const position =
    normalizePosition(
      firstDefined(row, [
        "position",
        "positionCode",
        "pos",
      ]),
    );

  if (position) {
    accumulator.position =
      position;

    accumulator.positionGroup =
      normalizePositionGroup(
        null,
        position,
      );
  }

  accumulator.rawBoxscore =
    row;
}

function normalizeDecision(
  value: unknown,
): string | null {
  const raw = asString(value);

  if (!raw) {
    return null;
  }

  const normalized =
    raw.toUpperCase();

  if (normalized === "W") {
    return "W";
  }

  if (normalized === "L") {
    return "L";
  }

  if (
    normalized === "O" ||
    normalized === "OT" ||
    normalized === "OTL"
  ) {
    return "OTL";
  }

  return normalized;
}

function applyGoalieBoxscore(
  accumulator:
    PlayerAccumulator,
  row: JsonObject,
): void {
  accumulator.position = "G";
  accumulator.positionGroup =
    "GOALIE";

  accumulator.saves =
    asNumber(row.saves);

  accumulator.shotsAgainst =
    asNumber(
      firstDefined(row, [
        "shotsAgainst",
        "shots_against",
      ]),
    );

  accumulator.goalsAgainst =
    asNumber(
      firstDefined(row, [
        "goalsAgainst",
        "goals_against",
      ]),
    );

  const reportedSavePct =
    asNullableNumber(
      firstDefined(row, [
        "savePctg",
        "savePercentage",
        "savePct",
      ]),
    );

  if (
    reportedSavePct !== null
  ) {
    accumulator.savePercentage =
      reportedSavePct > 1
        ? reportedSavePct / 100
        : reportedSavePct;
  } else if (
    accumulator.shotsAgainst > 0
  ) {
    accumulator.savePercentage =
      accumulator.saves /
      accumulator.shotsAgainst;
  }

  accumulator.goalieMinutesSeconds =
    parseTimeToSeconds(
      firstDefined(row, [
        "toi",
        "timeOnIce",
      ]),
    );

  accumulator.goalieDecision =
    normalizeDecision(
      firstDefined(row, [
        "decision",
        "goalieDecision",
      ]),
    );

  accumulator.goalieStarted =
    asBoolean(
      firstDefined(row, [
        "starter",
        "started",
        "isStarter",
      ]),
    );

  accumulator.rawBoxscore =
    row;
}

function processBoxscore(
  boxscore: JsonObject,
  playerMap: Map<string, DbPlayer>,
  game: DbGame,
): {
  accumulators: Map<
    string,
    PlayerAccumulator
  >;

  unmappedPlayerIds:
    Set<string>;

  awayExternalId:
    string | null;

  homeExternalId:
    string | null;
} {
  const accumulators =
    new Map<
      string,
      PlayerAccumulator
    >();

  const unmappedPlayerIds =
    new Set<string>();

  const awayTeam =
    asObject(
      boxscore.awayTeam,
    );

  const homeTeam =
    asObject(
      boxscore.homeTeam,
    );

  const awayExternalId =
    asString(awayTeam.id);

  const homeExternalId =
    asString(homeTeam.id);

  const playerByGameStats =
    asObject(
      boxscore.playerByGameStats,
    );

  const teamSections = [
    {
      value:
        playerByGameStats.awayTeam,
      internalTeamId:
        game.away_team_id,
    },
    {
      value:
        playerByGameStats.homeTeam,
      internalTeamId:
        game.home_team_id,
    },
  ];

  for (const section of teamSections) {
    const rows =
      collectTeamPlayerRows(
        section.value,
      );

    for (const row of rows) {
      const goalie =
        looksLikeGoalieRow(row);

      const skater =
        looksLikeSkaterRow(row);

      if (!goalie && !skater) {
        continue;
      }

      const externalPlayerId =
        extractPlayerId(row);

      if (!externalPlayerId) {
        continue;
      }

      const player =
        playerMap.get(
          externalPlayerId,
        );

      if (!player) {
        unmappedPlayerIds.add(
          externalPlayerId,
        );
        continue;
      }

      const accumulator =
        getOrCreateAccumulator(
          accumulators,
          playerMap,
          externalPlayerId,
          section.internalTeamId,
        );

      if (!accumulator) {
        unmappedPlayerIds.add(
          externalPlayerId,
        );
        continue;
      }

      // The boxscore's awayTeam/homeTeam container is the
      // authoritative historical team for this player-game row.
      accumulator.internalTeamId =
        section.internalTeamId;

      if (goalie) {
        applyGoalieBoxscore(
          accumulator,
          row,
        );
      } else {
        applySkaterBoxscore(
          accumulator,
          row,
        );
      }
    }
  }

  return {
    accumulators,
    unmappedPlayerIds,
    awayExternalId,
    homeExternalId,
  };
}

function decodeSituationCode(
  value: string | null,
): {
  awayGoalie: number;
  awaySkaters: number;
  homeSkaters: number;
  homeGoalie: number;
} | null {
  if (
    !value ||
    !/^\d{4}$/.test(value)
  ) {
    return null;
  }

  return {
    awayGoalie:
      Number(value[0]),

    awaySkaters:
      Number(value[1]),

    homeSkaters:
      Number(value[2]),

    homeGoalie:
      Number(value[3]),
  };
}

function classifyGoalStrength(
  situationCode: string | null,
  scoringTeamId: string | null,
  awayTeamId: string | null,
  homeTeamId: string | null,
): "PP" | "SH" | "EV" {
  const situation =
    decodeSituationCode(
      situationCode,
    );

  if (
    !situation ||
    !scoringTeamId
  ) {
    return "EV";
  }

  let scoringSkaters: number;
  let defendingSkaters: number;

  if (
    scoringTeamId === awayTeamId
  ) {
    scoringSkaters =
      situation.awaySkaters;

    defendingSkaters =
      situation.homeSkaters;
  } else if (
    scoringTeamId === homeTeamId
  ) {
    scoringSkaters =
      situation.homeSkaters;

    defendingSkaters =
      situation.awaySkaters;
  } else {
    return "EV";
  }

  if (
    scoringSkaters >
    defendingSkaters
  ) {
    return "PP";
  }

  if (
    scoringSkaters <
    defendingSkaters
  ) {
    return "SH";
  }

  return "EV";
}

function applyPlayByPlay(
  playByPlay: JsonObject,
  accumulators: Map<string, PlayerAccumulator>,
  playerMap: Map<string, DbPlayer>,
  teamMap: Map<string, number>,
  awayTeamId: string | null,
  homeTeamId: string | null,
  game: DbGame,
): {
  unmappedPlayerIds: Set<string>;
  goalEvents: GoalEvent[];
} {
  const unmappedPlayerIds = new Set<string>();
  const goalEvents: GoalEvent[] = [];

  for (const rawPlay of asArray(playByPlay.plays)) {
    const play = asObject(rawPlay);
    const details = asObject(play.details);
    const type = (asString(play.typeDescKey) ?? "").toLowerCase();
    const externalTeamId = asString(details.eventOwnerTeamId);
    const internalTeamId = externalTeamId
      ? teamMap.get(externalTeamId) ?? null
      : null;

    if (type === "faceoff") {
      const winnerId = asString(details.winningPlayerId);
      const loserId = asString(details.losingPlayerId);

      if (isValidNhlPlayerId(winnerId)) {
        const player = getOrCreateAccumulator(
          accumulators,
          playerMap,
          winnerId,
          internalTeamId,
        );

        if (player) {
          player.faceoffWins += 1;
        } else {
          unmappedPlayerIds.add(winnerId);
        }
      }

      if (isValidNhlPlayerId(loserId)) {
        const player = getOrCreateAccumulator(
          accumulators,
          playerMap,
          loserId,
          internalTeamId === game.away_team_id
            ? game.home_team_id
            : internalTeamId === game.home_team_id
              ? game.away_team_id
              : null,
        );

        if (player) {
          player.faceoffLosses += 1;
        } else {
          unmappedPlayerIds.add(loserId);
        }
      }

      continue;
    }

    if (type !== "goal") {
      continue;
    }

    /*
     * v8: NHL play-by-play represents successful shootout attempts with
     * typeDescKey = "goal", but those attempts are not credited hockey
     * goals and must never participate in fantasy-stat reconciliation.
     *
     * The official final scoreboard may still contain the synthetic
     * shootout-deciding team goal; reconcileOfficialGoalEvents already
     * removes that one goal from the expected final hockey score.
     */
    const periodDescriptor =
      asObject(play.periodDescriptor);

    const periodType =
      (
        asString(
          periodDescriptor.periodType,
        ) ?? ""
      ).toUpperCase();

    if (periodType === "SO") {
      continue;
    }

    const scorerId = asString(details.scoringPlayerId);

    if (!isValidNhlPlayerId(scorerId)) {
      continue;
    }

    const scorer = getOrCreateAccumulator(
      accumulators,
      playerMap,
      scorerId,
      internalTeamId,
    );

    if (!scorer) {
      unmappedPlayerIds.add(scorerId);
      continue;
    }

    const assistIds = [
      asString(details.assist1PlayerId),
      asString(details.assist2PlayerId),
    ].filter(isValidNhlPlayerId);

    for (const assistId of assistIds) {
      if (!playerMap.has(assistId)) {
        unmappedPlayerIds.add(assistId);
      }
    }

    goalEvents.push({
      scorerId,
      assistIds,
      scoringTeamId: internalTeamId,
      awayScore: asNumber(details.awayScore),
      homeScore: asNumber(details.homeScore),
      sortOrder: asNumber(play.sortOrder),
      strength: classifyGoalStrength(
        asString(play.situationCode),
        externalTeamId,
        awayTeamId,
        homeTeamId,
      ),
    });
  }

  return {
    unmappedPlayerIds,
    goalEvents,
  };
}

/*
 * v7 official-goal reconciliation.
 *
 * NHL PBP can retain goal-shaped events that do not belong in the final
 * official scoring sequence. We therefore do not derive PP/SH/GWG/shutout
 * data directly from every `typeDescKey = goal` row.
 *
 * Starting from the official final hockey score, walk PBP goals backward and
 * keep only events whose score snapshot exactly matches the score state that
 * must exist at that point. Each accepted event must decrement the scoring
 * team's score by exactly one. A shootout's synthetic deciding goal is first
 * removed from the final scoreboard because it is not a credited hockey goal.
 *
 * Skater/defense boxscore goal totals remain authoritative. An accepted PBP
 * event cannot give a skater more goals than the official boxscore reports.
 * Goalies are the deliberate exception because NHL goalie boxscore rows can
 * omit a legitimate offensive goal.
 */
function reconcileOfficialGoalEvents(
  rawGoalEvents: GoalEvent[],
  accumulators: Map<string, PlayerAccumulator>,
  game: DbGame,
): {
  accepted: GoalEvent[];
  rejected: GoalEvent[];
} {
  let expectedAway = Math.max(0, game.away_score ?? 0);
  let expectedHome = Math.max(0, game.home_score ?? 0);

  if (game.is_shootout && expectedAway !== expectedHome) {
    if (expectedAway > expectedHome) {
      expectedAway -= 1;
    } else {
      expectedHome -= 1;
    }
  }

  const acceptedReverse: GoalEvent[] = [];
  const rejected: GoalEvent[] = [];
  const acceptedByScorer = new Map<string, number>();
  const orderedReverse = [...rawGoalEvents].sort(
    (a, b) => b.sortOrder - a.sortOrder,
  );

  for (const goal of orderedReverse) {
    const scorer = accumulators.get(goal.scorerId);
    const isAway = goal.scoringTeamId === game.away_team_id;
    const isHome = goal.scoringTeamId === game.home_team_id;

    if (!scorer || (!isAway && !isHome)) {
      rejected.push(goal);
      continue;
    }

    const snapshotMatches =
      goal.awayScore === expectedAway &&
      goal.homeScore === expectedHome;

    if (!snapshotMatches) {
      rejected.push(goal);
      continue;
    }

    const alreadyAccepted = acceptedByScorer.get(goal.scorerId) ?? 0;
    const skaterGoalCapOk =
      scorer.positionGroup === "GOALIE" ||
      alreadyAccepted < scorer.goals;

    if (!skaterGoalCapOk) {
      rejected.push(goal);
      continue;
    }

    if (isAway) {
      if (expectedAway <= 0) {
        rejected.push(goal);
        continue;
      }
      expectedAway -= 1;
    } else {
      if (expectedHome <= 0) {
        rejected.push(goal);
        continue;
      }
      expectedHome -= 1;
    }

    acceptedByScorer.set(goal.scorerId, alreadyAccepted + 1);
    acceptedReverse.push(goal);
  }

  if (expectedAway !== 0 || expectedHome !== 0) {
    throw new Error(
      `Could not reconcile official PBP goal sequence for game ${game.nhl_game_id}: ` +
        `unmatched score remainder ${expectedAway}-${expectedHome}.`,
    );
  }

  const accepted = acceptedReverse.sort(
    (a, b) => a.sortOrder - b.sortOrder,
  );

  for (const player of accumulators.values()) {
    player.pbpGoals = 0;
    player.powerPlayGoals = 0;
    player.powerPlayAssists = 0;
    player.powerPlayPoints = 0;
    player.shortHandedGoals = 0;
    player.shortHandedAssists = 0;
    player.shortHandedPoints = 0;
    player.gameWinningGoals = 0;
  }

  for (const goal of accepted) {
    const scorer = accumulators.get(goal.scorerId);

    if (!scorer) {
      continue;
    }

    scorer.pbpGoals += 1;

    if (goal.strength === "PP") {
      scorer.powerPlayGoals += 1;
      scorer.powerPlayPoints += 1;
    } else if (goal.strength === "SH") {
      scorer.shortHandedGoals += 1;
      scorer.shortHandedPoints += 1;
    }

    for (const assistId of goal.assistIds) {
      const assister = accumulators.get(assistId);

      if (!assister) {
        continue;
      }

      if (goal.strength === "PP") {
        assister.powerPlayAssists += 1;
        assister.powerPlayPoints += 1;
      } else if (goal.strength === "SH") {
        assister.shortHandedAssists += 1;
        assister.shortHandedPoints += 1;
      }
    }
  }

  return { accepted, rejected };
}

function reconcileCreditedGoals(
  accumulators: Map<string, PlayerAccumulator>,
): void {
  for (const player of accumulators.values()) {
    /*
     * The NHL skater boxscore is authoritative for skater/defense goal
     * totals. PBP can retain goal events that must not overwrite those
     * official boxscore totals.
     *
     * Goalies are the exception: the NHL goalie stats container can omit
     * an offensive goal credited to the goalie. Preserve PBP reconciliation
     * only for GOALIE rows so legitimate goalie goals are retained without
     * inflating normal skater totals.
     */
    if (
      player.positionGroup === "GOALIE" &&
      player.pbpGoals > player.goals
    ) {
      player.goals = player.pbpGoals;
    }

    // Keep points consistent with the authoritative/reconciled goal total.
    player.points =
      player.goals + player.assists;
  }
}

function assignGameWinningGoal(
  goalEvents: GoalEvent[],
  accumulators: Map<
    string,
    PlayerAccumulator
  >,
  finalAwayScore: number,
  finalHomeScore: number,
): void {
  if (
    goalEvents.length === 0 ||
    finalAwayScore ===
      finalHomeScore
  ) {
    return;
  }

  const winnerIsAway =
    finalAwayScore >
    finalHomeScore;

  const losingScore =
    winnerIsAway
      ? finalHomeScore
      : finalAwayScore;

  const winningGoalNumber =
    losingScore + 1;

  const ordered =
    [...goalEvents].sort(
      (a, b) =>
        a.sortOrder -
        b.sortOrder,
    );

  for (const goal of ordered) {
    const matches =
      winnerIsAway
        ? goal.awayScore ===
            winningGoalNumber &&
          goal.awayScore >
            goal.homeScore
        : goal.homeScore ===
            winningGoalNumber &&
          goal.homeScore >
            goal.awayScore;

    if (!matches) {
      continue;
    }

    const scorer =
      accumulators.get(
        goal.scorerId,
      );

    if (scorer) {
      scorer.gameWinningGoals =
        1;
    }

    return;
  }
}

function determineGoalieOutcomes(
  accumulators: Map<
    string,
    PlayerAccumulator
  >,
  goalEvents: GoalEvent[],
  game: DbGame,
): void {
  const participatingGoalies =
    [...accumulators.values()].filter(
      (player) =>
        player.positionGroup ===
          "GOALIE" &&
        didPlayerParticipate(player),
    );

  const awayGoalies =
    participatingGoalies.filter(
      (player) =>
        player.internalTeamId ===
        game.away_team_id,
    );

  const homeGoalies =
    participatingGoalies.filter(
      (player) =>
        player.internalTeamId ===
        game.home_team_id,
    );

  // PBP goal events represent actual hockey goals, not the
  // synthetic deciding goal added to a shootout final score.
  // This also catches empty-net goals, which are not charged
  // to an individual goalie but still prevent a shutout.
  const awayGoals =
    goalEvents.filter(
      (goal) =>
        goal.scoringTeamId ===
        game.away_team_id,
    ).length;

  const homeGoals =
    goalEvents.filter(
      (goal) =>
        goal.scoringTeamId ===
        game.home_team_id,
    ).length;

  for (const player of accumulators.values()) {
    if (
      player.positionGroup !==
      "GOALIE"
    ) {
      continue;
    }

    player.goalieWin =
      player.goalieDecision === "W"
        ? 1
        : 0;

    player.goalieLoss =
      player.goalieDecision === "L"
        ? 1
        : 0;

    player.goalieOvertimeLoss =
      player.goalieDecision === "OTL"
        ? 1
        : 0;

    const isAwayGoalie =
      player.internalTeamId ===
      game.away_team_id;

    const isHomeGoalie =
      player.internalTeamId ===
      game.home_team_id;

    const soleParticipatingGoalie =
      isAwayGoalie
        ? awayGoalies.length === 1
        : isHomeGoalie
          ? homeGoalies.length === 1
          : false;

    const opponentActualGoals =
      isAwayGoalie
        ? homeGoals
        : isHomeGoalie
          ? awayGoals
          : -1;

    player.shutout =
      didPlayerParticipate(player) &&
      soleParticipatingGoalie &&
      opponentActualGoals === 0
        ? 1
        : 0;
  }
}

function didPlayerParticipate(
  player: PlayerAccumulator,
): boolean {
  if (
    player.positionGroup !==
    "GOALIE"
  ) {
    return true;
  }

  /*
   * A dressed backup goalie who never entered
   * the game must not receive a player-game row.
   */
  return (
    player.goalieMinutesSeconds > 0 ||
    player.saves > 0 ||
    player.shotsAgainst > 0 ||
    player.goalsAgainst > 0 ||
    player.goalieDecision !== null
  );
}

function serializePlayerRow(
  game: DbGame,
  player: PlayerAccumulator,
) {
  const savePercentage =
    player.shotsAgainst > 0
      ? player.saves /
        player.shotsAgainst
      : player.savePercentage;

  return {
    nhl_game_id:
      game.id,

    nhl_player_id:
      player.internalPlayerId,

    team_id:
      player.internalTeamId,

    season:
      game.season,

    season_type:
      game.season_type ??
      "regular",

    position:
      player.position,

    position_group:
      player.positionGroup,

    goals:
      player.goals,

    assists:
      player.assists,

    points:
      player.points,

    plus_minus:
      player.plusMinus,

    penalty_minutes:
      player.penaltyMinutes,

    power_play_goals:
      player.powerPlayGoals,

    power_play_assists:
      player.powerPlayAssists,

    power_play_points:
      player.powerPlayPoints,

    short_handed_goals:
      player.shortHandedGoals,

    short_handed_assists:
      player.shortHandedAssists,

    short_handed_points:
      player.shortHandedPoints,

    game_winning_goals:
      player.gameWinningGoals,

    shots_on_goal:
      player.shotsOnGoal,

    hits:
      player.hits,

    blocked_shots:
      player.blockedShots,

    takeaways:
      player.takeaways,

    giveaways:
      player.giveaways,

    faceoff_wins:
      player.faceoffWins,

    faceoff_losses:
      player.faceoffLosses,

    shifts:
      player.shifts,

    time_on_ice_seconds:
      player.timeOnIceSeconds,

    goalie_started:
      player.goalieStarted,

    goalie_decision:
      player.goalieDecision,

    saves:
      player.saves,

    shots_against:
      player.shotsAgainst,

    goals_against:
      player.goalsAgainst,

    save_percentage:
      savePercentage,

    goalie_minutes_seconds:
      player.goalieMinutesSeconds,

    goalie_win:
      player.goalieWin,

    goalie_loss:
      player.goalieLoss,

    goalie_overtime_loss:
      player.goalieOvertimeLoss,

    shutout:
      player.shutout,

    is_final: true,

    raw_stats: {
      provider: "nhl",

      externalGameId:
        game.nhl_game_id,

      boxscore:
        player.rawBoxscore,

      derived: {
        faceoffWins:
          player.faceoffWins,

        faceoffLosses:
          player.faceoffLosses,

        powerPlayGoals:
          player.powerPlayGoals,

        powerPlayAssists:
          player.powerPlayAssists,

        powerPlayPoints:
          player.powerPlayPoints,

        shortHandedGoals:
          player.shortHandedGoals,

        shortHandedAssists:
          player.shortHandedAssists,

        shortHandedPoints:
          player.shortHandedPoints,

        gameWinningGoals:
          player.gameWinningGoals,
      },
    },

    updated_at:
      new Date().toISOString(),
  };
}


const V9_COMPARE_FIELDS = [
  "team_id", "season", "season_type", "position", "position_group",
  "goals", "assists", "points", "plus_minus", "penalty_minutes",
  "power_play_goals", "power_play_assists", "power_play_points",
  "short_handed_goals", "short_handed_assists", "short_handed_points",
  "game_winning_goals", "shots_on_goal", "hits", "blocked_shots",
  "takeaways", "giveaways", "faceoff_wins", "faceoff_losses", "shifts",
  "time_on_ice_seconds", "goalie_started", "goalie_decision", "saves",
  "shots_against", "goals_against", "save_percentage",
  "goalie_minutes_seconds", "goalie_win", "goalie_loss",
  "goalie_overtime_loss", "shutout", "is_final",
] as const;

type V9CompareField = (typeof V9_COMPARE_FIELDS)[number];
type V9StoredRow = Record<string, unknown> & {
  nhl_game_id: number;
  nhl_player_id: number;
};
type V9Difference = {
  gameId: number;
  externalGameId: string | null;
  playerId: number;
  playerName: string | null;
  field: V9CompareField | "__row__";
  storedValue: unknown;
  v9Value: unknown;
};

function v9ComparableValue(
  field: V9CompareField,
  value: unknown,
): unknown {
  if (value === undefined) return null;

  if (field === "save_percentage" && value !== null) {
    const numeric = Number(value);
    return Number.isFinite(numeric)
      ? Number(numeric.toFixed(8))
      : value;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return Number(value);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (
      trimmed !== "" &&
      /^-?\d+(?:\.\d+)?$/.test(trimmed)
    ) {
      return Number(trimmed);
    }
  }

  return value ?? null;
}

function v9ValuesEqual(
  field: V9CompareField,
  storedValue: unknown,
  v9Value: unknown,
): boolean {
  const stored = v9ComparableValue(field, storedValue);
  const prepared = v9ComparableValue(field, v9Value);

  if (
    field === "save_percentage" &&
    typeof stored === "number" &&
    typeof prepared === "number"
  ) {
    return Math.abs(stored - prepared) <= 0.00000001;
  }

  return stored === prepared;
}

async function loadStoredRowsForGame(
  supabase: SupabaseClient,
  gameId: number,
): Promise<V9StoredRow[]> {
  const { data, error } = await supabase
    .from("nhl_player_game_stats")
    .select(
      [
        "nhl_game_id",
        "nhl_player_id",
        ...V9_COMPARE_FIELDS,
      ].join(", "),
    )
    .eq("nhl_game_id", gameId);

  if (error) {
    throw new Error(
      `Failed loading stored NHL player stats for game ${gameId}: ${error.message}`,
    );
  }

  return (data ?? []) as unknown as V9StoredRow[];
}

function comparePreparedRowsToStored(
  game: DbGame,
  preparedRows: Array<Record<string, unknown>>,
  storedRows: V9StoredRow[],
  playerNameByInternalId: Map<number, string | null>,
) {
  const storedByPlayer = new Map<number, V9StoredRow>();
  const preparedByPlayer =
    new Map<number, Record<string, unknown>>();

  for (const row of storedRows) {
    storedByPlayer.set(Number(row.nhl_player_id), row);
  }

  for (const row of preparedRows) {
    preparedByPlayer.set(Number(row.nhl_player_id), row);
  }

  const allPlayerIds = new Set<number>([
    ...storedByPlayer.keys(),
    ...preparedByPlayer.keys(),
  ]);

  let rowsMatching = 0;
  let rowsDifferent = 0;
  const differences: V9Difference[] = [];

  for (const playerId of allPlayerIds) {
    const stored = storedByPlayer.get(playerId);
    const prepared = preparedByPlayer.get(playerId);
    const playerName =
      playerNameByInternalId.get(playerId) ?? null;

    if (!stored || !prepared) {
      rowsDifferent += 1;
      differences.push({
        gameId: game.id,
        externalGameId: game.nhl_game_id,
        playerId,
        playerName,
        field: "__row__",
        storedValue: stored ? "present" : "missing",
        v9Value: prepared ? "present" : "missing",
      });
      continue;
    }

    let rowDifferent = false;

    for (const field of V9_COMPARE_FIELDS) {
      if (
        !v9ValuesEqual(
          field,
          stored[field],
          prepared[field],
        )
      ) {
        rowDifferent = true;
        differences.push({
          gameId: game.id,
          externalGameId: game.nhl_game_id,
          playerId,
          playerName,
          field,
          storedValue: stored[field] ?? null,
          v9Value: prepared[field] ?? null,
        });
      }
    }

    if (rowDifferent) rowsDifferent += 1;
    else rowsMatching += 1;
  }

  return {
    rowsCompared: allPlayerIds.size,
    rowsMatching,
    rowsDifferent,
    gamesWithDifferences: rowsDifferent > 0 ? 1 : 0,
    differences,
  };
}

export async function POST(
  request: NextRequest,
) {
  try {
    const hostname =
      request.nextUrl.hostname;

    const isLocal =
      process.env.NODE_ENV !==
        "production" &&
      (
        hostname ===
          "localhost" ||
        hostname ===
          "127.0.0.1"
      );

    const secret =
      process.env
        .GRIDIRON_SYNC_SECRET;

    if (!isLocal) {
      if (!secret) {
        return NextResponse.json(
          {
            success: false,
            error:
              "GRIDIRON_SYNC_SECRET is not configured.",
          },
          {
            status: 500,
          },
        );
      }

      if (
        request.headers.get(
          "x-gridiron-sync-secret",
        ) !== secret
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Unauthorized.",
          },
          {
            status: 401,
          },
        );
      }
    }

    const body =
      asObject(
        await request.json(),
      );

    const season =
      Math.trunc(
        asNumber(
          body.season,
        ),
      );

    if (
      !ALLOWED_SEASONS.has(
        season,
      )
    ) {
      return NextResponse.json(
        {
          success: false,

          error:
            "season must be 2023, 2024, or 2025.",
        },
        {
          status: 400,
        },
      );
    }

    const requestedLimit =
      Math.trunc(
        asNumber(
          body.limit,
        ),
      );

    /*
     * IMPORTANT:
     * This is now a real 250-game ceiling.
     */
    const limit =
      requestedLimit > 0
        ? Math.min(
            requestedLimit,
            MAX_BATCH_SIZE,
          )
        : DEFAULT_BATCH_SIZE;

    const offset =
      Math.max(
        0,
        Math.trunc(
          asNumber(
            body.offset,
          ),
        ),
      );

    const force =
      asBoolean(
        body.force,
      );

    // Read-only validation mode. When enabled, the route fetches and
    // reconciles NHL boxscore/PBP data but performs ZERO database writes:
    // no historical-player inserts, stat upserts, or stale-goalie deletes.
    const diagnosticOnly =
      asBoolean(
        body.diagnosticOnly,
      );

    const compareStored =
      asBoolean(
        body.compareStored,
      );

    if (
      compareStored &&
      !diagnosticOnly
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "compareStored requires diagnosticOnly=true.",
        },
        { status: 400 },
      );
    }

    // Optional diagnostic filter for one exact external NHL game ID.
    // This lets us safely validate edge cases without calculating a
    // season offset or rewriting unrelated historical games.
    const requestedGameId =
      asString(body.gameId);

    if (
      requestedGameId !== null &&
      !/^\d{10}$/.test(
        requestedGameId,
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "gameId must be a 10-digit NHL game ID when provided.",
        },
        { status: 400 },
      );
    }

    const supabaseUrl =
      process.env
        .NEXT_PUBLIC_SUPABASE_URL;

    const serviceRoleKey =
      process.env
        .SUPABASE_SERVICE_ROLE_KEY;

    if (
      !supabaseUrl ||
      !serviceRoleKey
    ) {
      throw new Error(
        "Supabase server environment variables are missing.",
      );
    }

    const supabase =
      createClient(
        supabaseUrl,
        serviceRoleKey,
        {
          auth: {
            persistSession:
              false,

            autoRefreshToken:
              false,
          },
        },
      );

    const players =
      await loadAllPlayers(
        supabase,
      );

    const playerMap =
      new Map<
        string,
        DbPlayer
      >();

    const playerNameByInternalId =
      new Map<
        number,
        string | null
      >();

    for (
      const player of players
    ) {
      playerNameByInternalId.set(
        player.id,
        (
          player.display_name ??
          [player.first_name, player.last_name]
            .filter(Boolean)
            .join(" ")
            .trim()
        ) || null,
      );
      const externalId =
        asString(
          player.nhl_player_id,
        );

      if (
        isValidNhlPlayerId(
          externalId,
        )
      ) {
        playerMap.set(
          externalId,
          player,
        );
      }
    }

    const teams =
      await loadAllTeams(
        supabase,
      );

    const teamMap =
      new Map<
        string,
        number
      >();

    for (
      const team of teams
    ) {
      const externalId =
        asString(
          team.nhl_team_id,
        );

      if (externalId) {
        teamMap.set(
          externalId,
          team.id,
        );
      }
    }

    /*
     * Load the ENTIRE historical season first.
     *
     * This avoids the old candidate-window bug.
     */
    const allSeasonGames =
      await loadAllHistoricalGames(
        supabase,
        season,
      );

    const gameFilteredSeasonGames =
      requestedGameId
        ? allSeasonGames.filter(
            (game) =>
              game.nhl_game_id ===
              requestedGameId,
          )
        : allSeasonGames;

    const seasonGames =
      !requestedGameId && offset > 0
        ? gameFilteredSeasonGames.slice(
            offset,
          )
        : gameFilteredSeasonGames;

    let gamesWithStats =
      new Set<number>();

    if (!force && !diagnosticOnly) {
      gamesWithStats =
        await loadGamesWithExistingStats(
          supabase,
          allSeasonGames.map(
            (game) => game.id,
          ),
        );
    }

    /*
     * Only genuinely unprocessed games are
     * eligible for the new batch.
     */
    const unprocessedGames =
      force || diagnosticOnly
        ? seasonGames
        : seasonGames.filter(
            (game) =>
              !gamesWithStats.has(
                game.id,
              ),
          );

    const gamesToProcess =
      unprocessedGames.slice(
        0,
        limit,
      );

    const result = {
      success: true,

      importerVersion:
        "nhl-historical-player-stats-v9-stored-row-comparison",

      season,

      seasonCode:
        `${season}${season + 1}`,

      requestedLimit:
        limit,

      maxBatchSize:
        MAX_BATCH_SIZE,

      requestedOffset:
        offset,

      force,

      diagnosticOnly,

      compareStored,

      requestedGameId,

      playersLoadedAtStart:
        playerMap.size,

      teamsLoaded:
        teamMap.size,

      seasonGamesFound:
        allSeasonGames.length,

      gamesAlreadyPopulated:
        force || diagnosticOnly
          ? 0
          : gamesWithStats.size,

      gamesRemainingBeforeBatch:
        unprocessedGames.length,

      firstSelectedGameId:
        gamesToProcess[0]?.id ??
        null,

      lastSelectedGameId:
        gamesToProcess[
          gamesToProcess.length - 1
        ]?.id ?? null,

      gamesSelected:
        gamesToProcess.length,

      gamesProcessed: 0,

      gamesFailed: 0,

      historicalPlayersCreated:
        [] as string[],

      unresolvedPlayerIds:
        [] as string[],

      rowsPrepared: 0,

      rowsUpserted: 0,

      comparison: {
        gamesCompared: 0,
        rowsCompared: 0,
        rowsMatching: 0,
        rowsDifferent: 0,
        gamesWithDifferences: 0,
        differenceCount: 0,
        differences: [] as V9Difference[],
      },

      nonPlayingGoaliesRemoved:
        0,

      gameResults:
        [] as Array<
          Record<string, unknown>
        >,

      errors:
        [] as Array<
          Record<string, unknown>
        >,
    };

    const createdPlayers =
      new Set<string>();

    const unresolvedPlayers =
      new Set<string>();

    for (
      const game of
      gamesToProcess
    ) {
      try {
        if (!game.nhl_game_id) {
          throw new Error(
            "Game has no external NHL game ID.",
          );
        }

        const [
          boxscore,
          playByPlay,
        ] =
          await Promise.all([
            fetchNhlJson(
              `/gamecenter/${game.nhl_game_id}/boxscore`,
            ),

            fetchNhlJson(
              `/gamecenter/${game.nhl_game_id}/play-by-play`,
            ),
          ]);

        const referencedIds =
          collectReferencedPlayerIds(
            boxscore,
            playByPlay,
          );

        const ensured =
          diagnosticOnly
            ? {
                created: [] as string[],
                unresolved: [...referencedIds].filter(
                  (id) => !playerMap.has(id),
                ),
              }
            : await ensureReferencedPlayers(
                supabase,
                playerMap,
                teamMap,
                referencedIds,
              );

        for (
          const id of
          ensured.created
        ) {
          createdPlayers.add(id);
        }

        for (
          const id of
          ensured.unresolved
        ) {
          unresolvedPlayers.add(
            id,
          );
        }

        const processed =
          processBoxscore(
            boxscore,
            playerMap,
            game,
          );

        const pbp =
          applyPlayByPlay(
            playByPlay,
            processed.accumulators,
            playerMap,
            teamMap,
            processed.awayExternalId,
            processed.homeExternalId,
            game,
          );

        for (
          const id of
          processed.unmappedPlayerIds
        ) {
          unresolvedPlayers.add(
            id,
          );
        }

        for (
          const id of
          pbp.unmappedPlayerIds
        ) {
          unresolvedPlayers.add(
            id,
          );
        }

        const reconciledGoals =
          reconcileOfficialGoalEvents(
            pbp.goalEvents,
            processed.accumulators,
            game,
          );

        reconcileCreditedGoals(
          processed.accumulators,
        );

        assignGameWinningGoal(
          reconciledGoals.accepted,
          processed.accumulators,
          game.away_score ?? 0,
          game.home_score ?? 0,
        );

        determineGoalieOutcomes(
          processed.accumulators,
          reconciledGoals.accepted,
          game,
        );

        const allPlayers =
          [
            ...processed.accumulators.values(),
          ];

        const participants =
          allPlayers.filter(
            didPlayerParticipate,
          );

        const removedGoalies =
          allPlayers.filter(
            (player) =>
              player.positionGroup ===
                "GOALIE" &&
              !didPlayerParticipate(
                player,
              ),
          );

        result.nonPlayingGoaliesRemoved +=
          removedGoalies.length;

        /*
         * Clean any stale backup-goalie rows
         * before writing the validated participant
         * rows for this game.
         */
        if (
          !diagnosticOnly &&
          removedGoalies.length > 0
        ) {
          const removedInternalIds =
            removedGoalies.map(
              (player) =>
                player.internalPlayerId,
            );

          const {
            error: cleanupError,
          } =
            await supabase
              .from(
                "nhl_player_game_stats",
              )
              .delete()
              .eq(
                "nhl_game_id",
                game.id,
              )
              .in(
                "nhl_player_id",
                removedInternalIds,
              );

          if (cleanupError) {
            throw new Error(
              `Failed cleaning non-playing goalie rows: ${cleanupError.message}`,
            );
          }
        }

        const rows =
          participants.map(
            (player) =>
              serializePlayerRow(
                game,
                player,
              ),
          );

        if (
          rows.length === 0
        ) {
          throw new Error(
            "No participating player rows extracted.",
          );
        }

        result.rowsPrepared +=
          rows.length;

        let gameComparison:
          | ReturnType<
              typeof comparePreparedRowsToStored
            >
          | null = null;

        if (compareStored) {
          const storedRows =
            await loadStoredRowsForGame(
              supabase,
              game.id,
            );

          gameComparison =
            comparePreparedRowsToStored(
              game,
              rows as Array<
                Record<string, unknown>
              >,
              storedRows,
              playerNameByInternalId,
            );

          result.comparison.gamesCompared += 1;
          result.comparison.rowsCompared +=
            gameComparison.rowsCompared;
          result.comparison.rowsMatching +=
            gameComparison.rowsMatching;
          result.comparison.rowsDifferent +=
            gameComparison.rowsDifferent;
          result.comparison.gamesWithDifferences +=
            gameComparison.gamesWithDifferences;
          result.comparison.differenceCount +=
            gameComparison.differences.length;
          result.comparison.differences.push(
            ...gameComparison.differences,
          );
        }

        if (!diagnosticOnly) {
          const {
            error: upsertError,
          } =
            await supabase
              .from(
                "nhl_player_game_stats",
              )
              .upsert(
                rows,
                {
                  onConflict:
                    "nhl_game_id,nhl_player_id",
                },
              );

          if (upsertError) {
            throw new Error(
              `Stats upsert failed: ${upsertError.message}`,
            );
          }

          result.rowsUpserted +=
            rows.length;
        }

        result.gamesProcessed += 1;

        result.gameResults.push({
          internalGameId:
            game.id,

          externalGameId:
            game.nhl_game_id,

          referencedPlayers:
            referencedIds.size,

          playersWritten:
            rows.length,

          goalsFound:
            reconciledGoals.accepted.length,

          rawPbpGoalEvents:
            pbp.goalEvents.length,

          rejectedPbpGoalEvents:
            reconciledGoals.rejected.length,

          comparison:
            gameComparison
              ? {
                  rowsCompared:
                    gameComparison.rowsCompared,
                  rowsMatching:
                    gameComparison.rowsMatching,
                  rowsDifferent:
                    gameComparison.rowsDifferent,
                  differenceCount:
                    gameComparison.differences.length,
                }
              : null,

          historicalPlayersCreated:
            ensured.created,

          unresolvedPlayers:
            [
              ...new Set([
                ...ensured.unresolved,
                ...processed.unmappedPlayerIds,
                ...pbp.unmappedPlayerIds,
              ]),
            ],

          nonPlayingGoaliesRemoved:
            removedGoalies.map(
              (player) =>
                player.nhlPlayerId,
            ),
        });
      } catch (error) {
        result.gamesFailed += 1;

        result.errors.push({
          internalGameId:
            game.id,

          externalGameId:
            game.nhl_game_id,

          error:
            error instanceof Error
              ? error.message
              : String(error),
        });
      }
    }

    result.historicalPlayersCreated =
      [...createdPlayers].sort();

    result.unresolvedPlayerIds =
      [...unresolvedPlayers].sort();

    return NextResponse.json(
      result,
      {
        status: 200,
      },
    );
  } catch (error) {
    console.error(
      "[NHL historical player stats backfill]",
      error,
    );

    return NextResponse.json(
      {
        success: false,

        error:
          error instanceof Error
            ? error.message
            : "Unknown NHL historical backfill error.",
      },
      {
        status: 500,
      },
    );
  }
}