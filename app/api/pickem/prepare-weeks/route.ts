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


function anchorSport(
  scope: FootballScope
) {
  return scope === "college_only"
    ? "ncaaf"
    : "nfl";
}


function scoreboardUrl(
  sport: "ncaaf" | "nfl",
  season: number
) {
  const path =
    sport === "nfl"
      ? "nfl"
      : "college-football";

  return (
    `https://site.api.espn.com/apis/site/v2/sports/football/${path}/scoreboard` +
    `?dates=${season}` +
    `&seasontype=2` +
    `&week=1` +
    `&limit=1000`
  );
}


async function getWeekOneAnchor(
  sport: "ncaaf" | "nfl",
  season: number
) {
  const response =
    await fetch(
      scoreboardUrl(
        sport,
        season
      ),
      {
        cache: "no-store",
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
      `ESPN ${sport.toUpperCase()} Week 1 returned HTTP ${response.status}: ${text.slice(0, 180)}`
    );
  }

  const payload =
    JSON.parse(
      text
    ) as EspnScoreboard;

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
          new Date(value)
            .getTime()
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


export async function POST(
  request: Request
) {
  if (
    !isAuthorized(
      request
    )
  ) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Unauthorized Pick'em lifecycle request.",
      },
      {
        status: 401,
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

    const supabase =
      createSupabaseAdmin();

    let leagueQuery =
      supabase
        .from("leagues")
        .select(
          "id,season"
        )
        .eq(
          "league_type",
          "pickem"
        );

    if (body.leagueId) {
      leagueQuery =
        leagueQuery.eq(
          "id",
          body.leagueId
        );
    }

    if (
      body.season !==
      undefined
    ) {
      leagueQuery =
        leagueQuery.eq(
          "season",
          Number(
            body.season
          )
        );
    }

    const {
      data: leagueData,
      error: leagueError,
    } =
      await leagueQuery;

    if (leagueError) {
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
        success: true,
        leaguesProcessed: 0,
        weeksPrepared: 0,
      });
    }

    const ids =
      leagues.map(
        (league) =>
          league.id
      );

    const {
      data: settingsData,
      error: settingsError,
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

    if (settingsError) {
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

    const anchorCache =
      new Map<
        string,
        string | null
      >();

    let weeksPrepared =
      0;

    const details:
      Array<{
        leagueId: string;
        season: number;
        anchorSport:
          "ncaaf" | "nfl";
        anchorKickoff:
          string | null;
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

      const sport =
        anchorSport(
          scope
        );

      const key =
        `${sport}:${league.season}`;

      let anchor =
        anchorCache.get(
          key
        );

      if (
        anchor ===
        undefined
      ) {
        anchor =
          await getWeekOneAnchor(
            sport,
            league.season
          );

        anchorCache.set(
          key,
          anchor
        );
      }

      if (!anchor) {
        details.push({
          leagueId:
            league.id,
          season:
            league.season,
          anchorSport:
            sport,
          anchorKickoff:
            null,
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
              anchor,
          }
        );

      if (error) {
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
          )?.weeksPrepared ??
          0
        );

      weeksPrepared +=
        prepared;

      details.push({
        leagueId:
          league.id,
        season:
          league.season,
        anchorSport:
          sport,
        anchorKickoff:
          anchor,
        weeksPrepared:
          prepared,
      });
    }

    return NextResponse.json({
      success: true,
      source: "ESPN",
      leaguesProcessed:
        leagues.length,
      weeksPrepared,
      details,
    });
  } catch (error) {
    console.error(
      "Pick'em automatic lifecycle preparation failed:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        source: "ESPN",
        error:
          error instanceof Error
            ? error.message
            : "Unknown Pick'em lifecycle error.",
      },
      {
        status: 500,
      }
    );
  }
}
