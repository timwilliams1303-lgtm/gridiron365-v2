import {
  notFound,
  redirect,
} from "next/navigation";

import SeasonLongWeeklyLineup from "@/components/season-long/SeasonLongWeeklyLineup";
import NflPlayoffsEntry from "@/components/nfl-playoffs/NflPlayoffsEntry";

import {
  requireLeagueMember,
} from "@/lib/leagues/requireLeagueMember";

import {
  createSupabaseServerClient,
} from "@/lib/supabase/server";


type PageProps = {
  params:
    Promise<{
      leagueId: string;
    }>;

  searchParams:
    Promise<{
      edit?: string;
    }>;
};


type SeasonLongSettingsRow = {
  season:
    number;

  competition_format:
    | "total_points"
    | "head_to_head";

  weekly_salary_cap:
    number | string | null;

  starting_qb:
    number;

  starting_rb:
    number;

  starting_wr:
    number;

  starting_te:
    number;

  starting_flex:
    number;

  starting_superflex:
    number;

  starting_k:
    number;

  starting_dst:
    number;
};


type WeeklyEntryRow = {
  week:
    number;

  status:
    string | null;

  salary_used:
    number | string | null;

  projected_points:
    number | string | null;

  submitted_at:
    string | null;
};


type WeeklyLineupRow = {
  player_id:
    number;

  lineup_slot:
    string;

  slot_index:
    number;

  salary_at_selection:
    number | string | null;

  projected_points_at_selection:
    number | string | null;

  is_locked:
    boolean;

  locked_at:
    string | null;

  nfl_game_id:
    number | null;

  game_start_at:
    string | null;

  opponent_abbreviation:
    string | null;

  home_or_away:
    string | null;
};


type SalaryRow = {
  nfl_player_id:
    number;

  salary:
    number | string | null;

  projected_points:
    number | string | null;

  salary_change:
    number | string | null;

  salary_change_percent:
    number | string | null;
};


type NflPlayerRow = {
  id:
    number;

  full_name:
    string;

  primary_position:
    string | null;

  team_abbreviation:
    string | null;

  status:
    string | null;

  is_active:
    boolean | null;
};


type WeeklyProjectionRow = {
  player_id:
    number;

  team_abbreviation:
    string | null;

  opponent_abbreviation:
    string | null;

  home_or_away:
    string | null;

  kickoff_at:
    string | null;

  is_bye:
    boolean | null;

  projected_points:
    number | string | null;
};


type MatchupRankingRow = {
  position:
    string;

  opponent_abbreviation:
    string;

  matchup_rank:
    number | null;
};


