import Link from "next/link";

import {
  redirect,
} from "next/navigation";

import {
  createSupabaseServerClient,
} from "@/lib/supabase/server";

import {
  requireLeagueMember,
} from "@/lib/leagues/requireLeagueMember";


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


type FantasyTeamRow = {
  id:
    number;

  team_name:
    string;

  active:
    boolean;
};


type WeeklyEntryRow = {
  fantasy_team_id:
    number;

  week:
    number;

  status:
    string | null;

  salary_used:
    number | string | null;

  projected_points:
    number | string | null;
};


type WeeklyScoreRow = {
  fantasy_team_id:
    number;

  week:
    number;

  fantasy_points:
    number | string | null;

  salary_used:
    number | string | null;

  lineup_player_count:
    number | null;

  is_final:
    boolean | null;
};


type StandingRow = {
  fantasy_team_id:
    number;

  total_points:
    number | string | null;

  weeks_scored:
    number | null;

  current_rank:
    number | null;
};


type TeamDisplayRow = {
  teamId:
    number;

  teamName:
    string;

  weeklyPoints:
    number;

  projectedPoints:
    number;

  seasonPoints:
    number;

  salaryUsed:
    number | null;

  lineupPlayerCount:
    number;

  entryStatus:
    string;

  isFinal:
    boolean;

  weeklyRank:
    number;
};


function toNumber(
  value:
    number |
    string |
    null |
    undefined
) {
  const parsed =
    Number(
      value ?? 0
    );

  return Number.isFinite(
    parsed
  )
    ? parsed
    : 0;
}


function formatPoints(
  value:
    number |
    string |
    null |
    undefined
) {
  return toNumber(
    value
  ).toFixed(
    2
  );
}


function formatMoney(
  value:
    number |
    string |
    null |
    undefined
) {
  const parsed =
    toNumber(
      value
    );

  return new Intl.NumberFormat(
    "en-US",
    {
      style:
        "currency",

      currency:
        "USD",

      maximumFractionDigits:
        0,
    }
  ).format(
    parsed
  );
}


