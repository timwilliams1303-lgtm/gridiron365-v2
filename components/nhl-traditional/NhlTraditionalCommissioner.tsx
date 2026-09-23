"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";
import NhlDynastyLotteryOfficial from "@/components/nhl-traditional/NhlDynastyLotteryOfficial";

type Tab =
  | "overview"
  | "league"
  | "teams"
  | "draft"
  | "matchups"
  | "trades"
  | "roster"
  | "scoring"
  | "corrections";

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
  playoff_reseeding: boolean;
  divisions_enabled: boolean;
  division_playoff_mode: "overall" | "division_winners_qualify" | "division_winners_top_seeds";
  playoff_tiebreaker:
    | "higher_seed"
    | "regular_season_head_to_head"
    | "regular_season_points";
  trade_deadline_at: string | null;
  trade_deadline_week: number | null;
  trade_review_mode: "none" | "commissioner";
  waiver_mode: "rolling" | "reverse_standings" | "faab";
  faab_budget: number | null;
  dynasty_rookie_rounds: number;
  dynasty_future_pick_years: number;
  dynasty_rosters_carry_over: boolean;
  dynasty_protected_players: number;
  dynasty_protection_deadline_week: number | null;
  dynasty_protection_deadline_day: number | null;
  dynasty_protection_deadline_time: string | null;
  dynasty_protection_status: "protection_closed" | "protection_open" | "protection_locked";
  dynasty_protection_deadline: string | null;
  dynasty_protection_opened_at: string | null;
  dynasty_protection_locked_at: string | null;
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
  nhl_traditional_franchise_id: string | null;
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

type AnnualDraft = {
  id: string;
  season: number;
  status: string;
  rounds: number;
  seconds_per_pick: number | null;
  draft_order_method: string | null;
  draft_type: string;
};

