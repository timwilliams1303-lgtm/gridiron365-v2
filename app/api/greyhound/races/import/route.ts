import {
  NextResponse,
} from "next/server";

import {
  requireLeagueMember,
} from "@/lib/leagues/requireLeagueMember";

import {
  createSupabaseServerClient,
} from "@/lib/supabase/server";


type RunnerPayload = {
  trapNumber?: number | string | null;
  trapColor?: string | null;
  name?: string | null;
  kennel?: string | null;
  trainer?: string | null;
  weight?: number | string | null;
  form?: string | null;
  odds?: string | null;
};


type RacePayload = {
  track?: string | null;
  raceNumber?: number | string | null;
  raceDate?: string | null;
  raceTime?: string | null;
  grade?: string | null;
  distance?: string | number | null;
  prizeMoney?: string | number | null;
  weather?: string | null;
  trackCondition?: string | null;
  session?: string | null;
  runners?: RunnerPayload[] | null;
};


type ImportRequest = {
  leagueId?: string;
  race?: RacePayload;
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


function cleanText(
  value: unknown
): string | null {
  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  const text =
    String(value).trim();

  return text.length > 0
    ? text
    : null;
}


function parsePositiveInteger(
  value: unknown
): number | null {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const parsed =
    Number.parseInt(
      String(value),
      10
    );

  if (
    !Number.isFinite(parsed) ||
    parsed <= 0
  ) {
    return null;
  }

  return parsed;
}


function normalizeTrackCode(
  track: unknown
):
  | "GWD"
  | "GTS"
  | null {
  const normalized =
    String(
      track ?? ""
    )
      .trim()
      .toLowerCase()
      .replace(
        /[^a-z0-9]+/g,
        " "
      )
      .trim();


  if (
    normalized === "gwd" ||
    normalized === "wheeling" ||
    normalized ===
      "wheeling island" ||
    normalized ===
      "wheeling island greyhound" ||
    normalized ===
      "wheeling island greyhound racing"
  ) {
    return "GWD";
  }


  if (
    normalized === "gts" ||
    normalized ===
      "tri state" ||
    normalized ===
      "tristate" ||
    normalized ===
      "tri state greyhound" ||
    normalized ===
      "tri state greyhound racing"
  ) {
    return "GTS";
  }


  return null;
}


function normalizeSession(
  race: RacePayload
): string {
  const explicit =
    cleanText(
      race.session
    )?.toLowerCase();

  if (
    explicit === "morning" ||
    explicit === "afternoon" ||
    explicit === "evening" ||
    explicit === "night"
  ) {
    return explicit;
  }


  /*
   * The current Wheeling Program importer is parsing
   * Friday Afternoon cards.
   *
   * We intentionally do NOT invent an individual race time.
   * If a future parser sends an explicit session, it will
   * override this default.
   */
  return "afternoon";
}


export async function POST(
  request: Request
) {
  try {
    /*
     * ==========================================================
     * BODY
     * ==========================================================
     */
    const body =
      (await request.json()) as
        ImportRequest;


    const leagueId =
      cleanText(
        body.leagueId
      );


    const race =
      body.race;


    if (!leagueId) {
      return errorResponse(
        "leagueId is required."
      );
    }


    if (
      !race ||
      typeof race !== "object" ||
      Array.isArray(race)
    ) {
      return errorResponse(
        "A Greyhound race payload is required."
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


    if (String(access.league.leagueType) !== "greyhound") {
  return NextResponse.json(
    { error: "This endpoint is only available for Greyhound leagues." },
    { status: 400 },
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


    /*
     * ==========================================================
     * TRACK
     * ==========================================================
     */
    const trackCode =
      normalizeTrackCode(
        race.track
      );


    if (!trackCode) {
      return errorResponse(
        `Unsupported Greyhound track: ${
          cleanText(
            race.track
          ) ?? "Unknown"
        }.`
      );
    }


    /*
     * ==========================================================
     * RACE VALIDATION
     * ==========================================================
     */
    const raceNumber =
      parsePositiveInteger(
        race.raceNumber
      );


    if (!raceNumber) {
      return errorResponse(
        "A valid race number is required."
      );
    }


    const raceDate =
      cleanText(
        race.raceDate
      );


    if (
      !raceDate ||
      !/^\d{4}-\d{2}-\d{2}$/.test(
        raceDate
      )
    ) {
      return errorResponse(
        "raceDate must be in YYYY-MM-DD format."
      );
    }


    const distance =
      cleanText(
        race.distance
      );


    if (!distance) {
      return errorResponse(
        "Race distance is required."
      );
    }


    if (
      !Array.isArray(
        race.runners
      ) ||
      race.runners.length === 0
    ) {
      return errorResponse(
        "At least one Greyhound runner is required."
      );
    }


    /*
     * ==========================================================
     * NORMALIZE RUNNERS
     * ==========================================================
     */
    const runners =
      race.runners
        .map(
          (
            runner
          ): RunnerPayload | null => {
            const trapNumber =
              parsePositiveInteger(
                runner.trapNumber
              );


            const name =
              cleanText(
                runner.name
              );


            if (
              !trapNumber ||
              trapNumber < 1 ||
              trapNumber > 8 ||
              !name
            ) {
              return null;
            }


            if (
              name.toUpperCase() ===
              "NO GREYHOUND"
            ) {
              return null;
            }


            return {
              trapNumber,

              trapColor:
                cleanText(
                  runner.trapColor
                ),

              name,

              kennel:
                cleanText(
                  runner.kennel
                ),

              trainer:
                cleanText(
                  runner.trainer
                ),

              weight:
                runner.weight ??
                null,

              form:
                cleanText(
                  runner.form
                ),

              odds:
                cleanText(
                  runner.odds
                ),
            };
          }
        )
        .filter(
          (
            runner
          ): runner is RunnerPayload =>
            runner !== null
        );


    if (
      runners.length === 0
    ) {
      return errorResponse(
        "No valid Greyhound runners were found in this race."
      );
    }


    /*
     * Do not allow the parser to accidentally create
     * duplicate boxes.
     */
    const boxes =
      runners.map(
        (runner) =>
          Number(
            runner.trapNumber
          )
      );


    if (
      new Set(
        boxes
      ).size !==
      boxes.length
    ) {
      return errorResponse(
        "The parsed race contains duplicate trap numbers."
      );
    }


    /*
     * ==========================================================
     * NORMALIZED RPC PAYLOAD
     * ==========================================================
     *
     * prizeMoney, weather, trackCondition, trapColor and form
     * are intentionally preserved in the frontend payload but
     * are not written yet because the current Greyhound schema
     * does not have matching race/entry columns for them.
     * ==========================================================
     */
    const normalizedRace = {
      track:
        cleanText(
          race.track
        ),

      raceNumber,

      raceDate,

      raceTime:
        cleanText(
          race.raceTime
        ),

      grade:
        cleanText(
          race.grade
        ),

      distance,

      prizeMoney:
        race.prizeMoney ??
        null,

      weather:
        cleanText(
          race.weather
        ),

      trackCondition:
        cleanText(
          race.trackCondition
        ),

      runners,
    };


    const session =
      normalizeSession(
        race
      );


    /*
     * ==========================================================
     * DATABASE IMPORT
     * ==========================================================
     */
    const supabase =
      await createSupabaseServerClient();


    const {
      data: importResult,
      error: importError,
    } =
      await supabase.rpc(
        "g365_greyhound_import_race",
        {
          p_track_code:
            trackCode,

          p_race:
            normalizedRace,

          p_session:
            session,
        }
      );


    if (importError) {
      console.error(
        "[G365 GREYHOUND RACE IMPORT RPC]",
        importError
      );


      return errorResponse(
        `Greyhound race import failed: ${importError.message}`,
        500
      );
    }


    const result =
      importResult as
        | {
            success?: boolean;
            cardId?: number;
            raceId?: number;
            raceNumber?: number;
            runnersSeen?: number;
            runnersInserted?: number;
            runnersUpdated?: number;
            staleEntriesRemoved?: number;
          }
        | null;


    if (
      !result ||
      result.success !== true
    ) {
      return errorResponse(
        "The Greyhound race import did not return a successful result.",
        500
      );
    }


    /*
     * ==========================================================
     * SUCCESS
     * ==========================================================
     */
    return NextResponse.json({
      success: true,

      imported: true,

      leagueId,

      trackCode,

      session,

      cardId:
        result.cardId ??
        null,

      raceId:
        result.raceId ??
        null,

      raceNumber:
        result.raceNumber ??
        raceNumber,

      runnersSeen:
        result.runnersSeen ??
        runners.length,

      runnersInserted:
        result.runnersInserted ??
        null,

      runnersUpdated:
        result.runnersUpdated ??
        null,

      staleEntriesRemoved:
        result.staleEntriesRemoved ??
        null,

      importResult:
        result,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown Greyhound race import error.";


    console.error(
      "[G365 GREYHOUND RACE IMPORT]",
      error
    );


    return errorResponse(
      message,
      500
    );
  }
}