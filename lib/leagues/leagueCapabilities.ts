export type G365LeagueType =
  | "traditional"
  | "season_long"
  | "nfl_playoffs"
  | "pickem"
  | "nhl_traditional"
  | "greyhound";

export type SeasonLongCompetitionFormat =
  | "total_points"
  | "head_to_head";

export type LeagueCapabilityKey =
  | "home"
  | "myTeam"
  | "myEntry"
  | "players"
  | "rankings"
  | "matchups"
  | "standings"
  | "waivers"
  | "trades"
  | "playoffs"
  | "seasonRecap"
  | "history"
  | "draft"
  | "draftLottery"
  | "draftGrades"
  | "leagueTeams"
  | "recap"
  | "trophyCase"
  | "offseason"
  | "picks"
  | "leaguePicks"
  | "games"
  | "wagers"
  | "leagueWagers"
  | "settings"
  | "commissioner";

export type LeagueCapabilities = Record<
  LeagueCapabilityKey,
  boolean
>;

type GetLeagueCapabilitiesArgs = {
  leagueType: G365LeagueType;
  competitionFormat?: SeasonLongCompetitionFormat | null;
  playoffsEnabled?: boolean;
  isCommissioner?: boolean;
};

const none: LeagueCapabilities = {
  home: false,
  myTeam: false,
  myEntry: false,
  players: false,
  rankings: false,
  matchups: false,
  standings: false,
  waivers: false,
  trades: false,
  playoffs: false,
  seasonRecap: false,
  history: false,
  draft: false,
  draftLottery: false,
  draftGrades: false,
  leagueTeams: false,
  recap: false,
  trophyCase: false,
  offseason: false,
  picks: false,
  leaguePicks: false,
  games: false,
  wagers: false,
  leagueWagers: false,
  settings: false,
  commissioner: false,
};

export function getLeagueCapabilities({
  leagueType,
  competitionFormat = null,
  playoffsEnabled = false,
  isCommissioner = false,
}: GetLeagueCapabilitiesArgs): LeagueCapabilities {
  /*
   * NFL TRADITIONAL
   *
   * Supports:
   * - Redraft
   * - Dynasty Startup
   * - Dynasty Annual Draft
   *
   * LeagueNav/page lifecycle is responsible for deciding when
   * Dynasty-only pages such as Draft Lottery and Offseason
   * are actually visible.
   */
  if (leagueType === "traditional") {
    return {
      ...none,

      home: true,
      myTeam: true,
      players: true,
      rankings: true,
      matchups: true,
      standings: true,
      waivers: true,
      trades: true,
      playoffs: true,

      seasonRecap: true,
      history: true,

      /*
       * Draft remains available for Redraft and Dynasty.
       *
       * Dynasty uses this for:
       * - Startup Draft
       * - Annual Rookie/Player Draft
       */
      draft: true,

      /*
       * NFL Dynasty draft-order workflow.
       *
       * Actual visibility should be restricted by LeagueNav
       * to Dynasty leagues / appropriate lifecycle state.
       */
      draftLottery: true,

      /*
       * Redraft draft grades remain supported.
       *
       * LeagueNav can hide this for Dynasty if desired.
       */
      draftGrades: true,

      /*
       * NFL Dynasty offseason workflow.
       *
       * Includes keeper/protected-player workflow,
       * draft-order workflow, future draft assets,
       * and annual draft preparation.
       *
       * LeagueNav/lifecycle controls when it is shown.
       */
      offseason: true,

      settings: true,
      commissioner: isCommissioner,
    };
  }

  /*
   * NHL TRADITIONAL
   */
  if (leagueType === "nhl_traditional") {
    return {
      ...none,

      home: true,
      myTeam: true,
      rankings: true,
      matchups: true,
      standings: true,
      waivers: true,
      trades: true,
      playoffs: true,

      /*
       * Startup/current-season draft pages remain available
       * during the season for NHL Traditional leagues.
       */
      draft: true,

      /*
       * Dynasty draft-order workflow.
       * LeagueNav controls Dynasty-specific visibility.
       */
      draftLottery: true,

      settings: true,

      leagueTeams: false,
      players: false,
      draftGrades: false,
      recap: false,
      trophyCase: false,
      seasonRecap: false,
      history: false,

      /*
       * LeagueNav/lifecycle controls actual visibility.
       */
      offseason: true,

      commissioner: isCommissioner,
    };
  }

  /*
   * SEASON-LONG
   */
  if (leagueType === "season_long") {
    const isHeadToHead =
      competitionFormat === "head_to_head";

    return {
      ...none,

      home: true,
      myEntry: true,

      leagueTeams: !isHeadToHead,

      matchups: isHeadToHead,

      standings: true,

      playoffs:
        isHeadToHead &&
        playoffsEnabled,

      recap: true,
      trophyCase: true,

      settings: true,
      commissioner: isCommissioner,
    };
  }

  /*
   * NFL PLAYOFFS
   */
  if (leagueType === "nfl_playoffs") {
    return {
      ...none,

      home: true,
      myEntry: true,
      leagueTeams: true,
      standings: true,
      playoffs: true,
      recap: true,
      trophyCase: true,

      settings: true,
      commissioner: isCommissioner,
    };
  }

  /*
   * PICK'EM
   */
  if (leagueType === "pickem") {
    return {
      ...none,

      home: true,
      picks: true,
      leaguePicks: true,
      games: true,
      standings: true,
      recap: true,

      settings: true,
      commissioner: isCommissioner,
    };
  }

  /*
   * GREYHOUND
   */
  if (leagueType === "greyhound") {
    return {
      ...none,

      home: true,
      wagers: true,
      leagueWagers: true,
      standings: true,
      recap: true,
      trophyCase: true,

      settings: true,
      commissioner: isCommissioner,
    };
  }

  return none;
}