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


type EspnPosition = {
  abbreviation?: string;
  name?: string;
};

type EspnStatus = {
  name?: string;
  type?: string;
};

type EspnHeadshot = {
  href?: string;
};

type EspnAthlete = {
  id?: string;

  fullName?: string;

  firstName?: string;

  lastName?: string;

  jersey?: string;

  position?: EspnPosition;

  status?: EspnStatus;

  headshot?: EspnHeadshot;
};

type EspnRosterGroup = {
  position?: string;

  items?: EspnAthlete[];
};

type EspnRosterResponse = {
  athletes?: EspnRosterGroup[];
};


type NflTeamRow = {
  espn_team_id: string;

  abbreviation: string;

  display_name: string;
};


type PlayerUpsertRow = {
  espn_player_id: string;

  full_name: string;

  first_name: string | null;

  last_name: string | null;

  primary_position:
    | "QB"
    | "RB"
    | "WR"
    | "TE"
    | "K"
    | "DL"
    | "DE"
    | "DT"
    | "NT"
    | "EDGE"
    | "LB"
    | "ILB"
    | "OLB"
    | "MLB"
    | "DB"
    | "CB"
    | "S"
    | "FS"
    | "SS"
    | "DST";

  team_abbreviation: string;

  jersey_number: string | null;

  status: string;

  is_active: boolean;

  headshot_url: string | null;

  updated_at: string;
};


function normalizePosition(
  position?: string
):
  | "QB"
  | "RB"
  | "WR"
  | "TE"
  | "K"
  | "DL"
  | "DE"
  | "DT"
  | "NT"
  | "EDGE"
  | "LB"
  | "ILB"
  | "OLB"
  | "MLB"
  | "DB"
  | "CB"
  | "S"
  | "FS"
  | "SS"
  | null {
  const value =
    position
      ?.trim()
      .toUpperCase();

  if (!value) {
    return null;
  }

  if (value === "QB") {
    return "QB";
  }

  if (
    value === "RB" ||
    value === "FB"
  ) {
    return "RB";
  }

  if (value === "WR") {
    return "WR";
  }

  if (value === "TE") {
    return "TE";
  }

  if (
    value === "K" ||
    value === "PK"
  ) {
    return "K";
  }

  /*
   * Defensive players are stored individually for G365's
   * dynamic matchup/injury engine. Keep ESPN's useful
   * position specificity rather than collapsing the entire
   * defense into one generic position.
   */
  const defensivePositions =
    new Set([
      "DL",
      "DE",
      "DT",
      "NT",
      "EDGE",
      "LB",
      "ILB",
      "OLB",
      "MLB",
      "DB",
      "CB",
      "S",
      "FS",
      "SS",
    ]);

  if (
    defensivePositions.has(
      value
    )
  ) {
    return value as
      | "DL"
      | "DE"
      | "DT"
      | "NT"
      | "EDGE"
      | "LB"
      | "ILB"
      | "OLB"
      | "MLB"
      | "DB"
      | "CB"
      | "S"
      | "FS"
      | "SS";
  }

  return null;
}

function normalizeStatus(
  status?: EspnStatus
) {
  const raw =
    status?.name ??
    status?.type ??
    "ACTIVE";

  const clean =
    raw
      .trim()
      .toUpperCase();

  return clean ||
    "ACTIVE";
}


function isActiveStatus(
  status: string
) {
  const inactiveStatuses =
    new Set([
      "INACTIVE",
      "RETIRED",
      "SUSPENDED",
      "CUT",
      "WAIVED",
      "FREE AGENT",
    ]);

  return !inactiveStatuses
    .has(
      status
    );
}


