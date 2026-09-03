import Link from "next/link";

import {
  createSupabaseAdminClient,
} from "@/lib/supabase/admin";

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


type SettingsRow = {
  competition_format:
    | "total_points"
    | "head_to_head"
    | null;

  regular_season_weeks:
    number |
    null;
};


type TeamRow = {
  id: number;
  team_name: string;
};


type MatchupRow = {
  id: number;
  week: number;
  home_fantasy_team_id: number;
  away_fantasy_team_id: number | null;
  home_points: number | string | null;
  away_points: number | string | null;
  home_score_final: boolean | null;
  away_score_final: boolean | null;
  is_final: boolean | null;
  winner_fantasy_team_id: number | null;
  is_tie: boolean | null;
  matchup_type: string;
};


function points(
  value:
    | number
    | string
    | null
    | undefined
) {
  const parsed =
    Number(
      value ??
      0
    );

  return Number.isFinite(
    parsed
  )
    ? parsed.toFixed(
        2
      )
    : "0.00";
}


export default async function SeasonLongMatchupsPage({
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
    await requireLeagueMember(
      leagueId
    );

  if (
    access.league.leagueType !==
    "season_long"
  ) {
    throw new Error(
      "This page is only available for Season-Long leagues."
    );
  }

  // Membership is authorized above. Use the server-only admin client
  // for league-shared team/matchup data so RLS cannot hide opponents.
  const supabase =
    createSupabaseAdminClient();

  const season =
    access.league.season;

  const {
    data:
      settingsData,
    error:
      settingsError,
  } =
    await supabase
      .from(
        "season_long_settings"
      )
      .select(`
        competition_format,
        regular_season_weeks
      `)
      .eq(
        "league_id",
        leagueId
      )
      .maybeSingle();

  if (
    settingsError
  ) {
    throw new Error(
      `Could not load Season-Long settings: ${settingsError.message}`
    );
  }

  const settings =
    settingsData as
      SettingsRow |
      null;

  const maxWeek =
    Math.min(
      18,
      Math.max(
        1,
        Number(
          settings?.regular_season_weeks ??
          14
        )
      )
    );

  const {
    data:
      activeWeekData,
    error:
      activeWeekError,
  } =
    await supabase.rpc(
      "get_active_season_long_week",
      {
        p_season:
          season,
      }
    );

  if (
    activeWeekError
  ) {
    throw new Error(
      `Could not load the active Season-Long week: ${activeWeekError.message}`
    );
  }

  const activeWeekNumber =
    Number(
      activeWeekData ??
      1
    );

  const defaultWeek =
    Number.isInteger(
      activeWeekNumber
    )
      ? Math.min(
          maxWeek,
          Math.max(
            1,
            activeWeekNumber
          )
        )
      : 1;

  const requested =
    Number(
      query.week ??
      defaultWeek
    );

  const selectedWeek =
    Number.isInteger(
      requested
    )
      ? Math.min(
          maxWeek,
          Math.max(
            1,
            requested
          )
        )
      : 1;

  if (
    settings?.competition_format !==
    "head_to_head"
  ) {
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
          <section
            style={
              styles.emptyCard
            }
          >
            <h1
              style={
                styles.title
              }
            >
              Head-to-Head Matchups
            </h1>

            <p
              style={
                styles.subtitle
              }
            >
              This Season-Long league is currently using Total Points standings.
            </p>

            <Link
              href={`/league/${leagueId}/standings`}
              style={
                styles.button
              }
            >
              VIEW STANDINGS
            </Link>
          </section>
        </div>
      </main>
    );
  }

  const [
    teamsResult,
    matchupsResult,
  ] =
    await Promise.all([
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
          "season_long_matchups"
        )
        .select(`
          id,
          week,
          home_fantasy_team_id,
          away_fantasy_team_id,
          home_points,
          away_points,
          home_score_final,
          away_score_final,
          is_final,
          winner_fantasy_team_id,
          is_tie,
          matchup_type
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
        )
        .eq(
          "matchup_type",
          "regular_season"
        )
        .order(
          "id",
          {
            ascending:
              true,
          }
        ),
    ]);

  if (
    teamsResult.error
  ) {
    throw new Error(
      `Could not load Season-Long teams: ${teamsResult.error.message}`
    );
  }

  if (
    matchupsResult.error
  ) {
    throw new Error(
      `Could not load Season-Long matchups: ${matchupsResult.error.message}`
    );
  }

  const teams =
    (
      teamsResult.data ??
      []
    ) as TeamRow[];

  const matchups =
    (
      matchupsResult.data ??
      []
    ) as MatchupRow[];

  const teamMap =
    new Map(
      teams.map(
        (
          team
        ) => [
          team.id,
          team.team_name,
        ]
      )
    );

  const myTeamId =
    access.fantasyTeam
      ?.id ??
    null;

  return (
    <main
      className="g365-sl-matchups"
      style={
        styles.page
      }
    >
      <style>{`
        .g365-sl-matchups,
        .g365-sl-matchups * {
          box-sizing: border-box;
        }

        @media (max-width: 760px) {
          .g365-sl-matchups {
            padding: 12px 10px !important;
          }

          .g365-sl-matchups .matchup-grid {
            grid-template-columns:
              minmax(0,1fr) !important;
          }

          .g365-sl-matchups .week-grid {
            grid-template-columns:
              repeat(6,minmax(42px,1fr)) !important;
          }
        }

        @media (max-width: 430px) {
          .g365-sl-matchups .week-grid {
            grid-template-columns:
              repeat(4,minmax(42px,1fr)) !important;
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
            styles.hero
          }
        >
          <div>
            <div
              style={
                styles.eyebrow
              }
            >
              SEASON-LONG • HEAD-TO-HEAD
            </div>

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
              {access.league.name}
              {" • "}
              {season}
              {" • "}
              Week {selectedWeek}
            </p>
          </div>

          <Link
            href={`/league/${leagueId}/standings`}
            style={
              styles.button
            }
          >
            VIEW STANDINGS
          </Link>
        </header>

        <div
          className="week-grid"
          style={
            styles.weekGrid
          }
        >
          {Array.from(
            {
              length:
                maxWeek,
            },
            (
              _,
              index
            ) =>
              index +
              1
          ).map(
            (
              week
            ) => (
              <Link
                key={
                  week
                }
                href={`/league/${leagueId}/season-long/matchups?week=${week}`}
                scroll={
                  false
                }
                style={{
                  ...styles.weekButton,
                  ...(week ===
                  selectedWeek
                    ? styles.weekButtonActive
                    : {}),
                }}
              >
                W{week}
              </Link>
            )
          )}
        </div>

        <section
          className="matchup-grid"
          style={
            styles.matchupGrid
          }
        >
          {matchups.map(
            (
              matchup
            ) => {
              const homeName =
                teamMap.get(
                  matchup.home_fantasy_team_id
                ) ??
                `Team ${matchup.home_fantasy_team_id}`;

              const awayName =
                matchup.away_fantasy_team_id
                  ? teamMap.get(
                      matchup.away_fantasy_team_id
                    ) ??
                    `Team ${matchup.away_fantasy_team_id}`
                  : "BYE";

              const homeMine =
                myTeamId ===
                matchup.home_fantasy_team_id;

              const awayMine =
                myTeamId !==
                  null &&
                myTeamId ===
                  matchup.away_fantasy_team_id;

              const matchupCard = (
                <article
                  style={{
                    ...styles.matchupCard,
                    ...((homeMine ||
                      awayMine)
                      ? styles.myMatchup
                      : {}),
                  }}
                >
                  <div
                    style={
                      styles.matchupHead
                    }
                  >
                    <strong>
                      WEEK {selectedWeek}
                    </strong>

                    <span
                      style={
                        matchup.is_final
                          ? styles.final
                          : styles.live
                      }
                    >
                      {matchup.is_final
                        ? "FINAL"
                        : "OPEN / LIVE"}
                    </span>
                  </div>

                  <TeamLine
                    name={
                      homeName
                    }
                    label="HOME"
                    score={
                      points(
                        matchup.home_points
                      )
                    }
                    winner={
                      matchup.winner_fantasy_team_id ===
                      matchup.home_fantasy_team_id
                    }
                    mine={
                      homeMine
                    }
                  />

                  <div
                    style={
                      styles.vs
                    }
                  >
                    VS
                  </div>

                  <TeamLine
                    name={
                      awayName
                    }
                    label={
                      matchup.away_fantasy_team_id
                        ? "AWAY"
                        : "BYE"
                    }
                    score={
                      matchup.away_fantasy_team_id
                        ? points(
                            matchup.away_points
                          )
                        : "—"
                    }
                    winner={
                      matchup.away_fantasy_team_id !==
                        null &&
                      matchup.winner_fantasy_team_id ===
                        matchup.away_fantasy_team_id
                    }
                    mine={
                      awayMine
                    }
                  />

                  {matchup.is_tie ? (
                    <div
                      style={
                        styles.tie
                      }
                    >
                      TIE
                    </div>
                  ) : null}
                </article>
              );

              if (
                matchup.away_fantasy_team_id ===
                null
              ) {
                return (
                  <div
                    key={
                      matchup.id
                    }
                  >
                    {matchupCard}
                  </div>
                );
              }

              return (
                <Link
                  key={
                    matchup.id
                  }
                  href={`/league/${leagueId}/season-long/matchups/${matchup.id}`}
                  style={
                    styles.matchupLink
                  }
                >
                  {matchupCard}
                </Link>
              );
            }
          )}

          {matchups.length ===
          0 ? (
            <div
              style={
                styles.emptyCard
              }
            >
              No Week {selectedWeek} Head-to-Head matchups exist yet. The commissioner can build the schedule from Commissioner → League & Lineup.
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}


function TeamLine({
  name,
  label,
  score,
  winner,
  mine,
}: {
  name: string;
  label: string;
  score: string;
  winner: boolean;
  mine: boolean;
}) {
  return (
    <div
      style={{
        ...styles.teamLine,
        ...(winner
          ? styles.winner
          : {}),
      }}
    >
      <div
        style={
          styles.teamText
        }
      >
        <span
          style={
            styles.teamLabel
          }
        >
          {label}
          {mine
            ? " • MY TEAM"
            : ""}
        </span>

        <strong>
          {name}
        </strong>
      </div>

      <strong
        style={
          styles.score
        }
      >
        {score}
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
        "22px",
      background:
        "linear-gradient(180deg,#07080c,#0b0d12 50%,#07080b)",
      color:
        "#f5f7fa",
    },

    shell: {
      maxWidth:
        "1400px",
      margin:
        "0 auto",
    },

    hero: {
      display:
        "flex",
      justifyContent:
        "space-between",
      alignItems:
        "center",
      gap:
        "14px",
      flexWrap:
        "wrap",
      marginBottom:
        "13px",
      padding:
        "18px",
      border:
        "1px solid rgba(255,95,40,.25)",
      borderRadius:
        "14px",
      background:
        "linear-gradient(135deg,rgba(150,15,15,.20),rgba(255,95,30,.07))",
    },

    eyebrow: {
      color:
        "#ff702e",
      fontSize:
        "11px",
      fontWeight:
        950,
      letterSpacing:
        ".14em",
    },

    title: {
      margin:
        "5px 0 0",
      fontSize:
        "31px",
      fontWeight:
        950,
    },

    subtitle: {
      margin:
        "6px 0 0",
      color:
        "#9aa1ac",
      fontSize:
        "13px",
    },

    button: {
      minHeight:
        "40px",
      display:
        "inline-flex",
      alignItems:
        "center",
      justifyContent:
        "center",
      padding:
        "8px 12px",
      border:
        "1px solid rgba(255,100,40,.4)",
      borderRadius:
        "8px",
      background:
        "linear-gradient(135deg,#b51b18,#ef531d)",
      color:
        "#fff",
      fontSize:
        "11px",
      fontWeight:
        950,
      textDecoration:
        "none",
    },

    weekGrid: {
      display:
        "grid",
      gridTemplateColumns:
        "repeat(9,minmax(44px,1fr))",
      gap:
        "7px",
      marginBottom:
        "14px",
    },

    weekButton: {
      minHeight:
        "40px",
      display:
        "flex",
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
        "#a4abb5",
      fontSize:
        "11px",
      fontWeight:
        900,
      textDecoration:
        "none",
    },

    weekButtonActive: {
      border:
        "1px solid rgba(255,102,45,.55)",
      background:
        "linear-gradient(135deg,rgba(181,27,24,.34),rgba(239,83,29,.16))",
      color:
        "#fff",
    },

    matchupGrid: {
      display:
        "grid",
      gridTemplateColumns:
        "repeat(2,minmax(0,1fr))",
      gap:
        "11px",
    },

    matchupLink: {
      display: "block",
      color: "inherit",
      textDecoration: "none",
      minWidth: 0,
    },

    matchupCard: {
      padding:
        "13px",
      border:
        "1px solid rgba(255,255,255,.08)",
      borderRadius:
        "12px",
      background:
        "rgba(14,16,21,.92)",
      cursor:
        "pointer",
    },

    myMatchup: {
      border:
        "1px solid rgba(255,100,40,.36)",
      boxShadow:
        "0 0 0 1px rgba(255,100,40,.05) inset",
    },

    matchupHead: {
      display:
        "flex",
      justifyContent:
        "space-between",
      gap:
        "8px",
      marginBottom:
        "10px",
      color:
        "#8e96a1",
      fontSize:
        "10px",
      letterSpacing:
        ".08em",
    },

    final: {
      color:
        "#77e6a1",
      fontWeight:
        900,
    },

    live: {
      color:
        "#ffad73",
      fontWeight:
        900,
    },

    teamLine: {
      minHeight:
        "64px",
      display:
        "flex",
      alignItems:
        "center",
      justifyContent:
        "space-between",
      gap:
        "12px",
      padding:
        "10px",
      border:
        "1px solid rgba(255,255,255,.06)",
      borderRadius:
        "9px",
      background:
        "rgba(255,255,255,.02)",
    },

    winner: {
      background:
        "rgba(35,150,85,.10)",
      border:
        "1px solid rgba(70,220,130,.19)",
    },

    teamText: {
      minWidth:
        0,
      display:
        "grid",
      gap:
        "4px",
    },

    teamLabel: {
      color:
        "#8f96a1",
      fontSize:
        "9px",
      fontWeight:
        900,
      letterSpacing:
        ".08em",
    },

    score: {
      flex:
        "0 0 auto",
      fontSize:
        "22px",
    },

    vs: {
      padding:
        "6px 0",
      textAlign:
        "center",
      color:
        "#686f79",
      fontSize:
        "9px",
      fontWeight:
        950,
      letterSpacing:
        ".18em",
    },

    tie: {
      marginTop:
        "8px",
      textAlign:
        "center",
      color:
        "#ffb06f",
      fontSize:
        "10px",
      fontWeight:
        950,
    },

    emptyCard: {
      padding:
        "24px",
      border:
        "1px solid rgba(255,255,255,.08)",
      borderRadius:
        "12px",
      background:
        "rgba(14,16,21,.92)",
      color:
        "#a1a8b2",
      fontSize:
        "13px",
      lineHeight:
        1.6,
    },
  };
