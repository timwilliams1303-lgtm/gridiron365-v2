import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type NhlLocalizedString =
  | string
  | {
      default?: string | null;
      [key: string]: string | null | undefined;
    }
  | null
  | undefined;

type NhlTeam = {
  id?: number | null;
  abbrev?: string | null;
  score?: number | null;
};

type NhlGame = {
  id?: number | null;
  season?: number | null;
  gameType?: number | null;
  gameDate?: string | null;
  startTimeUTC?: string | null;

  venue?: NhlLocalizedString;

  gameState?: string | null;
  gameScheduleState?: string | null;

  periodDescriptor?: {
    number?: number | null;
    periodType?: string | null;
  } | null;

  clock?: {
    timeRemaining?: string | null;
    secondsRemaining?: number | null;
    running?: boolean | null;
    inIntermission?: boolean | null;
  } | null;

  awayTeam?: NhlTeam | null;
  homeTeam?: NhlTeam | null;

  [key: string]: unknown;
};

type NhlScheduleResponse = {
  previousSeason?: number | null;
  currentSeason?: number | null;
  clubTimezone?: string | null;
  clubUTCOffset?: string | null;
  games?: NhlGame[];
};

type TeamRow = {
  id: number;
  abbreviation: string | null;
  nhl_team_id: string | null;
  active: boolean | null;
};

const SUPPORTED_SEASONS = new Set([
  "20232024",
  "20242025",
  "20252026",
]);

/*
 * ================================================================
 * HELPERS
 * ================================================================
 */

function localizedText(
  value: NhlLocalizedString,
): string | null {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    const text = value.trim();

    return text || null;
  }

  const text = value.default?.trim();

  return text || null;
}

/*
 * G365 currently stores several ESPN-style abbreviations.
 *
 * The NHL API expects its own club abbreviations for the
 * club-schedule-season endpoint.
 *
 * Keep the G365 database abbreviations unchanged and translate
 * only when making the NHL API request.
 */
function getNhlApiAbbreviation(
  abbreviation: string,
): string {
  const normalized = abbreviation
    .trim()
    .toUpperCase();

  const aliases: Record<string, string> = {
    LA: "LAK",
    NJ: "NJD",
    SJ: "SJS",
    TB: "TBL",
  };

  return aliases[normalized] ?? normalized;
}

function mapGameState(
  state: string | null | undefined,
) {
  const normalized = (state ?? "")
    .trim()
    .toUpperCase();

  const completed =
    normalized === "FINAL" ||
    normalized === "OFF";

  const live =
    normalized === "LIVE" ||
    normalized === "CRIT";

  return {
    completed,

    statusType: completed
      ? "final"
      : live
        ? "in_progress"
        : "scheduled",

    statusName: normalized || null,

    statusDetail: normalized || null,
  };
}

function getSeasonStartYear(
  seasonCode: string,
): number {
  return Number(
    seasonCode.slice(0, 4),
  );
}

function gameTypeName(
  gameType: number | null | undefined,
): string {
  switch (gameType) {
    case 1:
      return "preseason";

    case 2:
      return "regular";

    case 3:
      return "postseason";

    default:
      return "unknown";
  }
}

function isOvertimeGame(
  game: NhlGame,
): boolean {
  const periodType =
    game.periodDescriptor
      ?.periodType
      ?.trim()
      .toUpperCase() ?? "";

  const periodNumber =
    game.periodDescriptor
      ?.number ?? 0;

  return (
    periodType === "OT" ||
    periodType === "SO" ||
    periodNumber > 3
  );
}

function isShootoutGame(
  game: NhlGame,
): boolean {
  return (
    game.periodDescriptor
      ?.periodType
      ?.trim()
      .toUpperCase() === "SO"
  );
}

function jsonError(
  message: string,
  status = 500,
  details?: unknown,
) {
  return NextResponse.json(
    {
      success: false,
      error: message,

      ...(details !== undefined
        ? {
            details,
          }
        : {}),
    },
    {
      status,
    },
  );
}

/*
 * ================================================================
 * POST
 * ================================================================
 */

