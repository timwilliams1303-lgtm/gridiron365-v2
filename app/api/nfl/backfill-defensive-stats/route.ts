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


/* =========================================================
   TYPES
========================================================= */

type BackfillRequestBody = {
  season?: number;
  seasonType?: number;
  limit?: number;
  offset?: number;
  eventId?: string;
  dryRun?: boolean;
};

type HistoricalGame = {
  id: number;
  espn_event_id: string;
  season: number;
  season_type: number;
  week: number;
  status_completed: boolean;
};

type DefensivePlayerStats = {
  espn_player_id: string;
  player_name: string | null;
  team_abbreviation: string | null;

  defensive_solo_tackles: number;
  defensive_assisted_tackles: number;
  defensive_total_tackles: number;
  defensive_tackles_for_loss: number;

  defensive_sacks: number;
  defensive_interceptions: number;
  defensive_fumble_recoveries: number;
  defensive_forced_fumbles: number;
  defensive_touchdowns: number;
  defensive_safeties: number;
  defensive_blocked_kicks: number;
  defensive_passes_defended: number;
  defensive_qb_hits: number;
};

type InternalPlayer = {
  id: number;
  espn_player_id: string | null;
  full_name: string;
  primary_position: string;
  team_abbreviation: string | null;
};

type HydratedPlayer = {
  id: number;
  espn_player_id: string | null;
  full_name: string;
  primary_position: string;
  team_abbreviation: string | null;
};

type EspnCoreAthlete = {
  id?: string;
  uid?: string;
  guid?: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  displayName?: string;
  jersey?: string | number;
  active?: boolean;

  position?: {
    id?: string;
    name?: string;
    displayName?: string;
    abbreviation?: string;
  };

  status?: {
    id?: string;
    name?: string;
    type?: string;
    abbreviation?: string;
  };

  headshot?: {
    href?: string;
    alt?: string;
  };
};

type GameBackfillResult = {
  nflGameId: number;
  eventId: string;
  week: number;
  defensiveAthletesFound: number;
  defensivePlayersMatched: number;
  defensivePlayersHydrated: number;
  defensivePlayersSkipped: number;
  defensiveRowsUpserted: number;
  hydrationFailures: number;
  dryRun: boolean;
  skippedPlayers: Array<{
    espnPlayerId: string;
    name: string | null;
    reason: string;
  }>;
  hydrationErrors: Array<{
    espnPlayerId: string;
    name: string | null;
    error: string;
  }>;
};


/* =========================================================
   CONSTANTS
========================================================= */

const DEFAULT_SEASON =
  2025;

const DEFAULT_SEASON_TYPE =
  2;

const DEFAULT_BATCH_LIMIT =
  10;

const MAX_BATCH_LIMIT =
  25;

const DEFENSIVE_POSITIONS =
  new Set([
    "DL",
    "DE",
    "DT",
    "NT",
    "EDGE",
    "LB",
    "ILB",
    "OLB",
    "MLB",
    "DB",
    "CB",
    "S",
    "FS",
    "SS",
  ]);


/* =========================================================
   SUPABASE
========================================================= */

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
      "Missing Supabase environment variables."
    );
  }

  return createClient(
    supabaseUrl,
    serviceRoleKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  );
}


/* =========================================================
   BASIC HELPERS
========================================================= */

function toNumber(
  value:
    | string
    | number
    | null
    | undefined
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
    ? parsed
    : 0;
}


function cleanText(
  value:
    | string
    | number
    | null
    | undefined
) {
  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  const cleaned =
    String(value)
      .trim();

  return cleaned ||
    null;
}


function getStat(
  labels: string[],
  stats: string[],
  wantedLabel: string
) {
  const wanted =
    wantedLabel
      .trim()
      .toUpperCase();

  const index =
    labels.findIndex(
      (label) =>
        String(label)
          .trim()
          .toUpperCase() ===
        wanted
    );

  if (
    index < 0 ||
    index >=
      stats.length
  ) {
    return null;
  }

  return stats[index] ??
    null;
}


