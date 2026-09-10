import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ESPN_SCOREBOARD_URL =
  "https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard";

const SPORT = "ncaamb";
const PROVIDER = "espn";
const ESPN_GROUP = "50";
const ESPN_LIMIT = "500";

type JsonRecord = Record<string, unknown>;

type SyncInput = {
  leagueId: string;
  season: number;
  dateFrom: string;
  dateTo: string;
};

type PickemWeekSport = {
  pickem_week_id: number;
  league_id: string;
  season: number;
  week: number;
  sport: "ncaamb";
  period_starts_at: string;
  period_ends_at: string;
};

type ExistingGameEligibility = {
  provider_event_id: string;
  is_eligible: boolean;
  exclusion_reason: string | null;
};

type NormalizedEspnGame = {
  provider_event_id: string;
  kickoff_at: string;

  away_team_espn_id: string | null;
  away_team_name: string;
  away_team_abbreviation: string | null;
  away_score: number | null;

  home_team_espn_id: string | null;
  home_team_name: string;
  home_team_abbreviation: string | null;
  home_score: number | null;

  neutral_site: boolean | null;

  venue_name: string | null;
  venue_city: string | null;
  venue_state: string | null;

  status_type: string | null;
  status_name: string | null;
  status_detail: string | null;

  period: number | null;
  display_clock: string | null;

  is_started: boolean;
  is_final: boolean;
};

