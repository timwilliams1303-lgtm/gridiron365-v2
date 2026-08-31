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


type PageProps = {
  params:
    Promise<{
      leagueId: string;
    }>;
};


type SeasonLongSettingsRow = {
  season:
    number;

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

  injury_status:
    string | null;

  bye_week:
    number | null;

  projected_points:
    number | string | null;

  is_active:
    boolean | null;
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


export default async function SeasonLongEntryPage({
  params,
}: PageProps) {
  const {
    leagueId,
  } =
    await params;


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
      "no_salary"
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
  const latestEntryResult =
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
      .order(
        "week",
        {
          ascending:
            false,
        }
      )
      .limit(
        1
      )
      .maybeSingle();


  if (
    latestEntryResult.error
  ) {
    throw new Error(
      latestEntryResult
        .error
        .message
    );
  }


  const currentEntry =
    latestEntryResult
      .data as WeeklyEntryRow | null;


  const currentWeek =
    currentEntry
      ?.week ??
    1;


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
          "projected_points",
          {
            ascending:
              false,
          }
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


    salaries =
      (
        salaryResult.data ??
        []
      ) as SalaryRow[];
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


  const playerIds =
    Array.from(
      new Set(
        [
          ...lineup.map(
            (
              row
            ) =>
              row.player_id
          ),

          ...salaries.map(
            (
              row
            ) =>
              row.nfl_player_id
          ),
        ]
      )
    );


  let players:
    NflPlayerRow[] = [];


  if (
    isSalary &&
    playerIds.length >
      0
  ) {
    const playerResult =
      await supabase
        .from(
          "nfl_players"
        )
        .select(`
          id,
          full_name,
          primary_position,
          team_abbreviation,
          injury_status,
          bye_week,
          projected_points,
          is_active
        `)
        .in(
          "id",
          playerIds
        );


    if (
      playerResult.error
    ) {
      throw new Error(
        playerResult
          .error
          .message
      );
    }


    players =
      (
        playerResult.data ??
        []
      ) as NflPlayerRow[];

  } else {
    /*
     * No-Salary leagues do not require a generated salary row,
     * so load the active NFL player pool directly.
     */
    const playerResult =
      await supabase
        .from(
          "nfl_players"
        )
        .select(`
          id,
          full_name,
          primary_position,
          team_abbreviation,
          injury_status,
          bye_week,
          projected_points,
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
          "projected_points",
          {
            ascending:
              false,
            nullsFirst:
              false,
          }
        )
        .limit(
          1200
        );


    if (
      playerResult.error
    ) {
      throw new Error(
        playerResult
          .error
          .message
      );
    }


    players =
      (
        playerResult.data ??
        []
      ) as NflPlayerRow[];
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
          injury_status,
          bye_week,
          projected_points,
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


  const lineupForClient =
    lineup.map(
      (
        row
      ) => {
        const player =
          playerMap.get(
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
            (
              player
                ?.primary_position ??
              ""
            ).toUpperCase(),

          teamAbbreviation:
            player
              ?.team_abbreviation ??
            null,

          injuryStatus:
            player
              ?.injury_status ??
            null,

          byeWeek:
            player
              ?.bye_week ??
            null,

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
            toNumber(
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
            row.game_start_at,

          opponentAbbreviation:
            row.opponent_abbreviation,

          homeOrAway:
            row.home_or_away,
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

          return {
            id:
              player.id,

            name:
              player.full_name,

            position:
              (
                player.primary_position ??
                ""
              ).toUpperCase(),

            teamAbbreviation:
              player.team_abbreviation,

            injuryStatus:
              player.injury_status,

            byeWeek:
              player.bye_week,

            salary:
              isSalary
                ? toNumber(
                    salary
                      ?.salary
                  )
                : null,

            projectedPoints:
              isSalary
                ? toNumber(
                    salary
                      ?.projected_points
                  )
                : toNumber(
                    player.projected_points
                  ),

            salaryChange:
              isSalary
                ? toNumber(
                    salary
                      ?.salary_change
                  )
                : null,

            salaryChangePercent:
              isSalary
                ? toNumber(
                    salary
                      ?.salary_change_percent
                  )
                : null,

            isActive:
              player.is_active !==
              false,
          };
        }
      )
      .filter(
        (
          player
        ) =>
          !isSalary ||
          (
            player.salary !==
            null &&
            player.salary >
              0
          )
      )
      .sort(
        (
          a,
          b
        ) =>
          b.projectedPoints -
          a.projectedPoints
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
                toNumber(
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
