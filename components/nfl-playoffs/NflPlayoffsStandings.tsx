import Link from "next/link";

import {
  createSupabaseServerClient,
} from "@/lib/supabase/server";

import {
  requireLeagueMember,
} from "@/lib/leagues/requireLeagueMember";


type Props = {
  leagueId: string;
};


type StandingRow = {
  fantasy_team_id:
    number;

  total_points:
    number |
    string |
    null;

  rounds_scored:
    number |
    null;

  highest_round_score:
    number |
    string |
    null;

  lowest_round_score:
    number |
    string |
    null;

  average_round_score:
    number |
    string |
    null;

  current_rank:
    number |
    null;
};


type TeamRow = {
  id: number;

  team_name: string;
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


function points(
  value:
    number |
    string |
    null |
    undefined
) {
  return numberValue(
    value
  ).toFixed(
    2
  );
}


function medal(
  rank:
    number
) {
  if (
    rank === 1
  ) {
    return "🏆";
  }


  if (
    rank === 2
  ) {
    return "🥈";
  }


  if (
    rank === 3
  ) {
    return "🥉";
  }


  return `#${rank}`;
}


export default async function NflPlayoffsStandings({
  leagueId,
}: Props) {
  const access =
    await requireLeagueMember(
      leagueId
    );


  if (
    access.league.leagueType !==
    "nfl_playoffs"
  ) {
    throw new Error(
      "This standings page is only available for NFL Playoffs leagues."
    );
  }


  const supabase =
    await createSupabaseServerClient();


  const season =
    access.league.season;


  const [
    standingsResult,
    teamsResult,
    stateResult,
  ] =
    await Promise.all([
      supabase
        .from(
          "nfl_playoff_standings"
        )
        .select(`
          fantasy_team_id,
          total_points,
          rounds_scored,
          highest_round_score,
          lowest_round_score,
          average_round_score,
          current_rank
        `)
        .eq(
          "league_id",
          leagueId
        )
        .eq(
          "season",
          season
        )
        .order(
          "current_rank",
          {
            ascending:
              true,
            nullsFirst:
              false,
          }
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
          "nfl_playoff_league_state"
        )
        .select(`
          active_round,
          status,
          champion_fantasy_team_id,
          completed_at
        `)
        .eq(
          "league_id",
          leagueId
        )
        .eq(
          "season",
          season
        )
        .maybeSingle(),
    ]);


  if (
    standingsResult.error
  ) {
    throw new Error(
      `Could not load NFL Playoffs standings: ${standingsResult.error.message}`
    );
  }


  if (
    teamsResult.error
  ) {
    throw new Error(
      `Could not load NFL Playoffs teams: ${teamsResult.error.message}`
    );
  }


  if (
    stateResult.error
  ) {
    throw new Error(
      `Could not load NFL Playoffs league state: ${stateResult.error.message}`
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
    ) as TeamRow[];


  const teamMap =
    new Map<
      number,
      string
    >(
      teams.map(
        (
          team
        ) => [
          team.id,
          team.team_name,
        ]
      )
    );


  const sorted =
    [...standings]
      .sort(
        (
          a,
          b
        ) => {
          const rankA =
            a.current_rank ??
            999999;

          const rankB =
            b.current_rank ??
            999999;


          if (
            rankA !==
            rankB
          ) {
            return (
              rankA -
              rankB
            );
          }


          return (
            numberValue(
              b.total_points
            ) -
            numberValue(
              a.total_points
            )
          );
        }
      );


  const state =
    stateResult.data;


  const activeRound =
    Number(
      state?.active_round ??
      1
    );


  const championId =
    state
      ?.champion_fantasy_team_id ??
    null;


  return (
    <main
      className="g365-nfl-playoffs-standings"
      style={
        styles.page
      }
    >
      <style>{`
        .g365-nfl-playoffs-standings,
        .g365-nfl-playoffs-standings * {
          box-sizing: border-box;
        }

        @media (max-width: 760px) {
          .g365-nflp-standings-header {
            flex-direction: column !important;
            align-items: stretch !important;
          }

          .g365-nflp-standings-summary {
            grid-template-columns: repeat(2,minmax(0,1fr)) !important;
          }

          .g365-nflp-standings-table {
            min-width: 760px;
          }
        }

        @media (max-width: 430px) {
          .g365-nfl-playoffs-standings {
            padding-left: 10px !important;
            padding-right: 10px !important;
          }
        }
      `}</style>


      <div
        style={
          styles.shell
        }
      >
        <header
          className="g365-nflp-standings-header"
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
              G365 • NFL PLAYOFFS
            </div>


            <h1
              style={
                styles.title
              }
            >
              Standings
            </h1>


            <p
              style={
                styles.subtitle
              }
            >
              {access.league.name} • {season}
            </p>
          </div>


          <div
            style={
              styles.actions
            }
          >
            <Link
              href={`/league/${leagueId}/entry`}
              style={
                styles.secondaryButton
              }
            >
              MY ENTRY
            </Link>


            <Link
              href={`/league/${leagueId}/nfl-playoffs/playoffs`}
              style={
                styles.primaryButton
              }
            >
              NFL PLAYOFFS
            </Link>
          </div>
        </header>


        <section
          className="g365-nflp-standings-summary"
          style={
            styles.summary
          }
        >
          <Summary
            label="SEASON"
            value={
              String(
                season
              )
            }
          />


          <Summary
            label="ACTIVE ROUND"
            value={
              String(
                activeRound
              )
            }
          />


          <Summary
            label="TEAMS"
            value={
              String(
                teams.length
              )
            }
          />


          <Summary
            label="STATUS"
            value={
              String(
                state
                  ?.status ??
                "setup"
              )
                .replaceAll(
                  "_",
                  " "
                )
                .toUpperCase()
            }
          />
        </section>


        <section
          style={
            styles.panel
          }
        >
          <div
            style={
              styles.panelHeader
            }
          >
            <div>
              <div
                style={
                  styles.panelEyebrow
                }
              >
                CUMULATIVE RESULTS
              </div>


              <h2
                style={
                  styles.panelTitle
                }
              >
                Postseason Leaderboard
              </h2>
            </div>


            <span
              style={
                styles.panelMeta
              }
            >
              Points accumulate across all four NFL playoff rounds.
            </span>
          </div>


          {sorted.length ===
          0 ? (
            <div
              style={
                styles.empty
              }
            >
              <strong>
                Standings will begin after playoff-round scores are recorded.
              </strong>

              <span>
                Wild Card results will populate this leaderboard automatically.
              </span>
            </div>
          ) : (
            <div
              style={
                styles.tableViewport
              }
            >
              <div
                className="g365-nflp-standings-table"
                style={
                  styles.table
                }
              >
                <div
                  style={{
                    ...styles.row,
                    ...styles.headerRow,
                  }}
                >
                  <span>
                    RANK
                  </span>

                  <span>
                    TEAM
                  </span>

                  <span>
                    TOTAL
                  </span>

                  <span>
                    ROUNDS
                  </span>

                  <span>
                    AVG
                  </span>

                  <span>
                    HIGH
                  </span>

                  <span>
                    LOW
                  </span>
                </div>


                {sorted.map(
                  (
                    row,
                    index
                  ) => {
                    const rank =
                      row.current_rank ??
                      index +
                        1;

                    const champion =
                      championId ===
                      row.fantasy_team_id;


                    return (
                      <div
                        key={
                          row.fantasy_team_id
                        }
                        style={{
                          ...styles.row,

                          ...(rank ===
                          1
                            ? styles.firstRow
                            : {}),
                        }}
                      >
                        <strong
                          style={
                            styles.rank
                          }
                        >
                          {
                            medal(
                              rank
                            )
                          }
                        </strong>


                        <div
                          style={
                            styles.teamCell
                          }
                        >
                          <strong>
                            {teamMap.get(
                              row.fantasy_team_id
                            ) ??
                              `Team ${row.fantasy_team_id}`}
                          </strong>


                          {champion ? (
                            <span
                              style={
                                styles.champion
                              }
                            >
                              G365 CHAMPION
                            </span>
                          ) : null}
                        </div>


                        <strong
                          style={
                            styles.total
                          }
                        >
                          {
                            points(
                              row.total_points
                            )
                          }
                        </strong>


                        <span>
                          {
                            row.rounds_scored ??
                            0
                          }
                        </span>


                        <span>
                          {
                            points(
                              row.average_round_score
                            )
                          }
                        </span>


                        <span>
                          {
                            points(
                              row.highest_round_score
                            )
                          }
                        </span>


                        <span>
                          {
                            points(
                              row.lowest_round_score
                            )
                          }
                        </span>
                      </div>
                    );
                  }
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}


function Summary({
  label,
  value,
}: {
  label: string;

  value: string;
}) {
  return (
    <div
      style={
        styles.summaryCard
      }
    >
      <span
        style={
          styles.summaryLabel
        }
      >
        {label}
      </span>

      <strong
        style={
          styles.summaryValue
        }
      >
        {value}
      </strong>
    </div>
  );
}


const styles:
  Record<
    string,
    React.CSSProperties
  > = {
    page: {
      minHeight:
        "100vh",

      padding:
        "20px 20px 60px",

      background:
        "linear-gradient(180deg,#07080c,#0b0d12 50%,#07080b)",

      color:
        "#f5f7fa",
    },


    shell: {
      width:
        "min(1420px,100%)",

      margin:
        "0 auto",
    },


    hero: {
      display:
        "flex",

      alignItems:
        "center",

      justifyContent:
        "space-between",

      gap:
        18,

      flexWrap:
        "wrap",

      padding:
        20,

      border:
        "1px solid rgba(255,88,28,.28)",

      borderRadius:
        16,

      background:
        "linear-gradient(135deg,rgba(147,15,15,.24),rgba(255,91,27,.09),rgba(255,255,255,.02))",
    },


    eyebrow: {
      color:
        "#ff6a2b",

      fontSize:
        11,

      fontWeight:
        950,

      letterSpacing:
        ".14em",
    },


    title: {
      margin:
        "5px 0 0",

      fontSize:
        34,

      lineHeight:
        1,

      fontWeight:
        950,
    },


    subtitle: {
      margin:
        "8px 0 0",

      color:
        "#9da5b2",

      fontSize:
        13,
    },


    actions: {
      display:
        "flex",

      gap:
        8,

      flexWrap:
        "wrap",
    },


    primaryButton: {
      minHeight:
        42,

      display:
        "inline-flex",

      alignItems:
        "center",

      justifyContent:
        "center",

      padding:
        "0 15px",

      border:
        "1px solid #ff6827",

      borderRadius:
        10,

      background:
        "linear-gradient(90deg,#a91d1d,#f0641f)",

      color:
        "#fff",

      textDecoration:
        "none",

      fontSize:
        11,

      fontWeight:
        950,
    },


    secondaryButton: {
      minHeight:
        42,

      display:
        "inline-flex",

      alignItems:
        "center",

      justifyContent:
        "center",

      padding:
        "0 15px",

      border:
        "1px solid rgba(255,255,255,.12)",

      borderRadius:
        10,

      background:
        "#111318",

      color:
        "#fff",

      textDecoration:
        "none",

      fontSize:
        11,

      fontWeight:
        950,
    },


    summary: {
      display:
        "grid",

      gridTemplateColumns:
        "repeat(4,minmax(0,1fr))",

      gap:
        10,

      marginTop:
        14,
    },


    summaryCard: {
      minWidth:
        0,

      padding:
        14,

      border:
        "1px solid rgba(255,255,255,.08)",

      borderRadius:
        12,

      background:
        "rgba(12,14,18,.88)",
    },


    summaryLabel: {
      display:
        "block",

      color:
        "#7f8999",

      fontSize:
        9,

      fontWeight:
        900,

      letterSpacing:
        ".11em",
    },


    summaryValue: {
      display:
        "block",

      marginTop:
        7,

      color:
        "#fff",

      fontSize:
        18,

      fontWeight:
        950,
    },


    panel: {
      marginTop:
        14,

      padding:
        18,

      border:
        "1px solid rgba(255,255,255,.08)",

      borderRadius:
        16,

      background:
        "rgba(8,10,14,.94)",
    },


    panelHeader: {
      display:
        "flex",

      justifyContent:
        "space-between",

      alignItems:
        "flex-end",

      gap:
        14,

      flexWrap:
        "wrap",

      marginBottom:
        14,
    },


    panelEyebrow: {
      color:
        "#ff6a2b",

      fontSize:
        9,

      fontWeight:
        950,

      letterSpacing:
        ".12em",
    },


    panelTitle: {
      margin:
        "5px 0 0",

      fontSize:
        22,

      fontWeight:
        950,
    },


    panelMeta: {
      color:
        "#7f8999",

      fontSize:
        11,
    },


    tableViewport: {
      width:
        "100%",

      overflowX:
        "auto",
    },


    table: {
      minWidth:
        760,

      display:
        "grid",

      gap:
        5,
    },


    row: {
      display:
        "grid",

      gridTemplateColumns:
        "80px minmax(220px,1.8fr) repeat(5,minmax(90px,.7fr))",

      alignItems:
        "center",

      gap:
        8,

      minHeight:
        54,

      padding:
        "8px 12px",

      border:
        "1px solid rgba(255,255,255,.06)",

      borderRadius:
        10,

      background:
        "#0d1015",

      color:
        "#c8ced8",

      fontSize:
        12,

      fontVariantNumeric:
        "tabular-nums",
    },


    headerRow: {
      minHeight:
        36,

      border:
        "none",

      background:
        "transparent",

      color:
        "#6f7989",

      fontSize:
        9,

      fontWeight:
        950,

      letterSpacing:
        ".08em",
    },


    firstRow: {
      border:
        "1px solid rgba(255,101,33,.35)",

      background:
        "linear-gradient(90deg,rgba(142,25,18,.18),rgba(255,98,29,.06))",
    },


    rank: {
      color:
        "#fff",

      fontSize:
        14,
    },


    teamCell: {
      display:
        "grid",

      gap:
        3,

      minWidth:
        0,
    },


    champion: {
      width:
        "fit-content",

      padding:
        "3px 6px",

      border:
        "1px solid rgba(250,183,62,.35)",

      borderRadius:
        999,

      background:
        "rgba(250,183,62,.08)",

      color:
        "#f6c65c",

      fontSize:
        8,

      fontWeight:
        950,
    },


    total: {
      color:
        "#fff",

      fontSize:
        14,
    },


    empty: {
      minHeight:
        180,

      display:
        "grid",

      placeItems:
        "center",

      alignContent:
        "center",

      gap:
        8,

      padding:
        24,

      border:
        "1px dashed rgba(255,255,255,.12)",

      borderRadius:
        12,

      color:
        "#8993a3",

      textAlign:
        "center",

      fontSize:
        12,
    },
  };