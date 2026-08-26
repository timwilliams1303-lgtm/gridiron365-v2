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


type PlayoffSettingsRow = {
  playoff_teams: number;

  playoff_start_week: number;

  championship_week: number;
};


type PlayoffMatchupDbRow = {
  id: number;

  playoff_week: number;

  round_number: number;

  round_name: string;

  matchup_number: number;

  home_seed:
    number |
    null;

  away_seed:
    number |
    null;

  home_fantasy_team_id:
    number |
    null;

  away_fantasy_team_id:
    number |
    null;

  home_points:
    number |
    string |
    null;

  away_points:
    number |
    string |
    null;

  is_live:
    boolean |
    null;

  is_final:
    boolean |
    null;

  winner_fantasy_team_id:
    number |
    null;

  tied:
    boolean |
    null;
};


type FantasyTeamNameRow = {
  id: number;

  team_name: string;
};


type PlayoffMatchupView = {
  matchupId: number;

  week: number;

  roundNumber: number;

  roundName: string;

  matchupNumber: number;

  homeSeed:
    number |
    null;

  awaySeed:
    number |
    null;

  homeFantasyTeamId:
    number |
    null;

  awayFantasyTeamId:
    number |
    null;

  homeTeamName: string;

  awayTeamName: string;

  homePoints: number;

  awayPoints: number;

  isLive: boolean;

  isFinal: boolean;

  tied: boolean;

  winnerFantasyTeamId:
    number |
    null;

  isMyMatchup: boolean;
};


function formatPoints(
  value: number
) {
  return value.toFixed(
    2
  );
}


