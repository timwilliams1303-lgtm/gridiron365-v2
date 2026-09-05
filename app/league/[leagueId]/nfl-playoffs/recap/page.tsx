import type {
  CSSProperties,
  ReactNode,
} from "react";

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

import NflPlayoffsLeagueTeamsRealtime from "@/components/nfl-playoffs/NflPlayoffsLeagueTeamsRealtime";


export const dynamic =
  "force-dynamic";


type PageProps = {
  params:
    Promise<{
      leagueId: string;
    }>;

  searchParams:
    Promise<{
      round?: string;
    }>;
};


type TeamRow = {
  id:
    number;

  team_name:
    string;

  active:
    boolean | null;
};


type StateRow = {
  active_round:
    number | null;

  status:
    string | null;
};


type RoundRow = {
  round_number:
    number;

  round_key:
    string | null;

  round_name:
    string | null;

  nfl_week:
    number | null;

  status:
    string | null;

  first_kickoff_at:
    string | null;

  last_scheduled_kickoff_at:
    string | null;

  finalized_at:
    string | null;
};


type EntryRow = {
  fantasy_team_id:
    number;

  round_number:
    number;

  status:
    string | null;

  salary_used:
    number |
    string |
    null;

  projected_points:
    number |
    string |
    null;

  submitted_at:
    string | null;
};


type LineupRow = {
  fantasy_team_id:
    number;

  round_number:
    number;

  player_id:
    number;

  lineup_slot:
    string;

  slot_index:
    number;

  salary_at_selection:
    number |
    string |
    null;

  projected_points_at_selection:
    number |
    string |
    null;
};


type PlayerRow = {
  id:
    number;

  full_name:
    string;

  primary_position:
    string | null;

  team_abbreviation:
    string | null;
};


type ScoreRow = {
  nfl_player_id:
    number;

  week:
    number;

  fantasy_points:
    number |
    string |
    null;

  is_live:
    boolean | null;

  is_final:
    boolean | null;
};


type TeamRoundResult = {
  teamId:
    number;

  teamName:
    string;

  points:
    number;

  projectedPoints:
    number;

  salaryUsed:
    number | null;

  lineupCount:
    number;

  isMyTeam:
    boolean;
};


type PlayerPerformance = {
  playerId:
    number;

  fullName:
    string;

  position:
    string;

  nflTeam:
    string | null;

  fantasyPoints:
    number;

  salary:
    number | null;

  value:
    number | null;

  fantasyTeamId:
    number;

  fantasyTeamName:
    string;
};


type CumulativeStanding = {
  rank:
    number;

  teamId:
    number;

  teamName:
    string;

  totalPoints:
    number;

  roundsScored:
    number;

  averageRound:
    number | null;

  isMyTeam:
    boolean;
};


type Honor = {
  emoji:
    string;

  category:
    string;

  title:
    string;

  team:
    string;

  detail:
    string;

  infamy?:
    boolean;
};


function n(
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


function points(
  value:
    number |
    null |
    undefined
) {
  if (
    value ===
      null ||
    value ===
      undefined
  ) {
    return "—";
  }

  return value.toFixed(
    2
  );
}


function money(
  value:
    number |
    null |
    undefined
) {
  if (
    value ===
      null ||
    value ===
      undefined
  ) {
    return "—";
  }

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
    value
  );
}


function normalizePosition(
  value:
    string |
    null |
    undefined
) {
  const position =
    (
      value ??
      ""
    )
      .trim()
      .toUpperCase();

  if (
    position ===
    "PK"
  ) {
    return "K";
  }

  if (
    position ===
      "DEF" ||
    position ===
      "D/ST"
  ) {
    return "DST";
  }

  return (
    position ||
    "—"
  );
}


function clampRound(
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

  return Math.max(
    1,
    Math.min(
      4,
      Math.trunc(
        value
      )
    )
  );
}


function fallbackRoundName(
  roundNumber:
    number
) {
  switch (
    roundNumber
  ) {
    case 1:
      return "Wild Card";

    case 2:
      return "Divisional";

    case 3:
      return "Conference Championships";

    case 4:
      return "Super Bowl";

    default:
      return `Round ${roundNumber}`;
  }
}


function shortRoundName(
  roundNumber:
    number
) {
  switch (
    roundNumber
  ) {
    case 1:
      return "WILD CARD";

    case 2:
      return "DIVISIONAL";

    case 3:
      return "CONFERENCE";

    case 4:
      return "SUPER BOWL";

    default:
      return `ROUND ${roundNumber}`;
  }
}


function isRoundFinal(
  round:
    RoundRow |
    null |
    undefined
) {
  if (
    !round
  ) {
    return false;
  }

  if (
    round.finalized_at
  ) {
    return true;
  }

  const status =
    (
      round.status ??
      ""
    )
      .trim()
      .toLowerCase();

  return [
    "final",
    "finalized",
    "complete",
    "completed",
  ].includes(
    status
  );
}


function scoreKey(
  playerId:
    number,
  week:
    number
) {
  return `${playerId}:${week}`;
}


function teamRoundKey(
  teamId:
    number,
  roundNumber:
    number
) {
  return `${teamId}:${roundNumber}`;
}


