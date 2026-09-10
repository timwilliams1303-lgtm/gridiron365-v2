import type {
  G365LeagueType,
  LeagueCapabilityKey,
  SeasonLongCompetitionFormat,
} from "./leagueCapabilities";

export type LeagueNavItem = {
  key: LeagueCapabilityKey;
  label: string;
  mobileLabel: string;
  href: string;
  exact?: boolean;
};


export type LeaguePrimaryAction = {
  label: string;
  href: string;
};

type GetLeaguePrimaryActionArgs = {
  leagueId: string;
  leagueType: G365LeagueType;
};

export function getLeaguePrimaryAction({
  leagueId,
  leagueType,
}: GetLeaguePrimaryActionArgs): LeaguePrimaryAction {
  const base =
    `/league/${leagueId}`;

  switch (leagueType) {
    case "traditional":
      return {
        label: "My Team",
        href: `${base}/team`,
      };

    case "season_long":
    case "nfl_playoffs":
      return {
        label: "My Entry",
        href: `${base}/entry`,
      };

    case "pickem":
      return {
        label: "My Picks",
        href: `${base}/pickem/my-picks`,
      };

    default: {
      const exhaustiveCheck:
        never =
          leagueType;

      return exhaustiveCheck;
    }
  }
}

type GetLeagueNavItemsArgs = {
  leagueId: string;
  leagueType: G365LeagueType;
  competitionFormat?: SeasonLongCompetitionFormat | null;
  playoffsEnabled?: boolean;
  isCommissioner?: boolean;
};

export function getLeagueNavItems({
  leagueId,
  leagueType,
  competitionFormat = null,
  playoffsEnabled = false,
  isCommissioner = false,
}: GetLeagueNavItemsArgs): LeagueNavItem[] {
  const base =
    `/league/${leagueId}`;

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
        mobileLabel: "Team",
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
        label: "My Rankings",
        mobileLabel: "Rankings",
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
        label: "League History",
        mobileLabel: "History",
        href: `${base}/history`,
      },
      {
        key: "draft",
        label: "Draft",
        mobileLabel: "Draft",
        href: `${base}/draft`,
        exact: true,
      },
      {
        key: "draftGrades",
        label: "Draft Grades",
        mobileLabel: "Grades",
        href: `${base}/draft/grades`,
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

  if (leagueType === "season_long") {
    const isHeadToHead =
      competitionFormat === "head_to_head";

    const items: LeagueNavItem[] = [
      {
        key: "home",
        label: "Home",
        mobileLabel: "Home",
        href: base,
        exact: true,
      },
      {
        key: "myEntry",
        label: "My Entry",
        mobileLabel: "Entry",
        href: `${base}/entry`,
      },
    ];

    if (isHeadToHead) {
      items.push({
        key: "matchups",
        label: "Matchups",
        mobileLabel: "Matchups",
        href: `${base}/season-long/matchups`,
      });
    } else {
      items.push({
        key: "leagueTeams",
        label: "League Teams",
        mobileLabel: "Teams",
        href: `${base}/teams`,
      });
    }

    items.push({
      key: "standings",
      label: "Standings",
      mobileLabel: "Standings",
      href: `${base}/standings`,
    });

    if (
      isHeadToHead &&
      playoffsEnabled
    ) {
      items.push({
        key: "playoffs",
        label: "Playoffs",
        mobileLabel: "Playoffs",
        href: `${base}/season-long/playoffs`,
      });
    }

    items.push(
      {
        key: "recap",
        label: "Recap",
        mobileLabel: "Recap",
        href: `${base}/season-long/recap`,
      },
      {
        key: "trophyCase",
        label: "Trophy Case",
        mobileLabel: "Trophies",
        href: `${base}/season-long/trophy-case`,
      },
      {
        key: "settings",
        label: "Settings",
        mobileLabel: "Settings",
        href: `${base}/settings`,
      }
    );

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

  if (leagueType === "nfl_playoffs") {
    const items: LeagueNavItem[] = [
      {
        key: "home",
        label: "Home",
        mobileLabel: "Home",
        href: base,
        exact: true,
      },
      {
        key: "myEntry",
        label: "My Entry",
        mobileLabel: "Entry",
        href: `${base}/entry`,
      },
      {
        key: "leagueTeams",
        label: "League Teams",
        mobileLabel: "Teams",
        href: `${base}/nfl-playoffs/teams`,
      },
      {
        key: "standings",
        label: "Standings",
        mobileLabel: "Standings",
        href: `${base}/nfl-playoffs/standings`,
      },
      {
        key: "playoffs",
        label: "NFL Playoffs",
        mobileLabel: "Playoffs",
        href: `${base}/nfl-playoffs/playoffs`,
      },
      {
        key: "recap",
        label: "Recap",
        mobileLabel: "Recap",
        href: `${base}/nfl-playoffs/recap`,
      },
      {
        key: "trophyCase",
        label: "Trophy Case",
        mobileLabel: "Trophies",
        href: `${base}/nfl-playoffs/trophy-case`,
      },
      {
        key: "settings",
        label: "Settings",
        mobileLabel: "Settings",
        href: `${base}/nfl-playoffs/settings`,
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

  const items: LeagueNavItem[] = [
    {
      key: "home",
      label: "Home",
      mobileLabel: "Home",
      href: base,
      exact: true,
    },
    {
      key: "picks",
      label: "My Picks",
      mobileLabel: "Picks",
      href: `${base}/pickem/my-picks`,
    },
    {
      key: "leaguePicks",
      label: "League Picks",
      mobileLabel: "League",
      href: `${base}/pickem/league-picks`,
    },
    {
      key: "games",
      label: "Games",
      mobileLabel: "Games",
      href: `${base}/pickem/games`,
    },
    {
      key: "standings",
      label: "Standings",
      mobileLabel: "Standings",
      href: `${base}/pickem/standings`,
    },
    {
      key: "recap",
      label: "Recap",
      mobileLabel: "Recap",
      href: `${base}/pickem/recap`,
    },
    {
      key: "settings",
      label: "Settings",
      mobileLabel: "Settings",
      href: `${base}/pickem/settings`,
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
