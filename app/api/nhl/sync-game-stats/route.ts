import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

type SyncGameStatsRequestBody = {
  nhlGameId?: string | number;
};

type JsonRecord = Record<string, any>;

type InternalGameRow = {
  id: number;
  nhl_game_id: string;
  season: number;
  season_type: string;
  away_team_id: number | null;
  home_team_id: number | null;
};

type InternalTeamRow = {
  id: number;
  nhl_team_id: string | null;
  abbreviation: string;
  display_name: string;
};

type InternalPlayerRow = {
  id: number;
  nhl_player_id: string | null;
  team_id: number | null;
  display_name: string;
  position: string | null;
  position_group: string | null;
};

type PlayerDerivedStats = {
  faceoffWins: number;
  faceoffLosses: number;
  powerPlayGoals: number;
  powerPlayAssists: number;
  powerPlayPoints: number;
  shortHandedGoals: number;
  shortHandedAssists: number;
  shortHandedPoints: number;
  gameWinningGoals: number;
};

type TeamGameStatSummary = {
  shotsOnGoal: number;
  faceoffWins: number;
  powerPlayGoals: number;
  powerPlayOpportunities: number;
  penaltyMinutes: number;
  hits: number;
  blockedShots: number;
  giveaways: number;
  takeaways: number;
};

function createAdminClient() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Supabase admin environment variables are missing."
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

function errorResponse(
  message: string,
  status = 500,
  details?: unknown
) {
  return NextResponse.json(
    {
      success: false,
      error: message,
      ...(details !== undefined
        ? { details }
        : {}),
    },
    {
      status,
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

  const expectedSecret =
    process.env.GRIDIRON_SYNC_SECRET ??
    process.env.NFL_SYNC_SECRET;

  if (!expectedSecret) {
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
    headerSecret === expectedSecret ||
    bearerSecret === expectedSecret
  );
}

async function fetchJson(
  url: string
) {
  const response = await fetch(
    url,
    {
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "User-Agent":
          "Gridiron365/1.0",
      },
    }
  );

  if (!response.ok) {
    throw new Error(
      `NHL request failed (${response.status}) for ${url}`
    );
  }

  return (
    (await response.json()) as JsonRecord
  );
}

function toNumber(
  value: unknown,
  fallback = 0
) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return fallback;
  }

  const numberValue =
    Number(value);

  return Number.isFinite(
    numberValue
  )
    ? numberValue
    : fallback;
}

function parseTimeToSeconds(
  value: unknown
) {
  if (
    typeof value !== "string" ||
    !value.includes(":")
  ) {
    return 0;
  }

  const parts =
    value.split(":");

  if (parts.length !== 2) {
    return 0;
  }

  const minutes =
    Number(parts[0]);

  const seconds =
    Number(parts[1]);

  if (
    !Number.isFinite(minutes) ||
    !Number.isFinite(seconds)
  ) {
    return 0;
  }

  return (
    minutes * 60 +
    seconds
  );
}

function normalizePositionGroup(
  position: string | null
) {
  if (!position) {
    return null;
  }

  if (position === "G") {
    return "GOALIE";
  }

  if (position === "D") {
    return "DEFENSE";
  }

  if (
    position === "C" ||
    position === "L" ||
    position === "R" ||
    position === "LW" ||
    position === "RW"
  ) {
    return "FORWARD";
  }

  return null;
}

function flattenTeamPlayers(
  teamStats: JsonRecord | null | undefined
) {
  if (!teamStats) {
    return [];
  }

  const forwards =
    Array.isArray(
      teamStats.forwards
    )
      ? teamStats.forwards
      : [];

  const defense =
    Array.isArray(
      teamStats.defense
    )
      ? teamStats.defense
      : [];

  const goalies =
    Array.isArray(
      teamStats.goalies
    )
      ? teamStats.goalies
      : [];

  return [
    ...forwards,
    ...defense,
    ...goalies,
  ];
}

function getOrCreateDerived(
  map: Map<
    string,
    PlayerDerivedStats
  >,
  playerId: string
) {
  const existing =
    map.get(playerId);

  if (existing) {
    return existing;
  }

  const created:
    PlayerDerivedStats = {
      faceoffWins: 0,
      faceoffLosses: 0,
      powerPlayGoals: 0,
      powerPlayAssists: 0,
      powerPlayPoints: 0,
      shortHandedGoals: 0,
      shortHandedAssists: 0,
      shortHandedPoints: 0,
      gameWinningGoals: 0,
    };

  map.set(
    playerId,
    created
  );

  return created;
}

