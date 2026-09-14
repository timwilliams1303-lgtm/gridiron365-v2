import { NextRequest, NextResponse } from "next/server";

import { requireLeagueMember } from "@/lib/leagues/requireLeagueMember";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type SettingsRow = {
  game_format: string;
  duration_mode: string | null;
  competition_start_date: string | null;
  competition_end_date: string | null;
};

type RoundRow = {
  id: number;
  round_number: number;
  round_name: string;
  start_date: string;
  end_date: string;
  number_of_days: number;
  status: string;
  started_at: string | null;
  finalized_at: string | null;
  advance_count: number | null;
};

function jsonError(message: string, status: number) {
  return NextResponse.json(
    { success: false, error: message },
    { status, headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}

async function requireCommissioner(leagueId: string) {
  const access = await requireLeagueMember(leagueId);

  if (String(access.league.leagueType) !== "greyhound") {
    throw new Error("GREYHOUND_ONLY");
  }

  if (!access.isCommissioner) {
    throw new Error("COMMISSIONER_ONLY");
  }

  return access;
}

export async function GET(request: NextRequest) {
  try {
    const leagueId = request.nextUrl.searchParams.get("leagueId")?.trim();

    if (!leagueId) return jsonError("leagueId is required.", 400);

    const access = await requireCommissioner(leagueId);
    const admin = createSupabaseAdminClient();

    const [
      settingsResult,
      roundsResult,
      teamsResult,
      h2hResult,
      recordsResult,
      roundParticipantsResult,
    ] = await Promise.all([
      admin
        .from("greyhound_league_settings")
        .select(
          "game_format,duration_mode,competition_start_date,competition_end_date",
        )
        .eq("league_id", leagueId)
        .maybeSingle(),
      admin
        .from("greyhound_competition_rounds")
        .select(
          "id,round_number,round_name,start_date,end_date,number_of_days,status,started_at,finalized_at,advance_count",
        )
        .eq("league_id", leagueId)
        .order("round_number", { ascending: true }),
      admin
        .from("greyhound_competition_teams")
        .select("id,team_number,team_name,active")
        .eq("league_id", leagueId)
        .eq("active", true)
        .order("team_number", { ascending: true }),
      admin
        .from("greyhound_h2h_matchups")
        .select(
          "id,matchup_number,start_date,end_date,home_competition_team_id,away_competition_team_id,home_total_return,away_total_return,winner_competition_team_id,is_tie,status,finalized_at",
        )
        .eq("league_id", leagueId)
        .order("matchup_number", { ascending: true }),
      admin
        .from("greyhound_h2h_team_records")
        .select(
          "competition_team_id,wins,losses,ties,total_returned,total_wagered,net",
        )
        .eq("league_id", leagueId),
      admin
        .from("greyhound_round_participants")
        .select(
          "round_id,participant_id,status,total_wagered,total_returned,net,round_rank,eliminated_at,advanced_at",
        )
        .eq("league_id", leagueId),
    ]);

    for (const result of [
      settingsResult,
      roundsResult,
      teamsResult,
      h2hResult,
      recordsResult,
      roundParticipantsResult,
    ]) {
      if (result.error) throw result.error;
    }

    const settings = settingsResult.data as unknown as SettingsRow | null;
    const rounds = (roundsResult.data ?? []) as unknown as RoundRow[];

    const today = new Date().toISOString().slice(0, 10);

    const status =
      settings?.competition_end_date && today > settings.competition_end_date
        ? "ended"
        : settings?.competition_start_date &&
            today >= settings.competition_start_date
          ? "active"
          : "scheduled";

    return NextResponse.json(
      {
        success: true,
        league: {
          id: leagueId,
          name: access.league.name,
        },
        gameFormat: settings?.game_format ?? "bankroll",
        durationMode: settings?.duration_mode ?? null,
        competitionStartDate: settings?.competition_start_date ?? null,
        competitionEndDate: settings?.competition_end_date ?? null,
        competitionStatus: status,
        rounds,
        teams: teamsResult.data ?? [],
        h2hMatchups: h2hResult.data ?? [],
        h2hRecords: recordsResult.data ?? [],
        roundParticipants: roundParticipantsResult.data ?? [],
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to load Season Control.";

    if (message === "GREYHOUND_ONLY") {
      return jsonError("This endpoint is only available for Greyhound leagues.", 400);
    }

    if (message === "COMMISSIONER_ONLY") {
      return jsonError("Only the commissioner can access Season Control.", 403);
    }

    console.error("[greyhound/commissioner/season-control] GET failed", error);
    return jsonError(message, 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const leagueId = String(body.leagueId ?? "").trim();
    const action = String(body.action ?? "").trim();

    if (!leagueId) return jsonError("leagueId is required.", 400);

    await requireCommissioner(leagueId);
    const admin = createSupabaseAdminClient();

    if (action === "set_round_advance_count") {
      const roundId = Number(body.roundId);
      const advanceCount = Number(body.advanceCount);

      if (
        !Number.isInteger(roundId) ||
        roundId <= 0 ||
        !Number.isInteger(advanceCount) ||
        advanceCount <= 0
      ) {
        return jsonError("Valid roundId and advanceCount are required.", 400);
      }

      const { error } = await admin
        .from("greyhound_competition_rounds")
        .update({ advance_count: advanceCount })
        .eq("league_id", leagueId)
        .eq("id", roundId);

      if (error) throw error;

      return NextResponse.json({ success: true });
    }

    return jsonError("Unsupported Season Control action.", 400);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to update Season Control.";

    if (message === "GREYHOUND_ONLY") {
      return jsonError("This endpoint is only available for Greyhound leagues.", 400);
    }

    if (message === "COMMISSIONER_ONLY") {
      return jsonError("Only the commissioner can update Season Control.", 403);
    }

    console.error("[greyhound/commissioner/season-control] POST failed", error);
    return jsonError(message, 500);
  }
}
