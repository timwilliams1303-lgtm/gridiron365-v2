import Link from "next/link";

import Card from "@/components/ui/Card";

import {
  createSupabaseServerClient,
} from "@/lib/supabase/server";

import {
  getTraditionalMatchupsData,
  type TraditionalMatchupRow,
} from "@/lib/traditional/matchups.service";

import {
  requireTraditionalLeague,
} from "@/lib/traditional/requireTraditionalLeague";


type PageProps = {
  params:
    Promise<{
      leagueId: string;
    }>;

  searchParams:
    Promise<{
      week?: string;
    }>;
};


function formatPoints(
  value: number
) {
  return value.toFixed(
    2
  );
}


function formatProjection(
  value: number
) {
  return Number(
    value ?? 0
  ).toFixed(1);
}


function getStatusLabel(
  matchup:
    TraditionalMatchupRow
) {
  if (
    matchup.isFinal &&
    matchup.tied
  ) {
    return "FINAL • TIE";
  }


  if (
    matchup.isFinal
  ) {
    return "FINAL";
  }


  if (
    matchup.isLive
  ) {
    return "LIVE";
  }


  return "SCHEDULED";
}


export default async function TraditionalMatchupsPage({
  params,
  searchParams,
}: PageProps) {
  const {
    leagueId,
  } =
    await params;


  const query =
    await searchParams;


  const access =
    await requireTraditionalLeague(
      leagueId
    );


  const requestedWeek =
    query.week
      ? Number(
          query.week
        )
      : null;


  const selectedWeekInput =
    requestedWeek !==
      null &&
    Number.isInteger(
      requestedWeek
    )
      ? requestedWeek
      : null;


  const supabase =
    await createSupabaseServerClient();


  const data =
    await getTraditionalMatchupsData(
      supabase,
      leagueId,
      access.league.season,
      selectedWeekInput,
      access.fantasyTeam
        ?.id ??
        null
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
            HEADER
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
              HEAD-TO-HEAD
            </p>

            <h1
              style={
                styles.title
              }
            >
              Matchups
            </h1>

            <p
              style={
                styles.subtitle
              }
            >
              Follow every league matchup.
              Select a matchup to open the
              full live game center.
            </p>
          </div>


          <div
            style={
              styles.activeWeekCard
            }
          >
            <span
              style={
                styles.activeWeekLabel
              }
            >
              ACTIVE WEEK
            </span>

            <strong
              style={
                styles.activeWeekValue
              }
            >
              Week{" "}
              {data.activeWeek}
            </strong>
          </div>
        </header>


        {/* =========================================
            WEEK SELECTOR
        ========================================== */}

        <section
          style={
            styles.weekSection
          }
        >
          <div
            style={
              styles.weekHeader
            }
          >
            <div>
              <span
                style={
                  styles.weekEyebrow
                }
              >
                REGULAR SEASON
              </span>

              <strong
                style={
                  styles.weekTitle
                }
              >
                Select Week
              </strong>
            </div>


            <span
              style={
                styles.viewingWeek
              }
            >
              Viewing Week{" "}
              {data.selectedWeek}
            </span>
          </div>


          <nav
            aria-label="Matchup week navigation"
            style={
              styles.weekViewport
            }
          >
            <div
              style={
                styles.weekNav
              }
            >
              {Array.from(
                {
                  length:
                    data.regularSeasonWeeks,
                },
                (
                  _,
                  index
                ) =>
                  index + 1
              ).map(
                (
                  week
                ) => {
                  const selected =
                    week ===
                    data.selectedWeek;


                  const active =
                    week ===
                    data.activeWeek;


                  return (
                    <Link
                      key={
                        week
                      }
                      href={
                        `/league/${leagueId}/matchups?week=${week}`
                      }
                      style={{
                        ...styles.weekButton,

                        ...(selected
                          ? styles.weekButtonSelected
                          : {}),

                        ...(active &&
                        !selected
                          ? styles.weekButtonActive
                          : {}),
                      }}
                    >
                      <span>
                        W{week}
                      </span>

                      {active ? (
                        <small
                          style={
                            styles.activeMarker
                          }
                        >
                          ACTIVE
                        </small>
                      ) : null}
                    </Link>
                  );
                }
              )}
            </div>
          </nav>
        </section>


        {/* =========================================
            MATCHUPS
        ========================================== */}

        <section>
          <div
            style={
              styles.sectionHeader
            }
          >
            <div>
              <p
                style={
                  styles.sectionEyebrow
                }
              >
                LEAGUE SCOREBOARD
              </p>

              <h2
                style={
                  styles.sectionTitle
                }
              >
                Week{" "}
                {data.selectedWeek}
                {" "}
                Matchups
              </h2>
            </div>


            <span
              style={
                styles.matchupCount
              }
            >
              {data.matchups.length}
              {" "}
              matchup
              {data.matchups.length ===
              1
                ? ""
                : "s"}
            </span>
          </div>


          {data.matchups.length >
          0 ? (
            <div
              style={
                styles.matchupGrid
              }
            >
              {data.matchups.map(
                (
                  matchup
                ) => (
                  <MatchupLinkCard
                    key={
                      matchup.matchupId
                    }
                    leagueId={
                      leagueId
                    }
                    matchup={
                      matchup
                    }
                  />
                )
              )}
            </div>
          ) : (
            <Card
              style={
                styles.emptyState
              }
            >
              <strong>
                No matchups scheduled
              </strong>

              <span>
                No Traditional matchups
                were found for Week{" "}
                {data.selectedWeek}.
              </span>
            </Card>
          )}
        </section>
      </section>
    </main>
  );
}


