import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type SyncTarget = {
  league_id: string;
  league_name: string | null;
  season: number;
};

type StepResult = {
  success: boolean;
  status: number;
  result: unknown;
};

type LeagueSyncResult = {
  leagueId: string;
  leagueName: string | null;
  season: number;
  success: boolean;
  schedule: StepResult;
  scores: StepResult;
  lines: StepResult;
};

function getSupabaseAdmin() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL is not configured."
    );
  }

  if (!serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not configured."
    );
  }

  return createClient(
    supabaseUrl,
    serviceRoleKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}

function getConfiguredSecret() {
  return (
    process.env.GRIDIRON_SYNC_SECRET ??
    process.env.NFL_SYNC_SECRET ??
    null
  );
}

function isAuthorized(
  request: NextRequest
) {
  const configuredSecret =
    getConfiguredSecret();

  if (!configuredSecret) {
    return (
      process.env.NODE_ENV !==
      "production"
    );
  }

  const providedSecret =
    request.headers.get(
      "x-gridiron-sync-secret"
    );

  const authorization =
    request.headers.get(
      "authorization"
    );

  const bearer =
    authorization?.startsWith(
      "Bearer "
    )
      ? authorization.slice(7)
      : null;

  return (
    providedSecret ===
      configuredSecret ||
    bearer ===
      configuredSecret
  );
}

function formatDateUTC(
  date: Date
) {
  const year =
    date.getUTCFullYear();

  const month =
    String(
      date.getUTCMonth() + 1
    ).padStart(
      2,
      "0"
    );

  const day =
    String(
      date.getUTCDate()
    ).padStart(
      2,
      "0"
    );

  return `${year}-${month}-${day}`;
}

function addUtcDays(
  date: Date,
  days: number
) {
  const next =
    new Date(date);

  next.setUTCDate(
    next.getUTCDate() +
      days
  );

  return next;
}

function isValidDateString(
  value: string | null
): value is string {
  if (!value) {
    return false;
  }

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      value
    )
  ) {
    return false;
  }

  const parsed =
    new Date(
      `${value}T00:00:00Z`
    );

  return !Number.isNaN(
    parsed.getTime()
  );
}

function getRequestOrigin(
  request: NextRequest
) {
  /*
   * Use the actual request origin so:
   * - localhost calls localhost
   * - production calls production
   */
  return request.nextUrl.origin.replace(
    /\/+$/,
    ""
  );
}

function parseBoundedInteger(
  value: string | null,
  fallback: number,
  minimum: number,
  maximum: number
) {
  /*
   * Important:
   *
   * Number(null) === 0, so we must explicitly
   * return the configured fallback when the
   * query parameter was not supplied.
   */
  if (
    value === null ||
    value.trim() === ""
  ) {
    return fallback;
  }

  const parsed =
    Number(value);

  if (
    !Number.isFinite(parsed)
  ) {
    return fallback;
  }

  return Math.max(
    minimum,
    Math.min(
      maximum,
      Math.trunc(parsed)
    )
  );
}

async function readJsonResponse(
  response: Response
) {
  const text =
    await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return {
      error:
        "Route returned a non-JSON response.",
      responsePreview:
        text.slice(
          0,
          500
        ),
    };
  }
}

async function callInternalRoute(
  url: string,
  options: {
    method: "GET" | "POST";
    secret: string | null;
    body?: unknown;
  }
): Promise<StepResult> {
  try {
    const headers:
      Record<string, string> = {
        Accept:
          "application/json",
      };

    if (
      options.secret
    ) {
      headers[
        "x-gridiron-sync-secret"
      ] =
        options.secret;
    }

    if (
      options.body !==
      undefined
    ) {
      headers[
        "Content-Type"
      ] =
        "application/json";
    }

    const response =
      await fetch(
        url,
        {
          method:
            options.method,
          headers,
          body:
            options.body !==
            undefined
              ? JSON.stringify(
                  options.body
                )
              : undefined,
          cache:
            "no-store",
        }
      );

    const result =
      await readJsonResponse(
        response
      );

    return {
      success:
        response.ok,
      status:
        response.status,
      result,
    };
  } catch (
    error
  ) {
    return {
      success: false,
      status: 500,
      result: {
        error:
          error instanceof Error
            ? error.message
            : "Unknown internal route error",
      },
    };
  }
}

