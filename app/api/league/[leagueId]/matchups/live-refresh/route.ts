import {
  NextResponse,
} from "next/server";

import {
  createSupabaseServerClient,
} from "@/lib/supabase/server";


type RouteContext = {
  params:
    Promise<{
      leagueId: string;
    }>;
};


type LeagueRow = {
  id: string;

  season: number;

  league_type: string;
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
};


function jsonError(
  error: string,
  status: number
) {
  return NextResponse.json(
    {
      success:
        false,

      error,
    },
    {
      status,
    }
  );
}


function isLiveStatus(
  statusName:
    string |
    null
) {
  const value =
    (
      statusName ??
      ""
    )
      .trim()
      .toUpperCase();


  return (
    value.includes(
      "IN_PROGRESS"
    ) ||
    value.includes(
      "HALFTIME"
    ) ||
    value.includes(
      "END_PERIOD"
    )
  );
}


function isRefreshCandidate(
  game:
    NflGameRow
) {
  if (
    game.status_completed ===
    true
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


  const kickoff =
    new Date(
      game.kickoff_at
    );


  const kickoffMs =
    kickoff.getTime();


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
   * Begin checking slightly before kickoff so scheduled games
   * can transition to live automatically.
   */
  const startsCheckingAt =
    kickoffMs -
    20 *
      60 *
      1000;


  /*
   * Six-hour window handles normal games, delays and overtime.
   */
  const stopsCheckingAt =
    kickoffMs +
    6 *
      60 *
      60 *
      1000;


  return (
    nowMs >=
      startsCheckingAt &&
    nowMs <=
      stopsCheckingAt
  );
}


async function callInternalSyncRoute(
  url: string,
  request: Request
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


  headers.set(
    "Accept",
    "application/json"
  );


  try {
    const response =
      await fetch(
        url,
        {
          method:
            "POST",

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
      success:
        response.ok,

      status:
        response.status,

      body,
    };
  } catch (
    error
  ) {
    return {
      success:
        false,

      status:
        500,

      body:
        error instanceof Error
          ? error.message
          : "Internal sync request failed.",
    };
  }
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


    if (
      !leagueId
    ) {
      return jsonError(
        "A valid league ID is required.",
        400
      );
    }


    const supabase =
      await createSupabaseServerClient();


    /*
     * =====================================================
     * AUTH
     * =====================================================
     */

    const {
      data:
        authData,

      error:
        authError,
    } =
      await supabase
        .auth
        .getUser();


    const user =
      authData.user;


    if (
      authError ||
      !user
    ) {
      return jsonError(
        "You must be signed in.",
        401
      );
    }


    /*
     * =====================================================
     * LEAGUE
     *
     * The authenticated Supabase client + RLS determines
     * whether the user is permitted to read this league.
     * =====================================================
     */

    const {
      data:
        leagueData,

      error:
        leagueError,
    } =
      await supabase
        .from(
          "leagues"
        )
        .select(`
          id,
          season,
          league_type
        `)
        .eq(
          "id",
          leagueId
        )
        .maybeSingle();


    if (
      leagueError
    ) {
      return jsonError(
        `Could not load league: ${leagueError.message}`,
        500
      );
    }


    if (
      !leagueData
    ) {
      return jsonError(
        "League was not found or you do not have access.",
        404
      );
    }


    const league =
      leagueData as
        LeagueRow;


    if (
      league.league_type !==
      "traditional"
    ) {
      return jsonError(
        "Live Traditional matchup refresh is not available for this league type.",
        400
      );
    }


    const season =
      league.season;


    /*
     * =====================================================
     * ACTIVE FANTASY WEEK
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
      return jsonError(
        `Could not load active Traditional week: ${seasonStateError.message}`,
        500
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
     * CURRENT NFL WEEK GAMES
     *
     * season_type 2 = NFL regular season.
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
          status_completed
        `)
        .eq(
          "season",
          season
        )
        .eq(
          "season_type",
          2
        )
        .eq(
          "week",
          activeWeek
        );


    if (
      gameError
    ) {
      return jsonError(
        `Could not load NFL games: ${gameError.message}`,
        500
      );
    }


    const games =
      (
        gameData ??
        []
      ) as
        NflGameRow[];


    const candidateGames =
      games.filter(
        isRefreshCandidate
      );


    /*
     * =====================================================
     * ESPN LIVE SYNC
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
      of candidateGames
    ) {
      const rawEventId =
        game.espn_event_id;


      if (
        !rawEventId
      ) {
        continue;
      }


      const eventId =
        encodeURIComponent(
          rawEventId
        );


      const [
        boxscore,
        playByPlay,
      ] =
        await Promise.all([
          callInternalSyncRoute(
            `${origin}/api/nfl/sync-live-boxscore?eventId=${eventId}`,
            request
          ),

          callInternalSyncRoute(
            `${origin}/api/nfl/sync-live-playbyplay?eventId=${eventId}`,
            request
          ),
        ]);


      syncResults.push({
        nflGameId:
          game.id,

        eventId:
          rawEventId,

        boxscore,

        playByPlay,
      });
    }


    /*
     * =====================================================
     * FANTASY SCORE RECALCULATION
     * =====================================================
     */

    const {
      error:
        fantasyScoreError,
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
     * MATCHUP TOTAL REFRESH
     * =====================================================
     */

    const {
      data:
        refreshedMatchups,

      error:
        matchupError,
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
      matchupError
    ) {
      return NextResponse.json(
        {
          success:
            false,

          error:
            `Could not refresh matchup totals: ${matchupError.message}`,

          leagueId,

          season,

          week:
            activeWeek,

          gamesChecked:
            games.length,

          candidateGames:
            candidateGames.length,

          gamesSynced:
            syncResults.length,

          fantasyScoresRecalculated:
            !fantasyScoreError,

          fantasyScoreError:
            fantasyScoreError
              ?.message ??
            null,

          syncResults,
        },
        {
          status:
            500,
        }
      );
    }


    /*
     * =====================================================
     * SUCCESS
     * =====================================================
     */

    return NextResponse.json({
      success:
        true,

      leagueId,

      season,

      week:
        activeWeek,

      gamesChecked:
        games.length,

      candidateGames:
        candidateGames.length,

      gamesSynced:
        syncResults.length,

      fantasyScoresRecalculated:
        !fantasyScoreError,

      fantasyScoreError:
        fantasyScoreError
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