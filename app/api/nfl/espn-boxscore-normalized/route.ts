import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";


/* =========================================================
   TYPES
========================================================= */

type EspnAthlete = {
  id?: string;
  displayName?: string;
  fullName?: string;
};


type EspnAthleteStatRow = {
  athlete?: EspnAthlete;
  stats?: string[];
};


type EspnStatCategory = {
  name?: string;
  displayName?: string | null;
  labels?: string[];
  athletes?: EspnAthleteStatRow[];
};


type EspnPlayerTeam = {
  team?: {
    id?: string;
    abbreviation?: string;
    displayName?: string;
  };

  statistics?: EspnStatCategory[];
};


type EspnTeamStatistic = {
  name?: string;
  displayValue?: string;
  value?: number;
};


type EspnBoxscoreTeam = {
  team?: {
    id?: string;
    abbreviation?: string;
    displayName?: string;
  };

  statistics?: EspnTeamStatistic[];
};


type EspnCompetitor = {
  homeAway?: string;
  score?: string;

  team?: {
    id?: string;
    abbreviation?: string;
    displayName?: string;
  };
};


type EspnSummary = {
  header?: {
    season?: {
      year?: number;
      type?: number;
    };

    week?: number;

    competitions?: Array<{
      status?: {
        type?: {
          name?: string;
          state?: string;
          completed?: boolean;
          detail?: string;
        };
      };

      competitors?: EspnCompetitor[];
    }>;
  };

  boxscore?: {
    players?: EspnPlayerTeam[];
    teams?: EspnBoxscoreTeam[];
  };
};


type NormalizedPlayerGameStats = {
  espn_player_id: string;
  player_name: string | null;

  espn_team_id: string | null;
  team_abbreviation: string | null;

  passing_attempts: number;
  passing_completions: number;
  passing_yards: number;
  passing_touchdowns: number;
  passing_interceptions: number;

  rushing_attempts: number;
  rushing_yards: number;
  rushing_touchdowns: number;

  receiving_targets: number;
  receptions: number;
  receiving_yards: number;
  receiving_touchdowns: number;

  fumbles: number;
  fumbles_lost: number;

  field_goals_made: number;
  field_goals_attempted: number;

  extra_points_made: number;
  extra_points_attempted: number;

  kick_return_yards: number;
  kick_return_touchdowns: number;

  punt_return_yards: number;
  punt_return_touchdowns: number;

  defensive_sacks: number;
  defensive_interceptions: number;
  defensive_touchdowns: number;
};


type NormalizedDstStats = {
  espn_team_id: string | null;
  team_abbreviation: string | null;
  team_name: string | null;

  opponent_abbreviation: string | null;

  dst_sacks: number;
  dst_interceptions: number;
  dst_touchdowns: number;

  dst_points_allowed: number;

  dst_yards_allowed: number | null;
};


/* =========================================================
   HELPERS
========================================================= */

function toNumber(
  value:
    string |
    number |
    null |
    undefined
) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return 0;
  }

  const parsed =
    Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : 0;
}


function parseFraction(
  value:
    string |
    null |
    undefined
) {
  if (!value) {
    return {
      made: 0,
      attempted: 0,
    };
  }

  const [
    madeRaw,
    attemptedRaw,
  ] =
    value.split("/");

  return {
    made:
      toNumber(madeRaw),

    attempted:
      toNumber(attemptedRaw),
  };
}


function createBlankPlayer(
  espnPlayerId: string,
  playerName: string | null,
  espnTeamId: string | null,
  teamAbbreviation: string | null
): NormalizedPlayerGameStats {
  return {
    espn_player_id:
      espnPlayerId,

    player_name:
      playerName,

    espn_team_id:
      espnTeamId,

    team_abbreviation:
      teamAbbreviation,

    passing_attempts: 0,
    passing_completions: 0,
    passing_yards: 0,
    passing_touchdowns: 0,
    passing_interceptions: 0,

    rushing_attempts: 0,
    rushing_yards: 0,
    rushing_touchdowns: 0,

    receiving_targets: 0,
    receptions: 0,
    receiving_yards: 0,
    receiving_touchdowns: 0,

    fumbles: 0,
    fumbles_lost: 0,

    field_goals_made: 0,
    field_goals_attempted: 0,

    extra_points_made: 0,
    extra_points_attempted: 0,

    kick_return_yards: 0,
    kick_return_touchdowns: 0,

    punt_return_yards: 0,
    punt_return_touchdowns: 0,

    defensive_sacks: 0,
    defensive_interceptions: 0,
    defensive_touchdowns: 0,
  };
}


