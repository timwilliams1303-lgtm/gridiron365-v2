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


type LeagueRow = {
  id: string;
  season: number;
};


type SettingsRow = {
  league_id: string;
  football_scope:
    FootballScope;
};


type EspnEvent = {
  date?: string;
  competitions?: Array<{
    date?: string;
  }>;
};


type EspnScoreboard = {
  events?: EspnEvent[];
};


type RequestBody = {
  leagueId?: string;
  season?: number;
};


type AnchorResult = {
  sport:
    "ncaaf" | "nfl";
  kickoff:
    string;
};


function createSupabaseAdmin() {
  const url =
    process.env
      .NEXT_PUBLIC_SUPABASE_URL;

  const key =
    process.env
      .SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing Supabase server environment variables."
    );
  }

  return createClient(
    url,
    key,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  );
}


function isAuthorized(
  request: Request
) {
  if (
    process.env.NODE_ENV !==
    "production"
  ) {
    return true;
  }

  const secret =
    process.env
      .GRIDIRON_SYNC_SECRET ??
    process.env
      .NFL_SYNC_SECRET;

  if (!secret) {
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

  const bearer =
    authorization?.startsWith(
      "Bearer "
    )
      ? authorization.slice(7)
      : null;

  return (
    headerSecret === secret ||
    bearer === secret
  );
}


function scoreboardUrl(
  sport: "ncaaf" | "nfl",
  season: number,
  week: number
) {
  const path =
    sport === "nfl"
      ? "nfl"
      : "college-football";

  return (
    `https://site.api.espn.com/apis/site/v2/sports/football/${path}/scoreboard` +
    `?dates=${season}` +
    `&seasontype=2` +
    `&week=${week}` +
    `&limit=1000`
  );
}


async function getWeekAnchor(
  sport: "ncaaf" | "nfl",
  season: number,
  week: number
) {
  const response =
    await fetch(
      scoreboardUrl(
        sport,
        season,
        week
      ),
      {
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

  if (!response.ok) {
    throw new Error(
      `ESPN ${sport.toUpperCase()} Week ${week} returned HTTP ${response.status}: ${text.slice(
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
      `ESPN ${sport.toUpperCase()} Week ${week} returned invalid JSON.`
    );
  }

  const times =
    (
      payload.events ??
      []
    )
      .map(
        (event) =>
          event.competitions?.[0]
            ?.date ??
          event.date ??
          null
      )
      .filter(
        (
          value
        ): value is string =>
          Boolean(value)
      )
      .map(
        (value) =>
          new Date(
            value
          ).getTime()
      )
      .filter(
        Number.isFinite
      );

  if (
    times.length ===
    0
  ) {
    return null;
  }

  return new Date(
    Math.min(
      ...times
    )
  ).toISOString();
}


function getTuesdayStart(
  kickoffIso:
    string
) {
  const kickoff =
    new Date(
      kickoffIso
    );

  if (
    Number.isNaN(
      kickoff.getTime()
    )
  ) {
    throw new Error(
      `Invalid anchor kickoff: ${kickoffIso}`
    );
  }

  /*
   * We want the Tuesday 12:00 AM ET
   * that contains this kickoff in the
   * G365 Pick'em week.
   *
   * Using Intl keeps the calculation
   * aligned with America/New_York DST.
   */
  const formatter =
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone:
          "America/New_York",
        year:
          "numeric",
        month:
          "2-digit",
        day:
          "2-digit",
        weekday:
          "short",
        hour:
          "2-digit",
        minute:
          "2-digit",
        second:
          "2-digit",
        hour12:
          false,
      }
    );

  const parts =
    formatter.formatToParts(
      kickoff
    );

  const values =
    new Map(
      parts.map(
        (part) => [
          part.type,
          part.value,
        ]
      )
    );

  const year =
    Number(
      values.get(
        "year"
      )
    );

  const month =
    Number(
      values.get(
        "month"
      )
    );

  const day =
    Number(
      values.get(
        "day"
      )
    );

  const weekday =
    values.get(
      "weekday"
    );

  const weekdayIndex:
    Record<
      string,
      number
    > = {
      Sun: 0,
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6,
    };

  const currentDayIndex =
    weekday
      ? weekdayIndex[
          weekday
        ]
      : undefined;

  if (
    currentDayIndex ===
    undefined
  ) {
    throw new Error(
      `Could not determine Eastern weekday for ${kickoffIso}.`
    );
  }

  /*
   * Number of days since the most
   * recent Tuesday.
   */
  const daysSinceTuesday =
    (
      currentDayIndex -
      2 +
      7
    ) %
    7;

  /*
   * Start with a UTC calendar date.
   * This is only used to do calendar
   * arithmetic, not as the final
   * timezone-aware instant.
   */
  const calendarDate =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day
      )
    );

  calendarDate.setUTCDate(
    calendarDate.getUTCDate() -
      daysSinceTuesday
  );

  const y =
    calendarDate
      .getUTCFullYear();

  const m =
    String(
      calendarDate
        .getUTCMonth() +
        1
    ).padStart(
      2,
      "0"
    );

  const d =
    String(
      calendarDate
        .getUTCDate()
    ).padStart(
      2,
      "0"
    );

  /*
   * Determine whether that Tuesday
   * midnight is EDT or EST by probing
   * noon UTC on that calendar date.
   */
  const probe =
    new Date(
      `${y}-${m}-${d}T12:00:00Z`
    );

  const offsetFormatter =
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone:
          "America/New_York",
        timeZoneName:
          "shortOffset",
      }
    );

  const offsetPart =
    offsetFormatter
      .formatToParts(
        probe
      )
      .find(
        (part) =>
          part.type ===
          "timeZoneName"
      )
      ?.value;

  const offsetMatch =
    offsetPart?.match(
      /GMT([+-])(\d{1,2})(?::(\d{2}))?/
    );

  if (!offsetMatch) {
    throw new Error(
      `Could not determine Eastern offset for ${y}-${m}-${d}.`
    );
  }

  const sign =
    offsetMatch[1] ===
    "-"
      ? -1
      : 1;

  const offsetHours =
    Number(
      offsetMatch[2]
    );

  const offsetMinutes =
    Number(
      offsetMatch[3] ??
      "0"
    );

  const totalOffsetMinutes =
    sign *
    (
      offsetHours *
        60 +
      offsetMinutes
    );

  const localMidnightAsUtc =
    Date.UTC(
      y,
      Number(m) -
        1,
      Number(d),
      0,
      0,
      0
    );

  const actualUtc =
    new Date(
      localMidnightAsUtc -
        totalOffsetMinutes *
          60 *
          1000
    );

  return actualUtc;
}


function calculateWeekCount(
  firstKickoff:
    string,
  lastKickoff:
    string
) {
  const firstTuesday =
    getTuesdayStart(
      firstKickoff
    );

  const lastTuesday =
    getTuesdayStart(
      lastKickoff
    );

  const diffMs =
    lastTuesday.getTime() -
    firstTuesday.getTime();

  if (
    !Number.isFinite(
      diffMs
    ) ||
    diffMs <
      0
  ) {
    throw new Error(
      "Could not calculate Pick'em contest week count."
    );
  }

  const sevenDaysMs =
    7 *
    24 *
    60 *
    60 *
    1000;

  return (
    Math.round(
      diffMs /
        sevenDaysMs
    ) +
    1
  );
}


async function getLeagueCalendar(
  scope:
    FootballScope,
  season:
    number,
  anchorCache:
    Map<
      string,
      string | null
    >
) {
  async function cachedAnchor(
    sport:
      "ncaaf" | "nfl",
    week:
      number
  ) {
    const key =
      `${sport}:${season}:${week}`;

    let value =
      anchorCache.get(
        key
      );

    if (
      value ===
      undefined
    ) {
      value =
        await getWeekAnchor(
          sport,
          season,
          week
        );

      anchorCache.set(
        key,
        value
      );
    }

    return value;
  }


  const ncaaWeekOne =
    scope ===
      "nfl_only"
      ? null
      : await cachedAnchor(
          "ncaaf",
          1
        );

  const nflWeekOne =
    scope ===
      "college_only"
      ? null
      : await cachedAnchor(
          "nfl",
          1
        );


  if (
    scope ===
    "college_only"
  ) {
    if (!ncaaWeekOne) {
      return null;
    }

    /*
     * Current G365 college contest
     * length remains 16 weeks.
     *
     * The database function receives
     * the explicit count so this is no
     * longer inferred from NFL.
     */
    return {
      anchor: {
        sport:
          "ncaaf",
        kickoff:
          ncaaWeekOne,
      } satisfies AnchorResult,
      weekCount:
        16,
    };
  }


  if (
    scope ===
    "nfl_only"
  ) {
    if (!nflWeekOne) {
      return null;
    }

    return {
      anchor: {
        sport:
          "nfl",
        kickoff:
          nflWeekOne,
      } satisfies AnchorResult,
      weekCount:
        18,
    };
  }


  /*
   * College + NFL:
   *
   * Start with whichever Week 1
   * begins first.
   */
  const availableStarts =
    [
      ncaaWeekOne
        ? {
            sport:
              "ncaaf" as const,
            kickoff:
              ncaaWeekOne,
          }
        : null,

      nflWeekOne
        ? {
            sport:
              "nfl" as const,
            kickoff:
              nflWeekOne,
          }
        : null,
    ].filter(
      (
        value
      ): value is AnchorResult =>
        value !==
        null
    );


  if (
    availableStarts.length ===
    0
  ) {
    return null;
  }


  const firstAnchor =
    availableStarts.reduce(
      (
        earliest,
        current
      ) =>
        new Date(
          current.kickoff
        ).getTime() <
        new Date(
          earliest.kickoff
        ).getTime()
          ? current
          : earliest
    );


  /*
   * NFL Week 18 determines the end
   * of the combined regular-season
   * Pick'em contest.
   */
  const nflWeekEighteen =
    await cachedAnchor(
      "nfl",
      18
    );


  if (!nflWeekEighteen) {
    /*
     * ESPN may not expose Week 18
     * far enough in advance.
     *
     * Preserve a safe fallback:
     * NCAA-starting combined leagues
     * get 19 weeks; NFL-starting
     * combined leagues get 18.
     */
    return {
      anchor:
        firstAnchor,
      weekCount:
        firstAnchor.sport ===
        "ncaaf"
          ? 19
          : 18,
    };
  }


  return {
    anchor:
      firstAnchor,

    weekCount:
      calculateWeekCount(
        firstAnchor.kickoff,
        nflWeekEighteen
      ),
  };
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
          "Unauthorized Pick'em lifecycle request.",
      },
      {
        status:
          401,
      }
    );
  }


  try {
    let body:
      RequestBody = {};

    try {
      body =
        (
          await request.json()
        ) as RequestBody;
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


    const supabase =
      createSupabaseAdmin();


    let leagueQuery =
      supabase
        .from(
          "leagues"
        )
        .select(
          "id,season"
        )
        .eq(
          "league_type",
          "pickem"
        );


    if (
      body.leagueId
    ) {
      leagueQuery =
        leagueQuery.eq(
          "id",
          body.leagueId
        );
    }


    if (
      requestedSeason !==
      null
    ) {
      leagueQuery =
        leagueQuery.eq(
          "season",
          requestedSeason
        );
    }


    const {
      data:
        leagueData,
      error:
        leagueError,
    } =
      await leagueQuery;


    if (
      leagueError
    ) {
      throw new Error(
        leagueError.message
      );
    }


    const leagues =
      (
        leagueData ??
        []
      ) as LeagueRow[];


    if (
      leagues.length ===
      0
    ) {
      return NextResponse.json({
        success:
          true,
        leaguesProcessed:
          0,
        weeksPrepared:
          0,
      });
    }


    const ids =
      leagues.map(
        (league) =>
          league.id
      );


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
          ids
        );


    if (
      settingsError
    ) {
      throw new Error(
        settingsError.message
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
      ) as SettingsRow[]
    ) {
      settingsMap.set(
        row.league_id,
        row.football_scope
      );
    }


    /*
     * ESPN schedule responses are
     * shared across every Pick'em
     * league for the same sport,
     * season, and week during this
     * lifecycle invocation.
     */
    const anchorCache =
      new Map<
        string,
        string | null
      >();


    let weeksPrepared =
      0;


    const details:
      Array<{
        leagueId:
          string;
        season:
          number;
        footballScope:
          FootballScope;
        anchorSport:
          "ncaaf" |
          "nfl" |
          null;
        anchorKickoff:
          string |
          null;
        weekCount:
          number;
        weeksPrepared:
          number;
      }> = [];


    for (
      const league
      of leagues
    ) {
      const scope =
        settingsMap.get(
          league.id
        );


      if (!scope) {
        continue;
      }


      const calendar =
        await getLeagueCalendar(
          scope,
          league.season,
          anchorCache
        );


      if (!calendar) {
        details.push({
          leagueId:
            league.id,
          season:
            league.season,
          footballScope:
            scope,
          anchorSport:
            null,
          anchorKickoff:
            null,
          weekCount:
            0,
          weeksPrepared:
            0,
        });

        continue;
      }


      const {
        data,
        error,
      } =
        await supabase.rpc(
          "ensure_pickem_season_weeks",
          {
            p_league_id:
              league.id,
            p_season:
              league.season,
            p_anchor_kickoff:
              calendar.anchor
                .kickoff,
            p_week_count:
              calendar.weekCount,
          }
        );


      if (
        error
      ) {
        throw new Error(
          `Could not prepare Pick'em weeks for ${league.id}: ${error.message}`
        );
      }


      const prepared =
        Number(
          (
            data as {
              weeksPrepared?:
                number;
            } | null
          )
            ?.weeksPrepared ??
          0
        );


      weeksPrepared +=
        prepared;


      details.push({
        leagueId:
          league.id,
        season:
          league.season,
        footballScope:
          scope,
        anchorSport:
          calendar.anchor
            .sport,
        anchorKickoff:
          calendar.anchor
            .kickoff,
        weekCount:
          calendar.weekCount,
        weeksPrepared:
          prepared,
      });
    }


    return NextResponse.json({
      success:
        true,
      source:
        "ESPN",
      leaguesProcessed:
        leagues.length,
      weeksPrepared,
      scheduleFeedsFetched:
        anchorCache.size,
      details,
    });
  } catch (
    error
  ) {
    console.error(
      "Pick'em automatic lifecycle preparation failed:",
      error
    );


    return NextResponse.json(
      {
        success:
          false,
        source:
          "ESPN",
        error:
          error instanceof
          Error
            ? error.message
            : "Unknown Pick'em lifecycle error.",
      },
      {
        status:
          500,
      }
    );
  }
}