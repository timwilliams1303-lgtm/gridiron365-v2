import {
  NextResponse,
} from "next/server";


export const dynamic =
  "force-dynamic";


const SEASON =
  2026;


const ESPN_URL =
  `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${SEASON}/players?view=kona_player_info`;


/*
 * We only need a few known fantasy players
 * so we can decode ESPN's numeric stat IDs
 * before building the production sync route.
 */
const TARGET_PLAYERS = [
  "Patrick Mahomes",
  "Ashton Jeanty",
  "Amon-Ra St. Brown",
  "George Kittle",
  "Brandon Aubrey",
];


type EspnProjectionStatRow = {
  seasonId?: number;
  scoringPeriodId?: number;
  statSourceId?: number;
  statSplitTypeId?: number;

  stats?: Record<
    string,
    number
  >;
};


type EspnFantasyPlayer = {
  id?: number;

  firstName?: string;
  lastName?: string;
  fullName?: string;

  defaultPositionId?: number;
  proTeamId?: number;

  injured?: boolean;
  injuryStatus?: string;

  stats?: EspnProjectionStatRow[];
};


function getSeasonProjection(
  player:
    EspnFantasyPlayer
) {
  return (
    player.stats ??
    []
  ).find(
    (
      row
    ) =>
      row.seasonId ===
        SEASON &&
      row.scoringPeriodId ===
        0 &&
      row.statSourceId ===
        1 &&
      row.statSplitTypeId ===
        0
  ) ??
  null;
}


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
                  limit:
                    20000,

                  sortPercOwned: {
                    sortPriority:
                      1,

                    sortAsc:
                      false,
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
            502,
        }
      );
    }


    let parsed:
      unknown;


    try {
      parsed =
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
            502,
        }
      );
    }


    const players =
      Array.isArray(
        parsed
      )
        ? (
            parsed as
              EspnFantasyPlayer[]
          )
        : [];


    const byName =
      new Map<
        string,
        EspnFantasyPlayer
      >();


    for (
      const player
      of players
    ) {
      const name =
        player.fullName
          ?.trim()
          .toLowerCase();


      if (
        name
      ) {
        byName.set(
          name,
          player
        );
      }
    }


    const samples =
      TARGET_PLAYERS.map(
        (
          targetName
        ) => {
          const player =
            byName.get(
              targetName
                .toLowerCase()
            ) ??
            null;


          if (
            !player
          ) {
            return {
              requestedPlayer:
                targetName,

              found:
                false,
            };
          }


          const projection =
            getSeasonProjection(
              player
            );


          const rawStats =
            projection
              ?.stats ??
            {};


          const sortedStats =
            Object.fromEntries(
              Object
                .entries(
                  rawStats
                )
                .sort(
                  (
                    [a],
                    [b]
                  ) =>
                    Number(a) -
                    Number(b)
                )
            );


          return {
            requestedPlayer:
              targetName,

            found:
              true,

            espnPlayerId:
              player.id ??
              null,

            fullName:
              player.fullName ??
              null,

            defaultPositionId:
              player
                .defaultPositionId ??
              null,

            proTeamId:
              player.proTeamId ??
              null,

            injured:
              player.injured ??
              false,

            injuryStatus:
              player.injuryStatus ??
              null,

            projectionFound:
              Boolean(
                projection
              ),

            projectionMeta:
              projection
                ? {
                    seasonId:
                      projection
                        .seasonId ??
                      null,

                    scoringPeriodId:
                      projection
                        .scoringPeriodId ??
                      null,

                    statSourceId:
                      projection
                        .statSourceId ??
                      null,

                    statSplitTypeId:
                      projection
                        .statSplitTypeId ??
                      null,
                  }
                : null,

            projectedStats:
              sortedStats,
          };
        }
      );


    return NextResponse.json({
      success:
        true,

      source:
        "ESPN",

      season:
        SEASON,

      totalPlayersReceived:
        players.length,

      targetCount:
        TARGET_PLAYERS.length,

      samples,
    });
  } catch (
    error
  ) {
    console.error(
      "ESPN projection stat-map test failed:",
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
            : "Unknown ESPN projection test error.",
      },
      {
        status:
          500,
      }
    );
  }
}