async function validateUser(
  request: Request
) {
  /*
   * First use the normal Gridiron365 SSR cookie session.
   * This is the same authentication source used by the
   * server side of the application.
   */
  try {
    const serverSupabase =
      await createSupabaseServerClient();

    const {
      data: {
        user,
      },
      error:
        userError,
    } =
      await serverSupabase.auth
        .getUser();

    if (
      !userError &&
      user
    ) {
      return {
        userId:
          user.id,

        error:
          null,
      };
    }
  } catch {
    /*
     * Continue to Bearer-token fallback below.
     * This keeps the route compatible with existing
     * authenticated API callers.
     */
  }


  /*
   * Bearer-token fallback for existing callers.
   */
  const authorization =
    request.headers.get(
      "authorization"
    );

  if (
    !authorization
      ?.startsWith(
        "Bearer "
      )
  ) {
    return {
      userId:
        null,

      error:
        NextResponse.json(
          {
            success:
              false,

            error:
              "Your login session is missing.",
          },
          {
            status:
              401,
          }
        ),
    };
  }

  const accessToken =
    authorization.slice(
      7
    );

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
          persistSession:
            false,

          autoRefreshToken:
            false,

          detectSessionInUrl:
            false,
        },
      }
    );

  const {
    data: {
      user,
    },

    error:
      userError,
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
      userId:
        null,

      error:
        NextResponse.json(
          {
            success:
              false,

            error:
              "Your login session is invalid.",
          },
          {
            status:
              401,
          }
        ),
    };
  }

  return {
    userId:
      user.id,

    error:
      null,
  };
}

