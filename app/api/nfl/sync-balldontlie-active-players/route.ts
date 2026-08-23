import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BALLDONTLIE_BASE_URL =
  "https://api.balldontlie.io/nfl/v1";

type BdlTeam = {
  id: number;
  conference?: string | null;
  division?: string | null;
  location?: string | null;
  name?: string | null;
  full_name?: string | null;
  abbreviation?: string | null;
};

type BdlActivePlayer = {
  id: number;
  first_name?: string | null;
  last_name?: string | null;
  position?: string | null;
  position_abbreviation?: string | null;
  height?: string | null;
  weight?: string | null;
  jersey_number?: string | null;
  college?: string | null;
  experience?: string | null;
  age?: number | null;
  team?: BdlTeam | null;
};

type BdlActivePlayersResponse = {
  data?: BdlActivePlayer[];
  meta?: {
    next_cursor?: number | null;
    per_page?: number | null;
  };
};

type GridironPlayer = {
  id: number;
  full_name: string;
  primary_position: string;
  team_abbreviation: string | null;
  balldontlie_player_id: number | null;
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

  const customHeader =
    request.headers.get(
      "x-gridiron-sync-secret"
    );

  if (
    customHeader === secret
  ) {
    return true;
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

  return false;
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
  player: BdlActivePlayer
) {
  return [
    player.first_name,
    player.last_name,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();
}

async function fetchActivePlayers(
  apiKey: string,
  cursor?: number
) {
  const url =
    new URL(
      `${BALLDONTLIE_BASE_URL}/players/active`
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
    response.status === 429
  ) {
    const retryAfter =
      response.headers.get(
        "retry-after"
      );

    throw new Error(
      retryAfter
        ? `BALLDONTLIE rate limit reached. Retry after ${retryAfter} seconds.`
        : "BALLDONTLIE rate limit reached. Wait before requesting the next active-player batch."
    );
  }

  let data:
    BdlActivePlayersResponse | null =
      null;

  try {
    data =
      JSON.parse(
        text
      ) as BdlActivePlayersResponse;
  } catch {
    // handled below
  }

  if (
    !response.ok ||
    !data
  ) {
    throw new Error(
      `BALLDONTLIE active-player request failed (${response.status}): ${text.slice(
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
    !isAuthorized(
      request
    )
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

    const requestUrl =
      new URL(
        request.url
      );

    /*
     * Cursor is optional.
     *
     * No cursor = first batch.
     * cursor=123 = continue from that
     * BALLDONTLIE cursor.
     */
    const cursorText =
      requestUrl.searchParams.get(
        "cursor"
      );

    let cursor:
      number | undefined =
        undefined;

    if (
      cursorText !== null
    ) {
      const parsedCursor =
        Number(
          cursorText
        );

      if (
        !Number.isFinite(
          parsedCursor
        )
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "cursor must be a valid number.",
          },
          {
            status: 400,
          }
        );
      }

      cursor =
        parsedCursor;
    }

    const supabase =
      createSupabaseAdmin();

    /*
     * Load Gridiron365 players.
     *
     * We use BALLDONTLIE ID first.
     * Name/team matching is only used
     * as a safe fallback for currently
     * unmapped fantasy players.
     */
    const {
      data: playerRows,
      error: playerError,
    } =
      await supabase
        .from(
          "nfl_players"
        )
        .select(
          `
            id,
            full_name,
            primary_position,
            team_abbreviation,
            balldontlie_player_id
          `
        );

    if (
      playerError
    ) {
      throw new Error(
        `Unable to load NFL players: ${playerError.message}`
      );
    }

    const gridironPlayers =
      (playerRows ??
        []) as GridironPlayer[];

    const playersByBdlId =
      new Map<
        number,
        GridironPlayer
      >();

    const playersByNameTeam =
      new Map<
        string,
        GridironPlayer[]
      >();

    const playersByName =
      new Map<
        string,
        GridironPlayer[]
      >();

    for (
      const player
      of gridironPlayers
    ) {
      if (
        player
          .balldontlie_player_id !==
        null
      ) {
        playersByBdlId.set(
          player
            .balldontlie_player_id,
          player
        );
      }

      const name =
        normalizeName(
          player.full_name
        );

      const team =
        (
          player
            .team_abbreviation ??
          ""
        )
          .trim()
          .toUpperCase();

      const nameTeamKey =
        `${name}|${team}`;

      const nameTeamMatches =
        playersByNameTeam.get(
          nameTeamKey
        ) ?? [];

      nameTeamMatches.push(
        player
      );

      playersByNameTeam.set(
        nameTeamKey,
        nameTeamMatches
      );

      const nameMatches =
        playersByName.get(
          name
        ) ?? [];

      nameMatches.push(
        player
      );

      playersByName.set(
        name,
        nameMatches
      );
    }

    /*
     * Fetch exactly ONE page.
     *
     * This prevents the Vercel timeout
     * that occurred when we attempted
     * to paginate the entire provider
     * database in one request.
     */
    const page =
      await fetchActivePlayers(
        apiKey,
        cursor
      );

    const providerPlayers =
      page.data ?? [];

    const syncedAt =
      new Date()
        .toISOString();

    let alreadyMapped =
      0;

    let newlyMapped =
      0;

    let updatedActive =
      0;

    let unmatched =
      0;

    let ambiguous =
      0;

    const unmatchedPlayers:
      Array<{
        balldontliePlayerId:
          number;
        name: string;
        team: string | null;
        position:
          string | null;
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

    for (
      const providerPlayer
      of providerPlayers
    ) {
      const providerId =
        providerPlayer.id;

      const providerName =
        getFullName(
          providerPlayer
        );

      const providerTeam =
        providerPlayer.team
          ?.abbreviation
          ?.trim()
          .toUpperCase() ??
        null;

      const providerPosition =
        normalizePosition(
          providerPlayer
            .position_abbreviation ??
            providerPlayer.position
        );

      /*
       * FIRST:
       * Look for an existing direct
       * BALLDONTLIE ID mapping.
       */
      let matchedPlayer =
        playersByBdlId.get(
          providerId
        );

      if (
        matchedPlayer
      ) {
        alreadyMapped +=
          1;
      }

      /*
       * SECOND:
       * For active players that aren't
       * mapped yet, try exact
       * name + team.
       */
      if (
        !matchedPlayer &&
        providerName
      ) {
        const normalizedProviderName =
          normalizeName(
            providerName
          );

        const nameTeamKey =
          `${normalizedProviderName}|${providerTeam ?? ""}`;

        let candidates =
          playersByNameTeam.get(
            nameTeamKey
          ) ?? [];

        /*
         * If name + team doesn't match,
         * allow unique-name fallback.
         *
         * We only accept this when there
         * is exactly one Gridiron player
         * with the name.
         */
        if (
          candidates.length ===
          0
        ) {
          const nameMatches =
            playersByName.get(
              normalizedProviderName
            ) ?? [];

          if (
            nameMatches.length ===
            1
          ) {
            candidates =
              nameMatches;
          }
        }

        /*
         * If multiple candidates exist,
         * use position as another safe
         * discriminator.
         */
        if (
          candidates.length >
            1 &&
          providerPosition
        ) {
          const positionMatches =
            candidates.filter(
              (
                candidate
              ) =>
                normalizePosition(
                  candidate
                    .primary_position
                ) ===
                providerPosition
            );

          if (
            positionMatches
              .length === 1
          ) {
            candidates =
              positionMatches;
          }
        }

        if (
          candidates.length ===
          1
        ) {
          matchedPlayer =
            candidates[0];

          /*
           * Don't overwrite an existing
           * different provider mapping.
           */
          if (
            matchedPlayer
              .balldontlie_player_id ===
              null
          ) {
            const {
              error:
                mappingError,
            } =
              await supabase
                .from(
                  "nfl_players"
                )
                .update({
                  balldontlie_player_id:
                    providerId,

                  balldontlie_last_synced_at:
                    syncedAt,
                })
                .eq(
                  "id",
                  matchedPlayer.id
                )
                .is(
                  "balldontlie_player_id",
                  null
                );

            if (
              mappingError
            ) {
              throw new Error(
                `Unable to map active BALLDONTLIE player ${providerName}: ${mappingError.message}`
              );
            }

            matchedPlayer
              .balldontlie_player_id =
                providerId;

            playersByBdlId.set(
              providerId,
              matchedPlayer
            );

            newlyMapped +=
              1;
          }
        } else if (
          candidates.length >
          1
        ) {
          ambiguous +=
            1;

          ambiguousPlayers.push({
            balldontliePlayerId:
              providerId,

            name:
              providerName,

            team:
              providerTeam,

            candidateIds:
              candidates.map(
                (
                  candidate
                ) =>
                  candidate.id
              ),
          });

          continue;
        }
      }

      /*
       * Still no safe Gridiron365
       * player match.
       */
      if (
        !matchedPlayer
      ) {
        unmatched +=
          1;

        unmatchedPlayers.push({
          balldontliePlayerId:
            providerId,

          name:
            providerName,

          team:
            providerTeam,

          position:
            providerPosition ||
            null,
        });

        continue;
      }

      /*
       * Mark this provider-specific
       * player as active.
       *
       * IMPORTANT:
       * We do NOT change nfl_players.is_active.
       *
       * ESPN/current Gridiron logic can
       * continue controlling the canonical
       * fantasy-player active flag.
       */
      const {
        error:
          activeUpdateError,
      } =
        await supabase
          .from(
            "nfl_players"
          )
          .update({
            balldontlie_is_active:
              true,

            balldontlie_active_last_seen_at:
              syncedAt,

            balldontlie_last_synced_at:
              syncedAt,
          })
          .eq(
            "id",
            matchedPlayer.id
          );

      if (
        activeUpdateError
      ) {
        throw new Error(
          `Unable to update active status for ${matchedPlayer.full_name}: ${activeUpdateError.message}`
        );
      }

      updatedActive +=
        1;
    }

    const nextCursor =
      page.meta
        ?.next_cursor ??
      null;

    return NextResponse.json({
      success: true,

      provider:
        "BALLDONTLIE",

      batch: {
        requestedCursor:
          cursor ?? null,

        playersReceived:
          providerPlayers.length,

        nextCursor,

        hasMore:
          nextCursor !== null,
      },

      players: {
        activeUpdated:
          updatedActive,

        alreadyMapped,

        newlyMapped,

        unmatched,

        ambiguous,
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
  } catch (
    error
  ) {
    console.error(
      "BALLDONTLIE active-player sync failed:",
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
            : "Unknown BALLDONTLIE active-player sync error.",
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