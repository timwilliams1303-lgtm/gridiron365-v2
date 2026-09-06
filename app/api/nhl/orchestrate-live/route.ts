import {
  NextResponse,
} from "next/server";

import {
  createClient,
} from "@supabase/supabase-js";

export const dynamic =
  "force-dynamic";

export const maxDuration = 300;

type NhlGameRow = {
  id: number;
  nhl_game_id: string | null;
  start_time: string;
  status_completed: boolean;
};

function createAdminClient() {
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
      "Supabase admin environment variables are missing."
    );
  }

  return createClient(
    supabaseUrl,
    serviceRoleKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  );
}

function isAuthorized(
  request: Request
) {
  if (
    process.env.NODE_ENV !==
    "production"
  ) {
    return true;
  }

  const expectedSecret =
    process.env
      .GRIDIRON_SYNC_SECRET ??
    process.env
      .NFL_SYNC_SECRET;

  if (!expectedSecret) {
    return false;
  }

  const headerSecret =
    request.headers.get(
      "x-gridiron-sync-secret"
    );

  const authorization =
    request.headers.get(
      "authorization"
    );

  const bearerSecret =
    authorization?.startsWith(
      "Bearer "
    )
      ? authorization.slice(7)
      : null;

  return (
    headerSecret ===
      expectedSecret ||
    bearerSecret ===
      expectedSecret
  );
}

function errorResponse(
  message: string,
  status = 500,
  details?: unknown
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
    }
  );
}

function getBaseUrl(
  request: Request
) {
  const configured =
    process.env
      .NEXT_PUBLIC_SITE_URL ??
    process.env
      .SITE_URL;

  if (configured) {
    return configured.replace(
      /\/+$/,
      ""
    );
  }

  return new URL(
    request.url
  ).origin;
}

async function callInternalRoute(
  url: string,
  secret: string | undefined,
  body: Record<string, unknown>
) {
  const headers:
    Record<string, string> = {
      "Content-Type":
        "application/json",
    };

  if (secret) {
    headers[
      "x-gridiron-sync-secret"
    ] = secret;
  }

  const response =
    await fetch(
      url,
      {
        method: "POST",
        cache: "no-store",
        headers,
        body: JSON.stringify(
          body
        ),
      }
    );

  let payload: unknown = null;

  try {
    payload =
      await response.json();
  } catch {
    payload = null;
  }

  return {
    ok: response.ok,
    status: response.status,
    payload,
  };
}

