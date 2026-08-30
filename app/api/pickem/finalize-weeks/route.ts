import {
  NextResponse,
} from "next/server";

import {
  createClient,
} from "@supabase/supabase-js";


export const dynamic =
  "force-dynamic";

export const maxDuration =
  300;


type FinalizeRequestBody = {
  leagueId?: string;
  season?: number;
  week?: number;
};


type PickemWeekRow = {
  id: number;
  league_id: string;
  season: number;
  week: number;
  status: string;
  finalize_not_before:
    string | null;
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
      "Missing Supabase server environment variables."
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
  request:
    Request
) {
  if (
    process.env.NODE_ENV !==
    "production"
  ) {
    return true;
  }

  const configuredSecret =
    process.env
      .NFL_SYNC_SECRET ??
    process.env
      .GRIDIRON_SYNC_SECRET;

  if (!configuredSecret) {
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
      ? authorization.slice(
          7
        )
      : null;

  return (
    headerSecret ===
      configuredSecret ||
    bearerSecret ===
      configuredSecret
  );
}


export async function POST(
  request:
    Request
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
          "Unauthorized Pick'em finalization request.",
      },
      {
        status:
          401,
      }
    );
  }

  try {
    let body:
      FinalizeRequestBody =
      {};

    try {
      body =
        (
          await request.json()
        ) as FinalizeRequestBody;
    } catch {
      body = {};
    }

    const season =
      body.season ===
      undefined
        ? null
        : Number(
            body.season
          );

    const week =
      body.week ===
      undefined
        ? null
        : Number(
            body.week
          );

    if (
      season !==
        null &&
      (
        !Number.isInteger(
          season
        ) ||
        season <
          2000 ||
        season >
          2200
      )
    ) {
      return NextResponse.json(
        {
          success:
            false,
          error:
            "A valid season is required.",
        },
        {
          status:
            400,
        }
      );
    }

    if (
      week !==
        null &&
      (
        !Number.isInteger(
          week
        ) ||
        week <
          1 ||
        week >
          30
      )
    ) {
      return NextResponse.json(
        {
          success:
            false,
          error:
            "A valid Pick'em week is required.",
        },
        {
          status:
            400,
        }
      );
    }

    const supabase =
      createSupabaseAdmin();

    let query =
      supabase
        .from(
          "pickem_weeks"
        )
        .select(
          "id,league_id,season,week,status,finalize_not_before"
        )
        .neq(
          "status",
          "final"
        );

    if (
      body.leagueId
    ) {
      query =
        query.eq(
          "league_id",
          body.leagueId
        );
    }

    if (
      season !==
      null
    ) {
      query =
        query.eq(
          "season",
          season
        );
    }

    if (
      week !==
      null
    ) {
      query =
        query.eq(
          "week",
          week
        );
    }

    const {
      data,
      error,
    } =
      await query.order(
        "week",
        {
          ascending:
            true,
        }
      );

    if (error) {
      throw new Error(
        `Could not load Pick'em weeks: ${error.message}`
      );
    }

    const weeks =
      (
        data ??
        []
      ) as PickemWeekRow[];

    const results:
      Array<{
        leagueId:
          string;
        season:
          number;
        week:
          number;
        response:
          unknown;
      }> = [];

    for (
      const pickemWeek
      of weeks
    ) {
      const {
        data:
          finalizeData,
        error:
          finalizeError,
      } =
        await supabase.rpc(
          "finalize_pickem_week",
          {
            p_pickem_week_id:
              pickemWeek.id,
          }
        );

      if (
        finalizeError
      ) {
        throw new Error(
          `Could not finalize Pick'em week ${pickemWeek.id}: ${finalizeError.message}`
        );
      }

      results.push({
        leagueId:
          pickemWeek.league_id,
        season:
          pickemWeek.season,
        week:
          pickemWeek.week,
        response:
          finalizeData,
      });
    }

    return NextResponse.json({
      success:
        true,
      weeksChecked:
        weeks.length,
      results,
    });
  } catch (
    error
  ) {
    console.error(
      "Pick'em week finalization failed:",
      error
    );

    return NextResponse.json(
      {
        success:
          false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown Pick'em finalization error.",
      },
      {
        status:
          500,
      }
    );
  }
}
