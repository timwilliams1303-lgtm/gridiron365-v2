import {
  NextResponse,
} from "next/server";

import {
  createClient,
} from "@supabase/supabase-js";


export const dynamic =
  "force-dynamic";

export const maxDuration =
  60;


type EspnTeam = {
  id?: string;
  abbreviation?: string;
  displayName?: string;
};


type EspnCompetitor = {
  homeAway?:
    | "home"
    | "away";

  score?: string;

  team?: EspnTeam;
};


type EspnCompetition = {
  id?: string;

  date?: string;

  neutralSite?: boolean;

  venue?: {
    fullName?: string;

    address?: {
      city?: string;
      state?: string;
    };
  };

  status?: {
    type?: {
      id?: string;
      name?: string;
      state?: string;
      completed?: boolean;
      description?: string;
      detail?: string;
      shortDetail?: string;
    };
  };

  competitors?:
    EspnCompetitor[];
};


type EspnEvent = {
  id?: string;

  date?: string;

  season?: {
    year?: number;
    type?: number;
    slug?: string;
  };

  week?: {
    number?: number;
  };

  competitions?:
    EspnCompetition[];
};


type EspnScoreboard = {
  events?: EspnEvent[];
};


type NflTeamRow = {
  id: number;
  espn_team_id: string;
  abbreviation: string;
};


type SyncedGame = {
  espnEventId: string;

  espnWeek:
    number;

  nflPreseasonWeek:
    number;

  home:
    string | null;

  away:
    string | null;

  kickoffAt:
    string;

  status:
    string | null;
};


function toInteger(
  value:
    | string
    | number
    | null
    | undefined
) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return 0;
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
    return 0;
  }

  return Math.trunc(
    parsed
  );
}