function clampInteger(
  value: unknown,
  fallback: number,
  min: number,
  max: number
) {
  const parsed =
    Number(value);

  if (
    !Number.isInteger(
      parsed
    )
  ) {
    return fallback;
  }

  return Math.min(
    max,
    Math.max(
      min,
      parsed
    )
  );
}


function isDefensivePosition(
  position:
    | string
    | null
    | undefined
) {
  if (!position) {
    return false;
  }

  return DEFENSIVE_POSITIONS.has(
    position
      .trim()
      .toUpperCase()
  );
}


function normalizeHydratedPosition(
  corePosition?:
    | string
    | null
) {
  const position =
    cleanText(
      corePosition
    )
      ?.toUpperCase() ??
    null;

  if (!position) {
    return null;
  }

  const aliases:
    Record<
      string,
      string
    > = {
      "DEFENSIVE END": "DE",
      "DEFENSIVE TACKLE": "DT",
      "NOSE TACKLE": "NT",
      "LINEBACKER": "LB",
      "INSIDE LINEBACKER": "ILB",
      "OUTSIDE LINEBACKER": "OLB",
      "MIDDLE LINEBACKER": "MLB",
      "CORNERBACK": "CB",
      "SAFETY": "S",
      "FREE SAFETY": "FS",
      "STRONG SAFETY": "SS",
      "DEFENSIVE BACK": "DB",
    };

  return aliases[position] ??
    position;
}


function normalizeCoreStatus(
  athlete:
    EspnCoreAthlete
) {
  const status =
    cleanText(
      athlete.status
        ?.name ??
      athlete.status
        ?.type ??
      athlete.status
        ?.abbreviation
    );

  if (status) {
    return status
      .toUpperCase();
  }

  return athlete.active ===
    false
    ? "INACTIVE"
    : "ACTIVE";
}


/* =========================================================
   ESPN FETCH
========================================================= */

async function fetchJson(
  url: string
) {
  const response =
    await fetch(
      url,
      {
        headers: {
          Accept:
            "application/json",

          "User-Agent":
            "Mozilla/5.0 Gridiron365/1.0",
        },

        cache:
          "no-store",
      }
    );

  const text =
    await response.text();

  if (
    !response.ok
  ) {
    throw new Error(
      `ESPN returned HTTP ${response.status}: ${text.slice(
        0,
        500
      )}`
    );
  }

  return JSON.parse(
    text
  );
}


/* =========================================================
   DEFENSIVE NORMALIZATION
========================================================= */

function blankDefensivePlayer(
  espnPlayerId: string,
  playerName: string | null,
  teamAbbreviation: string | null
): DefensivePlayerStats {
  return {
    espn_player_id:
      espnPlayerId,

    player_name:
      playerName,

    team_abbreviation:
      teamAbbreviation,

    defensive_solo_tackles: 0,
    defensive_assisted_tackles: 0,
    defensive_total_tackles: 0,
    defensive_tackles_for_loss: 0,

    defensive_sacks: 0,
    defensive_interceptions: 0,
    defensive_fumble_recoveries: 0,
    defensive_forced_fumbles: 0,
    defensive_touchdowns: 0,
    defensive_safeties: 0,
    defensive_blocked_kicks: 0,
    defensive_passes_defended: 0,
    defensive_qb_hits: 0,
  };
}


