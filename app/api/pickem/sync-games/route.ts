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


type FootballScope =
  | "college_nfl"
  | "college_only"
  | "nfl_only";


type PickemWeekRow = {
  id: number;
  league_id: string;
  season: number;
  week: number;
  status: string;
  line_day_at: string | null;
  finalize_not_before: string | null;
  slate_starts_at: string | null;
  slate_ends_at: string | null;
};


type PickemSettingsRow = {
  league_id: string;
  football_scope:
    FootballScope;
};


type EspnTeam = {
  id?: string;
  abbreviation?: string;
  displayName?: string;
  shortDisplayName?: string;
};


type EspnCompetitor = {
  homeAway?:
    | "home"
    | "away";
  score?:
    string;
  team?:
    EspnTeam;
};


type EspnStatus = {
  period?: number;
  displayClock?: string;
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


type EspnCompetition = {
  id?: string;
  date?: string;
  status?:
    EspnStatus;
  competitors?:
    EspnCompetitor[];
};


type EspnEvent = {
  id?: string;
  date?: string;
  name?: string;
  shortName?: string;
  season?: {
    year?: number;
    type?: number;
  };
  week?: {
    number?: number;
  };
  status?:
    EspnStatus;
  competitions?:
    EspnCompetition[];
};


type EspnScoreboard = {
  events?:
    EspnEvent[];
};


type SyncRequestBody = {
  leagueId?: string;
  season?: number;
  week?: number;
};


type NormalizedGame = {
  provider_event_id:
    string;
  kickoff_at:
    string;
  away_team_name:
    string;
  away_team_abbreviation:
    string | null;
  home_team_name:
    string;
  home_team_abbreviation:
    string | null;
  away_score:
    number | null;
  home_score:
    number | null;
  status_type:
    string | null;
  status_name:
    string | null;
  status_detail:
    string | null;
  period:
    number | null;
  display_clock:
    string | null;
  is_started:
    boolean;
  is_final:
    boolean;
};


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

  const configuredSecret =
    process.env
      .NFL_SYNC_SECRET ??
    process.env
      .GRIDIRON_SYNC_SECRET;

  if (!configuredSecret) {
    return false;
  }

  const headerSecret =
    request.headers.get(
      "x-gridiron-sync-secret"
    );

  const authorization =
    request.headers.get(
      "authorization"
    );

  const bearerSecret =
    authorization?.startsWith(
      "Bearer "
    )
      ? authorization.slice(
          7
        )
      : null;

  return (
    headerSecret ===
      configuredSecret ||
    bearerSecret ===
      configuredSecret
  );
}


function toScore(
  value:
    string |
    number |
    null |
    undefined
) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const parsed =
    Number(value);

  if (
    !Number.isFinite(
      parsed
    )
  ) {
    return null;
  }

  return Math.trunc(
    parsed
  );
}


function normalizeTeamName(
  competitor:
    EspnCompetitor |
    undefined
) {
  return (
    competitor?.team
      ?.displayName ??
    competitor?.team
      ?.shortDisplayName ??
    competitor?.team
      ?.abbreviation ??
    null
  );
}


function normalizeEvent(
  event:
    EspnEvent
): NormalizedGame | null {
  const competition =
    event.competitions?.[0];

  if (!competition) {
    return null;
  }

  const eventId =
    event.id ??
    competition.id;

  const kickoffRaw =
    competition.date ??
    event.date;

  if (
    !eventId ||
    !kickoffRaw
  ) {
    return null;
  }

  const kickoff =
    new Date(
      kickoffRaw
    );

  if (
    Number.isNaN(
      kickoff.getTime()
    )
  ) {
    return null;
  }

  const home =
    competition.competitors
      ?.find(
        (row) =>
          row.homeAway ===
          "home"
      );

  const away =
    competition.competitors
      ?.find(
        (row) =>
          row.homeAway ===
          "away"
      );

  const homeName =
    normalizeTeamName(
      home
    );

  const awayName =
    normalizeTeamName(
      away
    );

  if (
    !homeName ||
    !awayName
  ) {
    return null;
  }

  const status =
    competition.status ??
    event.status;

  const state =
    status?.type
      ?.state ??
    null;

  const isFinal =
    status?.type
      ?.completed ===
      true;

  const isStarted =
    isFinal ||
    state === "in" ||
    state === "post";

  return {
    provider_event_id:
      String(
        eventId
      ),

    kickoff_at:
      kickoff.toISOString(),

    away_team_name:
      awayName,

    away_team_abbreviation:
      away?.team
        ?.abbreviation ??
      null,

    home_team_name:
      homeName,

    home_team_abbreviation:
      home?.team
        ?.abbreviation ??
      null,

    away_score:
      toScore(
        away?.score
      ),

    home_score:
      toScore(
        home?.score
      ),

    status_type:
      status?.type
        ?.id ??
      null,

    status_name:
      status?.type
        ?.name ??
      null,

    status_detail:
      status?.type
        ?.detail ??
      status?.type
        ?.shortDetail ??
      status?.type
        ?.description ??
      null,

    period:
      Number.isInteger(
        status?.period
      )
        ? status
            ?.period ??
          null
        : null,

    display_clock:
      status
        ?.displayClock ??
      null,

    is_started:
      isStarted,

    is_final:
      isFinal,
  };
}


