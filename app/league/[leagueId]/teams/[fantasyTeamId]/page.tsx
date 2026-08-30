import Link from "next/link";

import {
  notFound,
  redirect,
} from "next/navigation";

import {
  createSupabaseServerClient,
} from "@/lib/supabase/server";

import {
  requireLeagueMember,
} from "@/lib/leagues/requireLeagueMember";


type PageProps = {
  params:
    Promise<{
      leagueId: string;
      fantasyTeamId: string;
    }>;

  searchParams:
    Promise<{
      week?: string;
    }>;
};


type FantasyTeamRow = {
  id: number;
  team_name: string;
  active: boolean;
};


type WeeklyEntryRow = {
  fantasy_team_id: number;
  season: number;
  week: number;
  status: string | null;
  salary_used: number | string | null;
  projected_points: number | string | null;
  submitted_at: string | null;
};


type WeeklyLineupRow = {
  id: number;
  fantasy_team_id: number;
  season: number;
  week: number;
  player_id: number;
  lineup_slot: string;
  slot_index: number;
  salary_at_selection:
    number |
    string |
    null;
  projected_points_at_selection:
    number |
    string |
    null;
  is_locked: boolean;
  locked_at: string | null;
  nfl_game_id: number | null;
  game_start_at: string | null;
  opponent_abbreviation: string | null;
  home_or_away: string | null;
};


type NflPlayerRow = {
  id: number;
  full_name: string;
  first_name: string | null;
  last_name: string | null;
  primary_position: string | null;
  team_abbreviation: string | null;
  jersey_number: string | null;
  status: string | null;
  is_active: boolean | null;
  headshot_url: string | null;
};


type PlayerScoreRow = {
  nfl_game_id: number;
  nfl_player_id: number;
  fantasy_points:
    number |
    string |
    null;
  is_live: boolean | null;
  is_final: boolean | null;
};


type WeeklyScoreRow = {
  fantasy_team_id: number;
  fantasy_points:
    number |
    string |
    null;
  salary_used:
    number |
    string |
    null;
  lineup_player_count:
    number |
    null;
  is_final:
    boolean |
    null;
};


type PlayerDisplayRow = {
  lineupId: number;
  slot: string;
  slotIndex: number;

  isHidden: boolean;

  playerId: number | null;
  playerName: string;
  position: string;
  nflTeam: string;
  jerseyNumber: string | null;

  opponent: string;

  projectedPoints: number | null;
  fantasyPoints: number | null;
  salary: number | null;

  isLocked: boolean;
  isLive: boolean;
  isFinal: boolean;
};


function toNumber(
  value:
    | number
    | string
    | null
    | undefined
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
    | number
    | string
    | null
    | undefined
) {
  return toNumber(
    value
  ).toFixed(
    2
  );
}


