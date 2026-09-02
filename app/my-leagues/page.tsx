import Image from "next/image";
import Link from "next/link";

import Card from "@/components/ui/Card";
import LogoutButton from "@/components/auth/LogoutButton";
import InstallGridiron365 from "@/components/pwa/InstallGridiron365";

import {
  requireUser,
} from "@/lib/auth/requireUser";

import {
  createSupabaseServerClient,
} from "@/lib/supabase/server";

import {
  getMyLeagues,
} from "@/lib/leagues/league.service";


function formatLeagueType(
  leagueType: string,
  playerSelectionMode: string
) {
  if (
    leagueType ===
    "traditional"
  ) {
    return "Traditional Draft";
  }


  if (
    leagueType ===
      "season_long" &&
    playerSelectionMode ===
      "salary"
  ) {
    return "Season-Long Salary Cap";
  }


  if (
    leagueType ===
      "season_long" &&
    playerSelectionMode ===
      "no_salary"
  ) {
    return "Season-Long No Salary Cap";
  }


  if (
    leagueType ===
      "nfl_playoffs" &&
    playerSelectionMode ===
      "salary"
  ) {
    return "NFL Playoffs Salary Cap";
  }


  if (
    leagueType ===
      "nfl_playoffs" &&
    playerSelectionMode ===
      "no_salary"
  ) {
    return "NFL Playoffs No Salary Cap";
  }


  if (
    leagueType ===
      "pickem"
  ) {
    return "G365 Football Pick'em";
  }


  return "Fantasy League";
}


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
        character
          .toUpperCase()
    );
}


export default async function MyLeaguesPage() {
  const user =
    await requireUser();


  const supabase =
    await createSupabaseServerClient();


  const leagues =
    await getMyLeagues(
      supabase,
      user.id
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
        <header
          style={
            styles.topBar
          }
        >
          <Image
            src="/branding/gridiron365-logo-full.png"
            alt="Gridiron365"
            width={320}
            height={90}
            priority
            style={
              styles.logo
            }
          />


          <div
            style={
              styles.topActions
            }
          >
            <InstallGridiron365 />


            <div
              style={
                styles.userBox
              }
            >
              <span
                style={
                  styles.userLabel
                }
              >
                SIGNED IN
              </span>


              <span
                style={
                  styles.userEmail
                }
              >
                {user.email}
              </span>
            </div>


            <LogoutButton />
          </div>
        </header>


        <div
          style={
            styles.headingRow
          }
        >
          <div>
            <p
              style={
                styles.eyebrow
              }
            >
              GRIDIRON365
            </p>


            <h1
              style={
                styles.title
              }
            >
              My Leagues
            </h1>


            <p
              style={
                styles.subtitle
              }
            >
              Open an existing league or create a new one.
            </p>
          </div>


          <Link
            href="/create-league"
            style={
              styles.createButton
            }
          >
            + Create League
          </Link>
        </div>


        {leagues.length ===
        0 ? (
          <Card
            style={
              styles.emptyCard
            }
          >
            <div
              style={
                styles.emptyIcon
              }
            >
              G365
            </div>


            <h2
              style={
                styles.emptyTitle
              }
            >
              No leagues yet
            </h2>


            <p
              style={
                styles.emptyText
              }
            >
              Create your first Gridiron365 league to get started.
            </p>


            <Link
              href="/create-league"
              style={
                styles.emptyButton
              }
            >
              Create Your First League
            </Link>
          </Card>
        ) : (
          <section
            style={
              styles.grid
            }
          >
            {leagues.map(
              (
                league
              ) => (
                <Link
                  key={
                    league.id
                  }
                  href={
                    `/league/${league.id}`
                  }
                  style={
                    styles.leagueLink
                  }
                >
                  <Card
                    style={
                      styles.leagueCard
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
                        styles.cardTop
                      }
                    >
                      <div>
                        <span
                          style={
                            styles.typeBadge
                          }
                        >
                          {formatLeagueType(
                            league.leagueType,
                            league.playerSelectionMode
                          )}
                        </span>


                        <h2
                          style={
                            styles.leagueName
                          }
                        >
                          {league.name}
                        </h2>
                      </div>


                      <span
                        style={
                          styles.season
                        }
                      >
                        {league.season}
                      </span>
                    </div>


                    <div
                      style={
                        styles.cardDetails
                      }
                    >
                      {league.teamName ? (
                        <div
                          style={
                            styles.detailRow
                          }
                        >
                          <span
                            style={
                              styles.detailLabel
                            }
                          >
                            {league.leagueType ===
                              "season_long" ||
                            league.leagueType ===
                              "pickem"
                              ? "My Entry"
                              : "My Team"}
                          </span>


                          <span
                            style={
                              styles.detailValue
                            }
                          >
                            {league.teamName}
                          </span>
                        </div>
                      ) : null}


                      <div
                        style={
                          styles.detailRow
                        }
                      >
                        <span
                          style={
                            styles.detailLabel
                          }
                        >
                          Status
                        </span>


                        <span
                          style={
                            styles.statusValue
                          }
                        >
                          {formatStatus(
                            league.status
                          )}
                        </span>
                      </div>


                      <div
                        style={
                          styles.detailRow
                        }
                      >
                        <span
                          style={
                            styles.detailLabel
                          }
                        >
                          Role
                        </span>


                        <span
                          style={
                            styles.detailValue
                          }
                        >
                          {league.role ===
                          "commissioner"
                            ? "Commissioner"
                            : league.role ===
                                "co_commissioner"
                              ? "Co-Commissioner"
                              : "Member"}
                        </span>
                      </div>


                      {league.leagueType ===
                      "season_long" ? (
                        <div
                          style={
                            styles.detailRow
                          }
                        >
                          <span
                            style={
                              styles.detailLabel
                            }
                          >
                            Format
                          </span>


                          <span
                            style={
                              styles.detailValue
                            }
                          >
                            {league.playerSelectionMode ===
                            "salary"
                              ? "Weekly Salary"
                              : "Weekly No Salary"}
                          </span>
                        </div>
                      ) : null}
                    </div>


                    <div
                      style={
                        styles.openRow
                      }
                    >
                      <span>
                        Open League
                      </span>


                      <span
                        aria-hidden="true"
                      >
                        →
                      </span>
                    </div>
                  </Card>
                </Link>
              )
            )}
          </section>
        )}
      </section>
    </main>
  );
}


