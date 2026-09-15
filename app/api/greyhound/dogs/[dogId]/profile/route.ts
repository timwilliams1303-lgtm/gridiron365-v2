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

type ProgramHistoryRow = {
  id: number;
  race_date: string | null;
  performance_code: string | null;
  track_code: string | null;
  distance_yards: number | null;
  condition: string | null;
  weight: number | string | null;
  box_number: number | null;
  running_positions: unknown;
  finish_position: number | null;
  margin_text: string | null;
  raw_text: string | null;
  finish_time: number | string | null;
  speed_rating: number | null;
  odds: string | null;
  grade: string | null;
  comment: string | null;
  source: string | null;
};

type TrackRow = {
  id: number;
  code: string;
  name: string | null;
};

type ParsedProgramCalls = {
  positions: number[];
  finishPosition: number | null;
  marginText: string | null;
};

function parseProgramCallsFromRawText(
  rawText: string | null,
): ParsedProgramCalls {
  const text =
    String(
      rawText ?? "",
    )
      .replace(
        /\s+/g,
        " ",
      )
      .trim();

  if (!text) {
    return {
      positions: [],
      finishPosition: null,
      marginText: null,
    };
  }

  /*
   * Both Wheeling and Tri-State program-history rows follow the same
   * useful shape around the running calls:
   *
   * DATE/RACE TRACK DIST COND WIN_TIME WEIGHT BOX
   *   <running positions...> [optional split] FINAL_TIME ODDS GRADE ...
   *
   * Example Tri-State:
   * 08/25 E10 TS 550 F 30.76 76 3 5 5 7 7 9 31.40 9.30 C ...
   *
   * Box = 3
   * Calls = 5, 5, 7, 7
   * Margin = 9
   *
   * Example Wheeling:
   * 08/21A13 WD 548 F 30.19 77 6 1 11 1½ 2½ 30.23 94 3.20 C ...
   *
   * Box = 6
   * Calls = 1, 1, 1, 2
   * Finish margin = ½
   * 94 is the Wheeling speed rating, not a running position.
   */
  const head =
    text.match(
      /^(?:\d{2}\/\d{2}\s*)?[ASE]\d{1,2}\s+(?:TS|WD)\s+\d{3,4}\s+[A-Z]\s+\d{2}\.\d{2}\s+\d{2}\s+[1-8]\s+(.+)$/i,
    );

  if (!head) {
    return {
      positions: [],
      finishPosition: null,
      marginText: null,
    };
  }

  const tail =
    head[1];

  /*
   * Locate the final race time from the source-specific tail:
   *
   * Tri-State:
   *   FINAL_TIME ODDS GRADE
   *   or SPLIT FINAL_TIME ODDS GRADE
   *
   * Wheeling:
   *   FINAL_TIME SPEED_RATING ODDS GRADE
   *
   * The optional integer between final time and odds is Wheeling's CSR /
   * speed-rating field and must not be mistaken for another running call.
   */
  const finalTimeMatch =
    tail.match(
      /(?:^|\s)(\d{2}\.\d{2}|OOP)\s+(?:\d{1,3}\s+)?(?:(?:(?:\d+(?:\.\d+)?)|(?:\.\d+))\*?|----)\s+[A-Z-]{1,4}\s+/i,
    );

  if (
    !finalTimeMatch ||
    finalTimeMatch.index ===
      undefined
  ) {
    return {
      positions: [],
      finishPosition: null,
      marginText: null,
    };
  }

  let callText =
    tail
      .slice(
        0,
        finalTimeMatch.index,
      )
      .trim();

  /*
   * Tri-State commonly includes a split time (for example 6.49) between
   * the final running call and final race time. It is not a position.
   */
  callText =
    callText.replace(
      /\s+\d{1,2}\.\d{2}$/,
      "",
    );

  const rawTokens =
    callText
      .split(/\s+/)
      .filter(Boolean);

  type CallToken = {
    raw: string;
    position: number;
    suffix: string | null;
  };

  const callTokens: CallToken[] =
    [];

  for (const token of rawTokens) {
    const match =
      token.match(
        /^([1-8])((?:\d+(?:½|¼|¾)?|½|¼|¾|nk|ns|hd|n|h)?)$/i,
      );

    if (!match) {
      continue;
    }

    callTokens.push({
      raw: token,
      position: Number(
        match[1],
      ),
      suffix:
        match[2] || null,
    });
  }

  /*
   * The official TS/WD performance lines represented here use four
   * running calls after the starting box.  The final call can be compact,
   * such as "79" (finish 7, margin 9) or "31½" (finish 3, margin 1½).
   *
   * Some extracted rows separate the margin into its own token:
   *   5 5 7 7 9
   * means calls 5,5,7,7 with a 9-length margin.
   *
   * Keep only the four actual calls.  Anything after those calls belongs
   * to the finish margin / extraction noise, not another checkpoint.
   */
  const actualCalls =
    callTokens.slice(
      0,
      Math.min(
        4,
        callTokens.length,
      ),
    );

  const positions =
    actualCalls.map(
      (token) =>
        token.position,
    );

  const finishToken =
    actualCalls[
      actualCalls.length - 1
    ] ?? null;

  let marginText =
    finishToken?.suffix ??
    null;

  if (
    actualCalls.length >= 4 &&
    !marginText &&
    callTokens.length > 4
  ) {
    const trailing =
      callTokens[
        callTokens.length - 1
      ];

    /*
     * When the margin was extracted as a separate token, preserve the
     * complete token.  Examples: "9", "6", "3", "1½".
     */
    if (trailing) {
      marginText =
        trailing.raw;
    }
  }

  return {
    positions,
    finishPosition:
      finishToken?.position ??
      null,
    marginText,
  };
}


