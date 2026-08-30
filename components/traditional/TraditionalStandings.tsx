import {
  createSupabaseServerClient,
} from "@/lib/supabase/server";

import {
  requireTraditionalLeague,
} from "@/lib/traditional/requireTraditionalLeague";


type TraditionalStandingsProps = {
  leagueId: string;
};


type StandingRow = {
  fantasy_team_id: number;
  wins: number;
  losses: number;
  ties: number;
  games_played: number;
  points_for:
    number |
    string;
  points_against:
    number |
    string;
};


type FantasyTeamRow = {
  id: number;
  team_name: string;
};


type MatchupRow = {
  home_fantasy_team_id: number;
  away_fantasy_team_id: number;
  is_final: boolean;
};


type StandingView = {
  rank: number;
  fantasyTeamId: number;
  teamName: string;
  wins: number;
  losses: number;
  ties: number;
  gamesPlayed: number;
  totalScheduledGames: number;
  remainingGames: number;
  winPct: number;
  pointsFor: number;
  pointsAgainst: number;
  pointDiff: number;
  playoffPct: number;
  isMyTeam: boolean;
};


const DEFAULT_PLAYOFF_TEAMS =
  6;


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


function calculateWinPct(
  wins: number,
  ties: number,
  gamesPlayed: number
) {
  if (
    gamesPlayed <=
    0
  ) {
    return 0;
  }


  return (
    wins +
    ties *
      0.5
  ) /
    gamesPlayed;
}


function formatPoints(
  value: number
) {
  return value.toFixed(
    2
  );
}


function formatPct(
  value: number
) {
  return value.toFixed(
    3
  );
}


function clamp(
  value: number,
  min: number,
  max: number
) {
  return Math.max(
    min,
    Math.min(
      max,
      value
    )
  );
}


function getMedian(
  values: number[]
) {
  if (
    values.length ===
    0
  ) {
    return 0;
  }


  const sorted =
    [...values].sort(
      (
        a,
        b
      ) =>
        a -
        b
    );


  const middle =
    Math.floor(
      sorted.length /
      2
    );


  if (
    sorted.length %
      2 ===
    0
  ) {
    return (
      sorted[
        middle -
        1
      ] +
      sorted[
        middle
      ]
    ) /
      2;
  }


  return sorted[
    middle
  ];
}


function calculatePlayoffPct({
  rank,
  teamCount,
  playoffTeams,
  winPct,
  pointsFor,
  medianPointsFor,
  gamesPlayed,
  totalScheduledGames,
}: {
  rank: number;
  teamCount: number;
  playoffTeams: number;
  winPct: number;
  pointsFor: number;
  medianPointsFor: number;
  gamesPlayed: number;
  totalScheduledGames: number;
}) {
  if (
    teamCount <=
    0
  ) {
    return 0;
  }


  /*
   * Before games are played, every team starts with the same
   * baseline chance based on available playoff spots.
   */
  const baseline =
    (
      playoffTeams /
      teamCount
    ) *
    100;


  if (
    gamesPlayed <=
    0
  ) {
    return clamp(
      baseline,
      1,
      99
    );
  }


  const rankDistance =
    playoffTeams -
    rank;


  const rankScore =
    baseline +
    rankDistance *
      8;


  const recordScore =
    (
      winPct -
      0.5
    ) *
    80;


  const pointsDifference =
    pointsFor -
    medianPointsFor;


  const pointsScore =
    clamp(
      pointsDifference /
        3,
      -15,
      15
    );


  const performanceEstimate =
    clamp(
      rankScore +
        recordScore +
        pointsScore,
      1,
      99
    );


  const seasonProgress =
    totalScheduledGames >
    0
      ? clamp(
          gamesPlayed /
            totalScheduledGames,
          0,
          1
        )
      : 0;


  /*
   * Early in the season, stay close to the baseline.
   * As the season progresses, current record/rank/PF matter
   * more heavily.
   */
  return clamp(
    baseline *
      (
        1 -
        seasonProgress
      ) +
      performanceEstimate *
        seasonProgress,
    1,
    99
  );
}


