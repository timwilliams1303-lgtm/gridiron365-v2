import {
  NextResponse,
} from "next/server";

import {
  createClient,
} from "@supabase/supabase-js";

import {
  createSupabaseAdminClient,
} from "@/lib/supabase/admin";


type EspnLogo = {
  href?: string;
};


type EspnTeam = {
  id?: string;

  abbreviation?: string;

  location?: string;

  name?: string;

  displayName?: string;

  shortDisplayName?: string;

  color?: string;

  alternateColor?: string;

  logos?: EspnLogo[];
};


type EspnTeamItem = {
  team?: EspnTeam;
};


type EspnLeague = {
  teams?: EspnTeamItem[];
};


type EspnSport = {
  leagues?: EspnLeague[];
};


type EspnTeamsResponse = {
  sports?: EspnSport[];
};


export async function POST(
  request: Request
) {
  try {
    /*
     * ========================================================
     * 1. READ AUTHORIZATION HEADER
     * ========================================================
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
      return NextResponse.json(
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
      );
    }


    const accessToken =
      authorization.slice(
        7
      );


    if (
      !accessToken
    ) {
      return NextResponse.json(
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
      );
    }


    /*
     * ========================================================
     * 2. CREATE USER-SCOPED SUPABASE CLIENT
     * ========================================================
     */

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


    /*
     * ========================================================
     * 3. VALIDATE AUTHENTICATED USER
     * ========================================================
     */

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
      return NextResponse.json(
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
      );
    }


    /*
     * ========================================================
     * 4. FETCH NFL TEAMS FROM ESPN
     * ========================================================
     */

    const espnResponse =
      await fetch(
        "https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams",
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
      !espnResponse.ok
    ) {
      throw new Error(
        `ESPN NFL team request failed with status ${espnResponse.status}.`
      );
    }


    const payload =
      (
        await espnResponse.json()
      ) as EspnTeamsResponse;


    const teamItems =
      payload
        .sports?.[0]
        ?.leagues?.[0]
        ?.teams ??
      [];


    if (
      teamItems.length ===
      0
    ) {
      throw new Error(
        "ESPN returned no NFL teams."
      );
    }


    /*
     * ========================================================
     * 5. NORMALIZE ESPN TEAM DATA
     * ========================================================
     */

    const teams =
      teamItems
        .map(
          (
            item
          ) => {
            const team =
              item.team;


            if (
              !team?.id ||
              !team.abbreviation ||
              !team.name ||
              !team.displayName
            ) {
              return null;
            }


            const abbreviation =
              team.abbreviation
                .trim()
                .toUpperCase();


            return {
              espn_team_id:
                team.id,

              abbreviation,

              location:
                team.location
                  ?.trim() ||
                null,

              name:
                team.name
                  .trim(),

              display_name:
                team.displayName
                  .trim(),

              short_display_name:
                team.shortDisplayName
                  ?.trim() ||
                null,

              color:
                team.color
                  ?.trim() ||
                null,

              alternate_color:
                team.alternateColor
                  ?.trim() ||
                null,

              logo_url:
                team.logos?.[0]
                  ?.href ??
                null,

              is_active:
                true,

              updated_at:
                new Date()
                  .toISOString(),
            };
          }
        )
        .filter(
          (
            team
          ): team is NonNullable<
            typeof team
          > =>
            team !==
            null
        );


    if (
      teams.length ===
      0
    ) {
      throw new Error(
        "No valid NFL teams were returned by ESPN."
      );
    }


    /*
     * ========================================================
     * 6. ADMIN UPSERT
     * ========================================================
     */

    const admin =
      createSupabaseAdminClient();


    const {
      error:
        upsertError,
    } =
      await admin
        .from(
          "nfl_teams"
        )
        .upsert(
          teams,
          {
            onConflict:
              "espn_team_id",
          }
        );


    if (
      upsertError
    ) {
      throw new Error(
        upsertError.message
      );
    }


    /*
     * ========================================================
     * 7. MARK TEAMS NOT RETURNED BY ESPN INACTIVE
     *
     * Normally there will still be exactly 32 active NFL teams.
     * ========================================================
     */

    const receivedEspnIds =
      teams.map(
        (
          team
        ) =>
          team
            .espn_team_id
      );


    const {
      error:
        inactiveError,
    } =
      await admin
        .from(
          "nfl_teams"
        )
        .update({
          is_active:
            false,

          updated_at:
            new Date()
              .toISOString(),
        })
        .not(
          "espn_team_id",
          "in",
          `(${receivedEspnIds.join(",")})`
        );


    /*
     * Do not fail the entire sync only because the optional
     * inactive cleanup failed.
     */

    if (
      inactiveError
    ) {
      console.error(
        "NFL team inactive cleanup failed:",
        inactiveError.message
      );
    }


    /*
     * ========================================================
     * 8. RETURN RESULT
     * ========================================================
     */

    return NextResponse.json(
      {
        success:
          true,

        userId:
          user.id,

        teamsReceived:
          teamItems.length,

        teamsUpserted:
          teams.length,

        inactiveCleanupSucceeded:
          !inactiveError,
      }
    );
  } catch (
    error
  ) {
    console.error(
      "NFL team sync failed:",
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
            : "NFL team sync failed.",
      },
      {
        status:
          500,
      }
    );
  }
}