"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";

import TraditionalScoring from "@/components/traditional/TraditionalScoring";

type Tab =
  | "overview"
  | "league"
  | "scoring"
  | "draft"
  | "teams"
  | "rosters"
  | "waivers"
  | "trades"
  | "season"
  | "playoffs";

type League = {
  id: string;
  name: string;
  league_type: string;
  season: number;
  status: string;
  commissioner_user_id: string;
};

type LeagueSettings = {
  league_id: string;
  season: number;
  max_teams: number | null;
  regular_season_weeks: number | null;
};

type RosterSettings = {
  league_id: string;
  starting_qb: number;
  starting_rb: number;
  starting_wr: number;
  starting_te: number;
  starting_flex: number;
  starting_superflex: number;
  starting_k: number;
  starting_dst: number;
  bench_slots: number;
  ir_slots: number;
  max_qb: number;
  max_rb: number;
  max_wr: number;
  max_te: number;
  max_k: number;
  max_dst: number;
};

type Scoring = {
  league_id: string;
  passing_yards_per_point: number | string;
  passing_td_points: number | string;
  passing_interception_points: number | string;
  passing_two_point_points: number | string;
  passing_completion_points: number | string;
  passing_incompletion_points: number | string;
  rushing_yards_per_point: number | string;
  rushing_td_points: number | string;
  rushing_two_point_points: number | string;
  rushing_attempt_points: number | string;
  receiving_yards_per_point: number | string;
  receiving_td_points: number | string;
  receiving_two_point_points: number | string;
  reception_points: number | string;
  receiving_target_points: number | string;
  passing_first_down_points: number | string;
  rushing_first_down_points: number | string;
  receiving_first_down_points: number | string;
  fumble_points: number | string;
  fumble_lost_points: number | string;
  extra_point_made_points: number | string;
  extra_point_missed_points: number | string;
  field_goal_missed_points: number | string;
  dst_sack_points: number | string;
  dst_interception_points: number | string;
  dst_fumble_recovery_points: number | string;
  dst_touchdown_points: number | string;
  dst_safety_points: number | string;
  dst_blocked_kick_points: number | string;
  dst_return_touchdown_points: number | string;
  dst_extra_point_return_points: number | string;
  kick_return_yards_per_point: number | string | null;
  punt_return_yards_per_point: number | string | null;
  kick_return_td_points: number | string;
  punt_return_td_points: number | string;
  offensive_fumble_recovery_td_points: number | string;
  fractional_scoring_enabled: boolean;
  decimal_places: number;
};

type Draft = {
  id: string;
  status: string;
  scheduled_at: string | null;
  started_at: string | null;
  total_rounds: number;
  current_overall_pick: number;
  pick_timer_seconds: number;
  cpu_pick_seconds: number;
  is_paused: boolean;
};

type WaiverSettings = {
  league_id: string;
  waiver_type: string;
  continuous_waivers: boolean;
  waiver_period_hours: number;
  faab_budget: number;
  allow_free_agent_adds: boolean;
};

type TradeSettings = {
  league_id: string;
  season: number;
  trade_deadline_week: number | null;
};

type PlayoffSettings = {
  league_id: string;
  season: number;
  playoff_teams: number;
  playoff_start_week: number;
  championship_week: number;
  reseed_each_round: boolean;
};

type SeasonState = {
  league_id: string;
  season: number;
  active_week: number;
  phase: string;
  regular_season_complete: boolean;
  playoffs_started: boolean;
  season_complete: boolean;
  last_completed_week: number | null;
};

type Team = {
  id: number;
  league_id: string;
  owner_id: string | null;
  team_name: string;
  active: boolean;
  is_cpu: boolean;
};

type Member = {
  id: number;
  user_id: string;
  role: string;
};

type Profile = {
  id: string;
  display_name: string | null;
  email: string | null;
};

type RosterRow = {
  id: number;
  fantasy_team_id: number;
  player_id: number;
  acquired_via: string;
};

type Player = {
  id: number;
  full_name: string;
  primary_position: string;
  team_abbreviation: string | null;
  is_active: boolean;
};

type WaiverClaim = {
  id: number;
  fantasy_team_id: number;
  player_id: number;
  week: number;
  faab_bid: number | null;
  status: string;
};

type TradeOffer = {
  id: number;
  week: number;
  proposing_fantasy_team_id: number;
  receiving_fantasy_team_id: number;
  status: string;
  message: string | null;
};


type ScoringRule = {
  id: number;
  league_id: string;
  category: string;
  rule_type: string;
  stat_key: string;
  min_value: number | string | null;
  max_value: number | string | null;
  points: number | string;
  is_enabled: boolean;
  stacking_mode: string;
  priority: number;
  label: string | null;
};

type InviteApiResponse = {
  success?: boolean;
  error?: string;
  message?: string;
  inviteUrl?: string;
  invite_url?: string;
  invitationUrl?: string;
  invitation_url?: string;
  url?: string;
};

type LeagueInvitation = {
  id: string;
  league_id: string;
  fantasy_team_id: number | null;
  email: string;
  status: string;
  expires_at: string | null;
};

type ScoringCategoryKey =
  | "passing"
  | "rushing"
  | "receiving"
  | "kicking"
  | "dst"
  | "fumbles"
  | "returns";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const scoringGroups: Record<
  ScoringCategoryKey,
  {
    label: string;
    baseFields: Array<[keyof Scoring, string]>;
    bonusStats: Array<[string, string]>;
  }
> = {
  passing: {
    label: "Passing",
    baseFields: [
      ["passing_yards_per_point", "Passing Yards Per Point"],
      ["passing_td_points", "Passing TD"],
      ["passing_interception_points", "Passing Interception"],
      ["passing_two_point_points", "Passing 2PT"],
      ["passing_completion_points", "Passing Completion"],
      ["passing_incompletion_points", "Passing Incompletion"],
      ["passing_first_down_points", "Passing First Down"],
    ],
    bonusStats: [
      ["passing_yards", "Passing Yards — yardage milestone"],
      ["passing_touchdowns", "Passing Touchdowns — multi-TD bonus"],
      ["longest_passing_touchdown_yards", "Longest Passing TD — yards"],
      ["longest_pass_completion_yards", "Longest Completion — yards"],
      ["passing_completions", "Passing Completions"],
      ["passing_attempts", "Passing Attempts"],
      ["passing_interceptions", "Interceptions Thrown"],
      ["passing_first_downs", "Passing First Downs"],
      ["passing_two_point_conversions", "Passing 2PT Conversions"],
    ],
  },
  rushing: {
    label: "Rushing",
    baseFields: [
      ["rushing_yards_per_point", "Rushing Yards Per Point"],
      ["rushing_td_points", "Rushing TD"],
      ["rushing_two_point_points", "Rushing 2PT"],
      ["rushing_attempt_points", "Rushing Attempt"],
      ["rushing_first_down_points", "Rushing First Down"],
    ],
    bonusStats: [
      ["rushing_yards", "Rushing Yards — yardage milestone"],
      ["rushing_touchdowns", "Rushing Touchdowns — multi-TD bonus"],
      ["longest_rushing_touchdown_yards", "Longest Rushing TD — yards"],
      ["longest_rush_yards", "Longest Rush — yards"],
      ["rushing_attempts", "Rushing Attempts"],
      ["rushing_first_downs", "Rushing First Downs"],
      ["rushing_two_point_conversions", "Rushing 2PT Conversions"],
    ],
  },
  receiving: {
    label: "Receiving",
    baseFields: [
      ["receiving_yards_per_point", "Receiving Yards Per Point"],
      ["receiving_td_points", "Receiving TD"],
      ["receiving_two_point_points", "Receiving 2PT"],
      ["reception_points", "Reception"],
      ["receiving_target_points", "Receiving Target"],
      ["receiving_first_down_points", "Receiving First Down"],
    ],
    bonusStats: [
      ["receiving_yards", "Receiving Yards — yardage milestone"],
      ["receiving_touchdowns", "Receiving Touchdowns — multi-TD bonus"],
      ["longest_receiving_touchdown_yards", "Longest Receiving TD — yards"],
      ["longest_reception_yards", "Longest Reception — yards"],
      ["receptions", "Receptions"],
      ["receiving_targets", "Targets"],
      ["receiving_first_downs", "Receiving First Downs"],
      ["receiving_two_point_conversions", "Receiving 2PT Conversions"],
    ],
  },
  kicking: {
    label: "Kicking",
    baseFields: [
      ["extra_point_made_points", "Extra Point Made"],
      ["extra_point_missed_points", "Extra Point Missed"],
      ["field_goal_missed_points", "Field Goal Missed"],
    ],
    bonusStats: [
      ["field_goals_made", "Field Goals Made — total"],
      ["field_goals_made_0_19", "0–19 Yard Field Goals Made"],
      ["field_goals_made_20_29", "20–29 Yard Field Goals Made"],
      ["field_goals_made_30_39", "30–39 Yard Field Goals Made"],
      ["field_goals_made_40_49", "40–49 Yard Field Goals Made"],
      ["field_goals_made_50_59", "50–59 Yard Field Goals Made"],
      ["field_goals_made_60_plus", "60+ Yard Field Goals Made"],
      ["longest_field_goal_yards", "Longest Field Goal — yards"],
      ["field_goals_missed", "Field Goals Missed"],
      ["extra_points_made", "Extra Points Made"],
      ["extra_points_missed", "Extra Points Missed"],
    ],
  },
  dst: {
    label: "Defense / DST",
    baseFields: [
      ["dst_sack_points", "DST Sack"],
      ["dst_interception_points", "DST Interception"],
      ["dst_fumble_recovery_points", "DST Fumble Recovery"],
      ["dst_touchdown_points", "DST Touchdown"],
      ["dst_safety_points", "DST Safety"],
      ["dst_blocked_kick_points", "DST Blocked Kick"],
      ["dst_return_touchdown_points", "DST Return TD"],
      ["dst_extra_point_return_points", "DST Extra Point Return"],
    ],
    bonusStats: [
      ["dst_points_allowed", "DST Points Allowed — threshold/range"],
      ["dst_yards_allowed", "DST Yards Allowed — threshold/range"],
      ["dst_sacks", "DST Sacks — multi-sack bonus"],
      ["dst_interceptions", "DST Interceptions — multi-INT bonus"],
      ["dst_fumble_recoveries", "DST Fumble Recoveries"],
      ["dst_takeaways", "DST Total Takeaways"],
      ["dst_touchdowns", "DST Defensive Touchdowns"],
      ["dst_return_touchdowns", "DST Return Touchdowns"],
      ["dst_safeties", "DST Safeties"],
      ["dst_blocked_kicks", "DST Blocked Kicks"],
      ["dst_extra_point_returns", "DST Extra Point Returns"],
    ],
  },
  fumbles: {
    label: "Fumbles",
    baseFields: [
      ["fumble_points", "Fumble"],
      ["fumble_lost_points", "Fumble Lost"],
      ["offensive_fumble_recovery_td_points", "Offensive Fumble Recovery TD"],
    ],
    bonusStats: [
      ["fumbles", "Fumbles"],
      ["fumbles_lost", "Fumbles Lost"],
      ["offensive_fumble_recovery_touchdowns", "Offensive Fumble Recovery TDs"],
    ],
  },
  returns: {
    label: "Returns",
    baseFields: [
      ["kick_return_yards_per_point", "Kick Return Yards Per Point"],
      ["punt_return_yards_per_point", "Punt Return Yards Per Point"],
      ["kick_return_td_points", "Kick Return TD"],
      ["punt_return_td_points", "Punt Return TD"],
    ],
    bonusStats: [
      ["kick_return_yards", "Kick Return Yards — yardage milestone"],
      ["kick_return_touchdowns", "Kick Return TDs — multi-TD bonus"],
      ["longest_kick_return_yards", "Longest Kick Return — yards"],
      ["punt_return_yards", "Punt Return Yards — yardage milestone"],
      ["punt_return_touchdowns", "Punt Return TDs — multi-TD bonus"],
      ["longest_punt_return_yards", "Longest Punt Return — yards"],
    ],
  },
};

