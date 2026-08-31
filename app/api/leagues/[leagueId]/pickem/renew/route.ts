import {
  NextResponse,
} from "next/server";

import {
  createClient,
} from "@supabase/supabase-js";


export const dynamic =
  "force-dynamic";


type RouteContext = {
  params:
    Promise<{
      leagueId: string;
    }>;
};


type RenewResult = {
  success?: boolean;
  alreadyRenewed?: boolean;
  leagueId?: string;
  season?: number;
  historyId?: string;
};


function errorResponse(
  error: string,
  status: number
) {
  return NextResponse.json(
    {
      success: false,
      error,
    },
    {
      status,
    }
  );
}


function createAuthenticatedClient(
  accessToken: string
) {
  const supabaseUrl =
    process.env
      .NEXT_PUBLIC_SUPABASE_URL;

  const supabaseKey =
    process.env
      .NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env
      .NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (
    !supabaseUrl ||
    !supabaseKey
  ) {
    throw new Error(
      "Supabase environment variables are missing."
    );
  }

  return createClient(
    supabaseUrl,
    supabaseKey,
    {
      global: {
        headers: {
          Authorization:
            `Bearer ${accessToken}`,
        },
      },

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


export async function POST(
  request: Request,
  context: RouteContext
) {
  try {
    const authorization =
      request.headers.get(
        "authorization"
      );

    if (
      !authorization?.startsWith(
        "Bearer "
      )
    ) {
      return errorResponse(
        "Your login session is missing.",
        401
      );
    }

    const {
      leagueId,
    } =
      await context.params;

    if (
      !leagueId
    ) {
      return errorResponse(
        "A valid league ID is required.",
        400
      );
    }

    const accessToken =
      authorization.slice(
        7
      );

    const supabase =
      createAuthenticatedClient(
        accessToken
      );

    const {
      data:
        userData,
      error:
        userError,
    } =
      await supabase.auth
        .getUser();

    if (
      userError ||
      !userData.user
    ) {
      return errorResponse(
        "Your login session is invalid or has expired.",
        401
      );
    }

    const {
      data,
      error,
    } =
      await supabase.rpc(
        "renew_pickem_league",
        {
          p_source_league_id:
            leagueId,
        }
      );

    if (
      error
    ) {
      const message =
        error.message ??
        "Pick'em league renewal failed.";

      const lower =
        message.toLowerCase();

      const status =
        lower.includes(
          "commissioner access"
        )
          ? 403
          : lower.includes(
                "could not be found"
              )
            ? 404
            : lower.includes(
                  "must be completely finalized"
                ) ||
                lower.includes(
                  "has not been prepared"
                )
              ? 409
              : 500;

      return errorResponse(
        message,
        status
      );
    }

    const result =
      (
        data ??
        {}
      ) as RenewResult;

    if (
      !result.success ||
      !result.leagueId ||
      !result.season
    ) {
      return errorResponse(
        "Pick'em renewal did not return the new league.",
        500
      );
    }

    return NextResponse.json({
      success:
        true,
      alreadyRenewed:
        Boolean(
          result.alreadyRenewed
        ),
      leagueId:
        result.leagueId,
      season:
        result.season,
      historyId:
        result.historyId ??
        null,
    });
  } catch (
    error
  ) {
    console.error(
      "Pick'em league renewal failed:",
      error
    );

    return errorResponse(
      error instanceof
        Error
        ? error.message
        : "Unknown Pick'em renewal error.",
      500
    );
  }
}
