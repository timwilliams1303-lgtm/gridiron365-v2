import {
  NextResponse,
} from "next/server";

import {
  requireLeagueMember,
} from "@/lib/leagues/requireLeagueMember";

import {
  createSupabaseServerClient,
} from "@/lib/supabase/server";


type ImportRequest = {
  leagueId?: string;
  trackCode?: "GWD" | "GTS";
  payload?: Record<
    string,
    unknown
  >;
  activate?: boolean;
};


function errorResponse(
  message: string,
  status = 400
) {
  return NextResponse.json(
    {
      success: false,
      error: message,
    },
    {
      status,
    }
  );
}


export async function POST(
  request: Request
) {
  try {
    const body =
      (await request.json()) as
        ImportRequest;

    const leagueId =
      body.leagueId?.trim();

    const trackCode =
      body.trackCode;

    const payload =
      body.payload;

    const activate =
      body.activate === true;


    if (!leagueId) {
      return errorResponse(
        "leagueId is required."
      );
    }


    if (
      trackCode !== "GWD" &&
      trackCode !== "GTS"
    ) {
      return errorResponse(
        "A valid Greyhound track is required."
      );
    }


    if (
      !payload ||
      typeof payload !== "object" ||
      Array.isArray(payload)
    ) {
      return errorResponse(
        "A race-card payload is required."
      );
    }


    /*
     * ==========================================================
     * AUTHORIZATION
     * ==========================================================
     */
    const access =
      await requireLeagueMember(
        leagueId
      );


    if (
      access.league.leagueType !==
      "greyhound"
    ) {
      return errorResponse(
        "This is not a Greyhound league.",
        403
      );
    }


    if (
      !access.isCommissioner
    ) {
      return errorResponse(
        "Commissioner access is required.",
        403
      );
    }


    const supabase =
      await createSupabaseServerClient();


    /*
     * ==========================================================
     * FIND TRACK
     * ==========================================================
     */
    const {
      data: track,
      error: trackError,
    } =
      await supabase
        .from(
          "greyhound_tracks"
        )
        .select(
          "id, track_code"
        )
        .eq(
          "track_code",
          trackCode
        )
        .maybeSingle();


    if (trackError) {
      return errorResponse(
        `Could not load Greyhound track: ${trackError.message}`,
        500
      );
    }


    if (!track) {
      return errorResponse(
        `Greyhound track ${trackCode} is not configured.`,
        404
      );
    }


    /*
     * ==========================================================
     * IMPORT NORMALIZED CARD
     * ==========================================================
     */
    const {
      data: importResult,
      error: importError,
    } =
      await supabase.rpc(
        "import_greyhound_entry_card",
        {
          p_track_id:
            track.id,
          p_payload:
            payload,
        }
      );


    if (importError) {
      return errorResponse(
        `Race-card import failed: ${importError.message}`,
        500
      );
    }


    const cardId =
      Number(
        (
          importResult as {
            cardId?: unknown;
          } | null
        )?.cardId
      );


    if (
      !Number.isFinite(cardId) ||
      cardId <= 0
    ) {
      return errorResponse(
        "The race card imported, but G365 did not receive a valid card ID.",
        500
      );
    }


    /*
     * ==========================================================
     * DO NOT ACTIVATE UNLESS COMMISSIONER EXPLICITLY CHOSE IT
     * ==========================================================
     */
    let activationResult:
      unknown =
        null;


    if (activate) {
      const {
        data,
        error,
      } =
        await supabase.rpc(
          "confirm_greyhound_card_for_racing",
          {
            p_card_id:
              cardId,

            p_confirmed_by:
              access.userId,
          }
        );


      if (error) {
        /*
         * Card remains imported but automation stays off.
         *
         * This is safer than pretending the activation
         * succeeded.
         */
        return NextResponse.json(
          {
            success: false,

            imported: true,

            cardId,

            automationEnabled:
              false,

            importResult,

            error:
              `Card imported, but activation failed: ${error.message}`,
          },
          {
            status: 500,
          }
        );
      }


      activationResult =
        data;
    }


    return NextResponse.json({
      success: true,

      imported: true,

      cardId,

      trackCode,

      automationEnabled:
        activate,

      importResult,

      activationResult,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown Greyhound import error.";

    console.error(
      "[G365 GREYHOUND IMPORT]",
      error
    );

    return errorResponse(
      message,
      500
    );
  }
}