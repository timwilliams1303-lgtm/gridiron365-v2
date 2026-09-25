import {
  notFound,
  redirect,
} from "next/navigation";

import SeasonLongWeeklyLineup from "@/components/season-long/SeasonLongWeeklyLineup";

import {
  requireLeagueMember,
} from "@/lib/leagues/requireLeagueMember";

import {
  createSupabaseServerClient,
} from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  params: Promise<{
    leagueId: string;
  }>;
};

type UnknownRecord =
  Record<string, unknown>;

function asRecord(
  value: unknown
): UnknownRecord {
  if (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    return value as UnknownRecord;
  }

  return {};
}

function asNumber(
  value: unknown,
  fallback = 0
): number {
  if (
    typeof value === "number" &&
    Number.isFinite(value)
  ) {
    return value;
  }

  if (
    typeof value === "string" &&
    value.trim() !== ""
  ) {
    const parsed =
      Number(value);

    if (
      Number.isFinite(parsed)
    ) {
      return parsed;
    }
  }

  return fallback;
}

function asNullableNumber(
  value: unknown
): number | null {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const parsed =
    Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : null;
}

function asString(
  value: unknown,
  fallback = ""
): string {
  return typeof value === "string"
    ? value
    : fallback;
}

function asNullableString(
  value: unknown
): string | null {
  return (
    typeof value === "string" &&
    value.trim() !== ""
  )
    ? value
    : null;
}

function asBoolean(
  value: unknown,
  fallback = false
): boolean {
  return typeof value === "boolean"
    ? value
    : fallback;
}

/*
 * Supabase/PostgREST commonly caps a SELECT response at 1,000 rows.
 * The NFL player/context tables are larger than that, so matchup data
 * must be loaded in pages or some players will randomly appear as TBD.
 */
const PAGE_SIZE = 1000;

async function loadAllRows(
  makeQuery: (
    from: number,
    to: number
  ) => PromiseLike<{
    data: unknown[] | null;
    error: {
      message: string;
    } | null;
  }>
): Promise<unknown[]> {
  const rows: unknown[] = [];

  for (
    let from = 0;
    ;
    from += PAGE_SIZE
  ) {
    const to =
      from +
      PAGE_SIZE -
      1;

    const {
      data,
      error,
    } = await makeQuery(
      from,
      to
    );

    if (error) {
      throw new Error(
        error.message
      );
    }

    const page =
      data ?? [];

    rows.push(
      ...page
    );

    if (
      page.length <
      PAGE_SIZE
    ) {
      break;
    }
  }

  return rows;
}

