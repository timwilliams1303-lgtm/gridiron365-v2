import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  requireLeagueMember,
} from "@/lib/leagues/requireLeagueMember";

import {
  createSupabaseAdminClient,
} from "@/lib/supabase/admin";

export const dynamic =
  "force-dynamic";

export const revalidate =
  0;

type RouteContext = {
  params: Promise<{
    dogId: string;
  }>;
};

export async function GET(
  request: NextRequest,
  context: RouteContext,
) {
  try {
    const {
      dogId: dogIdText,
    } = await context.params;

    const leagueId =
      request.nextUrl.searchParams.get(
        "leagueId",
      );

    if (!leagueId) {
      return NextResponse.json(
        {
          success: false,
          error:
            "leagueId is required.",
        },
        {
          status: 400,
        },
      );
    }

    const dogId =
      Number(dogIdText);

    if (
      !Number.isInteger(
        dogId,
      ) ||
      dogId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Invalid Greyhound dog ID.",
        },
        {
          status: 400,
        },
      );
    }

    const access =
      await requireLeagueMember(
        leagueId,
      );

    if (
      String(
        access.league
          .leagueType,
      ) !== "greyhound"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "This league is not a Greyhound league.",
        },
        {
          status: 403,
        },
      );
    }

    const supabase =
      createSupabaseAdminClient();

    const {
      data,
      error,
    } =
      await supabase.rpc(
        "get_greyhound_dog_profile",
        {
          p_dog_id:
            dogId,
        },
      );

    if (error) {
      console.error(
        "[greyhound-dog-profile]",
        error,
      );

      return NextResponse.json(
        {
          success: false,
          error:
            error.message,
        },
        {
          status: 500,
        },
      );
    }

    if (!data) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Greyhound profile was not found.",
        },
        {
          status: 404,
        },
      );
    }

    return NextResponse.json(
      {
        success: true,
        profile: data,
      },
      {
        status: 200,
        headers: {
          "Cache-Control":
            "no-store, max-age=0",
        },
      },
    );
  } catch (
    caught
  ) {
    const message =
      caught instanceof Error
        ? caught.message
        : "Could not load Greyhound profile.";

    console.error(
      "[greyhound-dog-profile]",
      caught,
    );

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      {
        status: 500,
      },
    );
  }
}