type SkippedGame = {
  eventId: string | null;
  reason: string;
  kickoffAt?: string | null;
};

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL is not configured.",
    );
  }

  if (!serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not configured.",
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function isRecord(value: unknown): value is JsonRecord {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function asRecord(value: unknown): JsonRecord | null {
  return isRecord(value) ? value : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : null;
}

function asBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function asNumber(value: unknown): number | null {
  if (
    typeof value === "number" &&
    Number.isFinite(value)
  ) {
    return value;
  }

  if (
    typeof value === "string" &&
    value.trim() !== ""
  ) {
    const parsed = Number(value);

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function asInteger(value: unknown): number | null {
  const number = asNumber(value);

  if (number === null) {
    return null;
  }

  return Math.trunc(number);
}

function normalizeDateInput(value: string): string {
  const trimmed = value.trim();

  if (/^\d{8}$/.test(trimmed)) {
    return trimmed;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed.replaceAll("-", "");
  }

  throw new Error(
    `Invalid date "${value}". Expected YYYY-MM-DD or YYYYMMDD.`,
  );
}

function dateToIsoDate(value: string): string {
  const compact = normalizeDateInput(value);

  return `${compact.slice(0, 4)}-${compact.slice(
    4,
    6,
  )}-${compact.slice(6, 8)}`;
}

function compareCompactDates(
  a: string,
  b: string,
): number {
  return normalizeDateInput(a).localeCompare(
    normalizeDateInput(b),
  );
}

function addDaysToIsoDate(
  isoDate: string,
  days: number,
): string {
  const [year, month, day] = isoDate
    .split("-")
    .map(Number);

  const date = new Date(
    Date.UTC(
      year,
      month - 1,
      day,
    ),
  );

  date.setUTCDate(
    date.getUTCDate() + days,
  );

  return date
    .toISOString()
    .slice(0, 10);
}

function enumerateIsoDates(
  dateFrom: string,
  dateTo: string,
): string[] {
  const start =
    dateToIsoDate(dateFrom);

  const end =
    dateToIsoDate(dateTo);

  if (start > end) {
    throw new Error(
      "dateFrom must be on or before dateTo.",
    );
  }

  const dates: string[] = [];

  let cursor = start;

  while (cursor <= end) {
    dates.push(cursor);

    cursor =
      addDaysToIsoDate(
        cursor,
        1,
      );

    if (dates.length > 400) {
      throw new Error(
        "Requested date range is too large.",
      );
    }
  }

  return dates;
}

function scoreFromCompetitor(
  competitor: JsonRecord,
): number | null {
  const directScore =
    asNumber(
      competitor.score,
    );

  if (directScore !== null) {
    return Math.trunc(
      directScore,
    );
  }

  const scoreRecord =
    asRecord(
      competitor.score,
    );

  if (scoreRecord) {
    const displayValue =
      asNumber(
        scoreRecord.displayValue,
      );

    if (displayValue !== null) {
      return Math.trunc(
        displayValue,
      );
    }

    const value =
      asNumber(
        scoreRecord.value,
      );

    if (value !== null) {
      return Math.trunc(
        value,
      );
    }
  }

  return null;
}

function normalizeCompetitor(
  raw: unknown,
): {
  homeAway: string | null;
  teamEspnId: string | null;
  teamName: string | null;
  abbreviation: string | null;
  score: number | null;
} | null {
  const competitor =
    asRecord(raw);

  if (!competitor) {
    return null;
  }

  const team =
    asRecord(
      competitor.team,
    );

  if (!team) {
    return null;
  }

  return {
    homeAway:
      asString(
        competitor.homeAway,
      ),

    teamEspnId:
      asString(team.id) ??
      asString(
        competitor.id,
      ),

    teamName:
      asString(
        team.displayName,
      ) ??
      asString(
        team.shortDisplayName,
      ) ??
      asString(
        team.name,
      ),

    abbreviation:
      asString(
        team.abbreviation,
      ),

    score:
      scoreFromCompetitor(
        competitor,
      ),
  };
}

function normalizeEspnGame(
  rawEvent: unknown,
): {
  game: NormalizedEspnGame | null;
  skipReason: string | null;
} {
  const event =
    asRecord(rawEvent);

  if (!event) {
    return {
      game: null,
      skipReason:
        "ESPN event was not an object.",
    };
  }

  const eventId =
    asString(
      event.id,
    );

  if (!eventId) {
    return {
      game: null,
      skipReason:
        "ESPN event did not contain an id.",
    };
  }

  const competitions =
    asArray(
      event.competitions,
    );

  const competition =
    asRecord(
      competitions[0],
    );

  if (!competition) {
    return {
      game: null,
      skipReason:
        "ESPN event did not contain a competition.",
    };
  }

  const kickoffAt =
    asString(
      competition.date,
    ) ??
    asString(
      event.date,
    );

  if (!kickoffAt) {
    return {
      game: null,
      skipReason:
        "ESPN event did not contain a game date.",
    };
  }

  const kickoffDate =
    new Date(
      kickoffAt,
    );

  if (
    Number.isNaN(
      kickoffDate.getTime(),
    )
  ) {
    return {
      game: null,
      skipReason:
        "ESPN event contained an invalid game date.",
    };
  }

  const competitors =
    asArray(
      competition.competitors,
    )
      .map(
        normalizeCompetitor,
      )
      .filter(
        (
          competitor,
        ): competitor is NonNullable<
          ReturnType<
            typeof normalizeCompetitor
          >
        > =>
          competitor !==
          null,
      );

  const away =
    competitors.find(
      (competitor) =>
        competitor.homeAway ===
        "away",
    ) ?? null;

  const home =
    competitors.find(
      (competitor) =>
        competitor.homeAway ===
        "home",
    ) ?? null;

  if (
    !away?.teamName ||
    !home?.teamName
  ) {
    return {
      game: null,
      skipReason:
        "ESPN event was missing a home or away team.",
    };
  }

  const status =
    asRecord(
      competition.status,
    ) ??
    asRecord(
      event.status,
    );

  const statusType =
    status
      ? asRecord(
          status.type,
        )
      : null;

  const statusName =
    asString(
      statusType?.name,
    );

  const statusDetail =
    asString(
      statusType?.detail,
    ) ??
    asString(
      statusType?.shortDetail,
    );

  const state =
    asString(
      statusType?.state,
    )?.toLowerCase() ??
    null;

  const completed =
    asBoolean(
      statusType?.completed,
    ) ?? false;

  const period =
    status
      ? asInteger(
          status.period,
        )
      : null;

  const displayClock =
    status
      ? asString(
          status.displayClock,
        )
      : null;

  const isFinal =
    completed ||
    state === "post" ||
    statusName
      ?.toUpperCase()
      .includes(
        "FINAL",
      ) === true;

  const isStarted =
    isFinal ||
    state === "in" ||
    state === "live" ||
    (
      kickoffDate.getTime() <=
        Date.now() &&
      state !== "pre"
    );

  const venue =
    asRecord(
      competition.venue,
    );

  const address =
    venue
      ? asRecord(
          venue.address,
        )
      : null;

  const neutralSite =
    asBoolean(
      competition.neutralSite,
    );

  return {
    game: {
      provider_event_id:
        eventId,

      kickoff_at:
        kickoffDate.toISOString(),

      away_team_espn_id:
        away.teamEspnId,

      away_team_name:
        away.teamName,

      away_team_abbreviation:
        away.abbreviation,

      away_score:
        away.score,

      home_team_espn_id:
        home.teamEspnId,

      home_team_name:
        home.teamName,

      home_team_abbreviation:
        home.abbreviation,

      home_score:
        home.score,

      neutral_site:
        neutralSite,

      venue_name:
        asString(
          venue?.fullName,
        ),

      venue_city:
        asString(
          address?.city,
        ),

      venue_state:
        asString(
          address?.state,
        ),

      status_type:
        state,

      status_name:
        statusName,

      status_detail:
        statusDetail,

      period,

      display_clock:
        displayClock,

      is_started:
        isStarted,

      is_final:
        isFinal,
    },

    skipReason: null,
  };
}

function gameFitsSportPeriod(
  kickoffAt: string,
  period: PickemWeekSport,
): boolean {
  const kickoff =
    new Date(
      kickoffAt,
    ).getTime();

  const start =
    new Date(
      period.period_starts_at,
    ).getTime();

  const end =
    new Date(
      period.period_ends_at,
    ).getTime();

  if (
    Number.isNaN(kickoff) ||
    Number.isNaN(start) ||
    Number.isNaN(end)
  ) {
    return false;
  }

  return (
    kickoff >= start &&
    kickoff < end
  );
}

function findPickemWeekSport(
  game: NormalizedEspnGame,
  periods: PickemWeekSport[],
): PickemWeekSport | null {
  return (
    periods.find(
      (period) =>
        gameFitsSportPeriod(
          game.kickoff_at,
          period,
        ),
    ) ?? null
  );
}

async function fetchEspnDay(
  isoDate: string,
): Promise<unknown[]> {
  const compactDate =
    isoDate.replaceAll(
      "-",
      "",
    );

  const url =
    new URL(
      ESPN_SCOREBOARD_URL,
    );

  url.searchParams.set(
    "dates",
    compactDate,
  );

  url.searchParams.set(
    "groups",
    ESPN_GROUP,
  );

  url.searchParams.set(
    "limit",
    ESPN_LIMIT,
  );

  const response =
    await fetch(
      url.toString(),
      {
        method: "GET",

        headers: {
          Accept:
            "application/json",

          "User-Agent":
            "Gridiron365/1.0",
        },

        cache:
          "no-store",
      },
    );

  if (!response.ok) {
    throw new Error(
      `ESPN NCAAMB scoreboard request failed for ${isoDate}: ${response.status} ${response.statusText}`,
    );
  }

  const payload =
    (await response.json()) as unknown;

  const root =
    asRecord(
      payload,
    );

  return asArray(
    root?.events,
  );
}

async function parseRequestInput(
  request: NextRequest,
): Promise<SyncInput> {
  if (
    request.method === "GET"
  ) {
    const params =
      request.nextUrl
        .searchParams;

    const leagueId =
      params.get(
        "leagueId",
      );

    const seasonRaw =
      params.get(
        "season",
      );

    const dateFrom =
      params.get(
        "dateFrom",
      ) ??
      params.get(
        "date",
      );

    const dateTo =
      params.get(
        "dateTo",
      ) ??
      dateFrom;

    if (
      !leagueId ||
      !seasonRaw ||
      !dateFrom ||
      !dateTo
    ) {
      throw new Error(
        "Required query parameters: leagueId, season, and date or dateFrom/dateTo.",
      );
    }

    const season =
      Number(
        seasonRaw,
      );

    if (
      !Number.isInteger(
        season,
      )
    ) {
      throw new Error(
        "season must be an integer.",
      );
    }

    return {
      leagueId,
      season,
      dateFrom,
      dateTo,
    };
  }

  const body =
    (await request.json()) as unknown;

  const record =
    asRecord(
      body,
    );

  if (!record) {
    throw new Error(
      "Request body must be a JSON object.",
    );
  }

  const leagueId =
    asString(
      record.leagueId,
    );

  const season =
    asInteger(
      record.season,
    );

  const dateFrom =
    asString(
      record.dateFrom,
    ) ??
    asString(
      record.date,
    );

  const dateTo =
    asString(
      record.dateTo,
    ) ??
    dateFrom;

  if (
    !leagueId ||
    season === null ||
    !dateFrom ||
    !dateTo
  ) {
    throw new Error(
      "Required JSON fields: leagueId, season, and date or dateFrom/dateTo.",
    );
  }

  return {
    leagueId,
    season,
    dateFrom,
    dateTo,
  };
}

function authorized(
  request: NextRequest,
): boolean {
  const configuredSecret =
    process.env
      .GRIDIRON_SYNC_SECRET;

  if (
    process.env.NODE_ENV !==
      "production" &&
    !configuredSecret
  ) {
    return true;
  }

  if (
    !configuredSecret
  ) {
    return false;
  }

  const suppliedSecret =
    request.headers.get(
      "x-gridiron-sync-secret",
    );

  return (
    suppliedSecret ===
    configuredSecret
  );
}

async function runSync(
  request: NextRequest,
) {
  if (
    !authorized(
      request,
    )
  ) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Unauthorized",
      },
      {
        status: 401,
      },
    );
  }

  try {
    const input =
      await parseRequestInput(
        request,
      );

    if (
      compareCompactDates(
        input.dateFrom,
        input.dateTo,
      ) > 0
    ) {
      throw new Error(
        "dateFrom must be on or before dateTo.",
      );
    }

    const dates =
      enumerateIsoDates(
        input.dateFrom,
        input.dateTo,
      );

    const supabase =
      getSupabaseAdmin();

    const {
      data: league,
      error: leagueError,
    } = await supabase
      .from(
        "leagues",
      )
      .select(
        "id, season, league_type",
      )
      .eq(
        "id",
        input.leagueId,
      )
      .maybeSingle();

    if (
      leagueError
    ) {
      throw new Error(
        `League lookup failed: ${leagueError.message}`,
      );
    }

    if (
      !league
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "League could not be found.",
        },
        {
          status: 404,
        },
      );
    }

    if (
      league.league_type !==
      "pickem"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "NCAAMB ingestion currently requires a Pick'em league.",
        },
        {
          status: 400,
        },
      );
    }

    if (
      Number(
        league.season,
      ) !==
      input.season
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            `Requested season ${input.season} does not match league season ${league.season}.`,
        },
        {
          status: 400,
        },
      );
    }

    /*
     * IMPORTANT:
     *
     * Keep this as a literal string.
     *
     * Do not convert this back to:
     *
     * [
     *   "id",
     *   ...
     * ].join(",")
     *
     * Supabase TypeScript needs the
     * literal select string to infer
     * the returned row structure.
     */
    const {
      data: weekSportRows,
      error: weekSportsError,
    } = await supabase
      .from(
        "pickem_week_sports",
      )
      .select(
        "pickem_week_id, league_id, season, week, sport, period_starts_at, period_ends_at",
      )
      .eq(
        "league_id",
        input.leagueId,
      )
      .eq(
        "season",
        input.season,
      )
      .eq(
        "sport",
        SPORT,
      )
      .order(
        "period_starts_at",
        {
          ascending: true,
        },
      );

    if (
      weekSportsError
    ) {
      throw new Error(
        `NCAAMB Pick'em sport-period lookup failed: ${weekSportsError.message}`,
      );
    }

    /*
     * NCAAMB uses the sport-specific lifecycle row as the
     * authoritative read window:
     *
     * Monday 12:00 AM ET -> following Monday 12:00 AM ET.
     *
     * The pickem_games trigger and authoritative resolver
     * remain the final database guard for week assignment.
     */
    const weekSports: PickemWeekSport[] =
      (weekSportRows ?? []).map(
        (row) => ({
          pickem_week_id:
            row.pickem_week_id,

          league_id:
            row.league_id,

          season:
            row.season,

          week:
            row.week,

          sport:
            "ncaamb",

          period_starts_at:
            row.period_starts_at,

          period_ends_at:
            row.period_ends_at,
        }),
      );

    const eventMap =
      new Map<
        string,
        unknown
      >();

    const fetchedDays: {
      date: string;
      eventCount: number;
    }[] = [];

    for (
      const date of
      dates
    ) {
      const events =
        await fetchEspnDay(
          date,
        );

      fetchedDays.push({
        date,
        eventCount:
          events.length,
      });

      for (
        const rawEvent of
        events
      ) {
        const event =
          asRecord(
            rawEvent,
          );

        const eventId =
          asString(
            event?.id,
          );

        if (
          !eventId
        ) {
          continue;
        }

        eventMap.set(
          eventId,
          rawEvent,
        );
      }
    }

    const {
      data: existingEligibilityRows,
      error: existingEligibilityError,
    } = await supabase
      .from(
        "pickem_games",
      )
      .select(
        "provider_event_id,is_eligible,exclusion_reason",
      )
      .eq(
        "league_id",
        input.leagueId,
      )
      .eq(
        "season",
        input.season,
      )
      .eq(
        "sport",
        SPORT,
      )
      .eq(
        "provider",
        PROVIDER,
      );

    if (
      existingEligibilityError
    ) {
      throw new Error(
        `Existing NCAAMB eligibility lookup failed: ${existingEligibilityError.message}`,
      );
    }

    /*
     * Schedule/status synchronization must never undo a
     * commissioner/line-quality eligibility decision that
     * was already made for an existing game.
     */
    const existingEligibilityByEventId =
      new Map<
        string,
        ExistingGameEligibility
      >(
        (
          existingEligibilityRows ??
          []
        ).map(
          (row) => [
            row.provider_event_id,
            {
              provider_event_id:
                row.provider_event_id,

              is_eligible:
                row.is_eligible,

              exclusion_reason:
                row.exclusion_reason,
            },
          ],
        ),
      );

    let parsed = 0;
    let insertedOrUpdated = 0;
    let mappedToWeek = 0;

    let finalGames = 0;
    let liveGames = 0;
    let scheduledGames = 0;

    const skipped: SkippedGame[] =
      [];

    for (
      const rawEvent of
      eventMap.values()
    ) {
      const normalized =
        normalizeEspnGame(
          rawEvent,
        );

      if (
        !normalized.game
      ) {
        const event =
          asRecord(
            rawEvent,
          );

        skipped.push({
          eventId:
            asString(
              event?.id,
            ),

          reason:
            normalized.skipReason ??
            "Unable to normalize ESPN event.",
        });

        continue;
      }

      const game =
        normalized.game;

      parsed += 1;

      const weekSport =
        findPickemWeekSport(
          game,
          weekSports,
        );

      if (
        !weekSport
      ) {
        skipped.push({
          eventId:
            game.provider_event_id,

          kickoffAt:
            game.kickoff_at,

          reason:
            "No NCAAMB pickem_week_sports lifecycle period covers this game tipoff.",
        });

        continue;
      }

      mappedToWeek += 1;

      if (
        game.is_final
      ) {
        finalGames += 1;
      } else if (
        game.is_started
      ) {
        liveGames += 1;
      } else {
        scheduledGames += 1;
      }

      const now =
        new Date()
          .toISOString();

      const row = {
        league_id:
          input.leagueId,

        pickem_week_id:
          weekSport.pickem_week_id,

        season:
          input.season,

        week:
          weekSport.week,

        sport:
          SPORT,

        provider:
          PROVIDER,

        provider_event_id:
          game.provider_event_id,

        kickoff_at:
          game.kickoff_at,

        away_team_espn_id:
          game.away_team_espn_id,

        away_team_name:
          game.away_team_name,

        away_team_abbreviation:
          game.away_team_abbreviation,

        away_score:
          game.away_score,

        home_team_espn_id:
          game.home_team_espn_id,

        home_team_name:
          game.home_team_name,

        home_team_abbreviation:
          game.home_team_abbreviation,

        home_score:
          game.home_score,

        neutral_site:
          game.neutral_site,

        venue_name:
          game.venue_name,

        venue_city:
          game.venue_city,

        venue_state:
          game.venue_state,

        status_type:
          game.status_type,

        status_name:
          game.status_name,

        status_detail:
          game.status_detail,

        period:
          game.period,

        display_clock:
          game.display_clock,

        is_started:
          game.is_started,

        is_final:
          game.is_final,

        is_eligible:
          existingEligibilityByEventId.get(
            game.provider_event_id,
          )?.is_eligible ??
          true,

        exclusion_reason:
          existingEligibilityByEventId.get(
            game.provider_event_id,
          )?.exclusion_reason ??
          null,

        last_score_sync_at:
          now,

        updated_at:
          now,
      };

      const {
        error:
          upsertError,
      } = await supabase
        .from(
          "pickem_games",
        )
        .upsert(
          row,
          {
            onConflict:
              "league_id,provider,provider_event_id",

            ignoreDuplicates:
              false,
          },
        );

      if (
        upsertError
      ) {
        throw new Error(
          `Failed to upsert ESPN event ${game.provider_event_id}: ${upsertError.message}`,
        );
      }

      insertedOrUpdated += 1;
    }

    return NextResponse.json(
      {
        success: true,

        sport:
          SPORT,

        provider:
          PROVIDER,

        leagueId:
          input.leagueId,

        season:
          input.season,

        dateFrom:
          dateToIsoDate(
            input.dateFrom,
          ),

        dateTo:
          dateToIsoDate(
            input.dateTo,
          ),

        espn: {
          groups:
            ESPN_GROUP,

          limit:
            Number(
              ESPN_LIMIT,
            ),

          uniqueEventsFetched:
            eventMap.size,

          fetchedDays,
        },

        database: {
          availableNcaambSportPeriods:
            weekSports.length,

          parsed,

          mappedToWeek,

          insertedOrUpdated,

          scheduledGames,

          liveGames,

          finalGames,

          skippedGames:
            skipped.length,
        },

        skipped,
      },
      {
        status: 200,
      },
    );
  } catch (
    error
  ) {
    console.error(
      "[NCAAMB sync-schedule]",
      error,
    );

    return NextResponse.json(
      {
        success: false,

        error:
          error instanceof Error
            ? error.message
            : "Unknown NCAAMB synchronization error.",
      },
      {
        status: 500,
      },
    );
  }
}

export async function GET(
  request: NextRequest,
) {
  return runSync(
    request,
  );
}

export async function POST(
  request: NextRequest,
) {
  return runSync(
    request,
  );
}