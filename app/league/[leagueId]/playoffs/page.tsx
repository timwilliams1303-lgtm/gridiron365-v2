import {
  createSupabaseServerClient,
} from "@/lib/supabase/server";

import {
  requireTraditionalLeague,
} from "@/lib/traditional/requireTraditionalLeague";

import TraditionalPlayoffLiveRefresh from "@/components/traditional/TraditionalPlayoffLiveRefresh";


type PageProps = {
  params:
    Promise<{
      leagueId: string;
    }>;
};


type PlayoffSettingsRow = {
  playoff_teams: number;
  playoff_start_week: number;
  championship_week: number;
  reseed_each_round: boolean;
};


type SeasonStateRow = {
  active_week: number;
  phase: string;
  regular_season_complete: boolean;
  playoffs_started: boolean;
  season_complete: boolean;
  last_completed_week:
    number |
    null;
};


type SeedRow = {
  seed: number;
  fantasy_team_id: number;
  wins: number;
  losses: number;
  ties: number;
  points_for:
    number |
    string;
  points_against:
    number |
    string;
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


type PlayoffMatchupRow = {
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
    string;
  away_points:
    number |
    string;
  is_bye: boolean;
  is_live: boolean;
  is_final: boolean;
  winner_fantasy_team_id:
    number |
    null;
  tied: boolean;
  finalized_at:
    string |
    null;
};


type SeasonResultRow = {
  champion_fantasy_team_id: number;
  runner_up_fantasy_team_id:
    number |
    null;
  champion_seed:
    number |
    null;
  runner_up_seed:
    number |
    null;
  championship_home_points:
    number |
    string;
  championship_away_points:
    number |
    string;
  championship_matchup_id:
    number |
    null;
  completed_at: string;
};


type BracketTeam = {
  fantasyTeamId:
    number |
    null;
  seed:
    number |
    null;
  teamName: string;
  points: number;
  isWinner: boolean;
};


type ProjectedSeed = {
  seed: number;
  fantasyTeamId: number;
  teamName: string;
  wins: number;
  losses: number;
  ties: number;
  winPct: number;
  pointsFor: number;
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
    number |
    string
) {
  return numberValue(
    value
  ).toFixed(
    2
  );
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


function statusLabel(
  matchup:
    PlayoffMatchupRow
) {
  if (
    matchup.is_final
  ) {
    return matchup.tied
      ? "FINAL • TIEBREAK"
      : "FINAL";
  }


  if (
    matchup.is_live
  ) {
    return "LIVE";
  }


  if (
    matchup.home_fantasy_team_id &&
    matchup.away_fantasy_team_id
  ) {
    return `WEEK ${matchup.playoff_week}`;
  }


  return "TBD";
}


function getRoundTitle(
  roundNumber: number
) {
  switch (
    roundNumber
  ) {
    case 1:
      return "OPENING ROUND";

    case 2:
      return "SEMIFINALS";

    case 3:
      return "CHAMPIONSHIP";

    default:
      return `ROUND ${roundNumber}`;
  }
}


function getProjectedByeCount(
  playoffTeams: number
) {
  if (
    playoffTeams ===
    4
  ) {
    return 0;
  }


  return Math.max(
    0,
    8 -
      playoffTeams
  );
}


function getProjectedOpeningRoundName(
  playoffTeams: number
) {
  if (
    playoffTeams ===
    4
  ) {
    return "Semifinals";
  }


  if (
    playoffTeams ===
    8
  ) {
    return "Quarterfinals";
  }


  return "Wild Card";
}


function getPlayoffFormatLabel(
  playoffTeams: number
) {
  if (
    playoffTeams ===
    4
  ) {
    return "4 Teams • Semifinals";
  }


  if (
    playoffTeams ===
    5
  ) {
    return "5 Teams • 3 Byes";
  }


  if (
    playoffTeams ===
    6
  ) {
    return "6 Teams • 2 Byes";
  }


  if (
    playoffTeams ===
    7
  ) {
    return "7 Teams • 1 Bye";
  }


  return "8 Teams • No Byes";
}


function getProjectedFormatSteps(
  playoffTeams: number
) {
  if (
    playoffTeams ===
    4
  ) {
    return [
      {
        title:
          "Semifinals",

        text:
          "#1 vs #4 and #2 vs #3",
      },

      {
        title:
          "Championship",

        text:
          "Semifinal winners play for the league title",
      },
    ];
  }


  if (
    playoffTeams ===
    5
  ) {
    return [
      {
        title:
          "Wild Card",

        text:
          "#4 vs #5 • Seeds #1, #2 and #3 receive byes",
      },

      {
        title:
          "Semifinals",

        text:
          "#1 vs winner #4/#5 and #2 vs #3",
      },

      {
        title:
          "Championship",

        text:
          "Semifinal winners play for the league title",
      },
    ];
  }


  if (
    playoffTeams ===
    6
  ) {
    return [
      {
        title:
          "Wild Card",

        text:
          "#3 vs #6 and #4 vs #5 • Seeds #1 and #2 receive byes",
      },

      {
        title:
          "Semifinals",

        text:
          "#1 vs winner #4/#5 and #2 vs winner #3/#6",
      },

      {
        title:
          "Championship",

        text:
          "Semifinal winners play for the league title",
      },
    ];
  }


  if (
    playoffTeams ===
    7
  ) {
    return [
      {
        title:
          "Wild Card",

        text:
          "#2 vs #7, #3 vs #6 and #4 vs #5 • Seed #1 receives a bye",
      },

      {
        title:
          "Semifinals",

        text:
          "#1 vs winner #4/#5 plus the other two Wild Card winners",
      },

      {
        title:
          "Championship",

        text:
          "Semifinal winners play for the league title",
      },
    ];
  }


  return [
    {
      title:
        "Quarterfinals",

      text:
        "#1 vs #8, #2 vs #7, #3 vs #6 and #4 vs #5",
    },

    {
      title:
        "Semifinals",

      text:
        "Quarterfinal winners advance",
    },

    {
      title:
        "Championship",

      text:
        "Semifinal winners play for the league title",
    },
  ];
}


export default async function TraditionalPlayoffsPage({
  params,
}: PageProps) {
  const {
    leagueId,
  } =
    await params;


  const access =
    await requireTraditionalLeague(
      leagueId
    );


  const season =
    access.league.season;


  const supabase =
    await createSupabaseServerClient();


  /*
   * Ensure the league always has playoff settings.
   * This does NOT start or build the bracket.
   */
  const {
    error:
      ensureSettingsError,
  } =
    await supabase.rpc(
      "ensure_traditional_playoff_settings",
      {
        p_league_id:
          leagueId,

        p_season:
          season,
      }
    );


  if (
    ensureSettingsError
  ) {
    throw new Error(
      `Could not ensure playoff settings: ${ensureSettingsError.message}`
    );
  }


  const [
    settingsResult,
    stateResult,
    seedsResult,
    matchupsResult,
    resultsResult,
    teamsResult,
    standingsResult,
  ] =
    await Promise.all([
      supabase
        .from(
          "traditional_playoff_settings"
        )
        .select(`
          playoff_teams,
          playoff_start_week,
          championship_week,
          reseed_each_round
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
          "traditional_season_state"
        )
        .select(`
          active_week,
          phase,
          regular_season_complete,
          playoffs_started,
          season_complete,
          last_completed_week
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
          "traditional_playoff_seeds"
        )
        .select(`
          seed,
          fantasy_team_id,
          wins,
          losses,
          ties,
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
        )
        .order(
          "seed",
          {
            ascending:
              true,
          }
        ),

      supabase
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
          is_bye,
          is_live,
          is_final,
          winner_fantasy_team_id,
          tied,
          finalized_at
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
          "round_number",
          {
            ascending:
              true,
          }
        )
        .order(
          "matchup_number",
          {
            ascending:
              true,
          }
        ),

      supabase
        .from(
          "traditional_season_results"
        )
        .select(`
          champion_fantasy_team_id,
          runner_up_fantasy_team_id,
          champion_seed,
          runner_up_seed,
          championship_home_points,
          championship_away_points,
          championship_matchup_id,
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
    ]);


  const errors =
    [
      settingsResult.error,
      stateResult.error,
      seedsResult.error,
      matchupsResult.error,
      resultsResult.error,
      teamsResult.error,
      standingsResult.error,
    ].filter(
      Boolean
    );


  if (
    errors.length >
    0
  ) {
    throw new Error(
      `Could not load playoffs: ${errors[0]?.message ?? "Unknown error"}`
    );
  }


  const settings =
    settingsResult.data as
      PlayoffSettingsRow |
      null;


  const state =
    stateResult.data as
      SeasonStateRow |
      null;


  const seeds =
    (
      seedsResult.data ??
      []
    ) as SeedRow[];


  const playoffMatchups =
    (
      matchupsResult.data ??
      []
    ) as PlayoffMatchupRow[];


  const seasonResult =
    resultsResult.data as
      SeasonResultRow |
      null;


  const teams =
    (
      teamsResult.data ??
      []
    ) as FantasyTeamRow[];


  const standings =
    (
      standingsResult.data ??
      []
    ) as StandingRow[];


  const teamMap =
    new Map<
      number,
      string
    >();


  for (
    const team
    of teams
  ) {
    teamMap.set(
      team.id,
      team.team_name
    );
  }


  const playoffTeams =
    settings
      ?.playoff_teams ??
    6;


  /*
   * Before the real playoff field is locked, show the current
   * projected top playoffTeams from the standings.
   */
  const projectedSeeds:
    ProjectedSeed[] =
      [...standings]
        .sort(
          (
            a,
            b
          ) => {
            const aPct =
              calculateWinPct(
                a.wins,
                a.ties,
                a.games_played
              );


            const bPct =
              calculateWinPct(
                b.wins,
                b.ties,
                b.games_played
              );


            if (
              bPct !==
              aPct
            ) {
              return (
                bPct -
                aPct
              );
            }


            const bPf =
              numberValue(
                b.points_for
              );


            const aPf =
              numberValue(
                a.points_for
              );


            if (
              bPf !==
              aPf
            ) {
              return (
                bPf -
                aPf
              );
            }


            const aPa =
              numberValue(
                a.points_against
              );


            const bPa =
              numberValue(
                b.points_against
              );


            if (
              aPa !==
              bPa
            ) {
              return (
                aPa -
                bPa
              );
            }


            return (
              a.fantasy_team_id -
              b.fantasy_team_id
            );
          }
        )
        .slice(
          0,
          playoffTeams
        )
        .map(
          (
            row,
            index
          ) => ({
            seed:
              index +
              1,

            fantasyTeamId:
              row.fantasy_team_id,

            teamName:
              teamMap.get(
                row.fantasy_team_id
              ) ??
              "Unknown Team",

            wins:
              row.wins,

            losses:
              row.losses,

            ties:
              row.ties,

            winPct:
              calculateWinPct(
                row.wins,
                row.ties,
                row.games_played
              ),

            pointsFor:
              numberValue(
                row.points_for
              ),
          })
        );


  const actualSeedMap =
    new Map<
      number,
      SeedRow
    >();


  for (
    const seed
    of seeds
  ) {
    actualSeedMap.set(
      seed.seed,
      seed
    );
  }


  const getProjectedOrActualTeam = (
    seedNumber: number
  ) => {
    const actual =
      actualSeedMap.get(
        seedNumber
      );


    if (
      actual
    ) {
      return {
        fantasyTeamId:
          actual.fantasy_team_id,

        seed:
          actual.seed,

        teamName:
          teamMap.get(
            actual.fantasy_team_id
          ) ??
          "Unknown Team",
      };
    }


    const projected =
      projectedSeeds.find(
        (
          row
        ) =>
          row.seed ===
          seedNumber
      );


    return {
      fantasyTeamId:
        projected
          ?.fantasyTeamId ??
        null,

      seed:
        seedNumber,

      teamName:
        projected
          ?.teamName ??
        "TBD",
    };
  };


  const getMatchup =
    (
      roundNumber: number,
      matchupNumber: number
    ) =>
      playoffMatchups.find(
        (
          matchup
        ) =>
          matchup.round_number ===
            roundNumber &&
          matchup.matchup_number ===
            matchupNumber
      ) ??
      null;


  const makeTeam = (
    fantasyTeamId:
      number |
      null,
    seed:
      number |
      null,
    points: number,
    winnerId:
      number |
      null
  ): BracketTeam => ({
    fantasyTeamId,

    seed,

    teamName:
      fantasyTeamId
        ? (
            teamMap.get(
              fantasyTeamId
            ) ??
            "Unknown Team"
          )
        : "TBD",

    points,

    isWinner:
      fantasyTeamId !==
        null &&
      winnerId ===
        fantasyTeamId,
  });


  const bracketExists =
    playoffMatchups.length >
    0;


  const playoffsStarted =
    Boolean(
      state
        ?.playoffs_started
    );


  const regularSeasonComplete =
    Boolean(
      state
        ?.regular_season_complete
    );


  const seasonComplete =
    Boolean(
      state
        ?.season_complete
    );


  const championshipMatchup =
    playoffMatchups.find(
      (
        matchup
      ) =>
        matchup.round_name
          .toLowerCase() ===
        "championship"
    ) ??
    null;


  const projectedByeCount =
    getProjectedByeCount(
      playoffTeams
    );


  const playoffFormatLabel =
    getPlayoffFormatLabel(
      playoffTeams
    );


  const projectedFormatSteps =
    getProjectedFormatSteps(
      playoffTeams
    );


  const currentPlayoffField =
    projectedSeeds.filter(
      (
        row
      ) =>
        row.seed <=
        playoffTeams
    );


  const inTheHunt =
    standings
      .map(
        (
          row
        ) => {
          const teamName =
            teamMap.get(
              row.fantasy_team_id
            ) ??
            "Unknown Team";


          const winPct =
            calculateWinPct(
              row.wins,
              row.ties,
              row.games_played
            );


          return {
            fantasyTeamId:
              row.fantasy_team_id,

            teamName,

            wins:
              row.wins,

            losses:
              row.losses,

            ties:
              row.ties,

            gamesPlayed:
              row.games_played,

            winPct,

            pointsFor:
              numberValue(
                row.points_for
              ),
          };
        }
      )
      .sort(
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


          return a.teamName.localeCompare(
            b.teamName
          );
        }
      )
      .slice(
        playoffTeams,
        playoffTeams +
          3
      );


  const workToDo =
    standings
      .map(
        (
          row
        ) => {
          const teamName =
            teamMap.get(
              row.fantasy_team_id
            ) ??
            "Unknown Team";


          const winPct =
            calculateWinPct(
              row.wins,
              row.ties,
              row.games_played
            );


          return {
            fantasyTeamId:
              row.fantasy_team_id,

            teamName,

            wins:
              row.wins,

            losses:
              row.losses,

            ties:
              row.ties,

            gamesPlayed:
              row.games_played,

            winPct,

            pointsFor:
              numberValue(
                row.points_for
              ),
          };
        }
      )
      .sort(
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


          return a.teamName.localeCompare(
            b.teamName
          );
        }
      )
      .slice(
        playoffTeams +
          3
      );


  const cutLineTeam =
    projectedSeeds[
      Math.max(
        0,
        playoffTeams -
          1
      )
    ] ??
    null;


  const bracketRounds =
    Array.from(
      new Set(
        playoffMatchups.map(
          (
            matchup
          ) =>
            matchup.round_number
        )
      )
    )
      .sort(
        (
          a,
          b
        ) =>
          a -
          b
      )
      .map(
        (
          roundNumber
        ) => {
          const roundMatchups =
            playoffMatchups.filter(
              (
                matchup
              ) =>
                matchup.round_number ===
                  roundNumber
            );


          return {
            roundNumber,

            roundName:
              roundMatchups[0]
                ?.round_name ??
              getRoundTitle(
                roundNumber
              ),

            week:
              roundMatchups[0]
                ?.playoff_week ??
              (
                settings
                  ?.playoff_start_week ??
                15
              ),

            matchups:
              roundMatchups,
          };
        }
      );


  const championName =
    seasonResult
      ? (
          teamMap.get(
            seasonResult
              .champion_fantasy_team_id
          ) ??
          "Champion"
        )
      : null;


  return (
    <main
      style={
        styles.page
      }
    >
      <TraditionalPlayoffLiveRefresh
        enabled={
          playoffsStarted &&
          !seasonComplete
        }
        intervalMs={
          15000
        }
      />
      <div
        style={
          styles.shell
        }
      >
        <header
          style={
            styles.header
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
              Playoffs
            </h2>

            <p
              style={
                styles.subtitle
              }
            >
              {access.league.name}
              {" • "}
              {season}
              {" • "}
              {playoffTeams}
              {"-Team Field"}
            </p>
          </div>


          <div
            style={
              styles.headerStats
            }
          >
            <HeaderStat
              label="FORMAT"
              value={`${playoffTeams} TEAMS`}
            />

            <HeaderStat
              label="RESEED"
              value={
                settings
                  ?.reseed_each_round
                  ? "ON"
                  : "OFF"
              }
              accent={
                Boolean(
                  settings
                    ?.reseed_each_round
                )
              }
            />

            <HeaderStat
              label="PLAYOFF START"
              value={`WK ${settings?.playoff_start_week ?? 15}`}
            />

            <HeaderStat
              label="CHAMPIONSHIP"
              value={`WK ${settings?.championship_week ?? 17}`}
            />

            <HeaderStat
              label="STATUS"
              value={
                seasonComplete
                  ? "COMPLETE"
                  : playoffsStarted
                    ? "ACTIVE"
                    : regularSeasonComplete
                      ? "READY"
                      : "PROJECTED"
              }
              accent
            />
          </div>
        </header>


        <section
          style={
            styles.playoffConfigBar
          }
        >
          <div
            style={
              styles.configItem
            }
          >
            <span
              style={
                styles.configLabel
              }
            >
              FORMAT
            </span>

            <strong
              style={
                styles.configValue
              }
            >
              {playoffFormatLabel}
            </strong>
          </div>


          <div
            style={
              styles.configDivider
            }
          />


          <div
            style={
              styles.configItem
            }
          >
            <span
              style={
                styles.configLabel
              }
            >
              RESEED EACH ROUND
            </span>

            <strong
              style={
                settings
                  ?.reseed_each_round
                  ? styles.configValueGreen
                  : styles.configValue
              }
            >
              {settings
                ?.reseed_each_round
                ? "ENABLED"
                : "DISABLED"}
            </strong>
          </div>


          <div
            style={
              styles.configDivider
            }
          />


          <div
            style={
              styles.configItem
            }
          >
            <span
              style={
                styles.configLabel
              }
            >
              LIVE BRACKET
            </span>

            <strong
              style={
                playoffsStarted &&
                !seasonComplete
                  ? styles.configValueGreen
                  : styles.configValue
              }
            >
              {playoffsStarted &&
              !seasonComplete
                ? "15-SEC REFRESH"
                : "READY"}
            </strong>
          </div>
        </section>


        {seasonResult &&
        championName ? (
          <section
            style={
              styles.championBanner
            }
          >
            <div
              style={
                styles.trophyCircle
              }
            >
              ★
            </div>

            <div>
              <span
                style={
                  styles.championLabel
                }
              >
                {season} GRIDIRON365 CHAMPION
              </span>

              <strong
                style={
                  styles.championName
                }
              >
                {championName}
              </strong>

              <span
                style={
                  styles.championMeta
                }
              >
                Seed #
                {seasonResult.champion_seed ??
                  "—"}
                {" • "}
                Championship completed
              </span>
            </div>
          </section>
        ) : null}


        <section
          style={
            styles.mainContentGrid
          }
        >
          <div
            style={
              styles.mainPrimary
            }
          >
        {!bracketExists ? (
          <section
            style={
              styles.prePlayoffGrid
            }
          >
            <div
              style={
                styles.projectedFieldCard
              }
            >
              <div
                style={
                  styles.sectionHeading
                }
              >
                <div>
                  <span
                    style={
                      styles.sectionKicker
                    }
                  >
                    CURRENT
                  </span>

                  <h3
                    style={
                      styles.sectionTitle
                    }
                  >
                    Projected Playoff Field
                  </h3>
                </div>

                <span
                  style={
                    styles.projectedBadge
                  }
                >
                  {regularSeasonComplete
                    ? "FIELD READY"
                    : "PROJECTED"}
                </span>
              </div>


              <div
                style={
                  styles.seedList
                }
              >
                {Array.from(
                  {
                    length:
                      playoffTeams,
                  },
                  (
                    _,
                    index
                  ) => {
                    const seedNumber =
                      index +
                      1;


                    const team =
                      getProjectedOrActualTeam(
                        seedNumber
                      );


                    const projected =
                      projectedSeeds.find(
                        (
                          row
                        ) =>
                          row.seed ===
                            seedNumber
                      );


                    return (
                      <div
                        key={
                          seedNumber
                        }
                        style={{
                          ...styles.seedRow,

                          ...(seedNumber <=
                          projectedByeCount
                            ? styles.byeSeedRow
                            : {}),
                        }}
                      >
                        <div
                          style={
                            styles.seedNumber
                          }
                        >
                          {seedNumber}
                        </div>

                        <div
                          style={
                            styles.teamCircle
                          }
                        >
                          {team.teamName
                            .slice(
                              0,
                              1
                            )
                            .toUpperCase()}
                        </div>

                        <div
                          style={
                            styles.seedTeamText
                          }
                        >
                          <strong
                            style={
                              styles.seedTeamName
                            }
                          >
                            {team.teamName}
                          </strong>

                          <span
                            style={
                              styles.seedMeta
                            }
                          >
                            {projected
                              ? `${projected.wins}-${projected.losses}${projected.ties ? `-${projected.ties}` : ""} • ${projected.pointsFor.toFixed(2)} PF`
                              : "Awaiting standings"}
                          </span>
                        </div>

                        {seedNumber <=
                        projectedByeCount ? (
                          <span
                            style={
                              styles.byeBadge
                            }
                          >
                            BYE
                          </span>
                        ) : (
                          <span
                            style={
                              styles.wildCardBadge
                            }
                          >
                            {getProjectedOpeningRoundName(
                              playoffTeams
                            ).toUpperCase()}
                          </span>
                        )}
                      </div>
                    );
                  }
                )}
              </div>
            </div>


            <div
              style={
                styles.formatCard
              }
            >
              <span
                style={
                  styles.sectionKicker
                }
              >
                FORMAT
              </span>

              <h3
                style={
                  styles.sectionTitle
                }
              >
                Playoff Path
              </h3>

              {projectedFormatSteps.map(
                (
                  step,
                  index
                ) => (
                  <FormatStep
                    key={
                      step.title
                    }
                    number={
                      String(
                        index +
                        1
                      )
                    }
                    title={
                      step.title
                    }
                    text={
                      step.text
                    }
                  />
                )
              )}

              <div
                style={
                  styles.tieNote
                }
              >
                <strong>
                  Playoff tie:
                </strong>
                {" "}
                Higher seed advances.
              </div>
            </div>
          </section>
        ) : (
          <section
            style={{
              ...styles.bracketShell,

              gridTemplateColumns:
                `repeat(${Math.max(
                  1,
                  bracketRounds.length
                )},minmax(260px,1fr))`,
            }}
          >
            {bracketRounds.map(
              (
                round
              ) => (
                <div
                  key={
                    round.roundNumber
                  }
                  style={
                    styles.bracketRound
                  }
                >
                  <RoundHeading
                    title={
                      round.roundName
                    }
                    week={
                      round.week
                    }
                  />


                  {round.matchups.map(
                    (
                      matchup
                    ) => (
                      <BracketMatchup
                        key={
                          matchup.id
                        }
                        matchup={
                          matchup
                        }
                        fallbackHome={{
                          fantasyTeamId:
                            null,

                          seed:
                            null,

                          teamName:
                            "TBD",
                        }}
                        fallbackAway={{
                          fantasyTeamId:
                            null,

                          seed:
                            null,

                          teamName:
                            "TBD",
                        }}
                        makeTeam={
                          makeTeam
                        }
                        championship={
                          matchup.round_name
                            .toLowerCase() ===
                          "championship"
                        }
                      />
                    )
                  )}
                </div>
              )
            )}
          </section>
        )}


          </div>


          <aside
            style={
              styles.playoffRaceSidebar
            }
          >
            <section
              style={
                styles.raceCard
              }
            >
              <div
                style={
                  styles.raceHeader
                }
              >
                <div>
                  <span
                    style={
                      styles.sectionKicker
                    }
                  >
                    PLAYOFF RACE
                  </span>

                  <h3
                    style={
                      styles.raceTitle
                    }
                  >
                    Current Picture
                  </h3>
                </div>

                <span
                  style={
                    styles.cutLineBadge
                  }
                >
                  CUT #{playoffTeams}
                </span>
              </div>


              <RaceGroup
                title="IN THE PLAYOFFS"
                tone="green"
                rows={
                  currentPlayoffField.map(
                    (
                      row
                    ) => ({
                      seed:
                        row.seed,

                      teamName:
                        row.teamName,

                      record:
                        `${row.wins}-${row.losses}${row.ties ? `-${row.ties}` : ""}`,
                    })
                  )
                }
                empty="No teams yet"
              />


              <div
                style={
                  styles.cutLineRow
                }
              >
                <span
                  style={
                    styles.cutLineLine
                  }
                />

                <strong
                  style={
                    styles.cutLineText
                  }
                >
                  PLAYOFF CUT LINE
                  {cutLineTeam
                    ? ` • #${cutLineTeam.seed} ${cutLineTeam.teamName}`
                    : ""}
                </strong>

                <span
                  style={
                    styles.cutLineLine
                  }
                />
              </div>


              <RaceGroup
                title="IN THE HUNT"
                tone="orange"
                rows={
                  inTheHunt.map(
                    (
                      row
                    ) => ({
                      seed:
                        null,

                      teamName:
                        row.teamName,

                      record:
                        `${row.wins}-${row.losses}${row.ties ? `-${row.ties}` : ""}`,
                    })
                  )
                }
                empty="None"
              />


              <RaceGroup
                title="WORK TO DO"
                tone="red"
                rows={
                  workToDo.map(
                    (
                      row
                    ) => ({
                      seed:
                        null,

                      teamName:
                        row.teamName,

                      record:
                        `${row.wins}-${row.losses}${row.ties ? `-${row.ties}` : ""}`,
                    })
                  )
                }
                empty="None"
              />
            </section>
          </aside>
        </section>


        <section
          style={
            styles.footerInfo
          }
        >
          <div>
            <span
              style={
                styles.footerLabel
              }
            >
              SEEDING
            </span>

            <strong
              style={
                styles.footerValue
              }
            >
              Win % → PF → lower PA
            </strong>
          </div>

          <div>
            <span
              style={
                styles.footerLabel
              }
            >
              BYES
            </span>

            <strong
              style={
                styles.footerValue
              }
            >
              {projectedByeCount >
              0
                ? `Top ${projectedByeCount} seed${projectedByeCount === 1 ? "" : "s"}`
                : "None"}
            </strong>
          </div>

          <div>
            <span
              style={
                styles.footerLabel
              }
            >
              RESEED
            </span>

            <strong
              style={
                styles.footerValue
              }
            >
              {settings
                ?.reseed_each_round
                ? "Highest vs lowest remaining seed"
                : "Fixed bracket paths"}
            </strong>
          </div>


          <div>
            <span
              style={
                styles.footerLabel
              }
            >
              TIEBREAK
            </span>

            <strong
              style={
                styles.footerValue
              }
            >
              Higher seed advances
            </strong>
          </div>
        </section>
      </div>
    </main>
  );
}


function RaceGroup({
  title,
  tone,
  rows,
  empty,
}: {
  title: string;

  tone:
    | "green"
    | "orange"
    | "red";

  rows:
    Array<{
      seed:
        number |
        null;

      teamName: string;

      record: string;
    }>;

  empty: string;
}) {
  const toneStyle =
    tone ===
    "green"
      ? styles.raceGreen
      : tone ===
          "orange"
        ? styles.raceOrange
        : styles.raceRed;


  return (
    <div
      style={
        styles.raceGroup
      }
    >
      <strong
        style={{
          ...styles.raceGroupTitle,
          ...toneStyle,
        }}
      >
        {title}
      </strong>


      {rows.length >
      0 ? (
        rows.map(
          (
            row
          ) => (
            <div
              key={
                `${title}-${row.teamName}`
              }
              style={
                styles.raceTeamRow
              }
            >
              <div
                style={
                  styles.raceTeamLeft
                }
              >
                <span
                  style={
                    styles.raceSeed
                  }
                >
                  {row.seed
                    ? `#${row.seed}`
                    : "—"}
                </span>

                <span
                  style={
                    styles.raceTeamName
                  }
                >
                  {row.teamName}
                </span>
              </div>


              <span
                style={
                  styles.raceRecord
                }
              >
                {row.record}
              </span>
            </div>
          )
        )
      ) : (
        <span
          style={
            styles.raceEmpty
          }
        >
          {empty}
        </span>
      )}
    </div>
  );
}


function HeaderStat({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      style={
        styles.headerStat
      }
    >
      <span
        style={
          styles.headerStatLabel
        }
      >
        {label}
      </span>

      <strong
        style={
          accent
            ? styles.headerStatAccent
            : styles.headerStatValue
        }
      >
        {value}
      </strong>
    </div>
  );
}


function FormatStep({
  number,
  title,
  text,
}: {
  number: string;
  title: string;
  text: string;
}) {
  return (
    <div
      style={
        styles.formatStep
      }
    >
      <div
        style={
          styles.stepNumber
        }
      >
        {number}
      </div>

      <div>
        <strong
          style={
            styles.formatStepTitle
          }
        >
          {title}
        </strong>

        <p
          style={
            styles.formatStepText
          }
        >
          {text}
        </p>
      </div>
    </div>
  );
}


function RoundHeading({
  title,
  week,
}: {
  title: string;
  week: number;
}) {
  return (
    <div
      style={
        styles.roundHeading
      }
    >
      <span
        style={
          styles.roundWeek
        }
      >
        WEEK {week}
      </span>

      <strong
        style={
          styles.roundTitle
        }
      >
        {title}
      </strong>
    </div>
  );
}


function BracketMatchup({
  matchup,
  fallbackHome,
  fallbackAway,
  makeTeam,
  championship = false,
}: {
  matchup:
    PlayoffMatchupRow |
    null;

  fallbackHome: {
    fantasyTeamId:
      number |
      null;
    seed:
      number |
      null;
    teamName: string;
  };

  fallbackAway: {
    fantasyTeamId:
      number |
      null;
    seed:
      number |
      null;
    teamName: string;
  };

  makeTeam: (
    fantasyTeamId:
      number |
      null,
    seed:
      number |
      null,
    points: number,
    winnerId:
      number |
      null
  ) => BracketTeam;

  championship?:
    boolean;
}) {
  const winnerId =
    matchup
      ?.winner_fantasy_team_id ??
    null;


  const home =
    matchup
      ? makeTeam(
          matchup
            .home_fantasy_team_id,
          matchup
            .home_seed,
          numberValue(
            matchup
              .home_points
          ),
          winnerId
        )
      : {
          fantasyTeamId:
            fallbackHome
              .fantasyTeamId,

          seed:
            fallbackHome.seed,

          teamName:
            fallbackHome.teamName,

          points:
            0,

          isWinner:
            false,
        };


  const away =
    matchup
      ? makeTeam(
          matchup
            .away_fantasy_team_id,
          matchup
            .away_seed,
          numberValue(
            matchup
              .away_points
          ),
          winnerId
        )
      : {
          fantasyTeamId:
            fallbackAway
              .fantasyTeamId,

          seed:
            fallbackAway.seed,

          teamName:
            fallbackAway.teamName,

          points:
            0,

          isWinner:
            false,
        };


  const status =
    matchup
      ? statusLabel(
          matchup
        )
      : "TBD";


  return (
    <div
      style={{
        ...styles.matchupCard,

        ...(championship
          ? styles.championshipCard
          : {}),

        ...(matchup
          ?.is_live
          ? styles.liveMatchupCard
          : {}),
      }}
    >
      <div
        style={
          styles.matchupTop
        }
      >
        <span
          style={
            matchup
              ?.is_live
              ? styles.liveStatus
              : matchup
                  ?.is_final
                ? styles.finalStatus
                : styles.pendingStatus
          }
        >
          {status}
        </span>

        {matchup ? (
          <span
            style={
              styles.matchupNumber
            }
          >
            #{matchup.matchup_number}
          </span>
        ) : null}
      </div>


      <BracketTeamRow
        team={
          home
        }
      />

      <div
        style={
          styles.matchupDivider
        }
      />

      <BracketTeamRow
        team={
          away
        }
      />
    </div>
  );
}


function BracketTeamRow({
  team,
}: {
  team:
    BracketTeam;
}) {
  return (
    <div
      style={{
        ...styles.bracketTeamRow,

        ...(team.isWinner
          ? styles.winnerTeamRow
          : {}),
      }}
    >
      <div
        style={
          styles.bracketSeed
        }
      >
        {team.seed
          ? `#${team.seed}`
          : "—"}
      </div>

      <div
        style={
          styles.bracketTeamCircle
        }
      >
        {team.teamName ===
        "TBD"
          ? "?"
          : team.teamName
              .slice(
                0,
                1
              )
              .toUpperCase()}
      </div>

      <strong
        style={
          styles.bracketTeamName
        }
      >
        {team.teamName}
      </strong>

      <strong
        style={{
          ...styles.bracketScore,

          ...(team.isWinner
            ? styles.winnerScore
            : {}),
        }}
      >
        {team.points.toFixed(
          2
        )}
      </strong>
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


  header: {
    display:
      "flex",

    alignItems:
      "flex-end",

    justifyContent:
      "space-between",

    gap:
      "18px",

    flexWrap:
      "wrap" as const,
  },


  eyebrow: {
    margin:
      0,

    color:
      "#ff7d1d",

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
      "#767d86",

    fontSize: "15px",
  },


  headerStats: {
    display:
      "flex",

    gap:
      "8px",

    flexWrap:
      "wrap" as const,
  },


  headerStat: {
    minWidth:
      "112px",

    padding:
      "8px 11px",

    display:
      "grid",

    justifyItems:
      "center",

    gap:
      "2px",

    border:
      "1px solid rgba(255,255,255,.075)",

    borderRadius:
      "7px",

    background:
      "#111315",
  },


  headerStatLabel: {
    color:
      "#747b84",

    fontSize: "11px",

    fontWeight:
      900,
  },


  headerStatValue: {
    color:
      "#f1f2f3",

    fontSize: "17px",
  },


  headerStatAccent: {
    color:
      "#ff8626",

    fontSize: "17px",
  },


  playoffConfigBar: {
    padding:
      "9px 12px",

    display:
      "flex",

    alignItems:
      "center",

    gap:
      "12px",

    flexWrap:
      "wrap" as const,

    border:
      "1px solid rgba(255,255,255,.065)",

    borderRadius:
      "7px",

    background:
      "linear-gradient(90deg,rgba(255,95,15,.035),#101214)",
  },


  configItem: {
    minWidth:
      "145px",

    display:
      "grid",

    gap:
      "2px",
  },


  configLabel: {
    color:
      "#6f7680",

    fontSize: "11px",

    fontWeight:
      950,

    letterSpacing:
      ".06em",
  },


  configValue: {
    color:
      "#d5d8dc",

    fontSize: "13px",
  },


  configValueGreen: {
    color:
      "#4ddd89",

    fontSize: "13px",
  },


  configDivider: {
    width:
      "1px",

    height:
      "24px",

    background:
      "rgba(255,255,255,.065)",
  },


  championBanner: {
    padding:
      "14px 18px",

    display:
      "flex",

    alignItems:
      "center",

    gap:
      "14px",

    border:
      "1px solid rgba(255,145,20,.25)",

    borderRadius:
      "8px",

    background:
      "linear-gradient(90deg,rgba(140,20,15,.28),rgba(255,95,10,.09),#111315)",
  },


  trophyCircle: {
    width:
      "46px",

    height:
      "46px",

    display:
      "flex",

    alignItems:
      "center",

    justifyContent:
      "center",

    border:
      "1px solid rgba(255,150,40,.38)",

    borderRadius:
      "50%",

    background:
      "rgba(255,125,25,.07)",

    color:
      "#ffab3d",

    fontSize: "22px",
  },


  championLabel: {
    display:
      "block",

    color:
      "#ff9b32",

    fontSize: "12px",

    fontWeight:
      950,

    letterSpacing:
      ".08em",
  },


  championName: {
    display:
      "block",

    marginTop:
      "2px",

    color:
      "#fff",

    fontSize: "20px",
  },


  championMeta: {
    color:
      "#858c95",

    fontSize: "13px",
  },


  prePlayoffGrid: {
    display:
      "grid",

    gridTemplateColumns:
      "minmax(0,1fr) 310px",

    gap:
      "14px",

    alignItems:
      "start",
  },


  projectedFieldCard: {
    overflow:
      "hidden",

    border:
      "1px solid rgba(255,255,255,.08)",

    borderRadius:
      "8px",

    background:
      "linear-gradient(180deg,#151719,#101113)",
  },


  formatCard: {
    padding:
      "16px",

    border:
      "1px solid rgba(255,255,255,.08)",

    borderRadius:
      "8px",

    background:
      "#111315",
  },


  sectionHeading: {
    padding:
      "12px 14px",

    display:
      "flex",

    alignItems:
      "center",

    justifyContent:
      "space-between",

    gap:
      "12px",

    borderBottom:
      "1px solid rgba(255,255,255,.06)",
  },


  sectionKicker: {
    color:
      "#ff7f20",

    fontSize: "11px",

    fontWeight:
      950,
  },


  sectionTitle: {
    margin:
      "2px 0 0",

    color:
      "#f3f4f5",

    fontSize: "18px",
  },


  projectedBadge: {
    padding:
      "4px 7px",

    border:
      "1px solid rgba(255,130,25,.25)",

    borderRadius:
      "4px",

    color:
      "#ff8c2b",

    fontSize: "11px",

    fontWeight:
      950,
  },


  seedList: {
    display:
      "grid",
  },


  seedRow: {
    minHeight:
      "56px",

    padding:
      "7px 13px",

    display:
      "grid",

    gridTemplateColumns:
      "32px 32px minmax(0,1fr) auto",

    alignItems:
      "center",

    gap:
      "8px",

    borderBottom:
      "1px solid rgba(255,255,255,.045)",
  },


  byeSeedRow: {
    background:
      "linear-gradient(90deg,rgba(255,110,15,.055),transparent 50%)",
  },


  seedNumber: {
    color:
      "#ff8728",

    fontSize: "18px",

    fontWeight:
      950,
  },


  teamCircle: {
    width:
      "30px",

    height:
      "30px",

    display:
      "flex",

    alignItems:
      "center",

    justifyContent:
      "center",

    borderRadius:
      "50%",

    background:
      "#272a2e",

    color:
      "#f1f2f3",

    fontSize: "14px",

    fontWeight:
      950,
  },


  seedTeamText: {
    minWidth:
      0,

    display:
      "grid",

    gap:
      "2px",
  },


  seedTeamName: {
    overflow:
      "hidden",

    textOverflow:
      "ellipsis",

    whiteSpace:
      "nowrap" as const,

    color:
      "#f3f4f5",

    fontSize: "15px",
  },


  seedMeta: {
    color:
      "#707780",

    fontSize: "11px",
  },


  byeBadge: {
    padding:
      "4px 7px",

    border:
      "1px solid rgba(80,220,130,.25)",

    borderRadius:
      "4px",

    color:
      "#51db87",

    fontSize: "11px",

    fontWeight:
      950,
  },


  wildCardBadge: {
    color:
      "#757c85",

    fontSize: "11px",

    fontWeight:
      900,
  },


  formatStep: {
    marginTop:
      "14px",

    display:
      "grid",

    gridTemplateColumns:
      "28px 1fr",

    gap:
      "9px",

    alignItems:
      "start",
  },


  stepNumber: {
    width:
      "26px",

    height:
      "26px",

    display:
      "flex",

    alignItems:
      "center",

    justifyContent:
      "center",

    borderRadius:
      "50%",

    background:
      "linear-gradient(135deg,#b71d18,#ff6412)",

    color:
      "#fff",

    fontSize: "13px",

    fontWeight:
      950,
  },


  formatStepTitle: {
    color:
      "#f3f4f5",

    fontSize: "14px",
  },


  formatStepText: {
    margin:
      "3px 0 0",

    color:
      "#737a84",

    fontSize: "12px",

    lineHeight:
      1.4,
  },


  tieNote: {
    marginTop:
      "16px",

    padding:
      "9px 10px",

    border:
      "1px solid rgba(255,255,255,.06)",

    borderRadius:
      "6px",

    color:
      "#838a94",

    fontSize: "12px",

    lineHeight:
      1.45,
  },


  bracketShell: {
    display:
      "grid",

    gridTemplateColumns:
      "repeat(3,minmax(260px,1fr))",

    gap:
      "18px",

    alignItems:
      "stretch",
  },


  bracketRound: {
    minWidth:
      0,

    display:
      "grid",

    alignContent:
      "start",

    gap:
      "14px",
  },


  roundHeading: {
    padding:
      "8px 10px",

    display:
      "flex",

    alignItems:
      "center",

    justifyContent:
      "space-between",

    borderBottom:
      "1px solid rgba(255,255,255,.07)",
  },


  roundWeek: {
    color:
      "#747b84",

    fontSize: "11px",

    fontWeight:
      900,
  },


  roundTitle: {
    color:
      "#f2f3f4",

    fontSize: "16px",
  },


  matchupCard: {
    overflow:
      "hidden",

    border:
      "1px solid rgba(255,255,255,.09)",

    borderRadius:
      "8px",

    background:
      "linear-gradient(180deg,#17191b,#111214)",
  },


  liveMatchupCard: {
    border:
      "1px solid rgba(68,220,132,.3)",

    boxShadow:
      "0 0 20px rgba(45,190,110,.05)",
  },


  championshipCard: {
    border:
      "1px solid rgba(255,120,25,.22)",

    background:
      "linear-gradient(180deg,rgba(120,25,20,.18),#121315)",
  },


  matchupTop: {
    minHeight:
      "28px",

    padding:
      "5px 8px",

    display:
      "flex",

    alignItems:
      "center",

    justifyContent:
      "space-between",

    borderBottom:
      "1px solid rgba(255,255,255,.055)",
  },


  liveStatus: {
    color:
      "#49db87",

    fontSize: "11px",

    fontWeight:
      950,
  },


  finalStatus: {
    color:
      "#a4aab2",

    fontSize: "11px",

    fontWeight:
      950,
  },


  pendingStatus: {
    color:
      "#747b84",

    fontSize: "11px",

    fontWeight:
      900,
  },


  matchupNumber: {
    color:
      "#5e656e",

    fontSize: "11px",
  },


  bracketTeamRow: {
    minHeight:
      "48px",

    padding:
      "7px 9px",

    display:
      "grid",

    gridTemplateColumns:
      "28px 28px minmax(0,1fr) 58px",

    alignItems:
      "center",

    gap:
      "7px",
  },


  winnerTeamRow: {
    background:
      "linear-gradient(90deg,rgba(50,200,115,.08),transparent 65%)",
  },


  bracketSeed: {
    color:
      "#ff8627",

    fontSize: "12px",

    fontWeight:
      950,
  },


  bracketTeamCircle: {
    width:
      "27px",

    height:
      "27px",

    display:
      "flex",

    alignItems:
      "center",

    justifyContent:
      "center",

    borderRadius:
      "50%",

    background:
      "#25282c",

    color:
      "#eceef0",

    fontSize: "12px",

    fontWeight:
      950,
  },


  bracketTeamName: {
    minWidth:
      0,

    overflow:
      "hidden",

    textOverflow:
      "ellipsis",

    whiteSpace:
      "nowrap" as const,

    color:
      "#f0f1f2",

    fontSize: "14px",
  },


  bracketScore: {
    justifySelf:
      "end",

    color:
      "#e5e7ea",

    fontSize: "15px",

    fontVariantNumeric:
      "tabular-nums",
  },


  winnerScore: {
    color:
      "#4ddd89",
  },


  matchupDivider: {
    height:
      "1px",

    margin:
      "0 8px",

    background:
      "rgba(255,255,255,.045)",
  },


  championshipSpacer: {
    height:
      "74px",
  },


  mainContentGrid: {
    display:
      "grid",

    gridTemplateColumns:
      "minmax(0,1fr) 290px",

    gap:
      "14px",

    alignItems:
      "start",
  },


  mainPrimary: {
    minWidth:
      0,
  },


  playoffRaceSidebar: {
    minWidth:
      0,

    display:
      "grid",

    gap:
      "12px",
  },


  raceCard: {
    overflow:
      "hidden",

    border:
      "1px solid rgba(255,255,255,.085)",

    borderRadius:
      "8px",

    background:
      "linear-gradient(180deg,#131517,#0f1113)",
  },


  raceHeader: {
    padding:
      "12px 13px",

    display:
      "flex",

    alignItems:
      "center",

    justifyContent:
      "space-between",

    gap:
      "10px",

    borderBottom:
      "1px solid rgba(255,255,255,.06)",
  },


  raceTitle: {
    margin:
      "2px 0 0",

    color:
      "#f2f3f4",

    fontSize: "17px",
  },


  cutLineBadge: {
    padding:
      "4px 7px",

    border:
      "1px solid rgba(255,130,25,.24)",

    borderRadius:
      "4px",

    color:
      "#ff8b26",

    fontSize: "11px",

    fontWeight:
      950,
  },


  raceGroup: {
    padding:
      "10px 12px",

    display:
      "grid",

    gap:
      "7px",
  },


  raceGroupTitle: {
    fontSize: "13px",

    letterSpacing:
      ".04em",
  },


  raceGreen: {
    color:
      "#4ddd89",
  },


  raceOrange: {
    color:
      "#ff8c2a",
  },


  raceRed: {
    color:
      "#ff5b52",
  },


  raceTeamRow: {
    display:
      "flex",

    alignItems:
      "center",

    justifyContent:
      "space-between",

    gap:
      "8px",
  },


  raceTeamLeft: {
    minWidth:
      0,

    display:
      "flex",

    alignItems:
      "center",

    gap:
      "6px",
  },


  raceSeed: {
    width:
      "24px",

    color:
      "#7c838c",

    fontSize: "12px",

    fontWeight:
      900,
  },


  raceTeamName: {
    overflow:
      "hidden",

    textOverflow:
      "ellipsis",

    whiteSpace:
      "nowrap" as const,

    color:
      "#cfd3d8",

    fontSize: "13px",
  },


  raceRecord: {
    flex:
      "0 0 auto",

    color:
      "#767d86",

    fontSize: "12px",

    fontVariantNumeric:
      "tabular-nums",
  },


  raceEmpty: {
    color:
      "#696f78",

    fontSize: "12px",
  },


  cutLineRow: {
    padding:
      "8px 10px",

    display:
      "grid",

    gridTemplateColumns:
      "1fr auto 1fr",

    alignItems:
      "center",

    gap:
      "6px",

    borderTop:
      "1px solid rgba(255,255,255,.04)",

    borderBottom:
      "1px solid rgba(255,255,255,.04)",

    background:
      "rgba(255,105,20,.025)",
  },


  cutLineLine: {
    height:
      "1px",

    background:
      "rgba(255,125,25,.16)",
  },


  cutLineText: {
    color:
      "#8f969f",

    fontSize: "11px",

    whiteSpace:
      "nowrap" as const,
  },


  footerInfo: {
    padding:
      "10px 12px",

    display:
      "grid",

    gridTemplateColumns:
      "repeat(4,1fr)",

    gap:
      "10px",

    border:
      "1px solid rgba(255,255,255,.055)",

    borderRadius:
      "7px",

    background:
      "#101214",
  },


  footerLabel: {
    display:
      "block",

    color:
      "#6f7680",

    fontSize: "11px",

    fontWeight:
      900,
  },


  footerValue: {
    color:
      "#c7cbd1",

    fontSize: "13px",
  },
} as const;