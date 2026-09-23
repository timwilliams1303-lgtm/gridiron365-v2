import { revalidatePath } from "next/cache";
import Link from "next/link";

import Card from "@/components/ui/Card";
import { requireLeagueMember } from "@/lib/leagues/requireLeagueMember";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import NhlTraditionalTeamNameEditor from "./NhlTraditionalTeamNameEditor";

type NhlTraditionalMyTeamProps = {
  leagueId: string;
};

type NhlSettingsRow = {
  league_format: string | null;
  position_mode: string | null;
  lineup_period: string | null;
  allow_daily_lineup_changes: boolean | null;
  player_lock_mode: string | null;
};

type RosterSettingsRow = {
  starting_c: number | null;
  starting_lw: number | null;
  starting_rw: number | null;
  starting_d: number | null;
  starting_g: number | null;
  starting_util: number | null;
  starting_f: number | null;
  bench_slots: number | null;
  ir_slots: number | null;
};

type FantasyTeamRow = {
  id: number;
  team_name: string | null;
  owner_id: string | null;
  active: boolean | null;
};

type RosterRow = {
  id: number;
  fantasy_team_id: number;
  nhl_player_id: number;
  roster_status: string | null;
  acquired_via: string | null;
  acquired_at: string | null;
};

type NhlPlayerStatusRow = {
  id: number;
  display_name: string | null;
  position: string | null;
  position_group: string | null;
  team_id: number | null;
  jersey_number: string | null;
  injury_status: string | null;
};

type ProjectionRow = {
  nhl_player_id: number;
  projected_games_played: number | string | null;
  projected_points: number | string | null;
  projected_goals: number | string | null;
  projected_assists: number | string | null;
};

type PlayerGameScoreRow = {
  nhl_game_id: number;
  nhl_player_id: number;
  fantasy_points: number | string | null;
};

type StandingRow = {
  fantasy_team_id: number;
  wins: number | null;
  losses: number | null;
  ties: number | null;
  points_for: number | string | null;
  points_against: number | string | null;
  rank: number | null;
};

type SeasonStateRow = {
  active_week: number | null;
  phase: string | null;
  regular_season_complete: boolean | null;
  playoffs_started: boolean | null;
  season_complete: boolean | null;
};

type WeekCalendarRow = {
  week: number;
  starts_at: string;
  ends_at: string;
};

type LineupRow = {
  id: number;
  nhl_player_id: number;
  lineup_slot: string | null;
  slot_index: number | null;
  lineup_date: string | null;
  nhl_game_id: number | null;
  game_start_at: string | null;
  is_locked: boolean | null;
};


async function renameNhlFantasyTeamAction(formData: FormData) {
  "use server";

  const leagueId = String(formData.get("leagueId") ?? "");
  const fantasyTeamId = Number(formData.get("fantasyTeamId"));
  const teamName = String(formData.get("teamName") ?? "").trim();

  if (
    !leagueId ||
    !Number.isFinite(fantasyTeamId) ||
    teamName.length < 1 ||
    teamName.length > 40
  ) {
    throw new Error("Team name must be between 1 and 40 characters.");
  }

  const access = await requireLeagueMember(leagueId);

  if (Number(access.fantasyTeam?.id ?? 0) !== fantasyTeamId) {
    throw new Error("You can only rename your own fantasy team.");
  }

  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.rpc(
    "rename_nhl_traditional_fantasy_team",
    {
      p_league_id: leagueId,
      p_fantasy_team_id: fantasyTeamId,
      p_team_name: teamName,
    }
  );

  if (error) {
    throw new Error(`Unable to update team name: ${error.message}`);
  }

  revalidatePath(`/league/${leagueId}`, "layout");
  revalidatePath(`/league/${leagueId}/nhl`);
  revalidatePath(`/league/${leagueId}/nhl/my-team`);
  revalidatePath(`/league/${leagueId}/nhl/teams`);
  revalidatePath(`/league/${leagueId}/nhl/matchups`);
  revalidatePath(`/league/${leagueId}/nhl/standings`);
  revalidatePath(`/league/${leagueId}/nhl/draft`);
  revalidatePath(`/league/${leagueId}/nhl/trades`);
  revalidatePath(`/league/${leagueId}/nhl/playoffs`);
  revalidatePath(`/league/${leagueId}/nhl/recap`);
  revalidatePath(`/league/${leagueId}/nhl/trophy-case`);
  revalidatePath(`/league/${leagueId}/nhl/commissioner`);

  return {
    success: true,
    teamName,
  };
}