export default async function SeasonLongMyEntryPage({
  params,
}: PageProps) {
  const {
    leagueId,
  } = await params;

  /*
   * =========================================================
   * ACCESS
   * =========================================================
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

  const playerSelectionMode =
    access.league
      .playerSelectionMode;

  if (
    playerSelectionMode !==
      "salary" &&
    playerSelectionMode !==
      "no_salary" &&
    playerSelectionMode !==
      "draft"
  ) {
    redirect(
      `/league/${leagueId}`
    );
  }

  if (
    !access.fantasyTeam
  ) {
    notFound();
  }

  /*
   * requireLeagueMember handles access/membership.
   * Create the authenticated server client separately.
   */

  const supabase =
    await createSupabaseServerClient();

  const fantasyTeamId =
    access.fantasyTeam.id;

  const fantasyTeamName =
    access.fantasyTeam.teamName;

  const leagueName =
    access.league.name;

  const season =
    access.league.season;

  /*
   * =========================================================
   * ACTIVE WEEK
   * =========================================================
   */

  let week = 1;

  const {
    data: activeWeekData,
    error: activeWeekError,
  } = await supabase.rpc(
    "get_active_season_long_week",
    {
      p_season:
        season,
    }
  );

  if (
    activeWeekError
  ) {
    console.warn(
      "Could not load active Season-Long week:",
      activeWeekError.message
    );
  } else {
    const activeWeek =
      asNumber(
        activeWeekData,
        1
      );

    if (
      Number.isInteger(
        activeWeek
      ) &&
      activeWeek > 0
    ) {
      week =
        activeWeek;
    }
  }

  /*
   * =========================================================
   * INITIALIZE WEEKLY ENTRY
   * =========================================================
   */

  const {
    error:
      initializeError,
  } = await supabase.rpc(
    "initialize_season_long_weekly_entries",
    {
      p_league_id:
        leagueId,

      p_season:
        season,

      p_week:
        week,
    }
  );

  if (
    initializeError
  ) {
    console.warn(
      "Season-Long weekly entry initialization warning:",
      initializeError.message
    );
  }

  /*
   * =========================================================
   * SETTINGS
   * =========================================================
   */

  const {
    data:
      settingsData,
    error:
      settingsError,
  } = await supabase
    .from(
      "season_long_settings"
    )
    .select(`
      weekly_salary_cap,
      starting_qb,
      starting_rb,
      starting_wr,
      starting_te,
      starting_flex,
      starting_superflex,
      starting_k,
      starting_dst,
      competition_format
    `)
    .eq(
      "league_id",
      leagueId
    )
    .eq(
      "season",
      season
    )
    .maybeSingle();

  if (
    settingsError
  ) {
    throw new Error(
      `Could not load Season-Long settings: ${settingsError.message}`
    );
  }

  if (
    !settingsData
  ) {
    throw new Error(
      `Season-Long settings were not found for the ${season} season.`
    );
  }

  const settingsRow =
    asRecord(
      settingsData
    );

  const settings = {
    weeklySalaryCap:
      asNumber(
        settingsRow
          .weekly_salary_cap,
        0
      ),

    startingQb:
      asNumber(
        settingsRow
          .starting_qb,
        1
      ),

    startingRb:
      asNumber(
        settingsRow
          .starting_rb,
        2
      ),

    startingWr:
      asNumber(
        settingsRow
          .starting_wr,
        2
      ),

    startingTe:
      asNumber(
        settingsRow
          .starting_te,
        1
      ),

    startingFlex:
      asNumber(
        settingsRow
          .starting_flex,
        0
      ),

    startingSuperflex:
      asNumber(
        settingsRow
          .starting_superflex,
        0
      ),

    startingK:
      asNumber(
        settingsRow
          .starting_k,
        1
      ),

    startingDst:
      asNumber(
        settingsRow
          .starting_dst,
        1
      ),
  };

  const competitionFormat =
    asString(
      settingsRow
        .competition_format,
      "total_points"
    );

  /*
   * =========================================================
   * WEEKLY ENTRY
   * =========================================================
   */

  const {
    data:
      entryData,
    error:
      entryError,
  } = await supabase
    .from(
      "season_long_weekly_entries"
    )
    .select(`
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
      week
    )
    .maybeSingle();

  if (
    entryError
  ) {
    throw new Error(
      `Could not load your weekly entry: ${entryError.message}`
    );
  }

  const entryRow =
    asRecord(
      entryData
    );

  const entry =
    entryData
      ? {
          status:
            asNullableString(
              entryRow.status
            ),

          salaryUsed:
            asNullableNumber(
              entryRow
                .salary_used
            ),

          projectedPoints:
            asNumber(
              entryRow
                .projected_points,
              0
            ),

          submittedAt:
            asNullableString(
              entryRow
                .submitted_at
            ),
        }
      : null;

  /*
   * =========================================================
   * WEEKLY PLAYER CONTEXT
   * =========================================================
   */

  let contextData:
    unknown[] = [];

  try {
    contextData =
      await loadAllRows(
        (
          from,
          to
        ) =>
          supabase
            .from(
              "g365_weekly_player_context"
            )
            .select(`
              player_id,
              opponent_abbreviation,
              home_or_away,
              kickoff_at,
              is_bye,
              raw_projected_points,
              calculation_details
            `)
            .eq(
              "season",
              season
            )
            .eq(
              "week",
              week
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
            )
      );
  } catch (
    error
  ) {
    throw new Error(
      `Could not load weekly player context: ${
        error instanceof Error
          ? error.message
          : "Unknown error"
      }`
    );
  }

  const contextByPlayer =
    new Map<
      number,
      UnknownRecord
    >();

  for (
    const rawRow of
      contextData ?? []
  ) {
    const row =
      asRecord(
        rawRow
      );

    const playerId =
      asNumber(
        row.player_id
      );

    if (
      playerId > 0
    ) {
      contextByPlayer.set(
        playerId,
        row
      );
    }
  }

  /*
   * =========================================================
   * LEAGUE WEEKLY PROJECTION CONTEXT
   * =========================================================
   *
   * g365_weekly_player_context is shared context. In the app,
   * RLS can legitimately return no shared rows even though the
   * projection engine populated them. weekly_player_projections
   * is league-scoped and contains the same game/matchup context.
   *
   * Merge the league-scoped row over the shared row so the UI
   * always receives opponent/home-away/kickoff/bye information
   * for the current league and week.
   * =========================================================
   */

  let leagueProjectionData:
    unknown[] = [];

  try {
    leagueProjectionData =
      await loadAllRows(
        (
          from,
          to
        ) =>
          supabase
            .from(
              "weekly_player_projections"
            )
            .select(`
              player_id,
              opponent_abbreviation,
              home_or_away,
              kickoff_at,
              is_bye,
              projected_points,
              calculation_details
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
              week
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
            )
      );
  } catch (
    error
  ) {
    throw new Error(
      `Could not load league weekly projections: ${
        error instanceof Error
          ? error.message
          : "Unknown error"
      }`
    );
  }

  for (
    const rawRow of
      leagueProjectionData ?? []
  ) {
    const row =
      asRecord(
        rawRow
      );

    const playerId =
      asNumber(
        row.player_id
      );

    if (
      playerId <= 0
    ) {
      continue;
    }

    const shared =
      contextByPlayer.get(
        playerId
      ) ?? {};

    contextByPlayer.set(
      playerId,
      {
        ...shared,

        opponent_abbreviation:
          row.opponent_abbreviation ??
          shared.opponent_abbreviation ??
          null,

        home_or_away:
          row.home_or_away ??
          shared.home_or_away ??
          null,

        kickoff_at:
          row.kickoff_at ??
          shared.kickoff_at ??
          null,

        is_bye:
          row.is_bye ??
          shared.is_bye ??
          false,

        raw_projected_points:
          row.projected_points ??
          shared.raw_projected_points ??
          null,

        calculation_details:
          row.calculation_details ??
          shared.calculation_details ??
          null,
      }
    );
  }

  /*
   * =========================================================
   * MATCHUP RANKINGS
   * =========================================================
   */

  const {
    data:
      rankingData,
    error:
      rankingError,
  } = await supabase
    .from(
      "season_long_matchup_rankings"
    )
    .select(`
      opponent_abbreviation,
      matchup_rank
    `)
    .eq(
      "season",
      season
    )
    .eq(
      "week",
      week
    );

  if (
    rankingError
  ) {
    console.warn(
      "Season-Long matchup rankings could not be loaded:",
      rankingError.message
    );
  }

  const rankingByOpponent =
    new Map<
      string,
      number
    >();

  for (
    const rawRow of
      rankingData ?? []
  ) {
    const row =
      asRecord(
        rawRow
      );

    const opponent =
      asNullableString(
        row
          .opponent_abbreviation
      );

    if (
      !opponent
    ) {
      continue;
    }

    rankingByOpponent.set(
      opponent,
      asNumber(
        row.matchup_rank
      )
    );
  }

  /*
   * =========================================================
   * SELECTED LINEUP
   * =========================================================
   */

  const {
    data:
      lineupData,
    error:
      lineupError,
  } = await supabase
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
      week
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
    lineupError
  ) {
    throw new Error(
      `Could not load your weekly lineup: ${lineupError.message}`
    );
  }

  /*
   * =========================================================
   * LOAD NFL PLAYERS
   * =========================================================
   */

  let playerData:
    unknown[] = [];

  try {
    playerData =
      await loadAllRows(
        (
          from,
          to
        ) =>
          supabase
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
            .eq(
              "is_active",
              true
            )
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
              ]
            )
            .order(
              "id",
              {
                ascending:
                  true,
              }
            )
            .range(
              from,
              to
            )
      );
  } catch (
    error
  ) {
    throw new Error(
      `Could not load NFL players: ${
        error instanceof Error
          ? error.message
          : "Unknown error"
      }`
    );
  }

  /*
   * Create one player lookup so we do not depend on a
   * PostgREST relationship between weekly_lineups and
   * nfl_players.
   */

  const playerById =
    new Map<
      number,
      UnknownRecord
    >();

  for (
    const rawPlayer of
      playerData ?? []
  ) {
    const player =
      asRecord(
        rawPlayer
      );

    const playerId =
      asNumber(
        player.id
      );

    if (
      playerId > 0
    ) {
      playerById.set(
        playerId,
        player
      );
    }
  }

  /*
   * =========================================================
   * BUILD INITIAL LINEUP
   * =========================================================
   */

  const initialLineup =
    (
      lineupData ?? []
    ).map(
      (
        rawRow:
          unknown
      ) => {
        const row =
          asRecord(
            rawRow
          );

        const playerId =
          asNumber(
            row.player_id
          );

        const player =
          playerById.get(
            playerId
          ) ?? {};

        const context =
          contextByPlayer.get(
            playerId
          ) ?? {};

        const opponentAbbreviation =
          asNullableString(
            row
              .opponent_abbreviation
          ) ??
          asNullableString(
            context
              .opponent_abbreviation
          );

        const isBye =
          asBoolean(
            context.is_bye,
            false
          );

        const calculationDetails =
          asRecord(
            context.calculation_details
          );

        const contextMatchupRank =
          asNullableNumber(
            calculationDetails.matchupRank
          );

        const matchupDifficulty =
          asNullableString(
            calculationDetails.matchupDifficulty
          );

        return {
          playerId,

          name:
            asString(
              player.full_name,
              "Unknown Player"
            ),

          position:
            asString(
              player
                .primary_position,
              ""
            ),

          teamAbbreviation:
            asNullableString(
              player
                .team_abbreviation
            ),

          injuryStatus:
            null,

          injuryType:
            null,

          injuryDetail:
            null,

          byeWeek:
            isBye
              ? week
              : null,

          lineupSlot:
            asString(
              row.lineup_slot
            ),

          slotIndex:
            asNumber(
              row.slot_index,
              1
            ),

          salary:
            asNullableNumber(
              row
                .salary_at_selection
            ),

          projectedPoints:
            asNumber(
              row
                .projected_points_at_selection ??
                context
                  .raw_projected_points,
              0
            ),

          isLocked:
            asBoolean(
              row.is_locked
            ),

          lockedAt:
            asNullableString(
              row.locked_at
            ),

          nflGameId:
            asNullableNumber(
              row.nfl_game_id
            ),

          gameStartAt:
            asNullableString(
              row.game_start_at
            ) ??
            asNullableString(
              context.kickoff_at
            ),

          opponentAbbreviation,

          homeOrAway:
            asNullableString(
              row.home_or_away
            ) ??
            asNullableString(
              context
                .home_or_away
            ),

          matchupRank:
            contextMatchupRank ??
            (
              opponentAbbreviation
                ? (
                    rankingByOpponent.get(
                      opponentAbbreviation
                    ) ??
                    null
                  )
                : null
            ),

          matchupDifficulty,

          isBye,
        };
      }
    );

  /*
   * =========================================================
   * WEEKLY SALARIES
   * =========================================================
   */

  const {
    data:
      salaryData,
    error:
      salaryError,
  } = await supabase
    .from(
      "season_long_player_salaries"
    )
    .select(`
      nfl_player_id,
      salary,
      projected_points,
      previous_week_salary,
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
      week
    );

  if (
    salaryError &&
    playerSelectionMode ===
      "salary"
  ) {
    throw new Error(
      `Could not load weekly player salaries: ${salaryError.message}`
    );
  }

  if (
    salaryError &&
    playerSelectionMode !==
      "salary"
  ) {
    console.warn(
      "Season-Long salary rows could not be loaded:",
      salaryError.message
    );
  }

  const salaryByPlayer =
    new Map<
      number,
      UnknownRecord
    >();

  for (
    const rawRow of
      salaryData ?? []
  ) {
    const row =
      asRecord(
        rawRow
      );

    const playerId =
      asNumber(
        row.nfl_player_id
      );

    if (
      playerId > 0
    ) {
      salaryByPlayer.set(
        playerId,
        row
      );
    }
  }

  /*
   * =========================================================
   * BUILD PLAYER POOL
   * =========================================================
   *
   * IMPORTANT:
   * PoolPlayer requires isActive.
   *
   * SeasonLongWeeklyLineup also filters with:
   *
   *   if (!player.isActive) return false;
   *
   * Therefore this value MUST be mapped from nfl_players.is_active.
   * Without it, every player is filtered out.
   * =========================================================
   */

  const playerPool =
    (
      playerData ?? []
    ).map(
      (
        rawPlayer:
          unknown
      ) => {
        const player =
          asRecord(
            rawPlayer
          );

        const playerId =
          asNumber(
            player.id
          );

        const context =
          contextByPlayer.get(
            playerId
          ) ?? {};

        const salary =
          salaryByPlayer.get(
            playerId
          ) ?? {};

        const opponentAbbreviation =
          asNullableString(
            context
              .opponent_abbreviation
          );

        const isBye =
          asBoolean(
            context.is_bye,
            false
          );

        const calculationDetails =
          asRecord(
            context.calculation_details
          );

        const contextMatchupRank =
          asNullableNumber(
            calculationDetails.matchupRank
          );

        const matchupDifficulty =
          asNullableString(
            calculationDetails.matchupDifficulty
          );

        const salaryProjection =
          asNullableNumber(
            salary
              .projected_points
          );

        const contextProjection =
          asNullableNumber(
            context
              .raw_projected_points
          );

        return {
          id:
            playerId,

          name:
            asString(
              player.full_name,
              "Unknown Player"
            ),

          position:
            asString(
              player
                .primary_position,
              ""
            ),

          teamAbbreviation:
            asNullableString(
              player
                .team_abbreviation
            ),

          /*
           * FIX:
           * This field was missing before.
           */
          isActive:
            asBoolean(
              player.is_active,
              false
            ),

          injuryStatus:
            null,

          injuryType:
            null,

          injuryDetail:
            null,

          byeWeek:
            isBye
              ? week
              : null,

          salary:
            asNullableNumber(
              salary.salary
            ),

          projectedPoints:
            salaryProjection ??
            contextProjection ??
            0,

          salaryChange:
            asNullableNumber(
              salary
                .salary_change
            ),

          salaryChangePercent:
            asNullableNumber(
              salary
                .salary_change_percent
            ),

          isBye,

          gameStartAt:
            asNullableString(
              context.kickoff_at
            ),

          opponentAbbreviation,

          homeOrAway:
            asNullableString(
              context
                .home_or_away
            ),

          matchupRank:
            contextMatchupRank ??
            (
              opponentAbbreviation
                ? (
                    rankingByOpponent.get(
                      opponentAbbreviation
                    ) ??
                    null
                  )
                : null
            ),

          matchupDifficulty,
        };
      }
    );

  /*
   * =========================================================
   * MATCHUP LINK
   * =========================================================
   */

  const matchupHref =
    competitionFormat ===
    "head_to_head"
      ? `/league/${leagueId}/season-long/matchups`
      : null;

  /*
   * =========================================================
   * RENDER
   * =========================================================
   */

  return (
    <SeasonLongWeeklyLineup
      leagueId={
        leagueId
      }
      leagueName={
        leagueName
      }
      fantasyTeamId={
        fantasyTeamId
      }
      fantasyTeamName={
        fantasyTeamName
      }
      season={
        season
      }
      week={
        week
      }
      playerSelectionMode={
        playerSelectionMode
      }
      settings={
        settings
      }
      entry={
        entry
      }
      initialLineup={
        initialLineup
      }
      playerPool={
        playerPool
      }
      matchupHref={
        matchupHref
      }
    />
  );
}