function getLabelIndex(
  labels: string[],
  label: string
) {
  return labels.findIndex(
    (current) =>
      current
        .trim()
        .toUpperCase() ===
      label
        .trim()
        .toUpperCase()
  );
}


function getStat(
  labels: string[],
  stats: string[],
  label: string
) {
  const index =
    getLabelIndex(
      labels,
      label
    );

  if (
    index < 0 ||
    index >= stats.length
  ) {
    return null;
  }

  return stats[index] ??
    null;
}


function getTeamStatistic(
  team:
    EspnBoxscoreTeam |
    undefined,
  possibleNames: string[]
) {
  if (!team) {
    return null;
  }

  for (
    const statistic
    of team.statistics ?? []
  ) {
    const normalizedName =
      statistic.name
        ?.toLowerCase()
        .replace(
          /[^a-z0-9]/g,
          ""
        );

    if (!normalizedName) {
      continue;
    }

    const matched =
      possibleNames.some(
        (name) =>
          normalizedName ===
          name
            .toLowerCase()
            .replace(
              /[^a-z0-9]/g,
              ""
            )
      );

    if (!matched) {
      continue;
    }

    if (
      statistic.value !==
      undefined
    ) {
      return statistic.value;
    }

    if (
      statistic.displayValue !==
      undefined
    ) {
      const parsed =
        Number(
          statistic.displayValue
            .replace(
              /[^0-9.-]/g,
              ""
            )
        );

      if (
        Number.isFinite(
          parsed
        )
      ) {
        return parsed;
      }
    }
  }

  return null;
}


/* =========================================================
   ROUTE
========================================================= */

