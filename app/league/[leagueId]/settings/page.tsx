import Link from "next/link";

import TraditionalSettings from "@/components/traditional/TraditionalSettings";
import RealtimeSettingsRefresh from "@/components/league/RealtimeSettingsRefresh";

import {
  createSupabaseAdminClient,
} from "@/lib/supabase/admin";

import {
  requireLeagueMember,
} from "@/lib/leagues/requireLeagueMember";

type PageProps = {
  params: Promise<{
    leagueId: string;
  }>;
};

type AnyRow = Record<string, unknown>;

const HIDDEN_KEYS = new Set([
  "id",
  "league_id",
  "created_at",
  "updated_at",
]);

const SEASON_LONG_REALTIME_TABLES = [
  "leagues",
  "season_long_settings",
  "league_scoring_settings",
  "league_scoring_rules",
];

function humanize(key: string) {
  return key
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .replace(/\bDst\b/g, "DST")
    .replace(/\bFaab\b/g, "FAAB")
    .replace(/\bIr\b/g, "IR")
    .replace(/\bQb\b/g, "QB")
    .replace(/\bRb\b/g, "RB")
    .replace(/\bWr\b/g, "WR")
    .replace(/\bTe\b/g, "TE")
    .replace(/\bFg\b/g, "FG")
    .replace(/\bXp\b/g, "XP")
    .replace(/\bTd\b/g, "TD");
}

function show(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (Array.isArray(value)) {
    return value.length ? value.map((item) => show(item)).join(", ") : "—";
  }

  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  return String(value).replaceAll("_", " ");
}