export async function POST(
  request: NextRequest,
) {
  try {
    /*
     * ============================================================
     * AUTHORIZATION
     * ============================================================
     *
     * Production:
     *   Requires x-gridiron-sync-secret.
     *
     * Local development:
     *   localhost and 127.0.0.1 can execute without supplying
     *   GRIDIRON_SYNC_SECRET from PowerShell.
     *
     * This keeps production protected while making the historical
     * backfill practical to run locally.
     * ============================================================
     */

    const syncSecret =
      process.env.GRIDIRON_SYNC_SECRET;

    const providedSecret =
      request.headers.get(
        "x-gridiron-sync-secret",
      );

    const hostname =
      request.nextUrl.hostname
        .trim()
        .toLowerCase();

    const isLocalDevelopment =
      process.env.NODE_ENV !== "production" &&
      (
        hostname === "localhost" ||
        hostname === "127.0.0.1"
      );

    if (!isLocalDevelopment) {
      if (!syncSecret) {
        return jsonError(
          "GRIDIRON_SYNC_SECRET is not configured.",
          500,
        );
      }

      if (
        providedSecret !== syncSecret
      ) {
        return jsonError(
          "Unauthorized.",
          401,
        );
      }
    }

    /*
     * ============================================================
     * REQUEST BODY
     * ============================================================
     */

    const body =
      (await request
        .json()
        .catch(() => ({}))) as {
        season?: unknown;
      };

    const seasonCode =
      String(
        body.season ?? "",
      ).trim();

    if (
      !SUPPORTED_SEASONS.has(
        seasonCode,
      )
    ) {
      return jsonError(
        "Invalid season. Use 20232024, 20242025, or 20252026.",
        400,
      );
    }

    /*
     * ============================================================
     * SUPABASE SERVER CLIENT
     * ============================================================
     */

    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL;

    const serviceRoleKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (
      !supabaseUrl ||
      !serviceRoleKey
    ) {
      return jsonError(
        "Supabase server environment variables are not configured.",
        500,
      );
    }

    const supabase =
      createClient(
        supabaseUrl,
        serviceRoleKey,
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
        },
      );

    /*
     * ============================================================
     * LOAD G365 NHL TEAMS
     * ============================================================
     *
     * IMPORTANT:
     *
     * We intentionally include inactive teams.
     *
     * Historical teams such as Arizona must remain available so
     * historical games can point to the actual historical team.
     *
     * IMPORTANT TYPESCRIPT NOTE:
     *
     * Keep this select string literal. Do not replace it with
     * ["id", ...].join(", ").
     *
     * Supabase's TypeScript parser needs the literal select string
     * to correctly infer the returned row type.
     * ============================================================
     */

    const {
      data: teamData,
      error: teamError,
    } = await supabase
      .from("nhl_teams")
      .select(
        "id, abbreviation, nhl_team_id, active",
      )
      .not(
        "nhl_team_id",
        "is",
        null,
      )
      .not(
        "abbreviation",
        "is",
        null,
      )
      .order(
        "id",
        {
          ascending: true,
        },
      );

    if (teamError) {
      return jsonError(
        "Failed to load NHL teams.",
        500,
        teamError.message,
      );
    }

    const teams: TeamRow[] =
      teamData ?? [];

    if (
      teams.length === 0
    ) {
      return jsonError(
        "No NHL teams with nhl_team_id were found.",
        500,
      );
    }

    /*
     * ============================================================
     * BUILD NHL TEAM-ID MAP
     * ============================================================
     *
     * NHL external team ID
     *
     *          ↓
     *
     * G365 nhl_teams.id
     *
     * Example:
     *
     * NHL team ID 53
     *      ↓
     * Arizona Coyotes historical row
     * ============================================================
     */

    const internalTeamIdByNhlId =
      new Map<
        string,
        number
      >();

    for (
      const team of teams
    ) {
      if (
        !team.nhl_team_id
      ) {
        continue;
      }

      internalTeamIdByNhlId.set(
        String(
          team.nhl_team_id,
        ),
        team.id,
      );
    }

    /*
     * ============================================================
     * FETCH NHL CLUB SCHEDULES
     * ============================================================
     *
     * We fetch schedules for every known NHL team and deduplicate
     * games using the NHL's external game ID.
     *
     * Inactive historical teams are intentionally included.
     *
     * This means Arizona can provide its 2023-24 schedule while
     * current Utah can simply return 404 for seasons before it
     * existed under the Utah identity.
     * ============================================================
     */

    const gamesByNhlId =
      new Map<
        string,
        NhlGame
      >();

    const fetchErrors: Array<{
      team: string;
      databaseAbbreviation?: string;
      status?: number;
      error: string;
    }> = [];

    let schedulesFetched = 0;

    for (
      const team of teams
    ) {
      const abbreviation =
        team.abbreviation
          ?.trim()
          .toUpperCase();

      if (!abbreviation) {
        continue;
      }

      const nhlApiAbbreviation =
        getNhlApiAbbreviation(
          abbreviation,
        );

      const url =
        "https://api-web.nhle.com/v1/" +
        "club-schedule-season/" +
        `${encodeURIComponent(
          nhlApiAbbreviation,
        )}/${seasonCode}`;

      try {
        const response =
          await fetch(
            url,
            {
              method: "GET",

              headers: {
                Accept:
                  "application/json",

                "User-Agent":
                  "Gridiron365/1.0",
              },

              cache:
                "no-store",
            },
          );

        if (!response.ok) {
          fetchErrors.push({
            team:
              nhlApiAbbreviation,

            databaseAbbreviation:
              abbreviation,

            status:
              response.status,

            error:
              `NHL API returned HTTP ${response.status}.`,
          });

          continue;
        }

        const payload =
          (await response.json()) as
            NhlScheduleResponse;

        schedulesFetched += 1;

        for (
          const game of
            payload.games ?? []
        ) {
          /*
           * NHL game types:
           *
           * 1 = preseason
           * 2 = regular season
           * 3 = playoffs
           *
           * Historical G365 projection data currently needs
           * regular-season games only.
           */

          if (
            game.gameType !== 2
          ) {
            continue;
          }

          if (!game.id) {
            continue;
          }

          if (
            String(
              game.season ?? "",
            ) !== seasonCode
          ) {
            continue;
          }

          gamesByNhlId.set(
            String(
              game.id,
            ),
            game,
          );
        }
      } catch (error) {
        fetchErrors.push({
          team:
            nhlApiAbbreviation,

          databaseAbbreviation:
            abbreviation,

          error:
            error instanceof Error
              ? error.message
              : "Unknown NHL API request error.",
        });
      }
    }

    if (
      schedulesFetched === 0
    ) {
      return jsonError(
        "No NHL team schedules could be fetched.",
        502,
        fetchErrors,
      );
    }

    /*
     * ============================================================
     * PREPARE DATABASE ROWS
     * ============================================================
     */

    const seasonStartYear =
      getSeasonStartYear(
        seasonCode,
      );

    const rows: Array<
      Record<
        string,
        unknown
      >
    > = [];

    const skippedGames: Array<{
      nhlGameId: string;
      reason: string;
    }> = [];

    for (
      const [
        nhlGameId,
        game,
      ] of gamesByNhlId.entries()
    ) {
      const awayNhlTeamId =
        game.awayTeam?.id != null
          ? String(
              game.awayTeam.id,
            )
          : null;

      const homeNhlTeamId =
        game.homeTeam?.id != null
          ? String(
              game.homeTeam.id,
            )
          : null;

      /*
       * Both teams must be identifiable from the NHL response.
       */

      if (
        !awayNhlTeamId ||
        !homeNhlTeamId
      ) {
        skippedGames.push({
          nhlGameId,

          reason:
            "Missing NHL home/away team ID.",
        });

        continue;
      }

      /*
       * Convert external NHL team IDs into G365 internal team IDs.
       */

      const awayTeamId =
        internalTeamIdByNhlId.get(
          awayNhlTeamId,
        );

      const homeTeamId =
        internalTeamIdByNhlId.get(
          homeNhlTeamId,
        );

      if (
        awayTeamId == null ||
        homeTeamId == null
      ) {
        skippedGames.push({
          nhlGameId,

          reason:
            `Unmapped NHL team ID: ` +
            `away=${awayNhlTeamId}, ` +
            `home=${homeNhlTeamId}.`,
        });

        continue;
      }

      if (
        !game.gameDate ||
        !game.startTimeUTC
      ) {
        skippedGames.push({
          nhlGameId,

          reason:
            "Missing game date or start time.",
        });

        continue;
      }

      const state =
        mapGameState(
          game.gameState,
        );

      const now =
        new Date()
          .toISOString();

      rows.push({
        /*
         * External NHL game identity.
         *
         * nhl_games.id remains G365's internal bigint primary key.
         */

        nhl_game_id:
          nhlGameId,

        /*
         * Historical NHL-native games do not fabricate ESPN IDs.
         *
         * PostgreSQL unique constraints allow multiple NULL values.
         */

        espn_event_id:
          null,

        /*
         * G365 season convention:
         *
         * NHL 20232024 -> G365 season 2023
         * NHL 20242025 -> G365 season 2024
         * NHL 20252026 -> G365 season 2025
         */

        season:
          seasonStartYear,

        season_type:
          gameTypeName(
            game.gameType,
          ),

        game_date:
          game.gameDate,

        start_time:
          game.startTimeUTC,

        away_team_id:
          awayTeamId,

        home_team_id:
          homeTeamId,

        away_score:
          typeof game
            .awayTeam
            ?.score ===
          "number"
            ? game
                .awayTeam
                .score
            : null,

        home_score:
          typeof game
            .homeTeam
            ?.score ===
          "number"
            ? game
                .homeTeam
                .score
            : null,

        status_type:
          state.statusType,

        status_name:
          state.statusName,

        status_detail:
          state.statusDetail,

        period:
          game
            .periodDescriptor
            ?.number ??
          null,

        display_clock:
          game.clock
            ?.timeRemaining ??
          null,

        status_completed:
          state.completed,

        is_overtime:
          isOvertimeGame(
            game,
          ),

        is_shootout:
          isShootoutGame(
            game,
          ),

        venue_name:
          localizedText(
            game.venue,
          ),

        provider_data: {
          provider:
            "NHL",

          source:
            "api-web.nhle.com",

          seasonCode,

          importedAt:
            now,

          game,
        },

        updated_at:
          now,
      });
    }

    /*
     * If the API worked but nothing could be mapped, stop instead
     * of silently reporting a successful empty import.
     */

    if (
      rows.length === 0
    ) {
      return jsonError(
        "NHL schedules were fetched but no importable regular-season games were found.",
        500,
        {
          season:
            seasonCode,

          schedulesFetched,

          uniqueRegularSeasonGames:
            gamesByNhlId.size,

          skippedGames,

          fetchErrors,
        },
      );
    }

    /*
     * ============================================================
     * UPSERT INTO nhl_games
     * ============================================================
     *
     * nhl_games.nhl_game_id has a unique index.
     *
     * Therefore this route is intentionally idempotent:
     *
     * - existing historical games are updated
     * - newly discovered games are inserted
     * - duplicate NHL games are not created
     *
     * This makes rerunning 2023-24 safe after adding Arizona.
     * ============================================================
     */

    const batchSize = 250;

    let rowsUpserted = 0;

    for (
      let index = 0;
      index < rows.length;
      index += batchSize
    ) {
      const batch =
        rows.slice(
          index,
          index + batchSize,
        );

      const {
        error: upsertError,
      } = await supabase
        .from("nhl_games")
        .upsert(
          batch,
          {
            onConflict:
              "nhl_game_id",

            ignoreDuplicates:
              false,
          },
        );

      if (upsertError) {
        return jsonError(
          "Failed to upsert historical NHL games.",
          500,
          {
            season:
              seasonCode,

            batchStart:
              index,

            batchSize:
              batch.length,

            error:
              upsertError.message,
          },
        );
      }

      rowsUpserted +=
        batch.length;
    }

    /*
     * ============================================================
     * VERIFY DATABASE COUNT
     * ============================================================
     */

    const {
      count:
        databaseCount,

      error:
        countError,
    } = await supabase
      .from("nhl_games")
      .select(
        "id",
        {
          count: "exact",
          head: true,
        },
      )
      .eq(
        "season",
        seasonStartYear,
      )
      .eq(
        "season_type",
        "regular",
      );

    if (countError) {
      return jsonError(
        "Historical games imported, but verification count failed.",
        500,
        countError.message,
      );
    }

    /*
     * ============================================================
     * RESULT
     * ============================================================
     */

    return NextResponse.json({
      success: true,

      provider:
        "NHL",

      authorization:
        isLocalDevelopment
          ? "local-development"
          : "sync-secret",

      seasonCode,

      g365Season:
        seasonStartYear,

      teamsLoaded:
        teams.length,

      schedulesFetched,

      uniqueRegularSeasonGamesFound:
        gamesByNhlId.size,

      rowsPrepared:
        rows.length,

      rowsUpserted,

      databaseRegularSeasonGames:
        databaseCount ?? 0,

      skippedGamesCount:
        skippedGames.length,

      skippedGames,

      scheduleFetchErrorsCount:
        fetchErrors.length,

      scheduleFetchErrors:
        fetchErrors,
    });
  } catch (error) {
    return jsonError(
      "Unexpected historical NHL game backfill error.",
      500,
      error instanceof Error
        ? error.message
        : String(error),
    );
  }
}