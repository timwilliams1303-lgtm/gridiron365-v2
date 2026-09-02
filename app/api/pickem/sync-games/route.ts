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

type PickemWeekRow = {
  id: number;
  league_id: string;
  season: number;
  week: number;
  status: string;
  line_day_at: string | null;
  finalize_not_before: string | null;
  slate_starts_at: string | null;
  slate_ends_at: string | null;
};

type PickemSettingsRow = {
  league_id: string;
  football_scope:
    FootballScope;
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

  score?:
    string;

  team?:
    EspnTeam;
};

type EspnSituation = {
  possession?: string;
  down?: number;
  distance?: number;
  yardLine?: number;
  yardsToEndzone?: number;
  downDistanceText?: string;
  shortDownDistanceText?: string;
  possessionText?: string;
  isRedZone?: boolean;

  lastPlay?: {
    text?: string;
    shortText?: string;
  };
};

type EspnStatus = {
  period?: number;
  displayClock?: string;

  type?: {
    id?: string;
    name?: string;
    state?: string;
    completed?: boolean;
    description?: string;
    detail?: string;
    shortDetail?: string;
  };
};

type EspnCompetition = {
  id?: string;
  date?: string;

  status?:
    EspnStatus;

  competitors?:
    EspnCompetitor[];

  situation?:
    EspnSituation;
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

  week?: {
    number?: number;
  };

  status?:
    EspnStatus;

  competitions?:
    EspnCompetition[];
};

type EspnScoreboard = {
  events?:
    EspnEvent[];
};

type SyncRequestBody = {
  leagueId?: string;
  season?: number;
  week?: number;
};

type NormalizedGame = {
  provider_event_id:
    string;

  kickoff_at:
    string;

  away_team_name:
    string;

  away_team_abbreviation:
    string | null;

  home_team_name:
    string;

  home_team_abbreviation:
    string | null;

  away_score:
    number | null;

  home_score:
    number | null;

  status_type:
    string | null;

  status_name:
    string | null;

  status_detail:
    string | null;

  period:
    number | null;

  display_clock:
    string | null;

  is_started:
    boolean;

  is_final:
    boolean;

  possession_team_espn_id:
    string | null;

  possession_team_abbreviation:
    string | null;

  down:
    number | null;

  distance:
    number | null;

  yard_line:
    number | null;

  yards_to_endzone:
    number | null;

  down_distance_text:
    string | null;

  possession_text:
    string | null;

  is_red_zone:
    boolean | null;

  last_play_text:
    string | null;
};

type NflGameRow = {
  id: number;
  espn_event_id: string;
  season: number;
  season_type: number;
  week: number;
  kickoff_at: string;

  home_team_id:
    number;

  away_team_id:
    number;

  home_score:
    number | null;

  away_score:
    number | null;

  status_type:
    string | null;

  status_name:
    string | null;

  status_detail:
    string | null;

  status_completed:
    boolean;

  updated_at:
    string;
};

type NflTeamRow = {
  id: number;

  espn_team_id:
    string | null;

  abbreviation:
    string;

  display_name:
    string;
};

type StaleGameRow = {
  id: number;
  provider_event_id:
    string;

  kickoff_at:
    string;

  spread_status:
    string | null;

  g365_home_spread:
    number | null;

  spread_published_at:
    string | null;

  spread_frozen_at:
    string | null;

  is_started:
    boolean;

  is_final:
    boolean;
};

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
  request:
    Request
) {
  if (
    process.env.NODE_ENV !==
    "production"
  ) {
    return true;
  }

  const configuredSecret =
    process.env
      .NFL_SYNC_SECRET ??
    process.env
      .GRIDIRON_SYNC_SECRET;

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
      ? authorization.slice(
          7
        )
      : null;

  return (
    headerSecret ===
      configuredSecret ||
    bearerSecret ===
      configuredSecret
  );
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
    return null;
  }

  const parsed =
    Number(value);

  return Number.isFinite(
    parsed
  )
    ? Math.trunc(
        parsed
      )
    : null;
}

function toNullableInteger(
  value:
    number |
    null |
    undefined
) {
  return Number.isFinite(
    value
  )
    ? Math.trunc(
        value as number
      )
    : null;
}

function normalizeTeamName(
  competitor:
    EspnCompetitor |
    undefined
) {
  return (
    competitor?.team
      ?.displayName ??
    competitor?.team
      ?.shortDisplayName ??
    competitor?.team
      ?.abbreviation ??
    null
  );
}

/*
 * =====================================================
 * NCAA NORMALIZATION
 * =====================================================
 *
 * NCAA continues to come directly from ESPN.
 */