function MatchupLinkCard({
  leagueId,
  matchup,
}: {
  leagueId: string;

  matchup:
    TraditionalMatchupRow;
}) {
  return (
    <Link
      href={
        `/league/${leagueId}/matchups/${matchup.matchupId}`
      }
      style={
        styles.matchupLink
      }
    >
      <Card
        style={{
          ...styles.matchupCard,

          ...(matchup.isMyMatchup
            ? styles.myMatchupCard
            : {}),

          ...(matchup.isLive
            ? styles.liveMatchupCard
            : {}),
        }}
      >
        {/* STATUS */}

        <div
          style={
            styles.matchupHeader
          }
        >
          <span
            style={
              matchup.isLive
                ? styles.liveBadge
                : matchup.isFinal
                  ? styles.finalBadge
                  : styles.scheduledBadge
            }
          >
            {getStatusLabel(
              matchup
            )}
          </span>


          {matchup.isMyMatchup ? (
            <span
              style={
                styles.myMatchupBadge
              }
            >
              YOUR MATCHUP
            </span>
          ) : null}
        </div>


        {/* AWAY */}

        <TeamRow
          teamName={
            matchup.away
              .teamName
          }
          points={
            matchup.away
              .points
          }
          projectedPoints={
            matchup.away
              .projectedPoints
          }
          isMyTeam={
            matchup.away
              .isMyTeam
          }
          isWinner={
            matchup.away
              .isWinner
          }
          isLive={
            matchup.isLive
          }
        />


        <div
          style={
            styles.scoreDivider
          }
        />


        {/* HOME */}

        <TeamRow
          teamName={
            matchup.home
              .teamName
          }
          points={
            matchup.home
              .points
          }
          projectedPoints={
            matchup.home
              .projectedPoints
          }
          isMyTeam={
            matchup.home
              .isMyTeam
          }
          isWinner={
            matchup.home
              .isWinner
          }
          isLive={
            matchup.isLive
          }
        />


        {/* FOOTER */}

        <div
          style={
            styles.matchupFooter
          }
        >
          <span
            style={
              styles.detailHint
            }
          >
            View matchup details
          </span>

          <span
            style={
              styles.arrow
            }
          >
            →
          </span>
        </div>
      </Card>
    </Link>
  );
}


function TeamRow({
  teamName,
  points,
  projectedPoints,
  isMyTeam,
  isWinner,
  isLive,
}: {
  teamName: string;

  points: number;

  projectedPoints: number;

  isMyTeam: boolean;

  isWinner: boolean;

  isLive: boolean;
}) {
  return (
    <div
      style={{
        ...styles.teamRow,

        ...(isWinner
          ? styles.winnerRow
          : {}),

        ...(isMyTeam
          ? styles.myTeamRow
          : {}),
      }}
    >
      <div
        style={
          styles.teamIdentity
        }
      >
        <div
          style={{
            ...styles.teamIcon,

            ...(isMyTeam
              ? styles.myTeamIcon
              : {}),
          }}
        >
          {teamName
            .slice(
              0,
              1
            )
            .toUpperCase()}
        </div>


        <div
          style={
            styles.teamText
          }
        >
          <strong
            style={
              styles.teamName
            }
          >
            {teamName}
          </strong>


          <div
            style={
              styles.teamLabels
            }
          >
            {isMyTeam ? (
              <span
                style={
                  styles.myTeamLabel
                }
              >
                MY TEAM
              </span>
            ) : null}


            {isWinner ? (
              <span
                style={
                  styles.winnerLabel
                }
              >
                WINNER
              </span>
            ) : null}
          </div>
        </div>
      </div>


      <div
        style={
          styles.teamScoreBlock
        }
      >
        <span
          style={
            styles.teamProjection
          }
        >
          PROJ{" "}
          {formatProjection(
            projectedPoints
          )}
        </span>

        <strong
          style={{
            ...styles.teamScore,

            ...(isLive
              ? styles.liveScore
              : {}),

            ...(isWinner
              ? styles.winnerScore
              : {}),
          }}
        >
          {formatPoints(
            points
          )}
        </strong>
      </div>
    </div>
  );
}


