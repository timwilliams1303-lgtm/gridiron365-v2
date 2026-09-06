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
};

type NhlTeamRow = {
  id: number;
  abbreviation: string;
  nhl_team_id: string | null;
};

type NhlGameRow = {
  id: number;
  espn_event_id: string | null;
  nhl_game_id: string | null;
  season: number;

  season_type:
    | "regular"
    | "postseason";

  /*
   * Existing DB column name.
   *
   * For NHL this represents game start time.
   */
  start_time: string;

  away_team_id: number | null;
  home_team_id: number | null;
};

type OfficialNhlTeam = {
  id?: number;
  abbrev?: string;
};

type OfficialNhlGame = {
  id?: number;
  season?: number;
  gameType?: number;
  gameDate?: string;
  startTimeUTC?: string;

  awayTeam?: OfficialNhlTeam;
  homeTeam?: OfficialNhlTeam;
};

type OfficialClubScheduleResponse = {
  games?: OfficialNhlGame[];
};

type NormalizedOfficialGame = {
  nhlGameId: string;

  seasonType:
    | "regular"
    | "postseason";

  gameDate:
    string | null;

  startTimeUtc: string;
  startTimeMs: number;

  awayNhlTeamId: string;
  homeNhlTeamId: string;

  awayInternalTeamId: number;
  homeInternalTeamId: number;
};

type MatchMethod =
  | "exact"
  | "unique_team_pair";

type MatchResult = {
  internalGameId: number;
  espnEventId: string | null;
  officialNhlGameId: string;
  matchMethod: MatchMethod;

  databaseStartTime: string;
  officialStartTime: string;

  databaseGameDate: string | null;
  officialGameDate: string | null;
};

const NHL_API_BASE =
  "https://api-web.nhle.com/v1";

const UPDATE_CONCURRENCY =
  25;

const DB_PAGE_SIZE =
  1000;

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

function getDefaultSeason() {
  const now =
    new Date();

  /*
   * G365 NHL convention:
   *
   * 2026-27 => season = 2026
   */
  return now.getUTCMonth() >=
    6
    ? now.getUTCFullYear()
    : now.getUTCFullYear() -
        1;
}

function getOfficialSeasonKey(
  season: number
) {
  return `${season}${season + 1}`;
}

function getOfficialSeasonType(
  gameType:
    number |
    undefined
):
  | "regular"
  | "postseason"
  | null {
  /*
   * Official NHL:
   *
   * 1 = preseason
   * 2 = regular season
   * 3 = postseason
   */
  if (
    gameType ===
    2
  ) {
    return "regular";
  }

  if (
    gameType ===
    3
  ) {
    return "postseason";
  }

  return null;
}