function formatMoney(
  value:
    | number
    | string
    | null
    | undefined
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
    toNumber(
      value
    )
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


function getOpponentLabel(
  opponent:
    string |
    null,
  homeOrAway:
    string |
    null
) {
  if (
    !opponent
  ) {
    return "TBD";
  }

  if (
    homeOrAway ===
    "away"
  ) {
    return `@ ${opponent}`;
  }

  return `vs ${opponent}`;
}


function getSlotOrder(
  slot:
    string
) {
  const order:
    Record<
      string,
      number
    > = {
      QB: 1,
      RB: 2,
      WR: 3,
      TE: 4,
      FLEX: 5,
      SUPERFLEX: 6,
      K: 7,
      DST: 8,
    };

  return (
    order[
      slot.toUpperCase()
    ] ??
    99
  );
}


function getGameStatus(
  player:
    PlayerDisplayRow
) {
  if (
    player.isHidden
  ) {
    return "HIDDEN";
  }

  if (
    player.isFinal
  ) {
    return "FINAL";
  }

  if (
    player.isLive
  ) {
    return "LIVE";
  }

  if (
    player.isLocked
  ) {
    return "LOCKED";
  }

  return "UPCOMING";
}


function getGameStatusStyle(
  player:
    PlayerDisplayRow
) {
  if (
    player.isHidden
  ) {
    return styles.statusHidden;
  }

  if (
    player.isFinal
  ) {
    return styles.statusFinal;
  }

  if (
    player.isLive
  ) {
    return styles.statusLive;
  }

  if (
    player.isLocked
  ) {
    return styles.statusLocked;
  }

  return {};
}


export default async function SeasonLongTeamDetailsPage({
  params,
  searchParams,
}: PageProps) {
  const {
    leagueId,
    fantasyTeamId,
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
    redirect(
      `/league/${leagueId}`
    );
  }


  const parsedTeamId =
    Number(
      fantasyTeamId
    );


  if (
    !Number.isSafeInteger(
      parsedTeamId
    ) ||
    parsedTeamId <= 0
  ) {
    notFound();
  }


  const supabase =
    await createSupabaseServerClient();


  const season =
    access.league.season;


  const isSalaryLeague =
    access.league.playerSelectionMode ===
    "salary";


  const isMyTeam =
    access
      .fantasyTeam
      ?.id ===
    parsedTeamId;


  /*
   * ============================================================
   * ACTIVE WEEK
   * ============================================================
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


  const activeWeek =
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
      : activeWeek;


  const isPastWeek =
    selectedWeek <
    activeWeek;


  /*
   * ============================================================
   * VERIFY TEAM
   * ============================================================
   */

  const teamResult =
    await supabase
      .from(
        "fantasy_teams"
      )
      .select(`
        id,
        team_name,
        active
      `)
      .eq(
        "id",
        parsedTeamId
      )
      .eq(
        "league_id",
        leagueId
      )
      .maybeSingle();


  if (
    teamResult.error
  ) {
    throw new Error(
      teamResult
        .error
        .message
    );
  }


  if (
    !teamResult.data
  ) {
    notFound();
  }


  const team =
    teamResult
      .data as FantasyTeamRow;


  /*
   * ============================================================
   * KEEP LOCKS CURRENT
   * ============================================================
   */

  if (
    selectedWeek ===
    activeWeek
  ) {
    const lockResult =
      await supabase.rpc(
        "sync_season_long_lineup_locks",
        {
          p_league_id:
            leagueId,

          p_season:
            season,

          p_week:
            selectedWeek,
        }
      );


    if (
      lockResult.error
    ) {
      throw new Error(
        lockResult
          .error
          .message
      );
    }
  }


  /*
   * ============================================================
   * LOAD TEAM WEEK
   * ============================================================
   */

  const [
    entryResult,
    lineupResult,
    weeklyScoreResult,
    allWeeklyScoresResult,
  ] =
    await Promise.all([
      supabase
        .from(
          "season_long_weekly_entries"
        )
        .select(`
          fantasy_team_id,
          season,
          week,
          status,
          salary_used,
          projected_points,
          submitted_at
        `)
        .eq(
          "league_id",
          leagueId
        )
        .eq(
          "fantasy_team_id",
          parsedTeamId
        )
        .eq(
          "season",
          season
        )
        .eq(
          "week",
          selectedWeek
        )
        .maybeSingle(),

      supabase
        .from(
          "season_long_weekly_lineups"
        )
        .select(`
          id,
          fantasy_team_id,
          season,
          week,
          player_id,
          lineup_slot,
          slot_index,
          salary_at_selection,
          projected_points_at_selection,
          is_locked,
          locked_at,
          nfl_game_id,
          game_start_at,
          opponent_abbreviation,
          home_or_away
        `)
        .eq(
          "league_id",
          leagueId
        )
        .eq(
          "fantasy_team_id",
          parsedTeamId
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
          "fantasy_team_id",
          parsedTeamId
        )
        .eq(
          "season",
          season
        )
        .eq(
          "week",
          selectedWeek
        )
        .maybeSingle(),

      supabase
        .from(
          "season_long_weekly_scores"
        )
        .select(`
          fantasy_team_id,
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
    ]);


  if (
    entryResult.error
  ) {
    throw new Error(
      entryResult.error.message
    );
  }


  if (
    lineupResult.error
  ) {
    throw new Error(
      lineupResult.error.message
    );
  }


  if (
    weeklyScoreResult.error
  ) {
    throw new Error(
      weeklyScoreResult.error.message
    );
  }


  if (
    allWeeklyScoresResult.error
  ) {
    throw new Error(
      allWeeklyScoresResult.error.message
    );
  }


  const entry =
    entryResult.data as
      | WeeklyEntryRow
      | null;


  const lineup =
    (
      lineupResult.data ??
      []
    ) as WeeklyLineupRow[];


  const weeklyScore =
    weeklyScoreResult.data as
      | WeeklyScoreRow
      | null;


  const allWeeklyScores =
    (
      allWeeklyScoresResult.data ??
      []
    ) as WeeklyScoreRow[];


  const entireWeekFinal =
    Boolean(
      weeklyScore?.is_final
    );


  /*
   * ============================================================
   * VISIBILITY
   * ============================================================
   *
   * Own team:
   *   always visible.
   *
   * Other team:
   *   player is visible only after that player's lineup row locks,
   *   or after the week has completed.
   *
   * IMPORTANT:
   * Hidden player IDs are not included in the nfl_players query.
   */

  function canRevealLineupRow(
    row:
      WeeklyLineupRow
  ) {
    return (
      isMyTeam ||
      isPastWeek ||
      entireWeekFinal ||
      Boolean(
        row.is_locked
      )
    );
  }


  const revealedLineupRows =
    lineup.filter(
      canRevealLineupRow
    );


  const revealedPlayerIds =
    Array.from(
      new Set(
        revealedLineupRows.map(
          (
            row
          ) =>
            row.player_id
        )
      )
    );


  /*
   * ============================================================
   * LOAD ONLY REVEALED PLAYER DETAILS
   * ============================================================
   */

  let players:
    NflPlayerRow[] = [];


  if (
    revealedPlayerIds.length >
    0
  ) {
    const playersResult =
      await supabase
        .from(
          "nfl_players"
        )
        .select(`
          id,
          full_name,
          first_name,
          last_name,
          primary_position,
          team_abbreviation,
          jersey_number,
          status,
          is_active,
          headshot_url
        `)
        .in(
          "id",
          revealedPlayerIds
        );


    if (
      playersResult.error
    ) {
      throw new Error(
        playersResult
          .error
          .message
      );
    }


    players =
      (
        playersResult.data ??
        []
      ) as NflPlayerRow[];
  }


  /*
   * ============================================================
   * LOAD ONLY REVEALED PLAYER SCORES
   * ============================================================
   */

  let playerScores:
    PlayerScoreRow[] = [];


  if (
    revealedPlayerIds.length >
    0
  ) {
    const scoreResult =
      await supabase
        .from(
          "fantasy_player_game_scores"
        )
        .select(`
          nfl_game_id,
          nfl_player_id,
          fantasy_points,
          is_live,
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
          "season_type",
          2
        )
        .eq(
          "week",
          selectedWeek
        )
        .in(
          "nfl_player_id",
          revealedPlayerIds
        );


    if (
      scoreResult.error
    ) {
      throw new Error(
        scoreResult
          .error
          .message
      );
    }


    playerScores =
      (
        scoreResult.data ??
        []
      ) as PlayerScoreRow[];
  }


  const playerMap =
    new Map<
      number,
      NflPlayerRow
    >();


  for (
    const player
    of players
  ) {
    playerMap.set(
      player.id,
      player
    );
  }


  const scoreMap =
    new Map<
      string,
      PlayerScoreRow
    >();


  for (
    const score
    of playerScores
  ) {
    scoreMap.set(
      `${score.nfl_player_id}:${score.nfl_game_id}`,
      score
    );
  }


  /*
   * ============================================================
   * DISPLAY LINEUP
   * ============================================================
   */

  const displayPlayers:
    PlayerDisplayRow[] =
      lineup.map(
        (
          row
        ) => {
          const canReveal =
            canRevealLineupRow(
              row
            );


          if (
            !canReveal
          ) {
            return {
              lineupId:
                row.id,

              slot:
                row.lineup_slot,

              slotIndex:
                row.slot_index,

              isHidden:
                true,

              playerId:
                null,

              playerName:
                "Hidden until kickoff",

              position:
                "—",

              nflTeam:
                "—",

              jerseyNumber:
                null,

              opponent:
                "—",

              projectedPoints:
                null,

              fantasyPoints:
                null,

              salary:
                null,

              isLocked:
                false,

              isLive:
                false,

              isFinal:
                false,
            };
          }


          const player =
            playerMap.get(
              row.player_id
            );


          const score =
            row.nfl_game_id
              ? scoreMap.get(
                  `${row.player_id}:${row.nfl_game_id}`
                )
              : undefined;


          return {
            lineupId:
              row.id,

            slot:
              row.lineup_slot,

            slotIndex:
              row.slot_index,

            isHidden:
              false,

            playerId:
              row.player_id,

            playerName:
              player
                ?.full_name ??
              "Unknown Player",

            position:
              player
                ?.primary_position ??
              "—",

            nflTeam:
              player
                ?.team_abbreviation ??
              "FA",

            jerseyNumber:
              player
                ?.jersey_number ??
              null,

            opponent:
              getOpponentLabel(
                row.opponent_abbreviation,
                row.home_or_away
              ),

            projectedPoints:
              toNumber(
                row.projected_points_at_selection
              ),

            fantasyPoints:
              toNumber(
                score?.fantasy_points
              ),

            salary:
              isSalaryLeague &&
              row.salary_at_selection !=
                null
                ? toNumber(
                    row.salary_at_selection
                  )
                : null,

            isLocked:
              Boolean(
                row.is_locked
              ),

            isLive:
              Boolean(
                score?.is_live
              ),

            isFinal:
              Boolean(
                score?.is_final
              ),
          };
        }
      );


  displayPlayers.sort(
    (
      a,
      b
    ) => {
      const slotDifference =
        getSlotOrder(
          a.slot
        ) -
        getSlotOrder(
          b.slot
        );


      if (
        slotDifference !==
        0
      ) {
        return slotDifference;
      }


      return (
        a.slotIndex -
        b.slotIndex
      );
    }
  );


  /*
   * ============================================================
   * WEEKLY RANK
   * ============================================================
   */

  const targetPoints =
    toNumber(
      weeklyScore
        ?.fantasy_points
    );


  const weeklyRank =
    allWeeklyScores.length >
    0
      ? allWeeklyScores.filter(
          (
            row
          ) =>
            toNumber(
              row.fantasy_points
            ) >
            targetPoints
        ).length +
        1
      : 0;


  /*
   * Aggregate projection/salary information stays hidden for
   * another team until the full lineup has been revealed.
   */

  const hasHiddenPlayers =
    displayPlayers.some(
      (
        player
      ) =>
        player.isHidden
    );


  const canShowFullTotals =
    isMyTeam ||
    !hasHiddenPlayers;


  const visibleActualPoints =
    displayPlayers.reduce(
      (
        total,
        player
      ) =>
        total +
        (
          player.fantasyPoints ??
          0
        ),
      0
    );


  const fullProjection =
    canShowFullTotals
      ? displayPlayers.reduce(
          (
            total,
            player
          ) =>
            total +
            (
              player.projectedPoints ??
              0
            ),
          0
        )
      : null;


  const salaryUsed =
    isSalaryLeague &&
    canShowFullTotals
      ? displayPlayers.reduce(
          (
            total,
            player
          ) =>
            total +
            (
              player.salary ??
              0
            ),
          0
        )
      : null;


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


  return (
    <main
      style={
        styles.page
      }
    >
      <div
        style={
          styles.backRow
        }
      >
        <Link
          href={
            `/league/${leagueId}/teams?week=${selectedWeek}`
          }
          style={
            styles.backLink
          }
        >
          ← League Teams
        </Link>
      </div>


      <section
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
            WEEK {selectedWeek} ENTRY
          </div>

          <div
            style={
              styles.teamTitleRow
            }
          >
            <h1
              style={
                styles.title
              }
            >
              {
                team.team_name
              }
            </h1>

            {isMyTeam && (
              <span
                style={
                  styles.youBadge
                }
              >
                YOUR TEAM
              </span>
            )}
          </div>

          <p
            style={
              styles.subtitle
            }
          >
            {isMyTeam
              ? "Your complete weekly lineup."
              : "Opponent selections are revealed individually as each player's NFL game begins."}
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
              WEEK RANK
            </span>

            <strong
              style={
                styles.heroStatValue
              }
            >
              {weeklyRank >
              0
                ? `#${weeklyRank}`
                : "—"}
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
              WEEK PTS
            </span>

            <strong
              style={
                styles.heroStatValue
              }
            >
              {formatPoints(
                weeklyScore
                  ?.fantasy_points
              )}
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
              PROJECTED
            </span>

            <strong
              style={
                styles.heroStatValue
              }
            >
              {canShowFullTotals &&
              fullProjection !==
                null
                ? formatPoints(
                    entry
                      ?.projected_points ??
                    fullProjection
                  )
                : "—"}
            </strong>
          </div>
        </div>
      </section>


      {!isMyTeam &&
        hasHiddenPlayers && (
          <section
            style={
              styles.lockNotice
            }
          >
            <div
              style={
                styles.lockIcon
              }
            >
              🔒
            </div>

            <div>
              <div
                style={
                  styles.lockTitle
                }
              >
                Lineup protection active
              </div>

              <div
                style={
                  styles.lockText
                }
              >
                Players remain hidden
                until their individual
                NFL games kick off.
              </div>
            </div>
          </section>
        )}


      <section
        style={
          styles.weekCard
        }
      >
        <div
          style={
            styles.weekHeader
          }
        >
          <div>
            <div
              style={
                styles.weekTitle
              }
            >
              Select Week
            </div>

            <div
              style={
                styles.weekText
              }
            >
              View this team&apos;s
              lineup from any week.
            </div>
          </div>

          {selectedWeek !==
            activeWeek && (
            <Link
              href={
                `/league/${leagueId}/teams/${parsedTeamId}?week=${activeWeek}`
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
            ) => (
              <Link
                key={
                  week
                }
                href={
                  `/league/${leagueId}/teams/${parsedTeamId}?week=${week}`
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
      </section>


      <section
        style={
          styles.summaryGrid
        }
      >
        <div
          style={
            styles.summaryCard
          }
        >
          <span
            style={
              styles.summaryLabel
            }
          >
            ENTRY STATUS
          </span>

          <strong
            style={
              styles.summaryValue
            }
          >
            {weeklyScore
              ?.is_final
              ? "Final"
              : formatStatus(
                  entry
                    ?.status
                )}
          </strong>
        </div>


        <div
          style={
            styles.summaryCard
          }
        >
          <span
            style={
              styles.summaryLabel
            }
          >
            PLAYERS
          </span>

          <strong
            style={
              styles.summaryValue
            }
          >
            {
              displayPlayers.length
            }
          </strong>
        </div>


        <div
          style={
            styles.summaryCard
          }
        >
          <span
            style={
              styles.summaryLabel
            }
          >
            ACTUAL POINTS
          </span>

          <strong
            style={
              styles.summaryValue
            }
          >
            {formatPoints(
              weeklyScore
                ?.fantasy_points ??
              visibleActualPoints
            )}
          </strong>
        </div>


        <div
          style={
            styles.summaryCard
          }
        >
          <span
            style={
              styles.summaryLabel
            }
          >
            PROJECTED
          </span>

          <strong
            style={
              styles.summaryValue
            }
          >
            {canShowFullTotals &&
            fullProjection !==
              null
              ? formatPoints(
                  fullProjection
                )
              : "—"}
          </strong>
        </div>


        {isSalaryLeague && (
          <div
            style={
              styles.summaryCard
            }
          >
            <span
              style={
                styles.summaryLabel
              }
            >
              SALARY USED
            </span>

            <strong
              style={
                styles.summaryValueOrange
              }
            >
              {salaryUsed ===
              null
                ? "—"
                : formatMoney(
                    salaryUsed
                  )}
            </strong>
          </div>
        )}
      </section>


      <section
        style={
          styles.lineupCard
        }
      >
        <div
          style={
            styles.lineupHeader
          }
        >
          <div>
            <h2
              style={
                styles.sectionTitle
              }
            >
              Week {selectedWeek} Lineup
            </h2>

            <div
              style={
                styles.sectionSubtitle
              }
            >
              {
                team.team_name
              }
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


        {displayPlayers.length ===
        0 ? (
          <div
            style={
              styles.emptyState
            }
          >
            This team does not
            have a lineup saved
            for Week{" "}
            {selectedWeek}.
          </div>
        ) : (
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
                  <th
                    style={{
                      ...styles.th,
                      textAlign:
                        "left",
                    }}
                  >
                    SLOT
                  </th>

                  <th
                    style={{
                      ...styles.th,
                      textAlign:
                        "left",
                    }}
                  >
                    PLAYER
                  </th>

                  <th
                    style={
                      styles.th
                    }
                  >
                    TEAM
                  </th>

                  <th
                    style={
                      styles.th
                    }
                  >
                    OPP
                  </th>

                  <th
                    style={
                      styles.th
                    }
                  >
                    PROJ
                  </th>

                  <th
                    style={
                      styles.th
                    }
                  >
                    PTS
                  </th>

                  {isSalaryLeague && (
                    <th
                      style={
                        styles.th
                      }
                    >
                      SALARY
                    </th>
                  )}

                  <th
                    style={
                      styles.th
                    }
                  >
                    GAME
                  </th>
                </tr>
              </thead>

              <tbody>
                {displayPlayers.map(
                  (
                    player
                  ) => (
                    <tr
                      key={
                        player.lineupId
                      }
                      style={
                        player.isHidden
                          ? styles.hiddenRow
                          : undefined
                      }
                    >
                      <td
                        style={{
                          ...styles.td,
                          textAlign:
                            "left",
                        }}
                      >
                        <span
                          style={
                            styles.slotBadge
                          }
                        >
                          {
                            player.slot
                          }
                        </span>
                      </td>

                      <td
                        style={{
                          ...styles.td,
                          textAlign:
                            "left",
                        }}
                      >
                        <div
                          style={
                            player.isHidden
                              ? styles.hiddenPlayerName
                              : styles.playerName
                          }
                        >
                          {
                            player.playerName
                          }
                        </div>

                        {!player.isHidden && (
                          <div
                            style={
                              styles.playerMeta
                            }
                          >
                            {
                              player.position
                            }

                            {player.jerseyNumber
                              ? ` • #${player.jerseyNumber}`
                              : ""}
                          </div>
                        )}
                      </td>

                      <td
                        style={
                          styles.td
                        }
                      >
                        {
                          player.isHidden
                            ? "—"
                            : player.nflTeam
                        }
                      </td>

                      <td
                        style={
                          styles.td
                        }
                      >
                        {
                          player.opponent
                        }
                      </td>

                      <td
                        style={
                          styles.td
                        }
                      >
                        {player.projectedPoints ===
                        null
                          ? "—"
                          : formatPoints(
                              player.projectedPoints
                            )}
                      </td>

                      <td
                        style={{
                          ...styles.td,
                          ...styles.pointsCell,
                        }}
                      >
                        {player.fantasyPoints ===
                        null
                          ? "—"
                          : formatPoints(
                              player.fantasyPoints
                            )}
                      </td>

                      {isSalaryLeague && (
                        <td
                          style={
                            styles.td
                          }
                        >
                          {player.salary ===
                          null
                            ? "—"
                            : formatMoney(
                                player.salary
                              )}
                        </td>
                      )}

                      <td
                        style={
                          styles.td
                        }
                      >
                        <span
                          style={{
                            ...styles.gameStatus,

                            ...getGameStatusStyle(
                              player
                            ),
                          }}
                        >
                          {getGameStatus(
                            player
                          )}
                        </span>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
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
      "24px 18px 64px",
  },

  backRow: {
    marginBottom:
      "18px",
  },

  backLink: {
    color:
      "#9097a3",

    fontSize:
      "11px",

    fontWeight:
      900,

    textDecoration:
      "none",
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
      "20px",
  },

  eyebrow: {
    marginBottom:
      "7px",

    color:
      "#ff7200",

    fontSize:
      "10px",

    fontWeight:
      1000,

    letterSpacing:
      ".14em",
  },

  teamTitleRow: {
    display:
      "flex",

    alignItems:
      "center",

    gap:
      "10px",

    flexWrap:
      "wrap" as const,
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

  youBadge: {
    padding:
      "5px 8px",

    borderRadius:
      "7px",

    background:
      "rgba(255,114,0,.12)",

    color:
      "#ff8a24",

    fontSize:
      "8px",

    fontWeight:
      1000,
  },

  subtitle: {
    maxWidth:
      "650px",

    margin:
      "8px 0 0",

    color:
      "#858c98",

    fontSize:
      "13px",

    lineHeight:
      1.5,
  },

  heroStats: {
    display:
      "flex",

    gap:
      "8px",

    flexWrap:
      "wrap" as const,
  },

  heroStat: {
    minWidth:
      "105px",

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
      "5px",

    color:
      "#737a86",

    fontSize:
      "8px",

    fontWeight:
      1000,

    letterSpacing:
      ".1em",
  },

  heroStatValue: {
    color:
      "#ffffff",

    fontSize:
      "18px",

    fontWeight:
      1000,
  },

  lockNotice: {
    display:
      "flex",

    alignItems:
      "center",

    gap:
      "12px",

    marginBottom:
      "14px",

    padding:
      "14px 16px",

    border:
      "1px solid rgba(255,114,0,.22)",

    borderRadius:
      "12px",

    background:
      "linear-gradient(90deg,rgba(255,72,0,.07),rgba(255,114,0,.025))",
  },

  lockIcon: {
    fontSize:
      "18px",
  },

  lockTitle: {
    color:
      "#ffffff",

    fontSize:
      "11px",

    fontWeight:
      1000,
  },

  lockText: {
    marginTop:
      "3px",

    color:
      "#888f9a",

    fontSize:
      "10px",

    fontWeight:
      700,
  },

  weekCard: {
    marginBottom:
      "14px",

    padding:
      "15px",

    border:
      "1px solid rgba(255,255,255,.08)",

    borderRadius:
      "14px",

    background:
      "linear-gradient(180deg,rgba(17,17,20,.96),rgba(10,10,12,.96))",
  },

  weekHeader: {
    display:
      "flex",

    justifyContent:
      "space-between",

    alignItems:
      "center",

    gap:
      "14px",

    marginBottom:
      "13px",
  },

  weekTitle: {
    color:
      "#ffffff",

    fontSize:
      "13px",

    fontWeight:
      1000,
  },

  weekText: {
    marginTop:
      "3px",

    color:
      "#747b87",

    fontSize:
      "10px",

    fontWeight:
      700,
  },

  currentWeekButton: {
    minHeight:
      "32px",

    display:
      "inline-flex",

    alignItems:
      "center",

    padding:
      "0 11px",

    border:
      "1px solid rgba(255,114,0,.3)",

    borderRadius:
      "8px",

    background:
      "rgba(255,114,0,.07)",

    color:
      "#ff8a24",

    fontSize:
      "9px",

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
  },

  weekButton: {
    flex:
      "0 0 auto",

    minWidth:
      "46px",

    minHeight:
      "35px",

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
  },

  summaryGrid: {
    display:
      "grid",

    gridTemplateColumns:
      "repeat(auto-fit,minmax(150px,1fr))",

    gap:
      "10px",

    marginBottom:
      "14px",
  },

  summaryCard: {
    padding:
      "14px",

    border:
      "1px solid rgba(255,255,255,.07)",

    borderRadius:
      "12px",

    background:
      "rgba(255,255,255,.022)",
  },

  summaryLabel: {
    display:
      "block",

    marginBottom:
      "6px",

    color:
      "#737a86",

    fontSize:
      "8px",

    fontWeight:
      1000,

    letterSpacing:
      ".1em",
  },

  summaryValue: {
    color:
      "#ffffff",

    fontSize:
      "16px",

    fontWeight:
      1000,
  },

  summaryValueOrange: {
    color:
      "#ff8a24",

    fontSize:
      "16px",

    fontWeight:
      1000,
  },

  lineupCard: {
    overflow:
      "hidden",

    border:
      "1px solid rgba(255,255,255,.08)",

    borderRadius:
      "16px",

    background:
      "linear-gradient(180deg,#111114,#09090b)",
  },

  lineupHeader: {
    display:
      "flex",

    justifyContent:
      "space-between",

    alignItems:
      "center",

    gap:
      "14px",

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
      "8px",

    fontWeight:
      1000,
  },

  tableWrap: {
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

    color:
      "#686f7b",

    fontSize:
      "8px",

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
      "14px",

    borderBottom:
      "1px solid rgba(255,255,255,.05)",

    color:
      "#bec2c9",

    fontSize:
      "11px",

    fontWeight:
      800,

    textAlign:
      "center" as const,

    whiteSpace:
      "nowrap" as const,
  },

  hiddenRow: {
    background:
      "rgba(255,255,255,.012)",
  },

  slotBadge: {
    display:
      "inline-flex",

    minWidth:
      "48px",

    minHeight:
      "28px",

    alignItems:
      "center",

    justifyContent:
      "center",

    border:
      "1px solid rgba(255,114,0,.25)",

    borderRadius:
      "7px",

    background:
      "rgba(255,114,0,.07)",

    color:
      "#ff8a24",

    fontSize:
      "9px",

    fontWeight:
      1000,
  },

  playerName: {
    color:
      "#ffffff",

    fontSize:
      "12px",

    fontWeight:
      1000,
  },

  hiddenPlayerName: {
    color:
      "#747b87",

    fontSize:
      "11px",

    fontWeight:
      900,

    fontStyle:
      "italic",
  },

  playerMeta: {
    marginTop:
      "3px",

    color:
      "#6f7682",

    fontSize:
      "9px",

    fontWeight:
      800,
  },

  pointsCell: {
    color:
      "#ffffff",

    fontSize:
      "13px",

    fontWeight:
      1000,
  },

  gameStatus: {
    display:
      "inline-flex",

    minWidth:
      "64px",

    justifyContent:
      "center",

    padding:
      "5px 7px",

    border:
      "1px solid rgba(255,255,255,.08)",

    borderRadius:
      "999px",

    background:
      "rgba(255,255,255,.03)",

    color:
      "#858c98",

    fontSize:
      "8px",

    fontWeight:
      1000,
  },

  statusHidden: {
    border:
      "1px solid rgba(255,255,255,.09)",

    background:
      "rgba(255,255,255,.025)",

    color:
      "#69707a",
  },

  statusLive: {
    border:
      "1px solid rgba(255,86,0,.35)",

    background:
      "rgba(255,70,0,.10)",

    color:
      "#ff7b32",
  },

  statusFinal: {
    border:
      "1px solid rgba(51,210,119,.25)",

    background:
      "rgba(51,210,119,.08)",

    color:
      "#56dc8c",
  },

  statusLocked: {
    border:
      "1px solid rgba(255,190,80,.22)",

    background:
      "rgba(255,190,80,.06)",

    color:
      "#e7b55e",
  },

  emptyState: {
    padding:
      "55px 20px",

    color:
      "#747b87",

    fontSize:
      "12px",

    fontWeight:
      800,

    textAlign:
      "center" as const,
  },
};