function sportsForScope(
  scope:
    FootballScope
) {
  if (
    scope ===
    "college_only"
  ) {
    return [
      "ncaaf",
    ] as const;
  }

  if (
    scope ===
    "nfl_only"
  ) {
    return [
      "nfl",
    ] as const;
  }

  return [
    "ncaaf",
    "nfl",
  ] as const;
}


function yyyymmdd(
  value: Date
) {
  const year =
    value.getUTCFullYear();
  const month =
    String(
      value.getUTCMonth() + 1
    ).padStart(2, "0");
  const day =
    String(
      value.getUTCDate()
    ).padStart(2, "0");

  return `${year}${month}${day}`;
}


function espnScoreboardUrl(
  sport:
    "ncaaf" |
    "nfl",
  slateStartsAt:
    string,
  slateEndsAt:
    string
) {
  const leaguePath =
    sport === "nfl"
      ? "nfl"
      : "college-football";

  const start =
    new Date(
      slateStartsAt
    );

  const endExclusive =
    new Date(
      slateEndsAt
    );

  // ESPN date ranges are calendar-date based and inclusive.
  // Include the UTC calendar day containing the end boundary,
  // then strictly filter events back to [start,end) below.
  return (
    `https://site.api.espn.com/apis/site/v2/sports/football/${leaguePath}/scoreboard` +
    `?dates=${yyyymmdd(start)}-${yyyymmdd(endExclusive)}` +
    `&seasontype=2` +
    `&limit=1000`
  );
}


