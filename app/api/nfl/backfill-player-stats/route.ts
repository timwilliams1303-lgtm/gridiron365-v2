import {
  NextResponse,
} from "next/server";

import {
  createSupabaseAdminClient,
} from "@/lib/supabase/admin";


export const dynamic =
  "force-dynamic";


type BackfillGame = {
  id: number;
  espn_event_id: string;
  season: number;
  season_type: number;
  week: number;
};


function clampInteger(
  value: string | null,
  fallback: number,
  min: number,
  max: number
) {
  const parsed =
    Number(
      value
    );


  if (
    !Number.isInteger(
      parsed
    )
  ) {
    return fallback;
  }


  return Math.max(
    min,
    Math.min(
      max,
      parsed
    )
  );
}


export async function POST(
  request: Request
) {
  try {
    const requestUrl =
      new URL(
        request.url
      );


    const season =
      clampInteger(
        requestUrl
          .searchParams
          .get(
            "season"
          ),
        2025,
        2000,
        2200
      );


    const seasonType =
      clampInteger(
        requestUrl
          .searchParams
          .get(
            "seasonType"
          ),
        2,
        1,
        3
      );


    /*
     * Keep batches intentionally small.
     * The existing boxscore route performs multiple
     * ESPN requests and database writes per game.
     */
    const batchSize =
      clampInteger(
        requestUrl
          .searchParams
          .get(
            "batchSize"
          ),
        10,
        1,
        20
      );


    const offset =
      clampInteger(
        requestUrl
          .searchParams
          .get(
            "offset"
          ),
        0,
        0,
        10000
      );


    /*
     * This historical utility is intended for local
     * maintenance/backfill work.
     *
     * In production require the same Gridiron365
     * administrative secret used by the schedule route.
     */
    if (
      process.env.NODE_ENV ===
        "production"
    ) {
      const expectedSecret =
        process.env
          .GRIDIRON_SYNC_SECRET;


      const providedSecret =
        request.headers.get(
          "x-gridiron-sync-secret"
        );


      if (
        !expectedSecret ||
        providedSecret !==
          expectedSecret
      ) {
        return NextResponse.json(
          {
            success:
              false,

            error:
              "Unauthorized backfill request.",
          },
          {
            status:
              401,
          }
        );
      }
    }


    const admin =
      createSupabaseAdminClient();


    const {
      count:
        totalGames,

      error:
        countError,
    } =
      await admin
        .from(
          "nfl_games"
        )
        .select(
          "id",
          {
            count:
              "exact",

            head:
              true,
          }
        )
        .eq(
          "season",
          season
        )
        .eq(
          "season_type",
          seasonType
        )
        .eq(
          "status_completed",
          true
        )
        .not(
          "espn_event_id",
          "is",
          null
        );


    if (
      countError
    ) {
      throw new Error(
        `Unable to count NFL games: ${countError.message}`
      );
    }


    const {
      data:
        gameData,

      error:
        gameError,
    } =
      await admin
        .from(
          "nfl_games"
        )
        .select(
          `
            id,
            espn_event_id,
            season,
            season_type,
            week
          `
        )
        .eq(
          "season",
          season
        )
        .eq(
          "season_type",
          seasonType
        )
        .eq(
          "status_completed",
          true
        )
        .not(
          "espn_event_id",
          "is",
          null
        )
        .order(
          "week",
          {
            ascending:
              true,
          }
        )
        .order(
          "kickoff_at",
          {
            ascending:
              true,
          }
        )
        .order(
          "id",
          {
            ascending:
              true,
          }
        )
        .range(
          offset,
          offset +
            batchSize -
            1
        );


    if (
      gameError
    ) {
      throw new Error(
        `Unable to load NFL games: ${gameError.message}`
      );
    }


    const games =
      (
        gameData ??
        []
      ) as BackfillGame[];


    const results:
      Array<{
        nflGameId: number;
        eventId: string;
        week: number;
        success: boolean;
        matchedPlayers?: number;
        unmatchedPlayers?: number;
        statsUpserted?: number;
        dstRowsUpserted?: number;
        error?: string;
      }> =
      [];


    let successfulGames =
      0;


    let failedGames =
      0;


    let totalMatchedPlayers =
      0;


    let totalUnmatchedPlayers =
      0;


    let totalStatsUpserted =
      0;


    let totalDstRowsUpserted =
      0;


    const origin =
      requestUrl.origin;


    for (
      const game
      of games
    ) {
      try {
        const syncResponse =
          await fetch(
            `${origin}/api/nfl/sync-live-boxscore?eventId=${encodeURIComponent(
              game.espn_event_id
            )}`,
            {
              method:
                "POST",

              cache:
                "no-store",
            }
          );


        const syncResult =
          await syncResponse
            .json();


        if (
          !syncResponse.ok ||
          syncResult
            ?.success !==
            true
        ) {
          failedGames +=
            1;


          results.push({
            nflGameId:
              game.id,

            eventId:
              game.espn_event_id,

            week:
              game.week,

            success:
              false,

            error:
              syncResult
                ?.error ??
              `HTTP ${syncResponse.status}`,
          });


          continue;
        }


        const matchedPlayers =
          Number(
            syncResult
              ?.boxscore
              ?.matchedPlayers ??
            0
          );


        const unmatchedPlayers =
          Number(
            syncResult
              ?.boxscore
              ?.unmatchedPlayers ??
            0
          );


        const statsUpserted =
          Number(
            syncResult
              ?.boxscore
              ?.statsUpserted ??
            0
          );


        const dstRowsUpserted =
          Number(
            syncResult
              ?.boxscore
              ?.dstRowsUpserted ??
            0
          );


        successfulGames +=
          1;


        totalMatchedPlayers +=
          matchedPlayers;


        totalUnmatchedPlayers +=
          unmatchedPlayers;


        totalStatsUpserted +=
          statsUpserted;


        totalDstRowsUpserted +=
          dstRowsUpserted;


        results.push({
          nflGameId:
            game.id,

          eventId:
            game.espn_event_id,

          week:
            game.week,

          success:
            true,

          matchedPlayers,

          unmatchedPlayers,

          statsUpserted,

          dstRowsUpserted,
        });
      } catch (
        error
      ) {
        failedGames +=
          1;


        results.push({
          nflGameId:
            game.id,

          eventId:
            game.espn_event_id,

          week:
            game.week,

          success:
            false,

          error:
            error instanceof Error
              ? error.message
              : "Unknown backfill error.",
        });
      }
    }


    const processedCount =
      games.length;


    const nextOffset =
      offset +
      processedCount;


    const total =
      totalGames ??
      0;


    const hasMore =
      nextOffset <
      total;


    return NextResponse.json({
      success:
        true,

      season,

      seasonType,

      totalGames:
        total,

      offset,

      batchSize,

      processedCount,

      successfulGames,

      failedGames,

      totalMatchedPlayers,

      totalUnmatchedPlayers,

      totalStatsUpserted,

      totalDstRowsUpserted,

      nextOffset:
        hasMore
          ? nextOffset
          : null,

      hasMore,

      results,
    });
  } catch (
    error
  ) {
    console.error(
      "Historical player stats backfill failed:",
      error
    );


    return NextResponse.json(
      {
        success:
          false,

        error:
          error instanceof Error
            ? error.message
            : "Historical player stats backfill failed.",
      },
      {
        status:
          500,
      }
    );
  }
}