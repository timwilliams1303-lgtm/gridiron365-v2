"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useParams } from "next/navigation";

type Summary = {
  seasons: number;
  champions: number;
  all_time_matchups: number;
  all_time_fantasy_points: number;
  total_transactions: number;
};

type SeasonRow = {
  season: number;
  champion_fantasy_team_id: number | null;
  champion_team_name: string | null;
  runner_up_fantasy_team_id: number | null;
  runner_up_team_name: string | null;
  regular_season_champion_team_name: string | null;
  regular_season_weeks: number | null;
  playoff_teams: number | null;
  championship_week: number | null;
  total_teams: number;
  total_matchups: number;
  total_fantasy_points: number;
  recap_status: string;
};

type LegacyRow = {
  owner_user_id: string;
  display_name: string | null;
  seasons_played: number;
  championships: number;
  runner_up_finishes: number;
  championship_appearances: number;
  playoff_appearances: number;
  all_time_wins: number;
  all_time_losses: number;
  all_time_ties: number;
  all_time_win_percentage: number | null;
  all_time_points_for: number;
  playoff_wins: number;
  badges_earned: number;
  legendary_badges: number;
  legacy_score: number;
  legacy_tier: string;
  first_season: number | null;
  most_recent_season: number | null;
};

type RecordRow = {
  record_key: string;
  record_name: string;
  record_scope: string;
  value: number;
  value_display: string | null;
  season: number;
  week: number | null;
  holder_name: string;
  opponent_name: string | null;
};

type RivalryRow = {
  fantasy_team_id_a: number;
  fantasy_team_id_b: number;
  team_name_a: string;
  team_name_b: string;
  wins_a: number;
  wins_b: number;
  ties: number;
  points_a: number;
  points_b: number;
  playoff_meetings: number;
  championship_meetings: number;
  playoff_wins_a: number;
  playoff_wins_b: number;
  largest_margin: number | null;
  closest_margin: number | null;
  last_meeting_season: number | null;
  last_meeting_week: number | null;
};

type OwnerBadge = {
  owner_user_id: string;
  season: number | null;
  badge_key: string;
  badge_value: number | null;
  name: string;
  description: string;
  category: string;
  rarity: string;
  tier: string;
  icon: string | null;
};

type HistoryPayload = {
  success: boolean;
  league_id: string;
  league_name: string;
  established: number;
  summary: Summary;
  seasons: SeasonRow[];
  legacy: LegacyRow[];
  records: RecordRow[];
  rivalries: RivalryRow[];
  owner_badges: OwnerBadge[];
};

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function n(value: unknown, digits = 1) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed.toFixed(digits) : "0.0";
}

function pct(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? `${(parsed * 100).toFixed(1)}%` : "0.0%";
}