type AnnualDraftPickAsset = {
  id: number;
  draft_id: string | null;
  draft_season: number;
  round_number: number;
  original_fantasy_team_id: number;
  current_fantasy_team_id: number;
  pick_number: number | null;
  overall_pick: number | null;
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

type NhlDivision = {
  id: number;
  league_id: string;
  season: number;
  name: string;
  sort_order: number;
};

type NhlTeamDivision = {
  id: number;
  league_id: string;
  season: number;
  fantasy_team_id: number;
  division_id: number;
};

type TradeReviewPlayer = {
  tradePlayerId: number;
  nhlPlayerId: number;
  playerName: string;
  position: string | null;
  headshotUrl: string | null;
  fromFantasyTeamId: number;
  fromTeamName: string;
  toFantasyTeamId: number;
  toTeamName: string;
};

type TradeReviewDraftPick = {
  tradeDraftPickId: number;
  draftPickAssetId: number;
  draftSeason: number;
  roundNumber: number;
  pickNumber: number | null;
  overallPick: number | null;
  leagueFormat: string;
  draftType: string;
  originalFantasyTeamId: number;
  originalTeamName: string;
  fromFantasyTeamId: number;
  fromTeamName: string;
  toFantasyTeamId: number;
  toTeamName: string;
};

type TradeReviewItem = {
  tradeOfferId: number;
  leagueId: string;
  season: number;
  status: string;
  message: string | null;
  proposedAt: string | null;
  acceptedByReceiverAt: string | null;
  reviewRequestedAt: string | null;
  proposingTeam: { fantasyTeamId: number; teamName: string };
  receivingTeam: { fantasyTeamId: number; teamName: string };
  players: TradeReviewPlayer[];
  draftPicks: TradeReviewDraftPick[];
  draftContext: {
    draftId: string;
    overallPick: number | null;
    round: number | null;
    pickInRound: number | null;
    draftStatus: string | null;
  } | null;
};

type TradeReviewQueue = {
  success: boolean;
  leagueId: string;
  season: number;
  pendingReviewCount: number;
  trades: TradeReviewItem[];
};

type ProtectionSelection = {
  fantasy_team_id: number;
  nhl_player_id: number;
  source_season: number;
  target_season: number;
  status: "selected" | "locked" | "carried_over" | string;
};

type OffseasonCalendar = {
  success: boolean;
  leagueId: string;
  season: number;
  calendarAvailable?: boolean;
  seasonComplete: boolean;
  seasonCompletedAt: string | null;
  finalFantasyDate?: string | null;
  scheduledSeasonEndsAt?: string | null;
  seasonCompletedDate?: string | null;
  offseasonWeek1StartsOn: string | null;
};

type DynastyChecklistItem = {
  key: string;
  label: string;
  complete: boolean;
  required: boolean;
  [key: string]: unknown;
};

type DynastySeasonChecklist = {
  success: boolean;
  leagueId: string;
  leagueStatus: string;
  currentLeagueSeason: number;
  checklistType: "startup" | "offseason";
  sourceSeason: number | null;
  targetSeason: number;
  readyToActivate: boolean;
  draftId: string | null;
  draftStatus: string | null;
  draftOrderMethod: string | null;
  activeTeams: number;
  rosterSize: number;
  items: DynastyChecklistItem[];
};

function parseLocalDateOnly(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

function formatOffseasonDate(value: Date) {
  return value.toLocaleDateString([], { month: "short", day: "numeric" });
}

type CorrectionPlayer = {
  id: number;
  name: string;
  position: string | null;
  team: string | null;
};

type CorrectionGameStat = {
  id: number;
  season: number;
  nhl_game_id: number;
  nhl_player_id: number;
  fantasy_points: number | string | null;
  game_date: string | null;
  opponent: string | null;
  raw: Record<string, unknown>;
};

type StatCorrection = {
  id: number;
  league_id: string;
  season: number;
  nhl_game_id: number;
  nhl_player_id: number;
  nhl_player_game_stat_id: number | null;
  correction_type: "fantasy_points" | "stat" | string;
  adjustment: number | string | null;
  stat_key: string | null;
  stat_adjustment: number | string | null;
  reason: string;
  created_at: string;
  reversed_at: string | null;
  reversal_reason: string | null;
};

const correctionStatOptions = [
  ["goals", "Goals"], ["assists", "Assists"], ["points", "Points"],
  ["plus_minus", "Plus / Minus"], ["penalty_minutes", "Penalty Minutes"],
  ["power_play_goals", "Power-Play Goals"], ["power_play_assists", "Power-Play Assists"],
  ["power_play_points", "Power-Play Points"], ["short_handed_goals", "Short-Handed Goals"],
  ["short_handed_assists", "Short-Handed Assists"], ["short_handed_points", "Short-Handed Points"],
  ["game_winning_goals", "Game-Winning Goals"], ["shots_on_goal", "Shots on Goal"],
  ["hits", "Hits"], ["blocked_shots", "Blocked Shots"], ["takeaways", "Takeaways"],
  ["giveaways", "Giveaways"], ["faceoff_wins", "Faceoff Wins"], ["faceoff_losses", "Faceoff Losses"],
  ["shifts", "Shifts"], ["time_on_ice_seconds", "Time on Ice (seconds)"], ["saves", "Saves"],
  ["shots_against", "Shots Against"], ["goals_against", "Goals Against"],
  ["goalie_minutes_seconds", "Goalie Minutes (seconds)"], ["goalie_win", "Goalie Win"],
  ["goalie_loss", "Goalie Loss"], ["goalie_overtime_loss", "Goalie Overtime Loss"],
  ["shutout", "Shutout"], ["goalie_started", "Goalie Started"]
] as const;

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
  const [divisions, setDivisions] = useState<NhlDivision[]>([]);
  const [teamDivisions, setTeamDivisions] = useState<NhlTeamDivision[]>([]);
  const [draftTimerSeconds, setDraftTimerSeconds] = useState(90);
  const [protectionSelections, setProtectionSelections] = useState<ProtectionSelection[]>([]);
  const [protectionPanelCollapsed, setProtectionPanelCollapsed] = useState(false);
  const [offseasonCalendar, setOffseasonCalendar] = useState<OffseasonCalendar | null>(null);
  const [dynastyChecklist, setDynastyChecklist] = useState<DynastySeasonChecklist | null>(null);
  const [activatingSeason, setActivatingSeason] = useState(false);
  const [annualDraft, setAnnualDraft] = useState<AnnualDraft | null>(null);
  const [annualDraftTeams, setAnnualDraftTeams] = useState<DraftTeam[]>([]);
  const [annualDraftPickAssets, setAnnualDraftPickAssets] = useState<AnnualDraftPickAsset[]>([]);
  const [tradeReviewQueue, setTradeReviewQueue] = useState<TradeReviewQueue | null>(null);
  const [tradeReviewNotes, setTradeReviewNotes] = useState<Record<number, string>>({});
  const [tradeReviewActionId, setTradeReviewActionId] = useState<number | null>(null);
  const [correctionPlayers, setCorrectionPlayers] = useState<CorrectionPlayer[]>([]);
  const [correctionPlayerQuery, setCorrectionPlayerQuery] = useState("");
  const [correctionSelectedPlayerId, setCorrectionSelectedPlayerId] = useState<number | null>(null);
  const [correctionGameStats, setCorrectionGameStats] = useState<CorrectionGameStat[]>([]);
  const [correctionSelectedStatId, setCorrectionSelectedStatId] = useState<number | null>(null);
  const [corrections, setCorrections] = useState<StatCorrection[]>([]);
  const [correctionAdjustment, setCorrectionAdjustment] = useState("");
  const [correctionStatKey, setCorrectionStatKey] = useState<string>("goals");
  const [correctionReason, setCorrectionReason] = useState("");
  const [correctionReverseReasons, setCorrectionReverseReasons] = useState<Record<number, string>>({});
  const [correctionBusy, setCorrectionBusy] = useState(false);


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
      supabase.from("fantasy_teams").select("id,owner_id,team_name,active,is_cpu,cpu_auto_draft,nhl_traditional_franchise_id").eq("league_id", leagueId).order("id"),
      supabase.from("league_members").select("user_id,role").eq("league_id", leagueId),
      supabase.rpc("get_nhl_traditional_draft_state", { p_league_id: leagueId }),
      supabase
        .from("nhl_traditional_matchups")
        .select("id,week,home_fantasy_team_id,away_fantasy_team_id,home_score,away_score,status,winner_fantasy_team_id,is_tie")
        .eq("league_id", leagueId)
        .order("week", { ascending: true })
        .order("id", { ascending: true }),
      supabase.rpc("get_nhl_dynasty_offseason_calendar", {
        p_league_id: leagueId,
        p_season: null,
      }),
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
    setOffseasonCalendar((results[10].data ?? null) as OffseasonCalendar | null);

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
      setDraftOrder(
        nextDraftTeams.length > 0
          ? nextDraftTeams.map((row) => row.fantasy_team_id)
          : teamRows
              .filter((team) => team.active)
              .slice(0, Number((results[1].data as NhlSettings).max_teams ?? teamRows.length))
              .map((team) => team.id)
      );
    } else {
      setDraftTeams([]);
      setDraftOrder([]);
    }

    setActiveTeams(teamRows.filter((team) => team.active).length);
    setTeamNames(Object.fromEntries(teamRows.map((team) => [team.id, team.team_name])));

    const loadedSettings = results[1].data as NhlSettings;

    if (loadedSettings.league_format === "dynasty") {
      const checklistResult = await supabase.rpc("get_nhl_dynasty_season_checklist", {
        p_league_id: leagueId,
        p_target_season: null,
      });

      if (checklistResult.error) {
        setError(checklistResult.error.message);
        setLoading(false);
        return;
      }

      setDynastyChecklist((checklistResult.data ?? null) as DynastySeasonChecklist | null);
    } else {
      setDynastyChecklist(null);
    }

    const [divisionsResult, teamDivisionsResult] = await Promise.all([
      supabase
        .from("nhl_traditional_divisions")
        .select("id,league_id,season,name,sort_order")
        .eq("league_id", leagueId)
        .eq("season", Number(loadedSettings.season))
        .order("sort_order", { ascending: true }),
      supabase
        .from("nhl_traditional_team_divisions")
        .select("id,league_id,season,fantasy_team_id,division_id")
        .eq("league_id", leagueId)
        .eq("season", Number(loadedSettings.season)),
    ]);

    if (divisionsResult.error || teamDivisionsResult.error) {
      setError(
        divisionsResult.error?.message ??
          teamDivisionsResult.error?.message ??
          "NHL divisions could not be loaded."
      );
      setLoading(false);
      return;
    }

    setDivisions((divisionsResult.data ?? []) as NhlDivision[]);
    setTeamDivisions((teamDivisionsResult.data ?? []) as NhlTeamDivision[]);

    const reviewQueueResult = await supabase.rpc("get_nhl_traditional_trade_review_queue", {
      p_league_id: leagueId,
      p_season: Number(loadedSettings.season),
    });

    if (reviewQueueResult.error) {
      setError(reviewQueueResult.error.message);
      setLoading(false);
      return;
    }

    setTradeReviewQueue((reviewQueueResult.data ?? null) as TradeReviewQueue | null);
    if (loadedSettings.league_format === "dynasty") {
      const targetSeason = Number(loadedSettings.season) + 1;
      const protectionResult = await supabase
        .from("nhl_dynasty_keeper_selections")
        .select("fantasy_team_id,nhl_player_id,source_season,target_season,status")
        .eq("league_id", leagueId)
        .eq("source_season", Number(loadedSettings.season))
        .eq("target_season", targetSeason);

      if (!protectionResult.error) {
        setProtectionSelections(
          (protectionResult.data ?? []) as ProtectionSelection[]
        );
      } else {
        // Protection controls remain usable even if direct selection visibility
        // is restricted by RLS. The backend RPCs remain authoritative.
        setProtectionSelections([]);
      }
    } else {
      setProtectionSelections([]);
    }

    if (loadedSettings.league_format === "dynasty") {
      const annualSeason = Number(loadedSettings.season) + 1;
      const annualDraftResult = await supabase
        .from("nhl_traditional_drafts")
        .select("id,season,status,rounds,seconds_per_pick,draft_order_method,draft_type")
        .eq("league_id", leagueId)
        .eq("season", annualSeason)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (annualDraftResult.error) {
        setError(annualDraftResult.error.message);
        setLoading(false);
        return;
      }

      const nextAnnualDraft = (annualDraftResult.data ?? null) as AnnualDraft | null;
      setAnnualDraft(nextAnnualDraft);

      if (nextAnnualDraft?.id) {
        const [annualTeamsResult, annualAssetsResult] = await Promise.all([
          supabase
            .from("nhl_traditional_draft_teams")
            .select("id,draft_id,fantasy_team_id,draft_slot,is_cpu")
            .eq("draft_id", nextAnnualDraft.id)
            .order("draft_slot", { ascending: true }),
          supabase
            .from("nhl_dynasty_draft_pick_assets")
            .select("id,draft_id,draft_season,round_number,original_fantasy_team_id,current_fantasy_team_id,pick_number,overall_pick")
            .eq("league_id", leagueId)
            .eq("draft_season", annualSeason)
            .order("overall_pick", { ascending: true }),
        ]);

        if (annualTeamsResult.error || annualAssetsResult.error) {
          setError(annualTeamsResult.error?.message ?? annualAssetsResult.error?.message ?? "Annual Dynasty draft could not be loaded.");
          setLoading(false);
          return;
        }

        setAnnualDraftTeams((annualTeamsResult.data ?? []) as DraftTeam[]);
        setAnnualDraftPickAssets((annualAssetsResult.data ?? []) as AnnualDraftPickAsset[]);
      } else {
        setAnnualDraftTeams([]);
        setAnnualDraftPickAssets([]);
      }
    } else {
      setAnnualDraft(null);
      setAnnualDraftTeams([]);
      setAnnualDraftPickAssets([]);
    }

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

  async function activateDynastySeason() {
    if (!dynastyChecklist || activatingSeason || saving) return;

    if (!dynastyChecklist.readyToActivate) {
      setError(`Complete the required ${dynastyChecklist.targetSeason} Dynasty checklist items before activation.`);
      return;
    }

    const season = dynastyChecklist.targetSeason;
    const label = dynastyChecklist.checklistType === "startup" ? "startup" : "offseason";

    if (
      !window.confirm(
        `Activate the ${season} NHL Dynasty season?\n\n` +
          `This will complete the ${label} transition, prepare the season schedule, sync future Dynasty picks, and run the NHL lifecycle.`
      )
    ) {
      return;
    }

    setActivatingSeason(true);
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await supabase.rpc("commissioner_activate_nhl_dynasty_season", {
        p_league_id: leagueId,
        p_target_season: season,
      });

      if (result.error) throw new Error(result.error.message);

      await load(false);
      setSuccess(`${season} NHL Dynasty season activated.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : `${season} season could not be activated.`);
    } finally {
      setActivatingSeason(false);
      setSaving(false);
    }
  }

  async function prepareDraft() {
    await runAction(
      () => supabase.rpc("prepare_nhl_traditional_draft", { p_league_id: leagueId }),
      "NHL draft prepared."
    );
  }

  async function chooseDynastyStartupManual() {
    if (!settings || settings.league_format !== "dynasty") return;

    if (
      !window.confirm(
        `Use Manual Draft Order for the ${settings.season} Dynasty startup draft?\n\n` +
          "You will arrange every active franchise below and save the official Round 1 order. The startup draft will snake automatically after Round 1."
      )
    ) {
      return;
    }

    await runAction(
      () =>
        supabase.rpc("commissioner_choose_nhl_dynasty_startup_manual", {
          p_league_id: leagueId,
          p_draft_season: Number(settings.season),
        }),
      `${settings.season} Dynasty startup draft set to Manual Draft Order.`
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

  async function reviewTrade(
    trade: TradeReviewItem,
    action: "approve" | "veto"
  ) {
    if (tradeReviewActionId !== null) return;

    const verb = action === "approve" ? "approve" : "veto";
    const confirmed = window.confirm(
      `${action === "approve" ? "Approve" : "Veto"} trade #${trade.tradeOfferId} between ${trade.proposingTeam.teamName} and ${trade.receivingTeam.teamName}?`
    );
    if (!confirmed) return;

    setTradeReviewActionId(trade.tradeOfferId);
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const rpcName =
        action === "approve"
          ? "commissioner_approve_nhl_traditional_trade"
          : "commissioner_veto_nhl_traditional_trade";

      const result = await supabase.rpc(rpcName, {
        p_trade_offer_id: trade.tradeOfferId,
        p_review_note: tradeReviewNotes[trade.tradeOfferId]?.trim() || null,
      });

      if (result.error) throw new Error(result.error.message);

      setTradeReviewNotes((current) => {
        const next = { ...current };
        delete next[trade.tradeOfferId];
        return next;
      });

      await load(false);
      setSuccess(
        action === "approve"
          ? `Trade #${trade.tradeOfferId} approved and completed.`
          : `Trade #${trade.tradeOfferId} vetoed.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : `Trade could not be ${verb}d.`);
    } finally {
      setTradeReviewActionId(null);
      setSaving(false);
    }
  }

  function correctionPlayerName(row: Record<string, unknown>) {
    const direct = row.full_name ?? row.display_name ?? row.name ?? row.player_name;
    if (typeof direct === "string" && direct.trim()) return direct.trim();
    const first = typeof row.first_name === "string" ? row.first_name.trim() : "";
    const last = typeof row.last_name === "string" ? row.last_name.trim() : "";
    return `${first} ${last}`.trim() || `Player #${String(row.id ?? "")}`;
  }

  async function loadCorrectionPlayers() {
    if (!settings) return;
    setCorrectionBusy(true);
    setError(null);
    try {
      const result = await supabase.from("nhl_players").select("*").order("id", { ascending: true }).limit(3000);
      if (result.error) throw new Error(result.error.message);
      const rows = (result.data ?? []) as Array<Record<string, unknown>>;
      setCorrectionPlayers(rows.map((row) => ({
        id: Number(row.id),
        name: correctionPlayerName(row),
        position: typeof row.position === "string" ? row.position : null,
        team: typeof row.team_abbreviation === "string" ? row.team_abbreviation : typeof row.team === "string" ? row.team : null,
      })).filter((row) => Number.isFinite(row.id)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "NHL players could not be loaded.");
    } finally {
      setCorrectionBusy(false);
    }
  }

  async function loadCorrectionPlayerGames(playerId: number) {
    if (!settings) return;
    setCorrectionBusy(true);
    setError(null);
    setSuccess(null);
    setCorrectionSelectedPlayerId(playerId);
    setCorrectionSelectedStatId(null);
    try {
      const result = await supabase
        .from("nhl_player_game_stats")
        .select("*")
        .eq("season", Number(settings.season))
        .eq("nhl_player_id", playerId)
        .order("id", { ascending: false })
        .limit(100);
      if (result.error) throw new Error(result.error.message);
      const rows = (result.data ?? []) as Array<Record<string, unknown>>;
      setCorrectionGameStats(rows.map((row) => ({
        id: Number(row.id), season: Number(row.season), nhl_game_id: Number(row.nhl_game_id),
        nhl_player_id: Number(row.nhl_player_id),
        fantasy_points: (row.fantasy_points as number | string | null | undefined) ?? null,
        game_date: typeof row.game_date === "string" ? row.game_date : typeof row.stat_date === "string" ? row.stat_date : null,
        opponent: typeof row.opponent_abbreviation === "string" ? row.opponent_abbreviation : typeof row.opponent === "string" ? row.opponent : null,
        raw: row,
      })).filter((row) => Number.isFinite(row.id)));
      await loadCorrectionHistory(playerId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Player games could not be loaded.");
    } finally {
      setCorrectionBusy(false);
    }
  }

  async function loadCorrectionHistory(playerId?: number | null) {
    if (!settings) return;
    let query = supabase.from("nhl_traditional_stat_corrections").select("*")
      .eq("league_id", leagueId).eq("season", Number(settings.season))
      .order("created_at", { ascending: false }).limit(100);
    if (playerId) query = query.eq("nhl_player_id", playerId);
    const result = await query;
    if (result.error) throw new Error(result.error.message);
    setCorrections((result.data ?? []) as StatCorrection[]);
  }

  async function applyCorrection() {
    if (!settings || !correctionSelectedStatId || correctionBusy) return;
    const amount = Number(correctionAdjustment);
    const reason = correctionReason.trim();
    if (!Number.isFinite(amount) || amount === 0) { setError("Enter a non-zero correction adjustment."); return; }
    if (reason.length < 3) { setError("Enter a correction reason of at least 3 characters."); return; }
    if (correctionStatKey === "goalie_started" && ![-1, 1].includes(amount)) { setError("Goalie Started adjustments must be +1 or -1."); return; }
    const selected = correctionGameStats.find((row) => row.id === correctionSelectedStatId);
    if (!selected) { setError("Select a player game first."); return; }
    const player = correctionPlayers.find((row) => row.id === selected.nhl_player_id);
    if (!window.confirm(`Apply this correction to ${player?.name ?? `Player #${selected.nhl_player_id}`}?\n\nAdjustment: ${amount > 0 ? "+" : ""}${amount}\nReason: ${reason}`)) return;
    setCorrectionBusy(true); setSaving(true); setError(null); setSuccess(null);
    try {
      const result = settings.scoring_system === "categories"
        ? await supabase.rpc("commissioner_apply_nhl_traditional_category_stat_correction", {
            p_league_id: leagueId, p_player_game_stat_id: correctionSelectedStatId,
            p_stat_key: correctionStatKey, p_stat_adjustment: amount, p_reason: reason,
          })
        : await supabase.rpc("commissioner_apply_nhl_traditional_stat_correction", {
            p_league_id: leagueId, p_player_game_stat_id: correctionSelectedStatId,
            p_adjustment: amount, p_reason: reason,
          });
      if (result.error) throw new Error(result.error.message);
      setCorrectionAdjustment(""); setCorrectionReason("");
      await loadCorrectionPlayerGames(selected.nhl_player_id);
      setSuccess("NHL stat correction applied and propagated through official league results.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Correction could not be applied.");
    } finally { setCorrectionBusy(false); setSaving(false); }
  }

  async function reverseCorrection(row: StatCorrection) {
    const reason = (correctionReverseReasons[row.id] ?? "").trim();
    if (reason.length < 3) { setError("Enter a reversal reason of at least 3 characters."); return; }
    if (!window.confirm(`Reverse correction #${row.id}?\n\nThe reversal is permanent in the audit history.`)) return;
    setCorrectionBusy(true); setSaving(true); setError(null); setSuccess(null);
    try {
      const rpcName = row.correction_type === "stat"
        ? "commissioner_reverse_nhl_traditional_category_stat_correction"
        : "commissioner_reverse_nhl_traditional_stat_correction";
      const result = await supabase.rpc(rpcName, {
        p_league_id: leagueId, p_correction_id: row.id, p_reason: reason,
      });
      if (result.error) throw new Error(result.error.message);
      setCorrectionReverseReasons((current) => ({ ...current, [row.id]: "" }));
      if (correctionSelectedPlayerId) await loadCorrectionPlayerGames(correctionSelectedPlayerId);
      else await loadCorrectionHistory();
      setSuccess(`Correction #${row.id} reversed and official results recalculated.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Correction could not be reversed.");
    } finally { setCorrectionBusy(false); setSaving(false); }
  }

  async function saveDivisionSettings(nextSettings: NhlSettings) {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await supabase.rpc("update_nhl_traditional_settings", {
        p_league_id: leagueId,
        p_league_format: nextSettings.league_format,
        p_position_mode: nextSettings.position_mode,
        p_max_teams: nextSettings.max_teams,
        p_regular_season_weeks: nextSettings.regular_season_weeks,
        p_playoff_team_count: nextSettings.playoff_team_count,
        p_playoff_weeks: nextSettings.playoff_weeks,
        p_allow_daily_lineup_changes: nextSettings.allow_daily_lineup_changes,
        p_player_lock_mode: "individual_game",
        p_waiver_mode: nextSettings.waiver_mode,
        p_faab_budget: nextSettings.waiver_mode === "faab" ? nextSettings.faab_budget : null,
        p_trade_deadline_at: null,
        p_trade_deadline_week: nextSettings.trade_deadline_week,
        p_trade_review_mode: nextSettings.trade_review_mode ?? "none",
        p_dynasty_rookie_rounds: nextSettings.dynasty_rookie_rounds,
        p_dynasty_future_pick_years: nextSettings.dynasty_future_pick_years,
        p_dynasty_rosters_carry_over: nextSettings.dynasty_rosters_carry_over,
        p_dynasty_protected_players: nextSettings.dynasty_protected_players,
        p_dynasty_protection_deadline_week: nextSettings.dynasty_protection_deadline_week,
        p_dynasty_protection_deadline_day: nextSettings.dynasty_protection_deadline_day,
        p_dynasty_protection_deadline_time: "00:00:00",
        p_playoff_reseeding: nextSettings.playoff_reseeding ?? false,
        p_playoff_tiebreaker: nextSettings.playoff_tiebreaker ?? "higher_seed",
        p_divisions_enabled: nextSettings.divisions_enabled,
        p_division_playoff_mode: nextSettings.divisions_enabled
          ? nextSettings.division_playoff_mode ?? "overall"
          : "overall",
      });

      if (result.error) throw new Error(result.error.message);
      setSettings(nextSettings);
      await load(false);
      setSuccess(nextSettings.divisions_enabled ? "Divisions enabled." : "Divisions disabled.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Division setting could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleDivisions(value: boolean) {
    if (!settings || saving) return;

    const previousSettings = settings;
    const nextSettings: NhlSettings = {
      ...settings,
      divisions_enabled: value,
      division_playoff_mode: value
        ? settings.division_playoff_mode ?? "overall"
        : "overall",
    };

    // Flip the control immediately so the commissioner gets instant feedback.
    // The RPC remains authoritative; restore the prior state if the save fails.
    setSettings(nextSettings);

    try {
      await saveDivisionSettings(nextSettings);

      // First-time enablement should immediately build the standard layout.
      // No extra "Add Division" step and no typing division names.
      if (value && divisions.length === 0) {
        await configureDivisionCount(2);
      }
    } catch {
      setSettings(previousSettings);
    }
  }

  async function saveDivisionPlayoffMode(value: NhlSettings["division_playoff_mode"]) {
    if (!settings || saving) return;
    const nextSettings: NhlSettings = { ...settings, division_playoff_mode: value };
    await saveDivisionSettings(nextSettings);
  }

  async function configureDivisionCount(targetCount: number) {
    if (!settings || saving) return;

    const active = teams.filter((team) => team.active).slice(0, settings.max_teams);
    if (targetCount < 2 || targetCount > 4) {
      setError("Choose between 2 and 4 divisions.");
      return;
    }
    if (targetCount > active.length) {
      setError("There cannot be more divisions than active teams.");
      return;
    }

    if (
      divisions.length > targetCount &&
      !window.confirm(
        `Change from ${divisions.length} divisions to ${targetCount}? G365 will rebuild the division layout and redistribute all active teams evenly.`
      )
    ) {
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const ordered = [...divisions].sort((a, b) => a.sort_order - b.sort_order);

      // Remove extra divisions from the end first. Their team assignments cascade away.
      for (let index = ordered.length - 1; index >= targetCount; index -= 1) {
        const result = await supabase.rpc("manage_nhl_traditional_division", {
          p_league_id: leagueId,
          p_season: Number(settings.season),
          p_action: "delete",
          p_division_id: ordered[index].id,
          p_name: null,
          p_sort_order: null,
          p_fantasy_team_id: null,
        });
        if (result.error) throw new Error(result.error.message);
      }

      // Create any missing divisions automatically. No typing is required.
      for (let index = ordered.length; index < targetCount; index += 1) {
        const result = await supabase.rpc("manage_nhl_traditional_division", {
          p_league_id: leagueId,
          p_season: Number(settings.season),
          p_action: "create",
          p_division_id: null,
          p_name: `Division ${index + 1}`,
          p_sort_order: index + 1,
          p_fantasy_team_id: null,
        });
        if (result.error) throw new Error(result.error.message);
      }

      const refreshedDivisions = await supabase
        .from("nhl_traditional_divisions")
        .select("id,league_id,season,name,sort_order")
        .eq("league_id", leagueId)
        .eq("season", Number(settings.season))
        .order("sort_order", { ascending: true });

      if (refreshedDivisions.error) throw new Error(refreshedDivisions.error.message);
      const nextDivisions = (refreshedDivisions.data ?? []).slice(0, targetCount) as NhlDivision[];
      if (nextDivisions.length !== targetCount) {
        throw new Error("G365 could not build the requested division layout.");
      }

      // Rebalance every active team across the divisions in displayed team order.
      for (let index = 0; index < active.length; index += 1) {
        const division = nextDivisions[index % nextDivisions.length];
        const result = await supabase.rpc("manage_nhl_traditional_division", {
          p_league_id: leagueId,
          p_season: Number(settings.season),
          p_action: "assign",
          p_division_id: division.id,
          p_name: null,
          p_sort_order: null,
          p_fantasy_team_id: active[index].id,
        });
        if (result.error) throw new Error(result.error.message);
      }

      await load(false);
      setSuccess(`${targetCount} divisions created and active teams distributed evenly.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Division layout could not be created.");
    } finally {
      setSaving(false);
    }
  }

  async function assignTeamToDivision(teamId: number, divisionId: number) {
    if (!settings || saving) return;
    const team = teams.find((row) => row.id === teamId);
    const division = divisions.find((row) => row.id === divisionId);

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await supabase.rpc("manage_nhl_traditional_division", {
        p_league_id: leagueId,
        p_season: Number(settings.season),
        p_action: "assign",
        p_division_id: divisionId,
        p_name: null,
        p_sort_order: null,
        p_fantasy_team_id: teamId,
      });
      if (result.error) throw new Error(result.error.message);
      await load(false);
      setSuccess(`${team?.team_name ?? "Team"} moved to ${division?.name ?? "division"}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Team could not be moved.");
    } finally {
      setSaving(false);
    }
  }

  async function saveLeagueSettings() {
    if (!settings) return;

    if (settings.league_format === "dynasty") {
      const deadlineWeek = Number(settings.dynasty_protection_deadline_week ?? 0);
      if (deadlineWeek < 1 || deadlineWeek > 12) {
        setError("Choose a Dynasty protection deadline week before saving League Setup.");
        return;
      }

      const deadlineDay = Number(settings.dynasty_protection_deadline_day ?? 0);
      if (deadlineDay < 1 || deadlineDay > 7) {
        setError("Choose a Dynasty protection deadline day before saving League Setup.");
        return;
      }
    }

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
          p_trade_review_mode: settings.trade_review_mode ?? "none",
          p_dynasty_rookie_rounds: settings.dynasty_rookie_rounds,
          p_dynasty_future_pick_years: settings.dynasty_future_pick_years,
          p_dynasty_rosters_carry_over: settings.dynasty_rosters_carry_over,
          p_dynasty_protected_players: settings.dynasty_protected_players,
          p_dynasty_protection_deadline_week: settings.dynasty_protection_deadline_week,
          p_dynasty_protection_deadline_day: settings.dynasty_protection_deadline_day,
          p_dynasty_protection_deadline_time: "00:00:00",
          p_playoff_reseeding: settings.playoff_reseeding ?? false,
          p_playoff_tiebreaker: settings.playoff_tiebreaker ?? "higher_seed",
          p_divisions_enabled: settings.divisions_enabled ?? false,
          p_division_playoff_mode:
            settings.divisions_enabled
              ? settings.division_playoff_mode ?? "overall"
              : "overall",
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

  async function manageProtectionPeriod(
    action: "open" | "reopen" | "set_deadline" | "lock" | "close"
  ) {
    if (!settings || settings.league_format !== "dynasty") return;

    const labels: Record<typeof action, string> = {
      open: "Player protection opened.",
      reopen: "Player protection reopened. Team selections are editable again.",
      set_deadline: "Player protection deadline recalculated from League Setup.",
      lock: "Player protection locked league-wide.",
      close: "Player protection window closed.",
    };

    const confirmations: Partial<Record<typeof action, string>> = {
      reopen:
        "Reopen player protection? All locked protection selections for this season will become editable again.",
      lock:
        "Lock player protection league-wide? Every active team must have exactly the configured number of protected players.",
      close:
        "Close the player-protection window? Existing selections will be preserved, but owners will not be able to edit them.",
    };

    const confirmation = confirmations[action];
    if (confirmation && !window.confirm(confirmation)) return;

    await runAction(
      () =>
        supabase.rpc("manage_nhl_dynasty_protection_period", {
          p_league_id: leagueId,
          p_action: action,
          p_deadline: null,
        }),
      labels[action]
    );
  }

  async function finalizeProtectedRosters() {
    if (!settings || settings.league_format !== "dynasty") return;

    const targetSeason = Number(settings.season) + 1;

    if (
      !window.confirm(
        `Finalize protected rosters for ${targetSeason}?\n\n` +
          "This carries the locked protected players into the next season. " +
          "After this step the protection period cannot be reopened."
      )
    ) {
      return;
    }

    await runAction(
      () =>
        supabase.rpc("commissioner_finalize_nhl_dynasty_keepers", {
          p_league_id: leagueId,
          p_target_season: targetSeason,
        }),
      `${targetSeason} protected rosters finalized.`
    );
  }

  async function prepareAnnualDynastyDraft() {
    if (!settings || settings.league_format !== "dynasty") return;
    const draftSeason = Number(settings.season) + 1;

    if (!window.confirm(`Prepare the ${draftSeason} Annual Dynasty Draft?\n\nThis creates the linear annual draft after protected rosters have been finalized.`)) return;

    await runAction(
      () => supabase.rpc("prepare_nhl_dynasty_rookie_draft", {
        p_league_id: leagueId,
        p_draft_season: draftSeason,
      }),
      `${draftSeason} Annual Dynasty Draft prepared.`
    );
  }

  async function applyAnnualReverseStandings() {
    if (!settings || settings.league_format !== "dynasty") return;
    const draftSeason = Number(settings.season) + 1;

    if (!window.confirm(`Set the ${draftSeason} Annual Dynasty Draft order by reverse ${settings.season} final standings?\n\nThe same franchise-slot order will repeat every round. Traded picks keep their current owners.`)) return;

    await runAction(
      () => supabase.rpc("commissioner_apply_nhl_dynasty_reverse_standings", {
        p_league_id: leagueId,
        p_draft_season: draftSeason,
      }),
      `${draftSeason} Annual Dynasty Draft order set from reverse standings.`
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

  const offseasonWeekOptions = useMemo(() => {
    if (!offseasonCalendar?.offseasonWeek1StartsOn) return [];

    const weekOneMonday = parseLocalDateOnly(offseasonCalendar.offseasonWeek1StartsOn);

    return Array.from({ length: 12 }, (_, index) => {
      const week = index + 1;
      const start = new Date(weekOneMonday);
      start.setDate(start.getDate() + index * 7);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);

      return {
        week,
        start,
        end,
        label: `Offseason Week ${week} • ${formatOffseasonDate(start)} – ${formatOffseasonDate(end)}`,
      };
    });
  }, [offseasonCalendar]);

  const selectedOffseasonWeek = useMemo(() => {
    const week = Number(settings?.dynasty_protection_deadline_week ?? 0);
    return week >= 1 && week <= 12 ? String(week) : "";
  }, [settings?.dynasty_protection_deadline_week]);

  const configuredProtectionDeadlineLabel = useMemo(() => {
    if (!settings || !offseasonCalendar?.offseasonWeek1StartsOn) return "Calendar pending";
    const week = Number(settings.dynasty_protection_deadline_week ?? 1);
    const day = Number(settings.dynasty_protection_deadline_day ?? 1);
    if (week < 1 || week > 12 || day < 1 || day > 7) return "Not configured";
    const date = parseLocalDateOnly(offseasonCalendar.offseasonWeek1StartsOn);
    date.setDate(date.getDate() + (week - 1) * 7 + (day - 1));
    return `${date.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric", year: "numeric" })} at 12:00 AM`;
  }, [offseasonCalendar, settings]);

  const annualDraftSeason = Number(settings?.season ?? 0) + 1;
  const activeDynastyTeams = teams.filter((team) => team.active).slice(0, settings?.max_teams ?? teams.length);
  const annualProtectionFinalized =
    settings?.league_format === "dynasty" &&
    activeDynastyTeams.length > 0 &&
    activeDynastyTeams.every((team) =>
      protectionSelections.filter(
        (row) =>
          row.fantasy_team_id === team.id &&
          row.source_season === Number(settings.season) &&
          row.target_season === annualDraftSeason &&
          row.status === "carried_over"
      ).length === settings.dynasty_protected_players
    );
  const annualOrder = [...annualDraftTeams].sort((a, b) => a.draft_slot - b.draft_slot);
  const annualAssets = [...annualDraftPickAssets].sort(
    (a, b) => (a.overall_pick ?? Number.MAX_SAFE_INTEGER) - (b.overall_pick ?? Number.MAX_SAFE_INTEGER)
  );

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
    ["trades", `Trades${tradeReviewQueue?.pendingReviewCount ? ` (${tradeReviewQueue.pendingReviewCount})` : ""}`],
    ["roster", "Roster Setup"],
    ["scoring", "Scoring"],
    ["corrections", "Corrections"],
  ];

  return (
    <main className="g365-nhl-commissioner" style={styles.page}>
      <style>{`
        .g365-nhl-mobile-section-picker {
          display: none;
        }

        @media (max-width: 900px) {
          .g365-nhl-invite-grid {
            grid-template-columns: 1fr 1fr !important;
          }

          .g365-nhl-inline-invite {
            margin-left: 12px !important;
          }
        }

        @media (max-width: 760px) {
          .g365-nhl-commissioner {
            width: 100% !important;
            max-width: 100% !important;
            min-width: 0 !important;
            padding: 12px 10px 48px !important;
            overflow-x: hidden !important;
          }

          .g365-nhl-shell,
          .g365-nhl-commissioner section {
            width: 100% !important;
            max-width: 100% !important;
            min-width: 0 !important;
            box-sizing: border-box !important;
          }

          .g365-nhl-commissioner section > *,
          .g365-nhl-shell > * {
            min-width: 0 !important;
            max-width: 100%;
          }

          .g365-nhl-hero {
            flex-direction: column !important;
            align-items: stretch !important;
            padding: 14px !important;
          }

          .g365-nhl-hero-actions {
            width: 100% !important;
            display: grid !important;
            grid-template-columns: minmax(0,1fr) !important;
          }

          .g365-nhl-hero-actions button {
            width: 100% !important;
            min-height: 44px !important;
          }

          .g365-nhl-commissioner-home-action {
            display: none !important;
          }

          .g365-nhl-tabs {
            display: none !important;
          }

          .g365-nhl-mobile-section-picker {
            display: block !important;
            width: 100%;
            margin: 0 0 12px;
            padding: 11px;
            border: 1px solid rgba(255,95,30,.28);
            border-radius: 10px;
            background: linear-gradient(135deg,rgba(150,30,15,.12),rgba(255,105,25,.035));
          }

          .g365-nhl-mobile-section-picker label {
            display: grid;
            gap: 6px;
          }

          .g365-nhl-mobile-section-picker span {
            color: #ff6a2a;
            font-size: 9px;
            font-weight: 950;
            letter-spacing: .10em;
          }

          .g365-nhl-mobile-section-picker select {
            width: 100%;
            min-height: 46px;
            border: 1px solid rgba(255,255,255,.14);
            border-radius: 8px;
            padding: 0 11px;
            background: #0b0d12;
            color: #fff;
            font-size: 16px;
            font-weight: 850;
            outline: none;
          }

          .g365-nhl-grid,
          .g365-nhl-setup-grid,
          .g365-nhl-stats,
          .g365-nhl-team-summary {
            grid-template-columns: repeat(2,minmax(0,1fr)) !important;
            gap: 9px !important;
          }

          .g365-nhl-actions {
            display: grid !important;
            grid-template-columns: minmax(0,1fr) !important;
          }

          .g365-nhl-actions button {
            width: 100% !important;
            min-height: 44px !important;
          }

          .g365-nhl-team-header {
            display: none !important;
          }

          .g365-nhl-team-table {
            overflow: visible !important;
          }

          .g365-nhl-team-row {
            grid-template-columns: 42px minmax(0,1fr) minmax(0,1fr) !important;
          }

          .g365-nhl-team-status,
          .g365-nhl-team-type {
            grid-column: span 1;
          }

          .g365-nhl-team-row-actions {
            grid-column: 2 / -1;
          }

          .g365-nhl-mobile-label {
            display: block !important;
          }

          .g365-nhl-inline-invite {
            width: auto !important;
            max-width: none !important;
            margin: 0 10px 12px 52px !important;
          }

          .g365-nhl-invite-grid {
            grid-template-columns: minmax(0,1fr) !important;
          }

          .g365-nhl-draft-order-row {
            grid-template-columns: 42px minmax(0,1fr) !important;
          }

          .g365-nhl-draft-order-row > *:nth-child(n+3) {
            grid-column: 2 !important;
          }

          .g365-nhl-matchup-editor-row {
            grid-template-columns: 38px minmax(0,1fr) !important;
          }

          .g365-nhl-matchup-editor-row > *:nth-child(n+3) {
            grid-column: 2 !important;
          }

          .g365-nhl-trade-sides,
          .g365-nhl-trade-actions,
          .g365-nhl-division-grid,
          .g365-nhl-correction-grid,
          .g365-nhl-correction-history-row {
            grid-template-columns: minmax(0,1fr) !important;
          }

          .g365-nhl-trade-actions button {
            width: 100% !important;
            min-height: 44px !important;
          }

          .g365-nhl-division-team {
            grid-template-columns: minmax(0,1fr) !important;
            align-items: stretch !important;
          }

          .g365-nhl-division-team select {
            width: 100% !important;
          }

          .g365-nhl-category-row {
            grid-template-columns: minmax(0,1fr) 140px 112px !important;
          }

          .g365-nhl-dynasty-choice-grid,
          .g365-nhl-rookie-choice-stack {
            grid-template-columns: minmax(0,1fr) !important;
          }

          .g365-nhl-commissioner input,
          .g365-nhl-commissioner select,
          .g365-nhl-commissioner textarea {
            max-width: 100% !important;
            min-width: 0 !important;
          }

          .g365-nhl-commissioner button,
          .g365-nhl-commissioner select,
          .g365-nhl-commissioner input:not([type="checkbox"]):not([type="radio"]) {
            min-height: 44px;
          }

          .g365-nhl-commissioner p,
          .g365-nhl-commissioner label,
          .g365-nhl-commissioner strong,
          .g365-nhl-commissioner span {
            overflow-wrap: anywhere;
          }
        }

        @media (max-width: 430px) {
          .g365-nhl-commissioner {
            padding-left: 7px !important;
            padding-right: 7px !important;
          }

          .g365-nhl-grid,
          .g365-nhl-setup-grid,
          .g365-nhl-stats,
          .g365-nhl-team-summary,
          .g365-nhl-hero-actions {
            grid-template-columns: minmax(0,1fr) !important;
          }

          .g365-nhl-team-row {
            grid-template-columns: 34px minmax(0,1fr) !important;
          }

          .g365-nhl-team-name,
          .g365-nhl-team-owner,
          .g365-nhl-team-status,
          .g365-nhl-team-type,
          .g365-nhl-team-row-actions {
            grid-column: 2 !important;
          }

          .g365-nhl-team-row-actions {
            display: grid !important;
            grid-template-columns: minmax(0,1fr) !important;
          }

          .g365-nhl-team-row-actions button {
            width: 100% !important;
          }

          .g365-nhl-inline-invite {
            margin: 0 8px 12px !important;
          }

          .g365-nhl-category-header {
            display: none !important;
          }

          .g365-nhl-category-row {
            grid-template-columns: minmax(0,1fr) !important;
            gap: 8px !important;
            align-items: stretch !important;
          }

          .g365-nhl-category-row select,
          .g365-nhl-category-row button {
            width: 100% !important;
          }
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
            <div className="g365-nhl-commissioner-home-action">
              <Button secondary onClick={() => router.push(`/league/${leagueId}`)}>
                LEAGUE HOME
              </Button>
            </div>
            <Button onClick={() => void load()} disabled={saving}>
              REFRESH
            </Button>
          </div>
        </header>

        {error ? <div style={styles.error}>{error}</div> : null}
        {success ? <div style={styles.success}>{success}</div> : null}

        <div className="g365-nhl-mobile-section-picker">
          <label>
            <span>COMMISSIONER SECTION</span>
            <select
              value={tab}
              onChange={(event) => setTab(event.target.value as Tab)}
              aria-label="Commissioner section"
            >
              {tabs.map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </label>
        </div>

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

            {settings?.league_format === "dynasty" && dynastyChecklist ? (
              <Section
                title={`${dynastyChecklist.targetSeason} Dynasty ${dynastyChecklist.checklistType === "startup" ? "Startup Checklist" : "Offseason Checklist"}`}
                subtitle={
                  dynastyChecklist.checklistType === "startup"
                    ? `Complete the one-time ${dynastyChecklist.targetSeason} startup requirements before activating the inaugural Dynasty season.`
                    : `Finish the ${dynastyChecklist.targetSeason} offseason requirements before advancing the league into the new season.`
                }
              >
                {(() => {
                  const automaticKeys = new Set(["calendar_ready", "matchups_ready"]);
                  const requiredItems = dynastyChecklist.items.filter((item) => !automaticKeys.has(item.key));
                  const automaticItems = dynastyChecklist.items.filter((item) => automaticKeys.has(item.key));
                  const completedRequired = requiredItems.filter((item) => item.complete).length;
                  const progress = requiredItems.length > 0
                    ? Math.round((completedRequired / requiredItems.length) * 100)
                    : 0;

                  return (
                    <div style={styles.checklistWrap}>
                      <div style={styles.checklistHero}>
                        <div style={styles.checklistHeroCopy}>
                          <span style={styles.checklistEyebrow}>
                            {dynastyChecklist.checklistType === "startup"
                              ? "DYNASTY STARTUP"
                              : `${dynastyChecklist.sourceSeason ?? "PRIOR"} → ${dynastyChecklist.targetSeason} OFFSEASON`}
                          </span>
                          <strong style={styles.checklistHeroTitle}>
                            {completedRequired} OF {requiredItems.length} REQUIRED STEPS COMPLETE
                          </strong>
                          <span style={styles.checklistHeroSub}>
                            {dynastyChecklist.readyToActivate
                              ? `${dynastyChecklist.targetSeason} is cleared for commissioner activation.`
                              : "The activation button unlocks automatically when every required database gate is complete."}
                          </span>
                        </div>
                        <div style={styles.checklistProgressBadge}>{progress}%</div>
                      </div>

                      <div style={styles.checklistProgressTrack}>
                        <div style={{ ...styles.checklistProgressFill, width: `${progress}%` }} />
                      </div>

                      <div style={styles.checklistList}>
                        {requiredItems.map((item) => (
                          <div key={item.key} style={{ ...styles.checklistRow, ...(item.complete ? styles.checklistRowComplete : {}) }}>
                            <span style={{ ...styles.checklistIcon, ...(item.complete ? styles.checklistIconComplete : {}) }}>
                              {item.complete ? "✓" : "○"}
                            </span>
                            <div style={styles.checklistItemCopy}>
                              <strong style={styles.checklistItemLabel}>{item.label}</strong>
                              {item.key === "startup_draft_completed" || item.key === "annual_draft_completed" ? (
                                <span style={styles.checklistItemMeta}>
                                  {Number(item.completedPicks ?? 0)} / {Number(item.expectedPicks ?? 0)} picks complete
                                </span>
                              ) : null}
                              {item.key === "rosters_valid" ? (
                                <span style={styles.checklistItemMeta}>
                                  {Number(item.rosteredPlayers ?? 0)} / {Number(item.expectedPlayers ?? 0)} roster spots filled
                                </span>
                              ) : null}
                              {item.key === "teams_ready" ? (
                                <span style={styles.checklistItemMeta}>
                                  {Number(item.readyTeams ?? 0)} / {Number(item.activeTeams ?? 0)} active franchises ready
                                </span>
                              ) : null}
                              {item.key === "keepers_finalized" ? (
                                <span style={styles.checklistItemMeta}>
                                  {Number(item.carriedOver ?? 0)} / {Number(item.expected ?? 0)} keepers carried over
                                </span>
                              ) : null}
                              {item.key === "draft_pick_assets" ? (
                                <span style={styles.checklistItemMeta}>
                                  {Number(item.resolvedAssets ?? 0)} / {Number(item.expectedAssets ?? 0)} draft assets resolved
                                </span>
                              ) : null}
                              {item.key === "draft_order" && item.method ? (
                                <span style={styles.checklistItemMeta}>Order method: {pretty(String(item.method))}</span>
                              ) : null}
                            </div>
                            <span style={item.complete ? styles.checklistStatusComplete : styles.checklistStatusPending}>
                              {item.complete ? "COMPLETE" : "PENDING"}
                            </span>
                          </div>
                        ))}
                      </div>

                      {automaticItems.length > 0 ? (
                        <div style={styles.checklistAutomatic}>
                          <div style={styles.checklistAutomaticHead}>AUTOMATIC SEASON PREPARATION</div>
                          {automaticItems.map((item) => (
                            <div key={item.key} style={styles.checklistAutomaticRow}>
                              <span style={{ ...styles.checklistIcon, ...(item.complete ? styles.checklistIconComplete : {}) }}>
                                {item.complete ? "✓" : "↻"}
                              </span>
                              <div style={styles.checklistItemCopy}>
                                <strong style={styles.checklistItemLabel}>{item.label}</strong>
                                <span style={styles.checklistItemMeta}>
                                  {item.complete
                                    ? item.key === "calendar_ready"
                                      ? `${Number(item.calendarRows ?? 0)} calendar periods ready`
                                      : `${Number(item.matchups ?? 0)} matchups ready`
                                    : "Prepared automatically when the season is activated"}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : null}

                      <div style={styles.checklistActivation}>
                        <div style={styles.checklistActivationCopy}>
                          <span style={styles.checklistEyebrow}>SEASON CONTROL</span>
                          <strong style={styles.checklistActivationTitle}>
                            {dynastyChecklist.readyToActivate
                              ? `${dynastyChecklist.targetSeason} IS READY TO ACTIVATE`
                              : `ACTIVATE ${dynastyChecklist.targetSeason} LOCKED`}
                          </strong>
                          <span style={styles.checklistHeroSub}>
                            {dynastyChecklist.readyToActivate
                              ? "Activation will prepare any automatic season items, sync future picks, and run the NHL lifecycle."
                              : "Finish every required item above. This control unlocks automatically."}
                          </span>
                        </div>
                        <Button
                          disabled={!dynastyChecklist.readyToActivate || saving || activatingSeason}
                          onClick={() => void activateDynastySeason()}
                        >
                          {activatingSeason
                            ? `ACTIVATING ${dynastyChecklist.targetSeason}…`
                            : dynastyChecklist.readyToActivate
                              ? `ACTIVATE ${dynastyChecklist.targetSeason} SEASON`
                              : `🔒 ACTIVATE ${dynastyChecklist.targetSeason}`}
                        </Button>
                      </div>
                    </div>
                  );
                })()}
              </Section>
            ) : null}

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
                  <p>Redraft supports random or manual order. Dynasty startup supports Official Equal-Odds Lottery or Manual Draft Order. Future Annual Dynasty Drafts are linear and use either the Dynasty Draft Lottery or reverse final standings, with traded-pick ownership preserved.</p>
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
                    <Toggle
                      label="Reseed Each Round"
                      value={settings.playoff_reseeding ?? false}
                      onChange={(value) =>
                        setSettings({ ...settings, playoff_reseeding: value })
                      }
                    />
                    <SelectField
                      label="Playoff Tiebreaker"
                      value={settings.playoff_tiebreaker ?? "higher_seed"}
                      onChange={(value) =>
                        setSettings({
                          ...settings,
                          playoff_tiebreaker:
                            value as NhlSettings["playoff_tiebreaker"],
                        })
                      }
                    >
                      <option value="higher_seed">Higher Seed</option>
                      <option value="regular_season_head_to_head">
                        Regular-Season Head-to-Head
                      </option>
                      <option value="regular_season_points">
                        Regular-Season Points
                      </option>
                    </SelectField>
                  </div>
                  <div style={styles.setupHint}>
                    When enabled, each completed playoff round is reseeded so the highest remaining seed plays the lowest remaining seed. When disabled, the original fixed bracket path is preserved.
                  </div>
                  <div style={styles.setupHint}>
                    Playoff ties use the selected tiebreaker. Head-to-Head and Regular-Season Points both fall back to the higher playoff seed if they are still tied.
                  </div>

                  <div style={styles.divider} />

                  <div style={styles.subsectionTitle}>DIVISIONS</div>
                  <div className="g365-nhl-setup-grid g365-nhl-setup-grid-3" style={styles.setupGrid3}>
                    <Toggle
                      label="Use Divisions"
                      value={settings.divisions_enabled ?? false}
                      onChange={(value) => void toggleDivisions(value)}
                    />

                    {settings.divisions_enabled ? (
                      <SelectField
                        label="Number of Divisions"
                        value={String(divisions.length || 2)}
                        onChange={(value) => void configureDivisionCount(Number(value))}
                      >
                        <option value="2">2 Divisions</option>
                        <option value="3">3 Divisions</option>
                        <option value="4">4 Divisions</option>
                      </SelectField>
                    ) : null}

                    {settings.divisions_enabled ? (
                      <SelectField
                        label="Division Playoff Qualification"
                        value={settings.division_playoff_mode ?? "overall"}
                        onChange={(value) =>
                          void saveDivisionPlayoffMode(
                            value as NhlSettings["division_playoff_mode"]
                          )
                        }
                      >
                        <option value="overall">Overall Standings</option>
                        <option value="division_winners_qualify">Division Winners Qualify</option>
                        <option value="division_winners_top_seeds">Division Winners Get Top Seeds</option>
                      </SelectField>
                    ) : null}
                  </div>

                  <div style={styles.setupHint}>
                    Turning divisions on saves immediately. Choose 2, 3, or 4 divisions and G365 creates the layout automatically, names them Division 1, Division 2, and so on, then distributes all active teams evenly. You can move any team afterward.
                  </div>

                  {settings.divisions_enabled ? (
                    <div style={styles.divisionManager}>
                      {divisions.length === 0 ? (
                        <div style={styles.notice}>
                          <strong>CREATE DIVISION LAYOUT</strong>
                          <span>
                            Choose the number of divisions above, then create the standard layout. No division names need to be typed.
                          </span>
                          <div className="g365-nhl-actions" style={styles.actions}>
                            <Button disabled={saving} onClick={() => void configureDivisionCount(2)}>
                              CREATE 2 DIVISIONS
                            </Button>
                            <Button secondary disabled={saving} onClick={() => void configureDivisionCount(3)}>
                              CREATE 3 DIVISIONS
                            </Button>
                            <Button secondary disabled={saving} onClick={() => void configureDivisionCount(4)}>
                              CREATE 4 DIVISIONS
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="g365-nhl-division-grid" style={styles.divisionGrid}>
                          {[...divisions]
                            .sort((a, b) => a.sort_order - b.sort_order)
                            .map((division, index) => {
                              const divisionTeams = teams
                                .filter((team) => team.active)
                                .filter((team) =>
                                  teamDivisions.some(
                                    (assignment) =>
                                      assignment.fantasy_team_id === team.id &&
                                      assignment.division_id === division.id
                                  )
                                );

                              return (
                                <div key={division.id} style={styles.divisionCard}>
                                  <div style={styles.divisionCardHead}>
                                    <div>
                                      <span style={styles.divisionEyebrow}>DIVISION {index + 1}</span>
                                      <strong style={styles.divisionTitle}>{division.name}</strong>
                                    </div>
                                    <span style={styles.divisionCount}>{divisionTeams.length} TEAMS</span>
                                  </div>

                                  <div style={styles.divisionTeamList}>
                                    {divisionTeams.length === 0 ? (
                                      <div style={styles.divisionEmpty}>No teams assigned.</div>
                                    ) : (
                                      divisionTeams.map((team) => (
                                        <div key={team.id} className="g365-nhl-division-team" style={styles.divisionTeamRow}>
                                          <div style={styles.divisionTeamIdentity}>
                                            <strong>{team.team_name}</strong>
                                            <span>{team.owner_id ? "OWNER ASSIGNED" : team.is_cpu ? "CPU TEAM" : "OPEN TEAM"}</span>
                                          </div>
                                          <select
                                            aria-label={`Move ${team.team_name} to division`}
                                            value={division.id}
                                            disabled={saving}
                                            onChange={(event) =>
                                              void assignTeamToDivision(team.id, Number(event.target.value))
                                            }
                                            style={styles.compactSelect}
                                          >
                                            {[...divisions]
                                              .sort((a, b) => a.sort_order - b.sort_order)
                                              .map((option) => (
                                                <option key={option.id} value={option.id}>
                                                  {option.name}
                                                </option>
                                              ))}
                                          </select>
                                        </div>
                                      ))
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      )}

                      {divisions.length > 0 && teams.some(
                        (team) => team.active && !teamDivisions.some(
                          (assignment) => assignment.fantasy_team_id === team.id
                        )
                      ) ? (
                        <div style={styles.unassignedDivisionCard}>
                          <div style={styles.divisionCardHead}>
                            <div>
                              <span style={styles.divisionEyebrow}>NEEDS ASSIGNMENT</span>
                              <strong style={styles.divisionTitle}>Unassigned Teams</strong>
                            </div>
                          </div>
                          <div style={styles.divisionTeamList}>
                            {teams
                              .filter((team) => team.active)
                              .filter((team) => !teamDivisions.some(
                                (assignment) => assignment.fantasy_team_id === team.id
                              ))
                              .map((team) => (
                                <div key={team.id} className="g365-nhl-division-team" style={styles.divisionTeamRow}>
                                  <div style={styles.divisionTeamIdentity}>
                                    <strong>{team.team_name}</strong>
                                    <span>UNASSIGNED</span>
                                  </div>
                                  <select
                                    aria-label={`Assign ${team.team_name} to division`}
                                    value=""
                                    disabled={saving}
                                    onChange={(event) => {
                                      if (event.target.value) {
                                        void assignTeamToDivision(team.id, Number(event.target.value));
                                      }
                                    }}
                                    style={styles.compactSelect}
                                  >
                                    <option value="">Choose Division...</option>
                                    {[...divisions]
                                      .sort((a, b) => a.sort_order - b.sort_order)
                                      .map((division) => (
                                        <option key={division.id} value={division.id}>
                                          {division.name}
                                        </option>
                                      ))}
                                  </select>
                                </div>
                              ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
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

                    <SelectField
                      label="Trade Review"
                      value={settings.trade_review_mode ?? "none"}
                      onChange={(value) =>
                        setSettings({
                          ...settings,
                          trade_review_mode: value as NhlSettings["trade_review_mode"],
                        })
                      }
                    >
                      <option value="none">No Review — Process Immediately</option>
                      <option value="commissioner">Commissioner Review</option>
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
                  <div style={styles.setupHint}>
                    No Review processes a trade immediately when the receiving team accepts it. Commissioner Review holds an accepted trade for commissioner approval or veto before any players or draft picks move.
                  </div>
                </div>
              </div>

              {settings.league_format === "dynasty" ? (
                <div style={styles.subPanel}>
                  <div style={styles.subsectionTitle}>DYNASTY SETTINGS</div>
                  <div style={styles.setupGroupText}>
                    All Dynasty configuration lives here. Player protection always closes at 12:00 AM league time on the selected offseason day.
                  </div>

                  <div className="g365-nhl-grid" style={styles.grid}>
                    <NumberInput
                      label="Players Protected Per Team"
                      value={settings.dynasty_protected_players}
                      min={1}
                      onChange={(value) =>
                        setSettings({
                          ...settings,
                          dynasty_protected_players: Math.max(1, value ?? 15),
                        })
                      }
                    />

                    <label style={styles.field}>
                      <span style={styles.fieldLabel}>Annual Draft Rounds</span>
                      <div style={styles.readOnly}>
                        {Math.max(1, totalActiveSlots + (roster?.bench_slots ?? 0) - settings.dynasty_protected_players)}
                      </div>
                      <span style={styles.fieldHint}>
                        Full roster ({totalActiveSlots + (roster?.bench_slots ?? 0)}) − protected players ({settings.dynasty_protected_players})
                      </span>
                    </label>

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

                    <SelectField
                      label="Protection Deadline Week"
                      value={selectedOffseasonWeek}
                      onChange={(value) =>
                        setSettings({
                          ...settings,
                          dynasty_protection_deadline_week: Number(value),
                          dynasty_protection_deadline_time: "00:00:00",
                        })
                      }
                    >
                      <option value="" disabled>Select protection deadline week</option>
                      {offseasonWeekOptions.length > 0
                        ? offseasonWeekOptions.map((option) => (
                            <option key={option.week} value={option.week}>
                              Week {option.week} — {formatOffseasonDate(option.start)}–{formatOffseasonDate(option.end)}, {option.start.getFullYear()}
                            </option>
                          ))
                        : Array.from({ length: 12 }, (_, index) => index + 1).map((week) => (
                            <option key={week} value={week}>Week {week}</option>
                          ))}
                    </SelectField>

                    <SelectField
                      label="Protection Deadline Day"
                      value={settings.dynasty_protection_deadline_day == null ? "" : String(settings.dynasty_protection_deadline_day)}
                      onChange={(value) =>
                        setSettings({
                          ...settings,
                          dynasty_protection_deadline_day: Number(value),
                          dynasty_protection_deadline_time: "00:00:00",
                        })
                      }
                    >
                      <option value="" disabled>Select protection deadline day</option>
                      <option value="1">Monday</option>
                      <option value="2">Tuesday</option>
                      <option value="3">Wednesday</option>
                      <option value="4">Thursday</option>
                      <option value="5">Friday</option>
                      <option value="6">Saturday</option>
                      <option value="7">Sunday</option>
                    </SelectField>

                    <label style={styles.field}>
                      <span style={styles.fieldLabel}>Protection Deadline Time</span>
                      <div style={styles.readOnly}>12:00 AM</div>
                      <span style={styles.fieldHint}>Fixed for every Dynasty league.</span>
                    </label>

                    <label style={styles.field}>
                      <span style={styles.fieldLabel}>Calculated Protection Deadline</span>
                      <div style={styles.readOnly}>{configuredProtectionDeadlineLabel}</div>
                    </label>
                  </div>

                  <div style={styles.inlineHelp}>
                    Offseason Week 1 starts on the first Monday after the final G365 fantasy day. The actual calendar date is calculated from the league's NHL fantasy calendar and the deadline is always 12:00 AM league time.
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
            subtitle={
              settings.league_format === "dynasty"
                ? "Manage permanent Dynasty franchises, owner succession, invitations, and CPU control. Removing an owner never removes the franchise or its hockey assets."
                : "Manage team ownership, send invitations, and configure CPU teams."
            }
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
                    const isDynastyOrphan =
                      settings.league_format === "dynasty" &&
                      isOpen &&
                      Boolean(team.nhl_traditional_franchise_id);

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
                                : isDynastyOrphan
                                  ? "Awaiting New Owner"
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
                              <strong style={isDynastyOrphan ? styles.statusOrphan : styles.statusOpen}>
                                {isDynastyOrphan ? "ORPHANED FRANCHISE" : "NO OWNER"}
                              </strong>
                              <span style={styles.statusSub}>
                                {isDynastyOrphan
                                  ? "Roster, picks and history preserved"
                                  : "Invite an owner or use CPU"}
                              </span>
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
                              <span style={isDynastyOrphan ? styles.badgeOrphan : styles.badgeOpen}>
                                {isDynastyOrphan ? "ORPHAN" : "VACANT"}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="g365-nhl-team-row-actions" style={styles.teamRowActions}>
                          <span className="g365-nhl-mobile-label" style={styles.mobileLabel}>ACTIONS</span>
                          {isOpen ? (
                            <Button secondary disabled={saving || inviting} onClick={() => openInvite(team)}>
                              {isDynastyOrphan ? "INVITE NEW OWNER" : "INVITE"}
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
                              <div style={styles.inlineInviteSub}>
                                {isDynastyOrphan
                                  ? "The invited owner will adopt this exact Dynasty franchise. Its roster, future draft picks, records, championships, and season history stay attached."
                                  : "Enter the owner's information and send the Gridiron365 league invitation."}
                              </div>
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
              {settings.league_format === "dynasty"
                ? "Dynasty franchises are permanent. Removing an owner creates an orphaned franchise; the roster, future draft picks, standings history, playoff history, trophies, and franchise identity remain in place for the replacement owner."
                : "Redraft team slots can be reassigned between seasons without creating Dynasty franchise history."}
            </div>
          </Section>
        ) : null}

        {tab === "draft" && settings ? (
          <Section
            title={settings.league_format === "dynasty" ? "Dynasty Draft Setup & Order" : "Redraft Draft Setup & Order"}
            subtitle={
              settings.league_format === "dynasty"
                ? "Operate the Dynasty startup draft, offseason player protection, and each future Annual Dynasty Draft from one lifecycle."
                : "Prepare the NHL draft, randomize Round 1, or manually set every franchise's draft slot. Snake order reverses automatically each round."
            }
          >
            {settings.league_format === "dynasty" ? (
              <>
                <div style={styles.dynastyDraftBlock}>
                  <div style={styles.dynastyDraftHead}>
                    <div>
                      <div style={styles.dynastyDraftEyebrow}>DYNASTY STARTUP DRAFT</div>
                      <div style={styles.dynastyDraftTitle}>{settings.season} DYNASTY STARTUP DRAFT</div>
                      <div style={styles.setupGroupText}>
                        Choose exactly one startup order method. The official lottery gives every remaining franchise equal odds for the next available slot. Manual order lets the commissioner place every franchise. The startup player draft is snake format.
                      </div>
                    </div>
                    <div style={styles.dynastyDraftBadge}>SNAKE DRAFT</div>
                  </div>

                  {!draftState?.exists ? (
                    <div style={styles.notice}>
                      <strong>STARTUP DRAFT NOT PREPARED</strong>
                      <span>Prepare the startup draft first. This creates the draft and active franchise slot records.</span>
                      <div className="g365-nhl-actions" style={styles.actions}>
                        <Button disabled={saving} onClick={() => void prepareDraft()}>
                          PREPARE {settings.season} STARTUP DRAFT
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="g365-nhl-stats" style={styles.stats}>
                        <Stat label="Status" value={pretty(draftState.status)} />
                        <Stat label="Format" value="Dynasty Startup" />
                        <Stat label="Rounds" value={draftState.rounds ?? "—"} />
                        <Stat label="Timer" value={(draftState.secondsPerPick ?? 90) === 0 ? "No Timer" : `${draftState.secondsPerPick ?? 90} sec`} />
                        <Stat label="Picks Made" value={draftState.pickCount ?? 0} />
                        <Stat label="Total Picks" value={draftState.totalPicks ?? "—"} />
                      </div>

                      {draftState.status === "setup" || draftState.status === "ready" ? (
                        <>
                          <div className="g365-nhl-dynasty-choice-grid" style={styles.dynastyChoiceGrid}>
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => {}}
                              style={{
                                ...styles.dynastyChoiceCard,
                                ...(saving ? styles.disabled : {}),
                              }}
                            >
                              <span style={styles.dynastyChoiceNumber}>OPTION 1</span>
                              <strong style={styles.dynastyChoiceTitle}>OFFICIAL EQUAL-ODDS LOTTERY</strong>
                              <span style={styles.dynastyChoiceText}>
                                Every active franchise starts equal. After each draw, all remaining franchises again have equal odds for the next draft slot.
                              </span>
                            </button>

                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => void chooseDynastyStartupManual()}
                              style={{
                                ...styles.dynastyChoiceCard,
                                ...(saving ? styles.disabled : {}),
                              }}
                            >
                              <span style={styles.dynastyChoiceNumber}>OPTION 2</span>
                              <strong style={styles.dynastyChoiceTitle}>MANUAL DRAFT ORDER</strong>
                              <span style={styles.dynastyChoiceText}>
                                Commissioner sets the complete Round 1 startup order manually. Round 2 reverses automatically and the draft continues as a snake.
                              </span>
                            </button>
                          </div>

                          <div className="g365-nhl-actions" style={styles.actions}>
                            <Button
                              secondary
                              disabled={saving}
                              onClick={() => router.push(`/league/${leagueId}/nhl/draft-lottery`)}
                            >
                              OPEN MEMBER DRAFT LOTTERY PAGE
                            </Button>
                          </div>

                          <NhlDynastyLotteryOfficial
                            leagueId={leagueId}
                            draftSeason={Number(settings.season)}
                          />

                          <div style={styles.setupGroup}>
                            <div style={styles.setupGroupHead}>
                              <div>
                                <div style={styles.subsectionTitle}>PICK TIMER</div>
                                <div style={styles.setupGroupText}>
                                  Choose how long each team has to make a startup selection. No Timer leaves the current team on the clock until a pick is made.
                                </div>
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
                              <div style={styles.subsectionTitle}>LEAGUE STARTUP DRAFT ORDER</div>
                              <div style={styles.setupGroupText}>
                                This is the league's Round 1 startup order. In Manual mode, arrange every franchise here and save it. The startup draft snakes automatically after Round 1.
                              </div>
                            </div>
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
                            <strong>LEAGUE STARTUP DRAFT ORDER PREVIEW</strong>
                            <span>Round 1: {draftOrder.map((id) => teams.find((team) => team.id === id)?.team_name ?? `Team ${id}`).join(" → ") || "—"}</span>
                            <span>Round 2: {[...draftOrder].reverse().map((id) => teams.find((team) => team.id === id)?.team_name ?? `Team ${id}`).join(" → ") || "—"}</span>
                          </div>

                          <div className="g365-nhl-actions" style={styles.actions}>
                            <Button disabled={saving || draftOrder.length === 0} onClick={() => void saveManualDraftOrder()}>
                              SAVE MANUAL STARTUP ORDER
                            </Button>
                            <Button secondary disabled={saving} onClick={() => router.push(`/league/${leagueId}/nhl/draft`)}>
                              OPEN LIVE DRAFT
                            </Button>
                          </div>
                        </>
                      ) : (
                        <>
                          <div style={styles.notice}>
                            <strong>STARTUP DRAFT ORDER LOCKED</strong>
                            <span>The startup draft is {pretty(draftState.status)}. Its order cannot be changed after the draft begins.</span>
                          </div>

                          <div style={styles.draftToolbar}>
                            <div>
                              <div style={styles.subsectionTitle}>OFFICIAL LEAGUE STARTUP DRAFT ORDER</div>
                              <div style={styles.setupGroupText}>
                                This is the saved Round 1 order being used by the league. The Dynasty startup draft is snake format, so Round 2 reverses this order.
                              </div>
                            </div>
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
                                </div>
                              );
                            })}
                          </div>

                          <div style={styles.snakePreview}>
                            <strong>OFFICIAL STARTUP SNAKE ORDER</strong>
                            <span>Round 1: {draftOrder.map((id) => teams.find((team) => team.id === id)?.team_name ?? `Team ${id}`).join(" → ") || "—"}</span>
                            <span>Round 2: {[...draftOrder].reverse().map((id) => teams.find((team) => team.id === id)?.team_name ?? `Team ${id}`).join(" → ") || "—"}</span>
                          </div>

                          <div className="g365-nhl-actions" style={styles.actions}>
                            <Button secondary disabled={saving} onClick={() => router.push(`/league/${leagueId}/nhl/draft`)}>
                              OPEN LIVE DRAFT
                            </Button>
                          </div>
                        </>
                      )}
                    </>
                  )}
                </div>

                <div style={styles.divider} />

                <div style={styles.dynastyDraftBlock}>
                  <div style={styles.dynastyDraftHead}>
                    <div>
                      <div style={styles.dynastyDraftEyebrow}>OFFSEASON LIFECYCLE</div>
                      <div style={styles.dynastyDraftTitle}>
                        {settings.season} → {Number(settings.season) + 1} PLAYER PROTECTION
                      </div>
                      <div style={styles.setupGroupText}>
                        Owners protect exactly {settings.dynasty_protected_players} players from their current roster.
                        Lock the league only after every active franchise is complete, then finalize the protected
                        rosters before the Annual Dynasty Draft can be prepared.
                      </div>
                    </div>
                    <div style={styles.row}>
                      <div style={styles.dynastyDraftBadge}>
                        {pretty(settings.dynasty_protection_status)}
                      </div>
                      <Button secondary onClick={() => setProtectionPanelCollapsed((value) => !value)}>
                        {protectionPanelCollapsed ? "EXPAND" : "MINIMIZE"}
                      </Button>
                    </div>
                  </div>

                  {!protectionPanelCollapsed ? <>
                  <div className="g365-nhl-stats" style={styles.stats}>
                    <Stat label="Source Season" value={settings.season} />
                    <Stat label="Target Season" value={Number(settings.season) + 1} />
                    <Stat label="Protected / Team" value={settings.dynasty_protected_players} />
                    <Stat
                      label="Deadline"
                      value={
                        settings.dynasty_protection_deadline
                          ? new Date(settings.dynasty_protection_deadline).toLocaleString()
                          : "Manual Lock"
                      }
                    />
                  </div>

                  <div style={styles.setupGroup}>
                    <div style={styles.setupGroupHead}>
                      <div>
                        <div style={styles.subsectionTitle}>PROTECTION WINDOW</div>
                        <div style={styles.setupGroupText}>
                          Protection rules are configured under League Setup. This section only controls the offseason protection lifecycle.
                        </div>
                      </div>
                    </div>

                    <div className="g365-nhl-stats" style={styles.stats}>
                      <Stat label="Configured Deadline" value={configuredProtectionDeadlineLabel} />
                      <Stat label="Deadline Time" value="12:00 AM" />
                      <Stat label="Season Complete" value={offseasonCalendar?.seasonComplete ? "YES" : "NO"} />
                    </div>

                    <div className="g365-nhl-actions" style={styles.actions}>
                      {settings.dynasty_protection_status === "protection_closed" ? (
                        <Button
                          disabled={saving || !offseasonCalendar?.seasonComplete}
                          onClick={() => void manageProtectionPeriod("open")}
                        >
                          OPEN PLAYER PROTECTION
                        </Button>
                      ) : null}

                      {settings.dynasty_protection_status === "protection_open" ? (
                        <>
                          <Button
                            secondary
                            disabled={saving}
                            onClick={() => void manageProtectionPeriod("set_deadline")}
                          >
                            RECALCULATE DEADLINE
                          </Button>
                          <Button
                            disabled={saving}
                            onClick={() => void manageProtectionPeriod("lock")}
                          >
                            LOCK PLAYER PROTECTION
                          </Button>
                          <Button
                            secondary
                            disabled={saving}
                            onClick={() => void manageProtectionPeriod("close")}
                          >
                            CLOSE WINDOW
                          </Button>
                        </>
                      ) : null}

                      {settings.dynasty_protection_status === "protection_locked" ? (
                        <>
                          <Button
                            secondary
                            disabled={saving}
                            onClick={() => void manageProtectionPeriod("reopen")}
                          >
                            REOPEN PLAYER PROTECTION
                          </Button>
                          <Button
                            disabled={saving}
                            onClick={() => void finalizeProtectedRosters()}
                          >
                            FINALIZE PROTECTED ROSTERS
                          </Button>
                        </>
                      ) : null}
                    </div>

                    {!offseasonCalendar?.seasonComplete ? (
                      <div style={styles.inlineHelp}>
                        Player protection can be configured now, but it cannot be opened until the current G365 fantasy season is complete.
                      </div>
                    ) : null}
                  </div>

                  <div style={styles.setupGroup}>
                    <div style={styles.setupGroupHead}>
                      <div>
                        <div style={styles.subsectionTitle}>TEAM PROTECTION PROGRESS</div>
                        <div style={styles.setupGroupText}>
                          Current protection count for each active franchise. An unmanaged team is a franchise
                          with no owner or whose owner is no longer a league member.
                        </div>
                      </div>
                    </div>

                    <div style={styles.protectionTeamList}>
                      {teams
                        .filter((team) => team.active)
                        .slice(0, settings.max_teams)
                        .map((team) => {
                          const teamRows = protectionSelections.filter(
                            (row) =>
                              row.fantasy_team_id === team.id &&
                              row.source_season === Number(settings.season) &&
                              row.target_season === Number(settings.season) + 1 &&
                              ["selected", "locked", "carried_over"].includes(row.status)
                          );
                          const protectedCount = teamRows.length;
                          const carriedCount = teamRows.filter(
                            (row) => row.status === "carried_over"
                          ).length;
                          const lockedCount = teamRows.filter(
                            (row) => row.status === "locked"
                          ).length;
                          const ownerIsMember =
                            !!team.owner_id &&
                            members.some((member) => member.user_id === team.owner_id);
                          const unmanaged = !team.owner_id || !ownerIsMember;
                          const complete =
                            protectedCount === settings.dynasty_protected_players;

                          return (
                            <div key={team.id} style={styles.protectionTeamRow}>
                              <div style={styles.protectionTeamIdentity}>
                                <strong>{team.team_name}</strong>
                                <span>
                                  {unmanaged
                                    ? "UNMANAGED / ORPHAN"
                                    : team.is_cpu
                                      ? "CPU TEAM"
                                      : "OWNER ASSIGNED"}
                                </span>
                              </div>

                              <div style={styles.protectionCount}>
                                {protectedCount} / {settings.dynasty_protected_players}
                              </div>

                              <div
                                style={{
                                  ...styles.protectionStatusBadge,
                                  ...(complete
                                    ? styles.protectionStatusComplete
                                    : styles.protectionStatusPending),
                                }}
                              >
                                {carriedCount > 0
                                  ? "FINALIZED"
                                  : lockedCount === protectedCount && protectedCount > 0
                                    ? "LOCKED"
                                    : complete
                                      ? "READY"
                                      : "PENDING"}
                              </div>
                            </div>
                          );
                        })}
                    </div>

                    {protectionSelections.length === 0 ? (
                      <div style={styles.inlineHelp}>
                        No protection selections are currently visible. This is normal before owners begin
                        selecting players. If selections exist but RLS hides direct rows, the lifecycle RPCs
                        remain authoritative and will enforce the exact team counts before league lock.
                      </div>
                    ) : null}
                  </div>

                  <div style={styles.notice}>
                    <strong>ANNUAL DRAFT GATE</strong>
                    <span>
                      The {annualDraftSeason} Annual Dynasty Draft becomes available after every active franchise has exactly {settings.dynasty_protected_players} finalized protected players.
                    </span>
                  </div>

                  <div style={styles.divider} />

                  <div style={styles.dynastyDraftBlock}>
                    <div style={styles.dynastyDraftHead}>
                      <div>
                        <div style={styles.dynastyDraftEyebrow}>ANNUAL DYNASTY DRAFT</div>
                        <div style={styles.dynastyDraftTitle}>{annualDraftSeason} ANNUAL DYNASTY DRAFT</div>
                        <div style={styles.setupGroupText}>
                          Annual Dynasty drafts are linear. The same original franchise-slot order repeats every round. A traded pick stays in its original slot but is made by its current owner.
                        </div>
                      </div>
                      <div style={styles.dynastyDraftBadge}>LINEAR DRAFT</div>
                    </div>

                    {!annualDraft ? (
                      <div style={styles.notice}>
                        <strong>ANNUAL DRAFT NOT PREPARED</strong>
                        <span>
                          {annualProtectionFinalized
                            ? "Protected rosters are finalized. The Annual Dynasty Draft can now be prepared."
                            : "Finalize every active franchise's protected roster before preparing the Annual Dynasty Draft."}
                        </span>
                        <div className="g365-nhl-actions" style={styles.actions}>
                          <Button disabled={saving || !annualProtectionFinalized} onClick={() => void prepareAnnualDynastyDraft()}>
                            PREPARE {annualDraftSeason} ANNUAL DRAFT
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="g365-nhl-stats" style={styles.stats}>
                          <Stat label="Season" value={annualDraftSeason} />
                          <Stat label="Status" value={pretty(annualDraft.status)} />
                          <Stat label="Format" value="Annual Dynasty" />
                          <Stat label="Draft Style" value="Linear" />
                          <Stat label="Rounds" value={annualDraft.rounds ?? "—"} />
                          <Stat label="Order Method" value={pretty(annualDraft.draft_order_method)} />
                        </div>

                        {annualDraft.status === "setup" || annualDraft.status === "ready" ? (
                          <>
                            <div className="g365-nhl-dynasty-choice-grid" style={styles.dynastyChoiceGrid}>
                              <div style={styles.dynastyChoiceCard}>
                                <span style={styles.dynastyChoiceNumber}>OPTION 1</span>
                                <strong style={styles.dynastyChoiceTitle}>DYNASTY DRAFT LOTTERY</strong>
                                <span style={styles.dynastyChoiceText}>
                                  Run the official league lottery for the annual franchise-slot order. The resulting order repeats unchanged in every round.
                                </span>
                                <Button secondary disabled={saving} onClick={() => router.push(`/league/${leagueId}/nhl/draft-lottery`)}>
                                  OPEN DRAFT LOTTERY
                                </Button>
                              </div>

                              <div style={styles.dynastyChoiceCard}>
                                <span style={styles.dynastyChoiceNumber}>OPTION 2</span>
                                <strong style={styles.dynastyChoiceTitle}>REVERSE FINAL STANDINGS</strong>
                                <span style={styles.dynastyChoiceText}>
                                  Use the prior season's final standings, with the lowest-finishing franchise receiving Slot 1.
                                </span>
                                <Button disabled={saving} onClick={() => void applyAnnualReverseStandings()}>
                                  APPLY REVERSE STANDINGS
                                </Button>
                              </div>
                            </div>

                            <NhlDynastyLotteryOfficial leagueId={leagueId} draftSeason={annualDraftSeason} />
                          </>
                        ) : (
                          <div style={styles.notice}>
                            <strong>ANNUAL DRAFT ORDER LOCKED</strong>
                            <span>The Annual Dynasty Draft is {pretty(annualDraft.status)}. Its official order is no longer editable.</span>
                          </div>
                        )}

                        <div style={styles.draftToolbar}>
                          <div>
                            <div style={styles.subsectionTitle}>OFFICIAL ANNUAL DYNASTY FRANCHISE ORDER</div>
                            <div style={styles.setupGroupText}>
                              This exact original-franchise order repeats in every round. It never reverses.
                            </div>
                          </div>
                        </div>

                        {annualOrder.length > 0 ? (
                          <div style={styles.draftOrderList}>
                            {annualOrder.map((draftTeam) => {
                              const team = teams.find((row) => row.id === draftTeam.fantasy_team_id);
                              return (
                                <div key={draftTeam.id} className="g365-nhl-draft-order-row" style={styles.draftOrderRow}>
                                  <div style={styles.draftSlotNumber}>{draftTeam.draft_slot}</div>
                                  <div style={styles.draftTeamName}>
                                    <strong>{team?.team_name ?? `Team ${draftTeam.fantasy_team_id}`}</strong>
                                    <span>ORIGINAL FRANCHISE SLOT {draftTeam.draft_slot}</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div style={styles.inlineHelp}>Choose and complete an annual draft-order method to populate the official franchise order.</div>
                        )}

                        {annualOrder.length > 0 ? (
                          <div style={styles.snakePreview}>
                            <strong>LINEAR ORDER PREVIEW</strong>
                            <span>Round 1: {annualOrder.map((row) => teams.find((team) => team.id === row.fantasy_team_id)?.team_name ?? `Team ${row.fantasy_team_id}`).join(" → ")}</span>
                            <span>Round 2: {annualOrder.map((row) => teams.find((team) => team.id === row.fantasy_team_id)?.team_name ?? `Team ${row.fantasy_team_id}`).join(" → ")}</span>
                            <span>Every later round repeats this same franchise-slot order.</span>
                          </div>
                        ) : null}

                        {annualAssets.length > 0 ? (
                          <div style={styles.setupGroup}>
                            <div style={styles.setupGroupHead}>
                              <div>
                                <div style={styles.subsectionTitle}>ANNUAL DRAFT PICK OWNERSHIP</div>
                                <div style={styles.setupGroupText}>
                                  Pick slots belong to the original franchise position. Current owner shows who actually makes the pick after trades.
                                </div>
                              </div>
                            </div>
                            <div style={styles.draftOrderList}>
                              {annualAssets.map((asset) => {
                                const original = teams.find((team) => team.id === asset.original_fantasy_team_id);
                                const current = teams.find((team) => team.id === asset.current_fantasy_team_id);
                                const traded = asset.original_fantasy_team_id !== asset.current_fantasy_team_id;
                                return (
                                  <div key={asset.id} className="g365-nhl-draft-order-row" style={styles.draftOrderRow}>
                                    <div style={styles.draftSlotNumber}>{asset.overall_pick ?? "—"}</div>
                                    <div style={styles.draftTeamName}>
                                      <strong>ROUND {asset.round_number} • PICK {asset.pick_number ?? "—"}</strong>
                                      <span>Original: {original?.team_name ?? `Team ${asset.original_fantasy_team_id}`}</span>
                                      <span>{traded ? `CURRENT OWNER: ${current?.team_name ?? `Team ${asset.current_fantasy_team_id}`} • TRADED PICK` : `Owner: ${current?.team_name ?? `Team ${asset.current_fantasy_team_id}`}`}</span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ) : null}

                        <div className="g365-nhl-actions" style={styles.actions}>
                          <Button secondary disabled={saving} onClick={() => router.push(`/league/${leagueId}/nhl/draft`)}>
                            OPEN LIVE DRAFT
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                  </> : null}
                </div>

                <div style={styles.divider} />

                <div style={styles.notice}>
                  <strong>DYNASTY SETTINGS</strong>
                  <span>Annual Dynasty rules, protected-player count, future pick years, roster carryover, and the protection deadline are configured under League Setup.</span>
                </div>
              </>
            ) : (
              <>
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
                      <Stat label="Format" value="Redraft" />
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
                            <div style={styles.subsectionTitle}>REDRAFT ROUND 1 DRAFT ORDER</div>
                            <div style={styles.setupGroupText}>This is the league Redraft order. Randomize all teams or arrange them manually. The saved Round 1 slots become the snake-draft order.</div>
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
                          <strong>REDRAFT LEAGUE DRAFT ORDER</strong>
                          <span>Round 1: {draftOrder.map((id) => teams.find((team) => team.id === id)?.team_name ?? `Team ${id}`).join(" → ") || "—"}</span>
                          <span>Round 2: {[...draftOrder].reverse().map((id) => teams.find((team) => team.id === id)?.team_name ?? `Team ${id}`).join(" → ") || "—"}</span>
                        </div>

                        <div className="g365-nhl-actions" style={styles.actions}>
                          <Button disabled={saving || draftOrder.length === 0} onClick={() => void saveManualDraftOrder()}>SAVE MANUAL DRAFT ORDER</Button>
                          <Button secondary disabled={saving} onClick={() => router.push(`/league/${leagueId}/nhl/draft`)}>OPEN LIVE DRAFT</Button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div style={styles.notice}>
                          <strong>DRAFT ORDER LOCKED</strong>
                          <span>The draft is {pretty(draftState.status)}. Draft order cannot be changed after the draft begins. Reset the draft from the live Draft page before assigning a new order.</span>
                        </div>

                        <div style={styles.draftToolbar}>
                          <div>
                            <div style={styles.subsectionTitle}>OFFICIAL REDRAFT LEAGUE DRAFT ORDER</div>
                            <div style={styles.setupGroupText}>
                              This is the saved Round 1 order being used by the league. Redraft uses a snake format, so Round 2 reverses this order.
                            </div>
                          </div>
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
                              </div>
                            );
                          })}
                        </div>

                        <div style={styles.snakePreview}>
                          <strong>OFFICIAL REDRAFT SNAKE ORDER</strong>
                          <span>Round 1: {draftOrder.map((id) => teams.find((team) => team.id === id)?.team_name ?? `Team ${id}`).join(" → ") || "—"}</span>
                          <span>Round 2: {[...draftOrder].reverse().map((id) => teams.find((team) => team.id === id)?.team_name ?? `Team ${id}`).join(" → ") || "—"}</span>
                        </div>

                        <div className="g365-nhl-actions" style={styles.actions}>
                          <Button secondary disabled={saving} onClick={() => router.push(`/league/${leagueId}/nhl/draft`)}>OPEN LIVE DRAFT</Button>
                        </div>
                      </>
                    )}
                  </>
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

        {tab === "trades" && settings ? (
          <Section
            title="Trade Review Queue"
            subtitle="Trades accepted by the receiving team wait here when Commissioner Review is enabled. Assets do not move until you approve the trade."
          >
            <div className="g365-nhl-stats" style={styles.stats}>
              <Stat
                label="Review Mode"
                value={settings.trade_review_mode === "commissioner" ? "Commissioner Review" : "No Review"}
              />
              <Stat
                label="Waiting"
                value={tradeReviewQueue?.pendingReviewCount ?? 0}
              />
              <Stat
                label="Trade Deadline"
                value={settings.trade_deadline_week ? `Week ${settings.trade_deadline_week}` : "None"}
              />
            </div>

            {settings.trade_review_mode !== "commissioner" ? (
              <div style={styles.tradeEmpty}>
                <strong style={styles.tradeEmptyTitle}>COMMISSIONER REVIEW IS OFF</strong>
                <span style={styles.tradeEmptyText}>
                  Accepted trades process immediately. Change Trade Review under League Setup to use this queue.
                </span>
              </div>
            ) : (tradeReviewQueue?.trades ?? []).length === 0 ? (
              <div style={styles.tradeEmpty}>
                <strong style={styles.tradeEmptyTitle}>NO TRADES WAITING</strong>
                <span style={styles.tradeEmptyText}>
                  Receiver-accepted trades will appear here for commissioner approval or veto.
                </span>
              </div>
            ) : (
              <div style={styles.tradeReviewList}>
                {(tradeReviewQueue?.trades ?? []).map((trade) => {
                  const leftId = trade.proposingTeam.fantasyTeamId;
                  const rightId = trade.receivingTeam.fantasyTeamId;
                  const leftPlayers = trade.players.filter((player) => player.fromFantasyTeamId === leftId);
                  const rightPlayers = trade.players.filter((player) => player.fromFantasyTeamId === rightId);
                  const leftPicks = trade.draftPicks.filter((pick) => pick.fromFantasyTeamId === leftId);
                  const rightPicks = trade.draftPicks.filter((pick) => pick.fromFantasyTeamId === rightId);
                  const working = tradeReviewActionId === trade.tradeOfferId;

                  const renderAssets = (players: TradeReviewPlayer[], picks: TradeReviewDraftPick[]) => (
                    <div style={styles.tradeAssetList}>
                      {players.map((player) => (
                        <div key={`player-${player.tradePlayerId}`} style={styles.tradeAsset}>
                          <div style={styles.tradeAssetMain}>
                            <strong>{player.playerName}</strong>
                            <span style={styles.tradeAssetMeta}>{player.position ?? "NHL Player"}</span>
                          </div>
                          <span style={styles.tradeArrow}>→ {player.toTeamName}</span>
                        </div>
                      ))}
                      {picks.map((pick) => (
                        <div key={`pick-${pick.tradeDraftPickId}`} style={styles.tradeAsset}>
                          <div style={styles.tradeAssetMain}>
                            <strong>{pick.draftSeason} Round {pick.roundNumber}</strong>
                            <span style={styles.tradeAssetMeta}>
                              {pick.pickNumber != null ? `Pick ${pick.pickNumber}` : "Pick TBD"}
                              {pick.originalTeamName ? ` • originally ${pick.originalTeamName}` : ""}
                            </span>
                          </div>
                          <span style={styles.tradeArrow}>→ {pick.toTeamName}</span>
                        </div>
                      ))}
                      {players.length === 0 && picks.length === 0 ? (
                        <span style={styles.tradeAssetMeta}>No assets from this team.</span>
                      ) : null}
                    </div>
                  );

                  return (
                    <article key={trade.tradeOfferId} style={styles.tradeReviewCard}>
                      <div style={styles.tradeReviewHead}>
                        <div>
                          <div style={styles.tradeReviewEyebrow}>TRADE #{trade.tradeOfferId} • AWAITING REVIEW</div>
                          <strong style={styles.tradeReviewTitle}>
                            {trade.proposingTeam.teamName} ↔ {trade.receivingTeam.teamName}
                          </strong>
                        </div>
                        <div style={styles.tradeReviewTime}>
                          Accepted {trade.acceptedByReceiverAt ? new Date(trade.acceptedByReceiverAt).toLocaleString() : "—"}
                        </div>
                      </div>

                      <div className="g365-nhl-trade-sides" style={styles.tradeSides}>
                        <div style={styles.tradeSide}>
                          <div style={styles.tradeSideTitle}>{trade.proposingTeam.teamName} SENDS</div>
                          {renderAssets(leftPlayers, leftPicks)}
                        </div>
                        <div style={styles.tradeSide}>
                          <div style={styles.tradeSideTitle}>{trade.receivingTeam.teamName} SENDS</div>
                          {renderAssets(rightPlayers, rightPicks)}
                        </div>
                      </div>

                      {trade.message ? (
                        <div style={styles.tradeMessage}>
                          <strong>Trade message:</strong> {trade.message}
                        </div>
                      ) : null}

                      {trade.draftContext ? (
                        <div style={styles.tradeDraftContext}>
                          Draft-day trade • {pretty(trade.draftContext.draftStatus)}
                          {trade.draftContext.overallPick != null ? ` • Overall Pick ${trade.draftContext.overallPick}` : ""}
                        </div>
                      ) : null}

                      <label style={styles.field}>
                        <span style={styles.fieldLabel}>Commissioner Review Note (optional)</span>
                        <textarea
                          value={tradeReviewNotes[trade.tradeOfferId] ?? ""}
                          onChange={(event) =>
                            setTradeReviewNotes((current) => ({
                              ...current,
                              [trade.tradeOfferId]: event.target.value,
                            }))
                          }
                          placeholder="Optional note saved with the approval or veto..."
                          rows={3}
                          style={{ ...styles.input, resize: "vertical", minHeight: "78px" }}
                          disabled={working}
                        />
                      </label>

                      <div className="g365-nhl-trade-actions" style={styles.tradeActions}>
                        <button
                          type="button"
                          onClick={() => void reviewTrade(trade, "approve")}
                          disabled={saving || working}
                          style={{ ...styles.tradeApproveButton, ...(saving || working ? styles.disabled : {}) }}
                        >
                          {working ? "PROCESSING…" : "APPROVE TRADE"}
                        </button>
                        <button
                          type="button"
                          onClick={() => void reviewTrade(trade, "veto")}
                          disabled={saving || working}
                          style={{ ...styles.tradeVetoButton, ...(saving || working ? styles.disabled : {}) }}
                        >
                          {working ? "PROCESSING…" : "VETO TRADE"}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
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

        {tab === "corrections" && settings ? (
          <Section
            title="NHL Stat Corrections"
            subtitle="Apply auditable commissioner corrections without changing imported provider stats. Every correction and reversal requires a reason and automatically propagates through affected league results."
          >
            <div style={styles.correctionWarning}>
              <strong>OFFICIAL CORRECTION LEDGER</strong>
              <span>Corrections are additive. Reversals remain in history. If a playoff correction would change a winner after the downstream round has started, G365 blocks the correction instead of rewriting played bracket history.</span>
            </div>

            <div className="g365-nhl-correction-grid" style={styles.correctionGrid}>
              <div style={styles.correctionPanel}>
                <div style={styles.subsectionTitle}>1. SELECT PLAYER</div>
                <label style={styles.field}>
                  <span style={styles.fieldLabel}>Search Player</span>
                  <input value={correctionPlayerQuery} onChange={(e) => setCorrectionPlayerQuery(e.target.value)} placeholder="Type player name, team, position, or player ID" style={styles.input} />
                </label>
                <div style={styles.correctionPlayerList}>
                  {correctionPlayers.length === 0 ? (
                    <Button secondary disabled={correctionBusy} onClick={() => void loadCorrectionPlayers()}>LOAD NHL PLAYERS</Button>
                  ) : correctionPlayers
                      .filter((player) => {
                        const q = correctionPlayerQuery.trim().toLowerCase();
                        if (!q) return false;
                        return `${player.name} ${player.position ?? ""} ${player.team ?? ""} ${player.id}`.toLowerCase().includes(q);
                      })
                      .slice(0, 20)
                      .map((player) => (
                        <button key={player.id} type="button" onClick={() => void loadCorrectionPlayerGames(player.id)}
                          style={{ ...styles.correctionPlayerButton, ...(correctionSelectedPlayerId === player.id ? styles.correctionPlayerButtonActive : {}) }}>
                          <strong>{player.name}</strong><span>{[player.team, player.position, `#${player.id}`].filter(Boolean).join(" • ")}</span>
                        </button>
                      ))}
                </div>
              </div>

              <div style={styles.correctionPanel}>
                <div style={styles.subsectionTitle}>2. SELECT GAME</div>
                {!correctionSelectedPlayerId ? <div style={styles.correctionEmpty}>Select a player to load the current season's game-stat rows.</div> : correctionGameStats.length === 0 ? <div style={styles.correctionEmpty}>No {settings.season} player-game stat rows were found for this player.</div> : (
                  <div style={styles.correctionGameList}>
                    {correctionGameStats.map((game) => (
                      <button key={game.id} type="button" onClick={() => setCorrectionSelectedStatId(game.id)}
                        style={{ ...styles.correctionGameButton, ...(correctionSelectedStatId === game.id ? styles.correctionGameButtonActive : {}) }}>
                        <span><strong>Game #{game.nhl_game_id}</strong>{game.game_date ? ` • ${new Date(game.game_date).toLocaleDateString()}` : ""}{game.opponent ? ` • vs ${game.opponent}` : ""}</span>
                        <span>Fantasy Pts: <strong>{game.fantasy_points ?? "—"}</strong> • Stat Row #{game.id}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div style={styles.correctionPanel}>
              <div style={styles.subsectionTitle}>3. APPLY CORRECTION</div>
              <div className="g365-nhl-correction-grid" style={styles.correctionFormGrid}>
                {settings.scoring_system === "categories" ? (
                  <SelectField label="Stat Category" value={correctionStatKey} onChange={setCorrectionStatKey}>
                    {correctionStatOptions.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                  </SelectField>
                ) : (
                  <div style={styles.field}><span style={styles.fieldLabel}>Correction Type</span><div style={styles.readOnly}>Fantasy Points Adjustment</div></div>
                )}
                <label style={styles.field}><span style={styles.fieldLabel}>Adjustment (+ / -)</span><input type="number" step={correctionStatKey === "goalie_started" ? "1" : "0.01"} value={correctionAdjustment} onChange={(e) => setCorrectionAdjustment(e.target.value)} placeholder="Example: 1 or -0.5" style={styles.input} /></label>
                <label style={styles.field}><span style={styles.fieldLabel}>Required Reason</span><input value={correctionReason} onChange={(e) => setCorrectionReason(e.target.value)} placeholder="Official stat correction reason" style={styles.input} /></label>
              </div>
              <div style={styles.actions}><Button disabled={correctionBusy || !correctionSelectedStatId} onClick={() => void applyCorrection()}>APPLY CORRECTION</Button></div>
            </div>

            <div style={styles.correctionPanel}>
              <div style={styles.correctionHistoryHead}><div><div style={styles.subsectionTitle}>CORRECTION HISTORY</div><div style={styles.setupGroupText}>{correctionSelectedPlayerId ? "Showing the selected player's current-season audit history." : "Select a player to view their audit history."}</div></div>{correctionSelectedPlayerId ? <Button secondary disabled={correctionBusy} onClick={() => void loadCorrectionHistory(correctionSelectedPlayerId)}>REFRESH HISTORY</Button> : null}</div>
              {corrections.length === 0 ? <div style={styles.correctionEmpty}>No corrections are currently shown.</div> : <div style={styles.correctionHistoryList}>{corrections.map((row) => {
                const player = correctionPlayers.find((item) => item.id === row.nhl_player_id);
                const amount = row.correction_type === "stat" ? Number(row.stat_adjustment ?? 0) : Number(row.adjustment ?? 0);
                return <div key={row.id} className="g365-nhl-correction-history-row" style={styles.correctionHistoryRow}>
                  <div style={styles.correctionHistoryMain}><div style={styles.correctionHistoryTitle}><strong>#{row.id} • {player?.name ?? `Player #${row.nhl_player_id}`}</strong><span style={{ ...styles.correctionBadge, ...(row.reversed_at ? styles.correctionBadgeReversed : {}) }}>{row.reversed_at ? "REVERSED" : "ACTIVE"}</span></div><div style={styles.correctionHistoryMeta}>Game #{row.nhl_game_id} • {row.correction_type === "stat" ? `${correctionStatOptions.find(([key]) => key === row.stat_key)?.[1] ?? pretty(row.stat_key)} ${amount > 0 ? "+" : ""}${amount}` : `Fantasy Points ${amount > 0 ? "+" : ""}${amount}`} • {new Date(row.created_at).toLocaleString()}</div><div style={styles.correctionReason}><strong>Reason:</strong> {row.reason}</div>{row.reversed_at ? <div style={styles.correctionReversal}><strong>Reversal:</strong> {row.reversal_reason ?? "—"} • {new Date(row.reversed_at).toLocaleString()}</div> : null}</div>
                  {!row.reversed_at ? <div style={styles.correctionReverseBox}><input value={correctionReverseReasons[row.id] ?? ""} onChange={(e) => setCorrectionReverseReasons((current) => ({ ...current, [row.id]: e.target.value }))} placeholder="Required reversal reason" style={styles.input} /><Button secondary disabled={correctionBusy} onClick={() => void reverseCorrection(row)}>REVERSE</Button></div> : null}
                </div>;
              })}</div>}
            </div>
          </Section>
        ) : null}
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  tradeReviewList: { display: "grid", gap: "14px", marginTop: "16px" },
  tradeReviewCard: { padding: "15px", border: "1px solid rgba(255,92,32,.28)", borderRadius: "12px", background: "linear-gradient(180deg,rgba(175,42,15,.09),rgba(255,255,255,.018))" },
  tradeReviewHead: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", flexWrap: "wrap", marginBottom: "13px" },
  tradeReviewEyebrow: { color: "#ff6a2a", fontSize: "9px", fontWeight: 950, letterSpacing: ".08em" },
  tradeReviewTitle: { display: "block", marginTop: "4px", color: "#fff", fontSize: "16px" },
  tradeReviewTime: { color: "#8f96a2", fontSize: "10px" },
  tradeSides: { display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: "10px" },
  tradeSide: { minWidth: 0, padding: "12px", border: "1px solid rgba(255,255,255,.08)", borderRadius: "10px", background: "rgba(5,7,10,.48)" },
  tradeSideTitle: { marginBottom: "9px", color: "#ff8b57", fontSize: "10px", fontWeight: 950, letterSpacing: ".05em" },
  tradeAssetList: { display: "grid", gap: "7px" },
  tradeAsset: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", padding: "9px", border: "1px solid rgba(255,255,255,.065)", borderRadius: "8px", background: "rgba(255,255,255,.025)" },
  tradeAssetMain: { display: "flex", flexDirection: "column", gap: "2px", minWidth: 0, color: "#f5f7fa", fontSize: "12px" },
  tradeAssetMeta: { color: "#8f96a2", fontSize: "10px", lineHeight: 1.4 },
  tradeArrow: { flex: "0 0 auto", color: "#ff6a2a", fontSize: "10px", fontWeight: 900, textAlign: "right" },
  tradeMessage: { marginTop: "10px", padding: "10px", borderRadius: "8px", background: "rgba(255,255,255,.025)", color: "#aeb4bd", fontSize: "11px", lineHeight: 1.5 },
  tradeDraftContext: { marginTop: "9px", color: "#ffc06a", fontSize: "10px", fontWeight: 850 },
  tradeActions: { display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: "9px", marginTop: "12px" },
  tradeApproveButton: { minHeight: "44px", border: "1px solid rgba(70,220,130,.32)", borderRadius: "8px", padding: "10px 14px", background: "rgba(30,140,80,.15)", color: "#79e6a6", fontSize: "11px", fontWeight: 950, cursor: "pointer" },
  tradeVetoButton: { minHeight: "44px", border: "1px solid rgba(255,80,35,.38)", borderRadius: "8px", padding: "10px 14px", background: "rgba(185,42,20,.15)", color: "#ff8050", fontSize: "11px", fontWeight: 950, cursor: "pointer" },
  tradeEmpty: { display: "flex", flexDirection: "column", gap: "5px", marginTop: "14px", padding: "16px", border: "1px dashed rgba(255,95,30,.25)", borderRadius: "10px", background: "rgba(255,255,255,.018)" },
  tradeEmptyTitle: { color: "#ff6a2a", fontSize: "11px", letterSpacing: ".06em" },
  tradeEmptyText: { color: "#8f96a2", fontSize: "11px", lineHeight: 1.5 },
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
  checklistWrap: { display: "grid", gap: "14px" },
  checklistHero: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "14px", flexWrap: "wrap", padding: "16px", border: "1px solid rgba(255,95,30,.28)", borderRadius: "12px", background: "linear-gradient(135deg,rgba(170,35,15,.16),rgba(255,115,20,.055))" },
  checklistHeroCopy: { display: "flex", flexDirection: "column", gap: "5px", flex: "1 1 420px", minWidth: 0 },
  checklistEyebrow: { color: "#ff6a2a", fontSize: "9px", fontWeight: 950, letterSpacing: ".12em" },
  checklistHeroTitle: { color: "#fff", fontSize: "17px", lineHeight: 1.25 },
  checklistHeroSub: { color: "#aeb4bd", fontSize: "11px", lineHeight: 1.5 },
  checklistProgressBadge: { flex: "0 0 auto", minWidth: "62px", padding: "10px 12px", textAlign: "center", borderRadius: "10px", border: "1px solid rgba(255,115,30,.32)", background: "rgba(255,95,20,.08)", color: "#ff8a45", fontSize: "18px", fontWeight: 950 },
  checklistProgressTrack: { height: "7px", overflow: "hidden", borderRadius: "999px", background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.05)" },
  checklistProgressFill: { height: "100%", borderRadius: "999px", background: "linear-gradient(90deg,#d92f18,#ff7a1a)", transition: "width .2s ease" },
  checklistList: { display: "grid", gap: "8px" },
  checklistRow: { display: "grid", gridTemplateColumns: "34px minmax(0,1fr) auto", gap: "10px", alignItems: "center", padding: "11px 12px", border: "1px solid rgba(255,255,255,.08)", borderRadius: "10px", background: "rgba(255,255,255,.018)" },
  checklistRowComplete: { border: "1px solid rgba(70,220,130,.20)", background: "rgba(30,140,80,.055)" },
  checklistIcon: { display: "flex", alignItems: "center", justifyContent: "center", width: "28px", height: "28px", borderRadius: "999px", border: "1px solid rgba(255,105,35,.28)", background: "rgba(185,45,15,.08)", color: "#ff7a2a", fontSize: "15px", fontWeight: 950 },
  checklistIconComplete: { border: "1px solid rgba(70,220,130,.28)", background: "rgba(30,140,80,.13)", color: "#79e6a6" },
  checklistItemCopy: { display: "flex", flexDirection: "column", gap: "3px", minWidth: 0 },
  checklistItemLabel: { color: "#f5f7fa", fontSize: "12px" },
  checklistItemMeta: { color: "#8f96a2", fontSize: "10px", lineHeight: 1.4 },
  checklistStatusComplete: { padding: "5px 7px", borderRadius: "999px", border: "1px solid rgba(70,220,130,.24)", background: "rgba(30,140,80,.10)", color: "#79e6a6", fontSize: "8px", fontWeight: 950, letterSpacing: ".05em" },
  checklistStatusPending: { padding: "5px 7px", borderRadius: "999px", border: "1px solid rgba(255,105,35,.22)", background: "rgba(180,45,15,.07)", color: "#ff8952", fontSize: "8px", fontWeight: 950, letterSpacing: ".05em" },
  checklistAutomatic: { display: "grid", gap: "8px", padding: "13px", border: "1px dashed rgba(255,125,35,.25)", borderRadius: "10px", background: "rgba(255,95,20,.025)" },
  checklistAutomaticHead: { color: "#ff7a2a", fontSize: "9px", fontWeight: 950, letterSpacing: ".10em" },
  checklistAutomaticRow: { display: "grid", gridTemplateColumns: "34px minmax(0,1fr)", gap: "10px", alignItems: "center", padding: "8px 0" },
  checklistActivation: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px", flexWrap: "wrap", padding: "16px", border: "1px solid rgba(255,95,30,.32)", borderRadius: "12px", background: "linear-gradient(135deg,rgba(120,20,12,.22),rgba(255,100,20,.06))" },
  checklistActivationCopy: { display: "flex", flexDirection: "column", gap: "5px", flex: "1 1 420px", minWidth: 0 },
  checklistActivationTitle: { color: "#fff", fontSize: "15px" },
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
  statusOrphan: { color: "#ff6a2a", fontSize: "10px", fontWeight: 950, letterSpacing: ".035em" },
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
  badgeOrphan: { padding: "5px 7px", borderRadius: "999px", border: "1px solid rgba(255,82,20,.48)", background: "linear-gradient(135deg,rgba(170,25,15,.22),rgba(255,105,25,.10))", color: "#ff7a35", fontSize: "10px", fontWeight: 950, letterSpacing: ".04em" },
  badgeOwned: { padding: "5px 7px", borderRadius: "999px", border: "1px solid rgba(70,220,130,.28)", background: "rgba(30,140,80,.12)", color: "#79e6a6", fontSize: "10px", fontWeight: 950 },
  badgeCpu: { padding: "5px 7px", borderRadius: "999px", border: "1px solid rgba(255,170,55,.28)", background: "rgba(180,100,20,.12)", color: "#ffc06a", fontSize: "10px", fontWeight: 950 },
  badgeMuted: { padding: "5px 7px", borderRadius: "999px", border: "1px solid rgba(255,255,255,.1)", background: "rgba(255,255,255,.04)", color: "#8f96a2", fontSize: "10px", fontWeight: 950 },
  toggle: { minHeight: "42px", border: "1px solid rgba(255,255,255,.12)", borderRadius: "7px", padding: "8px 10px", background: "#0b0d12", color: "#8e949e", fontSize: "11px", fontWeight: 900, cursor: "pointer" },
  toggleOn: { border: "1px solid rgba(75,220,130,.3)", background: "rgba(40,160,90,.14)", color: "#75e6a4" },
  fieldHint: { color: "#8f98a3", fontSize: "10px", lineHeight: 1.4 },
  protectionTeamList: { display: "grid", gap: "8px" },
  protectionTeamRow: { display: "grid", gridTemplateColumns: "minmax(0,1fr) auto auto", gap: "10px", alignItems: "center", padding: "11px 12px", border: "1px solid rgba(255,255,255,.08)", borderRadius: "9px", background: "rgba(255,255,255,.025)" },
  protectionTeamIdentity: { display: "flex", flexDirection: "column", gap: "3px", minWidth: 0, color: "#f5f7fa", fontSize: "12px" },
  protectionCount: { color: "#fff", fontSize: "13px", fontWeight: 950, whiteSpace: "nowrap" },
  protectionStatusBadge: { padding: "6px 8px", borderRadius: "999px", fontSize: "9px", fontWeight: 950, letterSpacing: ".05em", whiteSpace: "nowrap" },
  protectionStatusComplete: { border: "1px solid rgba(70,220,130,.28)", background: "rgba(30,140,80,.12)", color: "#79e6a6" },
  protectionStatusPending: { border: "1px solid rgba(255,95,30,.28)", background: "rgba(180,45,15,.10)", color: "#ff8952" },
  dynastyDraftBlock: { display: "grid", gap: "14px" },
  dynastyDraftHead: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "14px", flexWrap: "wrap", padding: "15px", border: "1px solid rgba(255,90,28,.22)", borderRadius: "11px", background: "linear-gradient(135deg,rgba(155,24,14,.12),rgba(255,100,25,.035))" },
  dynastyDraftEyebrow: { color: "#ff6829", fontSize: "9px", fontWeight: 950, letterSpacing: ".13em" },
  dynastyDraftTitle: { marginTop: "3px", color: "#fff", fontSize: "20px", fontWeight: 950 },
  dynastyDraftBadge: { padding: "7px 10px", border: "1px solid rgba(255,91,31,.35)", borderRadius: "999px", background: "rgba(190,45,15,.10)", color: "#ff8b57", fontSize: "9px", fontWeight: 950, letterSpacing: ".06em", whiteSpace: "nowrap" },
  dynastyChoiceGrid: { display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: "10px" },
  dynastyChoiceCard: { minHeight: "142px", display: "flex", flexDirection: "column", alignItems: "flex-start", justifyContent: "flex-start", gap: "8px", padding: "15px", border: "1px solid rgba(255,92,32,.28)", borderRadius: "11px", background: "linear-gradient(180deg,rgba(205,48,18,.10),rgba(255,255,255,.018))", color: "#fff", textAlign: "left", cursor: "pointer" },
  dynastyChoiceNumber: { color: "#ff6b2c", fontSize: "9px", fontWeight: 950, letterSpacing: ".12em" },
  dynastyChoiceTitle: { fontSize: "14px", lineHeight: 1.3 },
  dynastyChoiceText: { color: "#9da4ae", fontSize: "11px", lineHeight: 1.5 },
  rookieYearGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(245px,1fr))", gap: "10px" },
  rookieYearCard: { minWidth: 0, padding: "14px", border: "1px solid rgba(255,255,255,.08)", borderRadius: "11px", background: "rgba(255,255,255,.02)" },
  rookieYearTop: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px" },
  rookieYearTitle: { display: "block", marginTop: "3px", color: "#fff", fontSize: "24px" },
  rookieSourceBadge: { padding: "6px 8px", border: "1px solid rgba(255,95,30,.25)", borderRadius: "999px", background: "rgba(175,45,15,.08)", color: "#ff8952", fontSize: "8px", fontWeight: 950, whiteSpace: "nowrap" },
  rookieYearText: { marginTop: "10px", minHeight: "48px", color: "#8f96a2", fontSize: "10px", lineHeight: 1.5 },
  rookieChoiceStack: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "7px", marginTop: "12px" },
  futureDraftSummaryGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: "12px", marginTop: "14px" },
  activeRookieLottery: { marginTop: "4px", paddingTop: "14px", borderTop: "1px solid rgba(255,255,255,.07)" },
  activeRookieLotteryHead: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", flexWrap: "wrap" },
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
  divisionManager: { display: "grid", gap: "12px", marginTop: "14px" },
  divisionManagerHead: { display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "12px", flexWrap: "wrap" },
  divisionGrid: { display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: "12px" },
  divisionCard: { minWidth: 0, padding: "14px", border: "1px solid rgba(255,92,32,.25)", borderRadius: "11px", background: "linear-gradient(180deg,rgba(160,35,15,.09),rgba(255,255,255,.018))" },
  unassignedDivisionCard: { minWidth: 0, padding: "14px", border: "1px dashed rgba(255,130,45,.30)", borderRadius: "11px", background: "rgba(255,100,25,.035)" },
  divisionCardHead: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", marginBottom: "11px" },
  divisionEyebrow: { display: "block", color: "#ff6a2a", fontSize: "9px", fontWeight: 950, letterSpacing: ".10em", marginBottom: "3px" },
  divisionTitle: { display: "block", color: "#fff", fontSize: "16px" },
  divisionCount: { flex: "0 0 auto", padding: "5px 7px", borderRadius: "999px", border: "1px solid rgba(255,95,30,.25)", background: "rgba(190,45,15,.08)", color: "#ff8952", fontSize: "9px", fontWeight: 950 },
  divisionTeamList: { display: "grid", gap: "8px" },
  divisionTeamRow: { display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(170px,220px)", gap: "10px", alignItems: "center", padding: "10px", border: "1px solid rgba(255,255,255,.075)", borderRadius: "9px", background: "rgba(5,7,10,.46)" },
  divisionTeamIdentity: { display: "flex", flexDirection: "column", gap: "3px", minWidth: 0, color: "#f5f7fa", fontSize: "12px" },
  compactSelect: { width: "100%", minHeight: "38px", border: "1px solid rgba(255,255,255,.12)", borderRadius: "7px", padding: "7px 9px", background: "#0b0d12", color: "#f5f7fa", fontSize: "11px", outline: "none" },
  divisionEmpty: { padding: "11px", border: "1px dashed rgba(255,255,255,.10)", borderRadius: "8px", color: "#8f96a2", fontSize: "11px" },
  divisionActions: { display: "flex", flexWrap: "wrap", gap: "7px", marginTop: "11px" },
  correctionWarning: { display: "flex", flexDirection: "column", gap: "5px", marginBottom: "14px", padding: "12px", border: "1px solid rgba(255,95,35,.35)", borderRadius: "9px", background: "rgba(165,45,15,.08)", color: "#d9c3b8", fontSize: "11px", lineHeight: 1.5 },
  correctionGrid: { display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: "12px", marginBottom: "12px" },
  correctionFormGrid: { display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: "12px" },
  correctionPanel: { minWidth: 0, padding: "14px", marginBottom: "12px", border: "1px solid rgba(255,255,255,.075)", borderRadius: "11px", background: "rgba(255,255,255,.018)" },
  correctionPlayerList: { display: "grid", gap: "7px", maxHeight: "360px", overflowY: "auto", marginTop: "10px" },
  correctionPlayerButton: { display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "3px", width: "100%", padding: "10px", border: "1px solid rgba(255,255,255,.08)", borderRadius: "8px", background: "#0b0d12", color: "#f5f7fa", cursor: "pointer", textAlign: "left" },
  correctionPlayerButtonActive: { border: "1px solid rgba(255,95,35,.48)", background: "rgba(180,45,15,.12)" },
  correctionGameList: { display: "grid", gap: "7px", maxHeight: "420px", overflowY: "auto" },
  correctionGameButton: { display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "4px", width: "100%", padding: "10px", border: "1px solid rgba(255,255,255,.08)", borderRadius: "8px", background: "#0b0d12", color: "#b8bec7", cursor: "pointer", textAlign: "left", fontSize: "11px" },
  correctionGameButtonActive: { border: "1px solid rgba(255,95,35,.50)", background: "rgba(180,45,15,.13)", color: "#fff" },
  correctionEmpty: { padding: "14px", border: "1px dashed rgba(255,255,255,.11)", borderRadius: "8px", color: "#8f96a2", fontSize: "11px" },
  correctionHistoryHead: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", flexWrap: "wrap", marginBottom: "10px" },
  correctionHistoryList: { display: "grid", gap: "9px" },
  correctionHistoryRow: { display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(220px,320px)", gap: "12px", padding: "12px", border: "1px solid rgba(255,255,255,.075)", borderRadius: "9px", background: "rgba(5,7,10,.46)" },
  correctionHistoryMain: { minWidth: 0, display: "grid", gap: "6px" },
  correctionHistoryTitle: { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", color: "#fff", fontSize: "12px" },
  correctionHistoryMeta: { color: "#ff8952", fontSize: "10px", lineHeight: 1.45 },
  correctionReason: { color: "#b9bec7", fontSize: "11px", lineHeight: 1.45 },
  correctionReversal: { color: "#8f96a2", fontSize: "10px", lineHeight: 1.45 },
  correctionBadge: { padding: "4px 7px", borderRadius: "999px", border: "1px solid rgba(70,220,130,.28)", background: "rgba(30,140,80,.12)", color: "#79e6a6", fontSize: "8px", fontWeight: 950, letterSpacing: ".05em" },
  correctionBadgeReversed: { border: "1px solid rgba(255,255,255,.12)", background: "rgba(255,255,255,.035)", color: "#8f96a2" },
  correctionReverseBox: { display: "grid", gap: "7px", alignContent: "start" },
  error: { marginBottom: "12px", padding: "11px 13px", borderRadius: "8px", border: "1px solid rgba(255,70,70,.32)", background: "rgba(150,20,20,.18)", color: "#ff9c9c", fontSize: "13px", fontWeight: 750 },
  success: { marginBottom: "12px", padding: "11px 13px", borderRadius: "8px", border: "1px solid rgba(70,220,130,.28)", background: "rgba(30,140,80,.14)", color: "#79e6a6", fontSize: "13px", fontWeight: 750 },
  center: { padding: "80px 20px", textAlign: "center", color: "#c5c9d1", fontSize: "16px" },
  denied: { maxWidth: "620px", margin: "100px auto", padding: "28px", textAlign: "center", border: "1px solid rgba(255,80,60,.25)", borderRadius: "14px", background: "rgba(20,20,24,.94)" },
};
