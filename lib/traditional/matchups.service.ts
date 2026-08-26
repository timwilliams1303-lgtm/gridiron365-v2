import type {
  SupabaseClient,
} from "@supabase/supabase-js";

import {
  getTraditionalMatchupDetailData,
  type MatchupDetailPlayer,
  type MatchupDetailTeam,
} from "@/lib/traditional/matchup-detail.service";


export type TraditionalMatchupPlayer = {
  playerId: number;

  fullName: string;

  position: string;

  teamAbbreviation:
    string |
    null;

  headshotUrl:
    string |
    null;

  lineupSlot: string;

  slotIndex: number;

  fantasyPoints: number;

  projectedPoints: number;

  isLive: boolean;

  isFinal: boolean;

  isLocked: boolean;

  status:
    | "scheduled"
    | "live"
    | "final";
};


export type TraditionalMatchupTeam = {
  fantasyTeamId: number;

  teamName: string;

  points: number;

  /*
   * IMPORTANT:
   * This is the SAME expectedFinalPoints shown on the
   * Matchup Detail scoreboard.
   */
  projectedPoints: number;

  playersLive: number;

  playersRemaining: number;

  isWinner: boolean;

  isMyTeam: boolean;

  starters:
    TraditionalMatchupPlayer[];
};


export type TraditionalMatchupRow = {
  matchupId: number;

  week: number;

  home:
    TraditionalMatchupTeam;

  away:
    TraditionalMatchupTeam;

  isLive: boolean;

  isFinal: boolean;

  tied: boolean;

  status:
    | "scheduled"
    | "live"
    | "final";

  isMyMatchup: boolean;
};


export type TraditionalMatchupsData = {
  activeWeek: number;

  selectedWeek: number;

  regularSeasonWeeks: number;

  matchups:
    TraditionalMatchupRow[];

  myMatchup:
    TraditionalMatchupRow |
    null;
};


type SeasonStateRow = {
  active_week:
    number |
    null;
};


type LeagueSettingsRow = {
  regular_season_weeks:
    number |
    null;
};


type MatchupIdRow = {
  id: number;

  week: number;
};


function normalizePlayer(
  player:
    MatchupDetailPlayer
): TraditionalMatchupPlayer {
  const isLive =
    Boolean(
      player.scoreIsLive ||
      player.gameContext
        ?.isActuallyLive
    );


  const isFinal =
    Boolean(
      player.scoreIsFinal ||
      player.gameContext
        ?.statusCompleted
    );


  return {
    playerId:
      player.playerId,

    fullName:
      player.fullName,

    position:
      player.position,

    teamAbbreviation:
      player.teamAbbreviation,

    headshotUrl:
      player.headshotUrl,

    lineupSlot:
      player.lineupSlot,

    slotIndex:
      player.slotIndex,

    fantasyPoints:
      player.fantasyPoints,

    projectedPoints:
      player.projectedPoints,

    isLive,

    isFinal,

    isLocked:
      player.isLocked,

    status:
      isFinal
        ? "final"
        : isLive
          ? "live"
          : "scheduled",
  };
}


function normalizeTeam(
  team:
    MatchupDetailTeam
): TraditionalMatchupTeam {
  return {
    fantasyTeamId:
      team.fantasyTeamId,

    teamName:
      team.teamName,

    points:
      team.points,

    /*
     * Match the detail page EXACTLY.
     *
     * Before games begin:
     *   expectedFinalPoints === full weekly projected total.
     *
     * While games are live:
     *   expectedFinalPoints === actual points already scored
     *   + projected points still expected from unfinished players.
     */
    projectedPoints:
      team.expectedFinalPoints,

    playersLive:
      team.playersLive,

    playersRemaining:
      team.playersRemaining,

    isWinner:
      team.isWinner,

    isMyTeam:
      team.isMyTeam,

    starters:
      team.starters.map(
        normalizePlayer
      ),
  };
}