const styles = {
  page: {
    minHeight:
      "100vh",

    padding:
      "24px 18px 48px",
  },


  shell: {
    width:
      "min(1180px,100%)",

    margin:
      "0 auto",

    display:
      "grid",

    gap:
      "30px",
  },


  topBar: {
    display:
      "flex",

    alignItems:
      "center",

    justifyContent:
      "space-between",

    gap:
      "20px",

    flexWrap:
      "wrap" as const,

    paddingBottom:
      "18px",

    borderBottom:
      "1px solid rgba(255,255,255,.08)",
  },


  logo: {
    width:
      "min(300px,75vw)",

    height:
      "auto",

    objectFit:
      "contain" as const,

    filter:
      "drop-shadow(0 10px 28px rgba(255,69,0,.16))",
  },


  topActions: {
    display:
      "flex",

    alignItems:
      "center",

    gap:
      "14px",

    flexWrap:
      "wrap" as const,
  },


  userBox: {
    display:
      "grid",

    gap:
      "3px",

    textAlign:
      "right" as const,
  },


  userLabel: {
    color:
      "#737985",

    fontSize:
      "9px",

    fontWeight:
      900,

    letterSpacing:
      ".12em",
  },


  userEmail: {
    color:
      "#c8ccd3",

    fontSize:
      "12px",

    fontWeight:
      700,
  },


  headingRow: {
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
    margin:
      0,

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

    fontSize:
      "36px",

    color:
      "#ffffff",
  },


  subtitle: {
    margin:
      "8px 0 0",

    color:
      "#8f96a3",

    fontSize:
      "14px",
  },


  createButton: {
    display:
      "inline-flex",

    alignItems:
      "center",

    justifyContent:
      "center",

    minHeight:
      "46px",

    padding:
      "11px 19px",

    borderRadius:
      "9px",

    background:
      "linear-gradient(135deg,#ff1e1e,#ff4500 50%,#ff8c00)",

    color:
      "#ffffff",

    fontSize:
      "13px",

    fontWeight:
      900,

    textDecoration:
      "none",

    boxShadow:
      "0 10px 28px rgba(255,69,0,.18)",
  },


  grid: {
    display:
      "grid",

    gridTemplateColumns:
      "repeat(auto-fit,minmax(290px,1fr))",

    gap:
      "18px",
  },


  leagueLink: {
    color:
      "inherit",

    textDecoration:
      "none",
  },


  leagueCard: {
    height:
      "100%",

    minHeight:
      "300px",

    padding:
      "23px",

    display:
      "flex",

    flexDirection:
      "column" as const,
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
      "linear-gradient(90deg,#ff1e1e,#ff4500,#ff8c00)",
  },


  cardTop: {
    display:
      "flex",

    alignItems:
      "flex-start",

    justifyContent:
      "space-between",

    gap:
      "15px",
  },


  typeBadge: {
    display:
      "inline-block",

    padding:
      "5px 8px",

    border:
      "1px solid rgba(255,140,0,.22)",

    borderRadius:
      "6px",

    background:
      "rgba(255,140,0,.08)",

    color:
      "#ff9c2a",

    fontSize:
      "9px",

    fontWeight:
      900,

    letterSpacing:
      ".08em",

    textTransform:
      "uppercase" as const,
  },


  leagueName: {
    margin:
      "13px 0 0",

    color:
      "#ffffff",

    fontSize:
      "21px",

    lineHeight:
      1.25,
  },


  season: {
    color:
      "#6e737c",

    fontSize:
      "13px",

    fontWeight:
      800,
  },


  cardDetails: {
    display:
      "grid",

    gap:
      "11px",

    marginTop:
      "25px",
  },


  detailRow: {
    display:
      "flex",

    alignItems:
      "center",

    justifyContent:
      "space-between",

    gap:
      "18px",
  },


  detailLabel: {
    color:
      "#737985",

    fontSize:
      "11px",

    fontWeight:
      800,

    textTransform:
      "uppercase" as const,

    letterSpacing:
      ".06em",
  },


  detailValue: {
    color:
      "#d6d9df",

    fontSize:
      "13px",

    fontWeight:
      800,

    textAlign:
      "right" as const,
  },


  statusValue: {
    color:
      "#ff8c00",

    fontSize:
      "12px",

    fontWeight:
      900,
  },


  openRow: {
    marginTop:
      "auto",

    paddingTop:
      "22px",

    display:
      "flex",

    alignItems:
      "center",

    justifyContent:
      "space-between",

    color:
      "#ff7a18",

    fontSize:
      "12px",

    fontWeight:
      900,
  },


  emptyCard: {
    padding:
      "55px 25px",

    display:
      "grid",

    justifyItems:
      "center",

    textAlign:
      "center" as const,
  },


  emptyIcon: {
    width:
      "68px",

    height:
      "68px",

    display:
      "grid",

    placeItems:
      "center",

    borderRadius:
      "18px",

    background:
      "linear-gradient(135deg,#ff1e1e,#ff8c00)",

    color:
      "#ffffff",

    fontSize:
      "14px",

    fontWeight:
      900,

    boxShadow:
      "0 12px 30px rgba(255,69,0,.18)",
  },


  emptyTitle: {
    margin:
      "20px 0 0",

    color:
      "#ffffff",

    fontSize:
      "23px",
  },


  emptyText: {
    margin:
      "9px 0 0",

    color:
      "#8f96a3",

    fontSize:
      "14px",
  },


  emptyButton: {
    marginTop:
      "22px",

    display:
      "inline-flex",

    minHeight:
      "46px",

    alignItems:
      "center",

    justifyContent:
      "center",

    padding:
      "11px 18px",

    borderRadius:
      "9px",

    background:
      "linear-gradient(135deg,#ff1e1e,#ff4500,#ff8c00)",

    color:
      "#ffffff",

    fontSize:
      "13px",

    fontWeight:
      900,

    textDecoration:
      "none",
  },
};