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
  preview?: boolean;
  lookaheadDays?: number;
};

type NhlPickemGameRow = {
  id: number;
  nhl_pickem_period_id: number;
  nhl_game_id: number;
  league_id: string;
  season: number;
  eligible: boolean;
  excluded_reason: string | null;
  freeze_scheduled_at: string | null;
  frozen_at: string | null;
  is_frozen: boolean;
  line_status: string;
};

type NhlGameRow = {
  id: number;
  nhl_game_id: string | null;
  season: number;
  season_type: string | null;
  start_time: string;
  away_team_id: number;
  home_team_id: number;
  status_completed: boolean;
};

type NhlTeamRow = {
  id: number;
  abbreviation: string | null;
  name: string | null;
  display_name: string | null;
  short_name: string | null;
  location: string | null;
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

type MatchResult = {
  event: OddsEvent;
  score: number;
  homeSimilarity: number;
  awaySimilarity: number;
  startTimeDifferenceMinutes: number | null;
};

type BookmakerLine = {
  sportsbookKey: string;
  sportsbookName: string;
  homeMoneyline: number | null;
  awayMoneyline: number | null;
  homePuckLine: number | null;
  awayPuckLine: number | null;
  total: number | null;
  h2hLastUpdate: string | null;
  spreadLastUpdate: string | null;
  totalLastUpdate: string | null;
  bookmakerLastUpdate: string | null;
  homeMoneylinePrice: number | null;
  awayMoneylinePrice: number | null;
  homePuckLinePrice: number | null;
  awayPuckLinePrice: number | null;
  overPrice: number | null;
  underPrice: number | null;
};

const NHL_ODDS_SPORT_KEY =
  "icehockey_nhl";

function getEnv() {
  const supabaseUrl =
    process.env
      .NEXT_PUBLIC_SUPABASE_URL;

  const serviceRoleKey =
    process.env
      .SUPABASE_SERVICE_ROLE_KEY;

  const syncSecret =
    process.env
      .GRIDIRON_SYNC_SECRET ??
    process.env
      .NFL_SYNC_SECRET;

  const oddsApiKey =
    process.env
      .THE_ODDS_API_KEY;

  if (
    !supabaseUrl ||
    !serviceRoleKey ||
    !syncSecret ||
    !oddsApiKey
  ) {
    throw new Error(
      "Required NHL Pick'em line-sync environment variables are missing. THE_ODDS_API_KEY must be configured."
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
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(
      /[^a-z0-9]+/g,
      " "
    )
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

function getTeamCandidates(
  team: NhlTeamRow
) {
  return Array.from(
    new Set(
      [
        team.display_name,
        team.name,
        team.short_name,
        team.location &&
        team.name
          ? `${team.location} ${team.name}`
          : null,
        team.abbreviation,
      ]
        .filter(
          (
            value
          ): value is string =>
            typeof value ===
              "string" &&
            value.trim().length > 0
        )
        .map(
          (value) =>
            value.trim()
        )
    )
  );
}

function bestTeamSimilarity(
  candidates: string[],
  providerName: string
) {
  let best = 0;

  for (
    const candidate of
    candidates
  ) {
    best = Math.max(
      best,
      tokenSimilarity(
        candidate,
        providerName
      )
    );
  }

  return best;
}

function findMatchingOddsEvent(
  game: NhlGameRow,
  homeTeam: NhlTeamRow,
  awayTeam: NhlTeamRow,
  events: OddsEvent[]
): MatchResult | null {
  const gameStart =
    new Date(
      game.start_time
    ).getTime();

  if (
    !Number.isFinite(gameStart)
  ) {
    return null;
  }

  const homeCandidates =
    getTeamCandidates(homeTeam);

  const awayCandidates =
    getTeamCandidates(awayTeam);

  let bestEvent:
    OddsEvent | null = null;

  let bestScore = 0;
  let bestHomeScore = 0;
  let bestAwayScore = 0;

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

    const providerStart =
      new Date(
        event.commence_time
      ).getTime();

    if (
      !Number.isFinite(
        providerStart
      )
    ) {
      continue;
    }

    const startDifference =
      Math.abs(
        providerStart -
        gameStart
      );

    if (
      startDifference >
      6 * 60 * 60 * 1000
    ) {
      continue;
    }

    const homeScore =
      bestTeamSimilarity(
        homeCandidates,
        event.home_team
      );

    const awayScore =
      bestTeamSimilarity(
        awayCandidates,
        event.away_team
      );

    const combined =
      homeScore + awayScore;

    if (
      homeScore >= 0.45 &&
      awayScore >= 0.45 &&
      combined > bestScore
    ) {
      bestEvent = event;
      bestScore = combined;
      bestHomeScore = homeScore;
      bestAwayScore = awayScore;
    }
  }

  if (
    !bestEvent ||
    bestScore < 1.15
  ) {
    return null;
  }

  const providerStart =
    new Date(
      bestEvent.commence_time ??
        ""
    ).getTime();

  return {
    event: bestEvent,
    score: bestScore,
    homeSimilarity:
      bestHomeScore,
    awaySimilarity:
      bestAwayScore,
    startTimeDifferenceMinutes:
      Number.isFinite(
        providerStart
      )
        ? Math.round(
            Math.abs(
              providerStart -
                gameStart
            ) /
              60000
          )
        : null,
  };
}

function getMarket(
  bookmaker:
    OddsBookmaker,
  marketKey: string
) {
  return (
    bookmaker.markets ??
    []
  ).find(
    (market) =>
      market.key ===
      marketKey
  );
}

function getNamedOutcome(
  market:
    OddsMarket | undefined,
  name:
    string | undefined
) {
  if (
    !market ||
    !name
  ) {
    return undefined;
  }

  return (
    market.outcomes ??
    []
  ).find(
    (outcome) =>
      normalizeTeamName(
        outcome.name ??
          ""
      ) ===
      normalizeTeamName(name)
  );
}

function getTotalOutcome(
  market:
    OddsMarket | undefined,
  side:
    "over" | "under"
) {
  return (
    market?.outcomes ??
    []
  ).find(
    (outcome) =>
      outcome.name
        ?.toLowerCase()
        .trim() === side
  );
}

function numberOrNull(
  value: unknown
) {
  return (
    typeof value ===
      "number" &&
    Number.isFinite(value)
  )
    ? value
    : null;
}

function extractBookmakerLine(
  bookmaker:
    OddsBookmaker,
  event:
    OddsEvent
): BookmakerLine | null {
  if (!bookmaker.key) {
    return null;
  }

  const h2hMarket =
    getMarket(
      bookmaker,
      "h2h"
    );

  const spreadMarket =
    getMarket(
      bookmaker,
      "spreads"
    );

  const totalMarket =
    getMarket(
      bookmaker,
      "totals"
    );

  const homeMoneylineOutcome =
    getNamedOutcome(
      h2hMarket,
      event.home_team
    );

  const awayMoneylineOutcome =
    getNamedOutcome(
      h2hMarket,
      event.away_team
    );

  const homeSpreadOutcome =
    getNamedOutcome(
      spreadMarket,
      event.home_team
    );

  const awaySpreadOutcome =
    getNamedOutcome(
      spreadMarket,
      event.away_team
    );

  const overOutcome =
    getTotalOutcome(
      totalMarket,
      "over"
    );

  const underOutcome =
    getTotalOutcome(
      totalMarket,
      "under"
    );

  const homeMoneyline =
    numberOrNull(
      homeMoneylineOutcome
        ?.price
    );

  const awayMoneyline =
    numberOrNull(
      awayMoneylineOutcome
        ?.price
    );

  const homePuckLine =
    numberOrNull(
      homeSpreadOutcome?.point
    );

  const awayPuckLineRaw =
    numberOrNull(
      awaySpreadOutcome?.point
    );

  const awayPuckLine =
    awayPuckLineRaw ??
    (
      homePuckLine !== null
        ? -homePuckLine
        : null
    );

  const overPoint =
    numberOrNull(
      overOutcome?.point
    );

  const underPoint =
    numberOrNull(
      underOutcome?.point
    );

  const total =
    overPoint ??
    underPoint;

  if (
    homeMoneyline === null &&
    awayMoneyline === null &&
    homePuckLine === null &&
    awayPuckLine === null &&
    total === null
  ) {
    return null;
  }

  return {
    sportsbookKey:
      bookmaker.key,

    sportsbookName:
      bookmaker.title ??
      bookmaker.key,

    homeMoneyline,
    awayMoneyline,
    homePuckLine,
    awayPuckLine,
    total,

    h2hLastUpdate:
      h2hMarket
        ?.last_update ??
      null,

    spreadLastUpdate:
      spreadMarket
        ?.last_update ??
      null,

    totalLastUpdate:
      totalMarket
        ?.last_update ??
      null,

    bookmakerLastUpdate:
      bookmaker.last_update ??
      null,

    homeMoneylinePrice:
      homeMoneyline,

    awayMoneylinePrice:
      awayMoneyline,

    homePuckLinePrice:
      numberOrNull(
        homeSpreadOutcome
          ?.price
      ),

    awayPuckLinePrice:
      numberOrNull(
        awaySpreadOutcome
          ?.price
      ),

    overPrice:
      numberOrNull(
        overOutcome?.price
      ),

    underPrice:
      numberOrNull(
        underOutcome?.price
      ),
  };
}

function toOddsApiTime(
  value: string
) {
  const parsed =
    new Date(value);

  if (
    !Number.isFinite(
      parsed.getTime()
    )
  ) {
    throw new Error(
      `Invalid NHL Odds API time value: ${value}`
    );
  }

  return parsed
    .toISOString()
    .replace(
      /\.\d{3}Z$/,
      "Z"
    );
}

async function fetchNhlOdds(
  apiKey: string,
  from: string,
  to: string
) {
  const url =
    new URL(
      `https://api.the-odds-api.com/v4/sports/${NHL_ODDS_SPORT_KEY}/odds`
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
    "h2h,spreads,totals"
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
    toOddsApiTime(from)
  );

  url.searchParams.set(
    "commenceTimeTo",
    toOddsApiTime(to)
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
    data =
      JSON.parse(text);
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw new Error(
      `The Odds API NHL request failed with HTTP ${response.status}: ${text.slice(0, 500)}`
    );
  }

  return {
    events:
      Array.isArray(data)
        ? data as OddsEvent[]
        : [],

    requestsUsed:
      Number(
        response.headers.get(
          "x-requests-used"
        )
      ),

    requestsRemaining:
      Number(
        response.headers.get(
          "x-requests-remaining"
        )
      ),

    requestsLast:
      Number(
        response.headers.get(
          "x-requests-last"
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

    const authorization =
      request.headers.get(
        "authorization"
      );

    const bearerSecret =
      authorization
        ?.startsWith(
          "Bearer "
        )
        ? authorization
            .slice(7)
            .trim()
        : null;

    if (
      suppliedSecret !==
        syncSecret &&
      bearerSecret !==
        syncSecret
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Unauthorized NHL Pick'em line sync request.",
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
        await request.json() as
          RequestBody;
    } catch {
      body = {};
    }

    const preview =
      body.preview === true;

    const requestedLookahead =
      typeof body.lookaheadDays ===
          "number" &&
      Number.isInteger(
        body.lookaheadDays
      )
        ? body.lookaheadDays
        : 8;

    const lookaheadDays =
      Math.min(
        14,
        Math.max(
          1,
          requestedLookahead
        )
      );

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

    const through =
      new Date(
        now.getTime() +
        lookaheadDays *
          24 *
          60 *
          60 *
          1000
      );

    let pickemQuery =
      supabase
        .from(
          "nhl_pickem_games"
        )
        .select(
          [
            "id",
            "nhl_pickem_period_id",
            "nhl_game_id",
            "league_id",
            "season",
            "eligible",
            "excluded_reason",
            "freeze_scheduled_at",
            "frozen_at",
            "is_frozen",
            "line_status",
          ].join(",")
        )
        .eq(
          "line_status",
          "pending"
        )
        .eq(
          "is_frozen",
          false
        );

    if (body.leagueId) {
      pickemQuery =
        pickemQuery.eq(
          "league_id",
          body.leagueId
        );
    }

    const {
      data: pickemData,
      error: pickemError,
    } =
      await pickemQuery;

    if (pickemError) {
      throw new Error(
        pickemError.message
      );
    }

    const pickemGames =
      (
        pickemData ??
        []
      ) as unknown as
        NhlPickemGameRow[];

    if (
      pickemGames.length === 0
    ) {
      return NextResponse.json({
        success: true,
        preview,
        provider:
          "the-odds-api",
        sport:
          "NHL",
        message:
          "No pending NHL Pick'em games require sportsbook source collection.",
        gamesReviewed: 0,
        gamesEligibleForSync:
          0,
        gamesMatched: 0,
        gamesUnmatched: 0,
        sourceRowsInserted:
          0,
      });
    }

    const nhlGameIds =
      Array.from(
        new Set(
          pickemGames.map(
            (game) =>
              game.nhl_game_id
          )
        )
      );

    const {
      data: nhlGamesData,
      error: nhlGamesError,
    } =
      await supabase
        .from(
          "nhl_games"
        )
        .select(
          [
            "id",
            "nhl_game_id",
            "season",
            "season_type",
            "start_time",
            "away_team_id",
            "home_team_id",
            "status_completed",
          ].join(",")
        )
        .in(
          "id",
          nhlGameIds
        )
        .gte(
          "start_time",
          nowIso
        )
        .lte(
          "start_time",
          through.toISOString()
        )
        .eq(
          "status_completed",
          false
        );

    if (nhlGamesError) {
      throw new Error(
        nhlGamesError.message
      );
    }

    const nhlGames =
      (
        nhlGamesData ??
        []
      ) as unknown as
        NhlGameRow[];

    const nhlGameById =
      new Map<
        number,
        NhlGameRow
      >();

    for (
      const game of nhlGames
    ) {
      nhlGameById.set(
        game.id,
        game
      );
    }

    const relevantPickemGames =
      pickemGames.filter(
        (pickemGame) =>
          nhlGameById.has(
            pickemGame.nhl_game_id
          )
      );

    if (
      relevantPickemGames.length ===
      0
    ) {
      return NextResponse.json({
        success: true,
        preview,
        provider:
          "the-odds-api",
        sport:
          "NHL",
        message:
          "Pending NHL Pick'em games exist, but none start within the requested sportsbook lookahead window.",
        gamesReviewed:
          pickemGames.length,
        gamesEligibleForSync:
          0,
        gamesMatched: 0,
        gamesUnmatched: 0,
        sourceRowsInserted:
          0,
        lookaheadDays,
      });
    }

    const teamIds =
      Array.from(
        new Set(
          nhlGames.flatMap(
            (game) => [
              game.home_team_id,
              game.away_team_id,
            ]
          )
        )
      );

    const {
      data: teamsData,
      error: teamsError,
    } =
      await supabase
        .from(
          "nhl_teams"
        )
        .select(
          [
            "id",
            "abbreviation",
            "name",
            "display_name",
            "short_name",
            "location",
          ].join(",")
        )
        .in(
          "id",
          teamIds
        );

    if (teamsError) {
      throw new Error(
        teamsError.message
      );
    }

    const teams =
      (
        teamsData ??
        []
      ) as unknown as
        NhlTeamRow[];

    const teamById =
      new Map<
        number,
        NhlTeamRow
      >();

    for (
      const team of teams
    ) {
      teamById.set(
        team.id,
        team
      );
    }

    const startTimes =
      relevantPickemGames
        .map(
          (pickemGame) =>
            nhlGameById.get(
              pickemGame
                .nhl_game_id
            )
        )
        .filter(
          (
            game
          ): game is NhlGameRow =>
            Boolean(game)
        )
        .map(
          (game) =>
            new Date(
              game.start_time
            ).getTime()
        )
        .filter(
          Number.isFinite
        );

    if (
      startTimes.length === 0
    ) {
      throw new Error(
        "Pending NHL Pick'em games did not contain valid NHL start times."
      );
    }

    const earliestStart =
      Math.min(
        ...startTimes
      );

    const latestStart =
      Math.max(
        ...startTimes
      );

    const providerFrom =
      new Date(
        earliestStart -
        6 *
          60 *
          60 *
          1000
      ).toISOString();

    const providerTo =
      new Date(
        latestStart +
        6 *
          60 *
          60 *
          1000
      ).toISOString();

    const oddsResponse =
      await fetchNhlOdds(
        oddsApiKey,
        providerFrom,
        providerTo
      );

    const sourceRows:
      Array<{
        nhl_pickem_game_id:
          number;
        source_provider:
          string;
        sportsbook_key:
          string;
        sportsbook_name:
          string | null;
        source_event_id:
          string | null;
        source_market_key:
          string;
        home_moneyline:
          number | null;
        away_moneyline:
          number | null;
        home_puck_line:
          number | null;
        away_puck_line:
          number | null;
        total:
          number | null;
        collected_at:
          string;
        raw_audit:
          Record<
            string,
            unknown
          >;
      }> = [];

    const previewGames:
      Array<
        Record<
          string,
          unknown
        >
      > = [];

    let gamesMatched = 0;
    let gamesUnmatched = 0;
    let bookmakersCollected = 0;

    for (
      const pickemGame of
      relevantPickemGames
    ) {
      const nhlGame =
        nhlGameById.get(
          pickemGame.nhl_game_id
        );

      if (!nhlGame) {
        continue;
      }

      const homeTeam =
        teamById.get(
          nhlGame.home_team_id
        );

      const awayTeam =
        teamById.get(
          nhlGame.away_team_id
        );

      if (
        !homeTeam ||
        !awayTeam
      ) {
        gamesUnmatched += 1;

        previewGames.push({
          nhlPickemGameId:
            pickemGame.id,
          nhlGameDatabaseId:
            nhlGame.id,
          officialNhlGameId:
            nhlGame.nhl_game_id,
          status:
            "MISSING_TEAM_MAPPING",
          startTime:
            nhlGame.start_time,
        });

        continue;
      }

      const match =
        findMatchingOddsEvent(
          nhlGame,
          homeTeam,
          awayTeam,
          oddsResponse.events
        );

      if (!match) {
        gamesUnmatched += 1;

        previewGames.push({
          nhlPickemGameId:
            pickemGame.id,
          nhlGameDatabaseId:
            nhlGame.id,
          officialNhlGameId:
            nhlGame.nhl_game_id,
          status:
            "UNMATCHED",
          homeTeam:
            homeTeam.display_name ??
            homeTeam.name,
          awayTeam:
            awayTeam.display_name ??
            awayTeam.name,
          startTime:
            nhlGame.start_time,
        });

        continue;
      }

      gamesMatched += 1;

      const bookmakerLines =
        (
          match.event.bookmakers ??
          []
        )
          .map(
            (bookmaker) =>
              extractBookmakerLine(
                bookmaker,
                match.event
              )
          )
          .filter(
            (
              line
            ): line is BookmakerLine =>
              line !== null
          );

      bookmakersCollected +=
        bookmakerLines.length;

      previewGames.push({
        nhlPickemGameId:
          pickemGame.id,
        nhlGameDatabaseId:
          nhlGame.id,
        officialNhlGameId:
          nhlGame.nhl_game_id,
        status:
          "MATCHED",
        homeTeam:
          homeTeam.display_name ??
          homeTeam.name,
        awayTeam:
          awayTeam.display_name ??
          awayTeam.name,
        startTime:
          nhlGame.start_time,
        providerEventId:
          match.event.id ??
          null,
        providerHomeTeam:
          match.event.home_team ??
          null,
        providerAwayTeam:
          match.event.away_team ??
          null,
        providerStartTime:
          match.event
            .commence_time ??
          null,
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
            match.score
              .toFixed(3)
          ),
        startTimeDifferenceMinutes:
          match
            .startTimeDifferenceMinutes,
        sportsbookCount:
          bookmakerLines.length,
      });

      for (
        const line of
        bookmakerLines
      ) {
        sourceRows.push({
          nhl_pickem_game_id:
            pickemGame.id,

          source_provider:
            "the-odds-api",

          sportsbook_key:
            line.sportsbookKey,

          sportsbook_name:
            line.sportsbookName,

          source_event_id:
            match.event.id ??
            null,

          source_market_key:
            "h2h,spreads,totals",

          home_moneyline:
            line.homeMoneyline,

          away_moneyline:
            line.awayMoneyline,

          home_puck_line:
            line.homePuckLine,

          away_puck_line:
            line.awayPuckLine,

          total:
            line.total,

          collected_at:
            nowIso,

          raw_audit: {
            provider:
              "the-odds-api",

            providerSportKey:
              match.event
                .sport_key ??
              NHL_ODDS_SPORT_KEY,

            providerEventId:
              match.event.id ??
              null,

            providerCommenceTime:
              match.event
                .commence_time ??
              null,

            providerHomeTeam:
              match.event
                .home_team ??
              null,

            providerAwayTeam:
              match.event
                .away_team ??
              null,

            officialNhlGameId:
              nhlGame
                .nhl_game_id,

            internalNhlGameId:
              nhlGame.id,

            nhlPickemGameId:
              pickemGame.id,

            sportsbookKey:
              line.sportsbookKey,

            sportsbookName:
              line.sportsbookName,

            bookmakerLastUpdate:
              line
                .bookmakerLastUpdate,

            h2hLastUpdate:
              line.h2hLastUpdate,

            spreadLastUpdate:
              line.spreadLastUpdate,

            totalLastUpdate:
              line.totalLastUpdate,

            homeMoneyline:
              line.homeMoneyline,

            awayMoneyline:
              line.awayMoneyline,

            homePuckLine:
              line.homePuckLine,

            awayPuckLine:
              line.awayPuckLine,

            total:
              line.total,

            homePuckLinePrice:
              line
                .homePuckLinePrice,

            awayPuckLinePrice:
              line
                .awayPuckLinePrice,

            overPrice:
              line.overPrice,

            underPrice:
              line.underPrice,

            matchScore:
              match.score,

            homeSimilarity:
              match.homeSimilarity,

            awaySimilarity:
              match.awaySimilarity,

            startTimeDifferenceMinutes:
              match
                .startTimeDifferenceMinutes,
          },
        });
      }
    }

    if (preview) {
      return NextResponse.json({
        success: true,
        preview: true,
        readOnly: true,
        provider:
          "the-odds-api",
        sport:
          "NHL",
        providerSportKey:
          NHL_ODDS_SPORT_KEY,
        lookaheadDays,
        gamesReviewed:
          pickemGames.length,
        gamesEligibleForSync:
          relevantPickemGames
            .length,
        gamesMatched,
        gamesUnmatched,
        bookmakersCollected,
        sourceRowsPrepared:
          sourceRows.length,
        requestsUsed:
          Number.isFinite(
            oddsResponse
              .requestsUsed
          )
            ? oddsResponse
                .requestsUsed
            : null,
        requestsRemaining:
          Number.isFinite(
            oddsResponse
              .requestsRemaining
          )
            ? oddsResponse
                .requestsRemaining
            : null,
        requestsLast:
          Number.isFinite(
            oddsResponse
              .requestsLast
          )
            ? oddsResponse
                .requestsLast
            : null,
        games:
          previewGames,
      });
    }

    let sourceRowsInserted = 0;

    const batchSize = 500;

    for (
      let offset = 0;
      offset <
      sourceRows.length;
      offset += batchSize
    ) {
      const batch =
        sourceRows.slice(
          offset,
          offset + batchSize
        );

      const {
        error: insertError,
      } =
        await supabase
          .from(
            "nhl_pickem_line_sources"
          )
          .insert(batch);

      if (insertError) {
        throw new Error(
          `NHL Pick'em sportsbook source insert failed: ${insertError.message}`
        );
      }

      sourceRowsInserted +=
        batch.length;
    }

    return NextResponse.json({
      success: true,
      preview: false,
      provider:
        "the-odds-api",
      sport:
        "NHL",
      providerSportKey:
        NHL_ODDS_SPORT_KEY,
      lookaheadDays,
      gamesReviewed:
        pickemGames.length,
      gamesEligibleForSync:
        relevantPickemGames
          .length,
      gamesMatched,
      gamesUnmatched,
      bookmakersCollected,
      sourceRowsInserted,
      requestsUsed:
        Number.isFinite(
          oddsResponse
            .requestsUsed
        )
          ? oddsResponse
              .requestsUsed
          : null,
      requestsRemaining:
        Number.isFinite(
          oddsResponse
            .requestsRemaining
        )
          ? oddsResponse
              .requestsRemaining
          : null,
      requestsLast:
        Number.isFinite(
          oddsResponse
            .requestsLast
        )
          ? oddsResponse
              .requestsLast
          : null,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Automatic NHL Pick'em sportsbook source sync failed.",
      },
      {
        status: 500,
      }
    );
  }
}