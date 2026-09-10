export type G365LeagueType =
  | "traditional"
  | "season_long"
  | "nfl_playoffs"
  | "pickem";

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
  | "draftGrades"
  | "leagueTeams"
  | "recap"
  | "trophyCase"
  | "picks"
  | "leaguePicks"
  | "games"
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
  draftGrades: false,
  leagueTeams: false,
  recap: false,
  trophyCase: false,
  picks: false,
  leaguePicks: false,
  games: false,
  settings: false,
  commissioner: false,
};

export function getLeagueCapabilities({
  leagueType,
  competitionFormat = null,
  playoffsEnabled = false,
  isCommissioner = false,
}: GetLeagueCapabilitiesArgs): LeagueCapabilities {
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
      draft: true,
      draftGrades: true,
      settings: true,
      commissioner: isCommissioner,
    };
  }

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