async function movePlayerToIrAction(formData: FormData) {
  "use server";

  const leagueId = String(formData.get("leagueId") ?? "");
  const fantasyTeamId = Number(formData.get("fantasyTeamId"));
  const nhlPlayerId = Number(formData.get("nhlPlayerId"));

  if (!leagueId || !Number.isFinite(fantasyTeamId) || !Number.isFinite(nhlPlayerId)) {
    throw new Error("Invalid IR request.");
  }

  const access = await requireLeagueMember(leagueId);

  if (Number(access.fantasyTeam?.id ?? 0) !== fantasyTeamId) {
    throw new Error("You can only manage IR for your own fantasy team.");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("move_nhl_traditional_player_to_ir", {
    p_league_id: leagueId,
    p_fantasy_team_id: fantasyTeamId,
    p_nhl_player_id: nhlPlayerId,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/league/${leagueId}/nhl/my-team`);
}

async function activatePlayerFromIrAction(formData: FormData) {
  "use server";

  const leagueId = String(formData.get("leagueId") ?? "");
  const fantasyTeamId = Number(formData.get("fantasyTeamId"));
  const nhlPlayerId = Number(formData.get("nhlPlayerId"));

  if (!leagueId || !Number.isFinite(fantasyTeamId) || !Number.isFinite(nhlPlayerId)) {
    throw new Error("Invalid IR activation request.");
  }

  const access = await requireLeagueMember(leagueId);

  if (Number(access.fantasyTeam?.id ?? 0) !== fantasyTeamId) {
    throw new Error("You can only manage IR for your own fantasy team.");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("activate_nhl_traditional_player_from_ir", {
    p_league_id: leagueId,
    p_fantasy_team_id: fantasyTeamId,
    p_nhl_player_id: nhlPlayerId,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/league/${leagueId}/nhl/my-team`);
}

async function startActivePlayersAction(formData: FormData) {
  "use server";

  const leagueId = String(formData.get("leagueId") ?? "");
  const fantasyTeamId = Number(formData.get("fantasyTeamId"));
  const season = Number(formData.get("season"));
  const week = Number(formData.get("week"));

  if (
    !leagueId ||
    !Number.isFinite(fantasyTeamId) ||
    !Number.isFinite(season) ||
    !Number.isFinite(week)
  ) {
    throw new Error("Invalid Start Weekly Lineup request.");
  }

  const access = await requireLeagueMember(leagueId);

  if (Number(access.fantasyTeam?.id ?? 0) !== fantasyTeamId) {
    throw new Error("You can only manage your own NHL lineup.");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("start_nhl_traditional_active_players", {
    p_league_id: leagueId,
    p_fantasy_team_id: fantasyTeamId,
    p_season: season,
    p_week: week,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/league/${leagueId}/nhl/my-team`);
}

async function moveLineupPlayerAction(formData: FormData) {
  "use server";

  const leagueId = String(formData.get("leagueId") ?? "");
  const fantasyTeamId = Number(formData.get("fantasyTeamId"));
  const nhlPlayerId = Number(formData.get("nhlPlayerId"));
  const target = String(formData.get("target") ?? "");
  const [targetSlotRaw, targetSlotIndexRaw] = target.split("|");
  const targetSlot = String(targetSlotRaw ?? "").toUpperCase();
  const targetSlotIndex = Number(targetSlotIndexRaw);
  const lineupDate = String(formData.get("lineupDate") ?? "");

  if (
    !leagueId ||
    !Number.isFinite(fantasyTeamId) ||
    !Number.isFinite(nhlPlayerId) ||
    !targetSlot ||
    !Number.isFinite(targetSlotIndex) ||
    !lineupDate
  ) {
    throw new Error("Invalid lineup move request.");
  }

  const access = await requireLeagueMember(leagueId);

  if (Number(access.fantasyTeam?.id ?? 0) !== fantasyTeamId) {
    throw new Error("You can only manage your own NHL lineup.");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("move_nhl_traditional_lineup_player", {
    p_league_id: leagueId,
    p_fantasy_team_id: fantasyTeamId,
    p_nhl_player_id: nhlPlayerId,
    p_target_slot: targetSlot,
    p_target_slot_index: targetSlotIndex,
    p_lineup_date: lineupDate,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/league/${leagueId}/nhl/my-team`);
}

function isIrEligibleStatus(value: string | null | undefined) {
  const status = String(value ?? "").trim().toUpperCase();
  return status === "INJURY_RESERVE" || status === "OUT" || status === "SUSPENSION";
}

function asNumber(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);

  return Number.isFinite(parsed) ? parsed : 0;
}

function formatPoints(value: number | string | null | undefined) {
  return asNumber(value).toFixed(2);
}

function titleCase(value: string | null | undefined) {
  if (!value) {
    return "—";
  }

  return value
    .replaceAll("_", " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export default async function NhlTraditionalMyTeam({
  leagueId,
}: NhlTraditionalMyTeamProps) {
  const access = await requireLeagueMember(leagueId);

  if (String(access.league.leagueType) !== "nhl_traditional") {
    throw new Error(
      "This page is only available for NHL Traditional leagues."
    );
  }

  const fantasyTeamId = access.fantasyTeam?.id ?? null;

  if (fantasyTeamId == null) {
    return (
      <main className="g365-nhl-my-team-page">
        <style>{baseStyles}</style>

        <section className="g365-nhl-my-team-shell">
          <Card>
            <div className="g365-nhl-empty">
              <span className="g365-nhl-eyebrow">
                NHL TRADITIONAL
              </span>

              <h1>No Fantasy Team Assigned</h1>

              <p>
                Your league membership is active, but you do not currently
                have an NHL fantasy team assigned to your account.
              </p>

              <Link
                href={`/league/${leagueId}/nhl`}
                className="g365-nhl-button g365-nhl-button-secondary g365-nhl-mobile-redundant-nav"
              >
                ← League Home
              </Link>
            </div>
          </Card>
        </section>
      </main>
    );
  }

  const supabase = await createSupabaseServerClient();
  const season = Number(access.league.season);

  const [
    settingsResult,
    rosterSettingsResult,
    teamResult,
    rosterResult,
    standingResult,
    seasonStateResult,
    lineupResult,
    weekCalendarResult,
  ] = await Promise.all([
    supabase
      .from("nhl_traditional_settings")
      .select(
        "league_format, position_mode, lineup_period, allow_daily_lineup_changes, player_lock_mode"
      )
      .eq("league_id", leagueId)
      .maybeSingle(),

    supabase
      .from("nhl_traditional_roster_settings")
      .select(
        "starting_c, starting_lw, starting_rw, starting_d, starting_g, starting_util, starting_f, bench_slots, ir_slots"
      )
      .eq("league_id", leagueId)
      .maybeSingle(),

    supabase
      .from("fantasy_teams")
      .select("id, team_name, owner_id, active")
      .eq("id", fantasyTeamId)
      .eq("league_id", leagueId)
      .maybeSingle(),

    supabase
      .from("nhl_traditional_rosters")
      .select(
        "id, fantasy_team_id, nhl_player_id, roster_status, acquired_via, acquired_at"
      )
      .eq("league_id", leagueId)
      .eq("fantasy_team_id", fantasyTeamId)
      .eq("season", season)
      .is("dropped_at", null)
      .order("id", {
        ascending: true,
      }),

    supabase
      .from("nhl_traditional_standings")
      .select(
        "fantasy_team_id, wins, losses, ties, points_for, points_against, rank"
      )
      .eq("league_id", leagueId)
      .eq("season", season)
      .eq("fantasy_team_id", fantasyTeamId)
      .maybeSingle(),

    supabase
      .from("nhl_traditional_season_state")
      .select(
        "active_week, phase, regular_season_complete, playoffs_started, season_complete"
      )
      .eq("league_id", leagueId)
      .eq("season", season)
      .maybeSingle(),

    supabase
      .from("nhl_traditional_weekly_lineups")
      .select(
        "id, nhl_player_id, lineup_slot, slot_index, lineup_date, nhl_game_id, game_start_at, is_locked"
      )
      .eq("league_id", leagueId)
      .eq("fantasy_team_id", fantasyTeamId)
      .eq("season", season)
      .order("lineup_date", { ascending: true })
      .order("lineup_slot", {
        ascending: true,
      })
      .order("slot_index", {
        ascending: true,
      }),

    supabase
      .from("nhl_traditional_week_calendar")
      .select("week, starts_at, ends_at")
      .eq("league_id", leagueId)
      .eq("season", season)
      .order("week", { ascending: true }),
  ]);

  if (settingsResult.error) {
    throw new Error(
      `Unable to load NHL league settings: ${settingsResult.error.message}`
    );
  }

  if (rosterSettingsResult.error) {
    throw new Error(
      `Unable to load NHL roster settings: ${rosterSettingsResult.error.message}`
    );
  }

  if (teamResult.error) {
    throw new Error(
      `Unable to load your NHL fantasy team: ${teamResult.error.message}`
    );
  }

  if (rosterResult.error) {
    throw new Error(
      `Unable to load your NHL roster: ${rosterResult.error.message}`
    );
  }

  if (standingResult.error) {
    throw new Error(
      `Unable to load your NHL standing: ${standingResult.error.message}`
    );
  }

  if (seasonStateResult.error) {
    throw new Error(
      `Unable to load NHL season state: ${seasonStateResult.error.message}`
    );
  }

  if (lineupResult.error) {
    throw new Error(
      `Unable to load your NHL lineup: ${lineupResult.error.message}`
    );
  }

  if (weekCalendarResult.error) {
    throw new Error(
      `Unable to load NHL week calendar: ${weekCalendarResult.error.message}`
    );
  }

  const settings = settingsResult.data as NhlSettingsRow | null;

  const rosterSettings =
    rosterSettingsResult.data as RosterSettingsRow | null;

  const team = teamResult.data as FantasyTeamRow | null;

  const roster = (rosterResult.data ?? []) as RosterRow[];

  const standing = standingResult.data as StandingRow | null;

  const seasonState =
    seasonStateResult.data as SeasonStateRow | null;

  const lineupRows = (lineupResult.data ?? []) as LineupRow[];

  const weekCalendar = (weekCalendarResult.data ?? []) as WeekCalendarRow[];

  const rosterPlayerIds = roster.map((row) => Number(row.nhl_player_id));
  let playerStatuses: NhlPlayerStatusRow[] = [];

  if (rosterPlayerIds.length > 0) {
    const playerStatusResult = await supabase
      .from("nhl_players")
      .select("id, display_name, position, position_group, team_id, jersey_number, injury_status")
      .in("id", rosterPlayerIds);

    if (playerStatusResult.error) {
      throw new Error(
        `Unable to load NHL injury statuses: ${playerStatusResult.error.message}`
      );
    }

    playerStatuses = (playerStatusResult.data ?? []) as NhlPlayerStatusRow[];
  }

  if (!settings) {
    throw new Error(
      "NHL Traditional league settings are missing."
    );
  }

  if (!rosterSettings) {
    throw new Error(
      "NHL Traditional roster settings are missing."
    );
  }

  if (!team) {
    throw new Error(
      "Your NHL fantasy team could not be found."
    );
  }

  const leagueFormat = String(
    settings.league_format ?? "redraft"
  );

  const positionMode = String(
    settings.position_mode ?? "detailed"
  );

  const formatLabel =
    leagueFormat === "dynasty"
      ? "NHL DYNASTY"
      : "NHL REDRAFT";

  const positionLabel =
    positionMode === "fdg"
      ? "F / D / G"
      : "C / LW / RW / D / G / UTIL";

  const activeWeek = Number(
    seasonState?.active_week ?? 1
  );

  const wins = Number(
    standing?.wins ?? 0
  );

  const losses = Number(
    standing?.losses ?? 0
  );

  const ties = Number(
    standing?.ties ?? 0
  );

  const activeRoster = roster.filter(
    (row) =>
      String(
        row.roster_status ?? ""
      ).toLowerCase() !== "ir"
  );

  const irRoster = roster.filter(
    (row) =>
      String(
        row.roster_status ?? ""
      ).toLowerCase() === "ir"
  );

  const playerById = new Map<number, NhlPlayerStatusRow>();

  for (const player of playerStatuses) {
    playerById.set(Number(player.id), player);
  }

  const projectedFantasyPpgByPlayer = new Map<number, number>();

  if (rosterPlayerIds.length > 0) {
    const projectedValues = await Promise.all(
      rosterPlayerIds.map(async (playerId) => {
        const { data, error } = await supabase.rpc(
          "get_nhl_traditional_projected_fantasy_ppg",
          {
            p_league_id: leagueId,
            p_season: season,
            p_nhl_player_id: playerId,
          }
        );

        if (error) {
          return [playerId, 0] as const;
        }

        return [playerId, asNumber(data as number | string | null)] as const;
      })
    );

    for (const [playerId, value] of projectedValues) {
      projectedFantasyPpgByPlayer.set(playerId, value);
    }
  }

  const lineupGameIds = Array.from(
    new Set(
      lineupRows
        .map((row) => row.nhl_game_id)
        .filter((value): value is number => value != null)
    )
  );

  let playerGameScores: PlayerGameScoreRow[] = [];

  if (lineupGameIds.length > 0 && rosterPlayerIds.length > 0) {
    const scoreResult = await supabase
      .from("nhl_traditional_player_game_scores")
      .select("nhl_game_id, nhl_player_id, fantasy_points")
      .eq("league_id", leagueId)
      .in("nhl_game_id", lineupGameIds)
      .in("nhl_player_id", rosterPlayerIds);

    if (scoreResult.error) {
      throw new Error(
        `Unable to load NHL fantasy scores: ${scoreResult.error.message}`
      );
    }

    playerGameScores = (scoreResult.data ?? []) as PlayerGameScoreRow[];
  }

  const fantasyPointsByGamePlayer = new Map<string, number>();

  for (const score of playerGameScores) {
    fantasyPointsByGamePlayer.set(
      `${Number(score.nhl_game_id)}-${Number(score.nhl_player_id)}`,
      asNumber(score.fantasy_points)
    );
  }

  const starterSlots =
    positionMode === "fdg"
      ? [
          { label: "F", count: Number(rosterSettings.starting_f ?? 0) },
          { label: "D", count: Number(rosterSettings.starting_d ?? 0) },
          { label: "G", count: Number(rosterSettings.starting_g ?? 0) },
          { label: "UTIL", count: Number(rosterSettings.starting_util ?? 0) },
        ]
      : [
          { label: "C", count: Number(rosterSettings.starting_c ?? 0) },
          { label: "LW", count: Number(rosterSettings.starting_lw ?? 0) },
          { label: "RW", count: Number(rosterSettings.starting_rw ?? 0) },
          { label: "D", count: Number(rosterSettings.starting_d ?? 0) },
          { label: "G", count: Number(rosterSettings.starting_g ?? 0) },
          { label: "UTIL", count: Number(rosterSettings.starting_util ?? 0) },
        ];

  const totalStartingSlots = starterSlots.reduce(
    (total, slot) => total + slot.count,
    0
  );

  const benchSlots = Number(rosterSettings.bench_slots ?? 0);
  const irSlots = Number(rosterSettings.ir_slots ?? 0);

  const starterSpotDefinitions = starterSlots.flatMap((slot) =>
    Array.from({ length: slot.count }, (_, index) => ({
      label: slot.label,
      slotIndex: index + 1,
    }))
  );

  const allMoveTargets = [
    ...starterSpotDefinitions,
    ...Array.from({ length: benchSlots }, (_, index) => ({
      label: "BN",
      slotIndex: index + 1,
    })),
  ];

  const activeWeekCalendar = weekCalendar.find(
    (row) => Number(row.week) === activeWeek
  );

  const weekDates: string[] = [];

  if (activeWeekCalendar?.starts_at && activeWeekCalendar?.ends_at) {
    const cursor = new Date(activeWeekCalendar.starts_at);
    const end = new Date(activeWeekCalendar.ends_at);

    while (cursor.getTime() < end.getTime()) {
      weekDates.push(cursor.toISOString().slice(0, 10));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  } else {
    weekDates.push(
      ...Array.from(
        new Set(
          lineupRows
            .map((row) => row.lineup_date)
            .filter((value): value is string => Boolean(value))
        )
      ).sort()
    );
  }

  const todayKey = new Date().toISOString().slice(0, 10);
  const defaultDate =
    weekDates.find((date) => date >= todayKey) ?? weekDates[weekDates.length - 1] ?? null;

  const lockedPlayers = lineupRows.filter(
    (row) =>
      row.is_locked ||
      (row.game_start_at != null && new Date(row.game_start_at).getTime() <= Date.now())
  ).length;

  function playerName(playerId: number | null | undefined) {
    if (playerId == null) return "Empty";
    return playerById.get(Number(playerId))?.display_name ?? `Player #${playerId}`;
  }

  function projectedFantasyPpg(playerId: number) {
    return projectedFantasyPpgByPlayer.get(playerId) ?? null;
  }

  function fantasyPointsForRow(row: LineupRow | undefined) {
    if (!row?.nhl_game_id) return null;
    return (
      fantasyPointsByGamePlayer.get(
        `${Number(row.nhl_game_id)}-${Number(row.nhl_player_id)}`
      ) ?? null
    );
  }

  function dateLabel(date: string) {
    const parsed = new Date(`${date}T12:00:00`);
    return new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    }).format(parsed);
  }

  function gameTime(value: string | null | undefined) {
    if (!value) return "Off Day";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "Game Scheduled";
    return new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
    }).format(parsed);
  }

  return (
    <main className="g365-nhl-my-team-page">
      <style>{baseStyles}</style>

      <section className="g365-nhl-my-team-shell">
        <section className="g365-nhl-team-name-bar">
          <div className="g365-nhl-team-name-copy">
            <p className="g365-nhl-small-label">YOUR NHL TEAM</p>
            <h1>{team.team_name ?? "My NHL Team"}</h1>
          </div>

          <NhlTraditionalTeamNameEditor
            leagueId={leagueId}
            fantasyTeamId={fantasyTeamId}
            currentTeamName={team.team_name ?? ""}
            renameAction={renameNhlFantasyTeamAction}
          />
        </section>

        <section className="g365-nhl-lineup-manager">
          <div className="g365-nhl-section-heading g365-nhl-lineup-heading">
            <div className="g365-nhl-section-title-block">
              <p className="g365-nhl-small-label">WEEK {activeWeek} LINEUP</p>
              <h2>My Lineup</h2>
            </div>
          </div>

          <p className="g365-nhl-lineup-help">
            Choose a day to view or edit that day's lineup. Start Weekly Lineup sets all seven
            days at once, prioritizing players with games and projected fantasy points while
            leaving locked players in place.
          </p>

          <div className="g365-nhl-week-tabs-shell">
            <div className="g365-nhl-week-tabs" role="tablist" aria-label={`Week ${activeWeek} lineup days`}>
              {weekDates.map((date, dateIndex) => {
                const dayRows = lineupRows.filter((row) => row.lineup_date === date);
                const dayBySpot = new Map(
                  dayRows.map((row) => [
                    `${String(row.lineup_slot ?? "").toUpperCase()}-${Number(row.slot_index ?? 1)}`,
                    row,
                  ])
                );

                const tableSpots = [
                  ...starterSpotDefinitions,
                  ...Array.from({ length: benchSlots }, (_, index) => ({
                    label: "BN",
                    slotIndex: index + 1,
                  })),
                ];

                return (
                  <div className="g365-nhl-week-tab-item" key={date}>
                    <input
                      className="g365-nhl-week-tab-radio"
                      type="radio"
                      name={`nhl-week-${activeWeek}-day`}
                      id={`nhl-week-${activeWeek}-day-${dateIndex}`}
                      defaultChecked={date === defaultDate}
                    />
                    <label
                      className="g365-nhl-week-tab"
                      htmlFor={`nhl-week-${activeWeek}-day-${dateIndex}`}
                      role="tab"
                    >
                      <span>{new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`)).toUpperCase()}</span>
                      <strong>{new Intl.DateTimeFormat("en-US", { month: "numeric", day: "numeric", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`))}</strong>
                    </label>

                    <div className="g365-nhl-week-tab-panel" role="tabpanel">
                      <div className="g365-nhl-selected-day-bar">
                        <strong>{dateLabel(date)}</strong>
                        <span>{dayRows.filter((row) => row.nhl_game_id != null).length} playing</span>
                      </div>

                      <div className="g365-nhl-lineup-table-wrap">
                        <table className="g365-nhl-lineup-table">
                          <thead>
                            <tr>
                              <th>POS</th>
                              <th>PLAYER</th>
                              <th>OPP / GAME</th>
                              <th>STATUS</th>
                              <th className="numeric">PROJ</th>
                              <th className="numeric">FPTS</th>
                              <th>ACTION</th>
                            </tr>
                          </thead>
                          <tbody>
                            {tableSpots.map((spot) => {
                              const row = dayBySpot.get(`${spot.label}-${spot.slotIndex}`);
                              return (
                                <NhlLineupTableRow
                                  key={`${date}-${spot.label}-${spot.slotIndex}`}
                                  label={spot.label}
                                  slotIndex={spot.slotIndex}
                                  row={row}
                                  player={row ? playerById.get(Number(row.nhl_player_id)) : undefined}
                                  projectionPpg={row ? projectedFantasyPpg(Number(row.nhl_player_id)) : null}
                                  fantasyPoints={fantasyPointsForRow(row)}
                                  leagueId={leagueId}
                                  fantasyTeamId={Number(fantasyTeamId)}
                                  lineupDate={date}
                                  targets={allMoveTargets}
                                  gameTimeLabel={gameTime(row?.game_start_at)}
                                />
                              );
                            })}

                            {Array.from({ length: irSlots }, (_, index) => {
                              const rosterRow = irRoster[index];
                              const player = rosterRow
                                ? playerById.get(Number(rosterRow.nhl_player_id))
                                : undefined;

                              return (
                                <NhlIrTableRow
                                  key={`${date}-IR-${index + 1}`}
                                  label="IR"
                                  slotIndex={index + 1}
                                  rosterRow={rosterRow}
                                  player={player}
                                  leagueId={leagueId}
                                  fantasyTeamId={Number(fantasyTeamId)}
                                />
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                );
              })}

              <form action={startActivePlayersAction} className="g365-nhl-start-weekly-form">
                <input type="hidden" name="leagueId" value={leagueId} />
                <input type="hidden" name="fantasyTeamId" value={fantasyTeamId} />
                <input type="hidden" name="season" value={season} />
                <input type="hidden" name="week" value={activeWeek} />
                <button type="submit" className="g365-nhl-start-weekly-button">
                  START WEEKLY LINEUP
                </button>
              </form>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}

function NhlLineupTableRow({
  label,
  slotIndex,
  row,
  player,
  projectionPpg,
  fantasyPoints,
  leagueId,
  fantasyTeamId,
  lineupDate,
  targets,
  gameTimeLabel,
}: {
  label: string;
  slotIndex: number;
  row: LineupRow | undefined;
  player: NhlPlayerStatusRow | undefined;
  projectionPpg: number | null;
  fantasyPoints: number | null;
  leagueId: string;
  fantasyTeamId: number;
  lineupDate: string;
  targets: Array<{ label: string; slotIndex: number }>;
  gameTimeLabel: string;
}) {
  const started =
    row?.game_start_at != null && new Date(row.game_start_at).getTime() <= Date.now();
  const locked = Boolean(row?.is_locked || started);
  const hasGame = row?.nhl_game_id != null;
  const positionText = player?.position ?? player?.position_group ?? "—";
  const jerseyText = player?.jersey_number ? `#${player.jersey_number}` : null;
  const injuryStatus = String(player?.injury_status ?? "").trim();

  return (
    <tr className={locked ? "g365-nhl-lineup-row locked" : "g365-nhl-lineup-row"}>
      <td className="pos-cell">
        <span className="g365-nhl-table-pos">{label}</span>
        <small>{slotIndex}</small>
      </td>

      <td className="player-cell">
        {row ? (
          <>
            <strong>{player?.display_name ?? `Player #${row.nhl_player_id}`}</strong>
            <small>
              {positionText}
              {jerseyText ? ` • ${jerseyText}` : ""}
            </small>
          </>
        ) : (
          <strong className="muted">Empty</strong>
        )}
      </td>

      <td className="game-cell">
        {row ? (
          <>
            <strong>{hasGame ? gameTimeLabel : "Off Day"}</strong>
            <small>{hasGame ? "NHL game scheduled" : "No game today"}</small>
          </>
        ) : (
          <span>—</span>
        )}
      </td>

      <td className="status-cell">
        {row ? (
          <span
            className={
              locked
                ? "g365-nhl-table-status locked"
                : hasGame
                  ? "g365-nhl-table-status playing"
                  : "g365-nhl-table-status"
            }
          >
            {locked ? "LOCKED" : hasGame ? "PLAYING" : injuryStatus || "OFF DAY"}
          </span>
        ) : (
          <span className="g365-nhl-table-status">EMPTY</span>
        )}
      </td>

      <td className="numeric proj-cell">
        {row && projectionPpg != null ? projectionPpg.toFixed(2) : "—"}
      </td>

      <td className="numeric fpts-cell">
        {row && fantasyPoints != null ? fantasyPoints.toFixed(2) : "—"}
      </td>

      <td className="action-cell">
        {row && !locked ? (
          <form action={moveLineupPlayerAction} className="g365-nhl-table-move-form">
            <input type="hidden" name="leagueId" value={leagueId} />
            <input type="hidden" name="fantasyTeamId" value={fantasyTeamId} />
            <input type="hidden" name="nhlPlayerId" value={row.nhl_player_id} />
            <input type="hidden" name="lineupDate" value={lineupDate} />
            <select
              name="target"
              defaultValue={`${String(row.lineup_slot ?? "BN").toUpperCase()}|${Number(row.slot_index ?? 1)}`}
              aria-label={`Move ${player?.display_name ?? "player"}`}
            >
              {targets.map((target) => (
                <option
                  key={`${target.label}-${target.slotIndex}`}
                  value={`${target.label}|${target.slotIndex}`}
                >
                  {target.label} {target.slotIndex}
                </option>
              ))}
            </select>
            <button type="submit">MOVE</button>
          </form>
        ) : row ? (
          <span className="g365-nhl-action-locked">LOCKED</span>
        ) : (
          <span>—</span>
        )}
      </td>
    </tr>
  );
}

function NhlIrTableRow({
  label,
  slotIndex,
  rosterRow,
  player,
  leagueId,
  fantasyTeamId,
}: {
  label: string;
  slotIndex: number;
  rosterRow: RosterRow | undefined;
  player: NhlPlayerStatusRow | undefined;
  leagueId: string;
  fantasyTeamId: number;
}) {
  return (
    <tr className="g365-nhl-lineup-row ir-row">
      <td className="pos-cell">
        <span className="g365-nhl-table-pos ir">{label}</span>
        <small>{slotIndex}</small>
      </td>
      <td className="player-cell">
        {rosterRow ? (
          <>
            <strong>{player?.display_name ?? `Player #${rosterRow.nhl_player_id}`}</strong>
            <small>{player?.position ?? player?.position_group ?? "—"}</small>
          </>
        ) : (
          <strong className="muted">Empty</strong>
        )}
      </td>
      <td className="game-cell"><span>—</span></td>
      <td className="status-cell">
        <span className="g365-nhl-table-status ir">
          {rosterRow ? player?.injury_status ?? "IR" : "EMPTY"}
        </span>
      </td>
      <td className="numeric">—</td>
      <td className="numeric">—</td>
      <td className="action-cell">
        {rosterRow ? (
          <form action={activatePlayerFromIrAction}>
            <input type="hidden" name="leagueId" value={leagueId} />
            <input type="hidden" name="fantasyTeamId" value={fantasyTeamId} />
            <input type="hidden" name="nhlPlayerId" value={rosterRow.nhl_player_id} />
            <button type="submit" className="g365-nhl-ir-activate">ACTIVATE</button>
          </form>
        ) : (
          <span>—</span>
        )}
      </td>
    </tr>
  );
}

function SummaryCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <Card>
      <div className="g365-nhl-summary-card">
        <span>
          {label}
        </span>

        <strong>
          {value}
        </strong>

        <small>
          {detail}
        </small>
      </div>
    </Card>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="g365-nhl-info-row">
      <span>
        {label}
      </span>

      <strong>
        {value}
      </strong>
    </div>
  );
}

const baseStyles = `
  .g365-nhl-my-team-page,
  .g365-nhl-my-team-page * {
    box-sizing: border-box;
  }

  .g365-nhl-my-team-page {
    min-height: calc(100vh - 140px);
    padding: 32px 18px 60px;
    color: #ffffff;
    background:
      radial-gradient(
        circle at 50% 0%,
        rgba(255, 72, 0, 0.07),
        transparent 35%
      );
  }

  .g365-nhl-my-team-shell {
    width: min(1240px, 100%);
    margin: 0 auto;
    display: grid;
    gap: 26px;
  }

  .g365-nhl-my-team-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
    flex-wrap: wrap;
  }

  .g365-nhl-eyebrow,
  .g365-nhl-small-label {
    margin: 0;
    color: #ff7a18;
    font-size: 9px;
    font-weight: 900;
    letter-spacing: 0.13em;
    line-height: 1.2;
  }

  .g365-nhl-page-title {
    margin: 7px 0 0;
    color: #ffffff;
    font-size: clamp(30px, 5vw, 42px);
    line-height: 1.05;
  }

  .g365-nhl-page-subtitle {
    margin: 8px 0 0;
    color: #9298a3;
    font-size: 13px;
    line-height: 1.4;
  }

  .g365-nhl-header-actions {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 9px;
    flex-wrap: wrap;
  }

  .g365-nhl-button {
    min-height: 42px;
    padding: 0 14px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 9px;
    font-size: 10px;
    font-weight: 900;
    line-height: 1;
    letter-spacing: 0.04em;
    text-align: center;
    text-decoration: none;
    text-transform: uppercase;
  }

  .g365-nhl-button-secondary {
    border: 1px solid rgba(255, 122, 24, 0.28);
    background: rgba(255, 90, 20, 0.06);
    color: #ff8a3d;
  }

  .g365-nhl-button-primary {
    border: 1px solid rgba(255, 92, 0, 0.55);
    background:
      linear-gradient(
        135deg,
        #d91d1d,
        #ff4b00,
        #ff7900
      );
    color: #ffffff;
  }

  .g365-nhl-team-hero {
    min-height: 150px;
    padding: 24px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 22px;
    border: 1px solid rgba(255, 101, 0, 0.18);
    border-radius: 14px;
    background:
      linear-gradient(
        135deg,
        rgba(207, 24, 24, 0.12),
        rgba(255, 76, 0, 0.055) 45%,
        rgba(8, 8, 8, 0.96)
      );
  }

  .g365-nhl-team-hero-content {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }

  .g365-nhl-team-hero h2 {
    margin: 7px 0 0;
    color: #ffffff;
    font-size: clamp(24px, 4vw, 34px);
    line-height: 1.1;
  }

  .g365-nhl-team-hero p:not(.g365-nhl-small-label) {
    margin: 8px 0 0;
    color: #8e949e;
    font-size: 11px;
    line-height: 1.4;
  }

  .g365-nhl-rank {
    width: 80px;
    min-width: 80px;
    height: 80px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 7px;
    border: 1px solid rgba(255, 123, 24, 0.2);
    border-radius: 12px;
    background: rgba(255, 92, 0, 0.05);
    text-align: center;
  }

  .g365-nhl-rank span {
    margin: 0;
    color: #858b95;
    font-size: 8px;
    font-weight: 900;
    line-height: 1;
    letter-spacing: 0.09em;
  }

  .g365-nhl-rank strong {
    margin: 0;
    color: #ffffff;
    font-size: 25px;
    line-height: 1;
  }

  .g365-nhl-summary-grid {
    display: grid;
    grid-template-columns:
      repeat(4, minmax(0, 1fr));
    gap: 14px;
    align-items: stretch;
  }

  .g365-nhl-summary-grid > * {
    min-width: 0;
    height: 100%;
  }

  .g365-nhl-summary-card {
    width: 100%;
    min-height: 120px;
    height: 100%;
    padding: 12px 8px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    text-align: center;
  }

  .g365-nhl-summary-card > span {
    margin: 0;
    color: #858b95;
    font-size: 9px;
    font-weight: 900;
    line-height: 1;
    letter-spacing: 0.1em;
    text-align: center;
  }

  .g365-nhl-summary-card > strong {
    margin: 0;
    color: #ffffff;
    font-size: 28px;
    font-weight: 900;
    line-height: 1;
    text-align: center;
  }

  .g365-nhl-summary-card > small {
    margin: 0;
    color: #858b95;
    font-size: 10px;
    line-height: 1.25;
    text-align: center;
  }

  .g365-nhl-content-grid {
    display: grid;
    grid-template-columns:
      minmax(0, 1.25fr)
      minmax(300px, 0.75fr);
    gap: 15px;
    align-items: stretch;
  }

  .g365-nhl-content-grid > * {
    min-width: 0;
    height: 100%;
  }

  .g365-nhl-card-content {
    width: 100%;
    min-width: 0;
    min-height: 100%;
    padding: 8px 4px;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
  }

  .g365-nhl-section-header {
    width: 100%;
    min-height: 64px;
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: 12px;
  }

  .g365-nhl-section-header .g365-nhl-section-title-block {
    grid-column: 2;
    min-width: 0;
    text-align: center;
  }

  .g365-nhl-section-header > .g365-nhl-pill {
    grid-column: 3;
    justify-self: end;
  }

  .g365-nhl-section-header-centered {
    grid-template-columns: 1fr;
  }

  .g365-nhl-section-header-centered .g365-nhl-section-title-block {
    grid-column: 1;
    justify-self: center;
  }

  .g365-nhl-section-title-block {
    min-width: 0;
    text-align: center;
  }

  .g365-nhl-section-title-block .g365-nhl-small-label {
    text-align: center;
  }

  .g365-nhl-section-header h2,
  .g365-nhl-section-heading h2 {
    margin: 6px 0 0;
    color: #ffffff;
    font-size: 20px;
    line-height: 1.15;
    text-align: center;
  }

  .g365-nhl-section-heading {
    min-height: 60px;
    margin-bottom: 13px;
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: 12px;
  }

  .g365-nhl-section-heading .g365-nhl-section-title-block {
    grid-column: 2;
  }

  .g365-nhl-section-heading > .g365-nhl-pill {
    grid-column: 3;
    justify-self: end;
  }

  .g365-nhl-pill {
    min-height: 28px;
    padding: 0 9px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid rgba(255, 119, 0, 0.18);
    border-radius: 7px;
    background: rgba(255, 119, 0, 0.06);
    color: #ff8a20;
    font-size: 8px;
    font-weight: 900;
    line-height: 1;
    letter-spacing: 0.07em;
    text-align: center;
  }

  .g365-nhl-slot-grid {
    width: 100%;
    margin-top: 18px;
    display: grid;
    grid-template-columns:
      repeat(auto-fit, minmax(80px, 1fr));
    gap: 8px;
  }

  .g365-nhl-slot {
    width: 100%;
    min-width: 0;
    min-height: 78px;
    padding: 10px 6px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    border: 1px solid rgba(255, 255, 255, 0.065);
    border-radius: 9px;
    background: rgba(255, 255, 255, 0.018);
    text-align: center;
  }

  .g365-nhl-slot span {
    margin: 0;
    color: #ff7a18;
    font-size: 9px;
    font-weight: 900;
    line-height: 1;
    text-align: center;
  }

  .g365-nhl-slot strong {
    margin: 0;
    color: #ffffff;
    font-size: 22px;
    font-weight: 900;
    line-height: 1;
    text-align: center;
  }

  .g365-nhl-info-list {
    width: 100%;
    margin-top: 18px;
    display: grid;
  }

  .g365-nhl-info-row {
    width: 100%;
    min-height: 46px;
    padding: 8px 10px;
    display: grid;
    grid-template-columns:
      minmax(0, 1fr)
      minmax(90px, 1fr);
    align-items: center;
    gap: 16px;
    border-bottom:
      1px solid rgba(255, 255, 255, 0.055);
    color: #898f99;
    font-size: 10px;
    line-height: 1.25;
  }

  .g365-nhl-info-row > span {
    display: flex;
    align-items: center;
    min-height: 28px;
  }

  .g365-nhl-info-row > strong {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    min-height: 28px;
    color: #ffffff;
    text-align: right;
  }

  .g365-nhl-roster-spots-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(145px, 1fr));
    gap: 10px;
  }

  .g365-nhl-roster-spot {
    min-height: 86px;
    padding: 12px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 9px;
    border: 1px solid rgba(255, 119, 0, 0.18);
    border-radius: 10px;
    background: rgba(255, 92, 0, 0.045);
    text-align: center;
  }

  .g365-nhl-roster-spot-ir {
    border-color: rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.025);
  }

  .g365-nhl-roster-spot span {
    color: #ff7a18;
    font-size: 9px;
    font-weight: 900;
    letter-spacing: 0.08em;
  }

  .g365-nhl-roster-spot strong {
    color: #ffffff;
    font-size: 12px;
    line-height: 1.25;
  }

  .g365-nhl-player-actions {
    margin-top: 14px;
    display: flex;
    justify-content: center;
  }

  .g365-nhl-player-actions form {
    width: 100%;
  }

  .g365-nhl-roster-action {
    width: 100%;
    min-height: 42px;
    padding: 0 14px;
    border: 1px solid rgba(255, 92, 0, 0.55);
    border-radius: 9px;
    background: linear-gradient(135deg, #d91d1d, #ff4b00, #ff7900);
    color: #ffffff;
    font-size: 10px;
    font-weight: 900;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    cursor: pointer;
  }

  .g365-nhl-roster-action-activate {
    border-color: rgba(255, 122, 24, 0.28);
    background: rgba(255, 90, 20, 0.08);
    color: #ff8a3d;
  }

  .g365-nhl-roster-grid {
    display: grid;
    grid-template-columns:
      repeat(auto-fit, minmax(290px, 1fr));
    gap: 14px;
    align-items: stretch;
  }

  .g365-nhl-roster-grid > * {
    height: 100%;
  }

  .g365-nhl-player-card {
    width: 100%;
    min-width: 0;
    height: 100%;
    padding: 8px 4px;
  }

  .g365-nhl-player-top {
    min-height: 72px;
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: 12px;
  }

  .g365-nhl-player-heading {
    grid-column: 2;
    min-width: 0;
    text-align: center;
  }

  .g365-nhl-player-top > .g365-nhl-lock {
    grid-column: 3;
    justify-self: end;
  }

  .g365-nhl-player-top h3 {
    margin: 8px 0 0;
    color: #ffffff;
    font-size: 18px;
    line-height: 1.2;
    text-align: center;
  }

  .g365-nhl-status,
  .g365-nhl-lock {
    min-height: 24px;
    padding: 0 8px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 5px;
    background: rgba(255, 92, 0, 0.1);
    color: #ff7a18;
    font-size: 8px;
    font-weight: 900;
    line-height: 1;
    letter-spacing: 0.07em;
    text-align: center;
  }

  .g365-nhl-status-ir {
    background: rgba(255, 255, 255, 0.07);
    color: #a7adb6;
  }

  .g365-nhl-lock {
    background: rgba(255, 255, 255, 0.06);
    color: #9ba1aa;
  }

  .g365-nhl-empty {
    width: 100%;
    min-height: 200px;
    padding: 24px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    text-align: center;
  }

  .g365-nhl-empty h1,
  .g365-nhl-empty strong {
    margin: 0;
    color: #ffffff;
    text-align: center;
  }

  .g365-nhl-empty p {
    max-width: 550px;
    margin: 0;
    color: #858b95;
    font-size: 11px;
    line-height: 1.6;
    text-align: center;
  }


  .g365-nhl-team-name-bar {
    width: 100%;
    padding: 18px 20px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    border: 1px solid rgba(255, 101, 0, 0.18);
    border-radius: 12px;
    background:
      linear-gradient(
        135deg,
        rgba(207, 24, 24, 0.10),
        rgba(255, 76, 0, 0.04) 48%,
        rgba(8, 8, 8, 0.96)
      );
  }

  .g365-nhl-team-name-copy {
    min-width: 0;
  }

  .g365-nhl-team-name-copy h1 {
    margin: 5px 0 0;
    color: #ffffff;
    font-size: clamp(24px, 4vw, 34px);
    line-height: 1.05;
    overflow-wrap: anywhere;
  }

  .g365-nhl-team-name-editor {
    position: relative;
    flex: 0 0 auto;
  }

  .g365-nhl-team-name-editor > summary {
    min-height: 38px;
    padding: 0 13px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid rgba(255, 119, 0, 0.35);
    border-radius: 8px;
    background: rgba(255, 92, 0, 0.07);
    color: #ff8a20;
    cursor: pointer;
    list-style: none;
    font-size: 9px;
    font-weight: 900;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }

  .g365-nhl-team-name-editor > summary::-webkit-details-marker {
    display: none;
  }

  .g365-nhl-team-name-editor[open] > summary {
    border-color: rgba(255, 119, 0, 0.7);
    color: #ffffff;
  }

  .g365-nhl-team-name-editor form {
    position: absolute;
    z-index: 20;
    top: calc(100% + 8px);
    right: 0;
    width: min(330px, calc(100vw - 56px));
    padding: 10px;
    display: flex;
    gap: 8px;
    border: 1px solid rgba(255, 119, 0, 0.28);
    border-radius: 10px;
    background: #111214;
    box-shadow: 0 16px 36px rgba(0, 0, 0, 0.48);
  }

  .g365-nhl-team-name-editor input {
    min-width: 0;
    flex: 1;
    height: 38px;
    padding: 0 10px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 7px;
    outline: none;
    background: #090a0b;
    color: #ffffff;
    font: inherit;
    font-size: 12px;
  }

  .g365-nhl-team-name-editor input:focus {
    border-color: rgba(255, 119, 0, 0.65);
  }

  .g365-nhl-team-name-editor button {
    min-height: 38px;
    padding: 0 13px;
    border: 1px solid rgba(255, 92, 0, 0.55);
    border-radius: 7px;
    background: linear-gradient(135deg, #d91d1d, #ff4b00, #ff7900);
    color: #ffffff;
    cursor: pointer;
    font-size: 9px;
    font-weight: 900;
  }

  .g365-nhl-lineup-manager {
    min-width: 0;
  }

  .g365-nhl-start-active-form {
    grid-column: 3;
    justify-self: end;
  }

  .g365-nhl-start-active-button {
    min-height: 44px;
    padding: 0 16px;
    border: 1px solid rgba(255, 92, 0, 0.7);
    border-radius: 9px;
    background: linear-gradient(135deg, #d91d1d, #ff4b00, #ff7900);
    color: #fff;
    font-size: 10px;
    font-weight: 900;
    letter-spacing: .05em;
    cursor: pointer;
  }

  .g365-nhl-lineup-help {
    margin: -4px auto 14px;
    max-width: 760px;
    color: #8d939d;
    font-size: 11px;
    line-height: 1.55;
    text-align: center;
  }

  .g365-nhl-lineup-heading {
    display: flex;
    justify-content: center;
  }

  .g365-nhl-week-tabs-shell {
    width: 100%;
    overflow-x: auto;
    padding-bottom: 3px;
    scrollbar-width: thin;
  }

  .g365-nhl-week-tabs {
    min-width: 840px;
    display: grid;
    grid-template-columns: repeat(7, minmax(86px, 1fr)) minmax(160px, 1.45fr);
    grid-template-rows: auto auto;
    gap: 8px;
    align-items: stretch;
  }

  .g365-nhl-week-tab-item {
    display: contents;
  }

  .g365-nhl-week-tab-radio {
    position: absolute;
    width: 1px;
    height: 1px;
    opacity: 0;
    pointer-events: none;
  }

  .g365-nhl-week-tab {
    min-height: 54px;
    padding: 8px 10px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 5px;
    border: 1px solid rgba(255, 119, 0, .18);
    border-radius: 9px;
    background: rgba(255, 255, 255, .025);
    color: #9298a3;
    cursor: pointer;
    user-select: none;
    transition: border-color .15s ease, background .15s ease, color .15s ease;
  }

  .g365-nhl-week-tab span {
    font-size: 9px;
    font-weight: 900;
    letter-spacing: .08em;
  }

  .g365-nhl-week-tab strong {
    color: #fff;
    font-size: 13px;
    line-height: 1;
  }

  .g365-nhl-week-tab-radio:focus-visible + .g365-nhl-week-tab {
    outline: 2px solid #ff7a18;
    outline-offset: 2px;
  }

  .g365-nhl-week-tab-radio:checked + .g365-nhl-week-tab {
    border-color: rgba(255, 92, 0, .7);
    background: linear-gradient(135deg, rgba(217, 29, 29, .26), rgba(255, 75, 0, .18));
    color: #ff8a3d;
  }

  .g365-nhl-start-weekly-form {
    grid-column: 8;
    grid-row: 1;
    min-width: 0;
  }

  .g365-nhl-start-weekly-button {
    width: 100%;
    min-height: 54px;
    height: 100%;
    padding: 8px 14px;
    border: 1px solid rgba(255, 92, 0, .62);
    border-radius: 9px;
    background: linear-gradient(135deg, #d91d1d, #ff4b00, #ff7900);
    color: #fff;
    font-size: 9px;
    font-weight: 900;
    line-height: 1.2;
    letter-spacing: .045em;
    text-transform: uppercase;
    cursor: pointer;
  }

  .g365-nhl-week-tab-panel {
    display: none;
    grid-column: 1 / -1;
    grid-row: 2;
    min-width: 0;
    padding-top: 4px;
  }

  .g365-nhl-week-tab-radio:checked ~ .g365-nhl-week-tab-panel {
    display: block;
  }

  .g365-nhl-selected-day-bar {
    min-height: 42px;
    padding: 8px 12px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    border: 1px solid rgba(255, 119, 0, .14);
    border-bottom: 0;
    border-radius: 10px 10px 0 0;
    background: rgba(255, 92, 0, .04);
  }

  .g365-nhl-selected-day-bar strong {
    color: #fff;
    font-size: 11px;
  }

  .g365-nhl-selected-day-bar span {
    color: #ff8a3d;
    font-size: 9px;
    font-weight: 900;
    text-transform: uppercase;
  }

  .g365-nhl-lineup-table-wrap { width:100%; overflow-x:auto; border:1px solid rgba(255,119,0,.14); border-radius:10px; background:rgba(0,0,0,.22); }
  .g365-nhl-lineup-table { width:100%; min-width:900px; border-collapse:collapse; }
  .g365-nhl-lineup-table th { padding:11px 10px; border-bottom:1px solid rgba(255,119,0,.18); color:#ff8a3d; font-size:8px; font-weight:900; letter-spacing:.08em; text-align:left; white-space:nowrap; }
  .g365-nhl-lineup-table th.numeric, .g365-nhl-lineup-table td.numeric { text-align:right; }
  .g365-nhl-lineup-row td { padding:11px 10px; border-bottom:1px solid rgba(255,255,255,.055); vertical-align:middle; }
  .g365-nhl-lineup-row:last-child td { border-bottom:0; }
  .g365-nhl-lineup-row.locked { background:rgba(255,255,255,.018); }
  .g365-nhl-lineup-row.ir-row { background:rgba(255,255,255,.012); }
  .pos-cell { width:64px; }
  .g365-nhl-table-pos { min-width:38px; min-height:26px; padding:0 7px; display:inline-flex; align-items:center; justify-content:center; border:1px solid rgba(255,92,0,.35); border-radius:6px; background:rgba(255,92,0,.08); color:#ff7a18; font-size:9px; font-weight:900; }
  .g365-nhl-table-pos.ir { border-color:rgba(255,255,255,.1); background:rgba(255,255,255,.04); color:#a7adb6; }
  .pos-cell small { margin-left:5px; color:#737983; font-size:8px; }
  .player-cell { min-width:180px; }
  .player-cell strong, .game-cell strong { display:block; color:#fff; font-size:11px; line-height:1.25; }
  .player-cell strong.muted { color:#6f747c; }
  .player-cell small, .game-cell small { display:block; margin-top:4px; color:#858b95; font-size:8px; line-height:1.25; }
  .game-cell { min-width:145px; }
  .game-cell > span { color:#858b95; font-size:9px; }
  .g365-nhl-table-status { min-height:25px; padding:0 7px; display:inline-flex; align-items:center; justify-content:center; border-radius:5px; background:rgba(255,255,255,.05); color:#9ba1aa; font-size:7px; font-weight:900; letter-spacing:.05em; white-space:nowrap; }
  .g365-nhl-table-status.playing { background:rgba(255,92,0,.1); color:#ff8a3d; }
  .g365-nhl-table-status.locked { background:rgba(255,255,255,.07); color:#c0c4ca; }
  .g365-nhl-table-status.ir { background:rgba(255,255,255,.05); color:#a7adb6; }
  .proj-cell, .fpts-cell { width:72px; color:#fff; font-size:11px; font-weight:900; }
  .fpts-cell { color:#ff9a50; }
  .action-cell { min-width:190px; }
  .g365-nhl-table-move-form { display:flex; align-items:center; justify-content:flex-end; gap:6px; }
  .g365-nhl-table-move-form select { min-height:34px; max-width:92px; padding:0 7px; border:1px solid rgba(255,119,0,.18); border-radius:6px; background:#111; color:#fff; font-size:8px; font-weight:800; }
  .g365-nhl-table-move-form button, .g365-nhl-ir-activate { min-height:34px; padding:0 10px; border:1px solid rgba(255,92,0,.5); border-radius:6px; background:linear-gradient(135deg,#d91d1d,#ff4b00,#ff7900); color:#fff; font-size:8px; font-weight:900; cursor:pointer; }
  .g365-nhl-action-locked { color:#858b95; font-size:8px; font-weight:900; }
  @media (max-width: 900px) {
    .g365-nhl-summary-grid {
      grid-template-columns:
        repeat(2, minmax(0, 1fr));
    }

    .g365-nhl-content-grid {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 760px) {
    .g365-nhl-my-team-page {
      width: 100%;
      max-width: 100%;
      min-width: 0;
      padding: 18px 10px 44px;
      overflow-x: hidden;
    }

    .g365-nhl-mobile-redundant-nav {
      display: none !important;
    }

    .g365-nhl-my-team-page *,
    .g365-nhl-my-team-shell,
    .g365-nhl-my-team-shell > * {
      min-width: 0;
      max-width: 100%;
    }

    .g365-nhl-my-team-shell {
      width: 100%;
      min-width: 0;
    }

    .g365-nhl-my-team-header {
      display: grid;
      grid-template-columns: 1fr;
      align-items: stretch;
    }

    .g365-nhl-my-team-header > div:first-child {
      text-align: center;
    }

    .g365-nhl-header-actions {
      width: 100%;
    }

    .g365-nhl-team-hero {
      align-items: center;
    }

    .g365-nhl-roster-grid {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 760px) {
    .g365-nhl-lineup-table-wrap { overflow-x:visible; border:0; background:transparent; }
    .g365-nhl-lineup-table { min-width:0; display:block; }
    .g365-nhl-lineup-table thead { display:none; }
    .g365-nhl-lineup-table tbody { display:grid; gap:8px; }
    .g365-nhl-lineup-row { display:grid; grid-template-columns:54px minmax(0,1fr) auto; gap:8px 10px; padding:11px; border:1px solid rgba(255,255,255,.07); border-radius:9px; background:rgba(0,0,0,.28); }
    .g365-nhl-lineup-row td { padding:0; border:0; min-width:0; width:auto; }
    .g365-nhl-lineup-row .pos-cell { grid-row:1 / span 3; align-self:start; }
    .g365-nhl-lineup-row .player-cell { grid-column:2; grid-row:1; }
    .g365-nhl-lineup-row .status-cell { grid-column:3; grid-row:1; text-align:right; }
    .g365-nhl-lineup-row .game-cell { grid-column:2 / 4; grid-row:2; }
    .g365-nhl-lineup-row .proj-cell { grid-column:2; grid-row:3; text-align:left; }
    .g365-nhl-lineup-row .proj-cell::before { content:'PROJ '; color:#858b95; font-size:7px; margin-right:4px; }
    .g365-nhl-lineup-row .fpts-cell { grid-column:3; grid-row:3; text-align:right; }
    .g365-nhl-lineup-row .fpts-cell::before { content:'FPTS '; color:#858b95; font-size:7px; margin-right:4px; }
    .g365-nhl-lineup-row .action-cell { grid-column:2 / 4; grid-row:4; }
    .g365-nhl-table-move-form { justify-content:stretch; }
    .g365-nhl-table-move-form select { flex:1; max-width:none; }
    .g365-nhl-table-move-form button, .g365-nhl-ir-activate { min-height:38px; }
  }

  @media (max-width: 520px) {
    .g365-nhl-summary-grid {
      grid-template-columns: 1fr;
    }

    .g365-nhl-header-actions {
      display: grid;
      grid-template-columns: 1fr;
    }

    .g365-nhl-header-actions a {
      width: 100%;
      min-height: 44px;
    }

    .g365-nhl-team-hero {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
    }

    .g365-nhl-team-hero-content {
      align-items: center;
      text-align: center;
    }

    .g365-nhl-rank {
      width: 82px;
      min-width: 82px;
    }

    .g365-nhl-section-header,
    .g365-nhl-section-heading {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 10px;
      text-align: center;
    }

    .g365-nhl-section-header .g365-nhl-section-title-block,
    .g365-nhl-section-heading .g365-nhl-section-title-block {
      width: 100%;
    }

    .g365-nhl-section-header > .g365-nhl-pill,
    .g365-nhl-section-heading > .g365-nhl-pill,
    .g365-nhl-start-active-form {
      align-self: center;
    }

    .g365-nhl-start-active-form,
    .g365-nhl-start-active-button {
      width: 100%;
    }

    .g365-nhl-day-starters {
      grid-template-columns: 1fr;
    }

    .g365-nhl-slot-grid {
      grid-template-columns:
        repeat(2, minmax(0, 1fr));
    }

    .g365-nhl-info-row {
      grid-template-columns:
        minmax(0, 1fr)
        minmax(0, 1fr);
      padding: 10px 6px;
    }

    .g365-nhl-player-top {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 10px;
    }

    .g365-nhl-player-heading {
      text-align: center;
    }
  }

  @media (max-width: 360px) {
    .g365-nhl-slot-grid {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 640px) {
    .g365-nhl-team-name-bar {
      padding: 14px;
      align-items: flex-start;
    }

    .g365-nhl-team-name-copy h1 {
      font-size: 24px;
    }

    .g365-nhl-team-name-editor > summary {
      min-height: 36px;
      padding: 0 10px;
    }

    .g365-nhl-team-name-editor form {
      right: 0;
      width: min(310px, calc(100vw - 46px));
      flex-direction: column;
    }

    .g365-nhl-team-name-editor button {
      width: 100%;
    }
  }
`;