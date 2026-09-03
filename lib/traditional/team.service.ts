import type {
  SupabaseClient,
} from "@supabase/supabase-js";


export type TraditionalRosterPlayer = {
  rosterId: number;

  playerId: number;

  fullName: string;

  position: string;

  teamAbbreviation:
    string | null;

  headshotUrl:
    string | null;

  nflStatus:
    string | null;

  acquiredVia:
    string;

  acquiredAt:
    string | null;

  lineupSlot:
    string | null;

  slotIndex:
    number | null;

  isLocked:
    boolean;

  injuryStatus:
    string | null;

  injuryDetail:
    string | null;

  isStarter:
    boolean;
};


export type TraditionalRosterSettings = {
  startingQb: number;

  startingRb: number;

  startingWr: number;

  startingTe: number;

  startingFlex: number;

  startingSuperflex: number;

  startingK: number;

  startingDst: number;

  benchSlots: number;

  irSlots: number;
};


export type TraditionalTeamData = {
  activeWeek: number;

  selectedWeek: number;

  phase: string;

  rosterCount: number;

  startersCount: number;

  benchCount: number;

  injuredCount: number;

  rosterSettings:
    TraditionalRosterSettings;

  roster:
    TraditionalRosterPlayer[];
};


type SeasonStateRow = {
  active_week:
    number | null;

  phase:
    string | null;
};


type RosterRow = {
  id: number;

  player_id: number;

  acquired_via: string;

  acquired_at:
    string | null;

  nfl_players:
    | {
        id: number;
        full_name: string;
        primary_position: string;
        team_abbreviation:
          string | null;
        headshot_url:
          string | null;
        status:
          string | null;
      }
    | {
        id: number;
        full_name: string;
        primary_position: string;
        team_abbreviation:
          string | null;
        headshot_url:
          string | null;
        status:
          string | null;
      }[]
    | null;
};


type LineupRow = {
  player_id: number;

  lineup_slot: string;

  slot_index: number;

  is_locked:
    boolean | null;
};


type InjuryRow = {
  nfl_player_id: number;

  status:
    string | null;

  injury_detail:
    string | null;
};


type RosterSettingsRow = {
  starting_qb: number;

  starting_rb: number;

  starting_wr: number;

  starting_te: number;

  starting_flex: number;

  starting_superflex: number;

  starting_k: number;

  starting_dst: number;

  bench_slots: number;

  ir_slots: number;
};


function getRelatedPlayer(
  value:
    RosterRow["nfl_players"]
) {
  if (
    Array.isArray(
      value
    )
  ) {
    return (
      value[0] ??
      null
    );
  }

  return value;
}


function isStarterSlot(
  slot:
    string | null
) {
  const normalized =
    (
      slot ??
      ""
    ).toUpperCase();


  return ![
    "",
    "BENCH",
    "BN",
    "IR",
  ].includes(
    normalized
  );
}


