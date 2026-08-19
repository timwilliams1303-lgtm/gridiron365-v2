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


type PageProps = {
  params:
    Promise<{
      leagueId: string;
    }>;
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


export default async function LeagueHomePage({
  params,
}: PageProps) {
  const {
    leagueId,
  } =
    await params;


  const access =
    await requireTraditionalLeague(
      leagueId
    );


  const supabase =
    await createSupabaseServerClient();


  const homeData =
    await getTraditionalHomeData(
      supabase,
      leagueId
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

            <Link
              href={
                `/league/${leagueId}/team`
              }
              style={
                styles.statLink
              }
            >
              View My Team →
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
              TEAMS
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
              REGULAR SEASON
            </span>

            <strong
              style={
                styles.statValue
              }
            >
              {homeData.regularSeasonWeeks}
            </strong>

            <span
              style={
                styles.statSubtext
              }
            >
              weeks
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
              ROLE
            </span>

            <strong
              style={
                styles.statValueSmall
              }
            >
              {access.isCommissioner
                ? "Commissioner"
                : "League Member"}
            </strong>

            {access.isCommissioner ? (
              <Link
                href={
                  `/league/${leagueId}/commissioner`
                }
                style={
                  styles.statLink
                }
              >
                Commissioner Tools →
              </Link>
            ) : null}
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
                Open My Team
              </Link>
            </div>


            <div
              style={
                styles.emptyFeature
              }
            >
              <strong>
                {access.fantasyTeam
                  ?.teamName ??
                  "Your Team"}
              </strong>

              <span>
                Your roster and weekly lineup will appear here
                once we complete the My Team system.
              </span>
            </div>
          </Card>


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
                  LEAGUE
                </p>

                <h2
                  style={
                    styles.cardTitle
                  }
                >
                  League Setup
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
                styles.setupList
              }
            >
              <div
                style={
                  styles.setupRow
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
                  styles.setupRow
                }
              >
                <span>
                  Regular Season
                </span>

                <strong>
                  {homeData.regularSeasonWeeks}
                  {" Weeks"}
                </strong>
              </div>


              <div
                style={
                  styles.setupRow
                }
              >
                <span>
                  Draft
                </span>

                <strong
                  style={
                    styles.pendingValue
                  }
                >
                  Setup
                </strong>
              </div>


              <div
                style={
                  styles.setupRow
                }
              >
                <span>
                  Scoring
                </span>

                <strong
                  style={
                    styles.pendingValue
                  }
                >
                  Setup
                </strong>
              </div>


              <div
                style={
                  styles.setupRow
                }
              >
                <span>
                  Playoffs
                </span>

                <strong
                  style={
                    styles.pendingValue
                  }
                >
                  Setup
                </strong>
              </div>
            </div>
          </Card>


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
                  MATCHUPS
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
                Matchups
              </Link>
            </div>


            <div
              style={
                styles.emptyFeature
              }
            >
              <strong>
                No matchup yet
              </strong>

              <span>
                Your active matchup will appear here once the
                matchup and scoring systems are completed.
              </span>
            </div>
          </Card>


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
                  LEAGUE ACTIVITY
                </p>

                <h2
                  style={
                    styles.cardTitle
                  }
                >
                  Latest Activity
                </h2>
              </div>

              <Link
                href={
                  `/league/${leagueId}/waivers`
                }
                style={
                  styles.actionLink
                }
              >
                Players
              </Link>
            </div>


            <div
              style={
                styles.emptyFeature
              }
            >
              <strong>
                No transactions yet
              </strong>

              <span>
                Adds, drops, waivers, and trades will appear here
                after those systems are built.
              </span>
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
            QUICK LINKS
          </p>

          <div
            style={
              styles.quickGrid
            }
          >
            <Link
              href={
                `/league/${leagueId}/team`
              }
              style={
                styles.quickCard
              }
            >
              <strong>
                My Team
              </strong>

              <span>
                Roster & lineup
              </span>
            </Link>


            <Link
              href={
                `/league/${leagueId}/players`
              }
              style={
                styles.quickCard
              }
            >
              <strong>
                Players
              </strong>

              <span>
                NFL player pool
              </span>
            </Link>


            <Link
              href={
                `/league/${leagueId}/waivers`
              }
              style={
                styles.quickCard
              }
            >
              <strong>
                Waivers
              </strong>

              <span>
                Claims & free agents
              </span>
            </Link>


            <Link
              href={
                `/league/${leagueId}/trades`
              }
              style={
                styles.quickCard
              }
            >
              <strong>
                Trades
              </strong>

              <span>
                Trade center
              </span>
            </Link>


            <Link
              href={
                `/league/${leagueId}/standings`
              }
              style={
                styles.quickCard
              }
            >
              <strong>
                Standings
              </strong>

              <span>
                League rankings
              </span>
            </Link>


            <Link
              href={
                `/league/${leagueId}/playoffs`
              }
              style={
                styles.quickCard
              }
            >
              <strong>
                Playoffs
              </strong>

              <span>
                Bracket & seeds
              </span>
            </Link>
          </div>
        </section>
      </section>
    </main>
  );
}


const styles = {
  page: {
    minHeight:
      "calc(100vh - 140px)",

    padding:
      "32px 18px 60px",
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

  eyebrow: {
    margin: 0,

    color:
      "#ff8c00",

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
      "150px",

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
      "140px",

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
      "265px",

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
      "linear-gradient(90deg,#ff1e1e,#ff4500)",
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

  emptyFeature: {
    minHeight:
      "150px",

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

  setupList: {
    display:
      "grid",

    marginTop:
      "17px",
  },

  setupRow: {
    minHeight:
      "39px",

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

  pendingValue: {
    color:
      "#ff8c00",
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
};