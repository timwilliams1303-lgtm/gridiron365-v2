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

type RequestBody = {
  season?: number;
  startDate?: string;
  endDate?: string;
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

  score?: string;

  team?: EspnTeam;
};

type EspnVenue = {
  fullName?: string;
};

type EspnStatusType = {
  id?: string;
  name?: string;
  state?: string;
  completed?: boolean;
  description?: string;
  detail?: string;
  shortDetail?: string;
};

type EspnStatus = {
  period?: number;
  displayClock?: string;
  type?: EspnStatusType;
};

type EspnCompetition = {
  id?: string;
  date?: string;
  competitors?: EspnCompetitor[];
  status?: EspnStatus;
  venue?: EspnVenue;
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

  status?: EspnStatus;

  competitions?: EspnCompetition[];
};

type EspnScoreboard = {
  events?: EspnEvent[];
};

type NhlTeamRow = {
  id: number;
  espn_team_id: string | null;
  nhl_team_id: string | null;
  abbreviation: string;
  display_name: string;
};

type NormalizedNhlGame = {
  id: number;
  espn_event_id: string;
  season: number;

  season_type:
    | "regular"
    | "postseason";

  game_date: string;

  /*
   * Existing database column name is start_time.
   *
   * For NHL this semantically represents the game's
   * scheduled start time.
   */
  start_time: string;

  away_team_id: number;
  home_team_id: number;

  away_score: number;
  home_score: number;

  status_type: string | null;
  status_name: string | null;
  status_detail: string | null;

  period: number | null;
  display_clock: string | null;

  status_completed: boolean;

  is_overtime: boolean;
  is_shootout: boolean;

  venue_name: string | null;

  provider_data: Record<
    string,
    unknown
  >;

  updated_at: string;
};

const ESPN_NHL_SCOREBOARD =
  "https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard";

const ESPN_WINDOW_DAYS =
  14;

const SUPABASE_WRITE_BATCH_SIZE =
  100;

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
  request: Request
) {
  if (
    process.env.NODE_ENV !==
    "production"
  ) {
    return true;
  }

  const configuredSecret =
    process.env
      .GRIDIRON_SYNC_SECRET ??
    process.env
      .NFL_SYNC_SECRET;

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
      ? authorization.slice(7)
      : null;

  return (
    headerSecret ===
      configuredSecret ||
    bearerSecret ===
      configuredSecret
  );
}

function getNhlSeasonLabel(
  season: number
) {
  const followingYear =
    String(
      season + 1
    ).slice(-2);

  return `${season}-${followingYear}`;
}

function getDefaultSeason() {
  const now =
    new Date();

  /*
   * G365 NHL season convention:
   *
   * 2026-27 => season = 2026
   *
   * The integer stored throughout G365 is the
   * calendar year in which the NHL season begins.
   */
  return now.getUTCMonth() >=
    6
    ? now.getUTCFullYear()
    : now.getUTCFullYear() -
        1;
}

function yyyymmdd(
  value: Date
) {
  const year =
    value.getUTCFullYear();

  const month =
    String(
      value.getUTCMonth() +
        1
    ).padStart(
      2,
      "0"
    );

  const day =
    String(
      value.getUTCDate()
    ).padStart(
      2,
      "0"
    );

  return `${year}${month}${day}`;
}

function isoDateOnly(
  value: Date
) {
  return value
    .toISOString()
    .slice(
      0,
      10
    );
}

function normalizeRequestedDate(
  value:
    string |
    undefined,
  fallback: Date
) {
  if (!value) {
    return fallback;
  }

  const parsed =
    new Date(
      `${value}T00:00:00.000Z`
    );

  if (
    Number.isNaN(
      parsed.getTime()
    )
  ) {
    throw new Error(
      `Invalid date: ${value}`
    );
  }

  return parsed;
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
    return 0;
  }

  const parsed =
    Number(value);

  return Number.isFinite(
    parsed
  )
    ? Math.trunc(
        parsed
      )
    : 0;
}

