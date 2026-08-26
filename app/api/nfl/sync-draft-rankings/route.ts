import {
  NextResponse,
} from "next/server";

import {
  createClient,
} from "@supabase/supabase-js";


type EspnPlayerEntry = {
  player?: {
    id?: number | string;
    fullName?: string;
    draftRanksByRankType?: Record<
      string,
      {
        rank?: number;
      }
    >;
    stats?: Array<Record<string, unknown>>;
  };
};


type RankingRow = {
  player_id: number;
  rank: number;
  projected_points: number | null;
};


function createSupabaseAdmin() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY;


  if (
    !supabaseUrl ||
    !serviceRoleKey
  ) {
    throw new Error(
      "Missing Supabase environment variables."
    );
  }


  return createClient(
    supabaseUrl,
    serviceRoleKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}


function extractProjectedPoints(
  entry: EspnPlayerEntry,
  season: number
) {
  const stats =
    entry.player?.stats ??
    [];


  const candidates =
    stats.filter(
      (
        stat
      ) => {
        const statSeason =
          Number(
            stat.seasonId ??
            stat.season ??
            season
          );


        const sourceId =
          Number(
            stat.statSourceId ??
            stat.sourceId ??
            0
          );


        const splitTypeId =
          Number(
            stat.statSplitTypeId ??
            stat.splitTypeId ??
            0
          );


        return (
          statSeason ===
            season &&
          (
            sourceId ===
              1 ||
            sourceId ===
              0
          ) &&
          splitTypeId ===
            0
        );
      }
    );


  for (
    const stat
    of candidates
  ) {
    const possibleValues =
      [
        stat.appliedTotal,
        stat.appliedStatTotal,
        stat.fantasyPoints,
        stat.projectedPoints,
      ];


    for (
      const value
      of possibleValues
    ) {
      const numeric =
        Number(
          value
        );


      if (
        Number.isFinite(
          numeric
        )
      ) {
        return numeric;
      }
    }
  }


  return null;
}