function normalizeCollegeEvent(
  event:
    EspnEvent
): NormalizedGame | null {
  const competition =
    event.competitions?.[0];

  if (!competition) {
    return null;
  }

  const eventId =
    event.id ??
    competition.id;

  const kickoffRaw =
    competition.date ??
    event.date;

  if (
    !eventId ||
    !kickoffRaw
  ) {
    return null;
  }

  const kickoff =
    new Date(
      kickoffRaw
    );

  if (
    Number.isNaN(
      kickoff.getTime()
    )
  ) {
    return null;
  }

  const home =
    competition.competitors
      ?.find(
        (row) =>
          row.homeAway ===
          "home"
      );

  const away =
    competition.competitors
      ?.find(
        (row) =>
          row.homeAway ===
          "away"
      );

  const homeName =
    normalizeTeamName(
      home
    );

  const awayName =
    normalizeTeamName(
      away
    );

  if (
    !homeName ||
    !awayName
  ) {
    return null;
  }

  const status =
    competition.status ??
    event.status;

  const state =
    status?.type
      ?.state ??
    null;

  const isFinal =
    status?.type
      ?.completed ===
    true;

  const isStarted =
    isFinal ||
    state === "in" ||
    state === "post";

  const situation =
    competition.situation;

  const possessionId =
    situation?.possession
      ? String(
          situation.possession
        )
      : null;

  const possessionCompetitor =
    possessionId
      ? competition.competitors
          ?.find(
            (row) =>
              String(
                row.team?.id ??
                ""
              ) ===
              possessionId
          )
      : undefined;

  return {
    provider_event_id:
      String(
        eventId
      ),

    kickoff_at:
      kickoff.toISOString(),

    away_team_name:
      awayName,

    away_team_abbreviation:
      away?.team
        ?.abbreviation ??
      null,

    home_team_name:
      homeName,

    home_team_abbreviation:
      home?.team
        ?.abbreviation ??
      null,

    away_score:
      toScore(
        away?.score
      ),

    home_score:
      toScore(
        home?.score
      ),

    status_type:
      status?.type
        ?.id ??
      null,

    status_name:
      status?.type
        ?.name ??
      null,

    status_detail:
      status?.type
        ?.detail ??
      status?.type
        ?.shortDetail ??
      status?.type
        ?.description ??
      null,

    period:
      Number.isInteger(
        status?.period
      )
        ? status?.period ??
          null
        : null,

    display_clock:
      status
        ?.displayClock ??
      null,

    is_started:
      isStarted,

    is_final:
      isFinal,

    possession_team_espn_id:
      isStarted &&
      !isFinal
        ? possessionId
        : null,

    possession_team_abbreviation:
      isStarted &&
      !isFinal
        ? possessionCompetitor
            ?.team
            ?.abbreviation ??
          null
        : null,

    down:
      isStarted &&
      !isFinal
        ? toNullableInteger(
            situation?.down
          )
        : null,

    distance:
      isStarted &&
      !isFinal
        ? toNullableInteger(
            situation?.distance
          )
        : null,

    yard_line:
      isStarted &&
      !isFinal
        ? toNullableInteger(
            situation?.yardLine
          )
        : null,

    yards_to_endzone:
      isStarted &&
      !isFinal
        ? toNullableInteger(
            situation
              ?.yardsToEndzone
          )
        : null,

    down_distance_text:
      isStarted &&
      !isFinal
        ? situation
            ?.downDistanceText ??
          situation
            ?.shortDownDistanceText ??
          null
        : null,

    possession_text:
      isStarted &&
      !isFinal
        ? situation
            ?.possessionText ??
          null
        : null,

    is_red_zone:
      isStarted &&
      !isFinal
        ? situation
            ?.isRedZone ??
          null
        : null,

    last_play_text:
      isStarted &&
      !isFinal
        ? situation
            ?.lastPlay
            ?.text ??
          situation
            ?.lastPlay
            ?.shortText ??
          null
        : null,
  };
}

