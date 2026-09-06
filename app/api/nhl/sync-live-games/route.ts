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
  date?: string;
  backwardDays?: number;
  forwardDays?: number;
};

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
};

type ExistingNhlGameRow = {
  id: number;
  espn_event_id: string | null;
  nhl_game_id: string | null;
  provider_data: Record<string, unknown> | null;
};

type ResolvedNhlGameUpdate =
  NhlGameUpdate & {
    id: number;
  };

type NhlGameUpdate = {
  espn_event_id: string;

  season: number;

  season_type:
    | "regular"
    | "postseason";

  game_date: string;
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

const DEFAULT_BACKWARD_DAYS =
  1;

const DEFAULT_FORWARD_DAYS =
  1;

const MAX_DAY_WINDOW =
  7;

const WRITE_BATCH_SIZE =
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

function clampInteger(
  value:
    number |
    undefined,
  fallback:
    number
) {
  if (
    typeof value !==
      "number" ||
    !Number.isFinite(
      value
    )
  ) {
    return fallback;
  }

  return Math.min(
    MAX_DAY_WINDOW,
    Math.max(
      0,
      Math.trunc(
        value
      )
    )
  );
}

function parseDate(
  value:
    string |
    undefined
) {
  if (!value) {
    return new Date();
  }

  const parsed =
    new Date(
      `${value}T12:00:00.000Z`
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

function addDays(
  value:
    Date,
  days:
    number
) {
  const result =
    new Date(
      value
    );

  result.setUTCDate(
    result.getUTCDate() +
      days
  );

  return result;
}

function yyyymmdd(
  value:
    Date
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
  value:
    Date
) {
  return value
    .toISOString()
    .slice(
      0,
      10
    );
}

function getG365NhlSeason(
  startTime:
    Date
) {
  /*
   * NHL season identity uses the STARTING year.
   *
   * Example:
   * September 2026 - June 2027
   * => G365 season = 2026
   */
  const month =
    startTime.getUTCMonth();

  const year =
    startTime.getUTCFullYear();

  return month >= 6
    ? year
    : year - 1;
}

function getNhlSeasonLabel(
  season:
    number
) {
  return `${season}-${String(
    season + 1
  ).slice(-2)}`;
}

function getSeasonType(
  espnSeasonType:
    number |
    undefined
):
  | "regular"
  | "postseason"
  | null {
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

  /*
   * ESPN type 1 = preseason.
   * G365 excludes NHL preseason entirely.
   */
  return null;
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
    Number(
      value
    );

  return Number.isFinite(
    parsed
  )
    ? Math.trunc(
        parsed
      )
    : 0;
}

function findCompetitor(
  competition:
    EspnCompetition,
  side:
    | "home"
    | "away"
) {
  return (
    competition.competitors ??
    []
  ).find(
    (competitor) =>
      competitor.homeAway ===
      side
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
        value.length >
          0
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
  shootout:
    boolean
) {
  if (shootout) {
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

function buildScoreboardUrl(
  start:
    Date,
  end:
    Date
) {
  const url =
    new URL(
      ESPN_NHL_SCOREBOARD
    );

  url.searchParams.set(
    "dates",
    `${yyyymmdd(
      start
    )}-${yyyymmdd(
      end
    )}`
  );

  url.searchParams.set(
    "limit",
    "1000"
  );

  return url.toString();
}

async function fetchScoreboard(
  start:
    Date,
  end:
    Date
) {
  const url =
    buildScoreboardUrl(
      start,
      end
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

  try {
    return {
      url,

      payload:
        JSON.parse(
          text
        ) as EspnScoreboard,
    };
  } catch {
    throw new Error(
      "ESPN NHL scoreboard returned invalid JSON."
    );
  }
}

function normalizeEvent(
  event:
    EspnEvent,
  teamMap:
    Map<
      string,
      NhlTeamRow
    >,
  nowIso:
    string
):
  | NhlGameUpdate
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

  const startTimeRaw =
    competition.date ??
    event.date;

  if (
    !eventId ||
    !startTimeRaw
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

  const shootout =
    detectShootout(
      status
    );

  const overtime =
    detectOvertime(
      status,
      shootout
    );

  const season =
    getG365NhlSeason(
      startTime
    );

  return {
    espn_event_id:
      String(
        eventId
      ),

    season,

    season_type:
      seasonType,

    game_date:
      isoDateOnly(
        startTime
      ),

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
      overtime,

    is_shootout:
      shootout,

    venue_name:
      competition.venue
        ?.fullName ??
      null,

    provider_data: {
      provider:
        "ESPN",

      syncType:
        "live-game",

      eventId:
        String(
          eventId
        ),

      g365Season:
        season,

      g365SeasonLabel:
        getNhlSeasonLabel(
          season
        ),

      espnSeasonYear:
        event.season?.year ??
        null,

      espnSeasonType:
        event.season?.type ??
        null,

      eventName:
        event.name ??
        null,

      shortName:
        event.shortName ??
        null,

      homeTeam: {
        espnTeamId:
          homeEspnId,

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
          "Unauthorized NHL live-game sync request.",
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

    const targetDate =
      parseDate(
        body.date
      );

    const backwardDays =
      clampInteger(
        body.backwardDays,
        DEFAULT_BACKWARD_DAYS
      );

    const forwardDays =
      clampInteger(
        body.forwardDays,
        DEFAULT_FORWARD_DAYS
      );

    const startDate =
      addDays(
        targetDate,
        -backwardDays
      );

    const endDate =
      addDays(
        targetDate,
        forwardDays
      );

    const supabase =
      createSupabaseAdmin();

    /*
     * =====================================================
     * LOAD NHL TEAM MAPPING
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
          "id,espn_team_id"
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
      throw new Error(
        "No NHL teams are available. Run the NHL team sync first."
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
          String(
            team.espn_team_id
          ),
          team
        );
      }
    }

    /*
     * =====================================================
     * FETCH ESPN SCOREBOARD
     * =====================================================
     */

    const {
      url,
      payload,
    } =
      await fetchScoreboard(
        startDate,
        endDate
      );

    const events =
      payload.events ??
      [];

    const nowIso =
      new Date()
        .toISOString();

    const normalized:
      NhlGameUpdate[] = [];

    let preseasonSkipped =
      0;

    let unsupportedSkipped =
      0;

    let mappingSkipped =
      0;

    for (
      const event of
        events
    ) {
      if (
        event.season?.type ===
        1
      ) {
        preseasonSkipped +=
          1;

        continue;
      }

      if (
        !getSeasonType(
          event.season?.type
        )
      ) {
        unsupportedSkipped +=
          1;

        continue;
      }

      const game =
        normalizeEvent(
          event,
          teamMap,
          nowIso
        );

      if (!game) {
        mappingSkipped +=
          1;

        continue;
      }

      normalized.push(
        game
      );
    }

    /*
     * =====================================================
     * RESOLVE EXISTING OFFICIAL SCHEDULE ROWS
     * =====================================================
     *
     * ESPN is a live-state feed only. It is NOT the database
     * identity for NHL games.
     *
     * Existing public.nhl_games rows are resolved by
     * espn_event_id, then updated using their internal id.
     * The official nhl_game_id remains untouched.
     *
     * If ESPN returns an event that is not already present in
     * the schedule table, this route does not insert it.
     */

    const existingByEspnEventId =
      new Map<
        string,
        ExistingNhlGameRow
      >();

    const normalizedEspnEventIds =
      Array.from(
        new Set(
          normalized.map(
            (game) =>
              game.espn_event_id
          )
        )
      );

    for (
      const idBatch of
        chunks(
          normalizedEspnEventIds,
          WRITE_BATCH_SIZE
        )
    ) {
      if (
        idBatch.length ===
        0
      ) {
        continue;
      }

      const {
        data:
          existingData,
        error:
          existingError,
      } =
        await supabase
          .from(
            "nhl_games"
          )
          .select(
            "id,espn_event_id,nhl_game_id,provider_data"
          )
          .in(
            "espn_event_id",
            idBatch
          );

      if (
        existingError
      ) {
        throw new Error(
          `Could not resolve existing NHL schedule rows: ${existingError.message}`
        );
      }

      for (
        const row of
          (existingData ?? []) as
            ExistingNhlGameRow[]
      ) {
        if (
          row.espn_event_id
        ) {
          existingByEspnEventId.set(
            row.espn_event_id,
            row
          );
        }
      }
    }

    const resolvedUpdates:
      ResolvedNhlGameUpdate[] = [];

    const missingScheduleEspnEventIds:
      string[] = [];

    for (
      const game of
        normalized
    ) {
      const existingGame =
        existingByEspnEventId.get(
          game.espn_event_id
        );

      if (
        !existingGame
      ) {
        missingScheduleEspnEventIds.push(
          game.espn_event_id
        );

        continue;
      }

      resolvedUpdates.push({
        ...game,

        id:
          existingGame.id,

        provider_data: {
          ...(existingGame.provider_data ?? {}),
          ...game.provider_data,

          officialNhlGameId:
            existingGame.nhl_game_id,

          liveStateProvider:
            "ESPN",
        },
      });
    }

    /*
     * =====================================================
     * UPDATE EXISTING GAME STATE ONLY
     * =====================================================
     *
     * No insert/upsert is used here. The official schedule
     * layer owns game creation and identity.
     */

    let gamesUpdated =
      0;

    for (
      const game of
        resolvedUpdates
    ) {
      const {
        id,
        ...updatePayload
      } =
        game;

      const {
        error:
          updateError,
      } =
        await supabase
          .from(
            "nhl_games"
          )
          .update(
            updatePayload
          )
          .eq(
            "id",
            id
          );

      if (
        updateError
      ) {
        throw new Error(
          `Could not update NHL live game ${game.espn_event_id}: ${updateError.message}`
        );
      }

      gamesUpdated +=
        1;
    }

    const liveGames =
      resolvedUpdates.filter(
        (game) =>
          !game.status_completed &&
          (
            game.status_name ===
              "STATUS_IN_PROGRESS" ||
            (
              typeof game.period ===
                "number" &&
              game.period >
                0
            )
          )
      );

    const finalGames =
      resolvedUpdates.filter(
        (game) =>
          game.status_completed
      );

    const scheduledGames =
      resolvedUpdates.filter(
        (game) =>
          !game.status_completed &&
          !liveGames.some(
            (liveGame) =>
              liveGame.id ===
              game.id
          )
      );

    return NextResponse.json({
      success:
        true,

      source:
        "ESPN",

      sport:
        "NHL",

      syncType:
        "live-games",

      targetDate:
        isoDateOnly(
          targetDate
        ),

      startDate:
        isoDateOnly(
          startDate
        ),

      endDate:
        isoDateOnly(
          endDate
        ),

      scoreboardUrl:
        url,

      eventsReceived:
        events.length,

      gamesNormalized:
        normalized.length,

      gamesUpdated,

      gamesSkippedMissingSchedule:
        missingScheduleEspnEventIds.length,

      scheduledGames:
        scheduledGames.length,

      liveGames:
        liveGames.length,

      finalGames:
        finalGames.length,

      preseasonSkipped,

      unsupportedSkipped,

      mappingSkipped,

      missingScheduleEspnEventIds,

      activeGameIds:
        liveGames.map(
          (game) =>
            game.id
        ),

      activeEspnEventIds:
        liveGames.map(
          (game) =>
            game.espn_event_id
        ),

      finalGameIds:
        finalGames.map(
          (game) =>
            game.id
        ),

      finalEspnEventIds:
        finalGames.map(
          (game) =>
            game.espn_event_id
        ),
    });
  } catch (
    error
  ) {
    console.error(
      "NHL live-game sync failed:",
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

        syncType:
          "live-games",

        error:
          error instanceof
          Error
            ? error.message
            : "Unknown NHL live-game sync error.",
      },
      {
        status:
          500,
      }
    );
  }
}