function ordinal(value: number) {
  const mod100 = value % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${value}th`;
  if (value % 10 === 1) return `${value}st`;
  if (value % 10 === 2) return `${value}nd`;
  if (value % 10 === 3) return `${value}rd`;
  return `${value}th`;
}

export default function LeagueHistoryPage() {
  const params = useParams<{ leagueId: string }>();
  const leagueId = params.leagueId;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<HistoryPayload | null>(null);
  const [selectedOwnerId, setSelectedOwnerId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const result = await supabase.rpc("get_traditional_league_history", {
      p_league_id: leagueId,
    });

    if (result.error) {
      setError(result.error.message);
      setLoading(false);
      return;
    }

    const data = result.data as HistoryPayload;
    setPayload(data);
    setSelectedOwnerId((current) => current ?? data.legacy?.[0]?.owner_user_id ?? null);
    setLoading(false);
  }, [leagueId]);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedOwner = useMemo(
    () => payload?.legacy.find((row) => row.owner_user_id === selectedOwnerId) ?? null,
    [payload?.legacy, selectedOwnerId]
  );

  const selectedOwnerBadges = useMemo(
    () => payload?.owner_badges.filter((row) => row.owner_user_id === selectedOwnerId) ?? [],
    [payload?.owner_badges, selectedOwnerId]
  );

  if (loading) {
    return (
      <main style={styles.page}>
        <div style={styles.loading}>
          <div style={styles.brand}>G365</div>
          <div>Opening the league vault…</div>
        </div>
      </main>
    );
  }

  if (error || !payload) {
    return (
      <main style={styles.page}>
        <div style={styles.shell}>
          <div style={styles.error}>{error ?? "League history could not be loaded."}</div>
        </div>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <div style={styles.shell}>
        <section style={styles.hero}>
          <div style={styles.eyebrow}>GRIDIRON365 • LEAGUE HISTORY</div>
          <h1 style={styles.title}>{payload.league_name}</h1>
          <p style={styles.heroCopy}>
            Championships, records, rivalries and legacies. Every completed season
            adds another permanent chapter to this league.
          </p>

          <div style={styles.summaryGrid}>
            <Stat label="Established" value={String(payload.established)} />
            <Stat label="Seasons" value={String(payload.summary.seasons)} />
            <Stat label="Champions" value={String(payload.summary.champions)} />
            <Stat label="All-Time Matchups" value={String(payload.summary.all_time_matchups)} />
            <Stat label="Fantasy Points" value={n(payload.summary.all_time_fantasy_points)} />
            <Stat label="Transactions" value={String(payload.summary.total_transactions)} />
          </div>
        </section>

        <Section title="CHAMPIONSHIP WALL" subtitle="Every champion. Every season. Permanently preserved.">
          {payload.seasons.length ? (
            <div style={styles.championshipWall}>
              {payload.seasons.map((season) => (
                <Link
                  key={season.season}
                  href={`/league/${leagueId}/history/${season.season}`}
                  style={styles.championCard}
                >
                  <div style={styles.year}>{season.season}</div>
                  <div style={styles.trophy}>🏆</div>
                  <strong style={styles.championName}>{season.champion_team_name ?? "Champion"}</strong>
                  <span style={styles.muted}>
                    Runner-up: {season.runner_up_team_name ?? "—"}
                  </span>
                  <div style={styles.openRecap}>OPEN SEASON ARCHIVE →</div>
                </Link>
              ))}
            </div>
          ) : (
            <Empty text="No completed seasons have been archived yet." />
          )}
        </Section>

        <Section title="G365 LEGACY RANKINGS" subtitle="The all-time owner leaderboard.">
          {payload.legacy.length ? (
            <div style={styles.legacyGrid}>
              <div style={styles.legacyList}>
                {payload.legacy.map((owner, index) => (
                  <button
                    key={owner.owner_user_id}
                    type="button"
                    onClick={() => setSelectedOwnerId(owner.owner_user_id)}
                    style={{
                      ...styles.legacyRow,
                      ...(selectedOwnerId === owner.owner_user_id ? styles.legacyRowActive : {}),
                    }}
                  >
                    <span style={styles.rank}>#{index + 1}</span>
                    <span style={styles.ownerMain}>
                      <strong>{owner.display_name ?? "League Owner"}</strong>
                      <small>
                        {owner.championships} titles • {owner.all_time_wins}-{owner.all_time_losses}
                      </small>
                    </span>
                    <span style={styles.tier}>{owner.legacy_tier}</span>
                    <strong style={styles.score}>{n(owner.legacy_score, 0)}</strong>
                  </button>
                ))}
              </div>

              {selectedOwner ? (
                <div style={styles.ownerProfile}>
                  <div style={styles.profileTop}>
                    <div>
                      <div style={styles.eyebrow}>{selectedOwner.legacy_tier.toUpperCase()}</div>
                      <h3 style={styles.profileName}>{selectedOwner.display_name ?? "League Owner"}</h3>
                    </div>
                    <div style={styles.legacyScoreBig}>{n(selectedOwner.legacy_score, 0)}</div>
                  </div>

                  <div style={styles.profileStats}>
                    <Stat label="Seasons" value={String(selectedOwner.seasons_played)} />
                    <Stat label="Titles" value={String(selectedOwner.championships)} />
                    <Stat label="Championship Games" value={String(selectedOwner.championship_appearances)} />
                    <Stat label="Playoff Trips" value={String(selectedOwner.playoff_appearances)} />
                    <Stat label="All-Time Record" value={`${selectedOwner.all_time_wins}-${selectedOwner.all_time_losses}${selectedOwner.all_time_ties ? `-${selectedOwner.all_time_ties}` : ""}`} />
                    <Stat label="Win %" value={pct(selectedOwner.all_time_win_percentage)} />
                    <Stat label="Playoff Wins" value={String(selectedOwner.playoff_wins)} />
                    <Stat label="All-Time Points" value={n(selectedOwner.all_time_points_for)} />
                    <Stat label="Badges" value={String(selectedOwner.badges_earned)} />
                    <Stat label="Legendary" value={String(selectedOwner.legendary_badges)} />
                  </div>

                  <div style={styles.badgeCase}>
                    {selectedOwnerBadges.length ? (
                      selectedOwnerBadges.map((badge, index) => (
                        <div key={`${badge.badge_key}-${badge.season ?? "all"}-${index}`} style={styles.badge}>
                          <span style={styles.badgeIcon}>{badge.icon ?? "◆"}</span>
                          <div>
                            <strong>{badge.name}</strong>
                            <div style={styles.badgeMeta}>
                              {badge.season ? `${badge.season} • ` : ""}
                              {badge.tier.toUpperCase()}
                            </div>
                            <div style={styles.badgeDesc}>{badge.description}</div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <Empty text="No historical badges yet." />
                    )}
                  </div>

                  <Link
                    href={`/league/${leagueId}/history/owners/${selectedOwner.owner_user_id}`}
                    style={styles.profileLink}
                  >
                    OPEN FULL OWNER LEGACY PROFILE →
                  </Link>
                </div>
              ) : null}
            </div>
          ) : (
            <Empty text="Legacy rankings will appear after the first finalized season." />
          )}
        </Section>

        <Section title="LEAGUE RECORD BOOK" subtitle="The marks every future season will chase.">
          {payload.records.length ? (
            <div style={styles.recordGrid}>
              {payload.records.map((record) => (
                <div key={record.record_key} style={styles.recordCard}>
                  <div style={styles.recordLabel}>{record.record_name}</div>
                  <strong style={styles.recordValue}>
                    {record.value_display ?? n(record.value)}
                  </strong>
                  <div style={styles.recordHolder}>{record.holder_name}</div>
                  <div style={styles.muted}>
                    {record.season}
                    {record.week ? ` • Week ${record.week}` : ""}
                    {record.opponent_name ? ` • vs ${record.opponent_name}` : ""}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Empty text="League records will appear after the first finalized season." />
          )}
        </Section>

        <Section title="RIVALRY VAULT" subtitle="Every head-to-head matchup adds to the story.">
          {payload.rivalries.length ? (
            <div style={styles.rivalryGrid}>
              {payload.rivalries.slice(0, 12).map((rivalry) => {
                const total = rivalry.wins_a + rivalry.wins_b + rivalry.ties;

                return (
                  <div
                    key={`${rivalry.fantasy_team_id_a}-${rivalry.fantasy_team_id_b}`}
                    style={styles.rivalryCard}
                  >
                    <div style={styles.rivalryTeams}>
                      <div>
                        <strong>{rivalry.team_name_a}</strong>
                        <span>{rivalry.wins_a} wins</span>
                      </div>
                      <div style={styles.vs}>VS</div>
                      <div style={{ textAlign: "right" }}>
                        <strong>{rivalry.team_name_b}</strong>
                        <span>{rivalry.wins_b} wins</span>
                      </div>
                    </div>

                    <div style={styles.rivalryRecord}>
                      {rivalry.wins_a}-{rivalry.wins_b}
                      {rivalry.ties ? `-${rivalry.ties}` : ""}
                    </div>

                    <div style={styles.rivalryFacts}>
                      <span>{total} meetings</span>
                      <span>{rivalry.playoff_meetings} playoff</span>
                      <span>{rivalry.championship_meetings} championship</span>
                      <span>Closest: {rivalry.closest_margin !== null ? n(rivalry.closest_margin) : "—"}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <Empty text="Rivalry history will build as completed seasons are archived." />
          )}
        </Section>

        <Section title="SEASON ARCHIVES" subtitle="Open any completed year and relive the entire season.">
          {payload.seasons.length ? (
            <div style={styles.archiveList}>
              {payload.seasons.map((season) => (
                <Link
                  key={season.season}
                  href={`/league/${leagueId}/history/${season.season}`}
                  style={styles.archiveRow}
                >
                  <div>
                    <div style={styles.archiveYear}>{season.season}</div>
                    <strong>{season.champion_team_name ?? "Champion"}</strong>
                    <div style={styles.muted}>
                      {season.total_teams} teams • {season.total_matchups} matchups •{" "}
                      {n(season.total_fantasy_points)} fantasy points
                    </div>
                  </div>

                  <div style={styles.archiveRight}>
                    <span>{season.playoff_teams ?? "—"} playoff teams</span>
                    <strong>VIEW RECAP →</strong>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <Empty text="No season archives yet." />
          )}
        </Section>
      </div>
    </main>
  );
}

function Section(props: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section style={styles.section}>
      <div style={styles.sectionHead}>
        <div style={styles.eyebrow}>GRIDIRON365</div>
        <h2 style={styles.sectionTitle}>{props.title}</h2>
        {props.subtitle ? <p style={styles.sectionSub}>{props.subtitle}</p> : null}
      </div>
      {props.children}
    </section>
  );
}

function Stat(props: { label: string; value: string }) {
  return (
    <div style={styles.stat}>
      <span style={styles.statLabel}>{props.label}</span>
      <strong style={styles.statValue}>{props.value}</strong>
    </div>
  );
}

function Empty(props: { text: string }) {
  return <div style={styles.empty}>{props.text}</div>;
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    color: "#fff",
    background:
      "radial-gradient(circle at 15% -10%, rgba(209,18,9,.17), transparent 30%), radial-gradient(circle at 85% 0%, rgba(255,116,0,.10), transparent 24%), #070707",
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
  },
  shell: {
    width: "min(1450px, calc(100% - 28px))",
    margin: "0 auto",
    padding: "24px 0 70px",
  },
  hero: {
    padding: "52px 28px 30px",
    borderRadius: 22,
    border: "1px solid rgba(255,92,15,.20)",
    background:
      "linear-gradient(145deg, rgba(97,5,3,.38), rgba(10,10,10,.97) 52%, rgba(63,22,0,.36))",
    boxShadow: "0 30px 90px rgba(0,0,0,.34)",
  },
  eyebrow: {
    color: "#ff6720",
    fontSize: 11,
    fontWeight: 950,
    letterSpacing: ".13em",
  },
  title: {
    margin: "6px 0 0",
    fontSize: "clamp(38px,6vw,74px)",
    lineHeight: .98,
    letterSpacing: "-.05em",
    textTransform: "uppercase",
  },
  heroCopy: {
    color: "#989898",
    maxWidth: 760,
    lineHeight: 1.65,
    margin: "15px 0 0",
  },
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))",
    gap: 10,
    marginTop: 27,
  },
  stat: {
    minWidth: 0,
    padding: "14px 15px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,.075)",
    background: "rgba(255,255,255,.022)",
  },
  statLabel: {
    display: "block",
    color: "#757575",
    fontSize: 9,
    fontWeight: 950,
    letterSpacing: ".09em",
    textTransform: "uppercase",
    marginBottom: 6,
  },
  statValue: {
    display: "block",
    fontSize: 20,
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  section: {
    marginTop: 18,
    padding: 22,
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,.075)",
    background: "rgba(12,12,12,.94)",
  },
  sectionHead: { marginBottom: 17 },
  sectionTitle: {
    margin: "4px 0 0",
    fontSize: "clamp(23px,3vw,36px)",
    letterSpacing: "-.035em",
  },
  sectionSub: {
    margin: "5px 0 0",
    color: "#777",
    lineHeight: 1.5,
  },
  championshipWall: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(225px,1fr))",
    gap: 11,
  },
  championCard: {
    textDecoration: "none",
    color: "#fff",
    padding: 20,
    minHeight: 185,
    borderRadius: 15,
    border: "1px solid rgba(255,104,12,.22)",
    background:
      "linear-gradient(145deg,rgba(120,12,5,.20),rgba(10,10,10,.95))",
    display: "flex",
    flexDirection: "column",
  },
  year: {
    color: "#ff6c23",
    fontWeight: 950,
    letterSpacing: ".08em",
  },
  trophy: { fontSize: 36, margin: "14px 0 9px" },
  championName: { fontSize: 20, marginBottom: 5 },
  muted: { color: "#777", fontSize: 12, lineHeight: 1.5 },
  openRecap: {
    marginTop: "auto",
    paddingTop: 16,
    color: "#ff7934",
    fontSize: 10,
    fontWeight: 950,
    letterSpacing: ".08em",
  },
  legacyGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(310px,.9fr) minmax(0,1.5fr)",
    gap: 13,
  },
  legacyList: { display: "grid", gap: 7, alignContent: "start" },
  legacyRow: {
    width: "100%",
    display: "grid",
    gridTemplateColumns: "42px minmax(0,1fr) auto 68px",
    gap: 10,
    alignItems: "center",
    textAlign: "left",
    padding: "12px 13px",
    borderRadius: 11,
    border: "1px solid rgba(255,255,255,.07)",
    background: "#0a0a0a",
    color: "#fff",
    cursor: "pointer",
  },
  legacyRowActive: {
    border: "1px solid rgba(255,103,22,.48)",
    background: "linear-gradient(90deg,rgba(134,13,6,.27),rgba(55,21,0,.17))",
  },
  rank: { color: "#ff6820", fontWeight: 950 },
  ownerMain: { display: "grid", minWidth: 0 },
  tier: {
    color: "#888",
    fontSize: 9,
    fontWeight: 950,
    letterSpacing: ".08em",
  },
  score: { textAlign: "right", fontSize: 17 },
  ownerProfile: {
    padding: 18,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,.08)",
    background: "#090909",
  },
  profileTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    alignItems: "flex-start",
  },
  profileName: { fontSize: 29, margin: "4px 0 0" },
  legacyScoreBig: { fontSize: 36, fontWeight: 1000, color: "#ff6d25" },
  profileStats: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(125px,1fr))",
    gap: 8,
    marginTop: 16,
  },
  badgeCase: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
    gap: 8,
    marginTop: 15,
  },
  badge: {
    display: "grid",
    gridTemplateColumns: "40px 1fr",
    gap: 9,
    padding: 11,
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,.07)",
    background: "#070707",
  },
  badgeIcon: { fontSize: 25 },
  badgeMeta: {
    marginTop: 2,
    color: "#ff7730",
    fontSize: 9,
    fontWeight: 950,
  },
  badgeDesc: { color: "#6f6f6f", fontSize: 10, lineHeight: 1.4, marginTop: 4 },
  profileLink: {
    display: "inline-block",
    marginTop: 16,
    textDecoration: "none",
    color: "#ff7130",
    fontSize: 10,
    fontWeight: 950,
    letterSpacing: ".08em",
  },
  recordGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
    gap: 9,
  },
  recordCard: {
    padding: 16,
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,.07)",
    background: "#090909",
  },
  recordLabel: {
    color: "#777",
    fontSize: 9,
    fontWeight: 950,
    textTransform: "uppercase",
  },
  recordValue: { display: "block", fontSize: 25, marginTop: 7 },
  recordHolder: { marginTop: 6, fontWeight: 900 },
  rivalryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(290px,1fr))",
    gap: 10,
  },
  rivalryCard: {
    padding: 16,
    borderRadius: 13,
    border: "1px solid rgba(255,255,255,.07)",
    background: "#090909",
  },
  rivalryTeams: {
    display: "grid",
    gridTemplateColumns: "1fr 40px 1fr",
    gap: 8,
    alignItems: "center",
  },
  vs: {
    textAlign: "center",
    color: "#ff6821",
    fontWeight: 1000,
    fontSize: 11,
  },
  rivalryRecord: {
    marginTop: 15,
    textAlign: "center",
    fontSize: 30,
    fontWeight: 1000,
  },
  rivalryFacts: {
    display: "flex",
    justifyContent: "center",
    gap: 7,
    flexWrap: "wrap",
    color: "#777",
    fontSize: 10,
    marginTop: 11,
  },
  archiveList: { display: "grid", gap: 8 },
  archiveRow: {
    color: "#fff",
    textDecoration: "none",
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    padding: "15px 16px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,.07)",
    background: "#090909",
  },
  archiveYear: {
    color: "#ff6821",
    fontWeight: 950,
    fontSize: 11,
    letterSpacing: ".08em",
  },
  archiveRight: {
    textAlign: "right",
    display: "grid",
    alignContent: "center",
    gap: 4,
    color: "#777",
    fontSize: 10,
  },
  empty: {
    padding: 16,
    borderRadius: 11,
    border: "1px dashed rgba(255,255,255,.09)",
    color: "#707070",
  },
  loading: {
    minHeight: "75vh",
    display: "grid",
    placeContent: "center",
    textAlign: "center",
    gap: 9,
    color: "#777",
  },
  brand: {
    fontSize: 42,
    fontWeight: 1000,
    letterSpacing: "-.07em",
    background: "linear-gradient(90deg,#cf170e,#ff7600)",
    WebkitBackgroundClip: "text",
    color: "transparent",
  },
  error: {
    padding: 16,
    borderRadius: 11,
    color: "#ff8980",
    border: "1px solid rgba(255,70,70,.24)",
    background: "rgba(120,0,0,.13)",
  },
};