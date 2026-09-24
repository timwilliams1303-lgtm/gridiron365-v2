import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const NHL_FANTASY_DATA_MCP_URL = "https://nhlfantasydata.com/mcp";

type RequestBody = {
  date?: string;
  dryRun?: boolean;
};

type SourceGoalie = {
  nhl_player_id: number | null;
  name: string;
  start_probability: number | null;
  externally_confirmed: boolean;
  last_start_date: string | null;
};

type SourceGoalieProjection = {
  projected_shots_against: number;
  projected_saves: number;
};

type SourceGoalieSide = {
  starter: SourceGoalie | null;
  alternatives: SourceGoalie[];
  starter_projection: SourceGoalieProjection | null;
};

type SourceGame = {
  nhl_game_id: number;
  start_time: string | null;
  home_team: string;
  away_team: string;
  game_projection: Record<string, unknown> | null;
  goalies: {
    home: SourceGoalieSide;
    away: SourceGoalieSide;
  };
};

type SourceStructuredContent = {
  schema_version: string;
  date: string;
  generated_at: string;
  projection_source: string;
  games: SourceGame[];
  warnings?: Array<Record<string, unknown>>;
};

type McpResponse = {
  jsonrpc?: string;
  id?: number;
  result?: {
    content?: Array<{
      type?: string;
      text?: string;
    }>;
    structuredContent?: SourceStructuredContent;
    isError?: boolean;
  };
  error?: {
    code?: number;
    message?: string;
    data?: unknown;
  };
};

type DbGame = {
  id: number;
  nhl_game_id: string | null;
  start_time: string;
  away_team_id: number | null;
  home_team_id: number | null;
  status_completed: boolean;
};

type DbTeam = {
  id: number;
  abbreviation: string;
  display_name: string;
};

type DbPlayer = {
  id: number;
  nhl_player_id: number | null;
  team_id: number | null;
  display_name: string;
  position: string | null;
  position_group: string | null;
  active: boolean;
};

