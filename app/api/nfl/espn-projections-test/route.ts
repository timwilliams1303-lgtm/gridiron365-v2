import {
  NextResponse,
} from "next/server";


export const dynamic =
  "force-dynamic";


const ESPN_URL =
  "https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/2026/players?view=kona_player_info";

export async function GET() {
  try {
    const response =
      await fetch(
        ESPN_URL,
        {
          method:
            "GET",

          headers: {
            Accept:
              "application/json",

            "User-Agent":
              "Mozilla/5.0 Gridiron365/1.0",

            "X-Fantasy-Filter":
              JSON.stringify({
                players: {
                  limit: 10,

                  sortPercOwned: {
                    sortPriority: 1,
                    sortAsc: false,
                  },
                },
              }),
          },

          cache:
            "no-store",
        }
      );


    const text =
      await response.text();


    if (
      !response.ok
    ) {
      return NextResponse.json(
        {
          success:
            false,

          status:
            response.status,

          statusText:
            response.statusText,

          responsePreview:
            text.slice(
              0,
              3000
            ),
        },
        {
          status:
            500,
        }
      );
    }


    let data:
      unknown;


    try {
      data =
        JSON.parse(
          text
        );
    } catch {
      return NextResponse.json(
        {
          success:
            false,

          error:
            "ESPN did not return valid JSON.",

          responsePreview:
            text.slice(
              0,
              3000
            ),
        },
        {
          status:
            500,
        }
      );
    }


    const players =
      Array.isArray(
        data
      )
        ? data
        : [];


    return NextResponse.json({
      success:
        true,

      source:
        "ESPN",

      season:
        2026,

      playerCount:
        players.length,

      /*
       * Intentionally return the
       * raw first few records.
       *
       * We want to inspect ESPN's
       * actual 2026 structure before
       * deciding which stats/projection
       * fields Gridiron365 should use.
       */
      sample:
        players.slice(
          0,
          5
        ),
    });
  } catch (
    error
  ) {
    console.error(
      "ESPN projections test failed:",
      error
    );


    return NextResponse.json(
      {
        success:
          false,

        error:
          error instanceof
          Error
            ? error.message
            : "Unknown ESPN error.",
      },
      {
        status:
          500,
      }
    );
  }
}