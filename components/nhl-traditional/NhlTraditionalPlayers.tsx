import type { CSSProperties } from "react";
import Link from "next/link";

import Card from "@/components/ui/Card";
import { requireLeagueMember } from "@/lib/leagues/requireLeagueMember";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type NhlTraditionalPlayersProps = {
  leagueId: string;

  filters?: {
    search?: string;
    ownership?: string;
    team?: string;
    position?: string;
    sort?: string;
    direction?: string;
  };
};

type PlayerRow = {
  id: number;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  jersey_number: string | null;
  position: string | null;
  position_group: string | null;
  team_id: number | null;
  active: boolean | null;
  status: string | null;
  injury_status: string | null;
  headshot_url: string | null;
};

type NhlTeamRow = {
  id: number;
  name: string | null;
  display_name: string | null;
  abbreviation: string | null;
};

type FantasyTeamRow = {
  id: number;
  team_name: string | null;
};

type RosterRow = {
  nhl_player_id: number;
  fantasy_team_id: number;
};

type SeasonTotalRow = {
  nhl_player_id: number;

  games_played: number | string | null;
  fantasy_points: number | string | null;
  fantasy_points_per_game: number | string | null;

  goals: number | string | null;
  assists: number | string | null;
  points: number | string | null;
  shots_on_goal: number | string | null;
  hits: number | string | null;
  blocked_shots: number | string | null;
  power_play_points: number | string | null;
  short_handed_points: number | string | null;

  goalie_starts: number | string | null;
  goalie_wins: number | string | null;
  saves: number | string | null;
  shots_against: number | string | null;
  goals_against: number | string | null;
  shutouts: number | string | null;
  goalie_minutes_seconds: number | string | null;

  save_percentage: number | string | null;
  goals_against_average: number | string | null;
};

type DraftRow = {
  id?: string;
  status?: string | null;
  draft_status?: string | null;
  completed_at?: string | null;
};

type PlayerSummary = PlayerRow & {
  nhlTeamName: string;
  nhlTeamAbbreviation: string;

  fantasyTeamId: number | null;
  fantasyTeamName: string | null;
  isFreeAgent: boolean;

  gamesPlayed: number;
  fantasyPoints: number;
  fantasyPointsPerGame: number;

  goals: number;
  assists: number;
  points: number;
  shotsOnGoal: number;
  hits: number;
  blockedShots: number;
  powerPlayPoints: number;
  shortHandedPoints: number;

  goalieStarts: number;
  goalieWins: number;
  saves: number;
  shotsAgainst: number;
  goalsAgainst: number;
  shutouts: number;
  goalieMinutesSeconds: number;

  savePercentage: number | null;
  goalsAgainstAverage: number | null;
};

type SortKey =
  | "fantasy_points"
  | "fantasy_points_per_game"
  | "games_played"
  | "goals"
  | "assists"
  | "points"
  | "shots_on_goal"
  | "hits"
  | "blocked_shots"
  | "power_play_points"
  | "short_handed_points"
  | "goalie_starts"
  | "goalie_wins"
  | "saves"
  | "shots_against"
  | "goals_against"
  | "shutouts"
  | "save_percentage"
  | "goals_against_average";

type SortDirection = "asc" | "desc";

const SORT_KEYS: SortKey[] = [
  "fantasy_points",
  "fantasy_points_per_game",
  "games_played",
  "goals",
  "assists",
  "points",
  "shots_on_goal",
  "hits",
  "blocked_shots",
  "power_play_points",
  "short_handed_points",
  "goalie_starts",
  "goalie_wins",
  "saves",
  "shots_against",
  "goals_against",
  "shutouts",
  "save_percentage",
  "goals_against_average",
];

