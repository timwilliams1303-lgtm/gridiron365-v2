import {
  NextResponse,
} from "next/server";

import {
  createClient,
} from "@supabase/supabase-js";


export const dynamic =
  "force-dynamic";

/*
 * The centralized worker remains alive for most of
 * a one-minute cron window.
 *
 * Supabase should trigger this endpoint once per minute.
 * While alive, this route polls ESPN approximately every
 * 5 seconds.
 */
export const maxDuration =
  60;


const LIVE_POLL_INTERVAL_MS =
  5000;

/*
 * Stop before the platform hard timeout so the route
 * has time to return a clean JSON response.
 */
const WORKER_RUNTIME_MS =
  50000;


type GameRow = {
  id: number;

  espn_event_id: string;

  season: number;

  season_type: number;

  week: number;

  kickoff_at: string;

  status_name:
    string |
    null;

  status_completed:
    boolean |
    null;
};


type EspnStatus = {
  state:
    string |
    null;

  status:
    string |
    null;

  completed:
    boolean;
};


type InternalSyncResult = {
  ok: boolean;

  status: number;

  body:
    any;
};


type GameSyncResult = {
  nflGameId: number;

  eventId: string;

  season: number;

  seasonType: number;

  week: number;

  success: boolean;

  action:
    | "synced"
    | "skipped"
    | "failed";

  state?:
    string |
    null;

  status?:
    string |
    null;

  completed?: boolean;

  boxscore?: {
    ok: boolean;
    status: number;
  };

  playByPlay?: {
    ok: boolean;
    status: number;
    totalPlayCount?: number;
    playsUpserted?: number;
  };

  error?: string;
};


type WorkerCycleResult = {
  cycle: number;

  checkedAt: string;

  candidateGames: number;

  eligibleGames: number;

  liveGames: number;

  syncedGames: number;

  skippedGames: number;

  failedGames: number;

  results:
    GameSyncResult[];
};


