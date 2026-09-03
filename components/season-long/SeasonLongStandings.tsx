import Link from "next/link";

import {
  createSupabaseAdminClient,
} from "@/lib/supabase/admin";

import {
  requireLeagueMember,
} from "@/lib/leagues/requireLeagueMember";


type Props = {
  leagueId: string;
};


type SettingsRow = {
  competition_format:
    | "total_points"
    | "head_to_head"
    | null;
  regular_season_weeks:
    number |
    null;
  playoffs_enabled:
    boolean |
    null;
  playoff_team_count:
    number |
    null;
};


type TeamRow = {
  id: number;
  team_name: string;
};


type TotalStandingRow = {
  fantasy_team_id: number;
  total_points:
    number |
    string |
    null;
  weeks_scored:
    number |
    null;
  current_rank:
    number |
    null;
};


type H2HStandingRow = {
  fantasy_team_id: number;
  wins: number | null;
  losses: number | null;
  ties: number | null;
  points_for:
    number |
    string |
    null;
  points_against:
    number |
    string |
    null;
  games_played:
    number |
    null;
  win_percentage:
    number |
    string |
    null;
  current_rank:
    number |
    null;
};


type MatchupRow = {
  home_fantasy_team_id:
    number |
    null;
  away_fantasy_team_id:
    number |
    null;
  is_final:
    boolean |
    null;
  matchup_type:
    string |
    null;
};


type H2HView = {
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


function numberValue(
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
    ? parsed
    : 0;
}


function calculateWinPct(
  wins: number,
  ties: number,
  gamesPlayed: number
) {
  if (
    gamesPlayed <= 0
  ) {
    return 0;
  }

  return (
    wins +
    ties * 0.5
  ) /
    gamesPlayed;
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
    values.length === 0
  ) {
    return 0;
  }

  const sorted =
    [...values].sort(
      (a, b) =>
        a - b
    );

  const middle =
    Math.floor(
      sorted.length / 2
    );

  if (
    sorted.length % 2 === 0
  ) {
    return (
      sorted[middle - 1] +
      sorted[middle]
    ) / 2;
  }

  return sorted[middle];
}


/*
 * Same estimate used by the Traditional standings experience:
 * baseline playoff-slot chance early, increasingly influenced by
 * current rank, record and Points For as the regular season advances.
 */
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
    teamCount <= 0 ||
    playoffTeams <= 0
  ) {
    return 0;
  }

  const baseline =
    (
      playoffTeams /
      teamCount
    ) * 100;

  if (
    gamesPlayed <= 0
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
    rankDistance * 8;

  const recordScore =
    (
      winPct -
      0.5
    ) * 80;

  const pointsDifference =
    pointsFor -
    medianPointsFor;

  const pointsScore =
    clamp(
      pointsDifference / 3,
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
    totalScheduledGames > 0
      ? clamp(
          gamesPlayed /
          totalScheduledGames,
          0,
          1
        )
      : 0;

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
    tone === "green"
      ? styles.pictureGreen
      : tone === "orange"
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

      {teams.length > 0 ? (
        <div
          style={
            styles.pictureTeams
          }
        >
          {teams.map(
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
                {team}
              </span>
            )
          )}
        </div>
      ) : (
        <span
          style={
            styles.pictureEmpty
          }
        >
          {empty}
        </span>
      )}
    </div>
  );
}


