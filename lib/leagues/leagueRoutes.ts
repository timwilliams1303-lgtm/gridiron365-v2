import type {
  G365LeagueType,
  LeagueCapabilityKey,
  SeasonLongCompetitionFormat,
} from "@/lib/leagues/leagueCapabilities";

export type LeagueNavItem = {
  key: LeagueCapabilityKey;
  label: string;
  mobileLabel: string;
  href: string;
  exact?: boolean;
};

type GetLeagueNavItemsArgs = {
  leagueId: string;
  leagueType: G365LeagueType;
  competitionFormat?: SeasonLongCompetitionFormat | null;
  playoffsEnabled?: boolean;
  isCommissioner?: boolean;
};

type GetLeaguePrimaryActionArgs = {
  leagueId: string;
  leagueType: G365LeagueType;
};

export function getLeaguePrimaryAction({
  leagueId,
  leagueType,
}: GetLeaguePrimaryActionArgs) {
  const base = `/league/${leagueId}`;

  switch (leagueType) {
    case "traditional":
      return {
        label: "My Team",
        href: `${base}/team`,
      };

    case "nhl_traditional":
      return {
        label: "My Team",
        href: `${base}/nhl/team`,
      };

    case "season_long":
      return {
        label: "My Entry",
        href: `${base}/season-long/my-entry`,
      };

    case "nfl_playoffs":
      return {
        label: "My Entry",
        href: `${base}/nfl-playoffs/my-entry`,
      };

    case "pickem":
      return {
        label: "My Picks",
        href: `${base}/pickem/picks`,
      };

    case "greyhound":
      return {
        label: "My Wagers",
        href: `${base}/greyhound/wagers`,
      };

    default:
      return {
        label: "League Home",
        href: base,
      };
  }
}

