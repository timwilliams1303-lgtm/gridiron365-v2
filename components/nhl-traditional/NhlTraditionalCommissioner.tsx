"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";
import NhlDynastyLotteryTest from "@/components/nhl-traditional/NhlDynastyLotteryTest";

type Tab =
  | "overview"
  | "league"
  | "teams"
  | "draft"
  | "matchups"
  | "roster"
  | "scoring";

type League = {
  id: string;
  name: string;
  season: number;
  status: string;
  league_type: string;
};

type NhlSettings = {
  league_id: string;
  season: number;
  league_format: "redraft" | "dynasty";
  position_mode: "detailed" | "fdg";
  scoring_system: "points" | "categories";
  goalie_minimum_starts: number;
  competition_format: string;
  lineup_period: string;
  allow_daily_lineup_changes: boolean;
  player_lock_mode: "individual_game";
  max_teams: number;
  regular_season_weeks: number;
  playoff_team_count: number;
  playoff_weeks: number;
  trade_deadline_at: string | null;
  trade_deadline_week: number | null;
  waiver_mode: "rolling" | "reverse_standings" | "faab";
  faab_budget: number | null;
  dynasty_rookie_rounds: number;
  dynasty_future_pick_years: number;
  dynasty_rosters_carry_over: boolean;
};

type RosterSettings = {
  league_id: string;
  starting_c: number;
  starting_lw: number;
  starting_rw: number;
  starting_f: number;
  starting_d: number;
  starting_g: number;
  starting_util: number;
  bench_slots: number;
  ir_slots: number;
  max_c: number | null;
  max_lw: number | null;
  max_rw: number | null;
  max_f: number | null;
  max_d: number | null;
  max_g: number | null;
};

type SeasonState = {
  active_week: number;
  phase: string;
};

type ScoringRule = {
  id: number;
  stat_key: string;
  points: number | string;
  enabled: boolean;
};

type CategoryRule = {
  id: number;
  stat_key: string;
  enabled: boolean;
  direction: "higher" | "lower";
};

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const scoringGroups = [
  { title: "SKATER - OFFENSE", keys: ["goal","assist","total_point","shot_on_goal","shooting_percentage","game_winning_goal","two_goal_game","hat_trick","two_point_game","three_point_game","five_shot_game"] },
  { title: "SPECIAL TEAMS", keys: ["power_play_goal","power_play_assist","power_play_point","short_handed_goal","short_handed_assist","short_handed_point","two_power_play_point_game"] },
  { title: "PHYSICAL / DEFENSIVE", keys: ["plus_minus","penalty_minute","hit","blocked_shot","takeaway","giveaway","three_block_game","five_hit_game"] },
  { title: "FACEOFFS & USAGE", keys: ["faceoff_win","faceoff_loss","faceoff_percentage","total_faceoff","shift","time_on_ice"] },
  { title: "GOALTENDING", keys: ["goalie_start","goalie_win","goalie_loss","goalie_overtime_loss","goalie_save","shot_against","goal_against","save_percentage","goals_against_average","shutout","goalie_minutes","goalie_win_percentage","quality_start","quality_start_percentage","goalie_30_save_game","goalie_40_save_game","shutout_win"] },
] as const;

const scoringLabels: Record<string, string> = {
  goal:"Goals", assist:"Assists", total_point:"Total Points", shot_on_goal:"Shots on Goal", shooting_percentage:"Shooting Percentage", game_winning_goal:"Game-Winning Goals",
  power_play_goal:"Power-Play Goals", power_play_assist:"Power-Play Assists", power_play_point:"Power-Play Points", short_handed_goal:"Short-Handed Goals", short_handed_assist:"Short-Handed Assists", short_handed_point:"Short-Handed Points",
  plus_minus:"Plus / Minus", penalty_minute:"Penalty Minutes", hit:"Hits", blocked_shot:"Blocked Shots", takeaway:"Takeaways", giveaway:"Giveaways",
  faceoff_win:"Faceoff Wins", faceoff_loss:"Faceoff Losses", faceoff_percentage:"Faceoff Win Percentage", total_faceoff:"Total Faceoffs", shift:"Shifts", time_on_ice:"Time on Ice",
  goalie_start:"Goalie Starts", goalie_win:"Goalie Wins", goalie_loss:"Goalie Losses", goalie_overtime_loss:"Overtime Losses", goalie_save:"Saves", shot_against:"Shots Against", goal_against:"Goals Against",
  save_percentage:"Save Percentage", goals_against_average:"Goals-Against Average", shutout:"Shutouts", goalie_minutes:"Goalie Minutes Played", goalie_win_percentage:"Goalie Win Percentage",
  quality_start:"G365 Quality Starts", quality_start_percentage:"Quality Start Percentage",
  two_goal_game:"2+ Goal Game", hat_trick:"Hat Trick", two_point_game:"2+ Point Game", three_point_game:"3+ Point Game", five_shot_game:"5+ Shots on Goal",
  three_block_game:"3+ Blocked Shots", five_hit_game:"5+ Hits", two_power_play_point_game:"2+ Power-Play Points", goalie_30_save_game:"30+ Saves", goalie_40_save_game:"40+ Saves", shutout_win:"Shutout Win",
};

const scoringOrder = scoringGroups.flatMap((group) => [...group.keys]);

// Categories use the exact same master option list as Points.
const categoryGroups = scoringGroups;
const categoryLabels = scoringLabels;

function n(value: string | number | null | undefined, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function nullableNumber(value: string) {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function pretty(value?: string | null) {
  return value
    ? value.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase())
    : "—";
}

function localDate(value: string | null) {
  if (!value) return "";
  const d = new Date(value);
  const shifted = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return shifted.toISOString().slice(0, 16);
}

function Section(props: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section style={styles.section}>
      <div style={styles.sectionHead}>
        <h2 style={styles.sectionTitle}>{props.title}</h2>
        {props.subtitle ? <p style={styles.sectionSub}>{props.subtitle}</p> : null}
      </div>
      {props.children}
    </section>
  );
}

function Button(props: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  secondary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      style={{
        ...styles.button,
        ...(props.secondary ? styles.secondaryButton : {}),
        ...(props.disabled ? styles.disabled : {}),
      }}
    >
      {props.children}
    </button>
  );
}

function NumberInput(props: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  min?: number;
  max?: number;
  allowBlank?: boolean;
}) {
  return (
    <label style={styles.field}>
      <span style={styles.fieldLabel}>{props.label}</span>
      <input
        type="number"
        min={props.min}
        max={props.max}
        value={props.value ?? ""}
        onChange={(e) =>
          props.onChange(
            props.allowBlank ? nullableNumber(e.target.value) : n(e.target.value)
          )
        }
        style={styles.input}
      />
    </label>
  );
}

function SelectField(props: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label style={styles.field}>
      <span style={styles.fieldLabel}>{props.label}</span>
      <select value={props.value} onChange={(e) => props.onChange(e.target.value)} style={styles.input}>
        {props.children}
      </select>
    </label>
  );
}

function Toggle(props: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label style={styles.field}>
      <span style={styles.fieldLabel}>{props.label}</span>
      <button
        type="button"
        onClick={() => props.onChange(!props.value)}
        style={{ ...styles.toggle, ...(props.value ? styles.toggleOn : {}) }}
      >
        {props.value ? "ENABLED" : "DISABLED"}
      </button>
    </label>
  );
}

function Stat(props: { label: string; value: string | number }) {
  return (
    <div style={styles.stat}>
      <span style={styles.statLabel}>{props.label}</span>
      <strong style={styles.statValue}>{props.value}</strong>
    </div>
  );
}



type FantasyTeam = {
  id: number;
  owner_id: string | null;
  team_name: string;
  active: boolean;
  is_cpu: boolean;
  cpu_auto_draft: boolean;
};

type LeagueMember = {
  user_id: string;
  role: string;
};



type DraftState = {
  exists: boolean;
  draftId?: string;
  status?: string;
  rounds?: number;
  secondsPerPick?: number;
  pickCount?: number;
  totalPicks?: number;
};

type DraftTeam = {
  id: number;
  draft_id: string;
  fantasy_team_id: number;
  draft_slot: number;
  is_cpu: boolean;
};

type MatchupRow = {
  id: number;
  week: number;
  home_fantasy_team_id: number;
  away_fantasy_team_id: number;
  home_score: number | string | null;
  away_score: number | string | null;
  status: string | null;
  winner_fantasy_team_id: number | null;
  is_tie: boolean | null;
};

type ManualMatchupPair = {
  home_team_id: number | null;
  away_team_id: number | null;
};

type Props = { leagueId: string };