function formatStatus(
  value:
    string |
    null |
    undefined
) {
  if (
    !value
  ) {
    return "Not Started";
  }

  return value
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


function clampWeek(
  value:
    number
) {
  if (
    !Number.isFinite(
      value
    )
  ) {
    return 1;
  }

  return Math.min(
    18,
    Math.max(
      1,
      Math.trunc(
        value
      )
    )
  );
}


export default async function SeasonLongLeagueTeamsPage({
  params,
  searchParams,
}: PageProps) {
  const {
    leagueId,
  } =
    await params;


  const query =
    await searchParams;


  /*
   * ============================================================
   * LEAGUE ACCESS
   * ============================================================
   */

  const access =
    await requireLeagueMember(
      leagueId
    );


  if (
    access.league.leagueType !==
    "season_long"
  ) {
    redirect(
      `/league/${leagueId}`
    );
  }


  const supabase =
    await createSupabaseServerClient();


  const season =
    access.league.season;


  const isSalaryLeague =
    access.league.playerSelectionMode ===
    "salary";


  /*
   * ============================================================
   * ACTIVE WEEK
   * ============================================================
   *
   * We use the same active-week resolver as My Entry.
   *
   * Future weeks can already exist in the database, so we do NOT
   * use the newest prepared entry as the current week.
   */

  const activeWeekResult =
    await supabase.rpc(
      "get_active_season_long_week",
      {
        p_season:
          season,
      }
    );


  if (
    activeWeekResult.error
  ) {
    throw new Error(
      activeWeekResult
        .error
        .message
    );
  }


  const resolvedActiveWeek =
    clampWeek(
      Number(
        activeWeekResult.data ??
        1
      )
    );


  const requestedWeek =
    Number(
      query.week
    );


  const selectedWeek =
    query.week
      ? clampWeek(
          requestedWeek
        )
      : resolvedActiveWeek;


  /*
   * ============================================================
   * LOAD LEAGUE DATA
   * ============================================================
   */

  const [
    teamsResult,
    entriesResult,
    scoresResult,
    standingsResult,
  ] =
    await Promise.all([
      supabase
        .from(
          "fantasy_teams"
        )
        .select(`
          id,
          team_name,
          active
        `)
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
          "season_long_weekly_entries"
        )
        .select(`
          fantasy_team_id,
          week,
          status,
          salary_used,
          projected_points
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
          "week",
          selectedWeek
        ),

      supabase
        .from(
          "season_long_weekly_scores"
        )
        .select(`
          fantasy_team_id,
          week,
          fantasy_points,
          salary_used,
          lineup_player_count,
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
          "week",
          selectedWeek
        ),

      supabase
        .from(
          "season_long_standings"
        )
        .select(`
          fantasy_team_id,
          total_points,
          weeks_scored,
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
    ]);


  if (
    teamsResult.error
  ) {
    throw new Error(
      teamsResult
        .error
        .message
    );
  }


  if (
    entriesResult.error
  ) {
    throw new Error(
      entriesResult
        .error
        .message
    );
  }


  if (
    scoresResult.error
  ) {
    throw new Error(
      scoresResult
        .error
        .message
    );
  }


  if (
    standingsResult.error
  ) {
    throw new Error(
      standingsResult
        .error
        .message
    );
  }


  const teams =
    (
      teamsResult.data ??
      []
    ) as FantasyTeamRow[];


  const entries =
    (
      entriesResult.data ??
      []
    ) as WeeklyEntryRow[];


  const scores =
    (
      scoresResult.data ??
      []
    ) as WeeklyScoreRow[];


  const standings =
    (
      standingsResult.data ??
      []
    ) as StandingRow[];


  /*
   * ============================================================
   * LOOKUP MAPS
   * ============================================================
   */

  const entryMap =
    new Map<
      number,
      WeeklyEntryRow
    >();


  for (
    const entry
    of entries
  ) {
    entryMap.set(
      entry.fantasy_team_id,
      entry
    );
  }


  const scoreMap =
    new Map<
      number,
      WeeklyScoreRow
    >();


  for (
    const score
    of scores
  ) {
    scoreMap.set(
      score.fantasy_team_id,
      score
    );
  }


  const standingsMap =
    new Map<
      number,
      StandingRow
    >();


  for (
    const standing
    of standings
  ) {
    standingsMap.set(
      standing.fantasy_team_id,
      standing
    );
  }


  /*
   * ============================================================
   * BUILD WEEKLY LEADERBOARD
   * ============================================================
   */

  const rows =
    teams.map(
      (
        team
      ) => {
        const entry =
          entryMap.get(
            team.id
          );


        const score =
          scoreMap.get(
            team.id
          );


        const standing =
          standingsMap.get(
            team.id
          );


        return {
          teamId:
            team.id,

          teamName:
            team.team_name,

          weeklyPoints:
            toNumber(
              score
                ?.fantasy_points
            ),

          projectedPoints:
            toNumber(
              entry
                ?.projected_points
            ),

          seasonPoints:
            toNumber(
              standing
                ?.total_points
            ),

          salaryUsed:
            isSalaryLeague
              ? score
                  ?.salary_used !=
                null
                ? toNumber(
                    score
                      .salary_used
                  )
                : entry
                    ?.salary_used !=
                  null
                  ? toNumber(
                      entry
                        .salary_used
                    )
                  : null
              : null,

          lineupPlayerCount:
            score
              ?.lineup_player_count ??
            0,

          entryStatus:
            formatStatus(
              entry
                ?.status
            ),

          isFinal:
            Boolean(
              score
                ?.is_final
            ),

          weeklyRank:
            0,
        } satisfies TeamDisplayRow;
      }
    );


  /*
   * Weekly ranking is based ONLY on actual weekly fantasy points.
   *
   * Projected points do not break a scoring tie.
   * Example:
   *
   * 180 = Rank 1
   * 175 = Rank 2
   * 175 = Rank 2
   * 160 = Rank 4
   */

  rows.sort(
    (
      a,
      b
    ) => {
      if (
        b.weeklyPoints !==
        a.weeklyPoints
      ) {
        return (
          b.weeklyPoints -
          a.weeklyPoints
        );
      }

      return a.teamName
        .localeCompare(
          b.teamName
        );
    }
  );


  let previousPoints:
    number |
    null =
      null;


  let previousRank =
    0;


  const rankedRows =
    rows.map(
      (
        row,
        index
      ) => {
        let rank =
          index + 1;


        if (
          previousPoints !==
            null &&
          row.weeklyPoints ===
            previousPoints
        ) {
          rank =
            previousRank;
        }


        previousPoints =
          row.weeklyPoints;


        previousRank =
          rank;


        return {
          ...row,

          weeklyRank:
            rank,
        };
      }
    );


  const weekNumbers =
    Array.from(
      {
        length:
          18,
      },
      (
        _,
        index
      ) =>
        index + 1
    );


  const selectedWeekIsActive =
    selectedWeek ===
    resolvedActiveWeek;


  const finalizedTeamCount =
    rankedRows.filter(
      (
        row
      ) =>
        row.isFinal
    ).length;


  return (
    <main
      style={
        styles.page
      }
    >
      <section
        style={
          styles.hero
        }
      >
        <div>
          <div
            style={
              styles.eyebrow
            }
          >
            SEASON-LONG LEAGUE
          </div>

          <h1
            style={
              styles.title
            }
          >
            League Teams
          </h1>

          <p
            style={
              styles.subtitle
            }
          >
            Weekly team rankings and
            league entries.
            Select a team to view
            who they picked.
          </p>
        </div>

        <div
          style={
            styles.heroStats
          }
        >
          <div
            style={
              styles.heroStat
            }
          >
            <span
              style={
                styles.heroStatLabel
              }
            >
              Week
            </span>

            <strong
              style={
                styles.heroStatValue
              }
            >
              {selectedWeek}
            </strong>
          </div>

          <div
            style={
              styles.heroStat
            }
          >
            <span
              style={
                styles.heroStatLabel
              }
            >
              Teams
            </span>

            <strong
              style={
                styles.heroStatValue
              }
            >
              {
                rankedRows.length
              }
            </strong>
          </div>

          <div
            style={
              styles.heroStat
            }
          >
            <span
              style={
                styles.heroStatLabel
              }
            >
              Final
            </span>

            <strong
              style={
                styles.heroStatValue
              }
            >
              {
                finalizedTeamCount
              }
            </strong>
          </div>
        </div>
      </section>


      <section
        style={
          styles.weekBar
        }
      >
        <div
          style={
            styles.weekBarHeading
          }
        >
          <div>
            <div
              style={
                styles.weekBarTitle
              }
            >
              Weekly Rankings
            </div>

            <div
              style={
                styles.weekBarText
              }
            >
              {selectedWeekIsActive
                ? `Week ${selectedWeek} is the current active week.`
                : `Viewing Week ${selectedWeek}.`}
            </div>
          </div>

          {!selectedWeekIsActive && (
            <Link
              href={
                `/league/${leagueId}/teams?week=${resolvedActiveWeek}`
              }
              style={
                styles.currentWeekButton
              }
            >
              Current Week
            </Link>
          )}
        </div>


        <div
          style={
            styles.weekScroller
          }
        >
          {weekNumbers.map(
            (
              week
            ) => {
              const active =
                week ===
                selectedWeek;


              return (
                <Link
                  key={
                    week
                  }
                  href={
                    `/league/${leagueId}/teams?week=${week}`
                  }
                  style={{
                    ...styles.weekButton,

                    ...(active
                      ? styles.weekButtonActive
                      : {}),
                  }}
                >
                  W{week}
                </Link>
              );
            }
          )}
        </div>
      </section>


      <section
        style={
          styles.tableCard
        }
      >
        <div
          style={
            styles.tableHeader
          }
        >
          <div>
            <h2
              style={
                styles.sectionTitle
              }
            >
              Week {selectedWeek}
            </h2>

            <div
              style={
                styles.sectionSubtitle
              }
            >
              Ranked by weekly
              fantasy points
            </div>
          </div>

          <div
            style={
              styles.modeBadge
            }
          >
            {isSalaryLeague
              ? "SALARY"
              : "NO SALARY"}
          </div>
        </div>


        {rankedRows.length ===
        0 ? (
          <div
            style={
              styles.emptyState
            }
          >
            No teams have joined
            this league yet.
          </div>
        ) : (
          <div
            style={
              styles.tableWrap
            }
          >
            <table
              style={
                styles.table
              }
            >
              <thead>
                <tr>
                  <th
                    style={{
                      ...styles.th,
                      ...styles.rankColumn,
                    }}
                  >
                    RK
                  </th>

                  <th
                    style={{
                      ...styles.th,
                      textAlign:
                        "left",
                    }}
                  >
                    TEAM
                  </th>

                  <th
                    style={
                      styles.th
                    }
                  >
                    WEEK PTS
                  </th>

                  <th
                    style={
                      styles.th
                    }
                  >
                    PROJECTED
                  </th>

                  <th
                    style={
                      styles.th
                    }
                  >
                    SEASON PTS
                  </th>

                  {isSalaryLeague && (
                    <th
                      style={
                        styles.th
                      }
                    >
                      SALARY
                    </th>
                  )}

                  <th
                    style={
                      styles.th
                    }
                  >
                    LINEUP
                  </th>

                  <th
                    style={
                      styles.th
                    }
                  >
                    STATUS
                  </th>
                </tr>
              </thead>

              <tbody>
                {rankedRows.map(
                  (
                    row
                  ) => {
                    const isMyTeam =
                      access
                        .fantasyTeam
                        ?.id ===
                      row.teamId;


                    return (
                      <tr
                        key={
                          row.teamId
                        }
                        style={
                          isMyTeam
                            ? styles.myTeamRow
                            : undefined
                        }
                      >
                        <td
                          style={{
                            ...styles.td,
                            ...styles.rankCell,
                          }}
                        >
                          <div
                            style={{
                              ...styles.rankBadge,

                              ...(row.weeklyRank ===
                              1
                                ? styles.rankBadgeFirst
                                : {}),
                            }}
                          >
                            {
                              row.weeklyRank
                            }
                          </div>
                        </td>

                        <td
                          style={{
                            ...styles.td,
                            textAlign:
                              "left",
                          }}
                        >
                          <Link
                            href={
                              `/league/${leagueId}/teams/${row.teamId}?week=${selectedWeek}`
                            }
                            style={
                              styles.teamLink
                            }
                          >
                            {
                              row.teamName
                            }
                          </Link>

                          {isMyTeam && (
                            <span
                              style={
                                styles.myTeamBadge
                              }
                            >
                              YOU
                            </span>
                          )}
                        </td>

                        <td
                          style={{
                            ...styles.td,
                            ...styles.pointsCell,
                          }}
                        >
                          {formatPoints(
                            row.weeklyPoints
                          )}
                        </td>

                        <td
                          style={
                            styles.td
                          }
                        >
                          {formatPoints(
                            row.projectedPoints
                          )}
                        </td>

                        <td
                          style={{
                            ...styles.td,
                            ...styles.seasonPointsCell,
                          }}
                        >
                          {formatPoints(
                            row.seasonPoints
                          )}
                        </td>

                        {isSalaryLeague && (
                          <td
                            style={
                              styles.td
                            }
                          >
                            {row.salaryUsed ===
                            null
                              ? "—"
                              : formatMoney(
                                  row.salaryUsed
                                )}
                          </td>
                        )}

                        <td
                          style={
                            styles.td
                          }
                        >
                          {
                            row.lineupPlayerCount
                          }
                        </td>

                        <td
                          style={
                            styles.td
                          }
                        >
                          <span
                            style={{
                              ...styles.statusBadge,

                              ...(row.isFinal
                                ? styles.statusFinal
                                : {}),
                            }}
                          >
                            {row.isFinal
                              ? "Final"
                              : row.entryStatus}
                          </span>
                        </td>
                      </tr>
                    );
                  }
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>


      <section
        style={
          styles.helpCard
        }
      >
        <div
          style={
            styles.helpIcon
          }
        >
          i
        </div>

        <div>
          <div
            style={
              styles.helpTitle
            }
          >
            Viewing another team
          </div>

          <div
            style={
              styles.helpText
            }
          >
            Click any team name to
            open that team&apos;s
            lineup for Week{" "}
            {selectedWeek}.
          </div>
        </div>
      </section>
    </main>
  );
}


const styles = {
  page: {
    width:
      "min(1420px,100%)",

    margin:
      "0 auto",

    padding:
      "28px 18px 64px",
  },

  hero: {
    display:
      "flex",

    justifyContent:
      "space-between",

    alignItems:
      "flex-end",

    gap:
      "24px",

    flexWrap:
      "wrap" as const,

    marginBottom:
      "22px",
  },

  eyebrow: {
    marginBottom:
      "8px",

    color:
      "#ff7200",

    fontSize:
      "11px",

    fontWeight:
      1000,

    letterSpacing:
      ".14em",
  },

  title: {
    margin:
      0,

    color:
      "#ffffff",

    fontSize:
      "clamp(28px,4vw,46px)",

    fontWeight:
      1000,

    letterSpacing:
      "-.045em",
  },

  subtitle: {
    maxWidth:
      "620px",

    margin:
      "8px 0 0",

    color:
      "#8f96a3",

    fontSize:
      "14px",

    lineHeight:
      1.6,
  },

  heroStats: {
    display:
      "flex",

    gap:
      "8px",
  },

  heroStat: {
    minWidth:
      "88px",

    padding:
      "12px 14px",

    border:
      "1px solid rgba(255,255,255,.08)",

    borderRadius:
      "12px",

    background:
      "rgba(255,255,255,.025)",

    textAlign:
      "center" as const,
  },

  heroStatLabel: {
    display:
      "block",

    marginBottom:
      "4px",

    color:
      "#737a86",

    fontSize:
      "9px",

    fontWeight:
      1000,

    letterSpacing:
      ".11em",
  },

  heroStatValue: {
    color:
      "#ffffff",

    fontSize:
      "18px",

    fontWeight:
      1000,
  },

  weekBar: {
    marginBottom:
      "18px",

    padding:
      "16px",

    border:
      "1px solid rgba(255,255,255,.08)",

    borderRadius:
      "14px",

    background:
      "linear-gradient(180deg,rgba(17,17,20,.96),rgba(10,10,12,.96))",
  },

  weekBarHeading: {
    display:
      "flex",

    alignItems:
      "center",

    justifyContent:
      "space-between",

    gap:
      "16px",

    marginBottom:
      "14px",
  },

  weekBarTitle: {
    color:
      "#ffffff",

    fontSize:
      "14px",

    fontWeight:
      1000,
  },

  weekBarText: {
    marginTop:
      "3px",

    color:
      "#777f8c",

    fontSize:
      "11px",

    fontWeight:
      700,
  },

  currentWeekButton: {
    display:
      "inline-flex",

    alignItems:
      "center",

    justifyContent:
      "center",

    minHeight:
      "34px",

    padding:
      "0 12px",

    border:
      "1px solid rgba(255,114,0,.35)",

    borderRadius:
      "8px",

    background:
      "rgba(255,114,0,.08)",

    color:
      "#ff8a24",

    fontSize:
      "10px",

    fontWeight:
      1000,

    textDecoration:
      "none",
  },

  weekScroller: {
    display:
      "flex",

    gap:
      "6px",

    overflowX:
      "auto" as const,

    paddingBottom:
      "2px",
  },

  weekButton: {
    flex:
      "0 0 auto",

    minWidth:
      "46px",

    minHeight:
      "36px",

    display:
      "inline-flex",

    alignItems:
      "center",

    justifyContent:
      "center",

    border:
      "1px solid rgba(255,255,255,.08)",

    borderRadius:
      "8px",

    background:
      "rgba(255,255,255,.025)",

    color:
      "#858c98",

    fontSize:
      "10px",

    fontWeight:
      1000,

    textDecoration:
      "none",
  },

  weekButtonActive: {
    border:
      "1px solid rgba(255,86,0,.6)",

    background:
      "linear-gradient(135deg,#e93500,#ff7900)",

    color:
      "#ffffff",

    boxShadow:
      "0 8px 22px rgba(255,70,0,.18)",
  },

  tableCard: {
    overflow:
      "hidden",

    border:
      "1px solid rgba(255,255,255,.08)",

    borderRadius:
      "16px",

    background:
      "linear-gradient(180deg,#111114,#09090b)",
  },

  tableHeader: {
    display:
      "flex",

    justifyContent:
      "space-between",

    alignItems:
      "center",

    gap:
      "16px",

    padding:
      "18px 20px",

    borderBottom:
      "1px solid rgba(255,255,255,.07)",
  },

  sectionTitle: {
    margin:
      0,

    color:
      "#ffffff",

    fontSize:
      "17px",

    fontWeight:
      1000,
  },

  sectionSubtitle: {
    marginTop:
      "4px",

    color:
      "#747b87",

    fontSize:
      "10px",

    fontWeight:
      800,

    textTransform:
      "uppercase" as const,

    letterSpacing:
      ".08em",
  },

  modeBadge: {
    padding:
      "6px 9px",

    border:
      "1px solid rgba(255,114,0,.28)",

    borderRadius:
      "999px",

    background:
      "rgba(255,114,0,.07)",

    color:
      "#ff8a24",

    fontSize:
      "9px",

    fontWeight:
      1000,

    letterSpacing:
      ".08em",
  },

  tableWrap: {
    width:
      "100%",

    overflowX:
      "auto" as const,
  },

  table: {
    width:
      "100%",

    minWidth:
      "860px",

    borderCollapse:
      "collapse" as const,
  },

  th: {
    padding:
      "12px 14px",

    borderBottom:
      "1px solid rgba(255,255,255,.06)",

    background:
      "rgba(255,255,255,.018)",

    color:
      "#686f7b",

    fontSize:
      "9px",

    fontWeight:
      1000,

    letterSpacing:
      ".09em",

    textAlign:
      "center" as const,

    whiteSpace:
      "nowrap" as const,
  },

  td: {
    padding:
      "15px 14px",

    borderBottom:
      "1px solid rgba(255,255,255,.055)",

    color:
      "#c8cbd1",

    fontSize:
      "12px",

    fontWeight:
      800,

    textAlign:
      "center" as const,

    whiteSpace:
      "nowrap" as const,
  },

  rankColumn: {
    width:
      "70px",
  },

  rankCell: {
    width:
      "70px",
  },

  rankBadge: {
    width:
      "31px",

    height:
      "31px",

    margin:
      "0 auto",

    display:
      "flex",

    alignItems:
      "center",

    justifyContent:
      "center",

    border:
      "1px solid rgba(255,255,255,.10)",

    borderRadius:
      "9px",

    background:
      "rgba(255,255,255,.04)",

    color:
      "#ffffff",

    fontSize:
      "12px",

    fontWeight:
      1000,
  },

  rankBadgeFirst: {
    border:
      "1px solid rgba(255,114,0,.52)",

    background:
      "linear-gradient(135deg,rgba(225,46,0,.34),rgba(255,121,0,.20))",

    color:
      "#ffb06a",
  },

  teamLink: {
    color:
      "#ffffff",

    fontSize:
      "13px",

    fontWeight:
      1000,

    textDecoration:
      "none",
  },

  myTeamBadge: {
    marginLeft:
      "8px",

    padding:
      "3px 6px",

    borderRadius:
      "5px",

    background:
      "rgba(255,114,0,.13)",

    color:
      "#ff8a24",

    fontSize:
      "8px",

    fontWeight:
      1000,
  },

  pointsCell: {
    color:
      "#ffffff",

    fontSize:
      "14px",

    fontWeight:
      1000,
  },

  seasonPointsCell: {
    color:
      "#ff8a24",

    fontWeight:
      1000,
  },

  statusBadge: {
    display:
      "inline-flex",

    alignItems:
      "center",

    justifyContent:
      "center",

    minWidth:
      "74px",

    padding:
      "5px 8px",

    border:
      "1px solid rgba(255,255,255,.08)",

    borderRadius:
      "999px",

    background:
      "rgba(255,255,255,.035)",

    color:
      "#939aa5",

    fontSize:
      "9px",

    fontWeight:
      1000,
  },

  statusFinal: {
    border:
      "1px solid rgba(51,210,119,.26)",

    background:
      "rgba(51,210,119,.08)",

    color:
      "#56dc8c",
  },

  myTeamRow: {
    background:
      "linear-gradient(90deg,rgba(255,74,0,.055),rgba(255,114,0,.018))",
  },

  emptyState: {
    padding:
      "54px 20px",

    color:
      "#747b87",

    fontSize:
      "13px",

    fontWeight:
      800,

    textAlign:
      "center" as const,
  },

  helpCard: {
    marginTop:
      "14px",

    display:
      "flex",

    alignItems:
      "center",

    gap:
      "12px",

    padding:
      "14px 16px",

    border:
      "1px solid rgba(255,255,255,.06)",

    borderRadius:
      "12px",

    background:
      "rgba(255,255,255,.02)",
  },

  helpIcon: {
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

    borderRadius:
      "50%",

    background:
      "rgba(255,114,0,.10)",

    color:
      "#ff8a24",

    fontSize:
      "12px",

    fontWeight:
      1000,
  },

  helpTitle: {
    color:
      "#d8dadd",

    fontSize:
      "11px",

    fontWeight:
      1000,
  },

  helpText: {
    marginTop:
      "2px",

    color:
      "#747b87",

    fontSize:
      "10px",

    fontWeight:
      700,
  },
};