import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BALLDONTLIE_BASE_URL =
  "https://api.balldontlie.io/nfl/v1";

type BdlTeam = {
  id: number;
  abbreviation: string | null;
  full_name?: string | null;
};

type BdlPlayer = {
  id: number;
  first_name: string | null;
  last_name: string | null;
  position: string | null;
  position_abbreviation: string | null;
  jersey_number: string | null;
  team: BdlTeam | null;
};

type BdlPlayersResponse = {
  data?: BdlPlayer[];
  meta?: {
    next_cursor?: number | null;
    per_page?: number | null;
  };
};

type ExistingPlayer = {
  id: number;
  full_name: string;
  first_name: string | null;
  last_name: string | null;
  primary_position: string;
  team_abbreviation: string | null;
  balldontlie_player_id: number | null;
};

type ExistingTeam = {
  id: number;
  abbreviation: string;
  balldontlie_team_id: number | null;
};

function createSupabaseAdmin() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
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

function normalizeName(
  value: string | null | undefined
) {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[.’']/g, "")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ");
}

function normalizePosition(
  value: string | null | undefined
) {
  const position =
    (value ?? "")
      .trim()
      .toUpperCase();

  if (position === "PK") {
    return "K";
  }

  if (
    position === "DEF" ||
    position === "D/ST" ||
    position === "DEFENSE"
  ) {
    return "DST";
  }

  return position;
}

function getFullName(
  player: BdlPlayer
) {
  return [
    player.first_name,
    player.last_name,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();
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

  const secret =
    process.env.NFL_SYNC_SECRET;

  if (!secret) {
    return false;
  }

  const authorization =
    request.headers.get(
      "authorization"
    );

  if (
    authorization ===
    `Bearer ${secret}`
  ) {
    return true;
  }

  const customHeader =
    request.headers.get(
      "x-gridiron-sync-secret"
    );

  return customHeader === secret;
}

function sleep(
  milliseconds: number
) {
  return new Promise<void>(
    (resolve) => {
      setTimeout(
        resolve,
        milliseconds
      );
    }
  );
}

async function fetchBdlPlayers(
  apiKey: string,
  cursor?: number
) {
  const url =
    new URL(
      `${BALLDONTLIE_BASE_URL}/players`
    );

  url.searchParams.set(
    "per_page",
    "100"
  );

  if (
    cursor !== undefined
  ) {
    url.searchParams.set(
      "cursor",
      String(cursor)
    );
  }

  const response =
    await fetch(
      url.toString(),
      {
        method: "GET",

        headers: {
          Authorization:
            apiKey,

          Accept:
            "application/json",
        },

        cache:
          "no-store",
      }
    );

  const text =
    await response.text();

  if (
    response.status ===
    429
  ) {
    const retryAfter =
      response.headers.get(
        "retry-after"
      );

    throw new Error(
      retryAfter
        ? `BALLDONTLIE rate limit reached. Retry after ${retryAfter} seconds.`
        : "BALLDONTLIE rate limit reached. Wait at least 60 seconds and try again."
    );
  }

  let data:
    BdlPlayersResponse | null =
      null;

  try {
    data =
      JSON.parse(text);
  } catch {
    // handled below
  }

  if (
    !response.ok ||
    !data
  ) {
    throw new Error(
      `BALLDONTLIE players request failed (${response.status}): ${text.slice(
        0,
        500
      )}`
    );
  }

  return data;
}

async function runSync(
  request: Request
) {
  if (
    !isAuthorized(request)
  ) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Unauthorized sync request.",
      },
      {
        status: 401,
      }
    );
  }

  try {
    const apiKey =
      process.env
        .BALLDONTLIE_API_KEY;

    if (!apiKey) {
      throw new Error(
        "BALLDONTLIE_API_KEY is not configured."
      );
    }

    const supabase =
      createSupabaseAdmin();

    /* =====================================================
       LOAD EXISTING NFL TEAMS
    ===================================================== */

    const {
      data: teamRows,
      error: teamError,
    } =
      await supabase
        .from("nfl_teams")
        .select(
          `
            id,
            abbreviation,
            balldontlie_team_id
          `
        );

    if (teamError) {
      throw new Error(
        `Unable to load NFL teams: ${teamError.message}`
      );
    }

    const existingTeams =
      (teamRows ??
        []) as ExistingTeam[];

    const teamsByAbbreviation =
      new Map<
        string,
        ExistingTeam
      >();

    for (
      const team
      of existingTeams
    ) {
      teamsByAbbreviation.set(
        team.abbreviation
          .trim()
          .toUpperCase(),
        team
      );
    }

    /* =====================================================
       LOAD EXISTING NFL PLAYERS
    ===================================================== */

    const {
      data: playerRows,
      error: playerError,
    } =
      await supabase
        .from("nfl_players")
        .select(
          `
            id,
            full_name,
            first_name,
            last_name,
            primary_position,
            team_abbreviation,
            balldontlie_player_id
          `
        );

    if (playerError) {
      throw new Error(
        `Unable to load NFL players: ${playerError.message}`
      );
    }

    const existingPlayers =
      (playerRows ??
        []) as ExistingPlayer[];

    /* =====================================================
       BUILD MATCH INDEXES
    ===================================================== */

    const playersByBdlId =
      new Map<
        number,
        ExistingPlayer
      >();

    const playersByNameTeam =
      new Map<
        string,
        ExistingPlayer[]
      >();

    const playersByNameOnly =
      new Map<
        string,
        ExistingPlayer[]
      >();

    for (
      const player
      of existingPlayers
    ) {
      if (
        player
          .balldontlie_player_id
          !== null
      ) {
        playersByBdlId.set(
          player
            .balldontlie_player_id,
          player
        );
      }

      const normalizedFullName =
        normalizeName(
          player.full_name
        );

      const teamAbbreviation =
        (
          player
            .team_abbreviation ??
          ""
        )
          .trim()
          .toUpperCase();

      const nameTeamKey =
        `${normalizedFullName}|${teamAbbreviation}`;

      const teamMatches =
        playersByNameTeam.get(
          nameTeamKey
        ) ?? [];

      teamMatches.push(
        player
      );

      playersByNameTeam.set(
        nameTeamKey,
        teamMatches
      );

      const nameMatches =
        playersByNameOnly.get(
          normalizedFullName
        ) ?? [];

      nameMatches.push(
        player
      );

      playersByNameOnly.set(
        normalizedFullName,
        nameMatches
      );
    }

    /* =====================================================
       COUNTERS / REPORTING
    ===================================================== */

    let pagesFetched = 0;
    let providerPlayers = 0;

    let teamsMapped = 0;
    let teamsAlreadyMapped = 0;
    let teamsNotFound = 0;

    let playersMapped = 0;
    let playersAlreadyMapped = 0;
    let playersAmbiguous = 0;
    let playersUnmatched = 0;

    const unmatchedPlayers:
      Array<{
        balldontliePlayerId:
          number;
        name: string;
        team: string | null;
        position:
          string | null;
        reason: string;
      }> = [];

    const ambiguousPlayers:
      Array<{
        balldontliePlayerId:
          number;
        name: string;
        team: string | null;
        candidateIds:
          number[];
      }> = [];

    /* =====================================================
       PAGINATE BALLDONTLIE PLAYERS
    ===================================================== */

    let cursor:
      number | undefined =
        undefined;

    const seenCursors =
      new Set<number>();

    while (true) {
      const page =
        await fetchBdlPlayers(
          apiKey,
          cursor
        );

      pagesFetched += 1;

      const providerPagePlayers =
        page.data ?? [];

      providerPlayers +=
        providerPagePlayers.length;

      for (
        const bdlPlayer
        of providerPagePlayers
      ) {
        const bdlName =
          getFullName(
            bdlPlayer
          );

        if (!bdlName) {
          playersUnmatched +=
            1;

          unmatchedPlayers.push({
            balldontliePlayerId:
              bdlPlayer.id,

            name:
              "",

            team:
              bdlPlayer.team
                ?.abbreviation ??
              null,

            position:
              bdlPlayer
                .position_abbreviation ??
              null,

            reason:
              "BALLDONTLIE player had no usable name.",
          });

          continue;
        }

        const normalizedBdlName =
          normalizeName(
            bdlName
          );

        const bdlTeamAbbreviation =
          bdlPlayer.team
            ?.abbreviation
            ?.trim()
            .toUpperCase() ??
          null;

        const bdlPosition =
          normalizePosition(
            bdlPlayer
              .position_abbreviation
          );

        /* =================================================
           TEAM MAPPING
        ================================================= */

        if (
          bdlPlayer.team &&
          bdlTeamAbbreviation
        ) {
          const existingTeam =
            teamsByAbbreviation.get(
              bdlTeamAbbreviation
            );

          if (!existingTeam) {
            teamsNotFound += 1;
          } else if (
            existingTeam
              .balldontlie_team_id ===
            bdlPlayer.team.id
          ) {
            teamsAlreadyMapped +=
              1;
          } else if (
            existingTeam
              .balldontlie_team_id ===
            null
          ) {
            const {
              error:
                updateTeamError,
            } =
              await supabase
                .from(
                  "nfl_teams"
                )
                .update({
                  balldontlie_team_id:
                    bdlPlayer
                      .team.id,

                  balldontlie_last_synced_at:
                    new Date()
                      .toISOString(),
                })
                .eq(
                  "id",
                  existingTeam.id
                );

            if (
              updateTeamError
            ) {
              throw new Error(
                `Unable to map BALLDONTLIE team ${bdlTeamAbbreviation}: ${updateTeamError.message}`
              );
            }

            existingTeam
              .balldontlie_team_id =
                bdlPlayer
                  .team.id;

            teamsMapped += 1;
          }
        }

        /* =================================================
           PLAYER ALREADY MAPPED
        ================================================= */

        const existingByBdlId =
          playersByBdlId.get(
            bdlPlayer.id
          );

        if (
          existingByBdlId
        ) {
          playersAlreadyMapped +=
            1;

          const {
            error:
              refreshMappedError,
          } =
            await supabase
              .from(
                "nfl_players"
              )
              .update({
                balldontlie_last_synced_at:
                  new Date()
                    .toISOString(),
              })
              .eq(
                "id",
                existingByBdlId.id
              );

          if (
            refreshMappedError
          ) {
            throw new Error(
              `Unable to refresh BALLDONTLIE mapping for ${bdlName}: ${refreshMappedError.message}`
            );
          }

          continue;
        }

        /* =================================================
           PRIMARY MATCH:
           NAME + TEAM
        ================================================= */

        const nameTeamKey =
          `${normalizedBdlName}|${bdlTeamAbbreviation ?? ""}`;

        let candidates =
          playersByNameTeam.get(
            nameTeamKey
          ) ?? [];

        /* =================================================
           FALLBACK:
           UNIQUE NAME ONLY
        ================================================= */

        if (
          candidates.length ===
          0
        ) {
          const nameOnlyMatches =
            playersByNameOnly.get(
              normalizedBdlName
            ) ?? [];

          if (
            nameOnlyMatches
              .length === 1
          ) {
            candidates =
              nameOnlyMatches;
          }
        }

        /* =================================================
           POSITION DISAMBIGUATION
        ================================================= */

        if (
          candidates.length >
            1 &&
          bdlPosition
        ) {
          const positionMatches =
            candidates.filter(
              (candidate) =>
                normalizePosition(
                  candidate
                    .primary_position
                ) ===
                bdlPosition
            );

          if (
            positionMatches
              .length === 1
          ) {
            candidates =
              positionMatches;
          }
        }

        /* =================================================
           UNIQUE MATCH
        ================================================= */

        if (
          candidates.length ===
          1
        ) {
          const matchedPlayer =
            candidates[0];

          const {
            error:
              updatePlayerError,
          } =
            await supabase
              .from(
                "nfl_players"
              )
              .update({
                balldontlie_player_id:
                  bdlPlayer.id,

                balldontlie_last_synced_at:
                  new Date()
                    .toISOString(),
              })
              .eq(
                "id",
                matchedPlayer.id
              );

          if (
            updatePlayerError
          ) {
            throw new Error(
              `Unable to map BALLDONTLIE player ${bdlName}: ${updatePlayerError.message}`
            );
          }

          matchedPlayer
            .balldontlie_player_id =
              bdlPlayer.id;

          playersByBdlId.set(
            bdlPlayer.id,
            matchedPlayer
          );

          playersMapped += 1;

          continue;
        }

        /* =================================================
           AMBIGUOUS
        ================================================= */

        if (
          candidates.length >
          1
        ) {
          playersAmbiguous +=
            1;

          ambiguousPlayers.push({
            balldontliePlayerId:
              bdlPlayer.id,

            name:
              bdlName,

            team:
              bdlTeamAbbreviation,

            candidateIds:
              candidates.map(
                (candidate) =>
                  candidate.id
              ),
          });

          continue;
        }

        /* =================================================
           UNMATCHED
        ================================================= */

        playersUnmatched +=
          1;

        unmatchedPlayers.push({
          balldontliePlayerId:
            bdlPlayer.id,

          name:
            bdlName,

          team:
            bdlTeamAbbreviation,

          position:
            bdlPosition ||
            null,

          reason:
            "No unique existing Gridiron365 player match.",
        });
      }

      /* ===================================================
         NEXT CURSOR
      =================================================== */

      const nextCursor =
        page.meta
          ?.next_cursor;

      if (
        nextCursor ===
          null ||
        nextCursor ===
          undefined
      ) {
        break;
      }

      if (
        seenCursors.has(
          nextCursor
        )
      ) {
        throw new Error(
          `BALLDONTLIE pagination repeated cursor ${nextCursor}.`
        );
      }

      seenCursors.add(
        nextCursor
      );

      cursor =
        nextCursor;

      /*
       * Conservative throttle.
       *
       * This is intentionally slow enough
       * for restricted/trial rate limits.
       */
      await sleep(
        13000
      );
    }

    return NextResponse.json({
      success: true,

      provider:
        "BALLDONTLIE",

      pagesFetched,

      providerPlayers,

      teams: {
        mapped:
          teamsMapped,

        alreadyMapped:
          teamsAlreadyMapped,

        notFound:
          teamsNotFound,
      },

      players: {
        mapped:
          playersMapped,

        alreadyMapped:
          playersAlreadyMapped,

        ambiguous:
          playersAmbiguous,

        unmatched:
          playersUnmatched,
      },

      ambiguousPlayers:
        ambiguousPlayers.slice(
          0,
          100
        ),

      unmatchedPlayers:
        unmatchedPlayers.slice(
          0,
          100
        ),
    });
  } catch (error) {
    console.error(
      "BALLDONTLIE player sync failed:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        provider:
          "BALLDONTLIE",

        error:
          error instanceof Error
            ? error.message
            : "Unknown BALLDONTLIE sync error.",
      },
      {
        status: 500,
      }
    );
  }
}

export async function GET(
  request: Request
) {
  return runSync(
    request
  );
}

export async function POST(
  request: Request
) {
  return runSync(
    request
  );
}