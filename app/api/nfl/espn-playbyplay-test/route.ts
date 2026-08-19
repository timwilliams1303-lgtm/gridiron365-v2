import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type EspnRef = {
  $ref?: string;
};

type EspnPlayItem = {
  id?: string;
  sequenceNumber?: string | number;
  text?: string;
  shortText?: string;
  scoringPlay?: boolean;
  scoreValue?: number;
  statYardage?: number;

  type?: {
    id?: string;
    text?: string;
    abbreviation?: string;
  };

  period?: {
    number?: number;
  };

  clock?: {
    displayValue?: string;
  };

  team?: EspnRef;

  participants?: Array<{
    athlete?: EspnRef;
    type?: string;
  }>;

  start?: {
    down?: number;
    distance?: number;
    yardLine?: number;
    yardsToEndzone?: number;
  };

  end?: {
    down?: number;
    distance?: number;
    yardLine?: number;
    yardsToEndzone?: number;
  };
};

type EspnPlaysResponse = {
  count?: number;
  pageIndex?: number;
  pageSize?: number;
  pageCount?: number;
  items?: EspnPlayItem[];
};

function extractIdFromRef(
  ref: string | null | undefined
) {
  if (!ref) {
    return null;
  }

  const match =
    ref.match(/\/([^/?]+)(?:\?.*)?$/);

  return match?.[1] ?? null;
}

export async function GET(
  request: Request
) {
  try {
    const requestUrl =
      new URL(request.url);

    const eventId =
      requestUrl.searchParams.get(
        "eventId"
      ) ??
      "401873272";

    if (!/^\d+$/.test(eventId)) {
      return NextResponse.json(
        {
          success: false,
          error:
            "eventId must be a numeric ESPN event ID.",
        },
        {
          status: 400,
        }
      );
    }

    const espnUrl =
      `https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/events/${eventId}/competitions/${eventId}/plays?limit=500`;

    const response =
      await fetch(
        espnUrl,
        {
          method: "GET",

          headers: {
            Accept:
              "application/json",

            "User-Agent":
              "Mozilla/5.0 Gridiron365/1.0",
          },

          cache:
            "no-store",
        }
      );

    const text =
      await response.text();

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          source: "ESPN",
          eventId,
          status:
            response.status,
          statusText:
            response.statusText,
          responsePreview:
            text.slice(
              0,
              2000
            ),
        },
        {
          status: 502,
        }
      );
    }

    let data:
      EspnPlaysResponse;

    try {
      data =
        JSON.parse(
          text
        ) as EspnPlaysResponse;
    } catch {
      return NextResponse.json(
        {
          success: false,
          source: "ESPN",
          eventId,
          error:
            "ESPN returned invalid JSON.",
          responsePreview:
            text.slice(
              0,
              2000
            ),
        },
        {
          status: 502,
        }
      );
    }

    const plays =
      Array.isArray(
        data.items
      )
        ? data.items
        : [];

    const normalized =
      plays.map(
        (play) => ({
          id:
            play.id ??
            null,

          sequenceNumber:
            play.sequenceNumber ??
            null,

          type: {
            id:
              play.type?.id ??
              null,

            text:
              play.type?.text ??
              null,

            abbreviation:
              play.type
                ?.abbreviation ??
              null,
          },

          text:
            play.text ??
            null,

          shortText:
            play.shortText ??
            null,

          scoringPlay:
            play.scoringPlay ??
            false,

          scoreValue:
            play.scoreValue ??
            null,

          statYardage:
            play.statYardage ??
            null,

          period:
            play.period
              ?.number ??
            null,

          clock:
            play.clock
              ?.displayValue ??
            null,

          teamId:
            extractIdFromRef(
              play.team?.$ref
            ),

          participants:
            (
              play.participants ??
              []
            ).map(
              (
                participant
              ) => ({
                athleteId:
                  extractIdFromRef(
                    participant
                      .athlete
                      ?.$ref
                  ),

                type:
                  participant.type ??
                  null,
              })
            ),

          start: {
            down:
              play.start
                ?.down ??
              null,

            distance:
              play.start
                ?.distance ??
              null,

            yardLine:
              play.start
                ?.yardLine ??
              null,

            yardsToEndzone:
              play.start
                ?.yardsToEndzone ??
              null,
          },

          end: {
            down:
              play.end
                ?.down ??
              null,

            distance:
              play.end
                ?.distance ??
              null,

            yardLine:
              play.end
                ?.yardLine ??
              null,

            yardsToEndzone:
              play.end
                ?.yardsToEndzone ??
              null,
          },
        })
      );

    const fantasyRelevant =
      normalized.filter(
        (play) => {
          const combined =
            `${play.type.text ?? ""} ${play.text ?? ""}`
              .toLowerCase();

          return (
            play.scoringPlay ===
              true ||

            combined.includes(
              "field goal"
            ) ||

            combined.includes(
              "extra point"
            ) ||

            combined.includes(
              "two-point"
            ) ||

            combined.includes(
              "two point"
            ) ||

            combined.includes(
              "fumble"
            ) ||

            combined.includes(
              "interception"
            ) ||

            combined.includes(
              "touchdown"
            ) ||

            combined.includes(
              "safety"
            )
          );
        }
      );

    return NextResponse.json({
      success: true,

      source:
        "ESPN",

      mode:
        "core-play-by-play-test",

      eventId,

      sourceUrl:
        espnUrl,

      reportedCount:
        data.count ??
        null,

      totalPlayCount:
        normalized.length,

      fantasyRelevantPlayCount:
        fantasyRelevant.length,

      fantasyRelevantPlays:
        fantasyRelevant,
    });
  } catch (error) {
    console.error(
      "ESPN Core play-by-play test failed:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        error:
          error instanceof Error
            ? error.message
            : "Unknown ESPN play-by-play error.",
      },
      {
        status: 500,
      }
    );
  }
}