export default async function SeasonLongStandings({
  leagueId,
}: Props) {
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
    createSupabaseAdminClient();

  const season =
    access.league.season;

  const isSalary =
    access.league.playerSelectionMode ===
    "salary";

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
        regular_season_weeks,
        playoffs_enabled,
        playoff_team_count
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

  const isH2H =
    settings?.competition_format ===
    "head_to_head";

  const {
    error:
      rebuildError,
  } =
    await supabase.rpc(
      isH2H
        ? "rebuild_season_long_h2h_standings"
        : "rebuild_season_long_standings",
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

  const [
    teamsResult,
    standingsResult,
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

      isH2H
        ? supabase
            .from(
              "season_long_h2h_standings"
            )
            .select(`
              fantasy_team_id,
              wins,
              losses,
              ties,
              points_for,
              points_against,
              games_played,
              win_percentage,
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
        : supabase
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

      isH2H
        ? supabase
            .from(
              "season_long_matchups"
            )
            .select(`
              home_fantasy_team_id,
              away_fantasy_team_id,
              is_final,
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
              "matchup_type",
              "regular_season"
            )
        : Promise.resolve({
            data:
              [] as MatchupRow[],
            error: null,
          }),
    ]);

  if (
    teamsResult.error
  ) {
    throw new Error(
      `Could not load Season-Long teams: ${teamsResult.error.message}`
    );
  }

  if (
    standingsResult.error
  ) {
    throw new Error(
      `Could not load Season-Long standings: ${standingsResult.error.message}`
    );
  }

  if (
    matchupsResult.error
  ) {
    throw new Error(
      `Could not load Season-Long H2H schedule: ${matchupsResult.error.message}`
    );
  }

  const teams =
    (
      teamsResult.data ??
      []
    ) as TeamRow[];

  const teamMap =
    new Map(
      teams.map(
        (
          team
        ) => [
          Number(
            team.id
          ),
          team.team_name,
        ]
      )
    );

  const myTeamId =
    access.fantasyTeam
      ?.id ??
    null;

  const rawH2HRows =
    isH2H
      ? (
          standingsResult.data ??
          []
        ) as H2HStandingRow[]
      : [];

  const rawTotalRows =
    !isH2H
      ? (
          standingsResult.data ??
          []
        ) as TotalStandingRow[]
      : [];

  const h2hByTeam =
    new Map(
      rawH2HRows.map(
        (
          row
        ) => [
          Number(
            row.fantasy_team_id
          ),
          row,
        ]
      )
    );

  const scheduleCounts =
    new Map<
      number,
      number
    >();

  for (
    const matchup
    of (
      matchupsResult.data ??
      []
    ) as MatchupRow[]
  ) {
    if (
      matchup.home_fantasy_team_id
    ) {
      scheduleCounts.set(
        Number(
          matchup.home_fantasy_team_id
        ),
        (
          scheduleCounts.get(
            Number(
              matchup.home_fantasy_team_id
            )
          ) ??
          0
        ) +
          1
      );
    }

    if (
      matchup.away_fantasy_team_id
    ) {
      scheduleCounts.set(
        Number(
          matchup.away_fantasy_team_id
        ),
        (
          scheduleCounts.get(
            Number(
              matchup.away_fantasy_team_id
            )
          ) ??
          0
        ) +
          1
      );
    }
  }

  const h2hBase =
    isH2H
      ? teams.map(
          (
            team
          ) => {
            const raw =
              h2hByTeam.get(
                Number(
                  team.id
                )
              );

            const wins =
              Number(
                raw?.wins ??
                0
              );

            const losses =
              Number(
                raw?.losses ??
                0
              );

            const ties =
              Number(
                raw?.ties ??
                0
              );

            const gamesPlayed =
              Number(
                raw?.games_played ??
                0
              );

            const pointsFor =
              numberValue(
                raw?.points_for
              );

            const pointsAgainst =
              numberValue(
                raw?.points_against
              );

            const configuredWeeks =
              Number(
                settings
                  ?.regular_season_weeks ??
                0
              );

            const scheduledGames =
              scheduleCounts.get(
                Number(
                  team.id
                )
              ) ??
              0;

            const totalScheduledGames =
              Math.max(
                scheduledGames,
                configuredWeeks
              );

            return {
              fantasyTeamId:
                Number(
                  team.id
                ),
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
                myTeamId !==
                  null &&
                Number(
                  team.id
                ) ===
                  Number(
                    myTeamId
                  ),
            };
          }
        )
      : [];

  h2hBase.sort(
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

  const teamCount =
    h2hBase.length;

  const playoffsEnabled =
    isH2H &&
    Boolean(
      settings?.playoffs_enabled
    );

  const playoffTeams =
    playoffsEnabled
      ? Math.min(
          Math.max(
            2,
            Number(
              settings
                ?.playoff_team_count ??
              6
            )
          ),
          Math.max(
            0,
            teamCount
          )
        )
      : 0;

  const medianPointsFor =
    getMedian(
      h2hBase.map(
        (
          row
        ) =>
          row.pointsFor
      )
    );

  const ranked:
    H2HView[] =
      h2hBase.map(
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
              playoffsEnabled
                ? calculatePlayoffPct({
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
                  })
                : 0,
          };
        }
      );

  const clinched =
    playoffsEnabled
      ? ranked.filter(
          (
            row
          ) =>
            row.playoffPct >=
            99
        )
      : [];

  const inTheHunt =
    playoffsEnabled
      ? ranked.filter(
          (
            row
          ) =>
            row.rank >
              playoffTeams &&
            row.playoffPct >=
              25
        )
      : [];

  const outside =
    playoffsEnabled
      ? ranked.filter(
          (
            row
          ) =>
            row.rank >
              playoffTeams &&
            row.playoffPct <
              25
        )
      : [];

  const currentField =
    playoffsEnabled
      ? ranked.filter(
          (
            row
          ) =>
            row.rank <=
            playoffTeams
        )
      : [];

  const totalByTeam =
    new Map(
      rawTotalRows.map(
        (
          row
        ) => [
          Number(
            row.fantasy_team_id
          ),
          row,
        ]
      )
    );

  const totalRows:
    TotalStandingRow[] =
      !isH2H
        ? teams.map(
            (
              team
            ) =>
              totalByTeam.get(
                Number(
                  team.id
                )
              ) ?? {
                fantasy_team_id:
                  Number(
                    team.id
                  ),
                total_points: 0,
                weeks_scored: 0,
                current_rank:
                  null,
              }
          )
        : [];

  totalRows.sort(
    (
      a,
      b
    ) => {
      const pointDiff =
        numberValue(
          b.total_points
        ) -
        numberValue(
          a.total_points
        );

      if (
        pointDiff !== 0
      ) {
        return pointDiff;
      }

      return (
        Number(
          a.fantasy_team_id
        ) -
        Number(
          b.fantasy_team_id
        )
      );
    }
  );

  return (
    <main
      className="g365-sl-standings"
      style={
        styles.page
      }
    >
      <style>{`
        .g365-sl-standings,
        .g365-sl-standings * {
          box-sizing: border-box;
        }

        @media (max-width: 900px) {
          .g365-sl-standings .h2h-layout {
            grid-template-columns: 1fr !important;
          }
        }

        @media (max-width: 760px) {
          .g365-sl-standings {
            padding: 12px 10px !important;
            overflow-x: hidden;
          }

          .g365-sl-standings .desktop-only {
            display: none !important;
          }

          .g365-sl-standings .h2h-head,
          .g365-sl-standings .h2h-row {
            grid-template-columns:
              38px minmax(0,1fr) 72px 78px !important;
          }

          .g365-sl-standings .total-head,
          .g365-sl-standings .total-row {
            grid-template-columns:
              38px minmax(0,1fr) 84px 58px !important;
          }

          .g365-sl-standings .summary-grid {
            grid-template-columns:
              repeat(2,minmax(0,1fr)) !important;
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
              SEASON-LONG • {isSalary
                ? "SALARY"
                : "NO SALARY"}
            </div>

            <h1
              style={
                styles.title
              }
            >
              {isH2H
                ? "Head-to-Head Standings"
                : "Standings"}
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
              {isH2H
                ? "Weekly H2H results"
                : "Full-season cumulative points"}
            </p>
          </div>

          {isH2H ? (
            <Link
              href={`/league/${leagueId}/season-long/matchups`}
              style={
                styles.button
              }
            >
              VIEW MATCHUPS
            </Link>
          ) : null}
        </header>

        {isH2H ? (
          <>
            <div
              className="summary-grid"
              style={
                styles.summaryGrid
              }
            >
              <Summary
                label="LEADER"
                value={
                  ranked[0]
                    ?.teamName ??
                  "—"
                }
              />

              <Summary
                label="BEST RECORD"
                value={
                  ranked[0]
                    ? `${ranked[0].wins}-${ranked[0].losses}-${ranked[0].ties}`
                    : "—"
                }
              />

              <Summary
                label="PLAYOFF TEAMS"
                value={
                  playoffsEnabled
                    ? String(
                        playoffTeams
                      )
                    : "OFF"
                }
              />

              <Summary
                label="REGULAR SEASON"
                value={`${Number(settings?.regular_season_weeks ?? 0)} WKS`}
              />
            </div>

            <section
              className="h2h-layout"
              style={
                styles.h2hLayout
              }
            >
              <div
                style={
                  styles.card
                }
              >
                <div
                  className="h2h-head"
                  style={
                    styles.h2hGrid
                  }
                >
                  <span>RK</span>
                  <span>TEAM</span>
                  <span>RECORD</span>
                  <span>PCT</span>
                  <span
                    className="desktop-only"
                  >
                    PF
                  </span>
                  <span
                    className="desktop-only"
                  >
                    PA
                  </span>
                  <span
                    className="desktop-only"
                  >
                    DIFF
                  </span>
                  <span
                    className="desktop-only"
                  >
                    PLAYOFF %
                  </span>
                </div>

                {ranked.map(
                  (
                    row,
                    index
                  ) => (
                    <div
                      key={
                        row.fantasyTeamId
                      }
                    >
                      <div
                        className="h2h-row"
                        style={{
                          ...styles.h2hGrid,
                          ...styles.row,
                          ...(row.isMyTeam
                            ? styles.myRow
                            : {}),
                        }}
                      >
                        <strong
                          style={
                            styles.rank
                          }
                        >
                          {row.rank}
                        </strong>

                        <div
                          style={
                            styles.team
                          }
                        >
                          <strong>
                            {row.teamName}
                          </strong>

                          {row.isMyTeam ? (
                            <span
                              style={
                                styles.mine
                              }
                            >
                              MY TEAM
                            </span>
                          ) : null}
                        </div>

                        <strong>
                          {row.wins}
                          -
                          {row.losses}
                          -
                          {row.ties}
                        </strong>

                        <strong>
                          {formatPct(
                            row.winPct
                          )}
                        </strong>

                        <span
                          className="desktop-only"
                        >
                          {row.pointsFor.toFixed(
                            2
                          )}
                        </span>

                        <span
                          className="desktop-only"
                        >
                          {row.pointsAgainst.toFixed(
                            2
                          )}
                        </span>

                        <span
                          className="desktop-only"
                          style={
                            row.pointDiff >=
                            0
                              ? styles.positive
                              : styles.negative
                          }
                        >
                          {row.pointDiff >
                          0
                            ? "+"
                            : ""}
                          {row.pointDiff.toFixed(
                            2
                          )}
                        </span>

                        <strong
                          className="desktop-only"
                          style={
                            styles.playoffPct
                          }
                        >
                          {playoffsEnabled
                            ? `${row.playoffPct.toFixed(1)}%`
                            : "—"}
                        </strong>
                      </div>

                      {playoffsEnabled &&
                      index ===
                        playoffTeams -
                          1 &&
                      ranked.length >
                        playoffTeams ? (
                        <div
                          style={
                            styles.playoffLine
                          }
                        >
                          <span>
                            PLAYOFF LINE
                          </span>
                          <span>
                            TOP {playoffTeams} CURRENTLY IN
                          </span>
                        </div>
                      ) : null}
                    </div>
                  )
                )}
              </div>

              {playoffsEnabled ? (
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
                      title="Current Playoff Field"
                      tone="green"
                      teams={
                        currentField.map(
                          (
                            row
                          ) =>
                            `#${row.rank} ${row.teamName}`
                        )
                      }
                      empty="None"
                    />

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
                            `${row.teamName} • ${row.playoffPct.toFixed(1)}%`
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
                            `${row.teamName} • ${row.playoffPct.toFixed(1)}%`
                        )
                      }
                      empty={
                        teamCount >
                        playoffTeams
                          ? "None"
                          : "No teams below the line"
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
                      Top{" "}
                      <strong>
                        {playoffTeams}
                      </strong>{" "}
                      teams currently qualify.
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
                      Playoff % uses the same estimate model as Traditional: current rank, record, Points For, season progress and remaining regular-season schedule.
                    </p>
                  </section>
                </aside>
              ) : (
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
                      PLAYOFFS DISABLED
                    </h3>

                    <p
                      style={
                        styles.sideText
                      }
                    >
                      This Head-to-Head league is configured without a fantasy playoff bracket.
                    </p>
                  </section>
                </aside>
              )}
            </section>
          </>
        ) : (
          <section
            style={
              styles.card
            }
          >
            <div
              className="total-head"
              style={
                styles.totalGrid
              }
            >
              <span>RK</span>
              <span>TEAM</span>
              <span>TOTAL PTS</span>
              <span>WEEKS</span>
            </div>

            {totalRows.map(
              (
                row,
                index
              ) => {
                const isMine =
                  myTeamId ===
                  row.fantasy_team_id;

                return (
                  <div
                    key={
                      row.fantasy_team_id
                    }
                    className="total-row"
                    style={{
                      ...styles.totalGrid,
                      ...styles.row,
                      ...(isMine
                        ? styles.myRow
                        : {}),
                    }}
                  >
                    <strong
                      style={
                        styles.rank
                      }
                    >
                      {index + 1}
                    </strong>

                    <div
                      style={
                        styles.team
                      }
                    >
                      <strong>
                        {teamMap.get(
                          row.fantasy_team_id
                        ) ??
                          `Team ${row.fantasy_team_id}`}
                      </strong>

                      {isMine ? (
                        <span
                          style={
                            styles.mine
                          }
                        >
                          MY TEAM
                        </span>
                      ) : null}
                    </div>

                    <strong>
                      {numberValue(
                        row.total_points
                      ).toFixed(
                        2
                      )}
                    </strong>

                    <span>
                      {row.weeks_scored ??
                        0}
                    </span>
                  </div>
                );
              }
            )}
          </section>
        )}

        <div
          style={
            styles.note
          }
        >
          {isH2H
            ? "H2H standings rebuild from finalized weekly matchups. Playoff odds automatically evolve as the regular season is played."
            : "Total Points runs through the full configured season. Final cumulative fantasy points determine the champion; there is no fantasy playoff cutoff."}
        </div>
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
        styles.summary
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
      minHeight: "100vh",
      padding: "22px",
      background:
        "linear-gradient(180deg,#07080c,#0b0d12 50%,#07080b)",
      color: "#f5f7fa",
    },

    shell: {
      maxWidth: "1220px",
      margin: "0 auto",
    },

    hero: {
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: "16px",
      marginBottom: "16px",
      flexWrap: "wrap",
    },

    eyebrow: {
      color: "#ff7a24",
      fontSize: "12px",
      fontWeight: 900,
      letterSpacing: ".08em",
    },

    title: {
      margin: "4px 0 5px",
      fontSize: "clamp(27px,4vw,42px)",
      lineHeight: 1,
    },

    subtitle: {
      margin: 0,
      color: "#9ea3ab",
      fontSize: "14px",
    },

    button: {
      padding: "10px 14px",
      borderRadius: "10px",
      border:
        "1px solid rgba(255,113,31,.42)",
      background:
        "linear-gradient(135deg,#a71912,#e85b19)",
      color: "#fff",
      textDecoration: "none",
      fontWeight: 900,
      fontSize: "12px",
    },

    summaryGrid: {
      display: "grid",
      gridTemplateColumns:
        "repeat(4,minmax(0,1fr))",
      gap: "10px",
      marginBottom: "14px",
    },

    summary: {
      border:
        "1px solid #252a33",
      background:
        "linear-gradient(180deg,#11141a,#0d1015)",
      borderRadius: "12px",
      padding: "12px",
      display: "grid",
      gap: "4px",
    },

    summaryLabel: {
      color: "#828892",
      fontSize: "10px",
      fontWeight: 900,
      letterSpacing: ".08em",
    },

    summaryValue: {
      fontSize: "16px",
      color: "#f5f7fa",
    },

    h2hLayout: {
      display: "grid",
      gridTemplateColumns:
        "minmax(0,1fr) 280px",
      gap: "14px",
      alignItems: "start",
    },

    card: {
      border:
        "1px solid #252a33",
      background:
        "linear-gradient(180deg,#11141a,#0c0f14)",
      borderRadius: "14px",
      overflow: "hidden",
      minWidth: 0,
    },

    h2hGrid: {
      display: "grid",
      gridTemplateColumns:
        "48px minmax(170px,1.35fr) 92px 76px 86px 86px 86px 94px",
      alignItems: "center",
      gap: "8px",
      padding: "10px 12px",
    },

    totalGrid: {
      display: "grid",
      gridTemplateColumns:
        "50px minmax(170px,1fr) 120px 90px",
      alignItems: "center",
      gap: "8px",
      padding: "11px 12px",
    },

    row: {
      borderTop:
        "1px solid #20242c",
      minHeight: "54px",
      fontSize: "13px",
    },

    myRow: {
      background:
        "linear-gradient(90deg,rgba(187,37,23,.18),rgba(255,117,31,.07))",
      boxShadow:
        "inset 3px 0 #ef5a21",
    },

    rank: {
      color: "#ff8a30",
      fontSize: "16px",
    },

    team: {
      minWidth: 0,
      display: "flex",
      alignItems: "center",
      gap: "7px",
      flexWrap: "wrap",
    },

    mine: {
      padding: "2px 5px",
      borderRadius: "999px",
      background:
        "rgba(255,106,30,.13)",
      border:
        "1px solid rgba(255,106,30,.35)",
      color: "#ff984d",
      fontSize: "8px",
      fontWeight: 950,
    },

    positive: {
      color: "#42d982",
    },

    negative: {
      color: "#ff6259",
    },

    playoffPct: {
      color: "#ff984d",
      fontVariantNumeric:
        "tabular-nums",
    },

    playoffLine: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "10px",
      padding: "7px 12px",
      borderTop:
        "2px solid #ff7b25",
      borderBottom:
        "1px solid rgba(255,123,37,.2)",
      background:
        "rgba(255,123,37,.08)",
      color: "#ff9b54",
      fontSize: "9px",
      fontWeight: 950,
      letterSpacing: ".08em",
    },

    sidebar: {
      display: "grid",
      gap: "12px",
      minWidth: 0,
    },

    sideCard: {
      border:
        "1px solid #252a33",
      background:
        "linear-gradient(180deg,#11141a,#0c0f14)",
      borderRadius: "14px",
      padding: "14px",
    },

    sideTitle: {
      margin: "0 0 12px",
      fontSize: "12px",
      letterSpacing: ".08em",
      color: "#f6f7f8",
    },

    pictureGroup: {
      display: "grid",
      gap: "6px",
      padding: "10px 0",
      borderTop:
        "1px solid #222731",
    },

    pictureTitle: {
      fontSize: "10px",
      letterSpacing: ".04em",
    },

    pictureGreen: {
      color: "#42d982",
    },

    pictureOrange: {
      color: "#ff9a43",
    },

    pictureRed: {
      color: "#ff6259",
    },

    pictureTeams: {
      display: "grid",
      gap: "5px",
    },

    pictureTeam: {
      color: "#d7d9dd",
      fontSize: "12px",
    },

    pictureEmpty: {
      color: "#737983",
      fontSize: "11px",
    },

    sideText: {
      color: "#b4b8bf",
      fontSize: "12px",
      lineHeight: 1.55,
    },

    orderList: {
      color: "#c4c7cc",
      fontSize: "12px",
      lineHeight: 1.7,
      paddingLeft: "20px",
    },

    sideFootnote: {
      marginBottom: 0,
      color: "#7f858f",
      fontSize: "11px",
      lineHeight: 1.5,
    },

    note: {
      marginTop: "12px",
      padding: "11px 13px",
      borderRadius: "10px",
      background: "#0f1217",
      border:
        "1px solid #242932",
      color: "#8d939c",
      fontSize: "12px",
    },
  };
