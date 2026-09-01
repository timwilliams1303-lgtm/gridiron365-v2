import {
  NextResponse,
} from "next/server";

import {
  createClient,
} from "@supabase/supabase-js";

import {
  createSupabaseAdminClient,
} from "@/lib/supabase/admin";

import {
  createSupabaseServerClient,
} from "@/lib/supabase/server";


type EspnRef = {
  $ref?: string;
};


type EspnDepthAthlete = {
  slot?: number;
  rank?: number;
  athlete?: EspnRef;
};


type EspnDepthPositionMetadata = {
  id?: string;
  name?: string;
  displayName?: string;
  abbreviation?: string;
};


type EspnDepthPosition = {
  position?: EspnDepthPositionMetadata;
  athletes?: EspnDepthAthlete[];
};


type EspnDepthChartItem = {
  id?: string;
  name?: string;
  positions?: Record<string, EspnDepthPosition>;
};


type EspnDepthChartResponse = {
  items?: EspnDepthChartItem[];
};


type NflTeamRow = {
  espn_team_id: string;
  abbreviation: string;
  display_name: string;
};


type NflPlayerLookupRow = {
  id: number;
  espn_player_id: string;
};


type DepthChartUpsertRow = {
  season: number;
  team_abbreviation: string;
  espn_team_id: string;
  formation_id: string;
  formation_name: string;
  position_key: string;
  position_id: string | null;
  position_name: string | null;
  position_abbreviation: string | null;
  slot: number;
  depth_rank: number;
  espn_player_id: string;
  nfl_player_id: number | null;
  source: string;
  synced_at: string;
};


type RequestBody = {
  season?: number;
};