export async function POST(
  request: Request
) {
  try {
    if (!isAuthorized(request)) {
      return errorResponse(
        "Unauthorized.",
        401
      );
    }

    const supabase =
      createAdminClient();

    const baseUrl =
      getBaseUrl(request);

    const syncSecret =
      process.env
        .GRIDIRON_SYNC_SECRET ??
      process.env
        .NFL_SYNC_SECRET;

    /*
     * --------------------------------------------------
     * STEP 1
     * Refresh ESPN live-state data for games that
     * already exist in public.nhl_games.
     *
     * ESPN does NOT establish NHL game identity.
     * The live route has already been hardened so
     * it cannot insert surprise schedule rows.
     * --------------------------------------------------
     */

    const liveStateResult =
      await callInternalRoute(
        `${baseUrl}/api/nhl/sync-live-games`,
        syncSecret,
        {}
      );

    /*
     * --------------------------------------------------
     * STEP 2
     * Find games that are inside the useful official
     * Gamecenter synchronization window.
     *
     * Start 30 minutes before puck drop so official
     * data can initialize as it becomes available.
     *
     * Continue through 6 hours after start time so
     * regulation, overtime, shootout, delays, and
     * finalization are covered.
     *
     * Completed games are normally skipped because
     * their final authoritative statistics are already
     * stored.
     * --------------------------------------------------
     */

    const now =
      new Date();

    const windowStart =
      new Date(
        now.getTime() -
        6 * 60 * 60 * 1000
      );

    const windowEnd =
      new Date(
        now.getTime() +
        30 * 60 * 1000
      );

    const {
      data: gameRows,
      error: gamesError,
    } = await supabase
      .from("nhl_games")
      .select(
        `
          id,
          nhl_game_id,
          start_time,
          status_completed
        `
      )
      .eq(
        "season_type",
        "regular"
      )
      .gte(
        "start_time",
        windowStart
          .toISOString()
      )
      .lte(
        "start_time",
        windowEnd
          .toISOString()
      )
      .eq(
        "status_completed",
        false
      )
      .not(
        "nhl_game_id",
        "is",
        null
      )
      .order(
        "start_time",
        {
          ascending: true,
        }
      );

    if (gamesError) {
      return errorResponse(
        "Unable to load NHL games for live orchestration.",
        500,
        gamesError
      );
    }

    const games =
      (gameRows ?? []) as
        NhlGameRow[];

    /*
     * Keep one invocation bounded.
     *
     * A typical NHL night is well below this.
     * The limit prevents one cron execution from
     * accidentally becoming an unbounded workload.
     */
    const selectedGames =
      games.slice(
        0,
        20
      );

    const gameResults:
      Array<Record<
        string,
        unknown
      >> = [];

    /*
     * --------------------------------------------------
     * STEP 3
     * Official NHL Gamecenter synchronization.
     *
     * Sequential execution is deliberate:
     * each game-stat request fetches four NHL
     * Gamecenter resources and writes player/team
     * statistics. This avoids a burst of many
     * simultaneous external requests.
     * --------------------------------------------------
     */

    for (
      const game of
      selectedGames
    ) {
      if (!game.nhl_game_id) {
        continue;
      }

      const result =
        await callInternalRoute(
          `${baseUrl}/api/nhl/sync-game-stats`,
          syncSecret,
          {
            nhlGameId:
              game.nhl_game_id,
          }
        );

      gameResults.push({
        internalNhlGameId:
          game.id,

        officialNhlGameId:
          game.nhl_game_id,

        startTime:
          game.start_time,

        success:
          result.ok,

        httpStatus:
          result.status,

        response:
          result.payload,
      });
    }

    /*
     * --------------------------------------------------
     * STEP 4
     * NHL Pick'em lifecycle.
     *
     * prepare:
     *   keeps upcoming contest games populated.
     *
     * finalize lines:
     *   freezes due G365 markets according to each
     *   game's already-calculated freeze_scheduled_at.
     *
     * lock picks:
     *   locks selections at actual NHL start time.
     *
     * grade:
     *   grades games once public.nhl_games is final.
     *
     * advance:
     *   advances/finalizes contest periods and awards.
     * --------------------------------------------------
     */

    const {
      data: prepareResult,
      error: prepareError,
    } = await supabase.rpc(
      "prepare_active_nhl_pickem_games",
      {
        p_lookahead_days: 8,
      }
    );

    const {
      data: lineResult,
      error: lineError,
    } = await supabase.rpc(
      "finalize_due_nhl_pickem_lines",
      {
        p_limit: 250,
      }
    );

    const {
      data: lockResult,
      error: lockError,
    } = await supabase.rpc(
      "lock_due_nhl_pickem_picks"
    );

    const {
      data: gradeResult,
      error: gradeError,
    } = await supabase.rpc(
      "grade_final_nhl_pickem_games",
      {
        p_limit: 250,
      }
    );

    const {
      data: advanceResult,
      error: advanceError,
    } = await supabase.rpc(
      "advance_nhl_pickem_period_lifecycle"
    );

    const failedGameSyncs =
      gameResults.filter(
        (result) =>
          result.success !== true
      );

    const lifecycleErrors = {
      prepare:
        prepareError ?? null,

      lines:
        lineError ?? null,

      locks:
        lockError ?? null,

      grading:
        gradeError ?? null,

      advance:
        advanceError ?? null,
    };

    const hasLifecycleError =
      Object.values(
        lifecycleErrors
      ).some(
        (value) =>
          value !== null
      );

    return NextResponse.json({
      success:
        liveStateResult.ok &&
        failedGameSyncs.length ===
          0 &&
        !hasLifecycleError,

      source:
        "Gridiron365 NHL Orchestrator",

      liveState: {
        success:
          liveStateResult.ok,

        httpStatus:
          liveStateResult.status,

        response:
          liveStateResult.payload,
      },

      officialStats: {
        gamesEligible:
          games.length,

        gamesAttempted:
          selectedGames.length,

        gamesSucceeded:
          gameResults.length -
          failedGameSyncs.length,

        gamesFailed:
          failedGameSyncs.length,

        results:
          gameResults,
      },

      pickem: {
        prepare:
          prepareResult ?? null,

        lines:
          lineResult ?? null,

        locks:
          lockResult ?? null,

        grading:
          gradeResult ?? null,

        advance:
          advanceResult ?? null,

        errors:
          lifecycleErrors,
      },
    });
  } catch (error) {
    console.error(
      "NHL live orchestrator failed:",
      error
    );

    return errorResponse(
      error instanceof Error
        ? error.message
        : "Unknown NHL live orchestrator error.",
      500
    );
  }
}