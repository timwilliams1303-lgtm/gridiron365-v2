import Link from "next/link";
import type { CSSProperties } from "react";

import SeasonLongSeasonSummary from "@/components/season-long/SeasonLongSeasonSummary";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireLeagueMember } from "@/lib/leagues/requireLeagueMember";
import {
  getSeasonLongTeamLiveLineupData,
  type SeasonLongTeamLiveLineupData,
  type SeasonLongLiveLineupPlayer,
} from "@/lib/season-long/team-live-lineup.service";

type TeamRow = {
  id: number;
  team_name: string;
  active: boolean | null;
};

type WeeklyScoreRow = {
  fantasy_team_id: number;
  week: number;
  fantasy_points: number | string | null;
  salary_used: number | string | null;
  lineup_player_count: number | null;
  is_final: boolean | null;
};

type StandingRow = {
  fantasy_team_id: number;
  total_points: number | string | null;
  weeks_scored: number | null;
  current_rank: number | null;
};

type SeasonLongSettingsRow = {
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
  current_rank:
    number |
    null;
};

type H2HMatchupRow = {
  id: number;
  week: number;
  home_fantasy_team_id: number;
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
  is_final:
    boolean |
    null;
  winner_fantasy_team_id:
    number |
    null;
  is_tie:
    boolean |
    null;
  matchup_type:
    string |
    null;
  playoff_round:
    number |
    null;
};

type WeekBadgeRow = {
  fantasy_team_id: number;
  team_name: string;
  badge_key: string;
  badge_name: string;
  badge_category: "ACHIEVEMENT" | "INFAMY";
  badge_emoji: string;
  detail: string;
  nfl_player_id: number | null;
  player_name: string | null;
  metric_value: number | string | null;
  awarded_at: string;
};

type TrophyRow = {
  fantasy_team_id: number;
  team_name: string;
  badge_key: string;
  badge_name: string;
  badge_category: "ACHIEVEMENT" | "INFAMY";
  badge_emoji: string;
  award_count: number | string;
  first_earned_week: number;
  last_earned_week: number;
  latest_detail: string | null;
};

type TeamRecap = {
  teamId: number;
  teamName: string;
  weekPoints: number;
  projectedPoints: number;
  seasonPoints: number;
  seasonRank: number | null;
  wins: number;
  losses: number;
  ties: number;
  pointsAgainst: number;
  salaryUsed: number | null;
  lineup: SeasonLongTeamLiveLineupData;
  badges: WeekBadgeRow[];
};

const POSITION_ORDER = [
  "QB",
  "RB",
  "WR",
  "TE",
  "FLEX",
  "SUPERFLEX",
  "K",
  "DST",
];

function n(
  value:
    | number
    | string
    | null
    | undefined
) {
  const parsed =
    Number(value ?? 0);

  return Number.isFinite(parsed)
    ? parsed
    : 0;
}

function points(
  value:
    | number
    | string
    | null
    | undefined
) {
  return n(value).toFixed(2);
}

function money(
  value:
    | number
    | string
    | null
    | undefined
) {
  return new Intl.NumberFormat(
    "en-US",
    {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }
  ).format(
    n(value)
  );
}

function playerLabel(
  player:
    SeasonLongLiveLineupPlayer
) {
  const jersey =
    player.jerseyNumber
      ? ` #${player.jerseyNumber}`
      : "";

  return `${player.fullName} · ${player.position}${jersey}`;
}

function bestPlayer(
  teams:
    TeamRecap[],
  positions:
    string[]
) {
  return (
    teams
      .flatMap(
        (
          team
        ) =>
          team.lineup.players.map(
            (
              player
            ) => ({
              team,
              player,
            })
          )
      )
      .filter(
        ({
          player,
        }) =>
          positions.includes(
            player.position
          ) ||
          positions.includes(
            player.lineupSlot
          )
      )
      .sort(
        (
          a,
          b
        ) =>
          b.player
            .fantasyPoints -
          a.player
            .fantasyPoints
      )[0] ??
    null
  );
}

function statLine(
  player:
    SeasonLongLiveLineupPlayer
) {
  const s =
    player.stats;

  const pos =
    player.position;

  if (pos === "QB") {
    return `${s.passingCompletions}/${s.passingAttempts} CMP · ${s.passingYards} PASS YDS · ${s.passingTouchdowns} PASS TD · ${s.passingInterceptions} INT · ${s.rushingYards} RUSH YDS`;
  }

  if (pos === "RB") {
    return `${s.rushingAttempts} CAR · ${s.rushingYards} RUSH YDS · ${s.rushingTouchdowns} RUSH TD · ${s.receptions}/${s.receivingTargets} REC/TGT · ${s.receivingYards} REC YDS`;
  }

  if (
    pos === "WR" ||
    pos === "TE"
  ) {
    return `${s.receptions}/${s.receivingTargets} REC/TGT · ${s.receivingYards} REC YDS · ${s.receivingTouchdowns} REC TD · ${s.rushingYards} RUSH YDS`;
  }

  if (pos === "K") {
    return `${s.fieldGoalsMade}/${s.fieldGoalsAttempted} FG · ${s.extraPointsMade}/${s.extraPointsAttempted} XP`;
  }

  if (pos === "DST") {
    return `${s.dstSacks} SACK · ${s.dstInterceptions} INT · ${s.dstFumbleRecoveries} FR · ${s.dstTouchdowns} TD · ${s.dstSafeties} SAF · ${s.dstBlockedKicks} BLK · ${s.dstPointsAllowed} PA · ${s.dstYardsAllowed} YA · ${s.defensiveTotalTackles} TKL · ${s.defensiveTacklesForLoss} TFL`;
  }

  return "Final stat line unavailable";
}