function createSupabaseAdmin() {
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
      "Missing Supabase environment variables."
    );
  }


  return createClient(
    supabaseUrl,
    serviceRoleKey,
    {
      auth: {
        persistSession:
          false,

        autoRefreshToken:
          false,

        detectSessionInUrl:
          false,
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


  const secret =
    process.env
      .NFL_SYNC_SECRET;


  if (!secret) {
    return false;
  }


  const authorization =
    request.headers.get(
      "authorization"
    );


  if (
    authorization ===
    `Bearer ${secret}`
  ) {
    return true;
  }


  const customHeader =
    request.headers.get(
      "x-gridiron-sync-secret"
    );


  return (
    customHeader ===
    secret
  );
}


function sleep(
  milliseconds: number
) {
  return new Promise<void>(
    (
      resolve
    ) => {
      setTimeout(
        resolve,
        milliseconds
      );
    }
  );
}


async function fetchEspnStatus(
  eventId: string
): Promise<EspnStatus> {
  const url =
    `https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=${encodeURIComponent(
      eventId
    )}`;


  const response =
    await fetch(
      url,
      {
        headers: {
          Accept:
            "application/json",

          "User-Agent":
            "Mozilla/5.0 Gridiron365/2.0",
        },

        cache:
          "no-store",
      }
    );


  if (
    !response.ok
  ) {
    throw new Error(
      `ESPN returned HTTP ${response.status}`
    );
  }


  const data =
    await response.json();


  const competition =
    data
      ?.header
      ?.competitions
      ?.[0];


  if (
    !competition
  ) {
    throw new Error(
      "ESPN returned no competition."
    );
  }


  return {
    state:
      competition
        ?.status
        ?.type
        ?.state ??
      null,

    status:
      competition
        ?.status
        ?.type
        ?.name ??
      null,

    completed:
      competition
        ?.status
        ?.type
        ?.completed ===
      true,
  };
}


function isInsideGameWindow(
  kickoffAt: string,
  now: Date
) {
  const kickoff =
    new Date(
      kickoffAt
    ).getTime();


  if (
    !Number.isFinite(
      kickoff
    )
  ) {
    return false;
  }


  const current =
    now.getTime();


  /*
   * Start watching 20 minutes before kickoff.
   *
   * This allows ESPN status to transition naturally
   * from pre -> in without requiring any browser action.
   */
  const start =
    kickoff -
    20 *
      60 *
      1000;


  /*
   * Continue through regulation, delays and overtime.
   */
  const end =
    kickoff +
    7 *
      60 *
      60 *
      1000;


  return (
    current >=
      start &&
    current <=
      end
  );
}


function createInternalHeaders() {
  const headers =
    new Headers();


  const secret =
    process.env
      .NFL_SYNC_SECRET;


  if (
    secret
  ) {
    headers.set(
      "x-gridiron-sync-secret",
      secret
    );
  }


  return headers;
}


async function callInternalSyncRoute(
  origin: string,
  pathname: string,
  eventId: string
): Promise<InternalSyncResult> {
  const url =
    new URL(
      pathname,
      origin
    );


  url.searchParams.set(
    "eventId",
    eventId
  );


  const response =
    await fetch(
      url.toString(),
      {
        method:
          "POST",

        headers:
          createInternalHeaders(),

        cache:
          "no-store",
      }
    );


  const text =
    await response.text();


  let body:
    any =
      null;


  if (
    text
  ) {
    try {
      body =
        JSON.parse(
          text
        );
    } catch {
      body =
        {
          raw:
            text.slice(
              0,
              1000
            ),
        };
    }
  }


  return {
    ok:
      response.ok &&
      body?.success ===
        true,

    status:
      response.status,

    body,
  };
}


async function synchronizeGame(
  origin: string,
  game: GameRow,
  status:
    EspnStatus
): Promise<GameSyncResult> {
  try {
    /*
     * =====================================================
     * LIVE GAME
     * =====================================================
     *
     * Sync boxscore and play-by-play together.
     *
     * BOX SCORE:
     * - NFL player stats
     * - DST stats
     * - fantasy score fan-out
     * - Traditional scoring
     * - Season-Long scoring
     *
     * PLAY-BY-PLAY:
     * - possession
     * - quarter
     * - clock
     * - down / distance
     * - red zone
     * - scoring plays
     * =====================================================
     */
    if (
      status.state ===
      "in"
    ) {
      /*
       * sync-live-boxscore owns the single ESPN Core plays
       * fetch for this cycle. It now persists nfl_game_plays
       * from that same provider response before completing
       * fantasy scoring, so a second play-by-play route call
       * is no longer required here.
       */
      const boxscore =
        await callInternalSyncRoute(
          origin,
          "/api/nfl/sync-live-boxscore",
          game.espn_event_id
        );


      if (
        !boxscore.ok
      ) {
        return {
          nflGameId:
            game.id,

          eventId:
            game.espn_event_id,

          season:
            game.season,

          seasonType:
            game.season_type,

          week:
            game.week,

          success:
            false,

          action:
            "failed",

          state:
            status.state,

          status:
            status.status,

          completed:
            status.completed,

          boxscore: {
            ok:
              boxscore.ok,

            status:
              boxscore.status,
          },

          playByPlay: {
            ok:
              false,

            status:
              boxscore.status,

            totalPlayCount:
              Number(
                boxscore
                  .body
                  ?.playByPlay
                  ?.totalPlayCount ??
                0
              ),

            playsUpserted:
              Number(
                boxscore
                  .body
                  ?.playByPlay
                  ?.playsUpserted ??
                0
              ),
          },

          error:
            `Boxscore/live-data HTTP ${boxscore.status}: ${
              boxscore.body?.error ??
              "sync failed"
            }`,
        };
      }


      return {
        nflGameId:
          game.id,

        eventId:
          game.espn_event_id,

        season:
          game.season,

        seasonType:
          game.season_type,

        week:
          game.week,

        success:
          true,

        action:
          "synced",

        state:
          status.state,

        status:
          status.status,

        completed:
          status.completed,

        boxscore: {
          ok:
            true,

          status:
            boxscore.status,
        },

        playByPlay: {
          ok:
            true,

          status:
            boxscore.status,

          totalPlayCount:
            Number(
              boxscore
                .body
                ?.playByPlay
                ?.totalPlayCount ??
              0
            ),

          playsUpserted:
            Number(
              boxscore
                .body
                ?.playByPlay
                ?.playsUpserted ??
              0
            ),
        },
      };
    }


    /*
     * =====================================================
     * FINAL GAME
     * =====================================================
     *
     * Perform one last boxscore + play-by-play sync if our
     * nfl_games row does not yet say completed.
     */
    if (
      status.state ===
        "post" &&
      status.completed
    ) {
      if (
        game.status_completed ===
        true
      ) {
        return {
          nflGameId:
            game.id,

          eventId:
            game.espn_event_id,

          season:
            game.season,

          seasonType:
            game.season_type,

          week:
            game.week,

          success:
            true,

          action:
            "skipped",

          state:
            status.state,

          status:
            status.status,

          completed:
            true,
        };
      }


      /*
       * One final combined boxscore/live-data sync. The boxscore
       * route persists the final ESPN Core play feed itself.
       */
      const boxscore =
        await callInternalSyncRoute(
          origin,
          "/api/nfl/sync-live-boxscore",
          game.espn_event_id
        );


      if (
        !boxscore.ok
      ) {
        return {
          nflGameId:
            game.id,

          eventId:
            game.espn_event_id,

          season:
            game.season,

          seasonType:
            game.season_type,

          week:
            game.week,

          success:
            false,

          action:
            "failed",

          state:
            status.state,

          status:
            status.status,

          completed:
            true,

          error:
            `Final boxscore/live-data synchronization failed: ${
              boxscore.body?.error ??
              `HTTP ${boxscore.status}`
            }`,
        };
      }


      return {
        nflGameId:
          game.id,

        eventId:
          game.espn_event_id,

        season:
          game.season,

        seasonType:
          game.season_type,

        week:
          game.week,

        success:
          true,

        action:
          "synced",

        state:
          status.state,

        status:
          status.status,

        completed:
          true,

        boxscore: {
          ok:
            true,

          status:
            boxscore.status,
        },

        playByPlay: {
          ok:
            true,

          status:
            boxscore.status,

          totalPlayCount:
            Number(
              boxscore
                .body
                ?.playByPlay
                ?.totalPlayCount ??
              0
            ),

          playsUpserted:
            Number(
              boxscore
                .body
                ?.playByPlay
                ?.playsUpserted ??
              0
            ),
        },
      };
    }


    /*
     * Pregame / scheduled.
     *
     * We still queried the lightweight ESPN status endpoint,
     * but do not pull the heavier feeds yet.
     */
    return {
      nflGameId:
        game.id,

      eventId:
        game.espn_event_id,

      season:
        game.season,

      seasonType:
        game.season_type,

      week:
        game.week,

      success:
        true,

      action:
        "skipped",

      state:
        status.state,

      status:
        status.status,

      completed:
        status.completed,
    };
  } catch (
    error
  ) {
    return {
      nflGameId:
        game.id,

      eventId:
        game.espn_event_id,

      season:
        game.season,

      seasonType:
        game.season_type,

      week:
        game.week,

      success:
        false,

      action:
        "failed",

      state:
        status.state,

      status:
        status.status,

      completed:
        status.completed,

      error:
        error instanceof Error
          ? error.message
          : "Unknown game synchronization error.",
    };
  }
}


async function runCycle(
  request: Request,
  cycle: number
): Promise<WorkerCycleResult> {
  const supabase =
    createSupabaseAdmin();


  const now =
    new Date();


  /*
   * Query only games near the current date.
   *
   * The individual game-window test below performs
   * the final eligibility check.
   */
  const lowerBound =
    new Date(
      now.getTime() -
      12 *
        60 *
        60 *
        1000
    );


  const upperBound =
    new Date(
      now.getTime() +
      24 *
        60 *
        60 *
        1000
    );


  const {
    data,
    error,
  } =
    await supabase
      .from(
        "nfl_games"
      )
      .select(`
        id,
        espn_event_id,
        season,
        season_type,
        week,
        kickoff_at,
        status_name,
        status_completed
      `)
      .not(
        "espn_event_id",
        "is",
        null
      )
      .gte(
        "kickoff_at",
        lowerBound.toISOString()
      )
      .lte(
        "kickoff_at",
        upperBound.toISOString()
      )
      .order(
        "kickoff_at",
        {
          ascending:
            true,
        }
      );


  if (
    error
  ) {
    throw new Error(
      `Unable to load NFL games: ${error.message}`
    );
  }


  const candidates =
    (
      data ??
      []
    ) as GameRow[];


  const eligible =
    candidates.filter(
      (
        game
      ) =>
        isInsideGameWindow(
          game.kickoff_at,
          now
        )
    );


  const origin =
    new URL(
      request.url
    ).origin;


  /*
   * Query ESPN game statuses in parallel.
   *
   * This is substantially faster than processing NFL games
   * sequentially when several Sunday games are live.
   */
  const results =
    await Promise.all(
      eligible.map(
        async (
          game
        ): Promise<GameSyncResult> => {
          try {
            const status =
              await fetchEspnStatus(
                game.espn_event_id
              );


            return await synchronizeGame(
              origin,
              game,
              status
            );
          } catch (
            error
          ) {
            return {
              nflGameId:
                game.id,

              eventId:
                game.espn_event_id,

              season:
                game.season,

              seasonType:
                game.season_type,

              week:
                game.week,

              success:
                false,

              action:
                "failed",

              error:
                error instanceof Error
                  ? error.message
                  : "Unknown ESPN status error.",
            };
          }
        }
      )
    );


  const liveGames =
    results.filter(
      (
        result
      ) =>
        result.state ===
        "in"
    ).length;


  const syncedGames =
    results.filter(
      (
        result
      ) =>
        result.action ===
        "synced"
    ).length;


  const skippedGames =
    results.filter(
      (
        result
      ) =>
        result.action ===
        "skipped"
    ).length;


  const failedGames =
    results.filter(
      (
        result
      ) =>
        result.action ===
        "failed"
    ).length;


  return {
    cycle,

    checkedAt:
      now.toISOString(),

    candidateGames:
      candidates.length,

    eligibleGames:
      eligible.length,

    liveGames,

    syncedGames,

    skippedGames,

    failedGames,

    results,
  };
}


async function runSync(
  request: Request
) {
  if (
    !isAuthorized(
      request
    )
  ) {
    return NextResponse.json(
      {
        success:
          false,

        error:
          "Unauthorized sync request.",
      },
      {
        status:
          401,
      }
    );
  }


  const startedAt =
    Date.now();


  const cycles:
    WorkerCycleResult[] =
      [];


  let cycle =
    0;


  try {
    /*
     * =====================================================
     * CENTRALIZED LIVE LOOP
     * =====================================================
     *
     * A single scheduled request remains alive for roughly
     * 50 seconds and polls ESPN approximately every 5 sec.
     *
     * Browsers do NOT call ESPN.
     * Leagues do NOT independently call ESPN.
     */
    while (
      Date.now() -
        startedAt <
      WORKER_RUNTIME_MS
    ) {
      cycle +=
        1;


      const cycleStartedAt =
        Date.now();


      try {
        const result =
          await runCycle(
            request,
            cycle
          );


        cycles.push(
          result
        );


        /*
         * If no NFL games are even within the monitoring
         * window, there is no reason to keep this request
         * alive for another ~50 seconds.
         */
        if (
          result.eligibleGames ===
          0
        ) {
          break;
        }
      } catch (
        cycleError
      ) {
        console.error(
          `Central NFL live cycle ${cycle} failed:`,
          cycleError
        );
      }


      const elapsed =
        Date.now() -
        cycleStartedAt;


      const remainingUntilNext =
        LIVE_POLL_INTERVAL_MS -
        elapsed;


      if (
        remainingUntilNext >
        0
      ) {
        const remainingWorkerTime =
          WORKER_RUNTIME_MS -
          (
            Date.now() -
            startedAt
          );


        if (
          remainingWorkerTime <=
          remainingUntilNext
        ) {
          break;
        }


        await sleep(
          remainingUntilNext
        );
      }
    }


    const totalSyncedGames =
      cycles.reduce(
        (
          total,
          current
        ) =>
          total +
          current
            .syncedGames,
        0
      );


    const totalFailedGames =
      cycles.reduce(
        (
          total,
          current
        ) =>
          total +
          current
            .failedGames,
        0
      );


    const latest =
      cycles[
        cycles.length -
        1
      ] ??
      null;


    return NextResponse.json({
      success:
        totalFailedGames ===
        0,

      centralized:
        true,

      provider:
        "ESPN",

      startedAt:
        new Date(
          startedAt
        ).toISOString(),

      finishedAt:
        new Date()
          .toISOString(),

      runtimeMs:
        Date.now() -
        startedAt,

      pollIntervalMs:
        LIVE_POLL_INTERVAL_MS,

      cyclesRun:
        cycles.length,

      latestCycle:
        latest,

      totalGameSyncs:
        totalSyncedGames,

      totalFailures:
        totalFailedGames,

      cycles,
    });
  } catch (
    error
  ) {
    console.error(
      "Central NFL live worker failed:",
      error
    );


    return NextResponse.json(
      {
        success:
          false,

        centralized:
          true,

        error:
          error instanceof Error
            ? error.message
            : "Unknown centralized NFL live worker error.",
      },
      {
        status:
          500,
      }
    );
  }
}


export async function GET(
  request: Request
) {
  return runSync(
    request
  );
}


export async function POST(
  request: Request
) {
  return runSync(
    request
  );
}