export async function getTraditionalMatchupsData(
  supabase:
    SupabaseClient,
  leagueId: string,
  season: number,
  selectedWeekInput:
    number |
    null,
  myFantasyTeamId:
    number |
    null
): Promise<TraditionalMatchupsData> {
  /*
   * =====================================================
   * ACTIVE WEEK + REGULAR SEASON LENGTH
   * =====================================================
   */

  const [
    seasonStateResult,
    settingsResult,
  ] =
    await Promise.all([
      supabase
        .from(
          "traditional_season_state"
        )
        .select(
          "active_week"
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
          "league_settings"
        )
        .select(
          "regular_season_weeks"
        )
        .eq(
          "league_id",
          leagueId
        )
        .maybeSingle(),
    ]);


  if (
    seasonStateResult.error
  ) {
    throw new Error(
      `Could not load active week: ${seasonStateResult.error.message}`
    );
  }


  if (
    settingsResult.error
  ) {
    throw new Error(
      `Could not load league settings: ${settingsResult.error.message}`
    );
  }


  const seasonState =
    seasonStateResult.data as
      SeasonStateRow |
      null;


  const settings =
    settingsResult.data as
      LeagueSettingsRow |
      null;


  const activeWeek =
    seasonState
      ?.active_week ??
    1;


  const regularSeasonWeeks =
    settings
      ?.regular_season_weeks ??
    14;


  const requestedWeek =
    selectedWeekInput ??
    activeWeek;


  const selectedWeek =
    Math.min(
      regularSeasonWeeks,
      Math.max(
        1,
        requestedWeek
      )
    );


  /*
   * =====================================================
   * LOAD ONLY THE MATCHUP IDS FOR THIS WEEK
   * =====================================================
   *
   * Do not rebuild scores/projections here.
   *
   * Every card below is normalized from
   * getTraditionalMatchupDetailData(), which is the same
   * function used by:
   *
   *   /matchups/[matchupId]
   *
   * This guarantees both screens use the same:
   *   - actual score
   *   - expected final / projected score
   *   - lineup
   *   - players live
   *   - players remaining
   *   - game status
   *   - winner / tie
   * =====================================================
   */

  const {
    data:
      matchupIdData,

    error:
      matchupIdError,
  } =
    await supabase
      .from(
        "traditional_matchups"
      )
      .select(
        "id, week"
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
        selectedWeek
      )
      .order(
        "id",
        {
          ascending:
            true,
        }
      );


  if (
    matchupIdError
  ) {
    throw new Error(
      `Could not load matchups: ${matchupIdError.message}`
    );
  }


  const matchupIds =
    (
      matchupIdData ??
      []
    ) as MatchupIdRow[];


  /*
   * The detail loader refreshes the official matchup first,
   * then reloads the finalized state before calculating its
   * display data.
   */
  const detailRows =
    await Promise.all(
      matchupIds.map(
        (
          row
        ) =>
          getTraditionalMatchupDetailData(
            supabase,
            leagueId,
            row.id,
            myFantasyTeamId
          )
      )
    );


  const matchups:
    TraditionalMatchupRow[] =
      detailRows.map(
        (
          detail
        ) => {
          const home =
            normalizeTeam(
              detail.home
            );


          const away =
            normalizeTeam(
              detail.away
            );


          return {
            matchupId:
              detail.matchupId,

            week:
              detail.week,

            home,

            away,

            isLive:
              detail.isLive,

            isFinal:
              detail.isFinal,

            tied:
              detail.tied,

            status:
              detail.status,

            isMyMatchup:
              myFantasyTeamId !==
                null &&
              (
                home.fantasyTeamId ===
                  myFantasyTeamId ||
                away.fantasyTeamId ===
                  myFantasyTeamId
              ),
          };
        }
      );


  const myMatchup =
    matchups.find(
      (
        matchup
      ) =>
        matchup.isMyMatchup
    ) ??
    null;


  return {
    activeWeek,

    selectedWeek,

    regularSeasonWeeks,

    matchups,

    myMatchup,
  };
}
