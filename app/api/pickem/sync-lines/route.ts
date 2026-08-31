import {
  NextResponse,
} from "next/server";

import {
  createClient,
} from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 300;


type RequestBody = {
  leagueId?: string;
  week?: number;
  preview?: boolean;
};


type PickemWeekRow = {
  id: number;
  league_id: string;
  season: number;
  week: number;
  line_day_at: string | null;
  slate_starts_at: string | null;
  slate_ends_at: string | null;
  line_sync_completed_at: string | null;
};


type PickemGameRow = {
  id: number;
  league_id: string;
  pickem_week_id: number;
  sport: "ncaaf" | "nfl";
  kickoff_at: string;
  away_team_name: string;
  home_team_name: string;
  spread_status: "pending" | "published" | "frozen" | "excluded";
  is_started: boolean;
  is_final: boolean;
};


type OddsOutcome = {
  name?: string;
  price?: number;
  point?: number;
};


type OddsMarket = {
  key?: string;
  last_update?: string;
  outcomes?: OddsOutcome[];
};


type OddsBookmaker = {
  key?: string;
  title?: string;
  last_update?: string;
  markets?: OddsMarket[];
};


type OddsEvent = {
  id?: string;
  sport_key?: string;
  commence_time?: string;
  home_team?: string;
  away_team?: string;
  bookmakers?: OddsBookmaker[];
};


type SyncResult = {
  weeksDue: number;
  weeksCompleted: number;
  gamesReviewed: number;
  gamesMatched: number;
  gamesFrozen: number;
  gamesExcluded: number;
  sourceLinesInserted: number;
  unmatchedGames: number;
  providerRequests: number;
  requestCreditsUsed: number | null;
  requestCreditsRemaining: number | null;
};


const ODDS_SPORT_KEYS = {
  nfl: "americanfootball_nfl",
  ncaaf: "americanfootball_ncaaf",
} as const;


function getEnv() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  const syncSecret =
    process.env.GRIDIRON_SYNC_SECRET ??
    process.env.NFL_SYNC_SECRET;

  const oddsApiKey =
    process.env.THE_ODDS_API_KEY;

  if (
    !supabaseUrl ||
    !serviceRoleKey ||
    !syncSecret ||
    !oddsApiKey
  ) {
    throw new Error(
      "Required Pick'em line-sync environment variables are missing. THE_ODDS_API_KEY must be configured."
    );
  }

  return {
    supabaseUrl,
    serviceRoleKey,
    syncSecret,
    oddsApiKey,
  };
}