export async function getTraditionalTeamData(
  supabase:
    SupabaseClient,
  leagueId: string,
  season: number,
  fantasyTeamId: number,
  selectedWeekInput?: number | null
): Promise<TraditionalTeamData> {
  /*
   * =====================================================
   * CURRENT SEASON STATE
   * =====================================================
   */

  const {
    data:
      seasonStateData,

    error:
      seasonStateError,
  } =
    await supabase
      .from(
        "traditional_season_state"
      )
      .select(
        `
          active_week,
          phase
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
      .maybeSingle();


  if (
    seasonStateError
  ) {
    throw new Error(
      `Could not load season state: ${seasonStateError.message}`
    );
  }


  const seasonState =
    seasonStateData as
      SeasonStateRow |
      null;


  const activeWeek =
    seasonState
      ?.active_week ??
    1;

  const requestedWeek = Number(selectedWeekInput ?? activeWeek);
  const selectedWeek = Number.isInteger(requestedWeek)
    ? Math.min(18, Math.max(1, requestedWeek))
    : activeWeek;


  /*
   * =====================================================
   * ROSTER SETTINGS
   * =====================================================
   */

  const {
    data:
      rosterSettingsData,

    error:
      rosterSettingsError,
  } =
    await supabase
      .from(
        "traditional_roster_settings"
      )
      .select(
        `
          starting_qb,
          starting_rb,
          starting_wr,
          starting_te,
          starting_flex,
          starting_superflex,
          starting_k,
          starting_dst,
          bench_slots,
          ir_slots
        `
      )
      .eq(
        "league_id",
        leagueId
      )
      .maybeSingle();


  if (
    rosterSettingsError
  ) {
    throw new Error(
      `Could not load roster settings: ${rosterSettingsError.message}`
    );
  }


  if (
    !rosterSettingsData
  ) {
    throw new Error(
      "Traditional roster settings were not found."
    );
  }


  const rosterSettingsRow =
    rosterSettingsData as
      RosterSettingsRow;


  const rosterSettings:
    TraditionalRosterSettings =
      {
        startingQb:
          rosterSettingsRow
            .starting_qb,

        startingRb:
          rosterSettingsRow
            .starting_rb,

        startingWr:
          rosterSettingsRow
            .starting_wr,

        startingTe:
          rosterSettingsRow
            .starting_te,

        startingFlex:
          rosterSettingsRow
            .starting_flex,

        startingSuperflex:
          rosterSettingsRow
            .starting_superflex,

        startingK:
          rosterSettingsRow
            .starting_k,

        startingDst:
          rosterSettingsRow
            .starting_dst,

        benchSlots:
          rosterSettingsRow
            .bench_slots,

        irSlots:
          rosterSettingsRow
            .ir_slots,
      };


  /*
   * =====================================================
   * TEAM ROSTER + NFL PLAYER DATA
   * =====================================================
   */

  const {
    data:
      rosterData,

    error:
      rosterError,
  } =
    await supabase
      .from(
        "team_rosters"
      )
      .select(`
        id,
        player_id,
        acquired_via,
        acquired_at,

        nfl_players (
          id,
          full_name,
          primary_position,
          team_abbreviation,
          headshot_url,
          status
        )
      `)
      .eq(
        "league_id",
        leagueId
      )
      .eq(
        "fantasy_team_id",
        fantasyTeamId
      );


  if (
    rosterError
  ) {
    throw new Error(
      `Could not load team roster: ${rosterError.message}`
    );
  }


  const rosterRows =
    (
      rosterData ??
      []
    ) as unknown as
      RosterRow[];


  /*
   * =====================================================
   * CURRENT WEEK LINEUP
   * =====================================================
   */

  const {
    data:
      lineupData,

    error:
      lineupError,
  } =
    await supabase
      .from(
        "weekly_lineups"
      )
      .select(
        `
          player_id,
          lineup_slot,
          slot_index,
          is_locked
        `
      )
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
        selectedWeek
      );


  if (
    lineupError
  ) {
    throw new Error(
      `Could not load weekly lineup: ${lineupError.message}`
    );
  }


  const lineupRows =
    (
      lineupData ??
      []
    ) as LineupRow[];


  const lineupByPlayer =
    new Map<
      number,
      LineupRow
    >();


  for (
    const lineup
    of lineupRows
  ) {
    lineupByPlayer.set(
      Number(
        lineup.player_id
      ),
      lineup
    );
  }


  /*
   * =====================================================
   * CURRENT INJURIES
   * =====================================================
   */

  const playerIds =
    rosterRows.map(
      (
        roster
      ) =>
        Number(
          roster.player_id
        )
    );


  const injuryByPlayer =
    new Map<
      number,
      InjuryRow
    >();


  if (
    playerIds.length >
    0
  ) {
    const {
      data:
        injuryData,

      error:
        injuryError,
    } =
      await supabase
        .from(
          "current_nfl_player_injuries"
        )
        .select(
          `
            nfl_player_id,
            status,
            injury_detail
          `
        )
        .eq(
          "season",
          season
        )
        .in(
          "nfl_player_id",
          playerIds
        );


    if (
      injuryError
    ) {
      throw new Error(
        `Could not load roster injuries: ${injuryError.message}`
      );
    }


    for (
      const injury
      of (
        injuryData ??
        []
      ) as InjuryRow[]
    ) {
      injuryByPlayer.set(
        Number(
          injury
            .nfl_player_id
        ),
        injury
      );
    }
  }


  /*
   * =====================================================
   * NORMALIZE DISPLAY ROSTER
   * =====================================================
   */

  const roster:
    TraditionalRosterPlayer[] =
      rosterRows.map(
        (
          rosterRow
        ) => {
          const player =
            getRelatedPlayer(
              rosterRow
                .nfl_players
            );


          const lineup =
            lineupByPlayer.get(
              rosterRow
                .player_id
            );


          const injury =
            injuryByPlayer.get(
              rosterRow
                .player_id
            );


          const lineupSlot =
            lineup
              ?.lineup_slot ??
            null;


          return {
            rosterId:
              rosterRow.id,

            playerId:
              rosterRow
                .player_id,

            fullName:
              player
                ?.full_name ??
              "Unknown Player",

            position:
              player
                ?.primary_position ??
              "—",

            teamAbbreviation:
              player
                ?.team_abbreviation ??
              null,

            headshotUrl:
              player
                ?.headshot_url ??
              null,

            nflStatus:
              player
                ?.status ??
              null,

            acquiredVia:
              rosterRow
                .acquired_via,

            acquiredAt:
              rosterRow
                .acquired_at,

            lineupSlot,

            slotIndex:
              lineup
                ?.slot_index ??
              null,

            isLocked:
              lineup
                ?.is_locked ??
              false,

            injuryStatus:
              injury
                ?.status ??
              null,

            injuryDetail:
              injury
                ?.injury_detail ??
              null,

            isStarter:
              isStarterSlot(
                lineupSlot
              ),
          };
        }
      );


  /*
   * =====================================================
   * DISPLAY ORDER
   * =====================================================
   */

  roster.sort(
    (
      a,
      b
    ) => {
      if (
        a.isStarter !==
        b.isStarter
      ) {
        return a.isStarter
          ? -1
          : 1;
      }


      const slotCompare =
        (
          a.lineupSlot ??
          "ZZZ"
        ).localeCompare(
          b.lineupSlot ??
          "ZZZ"
        );


      if (
        slotCompare !==
        0
      ) {
        return slotCompare;
      }


      const indexCompare =
        (
          a.slotIndex ??
          999
        ) -
        (
          b.slotIndex ??
          999
        );


      if (
        indexCompare !==
        0
      ) {
        return indexCompare;
      }


      return a.fullName
        .localeCompare(
          b.fullName
        );
    }
  );


  const startersCount =
    roster.filter(
      (
        player
      ) =>
        player.isStarter
    ).length;


  const benchCount =
    roster.filter(
      (
        player
      ) =>
        !player.isStarter
    ).length;


  const injuredCount =
    roster.filter(
      (
        player
      ) =>
        Boolean(
          player
            .injuryStatus
        )
    ).length;


  return {
    activeWeek,

    selectedWeek,

    phase:
      seasonState
        ?.phase ??
      "regular_season",

    rosterCount:
      roster.length,

    startersCount,

    benchCount,

    injuredCount,

    rosterSettings,

    roster,
  };
}