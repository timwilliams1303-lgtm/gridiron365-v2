import {
  NextResponse,
} from "next/server";

import {
  createClient,
} from "@supabase/supabase-js";


export const dynamic =
  "force-dynamic";

export const maxDuration =
  300;


const SEASON =
  2026;


const ESPN_URL =
  `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${SEASON}/players?view=kona_player_info`;


/* =========================================================
   TYPES
========================================================= */

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


type NflPlayer = {
  id: number;
  espn_player_id: string | null;
  full_name: string;
  primary_position: string;
};


type ProjectionUpsertRow = {
  nfl_player_id: number;
  season: number;
  source: string;

  passing_attempts: number | null;
  passing_completions: number | null;
  passing_yards: number | null;
  passing_touchdowns: number | null;
  passing_interceptions: number | null;

  rushing_attempts: number | null;
  rushing_yards: number | null;
  rushing_touchdowns: number | null;

  receiving_targets: number | null;
  receptions: number | null;
  receiving_yards: number | null;
  receiving_touchdowns: number | null;

  fumbles: number | null;
  fumbles_lost: number | null;

  field_goals_made: number | null;
  field_goals_attempted: number | null;
  extra_points_made: number | null;
  extra_points_attempted: number | null;

  raw_stats: Record<
    string,
    number
  >;

  source_updated_at: string;
  updated_at: string;
};


/* =========================================================
   SUPABASE
========================================================= */