function normalizeTeamName(
  value: string
) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\(oh\)/g, " ohio ")
    .replace(/\(pa\)/g, " pennsylvania ")
    .replace(/\(fl\)/g, " florida ")
    .replace(/\(ca\)/g, " california ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\buniversity\b/g, " ")
    .replace(/\bthe\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}


function tokenSimilarity(
  left: string,
  right: string
) {
  const leftNormalized =
    normalizeTeamName(left);
  const rightNormalized =
    normalizeTeamName(right);

  if (
    !leftNormalized ||
    !rightNormalized
  ) {
    return 0;
  }

  if (
    leftNormalized ===
    rightNormalized
  ) {
    return 1;
  }

  if (
    leftNormalized.includes(
      rightNormalized
    ) ||
    rightNormalized.includes(
      leftNormalized
    )
  ) {
    return 0.92;
  }

  const leftTokens =
    new Set(
      leftNormalized.split(" ")
    );
  const rightTokens =
    new Set(
      rightNormalized.split(" ")
    );

  let intersection = 0;

  for (
    const token of leftTokens
  ) {
    if (
      rightTokens.has(token)
    ) {
      intersection += 1;
    }
  }

  const union =
    new Set([
      ...leftTokens,
      ...rightTokens,
    ]).size;

  return union > 0
    ? intersection / union
    : 0;
}


function findMatchingOddsEventDetailed(
  game: PickemGameRow,
  events: OddsEvent[]
) {
  const kickoff =
    new Date(
      game.kickoff_at
    ).getTime();

  let best:
    OddsEvent | null =
      null;
  let bestScore = 0;

  for (
    const event of events
  ) {
    if (
      !event.home_team ||
      !event.away_team ||
      !event.commence_time
    ) {
      continue;
    }

    const providerKickoff =
      new Date(
        event.commence_time
      ).getTime();

    if (
      !Number.isFinite(
        providerKickoff
      ) ||
      Math.abs(
        providerKickoff -
        kickoff
      ) >
        6 * 60 * 60 * 1000
    ) {
      continue;
    }

    const homeScore =
      tokenSimilarity(
        game.home_team_name,
        event.home_team
      );

    const awayScore =
      tokenSimilarity(
        game.away_team_name,
        event.away_team
      );

    const combined =
      homeScore + awayScore;

    if (
      homeScore >= 0.45 &&
      awayScore >= 0.45 &&
      combined > bestScore
    ) {
      best = event;
      bestScore = combined;
    }
  }

  if (
    bestScore < 1.15 ||
    !best
  ) {
    return null;
  }

  const providerKickoff =
    new Date(
      best.commence_time ??
        ""
    ).getTime();

  return {
    event: best,
    score: bestScore,
    homeSimilarity:
      tokenSimilarity(
        game.home_team_name,
        best.home_team ??
          ""
      ),
    awaySimilarity:
      tokenSimilarity(
        game.away_team_name,
        best.away_team ??
          ""
      ),
    kickoffDifferenceMinutes:
      Number.isFinite(
        providerKickoff
      )
        ? Math.round(
            Math.abs(
              providerKickoff -
                kickoff
            ) /
              60000
          )
        : null,
  };
}


function getBookmakerSpreads(
  event: OddsEvent
) {
  const spreads:
    Array<{
      sportsbookKey: string;
      sportsbookName: string;
      homeSpread: number;
      awaySpread: number | null;
    }> = [];

  for (
    const bookmaker of
    event.bookmakers ?? []
  ) {
    const spreadMarket =
      (
        bookmaker.markets ??
        []
      ).find(
        (market) =>
          market.key ===
          "spreads"
      );

    if (!spreadMarket) {
      continue;
    }

    const homeOutcome =
      (
        spreadMarket.outcomes ??
        []
      ).find(
        (outcome) =>
          outcome.name ===
          event.home_team
      );

    const awayOutcome =
      (
        spreadMarket.outcomes ??
        []
      ).find(
        (outcome) =>
          outcome.name ===
          event.away_team
      );

    if (
      !bookmaker.key ||
      typeof homeOutcome?.point !==
        "number" ||
      !Number.isFinite(
        homeOutcome.point
      )
    ) {
      continue;
    }

    spreads.push({
      sportsbookKey:
        bookmaker.key,
      sportsbookName:
        bookmaker.title ??
        bookmaker.key,
      homeSpread:
        homeOutcome.point,
      awaySpread:
        typeof awayOutcome?.point ===
          "number"
          ? awayOutcome.point
          : -homeOutcome.point,
    });
  }

  return spreads;
}


function median(
  values: number[]
) {
  if (values.length === 0) {
    return null;
  }

  const sorted =
    [...values].sort(
      (a, b) => a - b
    );

  const middle =
    Math.floor(
      sorted.length / 2
    );

  if (
    sorted.length % 2 === 1
  ) {
    return sorted[middle];
  }

  return (
    sorted[middle - 1] +
    sorted[middle]
  ) / 2;
}


async function fetchOdds(
  apiKey: string,
  sport: "ncaaf" | "nfl",
  from: string,
  to: string
) {
  const url =
    new URL(
      `https://api.the-odds-api.com/v4/sports/${ODDS_SPORT_KEYS[sport]}/odds`
    );

  url.searchParams.set(
    "apiKey",
    apiKey
  );
  url.searchParams.set(
    "regions",
    "us"
  );
  url.searchParams.set(
    "markets",
    "spreads"
  );
  url.searchParams.set(
    "oddsFormat",
    "american"
  );
  url.searchParams.set(
    "dateFormat",
    "iso"
  );
  url.searchParams.set(
    "commenceTimeFrom",
    from
  );
  url.searchParams.set(
    "commenceTimeTo",
    to
  );

  const response =
    await fetch(
      url,
      {
        method: "GET",
        cache: "no-store",
      }
    );

  const text =
    await response.text();

  let data:
    unknown = null;

  try {
    data = JSON.parse(text);
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw new Error(
      `The Odds API ${sport.toUpperCase()} request failed with HTTP ${response.status}: ${text.slice(0, 300)}`
    );
  }

  return {
    events:
      Array.isArray(data)
        ? data as OddsEvent[]
        : [],
    used:
      Number(
        response.headers.get(
          "x-requests-used"
        )
      ),
    remaining:
      Number(
        response.headers.get(
          "x-requests-remaining"
        )
      ),
  };
}


export async function POST(
  request: Request
) {
  try {
    const {
      supabaseUrl,
      serviceRoleKey,
      syncSecret,
      oddsApiKey,
    } = getEnv();

    const suppliedSecret =
      request.headers.get(
        "x-gridiron-sync-secret"
      );

    if (
      !suppliedSecret ||
      suppliedSecret !==
        syncSecret
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Unauthorized Pick'em line sync request.",
        },
        {
          status: 401,
        }
      );
    }

    let body:
      RequestBody = {};

    try {
      body =
        await request.json() as RequestBody;
    } catch {
      body = {};
    }

    const preview =
      body.preview === true;

    const requestedWeek =
      typeof body.week ===
        "number" &&
      Number.isInteger(
        body.week
      )
        ? body.week
        : null;

    if (
      preview &&
      !body.leagueId
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Preview mode requires leagueId so an accidental global sportsbook preview cannot consume unnecessary API credits.",
        },
        {
          status: 400,
        }
      );
    }

    const supabase =
      createClient(
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

    const now =
      new Date();
    const nowIso =
      now.toISOString();

    let weeksQuery =
      supabase
        .from(
          "pickem_weeks"
        )
        .select(
          "id,league_id,season,week,line_day_at,slate_starts_at,slate_ends_at,line_sync_completed_at"
        )
        .neq(
          "status",
          "final"
        );

    if (!preview) {
      weeksQuery =
        weeksQuery
          .not(
            "line_day_at",
            "is",
            null
          )
          .lte(
            "line_day_at",
            nowIso
          )
          .is(
            "line_sync_completed_at",
            null
          );
    }

    if (body.leagueId) {
      weeksQuery =
        weeksQuery.eq(
          "league_id",
          body.leagueId
        );
    }

    if (
      preview &&
      requestedWeek !== null
    ) {
      weeksQuery =
        weeksQuery.eq(
          "week",
          requestedWeek
        );
    }

    if (
      preview &&
      requestedWeek === null
    ) {
      weeksQuery =
        weeksQuery
          .order(
            "week",
            {
              ascending: true,
            }
          )
          .limit(1);
    }

    const {
      data: weeksData,
      error: weeksError,
    } = await weeksQuery;

    if (weeksError) {
      throw new Error(
        weeksError.message
      );
    }

    const weeks =
      (
        weeksData ??
        []
      ) as PickemWeekRow[];

    if (
      weeks.length === 0
    ) {
      return NextResponse.json(
        {
          success: true,
          provider:
            "the-odds-api",
          message:
            preview
              ? "No Pick'em week was available for sportsbook matching preview."
              : "No Pick'em weeks are due for G365 Line Day processing.",
          preview,
          weeksDue: 0,
        }
      );
    }

    const weekIds =
      weeks.map(
        (week) =>
          week.id
      );

    const {
      data: gamesData,
      error: gamesError,
    } =
      await supabase
        .from(
          "pickem_games"
        )
        .select(
          "id,league_id,pickem_week_id,sport,kickoff_at,away_team_name,home_team_name,spread_status,is_started,is_final"
        )
        .in(
          "pickem_week_id",
          weekIds
        )
        .eq(
          "is_started",
          false
        )
        .eq(
          "is_final",
          false
        );

    if (gamesError) {
      throw new Error(
        gamesError.message
      );
    }

    const games =
      (
        gamesData ??
        []
      ) as PickemGameRow[];

    const result:
      SyncResult = {
        weeksDue:
          weeks.length,
        weeksCompleted:
          0,
        gamesReviewed:
          games.length,
        gamesMatched:
          0,
        gamesFrozen:
          0,
        gamesExcluded:
          0,
        sourceLinesInserted:
          0,
        unmatchedGames:
          0,
        providerRequests:
          0,
        requestCreditsUsed:
          null,
        requestCreditsRemaining:
          null,
      };

    if (
      games.length === 0
    ) {
      return NextResponse.json(
        {
          success: false,
          provider:
            "the-odds-api",
          error:
            "A Pick'em week reached Line Day before its ESPN game slate was available. The cron will retry automatically.",
          ...result,
        },
        {
          status: 409,
        }
      );
    }

    if (!preview) {
      await supabase
        .from(
          "pickem_weeks"
        )
        .update({
          line_sync_started_at:
            nowIso,
          line_sync_provider:
            "the-odds-api",
        })
        .in(
          "id",
          weekIds
        );
    }

    const kickoffTimes =
      games
        .map(
          (game) =>
            new Date(
              game.kickoff_at
            ).getTime()
        )
        .filter(
          Number.isFinite
        );

    const minKickoff =
      Math.min(
        ...kickoffTimes
      );
    const maxKickoff =
      Math.max(
        ...kickoffTimes
      );

    const from =
      new Date(
        minKickoff -
        6 * 60 * 60 * 1000
      ).toISOString();
    const to =
      new Date(
        maxKickoff +
        6 * 60 * 60 * 1000
      ).toISOString();

    const sports =
      Array.from(
        new Set(
          games.map(
            (game) =>
              game.sport
          )
        )
      );

    const oddsBySport:
      Record<
        "ncaaf" | "nfl",
        OddsEvent[]
      > = {
        ncaaf: [],
        nfl: [],
      };

    for (
      const sport of sports
    ) {
      const response =
        await fetchOdds(
          oddsApiKey,
          sport,
          from,
          to
        );

      oddsBySport[sport] =
        response.events;
      result.providerRequests +=
        1;

      if (
        Number.isFinite(
          response.used
        )
      ) {
        result.requestCreditsUsed =
          response.used;
      }

      if (
        Number.isFinite(
          response.remaining
        )
      ) {
        result.requestCreditsRemaining =
          response.remaining;
      }
    }

    if (preview) {
      const previewGames =
        games.map(
          (game) => {
            const match =
              findMatchingOddsEventDetailed(
                game,
                oddsBySport[
                  game.sport
                ]
              );

            if (!match) {
              return {
                gameId:
                  game.id,
                weekId:
                  game.pickem_week_id,
                sport:
                  game.sport,
                status:
                  "UNMATCHED",
                espnAwayTeam:
                  game.away_team_name,
                espnHomeTeam:
                  game.home_team_name,
                espnKickoff:
                  game.kickoff_at,
                providerAwayTeam:
                  null,
                providerHomeTeam:
                  null,
                providerKickoff:
                  null,
                kickoffDifferenceMinutes:
                  null,
                homeSimilarity:
                  null,
                awaySimilarity:
                  null,
                matchScore:
                  null,
                sportsbookCount:
                  0,
                proposedG365HomeSpread:
                  null,
              };
            }

            const spreads =
              getBookmakerSpreads(
                match.event
              );

            return {
              gameId:
                game.id,
              weekId:
                game.pickem_week_id,
              sport:
                game.sport,
              status:
                "MATCHED",
              espnAwayTeam:
                game.away_team_name,
              espnHomeTeam:
                game.home_team_name,
              espnKickoff:
                game.kickoff_at,
              providerAwayTeam:
                match.event
                  .away_team ??
                null,
              providerHomeTeam:
                match.event
                  .home_team ??
                null,
              providerKickoff:
                match.event
                  .commence_time ??
                null,
              kickoffDifferenceMinutes:
                match
                  .kickoffDifferenceMinutes,
              homeSimilarity:
                Number(
                  match.homeSimilarity
                    .toFixed(3)
                ),
              awaySimilarity:
                Number(
                  match.awaySimilarity
                    .toFixed(3)
                ),
              matchScore:
                Number(
                  match.score.toFixed(
                    3
                  )
                ),
              sportsbookCount:
                spreads.length,
              proposedG365HomeSpread:
                median(
                  spreads.map(
                    (spread) =>
                      spread.homeSpread
                  )
                ),
            };
          }
        );

      const matched =
        previewGames.filter(
          (game) =>
            game.status ===
            "MATCHED"
        ).length;

      return NextResponse.json(
        {
          success: true,
          preview: true,
          readOnly: true,
          provider:
            "the-odds-api",
          leagueId:
            body.leagueId,
          requestedWeek,
          weeksReviewed:
            weeks.map(
              (week) => ({
                id: week.id,
                season:
                  week.season,
                week: week.week,
                lineDayAt:
                  week.line_day_at,
                slateStartsAt:
                  week.slate_starts_at,
                slateEndsAt:
                  week.slate_ends_at,
              })
            ),
          gamesReviewed:
            previewGames.length,
          gamesMatched:
            matched,
          gamesUnmatched:
            previewGames.length -
            matched,
          matchRate:
            previewGames.length > 0
              ? Number(
                  (
                    matched /
                    previewGames.length
                  ).toFixed(4)
                )
              : 0,
          providerRequests:
            result.providerRequests,
          requestCreditsUsed:
            result.requestCreditsUsed,
          requestCreditsRemaining:
            result.requestCreditsRemaining,
          games:
            previewGames,
        }
      );
    }

    const weekFailures =
      new Set<number>();

    for (
      const game of games
    ) {
      if (
        game.spread_status ===
          "frozen"
      ) {
        continue;
      }

      const match =
        findMatchingOddsEventDetailed(
          game,
          oddsBySport[
            game.sport
          ]
        );

      const event =
        match?.event ??
        null;

      if (!event) {
        result.unmatchedGames +=
          1;

        await supabase
          .from(
            "pickem_games"
          )
          .update({
            spread_status:
              "excluded",
            is_eligible:
              false,
            exclusion_reason:
              "No trustworthy matching sportsbook event was available from The Odds API on G365 Line Day.",
            updated_at:
              nowIso,
          })
          .eq(
            "id",
            game.id
          );

        result.gamesExcluded +=
          1;
        continue;
      }

      result.gamesMatched +=
        1;

      const sourceRows:
        Array<{
          pickem_game_id: number;
          captured_at: string;
          source_provider: string;
          sportsbook_key: string;
          sportsbook_name: string | null;
          home_spread: number;
          away_spread: number | null;
          source_event_id: string | null;
          source_market_key: string;
          raw_audit: Record<string, unknown>;
        }> = [];

      for (
        const bookmaker of
        event.bookmakers ?? []
      ) {
        const spreadMarket =
          (
            bookmaker.markets ??
            []
          ).find(
            (market) =>
              market.key ===
              "spreads"
          );

        if (!spreadMarket) {
          continue;
        }

        const homeOutcome =
          (
            spreadMarket.outcomes ??
            []
          ).find(
            (outcome) =>
              outcome.name ===
              event.home_team
          );

        const awayOutcome =
          (
            spreadMarket.outcomes ??
            []
          ).find(
            (outcome) =>
              outcome.name ===
              event.away_team
          );

        if (
          !bookmaker.key ||
          typeof homeOutcome?.point !==
            "number" ||
          !Number.isFinite(
            homeOutcome.point
          )
        ) {
          continue;
        }

        sourceRows.push({
          pickem_game_id:
            game.id,
          captured_at:
            nowIso,
          source_provider:
            "the-odds-api",
          sportsbook_key:
            bookmaker.key,
          sportsbook_name:
            bookmaker.title ??
            bookmaker.key,
          home_spread:
            homeOutcome.point,
          away_spread:
            typeof awayOutcome?.point ===
              "number"
              ? awayOutcome.point
              : -homeOutcome.point,
          source_event_id:
            event.id ??
            null,
          source_market_key:
            "spreads",
          raw_audit: {
            provider:
              "the-odds-api",
            providerSportKey:
              event.sport_key ??
              ODDS_SPORT_KEYS[
                game.sport
              ],
            providerEventId:
              event.id ??
              null,
            providerCommenceTime:
              event.commence_time ??
              null,
            providerHomeTeam:
              event.home_team ??
              null,
            providerAwayTeam:
              event.away_team ??
              null,
            bookmakerLastUpdate:
              bookmaker.last_update ??
              null,
            marketLastUpdate:
              spreadMarket.last_update ??
              null,
            homePrice:
              homeOutcome.price ??
              null,
            awayPrice:
              awayOutcome?.price ??
              null,
          },
        });
      }

      if (
        sourceRows.length > 0
      ) {
        const {
          error: sourceError,
        } =
          await supabase
            .from(
              "pickem_line_sources"
            )
            .insert(
              sourceRows
            );

        if (sourceError) {
          weekFailures.add(
            game.pickem_week_id
          );
          continue;
        }

        result.sourceLinesInserted +=
          sourceRows.length;
      }

      const {
        data: freezeData,
        error: freezeError,
      } =
        await supabase.rpc(
          "freeze_pickem_g365_spread",
          {
            p_pickem_game_id:
              game.id,
          }
        );

      if (freezeError) {
        weekFailures.add(
          game.pickem_week_id
        );
        continue;
      }

      const freezeResult =
        freezeData as {
          success?: boolean;
          excluded?: boolean;
        };

      if (
        freezeResult.excluded
      ) {
        result.gamesExcluded +=
          1;
      } else if (
        freezeResult.success
      ) {
        result.gamesFrozen +=
          1;
      }
    }

    for (
      const week of weeks
    ) {
      if (
        weekFailures.has(
          week.id
        )
      ) {
        continue;
      }

      const {
        error: completeError,
      } =
        await supabase
          .from(
            "pickem_weeks"
          )
          .update({
            line_sync_completed_at:
              nowIso,
            line_sync_provider:
              "the-odds-api",
            updated_at:
              nowIso,
          })
          .eq(
            "id",
            week.id
          );

      if (!completeError) {
        result.weeksCompleted +=
          1;
      }
    }

    return NextResponse.json(
      {
        success:
          weekFailures.size ===
          0,
        provider:
          "the-odds-api",
        ...result,
      },
      {
        status:
          weekFailures.size ===
          0
            ? 200
            : 207,
      }
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Automatic Pick'em sportsbook line sync failed.",
      },
      {
        status: 500,
      }
    );
  }
}