async function fetchClubSchedule(
  abbreviation: string,
  officialSeasonKey: string
) {
  const url =
    `${NHL_API_BASE}/club-schedule-season/${encodeURIComponent(
      abbreviation
    )}/${officialSeasonKey}`;

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
      `Official NHL schedule returned HTTP ${response.status} for ${abbreviation}: ${text.slice(
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
        ) as OfficialClubScheduleResponse,
    };
  } catch {
    throw new Error(
      `Official NHL schedule returned invalid JSON for ${abbreviation}.`
    );
  }
}

function officialApiAbbreviation(
  internalAbbreviation: string
) {
  const mappings:
    Record<
      string,
      string
    > = {
      LA:
        "LAK",

      NJ:
        "NJD",

      SJ:
        "SJS",

      TB:
        "TBL",

      UTAH:
        "UTA",
    };

  return (
    mappings[
      internalAbbreviation
    ] ??
    internalAbbreviation
  );
}

function makeExactMatchKey(
  startTimeMs: number,
  awayInternalTeamId: number,
  homeInternalTeamId: number,
  seasonType:
    | "regular"
    | "postseason"
) {
  return [
    seasonType,
    startTimeMs,
    awayInternalTeamId,
    homeInternalTeamId,
  ].join("|");
}

function makeTeamPairMatchKey(
  awayInternalTeamId: number,
  homeInternalTeamId: number,
  seasonType:
    | "regular"
    | "postseason"
) {
  return [
    seasonType,
    awayInternalTeamId,
    homeInternalTeamId,
  ].join("|");
}

function datePart(
  value: string
) {
  const parsed =
    new Date(
      value
    );

  if (
    Number.isNaN(
      parsed.getTime()
    )
  ) {
    return null;
  }

  return parsed
    .toISOString()
    .slice(
      0,
      10
    );
}

async function runWithConcurrency<T>(
  values: T[],
  concurrency: number,
  worker: (
    value: T
  ) => Promise<void>
) {
  let index =
    0;

  async function runWorker() {
    while (
      index <
      values.length
    ) {
      const currentIndex =
        index;

      index +=
        1;

      await worker(
        values[
          currentIndex
        ]
      );
    }
  }

  const workers =
    Array.from(
      {
        length:
          Math.min(
            concurrency,
            values.length
          ),
      },
      () =>
        runWorker()
    );

  await Promise.all(
    workers
  );
}

export async function POST(
  request: Request
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
          "NHL",

        sport:
          "NHL",

        error:
          "Unauthorized NHL official game ID backfill request.",
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

    const officialSeasonKey =
      getOfficialSeasonKey(
        season
      );

    const supabase =
      createSupabaseAdmin();

    /*
     * =====================================================
     * LOAD NHL TEAMS
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
          "id,abbreviation,nhl_team_id"
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
        "No active NHL teams were found."
      );
    }

    const missingOfficialTeamIds =
      teams.filter(
        (
          team
        ) =>
          !team.nhl_team_id
      );

    if (
      missingOfficialTeamIds.length >
      0
    ) {
      throw new Error(
        `Cannot backfill NHL game IDs because ${missingOfficialTeamIds.length} active teams are missing nhl_team_id.`
      );
    }

    const internalTeamByOfficialId =
      new Map<
        string,
        NhlTeamRow
      >();

    for (
      const team of
        teams
    ) {
      internalTeamByOfficialId.set(
        String(
          team.nhl_team_id
        ),
        team
      );
    }

    /*
     * =====================================================
     * FETCH ALL OFFICIAL NHL CLUB SCHEDULES
     * =====================================================
     */

    const allOfficialGames:
      OfficialNhlGame[] = [];

    const requestUrls:
      string[] = [];

    const teamFetchFailures:
      Array<{
        abbreviation: string;
        error: string;
      }> = [];

    await runWithConcurrency(
      teams,
      8,
      async (
        team
      ) => {
        try {
          const apiAbbreviation =
            officialApiAbbreviation(
              team.abbreviation
            );

          const {
            url,
            payload,
          } =
            await fetchClubSchedule(
              apiAbbreviation,
              officialSeasonKey
            );

          requestUrls.push(
            url
          );

          allOfficialGames.push(
            ...(
              payload.games ??
              []
            )
          );
        } catch (
          error
        ) {
          teamFetchFailures.push({
            abbreviation:
              team.abbreviation,

            error:
              error instanceof
                Error
                ? error.message
                : "Unknown official NHL schedule error.",
          });
        }
      }
    );

    if (
      teamFetchFailures.length >
      0
    ) {
      return NextResponse.json(
        {
          success:
            false,

          source:
            "NHL",

          sport:
            "NHL",

          season,

          officialSeasonKey,

          error:
            "One or more NHL club schedules failed to load. No database updates were attempted.",

          teamFetchFailures,
        },
        {
          status:
            502,
        }
      );
    }

    /*
     * =====================================================
     * DE-DUPLICATE OFFICIAL GAMES BY NHL GAME ID
     * =====================================================
     */

    const officialGameById =
      new Map<
        string,
        OfficialNhlGame
      >();

    for (
      const game of
        allOfficialGames
    ) {
      if (
        !game.id
      ) {
        continue;
      }

      officialGameById.set(
        String(
          game.id
        ),
        game
      );
    }

    const uniqueOfficialGames =
      Array.from(
        officialGameById.values()
      );

    /*
     * =====================================================
     * NORMALIZE OFFICIAL REGULAR / POSTSEASON GAMES
     * =====================================================
     */

    const normalizedOfficialGames:
      NormalizedOfficialGame[] =
        [];

    const officialGamesSkipped:
      Array<{
        nhlGameId:
          string | null;

        reason:
          string;
      }> = [];

    for (
      const game of
        uniqueOfficialGames
    ) {
      const nhlGameId =
        game.id
          ? String(
              game.id
            )
          : null;

      if (
        !nhlGameId
      ) {
        officialGamesSkipped.push({
          nhlGameId:
            null,

          reason:
            "Missing official NHL game ID.",
        });

        continue;
      }

      const seasonType =
        getOfficialSeasonType(
          game.gameType
        );

      if (!seasonType) {
        continue;
      }

      const startTimeRaw =
        game.startTimeUTC;

      if (
        !startTimeRaw
      ) {
        officialGamesSkipped.push({
          nhlGameId,

          reason:
            "Missing official NHL start time.",
        });

        continue;
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
        officialGamesSkipped.push({
          nhlGameId,

          reason:
            "Invalid official NHL start time.",
        });

        continue;
      }

      const awayOfficialTeamId =
        game.awayTeam?.id;

      const homeOfficialTeamId =
        game.homeTeam?.id;

      if (
        !awayOfficialTeamId ||
        !homeOfficialTeamId
      ) {
        officialGamesSkipped.push({
          nhlGameId,

          reason:
            "Missing official NHL team ID.",
        });

        continue;
      }

      const awayInternalTeam =
        internalTeamByOfficialId.get(
          String(
            awayOfficialTeamId
          )
        );

      const homeInternalTeam =
        internalTeamByOfficialId.get(
          String(
            homeOfficialTeamId
          )
        );

      if (
        !awayInternalTeam ||
        !homeInternalTeam
      ) {
        officialGamesSkipped.push({
          nhlGameId,

          reason:
            "Official NHL team could not be mapped to G365 nhl_teams.",
        });

        continue;
      }

      normalizedOfficialGames.push({
        nhlGameId,

        seasonType,

        gameDate:
          game.gameDate ??
          null,

        startTimeUtc:
          startTime.toISOString(),

        startTimeMs:
          startTime.getTime(),

        awayNhlTeamId:
          String(
            awayOfficialTeamId
          ),

        homeNhlTeamId:
          String(
            homeOfficialTeamId
          ),

        awayInternalTeamId:
          awayInternalTeam.id,

        homeInternalTeamId:
          homeInternalTeam.id,
      });
    }

    /*
     * =====================================================
     * BUILD OFFICIAL MATCH INDEXES
     * =====================================================
     */

    const officialByExactMatchKey =
      new Map<
        string,
        NormalizedOfficialGame[]
      >();

    const officialByTeamPairKey =
      new Map<
        string,
        NormalizedOfficialGame[]
      >();

    for (
      const game of
        normalizedOfficialGames
    ) {
      const exactKey =
        makeExactMatchKey(
          game.startTimeMs,
          game.awayInternalTeamId,
          game.homeInternalTeamId,
          game.seasonType
        );

      const exactExisting =
        officialByExactMatchKey.get(
          exactKey
        ) ??
        [];

      exactExisting.push(
        game
      );

      officialByExactMatchKey.set(
        exactKey,
        exactExisting
      );

      const teamPairKey =
        makeTeamPairMatchKey(
          game.awayInternalTeamId,
          game.homeInternalTeamId,
          game.seasonType
        );

      const pairExisting =
        officialByTeamPairKey.get(
          teamPairKey
        ) ??
        [];

      pairExisting.push(
        game
      );

      officialByTeamPairKey.set(
        teamPairKey,
        pairExisting
      );
    }

    const duplicateOfficialExactKeys =
      Array.from(
        officialByExactMatchKey.entries()
      ).filter(
        (
          [
            ,
            games,
          ]
        ) =>
          games.length >
          1
      );

    if (
      duplicateOfficialExactKeys.length >
      0
    ) {
      return NextResponse.json(
        {
          success:
            false,

          source:
            "NHL",

          sport:
            "NHL",

          season,

          officialSeasonKey,

          error:
            "Official NHL schedule contains duplicate exact match keys. No database updates were attempted.",

          duplicateOfficialMatchKeys:
            duplicateOfficialExactKeys.length,
        },
        {
          status:
            409,
        }
      );
    }

    /*
     * =====================================================
     * LOAD ALL G365 NHL GAMES
     * =====================================================
     */

    const dbGames:
      NhlGameRow[] = [];

    let dbPage =
      0;

    while (true) {
      const from =
        dbPage *
        DB_PAGE_SIZE;

      const to =
        from +
        DB_PAGE_SIZE -
        1;

      const {
        data:
          dbGamePage,
        error:
          dbGameError,
      } =
        await supabase
          .from(
            "nhl_games"
          )
          .select(
            "id,espn_event_id,nhl_game_id,season,season_type,start_time,away_team_id,home_team_id"
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
          )
          .order(
            "id",
            {
              ascending:
                true,
            }
          )
          .range(
            from,
            to
          );

      if (
        dbGameError
      ) {
        throw new Error(
          `Could not load G365 NHL games: ${dbGameError.message}`
        );
      }

      const pageRows =
        (
          dbGamePage ??
          []
        ) as NhlGameRow[];

      dbGames.push(
        ...pageRows
      );

      if (
        pageRows.length <
        DB_PAGE_SIZE
      ) {
        break;
      }

      dbPage +=
        1;
    }

    /*
     * =====================================================
     * MATCH DATABASE GAMES TO OFFICIAL NHL GAMES
     * =====================================================
     */

    const matches:
      MatchResult[] =
        [];

    const unmatched:
      Array<{
        internalGameId:
          number;

        espnEventId:
          string | null;

        startTime:
          string;

        awayTeamId:
          number | null;

        homeTeamId:
          number | null;

        reason:
          string;
      }> = [];

    const ambiguous:
      Array<{
        internalGameId:
          number;

        matchStage:
          "exact"
          | "unique_team_pair";

        candidates:
          Array<{
            nhlGameId:
              string;

            gameDate:
              string | null;

            startTime:
              string;
          }>;
      }> = [];

    const conflicts:
      Array<{
        internalGameId:
          number;

        existingNhlGameId:
          string;

        matchedNhlGameId:
          string;
      }> = [];

    let exactMatches =
      0;

    let uniqueTeamPairMatches =
      0;

    for (
      const dbGame of
        dbGames
    ) {
      if (
        dbGame.away_team_id ===
          null ||
        dbGame.home_team_id ===
          null
      ) {
        unmatched.push({
          internalGameId:
            dbGame.id,

          espnEventId:
            dbGame.espn_event_id,

          startTime:
            dbGame.start_time,

          awayTeamId:
            dbGame.away_team_id,

          homeTeamId:
            dbGame.home_team_id,

          reason:
            "Database game is missing away or home team.",
        });

        continue;
      }

      const databaseStartTime =
        new Date(
          dbGame.start_time
        );

      if (
        Number.isNaN(
          databaseStartTime.getTime()
        )
      ) {
        unmatched.push({
          internalGameId:
            dbGame.id,

          espnEventId:
            dbGame.espn_event_id,

          startTime:
            dbGame.start_time,

          awayTeamId:
            dbGame.away_team_id,

          homeTeamId:
            dbGame.home_team_id,

          reason:
            "Database game has an invalid start time.",
        });

        continue;
      }

      /*
       * -----------------------------------------------------
       * STAGE 1:
       * EXACT START TIME + AWAY + HOME + SEASON TYPE
       * -----------------------------------------------------
       */

      const exactKey =
        makeExactMatchKey(
          databaseStartTime.getTime(),
          dbGame.away_team_id,
          dbGame.home_team_id,
          dbGame.season_type
        );

      const exactCandidates =
        officialByExactMatchKey.get(
          exactKey
        ) ??
        [];

      let matched:
        NormalizedOfficialGame |
        null = null;

      let matchMethod:
        MatchMethod |
        null = null;

      if (
        exactCandidates.length ===
        1
      ) {
        matched =
          exactCandidates[
            0
          ];

        matchMethod =
          "exact";

        exactMatches +=
          1;
      } else if (
        exactCandidates.length >
        1
      ) {
        ambiguous.push({
          internalGameId:
            dbGame.id,

          matchStage:
            "exact",

          candidates:
            exactCandidates.map(
              (
                candidate
              ) => ({
                nhlGameId:
                  candidate.nhlGameId,

                gameDate:
                  candidate.gameDate,

                startTime:
                  candidate.startTimeUtc,
              })
            ),
        });

        continue;
      }

      /*
       * -----------------------------------------------------
       * STAGE 2:
       * UNIQUE DIRECTED TEAM PAIR FALLBACK
       * -----------------------------------------------------
       */

      if (
        !matched
      ) {
        const teamPairKey =
          makeTeamPairMatchKey(
            dbGame.away_team_id,
            dbGame.home_team_id,
            dbGame.season_type
          );

        const teamPairCandidates =
          officialByTeamPairKey.get(
            teamPairKey
          ) ??
          [];

        if (
          teamPairCandidates.length ===
          1
        ) {
          matched =
            teamPairCandidates[
              0
            ];

          matchMethod =
            "unique_team_pair";

          uniqueTeamPairMatches +=
            1;
        } else if (
          teamPairCandidates.length >
          1
        ) {
          ambiguous.push({
            internalGameId:
              dbGame.id,

            matchStage:
              "unique_team_pair",

            candidates:
              teamPairCandidates.map(
                (
                  candidate
                ) => ({
                  nhlGameId:
                    candidate.nhlGameId,

                  gameDate:
                    candidate.gameDate,

                  startTime:
                    candidate.startTimeUtc,
                })
              ),
          });

          continue;
        }
      }

      if (
        !matched ||
        !matchMethod
      ) {
        unmatched.push({
          internalGameId:
            dbGame.id,

          espnEventId:
            dbGame.espn_event_id,

          startTime:
            dbGame.start_time,

          awayTeamId:
            dbGame.away_team_id,

          homeTeamId:
            dbGame.home_team_id,

          reason:
            "No exact official NHL match and no unique directed team-pair fallback match.",
        });

        continue;
      }

      if (
        dbGame.nhl_game_id &&
        dbGame.nhl_game_id !==
          matched.nhlGameId
      ) {
        conflicts.push({
          internalGameId:
            dbGame.id,

          existingNhlGameId:
            dbGame.nhl_game_id,

          matchedNhlGameId:
            matched.nhlGameId,
        });

        continue;
      }

      matches.push({
        internalGameId:
          dbGame.id,

        espnEventId:
          dbGame.espn_event_id,

        officialNhlGameId:
          matched.nhlGameId,

        matchMethod,

        databaseStartTime:
          databaseStartTime.toISOString(),

        officialStartTime:
          matched.startTimeUtc,

        databaseGameDate:
          datePart(
            dbGame.start_time
          ),

        officialGameDate:
          matched.gameDate,
      });
    }

    /*
     * =====================================================
     * VERIFY OFFICIAL NHL GAME IDS ARE NOT REUSED
     * =====================================================
     */

    const matchesByOfficialId =
      new Map<
        string,
        MatchResult[]
      >();

    for (
      const match of
        matches
    ) {
      const existing =
        matchesByOfficialId.get(
          match.officialNhlGameId
        ) ??
        [];

      existing.push(
        match
      );

      matchesByOfficialId.set(
        match.officialNhlGameId,
        existing
      );
    }

    const duplicateOfficialAssignments =
      Array.from(
        matchesByOfficialId.entries()
      ).filter(
        (
          [
            ,
            assignedMatches,
          ]
        ) =>
          assignedMatches.length >
          1
      );

    if (
      duplicateOfficialAssignments.length >
      0
    ) {
      return NextResponse.json(
        {
          success:
            false,

          source:
            "NHL",

          sport:
            "NHL",

          season,

          officialSeasonKey,

          error:
            "Multiple G365 games would map to the same official NHL game ID. No database updates were attempted.",

          duplicateOfficialAssignments:
            duplicateOfficialAssignments
              .slice(
                0,
                25
              )
              .map(
                (
                  [
                    nhlGameId,
                    assignedMatches,
                  ]
                ) => ({
                  nhlGameId,

                  internalGameIds:
                    assignedMatches.map(
                      (
                        match
                      ) =>
                        match.internalGameId
                    ),
                })
              ),
        },
        {
          status:
            409,
        }
      );
    }

    /*
     * =====================================================
     * FIND OFFICIAL NHL GAMES NOT REPRESENTED IN G365
     * =====================================================
     *
     * This catches cases where the official NHL schedule
     * contains a legitimate game that does not exist at all
     * in the ESPN-derived nhl_games table.
     */

    const usedOfficialNhlGameIds =
      new Set(
        matches.map(
          (
            match
          ) =>
            match.officialNhlGameId
        )
      );

    const unusedOfficialGames =
      normalizedOfficialGames.filter(
        (
          officialGame
        ) =>
          !usedOfficialNhlGameIds.has(
            officialGame.nhlGameId
          )
      );

    /*
     * =====================================================
     * SAFETY CHECK
     * =====================================================
     *
     * Do not write unless:
     *
     * - every DB game maps safely
     * - no ambiguity exists
     * - no existing ID conflicts exist
     * - every official NHL game is represented in G365
     */

    if (
      unmatched.length >
        0 ||
      ambiguous.length >
        0 ||
      conflicts.length >
        0 ||
      unusedOfficialGames.length >
        0
    ) {
      return NextResponse.json(
        {
          success:
            false,

          source:
            "NHL",

          sport:
            "NHL",

          season,

          officialSeasonKey,

          error:
            "Official NHL game matching was not one-to-one or the G365 schedule is incomplete. No database updates were attempted.",

          officialClubScheduleRows:
            allOfficialGames.length,

          uniqueOfficialGames:
            uniqueOfficialGames.length,

          normalizedOfficialGames:
            normalizedOfficialGames.length,

          databaseGames:
            dbGames.length,

          databasePagesLoaded:
            dbPage +
            1,

          matched:
            matches.length,

          exactMatches,

          uniqueTeamPairMatches,

          unmatched:
            unmatched.length,

          ambiguous:
            ambiguous.length,

          conflicts:
            conflicts.length,

          officialGamesNotRepresentedInDatabase:
            unusedOfficialGames.length,

          officialGamesSkipped:
            officialGamesSkipped.length,

          unmatchedGames:
            unmatched.slice(
              0,
              25
            ),

          ambiguousGames:
            ambiguous.slice(
              0,
              25
            ),

          conflictingGames:
            conflicts.slice(
              0,
              25
            ),

          unusedOfficialGames:
            unusedOfficialGames
              .slice(
                0,
                25
              )
              .map(
                (
                  game
                ) => ({
                  nhlGameId:
                    game.nhlGameId,

                  seasonType:
                    game.seasonType,

                  gameDate:
                    game.gameDate,

                  startTime:
                    game.startTimeUtc,

                  awayNhlTeamId:
                    game.awayNhlTeamId,

                  homeNhlTeamId:
                    game.homeNhlTeamId,

                  awayInternalTeamId:
                    game.awayInternalTeamId,

                  homeInternalTeamId:
                    game.homeInternalTeamId,
                })
              ),

          fallbackMatches:
            matches
              .filter(
                (
                  match
                ) =>
                  match.matchMethod ===
                  "unique_team_pair"
              )
              .slice(
                0,
                25
              ),
        },
        {
          status:
            409,
        }
      );
    }

    /*
     * =====================================================
     * WRITE OFFICIAL NHL GAME IDS
     * =====================================================
     */

    let rowsUpdated =
      0;

    const updateFailures:
      Array<{
        internalGameId:
          number;

        officialNhlGameId:
          string;

        error:
          string;
      }> = [];

    await runWithConcurrency(
      matches,
      UPDATE_CONCURRENCY,
      async (
        match
      ) => {
        const {
          error:
            updateError,
        } =
          await supabase
            .from(
              "nhl_games"
            )
            .update({
              nhl_game_id:
                match.officialNhlGameId,

              updated_at:
                new Date()
                  .toISOString(),
            })
            .eq(
              "id",
              match.internalGameId
            );

        if (
          updateError
        ) {
          updateFailures.push({
            internalGameId:
              match.internalGameId,

            officialNhlGameId:
              match.officialNhlGameId,

            error:
              updateError.message,
          });

          return;
        }

        rowsUpdated +=
          1;
      }
    );

    if (
      updateFailures.length >
      0
    ) {
      return NextResponse.json(
        {
          success:
            false,

          source:
            "NHL",

          sport:
            "NHL",

          season,

          officialSeasonKey,

          error:
            "Some NHL game ID updates failed.",

          matched:
            matches.length,

          exactMatches,

          uniqueTeamPairMatches,

          rowsUpdated,

          updateFailures:
            updateFailures.slice(
              0,
              25
            ),
        },
        {
          status:
            500,
        }
      );
    }

    /*
     * =====================================================
     * VERIFY DATABASE COVERAGE
     * =====================================================
     */

    const {
      count:
        totalGames,
      error:
        totalError,
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
      totalError
    ) {
      throw new Error(
        `Official NHL IDs were written, but total-game verification failed: ${totalError.message}`
      );
    }

    const {
      count:
        gamesWithOfficialId,
      error:
        officialCountError,
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
        )
        .not(
          "nhl_game_id",
          "is",
          null
        );

    if (
      officialCountError
    ) {
      throw new Error(
        `Official NHL IDs were written, but ID verification failed: ${officialCountError.message}`
      );
    }

    const fallbackMatches =
      matches.filter(
        (
          match
        ) =>
          match.matchMethod ===
          "unique_team_pair"
      );

    return NextResponse.json({
      success:
        true,

      source:
        "NHL",

      sport:
        "NHL",

      season,

      officialSeasonKey,

      officialClubScheduleRows:
        allOfficialGames.length,

      uniqueOfficialGames:
        uniqueOfficialGames.length,

      normalizedOfficialGames:
        normalizedOfficialGames.length,

      databaseGames:
        dbGames.length,

      databasePagesLoaded:
        dbPage +
        1,

      matched:
        matches.length,

      exactMatches,

      uniqueTeamPairMatches,

      unmatched:
        0,

      ambiguous:
        0,

      conflicts:
        0,

      officialGamesNotRepresentedInDatabase:
        0,

      rowsUpdated,

      totalGames:
        totalGames ??
        0,

      gamesWithOfficialNhlId:
        gamesWithOfficialId ??
        0,

      gamesMissingOfficialNhlId:
        Math.max(
          0,
          (
            totalGames ??
            0
          ) -
            (
              gamesWithOfficialId ??
              0
            )
        ),

      officialGamesSkipped:
        officialGamesSkipped.length,

      requestCount:
        requestUrls.length,

      fallbackMatches,
    });
  } catch (
    error
  ) {
    console.error(
      "NHL official game ID backfill failed:",
      error
    );

    return NextResponse.json(
      {
        success:
          false,

        source:
          "NHL",

        sport:
          "NHL",

        error:
          error instanceof
            Error
            ? error.message
            : "Unknown NHL official game ID backfill error.",
      },
      {
        status:
          500,
      }
    );
  }
}