export async function GET(
  request: Request
) {
  try {
    const requestUrl =
      new URL(
        request.url
      );

    const eventId =
      requestUrl.searchParams.get(
        "eventId"
      ) ??
      "401873272";


    if (
      !/^\d+$/.test(
        eventId
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "eventId must be a numeric ESPN event ID.",
        },
        {
          status: 400,
        }
      );
    }


    const espnUrl =
      `https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=${eventId}`;


    const response =
      await fetch(
        espnUrl,
        {
          method: "GET",

          cache: "no-store",

          headers: {
            Accept:
              "application/json",

            "User-Agent":
              "Mozilla/5.0 Gridiron365/1.0",
          },
        }
      );


    const rawText =
      await response.text();


    if (
      !response.ok
    ) {
      return NextResponse.json(
        {
          success: false,

          source:
            "ESPN",

          eventId,

          status:
            response.status,

          statusText:
            response.statusText,

          responsePreview:
            rawText.slice(
              0,
              2000
            ),
        },
        {
          status: 502,
        }
      );
    }


    let data:
      EspnSummary;


    try {
      data =
        JSON.parse(
          rawText
        ) as EspnSummary;
    } catch {
      return NextResponse.json(
        {
          success: false,

          source:
            "ESPN",

          eventId,

          error:
            "ESPN returned invalid JSON.",
        },
        {
          status: 502,
        }
      );
    }


    const competition =
      data.header
        ?.competitions
        ?.[0];


    const competitors =
      competition
        ?.competitors ??
      [];


    const homeCompetitor =
      competitors.find(
        (competitor) =>
          competitor.homeAway ===
          "home"
      );


    const awayCompetitor =
      competitors.find(
        (competitor) =>
          competitor.homeAway ===
          "away"
      );


    const playersById =
      new Map<
        string,
        NormalizedPlayerGameStats
      >();


    const playerTeams =
      data.boxscore
        ?.players ??
      [];


    /* =====================================================
       PLAYER STATS
    ===================================================== */

    for (
      const teamGroup
      of playerTeams
    ) {
      const espnTeamId =
        teamGroup.team?.id ??
        null;

      const teamAbbreviation =
        teamGroup.team
          ?.abbreviation ??
        null;


      for (
        const category
        of teamGroup.statistics ??
        []
      ) {
        const categoryName =
          category.name ??
          "";

        const labels =
          category.labels ??
          [];


        for (
          const athleteRow
          of category.athletes ??
          []
        ) {
          const espnPlayerId =
            athleteRow
              .athlete
              ?.id;

          if (
            !espnPlayerId
          ) {
            continue;
          }


          const playerName =
            athleteRow
              .athlete
              ?.displayName ??
            athleteRow
              .athlete
              ?.fullName ??
            null;


          let player =
            playersById.get(
              espnPlayerId
            );


          if (!player) {
            player =
              createBlankPlayer(
                espnPlayerId,
                playerName,
                espnTeamId,
                teamAbbreviation
              );

            playersById.set(
              espnPlayerId,
              player
            );
          }


          const stats =
            athleteRow.stats ??
            [];


          /* ===============================================
             PASSING
          =============================================== */

          if (
            categoryName ===
            "passing"
          ) {
            const completionAttempt =
              getStat(
                labels,
                stats,
                "C/ATT"
              );


            if (
              completionAttempt
            ) {
              const [
                completions,
                attempts,
              ] =
                completionAttempt
                  .split("/");

              player
                .passing_completions =
                toNumber(
                  completions
                );

              player
                .passing_attempts =
                toNumber(
                  attempts
                );
            }


            player
              .passing_yards =
              toNumber(
                getStat(
                  labels,
                  stats,
                  "YDS"
                )
              );


            player
              .passing_touchdowns =
              toNumber(
                getStat(
                  labels,
                  stats,
                  "TD"
                )
              );


            player
              .passing_interceptions =
              toNumber(
                getStat(
                  labels,
                  stats,
                  "INT"
                )
              );
          }


          /* ===============================================
             RUSHING
          =============================================== */

          else if (
            categoryName ===
            "rushing"
          ) {
            player
              .rushing_attempts =
              toNumber(
                getStat(
                  labels,
                  stats,
                  "CAR"
                )
              );


            player
              .rushing_yards =
              toNumber(
                getStat(
                  labels,
                  stats,
                  "YDS"
                )
              );


            player
              .rushing_touchdowns =
              toNumber(
                getStat(
                  labels,
                  stats,
                  "TD"
                )
              );
          }


          /* ===============================================
             RECEIVING
          =============================================== */

          else if (
            categoryName ===
            "receiving"
          ) {
            player
              .receptions =
              toNumber(
                getStat(
                  labels,
                  stats,
                  "REC"
                )
              );


            player
              .receiving_yards =
              toNumber(
                getStat(
                  labels,
                  stats,
                  "YDS"
                )
              );


            player
              .receiving_touchdowns =
              toNumber(
                getStat(
                  labels,
                  stats,
                  "TD"
                )
              );


            player
              .receiving_targets =
              toNumber(
                getStat(
                  labels,
                  stats,
                  "TGTS"
                )
              );
          }


          /* ===============================================
             FUMBLES
          =============================================== */

          else if (
            categoryName ===
            "fumbles"
          ) {
            player.fumbles =
              toNumber(
                getStat(
                  labels,
                  stats,
                  "FUM"
                )
              );


            player.fumbles_lost =
              toNumber(
                getStat(
                  labels,
                  stats,
                  "LOST"
                )
              );
          }


          /* ===============================================
             KICK RETURNS
          =============================================== */

          else if (
            categoryName ===
            "kickReturns"
          ) {
            player
              .kick_return_yards =
              toNumber(
                getStat(
                  labels,
                  stats,
                  "YDS"
                )
              );


            player
              .kick_return_touchdowns =
              toNumber(
                getStat(
                  labels,
                  stats,
                  "TD"
                )
              );
          }


          /* ===============================================
             PUNT RETURNS
          =============================================== */

          else if (
            categoryName ===
            "puntReturns"
          ) {
            player
              .punt_return_yards =
              toNumber(
                getStat(
                  labels,
                  stats,
                  "YDS"
                )
              );


            player
              .punt_return_touchdowns =
              toNumber(
                getStat(
                  labels,
                  stats,
                  "TD"
                )
              );
          }


          /* ===============================================
             KICKING
          =============================================== */

          else if (
            categoryName ===
            "kicking"
          ) {
            const fg =
              parseFraction(
                getStat(
                  labels,
                  stats,
                  "FG"
                )
              );


            player
              .field_goals_made =
              fg.made;


            player
              .field_goals_attempted =
              fg.attempted;


            const xp =
              parseFraction(
                getStat(
                  labels,
                  stats,
                  "XP"
                )
              );


            player
              .extra_points_made =
              xp.made;


            player
              .extra_points_attempted =
              xp.attempted;
          }


          /* ===============================================
             DEFENSIVE PLAYER STATS
          =============================================== */

          else if (
            categoryName ===
            "defensive"
          ) {
            player
              .defensive_sacks =
              toNumber(
                getStat(
                  labels,
                  stats,
                  "SACKS"
                )
              );


            player
              .defensive_touchdowns =
              toNumber(
                getStat(
                  labels,
                  stats,
                  "TD"
                )
              );
          }


          /* ===============================================
             DEFENSIVE INTERCEPTIONS
          =============================================== */

          else if (
            categoryName ===
            "interceptions"
          ) {
            player
              .defensive_interceptions =
              toNumber(
                getStat(
                  labels,
                  stats,
                  "INT"
                )
              );


            /*
             * ESPN's interceptions category also includes
             * return TDs. Add those into defensive TDs.
             */
            player
              .defensive_touchdowns +=
              toNumber(
                getStat(
                  labels,
                  stats,
                  "TD"
                )
              );
          }
        }
      }
    }


    /* =====================================================
       TEAM DST
    ===================================================== */

    const boxscoreTeams =
      data.boxscore
        ?.teams ??
      [];


    const dstStats:
      NormalizedDstStats[] =
      [];


    for (
      const teamGroup
      of playerTeams
    ) {
      const teamId =
        teamGroup.team?.id ??
        null;

      const teamAbbreviation =
        teamGroup.team
          ?.abbreviation ??
        null;

      const teamName =
        teamGroup.team
          ?.displayName ??
        null;


      const isHome =
        homeCompetitor
          ?.team
          ?.id ===
        teamId;


      const opponent =
        isHome
          ? awayCompetitor
          : homeCompetitor;


      const pointsAllowed =
        toNumber(
          opponent?.score
        );


      let dstSacks =
        0;

      let dstInterceptions =
        0;

      let dstTouchdowns =
        0;


      for (
        const player
        of playersById.values()
      ) {
        if (
          player.espn_team_id !==
          teamId
        ) {
          continue;
        }

        dstSacks +=
          player.defensive_sacks;

        dstInterceptions +=
          player
            .defensive_interceptions;

        dstTouchdowns +=
          player
            .defensive_touchdowns;
      }


      const matchingBoxscoreTeam =
        boxscoreTeams.find(
          (boxTeam) =>
            boxTeam.team?.id ===
            teamId
        );


      /*
       * ESPN sometimes provides team total-yards
       * under slightly different names.
       */
      const teamTotalYards =
        getTeamStatistic(
          matchingBoxscoreTeam,
          [
            "totalYards",
            "totalOffensiveYards",
            "netTotalYards",
          ]
        );


      /*
       * DST yards allowed = opponent total offense.
       */
      const opponentBoxscoreTeam =
        boxscoreTeams.find(
          (boxTeam) =>
            boxTeam.team?.id ===
            opponent?.team?.id
        );


      const opponentTotalYards =
        getTeamStatistic(
          opponentBoxscoreTeam,
          [
            "totalYards",
            "totalOffensiveYards",
            "netTotalYards",
          ]
        );


      void teamTotalYards;


      dstStats.push({
        espn_team_id:
          teamId,

        team_abbreviation:
          teamAbbreviation,

        team_name:
          teamName,

        opponent_abbreviation:
          opponent
            ?.team
            ?.abbreviation ??
          null,

        dst_sacks:
          dstSacks,

        dst_interceptions:
          dstInterceptions,

        dst_touchdowns:
          dstTouchdowns,

        dst_points_allowed:
          pointsAllowed,

        dst_yards_allowed:
          opponentTotalYards,
      });
    }


    /* =====================================================
       RESPONSE
    ===================================================== */

    const normalizedPlayers =
      Array.from(
        playersById.values()
      )
        .filter(
          (player) => {
            /*
             * Remove players who only appeared in defensive
             * tackle data and have no fantasy-relevant stats.
             */
            return (
              player.passing_attempts !== 0 ||
              player.passing_completions !== 0 ||
              player.passing_yards !== 0 ||
              player.passing_touchdowns !== 0 ||
              player.passing_interceptions !== 0 ||

              player.rushing_attempts !== 0 ||
              player.rushing_yards !== 0 ||
              player.rushing_touchdowns !== 0 ||

              player.receiving_targets !== 0 ||
              player.receptions !== 0 ||
              player.receiving_yards !== 0 ||
              player.receiving_touchdowns !== 0 ||

              player.fumbles !== 0 ||
              player.fumbles_lost !== 0 ||

              player.field_goals_made !== 0 ||
              player.field_goals_attempted !== 0 ||
              player.extra_points_made !== 0 ||
              player.extra_points_attempted !== 0 ||

              player.kick_return_yards !== 0 ||
              player.kick_return_touchdowns !== 0 ||

              player.punt_return_yards !== 0 ||
              player.punt_return_touchdowns !== 0
            );
          }
        )
        .sort(
          (
            a,
            b
          ) =>
            (
              a.team_abbreviation ??
              ""
            ).localeCompare(
              b.team_abbreviation ??
              ""
            ) ||
            (
              a.player_name ??
              ""
            ).localeCompare(
              b.player_name ??
              ""
            )
        );


    return NextResponse.json({
      success:
        true,

      source:
        "ESPN",

      mode:
        "parse-only",

      eventId,

      game: {
        season:
          data.header
            ?.season
            ?.year ??
          null,

        seasonType:
          data.header
            ?.season
            ?.type ??
          null,

        week:
          data.header
            ?.week ??
          null,

        status:
          competition
            ?.status
            ?.type
            ?.name ??
          null,

        state:
          competition
            ?.status
            ?.type
            ?.state ??
          null,

        completed:
          competition
            ?.status
            ?.type
            ?.completed ??
          false,

        detail:
          competition
            ?.status
            ?.type
            ?.detail ??
          null,

        home: {
          espnTeamId:
            homeCompetitor
              ?.team
              ?.id ??
            null,

          abbreviation:
            homeCompetitor
              ?.team
              ?.abbreviation ??
            null,

          name:
            homeCompetitor
              ?.team
              ?.displayName ??
            null,

          score:
            toNumber(
              homeCompetitor
                ?.score
            ),
        },

        away: {
          espnTeamId:
            awayCompetitor
              ?.team
              ?.id ??
            null,

          abbreviation:
            awayCompetitor
              ?.team
              ?.abbreviation ??
            null,

          name:
            awayCompetitor
              ?.team
              ?.displayName ??
            null,

          score:
            toNumber(
              awayCompetitor
                ?.score
            ),
        },
      },

      playerCount:
        normalizedPlayers.length,

      players:
        normalizedPlayers,

      dst:
        dstStats,

      limitations: {
        fieldGoalDistanceBuckets:
          "Not available from this box-score response. We will derive individual field-goal distances from ESPN play-by-play.",

        twoPointConversions:
          "Not represented in the tested ESPN box-score categories. We will supplement these from play-by-play if needed.",

        firstDowns:
          "Individual offensive first-down totals are not represented in the tested box-score categories.",

        dstFumbleRecoveries:
          "Not yet derived because ESPN's player fumble REC field can include offensive recoveries. We will derive DST takeaways more safely from play-by-play/team data.",
      },
    });
  } catch (
    error
  ) {
    console.error(
      "ESPN normalized box score failed:",
      error
    );


    return NextResponse.json(
      {
        success:
          false,

        error:
          error instanceof Error
            ? error.message
            : "Unknown ESPN box score error.",
      },
      {
        status: 500,
      }
    );
  }
}