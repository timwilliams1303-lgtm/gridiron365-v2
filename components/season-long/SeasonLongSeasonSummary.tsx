import Link from "next/link";
import type {
  CSSProperties,
} from "react";

import SeasonLongRenewButton from "@/components/season-long/SeasonLongRenewButton";

import {
  createSupabaseAdminClient,
} from "@/lib/supabase/admin";

import {
  requireLeagueMember,
} from "@/lib/leagues/requireLeagueMember";

type TeamRow = {
  id: number;
  team_name: string;
  active: boolean | null;
};

type StandingRow = {
  fantasy_team_id: number;
  total_points:
    number |
    string |
    null;
  weeks_scored:
    number |
    null;
  highest_week_score:
    number |
    string |
    null;
  lowest_week_score:
    number |
    string |
    null;
  average_week_score:
    number |
    string |
    null;
  current_rank:
    number |
    null;
};

type SettingsRow = {
  competition_format: "total_points" | "head_to_head" | null;
  regular_season_weeks: number | null;
  playoffs_enabled: boolean | null;
  playoff_team_count: number | null;
};

type H2HStandingRow = {
  fantasy_team_id: number;
  wins: number | null;
  losses: number | null;
  ties: number | null;
  points_for: number | string | null;
  points_against: number | string | null;
  current_rank: number | null;
};

type H2HMatchupRow = {
  week: number;
  matchup_type: string | null;
  is_final: boolean | null;
};

type PlayoffStateRow = {
  status: string | null;
  champion_fantasy_team_id: number | null;
};

type WeeklyScoreRow = {
  fantasy_team_id: number;
  week: number;
  fantasy_points:
    number |
    string |
    null;
  salary_used:
    number |
    string |
    null;
  is_final:
    boolean |
    null;
};


type LineupRow = {
  fantasy_team_id: number;
  player_id: number;
  week: number;
  nfl_game_id: number | null;
  salary_at_selection: number | string | null;
};

type PlayerScoreRow = {
  nfl_player_id: number;
  nfl_game_id: number | null;
  week: number;
  fantasy_points: number | string | null;
  is_final: boolean | null;
};

type NflPlayerRow = {
  id: number;
  full_name: string;
  primary_position: string | null;
};

type PlayerSeasonPerformance = {
  teamName: string;
  playerName: string;
  position: string;
  week: number;
  fantasyPoints: number;
  salary: number | null;
};

type TrophyRow = {
  fantasy_team_id: number;
  team_name: string;
  badge_key: string;
  badge_name: string;
  badge_category:
    "ACHIEVEMENT" |
    "INFAMY";
  badge_emoji: string;
  award_count:
    number |
    string;
  first_earned_week: number;
  last_earned_week: number;
  latest_detail:
    string |
    null;
};

type TeamSummary = {
  teamId: number;
  teamName: string;
  rank: number;
  totalPoints: number;
  weeksScored: number;
  highWeek: number;
  lowWeek: number;
  averageWeek: number;
  bestWeekNumber:
    number |
    null;
  bestWeekPoints: number;
  salaryEfficiency:
    number |
    null;
  trophyAwards: number;
  weeklyKings: number;
  wins: number;
  losses: number;
  ties: number;
  pointsAgainst: number;
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
  return n(
    value
  ).toFixed(
    2
  );
}

function money(
  value:
    number |
    string |
    null |
    undefined
) {
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
    n(
      value
    )
  );
}

function medal(
  rank: number
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

  return "🏈";
}

export type SeasonLongSeasonSummaryProps = {
  leagueId: string;
};