function numberValue(
  value: number | string | null | undefined
) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function nullableNumber(
  value: number | string | null | undefined
) {
  if (value == null || value === "") {
    return null;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
}

function formatNumber(
  value: number,
  decimals = 0
) {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function formatSeasonLabel(season: number) {
  const nextYear = String(season + 1).slice(-2);
  return `${season}-${nextYear}`;
}

function normalizePosition(
  position: string | null | undefined,
  positionMode: string
) {
  const value = String(position ?? "")
    .trim()
    .toUpperCase();

  if (positionMode === "fdg") {
    if (value === "G") {
      return "G";
    }

    if (value === "D") {
      return "D";
    }

    if (
      value === "C" ||
      value === "LW" ||
      value === "RW" ||
      value === "F"
    ) {
      return "F";
    }
  }

  return value || "—";
}

function positionMatches(
  position: string | null | undefined,
  filter: string,
  positionMode: string
) {
  if (filter === "ALL") {
    return true;
  }

  return normalizePosition(
    position,
    positionMode
  ) === filter;
}

function playerStatusLabel(
  player: PlayerRow
) {
  const injury = String(
    player.injury_status ?? ""
  ).trim();

  if (injury) {
    return injury.toUpperCase();
  }

  const status = String(
    player.status ?? ""
  ).trim();

  if (
    status &&
    status.toLowerCase() !== "active" &&
    status.toLowerCase() !== "historical"
  ) {
    return status.toUpperCase();
  }

  return "";
}

function getPlayerName(player: PlayerRow) {
  if (player.display_name) {
    return player.display_name;
  }

  const fullName = `${
    player.first_name ?? ""
  } ${player.last_name ?? ""}`.trim();

  return (
    fullName ||
    `Player #${player.id}`
  );
}

function isDraftComplete(
  draft: DraftRow | null
) {
  if (!draft) {
    return false;
  }

  if (draft.completed_at) {
    return true;
  }

  const status = String(
    draft.status ??
      draft.draft_status ??
      ""
  )
    .trim()
    .toLowerCase();

  return [
    "completed",
    "complete",
    "finished",
    "final",
  ].includes(status);
}

function sortValue(
  player: PlayerSummary,
  sort: SortKey
) {
  switch (sort) {
    case "fantasy_points":
      return player.fantasyPoints;

    case "fantasy_points_per_game":
      return player.fantasyPointsPerGame;

    case "games_played":
      return player.gamesPlayed;

    case "goals":
      return player.goals;

    case "assists":
      return player.assists;

    case "points":
      return player.points;

    case "shots_on_goal":
      return player.shotsOnGoal;

    case "hits":
      return player.hits;

    case "blocked_shots":
      return player.blockedShots;

    case "power_play_points":
      return player.powerPlayPoints;

    case "short_handed_points":
      return player.shortHandedPoints;

    case "goalie_starts":
      return player.goalieStarts;

    case "goalie_wins":
      return player.goalieWins;

    case "saves":
      return player.saves;

    case "shots_against":
      return player.shotsAgainst;

    case "goals_against":
      return player.goalsAgainst;

    case "shutouts":
      return player.shutouts;

    case "save_percentage":
      return player.savePercentage ?? -1;

    case "goals_against_average":
      return player.goalsAgainstAverage ?? -1;

    default:
      return player.fantasyPoints;
  }
}

function isGoalieSort(sort: SortKey) {
  return [
    "goalie_starts",
    "goalie_wins",
    "saves",
    "shots_against",
    "goals_against",
    "shutouts",
    "save_percentage",
    "goals_against_average",
  ].includes(sort);
}

function isSkaterSort(sort: SortKey) {
  return [
    "goals",
    "assists",
    "points",
    "shots_on_goal",
    "hits",
    "blocked_shots",
    "power_play_points",
    "short_handed_points",
  ].includes(sort);
}

function sortLabel(sort: SortKey) {
  const labels: Record<
    SortKey,
    string
  > = {
    fantasy_points:
      "Fantasy Points",
    fantasy_points_per_game:
      "Fantasy Points Per Game",
    games_played:
      "Games Played",
    goals:
      "Goals",
    assists:
      "Assists",
    points:
      "Points",
    shots_on_goal:
      "Shots on Goal",
    hits:
      "Hits",
    blocked_shots:
      "Blocked Shots",
    power_play_points:
      "Power Play Points",
    short_handed_points:
      "Short-Handed Points",
    goalie_starts:
      "Goalie Starts",
    goalie_wins:
      "Goalie Wins",
    saves:
      "Saves",
    shots_against:
      "Shots Against",
    goals_against:
      "Goals Against",
    shutouts:
      "Shutouts",
    save_percentage:
      "Save Percentage",
    goals_against_average:
      "Goals Against Average",
  };

  return labels[sort];
}

function buildPlayersHref(
  leagueId: string,
  filters: {
    search?: string;
    ownership?: string;
    team?: string;
    position?: string;
    sort?: string;
    direction?: string;
  }
) {
  const params =
    new URLSearchParams();

  const search = String(
    filters.search ?? ""
  ).trim();

  const ownership = String(
    filters.ownership ?? ""
  ).trim();

  const team = String(
    filters.team ?? ""
  ).trim();

  const position = String(
    filters.position ?? ""
  ).trim();

  const sort = String(
    filters.sort ?? ""
  ).trim();

  const direction = String(
    filters.direction ?? ""
  ).trim();

  if (search) {
    params.set(
      "search",
      search
    );
  }

  if (ownership) {
    params.set(
      "ownership",
      ownership
    );
  }

  if (
    team &&
    team !== "ALL"
  ) {
    params.set(
      "team",
      team
    );
  }

  if (
    position &&
    position !== "ALL"
  ) {
    params.set(
      "position",
      position
    );
  }

  if (sort) {
    params.set(
      "sort",
      sort
    );
  }

  if (direction) {
    params.set(
      "direction",
      direction
    );
  }

  const query =
    params.toString();

  return query
    ? `/league/${leagueId}/nhl/players?${query}`
    : `/league/${leagueId}/nhl/players`;
}

export default async function NhlTraditionalPlayers({
  leagueId,
  filters = {},
}: NhlTraditionalPlayersProps) {
  await requireLeagueMember(
    leagueId
  );

  const supabase =
    await createSupabaseServerClient();

  const [
    settingsResult,
    leagueResult,
    nhlTeamsResult,
    playersResult,
    fantasyTeamsResult,
    rostersResult,
    draftResult,
  ] = await Promise.all([
    supabase
      .from(
        "nhl_traditional_settings"
      )
      .select(
        "league_format, position_mode"
      )
      .eq(
        "league_id",
        leagueId
      )
      .maybeSingle(),

    supabase
      .from("leagues")
      .select(
        "id, name, season, league_type"
      )
      .eq("id", leagueId)
      .single(),

    supabase
      .from("nhl_teams")
      .select(
        "id, name, display_name, abbreviation"
      )
      .eq("active", true)
      .order("name"),

    (async () => {
      const pageSize = 1000;
      const allPlayers: PlayerRow[] = [];

      for (let from = 0; ; from += pageSize) {
        const { data, error } = await supabase
          .from("nhl_players")
          .select(`
            id,
            display_name,
            first_name,
            last_name,
            jersey_number,
            position,
            position_group,
            team_id,
            active,
            status,
            injury_status,
            headshot_url
          `)
          .eq("active", true)
          .order("display_name", { ascending: true })
          .order("id", { ascending: true })
          .range(from, from + pageSize - 1);

        if (error) {
          return { data: null as PlayerRow[] | null, error };
        }

        const page = (data as PlayerRow[] | null) ?? [];
        allPlayers.push(...page);

        if (page.length < pageSize) break;
      }

      return { data: allPlayers, error: null };
    })(),

    supabase
      .from("fantasy_teams")
      .select(
        "id, team_name"
      )
      .eq(
        "league_id",
        leagueId
      )
      .eq("active", true),

    supabase
      .from(
        "nhl_traditional_rosters"
      )
      .select(
        "nhl_player_id, fantasy_team_id"
      )
      .eq(
        "league_id",
        leagueId
      ),

    supabase
      .from(
        "nhl_traditional_drafts"
      )
      .select("*")
      .eq(
        "league_id",
        leagueId
      )
      .order(
        "created_at",
        {
          ascending: false,
        }
      )
      .limit(1)
      .maybeSingle(),
  ]);

  if (leagueResult.error) {
    return (
      <ErrorPage
        message={`Unable to load this league: ${leagueResult.error.message}`}
      />
    );
  }

  const league =
    leagueResult.data;

  if (
    league.league_type !==
    "nhl_traditional"
  ) {
    return (
      <ErrorPage
        message="This page is only available for NHL Traditional leagues."
      />
    );
  }

  if (settingsResult.error) {
    return (
      <ErrorPage
        message={`Unable to load NHL league settings: ${settingsResult.error.message}`}
      />
    );
  }

  if (nhlTeamsResult.error) {
    return (
      <ErrorPage
        message={`Unable to load NHL teams: ${nhlTeamsResult.error.message}`}
      />
    );
  }

  if (playersResult.error) {
    return (
      <ErrorPage
        message={`Unable to load NHL players: ${playersResult.error.message}`}
      />
    );
  }

  if (
    fantasyTeamsResult.error
  ) {
    return (
      <ErrorPage
        message={`Unable to load fantasy teams: ${fantasyTeamsResult.error.message}`}
      />
    );
  }

  if (rostersResult.error) {
    return (
      <ErrorPage
        message={`Unable to load NHL roster ownership: ${rostersResult.error.message}`}
      />
    );
  }

  const draft =
    draftResult.error
      ? null
      : ((draftResult.data ??
          null) as DraftRow | null);

  const draftComplete =
    isDraftComplete(draft);

  const leagueSeason =
    Number(
      league.season ?? 2026
    );

  /*
   * G365 season 2026 =
   * NHL season 2026-27.
   */
  const statSeason =
    leagueSeason;

  const seasonLabel =
    formatSeasonLabel(
      statSeason
    );

  const positionMode =
    String(
      settingsResult.data
        ?.position_mode ??
        "detailed"
    )
      .trim()
      .toLowerCase() ===
    "fdg"
      ? "fdg"
      : "detailed";

  const leagueFormat =
    String(
      settingsResult.data
        ?.league_format ??
        "redraft"
    )
      .trim()
      .toLowerCase() ===
    "dynasty"
      ? "Dynasty"
      : "Redraft";

  const totalsResult =
    await supabase.rpc(
      "get_nhl_traditional_player_season_totals",
      {
        p_league_id:
          leagueId,
        p_season:
          statSeason,
        p_season_type:
          "regular",
      }
    );

  if (totalsResult.error) {
    return (
      <ErrorPage
        message={`Unable to load ${seasonLabel} NHL season totals: ${totalsResult.error.message}`}
      />
    );
  }

  const players =
    (playersResult.data ??
      []) as PlayerRow[];

  const nhlTeams =
    (nhlTeamsResult.data ??
      []) as NhlTeamRow[];

  const fantasyTeams =
    (fantasyTeamsResult.data ??
      []) as FantasyTeamRow[];

  const rosters =
    (rostersResult.data ??
      []) as RosterRow[];

  const totals =
    (totalsResult.data ??
      []) as SeasonTotalRow[];

  const nhlTeamMap =
    new Map<
      number,
      NhlTeamRow
    >();

  for (
    const team of nhlTeams
  ) {
    nhlTeamMap.set(
      team.id,
      team
    );
  }

  const fantasyTeamMap =
    new Map<
      number,
      FantasyTeamRow
    >();

  for (
    const team of fantasyTeams
  ) {
    fantasyTeamMap.set(
      team.id,
      team
    );
  }

  const ownershipMap =
    new Map<number, number>();

  for (
    const roster of rosters
  ) {
    ownershipMap.set(
      Number(
        roster.nhl_player_id
      ),
      Number(
        roster.fantasy_team_id
      )
    );
  }

  const totalsMap =
    new Map<
      number,
      SeasonTotalRow
    >();

  for (
    const total of totals
  ) {
    totalsMap.set(
      Number(
        total.nhl_player_id
      ),
      total
    );
  }

  const summaries: PlayerSummary[] =
    players.map(
      (player) => {
        const nhlTeam =
          player.team_id == null
            ? null
            : nhlTeamMap.get(
                player.team_id
              ) ?? null;

        const fantasyTeamId =
          ownershipMap.get(
            player.id
          ) ?? null;

        const fantasyTeam =
          fantasyTeamId == null
            ? null
            : fantasyTeamMap.get(
                fantasyTeamId
              ) ?? null;

        const total =
          totalsMap.get(
            player.id
          );

        const shotsAgainst =
          numberValue(
            total?.shots_against
          );

        const goalieMinutes =
          numberValue(
            total?.goalie_minutes_seconds
          );

        const rawSavePercentage =
          nullableNumber(
            total?.save_percentage
          );

        const rawGaa =
          nullableNumber(
            total?.goals_against_average
          );

        return {
          ...player,

          nhlTeamName:
            nhlTeam?.display_name ??
            nhlTeam?.name ??
            (player.team_id ==
            null
              ? "NHL Free Agent"
              : "Unknown"),

          nhlTeamAbbreviation:
            nhlTeam
              ?.abbreviation ??
            (player.team_id ==
            null
              ? "FA"
              : "—"),

          fantasyTeamId,

          fantasyTeamName:
            fantasyTeam
              ?.team_name ??
            null,

          isFreeAgent:
            fantasyTeamId ==
            null,

          gamesPlayed:
            numberValue(
              total?.games_played
            ),

          fantasyPoints:
            numberValue(
              total?.fantasy_points
            ),

          fantasyPointsPerGame:
            numberValue(
              total?.fantasy_points_per_game
            ),

          goals:
            numberValue(
              total?.goals
            ),

          assists:
            numberValue(
              total?.assists
            ),

          points:
            numberValue(
              total?.points
            ),

          shotsOnGoal:
            numberValue(
              total?.shots_on_goal
            ),

          hits:
            numberValue(
              total?.hits
            ),

          blockedShots:
            numberValue(
              total?.blocked_shots
            ),

          powerPlayPoints:
            numberValue(
              total?.power_play_points
            ),

          shortHandedPoints:
            numberValue(
              total?.short_handed_points
            ),

          goalieStarts:
            numberValue(
              total?.goalie_starts
            ),

          goalieWins:
            numberValue(
              total?.goalie_wins
            ),

          saves:
            numberValue(
              total?.saves
            ),

          shotsAgainst,

          goalsAgainst:
            numberValue(
              total?.goals_against
            ),

          shutouts:
            numberValue(
              total?.shutouts
            ),

          goalieMinutesSeconds:
            goalieMinutes,

          savePercentage:
            shotsAgainst > 0
              ? rawSavePercentage
              : null,

          goalsAgainstAverage:
            goalieMinutes > 0
              ? rawGaa
              : null,
        };
      }
    );

  const searchFilter =
    String(
      filters.search ?? ""
    )
      .trim()
      .toLowerCase();

  const requestedOwnership =
    String(
      filters.ownership ?? "ALL"
    )
      .trim()
      .toUpperCase();

  const ownershipFilter =
    requestedOwnership ===
      "FA" ||
    requestedOwnership ===
      "OWNED"
      ? requestedOwnership
      : "ALL";

  const teamFilter =
    String(
      filters.team ?? "ALL"
    )
      .trim()
      .toUpperCase();

  const requestedPosition =
    String(
      filters.position ??
        "ALL"
    )
      .trim()
      .toUpperCase();

  const allowedPositionFilters =
    positionMode === "fdg"
      ? [
          "ALL",
          "F",
          "D",
          "G",
        ]
      : [
          "ALL",
          "C",
          "LW",
          "RW",
          "D",
          "G",
        ];

  const positionFilter =
    allowedPositionFilters.includes(
      requestedPosition
    )
      ? requestedPosition
      : "ALL";

  const requestedSort =
    String(
      filters.sort ??
        "fantasy_points"
    )
      .trim()
      .toLowerCase() as SortKey;

  const sortKey =
    SORT_KEYS.includes(
      requestedSort
    )
      ? requestedSort
      : "fantasy_points";

  const defaultDirection: SortDirection =
    sortKey ===
    "goals_against_average"
      ? "asc"
      : "desc";

  const requestedDirection =
    String(
      filters.direction ??
        defaultDirection
    )
      .trim()
      .toLowerCase();

  const sortDirection: SortDirection =
    requestedDirection ===
    "asc"
      ? "asc"
      : "desc";

  let filteredSummaries =
    summaries.filter(
      (player) => {
        const playerName =
          getPlayerName(
            player
          ).toLowerCase();

        if (
          searchFilter &&
          !playerName.includes(
            searchFilter
          )
        ) {
          return false;
        }

        if (
          ownershipFilter ===
            "FA" &&
          !player.isFreeAgent
        ) {
          return false;
        }

        if (
          ownershipFilter ===
            "OWNED" &&
          player.isFreeAgent
        ) {
          return false;
        }

        if (
          teamFilter !==
          "ALL"
        ) {
          if (
            String(
              player.team_id ??
                ""
            ) !== teamFilter
          ) {
            return false;
          }
        }

        if (
          !positionMatches(
            player.position,
            positionFilter,
            positionMode
          )
        ) {
          return false;
        }

        if (
          isGoalieSort(
            sortKey
          ) &&
          normalizePosition(
            player.position,
            positionMode
          ) !== "G"
        ) {
          return false;
        }

        if (
          isSkaterSort(
            sortKey
          ) &&
          normalizePosition(
            player.position,
            positionMode
          ) === "G"
        ) {
          return false;
        }

        return true;
      }
    );

  filteredSummaries = [
    ...filteredSummaries,
  ].sort((a, b) => {
    if (
      sortKey ===
      "save_percentage"
    ) {
      const aQualified =
        a.shotsAgainst > 0;

      const bQualified =
        b.shotsAgainst > 0;

      if (
        aQualified !==
        bQualified
      ) {
        return aQualified
          ? -1
          : 1;
      }
    }

    if (
      sortKey ===
      "goals_against_average"
    ) {
      const aQualified =
        a.goalieMinutesSeconds >
        0;

      const bQualified =
        b.goalieMinutesSeconds >
        0;

      if (
        aQualified !==
        bQualified
      ) {
        return aQualified
          ? -1
          : 1;
      }
    }

    const aValue =
      sortValue(
        a,
        sortKey
      );

    const bValue =
      sortValue(
        b,
        sortKey
      );

    if (
      aValue !== bValue
    ) {
      return sortDirection ===
        "asc"
        ? aValue - bValue
        : bValue - aValue;
    }

    if (
      b.fantasyPoints !==
      a.fantasyPoints
    ) {
      return (
        b.fantasyPoints -
        a.fantasyPoints
      );
    }

    return getPlayerName(
      a
    ).localeCompare(
      getPlayerName(b)
    );
  });

  const baseFilterState = {
    search:
      filters.search ?? "",
    ownership:
      ownershipFilter,
    team:
      teamFilter,
    position:
      positionFilter,
  };

  const hasFilters =
    Boolean(searchFilter) ||
    ownershipFilter !== "ALL" ||
    teamFilter !== "ALL" ||
    positionFilter !==
      "ALL" ||
    sortKey !==
      "fantasy_points" ||
    sortDirection !== "desc";

  return (
    <main style={styles.page}>
      <div
        style={
          styles.container
        }
      >
        <section
          style={styles.hero}
        >
          <div
            style={
              styles.heroGlow
            }
          />

          <div
            style={
              styles.heroContent
            }
          >
            <div>
              <div
                style={
                  styles.eyebrow
                }
              >
                G365 NHL
                TRADITIONAL •{" "}
                {leagueFormat.toUpperCase()}
              </div>

              <h1
                style={
                  styles.title
                }
              >
                Players
              </h1>

              <p
                style={
                  styles.subtitle
                }
              >
                {seasonLabel} NHL
                player rankings
                using this
                league&apos;s
                fantasy scoring.
                Click any stat
                header to sort the
                player pool.
              </p>
            </div>

            <div
              style={
                styles.heroStats
              }
            >
              <HeroStat
                label="SEASON"
                value={
                  seasonLabel
                }
              />

              <HeroStat
                label="PLAYER POOL"
                value={String(
                  summaries.length
                )}
              />

              <HeroStat
                label="DEFAULT"
                value="ALL PLAYERS"
              />

              <HeroStat
                label="FORMAT"
                value={
                  positionMode ===
                  "fdg"
                    ? "F / D / G"
                    : "DETAILED"
                }
              />
            </div>
          </div>
        </section>

        <Card>
          <div
            style={
              styles.filterArea
            }
          >
            <div
              style={
                styles.filterTop
              }
            >
              <div>
                <div
                  style={
                    styles.sectionEyebrow
                  }
                >
                  {draftComplete
                    ? "POST-DRAFT PLAYER POOL"
                    : "PLAYER POOL"}
                </div>

                <h2
                  style={
                    styles.sectionTitle
                  }
                >
                  {ownershipFilter ===
                  "FA"
                    ? "Top Free Agents"
                    : ownershipFilter ===
                        "OWNED"
                      ? "Rostered Players"
                      : "All Players"}
                </h2>
              </div>

              <div
                style={
                  styles.sortNote
                }
              >
                Sorted by{" "}
                <strong>
                  {sortLabel(
                    sortKey
                  )}
                </strong>{" "}
                {sortDirection ===
                "desc"
                  ? "▼"
                  : "▲"}
              </div>
            </div>

            <form
              method="get"
              style={
                styles.filterForm
              }
            >
              <div
                style={
                  styles.searchWrap
                }
              >
                <label
                  htmlFor="search"
                  style={
                    styles.label
                  }
                >
                  Search
                </label>

                <input
                  id="search"
                  name="search"
                  type="search"
                  placeholder="Search player..."
                  defaultValue={
                    filters.search ??
                    ""
                  }
                  style={
                    styles.input
                  }
                />
              </div>

              <div
                style={
                  styles.selectWrap
                }
              >
                <label
                  htmlFor="ownership"
                  style={
                    styles.label
                  }
                >
                  Fantasy Status
                </label>

                <select
                  id="ownership"
                  name="ownership"
                  defaultValue={
                    ownershipFilter
                  }
                  style={
                    styles.select
                  }
                >
                  <option value="FA">
                    Free Agents
                  </option>

                  <option value="ALL">
                    All Players
                  </option>

                  <option value="OWNED">
                    Rostered
                    Players
                  </option>
                </select>
              </div>

              <div
                style={
                  styles.selectWrap
                }
              >
                <label
                  htmlFor="team"
                  style={
                    styles.label
                  }
                >
                  NHL Team
                </label>

                <select
                  id="team"
                  name="team"
                  defaultValue={
                    teamFilter
                  }
                  style={
                    styles.select
                  }
                >
                  <option value="ALL">
                    All NHL Teams
                  </option>

                  {nhlTeams.map(
                    (team) => (
                      <option
                        key={
                          team.id
                        }
                        value={String(
                          team.id
                        )}
                      >
                        {team.display_name ??
                          team.name ??
                          team.abbreviation ??
                          `Team ${team.id}`}
                      </option>
                    )
                  )}
                </select>
              </div>

              <input
                type="hidden"
                name="position"
                value={
                  positionFilter
                }
              />

              <input
                type="hidden"
                name="sort"
                value={sortKey}
              />

              <input
                type="hidden"
                name="direction"
                value={
                  sortDirection
                }
              />

              <div
                style={
                  styles.filterButtonWrap
                }
              >
                <button
                  type="submit"
                  style={
                    styles.applyButton
                  }
                >
                  Apply Filters
                </button>
              </div>
            </form>

            <div
              style={
                styles.positionRow
              }
            >
              {allowedPositionFilters.map(
                (position) => (
                  <Link
                    key={
                      position
                    }
                    href={buildPlayersHref(
                      leagueId,
                      {
                        ...baseFilterState,
                        position,
                        sort: sortKey,
                        direction:
                          sortDirection,
                      }
                    )}
                    style={
                      position ===
                      positionFilter
                        ? styles.positionButtonActive
                        : styles.positionButton
                    }
                  >
                    {position}
                  </Link>
                )
              )}
            </div>

            {hasFilters ? (
              <div
                style={
                  styles.clearRow
                }
              >
                <Link
                  href={`/league/${leagueId}/nhl/players`}
                  style={
                    styles.clearLink
                  }
                >
                  Reset Players
                  View
                </Link>
              </div>
            ) : null}
          </div>
        </Card>

        <div
          style={
            styles.spacer
          }
        />

        <Card>
          <div
            style={
              styles.tableHeader
            }
          >
            <div>
              <div
                style={
                  styles.sectionEyebrow
                }
              >
                {ownershipFilter ===
                "FA"
                  ? "AVAILABLE PLAYERS"
                  : "LEAGUE PLAYER RANKINGS"}
              </div>

              <h2
                style={
                  styles.sectionTitle
                }
              >
                {sortLabel(
                  sortKey
                )}{" "}
                Leaders
              </h2>
            </div>

            <div
              style={
                styles.resultCount
              }
            >
              {
                filteredSummaries.length
              }{" "}
              players
            </div>
          </div>

          {filteredSummaries.length ===
          0 ? (
            <div
              style={
                styles.emptyState
              }
            >
              No active NHL
              players match the
              selected filters.
            </div>
          ) : (
            <div
              style={
                styles.tableWrap
              }
            >
              <table
                style={
                  styles.table
                }
              >
                <thead>
                  <tr>
                    <th
                      style={
                        styles.rankHead
                      }
                    >
                      #
                    </th>

                    <th
                      style={
                        styles.leftHead
                      }
                    >
                      Player
                    </th>

                    <th
                      style={
                        styles.centerHead
                      }
                    >
                      NHL
                    </th>

                    <th
                      style={
                        styles.centerHead
                      }
                    >
                      Pos
                    </th>

                    <th
                      style={
                        styles.ownerHead
                      }
                    >
                      Owner
                    </th>

                    <SortHeader
                      leagueId={
                        leagueId
                      }
                      label="FP"
                      sortKey="fantasy_points"
                      activeSort={
                        sortKey
                      }
                      direction={
                        sortDirection
                      }
                      filters={
                        baseFilterState
                      }
                    />

                    <SortHeader
                      leagueId={
                        leagueId
                      }
                      label="FPPG"
                      sortKey="fantasy_points_per_game"
                      activeSort={
                        sortKey
                      }
                      direction={
                        sortDirection
                      }
                      filters={
                        baseFilterState
                      }
                    />

                    <SortHeader
                      leagueId={
                        leagueId
                      }
                      label="GP"
                      sortKey="games_played"
                      activeSort={
                        sortKey
                      }
                      direction={
                        sortDirection
                      }
                      filters={
                        baseFilterState
                      }
                    />

                    <SortHeader
                      leagueId={
                        leagueId
                      }
                      label="G"
                      sortKey="goals"
                      activeSort={
                        sortKey
                      }
                      direction={
                        sortDirection
                      }
                      filters={
                        baseFilterState
                      }
                    />

                    <SortHeader
                      leagueId={
                        leagueId
                      }
                      label="A"
                      sortKey="assists"
                      activeSort={
                        sortKey
                      }
                      direction={
                        sortDirection
                      }
                      filters={
                        baseFilterState
                      }
                    />

                    <SortHeader
                      leagueId={
                        leagueId
                      }
                      label="PTS"
                      sortKey="points"
                      activeSort={
                        sortKey
                      }
                      direction={
                        sortDirection
                      }
                      filters={
                        baseFilterState
                      }
                    />

                    <SortHeader
                      leagueId={
                        leagueId
                      }
                      label="SOG"
                      sortKey="shots_on_goal"
                      activeSort={
                        sortKey
                      }
                      direction={
                        sortDirection
                      }
                      filters={
                        baseFilterState
                      }
                    />

                    <SortHeader
                      leagueId={
                        leagueId
                      }
                      label="HIT"
                      sortKey="hits"
                      activeSort={
                        sortKey
                      }
                      direction={
                        sortDirection
                      }
                      filters={
                        baseFilterState
                      }
                    />

                    <SortHeader
                      leagueId={
                        leagueId
                      }
                      label="BLK"
                      sortKey="blocked_shots"
                      activeSort={
                        sortKey
                      }
                      direction={
                        sortDirection
                      }
                      filters={
                        baseFilterState
                      }
                    />

                    <SortHeader
                      leagueId={
                        leagueId
                      }
                      label="PPP"
                      sortKey="power_play_points"
                      activeSort={
                        sortKey
                      }
                      direction={
                        sortDirection
                      }
                      filters={
                        baseFilterState
                      }
                    />

                    <SortHeader
                      leagueId={
                        leagueId
                      }
                      label="SHP"
                      sortKey="short_handed_points"
                      activeSort={
                        sortKey
                      }
                      direction={
                        sortDirection
                      }
                      filters={
                        baseFilterState
                      }
                    />

                    <SortHeader
                      leagueId={
                        leagueId
                      }
                      label="GS"
                      sortKey="goalie_starts"
                      activeSort={
                        sortKey
                      }
                      direction={
                        sortDirection
                      }
                      filters={
                        baseFilterState
                      }
                    />

                    <SortHeader
                      leagueId={
                        leagueId
                      }
                      label="W"
                      sortKey="goalie_wins"
                      activeSort={
                        sortKey
                      }
                      direction={
                        sortDirection
                      }
                      filters={
                        baseFilterState
                      }
                    />

                    <SortHeader
                      leagueId={
                        leagueId
                      }
                      label="SV"
                      sortKey="saves"
                      activeSort={
                        sortKey
                      }
                      direction={
                        sortDirection
                      }
                      filters={
                        baseFilterState
                      }
                    />

                    <SortHeader
                      leagueId={
                        leagueId
                      }
                      label="SA"
                      sortKey="shots_against"
                      activeSort={
                        sortKey
                      }
                      direction={
                        sortDirection
                      }
                      filters={
                        baseFilterState
                      }
                    />

                    <SortHeader
                      leagueId={
                        leagueId
                      }
                      label="GA"
                      sortKey="goals_against"
                      activeSort={
                        sortKey
                      }
                      direction={
                        sortDirection
                      }
                      filters={
                        baseFilterState
                      }
                    />

                    <SortHeader
                      leagueId={
                        leagueId
                      }
                      label="SO"
                      sortKey="shutouts"
                      activeSort={
                        sortKey
                      }
                      direction={
                        sortDirection
                      }
                      filters={
                        baseFilterState
                      }
                    />

                    <SortHeader
                      leagueId={
                        leagueId
                      }
                      label="SV%"
                      sortKey="save_percentage"
                      activeSort={
                        sortKey
                      }
                      direction={
                        sortDirection
                      }
                      filters={
                        baseFilterState
                      }
                    />

                    <SortHeader
                      leagueId={
                        leagueId
                      }
                      label="GAA"
                      sortKey="goals_against_average"
                      activeSort={
                        sortKey
                      }
                      direction={
                        sortDirection
                      }
                      filters={
                        baseFilterState
                      }
                    />
                  </tr>
                </thead>

                <tbody>
                  {filteredSummaries.map(
                    (
                      player,
                      index
                    ) => {
                      const position =
                        normalizePosition(
                          player.position,
                          positionMode
                        );

                      const isGoalie =
                        position ===
                        "G";

                      const status =
                        playerStatusLabel(
                          player
                        );

                      return (
                        <tr
                          key={
                            player.id
                          }
                          style={
                            styles.tableRow
                          }
                        >
                          <td
                            style={
                              styles.rankCell
                            }
                          >
                            {index +
                              1}
                          </td>

                          <td
                            style={
                              styles.playerCell
                            }
                          >
                            <Link
                              href={`/league/${leagueId}/nhl/players/${player.id}`}
                              style={
                                styles.playerLink
                              }
                            >
                              {getPlayerName(
                                player
                              )}
                            </Link>

                            <div
                              style={
                                styles.playerMeta
                              }
                            >
                              {player.jersey_number
                                ? `#${player.jersey_number}`
                                : ""}

                              {status ? (
                                <span
                                  style={
                                    styles.injuryText
                                  }
                                >
                                  {player.jersey_number
                                    ? " • "
                                    : ""}
                                  {
                                    status
                                  }
                                </span>
                              ) : null}
                            </div>
                          </td>

                          <td
                            style={
                              styles.centerCell
                            }
                          >
                            {
                              player.nhlTeamAbbreviation
                            }
                          </td>

                          <td
                            style={
                              styles.positionCell
                            }
                          >
                            {
                              position
                            }
                          </td>

                          <td
                            style={
                              styles.ownerCell
                            }
                            title={
                              player.fantasyTeamName ??
                              "Free Agent"
                            }
                          >
                            {player.isFreeAgent ? (
                              <span
                                style={
                                  styles.freeAgent
                                }
                              >
                                FA
                              </span>
                            ) : (
                              player.fantasyTeamName ??
                              "ROSTERED"
                            )}
                          </td>

                          <StatCell
                            value={formatNumber(
                              player.fantasyPoints,
                              1
                            )}
                            fantasy
                          />

                          <StatCell
                            value={formatNumber(
                              player.fantasyPointsPerGame,
                              2
                            )}
                          />

                          <StatCell
                            value={formatNumber(
                              player.gamesPlayed
                            )}
                          />

                          <StatCell
                            value={
                              isGoalie
                                ? "—"
                                : formatNumber(
                                    player.goals
                                  )
                            }
                          />

                          <StatCell
                            value={
                              isGoalie
                                ? "—"
                                : formatNumber(
                                    player.assists
                                  )
                            }
                          />

                          <StatCell
                            value={
                              isGoalie
                                ? "—"
                                : formatNumber(
                                    player.points
                                  )
                            }
                          />

                          <StatCell
                            value={
                              isGoalie
                                ? "—"
                                : formatNumber(
                                    player.shotsOnGoal
                                  )
                            }
                          />

                          <StatCell
                            value={
                              isGoalie
                                ? "—"
                                : formatNumber(
                                    player.hits
                                  )
                            }
                          />

                          <StatCell
                            value={
                              isGoalie
                                ? "—"
                                : formatNumber(
                                    player.blockedShots
                                  )
                            }
                          />

                          <StatCell
                            value={
                              isGoalie
                                ? "—"
                                : formatNumber(
                                    player.powerPlayPoints
                                  )
                            }
                          />

                          <StatCell
                            value={
                              isGoalie
                                ? "—"
                                : formatNumber(
                                    player.shortHandedPoints
                                  )
                            }
                          />

                          <StatCell
                            value={
                              isGoalie
                                ? formatNumber(
                                    player.goalieStarts
                                  )
                                : "—"
                            }
                          />

                          <StatCell
                            value={
                              isGoalie
                                ? formatNumber(
                                    player.goalieWins
                                  )
                                : "—"
                            }
                          />

                          <StatCell
                            value={
                              isGoalie
                                ? formatNumber(
                                    player.saves
                                  )
                                : "—"
                            }
                          />

                          <StatCell
                            value={
                              isGoalie
                                ? formatNumber(
                                    player.shotsAgainst
                                  )
                                : "—"
                            }
                          />

                          <StatCell
                            value={
                              isGoalie
                                ? formatNumber(
                                    player.goalsAgainst
                                  )
                                : "—"
                            }
                          />

                          <StatCell
                            value={
                              isGoalie
                                ? formatNumber(
                                    player.shutouts
                                  )
                                : "—"
                            }
                          />

                          <StatCell
                            value={
                              isGoalie &&
                              player.savePercentage !=
                                null
                                ? player.savePercentage.toFixed(
                                    3
                                  )
                                : "—"
                            }
                          />

                          <StatCell
                            value={
                              isGoalie &&
                              player.goalsAgainstAverage !=
                                null
                                ? player.goalsAgainstAverage.toFixed(
                                    2
                                  )
                                : "—"
                            }
                          />
                        </tr>
                      );
                    }
                  )}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </main>
  );
}

function SortHeader({
  leagueId,
  label,
  sortKey,
  activeSort,
  direction,
  filters,
}: {
  leagueId: string;
  label: string;
  sortKey: SortKey;
  activeSort: SortKey;
  direction: SortDirection;

  filters: {
    search?: string;
    ownership?: string;
    team?: string;
    position?: string;
  };
}) {
  const active =
    activeSort === sortKey;

  let nextDirection: SortDirection;

  if (active) {
    nextDirection =
      direction === "desc"
        ? "asc"
        : "desc";
  } else {
    nextDirection =
      sortKey ===
      "goals_against_average"
        ? "asc"
        : "desc";
  }

  return (
    <th
      style={
        styles.numberHead
      }
    >
      <Link
        href={buildPlayersHref(
          leagueId,
          {
            ...filters,
            sort: sortKey,
            direction:
              nextDirection,
          }
        )}
        style={
          active
            ? styles.sortLinkActive
            : styles.sortLink
        }
      >
        {label}
        {active
          ? direction ===
            "desc"
            ? " ▼"
            : " ▲"
          : ""}
      </Link>
    </th>
  );
}

function StatCell({
  value,
  fantasy = false,
}: {
  value: string;
  fantasy?: boolean;
}) {
  return (
    <td
      style={
        fantasy
          ? styles.fantasyCell
          : styles.numberCell
      }
    >
      {value}
    </td>
  );
}

function HeroStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div
      style={
        styles.heroStat
      }
    >
      <span
        style={
          styles.heroStatLabel
        }
      >
        {label}
      </span>

      <strong
        style={
          styles.heroStatValue
        }
      >
        {value}
      </strong>
    </div>
  );
}

function ErrorPage({
  message,
}: {
  message: string;
}) {
  return (
    <main
      style={styles.page}
    >
      <div
        style={
          styles.container
        }
      >
        <Card>
          <div
            style={
              styles.errorBox
            }
          >
            {message}
          </div>
        </Card>
      </div>
    </main>
  );
}

const styles: Record<
  string,
  CSSProperties
> = {
  page: {
    minHeight: "100vh",
    background:
      "radial-gradient(circle at top, rgba(255,75,0,0.08), transparent 32%), #080808",
    color: "#ffffff",
    padding:
      "14px 8px 48px",
    overflowX: "hidden",
  },

  container: {
    width: "100%",
    maxWidth: 1800,
    margin: "0 auto",
    minWidth: 0,
  },

  hero: {
    position: "relative",
    overflow: "hidden",
    border:
      "1px solid rgba(255,90,0,0.35)",
    borderRadius: 16,
    background:
      "linear-gradient(135deg, #151515 0%, #0b0b0b 52%, #1b0903 100%)",
    boxShadow:
      "0 18px 55px rgba(0,0,0,0.38)",
    marginBottom: 12,
  },

  heroGlow: {
    position: "absolute",
    width: 300,
    height: 300,
    borderRadius: "50%",
    right: -100,
    top: -180,
    background:
      "radial-gradient(circle, rgba(255,72,0,0.32), rgba(255,72,0,0))",
    pointerEvents: "none",
  },

  heroContent: {
    position: "relative",
    zIndex: 1,
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent:
      "space-between",
    gap: 16,
    padding: "20px 18px",
  },

  eyebrow: {
    fontSize: 10,
    fontWeight: 900,
    letterSpacing:
      "0.14em",
    color: "#ff6a1a",
    marginBottom: 6,
  },

  title: {
    margin: 0,
    fontSize:
      "clamp(28px, 5vw, 44px)",
    lineHeight: 1,
    fontWeight: 950,
    letterSpacing:
      "-0.035em",
  },

  subtitle: {
    margin: "8px 0 0",
    maxWidth: 680,
    color: "#bcbcbc",
    fontSize: 13,
    lineHeight: 1.5,
  },

  heroStats: {
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
  },

  heroStat: {
    minWidth: 95,
    padding: "8px 10px",
    borderRadius: 10,
    border:
      "1px solid #292929",
    background:
      "rgba(0,0,0,0.38)",
  },

  heroStatLabel: {
    display: "block",
    color: "#8d8d8d",
    fontSize: 8,
    fontWeight: 900,
    letterSpacing:
      "0.1em",
  },

  heroStatValue: {
    display: "block",
    marginTop: 3,
    color: "#fff",
    fontSize: 13,
  },

  errorBox: {
    padding: 18,
    color: "#ffb2a0",
  },

  filterArea: {
    padding: 13,
  },

  filterTop: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent:
      "space-between",
    gap: 10,
    marginBottom: 11,
  },

  sectionEyebrow: {
    color: "#ff5a00",
    fontSize: 8,
    fontWeight: 950,
    letterSpacing:
      "0.12em",
  },

  sectionTitle: {
    margin: "2px 0 0",
    fontSize: 18,
    fontWeight: 950,
  },

  sortNote: {
    color: "#9b9b9b",
    fontSize: 10,
    fontWeight: 800,
  },

  filterForm: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "end",
    gap: 8,
  },

  searchWrap: {
    flex: "1 1 230px",
  },

  selectWrap: {
    flex: "1 1 165px",
    minWidth: 150,
  },

  filterButtonWrap: {
    flex: "0 0 auto",
  },

  label: {
    display: "block",
    marginBottom: 4,
    color: "#969696",
    fontSize: 9,
    fontWeight: 900,
    letterSpacing:
      "0.07em",
    textTransform:
      "uppercase",
  },

  input: {
    width: "100%",
    minHeight: 38,
    boxSizing:
      "border-box",
    borderRadius: 9,
    border:
      "1px solid #303030",
    background: "#090909",
    color: "#fff",
    padding: "0 10px",
    outline: "none",
    fontSize: 12,
  },

  select: {
    width: "100%",
    minHeight: 38,
    boxSizing:
      "border-box",
    borderRadius: 9,
    border:
      "1px solid #303030",
    background: "#090909",
    color: "#fff",
    padding: "0 10px",
    fontSize: 12,
  },

  applyButton: {
    minHeight: 38,
    borderRadius: 9,
    border:
      "1px solid #ff5a00",
    background:
      "linear-gradient(135deg, #ff5a00 0%, #dc2500 100%)",
    color: "#fff",
    padding: "0 15px",
    fontSize: 11,
    fontWeight: 950,
    cursor: "pointer",
  },

  positionRow: {
    display: "flex",
    gap: 6,
    flexWrap: "wrap",
    marginTop: 10,
  },

  positionButton: {
    minWidth: 40,
    textAlign: "center",
    padding: "6px 8px",
    borderRadius: 8,
    border:
      "1px solid #303030",
    background: "#0b0b0b",
    color: "#aaa",
    textDecoration: "none",
    fontSize: 9,
    fontWeight: 900,
  },

  positionButtonActive: {
    minWidth: 40,
    textAlign: "center",
    padding: "6px 8px",
    borderRadius: 8,
    border:
      "1px solid #ff5a00",
    background:
      "rgba(255,90,0,0.16)",
    color: "#fff",
    textDecoration: "none",
    fontSize: 9,
    fontWeight: 950,
  },

  clearRow: {
    marginTop: 8,
  },

  clearLink: {
    color: "#ff7a32",
    fontSize: 10,
    fontWeight: 850,
    textDecoration: "none",
  },

  spacer: {
    height: 12,
  },

  tableHeader: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent:
      "space-between",
    gap: 10,
    padding:
      "12px 12px 9px",
    borderBottom:
      "1px solid #242424",
  },

  resultCount: {
    color: "#8f8f8f",
    fontSize: 10,
    fontWeight: 800,
  },

  emptyState: {
    padding:
      "32px 16px",
    textAlign: "center",
    color: "#888",
    fontSize: 12,
  },

  /*
   * Only presentation change from the approved compact version:
   * horizontal scrolling is restored for the full stat table.
   */
  tableWrap: {
    width: "100%",
    maxWidth: "100%",
    overflowX: "auto",
    overflowY: "hidden",
    WebkitOverflowScrolling:
      "touch",
    scrollbarGutter:
      "stable",
    paddingBottom: 8,
  },

  table: {
    width: "100%",
    minWidth: 1320,
    borderCollapse:
      "collapse",
    tableLayout: "auto",
  },

  tableRow: {
    borderBottom:
      "1px solid #202020",
  },

  rankHead: {
    width: 28,
    padding: "7px 2px",
    color: "#777",
    fontSize: 7,
    textAlign: "center",
    whiteSpace: "nowrap",
  },

  leftHead: {
    width: "11%",
    maxWidth: 145,
    padding: "7px 4px",
    color: "#888",
    fontSize: 7,
    textAlign: "left",
    letterSpacing:
      "0.04em",
    textTransform:
      "uppercase",
    whiteSpace: "nowrap",
  },

  centerHead: {
    padding: "7px 2px",
    color: "#888",
    fontSize: 7,
    textAlign: "center",
    letterSpacing:
      "0.02em",
    textTransform:
      "uppercase",
    whiteSpace: "nowrap",
  },

  ownerHead: {
    width: "7%",
    maxWidth: 95,
    padding: "7px 3px",
    color: "#888",
    fontSize: 7,
    textAlign: "left",
    letterSpacing:
      "0.02em",
    textTransform:
      "uppercase",
    whiteSpace: "nowrap",
  },

  numberHead: {
    padding: "7px 2px",
    color: "#888",
    fontSize: 7,
    textAlign: "right",
    whiteSpace: "nowrap",
  },

  sortLink: {
    color: "#888",
    textDecoration: "none",
    fontWeight: 900,
  },

  sortLinkActive: {
    color: "#ff6a1a",
    textDecoration: "none",
    fontWeight: 950,
  },

  rankCell: {
    width: 28,
    padding: "8px 2px",
    textAlign: "center",
    color: "#6f6f6f",
    fontSize: 8,
    fontWeight: 900,
  },

  playerCell: {
    width: "11%",
    maxWidth: 145,
    padding: "8px 4px",
  },

  playerLink: {
    display: "block",
    color: "#fff",
    fontWeight: 900,
    fontSize: 9,
    lineHeight: 1.15,
    textDecoration: "none",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow:
      "ellipsis",
  },

  playerMeta: {
    marginTop: 2,
    color: "#6f6f6f",
    fontSize: 7,
    lineHeight: 1.1,
    whiteSpace: "nowrap",
  },

  injuryText: {
    color: "#ff9b65",
    fontSize: 7,
    fontWeight: 900,
  },

  centerCell: {
    padding: "8px 2px",
    textAlign: "center",
    color: "#aaa",
    fontSize: 8,
    fontWeight: 800,
    whiteSpace: "nowrap",
  },

  positionCell: {
    padding: "8px 2px",
    textAlign: "center",
    color: "#ff7b34",
    fontSize: 8,
    fontWeight: 950,
    whiteSpace: "nowrap",
  },

  ownerCell: {
    width: "7%",
    maxWidth: 95,
    padding: "8px 3px",
    color: "#aaa",
    fontSize: 7,
    fontWeight: 800,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow:
      "ellipsis",
  },

  freeAgent: {
    display: "inline-block",
    border:
      "1px solid rgba(255,90,0,0.5)",
    borderRadius: 999,
    padding: "2px 4px",
    color: "#ff7a32",
    background:
      "rgba(255,90,0,0.08)",
    fontSize: 7,
    fontWeight: 950,
  },

  numberCell: {
    padding: "8px 2px",
    textAlign: "right",
    color: "#bbb",
    fontSize: 8,
    whiteSpace: "nowrap",
    fontVariantNumeric:
      "tabular-nums",
  },

  fantasyCell: {
    padding: "8px 2px",
    textAlign: "right",
    color: "#fff",
    fontSize: 9,
    fontWeight: 950,
    whiteSpace: "nowrap",
    fontVariantNumeric:
      "tabular-nums",
  },
};