function getGoalStrength(
  goal: JsonRecord
) {
  const explicitStrength =
    typeof goal.strength ===
    "string"
      ? goal.strength
          .trim()
          .toLowerCase()
      : "";

  if (
    explicitStrength === "pp" ||
    explicitStrength ===
      "power-play" ||
    explicitStrength ===
      "powerplay"
  ) {
    return "PP";
  }

  if (
    explicitStrength === "sh" ||
    explicitStrength ===
      "short-handed" ||
    explicitStrength ===
      "shorthanded"
  ) {
    return "SH";
  }

  if (
    explicitStrength === "ev" ||
    explicitStrength ===
      "even-strength" ||
    explicitStrength ===
      "evenstrength"
  ) {
    return "EV";
  }

  /*
   * Fallback using NHL situationCode:
   *
   * [away goalie]
   * [away skaters]
   * [home skaters]
   * [home goalie]
   *
   * Examples:
   * 1551 = 5-on-5
   * 1451 = away 4, home 5
   * 1541 = away 5, home 4
   * 1560 = home extra attacker,
   *        home goalie absent
   */
  const situationCode =
    typeof goal.situationCode ===
    "string"
      ? goal.situationCode
      : "";

  if (
    situationCode.length !== 4
  ) {
    return "UNKNOWN";
  }

  const awaySkaters =
    Number(situationCode[1]);

  const homeSkaters =
    Number(situationCode[2]);

  if (
    !Number.isFinite(
      awaySkaters
    ) ||
    !Number.isFinite(
      homeSkaters
    )
  ) {
    return "UNKNOWN";
  }

  const isHome =
    goal.isHome === true;

  const scoringSkaters =
    isHome
      ? homeSkaters
      : awaySkaters;

  const opponentSkaters =
    isHome
      ? awaySkaters
      : homeSkaters;

  if (
    scoringSkaters >
    opponentSkaters
  ) {
    return "PP";
  }

  if (
    scoringSkaters <
    opponentSkaters
  ) {
    return "SH";
  }

  return "EV";
}

function collectLandingGoals(
  landing: JsonRecord
) {
  const periods =
    Array.isArray(
      landing?.summary?.scoring
    )
      ? landing.summary.scoring
      : [];

  const goals: JsonRecord[] =
    [];

  for (
    const period of periods
  ) {
    if (
      !Array.isArray(
        period?.goals
      )
    ) {
      continue;
    }

    for (
      const goal of
      period.goals
    ) {
      goals.push(goal);
    }
  }

  return goals;
}

function buildDerivedPlayerStats(
  playByPlay: JsonRecord,
  landing: JsonRecord,
  awayOfficialTeamId: string,
  homeOfficialTeamId: string,
  finalAwayScore: number,
  finalHomeScore: number
) {
  const derived =
    new Map<
      string,
      PlayerDerivedStats
    >();

  const plays =
    Array.isArray(
      playByPlay?.plays
    )
      ? playByPlay.plays
      : [];

  /*
   * Exact faceoff wins/losses
   * come directly from NHL PBP.
   */
  for (const play of plays) {
    if (
      play?.typeDescKey !==
      "faceoff"
    ) {
      continue;
    }

    const winningPlayerId =
      play?.details
        ?.winningPlayerId;

    const losingPlayerId =
      play?.details
        ?.losingPlayerId;

    if (
      winningPlayerId !==
        null &&
      winningPlayerId !==
        undefined
    ) {
      const player =
        getOrCreateDerived(
          derived,
          String(
            winningPlayerId
          )
        );

      player.faceoffWins += 1;
    }

    if (
      losingPlayerId !==
        null &&
      losingPlayerId !==
        undefined
    ) {
      const player =
        getOrCreateDerived(
          derived,
          String(
            losingPlayerId
          )
        );

      player.faceoffLosses +=
        1;
    }
  }

  const goals =
    collectLandingGoals(
      landing
    );

  const awayWon =
    finalAwayScore >
    finalHomeScore;

  const homeWon =
    finalHomeScore >
    finalAwayScore;

  const winningOfficialTeamId =
    awayWon
      ? awayOfficialTeamId
      : homeWon
        ? homeOfficialTeamId
        : null;

  const losingFinalScore =
    awayWon
      ? finalHomeScore
      : homeWon
        ? finalAwayScore
        : null;

  /*
   * For a winner with final score W
   * against loser score L, the GWG
   * is the winner's goal that first
   * makes its score L + 1.
   */
  let gameWinningGoalFound =
    false;

  for (const goal of goals) {
    const scorerId =
      goal?.playerId;

    if (
      scorerId === null ||
      scorerId === undefined
    ) {
      continue;
    }

    const scorerKey =
      String(scorerId);

    const scorerDerived =
      getOrCreateDerived(
        derived,
        scorerKey
      );

    const strength =
      getGoalStrength(goal);

    const assists =
      Array.isArray(
        goal?.assists
      )
        ? goal.assists
        : [];

    if (strength === "PP") {
      scorerDerived.powerPlayGoals +=
        1;

      scorerDerived.powerPlayPoints +=
        1;

      for (
        const assist of assists
      ) {
        if (
          assist?.playerId ===
            null ||
          assist?.playerId ===
            undefined
        ) {
          continue;
        }

        const assistDerived =
          getOrCreateDerived(
            derived,
            String(
              assist.playerId
            )
          );

        assistDerived.powerPlayAssists +=
          1;

        assistDerived.powerPlayPoints +=
          1;
      }
    }

    if (strength === "SH") {
      scorerDerived.shortHandedGoals +=
        1;

      scorerDerived.shortHandedPoints +=
        1;

      for (
        const assist of assists
      ) {
        if (
          assist?.playerId ===
            null ||
          assist?.playerId ===
            undefined
        ) {
          continue;
        }

        const assistDerived =
          getOrCreateDerived(
            derived,
            String(
              assist.playerId
            )
          );

        assistDerived.shortHandedAssists +=
          1;

        assistDerived.shortHandedPoints +=
          1;
      }
    }

    if (
      !gameWinningGoalFound &&
      winningOfficialTeamId &&
      losingFinalScore !== null
    ) {
      const isHome =
        goal?.isHome === true;

      const goalTeamId =
        isHome
          ? homeOfficialTeamId
          : awayOfficialTeamId;

      const scoringTeamScore =
        isHome
          ? toNumber(
              goal?.homeScore
            )
          : toNumber(
              goal?.awayScore
            );

      if (
        goalTeamId ===
          winningOfficialTeamId &&
        scoringTeamScore ===
          losingFinalScore + 1
      ) {
        scorerDerived.gameWinningGoals =
          1;

        gameWinningGoalFound =
          true;
      }
    }
  }

  return derived;
}