export default async function SeasonLongSeasonSummary({
  leagueId,
}: SeasonLongSeasonSummaryProps) {
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

  const supabase =
    createSupabaseAdminClient();

  const season =
    access.league.season;

  const isSalary =
    access.league
      .playerSelectionMode ===
    "salary";

  const [
    settingsResult,
    teamsResult,
    standingsResult,
    h2hStandingsResult,
    h2hMatchupsResult,
    playoffStateResult,
    scoresResult,
    lineupResult,
    playerScoresResult,
    nflPlayersResult,
    trophyResult,
    renewalResult,
  ] =
    await Promise.all([
      supabase
        .from(
          "season_long_settings"
        )
        .select("competition_format,regular_season_weeks,playoffs_enabled,playoff_team_count")
        .eq("league_id", leagueId)
        .maybeSingle(),

      supabase
        .from(
          "fantasy_teams"
        )
        .select(
          "id,team_name,active"
        )
        .eq(
          "league_id",
          leagueId
        )
        .eq(
          "active",
          true
        )
        .order(
          "team_name"
        ),

      supabase
        .from(
          "season_long_standings"
        )
        .select(`
          fantasy_team_id,
          total_points,
          weeks_scored,
          highest_week_score,
          lowest_week_score,
          average_week_score,
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

      supabase
        .from(
          "season_long_h2h_standings"
        )
        .select("fantasy_team_id,wins,losses,ties,points_for,points_against,current_rank")
        .eq("league_id", leagueId)
        .eq("season", season),

      supabase
        .from(
          "season_long_matchups"
        )
        .select("week,matchup_type,is_final")
        .eq("league_id", leagueId)
        .eq("season", season),

      supabase
        .from(
          "season_long_playoff_state"
        )
        .select("status,champion_fantasy_team_id")
        .eq("league_id", leagueId)
        .eq("season", season)
        .maybeSingle(),

      supabase
        .from(
          "season_long_weekly_scores"
        )
        .select(
          "fantasy_team_id,week,fantasy_points,salary_used,is_final"
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
          "week",
          {
            ascending:
              true,
          }
        ),

      supabase
        .from(
          "season_long_weekly_lineups"
        )
        .select(
          "fantasy_team_id,player_id,week,nfl_game_id,salary_at_selection"
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
          "fantasy_player_game_scores"
        )
        .select(
          "nfl_player_id,nfl_game_id,week,fantasy_points,is_final"
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
          2
        ),

      supabase
        .from(
          "nfl_players"
        )
        .select(
          "id,full_name,primary_position"
        ),

      supabase.rpc(
        "get_season_long_trophy_case",
        {
          p_league_id:
            leagueId,
          p_season:
            season,
        }
      ),

      supabase
        .from(
          "season_long_league_renewals"
        )
        .select(
          "target_league_id,target_season"
        )
        .eq(
          "source_league_id",
          leagueId
        )
        .eq(
          "target_season",
          season +
            1
        )
        .maybeSingle(),
    ]);

  if (settingsResult.error) {
    throw new Error(
      `Could not load Season-Long settings: ${settingsResult.error.message}`
    );
  }

  if (
    teamsResult.error
  ) {
    throw new Error(
      `Could not load teams: ${teamsResult.error.message}`
    );
  }

  if (
    standingsResult.error
  ) {
    throw new Error(
      `Could not load standings: ${standingsResult.error.message}`
    );
  }

  if (h2hStandingsResult.error) {
    throw new Error(
      `Could not load H2H standings: ${h2hStandingsResult.error.message}`
    );
  }

  if (h2hMatchupsResult.error) {
    throw new Error(
      `Could not load H2H matchups: ${h2hMatchupsResult.error.message}`
    );
  }

  if (playoffStateResult.error) {
    throw new Error(
      `Could not load playoff state: ${playoffStateResult.error.message}`
    );
  }

  if (
    scoresResult.error
  ) {
    throw new Error(
      `Could not load weekly scores: ${scoresResult.error.message}`
    );
  }

  if (
    lineupResult.error
  ) {
    throw new Error(
      `Could not load season lineups: ${lineupResult.error.message}`
    );
  }

  if (
    playerScoresResult.error
  ) {
    throw new Error(
      `Could not load player scores: ${playerScoresResult.error.message}`
    );
  }

  if (
    nflPlayersResult.error
  ) {
    throw new Error(
      `Could not load NFL players: ${nflPlayersResult.error.message}`
    );
  }

  if (
    trophyResult.error
  ) {
    throw new Error(
      `Could not load trophy case: ${trophyResult.error.message}`
    );
  }

  if (
    renewalResult.error
  ) {
    throw new Error(
      `Could not load league renewal status: ${renewalResult.error.message}`
    );
  }

  const leagueSettings =
    settingsResult.data as SettingsRow | null;

  const isH2H =
    leagueSettings?.competition_format === "head_to_head";

  const regularSeasonWeeks =
    Math.max(
      1,
      Number(
        leagueSettings?.regular_season_weeks ?? 18
      )
    );

  const h2hStandings =
    (h2hStandingsResult.data ?? []) as H2HStandingRow[];

  const h2hMatchups =
    (h2hMatchupsResult.data ?? []) as H2HMatchupRow[];

  const playoffState =
    playoffStateResult.data as PlayoffStateRow | null;

  const teams =
    (
      teamsResult.data ??
      []
    ) as TeamRow[];

  const standings =
    (
      standingsResult.data ??
      []
    ) as StandingRow[];

  const weeklyScores =
    (
      scoresResult.data ??
      []
    ) as WeeklyScoreRow[];

  const lineups =
    (
      lineupResult.data ??
      []
    ) as LineupRow[];

  const playerScores =
    (
      playerScoresResult.data ??
      []
    ) as PlayerScoreRow[];

  const nflPlayers =
    (
      nflPlayersResult.data ??
      []
    ) as NflPlayerRow[];

  const trophies =
    (
      trophyResult.data ??
      []
    ) as TrophyRow[];

  const standingMap =
    new Map(
      standings.map(
        (
          row
        ) => [
          row.fantasy_team_id,
          row,
        ]
      )
    );

  const h2hStandingMap =
    new Map(
      h2hStandings.map(
        (row) => [
          row.fantasy_team_id,
          row,
        ]
      )
    );

  const scoresByTeam =
    new Map<
      number,
      WeeklyScoreRow[]
    >();

  for (
    const row
    of weeklyScores
  ) {
    const list =
      scoresByTeam.get(
        row.fantasy_team_id
      ) ??
      [];

    list.push(
      row
    );

    scoresByTeam.set(
      row.fantasy_team_id,
      list
    );
  }

  let summaries:
    TeamSummary[] =
      teams.map(
        (
          team
        ) => {
          const standing =
            standingMap.get(
              team.id
            );

          const scores =
            scoresByTeam.get(
              team.id
            ) ??
            [];

          const finalScores =
            scores.filter(
              (
                score
              ) =>
                score.is_final ===
                true
            );

          const bestWeek =
            [
              ...finalScores,
            ].sort(
              (
                a,
                b
              ) =>
                n(
                  b.fantasy_points
                ) -
                n(
                  a.fantasy_points
                )
            )[0] ??
            null;

          const totalSalary =
            finalScores.reduce(
              (
                total,
                row
              ) =>
                total +
                n(
                  row.salary_used
                ),
              0
            );

          const h2hStanding =
            h2hStandingMap.get(
              team.id
            );

          const totalPoints =
            isH2H
              ? n(
                  h2hStanding?.points_for
                )
              : n(
                  standing?.total_points
                );

          const trophyRows =
            trophies.filter(
              (
                trophy
              ) =>
                trophy.fantasy_team_id ===
                team.id
            );

          const trophyAwards =
            trophyRows.reduce(
              (
                total,
                trophy
              ) =>
                total +
                n(
                  trophy.award_count
                ),
              0
            );

          const weeklyKings =
            trophyRows
              .filter(
                (
                  trophy
                ) =>
                  trophy.badge_key ===
                  "weekly_king"
              )
              .reduce(
                (
                  total,
                  trophy
                ) =>
                  total +
                  n(
                    trophy.award_count
                  ),
                0
              );

          return {
            teamId:
              team.id,

            teamName:
              team.team_name,

            rank:
              isH2H
                ? h2hStanding?.current_rank ?? 999
                : standing?.current_rank ?? 999,

            totalPoints,

            weeksScored:
              standing
                ?.weeks_scored ??
              0,

            highWeek:
              n(
                standing
                  ?.highest_week_score
              ),

            lowWeek:
              n(
                standing
                  ?.lowest_week_score
              ),

            averageWeek:
              n(
                standing
                  ?.average_week_score
              ),

            bestWeekNumber:
              bestWeek
                ?.week ??
              null,

            bestWeekPoints:
              n(
                bestWeek
                  ?.fantasy_points
              ),

            salaryEfficiency:
              isSalary &&
              totalSalary >
                0
                ? totalPoints /
                  totalSalary
                : null,

            trophyAwards,

            weeklyKings,

            wins: Number(
              h2hStanding?.wins ?? 0
            ),

            losses: Number(
              h2hStanding?.losses ?? 0
            ),

            ties: Number(
              h2hStanding?.ties ?? 0
            ),

            pointsAgainst: n(
              h2hStanding?.points_against
            ),
          };
        }
      );

  summaries =
    summaries.sort(
      (
        a,
        b
      ) =>
        a.rank -
          b.rank ||
        b.totalPoints -
          a.totalPoints ||
        a.teamName.localeCompare(
          b.teamName
        )
    );

  summaries.forEach(
    (
      summary,
      index
    ) => {
      if (
        summary.rank ===
        999
      ) {
        summary.rank =
          index +
          1;
      }
    }
  );

  const standingsLeader =
    summaries[0] ??
    null;

  const playoffChampion =
    isH2H &&
    playoffState?.champion_fantasy_team_id
      ? summaries.find(
          (summary) =>
            summary.teamId ===
            playoffState.champion_fantasy_team_id
        ) ?? null
      : null;

  const champion =
    playoffChampion ??
    standingsLeader;

  const biggestWeek =
    [
      ...summaries,
    ].sort(
      (
        a,
        b
      ) =>
        b.bestWeekPoints -
        a.bestWeekPoints
    )[0] ??
    null;

  const mostConsistent =
    summaries
      .filter(
        (
          summary
        ) =>
          summary.weeksScored >
          1
      )
      .sort(
        (
          a,
          b
        ) =>
          (
            a.highWeek -
            a.lowWeek
          ) -
          (
            b.highWeek -
            b.lowWeek
          )
      )[0] ??
    null;

  const weeklyKingLeader =
    [
      ...summaries,
    ].sort(
      (
        a,
        b
      ) =>
        b.weeklyKings -
          a.weeklyKings ||
        b.totalPoints -
          a.totalPoints
    )[0] ??
    null;

  const salaryMvp =
    isSalary
      ? [
          ...summaries,
        ]
          .filter(
            (
              summary
            ) =>
              summary.salaryEfficiency !==
              null
          )
          .sort(
            (
              a,
              b
            ) =>
              n(
                b.salaryEfficiency
              ) -
              n(
                a.salaryEfficiency
              )
          )[0] ??
        null
      : null;

  const teamNameById =
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

  const playerById =
    new Map(
      nflPlayers.map(
        (
          player
        ) => [
          player.id,
          player,
        ]
      )
    );

  const playerScoreMap =
    new Map<
      string,
      PlayerScoreRow
    >();

  for (
    const score
    of playerScores
  ) {
    const key =
      `${score.nfl_player_id}:${score.week}:${score.nfl_game_id ?? "null"}`;

    const existing =
      playerScoreMap.get(
        key
      );

    if (
      !existing ||
      n(
        score.fantasy_points
      ) >
        n(
          existing.fantasy_points
        )
    ) {
      playerScoreMap.set(
        key,
        score
      );
    }
  }

  const playerPerformances:
    PlayerSeasonPerformance[] =
      lineups
        .map(
          (
            lineup
          ) => {
            const player =
              playerById.get(
                lineup.player_id
              );

            const score =
              playerScoreMap.get(
                `${lineup.player_id}:${lineup.week}:${lineup.nfl_game_id ?? "null"}`
              );

            if (
              !player ||
              !score ||
              score.is_final !==
                true
            ) {
              return null;
            }

            return {
              teamName:
                teamNameById.get(
                  lineup.fantasy_team_id
                ) ??
                "Unknown Team",

              playerName:
                player.full_name,

              position:
                String(
                  player.primary_position ??
                  ""
                ).toUpperCase(),

              week:
                lineup.week,

              fantasyPoints:
                n(
                  score.fantasy_points
                ),

              salary:
                isSalary
                  ? n(
                      lineup.salary_at_selection
                    )
                  : null,
            } satisfies PlayerSeasonPerformance;
          }
        )
        .filter(
          (
            item
          ): item is PlayerSeasonPerformance =>
            item !==
            null
        );

  function bestAt(
    positions:
      string[]
  ) {
    return (
      playerPerformances
        .filter(
          (
            performance
          ) =>
            positions.includes(
              performance.position
            )
        )
        .sort(
          (
            a,
            b
          ) =>
            b.fantasyPoints -
            a.fantasyPoints
        )[0] ??
      null
    );
  }

  const positionAwards =
    [
      {
        label:
          "TOP QB",
        emoji:
          "🎯",
        performance:
          bestAt(
            [
              "QB",
            ]
          ),
      },
      {
        label:
          "TOP RB",
        emoji:
          "🚂",
        performance:
          bestAt(
            [
              "RB",
            ]
          ),
      },
      {
        label:
          "TOP WR",
        emoji:
          "✈️",
        performance:
          bestAt(
            [
              "WR",
            ]
          ),
      },
      {
        label:
          "TOP TE",
        emoji:
          "🧲",
        performance:
          bestAt(
            [
              "TE",
            ]
          ),
      },
      {
        label:
          "TOP K",
        emoji:
          "🥾",
        performance:
          bestAt(
            [
              "K",
              "PK",
            ]
          ),
      },
      {
        label:
          "TOP DST",
        emoji:
          "🛡️",
        performance:
          bestAt(
            [
              "DST",
            ]
          ),
      },
    ];

  const bestBargain =
    isSalary
      ? [
          ...playerPerformances,
        ]
          .filter(
            (
              performance
            ) =>
              n(
                performance.salary
              ) >
              0
          )
          .sort(
            (
              a,
              b
            ) =>
              (
                b.fantasyPoints /
                n(
                  b.salary
                )
              ) -
              (
                a.fantasyPoints /
                n(
                  a.salary
                )
              )
          )[0] ??
        null
      : null;

  const biggestDisappointment =
    isSalary
      ? [
          ...playerPerformances,
        ]
          .filter(
            (
              performance
            ) =>
              n(
                performance.salary
              ) >
              0
          )
          .sort(
            (
              a,
              b
            ) => {
              const aPain =
                n(
                  a.salary
                ) /
                Math.max(
                  a.fantasyPoints,
                  0.25
                );

              const bPain =
                n(
                  b.salary
                ) /
                Math.max(
                  b.fantasyPoints,
                  0.25
                );

              return (
                bPain -
                aPain
              );
            }
          )[0] ??
        null
      : null;

  const finalizedWeeks =
    new Set(
      weeklyScores
        .filter(
          (
            row
          ) =>
            row.is_final ===
            true
        )
        .map(
          (
            row
          ) =>
            row.week
        )
    );

  const maxFinalWeek =
    finalizedWeeks.size >
      0
      ? Math.max(
          ...Array.from(
            finalizedWeeks
          )
        )
      : 0;

  const finalWeekTeams =
    new Set(
      weeklyScores
        .filter(
          (row) =>
            row.week === regularSeasonWeeks &&
            row.is_final === true
        )
        .map(
          (row) =>
            row.fantasy_team_id
        )
    );

  const regularSeasonH2HMatchups =
    h2hMatchups.filter(
      (matchup) =>
        matchup.matchup_type === "regular_season" &&
        matchup.week <= regularSeasonWeeks
    );

  const h2hRegularSeasonComplete =
    regularSeasonH2HMatchups.length > 0 &&
    regularSeasonH2HMatchups.every(
      (matchup) =>
        matchup.is_final === true
    );

  const h2hPlayoffsEnabled =
    Boolean(
      leagueSettings?.playoffs_enabled
    );

  const seasonComplete =
    isH2H
      ? h2hPlayoffsEnabled
        ? playoffState?.status === "complete" &&
          Boolean(
            playoffState?.champion_fantasy_team_id
          )
        : h2hRegularSeasonComplete
      : teams.length > 0 &&
        finalWeekTeams.size === teams.length;

  const existingRenewal =
    renewalResult.data;

  if (
    !seasonComplete
  ) {
    return null;
  }

  return (
    <section
      style={{
        marginTop: 18,
      }}
    >
      <section
        style={
          styles.wrapCard
        }
      >
        <p
          style={
            styles.sectionEyebrow
          }
        >
          G365 SEASON SUMMARY
        </p>

        <h2
          style={
            styles.wrapTitle
          }
        >
          {season} Season Complete
        </h2>

        <p
          style={
            styles.wrapText
          }
        >
          The final standings, season awards, player performances and trophy case are now locked.
        </p>
      </section>

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
              styles.sectionEyebrow
            }
          >
            SEASON CHAMPION
          </p>

          <h2
            style={
              styles.championName
            }
          >
            {champion
              ?.teamName ??
              "No champion"}
          </h2>

          <p
            style={
              styles.championDetail
            }
          >
            {champion
              ? `${points(
                  champion.totalPoints
                )} total points · ${champion.weeksScored} weeks scored`
              : "—"}
          </p>
        </div>
      </section>

      <section
        style={
          styles.awardGrid
        }
      >
        <AwardCard
          emoji="🔥"
          label="BIGGEST WEEK"
          value={
            biggestWeek
              ?.teamName ??
            "—"
          }
          detail={
            biggestWeek
              ? `${points(
                  biggestWeek.bestWeekPoints
                )} pts · Week ${biggestWeek.bestWeekNumber ?? "—"}`
              : "—"
          }
        />

        <AwardCard
          emoji="🎯"
          label="MOST CONSISTENT"
          value={
            mostConsistent
              ?.teamName ??
            "—"
          }
          detail={
            mostConsistent
              ? `${points(
                  mostConsistent.highWeek -
                    mostConsistent.lowWeek
                )} pt high/low spread`
              : "—"
          }
        />

        <AwardCard
          emoji="👑"
          label="WEEKLY KING LEADER"
          value={
            weeklyKingLeader
              ?.teamName ??
            "—"
          }
          detail={
            weeklyKingLeader
              ? `${weeklyKingLeader.weeklyKings} Weekly King award${weeklyKingLeader.weeklyKings === 1 ? "" : "s"}`
              : "—"
          }
        />

        {isSalary ? (
          <AwardCard
            emoji="💰"
            label="VALUE MVP"
            value={
              salaryMvp
                ?.teamName ??
              "—"
            }
            detail={
              salaryMvp
                ?.salaryEfficiency !==
                null &&
              salaryMvp
                ?.salaryEfficiency !==
                undefined
                ? `${(
                    salaryMvp.salaryEfficiency *
                    1000
                  ).toFixed(
                    3
                  )} points per $1K`
                : "—"
            }
          />
        ) : null}
      </section>

      <section
        style={
          styles.card
        }
      >
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
              PLAYER AWARDS
            </p>

            <h2
              style={
                styles.sectionTitle
              }
            >
              Best Performances of the Season
            </h2>
          </div>
        </div>

        <div
          style={
            styles.awardGrid
          }
        >
          {positionAwards.map(
            (
              award
            ) => (
              <AwardCard
                key={
                  award.label
                }
                emoji={
                  award.emoji
                }
                label={
                  award.label
                }
                value={
                  award.performance
                    ?.playerName ??
                  "—"
                }
                detail={
                  award.performance
                    ? `${award.performance.teamName} · Week ${award.performance.week} · ${points(
                        award.performance.fantasyPoints
                      )} pts`
                    : "—"
                }
              />
            )
          )}

          {isSalary ? (
            <>
              <AwardCard
                emoji="💎"
                label="BEST BARGAIN"
                value={
                  bestBargain
                    ?.playerName ??
                  "—"
                }
                detail={
                  bestBargain
                    ? `${bestBargain.teamName} · Week ${bestBargain.week} · ${points(
                        bestBargain.fantasyPoints
                      )} pts at ${money(
                        bestBargain.salary
                      )}`
                    : "—"
                }
              />

              <AwardCard
                emoji="📉"
                label="BIGGEST DISAPPOINTMENT"
                value={
                  biggestDisappointment
                    ?.playerName ??
                  "—"
                }
                detail={
                  biggestDisappointment
                    ? `${biggestDisappointment.teamName} · Week ${biggestDisappointment.week} · ${points(
                        biggestDisappointment.fantasyPoints
                      )} pts at ${money(
                        biggestDisappointment.salary
                      )}`
                    : "—"
                }
              />
            </>
          ) : null}
        </div>
      </section>

      <section
        style={
          styles.card
        }
      >
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
              FINAL TABLE
            </p>

            <h2
              style={
                styles.sectionTitle
              }
            >
              {isH2H
                ? "Final H2H Standings"
                : "Final Standings"}
            </h2>
          </div>
        </div>

        <div
          style={
            styles.tableWrap
          }
        >
          <table
            style={
              styles.table
            }
          >
            <thead>
              <tr>
                <th style={styles.th}>Rank</th>
                <th style={styles.th}>Team</th>
                <th style={styles.thRight}>Total</th>
                <th style={styles.thRight}>Avg</th>
                <th style={styles.thRight}>Best</th>
                <th style={styles.thRight}>Low</th>
                <th style={styles.thRight}>Awards</th>
              </tr>
            </thead>

            <tbody>
              {summaries.map(
                (
                  team
                ) => (
                  <tr
                    key={
                      team.teamId
                    }
                  >
                    <td style={styles.td}>
                      <strong>
                        {medal(
                          team.rank
                        )}{" "}
                        #{team.rank}
                      </strong>
                    </td>

                    <td style={styles.td}>
                      {team.teamName}
                    </td>

                    <td style={styles.tdRight}>
                      <strong>
                        {points(
                          team.totalPoints
                        )}
                      </strong>
                    </td>

                    <td style={styles.tdRight}>
                      {points(
                        team.averageWeek
                      )}
                    </td>

                    <td style={styles.tdRight}>
                      {points(
                        team.highWeek
                      )}
                    </td>

                    <td style={styles.tdRight}>
                      {points(
                        team.lowWeek
                      )}
                    </td>

                    <td style={styles.tdRight}>
                      {team.trophyAwards}
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section
        style={
          styles.card
        }
      >
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
              TROPHY ROOM
            </p>

            <h2
              style={
                styles.sectionTitle
              }
            >
              Final Trophy Case
            </h2>
          </div>
        </div>

        <div
          style={
            styles.trophyGrid
          }
        >
          {summaries.map(
            (
              team
            ) => {
              const teamTrophies =
                trophies.filter(
                  (
                    trophy
                  ) =>
                    trophy.fantasy_team_id ===
                    team.teamId
                );

              return (
                <article
                  key={
                    team.teamId
                  }
                  style={
                    styles.trophyCard
                  }
                >
                  <div
                    style={
                      styles.trophyHeader
                    }
                  >
                    <strong>
                      {team.teamName}
                    </strong>

                    <span
                      style={
                        styles.countBadge
                      }
                    >
                      {team.trophyAwards} AWARDS
                    </span>
                  </div>

                  {teamTrophies.length >
                  0 ? (
                    <div
                      style={
                        styles.trophyList
                      }
                    >
                      {teamTrophies.map(
                        (
                          trophy
                        ) => (
                          <div
                            key={`${team.teamId}-${trophy.badge_key}`}
                            style={
                              styles.trophyRow
                            }
                          >
                            <span
                              style={
                                styles.trophyEmoji
                              }
                            >
                              {trophy.badge_emoji}
                            </span>

                            <div>
                              <strong>
                                {trophy.badge_name}
                              </strong>

                              <span
                                style={
                                  styles.trophyMeta
                                }
                              >
                                x{n(
                                  trophy.award_count
                                )} · Week {trophy.first_earned_week}
                                {trophy.first_earned_week !==
                                trophy.last_earned_week
                                  ? `–${trophy.last_earned_week}`
                                  : ""}
                              </span>
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  ) : (
                    <p
                      style={
                        styles.empty
                      }
                    >
                      No badges earned.
                    </p>
                  )}
                </article>
              );
            }
          )}
        </div>
      </section>

      {access.isCommissioner ? (
        <section
          style={
            styles.wrapCard
          }
        >
          <p
            style={
              styles.sectionEyebrow
            }
          >
            COMMISSIONER
          </p>

          <h2
            style={
              styles.wrapTitle
            }
          >
            Renew League
          </h2>

          <p
            style={
              styles.wrapText
            }
          >
            Carry forward league settings, scoring, members and team names. Weekly lineups, scores, standings, salaries and trophies start fresh.
          </p>

          <div
            style={
              styles.renewBox
            }
          >
            {existingRenewal ? (
              <Link
                href={`/league/${existingRenewal.target_league_id}`}
                style={
                  styles.renewLink
                }
              >
                OPEN {existingRenewal.target_season} LEAGUE
              </Link>
            ) : (
              <SeasonLongRenewButton
                leagueId={
                  leagueId
                }
                nextSeason={
                  season +
                  1
                }
              />
            )}
          </div>
        </section>
      ) : null}
    </section>
  );
}

function AwardCard({
  emoji,
  label,
  value,
  detail,
}: {
  emoji: string;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article
      style={
        styles.awardCard
      }
    >
      <div
        style={
          styles.awardEmoji
        }
      >
        {emoji}
      </div>

      <span
        style={
          styles.awardLabel
        }
      >
        {label}
      </span>

      <strong
        style={
          styles.awardValue
        }
      >
        {value}
      </strong>

      <span
        style={
          styles.awardDetail
        }
      >
        {detail}
      </span>
    </article>
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
      background:
        "#080808",
      color:
        "#fff",
      padding:
        "28px 16px 60px",
    },

    shell: {
      width:
        "min(1240px,100%)",
      margin:
        "0 auto",
    },

    hero: {
      display:
        "flex",
      justifyContent:
        "space-between",
      alignItems:
        "flex-end",
      gap:
        20,
      flexWrap:
        "wrap",
      padding:
        26,
      border:
        "1px solid #2c2c2c",
      borderRadius:
        22,
      background:
        "radial-gradient(circle at top right,#371307 0,transparent 34%),linear-gradient(135deg,#191919,#0e0e0e 72%)",
    },

    eyebrow: {
      margin:
        0,
      color:
        "#ff6a1a",
      fontWeight:
        950,
      fontSize:
        11,
      letterSpacing:
        2,
    },

    title: {
      margin:
        "8px 0 5px",
      fontSize:
        "clamp(32px,5vw,54px)",
      lineHeight:
        0.98,
    },

    subtitle: {
      margin:
        0,
      color:
        "#aaa",
      fontWeight:
        700,
    },

    actions: {
      display:
        "flex",
      gap:
        10,
      flexWrap:
        "wrap",
    },

    secondaryButton: {
      display:
        "inline-flex",
      alignItems:
        "center",
      minHeight:
        42,
      padding:
        "0 15px",
      borderRadius:
        10,
      border:
        "1px solid #3a3a3a",
      background:
        "#1b1b1b",
      color:
        "#fff",
      textDecoration:
        "none",
      fontSize:
        11,
      fontWeight:
        900,
    },

    championCard: {
      marginTop:
        16,
      display:
        "flex",
      alignItems:
        "center",
      gap:
        18,
      padding:
        24,
      border:
        "1px solid #683519",
      borderRadius:
        18,
      background:
        "linear-gradient(135deg,#24130c,#111 70%)",
    },

    championIcon: {
      fontSize:
        48,
    },

    sectionEyebrow: {
      margin:
        0,
      color:
        "#e34b20",
      fontSize:
        10,
      fontWeight:
        950,
      letterSpacing:
        1.6,
    },

    championName: {
      margin:
        "4px 0",
      fontSize:
        "clamp(26px,4vw,42px)",
    },

    championDetail: {
      margin:
        0,
      color:
        "#aaa",
      fontSize:
        13,
    },

    awardGrid: {
      display:
        "grid",
      gridTemplateColumns:
        "repeat(auto-fit,minmax(220px,1fr))",
      gap:
        12,
      marginTop:
        16,
    },

    awardCard: {
      minHeight:
        150,
      padding:
        18,
      border:
        "1px solid #303030",
      borderRadius:
        16,
      background:
        "linear-gradient(145deg,#171717,#0e0e0e)",
    },

    awardEmoji: {
      fontSize:
        28,
      marginBottom:
        9,
    },

    awardLabel: {
      display:
        "block",
      color:
        "#e34b20",
      fontSize:
        9,
      fontWeight:
        950,
      letterSpacing:
        1.3,
    },

    awardValue: {
      display:
        "block",
      marginTop:
        7,
      fontSize:
        19,
    },

    awardDetail: {
      display:
        "block",
      marginTop:
        5,
      color:
        "#919191",
      fontSize:
        11,
    },

    card: {
      marginTop:
        16,
      padding:
        22,
      borderRadius:
        18,
      border:
        "1px solid #292929",
      background:
        "#111",
    },

    sectionHead: {
      display:
        "flex",
      justifyContent:
        "space-between",
      alignItems:
        "center",
      gap:
        12,
      flexWrap:
        "wrap",
    },

    sectionTitle: {
      margin:
        "5px 0 15px",
      fontSize:
        24,
    },

    tableWrap: {
      overflowX:
        "auto",
    },

    table: {
      width:
        "100%",
      minWidth:
        760,
      borderCollapse:
        "collapse",
    },

    th: {
      padding:
        "10px 8px",
      textAlign:
        "left",
      borderBottom:
        "1px solid #333",
      color:
        "#777",
      fontSize:
        9,
      letterSpacing:
        1.2,
    },

    thRight: {
      padding:
        "10px 8px",
      textAlign:
        "right",
      borderBottom:
        "1px solid #333",
      color:
        "#777",
      fontSize:
        9,
      letterSpacing:
        1.2,
    },

    td: {
      padding:
        "13px 8px",
      borderBottom:
        "1px solid #232323",
      fontSize:
        12,
    },

    tdRight: {
      padding:
        "13px 8px",
      borderBottom:
        "1px solid #232323",
      textAlign:
        "right",
      fontSize:
        12,
    },

    trophyGrid: {
      display:
        "grid",
      gridTemplateColumns:
        "repeat(auto-fit,minmax(280px,1fr))",
      gap:
        12,
    },

    trophyCard: {
      padding:
        15,
      borderRadius:
        14,
      border:
        "1px solid #31271f",
      background:
        "#0d0d0d",
    },

    trophyHeader: {
      display:
        "flex",
      justifyContent:
        "space-between",
      alignItems:
        "center",
      gap:
        10,
      paddingBottom:
        10,
      borderBottom:
        "1px solid #242424",
    },

    countBadge: {
      padding:
        "5px 8px",
      borderRadius:
        999,
      background:
        "#24130d",
      border:
        "1px solid #62301a",
      color:
        "#ff9a68",
      fontSize:
        9,
      fontWeight:
        950,
    },

    trophyList: {
      display:
        "grid",
      gap:
        7,
      marginTop:
        10,
    },

    trophyRow: {
      display:
        "flex",
      gap:
        9,
      alignItems:
        "center",
      padding:
        "8px 0",
    },

    trophyEmoji: {
      fontSize:
        22,
    },

    trophyMeta: {
      display:
        "block",
      color:
        "#777",
      fontSize:
        10,
      marginTop:
        2,
    },

    empty: {
      color:
        "#777",
      fontSize:
        11,
    },

    wrapCard: {
      marginTop:
        16,
      padding:
        "28px 24px",
      border:
        "1px solid #5b2f19",
      borderRadius:
        20,
      background:
        "radial-gradient(circle at 80% 20%,rgba(240,99,29,.16),transparent 30%),linear-gradient(135deg,#17100c,#0c0c0c)",
    },

    wrapTitle: {
      margin:
        "6px 0",
      fontSize:
        "clamp(28px,4vw,44px)",
    },

    wrapText: {
      margin:
        0,
      maxWidth:
        760,
      color:
        "#aaa",
      lineHeight:
        1.6,
      fontSize:
        13,
    },

    renewBox: {
      marginTop:
        22,
      paddingTop:
        18,
      borderTop:
        "1px solid #3a281f",
      display:
        "flex",
      justifyContent:
        "space-between",
      gap:
        18,
      alignItems:
        "center",
      flexWrap:
        "wrap",
    },

    renewTitle: {
      fontSize:
        17,
    },

    renewText: {
      margin:
        "5px 0 0",
      maxWidth:
        760,
      color:
        "#8f8f8f",
      fontSize:
        11,
      lineHeight:
        1.5,
    },

    renewLink: {
      minHeight:
        46,
      padding:
        "0 18px",
      display:
        "inline-flex",
      alignItems:
        "center",
      borderRadius:
        12,
      border:
        "1px solid #e85c1b",
      background:
        "linear-gradient(90deg,#a61919,#f0631d)",
      color:
        "#fff",
      textDecoration:
        "none",
      fontWeight:
        950,
      fontSize:
        11,
    },
  };