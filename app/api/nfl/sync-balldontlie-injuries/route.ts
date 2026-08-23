import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BALLDONTLIE_BASE_URL =
  "https://api.balldontlie.io/nfl/v1";

type BdlTeam = {
  id: number;
  abbreviation: string | null;
};

type BdlPlayer = {
  id: number;
  first_name: string | null;
  last_name: string | null;
  position_abbreviation: string | null;
  team: BdlTeam | null;
};

type BdlInjury = {
  player: BdlPlayer;
  status: string | null;
  comment: string | null;
  date: string | null;
};

type BdlInjuryResponse = {
  data?: BdlInjury[];

  meta?: {
    next_cursor?: number | null;
    per_page?: number | null;
  };
};

type GridironPlayer = {
  id: number;
  espn_player_id: string | null;
  balldontlie_player_id: number | null;
  full_name: string;
  primary_position: string;
  team_abbreviation: string | null;
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

  return (
    request.headers.get(
      "x-gridiron-sync-secret"
    ) === secret
  );
}

async function fetchInjuries(
  apiKey: string,
  cursor?: number
) {
  const url =
    new URL(
      `${BALLDONTLIE_BASE_URL}/player_injuries`
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
        headers: {
          Authorization: apiKey,
          Accept: "application/json",
        },

        cache: "no-store",
      }
    );

  const text =
    await response.text();

  if (
    response.status === 429
  ) {
    throw new Error(
      "BALLDONTLIE rate limit reached. Wait before requesting the next injury batch."
    );
  }

  let data:
    BdlInjuryResponse | null =
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
      `BALLDONTLIE injury request failed (${response.status}): ${text.slice(
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
  if (!isAuthorized(request)) {
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
      new URL(request.url);

    const cursorText =
      requestUrl.searchParams.get(
        "cursor"
      );

    let cursor:
      number | undefined;

    if (cursorText) {
      const value =
        Number(cursorText);

      if (!Number.isFinite(value)) {
        return NextResponse.json(
          {
            success: false,
            error:
              "cursor must be numeric.",
          },
          {
            status: 400,
          }
        );
      }

      cursor = value;
    }

    const seasonText =
      requestUrl.searchParams.get(
        "season"
      );

    const season =
      seasonText
        ? Number(seasonText)
        : new Date().getUTCFullYear();

    if (
      !Number.isInteger(season) ||
      season < 2000 ||
      season > 2200
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "A valid season is required.",
        },
        {
          status: 400,
        }
      );
    }

    const supabase =
      createSupabaseAdmin();

    const {
      data: playerRows,
      error: playerError,
    } =
      await supabase
        .from("nfl_players")
        .select(
          `
            id,
            espn_player_id,
            balldontlie_player_id,
            full_name,
            primary_position,
            team_abbreviation
          `
        )
        .not(
          "balldontlie_player_id",
          "is",
          null
        );

    if (playerError) {
      throw new Error(
        `Unable to load mapped NFL players: ${playerError.message}`
      );
    }

    const mappedPlayers =
      (playerRows ??
        []) as GridironPlayer[];

    const playersByBdlId =
      new Map<
        number,
        GridironPlayer
      >();

    for (
      const player
      of mappedPlayers
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
    }

    const page =
      await fetchInjuries(
        apiKey,
        cursor
      );

    const injuries =
      page.data ?? [];

    let matched = 0;
    let unmatched = 0;
    let inserted = 0;
    let updated = 0;

    const unmatchedInjuries:
      Array<{
        balldontliePlayerId:
          number;
        name: string;
        team: string | null;
        status: string | null;
      }> = [];

    const syncedAt =
      new Date()
        .toISOString();

    for (
      const injury
      of injuries
    ) {
      const bdlPlayer =
        injury.player;

      if (!bdlPlayer) {
        continue;
      }

      const player =
        playersByBdlId.get(
          bdlPlayer.id
        );

      const providerName =
        [
          bdlPlayer.first_name,
          bdlPlayer.last_name,
        ]
          .filter(Boolean)
          .join(" ")
          .trim();

      if (!player) {
        unmatched += 1;

        unmatchedInjuries.push({
          balldontliePlayerId:
            bdlPlayer.id,

          name:
            providerName,

          team:
            bdlPlayer.team
              ?.abbreviation ??
            null,

          status:
            injury.status,
        });

        continue;
      }

      matched += 1;

      /*
       * See whether this player already
       * has an active injury row.
       */
      const {
        data: existingRows,
        error: existingError,
      } =
        await supabase
          .from(
            "nfl_player_injuries"
          )
          .select(
            `
              id,
              status,
              injury_detail
            `
          )
          .eq(
            "nfl_player_id",
            player.id
          )
          .eq(
            "season",
            season
          )
          .eq(
            "is_active",
            true
          )
          .limit(1);

      if (existingError) {
        throw new Error(
          `Unable to inspect injury for ${player.full_name}: ${existingError.message}`
        );
      }

      const existing =
        existingRows?.[0] ??
        null;

      const injuryDate =
        injury.date
          ? new Date(
              injury.date
            )
          : null;

      /*
       * Keep existing canonical ESPN
       * metadata where it exists.
       *
       * BALLDONTLIE fills status/detail
       * when there isn't already a value,
       * while its source-specific fields
       * are always refreshed.
       */
      if (existing) {
        const {
          error: updateError,
        } =
          await supabase
            .from(
              "nfl_player_injuries"
            )
            .update({
              status:
                existing.status ??
                injury.status,

              injury_detail:
                existing
                  .injury_detail ??
                injury.comment,

              balldontlie_player_id:
                bdlPlayer.id,

              balldontlie_status:
                injury.status,

              balldontlie_comment:
                injury.comment,

              balldontlie_injury_date:
                injury.date,

              balldontlie_last_synced_at:
                syncedAt,

              last_seen_at:
                syncedAt,

              updated_at:
                syncedAt,
            })
            .eq(
              "id",
              existing.id
            );

        if (updateError) {
          throw new Error(
            `Unable to update injury for ${player.full_name}: ${updateError.message}`
          );
        }

        updated += 1;
      } else {
        const {
          error: insertError,
        } =
          await supabase
            .from(
              "nfl_player_injuries"
            )
            .insert({
              nfl_player_id:
                player.id,

              espn_player_id:
                player
                  .espn_player_id,

              season,

              status:
                injury.status ??
                "Injured",

              injury_type:
                null,

              injury_location:
                null,

              injury_detail:
                injury.comment,

              injury_date:
                injuryDate
                  ? injuryDate
                      .toISOString()
                      .slice(0, 10)
                  : null,

              return_date:
                null,

              source_updated_at:
                injury.date,

              is_active:
                true,

              first_seen_at:
                syncedAt,

              last_seen_at:
                syncedAt,

              created_at:
                syncedAt,

              updated_at:
                syncedAt,

              balldontlie_player_id:
                bdlPlayer.id,

              balldontlie_status:
                injury.status,

              balldontlie_comment:
                injury.comment,

              balldontlie_injury_date:
                injury.date,

              balldontlie_last_synced_at:
                syncedAt,
            });

        if (insertError) {
          throw new Error(
            `Unable to insert injury for ${player.full_name}: ${insertError.message}`
          );
        }

        inserted += 1;
      }
    }

    const nextCursor =
      page.meta
        ?.next_cursor ??
      null;

    return NextResponse.json({
      success: true,

      provider:
        "BALLDONTLIE",

      season,

      batch: {
        requestedCursor:
          cursor ?? null,

        injuriesReceived:
          injuries.length,

        nextCursor,

        hasMore:
          nextCursor !== null,
      },

      injuries: {
        matched,
        unmatched,
        inserted,
        updated,
      },

      unmatchedInjuries:
        unmatchedInjuries.slice(
          0,
          100
        ),
    });
  } catch (error) {
    console.error(
      "BALLDONTLIE injury sync failed:",
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
            : "Unknown BALLDONTLIE injury sync error.",
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
  return runSync(request);
}

export async function POST(
  request: Request
) {
  return runSync(request);
}