function money(value: unknown) {
  const amount = Number(value ?? 0);

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function settingEntries(row: AnyRow | null | undefined) {
  return Object.entries(row ?? {})
    .filter(([key]) => !HIDDEN_KEYS.has(key))
    .sort(([a], [b]) => a.localeCompare(b));
}

function Item({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div style={styles.item}>
      <span style={styles.itemLabel}>{label}</span>
      <strong
        style={{
          ...styles.itemValue,
          ...(accent ? styles.accent : {}),
        }}
      >
        {value}
      </strong>
    </div>
  );
}

function SettingsSection({
  eyebrow,
  title,
  description,
  row,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  row: AnyRow | null | undefined;
}) {
  const entries = settingEntries(row);

  return (
    <section style={styles.card}>
      <div style={styles.cardHead}>
        <div>
          <p style={styles.sectionEyebrow}>{eyebrow}</p>
          <h2 style={styles.sectionTitle}>{title}</h2>
          {description ? <p style={styles.muted}>{description}</p> : null}
        </div>
      </div>

      {entries.length ? (
        <div className="settings-grid" style={styles.grid}>
          {entries.map(([key, value]) => (
            <Item key={key} label={humanize(key)} value={show(value)} />
          ))}
        </div>
      ) : (
        <div style={styles.empty}>No settings have been saved in this section yet.</div>
      )}
    </section>
  );
}

function RulesSection({
  rules,
}: {
  rules: AnyRow[];
}) {
  return (
    <section style={styles.card}>
      <div style={styles.cardHead}>
        <div>
          <p style={styles.sectionEyebrow}>BONUS SCORING</p>
          <h2 style={styles.sectionTitle}>Custom / Bonus Rules</h2>
          <p style={styles.muted}>
            Every saved league scoring rule is shown here. This list updates automatically with commissioner changes.
          </p>
        </div>

        <span style={styles.countBadge}>{rules.length} RULES</span>
      </div>

      <div style={styles.rulesList}>
        {rules.length ? (
          rules.map((rule, index) => (
            <div key={String(rule.id ?? index)} style={styles.ruleCard}>
              <strong style={styles.ruleTitle}>
                {show(rule.label) !== "—"
                  ? show(rule.label)
                  : `Scoring Rule ${index + 1}`}
              </strong>

              <div className="settings-grid" style={styles.grid}>
                {settingEntries(rule).map(([key, value]) => (
                  <Item key={key} label={humanize(key)} value={show(value)} />
                ))}
              </div>
            </div>
          ))
        ) : (
          <div style={styles.empty}>No custom or bonus scoring rules are currently configured.</div>
        )}
      </div>
    </section>
  );
}

export default async function SeasonLongSettingsPage({
  params,
}: PageProps) {
  const { leagueId } = await params;

  const access = await requireLeagueMember(leagueId);

  if (access.league.leagueType === "traditional") {
    return (
      <TraditionalSettings
        leagueId={leagueId}
        leagueName={access.league.name}
        season={access.league.season}
        isCommissioner={access.isCommissioner}
      />
    );
  }

  if (access.league.leagueType !== "season_long") {
    throw new Error(
      "League settings are not available for this league type."
    );
  }

  const supabase = createSupabaseAdminClient();

  const [
    leagueResult,
    settingsResult,
    scoringResult,
    rulesResult,
  ] = await Promise.all([
    supabase
      .from("leagues")
      .select("*")
      .eq("id", leagueId)
      .maybeSingle(),

    supabase
      .from("season_long_settings")
      .select("*")
      .eq("league_id", leagueId)
      .maybeSingle(),

    supabase
      .from("league_scoring_settings")
      .select("*")
      .eq("league_id", leagueId)
      .maybeSingle(),

    supabase
      .from("league_scoring_rules")
      .select("*")
      .eq("league_id", leagueId)
      .order("category", { ascending: true })
      .order("priority", { ascending: true }),
  ]);

  const failures = [
    leagueResult,
    settingsResult,
    scoringResult,
    rulesResult,
  ].filter((result) => result.error);

  if (failures.length) {
    throw new Error(
      `Could not load complete Season-Long settings: ${failures[0]?.error?.message ?? "Unknown settings error."}`
    );
  }

  const league = (leagueResult.data ?? {}) as AnyRow;
  const settings = (settingsResult.data ?? {}) as AnyRow;
  const scoring = (scoringResult.data ?? {}) as AnyRow;
  const rules = (rulesResult.data ?? []) as AnyRow[];

  const isSalary =
    access.league.playerSelectionMode === "salary";

  const isH2H =
    settings["competition_format"] === "head_to_head";

  const starterKeys = [
    "starting_qb",
    "starting_rb",
    "starting_wr",
    "starting_te",
    "starting_flex",
    "starting_superflex",
    "starting_k",
    "starting_dst",
  ];

  const starterCount = starterKeys.reduce(
    (total, key) => total + Number(settings[key] ?? 0),
    0
  );

  return (
    <main className="g365-sl-settings" style={styles.page}>
      <RealtimeSettingsRefresh
        leagueId={leagueId}
        tables={SEASON_LONG_REALTIME_TABLES}
      />

      <style>{`
        .g365-sl-settings,
        .g365-sl-settings * {
          box-sizing: border-box;
        }

        @media(max-width:760px){
          .g365-sl-settings {
            padding:12px 10px!important;
          }

          .g365-sl-settings .settings-grid {
            grid-template-columns:1fr!important;
          }
        }
      `}</style>

      <section style={styles.shell}>
        <header style={styles.hero}>
          <div>
            <p style={styles.eyebrow}>
              G365 SEASON-LONG • LEAGUE SETTINGS
            </p>

            <h1 style={styles.title}>{access.league.name}</h1>

            <p style={styles.subtitle}>
              {access.league.season}
              {" • "}
              {isSalary ? "Salary" : "No Salary"}
              {" • "}
              {isH2H ? "Head-to-Head" : "Total Points"}
              {" • "}
              Live read-only settings
            </p>
          </div>

          <div style={styles.actions}>
            <span style={styles.liveBadge}>● LIVE SETTINGS</span>
            <span style={styles.readOnly}>READ ONLY</span>

            {access.isCommissioner ? (
              <Link
                href={`/league/${leagueId}/commissioner`}
                style={styles.primaryButton}
              >
                MANAGE SETTINGS
              </Link>
            ) : null}
          </div>
        </header>

        <div className="settings-grid" style={styles.summaryGrid}>
          <Item
            label="Competition"
            value={isH2H ? "Head-to-Head" : "Total Points"}
            accent
          />

          <Item
            label="Player Mode"
            value={isSalary ? "Salary" : "No Salary"}
          />

          <Item
            label="Starters"
            value={String(starterCount)}
          />

          <Item
            label="Weekly Cap"
            value={
              isSalary
                ? money(settings["weekly_salary_cap"])
                : "Not Used"
            }
          />

          <Item
            label="Playoffs"
            value={
              isH2H
                ? settings["playoffs_enabled"]
                  ? "Enabled"
                  : "Disabled"
                : "Not Used"
            }
          />
        </div>

        <SettingsSection
          eyebrow="LEAGUE"
          title="League"
          description="Core league identity, status, season and league-level configuration."
          row={league}
        />

        <SettingsSection
          eyebrow="SEASON-LONG"
          title="Competition, Lineup & League Settings"
          description="Every current Season-Long configuration field, including competition format, lineup slots, salary controls and playoff settings."
          row={settings}
        />

        <SettingsSection
          eyebrow="SCORING"
          title="Fantasy Scoring"
          description="Every current base scoring field, including passing, rushing, receiving, kicking, DST, fumbles, returns and future scoring fields added to the league."
          row={scoring}
        />

        <RulesSection rules={rules} />

        <div style={styles.footerActions}>
          <Link href={`/league/${leagueId}`} style={styles.secondaryButton}>
            LEAGUE HOME
          </Link>
        </div>
      </section>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    padding: "22px",
    background: "linear-gradient(180deg,#07080c,#0b0d12 50%,#07080b)",
    color: "#f5f7fa",
  },
  shell: {
    maxWidth: "1160px",
    margin: "0 auto",
    display: "grid",
    gap: "14px",
  },
  hero: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "16px",
    flexWrap: "wrap",
  },
  eyebrow: {
    margin: "0 0 4px",
    color: "#ff7b25",
    fontWeight: 950,
    fontSize: "11px",
    letterSpacing: ".08em",
  },
  title: {
    margin: 0,
    fontSize: "clamp(28px,4vw,42px)",
  },
  subtitle: {
    color: "#9ca2ab",
    margin: "5px 0 0",
  },
  actions: {
    display: "flex",
    gap: "8px",
    alignItems: "center",
    flexWrap: "wrap",
  },
  liveBadge: {
    border: "1px solid rgba(55,180,90,.35)",
    background: "rgba(55,180,90,.10)",
    color: "#77e497",
    borderRadius: "999px",
    padding: "8px 10px",
    fontSize: "10px",
    fontWeight: 950,
    letterSpacing: ".04em",
  },
  readOnly: {
    border: "1px solid #343a44",
    background: "#11151b",
    color: "#9aa0a9",
    borderRadius: "999px",
    padding: "8px 10px",
    fontSize: "10px",
    fontWeight: 950,
    letterSpacing: ".07em",
  },
  primaryButton: {
    borderRadius: "9px",
    padding: "9px 12px",
    color: "#fff",
    background: "linear-gradient(135deg,#aa1d13,#e9601e)",
    textDecoration: "none",
    fontWeight: 900,
    fontSize: "11px",
  },
  secondaryButton: {
    display: "inline-flex",
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    padding: "0 14px",
    borderRadius: 10,
    border: "1px solid #3b3b3b",
    background: "#151515",
    color: "#fff",
    textDecoration: "none",
    fontSize: 10,
    fontWeight: 950,
  },
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(5,minmax(0,1fr))",
    gap: "9px",
  },
  card: {
    border: "1px solid #272c34",
    borderRadius: "14px",
    background: "linear-gradient(180deg,#11151b,#0c0f14)",
    padding: "15px",
    minWidth: 0,
  },
  cardHead: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "12px",
    marginBottom: "12px",
    flexWrap: "wrap",
  },
  sectionEyebrow: {
    margin: "0 0 3px",
    color: "#ff7d28",
    fontSize: "10px",
    fontWeight: 950,
    letterSpacing: ".08em",
  },
  sectionTitle: {
    margin: "0 0 5px",
    fontSize: "18px",
  },
  muted: {
    color: "#8c929c",
    fontSize: "11px",
    lineHeight: 1.5,
    margin: 0,
  },
  countBadge: {
    border: "1px solid rgba(255,126,41,.4)",
    background: "rgba(255,126,41,.09)",
    color: "#ff974c",
    borderRadius: "999px",
    padding: "6px 9px",
    fontSize: "9px",
    fontWeight: 950,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
    gap: "9px",
  },
  item: {
    border: "1px solid #252a32",
    background: "#0e1116",
    borderRadius: "10px",
    padding: "10px",
    display: "grid",
    gap: "5px",
    minWidth: 0,
  },
  itemLabel: {
    color: "#818792",
    fontSize: "9px",
    fontWeight: 950,
    letterSpacing: ".07em",
    textTransform: "uppercase",
  },
  itemValue: {
    color: "#f5f7fa",
    fontSize: "13px",
    overflowWrap: "anywhere",
  },
  accent: {
    color: "#ff8a36",
  },
  rulesList: {
    display: "grid",
    gap: "12px",
  },
  ruleCard: {
    border: "1px solid #252a32",
    background: "#0e1116",
    borderRadius: "10px",
    padding: "12px",
    display: "grid",
    gap: "10px",
  },
  ruleTitle: {
    color: "#ff8a35",
    fontSize: "13px",
  },
  empty: {
    color: "#858b94",
    fontSize: "12px",
    padding: "10px 0",
  },
  footerActions: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    paddingBottom: 20,
  },
};