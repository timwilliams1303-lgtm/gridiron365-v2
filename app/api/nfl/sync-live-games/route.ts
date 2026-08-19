import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type GameRow = {
  id: number;
  espn_event_id: string;
  season: number;
  season_type: number;
  week: number;
  kickoff_at: string;
  status_name: string | null;
  status_completed: boolean | null;
};

type GameSyncResult = {
  nflGameId: number;
  eventId: string;
  success: boolean;
  action: "synced" | "skipped" | "failed";
  state?: string | null;
  status?: string | null;
  completed?: boolean;
  error?: string;
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

function isAuthorized(request: Request) {
  if (process.env.NODE_ENV !== "production") {
    return true;
  }

  const secret =
    process.env.NFL_SYNC_SECRET;

  if (!secret) {
    return false;
  }

  const authorization =
    request.headers.get("authorization");

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

async function fetchEspnStatus(
  eventId: string
) {
  const url =
    `https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=${eventId}`;

  const response =
    await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent":
          "Mozilla/5.0 Gridiron365/1.0",
      },
      cache: "no-store",
    });

  if (!response.ok) {
    throw new Error(
      `ESPN returned HTTP ${response.status}`
    );
  }

  const data =
    await response.json();

  const competition =
    data?.header?.competitions?.[0];

  if (!competition) {
    throw new Error(
      "ESPN returned no competition."
    );
  }

  return {
    state:
      competition?.status?.type?.state ??
      null,

    status:
      competition?.status?.type?.name ??
      null,

    completed:
      competition?.status?.type
        ?.completed === true,
  };
}

function isInsideGameWindow(
  kickoffAt: string,
  now: Date
) {
  const kickoff =
    new Date(kickoffAt).getTime();

  const current =
    now.getTime();

  /*
   * Start monitoring 15 minutes
   * before kickoff.
   */
  const start =
    kickoff -
    15 * 60 * 1000;

  /*
   * Keep game eligible for six
   * hours after kickoff.
   */
  const end =
    kickoff +
    6 * 60 * 60 * 1000;

  return (
    current >= start &&
    current <= end
  );
}

async function callGameSync(
  request: Request,
  eventId: string
) {
  const currentUrl =
    new URL(request.url);

  const url =
    new URL(
      "/api/nfl/sync-live-boxscore",
      currentUrl.origin
    );

  url.searchParams.set(
    "eventId",
    eventId
  );

  const headers:
    Record<string, string> = {};

  const secret =
    process.env.NFL_SYNC_SECRET;

  if (secret) {
    headers[
      "x-gridiron-sync-secret"
    ] = secret;
  }

  const response =
    await fetch(
      url.toString(),
      {
        method: "POST",
        headers,
        cache: "no-store",
      }
    );

  const text =
    await response.text();

  let data: any = null;

  try {
    data = JSON.parse(text);
  } catch {
    // Leave null.
  }

  if (
    !response.ok ||
    data?.success !== true
  ) {
    throw new Error(
      data?.error ??
      text.slice(0, 500) ??
      `HTTP ${response.status}`
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
    const supabase =
      createSupabaseAdmin();

    const now =
      new Date();

    /*
     * Only query games around today.
     * The tighter window below decides
     * whether the game is actually active.
     */
    const lowerBound =
      new Date(
        now.getTime() -
        12 * 60 * 60 * 1000
      );

    const upperBound =
      new Date(
        now.getTime() +
        24 * 60 * 60 * 1000
      );

    const {
      data,
      error,
    } =
      await supabase
        .from("nfl_games")
        .select(
          `
            id,
            espn_event_id,
            season,
            season_type,
            week,
            kickoff_at,
            status_name,
            status_completed
          `
        )
        .not(
          "espn_event_id",
          "is",
          null
        )
        .gte(
          "kickoff_at",
          lowerBound.toISOString()
        )
        .lte(
          "kickoff_at",
          upperBound.toISOString()
        )
        .order(
          "kickoff_at",
          {
            ascending: true,
          }
        );

    if (error) {
      throw new Error(
        `Unable to load NFL games: ${error.message}`
      );
    }

    const candidates =
      (data ?? []) as GameRow[];

    const eligible =
      candidates.filter(
        (game) =>
          isInsideGameWindow(
            game.kickoff_at,
            now
          )
      );

    const results:
      GameSyncResult[] = [];

    let liveGames = 0;
    let syncedGames = 0;
    let skippedGames = 0;
    let failedGames = 0;

    for (const game of eligible) {
      try {
        const status =
          await fetchEspnStatus(
            game.espn_event_id
          );

        /*
         * LIVE
         */
        if (status.state === "in") {
          liveGames += 1;

          await callGameSync(
            request,
            game.espn_event_id
          );

          syncedGames += 1;

          results.push({
            nflGameId: game.id,
            eventId:
              game.espn_event_id,
            success: true,
            action: "synced",
            state: status.state,
            status: status.status,
            completed:
              status.completed,
          });

          continue;
        }

        /*
         * FINAL
         *
         * If our database hasn't
         * recorded final yet, sync
         * one last time.
         */
        if (
          status.state === "post" &&
          status.completed
        ) {
          if (
            game.status_completed !==
            true
          ) {
            await callGameSync(
              request,
              game.espn_event_id
            );

            syncedGames += 1;

            results.push({
              nflGameId: game.id,
              eventId:
                game.espn_event_id,
              success: true,
              action: "synced",
              state:
                status.state,
              status:
                status.status,
              completed:
                true,
            });
          } else {
            skippedGames += 1;

            results.push({
              nflGameId: game.id,
              eventId:
                game.espn_event_id,
              success: true,
              action: "skipped",
              state:
                status.state,
              status:
                status.status,
              completed:
                true,
            });
          }

          continue;
        }

        /*
         * Scheduled / pregame.
         *
         * Don't pull the heavy box
         * score + play-by-play yet.
         */
        skippedGames += 1;

        results.push({
          nflGameId:
            game.id,
          eventId:
            game.espn_event_id,
          success:
            true,
          action:
            "skipped",
          state:
            status.state,
          status:
            status.status,
          completed:
            status.completed,
        });

      } catch (error) {
        failedGames += 1;

        results.push({
          nflGameId:
            game.id,
          eventId:
            game.espn_event_id,
          success:
            false,
          action:
            "failed",
          error:
            error instanceof Error
              ? error.message
              : "Unknown game sync error.",
        });
      }
    }

    return NextResponse.json({
      success:
        failedGames === 0,

      checkedAt:
        now.toISOString(),

      candidateGames:
        candidates.length,

      eligibleGames:
        eligible.length,

      liveGames,

      syncedGames,

      skippedGames,

      failedGames,

      results,
    });

  } catch (error) {
    console.error(
      "Live NFL controller failed:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown live sync error.",
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