function rankBaseStandings(
  rows:
    Array<
      Omit<
        StandingView,
        | "rank"
        | "playoffPct"
      >
    >
) {
  return [...rows].sort(
    (
      a,
      b
    ) => {
      if (
        b.winPct !==
        a.winPct
      ) {
        return (
          b.winPct -
          a.winPct
        );
      }


      if (
        b.pointsFor !==
        a.pointsFor
      ) {
        return (
          b.pointsFor -
          a.pointsFor
        );
      }


      if (
        a.pointsAgainst !==
        b.pointsAgainst
      ) {
        return (
          a.pointsAgainst -
          b.pointsAgainst
        );
      }


      return a.teamName.localeCompare(
        b.teamName
      );
    }
  );
}


export default async function TraditionalStandings({
  leagueId,
}: TraditionalStandingsProps) {


  const access =
    await requireTraditionalLeague(
      leagueId
    );


  const supabase =
    await createSupabaseServerClient();


  const season =
    access.league.season;


  const {
    error:
      rebuildError,
  } =
    await supabase.rpc(
      "rebuild_traditional_standings",
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
      `Could not rebuild Traditional standings: ${rebuildError.message}`
    );
  }


  const [
    standingsResult,
    teamsResult,
    matchupsResult,
  ] =
    await Promise.all([
      supabase
        .from(
          "traditional_standings"
        )
        .select(`
          fantasy_team_id,
          wins,
          losses,
          ties,
          games_played,
          points_for,
          points_against
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
        ),

      supabase
        .from(
          "traditional_matchups"
        )
        .select(`
          home_fantasy_team_id,
          away_fantasy_team_id,
          is_final
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
    standingsResult.error
  ) {
    throw new Error(
      `Could not load Traditional standings: ${standingsResult.error.message}`
    );
  }


  if (
    teamsResult.error
  ) {
    throw new Error(
      `Could not load fantasy teams: ${teamsResult.error.message}`
    );
  }


  if (
    matchupsResult.error
  ) {
    throw new Error(
      `Could not load Traditional schedule: ${matchupsResult.error.message}`
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


  const matchups =
    (
      matchupsResult.data ??
      []
    ) as MatchupRow[];


  const teamMap =
    new Map<
      number,
      FantasyTeamRow
    >();


  for (
    const team
    of teams
  ) {
    teamMap.set(
      team.id,
      team
    );
  }


  const scheduleCounts =
    new Map<
      number,
      number
    >();


  for (
    const matchup
    of matchups
  ) {
    scheduleCounts.set(
      matchup
        .home_fantasy_team_id,
      (
        scheduleCounts.get(
          matchup
            .home_fantasy_team_id
        ) ??
        0
      ) +
        1
    );


    scheduleCounts.set(
      matchup
        .away_fantasy_team_id,
      (
        scheduleCounts.get(
          matchup
            .away_fantasy_team_id
        ) ??
        0
      ) +
        1
    );
  }


  const myFantasyTeamId =
    access.fantasyTeam
      ?.id ??
    null;


  /*
   * If the standings table is temporarily empty because the
   * RLS policy has not been added yet, build zero-value display
   * rows from fantasy_teams so the league still appears.
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
      standing
        .fantasy_team_id,
      standing
    );
  }


  const baseRows =
    teams.map(
      (
        team
      ) => {
        const row =
          standingByTeam.get(
            team.id
          );


        const wins =
          Number(
            row
              ?.wins ??
            0
          );


        const losses =
          Number(
            row
              ?.losses ??
            0
          );


        const ties =
          Number(
            row
              ?.ties ??
            0
          );


        const gamesPlayed =
          Number(
            row
              ?.games_played ??
            0
          );


        const pointsFor =
          numberValue(
            row
              ?.points_for
          );


        const pointsAgainst =
          numberValue(
            row
              ?.points_against
          );


        const totalScheduledGames =
          scheduleCounts.get(
            team.id
          ) ??
          0;


        return {
          fantasyTeamId:
            team.id,

          teamName:
            team.team_name,

          wins,

          losses,

          ties,

          gamesPlayed,

          totalScheduledGames,

          remainingGames:
            Math.max(
              0,
              totalScheduledGames -
                gamesPlayed
            ),

          winPct:
            calculateWinPct(
              wins,
              ties,
              gamesPlayed
            ),

          pointsFor,

          pointsAgainst,

          pointDiff:
            pointsFor -
              pointsAgainst,

          isMyTeam:
            myFantasyTeamId !==
              null &&
            team.id ===
              myFantasyTeamId,
        };
      }
    );


  const sorted =
    rankBaseStandings(
      baseRows
    );


  const teamCount =
    sorted.length;


  const playoffTeams =
    Math.min(
      DEFAULT_PLAYOFF_TEAMS,
      teamCount
    );


  const medianPointsFor =
    getMedian(
      sorted.map(
        (
          row
        ) =>
          row.pointsFor
      )
    );


  const ranked:
    StandingView[] =
      sorted.map(
        (
          row,
          index
        ) => {
          const rank =
            index +
            1;


          return {
            ...row,

            rank,

            playoffPct:
              calculatePlayoffPct({
                rank,

                teamCount,

                playoffTeams,

                winPct:
                  row.winPct,

                pointsFor:
                  row.pointsFor,

                medianPointsFor,

                gamesPlayed:
                  row.gamesPlayed,

                totalScheduledGames:
                  row.totalScheduledGames,
              }),
          };
        }
      );


  const currentPlayoffTeams =
    ranked.filter(
      (
        row
      ) =>
        row.rank <=
        playoffTeams
    );


  const cutLineTeam =
    currentPlayoffTeams[
      currentPlayoffTeams.length -
      1
    ] ??
    null;


  const cutLinePct =
    cutLineTeam
      ?.playoffPct ??
    0;


  const clinched =
    ranked.filter(
      (
        row
      ) =>
        row.playoffPct >=
        99
    );


  const inTheHunt =
    ranked.filter(
      (
        row
      ) =>
        row.rank >
          playoffTeams &&
        row.playoffPct >=
          25
    );


  const outside =
    ranked.filter(
      (
        row
      ) =>
        row.rank >
          playoffTeams &&
        row.playoffPct <
          25
    );


  return (
    <main
      style={
        styles.page
      }
    >
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
              TRADITIONAL
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
              {access.league.name}
              {" • "}
              {season}
              {" Regular Season"}
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
                PLAYOFF CUT LINE
              </span>

              <strong
                style={
                  styles.headerSummaryValue
                }
              >
                {cutLinePct.toFixed(
                  1
                )}
                %
              </strong>

              <span
                style={
                  styles.headerSummarySub
                }
              >
                Top {playoffTeams} make playoffs
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
                PLAYOFF SPOTS
              </span>

              <strong
                style={
                  styles.headerSummaryGreen
                }
              >
                {playoffTeams}
              </strong>

              <span
                style={
                  styles.headerSummarySub
                }
              >
                of {teamCount} teams
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
            style={
              styles.tableCard
            }
          >
            <div
              style={
                styles.tableHeader
              }
            >
              <span>
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
                W
              </span>

              <span
                style={
                  styles.numberHeader
                }
              >
                L
              </span>

              <span
                style={
                  styles.numberHeader
                }
              >
                T
              </span>

              <span
                style={
                  styles.numberHeader
                }
              >
                PCT
              </span>

              <span
                style={
                  styles.numberHeader
                }
              >
                PF
              </span>

              <span
                style={
                  styles.numberHeader
                }
              >
                PA
              </span>

              <span
                style={
                  styles.numberHeader
                }
              >
                DIFF
              </span>

              <span
                style={
                  styles.numberHeader
                }
              >
                PLAYOFF %
              </span>
            </div>


            {ranked.length ===
            0 ? (
              <div
                style={
                  styles.emptyState
                }
              >
                Standings are not available yet.
              </div>
            ) : (
              ranked.map(
                (
                  row
                ) => (
                  <div
                    key={
                      row.fantasyTeamId
                    }
                  >
                    {row.rank ===
                      playoffTeams +
                        1 ? (
                      <div
                        style={
                          styles.cutLine
                        }
                      >
                        <span />

                        <strong>
                          PLAYOFF CUT LINE
                          {" • "}
                          TOP {playoffTeams}
                        </strong>

                        <span />
                      </div>
                    ) : null}


                    <div
                      style={{
                        ...styles.tableRow,

                        ...(row.isMyTeam
                          ? styles.myTeamRow
                          : {}),

                        ...(row.rank <=
                        playoffTeams
                          ? styles.playoffRow
                          : {}),
                      }}
                    >
                      <div
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
                          {row.rank}
                        </strong>
                      </div>


                      <div
                        style={
                          styles.teamCell
                        }
                      >
                        <div
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
                            style={
                              styles.teamName
                            }
                          >
                            {row.teamName}
                          </strong>

                          <span
                            style={
                              styles.teamMeta
                            }
                          >
                            {row.isMyTeam
                              ? "MY TEAM"
                              : `${row.gamesPlayed} GP • ${row.remainingGames} REM`}
                          </span>
                        </div>
                      </div>


                      <StatCell
                        value={
                          String(
                            row.wins
                          )
                        }
                        strong
                      />

                      <StatCell
                        value={
                          String(
                            row.losses
                          )
                        }
                      />

                      <StatCell
                        value={
                          String(
                            row.ties
                          )
                        }
                      />

                      <StatCell
                        value={
                          formatPct(
                            row.winPct
                          )
                        }
                      />

                      <StatCell
                        value={
                          formatPoints(
                            row.pointsFor
                          )
                        }
                      />

                      <StatCell
                        value={
                          formatPoints(
                            row.pointsAgainst
                          )
                        }
                      />

                      <StatCell
                        value={
                          `${row.pointDiff > 0 ? "+" : ""}${formatPoints(row.pointDiff)}`
                        }
                        positive={
                          row.pointDiff >
                          0
                        }
                        negative={
                          row.pointDiff <
                          0
                        }
                      />

                      <div
                        style={
                          styles.playoffPctCell
                        }
                      >
                        {row.playoffPct.toFixed(
                          1
                        )}
                        %
                      </div>
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
                PLAYOFF PICTURE
              </h3>


              <PictureGroup
                title="Clinched Playoff Berth"
                tone="green"
                teams={
                  clinched.map(
                    (
                      row
                    ) =>
                      row.teamName
                  )
                }
                empty="None"
              />


              <PictureGroup
                title="In The Hunt"
                tone="orange"
                teams={
                  inTheHunt.map(
                    (
                      row
                    ) =>
                      row.teamName
                  )
                }
                empty="None"
              />


              <PictureGroup
                title="On The Outside"
                tone="red"
                teams={
                  outside.map(
                    (
                      row
                    ) =>
                      row.teamName
                  )
                }
                empty={
                  teamCount >
                  playoffTeams
                    ? "Remaining teams"
                    : "None"
                }
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
                Top {playoffTeams} teams currently
                qualify for the playoffs.
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
                  Winning Percentage
                </li>

                <li>
                  Points For
                </li>

                <li>
                  Lower Points Against
                </li>
              </ol>

              <p
                style={
                  styles.sideFootnote
                }
              >
                Playoff % is an estimate based on
                current rank, record, Points For,
                season progress, and remaining
                schedule. It becomes more meaningful
                as games are completed.
              </p>
            </section>
          </aside>
        </section>


        <div
          style={
            styles.note
          }
        >
          Standings rebuild automatically from finalized
          matchups. Playoff odds update from the latest
          record, scoring, and remaining schedule.
        </div>
      </div>
    </main>
  );
}


function StatCell({
  value,
  strong = false,
  positive = false,
  negative = false,
}: {
  value: string;
  strong?: boolean;
  positive?: boolean;
  negative?: boolean;
}) {
  return (
    <div
      style={{
        ...styles.statCell,

        ...(positive
          ? styles.positive
          : {}),

        ...(negative
          ? styles.negative
          : {}),

        ...(strong
          ? styles.strongStat
          : {}),
      }}
    >
      {value}
    </div>
  );
}


function PictureGroup({
  title,
  tone,
  teams,
  empty,
}: {
  title: string;
  tone:
    | "green"
    | "orange"
    | "red";
  teams: string[];
  empty: string;
}) {
  const toneStyle =
    tone ===
    "green"
      ? styles.pictureGreen
      : tone ===
          "orange"
        ? styles.pictureOrange
        : styles.pictureRed;


  return (
    <div
      style={
        styles.pictureGroup
      }
    >
      <strong
        style={{
          ...styles.pictureTitle,
          ...toneStyle,
        }}
      >
        {title}
      </strong>

      {teams.length >
      0 ? (
        teams.slice(
          0,
          5
        ).map(
          (
            team
          ) => (
            <span
              key={
                team
              }
              style={
                styles.pictureTeam
              }
            >
              — {team}
            </span>
          )
        )
      ) : (
        <span
          style={
            styles.pictureTeam
          }
        >
          — {empty}
        </span>
      )}
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

    fontSize: "13px",

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

    fontSize: "32px",

    lineHeight:
      1,
  },


  subtitle: {
    margin:
      "6px 0 0",

    color:
      "#747b84",

    fontSize: "15px",
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

    fontSize: "11px",

    fontWeight:
      950,

    letterSpacing:
      ".06em",
  },


  headerSummaryValue: {
    color:
      "#ff8a25",

    fontSize: "20px",
  },


  headerSummaryGreen: {
    color:
      "#58dd67",

    fontSize: "20px",
  },


  headerSummarySub: {
    color:
      "#7a818a",

    fontSize: "12px",
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
    overflow:
      "hidden",

    border:
      "1px solid rgba(255,255,255,.08)",

    borderRadius:
      "8px",

    background:
      "linear-gradient(180deg,#151618,#101113)",
  },


  tableHeader: {
    minHeight:
      "34px",

    padding:
      "7px 12px",

    display:
      "grid",

    gridTemplateColumns:
      "42px minmax(190px,1fr) 42px 42px 42px 62px 78px 78px 78px 88px",

    alignItems:
      "center",

    gap:
      "5px",

    borderBottom:
      "1px solid rgba(255,255,255,.07)",

    color:
      "#707780",

    fontSize: "12px",

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
    minHeight:
      "52px",

    padding:
      "6px 12px",

    display:
      "grid",

    gridTemplateColumns:
      "42px minmax(190px,1fr) 42px 42px 42px 62px 78px 78px 78px 88px",

    alignItems:
      "center",

    gap:
      "5px",

    borderBottom:
      "1px solid rgba(255,255,255,.045)",
  },


  playoffRow: {
    background:
      "rgba(255,255,255,.008)",
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

    fontSize: "17px",
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

    fontSize: "15px",

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

    fontSize: "15px",
  },


  teamMeta: {
    color:
      "#6d747e",

    fontSize: "11px",

    fontWeight:
      850,
  },


  statCell: {
    justifySelf:
      "end",

    color:
      "#c6cad0",

    fontSize: "15px",

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


  negative: {
    color:
      "#ff5a50",
  },


  playoffPctCell: {
    justifySelf:
      "end",

    color:
      "#ff9a25",

    fontSize: "15px",

    fontWeight:
      950,

    fontVariantNumeric:
      "tabular-nums",
  },


  cutLine: {
    minHeight:
      "30px",

    padding:
      "0 12px",

    display:
      "grid",

    gridTemplateColumns:
      "1fr auto 1fr",

    alignItems:
      "center",

    gap:
      "9px",

    color:
      "#9299a3",

    fontSize: "13px",

    letterSpacing:
      ".04em",

    background:
      "#0d0f11",

    borderBottom:
      "1px solid rgba(255,255,255,.05)",
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

    fontSize: "16px",
  },


  pictureGroup: {
    padding:
      "10px 0",

    display:
      "grid",

    gap:
      "6px",

    borderBottom:
      "1px solid rgba(255,255,255,.07)",
  },


  pictureTitle: {
    fontSize: "14px",
  },


  pictureGreen: {
    color:
      "#58dc65",
  },


  pictureOrange: {
    color:
      "#ff8b25",
  },


  pictureRed: {
    color:
      "#ff4b42",
  },


  pictureTeam: {
    color:
      "#a2a8b0",

    fontSize: "13px",

    lineHeight:
      1.4,
  },


  sideText: {
    color:
      "#a0a6af",

    fontSize: "13px",

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

    fontSize: "13px",

    lineHeight:
      1.8,
  },


  sideFootnote: {
    margin:
      "10px 0 0",

    color:
      "#777e88",

    fontSize: "12px",

    lineHeight:
      1.55,
  },


  emptyState: {
    padding:
      "28px",

    color:
      "#727983",

    fontSize: "15px",

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

    fontSize: "13px",

    lineHeight:
      1.5,
  },
} as const;