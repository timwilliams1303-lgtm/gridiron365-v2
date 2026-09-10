import {
  NextResponse,
} from "next/server";

import {
  createClient,
} from "@supabase/supabase-js";


export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

export const maxDuration =
  300;


/*
 * The generated Supabase Database types do not yet contain all
 * of the new NCAAMB RPCs/tables. This route runs server-side
 * with the service-role key, so use an admin client type here
 * until the generated database types are refreshed.
 */
type SupabaseAdminClient =
  any;


// ============================================================
// TYPES
// ============================================================

type PullWindowKey =
  | "sunday_mon_thu"
  | "thursday_fri_sun";


type RequestBody = {
  leagueId?: string;

  season?: number;

  week?: number;

  preview?: boolean;

  /*
   * PREVIEW ONLY.
   *
   * Allows a future Sunday/Thursday snapshot to be tested
   * without changing the real automation clock or claiming
   * the production provider-run ledger.
   */
  pullWindow?: PullWindowKey;

  anchorDate?: string;
};


type NcaambSyncTarget = {
  league_id: string;

  league_name: string | null;

  season: number;
};


type PickemGameRow = {
  id: number;

  league_id: string;

  pickem_week_id: number;

  season: number;

  week: number;

  sport: string;

  provider_event_id: string;

  kickoff_at: string;

  away_team_name: string;

  away_team_abbreviation:
    string | null;

  away_team_espn_id:
    string | null;

  home_team_name: string;

  home_team_abbreviation:
    string | null;

  home_team_espn_id:
    string | null;

  spread_status:
    | "pending"
    | "published"
    | "frozen"
    | "excluded";

  total_status:
    | "pending"
    | "published"
    | "frozen"
    | "excluded";

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

  sport_title?: string;

  commence_time?: string;

  home_team?: string;

  away_team?: string;

  bookmakers?: OddsBookmaker[];
};


type ProviderResponse = {
  events: OddsEvent[];

  used: number | null;

  remaining: number | null;
};


type PullWindow = {
  key: PullWindowKey;

  label: string;

  scheduledFor: Date;

  gameWindowStartsAt: Date;

  gameWindowEndsAt: Date;

  anchorDate: string;
};


type GameProcessingResult = {
  gameId: number;

  leagueId: string;

  pickemWeekId: number;

  season: number;

  week: number;

  providerEventId: string;

  kickoffAt: string;

  status: string;

  matched: boolean;

  sportsbookSpreadCount: number;

  sportsbookTotalCount: number;

  spreadFrozen: boolean;

  spreadExcluded: boolean;

  totalFrozen: boolean;

  totalExcluded: boolean;

  sourceLinesInserted: number;

  errors: string[];
};


// ============================================================
// CONSTANTS
// ============================================================

const TIME_ZONE =
  "America/New_York";


const NCAAMB_ODDS_SPORT_KEY =
  "basketball_ncaab";


const SUNDAY_PULL_HOUR_ET =
  10;


const THURSDAY_PULL_HOUR_ET =
  10;


const G365_APPROVED_SPORTSBOOK_KEYS =
  new Set([
    "draftkings",
    "fanduel",
    "betmgm",
    "betrivers",
    "williamhill_us",
  ]);


// ============================================================
// ENV
// ============================================================

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
      "Required NCAAMB line-sync environment variables are missing."
    );
  }


  return {
    supabaseUrl,
    serviceRoleKey,
    syncSecret,
    oddsApiKey,
  };
}


// ============================================================
// AUTH
// ============================================================

function getSuppliedSecret(
  request: Request
) {
  const headerSecret =
    request.headers.get(
      "x-gridiron-sync-secret"
    );


  if (
    headerSecret
  ) {
    return headerSecret;
  }


  const authorization =
    request.headers.get(
      "authorization"
    );


  if (
    authorization
      ?.toLowerCase()
      .startsWith(
        "bearer "
      )
  ) {
    return authorization
      .slice(7)
      .trim();
  }


  return null;
}


// ============================================================
// BASIC PARSING
// ============================================================

function parseInteger(
  value:
    | string
    | null
    | undefined
) {
  if (
    value === null ||
    value === undefined ||
    value.trim() ===
      ""
  ) {
    return null;
  }


  const parsed =
    Number(
      value
    );


  if (
    !Number.isInteger(
      parsed
    )
  ) {
    return null;
  }


  return parsed;
}


function isIsoDate(
  value: string
) {
  return /^\d{4}-\d{2}-\d{2}$/
    .test(
      value
    );
}


// ============================================================
// ET DATE / TIME HELPERS
// ============================================================

type ZonedParts = {
  year: number;

  month: number;

  day: number;

  hour: number;

  minute: number;

  second: number;

  weekday:
    | "Sun"
    | "Mon"
    | "Tue"
    | "Wed"
    | "Thu"
    | "Fri"
    | "Sat";
};


const weekdayNumber:
  Record<
    ZonedParts["weekday"],
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


function getZonedParts(
  date: Date
): ZonedParts {
  const formatter =
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone:
          TIME_ZONE,

        year:
          "numeric",

        month:
          "2-digit",

        day:
          "2-digit",

        hour:
          "2-digit",

        minute:
          "2-digit",

        second:
          "2-digit",

        weekday:
          "short",

        hourCycle:
          "h23",
      }
    );


  const parts =
    formatter
      .formatToParts(
        date
      );


  const map =
    new Map<
      string,
      string
    >();


  for (
    const part of
    parts
  ) {
    if (
      part.type !==
      "literal"
    ) {
      map.set(
        part.type,
        part.value
      );
    }
  }


  return {
    year:
      Number(
        map.get(
          "year"
        )
      ),

    month:
      Number(
        map.get(
          "month"
        )
      ),

    day:
      Number(
        map.get(
          "day"
        )
      ),

    hour:
      Number(
        map.get(
          "hour"
        )
      ),

    minute:
      Number(
        map.get(
          "minute"
        )
      ),

    second:
      Number(
        map.get(
          "second"
        )
      ),

    weekday:
      (
        map.get(
          "weekday"
        ) ??
        "Sun"
      ) as ZonedParts["weekday"],
  };
}


function formatLocalDate(
  year: number,
  month: number,
  day: number
) {
  return [
    String(
      year
    ).padStart(
      4,
      "0"
    ),

    String(
      month
    ).padStart(
      2,
      "0"
    ),

    String(
      day
    ).padStart(
      2,
      "0"
    ),
  ].join(
    "-"
  );
}


function parseLocalDate(
  value: string
) {
  if (
    !isIsoDate(
      value
    )
  ) {
    throw new Error(
      `Invalid local date: ${value}`
    );
  }


  const [
    year,
    month,
    day,
  ] =
    value
      .split("-")
      .map(
        Number
      );


  return {
    year,
    month,
    day,
  };
}


function addLocalDays(
  value: string,
  days: number
) {
  const {
    year,
    month,
    day,
  } =
    parseLocalDate(
      value
    );


  const shifted =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day + days,
        12,
        0,
        0
      )
    );


  return formatLocalDate(
    shifted
      .getUTCFullYear(),

    shifted
      .getUTCMonth() +
      1,

    shifted
      .getUTCDate()
  );
}