function g365TrackCode(
  value: string | null,
): string | null {
  const normalized =
    String(value ?? "")
      .trim()
      .toUpperCase();

  if (!normalized) {
    return null;
  }

  if (
    normalized === "WD" ||
    normalized === "WEM" ||
    normalized === "GWD"
  ) {
    return "GWD";
  }

  if (
    normalized === "TS" ||
    normalized === "TSE" ||
    normalized === "GTS"
  ) {
    return "GTS";
  }

  return normalized;
}

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

    const [
      profileResult,
      historyResult,
      tracksResult,
      programBlocksResult,
    ] = await Promise.all([
      supabase.rpc(
        "get_greyhound_dog_profile",
        {
          p_dog_id:
            dogId,
        },
      ),

      supabase
        .from(
          "greyhound_dog_program_history",
        )
        .select(
          `
            id,
            race_date,
            performance_code,
            track_code,
            distance_yards,
            condition,
            weight,
            box_number,
            running_positions,
            finish_position,
            margin_text,
            raw_text,
            finish_time,
            speed_rating,
            odds,
            grade,
            comment,
            source
          `,
        )
        .eq(
          "dog_id",
          dogId,
        )
        .order(
          "race_date",
          {
            ascending: false,
            nullsFirst: false,
          },
        )
        .order(
          "id",
          {
            ascending: false,
          },
        )
        .limit(40),

      supabase
        .from(
          "greyhound_tracks",
        )
        .select(
          "id,code,name",
        )
        .in(
          "code",
          [
            "GWD",
            "GTS",
          ],
        ),

      supabase
        .from("greyhound_dog_program_blocks")
        .select(
          "id,program_track_code,program_date,kennel,trainer,program_block_text,program_block_image_data_url,source",
        )
        .eq("dog_id", dogId)
        .order("program_date", {
          ascending: false,
          nullsFirst: false,
        })
        .order("id", { ascending: false })
        .limit(12),
    ]);

    if (
      profileResult.error
    ) {
      console.error(
        "[greyhound-dog-profile]",
        profileResult.error,
      );

      return NextResponse.json(
        {
          success: false,
          error:
            profileResult.error.message,
        },
        {
          status: 500,
        },
      );
    }

    if (
      historyResult.error
    ) {
      console.error(
        "[greyhound-dog-profile-program-history]",
        historyResult.error,
      );

      return NextResponse.json(
        {
          success: false,
          error:
            historyResult.error.message,
        },
        {
          status: 500,
        },
      );
    }

    if (
      tracksResult.error
    ) {
      console.error(
        "[greyhound-dog-profile-tracks]",
        tracksResult.error,
      );

      return NextResponse.json(
        {
          success: false,
          error:
            tracksResult.error.message,
        },
        {
          status: 500,
        },
      );
    }

    if (programBlocksResult.error) {
      console.error(
        "[greyhound-dog-profile-program-blocks]",
        programBlocksResult.error,
      );

      return NextResponse.json(
        {
          success: false,
          error: programBlocksResult.error.message,
        },
        { status: 500 },
      );
    }

    if (
      !profileResult.data
    ) {
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

    const tracks =
      (tracksResult.data ?? []) as TrackRow[];

    const tracksByCode =
      new Map(
        tracks.map(
          (track) => [
            String(track.code)
              .trim()
              .toUpperCase(),
            track,
          ],
        ),
      );

    const programHistory =
      (
        historyResult.data ??
        []
      ).map(
        (row) => {
          const item =
            row as ProgramHistoryRow;

          const normalizedTrackCode =
            g365TrackCode(
              item.track_code,
            );

          const track =
            normalizedTrackCode
              ? tracksByCode.get(
                  normalizedTrackCode,
                ) ?? null
              : null;

          return {
            id:
              Number(item.id),

            raceDate:
              item.race_date,

            performanceCode:
              item.performance_code,

            trackCode:
              normalizedTrackCode ??
              item.track_code,

            trackName:
              track?.name ??
              null,

            distanceYards:
              item.distance_yards ==
              null
                ? null
                : Number(
                    item.distance_yards,
                  ),

            condition:
              item.condition,

            weight:
              item.weight,

            boxNumber:
              item.box_number ==
              null
                ? null
                : Number(
                    item.box_number,
                  ),

            runningPositions:
              (() => {
                const stored =
                  Array.isArray(
                    item.running_positions,
                  )
                    ? item.running_positions
                        .map((position) =>
                          Number(
                            position,
                          ),
                        )
                        .filter(
                          (position) =>
                            Number.isInteger(
                              position,
                            ) &&
                            position >= 1 &&
                            position <= 8,
                        )
                    : [];

                const parsed =
                  parseProgramCallsFromRawText(
                    item.raw_text,
                  );

                /*
                 * Older imports accidentally stored only the starting box
                 * (for example [3]) in running_positions.  A real program
                 * history row normally has several calls.  Prefer the
                 * sequence recovered from raw_text whenever it has 2+
                 * positions; otherwise keep valid stored data.
                 */
                if (
                  parsed.positions.length >=
                  2
                ) {
                  return parsed.positions;
                }

                return stored;
              })(),

            finishPosition:
              (() => {
                const parsed =
                  parseProgramCallsFromRawText(
                    item.raw_text,
                  );

                if (
                  parsed.positions.length >=
                    2 &&
                  parsed.finishPosition !=
                    null
                ) {
                  return parsed.finishPosition;
                }

                return item.finish_position ==
                  null
                  ? null
                  : Number(
                      item.finish_position,
                    );
              })(),

            marginText:
              (() => {
                const parsed =
                  parseProgramCallsFromRawText(
                    item.raw_text,
                  );

                return parsed.positions.length >=
                  2
                  ? parsed.marginText
                  : item.margin_text;
              })(),

            finishTime:
              item.finish_time,

            speedRating:
              item.speed_rating ==
              null
                ? null
                : Number(
                    item.speed_rating,
                  ),

            odds:
              item.odds,

            grade:
              item.grade,

            comment:
              item.comment,

            source:
              item.source ??
              "commissioner_program",
          };
        },
      );

    const programBlocks =
      (programBlocksResult.data ?? []).map((row) => ({
        id: Number(row.id),
        programTrackCode: row.program_track_code,
        programDate: row.program_date,
        kennel: row.kennel,
        trainer: row.trainer,
        programBlockText: row.program_block_text,
        programBlockImageDataUrl:
          row.program_block_image_data_url,
        source: row.source ?? "commissioner_program",
      }));

    const profile = {
      ...(profileResult.data as Record<
        string,
        unknown
      >),
      programHistory,
      programBlocks,
    };

    return NextResponse.json(
      {
        success: true,
        profile,
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