function parseDefensivePlayers(
  summary: any
) {
  const playersByEspnId =
    new Map<
      string,
      DefensivePlayerStats
    >();

  const boxscorePlayerTeams =
    summary
      ?.boxscore
      ?.players ??
    [];

  for (
    const teamGroup
    of boxscorePlayerTeams
  ) {
    const teamAbbreviation =
      cleanText(
        teamGroup
          ?.team
          ?.abbreviation
      )
        ?.toUpperCase() ??
      null;

    for (
      const category
      of teamGroup
        ?.statistics ??
      []
    ) {
      const categoryName =
        String(
          category?.name ??
          ""
        );

      if (
        categoryName !==
          "defensive" &&
        categoryName !==
          "interceptions"
      ) {
        continue;
      }

      const labels =
        Array.isArray(
          category?.labels
        )
          ? category.labels.map(
              (label: unknown) =>
                String(label)
            )
          : [];

      for (
        const row
        of category
          ?.athletes ??
        []
      ) {
        const athleteId =
          row
            ?.athlete
            ?.id;

        if (!athleteId) {
          continue;
        }

        const athleteKey =
          String(
            athleteId
          );

        let player =
          playersByEspnId.get(
            athleteKey
          );

        if (!player) {
          player =
            blankDefensivePlayer(
              athleteKey,

              row
                ?.athlete
                ?.displayName ??
              row
                ?.athlete
                ?.fullName ??
              null,

              teamAbbreviation
            );

          playersByEspnId.set(
            athleteKey,
            player
          );
        }

        const stats =
          Array.isArray(
            row?.stats
          )
            ? row.stats.map(
                (stat: unknown) =>
                  String(
                    stat ??
                    ""
                  )
              )
            : [];

        /*
         * Keep this logic intentionally aligned with the
         * verified sync-live-boxscore defensive parser.
         */
        if (
          categoryName ===
            "defensive"
        ) {
          player
            .defensive_solo_tackles =
            toNumber(
              getStat(
                labels,
                stats,
                "SOLO"
              )
            );

          player
            .defensive_assisted_tackles =
            toNumber(
              getStat(
                labels,
                stats,
                "AST"
              )
            );

          const espnTotalTackles =
            getStat(
              labels,
              stats,
              "TOT"
            );

          player
            .defensive_total_tackles =
            espnTotalTackles !==
              null
              ? toNumber(
                  espnTotalTackles
                )
              : player
                  .defensive_solo_tackles +
                player
                  .defensive_assisted_tackles;

          player
            .defensive_tackles_for_loss =
            toNumber(
              getStat(
                labels,
                stats,
                "TFL"
              )
            );

          player
            .defensive_sacks =
            toNumber(
              getStat(
                labels,
                stats,
                "SACKS"
              )
            );

          player
            .defensive_passes_defended =
            toNumber(
              getStat(
                labels,
                stats,
                "PD"
              )
            );

          player
            .defensive_qb_hits =
            toNumber(
              getStat(
                labels,
                stats,
                "QB HTS"
              )
            );

          player
            .defensive_touchdowns =
            toNumber(
              getStat(
                labels,
                stats,
                "TD"
              )
            );
        }

        else if (
          categoryName ===
            "interceptions"
        ) {
          player
            .defensive_interceptions =
            toNumber(
              getStat(
                labels,
                stats,
                "INT"
              )
            );

          player
            .defensive_touchdowns +=
            toNumber(
              getStat(
                labels,
                stats,
                "TD"
              )
            );
        }
      }
    }
  }

  return Array.from(
    playersByEspnId
      .values()
  );
}


/* =========================================================
   PLAYER HYDRATION
========================================================= */