const rosterFields: Array<[keyof RosterSettings, string]> = [
  ["starting_qb", "Starting QB"],
  ["starting_rb", "Starting RB"],
  ["starting_wr", "Starting WR"],
  ["starting_te", "Starting TE"],
  ["starting_flex", "Starting FLEX"],
  ["starting_superflex", "Starting Superflex"],
  ["starting_k", "Starting K"],
  ["starting_dst", "Starting DST"],
  ["bench_slots", "Bench Slots"],
  ["ir_slots", "IR Slots"],
  ["max_qb", "Max QB"],
  ["max_rb", "Max RB"],
  ["max_wr", "Max WR"],
  ["max_te", "Max TE"],
  ["max_k", "Max K"],
  ["max_dst", "Max DST"],
];

function n(v: string | number | null | undefined, fallback = 0) {
  const parsed = Number(v);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function pretty(value?: string | null) {
  return value
    ? value.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase())
    : "—";
}

function shortId(value?: string | null) {
  return value ? `${value.slice(0, 8)}…` : "—";
}

function localDate(value: string | null) {
  if (!value) return "";
  const d = new Date(value);
  const shifted = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return shifted.toISOString().slice(0, 16);
}

function playoffRounds(teamCount: number) {
  const count = Math.max(2, teamCount);
  return Math.ceil(Math.log2(count));
}

function derivedPlayoffWeeks(regularSeasonWeeks: number, playoffTeams: number) {
  const startWeek = regularSeasonWeeks + 1;
  const championshipWeek = regularSeasonWeeks + playoffRounds(playoffTeams);
  return { startWeek, championshipWeek };
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
        {props.subtitle ? (
          <p style={styles.sectionSub}>{props.subtitle}</p>
        ) : null}
      </div>
      {props.children}
    </section>
  );
}

function Input(props: {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  type?: string;
  disabled?: boolean;
}) {
  return (
    <label style={styles.field}>
      <span style={styles.fieldLabel}>{props.label}</span>
      <input
        type={props.type ?? "number"}
        value={props.value}
        disabled={props.disabled}
        onChange={(e) => props.onChange(e.target.value)}
        style={styles.input}
      />
    </label>
  );
}

function Button(props: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={props.disabled}
      onClick={props.onClick}
      style={{
        ...styles.button,
        ...(props.danger ? styles.danger : {}),
        ...(props.disabled ? styles.disabled : {}),
      }}
    >
      {props.children}
    </button>
  );
}

type TraditionalCommissionerProps = {
  leagueId: string;
};

