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

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

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

function isAuthorized(request: NextRequest) {
  const configuredSecret =
    process.env.GRIDIRON_SYNC_SECRET;

  if (!configuredSecret) {
    return process.env.NODE_ENV !== "production";
  }

  return (
    request.headers.get(
      "x-gridiron-sync-secret"
    ) === configuredSecret
  );
}

function parseInteger(
  value: string | null,
  fallback: number,
  minimum: number,
  maximum: number
) {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
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

/**
 * Always call the score-sync route on the SAME
 * application origin that called this runner.
 *
 * Local:
 *   http://localhost:3000
 *
 * Production:
 *   https://www.gridiron365fantasy.com
 *
 * This prevents local testing from accidentally
 * calling a production route that has not been
 * deployed yet.
 */
function getBaseUrl(
  request: NextRequest
) {
  return request.nextUrl.origin.replace(
    /\/+$/,
    ""
  );
}

async function runScoreSync(
  request: NextRequest
) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      {
        success: false,
        error: "Unauthorized",
      },
      {
        status: 401,
      }
    );
  }

  try {
    const supabase =
      getSupabaseAdmin();

    const params =
      request.nextUrl.searchParams;

    const seasonParam =
      params.get("season");

    const season =
      seasonParam
        ? Number(seasonParam)
        : new Date().getUTCFullYear();

    if (!Number.isInteger(season)) {
      return NextResponse.json(
        {
          success: false,
          error:
            "season must be an integer.",
        },
        {
          status: 400,
        }
      );
    }

    const pastHours =
      parseInteger(
        params.get("pastHours"),
        12,
        1,
        168
      );

    const futureHours =
      parseInteger(
        params.get("futureHours"),
        8,
        1,
        168
      );

    const limit =
      parseInteger(
        params.get("limit"),
        100,
        1,
        500
      );

    /*
     * Load all Pick'em leagues that currently
     * have NCAAMB enabled.
     */
    const {
      data: targetRows,
      error: targetError,
    } = await supabase.rpc(
      "get_ncaamb_pickem_sync_targets"
    );

    if (targetError) {
      throw new Error(
        `Unable to load NCAAMB sync targets: ${targetError.message}`
      );
    }

    const targets: SyncTarget[] =
      Array.isArray(targetRows)
        ? targetRows
            .filter(
              (row: any) =>
                Number(row.season) ===
                season
            )
            .map(
              (row: any) => ({
                league_id: String(
                  row.league_id
                ),

                league_name:
                  row.league_name !==
                    null &&
                  row.league_name !==
                    undefined
                    ? String(
                        row.league_name
                      )
                    : null,

                season: Number(
                  row.season
                ),
              })
            )
        : [];

    const syncSecret =
      process.env.GRIDIRON_SYNC_SECRET;

    if (!syncSecret) {
      throw new Error(
        "GRIDIRON_SYNC_SECRET is not configured."
      );
    }

    /*
     * IMPORTANT:
     * Use the current request origin.
     *
     * localhost runner -> localhost score sync
     * production runner -> production score sync
     */
    const baseUrl =
      getBaseUrl(request);

    const results: any[] = [];

    let successfulLeagues = 0;
    let failedLeagues = 0;

    let totalCandidates = 0;
    let totalUpdated = 0;
    let totalScheduled = 0;
    let totalLive = 0;
    let totalFinal = 0;
    let totalSkipped = 0;
    let totalErrors = 0;

    for (const target of targets) {
      try {
        const url =
          new URL(
            "/api/pickem/ncaamb/sync-scores",
            baseUrl
          );

        url.searchParams.set(
          "leagueId",
          target.league_id
        );

        url.searchParams.set(
          "season",
          String(target.season)
        );

        url.searchParams.set(
          "pastHours",
          String(pastHours)
        );

        url.searchParams.set(
          "futureHours",
          String(futureHours)
        );

        url.searchParams.set(
          "limit",
          String(limit)
        );

        const response =
          await fetch(
            url.toString(),
            {
              method: "GET",
              cache: "no-store",

              headers: {
                Accept:
                  "application/json",

                "x-gridiron-sync-secret":
                  syncSecret,
              },
            }
          );

        /*
         * Read as text first.
         *
         * If Next/Vercel ever returns an HTML
         * 404/500 page, this gives us the real
         * response instead of hiding it behind
         * "invalid JSON".
         */
        const rawBody =
          await response.text();

        let body: any = null;

        try {
          body = rawBody
            ? JSON.parse(rawBody)
            : {};
        } catch {
          body = {
            success: false,

            error:
              `Score-sync route returned a non-JSON response.`,

            responseStatus:
              response.status,

            responsePreview:
              rawBody
                .slice(0, 500),
          };
        }

        const resultSuccess =
          response.ok &&
          body?.success === true;

        results.push({
          leagueId:
            target.league_id,

          leagueName:
            target.league_name,

          season:
            target.season,

          success:
            resultSuccess,

          status:
            response.status,

          requestUrl:
            url.toString(),

          result:
            body,
        });

        if (resultSuccess) {
          successfulLeagues += 1;

          totalCandidates +=
            Number(
              body?.candidates ?? 0
            );

          totalUpdated +=
            Number(
              body?.updated ?? 0
            );

          totalScheduled +=
            Number(
              body?.scheduled ?? 0
            );

          totalLive +=
            Number(
              body?.live ?? 0
            );

          totalFinal +=
            Number(
              body?.final ?? 0
            );

          totalSkipped +=
            Number(
              body?.skipped ?? 0
            );

          totalErrors +=
            Number(
              body?.errors ?? 0
            );
        } else {
          failedLeagues += 1;

          totalErrors += Math.max(
            1,
            Number(
              body?.errors ?? 0
            )
          );
        }
      } catch (error) {
        failedLeagues += 1;
        totalErrors += 1;

        results.push({
          leagueId:
            target.league_id,

          leagueName:
            target.league_name,

          season:
            target.season,

          success: false,

          error:
            error instanceof Error
              ? error.message
              : "Unknown league score-sync error",
        });
      }
    }

    return NextResponse.json({
      success:
        failedLeagues === 0 &&
        totalErrors === 0,

      sport: "ncaamb",
      season,

      baseUrl,

      pastHours,
      futureHours,
      limit,

      targetLeagues:
        targets.length,

      successfulLeagues,
      failedLeagues,

      candidates:
        totalCandidates,

      updated:
        totalUpdated,

      scheduled:
        totalScheduled,

      live:
        totalLive,

      final:
        totalFinal,

      skipped:
        totalSkipped,

      errors:
        totalErrors,

      results,
    });
  } catch (error) {
    console.error(
      "[NCAAMB PICKEM SCORE RUNNER ERROR]",
      error
    );

    return NextResponse.json(
      {
        success: false,
        sport: "ncaamb",

        error:
          error instanceof Error
            ? error.message
            : "Unknown NCAAMB score runner error",
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
  return runScoreSync(request);
}

export async function POST(
  request: NextRequest
) {
  return runScoreSync(request);
}