import Link from "next/link";

import RealtimeSettingsRefresh from "@/components/league/RealtimeSettingsRefresh";

import {
  createSupabaseAdminClient,
} from "@/lib/supabase/admin";

type Props = {
  leagueId: string;
  leagueName: string;
  season: number;
  isCommissioner: boolean;
};

type AnyRow = Record<string, unknown>;

const HIDDEN_KEYS = new Set([
  "id",
  "league_id",
  "created_at",
  "updated_at",
]);

const TRADITIONAL_REALTIME_TABLES = [
  "leagues",
  "league_settings",
  "traditional_roster_settings",
  "league_scoring_settings",
  "league_scoring_rules",
  "league_drafts",
  "traditional_waiver_settings",
  "traditional_trade_settings",
  "traditional_playoff_settings",
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

function settingEntries(row: AnyRow | null | undefined) {
  return Object.entries(row ?? {})
    .filter(([key]) => !HIDDEN_KEYS.has(key))
    .sort(([a], [b]) => a.localeCompare(b));
}

function Item({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div style={styles.item}>
      <span style={styles.itemLabel}>{label}</span>
      <strong style={styles.itemValue}>{value}</strong>
    </div>
  );
}

function Section({
  title,
  description,
  row,
}: {
  title: string;
  description?: string;
  row: AnyRow | null | undefined;
}) {
  const entries = settingEntries(row);

  return (
    <section style={styles.card}>
      <div style={{ marginBottom: 14 }}>
        <p style={styles.eyebrow}>TRADITIONAL</p>
        <h2 style={styles.sectionTitle}>{title}</h2>
        {description ? <p style={styles.description}>{description}</p> : null}
      </div>

      {entries.length ? (
        <div className="g365-traditional-settings-grid" style={styles.grid}>
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
      <div style={{ marginBottom: 14 }}>
        <p style={styles.eyebrow}>TRADITIONAL</p>
        <h2 style={styles.sectionTitle}>Bonus Scoring Rules</h2>
        <p style={styles.description}>
          Every saved custom scoring rule. Tiered bonus families remain highest-qualifying-only when configured that way.
        </p>
      </div>

      <div style={styles.rulesList}>
        {rules.length ? (
          rules.map((rule, index) => (
            <div key={String(rule.id ?? index)} style={styles.ruleCard}>
              <strong style={styles.ruleTitle}>
                {show(rule.label) !== "—"
                  ? show(rule.label)
                  : `Bonus Rule ${index + 1}`}
              </strong>

              <div className="g365-traditional-settings-grid" style={styles.grid}>
                {settingEntries(rule).map(([key, value]) => (
                  <Item key={key} label={humanize(key)} value={show(value)} />
                ))}
              </div>
            </div>
          ))
        ) : (
          <div style={styles.empty}>No bonus scoring rules are currently configured.</div>
        )}
      </div>
    </section>
  );
}

export default async function TraditionalSettings({
  leagueId,
  leagueName,
  season,
  isCommissioner,
}: Props) {
  const supabase = createSupabaseAdminClient();

  const [
    leagueResult,
    settingsResult,
    rosterResult,
    scoringResult,
    rulesResult,
    draftResult,
    waiverResult,
    tradeResult,
    playoffResult,
  ] = await Promise.all([
    supabase
      .from("leagues")
      .select("*")
      .eq("id", leagueId)
      .maybeSingle(),

    supabase
      .from("league_settings")
      .select("*")
      .eq("league_id", leagueId)
      .maybeSingle(),

    supabase
      .from("traditional_roster_settings")
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

    supabase
      .from("league_drafts")
      .select("*")
      .eq("league_id", leagueId)
      .order("season", { ascending: false })
      .limit(1)
      .maybeSingle(),

    supabase
      .from("traditional_waiver_settings")
      .select("*")
      .eq("league_id", leagueId)
      .maybeSingle(),

    supabase
      .from("traditional_trade_settings")
      .select("*")
      .eq("league_id", leagueId)
      .maybeSingle(),

    supabase
      .from("traditional_playoff_settings")
      .select("*")
      .eq("league_id", leagueId)
      .maybeSingle(),
  ]);

  const failures = [
    leagueResult,
    settingsResult,
    rosterResult,
    scoringResult,
    rulesResult,
    draftResult,
    waiverResult,
    tradeResult,
    playoffResult,
  ].filter((result) => result.error);

  if (failures.length) {
    throw new Error(
      `Could not load complete Traditional league settings: ${failures[0]?.error?.message ?? "Unknown settings error."}`
    );
  }

  const league = (leagueResult.data ?? {}) as AnyRow;
  const settings = (settingsResult.data ?? {}) as AnyRow;
  const roster = (rosterResult.data ?? {}) as AnyRow;
  const scoring = (scoringResult.data ?? {}) as AnyRow;
  const rules = (rulesResult.data ?? []) as AnyRow[];
  const draft = (draftResult.data ?? {}) as AnyRow;
  const waivers = (waiverResult.data ?? {}) as AnyRow;
  const trades = (tradeResult.data ?? {}) as AnyRow;
  const playoffs = (playoffResult.data ?? {}) as AnyRow;

  return (
    <main className="g365-traditional-settings" style={styles.page}>
      <RealtimeSettingsRefresh
        leagueId={leagueId}
        tables={TRADITIONAL_REALTIME_TABLES}
      />

      <style>{`
        .g365-traditional-settings,
        .g365-traditional-settings * {
          box-sizing: border-box;
        }

        @media (max-width: 760px) {
          .g365-traditional-settings {
            padding: 12px 10px !important;
          }

          .g365-traditional-settings-header {
            display: grid !important;
            grid-template-columns: 1fr !important;
          }

          .g365-traditional-settings-grid {
            grid-template-columns: 1fr !important;
          }

          .g365-traditional-settings-actions {
            width: 100%;
          }

          .g365-traditional-settings-actions a {
            width: 100%;
            text-align: center;
          }
        }
      `}</style>

      <section style={styles.shell}>
        <header
          className="g365-traditional-settings-header"
          style={styles.header}
        >
          <div>
            <p style={styles.eyebrow}>G365 TRADITIONAL • LEAGUE SETTINGS</p>
            <h1 style={styles.title}>{leagueName}</h1>
            <p style={styles.subtitle}>
              {season} • Traditional Fantasy Football • Official read-only league rules • Live updating
            </p>
          </div>

          <div
            className="g365-traditional-settings-actions"
            style={styles.actions}
          >
            <span style={styles.liveBadge}>● LIVE SETTINGS</span>
            <span style={styles.readOnly}>READ ONLY</span>

            {isCommissioner ? (
              <Link
                href={`/league/${leagueId}/commissioner`}
                style={styles.button}
              >
                MANAGE SETTINGS
              </Link>
            ) : null}
          </div>
        </header>

        <Section
          title="League"
          description="Core league identity, status, season and league-level configuration."
          row={league}
        />

        <Section
          title="League & Season"
          description="League size and season structure."
          row={settings}
        />

        <Section
          title="Roster Settings"
          description="Starting lineup, bench, reserve and position-limit requirements."
          row={roster}
        />

        <Section
          title="Draft Settings"
          description="Current Traditional draft configuration and live draft state."
          row={draft}
        />

        <Section
          title="Scoring"
          description="Every current base scoring field, including kicking yardage, DST tackle/TFL and any future scoring fields added to this table."
          row={scoring}
        />

        <RulesSection rules={rules} />

        <Section
          title="Waivers & Free Agency"
          description="Current waiver and free-agent configuration."
          row={waivers}
        />

        <Section
          title="Trades"
          description="Current Traditional trade configuration."
          row={trades}
        />

        <Section
          title="Playoffs"
          description="Current Traditional playoff field, timing and reseeding configuration."
          row={playoffs}
        />

        <div style={styles.footerActions}>
          <Link href={`/league/${leagueId}`} style={styles.secondaryButton}>
            LEAGUE HOME
          </Link>

          {isCommissioner ? (
            <Link
              href={`/league/${leagueId}/commissioner/new-season`}
              style={styles.button}
            >
              RENEW FOR {season + 1}
            </Link>
          ) : null}
        </div>
      </section>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    padding: "24px",
    background: "#080808",
    color: "#fff",
  },
  shell: {
    width: "100%",
    maxWidth: 1180,
    margin: "0 auto",
    display: "grid",
    gap: 16,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    gap: 18,
    alignItems: "flex-start",
    padding: 20,
    border: "1px solid #3b2119",
    borderRadius: 18,
    background: "linear-gradient(135deg,#160c09,#0b0b0b)",
  },
  eyebrow: {
    margin: "0 0 5px",
    color: "#ff6422",
    fontSize: 10,
    fontWeight: 950,
    letterSpacing: 0.9,
  },
  title: {
    margin: 0,
    fontSize: "clamp(26px,4vw,42px)",
    fontWeight: 950,
  },
  subtitle: {
    margin: "7px 0 0",
    color: "#aaa",
    fontSize: 12,
    lineHeight: 1.5,
  },
  actions: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    alignItems: "center",
  },
  liveBadge: {
    padding: "10px 12px",
    borderRadius: 10,
    background: "rgba(55,180,90,.10)",
    border: "1px solid rgba(55,180,90,.35)",
    color: "#77e497",
    fontSize: 10,
    fontWeight: 950,
  },
  readOnly: {
    padding: "10px 12px",
    borderRadius: 10,
    background: "#151515",
    border: "1px solid #333",
    color: "#aaa",
    fontSize: 10,
    fontWeight: 900,
  },
  button: {
    display: "inline-flex",
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    padding: "0 14px",
    borderRadius: 10,
    border: "1px solid #e85c1b",
    background: "linear-gradient(90deg,#a61919,#f0631d)",
    color: "#fff",
    textDecoration: "none",
    fontSize: 10,
    fontWeight: 950,
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
  card: {
    padding: 18,
    border: "1px solid #292929",
    borderRadius: 16,
    background: "#101010",
  },
  sectionTitle: {
    margin: 0,
    fontSize: 19,
    fontWeight: 950,
  },
  description: {
    margin: "5px 0 0",
    color: "#969696",
    fontSize: 12,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
    gap: 10,
  },
  item: {
    display: "grid",
    gap: 5,
    minWidth: 0,
    padding: 12,
    borderRadius: 12,
    background: "#151515",
    border: "1px solid #272727",
  },
  itemLabel: {
    color: "#898989",
    fontSize: 9,
    fontWeight: 900,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  itemValue: {
    color: "#fff",
    fontSize: 13,
    overflowWrap: "anywhere",
  },
  rulesList: {
    display: "grid",
    gap: 12,
  },
  ruleCard: {
    padding: 12,
    borderRadius: 12,
    border: "1px solid #2d2d2d",
    background: "#0c0c0c",
    display: "grid",
    gap: 10,
  },
  ruleTitle: {
    color: "#ff8a35",
    fontSize: 13,
  },
  empty: {
    color: "#858585",
    fontSize: 12,
    padding: "10px 0",
  },
  footerActions: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    paddingBottom: 20,
  },
};