async function hydrateHistoricalDefender({
  supabase,
  season,
  espnPlayerId,
  historicalTeamAbbreviation,
}: {
  supabase: ReturnType<
    typeof createSupabaseAdmin
  >;
  season: number;
  espnPlayerId: string;
  historicalTeamAbbreviation:
    | string
    | null;
}): Promise<HydratedPlayer> {
  /*
   * Only called after a lookup proved the ESPN player is
   * missing from nfl_players. Existing/current players are
   * NEVER overwritten with a historical team.
   */
  const athleteUrl =
    `https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/${season}/athletes/${encodeURIComponent(
      espnPlayerId
    )}?lang=en&region=us`;

  const athlete =
    (
      await fetchJson(
        athleteUrl
      )
    ) as EspnCoreAthlete;

  const fullName =
    cleanText(
      athlete.fullName ??
      athlete.displayName
    ) ??
    cleanText(
      [
        athlete.firstName,
        athlete.lastName,
      ]
        .filter(Boolean)
        .join(" ")
    );

  const primaryPosition =
    normalizeHydratedPosition(
      athlete.position
        ?.abbreviation ??
      athlete.position
        ?.name ??
      null
    );

  if (!fullName) {
    throw new Error(
      "ESPN athlete record did not include a usable name."
    );
  }

  if (
    !primaryPosition ||
    !isDefensivePosition(
      primaryPosition
    )
  ) {
    throw new Error(
      `ESPN athlete position is not a supported defensive position: ${
        primaryPosition ??
        "unknown"
      }`
    );
  }

  const now =
    new Date()
      .toISOString();

  const upsertPayload = {
    espn_player_id:
      espnPlayerId,

    full_name:
      fullName,

    first_name:
      cleanText(
        athlete.firstName
      ),

    last_name:
      cleanText(
        athlete.lastName
      ),

    primary_position:
      primaryPosition,

    /*
     * This field is used only because this player does not
     * already exist in nfl_players. Existing/current players
     * retain their current team identity.
     */
    team_abbreviation:
      historicalTeamAbbreviation,

    jersey_number:
      cleanText(
        athlete.jersey
      ),

    status:
      normalizeCoreStatus(
        athlete
      ),

    is_active:
      athlete.active !==
        false,

    headshot_url:
      cleanText(
        athlete.headshot?.href
      ),

    updated_at:
      now,
  };

  const {
    data,
    error,
  } =
    await supabase
      .from(
        "nfl_players"
      )
      .upsert(
        upsertPayload,
        {
          onConflict:
            "espn_player_id",
        }
      )
      .select(
        `
          id,
          espn_player_id,
          full_name,
          primary_position,
          team_abbreviation
        `
      )
      .single();

  if (error) {
    throw new Error(
      `Unable to hydrate historical defender ${espnPlayerId}: ${error.message}`
    );
  }

  return data as
    HydratedPlayer;
}


/* =========================================================
   ONE GAME
========================================================= */

