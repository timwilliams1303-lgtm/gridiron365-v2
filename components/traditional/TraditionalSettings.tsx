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
  "deleted_at",
]);

const OBSOLETE_SCORING_KEYS = new Set([
  "passing_yards_per_point",
  "rushing_yards_per_point",
  "receiving_yards_per_point",
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

function isUsedValue(value: unknown): boolean {
  if (value === null || value === undefined || value === "") {
    return false;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value !== 0;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();

    if (
      normalized === "" ||
      normalized === "false" ||
      normalized === "disabled" ||
      normalized === "none" ||
      normalized === "off" ||
      normalized === "0"
    ) {
      return false;
    }

    return true;
  }

  if (Array.isArray(value)) {
    return value.length > 0;
  }

  return true;
}

function settingEntries(
  row: AnyRow | null | undefined,
  options?: {
    keepZero?: boolean;
    excludeKeys?: Set<string>;
  }
) {
  return Object.entries(row ?? {})
    .filter(([key, value]) => {
      if (HIDDEN_KEYS.has(key)) {
        return false;
      }

      if (options?.excludeKeys?.has(key)) {
        return false;
      }

      if (options?.keepZero && typeof value === "number") {
        return true;
      }

      return isUsedValue(value);
    })
    .sort(([a], [b]) => a.localeCompare(b));
}

type ScoringGroup = {
  title: string;
  description: string;
  entries: Array<[string, unknown]>;
};

function scoringCategory(key: string):
  | "passing"
  | "rushing"
  | "receiving"
  | "kicking"
  | "dst"
  | "other" {
  const value = key.toLowerCase();

  if (
    value.includes("pass") ||
    value.includes("completion") ||
    value.includes("interception_thrown") ||
    value.includes("qb_")
  ) {
    return "passing";
  }

  if (
    value.includes("rush") ||
    value.includes("rushing")
  ) {
    return "rushing";
  }

  if (
    value.includes("receiv") ||
    value.includes("reception") ||
    value.includes("target")
  ) {
    return "receiving";
  }

  if (
    value.includes("field_goal") ||
    value.includes("extra_point") ||
    value.includes("kicking") ||
    value.includes("fg_") ||
    value.includes("xp_")
  ) {
    return "kicking";
  }

  if (
    value.includes("dst") ||
    value.includes("defense") ||
    value.includes("defensive") ||
    value.includes("sack") ||
    value.includes("safety") ||
    value.includes("points_allowed") ||
    value.includes("yards_allowed") ||
    value.includes("return_td") ||
    value.includes("blocked_kick")
  ) {
    return "dst";
  }

  return "other";
}

function buildScoringGroups(scoring: AnyRow): ScoringGroup[] {
  const activeEntries = settingEntries(scoring, {
    excludeKeys: OBSOLETE_SCORING_KEYS,
  });

  const grouped = new Map<string, Array<[string, unknown]>>();

  for (const entry of activeEntries) {
    const category = scoringCategory(entry[0]);
    const list = grouped.get(category) ?? [];
    list.push(entry);
    grouped.set(category, list);
  }

  const definitions: Array<{
    key: string;
    title: string;
    description: string;
  }> = [
    {
      key: "passing",
      title: "Passing",
      description: "Passing scoring currently in use.",
    },
    {
      key: "rushing",
      title: "Rushing",
      description: "Rushing scoring used by eligible offensive players.",
    },
    {
      key: "receiving",
      title: "Receiving",
      description: "Receiving scoring used by RB, WR and TE.",
    },
    {
      key: "kicking",
      title: "Kicker",
      description: "Kicking and field-goal scoring currently in use.",
    },
    {
      key: "dst",
      title: "Defense / Special Teams",
      description: "DST scoring currently in use.",
    },
    {
      key: "other",
      title: "Other Scoring",
      description: "Other active scoring settings that apply across positions.",
    },
  ];

  return definitions
    .map((definition) => ({
      title: definition.title,
      description: definition.description,
      entries: grouped.get(definition.key) ?? [],
    }))
    .filter((group) => group.entries.length > 0);
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
        <div style={styles.empty}>No active settings are currently being used in this section.</div>
      )}
    </section>
  );
}

