import { NextRequest, NextResponse } from "next/server";

import { requireLeagueMember } from "@/lib/leagues/requireLeagueMember";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { refreshGreyhoundH2HMatchups } from "@/lib/greyhound/refreshGreyhoundH2HMatchups";

export const dynamic = "force-dynamic";

type TeamRow = {
  id: number;
  team_number: number;
  team_name: string;
  active: boolean;
};

type SettingsRow = {
  game_format: string;
  competition_start_date: string | null;
  competition_end_date: string | null;
};

type MatchupRow = {
  id: number;
  matchup_number: number;
  start_date: string;
  end_date: string;
  home_competition_team_id: number;
  away_competition_team_id: number | null;
  home_total_return: number | string;
  away_total_return: number | string;
  winner_competition_team_id: number | null;
  is_tie: boolean;
  status: string;
  finalized_at: string | null;
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

function addDays(dateText: string, amount: number) {
  const [year, month, day] = dateText.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function minDate(a: string, b: string) {
  return a < b ? a : b;
}

function buildPeriods(startDate: string, endDate: string) {
  const periods: Array<{
    matchupNumber: number;
    startDate: string;
    endDate: string;
  }> = [];

  let current = startDate;
  let matchupNumber = 1;

  while (current <= endDate) {
    const periodEnd = minDate(addDays(current, 6), endDate);

    periods.push({
      matchupNumber,
      startDate: current,
      endDate: periodEnd,
    });

    current = addDays(current, 7);
    matchupNumber += 1;
  }

  return periods;
}

function shuffled<T>(rows: T[]) {
  const copy = [...rows];

  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }

  return copy;
}

function roundRobin(teamIds: Array<number | null>) {
  const ids = [...teamIds];

  if (ids.length % 2 === 1) {
    ids.push(null);
  }

  const rounds: Array<
    Array<{
      home: number;
      away: number | null;
    }>
  > = [];

  let rotation = [...ids];
  const roundCount = rotation.length - 1;

  for (let round = 0; round < roundCount; round += 1) {
    const pairs: Array<{ home: number; away: number | null }> = [];

    for (let i = 0; i < rotation.length / 2; i += 1) {
      const left = rotation[i];
      const right = rotation[rotation.length - 1 - i];

      if (left === null && right === null) continue;

      if (left === null && right !== null) {
        pairs.push({ home: right, away: null });
        continue;
      }

      if (left !== null && right === null) {
        pairs.push({ home: left, away: null });
        continue;
      }

      if (left !== null && right !== null) {
        const swapHome = round % 2 === 1;

        pairs.push({
          home: swapHome ? right : left,
          away: swapHome ? left : right,
        });
      }
    }

    rounds.push(pairs);

    rotation = [
      rotation[0],
      rotation[rotation.length - 1],
      ...rotation.slice(1, rotation.length - 1),
    ];
  }

  return rounds;
}

async function loadWorkspace(leagueId: string) {
  const admin = createSupabaseAdminClient();

  const [
    settingsResult,
    teamsResult,
    matchupsResult,
    recordsResult,
  ] = await Promise.all([
    admin
      .from("greyhound_league_settings")
      .select("game_format,competition_start_date,competition_end_date")
      .eq("league_id", leagueId)
      .maybeSingle(),
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
      .order("matchup_number", { ascending: true })
      .order("id", { ascending: true }),
    admin
      .from("greyhound_h2h_team_records")
      .select(
        "competition_team_id,wins,losses,ties,total_returned,total_wagered,net",
      )
      .eq("league_id", leagueId),
  ]);

  for (const result of [
    settingsResult,
    teamsResult,
    matchupsResult,
    recordsResult,
  ]) {
    if (result.error) throw result.error;
  }

  const settings = settingsResult.data as unknown as SettingsRow | null;
  const teams = (teamsResult.data ?? []) as unknown as TeamRow[];
  const matchups = (matchupsResult.data ?? []) as unknown as MatchupRow[];

  const teamById = new Map(
    teams.map((team) => [Number(team.id), team] as const),
  );

  const periods = settings?.competition_start_date && settings?.competition_end_date
    ? buildPeriods(
        settings.competition_start_date,
        settings.competition_end_date,
      )
    : [];

  const records = (recordsResult.data ?? []).map((row) => {
    const record = row as {
      competition_team_id: number;
      wins: number;
      losses: number;
      ties: number;
      total_returned: number | string;
      total_wagered: number | string;
      net: number | string;
    };

    return {
      competitionTeamId: Number(record.competition_team_id),
      teamName:
        teamById.get(Number(record.competition_team_id))?.team_name ??
        `Team ${record.competition_team_id}`,
      wins: Number(record.wins ?? 0),
      losses: Number(record.losses ?? 0),
      ties: Number(record.ties ?? 0),
      totalReturned: Number(record.total_returned ?? 0),
      totalWagered: Number(record.total_wagered ?? 0),
      net: Number(record.net ?? 0),
    };
  });

  records.sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (a.losses !== b.losses) return a.losses - b.losses;
    if (b.ties !== a.ties) return b.ties - a.ties;
    return b.totalReturned - a.totalReturned;
  });

  return {
    gameFormat: settings?.game_format ?? "bankroll",
    competitionStartDate: settings?.competition_start_date ?? null,
    competitionEndDate: settings?.competition_end_date ?? null,
    periods,
    teams,
    records,
    matchups: matchups.map((row) => ({
      id: Number(row.id),
      matchupNumber: Number(row.matchup_number),
      startDate: row.start_date,
      endDate: row.end_date,
      homeTeamId: Number(row.home_competition_team_id),
      awayTeamId:
        row.away_competition_team_id == null
          ? null
          : Number(row.away_competition_team_id),
      homeTeamName:
        teamById.get(Number(row.home_competition_team_id))?.team_name ??
        `Team ${row.home_competition_team_id}`,
      awayTeamName:
        row.away_competition_team_id == null
          ? "BYE"
          : teamById.get(Number(row.away_competition_team_id))?.team_name ??
            `Team ${row.away_competition_team_id}`,
      homeTotalReturn: Number(row.home_total_return ?? 0),
      awayTotalReturn: Number(row.away_total_return ?? 0),
      winnerTeamId:
        row.winner_competition_team_id == null
          ? null
          : Number(row.winner_competition_team_id),
      isTie: Boolean(row.is_tie),
      status: row.status,
      finalizedAt: row.finalized_at,
    })),
  };
}

