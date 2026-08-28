import {
  NextResponse,
} from "next/server";

import {
  createSupabaseServerClient,
} from "@/lib/supabase/server";

import {
  requireTraditionalLeague,
} from "@/lib/traditional/requireTraditionalLeague";


type RouteContext = {
  params:
    Promise<{
      leagueId: string;
    }>;
};


type SeasonStateRow = {
  active_week:
    number |
    null;
};


type NflGameRow = {
  id: number;

  espn_event_id:
    string |
    null;

  kickoff_at:
    string |
    null;

  status_name:
    string |
    null;

  status_completed:
    boolean |
    null;

  updated_at:
    string |
    null;
};


function isLiveStatus(
  value:
    string |
    null
) {
  const normalized =
    (
      value ??
      ""
    ).toUpperCase();


  return (
    normalized.includes(
      "IN_PROGRESS"
    ) ||
    normalized.includes(
      "HALFTIME"
    ) ||
    normalized.includes(
      "END_PERIOD"
    )
  );
}


function isRefreshCandidate(
  game:
    NflGameRow
) {
  if (
    game.status_completed
  ) {
    return false;
  }


  if (
    isLiveStatus(
      game.status_name
    )
  ) {
    return true;
  }


  if (
    !game.kickoff_at
  ) {
    return false;
  }


  const kickoffMs =
    new Date(
      game.kickoff_at
    ).getTime();


  if (
    !Number.isFinite(
      kickoffMs
    )
  ) {
    return false;
  }


  const nowMs =
    Date.now();


  /*
   * Begin checking shortly before kickoff so a game can
   * transition from scheduled -> live without a manual refresh.
   *
   * Keep checking for six hours after kickoff as a safety window
   * for regulation, delays and overtime.
   */
  const earliestMs =
    kickoffMs -
    20 *
      60 *
      1000;


  const latestMs =
    kickoffMs +
    6 *
      60 *
      60 *
      1000;


  return (
    nowMs >=
      earliestMs &&
    nowMs <=
      latestMs
  );
}


async function callInternalRoute(
  url: string,
  request: Request,
  method:
    "GET" |
    "POST"
) {
  const headers =
    new Headers();


  const cookie =
    request.headers.get(
      "cookie"
    );


  const authorization =
    request.headers.get(
      "authorization"
    );


  if (
    cookie
  ) {
    headers.set(
      "cookie",
      cookie
    );
  }


  if (
    authorization
  ) {
    headers.set(
      "authorization",
      authorization
    );
  }


  const response =
    await fetch(
      url,
      {
        method,
        headers,
        cache:
          "no-store",
      }
    );


  const text =
    await response.text();


  let body:
    unknown =
      null;


  if (
    text
  ) {
    try {
      body =
        JSON.parse(
          text
        );
    } catch {
      body =
        text;
    }
  }


  return {
    ok:
      response.ok,

    status:
      response.status,

    body,
  };
}