export default async function NflPlayoffsRecapPage({
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
   * ACCESS
   * ============================================================
   */

  const access =
    await requireLeagueMember(
      leagueId
    );

  if (
    access.league
      .leagueType !==
    "nfl_playoffs"
  ) {
    redirect(
      `/league/${leagueId}`
    );
  }

  const supabase =
    await createSupabaseServerClient();

  const season =
    access.league.season;

  const isSalary =
    access.league
      .playerSelectionMode ===
    "salary";

  const myTeamId =
    access.fantasyTeam
      ?.id ??
    null;

  /*
   * ============================================================
   * BASE PLAYOFF DATA
   * ============================================================
   */

  const [
    stateResult,
    roundsResult,
    teamsResult,
    entriesResult,
    lineupsResult,
  ] =
    await Promise.all([
      supabase
        .from(
          "nfl_playoff_league_state"
        )
        .select(
          `
            active_round,
            status
          `
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

      supabase
        .from(
          "nfl_playoff_rounds"
        )
        .select(
          `
            round_number,
            round_key,
            round_name,
            nfl_week,
            status,
            first_kickoff_at,
            last_scheduled_kickoff_at,
            finalized_at
          `
        )
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
        ),

      supabase
        .from(
          "fantasy_teams"
        )
        .select(
          `
            id,
            team_name,
            active
          `
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
          "nfl_playoff_round_entries"
        )
        .select(
          `
            fantasy_team_id,
            round_number,
            status,
            salary_used,
            projected_points,
            submitted_at
          `
        )
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
          "nfl_playoff_round_lineups"
        )
        .select(
          `
            fantasy_team_id,
            round_number,
            player_id,
            lineup_slot,
            slot_index,
            salary_at_selection,
            projected_points_at_selection
          `
        )
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
    stateResult.error
  ) {
    throw new Error(
      `Could not load NFL Playoffs state: ${stateResult.error.message}`
    );
  }

  if (
    roundsResult.error
  ) {
    throw new Error(
      `Could not load NFL Playoffs rounds: ${roundsResult.error.message}`
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
    entriesResult.error
  ) {
    throw new Error(
      `Could not load NFL Playoffs entries: ${entriesResult.error.message}`
    );
  }

  if (
    lineupsResult.error
  ) {
    throw new Error(
      `Could not load NFL Playoffs lineups: ${lineupsResult.error.message}`
    );
  }

  const state =
    stateResult.data as
      StateRow |
      null;

  const rounds =
    (
      roundsResult.data ??
      []
    ) as RoundRow[];

  const teams =
    (
      teamsResult.data ??
      []
    ) as TeamRow[];

  const entries =
    (
      entriesResult.data ??
      []
    ) as EntryRow[];

  const lineups =
    (
      lineupsResult.data ??
      []
    ) as LineupRow[];

  const activeRound =
    clampRound(
      n(
        state
          ?.active_round ??
        1
      )
    );

  /*
   * Default recap:
   *
   * 1. Most recently finalized round.
   * 2. Otherwise current active round.
   */

  const latestFinalRound =
    [...rounds]
      .filter(
        isRoundFinal
      )
      .sort(
        (
          a,
          b
        ) =>
          b.round_number -
          a.round_number
      )[0]
      ?.round_number ??
    null;

  const requestedRound =
    query.round
      ? clampRound(
          Number(
            query.round
          )
        )
      : null;

  const selectedRoundNumber =
    requestedRound ??
    latestFinalRound ??
    activeRound;

  const selectedRound =
    rounds.find(
      (
        round
      ) =>
        round.round_number ===
        selectedRoundNumber
    ) ??
    null;

  const selectedRoundName =
    selectedRound
      ?.round_name ??
    fallbackRoundName(
      selectedRoundNumber
    );

  const selectedRoundFinal =
    isRoundFinal(
      selectedRound
    );

  const selectedWeek =
    selectedRound
      ?.nfl_week ??
    null;

  /*
   * ============================================================
   * LOAD NFL PLAYER DATA
   * ============================================================
   */

  const playerIds =
    Array.from(
      new Set(
        lineups.map(
          (
            lineup
          ) =>
            lineup.player_id
        )
      )
    );

  const playerMap =
    new Map<
      number,
      PlayerRow
    >();

  if (
    playerIds.length >
    0
  ) {
    const playersResult =
      await supabase
        .from(
          "nfl_players"
        )
        .select(
          `
            id,
            full_name,
            primary_position,
            team_abbreviation
          `
        )
        .in(
          "id",
          playerIds
        );

    if (
      playersResult.error
    ) {
      throw new Error(
        `Could not load NFL players for recap: ${playersResult.error.message}`
      );
    }

    for (
      const player of
      (
        playersResult.data ??
        []
      ) as PlayerRow[]
    ) {
      playerMap.set(
        player.id,
        player
      );
    }
  }

  /*
   * ============================================================
   * LOAD ALL POSTSEASON FANTASY SCORES
   * ============================================================
   */

  let scores:
    ScoreRow[] =
    [];

  if (
    playerIds.length >
    0
  ) {
    const scoreResult =
      await supabase
        .from(
          "fantasy_player_game_scores"
        )
        .select(
          `
            nfl_player_id,
            week,
            fantasy_points,
            is_live,
            is_final
          `
        )
        .eq(
          "league_id",
          leagueId
        )
        .eq(
          "season",
          season
        )
        .eq(
          "season_type",
          3
        )
        .in(
          "nfl_player_id",
          playerIds
        );

    if (
      scoreResult.error
    ) {
      throw new Error(
        `Could not load NFL Playoffs player scores: ${scoreResult.error.message}`
      );
    }

    scores =
      (
        scoreResult.data ??
        []
      ) as ScoreRow[];
  }

  /*
   * ============================================================
   * SCORE LOOKUP
   * ============================================================
   */

  const scoreMap =
    new Map<
      string,
      {
        points:
          number;

        isLive:
          boolean;

        isFinal:
          boolean;
      }
    >();

  for (
    const score of
    scores
  ) {
    const key =
      scoreKey(
        score.nfl_player_id,
        score.week
      );

    const current =
      scoreMap.get(
        key
      );

    scoreMap.set(
      key,
      {
        points:
          (
            current
              ?.points ??
            0
          ) +
          n(
            score.fantasy_points
          ),

        isLive:
          Boolean(
            current
              ?.isLive
          ) ||
          Boolean(
            score.is_live
          ),

        isFinal:
          Boolean(
            current
              ?.isFinal
          ) ||
          Boolean(
            score.is_final
          ),
      }
    );
  }

  /*
   * ============================================================
   * OTHER LOOKUPS
   * ============================================================
   */

  const teamNameMap =
    new Map<
      number,
      string
    >();

  for (
    const team of
    teams
  ) {
    teamNameMap.set(
      team.id,
      team.team_name
    );
  }

  const entryMap =
    new Map<
      string,
      EntryRow
    >();

  for (
    const entry of
    entries
  ) {
    entryMap.set(
      teamRoundKey(
        entry.fantasy_team_id,
        entry.round_number
      ),
      entry
    );
  }

  const lineupMap =
    new Map<
      string,
      LineupRow[]
    >();

  for (
    const lineup of
    lineups
  ) {
    const key =
      teamRoundKey(
        lineup.fantasy_team_id,
        lineup.round_number
      );

    const current =
      lineupMap.get(
        key
      ) ??
      [];

    current.push(
      lineup
    );

    lineupMap.set(
      key,
      current
    );
  }

  /*
   * ============================================================
   * SELECTED ROUND TEAM RESULTS
   * ============================================================
   */

  const teamResults:
    TeamRoundResult[] =
    teams.map(
      (
        team
      ) => {
        const teamLineup =
          lineupMap.get(
            teamRoundKey(
              team.id,
              selectedRoundNumber
            )
          ) ??
          [];

        const entry =
          entryMap.get(
            teamRoundKey(
              team.id,
              selectedRoundNumber
            )
          );

        const teamPoints =
          selectedWeek ===
          null
            ? 0
            : teamLineup.reduce(
                (
                  total,
                  lineup
                ) =>
                  total +
                  (
                    scoreMap.get(
                      scoreKey(
                        lineup.player_id,
                        selectedWeek
                      )
                    )
                      ?.points ??
                    0
                  ),
                0
              );

        const projectedPoints =
          teamLineup.length >
          0
            ? teamLineup.reduce(
                (
                  total,
                  lineup
                ) =>
                  total +
                  n(
                    lineup
                      .projected_points_at_selection
                  ),
                0
              )
            : n(
                entry
                  ?.projected_points
              );

        const salaryUsed =
          isSalary
            ? teamLineup.length >
              0
              ? teamLineup.reduce(
                  (
                    total,
                    lineup
                  ) =>
                    total +
                    n(
                      lineup
                        .salary_at_selection
                    ),
                  0
                )
              : entry
                    ?.salary_used !=
                  null
                ? n(
                    entry
                      .salary_used
                  )
                : null
            : null;

        return {
          teamId:
            team.id,

          teamName:
            team.team_name,

          points:
            Number(
              teamPoints.toFixed(
                2
              )
            ),

          projectedPoints:
            Number(
              projectedPoints.toFixed(
                2
              )
            ),

          salaryUsed:
            salaryUsed ===
            null
              ? null
              : Number(
                  salaryUsed.toFixed(
                    0
                  )
                ),

          lineupCount:
            teamLineup.length,

          isMyTeam:
            myTeamId ===
            team.id,
        };
      }
    )
      .sort(
        (
          a,
          b
        ) => {
          if (
            b.points !==
            a.points
          ) {
            return (
              b.points -
              a.points
            );
          }

          return a.teamId -
            b.teamId;
        }
      );

  const roundLeader =
    teamResults.find(
      (
        result
      ) =>
        result.lineupCount >
        0
    ) ??
    null;

  const roundLow =
    [...teamResults]
      .filter(
        (
          result
        ) =>
          result.lineupCount >
          0
      )
      .sort(
        (
          a,
          b
        ) =>
          a.points -
          b.points
      )[0] ??
    null;

  /*
   * ============================================================
   * PLAYER PERFORMANCES
   * ============================================================
   */

  const playerPerformances:
    PlayerPerformance[] =
    [];

  if (
    selectedWeek !==
    null
  ) {
    for (
      const team of
      teams
    ) {
      const teamLineup =
        lineupMap.get(
          teamRoundKey(
            team.id,
            selectedRoundNumber
          )
        ) ??
        [];

      for (
        const lineup of
        teamLineup
      ) {
        const player =
          playerMap.get(
            lineup.player_id
          );

        const score =
          scoreMap.get(
            scoreKey(
              lineup.player_id,
              selectedWeek
            )
          );

        const fantasyPoints =
          score
            ?.points ??
          0;

        const salary =
          isSalary
            ? n(
                lineup
                  .salary_at_selection
              )
            : null;

        /*
         * Salary Value:
         *
         * fantasy points per $1,000 of salary.
         */
        const value =
          isSalary &&
          salary !==
            null &&
          salary >
            0
            ? fantasyPoints /
              (
                salary /
                1000
              )
            : null;

        playerPerformances.push({
          playerId:
            lineup.player_id,

          fullName:
            player
              ?.full_name ??
            "Unknown Player",

          position:
            normalizePosition(
              player
                ?.primary_position
            ),

          nflTeam:
            player
              ?.team_abbreviation ??
            null,

          fantasyPoints:
            Number(
              fantasyPoints.toFixed(
                2
              )
            ),

          salary,

          value:
            value ===
            null
              ? null
              : Number(
                  value.toFixed(
                    3
                  )
                ),

          fantasyTeamId:
            team.id,

          fantasyTeamName:
            team.team_name,
        });
      }
    }
  }

  playerPerformances.sort(
    (
      a,
      b
    ) =>
      b.fantasyPoints -
      a.fantasyPoints
  );

  const topPlayer =
    playerPerformances[0] ??
    null;

  const topPlayers =
    playerPerformances.slice(
      0,
      10
    );

  const bestValue =
    isSalary
      ? [...playerPerformances]
          .filter(
            (
              player
            ) =>
              player.salary !==
                null &&
              player.salary >
                0 &&
              player.fantasyPoints >
                0
          )
          .sort(
            (
              a,
              b
            ) =>
              (
                b.value ??
                0
              ) -
              (
                a.value ??
                0
              )
          )[0] ??
        null
      : null;

  /*
   * ============================================================
   * CUMULATIVE STANDINGS THROUGH SELECTED ROUND
   * ============================================================
   *
   * Only FINALIZED rounds count.
   */

  const finalizedRoundsThroughSelection =
    rounds
      .filter(
        (
          round
        ) =>
          round.round_number <=
            selectedRoundNumber &&
          isRoundFinal(
            round
          ) &&
          round.nfl_week !==
            null
      )
      .sort(
        (
          a,
          b
        ) =>
          a.round_number -
          b.round_number
      );

  const cumulativeRows:
    CumulativeStanding[] =
    teams.map(
      (
        team
      ) => {
        let total =
          0;

        let roundsScored =
          0;

        for (
          const round of
          finalizedRoundsThroughSelection
        ) {
          if (
            round.nfl_week ===
            null
          ) {
            continue;
          }

          const lineup =
            lineupMap.get(
              teamRoundKey(
                team.id,
                round.round_number
              )
            ) ??
            [];

          if (
            lineup.length ===
            0
          ) {
            continue;
          }

          const roundPoints =
            lineup.reduce(
              (
                sum,
                player
              ) =>
                sum +
                (
                  scoreMap.get(
                    scoreKey(
                      player.player_id,
                      round.nfl_week!
                    )
                  )
                    ?.points ??
                  0
                ),
              0
            );

          total +=
            roundPoints;

          roundsScored +=
            1;
        }

        return {
          rank:
            0,

          teamId:
            team.id,

          teamName:
            team.team_name,

          totalPoints:
            Number(
              total.toFixed(
                2
              )
            ),

          roundsScored,

          averageRound:
            roundsScored >
            0
              ? Number(
                  (
                    total /
                    roundsScored
                  ).toFixed(
                    2
                  )
                )
              : null,

          isMyTeam:
            myTeamId ===
            team.id,
        };
      }
    );

  cumulativeRows.sort(
    (
      a,
      b
    ) => {
      if (
        b.totalPoints !==
        a.totalPoints
      ) {
        return (
          b.totalPoints -
          a.totalPoints
        );
      }

      return (
        a.teamId -
        b.teamId
      );
    }
  );

  let priorPoints:
    number |
    null =
    null;

  let priorRank =
    0;

  const cumulativeStandings =
    cumulativeRows.map(
      (
        row,
        index
      ) => {
        let rank =
          index +
          1;

        if (
          priorPoints !==
            null &&
          row.totalPoints ===
            priorPoints
        ) {
          rank =
            priorRank;
        }

        priorPoints =
          row.totalPoints;

        priorRank =
          rank;

        return {
          ...row,
          rank,
        };
      }
    );

  /*
   * ============================================================
   * FINALIZED ROUND HONORS
   * ============================================================
   */

  const honors:
    Honor[] =
    [];

  if (
    selectedRoundFinal
  ) {
    if (
      roundLeader
    ) {
      honors.push({
        emoji:
          "🏆",

        category:
          "ACHIEVEMENT",

        title:
          `${selectedRoundName} King`,

        team:
          roundLeader.teamName,

        detail:
          `${points(
            roundLeader.points
          )} fantasy points — highest team score of the round.`,
      });
    }

    if (
      topPlayer
    ) {
      honors.push({
        emoji:
          "⭐",

        category:
          "ACHIEVEMENT",

        title:
          "Round MVP",

        team:
          topPlayer.fantasyTeamName,

        detail:
          `${topPlayer.fullName} (${topPlayer.position}) scored ${points(
            topPlayer.fantasyPoints
          )} fantasy points.`,
      });
    }

    if (
      isSalary &&
      bestValue
    ) {
      honors.push({
        emoji:
          "💰",

        category:
          "ACHIEVEMENT",

        title:
          "Value King",

        team:
          bestValue.fantasyTeamName,

        detail:
          `${bestValue.fullName} produced ${points(
            bestValue.fantasyPoints
          )} points at ${money(
            bestValue.salary
          )} — ${bestValue.value?.toFixed(
            2
          )} pts per $1K.`,
      });
    }

    if (
      roundLow &&
      teamResults.filter(
        (
          team
        ) =>
          team.lineupCount >
          0
      ).length >
        1
    ) {
      honors.push({
        emoji:
          "🧊",

        category:
          "INFAMY",

        title:
          "Ice Cold Round",

        team:
          roundLow.teamName,

        detail:
          `${points(
            roundLow.points
          )} points — lowest completed team score of ${selectedRoundName}.`,

        infamy:
          true,
      });
    }

    const biggestBeat =
      teamResults
        .filter(
          (
            team
          ) =>
            team.lineupCount >
            0
        )
        .map(
          (
            team
          ) => ({
            ...team,

            difference:
              team.points -
              team.projectedPoints,
          })
        )
        .sort(
          (
            a,
            b
          ) =>
            b.difference -
            a.difference
        )[0] ??
      null;

    if (
      biggestBeat &&
      biggestBeat.difference >
        0
    ) {
      honors.push({
        emoji:
          "🚀",

        category:
          "ACHIEVEMENT",

        title:
          "Projection Crusher",

        team:
          biggestBeat.teamName,

        detail:
          `${points(
            biggestBeat.points
          )} actual vs ${points(
            biggestBeat.projectedPoints
          )} projected — beat projection by ${points(
            biggestBeat.difference
          )}.`,
      });
    }
  }

  /*
   * ============================================================
   * POSTSEASON COMPLETION
   * ============================================================
   */

  const superBowlRound =
    rounds.find(
      (
        round
      ) =>
        round.round_number ===
        4
    ) ??
    null;

  const postseasonComplete =
    isRoundFinal(
      superBowlRound
    ) ||
    [
      "complete",
      "completed",
      "final",
      "finalized",
    ].includes(
      (
        state
          ?.status ??
        ""
      )
        .toLowerCase()
    );

  /*
   * Full champion is only valid after Super Bowl finalization.
   */

  const fullFinalizedRounds =
    rounds
      .filter(
        (
          round
        ) =>
          isRoundFinal(
            round
          ) &&
          round.nfl_week !==
            null
      );

  const finalTotals =
    teams.map(
      (
        team
      ) => {
        let total =
          0;

        for (
          const round of
          fullFinalizedRounds
        ) {
          if (
            round.nfl_week ===
            null
          ) {
            continue;
          }

          const lineup =
            lineupMap.get(
              teamRoundKey(
                team.id,
                round.round_number
              )
            ) ??
            [];

          total +=
            lineup.reduce(
              (
                sum,
                player
              ) =>
                sum +
                (
                  scoreMap.get(
                    scoreKey(
                      player.player_id,
                      round.nfl_week!
                    )
                  )
                    ?.points ??
                  0
                ),
              0
            );
        }

        return {
          teamId:
            team.id,

          teamName:
            team.team_name,

          total:
            Number(
              total.toFixed(
                2
              )
            ),
        };
      }
    )
      .sort(
        (
          a,
          b
        ) =>
          b.total -
          a.total
      );

  const postseasonChampion =
    postseasonComplete
      ? finalTotals[0] ??
        null
      : null;

  const runnerUp =
    postseasonComplete
      ? finalTotals[1] ??
        null
      : null;

  const selectedRoundIsActive =
    selectedRoundNumber ===
    activeRound;

  const finalizedCount =
    rounds.filter(
      isRoundFinal
    ).length;

  return (
    <main
      style={
        styles.page
      }
    >
      <style>{`
        @media (max-width: 900px) {
          .g365-nflp-recap-hero {
            flex-direction: column !important;
            align-items: flex-start !important;
          }

          .g365-nflp-recap-spotlights {
            grid-template-columns: 1fr !important;
          }

          .g365-nflp-recap-two {
            grid-template-columns: 1fr !important;
          }

          .g365-nflp-recap-round-links {
            overflow-x: auto !important;
            flex-wrap: nowrap !important;
          }
        }

        @media (max-width: 700px) {
          .g365-nflp-recap-table {
            overflow-x: auto !important;
            -webkit-overflow-scrolling: touch;
          }

          .g365-nflp-recap-row,
          .g365-nflp-recap-table-head {
            min-width: 720px !important;
          }

          .g365-nflp-recap-player-grid {
            grid-template-columns: 1fr !important;
          }

          .g365-nflp-recap-honor-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>

      {selectedRoundIsActive && (
        <NflPlayoffsLeagueTeamsRealtime
          leagueId={
            leagueId
          }
          season={
            season
          }
          roundNumber={
            selectedRoundNumber
          }
          enabled={
            !selectedRoundFinal
          }
        />
      )}

      <div
        style={
          styles.shell
        }
      >
        {/* =====================================================
            HERO
            ===================================================== */}

        <header
          className="g365-nflp-recap-hero"
          style={
            styles.hero
          }
        >
          <div>
            <p
              style={
                styles.eyebrow
              }
            >
              G365 NFL PLAYOFFS RECAP
            </p>

            <h1
              style={
                styles.title
              }
            >
              {
                access.league
                  .name
              }
            </h1>

            <p
              style={
                styles.subtitle
              }
            >
              {selectedRoundName}
              {" · "}
              {
                season
              }
              {" · "}
              {isSalary
                ? "Salary Cap"
                : "No Salary Cap"}
            </p>
          </div>

          <div
            style={
              styles.actions
            }
          >
            <Link
              href={`/league/${leagueId}/nfl-playoffs/standings`}
              style={
                styles.secondaryButton
              }
            >
              STANDINGS
            </Link>

            <Link
              href={`/league/${leagueId}/nfl-playoffs/teams?round=${selectedRoundNumber}`}
              style={
                styles.primaryButton
              }
            >
              LEAGUE TEAMS
            </Link>
          </div>
        </header>

        {/* =====================================================
            ROUND SELECTOR
            ===================================================== */}

        <section
          style={
            styles.roundBar
          }
        >
          <div>
            <span
              style={
                styles.roundLabel
              }
            >
              POSTSEASON ROUND
            </span>

            <div
              style={
                styles.roundSubtext
              }
            >
              {finalizedCount}
              {" of "}
              4 rounds finalized
            </div>
          </div>

          <div
            className="g365-nflp-recap-round-links"
            style={
              styles.roundLinks
            }
          >
            {[
              1,
              2,
              3,
              4,
            ].map(
              (
                roundNumber
              ) => {
                const definition =
                  rounds.find(
                    (
                      round
                    ) =>
                      round.round_number ===
                      roundNumber
                  );

                const active =
                  roundNumber ===
                  selectedRoundNumber;

                const final =
                  isRoundFinal(
                    definition
                  );

                return (
                  <Link
                    key={
                      roundNumber
                    }
                    href={`/league/${leagueId}/nfl-playoffs/recap?round=${roundNumber}`}
                    style={{
                      ...styles.roundButton,

                      ...(active
                        ? styles.roundButtonActive
                        : {}),
                    }}
                  >
                    <span>
                      {shortRoundName(
                        roundNumber
                      )}
                    </span>

                    <small
                      style={{
                        ...styles.roundButtonStatus,

                        ...(final
                          ? styles.roundButtonFinal
                          : {}),
                      }}
                    >
                      {final
                        ? "FINAL"
                        : roundNumber ===
                            activeRound
                          ? "ACTIVE"
                          : "UPCOMING"}
                    </small>
                  </Link>
                );
              }
            )}
          </div>
        </section>

        {/* =====================================================
            SPOTLIGHTS
            ===================================================== */}

        <section
          className="g365-nflp-recap-spotlights"
          style={
            styles.spotlightGrid
          }
        >
          <Spotlight
            emoji="🏆"
            eyebrow={
              selectedRoundFinal
                ? "ROUND CHAMPION"
                : "CURRENT LEADER"
            }
            value={
              roundLeader
                ?.teamName ??
              "No scores yet"
            }
            detail={
              roundLeader
                ? `${points(
                    roundLeader.points
                  )} fantasy points`
                : "No active lineup scores"
            }
          />

          <Spotlight
            emoji="⭐"
            eyebrow={
              selectedRoundFinal
                ? "ROUND MVP"
                : "TOP PLAYER"
            }
            value={
              topPlayer
                ?.fullName ??
              "No player scores yet"
            }
            detail={
              topPlayer
                ? `${topPlayer.position} · ${topPlayer.nflTeam ?? "NFL"} · ${points(
                    topPlayer.fantasyPoints
                  )} pts`
                : "—"
            }
          />

          <Spotlight
            emoji={
              selectedRoundFinal
                ? "🔒"
                : "🔥"
            }
            eyebrow="RECAP STATUS"
            value={
              selectedRoundFinal
                ? "FINAL"
                : "IN PROGRESS"
            }
            detail={
              selectedRoundFinal
                ? "Round results and honors are locked"
                : "Round honors become official after finalization"
            }
          />

          {isSalary ? (
            <Spotlight
              emoji="💰"
              eyebrow={
                selectedRoundFinal
                  ? "VALUE KING"
                  : "BEST VALUE"
              }
              value={
                bestValue
                  ?.fullName ??
                "No value result yet"
              }
              detail={
                bestValue
                  ? `${points(
                      bestValue.fantasyPoints
                    )} pts · ${money(
                      bestValue.salary
                    )}`
                  : "Salary value updates with scoring"
              }
            />
          ) : (
            <Spotlight
              emoji="📊"
              eyebrow="ROUNDS FINAL"
              value={`${finalizedCount} / 4`}
              detail="Cumulative standings use finalized rounds only"
            />
          )}
        </section>

        {/* =====================================================
            FINAL POSTSEASON CHAMPION
            ===================================================== */}

        {postseasonComplete &&
        postseasonChampion ? (
          <section
            style={
              styles.championCard
            }
          >
            <div
              style={
                styles.championIcon
              }
            >
              🏆
            </div>

            <div>
              <p
                style={
                  styles.championEyebrow
                }
              >
                {
                  season
                } G365 NFL PLAYOFFS CHAMPION
              </p>

              <h2
                style={
                  styles.championName
                }
              >
                {
                  postseasonChampion.teamName
                }
              </h2>

              <p
                style={
                  styles.championText
                }
              >
                {points(
                  postseasonChampion.total
                )}{" "}
                cumulative fantasy
                points across the NFL
                postseason.
              </p>

              {runnerUp && (
                <p
                  style={
                    styles.runnerText
                  }
                >
                  Runner-up:{" "}
                  <strong>
                    {
                      runnerUp.teamName
                    }
                  </strong>
                  {" · "}
                  {points(
                    runnerUp.total
                  )}{" "}
                  points
                </p>
              )}
            </div>
          </section>
        ) : null}

        {/* =====================================================
            ROUND HONORS
            ===================================================== */}

        {selectedRoundFinal && (
          <section
            style={
              styles.card
            }
          >
            <SectionHead
              eyebrow={`${selectedRoundName.toUpperCase()} HONORS`}
              title="Round Awards"
              badge={`${honors.length} AWARDS`}
            />

            {honors.length >
            0 ? (
              <div
                className="g365-nflp-recap-honor-grid"
                style={
                  styles.honorGrid
                }
              >
                {honors.map(
                  (
                    honor,
                    index
                  ) => (
                    <article
                      key={`${honor.title}-${index}`}
                      style={{
                        ...styles.honorCard,

                        ...(honor.infamy
                          ? styles.infamyCard
                          : {}),
                      }}
                    >
                      <div
                        style={
                          styles.honorEmoji
                        }
                      >
                        {
                          honor.emoji
                        }
                      </div>

                      <div>
                        <span
                          style={{
                            ...styles.honorCategory,

                            ...(honor.infamy
                              ? styles.infamyText
                              : {}),
                          }}
                        >
                          {
                            honor.category
                          }
                        </span>

                        <h3
                          style={
                            styles.honorTitle
                          }
                        >
                          {
                            honor.title
                          }
                        </h3>

                        <strong
                          style={
                            styles.honorTeam
                          }
                        >
                          {
                            honor.team
                          }
                        </strong>

                        <p
                          style={
                            styles.honorDetail
                          }
                        >
                          {
                            honor.detail
                          }
                        </p>
                      </div>
                    </article>
                  )
                )}
              </div>
            ) : (
              <EmptyState text="No round honors are available yet." />
            )}
          </section>
        )}

        {/* =====================================================
            ROUND LEADERBOARD + ROUND SUMMARY
            ===================================================== */}

        <section
          className="g365-nflp-recap-two"
          style={
            styles.twoColumn
          }
        >
          <section
            style={
              styles.card
            }
          >
            <SectionHead
              eyebrow={selectedRoundName.toUpperCase()}
              title="Round Leaderboard"
              badge={`${teamResults.length} TEAMS`}
            />

            <div
              className="g365-nflp-recap-table"
              style={
                styles.tableViewport
              }
            >
              <div
                className="g365-nflp-recap-table-head"
                style={
                  styles.tableHeader
                }
              >
                <div>
                  RK
                </div>

                <div>
                  TEAM
                </div>

                <div
                  style={
                    styles.right
                  }
                >
                  PTS
                </div>

                <div
                  style={
                    styles.right
                  }
                >
                  PROJ
                </div>

                {isSalary && (
                  <div
                    style={
                      styles.right
                    }
                  >
                    SALARY
                  </div>
                )}
              </div>

              {teamResults.map(
                (
                  team,
                  index
                ) => (
                  <div
                    key={
                      team.teamId
                    }
                    className="g365-nflp-recap-row"
                    style={{
                      ...styles.tableRow,

                      gridTemplateColumns:
                        isSalary
                          ? "50px minmax(190px,1fr) 100px 100px 110px"
                          : "50px minmax(190px,1fr) 100px 100px",

                      ...(team.isMyTeam
                        ? styles.myTeamRow
                        : {}),
                    }}
                  >
                    <span
                      style={{
                        ...styles.rank,

                        ...(index ===
                        0
                          ? styles.rankFirst
                          : {}),
                      }}
                    >
                      {
                        index +
                        1
                      }
                    </span>

                    <div>
                      <div
                        style={
                          styles.teamNameLine
                        }
                      >
                        <strong>
                          {
                            team.teamName
                          }
                        </strong>

                        {team.isMyTeam && (
                          <span
                            style={
                              styles.youBadge
                            }
                          >
                            YOU
                          </span>
                        )}
                      </div>

                      <small
                        style={
                          styles.muted
                        }
                      >
                        {
                          team.lineupCount
                        }{" "}
                        lineup players
                      </small>
                    </div>

                    <strong
                      style={{
                        ...styles.numeric,

                        ...(index ===
                        0
                          ? styles.orange
                          : {}),
                      }}
                    >
                      {points(
                        team.points
                      )}
                    </strong>

                    <span
                      style={
                        styles.numeric
                      }
                    >
                      {points(
                        team.projectedPoints
                      )}
                    </span>

                    {isSalary && (
                      <span
                        style={
                          styles.numeric
                        }
                      >
                        {money(
                          team.salaryUsed
                        )}
                      </span>
                    )}
                  </div>
                )
              )}
            </div>
          </section>

          <aside
            style={
              styles.summaryCard
            }
          >
            <p
              style={
                styles.sectionEyebrow
              }
            >
              ROUND SNAPSHOT
            </p>

            <h2
              style={
                styles.summaryTitle
              }
            >
              {selectedRoundName}
            </h2>

            <SummaryRow
              label="Status"
              value={
                selectedRoundFinal
                  ? "FINAL"
                  : "IN PROGRESS"
              }
            />

            <SummaryRow
              label="Highest Score"
              value={
                roundLeader
                  ? `${roundLeader.teamName} · ${points(
                      roundLeader.points
                    )}`
                  : "—"
              }
            />

            <SummaryRow
              label="Lowest Score"
              value={
                roundLow
                  ? `${roundLow.teamName} · ${points(
                      roundLow.points
                    )}`
                  : "—"
              }
            />

            <SummaryRow
              label="Top Player"
              value={
                topPlayer
                  ? `${topPlayer.fullName} · ${points(
                      topPlayer.fantasyPoints
                    )}`
                  : "—"
              }
            />

            {isSalary && (
              <SummaryRow
                label="Best Value"
                value={
                  bestValue
                    ? `${bestValue.fullName} · ${bestValue.value?.toFixed(
                        2
                      )} pts/$1K`
                    : "—"
                }
              />
            )}

            <SummaryRow
              label="NFL Week"
              value={
                selectedWeek ===
                null
                  ? "—"
                  : String(
                      selectedWeek
                    )
              }
            />
          </aside>
        </section>

        {/* =====================================================
            TOP PLAYER PERFORMANCES
            ===================================================== */}

        <section
          style={
            styles.card
          }
        >
          <SectionHead
            eyebrow={`${selectedRoundName.toUpperCase()} PLAYER RESULTS`}
            title="Top Performances"
            badge={`${topPlayers.length} PLAYERS`}
          />

          {topPlayers.length >
          0 ? (
            <div
              className="g365-nflp-recap-player-grid"
              style={
                styles.playerGrid
              }
            >
              {topPlayers.map(
                (
                  player,
                  index
                ) => (
                  <article
                    key={`${player.fantasyTeamId}-${player.playerId}-${index}`}
                    style={
                      styles.playerCard
                    }
                  >
                    <div
                      style={
                        styles.playerRank
                      }
                    >
                      #
                      {
                        index +
                        1
                      }
                    </div>

                    <div
                      style={
                        styles.playerBody
                      }
                    >
                      <strong
                        style={
                          styles.playerName
                        }
                      >
                        {
                          player.fullName
                        }
                      </strong>

                      <span
                        style={
                          styles.playerMeta
                        }
                      >
                        {
                          player.position
                        }
                        {" · "}
                        {
                          player.nflTeam ??
                          "NFL"
                        }
                      </span>

                      <span
                        style={
                          styles.playerFantasyTeam
                        }
                      >
                        {
                          player.fantasyTeamName
                        }
                      </span>
                    </div>

                    <div
                      style={
                        styles.playerScore
                      }
                    >
                      <strong>
                        {points(
                          player.fantasyPoints
                        )}
                      </strong>

                      <span>
                        PTS
                      </span>
                    </div>

                    {isSalary && (
                      <div
                        style={
                          styles.playerSalary
                        }
                      >
                        <strong>
                          {money(
                            player.salary
                          )}
                        </strong>

                        <span>
                          SALARY
                        </span>
                      </div>
                    )}
                  </article>
                )
              )}
            </div>
          ) : (
            <EmptyState text="No player scoring is available for this round yet." />
          )}
        </section>

        {/* =====================================================
            CUMULATIVE STANDINGS AFTER ROUND
            ===================================================== */}

        <section
          style={
            styles.card
          }
        >
          <SectionHead
            eyebrow="POSTSEASON RACE"
            title={
              selectedRoundFinal
                ? `Standings After ${selectedRoundName}`
                : "Official Cumulative Standings"
            }
            badge={`${finalizedRoundsThroughSelection.length}/4 ROUNDS`}
          />

          {finalizedRoundsThroughSelection.length ===
          0 ? (
            <EmptyState text="Cumulative standings begin after the first NFL Playoffs round is finalized." />
          ) : (
            <div
              className="g365-nflp-recap-table"
              style={
                styles.tableViewport
              }
            >
              <div
                className="g365-nflp-recap-table-head"
                style={{
                  ...styles.cumulativeHeader,
                }}
              >
                <div>
                  RK
                </div>

                <div>
                  TEAM
                </div>

                <div
                  style={
                    styles.right
                  }
                >
                  TOTAL
                </div>

                <div
                  style={
                    styles.right
                  }
                >
                  ROUNDS
                </div>

                <div
                  style={
                    styles.right
                  }
                >
                  AVG
                </div>
              </div>

              {cumulativeStandings.map(
                (
                  row
                ) => (
                  <div
                    key={
                      row.teamId
                    }
                    className="g365-nflp-recap-row"
                    style={{
                      ...styles.cumulativeRow,

                      ...(row.isMyTeam
                        ? styles.myTeamRow
                        : {}),
                    }}
                  >
                    <span
                      style={{
                        ...styles.rank,

                        ...(row.rank ===
                        1
                          ? styles.rankFirst
                          : {}),
                      }}
                    >
                      {
                        row.rank
                      }
                    </span>

                    <div
                      style={
                        styles.teamNameLine
                      }
                    >
                      <strong>
                        {
                          row.teamName
                        }
                      </strong>

                      {row.isMyTeam && (
                        <span
                          style={
                            styles.youBadge
                          }
                        >
                          YOU
                        </span>
                      )}
                    </div>

                    <strong
                      style={{
                        ...styles.numeric,

                        ...(row.rank ===
                        1
                          ? styles.orange
                          : {}),
                      }}
                    >
                      {points(
                        row.totalPoints
                      )}
                    </strong>

                    <span
                      style={
                        styles.numeric
                      }
                    >
                      {
                        row.roundsScored
                      }
                    </span>

                    <span
                      style={
                        styles.numeric
                      }
                    >
                      {points(
                        row.averageRound
                      )}
                    </span>
                  </div>
                )
              )}
            </div>
          )}
        </section>

        {/* =====================================================
            FOOTNOTE
            ===================================================== */}

        <div
          style={
            styles.note
          }
        >
          Round results become
          official only after the
          NFL Playoffs round is
          finalized. Cumulative
          standings include
          finalized rounds only;
          live or future rounds
          never create artificial
          zero-point results.
        </div>
      </div>
    </main>
  );
}


function Spotlight({
  emoji,
  eyebrow,
  value,
  detail,
}: {
  emoji:
    string;

  eyebrow:
    string;

  value:
    string;

  detail:
    string;
}) {
  return (
    <article
      style={
        styles.spotlight
      }
    >
      <div
        style={
          styles.spotlightEmoji
        }
      >
        {emoji}
      </div>

      <div>
        <span
          style={
            styles.spotlightEyebrow
          }
        >
          {eyebrow}
        </span>

        <h2
          style={
            styles.spotlightValue
          }
        >
          {value}
        </h2>

        <p
          style={
            styles.spotlightDetail
          }
        >
          {detail}
        </p>
      </div>
    </article>
  );
}


function SectionHead({
  eyebrow,
  title,
  badge,
}: {
  eyebrow:
    string;

  title:
    string;

  badge:
    string;
}) {
  return (
    <div
      style={
        styles.sectionHead
      }
    >
      <div>
        <p
          style={
            styles.sectionEyebrow
          }
        >
          {eyebrow}
        </p>

        <h2
          style={
            styles.sectionTitle
          }
        >
          {title}
        </h2>
      </div>

      <span
        style={
          styles.countBadge
        }
      >
        {badge}
      </span>
    </div>
  );
}


function SummaryRow({
  label,
  value,
}: {
  label:
    string;

  value:
    string;
}) {
  return (
    <div
      style={
        styles.summaryRow
      }
    >
      <span>
        {label}
      </span>

      <strong>
        {value}
      </strong>
    </div>
  );
}


function EmptyState({
  text,
}: {
  text:
    string;
}) {
  return (
    <div
      style={
        styles.empty
      }
    >
      {text}
    </div>
  );
}


const styles:
  Record<
    string,
    CSSProperties
  > = {
  page: {
    minHeight:
      "100vh",

    padding:
      "22px",

    color:
      "#f5f5f5",

    background:
      "linear-gradient(180deg,#080808,#101010)",
  },

  shell: {
    width:
      "100%",

    maxWidth:
      1320,

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
      20,

    padding:
      24,

    marginBottom:
      16,

    border:
      "1px solid #292929",

    borderRadius:
      20,

    background:
      "linear-gradient(135deg,rgba(145,20,10,.2),rgba(241,91,15,.08),#121212)",
  },

  eyebrow: {
    margin:
      0,

    color:
      "#ff6b1a",

    fontSize:
      11,

    fontWeight:
      900,

    letterSpacing:
      ".13em",
  },

  title: {
    margin:
      "6px 0",

    fontSize:
      34,

    lineHeight:
      1.05,
  },

  subtitle: {
    margin:
      0,

    color:
      "#8d8d8d",

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
    padding:
      "10px 13px",

    borderRadius:
      10,

    textDecoration:
      "none",

    color:
      "#fff",

    fontSize:
      10,

    fontWeight:
      900,

    background:
      "linear-gradient(135deg,#9a2012,#ed6818)",
  },

  secondaryButton: {
    padding:
      "10px 13px",

    border:
      "1px solid #383838",

    borderRadius:
      10,

    textDecoration:
      "none",

    color:
      "#bbb",

    fontSize:
      10,

    fontWeight:
      900,

    background:
      "#161616",
  },

  roundBar: {
    display:
      "flex",

    alignItems:
      "center",

    justifyContent:
      "space-between",

    gap:
      16,

    padding:
      15,

    marginBottom:
      16,

    border:
      "1px solid #292929",

    borderRadius:
      16,

    background:
      "#111",
  },

  roundLabel: {
    color:
      "#e65b19",

    fontSize:
      9,

    fontWeight:
      900,

    letterSpacing:
      ".1em",
  },

  roundSubtext: {
    marginTop:
      4,

    color:
      "#666",

    fontSize:
      9,
  },

  roundLinks: {
    display:
      "flex",

    gap:
      7,
  },

  roundButton: {
    minWidth:
      122,

    padding:
      "9px 11px",

    display:
      "grid",

    gap:
      3,

    border:
      "1px solid #303030",

    borderRadius:
      9,

    textDecoration:
      "none",

    color:
      "#8a8a8a",

    background:
      "#0d0d0d",

    textAlign:
      "center",

    fontSize:
      9,

    fontWeight:
      900,
  },

  roundButtonActive: {
    color:
      "#fff",

    border:
      "1px solid #df5818",

    background:
      "linear-gradient(135deg,#78170e,#dc5817)",
  },

  roundButtonStatus: {
    color:
      "#5d5d5d",

    fontSize:
      7,
  },

  roundButtonFinal: {
    color:
      "#6cdb90",
  },

  spotlightGrid: {
    display:
      "grid",

    gridTemplateColumns:
      "repeat(4,minmax(0,1fr))",

    gap:
      10,

    marginBottom:
      16,
  },

  spotlight: {
    minWidth:
      0,

    padding:
      15,

    display:
      "flex",

    gap:
      12,

    border:
      "1px solid #292929",

    borderRadius:
      14,

    background:
      "#121212",
  },

  spotlightEmoji: {
    width:
      39,

    height:
      39,

    flex:
      "0 0 39px",

    display:
      "grid",

    placeItems:
      "center",

    borderRadius:
      10,

    background:
      "#20120d",

    fontSize:
      20,
  },

  spotlightEyebrow: {
    color:
      "#e65b19",

    fontSize:
      8,

    fontWeight:
      900,

    letterSpacing:
      ".08em",
  },

  spotlightValue: {
    margin:
      "4px 0",

    overflow:
      "hidden",

    textOverflow:
      "ellipsis",

    fontSize:
      14,

    whiteSpace:
      "nowrap",
  },

  spotlightDetail: {
    margin:
      0,

    color:
      "#777",

    fontSize:
      9,

    lineHeight:
      1.4,
  },

  championCard: {
    display:
      "flex",

    alignItems:
      "center",

    gap:
      18,

    padding:
      22,

    marginBottom:
      16,

    border:
      "1px solid #b84617",

    borderRadius:
      18,

    background:
      "linear-gradient(135deg,#28120b,#18110d,#111)",
  },

  championIcon: {
    width:
      64,

    height:
      64,

    flex:
      "0 0 64px",

    display:
      "grid",

    placeItems:
      "center",

    borderRadius:
      "50%",

    background:
      "#33180d",

    fontSize:
      31,
  },

  championEyebrow: {
    margin:
      0,

    color:
      "#ff7827",

    fontSize:
      9,

    fontWeight:
      900,

    letterSpacing:
      ".12em",
  },

  championName: {
    margin:
      "5px 0",

    fontSize:
      27,
  },

  championText: {
    margin:
      0,

    color:
      "#aaa",

    fontSize:
      12,
  },

  runnerText: {
    margin:
      "7px 0 0",

    color:
      "#777",

    fontSize:
      10,
  },

  card: {
    marginBottom:
      16,

    overflow:
      "hidden",

    border:
      "1px solid #292929",

    borderRadius:
      16,

    background:
      "#111",
  },

  sectionHead: {
    display:
      "flex",

    alignItems:
      "center",

    justifyContent:
      "space-between",

    gap:
      12,

    padding:
      "16px 18px",

    borderBottom:
      "1px solid #242424",
  },

  sectionEyebrow: {
    margin:
      0,

    color:
      "#e45a19",

    fontSize:
      8,

    fontWeight:
      900,

    letterSpacing:
      ".1em",
  },

  sectionTitle: {
    margin:
      "4px 0 0",

    fontSize:
      19,
  },

  countBadge: {
    padding:
      "6px 8px",

    border:
      "1px solid #49301d",

    borderRadius:
      999,

    color:
      "#df7b39",

    background:
      "#1d140e",

    fontSize:
      8,

    fontWeight:
      900,
  },

  honorGrid: {
    padding:
      14,

    display:
      "grid",

    gridTemplateColumns:
      "repeat(2,minmax(0,1fr))",

    gap:
      10,
  },

  honorCard: {
    padding:
      14,

    display:
      "flex",

    gap:
      12,

    border:
      "1px solid #333",

    borderRadius:
      12,

    background:
      "#151515",
  },

  infamyCard: {
    border:
      "1px solid #563236",

    background:
      "#1b1112",
  },

  honorEmoji: {
    fontSize:
      26,
  },

  honorCategory: {
    color:
      "#6ed28c",

    fontSize:
      7,

    fontWeight:
      900,

    letterSpacing:
      ".1em",
  },

  infamyText: {
    color:
      "#e47478",
  },

  honorTitle: {
    margin:
      "4px 0",

    fontSize:
      14,
  },

  honorTeam: {
    color:
      "#d3d3d3",

    fontSize:
      10,
  },

  honorDetail: {
    margin:
      "5px 0 0",

    color:
      "#777",

    fontSize:
      9,

    lineHeight:
      1.45,
  },

  twoColumn: {
    display:
      "grid",

    gridTemplateColumns:
      "minmax(0,1fr) 300px",

    gap:
      16,

    alignItems:
      "start",

    marginBottom:
      16,
  },

  summaryCard: {
    padding:
      17,

    border:
      "1px solid #292929",

    borderRadius:
      16,

    background:
      "#111",
  },

  summaryTitle: {
    margin:
      "5px 0 14px",

    fontSize:
      19,
  },

  summaryRow: {
    minHeight:
      44,

    display:
      "flex",

    alignItems:
      "center",

    justifyContent:
      "space-between",

    gap:
      10,

    borderTop:
      "1px solid #242424",

    color:
      "#777",

    fontSize:
      9,
  },

  tableViewport: {
    overflow:
      "hidden",
  },

  tableHeader: {
    minWidth:
      0,

    minHeight:
      38,

    padding:
      "0 14px",

    display:
      "grid",

    gridTemplateColumns:
      "50px minmax(190px,1fr) 100px 100px 110px",

    gap:
      8,

    alignItems:
      "center",

    color:
      "#656565",

    background:
      "#0d0d0d",

    fontSize:
      8,

    fontWeight:
      900,
  },

  tableRow: {
    minHeight:
      60,

    padding:
      "9px 14px",

    display:
      "grid",

    gap:
      8,

    alignItems:
      "center",

    borderTop:
      "1px solid #232323",
  },

  myTeamRow: {
    background:
      "rgba(230,80,20,.05)",

    boxShadow:
      "inset 3px 0 0 #eb5b18",
  },

  rank: {
    width:
      30,

    height:
      30,

    display:
      "grid",

    placeItems:
      "center",

    border:
      "1px solid #343434",

    borderRadius:
      8,

    background:
      "#171717",

    fontSize:
      11,

    fontWeight:
      900,
  },

  rankFirst: {
    color:
      "#ff7b2c",

    border:
      "1px solid #87401f",

    background:
      "#25140d",
  },

  teamNameLine: {
    display:
      "flex",

    alignItems:
      "center",

    gap:
      7,

    minWidth:
      0,
  },

  youBadge: {
    padding:
      "2px 5px",

    borderRadius:
      999,

    color:
      "#fff",

    background:
      "#e65a18",

    fontSize:
      7,

    fontWeight:
      900,
  },

  muted: {
    color:
      "#626262",

    fontSize:
      8,
  },

  right: {
    textAlign:
      "right",
  },

  numeric: {
    textAlign:
      "right",

    color:
      "#bbb",

    fontSize:
      11,

    fontVariantNumeric:
      "tabular-nums",
  },

  orange: {
    color:
      "#ff7729",
  },

  playerGrid: {
    padding:
      14,

    display:
      "grid",

    gridTemplateColumns:
      "repeat(2,minmax(0,1fr))",

    gap:
      8,
  },

  playerCard: {
    minWidth:
      0,

    display:
      "grid",

    gridTemplateColumns:
      "40px minmax(0,1fr) 70px 80px",

    gap:
      10,

    alignItems:
      "center",

    padding:
      12,

    border:
      "1px solid #292929",

    borderRadius:
      11,

    background:
      "#151515",
  },

  playerRank: {
    color:
      "#e55c1c",

    fontSize:
      11,

    fontWeight:
      900,
  },

  playerBody: {
    minWidth:
      0,
  },

  playerName: {
    display:
      "block",

    overflow:
      "hidden",

    textOverflow:
      "ellipsis",

    whiteSpace:
      "nowrap",

    fontSize:
      11,
  },

  playerMeta: {
    display:
      "block",

    marginTop:
      2,

    color:
      "#777",

    fontSize:
      8,
  },

  playerFantasyTeam: {
    display:
      "block",

    marginTop:
      3,

    color:
      "#9b582d",

    fontSize:
      8,
  },

  playerScore: {
    textAlign:
      "right",
  },

  playerSalary: {
    textAlign:
      "right",
  },

  cumulativeHeader: {
    minHeight:
      38,

    padding:
      "0 14px",

    display:
      "grid",

    gridTemplateColumns:
      "50px minmax(190px,1fr) 100px 90px 100px",

    gap:
      8,

    alignItems:
      "center",

    color:
      "#656565",

    background:
      "#0d0d0d",

    fontSize:
      8,

    fontWeight:
      900,
  },

  cumulativeRow: {
    minHeight:
      58,

    padding:
      "9px 14px",

    display:
      "grid",

    gridTemplateColumns:
      "50px minmax(190px,1fr) 100px 90px 100px",

    gap:
      8,

    alignItems:
      "center",

    borderTop:
      "1px solid #232323",
  },

  empty: {
    margin:
      14,

    padding:
      24,

    border:
      "1px dashed #303030",

    borderRadius:
      11,

    color:
      "#6d6d6d",

    textAlign:
      "center",

    fontSize:
      10,
  },

  note: {
    padding:
      13,

    border:
      "1px solid #292929",

    borderRadius:
      12,

    color:
      "#686868",

    background:
      "#101010",

    fontSize:
      9,

    lineHeight:
      1.5,
  },
};