import {
  NextResponse,
} from "next/server";

import {
  requireLeagueMember,
} from "@/lib/leagues/requireLeagueMember";

import {
  createSupabaseServerClient,
} from "@/lib/supabase/server";

import {
  createSupabaseAdminClient,
} from "@/lib/supabase/admin";

type RouteContext = {
  params: Promise<{
    cardId: string;
  }>;
};

type RequestBody = {
  leagueId?: string;
};

export async function POST(
  request: Request,
  context: RouteContext,
) {
  try {
    const {
      cardId,
    } = await context.params;

    const numericCardId =
      Number(cardId);

    if (
      !Number.isInteger(
        numericCardId,
      ) ||
      numericCardId <= 0
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid Greyhound card ID.",
        },
        {
          status: 400,
        },
      );
    }

    const body =
      (await request
        .json()
        .catch(
          () => null,
        )) as RequestBody | null;

    const leagueId =
      typeof body?.leagueId ===
      "string"
        ? body.leagueId.trim()
        : "";

    if (!leagueId) {
      return NextResponse.json(
        {
          error:
            "leagueId is required.",
        },
        {
          status: 400,
        },
      );
    }

    /*
     * First authorize the
     * logged-in league member.
     *
     * Do this BEFORE using the
     * service-role client.
     */
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
          error:
            "This endpoint is only available for Greyhound leagues.",
        },
        {
          status: 400,
        },
      );
    }

    if (
      !access.isCommissioner
    ) {
      return NextResponse.json(
        {
          error:
            "Only the league commissioner can confirm a race card.",
        },
        {
          status: 403,
        },
      );
    }

    /*
     * Use the normal authenticated
     * client only to identify the
     * current signed-in user.
     */
    const userSupabase =
      await createSupabaseServerClient();

    const {
      data: authData,
      error: authError,
    } =
      await userSupabase.auth.getUser();

    if (
      authError ||
      !authData.user
    ) {
      return NextResponse.json(
        {
          error:
            "You must be signed in to confirm a race card.",
        },
        {
          status: 401,
        },
      );
    }

    /*
     * The commissioner has now been
     * authenticated and authorized.
     *
     * Use the service-role client for
     * Greyhound card DB operations so
     * RLS does not block the card read
     * or confirmation RPC.
     */
    const adminSupabase =
      createSupabaseAdminClient();

    const {
      data: card,
      error: cardError,
    } =
      await adminSupabase
        .from(
          "greyhound_cards",
        )
        .select(
          `
          id,
          card_status,
          import_status,
          automation_enabled,
          commissioner_confirmed_at,
          scheduled_first_post
        `,
        )
        .eq(
          "id",
          numericCardId,
        )
        .maybeSingle();

    if (cardError) {
      console.error(
        "Greyhound confirm card lookup failed:",
        cardError,
      );

      return NextResponse.json(
        {
          error:
            cardError.message,
        },
        {
          status: 500,
        },
      );
    }

    if (!card) {
      return NextResponse.json(
        {
          error:
            "Greyhound race card was not found.",
        },
        {
          status: 404,
        },
      );
    }

    if (
      card.card_status ===
        "locked" ||
      card.card_status ===
        "in_progress" ||
      card.card_status ===
        "final" ||
      card.card_status ===
        "cancelled"
    ) {
      return NextResponse.json(
        {
          error:
            `Card cannot be confirmed while status is ${card.card_status}.`,
        },
        {
          status: 409,
        },
      );
    }

    /*
     * Current valid imported states
     * for confirmation.
     */
    if (
      card.import_status !==
        "imported" &&
      card.import_status !==
        "updated"
    ) {
      return NextResponse.json(
        {
          error:
            `Card cannot be confirmed while import status is ${card.import_status}.`,
        },
        {
          status: 409,
        },
      );
    }

    /*
     * Idempotent confirmation:
     * clicking again is harmless.
     */
    if (
      card.commissioner_confirmed_at
    ) {
      return NextResponse.json({
        success: true,
        alreadyConfirmed: true,
        cardId:
          numericCardId,
        confirmedAt:
          card.commissioner_confirmed_at,
        automationEnabled:
          card.automation_enabled,
        awaitingRaceTimes:
          !card.scheduled_first_post,
      });
    }

    const {
      data: result,
      error: confirmError,
    } =
      await adminSupabase.rpc(
        "confirm_greyhound_card_for_racing",
        {
          p_card_id:
            numericCardId,

          p_confirmed_by:
            authData.user.id,
        },
      );

    if (confirmError) {
      console.error(
        "Greyhound confirmation RPC failed:",
        confirmError,
      );

      return NextResponse.json(
        {
          error:
            confirmError.message,
        },
        {
          status: 500,
        },
      );
    }

    /*
     * Read the card back after the RPC.
     * This makes sure the API response
     * reflects the persisted state.
     */
    const {
      data: confirmedCard,
      error:
        confirmedCardError,
    } =
      await adminSupabase
        .from(
          "greyhound_cards",
        )
        .select(
          `
          id,
          card_status,
          import_status,
          automation_enabled,
          commissioner_confirmed_at,
          commissioner_confirmed_by,
          scheduled_first_post,
          scratch_check_at,
          lock_at,
          total_races
        `,
        )
        .eq(
          "id",
          numericCardId,
        )
        .single();

    if (
      confirmedCardError
    ) {
      console.error(
        "Greyhound confirmed card verification failed:",
        confirmedCardError,
      );

      return NextResponse.json(
        {
          success: true,
          cardId:
            numericCardId,
          result,
          warning:
            "Card was confirmed, but the updated card could not be reloaded.",
        },
      );
    }

    return NextResponse.json({
      success: true,
      cardId:
        numericCardId,
      result,
      card:
        confirmedCard,
    });
  } catch (error) {
    console.error(
      "Greyhound card confirmation failed:",
      error,
    );

    return NextResponse.json(
      {
        error:
          error instanceof
          Error
            ? error.message
            : "Greyhound card confirmation failed.",
      },
      {
        status: 500,
      },
    );
  }
}