import {
  notFound,
} from "next/navigation";

import NflPlayoffsRoundLineup from "@/components/nfl-playoffs/NflPlayoffsRoundLineup";

import {
  requireLeagueMember,
} from "@/lib/leagues/requireLeagueMember";

import {
  createSupabaseServerClient,
} from "@/lib/supabase/server";


type Props = {
  leagueId: string;
};


type SettingsRow = {
  weekly_salary_cap:
    number |
    string |
    null;

  starting_qb: number;
  starting_rb: number;
  starting_wr: number;
  starting_te: number;
  starting_flex: number;
  starting_superflex: number;
  starting_k: number;
  starting_dst: number;
};


type StateRow = {
  active_round:
    number;

  status:
    string |
    null;
};


type EntryRow = {
  status:
    string |
    null;

  salary_used:
    number |
    string |
    null;

  projected_points:
    number |
    string |
    null;

  submitted_at:
    string |
    null;
};


type LineupRow = {
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

  is_locked:
    boolean;

  locked_at:
    string |
    null;
};


type ProjectionRow = {
  nfl_player_id:
    number;

  team_abbreviation:
    string |
    null;

  position:
    string |
    null;

  opponent_abbreviation:
    string |
    null;

  home_or_away:
    string |
    null;

  kickoff_at:
    string |
    null;

  injury_status:
    string |
    null;

  is_available:
    boolean;

  projected_points:
    number |
    string |
    null;
};


type SalaryRow = {
  nfl_player_id:
    number;

  salary:
    number |
    string |
    null;

  projected_points:
    number |
    string |
    null;

  previous_round_salary:
    number |
    string |
    null;
};


type SalaryStateRow = {
  is_locked:
    boolean;

  generated_at:
    string |
    null;

  locked_at:
    string |
    null;
};


type PlayerRow = {
  id:
    number;

  full_name:
    string;

  primary_position:
    string |
    null;

  team_abbreviation:
    string |
    null;

  status:
    string |
    null;

  is_active:
    boolean |
    null;
};


type InjuryRow = {
  nfl_player_id:
    number;

  status:
    string |
    null;

  injury_type:
    string |
    null;

  injury_location:
    string |
    null;

  injury_detail:
    string |
    null;
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
    toNumber(
      value
    ) * 10
  ) / 10;
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

  return position;
}


