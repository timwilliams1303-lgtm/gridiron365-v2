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

import {
  getSeasonLongTeamLiveLineupData,
  type SeasonLongLiveLineupPlayer,
} from "@/lib/season-long/team-live-lineup.service";

import InjuryReportButton from "@/components/ui/InjuryReportButton";

import SeasonLongLeagueTeamsRealtime from "@/components/season-long/SeasonLongLeagueTeamsRealtime";


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


function formatProjection(
  value:
    number |
    string |
    null |
    undefined
) {
  return toNumber(
    value
  ).toFixed(1);
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



function gameLabel(
  player: SeasonLongLiveLineupPlayer
) {
  const context =
    player.gameContext;

  if (
    player.scoreIsFinal ||
    context?.statusCompleted
  ) {
    return "FINAL";
  }

  if (
    player.scoreIsLive ||
    context?.isActuallyLive
  ) {
    const period =
      context?.period ?? null;

    const quarter =
      period === 1
        ? "Q1"
        : period === 2
          ? "Q2"
          : period === 3
            ? "Q3"
            : period === 4
              ? "Q4"
              : period === 5
                ? "OT"
                : "";

    const detail =
      [
        quarter,
        context?.clock,
      ]
        .filter(Boolean)
        .join(" ");

    return detail
      ? `LIVE ${detail}`
      : "LIVE";
  }

  if (
    !player.nflGameId &&
    !player.opponentAbbreviation
  ) {
    return "BYE";
  }

  return "UPCOMING";
}


function getMatchupDifficulty(
  rank: number | null
) {
  if (!rank) {
    return {
      label: "N/A",
      detail: "Matchup rank unavailable",
      style: styles.matchupNeutral,
    };
  }

  if (rank <= 10) {
    return {
      label: "HARD",
      detail: `Hard matchup · #${rank} vs position`,
      style: styles.matchupHard,
    };
  }

  if (rank <= 22) {
    return {
      label: "MEDIUM",
      detail: `Medium matchup · #${rank} vs position`,
      style: styles.matchupMedium,
    };
  }

  return {
    label: "EASY",
    detail: `Easy matchup · #${rank} vs position`,
    style: styles.matchupEasy,
  };
}



function getInjuryDisplay(
  status: string | null,
  injuryType?: string | null,
  injuryDetail?: string | null
) {
  if (!status) return null;

  const normalized = status.trim().toUpperCase();

  if (
    !normalized ||
    ["ACTIVE", "HEALTHY", "NORMAL"].includes(normalized)
  ) {
    return null;
  }

  let code = normalized;
  let label = status;

  if (normalized === "Q" || normalized.includes("QUESTION")) {
    code = "Q";
    label = "Questionable";
  } else if (normalized === "D" || normalized.includes("DOUBT")) {
    code = "D";
    label = "Doubtful";
  } else if (normalized === "O" || normalized.includes("OUT")) {
    code = "OUT";
    label = "Out";
  } else if (
    normalized === "IR" ||
    normalized.includes("INJURED RESERVE")
  ) {
    code = "IR";
    label = "Injured Reserve";
  } else if (
    normalized === "PUP" ||
    normalized.includes("PHYSICALLY UNABLE")
  ) {
    code = "PUP";
    label = "Physically Unable to Perform";
  } else if (
    normalized === "NFI" ||
    normalized.includes("NON-FOOTBALL") ||
    normalized.includes("NON FOOTBALL")
  ) {
    code = "NFI";
    label = "Non-Football Injury";
  } else if (
    normalized === "SUSP" ||
    normalized === "SUS" ||
    normalized.includes("SUSPEND")
  ) {
    code = "SUSP";
    label = "Suspended";
  } else if (
    normalized === "DTD" ||
    normalized.includes("DAY-TO-DAY") ||
    normalized.includes("DAY TO DAY")
  ) {
    code = "DTD";
    label = "Day-to-Day";
  } else if (normalized.length > 4) {
    code = "INJ";
  }

  const details = [
    label,
    injuryType,
    injuryDetail,
  ].filter(
    (value): value is string =>
      Boolean(value?.trim())
  );

  return {
    code,
    detail: details.join(" • "),
  };
}

function playerMeta(
  player: SeasonLongLiveLineupPlayer
) {
  if (!player.isRevealed) {
    return "Selection hidden until kickoff";
  }

  const team =
    player.teamAbbreviation ??
    "FA";

  const opponent =
    player.opponentAbbreviation
      ? `${
          player.opponentPrefix ??
          "vs"
        } ${player.opponentAbbreviation}`
      : "BYE";

  return `${team} • ${opponent}`;
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
   * LIVE LINEUP DATA
   * ============================================================
   *
   * League Teams must use the SAME current lineup rows that My Entry
   * writes to season_long_weekly_lineups.  The weekly entry/score
   * summary tables can legitimately lag behind an owner making a
   * lineup change, so they are not the source of truth for the
   * current lineup, salary used, projections, or player count.
   */

  const teamLineupResults =
    await Promise.all(
      teams.map(
        async (team) => {
          const lineup =
            await getSeasonLongTeamLiveLineupData(
              supabase,
              {
                leagueId,

                fantasyTeamId:
                  team.id,

                viewerFantasyTeamId:
                  access.fantasyTeam
                    ?.id ?? null,

                season,

                week:
                  selectedWeek,

                selectionMode:
                  isSalaryLeague
                    ? "salary"
                    : "no_salary",

                activeWeek:
                  resolvedActiveWeek,
              }
            );

          return [
            team.id,
            lineup,
          ] as const;
        }
      )
    );


  const teamLineupMap =
    new Map(
      teamLineupResults
    );


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


        const liveLineup =
          teamLineupMap.get(
            team.id
          );


        return {
          teamId:
            team.id,

          teamName:
            team.team_name,

          weeklyPoints:
            toNumber(
              liveLineup
                ?.weekPoints ??
              score
                ?.fantasy_points
            ),

          projectedPoints:
            toNumber(
              liveLineup
                ?.projectedPoints ??
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
              ? liveLineup
                  ?.salaryUsed ??
                (
                  score
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
                )
              : null,

          lineupPlayerCount:
            liveLineup
              ?.lineupPlayerCount ??
            score
              ?.lineup_player_count ??
            0,

          entryStatus:
            formatStatus(
              liveLineup
                ?.entryStatus ??
              entry
                ?.status
            ),

          isFinal:
            liveLineup
              ?.isFinal ??
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

      <style>{`
        @media (max-width: 760px) {
          .g365-mobile-page-header,
          .g365-mobile-hero,
          .g365-mobile-week-header,
          .g365-mobile-section-header {
            align-items: flex-start !important;
            flex-direction: column !important;
            gap: 10px !important;
          }

          .g365-mobile-header-actions,
          .g365-mobile-week-nav,
          .g365-mobile-week-buttons {
            width: 100% !important;
            max-width: 100% !important;
            overflow-x: auto !important;
            flex-wrap: nowrap !important;
            -webkit-overflow-scrolling: touch;
          }

          .g365-mobile-summary-grid,
          .g365-mobile-team-grid,
          .g365-mobile-matchup-grid {
            grid-template-columns: repeat(2, minmax(0,1fr)) !important;
            gap: 8px !important;
          }

          .g365-mobile-player-row,
          .g365-mobile-team-row {
            min-width: 0 !important;
          }

          .g365-mobile-player-identity {
            min-width: 0 !important;
          }

          .g365-mobile-status-column {
            min-width: 0 !important;
          }

          .g365-mobile-week-viewport,
          .g365-mobile-table-wrap,
          .g365-mobile-lineup-viewport {
            width: 100% !important;
            max-width: 100% !important;
            overflow-x: auto !important;
            -webkit-overflow-scrolling: touch;
          }

          .g365-mobile-lineup-grid {
            min-width: 760px !important;
          }
        }

        @media (max-width: 430px) {
          .g365-mobile-summary-grid,
          .g365-mobile-team-grid,
          .g365-mobile-matchup-grid {
            grid-template-columns: minmax(0,1fr) !important;
          }

          .g365-mobile-player-row {
            gap: 8px !important;
          }
        }
      `}</style>
      <SeasonLongLeagueTeamsRealtime
        leagueId={leagueId}
        season={season}
        week={selectedWeek}
        enabled={selectedWeekIsActive}
      />
      <section
        className="g365-mobile-hero"
        style={styles.hero}
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
            Use the + / − control to
            expand or minimize a team.
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
              styles.teamList
            }
          >
            {rankedRows.map(
              (
                row
              ) => {
                const isMyTeam =
                  access
                    .fantasyTeam
                    ?.id ===
                  row.teamId;

                const lineup =
                  teamLineupMap.get(
                    row.teamId
                  );

                return (
                  <details
                    key={
                      row.teamId
                    }
                    className="g365-team-details"
                    style={{
                      ...styles.teamDetails,

                      ...(isMyTeam
                        ? styles.myTeamDetails
                        : {}),
                    }}
                  >
                    <summary
                      className="g365-team-summary"
                      style={
                        styles.teamSummary
                      }
                    >
                      <div
                        style={
                          styles.teamSummaryLeft
                        }
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

                        <div
                          style={
                            styles.teamIdentity
                          }
                        >
                          <div
                            style={
                              styles.teamNameLine
                            }
                          >
                            <strong
                              style={
                                styles.teamName
                              }
                            >
                              {
                                row.teamName
                              }
                            </strong>

                            {isMyTeam && (
                              <span
                                style={
                                  styles.myTeamBadge
                                }
                              >
                                YOU
                              </span>
                            )}
                          </div>

                          <div
                            style={
                              styles.teamSummaryMeta
                            }
                          >
                            {row.isFinal
                              ? "Final"
                              : row.entryStatus}
                            {" • "}
                            {row.lineupPlayerCount} players
                          </div>
                        </div>
                      </div>

                      <div
                        style={
                          styles.teamSummaryRight
                        }
                      >
                        <div
                          style={
                            styles.summaryMetric
                          }
                        >
                          <span
                            style={
                              styles.summaryMetricLabel
                            }
                          >
                            WEEK
                          </span>

                          <strong
                            style={
                              styles.summaryMetricValue
                            }
                          >
                            {formatPoints(
                              row.weeklyPoints
                            )}
                          </strong>
                        </div>

                        <div
                          style={
                            styles.summaryMetric
                          }
                        >
                          <span
                            style={
                              styles.summaryMetricLabel
                            }
                          >
                            PROJ
                          </span>

                          <strong
                            style={
                              styles.summaryMetricValue
                            }
                          >
                            {formatProjection(
                              row.projectedPoints
                            )}
                          </strong>
                        </div>

                        <div
                          style={
                            styles.summaryMetric
                          }
                        >
                          <span
                            style={
                              styles.summaryMetricLabel
                            }
                          >
                            SEASON
                          </span>

                          <strong
                            style={
                              styles.summaryMetricValueOrange
                            }
                          >
                            {formatPoints(
                              row.seasonPoints
                            )}
                          </strong>
                        </div>

                        {isSalaryLeague && (
                          <div
                            style={
                              styles.summaryMetric
                            }
                          >
                            <span
                              style={
                                styles.summaryMetricLabel
                              }
                            >
                              SALARY
                            </span>

                            <strong
                              style={
                                styles.summaryMetricValue
                              }
                            >
                              {row.salaryUsed ===
                              null
                                ? "—"
                                : formatMoney(
                                    row.salaryUsed
                                  )}
                            </strong>
                          </div>
                        )}

                        <span
                          aria-hidden="true"
                          className="g365-team-toggle"
                        >
                          <span className="g365-team-plus">
                            +
                          </span>

                          <span className="g365-team-minus">
                            −
                          </span>
                        </span>
                      </div>
                    </summary>

                    <div
                      style={
                        styles.expandedTeam
                      }
                    >
                      <div
                        style={
                          styles.expandedHeader
                        }
                      >
                        <div>
                          <div
                            style={
                              styles.expandedEyebrow
                            }
                          >
                            WEEK {selectedWeek} LINEUP
                          </div>

                          <h3
                            style={
                              styles.expandedTitle
                            }
                          >
                            {row.teamName}
                          </h3>
                        </div>

                        <div
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
                        </div>
                      </div>

                      {!lineup ||
                      lineup.players.length ===
                      0 ? (
                        <div
                          style={
                            styles.lineupEmpty
                          }
                        >
                          No lineup has been
                          submitted for Week{" "}
                          {selectedWeek}.
                        </div>
                      ) : (
                        <div
                          className="g365-mobile-lineup-grid"
                          style={styles.lineupGrid}
                        >
                          {lineup.players.map(
                            (
                              player
                            ) => {
                              const status =
                                gameLabel(
                                  player
                                );

                              const live =
                                status.startsWith(
                                  "LIVE"
                                );

                              return (
                                <div
                                  key={
                                    `${player.lineupSlot}:` +
                                    `${player.slotIndex}:` +
                                    `${player.playerId}`
                                  }
                                  style={{
                                    ...styles.playerCard,

                                    ...(live
                                      ? styles.playerCardLive
                                      : {}),
                                  }}
                                >
                                  <div
                                    style={
                                      styles.playerTop
                                    }
                                  >
                                    <span
                                      style={
                                        styles.slotBadge
                                      }
                                    >
                                      {
                                        player.lineupSlot
                                      }
                                    </span>

                                    <span
                                      style={{
                                        ...styles.gameBadge,

                                        ...(live
                                          ? styles.gameBadgeLive
                                          : {}),

                                        ...(status ===
                                        "FINAL"
                                          ? styles.gameBadgeFinal
                                          : {}),
                                      }}
                                    >
                                      {status}
                                    </span>
                                  </div>

                                  <strong
                                    style={
                                      styles.playerName
                                    }
                                  >
                                    {
                                      player.fullName
                                    }
                                  </strong>

                                  <div
                                    style={
                                      styles.playerMeta
                                    }
                                  >
                                    {playerMeta(
                                      player
                                    )}
                                  </div>

                                  {(() => {
                                    const injury =
                                      getInjuryDisplay(
                                        player.injuryStatus,
                                        player.injuryType,
                                        player.injuryDetail
                                      );

                                    if (
                                      !player.isRevealed ||
                                      !injury
                                    ) {
                                      return null;
                                    }

                                    return (
                                      <InjuryReportButton
                                        status={player.injuryStatus}
                                        injuryType={player.injuryType}
                                        injuryDetail={player.injuryDetail}
                                        playerName={player.fullName}
                                      />
                                    );
                                  })()}

                                  {player.isRevealed &&
                                  player.opponentAbbreviation ? (
                                    <div
                                      style={
                                        styles.matchupLine
                                      }
                                      title={
                                        getMatchupDifficulty(
                                          player.matchupRank
                                        ).detail
                                      }
                                    >
                                      <strong
                                        style={
                                          getMatchupDifficulty(
                                            player.matchupRank
                                          ).style
                                        }
                                      >
                                        {getMatchupDifficulty(
                                          player.matchupRank
                                        ).label}
                                        {player.matchupRank
                                          ? ` · #${player.matchupRank}`
                                          : ""}
                                      </strong>
                                      <span>
                                        vs {player.position}
                                      </span>
                                    </div>
                                  ) : null}

                                  <div
                                    style={
                                      styles.playerNumbers
                                    }
                                  >
                                    <div>
                                      <span
                                        style={
                                          styles.playerNumberLabel
                                        }
                                      >
                                        PROJ
                                      </span>

                                      <strong
                                        style={
                                          styles.playerNumber
                                        }
                                      >
                                        {formatProjection(
                                          player.projectedPoints
                                        )}
                                      </strong>
                                    </div>

                                    <div>
                                      <span
                                        style={
                                          styles.playerNumberLabel
                                        }
                                      >
                                        PTS
                                      </span>

                                      <strong
                                        style={{
                                          ...styles.playerNumber,

                                          ...(live
                                            ? styles.livePoints
                                            : {}),
                                        }}
                                      >
                                        {formatPoints(
                                          player.fantasyPoints
                                        )}
                                      </strong>
                                    </div>

                                    {isSalaryLeague && (
                                      <div>
                                        <span
                                          style={
                                            styles.playerNumberLabel
                                          }
                                        >
                                          SALARY
                                        </span>

                                        <strong
                                          style={
                                            styles.playerNumber
                                          }
                                        >
                                          {player.salary ===
                                          null
                                            ? "—"
                                            : formatMoney(
                                                player.salary
                                              )}
                                        </strong>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            }
                          )}
                        </div>
                      )}
                    </div>
                  </details>
                );
              }
            )}
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
            League team lineups
          </div>

          <div
            style={
              styles.helpText
            }
          >
            Teams start minimized.
            Use + to view a Week{" "}
            {selectedWeek} lineup and
            − to minimize it again.
          </div>
        </div>
      </section>

      <style>{`
        .g365-team-summary::-webkit-details-marker {
          display: none;
        }

        .g365-team-summary::marker {
          display: none;
          content: "";
        }

        .g365-team-summary {
          list-style: none;
        }

        .g365-team-summary:hover {
          background: rgba(255,255,255,.025);
        }

        .g365-team-toggle {
          width: 34px;
          height: 34px;
          flex: 0 0 34px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: 1px solid rgba(255,114,0,.42);
          border-radius: 9px;
          background: rgba(255,114,0,.08);
          color: #ff8a24;
          font-size: 22px;
          font-weight: 900;
          line-height: 1;
        }

        .g365-team-minus {
          display: none;
        }

        .g365-team-details[open] .g365-team-plus {
          display: none;
        }

        .g365-team-details[open] .g365-team-minus {
          display: inline;
        }

        .g365-team-details[open] .g365-team-summary {
          border-bottom: 1px solid rgba(255,255,255,.07);
          background: linear-gradient(
            90deg,
            rgba(255,70,0,.045),
            rgba(255,114,0,.012)
          );
        }

        @media (max-width: 900px) {
          .g365-team-summary {
            align-items: flex-start !important;
          }
        }

        @media (max-width: 680px) {
          .g365-team-summary {
            padding: 14px !important;
          }

          .g365-team-toggle {
            width: 32px;
            height: 32px;
            flex-basis: 32px;
          }
        }
      `}</style>
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
  teamList: {
    display:
      "grid",

    gap:
      "8px",

    padding:
      "10px",
  },

  teamDetails: {
    overflow:
      "hidden",

    border:
      "1px solid rgba(255,255,255,.075)",

    borderRadius:
      "12px",

    background:
      "linear-gradient(180deg,#0f1013,#0b0c0e)",
  },

  myTeamDetails: {
    border:
      "1px solid rgba(255,114,0,.22)",

    boxShadow:
      "inset 3px 0 0 rgba(255,100,0,.55)",
  },

  teamSummary: {
    minHeight:
      "74px",

    padding:
      "14px 16px",

    display:
      "flex",

    alignItems:
      "center",

    justifyContent:
      "space-between",

    gap:
      "18px",

    cursor:
      "pointer",

    userSelect:
      "none" as const,
  },

  teamSummaryLeft: {
    minWidth:
      0,

    display:
      "flex",

    alignItems:
      "center",

    gap:
      "12px",
  },

  teamIdentity: {
    minWidth:
      0,
  },

  teamNameLine: {
    display:
      "flex",

    alignItems:
      "center",

    gap:
      "7px",

    flexWrap:
      "wrap" as const,
  },

  teamName: {
    color:
      "#ffffff",

    fontSize:
      "14px",

    fontWeight:
      1000,

    lineHeight:
      1.2,
  },

  teamSummaryMeta: {
    marginTop:
      "4px",

    color:
      "#747b87",

    fontSize:
      "10px",

    fontWeight:
      800,
  },

  teamSummaryRight: {
    display:
      "flex",

    alignItems:
      "center",

    justifyContent:
      "flex-end",

    gap:
      "16px",

    flexWrap:
      "wrap" as const,
  },

  summaryMetric: {
    minWidth:
      "58px",

    textAlign:
      "right" as const,
  },

  summaryMetricLabel: {
    display:
      "block",

    marginBottom:
      "2px",

    color:
      "#656d79",

    fontSize:
      "8px",

    fontWeight:
      1000,

    letterSpacing:
      ".08em",
  },

  summaryMetricValue: {
    color:
      "#f4f5f7",

    fontSize:
      "12px",

    fontWeight:
      1000,

    fontVariantNumeric:
      "tabular-nums",
  },

  summaryMetricValueOrange: {
    color:
      "#ff8a24",

    fontSize:
      "12px",

    fontWeight:
      1000,

    fontVariantNumeric:
      "tabular-nums",
  },

  expandedTeam: {
    padding:
      "16px",
  },

  expandedHeader: {
    marginBottom:
      "12px",

    display:
      "flex",

    alignItems:
      "center",

    justifyContent:
      "space-between",

    gap:
      "14px",
  },

  expandedEyebrow: {
    color:
      "#ff7200",

    fontSize:
      "9px",

    fontWeight:
      1000,

    letterSpacing:
      ".1em",
  },

  expandedTitle: {
    margin:
      "3px 0 0",

    color:
      "#ffffff",

    fontSize:
      "17px",

    fontWeight:
      1000,
  },

  lineupGrid: {
    display:
      "grid",

    gridTemplateColumns:
      "repeat(auto-fit,minmax(220px,1fr))",

    gap:
      "8px",
  },

  lineupEmpty: {
    padding:
      "26px 16px",

    border:
      "1px dashed rgba(255,255,255,.08)",

    borderRadius:
      "10px",

    color:
      "#737b87",

    fontSize:
      "11px",

    fontWeight:
      800,

    textAlign:
      "center" as const,
  },

  playerCard: {
    minWidth:
      0,

    padding:
      "12px",

    border:
      "1px solid rgba(255,255,255,.07)",

    borderRadius:
      "10px",

    background:
      "rgba(255,255,255,.018)",
  },

  playerCardLive: {
    border:
      "1px solid rgba(255,114,0,.28)",

    background:
      "linear-gradient(180deg,rgba(255,92,0,.055),rgba(255,255,255,.018))",
  },

  playerTop: {
    marginBottom:
      "9px",

    display:
      "flex",

    alignItems:
      "center",

    justifyContent:
      "space-between",

    gap:
      "8px",
  },

  slotBadge: {
    display:
      "inline-flex",

    alignItems:
      "center",

    justifyContent:
      "center",

    minWidth:
      "38px",

    minHeight:
      "22px",

    padding:
      "0 7px",

    border:
      "1px solid rgba(255,114,0,.22)",

    borderRadius:
      "6px",

    background:
      "rgba(255,114,0,.07)",

    color:
      "#ff8a24",

    fontSize:
      "8px",

    fontWeight:
      1000,
  },

  gameBadge: {
    color:
      "#7e8794",

    fontSize:
      "8px",

    fontWeight:
      1000,

    letterSpacing:
      ".05em",
  },

  gameBadgeLive: {
    color:
      "#ff8a24",
  },

  gameBadgeFinal: {
    color:
      "#56dc8c",
  },

  playerName: {
    display:
      "block",

    overflow:
      "hidden",

    color:
      "#f4f5f7",

    fontSize:
      "13px",

    fontWeight:
      1000,

    textOverflow:
      "ellipsis",

    whiteSpace:
      "nowrap" as const,
  },

  injuryLine: {
    display: "flex",
    alignItems: "flex-start",
    gap: "7px",
    marginTop: "6px",
    color: "#ffb08b",
    fontSize: "11px",
    fontWeight: 800,
    lineHeight: 1.35,
    whiteSpace: "normal",
    overflowWrap: "anywhere",
  },

  injuryBadge: {
    flex: "0 0 auto",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: "28px",
    minHeight: "20px",
    padding: "2px 6px",
    borderRadius: "6px",
    border: "1px solid rgba(255,106,0,.45)",
    background: "rgba(255,106,0,.12)",
    color: "#ff8a45",
    fontSize: "10px",
    fontWeight: 1000,
  },

  playerMeta: {
    minHeight:
      "16px",

    marginTop:
      "3px",

    overflow:
      "hidden",

    color:
      "#737b87",

    fontSize:
      "9px",

    fontWeight:
      800,

    textOverflow:
      "ellipsis",

    whiteSpace:
      "nowrap" as const,
  },

  playerNumbers: {
    marginTop:
      "10px",

    paddingTop:
      "9px",

    borderTop:
      "1px solid rgba(255,255,255,.055)",

    display:
      "grid",

    gridTemplateColumns:
      "repeat(3,minmax(0,1fr))",

    gap:
      "8px",
  },

  playerNumberLabel: {
    display:
      "block",

    marginBottom:
      "2px",

    color:
      "#5f6874",

    fontSize:
      "7px",

    fontWeight:
      1000,

    letterSpacing:
      ".07em",
  },

  playerNumber: {
    color:
      "#dfe2e6",

    fontSize:
      "11px",

    fontWeight:
      1000,

    fontVariantNumeric:
      "tabular-nums",
  },

  livePoints: {
    color:
      "#ff8a24",
  },

  matchupLine: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    marginTop: "5px",
    fontSize: "10px",
    color: "#8f96a3",
  },

  matchupHard: {
    color: "#ff6464",
    fontWeight: 900,
  },

  matchupMedium: {
    color: "#ffae42",
    fontWeight: 900,
  },

  matchupEasy: {
    color: "#43d17a",
    fontWeight: 900,
  },

  matchupNeutral: {
    color: "#8f96a3",
    fontWeight: 900,
  },

}