/*
 * Convert an America/New_York wall-clock time into UTC.
 *
 * Iterating against Intl keeps this safe across DST changes.
 */
function localEtToUtc(
  localDate: string,
  hour: number,
  minute =
    0,
  second =
    0
) {
  const {
    year,
    month,
    day,
  } =
    parseLocalDate(
      localDate
    );


  const desired =
    Date.UTC(
      year,
      month - 1,
      day,
      hour,
      minute,
      second
    );


  let candidate =
    desired;


  for (
    let attempt =
      0;
    attempt <
      4;
    attempt +=
      1
  ) {
    const actual =
      getZonedParts(
        new Date(
          candidate
        )
      );


    const actualAsUtc =
      Date.UTC(
        actual.year,
        actual.month -
          1,
        actual.day,
        actual.hour,
        actual.minute,
        actual.second
      );


    const difference =
      desired -
      actualAsUtc;


    if (
      difference ===
      0
    ) {
      break;
    }


    candidate +=
      difference;
  }


  return new Date(
    candidate
  );
}


// ============================================================
// PULL-WINDOW CALCULATION
// ============================================================

function buildPullWindow(
  key: PullWindowKey,
  anchorDate: string
): PullWindow {
  if (
    key ===
    "sunday_mon_thu"
  ) {
    const scheduledFor =
      localEtToUtc(
        anchorDate,
        SUNDAY_PULL_HOUR_ET
      );


    const monday =
      addLocalDays(
        anchorDate,
        1
      );


    const friday =
      addLocalDays(
        anchorDate,
        5
      );


    return {
      key,

      label:
        "Sunday NCAAMB Lines — Monday through Thursday",

      scheduledFor,

      gameWindowStartsAt:
        localEtToUtc(
          monday,
          0
        ),

      gameWindowEndsAt:
        localEtToUtc(
          friday,
          0
        ),

      anchorDate,
    };
  }


  const scheduledFor =
    localEtToUtc(
      anchorDate,
      THURSDAY_PULL_HOUR_ET
    );


  const friday =
    addLocalDays(
      anchorDate,
      1
    );


  const monday =
    addLocalDays(
      anchorDate,
      4
    );


  return {
    key,

    label:
      "Thursday NCAAMB Lines — Friday through Sunday",

    scheduledFor,

    gameWindowStartsAt:
      localEtToUtc(
        friday,
        0
      ),

    gameWindowEndsAt:
      localEtToUtc(
        monday,
        0
      ),

    anchorDate,
  };
}


/*
 * Automatic provider requests are only allowed:
 *
 * Sunday after 10 AM ET:
 *     Monday through Thursday games
 *
 * Thursday after 10 AM ET:
 *     Friday through Sunday games
 *
 * The database claim ensures that even though cron 81 executes
 * every five minutes, the provider can only be called once for
 * each scheduled window.
 */
function getAutomaticPullWindow(
  now: Date
): PullWindow | null {
  const parts =
    getZonedParts(
      now
    );


  const dow =
    weekdayNumber[
      parts.weekday
    ];


  const localMinutes =
    parts.hour *
      60 +
    parts.minute;


  const localDate =
    formatLocalDate(
      parts.year,
      parts.month,
      parts.day
    );


  if (
    dow ===
      0 &&
    localMinutes >=
      SUNDAY_PULL_HOUR_ET *
        60
  ) {
    return buildPullWindow(
      "sunday_mon_thu",
      localDate
    );
  }


  if (
    dow ===
      4 &&
    localMinutes >=
      THURSDAY_PULL_HOUR_ET *
        60
  ) {
    return buildPullWindow(
      "thursday_fri_sun",
      localDate
    );
  }


  return null;
}


// ============================================================
// SPORTSBOOK HELPERS
// ============================================================

function isApprovedG365Sportsbook(
  sportsbookKey:
    | string
    | null
    | undefined
) {
  if (
    !sportsbookKey
  ) {
    return false;
  }


  return G365_APPROVED_SPORTSBOOK_KEYS
    .has(
      sportsbookKey
        .toLowerCase()
    );
}


// ============================================================
// TEAM MATCHING
// ============================================================

function normalizeTeamName(
  value: string
) {
  return value
    .normalize(
      "NFKD"
    )
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .toLowerCase()
    .replace(
      /&/g,
      " and "
    )
    .replace(
      /\(oh\)/g,
      " ohio "
    )
    .replace(
      /\(pa\)/g,
      " pennsylvania "
    )
    .replace(
      /\(fl\)/g,
      " florida "
    )
    .replace(
      /\(ca\)/g,
      " california "
    )
    .replace(
      /[^a-z0-9]+/g,
      " "
    )
    .replace(
      /\buniversity\b/g,
      " "
    )
    .replace(
      /\bthe\b/g,
      " "
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim();
}


function tokenSimilarity(
  left: string,
  right: string
) {
  const leftNormalized =
    normalizeTeamName(
      left
    );


  const rightNormalized =
    normalizeTeamName(
      right
    );


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
      leftNormalized
        .split(" ")
    );


  const rightTokens =
    new Set(
      rightNormalized
        .split(" ")
    );


  let intersection =
    0;


  for (
    const token of
    leftTokens
  ) {
    if (
      rightTokens.has(
        token
      )
    ) {
      intersection +=
        1;
    }
  }


  const union =
    new Set([
      ...leftTokens,
      ...rightTokens,
    ]).size;


  return union >
    0
    ? intersection /
        union
    : 0;
}