export default function NhlTraditionalCommissioner({ leagueId }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [league, setLeague] = useState<League | null>(null);
  const [settings, setSettings] = useState<NhlSettings | null>(null);
  const [roster, setRoster] = useState<RosterSettings | null>(null);
  const [seasonState, setSeasonState] = useState<SeasonState | null>(null);
  const [scoringRules, setScoringRules] = useState<ScoringRule[]>([]);
  const [categoryRules, setCategoryRules] = useState<CategoryRule[]>([]);
  const [activeTeams, setActiveTeams] = useState(0);
  const [teams, setTeams] = useState<FantasyTeam[]>([]);
  const [members, setMembers] = useState<LeagueMember[]>([]);
  const [teamNames, setTeamNames] = useState<Record<number, string>>({});
  const [inviteTeamId, setInviteTeamId] = useState<number | null>(null);
  const [inviteFirstName, setInviteFirstName] = useState("");
  const [inviteLastName, setInviteLastName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [draftState, setDraftState] = useState<DraftState | null>(null);
  const [draftTeams, setDraftTeams] = useState<DraftTeam[]>([]);
  const [draftOrder, setDraftOrder] = useState<number[]>([]);
  const [matchups, setMatchups] = useState<MatchupRow[]>([]);
  const [matchupWeek, setMatchupWeek] = useState(1);
  const [manualMatchups, setManualMatchups] = useState<ManualMatchupPair[]>([]);
  const [draftTimerSeconds, setDraftTimerSeconds] = useState(90);

  const load = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError(null);

    const auth = await supabase.rpc("is_nhl_traditional_commissioner", {
      p_league_id: leagueId,
    });

    if (auth.error) {
      setError(auth.error.message);
      setLoading(false);
      return;
    }

    if (auth.data !== true) {
      setAuthorized(false);
      setLoading(false);
      return;
    }

    setAuthorized(true);

    const results = await Promise.all([
      supabase.from("leagues").select("id,name,season,status,league_type").eq("id", leagueId).single(),
      supabase.from("nhl_traditional_settings").select("*").eq("league_id", leagueId).single(),
      supabase.from("nhl_traditional_roster_settings").select("*").eq("league_id", leagueId).single(),
      supabase.from("nhl_traditional_season_state").select("active_week,phase").eq("league_id", leagueId).order("season", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("nhl_traditional_scoring_rules").select("id,stat_key,points,enabled").eq("league_id", leagueId),
      supabase.from("nhl_traditional_category_rules").select("id,stat_key,enabled,direction").eq("league_id", leagueId),
      supabase.from("fantasy_teams").select("id,owner_id,team_name,active,is_cpu,cpu_auto_draft").eq("league_id", leagueId).order("id"),
      supabase.from("league_members").select("user_id,role").eq("league_id", leagueId),
      supabase.rpc("get_nhl_traditional_draft_state", { p_league_id: leagueId }),
      supabase
        .from("nhl_traditional_matchups")
        .select("id,week,home_fantasy_team_id,away_fantasy_team_id,home_score,away_score,status,winner_fantasy_team_id,is_tie")
        .eq("league_id", leagueId)
        .order("week", { ascending: true })
        .order("id", { ascending: true }),
    ]);

    const failed = results.find((result) => result.error);
    if (failed?.error) {
      setError(failed.error.message);
      setLoading(false);
      return;
    }

    setLeague(results[0].data as League);
    setSettings(results[1].data as NhlSettings);
    setRoster(results[2].data as RosterSettings);
    setSeasonState(results[3].data as SeasonState | null);

    const rules = (results[4].data ?? []) as ScoringRule[];
    rules.sort(
      (a, b) =>
        (scoringOrder as readonly string[]).indexOf(a.stat_key) -
        (scoringOrder as readonly string[]).indexOf(b.stat_key)
    );
    setScoringRules(rules);
    setCategoryRules((results[5].data ?? []) as CategoryRule[]);
    const teamRows = (results[6].data ?? []) as FantasyTeam[];
    setTeams(teamRows);
    setMembers((results[7].data ?? []) as LeagueMember[]);

    const nextDraftState = (results[8].data ?? null) as DraftState | null;
    setDraftState(nextDraftState);
    setDraftTimerSeconds(Number(nextDraftState?.secondsPerPick ?? 90));
    setMatchups((results[9].data ?? []) as MatchupRow[]);

    if (nextDraftState?.exists && nextDraftState.draftId) {
      const draftTeamsResult = await supabase
        .from("nhl_traditional_draft_teams")
        .select("id,draft_id,fantasy_team_id,draft_slot,is_cpu")
        .eq("draft_id", nextDraftState.draftId)
        .order("draft_slot", { ascending: true });

      if (draftTeamsResult.error) {
        setError(draftTeamsResult.error.message);
        setLoading(false);
        return;
      }

      const nextDraftTeams = (draftTeamsResult.data ?? []) as DraftTeam[];
      setDraftTeams(nextDraftTeams);
      setDraftOrder(nextDraftTeams.map((row) => row.fantasy_team_id));
    } else {
      setDraftTeams([]);
      setDraftOrder([]);
    }

    setActiveTeams(teamRows.filter((team) => team.active).length);
    setTeamNames(Object.fromEntries(teamRows.map((team) => [team.id, team.team_name])));
    setLoading(false);
  }, [leagueId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!settings) return;

    const weekRows = matchups
      .filter((row) => row.week === matchupWeek)
      .sort((a, b) => a.id - b.id);

    if (weekRows.length) {
      setManualMatchups(
        weekRows.map((row) => ({
          home_team_id: row.home_fantasy_team_id,
          away_team_id: row.away_fantasy_team_id,
        }))
      );
      return;
    }

    const active = teams.filter((team) => team.active).slice(0, settings.max_teams);
    const pairs: ManualMatchupPair[] = [];
    for (let index = 0; index + 1 < active.length; index += 2) {
      pairs.push({
        home_team_id: active[index].id,
        away_team_id: active[index + 1].id,
      });
    }
    setManualMatchups(pairs);
  }, [matchupWeek, matchups, settings, teams]);

  async function runAction(
    fn: () => PromiseLike<{ error: { message: string } | null }>,
    message: string
  ) {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await fn();
      if (result.error) {
        setError(result.error.message);
        return;
      }
      await load(false);
      setSuccess(message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Commissioner action failed.");
    } finally {
      setSaving(false);
    }
  }

  async function createTeamSlots() {
    await runAction(
      () => supabase.rpc("ensure_nhl_traditional_team_slots", { p_league_id: leagueId }),
      "NHL team slots are ready."
    );
  }

  async function saveTeam(team: FantasyTeam) {
    const teamName = (teamNames[team.id] ?? team.team_name).trim();
    if (!teamName) {
      setError("Team name is required.");
      return;
    }
    await runAction(
      () => supabase.rpc("commissioner_update_nhl_traditional_team", {
        p_league_id: leagueId,
        p_fantasy_team_id: team.id,
        p_team_name: teamName,
        p_active: team.active,
      }),
      `${teamName} saved.`
    );
  }

  async function toggleTeamActive(team: FantasyTeam) {
    if (team.owner_id && team.active) {
      setError("Remove the owner before deactivating this team slot.");
      return;
    }
    await runAction(
      () => supabase.rpc("commissioner_update_nhl_traditional_team", {
        p_league_id: leagueId,
        p_fantasy_team_id: team.id,
        p_team_name: (teamNames[team.id] ?? team.team_name).trim(),
        p_active: !team.active,
      }),
      `Team slot ${team.active ? "deactivated" : "activated"}.`
    );
  }

  async function toggleCpu(team: FantasyTeam) {
    await runAction(
      () => supabase.rpc("commissioner_set_nhl_traditional_cpu_team", {
        p_league_id: leagueId,
        p_fantasy_team_id: team.id,
        p_is_cpu: !team.is_cpu,
        p_cpu_auto_draft: true,
      }),
      `CPU team ${team.is_cpu ? "disabled" : "enabled"}.`
    );
  }

  async function removeOwner(team: FantasyTeam) {
    if (!team.owner_id) return;
    if (!window.confirm(`Remove the owner from ${team.team_name}? The franchise slot and NHL history will remain.`)) return;
    await runAction(
      () => supabase.rpc("commissioner_remove_nhl_traditional_owner", {
        p_league_id: leagueId,
        p_fantasy_team_id: team.id,
      }),
      `Owner removed from ${team.team_name}.`
    );
  }

  function openInvite(team: FantasyTeam) {
    setInviteTeamId(team.id);
    setInviteFirstName("");
    setInviteLastName("");
    setInviteEmail("");
    setError(null);
    setSuccess(null);
  }

  function closeInvite() {
    if (inviting) return;
    setInviteTeamId(null);
    setInviteFirstName("");
    setInviteLastName("");
    setInviteEmail("");
  }

  async function sendInvite(team: FantasyTeam) {
    if (inviting) return;

    const firstName = inviteFirstName.trim();
    const lastName = inviteLastName.trim();
    const email = inviteEmail.trim().toLowerCase();

    if (!firstName || !lastName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Enter the owner's first name, last name, and a valid email address.");
      return;
    }

    setInviting(true);
    setError(null);
    setSuccess(null);

    try {
      const sessionResult = await supabase.auth.getSession();
      if (sessionResult.error) throw new Error(sessionResult.error.message);

      const token = sessionResult.data.session?.access_token;
      if (!token) throw new Error("Your login session is missing. Sign in again and retry.");

      const response = await fetch(`/api/league/${encodeURIComponent(leagueId)}/invite`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          firstName,
          lastName,
          email,
          fantasyTeamId: team.id,
        }),
      });

      const contentType = response.headers.get("content-type") ?? "";
      let body: { success?: boolean; message?: string; error?: string } = {};

      if (contentType.includes("application/json")) {
        body = (await response.json()) as typeof body;
      } else {
        const responseText = await response.text();
        throw new Error(
          response.ok
            ? "The invite request returned an invalid response."
            : `Invite request failed with ${response.status} ${response.statusText}${
                responseText ? `: ${responseText.replace(/\s+/g, " ").slice(0, 180)}` : ""
              }`
        );
      }

      if (!response.ok || body.success === false) {
        throw new Error(body.error ?? body.message ?? "The invitation could not be sent.");
      }

      setSuccess(body.message ?? `Invitation sent to ${email}.`);
      setInviteTeamId(null);
      setInviteFirstName("");
      setInviteLastName("");
      setInviteEmail("");
      await load(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invitation could not be sent.");
    } finally {
      setInviting(false);
    }
  }

  async function prepareDraft() {
    await runAction(
      () => supabase.rpc("prepare_nhl_traditional_draft", { p_league_id: leagueId }),
      "NHL draft prepared."
    );
  }

  async function randomizeDraftOrder() {
    if (!window.confirm("Randomize the NHL draft order? This will replace the current pre-draft order.")) return;
    await runAction(
      () => supabase.rpc("commissioner_randomize_nhl_traditional_draft_order", { p_league_id: leagueId }),
      "Draft order randomized."
    );
  }

  function moveDraftTeam(teamId: number, direction: -1 | 1) {
    setDraftOrder((current) => {
      const index = current.indexOf(teamId);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  }

  function assignDraftSlot(teamId: number, slot: number) {
    setDraftOrder((current) => {
      const from = current.indexOf(teamId);
      const to = Math.max(0, Math.min(current.length - 1, slot - 1));
      if (from < 0 || from === to) return current;
      const next = [...current];
      next.splice(from, 1);
      next.splice(to, 0, teamId);
      return next;
    });
  }

  async function saveManualDraftOrder() {
    if (!draftOrder.length) return;
    await runAction(
      () => supabase.rpc("commissioner_set_nhl_traditional_draft_order", {
        p_league_id: leagueId,
        p_fantasy_team_ids: draftOrder,
      }),
      "Manual draft order saved."
    );
  }

  async function saveDraftTimer() {
    await runAction(
      () => supabase.rpc("commissioner_set_nhl_traditional_draft_timer", {
        p_league_id: leagueId,
        p_seconds_per_pick: draftTimerSeconds,
      }),
      draftTimerSeconds === 0
        ? "Draft timer disabled."
        : `Draft timer set to ${draftTimerSeconds} seconds.`
    );
  }

  async function generateFullMatchupSchedule() {
    if (!settings) return;

    const hasSchedule = matchups.some(
      (row) => row.week >= 1 && row.week <= settings.regular_season_weeks
    );

    if (
      !window.confirm(
        hasSchedule
          ? `Regenerate the full ${settings.regular_season_weeks}-week NHL regular-season schedule? Existing editable regular-season matchups will be replaced. Started or completed weeks are protected.`
          : `Generate the full ${settings.regular_season_weeks}-week NHL regular-season schedule?`
      )
    ) {
      return;
    }

    await runAction(
      () =>
        supabase.rpc("commissioner_generate_nhl_traditional_matchups", {
          p_league_id: leagueId,
        }),
      "NHL regular-season matchup schedule generated."
    );
  }

  function updateManualMatchup(
    index: number,
    side: "home_team_id" | "away_team_id",
    value: number | null
  ) {
    setManualMatchups((current) =>
      current.map((pair, pairIndex) =>
        pairIndex === index ? { ...pair, [side]: value } : pair
      )
    );
  }

  function addManualMatchup() {
    setManualMatchups((current) => [
      ...current,
      { home_team_id: null, away_team_id: null },
    ]);
  }

  function removeManualMatchup(index: number) {
    setManualMatchups((current) =>
      current.filter((_, pairIndex) => pairIndex !== index)
    );
  }

  async function saveManualMatchupWeek() {
    if (!settings) return;

    const completePairs = manualMatchups.filter(
      (pair) => pair.home_team_id != null && pair.away_team_id != null
    );

    if (completePairs.length !== manualMatchups.length) {
      setError("Complete both teams in every matchup, or remove the unfinished matchup.");
      return;
    }

    const usedTeamIds = completePairs.flatMap((pair) => [
      pair.home_team_id as number,
      pair.away_team_id as number,
    ]);

    if (new Set(usedTeamIds).size !== usedTeamIds.length) {
      setError(`A fantasy team can appear only once in Week ${matchupWeek}.`);
      return;
    }

    if (completePairs.some((pair) => pair.home_team_id === pair.away_team_id)) {
      setError("A fantasy team cannot play itself.");
      return;
    }

    const activeTeamCount = teams.filter((team) => team.active).length;
    const expectedTeamsUsed =
      activeTeamCount % 2 === 0 ? activeTeamCount : activeTeamCount - 1;

    if (usedTeamIds.length !== expectedTeamsUsed) {
      setError(
        activeTeamCount % 2 === 0
          ? `Week ${matchupWeek} must assign all ${activeTeamCount} active teams.`
          : `Week ${matchupWeek} must assign ${expectedTeamsUsed} teams and leave exactly one team on a bye.`
      );
      return;
    }

    if (
      !window.confirm(
        `Save these manual matchups for Week ${matchupWeek}? The current editable schedule for this week will be replaced.`
      )
    ) {
      return;
    }

    await runAction(
      () =>
        supabase.rpc("commissioner_set_nhl_traditional_matchup_week", {
          p_league_id: leagueId,
          p_week: matchupWeek,
          p_matchups: completePairs,
        }),
      `Week ${matchupWeek} matchups saved.`
    );
  }

  async function saveLeagueSettings() {
    if (!settings) return;

    await runAction(
      async () => {
        const settingsResult = await supabase.rpc("update_nhl_traditional_settings", {
          p_league_id: leagueId,
          p_league_format: settings.league_format,
          p_position_mode: settings.position_mode,
          p_max_teams: settings.max_teams,
          p_regular_season_weeks: settings.regular_season_weeks,
          p_playoff_team_count: settings.playoff_team_count,
          p_playoff_weeks: settings.playoff_weeks,
          p_allow_daily_lineup_changes: settings.allow_daily_lineup_changes,
          p_player_lock_mode: "individual_game",
          p_waiver_mode: settings.waiver_mode,
          p_faab_budget:
            settings.waiver_mode === "faab" ? settings.faab_budget : null,
          p_trade_deadline_at: null,
          p_trade_deadline_week: settings.trade_deadline_week,
          p_dynasty_rookie_rounds: settings.dynasty_rookie_rounds,
          p_dynasty_future_pick_years: settings.dynasty_future_pick_years,
          p_dynasty_rosters_carry_over: settings.dynasty_rosters_carry_over,
        });
        if (settingsResult.error) return settingsResult;

        const scoringSystemResult = await supabase.rpc("update_nhl_traditional_scoring_system", {
          p_league_id: leagueId,
          p_scoring_system: settings.scoring_system ?? "points",
        });
        if (scoringSystemResult.error) return scoringSystemResult;

        return supabase.rpc("update_nhl_traditional_goalie_minimum_starts", {
          p_league_id: leagueId,
          p_goalie_minimum_starts: settings.goalie_minimum_starts ?? 3,
        });
      },
      "NHL league settings saved."
    );
  }

  async function saveRosterSettings() {
    if (!roster) return;

    await runAction(
      () =>
        supabase.rpc("update_nhl_traditional_roster_settings", {
          p_league_id: leagueId,
          p_starting_c: roster.starting_c,
          p_starting_lw: roster.starting_lw,
          p_starting_rw: roster.starting_rw,
          p_starting_f: roster.starting_f,
          p_starting_d: roster.starting_d,
          p_starting_g: roster.starting_g,
          p_starting_util: roster.starting_util,
          p_bench_slots: roster.bench_slots,
          p_ir_slots: roster.ir_slots,
          p_max_c: roster.max_c,
          p_max_lw: roster.max_lw,
          p_max_rw: roster.max_rw,
          p_max_f: roster.max_f,
          p_max_d: roster.max_d,
          p_max_g: roster.max_g,
        }),
      "NHL roster settings saved."
    );
  }

  async function saveAllScoring() {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      for (const rule of scoringRules) {
        const result = await supabase.rpc("update_nhl_traditional_scoring_rule", {
          p_league_id: leagueId,
          p_stat_key: rule.stat_key,
          p_points: n(rule.points),
          p_enabled: rule.enabled,
        });

        if (result.error) throw new Error(result.error.message);
      }

      await load(false);
      setSuccess("NHL scoring settings saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scoring settings could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function saveAllCategories() {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      for (const rule of categoryRules) {
        const result = await supabase.rpc("update_nhl_traditional_category_rule", {
          p_league_id: leagueId,
          p_stat_key: rule.stat_key,
          p_enabled: rule.enabled,
          p_direction: rule.direction,
        });
        if (result.error) throw new Error(result.error.message);
      }
      await load(false);
      setSuccess("NHL category scoring settings saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Category settings could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function resetScoring() {
    await runAction(
      () =>
        supabase.rpc("reset_nhl_traditional_scoring_defaults", {
          p_league_id: leagueId,
        }),
      "NHL scoring reset to G365 defaults."
    );
  }

  const totalActiveSlots = useMemo(() => {
    if (!settings || !roster) return 0;
    return settings.position_mode === "fdg"
      ? roster.starting_f + roster.starting_d + roster.starting_g
      : roster.starting_c +
          roster.starting_lw +
          roster.starting_rw +
          roster.starting_d +
          roster.starting_g +
          roster.starting_util;
  }, [settings, roster]);

  if (loading) {
    return <main style={styles.page}><div style={styles.center}>Loading NHL Commissioner…</div></main>;
  }

  if (!authorized) {
    return (
      <main style={styles.page}>
        <div style={styles.denied}>
          <h1>Commissioner Only</h1>
          <p>You do not have commissioner access to this NHL Traditional league.</p>
          <Button onClick={() => router.push(`/league/${leagueId}`)}>BACK TO LEAGUE</Button>
        </div>
      </main>
    );
  }

  const tabs: Array<[Tab, string]> = [
    ["overview", "Overview"],
    ["league", "League Setup"],
    ["teams", "Teams & Owners"],
    ["draft", "Draft"],
    ["matchups", "Matchups"],
    ["roster", "Roster Setup"],
    ["scoring", "Scoring"],
  ];

  return (
    <main className="g365-nhl-commissioner" style={styles.page}>
      <style>{`
        @media (max-width: 900px) {
          .g365-nhl-invite-grid { grid-template-columns: 1fr 1fr !important; }
          .g365-nhl-inline-invite { margin-left: 12px !important; }
        }
        @media (max-width: 760px) {
          .g365-nhl-commissioner { padding: 12px 10px 48px !important; overflow-x: hidden !important; }
          .g365-nhl-shell { width: 100% !important; max-width: 100% !important; min-width: 0 !important; }
          .g365-nhl-hero { flex-direction: column !important; align-items: stretch !important; padding: 14px !important; }
          .g365-nhl-hero-actions { width: 100% !important; display: grid !important; grid-template-columns: repeat(2,minmax(0,1fr)) !important; }
          .g365-nhl-hero-actions button { width: 100% !important; }
          .g365-nhl-tabs { width: 100% !important; overflow-x: auto !important; flex-wrap: nowrap !important; -webkit-overflow-scrolling: touch; }
          .g365-nhl-tabs button { flex: 0 0 auto !important; white-space: nowrap !important; }
          .g365-nhl-grid { grid-template-columns: repeat(2,minmax(0,1fr)) !important; gap: 9px !important; }
          .g365-nhl-setup-grid { grid-template-columns: repeat(2,minmax(0,1fr)) !important; gap: 10px !important; }
          .g365-nhl-stats { grid-template-columns: repeat(2,minmax(0,1fr)) !important; gap: 8px !important; }
          .g365-nhl-actions { display: grid !important; grid-template-columns: minmax(0,1fr) !important; }
          .g365-nhl-actions button { width: 100% !important; }
          .g365-nhl-category-row { grid-template-columns: minmax(0,1fr) 150px 120px !important; }
          .g365-nhl-team-header { display: none !important; }
          .g365-nhl-team-row { grid-template-columns: 42px minmax(0,1fr) minmax(0,1fr) !important; }
          .g365-nhl-team-status, .g365-nhl-team-type, .g365-nhl-team-row-actions { grid-column: span 1; }
          .g365-nhl-team-row-actions { grid-column: 2 / -1; }
          .g365-nhl-mobile-label { display: block !important; }
          .g365-nhl-draft-order-row { grid-template-columns: 42px minmax(0,1fr) !important; }
          .g365-nhl-draft-order-row > *:nth-child(n+3) { grid-column: 2 !important; }
          .g365-nhl-matchup-editor-row { grid-template-columns: 38px minmax(0,1fr) !important; }
          .g365-nhl-matchup-editor-row > *:nth-child(n+3) { grid-column: 2 !important; }
          .g365-nhl-commissioner section { max-width: 100% !important; min-width: 0 !important; box-sizing: border-box !important; }
        }
        @media (max-width: 430px) {
          .g365-nhl-grid, .g365-nhl-setup-grid, .g365-nhl-stats, .g365-nhl-hero-actions { grid-template-columns: minmax(0,1fr) !important; }
          .g365-nhl-team-row { grid-template-columns: 34px minmax(0,1fr) !important; }
          .g365-nhl-team-name, .g365-nhl-team-owner, .g365-nhl-team-status, .g365-nhl-team-type, .g365-nhl-team-row-actions { grid-column: 2 !important; }
          .g365-nhl-team-row-actions { display: grid !important; grid-template-columns: repeat(2,minmax(0,1fr)) !important; }
          .g365-nhl-team-row-actions button { width: 100% !important; }
          .g365-nhl-commissioner { padding-left: 8px !important; padding-right: 8px !important; }
          .g365-nhl-category-header { display: none !important; }
          .g365-nhl-category-row { grid-template-columns: minmax(0,1fr) !important; gap: 8px !important; align-items: stretch !important; }
          .g365-nhl-category-row select, .g365-nhl-category-row button { width: 100% !important; }
        }
      `}</style>

      <div className="g365-nhl-shell" style={styles.shell}>
        <header className="g365-nhl-hero" style={styles.hero}>
          <div>
            <div style={styles.eyebrow}>
              NHL {settings?.league_format === "dynasty" ? "DYNASTY" : "TRADITIONAL DRAFT"} • COMMISSIONER
            </div>
            <h1 style={styles.title}>Commissioner</h1>
            <p style={styles.subtitle}>
              Manage {league?.name ?? "your NHL league"} from one control center.
            </p>
          </div>

          <div className="g365-nhl-hero-actions" style={styles.row}>
            <Button secondary onClick={() => router.push(`/league/${leagueId}`)}>
              LEAGUE HOME
            </Button>
            <Button onClick={() => void load()} disabled={saving}>
              REFRESH
            </Button>
          </div>
        </header>

        {error ? <div style={styles.error}>{error}</div> : null}
        {success ? <div style={styles.success}>{success}</div> : null}

        <div className="g365-nhl-tabs" style={styles.tabs}>
          {tabs.map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              style={{ ...styles.tab, ...(tab === key ? styles.tabActive : {}) }}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "overview" ? (
          <>
            <Section title="NHL League Control Center">
              <div className="g365-nhl-stats" style={styles.stats}>
                <Stat label="Season" value={league?.season ?? "—"} />
                <Stat label="Format" value={settings?.league_format === "dynasty" ? "Dynasty" : "Redraft"} />
                <Stat label="Positions" value={settings?.position_mode === "fdg" ? "F / D / G" : "Detailed"} />
                <Stat label="Phase" value={pretty(seasonState?.phase)} />
                <Stat label="Active Week" value={seasonState?.active_week ?? "—"} />
                <Stat label="Teams" value={`${activeTeams}/${settings?.max_teams ?? "—"}`} />
                <Stat label="Active Slots" value={totalActiveSlots} />
                <Stat label="Waivers" value={pretty(settings?.waiver_mode)} />
                <Stat label="Goalie Minimum" value={`${settings?.goalie_minimum_starts ?? 3} starts/week`} />
              </div>
            </Section>

            <Section
              title="Commissioner Setup"
              subtitle="This first NHL commissioner phase controls the league structure, roster requirements and scoring engine."
            >
              <div style={styles.guideGrid}>
                <div style={styles.guide}>
                  <strong>League Setup</strong>
                  <p>Choose Redraft or Dynasty, position mode, league size, season length, playoffs, waivers and trade deadline.</p>
                </div>
                <div style={styles.guide}>
                  <strong>Roster Setup</strong>
                  <p>Detailed leagues use C/LW/RW/D/G/UTIL. Simplified leagues use F/D/G. Bench, IR and maximums remain configurable.</p>
                </div>
                <div style={styles.guide}>
                  <strong>Scoring</strong>
                  <p>Choose Points or Categories, then configure the full NHL scoring-option catalog.</p>
                </div>
                <div style={styles.guide}>
                  <strong>Teams & Owners</strong>
                  <p>Create persistent NHL franchise slots, rename teams, invite owners, remove owners safely, and configure open CPU teams.</p>
                </div>
                <div style={styles.guide}>
                  <strong>Draft</strong>
                  <p>Prepare the draft, randomize the order, or manually place every franchise into its Round 1 draft slot.</p>
                </div>
              </div>
            </Section>
          </>
        ) : null}

        {tab === "league" && settings ? (
          <>
            <Section
              title="League Setup"
              subtitle="Core NHL Traditional settings. Redraft and Dynasty share the same fantasy engine."
            >
              <div className="g365-nhl-setup-stack" style={styles.setupStack}>
                <div style={styles.setupGroup}>
                  <div style={styles.setupGroupHead}>
                    <div>
                      <div style={styles.subsectionTitle}>LEAGUE FORMAT</div>
                      <div style={styles.setupGroupText}>Choose the NHL fantasy format, roster-position style, and total number of franchises.</div>
                    </div>
                  </div>
                  <div className="g365-nhl-setup-grid g365-nhl-setup-grid-4" style={styles.setupGrid4}>
                    <SelectField
                      label="League Format"
                      value={settings.league_format}
                      onChange={(value) =>
                        setSettings({ ...settings, league_format: value as "redraft" | "dynasty" })
                      }
                    >
                      <option value="redraft">Redraft</option>
                      <option value="dynasty">Dynasty</option>
                    </SelectField>

                    <SelectField
                      label="Position Setup"
                      value={settings.position_mode}
                      onChange={(value) =>
                        setSettings({ ...settings, position_mode: value as "detailed" | "fdg" })
                      }
                    >
                      <option value="detailed">Detailed — C / LW / RW / D / G / UTIL</option>
                      <option value="fdg">Simplified — F / D / G</option>
                    </SelectField>

                    <SelectField
                      label="Scoring System"
                      value={settings.scoring_system ?? "points"}
                      onChange={(value) =>
                        setSettings({ ...settings, scoring_system: value as "points" | "categories" })
                      }
                    >
                      <option value="points">Points</option>
                      <option value="categories">Categories</option>
                    </SelectField>

                    <SelectField
                      label="League Size"
                      value={String(settings.max_teams)}
                      onChange={(value) => {
                        const maxTeams = Math.max(6, Math.min(12, Number(value)));
                        setSettings({
                          ...settings,
                          max_teams: maxTeams,
                          playoff_team_count: Math.min(settings.playoff_team_count, maxTeams),
                        });
                      }}
                    >
                      {[6, 7, 8, 9, 10, 11, 12].map((count) => (
                        <option key={count} value={count}>{count} Teams</option>
                      ))}
                    </SelectField>
                  </div>
                  <div style={styles.inlineHelp}>
                    League size can be 6–12 teams. Reducing the size keeps all franchise IDs and history; only unused open slots are deactivated.
                  </div>

                  <div style={styles.divider} />

                  <div style={styles.subsectionTitle}>GOALTENDER SCORING REQUIREMENT</div>
                  <div className="g365-nhl-setup-grid g365-nhl-setup-grid-3" style={styles.setupGrid3}>
                    <SelectField
                      label="Minimum Goalie Starts / Week"
                      value={String(settings.goalie_minimum_starts ?? 3)}
                      onChange={(value) =>
                        setSettings({ ...settings, goalie_minimum_starts: Number(value) })
                      }
                    >
                      <option value="0">No Minimum</option>
                      {[1, 2, 3, 4, 5, 6, 7].map((starts) => (
                        <option key={starts} value={starts}>
                          {starts} {starts === 1 ? "Start" : "Starts"}
                        </option>
                      ))}
                    </SelectField>
                  </div>
                  <div style={styles.inlineHelp}>
                    G365 default is 3 goalie starts per matchup week. A team that finishes below the minimum forfeits all enabled goaltending scoring for that week: goalie points become 0 in Points leagues, and goalie categories are lost in Categories leagues. If both matchup teams miss the minimum, those goalie categories are ties. Relief appearances do not count as starts.
                  </div>
                </div>

                <div style={styles.setupGroup}>
                  <div style={styles.setupGroupHead}>
                    <div>
                      <div style={styles.subsectionTitle}>SEASON & PLAYOFFS</div>
                      <div style={styles.setupGroupText}>Set the regular-season length and postseason field in one place.</div>
                    </div>
                  </div>
                  <div className="g365-nhl-setup-grid g365-nhl-setup-grid-3" style={styles.setupGrid3}>
                    <NumberInput
                      label="Regular Season Weeks"
                      value={settings.regular_season_weeks}
                      min={1}
                      max={30}
                      onChange={(value) => {
                        const regularSeasonWeeks = Math.max(1, Math.min(30, value ?? 20));
                        setSettings({
                          ...settings,
                          regular_season_weeks: regularSeasonWeeks,
                          trade_deadline_week:
                            settings.trade_deadline_week != null &&
                            settings.trade_deadline_week > regularSeasonWeeks
                              ? regularSeasonWeeks
                              : settings.trade_deadline_week,
                        });
                      }}
                    />
                    <NumberInput
                      label="Playoff Teams"
                      value={settings.playoff_team_count}
                      min={2}
                      max={settings.max_teams}
                      onChange={(value) =>
                        setSettings({ ...settings, playoff_team_count: Math.max(2, Math.min(settings.max_teams, value ?? 6)) })
                      }
                    />
                    <NumberInput
                      label="Playoff Weeks"
                      value={settings.playoff_weeks}
                      min={1}
                      max={6}
                      onChange={(value) =>
                        setSettings({ ...settings, playoff_weeks: Math.max(1, Math.min(6, value ?? 3)) })
                      }
                    />
                  </div>
                </div>

                <div style={styles.setupGroup}>
                  <div style={styles.setupGroupHead}>
                    <div>
                      <div style={styles.subsectionTitle}>ROSTER MOVES & LOCKING</div>
                      <div style={styles.setupGroupText}>Control waivers, trade timing, lineup changes, and player locking.</div>
                    </div>
                  </div>
                  <div className="g365-nhl-setup-grid g365-nhl-setup-grid-4" style={styles.setupGrid4}>
                    <SelectField
                      label="Waiver Mode"
                      value={settings.waiver_mode}
                      onChange={(value) =>
                        setSettings({
                          ...settings,
                          waiver_mode: value as NhlSettings["waiver_mode"],
                          faab_budget: value === "faab" ? settings.faab_budget ?? 100 : null,
                        })
                      }
                    >
                      <option value="rolling">Rolling Priority</option>
                      <option value="reverse_standings">Reverse Standings</option>
                      <option value="faab">FAAB</option>
                    </SelectField>

                    {settings.waiver_mode === "faab" ? (
                      <NumberInput
                        label="FAAB Budget"
                        value={settings.faab_budget}
                        min={1}
                        onChange={(value) => setSettings({ ...settings, faab_budget: value ?? 100 })}
                      />
                    ) : null}

                    <SelectField
                      label="Trade Deadline"
                      value={settings.trade_deadline_week?.toString() ?? "none"}
                      onChange={(value) =>
                        setSettings({
                          ...settings,
                          trade_deadline_at: null,
                          trade_deadline_week: value === "none" ? null : Number(value),
                        })
                      }
                    >
                      <option value="none">No Trade Deadline</option>
                      {Array.from(
                        { length: settings.regular_season_weeks },
                        (_, index) => index + 1
                      ).map((week) => (
                        <option key={week} value={week}>
                          Week {week}
                        </option>
                      ))}
                    </SelectField>

                    <Toggle
                      label="Daily Lineup Changes"
                      value={settings.allow_daily_lineup_changes}
                      onChange={(value) => setSettings({ ...settings, allow_daily_lineup_changes: value })}
                    />

                    <label style={styles.field}>
                      <span style={styles.fieldLabel}>Player Lock</span>
                      <div style={styles.readOnly}>Individual Game Start</div>
                    </label>
                  </div>
                </div>
              </div>

              {settings.league_format === "dynasty" ? (
                <div style={styles.subPanel}>
                  <div style={styles.subsectionTitle}>DYNASTY SETTINGS</div>
                  <div className="g365-nhl-grid" style={styles.grid}>
                    <NumberInput
                      label="Rookie Draft Rounds"
                      value={settings.dynasty_rookie_rounds}
                      min={1}
                      max={10}
                      onChange={(value) =>
                        setSettings({ ...settings, dynasty_rookie_rounds: Math.max(1, Math.min(10, value ?? 4)) })
                      }
                    />
                    <NumberInput
                      label="Future Pick Years"
                      value={settings.dynasty_future_pick_years}
                      min={1}
                      max={5}
                      onChange={(value) =>
                        setSettings({ ...settings, dynasty_future_pick_years: Math.max(1, Math.min(5, value ?? 3)) })
                      }
                    />
                    <Toggle
                      label="Carry Rosters Between Seasons"
                      value={settings.dynasty_rosters_carry_over}
                      onChange={(value) =>
                        setSettings({ ...settings, dynasty_rosters_carry_over: value })
                      }
                    />
                  </div>
                </div>
              ) : null}

              <div style={styles.notice}>
                Position mode controls which lineup fields appear throughout NHL Traditional. Player identity remains tied to the player's actual NHL position.
              </div>

              <div className="g365-nhl-actions" style={styles.actions}>
                <Button disabled={saving} onClick={() => void saveLeagueSettings()}>
                  SAVE LEAGUE SETTINGS
                </Button>
              </div>
            </Section>
          </>
        ) : null}

        {tab === "teams" && settings ? (
          <Section
            title="Teams & Owners"
            subtitle="Manage team ownership, send invitations, and configure CPU teams. Inactive reserve franchise IDs stay preserved in the background for league history."
          >
            <div className="g365-nhl-team-summary" style={styles.teamSummary}>
              <Stat label="League Teams" value={teams.filter((team) => team.active).length} />
              <Stat label="Owned" value={teams.filter((team) => team.active && team.owner_id).length} />
              <Stat label="Open" value={teams.filter((team) => team.active && !team.owner_id && !team.is_cpu).length} />
              <Stat label="CPU" value={teams.filter((team) => team.active && team.is_cpu).length} />
            </div>

            {teams.filter((team) => team.active).length < settings.max_teams ? (
              <div style={styles.notice}>
                <strong>TEAM SLOTS NEED INITIALIZED</strong>
                <span>
                  This league has {teams.filter((team) => team.active).length} of {settings.max_teams} active team slots.
                </span>
                <div className="g365-nhl-actions" style={styles.actions}>
                  <Button disabled={saving} onClick={() => void createTeamSlots()}>
                    CREATE LEAGUE TEAM SLOTS
                  </Button>
                </div>
              </div>
            ) : null}

            <div className="g365-nhl-team-table" style={styles.teamTable}>
              <div className="g365-nhl-team-header" style={styles.teamTableHeader}>
                <span>#</span>
                <span>TEAM NAME</span>
                <span>OWNER</span>
                <span>STATUS</span>
                <span>TYPE</span>
                <span>ACTIONS</span>
              </div>

              <div style={styles.teamRows}>
                {teams
                  .filter((team) => team.active)
                  .slice(0, settings.max_teams)
                  .map((team, index) => {
                    const member = team.owner_id
                      ? members.find((row) => row.user_id === team.owner_id)
                      : null;
                    const isCommissioner = member?.role === "commissioner";
                    const isOpen = !team.owner_id && !team.is_cpu;

                    return (
                      <div key={team.id} style={styles.teamRowGroup}>
                      <div className="g365-nhl-team-row" style={styles.teamRow}>
                        <strong className="g365-nhl-team-number" style={styles.teamNumber}>{index + 1}</strong>

                        <label className="g365-nhl-team-name" style={styles.compactField}>
                          <span className="g365-nhl-mobile-label" style={styles.mobileLabel}>TEAM NAME</span>
                          <input
                            value={teamNames[team.id] ?? team.team_name}
                            onChange={(e) =>
                              setTeamNames((current) => ({ ...current, [team.id]: e.target.value }))
                            }
                            style={styles.input}
                            maxLength={80}
                          />
                        </label>

                        <div className="g365-nhl-team-owner" style={styles.compactField}>
                          <span className="g365-nhl-mobile-label" style={styles.mobileLabel}>OWNER</span>
                          <div style={styles.teamOwnerValue}>
                            {team.owner_id
                              ? isCommissioner
                                ? "Commissioner"
                                : "League Member"
                              : team.is_cpu
                                ? "CPU / Ownerless"
                                : "— Select Owner —"}
                          </div>
                        </div>

                        <div className="g365-nhl-team-status" style={styles.compactField}>
                          <span className="g365-nhl-mobile-label" style={styles.mobileLabel}>STATUS</span>
                          {team.owner_id ? (
                            <div style={styles.statusStack}>
                              <strong style={styles.statusOwned}>OWNER ASSIGNED</strong>
                              <span style={styles.statusSub}>League member</span>
                            </div>
                          ) : team.is_cpu ? (
                            <div style={styles.statusStack}>
                              <strong style={styles.statusCpu}>CPU TEAM</strong>
                              <span style={styles.statusSub}>Managed by system</span>
                            </div>
                          ) : (
                            <div style={styles.statusStack}>
                              <strong style={styles.statusOpen}>NO OWNER</strong>
                              <span style={styles.statusSub}>Invite an owner or use CPU</span>
                            </div>
                          )}
                        </div>

                        <div className="g365-nhl-team-type" style={styles.compactField}>
                          <span className="g365-nhl-mobile-label" style={styles.mobileLabel}>TYPE</span>
                          <div>
                            {team.owner_id ? (
                              <span style={styles.badgeOwned}>OWNER</span>
                            ) : team.is_cpu ? (
                              <span style={styles.badgeCpu}>CPU</span>
                            ) : (
                              <span style={styles.badgeOpen}>VACANT</span>
                            )}
                          </div>
                        </div>

                        <div className="g365-nhl-team-row-actions" style={styles.teamRowActions}>
                          <span className="g365-nhl-mobile-label" style={styles.mobileLabel}>ACTIONS</span>
                          {isOpen ? (
                            <Button secondary disabled={saving || inviting} onClick={() => openInvite(team)}>
                              INVITE
                            </Button>
                          ) : null}

                          {!team.owner_id ? (
                            <Button secondary disabled={saving} onClick={() => void toggleCpu(team)}>
                              {team.is_cpu ? "REMOVE CPU" : "MAKE CPU"}
                            </Button>
                          ) : null}

                          {team.owner_id && !isCommissioner ? (
                            <Button secondary disabled={saving} onClick={() => void removeOwner(team)}>
                              REMOVE OWNER
                            </Button>
                          ) : null}

                          <Button disabled={saving} onClick={() => void saveTeam(team)}>
                            SAVE
                          </Button>
                        </div>
                      </div>

                      {inviteTeamId === team.id ? (
                        <div className="g365-nhl-inline-invite" style={styles.inlineInvite}>
                          <div style={styles.inlineInviteHeading}>
                            <div>
                              <strong style={styles.inlineInviteTitle}>INVITE OWNER TO {team.team_name.toUpperCase()}</strong>
                              <div style={styles.inlineInviteSub}>Enter the owner's information and send the Gridiron365 league invitation.</div>
                            </div>
                          </div>

                          <div className="g365-nhl-invite-grid" style={styles.inlineInviteGrid}>
                            <label style={styles.field}>
                              <span style={styles.fieldLabel}>First Name</span>
                              <input
                                type="text"
                                value={inviteFirstName}
                                onChange={(e) => setInviteFirstName(e.target.value)}
                                style={styles.input}
                                autoComplete="given-name"
                              />
                            </label>

                            <label style={styles.field}>
                              <span style={styles.fieldLabel}>Last Name</span>
                              <input
                                type="text"
                                value={inviteLastName}
                                onChange={(e) => setInviteLastName(e.target.value)}
                                style={styles.input}
                                autoComplete="family-name"
                              />
                            </label>

                            <label style={styles.field}>
                              <span style={styles.fieldLabel}>Email Address</span>
                              <input
                                type="email"
                                value={inviteEmail}
                                onChange={(e) => setInviteEmail(e.target.value)}
                                style={styles.input}
                                autoComplete="email"
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") void sendInvite(team);
                                }}
                              />
                            </label>

                            <div style={styles.inlineInviteActions}>
                              <Button disabled={inviting} onClick={() => void sendInvite(team)}>
                                {inviting ? "SENDING…" : "SEND EMAIL INVITE"}
                              </Button>
                              <Button secondary disabled={inviting} onClick={closeInvite}>
                                CANCEL
                              </Button>
                            </div>
                          </div>
                        </div>
                      ) : null}
                      </div>
                    );
                  })}
              </div>
            </div>

            <div style={styles.teamFootnote}>
              NHL Dynasty franchise IDs remain persistent behind the scenes even when the league size is reduced.
            </div>
          </Section>
        ) : null}

        {tab === "draft" && settings ? (
          <Section
            title="Draft Setup & Order"
            subtitle="Prepare the NHL draft, randomize Round 1, or manually set every franchise's draft slot. Snake order reverses automatically each round."
          >
            {settings.league_format === "dynasty" ? (
              <NhlDynastyLotteryTest
                leagueId={leagueId}
                teams={teams}
              />
            ) : null}

            {!draftState?.exists ? (
              <div style={styles.notice}>
                <strong>DRAFT NOT PREPARED</strong>
                <span>Prepare the draft first. This creates the draft and its team-slot records from the active league franchises.</span>
                <div className="g365-nhl-actions" style={styles.actions}>
                  <Button disabled={saving} onClick={() => void prepareDraft()}>PREPARE DRAFT</Button>
                </div>
              </div>
            ) : (
              <>
                <div className="g365-nhl-stats" style={styles.stats}>
                  <Stat label="Status" value={pretty(draftState.status)} />
                  <Stat label="Format" value={settings.league_format === "dynasty" ? "Dynasty Startup" : "Redraft"} />
                  <Stat label="Rounds" value={draftState.rounds ?? "—"} />
                  <Stat label="Timer" value={(draftState.secondsPerPick ?? 90) === 0 ? "No Timer" : `${draftState.secondsPerPick ?? 90} sec`} />
                  <Stat label="Picks Made" value={draftState.pickCount ?? 0} />
                  <Stat label="Total Picks" value={draftState.totalPicks ?? "—"} />
                </div>

                {draftState.status === "setup" || draftState.status === "ready" ? (
                  <>
                    <div style={styles.setupGroup}>
                      <div style={styles.setupGroupHead}>
                        <div>
                          <div style={styles.subsectionTitle}>PICK TIMER</div>
                          <div style={styles.setupGroupText}>Choose how long each team has to make a selection. No Timer leaves the current team on the clock until a pick is made.</div>
                        </div>
                      </div>
                      <div className="g365-nhl-setup-grid g365-nhl-setup-grid-3" style={styles.setupGrid3}>
                        <SelectField
                          label="Time Per Pick"
                          value={String(draftTimerSeconds)}
                          onChange={(value) => setDraftTimerSeconds(Number(value))}
                        >
                          <option value="30">30 Seconds</option>
                          <option value="45">45 Seconds</option>
                          <option value="60">60 Seconds</option>
                          <option value="90">90 Seconds</option>
                          <option value="120">2 Minutes</option>
                          <option value="180">3 Minutes</option>
                          <option value="300">5 Minutes</option>
                          <option value="0">No Timer</option>
                        </SelectField>
                      </div>
                      <div className="g365-nhl-actions" style={styles.actions}>
                        <Button disabled={saving} onClick={() => void saveDraftTimer()}>SAVE PICK TIMER</Button>
                      </div>
                    </div>

                    <div style={styles.draftToolbar}>
                      <div>
                        <div style={styles.subsectionTitle}>ROUND 1 DRAFT ORDER</div>
                        <div style={styles.setupGroupText}>Randomize all teams or arrange them manually. The saved slots become the snake-draft order.</div>
                      </div>
                      <Button disabled={saving || draftOrder.length < 2} onClick={() => void randomizeDraftOrder()}>RANDOMIZE DRAFT ORDER</Button>
                    </div>

                    <div style={styles.draftOrderList}>
                      {draftOrder.map((teamId, index) => {
                        const team = teams.find((row) => row.id === teamId);
                        const draftTeam = draftTeams.find((row) => row.fantasy_team_id === teamId);
                        return (
                          <div key={teamId} className="g365-nhl-draft-order-row" style={styles.draftOrderRow}>
                            <div style={styles.draftSlotNumber}>{index + 1}</div>
                            <div style={styles.draftTeamName}>
                              <strong>{team?.team_name ?? `Team ${teamId}`}</strong>
                              <span>{draftTeam?.is_cpu || team?.is_cpu ? "CPU TEAM" : team?.owner_id ? "OWNER ASSIGNED" : "OPEN TEAM"}</span>
                            </div>
                            <label style={styles.draftSlotField}>
                              <span style={styles.fieldLabel}>SLOT</span>
                              <select value={index + 1} onChange={(e) => assignDraftSlot(teamId, Number(e.target.value))} style={styles.input}>
                                {draftOrder.map((_, slotIndex) => (
                                  <option key={slotIndex + 1} value={slotIndex + 1}>{slotIndex + 1}</option>
                                ))}
                              </select>
                            </label>
                            <div style={styles.draftMoveButtons}>
                              <Button secondary disabled={saving || index === 0} onClick={() => moveDraftTeam(teamId, -1)}>MOVE UP</Button>
                              <Button secondary disabled={saving || index === draftOrder.length - 1} onClick={() => moveDraftTeam(teamId, 1)}>MOVE DOWN</Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div style={styles.snakePreview}>
                      <strong>SNAKE PREVIEW</strong>
                      <span>Round 1: {draftOrder.map((id) => teams.find((team) => team.id === id)?.team_name ?? `Team ${id}`).join(" → ") || "—"}</span>
                      <span>Round 2: {[...draftOrder].reverse().map((id) => teams.find((team) => team.id === id)?.team_name ?? `Team ${id}`).join(" → ") || "—"}</span>
                    </div>

                    <div className="g365-nhl-actions" style={styles.actions}>
                      <Button disabled={saving || draftOrder.length === 0} onClick={() => void saveManualDraftOrder()}>SAVE MANUAL DRAFT ORDER</Button>
                      <Button secondary disabled={saving} onClick={() => router.push(`/league/${leagueId}/nhl/draft`)}>OPEN LIVE DRAFT</Button>
                    </div>
                  </>
                ) : (
                  <div style={styles.notice}>
                    <strong>DRAFT ORDER LOCKED</strong>
                    <span>The draft is {pretty(draftState.status)}. Draft order cannot be changed after the draft begins. Reset the draft from the live Draft page before assigning a new order.</span>
                    <div className="g365-nhl-actions" style={styles.actions}>
                      <Button secondary disabled={saving} onClick={() => router.push(`/league/${leagueId}/nhl/draft`)}>OPEN LIVE DRAFT</Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </Section>
        ) : null}

        {tab === "matchups" && settings ? (
          <Section
            title="Matchup Schedule"
            subtitle="Generate the regular-season head-to-head schedule automatically or manually assign each matchup for an individual week. Playoff matchups remain separate."
          >
            <div className="g365-nhl-stats" style={styles.stats}>
              <Stat label="Regular Season" value={`${settings.regular_season_weeks} weeks`} />
              <Stat label="Active Teams" value={teams.filter((team) => team.active).length} />
              <Stat
                label="Scheduled Weeks"
                value={
                  new Set(
                    matchups
                      .filter(
                        (row) =>
                          row.week >= 1 &&
                          row.week <= settings.regular_season_weeks
                      )
                      .map((row) => row.week)
                  ).size
                }
              />
              <Stat
                label="Matchups"
                value={
                  matchups.filter(
                    (row) =>
                      row.week >= 1 &&
                      row.week <= settings.regular_season_weeks
                  ).length
                }
              />
            </div>

            <div style={styles.matchupGeneratePanel}>
              <div style={styles.matchupGenerateCopy}>
                <div style={styles.subsectionTitle}>AUTOMATIC SCHEDULE</div>
                <strong style={styles.matchupGenerateTitle}>
                  Generate Full Regular-Season Schedule
                </strong>
                <span style={styles.setupGroupText}>
                  G365 uses a balanced round-robin rotation. Odd-team leagues receive one bye each round. Repeated rotations flip home and away.
                </span>
              </div>
              <Button
                disabled={saving || teams.filter((team) => team.active).length < 2}
                onClick={() => void generateFullMatchupSchedule()}
              >
                {matchups.some(
                  (row) =>
                    row.week >= 1 &&
                    row.week <= settings.regular_season_weeks
                )
                  ? "REGENERATE FULL SCHEDULE"
                  : "GENERATE FULL SCHEDULE"}
              </Button>
            </div>

            <div style={styles.divider} />

            <div style={styles.matchupWeekToolbar}>
              <div>
                <div style={styles.subsectionTitle}>MANUAL WEEK EDITOR</div>
                <div style={styles.setupGroupText}>
                  Select a week and assign every Home/Away pairing. Each team can appear only once.
                </div>
              </div>
              <div style={styles.matchupWeekControls}>
                <Button
                  secondary
                  disabled={saving || matchupWeek <= 1}
                  onClick={() => setMatchupWeek((current) => Math.max(1, current - 1))}
                >
                  ← PREVIOUS
                </Button>
                <label style={styles.matchupWeekField}>
                  <span style={styles.fieldLabel}>WEEK</span>
                  <select
                    value={matchupWeek}
                    onChange={(event) => setMatchupWeek(Number(event.target.value))}
                    style={styles.input}
                  >
                    {Array.from(
                      { length: settings.regular_season_weeks },
                      (_, index) => index + 1
                    ).map((week) => (
                      <option key={week} value={week}>Week {week}</option>
                    ))}
                  </select>
                </label>
                <Button
                  secondary
                  disabled={saving || matchupWeek >= settings.regular_season_weeks}
                  onClick={() =>
                    setMatchupWeek((current) =>
                      Math.min(settings.regular_season_weeks, current + 1)
                    )
                  }
                >
                  NEXT →
                </Button>
              </div>
            </div>

            <div style={styles.matchupWeekBanner}>
              <div>
                <span style={styles.matchupWeekEyebrow}>REGULAR SEASON</span>
                <strong style={styles.matchupWeekTitle}>Week {matchupWeek}</strong>
              </div>
              <span style={styles.matchupWeekStatus}>
                {matchups.filter((row) => row.week === matchupWeek).length
                  ? `${matchups.filter((row) => row.week === matchupWeek).length} SAVED MATCHUPS`
                  : "NOT YET SAVED"}
              </span>
            </div>

            <div style={styles.matchupEditorList}>
              {manualMatchups.map((pair, index) => {
                const usedByOtherPairs = new Set(
                  manualMatchups
                    .filter((_, pairIndex) => pairIndex !== index)
                    .flatMap((otherPair) => [
                      otherPair.home_team_id,
                      otherPair.away_team_id,
                    ])
                    .filter((teamId): teamId is number => teamId != null)
                );

                return (
                  <div
                    key={`${matchupWeek}-${index}`}
                    className="g365-nhl-matchup-editor-row"
                    style={styles.matchupEditorRow}
                  >
                    <div style={styles.matchupNumber}>{index + 1}</div>

                    <label style={styles.field}>
                      <span style={styles.fieldLabel}>HOME TEAM</span>
                      <select
                        value={pair.home_team_id ?? ""}
                        onChange={(event) =>
                          updateManualMatchup(
                            index,
                            "home_team_id",
                            event.target.value ? Number(event.target.value) : null
                          )
                        }
                        style={styles.input}
                      >
                        <option value="">Select Home Team</option>
                        {teams.filter((team) => team.active).map((team) => (
                          <option
                            key={team.id}
                            value={team.id}
                            disabled={
                              team.id === pair.away_team_id ||
                              usedByOtherPairs.has(team.id)
                            }
                          >
                            {team.team_name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <div style={styles.matchupVs}>VS</div>

                    <label style={styles.field}>
                      <span style={styles.fieldLabel}>AWAY TEAM</span>
                      <select
                        value={pair.away_team_id ?? ""}
                        onChange={(event) =>
                          updateManualMatchup(
                            index,
                            "away_team_id",
                            event.target.value ? Number(event.target.value) : null
                          )
                        }
                        style={styles.input}
                      >
                        <option value="">Select Away Team</option>
                        {teams.filter((team) => team.active).map((team) => (
                          <option
                            key={team.id}
                            value={team.id}
                            disabled={
                              team.id === pair.home_team_id ||
                              usedByOtherPairs.has(team.id)
                            }
                          >
                            {team.team_name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <Button secondary disabled={saving} onClick={() => removeManualMatchup(index)}>
                      REMOVE
                    </Button>
                  </div>
                );
              })}
            </div>

            {teams.filter((team) => team.active).length % 2 === 1 ? (
              <div style={styles.notice}>
                <strong>ODD NUMBER OF TEAMS</strong>
                <span>
                  Leave exactly one active team unassigned; that franchise receives the Week {matchupWeek} bye.
                </span>
              </div>
            ) : null}

            <div className="g365-nhl-actions" style={styles.actions}>
              <Button
                secondary
                disabled={
                  saving ||
                  manualMatchups.length >=
                    Math.floor(teams.filter((team) => team.active).length / 2)
                }
                onClick={addManualMatchup}
              >
                + ADD MATCHUP
              </Button>
              <Button
                disabled={saving || manualMatchups.length === 0}
                onClick={() => void saveManualMatchupWeek()}
              >
                SAVE WEEK {matchupWeek} MATCHUPS
              </Button>
              <Button
                secondary
                disabled={saving}
                onClick={() => router.push(`/league/${leagueId}/nhl/matchups`)}
              >
                VIEW MEMBER MATCHUPS
              </Button>
            </div>

            <div style={styles.notice}>
              <strong>SCHEDULE PROTECTION</strong>
              <span>
                Started, scored, or completed weeks cannot be overwritten. Automatic generation affects regular-season weeks only and does not touch playoff matchups.
              </span>
            </div>
          </Section>
        ) : null}

        {tab === "roster" && settings && roster ? (
          <Section
            title="Roster & Lineup Requirements"
            subtitle={
              settings.position_mode === "fdg"
                ? "Simplified F/D/G roster configuration."
                : "Detailed C/LW/RW/D/G/UTIL roster configuration."
            }
          >
            <div style={styles.subsectionTitle}>STARTING LINEUP</div>
            <div className="g365-nhl-grid" style={styles.grid}>
              {settings.position_mode === "detailed" ? (
                <>
                  <NumberInput label="Starting C" value={roster.starting_c} min={0} max={20} onChange={(v) => setRoster({ ...roster, starting_c: v ?? 0 })} />
                  <NumberInput label="Starting LW" value={roster.starting_lw} min={0} max={20} onChange={(v) => setRoster({ ...roster, starting_lw: v ?? 0 })} />
                  <NumberInput label="Starting RW" value={roster.starting_rw} min={0} max={20} onChange={(v) => setRoster({ ...roster, starting_rw: v ?? 0 })} />
                  <NumberInput label="Starting D" value={roster.starting_d} min={0} max={20} onChange={(v) => setRoster({ ...roster, starting_d: v ?? 0 })} />
                  <NumberInput label="Starting G" value={roster.starting_g} min={1} max={10} onChange={(v) => setRoster({ ...roster, starting_g: v ?? 1 })} />
                  <NumberInput label="Starting UTIL" value={roster.starting_util} min={0} max={20} onChange={(v) => setRoster({ ...roster, starting_util: v ?? 0 })} />
                </>
              ) : (
                <>
                  <NumberInput label="Starting F" value={roster.starting_f} min={0} max={30} onChange={(v) => setRoster({ ...roster, starting_f: v ?? 0 })} />
                  <NumberInput label="Starting D" value={roster.starting_d} min={0} max={20} onChange={(v) => setRoster({ ...roster, starting_d: v ?? 0 })} />
                  <NumberInput label="Starting G" value={roster.starting_g} min={1} max={10} onChange={(v) => setRoster({ ...roster, starting_g: v ?? 1 })} />
                </>
              )}

              <NumberInput label="Bench Slots" value={roster.bench_slots} min={0} max={30} onChange={(v) => setRoster({ ...roster, bench_slots: v ?? 0 })} />
              <NumberInput label="IR Slots" value={roster.ir_slots} min={0} max={20} onChange={(v) => setRoster({ ...roster, ir_slots: v ?? 0 })} />
            </div>

            <div style={styles.divider} />

            <div style={styles.subsectionTitle}>MAXIMUM POSITION LIMITS</div>
            <p style={styles.sectionSub}>Leave a maximum blank when you do not want an additional position cap.</p>

            <div className="g365-nhl-grid" style={styles.grid}>
              {settings.position_mode === "detailed" ? (
                <>
                  <NumberInput label="Max C" value={roster.max_c} allowBlank min={roster.starting_c} onChange={(v) => setRoster({ ...roster, max_c: v })} />
                  <NumberInput label="Max LW" value={roster.max_lw} allowBlank min={roster.starting_lw} onChange={(v) => setRoster({ ...roster, max_lw: v })} />
                  <NumberInput label="Max RW" value={roster.max_rw} allowBlank min={roster.starting_rw} onChange={(v) => setRoster({ ...roster, max_rw: v })} />
                </>
              ) : (
                <NumberInput label="Max F" value={roster.max_f} allowBlank min={roster.starting_f} onChange={(v) => setRoster({ ...roster, max_f: v })} />
              )}
              <NumberInput label="Max D" value={roster.max_d} allowBlank min={roster.starting_d} onChange={(v) => setRoster({ ...roster, max_d: v })} />
              <NumberInput label="Max G" value={roster.max_g} allowBlank min={roster.starting_g} onChange={(v) => setRoster({ ...roster, max_g: v })} />
            </div>

            <div style={styles.rosterSummary}>
              <span>Active lineup</span>
              <strong>{totalActiveSlots}</strong>
              <span>Bench</span>
              <strong>{roster.bench_slots}</strong>
              <span>IR</span>
              <strong>{roster.ir_slots}</strong>
            </div>

            <div className="g365-nhl-actions" style={styles.actions}>
              <Button disabled={saving} onClick={() => void saveRosterSettings()}>
                SAVE ROSTER SETTINGS
              </Button>
            </div>
          </Section>
        ) : null}

        {tab === "scoring" && settings ? (
          <Section
            title={settings.scoring_system === "categories" ? "NHL Category Scoring" : "NHL Points Scoring"}
            subtitle={
              settings.scoring_system === "categories"
                ? "Choose the categories used in each weekly head-to-head matchup and whether higher or lower wins."
                : "Enable any NHL scoring option and assign its fantasy-point value."
            }
          >
            {settings.scoring_system === "categories" ? (
              <div style={styles.scoringSections}>
                {categoryGroups.map((group) => (
                  <div key={group.title} style={styles.scoringGroup}>
                    <div style={styles.subsectionTitle}>{group.title}</div>
                    <div className="g365-nhl-category-list" style={styles.categoryList}>
                      <div className="g365-nhl-category-header" style={styles.categoryHeader}>
                        <span>SCORING OPTION</span>
                        <span>RESULT</span>
                        <span>STATUS</span>
                      </div>
                      {group.keys.map((key) => {
                        const rule = categoryRules.find((row) => row.stat_key === key);
                        if (!rule) return null;
                        return (
                          <div key={key} className="g365-nhl-category-row" style={styles.categoryRow}>
                            <strong style={styles.categoryName}>{categoryLabels[key] ?? pretty(key)}</strong>
                            <select
                              value={rule.direction}
                              onChange={(e) =>
                                setCategoryRules((current) => current.map((row) =>
                                  row.stat_key === key ? { ...row, direction: e.target.value as "higher" | "lower" } : row
                                ))
                              }
                              style={styles.input}
                            >
                              <option value="higher">Higher Wins</option>
                              <option value="lower">Lower Wins</option>
                            </select>
                            <button
                              type="button"
                              onClick={() => setCategoryRules((current) => current.map((row) =>
                                row.stat_key === key ? { ...row, enabled: !row.enabled } : row
                              ))}
                              style={{ ...styles.toggle, ...(rule.enabled ? styles.toggleOn : {}) }}
                            >
                              {rule.enabled ? "ENABLED" : "DISABLED"}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
                <div style={styles.notice}>Every option shown here is also available in Points scoring. Category matchups use the selected Higher Wins or Lower Wins direction. G365 Quality Start requires a goalie start, game GAA of 2.50 or lower, and game SV% of .900 or higher. Teams must also meet the league's weekly goalie-start minimum or forfeit all enabled goalie categories; if both matchup teams miss it, the goalie categories are ties.</div>
                <div className="g365-nhl-actions" style={styles.actions}>
                  <Button disabled={saving || categoryRules.length === 0} onClick={() => void saveAllCategories()}>SAVE CATEGORIES</Button>
                </div>
              </div>
            ) : (
              <div style={styles.scoringSections}>
                {scoringGroups.map((group) => (
                  <div key={group.title} style={styles.scoringGroup}>
                    <div style={styles.subsectionTitle}>{group.title}</div>
                    <div className="g365-nhl-grid" style={styles.scoringGrid}>
                      {group.keys.map((key) => {
                        const rule = scoringRules.find((row) => row.stat_key === key);
                        if (!rule) return null;
                        return (
                          <div key={key} style={styles.scoringCard}>
                            <label style={styles.field}>
                              <span style={styles.fieldLabel}>{scoringLabels[key] ?? pretty(key)}</span>
                              <input
                                type="number" step="0.01" value={rule.points}
                                onChange={(e) => setScoringRules((current) => current.map((row) =>
                                  row.stat_key === key ? { ...row, points: e.target.value } : row
                                ))}
                                style={styles.input}
                              />
                            </label>
                            <button
                              type="button"
                              onClick={() => setScoringRules((current) => current.map((row) =>
                                row.stat_key === key ? { ...row, enabled: !row.enabled } : row
                              ))}
                              style={{ ...styles.toggle, ...(rule.enabled ? styles.toggleOn : {}) }}
                            >
                              {rule.enabled ? "ENABLED" : "DISABLED"}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
                <div style={styles.notice}>Teams must meet the league's weekly goalie-start minimum. If a team misses it, all goalie fantasy points for that matchup week become 0. Skater scoring is unaffected.</div>
                <div className="g365-nhl-actions" style={styles.actions}>
                  <Button disabled={saving || scoringRules.length === 0} onClick={() => void saveAllScoring()}>SAVE SCORING</Button>
                  <Button secondary disabled={saving} onClick={() => void resetScoring()}>RESET G365 DEFAULTS</Button>
                </div>
              </div>
            )}
          </Section>
        ) : null}
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", padding: "22px", background: "linear-gradient(180deg,#07080c,#0b0d12 50%,#07080b)", color: "#f5f7fa" },
  shell: { maxWidth: "1550px", margin: "0 auto" },
  hero: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "18px", padding: "22px", marginBottom: "16px", border: "1px solid rgba(255,92,40,.28)", borderRadius: "16px", background: "linear-gradient(135deg,rgba(140,14,14,.22),rgba(255,90,30,.08),rgba(255,255,255,.02))" },
  eyebrow: { color: "#ff6b2c", fontSize: "12px", fontWeight: 900, letterSpacing: ".14em" },
  title: { margin: "5px 0 0", fontSize: "34px", fontWeight: 950, letterSpacing: "-.03em" },
  subtitle: { margin: "7px 0 0", color: "#a5abb5", fontSize: "14px" },
  row: { display: "flex", gap: "8px", flexWrap: "wrap" },
  tabs: { display: "flex", flexWrap: "wrap", gap: "7px", padding: "9px", marginBottom: "16px", border: "1px solid rgba(255,255,255,.07)", borderRadius: "12px", background: "rgba(15,17,22,.88)" },
  tab: { border: "1px solid transparent", borderRadius: "7px", padding: "9px 12px", background: "transparent", color: "#a9aeb8", fontSize: "12px", fontWeight: 900, cursor: "pointer" },
  tabActive: { color: "#fff", border: "1px solid rgba(255,95,40,.32)", background: "linear-gradient(135deg,rgba(180,24,18,.34),rgba(255,95,30,.15))" },
  section: { padding: "18px", marginBottom: "16px", border: "1px solid rgba(255,255,255,.08)", borderRadius: "13px", background: "rgba(15,18,24,.9)" },
  sectionHead: { borderBottom: "1px solid rgba(255,255,255,.07)", paddingBottom: "12px", marginBottom: "14px" },
  sectionTitle: { margin: 0, fontSize: "20px", fontWeight: 950 },
  sectionSub: { margin: "5px 0 0", color: "#8f96a2", fontSize: "12px", lineHeight: 1.5 },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: "12px" },
  setupStack: { display: "grid", gap: "14px" },
  setupGroup: { padding: "16px", border: "1px solid rgba(255,255,255,.075)", borderRadius: "11px", background: "linear-gradient(180deg,rgba(255,255,255,.025),rgba(255,255,255,.012))" },
  setupGroupHead: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", marginBottom: "13px", paddingBottom: "11px", borderBottom: "1px solid rgba(255,255,255,.06)" },
  setupGroupText: { color: "#8f96a2", fontSize: "11px", lineHeight: 1.45, marginTop: "3px" },
  setupGrid3: { display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: "12px" },
  setupGrid4: { display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: "12px" },
  inlineHelp: { marginTop: "11px", padding: "9px 10px", borderLeft: "3px solid #ef531d", borderRadius: "0 7px 7px 0", background: "rgba(239,83,29,.06)", color: "#aeb4bd", fontSize: "11px", lineHeight: 1.45 },
  scoringSections: { display: "grid", gap: "18px" },
  scoringGroup: { padding: "14px", border: "1px solid rgba(255,255,255,.07)", borderRadius: "10px", background: "rgba(255,255,255,.012)" },
  categoryList: { overflow: "hidden", border: "1px solid rgba(255,255,255,.07)", borderRadius: "9px", background: "rgba(8,10,14,.42)" },
  categoryHeader: { display: "grid", gridTemplateColumns: "minmax(0,1fr) 170px 130px", gap: "12px", alignItems: "center", padding: "9px 12px", borderBottom: "1px solid rgba(255,255,255,.08)", background: "rgba(255,255,255,.025)", color: "#7f8793", fontSize: "10px", fontWeight: 900, letterSpacing: ".06em" },
  categoryRow: { display: "grid", gridTemplateColumns: "minmax(0,1fr) 170px 130px", gap: "12px", alignItems: "center", minHeight: "62px", padding: "10px 12px", borderBottom: "1px solid rgba(255,255,255,.055)" },
  categoryName: { minWidth: 0, fontSize: "13px", lineHeight: 1.3, color: "#e8ebef" },
  scoringGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: "10px" },
  field: { display: "flex", flexDirection: "column", gap: "6px", minWidth: 0 },
  fieldLabel: { color: "#9ba1ab", fontSize: "11px", fontWeight: 850 },
  input: { width: "100%", minHeight: "42px", boxSizing: "border-box", border: "1px solid rgba(255,255,255,.11)", borderRadius: "7px", padding: "9px 10px", background: "#0b0d12", color: "#f5f7fa", fontSize: "13px" },
  readOnly: { minHeight: "42px", display: "flex", alignItems: "center", boxSizing: "border-box", border: "1px solid rgba(255,255,255,.08)", borderRadius: "7px", padding: "9px 10px", background: "rgba(255,255,255,.025)", color: "#b7bdc6", fontSize: "13px" },
  button: { minHeight: "42px", border: "1px solid rgba(255,102,45,.36)", borderRadius: "7px", padding: "9px 13px", background: "linear-gradient(135deg,#b51b18,#ef531d)", color: "#fff", fontSize: "12px", fontWeight: 950, cursor: "pointer" },
  secondaryButton: { background: "#0b0d12", border: "1px solid rgba(255,255,255,.13)", color: "#e1e4e8" },
  disabled: { opacity: 0.45, cursor: "not-allowed" },
  actions: { display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "16px" },
  stats: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: "9px" },
  stat: { minHeight: "78px", padding: "11px", border: "1px solid rgba(255,255,255,.07)", borderRadius: "9px", background: "rgba(255,255,255,.025)", display: "flex", flexDirection: "column", justifyContent: "space-between", gap: "8px" },
  statLabel: { color: "#8f96a2", fontSize: "11px", fontWeight: 800 },
  statValue: { fontSize: "17px" },
  guideGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: "10px" },
  guide: { padding: "13px", border: "1px solid rgba(255,255,255,.07)", borderRadius: "9px", background: "rgba(255,255,255,.02)", fontSize: "12px", lineHeight: 1.5 },
  subPanel: { marginTop: "18px", padding: "15px", border: "1px solid rgba(255,95,35,.22)", borderRadius: "10px", background: "rgba(150,35,15,.055)" },
  subsectionTitle: { color: "#ff6a2a", fontSize: "12px", fontWeight: 950, letterSpacing: ".09em", marginBottom: "10px" },
  divider: { height: "1px", background: "rgba(255,255,255,.08)", margin: "20px 0" },
  notice: { display: "flex", flexDirection: "column", gap: "4px", marginTop: "14px", padding: "12px", border: "1px solid rgba(255,95,35,.35)", borderRadius: "9px", background: "rgba(165,45,15,.08)", color: "#d9c3b8", fontSize: "12px", lineHeight: 1.5 },
  rosterSummary: { display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: "8px", marginTop: "16px", padding: "12px", border: "1px solid rgba(255,255,255,.07)", borderRadius: "9px", background: "rgba(255,255,255,.02)", color: "#9ca3ad", fontSize: "11px" },
  scoringCard: { display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: "8px", alignItems: "end", padding: "11px", border: "1px solid rgba(255,255,255,.07)", borderRadius: "9px", background: "rgba(255,255,255,.018)" },
  teamSummary: { display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: "9px", marginBottom: "14px" },
  teamRowGroup: { borderBottom: "1px solid rgba(255,255,255,.055)" },
  inlineInvite: { margin: "0 12px 12px 56px", padding: "14px", border: "1px solid rgba(255,82,0,.38)", borderRadius: "10px", background: "linear-gradient(180deg, rgba(255,56,0,.07), rgba(255,255,255,.018))" },
  inlineInviteHeading: { display: "flex", justifyContent: "space-between", gap: "12px", marginBottom: "12px" },
  inlineInviteTitle: { color: "#ff5a1f", fontSize: "12px", letterSpacing: ".045em" },
  inlineInviteSub: { marginTop: "4px", color: "#8f96a2", fontSize: "11px" },
  inlineInviteGrid: { display: "grid", gridTemplateColumns: "minmax(140px,1fr) minmax(140px,1fr) minmax(220px,1.35fr) auto", gap: "10px", alignItems: "end" },
  inlineInviteActions: { display: "flex", flexWrap: "wrap", gap: "7px", alignItems: "center" },
  teamTable: { overflow: "hidden", border: "1px solid rgba(255,255,255,.08)", borderRadius: "10px", background: "rgba(8,10,14,.45)" },
  teamTableHeader: { display: "grid", gridTemplateColumns: "44px minmax(180px,1.35fr) minmax(150px,1fr) minmax(170px,1.05fr) 90px minmax(260px,1.35fr)", gap: "10px", alignItems: "center", padding: "9px 12px", borderBottom: "1px solid rgba(255,255,255,.08)", background: "rgba(255,255,255,.025)", color: "#8f96a2", fontSize: "10px", fontWeight: 900, letterSpacing: ".05em" },
  teamRows: { display: "grid" },
  teamRow: { display: "grid", gridTemplateColumns: "44px minmax(180px,1.35fr) minmax(150px,1fr) minmax(170px,1.05fr) 90px minmax(260px,1.35fr)", gap: "10px", alignItems: "center", padding: "11px 12px", borderBottom: "1px solid rgba(255,255,255,.065)" },
  teamNumber: { display: "flex", alignItems: "center", justifyContent: "center", width: "30px", height: "30px", borderRadius: "7px", background: "rgba(239,83,29,.09)", color: "#ff6a2a", fontSize: "12px" },
  compactField: { minWidth: 0 },
  mobileLabel: { display: "none", marginBottom: "5px", color: "#7f8793", fontSize: "9px", fontWeight: 900, letterSpacing: ".06em" },
  teamOwnerValue: { minHeight: "42px", display: "flex", alignItems: "center", padding: "0 10px", border: "1px solid rgba(255,255,255,.08)", borderRadius: "7px", background: "rgba(255,255,255,.025)", color: "#c6cbd3", fontSize: "12px" },
  statusStack: { display: "flex", flexDirection: "column", gap: "3px" },
  statusOwned: { color: "#79e6a6", fontSize: "10px" },
  statusCpu: { color: "#ffc06a", fontSize: "10px" },
  statusOpen: { color: "#ff8b57", fontSize: "10px" },
  statusSub: { color: "#7f8793", fontSize: "10px" },
  teamRowActions: { display: "flex", flexWrap: "wrap", justifyContent: "flex-end", gap: "6px", minWidth: 0 },
  teamFootnote: { marginTop: "12px", color: "#737b87", fontSize: "10px", lineHeight: 1.45 },
  teamList: { display: "grid", gap: "10px", marginTop: "16px" },
  teamCard: { padding: "14px", border: "1px solid rgba(255,255,255,.08)", borderRadius: "11px", background: "rgba(255,255,255,.02)" },
  teamCardHead: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", marginBottom: "12px" },
  teamTitle: { fontSize: "16px", color: "#f5f7fa" },
  teamGrid: { display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: "10px" },
  teamActions: { display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "12px" },
  badgeRow: { display: "flex", flexWrap: "wrap", justifyContent: "flex-end", gap: "6px" },
  badgeOpen: { padding: "5px 7px", borderRadius: "999px", border: "1px solid rgba(255,110,45,.3)", background: "rgba(190,55,20,.12)", color: "#ff8b57", fontSize: "10px", fontWeight: 950 },
  badgeOwned: { padding: "5px 7px", borderRadius: "999px", border: "1px solid rgba(70,220,130,.28)", background: "rgba(30,140,80,.12)", color: "#79e6a6", fontSize: "10px", fontWeight: 950 },
  badgeCpu: { padding: "5px 7px", borderRadius: "999px", border: "1px solid rgba(255,170,55,.28)", background: "rgba(180,100,20,.12)", color: "#ffc06a", fontSize: "10px", fontWeight: 950 },
  badgeMuted: { padding: "5px 7px", borderRadius: "999px", border: "1px solid rgba(255,255,255,.1)", background: "rgba(255,255,255,.04)", color: "#8f96a2", fontSize: "10px", fontWeight: 950 },
  toggle: { minHeight: "42px", border: "1px solid rgba(255,255,255,.12)", borderRadius: "7px", padding: "8px 10px", background: "#0b0d12", color: "#8e949e", fontSize: "11px", fontWeight: 900, cursor: "pointer" },
  toggleOn: { border: "1px solid rgba(75,220,130,.3)", background: "rgba(40,160,90,.14)", color: "#75e6a4" },
  draftToolbar: { display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "16px", flexWrap: "wrap", marginTop: "18px", marginBottom: "12px" },
  draftOrderList: { display: "grid", gap: "8px", marginTop: "12px" },
  draftOrderRow: { display: "grid", gridTemplateColumns: "52px minmax(180px,1fr) 100px minmax(190px,auto)", gap: "10px", alignItems: "center", padding: "11px 12px", border: "1px solid rgba(255,255,255,.08)", borderRadius: "9px", background: "rgba(255,255,255,.025)" },
  draftSlotNumber: { display: "flex", alignItems: "center", justifyContent: "center", width: "34px", height: "34px", borderRadius: "8px", background: "linear-gradient(135deg,rgba(225,45,20,.24),rgba(255,125,20,.13))", border: "1px solid rgba(255,95,25,.32)", color: "#ff7a2a", fontSize: "15px", fontWeight: 950 },
  draftTeamName: { display: "flex", flexDirection: "column", gap: "3px", minWidth: 0, color: "#f5f7fa", fontSize: "13px" },
  draftSlotField: { display: "grid", gap: "5px", minWidth: 0 },
  draftMoveButtons: { display: "flex", justifyContent: "flex-end", gap: "6px", flexWrap: "wrap" },
  snakePreview: { display: "grid", gap: "7px", marginTop: "14px", padding: "13px", border: "1px solid rgba(255,100,25,.18)", borderRadius: "9px", background: "rgba(185,55,15,.07)", color: "#aeb4bd", fontSize: "11px", lineHeight: 1.5 },
    matchupGeneratePanel: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "18px", flexWrap: "wrap", marginTop: "16px", padding: "16px", border: "1px solid rgba(255,95,35,.22)", borderRadius: "11px", background: "linear-gradient(135deg,rgba(165,35,15,.10),rgba(255,255,255,.018))" },
  matchupGenerateCopy: { display: "flex", flexDirection: "column", gap: "5px", flex: "1 1 420px", minWidth: 0 },
  matchupGenerateTitle: { color: "#f5f7fa", fontSize: "16px" },
  matchupWeekToolbar: { display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "16px", flexWrap: "wrap" },
  matchupWeekControls: { display: "flex", alignItems: "flex-end", gap: "8px", flexWrap: "wrap" },
  matchupWeekField: { display: "grid", gap: "5px", minWidth: "120px" },
  matchupWeekBanner: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap", marginTop: "16px", padding: "13px 15px", border: "1px solid rgba(255,95,35,.25)", borderRadius: "10px", background: "linear-gradient(90deg,rgba(170,28,18,.13),rgba(255,100,25,.045))" },
  matchupWeekEyebrow: { display: "block", color: "#ff6a2a", fontSize: "9px", fontWeight: 950, letterSpacing: ".11em", marginBottom: "3px" },
  matchupWeekTitle: { display: "block", color: "#fff", fontSize: "20px" },
  matchupWeekStatus: { padding: "6px 9px", borderRadius: "999px", border: "1px solid rgba(255,255,255,.10)", background: "rgba(255,255,255,.035)", color: "#aeb4bd", fontSize: "9px", fontWeight: 950, letterSpacing: ".04em" },
  matchupEditorList: { display: "grid", gap: "9px", marginTop: "12px" },
  matchupEditorRow: { display: "grid", gridTemplateColumns: "44px minmax(180px,1fr) 42px minmax(180px,1fr) auto", gap: "10px", alignItems: "end", padding: "12px", border: "1px solid rgba(255,255,255,.075)", borderRadius: "10px", background: "rgba(255,255,255,.02)" },
  matchupNumber: { alignSelf: "center", display: "flex", alignItems: "center", justifyContent: "center", width: "32px", height: "32px", borderRadius: "8px", border: "1px solid rgba(255,95,35,.28)", background: "rgba(225,55,20,.10)", color: "#ff7431", fontSize: "13px", fontWeight: 950 },
  matchupVs: { alignSelf: "center", justifySelf: "center", color: "#6f7681", fontSize: "10px", fontWeight: 950, letterSpacing: ".08em" },
  error: { marginBottom: "12px", padding: "11px 13px", borderRadius: "8px", border: "1px solid rgba(255,70,70,.32)", background: "rgba(150,20,20,.18)", color: "#ff9c9c", fontSize: "13px", fontWeight: 750 },
  success: { marginBottom: "12px", padding: "11px 13px", borderRadius: "8px", border: "1px solid rgba(70,220,130,.28)", background: "rgba(30,140,80,.14)", color: "#79e6a6", fontSize: "13px", fontWeight: 750 },
  center: { padding: "80px 20px", textAlign: "center", color: "#c5c9d1", fontSize: "16px" },
  denied: { maxWidth: "620px", margin: "100px auto", padding: "28px", textAlign: "center", border: "1px solid rgba(255,80,60,.25)", borderRadius: "14px", background: "rgba(20,20,24,.94)" },
};