async function backfillOneGame({
  supabase,
  game,
  dryRun,
}: {
  supabase: ReturnType<
    typeof createSupabaseAdmin
  >;
  game: HistoricalGame;
  dryRun: boolean;
}): Promise<GameBackfillResult> {
  const summaryUrl =
    `https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=${encodeURIComponent(
      game.espn_event_id
    )}`;

  const summary =
    await fetchJson(
      summaryUrl
    );

  const competition =
    summary
      ?.header
      ?.competitions
      ?.[0];

  if (!competition) {
    throw new Error(
      "ESPN summary did not contain a competition."
    );
  }

  const completed =
    competition
      ?.status
      ?.type
      ?.completed ===
    true;

  if (!completed) {
    throw new Error(
      "ESPN does not currently mark this historical game as completed."
    );
  }

  const statusName =
    cleanText(
      competition
        ?.status
        ?.type
        ?.name
    ) ??
    "STATUS_FINAL";

  const defensivePlayers =
    parseDefensivePlayers(
      summary
    );

  const espnPlayerIds =
    defensivePlayers
      .map(
        (player) =>
          player
            .espn_player_id
      );

  let internalPlayers:
    InternalPlayer[] =
    [];

  if (
    espnPlayerIds.length >
    0
  ) {
    const {
      data,
      error,
    } =
      await supabase
        .from(
          "nfl_players"
        )
        .select(
          `
            id,
            espn_player_id,
            full_name,
            primary_position,
            team_abbreviation
          `
        )
        .in(
          "espn_player_id",
          espnPlayerIds
        );

    if (error) {
      throw new Error(
        `Unable to match defensive ESPN players: ${error.message}`
      );
    }

    internalPlayers =
      (
        data ??
        []
      ) as InternalPlayer[];
  }

  const internalByEspnId =
    new Map<
      string,
      InternalPlayer
    >();

  for (
    const player
    of internalPlayers
  ) {
    if (
      player.espn_player_id
    ) {
      internalByEspnId.set(
        String(
          player.espn_player_id
        ),
        player
      );
    }
  }

  let defensivePlayersMatched =
    0;

  let defensivePlayersHydrated =
    0;

  let defensivePlayersSkipped =
    0;

  let defensiveRowsUpserted =
    0;

  let hydrationFailures =
    0;

  const skippedPlayers:
    GameBackfillResult[
      "skippedPlayers"
    ] =
    [];

  const hydrationErrors:
    GameBackfillResult[
      "hydrationErrors"
    ] =
    [];

  const now =
    new Date()
      .toISOString();

  for (
    const normalized
    of defensivePlayers
  ) {
    let internal =
      internalByEspnId.get(
        normalized
          .espn_player_id
      ) ??
      null;

    if (!internal) {
      try {
        const hydrated =
          await hydrateHistoricalDefender({
            supabase,
            season:
              game.season,
            espnPlayerId:
              normalized
                .espn_player_id,
            historicalTeamAbbreviation:
              normalized
                .team_abbreviation,
          });

        internal =
          hydrated;

        internalByEspnId.set(
          normalized
            .espn_player_id,
          hydrated
        );

        defensivePlayersHydrated +=
          1;
      } catch (
        error
      ) {
        hydrationFailures +=
          1;

        defensivePlayersSkipped +=
          1;

        hydrationErrors.push({
          espnPlayerId:
            normalized
              .espn_player_id,

          name:
            normalized
              .player_name,

          error:
            error instanceof Error
              ? error.message
              : "Unknown hydration error",
        });

        continue;
      }
    }

    if (
      !isDefensivePosition(
        internal
          .primary_position
      )
    ) {
      defensivePlayersSkipped +=
        1;

      skippedPlayers.push({
        espnPlayerId:
          normalized
            .espn_player_id,

        name:
          normalized
            .player_name,

        reason:
          `Internal primary_position is ${internal.primary_position}, not a supported defensive position.`,
      });

      continue;
    }

    defensivePlayersMatched +=
      1;

    /*
     * IMPORTANT:
     *
     * team_abbreviation comes from the 2025 ESPN game,
     * NOT nfl_players.team_abbreviation.
     *
     * That preserves the historical team for this stat row
     * while allowing nfl_players to remain current-state.
     */
    const payload = {
      nfl_game_id:
        game.id,

      nfl_player_id:
        internal.id,

      season:
        game.season,

      season_type:
        game.season_type,

      week:
        game.week,

      team_abbreviation:
        normalized
          .team_abbreviation,

      game_status:
        statusName,

      is_live:
        false,

      is_final:
        true,

      defensive_solo_tackles:
        normalized
          .defensive_solo_tackles,

      defensive_assisted_tackles:
        normalized
          .defensive_assisted_tackles,

      defensive_total_tackles:
        normalized
          .defensive_total_tackles,

      defensive_tackles_for_loss:
        normalized
          .defensive_tackles_for_loss,

      defensive_sacks:
        normalized
          .defensive_sacks,

      defensive_interceptions:
        normalized
          .defensive_interceptions,

      defensive_fumble_recoveries:
        normalized
          .defensive_fumble_recoveries,

      defensive_forced_fumbles:
        normalized
          .defensive_forced_fumbles,

      defensive_touchdowns:
        normalized
          .defensive_touchdowns,

      defensive_safeties:
        normalized
          .defensive_safeties,

      defensive_blocked_kicks:
        normalized
          .defensive_blocked_kicks,

      defensive_passes_defended:
        normalized
          .defensive_passes_defended,

      defensive_qb_hits:
        normalized
          .defensive_qb_hits,

      provider:
        "espn",

      provider_player_id:
        normalized
          .espn_player_id,

      provider_game_id:
        game.espn_event_id,

      source_updated_at:
        now,

      last_synced_at:
        now,

      updated_at:
        now,
    };

    if (!dryRun) {
      const {
        error:
          upsertError,
      } =
        await supabase
          .from(
            "nfl_player_game_stats"
          )
          .upsert(
            payload,
            {
              onConflict:
                "nfl_game_id,nfl_player_id",
            }
          );

      if (
        upsertError
      ) {
        throw new Error(
          `Unable to upsert defensive stats for ${
            normalized
              .player_name ??
            normalized
              .espn_player_id
          }: ${upsertError.message}`
        );
      }

      defensiveRowsUpserted +=
        1;
    }
  }

  return {
    nflGameId:
      game.id,

    eventId:
      game.espn_event_id,

    week:
      game.week,

    defensiveAthletesFound:
      defensivePlayers.length,

    defensivePlayersMatched,

    defensivePlayersHydrated,

    defensivePlayersSkipped,

    defensiveRowsUpserted,

    hydrationFailures,

    dryRun,

    skippedPlayers,

    hydrationErrors,
  };
}


