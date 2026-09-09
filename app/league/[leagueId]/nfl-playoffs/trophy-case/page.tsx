import type {
  CSSProperties,
} from "react";

import Link from "next/link";

import {
  redirect,
} from "next/navigation";

import {
  createSupabaseServerClient,
} from "@/lib/supabase/server";

import {
  createSupabaseAdminClient,
} from "@/lib/supabase/admin";

import {
  requireLeagueMember,
} from "@/lib/leagues/requireLeagueMember";


export const dynamic =
  "force-dynamic";


type PageProps = {
  params:
    Promise<{
      leagueId: string;
    }>;
};


type TrophyRow = {
  fantasy_team_id:
    number;

  team_name:
    string;

  round_number:
    number | null;

  award_key:
    string;

  award_name:
    string;

  award_category:
    string;

  award_emoji:
    string;

  award_value:
    number |
    string |
    null;

  detail:
    string |
    null;

  created_at:
    string;
};


type RoundRow = {
  round_number:
    number;

  round_name:
    string | null;

  status:
    string | null;

  finalized_at:
    string | null;
};


type StateRow = {
  active_round:
    number | null;

  status:
    string | null;
};


type HistoryLeagueRow = {
  id:
    string;

  season:
    number;

  player_selection_mode:
    string | null;
};


type HistoryFantasyTeamRow = {
  id:
    number;

  league_id:
    string;

  team_name:
    string;

  owner_id:
    string | null;

  nfl_playoff_franchise_id:
    string | null;
};


type HistoryTrophyRawRow = {
  league_id:
    string;

  season:
    number;

  fantasy_team_id:
    number;

  round_number:
    number | null;

  award_key:
    string;

  award_name:
    string;

  award_category:
    string;

  award_emoji:
    string;

  award_value:
    number |
    string |
    null;

  detail:
    string |
    null;

  created_at:
    string;
};


type HistoryTrophyRow =
  HistoryTrophyRawRow & {
    team_name:
      string;

    franchise_id:
      string | null;

    selection_mode:
      string | null;
  };


type CareerAward = {
  awardKey:
    string;

  awardName:
    string;

  awardCategory:
    string;

  awardEmoji:
    string;

  count:
    number;

  seasons:
    number[];

  latestDetail:
    string | null;
};


type FranchiseCareer = {
  franchiseId:
    string;

  teamName:
    string;

  seasons:
    number[];

  totalAwards:
    number;

  achievementCount:
    number;

  infamyCount:
    number;

  championships:
    number;

  runnerUps:
    number;

  isMyFranchise:
    boolean;

  awards:
    CareerAward[];
};