async function fetchScoreboard(
  sport:
    "ncaaf" |
    "nfl",
  slateStartsAt:
    string,
  slateEndsAt:
    string
) {
  const response =
    await fetch(
      espnScoreboardUrl(
        sport,
        slateStartsAt,
        slateEndsAt
      ),
      {
        method:
          "GET",
        cache:
          "no-store",
        headers: {
          Accept:
            "application/json",
          "User-Agent":
            "Mozilla/5.0 Gridiron365/1.0",
        },
      }
    );

  const text =
    await response.text();

  if (
    !response.ok
  ) {
    throw new Error(
      `ESPN ${sport.toUpperCase()} scoreboard returned HTTP ${response.status}: ${text.slice(
        0,
        180
      )}`
    );
  }

  let payload:
    EspnScoreboard;

  try {
    payload =
      JSON.parse(
        text
      ) as EspnScoreboard;
  } catch {
    throw new Error(
      `ESPN ${sport.toUpperCase()} scoreboard returned invalid JSON.`
    );
  }

  const startMs =
    new Date(
      slateStartsAt
    ).getTime();

  const endMs =
    new Date(
      slateEndsAt
    ).getTime();

  return (
    payload.events ??
    []
  ).filter(
    (event) => {
      const raw =
        event.competitions?.[0]
          ?.date ??
        event.date;

      if (!raw) {
        return false;
      }

      const kickoffMs =
        new Date(
          raw
        ).getTime();

      return (
        Number.isFinite(
          kickoffMs
        ) &&
        kickoffMs >=
          startMs &&
        kickoffMs <
          endMs
      );
    }
  );
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
          "Unauthorized Pick'em game sync request.",
      },
      {
        status:
          401,
      }
    );
  }

  try {
    let body:
      SyncRequestBody = {};

    try {
      body =
        (
          await request.json()
        ) as SyncRequestBody;
    } catch {
      body = {};
    }

    const requestedSeason =
      body.season ===
      undefined
        ? null
        : Number(
            body.season
          );

    const requestedWeek =
      body.week ===
      undefined
        ? null
        : Number(
            body.week
          );

    if (
      requestedSeason !==
        null &&
      (
        !Number.isInteger(
          requestedSeason
        ) ||
        requestedSeason <
          2000 ||
        requestedSeason >
          2200
      )
    ) {
      return NextResponse.json(
        {
          success:
            false,
          error:
            "A valid season is required.",
        },
        {
          status:
            400,
        }
      );
    }

    if (
      requestedWeek !==
        null &&
      (
        !Number.isInteger(
          requestedWeek
        ) ||
        requestedWeek <
          1 ||
        requestedWeek >
          30
      )
    ) {
      return NextResponse.json(
        {
          success:
            false,
          error:
            "A valid Pick'em week is required.",
        },
        {
          status:
            400,
        }
      );
    }

    const supabase =
      createSupabaseAdmin();

    let weeksQuery =
      supabase
        .from(
          "pickem_weeks"
        )
        .select(
          "id,league_id,season,week,status,line_day_at,finalize_not_before,slate_starts_at,slate_ends_at"
        );

    if (
      body.leagueId
    ) {
      weeksQuery =
        weeksQuery.eq(
          "league_id",
          body.leagueId
        );
    } else {
      const now =
        new Date();

      const lower =
        new Date(
          now.getTime() -
          2 *
            24 *
            60 *
            60 *
            1000
        ).toISOString();

      const upper =
        new Date(
          now.getTime() +
          14 *
            24 *
            60 *
            60 *
            1000
        ).toISOString();

      weeksQuery =
        weeksQuery
          .neq(
            "status",
            "final"
          )
          .gte(
            "slate_ends_at",
            lower
          )
          .lte(
            "slate_starts_at",
            upper
          );
    }

    if (
      requestedSeason !==
      null
    ) {
      weeksQuery =
        weeksQuery.eq(
          "season",
          requestedSeason
        );
    }

    if (
      requestedWeek !==
      null
    ) {
      weeksQuery =
        weeksQuery.eq(
          "week",
          requestedWeek
        );
    }

    const {
      data:
        weekData,
      error:
        weekError,
    } =
      await weeksQuery;

    if (
      weekError
    ) {
      throw new Error(
        `Could not load Pick'em weeks: ${weekError.message}`
      );
    }

    const weeks =
      (
        weekData ??
        []
      ) as PickemWeekRow[];

    if (
      weeks.length ===
      0
    ) {
      return NextResponse.json({
        success:
          true,
        source:
          "ESPN",
        weeksProcessed:
          0,
        gamesUpserted:
          0,
        gamesFinal:
          0,
        message:
          "No matching Pick'em weeks are ready for game sync.",
      });
    }

    const leagueIds =
      [
        ...new Set(
          weeks.map(
            (row) =>
              row.league_id
          )
        ),
      ];

    const {
      data:
        settingsData,
      error:
        settingsError,
    } =
      await supabase
        .from(
          "pickem_settings"
        )
        .select(
          "league_id,football_scope"
        )
        .in(
          "league_id",
          leagueIds
        );

    if (
      settingsError
    ) {
      throw new Error(
        `Could not load Pick'em settings: ${settingsError.message}`
      );
    }

    const settingsMap =
      new Map<
        string,
        FootballScope
      >();

    for (
      const row of (
        settingsData ??
        []
      ) as PickemSettingsRow[]
    ) {
      settingsMap.set(
        row.league_id,
        row.football_scope
      );
    }

    const scoreboardCache =
      new Map<
        string,
        EspnEvent[]
      >();

    let gamesUpserted =
      0;
    let gamesFinal =
      0;
    let gamesSkipped =
      0;
    let gradingCalls =
      0;
    let resultRefreshes =
      0;

    const details:
      Array<{
        leagueId:
          string;
        season:
          number;
        week:
          number;
        sport:
          string;
        games:
          number;
      }> = [];

    for (
      const pickemWeek
      of weeks
    ) {
      const scope =
        settingsMap.get(
          pickemWeek.league_id
        );

      if (!scope) {
        gamesSkipped +=
          1;
        continue;
      }

      for (
        const sport
        of sportsForScope(
          scope
        )
      ) {
        if (
          !pickemWeek
            .slate_starts_at ||
          !pickemWeek
            .slate_ends_at
        ) {
          gamesSkipped +=
            1;
          continue;
        }

        const cacheKey =
          `${sport}:${pickemWeek.slate_starts_at}:${pickemWeek.slate_ends_at}`;

        let events =
          scoreboardCache.get(
            cacheKey
          );

        if (!events) {
          events =
            await fetchScoreboard(
              sport,
              pickemWeek.slate_starts_at,
              pickemWeek.slate_ends_at
            );

          scoreboardCache.set(
            cacheKey,
            events
          );
        }

        let sportCount =
          0;

        for (
          const event
          of events
        ) {
          const normalized =
            normalizeEvent(
              event
            );

          if (
            !normalized
          ) {
            gamesSkipped +=
              1;
            continue;
          }

          const now =
            new Date()
              .toISOString();

          const {
            data:
              upsertedData,
            error:
              upsertError,
          } =
            await supabase
              .from(
                "pickem_games"
              )
              .upsert(
                {
                  league_id:
                    pickemWeek.league_id,
                  pickem_week_id:
                    pickemWeek.id,
                  season:
                    pickemWeek.season,
                  week:
                    pickemWeek.week,
                  sport,
                  provider:
                    "espn",
                  ...normalized,
                  last_score_sync_at:
                    now,
                  updated_at:
                    now,
                },
                {
                  onConflict:
                    "league_id,provider,provider_event_id",
                }
              )
              .select(
                "id,is_final"
              )
              .single();

          if (
            upsertError
          ) {
            throw new Error(
              `Could not upsert ESPN ${sport.toUpperCase()} game ${normalized.provider_event_id}: ${upsertError.message}`
            );
          }

          gamesUpserted +=
            1;
          sportCount +=
            1;

          if (
            upsertedData
              ?.is_final ===
            true
          ) {
            gamesFinal +=
              1;

            const {
              error:
                gradingError,
            } =
              await supabase.rpc(
                "grade_pickem_game",
                {
                  p_pickem_game_id:
                    upsertedData.id,
                }
              );

            if (
              gradingError
            ) {
              throw new Error(
                `Could not grade Pick'em game ${upsertedData.id}: ${gradingError.message}`
              );
            }

            gradingCalls +=
              1;
          }
        }

        details.push({
          leagueId:
            pickemWeek.league_id,
          season:
            pickemWeek.season,
          week:
            pickemWeek.week,
          sport,
          games:
            sportCount,
        });
      }

      await supabase
        .from(
          "pickem_weeks"
        )
        .update({
          schedule_synced_at:
            new Date()
              .toISOString(),
          updated_at:
            new Date()
              .toISOString(),
        })
        .eq(
          "id",
          pickemWeek.id
        );

      const {
        error:
          refreshError,
      } =
        await supabase.rpc(
          "refresh_pickem_week_results",
          {
            p_pickem_week_id:
              pickemWeek.id,
          }
        );

      if (
        refreshError
      ) {
        throw new Error(
          `Could not refresh Pick'em week ${pickemWeek.id}: ${refreshError.message}`
        );
      }

      resultRefreshes +=
        1;
    }

    return NextResponse.json({
      success:
        true,
      source:
        "ESPN",
      weeksProcessed:
        weeks.length,
      scoreboardFeedsFetched:
        scoreboardCache.size,
      gamesUpserted,
      gamesFinal,
      gamesSkipped,
      gradingCalls,
      resultRefreshes,
      details,
    });
  } catch (error) {
    console.error(
      "Pick'em ESPN game sync failed:",
      error
    );

    return NextResponse.json(
      {
        success:
          false,
        source:
          "ESPN",
        error:
          error instanceof Error
            ? error.message
            : "Unknown Pick'em ESPN game sync error.",
      },
      {
        status:
          500,
      }
    );
  }
}
