import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

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

  return (
    request.headers.get(
      "x-gridiron-sync-secret"
    ) === secret ||
    request.headers.get(
      "authorization"
    ) === `Bearer ${secret}`
  );
}

export async function POST(
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

  const supabase =
    createSupabaseAdmin();

  const startedAt =
    new Date().toISOString();

  try {
    const {
      data: state,
      error: stateError,
    } =
      await supabase
        .from(
          "external_data_sync_state"
        )
        .select(
          `
            id,
            cursor_value
          `
        )
        .eq(
          "provider",
          "BALLDONTLIE"
        )
        .eq(
          "sync_type",
          "active_players"
        )
        .single();

    if (stateError || !state) {
      throw new Error(
        `Unable to load active-player sync state: ${
          stateError?.message ??
          "State row not found."
        }`
      );
    }

    await supabase
      .from(
        "external_data_sync_state"
      )
      .update({
        last_started_at:
          startedAt,
        last_status:
          "running",
        last_error:
          null,
        updated_at:
          startedAt,
      })
      .eq(
        "id",
        state.id
      );

    const cursor =
      state.cursor_value;

    const baseUrl =
      process.env
        .NEXT_PUBLIC_SITE_URL ??
      "https://www.gridiron365fantasy.com";

    const url =
      new URL(
        `${baseUrl}/api/nfl/sync-balldontlie-active-players`
      );

    if (cursor) {
      url.searchParams.set(
        "cursor",
        cursor
      );
    }

    const response =
      await fetch(
        url.toString(),
        {
          method: "POST",

          headers: {
            "x-gridiron-sync-secret":
              process.env
                .NFL_SYNC_SECRET ??
              "",
          },

          cache: "no-store",
        }
      );

    const result =
      await response.json();

    if (!response.ok) {
      throw new Error(
        result?.error ??
          `Active-player batch failed with ${response.status}.`
      );
    }

    const nextCursor =
      result?.batch
        ?.nextCursor;

    const hasMore =
      result?.batch
        ?.hasMore === true;

    const completedAt =
      new Date().toISOString();

    await supabase
      .from(
        "external_data_sync_state"
      )
      .update({
        cursor_value:
          hasMore &&
          nextCursor !==
            null &&
          nextCursor !==
            undefined
            ? String(
                nextCursor
              )
            : null,

        last_completed_at:
          completedAt,

        last_success_at:
          completedAt,

        last_status:
          hasMore
            ? "in_progress"
            : "complete",

        last_error:
          null,

        updated_at:
          completedAt,
      })
      .eq(
        "id",
        state.id
      );

    return NextResponse.json({
      success: true,

      provider:
        "BALLDONTLIE",

      syncType:
        "active_players",

      requestedCursor:
        cursor ?? null,

      nextCursor:
        hasMore
          ? nextCursor
          : null,

      hasMore,

      batch:
        result,
    });
  } catch (error) {
    const failedAt =
      new Date().toISOString();

    await supabase
      .from(
        "external_data_sync_state"
      )
      .update({
        last_status:
          "error",

        last_error:
          error instanceof Error
            ? error.message
            : "Unknown active-player orchestration error.",

        updated_at:
          failedAt,
      })
      .eq(
        "provider",
        "BALLDONTLIE"
      )
      .eq(
        "sync_type",
        "active_players"
      );

    return NextResponse.json(
      {
        success: false,

        provider:
          "BALLDONTLIE",

        syncType:
          "active_players",

        error:
          error instanceof Error
            ? error.message
            : "Unknown active-player orchestration error.",
      },
      {
        status: 500,
      }
    );
  }
}