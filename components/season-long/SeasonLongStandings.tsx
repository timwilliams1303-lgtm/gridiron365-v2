import {
  createSupabaseServerClient,
} from "@/lib/supabase/server";

import {
  requireLeagueMember,
} from "@/lib/leagues/requireLeagueMember";


type SeasonLongStandingsProps = {
  leagueId: string;
};


type StandingRow = {
  fantasy_team_id:
    number;

  total_points:
    number |
    string |
    null;

  weeks_scored:
    number |
    null;

  highest_week_score:
    number |
    string |
    null;

  lowest_week_score:
    number |
    string |
    null;

  average_week_score:
    number |
    string |
    null;

  current_rank:
    number |
    null;
};


type FantasyTeamRow = {
  id:
    number;

  team_name:
    string;
};


type WeeklyScoreRow = {
  fantasy_team_id:
    number;

  week:
    number;

  fantasy_points:
    number |
    string |
    null;

  is_final:
    boolean |
    null;
};


type StandingView = {
  rank:
    number;

  fantasyTeamId:
    number;

  teamName:
    string;

  totalPoints:
    number;

  weeksScored:
    number;

  averageWeekScore:
    number;

  highestWeekScore:
    number;

  lowestWeekScore:
    number;

  latestFinalWeek:
    number |
    null;

  latestFinalWeekPoints:
    number |
    null;

  isMyTeam:
    boolean;
};


function numberValue(
  value:
    number |
    string |
    null |
    undefined
) {
  const parsed =
    Number(
      value ??
      0
    );


  return Number.isFinite(
    parsed
  )
    ? parsed
    : 0;
}


function formatPoints(
  value:
    number
) {
  return value.toFixed(
    2
  );
}