function indexTeamGameStats(
  rightRail: JsonRecord
) {
  const values =
    new Map<
      string,
      {
        awayValue: unknown;
        homeValue: unknown;
      }
    >();

  const rows =
    Array.isArray(
      rightRail?.teamGameStats
    )
      ? rightRail.teamGameStats
      : [];

  for (const row of rows) {
    if (
      typeof row?.category !==
      "string"
    ) {
      continue;
    }

    values.set(
      row.category,
      {
        awayValue:
          row.awayValue,
        homeValue:
          row.homeValue,
      }
    );
  }

  return values;
}

function parseFraction(
  value: unknown
) {
  if (
    typeof value !== "string"
  ) {
    return {
      numerator: 0,
      denominator: 0,
    };
  }

  const parts =
    value.split("/");

  if (parts.length !== 2) {
    return {
      numerator: 0,
      denominator: 0,
    };
  }

  return {
    numerator:
      toNumber(parts[0]),
    denominator:
      toNumber(parts[1]),
  };
}

function buildTeamSummary(
  rightRail: JsonRecord,
  side:
    | "away"
    | "home"
) {
  const index =
    indexTeamGameStats(
      rightRail
    );

  const valueFor = (
    category: string
  ) => {
    const row =
      index.get(category);

    if (!row) {
      return null;
    }

    return side === "away"
      ? row.awayValue
      : row.homeValue;
  };

  const faceoff =
    parseFraction(
      valueFor("faceoffWins")
    );

  const powerPlay =
    parseFraction(
      valueFor("powerPlay")
    );

  const summary:
    TeamGameStatSummary = {
      shotsOnGoal:
        toNumber(
          valueFor("sog")
        ),

      faceoffWins:
        faceoff.numerator,

      powerPlayGoals:
        powerPlay.numerator,

      powerPlayOpportunities:
        powerPlay.denominator,

      penaltyMinutes:
        toNumber(
          valueFor("pim")
        ),

      hits:
        toNumber(
          valueFor("hits")
        ),

      blockedShots:
        toNumber(
          valueFor(
            "blockedShots"
          )
        ),

      giveaways:
        toNumber(
          valueFor("giveaways")
        ),

      takeaways:
        toNumber(
          valueFor("takeaways")
        ),
    };

  return summary;
}

function isGameFinal(
  boxscore: JsonRecord
) {
  const state =
    typeof boxscore?.gameState ===
    "string"
      ? boxscore.gameState
          .toUpperCase()
      : "";

  return (
    state === "OFF" ||
    state === "FINAL"
  );
}

function getGoalieDecision(
  value: unknown
) {
  if (
    typeof value !== "string"
  ) {
    return null;
  }

  const decision =
    value
      .trim()
      .toUpperCase();

  if (
    decision === "W" ||
    decision === "L" ||
    decision === "OTL" ||
    decision === "ND"
  ) {
    return decision;
  }

  return null;
}

