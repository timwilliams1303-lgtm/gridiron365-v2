import Link from "next/link";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireLeagueMember } from "@/lib/leagues/requireLeagueMember";

type SettingsRow = {
  season: number;
  weekly_salary_cap: number | string | null;
  starting_qb: number;
  starting_rb: number;
  starting_wr: number;
  starting_te: number;
  starting_flex: number;
  starting_superflex: number;
  starting_k: number;
  starting_dst: number;
};

function money(value: number | string | null | undefined) {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function pretty(value: string | null | undefined) {
  if (!value) return "—";
  return value.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export type SeasonLongSettingsProps = {
  leagueId: string;
};

export default async function SeasonLongSettings({ leagueId }: SeasonLongSettingsProps) {
  const access = await requireLeagueMember(leagueId);

  if (access.league.leagueType !== "season_long") {
    throw new Error("This page is only available for Season-Long leagues.");
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("season_long_settings")
    .select(`
      season,
      weekly_salary_cap,
      starting_qb,
      starting_rb,
      starting_wr,
      starting_te,
      starting_flex,
      starting_superflex,
      starting_k,
      starting_dst
    `)
    .eq("league_id", leagueId)
    .eq("season", access.league.season)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not load Season-Long settings: ${error.message}`);
  }

  const settings = data as SettingsRow | null;
  const isSalary = access.league.playerSelectionMode === "salary";
  const starterCount = settings
    ? settings.starting_qb + settings.starting_rb + settings.starting_wr +
      settings.starting_te + settings.starting_flex + settings.starting_superflex +
      settings.starting_k + settings.starting_dst
    : 0;

  const lineup = [
    ["QB", settings?.starting_qb ?? 0],
    ["RB", settings?.starting_rb ?? 0],
    ["WR", settings?.starting_wr ?? 0],
    ["TE", settings?.starting_te ?? 0],
    ["FLEX", settings?.starting_flex ?? 0],
    ["SUPERFLEX", settings?.starting_superflex ?? 0],
    ["K", settings?.starting_k ?? 0],
    ["DST", settings?.starting_dst ?? 0],
  ] as const;

  return (
    <main style={styles.page}>
      <section style={styles.shell}>
        <header style={styles.hero}>
          <div>
            <p style={styles.eyebrow}>G365 SEASON-LONG SETTINGS</p>
            <h1 style={styles.title}>{access.league.name}</h1>
            <p style={styles.subtitle}>
              {access.league.season} · {isSalary ? "Salary Cap" : "No Salary Cap"}
            </p>
          </div>

          <div style={styles.actions}>
            <Link href={`/league/${leagueId}`} style={styles.secondaryButton}>
              LEAGUE HOME
            </Link>
            {access.isCommissioner ? (
              <Link href={`/league/${leagueId}/commissioner`} style={styles.primaryButton}>
                MANAGE SETTINGS
              </Link>
            ) : null}
          </div>
        </header>

        <section style={styles.summaryGrid}>
          <Summary label="FORMAT" value={isSalary ? "Salary" : "No Salary"} />
          <Summary label="SEASON" value={String(access.league.season)} />
          <Summary label="STARTERS" value={String(starterCount)} />
          <Summary label="STATUS" value={pretty(access.league.status)} />
          {isSalary ? (
            <Summary label="WEEKLY CAP" value={money(settings?.weekly_salary_cap)} accent />
          ) : (
            <Summary label="WEEKLY CAP" value="Not Used" />
          )}
        </section>

        <section style={styles.card}>
          <div style={styles.cardHead}>
            <div>
              <p style={styles.sectionEyebrow}>WEEKLY ENTRY</p>
              <h2 style={styles.sectionTitle}>Starting Lineup Requirements</h2>
            </div>
            <span style={styles.countBadge}>{starterCount} STARTERS</span>
          </div>

          <div style={styles.positionGrid}>
            {lineup.map(([position, count]) => (
              <div key={position} style={styles.positionCard}>
                <span style={styles.position}>{position}</span>
                <strong style={styles.positionCount}>{count}</strong>
                <span style={styles.positionLabel}>{count === 1 ? "starter" : "starters"}</span>
              </div>
            ))}
          </div>
        </section>

        <section style={styles.twoColumn}>
          <div style={styles.card}>
            <p style={styles.sectionEyebrow}>COMPETITION</p>
            <h2 style={styles.sectionTitle}>Season-Long Rules</h2>
            <Rule title="Fresh Weekly Lineup" text="Each NFL regular-season week uses its own submitted lineup." />
            <Rule title="Total-Points Standings" text="Only finalized weekly scores are added to season standings." />
            <Rule title="Kickoff Privacy" text="Other teams’ selected players remain hidden until that player’s NFL game kicks off." />
            <Rule title="Individual Player Locks" text="Each selected player locks when the player’s NFL game reaches kickoff." />
          </div>

          <div style={styles.card}>
            <p style={styles.sectionEyebrow}>PLAYER SELECTION</p>
            <h2 style={styles.sectionTitle}>{isSalary ? "Salary Cap Rules" : "No-Salary Rules"}</h2>
            {isSalary ? (
              <>
                <Rule title="Weekly Salary Cap" text={`Every submitted lineup must remain at or below ${money(settings?.weekly_salary_cap)}.`} />
                <Rule title="Weekly Player Prices" text="Player salaries are generated for the upcoming slate and then frozen on the configured weekly salary schedule." />
                <Rule title="Unused Salary" text="Teams are not required to spend the entire cap." />
              </>
            ) : (
              <>
                <Rule title="No Player Salaries" text="Player selection is not constrained by a salary cap." />
                <Rule title="Same Weekly Lineup Rules" text="Roster-slot requirements, player locking and fantasy scoring still apply normally." />
              </>
            )}
          </div>
        </section>

        <section style={styles.card}>
          <div style={styles.cardHead}>
            <div>
              <p style={styles.sectionEyebrow}>SCORING</p>
              <h2 style={styles.sectionTitle}>League Scoring</h2>
              <p style={styles.muted}>Only players in the submitted weekly lineup contribute to the weekly score.</p>
            </div>
            {access.isCommissioner ? (
              <Link href={`/league/${leagueId}/commissioner`} style={styles.secondaryButton}>
                EDIT SCORING
              </Link>
            ) : null}
          </div>
        </section>
      </section>
    </main>
  );
}

function Summary({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div style={{ ...styles.summary, ...(accent ? styles.summaryAccent : {}) }}>
      <span style={styles.summaryLabel}>{label}</span>
      <strong style={styles.summaryValue}>{value}</strong>
    </div>
  );
}

function Rule({ title, text }: { title: string; text: string }) {
  return (
    <div style={styles.rule}>
      <span style={styles.ruleDot} />
      <div>
        <strong style={styles.ruleTitle}>{title}</strong>
        <p style={styles.ruleText}>{text}</p>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: "#090909", color: "#fff", padding: "28px 18px 56px" },
  shell: { width: "min(1180px, 100%)", margin: "0 auto" },
  hero: { display: "flex", justifyContent: "space-between", gap: 20, alignItems: "flex-end", flexWrap: "wrap", padding: "26px", border: "1px solid #2d2d2d", borderRadius: 22, background: "linear-gradient(135deg,#181818 0%,#101010 58%,#21100a 100%)", boxShadow: "0 20px 60px rgba(0,0,0,.35)" },
  eyebrow: { margin: 0, color: "#ff6a1a", fontSize: 12, fontWeight: 900, letterSpacing: 2 },
  title: { margin: "8px 0 4px", fontSize: "clamp(30px,5vw,52px)", lineHeight: 1, fontWeight: 950 },
  subtitle: { margin: 0, color: "#aaa", fontWeight: 700 },
  actions: { display: "flex", gap: 10, flexWrap: "wrap" },
  primaryButton: { display: "inline-flex", alignItems: "center", justifyContent: "center", minHeight: 42, padding: "0 16px", borderRadius: 10, color: "#fff", textDecoration: "none", fontSize: 12, fontWeight: 900, letterSpacing: .7, background: "linear-gradient(90deg,#b91919,#ff6a1a)" },
  secondaryButton: { display: "inline-flex", alignItems: "center", justifyContent: "center", minHeight: 42, padding: "0 16px", borderRadius: 10, color: "#fff", textDecoration: "none", fontSize: 12, fontWeight: 900, letterSpacing: .7, background: "#202020", border: "1px solid #3b3b3b" },
  summaryGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12, margin: "16px 0" },
  summary: { border: "1px solid #292929", borderRadius: 15, background: "#121212", padding: 16 },
  summaryAccent: { borderColor: "#7b3117", background: "linear-gradient(180deg,#1b130f,#121212)" },
  summaryLabel: { display: "block", color: "#888", fontSize: 10, fontWeight: 900, letterSpacing: 1.4 },
  summaryValue: { display: "block", marginTop: 6, fontSize: 22 },
  card: { border: "1px solid #292929", borderRadius: 18, background: "#121212", padding: 22, marginTop: 16 },
  cardHead: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" },
  sectionEyebrow: { margin: 0, color: "#e84b20", fontSize: 10, fontWeight: 950, letterSpacing: 1.7 },
  sectionTitle: { margin: "5px 0 14px", fontSize: 22 },
  muted: { color: "#999", margin: "-6px 0 0", lineHeight: 1.55 },
  countBadge: { borderRadius: 999, padding: "7px 10px", color: "#ffb08a", background: "#30160d", border: "1px solid #69301a", fontWeight: 900, fontSize: 11 },
  positionGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 10 },
  positionCard: { padding: 14, borderRadius: 13, border: "1px solid #303030", background: "#0d0d0d", textAlign: "center" },
  position: { display: "block", fontSize: 11, color: "#ff6a1a", fontWeight: 950 },
  positionCount: { display: "block", fontSize: 30, marginTop: 4 },
  positionLabel: { color: "#777", fontSize: 11 },
  twoColumn: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 16 },
  rule: { display: "flex", gap: 12, padding: "13px 0", borderTop: "1px solid #242424" },
  ruleDot: { width: 8, height: 8, marginTop: 6, borderRadius: 999, background: "#ff5a1f", flex: "0 0 auto" },
  ruleTitle: { fontSize: 14 },
  ruleText: { margin: "4px 0 0", color: "#999", lineHeight: 1.5, fontSize: 13 },
};
