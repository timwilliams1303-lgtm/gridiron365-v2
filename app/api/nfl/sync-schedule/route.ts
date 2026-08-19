import {
  NextResponse,
} from "next/server";

import {
  createClient,
} from "@supabase/supabase-js";

import {
  createSupabaseAdminClient,
} from "@/lib/supabase/admin";


type EspnTeamRef = {
  id?: string;
};

type EspnCompetitor = {
  homeAway?: "home" | "away";
  team?: EspnTeamRef;
  score?: string;
};

type EspnVenueAddress = {
  city?: string;
  state?: string;
};

type EspnVenue = {
  fullName?: string;
  address?: EspnVenueAddress;
};

type EspnCompetition = {
  date?: string;
  neutralSite?: boolean;
  competitors?: EspnCompetitor[];
  venue?: EspnVenue;
};

type EspnStatusType = {
  id?: string;
  name?: string;
  detail?: string;
  completed?: boolean;
};

type EspnStatus = {
  type?: EspnStatusType;
};

type EspnEvent = {
  id?: string;
  date?: string;
  competitions?: EspnCompetition[];
  status?: EspnStatus;
};

type EspnScoreboardResponse = {
  events?: EspnEvent[];
};

type NflTeamRow = {
  id: number;
  espn_team_id: string;
  abbreviation: string;
};

type GameRow = {
  espn_event_id: string;
  season: number;
  season_type: number;
  week: number;
  kickoff_at: string;
  home_team_id: number;
  away_team_id: number;
  home_score: number | null;
  away_score: number | null;
  status_type: string | null;
  status_name: string | null;
  status_detail: string | null;
  status_completed: boolean;
  venue_name: string | null;
  venue_city: string | null;
  venue_state: string | null;
  neutral_site: boolean;
  updated_at: string;
};


async function validateUser(
  request: Request
) {
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


function parseScore(
  value?: string
) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null;
  }

  const parsed =
    Number(
      value
    );

  if (
    !Number.isFinite(
      parsed
    )
  ) {
    return null;
  }

  return Math.max(
    0,
    Math.trunc(
      parsed
    )
  );
}