function ScoringSection({
  scoring,
}: {
  scoring: AnyRow;
}) {
  const groups = buildScoringGroups(scoring);

  return (
    <section style={styles.card}>
      <div style={{ marginBottom: 14 }}>
        <p style={styles.eyebrow}>TRADITIONAL • SCORING</p>
        <h2 style={styles.sectionTitle}>Scoring by Position</h2>
        <p style={styles.description}>
          Only scoring settings that currently affect fantasy points are shown.
        </p>
      </div>

      {groups.length ? (
        <div style={styles.scoringGroups}>
          {groups.map((group) => (
            <div key={group.title} style={styles.scoringGroup}>
              <div style={styles.scoringGroupHeader}>
                <h3 style={styles.scoringGroupTitle}>{group.title}</h3>
                <p style={styles.scoringGroupDescription}>
                  {group.description}
                </p>
              </div>

              <div
                className="g365-traditional-settings-grid"
                style={styles.grid}
              >
                {group.entries.map(([key, value]) => (
                  <Item
                    key={key}
                    label={humanize(key)}
                    value={show(value)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={styles.empty}>
          No active scoring settings are currently configured.
        </div>
      )}
    </section>
  );
}

function RulesSection({
  rules,
}: {
  rules: AnyRow[];
}) {
  const activeRules = rules.filter((rule) => {
    if ("enabled" in rule && !Boolean(rule.enabled)) {
      return false;
    }

    if ("active" in rule && !Boolean(rule.active)) {
      return false;
    }

    const points =
      rule.points ??
      rule.point_value ??
      rule.value;

    if (
      typeof points === "number" &&
      points === 0
    ) {
      return false;
    }

    return true;
  });

  return (
    <section style={styles.card}>
      <div style={{ marginBottom: 14 }}>
        <p style={styles.eyebrow}>TRADITIONAL • BONUS SCORING</p>
        <h2 style={styles.sectionTitle}>Active Bonus Rules</h2>
        <p style={styles.description}>
          Only enabled bonus rules that are currently part of league scoring are shown.
        </p>
      </div>

      <div style={styles.rulesList}>
        {activeRules.length ? (
          activeRules.map((rule, index) => (
            <div key={String(rule.id ?? index)} style={styles.ruleCard}>
              <strong style={styles.ruleTitle}>
                {show(rule.label) !== "—"
                  ? show(rule.label)
                  : `Bonus Rule ${index + 1}`}
              </strong>

              <div
                className="g365-traditional-settings-grid"
                style={styles.grid}
              >
                {settingEntries(rule).map(([key, value]) => (
                  <Item
                    key={key}
                    label={humanize(key)}
                    value={show(value)}
                  />
                ))}
              </div>
            </div>
          ))
        ) : (
          <div style={styles.empty}>
            No active bonus scoring rules are currently configured.
          </div>
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
          description="Current league configuration that is actively in use."
          row={league}
        />

        <Section
          title="League & Season"
          description="Active league size and season structure."
          row={settings}
        />

        <Section
          title="Roster Settings"
          description="Roster requirements currently in use."
          row={roster}
        />

        <Section
          title="Draft Settings"
          description="Draft settings currently in use."
          row={draft}
        />

        <ScoringSection scoring={scoring} />

        <RulesSection rules={rules} />

        <Section
          title="Waivers & Free Agency"
          description="Waiver and free-agent settings currently in use."
          row={waivers}
        />

        <Section
          title="Trades"
          description="Trade settings currently in use."
          row={trades}
        />

        <Section
          title="Playoffs"
          description="Playoff settings currently in use."
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
  scoringGroups: {
    display: "grid",
    gap: 14,
  },
  scoringGroup: {
    display: "grid",
    gap: 10,
    padding: 14,
    borderRadius: 14,
    border: "1px solid #2d2d2d",
    background: "#0c0c0c",
  },
  scoringGroupHeader: {
    display: "grid",
    gap: 4,
  },
  scoringGroupTitle: {
    margin: 0,
    color: "#ff8a35",
    fontSize: 15,
    fontWeight: 950,
  },
  scoringGroupDescription: {
    margin: 0,
    color: "#858585",
    fontSize: 11,
    lineHeight: 1.4,
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