export default function TraditionalCommissioner({
  leagueId,
}: TraditionalCommissionerProps) {
  const router = useRouter();

  const [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [league, setLeague] = useState<League | null>(null);
  const [leagueSettings, setLeagueSettings] = useState<LeagueSettings | null>(null);
  const [rosterSettings, setRosterSettings] = useState<RosterSettings | null>(null);
  const [scoring, setScoring] = useState<Scoring | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [waivers, setWaivers] = useState<WaiverSettings | null>(null);
  const [trades, setTrades] = useState<TradeSettings | null>(null);
  const [playoffs, setPlayoffs] = useState<PlayoffSettings | null>(null);
  const [season, setSeason] = useState<SeasonState | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [rosters, setRosters] = useState<RosterRow[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [claims, setClaims] = useState<WaiverClaim[]>([]);
  const [offers, setOffers] = useState<TradeOffer[]>([]);
  const [scoringRules, setScoringRules] = useState<ScoringRule[]>([]);
  const [scoringCategory, setScoringCategory] = useState<ScoringCategoryKey>("passing");
  const [draftOrderMode, setDraftOrderMode] = useState<"manual" | "random">("manual");
  const [draftOrder, setDraftOrder] = useState<number[]>([]);
  const [teamInviteEmails, setTeamInviteEmails] = useState<Record<number, string>>({});
  const [invitingTeamId, setInvitingTeamId] = useState<number | null>(null);
  const [invitations, setInvitations] = useState<LeagueInvitation[]>([]);
  const [cpuBusy, setCpuBusy] = useState(false);
  const [deletingLeague, setDeletingLeague] = useState(false);

  const [rosterTeamId, setRosterTeamId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [addPlayerId, setAddPlayerId] = useState<number | null>(null);

  const load = useCallback(async (options?: {
    showLoading?: boolean;
    clearMessages?: boolean;
  }) => {
    const showLoading = options?.showLoading ?? true;
    const clearMessages = options?.clearMessages ?? true;

    if (showLoading) {
      setLoading(true);
    }

    if (clearMessages) {
      setError(null);
      setSuccess(null);
    }

    const auth = await supabase.rpc("is_traditional_league_commissioner", {
      p_league_id: leagueId,
    });

    if (auth.error) {
      setError(auth.error.message);
      if (showLoading) setLoading(false);
      return;
    }

    if (auth.data !== true) {
      setAuthorized(false);
      if (showLoading) setLoading(false);
      return;
    }

    setAuthorized(true);

    const results = await Promise.all([
      supabase.from("leagues").select("*").eq("id", leagueId).single(),
      supabase.from("league_settings").select("*").eq("league_id", leagueId).maybeSingle(),
      supabase.from("traditional_roster_settings").select("*").eq("league_id", leagueId).maybeSingle(),
      supabase.from("league_scoring_settings").select("*").eq("league_id", leagueId).maybeSingle(),
      supabase.from("league_drafts").select("*").eq("league_id", leagueId).order("season", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("traditional_waiver_settings").select("*").eq("league_id", leagueId).maybeSingle(),
      supabase.from("traditional_trade_settings").select("*").eq("league_id", leagueId).maybeSingle(),
      supabase.from("traditional_playoff_settings").select("*").eq("league_id", leagueId).maybeSingle(),
      supabase.from("traditional_season_state").select("*").eq("league_id", leagueId).maybeSingle(),
      supabase.from("fantasy_teams").select("*").eq("league_id", leagueId).order("team_name"),
      supabase.from("league_members").select("id,user_id,role").eq("league_id", leagueId).order("joined_at"),
      supabase.from("team_rosters").select("id,fantasy_team_id,player_id,acquired_via").eq("league_id", leagueId),
      supabase.from("nfl_players").select("id,full_name,primary_position,team_abbreviation,is_active").eq("is_active", true),
      supabase.from("league_scoring_rules").select("id,league_id,category,rule_type,stat_key,min_value,max_value,points,is_enabled,stacking_mode,priority,label").eq("league_id", leagueId).order("category").order("priority"),
      supabase.from("traditional_waiver_claims").select("*").eq("league_id", leagueId).order("submitted_at", { ascending: false }).limit(100),
      supabase.from("traditional_trade_offers").select("*").eq("league_id", leagueId).order("created_at", { ascending: false }).limit(100),
      supabase
        .from("league_invitations")
        .select("id,league_id,fantasy_team_id,email,status,expires_at")
        .eq("league_id", leagueId)
        .eq("status", "pending"),
    ]);

    const failed = results.find((r) => r.error);
    if (failed?.error) {
      setError(failed.error.message);
      if (showLoading) setLoading(false);
      return;
    }

    setLeague(results[0].data as League);
    setLeagueSettings(results[1].data as LeagueSettings | null);
    setRosterSettings(results[2].data as RosterSettings | null);
    setScoring(results[3].data as Scoring | null);
    setDraft(results[4].data as Draft | null);
    setWaivers(results[5].data as WaiverSettings | null);
    const loadedLeagueSettings = results[1].data as LeagueSettings | null;
    const loadedTrades = results[6].data as TradeSettings | null;

    if (loadedTrades && loadedLeagueSettings) {
      const regularSeasonWeeks = loadedLeagueSettings.regular_season_weeks ?? 14;
      setTrades({
        ...loadedTrades,
        trade_deadline_week:
          loadedTrades.trade_deadline_week === null
            ? null
            : Math.min(loadedTrades.trade_deadline_week, regularSeasonWeeks),
      });
    } else {
      setTrades(loadedTrades);
    }
    const loadedPlayoffs = results[7].data as PlayoffSettings | null;

    if (loadedPlayoffs && loadedLeagueSettings) {
      const derived = derivedPlayoffWeeks(
        loadedLeagueSettings.regular_season_weeks ?? 14,
        loadedPlayoffs.playoff_teams
      );

      setPlayoffs({
        ...loadedPlayoffs,
        playoff_start_week: derived.startWeek,
        championship_week: derived.championshipWeek,
      });
    } else {
      setPlayoffs(loadedPlayoffs);
    }
    setSeason(results[8].data as SeasonState | null);

    const loadedTeams = (results[9].data ?? []) as Team[];
    const loadedMembers = (results[10].data ?? []) as Member[];
    const memberUserIds = Array.from(
      new Set(loadedMembers.map((member) => member.user_id).filter(Boolean))
    );

    let loadedProfiles: Profile[] = [];

    if (memberUserIds.length > 0) {
      const profileResult = await supabase
        .from("profiles")
        .select("id,display_name,email")
        .in("id", memberUserIds);

      if (profileResult.error) {
        setError(profileResult.error.message);
        if (showLoading) setLoading(false);
        return;
      }

      loadedProfiles = (profileResult.data ?? []) as Profile[];
    }

    setTeams(loadedTeams);
    setMembers(loadedMembers);
    setProfiles(loadedProfiles);
    setRosters((results[11].data ?? []) as RosterRow[]);
    setPlayers((results[12].data ?? []) as Player[]);
    setScoringRules((results[13].data ?? []) as ScoringRule[]);
    setClaims((results[14].data ?? []) as WaiverClaim[]);
    setOffers((results[15].data ?? []) as TradeOffer[]);
    setInvitations((results[16].data ?? []) as LeagueInvitation[]);

    const activeTeams = ((results[9].data ?? []) as Team[]).filter((team) => team.active);

    setDraftOrder((current) => {
      const activeTeamIds = activeTeams.map((team) => team.id);

      const currentIsValid =
        current.length === activeTeamIds.length &&
        current.every((teamId) => activeTeamIds.includes(teamId));

      return currentIsValid ? current : activeTeamIds;
    });

    setRosterTeamId((current) => current ?? activeTeams[0]?.id ?? null);

    if (showLoading) {
      setLoading(false);
    }
  }, [leagueId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel(`traditional-commissioner-${leagueId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "league_invitations",
          filter: `league_id=eq.${leagueId}`,
        },
        () => {
          void load({
            showLoading: false,
            clearMessages: false,
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "fantasy_teams",
          filter: `league_id=eq.${leagueId}`,
        },
        () => {
          void load({
            showLoading: false,
            clearMessages: false,
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "league_members",
          filter: `league_id=eq.${leagueId}`,
        },
        () => {
          void load({
            showLoading: false,
            clearMessages: false,
          });
        }
      )
      .subscribe();

    const fallbackInterval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void load({
          showLoading: false,
          clearMessages: false,
        });
      }
    }, 5000);

    const handleFocus = () => {
      void load({
        showLoading: false,
        clearMessages: false,
      });
    };

    window.addEventListener("focus", handleFocus);

    return () => {
      window.clearInterval(fallbackInterval);
      window.removeEventListener("focus", handleFocus);
      void supabase.removeChannel(channel);
    };
  }, [leagueId, load]);

  const playerMap = useMemo(
    () => new Map(players.map((p) => [p.id, p] as const)),
    [players]
  );

  const teamMap = useMemo(
    () => new Map(teams.map((t) => [t.id, t] as const)),
    [teams]
  );

  const profileByUserId = useMemo(
    () => new Map(profiles.map((profile) => [profile.id, profile] as const)),
    [profiles]
  );

  const rostered = useMemo(
    () => new Set(rosters.map((r) => r.player_id)),
    [rosters]
  );

  const rosterRows = useMemo(
    () =>
      rosters.filter((r) => r.fantasy_team_id === rosterTeamId).sort((a, b) => {
        const pa = playerMap.get(a.player_id);
        const pb = playerMap.get(b.player_id);
        return `${pa?.primary_position ?? ""}${pa?.full_name ?? ""}`.localeCompare(
          `${pb?.primary_position ?? ""}${pb?.full_name ?? ""}`
        );
      }),
    [rosters, rosterTeamId, playerMap]
  );

  const choices = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return players
      .filter((p) => !rostered.has(p.id))
      .filter((p) =>
        `${p.full_name} ${p.primary_position} ${p.team_abbreviation ?? ""}`
          .toLowerCase()
          .includes(q)
      )
      .slice(0, 50);
  }, [players, rostered, search]);

  async function action(
    fn: () => PromiseLike<{
      error: {
        message: string;
      } | null;
    }>,
    message: string
  ) {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const result =
        await fn();

      if (
        result.error
      ) {
        setError(
          result.error.message
        );

        return;
      }

      await load({
        showLoading: false,
        clearMessages: false,
      });

      setSuccess(message);
    } catch (
      err
    ) {
      setError(
        err instanceof Error
          ? err.message
          : "An unexpected commissioner action error occurred."
      );
    } finally {
      setSaving(
        false
      );
    }
  }

  function changeMaximumTeams(nextMaxTeams: number) {
    if (!leagueSettings) return;

    const maxTeams = Math.max(4, Math.min(12, nextMaxTeams));
    setLeagueSettings({ ...leagueSettings, max_teams: maxTeams });

    if (playoffs && playoffs.playoff_teams > maxTeams) {
      const nextPlayoffTeams = maxTeams >= 8 ? 8 : maxTeams >= 6 ? 6 : maxTeams >= 4 ? 4 : 2;
      const regularWeeks = leagueSettings.regular_season_weeks ?? 14;
      const derived = derivedPlayoffWeeks(regularWeeks, nextPlayoffTeams);
      setPlayoffs({
        ...playoffs,
        playoff_teams: nextPlayoffTeams,
        playoff_start_week: derived.startWeek,
        championship_week: derived.championshipWeek,
      });
    }
  }

  function changeRegularSeasonWeeks(nextRegularSeasonWeeks: number) {
    if (!leagueSettings) return;

    const regularSeasonWeeks = Math.max(1, Math.min(17, nextRegularSeasonWeeks));
    setLeagueSettings({ ...leagueSettings, regular_season_weeks: regularSeasonWeeks });

    // A trade deadline can never be later than the final regular-season week.
    if (trades?.trade_deadline_week !== null &&
        trades?.trade_deadline_week !== undefined &&
        trades.trade_deadline_week > regularSeasonWeeks) {
      setTrades({ ...trades, trade_deadline_week: regularSeasonWeeks });
    }

    if (playoffs) {
      const derived = derivedPlayoffWeeks(regularSeasonWeeks, playoffs.playoff_teams);
      setPlayoffs({
        ...playoffs,
        playoff_start_week: derived.startWeek,
        championship_week: derived.championshipWeek,
      });
    }
  }

  function changePlayoffTeams(nextPlayoffTeams: number) {
    if (!playoffs || !leagueSettings) return;

    const maxTeams = leagueSettings.max_teams ?? 12;
    const playoffTeams = Math.min(nextPlayoffTeams, maxTeams);
    let regularSeasonWeeks = leagueSettings.regular_season_weeks ?? 14;
    const rounds = playoffRounds(playoffTeams);

    // The NFL regular season ends in Week 18. If a larger playoff field needs
    // another round, shorten the fantasy regular season automatically so the
    // championship still fits inside Week 18.
    if (regularSeasonWeeks + rounds > 18) {
      regularSeasonWeeks = 18 - rounds;
      setLeagueSettings({ ...leagueSettings, regular_season_weeks: regularSeasonWeeks });
    }

    const derived = derivedPlayoffWeeks(regularSeasonWeeks, playoffTeams);
    setPlayoffs({
      ...playoffs,
      playoff_teams: playoffTeams,
      playoff_start_week: derived.startWeek,
      championship_week: derived.championshipWeek,
    });
  }

  function changePlayoffStartWeek(nextStartWeek: number) {
    if (!playoffs || !leagueSettings) return;

    const rounds = playoffRounds(playoffs.playoff_teams);
    const maxStartWeek = 19 - rounds;
    const startWeek = Math.max(2, Math.min(maxStartWeek, nextStartWeek));
    const regularSeasonWeeks = startWeek - 1;
    const derived = derivedPlayoffWeeks(regularSeasonWeeks, playoffs.playoff_teams);

    setLeagueSettings({ ...leagueSettings, regular_season_weeks: regularSeasonWeeks });

    // Moving the playoffs earlier also moves the latest possible trade deadline.
    if (trades?.trade_deadline_week !== null &&
        trades?.trade_deadline_week !== undefined &&
        trades.trade_deadline_week > regularSeasonWeeks) {
      setTrades({ ...trades, trade_deadline_week: regularSeasonWeeks });
    }

    setPlayoffs({
      ...playoffs,
      playoff_start_week: derived.startWeek,
      championship_week: derived.championshipWeek,
    });
  }

  async function saveLeagueStructure() {
    if (!leagueSettings || !playoffs) return;

    const maxTeams = leagueSettings.max_teams ?? 12;
    const regularSeasonWeeks = leagueSettings.regular_season_weeks ?? 14;
    const derived = derivedPlayoffWeeks(regularSeasonWeeks, playoffs.playoff_teams);

    if (derived.championshipWeek > 18) {
      setError(
        `This setup would place the championship in Week ${derived.championshipWeek}. Reduce the regular-season weeks or playoff field so the championship is Week 18 or earlier.`
      );
      return;
    }

    await action(
      () =>
        supabase.rpc("commissioner_save_traditional_structure", {
          p_league_id: leagueId,
          p_max_teams: maxTeams,
          p_regular_season_weeks: regularSeasonWeeks,
          p_playoff_teams: playoffs.playoff_teams,
        }),
      `League structure saved: ${maxTeams} teams, ${regularSeasonWeeks} regular-season weeks, playoffs Weeks ${derived.startWeek}-${derived.championshipWeek}.`
    );
  }

  async function saveDraftOrder(order: number[]) {
    if (!order.length) return;

    await action(
      () =>
        supabase.rpc("commissioner_save_traditional_draft_order", {
          p_league_id: leagueId,
          p_team_ids: order,
        }),
      "Draft order saved."
    );
  }

  function randomizeDraftOrder() {
    const activeTeamIds = teams.filter((team) => team.active).map((team) => team.id);
    const shuffled = [...activeTeamIds];

    for (let i = shuffled.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    setDraftOrder(shuffled);
    setDraftOrderMode("random");
  }

  function moveDraftTeam(slotIndex: number, teamId: number) {
    setDraftOrder((current) => {
      const next = [...current];
      const existingIndex = next.indexOf(teamId);

      if (existingIndex >= 0) {
        [next[slotIndex], next[existingIndex]] = [next[existingIndex], next[slotIndex]];
      } else {
        next[slotIndex] = teamId;
      }

      return next;
    });
  }

  async function startDraftNow() {
    await action(
      () =>
        supabase.rpc("commissioner_start_traditional_draft", {
          p_league_id: leagueId,
        }),
      "Live draft started."
    );

    router.push(`/league/${leagueId}/draft`);
  }

  async function sendTeamInvite(
    team: Team | null,
    slotIndex: number
  ) {
    if (!league || invitingTeamId !== null) return;

    const inviteKey = team?.id ?? -(slotIndex + 1);
    const email = (teamInviteEmails[inviteKey] ?? "").trim().toLowerCase();

    if (!email || !email.includes("@")) {
      setError(`Enter a valid email address for Team ${slotIndex + 1}.`);
      return;
    }

    setInvitingTeamId(inviteKey);
    setError(null);
    setSuccess(null);

    try {
      let fantasyTeamId = team?.id ?? null;
      let teamName = team?.team_name ?? `Team ${slotIndex + 1}`;

      /*
       * A visible vacant slot is only a UI slot until the commissioner
       * actually uses it. Create the real fantasy team only when an invite
       * is sent. This avoids filling the database with fake teams.
       */
      if (!fantasyTeamId) {
        const { data: createdTeamId, error: createError } =
          await supabase.rpc("commissioner_add_open_team_slot", {
            p_league_id: leagueId,
            p_team_name: teamName,
          });

        if (createError) {
          throw new Error(createError.message);
        }

        fantasyTeamId = Number(createdTeamId);

        if (!Number.isFinite(fantasyTeamId) || fantasyTeamId <= 0) {
          throw new Error("The vacant team slot could not be created.");
        }
      }

      const sessionResult = await supabase.auth.getSession();

      if (sessionResult.error) {
        throw new Error(sessionResult.error.message);
      }

      const token = sessionResult.data.session?.access_token;

      if (!token) {
        throw new Error("Your login session is missing. Sign in again and retry.");
      }

      const response = await fetch(`/api/leagues/${league.id}/invite`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          email,
          firstName: teamName,
          lastName: "Owner",
          fantasyTeamId,
        }),
      });

      const responseText = await response.text();
      let result: InviteApiResponse = {};

      if (responseText) {
        try {
          result = JSON.parse(responseText) as InviteApiResponse;
        } catch {
          result = {};
        }
      }

      if (!response.ok || result.success === false) {
        throw new Error(
          result.error ??
            result.message ??
            (responseText && !responseText.trim().startsWith("<")
              ? responseText
              : `Invitation request failed (${response.status}).`)
        );
      }

      setSuccess(`Invitation sent to ${email} for ${teamName}.`);
      setTeamInviteEmails((current) => ({
        ...current,
        [inviteKey]: "",
      }));

      await load({
        showLoading: false,
        clearMessages: false,
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "The invitation could not be sent."
      );
    } finally {
      setInvitingTeamId(null);
    }
  }

  async function addCpuTeam() {
    if (cpuBusy) return;

    const maxTeams = leagueSettings?.max_teams ?? 12;
    const pendingTeamIds = new Set(
      invitations
        .filter((invite) => invite.status === "pending")
        .map((invite) => Number(invite.fantasy_team_id))
        .filter((id) => Number.isFinite(id) && id > 0)
    );

    const filledCount = teams.filter(
      (team) =>
        team.active &&
        (Boolean(team.owner_id) ||
          Boolean(team.is_cpu) ||
          pendingTeamIds.has(team.id))
    ).length;

    if (filledCount >= maxTeams) {
      setError(`This league is already at its ${maxTeams}-team limit.`);
      return;
    }

    setCpuBusy(true);
    setError(null);
    setSuccess(null);

    try {
      const { error: cpuError } = await supabase.rpc(
        "commissioner_add_cpu_to_vacant_slot",
        {
          p_league_id: leagueId,
        }
      );

      if (cpuError) {
        throw new Error(cpuError.message);
      }

      await load({
        showLoading: false,
        clearMessages: false,
      });

      setSuccess("CPU team added.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "The CPU team could not be added."
      );
    } finally {
      setCpuBusy(false);
    }
  }

  async function fillRemainingWithCpu() {
    if (cpuBusy) return;

    const maxTeams = leagueSettings?.max_teams ?? 12;
    const pendingTeamIds = new Set(
      invitations
        .filter((invite) => invite.status === "pending")
        .map((invite) => Number(invite.fantasy_team_id))
        .filter((id) => Number.isFinite(id) && id > 0)
    );

    const filledCount = teams.filter(
      (team) =>
        team.active &&
        (Boolean(team.owner_id) ||
          Boolean(team.is_cpu) ||
          pendingTeamIds.has(team.id))
    ).length;

    const remaining = Math.max(0, maxTeams - filledCount);

    if (remaining <= 0) {
      setError(`This league is already at its ${maxTeams}-team limit.`);
      return;
    }

    if (
      !window.confirm(
        `Fill the remaining ${remaining} team slot${
          remaining === 1 ? "" : "s"
        } with CPU teams?`
      )
    ) {
      return;
    }

    setCpuBusy(true);
    setError(null);
    setSuccess(null);

    try {
      const { data, error: fillError } = await supabase.rpc(
        "commissioner_fill_vacant_slots_with_cpu",
        {
          p_league_id: leagueId,
        }
      );

      if (fillError) {
        throw new Error(fillError.message);
      }

      const added = Number(data ?? remaining);

      await load({
        showLoading: false,
        clearMessages: false,
      });

      setSuccess(
        `${added} CPU team${added === 1 ? "" : "s"} added.`
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "The CPU teams could not be added."
      );
    } finally {
      setCpuBusy(false);
    }
  }

  async function removeCpuTeam(team: Team) {
    if (cpuBusy || !team.is_cpu) return;

    if (
      !window.confirm(
        `Remove ${team.team_name} from this league?`
      )
    ) {
      return;
    }

    setCpuBusy(true);
    setError(null);
    setSuccess(null);

    try {
      const { error: removeError } = await supabase.rpc("remove_cpu_team", {
        p_league_id: leagueId,
        p_team_id: team.id,
      });

      if (removeError) {
        throw new Error(removeError.message);
      }

      await load({
        showLoading: false,
        clearMessages: false,
      });

      setSuccess(`${team.team_name} was removed.`);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "The CPU team could not be removed."
      );
    } finally {
      setCpuBusy(false);
    }
  }

  async function deleteLeague() {
    if (!league || deletingLeague) return;

    if (
      !window.confirm(
        `Permanently delete ${league.name}? This cannot be undone.`
      )
    ) {
      return;
    }

    setDeletingLeague(true);
    setError(null);
    setSuccess(null);

    try {
      const { error: deleteError } = await supabase.rpc(
        "commissioner_delete_league",
        {
          p_league_id: leagueId,
        }
      );

      if (deleteError) {
        throw new Error(deleteError.message);
      }

      router.replace("/my-leagues");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "The league could not be deleted."
      );
      setDeletingLeague(false);
    }
  }

  async function saveBonusRule(rule: ScoringRule) {
    await action(
      () =>
        supabase.rpc("commissioner_upsert_traditional_scoring_rule", {
          p_league_id: leagueId,
          p_rule_id: rule.id > 0 ? rule.id : null,
          p_category: rule.category,
          p_rule_type: rule.rule_type,
          p_stat_key: rule.stat_key,
          p_min_value: rule.min_value,
          p_max_value: rule.max_value,
          p_points: rule.points,
          p_is_enabled: rule.is_enabled,
          p_priority: rule.priority,
          p_label: rule.label,
        }),
      "Bonus rule saved."
    );
  }

  async function deleteBonusRule(ruleId: number) {
    if (ruleId <= 0) {
      setScoringRules((current) => current.filter((rule) => rule.id !== ruleId));
      return;
    }

    await action(
      () =>
        supabase.rpc("commissioner_delete_traditional_scoring_rule", {
          p_league_id: leagueId,
          p_rule_id: ruleId,
        }),
      "Bonus rule deleted."
    );
  }

  function addBonusRule() {
    const group = scoringGroups[scoringCategory];
    const tempId = -Date.now();

    setScoringRules((current) => [
      ...current,
      {
        id: tempId,
        league_id: leagueId,
        category: group.label,
        rule_type: "threshold",
        stat_key: group.bonusStats[0]?.[0] ?? "",
        min_value: 0,
        max_value: null,
        points: 0,
        is_enabled: true,
        stacking_mode: "highest_only",
        priority: current.length + 1,
        label: `${group.label} Bonus`,
      },
    ]);
  }

  if (loading) {
    return <main style={styles.page}><div style={styles.center}>Loading Commissioner…</div></main>;
  }

  if (!authorized) {
    return (
      <main style={styles.page}>
        <div style={styles.denied}>
          <h1>Commissioner Only</h1>
          <p>You do not have commissioner access to this Traditional league.</p>
          <Button onClick={() => router.push(`/league/${leagueId}`)}>BACK TO LEAGUE</Button>
        </div>
      </main>
    );
  }

  const tabs: Array<[Tab, string]> = [
    ["overview", "Overview"],
    ["league", "League & Roster"],
    ["scoring", "Scoring"],
    ["draft", "Draft"],
    ["teams", "Teams & Owners"],
    ["rosters", "Rosters"],
    ["waivers", "Waivers"],
    ["trades", "Trades"],
    ["season", "Season"],
    ["playoffs", "Playoffs"],
  ];

  return (
    <main style={styles.page}>
      <div style={styles.shell}>
        <header style={styles.hero}>
          <div>
            <div style={styles.eyebrow}>TRADITIONAL LEAGUE • COMMISSIONER</div>
            <h1 style={styles.title}>Commissioner</h1>
            <p style={styles.subtitle}>Manage {league?.name ?? "your league"} from one control center.</p>
          </div>
          <div style={styles.row}>
            <Button onClick={() => router.push(`/league/${leagueId}/settings`)}>VIEW SETTINGS</Button>
            <Button onClick={() => void load()} disabled={saving}>REFRESH</Button>
          </div>
        </header>

        {error ? <div style={styles.error}>{error}</div> : null}
        {success ? <div style={styles.success}>{success}</div> : null}

        <div style={styles.tabs}>
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
            <Section title="League Control Center">
              <div style={styles.stats}>
                <Stat label="Season" value={league?.season ?? "—"} />
                <Stat label="Active Week" value={season?.active_week ?? "—"} />
                <Stat label="Phase" value={pretty(season?.phase)} />
                <Stat
                  label="Owners Joined"
                  value={teams.filter((t) => t.active && Boolean(t.owner_id)).length}
                />
                <Stat
                  label="CPU Teams"
                  value={teams.filter((t) => t.active && t.is_cpu).length}
                />
                <Stat
                  label="Open Spots"
                  value={Math.max(
                    0,
                    (leagueSettings?.max_teams ?? 12) -
                      teams.filter(
                        (t) =>
                          t.active &&
                          (Boolean(t.owner_id) || t.is_cpu)
                      ).length
                  )}
                />
                <Stat label="Rostered Players" value={rosters.length} />
                <Stat label="Draft Status" value={pretty(draft?.status)} />
                <Stat label="Pending Waivers" value={claims.filter((c) => c.status === "pending").length} />
                <Stat label="Pending Trades" value={offers.filter((o) => o.status === "pending").length} />
              </div>
            </Section>
            <Section title="Commissioner Workflow">
              <div style={styles.guides}>
                <Guide title="Before Draft" text="Confirm league, roster, scoring, draft, waiver, trade and playoff settings. Assign owners or invite new owners by email." />
                <Guide title="During Draft" text="Use the Live Draft for pause/resume, commissioner picks and Undo Last Pick." />
                <Guide title="Regular Season" text="Use roster tools only when needed. Process waivers, enforce deadlines, rebuild standings and advance weeks after results are ready." />
                <Guide title="Playoffs" text="Confirm field size and reseeding rules before starting the postseason." />
              </div>
            </Section>
          </>
        ) : null}

        {tab === "league" && leagueSettings && rosterSettings ? (
          <>
            <Section
              title="League Structure"
              subtitle="League size, regular-season length and playoff timing stay synchronized automatically."
            >
              <div style={styles.leagueStructureGrid}>
                <label style={styles.field}>
                  <span style={styles.fieldLabel}>Maximum Teams</span>
                  <select
                    value={leagueSettings.max_teams ?? 12}
                    onChange={(e) => changeMaximumTeams(n(e.target.value, 12))}
                    style={styles.input}
                  >
                    {[4, 6, 8, 10, 12].map((count) => (
                      <option key={count} value={count}>
                        {count} Teams
                      </option>
                    ))}
                  </select>
                </label>

                <label style={styles.field}>
                  <span style={styles.fieldLabel}>Regular Season Weeks</span>
                  <select
                    value={leagueSettings.regular_season_weeks ?? 14}
                    onChange={(e) => changeRegularSeasonWeeks(n(e.target.value, 14))}
                    style={styles.input}
                  >
                    {Array.from({ length: 17 }, (_, index) => index + 1).map((week) => (
                      <option key={week} value={week}>
                        {week} Weeks
                      </option>
                    ))}
                  </select>
                </label>

                {playoffs ? (
                  <>
                    <Input
                      label="Playoff Start Week"
                      value={playoffs.playoff_start_week}
                      onChange={(v) => changePlayoffStartWeek(n(v, playoffs.playoff_start_week))}
                    />
                    <Input
                      label="Championship Week"
                      value={playoffs.championship_week}
                      disabled
                      onChange={() => {}}
                    />
                  </>
                ) : null}
              </div>

              <div style={styles.commissionerNotice}>
                <strong>Linked League Calendar</strong>
                <span>
                  Changing Regular Season Weeks moves the playoff start automatically. Changing Playoff Start Week changes the regular-season length. Championship Week is calculated from the playoff field size.
                </span>
              </div>

              <div style={styles.actions}>
                <Button
                  disabled={saving || !playoffs}
                  onClick={() => void saveLeagueStructure()}
                >
                  SAVE LEAGUE STRUCTURE
                </Button>
              </div>
            </Section>

            <Section
              title="Roster & Lineup Requirements"
              subtitle="Starting lineup requirements are separated from maximum roster limits."
            >
              <div style={styles.rosterSubsection}>
                <div style={styles.subsectionTitle}>STARTING LINEUP</div>
                <div style={styles.rosterGrid}>
                  {rosterFields.slice(0, 10).map(([key, label]) => (
                    <Input
                      key={key}
                      label={label}
                      value={String(rosterSettings[key])}
                      onChange={(v) =>
                        setRosterSettings({ ...rosterSettings, [key]: n(v) })
                      }
                    />
                  ))}
                </div>
              </div>

              <div style={styles.rosterDivider} />

              <div style={styles.rosterSubsection}>
                <div style={styles.subsectionTitle}>MAXIMUM POSITION LIMITS</div>
                <p style={styles.sectionSub}>
                  These limits control the maximum number of players a team may carry at each position.
                </p>
                <div style={styles.rosterGrid}>
                  {rosterFields.slice(10).map(([key, label]) => (
                    <Input
                      key={key}
                      label={label}
                      value={String(rosterSettings[key])}
                      onChange={(v) =>
                        setRosterSettings({ ...rosterSettings, [key]: n(v) })
                      }
                    />
                  ))}
                </div>
              </div>

              <div style={styles.actions}>
                <Button
                  disabled={saving}
                  onClick={() =>
                    void action(
                      () =>
                        supabase.rpc("save_traditional_roster_settings", {
                          p_league_id: leagueId,
                          p_starting_qb: rosterSettings.starting_qb,
                          p_starting_rb: rosterSettings.starting_rb,
                          p_starting_wr: rosterSettings.starting_wr,
                          p_starting_te: rosterSettings.starting_te,
                          p_starting_flex: rosterSettings.starting_flex,
                          p_starting_superflex: rosterSettings.starting_superflex,
                          p_starting_k: rosterSettings.starting_k,
                          p_starting_dst: rosterSettings.starting_dst,
                          p_bench_slots: rosterSettings.bench_slots,
                          p_ir_slots: rosterSettings.ir_slots,
                          p_max_qb: rosterSettings.max_qb,
                          p_max_rb: rosterSettings.max_rb,
                          p_max_wr: rosterSettings.max_wr,
                          p_max_te: rosterSettings.max_te,
                          p_max_k: rosterSettings.max_k,
                          p_max_dst: rosterSettings.max_dst,
                        }),
                      "Roster settings saved."
                    )
                  }
                >
                  SAVE ROSTER SETTINGS
                </Button>
              </div>
            </Section>
          </>
        ) : null}

        {tab === "scoring" ? (
          <TraditionalScoring
            leagueId={leagueId}
            embedded
          />
        ) : null}

        {tab === "draft" && draft ? (
          <Section
            title="Draft Administration"
            subtitle="The draft can be started at any time, but only by the commissioner."
          >
            <div style={styles.draftTopGrid}>
              <Input
                label="Draft Rounds"
                value={draft.total_rounds}
                onChange={(v) => setDraft({ ...draft, total_rounds: n(v, 16) })}
              />
              <Input
                label="Human Pick Clock (sec)"
                value={draft.pick_timer_seconds}
                onChange={(v) => setDraft({ ...draft, pick_timer_seconds: n(v, 60) })}
              />
              <Input
                label="CPU Pick Clock (sec)"
                value={draft.cpu_pick_seconds}
                onChange={(v) => setDraft({ ...draft, cpu_pick_seconds: n(v, 5) })}
              />

              <div style={styles.draftOrderModeCard}>
                <span style={styles.fieldLabel}>Draft Order</span>
                <label style={styles.radioLine}>
                  <input
                    type="radio"
                    checked={draftOrderMode === "manual"}
                    onChange={() => setDraftOrderMode("manual")}
                  />
                  Manual Order
                </label>
                <label style={styles.radioLine}>
                  <input
                    type="radio"
                    checked={draftOrderMode === "random"}
                    onChange={() => randomizeDraftOrder()}
                  />
                  Randomized Order
                </label>
              </div>
            </div>

            <div style={styles.draftOrderPanel}>
              <div style={styles.bonusHeader}>
                <div>
                  <div style={styles.subsectionTitle}>
                    {draftOrderMode === "manual" ? "MANUAL DRAFT ORDER" : "RANDOMIZED DRAFT ORDER"}
                  </div>
                  <p style={styles.sectionSub}>
                    Set Round 1. The Live Draft will automatically snake the order in later rounds.
                  </p>
                </div>
                {draftOrderMode === "random" ? (
                  <Button onClick={randomizeDraftOrder}>RANDOMIZE AGAIN</Button>
                ) : null}
              </div>

              <div style={styles.draftOrderGrid}>
                {draftOrder.map((teamId, index) => (
                  <label key={`${index}-${teamId}`} style={styles.draftSlotField}>
                    <span style={styles.draftSlotNumber}>PICK {index + 1}</span>
                    <select
                      value={teamId}
                      disabled={draftOrderMode === "random"}
                      onChange={(e) => moveDraftTeam(index, n(e.target.value))}
                      style={styles.input}
                    >
                      {teams.filter((team) => team.active).map((team) => (
                        <option key={team.id} value={team.id}>{team.team_name}</option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>

              <div style={styles.actions}>
                <Button disabled={saving || Boolean(draft.started_at)} onClick={() => void saveDraftOrder(draftOrder)}>
                  SAVE DRAFT ORDER
                </Button>
              </div>
            </div>

            <div style={styles.status}>
              Status: <strong>{pretty(draft.status)}</strong> • Overall Pick: <strong>{draft.current_overall_pick}</strong> • Paused: <strong>{draft.is_paused ? "Yes" : "No"}</strong>
            </div>

            <div style={styles.commissionerNotice}>
              <strong>Commissioner Control</strong>
              <span>Only the commissioner can start the live draft. There is no scheduled start requirement.</span>
            </div>

            <div style={styles.startDraftPanel}>
              <div>
                <div style={styles.subsectionTitle}>START LIVE DRAFT</div>
                <p style={styles.sectionSub}>
                  When you are ready, start the draft immediately and enter the live draft room.
                </p>
              </div>
              <Button
                disabled={saving || draft.status === "live" || draft.status === "completed"}
                onClick={() => void startDraftNow()}
              >
                ▶ START LIVE DRAFT NOW
              </Button>
            </div>

            <div style={styles.actions}>
              <Button
                disabled={saving || Boolean(draft.started_at)}
                onClick={() =>
                  void action(
                    () =>
                      supabase.rpc("save_traditional_draft_settings", {
                        p_league_id: leagueId,
                        p_total_rounds: draft.total_rounds,
                        p_pick_timer_seconds: draft.pick_timer_seconds,
                        p_cpu_pick_seconds: draft.cpu_pick_seconds,
                        p_scheduled_at: null,
                      }),
                    "Draft settings saved."
                  )
                }
              >
                SAVE DRAFT SETTINGS
              </Button>
              <Button onClick={() => router.push(`/league/${leagueId}/draft`)}>
                OPEN LIVE DRAFT ROOM
              </Button>
            </div>
          </Section>
        ) : null}

        {tab === "teams" ? (
          <>
            {(() => {
              const maxTeams = leagueSettings?.max_teams ?? 12;
              const activeTeams = teams.filter((team) => team.active);
              const pendingInviteByTeamId = new Map(
                invitations
                  .filter(
                    (invite) =>
                      invite.status === "pending" &&
                      invite.fantasy_team_id !== null
                  )
                  .map((invite) => [
                    Number(invite.fantasy_team_id),
                    invite,
                  ] as const)
              );

              const humanOwnerCount = activeTeams.filter(
                (team) => Boolean(team.owner_id)
              ).length;
              const cpuCount = activeTeams.filter(
                (team) => team.is_cpu
              ).length;
              const pendingCount = activeTeams.filter(
                (team) =>
                  !team.owner_id &&
                  !team.is_cpu &&
                  pendingInviteByTeamId.has(team.id)
              ).length;
              const reservedCount = humanOwnerCount + cpuCount + pendingCount;
              const vacantCount = Math.max(0, maxTeams - reservedCount);

              return (
                <>
                  <Section
                    title="Teams & Owners"
                    subtitle="Invite human owners to vacant spots, manage pending invitations, or fill open Traditional league spots with CPU teams."
                  >
                    <div style={styles.teamToolbar}>
                      <div>
                        <strong>
                          {humanOwnerCount} / {maxTeams} OWNERS JOINED
                        </strong>
                        <div style={styles.smallMuted}>
                          {cpuCount} CPU • {pendingCount} pending invitation{pendingCount === 1 ? "" : "s"} • {vacantCount} open spot{vacantCount === 1 ? "" : "s"}.
                        </div>
                      </div>

                      <div style={styles.teamActions}>
                        <Button
                          disabled={cpuBusy || vacantCount === 0}
                          onClick={() => void addCpuTeam()}
                        >
                          {cpuBusy ? "WORKING…" : "+ ADD CPU TEAM"}
                        </Button>

                        <Button
                          disabled={cpuBusy || vacantCount === 0}
                          onClick={() => void fillRemainingWithCpu()}
                        >
                          FILL REMAINING WITH CPU
                        </Button>
                      </div>
                    </div>

                    <div style={styles.list}>
                      {Array.from({
                        length: maxTeams,
                      }).map((_, index) => {
                        const team = activeTeams[index] ?? null;
                        const inviteKey = team?.id ?? -(index + 1);
                        const isCpu = Boolean(team?.is_cpu);
                        const pendingInvite =
                          team ? pendingInviteByTeamId.get(team.id) ?? null : null;
                        const hasOwner = Boolean(team?.owner_id);
                        const isVacant =
                          !team || (!hasOwner && !isCpu && !pendingInvite);

                        return (
                          <div
                            key={team?.id ?? `vacant-${index}`}
                            style={styles.teamRowExpanded}
                          >
                            <strong style={styles.teamIndex}>{index + 1}</strong>

                            {team ? (
                              <label style={styles.field}>
                                <span style={styles.fieldLabel}>Team Name</span>
                                <input
                                  value={team.team_name}
                                  disabled={isCpu}
                                  onChange={(e) =>
                                    setTeams((current) =>
                                      current.map((row) =>
                                        row.id === team.id
                                          ? {
                                              ...row,
                                              team_name: e.target.value,
                                            }
                                          : row
                                      )
                                    )
                                  }
                                  style={styles.input}
                                />
                              </label>
                            ) : (
                              <div style={styles.vacantField}>
                                <span style={styles.fieldLabel}>Team Name</span>
                                <strong>Vacant Team {index + 1}</strong>
                              </div>
                            )}

                            {team && !isCpu ? (
                              <label style={styles.field}>
                                <span style={styles.fieldLabel}>Owner</span>
                                <select
                                  value={team.owner_id ?? ""}
                                  onChange={(e) => {
                                    const nextOwnerId = e.target.value;
                                    setTeams((current) =>
                                      current.map((row) =>
                                        row.id === team.id
                                          ? {
                                              ...row,
                                              owner_id: nextOwnerId || null,
                                            }
                                          : row
                                      )
                                    );
                                  }}
                                  style={styles.input}
                                >
                                  <option value="">NO OWNER</option>
                                  {members.map((member) => (
                                    <option
                                      key={member.id}
                                      value={member.user_id}
                                    >
                                      {profileByUserId.get(member.user_id)?.display_name?.trim() ||
                                        profileByUserId.get(member.user_id)?.email?.trim() ||
                                        shortId(member.user_id)}
                                      {profileByUserId.get(member.user_id)?.email?.trim()
                                        ? ` • ${profileByUserId.get(member.user_id)?.email}`
                                        : ""}
                                      {` • ${pretty(member.role)}`}
                                    </option>
                                  ))}
                                </select>
                              </label>
                            ) : (
                              <div style={styles.vacantField}>
                                <span style={styles.fieldLabel}>Owner</span>
                                <strong>{isCpu ? "CPU" : "VACANT"}</strong>
                              </div>
                            )}

                            {!isCpu && !hasOwner && !pendingInvite ? (
                              <label style={styles.field}>
                                <span style={styles.fieldLabel}>Email Invite</span>
                                <input
                                  type="email"
                                  placeholder="owner@example.com"
                                  value={teamInviteEmails[inviteKey] ?? ""}
                                  onChange={(e) =>
                                    setTeamInviteEmails((current) => ({
                                      ...current,
                                      [inviteKey]: e.target.value,
                                    }))
                                  }
                                  style={styles.input}
                                />
                              </label>
                            ) : (
                              <div style={styles.vacantField}>
                                <span style={styles.fieldLabel}>Email / Status</span>
                                <strong>
                                  {isCpu
                                    ? "CPU TEAM"
                                    : hasOwner
                                      ? profileByUserId.get(team!.owner_id!)?.email?.trim() ||
                                        "OWNER ASSIGNED"
                                      : pendingInvite
                                        ? `${pendingInvite.email} • PENDING`
                                        : "VACANT"}
                                </strong>
                              </div>
                            )}

                            <div style={styles.ownerStatus}>
                              {isCpu ? (
                                <>
                                  <strong>CPU TEAM</strong>
                                  <span>Managed automatically by Gridiron365.</span>
                                </>
                              ) : hasOwner ? (
                                <>
                                  <strong>OWNER ASSIGNED</strong>
                                  <span>
                                    {profileByUserId.get(team!.owner_id!)?.display_name?.trim() ||
                                      profileByUserId.get(team!.owner_id!)?.email?.trim() ||
                                      shortId(team!.owner_id!)}
                                    {profileByUserId.get(team!.owner_id!)?.email?.trim() &&
                                    profileByUserId.get(team!.owner_id!)?.display_name?.trim()
                                      ? ` • ${profileByUserId.get(team!.owner_id!)?.email}`
                                      : ""}
                                  </span>
                                </>
                              ) : pendingInvite ? (
                                <>
                                  <strong>INVITE PENDING</strong>
                                  <span>{pendingInvite.email}</span>
                                </>
                              ) : isVacant ? (
                                <>
                                  <strong>VACANT</strong>
                                  <span>
                                    Send an invitation or replace this spot with a CPU team.
                                  </span>
                                </>
                              ) : null}
                            </div>

                            <div style={styles.teamActions}>
                              {!isCpu && !hasOwner && !pendingInvite ? (
                                <Button
                                  disabled={
                                    invitingTeamId !== null ||
                                    !(teamInviteEmails[inviteKey] ?? "").trim()
                                  }
                                  onClick={() =>
                                    void sendTeamInvite(team, index)
                                  }
                                >
                                  {invitingTeamId === inviteKey
                                    ? "SENDING…"
                                    : "✉ INVITE"}
                                </Button>
                              ) : null}

                              {team && !isCpu ? (
                                <Button
                                  disabled={saving}
                                  onClick={() =>
                                    void action(
                                      () =>
                                        supabase.rpc(
                                          "commissioner_update_traditional_team",
                                          {
                                            p_league_id: leagueId,
                                            p_fantasy_team_id: team.id,
                                            p_team_name: team.team_name,
                                            p_owner_id: team.owner_id,
                                            p_active: true,
                                          }
                                        ),
                                      `${team.team_name} updated.`
                                    )
                                  }
                                >
                                  SAVE
                                </Button>
                              ) : null}

                              {team && isCpu ? (
                                <Button
                                  danger
                                  disabled={cpuBusy}
                                  onClick={() => void removeCpuTeam(team)}
                                >
                                  REMOVE CPU
                                </Button>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </Section>

                  <Section
                    title="Danger Zone"
                    subtitle="Only the primary commissioner can permanently delete the league."
                  >
                    <div style={styles.dangerZone}>
                      <div>
                        <strong>DELETE LEAGUE</strong>
                        <p style={styles.smallMuted}>
                          This permanently deletes the league and all league-owned data.
                          This action cannot be undone.
                        </p>
                      </div>

                      <Button
                        danger
                        disabled={deletingLeague || !league}
                        onClick={() => void deleteLeague()}
                      >
                        {deletingLeague
                          ? "DELETING…"
                          : "PERMANENTLY DELETE LEAGUE"}
                      </Button>
                    </div>
                  </Section>
                </>
              );
            })()}
          </>
        ) : null}

        {tab === "rosters" ? (
          <Section title="Commissioner Roster Editor">
            <div style={styles.grid}>
              <label style={styles.field}>
                <span style={styles.fieldLabel}>Fantasy Team</span>
                <select
                  value={rosterTeamId ?? ""}
                  onChange={(e) => setRosterTeamId(n(e.target.value))}
                  style={styles.input}
                >
                  {teams.filter((t) => t.active).map((t) => <option key={t.id} value={t.id}>{t.team_name}</option>)}
                </select>
              </label>
              <Input label="Find Available Player" type="text" value={search} onChange={setSearch} />
            </div>

            {choices.length ? (
              <div style={styles.searchBox}>
                {choices.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setAddPlayerId(p.id)}
                    style={{
                      ...styles.choice,
                      ...(addPlayerId === p.id ? styles.choiceActive : {}),
                    }}
                  >
                    <strong>{p.full_name}</strong>
                    <span>{p.primary_position} • {p.team_abbreviation ?? "FA"}</span>
                  </button>
                ))}
              </div>
            ) : null}

            <div style={styles.actions}>
              <Button
                disabled={saving || !rosterTeamId || !addPlayerId}
                onClick={() => {
                  if (!rosterTeamId || !addPlayerId) return;
                  void action(
                    () =>
                      supabase.rpc("commissioner_add_traditional_roster_player", {
                        p_league_id: leagueId,
                        p_fantasy_team_id: rosterTeamId,
                        p_player_id: addPlayerId,
                      }),
                    "Player added to roster."
                  ).then(() => {
                    setAddPlayerId(null);
                    setSearch("");
                  });
                }}
              >
                ADD SELECTED PLAYER
              </Button>
            </div>

            <div style={styles.list}>
              {rosterRows.map((row) => {
                const p = playerMap.get(row.player_id);
                return (
                  <div key={row.id} style={styles.rosterRow}>
                    <div>
                      <strong>{p?.full_name ?? `Player ${row.player_id}`}</strong>
                      <div style={styles.muted}>{p?.primary_position ?? "—"} • {p?.team_abbreviation ?? "FA"} • {pretty(row.acquired_via)}</div>
                    </div>
                    <select
                      defaultValue=""
                      onChange={(e) => {
                        const to = n(e.target.value);
                        if (!rosterTeamId || !to) return;
                        void action(
                          () =>
                            supabase.rpc("commissioner_move_traditional_roster_player", {
                              p_league_id: leagueId,
                              p_from_fantasy_team_id: rosterTeamId,
                              p_to_fantasy_team_id: to,
                              p_player_id: row.player_id,
                            }),
                          "Player moved."
                        );
                      }}
                      style={styles.input}
                    >
                      <option value="">MOVE TO…</option>
                      {teams.filter((t) => t.id !== rosterTeamId).map((t) => (
                        <option key={t.id} value={t.id}>{t.team_name}</option>
                      ))}
                    </select>
                    <Button
                      danger
                      disabled={saving || !rosterTeamId}
                      onClick={() => {
                        if (!rosterTeamId) return;
                        void action(
                          () =>
                            supabase.rpc("commissioner_drop_traditional_roster_player", {
                              p_league_id: leagueId,
                              p_fantasy_team_id: rosterTeamId,
                              p_player_id: row.player_id,
                            }),
                          "Player dropped."
                        );
                      }}
                    >
                      DROP
                    </Button>
                  </div>
                );
              })}
              {!rosterRows.length ? <div style={styles.empty}>No rostered players.</div> : null}
            </div>
          </Section>
        ) : null}

        {tab === "waivers" && waivers ? (
          <>
            <Section title="Waiver Settings">
              <div style={styles.grid}>
                <label style={styles.field}>
                  <span style={styles.fieldLabel}>Waiver Type</span>
                  <select value={waivers.waiver_type} onChange={(e) => setWaivers({ ...waivers, waiver_type: e.target.value })} style={styles.input}>
                    <option value="rolling">Rolling</option>
                    <option value="faab">FAAB</option>
                  </select>
                </label>
                <Input label="Waiver Period Hours" value={waivers.waiver_period_hours} onChange={(v) => setWaivers({ ...waivers, waiver_period_hours: n(v, 24) })} />
                <Input label="FAAB Budget" value={waivers.faab_budget} onChange={(v) => setWaivers({ ...waivers, faab_budget: n(v, 100) })} />
                <Toggle label="Continuous Waivers" value={waivers.continuous_waivers} onChange={(v) => setWaivers({ ...waivers, continuous_waivers: v })} />
                <Toggle label="Allow Free Agent Adds" value={waivers.allow_free_agent_adds} onChange={(v) => setWaivers({ ...waivers, allow_free_agent_adds: v })} />
              </div>
              <div style={styles.actions}>
                <Button
                  disabled={saving}
                  onClick={() =>
                    void action(
                      () =>
                        supabase.rpc("save_traditional_waiver_settings", {
                          p_league_id: leagueId,
                          p_waiver_type: waivers.waiver_type,
                          p_continuous_waivers: waivers.continuous_waivers,
                          p_waiver_period_hours: waivers.waiver_period_hours,
                          p_faab_budget: waivers.faab_budget,
                          p_allow_free_agent_adds: waivers.allow_free_agent_adds,
                        }),
                      "Waiver settings saved."
                    )
                  }
                >
                  SAVE WAIVER SETTINGS
                </Button>
                <Button
                  disabled={saving}
                  onClick={() =>
                    void action(
                      () =>
                        supabase.rpc("process_due_traditional_waivers", {
                          p_league_id: leagueId,
                          p_now: new Date().toISOString(),
                        }),
                      "Due waivers processed."
                    )
                  }
                >
                  PROCESS DUE WAIVERS
                </Button>
              </div>
            </Section>
            <Section title="Recent Waiver Claims">
              <Transactions
                rows={claims.map((c) => ({
                  id: c.id,
                  a: teamMap.get(c.fantasy_team_id)?.team_name ?? `Team ${c.fantasy_team_id}`,
                  b: playerMap.get(c.player_id)?.full_name ?? `Player ${c.player_id}`,
                  c: `${pretty(c.status)} • Week ${c.week}${c.faab_bid !== null ? ` • $${c.faab_bid}` : ""}`,
                }))}
              />
            </Section>
          </>
        ) : null}

        {tab === "trades" && trades && league ? (
          <>
            <Section
              title="Trade Settings"
              subtitle={`The trade deadline can only be set during the regular season (Weeks 1-${leagueSettings?.regular_season_weeks ?? 14}).`}
            >
              <div style={styles.grid}>
                <label style={styles.field}>
                  <span style={styles.fieldLabel}>Trade Deadline Week</span>
                  <select
                    key={`trade-deadline-${leagueSettings?.regular_season_weeks ?? 14}`}
                    value={
                      trades.trade_deadline_week !== null &&
                      trades.trade_deadline_week <= (leagueSettings?.regular_season_weeks ?? 14)
                        ? trades.trade_deadline_week
                        : ""
                    }
                    onChange={(e) => {
                      const regularSeasonWeeks = leagueSettings?.regular_season_weeks ?? 14;
                      const selected =
                        e.target.value === ""
                          ? null
                          : Math.min(n(e.target.value), regularSeasonWeeks);

                      setTrades({
                        ...trades,
                        trade_deadline_week: selected,
                      });
                    }}
                    style={styles.input}
                  >
                    <option value="">No Trade Deadline</option>
                    {Array.from(
                      { length: leagueSettings?.regular_season_weeks ?? 14 },
                      (_, index) => index + 1
                    ).map((week) => (
                      <option key={week} value={week}>
                        Week {week}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div style={styles.actions}>
                <Button
                  disabled={saving}
                  onClick={() => {
                    const regularSeasonWeeks = leagueSettings?.regular_season_weeks ?? 14;

                    if (
                      trades.trade_deadline_week !== null &&
                      trades.trade_deadline_week > regularSeasonWeeks
                    ) {
                      setError(
                        `Trade deadline must be Week ${regularSeasonWeeks} or earlier because the regular season ends in Week ${regularSeasonWeeks}.`
                      );
                      return;
                    }

                    void action(
                      () =>
                        supabase.rpc("save_traditional_trade_settings", {
                          p_league_id: leagueId,
                          p_season: league.season,
                          p_trade_deadline_week: trades.trade_deadline_week,
                        }),
                      trades.trade_deadline_week === null
                        ? "Trade deadline removed."
                        : `Trade deadline saved for Week ${trades.trade_deadline_week}.`
                    );
                  }}
                >
                  SAVE TRADE SETTINGS
                </Button>
                <Button
                  disabled={saving}
                  onClick={() =>
                    void action(
                      () =>
                        supabase.rpc("expire_traditional_trades_after_deadline", {
                          p_league_id: leagueId,
                          p_season: league.season,
                        }),
                      "Trade deadline enforcement completed."
                    )
                  }
                >
                  ENFORCE DEADLINE
                </Button>
              </div>
            </Section>
            <Section title="Recent Trade Offers">
              <Transactions
                rows={offers.map((o) => ({
                  id: o.id,
                  a: `${teamMap.get(o.proposing_fantasy_team_id)?.team_name ?? "Unknown"} → ${teamMap.get(o.receiving_fantasy_team_id)?.team_name ?? "Unknown"}`,
                  b: o.message ?? "No message",
                  c: `${pretty(o.status)} • Week ${o.week}`,
                }))}
              />
            </Section>
          </>
        ) : null}

        {tab === "season" && league ? (
          <Section title="Season Administration">
            <div style={styles.stats}>
              <Stat label="Active Week" value={season?.active_week ?? "—"} />
              <Stat label="Phase" value={pretty(season?.phase)} />
              <Stat label="Last Completed" value={season?.last_completed_week ?? "—"} />
              <Stat label="Regular Season Complete" value={season?.regular_season_complete ? "Yes" : "No"} />
              <Stat label="Playoffs Started" value={season?.playoffs_started ? "Yes" : "No"} />
              <Stat label="Season Complete" value={season?.season_complete ? "Yes" : "No"} />
            </div>
            <div style={styles.actions}>
              <Button
                disabled={saving}
                onClick={() =>
                  void action(
                    () => supabase.rpc("generate_traditional_regular_season_schedule", { p_league_id: leagueId }),
                    "Schedule generated."
                  )
                }
              >
                GENERATE SCHEDULE
              </Button>
              <Button
                disabled={saving}
                onClick={() =>
                  void action(
                    () =>
                      supabase.rpc("rebuild_traditional_standings", {
                        p_league_id: leagueId,
                        p_season: league.season,
                      }),
                    "Standings rebuilt."
                  )
                }
              >
                REBUILD STANDINGS
              </Button>
              <Button
                disabled={saving}
                onClick={() =>
                  void action(
                    () => supabase.rpc("auto_advance_traditional_week", { p_league_id: leagueId }),
                    "Week advancement check completed."
                  )
                }
              >
                AUTO-ADVANCE WEEK
              </Button>
            </div>
            <div style={styles.warning}>Season actions affect the league. Use them only after the week's results are ready.</div>
          </Section>
        ) : null}

        {tab === "playoffs" && playoffs && league ? (
          <Section title="Playoff Administration">
            <div style={styles.grid}>
              <label style={styles.field}>
                <span style={styles.fieldLabel}>Playoff Teams</span>
                <select
                  value={playoffs.playoff_teams}
                  onChange={(e) => changePlayoffTeams(n(e.target.value, 6))}
                  style={styles.input}
                >
                  {[2, 4, 5, 6, 7, 8]
                    .filter((count) => count <= (leagueSettings?.max_teams ?? 12))
                    .map((count) => (
                      <option key={count} value={count}>
                        {count} Teams
                      </option>
                    ))}
                </select>
              </label>
              <Input
                label="Playoff Start Week"
                value={playoffs.playoff_start_week}
                onChange={(v) => changePlayoffStartWeek(n(v, playoffs.playoff_start_week))}
              />
              <Input label="Championship Week" value={playoffs.championship_week} disabled onChange={() => {}} />
              <Toggle label="Reseed Each Round" value={playoffs.reseed_each_round} onChange={(v) => setPlayoffs({ ...playoffs, reseed_each_round: v })} />
            </div>
            <div style={styles.actions}>
              <Button
                disabled={saving || !leagueSettings}
                onClick={() => void saveLeagueStructure()}
              >
                SAVE PLAYOFF STRUCTURE
              </Button>
              <Button
                disabled={saving}
                onClick={() =>
                  void action(
                    () =>
                      supabase.rpc("set_traditional_playoff_reseeding", {
                        p_league_id: leagueId,
                        p_season: league.season,
                        p_reseed_each_round: playoffs.reseed_each_round,
                      }),
                    "Reseeding saved."
                  )
                }
              >
                SAVE RESEEDING
              </Button>
              <Button
                disabled={saving}
                onClick={() =>
                  void action(
                    () =>
                      supabase.rpc("start_traditional_playoffs", {
                        p_league_id: leagueId,
                        p_season: league.season,
                      }),
                    "Playoff start action completed."
                  )
                }
              >
                START PLAYOFFS
              </Button>
            </div>
          </Section>
        ) : null}
      </div>
    </main>
  );
}

function Toggle(props: { label: string; value: boolean; onChange: (v: boolean) => void }) {
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
      <span>{props.label}</span>
      <strong>{props.value}</strong>
    </div>
  );
}

function Guide(props: { title: string; text: string }) {
  return (
    <div style={styles.guide}>
      <strong>{props.title}</strong>
      <p>{props.text}</p>
    </div>
  );
}

function Transactions(props: { rows: Array<{ id: number; a: string; b: string; c: string }> }) {
  if (!props.rows.length) return <div style={styles.empty}>No records to show.</div>;
  return (
    <div style={styles.list}>
      {props.rows.map((r) => (
        <div key={r.id} style={styles.tx}>
          <strong>{r.a}</strong>
          <span>{r.b}</span>
          <em>{r.c}</em>
        </div>
      ))}
    </div>
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
  sectionSub: { margin: "5px 0 0", color: "#8f96a2", fontSize: "12px" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: "10px" },
  field: { display: "flex", flexDirection: "column", gap: "6px" },
  fieldLabel: { color: "#9ba1ab", fontSize: "11px", fontWeight: 850 },
  input: { width: "100%", minHeight: "38px", boxSizing: "border-box", border: "1px solid rgba(255,255,255,.11)", borderRadius: "7px", padding: "8px 10px", background: "#0b0d12", color: "#f5f7fa", fontSize: "13px" },
  button: { minHeight: "38px", border: "1px solid rgba(255,102,45,.36)", borderRadius: "7px", padding: "8px 12px", background: "linear-gradient(135deg,#b51b18,#ef531d)", color: "#fff", fontSize: "12px", fontWeight: 950, cursor: "pointer" },
  danger: { background: "rgba(150,20,20,.22)", border: "1px solid rgba(255,80,80,.34)", color: "#ff9c9c" },
  disabled: { opacity: .45, cursor: "not-allowed" },
  actions: { display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "14px" },
  stats: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: "9px" },
  stat: { minHeight: "78px", padding: "11px", border: "1px solid rgba(255,255,255,.07)", borderRadius: "9px", background: "rgba(255,255,255,.025)", display: "flex", flexDirection: "column", justifyContent: "space-between", gap: "8px" },
  guides: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: "10px" },
  guide: { padding: "13px", border: "1px solid rgba(255,255,255,.07)", borderRadius: "9px", background: "rgba(255,255,255,.02)", fontSize: "12px", lineHeight: 1.5 },
  teamRow: { display: "grid", gridTemplateColumns: "40px minmax(180px,1.3fr) minmax(220px,1.4fr) 110px 85px", gap: "8px", alignItems: "center", padding: "9px", border: "1px solid rgba(255,255,255,.07)", borderRadius: "9px" },
  rosterRow: { display: "grid", gridTemplateColumns: "minmax(220px,1fr) minmax(180px,260px) 80px", gap: "8px", alignItems: "center", padding: "9px", border: "1px solid rgba(255,255,255,.07)", borderRadius: "8px" },
  list: { display: "grid", gap: "7px", marginTop: "12px" },
  check: { display: "flex", gap: "7px", alignItems: "center", fontSize: "11px", fontWeight: 850, color: "#b8bdc6" },
  searchBox: { maxHeight: "250px", overflowY: "auto", marginTop: "9px", border: "1px solid rgba(255,255,255,.07)", borderRadius: "9px", background: "#090b0f" },
  choice: { width: "100%", display: "flex", justifyContent: "space-between", gap: "12px", padding: "9px 11px", border: "none", borderBottom: "1px solid rgba(255,255,255,.05)", background: "transparent", color: "#d8dce2", fontSize: "12px", textAlign: "left", cursor: "pointer" },
  choiceActive: { background: "rgba(255,85,25,.12)", color: "#fff" },
  toggle: { minHeight: "38px", border: "1px solid rgba(255,255,255,.12)", borderRadius: "7px", background: "#0b0d12", color: "#8e949e", fontSize: "11px", fontWeight: 900, cursor: "pointer" },
  toggleOn: { border: "1px solid rgba(75,220,130,.3)", background: "rgba(40,160,90,.14)", color: "#75e6a4" },
  tx: { display: "grid", gridTemplateColumns: "minmax(170px,.8fr) minmax(200px,1.6fr) minmax(140px,.7fr)", gap: "10px", padding: "9px 10px", border: "1px solid rgba(255,255,255,.06)", borderRadius: "8px", color: "#bcc1ca", fontSize: "11px" },
  muted: { marginTop: "3px", color: "#8d939d", fontSize: "11px" },
  status: { marginTop: "12px", padding: "10px", borderRadius: "8px", background: "rgba(255,255,255,.025)", color: "#aeb3bc", fontSize: "12px" },
  error: { marginBottom: "12px", padding: "11px 13px", borderRadius: "8px", border: "1px solid rgba(255,70,70,.32)", background: "rgba(150,20,20,.18)", color: "#ff9c9c", fontSize: "13px", fontWeight: 750 },
  success: { marginBottom: "12px", padding: "11px 13px", borderRadius: "8px", border: "1px solid rgba(70,220,130,.28)", background: "rgba(30,140,80,.14)", color: "#79e6a6", fontSize: "13px", fontWeight: 750 },
  empty: { padding: "18px", border: "1px dashed rgba(255,255,255,.10)", borderRadius: "9px", color: "#8f96a0", textAlign: "center", fontSize: "12px" },
  warning: { marginTop: "12px", padding: "10px 12px", borderRadius: "8px", border: "1px solid rgba(255,175,60,.20)", background: "rgba(130,80,10,.10)", color: "#e3bd81", fontSize: "11px" },
  center: { padding: "80px 20px", textAlign: "center", color: "#c5c9d1", fontSize: "16px" },
  denied: { maxWidth: "620px", margin: "100px auto", padding: "28px", textAlign: "center", border: "1px solid rgba(255,80,60,.25)", borderRadius: "14px", background: "rgba(20,20,24,.94)" },
  leagueStructureGrid: { display: "grid", gridTemplateColumns: "repeat(2,minmax(260px,1fr))", gap: "22px" },
  rosterSubsection: { padding: "6px 0 14px" },
  rosterDivider: { height: "1px", background: "rgba(255,255,255,.08)", margin: "18px 0 22px" },
  subsectionTitle: { color: "#ff6a2a", fontSize: "12px", fontWeight: 950, letterSpacing: ".09em", marginBottom: "10px" },
  rosterGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(175px,1fr))", gap: "14px 18px" },
  scoringCategoryTabs: { display: "flex", gap: "7px", flexWrap: "wrap", marginBottom: "16px" },
  scoringCategoryTab: { border: "1px solid rgba(255,255,255,.09)", borderRadius: "7px", padding: "9px 12px", background: "#0b0d12", color: "#a9aeb8", fontSize: "12px", fontWeight: 900, cursor: "pointer" },
  scoringCategoryTabActive: { color: "#fff", border: "1px solid rgba(255,85,35,.5)", background: "linear-gradient(135deg,rgba(180,24,18,.38),rgba(255,90,25,.16))" },
  scoringCategoryPanel: { padding: "16px", marginBottom: "14px", border: "1px solid rgba(255,255,255,.07)", borderRadius: "10px", background: "rgba(255,255,255,.018)" },
  scoringBaseGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: "10px" },
  scoringAdvanced: { display: "grid", gridTemplateColumns: "repeat(2,minmax(180px,260px))", gap: "10px", marginTop: "14px" },
  bonusHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", flexWrap: "wrap" },
  bonusRuleList: { display: "grid", gap: "9px", marginTop: "12px" },
  bonusRuleRow: { display: "grid", gridTemplateColumns: "minmax(180px,1.2fr) minmax(180px,1.1fr) 110px 130px 110px 90px auto", gap: "8px", alignItems: "end", padding: "11px", border: "1px solid rgba(255,255,255,.07)", borderRadius: "9px", background: "#0b0d12" },
  bonusActions: { display: "flex", gap: "6px" },
  draftTopGrid: { display: "grid", gridTemplateColumns: "repeat(4,minmax(190px,1fr))", gap: "12px" },
  draftOrderModeCard: { display: "flex", flexDirection: "column", gap: "9px", padding: "11px", border: "1px solid rgba(255,255,255,.08)", borderRadius: "9px", background: "#0b0d12" },
  radioLine: { display: "flex", gap: "8px", alignItems: "center", color: "#d4d8de", fontSize: "12px", fontWeight: 800 },
  draftOrderPanel: { marginTop: "16px", padding: "15px", border: "1px solid rgba(255,255,255,.08)", borderRadius: "10px", background: "rgba(255,255,255,.018)" },
  draftOrderGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: "9px", marginTop: "12px" },
  draftSlotField: { display: "flex", flexDirection: "column", gap: "5px" },
  draftSlotNumber: { color: "#ff7035", fontSize: "10px", fontWeight: 950, letterSpacing: ".06em" },
  commissionerNotice: { display: "flex", flexDirection: "column", gap: "4px", marginTop: "14px", padding: "12px", border: "1px solid rgba(255,95,35,.35)", borderRadius: "9px", background: "rgba(165,45,15,.08)", color: "#d9c3b8", fontSize: "12px" },
  startDraftPanel: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px", marginTop: "14px", padding: "15px", border: "1px solid rgba(255,255,255,.08)", borderRadius: "10px", background: "rgba(255,255,255,.018)" },
  inviteGrid: { display: "grid", gridTemplateColumns: "repeat(3,minmax(180px,1fr)) auto", gap: "10px", alignItems: "end" },
  inviteButtonWrap: { display: "flex", alignItems: "end" },
  teamRowExpanded: { display: "grid", gridTemplateColumns: "36px minmax(180px,1.2fr) minmax(220px,1.2fr) minmax(180px,.8fr) 100px auto", gap: "9px", alignItems: "center", padding: "10px", border: "1px solid rgba(255,255,255,.07)", borderRadius: "9px", background: "rgba(255,255,255,.018)" },
  teamIndex: { color: "#ff6c31", textAlign: "center" },
  ownerStatus: { display: "flex", flexDirection: "column", gap: "3px", color: "#9299a4", fontSize: "10px" },
  teamActions: { display: "flex", gap: "6px", justifyContent: "flex-end" },
  teamToolbar: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap", marginBottom: "12px", padding: "12px", border: "1px solid rgba(255,95,40,.18)", borderRadius: "10px", background: "rgba(255,80,25,.045)" },
  vacantField: { display: "flex", flexDirection: "column", gap: "6px", minHeight: "40px", justifyContent: "center", color: "#d8dce3" },
  smallMuted: { margin: "5px 0 0", color: "#8f96a2", fontSize: "11px", lineHeight: 1.5 },
  dangerZone: { display: "grid", gap: "12px", padding: "14px", border: "1px solid rgba(255,75,75,.34)", borderRadius: "10px", background: "rgba(130,10,10,.12)" },
};