export default async function SeasonLongStandings({
  leagueId,
}: SeasonLongStandingsProps) {
  const access =
    await requireLeagueMember(
      leagueId
    );


  if (
    access.league.leagueType !==
    "season_long"
  ) {
    throw new Error(
      "This standings page is only available for Season-Long leagues."
    );
  }


  const supabase =
    await createSupabaseServerClient();


  const season =
    access.league.season;


  const isSalary =
    access.league.playerSelectionMode ===
    "salary";


  /*
   * ============================================================
   * REBUILD STANDINGS
   * ============================================================
   *
   * The backend standings function only counts finalized weekly
   * scores, so live/current incomplete weeks do not get added to
   * season totals.
   */

  const {
    error:
      rebuildError,
  } =
    await supabase.rpc(
      "rebuild_season_long_standings",
      {
        p_league_id:
          leagueId,

        p_season:
          season,
      }
    );


  if (
    rebuildError
  ) {
    throw new Error(
      `Could not rebuild Season-Long standings: ${rebuildError.message}`
    );
  }


  /*
   * ============================================================
   * LOAD DATA
   * ============================================================
   */

  const [
    standingsResult,
    teamsResult,
    weeklyScoresResult,
  ] =
    await Promise.all([
      supabase
        .from(
          "season_long_standings"
        )
        .select(`
          fantasy_team_id,
          total_points,
          weeks_scored,
          highest_week_score,
          lowest_week_score,
          average_week_score,
          current_rank
        `)
        .eq(
          "league_id",
          leagueId
        )
        .eq(
          "season",
          season
        ),

      supabase
        .from(
          "fantasy_teams"
        )
        .select(
          "id, team_name"
        )
        .eq(
          "league_id",
          leagueId
        )
        .eq(
          "active",
          true
        ),

      supabase
        .from(
          "season_long_weekly_scores"
        )
        .select(`
          fantasy_team_id,
          week,
          fantasy_points,
          is_final
        `)
        .eq(
          "league_id",
          leagueId
        )
        .eq(
          "season",
          season
        )
        .eq(
          "is_final",
          true
        ),
    ]);


  if (
    standingsResult.error
  ) {
    throw new Error(
      `Could not load Season-Long standings: ${standingsResult.error.message}`
    );
  }


  if (
    teamsResult.error
  ) {
    throw new Error(
      `Could not load Season-Long fantasy teams: ${teamsResult.error.message}`
    );
  }


  if (
    weeklyScoresResult.error
  ) {
    throw new Error(
      `Could not load Season-Long weekly scores: ${weeklyScoresResult.error.message}`
    );
  }


  const standings =
    (
      standingsResult.data ??
      []
    ) as StandingRow[];


  const teams =
    (
      teamsResult.data ??
      []
    ) as FantasyTeamRow[];


  const weeklyScores =
    (
      weeklyScoresResult.data ??
      []
    ) as WeeklyScoreRow[];


  /*
   * ============================================================
   * LOOKUPS
   * ============================================================
   */

  const standingByTeam =
    new Map<
      number,
      StandingRow
    >();


  for (
    const standing
    of standings
  ) {
    standingByTeam.set(
      standing.fantasy_team_id,
      standing
    );
  }


  const latestScoreByTeam =
    new Map<
      number,
      WeeklyScoreRow
    >();


  for (
    const score
    of weeklyScores
  ) {
    const previous =
      latestScoreByTeam.get(
        score.fantasy_team_id
      );


    if (
      !previous ||
      score.week >
      previous.week
    ) {
      latestScoreByTeam.set(
        score.fantasy_team_id,
        score
      );
    }
  }


  const myFantasyTeamId =
    access.fantasyTeam
      ?.id ??
    null;


  /*
   * ============================================================
   * BUILD DISPLAY ROWS
   * ============================================================
   */

  const rows:
    StandingView[] =
      teams.map(
        (
          team
        ) => {
          const standing =
            standingByTeam.get(
              team.id
            );


          const latestScore =
            latestScoreByTeam.get(
              team.id
            );


          return {
            rank:
              standing
                ?.current_rank ??
              0,

            fantasyTeamId:
              team.id,

            teamName:
              team.team_name,

            totalPoints:
              numberValue(
                standing
                  ?.total_points
              ),

            weeksScored:
              Number(
                standing
                  ?.weeks_scored ??
                0
              ),

            averageWeekScore:
              numberValue(
                standing
                  ?.average_week_score
              ),

            highestWeekScore:
              numberValue(
                standing
                  ?.highest_week_score
              ),

            lowestWeekScore:
              numberValue(
                standing
                  ?.lowest_week_score
              ),

            latestFinalWeek:
              latestScore
                ?.week ??
              null,

            latestFinalWeekPoints:
              latestScore
                ? numberValue(
                    latestScore
                      .fantasy_points
                  )
                : null,

            isMyTeam:
              myFantasyTeamId !==
                null &&
              team.id ===
                myFantasyTeamId,
          };
        }
      );


  /*
   * ============================================================
   * SORT
   * ============================================================
   */

  rows.sort(
    (
      a,
      b
    ) => {
      const aRanked =
        a.rank > 0;

      const bRanked =
        b.rank > 0;


      if (
        aRanked &&
        bRanked &&
        a.rank !==
          b.rank
      ) {
        return (
          a.rank -
          b.rank
        );
      }


      if (
        aRanked &&
        !bRanked
      ) {
        return -1;
      }


      if (
        !aRanked &&
        bRanked
      ) {
        return 1;
      }


      if (
        b.totalPoints !==
        a.totalPoints
      ) {
        return (
          b.totalPoints -
          a.totalPoints
        );
      }


      return a.teamName.localeCompare(
        b.teamName
      );
    }
  );


  /*
   * No completed weeks yet:
   * give every team a normal provisional display order.
   */

  const hasPersistedRank =
    rows.some(
      (
        row
      ) =>
        row.rank >
        0
    );


  if (
    !hasPersistedRank
  ) {
    rows.forEach(
      (
        row,
        index
      ) => {
        row.rank =
          index +
          1;
      }
    );
  }


  const leader =
    rows[
      0
    ] ??
    null;


  const secondPlace =
    rows[
      1
    ] ??
    null;


  const thirdPlace =
    rows[
      2
    ] ??
    null;


  const completedWeeks =
    rows.reduce(
      (
        highest,
        row
      ) =>
        Math.max(
          highest,
          row.weeksScored
        ),
      0
    );


  return (
    <main
      className="g365-season-long-mobile"
      style={
        styles.page
      }
    >

      <style>{`
        .g365-season-long-mobile,
        .g365-season-long-mobile * {
          box-sizing: border-box;
        }

        @media (max-width: 760px) {
          .g365-season-long-mobile {
            width: 100% !important;
            max-width: 100% !important;
            min-width: 0 !important;
            padding-left: 12px !important;
            padding-right: 12px !important;
            overflow-x: hidden !important;
          }

          .g365-season-long-mobile section,
          .g365-season-long-mobile article,
          .g365-season-long-mobile header,
          .g365-season-long-mobile form,
          .g365-season-long-mobile div {
            min-width: 0;
            max-width: 100%;
          }

          .g365-season-long-mobile h1 {
            font-size: clamp(27px, 8vw, 36px) !important;
            line-height: 1.08 !important;
            overflow-wrap: anywhere;
          }

          .g365-season-long-mobile h2,
          .g365-season-long-mobile h3,
          .g365-season-long-mobile p,
          .g365-season-long-mobile span,
          .g365-season-long-mobile strong {
            overflow-wrap: anywhere;
          }

          .g365-season-long-mobile input,
          .g365-season-long-mobile select,
          .g365-season-long-mobile textarea {
            width: 100% !important;
            max-width: 100% !important;
            min-width: 0 !important;
            font-size: 16px !important;
          }

          .g365-season-long-mobile button,
          .g365-season-long-mobile a {
            max-width: 100%;
          }

          .g365-season-long-mobile :not(button)[style*="grid-template-columns"] {
            grid-template-columns: minmax(0, 1fr) !important;
          }

          .g365-season-long-mobile [style*="white-space: nowrap"],
          .g365-season-long-mobile [style*="white-space:nowrap"] {
            white-space: normal !important;
          }

          .g365-season-long-mobile [style*="overflow-x: auto"],
          .g365-season-long-mobile [style*="overflowX: auto"] {
            max-width: 100%;
            -webkit-overflow-scrolling: touch;
          }

          .g365-standings-table-card {
            overflow: hidden !important;
          }

          .g365-standings-table-header,
          .g365-standings-table-row {
            min-width: 0 !important;
            width: 100% !important;
            grid-template-columns: minmax(0,1fr) 92px 92px !important;
            gap: 8px !important;
            padding: 7px 9px !important;
          }

          .g365-standings-table-row {
            min-height: 46px !important;
          }

          .g365-standings-hide-mobile {
            display: none !important;
          }

          .g365-standings-team-cell {
            gap: 7px !important;
          }

          .g365-standings-team-circle {
            width: 27px !important;
            height: 27px !important;
            font-size: 12px !important;
          }

          .g365-standings-team-name {
            font-size: 12px !important;
            line-height: 1.15 !important;
          }

          .g365-standings-team-meta {
            display: none !important;
          }

          .g365-standings-mobile-stat {
            font-size: 12px !important;
            text-align: right !important;
          }
        }

        @media (max-width: 430px) {
          .g365-season-long-mobile {
            padding-left: 10px !important;
            padding-right: 10px !important;
          }

          .g365-season-long-mobile button {
            min-height: 42px;
          }
        }
      `}</style>

      <div
        style={
          styles.shell
        }
      >
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
              {isSalary
                ? "SEASON-LONG • SALARY"
                : "SEASON-LONG • NO SALARY"}
            </p>

            <h2
              style={
                styles.title
              }
            >
              Standings
            </h2>

            <p
              style={
                styles.subtitle
              }
            >
              {
                access.league.name
              }
              {" • "}
              {
                season
              }
              {" Season"}
            </p>
          </div>


          <div
            style={
              styles.headerCards
            }
          >
            <div
              style={
                styles.headerSummary
              }
            >
              <span
                style={
                  styles.headerSummaryLabel
                }
              >
                LEAGUE LEADER
              </span>

              <strong
                style={
                  styles.headerSummaryValue
                }
              >
                {leader
                  ? leader.teamName
                  : "—"}
              </strong>

              <span
                style={
                  styles.headerSummarySub
                }
              >
                {leader
                  ? `${formatPoints(
                      leader.totalPoints
                    )} pts`
                  : "No scores yet"}
              </span>
            </div>


            <div
              style={
                styles.headerSummary
              }
            >
              <span
                style={
                  styles.headerSummaryLabel
                }
              >
                COMPLETED WEEKS
              </span>

              <strong
                style={
                  styles.headerSummaryGreen
                }
              >
                {
                  completedWeeks
                }
              </strong>

              <span
                style={
                  styles.headerSummarySub
                }
              >
                Finalized scoring
              </span>
            </div>
          </div>
        </header>


        <section
          style={
            styles.contentGrid
          }
        >
          <div
            className="g365-standings-table-card"
            style={
              styles.tableCard
            }
          >
            <div
              className="g365-standings-table-header"
              style={
                styles.tableHeader
              }
            >
              <span className="g365-standings-hide-mobile">
                RK
              </span>

              <span>
                TEAM
              </span>

              <span
                style={
                  styles.numberHeader
                }
              >
                TOTAL PTS
              </span>

              <span className="g365-standings-hide-mobile" style={styles.numberHeader}>
                WEEKS
              </span>

              <span className="g365-standings-hide-mobile" style={styles.numberHeader}>
                AVG
              </span>

              <span className="g365-standings-hide-mobile" style={styles.numberHeader}>
                HIGH
              </span>

              <span className="g365-standings-hide-mobile" style={styles.numberHeader}>
                LOW
              </span>

              <span
                style={
                  styles.numberHeader
                }
              >
                CURRENT WK
              </span>
            </div>


            {rows.length ===
            0 ? (
              <div
                style={
                  styles.emptyState
                }
              >
                Standings are not
                available yet.
              </div>
            ) : (
              rows.map(
                (
                  row
                ) => (
                  <div
                    key={
                      row.fantasyTeamId
                    }
                    className="g365-standings-table-row"
                    style={{
                      ...styles.tableRow,

                      ...(row.isMyTeam
                        ? styles.myTeamRow
                        : {}),

                      ...(row.rank ===
                      1
                        ? styles.firstPlaceRow
                        : {}),
                    }}
                  >
                    <div
                      className="g365-standings-hide-mobile"
                      style={
                        styles.rankCell
                      }
                    >
                      <strong
                        style={{
                          ...styles.rankNumber,

                          ...(row.rank ===
                          1
                            ? styles.firstRank
                            : {}),
                        }}
                      >
                        {
                          row.rank
                        }
                      </strong>
                    </div>


                    <div
                      className="g365-standings-team-cell"
                      style={
                        styles.teamCell
                      }
                    >
                      <div
                        className="g365-standings-team-circle"
                        style={{
                          ...styles.teamCircle,

                          ...(row.isMyTeam
                            ? styles.myTeamCircle
                            : {}),
                        }}
                      >
                        {row.teamName
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
                          className="g365-standings-team-name"
                          style={
                            styles.teamName
                          }
                        >
                          {
                            row.teamName
                          }
                        </strong>

                        <span
                          className="g365-standings-team-meta"
                          style={
                            styles.teamMeta
                          }
                        >
                          {row.isMyTeam
                            ? "MY TEAM"
                            : `${row.weeksScored} WEEK${row.weeksScored === 1 ? "" : "S"} SCORED`}
                        </span>
                      </div>
                    </div>


                    <StatCell
                      value={
                        formatPoints(
                          row.totalPoints
                        )
                      }
                      strong
                      mobileClassName="g365-standings-mobile-stat"
                    />


                    <StatCell
                      value={
                        String(
                          row.weeksScored
                        )
                      }
                    mobileClassName="g365-standings-hide-mobile"
                    />


                    <StatCell
                      value={
                        row.weeksScored >
                        0
                          ? formatPoints(
                              row.averageWeekScore
                            )
                          : "—"
                      }
                    mobileClassName="g365-standings-hide-mobile"
                    />


                    <StatCell
                      value={
                        row.weeksScored >
                        0
                          ? formatPoints(
                              row.highestWeekScore
                            )
                          : "—"
                      }
                      positive={
                        row.weeksScored >
                        0
                      }
                    mobileClassName="g365-standings-hide-mobile"
                    />


                    <StatCell
                      value={
                        row.weeksScored >
                        0
                          ? formatPoints(
                              row.lowestWeekScore
                            )
                          : "—"
                      }
                    mobileClassName="g365-standings-hide-mobile"
                    />


                    <div
                      className="g365-standings-mobile-stat"
                      style={
                        styles.lastWeekCell
                      }
                    >
                      {row.latestFinalWeek !==
                        null &&
                      row.latestFinalWeekPoints !==
                        null ? (
                        <span
                          style={
                            styles.lastWeekValue
                          }
                        >
                          <span className="g365-standings-hide-mobile">
                            W{row.latestFinalWeek}{" • "}
                          </span>
                          {formatPoints(
                            row.latestFinalWeekPoints
                          )}
                        </span>
                      ) : (
                        "—"
                      )}
                    </div>
                  </div>
                )
              )
            )}
          </div>


          <aside
            style={
              styles.sidebar
            }
          >
            <section
              style={
                styles.sideCard
              }
            >
              <h3
                style={
                  styles.sideTitle
                }
              >
                SEASON LEADERS
              </h3>


              <LeaderRow
                place="1"
                team={
                  leader
                    ?.teamName ??
                  "—"
                }
                points={
                  leader
                    ?.totalPoints ??
                  null
                }
                tone="orange"
              />


              <LeaderRow
                place="2"
                team={
                  secondPlace
                    ?.teamName ??
                  "—"
                }
                points={
                  secondPlace
                    ?.totalPoints ??
                  null
                }
                tone="neutral"
              />


              <LeaderRow
                place="3"
                team={
                  thirdPlace
                    ?.teamName ??
                  "—"
                }
                points={
                  thirdPlace
                    ?.totalPoints ??
                  null
                }
                tone="neutral"
              />
            </section>


            <section
              style={
                styles.sideCard
              }
            >
              <h3
                style={
                  styles.sideTitle
                }
              >
                HOW IT WORKS
              </h3>

              <p
                style={
                  styles.sideText
                }
              >
                Season-Long standings
                are ranked by total
                fantasy points earned
                across finalized weeks.
              </p>

              <p
                style={
                  styles.sideText
                }
              >
                <strong>
                  Standings order
                </strong>
              </p>

              <ol
                style={
                  styles.orderList
                }
              >
                <li>
                  Total fantasy points
                </li>

                <li>
                  Finalized weeks only
                </li>

                <li>
                  Highest total ranks first
                </li>
              </ol>

              <p
                style={
                  styles.sideFootnote
                }
              >
                Weekly lineups are
                available from League
                Teams. Standings remain
                focused on finalized
                season scoring and rank.
              </p>
            </section>
          </aside>
        </section>


        <div
          style={
            styles.note
          }
        >
          Standings rebuild from
          finalized Season-Long weekly
          scores. Live or unfinished
          weeks do not count toward
          season totals.
        </div>
      </div>
    </main>
  );
}


function StatCell({
  value,
  strong = false,
  positive = false,
  mobileClassName,
}: {
  value:
    string;

  strong?:
    boolean;

  positive?:
    boolean;

  mobileClassName?:
    string;
}) {
  return (
    <div
      className={mobileClassName}
      style={{
        ...styles.statCell,

        ...(strong
          ? styles.strongStat
          : {}),

        ...(positive
          ? styles.positive
          : {}),
      }}
    >
      {
        value
      }
    </div>
  );
}


function LeaderRow({
  place,
  team,
  points,
  tone,
}: {
  place:
    string;

  team:
    string;

  points:
    number |
    null;

  tone:
    "orange" |
    "neutral";
}) {
  return (
    <div
      style={
        styles.leaderRow
      }
    >
      <div
        style={{
          ...styles.leaderPlace,

          ...(tone ===
          "orange"
            ? styles.leaderPlaceOrange
            : {}),
        }}
      >
        {
          place
        }
      </div>

      <div
        style={
          styles.leaderText
        }
      >
        <strong
          style={
            styles.leaderTeam
          }
        >
          {
            team
          }
        </strong>

        <span
          style={
            styles.leaderPoints
          }
        >
          {points ===
          null
            ? "No score"
            : `${formatPoints(
                points
              )} pts`}
        </span>
      </div>
    </div>
  );
}


const styles = {
  page: {
    minHeight:
      "calc(100vh - 90px)",

    padding:
      "18px 16px 34px",

    background:
      "#0c0d0f",
  },

  shell: {
    width:
      "min(1500px,100%)",

    margin:
      "0 auto",

    display:
      "grid",

    gap:
      "14px",
  },

  pageHeader: {
    display:
      "flex",

    alignItems:
      "flex-end",

    justifyContent:
      "space-between",

    gap:
      "16px",

    flexWrap:
      "wrap" as const,
  },

  eyebrow: {
    margin:
      0,

    color:
      "#ff7a18",

    fontSize:
      "13px",

    fontWeight:
      950,

    letterSpacing:
      ".14em",
  },

  title: {
    margin:
      "4px 0 0",

    color:
      "#fff",

    fontSize:
      "32px",

    lineHeight:
      1,
  },

  subtitle: {
    margin:
      "6px 0 0",

    color:
      "#747b84",

    fontSize:
      "15px",
  },

  headerCards: {
    display:
      "flex",

    alignItems:
      "stretch",

    gap:
      "8px",
  },

  headerSummary: {
    minWidth:
      "145px",

    padding:
      "9px 12px",

    display:
      "grid",

    justifyItems:
      "center",

    gap:
      "2px",

    border:
      "1px solid rgba(255,110,20,.18)",

    borderRadius:
      "7px",

    background:
      "rgba(255,90,10,.035)",
  },

  headerSummaryLabel: {
    color:
      "#7d848e",

    fontSize:
      "11px",

    fontWeight:
      950,

    letterSpacing:
      ".06em",
  },

  headerSummaryValue: {
    maxWidth:
      "180px",

    overflow:
      "hidden",

    textOverflow:
      "ellipsis",

    whiteSpace:
      "nowrap" as const,

    color:
      "#ff8a25",

    fontSize:
      "16px",
  },

  headerSummaryGreen: {
    color:
      "#58dd67",

    fontSize:
      "20px",
  },

  headerSummarySub: {
    color:
      "#7a818a",

    fontSize:
      "12px",
  },

  contentGrid: {
    display:
      "grid",

    gridTemplateColumns:
      "minmax(0,1fr) 270px",

    gap:
      "14px",

    alignItems:
      "start",
  },

  tableCard: {
    overflowX:
      "auto" as const,

    border:
      "1px solid rgba(255,255,255,.08)",

    borderRadius:
      "8px",

    background:
      "linear-gradient(180deg,#151618,#101113)",
  },

  tableHeader: {
    minWidth:
      "900px",

    minHeight:
      "34px",

    padding:
      "7px 12px",

    display:
      "grid",

    gridTemplateColumns:
      "42px minmax(190px,1fr) 100px 70px 85px 85px 85px 110px",

    alignItems:
      "center",

    gap:
      "5px",

    borderBottom:
      "1px solid rgba(255,255,255,.07)",

    color:
      "#707780",

    fontSize:
      "12px",

    fontWeight:
      950,

    letterSpacing:
      ".05em",
  },

  numberHeader: {
    textAlign:
      "right" as const,
  },

  tableRow: {
    minWidth:
      "900px",

    minHeight:
      "52px",

    padding:
      "6px 12px",

    display:
      "grid",

    gridTemplateColumns:
      "42px minmax(190px,1fr) 100px 70px 85px 85px 85px 110px",

    alignItems:
      "center",

    gap:
      "5px",

    borderBottom:
      "1px solid rgba(255,255,255,.045)",
  },

  firstPlaceRow: {
    background:
      "rgba(255,125,25,.018)",
  },

  myTeamRow: {
    background:
      "linear-gradient(90deg,rgba(150,20,18,.23),rgba(255,80,15,.075) 52%,transparent)",

    boxShadow:
      "inset 3px 0 0 #ff7622",
  },

  rankCell: {
    display:
      "flex",

    alignItems:
      "center",
  },

  rankNumber: {
    color:
      "#979da5",

    fontSize:
      "17px",
  },

  firstRank: {
    color:
      "#ff8726",
  },

  teamCell: {
    minWidth:
      0,

    display:
      "flex",

    alignItems:
      "center",

    gap:
      "9px",
  },

  teamCircle: {
    width:
      "32px",

    height:
      "32px",

    flex:
      "0 0 auto",

    display:
      "flex",

    alignItems:
      "center",

    justifyContent:
      "center",

    border:
      "1px solid rgba(255,255,255,.09)",

    borderRadius:
      "50%",

    background:
      "#24272b",

    color:
      "#e8eaed",

    fontSize:
      "15px",

    fontWeight:
      950,
  },

  myTeamCircle: {
    border:
      "1px solid rgba(255,115,25,.65)",

    color:
      "#ff8a2b",
  },

  teamText: {
    minWidth:
      0,

    display:
      "grid",

    gap:
      "2px",
  },

  teamName: {
    overflow:
      "hidden",

    textOverflow:
      "ellipsis",

    whiteSpace:
      "nowrap" as const,

    color:
      "#f5f5f6",

    fontSize:
      "15px",

    fontWeight:
      950,

    textDecoration:
      "none",
  },

  teamMeta: {
    color:
      "#6d747e",

    fontSize:
      "11px",

    fontWeight:
      850,
  },

  statCell: {
    justifySelf:
      "end",

    color:
      "#c6cad0",

    fontSize:
      "15px",

    fontVariantNumeric:
      "tabular-nums",
  },

  strongStat: {
    color:
      "#ffffff",

    fontWeight:
      950,
  },

  positive: {
    color:
      "#46d987",
  },

  lastWeekCell: {
    justifySelf:
      "end",

    color:
      "#9da3ab",

    fontSize:
      "13px",

    fontVariantNumeric:
      "tabular-nums",
  },

  lastWeekValue: {
    color:
      "#ff922d",

    fontWeight:
      900,
  },

  sidebar: {
    display:
      "grid",

    gap:
      "12px",
  },

  sideCard: {
    padding:
      "14px",

    border:
      "1px solid rgba(255,255,255,.11)",

    borderRadius:
      "8px",

    background:
      "linear-gradient(180deg,#121416,#0e1012)",
  },

  sideTitle: {
    margin:
      "0 0 12px",

    color:
      "#f0f1f2",

    fontSize:
      "16px",
  },

  leaderRow: {
    minHeight:
      "54px",

    display:
      "flex",

    alignItems:
      "center",

    gap:
      "10px",

    borderBottom:
      "1px solid rgba(255,255,255,.07)",
  },

  leaderPlace: {
    width:
      "28px",

    height:
      "28px",

    flex:
      "0 0 auto",

    display:
      "flex",

    alignItems:
      "center",

    justifyContent:
      "center",

    border:
      "1px solid rgba(255,255,255,.09)",

    borderRadius:
      "6px",

    color:
      "#9ca3ab",

    fontSize:
      "13px",

    fontWeight:
      950,
  },

  leaderPlaceOrange: {
    border:
      "1px solid rgba(255,120,25,.4)",

    color:
      "#ff8b25",

    background:
      "rgba(255,110,20,.06)",
  },

  leaderText: {
    minWidth:
      0,

    display:
      "grid",

    gap:
      "2px",
  },

  leaderTeam: {
    overflow:
      "hidden",

    textOverflow:
      "ellipsis",

    whiteSpace:
      "nowrap" as const,

    color:
      "#e9eaec",

    fontSize:
      "13px",
  },

  leaderPoints: {
    color:
      "#777e87",

    fontSize:
      "11px",
  },

  sideText: {
    color:
      "#a0a6af",

    fontSize:
      "13px",

    lineHeight:
      1.55,
  },

  orderList: {
    margin:
      "6px 0 10px 18px",

    padding:
      0,

    color:
      "#9ba2ab",

    fontSize:
      "13px",

    lineHeight:
      1.8,
  },

  sideFootnote: {
    margin:
      "10px 0 0",

    color:
      "#777e88",

    fontSize:
      "12px",

    lineHeight:
      1.55,
  },

  emptyState: {
    padding:
      "28px",

    color:
      "#727983",

    fontSize:
      "15px",

    textAlign:
      "center" as const,
  },

  note: {
    padding:
      "9px 11px",

    border:
      "1px solid rgba(255,255,255,.055)",

    borderRadius:
      "6px",

    background:
      "rgba(255,255,255,.015)",

    color:
      "#6e757f",

    fontSize:
      "13px",

    lineHeight:
      1.5,
  },
} as const;