function getAdminClient() {
  const supabaseUrl =
    process.env
      .NEXT_PUBLIC_SUPABASE_URL;

  const serviceRoleKey =
    process.env
      .SUPABASE_SERVICE_ROLE_KEY;


  if (
    !supabaseUrl ||
    !serviceRoleKey
  ) {
    throw new Error(
      "Missing Supabase server environment variables."
    );
  }


  return createClient(
    supabaseUrl,
    serviceRoleKey,
    {
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
}


/* =========================================================
   AUTHORIZATION
========================================================= */

function authorizeSync(
  request: Request
) {
  const configuredSecret =
    process.env
      .NFL_SYNC_SECRET;


  if (
    !configuredSecret
  ) {
    return {
      authorized:
        false,

      response:
        NextResponse.json(
          {
            success:
              false,

            error:
              "NFL_SYNC_SECRET is not configured on the server.",
          },
          {
            status:
              500,
          }
        ),
    };
  }


  const suppliedSecret =
    request.headers.get(
      "x-gridiron-sync-secret"
    );


  if (
    suppliedSecret !==
    configuredSecret
  ) {
    return {
      authorized:
        false,

      response:
        NextResponse.json(
          {
            success:
              false,

            error:
              "Unauthorized projection sync request.",
          },
          {
            status:
              401,
          }
        ),
    };
  }


  return {
    authorized:
      true,

    response:
      null,
  };
}


/* =========================================================
   ESPN HELPERS
========================================================= */

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


function safeNumber(
  value:
    unknown
) {
  const parsed =
    Number(
      value
    );


  return Number.isFinite(
    parsed
  )
    ? parsed
    : null;
}


function statValue(
  stats:
    Record<
      string,
      number
    >,
  key:
    number
) {
  return safeNumber(
    stats[
      String(
        key
      )
    ]
  );
}


/* =========================================================
   ESPN STAT MAPPINGS

   Confirmed from 2026 sample players:
   QB:
     0 attempts
     1 completions
     3 passing yards
     4 passing TD
     20 interceptions

   RB:
     23 rushing attempts
     24 rushing yards
     25 rushing TD

   RECEIVING:
     42 receiving yards
     53 receptions
     58 targets
     43 receiving TD

   KICKING:
     83 field goals made
     84 field goals attempted
     86 extra points made
     87 extra points attempted

   We preserve the complete ESPN projection object in raw_stats
   so additional stat mappings can be added later without loss.
========================================================= */

function buildProjectionRow(
  nflPlayerId:
    number,
  stats:
    Record<
      string,
      number
    >,
  sourceUpdatedAt:
    string
): ProjectionUpsertRow {
  return {
    nfl_player_id:
      nflPlayerId,

    season:
      SEASON,

    source:
      "ESPN",

    passing_attempts:
      statValue(
        stats,
        0
      ),

    passing_completions:
      statValue(
        stats,
        1
      ),

    passing_yards:
      statValue(
        stats,
        3
      ),

    passing_touchdowns:
      statValue(
        stats,
        4
      ),

    passing_interceptions:
      statValue(
        stats,
        20
      ),

    rushing_attempts:
      statValue(
        stats,
        23
      ),

    rushing_yards:
      statValue(
        stats,
        24
      ),

    rushing_touchdowns:
      statValue(
        stats,
        25
      ),

    receiving_targets:
      statValue(
        stats,
        58
      ),

    receptions:
      statValue(
        stats,
        53
      ),

    receiving_yards:
      statValue(
        stats,
        42
      ),

    receiving_touchdowns:
      statValue(
        stats,
        43
      ),

    /*
     * Fumbles are preserved in raw_stats for now.
     * We should only map these once the ESPN IDs
     * are explicitly verified.
     */
    fumbles:
      null,

    fumbles_lost:
      null,

    field_goals_made:
      statValue(
        stats,
        83
      ),

    field_goals_attempted:
      statValue(
        stats,
        84
      ),

    extra_points_made:
      statValue(
        stats,
        86
      ),

    extra_points_attempted:
      statValue(
        stats,
        87
      ),

    raw_stats:
      stats,

    source_updated_at:
      sourceUpdatedAt,

    updated_at:
      sourceUpdatedAt,
  };
}


/* =========================================================
   BATCH UPSERT
========================================================= */

async function upsertInBatches(
  supabase:
    ReturnType<
      typeof getAdminClient
    >,
  rows:
    ProjectionUpsertRow[],
  batchSize:
    number
) {
  let insertedOrUpdated =
    0;


  for (
    let index =
      0;
    index <
    rows.length;
    index +=
      batchSize
  ) {
    const batch =
      rows.slice(
        index,
        index +
          batchSize
      );


    const {
      error,
    } =
      await supabase
        .schema(
          "public"
        )
        .from(
          "nfl_player_season_projections"
        )
        .upsert(
          batch,
          {
            onConflict:
              "nfl_player_id,season",
          }
        );


    if (
      error
    ) {
      throw new Error(
        `Projection upsert failed at batch starting ${index}: ${error.message}`
      );
    }


    insertedOrUpdated +=
      batch.length;
  }


  return insertedOrUpdated;
}


/* =========================================================
   POST
========================================================= */

export async function POST(
  request: Request
) {
  const authorization =
    authorizeSync(
      request
    );


  if (
    !authorization.authorized
  ) {
    return authorization
      .response!;
  }


  const startedAt =
    Date.now();


  try {
    const supabase =
      getAdminClient();


    /* =====================================================
       1. FETCH ESPN PLAYERS
    ===================================================== */

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

          error:
            `ESPN returned HTTP ${response.status}. Existing projection data was left unchanged.`,

          responsePreview:
            text.slice(
              0,
              2000
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
            "ESPN returned invalid JSON. Existing projection data was left unchanged.",
        },
        {
          status:
            502,
        }
      );
    }


    const espnPlayers =
      Array.isArray(
        parsed
      )
        ? (
            parsed as
              EspnFantasyPlayer[]
          )
        : [];


    if (
      espnPlayers.length ===
      0
    ) {
      return NextResponse.json(
        {
          success:
            false,

          error:
            "ESPN returned no fantasy players. Existing projection data was left unchanged.",
        },
        {
          status:
            502,
        }
      );
    }


    /* =====================================================
       2. LOAD GRIDIRON365 NFL PLAYERS
    ===================================================== */

    const {
      data:
        playerRows,

      error:
        playerError,
    } =
      await supabase
        .schema(
          "public"
        )
        .from(
          "nfl_players"
        )
        .select(
          "id, espn_player_id, full_name, primary_position"
        )
        .not(
          "espn_player_id",
          "is",
          null
        );


    if (
      playerError
    ) {
      throw new Error(
        `Unable to load NFL players: ${playerError.message}`
      );
    }


    const nflPlayers =
      (
        playerRows ??
        []
      ).map(
        (
          row
        ): NflPlayer => ({
          id:
            Number(
              row.id
            ),

          espn_player_id:
            row.espn_player_id
              ? String(
                  row.espn_player_id
                )
              : null,

          full_name:
            String(
              row.full_name ??
              ""
            ),

          primary_position:
            String(
              row.primary_position ??
              ""
            ),
        })
      );


    const nflPlayerByEspnId =
      new Map<
        string,
        NflPlayer
      >();


    for (
      const player
      of nflPlayers
    ) {
      if (
        player.espn_player_id
      ) {
        nflPlayerByEspnId.set(
          player.espn_player_id,
          player
        );
      }
    }


    /* =====================================================
       3. NORMALIZE ESPN PROJECTIONS
    ===================================================== */

    const sourceUpdatedAt =
      new Date()
        .toISOString();


    const projectionRows:
      ProjectionUpsertRow[] =
      [];


    const unmatched:
      Array<{
        espnPlayerId:
          number | null;

        fullName:
          string | null;

        defaultPositionId:
          number | null;
      }> =
      [];


    let playersWithProjection =
      0;

    let playersWithoutProjection =
      0;

    let matchedPlayers =
      0;

    let fantasyEligibleMatched =
      0;


    const fantasyPositions =
      new Set([
        "QB",
        "RB",
        "WR",
        "TE",
        "K",
        "PK",
      ]);


    for (
      const espnPlayer
      of espnPlayers
    ) {
      const projection =
        getSeasonProjection(
          espnPlayer
        );


      if (
        !projection
      ) {
        playersWithoutProjection +=
          1;

        continue;
      }


      playersWithProjection +=
        1;


      const espnPlayerId =
        espnPlayer.id
          ? String(
              espnPlayer.id
            )
          : null;


      if (
        !espnPlayerId
      ) {
        unmatched.push({
          espnPlayerId:
            null,

          fullName:
            espnPlayer.fullName ??
            null,

          defaultPositionId:
            espnPlayer.defaultPositionId ??
            null,
        });

        continue;
      }


      const nflPlayer =
        nflPlayerByEspnId.get(
          espnPlayerId
        );


      if (
        !nflPlayer
      ) {
        unmatched.push({
          espnPlayerId:
            espnPlayer.id ??
            null,

          fullName:
            espnPlayer.fullName ??
            null,

          defaultPositionId:
            espnPlayer.defaultPositionId ??
            null,
        });

        continue;
      }


      matchedPlayers +=
        1;


      if (
        !fantasyPositions.has(
          nflPlayer.primary_position
        )
      ) {
        continue;
      }


      fantasyEligibleMatched +=
        1;


      const stats =
        projection.stats ??
        {};


      projectionRows.push(
        buildProjectionRow(
          nflPlayer.id,
          stats,
          sourceUpdatedAt
        )
      );
    }


    if (
      projectionRows.length ===
      0
    ) {
      return NextResponse.json(
        {
          success:
            false,

          error:
            "No ESPN season projections could be matched to Gridiron365 fantasy players. Existing projection data was left unchanged.",

          espnPlayersReceived:
            espnPlayers.length,

          playersWithProjection,

          matchedPlayers,

          unmatchedCount:
            unmatched.length,

          unmatched:
            unmatched.slice(
              0,
              50
            ),
        },
        {
          status:
            502,
        }
      );
    }


    /* =====================================================
       4. UPSERT PROJECTIONS
    ===================================================== */

    const projectionRowsUpserted =
      await upsertInBatches(
        supabase,
        projectionRows,
        250
      );


    /* =====================================================
       5. UPDATE DEFAULT RANKING SOURCE TIMESTAMP/PROVIDER

       We intentionally DO NOT change ranks here.
       We also do not yet calculate projected_points here,
       because Gridiron365 supports custom league scoring.
    ===================================================== */

    const {
      error:
        rankingSourceError,
    } =
      await supabase
        .schema(
          "public"
        )
        .from(
          "traditional_default_draft_rankings"
        )
        .update({
          source:
            "ESPN",

          updated_at:
            sourceUpdatedAt,
        })
        .eq(
          "season",
          SEASON
        )
        .in(
          "player_id",
          projectionRows.map(
            row =>
              row.nfl_player_id
          )
        );


    if (
      rankingSourceError
    ) {
      throw new Error(
        `Projection rows were synced, but default ranking source update failed: ${rankingSourceError.message}`
      );
    }


    /* =====================================================
       6. SUCCESS
    ===================================================== */

    return NextResponse.json({
      success:
        true,

      provider:
        "ESPN",

      season:
        SEASON,

      automatic:
        true,

      espnPlayersReceived:
        espnPlayers.length,

      playersWithProjection,

      playersWithoutProjection,

      matchedPlayers,

      fantasyEligibleMatched,

      projectionRowsPrepared:
        projectionRows.length,

      projectionRowsUpserted,

      unmatchedCount:
        unmatched.length,

      unmatched:
        unmatched.slice(
          0,
          50
        ),

      defaultRanksChanged:
        0,

      projectedPointsCalculated:
        0,

      note:
        "Raw ESPN 2026 projections were synced. League-specific projected fantasy points should be calculated from Gridiron365 scoring settings.",

      completedAt:
        new Date()
          .toISOString(),

      durationMs:
        Date.now() -
        startedAt,
    });
  } catch (
    error
  ) {
    console.error(
      "NFL projection sync failed:",
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
            : "NFL projection sync failed.",
      },
      {
        status:
          500,
      }
    );
  }
}