function getSeasonType(
  espnSeasonType:
    number |
    undefined
):
  | "regular"
  | "postseason"
  | null {
  /*
   * ESPN NHL:
   *
   * 1 = preseason
   * 2 = regular season
   * 3 = postseason
   *
   * G365 intentionally excludes NHL preseason.
   */
  if (
    espnSeasonType ===
    2
  ) {
    return "regular";
  }

  if (
    espnSeasonType ===
    3
  ) {
    return "postseason";
  }

  return null;
}

function scoreboardUrl(
  startDate: Date,
  endDate: Date
) {
  const url =
    new URL(
      ESPN_NHL_SCOREBOARD
    );

  url.searchParams.set(
    "dates",
    `${yyyymmdd(
      startDate
    )}-${yyyymmdd(
      endDate
    )}`
  );

  url.searchParams.set(
    "limit",
    "1000"
  );

  return url.toString();
}

async function fetchScoreboard(
  startDate: Date,
  endDate: Date
) {
  const url =
    scoreboardUrl(
      startDate,
      endDate
    );

  const response =
    await fetch(
      url,
      {
        method:
          "GET",

        cache:
          "no-store",

        headers: {
          Accept:
            "application/json",

          "User-Agent":
            "Mozilla/5.0 Gridiron365/2.0",
        },
      }
    );

  const text =
    await response.text();

  if (!response.ok) {
    throw new Error(
      `ESPN NHL scoreboard returned HTTP ${response.status}: ${text.slice(
        0,
        300
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
      "ESPN NHL scoreboard returned invalid JSON."
    );
  }

  return {
    url,
    payload,
  };
}

function findCompetitor(
  competition:
    EspnCompetition,
  homeAway:
    | "home"
    | "away"
) {
  return (
    competition.competitors ??
    []
  ).find(
    (competitor) =>
      competitor.homeAway ===
      homeAway
  );
}

function buildStatusText(
  status:
    EspnStatus |
    undefined
) {
  return [
    status?.type?.name,
    status?.type?.description,
    status?.type?.detail,
    status?.type?.shortDetail,
  ]
    .filter(
      (
        value
      ): value is string =>
        typeof value ===
          "string" &&
        value.length > 0
    )
    .join(" ")
    .toUpperCase();
}

function detectShootout(
  status:
    EspnStatus |
    undefined
) {
  const text =
    buildStatusText(
      status
    );

  return (
    text.includes(
      "SHOOTOUT"
    ) ||
    /\bSO\b/.test(
      text
    )
  );
}

function detectOvertime(
  status:
    EspnStatus |
    undefined,
  isShootout:
    boolean
) {
  if (isShootout) {
    return true;
  }

  const text =
    buildStatusText(
      status
    );

  return (
    text.includes(
      "OVERTIME"
    ) ||
    /\bOT\b/.test(
      text
    ) ||
    (
      typeof status?.period ===
        "number" &&
      status.period > 3
    )
  );
}

function normalizeEvent(
  event:
    EspnEvent,
  teamMap:
    Map<
      string,
      NhlTeamRow
    >,
  g365Season:
    number,
  nowIso:
    string
):
  | NormalizedNhlGame
  | null {
  const seasonType =
    getSeasonType(
      event.season?.type
    );

  if (!seasonType) {
    return null;
  }

  const competition =
    event.competitions?.[0];

  if (!competition) {
    return null;
  }

  const eventId =
    event.id ??
    competition.id;

  /*
   * ESPN calls this the competition/event date.
   * For NHL this is the scheduled game start time.
   */
  const startTimeRaw =
    competition.date ??
    event.date;

  if (
    !eventId ||
    !startTimeRaw
  ) {
    return null;
  }

  const numericGameId =
    Number(
      eventId
    );

  if (
    !Number.isSafeInteger(
      numericGameId
    ) ||
    numericGameId <=
      0
  ) {
    return null;
  }

  const startTime =
    new Date(
      startTimeRaw
    );

  if (
    Number.isNaN(
      startTime.getTime()
    )
  ) {
    return null;
  }

  const home =
    findCompetitor(
      competition,
      "home"
    );

  const away =
    findCompetitor(
      competition,
      "away"
    );

  const homeEspnId =
    home?.team?.id
      ? String(
          home.team.id
        )
      : null;

  const awayEspnId =
    away?.team?.id
      ? String(
          away.team.id
        )
      : null;

  if (
    !homeEspnId ||
    !awayEspnId
  ) {
    return null;
  }

  const homeTeam =
    teamMap.get(
      homeEspnId
    );

  const awayTeam =
    teamMap.get(
      awayEspnId
    );

  if (
    !homeTeam ||
    !awayTeam
  ) {
    return null;
  }

  const status =
    competition.status ??
    event.status;

  const isShootout =
    detectShootout(
      status
    );

  const isOvertime =
    detectOvertime(
      status,
      isShootout
    );

  const seasonLabel =
    getNhlSeasonLabel(
      g365Season
    );

  return {
    /*
     * ESPN event ID remains the existing G365/internal
     * NHL game primary key.
     *
     * Official NHL game identity will be stored separately
     * in nhl_games.nhl_game_id.
     */
    id:
      numericGameId,

    espn_event_id:
      String(
        eventId
      ),

    season:
      g365Season,

    season_type:
      seasonType,

    game_date:
      isoDateOnly(
        startTime
      ),

    /*
     * Database compatibility:
     * start_time = NHL scheduled start time.
     */
    start_time:
      startTime.toISOString(),

    away_team_id:
      awayTeam.id,

    home_team_id:
      homeTeam.id,

    away_score:
      toScore(
        away?.score
      ),

    home_score:
      toScore(
        home?.score
      ),

    status_type:
      status?.type?.id ??
      null,

    status_name:
      status?.type?.name ??
      null,

    status_detail:
      status?.type?.detail ??
      status?.type
        ?.shortDetail ??
      status?.type
        ?.description ??
      null,

    period:
      typeof status?.period ===
        "number"
        ? Math.trunc(
            status.period
          )
        : null,

    display_clock:
      status?.displayClock ??
      null,

    status_completed:
      status?.type
        ?.completed ===
      true,

    is_overtime:
      isOvertime,

    is_shootout:
      isShootout,

    venue_name:
      competition.venue
        ?.fullName ??
      null,

    provider_data: {
      provider:
        "ESPN",

      g365Season,

      g365SeasonLabel:
        seasonLabel,

      espnSeasonYear:
        event.season?.year ??
        null,

      espnSeasonType:
        event.season?.type ??
        null,

      eventId:
        String(
          eventId
        ),

      eventName:
        event.name ??
        null,

      shortName:
        event.shortName ??
        null,

      homeTeam: {
        espnTeamId:
          homeEspnId,

        internalTeamId:
          homeTeam.id,

        officialNhlTeamId:
          homeTeam.nhl_team_id,

        abbreviation:
          home?.team
            ?.abbreviation ??
          null,

        displayName:
          home?.team
            ?.displayName ??
          null,
      },

      awayTeam: {
        espnTeamId:
          awayEspnId,

        internalTeamId:
          awayTeam.id,

        officialNhlTeamId:
          awayTeam.nhl_team_id,

        abbreviation:
          away?.team
            ?.abbreviation ??
          null,

        displayName:
          away?.team
            ?.displayName ??
          null,
      },

      status:
        status ??
        null,

      venue:
        competition.venue ??
        null,

      syncedAt:
        nowIso,
    },

    updated_at:
      nowIso,
  };
}

function chunks<T>(
  values:
    T[],
  size:
    number
) {
  const result:
    T[][] = [];

  for (
    let index = 0;
    index <
    values.length;
    index += size
  ) {
    result.push(
      values.slice(
        index,
        index + size
      )
    );
  }

  return result;
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

        source:
          "ESPN",

        sport:
          "NHL",

        error:
          "Unauthorized NHL schedule sync request.",
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
        await request.json() as
          RequestBody;
    } catch {
      body = {};
    }

    const season =
      typeof body.season ===
        "number" &&
      Number.isInteger(
        body.season
      )
        ? body.season
        : getDefaultSeason();

    const seasonLabel =
      getNhlSeasonLabel(
        season
      );

    const defaultStart =
      new Date(
        Date.UTC(
          season,
          6,
          1,
          0,
          0,
          0
        )
      );

    const defaultEnd =
      new Date(
        Date.UTC(
          season + 1,
          6,
          1,
          0,
          0,
          0
        )
      );

    const startDate =
      normalizeRequestedDate(
        body.startDate,
        defaultStart
      );

    const endDate =
      normalizeRequestedDate(
        body.endDate,
        defaultEnd
      );

    if (
      endDate.getTime() <
      startDate.getTime()
    ) {
      return NextResponse.json(
        {
          success:
            false,

          error:
            "endDate cannot be before startDate.",
        },
        {
          status:
            400,
        }
      );
    }

    const supabase =
      createSupabaseAdmin();

    /*
     * =====================================================
     * SHARED NHL TEAMS
     * =====================================================
     */

    const {
      data:
        teamData,
      error:
        teamError,
    } =
      await supabase
        .from(
          "nhl_teams"
        )
        .select(
          "id,espn_team_id,nhl_team_id,abbreviation,display_name"
        )
        .eq(
          "active",
          true
        );

    if (
      teamError
    ) {
      throw new Error(
        `Could not load NHL teams: ${teamError.message}`
      );
    }

    const teams =
      (
        teamData ??
        []
      ) as NhlTeamRow[];

    if (
      teams.length ===
      0
    ) {
      return NextResponse.json(
        {
          success:
            false,

          source:
            "ESPN",

          sport:
            "NHL",

          error:
            "No NHL teams exist. Run /api/nhl/sync-teams first.",
        },
        {
          status:
            409,
        }
      );
    }

    const teamMap =
      new Map<
        string,
        NhlTeamRow
      >();

    for (
      const team of
        teams
    ) {
      if (
        team.espn_team_id
      ) {
        teamMap.set(
          team.espn_team_id,
          team
        );
      }
    }

    /*
     * =====================================================
     * ESPN SCHEDULE DISCOVERY
     * =====================================================
     */

    const allEvents:
      EspnEvent[] = [];

    const requestUrls:
      string[] = [];

    let providerRequests =
      0;

    let cursor =
      new Date(
        startDate
      );

    while (
      cursor.getTime() <=
      endDate.getTime()
    ) {
      const chunkStart =
        new Date(
          cursor
        );

      const chunkEnd =
        new Date(
          cursor
        );

      chunkEnd.setUTCDate(
        chunkEnd.getUTCDate() +
          (
            ESPN_WINDOW_DAYS -
            1
          )
      );

      if (
        chunkEnd.getTime() >
        endDate.getTime()
      ) {
        chunkEnd.setTime(
          endDate.getTime()
        );
      }

      const {
        url,
        payload,
      } =
        await fetchScoreboard(
          chunkStart,
          chunkEnd
        );

      providerRequests +=
        1;

      requestUrls.push(
        url
      );

      allEvents.push(
        ...(
          payload.events ??
          []
        )
      );

      cursor =
        new Date(
          chunkEnd
        );

      cursor.setUTCDate(
        cursor.getUTCDate() +
          1
      );
    }

    /*
     * =====================================================
     * DE-DUPLICATE ESPN EVENTS
     * =====================================================
     */

    const eventMap =
      new Map<
        string,
        EspnEvent
      >();

    for (
      const event of
        allEvents
    ) {
      const eventId =
        event.id ??
        event.competitions?.[0]
          ?.id;

      if (!eventId) {
        continue;
      }

      eventMap.set(
        String(
          eventId
        ),
        event
      );
    }

    const uniqueEvents =
      Array.from(
        eventMap.values()
      );

    /*
     * =====================================================
     * NORMALIZE / FILTER
     * =====================================================
     */

    const nowIso =
      new Date()
        .toISOString();

    const normalized:
      NormalizedNhlGame[] = [];

    let preseasonSkipped =
      0;

    let unsupportedSkipped =
      0;

    const mappingSkipped:
      Array<{
        eventId:
          string | null;
        name:
          string | null;
      }> = [];

    for (
      const event of
        uniqueEvents
    ) {
      if (
        event.season?.type ===
        1
      ) {
        preseasonSkipped +=
          1;

        continue;
      }

      const seasonType =
        getSeasonType(
          event.season?.type
        );

      if (!seasonType) {
        unsupportedSkipped +=
          1;

        continue;
      }

      const game =
        normalizeEvent(
          event,
          teamMap,
          season,
          nowIso
        );

      if (!game) {
        mappingSkipped.push({
          eventId:
            event.id ??
            null,

          name:
            event.name ??
            null,
        });

        continue;
      }

      normalized.push(
        game
      );
    }

    /*
     * =====================================================
     * BATCH UPSERT
     * =====================================================
     *
     * nhl_games.id is the existing internal/shared game key.
     *
     * At present it is derived from ESPN event ID.
     *
     * Official NHL game ID is stored separately in:
     *
     * nhl_games.nhl_game_id
     */

    let gamesUpserted =
      0;

    for (
      const batch of
        chunks(
          normalized,
          SUPABASE_WRITE_BATCH_SIZE
        )
    ) {
      const {
        error:
          upsertError,
      } =
        await supabase
          .from(
            "nhl_games"
          )
          .upsert(
            batch,
            {
              onConflict:
                "id",
            }
          );

      if (
        upsertError
      ) {
        throw new Error(
          `Could not upsert NHL schedule batch: ${upsertError.message}`
        );
      }

      gamesUpserted +=
        batch.length;
    }

    /*
     * =====================================================
     * REMOVE PRESEASON FROM G365
     * =====================================================
     */

    const {
      error:
        preseasonCleanupError,
    } =
      await supabase
        .from(
          "nhl_games"
        )
        .delete()
        .eq(
          "season_type",
          "preseason"
        )
        .gte(
          "start_time",
          startDate.toISOString()
        )
        .lte(
          "start_time",
          endDate.toISOString()
        );

    if (
      preseasonCleanupError
    ) {
      throw new Error(
        `NHL schedule synced, but preseason cleanup failed: ${preseasonCleanupError.message}`
      );
    }

    /*
     * =====================================================
     * VERIFY
     * =====================================================
     */

    const {
      count:
        totalSeasonGames,
      error:
        countError,
    } =
      await supabase
        .from(
          "nhl_games"
        )
        .select(
          "id",
          {
            count:
              "exact",

            head:
              true,
          }
        )
        .eq(
          "season",
          season
        )
        .in(
          "season_type",
          [
            "regular",
            "postseason",
          ]
        );

    if (
      countError
    ) {
      throw new Error(
        `NHL schedule saved, but verification failed: ${countError.message}`
      );
    }

    const {
      count:
        preseasonRowsRemaining,
      error:
        preseasonCountError,
    } =
      await supabase
        .from(
          "nhl_games"
        )
        .select(
          "id",
          {
            count:
              "exact",

            head:
              true,
          }
        )
        .eq(
          "season_type",
          "preseason"
        )
        .gte(
          "start_time",
          startDate.toISOString()
        )
        .lte(
          "start_time",
          endDate.toISOString()
        );

    if (
      preseasonCountError
    ) {
      throw new Error(
        `NHL schedule saved, but preseason verification failed: ${preseasonCountError.message}`
      );
    }

    return NextResponse.json({
      success:
        true,

      source:
        "ESPN",

      sport:
        "NHL",

      season,

      seasonLabel,

      seasonConvention:
        "starting-year",

      includedGameTypes: [
        "regular",
        "postseason",
      ],

      preseasonIncluded:
        false,

      startDate:
        isoDateOnly(
          startDate
        ),

      endDate:
        isoDateOnly(
          endDate
        ),

      providerRequests,

      eventsReceived:
        uniqueEvents.length,

      preseasonSkipped,

      unsupportedSkipped,

      gamesNormalized:
        normalized.length,

      gamesUpserted,

      gamesSkippedForMapping:
        mappingSkipped.length,

      totalSeasonGames:
        totalSeasonGames ??
        0,

      preseasonRowsRemaining:
        preseasonRowsRemaining ??
        0,

      requestUrls,

      mappingSkippedGames:
        mappingSkipped,
    });
  } catch (
    error
  ) {
    console.error(
      "NHL schedule sync failed:",
      error
    );

    return NextResponse.json(
      {
        success:
          false,

        source:
          "ESPN",

        sport:
          "NHL",

        error:
          error instanceof
          Error
            ? error.message
            : "Unknown NHL schedule sync error.",
      },
      {
        status:
          500,
      }
    );
  }
}
