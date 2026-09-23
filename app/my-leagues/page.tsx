import Image from "next/image";
import Link from "next/link";

import Card from "@/components/ui/Card";
import LogoutButton from "@/components/auth/LogoutButton";
import InstallGridiron365 from "@/components/pwa/InstallGridiron365";
import DeleteLeagueButton from "@/components/leagues/DeleteLeagueButton";

import {
  requireUser,
} from "@/lib/auth/requireUser";

import {
  createSupabaseServerClient,
} from "@/lib/supabase/server";

import {
  getMyLeagues,
} from "@/lib/leagues/league.service";

import {
  getLeagueParticipantHomePath,
} from "@/lib/leagues/participant-standard";


function formatLeagueType(
  leagueType: string,
  playerSelectionMode: string,
  nhlLeagueFormat?: string | null
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
    return "G365 Pick'em";
  }


  if (
    leagueType ===
      "nhl_traditional"
  ) {
    return nhlLeagueFormat ===
      "dynasty"
      ? "NHL Dynasty"
      : "NHL Traditional Draft";
  }


  if (
    leagueType ===
      "greyhound"
  ) {
    return "Greyhound Racing";
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


function getLeagueTypeSortOrder(
  leagueType: string,
  playerSelectionMode: string
) {
  if (
    leagueType ===
    "traditional"
  ) {
    return 10;
  }

  if (
    leagueType ===
      "season_long" &&
    playerSelectionMode ===
      "salary"
  ) {
    return 20;
  }

  if (
    leagueType ===
      "season_long" &&
    playerSelectionMode ===
      "no_salary"
  ) {
    return 30;
  }

  if (
    leagueType ===
    "pickem"
  ) {
    return 40;
  }

  if (
    leagueType ===
      "nfl_playoffs" &&
    playerSelectionMode ===
      "salary"
  ) {
    return 50;
  }

  if (
    leagueType ===
      "nfl_playoffs" &&
    playerSelectionMode ===
      "no_salary"
  ) {
    return 60;
  }

  if (
    leagueType ===
      "greyhound"
  ) {
    return 70;
  }

  return 999;
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


  const nhlLeagueIds =
    leagues
      .filter(
        (league) =>
          league.leagueType ===
          "nhl_traditional"
      )
      .map(
        (league) =>
          league.id
      );


  const nhlLeagueFormats =
    new Map<string, string>();


  if (
    nhlLeagueIds.length >
    0
  ) {
    const {
      data:
        nhlTraditionalSettings,
      error:
        nhlTraditionalSettingsError,
    } = await supabase
      .from(
        "nhl_traditional_settings"
      )
      .select(
        "league_id, league_format"
      )
      .in(
        "league_id",
        nhlLeagueIds
      );


    if (
      nhlTraditionalSettingsError
    ) {
      console.error(
        "Unable to load NHL Traditional league formats:",
        nhlTraditionalSettingsError
      );
    } else {
      for (
        const setting of
        nhlTraditionalSettings ??
        []
      ) {
        if (
          typeof setting.league_id ===
            "string" &&
          typeof setting.league_format ===
            "string"
        ) {
          nhlLeagueFormats.set(
            setting.league_id,
            setting.league_format
          );
        }
      }
    }
  }


  const sortedLeagues =
    [...leagues].sort(
      (
        a,
        b
      ) => {
        const typeDifference =
          getLeagueTypeSortOrder(
            a.leagueType,
            a.playerSelectionMode
          ) -
          getLeagueTypeSortOrder(
            b.leagueType,
            b.playerSelectionMode
          );

        if (
          typeDifference !==
          0
        ) {
          return typeDifference;
        }

        const seasonDifference =
          Number(
            b.season
          ) -
          Number(
            a.season
          );

        if (
          seasonDifference !==
          0
        ) {
          return seasonDifference;
        }

        return a.name.localeCompare(
          b.name,
          undefined,
          {
            sensitivity:
              "base",
          }
        );
      }
    );


  return (
    <main
      className="g365-my-leagues-page"
      style={
        styles.page
      }
    >
      <style>{`
        .g365-my-leagues-mobile-picker {
          display: none;
        }

        @media (max-width: 760px) {
          .g365-my-leagues-page {
            padding: 12px 10px 32px !important;
          }

          .g365-my-leagues-shell {
            gap: 18px !important;
          }

          .g365-my-leagues-topbar {
            gap: 12px !important;
            padding-bottom: 12px !important;
          }

          .g365-my-leagues-logo {
            width: min(230px, 68vw) !important;
          }

          .g365-my-leagues-top-actions {
            width: 100%;
            gap: 8px !important;
            justify-content: space-between;
          }

          .g365-my-leagues-heading-row {
            align-items: stretch !important;
            gap: 12px !important;
          }

          .g365-my-leagues-heading-row h1 {
            font-size: 28px !important;
          }

          .g365-my-leagues-heading-row > a {
            width: 100%;
          }

          .g365-my-leagues-mobile-picker {
            display: grid;
            gap: 6px;
            padding: 12px;
            border: 1px solid rgba(255,255,255,.09);
            border-radius: 12px;
            background:
              linear-gradient(
                180deg,
                rgba(18,18,20,.98),
                rgba(8,8,10,.98)
              );
          }

          .g365-my-leagues-mobile-picker-label {
            margin: 0;
            color: #ff6b24;
            font-size: 9px;
            font-weight: 950;
            letter-spacing: .12em;
            text-transform: uppercase;
          }

          .g365-my-leagues-mobile-select {
            width: 100%;
          }

          .g365-my-leagues-mobile-select > summary {
            min-height: 48px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0 12px;
            border: 1px solid rgba(255,255,255,.12);
            border-radius: 10px;
            color: #fff;
            background: #111318;
            cursor: pointer;
            font-size: 13px;
            font-weight: 900;
            list-style: none;
          }

          .g365-my-leagues-mobile-select > summary::-webkit-details-marker {
            display: none;
          }

          .g365-my-leagues-mobile-select > summary::after {
            content: "▼";
            color: #ff742d;
            font-size: 10px;
          }

          .g365-my-leagues-mobile-select[open] > summary::after {
            content: "▲";
          }

          .g365-my-leagues-mobile-options {
            display: grid;
            gap: 6px;
            margin-top: 7px;
          }

          .g365-my-leagues-mobile-option {
            min-width: 0;
            min-height: 54px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            padding: 9px 11px;
            border: 1px solid rgba(255,255,255,.08);
            border-radius: 9px;
            color: #fff;
            background: rgba(255,255,255,.025);
            text-decoration: none;
          }

          .g365-my-leagues-mobile-option > span {
            min-width: 0;
            display: grid;
            gap: 3px;
          }

          .g365-my-leagues-mobile-option strong {
            overflow: hidden;
            font-size: 12px;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .g365-my-leagues-mobile-option small {
            color: #8f96a3;
            font-size: 9px;
            font-weight: 800;
          }

          .g365-my-leagues-mobile-option b {
            flex: 0 0 auto;
            color: #ff8c32;
            font-size: 11px;
          }

          .g365-my-leagues-grid {
            grid-template-columns: 1fr !important;
            gap: 12px !important;
          }

        }
      `}</style>


      <section
        className="g365-my-leagues-shell"
        style={
          styles.shell
        }
      >
        <header
          className="g365-my-leagues-topbar"
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
            className="g365-my-leagues-logo"
            style={
              styles.logo
            }
          />


          <div
            className="g365-my-leagues-top-actions"
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
          className="g365-my-leagues-heading-row"
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


        {sortedLeagues.length > 0 ? (
          <section className="g365-my-leagues-mobile-picker">
            <p className="g365-my-leagues-mobile-picker-label">
              Select League
            </p>

            <details className="g365-my-leagues-mobile-select">
              <summary>Choose a league</summary>

              <div className="g365-my-leagues-mobile-options">
                {sortedLeagues.map((league) => (
                  <Link
                    key={league.id}
                    href={getLeagueParticipantHomePath(
                      league.leagueType,
                      league.id
                    )}
                    className="g365-my-leagues-mobile-option"
                  >
                    <span>
                      <strong>{league.name}</strong>
                      <small>
                        {formatLeagueType(
                          league.leagueType,
                          league.playerSelectionMode,
                          nhlLeagueFormats.get(league.id)
                        )}
                      </small>
                    </span>

                    <b>{league.season}</b>
                  </Link>
                ))}
              </div>
            </details>
          </section>
        ) : null}


        {sortedLeagues.length ===
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
            className="g365-my-leagues-grid"
            style={
              styles.grid
            }
          >
            {sortedLeagues.map(
              (
                league
              ) => (
                <Card
                  key={
                    league.id
                  }
                  style={
                    styles.leagueCard
                  }
                >
                  <Link
                    href={
                      getLeagueParticipantHomePath(
                        league.leagueType,
                        league.id
                      )
                    }
                    style={
                      styles.leagueLink
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
                            league.playerSelectionMode,
                            nhlLeagueFormats.get(
                              league.id
                            )
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
                              "pickem" ||
                            league.leagueType ===
                              "greyhound"
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
                  </Link>

                  <div
                    style={{
                      ...styles.cardActions,
                      gridTemplateColumns:
                        league.role ===
                        "commissioner"
                          ? "repeat(2, minmax(0, 1fr))"
                          : "1fr",
                    }}
                  >
                    <Link
                      href={
                        getLeagueParticipantHomePath(
                          league.leagueType,
                          league.id
                        )
                      }
                      style={
                        styles.openAction
                      }
                    >
                      Open League
                    </Link>


                    {league.role ===
                    "commissioner" ? (
                      <DeleteLeagueButton
                        leagueId={
                          league.id
                        }
                        leagueName={
                          league.name
                        }
                      />
                    ) : null}
                  </div>
                </Card>
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


  cardActions: {
    display:
      "grid",

    gridTemplateColumns:
      "repeat(2, minmax(0, 1fr))",

    gap:
      "10px",

    padding:
      "0 18px 18px",

    alignItems:
      "stretch",
  },


  openAction: {
    minHeight:
      "42px",

    display:
      "inline-flex",

    alignItems:
      "center",

    justifyContent:
      "center",

    padding:
      "10px 14px",

    borderRadius:
      "10px",

    border:
      "1px solid rgba(249,115,22,.55)",

    background:
      "linear-gradient(135deg, rgba(220,38,38,.24), rgba(249,115,22,.20))",

    color:
      "#ffffff",

    fontSize:
      "12px",

    fontWeight:
      800,

    letterSpacing:
      ".04em",

    textDecoration:
      "none",

    textAlign:
      "center" as const,
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