import {
  NextResponse,
} from "next/server";

import {
  createClient,
} from "@supabase/supabase-js";


type RequestBody = {
  leagueId?: string;
};


function env() {
  const url =
    process.env
      .NEXT_PUBLIC_SUPABASE_URL;

  const anon =
    process.env
      .NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env
      .NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const secret =
    process.env
      .GRIDIRON_SYNC_SECRET ??
    process.env
      .NFL_SYNC_SECRET;

  if (
    !url ||
    !anon ||
    !secret
  ) {
    throw new Error(
      "Required Pick'em sync environment variables are missing."
    );
  }

  return {
    url,
    anon,
    secret,
  };
}


export async function POST(
  request: Request
) {
  try {
    const authorization =
      request.headers.get(
        "authorization"
      );

    if (
      !authorization
        ?.startsWith(
          "Bearer "
        )
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Your login session is missing.",
        },
        {
          status: 401,
        }
      );
    }

    const body =
      (
        await request.json()
      ) as RequestBody;

    if (!body.leagueId) {
      return NextResponse.json(
        {
          success: false,
          error:
            "A league ID is required.",
        },
        {
          status: 400,
        }
      );
    }

    const {
      url,
      anon,
      secret,
    } =
      env();

    const userClient =
      createClient(
        url,
        anon,
        {
          global: {
            headers: {
              Authorization:
                authorization,
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

    const {
      data: userData,
      error: userError,
    } =
      await userClient.auth
        .getUser();

    if (
      userError ||
      !userData.user
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Your login session could not be verified.",
        },
        {
          status: 401,
        }
      );
    }

    const {
      data: membership,
      error: membershipError,
    } =
      await userClient
        .from(
          "league_members"
        )
        .select(
          "role"
        )
        .eq(
          "league_id",
          body.leagueId
        )
        .eq(
          "user_id",
          userData.user.id
        )
        .maybeSingle();

    if (
      membershipError ||
      !membership ||
      ![
        "commissioner",
        "co_commissioner",
      ].includes(
        membership.role
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Commissioner access is required.",
        },
        {
          status: 403,
        }
      );
    }

    const origin =
      new URL(
        request.url
      ).origin;

    const headers = {
      "Content-Type":
        "application/json",
      "x-gridiron-sync-secret":
        secret,
    };

    const prepareResponse =
      await fetch(
        `${origin}/api/pickem/prepare-weeks`,
        {
          method: "POST",
          headers,
          body:
            JSON.stringify({
              leagueId:
                body.leagueId,
            }),
          cache: "no-store",
        }
      );

    const prepareText =
      await prepareResponse.text();

    let prepare:
      unknown =
        prepareText;

    try {
      prepare =
        JSON.parse(
          prepareText
        );
    } catch {
      // keep text
    }

    if (
      !prepareResponse.ok
    ) {
      return NextResponse.json(
        {
          success: false,
          stage:
            "prepare-weeks",
          prepare,
        },
        {
          status:
            prepareResponse.status,
        }
      );
    }

    const syncResponse =
      await fetch(
        `${origin}/api/pickem/sync-games`,
        {
          method: "POST",
          headers,
          body:
            JSON.stringify({
              leagueId:
                body.leagueId,
            }),
          cache: "no-store",
        }
      );

    const syncText =
      await syncResponse.text();

    let sync:
      unknown =
        syncText;

    try {
      sync =
        JSON.parse(
          syncText
        );
    } catch {
      // keep text
    }

    return NextResponse.json(
      {
        success:
          syncResponse.ok,
        prepare,
        sync,
      },
      {
        status:
          syncResponse.ok
            ? 200
            : syncResponse.status,
      }
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Pick'em commissioner sync failed.",
      },
      {
        status: 500,
      }
    );
  }
}