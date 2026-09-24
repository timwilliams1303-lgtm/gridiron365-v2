import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

type ReconcileRequestBody = {
  daysBack?: number;
  limit?: number;
  season?: number;
};

type NhlGameRow = {
  id: number;
  nhl_game_id: string | null;
  season: number;
  season_type: string;
  start_time: string;
  status_completed: boolean;
};

type ReconcileResult = {
  internalGameId: number;
  nhlGameId: string | null;
  season: number;
  startTime: string;
  success: boolean;
  httpStatus?: number;
  error?: string;
};

function createAdminClient() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
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
    process.env.GRIDIRON_SYNC_SECRET ??
    process.env.NFL_SYNC_SECRET;

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
    headerSecret === expectedSecret ||
    bearerSecret === expectedSecret
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
        ? { details }
        : {}),
    },
    {
      status,
    }
  );
}

function clampInteger(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number
) {
  const parsed =
    Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(
    maximum,
    Math.max(
      minimum,
      Math.trunc(parsed)
    )
  );
}

function getOrigin(
  request: Request
) {
  const configured =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.SITE_URL;

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

async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (
    item: T
  ) => Promise<void>
) {
  let nextIndex = 0;

  async function runWorker() {
    while (true) {
      const index =
        nextIndex++;

      if (index >= items.length) {
        return;
      }

      await worker(
        items[index]
      );
    }
  }

  await Promise.all(
    Array.from(
      {
        length:
          Math.min(
            concurrency,
            items.length
          ),
      },
      () => runWorker()
    )
  );
}