const styles = {
  page: {
    minHeight:
      "calc(100vh - 140px)",

    padding:
      "32px 18px 60px",

    background:
      "radial-gradient(circle at 50% 0%,rgba(255,67,0,.05),transparent 34%)",
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
    maxWidth:
      "650px",

    margin:
      "8px 0 0",

    color:
      "#8f96a3",

    fontSize:
      "13px",

    lineHeight:
      1.5,
  },


  activeWeekCard: {
    minWidth:
      "130px",

    padding:
      "12px 15px",

    display:
      "grid",

    gap:
      "4px",

    border:
      "1px solid rgba(255,110,20,.18)",

    borderRadius:
      "9px",

    background:
      "rgba(255,80,0,.05)",
  },


  activeWeekLabel: {
    color:
      "#707781",

    fontSize:
      "7px",

    fontWeight:
      900,

    letterSpacing:
      ".09em",
  },


  activeWeekValue: {
    color:
      "#ff8624",

    fontSize:
      "12px",
  },


  weekSection: {
    padding:
      "16px",

    display:
      "grid",

    gap:
      "12px",

    border:
      "1px solid rgba(255,255,255,.075)",

    borderRadius:
      "11px",

    background:
      "linear-gradient(145deg,#141415,#09090a)",
  },


  weekHeader: {
    display:
      "flex",

    alignItems:
      "flex-end",

    justifyContent:
      "space-between",

    gap:
      "12px",

    flexWrap:
      "wrap" as const,
  },


  weekEyebrow: {
    display:
      "block",

    color:
      "#6f7680",

    fontSize:
      "7px",

    fontWeight:
      900,

    letterSpacing:
      ".10em",
  },


  weekTitle: {
    display:
      "block",

    marginTop:
      "3px",

    color:
      "#ffffff",

    fontSize:
      "13px",
  },


  viewingWeek: {
    color:
      "#8d949e",

    fontSize:
      "9px",

    fontWeight:
      800,
  },


  weekViewport: {
    width:
      "100%",

    overflowX:
      "auto" as const,
  },


  weekNav: {
    width:
      "max-content",

    minWidth:
      "100%",

    display:
      "flex",

    gap:
      "6px",
  },


  weekButton: {
    minWidth:
      "56px",

    minHeight:
      "42px",

    padding:
      "6px 8px",

    display:
      "grid",

    alignContent:
      "center",

    justifyItems:
      "center",

    gap:
      "2px",

    border:
      "1px solid rgba(255,255,255,.075)",

    borderRadius:
      "7px",

    background:
      "rgba(255,255,255,.025)",

    color:
      "#777e88",

    fontSize:
      "9px",

    fontWeight:
      900,

    textDecoration:
      "none",
  },


  weekButtonSelected: {
    border:
      "1px solid rgba(255,100,15,.36)",

    background:
      "linear-gradient(135deg,rgba(190,22,22,.24),rgba(255,80,0,.15))",

    color:
      "#ffffff",
  },


  weekButtonActive: {
    border:
      "1px solid rgba(70,215,130,.18)",

    color:
      "#45d987",
  },


  activeMarker: {
    color:
      "#45d987",

    fontSize:
      "6px",

    fontWeight:
      950,
  },


  sectionHeader: {
    marginBottom:
      "12px",

    display:
      "flex",

    alignItems:
      "flex-end",

    justifyContent:
      "space-between",

    gap:
      "14px",
  },


  sectionEyebrow: {
    margin:
      0,

    color:
      "#ff7a18",

    fontSize:
      "8px",

    fontWeight:
      900,

    letterSpacing:
      ".12em",
  },


  sectionTitle: {
    margin:
      "4px 0 0",

    color:
      "#ffffff",

    fontSize:
      "20px",
  },


  matchupCount: {
    color:
      "#7c838d",

    fontSize:
      "9px",
  },


  matchupGrid: {
    display:
      "grid",

    gridTemplateColumns:
      "repeat(auto-fit,minmax(330px,1fr))",

    gap:
      "13px",
  },


  matchupLink: {
    display:
      "block",

    color:
      "inherit",

    textDecoration:
      "none",

    cursor:
      "pointer",
  },


  matchupCard: {
    minHeight:
      "220px",

    padding:
      "15px",

    display:
      "grid",

    gap:
      "10px",

    border:
      "1px solid rgba(255,255,255,.075)",

    transition:
      "border-color .15s ease, transform .15s ease",
  },


  myMatchupCard: {
    border:
      "1px solid rgba(255,105,20,.34)",

    background:
      "linear-gradient(145deg,rgba(170,20,20,.10),rgba(255,75,0,.045),#09090a)",
  },


  liveMatchupCard: {
    boxShadow:
      "inset 0 0 0 1px rgba(65,215,130,.06)",
  },


  matchupHeader: {
    minHeight:
      "22px",

    display:
      "flex",

    alignItems:
      "center",

    justifyContent:
      "space-between",

    gap:
      "8px",
  },


  scheduledBadge: {
    color:
      "#777e88",

    fontSize:
      "7px",

    fontWeight:
      950,

    letterSpacing:
      ".08em",
  },


  liveBadge: {
    padding:
      "4px 7px",

    borderRadius:
      "5px",

    background:
      "rgba(55,210,125,.09)",

    color:
      "#42dc83",

    fontSize:
      "7px",

    fontWeight:
      950,

    letterSpacing:
      ".08em",
  },


  finalBadge: {
    color:
      "#c3c8cf",

    fontSize:
      "7px",

    fontWeight:
      950,

    letterSpacing:
      ".08em",
  },


  myMatchupBadge: {
    padding:
      "4px 7px",

    borderRadius:
      "5px",

    background:
      "rgba(255,90,15,.09)",

    color:
      "#ff8927",

    fontSize:
      "7px",

    fontWeight:
      950,
  },


  teamRow: {
    minHeight:
      "60px",

    padding:
      "7px 8px",

    display:
      "flex",

    alignItems:
      "center",

    justifyContent:
      "space-between",

    gap:
      "12px",

    borderRadius:
      "7px",
  },


  myTeamRow: {
    boxShadow:
      "inset 3px 0 0 rgba(255,105,20,.55)",
  },


  winnerRow: {
    background:
      "rgba(60,205,125,.045)",
  },


  teamIdentity: {
    minWidth:
      0,

    display:
      "flex",

    alignItems:
      "center",

    gap:
      "10px",
  },


  teamIcon: {
    width:
      "38px",

    height:
      "38px",

    flex:
      "0 0 auto",

    display:
      "flex",

    alignItems:
      "center",

    justifyContent:
      "center",

    border:
      "1px solid rgba(255,255,255,.08)",

    borderRadius:
      "50%",

    background:
      "#171719",

    color:
      "#7c838c",

    fontSize:
      "11px",

    fontWeight:
      950,
  },


  myTeamIcon: {
    border:
      "1px solid rgba(255,110,25,.28)",

    color:
      "#ff8c29",
  },


  teamText: {
    minWidth:
      0,

    display:
      "grid",

    gap:
      "4px",
  },


  teamName: {
    overflow:
      "hidden",

    textOverflow:
      "ellipsis",

    whiteSpace:
      "nowrap" as const,

    color:
      "#ffffff",

    fontSize:
      "12px",
  },


  teamLabels: {
    minHeight:
      "10px",

    display:
      "flex",

    gap:
      "6px",
  },


  myTeamLabel: {
    color:
      "#ff8b28",

    fontSize:
      "6px",

    fontWeight:
      950,
  },


  winnerLabel: {
    color:
      "#43d982",

    fontSize:
      "6px",

    fontWeight:
      950,
  },


  teamScoreBlock: {
    display:
      "grid",

    justifyItems:
      "end",

    gap:
      "2px",
  },


  teamProjection: {
    color:
      "#ff9a43",

    fontSize:
      "11px",

    fontWeight:
      900,

    letterSpacing:
      ".04em",

    fontVariantNumeric:
      "tabular-nums",
  },


  teamScore: {
    color:
      "#ffffff",

    fontSize:
      "21px",

    fontVariantNumeric:
      "tabular-nums",
  },


  liveScore: {
    color:
      "#ff8927",
  },


  winnerScore: {
    color:
      "#43d982",
  },


  scoreDivider: {
    height:
      "1px",

    background:
      "rgba(255,255,255,.055)",
  },


  matchupFooter: {
    marginTop:
      "2px",

    paddingTop:
      "9px",

    display:
      "flex",

    alignItems:
      "center",

    justifyContent:
      "space-between",

    gap:
      "8px",

    borderTop:
      "1px solid rgba(255,255,255,.045)",
  },


  detailHint: {
    color:
      "#777e88",

    fontSize:
      "8px",

    fontWeight:
      800,
  },


  arrow: {
    color:
      "#ff8423",

    fontSize:
      "13px",

    fontWeight:
      950,
  },


  emptyState: {
    minHeight:
      "150px",

    padding:
      "24px",

    display:
      "grid",

    alignContent:
      "center",

    gap:
      "6px",
  },
};