function findMatchingOddsEventDetailed(
  game:
    PickemGameRow,
  events:
    OddsEvent[]
) {
  const kickoff =
    new Date(
      game.kickoff_at
    ).getTime();


  let best:
    OddsEvent | null =
      null;


  let bestScore =
    0;


  for (
    const event of
    events
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
        event
          .commence_time
      ).getTime();


    if (
      !Number.isFinite(
        providerKickoff
      )
    ) {
      continue;
    }


    if (
      Math.abs(
        providerKickoff -
          kickoff
      ) >
      6 *
        60 *
        60 *
        1000
    ) {
      continue;
    }


    const homeScore =
      tokenSimilarity(
        game
          .home_team_name,
        event
          .home_team
      );


    const awayScore =
      tokenSimilarity(
        game
          .away_team_name,
        event
          .away_team
      );


    const combined =
      homeScore +
      awayScore;


    if (
      homeScore >=
        0.45 &&
      awayScore >=
        0.45 &&
      combined >
        bestScore
    ) {
      best =
        event;

      bestScore =
        combined;
    }
  }


  if (
    !best ||
    bestScore <
      1.15
  ) {
    return null;
  }


  const providerKickoff =
    new Date(
      best
        .commence_time ??
        ""
    ).getTime();


  return {
    event:
      best,

    score:
      bestScore,

    homeSimilarity:
      tokenSimilarity(
        game
          .home_team_name,
        best
          .home_team ??
          ""
      ),

    awaySimilarity:
      tokenSimilarity(
        game
          .away_team_name,
        best
          .away_team ??
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


// ============================================================
// MARKET EXTRACTION
// ============================================================

function getBookmakerSpreads(
  event:
    OddsEvent
) {
  const rows:
    Array<{
      sportsbookKey:
        string;

      sportsbookName:
        string;

      homeSpread:
        number;

      awaySpread:
        number | null;

      homePrice:
        number | null;

      awayPrice:
        number | null;

      bookmakerLastUpdate:
        string | null;

      marketLastUpdate:
        string | null;
    }> =
      [];


  for (
    const bookmaker of
    event.bookmakers ??
    []
  ) {
    if (
      !isApprovedG365Sportsbook(
        bookmaker.key
      )
    ) {
      continue;
    }


    const market =
      (
        bookmaker.markets ??
        []
      ).find(
        (
          candidate
        ) =>
          candidate.key ===
          "spreads"
      );


    if (
      !market
    ) {
      continue;
    }


    const homeOutcome =
      (
        market.outcomes ??
        []
      ).find(
        (
          outcome
        ) =>
          outcome.name ===
          event.home_team
      );


    const awayOutcome =
      (
        market.outcomes ??
        []
      ).find(
        (
          outcome
        ) =>
          outcome.name ===
          event.away_team
      );


    if (
      !bookmaker.key ||
      typeof homeOutcome
        ?.point !==
        "number" ||
      !Number.isFinite(
        homeOutcome
          .point
      )
    ) {
      continue;
    }


    rows.push({
      sportsbookKey:
        bookmaker.key,

      sportsbookName:
        bookmaker.title ??
        bookmaker.key,

      homeSpread:
        homeOutcome
          .point,

      awaySpread:
        typeof awayOutcome
          ?.point ===
          "number"
          ? awayOutcome
              .point
          : -homeOutcome
              .point,

      homePrice:
        typeof homeOutcome
          ?.price ===
          "number"
          ? homeOutcome
              .price
          : null,

      awayPrice:
        typeof awayOutcome
          ?.price ===
          "number"
          ? awayOutcome
              .price
          : null,

      bookmakerLastUpdate:
        bookmaker
          .last_update ??
        null,

      marketLastUpdate:
        market
          .last_update ??
        null,
    });
  }


  return rows;
}


function getBookmakerTotals(
  event:
    OddsEvent
) {
  const rows:
    Array<{
      sportsbookKey:
        string;

      sportsbookName:
        string;

      total:
        number;

      overPrice:
        number | null;

      underPrice:
        number | null;

      bookmakerLastUpdate:
        string | null;

      marketLastUpdate:
        string | null;
    }> =
      [];


  for (
    const bookmaker of
    event.bookmakers ??
    []
  ) {
    if (
      !isApprovedG365Sportsbook(
        bookmaker.key
      )
    ) {
      continue;
    }


    const market =
      (
        bookmaker.markets ??
        []
      ).find(
        (
          candidate
        ) =>
          candidate.key ===
          "totals"
      );


    if (
      !market
    ) {
      continue;
    }


    const overOutcome =
      (
        market.outcomes ??
        []
      ).find(
        (
          outcome
        ) =>
          outcome.name
            ?.toLowerCase() ===
          "over"
      );


    const underOutcome =
      (
        market.outcomes ??
        []
      ).find(
        (
          outcome
        ) =>
          outcome.name
            ?.toLowerCase() ===
          "under"
      );


    const total =
      typeof overOutcome
        ?.point ===
        "number"
        ? overOutcome
            .point
        : typeof underOutcome
            ?.point ===
            "number"
          ? underOutcome
              .point
          : null;


    if (
      !bookmaker.key ||
      total ===
        null ||
      !Number.isFinite(
        total
      )
    ) {
      continue;
    }


    rows.push({
      sportsbookKey:
        bookmaker.key,

      sportsbookName:
        bookmaker.title ??
        bookmaker.key,

      total,

      overPrice:
        typeof overOutcome
          ?.price ===
          "number"
          ? overOutcome
              .price
          : null,

      underPrice:
        typeof underOutcome
          ?.price ===
          "number"
          ? underOutcome
              .price
          : null,

      bookmakerLastUpdate:
        bookmaker
          .last_update ??
        null,

      marketLastUpdate:
        market
          .last_update ??
        null,
    });
  }


  return rows;
}


// ============================================================
// MEDIAN
// ============================================================

function median(
  values:
    number[]
) {
  if (
    values.length ===
    0
  ) {
    return null;
  }


  const sorted =
    [
      ...values,
    ].sort(
      (
        left,
        right
      ) =>
        left -
        right
    );


  const middle =
    Math.floor(
      sorted.length /
        2
    );


  if (
    sorted.length %
      2 ===
    1
  ) {
    return sorted[
      middle
    ];
  }


  return (
    sorted[
      middle -
        1
    ] +
    sorted[
      middle
    ]
  ) /
    2;
}


// ============================================================
// ODDS API
// ============================================================

function toOddsApiTime(
  date:
    Date
) {
  return date
    .toISOString()
    .replace(
      /\.\d{3}Z$/,
      "Z"
    );
}


async function fetchNcaambOdds(
  apiKey:
    string,

  window:
    PullWindow
): Promise<ProviderResponse> {
  const url =
    new URL(
      `https://api.the-odds-api.com/v4/sports/${NCAAMB_ODDS_SPORT_KEY}/odds`
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
    "bookmakers",
    Array.from(
      G365_APPROVED_SPORTSBOOK_KEYS
    ).join(",")
  );


  /*
   * Spreads and totals are retrieved in the same provider call.
   */
  url.searchParams.set(
    "markets",
    "spreads,totals"
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
    toOddsApiTime(
      window
        .gameWindowStartsAt
    )
  );


  url.searchParams.set(
    "commenceTimeTo",
    toOddsApiTime(
      window
        .gameWindowEndsAt
    )
  );


  const response =
    await fetch(
      url,
      {
        method:
          "GET",

        cache:
          "no-store",
      }
    );


  const text =
    await response
      .text();


  let parsed:
    unknown =
      null;


  try {
    parsed =
      JSON.parse(
        text
      );
  } catch {
    parsed =
      null;
  }


  if (
    !response.ok
  ) {
    throw new Error(
      `The Odds API NCAAMB request failed with HTTP ${response.status}: ${text.slice(
        0,
        500
      )}`
    );
  }


  const usedHeader =
    response.headers.get(
      "x-requests-used"
    );


  const remainingHeader =
    response.headers.get(
      "x-requests-remaining"
    );


  const used =
    usedHeader ===
      null
      ? null
      : Number(
          usedHeader
        );


  const remaining =
    remainingHeader ===
      null
      ? null
      : Number(
          remainingHeader
        );


  return {
    events:
      Array.isArray(
        parsed
      )
        ? parsed as OddsEvent[]
        : [],

    used:
      Number.isFinite(
        used
      )
        ? used
        : null,

    remaining:
      Number.isFinite(
        remaining
      )
        ? remaining
        : null,
  };
}


// ============================================================
// REQUEST PARSING
// ============================================================

async function readRequestOptions(
  request:
    Request
): Promise<RequestBody> {
  const url =
    new URL(
      request.url
    );


  let body:
    RequestBody =
      {};


  if (
    request.method ===
    "POST"
  ) {
    try {
      body =
        await request
          .json() as RequestBody;
    } catch {
      body =
        {};
    }
  }


  const leagueId =
    body.leagueId ??
    url.searchParams.get(
      "leagueId"
    ) ??
    undefined;


  const season =
    body.season ??
    parseInteger(
      url.searchParams.get(
        "season"
      )
    ) ??
    undefined;


  const week =
    body.week ??
    parseInteger(
      url.searchParams.get(
        "week"
      )
    ) ??
    undefined;


  const previewParam =
    url.searchParams.get(
      "preview"
    );


  const preview =
    body.preview ===
      true ||
    previewParam ===
      "true";


  const requestedWindow =
    body.pullWindow ??
    url.searchParams.get(
      "pullWindow"
    ) ??
    undefined;


  const anchorDate =
    body.anchorDate ??
    url.searchParams.get(
      "anchorDate"
    ) ??
    undefined;


  let pullWindow:
    PullWindowKey |
    undefined;


  if (
    requestedWindow ===
      "sunday_mon_thu" ||
    requestedWindow ===
      "thursday_fri_sun"
  ) {
    pullWindow =
      requestedWindow;
  }


  return {
    leagueId,
    season,
    week,
    preview,
    pullWindow,
    anchorDate,
  };
}


// ============================================================
// PREVIEW WINDOW
// ============================================================

function getPreviewPullWindow(
  options:
    RequestBody,

  now:
    Date
) {
  if (
    options.pullWindow &&
    options.anchorDate
  ) {
    if (
      !isIsoDate(
        options.anchorDate
      )
    ) {
      throw new Error(
        "preview anchorDate must be YYYY-MM-DD."
      );
    }


    return buildPullWindow(
      options.pullWindow,
      options.anchorDate
    );
  }


  const automatic =
    getAutomaticPullWindow(
      now
    );


  if (
    automatic
  ) {
    return automatic;
  }


  throw new Error(
    "Preview outside a Sunday/Thursday automatic window requires pullWindow and anchorDate."
  );
}


// ============================================================
// PROCESS ONE GAME
// ============================================================

async function processGame(
  supabase:
    SupabaseAdminClient,

  game:
    PickemGameRow,

  event:
    OddsEvent | null,

  window:
    PullWindow,

  capturedAt:
    string
): Promise<GameProcessingResult> {
  const result:
    GameProcessingResult = {
      gameId:
        game.id,

      leagueId:
        game.league_id,

      pickemWeekId:
        game.pickem_week_id,

      season:
        game.season,

      week:
        game.week,

      providerEventId:
        game.provider_event_id,

      kickoffAt:
        game.kickoff_at,

      status:
        "PENDING",

      matched:
        event !==
        null,

      sportsbookSpreadCount:
        0,

      sportsbookTotalCount:
        0,

      spreadFrozen:
        false,

      spreadExcluded:
        false,

      totalFrozen:
        false,

      totalExcluded:
        false,

      sourceLinesInserted:
        0,

      errors:
        [],
    };


  // ==========================================================
  // NO PROVIDER EVENT
  //
  // There are no rolling NCAAMB retries.
  //
  // The scheduled Sunday/Thursday snapshot is authoritative.
  // Existing freeze functions determine whether a market has
  // enough sources to freeze or must be excluded.
  // ==========================================================

  if (
    !event
  ) {
    if (
      game.spread_status !==
        "frozen" &&
      game.spread_status !==
        "excluded"
    ) {
      const {
        data:
          spreadFreezeData,

        error:
          spreadFreezeError,
      } =
        await supabase.rpc(
          "freeze_pickem_g365_spread",
          {
            p_pickem_game_id:
              game.id,
          }
        );


      if (
        spreadFreezeError
      ) {
        result.errors.push(
          `Spread freeze: ${spreadFreezeError.message}`
        );
      } else {
        const spreadFreeze =
          (
            spreadFreezeData ??
            {}
          ) as {
            success?:
              boolean;

            excluded?:
              boolean;
          };


        result.spreadFrozen =
          spreadFreeze
            .success ===
            true &&
          spreadFreeze
            .excluded !==
            true;


        result.spreadExcluded =
          spreadFreeze
            .excluded ===
          true;
      }
    }


    if (
      game.total_status !==
        "frozen" &&
      game.total_status !==
        "excluded"
    ) {
      const {
        data:
          totalFreezeData,

        error:
          totalFreezeError,
      } =
        await supabase.rpc(
          "freeze_pickem_g365_total",
          {
            p_pickem_game_id:
              game.id,
          }
        );


      if (
        totalFreezeError
      ) {
        result.errors.push(
          `Total freeze: ${totalFreezeError.message}`
        );
      } else {
        const totalFreeze =
          (
            totalFreezeData ??
            {}
          ) as {
            success?:
              boolean;

            excluded?:
              boolean;
          };


        result.totalFrozen =
          totalFreeze
            .success ===
            true &&
          totalFreeze
            .excluded !==
            true;


        result.totalExcluded =
          totalFreeze
            .excluded ===
          true;
      }
    }


    result.status =
      result.errors.length >
        0
        ? "UNMATCHED_WITH_ERRORS"
        : "UNMATCHED_SNAPSHOT_COMPLETE";


    return result;
  }


  // ==========================================================
  // SPREAD SOURCES
  // ==========================================================

  const spreads =
    getBookmakerSpreads(
      event
    );


  result
    .sportsbookSpreadCount =
    spreads.length;


  if (
    game.spread_status !==
      "frozen" &&
    game.spread_status !==
      "excluded"
  ) {
    for (
      const spread of
      spreads
    ) {
      const {
        data:
          ingestData,

        error:
          ingestError,
      } =
        await supabase.rpc(
          "ingest_pickem_line_source_service",
          {
            p_pickem_game_id:
              game.id,

            p_source_provider:
              "the-odds-api",

            p_sportsbook_key:
              spread
                .sportsbookKey,

            p_sportsbook_name:
              spread
                .sportsbookName,

            p_home_spread:
              spread
                .homeSpread,

            p_away_spread:
              spread
                .awaySpread,

            p_source_event_id:
              event.id ??
              null,

            p_source_market_key:
              "spreads",

            p_raw_audit: {
              provider:
                "the-odds-api",

              sport:
                "ncaamb",

              providerSportKey:
                event
                  .sport_key ??
                NCAAMB_ODDS_SPORT_KEY,

              providerEventId:
                event.id ??
                null,

              providerCommenceTime:
                event
                  .commence_time ??
                null,

              providerHomeTeam:
                event
                  .home_team ??
                null,

              providerAwayTeam:
                event
                  .away_team ??
                null,

              bookmakerLastUpdate:
                spread
                  .bookmakerLastUpdate,

              marketLastUpdate:
                spread
                  .marketLastUpdate,

              homePrice:
                spread
                  .homePrice,

              awayPrice:
                spread
                  .awayPrice,

              g365NcaambPullWindow:
                window.key,

              scheduledFor:
                window
                  .scheduledFor
                  .toISOString(),

              capturedAt,
            },
          }
        );


      if (
        ingestError
      ) {
        result.errors.push(
          `Spread source ${spread.sportsbookKey}: ${ingestError.message}`
        );

        continue;
      }


      const ingest =
        (
          ingestData ??
          {}
        ) as {
          inserted?:
            boolean;

          duplicate?:
            boolean;

          success?:
            boolean;
        };


      if (
        ingest.inserted ===
        true
      ) {
        result
          .sourceLinesInserted +=
          1;
      }
    }


    const {
      data:
        spreadFreezeData,

      error:
        spreadFreezeError,
    } =
      await supabase.rpc(
        "freeze_pickem_g365_spread",
        {
          p_pickem_game_id:
            game.id,
        }
      );


    if (
      spreadFreezeError
    ) {
      result.errors.push(
        `Spread freeze: ${spreadFreezeError.message}`
      );
    } else {
      const spreadFreeze =
        (
          spreadFreezeData ??
          {}
        ) as {
          success?:
            boolean;

          excluded?:
            boolean;
        };


      result.spreadExcluded =
        spreadFreeze
          .excluded ===
        true;


      result.spreadFrozen =
        spreadFreeze
          .success ===
          true &&
        spreadFreeze
          .excluded !==
          true;
    }
  }


  // ==========================================================
  // TOTAL SOURCES
  // ==========================================================

  const totals =
    getBookmakerTotals(
      event
    );


  result
    .sportsbookTotalCount =
    totals.length;


  if (
    game.total_status !==
      "frozen" &&
    game.total_status !==
      "excluded"
  ) {
    const totalRows =
      totals.map(
        (
          total
        ) => ({
          pickem_game_id:
            game.id,

          captured_at:
            capturedAt,

          source_provider:
            "the-odds-api",

          sportsbook_key:
            total
              .sportsbookKey,

          sportsbook_name:
            total
              .sportsbookName,

          home_spread:
            null,

          away_spread:
            null,

          total_points:
            total.total,

          source_event_id:
            event.id ??
            null,

          source_market_key:
            "totals",

          raw_audit: {
            provider:
              "the-odds-api",

            sport:
              "ncaamb",

            providerSportKey:
              event
                .sport_key ??
              NCAAMB_ODDS_SPORT_KEY,

            providerEventId:
              event.id ??
              null,

            providerCommenceTime:
              event
                .commence_time ??
              null,

            providerHomeTeam:
              event
                .home_team ??
              null,

            providerAwayTeam:
              event
                .away_team ??
              null,

            bookmakerLastUpdate:
              total
                .bookmakerLastUpdate,

            marketLastUpdate:
              total
                .marketLastUpdate,

            overPrice:
              total
                .overPrice,

            underPrice:
              total
                .underPrice,

            g365NcaambPullWindow:
              window.key,

            scheduledFor:
              window
                .scheduledFor
                .toISOString(),

            capturedAt,
          },
        })
      );


    if (
      totalRows.length >
      0
    ) {
      const {
        error:
          totalInsertError,
      } =
        await supabase
          .from(
            "pickem_line_sources"
          )
          .insert(
            totalRows
          );


      if (
        totalInsertError
      ) {
        result.errors.push(
          `Total sources: ${totalInsertError.message}`
        );
      } else {
        result
          .sourceLinesInserted +=
          totalRows.length;
      }
    }


    const {
      data:
        totalFreezeData,

      error:
        totalFreezeError,
    } =
      await supabase.rpc(
        "freeze_pickem_g365_total",
        {
          p_pickem_game_id:
            game.id,
        }
      );


    if (
      totalFreezeError
    ) {
      result.errors.push(
        `Total freeze: ${totalFreezeError.message}`
      );
    } else {
      const totalFreeze =
        (
          totalFreezeData ??
          {}
        ) as {
          success?:
            boolean;

          excluded?:
            boolean;
        };


      result.totalExcluded =
        totalFreeze
          .excluded ===
        true;


      result.totalFrozen =
        totalFreeze
          .success ===
          true &&
        totalFreeze
          .excluded !==
          true;
    }
  }


  result.status =
    result.errors.length >
      0
      ? "MATCHED_WITH_ERRORS"
      : "MATCHED_SNAPSHOT_COMPLETE";


  return result;
}


// ============================================================
// MAIN
// ============================================================

async function runSync(
  request:
    Request
) {
  let globalRunId:
    number | null =
      null;


  const leagueWindowIds =
    new Map<
      string,
      number
    >();


  try {
    const {
      supabaseUrl,
      serviceRoleKey,
      syncSecret,
      oddsApiKey,
    } =
      getEnv();


    const suppliedSecret =
      getSuppliedSecret(
        request
      );


    if (
      !suppliedSecret ||
      suppliedSecret !==
        syncSecret
    ) {
      return NextResponse.json(
        {
          success:
            false,

          error:
            "Unauthorized NCAAMB line sync request.",
        },
        {
          status:
            401,
        }
      );
    }


    const options =
      await readRequestOptions(
        request
      );


    /*
     * Explicit any/admin typing is intentional until the
     * generated Supabase schema types include the new NCAAMB
     * tables and RPC functions.
     */
    const supabase:
      SupabaseAdminClient =
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


    // ========================================================
    // DETERMINE WINDOW
    // ========================================================

    const window =
      options.preview
        ? getPreviewPullWindow(
            options,
            now
          )
        : getAutomaticPullWindow(
            now
          );


    /*
     * Normal cron response outside the two weekly pull windows.
     *
     * NO Odds API request.
     */
    if (
      !window
    ) {
      return NextResponse.json(
        {
          success:
            true,

          sport:
            "ncaamb",

          provider:
            "the-odds-api",

          preview:
            false,

          pullDue:
            false,

          providerRequests:
            0,

          requestCreditsUsed:
            null,

          requestCreditsRemaining:
            null,

          message:
            "No NCAAMB Odds API pull is scheduled right now.",

          automaticSchedule: {
            sunday:
              "10:00 AM America/New_York",

            sundayGames:
              "Monday through Thursday",

            thursday:
              "10:00 AM America/New_York",

            thursdayGames:
              "Friday through Sunday",
          },

          cron81Changed:
            false,
        }
      );
    }


    // ========================================================
    // TARGET LEAGUES
    // ========================================================

    const {
      data:
        targetData,

      error:
        targetError,
    } =
      await supabase.rpc(
        "get_ncaamb_pickem_sync_targets"
      );


    if (
      targetError
    ) {
      throw new Error(
        `Could not load NCAAMB Pick'em targets: ${targetError.message}`
      );
    }


    let targets =
      (
        targetData ??
        []
      ) as unknown as NcaambSyncTarget[];


    if (
      options.leagueId
    ) {
      targets =
        targets.filter(
          (
            target
          ) =>
            target.league_id ===
            options.leagueId
        );
    }


    if (
      typeof options.season ===
        "number"
    ) {
      targets =
        targets.filter(
          (
            target
          ) =>
            target.season ===
            options.season
        );
    }


    if (
      targets.length ===
      0
    ) {
      return NextResponse.json(
        {
          success:
            true,

          sport:
            "ncaamb",

          provider:
            "the-odds-api",

          preview:
            options.preview ===
            true,

          pullDue:
            true,

          pullWindow:
            window.key,

          scheduledFor:
            window
              .scheduledFor
              .toISOString(),

          gameWindow: {
            from:
              window
                .gameWindowStartsAt
                .toISOString(),

            to:
              window
                .gameWindowEndsAt
                .toISOString(),
          },

          targetLeagues:
            0,

          gamesQueued:
            0,

          providerRequests:
            0,

          message:
            "No NCAAMB-enabled Pick'em leagues matched this request.",
        }
      );
    }


    const targetLeagueIds =
      targets.map(
        (
          target
        ) =>
          target.league_id
      );


    // ========================================================
    // LOAD ONLY GAMES BELONGING TO THIS SNAPSHOT
    // ========================================================

    let gameQuery =
      supabase
        .from(
          "pickem_games"
        )
        .select(
          [
            "id",
            "league_id",
            "pickem_week_id",
            "season",
            "week",
            "sport",
            "provider_event_id",
            "kickoff_at",
            "away_team_name",
            "away_team_abbreviation",
            "away_team_espn_id",
            "home_team_name",
            "home_team_abbreviation",
            "home_team_espn_id",
            "spread_status",
            "total_status",
            "is_started",
            "is_final",
          ].join(",")
        )
        .eq(
          "sport",
          "ncaamb"
        )
        .in(
          "league_id",
          targetLeagueIds
        )
        .gte(
          "kickoff_at",
          window
            .gameWindowStartsAt
            .toISOString()
        )
        .lt(
          "kickoff_at",
          window
            .gameWindowEndsAt
            .toISOString()
        )
        .eq(
          "is_started",
          false
        )
        .eq(
          "is_final",
          false
        )
        .order(
          "kickoff_at",
          {
            ascending:
              true,
          }
        );


    if (
      typeof options.week ===
        "number"
    ) {
      gameQuery =
        gameQuery.eq(
          "week",
          options.week
        );
    }


    const {
      data:
        gameData,

      error:
        gameError,
    } =
      await gameQuery;


    if (
      gameError
    ) {
      throw new Error(
        `Could not load NCAAMB snapshot games: ${gameError.message}`
      );
    }


    const allGames =
      (
        gameData ??
        []
      ) as unknown as PickemGameRow[];


    /*
     * Games already complete for both supported markets do not
     * need another snapshot.
     */
    const games =
      allGames.filter(
        (
          game
        ) =>
          !(
            (
              game.spread_status ===
                "frozen" ||
              game.spread_status ===
                "excluded"
            ) &&
            (
              game.total_status ===
                "frozen" ||
              game.total_status ===
                "excluded"
            )
          )
      );


    /*
     * Do not claim the scheduled provider run if ESPN has not
     * supplied any games yet.
     *
     * This lets cron 81 check again later that same day without
     * spending an Odds API request.
     */
    if (
      games.length ===
      0
    ) {
      return NextResponse.json(
        {
          success:
            true,

          sport:
            "ncaamb",

          provider:
            "the-odds-api",

          preview:
            options.preview ===
            true,

          pullDue:
            true,

          pullWindow:
            window.key,

          scheduledFor:
            window
              .scheduledFor
              .toISOString(),

          gameWindow: {
            from:
              window
                .gameWindowStartsAt
                .toISOString(),

            to:
              window
                .gameWindowEndsAt
                .toISOString(),
          },

          targetLeagues:
            targets.length,

          gamesQueued:
            0,

          providerRequests:
            0,

          message:
            "No unresolved NCAAMB games were available for this Sunday/Thursday snapshot. No provider call was consumed.",
        }
      );
    }


    // ========================================================
    // PREVIEW
    //
    // READ ONLY:
    //
    // - no provider ledger claim
    // - no league ledger claim
    // - no source writes
    // - no line freezes
    //
    // Preview DOES intentionally call The Odds API.
    // ========================================================

    if (
      options.preview
    ) {
      const provider =
        await fetchNcaambOdds(
          oddsApiKey,
          window
        );


      const previewGames =
        games.map(
          (
            game
          ) => {
            const match =
              findMatchingOddsEventDetailed(
                game,
                provider.events
              );


            if (
              !match
            ) {
              return {
                gameId:
                  game.id,

                leagueId:
                  game.league_id,

                pickemWeekId:
                  game.pickem_week_id,

                season:
                  game.season,

                week:
                  game.week,

                kickoffAt:
                  game.kickoff_at,

                awayTeam:
                  game.away_team_name,

                homeTeam:
                  game.home_team_name,

                status:
                  "UNMATCHED",

                spreadBooks:
                  0,

                totalBooks:
                  0,

                proposedHomeSpread:
                  null,

                proposedTotal:
                  null,
              };
            }


            const spreads =
              getBookmakerSpreads(
                match.event
              );


            const totals =
              getBookmakerTotals(
                match.event
              );


            return {
              gameId:
                game.id,

              leagueId:
                game.league_id,

              pickemWeekId:
                game.pickem_week_id,

              season:
                game.season,

              week:
                game.week,

              kickoffAt:
                game.kickoff_at,

              awayTeam:
                game.away_team_name,

              homeTeam:
                game.home_team_name,

              status:
                "MATCHED",

              providerEventId:
                match.event
                  .id ??
                null,

              providerKickoff:
                match.event
                  .commence_time ??
                null,

              homeSimilarity:
                Number(
                  match
                    .homeSimilarity
                    .toFixed(
                      3
                    )
                ),

              awaySimilarity:
                Number(
                  match
                    .awaySimilarity
                    .toFixed(
                      3
                    )
                ),

              kickoffDifferenceMinutes:
                match
                  .kickoffDifferenceMinutes,

              spreadBooks:
                spreads.length,

              totalBooks:
                totals.length,

              proposedHomeSpread:
                median(
                  spreads.map(
                    (
                      spread
                    ) =>
                      spread.homeSpread
                  )
                ),

              proposedTotal:
                median(
                  totals.map(
                    (
                      total
                    ) =>
                      total.total
                  )
                ),
            };
          }
        );


      return NextResponse.json(
        {
          success:
            true,

          sport:
            "ncaamb",

          provider:
            "the-odds-api",

          preview:
            true,

          readOnly:
            true,

          pullWindow:
            window.key,

          pullWindowLabel:
            window.label,

          anchorDate:
            window.anchorDate,

          scheduledFor:
            window
              .scheduledFor
              .toISOString(),

          gameWindow: {
            from:
              window
                .gameWindowStartsAt
                .toISOString(),

            to:
              window
                .gameWindowEndsAt
                .toISOString(),
          },

          approvedSportsbooks:
            Array.from(
              G365_APPROVED_SPORTSBOOK_KEYS
            ),

          targetLeagues:
            targets.length,

          gamesQueued:
            games.length,

          gamesMatched:
            previewGames.filter(
              (
                game
              ) =>
                game.status ===
                "MATCHED"
            ).length,

          gamesUnmatched:
            previewGames.filter(
              (
                game
              ) =>
                game.status ===
                "UNMATCHED"
            ).length,

          providerRequests:
            1,

          requestCreditsUsed:
            provider.used,

          requestCreditsRemaining:
            provider.remaining,

          games:
            previewGames,
        }
      );
    }


    // ========================================================
    // ATOMIC GLOBAL PROVIDER CLAIM
    //
    // Only one cron execution can win this claim.
    // ========================================================

    const {
      data:
        globalClaimData,

      error:
        globalClaimError,
    } =
      await supabase.rpc(
        "claim_ncaamb_provider_pull_run",
        {
          p_pull_window:
            window.key,

          p_scheduled_for:
            window
              .scheduledFor
              .toISOString(),

          p_game_window_starts_at:
            window
              .gameWindowStartsAt
              .toISOString(),

          p_game_window_ends_at:
            window
              .gameWindowEndsAt
              .toISOString(),
        }
      );


    if (
      globalClaimError
    ) {
      throw new Error(
        `Could not claim NCAAMB global provider window: ${globalClaimError.message}`
      );
    }


    const globalClaim =
      (
        globalClaimData ??
        {}
      ) as {
        claimed?:
          boolean;

        runId?:
          number;

        status?:
          string;

        reason?:
          string;

        providerRequestMade?:
          boolean;

        providerRequests?:
          number;
      };


    /*
     * Every later cron invocation on the same Sunday/Thursday
     * exits here and costs zero additional provider requests.
     */
    if (
      globalClaim
        .claimed !==
      true
    ) {
      return NextResponse.json(
        {
          success:
            true,

          sport:
            "ncaamb",

          provider:
            "the-odds-api",

          preview:
            false,

          pullDue:
            true,

          pullWindow:
            window.key,

          scheduledFor:
            window
              .scheduledFor
              .toISOString(),

          alreadyProcessed:
            true,

          globalRunId:
            globalClaim
              .runId ??
            null,

          existingStatus:
            globalClaim
              .status ??
            null,

          providerRequests:
            0,

          requestCreditsUsed:
            null,

          requestCreditsRemaining:
            null,

          message:
            "This NCAAMB Sunday/Thursday provider snapshot was already claimed. No Odds API call was made.",
        }
      );
    }


    globalRunId =
      Number(
        globalClaim
          .runId
      );


    if (
      !Number.isInteger(
        globalRunId
      )
    ) {
      throw new Error(
        "Global NCAAMB provider claim did not return a valid run ID."
      );
    }


    // ========================================================
    // LEAGUE / WEEK CLAIMS
    // ========================================================

    const uniqueLeagueWeeks =
      new Map<
        string,
        PickemGameRow
      >();


    for (
      const game of
      games
    ) {
      const key =
        `${game.league_id}:${game.pickem_week_id}`;


      if (
        !uniqueLeagueWeeks
          .has(
            key
          )
      ) {
        uniqueLeagueWeeks
          .set(
            key,
            game
          );
      }
    }


    const allowedLeagueWeeks =
      new Set<
        string
      >();


    for (
      const [
        key,
        game,
      ] of
      uniqueLeagueWeeks
    ) {
      const {
        data:
          leagueClaimData,

        error:
          leagueClaimError,
      } =
        await supabase.rpc(
          "claim_ncaamb_line_pull_window",
          {
            p_league_id:
              game
                .league_id,

            p_pickem_week_id:
              game
                .pickem_week_id,

            p_pull_window:
              window.key,

            p_scheduled_for:
              window
                .scheduledFor
                .toISOString(),

            p_game_window_starts_at:
              window
                .gameWindowStartsAt
                .toISOString(),

            p_game_window_ends_at:
              window
                .gameWindowEndsAt
                .toISOString(),
          }
        );


      if (
        leagueClaimError
      ) {
        throw new Error(
          `Could not claim NCAAMB league window for ${key}: ${leagueClaimError.message}`
        );
      }


      const leagueClaim =
        (
          leagueClaimData ??
          {}
        ) as {
          claimed?:
            boolean;

          windowId?:
            number;
        };


      if (
        leagueClaim
          .claimed ===
          true &&
        Number.isInteger(
          Number(
            leagueClaim
              .windowId
          )
        )
      ) {
        const windowId =
          Number(
            leagueClaim
              .windowId
          );


        leagueWindowIds
          .set(
            key,
            windowId
          );


        allowedLeagueWeeks
          .add(
            key
          );
      }
    }


    const gamesToProcess =
      games.filter(
        (
          game
        ) =>
          allowedLeagueWeeks
            .has(
              `${game.league_id}:${game.pickem_week_id}`
            )
      );


    if (
      gamesToProcess.length ===
      0
    ) {
      await supabase.rpc(
        "finish_ncaamb_provider_pull_run",
        {
          p_run_id:
            globalRunId,

          p_success:
            true,

          p_provider_request_made:
            false,

          p_provider_requests:
            0,

          p_request_credits_used:
            null,

          p_request_credits_remaining:
            null,

          p_leagues_processed:
            0,

          p_games_considered:
            0,

          p_games_matched:
            0,

          p_games_frozen:
            0,

          p_games_excluded:
            0,

          p_source_lines_inserted:
            0,

          p_error_message:
            null,

          p_result_audit: {
            reason:
              "No league/week window required processing.",
          },
        }
      );


      return NextResponse.json(
        {
          success:
            true,

          sport:
            "ncaamb",

          provider:
            "the-odds-api",

          pullWindow:
            window.key,

          providerRequests:
            0,

          message:
            "The global window was claimed, but no league/week window required a provider snapshot.",
        }
      );
    }


    // ========================================================
    // ONE GLOBAL ODDS API CALL
    // ========================================================

    let provider:
      ProviderResponse;


    try {
      provider =
        await fetchNcaambOdds(
          oddsApiKey,
          window
        );
    } catch (
      providerError
    ) {
      const message =
        providerError instanceof
          Error
          ? providerError
              .message
          : "NCAAMB Odds API request failed.";


      for (
        const windowId of
        leagueWindowIds
          .values()
      ) {
        await supabase.rpc(
          "finish_ncaamb_line_pull_window",
          {
            p_window_id:
              windowId,

            p_success:
              false,

            p_provider_request_made:
              true,

            p_provider_requests:
              1,

            p_request_credits_used:
              null,

            p_request_credits_remaining:
              null,

            p_games_considered:
              0,

            p_games_matched:
              0,

            p_games_frozen:
              0,

            p_games_excluded:
              0,

            p_source_lines_inserted:
              0,

            p_error_message:
              message,

            p_result_audit: {
              pullWindow:
                window.key,
            },
          }
        );
      }


      await supabase.rpc(
        "finish_ncaamb_provider_pull_run",
        {
          p_run_id:
            globalRunId,

          p_success:
            false,

          p_provider_request_made:
            true,

          p_provider_requests:
            1,

          p_request_credits_used:
            null,

          p_request_credits_remaining:
            null,

          p_leagues_processed:
            0,

          p_games_considered:
            gamesToProcess.length,

          p_games_matched:
            0,

          p_games_frozen:
            0,

          p_games_excluded:
            0,

          p_source_lines_inserted:
            0,

          p_error_message:
            message,

          p_result_audit: {
            pullWindow:
              window.key,

            scheduledFor:
              window
                .scheduledFor
                .toISOString(),
          },
        }
      );


      throw providerError;
    }


    // ========================================================
    // PROCESS SNAPSHOT
    // ========================================================

    const gameResults:
      GameProcessingResult[] =
        [];


    for (
      const game of
      gamesToProcess
    ) {
      const match =
        findMatchingOddsEventDetailed(
          game,
          provider.events
        );


      const processed =
        await processGame(
          supabase,
          game,
          match?.event ??
            null,
          window,
          nowIso
        );


      gameResults.push(
        processed
      );
    }


    // ========================================================
    // COUNTS
    // ========================================================

    const gamesMatched =
      gameResults.filter(
        (
          result
        ) =>
          result.matched
      ).length;


    const gamesFrozen =
      gameResults.filter(
        (
          result
        ) =>
          result
            .spreadFrozen
      ).length;


    const gamesExcluded =
      gameResults.filter(
        (
          result
        ) =>
          result
            .spreadExcluded
      ).length;


    const sourceLinesInserted =
      gameResults.reduce(
        (
          total,
          result
        ) =>
          total +
          result
            .sourceLinesInserted,
        0
      );


    const processingErrors =
      gameResults.flatMap(
        (
          result
        ) =>
          result.errors
            .map(
              (
                error
              ) =>
                `Game ${result.gameId}: ${error}`
            )
      );


    // ========================================================
    // FINISH LEAGUE / WEEK AUDITS
    // ========================================================

    for (
      const [
        key,
        windowId,
      ] of
      leagueWindowIds
    ) {
      const [
        leagueId,
        weekIdText,
      ] =
        key.split(
          ":"
        );


      const pickemWeekId =
        Number(
          weekIdText
        );


      const leagueResults =
        gameResults.filter(
          (
            result
          ) =>
            result.leagueId ===
              leagueId &&
            result.pickemWeekId ===
              pickemWeekId
        );


      const leagueErrors =
        leagueResults.flatMap(
          (
            result
          ) =>
            result.errors
        );


      const leagueMatched =
        leagueResults.filter(
          (
            result
          ) =>
            result.matched
        ).length;


      const leagueFrozen =
        leagueResults.filter(
          (
            result
          ) =>
            result
              .spreadFrozen
        ).length;


      const leagueExcluded =
        leagueResults.filter(
          (
            result
          ) =>
            result
              .spreadExcluded
        ).length;


      const leagueSources =
        leagueResults.reduce(
          (
            total,
            result
          ) =>
            total +
            result
              .sourceLinesInserted,
          0
        );


      await supabase.rpc(
        "finish_ncaamb_line_pull_window",
        {
          p_window_id:
            windowId,

          p_success:
            leagueErrors.length ===
            0,

          p_provider_request_made:
            true,

          /*
           * The provider call was global/shared, but this league
           * participated in that one scheduled snapshot.
           */
          p_provider_requests:
            1,

          p_request_credits_used:
            provider.used,

          p_request_credits_remaining:
            provider.remaining,

          p_games_considered:
            leagueResults.length,

          p_games_matched:
            leagueMatched,

          p_games_frozen:
            leagueFrozen,

          p_games_excluded:
            leagueExcluded,

          p_source_lines_inserted:
            leagueSources,

          p_error_message:
            leagueErrors.length >
              0
              ? leagueErrors
                  .join(
                    " | "
                  )
                  .slice(
                    0,
                    4000
                  )
              : null,

          p_result_audit: {
            pullWindow:
              window.key,

            scheduledFor:
              window
                .scheduledFor
                .toISOString(),

            providerRequestSharedGlobally:
              true,

            gameResults:
              leagueResults,
          },
        }
      );
    }


    // ========================================================
    // FINISH GLOBAL RUN
    // ========================================================

    const distinctLeagues =
      new Set(
        gamesToProcess.map(
          (
            game
          ) =>
            game.league_id
        )
      ).size;


    const globalSuccess =
      processingErrors.length ===
      0;


    const {
      error:
        globalFinishError,
    } =
      await supabase.rpc(
        "finish_ncaamb_provider_pull_run",
        {
          p_run_id:
            globalRunId,

          p_success:
            globalSuccess,

          p_provider_request_made:
            true,

          p_provider_requests:
            1,

          p_request_credits_used:
            provider.used,

          p_request_credits_remaining:
            provider.remaining,

          p_leagues_processed:
            distinctLeagues,

          p_games_considered:
            gameResults.length,

          p_games_matched:
            gamesMatched,

          p_games_frozen:
            gamesFrozen,

          p_games_excluded:
            gamesExcluded,

          p_source_lines_inserted:
            sourceLinesInserted,

          p_error_message:
            processingErrors.length >
              0
              ? processingErrors
                  .join(
                    " | "
                  )
                  .slice(
                    0,
                    4000
                  )
              : null,

          p_result_audit: {
            pullWindow:
              window.key,

            pullWindowLabel:
              window.label,

            scheduledFor:
              window
                .scheduledFor
                .toISOString(),

            gameWindowStartsAt:
              window
                .gameWindowStartsAt
                .toISOString(),

            gameWindowEndsAt:
              window
                .gameWindowEndsAt
                .toISOString(),

            providerEventsReceived:
              provider.events
                .length,

            gameResults,
          },
        }
      );


    if (
      globalFinishError
    ) {
      throw new Error(
        `Could not finish NCAAMB provider-run audit: ${globalFinishError.message}`
      );
    }


    // ========================================================
    // RESPONSE
    // ========================================================

    return NextResponse.json(
      {
        success:
          globalSuccess,

        sport:
          "ncaamb",

        provider:
          "the-odds-api",

        preview:
          false,

        pullWindow:
          window.key,

        pullWindowLabel:
          window.label,

        anchorDate:
          window
            .anchorDate,

        scheduledFor:
          window
            .scheduledFor
            .toISOString(),

        gameWindow: {
          from:
            window
              .gameWindowStartsAt
              .toISOString(),

          to:
            window
              .gameWindowEndsAt
              .toISOString(),
        },

        approvedSportsbooks:
          Array.from(
            G365_APPROVED_SPORTSBOOK_KEYS
          ),

        globalRunId,

        targetLeagues:
          targets.length,

        leaguesProcessed:
          distinctLeagues,

        gamesQueued:
          gamesToProcess.length,

        gamesMatched,

        gamesUnmatched:
          gamesToProcess.length -
          gamesMatched,

        gamesFrozen,

        gamesExcluded,

        sourceLinesInserted,

        processingErrors:
          processingErrors.length,

        providerRequests:
          1,

        requestCreditsUsed:
          provider.used,

        requestCreditsRemaining:
          provider.remaining,

        automaticSchedule: {
          sunday:
            "10:00 AM America/New_York",

          sundayGames:
            "Monday through Thursday",

          thursday:
            "10:00 AM America/New_York",

          thursdayGames:
            "Friday through Sunday",
        },

        cron81Changed:
          false,

        results:
          gameResults,
      },
      {
        status:
          globalSuccess
            ? 200
            : 207,
      }
    );
  } catch (
    error
  ) {
    return NextResponse.json(
      {
        success:
          false,

        sport:
          "ncaamb",

        provider:
          "the-odds-api",

        error:
          error instanceof
            Error
            ? error.message
            : "Automatic NCAAMB sportsbook line sync failed.",

        globalRunId,
      },
      {
        status:
          500,
      }
    );
  }
}


// ============================================================
// GET
// ============================================================

export async function GET(
  request:
    Request
) {
  return runSync(
    request
  );
}


// ============================================================
// POST
// ============================================================

export async function POST(
  request:
    Request
) {
  return runSync(
    request
  );
}