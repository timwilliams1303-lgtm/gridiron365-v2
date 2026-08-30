import Link from "next/link";

import Card from "@/components/ui/Card";

import {
  createSupabaseServerClient,
} from "@/lib/supabase/server";

import {
  getTraditionalHomeData,
} from "@/lib/traditional/home.service";

import {
  requireTraditionalLeague,
} from "@/lib/traditional/requireTraditionalLeague";


type TraditionalLeagueHomeProps = {
  leagueId: string;
};


function formatStatus(
  status: string
) {
  return status
    .replaceAll(
      "_",
      " "
    )
    .replace(
      /\b\w/g,
      (
        character
      ) =>
        character.toUpperCase()
    );
}


function formatPoints(
  points: number
) {
  return points
    .toFixed(2);
}


export default async function TraditionalLeagueHome({
  leagueId,
}: TraditionalLeagueHomeProps) {


  const access =
    await requireTraditionalLeague(
      leagueId
    );


  const supabase =
    await createSupabaseServerClient();


  const homeData =
    await getTraditionalHomeData(
      supabase,
      leagueId,
      access.league.season,
      access.fantasyTeam
        ?.id ??
        null
    );


  const matchup =
    homeData.currentMatchup;


  const userPoints =
    matchup
      ? matchup.isUserHomeTeam
        ? matchup.homePoints
        : matchup.awayPoints
      : 0;


  const opponentPoints =
    matchup
      ? matchup.isUserHomeTeam
        ? matchup.awayPoints
        : matchup.homePoints
      : 0;


  const opponentName =
    matchup
      ? matchup.isUserHomeTeam
        ? matchup.awayTeamName
        : matchup.homeTeamName
      : null;


  const seasonProgress =
    Math.min(
      100,
      Math.max(
        0,
        (
          homeData.activeWeek /
          Math.max(
            1,
            homeData
              .regularSeasonWeeks
          )
        ) *
          100
      )
    );


  return (
    <main
      style={
        styles.page
      }
    >
      <section
        style={
          styles.shell
        }
      >
        {/* =========================================
            PAGE HEADER
        ========================================== */}

        <header
          style={
            styles.pageHeader
          }
        >
          <div>
            <p
              style={
                styles.eyebrow
              }
            >
              TRADITIONAL LEAGUE
            </p>

            <h1
              style={
                styles.title
              }
            >
              {access.league.name}
            </h1>

            <p
              style={
                styles.subtitle
              }
            >
              {access.league.season}

              {" • "}

              {access.fantasyTeam
                ?.teamName ??
                "No Team Assigned"}
            </p>
          </div>


          <div
            style={
              styles.headerStatusGroup
            }
          >
            <div
              style={
                styles.statusBox
              }
            >
              <span
                style={
                  styles.statusLabel
                }
              >
                LEAGUE STATUS
              </span>

              <strong
                style={
                  styles.statusValue
                }
              >
                {formatStatus(
                  access.league.status
                )}
              </strong>
            </div>


            <div
              style={
                styles.statusBox
              }
            >
              <span
                style={
                  styles.statusLabel
                }
              >
                CURRENT WEEK
              </span>

              <strong
                style={
                  styles.statusValue
                }
              >
                Week{" "}
                {homeData.activeWeek}
              </strong>
            </div>
          </div>
        </header>


        {/* =========================================
            QUICK STATS
        ========================================== */}

        <section
          style={
            styles.statsGrid
          }
        >
          <Card
            style={
              styles.statCard
            }
          >
            <span
              style={
                styles.statLabel
              }
            >
              MY TEAM
            </span>

            <strong
              style={
                styles.statValueSmall
              }
            >
              {access.fantasyTeam
                ?.teamName ??
                "Not Assigned"}
            </strong>

            <span
              style={
                styles.statSubtext
              }
            >
              {homeData.rosterCount}
              {" rostered player"}
              {homeData.rosterCount ===
              1
                ? ""
                : "s"}
            </span>

            <Link
              href={
                `/league/${leagueId}/team`
              }
              style={
                styles.statLink
              }
            >
              Open My Team →
            </Link>
          </Card>


          <Card
            style={
              styles.statCard
            }
          >
            <span
              style={
                styles.statLabel
              }
            >
              LEAGUE SIZE
            </span>

            <strong
              style={
                styles.statValue
              }
            >
              {homeData.teamCount}
              {" / "}
              {homeData.maxTeams}
            </strong>

            <span
              style={
                styles.statSubtext
              }
            >
              {homeData.openTeamSpots ===
              0
                ? "League is full"
                : `${homeData.openTeamSpots} open spot${homeData.openTeamSpots === 1 ? "" : "s"}`}
            </span>
          </Card>


          <Card
            style={
              styles.statCard
            }
          >
            <span
              style={
                styles.statLabel
              }
            >
              SEASON
            </span>

            <strong
              style={
                styles.statValue
              }
            >
              {homeData.activeWeek}
              {" / "}
              {homeData
                .regularSeasonWeeks}
            </strong>

            <span
              style={
                styles.statSubtext
              }
            >
              Regular-season week
            </span>
          </Card>


          <Card
            style={
              styles.statCard
            }
          >
            <span
              style={
                styles.statLabel
              }
            >
              ROSTER HEALTH
            </span>

            <strong
              style={{
                ...styles.statValue,

                ...(homeData
                  .injuredRosterPlayers >
                0
                  ? styles.warningValue
                  : styles.goodValue),
              }}
            >
              {homeData
                .injuredRosterPlayers}
            </strong>

            <span
              style={
                styles.statSubtext
              }
            >
              active injury
              {homeData
                .injuredRosterPlayers ===
              1
                ? ""
                : " alerts"}
            </span>
          </Card>
        </section>


        {/* =========================================
            MAIN DASHBOARD
        ========================================== */}

        <section
          style={
            styles.dashboardGrid
          }
        >
          {/* CURRENT MATCHUP */}

          <Card
            style={
              styles.mainCard
            }
          >
            <div
              aria-hidden="true"
              style={
                styles.cardAccent
              }
            />

            <div
              style={
                styles.cardHeading
              }
            >
              <div>
                <p
                  style={
                    styles.cardEyebrow
                  }
                >
                  WEEK{" "}
                  {homeData.activeWeek}
                </p>

                <h2
                  style={
                    styles.cardTitle
                  }
                >
                  Current Matchup
                </h2>
              </div>

              <Link
                href={
                  `/league/${leagueId}/matchups`
                }
                style={
                  styles.actionLink
                }
              >
                All Matchups
              </Link>
            </div>


            {matchup ? (
              <div
                style={
                  styles.matchupPanel
                }
              >
                <div
                  style={
                    styles.matchupTeam
                  }
                >
                  <span
                    style={
                      styles.matchupLabel
                    }
                  >
                    YOU
                  </span>

                  <strong
                    style={
                      styles.matchupTeamName
                    }
                  >
                    {access
                      .fantasyTeam
                      ?.teamName ??
                      "Your Team"}
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
                  style={
                    styles.matchupCenter
                  }
                >
                  <span
                    style={
                      matchup.isLive
                        ? styles.liveBadge
                        : matchup.isFinal
                          ? styles.finalBadge
                          : styles.upcomingBadge
                    }
                  >
                    {matchup.isLive
                      ? "LIVE"
                      : matchup.isFinal
                        ? "FINAL"
                        : "UPCOMING"}
                  </span>

                  <span
                    style={
                      styles.vsLabel
                    }
                  >
                    VS
                  </span>
                </div>


                <div
                  style={
                    styles.matchupTeam
                  }
                >
                  <span
                    style={
                      styles.matchupLabel
                    }
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
              <div
                style={
                  styles.emptyFeature
                }
              >
                <strong>
                  No Week{" "}
                  {homeData.activeWeek}{" "}
                  matchup available
                </strong>

                <span>
                  Your matchup will appear
                  here when one is scheduled
                  for your fantasy team.
                </span>
              </div>
            )}
          </Card>


          {/* TEAM HEADQUARTERS */}

          <Card
            style={
              styles.mainCard
            }
          >
            <div
              aria-hidden="true"
              style={
                styles.cardAccentOrange
              }
            />

            <div
              style={
                styles.cardHeading
              }
            >
              <div>
                <p
                  style={
                    styles.cardEyebrow
                  }
                >
                  YOUR TEAM
                </p>

                <h2
                  style={
                    styles.cardTitle
                  }
                >
                  Team Headquarters
                </h2>
              </div>

              <Link
                href={
                  `/league/${leagueId}/team`
                }
                style={
                  styles.actionLink
                }
              >
                Open Team
              </Link>
            </div>


            <div
              style={
                styles.teamSummary
              }
            >
              <div
                style={
                  styles.summaryRow
                }
              >
                <span>
                  Team
                </span>

                <strong>
                  {access.fantasyTeam
                    ?.teamName ??
                    "Not Assigned"}
                </strong>
              </div>


              <div
                style={
                  styles.summaryRow
                }
              >
                <span>
                  Rostered Players
                </span>

                <strong>
                  {homeData.rosterCount}
                </strong>
              </div>


              <div
                style={
                  styles.summaryRow
                }
              >
                <span>
                  Injury Alerts
                </span>

                <strong
                  style={
                    homeData
                      .injuredRosterPlayers >
                    0
                      ? styles.warningValue
                      : styles.goodValue
                  }
                >
                  {homeData
                    .injuredRosterPlayers}
                </strong>
              </div>


              <div
                style={
                  styles.summaryRow
                }
              >
                <span>
                  Role
                </span>

                <strong>
                  {access.isCommissioner
                    ? "Commissioner"
                    : "League Member"}
                </strong>
              </div>
            </div>
          </Card>


          {/* SEASON PROGRESS */}

          <Card
            style={
              styles.mainCard
            }
          >
            <div
              style={
                styles.cardHeading
              }
            >
              <div>
                <p
                  style={
                    styles.cardEyebrow
                  }
                >
                  SEASON
                </p>

                <h2
                  style={
                    styles.cardTitle
                  }
                >
                  League Progress
                </h2>
              </div>

              <Link
                href={
                  `/league/${leagueId}/standings`
                }
                style={
                  styles.actionLink
                }
              >
                Standings
              </Link>
            </div>


            <div
              style={
                styles.progressArea
              }
            >
              <div
                style={
                  styles.progressHeading
                }
              >
                <span>
                  Week{" "}
                  {homeData.activeWeek}
                </span>

                <span>
                  {homeData
                    .regularSeasonWeeks}{" "}
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


              <div
                style={
                  styles.summaryRow
                }
              >
                <span>
                  Phase
                </span>

                <strong>
                  {formatStatus(
                    homeData.phase
                  )}
                </strong>
              </div>


              <div
                style={
                  styles.summaryRow
                }
              >
                <span>
                  Last Completed Week
                </span>

                <strong>
                  {homeData
                    .lastCompletedWeek ??
                    "—"}
                </strong>
              </div>


              <div
                style={
                  styles.summaryRow
                }
              >
                <span>
                  Playoffs
                </span>

                <strong>
                  {homeData.playoffsStarted
                    ? "Active"
                    : "Not Started"}
                </strong>
              </div>
            </div>
          </Card>


          {/* LEAGUE SETUP */}

          <Card
            style={
              styles.mainCard
            }
          >
            <div
              style={
                styles.cardHeading
              }
            >
              <div>
                <p
                  style={
                    styles.cardEyebrow
                  }
                >
                  LEAGUE
                </p>

                <h2
                  style={
                    styles.cardTitle
                  }
                >
                  League Overview
                </h2>
              </div>

              <Link
                href={
                  `/league/${leagueId}/settings`
                }
                style={
                  styles.actionLink
                }
              >
                Settings
              </Link>
            </div>


            <div
              style={
                styles.teamSummary
              }
            >
              <div
                style={
                  styles.summaryRow
                }
              >
                <span>
                  Teams
                </span>

                <strong>
                  {homeData.teamCount}
                  {" / "}
                  {homeData.maxTeams}
                </strong>
              </div>


              <div
                style={
                  styles.summaryRow
                }
              >
                <span>
                  Regular Season
                </span>

                <strong>
                  {homeData
                    .regularSeasonWeeks}{" "}
                  Weeks
                </strong>
              </div>


              <div
                style={
                  styles.summaryRow
                }
              >
                <span>
                  Player Selection
                </span>

                <strong>
                  {formatStatus(
                    access.league
                      .playerSelectionMode
                  )}
                </strong>
              </div>


              <div
                style={
                  styles.summaryRow
                }
              >
                <span>
                  League Status
                </span>

                <strong
                  style={
                    styles.orangeValue
                  }
                >
                  {formatStatus(
                    access.league.status
                  )}
                </strong>
              </div>
            </div>
          </Card>
        </section>


        {/* =========================================
            QUICK LINKS
        ========================================== */}

        <section>
          <p
            style={
              styles.sectionLabel
            }
          >
            LEAGUE CENTER
          </p>


          <div
            style={
              styles.quickGrid
            }
          >
            <QuickLink
              href={
                `/league/${leagueId}/team`
              }
              title="My Team"
              subtitle="Roster & lineup"
            />

            <QuickLink
              href={
                `/league/${leagueId}/players`
              }
              title="Players"
              subtitle="NFL player pool"
            />

            <QuickLink
              href={
                `/league/${leagueId}/matchups`
              }
              title="Matchups"
              subtitle="Weekly scoring"
            />

            <QuickLink
              href={
                `/league/${leagueId}/waivers`
              }
              title="Waivers"
              subtitle="Claims & free agents"
            />

            <QuickLink
              href={
                `/league/${leagueId}/trades`
              }
              title="Trades"
              subtitle="Trade center"
            />

            <QuickLink
              href={
                `/league/${leagueId}/standings`
              }
              title="Standings"
              subtitle="League rankings"
            />

            <QuickLink
              href={
                `/league/${leagueId}/playoffs`
              }
              title="Playoffs"
              subtitle="Bracket & seeds"
            />

            <QuickLink
              href={
                `/league/${leagueId}/draft`
              }
              title="Draft"
              subtitle="Draft center"
            />

            {access.isCommissioner ? (
              <QuickLink
                href={
                  `/league/${leagueId}/commissioner`
                }
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
      href={
        href
      }
      style={
        styles.quickCard
      }
    >
      <strong>
        {title}
      </strong>

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


  headerStatusGroup: {
    display:
      "flex",

    gap:
      "9px",

    flexWrap:
      "wrap" as const,
  },


  eyebrow: {
    margin: 0,

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

    top: 0,

    left: 0,

    right: 0,

    height:
      "3px",

    background:
      "linear-gradient(90deg,#e21d1d,#ff4500,#ff7700)",
  },


  cardAccentOrange: {
    position:
      "absolute" as const,

    top: 0,

    left: 0,

    right: 0,

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
    margin: 0,

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


  warningValue: {
    color:
      "#ff8a20",
  },


  goodValue: {
    color:
      "#42d982",
  },


  orangeValue: {
    color:
      "#ff8a20",
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