"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useParams } from "next/navigation";

type LeagueRow = {
  id: string;
  name: string;
  league_type: string;
  season: number;
  status: string;
  player_selection_mode: string;
};

type LeagueSettingsRow = {
  season: number;
  max_teams: number | null;
  regular_season_weeks: number | null;
};

type RosterSettingsRow = {
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

type DraftRow = {
  status: string;
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  total_rounds: number;
  pick_timer_seconds: number;
  cpu_pick_seconds: number;
  is_paused: boolean;
};

type WaiverSettingsRow = {
  waiver_type: string;
  continuous_waivers: boolean;
  waiver_period_hours: number;
  faab_budget: number;
  allow_free_agent_adds: boolean;
};

type TradeSettingsRow = {
  trade_deadline_week: number | null;
};

type PlayoffSettingsRow = {
  season: number;
  playoff_teams: number;
  playoff_start_week: number;
  championship_week: number;
  reseed_each_round: boolean;
};

type ScoringSettingsRow = Record<string, number | string | boolean | null> & {
  fractional_scoring_enabled: boolean;
  decimal_places: number;
};

type ScoringRuleRow = {
  id: number;
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

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function pretty(value: string | null | undefined) {
  if (!value) return "—";
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function numberText(value: number | string | null | undefined) {
  if (value === null || value === undefined) return "—";
  const parsed = Number(value);
  return Number.isFinite(parsed)
    ? parsed.toLocaleString(undefined, { maximumFractionDigits: 3 })
    : String(value);
}

function yesNo(value: boolean | null | undefined) {
  return value ? "Yes" : "No";
}

function dateText(value: string | null | undefined) {
  if (!value) return "Not set";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function Card({ label, value, note }: { label: string; value: React.ReactNode; note?: string }) {
  return (
    <div style={styles.card}>
      <div style={styles.cardLabel}>{label}</div>
      <div style={styles.cardValue}>{value}</div>
      {note ? <div style={styles.cardNote}>{note}</div> : null}
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section style={styles.section}>
      <div style={styles.sectionHeader}>
        <h2 style={styles.sectionTitle}>{title}</h2>
        {subtitle ? <p style={styles.sectionSubtitle}>{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}

const scoringGroups: Array<{ title: string; rows: Array<[string, string]> }> = [
  {
    title: "Passing",
    rows: [
      ["Yards per point", "passing_yards_per_point"],
      ["Passing TD", "passing_td_points"],
      ["Interception", "passing_interception_points"],
      ["2-point conversion", "passing_two_point_points"],
      ["Completion", "passing_completion_points"],
      ["Incompletion", "passing_incompletion_points"],
      ["Passing first down", "passing_first_down_points"],
    ],
  },
  {
    title: "Rushing",
    rows: [
      ["Yards per point", "rushing_yards_per_point"],
      ["Rushing TD", "rushing_td_points"],
      ["2-point conversion", "rushing_two_point_points"],
      ["Rushing attempt", "rushing_attempt_points"],
      ["Rushing first down", "rushing_first_down_points"],
    ],
  },
  {
    title: "Receiving",
    rows: [
      ["Yards per point", "receiving_yards_per_point"],
      ["Receiving TD", "receiving_td_points"],
      ["2-point conversion", "receiving_two_point_points"],
      ["Reception", "reception_points"],
      ["Target", "receiving_target_points"],
      ["Receiving first down", "receiving_first_down_points"],
    ],
  },
  {
    title: "Fumbles & Returns",
    rows: [
      ["Fumble", "fumble_points"],
      ["Fumble lost", "fumble_lost_points"],
      ["Offensive fumble recovery TD", "offensive_fumble_recovery_td_points"],
      ["Kick return yards per point", "kick_return_yards_per_point"],
      ["Punt return yards per point", "punt_return_yards_per_point"],
      ["Kick return TD", "kick_return_td_points"],
      ["Punt return TD", "punt_return_td_points"],
    ],
  },
  {
    title: "Kicking",
    rows: [
      ["Extra point made", "extra_point_made_points"],
      ["Extra point missed", "extra_point_missed_points"],
      ["Field goal missed", "field_goal_missed_points"],
    ],
  },
  {
    title: "Defense / Special Teams",
    rows: [
      ["Sack", "dst_sack_points"],
      ["Interception", "dst_interception_points"],
      ["Fumble recovery", "dst_fumble_recovery_points"],
      ["Touchdown", "dst_touchdown_points"],
      ["Safety", "dst_safety_points"],
      ["Blocked kick", "dst_blocked_kick_points"],
      ["Return touchdown", "dst_return_touchdown_points"],
      ["Extra-point return", "dst_extra_point_return_points"],
    ],
  },
];

export default function TraditionalSettingsPage() {
  const params = useParams<{ leagueId: string }>();
  const leagueId = params.leagueId;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [league, setLeague] = useState<LeagueRow | null>(null);
  const [leagueSettings, setLeagueSettings] = useState<LeagueSettingsRow | null>(null);
  const [roster, setRoster] = useState<RosterSettingsRow | null>(null);
  const [draft, setDraft] = useState<DraftRow | null>(null);
  const [waivers, setWaivers] = useState<WaiverSettingsRow | null>(null);
  const [trades, setTrades] = useState<TradeSettingsRow | null>(null);
  const [playoffs, setPlayoffs] = useState<PlayoffSettingsRow | null>(null);
  const [scoring, setScoring] = useState<ScoringSettingsRow | null>(null);
  const [rules, setRules] = useState<ScoringRuleRow[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [
      leagueResult,
      leagueSettingsResult,
      rosterResult,
      draftResult,
      waiverResult,
      tradeResult,
      playoffResult,
      scoringResult,
      rulesResult,
    ] = await Promise.all([
      supabase.from("leagues").select("id,name,league_type,season,status,player_selection_mode").eq("id", leagueId).maybeSingle(),
      supabase.from("league_settings").select("season,max_teams,regular_season_weeks").eq("league_id", leagueId).maybeSingle(),
      supabase.from("traditional_roster_settings").select("*").eq("league_id", leagueId).maybeSingle(),
      supabase.from("league_drafts").select("status,scheduled_at,started_at,completed_at,total_rounds,pick_timer_seconds,cpu_pick_seconds,is_paused").eq("league_id", leagueId).order("season", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("traditional_waiver_settings").select("*").eq("league_id", leagueId).maybeSingle(),
      supabase.from("traditional_trade_settings").select("*").eq("league_id", leagueId).maybeSingle(),
      supabase.from("traditional_playoff_settings").select("*").eq("league_id", leagueId).maybeSingle(),
      supabase.from("league_scoring_settings").select("*").eq("league_id", leagueId).maybeSingle(),
      supabase.from("league_scoring_rules").select("id,category,rule_type,stat_key,min_value,max_value,points,is_enabled,stacking_mode,priority,label").eq("league_id", leagueId).order("category").order("priority"),
    ]);

    const results = [leagueResult, leagueSettingsResult, rosterResult, draftResult, waiverResult, tradeResult, playoffResult, scoringResult, rulesResult];
    const failed = results.find((result) => result.error);
    if (failed?.error) {
      setError(failed.error.message);
      setLoading(false);
      return;
    }

    setLeague(leagueResult.data as LeagueRow | null);
    setLeagueSettings(leagueSettingsResult.data as LeagueSettingsRow | null);
    setRoster(rosterResult.data as RosterSettingsRow | null);
    setDraft(draftResult.data as DraftRow | null);
    setWaivers(waiverResult.data as WaiverSettingsRow | null);
    setTrades(tradeResult.data as TradeSettingsRow | null);
    setPlayoffs(playoffResult.data as PlayoffSettingsRow | null);
    setScoring(scoringResult.data as ScoringSettingsRow | null);
    setRules((rulesResult.data ?? []) as ScoringRuleRow[]);
    setLoading(false);
  }, [leagueId]);

  useEffect(() => {
    void load();
  }, [load]);

  const enabledRules = useMemo(() => rules.filter((rule) => rule.is_enabled), [rules]);

  if (loading) {
    return <main style={styles.page}><div style={styles.loading}>Loading league settings…</div></main>;
  }

  return (
    <main style={styles.page}>
      <div style={styles.shell}>
        <header style={styles.hero}>
          <div>
            <div style={styles.eyebrow}>TRADITIONAL LEAGUE</div>
            <h1 style={styles.title}>League Settings</h1>
            <p style={styles.subtitle}>Review the complete rules and configuration for {league?.name ?? "this league"}.</p>
          </div>
          <button type="button" onClick={() => void load()} style={styles.refreshButton}>REFRESH</button>
        </header>

        {error ? <div style={styles.error}>{error}</div> : null}

        <Section title="League Overview" subtitle="Core league and regular-season settings.">
          <div style={styles.grid}>
            <Card label="League Name" value={league?.name ?? "—"} />
            <Card label="League Type" value={pretty(league?.league_type)} />
            <Card label="Season" value={league?.season ?? "—"} />
            <Card label="League Status" value={pretty(league?.status)} />
            <Card label="Maximum Teams" value={leagueSettings?.max_teams ?? "—"} />
            <Card label="Regular Season" value={leagueSettings?.regular_season_weeks ? `${leagueSettings.regular_season_weeks} weeks` : "—"} />
            <Card label="Player Selection" value={pretty(league?.player_selection_mode)} />
          </div>
        </Section>

        <Section title="Roster & Lineup" subtitle="Starting lineup, bench, IR and positional limits.">
          {roster ? (
            <>
              <div style={styles.subheading}>STARTING LINEUP</div>
              <div style={styles.grid}>
                <Card label="QB" value={roster.starting_qb} />
                <Card label="RB" value={roster.starting_rb} />
                <Card label="WR" value={roster.starting_wr} />
                <Card label="TE" value={roster.starting_te} />
                <Card label="FLEX" value={roster.starting_flex} />
                <Card label="SUPERFLEX" value={roster.starting_superflex} />
                <Card label="K" value={roster.starting_k} />
                <Card label="DST" value={roster.starting_dst} />
                <Card label="Bench" value={roster.bench_slots} />
                <Card label="IR" value={roster.ir_slots} />
              </div>
              <div style={{ ...styles.subheading, marginTop: 18 }}>POSITION LIMITS</div>
              <div style={styles.grid}>
                <Card label="Max QB" value={roster.max_qb} />
                <Card label="Max RB" value={roster.max_rb} />
                <Card label="Max WR" value={roster.max_wr} />
                <Card label="Max TE" value={roster.max_te} />
                <Card label="Max K" value={roster.max_k} />
                <Card label="Max DST" value={roster.max_dst} />
              </div>
            </>
          ) : <div style={styles.empty}>Roster settings have not been configured.</div>}
        </Section>

        <Section title="Draft" subtitle="Live-draft configuration and current status.">
          {draft ? (
            <div style={styles.grid}>
              <Card label="Status" value={pretty(draft.status)} />
              <Card label="Rounds" value={draft.total_rounds} />
              <Card label="Human Pick Clock" value={`${draft.pick_timer_seconds} sec`} />
              <Card label="CPU Pick Clock" value={`${draft.cpu_pick_seconds} sec`} />
              <Card label="Scheduled" value={dateText(draft.scheduled_at)} />
              <Card label="Started" value={draft.started_at ? dateText(draft.started_at) : "Not started"} />
              <Card label="Completed" value={draft.completed_at ? dateText(draft.completed_at) : "Not completed"} />
              <Card label="Paused" value={yesNo(draft.is_paused)} />
            </div>
          ) : <div style={styles.empty}>No draft has been created.</div>}
        </Section>

        <Section title="Waivers & Free Agency" subtitle="How available players are acquired.">
          {waivers ? (
            <div style={styles.grid}>
              <Card label="Waiver Type" value={pretty(waivers.waiver_type)} />
              <Card label="Waiver Period" value={`${waivers.waiver_period_hours} hours`} />
              <Card label="Continuous Waivers" value={yesNo(waivers.continuous_waivers)} />
              <Card label="FAAB Budget" value={waivers.faab_budget} />
              <Card label="Free Agent Adds" value={waivers.allow_free_agent_adds ? "Allowed" : "Disabled"} />
            </div>
          ) : <div style={styles.empty}>Waiver settings have not been configured.</div>}
        </Section>

        <Section title="Trades" subtitle="Traditional league trade deadline.">
          {trades ? (
            <div style={styles.grid}>
              <Card label="Trade Deadline" value={trades.trade_deadline_week === null ? "No deadline" : `Week ${trades.trade_deadline_week}`} />
            </div>
          ) : <div style={styles.empty}>Trade settings have not been configured.</div>}
        </Section>

        <Section title="Playoffs" subtitle="Postseason field and schedule.">
          {playoffs ? (
            <div style={styles.grid}>
              <Card label="Playoff Teams" value={playoffs.playoff_teams} />
              <Card label="Playoffs Start" value={`Week ${playoffs.playoff_start_week}`} />
              <Card label="Championship" value={`Week ${playoffs.championship_week}`} />
              <Card label="Reseed Each Round" value={yesNo(playoffs.reseed_each_round)} />
            </div>
          ) : <div style={styles.empty}>Playoff settings have not been configured.</div>}
        </Section>

        <Section title="Scoring" subtitle="Base scoring plus enabled custom and threshold rules.">
          {scoring ? (
            <>
              <div style={styles.scoringGrid}>
                {scoringGroups.map((group) => (
                  <div key={group.title} style={styles.scoringGroup}>
                    <div style={styles.scoringGroupTitle}>{group.title}</div>
                    {group.rows.map(([label, key]) => (
                      <div key={key} style={styles.scoringRow}>
                        <span>{label}</span>
                        <strong>{numberText(scoring[key] as number | string | null)}</strong>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
              <div style={{ ...styles.grid, marginTop: 12 }}>
                <Card label="Fractional Scoring" value={yesNo(scoring.fractional_scoring_enabled)} />
                <Card label="Decimal Places" value={scoring.decimal_places} />
              </div>
            </>
          ) : <div style={styles.empty}>Scoring settings have not been configured.</div>}

          <div style={{ ...styles.subheading, marginTop: 22 }}>CUSTOM / THRESHOLD RULES</div>
          {enabledRules.length ? (
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Rule</th>
                    <th style={styles.th}>Category</th>
                    <th style={styles.th}>Range</th>
                    <th style={styles.th}>Points</th>
                    <th style={styles.th}>Stacking</th>
                  </tr>
                </thead>
                <tbody>
                  {enabledRules.map((rule) => (
                    <tr key={rule.id}>
                      <td style={styles.td}>{rule.label ?? pretty(rule.stat_key)}</td>
                      <td style={styles.td}>{pretty(rule.category)}</td>
                      <td style={styles.td}>{rule.min_value === null && rule.max_value === null ? "—" : `${rule.min_value ?? "—"} to ${rule.max_value ?? "∞"}`}</td>
                      <td style={styles.tdStrong}>{numberText(rule.points)}</td>
                      <td style={styles.td}>{pretty(rule.stacking_mode)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <div style={styles.empty}>No enabled custom scoring rules.</div>}
        </Section>

        <div style={styles.footer}>League members can review settings here. Editing will be handled from the Traditional Commissioner page.</div>
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: "linear-gradient(180deg,#07090d 0%,#0b0d12 55%,#07080b 100%)", color: "#f5f7fa", padding: 24 },
  shell: { width: "100%", maxWidth: 1500, margin: "0 auto" },
  hero: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 20, padding: 24, marginBottom: 18, borderRadius: 16, border: "1px solid rgba(255,92,40,.26)", background: "linear-gradient(135deg,rgba(140,12,12,.20),rgba(255,90,20,.08) 48%,rgba(255,255,255,.02))", boxShadow: "0 16px 45px rgba(0,0,0,.28)" },
  eyebrow: { color: "#ff6a2a", fontSize: 12, fontWeight: 900, letterSpacing: ".15em", marginBottom: 6 },
  title: { margin: 0, fontSize: 34, lineHeight: 1.05, fontWeight: 950, letterSpacing: "-.03em" },
  subtitle: { margin: "8px 0 0", color: "#a8adb7", fontSize: 15, lineHeight: 1.5 },
  refreshButton: { border: "1px solid rgba(255,100,45,.40)", borderRadius: 8, background: "linear-gradient(135deg,#b81717,#ef4d1d)", color: "#fff", padding: "10px 16px", fontSize: 13, fontWeight: 900, cursor: "pointer" },
  loading: { padding: 80, textAlign: "center", color: "#c9cdd4", fontSize: 16 },
  error: { marginBottom: 18, border: "1px solid rgba(255,80,80,.35)", borderRadius: 10, background: "rgba(150,20,20,.18)", color: "#ff9c9c", padding: "13px 15px", fontSize: 14, fontWeight: 700 },
  section: { marginBottom: 18, padding: 20, borderRadius: 14, border: "1px solid rgba(255,255,255,.08)", background: "rgba(15,18,24,.88)", boxShadow: "0 12px 32px rgba(0,0,0,.22)" },
  sectionHeader: { paddingBottom: 14, marginBottom: 16, borderBottom: "1px solid rgba(255,255,255,.07)" },
  sectionTitle: { margin: 0, fontSize: 21, fontWeight: 950, letterSpacing: "-.02em" },
  sectionSubtitle: { margin: "5px 0 0", color: "#8e949f", fontSize: 13, lineHeight: 1.45 },
  subheading: { color: "#ff7840", fontSize: 12, fontWeight: 900, letterSpacing: ".10em", marginBottom: 10 },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 10 },
  card: { minHeight: 86, padding: 12, borderRadius: 10, border: "1px solid rgba(255,255,255,.07)", background: "rgba(255,255,255,.025)" },
  cardLabel: { color: "#9197a2", fontSize: 12, fontWeight: 800, marginBottom: 6 },
  cardValue: { color: "#f5f7fa", fontSize: 17, fontWeight: 900, lineHeight: 1.25 },
  cardNote: { color: "#777e89", fontSize: 11, lineHeight: 1.35, marginTop: 5 },
  empty: { padding: 18, borderRadius: 10, border: "1px dashed rgba(255,255,255,.10)", color: "#8e949f", fontSize: 13, textAlign: "center" },
  scoringGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 12 },
  scoringGroup: { borderRadius: 10, overflow: "hidden", border: "1px solid rgba(255,255,255,.07)", background: "rgba(255,255,255,.022)" },
  scoringGroupTitle: { padding: "11px 12px", background: "rgba(255,88,35,.08)", borderBottom: "1px solid rgba(255,255,255,.06)", color: "#ff7a40", fontSize: 13, fontWeight: 900 },
  scoringRow: { minHeight: 38, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "8px 12px", borderBottom: "1px solid rgba(255,255,255,.045)", color: "#adb2bb", fontSize: 12 },
  tableWrap: { overflowX: "auto", borderRadius: 10, border: "1px solid rgba(255,255,255,.07)" },
  table: { width: "100%", minWidth: 720, borderCollapse: "collapse" },
  th: { padding: "10px 12px", textAlign: "left", background: "rgba(255,255,255,.035)", borderBottom: "1px solid rgba(255,255,255,.08)", color: "#9096a1", fontSize: 11, fontWeight: 900, letterSpacing: ".06em" },
  td: { padding: "10px 12px", borderBottom: "1px solid rgba(255,255,255,.045)", color: "#c5c9d0", fontSize: 12 },
  tdStrong: { padding: "10px 12px", borderBottom: "1px solid rgba(255,255,255,.045)", color: "#fff", fontSize: 12, fontWeight: 900 },
  footer: { padding: "8px 12px 24px", textAlign: "center", color: "#777e89", fontSize: 12, lineHeight: 1.5 },
};