export async function POST(
  request: Request
) {
  try {
    const expectedSecret =
      process.env.GRIDIRON_SYNC_SECRET;


    if (
      !expectedSecret
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "GRIDIRON_SYNC_SECRET is not configured.",
        },
        {
          status: 500,
        }
      );
    }


    const suppliedSecret =
      request.headers.get(
        "x-gridiron-sync-secret"
      );


    if (
      suppliedSecret !==
      expectedSecret
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Unauthorized.",
        },
        {
          status: 401,
        }
      );
    }


    const url =
      new URL(
        request.url
      );


    const season =
      Number(
        url.searchParams.get(
          "season"
        ) ??
        "2026"
      );


    if (
      !Number.isInteger(
        season
      ) ||
      season <
        2000 ||
      season >
        2200
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "A valid season is required.",
        },
        {
          status: 400,
        }
      );
    }


    const scoringType =
      (
        url.searchParams.get(
          "scoring"
        ) ??
        "PPR"
      )
        .trim()
        .toUpperCase();


    if (
      ![
        "PPR",
        "HALF_PPR",
        "STANDARD",
      ].includes(
        scoringType
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "scoring must be PPR, HALF_PPR, or STANDARD.",
        },
        {
          status: 400,
        }
      );
    }


    /*
     * ESPN's public fantasy endpoint is undocumented,
     * so keep the request shape isolated here.
     *
     * leaguedefaults/3 + sortDraftRanks=PPR is a commonly
     * used public fantasy-football player-info pattern.
     */
    const espnUrl =
      `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${season}/segments/0/leaguedefaults/3?view=kona_player_info`;


    const fantasyFilter =
      {
        players: {
          filterSlotIds: {
            value: [
              0,
              1,
              2,
              3,
              4,
              5,
              6,
              7,
              8,
              9,
              10,
              11,
              12,
              13,
              14,
              15,
              16,
              17,
              18,
              19,
              23,
              24,
            ],
          },

          limit:
            2000,

          offset:
            0,

          sortDraftRanks: {
            sortPriority:
              1,

            sortAsc:
              true,

            value:
              scoringType,
          },

          filterRanksForRankTypes: {
            value: [
              scoringType,
            ],
          },

          filterRanksForSlotIds: {
            value: [
              0,
              2,
              4,
              6,
              16,
              17,
            ],
          },
        },
      };


    const espnResponse =
      await fetch(
        espnUrl,
        {
          method:
            "GET",

          headers: {
            Accept:
              "application/json",

            "User-Agent":
              "Gridiron365/2.0",

            "X-Fantasy-Source":
              "kona",

            "X-Fantasy-Filter":
              JSON.stringify(
                fantasyFilter
              ),
          },

          cache:
            "no-store",
        }
      );


    if (
      !espnResponse.ok
    ) {
      const body =
        await espnResponse.text();


      return NextResponse.json(
        {
          success: false,
          error:
            `ESPN ranking request failed with ${espnResponse.status}.`,
          details:
            body.slice(
              0,
              500
            ),
        },
        {
          status: 502,
        }
      );
    }


    const espnJson =
      (await espnResponse.json()) as {
        players?: EspnPlayerEntry[];
      };


    const espnEntries =
      espnJson.players ??
      [];


    if (
      espnEntries.length <
        100
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "ESPN returned too few players to safely replace the ranking table.",
          espnPlayerCount:
            espnEntries.length,
        },
        {
          status: 502,
        }
      );
    }


    const supabase =
      createSupabaseAdmin();


    const {
      data:
        nflPlayers,
      error:
        playersError,
    } =
      await supabase
        .from(
          "nfl_players"
        )
        .select(
          "id, espn_player_id, full_name, primary_position"
        )
        .in(
          "primary_position",
          [
            "QB",
            "RB",
            "WR",
            "TE",
            "K",
            "DST",
          ]
        );


    if (
      playersError
    ) {
      throw new Error(
        playersError.message
      );
    }


    const {
      data:
        previousRankings,
      error:
        previousError,
    } =
      await supabase
        .from(
          "traditional_default_draft_rankings"
        )
        .select(
          "player_id, rank"
        )
        .eq(
          "season",
          season
        )
        .order(
          "rank"
        );


    if (
      previousError
    ) {
      throw new Error(
        previousError.message
      );
    }


    const previousRankMap =
      new Map<
        number,
        number
      >(
        (
          previousRankings ??
          []
        ).map(
          (
            row
          ) => [
            Number(
              row.player_id
            ),
            Number(
              row.rank
            ),
          ]
        )
      );


    const byEspnId =
      new Map<
        string,
        {
          id: number;
          full_name: string;
          primary_position: string;
        }
      >();


    for (
      const player
      of nflPlayers ??
      []
    ) {
      if (
        player.espn_player_id
      ) {
        byEspnId.set(
          String(
            player.espn_player_id
          ),
          {
            id:
              Number(
                player.id
              ),

            full_name:
              String(
                player.full_name
              ),

            primary_position:
              String(
                player.primary_position
              ),
          }
        );
      }
    }


    const matched:
      Array<{
        playerId: number;
        espnRank: number;
        projectedPoints: number | null;
      }> =
        [];


    const usedPlayerIds =
      new Set<number>();


    espnEntries.forEach(
      (
        entry,
        index
      ) => {
        const espnId =
          entry.player?.id;


        if (
          espnId ===
          undefined ||
          espnId ===
          null
        ) {
          return;
        }


        const internal =
          byEspnId.get(
            String(
              espnId
            )
          );


        if (
          !internal ||
          usedPlayerIds.has(
            internal.id
          )
        ) {
          return;
        }


        const explicitRank =
          Number(
            entry.player
              ?.draftRanksByRankType
              ?.[
                scoringType
              ]
              ?.rank
          );


        matched.push({
          playerId:
            internal.id,

          espnRank:
            Number.isFinite(
              explicitRank
            ) &&
            explicitRank >
              0
              ? explicitRank
              : index +
                1,

          projectedPoints:
            extractProjectedPoints(
              entry,
              season
            ),
        });


        usedPlayerIds.add(
          internal.id
        );
      }
    );


    matched.sort(
      (
        a,
        b
      ) =>
        a.espnRank -
        b.espnRank
    );


    /*
     * Preserve every draftable player.
     * Anyone ESPN does not rank is appended after all ESPN-ranked
     * players using the previous stable rank as fallback order.
     */
    const fallback =
      (
        nflPlayers ??
        []
      )
        .filter(
          (
            player
          ) =>
            !usedPlayerIds.has(
              Number(
                player.id
              )
            )
        )
        .sort(
          (
            a,
            b
          ) => {
            const aRank =
              previousRankMap.get(
                Number(
                  a.id
                )
              ) ??
              Number.MAX_SAFE_INTEGER;


            const bRank =
              previousRankMap.get(
                Number(
                  b.id
                )
              ) ??
              Number.MAX_SAFE_INTEGER;


            if (
              aRank !==
              bRank
            ) {
              return (
                aRank -
                bRank
              );
            }


            return String(
              a.full_name
            ).localeCompare(
              String(
                b.full_name
              )
            );
          }
        );


    const finalRankings:
      RankingRow[] =
        [];


    matched.forEach(
      (
        row
      ) => {
        finalRankings.push({
          player_id:
            row.playerId,

          rank:
            finalRankings.length +
            1,

          projected_points:
            row.projectedPoints,
        });
      }
    );


    fallback.forEach(
      (
        player
      ) => {
        finalRankings.push({
          player_id:
            Number(
              player.id
            ),

          rank:
            finalRankings.length +
            1,

          projected_points:
            null,
        });
      }
    );


    if (
      finalRankings.length !==
      (
        nflPlayers ??
        []
      ).length
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Ranking validation failed before database replacement.",
          expected:
            (
              nflPlayers ??
              []
            ).length,
          actual:
            finalRankings.length,
        },
        {
          status: 500,
        }
      );
    }


    const source =
      `espn_${season}_${scoringType.toLowerCase()}`;


    const {
      data:
        replaceResult,
      error:
        replaceError,
    } =
      await supabase.rpc(
        "replace_traditional_default_draft_rankings",
        {
          p_season:
            season,

          p_source:
            source,

          p_rankings:
            finalRankings,
        }
      );


    if (
      replaceError
    ) {
      throw new Error(
        replaceError.message
      );
    }


    return NextResponse.json(
      {
        success: true,

        provider:
          "ESPN",

        season,

        scoringType,

        source,

        espnPlayersReturned:
          espnEntries.length,

        matchedEspnPlayers:
          matched.length,

        fallbackPlayers:
          fallback.length,

        totalRankings:
          finalRankings.length,

        projectedPointsFound:
          finalRankings.filter(
            (
              row
            ) =>
              row.projected_points !==
              null
          ).length,

        database:
          replaceResult,
      }
    );
  } catch (
    error
  ) {
    return NextResponse.json(
      {
        success: false,

        error:
          error instanceof Error
            ? error.message
            : "Unknown ranking sync error.",
      },
      {
        status: 500,
      }
    );
  }
}