export async function POST(
  request: Request
) {
  try {
    /*
     * ========================================================
     * 1. VALIDATE USER
     * ========================================================
     */

    const auth =
      await validateUser(
        request
      );

    if (
      auth.error
    ) {
      return auth.error;
    }


    /*
     * ========================================================
     * 2. LOAD THE 32 NFL TEAMS WE ALREADY SYNCED
     * ========================================================
     */

    const admin =
      createSupabaseAdminClient();

    const {
      data:
        teamData,

      error:
        teamError,
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
            ascending:
              true,
          }
        );

    if (
      teamError
    ) {
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
      teams.length ===
      0
    ) {
      throw new Error(
        "No active NFL teams were found. Sync NFL teams first."
      );
    }


    /*
     * ========================================================
     * 3. FETCH EACH ESPN TEAM ROSTER
     * ========================================================
     */

    const playerMap =
      new Map<
        string,
        PlayerUpsertRow
      >();

    const teamErrors:
      {
        team:
          string;

        error:
          string;
      }[] =
      [];

    let rosterTeamsProcessed =
      0;


    for (
      const team
      of teams
    ) {
      try {
        const rosterResponse =
          await fetch(
            `https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/${team.espn_team_id}/roster`,
            {
              cache:
                "no-store",

              headers: {
                Accept:
                  "application/json",
              },
            }
          );

        if (
          !rosterResponse.ok
        ) {
          throw new Error(
            `HTTP ${rosterResponse.status}`
          );
        }

        const payload =
          (
            await rosterResponse
              .json()
          ) as EspnRosterResponse;

        const groups =
          payload.athletes ??
          [];

        for (
          const group
          of groups
        ) {
          for (
            const athlete
            of group.items ??
            []
          ) {
            if (
              !athlete.id ||
              !athlete.fullName
            ) {
              continue;
            }

            const normalizedPosition =
              normalizePosition(
                athlete.position
                  ?.abbreviation ??
                group.position
              );

            /*
             * Store fantasy-relevant offensive/kicking players
             * plus individual defensive players needed by the
             * G365 dynamic matchup/injury engine.
             *
             * DST is still created separately per NFL team.
             */
            if (
              !normalizedPosition
            ) {
              continue;
            }

            const status =
              normalizeStatus(
                athlete.status
              );

            const player:
              PlayerUpsertRow =
              {
                espn_player_id:
                  athlete.id,

                full_name:
                  athlete.fullName
                    .trim(),

                first_name:
                  athlete.firstName
                    ?.trim() ||
                  null,

                last_name:
                  athlete.lastName
                    ?.trim() ||
                  null,

                primary_position:
                  normalizedPosition,

                team_abbreviation:
                  team
                    .abbreviation,

                jersey_number:
                  athlete.jersey
                    ?.trim() ||
                  null,

                status,

                is_active:
                  isActiveStatus(
                    status
                  ),

                headshot_url:
                  athlete.headshot
                    ?.href ??
                  null,

                updated_at:
                  new Date()
                    .toISOString(),
              };

            playerMap.set(
              player
                .espn_player_id,
              player
            );
          }
        }


        /*
         * ====================================================
         * CREATE SYNTHETIC DST ENTRY FOR EACH NFL TEAM
         * ====================================================
         */

        const dstId =
          `DST-${team.abbreviation}`;

        playerMap.set(
          dstId,
          {
            espn_player_id:
              dstId,

            full_name:
              `${team.display_name} Defense`,

            first_name:
              team.display_name,

            last_name:
              "Defense",

            primary_position:
              "DST",

            team_abbreviation:
              team.abbreviation,

            jersey_number:
              null,

            status:
              "ACTIVE",

            is_active:
              true,

            headshot_url:
              null,

            updated_at:
              new Date()
                .toISOString(),
          }
        );

        rosterTeamsProcessed +=
          1;
      } catch (
        error
      ) {
        teamErrors.push({
          team:
            team
              .abbreviation,

          error:
            error instanceof
              Error
              ? error.message
              : "Unknown roster error",
        });
      }
    }


    const players =
      Array.from(
        playerMap.values()
      );


    if (
      players.length ===
      0
    ) {
      throw new Error(
        "ESPN returned no usable NFL players."
      );
    }


    /*
     * ========================================================
     * 4. UPSERT PLAYERS IN CHUNKS
     *
     * Avoid sending one giant request if the player pool grows.
     * ========================================================
     */

    const chunkSize =
      500;

    let playersUpserted =
      0;


    for (
      let index =
        0;

      index <
      players.length;

      index +=
        chunkSize
    ) {
      const chunk =
        players.slice(
          index,
          index +
            chunkSize
        );

      const {
        error:
          upsertError,
      } =
        await admin
          .from(
            "nfl_players"
          )
          .upsert(
            chunk,
            {
              onConflict:
                "espn_player_id",
            }
          );

      if (
        upsertError
      ) {
        throw new Error(
          upsertError.message
        );
      }

      playersUpserted +=
        chunk.length;
    }


    /*
     * ========================================================
     * 5. MARK OLD PLAYERS INACTIVE
     *
     * We do NOT delete old players because historical fantasy
     * seasons will eventually reference them.
     *
     * Only do this if every team roster was successfully read.
     * That prevents one temporary ESPN failure from incorrectly
     * deactivating an entire team's roster.
     * ========================================================
     */

    let playersInactivated =
      0;

    let inactiveCleanupSucceeded =
      false;


    if (
      teamErrors.length ===
      0
    ) {
      const currentPlayerIds =
        players.map(
          (
            player
          ) =>
            player
              .espn_player_id
        );

      const {
        data:
          activeExisting,

        error:
          activeExistingError,
      } =
        await admin
          .from(
            "nfl_players"
          )
          .select(
            "id, espn_player_id"
          )
          .eq(
            "is_active",
            true
          );

      if (
        activeExistingError
      ) {
        throw new Error(
          activeExistingError.message
        );
      }

      const currentIdSet =
        new Set(
          currentPlayerIds
        );

      const idsToDeactivate =
        (
          activeExisting ??
          []
        )
          .filter(
            (
              player
            ) =>
              player
                .espn_player_id &&
              !currentIdSet
                .has(
                  player
                    .espn_player_id
                )
          )
          .map(
            (
              player
            ) =>
              player.id
          );


      if (
        idsToDeactivate.length >
        0
      ) {
        const {
          error:
            deactivateError,
        } =
          await admin
            .from(
              "nfl_players"
            )
            .update({
              is_active:
                false,

              updated_at:
                new Date()
                  .toISOString(),
            })
            .in(
              "id",
              idsToDeactivate
            );

        if (
          deactivateError
        ) {
          throw new Error(
            deactivateError.message
          );
        }

        playersInactivated =
          idsToDeactivate.length;
      }

      inactiveCleanupSucceeded =
        true;
    }


    /*
     * ========================================================
     * 6. RETURN RESULT
     * ========================================================
     */

    return NextResponse.json(
      {
        success:
          true,

        userId:
          auth.userId,

        teamsExpected:
          teams.length,

        teamsProcessed:
          rosterTeamsProcessed,

        teamsFailed:
          teamErrors.length,

        playersReceived:
          players.length,

        playersUpserted,

        playersInactivated,

        inactiveCleanupSucceeded,

        teamErrors,
      }
    );
  } catch (
    error
  ) {
    console.error(
      "NFL player sync failed:",
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
            : "NFL player sync failed.",
      },
      {
        status:
          500,
      }
    );
  }
}