function roundName(
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


export default async function NflPlayoffsEntry({
  leagueId,
}: Props) {
  const access =
    await requireLeagueMember(
      leagueId
    );

  if (
    access.league.leagueType !==
    "nfl_playoffs"
  ) {
    throw new Error(
      "This entry is only available for NFL Playoffs leagues."
    );
  }

  if (
    !access.fantasyTeam
  ) {
    notFound();
  }

  const rawMode =
    access.league
      .playerSelectionMode;

  if (
    rawMode !==
      "salary" &&
    rawMode !==
      "no_salary"
  ) {
    throw new Error(
      "NFL Playoffs leagues must use Salary or No-Salary player selection."
    );
  }

  const playerSelectionMode:
    "salary" |
    "no_salary" =
      rawMode;

  const isSalary =
    playerSelectionMode ===
    "salary";

  const season =
    access.league.season;

  const fantasyTeamId =
    access.fantasyTeam.id;

  const supabase =
    await createSupabaseServerClient();


  const [
    settingsResult,
    stateResult,
  ] =
    await Promise.all([
      supabase
        .from(
          "nfl_playoff_settings"
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
          starting_dst
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
          "nfl_playoff_league_state"
        )
        .select(`
          active_round,
          status
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
    ]);


  if (
    settingsResult.error
  ) {
    throw new Error(
      settingsResult
        .error.message
    );
  }

  if (
    stateResult.error
  ) {
    throw new Error(
      stateResult
        .error.message
    );
  }

  if (
    !settingsResult.data
  ) {
    throw new Error(
      "NFL Playoffs settings have not been initialized for this league."
    );
  }

  const settings =
    settingsResult
      .data as SettingsRow;

  const state =
    stateResult
      .data as StateRow | null;

  const activeRound =
    Number.isInteger(
      Number(
        state
          ?.active_round
      )
    ) &&
    Number(
      state
        ?.active_round
    ) >= 1 &&
    Number(
      state
        ?.active_round
    ) <= 4
      ? Number(
          state
            ?.active_round
        )
      : 1;

  const currentRoundName =
    roundName(
      activeRound
    );


  const [
    entryResult,
    lineupResult,
    projectionResult,
    salaryStateResult,
  ] =
    await Promise.all([
      supabase
        .from(
          "nfl_playoff_round_entries"
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
          "round_number",
          activeRound
        )
        .maybeSingle(),

      supabase
        .from(
          "nfl_playoff_round_lineups"
        )
        .select(`
          player_id,
          lineup_slot,
          slot_index,
          salary_at_selection,
          projected_points_at_selection,
          is_locked,
          locked_at
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
          "round_number",
          activeRound
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
        ),

      supabase
        .from(
          "nfl_playoff_player_projections"
        )
        .select(`
          nfl_player_id,
          team_abbreviation,
          position,
          opponent_abbreviation,
          home_or_away,
          kickoff_at,
          injury_status,
          is_available,
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
          "round_number",
          activeRound
        )
        .order(
          "projected_points",
          {
            ascending:
              false,
          }
        )
        .limit(
          1500
        ),

      supabase
        .from(
          "nfl_playoff_salary_round_state"
        )
        .select(`
          is_locked,
          generated_at,
          locked_at
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
          "round_number",
          activeRound
        )
        .maybeSingle(),
    ]);


  if (
    entryResult.error
  ) {
    throw new Error(
      entryResult
        .error.message
    );
  }

  if (
    lineupResult.error
  ) {
    throw new Error(
      lineupResult
        .error.message
    );
  }

  if (
    projectionResult.error
  ) {
    throw new Error(
      projectionResult
        .error.message
    );
  }

  if (
    salaryStateResult.error
  ) {
    throw new Error(
      salaryStateResult
        .error.message
    );
  }


  const entry =
    entryResult
      .data as EntryRow | null;

  const lineup =
    (
      lineupResult.data ??
      []
    ) as LineupRow[];

  const projections =
    (
      projectionResult.data ??
      []
    ) as ProjectionRow[];

  const projectionMap =
    new Map<
      number,
      ProjectionRow
    >(
      projections.map(
        (
          row
        ) => [
          row.nfl_player_id,
          row,
        ]
      )
    );

  const salaryState =
    salaryStateResult
      .data as SalaryStateRow | null;

  const salaryPublished =
    !isSalary ||
    salaryState
      ?.is_locked ===
      true;


  let salaries:
    SalaryRow[] = [];

  if (
    isSalary &&
    salaryPublished
  ) {
    const salaryResult =
      await supabase
        .from(
          "nfl_playoff_player_salaries"
        )
        .select(`
          nfl_player_id,
          salary,
          projected_points,
          previous_round_salary
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
          "round_number",
          activeRound
        )
        .order(
          "projected_points",
          {
            ascending:
              false,
          }
        )
        .limit(
          1500
        );

    if (
      salaryResult.error
    ) {
      throw new Error(
        salaryResult
          .error.message
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
      new Set([
        ...projections.map(
          (
            row
          ) =>
            row.nfl_player_id
        ),
        ...lineup.map(
          (
            row
          ) =>
            row.player_id
        ),
      ])
    );

  let players:
    PlayerRow[] = [];

  if (
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
          status,
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
          .error.message
      );
    }

    players =
      (
        playerResult.data ??
        []
      ) as PlayerRow[];
  }


  const playerMap =
    new Map<
      number,
      PlayerRow
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


  let injuries:
    InjuryRow[] = [];

  if (
    playerIds.length >
    0
  ) {
    const injuryResult =
      await supabase
        .from(
          "nfl_player_injuries"
        )
        .select(`
          nfl_player_id,
          status,
          injury_type,
          injury_location,
          injury_detail
        `)
        .eq(
          "season",
          season
        )
        .eq(
          "is_active",
          true
        )
        .in(
          "nfl_player_id",
          playerIds
        );

    if (
      injuryResult.error
    ) {
      throw new Error(
        injuryResult
          .error.message
      );
    }

    injuries =
      (
        injuryResult.data ??
        []
      ) as InjuryRow[];
  }


  const injuryMap =
    new Map<
      number,
      InjuryRow
    >(
      injuries.map(
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

        const projection =
          projectionMap.get(
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
              projection
                ?.position ??
              player
                ?.primary_position
            ),

          teamAbbreviation:
            projection
              ?.team_abbreviation ??
            player
              ?.team_abbreviation ??
            null,

          injuryStatus:
            injury
              ?.status ??
            projection
              ?.injury_status ??
            player
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
            projectionNumber(
              row.projected_points_at_selection ??
              projection
                ?.projected_points
            ),

          isLocked:
            Boolean(
              row.is_locked
            ),

          lockedAt:
            row.locked_at,

          nflGameId:
            null,

          gameStartAt:
            projection
              ?.kickoff_at ??
            null,

          opponentAbbreviation:
            projection
              ?.opponent_abbreviation ??
            null,

          homeOrAway:
            projection
              ?.home_or_away ??
            null,

          matchupRank:
            null,
        };
      }
    );


  const poolForClient =
    projections
      .filter(
        (
          projection
        ) =>
          projection
            .is_available
      )
      .map(
        (
          projection
        ) => {
        const player =
          playerMap.get(
            projection
              .nfl_player_id
          );

        const salary =
          salaryMap.get(
            projection
              .nfl_player_id
          );

        const injury =
          injuryMap.get(
            projection
              .nfl_player_id
          );

        return {
          id:
            projection
              .nfl_player_id,

          name:
            player
              ?.full_name ??
            `Player ${projection.nfl_player_id}`,

          position:
            normalizePosition(
              projection
                .position ??
              player
                ?.primary_position
            ),

          teamAbbreviation:
            projection
              .team_abbreviation ??
            player
              ?.team_abbreviation ??
            null,

          injuryStatus:
            injury
              ?.status ??
            projection
              .injury_status ??
            player
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

          opponentAbbreviation:
            projection
              .opponent_abbreviation,

          homeOrAway:
            projection
              .home_or_away,

          matchupRank:
            null,

          gameStartAt:
            projection
              .kickoff_at,

          isBye:
            false,

          byeWeek:
            null,

          salary:
            isSalary
              ? (
                  salary
                    ?.salary ===
                  null ||
                  salary
                    ?.salary ===
                  undefined
                    ? null
                    : toNumber(
                        salary.salary
                      )
                )
              : null,

          projectedPoints:
            projectionNumber(
              projection
                .projected_points ??
              salary
                ?.projected_points
            ),

          salaryChange:
            isSalary &&
            salary
              ?.previous_round_salary !==
              null &&
            salary
              ?.previous_round_salary !==
              undefined
              ? (
                  toNumber(
                    salary.salary
                  ) -
                  toNumber(
                    salary.previous_round_salary
                  )
                )
              : null,

          salaryChangePercent:
            isSalary &&
            toNumber(
              salary
                ?.previous_round_salary
            ) >
              0
              ? (
                  (
                    toNumber(
                      salary
                        ?.salary
                    ) -
                    toNumber(
                      salary
                        ?.previous_round_salary
                    )
                  ) /
                  toNumber(
                    salary
                      ?.previous_round_salary
                  )
                ) *
                100
              : null,

          isActive:
            projection
              .is_available &&
            player
              ?.is_active !==
              false,
        };
      }
      )
      .filter(
        (
          player
        ) =>
          [
            "QB",
            "RB",
            "WR",
            "TE",
            "K",
            "DST",
          ].includes(
            player.position
          )
      )
      .filter(
        (
          player
        ) =>
          !isSalary ||
          !salaryPublished ||
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
    <NflPlayoffsRoundLineup
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
      roundNumber={
        activeRound
      }
      roundName={
        currentRoundName
      }
      salaryPublished={
        salaryPublished
      }
      playerSelectionMode={
        playerSelectionMode
      }
      settings={{
        weeklySalaryCap:
          toNumber(
            settings
              .weekly_salary_cap
          ),

        startingQb:
          settings
            .starting_qb,

        startingRb:
          settings
            .starting_rb,

        startingWr:
          settings
            .starting_wr,

        startingTe:
          settings
            .starting_te,

        startingFlex:
          settings
            .starting_flex,

        startingSuperflex:
          settings
            .starting_superflex,

        startingK:
          settings
            .starting_k,

        startingDst:
          settings
            .starting_dst,
      }}
      entry={
        entry
          ? {
              status:
                entry.status,

              salaryUsed:
                entry
                  .salary_used ===
                null
                  ? null
                  : toNumber(
                      entry
                        .salary_used
                    ),

              projectedPoints:
                projectionNumber(
                  entry
                    .projected_points
                ),

              submittedAt:
                entry
                  .submitted_at,
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