export async function POST(
  request: Request
) {
  try {
    if (!isAuthorized(request)) {
      return errorResponse(
        "Unauthorized.",
        401
      );
    }

    let body:
      SyncGameStatsRequestBody;

    try {
      body =
        (await request.json()) as
          SyncGameStatsRequestBody;
    } catch {
      return errorResponse(
        "A JSON request body is required.",
        400
      );
    }

    const officialNhlGameId =
      body.nhlGameId !==
        undefined &&
      body.nhlGameId !== null
        ? String(
            body.nhlGameId
          ).trim()
        : "";

    if (!officialNhlGameId) {
      return errorResponse(
        "nhlGameId is required.",
        400
      );
    }

    const supabase =
      createAdminClient();

    /*
     * Resolve external NHL game ID
     * to our internal nhl_games.id.
     *
     * IMPORTANT:
     * nhl_games.nhl_game_id =
     * official external NHL ID.
     *
     * nhl_player_game_stats.nhl_game_id
     * and nhl_team_game_stats.nhl_game_id
     * = internal public.nhl_games.id FK.
     */
    const {
      data: game,
      error: gameError,
    } = await supabase
      .from("nhl_games")
      .select(
        `
          id,
          nhl_game_id,
          season,
          season_type,
          away_team_id,
          home_team_id
        `
      )
      .eq(
        "nhl_game_id",
        officialNhlGameId
      )
      .maybeSingle();

    if (gameError) {
      return errorResponse(
        "Unable to load NHL game.",
        500,
        gameError
      );
    }

    if (!game) {
      return errorResponse(
        `No internal NHL game row was found for official NHL game ID ${officialNhlGameId}.`,
        404
      );
    }

    const internalGame =
      game as InternalGameRow;

    const baseUrl =
      `https://api-web.nhle.com/v1/gamecenter/${officialNhlGameId}`;

    const [
      boxscore,
      landing,
      playByPlay,
      rightRail,
    ] = await Promise.all([
      fetchJson(
        `${baseUrl}/boxscore`
      ),
      fetchJson(
        `${baseUrl}/landing`
      ),
      fetchJson(
        `${baseUrl}/play-by-play`
      ),
      fetchJson(
        `${baseUrl}/right-rail`
      ),
    ]);

    if (
      String(boxscore?.id) !==
      officialNhlGameId
    ) {
      return errorResponse(
        "The NHL boxscore response did not match the requested game.",
        409
      );
    }

    const awayOfficialTeamId =
      String(
        boxscore?.awayTeam?.id ??
          ""
      );

    const homeOfficialTeamId =
      String(
        boxscore?.homeTeam?.id ??
          ""
      );

    if (
      !awayOfficialTeamId ||
      !homeOfficialTeamId
    ) {
      return errorResponse(
        "Official NHL team IDs are missing from the boxscore.",
        409
      );
    }

    const {
      data: teamRows,
      error: teamsError,
    } = await supabase
      .from("nhl_teams")
      .select(
        `
          id,
          nhl_team_id,
          abbreviation,
          display_name
        `
      )
      .in(
        "nhl_team_id",
        [
          awayOfficialTeamId,
          homeOfficialTeamId,
        ]
      );

    if (teamsError) {
      return errorResponse(
        "Unable to resolve NHL teams.",
        500,
        teamsError
      );
    }

    const teamByOfficialId =
      new Map<
        string,
        InternalTeamRow
      >();

    for (
      const row of
      (teamRows ?? []) as
        InternalTeamRow[]
    ) {
      if (row.nhl_team_id) {
        teamByOfficialId.set(
          row.nhl_team_id,
          row
        );
      }
    }

    const awayTeam =
      teamByOfficialId.get(
        awayOfficialTeamId
      );

    const homeTeam =
      teamByOfficialId.get(
        homeOfficialTeamId
      );

    if (
      !awayTeam ||
      !homeTeam
    ) {
      return errorResponse(
        "One or both official NHL teams could not be mapped to public.nhl_teams.",
        409,
        {
          awayOfficialTeamId,
          homeOfficialTeamId,
          foundTeamIds: [
            ...teamByOfficialId.keys(),
          ],
        }
      );
    }

    /*
     * Safety check:
     * official NHL participants
     * must agree with the schedule row.
     */
    if (
      internalGame.away_team_id &&
      internalGame.away_team_id !==
        awayTeam.id
    ) {
      return errorResponse(
        "Away-team mapping conflicts with the existing NHL schedule row.",
        409,
        {
          scheduleAwayTeamId:
            internalGame.away_team_id,
          resolvedAwayTeamId:
            awayTeam.id,
        }
      );
    }

    if (
      internalGame.home_team_id &&
      internalGame.home_team_id !==
        homeTeam.id
    ) {
      return errorResponse(
        "Home-team mapping conflicts with the existing NHL schedule row.",
        409,
        {
          scheduleHomeTeamId:
            internalGame.home_team_id,
          resolvedHomeTeamId:
            homeTeam.id,
        }
      );
    }

    const awayBoxscorePlayers =
      flattenTeamPlayers(
        boxscore
          ?.playerByGameStats
          ?.awayTeam
      );

    const homeBoxscorePlayers =
      flattenTeamPlayers(
        boxscore
          ?.playerByGameStats
          ?.homeTeam
      );

    const allBoxscorePlayers =
      [
        ...awayBoxscorePlayers,
        ...homeBoxscorePlayers,
      ];

    const officialPlayerIds =
      [
        ...new Set(
          allBoxscorePlayers
            .map(
              (player) =>
                player?.playerId
            )
            .filter(
              (
                playerId
              ) =>
                playerId !==
                  null &&
                playerId !==
                  undefined
            )
            .map(
              (playerId) =>
                String(
                  playerId
                )
            )
        ),
      ];

    if (
      officialPlayerIds.length ===
      0
    ) {
      return errorResponse(
        "No player boxscore rows were returned by the NHL.",
        409
      );
    }

    const {
      data: playerRows,
      error: playersError,
    } = await supabase
      .from("nhl_players")
      .select(
        `
          id,
          nhl_player_id,
          team_id,
          display_name,
          position,
          position_group
        `
      )
      .in(
        "nhl_player_id",
        officialPlayerIds
      );

    if (playersError) {
      return errorResponse(
        "Unable to resolve NHL players.",
        500,
        playersError
      );
    }

    const playerByOfficialId =
      new Map<
        string,
        InternalPlayerRow
      >();

    for (
      const player of
      (playerRows ?? []) as
        InternalPlayerRow[]
    ) {
      if (
        player.nhl_player_id
      ) {
        playerByOfficialId.set(
          player.nhl_player_id,
          player
        );
      }
    }

    const missingOfficialPlayers =
      officialPlayerIds.filter(
        (officialPlayerId) =>
          !playerByOfficialId.has(
            officialPlayerId
          )
      );

    /*
     * We do not silently drop player
     * stats. Player identity must be
     * complete before writing the game.
     */
    if (
      missingOfficialPlayers.length >
      0
    ) {
      return errorResponse(
        "Some NHL boxscore players are missing from public.nhl_players. Run the NHL player sync before syncing this game.",
        409,
        {
          missingCount:
            missingOfficialPlayers.length,
          missingOfficialPlayerIds:
            missingOfficialPlayers,
        }
      );
    }

    const finalAwayScore =
      toNumber(
        boxscore?.awayTeam
          ?.score
      );

    const finalHomeScore =
      toNumber(
        boxscore?.homeTeam
          ?.score
      );

    const final =
      isGameFinal(boxscore);

    const derivedPlayerStats =
      buildDerivedPlayerStats(
        playByPlay,
        landing,
        awayOfficialTeamId,
        homeOfficialTeamId,
        finalAwayScore,
        finalHomeScore
      );

    /*
     * Determine whether a goalie
     * earned a shutout without
     * falsely crediting a 0-minute
     * backup.
     *
     * We only award it when:
     * - game is final
     * - team won
     * - exactly one goalie logged
     *   playing time for that team
     * - that goalie allowed 0 goals
     */
    const awayGoaliesPlayed =
      awayBoxscorePlayers.filter(
        (player) =>
          player?.position ===
            "G" &&
          parseTimeToSeconds(
            player?.toi
          ) > 0
      );

    const homeGoaliesPlayed =
      homeBoxscorePlayers.filter(
        (player) =>
          player?.position ===
            "G" &&
          parseTimeToSeconds(
            player?.toi
          ) > 0
      );

    const awayWon =
      finalAwayScore >
      finalHomeScore;

    const homeWon =
      finalHomeScore >
      finalAwayScore;

    const playerStatRows =
      allBoxscorePlayers.map(
        (boxscorePlayer) => {
          const officialPlayerId =
            String(
              boxscorePlayer.playerId
            );

          const internalPlayer =
            playerByOfficialId.get(
              officialPlayerId
            )!;

          const isAway =
            awayBoxscorePlayers.includes(
              boxscorePlayer
            );

          const internalTeam =
            isAway
              ? awayTeam
              : homeTeam;

          const position =
            typeof boxscorePlayer.position ===
            "string"
              ? boxscorePlayer.position
              : internalPlayer.position;

          const positionGroup =
            normalizePositionGroup(
              position
            ) ??
            internalPlayer.position_group;

          const derived =
            derivedPlayerStats.get(
              officialPlayerId
            ) ?? {
              faceoffWins: 0,
              faceoffLosses: 0,
              powerPlayGoals: 0,
              powerPlayAssists: 0,
              powerPlayPoints: 0,
              shortHandedGoals: 0,
              shortHandedAssists: 0,
              shortHandedPoints: 0,
              gameWinningGoals: 0,
            };

          const isGoalie =
            position === "G";

          const goalieDecision =
            isGoalie
              ? getGoalieDecision(
                  boxscorePlayer
                    ?.decision
                )
              : null;

          const goalieMinutes =
            isGoalie
              ? parseTimeToSeconds(
                  boxscorePlayer?.toi
                )
              : 0;

          const goalsAgainst =
            isGoalie
              ? toNumber(
                  boxscorePlayer
                    ?.goalsAgainst
                )
              : 0;

          let shutout = 0;

          if (
            final &&
            isGoalie &&
            goalieMinutes > 0 &&
            goalsAgainst === 0
          ) {
            if (
              isAway &&
              awayWon &&
              awayGoaliesPlayed.length ===
                1
            ) {
              shutout = 1;
            }

            if (
              !isAway &&
              homeWon &&
              homeGoaliesPlayed.length ===
                1
            ) {
              shutout = 1;
            }
          }

          /*
           * NHL boxscore
           * powerPlayGoals is the
           * authoritative PPG total.
           *
           * PBP/landing derived PPG is
           * retained in raw_stats for
           * audit, but does not replace
           * the boxscore total.
           */
          const authoritativePowerPlayGoals =
            toNumber(
              boxscorePlayer
                ?.powerPlayGoals
            );

          return {
            nhl_game_id:
              internalGame.id,

            nhl_player_id:
              internalPlayer.id,

            team_id:
              internalTeam.id,

            season:
              internalGame.season,

            season_type:
              internalGame.season_type,

            position,

            position_group:
              positionGroup,

            goals:
              toNumber(
                boxscorePlayer
                  ?.goals
              ),

            assists:
              toNumber(
                boxscorePlayer
                  ?.assists
              ),

            points:
              toNumber(
                boxscorePlayer
                  ?.points
              ),

            plus_minus:
              toNumber(
                boxscorePlayer
                  ?.plusMinus
              ),

            penalty_minutes:
              toNumber(
                boxscorePlayer
                  ?.pim
              ),

            power_play_goals:
              authoritativePowerPlayGoals,

            power_play_assists:
              derived.powerPlayAssists,

            power_play_points:
              authoritativePowerPlayGoals +
              derived.powerPlayAssists,

            short_handed_goals:
              derived.shortHandedGoals,

            short_handed_assists:
              derived.shortHandedAssists,

            short_handed_points:
              derived.shortHandedPoints,

            game_winning_goals:
              derived.gameWinningGoals,

            shots_on_goal:
              toNumber(
                boxscorePlayer
                  ?.sog
              ),

            hits:
              toNumber(
                boxscorePlayer
                  ?.hits
              ),

            blocked_shots:
              toNumber(
                boxscorePlayer
                  ?.blockedShots
              ),

            takeaways:
              toNumber(
                boxscorePlayer
                  ?.takeaways
              ),

            giveaways:
              toNumber(
                boxscorePlayer
                  ?.giveaways
              ),

            faceoff_wins:
              derived.faceoffWins,

            faceoff_losses:
              derived.faceoffLosses,

            shifts:
              toNumber(
                boxscorePlayer
                  ?.shifts
              ),

            time_on_ice_seconds:
              !isGoalie
                ? parseTimeToSeconds(
                    boxscorePlayer
                      ?.toi
                  )
                : 0,

            goalie_started:
              isGoalie
                ? boxscorePlayer
                    ?.starter === true
                : false,

            goalie_decision:
              goalieDecision,

            saves:
              isGoalie
                ? toNumber(
                    boxscorePlayer
                      ?.saves
                  )
                : 0,

            shots_against:
              isGoalie
                ? toNumber(
                    boxscorePlayer
                      ?.shotsAgainst
                  )
                : 0,

            goals_against:
              goalsAgainst,

            save_percentage:
              isGoalie &&
              boxscorePlayer
                ?.savePctg !==
                null &&
              boxscorePlayer
                ?.savePctg !==
                undefined
                ? toNumber(
                    boxscorePlayer
                      ?.savePctg
                  )
                : null,

            goalie_minutes_seconds:
              goalieMinutes,

            goalie_win:
              goalieDecision ===
              "W"
                ? 1
                : 0,

            goalie_loss:
              goalieDecision ===
              "L"
                ? 1
                : 0,

            goalie_overtime_loss:
              goalieDecision ===
              "OTL"
                ? 1
                : 0,

            shutout,

            is_final: final,

            raw_stats: {
              source:
                "official_nhl_gamecenter",

              provider: "NHL",

              officialNhlGameId,

              officialNhlPlayerId:
  officialPlayerId,

              officialNhlTeamId:
                isAway
                  ? awayOfficialTeamId
                  : homeOfficialTeamId,

              boxscore:
                boxscorePlayer,

              derived: {
                faceoffWins:
                  derived.faceoffWins,

                faceoffLosses:
                  derived.faceoffLosses,

                powerPlayGoalsFromEvents:
                  derived.powerPlayGoals,

                authoritativePowerPlayGoals,

                powerPlayAssists:
                  derived.powerPlayAssists,

                powerPlayPoints:
                  authoritativePowerPlayGoals +
                  derived.powerPlayAssists,

                shortHandedGoals:
                  derived.shortHandedGoals,

                shortHandedAssists:
                  derived.shortHandedAssists,

                shortHandedPoints:
                  derived.shortHandedPoints,

                gameWinningGoals:
                  derived.gameWinningGoals,
              },
            },

            updated_at:
              new Date().toISOString(),
          };
        }
      );

    const awaySummary =
      buildTeamSummary(
        rightRail,
        "away"
      );

    const homeSummary =
      buildTeamSummary(
        rightRail,
        "home"
      );

    const sumGoalieSaves = (
      players: JsonRecord[]
    ) =>
      players.reduce(
        (
          total,
          player
        ) =>
          player?.position ===
          "G"
            ? total +
              toNumber(
                player?.saves
              )
            : total,
        0
      );

    const teamStatRows = [
      {
        nhl_game_id:
          internalGame.id,

        team_id:
          awayTeam.id,

        opponent_team_id:
          homeTeam.id,

        season:
          internalGame.season,

        season_type:
          internalGame.season_type,

        is_home: false,

        goals:
          finalAwayScore,

        shots_on_goal:
          awaySummary.shotsOnGoal,

        power_play_goals:
          awaySummary.powerPlayGoals,

        power_play_opportunities:
          awaySummary.powerPlayOpportunities,

        penalty_minutes:
          awaySummary.penaltyMinutes,

        hits:
          awaySummary.hits,

        blocked_shots:
          awaySummary.blockedShots,

        faceoff_wins:
          awaySummary.faceoffWins,

        takeaways:
          awaySummary.takeaways,

        giveaways:
          awaySummary.giveaways,

        goalie_saves:
          sumGoalieSaves(
            awayBoxscorePlayers
          ),

        is_final: final,

        raw_stats: {
          source:
            "official_nhl_gamecenter",

          provider: "NHL",

          officialNhlGameId,

          officialNhlTeamId:
            awayOfficialTeamId,

          side: "away",

          rightRailTeamGameStats:
            rightRail
              ?.teamGameStats ??
            [],

          boxscoreTeam:
            boxscore?.awayTeam,
        },

        updated_at:
          new Date().toISOString(),
      },

      {
        nhl_game_id:
          internalGame.id,

        team_id:
          homeTeam.id,

        opponent_team_id:
          awayTeam.id,

        season:
          internalGame.season,

        season_type:
          internalGame.season_type,

        is_home: true,

        goals:
          finalHomeScore,

        shots_on_goal:
          homeSummary.shotsOnGoal,

        power_play_goals:
          homeSummary.powerPlayGoals,

        power_play_opportunities:
          homeSummary.powerPlayOpportunities,

        penalty_minutes:
          homeSummary.penaltyMinutes,

        hits:
          homeSummary.hits,

        blocked_shots:
          homeSummary.blockedShots,

        faceoff_wins:
          homeSummary.faceoffWins,

        takeaways:
          homeSummary.takeaways,

        giveaways:
          homeSummary.giveaways,

        goalie_saves:
          sumGoalieSaves(
            homeBoxscorePlayers
          ),

        is_final: final,

        raw_stats: {
          source:
            "official_nhl_gamecenter",

          provider: "NHL",

          officialNhlGameId,

          officialNhlTeamId:
            homeOfficialTeamId,

          side: "home",

          rightRailTeamGameStats:
            rightRail
              ?.teamGameStats ??
            [],

          boxscoreTeam:
            boxscore?.homeTeam,
        },

        updated_at:
          new Date().toISOString(),
      },
    ];

    /*
     * Write players first.
     */
    const {
      error:
        playerUpsertError,
    } = await supabase
      .from(
        "nhl_player_game_stats"
      )
      .upsert(
        playerStatRows,
        {
          onConflict:
            "nhl_game_id,nhl_player_id",
        }
      );

    if (
      playerUpsertError
    ) {
      return errorResponse(
        "Unable to upsert NHL player game stats.",
        500,
        playerUpsertError
      );
    }

    /*
     * Then authoritative
     * team totals.
     */
    const {
      error: teamUpsertError,
    } = await supabase
      .from(
        "nhl_team_game_stats"
      )
      .upsert(
        teamStatRows,
        {
          onConflict:
            "nhl_game_id,team_id",
        }
      );

    if (
      teamUpsertError
    ) {
      return errorResponse(
        "Unable to upsert NHL team game stats.",
        500,
        teamUpsertError
      );
    }

    /*
     * Keep the schedule/game row
     * synchronized with the
     * official NHL boxscore.
     */
    const gameState =
      typeof boxscore?.gameState ===
      "string"
        ? boxscore.gameState
        : null;

    const period =
      toNumber(
        boxscore
          ?.periodDescriptor
          ?.number,
        0
      );

    const displayClock =
      typeof boxscore?.clock
        ?.timeRemaining ===
      "string"
        ? boxscore.clock
            .timeRemaining
        : null;

    const lastPeriodType =
      typeof boxscore
        ?.gameOutcome
        ?.lastPeriodType ===
      "string"
        ? boxscore
            .gameOutcome
            .lastPeriodType
        : null;

    const isOvertime =
      lastPeriodType ===
        "OT" ||
      lastPeriodType ===
        "SO";

    const isShootout =
      lastPeriodType ===
      "SO";

    const {
      error: gameUpdateError,
    } = await supabase
      .from("nhl_games")
      .update({
        away_score:
          finalAwayScore,

        home_score:
          finalHomeScore,

        status_type:
          gameState,

        status_name:
          final
            ? "STATUS_FINAL"
            : gameState,

        status_detail:
          final
            ? "Final"
            : gameState,

        period,

        display_clock:
          displayClock,

        status_completed:
          final,

        is_overtime:
          isOvertime,

        is_shootout:
          isShootout,

        provider_data: {
          source:
            "official_nhl_gamecenter",

          provider: "NHL",

          officialNhlGameId,

          gameState,

          lastPeriodType,

          startTimeUTC:
            boxscore
              ?.startTimeUTC ??
            null,

          awayOfficialTeamId,

          homeOfficialTeamId,
        },

        updated_at:
          new Date().toISOString(),
      })
      .eq(
        "id",
        internalGame.id
      );

    if (
      gameUpdateError
    ) {
      return errorResponse(
        "Stats were written, but the NHL game row could not be updated.",
        500,
        gameUpdateError
      );
    }

    return NextResponse.json({
      success: true,

      source: "NHL",

      provider:
        "official_nhl_gamecenter",

      officialNhlGameId,

      internalNhlGameId:
        internalGame.id,

      season:
        internalGame.season,

      seasonType:
        internalGame.season_type,

      gameState,

      final,

      awayTeam: {
        internalTeamId:
          awayTeam.id,

        officialNhlTeamId:
          awayOfficialTeamId,

        abbreviation:
          awayTeam.abbreviation,

        score:
          finalAwayScore,

        shotsOnGoal:
          awaySummary.shotsOnGoal,

        powerPlay:
          `${awaySummary.powerPlayGoals}/${awaySummary.powerPlayOpportunities}`,
      },

      homeTeam: {
        internalTeamId:
          homeTeam.id,

        officialNhlTeamId:
          homeOfficialTeamId,

        abbreviation:
          homeTeam.abbreviation,

        score:
          finalHomeScore,

        shotsOnGoal:
          homeSummary.shotsOnGoal,

        powerPlay:
          `${homeSummary.powerPlayGoals}/${homeSummary.powerPlayOpportunities}`,
      },

      playerRowsReceived:
        allBoxscorePlayers.length,

      playerRowsUpserted:
        playerStatRows.length,

      teamRowsUpserted:
        teamStatRows.length,

      missingPlayers: 0,

      derived: {
        playersWithDerivedStats:
          derivedPlayerStats.size,

        faceoffEventsProcessed:
          [
            ...derivedPlayerStats.values(),
          ].reduce(
            (
              total,
              player
            ) =>
              total +
              player.faceoffWins,
            0
          ),

        powerPlayGoalsDerived:
          [
            ...derivedPlayerStats.values(),
          ].reduce(
            (
              total,
              player
            ) =>
              total +
              player.powerPlayGoals,
            0
          ),

        powerPlayAssistsDerived:
          [
            ...derivedPlayerStats.values(),
          ].reduce(
            (
              total,
              player
            ) =>
              total +
              player.powerPlayAssists,
            0
          ),

        shortHandedGoalsDerived:
          [
            ...derivedPlayerStats.values(),
          ].reduce(
            (
              total,
              player
            ) =>
              total +
              player.shortHandedGoals,
            0
          ),

        shortHandedAssistsDerived:
          [
            ...derivedPlayerStats.values(),
          ].reduce(
            (
              total,
              player
            ) =>
              total +
              player.shortHandedAssists,
            0
          ),

        gameWinningGoalsDerived:
          [
            ...derivedPlayerStats.values(),
          ].reduce(
            (
              total,
              player
            ) =>
              total +
              player.gameWinningGoals,
            0
          ),
      },
    });
  } catch (error) {
    console.error(
      "NHL game stats sync failed:",
      error
    );

    return errorResponse(
      error instanceof Error
        ? error.message
        : "Unknown NHL game stats sync error.",
      500
    );
  }
}