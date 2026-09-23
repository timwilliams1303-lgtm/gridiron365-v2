import Link from "next/link";

import Card from "@/components/ui/Card";

import {
  requireLeagueMember,
} from "@/lib/leagues/requireLeagueMember";

import {
  createSupabaseServerClient,
} from "@/lib/supabase/server";

type NhlTraditionalLeagueHomeProps = {
  leagueId: string;
};

function formatStatus(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatPoints(value: number) {
  return Number(value || 0).toFixed(2);
}

export default async function NhlTraditionalLeagueHome({
  leagueId,
}: NhlTraditionalLeagueHomeProps) {
  const access = await requireLeagueMember(leagueId);

  if (
    String(access.league.leagueType) !==
    "nhl_traditional"
  ) {
    throw new Error(
      "This page is only available for NHL Traditional leagues."
    );
  }

  const supabase =
    await createSupabaseServerClient();

  const season =
    Number(access.league.season);

  const [
    settingsResult,
    rosterSettingsResult,
    seasonStateResult,
    teamsResult,
    rostersResult,
    standingsResult,
    matchupsResult,
  ] = await Promise.all([
    supabase
      .from("nhl_traditional_settings")
      .select("*")
      .eq("league_id", leagueId)
      .maybeSingle(),

    supabase
      .from("nhl_traditional_roster_settings")
      .select("*")
      .eq("league_id", leagueId)
      .maybeSingle(),

    supabase
      .from("nhl_traditional_season_state")
      .select("*")
      .eq("league_id", leagueId)
      .eq("season", season)
      .maybeSingle(),

    supabase
      .from("fantasy_teams")
      .select("id, team_name, owner_id, active")
      .eq("league_id", leagueId)
      .eq("active", true)
      .order("id", {
        ascending: true,
      }),

    supabase
      .from("nhl_traditional_rosters")
      .select(
        "id, fantasy_team_id, roster_status"
      )
      .eq("league_id", leagueId)
      .eq("season", season)
      .is("dropped_at", null),

    supabase
      .from("nhl_traditional_standings")
      .select(
        "fantasy_team_id, wins, losses, ties, points_for, points_against, rank"
      )
      .eq("league_id", leagueId)
      .eq("season", season),

    supabase
      .from("nhl_traditional_matchups")
      .select(
        "id, week, home_fantasy_team_id, away_fantasy_team_id, home_score, away_score, status, winner_fantasy_team_id, is_tie"
      )
      .eq("league_id", leagueId)
      .eq("season", season)
      .order("week", {
        ascending: true,
      }),
  ]);

  if (settingsResult.error) {
    throw new Error(
      `Unable to load NHL Traditional settings: ${settingsResult.error.message}`
    );
  }

  if (rosterSettingsResult.error) {
    throw new Error(
      `Unable to load NHL Traditional roster settings: ${rosterSettingsResult.error.message}`
    );
  }

  if (seasonStateResult.error) {
    throw new Error(
      `Unable to load NHL Traditional season state: ${seasonStateResult.error.message}`
    );
  }

  if (teamsResult.error) {
    throw new Error(
      `Unable to load NHL Traditional teams: ${teamsResult.error.message}`
    );
  }

  if (rostersResult.error) {
    throw new Error(
      `Unable to load NHL Traditional rosters: ${rostersResult.error.message}`
    );
  }

  if (standingsResult.error) {
    throw new Error(
      `Unable to load NHL Traditional standings: ${standingsResult.error.message}`
    );
  }

  if (matchupsResult.error) {
    throw new Error(
      `Unable to load NHL Traditional matchups: ${matchupsResult.error.message}`
    );
  }

  const settings =
    settingsResult.data;

  const rosterSettings =
    rosterSettingsResult.data;

  const seasonState =
    seasonStateResult.data;

  const teams =
    teamsResult.data ?? [];

  const rosters =
    rostersResult.data ?? [];

  const standings =
    standingsResult.data ?? [];

  const matchups =
    matchupsResult.data ?? [];

  if (
    !settings ||
    !rosterSettings ||
    !seasonState
  ) {
    throw new Error(
      "NHL Traditional league initialization is incomplete."
    );
  }

  const myFantasyTeamId =
    access.fantasyTeam?.id ?? null;

  const myTeam =
    myFantasyTeamId !== null
      ? teams.find(
          (team) =>
            Number(team.id) ===
            Number(myFantasyTeamId)
        ) ?? null
      : null;

  const myTeamName =
    myTeam?.team_name ??
    access.fantasyTeam?.teamName ??
    "No Team Assigned";

  const activeWeek =
    Number(
      seasonState.active_week ?? 1
    );

  const maxTeams =
    Number(
      settings.max_teams ?? 12
    );

  const regularSeasonWeeks =
    Number(
      settings.regular_season_weeks ??
        20
    );

  const leagueFormat =
    String(
      settings.league_format ??
        "redraft"
    );

  const positionMode =
    String(
      settings.position_mode ??
        "detailed"
    );

  const formatLabel =
    leagueFormat === "dynasty"
      ? "NHL Dynasty"
      : "NHL Traditional Draft";

  const positionLabel =
    positionMode === "fdg"
      ? "F / D / G"
      : "C / LW / RW / D / G / UTIL";

  const myRosterRows =
    myFantasyTeamId === null
      ? []
      : rosters.filter(
          (row) =>
            Number(
              row.fantasy_team_id
            ) ===
            Number(myFantasyTeamId)
        );

  const rosterCount =
    myRosterRows.filter(
      (row) =>
        row.roster_status !== "ir"
    ).length;

  const irCount =
    myRosterRows.filter(
      (row) =>
        row.roster_status === "ir"
    ).length;

  const teamNameById =
    new Map<number, string>(
      teams.map((team) => [
        Number(team.id),
        String(
          team.team_name ?? "Team"
        ),
      ])
    );

  const currentMatchup =
    myFantasyTeamId === null
      ? null
      : matchups.find(
          (matchup) =>
            Number(matchup.week) ===
              activeWeek &&
            (
              Number(
                matchup.home_fantasy_team_id
              ) ===
                Number(
                  myFantasyTeamId
                ) ||
              Number(
                matchup.away_fantasy_team_id
              ) ===
                Number(
                  myFantasyTeamId
                )
            )
        ) ?? null;

  const isUserHomeTeam =
    currentMatchup
      ? Number(
          currentMatchup
            .home_fantasy_team_id
        ) ===
        Number(myFantasyTeamId)
      : false;

  const userPoints =
    currentMatchup
      ? Number(
          isUserHomeTeam
            ? currentMatchup
                .home_score ?? 0
            : currentMatchup
                .away_score ?? 0
        )
      : 0;

  const opponentPoints =
    currentMatchup
      ? Number(
          isUserHomeTeam
            ? currentMatchup
                .away_score ?? 0
            : currentMatchup
                .home_score ?? 0
        )
      : 0;

  const opponentTeamId =
    currentMatchup
      ? Number(
          isUserHomeTeam
            ? currentMatchup
                .away_fantasy_team_id
            : currentMatchup
                .home_fantasy_team_id
        )
      : null;

  const opponentName =
    opponentTeamId !== null
      ? teamNameById.get(
          opponentTeamId
        ) ?? "Opponent"
      : null;

  const myStanding =
    myFantasyTeamId === null
      ? null
      : standings.find(
          (standing) =>
            Number(
              standing.fantasy_team_id
            ) ===
            Number(
              myFantasyTeamId
            )
        ) ?? null;

  const seasonProgress =
    Math.min(
      100,
      Math.max(
        0,
        (
          activeWeek /
          Math.max(
            1,
            regularSeasonWeeks
          )
        ) *
          100
      )
    );

  const isCommissioner =
    Boolean(
      access.isCommissioner
    );

  return (
    <main
      className="g365-nhl-home-page"
      style={styles.page}
    >
      <style>{`
        @media (max-width: 760px) {
          .g365-nhl-home-page {
            padding: 18px 10px 44px !important;
            overflow-x: hidden !important;
          }

          .g365-nhl-home-shell {
            width: 100% !important;
            max-width: 100% !important;
            min-width: 0 !important;
          }

          .g365-nhl-home-header {
            grid-template-columns: 1fr !important;
            gap: 14px !important;
            align-items: stretch !important;
          }

          .g365-nhl-home-header-right {
            width: 100% !important;
            align-items: flex-start !important;
          }

          .g365-nhl-home-back-link {
            align-self: flex-start !important;
            min-height: 44px !important;
            padding: 0 14px !important;
          }

          .g365-nhl-home-statuses {
            display: grid !important;
            grid-template-columns: repeat(2,minmax(0,1fr)) !important;
            width: 100% !important;
          }

          .g365-nhl-home-status-box {
            min-width: 0 !important;
          }

          .g365-nhl-home-stats {
            grid-template-columns: repeat(2,minmax(0,1fr)) !important;
            gap: 8px !important;
          }

          .g365-nhl-home-dashboard {
            grid-template-columns: 1fr !important;
            gap: 10px !important;
          }

          .g365-nhl-home-card-heading {
            gap: 10px !important;
            align-items: flex-start !important;
          }

          .g365-nhl-home-matchup {
            grid-template-columns: minmax(0,1fr) auto minmax(0,1fr) !important;
            gap: 8px !important;
            padding: 14px 4px !important;
          }

          .g365-nhl-home-matchup > * {
            min-width: 0 !important;
          }

          .g365-nhl-home-summary-row {
            gap: 12px !important;
          }

          .g365-nhl-home-quick-grid {
            grid-template-columns: repeat(2,minmax(0,1fr)) !important;
          }

          .g365-nhl-home-title {
            font-size: 30px !important;
            overflow-wrap: anywhere !important;
          }

          .g365-nhl-home-quick-card {
            min-height: 86px !important;
            padding: 15px 13px !important;
          }

          /*
           * The universal mobile league header already provides
           * My Leagues + Navigate To. Keep these desktop shortcuts,
           * but do not duplicate navigation on phones.
           */
          .g365-nhl-home-back-link,
          .g365-nhl-home-league-center {
            display: none !important;
          }
        }

        @media (max-width: 430px) {
          .g365-nhl-home-statuses,
          .g365-nhl-home-stats,
          .g365-nhl-home-quick-grid {
            grid-template-columns: 1fr !important;
          }

          .g365-nhl-home-matchup {
            grid-template-columns: 1fr !important;
            text-align: center !important;
          }

          .g365-nhl-home-matchup > div {
            text-align: center !important;
            align-items: center !important;
          }

          .g365-nhl-home-card-heading {
            flex-direction: column !important;
            align-items: stretch !important;
          }

          .g365-nhl-home-card-heading a {
            align-self: flex-start !important;
            min-height: 40px !important;
            display: inline-flex !important;
            align-items: center !important;
          }

          .g365-nhl-home-progress-heading {
            gap: 8px !important;
          }

          .g365-nhl-home-title {
            font-size: 27px !important;
          }
        }
      `}</style>

      <section
        className="g365-nhl-home-shell"
        style={styles.shell}
      >
        <header
          className="g365-nhl-home-header"
          style={styles.pageHeader}
        >
          <div>
            <p style={styles.eyebrow}>
              {formatLabel.toUpperCase()}
            </p>

            <h1
              className="g365-nhl-home-title"
              style={styles.title}
            >
              {access.league.name}
            </h1>

            <p style={styles.subtitle}>
              {season}
              {" • "}
              {myTeamName}
            </p>
          </div>

          <div
            className="g365-nhl-home-header-right"
            style={styles.headerRight}
          >
            <Link
              href="/my-leagues"
              className="g365-nhl-home-back-link"
              style={styles.backToLeagues}
            >
              ← My Leagues
            </Link>

            <div
              className="g365-nhl-home-statuses"
              style={styles.headerStatusGroup}
            >
              <div
                className="g365-nhl-home-status-box"
                style={styles.statusBox}
              >
                <span style={styles.statusLabel}>
                  LEAGUE STATUS
                </span>

                <strong style={styles.statusValue}>
                  {formatStatus(
                    String(
                      access.league.status
                    )
                  )}
                </strong>
              </div>

              <div
                className="g365-nhl-home-status-box"
                style={styles.statusBox}
              >
                <span style={styles.statusLabel}>
                  CURRENT WEEK
                </span>

                <strong style={styles.statusValue}>
                  Week {activeWeek}
                </strong>
              </div>
            </div>
          </div>
        </header>

        <section
          className="g365-nhl-home-stats"
          style={styles.statsGrid}
        >
          <Card style={styles.statCard}>
            <span style={styles.statLabel}>
              MY TEAM
            </span>

            <strong style={styles.statValueSmall}>
              {myTeamName}
            </strong>

            <span style={styles.statSubtext}>
              {rosterCount}
              {" rostered player"}
              {rosterCount === 1 ? "" : "s"}
            </span>

            <Link
              href={`/league/${leagueId}/team`}
              style={styles.statLink}
            >
              Open My Team →
            </Link>
          </Card>

          <Card style={styles.statCard}>
            <span style={styles.statLabel}>
              LEAGUE SIZE
            </span>

            <strong style={styles.statValue}>
              {teams.length} / {maxTeams}
            </strong>

            <span style={styles.statSubtext}>
              {Math.max(
                0,
                maxTeams -
                  teams.length
              ) === 0
                ? "League is full"
                : `${Math.max(
                    0,
                    maxTeams -
                      teams.length
                  )} open spot${
                    Math.max(
                      0,
                      maxTeams -
                        teams.length
                    ) === 1
                      ? ""
                      : "s"
                  }`}
            </span>
          </Card>

          <Card style={styles.statCard}>
            <span style={styles.statLabel}>
              MY RECORD
            </span>

            <strong style={styles.statValueSmall}>
              {myStanding
                ? `${Number(
                    myStanding.wins ??
                      0
                  )}-${Number(
                    myStanding.losses ??
                      0
                  )}-${Number(
                    myStanding.ties ??
                      0
                  )}`
                : "0-0-0"}
            </strong>

            <span style={styles.statSubtext}>
              {myStanding?.rank
                ? `League rank #${myStanding.rank}`
                : "Standings begin with league play"}
            </span>
          </Card>

          <Card style={styles.statCard}>
            <span style={styles.statLabel}>
              ROSTER / IR
            </span>

            <strong style={styles.statValue}>
              {rosterCount} / {irCount}
            </strong>

            <span style={styles.statSubtext}>
              Active roster / IR
            </span>
          </Card>
        </section>

        <section
          className="g365-nhl-home-dashboard"
          style={styles.dashboardGrid}
        >
          <Card style={styles.mainCard}>
            <div
              aria-hidden="true"
              style={styles.cardAccent}
            />

            <div
              className="g365-nhl-home-card-heading"
              style={styles.cardHeading}
            >
              <div>
                <p style={styles.cardEyebrow}>
                  WEEK {activeWeek}
                </p>

                <h2 style={styles.cardTitle}>
                  Current Matchup
                </h2>
              </div>

              <Link
                href={`/league/${leagueId}/matchups`}
                style={styles.actionLink}
              >
                All Matchups
              </Link>
            </div>

            {currentMatchup ? (
              <div
                className="g365-nhl-home-matchup"
                style={styles.matchupPanel}
              >
                <div style={styles.matchupTeam}>
                  <span
                    style={styles.matchupLabel}
                  >
                    YOU
                  </span>

                  <strong
                    style={
                      styles.matchupTeamName
                    }
                  >
                    {myTeamName}
                  </strong>

                  <strong
                    style={
                      styles.matchupScore
                    }
                  >
                    {formatPoints(
                      userPoints
                    )}
                  </strong>
                </div>

                <div
                  style={styles.matchupCenter}
                >
                  <span
                    style={
                      String(
                        currentMatchup.status
                      ) === "live"
                        ? styles.liveBadge
                        : String(
                              currentMatchup.status
                            ) ===
                            "final"
                          ? styles.finalBadge
                          : styles.upcomingBadge
                    }
                  >
                    {String(
                      currentMatchup.status
                    ).toUpperCase()}
                  </span>

                  <span style={styles.vsLabel}>
                    VS
                  </span>
                </div>

                <div style={styles.matchupTeam}>
                  <span
                    style={styles.matchupLabel}
                  >
                    OPPONENT
                  </span>

                  <strong
                    style={
                      styles.matchupTeamName
                    }
                  >
                    {opponentName}
                  </strong>

                  <strong
                    style={
                      styles.matchupScore
                    }
                  >
                    {formatPoints(
                      opponentPoints
                    )}
                  </strong>
                </div>
              </div>
            ) : (
              <div style={styles.emptyFeature}>
                <strong>
                  No Week {activeWeek}{" "}
                  matchup available
                </strong>

                <span>
                  Your NHL matchup will
                  appear here when the
                  league schedule is
                  generated.
                </span>
              </div>
            )}
          </Card>

          <Card style={styles.mainCard}>
            <div
              aria-hidden="true"
              style={
                styles.cardAccentOrange
              }
            />

            <div
              className="g365-nhl-home-card-heading"
              style={styles.cardHeading}
            >
              <div>
                <p style={styles.cardEyebrow}>
                  YOUR TEAM
                </p>

                <h2 style={styles.cardTitle}>
                  Team Headquarters
                </h2>
              </div>

              <Link
                href={`/league/${leagueId}/team`}
                style={styles.actionLink}
              >
                Open Team
              </Link>
            </div>

            <div style={styles.teamSummary}>
              <SummaryRow
                label="Team"
                value={myTeamName}
              />

              <SummaryRow
                label="Rostered Players"
                value={String(
                  rosterCount
                )}
              />

              <SummaryRow
                label="IR Players"
                value={String(irCount)}
              />

              <SummaryRow
                label="Role"
                value={
                  isCommissioner
                    ? "Commissioner"
                    : "League Member"
                }
              />
            </div>
          </Card>

          <Card style={styles.mainCard}>
            <div
              className="g365-nhl-home-card-heading"
              style={styles.cardHeading}
            >
              <div>
                <p style={styles.cardEyebrow}>
                  SEASON
                </p>

                <h2 style={styles.cardTitle}>
                  League Progress
                </h2>
              </div>

              <Link
                href={`/league/${leagueId}/standings`}
                style={styles.actionLink}
              >
                Standings
              </Link>
            </div>

            <div style={styles.progressArea}>
              <div
                className="g365-nhl-home-progress-heading"
                style={
                  styles.progressHeading
                }
              >
                <span>
                  Week {activeWeek}
                </span>

                <span>
                  {regularSeasonWeeks}{" "}
                  Weeks
                </span>
              </div>

              <div
                style={
                  styles.progressTrack
                }
              >
                <div
                  style={{
                    ...styles.progressFill,
                    width:
                      `${seasonProgress}%`,
                  }}
                />
              </div>

              <SummaryRow
                label="Phase"
                value={formatStatus(
                  String(
                    seasonState.phase ??
                      "preseason"
                  )
                )}
              />

              <SummaryRow
                label="Playoffs"
                value={
                  seasonState.playoffs_started
                    ? "Active"
                    : "Not Started"
                }
              />

              <SummaryRow
                label="Playoff Teams"
                value={String(
                  settings.playoff_team_count ??
                    6
                )}
              />
            </div>
          </Card>

          <Card style={styles.mainCard}>
            <div
              className="g365-nhl-home-card-heading"
              style={styles.cardHeading}
            >
              <div>
                <p style={styles.cardEyebrow}>
                  NHL LEAGUE
                </p>

                <h2 style={styles.cardTitle}>
                  League Overview
                </h2>
              </div>

              {isCommissioner ? (
                <Link
                  href={`/league/${leagueId}/nhl/commissioner`}
                  style={
                    styles.actionLink
                  }
                >
                  Commissioner
                </Link>
              ) : null}
            </div>

            <div style={styles.teamSummary}>
              <SummaryRow
                label="Format"
                value={
                  leagueFormat ===
                  "dynasty"
                    ? "Dynasty"
                    : "Redraft"
                }
              />

              <SummaryRow
                label="Positions"
                value={positionLabel}
              />

              <SummaryRow
                label="Lineups"
                value="Daily Changes"
              />

              <SummaryRow
                label="Player Lock"
                value="Individual Game"
              />
            </div>
          </Card>
        </section>

        <section className="g365-nhl-home-league-center">
          <p style={styles.sectionLabel}>
            NHL LEAGUE CENTER
          </p>

          <div
            className="g365-nhl-home-quick-grid"
            style={styles.quickGrid}
          >
            <QuickLink
              href={`/league/${leagueId}/team`}
              title="My Team"
              subtitle="Daily roster & lineup"
            />

            <QuickLink
              href={`/league/${leagueId}/players`}
              title="Players"
              subtitle="NHL player pool"
            />

            <QuickLink
              href={`/league/${leagueId}/matchups`}
              title="Matchups"
              subtitle="Weekly H2H scoring"
            />

            <QuickLink
              href={`/league/${leagueId}/waivers`}
              title="Waivers"
              subtitle="Claims & free agents"
            />

            <QuickLink
              href={`/league/${leagueId}/trades`}
              title="Trades"
              subtitle="Trade center"
            />

            <QuickLink
              href={`/league/${leagueId}/standings`}
              title="Standings"
              subtitle="League rankings"
            />

            <QuickLink
              href={`/league/${leagueId}/playoffs`}
              title="Playoffs"
              subtitle="Bracket & seeds"
            />

            <QuickLink
              href={`/league/${leagueId}/draft`}
              title={
                leagueFormat ===
                "dynasty"
                  ? "Dynasty Draft"
                  : "Draft"
              }
              subtitle={
                leagueFormat ===
                "dynasty"
                  ? "Draft picks & draft room"
                  : "NHL draft center"
              }
            />

            {leagueFormat === "dynasty" ? (
              <QuickLink
                href={`/league/${leagueId}/nhl/draft-lottery`}
                title="Draft Lottery"
                subtitle="Live lottery & official draft order"
              />
            ) : null}

            {leagueFormat ===
            "dynasty" ? (
              <QuickLink
                href={`/league/${leagueId}/dynasty`}
                title="Dynasty"
                subtitle="Keepers & future picks"
              />
            ) : null}

            {isCommissioner ? (
              <QuickLink
                href={`/league/${leagueId}/nhl/commissioner`}
                title="Commissioner"
                subtitle="League controls"
              />
            ) : null}
          </div>
        </section>
      </section>
    </main>
  );
}

function SummaryRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div
      className="g365-nhl-home-summary-row"
      style={styles.summaryRow}
    >
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function QuickLink({
  href,
  title,
  subtitle,
}: {
  href: string;
  title: string;
  subtitle: string;
}) {
  return (
    <Link
      href={href}
      className="g365-nhl-home-quick-card"
      style={styles.quickCard}
    >
      <strong>{title}</strong>

      <span
        style={
          styles.quickSubtitle
        }
      >
        {subtitle}
      </span>
    </Link>
  );
}

const styles = {
  page: {
    minHeight:
      "calc(100vh - 140px)",

    padding:
      "32px 18px 60px",

    background:
      "radial-gradient(circle at 50% 0%,rgba(255,67,0,.055),transparent 34%)",
  },

  shell: {
    width:
      "min(1240px,100%)",

    margin:
      "0 auto",

    display:
      "grid",

    gap:
      "28px",
  },

  pageHeader: {
    display:
      "flex",

    alignItems:
      "flex-end",

    justifyContent:
      "space-between",

    gap:
      "20px",

    flexWrap:
      "wrap" as const,
  },

  headerRight: {
    display:
      "flex",

    flexDirection:
      "column" as const,

    alignItems:
      "flex-end",

    gap:
      "10px",
  },

  backToLeagues: {
    minHeight:
      "40px",

    display:
      "inline-flex",

    alignItems:
      "center",

    justifyContent:
      "center",

    padding:
      "0 12px",

    border:
      "1px solid rgba(255,122,24,.35)",

    borderRadius:
      "8px",

    background:
      "rgba(255,90,20,.07)",

    color:
      "#ff8a3d",

    fontSize:
      "10px",

    fontWeight:
      900,

    letterSpacing:
      ".05em",

    textDecoration:
      "none",

    textTransform:
      "uppercase" as const,

    whiteSpace:
      "nowrap" as const,
  },

  headerStatusGroup: {
    display:
      "flex",

    gap:
      "9px",

    flexWrap:
      "wrap" as const,
  },

  eyebrow: {
    margin:
      0,

    color:
      "#ff7a18",

    fontSize:
      "10px",

    fontWeight:
      900,

    letterSpacing:
      ".15em",
  },

  title: {
    margin:
      "7px 0 0",

    color:
      "#ffffff",

    fontSize:
      "36px",
  },

  subtitle: {
    margin:
      "8px 0 0",

    color:
      "#8f96a3",

    fontSize:
      "13px",
  },

  statusBox: {
    minWidth:
      "140px",

    padding:
      "12px 15px",

    display:
      "grid",

    gap:
      "4px",

    border:
      "1px solid rgba(255,140,0,.18)",

    borderRadius:
      "10px",

    background:
      "rgba(255,100,0,.05)",
  },

  statusLabel: {
    color:
      "#747a84",

    fontSize:
      "8px",

    fontWeight:
      900,

    letterSpacing:
      ".10em",
  },

  statusValue: {
    color:
      "#ff8c00",

    fontSize:
      "13px",
  },

  statsGrid: {
    display:
      "grid",

    gridTemplateColumns:
      "repeat(auto-fit,minmax(190px,1fr))",

    gap:
      "14px",
  },

  statCard: {
    minHeight:
      "145px",

    padding:
      "20px",

    display:
      "flex",

    flexDirection:
      "column" as const,

    gap:
      "8px",
  },

  statLabel: {
    color:
      "#757b85",

    fontSize:
      "9px",

    fontWeight:
      900,

    letterSpacing:
      ".10em",
  },

  statValue: {
    color:
      "#ffffff",

    fontSize:
      "29px",
  },

  statValueSmall: {
    color:
      "#ffffff",

    fontSize:
      "18px",

    lineHeight:
      1.25,
  },

  statSubtext: {
    color:
      "#858b95",

    fontSize:
      "11px",
  },

  statLink: {
    marginTop:
      "auto",

    color:
      "#ff7a18",

    fontSize:
      "10px",

    fontWeight:
      900,

    textDecoration:
      "none",
  },

  dashboardGrid: {
    display:
      "grid",

    gridTemplateColumns:
      "repeat(auto-fit,minmax(360px,1fr))",

    gap:
      "16px",
  },

  mainCard: {
    minHeight:
      "285px",

    padding:
      "23px",
  },

  cardAccent: {
    position:
      "absolute" as const,

    top:
      0,

    left:
      0,

    right:
      0,

    height:
      "3px",

    background:
      "linear-gradient(90deg,#e21d1d,#ff4500,#ff7700)",
  },

  cardAccentOrange: {
    position:
      "absolute" as const,

    top:
      0,

    left:
      0,

    right:
      0,

    height:
      "3px",

    background:
      "linear-gradient(90deg,#ff4500,#ff8c00)",
  },

  cardHeading: {
    display:
      "flex",

    alignItems:
      "flex-start",

    justifyContent:
      "space-between",

    gap:
      "16px",
  },

  cardEyebrow: {
    margin:
      0,

    color:
      "#ff8c00",

    fontSize:
      "8px",

    fontWeight:
      900,

    letterSpacing:
      ".11em",
  },

  cardTitle: {
    margin:
      "5px 0 0",

    color:
      "#ffffff",

    fontSize:
      "20px",
  },

  actionLink: {
    minHeight:
      "36px",

    display:
      "inline-flex",

    alignItems:
      "center",

    color:
      "#ff7a18",

    fontSize:
      "10px",

    fontWeight:
      900,

    textDecoration:
      "none",
  },

  matchupPanel: {
    marginTop:
      "24px",

    minHeight:
      "165px",

    display:
      "grid",

    gridTemplateColumns:
      "minmax(0,1fr) 70px minmax(0,1fr)",

    alignItems:
      "center",

    gap:
      "14px",
  },

  matchupTeam: {
    minWidth:
      0,

    display:
      "grid",

    justifyItems:
      "center",

    gap:
      "8px",

    textAlign:
      "center" as const,
  },

  matchupLabel: {
    color:
      "#707680",

    fontSize:
      "8px",

    fontWeight:
      900,

    letterSpacing:
      ".11em",
  },

  matchupTeamName: {
    maxWidth:
      "100%",

    overflow:
      "hidden",

    textOverflow:
      "ellipsis",

    whiteSpace:
      "nowrap" as const,

    color:
      "#ffffff",

    fontSize:
      "14px",
  },

  matchupScore: {
    color:
      "#ffffff",

    fontSize:
      "34px",

    lineHeight:
      1,
  },

  matchupCenter: {
    display:
      "grid",

    justifyItems:
      "center",

    gap:
      "9px",
  },

  vsLabel: {
    color:
      "#626872",

    fontSize:
      "10px",

    fontWeight:
      900,
  },

  liveBadge: {
    padding:
      "5px 7px",

    borderRadius:
      "5px",

    background:
      "rgba(38,190,105,.12)",

    color:
      "#42d982",

    fontSize:
      "8px",

    fontWeight:
      950,

    letterSpacing:
      ".08em",
  },

  finalBadge: {
    padding:
      "5px 7px",

    borderRadius:
      "5px",

    background:
      "rgba(255,255,255,.06)",

    color:
      "#a5aab1",

    fontSize:
      "8px",

    fontWeight:
      950,

    letterSpacing:
      ".08em",
  },

  upcomingBadge: {
    padding:
      "5px 7px",

    borderRadius:
      "5px",

    background:
      "rgba(255,119,0,.09)",

    color:
      "#ff8a20",

    fontSize:
      "8px",

    fontWeight:
      950,

    letterSpacing:
      ".08em",
  },

  emptyFeature: {
    minHeight:
      "165px",

    marginTop:
      "20px",

    padding:
      "22px",

    display:
      "grid",

    alignContent:
      "center",

    gap:
      "7px",

    border:
      "1px dashed rgba(255,255,255,.10)",

    borderRadius:
      "10px",

    color:
      "#ffffff",
  },

  teamSummary: {
    display:
      "grid",

    marginTop:
      "18px",
  },

  summaryRow: {
    minHeight:
      "45px",

    display:
      "flex",

    alignItems:
      "center",

    justifyContent:
      "space-between",

    gap:
      "20px",

    borderBottom:
      "1px solid rgba(255,255,255,.06)",

    color:
      "#8f96a3",

    fontSize:
      "11px",
  },

  progressArea: {
    marginTop:
      "20px",

    display:
      "grid",

    gap:
      "12px",
  },

  progressHeading: {
    display:
      "flex",

    alignItems:
      "center",

    justifyContent:
      "space-between",

    color:
      "#8f96a3",

    fontSize:
      "10px",

    fontWeight:
      800,
  },

  progressTrack: {
    width:
      "100%",

    height:
      "8px",

    overflow:
      "hidden",

    borderRadius:
      "999px",

    background:
      "rgba(255,255,255,.07)",
  },

  progressFill: {
    height:
      "100%",

    borderRadius:
      "999px",

    background:
      "linear-gradient(90deg,#d71919,#ff4d00,#ff8a00)",
  },

  sectionLabel: {
    margin:
      "0 0 11px",

    color:
      "#707681",

    fontSize:
      "9px",

    fontWeight:
      900,

    letterSpacing:
      ".12em",
  },

  quickGrid: {
    display:
      "grid",

    gridTemplateColumns:
      "repeat(auto-fit,minmax(155px,1fr))",

    gap:
      "11px",
  },

  quickCard: {
    minHeight:
      "82px",

    padding:
      "16px",

    display:
      "grid",

    alignContent:
      "center",

    gap:
      "5px",

    border:
      "1px solid rgba(255,255,255,.08)",

    borderRadius:
      "10px",

    background:
      "linear-gradient(145deg,#151515,#090909)",

    color:
      "#ffffff",

    textDecoration:
      "none",
  },

  quickSubtitle: {
    color:
      "#777e88",

    fontSize:
      "10px",
  },
};