type TeamTrophyCase = {
  teamId:
    number;

  teamName:
    string;

  trophies:
    TrophyRow[];

  achievementCount:
    number;

  infamyCount:
    number;

  totalAwards:
    number;

  isMyTeam:
    boolean;

  isChampion:
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


function roundName(
  roundNumber:
    number |
    null
) {
  if (
    roundNumber ===
    null
  ) {
    return "POSTSEASON";
  }

  switch (
    roundNumber
  ) {
    case 1:
      return "WILD CARD";

    case 2:
      return "DIVISIONAL";

    case 3:
      return "CONFERENCE CHAMPIONSHIPS";

    case 4:
      return "SUPER BOWL";

    default:
      return `ROUND ${roundNumber}`;
  }
}


function isFinalRound(
  round:
    RoundRow
) {
  if (
    round.finalized_at
  ) {
    return true;
  }

  return [
    "final",
    "finalized",
    "complete",
    "completed",
  ].includes(
    (
      round.status ??
      ""
    )
      .trim()
      .toLowerCase()
  );
}


function awardPriority(
  key:
    string
) {
  switch (
    key
  ) {
    case "nfl_playoffs_champion":
      return 1;

    case "nfl_playoffs_runner_up":
      return 2;

    case "round_king":
      return 3;

    case "round_mvp":
      return 4;

    case "value_king":
      return 5;

    case "projection_crusher":
      return 6;

    case "ice_cold_round":
      return 7;

    default:
      return 20;
  }
}


export default async function NflPlayoffsTrophyCasePage({
  params,
}: PageProps) {
  const {
    leagueId,
  } =
    await params;

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

  /*
   * The current user has already passed requireLeagueMember().
   *
   * The admin client is used only on the server to follow the
   * league's nfl_playoff_history_id across renewed seasons.
   * This avoids old-season RLS membership differences from
   * breaking the continuous Trophy Case while still limiting
   * the query to this league's exact renewal lineage.
   */
  const admin =
    createSupabaseAdminClient();

  const season =
    access.league
      .season;

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
   * TROPHY + ROUND STATE
   * ============================================================
   */

  const [
    trophyResult,
    roundsResult,
    stateResult,
  ] =
    await Promise.all([
      supabase.rpc(
        "get_nfl_playoff_trophy_case",
        {
          p_league_id:
            leagueId,

          p_season:
            season,
        }
      ),

      supabase
        .from(
          "nfl_playoff_rounds"
        )
        .select(
          `
            round_number,
            round_name,
            status,
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
    ]);

  if (
    trophyResult.error
  ) {
    throw new Error(
      `Could not load NFL Playoffs Trophy Case: ${trophyResult.error.message}`
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
    stateResult.error
  ) {
    throw new Error(
      `Could not load NFL Playoffs state: ${stateResult.error.message}`
    );
  }

  const trophies =
    (
      trophyResult.data ??
      []
    ) as TrophyRow[];

  const rounds =
    (
      roundsResult.data ??
      []
    ) as RoundRow[];

  const state =
    stateResult.data as
      StateRow |
      null;

  /*
   * ============================================================
   * CONTINUOUS NFL PLAYOFFS HISTORY
   * ============================================================
   *
   * Current-season display above still comes from the existing
   * get_nfl_playoff_trophy_case RPC.
   *
   * Career history is assembled only from STORED trophy rows.
   * Nothing on this page generates, recalculates, or duplicates
   * an award.
   *
   * Renewal continuity is based on:
   *
   * leagues.nfl_playoff_history_id
   * fantasy_teams.nfl_playoff_franchise_id
   *
   * Those identities are carried forward by the finalized
   * NFL Playoffs renewal backend.
   */

  const currentLeagueHistoryResult =
    await admin
      .from(
        "leagues"
      )
      .select(
        `
          id,
          season,
          nfl_playoff_history_id
        `
      )
      .eq(
        "id",
        leagueId
      )
      .eq(
        "league_type",
        "nfl_playoffs"
      )
      .maybeSingle();

  if (
    currentLeagueHistoryResult.error
  ) {
    throw new Error(
      `Could not load NFL Playoffs history identity: ${currentLeagueHistoryResult.error.message}`
    );
  }

  const historyId =
    currentLeagueHistoryResult.data
      ?.nfl_playoff_history_id ??
    null;

  let historyLeagues:
    HistoryLeagueRow[] =
    [];

  let historyTrophies:
    HistoryTrophyRow[] =
    [];

  let currentFranchiseId:
    string |
    null =
    null;

  if (
    historyId
  ) {
    const historyLeaguesResult =
      await admin
        .from(
          "leagues"
        )
        .select(
          `
            id,
            season,
            player_selection_mode
          `
        )
        .eq(
          "league_type",
          "nfl_playoffs"
        )
        .eq(
          "nfl_playoff_history_id",
          historyId
        )
        .order(
          "season",
          {
            ascending:
              true,
          }
        );

    if (
      historyLeaguesResult.error
    ) {
      throw new Error(
        `Could not load NFL Playoffs renewal lineage: ${historyLeaguesResult.error.message}`
      );
    }

    historyLeagues =
      (
        historyLeaguesResult.data ??
        []
      ) as HistoryLeagueRow[];

    const historyLeagueIds =
      historyLeagues.map(
        (
          league
        ) =>
          league.id
      );

    if (
      historyLeagueIds.length >
      0
    ) {
      const [
        historyTeamsResult,
        historyTrophiesResult,
      ] =
        await Promise.all([
          admin
            .from(
              "fantasy_teams"
            )
            .select(
              `
                id,
                league_id,
                team_name,
                owner_id,
                nfl_playoff_franchise_id
              `
            )
            .in(
              "league_id",
              historyLeagueIds
            ),

          admin
            .from(
              "nfl_playoff_trophies"
            )
            .select(
              `
                league_id,
                season,
                fantasy_team_id,
                round_number,
                award_key,
                award_name,
                award_category,
                award_emoji,
                award_value,
                detail,
                created_at
              `
            )
            .in(
              "league_id",
              historyLeagueIds
            )
            .order(
              "season",
              {
                ascending:
                  true,
              }
            )
            .order(
              "created_at",
              {
                ascending:
                  true,
              }
            ),
        ]);

      if (
        historyTeamsResult.error
      ) {
        throw new Error(
          `Could not load NFL Playoffs historical franchises: ${historyTeamsResult.error.message}`
        );
      }

      if (
        historyTrophiesResult.error
      ) {
        throw new Error(
          `Could not load NFL Playoffs historical trophies: ${historyTrophiesResult.error.message}`
        );
      }

      const historyTeams =
        (
          historyTeamsResult.data ??
          []
        ) as HistoryFantasyTeamRow[];

      const historyTeamMap =
        new Map<
          string,
          HistoryFantasyTeamRow
        >();

      for (
        const team of
        historyTeams
      ) {
        historyTeamMap.set(
          `${team.league_id}:${team.id}`,
          team
        );

        if (
          team.league_id ===
            leagueId &&
          team.id ===
            myTeamId
        ) {
          currentFranchiseId =
            team.nfl_playoff_franchise_id;
        }
      }

      const selectionModeMap =
        new Map<
          string,
          string | null
        >(
          historyLeagues.map(
            (
              league
            ) => [
              league.id,
              league.player_selection_mode,
            ]
          )
        );

      historyTrophies =
        (
          historyTrophiesResult.data ??
          []
        )
          .map(
            (
              raw
            ) => {
              const trophy =
                raw as HistoryTrophyRawRow;

              const historicalTeam =
                historyTeamMap.get(
                  `${trophy.league_id}:${trophy.fantasy_team_id}`
                );

              return {
                ...trophy,

                team_name:
                  historicalTeam
                    ?.team_name ??
                  `Team ${trophy.fantasy_team_id}`,

                franchise_id:
                  historicalTeam
                    ?.nfl_playoff_franchise_id ??
                  null,

                selection_mode:
                  selectionModeMap.get(
                    trophy.league_id
                  ) ??
                  null,
              };
            }
          );
    }
  }

  /*
   * ============================================================
   * CAREER TROPHY ORGANIZATION
   * ============================================================
   */

  const careerMap =
    new Map<
      string,
      {
        franchiseId:
          string;

        teamName:
          string;

        latestSeason:
          number;

        seasons:
          Set<number>;

        totalAwards:
          number;

        achievementCount:
          number;

        infamyCount:
          number;

        championships:
          number;

        runnerUps:
          number;

        isMyFranchise:
          boolean;

        awards:
          Map<
            string,
            {
              awardKey:
                string;

              awardName:
                string;

              awardCategory:
                string;

              awardEmoji:
                string;

              count:
                number;

              seasons:
                Set<number>;

              latestDetail:
                string | null;

              latestSeason:
                number;
            }
          >;
      }
    >();

  for (
    const trophy of
    historyTrophies
  ) {
    /*
     * Renewal code guarantees nfl_playoff_franchise_id for
     * active entries. The fallback prevents an old legacy row
     * without identity from disappearing from history.
     */
    const franchiseKey =
      trophy.franchise_id ??
      `${trophy.league_id}:${trophy.fantasy_team_id}`;

    let career =
      careerMap.get(
        franchiseKey
      );

    if (
      !career
    ) {
      career = {
        franchiseId:
          franchiseKey,

        teamName:
          trophy.team_name,

        latestSeason:
          trophy.season,

        seasons:
          new Set<number>(),

        totalAwards:
          0,

        achievementCount:
          0,

        infamyCount:
          0,

        championships:
          0,

        runnerUps:
          0,

        isMyFranchise:
          currentFranchiseId !==
            null &&
          trophy.franchise_id ===
            currentFranchiseId,

        awards:
          new Map(),
      };

      careerMap.set(
        franchiseKey,
        career
      );
    }

    if (
      trophy.season >=
      career.latestSeason
    ) {
      career.latestSeason =
        trophy.season;

      career.teamName =
        trophy.team_name;
    }

    career.seasons.add(
      trophy.season
    );

    career.totalAwards +=
      1;

    if (
      trophy.award_category ===
      "INFAMY"
    ) {
      career.infamyCount +=
        1;
    } else {
      career.achievementCount +=
        1;
    }

    if (
      trophy.award_key ===
      "nfl_playoffs_champion"
    ) {
      career.championships +=
        1;
    }

    if (
      trophy.award_key ===
      "nfl_playoffs_runner_up"
    ) {
      career.runnerUps +=
        1;
    }

    let careerAward =
      career.awards.get(
        trophy.award_key
      );

    if (
      !careerAward
    ) {
      careerAward = {
        awardKey:
          trophy.award_key,

        awardName:
          trophy.award_name,

        awardCategory:
          trophy.award_category,

        awardEmoji:
          trophy.award_emoji,

        count:
          0,

        seasons:
          new Set<number>(),

        latestDetail:
          trophy.detail,

        latestSeason:
          trophy.season,
      };

      career.awards.set(
        trophy.award_key,
        careerAward
      );
    }

    careerAward.count +=
      1;

    careerAward.seasons.add(
      trophy.season
    );

    if (
      trophy.season >=
      careerAward.latestSeason
    ) {
      careerAward.latestSeason =
        trophy.season;

      careerAward.latestDetail =
        trophy.detail;

      careerAward.awardName =
        trophy.award_name;

      careerAward.awardCategory =
        trophy.award_category;

      careerAward.awardEmoji =
        trophy.award_emoji;
    }
  }

  const careerCases:
    FranchiseCareer[] =
    Array.from(
      careerMap.values()
    )
      .map(
        (
          career
        ) => ({
          franchiseId:
            career.franchiseId,

          teamName:
            career.teamName,

          seasons:
            Array.from(
              career.seasons
            ).sort(
              (
                a,
                b
              ) =>
                a - b
            ),

          totalAwards:
            career.totalAwards,

          achievementCount:
            career.achievementCount,

          infamyCount:
            career.infamyCount,

          championships:
            career.championships,

          runnerUps:
            career.runnerUps,

          isMyFranchise:
            career.isMyFranchise,

          awards:
            Array.from(
              career.awards.values()
            )
              .map(
                (
                  award
                ) => ({
                  awardKey:
                    award.awardKey,

                  awardName:
                    award.awardName,

                  awardCategory:
                    award.awardCategory,

                  awardEmoji:
                    award.awardEmoji,

                  count:
                    award.count,

                  seasons:
                    Array.from(
                      award.seasons
                    ).sort(
                      (
                        a,
                        b
                      ) =>
                        a - b
                    ),

                  latestDetail:
                    award.latestDetail,
                })
              )
              .sort(
                (
                  a,
                  b
                ) =>
                  awardPriority(
                    a.awardKey
                  ) -
                  awardPriority(
                    b.awardKey
                  )
              ),
        })
      )
      .sort(
        (
          a,
          b
        ) => {
          if (
            a.isMyFranchise !==
            b.isMyFranchise
          ) {
            return a.isMyFranchise
              ? -1
              : 1;
          }

          if (
            b.championships !==
            a.championships
          ) {
            return (
              b.championships -
              a.championships
            );
          }

          if (
            b.totalAwards !==
            a.totalAwards
          ) {
            return (
              b.totalAwards -
              a.totalAwards
            );
          }

          return a.teamName.localeCompare(
            b.teamName
          );
        }
      );

  const myCareer =
    careerCases.find(
      (
        career
      ) =>
        career.isMyFranchise
    ) ??
    null;

  const careerChampions =
    historyTrophies
      .filter(
        (
          trophy
        ) =>
          trophy.award_key ===
          "nfl_playoffs_champion"
      )
      .sort(
        (
          a,
          b
        ) =>
          b.season -
          a.season
      );

  const careerRunnerUps =
    historyTrophies
      .filter(
        (
          trophy
        ) =>
          trophy.award_key ===
          "nfl_playoffs_runner_up"
      )
      .sort(
        (
          a,
          b
        ) =>
          b.season -
          a.season
      );

  const historySeasonCount =
    historyLeagues.length >
    0
      ? historyLeagues.length
      : 1;

  const historyFirstSeason =
    historyLeagues[0]
      ?.season ??
    season;

  const historyLatestSeason =
    historyLeagues[
      historyLeagues.length -
      1
    ]
      ?.season ??
    season;

  /*
   * ============================================================
   * TROPHY ORGANIZATION
   * ============================================================
   */

  const teamMap =
    new Map<
      number,
      TeamTrophyCase
    >();

  for (
    const trophy of
    trophies
  ) {
    let team =
      teamMap.get(
        trophy.fantasy_team_id
      );

    if (
      !team
    ) {
      team = {
        teamId:
          trophy.fantasy_team_id,

        teamName:
          trophy.team_name,

        trophies:
          [],

        achievementCount:
          0,

        infamyCount:
          0,

        totalAwards:
          0,

        isMyTeam:
          myTeamId ===
          trophy.fantasy_team_id,

        isChampion:
          false,
      };

      teamMap.set(
        trophy.fantasy_team_id,
        team
      );
    }

    team.trophies.push(
      trophy
    );

    team.totalAwards +=
      1;

    if (
      trophy.award_category ===
      "INFAMY"
    ) {
      team.infamyCount +=
        1;
    } else {
      team.achievementCount +=
        1;
    }

    if (
      trophy.award_key ===
      "nfl_playoffs_champion"
    ) {
      team.isChampion =
        true;
    }
  }

  const teamCases =
    Array.from(
      teamMap.values()
    )
      .map(
        (
          team
        ) => ({
          ...team,

          trophies:
            [...team.trophies]
              .sort(
                (
                  a,
                  b
                ) => {
                  const roundA =
                    a.round_number ??
                    5;

                  const roundB =
                    b.round_number ??
                    5;

                  if (
                    roundA !==
                    roundB
                  ) {
                    return (
                      roundA -
                      roundB
                    );
                  }

                  return (
                    awardPriority(
                      a.award_key
                    ) -
                    awardPriority(
                      b.award_key
                    )
                  );
                }
              ),
        })
      )
      .sort(
        (
          a,
          b
        ) => {
          if (
            a.isChampion !==
            b.isChampion
          ) {
            return a.isChampion
              ? -1
              : 1;
          }

          if (
            b.achievementCount !==
            a.achievementCount
          ) {
            return (
              b.achievementCount -
              a.achievementCount
            );
          }

          return a.teamName.localeCompare(
            b.teamName
          );
        }
      );

  /*
   * ============================================================
   * SUMMARY
   * ============================================================
   */

  const finalizedRounds =
    rounds.filter(
      isFinalRound
    );

  const totalAwards =
    trophies.length;

  const achievementAwards =
    trophies.filter(
      (
        trophy
      ) =>
        trophy.award_category !==
        "INFAMY"
    ).length;

  const infamyAwards =
    trophies.filter(
      (
        trophy
      ) =>
        trophy.award_category ===
        "INFAMY"
    ).length;

  const champion =
    trophies.find(
      (
        trophy
      ) =>
        trophy.award_key ===
        "nfl_playoffs_champion"
    ) ??
    null;

  const runnerUp =
    trophies.find(
      (
        trophy
      ) =>
        trophy.award_key ===
        "nfl_playoffs_runner_up"
    ) ??
    null;

  const postseasonComplete =
    Boolean(
      champion
    ) ||
    finalizedRounds.length ===
      4 ||
    [
      "final",
      "finalized",
      "complete",
      "completed",
    ].includes(
      (
        state
          ?.status ??
        ""
      )
        .trim()
        .toLowerCase()
    );

  const activeRound =
    Number(
      state
        ?.active_round ??
      1
    );

  const myCase =
    myTeamId !==
    null
      ? teamCases.find(
          (
            team
          ) =>
            team.teamId ===
            myTeamId
        ) ??
        null
      : null;

  /*
   * ============================================================
   * AWARD LEADERS
   * ============================================================
   */

  const mostDecorated =
    [...teamCases]
      .sort(
        (
          a,
          b
        ) => {
          if (
            b.totalAwards !==
            a.totalAwards
          ) {
            return (
              b.totalAwards -
              a.totalAwards
            );
          }

          if (
            b.achievementCount !==
            a.achievementCount
          ) {
            return (
              b.achievementCount -
              a.achievementCount
            );
          }

          return a.teamName.localeCompare(
            b.teamName
          );
        }
      )[0] ??
    null;

  const roundKingLeader =
    teamCases
      .map(
        (
          team
        ) => ({
          teamName:
            team.teamName,

          count:
            team.trophies.filter(
              (
                trophy
              ) =>
                trophy.award_key ===
                "round_king"
            ).length,
        })
      )
      .sort(
        (
          a,
          b
        ) =>
          b.count -
          a.count
      )[0] ??
    null;

  const mvpLeader =
    teamCases
      .map(
        (
          team
        ) => ({
          teamName:
            team.teamName,

          count:
            team.trophies.filter(
              (
                trophy
              ) =>
                trophy.award_key ===
                "round_mvp"
            ).length,
        })
      )
      .sort(
        (
          a,
          b
        ) =>
          b.count -
          a.count
      )[0] ??
    null;

  return (
    <main
      style={
        styles.page
      }
    >
      <style>{`
        @media (max-width: 900px) {
          .g365-nflp-trophy-hero {
            flex-direction: column !important;
            align-items: flex-start !important;
          }

          .g365-nflp-trophy-summary {
            grid-template-columns: repeat(2,minmax(0,1fr)) !important;
          }

          .g365-nflp-trophy-featured {
            grid-template-columns: 1fr !important;
          }

          .g365-nflp-trophy-team-grid {
            grid-template-columns: 1fr !important;
          }

          .g365-nflp-trophy-career-stats {
            grid-template-columns: repeat(2,minmax(0,1fr)) !important;
          }

          .g365-nflp-trophy-career-awards {
            grid-template-columns: 1fr !important;
          }
        }

        @media (max-width: 560px) {
          .g365-nflp-trophy-summary {
            grid-template-columns: 1fr !important;
          }

          .g365-nflp-trophy-actions {
            width: 100% !important;
          }

          .g365-nflp-trophy-actions a {
            flex: 1 1 auto !important;
            text-align: center !important;
          }

          .g365-nflp-trophy-round-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>

      <div
        style={
          styles.shell
        }
      >
        {/* =====================================================
            HERO
            ===================================================== */}

        <header
          className="g365-nflp-trophy-hero"
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
              G365 NFL PLAYOFFS
            </p>

            <h1
              style={
                styles.title
              }
            >
              Trophy Case
            </h1>

            <p
              style={
                styles.subtitle
              }
            >
              {
                access.league
                  .name
              }
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
            className="g365-nflp-trophy-actions"
            style={
              styles.actions
            }
          >
            <Link
              href={`/league/${leagueId}/nfl-playoffs/recap`}
              style={
                styles.secondaryButton
              }
            >
              RECAP
            </Link>

            <Link
              href={`/league/${leagueId}/nfl-playoffs/standings`}
              style={
                styles.primaryButton
              }
            >
              STANDINGS
            </Link>
          </div>
        </header>

        {/* =====================================================
            SUMMARY
            ===================================================== */}

        <section
          className="g365-nflp-trophy-summary"
          style={
            styles.summaryGrid
          }
        >
          <SummaryCard
            emoji="🏆"
            label="TOTAL AWARDS"
            value={String(
              totalAwards
            )}
            detail="Permanent postseason honors"
          />

          <SummaryCard
            emoji="⭐"
            label="ACHIEVEMENTS"
            value={String(
              achievementAwards
            )}
            detail="Positive postseason awards"
          />

          <SummaryCard
            emoji="🧊"
            label="INFAMY"
            value={String(
              infamyAwards
            )}
            detail="The postseason remembers everything"
          />

          <SummaryCard
            emoji="🏈"
            label="ROUNDS FINAL"
            value={`${finalizedRounds.length} / 4`}
            detail={
              postseasonComplete
                ? "Postseason complete"
                : `Active round: ${activeRound}`
            }
          />
        </section>

        {/* =====================================================
            CHAMPIONSHIP FEATURE
            ===================================================== */}

        {champion ? (
          <section
            style={
              styles.championCard
            }
          >
            <div
              style={
                styles.championCrown
              }
            >
              👑
            </div>

            <div
              style={
                styles.championBody
              }
            >
              <p
                style={
                  styles.championEyebrow
                }
              >
                {
                  season
                } NFL PLAYOFFS CHAMPION
              </p>

              <h2
                style={
                  styles.championName
                }
              >
                {
                  champion.team_name
                }
              </h2>

              <p
                style={
                  styles.championDetail
                }
              >
                {
                  champion.detail ??
                  "G365 NFL Playoffs Champion"
                }
              </p>

              {runnerUp && (
                <div
                  style={
                    styles.runnerUp
                  }
                >
                  <span>
                    🥈 Runner-Up
                  </span>

                  <strong>
                    {
                      runnerUp.team_name
                    }
                  </strong>

                  {runnerUp.award_value !==
                  null ? (
                    <span>
                      {n(
                        runnerUp.award_value
                      ).toFixed(
                        2
                      )}{" "}
                      pts
                    </span>
                  ) : null}
                </div>
              )}
            </div>
          </section>
        ) : (
          <section
            style={
              styles.pendingChampion
            }
          >
            <div
              style={
                styles.pendingIcon
              }
            >
              👑
            </div>

            <div>
              <p
                style={
                  styles.sectionEyebrow
                }
              >
                CHAMPIONSHIP TROPHY
              </p>

              <h2
                style={
                  styles.pendingTitle
                }
              >
                Champion Not Yet Crowned
              </h2>

              <p
                style={
                  styles.pendingText
                }
              >
                The permanent NFL
                Playoffs Champion and
                Runner-Up trophies are
                awarded after the Super
                Bowl round is finalized.
              </p>
            </div>
          </section>
        )}

        {/* =====================================================
            FEATURED LEADERS
            ===================================================== */}

        {teamCases.length >
        0 ? (
          <section
            className="g365-nflp-trophy-featured"
            style={
              styles.featuredGrid
            }
          >
            <FeatureCard
              emoji="🏅"
              eyebrow="MOST DECORATED"
              value={
                mostDecorated
                  ?.teamName ??
                "—"
              }
              detail={
                mostDecorated
                  ? `${mostDecorated.totalAwards} total awards`
                  : "No awards yet"
              }
            />

            <FeatureCard
              emoji="🏆"
              eyebrow="ROUND KING LEADER"
              value={
                roundKingLeader &&
                roundKingLeader.count >
                  0
                  ? roundKingLeader.teamName
                  : "—"
              }
              detail={
                roundKingLeader &&
                roundKingLeader.count >
                  0
                  ? `${roundKingLeader.count} round win${
                      roundKingLeader.count ===
                      1
                        ? ""
                        : "s"
                    }`
                  : "No finalized round winners yet"
              }
            />

            <FeatureCard
              emoji="⭐"
              eyebrow="ROUND MVP LEADER"
              value={
                mvpLeader &&
                mvpLeader.count >
                  0
                  ? mvpLeader.teamName
                  : "—"
              }
              detail={
                mvpLeader &&
                mvpLeader.count >
                  0
                  ? `${mvpLeader.count} MVP award${
                      mvpLeader.count ===
                      1
                        ? ""
                        : "s"
                    }`
                  : "No MVP awards yet"
              }
            />
          </section>
        ) : null}

        {/* =====================================================
            MY TROPHY CASE
            ===================================================== */}

        {myTeamId !==
        null ? (
          <section
            style={
              styles.card
            }
          >
            <SectionHead
              eyebrow="MY CURRENT-SEASON TROPHIES"
              title={
                myCase
                  ?.teamName ??
                "My Trophy Case"
              }
              badge={
                myCase
                  ? `${myCase.totalAwards} AWARDS`
                  : "0 AWARDS"
              }
            />

            {myCase ? (
              <div
                className="g365-nflp-trophy-round-grid"
                style={
                  styles.awardGrid
                }
              >
                {myCase.trophies.map(
                  (
                    trophy,
                    index
                  ) => (
                    <AwardCard
                      key={`${trophy.award_key}-${trophy.round_number ?? "season"}-${index}`}
                      trophy={
                        trophy
                      }
                    />
                  )
                )}
              </div>
            ) : (
              <EmptyState
                text="Your permanent NFL Playoffs trophies will appear here after you earn your first finalized postseason award."
              />
            )}
          </section>
        ) : null}

        {/* =====================================================
            ROUND TROPHY TIMELINE
            ===================================================== */}

        <section
          style={
            styles.card
          }
        >
          <SectionHead
            eyebrow="POSTSEASON TIMELINE"
            title="Awards By Round"
            badge={`${finalizedRounds.length}/4 FINAL`}
          />

          <div
            style={
              styles.timeline
            }
          >
            {[
              1,
              2,
              3,
              4,
            ].map(
              (
                number
              ) => {
                const round =
                  rounds.find(
                    (
                      item
                    ) =>
                      item.round_number ===
                      number
                  );

                const final =
                  round
                    ? isFinalRound(
                        round
                      )
                    : false;

                const awards =
                  trophies.filter(
                    (
                      trophy
                    ) =>
                      trophy.round_number ===
                      number
                  );

                return (
                  <article
                    key={
                      number
                    }
                    style={{
                      ...styles.timelineCard,

                      ...(final
                        ? styles.timelineFinal
                        : {}),
                    }}
                  >
                    <div
                      style={
                        styles.timelineTop
                      }
                    >
                      <div>
                        <span
                          style={
                            styles.sectionEyebrow
                          }
                        >
                          ROUND {
                            number
                          }
                        </span>

                        <h3
                          style={
                            styles.timelineTitle
                          }
                        >
                          {
                            round
                              ?.round_name ??
                            roundName(
                              number
                            )
                          }
                        </h3>
                      </div>

                      <span
                        style={{
                          ...styles.statusBadge,

                          ...(final
                            ? styles.finalBadge
                            : {}),
                        }}
                      >
                        {final
                          ? "FINAL"
                          : number ===
                              activeRound
                            ? "ACTIVE"
                            : "UPCOMING"}
                      </span>
                    </div>

                    <div
                      style={
                        styles.timelineCount
                      }
                    >
                      <strong>
                        {
                          awards.length
                        }
                      </strong>

                      <span>
                        AWARDS
                      </span>
                    </div>

                    {final &&
                    awards.length ===
                      0 ? (
                      <p
                        style={
                          styles.warningText
                        }
                      >
                        Round finalized,
                        but no trophy rows
                        were found.
                      </p>
                    ) : null}
                  </article>
                );
              }
            )}
          </div>
        </section>

        {/* =====================================================
            ALL TEAM TROPHY CASES
            ===================================================== */}

        <section
          style={
            styles.card
          }
        >
          <SectionHead
            eyebrow="CURRENT SEASON"
            title={`${season} Team Trophy Cases`}
            badge={`${teamCases.length} TEAMS`}
          />

          {teamCases.length >
          0 ? (
            <div
              className="g365-nflp-trophy-team-grid"
              style={
                styles.teamGrid
              }
            >
              {teamCases.map(
                (
                  team
                ) => (
                  <article
                    key={
                      team.teamId
                    }
                    style={{
                      ...styles.teamCard,

                      ...(team.isMyTeam
                        ? styles.myTeamCard
                        : {}),

                      ...(team.isChampion
                        ? styles.championTeamCard
                        : {}),
                    }}
                  >
                    <div
                      style={
                        styles.teamHeader
                      }
                    >
                      <div>
                        <div
                          style={
                            styles.teamTitleLine
                          }
                        >
                          {team.isChampion && (
                            <span
                              style={
                                styles.crown
                              }
                            >
                              👑
                            </span>
                          )}

                          <h3
                            style={
                              styles.teamName
                            }
                          >
                            {
                              team.teamName
                            }
                          </h3>

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

                        <p
                          style={
                            styles.teamMeta
                          }
                        >
                          {
                            team.achievementCount
                          }{" "}
                          achievements
                          {" · "}
                          {
                            team.infamyCount
                          }{" "}
                          infamy
                        </p>
                      </div>

                      <div
                        style={
                          styles.teamAwardTotal
                        }
                      >
                        <strong>
                          {
                            team.totalAwards
                          }
                        </strong>

                        <span>
                          AWARDS
                        </span>
                      </div>
                    </div>

                    <TrophyGroup
                      title="ACHIEVEMENTS"
                      trophies={
                        team.trophies.filter(
                          (
                            trophy
                          ) =>
                            trophy.award_category !==
                            "INFAMY"
                        )
                      }
                    />

                    <TrophyGroup
                      title="INFAMY"
                      trophies={
                        team.trophies.filter(
                          (
                            trophy
                          ) =>
                            trophy.award_category ===
                            "INFAMY"
                        )
                      }
                      infamy
                    />
                  </article>
                )
              )}
            </div>
          ) : (
            <EmptyState
              text="The Trophy Case is empty. Permanent awards will appear after the first NFL Playoffs round is finalized."
            />
          )}
        </section>

        {/* =====================================================
            CONTINUOUS CAREER TROPHY CASE
            ===================================================== */}

        <section
          style={
            styles.card
          }
        >
          <SectionHead
            eyebrow="CONTINUOUS LEAGUE HISTORY"
            title="Career Trophy Case"
            badge={`${historySeasonCount} SEASON${
              historySeasonCount ===
              1
                ? ""
                : "S"
            }`}
          />

          <div
            style={
              styles.careerHistoryIntro
            }
          >
            <strong>
              {historyFirstSeason ===
              historyLatestSeason
                ? `${historyFirstSeason} history`
                : `${historyFirstSeason}–${historyLatestSeason} history`}
            </strong>

            <span>
              Stored NFL Playoffs trophies follow the league&apos;s permanent history ID and each entry&apos;s permanent franchise ID across renewals.
            </span>
          </div>

          {careerChampions.length >
          0 ? (
            <div
              style={
                styles.historyChampions
              }
            >
              <div
                style={
                  styles.historyChampionTitle
                }
              >
                CHAMPIONSHIP HISTORY
              </div>

              <div
                style={
                  styles.historyChampionGrid
                }
              >
                {careerChampions.map(
                  (
                    championRow
                  ) => {
                    const runner =
                      careerRunnerUps.find(
                        (
                          candidate
                        ) =>
                          candidate.season ===
                          championRow.season
                      ) ??
                      null;

                    return (
                      <article
                        key={`${championRow.season}-${championRow.franchise_id ?? championRow.fantasy_team_id}`}
                        style={
                          styles.historyChampionCard
                        }
                      >
                        <div
                          style={
                            styles.historyChampionSeason
                          }
                        >
                          {championRow.season}
                        </div>

                        <div>
                          <span
                            style={
                              styles.sectionEyebrow
                            }
                          >
                            👑 NFL PLAYOFFS CHAMPION
                          </span>

                          <h3
                            style={
                              styles.historyChampionName
                            }
                          >
                            {championRow.team_name}
                          </h3>

                          {championRow.award_value !==
                          null ? (
                            <div
                              style={
                                styles.historyChampionPoints
                              }
                            >
                              {n(
                                championRow.award_value
                              ).toFixed(
                                2
                              )}{" "}
                              pts
                            </div>
                          ) : null}

                          {runner && (
                            <div
                              style={
                                styles.historyRunner
                              }
                            >
                              🥈 Runner-Up:{" "}
                              <strong>
                                {runner.team_name}
                              </strong>
                            </div>
                          )}
                        </div>
                      </article>
                    );
                  }
                )}
              </div>
            </div>
          ) : (
            <div
              style={
                styles.historyPending
              }
            >
              Championship history will appear after the first completed NFL Playoffs season.
            </div>
          )}

          {myTeamId !==
          null ? (
            <div
              style={
                styles.careerBlock
              }
            >
              <div
                style={
                  styles.careerBlockHead
                }
              >
                <div>
                  <span
                    style={
                      styles.sectionEyebrow
                    }
                  >
                    MY CAREER
                  </span>

                  <h3
                    style={
                      styles.careerBlockTitle
                    }
                  >
                    {myCareer
                      ?.teamName ??
                    "My Playoff Entry"}
                  </h3>
                </div>

                <span
                  style={
                    styles.countBadge
                  }
                >
                  {myCareer
                    ? `${myCareer.totalAwards} AWARDS`
                    : "0 AWARDS"}
                </span>
              </div>

              {myCareer ? (
                <>
                  <div
                    className="g365-nflp-trophy-career-stats"
                    style={
                      styles.careerStats
                    }
                  >
                    <CareerStat
                      label="SEASONS"
                      value={String(
                        myCareer.seasons.length
                      )}
                    />

                    <CareerStat
                      label="CHAMPIONSHIPS"
                      value={String(
                        myCareer.championships
                      )}
                    />

                    <CareerStat
                      label="RUNNER-UP"
                      value={String(
                        myCareer.runnerUps
                      )}
                    />

                    <CareerStat
                      label="TOTAL AWARDS"
                      value={String(
                        myCareer.totalAwards
                      )}
                    />
                  </div>

                  <div
                    className="g365-nflp-trophy-career-awards"
                    style={
                      styles.careerAwardGrid
                    }
                  >
                    {myCareer.awards.map(
                      (
                        award
                      ) => (
                        <CareerAwardCard
                          key={
                            award.awardKey
                          }
                          award={
                            award
                          }
                        />
                      )
                    )}
                  </div>
                </>
              ) : (
                <EmptyState
                  text="Your career Trophy Case will grow here as this NFL Playoffs league is renewed into future seasons."
                />
              )}
            </div>
          ) : null}

          <div
            style={
              styles.careerBlock
            }
          >
            <div
              style={
                styles.careerBlockHead
              }
            >
              <div>
                <span
                  style={
                    styles.sectionEyebrow
                  }
                >
                  FRANCHISE HISTORY
                </span>

                <h3
                  style={
                    styles.careerBlockTitle
                  }
                >
                  All Career Trophy Cases
                </h3>
              </div>

              <span
                style={
                  styles.countBadge
                }
              >
                {careerCases.length} FRANCHISE{
                  careerCases.length ===
                  1
                    ? ""
                    : "S"
                }
              </span>
            </div>

            {careerCases.length >
            0 ? (
              <div
                className="g365-nflp-trophy-team-grid"
                style={
                  styles.careerTeamGrid
                }
              >
                {careerCases.map(
                  (
                    career
                  ) => (
                    <article
                      key={
                        career.franchiseId
                      }
                      style={{
                        ...styles.careerTeamCard,

                        ...(career.isMyFranchise
                          ? styles.myTeamCard
                          : {}),

                        ...(career.championships >
                        0
                          ? styles.championTeamCard
                          : {}),
                      }}
                    >
                      <div
                        style={
                          styles.careerTeamHeader
                        }
                      >
                        <div>
                          <div
                            style={
                              styles.teamTitleLine
                            }
                          >
                            {career.championships >
                            0 && (
                              <span
                                style={
                                  styles.crown
                                }
                              >
                                👑
                              </span>
                            )}

                            <h3
                              style={
                                styles.teamName
                              }
                            >
                              {career.teamName}
                            </h3>

                            {career.isMyFranchise && (
                              <span
                                style={
                                  styles.youBadge
                                }
                              >
                                YOU
                              </span>
                            )}
                          </div>

                          <p
                            style={
                              styles.teamMeta
                            }
                          >
                            {career.seasons.length} season{
                              career.seasons.length ===
                              1
                                ? ""
                                : "s"
                            }
                            {" · "}
                            {career.championships} championship{
                              career.championships ===
                              1
                                ? ""
                                : "s"
                            }
                            {" · "}
                            {career.totalAwards} awards
                          </p>
                        </div>

                        <div
                          style={
                            styles.teamAwardTotal
                          }
                        >
                          <strong>
                            {career.totalAwards}
                          </strong>

                          <span>
                            CAREER
                          </span>
                        </div>
                      </div>

                      <div
                        style={
                          styles.careerSeasonLine
                        }
                      >
                        SEASONS:{" "}
                        {career.seasons.join(
                          " · "
                        )}
                      </div>

                      <div
                        style={
                          styles.careerMiniAwards
                        }
                      >
                        {career.awards.map(
                          (
                            award
                          ) => (
                            <div
                              key={
                                award.awardKey
                              }
                              style={
                                styles.careerMiniAward
                              }
                            >
                              <span>
                                {award.awardEmoji}
                              </span>

                              <strong>
                                {award.awardName}
                              </strong>

                              <span>
                                ×{award.count}
                              </span>
                            </div>
                          )
                        )}
                      </div>
                    </article>
                  )
                )}
              </div>
            ) : (
              <EmptyState
                text="Career franchise history will appear after permanent NFL Playoffs trophies have been earned."
              />
            )}
          </div>
        </section>

        {/* =====================================================
            AWARD GUIDE
            ===================================================== */}

        <section
          style={
            styles.card
          }
        >
          <SectionHead
            eyebrow="G365 AWARD GUIDE"
            title="NFL Playoffs Honors"
            badge={
              isSalary
                ? "SALARY MODE"
                : "NO SALARY MODE"
            }
          />

          <div
            style={
              styles.guideGrid
            }
          >
            <GuideItem
              emoji="🏆"
              title="Round King"
              text="Highest-scoring fantasy team in a finalized postseason round."
            />

            <GuideItem
              emoji="⭐"
              title="Round MVP"
              text="Highest-scoring individual fantasy player used in the round."
            />

            <GuideItem
              emoji="🚀"
              title="Projection Crusher"
              text="Team that exceeded its locked lineup projection by the largest margin."
            />

            {isSalary && (
              <GuideItem
                emoji="💰"
                title="Value King"
                text="Best fantasy-points-per-$1,000 salary performance in the finalized round."
              />
            )}

            <GuideItem
              emoji="🧊"
              title="Ice Cold Round"
              text="Lowest completed team score of the finalized postseason round."
            />

            <GuideItem
              emoji="👑"
              title="NFL Playoffs Champion"
              text="Team ranked No. 1 in the official final cumulative standings after all four postseason rounds, including the league's championship tiebreak rules."
            />

            <GuideItem
              emoji="🥈"
              title="Runner-Up"
              text="Team ranked No. 2 in the official final cumulative standings after the Super Bowl round and championship tiebreak rules are applied."
            />
          </div>
        </section>

        <div
          style={
            styles.note
          }
        >
          Trophy Case awards are
          permanent records generated
          from finalized NFL Playoffs
          rounds. Career history follows
          the league&apos;s permanent history
          ID and each team&apos;s franchise ID
          across renewed seasons. Live or
          upcoming rounds do not award
          trophies, and reopening this
          page does not recalculate or
          duplicate stored honors.
        </div>
      </div>
    </main>
  );
}


function SummaryCard({
  emoji,
  label,
  value,
  detail,
}: {
  emoji:
    string;

  label:
    string;

  value:
    string;

  detail:
    string;
}) {
  return (
    <article
      style={
        styles.summaryCard
      }
    >
      <span
        style={
          styles.summaryEmoji
        }
      >
        {emoji}
      </span>

      <div>
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

        <span
          style={
            styles.summaryDetail
          }
        >
          {detail}
        </span>
      </div>
    </article>
  );
}


function FeatureCard({
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
        styles.featureCard
      }
    >
      <div
        style={
          styles.featureEmoji
        }
      >
        {emoji}
      </div>

      <div>
        <span
          style={
            styles.sectionEyebrow
          }
        >
          {eyebrow}
        </span>

        <h3
          style={
            styles.featureValue
          }
        >
          {value}
        </h3>

        <p
          style={
            styles.featureDetail
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


function TrophyGroup({
  title,
  trophies,
  infamy = false,
}: {
  title:
    string;

  trophies:
    TrophyRow[];

  infamy?:
    boolean;
}) {
  return (
    <div
      style={
        styles.group
      }
    >
      <div
        style={
          styles.groupHeader
        }
      >
        <span
          style={{
            ...styles.groupTitle,

            ...(infamy
              ? styles.infamyText
              : {}),
          }}
        >
          {title}
        </span>

        <span
          style={
            styles.groupCount
          }
        >
          {
            trophies.length
          }
        </span>
      </div>

      {trophies.length >
      0 ? (
        <div
          style={
            styles.groupList
          }
        >
          {trophies.map(
            (
              trophy,
              index
            ) => (
              <div
                key={`${trophy.award_key}-${trophy.round_number ?? "season"}-${index}`}
                style={{
                  ...styles.miniAward,

                  ...(infamy
                    ? styles.miniInfamy
                    : {}),
                }}
              >
                <span
                  style={
                    styles.miniEmoji
                  }
                >
                  {
                    trophy.award_emoji
                  }
                </span>

                <div
                  style={
                    styles.miniBody
                  }
                >
                  <strong
                    style={
                      styles.miniTitle
                    }
                  >
                    {
                      trophy.award_name
                    }
                  </strong>

                  <span
                    style={
                      styles.miniRound
                    }
                  >
                    {roundName(
                      trophy.round_number
                    )}
                  </span>

                  {trophy.detail && (
                    <p
                      style={
                        styles.miniDetail
                      }
                    >
                      {
                        trophy.detail
                      }
                    </p>
                  )}
                </div>
              </div>
            )
          )}
        </div>
      ) : (
        <div
          style={
            styles.groupEmpty
          }
        >
          None yet.
        </div>
      )}
    </div>
  );
}


function AwardCard({
  trophy,
}: {
  trophy:
    TrophyRow;
}) {
  const infamy =
    trophy.award_category ===
    "INFAMY";

  return (
    <article
      style={{
        ...styles.awardCard,

        ...(infamy
          ? styles.awardCardInfamy
          : {}),

        ...(trophy.award_key ===
        "nfl_playoffs_champion"
          ? styles.awardCardChampion
          : {}),
      }}
    >
      <div
        style={
          styles.awardEmoji
        }
      >
        {
          trophy.award_emoji
        }
      </div>

      <div>
        <div
          style={
            styles.awardTop
          }
        >
          <span
            style={{
              ...styles.awardCategory,

              ...(infamy
                ? styles.infamyText
                : {}),
            }}
          >
            {
              trophy.award_category
            }
          </span>

          <span
            style={
              styles.awardRound
            }
          >
            {roundName(
              trophy.round_number
            )}
          </span>
        </div>

        <h3
          style={
            styles.awardName
          }
        >
          {
            trophy.award_name
          }
        </h3>

        {trophy.detail && (
          <p
            style={
              styles.awardDetail
            }
          >
            {
              trophy.detail
            }
          </p>
        )}
      </div>
    </article>
  );
}


function CareerStat({
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
        styles.careerStat
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
          styles.careerStatValue
        }
      >
        {value}
      </strong>
    </div>
  );
}


function CareerAwardCard({
  award,
}: {
  award:
    CareerAward;
}) {
  const infamy =
    award.awardCategory ===
    "INFAMY";

  return (
    <article
      style={{
        ...styles.careerAwardCard,

        ...(infamy
          ? styles.awardCardInfamy
          : {}),

        ...(award.awardKey ===
        "nfl_playoffs_champion"
          ? styles.awardCardChampion
          : {}),
      }}
    >
      <div
        style={
          styles.careerAwardEmoji
        }
      >
        {award.awardEmoji}
      </div>

      <div
        style={
          styles.careerAwardBody
        }
      >
        <span
          style={{
            ...styles.awardCategory,

            ...(infamy
              ? styles.infamyText
              : {}),
          }}
        >
          {award.awardCategory}
        </span>

        <h4
          style={
            styles.careerAwardName
          }
        >
          {award.awardName}
        </h4>

        <div
          style={
            styles.careerAwardMeta
          }
        >
          <strong>
            ×{award.count}
          </strong>

          <span>
            {award.seasons.join(
              " · "
            )}
          </span>
        </div>

        {award.latestDetail && (
          <p
            style={
              styles.careerAwardDetail
            }
          >
            {award.latestDetail}
          </p>
        )}
      </div>
    </article>
  );
}


function GuideItem({
  emoji,
  title,
  text,
}: {
  emoji:
    string;

  title:
    string;

  text:
    string;
}) {
  return (
    <article
      style={
        styles.guideItem
      }
    >
      <span
        style={
          styles.guideEmoji
        }
      >
        {emoji}
      </span>

      <div>
        <strong
          style={
            styles.guideTitle
          }
        >
          {title}
        </strong>

        <p
          style={
            styles.guideText
          }
        >
          {text}
        </p>
      </div>
    </article>
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
      22,

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

    justifyContent:
      "space-between",

    alignItems:
      "center",

    gap:
      18,

    padding:
      24,

    marginBottom:
      16,

    border:
      "1px solid #292929",

    borderRadius:
      20,

    background:
      "linear-gradient(135deg,rgba(128,18,10,.25),rgba(235,91,20,.08),#111)",
  },

  eyebrow: {
    margin:
      0,

    color:
      "#ff6c1b",

    fontSize:
      10,

    fontWeight:
      900,

    letterSpacing:
      ".14em",
  },

  title: {
    margin:
      "5px 0",

    fontSize:
      36,

    lineHeight:
      1,
  },

  subtitle: {
    margin:
      0,

    color:
      "#888",

    fontSize:
      12,
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
      "10px 14px",

    borderRadius:
      9,

    color:
      "#fff",

    textDecoration:
      "none",

    background:
      "linear-gradient(135deg,#9b2113,#ed6618)",

    fontSize:
      9,

    fontWeight:
      900,
  },

  secondaryButton: {
    padding:
      "10px 14px",

    border:
      "1px solid #383838",

    borderRadius:
      9,

    color:
      "#bbb",

    textDecoration:
      "none",

    background:
      "#151515",

    fontSize:
      9,

    fontWeight:
      900,
  },

  summaryGrid: {
    display:
      "grid",

    gridTemplateColumns:
      "repeat(4,minmax(0,1fr))",

    gap:
      10,

    marginBottom:
      16,
  },

  summaryCard: {
    display:
      "flex",

    alignItems:
      "center",

    gap:
      12,

    minWidth:
      0,

    padding:
      15,

    border:
      "1px solid #292929",

    borderRadius:
      14,

    background:
      "#121212",
  },

  summaryEmoji: {
    width:
      42,

    height:
      42,

    flex:
      "0 0 42px",

    display:
      "grid",

    placeItems:
      "center",

    borderRadius:
      11,

    background:
      "#21130e",

    fontSize:
      20,
  },

  summaryLabel: {
    display:
      "block",

    color:
      "#d65b20",

    fontSize:
      7,

    fontWeight:
      900,

    letterSpacing:
      ".1em",
  },

  summaryValue: {
    display:
      "block",

    margin:
      "3px 0",

    fontSize:
      19,
  },

  summaryDetail: {
    display:
      "block",

    color:
      "#666",

    fontSize:
      8,
  },

  championCard: {
    display:
      "flex",

    alignItems:
      "center",

    gap:
      18,

    marginBottom:
      16,

    padding:
      23,

    border:
      "1px solid #bd4e19",

    borderRadius:
      18,

    background:
      "linear-gradient(135deg,#31170c,#1b120d,#111)",
  },

  championCrown: {
    width:
      68,

    height:
      68,

    flex:
      "0 0 68px",

    display:
      "grid",

    placeItems:
      "center",

    border:
      "1px solid #713517",

    borderRadius:
      "50%",

    background:
      "#29140b",

    fontSize:
      33,
  },

  championBody: {
    minWidth:
      0,

    flex:
      1,
  },

  championEyebrow: {
    margin:
      0,

    color:
      "#ff7a29",

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
      28,
  },

  championDetail: {
    margin:
      0,

    color:
      "#aaa",

    fontSize:
      11,

    lineHeight:
      1.5,
  },

  runnerUp: {
    display:
      "flex",

    flexWrap:
      "wrap",

    gap:
      8,

    alignItems:
      "center",

    marginTop:
      10,

    color:
      "#8a8a8a",

    fontSize:
      9,
  },

  pendingChampion: {
    display:
      "flex",

    gap:
      15,

    alignItems:
      "center",

    padding:
      20,

    marginBottom:
      16,

    border:
      "1px dashed #3a3a3a",

    borderRadius:
      16,

    background:
      "#111",
  },

  pendingIcon: {
    width:
      54,

    height:
      54,

    flex:
      "0 0 54px",

    display:
      "grid",

    placeItems:
      "center",

    borderRadius:
      "50%",

    background:
      "#1a1a1a",

    filter:
      "grayscale(1)",

    opacity:
      .55,

    fontSize:
      25,
  },

  pendingTitle: {
    margin:
      "4px 0",

    fontSize:
      17,
  },

  pendingText: {
    maxWidth:
      650,

    margin:
      0,

    color:
      "#707070",

    fontSize:
      9,

    lineHeight:
      1.5,
  },

  featuredGrid: {
    display:
      "grid",

    gridTemplateColumns:
      "repeat(3,minmax(0,1fr))",

    gap:
      10,

    marginBottom:
      16,
  },

  featureCard: {
    display:
      "flex",

    alignItems:
      "center",

    gap:
      12,

    padding:
      15,

    border:
      "1px solid #292929",

    borderRadius:
      14,

    background:
      "#121212",
  },

  featureEmoji: {
    fontSize:
      27,
  },

  featureValue: {
    margin:
      "3px 0",

    fontSize:
      14,
  },

  featureDetail: {
    margin:
      0,

    color:
      "#707070",

    fontSize:
      8,
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
      "#df5b1d",

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
      7,

    fontWeight:
      900,
  },

  awardGrid: {
    display:
      "grid",

    gridTemplateColumns:
      "repeat(2,minmax(0,1fr))",

    gap:
      10,

    padding:
      14,
  },

  awardCard: {
    display:
      "flex",

    gap:
      12,

    padding:
      14,

    border:
      "1px solid #323232",

    borderRadius:
      12,

    background:
      "#151515",
  },

  awardCardInfamy: {
    border:
      "1px solid #553236",

    background:
      "#1a1112",
  },

  awardCardChampion: {
    border:
      "1px solid #a2471c",

    background:
      "linear-gradient(135deg,#28140c,#171311)",
  },

  awardEmoji: {
    fontSize:
      29,
  },

  awardTop: {
    display:
      "flex",

    alignItems:
      "center",

    gap:
      7,

    flexWrap:
      "wrap",
  },

  awardCategory: {
    color:
      "#6bd18a",

    fontSize:
      7,

    fontWeight:
      900,

    letterSpacing:
      ".09em",
  },

  awardRound: {
    color:
      "#666",

    fontSize:
      7,

    fontWeight:
      800,
  },

  awardName: {
    margin:
      "4px 0",

    fontSize:
      14,
  },

  awardDetail: {
    margin:
      0,

    color:
      "#777",

    fontSize:
      9,

    lineHeight:
      1.45,
  },

  timeline: {
    display:
      "grid",

    gridTemplateColumns:
      "repeat(4,minmax(0,1fr))",

    gap:
      9,

    padding:
      14,
  },

  timelineCard: {
    padding:
      13,

    border:
      "1px solid #2b2b2b",

    borderRadius:
      11,

    background:
      "#141414",
  },

  timelineFinal: {
    border:
      "1px solid #4a3326",

    background:
      "#17130f",
  },

  timelineTop: {
    display:
      "flex",

    justifyContent:
      "space-between",

    gap:
      8,
  },

  timelineTitle: {
    margin:
      "4px 0",

    fontSize:
      12,
  },

  statusBadge: {
    alignSelf:
      "flex-start",

    padding:
      "4px 6px",

    borderRadius:
      999,

    color:
      "#777",

    background:
      "#222",

    fontSize:
      6,

    fontWeight:
      900,
  },

  finalBadge: {
    color:
      "#76d894",

    background:
      "#122117",
  },

  timelineCount: {
    display:
      "flex",

    gap:
      5,

    alignItems:
      "baseline",

    marginTop:
      9,
  },

  warningText: {
    margin:
      "7px 0 0",

    color:
      "#d68b52",

    fontSize:
      8,

    lineHeight:
      1.4,
  },

  teamGrid: {
    display:
      "grid",

    gridTemplateColumns:
      "repeat(2,minmax(0,1fr))",

    gap:
      12,

    padding:
      14,
  },

  teamCard: {
    overflow:
      "hidden",

    border:
      "1px solid #303030",

    borderRadius:
      14,

    background:
      "#141414",
  },

  myTeamCard: {
    boxShadow:
      "inset 3px 0 0 #e65c1a",
  },

  championTeamCard: {
    border:
      "1px solid #8a401c",

    background:
      "linear-gradient(135deg,#1d130e,#141414)",
  },

  teamHeader: {
    display:
      "flex",

    alignItems:
      "center",

    justifyContent:
      "space-between",

    gap:
      12,

    padding:
      14,

    borderBottom:
      "1px solid #272727",
  },

  teamTitleLine: {
    display:
      "flex",

    alignItems:
      "center",

    gap:
      6,

    flexWrap:
      "wrap",
  },

  crown: {
    fontSize:
      16,
  },

  teamName: {
    margin:
      0,

    fontSize:
      15,
  },

  teamMeta: {
    margin:
      "4px 0 0",

    color:
      "#696969",

    fontSize:
      8,
  },

  youBadge: {
    padding:
      "2px 5px",

    borderRadius:
      999,

    color:
      "#fff",

    background:
      "#df5919",

    fontSize:
      6,

    fontWeight:
      900,
  },

  teamAwardTotal: {
    textAlign:
      "right",
  },

  group: {
    padding:
      12,

    borderTop:
      "1px solid #222",
  },

  groupHeader: {
    display:
      "flex",

    alignItems:
      "center",

    justifyContent:
      "space-between",

    marginBottom:
      8,
  },

  groupTitle: {
    color:
      "#68d087",

    fontSize:
      7,

    fontWeight:
      900,

    letterSpacing:
      ".09em",
  },

  groupCount: {
    color:
      "#666",

    fontSize:
      8,
  },

  infamyText: {
    color:
      "#df7075",
  },

  groupList: {
    display:
      "grid",

    gap:
      6,
  },

  miniAward: {
    display:
      "flex",

    gap:
      9,

    padding:
      9,

    border:
      "1px solid #292929",

    borderRadius:
      9,

    background:
      "#111",
  },

  miniInfamy: {
    border:
      "1px solid #3e292c",

    background:
      "#151011",
  },

  miniEmoji: {
    fontSize:
      20,
  },

  miniBody: {
    minWidth:
      0,
  },

  miniTitle: {
    display:
      "block",

    fontSize:
      10,
  },

  miniRound: {
    display:
      "block",

    marginTop:
      2,

    color:
      "#666",

    fontSize:
      7,

    fontWeight:
      800,
  },

  miniDetail: {
    margin:
      "4px 0 0",

    color:
      "#707070",

    fontSize:
      8,

    lineHeight:
      1.4,
  },

  groupEmpty: {
    padding:
      "7px 2px",

    color:
      "#555",

    fontSize:
      8,
  },

  guideGrid: {
    display:
      "grid",

    gridTemplateColumns:
      "repeat(auto-fit,minmax(230px,1fr))",

    gap:
      9,

    padding:
      14,
  },

  guideItem: {
    display:
      "flex",

    gap:
      10,

    padding:
      12,

    border:
      "1px solid #292929",

    borderRadius:
      10,

    background:
      "#141414",
  },

  guideEmoji: {
    fontSize:
      22,
  },

  guideTitle: {
    display:
      "block",

    fontSize:
      10,
  },

  guideText: {
    margin:
      "4px 0 0",

    color:
      "#707070",

    fontSize:
      8,

    lineHeight:
      1.45,
  },

  empty: {
    margin:
      14,

    padding:
      25,

    border:
      "1px dashed #333",

    borderRadius:
      11,

    color:
      "#696969",

    textAlign:
      "center",

    fontSize:
      9,

    lineHeight:
      1.5,
  },

  careerHistoryIntro: {
    display:
      "flex",

    flexDirection:
      "column",

    gap:
      4,

    padding:
      "14px 18px",

    borderBottom:
      "1px solid #242424",

    color:
      "#8b8b8b",

    fontSize:
      9,

    lineHeight:
      1.5,
  },

  historyChampions: {
    padding:
      14,

    borderBottom:
      "1px solid #242424",
  },

  historyChampionTitle: {
    marginBottom:
      10,

    color:
      "#df5b1d",

    fontSize:
      8,

    fontWeight:
      900,

    letterSpacing:
      ".1em",
  },

  historyChampionGrid: {
    display:
      "grid",

    gridTemplateColumns:
      "repeat(auto-fit,minmax(240px,1fr))",

    gap:
      10,
  },

  historyChampionCard: {
    display:
      "flex",

    alignItems:
      "center",

    gap:
      12,

    padding:
      14,

    border:
      "1px solid #5a3520",

    borderRadius:
      12,

    background:
      "linear-gradient(135deg,#21140e,#151515)",
  },

  historyChampionSeason: {
    flex:
      "0 0 auto",

    minWidth:
      54,

    padding:
      "10px 8px",

    border:
      "1px solid #6d3b20",

    borderRadius:
      10,

    color:
      "#ff7a29",

    background:
      "#26160e",

    fontSize:
      17,

    fontWeight:
      900,

    textAlign:
      "center",
  },

  historyChampionName: {
    margin:
      "4px 0",

    fontSize:
      15,
  },

  historyChampionPoints: {
    color:
      "#aaa",

    fontSize:
      9,
  },

  historyRunner: {
    marginTop:
      5,

    color:
      "#777",

    fontSize:
      8,
  },

  historyPending: {
    padding:
      16,

    borderBottom:
      "1px solid #242424",

    color:
      "#6d6d6d",

    fontSize:
      9,
  },

  careerBlock: {
    padding:
      14,

    borderBottom:
      "1px solid #242424",
  },

  careerBlockHead: {
    display:
      "flex",

    alignItems:
      "center",

    justifyContent:
      "space-between",

    gap:
      12,

    marginBottom:
      12,
  },

  careerBlockTitle: {
    margin:
      "4px 0 0",

    fontSize:
      17,
  },

  careerStats: {
    display:
      "grid",

    gridTemplateColumns:
      "repeat(4,minmax(0,1fr))",

    gap:
      8,

    marginBottom:
      12,
  },

  careerStat: {
    padding:
      11,

    border:
      "1px solid #2b2b2b",

    borderRadius:
      10,

    background:
      "#151515",
  },

  careerStatValue: {
    display:
      "block",

    marginTop:
      4,

    color:
      "#fff",

    fontSize:
      18,
  },

  careerAwardGrid: {
    display:
      "grid",

    gridTemplateColumns:
      "repeat(2,minmax(0,1fr))",

    gap:
      9,
  },

  careerAwardCard: {
    display:
      "flex",

    gap:
      10,

    padding:
      12,

    border:
      "1px solid #303030",

    borderRadius:
      11,

    background:
      "#151515",
  },

  careerAwardEmoji: {
    flex:
      "0 0 auto",

    fontSize:
      24,
  },

  careerAwardBody: {
    minWidth:
      0,

    flex:
      1,
  },

  careerAwardName: {
    margin:
      "3px 0",

    color:
      "#eee",

    fontSize:
      12,
  },

  careerAwardMeta: {
    display:
      "flex",

    flexWrap:
      "wrap",

    gap:
      7,

    color:
      "#777",

    fontSize:
      8,
  },

  careerAwardDetail: {
    margin:
      "5px 0 0",

    color:
      "#6f6f6f",

    fontSize:
      8,

    lineHeight:
      1.4,
  },

  careerTeamGrid: {
    display:
      "grid",

    gridTemplateColumns:
      "repeat(2,minmax(0,1fr))",

    gap:
      10,
  },

  careerTeamCard: {
    overflow:
      "hidden",

    border:
      "1px solid #303030",

    borderRadius:
      13,

    background:
      "#141414",
  },

  careerTeamHeader: {
    display:
      "flex",

    alignItems:
      "center",

    justifyContent:
      "space-between",

    gap:
      12,

    padding:
      13,

    borderBottom:
      "1px solid #272727",
  },

  careerSeasonLine: {
    padding:
      "9px 12px",

    borderBottom:
      "1px solid #242424",

    color:
      "#777",

    fontSize:
      7,

    fontWeight:
      800,

    letterSpacing:
      ".05em",
  },

  careerMiniAwards: {
    display:
      "flex",

    flexWrap:
      "wrap",

    gap:
      6,

    padding:
      12,
  },

  careerMiniAward: {
    display:
      "inline-flex",

    alignItems:
      "center",

    gap:
      5,

    padding:
      "5px 7px",

    border:
      "1px solid #2d2d2d",

    borderRadius:
      999,

    color:
      "#929292",

    background:
      "#191919",

    fontSize:
      7,
  },

  note: {
    padding:
      13,

    border:
      "1px solid #292929",

    borderRadius:
      12,

    color:
      "#666",

    background:
      "#101010",

    fontSize:
      8,

    lineHeight:
      1.5,
  },
};