/* =========================================================
   POST
========================================================= */

export async function POST(
  request: Request
) {
  try {
    /*
     * Match the trusted-server secret pattern already used by
     * sync-live-boxscore in production.
     */
    if (
      process.env.NODE_ENV ===
      "production"
    ) {
      const expectedSecret =
        process.env
          .NFL_SYNC_SECRET;

      const providedSecret =
        request.headers.get(
          "x-gridiron-sync-secret"
        );

      if (
        expectedSecret &&
        providedSecret !==
          expectedSecret
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Unauthorized backfill request.",
          },
          {
            status: 401,
          }
        );
      }
    }

    let body:
      BackfillRequestBody =
      {};

    try {
      body =
        (
          await request.json()
        ) as BackfillRequestBody;
    } catch {
      /*
       * Body is optional.
       */
    }

    const season =
      clampInteger(
        body.season,
        DEFAULT_SEASON,
        2000,
        2100
      );

    const seasonType =
      clampInteger(
        body.seasonType,
        DEFAULT_SEASON_TYPE,
        1,
        4
      );

    const limit =
      clampInteger(
        body.limit,
        DEFAULT_BATCH_LIMIT,
        1,
        MAX_BATCH_LIMIT
      );

    const offset =
      clampInteger(
        body.offset,
        0,
        0,
        10000
      );

    const dryRun =
      body.dryRun ===
      true;

    const requestedEventId =
      cleanText(
        body.eventId
      );

    if (
      season !== 2025 ||
      seasonType !== 2
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "This route is intentionally restricted to the 2025 NFL regular season (season=2025, seasonType=2).",
        },
        {
          status: 400,
        }
      );
    }

    if (
      requestedEventId &&
      !/^\d+$/.test(
        requestedEventId
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "eventId must be a numeric ESPN event ID.",
        },
        {
          status: 400,
        }
      );
    }

    const supabase =
      createSupabaseAdmin();

    let games:
      HistoricalGame[] =
      [];

    if (
      requestedEventId
    ) {
      const {
        data,
        error,
      } =
        await supabase
          .from(
            "nfl_games"
          )
          .select(
            `
              id,
              espn_event_id,
              season,
              season_type,
              week,
              status_completed
            `
          )
          .eq(
            "season",
            2025
          )
          .eq(
            "season_type",
            2
          )
          .eq(
            "status_completed",
            true
          )
          .eq(
            "espn_event_id",
            requestedEventId
          )
          .maybeSingle();

      if (error) {
        throw new Error(
          `Unable to load requested historical game: ${error.message}`
        );
      }

      if (!data) {
        return NextResponse.json(
          {
            success: false,
            error:
              "The requested ESPN event is not a completed 2025 regular-season game in nfl_games.",
          },
          {
            status: 404,
          }
        );
      }

      games = [
        data as
          HistoricalGame,
      ];
    }

    else {
      const {
        data,
        error,
      } =
        await supabase
          .from(
            "nfl_games"
          )
          .select(
            `
              id,
              espn_event_id,
              season,
              season_type,
              week,
              status_completed
            `
          )
          .eq(
            "season",
            2025
          )
          .eq(
            "season_type",
            2
          )
          .eq(
            "status_completed",
            true
          )
          .not(
            "espn_event_id",
            "is",
            null
          )
          .order(
            "week",
            {
              ascending: true,
            }
          )
          .order(
            "kickoff_at",
            {
              ascending: true,
            }
          )
          .range(
            offset,
            offset +
              limit -
              1
          );

      if (error) {
        throw new Error(
          `Unable to load historical games: ${error.message}`
        );
      }

      games =
        (
          data ??
          []
        ) as HistoricalGame[];
    }

    if (
      games.length === 0
    ) {
      return NextResponse.json(
        {
          success: true,
          season,
          seasonType,
          dryRun,
          offset,
          limit,
          gamesProcessed: 0,
          message:
            "No completed 2025 regular-season games were found for this batch.",
        }
      );
    }

    const gameResults:
      GameBackfillResult[] =
      [];

    const gameErrors:
      Array<{
        nflGameId: number;
        eventId: string;
        week: number;
        error: string;
      }> =
      [];

    for (
      const game
      of games
    ) {
      try {
        const result =
          await backfillOneGame({
            supabase,
            game,
            dryRun,
          });

        gameResults.push(
          result
        );
      } catch (
        error
      ) {
        gameErrors.push({
          nflGameId:
            game.id,

          eventId:
            game.espn_event_id,

          week:
            game.week,

          error:
            error instanceof Error
              ? error.message
              : "Unknown historical defensive backfill error",
        });
      }
    }

    const totals =
      gameResults.reduce(
        (
          accumulator,
          result
        ) => {
          accumulator
            .defensiveAthletesFound +=
            result
              .defensiveAthletesFound;

          accumulator
            .defensivePlayersMatched +=
            result
              .defensivePlayersMatched;

          accumulator
            .defensivePlayersHydrated +=
            result
              .defensivePlayersHydrated;

          accumulator
            .defensivePlayersSkipped +=
            result
              .defensivePlayersSkipped;

          accumulator
            .defensiveRowsUpserted +=
            result
              .defensiveRowsUpserted;

          accumulator
            .hydrationFailures +=
            result
              .hydrationFailures;

          return accumulator;
        },
        {
          defensiveAthletesFound:
            0,

          defensivePlayersMatched:
            0,

          defensivePlayersHydrated:
            0,

          defensivePlayersSkipped:
            0,

          defensiveRowsUpserted:
            0,

          hydrationFailures:
            0,
        }
      );

    return NextResponse.json(
      {
        success:
          gameErrors.length ===
          0,

        mode:
          requestedEventId
            ? "single-event"
            : "batch",

        season,
        seasonType,
        dryRun,

        offset:
          requestedEventId
            ? null
            : offset,

        limit:
          requestedEventId
            ? 1
            : limit,

        gamesRequested:
          games.length,

        gamesProcessed:
          gameResults.length,

        gamesFailed:
          gameErrors.length,

        totals,

        gameResults,

        gameErrors,
      },
      {
        status:
          gameResults.length ===
            0 &&
          gameErrors.length >
            0
            ? 500
            : 200,
      }
    );
  } catch (
    error
  ) {
    console.error(
      "2025 defensive backfill failed:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        error:
          error instanceof Error
            ? error.message
            : "2025 defensive backfill failed.",
      },
      {
        status: 500,
      }
    );
  }
}