export async function POST(
  request: Request,
  context: RouteContext
) {
  try {
    const {
      leagueId,
    } =
      await context.params;


    const access =
      await requireTraditionalLeague(
        leagueId
      );


    const season =
      access.league.season;


    const supabase =
      await createSupabaseServerClient();


    /*
     * =====================================================
     * ACTIVE TRADITIONAL WEEK
     * =====================================================
     */

    const {
      data:
        seasonStateData,

      error:
        seasonStateError,
    } =
      await supabase
        .from(
          "traditional_season_state"
        )
        .select(
          "active_week"
        )
        .eq(
          "league_id",
          leagueId
        )
        .eq(
          "season",
          season
        )
        .maybeSingle();


    if (
      seasonStateError
    ) {
      return NextResponse.json(
        {
          success:
            false,

          error:
            `Could not load active Traditional week: ${seasonStateError.message}`,
        },
        {
          status:
            500,
        }
      );
    }


    const seasonState =
      seasonStateData as
        SeasonStateRow |
        null;


    const activeWeek =
      seasonState
        ?.active_week ??
      1;


    /*
     * =====================================================
     * NFL CONTEXT FOR ACTIVE FANTASY WEEK
     * =====================================================
     *
     * This is critical for QA mappings. A fantasy week may
     * temporarily point at a preseason NFL week. Production
     * weeks continue to resolve to NFL regular season.
     */

    const {
      data: nflContextData,
      error: nflContextError,
    } =
      await supabase.rpc(
        "get_league_nfl_context",
        {
          p_league_id:
            leagueId,

          p_fantasy_season:
            season,

          p_fantasy_week:
            activeWeek,
        }
      );


    if (nflContextError) {
      return NextResponse.json(
        {
          success: false,
          error:
            `Could not resolve NFL context: ${nflContextError.message}`,
        },
        {
          status: 500,
        }
      );
    }


    const rawNflContext =
      Array.isArray(
        nflContextData
      )
        ? nflContextData[0]
        : nflContextData;


    const nflContext =
      rawNflContext as {
        nfl_season?: unknown;
        nfl_season_type?: unknown;
        nfl_week?: unknown;
        qa_override_enabled?: unknown;
      } | null;


    const nflSeason =
      Number(
        nflContext?.nfl_season
      );


    const nflSeasonType =
      Number(
        nflContext?.nfl_season_type
      );


    const nflWeek =
      Number(
        nflContext?.nfl_week
      );


    const qaOverrideEnabled =
      nflContext
        ?.qa_override_enabled ===
      true;


    if (
      !Number.isInteger(
        nflSeason
      ) ||
      !Number.isInteger(
        nflSeasonType
      ) ||
      !Number.isInteger(
        nflWeek
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "The resolved NFL context is invalid.",
        },
        {
          status: 500,
        }
      );
    }


    /*
     * =====================================================
     * NFL GAMES FOR THE RESOLVED CONTEXT
     * =====================================================
     */

    const {
      data:
        gameData,

      error:
        gameError,
    } =
      await supabase
        .from(
          "nfl_games"
        )
        .select(`
          id,
          espn_event_id,
          kickoff_at,
          status_name,
          status_completed,
          updated_at
        `)
        .eq(
          "season",
          nflSeason
        )
        .eq(
          "season_type",
          nflSeasonType
        )
        .eq(
          "week",
          nflWeek
        );


    if (
      gameError
    ) {
      return NextResponse.json(
        {
          success:
            false,

          error:
            `Could not load NFL games: ${gameError.message}`,
        },
        {
          status:
            500,
        }
      );
    }


    const games =
      (
        gameData ??
        []
      ) as NflGameRow[];


    const candidates =
      games.filter(
        isRefreshCandidate
      );


    /*
     * =====================================================
     * LIVE NFL DATA
     * =====================================================
     */

    const origin =
      new URL(
        request.url
      ).origin;


    const syncResults:
      Array<{
        nflGameId:
          number;

        eventId:
          string;

        boxscore:
          unknown;

        playByPlay:
          unknown;
      }> =
        [];


    for (
      const game
      of candidates
    ) {
      if (
        !game.espn_event_id
      ) {
        continue;
      }


      const eventId =
        encodeURIComponent(
          game.espn_event_id
        );


      const [
        boxscore,
        playByPlay,
      ] =
        await Promise.all([
          callInternalRoute(
            `${origin}/api/nfl/sync-live-boxscore?eventId=${eventId}`,
            request,
            "POST"
          ),

          callInternalRoute(
            `${origin}/api/nfl/sync-live-playbyplay?eventId=${eventId}`,
            request,
            "POST"
          ),
        ]);


      syncResults.push({
        nflGameId:
          game.id,

        eventId:
          game.espn_event_id,

        boxscore,

        playByPlay,
      });
    }


    /*
     * =====================================================
     * RECALCULATE FANTASY SCORES
     *
     * The boxscore sync stores fresh NFL player stats.
     * Recalculate the league fantasy score rows next.
     * =====================================================
     */

    const {
      error:
        recalculateError,
    } =
      await supabase.rpc(
        "recalculate_league_fantasy_scores",
        {
          p_league_id:
            leagueId,
        }
      );


    /*
     * =====================================================
     * REFRESH MATCHUP TOTALS
     * =====================================================
     */

    const {
      data:
        refreshedMatchups,

      error:
        matchupRefreshError,
    } =
      await supabase.rpc(
        "refresh_traditional_week_matchups",
        {
          p_league_id:
            leagueId,

          p_season:
            season,

          p_week:
            activeWeek,
        }
      );


    if (
      matchupRefreshError
    ) {
      return NextResponse.json(
        {
          success:
            false,

          error:
            `Could not refresh Traditional matchups: ${matchupRefreshError.message}`,

          season,

          week:
            activeWeek,

          gamesChecked:
            games.length,

          candidateGames:
            candidates.length,

          syncResults,
        },
        {
          status:
            500,
        }
      );
    }


    return NextResponse.json({
      success:
        true,

      leagueId,

      season,

      week:
        activeWeek,

      nflContext: {
        season:
          nflSeason,
        seasonType:
          nflSeasonType,
        week:
          nflWeek,
        qaOverrideEnabled,
      },

      gamesChecked:
        games.length,

      candidateGames:
        candidates.length,

      gamesSynced:
        syncResults.length,

      fantasyScoresRecalculated:
        !recalculateError,

      fantasyScoreError:
        recalculateError
          ?.message ??
        null,

      matchupsRefreshed:
        Number(
          refreshedMatchups ??
          0
        ),

      syncResults,
    });
  } catch (
    error
  ) {
    console.error(
      "Traditional live matchup refresh failed:",
      error
    );


    return NextResponse.json(
      {
        success:
          false,

        error:
          error instanceof Error
            ? error.message
            : "Traditional live matchup refresh failed.",
      },
      {
        status:
          500,
      }
    );
  }
}