async function runSync(
  request: NextRequest
) {
  if (
    !isAuthorized(
      request
    )
  ) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Unauthorized",
      },
      {
        status: 401,
      }
    );
  }

  try {
    const supabase =
      getSupabaseAdmin();

    const searchParams =
      request.nextUrl
        .searchParams;

    /*
     * --------------------------------------------------
     * Schedule-sync date window
     * --------------------------------------------------
     */

    const lookbackDays =
      parseBoundedInteger(
        searchParams.get(
          "lookbackDays"
        ),
        1,
        0,
        30
      );

    const lookaheadDays =
      parseBoundedInteger(
        searchParams.get(
          "lookaheadDays"
        ),
        7,
        0,
        60
      );

    const requestedDateFrom =
      searchParams.get(
        "dateFrom"
      );

    const requestedDateTo =
      searchParams.get(
        "dateTo"
      );

    if (
      requestedDateFrom &&
      !isValidDateString(
        requestedDateFrom
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "dateFrom must use YYYY-MM-DD format.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      requestedDateTo &&
      !isValidDateString(
        requestedDateTo
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "dateTo must use YYYY-MM-DD format.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      (
        requestedDateFrom &&
        !requestedDateTo
      ) ||
      (
        !requestedDateFrom &&
        requestedDateTo
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "dateFrom and dateTo must be supplied together.",
        },
        {
          status: 400,
        }
      );
    }

    let dateFrom:
      string;

    let dateTo:
      string;

    let dateMode:
      | "automatic"
      | "override";

    if (
      requestedDateFrom &&
      requestedDateTo
    ) {
      const fromDate =
        new Date(
          `${requestedDateFrom}T00:00:00Z`
        );

      const toDate =
        new Date(
          `${requestedDateTo}T00:00:00Z`
        );

      if (
        toDate.getTime() <
        fromDate.getTime()
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "dateTo must be greater than or equal to dateFrom.",
          },
          {
            status: 400,
          }
        );
      }

      const rangeDays =
        Math.floor(
          (
            toDate.getTime() -
            fromDate.getTime()
          ) /
            86_400_000
        ) + 1;

      if (
        rangeDays >
        31
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Manual date override is limited to 31 calendar days.",
          },
          {
            status: 400,
          }
        );
      }

      dateFrom =
        requestedDateFrom;

      dateTo =
        requestedDateTo;

      dateMode =
        "override";
    } else {
      const now =
        new Date();

      dateFrom =
        formatDateUTC(
          addUtcDays(
            now,
            -lookbackDays
          )
        );

      dateTo =
        formatDateUTC(
          addUtcDays(
            now,
            lookaheadDays
          )
        );

      dateMode =
        "automatic";
    }

    /*
     * --------------------------------------------------
     * Score-sync configuration
     * --------------------------------------------------
     */

    const scorePastHours =
      parseBoundedInteger(
        searchParams.get(
          "scorePastHours"
        ),
        12,
        0,
        168
      );

    const scoreFutureHours =
      parseBoundedInteger(
        searchParams.get(
          "scoreFutureHours"
        ),
        8,
        0,
        72
      );

    const scoreLimit =
      parseBoundedInteger(
        searchParams.get(
          "scoreLimit"
        ),
        100,
        1,
        1000
      );

    /*
     * --------------------------------------------------
     * Line-sync configuration
     * --------------------------------------------------
     */

    const lineHorizonHours =
      parseBoundedInteger(
        searchParams.get(
          "lineHorizonHours"
        ),
        48,
        1,
        168
      );

    const lineCloseoutHours =
      parseBoundedInteger(
        searchParams.get(
          "lineCloseoutHours"
        ),
        6,
        1,
        24
      );

    const lineLimit =
      parseBoundedInteger(
        searchParams.get(
          "lineLimit"
        ),
        250,
        1,
        1000
      );

    /*
     * --------------------------------------------------
     * Load enabled NCAAMB leagues
     * --------------------------------------------------
     */

    const {
      data:
        targetData,
      error:
        targetError,
    } =
      await supabase.rpc(
        "get_ncaamb_pickem_sync_targets"
      );

    if (
      targetError
    ) {
      throw new Error(
        `Unable to load NCAAMB sync targets: ${targetError.message}`
      );
    }

    const targets =
      Array.isArray(
        targetData
      )
        ? targetData as SyncTarget[]
        : [];

    const origin =
      getRequestOrigin(
        request
      );

    const configuredSecret =
      getConfiguredSecret();

    const results:
      LeagueSyncResult[] =
      [];

    /*
     * --------------------------------------------------
     * Run each enabled league
     * --------------------------------------------------
     */

    for (
      const target
      of targets
    ) {
      /*
       * STEP 1
       * ESPN schedule sync.
       */
      const schedule =
        await callInternalRoute(
          `${origin}/api/pickem/ncaamb/sync-schedule`,
          {
            method:
              "POST",

            secret:
              configuredSecret,

            body: {
              leagueId:
                target.league_id,

              season:
                target.season,

              dateFrom,
              dateTo,
            },
          }
        );

      /*
       * STEP 2
       * ESPN score sync.
       */
      const scoreUrl =
        new URL(
          `${origin}/api/pickem/ncaamb/sync-scores`
        );

      scoreUrl.searchParams.set(
        "leagueId",
        target.league_id
      );

      scoreUrl.searchParams.set(
        "season",
        String(
          target.season
        )
      );

      scoreUrl.searchParams.set(
        "pastHours",
        String(
          scorePastHours
        )
      );

      scoreUrl.searchParams.set(
        "futureHours",
        String(
          scoreFutureHours
        )
      );

      scoreUrl.searchParams.set(
        "limit",
        String(
          scoreLimit
        )
      );

      const scores =
        await callInternalRoute(
          scoreUrl.toString(),
          {
            method:
              "GET",

            secret:
              configuredSecret,
          }
        );

      /*
       * STEP 3
       * G365 sportsbook spread sync.
       */
      const lineUrl =
        new URL(
          `${origin}/api/pickem/ncaamb/sync-lines`
        );

      lineUrl.searchParams.set(
        "leagueId",
        target.league_id
      );

      lineUrl.searchParams.set(
        "season",
        String(
          target.season
        )
      );

      lineUrl.searchParams.set(
        "horizonHours",
        String(
          lineHorizonHours
        )
      );

      lineUrl.searchParams.set(
        "closeoutHours",
        String(
          lineCloseoutHours
        )
      );

      lineUrl.searchParams.set(
        "limit",
        String(
          lineLimit
        )
      );

      const lines =
        await callInternalRoute(
          lineUrl.toString(),
          {
            method:
              "GET",

            secret:
              configuredSecret,
          }
        );

      /*
       * One failed step does not prevent
       * the other automation steps from running.
       */
      const success =
        schedule.success &&
        scores.success &&
        lines.success;

      results.push({
        leagueId:
          target.league_id,

        leagueName:
          target.league_name,

        season:
          target.season,

        success,

        schedule,
        scores,
        lines,
      });
    }

    /*
     * --------------------------------------------------
     * Aggregate runner results
     * --------------------------------------------------
     */

    const successfulLeagues =
      results.filter(
        (result) =>
          result.success
      ).length;

    const failedLeagues =
      results.length -
      successfulLeagues;

    const scheduleSuccesses =
      results.filter(
        (result) =>
          result.schedule
            .success
      ).length;

    const scheduleFailures =
      results.length -
      scheduleSuccesses;

    const scoreSuccesses =
      results.filter(
        (result) =>
          result.scores
            .success
      ).length;

    const scoreFailures =
      results.length -
      scoreSuccesses;

    const lineSuccesses =
      results.filter(
        (result) =>
          result.lines
            .success
      ).length;

    const lineFailures =
      results.length -
      lineSuccesses;

    return NextResponse.json(
      {
        success:
          failedLeagues ===
          0,

        sport:
          "ncaamb",

        automation: {
          schedule: true,
          scores: true,
          lines: true,
        },

        dateMode,

        dateFrom,
        dateTo,

        lookbackDays:
          dateMode ===
          "automatic"
            ? lookbackDays
            : null,

        lookaheadDays:
          dateMode ===
          "automatic"
            ? lookaheadDays
            : null,

        scoreSync: {
          pastHours:
            scorePastHours,

          futureHours:
            scoreFutureHours,

          limit:
            scoreLimit,

          successfulLeagues:
            scoreSuccesses,

          failedLeagues:
            scoreFailures,
        },

        lineSync: {
          horizonHours:
            lineHorizonHours,

          closeoutHours:
            lineCloseoutHours,

          limit:
            lineLimit,

          successfulLeagues:
            lineSuccesses,

          failedLeagues:
            lineFailures,
        },

        scheduleSync: {
          successfulLeagues:
            scheduleSuccesses,

          failedLeagues:
            scheduleFailures,
        },

        targetLeagues:
          targets.length,

        successfulLeagues,

        failedLeagues,

        origin,

        results,
      },
      {
        status:
          failedLeagues ===
          0
            ? 200
            : 207,
      }
    );
  } catch (
    error
  ) {
    console.error(
      "[NCAAMB PICKEM RUN SYNC ERROR]",
      error
    );

    return NextResponse.json(
      {
        success: false,

        sport:
          "ncaamb",

        error:
          error instanceof Error
            ? error.message
            : "Unknown NCAAMB runner error",
      },
      {
        status: 500,
      }
    );
  }
}

export async function GET(
  request: NextRequest
) {
  return runSync(
    request
  );
}

export async function POST(
  request: NextRequest
) {
  return runSync(
    request
  );
}