function extractEspnPlayerId(
  athleteRef?: string
) {
  if (!athleteRef) {
    return null;
  }

  const match =
    athleteRef.match(
      /\/athletes\/([^/?#]+)/
    );

  if (!match?.[1]) {
    return null;
  }

  return decodeURIComponent(
    match[1]
  );
}


function cleanText(
  value?: string
) {
  const cleaned =
    value?.trim();

  return cleaned || null;
}


function chunkArray<T>(
  values: T[],
  size: number
) {
  const chunks: T[][] = [];

  for (
    let index = 0;
    index < values.length;
    index += size
  ) {
    chunks.push(
      values.slice(
        index,
        index + size
      )
    );
  }

  return chunks;
}


async function validateUser(
  request: Request
) {
  try {
    const serverSupabase =
      await createSupabaseServerClient();

    const {
      data: {
        user,
      },
      error: userError,
    } =
      await serverSupabase.auth
        .getUser();

    if (
      !userError &&
      user
    ) {
      return {
        userId: user.id,
        error: null,
      };
    }
  } catch {
    // Continue to Bearer-token fallback.
  }


  const authorization =
    request.headers.get(
      "authorization"
    );

  if (
    !authorization?.startsWith(
      "Bearer "
    )
  ) {
    return {
      userId: null,
      error:
        NextResponse.json(
          {
            success: false,
            error:
              "Your login session is missing.",
          },
          {
            status: 401,
          }
        ),
    };
  }


  const accessToken =
    authorization.slice(7);

  const supabaseUrl =
    process.env
      .NEXT_PUBLIC_SUPABASE_URL;

  const supabaseKey =
    process.env
      .NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (
    !supabaseUrl ||
    !supabaseKey
  ) {
    throw new Error(
      "Supabase environment variables are missing."
    );
  }


  const userClient =
    createClient(
      supabaseUrl,
      supabaseKey,
      {
        global: {
          headers: {
            Authorization:
              `Bearer ${accessToken}`,
          },
        },

        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      }
    );


  const {
    data: {
      user,
    },
    error: userError,
  } =
    await userClient.auth
      .getUser(
        accessToken
      );

  if (
    userError ||
    !user
  ) {
    return {
      userId: null,
      error:
        NextResponse.json(
          {
            success: false,
            error:
              "Your login session is invalid.",
          },
          {
            status: 401,
          }
        ),
    };
  }


  return {
    userId: user.id,
    error: null,
  };
}


export async function POST(
  request: Request
) {
  try {
    const auth =
      await validateUser(
        request
      );

    if (auth.error) {
      return auth.error;
    }


    let body: RequestBody = {};

    try {
      body =
        await request.json() as
          RequestBody;
    } catch {
      // Empty request body is allowed.
    }


    const season =
      Number.isInteger(
        body.season
      ) &&
      Number(body.season) >= 2000
        ? Number(body.season)
        : 2026;


    const admin =
      createSupabaseAdminClient();


    const {
      data: teamData,
      error: teamError,
    } =
      await admin
        .from(
          "nfl_teams"
        )
        .select(
          "espn_team_id, abbreviation, display_name"
        )
        .eq(
          "is_active",
          true
        )
        .order(
          "abbreviation",
          {
            ascending: true,
          }
        );

    if (teamError) {
      throw new Error(
        teamError.message
      );
    }


    const teams =
      (
        teamData ??
        []
      ) as NflTeamRow[];

    if (
      teams.length === 0
    ) {
      throw new Error(
        "No active NFL teams were found. Sync NFL teams first."
      );
    }


    const {
      data: nflPlayerData,
      error: nflPlayerError,
    } =
      await admin
        .from(
          "nfl_players"
        )
        .select(
          "id, espn_player_id"
        )
        .not(
          "espn_player_id",
          "is",
          null
        );

    if (nflPlayerError) {
      throw new Error(
        nflPlayerError.message
      );
    }


    const nflPlayerMap =
      new Map<string, number>();

    for (
      const player
      of (
        nflPlayerData ??
        []
      ) as NflPlayerLookupRow[]
    ) {
      if (
        !player.espn_player_id
      ) {
        continue;
      }

      nflPlayerMap.set(
        player.espn_player_id,
        player.id
      );
    }


    const teamErrors:
      {
        team: string;
        error: string;
      }[] =
      [];

    const teamResults:
      {
        team: string;
        formations: number;
        entries: number;
        matchedPlayers: number;
        unmatchedPlayers: number;
        staleRowsRemoved: number;
      }[] =
      [];


    let teamsProcessed = 0;
    let totalFormations = 0;
    let totalEntries = 0;
    let totalMatchedPlayers = 0;
    let totalUnmatchedPlayers = 0;
    let totalStaleRowsRemoved = 0;


    for (
      const team
      of teams
    ) {
      try {
        const teamSyncTimestamp =
          new Date()
            .toISOString();

        const depthChartUrl =
          `https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/${season}/teams/${team.espn_team_id}/depthcharts?lang=en&region=us`;

        const depthResponse =
          await fetch(
            depthChartUrl,
            {
              cache: "no-store",
              headers: {
                Accept:
                  "application/json",
              },
            }
          );

        if (
          !depthResponse.ok
        ) {
          throw new Error(
            `ESPN depth chart HTTP ${depthResponse.status}`
          );
        }


        const payload =
          (
            await depthResponse.json()
          ) as EspnDepthChartResponse;

        const formations =
          payload.items ??
          [];

        if (
          formations.length === 0
        ) {
          throw new Error(
            "ESPN returned no depth-chart formations."
          );
        }


        const rowMap =
          new Map<
            string,
            DepthChartUpsertRow
          >();

        let matchedPlayers = 0;
        let unmatchedPlayers = 0;


        for (
          const formation
          of formations
        ) {
          const formationId =
            cleanText(
              formation.id
            );

          const formationName =
            cleanText(
              formation.name
            );

          if (
            !formationId ||
            !formationName
          ) {
            continue;
          }


          const positions =
            formation.positions ??
            {};

          for (
            const [
              rawPositionKey,
              positionData,
            ]
            of Object.entries(
              positions
            )
          ) {
            const positionKey =
              rawPositionKey
                .trim()
                .toLowerCase();

            if (
              !positionKey
            ) {
              continue;
            }

            const positionMetadata =
              positionData.position;

            for (
              const athleteEntry
              of (
                positionData.athletes ??
                []
              )
            ) {
              const espnPlayerId =
                extractEspnPlayerId(
                  athleteEntry
                    .athlete
                    ?.$ref
                );

              if (
                !espnPlayerId
              ) {
                continue;
              }


              const slot =
                Number(
                  athleteEntry.slot
                );

              const depthRank =
                Number(
                  athleteEntry.rank
                );

              if (
                !Number.isInteger(
                  slot
                ) ||
                slot <= 0 ||
                !Number.isInteger(
                  depthRank
                ) ||
                depthRank <= 0
              ) {
                continue;
              }


              const nflPlayerId =
                nflPlayerMap.get(
                  espnPlayerId
                ) ??
                null;

              if (
                nflPlayerId !== null
              ) {
                matchedPlayers += 1;
              } else {
                unmatchedPlayers += 1;
              }


              const row:
                DepthChartUpsertRow =
                {
                  season,
                  team_abbreviation:
                    team.abbreviation,
                  espn_team_id:
                    team.espn_team_id,
                  formation_id:
                    formationId,
                  formation_name:
                    formationName,
                  position_key:
                    positionKey,
                  position_id:
                    cleanText(
                      positionMetadata
                        ?.id
                    ),
                  position_name:
                    cleanText(
                      positionMetadata
                        ?.displayName ??
                      positionMetadata
                        ?.name
                    ),
                  position_abbreviation:
                    cleanText(
                      positionMetadata
                        ?.abbreviation
                    ),
                  slot,
                  depth_rank:
                    depthRank,
                  espn_player_id:
                    espnPlayerId,
                  nfl_player_id:
                    nflPlayerId,
                  source:
                    "ESPN",
                  synced_at:
                    teamSyncTimestamp,
                };


              const uniqueKey =
                [
                  season,
                  team.espn_team_id,
                  formationId,
                  positionKey,
                  slot,
                  depthRank,
                ].join(":");

              rowMap.set(
                uniqueKey,
                row
              );
            }
          }
        }


        const rows =
          Array.from(
            rowMap.values()
          );

        if (
          rows.length === 0
        ) {
          throw new Error(
            "ESPN returned formations but no usable depth-chart player entries."
          );
        }


        const rowChunks =
          chunkArray(
            rows,
            500
          );

        for (
          const chunk
          of rowChunks
        ) {
          const {
            error: upsertError,
          } =
            await admin
              .from(
                "nfl_depth_chart_entries"
              )
              .upsert(
                chunk,
                {
                  onConflict:
                    "season,espn_team_id,formation_id,position_key,slot,depth_rank",
                }
              );

          if (
            upsertError
          ) {
            throw new Error(
              `Depth-chart upsert failed: ${upsertError.message}`
            );
          }
        }


        const {
          data: staleRows,
          error: staleDeleteError,
        } =
          await admin
            .from(
              "nfl_depth_chart_entries"
            )
            .delete()
            .eq(
              "season",
              season
            )
            .eq(
              "espn_team_id",
              team.espn_team_id
            )
            .lt(
              "synced_at",
              teamSyncTimestamp
            )
            .select(
              "id"
            );

        if (
          staleDeleteError
        ) {
          throw new Error(
            `Stale depth-chart cleanup failed: ${staleDeleteError.message}`
          );
        }


        const staleRowsRemoved =
          staleRows?.length ??
          0;

        teamsProcessed += 1;
        totalFormations +=
          formations.length;
        totalEntries +=
          rows.length;
        totalMatchedPlayers +=
          matchedPlayers;
        totalUnmatchedPlayers +=
          unmatchedPlayers;
        totalStaleRowsRemoved +=
          staleRowsRemoved;


        teamResults.push({
          team:
            team.abbreviation,
          formations:
            formations.length,
          entries:
            rows.length,
          matchedPlayers,
          unmatchedPlayers,
          staleRowsRemoved,
        });
      } catch (
        error
      ) {
        teamErrors.push({
          team:
            team.abbreviation,
          error:
            error instanceof Error
              ? error.message
              : "Unknown depth-chart sync error",
        });
      }
    }


    return NextResponse.json(
      {
        success:
          teamErrors.length === 0,
        userId:
          auth.userId,
        season,
        source:
          "ESPN Core API",
        teamsExpected:
          teams.length,
        teamsProcessed,
        teamsFailed:
          teamErrors.length,
        formationsReceived:
          totalFormations,
        depthChartEntries:
          totalEntries,
        matchedPlayers:
          totalMatchedPlayers,
        unmatchedPlayers:
          totalUnmatchedPlayers,
        staleRowsRemoved:
          totalStaleRowsRemoved,
        teamResults,
        teamErrors,
      },
      {
        status:
          teamErrors.length ===
          teams.length
            ? 500
            : 200,
      }
    );
  } catch (
    error
  ) {
    console.error(
      "NFL depth-chart sync failed:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "NFL depth-chart sync failed.",
      },
      {
        status: 500,
      }
    );
  }
}