export async function POST(
  request: Request
) {
  const startedAt =
    Date.now();

  try {
    if (!isAuthorized(request)) {
      return errorResponse(
        "Unauthorized.",
        401
      );
    }

    let body:
      ReconcileRequestBody = {};

    try {
      const text =
        await request.text();

      if (text.trim()) {
        body =
          JSON.parse(
            text
          ) as ReconcileRequestBody;
      }
    } catch {
      return errorResponse(
        "Request body must be valid JSON.",
        400
      );
    }

    /*
     * Rolling reconciliation window.
     *
     * Default:
     *   previous 3 days
     *
     * Maximum:
     *   14 days
     */
    const daysBack =
      clampInteger(
        body.daysBack,
        3,
        1,
        14
      );

    /*
     * Safety limit so one cron run
     * cannot accidentally re-fetch
     * an entire season.
     */
    const limit =
      clampInteger(
        body.limit,
        50,
        1,
        100
      );

    const requestedSeason =
      body.season !== undefined
        ? Number(
            body.season
          )
        : null;

    if (
      requestedSeason !== null &&
      (
        !Number.isInteger(
          requestedSeason
        ) ||
        requestedSeason < 2000 ||
        requestedSeason > 2200
      )
    ) {
      return errorResponse(
        "season must be a valid NHL season start year.",
        400
      );
    }

    const supabase =
      createAdminClient();

    const now =
      new Date();

    const windowStart =
      new Date(
        now.getTime() -
          daysBack *
            24 *
            60 *
            60 *
            1000
      );

    /*
     * Only completed NHL games are
     * reconciliation candidates.
     *
     * Regular season + postseason
     * are included.
     *
     * Preseason is intentionally
     * excluded.
     */
    let query =
      supabase
        .from(
          "nhl_games"
        )
        .select(
          `
            id,
            nhl_game_id,
            season,
            season_type,
            start_time,
            status_completed
          `
        )
        .eq(
          "status_completed",
          true
        )
        .in(
          "season_type",
          [
            "regular",
            "postseason",
          ]
        )
        .gte(
          "start_time",
          windowStart.toISOString()
        )
        .lte(
          "start_time",
          now.toISOString()
        )
        .order(
          "start_time",
          {
            ascending: false,
          }
        )
        .limit(
          limit
        );

    if (
      requestedSeason !== null
    ) {
      query =
        query.eq(
          "season",
          requestedSeason
        );
    }

    const {
      data:
        candidateRows,
      error:
        candidateError,
    } =
      await query;

    if (candidateError) {
      return errorResponse(
        "Unable to load completed NHL games for reconciliation.",
        500,
        candidateError
      );
    }

    const candidates =
      (
        candidateRows ??
        []
      ) as NhlGameRow[];

    /*
     * We cannot use the official
     * Gamecenter stats endpoint
     * without nhl_game_id.
     *
     * Keep these visible in the
     * response rather than silently
     * ignoring schedule identity
     * problems.
     */
    const missingOfficialId =
      candidates.filter(
        (game) =>
          !game.nhl_game_id
      );

    const eligibleGames =
      candidates.filter(
        (
          game
        ): game is
          NhlGameRow & {
            nhl_game_id: string;
          } =>
          Boolean(
            game.nhl_game_id
          )
      );

    const results:
      ReconcileResult[] =
      [];

    const origin =
      getOrigin(
        request
      );

    /*
     * Reuse the exact same secret
     * accepted by sync-game-stats.
     */
    const syncSecret =
      process.env.GRIDIRON_SYNC_SECRET ??
      process.env.NFL_SYNC_SECRET ??
      "";

    /*
     * Keep concurrency modest.
     *
     * Each game calls four official
     * NHL Gamecenter endpoints and
     * performs several DB writes.
     */
    const concurrency = 3;

    await runWithConcurrency(
      eligibleGames,
      concurrency,
      async (
        game
      ) => {
        try {
          const response =
            await fetch(
              `${origin}/api/nhl/sync-game-stats`,
              {
                method:
                  "POST",

                cache:
                  "no-store",

                headers: {
                  "Content-Type":
                    "application/json",

                  ...(syncSecret
                    ? {
                        "x-gridiron-sync-secret":
                          syncSecret,
                      }
                    : {}),
                },

                body:
                  JSON.stringify({
                    nhlGameId:
                      game.nhl_game_id,
                  }),
              }
            );

          const responseText =
            await response.text();

          if (!response.ok) {
            results.push({
              internalGameId:
                game.id,

              nhlGameId:
                game.nhl_game_id,

              season:
                game.season,

              startTime:
                game.start_time,

              success:
                false,

              httpStatus:
                response.status,

              error:
                responseText.slice(
                  0,
                  1000
                ),
            });

            return;
          }

          results.push({
            internalGameId:
              game.id,

            nhlGameId:
              game.nhl_game_id,

            season:
              game.season,

            startTime:
              game.start_time,

            success:
              true,

            httpStatus:
              response.status,
          });
        } catch (
          error
        ) {
          results.push({
            internalGameId:
              game.id,

            nhlGameId:
              game.nhl_game_id,

            season:
              game.season,

            startTime:
              game.start_time,

            success:
              false,

            error:
              error instanceof Error
                ? error.message
                : "Unknown reconciliation error.",
          });
        }
      }
    );

    /*
     * Stable output ordering.
     */
    results.sort(
      (
        a,
        b
      ) =>
        b.startTime.localeCompare(
          a.startTime
        )
    );

    const succeeded =
      results.filter(
        (result) =>
          result.success
      ).length;

    const failed =
      results.filter(
        (result) =>
          !result.success
      ).length;

    /*
     * Re-run NHL Traditional lifecycle
     * after official stats have been
     * refreshed.
     *
     * This recalculates fantasy scoring
     * from the newly reconciled source
     * stats without duplicating fantasy
     * scoring logic in this route.
     */
    let lifecycle:
      unknown = null;

    let lifecycleError:
      string | null =
        null;

    if (
      succeeded > 0
    ) {
      const {
        data:
          lifecycleData,
        error:
          lifecycleRpcError,
      } =
        await supabase.rpc(
          "run_nhl_traditional_lifecycle"
        );

      if (
        lifecycleRpcError
      ) {
        lifecycleError =
          lifecycleRpcError.message;
      } else {
        lifecycle =
          lifecycleData;
      }
    }

    const success =
      failed === 0 &&
      missingOfficialId.length ===
        0 &&
      lifecycleError === null;

    return NextResponse.json({
      success,

      source:
        "NHL",

      syncType:
        "final-game-reconciliation",

      daysBack,

      season:
        requestedSeason,

      windowStart:
        windowStart.toISOString(),

      windowEnd:
        now.toISOString(),

      candidates:
        candidates.length,

      eligibleGames:
        eligibleGames.length,

      missingOfficialId:
        missingOfficialId.length,

      missingOfficialIdGames:
        missingOfficialId.map(
          (game) => ({
            internalGameId:
              game.id,

            season:
              game.season,

            startTime:
              game.start_time,
          })
        ),

      attempted:
        results.length,

      succeeded,

      failed,

      results,

      lifecycleRan:
        succeeded > 0,

      lifecycleSuccess:
        lifecycleError ===
        null,

      lifecycleError,

      lifecycle,

      durationMs:
        Date.now() -
        startedAt,

      completedAt:
        new Date()
          .toISOString(),
    });
  } catch (
    error
  ) {
    console.error(
      "NHL final-game reconciliation failed:",
      error
    );

    return errorResponse(
      error instanceof Error
        ? error.message
        : "Unknown NHL final-game reconciliation error.",
      500
    );
  }
}