function env(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing environment variable ${name}.`);
  }

  return value;
}

function adminClient() {
  return createClient(
    env("NEXT_PUBLIC_SUPABASE_URL"),
    env("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}

function authorized(request: NextRequest): boolean {
  const secret =
    process.env.GRIDIRON_SYNC_SECRET ??
    process.env.NFL_SYNC_SECRET ??
    "";

  if (!secret) {
    return false;
  }

  const headerSecret =
    request.headers.get("x-gridiron-sync-secret")?.trim() ?? "";

  const authorization =
    request.headers.get("authorization")?.trim() ?? "";

  const bearerSecret = authorization
    .toLowerCase()
    .startsWith("bearer ")
    ? authorization.slice(7).trim()
    : "";

  return headerSecret === secret || bearerSecret === secret;
}

function isValidDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function easternDateString(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error("Unable to determine current Eastern date.");
  }

  return `${year}-${month}-${day}`;
}

function normalize(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "")
    .toLowerCase()
    .trim();
}

function isGoalie(player: DbPlayer): boolean {
  const position = normalize(player.position);
  const group = normalize(player.position_group);

  return (
    position === "g" ||
    position === "goalie" ||
    position === "goaltender" ||
    group === "g" ||
    group === "goalie" ||
    group === "goaltender"
  );
}

async function fetchStartingGoalies(
  date: string,
): Promise<SourceStructuredContent> {
  const payload = {
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: {
      name: "get_starting_goalies",
      arguments: {
        date,
      },
    },
  };

  const response = await fetch(NHL_FANTASY_DATA_MCP_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(
      `NHL Fantasy Data returned HTTP ${response.status}: ${responseText.slice(
        0,
        500,
      )}`,
    );
  }

  let parsed: McpResponse;

  try {
    parsed = JSON.parse(responseText) as McpResponse;
  } catch {
    throw new Error("NHL Fantasy Data returned invalid JSON.");
  }

  if (parsed.error) {
    throw new Error(
      `NHL Fantasy Data MCP error: ${
        parsed.error.message ??
        `code ${parsed.error.code ?? "unknown"}`
      }`,
    );
  }

  if (parsed.result?.isError) {
    const text =
      parsed.result.content
        ?.map((item) => item.text ?? "")
        .filter(Boolean)
        .join(" ") ?? "Unknown NHL Fantasy Data tool error.";

    throw new Error(text);
  }

  const structured = parsed.result?.structuredContent;

  if (!structured) {
    throw new Error(
      "NHL Fantasy Data response did not contain structuredContent.",
    );
  }

  if (!Array.isArray(structured.games)) {
    throw new Error(
      "NHL Fantasy Data structuredContent.games was not an array.",
    );
  }

  return structured;
}

function findTeam(
  teams: DbTeam[],
  abbreviation: string,
): DbTeam | null {
  const normalized = normalize(abbreviation);

  const matches = teams.filter(
    (team) => normalize(team.abbreviation) === normalized,
  );

  return matches.length === 1 ? matches[0] : null;
}

function findPlayer(
  players: DbPlayer[],
  sourceGoalie: SourceGoalie,
  teamId: number,
): {
  player: DbPlayer | null;
  method:
    | "nhl_player_id"
    | "team_name"
    | "unmapped"
    | "ambiguous";
  candidateCount: number;
} {
  /*
   * Preferred mapping:
   * official NHL player ID.
   */
  if (sourceGoalie.nhl_player_id != null) {
    const byOfficialId = players.filter(
      (player) =>
        player.nhl_player_id === sourceGoalie.nhl_player_id,
    );

    if (byOfficialId.length === 1) {
      return {
        player: byOfficialId[0],
        method: "nhl_player_id",
        candidateCount: 1,
      };
    }

    if (byOfficialId.length > 1) {
      return {
        player: null,
        method: "ambiguous",
        candidateCount: byOfficialId.length,
      };
    }
  }

  /*
   * Safe fallback:
   * same team + goalie position + normalized exact name.
   */
  const byTeamAndName = players.filter(
    (player) =>
      player.team_id === teamId &&
      isGoalie(player) &&
      normalize(player.display_name) === normalize(sourceGoalie.name),
  );

  if (byTeamAndName.length === 1) {
    return {
      player: byTeamAndName[0],
      method: "team_name",
      candidateCount: 1,
    };
  }

  if (byTeamAndName.length > 1) {
    return {
      player: null,
      method: "ambiguous",
      candidateCount: byTeamAndName.length,
    };
  }

  return {
    player: null,
    method: "unmapped",
    candidateCount: 0,
  };
}

function findGame(
  games: DbGame[],
  sourceGame: SourceGame,
): {
  game: DbGame | null;
  candidateCount: number;
} {
  const externalGameId = String(sourceGame.nhl_game_id);

  const matches = games.filter(
    (game) => String(game.nhl_game_id ?? "") === externalGameId,
  );

  return {
    game: matches.length === 1 ? matches[0] : null,
    candidateCount: matches.length,
  };
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now();

  try {
    if (!authorized(request)) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized.",
        },
        {
          status: 401,
        },
      );
    }

    let body: RequestBody = {};

    try {
      body = (await request.json()) as RequestBody;
    } catch {
      body = {};
    }

    const date = body.date?.trim() || easternDateString();

    /*
     * Safe default:
     * if dryRun is omitted, do not write.
     */
    const dryRun = body.dryRun !== false;

    if (!isValidDate(date)) {
      return NextResponse.json(
        {
          success: false,
          error: "date must use YYYY-MM-DD format.",
        },
        {
          status: 400,
        },
      );
    }

    const source = await fetchStartingGoalies(date);

    const supabase = adminClient();

    /*
     * Zero NHL games is a valid successful result.
     */
    if (source.games.length === 0) {
      return NextResponse.json({
        success: true,
        sourceProvider: "NHL Fantasy Data",
        date,
        dryRun,
        generatedAt: source.generated_at,
        projectionSource: source.projection_source,

        sourceGames: 0,
        sourceStarters: 0,

        mappedGames: 0,
        mappedGoalies: 0,

        projected: 0,
        confirmed: 0,

        written: 0,
        skippedStartedGames: 0,
        failed: 0,

        warnings: source.warnings ?? [],
        results: [],

        durationMs: Date.now() - startedAt,
      });
    }

    const externalGameIds = source.games.map((game) =>
      String(game.nhl_game_id),
    );

    /*
     * IMPORTANT:
     * Keep these .select() values as literal strings.
     * Supabase TypeScript uses the literal to infer the selected row shape.
     */
    const [gamesResult, teamsResult, playersResult] = await Promise.all([
      supabase
        .from("nhl_games")
        .select(
          "id, nhl_game_id, start_time, away_team_id, home_team_id, status_completed",
        )
        .in("nhl_game_id", externalGameIds),

      supabase
        .from("nhl_teams")
        .select("id, abbreviation, display_name")
        .eq("active", true),

      supabase
        .from("nhl_players")
        .select(
          "id, nhl_player_id, team_id, display_name, position, position_group, active",
        )
        .eq("active", true),
    ]);

    if (gamesResult.error) {
      throw gamesResult.error;
    }

    if (teamsResult.error) {
      throw teamsResult.error;
    }

    if (playersResult.error) {
      throw playersResult.error;
    }

    const games = (gamesResult.data ?? []) as DbGame[];
    const teams = (teamsResult.data ?? []) as DbTeam[];
    const players = (playersResult.data ?? []) as DbPlayer[];

    const results: Array<Record<string, unknown>> = [];

    let sourceStarters = 0;
    let mappedGames = 0;
    let mappedGoalies = 0;

    let projected = 0;
    let confirmed = 0;

    let written = 0;
    let skippedStartedGames = 0;
    let failed = 0;

    const nowMs = Date.now();

    for (const sourceGame of source.games) {
      /*
       * Game mapping uses the official NHL game ID.
       */
      const gameMatch = findGame(games, sourceGame);

      if (!gameMatch.game) {
        failed += 1;

        results.push({
          success: false,
          stage: "game_mapping",

          sourceNhlGameId: sourceGame.nhl_game_id,
          awayTeam: sourceGame.away_team,
          homeTeam: sourceGame.home_team,

          candidateCount: gameMatch.candidateCount,
        });

        continue;
      }

      const game = gameMatch.game;

      mappedGames += 1;

      /*
       * This source is only for pregame intelligence.
       *
       * Once puck drop occurs, official NHL Gamecenter
       * becomes authoritative for actual goalie_started.
       */
      const gameStartMs = new Date(game.start_time).getTime();

      if (
        game.status_completed ||
        (Number.isFinite(gameStartMs) && gameStartMs <= nowMs)
      ) {
        skippedStartedGames += 1;

        results.push({
          success: true,
          stage: "skipped_started_game",

          internalGameId: game.id,
          nhlGameId: game.nhl_game_id,
          gameStart: game.start_time,

          awayTeam: sourceGame.away_team,
          homeTeam: sourceGame.home_team,
        });

        continue;
      }

      /*
       * NHL Fantasy Data returns team abbreviations.
       */
      const awayTeam = findTeam(teams, sourceGame.away_team);
      const homeTeam = findTeam(teams, sourceGame.home_team);

      if (!awayTeam || !homeTeam) {
        failed += 1;

        results.push({
          success: false,
          stage: "team_mapping",

          internalGameId: game.id,
          nhlGameId: game.nhl_game_id,

          sourceAwayTeam: sourceGame.away_team,
          sourceHomeTeam: sourceGame.home_team,

          awayTeamMapped: Boolean(awayTeam),
          homeTeamMapped: Boolean(homeTeam),
        });

        continue;
      }

      /*
       * Safety check:
       * make sure the source teams agree with our NHL game.
       */
      if (
        game.away_team_id !== awayTeam.id ||
        game.home_team_id !== homeTeam.id
      ) {
        failed += 1;

        results.push({
          success: false,
          stage: "game_team_crosscheck",

          internalGameId: game.id,
          nhlGameId: game.nhl_game_id,

          databaseAwayTeamId: game.away_team_id,
          sourceAwayTeamId: awayTeam.id,

          databaseHomeTeamId: game.home_team_id,
          sourceHomeTeamId: homeTeam.id,
        });

        continue;
      }

      const sides = [
        {
          side: "away" as const,
          team: awayTeam,
          sourceTeam: sourceGame.away_team,
          sourceGoalie: sourceGame.goalies.away.starter,
          alternatives: sourceGame.goalies.away.alternatives,
          starterProjection:
            sourceGame.goalies.away.starter_projection,
        },
        {
          side: "home" as const,
          team: homeTeam,
          sourceTeam: sourceGame.home_team,
          sourceGoalie: sourceGame.goalies.home.starter,
          alternatives: sourceGame.goalies.home.alternatives,
          starterProjection:
            sourceGame.goalies.home.starter_projection,
        },
      ];

      for (const side of sides) {
        /*
         * The source may know the game but not yet have
         * a selected starter.
         */
        if (!side.sourceGoalie) {
          results.push({
            success: true,
            stage: "no_starter",

            side: side.side,

            internalGameId: game.id,
            nhlGameId: game.nhl_game_id,

            teamId: side.team.id,
            team: side.team.display_name,
          });

          continue;
        }

        sourceStarters += 1;

        /*
         * Player mapping:
         *
         * 1. official NHL player ID
         * 2. safe same-team goalie-name fallback
         */
        const playerMatch = findPlayer(
          players,
          side.sourceGoalie,
          side.team.id,
        );

        if (!playerMatch.player) {
          failed += 1;

          results.push({
            success: false,
            stage: "goalie_mapping",

            side: side.side,

            internalGameId: game.id,
            nhlGameId: game.nhl_game_id,

            teamId: side.team.id,
            team: side.team.display_name,

            sourceNhlPlayerId: side.sourceGoalie.nhl_player_id,
            sourceGoalieName: side.sourceGoalie.name,

            mappingMethod: playerMatch.method,
            candidateCount: playerMatch.candidateCount,
          });

          continue;
        }

        const player = playerMatch.player;

        mappedGoalies += 1;

        /*
         * G365 pregame status:
         *
         * externally_confirmed=false -> projected
         * externally_confirmed=true  -> confirmed
         */
        const starterStatus: "projected" | "confirmed" =
          side.sourceGoalie.externally_confirmed
            ? "confirmed"
            : "projected";

        if (starterStatus === "confirmed") {
          confirmed += 1;
        } else {
          projected += 1;
        }

        const nowIso = new Date().toISOString();

        /*
         * Preserve the useful source information inside
         * raw_source_data without expanding the DB schema.
         */
        const record = {
          /*
           * INTERNAL public.nhl_games.id.
           *
           * Do not confuse this with the source's
           * external NHL game ID.
           */
          nhl_game_id: game.id,

          team_id: side.team.id,

          /*
           * INTERNAL public.nhl_players.id.
           */
          nhl_player_id: player.id,

          goalie_name: side.sourceGoalie.name,

          starter_status: starterStatus,

          source_provider: "NHL Fantasy Data",

          source_url: NHL_FANTASY_DATA_MCP_URL,

          /*
           * The source tells us whether the starter has
           * been externally confirmed but does not expose
           * a dedicated confirmation timestamp.
           *
           * Do not invent one.
           */
          source_confirmed_at: null,

          last_seen_at: nowIso,

          raw_source_data: {
            schemaVersion: source.schema_version,
            sourceDate: source.date,
            generatedAt: source.generated_at,
            projectionSource: source.projection_source,

            sourceNhlGameId: sourceGame.nhl_game_id,
            sourceGameStart: sourceGame.start_time,

            side: side.side,
            sourceTeam: side.sourceTeam,

            sourceGoalie: {
              nhlPlayerId: side.sourceGoalie.nhl_player_id,
              name: side.sourceGoalie.name,

              startProbability:
                side.sourceGoalie.start_probability,

              externallyConfirmed:
                side.sourceGoalie.externally_confirmed,

              lastStartDate:
                side.sourceGoalie.last_start_date,
            },

            alternatives: side.alternatives,

            starterProjection: side.starterProjection,

            gameProjection: sourceGame.game_projection,

            playerMappingMethod: playerMatch.method,
          },

          updated_at: nowIso,
        };

        if (!dryRun) {
          /*
           * One current starter record per game/team.
           *
           * If the projected goalie changes, this updates
           * the same row instead of creating a duplicate.
           */
          const { error: writeError } = await supabase
            .from("nhl_starting_goalies")
            .upsert(record, {
              onConflict: "nhl_game_id,team_id",
            });

          if (writeError) {
            failed += 1;

            results.push({
              success: false,
              stage: "database_write",

              side: side.side,

              internalGameId: game.id,
              nhlGameId: game.nhl_game_id,

              teamId: side.team.id,

              goalieId: player.id,
              goalie: player.display_name,

              error: writeError.message,
            });

            continue;
          }

          written += 1;
        }

        results.push({
          success: true,

          stage: dryRun ? "dry_run" : "written",

          side: side.side,

          internalGameId: game.id,
          nhlGameId: game.nhl_game_id,
          gameStart: game.start_time,

          teamId: side.team.id,
          team: side.team.display_name,

          goalieId: player.id,
          officialNhlPlayerId: player.nhl_player_id,
          goalie: player.display_name,

          mappingMethod: playerMatch.method,

          starterStatus,

          startProbability:
            side.sourceGoalie.start_probability,

          externallyConfirmed:
            side.sourceGoalie.externally_confirmed,

          projectedShotsAgainst:
            side.starterProjection?.projected_shots_against ?? null,

          projectedSaves:
            side.starterProjection?.projected_saves ?? null,
        });
      }
    }

    return NextResponse.json({
      success: failed === 0,

      sourceProvider: "NHL Fantasy Data",

      date,
      dryRun,

      generatedAt: source.generated_at,
      projectionSource: source.projection_source,

      sourceGames: source.games.length,
      sourceStarters,

      mappedGames,
      mappedGoalies,

      projected,
      confirmed,

      written,
      skippedStartedGames,
      failed,

      warnings: source.warnings ?? [],

      results,

      durationMs: Date.now() - startedAt,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,

        error:
          error instanceof Error
            ? error.message
            : "Unknown NHL starting-goalie synchronization error.",

        durationMs: Date.now() - startedAt,
      },
      {
        status: 500,
      },
    );
  }
}