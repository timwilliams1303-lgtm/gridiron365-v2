import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

type RequestBody = {
  date?: string;
  dryRun?: boolean;
};

type DbTeam = {
  id: number;
  abbreviation: string;
  display_name: string;
  name: string;
};

type DbGame = {
  id: number;
  nhl_game_id: string | null;
  start_time: string;
  away_team_id: number | null;
  home_team_id: number | null;
  status_completed: boolean;
};

type DbPlayer = {
  id: number;
  team_id: number | null;
  display_name: string;
  position: string | null;
  position_group: string | null;
  active: boolean;
};

type ParsedGoalie = {
  teamName: string;
  goalieName: string;
  rawStatus: string;
  starterStatus: "projected" | "confirmed";
  confirmedAt: string | null;
};

type ParsedMatchup = {
  awayTeamName: string;
  homeTeamName: string;
  startTime: string;
  awayGoalie: ParsedGoalie;
  homeGoalie: ParsedGoalie;
};

function normalize(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase();
}

function compactNormalize(value: unknown): string {
  return normalize(value).replace(/\s+/g, "");
}

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

  if (!secret) return false;

  const headerSecret =
    request.headers.get("x-gridiron-sync-secret")?.trim() ?? "";

  const auth = request.headers.get("authorization")?.trim() ?? "";
  const bearer = auth.toLowerCase().startsWith("bearer ")
    ? auth.slice(7).trim()
    : "";

  return headerSecret === secret || bearer === secret;
}

function validDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function easternDateString(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error("Unable to determine Eastern calendar date.");
  }

  return `${year}-${month}-${day}`;
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function stripHtml(value: string): string {
  return decodeHtml(
    value
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Daily Faceoff does not publish a stable public API contract for this page.
 *
 * Keep parsing isolated here. If their markup changes, this function should
 * throw rather than manufacture goalie assignments.
 *
 * The parser intentionally uses the server HTML text and recognizable
 * matchup/status structures. The dry-run response exposes the parsed records
 * so we can validate the contract before enabling writes.
 */
function parseDailyFaceoffHtml(html: string): ParsedMatchup[] {
  const text = stripHtml(html);

  const statusMatches = [
    ...text.matchAll(/\b(Confirmed|Unconfirmed)\b/gi),
  ];

  if (statusMatches.length === 0) {
    throw new Error(
      "Daily Faceoff page contained no Confirmed/Unconfirmed goalie statuses.",
    );
  }

  /*
   * Daily Faceoff also embeds useful structured strings in its server response.
   * Pull ISO timestamps and use them as matchup anchors.
   */
  const isoTimes = [
    ...new Set(
      [...html.matchAll(/2026-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z/g)]
        .map((match) => match[0]),
    ),
  ];

  if (isoTimes.length === 0) {
    throw new Error(
      "Daily Faceoff page contained no recognizable game timestamps.",
    );
  }

  /*
   * We do NOT infer team/goalie relationships from the number of statuses.
   * Instead find structured JSON-like fragments containing the known fields.
   *
   * Daily Faceoff is a Next application and its HTML contains serialized
   * server data. These regexes intentionally accept several common key names
   * while remaining strict about requiring team, goalie and status.
   */
  const decoded = decodeHtml(html)
    .replace(/\\"/g, '"')
    .replace(/\\u0026/g, "&");

  const objects: string[] = [];
  let depth = 0;
  let start = -1;
  let inString = false;
  let escaped = false;

  for (let i = 0; i < decoded.length; i += 1) {
    const char = decoded[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === "{") {
      if (depth === 0) start = i;
      depth += 1;
    } else if (char === "}") {
      depth -= 1;

      if (depth === 0 && start >= 0) {
        const candidate = decoded.slice(start, i + 1);

        if (
          /confirmed/i.test(candidate) &&
          /goalie|goalkeeper|player/i.test(candidate)
        ) {
          objects.push(candidate);
        }

        start = -1;
      }
    }
  }

  /*
   * Because undocumented source markup can vary, the first production test
   * must prove parsing. If structured extraction fails, return a descriptive
   * error instead of falling back to positional guessing.
   */
  const parsedFromJson: unknown[] = [];

  for (const objectText of objects) {
    try {
      parsedFromJson.push(JSON.parse(objectText));
    } catch {
      // Ignore fragments that are not standalone JSON.
    }
  }

  const records: Array<Record<string, unknown>> = [];

  function walk(value: unknown) {
    if (Array.isArray(value)) {
      for (const item of value) walk(item);
      return;
    }

    if (!value || typeof value !== "object") return;

    const record = value as Record<string, unknown>;
    records.push(record);

    for (const child of Object.values(record)) {
      walk(child);
    }
  }

  for (const root of parsedFromJson) {
    walk(root);
  }

  function stringField(
    record: Record<string, unknown>,
    names: string[],
  ): string | null {
    for (const name of names) {
      const value = record[name];
      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }
    }
    return null;
  }

  /*
   * Collect likely goalie records. This intentionally remains conservative.
   */
  const goalieCandidates: Array<{
    goalieName: string;
    teamName: string | null;
    status: "projected" | "confirmed";
    confirmedAt: string | null;
    raw: Record<string, unknown>;
  }> = [];

  for (const record of records) {
    const rawStatus = stringField(record, [
      "status",
      "goalieStatus",
      "startingGoalieStatus",
      "confirmationStatus",
    ]);

    if (
      !rawStatus ||
      !["confirmed", "unconfirmed"].includes(normalize(rawStatus))
    ) {
      continue;
    }

    const goalieName =
      stringField(record, [
        "goalieName",
        "playerName",
        "name",
        "fullName",
        "displayName",
      ]) ?? null;

    if (!goalieName) continue;

    const teamName = stringField(record, [
      "teamName",
      "team",
      "teamDisplayName",
      "teamFullName",
    ]);

    const confirmedAt = stringField(record, [
      "confirmedAt",
      "confirmationTime",
      "confirmedDate",
      "updatedAt",
    ]);

    goalieCandidates.push({
      goalieName,
      teamName,
      status:
        normalize(rawStatus) === "confirmed" ? "confirmed" : "projected",
      confirmedAt,
      raw: record,
    });
  }

  /*
   * Current Daily Faceoff server data may not expose its nested structure as
   * simple standalone JSON objects. In that case we deliberately stop here.
   * We will inspect the dry-run diagnostic rather than guess.
   */
  if (goalieCandidates.length === 0) {
    throw new Error(
      `Daily Faceoff HTML was reachable and contained ${statusMatches.length} goalie statuses and ${isoTimes.length} game timestamps, but no safe structured goalie records could be extracted. Parser needs to be adjusted to the current server payload.`,
    );
  }

  /*
   * We only build matchups when records themselves provide enough relationship
   * information. This prevents accidentally swapping away/home goalies.
   */
  const matchupRecords = records.filter((record) => {
    const away =
      stringField(record, [
        "awayTeamName",
        "awayTeam",
        "away",
      ]) ?? null;

    const home =
      stringField(record, [
        "homeTeamName",
        "homeTeam",
        "home",
      ]) ?? null;

    const time =
      stringField(record, [
        "startTime",
        "gameTime",
        "gameDate",
        "dateTime",
      ]) ?? null;

    return Boolean(away && home && time);
  });

  const matchups: ParsedMatchup[] = [];

  for (const record of matchupRecords) {
    const awayTeamName = stringField(record, [
      "awayTeamName",
      "awayTeam",
      "away",
    ]);

    const homeTeamName = stringField(record, [
      "homeTeamName",
      "homeTeam",
      "home",
    ]);

    const startTime = stringField(record, [
      "startTime",
      "gameTime",
      "gameDate",
      "dateTime",
    ]);

    if (!awayTeamName || !homeTeamName || !startTime) continue;

    const awayGoalie = goalieCandidates.find(
      (goalie) =>
        goalie.teamName &&
        compactNormalize(goalie.teamName) === compactNormalize(awayTeamName),
    );

    const homeGoalie = goalieCandidates.find(
      (goalie) =>
        goalie.teamName &&
        compactNormalize(goalie.teamName) === compactNormalize(homeTeamName),
    );

    if (!awayGoalie || !homeGoalie) continue;

    matchups.push({
      awayTeamName,
      homeTeamName,
      startTime,
      awayGoalie: {
        teamName: awayTeamName,
        goalieName: awayGoalie.goalieName,
        rawStatus:
          awayGoalie.status === "confirmed"
            ? "Confirmed"
            : "Unconfirmed",
        starterStatus: awayGoalie.status,
        confirmedAt: awayGoalie.confirmedAt,
      },
      homeGoalie: {
        teamName: homeTeamName,
        goalieName: homeGoalie.goalieName,
        rawStatus:
          homeGoalie.status === "confirmed"
            ? "Confirmed"
            : "Unconfirmed",
        starterStatus: homeGoalie.status,
        confirmedAt: homeGoalie.confirmedAt,
      },
    });
  }

  if (matchups.length === 0) {
    throw new Error(
      `Daily Faceoff structured data produced ${goalieCandidates.length} goalie candidates but no safely related matchups. Parser needs adjustment before writes are allowed.`,
    );
  }

  return matchups;
}

function teamMatches(source: string, team: DbTeam): boolean {
  const sourceNorm = compactNormalize(source);

  return [
    team.display_name,
    team.name,
    team.abbreviation,
  ].some((value) => compactNormalize(value) === sourceNorm);
}

function goalieMatches(source: string, player: DbPlayer): boolean {
  return compactNormalize(source) === compactNormalize(player.display_name);
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
        { status: 401 },
      );
    }

    let body: RequestBody = {};

    try {
      body = (await request.json()) as RequestBody;
    } catch {
      body = {};
    }

    const date = body.date?.trim() || easternDateString();
    const dryRun = body.dryRun !== false;

    if (!validDate(date)) {
      return NextResponse.json(
        {
          success: false,
          error: "date must use YYYY-MM-DD.",
        },
        { status: 400 },
      );
    }

    const sourceUrl =
      `https://www.dailyfaceoff.com/starting-goalies/${date}`;

    const sourceResponse = await fetch(sourceUrl, {
      method: "GET",
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent":
          "Mozilla/5.0 (compatible; Gridiron365/1.0; +https://www.gridiron365fantasy.com)",
      },
      cache: "no-store",
    });

    const html = await sourceResponse.text();

    if (!sourceResponse.ok) {
      throw new Error(
        `Daily Faceoff returned HTTP ${sourceResponse.status}.`,
      );
    }

    if (!html.trim()) {
      throw new Error("Daily Faceoff returned an empty response.");
    }

    let parsedMatchups: ParsedMatchup[];

    try {
      parsedMatchups = parseDailyFaceoffHtml(html);
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          sourceProvider: "Daily Faceoff",
          sourceUrl,
          date,
          dryRun,
          sourceHttpStatus: sourceResponse.status,
          htmlLength: html.length,
          containsConfirmed:
            /\bConfirmed\b/i.test(stripHtml(html)),
          containsUnconfirmed:
            /\bUnconfirmed\b/i.test(stripHtml(html)),
          error:
            error instanceof Error
              ? error.message
              : "Unable to parse Daily Faceoff.",
          durationMs: Date.now() - startedAt,
        },
        { status: 422 },
      );
    }

    const supabase = adminClient();

    /*
     * Daily Faceoff hockey-day pages can contain games after midnight UTC.
     * Search a generous UTC window around the requested date and then match
     * teams + start time.
     */
    const startWindow =
      new Date(`${date}T00:00:00.000Z`);

    startWindow.setUTCHours(startWindow.getUTCHours() - 8);

    const endWindow = new Date(`${date}T00:00:00.000Z`);
    endWindow.setUTCDate(endWindow.getUTCDate() + 2);
    endWindow.setUTCHours(endWindow.getUTCHours() + 8);

    const [
      gamesResult,
      teamsResult,
      playersResult,
    ] = await Promise.all([
      supabase
        .from("nhl_games")
        .select(
          "id,nhl_game_id,start_time,away_team_id,home_team_id,status_completed",
        )
        .gte("start_time", startWindow.toISOString())
        .lt("start_time", endWindow.toISOString()),

      supabase
        .from("nhl_teams")
        .select(
          "id,abbreviation,display_name,name",
        )
        .eq("active", true),

      supabase
        .from("nhl_players")
        .select(
          "id,team_id,display_name,position,position_group,active",
        )
        .eq("active", true),
    ]);

    if (gamesResult.error) throw gamesResult.error;
    if (teamsResult.error) throw teamsResult.error;
    if (playersResult.error) throw playersResult.error;

    const games = (gamesResult.data ?? []) as DbGame[];
    const teams = (teamsResult.data ?? []) as DbTeam[];
    const players = (playersResult.data ?? []) as DbPlayer[];

    const teamById = new Map(
      teams.map((team) => [team.id, team]),
    );

    const results: Array<Record<string, unknown>> = [];

    let mappedGames = 0;
    let mappedGoalies = 0;
    let failed = 0;
    let written = 0;

    for (const matchup of parsedMatchups) {
      const awayTeamCandidates = teams.filter((team) =>
        teamMatches(matchup.awayTeamName, team),
      );

      const homeTeamCandidates = teams.filter((team) =>
        teamMatches(matchup.homeTeamName, team),
      );

      if (
        awayTeamCandidates.length !== 1 ||
        homeTeamCandidates.length !== 1
      ) {
        failed += 1;

        results.push({
          success: false,
          stage: "team_mapping",
          matchup,
          awayTeamCandidateCount:
            awayTeamCandidates.length,
          homeTeamCandidateCount:
            homeTeamCandidates.length,
        });

        continue;
      }

      const awayTeam = awayTeamCandidates[0];
      const homeTeam = homeTeamCandidates[0];

      const sourceStart = new Date(matchup.startTime);
      const sourceStartMs = sourceStart.getTime();

      const gameCandidates = games.filter((game) => {
        if (
          game.away_team_id !== awayTeam.id ||
          game.home_team_id !== homeTeam.id
        ) {
          return false;
        }

        const gameMs = new Date(game.start_time).getTime();

        return (
          Number.isFinite(sourceStartMs) &&
          Math.abs(gameMs - sourceStartMs) <=
            3 * 60 * 60 * 1000
        );
      });

      if (gameCandidates.length !== 1) {
        failed += 1;

        results.push({
          success: false,
          stage: "game_mapping",
          matchup,
          awayTeamId: awayTeam.id,
          homeTeamId: homeTeam.id,
          gameCandidateCount: gameCandidates.length,
          gameCandidates: gameCandidates.map((game) => ({
            id: game.id,
            nhlGameId: game.nhl_game_id,
            startTime: game.start_time,
          })),
        });

        continue;
      }

      const game = gameCandidates[0];
      mappedGames += 1;

      const sides = [
        {
          side: "away",
          team: awayTeam,
          goalie: matchup.awayGoalie,
        },
        {
          side: "home",
          team: homeTeam,
          goalie: matchup.homeGoalie,
        },
      ] as const;

      for (const side of sides) {
        const goalieCandidates = players.filter((player) => {
          if (player.team_id !== side.team.id) return false;

          const position =
            normalize(player.position);
          const group =
            normalize(player.position_group);

          const isGoalie =
            position === "g" ||
            position === "goalie" ||
            position === "goaltender" ||
            group === "g" ||
            group === "goalie" ||
            group === "goaltender";

          if (!isGoalie) return false;

          return goalieMatches(
            side.goalie.goalieName,
            player,
          );
        });

        if (goalieCandidates.length !== 1) {
          failed += 1;

          results.push({
            success: false,
            stage: "goalie_mapping",
            side: side.side,
            internalGameId: game.id,
            nhlGameId: game.nhl_game_id,
            teamId: side.team.id,
            team: side.team.display_name,
            goalieName: side.goalie.goalieName,
            goalieCandidateCount:
              goalieCandidates.length,
          });

          continue;
        }

        const goalie = goalieCandidates[0];
        mappedGoalies += 1;

        const record = {
          nhl_game_id: game.id,
          team_id: side.team.id,
          nhl_player_id: goalie.id,
          goalie_name: side.goalie.goalieName,
          starter_status: side.goalie.starterStatus,
          source_provider: "Daily Faceoff",
          source_url: sourceUrl,
          source_confirmed_at:
            side.goalie.starterStatus === "confirmed"
              ? side.goalie.confirmedAt
              : null,
          last_seen_at: new Date().toISOString(),
          raw_source_data: {
            date,
            side: side.side,
            sourceStatus: side.goalie.rawStatus,
            sourceTeamName: side.goalie.teamName,
            sourceGoalieName: side.goalie.goalieName,
            sourceGameStart: matchup.startTime,
          },
          updated_at: new Date().toISOString(),
        };

        if (!dryRun) {
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
              goalieId: goalie.id,
              goalieName: goalie.display_name,
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
          goalieId: goalie.id,
          goalie: goalie.display_name,
          starterStatus: side.goalie.starterStatus,
        });
      }
    }

    return NextResponse.json({
      success: failed === 0,
      sourceProvider: "Daily Faceoff",
      sourceUrl,
      date,
      dryRun,
      parsedMatchups: parsedMatchups.length,
      expectedGoalieRecords:
        parsedMatchups.length * 2,
      mappedGames,
      mappedGoalies,
      written,
      failed,
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
            : "Unknown starting-goalie synchronization error.",
        durationMs: Date.now() - startedAt,
      },
      { status: 500 },
    );
  }
}