export function getLeagueNavItems({
  leagueId,
  leagueType,
  competitionFormat = null,
  playoffsEnabled = false,
  isCommissioner = false,
}: GetLeagueNavItemsArgs): LeagueNavItem[] {
  const base = `/league/${leagueId}`;

  /*
   * =========================================
   * TRADITIONAL NFL
   * =========================================
   */
  if (leagueType === "traditional") {
    const items: LeagueNavItem[] = [
      {
        key: "home",
        label: "Home",
        mobileLabel: "Home",
        href: base,
        exact: true,
      },
      {
        key: "myTeam",
        label: "My Team",
        mobileLabel: "My Team",
        href: `${base}/team`,
      },
      {
        key: "players",
        label: "Players",
        mobileLabel: "Players",
        href: `${base}/players`,
      },
      {
        key: "rankings",
        label: "Rankings",
        mobileLabel: "Ranks",
        href: `${base}/rankings`,
      },
      {
        key: "matchups",
        label: "Matchups",
        mobileLabel: "Matchups",
        href: `${base}/matchups`,
      },
      {
        key: "standings",
        label: "Standings",
        mobileLabel: "Standings",
        href: `${base}/standings`,
      },
      {
        key: "waivers",
        label: "Waivers",
        mobileLabel: "Waivers",
        href: `${base}/waivers`,
      },
      {
        key: "trades",
        label: "Trades",
        mobileLabel: "Trades",
        href: `${base}/trades`,
      },
      {
        key: "draft",
        label: "Draft",
        mobileLabel: "Draft",
        href: `${base}/draft`,
      },
      {
        key: "draftGrades",
        label: "Draft Grades",
        mobileLabel: "Grades",
        href: `${base}/draft-grades`,
      },
      {
        key: "playoffs",
        label: "Playoffs",
        mobileLabel: "Playoffs",
        href: `${base}/playoffs`,
      },
      {
        key: "seasonRecap",
        label: "Season Recap",
        mobileLabel: "Recap",
        href: `${base}/season-recap`,
      },
      {
        key: "history",
        label: "History",
        mobileLabel: "History",
        href: `${base}/history`,
      },
      {
        key: "settings",
        label: "Settings",
        mobileLabel: "Settings",
        href: `${base}/settings`,
      },
    ];

    if (isCommissioner) {
      items.push({
        key: "commissioner",
        label: "Commissioner",
        mobileLabel: "Commish",
        href: `${base}/commissioner`,
      });
    }

    return items;
  }

  /*
   * =========================================
   * NHL TRADITIONAL
   *
   * Shared navigation for:
   * - Redraft
   * - Dynasty
   *
   * Individual pages can add dynasty-specific
   * behavior without requiring a second league
   * type or separate navigation system.
   * =========================================
   */
  if (leagueType === "nhl_traditional") {
    const nhlBase = `${base}/nhl`;

    const items: LeagueNavItem[] = [
      {
        key: "home",
        label: "Home",
        mobileLabel: "Home",
        href: nhlBase,
        exact: true,
      },
      {
        key: "myTeam",
        label: "My Team",
        mobileLabel: "My Team",
        href: `${nhlBase}/team`,
      },
      {
        key: "leagueTeams",
        label: "Teams",
        mobileLabel: "Teams",
        href: `${nhlBase}/teams`,
      },
      {
        key: "players",
        label: "Players",
        mobileLabel: "Players",
        href: `${nhlBase}/players`,
      },
      {
        key: "rankings",
        label: "Rankings",
        mobileLabel: "Ranks",
        href: `${nhlBase}/rankings`,
      },
      {
        key: "matchups",
        label: "Matchups",
        mobileLabel: "Matchups",
        href: `${nhlBase}/matchups`,
      },
      {
        key: "standings",
        label: "Standings",
        mobileLabel: "Standings",
        href: `${nhlBase}/standings`,
      },
      {
        key: "waivers",
        label: "Waivers",
        mobileLabel: "Waivers",
        href: `${nhlBase}/waivers`,
      },
      {
        key: "trades",
        label: "Trades",
        mobileLabel: "Trades",
        href: `${nhlBase}/trades`,
      },
      {
        key: "draft",
        label: "Draft",
        mobileLabel: "Draft",
        href: `${nhlBase}/draft`,
      },
      {
        key: "playoffs",
        label: "Playoffs",
        mobileLabel: "Playoffs",
        href: `${nhlBase}/playoffs`,
      },
      {
        key: "recap",
        label: "Recap",
        mobileLabel: "Recap",
        href: `${nhlBase}/recap`,
      },
      {
        key: "trophyCase",
        label: "Trophy Case",
        mobileLabel: "Trophies",
        href: `${nhlBase}/trophy-case`,
      },
    ];

    if (isCommissioner) {
      items.push({
        key: "commissioner",
        label: "Commissioner",
        mobileLabel: "Commish",
        href: `${nhlBase}/commissioner`,
      });
    }

    return items;
  }

  /*
   * =========================================
   * SEASON-LONG
   * =========================================
   */
  if (leagueType === "season_long") {
    const seasonLongBase = `${base}/season-long`;

    const isHeadToHead =
      competitionFormat === "head_to_head";

    const items: LeagueNavItem[] = [
      {
        key: "home",
        label: "Home",
        mobileLabel: "Home",
        href: seasonLongBase,
        exact: true,
      },
      {
        key: "myEntry",
        label: "My Entry",
        mobileLabel: "My Entry",
        href: `${seasonLongBase}/my-entry`,
      },
    ];

    if (isHeadToHead) {
      items.push({
        key: "matchups",
        label: "Matchups",
        mobileLabel: "Matchups",
        href: `${seasonLongBase}/matchups`,
      });
    } else {
      items.push({
        key: "leagueTeams",
        label: "League Teams",
        mobileLabel: "Teams",
        href: `${seasonLongBase}/teams`,
      });
    }

    items.push({
      key: "standings",
      label: "Standings",
      mobileLabel: "Standings",
      href: `${seasonLongBase}/standings`,
    });

    if (isHeadToHead && playoffsEnabled) {
      items.push({
        key: "playoffs",
        label: "Playoffs",
        mobileLabel: "Playoffs",
        href: `${seasonLongBase}/playoffs`,
      });
    }

    items.push(
      {
        key: "recap",
        label: "Recap",
        mobileLabel: "Recap",
        href: `${seasonLongBase}/recap`,
      },
      {
        key: "trophyCase",
        label: "Trophy Case",
        mobileLabel: "Trophies",
        href: `${seasonLongBase}/trophy-case`,
      },
      {
        key: "settings",
        label: "Settings",
        mobileLabel: "Settings",
        href: `${seasonLongBase}/settings`,
      }
    );

    if (isCommissioner) {
      items.push({
        key: "commissioner",
        label: "Commissioner",
        mobileLabel: "Commish",
        href: `${seasonLongBase}/commissioner`,
      });
    }

    return items;
  }

  /*
   * =========================================
   * NFL PLAYOFFS
   * =========================================
   */
  if (leagueType === "nfl_playoffs") {
    const playoffBase = `${base}/nfl-playoffs`;

    const items: LeagueNavItem[] = [
      {
        key: "home",
        label: "Home",
        mobileLabel: "Home",
        href: playoffBase,
        exact: true,
      },
      {
        key: "myEntry",
        label: "My Entry",
        mobileLabel: "My Entry",
        href: `${playoffBase}/my-entry`,
      },
      {
        key: "leagueTeams",
        label: "League Teams",
        mobileLabel: "Teams",
        href: `${playoffBase}/teams`,
      },
      {
        key: "standings",
        label: "Standings",
        mobileLabel: "Standings",
        href: `${playoffBase}/standings`,
      },
      {
        key: "playoffs",
        label: "Playoffs",
        mobileLabel: "Playoffs",
        href: `${playoffBase}/playoffs`,
      },
      {
        key: "recap",
        label: "Recap",
        mobileLabel: "Recap",
        href: `${playoffBase}/recap`,
      },
      {
        key: "trophyCase",
        label: "Trophy Case",
        mobileLabel: "Trophies",
        href: `${playoffBase}/trophy-case`,
      },
      {
        key: "settings",
        label: "Settings",
        mobileLabel: "Settings",
        href: `${playoffBase}/settings`,
      },
    ];

    if (isCommissioner) {
      items.push({
        key: "commissioner",
        label: "Commissioner",
        mobileLabel: "Commish",
        href: `${playoffBase}/commissioner`,
      });
    }

    return items;
  }

  /*
   * =========================================
   * G365 PICK'EM
   * =========================================
   */
  if (leagueType === "pickem") {
    const pickemBase = `${base}/pickem`;

    const items: LeagueNavItem[] = [
      {
        key: "home",
        label: "Home",
        mobileLabel: "Home",
        href: pickemBase,
        exact: true,
      },
      {
        key: "picks",
        label: "My Picks",
        mobileLabel: "My Picks",
        href: `${pickemBase}/picks`,
      },
      {
        key: "leaguePicks",
        label: "League Picks",
        mobileLabel: "League",
        href: `${pickemBase}/league-picks`,
      },
      {
        key: "games",
        label: "Games",
        mobileLabel: "Games",
        href: `${pickemBase}/games`,
      },
      {
        key: "standings",
        label: "Standings",
        mobileLabel: "Standings",
        href: `${pickemBase}/standings`,
      },
      {
        key: "recap",
        label: "Recap",
        mobileLabel: "Recap",
        href: `${pickemBase}/recap`,
      },
      {
        key: "settings",
        label: "Settings",
        mobileLabel: "Settings",
        href: `${pickemBase}/settings`,
      },
    ];

    if (isCommissioner) {
      items.push({
        key: "commissioner",
        label: "Commissioner",
        mobileLabel: "Commish",
        href: `${pickemBase}/commissioner`,
      });
    }

    return items;
  }

  /*
   * =========================================
   * GREYHOUND RACING
   * =========================================
   */
  if (leagueType === "greyhound") {
    const greyhoundBase = `${base}/greyhound`;

    const items: LeagueNavItem[] = [
      {
        key: "home",
        label: "Home",
        mobileLabel: "Home",
        href: greyhoundBase,
        exact: true,
      },
      {
        key: "wagers",
        label: "My Wagers",
        mobileLabel: "Wagers",
        href: `${greyhoundBase}/wagers`,
      },
      {
        key: "leagueWagers",
        label: "League Wagers",
        mobileLabel: "League",
        href: `${greyhoundBase}/league-wagers`,
      },
      {
        key: "standings",
        label: "Standings",
        mobileLabel: "Standings",
        href: `${greyhoundBase}/standings`,
      },
      {
        key: "recap",
        label: "Recap",
        mobileLabel: "Recap",
        href: `${greyhoundBase}/recap`,
      },
      {
        key: "trophyCase",
        label: "Trophy Case",
        mobileLabel: "Trophies",
        href: `${greyhoundBase}/trophy-case`,
      },
      {
        key: "settings",
        label: "Settings",
        mobileLabel: "Settings",
        href: `${greyhoundBase}/settings`,
      },
    ];

    if (isCommissioner) {
      items.push({
        key: "commissioner",
        label: "Commissioner",
        mobileLabel: "Commish",
        href: `${greyhoundBase}/commissioner`,
      });
    }

    return items;
  }

  return [];
}