function sportsForScope(
  scope:
    FootballScope
) {
  if (
    scope ===
    "college_only"
  ) {
    return [
      "ncaaf",
    ] as const;
  }

  if (
    scope ===
    "nfl_only"
  ) {
    return [
      "nfl",
    ] as const;
  }

  return [
    "ncaaf",
    "nfl",
  ] as const;
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

/*
 * =====================================================
 * NCAA ESPN SCOREBOARD
 * =====================================================
 *
 * NFL intentionally does NOT use this function.
 */
function collegeScoreboardUrl(
  slateStartsAt:
    string,
  slateEndsAt:
    string
) {
  const start =
    new Date(
      slateStartsAt
    );

  const endExclusive =
    new Date(
      slateEndsAt
    );

  return (
    "https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard" +
    `?dates=${yyyymmdd(
      start
    )}-${yyyymmdd(
      endExclusive
    )}` +
    "&seasontype=2" +
    "&limit=1000"
  );
}

async function fetchCollegeScoreboard(
  slateStartsAt:
    string,
  slateEndsAt:
    string
) {
  const response =
    await fetch(
      collegeScoreboardUrl(
        slateStartsAt,
        slateEndsAt
      ),
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

  if (
    !response.ok
  ) {
    throw new Error(
      `ESPN NCAAF scoreboard returned HTTP ${response.status}: ${text.slice(
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
      "ESPN NCAAF scoreboard returned invalid JSON."
    );
  }

  const startMs =
    new Date(
      slateStartsAt
    ).getTime();

  const endMs =
    new Date(
      slateEndsAt
    ).getTime();

  return (
    payload.events ??
    []
  ).filter(
    (event) => {
      /*
       * Pick'em regular season only.
       *
       * ESPN:
       * 1 = preseason
       * 2 = regular season
       * 3 = postseason
       */
      if (
        event.season?.type !==
        2
      ) {
        return false;
      }

      const raw =
        event.competitions?.[0]
          ?.date ??
        event.date;

      if (!raw) {
        return false;
      }

      const kickoffMs =
        new Date(
          raw
        ).getTime();

      return (
        Number.isFinite(
          kickoffMs
        ) &&
        kickoffMs >=
          startMs &&
        kickoffMs <
          endMs
      );
    }
  );
}

/*
 * =====================================================
 * SHARED NFL SOURCE
 * =====================================================
 *
 * nfl_games is the authoritative NFL schedule/status/
 * score source for Pick'em.
 *
 * Pick'em no longer independently calls ESPN for NFL.
 */
async function loadSharedNflGames(
  supabase:
    ReturnType<
      typeof createSupabaseAdmin
    >,
  season:
    number,
  slateStartsAt:
    string,
  slateEndsAt:
    string
): Promise<
  NormalizedGame[]
> {
  const {
    data:
      nflGameData,
    error:
      nflGameError,
  } =
    await supabase
      .from(
        "nfl_games"
      )
      .select(`
        id,
        espn_event_id,
        season,
        season_type,
        week,
        kickoff_at,
        home_team_id,
        away_team_id,
        home_score,
        away_score,
        status_type,
        status_name,
        status_detail,
        status_completed,
        updated_at
      `)
      .eq(
        "season",
        season
      )
      .eq(
        "season_type",
        2
      )
      .gte(
        "kickoff_at",
        slateStartsAt
      )
      .lt(
        "kickoff_at",
        slateEndsAt
      )
      .order(
        "kickoff_at",
        {
          ascending:
            true,
        }
      );

  if (
    nflGameError
  ) {
    throw new Error(
      `Could not load shared NFL games: ${nflGameError.message}`
    );
  }

  const nflGames =
    (
      nflGameData ??
      []
    ) as NflGameRow[];

  if (
    nflGames.length ===
    0
  ) {
    return [];
  }

  const teamIds =
    [
      ...new Set(
        nflGames.flatMap(
          (game) => [
            game.home_team_id,
            game.away_team_id,
          ]
        )
      ),
    ];

  const {
    data:
      teamData,
    error:
      teamError,
  } =
    await supabase
      .from(
        "nfl_teams"
      )
      .select(`
        id,
        espn_team_id,
        abbreviation,
        display_name
      `)
      .in(
        "id",
        teamIds
      );

  if (
    teamError
  ) {
    throw new Error(
      `Could not load NFL teams: ${teamError.message}`
    );
  }

  const teamMap =
    new Map<
      number,
      NflTeamRow
    >();

  for (
    const team of (
      teamData ??
      []
    ) as NflTeamRow[]
  ) {
    teamMap.set(
      team.id,
      team
    );
  }

  const normalized:
    NormalizedGame[] =
    [];

  for (
    const game of
      nflGames
  ) {
    const homeTeam =
      teamMap.get(
        game.home_team_id
      );

    const awayTeam =
      teamMap.get(
        game.away_team_id
      );

    if (
      !homeTeam ||
      !awayTeam
    ) {
      throw new Error(
        `NFL team mapping is missing for shared NFL game ${game.id}.`
      );
    }

    const normalizedStatusName =
      (
        game.status_name ??
        ""
      ).toUpperCase();

    const normalizedStatusType =
      (
        game.status_type ??
        ""
      ).toUpperCase();

    const normalizedStatusDetail =
      (
        game.status_detail ??
        ""
      ).toUpperCase();

    const isFinal =
      game.status_completed ===
      true;

    const statusText =
      `${normalizedStatusName} ${normalizedStatusType} ${normalizedStatusDetail}`;

    /*
     * A shared NFL game is considered started if:
     *
     * - it is completed, or
     * - its status clearly indicates live/in-progress play.
     *
     * We intentionally do not use kickoff time alone because
     * postponed/delayed games can pass kickoff without actually
     * starting.
     */
    const isStarted =
      isFinal ||
      statusText.includes(
        "IN_PROGRESS"
      ) ||
      statusText.includes(
        "IN PROGRESS"
      ) ||
      statusText.includes(
        "HALFTIME"
      ) ||
      statusText.includes(
        "END_PERIOD"
      ) ||
      statusText.includes(
        "END PERIOD"
      ) ||
      statusText.includes(
        "1ST QUARTER"
      ) ||
      statusText.includes(
        "2ND QUARTER"
      ) ||
      statusText.includes(
        "3RD QUARTER"
      ) ||
      statusText.includes(
        "4TH QUARTER"
      ) ||
      statusText.includes(
        "OVERTIME"
      );

    normalized.push({
      provider_event_id:
        game.espn_event_id,

      kickoff_at:
        new Date(
          game.kickoff_at
        ).toISOString(),

      away_team_name:
        awayTeam.display_name,

      away_team_abbreviation:
        awayTeam.abbreviation,

      home_team_name:
        homeTeam.display_name,

      home_team_abbreviation:
        homeTeam.abbreviation,

      away_score:
        game.away_score,

      home_score:
        game.home_score,

      status_type:
        game.status_type,

      status_name:
        game.status_name,

      status_detail:
        game.status_detail,

      /*
       * These optional live-display fields are not part of
       * the shared nfl_games contract.
       *
       * NFL Pick'em only requires the common NFL schedule,
       * status and scores for contest synchronization.
       */
      period:
        null,

      display_clock:
        null,

      is_started:
        isStarted,

      is_final:
        isFinal,

      possession_team_espn_id:
        null,

      possession_team_abbreviation:
        null,

      down:
        null,

      distance:
        null,

      yard_line:
        null,

      yards_to_endzone:
        null,

      down_distance_text:
        null,

      possession_text:
        null,

      is_red_zone:
        null,

      last_play_text:
        null,
    });
  }

  return normalized;
}

/*
 * =====================================================
 * SAFE STALE PICK'EM GAME CLEANUP
 * =====================================================
 *
 * Removes old/misassigned schedule rows only when there is
 * no contest data attached to them.
 *
 * A stale game is eligible for deletion only if:
 *
 * - it belongs to this exact league/season/week/sport
 * - kickoff falls outside the week's current slate window
 * - it has not started
 * - it is not final
 * - spread_status is still pending
 * - there is no G365 spread
 * - the spread was never published
 * - the spread was never frozen
 * - no pick references it
 * - no line-source audit row references it
 *
 * The pickem_picks FK is RESTRICT, giving us a second
 * database-level protection against deleting selected games.
 *
 * pickem_line_sources uses CASCADE, so line-source existence
 * is explicitly checked before deletion.
 */
async function cleanupStalePickemGames(
  supabase:
    ReturnType<
      typeof createSupabaseAdmin
    >,
  leagueId:
    string,
  season:
    number,
  week:
    number,
  sport:
    "ncaaf" | "nfl",
  slateStartsAt:
    string,
  slateEndsAt:
    string
) {
  const selectColumns =
    [
      "id",
      "provider_event_id",
      "kickoff_at",
      "spread_status",
      "g365_home_spread",
      "spread_published_at",
      "spread_frozen_at",
      "is_started",
      "is_final",
    ].join(
      ","
    );

  const [
    beforeSlateResult,
    afterSlateResult,
  ] =
    await Promise.all([
      supabase
        .from(
          "pickem_games"
        )
        .select(
          selectColumns
        )
        .eq(
          "league_id",
          leagueId
        )
        .eq(
          "season",
          season
        )
        .eq(
          "week",
          week
        )
        .eq(
          "sport",
          sport
        )
        .lt(
          "kickoff_at",
          slateStartsAt
        ),

      supabase
        .from(
          "pickem_games"
        )
        .select(
          selectColumns
        )
        .eq(
          "league_id",
          leagueId
        )
        .eq(
          "season",
          season
        )
        .eq(
          "week",
          week
        )
        .eq(
          "sport",
          sport
        )
        .gte(
          "kickoff_at",
          slateEndsAt
        ),
    ]);

  if (
    beforeSlateResult.error
  ) {
    throw new Error(
      `Could not inspect stale ${sport.toUpperCase()} games before the Pick'em slate: ${beforeSlateResult.error.message}`
    );
  }

  if (
    afterSlateResult.error
  ) {
    throw new Error(
      `Could not inspect stale ${sport.toUpperCase()} games after the Pick'em slate: ${afterSlateResult.error.message}`
    );
  }

  const staleRows =
    [
      ...(
        beforeSlateResult.data ??
        []
      ),
      ...(
        afterSlateResult.data ??
        []
      ),
    ] as unknown as
      StaleGameRow[];

  if (
    staleRows.length ===
    0
  ) {
    return {
      candidates:
        0,

      deleted:
        0,

      preserved:
        0,

      deletedIds:
        [] as number[],
    };
  }

  /*
   * First enforce all game-level safeguards.
   */
  const potentiallyDeletable =
    staleRows.filter(
      (game) =>
        game.is_started !==
          true &&
        game.is_final !==
          true &&
        game.spread_status ===
          "pending" &&
        game.g365_home_spread ===
          null &&
        game.spread_published_at ===
          null &&
        game.spread_frozen_at ===
          null
    );

  if (
    potentiallyDeletable.length ===
    0
  ) {
    return {
      candidates:
        staleRows.length,

      deleted:
        0,

      preserved:
        staleRows.length,

      deletedIds:
        [] as number[],
    };
  }

  const candidateIds =
    potentiallyDeletable.map(
      (game) =>
        Number(
          game.id
        )
    );

  /*
   * Explicitly inspect picks.
   *
   * The FK is RESTRICT, but doing this check ourselves keeps
   * cleanup intentional instead of relying only on a failed
   * database DELETE.
   */
  const {
    data:
      pickRows,
    error:
      pickError,
  } =
    await supabase
      .from(
        "pickem_picks"
      )
      .select(
        "pickem_game_id"
      )
      .in(
        "pickem_game_id",
        candidateIds
      );

  if (
    pickError
  ) {
    throw new Error(
      `Could not inspect Pick'em picks before stale-game cleanup: ${pickError.message}`
    );
  }

  /*
   * Explicitly protect line-source audit records because
   * their foreign key uses ON DELETE CASCADE.
   */
  const {
    data:
      lineRows,
    error:
      lineError,
  } =
    await supabase
      .from(
        "pickem_line_sources"
      )
      .select(
        "pickem_game_id"
      )
      .in(
        "pickem_game_id",
        candidateIds
      );

  if (
    lineError
  ) {
    throw new Error(
      `Could not inspect Pick'em line sources before stale-game cleanup: ${lineError.message}`
    );
  }

  const protectedIds =
    new Set<number>();

  for (
    const row of
      pickRows ??
      []
  ) {
    protectedIds.add(
      Number(
        row.pickem_game_id
      )
    );
  }

  for (
    const row of
      lineRows ??
      []
  ) {
    protectedIds.add(
      Number(
        row.pickem_game_id
      )
    );
  }

  const deletableIds =
    candidateIds.filter(
      (id) =>
        !protectedIds.has(
          id
        )
    );

  if (
    deletableIds.length ===
    0
  ) {
    return {
      candidates:
        staleRows.length,

      deleted:
        0,

      preserved:
        staleRows.length,

      deletedIds:
        [] as number[],
    };
  }

  /*
   * Re-state all game-level safeguards inside the DELETE.
   *
   * This protects us if one of those fields changes between
   * the SELECT and DELETE.
   *
   * pickem_picks FK RESTRICT protects against a newly-created
   * pick during this interval.
   */
  const {
    data:
      deletedRows,
    error:
      deleteError,
  } =
    await supabase
      .from(
        "pickem_games"
      )
      .delete()
      .in(
        "id",
        deletableIds
      )
      .eq(
        "league_id",
        leagueId
      )
      .eq(
        "season",
        season
      )
      .eq(
        "week",
        week
      )
      .eq(
        "sport",
        sport
      )
      .eq(
        "is_started",
        false
      )
      .eq(
        "is_final",
        false
      )
      .eq(
        "spread_status",
        "pending"
      )
      .is(
        "g365_home_spread",
        null
      )
      .is(
        "spread_published_at",
        null
      )
      .is(
        "spread_frozen_at",
        null
      )
      .select(
        "id"
      );

  if (
    deleteError
  ) {
    throw new Error(
      `Could not safely clean stale ${sport.toUpperCase()} Pick'em games: ${deleteError.message}`
    );
  }

  const deletedIds =
    (
      deletedRows ??
      []
    ).map(
      (row) =>
        Number(
          row.id
        )
    );

  return {
    candidates:
      staleRows.length,

    deleted:
      deletedIds.length,

    preserved:
      staleRows.length -
      deletedIds.length,

    deletedIds,
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
          "Unauthorized Pick'em game sync request.",
      },
      {
        status:
          401,
      }
    );
  }

  try {
    let body:
      SyncRequestBody = {};

    try {
      body =
        (
          await request.json()
        ) as SyncRequestBody;
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

    const requestedWeek =
      body.week ===
      undefined
        ? null
        : Number(
            body.week
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

    if (
      requestedWeek !==
        null &&
      (
        !Number.isInteger(
          requestedWeek
        ) ||
        requestedWeek <
          1 ||
        requestedWeek >
          30
      )
    ) {
      return NextResponse.json(
        {
          success:
            false,

          error:
            "A valid Pick'em week is required.",
        },
        {
          status:
            400,
        }
      );
    }

    const supabase =
      createSupabaseAdmin();

    let weeksQuery =
      supabase
        .from(
          "pickem_weeks"
        )
        .select(
          "id,league_id,season,week,status,line_day_at,finalize_not_before,slate_starts_at,slate_ends_at"
        );

    /*
     * Explicit league requests are allowed to target a
     * specific setup/test week.
     *
     * Normal cron operation ignores final weeks and only
     * considers a reasonable current/future lifecycle window.
     */
    if (
      body.leagueId
    ) {
      weeksQuery =
        weeksQuery.eq(
          "league_id",
          body.leagueId
        );
    } else {
      const now =
        new Date();

      const lower =
        new Date(
          now.getTime() -
          2 *
            24 *
            60 *
            60 *
            1000
        ).toISOString();

      const upper =
        new Date(
          now.getTime() +
          14 *
            24 *
            60 *
            60 *
            1000
        ).toISOString();

      weeksQuery =
        weeksQuery
          .neq(
            "status",
            "final"
          )
          .gte(
            "slate_ends_at",
            lower
          )
          .lte(
            "slate_starts_at",
            upper
          );
    }

    if (
      requestedSeason !==
      null
    ) {
      weeksQuery =
        weeksQuery.eq(
          "season",
          requestedSeason
        );
    }

    if (
      requestedWeek !==
      null
    ) {
      weeksQuery =
        weeksQuery.eq(
          "week",
          requestedWeek
        );
    }

    const {
      data:
        weekData,
      error:
        weekError,
    } =
      await weeksQuery;

    if (
      weekError
    ) {
      throw new Error(
        `Could not load Pick'em weeks: ${weekError.message}`
      );
    }

    const weeks =
      (
        weekData ??
        []
      ) as PickemWeekRow[];

    if (
      weeks.length ===
      0
    ) {
      return NextResponse.json({
        success:
          true,

        source:
          "G365 shared NFL + ESPN NCAA",

        weeksProcessed:
          0,

        gamesUpserted:
          0,

        gamesFinal:
          0,

        staleGamesFound:
          0,

        staleGamesDeleted:
          0,

        staleGamesPreserved:
          0,

        message:
          "No matching Pick'em weeks are ready for game sync.",
      });
    }

    const leagueIds =
      [
        ...new Set(
          weeks.map(
            (row) =>
              row.league_id
          )
        ),
      ];

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
          leagueIds
        );

    if (
      settingsError
    ) {
      throw new Error(
        `Could not load Pick'em settings: ${settingsError.message}`
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
      ) as PickemSettingsRow[]
    ) {
      settingsMap.set(
        row.league_id,
        row.football_scope
      );
    }

    /*
     * =====================================================
     * SHARED FETCH CACHES
     * =====================================================
     *
     * Multiple Pick'em leagues can share the same slate
     * window. Fetch/load each underlying source only once.
     */

    const collegeCache =
      new Map<
        string,
        EspnEvent[]
      >();

    const nflCache =
      new Map<
        string,
        NormalizedGame[]
      >();

    let gamesUpserted =
      0;

    let gamesFinal =
      0;

    let gamesSkipped =
      0;

    let gradingCalls =
      0;

    let resultRefreshes =
      0;

    let collegeFeedsFetched =
      0;

    let sharedNflLoads =
      0;

    let staleGamesFound =
      0;

    let staleGamesDeleted =
      0;

    let staleGamesPreserved =
      0;

    const details:
      Array<{
        leagueId:
          string;

        season:
          number;

        week:
          number;

        sport:
          string;

        source:
          string;

        games:
          number;

        staleCandidates:
          number;

        staleDeleted:
          number;

        stalePreserved:
          number;
      }> = [];

    for (
      const pickemWeek
      of weeks
    ) {
      const scope =
        settingsMap.get(
          pickemWeek.league_id
        );

      if (!scope) {
        gamesSkipped +=
          1;

        continue;
      }

      if (
        !pickemWeek
          .slate_starts_at ||
        !pickemWeek
          .slate_ends_at
      ) {
        gamesSkipped +=
          1;

        continue;
      }

      for (
        const sport
        of sportsForScope(
          scope
        )
      ) {
        let games:
          NormalizedGame[] =
          [];

        let source =
          "";

        /*
         * =================================================
         * NCAA
         * =================================================
         *
         * Direct ESPN source.
         */
        if (
          sport ===
          "ncaaf"
        ) {
          const cacheKey =
            `${pickemWeek.slate_starts_at}:${pickemWeek.slate_ends_at}`;

          let events =
            collegeCache.get(
              cacheKey
            );

          if (!events) {
            events =
              await fetchCollegeScoreboard(
                pickemWeek.slate_starts_at,
                pickemWeek.slate_ends_at
              );

            collegeCache.set(
              cacheKey,
              events
            );

            collegeFeedsFetched +=
              1;
          }

          games =
            events
              .map(
                normalizeCollegeEvent
              )
              .filter(
                (
                  game
                ): game is NormalizedGame =>
                  game !==
                  null
              );

          source =
            "ESPN NCAA";
        }

        /*
         * =================================================
         * NFL
         * =================================================
         *
         * Shared G365 NFL source.
         *
         * NO independent ESPN NFL scoreboard request.
         */
        if (
          sport ===
          "nfl"
        ) {
          const cacheKey =
            `${pickemWeek.season}:${pickemWeek.slate_starts_at}:${pickemWeek.slate_ends_at}`;

          let sharedGames =
            nflCache.get(
              cacheKey
            );

          if (!sharedGames) {
            sharedGames =
              await loadSharedNflGames(
                supabase,
                pickemWeek.season,
                pickemWeek.slate_starts_at,
                pickemWeek.slate_ends_at
              );

            nflCache.set(
              cacheKey,
              sharedGames
            );

            sharedNflLoads +=
              1;
          }

          games =
            sharedGames;

          source =
            "G365 shared nfl_games";
        }

        let sportCount =
          0;

        for (
          const normalized
          of games
        ) {
          const now =
            new Date()
              .toISOString();

          /*
           * Common fields shared by NFL and NCAA.
           */
          const basePayload = {
            league_id:
              pickemWeek.league_id,

            pickem_week_id:
              pickemWeek.id,

            season:
              pickemWeek.season,

            week:
              pickemWeek.week,

            sport,

            provider:
              "espn",

            provider_event_id:
              normalized.provider_event_id,

            kickoff_at:
              normalized.kickoff_at,

            away_team_name:
              normalized.away_team_name,

            away_team_abbreviation:
              normalized.away_team_abbreviation,

            home_team_name:
              normalized.home_team_name,

            home_team_abbreviation:
              normalized.home_team_abbreviation,

            away_score:
              normalized.away_score,

            home_score:
              normalized.home_score,

            status_type:
              normalized.status_type,

            status_name:
              normalized.status_name,

            status_detail:
              normalized.status_detail,

            is_started:
              normalized.is_started,

            is_final:
              normalized.is_final,

            last_score_sync_at:
              now,

            updated_at:
              now,
          };

          /*
           * NCAA still carries ESPN live situation fields.
           *
           * NFL intentionally does NOT overwrite any optional
           * live situation columns with null because those
           * fields are not part of the shared nfl_games
           * contract.
           */
          const payload =
            sport ===
            "ncaaf"
              ? {
                  ...basePayload,

                  period:
                    normalized.period,

                  display_clock:
                    normalized.display_clock,

                  possession_team_espn_id:
                    normalized
                      .possession_team_espn_id,

                  possession_team_abbreviation:
                    normalized
                      .possession_team_abbreviation,

                  down:
                    normalized.down,

                  distance:
                    normalized.distance,

                  yard_line:
                    normalized.yard_line,

                  yards_to_endzone:
                    normalized
                      .yards_to_endzone,

                  down_distance_text:
                    normalized
                      .down_distance_text,

                  possession_text:
                    normalized
                      .possession_text,

                  is_red_zone:
                    normalized.is_red_zone,

                  last_play_text:
                    normalized
                      .last_play_text,
                }
              : basePayload;

          const {
            data:
              upsertedData,
            error:
              upsertError,
          } =
            await supabase
              .from(
                "pickem_games"
              )
              .upsert(
                payload,
                {
                  onConflict:
                    "league_id,provider,provider_event_id",
                }
              )
              .select(
                "id,is_final"
              )
              .single();

          if (
            upsertError
          ) {
            throw new Error(
              `Could not upsert ${sport.toUpperCase()} game ${normalized.provider_event_id}: ${upsertError.message}`
            );
          }

          gamesUpserted +=
            1;

          sportCount +=
            1;

          if (
            upsertedData
              ?.is_final ===
            true
          ) {
            gamesFinal +=
              1;

            /*
             * Keep explicit grading as an idempotent safety
             * net.
             *
             * The DB trigger handles qualifying final updates,
             * while this also protects the case where a game
             * first enters pickem_games already final.
             */
            const {
              error:
                gradingError,
            } =
              await supabase.rpc(
                "grade_pickem_game",
                {
                  p_pickem_game_id:
                    upsertedData.id,
                }
              );

            if (
              gradingError
            ) {
              throw new Error(
                `Could not grade Pick'em game ${upsertedData.id}: ${gradingError.message}`
              );
            }

            gradingCalls +=
              1;
          }
        }

        /*
         * =================================================
         * SAFE STALE-GAME CLEANUP
         * =================================================
         *
         * After the authoritative current slate is synced,
         * remove untouched games that are incorrectly attached
         * to this same Pick'em week but now fall outside its
         * slate window.
         */
        const cleanup =
          await cleanupStalePickemGames(
            supabase,
            pickemWeek.league_id,
            pickemWeek.season,
            pickemWeek.week,
            sport,
            pickemWeek.slate_starts_at,
            pickemWeek.slate_ends_at
          );

        staleGamesFound +=
          cleanup.candidates;

        staleGamesDeleted +=
          cleanup.deleted;

        staleGamesPreserved +=
          cleanup.preserved;

        details.push({
          leagueId:
            pickemWeek.league_id,

          season:
            pickemWeek.season,

          week:
            pickemWeek.week,

          sport,

          source,

          games:
            sportCount,

          staleCandidates:
            cleanup.candidates,

          staleDeleted:
            cleanup.deleted,

          stalePreserved:
            cleanup.preserved,
        });
      }

      /*
       * Mark the schedule synchronization time after all
       * enabled sports for the week have been processed.
       */
      const {
        error:
          weekUpdateError,
      } =
        await supabase
          .from(
            "pickem_weeks"
          )
          .update({
            schedule_synced_at:
              new Date()
                .toISOString(),

            updated_at:
              new Date()
                .toISOString(),
          })
          .eq(
            "id",
            pickemWeek.id
          );

      if (
        weekUpdateError
      ) {
        throw new Error(
          `Could not update Pick'em schedule sync timestamp for week ${pickemWeek.id}: ${weekUpdateError.message}`
        );
      }

      /*
       * Rebuild current weekly result totals.
       *
       * refresh_pickem_week_results is now lifecycle-safe and
       * can preserve/reapply finalized-week policy metadata.
       */
      const {
        error:
          refreshError,
      } =
        await supabase.rpc(
          "refresh_pickem_week_results",
          {
            p_pickem_week_id:
              pickemWeek.id,
          }
        );

      if (
        refreshError
      ) {
        throw new Error(
          `Could not refresh Pick'em week ${pickemWeek.id}: ${refreshError.message}`
        );
      }

      resultRefreshes +=
        1;
    }

    return NextResponse.json({
      success:
        true,

      source:
        "G365 shared NFL + ESPN NCAA",

      nflSource:
        "public.nfl_games",

      collegeSource:
        "ESPN",

      weeksProcessed:
        weeks.length,

      collegeFeedsFetched,

      sharedNflLoads,

      gamesUpserted,

      gamesFinal,

      gamesSkipped,

      staleGamesFound,

      staleGamesDeleted,

      staleGamesPreserved,

      gradingCalls,

      resultRefreshes,

      details,
    });
  } catch (
    error
  ) {
    console.error(
      "Pick'em game sync failed:",
      error
    );

    return NextResponse.json(
      {
        success:
          false,

        source:
          "G365 shared NFL + ESPN NCAA",

        error:
          error instanceof Error
            ? error.message
            : "Unknown Pick'em game sync error.",
      },
      {
        status:
          500,
      }
    );
  }
}