export async function GET(request: NextRequest) {
  try {
    const leagueId = request.nextUrl.searchParams.get("leagueId")?.trim();

    if (!leagueId) return jsonError("leagueId is required.", 400);

    await requireCommissioner(leagueId);

    const workspace = await loadWorkspace(leagueId);

    return NextResponse.json(
      { success: true, ...workspace },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to load Greyhound Head-to-Head schedule.";

    if (message === "GREYHOUND_ONLY") {
      return jsonError("This endpoint is only available for Greyhound leagues.", 400);
    }

    if (message === "COMMISSIONER_ONLY") {
      return jsonError("Only the commissioner can manage Head-to-Head scheduling.", 403);
    }

    console.error("[greyhound/h2h-schedule] GET failed", error);
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
    const workspace = await loadWorkspace(leagueId);

    if (workspace.gameFormat !== "team_head_to_head") {
      return jsonError(
        "Head-to-Head scheduling is only available for Team Season — Head-to-Head leagues.",
        409,
      );
    }

    if (action === "refresh_official_scores") {
      const refreshResult = await refreshGreyhoundH2HMatchups(leagueId);

      return NextResponse.json({
        success: true,
        refresh: refreshResult,
      });
    }

    if (action === "generate_schedule") {
      const randomize = body.randomize !== false;

      if (
        !workspace.competitionStartDate ||
        !workspace.competitionEndDate
      ) {
        return jsonError(
          "Competition start and end dates must be configured first.",
          409,
        );
      }

      if (workspace.teams.length < 2) {
        return jsonError(
          "At least two active Greyhound competition teams are required.",
          409,
        );
      }

      const teamIds = (
        randomize ? shuffled(workspace.teams) : workspace.teams
      ).map((team) => Number(team.id));

      const rounds = roundRobin(teamIds);
      const rows: Array<Record<string, unknown>> = [];

      for (let index = 0; index < workspace.periods.length; index += 1) {
        const period = workspace.periods[index];
        const round = rounds[index % rounds.length];

        for (const pair of round) {
          rows.push({
            league_id: leagueId,
            matchup_number: period.matchupNumber,
            start_date: period.startDate,
            end_date: period.endDate,
            home_competition_team_id: pair.home,
            away_competition_team_id: pair.away,
            home_total_return: 0,
            away_total_return: 0,
            winner_competition_team_id: null,
            is_tie: false,
            status: "scheduled",
            finalized_at: null,
          });
        }
      }

      const { error: deleteError } = await admin
        .from("greyhound_h2h_matchups")
        .delete()
        .eq("league_id", leagueId);

      if (deleteError) throw deleteError;

      if (rows.length > 0) {
        const { error: insertError } = await admin
          .from("greyhound_h2h_matchups")
          .insert(rows);

        if (insertError) throw insertError;
      }

      return NextResponse.json({
        success: true,
        generatedPeriods: workspace.periods.length,
        generatedMatchups: rows.length,
      });
    }

    if (action === "save_matchup") {
      const matchupId =
        body.matchupId == null ? null : Number(body.matchupId);
      const matchupNumber = Number(body.matchupNumber);
      const homeTeamId = Number(body.homeTeamId);
      const awayTeamId =
        body.awayTeamId == null ||
        String(body.awayTeamId).trim() === ""
          ? null
          : Number(body.awayTeamId);

      const period = workspace.periods.find(
        (row) => row.matchupNumber === matchupNumber,
      );

      if (!period) {
        return jsonError("Valid matchup period is required.", 400);
      }

      const teamIds = new Set(workspace.teams.map((team) => Number(team.id)));

      if (!teamIds.has(homeTeamId)) {
        return jsonError("Choose a valid home team.", 400);
      }

      if (awayTeamId !== null && !teamIds.has(awayTeamId)) {
        return jsonError("Choose a valid away team.", 400);
      }

      if (awayTeamId === homeTeamId) {
        return jsonError("A team cannot play itself.", 400);
      }

      const payload = {
        league_id: leagueId,
        matchup_number: matchupNumber,
        start_date: period.startDate,
        end_date: period.endDate,
        home_competition_team_id: homeTeamId,
        away_competition_team_id: awayTeamId,
        home_total_return: 0,
        away_total_return: 0,
        winner_competition_team_id: null,
        is_tie: false,
        status: "scheduled",
        finalized_at: null,
      };

      if (matchupId !== null && Number.isInteger(matchupId)) {
        const { error } = await admin
          .from("greyhound_h2h_matchups")
          .update(payload)
          .eq("league_id", leagueId)
          .eq("id", matchupId);

        if (error) throw error;
      } else {
        const { error } = await admin
          .from("greyhound_h2h_matchups")
          .insert(payload);

        if (error) throw error;
      }

      return NextResponse.json({ success: true });
    }

    if (action === "delete_matchup") {
      const matchupId = Number(body.matchupId);

      if (!Number.isInteger(matchupId) || matchupId <= 0) {
        return jsonError("Valid matchupId is required.", 400);
      }

      const { error } = await admin
        .from("greyhound_h2h_matchups")
        .delete()
        .eq("league_id", leagueId)
        .eq("id", matchupId);

      if (error) throw error;

      return NextResponse.json({ success: true });
    }

    if (action === "clear_schedule") {
      const { error } = await admin
        .from("greyhound_h2h_matchups")
        .delete()
        .eq("league_id", leagueId);

      if (error) throw error;

      return NextResponse.json({ success: true });
    }

    return jsonError("Unsupported Head-to-Head schedule action.", 400);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to update Greyhound Head-to-Head schedule.";

    if (message === "GREYHOUND_ONLY") {
      return jsonError("This endpoint is only available for Greyhound leagues.", 400);
    }

    if (message === "COMMISSIONER_ONLY") {
      return jsonError("Only the commissioner can manage Head-to-Head scheduling.", 403);
    }

    console.error("[greyhound/h2h-schedule] POST failed", error);
    return jsonError(message, 500);
  }
}