function numericValue(
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


function getPlayoffStatusLabel(
  matchup:
    PlayoffMatchupView
) {
  if (
    matchup.isFinal &&
    matchup.tied
  ) {
    return "FINAL • TIEBREAK";
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


  if (
    !matchup.homeFantasyTeamId ||
    !matchup.awayFantasyTeamId
  ) {
    return "TBD";
  }


  return "SCHEDULED";
}


function getPlayoffWeekLabel(
  week: number,
  playoffStartWeek: number,
  championshipWeek: number,
  playoffTeams: number
) {
  if (
    week <
    playoffStartWeek
  ) {
    return `W${week}`;
  }


  if (
    week ===
    championshipWeek
  ) {
    return "CH";
  }


  if (
    playoffTeams ===
    4
  ) {
    return "SF";
  }


  if (
    week ===
    playoffStartWeek
  ) {
    return playoffTeams ===
      8
      ? "QF"
      : "WC";
  }


  return "SF";
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


  const season =
    access.league.season;


  const myFantasyTeamId =
    access.fantasyTeam
      ?.id ??
    null;


  const [
    playoffSettingsResult,
    teamResult,
    seasonStateResult,
  ] =
    await Promise.all([
      supabase
        .from(
          "traditional_playoff_settings"
        )
        .select(`
          playoff_teams,
          playoff_start_week,
          championship_week
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
          "traditional_season_state"
        )
        .select(
          "active_week"
        )
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
    playoffSettingsResult.error
  ) {
    throw new Error(
      `Could not load playoff settings: ${playoffSettingsResult.error.message}`
    );
  }


  if (
    teamResult.error
  ) {
    throw new Error(
      `Could not load fantasy teams: ${teamResult.error.message}`
    );
  }


  if (
    seasonStateResult.error
  ) {
    throw new Error(
      `Could not load active week: ${seasonStateResult.error.message}`
    );
  }


  const playoffSettings =
    playoffSettingsResult.data as
      PlayoffSettingsRow |
      null;


  const playoffTeams =
    playoffSettings
      ?.playoff_teams ??
    6;


  const playoffStartWeek =
    playoffSettings
      ?.playoff_start_week ??
    15;


  const championshipWeek =
    playoffSettings
      ?.championship_week ??
    17;


  const activeWeek =
    Number(
      seasonStateResult
        .data
        ?.active_week ??
      1
    );


  const requestedDisplayWeek =
    selectedWeekInput ??
    activeWeek;


  const selectedWeek =
    Math.min(
      championshipWeek,
      Math.max(
        1,
        requestedDisplayWeek
      )
    );


  const isPlayoffWeek =
    selectedWeek >=
    playoffStartWeek;


  /*
   * The existing regular-season service remains responsible
   * for Weeks 1 through the end of the regular season.
   *
   * When a playoff week is selected, keep that service on the
   * final regular-season week and read playoff matchups from
   * traditional_playoff_matchups below.
   */
  const regularData =
    await getTraditionalMatchupsData(
      supabase,
      leagueId,
      season,
      isPlayoffWeek
        ? playoffStartWeek -
            1
        : selectedWeek,
      myFantasyTeamId
    );


  const teamNames =
    new Map<
      number,
      string
    >();


  for (
    const team
    of (
      teamResult.data ??
      []
    ) as FantasyTeamNameRow[]
  ) {
    teamNames.set(
      team.id,
      team.team_name
    );
  }


  let playoffMatchups:
    PlayoffMatchupView[] =
      [];


  if (
    isPlayoffWeek
  ) {
    /*
     * Keep playoff scores/lifecycle current when viewing a
     * playoff week. If the bracket is not built yet, this RPC
     * simply has nothing to refresh.
     */
    const {
      error:
        playoffRefreshError,
    } =
      await supabase.rpc(
        "refresh_traditional_playoff_week",
        {
          p_league_id:
            leagueId,

          p_season:
            season,

          p_playoff_week:
            selectedWeek,
        }
      );


    if (
      playoffRefreshError
    ) {
      /*
       * Before the bracket exists or before playoff lineups are
       * ready, do not prevent users from opening Matchups.
       */
      console.error(
        "Could not refresh playoff week:",
        playoffRefreshError
      );
    }


    const {
      data:
        playoffData,

      error:
        playoffError,
    } =
      await supabase
        .from(
          "traditional_playoff_matchups"
        )
        .select(`
          id,
          playoff_week,
          round_number,
          round_name,
          matchup_number,
          home_seed,
          away_seed,
          home_fantasy_team_id,
          away_fantasy_team_id,
          home_points,
          away_points,
          is_live,
          is_final,
          winner_fantasy_team_id,
          tied
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
          "playoff_week",
          selectedWeek
        )
        .order(
          "matchup_number",
          {
            ascending:
              true,
          }
        );


    if (
      playoffError
    ) {
      throw new Error(
        `Could not load playoff matchups: ${playoffError.message}`
      );
    }


    playoffMatchups =
      (
        playoffData ??
        []
      ).map(
        (
          row
        ) => {
          const matchup =
            row as
              PlayoffMatchupDbRow;


          const homeId =
            matchup
              .home_fantasy_team_id;


          const awayId =
            matchup
              .away_fantasy_team_id;


          return {
            matchupId:
              matchup.id,

            week:
              matchup.playoff_week,

            roundNumber:
              matchup.round_number,

            roundName:
              matchup.round_name,

            matchupNumber:
              matchup.matchup_number,

            homeSeed:
              matchup.home_seed,

            awaySeed:
              matchup.away_seed,

            homeFantasyTeamId:
              homeId,

            awayFantasyTeamId:
              awayId,

            homeTeamName:
              homeId
                ? (
                    teamNames.get(
                      homeId
                    ) ??
                    "Home Team"
                  )
                : "TBD",

            awayTeamName:
              awayId
                ? (
                    teamNames.get(
                      awayId
                    ) ??
                    "Away Team"
                  )
                : "TBD",

            homePoints:
              numericValue(
                matchup.home_points
              ),

            awayPoints:
              numericValue(
                matchup.away_points
              ),

            isLive:
              matchup
                .is_live ??
              false,

            isFinal:
              matchup
                .is_final ??
              false,

            tied:
              matchup
                .tied ??
              false,

            winnerFantasyTeamId:
              matchup
                .winner_fantasy_team_id,

            isMyMatchup:
              myFantasyTeamId !==
                null &&
              (
                homeId ===
                  myFantasyTeamId ||
                awayId ===
                  myFantasyTeamId
              ),
          };
        }
      );
  }


  const visibleMatchupCount =
    isPlayoffWeek
      ? playoffMatchups.length
      : regularData.matchups.length;


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
              {activeWeek}
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
                {isPlayoffWeek
                  ? "PLAYOFFS"
                  : "REGULAR SEASON"}
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
              {selectedWeek}
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
                    championshipWeek,
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
                    selectedWeek;


                  const active =
                    week ===
                    activeWeek;


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
                        {getPlayoffWeekLabel(
                          week,
                          playoffStartWeek,
                          championshipWeek,
                          playoffTeams
                        )}
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
                {isPlayoffWeek
                  ? `${playoffMatchups[0]?.roundName ?? "Playoff"} • Week ${selectedWeek}`
                  : `Week ${selectedWeek} Matchups`}
              </h2>
            </div>


            <span
              style={
                styles.matchupCount
              }
            >
              {visibleMatchupCount}
              {" "}
              matchup
              {visibleMatchupCount ===
              1
                ? ""
                : "s"}
            </span>
          </div>


          {visibleMatchupCount >
          0 ? (
            <div
              style={
                styles.matchupGrid
              }
            >
              {isPlayoffWeek
                ? playoffMatchups.map(
                    (
                      matchup
                    ) => (
                      <PlayoffMatchupCard
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
                  )
                : regularData.matchups.map(
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
                {isPlayoffWeek
                  ? "Playoff matchups not set yet"
                  : "No matchups scheduled"}
              </strong>

              <span>
                {isPlayoffWeek
                  ? "The playoff games will appear here automatically once the bracket reaches this week."
                  : `No Traditional matchups were found for Week ${selectedWeek}.`}
              </span>
            </Card>
          )}
        </section>
      </section>
    </main>
  );
}


function clampProbability(
  value: number
) {
  return Math.max(
    2,
    Math.min(
      98,
      value
    )
  );
}


function getWinProbabilities(
  matchup:
    TraditionalMatchupRow
) {
  if (
    matchup.away.starters.length ===
      0 ||
    matchup.home.starters.length ===
      0
  ) {
    return null;
  }


  if (
    matchup.isFinal
  ) {
    if (
      matchup.tied
    ) {
      return {
        away: 50,
        home: 50,
      };
    }


    return {
      away:
        matchup.away.isWinner
          ? 100
          : 0,

      home:
        matchup.home.isWinner
          ? 100
          : 0,
    };
  }


  /*
   * Compact scoreboard estimate.
   *
   * This uses data already available on the Matchups page:
   * current score + unfinished starters.
   *
   * When true player projections are added, replace this
   * estimate with the final projection-based win model.
   */

  const awayExpectedRemaining =
    matchup.away.playersRemaining *
    7.5;


  const homeExpectedRemaining =
    matchup.home.playersRemaining *
    7.5;


  const awayExpectedFinal =
    matchup.away.points +
    awayExpectedRemaining;


  const homeExpectedFinal =
    matchup.home.points +
    homeExpectedRemaining;


  const difference =
    awayExpectedFinal -
    homeExpectedFinal;


  const awayProbability =
    clampProbability(
      50 +
      difference *
        1.35
    );


  const roundedAway =
    Math.round(
      awayProbability
    );


  return {
    away:
      roundedAway,

    home:
      100 -
      roundedAway,
  };
}


function PlayoffMatchupCard({
  leagueId,
  matchup,
}: {
  leagueId: string;

  matchup:
    PlayoffMatchupView;
}) {
  const homeWinner =
    matchup.isFinal &&
    matchup
      .winnerFantasyTeamId ===
      matchup
        .homeFantasyTeamId;


  const awayWinner =
    matchup.isFinal &&
    matchup
      .winnerFantasyTeamId ===
      matchup
        .awayFantasyTeamId;


  return (
    <Link
      href={
        `/league/${leagueId}/playoffs/matchups/${matchup.matchupId}`
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
            {getPlayoffStatusLabel(
              matchup
            )}
          </span>


          <span
            style={
              styles.playoffRoundBadge
            }
          >
            {matchup.roundName.toUpperCase()}
          </span>
        </div>


        <PlayoffTeamRow
          seed={
            matchup.awaySeed
          }
          teamName={
            matchup.awayTeamName
          }
          points={
            matchup.awayPoints
          }
          isWinner={
            awayWinner
          }
        />


        <div
          style={
            styles.scoreDivider
          }
        />


        <PlayoffTeamRow
          seed={
            matchup.homeSeed
          }
          teamName={
            matchup.homeTeamName
          }
          points={
            matchup.homePoints
          }
          isWinner={
            homeWinner
          }
        />


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
            Week {matchup.week}
            {" • "}
            Open live matchup
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


function PlayoffTeamRow({
  seed,
  teamName,
  points,
  isWinner,
}: {
  seed:
    number |
    null;

  teamName: string;

  points: number;

  isWinner: boolean;
}) {
  return (
    <div
      style={{
        ...styles.teamRow,

        ...(isWinner
          ? styles.winnerTeamRow
          : {}),
      }}
    >
      <div
        style={
          styles.playoffSeedCircle
        }
      >
        {seed
          ? `#${seed}`
          : "—"}
      </div>


      <div
        style={
          styles.teamIdentity
        }
      >
        <strong
          style={
            styles.teamName
          }
        >
          {teamName}
        </strong>

        <span
          style={
            styles.teamMeta
          }
        >
          {seed
            ? `Seed ${seed}`
            : "Awaiting winner"}
        </span>
      </div>


      <strong
        style={{
          ...styles.teamPoints,

          ...(isWinner
            ? styles.winnerPoints
            : {}),
        }}
      >
        {formatPoints(
          points
        )}
      </strong>
    </div>
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
  const probability =
    getWinProbabilities(
      matchup
    );


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
          ) : (
            <span
              style={
                styles.weekMiniLabel
              }
            >
              WEEK {matchup.week}
            </span>
          )}
        </div>


        <TeamRow
          teamName={
            matchup.away.teamName
          }
          points={
            matchup.away.points
          }
          isMyTeam={
            matchup.away.isMyTeam
          }
          isWinner={
            matchup.away.isWinner
          }
          isLive={
            matchup.isLive
          }
          playersLive={
            matchup.away.playersLive
          }
          playersRemaining={
            matchup.away.playersRemaining
          }
          starterCount={
            matchup.away.starters.length
          }
          winProbability={
            probability?.away ??
            null
          }
        />


        <div
          style={
            styles.scoreDivider
          }
        />


        <TeamRow
          teamName={
            matchup.home.teamName
          }
          points={
            matchup.home.points
          }
          isMyTeam={
            matchup.home.isMyTeam
          }
          isWinner={
            matchup.home.isWinner
          }
          isLive={
            matchup.isLive
          }
          playersLive={
            matchup.home.playersLive
          }
          playersRemaining={
            matchup.home.playersRemaining
          }
          starterCount={
            matchup.home.starters.length
          }
          winProbability={
            probability?.home ??
            null
          }
        />


        {probability ? (
          <div
            style={
              styles.probabilitySection
            }
          >
            <div
              style={
                styles.probabilityLabels
              }
            >
              <span>
                {probability.away}% WIN
              </span>


              <span
                style={
                  styles.probabilityTitle
                }
              >
                WIN PROBABILITY
              </span>


              <span
                style={{
                  textAlign:
                    "right",
                }}
              >
                {probability.home}% WIN
              </span>
            </div>


            <div
              style={
                styles.probabilityTrack
              }
            >
              <div
                style={{
                  ...styles.awayProbabilityFill,

                  width:
                    `${probability.away}%`,
                }}
              />


              <div
                style={{
                  ...styles.homeProbabilityFill,

                  width:
                    `${probability.home}%`,
                }}
              />
            </div>
          </div>
        ) : (
          <div
            style={
              styles.probabilityUnavailable
            }
          >
            Win probability appears when both teams have starting lineups.
          </div>
        )}


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
            Open live matchup
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
  isMyTeam,
  isWinner,
  isLive,
  playersLive,
  playersRemaining,
  starterCount,
  winProbability,
}: {
  teamName: string;

  points: number;

  isMyTeam: boolean;

  isWinner: boolean;

  isLive: boolean;

  playersLive: number;

  playersRemaining: number;

  starterCount: number;

  winProbability:
    number |
    null;
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


            {starterCount >
            0 ? (
              <>
                {playersLive >
                0 ? (
                  <span
                    style={
                      styles.playersLiveLabel
                    }
                  >
                    {playersLive} LIVE
                  </span>
                ) : null}


                <span
                  style={
                    styles.playersRemainingLabel
                  }
                >
                  {playersRemaining} LEFT
                </span>
              </>
            ) : (
              <span
                style={
                  styles.noLineupLabel
                }
              >
                NO LINEUP
              </span>
            )}
          </div>
        </div>
      </div>


      <div
        style={
          styles.scoreBlock
        }
      >
        {winProbability !==
        null ? (
          <span
            style={
              styles.teamProbability
            }
          >
            {winProbability}%
          </span>
        ) : null}


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
      "calc(100vh - 96px)",

    padding:
      "18px 16px 36px",

    background:
      "radial-gradient(circle at 50% 0%,rgba(255,67,0,.05),transparent 34%)",
  },


  shell: {
    width:
      "min(1180px,100%)",

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


  playoffRoundBadge: {
    padding:
      "3px 6px",

    border:
      "1px solid rgba(255,125,25,.22)",

    borderRadius:
      "4px",

    color:
      "#ff8a27",

    fontSize:
      "6px",

    fontWeight:
      950,

    letterSpacing:
      ".05em",
  },


  playoffSeedCircle: {
    width:
      "31px",

    height:
      "31px",

    display:
      "flex",

    alignItems:
      "center",

    justifyContent:
      "center",

    border:
      "1px solid rgba(255,115,25,.22)",

    borderRadius:
      "50%",

    background:
      "rgba(255,95,15,.055)",

    color:
      "#ff8a27",

    fontSize:
      "7px",

    fontWeight:
      950,
  },


  winnerTeamRow: {
    background:
      "linear-gradient(90deg,rgba(58,205,120,.08),transparent 70%)",
  },


  winnerPoints: {
    color:
      "#4ddd89",
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


  teamMeta: {
    color:
      "#737a84",

    fontSize:
      "6px",

    fontWeight:
      850,
  },


  teamPoints: {
    flex:
      "0 0 auto",

    minWidth:
      "58px",

    textAlign:
      "right" as const,

    color:
      "#ffffff",

    fontSize:
      "15px",

    fontWeight:
      950,

    fontVariantNumeric:
      "tabular-nums",
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


  weekMiniLabel: {
    color:
      "#5f6670",

    fontSize:
      "6px",

    fontWeight:
      900,

    letterSpacing:
      ".08em",
  },


  playersLiveLabel: {
    color:
      "#43d982",

    fontSize:
      "6px",

    fontWeight:
      950,
  },


  playersRemainingLabel: {
    color:
      "#737b86",

    fontSize:
      "6px",

    fontWeight:
      900,
  },


  noLineupLabel: {
    color:
      "#686f79",

    fontSize:
      "6px",

    fontWeight:
      900,
  },


  scoreBlock: {
    flex:
      "0 0 auto",

    display:
      "flex",

    alignItems:
      "baseline",

    gap:
      "7px",
  },


  teamProbability: {
    color:
      "#7f8791",

    fontSize:
      "7px",

    fontWeight:
      900,

    fontVariantNumeric:
      "tabular-nums",
  },


  probabilitySection: {
    display:
      "grid",

    gap:
      "4px",
  },


  probabilityLabels: {
    display:
      "grid",

    gridTemplateColumns:
      "1fr auto 1fr",

    alignItems:
      "center",

    gap:
      "7px",

    color:
      "#b2b8c0",

    fontSize:
      "6px",

    fontWeight:
      950,

    fontVariantNumeric:
      "tabular-nums",
  },


  probabilityTitle: {
    color:
      "#606873",

    textAlign:
      "center" as const,

    letterSpacing:
      ".08em",
  },


  probabilityTrack: {
    height:
      "4px",

    display:
      "flex",

    overflow:
      "hidden",

    borderRadius:
      "999px",

    background:
      "#202125",
  },


  awayProbabilityFill: {
    height:
      "100%",

    background:
      "linear-gradient(90deg,#9e1717,#e1451c)",
  },


  homeProbabilityFill: {
    height:
      "100%",

    background:
      "linear-gradient(90deg,#ff6b16,#ff9a2e)",
  },


  probabilityUnavailable: {
    minHeight:
      "14px",

    display:
      "flex",

    alignItems:
      "center",

    color:
      "#5f6670",

    fontSize:
      "6px",

    fontWeight:
      750,
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