export async function POST(
  request: Request
) {
  try {
    const auth =
      await validateUser(
        request
      );

    if (
      auth.error
    ) {
      return auth.error;
    }

    let body: {
      season?: number;
    } = {};

    try {
      body =
        await request.json();
    } catch {
      body = {};
    }

    const currentYear =
      new Date()
        .getFullYear();

    const season =
      Number(
        body.season ??
        currentYear
      );

    if (
      !Number.isInteger(
        season
      ) ||
      season < 2000 ||
      season > 2200
    ) {
      return NextResponse.json(
        {
          success:
            false,

          error:
            "A valid NFL season is required.",
        },
        {
          status:
            400,
        }
      );
    }

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
          "id, espn_team_id, abbreviation"
        )
        .eq(
          "is_active",
          true
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

    const teamByEspnId =
      new Map<
        string,
        NflTeamRow
      >();

    for (
      const team
      of teams
    ) {
      teamByEspnId.set(
        team.espn_team_id,
        team
      );
    }

    const games:
      GameRow[] =
      [];

    const weekErrors:
      {
        week: number;
        error: string;
      }[] =
      [];

    for (
      let week =
        1;

      week <=
      18;

      week +=
        1
    ) {
      try {
        const espnResponse =
          await fetch(
            `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=${season}&seasontype=2&week=${week}`,
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
            `HTTP ${espnResponse.status}`
          );
        }

        const payload =
          (
            await espnResponse
              .json()
          ) as EspnScoreboardResponse;

        for (
          const event
          of payload.events ??
          []
        ) {
          if (
            !event.id
          ) {
            continue;
          }

          const competition =
            event
              .competitions?.[0];

          if (
            !competition
          ) {
            continue;
          }

          const home =
            competition
              .competitors
              ?.find(
                (
                  competitor
                ) =>
                  competitor
                    .homeAway ===
                  "home"
              );

          const away =
            competition
              .competitors
              ?.find(
                (
                  competitor
                ) =>
                  competitor
                    .homeAway ===
                  "away"
              );

          const homeEspnId =
            home?.team?.id;

          const awayEspnId =
            away?.team?.id;

          if (
            !homeEspnId ||
            !awayEspnId
          ) {
            continue;
          }

          const homeTeam =
            teamByEspnId
              .get(
                homeEspnId
              );

          const awayTeam =
            teamByEspnId
              .get(
                awayEspnId
              );

          if (
            !homeTeam ||
            !awayTeam
          ) {
            continue;
          }

          const kickoffAt =
            competition.date ??
            event.date;

          if (
            !kickoffAt
          ) {
            continue;
          }

          games.push({
            espn_event_id:
              event.id,

            season,

            season_type:
              2,

            week,

            kickoff_at:
              kickoffAt,

            home_team_id:
              homeTeam.id,

            away_team_id:
              awayTeam.id,

            home_score:
              parseScore(
                home.score
              ),

            away_score:
              parseScore(
                away.score
              ),

            status_type:
              event.status
                ?.type
                ?.id ??
              null,

            status_name:
              event.status
                ?.type
                ?.name ??
              null,

            status_detail:
              event.status
                ?.type
                ?.detail ??
              null,

            status_completed:
              event.status
                ?.type
                ?.completed ??
              false,

            venue_name:
              competition.venue
                ?.fullName ??
              null,

            venue_city:
              competition.venue
                ?.address
                ?.city ??
              null,

            venue_state:
              competition.venue
                ?.address
                ?.state ??
              null,

            neutral_site:
              competition
                .neutralSite ??
              false,

            updated_at:
              new Date()
                .toISOString(),
          });
        }
      } catch (
        error
      ) {
        weekErrors.push({
          week,

          error:
            error instanceof
              Error
              ? error.message
              : "Unknown schedule error",
        });
      }
    }

    if (
      games.length ===
      0
    ) {
      throw new Error(
        "ESPN returned no usable NFL regular-season games."
      );
    }

    const chunkSize =
      100;

    let gamesUpserted =
      0;

    for (
      let index =
        0;

      index <
      games.length;

      index +=
        chunkSize
    ) {
      const chunk =
        games.slice(
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
            "nfl_games"
          )
          .upsert(
            chunk,
            {
              onConflict:
                "espn_event_id",
            }
          );

      if (
        upsertError
      ) {
        throw new Error(
          upsertError.message
        );
      }

      gamesUpserted +=
        chunk.length;
    }

    /*
     * Calculate bye week from absence from a regular-season week.
     *
     * Only do this when all 18 weeks were successfully fetched.
     */
    let byeWeeksUpdated =
      0;

    if (
      weekErrors.length ===
      0
    ) {
      const teamsPlayingByWeek =
        new Map<
          number,
          Set<number>
        >();

      for (
        let week =
          1;

        week <=
        18;

        week +=
          1
      ) {
        teamsPlayingByWeek.set(
          week,
          new Set()
        );
      }

      for (
        const game
        of games
      ) {
        teamsPlayingByWeek
          .get(
            game.week
          )
          ?.add(
            game.home_team_id
          );

        teamsPlayingByWeek
          .get(
            game.week
          )
          ?.add(
            game.away_team_id
          );
      }

      for (
        const team
        of teams
      ) {
        let byeWeek:
          number |
          null =
          null;

        for (
          let week =
            1;

          week <=
          18;

          week +=
            1
        ) {
          const playing =
            teamsPlayingByWeek
              .get(
                week
              )
              ?.has(
                team.id
              ) ??
            false;

          if (
            !playing
          ) {
            byeWeek =
              week;

            break;
          }
        }

        const {
          error:
            seasonUpsertError,
        } =
          await admin
            .from(
              "nfl_team_seasons"
            )
            .upsert(
              {
                nfl_team_id:
                  team.id,

                season,

                bye_week:
                  byeWeek,

                updated_at:
                  new Date()
                    .toISOString(),
              },
              {
                onConflict:
                  "nfl_team_id,season",
              }
            );

        if (
          seasonUpsertError
        ) {
          throw new Error(
            seasonUpsertError.message
          );
        }

        byeWeeksUpdated +=
          1;
      }
    }

    return NextResponse.json(
      {
        success:
          true,

        userId:
          auth.userId,

        season,

        seasonType:
          2,

        weeksExpected:
          18,

        weeksFailed:
          weekErrors.length,

        gamesReceived:
          games.length,

        gamesUpserted,

        byeWeeksUpdated,

        byeWeekCalculationSucceeded:
          weekErrors.length ===
          0,

        weekErrors,
      }
    );
  } catch (
    error
  ) {
    console.error(
      "NFL schedule sync failed:",
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
            : "NFL schedule sync failed.",
      },
      {
        status:
          500,
      }
    );
  }
}