export type SeasonLongRecapProps = {
  leagueId: string;
  requestedWeek?: string;
};

export default async function SeasonLongRecap({
  leagueId,
  requestedWeek,
}: SeasonLongRecapProps) {
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

  const leagueSettings =
    settingsData as
      SeasonLongSettingsRow |
      null;

  const isH2H =
    leagueSettings
      ?.competition_format ===
    "head_to_head";

  const activeWeekResult =
    await supabase.rpc(
      "get_active_season_long_week",
      {
        p_league_id:
          leagueId,
      }
    );

  const activeWeekRaw =
    Number(
      activeWeekResult.data ??
        1
    );

  const activeWeek =
    Number.isInteger(
      activeWeekRaw
    ) &&
    activeWeekRaw > 0
      ? activeWeekRaw
      : 1;

  const requestedWeekNumber =
    Number(
      requestedWeek ??
        activeWeek
    );

  const week =
    Number.isInteger(
      requestedWeekNumber
    ) &&
    requestedWeekNumber >
      0 &&
    requestedWeekNumber <=
      18
      ? requestedWeekNumber
      : activeWeek;

  const [
    teamsResult,
    scoresResult,
    standingsResult,
    h2hStandingsResult,
    h2hMatchupsResult,
    weekBadgesResult,
    trophyResult,
  ] =
    await Promise.all([
      supabase
        .from(
          "fantasy_teams"
        )
        .select(
          "id, team_name, active"
        )
        .eq(
          "league_id",
          leagueId
        )
        .eq(
          "active",
          true
        )
        .order("id"),

      supabase
        .from(
          "season_long_weekly_scores"
        )
        .select(
          "fantasy_team_id, week, fantasy_points, salary_used, lineup_player_count, is_final"
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
          "week",
          week
        ),

      supabase
        .from(
          "season_long_standings"
        )
        .select(
          "fantasy_team_id, total_points, weeks_scored, current_rank"
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
          "season_long_h2h_standings"
        )
        .select(`
          fantasy_team_id,
          wins,
          losses,
          ties,
          points_for,
          points_against,
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
          "season_long_matchups"
        )
        .select(`
          id,
          week,
          home_fantasy_team_id,
          away_fantasy_team_id,
          home_points,
          away_points,
          is_final,
          winner_fantasy_team_id,
          is_tie,
          matchup_type,
          playoff_round
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
          week
        )
        .order(
          "id",
          {
            ascending: true,
          }
        ),

      supabase.rpc(
        "get_season_long_week_badges",
        {
          p_league_id:
            leagueId,
          p_season:
            season,
          p_week:
            week,
        }
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
    ]);

  if (
    teamsResult.error
  ) {
    throw new Error(
      `Could not load teams: ${teamsResult.error.message}`
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
    standingsResult.error
  ) {
    throw new Error(
      `Could not load standings: ${standingsResult.error.message}`
    );
  }

  if (
    h2hStandingsResult.error
  ) {
    throw new Error(
      `Could not load H2H standings: ${h2hStandingsResult.error.message}`
    );
  }

  if (
    h2hMatchupsResult.error
  ) {
    throw new Error(
      `Could not load H2H matchups: ${h2hMatchupsResult.error.message}`
    );
  }

  if (
    weekBadgesResult.error
  ) {
    throw new Error(
      `Could not load weekly badges: ${weekBadgesResult.error.message}`
    );
  }

  if (
    trophyResult.error
  ) {
    throw new Error(
      `Could not load trophy case: ${trophyResult.error.message}`
    );
  }

  const teams =
    (
      teamsResult.data ??
      []
    ) as TeamRow[];

  const weeklyScores =
    (
      scoresResult.data ??
      []
    ) as WeeklyScoreRow[];

  const standings =
    (
      standingsResult.data ??
      []
    ) as StandingRow[];

  const h2hStandings =
    (
      h2hStandingsResult.data ??
      []
    ) as H2HStandingRow[];

  const h2hMatchups =
    (
      h2hMatchupsResult.data ??
      []
    ) as H2HMatchupRow[];

  const weekBadges =
    (
      weekBadgesResult.data ??
      []
    ) as WeekBadgeRow[];

  const trophyRows =
    (
      trophyResult.data ??
      []
    ) as TrophyRow[];

  const scoreMap =
    new Map(
      weeklyScores.map(
        (
          row
        ) => [
          row.fantasy_team_id,
          row,
        ]
      )
    );

  const standingsMap =
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

  const h2hStandingsMap =
    new Map(
      h2hStandings.map(
        (
          row
        ) => [
          row.fantasy_team_id,
          row,
        ]
      )
    );

  const teamNameMap =
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

  const badgesByTeam =
    new Map<
      number,
      WeekBadgeRow[]
    >();

  for (
    const badge
    of weekBadges
  ) {
    const current =
      badgesByTeam.get(
        badge.fantasy_team_id
      ) ?? [];

    current.push(
      badge
    );

    badgesByTeam.set(
      badge.fantasy_team_id,
      current
    );
  }

  const lineupData =
    await Promise.all(
      teams.map(
        (
          team
        ) =>
          getSeasonLongTeamLiveLineupData(
            supabase,
            {
              leagueId,

              fantasyTeamId:
                team.id,

              viewerFantasyTeamId:
                access
                  .fantasyTeam
                  ?.id ??
                null,

              season,
              week,

              selectionMode:
                isSalary
                  ? "salary"
                  : "no_salary",

              activeWeek,
            }
          )
      )
    );

  let recaps:
    TeamRecap[] =
      teams.map(
        (
          team,
          index
        ) => {
          const score =
            scoreMap.get(
              team.id
            );

          const standing =
            standingsMap.get(
              team.id
            );

          return {
            teamId:
              team.id,

            teamName:
              team.team_name,

            weekPoints:
              n(
                score
                  ?.fantasy_points ??
                  lineupData[
                    index
                  ]
                    ?.weekPoints
              ),

            projectedPoints:
              n(
                lineupData[
                  index
                ]
                  ?.projectedPoints
              ),

            seasonPoints:
              isH2H
                ? n(
                    h2hStandingsMap.get(
                      team.id
                    )?.points_for
                  )
                : n(
                    standing
                      ?.total_points
                  ),

            seasonRank:
              isH2H
                ? h2hStandingsMap.get(
                    team.id
                  )?.current_rank ??
                  null
                : standing
                    ?.current_rank ??
                  null,

            wins:
              Number(
                h2hStandingsMap.get(
                  team.id
                )?.wins ??
                0
              ),

            losses:
              Number(
                h2hStandingsMap.get(
                  team.id
                )?.losses ??
                0
              ),

            ties:
              Number(
                h2hStandingsMap.get(
                  team.id
                )?.ties ??
                0
              ),

            pointsAgainst:
              n(
                h2hStandingsMap.get(
                  team.id
                )?.points_against
              ),

            salaryUsed:
              isSalary
                ? n(
                    score
                      ?.salary_used ??
                      lineupData[
                        index
                      ]
                        ?.salaryUsed
                  )
                : null,

            lineup:
              lineupData[
                index
              ],

            badges:
              badgesByTeam.get(
                team.id
              ) ??
              [],
          };
        }
      );

  recaps =
    recaps.sort(
      (
        a,
        b
      ) =>
        b.weekPoints -
          a.weekPoints ||
        a.teamName.localeCompare(
          b.teamName
        )
    );

  /*
   * A recap is FINAL only when every active
   * Season-Long team has a final weekly score row.
   *
   * This matches the permanent badge generator.
   */
  const isFinal =
    isH2H
      ? h2hMatchups.length >
          0 &&
        h2hMatchups.every(
          (
            matchup
          ) =>
            matchup.is_final ===
            true
        )
      : teams.length >
          0 &&
        weeklyScores.length ===
          teams.length &&
        weeklyScores.every(
          (
            row
          ) =>
            row.is_final ===
            true
        );

  const champion =
    recaps[0] ??
    null;

  const topPlayer =
    bestPlayer(
      recaps,
      [
        "QB",
        "RB",
        "WR",
        "TE",
        "K",
        "DST",
      ]
    );

  const weeks =
    Array.from(
      {
        length: 18,
      },
      (
        _,
        index
      ) =>
        index + 1
    );

  const trophyTeams =
    teams
      .map(
        (
          team
        ) => ({
          teamId:
            team.id,

          teamName:
            team.team_name,

          badges:
            trophyRows.filter(
              (
                badge
              ) =>
                badge.fantasy_team_id ===
                team.id
            ),
        })
      )
      .filter(
        (
          team
        ) =>
          team.badges
            .length >
          0
      );

  const totalTrophyAwards =
    trophyRows.reduce(
      (
        total,
        badge
      ) =>
        total +
        n(
          badge.award_count
        ),
      0
    );

  return (
    <main
      className="g365-season-long-mobile"
      style={
        styles.page
      }
    >

      <style>{`
        .g365-season-long-mobile,
        .g365-season-long-mobile * {
          box-sizing: border-box;
        }

        @media (max-width: 760px) {
          .g365-season-long-mobile {
            width: 100% !important;
            max-width: 100% !important;
            min-width: 0 !important;
            padding-left: 12px !important;
            padding-right: 12px !important;
            overflow-x: hidden !important;
          }

          .g365-season-long-mobile section,
          .g365-season-long-mobile article,
          .g365-season-long-mobile header,
          .g365-season-long-mobile form,
          .g365-season-long-mobile div {
            min-width: 0;
            max-width: 100%;
          }

          .g365-season-long-mobile h1 {
            font-size: clamp(27px, 8vw, 36px) !important;
            line-height: 1.08 !important;
            overflow-wrap: anywhere;
          }

          .g365-season-long-mobile h2,
          .g365-season-long-mobile h3,
          .g365-season-long-mobile p,
          .g365-season-long-mobile span,
          .g365-season-long-mobile strong {
            overflow-wrap: anywhere;
          }

          .g365-season-long-mobile input,
          .g365-season-long-mobile select,
          .g365-season-long-mobile textarea {
            width: 100% !important;
            max-width: 100% !important;
            min-width: 0 !important;
            font-size: 16px !important;
          }

          .g365-season-long-mobile button,
          .g365-season-long-mobile a {
            max-width: 100%;
          }

          .g365-season-long-mobile :not(button)[style*="grid-template-columns"] {
            grid-template-columns: minmax(0, 1fr) !important;
          }

          .g365-season-long-mobile [style*="white-space: nowrap"],
          .g365-season-long-mobile [style*="white-space:nowrap"] {
            white-space: normal !important;
          }

          .g365-season-long-mobile [style*="overflow-x: auto"],
          .g365-season-long-mobile [style*="overflowX: auto"] {
            max-width: 100%;
            -webkit-overflow-scrolling: touch;
          }
        }

        @media (max-width: 430px) {
          .g365-season-long-mobile {
            padding-left: 10px !important;
            padding-right: 10px !important;
          }

          .g365-season-long-mobile button {
            min-height: 42px;
          }

          .g365-h2h-recap-matchups {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>

      <section
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
            <p
              style={
                styles.eyebrow
              }
            >
              G365
              RECAP
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
              Week {week}
              {" · "}
              {isSalary
                ? "Salary Cap"
                : "No Salary Cap"}
              {" · "}
              {isH2H
                ? "Head-to-Head"
                : "Total Points"}
            </p>
          </div>

          <div
            style={
              styles.actions
            }
          >
            <Link
              href={`/league/${leagueId}`}
              style={
                styles.secondaryButton
              }
            >
              LEAGUE HOME
            </Link>

            <Link
              href={`/league/${leagueId}/season-long/settings`}
              style={
                styles.secondaryButton
              }
            >
              SETTINGS
            </Link>
          </div>
        </header>

        <div
          style={
            styles.weekBar
          }
        >
          <span
            style={
              styles.weekLabel
            }
          >
            WEEK
          </span>

          <div
            style={
              styles.weekLinks
            }
          >
            {weeks.map(
              (
                item
              ) => (
                <Link
                  key={
                    item
                  }
                  href={`/league/${leagueId}/season-long/recap?week=${item}`}
                  style={{
                    ...styles.weekButton,

                    ...(item ===
                    week
                      ? styles.weekButtonActive
                      : {}),
                  }}
                >
                  {item}
                </Link>
              )
            )}
          </div>
        </div>

        <section
          style={
            styles.spotlightGrid
          }
        >
          <Spotlight
            eyebrow={
              isFinal
                ? "WEEKLY CHAMPION"
                : "CURRENT LEADER"
            }
            value={
              champion
                ?.teamName ??
              "No scores yet"
            }
            detail={
              champion
                ? `${points(
                    champion.weekPoints
                  )} points`
                : "—"
            }
            emoji="🏆"
          />

          <Spotlight
            eyebrow={
              isFinal
                ? "PLAYER OF THE WEEK"
                : "TOP PLAYER"
            }
            value={
              topPlayer
                ?.player
                .fullName ??
              "No player scores yet"
            }
            detail={
              topPlayer
                ? `${topPlayer.player.position} · ${points(
                    topPlayer
                      .player
                      .fantasyPoints
                  )} pts`
                : "—"
            }
            emoji="⭐"
          />

          <Spotlight
            eyebrow="RECAP STATUS"
            value={
              isFinal
                ? "FINAL"
                : "IN PROGRESS"
            }
            detail={
              isFinal
                ? "Permanent awards are locked into the trophy case"
                : "Awards lock after every active team is final"
            }
            emoji={
              isFinal
                ? "🔒"
                : "🔥"
            }
          />
        </section>

        {isFinal ? (
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
                  WEEK {week}
                  {" "}
                  HONORS
                </p>

                <h2
                  style={
                    styles.sectionTitle
                  }
                >
                  Badges
                  Earned
                </h2>
              </div>

              <span
                style={
                  styles.countBadge
                }
              >
                {
                  weekBadges.length
                }{" "}
                AWARDS
              </span>
            </div>

            {weekBadges.length >
            0 ? (
              <div
                style={
                  styles.badgeGrid
                }
              >
                {weekBadges.map(
                  (
                    badge,
                    index
                  ) => (
                    <article
                      key={`${badge.fantasy_team_id}-${badge.badge_key}-${index}`}
                      style={{
                        ...styles.badgeCard,

                        ...(badge.badge_category ===
                        "INFAMY"
                          ? styles.infamyCard
                          : {}),
                      }}
                    >
                      <div
                        style={
                          styles.badgeEmoji
                        }
                      >
                        {
                          badge.badge_emoji
                        }
                      </div>

                      <div>
                        <span
                          style={
                            styles.badgeCategory
                          }
                        >
                          {
                            badge.badge_category
                          }
                        </span>

                        <h3
                          style={
                            styles.badgeName
                          }
                        >
                          {
                            badge.badge_name
                          }
                        </h3>

                        <strong
                          style={
                            styles.badgeTeam
                          }
                        >
                          {
                            badge.team_name
                          }
                        </strong>

                        <p
                          style={
                            styles.badgeDetail
                          }
                        >
                          {
                            badge.detail
                          }
                        </p>
                      </div>
                    </article>
                  )
                )}
              </div>
            ) : (
              <EmptyState
                text="The week is final, but no permanent badge rows were found. Run the badge backfill once for this already-final week."
              />
            )}
          </section>
        ) : null}

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
                SEASON
                TROPHY CASE
              </p>

              <h2
                style={
                  styles.sectionTitle
                }
              >
                Earned
                Badges
              </h2>
            </div>

            <span
              style={
                styles.countBadge
              }
            >
              {
                totalTrophyAwards
              }{" "}
              TOTAL AWARDS
            </span>
          </div>

          {trophyTeams.length >
          0 ? (
            <div
              style={
                styles.trophyGrid
              }
            >
              {trophyTeams.map(
                (
                  team
                ) => {
                  const achievements =
                    team.badges.filter(
                      (
                        badge
                      ) =>
                        badge.badge_category ===
                        "ACHIEVEMENT"
                    );

                  const infamy =
                    team.badges.filter(
                      (
                        badge
                      ) =>
                        badge.badge_category ===
                        "INFAMY"
                    );

                  const teamAwardCount =
                    team.badges.reduce(
                      (
                        total,
                        badge
                      ) =>
                        total +
                        n(
                          badge.award_count
                        ),
                      0
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
                        <div>
                          <span
                            style={
                              styles.sectionEyebrow
                            }
                          >
                            TROPHY CASE
                          </span>

                          <h3
                            style={
                              styles.trophyTeamName
                            }
                          >
                            {
                              team.teamName
                            }
                          </h3>
                        </div>

                        <span
                          style={
                            styles.trophyTotal
                          }
                        >
                          {
                            teamAwardCount
                          }{" "}
                          AWARDS
                        </span>
                      </div>

                      <TrophyGroup
                        title="ACHIEVEMENTS"
                        badges={
                          achievements
                        }
                        emptyText="No achievement badges yet."
                      />

                      <TrophyGroup
                        title="INFAMY"
                        badges={
                          infamy
                        }
                        emptyText="No infamy badges yet."
                        infamy
                      />
                    </article>
                  );
                }
              )}
            </div>
          ) : (
            <EmptyState
              text="Trophy cases will appear after the first fully finalized Season-Long week."
            />
          )}
        </section>

        {isH2H ? (
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
                  WEEK {week}
                  {h2hMatchups.some(
                    (
                      matchup
                    ) =>
                      matchup.matchup_type ===
                      "playoff"
                  )
                    ? " · PLAYOFFS"
                    : " · HEAD-TO-HEAD"}
                </p>

                <h2
                  style={
                    styles.sectionTitle
                  }
                >
                  Matchup Results
                </h2>
              </div>

              <span
                style={
                  styles.countBadge
                }
              >
                {h2hMatchups.length}{" "}
                MATCHUPS
              </span>
            </div>

            {h2hMatchups.length >
            0 ? (
              <div
                className="g365-h2h-recap-matchups"
                style={
                  styles.h2hMatchupGrid
                }
              >
                {h2hMatchups.map(
                  (
                    matchup
                  ) => {
                    const homeName =
                      teamNameMap.get(
                        matchup.home_fantasy_team_id
                      ) ??
                      `Team ${matchup.home_fantasy_team_id}`;

                    const awayName =
                      matchup.away_fantasy_team_id
                        ? teamNameMap.get(
                            matchup.away_fantasy_team_id
                          ) ??
                          `Team ${matchup.away_fantasy_team_id}`
                        : "BYE";

                    const homeWinner =
                      Boolean(
                        matchup.is_final &&
                        matchup.winner_fantasy_team_id ===
                          matchup.home_fantasy_team_id
                      );

                    const awayWinner =
                      Boolean(
                        matchup.is_final &&
                        matchup.away_fantasy_team_id &&
                        matchup.winner_fantasy_team_id ===
                          matchup.away_fantasy_team_id
                      );

                    const matchupBody = (
                      <article
                        style={
                          styles.h2hMatchupCard
                        }
                      >
                        <div
                          style={
                            styles.h2hMatchupMeta
                          }
                        >
                          <span>
                            {matchup.matchup_type ===
                            "playoff"
                              ? `PLAYOFF ROUND ${matchup.playoff_round ?? "—"}`
                              : "REGULAR SEASON"}
                          </span>

                          <strong>
                            {matchup.is_final
                              ? "FINAL"
                              : "IN PROGRESS"}
                          </strong>
                        </div>

                        <div
                          style={{
                            ...styles.h2hTeamRow,
                            ...(homeWinner
                              ? styles.h2hWinnerRow
                              : {}),
                          }}
                        >
                          <span>
                            {homeWinner
                              ? "✓ "
                              : ""}
                            {homeName}
                          </span>

                          <strong>
                            {points(
                              matchup.home_points
                            )}
                          </strong>
                        </div>

                        <div
                          style={{
                            ...styles.h2hTeamRow,
                            ...(awayWinner
                              ? styles.h2hWinnerRow
                              : {}),
                          }}
                        >
                          <span>
                            {awayWinner
                              ? "✓ "
                              : ""}
                            {awayName}
                          </span>

                          <strong>
                            {matchup.away_fantasy_team_id
                              ? points(
                                  matchup.away_points
                                )
                              : "BYE"}
                          </strong>
                        </div>

                        {matchup.is_tie ? (
                          <div
                            style={
                              styles.h2hTie
                            }
                          >
                            TIE
                          </div>
                        ) : null}
                      </article>
                    );

                    return matchup.away_fantasy_team_id
                      ? (
                          <Link
                            key={
                              matchup.id
                            }
                            href={`/league/${leagueId}/season-long/matchups/${matchup.id}`}
                            style={
                              styles.h2hMatchupLink
                            }
                          >
                            {matchupBody}
                          </Link>
                        )
                      : (
                          <div
                            key={
                              matchup.id
                            }
                          >
                            {matchupBody}
                          </div>
                        );
                  }
                )}
              </div>
            ) : (
              <EmptyState
                text="No Head-to-Head matchup rows are available for this week yet."
              />
            )}
          </section>
        ) : null}

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
                WEEK {week}
              </p>

              <h2
                style={
                  styles.sectionTitle
                }
              >
                {isH2H
                  ? "Weekly Scoring"
                  : "Weekly Rankings"}
              </h2>
            </div>
          </div>

          <div
            style={
              styles.rankList
            }
          >
            {recaps.map(
              (
                team,
                index
              ) => (
                <Link
                  key={
                    team.teamId
                  }
                  href={`/league/${leagueId}/teams/${team.teamId}?week=${week}`}
                  style={
                    styles.rankRow
                  }
                >
                  <span
                    style={
                      index ===
                      0
                        ? styles.rankTop
                        : styles.rank
                    }
                  >
                    #
                    {index +
                      1}
                  </span>

                  <div
                    style={
                      styles.rankTeam
                    }
                  >
                    <strong>
                      {
                        team.teamName
                      }
                    </strong>

                    <span>
                      Season #
                      {
                        team.seasonRank ??
                        "—"
                      }
                      {" · "}
                      {points(
                        team.seasonPoints
                      )}
                      {" "}
                      season pts
                    </span>
                  </div>

                  {isSalary ? (
                    <span
                      style={
                        styles.rankMeta
                      }
                    >
                      {money(
                        team.salaryUsed
                      )}
                    </span>
                  ) : null}

                  <strong
                    style={
                      styles.rankPoints
                    }
                  >
                    {points(
                      team.weekPoints
                    )}
                  </strong>
                </Link>
              )
            )}
          </div>
        </section>

        <SeasonLongSeasonSummary
          leagueId={leagueId}
        />
      </section>
    </main>
  );
}

function Spotlight({
  eyebrow,
  value,
  detail,
  emoji,
}: {
  eyebrow: string;
  value: string;
  detail: string;
  emoji: string;
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

      <span
        style={
          styles.spotlightEyebrow
        }
      >
        {eyebrow}
      </span>

      <strong
        style={
          styles.spotlightValue
        }
      >
        {value}
      </strong>

      <span
        style={
          styles.spotlightDetail
        }
      >
        {detail}
      </span>
    </article>
  );
}

function TrophyGroup({
  title,
  badges,
  emptyText,
  infamy = false,
}: {
  title: string;
  badges: TrophyRow[];
  emptyText: string;
  infamy?: boolean;
}) {
  return (
    <div
      style={
        styles.trophyGroup
      }
    >
      <div
        style={
          styles.trophyGroupTitle
        }
      >
        {title}
      </div>

      {badges.length >
      0 ? (
        <div
          style={
            styles.trophyBadgeList
          }
        >
          {badges.map(
            (
              badge
            ) => (
              <div
                key={`${badge.fantasy_team_id}-${badge.badge_key}`}
                style={{
                  ...styles.trophyBadge,

                  ...(infamy
                    ? styles.trophyBadgeInfamy
                    : {}),
                }}
              >
                <span
                  style={
                    styles.trophyBadgeEmoji
                  }
                >
                  {
                    badge.badge_emoji
                  }
                </span>

                <div
                  style={
                    styles.trophyBadgeBody
                  }
                >
                  <strong>
                    {
                      badge.badge_name
                    }
                  </strong>

                  <span>
                    x
                    {
                      n(
                        badge.award_count
                      )
                    }
                    {" · "}
                    Week
                    {" "}
                    {
                      badge.first_earned_week
                    }
                    {badge.first_earned_week !==
                    badge.last_earned_week
                      ? `–${badge.last_earned_week}`
                      : ""}
                  </span>

                  {badge.latest_detail ? (
                    <small>
                      Latest:
                      {" "}
                      {
                        badge.latest_detail
                      }
                    </small>
                  ) : null}
                </div>
              </div>
            )
          )}
        </div>
      ) : (
        <span
          style={
            styles.trophyEmpty
          }
        >
          {emptyText}
        </span>
      )}
    </div>
  );
}

function EmptyState({
  text,
}: {
  text: string;
}) {
  return (
    <div
      style={
        styles.emptyState
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

      gap: 20,

      flexWrap:
        "wrap",

      padding: 26,

      border:
        "1px solid #2c2c2c",

      borderRadius:
        22,

      background:
        "radial-gradient(circle at top right,#371307 0,transparent 34%),linear-gradient(135deg,#191919,#0e0e0e 72%)",
    },

    eyebrow: {
      margin: 0,

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
      margin: 0,

      color:
        "#aaa",

      fontWeight:
        700,
    },

    actions: {
      display:
        "flex",

      gap: 10,

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

    weekBar: {
      display:
        "flex",

      gap: 12,

      alignItems:
        "center",

      margin:
        "14px 0",

      overflowX:
        "auto",

      padding:
        "12px 14px",

      border:
        "1px solid #272727",

      borderRadius:
        14,

      background:
        "#101010",
    },

    weekLabel: {
      fontSize:
        10,

      fontWeight:
        950,

      color:
        "#777",

      letterSpacing:
        1.5,
    },

    weekLinks: {
      display:
        "flex",

      gap: 6,
    },

    weekButton: {
      minWidth:
        34,

      height: 32,

      display:
        "inline-flex",

      alignItems:
        "center",

      justifyContent:
        "center",

      borderRadius:
        8,

      border:
        "1px solid #2d2d2d",

      color:
        "#aaa",

      textDecoration:
        "none",

      background:
        "#171717",

      fontWeight:
        850,

      fontSize:
        12,
    },

    weekButtonActive: {
      background:
        "linear-gradient(90deg,#a61919,#f0631d)",

      color:
        "#fff",

      borderColor:
        "#d94a1c",
    },

    spotlightGrid: {
      display:
        "grid",

      gridTemplateColumns:
        "repeat(auto-fit,minmax(240px,1fr))",

      gap: 12,
    },

    spotlight: {
      minHeight:
        145,

      border:
        "1px solid #303030",

      borderRadius:
        17,

      padding: 18,

      background:
        "linear-gradient(145deg,#171717,#0f0f0f)",
    },

    spotlightEmoji: {
      fontSize:
        28,

      marginBottom:
        9,
    },

    spotlightEyebrow: {
      display:
        "block",

      color:
        "#e34b20",

      fontSize:
        10,

      letterSpacing:
        1.5,

      fontWeight:
        950,
    },

    spotlightValue: {
      display:
        "block",

      marginTop:
        7,

      fontSize:
        22,
    },

    spotlightDetail: {
      display:
        "block",

      color:
        "#929292",

      marginTop:
        5,

      fontSize:
        12,
    },

    card: {
      marginTop:
        16,

      padding: 22,

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

      gap: 12,

      flexWrap:
        "wrap",
    },

    sectionEyebrow: {
      margin: 0,

      color:
        "#e34b20",

      fontSize:
        10,

      fontWeight:
        950,

      letterSpacing:
        1.6,
    },

    sectionTitle: {
      margin:
        "5px 0 15px",

      fontSize:
        24,
    },

    countBadge: {
      padding:
        "7px 10px",

      borderRadius:
        999,

      background:
        "#2a150d",

      border:
        "1px solid #62301a",

      color:
        "#ffad82",

      fontSize:
        10,

      fontWeight:
        900,
    },

    badgeGrid: {
      display:
        "grid",

      gridTemplateColumns:
        "repeat(auto-fit,minmax(250px,1fr))",

      gap: 10,
    },

    badgeCard: {
      display:
        "flex",

      gap: 13,

      padding: 15,

      borderRadius:
        14,

      border:
        "1px solid #5b351d",

      background:
        "linear-gradient(145deg,#21150f,#121212)",
    },

    infamyCard: {
      borderColor:
        "#4a4a4a",

      background:
        "linear-gradient(145deg,#191919,#101010)",
    },

    badgeEmoji: {
      fontSize:
        30,
    },

    badgeCategory: {
      color:
        "#8c8c8c",

      fontSize:
        9,

      fontWeight:
        900,

      letterSpacing:
        1.3,
    },

    badgeName: {
      margin:
        "2px 0 3px",

      fontSize:
        17,
    },

    badgeTeam: {
      color:
        "#ff7a38",

      fontSize:
        12,
    },

    badgeDetail: {
      margin:
        "4px 0 0",

      color:
        "#989898",

      fontSize:
        11,

      lineHeight:
        1.4,
    },

    trophyGrid: {
      display:
        "grid",

      gridTemplateColumns:
        "repeat(auto-fit,minmax(300px,1fr))",

      gap: 12,
    },

    trophyCard: {
      border:
        "1px solid #30261f",

      borderRadius:
        16,

      padding: 16,

      background:
        "linear-gradient(145deg,#17120f,#0c0c0c)",
    },

    trophyHeader: {
      display:
        "flex",

      justifyContent:
        "space-between",

      alignItems:
        "flex-start",

      gap: 12,

      paddingBottom:
        12,

      borderBottom:
        "1px solid #2b241f",
    },

    trophyTeamName: {
      margin:
        "4px 0 0",

      fontSize:
        19,
    },

    trophyTotal: {
      padding:
        "6px 9px",

      borderRadius:
        999,

      border:
        "1px solid #62301a",

      background:
        "#24130d",

      color:
        "#ff9a68",

      fontSize:
        9,

      fontWeight:
        950,
    },

    trophyGroup: {
      marginTop:
        14,
    },

    trophyGroupTitle: {
      marginBottom:
        8,

      color:
        "#777",

      fontSize:
        9,

      fontWeight:
        950,

      letterSpacing:
        1.5,
    },

    trophyBadgeList: {
      display:
        "grid",

      gap: 7,
    },

    trophyBadge: {
      display:
        "flex",

      gap: 10,

      alignItems:
        "flex-start",

      border:
        "1px solid #4f2d1b",

      borderRadius:
        12,

      padding: 10,

      background:
        "#19100c",
    },

    trophyBadgeInfamy: {
      borderColor:
        "#343434",

      background:
        "#121212",
    },

    trophyBadgeEmoji: {
      fontSize:
        24,

      lineHeight:
        1,
    },

    trophyBadgeBody: {
      display:
        "flex",

      flexDirection:
        "column",

      gap: 3,

      minWidth: 0,

      fontSize:
        12,

      color:
        "#fff",
    },

    trophyEmpty: {
      color:
        "#666",

      fontSize:
        11,
    },

    emptyState: {
      padding:
        "18px 14px",

      border:
        "1px dashed #343434",

      borderRadius:
        12,

      color:
        "#777",

      background:
        "#0c0c0c",

      fontSize:
        12,
    },

    rankList: {
      borderTop:
        "1px solid #272727",

      overflowX:
        "auto",
    },

    rankRow: {
      display:
        "grid",

      gridTemplateColumns:
        "58px minmax(180px,1fr) auto 90px",

      gap: 12,

      alignItems:
        "center",

      minHeight:
        64,

      minWidth:
        520,

      borderBottom:
        "1px solid #242424",

      color:
        "#fff",

      textDecoration:
        "none",
    },

    rank: {
      fontSize:
        18,

      fontWeight:
        900,

      color:
        "#777",
    },

    rankTop: {
      fontSize:
        22,

      fontWeight:
        950,

      color:
        "#ff6a1a",
    },

    rankTeam: {
      display:
        "flex",

      flexDirection:
        "column",

      gap: 3,
    },

    rankMeta: {
      color:
        "#929292",

      fontSize:
        12,

      textAlign:
        "right",
    },

    rankPoints: {
      textAlign:
        "right",

      fontSize:
        20,
    },

    teamGrid: {
      display:
        "grid",

      gap: 14,
    },

    teamCard: {
      border:
        "1px solid #2a2a2a",

      borderRadius:
        16,

      background:
        "#0c0c0c",

      overflow:
        "hidden",
    },

    teamHead: {
      display:
        "flex",

      justifyContent:
        "space-between",

      alignItems:
        "center",

      gap: 12,

      padding:
        "16px 18px",

      background:
        "linear-gradient(90deg,#171717,#101010)",
    },

    teamRank: {
      color:
        "#e44c20",

      fontSize:
        9,

      fontWeight:
        950,

      letterSpacing:
        1.4,
    },

    teamName: {
      margin:
        "3px 0 0",

      fontSize:
        20,
    },

    teamScore: {
      fontSize:
        28,

      fontWeight:
        950,
    },

    miniBadges: {
      display:
        "flex",

      gap: 7,

      flexWrap:
        "wrap",

      padding:
        "10px 18px 0",
    },

    miniBadge: {
      fontSize:
        10,

      fontWeight:
        850,

      color:
        "#ffb18d",

      border:
        "1px solid #57301e",

      background:
        "#21130d",

      padding:
        "5px 8px",

      borderRadius:
        999,
    },

    playerList: {
      padding:
        "10px 14px 14px",

      overflowX:
        "auto",
    },

    playerRow: {
      display:
        "grid",

      gridTemplateColumns:
        "70px minmax(240px,1fr) 90px 70px",

      gap: 10,

      alignItems:
        "center",

      minWidth:
        520,

      padding:
        "11px 4px",

      borderBottom:
        "1px solid #222",
    },

    slot: {
      color:
        "#ff6a1a",

      fontSize:
        10,

      fontWeight:
        950,
    },

    playerBody: {
      minWidth: 0,
    },

    playerName: {
      display:
        "block",

      fontSize:
        13,
    },

    statLine: {
      display:
        "block",

      marginTop:
        4,

      color:
        "#898989",

      fontSize:
        10,

      lineHeight:
        1.35,
    },

    playerSalary: {
      color:
        "#999",

      fontSize:
        11,

      textAlign:
        "right",
    },

    playerPoints: {
      textAlign:
        "right",

      fontSize:
        15,
    },

    h2hMatchupGrid: {
      display:
        "grid",

      gridTemplateColumns:
        "repeat(auto-fit,minmax(270px,1fr))",

      gap: 12,
    },

    h2hMatchupLink: {
      color:
        "inherit",

      textDecoration:
        "none",
    },

    h2hMatchupCard: {
      minWidth: 0,

      overflow:
        "hidden",

      border:
        "1px solid rgba(255,255,255,.10)",

      borderRadius:
        14,

      background:
        "linear-gradient(180deg,#101419,#090c10)",
    },

    h2hMatchupMeta: {
      display:
        "flex",

      justifyContent:
        "space-between",

      gap: 10,

      padding:
        "10px 12px",

      borderBottom:
        "1px solid rgba(255,255,255,.08)",

      color:
        "#9ca3af",

      fontSize:
        10,

      fontWeight:
        900,

      letterSpacing:
        0.5,
    },

    h2hTeamRow: {
      display:
        "flex",

      alignItems:
        "center",

      justifyContent:
        "space-between",

      gap: 12,

      minWidth: 0,

      padding:
        "13px 12px",

      color:
        "#f4f4f5",

      borderBottom:
        "1px solid rgba(255,255,255,.06)",
    },

    h2hWinnerRow: {
      background:
        "linear-gradient(90deg,rgba(239,68,68,.14),rgba(249,115,22,.05))",

      color:
        "#fff",
    },

    h2hTie: {
      padding:
        "8px 12px",

      color:
        "#fbbf24",

      fontSize:
        10,

      fontWeight:
        950,

      textAlign:
        "center",

      letterSpacing:
        0.6,
    },

  };