type InjuryRow = {
  nfl_player_id:
    number;

  status:
    string | null;

  injury_type:
    string | null;

  injury_location:
    string | null;

  injury_detail:
    string | null;

  return_date:
    string | null;
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


function projectionNumber(
  value:
    number |
    string |
    null |
    undefined
) {
  return Math.round(
    toNumber(value) * 10
  ) / 10;
}


function normalizePosition(
  value:
    string |
    null |
    undefined
) {
  const position =
    (value ?? "")
      .trim()
      .toUpperCase();

  if (
    position === "PK"
  ) {
    return "K";
  }

  if (
    position === "DEF" ||
    position === "D/ST"
  ) {
    return "DST";
  }

  return position;
}


function normalizeTeamAbbreviation(
  value:
    string |
    null |
    undefined
) {
  const abbreviation =
    (value ?? "")
      .trim()
      .toUpperCase();

  return abbreviation ||
    null;
}


export default async function SeasonLongEntryPage({
  params,
  searchParams,
}: PageProps) {
  const {
    leagueId,
  } =
    await params;

  const query =
    await searchParams;

  const editMode =
    query.edit ===
    "1";


  const access =
    await requireLeagueMember(
      leagueId
    );


  if (
    access.league.leagueType ===
    "nfl_playoffs"
  ) {
    return (
      <NflPlayoffsEntry
        leagueId={
          leagueId
        }
      />
    );
  }


  if (
    access.league.leagueType !==
    "season_long"
  ) {
    redirect(
      `/league/${leagueId}`
    );
  }


  const rawPlayerSelectionMode =
    access.league
      .playerSelectionMode;


  if (
    rawPlayerSelectionMode !==
      "salary" &&
    rawPlayerSelectionMode !==
      "no_salary"
  ) {
    redirect(
      `/league/${leagueId}`
    );
  }


  const playerSelectionMode:
    "salary" | "no_salary" =
      rawPlayerSelectionMode;


  if (
    !access.fantasyTeam
  ) {
    notFound();
  }


  const supabase =
    await createSupabaseServerClient();


  const fantasyTeamId =
    access.fantasyTeam.id;


  const season =
    access.league.season;


  const settingsResult =
    await supabase
      .from(
        "season_long_settings"
      )
      .select(`
        season,
        competition_format,
        weekly_salary_cap,
        starting_qb,
        starting_rb,
        starting_wr,
        starting_te,
        starting_flex,
        starting_superflex,
        starting_k,
        starting_dst
      `)
      .eq(
        "league_id",
        leagueId
      )
      .maybeSingle();


  if (
    settingsResult.error
  ) {
    throw new Error(
      settingsResult
        .error
        .message
    );
  }


  if (
    !settingsResult.data
  ) {
    throw new Error(
      "Season-Long settings have not been initialized for this league."
    );
  }


  const settings =
    settingsResult
      .data as SeasonLongSettingsRow;


  /*
   * The lifecycle creates one entry row per team/week.
   *
   * Until the lifecycle is connected to the page, the latest
   * prepared entry is the safest source for the active week.
   * New leagues fall back to Week 1.
   */
  /*
   * ============================================================
   * ACTIVE WEEK
   * ============================================================
   *
   * My Entry must use the league lifecycle's active week.  Do not
   * infer the current week from the highest prepared entry row:
   * future weeks may already be prepared before the active week is
   * finalized.
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


  const activeWeekValue =
    Number(
      activeWeekResult.data
    );


  const currentWeek =
    Number.isInteger(
      activeWeekValue
    ) &&
    activeWeekValue > 0
      ? activeWeekValue
      : 1;


  /*
   * ============================================================
   * HEAD-TO-HEAD MY ENTRY
   * ============================================================
   *
   * A Season-Long H2H league uses the matchup as the owner's
   * primary weekly experience, just like Traditional.
   *
   * /entry              -> current matchup
   * /entry?edit=1       -> weekly lineup builder
   *
   * A bye week has no two-team detail page, so My Entry remains
   * on the lineup builder for that week.
   */
  let currentMatchupHref:
    string |
    null =
      null;


  if (
    settings.competition_format ===
    "head_to_head"
  ) {
    const matchupResult =
      await supabase
        .from(
          "season_long_matchups"
        )
        .select(`
          id,
          matchup_type,
          home_fantasy_team_id,
          away_fantasy_team_id
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
          currentWeek
        )
        .in(
          "matchup_type",
          [
            "regular_season",
            "playoff",
          ]
        );


    if (
      matchupResult.error
    ) {
      throw new Error(
        matchupResult
          .error
          .message
      );
    }


    const myMatchups =
      (
        matchupResult.data ??
        []
      ).filter(
        (
          matchup
        ) =>
          matchup
            .home_fantasy_team_id ===
            fantasyTeamId ||
          matchup
            .away_fantasy_team_id ===
            fantasyTeamId
      );

    const myMatchup =
      myMatchups.find(
        (
          matchup
        ) =>
          matchup
            .matchup_type ===
          "playoff"
      ) ??
      myMatchups[0] ??
      null;


    if (
      myMatchup &&
      myMatchup
        .away_fantasy_team_id !==
        null
    ) {
      currentMatchupHref =
        `/league/${leagueId}/season-long/matchups/${myMatchup.id}`;

      if (
        !editMode
      ) {
        redirect(
          currentMatchupHref
        );
      }
    }
  }


  /*
   * Load only the entry for the lifecycle's active week.
   */
  const currentEntryResult =
    await supabase
      .from(
        "season_long_weekly_entries"
      )
      .select(`
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
        fantasyTeamId
      )
      .eq(
        "season",
        season
      )
      .eq(
        "week",
        currentWeek
      )
      .maybeSingle();


  if (
    currentEntryResult.error
  ) {
    throw new Error(
      currentEntryResult
        .error
        .message
    );
  }


  const currentEntry =
    currentEntryResult
      .data as WeeklyEntryRow | null;


  /*
   * Keep lock state current before loading the lineup.
   */
  const lockResult =
    await supabase.rpc(
      "sync_season_long_lineup_locks",
      {
        p_league_id:
          leagueId,

        p_season:
          season,

        p_week:
          currentWeek,
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


  const lineupResult =
    await supabase
      .from(
        "season_long_weekly_lineups"
      )
      .select(`
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
        fantasyTeamId
      )
      .eq(
        "season",
        season
      )
      .eq(
        "week",
        currentWeek
      )
      .order(
        "lineup_slot",
        {
          ascending:
            true,
        }
      )
      .order(
        "slot_index",
        {
          ascending:
            true,
        }
      );


  if (
    lineupResult.error
  ) {
    throw new Error(
      lineupResult
        .error
        .message
    );
  }


  const lineup =
    (
      lineupResult.data ??
      []
    ) as WeeklyLineupRow[];


  const isSalary =
    playerSelectionMode ===
    "salary";


  let salaries:
    SalaryRow[] = [];


  if (
    isSalary
  ) {
    /*
     * Salary pools can exceed Supabase/PostgREST's normal 1,000-row
     * response cap. Page through the entire salary table so valid
     * players are never omitted simply because they fall outside the
     * first response page. The final My Entry pool defaults to salary
     * order below; the client can also re-sort by projected points.
     */
    const salaryPageSize = 1000;

    for (
      let from = 0;
      ;
      from += salaryPageSize
    ) {
      const to =
        from +
        salaryPageSize -
        1;

      const salaryResult =
        await supabase
          .from(
            "season_long_player_salaries"
          )
          .select(`
            nfl_player_id,
            salary,
            projected_points,
            salary_change,
            salary_change_percent
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
            currentWeek
          )
          .order(
            "nfl_player_id",
            {
              ascending: true,
            }
          )
          .range(
            from,
            to
          );

      if (
        salaryResult.error
      ) {
        throw new Error(
          salaryResult
            .error
            .message
        );
      }

      const pageRows =
        (
          salaryResult.data ??
          []
        ) as SalaryRow[];

      salaries.push(
        ...pageRows
      );

      if (
        pageRows.length <
        salaryPageSize
      ) {
        break;
      }
    }
  }


  const salaryMap =
    new Map<
      number,
      SalaryRow
    >(
      salaries.map(
        (
          row
        ) => [
          row.nfl_player_id,
          row,
        ]
      )
    );


  /*
   * ============================================================
   * COMPLETE NFL PLAYER POOL
   * ============================================================
   *
   * My Entry must be based on nfl_players, not on salary or
   * projection coverage. Supporting rows are merged on afterward.
   * This keeps every fantasy-eligible NFL player visible even if a
   * salary/projection row is temporarily missing.
   */
  const players:
    NflPlayerRow[] = [];


  const nflPlayerPageSize =
    1000;


  for (
    let from = 0;
    ;
    from += nflPlayerPageSize
  ) {
    const to =
      from +
      nflPlayerPageSize -
      1;


    const playerPageResult =
      await supabase
        .from(
          "nfl_players"
        )
        .select(`
          id,
          full_name,
          primary_position,
          team_abbreviation,
          status,
          is_active
        `)
        .in(
          "primary_position",
          [
            "QB",
            "RB",
            "WR",
            "TE",
            "K",
            "PK",
            "DST",
            "DEF",
            "D/ST",
          ]
        )
        .order(
          "id",
          {
            ascending: true,
          }
        )
        .range(
          from,
          to
        );


    if (
      playerPageResult.error
    ) {
      throw new Error(
        playerPageResult
          .error
          .message
      );
    }


    const pageRows =
      (
        playerPageResult.data ??
        []
      ) as NflPlayerRow[];


    players.push(
      ...pageRows
    );


    if (
      pageRows.length <
      nflPlayerPageSize
    ) {
      break;
    }
  }



  const playerMap =
    new Map<
      number,
      NflPlayerRow
    >(
      players.map(
        (
          player
        ) => [
          player.id,
          player,
        ]
      )
    );


  /*
   * Make sure already-selected lineup players are always present
   * even if the salary/player pool changed after they were chosen.
   */
  const missingLineupPlayerIds =
    lineup
      .map(
        (
          row
        ) =>
          row.player_id
      )
      .filter(
        (
          playerId
        ) =>
          !playerMap.has(
            playerId
          )
      );


  if (
    missingLineupPlayerIds.length >
      0
  ) {
    const missingPlayerResult =
      await supabase
        .from(
          "nfl_players"
        )
        .select(`
          id,
          full_name,
          primary_position,
          team_abbreviation,
          status,
          is_active
        `)
        .in(
          "id",
          missingLineupPlayerIds
        );


    if (
      missingPlayerResult.error
    ) {
      throw new Error(
        missingPlayerResult
          .error
          .message
      );
    }


    for (
      const player of
        (
          missingPlayerResult.data ??
          []
        ) as NflPlayerRow[]
    ) {
      players.push(
        player
      );

      playerMap.set(
        player.id,
        player
      );
    }
  }


  /*
   * ============================================================
   * WEEK-SPECIFIC PLAYER CONTEXT
   * ============================================================
   *
   * Season-Long should show the matchup for the CURRENT fantasy
   * week, not a generic team label.  The weekly projection table
   * already carries opponent, home/away, kickoff and bye context.
   */
  /*
   * Supabase/PostgREST commonly caps a single SELECT response at
   * 1,000 rows.  Season-Long weekly projections contain far more
   * rows than that, so a one-shot query can silently omit matchup
   * context for otherwise valid players.
   *
   * Page through the entire week so every player can receive its
   * opponent, kickoff, bye state and matchup rank.
   */
  const weeklyProjectionRows:
    WeeklyProjectionRow[] = [];

  const weeklyProjectionPageSize =
    1000;

  for (
    let from = 0;
    ;
    from += weeklyProjectionPageSize
  ) {
    const to =
      from +
      weeklyProjectionPageSize -
      1;

    const weeklyProjectionPageResult =
      await supabase
        .from(
          "weekly_player_projections"
        )
        .select(`
          player_id,
          team_abbreviation,
          opponent_abbreviation,
          home_or_away,
          kickoff_at,
          is_bye,
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
          "season_type",
          2
        )
        .eq(
          "week",
          currentWeek
        )
        .order(
          "player_id",
          {
            ascending:
              true,
          }
        )
        .range(
          from,
          to
        );


    if (
      weeklyProjectionPageResult.error
    ) {
      throw new Error(
        weeklyProjectionPageResult
          .error
          .message
      );
    }


    const pageRows =
      (
        weeklyProjectionPageResult.data ??
        []
      ) as WeeklyProjectionRow[];


    weeklyProjectionRows.push(
      ...pageRows
    );


    if (
      pageRows.length <
      weeklyProjectionPageSize
    ) {
      break;
    }
  }


  const weeklyProjectionMap =
    new Map<
      number,
      WeeklyProjectionRow
    >(
      weeklyProjectionRows.map(
        (
          row
        ) => [
          row.player_id,
          row,
        ]
      )
    );


  /*
   * Position-specific matchup difficulty board.
   * #1 = hardest, #32 = easiest.
   */
  const matchupRankingResult =
    await supabase
      .from(
        "season_long_matchup_rankings"
      )
      .select(`
        position,
        opponent_abbreviation,
        matchup_rank
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
        currentWeek
      );


  if (matchupRankingResult.error) {
    throw new Error(
      matchupRankingResult.error.message
    );
  }


  const matchupRankMap =
    new Map<string, number>();


  for (
    const row of
      (matchupRankingResult.data ?? []) as MatchupRankingRow[]
  ) {
    if (
      row.matchup_rank !== null &&
      Number.isFinite(
        Number(row.matchup_rank)
      )
    ) {
      const normalizedPosition =
        normalizePosition(
          row.position
        );

      const normalizedOpponent =
        normalizeTeamAbbreviation(
          row.opponent_abbreviation
        );

      if (
        normalizedPosition &&
        normalizedOpponent
      ) {
        matchupRankMap.set(
          `${normalizedPosition}:${normalizedOpponent}`,
          Number(row.matchup_rank)
        );
      }
    }
  }


  const getMatchupRank = (
    playerId: number,
    opponent: string | null | undefined
  ) => {
    const normalizedOpponent =
      normalizeTeamAbbreviation(
        opponent
      );

    if (
      !normalizedOpponent
    ) {
      return null;
    }

    const position =
      normalizePosition(
        playerMap.get(playerId)
          ?.primary_position
      );

    if (
      !position
    ) {
      return null;
    }

    return matchupRankMap.get(
      `${position}:${normalizedOpponent}`
    ) ?? null;
  };


  /*
   * ESPN-synced injury designations live in nfl_player_injuries.
   * This is more useful than the generic nfl_players.status value
   * because it includes the actual designation and injury detail.
   */
  /*
   * Current injury rows are already scoped to active/current injury
   * records. Load the season directly instead of putting the entire
   * player pool into a large PostgREST IN clause.
   */
  const injuryResult =
    await supabase
      .from(
        "current_nfl_player_injuries"
      )
      .select(`
        nfl_player_id,
        status,
        injury_type,
        injury_location,
        injury_detail,
        return_date
      `)
      .eq(
        "season",
        season
      );


  if (
    injuryResult.error
  ) {
    throw new Error(
      injuryResult
        .error
        .message
    );
  }


  const injuryRows =
    (
      injuryResult.data ??
      []
    ) as InjuryRow[];


  const injuryMap =
    new Map<
      number,
      InjuryRow
    >(
      injuryRows.map(
        (
          row
        ) => [
          row.nfl_player_id,
          row,
        ]
      )
    );


  const lineupForClient =
    lineup.map(
      (
        row
      ) => {
        const player =
          playerMap.get(
            row.player_id
          );

        const weeklyProjection =
          weeklyProjectionMap.get(
            row.player_id
          );

        const injury =
          injuryMap.get(
            row.player_id
          );


        return {
          playerId:
            row.player_id,

          name:
            player
              ?.full_name ??
            `Player ${row.player_id}`,

          position:
            normalizePosition(
              player
                ?.primary_position
            ),

          teamAbbreviation:
            player
              ?.team_abbreviation ??
            null,

          injuryStatus:
            injury
              ?.status ??
            null,

          injuryType:
            injury
              ?.injury_type ??
            injury
              ?.injury_location ??
            null,

          injuryDetail:
            injury
              ?.injury_detail ??
            null,

          byeWeek:
            weeklyProjection
              ?.is_bye
              ? currentWeek
              : null,

          lineupSlot:
            row.lineup_slot,

          slotIndex:
            row.slot_index,

          salary:
            row.salary_at_selection ===
            null
              ? null
              : toNumber(
                  row.salary_at_selection
                ),

          projectedPoints:
            projectionNumber(
              weeklyProjection
                ?.projected_points ??
              salaryMap.get(
                row.player_id
              )
                ?.projected_points ??
              row.projected_points_at_selection
            ),

          isLocked:
            Boolean(
              row.is_locked
            ),

          lockedAt:
            row.locked_at,

          nflGameId:
            row.nfl_game_id,

          gameStartAt:
            row.game_start_at ??
            weeklyProjection
              ?.kickoff_at ??
            null,

          opponentAbbreviation:
            row.opponent_abbreviation ??
            weeklyProjection
              ?.opponent_abbreviation ??
            null,

          homeOrAway:
            row.home_or_away ??
            weeklyProjection
              ?.home_or_away ??
            null,

          matchupRank:
            getMatchupRank(
              row.player_id,
              row.opponent_abbreviation ??
              weeklyProjection
                ?.opponent_abbreviation
            ),
        };
      }
    );


  const poolForClient =
    players
      .filter(
        (
          player
        ) => {
          const position =
            (
              player.primary_position ??
              ""
            ).toUpperCase();

          return [
            "QB",
            "RB",
            "WR",
            "TE",
            "K",
            "PK",
            "DST",
            "DEF",
            "D/ST",
          ].includes(
            position
          );
        }
      )
      .map(
        (
          player
        ) => {
          const salary =
            salaryMap.get(
              player.id
            );

          const weeklyProjection =
            weeklyProjectionMap.get(
              player.id
            );

          const injury =
            injuryMap.get(
              player.id
            );

          return {
            id:
              player.id,

            name:
              player.full_name,

            position:
              normalizePosition(
                player.primary_position
              ),

            teamAbbreviation:
              player.team_abbreviation,

            injuryStatus:
              injury?.status ?? null,

            injuryType:
              injury
                ?.injury_type ??
              injury
                ?.injury_location ??
              null,

            injuryDetail:
              injury
                ?.injury_detail ??
              null,

            opponentAbbreviation:
              weeklyProjection
                ?.opponent_abbreviation ??
              null,

            homeOrAway:
              weeklyProjection
                ?.home_or_away ??
              null,

            matchupRank:
              getMatchupRank(
                player.id,
                weeklyProjection
                  ?.opponent_abbreviation
              ),

            gameStartAt:
              weeklyProjection
                ?.kickoff_at ??
              null,

            isBye:
              Boolean(
                weeklyProjection
                  ?.is_bye
              ),

            byeWeek:
              weeklyProjection
                ?.is_bye
                ? currentWeek
                : null,

            salary:
              isSalary
                ? salary
                    ?.salary ===
                    null ||
                  salary
                    ?.salary ===
                    undefined
                  ? null
                  : toNumber(
                      salary.salary
                    )
                : null,

            projectedPoints:
              projectionNumber(
                weeklyProjection
                  ?.projected_points ??
                salary
                  ?.projected_points
              ),

            salaryChange:
              isSalary &&
              salary
                ?.salary_change !==
                null &&
              salary
                ?.salary_change !==
                undefined
                ? toNumber(
                    salary.salary_change
                  )
                : null,

            salaryChangePercent:
              isSalary &&
              salary
                ?.salary_change_percent !==
                null &&
              salary
                ?.salary_change_percent !==
                undefined
                ? toNumber(
                    salary.salary_change_percent
                  )
                : null,

            isActive:
              player.is_active !==
              false,
          };
        }
      )
      .sort(
        (
          a,
          b
        ) => {
          /*
           * Salary leagues default Available Players to highest salary.
           * No-Salary leagues keep the existing projected-points order.
           */
          if (isSalary) {
            if (a.salary === null && b.salary !== null) {
              return 1;
            }

            if (b.salary === null && a.salary !== null) {
              return -1;
            }

            const salaryDifference =
              (b.salary ?? 0) -
              (a.salary ?? 0);

            if (salaryDifference !== 0) {
              return salaryDifference;
            }
          }

          const projectionDifference =
            b.projectedPoints -
            a.projectedPoints;

          if (projectionDifference !== 0) {
            return projectionDifference;
          }

          return a.name.localeCompare(
            b.name
          );
        }
      );


  return (
    <SeasonLongWeeklyLineup
      leagueId={
        leagueId
      }
      leagueName={
        access.league.name
      }
      fantasyTeamId={
        fantasyTeamId
      }
      fantasyTeamName={
        access.fantasyTeam
          .teamName
      }
      season={
        season
      }
      week={
        currentWeek
      }
      playerSelectionMode={
        playerSelectionMode
      }
      settings={{
        weeklySalaryCap:
          toNumber(
            settings.weekly_salary_cap
          ),

        startingQb:
          settings.starting_qb,

        startingRb:
          settings.starting_rb,

        startingWr:
          settings.starting_wr,

        startingTe:
          settings.starting_te,

        startingFlex:
          settings.starting_flex,

        startingSuperflex:
          settings.starting_superflex,

        startingK:
          settings.starting_k,

        startingDst:
          settings.starting_dst,
      }}
      entry={
        currentEntry
          ? {
              status:
                currentEntry.status,

              salaryUsed:
                currentEntry.salary_used ===
                null
                  ? null
                  : toNumber(
                      currentEntry.salary_used
                    ),

              projectedPoints:
                projectionNumber(
                  currentEntry.projected_points
                ),

              submittedAt:
                currentEntry.submitted_at,
            }
          : null
      }
      initialLineup={
        lineupForClient
      }
      playerPool={
        poolForClient
      }
    />
  );
}