function createSupabaseAdmin() {
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
      "Missing Supabase environment variables."
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


/*
 * ESPN preseason numbering includes
 * the preseason opening / Hall of Fame
 * week.
 *
 * ESPN 2 -> NFL preseason week 1
 * ESPN 3 -> NFL preseason week 2
 * ESPN 4 -> NFL preseason week 3
 *
 * ESPN week 1 is intentionally skipped.
 */
function normalizeEspnPreseasonWeek(
  espnWeek:
    number
) {
  if (
    espnWeek >= 2 &&
    espnWeek <= 4
  ) {
    return espnWeek - 1;
  }

  return null;
}


function isAuthorized(
  request:
    Request
) {
  if (
    process.env.NODE_ENV !==
    "production"
  ) {
    return true;
  }


  const suppliedSecret =
    request.headers.get(
      "x-gridiron-sync-secret"
    );


  const configuredSecret =
    process.env
      .NFL_SYNC_SECRET ??
    process.env
      .GRIDIRON_SYNC_SECRET;


  if (
    suppliedSecret &&
    configuredSecret &&
    suppliedSecret ===
      configuredSecret
  ) {
    return true;
  }


  const authorization =
    request.headers.get(
      "authorization"
    );


  if (
    configuredSecret &&
    authorization ===
      `Bearer ${configuredSecret}`
  ) {
    return true;
  }


  return false;
}


export async function POST(
  request:
    Request
) {
  if (
    !isAuthorized(
      request
    )
  ) {
    return NextResponse.json(
      {
        success:
          false,

        error:
          "Unauthorized preseason schedule sync request.",
      },
      {
        status:
          401,
      }
    );
  }


  try {
    const supabase =
      createSupabaseAdmin();


    let body: {
      season?:
        number;
    } = {};


    try {
      body =
        await request.json();
    } catch {
      body = {};
    }


    const season =
      Number(
        body.season ??
        new Date()
          .getFullYear()
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


    /*
     * Load NFL teams once.
     */
    const {
      data:
        nflTeams,

      error:
        teamError,
    } =
      await supabase
        .from(
          "nfl_teams"
        )
        .select(`
          id,
          espn_team_id,
          abbreviation
        `);


    if (
      teamError
    ) {
      throw new Error(
        `Unable to load NFL teams: ${teamError.message}`
      );
    }


    const teamRows =
      (
        nflTeams ??
        []
      ) as NflTeamRow[];


    if (
      teamRows.length ===
      0
    ) {
      throw new Error(
        "No NFL teams were found."
      );
    }


    const teamByEspnId =
      new Map<
        string,
        NflTeamRow
      >();


    for (
      const team
      of teamRows
    ) {
      teamByEspnId.set(
        String(
          team.espn_team_id
        ),

        team
      );
    }


    let processed =
      0;

    let insertedOrUpdated =
      0;

    let skipped =
      0;


    const skippedGames:
      Array<{
        eventId:
          string | null;

        espnWeek?:
          number | null;

        reason:
          string;
      }> = [];


    const syncedGames:
      SyncedGame[] =
        [];


    const weekErrors:
      Array<{
        espnWeek:
          number;

        nflPreseasonWeek:
          number;

        error:
          string;
      }> = [];


    /*
     * Fetch ESPN preseason weeks 2-4.
     *
     * Those map to official NFL
     * preseason weeks 1-3.
     */
    for (
      let espnWeek =
        2;

      espnWeek <=
      4;

      espnWeek +=
        1
    ) {
      const nflPreseasonWeek =
        normalizeEspnPreseasonWeek(
          espnWeek
        );


      if (
        nflPreseasonWeek ===
        null
      ) {
        continue;
      }


      try {
        const espnUrl =
          `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=${season}&seasontype=1&week=${espnWeek}&limit=100`;


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
                  "Mozilla/5.0 Gridiron365/1.0",
              },

              cache:
                "no-store",
            }
          );


        const espnText =
          await espnResponse
            .text();


        if (
          !espnResponse.ok
        ) {
          throw new Error(
            `ESPN returned HTTP ${espnResponse.status}: ${espnText.slice(
              0,
              500
            )}`
          );
        }


        let scoreboard:
          EspnScoreboard;


        try {
          scoreboard =
            JSON.parse(
              espnText
            ) as EspnScoreboard;
        } catch {
          throw new Error(
            "ESPN returned invalid JSON."
          );
        }


        const events =
          scoreboard.events ??
          [];


        for (
          const event
          of events
        ) {
          processed +=
            1;


          const eventId =
            event.id;


          const competition =
            event
              .competitions?.[0];


          if (
            !eventId ||
            !competition
          ) {
            skipped +=
              1;

            skippedGames.push({
              eventId:
                eventId ??
                null,

              espnWeek,

              reason:
                "Missing ESPN event ID or competition.",
            });

            continue;
          }


          const competitors =
            competition
              .competitors ??
            [];


          const home =
            competitors.find(
              (
                competitor
              ) =>
                competitor
                  .homeAway ===
                "home"
            );


          const away =
            competitors.find(
              (
                competitor
              ) =>
                competitor
                  .homeAway ===
                "away"
            );


          const homeEspnTeamId =
            home
              ?.team
              ?.id;


          const awayEspnTeamId =
            away
              ?.team
              ?.id;


          if (
            !homeEspnTeamId ||
            !awayEspnTeamId
          ) {
            skipped +=
              1;

            skippedGames.push({
              eventId,

              espnWeek,

              reason:
                "Missing home or away ESPN team ID.",
            });

            continue;
          }


          const homeInternalTeam =
            teamByEspnId.get(
              String(
                homeEspnTeamId
              )
            );


          const awayInternalTeam =
            teamByEspnId.get(
              String(
                awayEspnTeamId
              )
            );


          if (
            !homeInternalTeam ||
            !awayInternalTeam
          ) {
            skipped +=
              1;

            skippedGames.push({
              eventId,

              espnWeek,

              reason:
                `Could not map ESPN teams. Home=${homeEspnTeamId}, Away=${awayEspnTeamId}`,
            });

            continue;
          }


          const kickoffAt =
            competition.date ??
            event.date;


          if (
            !kickoffAt
          ) {
            skipped +=
              1;

            skippedGames.push({
              eventId,

              espnWeek,

              reason:
                "Missing kickoff date.",
            });

            continue;
          }


          const eventSeason =
            event
              .season
              ?.year ??
            season;


          const actualSeasonType =
            event
              .season
              ?.type ??
            1;


          if (
            actualSeasonType !==
            1
          ) {
            skipped +=
              1;

            skippedGames.push({
              eventId,

              espnWeek,

              reason:
                `Unexpected ESPN season type ${actualSeasonType}.`,
            });

            continue;
          }


          const statusType =
            competition
              .status
              ?.type
              ?.id ??
            null;


          const statusName =
            competition
              .status
              ?.type
              ?.name ??
            null;


          const statusDetail =
            competition
              .status
              ?.type
              ?.detail ??
            competition
              .status
              ?.type
              ?.description ??
            null;


          const completed =
            competition
              .status
              ?.type
              ?.completed ??
            false;


          /*
           * IMPORTANT:
           *
           * Store normalized NFL preseason
           * week rather than ESPN's week.
           */
          const payload = {
            espn_event_id:
              eventId,

            season:
              eventSeason,

            season_type:
              1,

            week:
              nflPreseasonWeek,

            kickoff_at:
              kickoffAt,

            home_team_id:
              homeInternalTeam.id,

            away_team_id:
              awayInternalTeam.id,

            home_score:
              toInteger(
                home?.score
              ),

            away_score:
              toInteger(
                away?.score
              ),

            status_type:
              statusType,

            status_name:
              statusName,

            status_detail:
              statusDetail,

            status_completed:
              completed,

            venue_name:
              competition
                .venue
                ?.fullName ??
              null,

            venue_city:
              competition
                .venue
                ?.address
                ?.city ??
              null,

            venue_state:
              competition
                .venue
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
          };


          const {
            error:
              upsertError,
          } =
            await supabase
              .from(
                "nfl_games"
              )
              .upsert(
                payload,
                {
                  onConflict:
                    "espn_event_id",
                }
              );


          if (
            upsertError
          ) {
            throw new Error(
              `Unable to upsert ESPN game ${eventId}: ${upsertError.message}`
            );
          }


          insertedOrUpdated +=
            1;


          syncedGames.push({
            espnEventId:
              eventId,

            espnWeek,

            nflPreseasonWeek,

            home:
              home
                ?.team
                ?.abbreviation ??
              null,

            away:
              away
                ?.team
                ?.abbreviation ??
              null,

            kickoffAt,

            status:
              statusName,
          });
        }

      } catch (
        error
      ) {
        weekErrors.push({
          espnWeek,

          nflPreseasonWeek,

          error:
            error instanceof
              Error
              ? error.message
              : "Unknown ESPN preseason schedule error.",
        });
      }
    }


    return NextResponse.json({
      success:
        weekErrors.length ===
        0,

      source:
        "ESPN",

      season,

      seasonType:
        1,

      mapping: {
        espnWeek2:
          "NFL preseason week 1",

        espnWeek3:
          "NFL preseason week 2",

        espnWeek4:
          "NFL preseason week 3",
      },

      processed,

      insertedOrUpdated,

      skipped,

      weeksFailed:
        weekErrors.length,

      syncedGames,

      skippedGames,

      weekErrors,
    });

  } catch (
    error
  ) {
    console.error(
      "Preseason ESPN game sync failed:",
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
            : "Unknown preseason sync error.",
      },
      {
        status:
          500,
      }
    );
  }
}