"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

type Props = {
  leagueId: string;
};

type Settings = {
  season: number;
  league_format: string | null;
  position_mode: string | null;
  competition_format: string | null;
  lineup_period: string | null;
  regular_season_weeks: number;
  playoff_weeks: number;
  playoff_team_count: number;
  scoring_system: string | null;
};

type FantasyTeam = {
  id: number;
  team_name: string;
  owner_id: string | null;
  is_cpu: boolean;
};

type Standing = {
  fantasy_team_id: number;
  wins: number;
  losses: number;
  ties: number;
  points_for: number;
  points_against: number;
  rank: number | null;
};

type Matchup = {
  id: number;
  league_id: string;
  season: number;
  week: number;
  home_fantasy_team_id: number;
  away_fantasy_team_id: number;
  home_score: number;
  away_score: number;
  status: string | null;
  winner_fantasy_team_id: number | null;
  is_tie: boolean;
};

type LineupRow = {
  fantasy_team_id: number;
  nhl_player_id: number;
  nhl_game_id: number | null;
  lineup_slot: string | null;
  slot_index: number | null;
  lineup_date: string | null;
  game_start_at: string | null;
};

type ProjectionRow = {
  nhl_player_id: number;
  projected_games_played: number;
  projected_goals: number;
  projected_assists: number;
  projected_points: number;
  projected_plus_minus: number;
  projected_penalty_minutes: number;
  projected_power_play_goals: number;
  projected_power_play_assists: number;
  projected_power_play_points: number;
  projected_short_handed_goals: number;
  projected_short_handed_assists: number;
  projected_short_handed_points: number;
  projected_game_winning_goals: number;
  projected_shots_on_goal: number;
  projected_hits: number;
  projected_blocked_shots: number;
  projected_goalie_starts: number;
  projected_goalie_wins: number;
  projected_goalie_losses: number;
  projected_goalie_ot_losses: number;
  projected_saves: number;
  projected_shots_against: number;
  projected_goals_against: number;
  projected_shutouts: number;
  projected_save_percentage: number;
  projected_goals_against_average: number;
  projected_goalie_minutes_seconds: number;
};

type CategoryRule = {
  stat_key: string;
  enabled: boolean;
  direction: string | null;
};

type DraftRanking = {
  nhl_player_id: number;
  projected_fantasy_points: number;
};

type CategoryDefinition = {
  label: string;
  projectionField?: keyof ProjectionRow;
  ratio?: "save_percentage" | "gaa";
};

type CategoryResult = {
  key: string;
  label: string;
  home: number;
  away: number;
  direction: "higher" | "lower";
  winner: "home" | "away" | "tie";
};

type TeamProjection = {
  fantasyPoints: number;
  categories: Record<string, number>;
};

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const CATEGORY_DEFINITIONS: Record<string, CategoryDefinition> = {
  goals: { label: "G", projectionField: "projected_goals" },
  goal: { label: "G", projectionField: "projected_goals" },

  assists: { label: "A", projectionField: "projected_assists" },
  assist: { label: "A", projectionField: "projected_assists" },

  points: { label: "PTS", projectionField: "projected_points" },

  plus_minus: {
    label: "+/-",
    projectionField: "projected_plus_minus",
  },

  penalty_minutes: {
    label: "PIM",
    projectionField: "projected_penalty_minutes",
  },

  power_play_goals: {
    label: "PPG",
    projectionField: "projected_power_play_goals",
  },

  power_play_assists: {
    label: "PPA",
    projectionField: "projected_power_play_assists",
  },

  power_play_points: {
    label: "PPP",
    projectionField: "projected_power_play_points",
  },

  short_handed_goals: {
    label: "SHG",
    projectionField: "projected_short_handed_goals",
  },

  short_handed_assists: {
    label: "SHA",
    projectionField: "projected_short_handed_assists",
  },

  short_handed_points: {
    label: "SHP",
    projectionField: "projected_short_handed_points",
  },

  game_winning_goals: {
    label: "GWG",
    projectionField: "projected_game_winning_goals",
  },

  shots_on_goal: {
    label: "SOG",
    projectionField: "projected_shots_on_goal",
  },

  hits: {
    label: "HIT",
    projectionField: "projected_hits",
  },

  blocked_shots: {
    label: "BLK",
    projectionField: "projected_blocked_shots",
  },

  goalie_starts: {
    label: "GS",
    projectionField: "projected_goalie_starts",
  },

  goalie_wins: {
    label: "W",
    projectionField: "projected_goalie_wins",
  },

  wins: {
    label: "W",
    projectionField: "projected_goalie_wins",
  },

  goalie_losses: {
    label: "L",
    projectionField: "projected_goalie_losses",
  },

  goalie_ot_losses: {
    label: "OTL",
    projectionField: "projected_goalie_ot_losses",
  },

  saves: {
    label: "SV",
    projectionField: "projected_saves",
  },

  shots_against: {
    label: "SA",
    projectionField: "projected_shots_against",
  },

  goals_against: {
    label: "GA",
    projectionField: "projected_goals_against",
  },

  shutouts: {
    label: "SO",
    projectionField: "projected_shutouts",
  },

  save_percentage: {
    label: "SV%",
    ratio: "save_percentage",
  },

  goalie_save_percentage: {
    label: "SV%",
    ratio: "save_percentage",
  },

  goals_against_average: {
    label: "GAA",
    ratio: "gaa",
  },

  goalie_goals_against_average: {
    label: "GAA",
    ratio: "gaa",
  },
};

function n(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim()
    ? value.trim()
    : fallback;
}

function normalize(value: unknown): string {
  return text(value)
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function titleCase(value: string | null | undefined): string {
  const normalized = normalize(value);

  if (!normalized) return "—";

  if (normalized === "head_to_head") return "HEAD-TO-HEAD";
  if (normalized === "h2h") return "HEAD-TO-HEAD";
  if (normalized === "redraft") return "REDRAFT";
  if (normalized === "dynasty") return "DYNASTY";
  if (normalized === "categories") return "CATEGORIES";
  if (normalized === "points") return "POINTS";

  return normalized.replace(/_/g, " ").toUpperCase();
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (error && typeof error === "object") {
    const row = error as Record<string, unknown>;

    const parts = [
      row.message,
      row.details,
      row.hint,
      row.code ? `Code: ${row.code}` : "",
    ]
      .filter((value) => typeof value === "string" && value)
      .map(String);

    if (parts.length) return parts.join(" • ");
  }

  return fallback;
}

function formatScore(value: number): string {
  return n(value).toFixed(1);
}

function formatRecord(standing?: Standing): string {
  if (!standing) return "0-0-0";

  return `${standing.wins}-${standing.losses}-${standing.ties}`;
}

function isFinal(status: string | null): boolean {
  const value = normalize(status);

  return (
    value === "final" ||
    value === "complete" ||
    value === "completed"
  );
}

function isLive(status: string | null): boolean {
  const value = normalize(status);

  return (
    value === "live" ||
    value === "active" ||
    value === "in_progress"
  );
}

function statusLabel(status: string | null): string {
  if (isFinal(status)) return "FINAL";
  if (isLive(status)) return "LIVE";

  const value = normalize(status);

  if (value === "cancelled" || value === "canceled") {
    return "CANCELLED";
  }

  return value ? value.replace(/_/g, " ").toUpperCase() : "UPCOMING";
}

function directionForRule(rule: CategoryRule): "higher" | "lower" {
  const value = normalize(rule.direction);

  if (
    value.includes("low") ||
    value === "asc" ||
    value === "ascending"
  ) {
    return "lower";
  }

  return "higher";
}

function formatCategory(key: string, value: number): string {
  if (
    key === "save_percentage" ||
    key === "goalie_save_percentage"
  ) {
    return value > 0 ? value.toFixed(3).replace(/^0/, "") : ".000";
  }

  if (
    key === "goals_against_average" ||
    key === "goalie_goals_against_average"
  ) {
    return value.toFixed(2);
  }

  if (Math.abs(value) >= 100) {
    return value.toFixed(0);
  }

  return value.toFixed(1);
}

function projectionPercent(home: number, away: number) {
  const safeHome = Math.max(0, home);
  const safeAway = Math.max(0, away);
  const total = safeHome + safeAway;

  if (total <= 0) {
    return {
      home: 50,
      away: 50,
    };
  }

  const homePct = (safeHome / total) * 100;

  return {
    home: homePct,
    away: 100 - homePct,
  };
}

export default function NhlTraditionalMatchups({
  leagueId,
}: Props) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [teams, setTeams] = useState<FantasyTeam[]>([]);
  const [standings, setStandings] = useState<Standing[]>([]);
  const [matchups, setMatchups] = useState<Matchup[]>([]);
  const [lineups, setLineups] = useState<LineupRow[]>([]);
  const [projections, setProjections] = useState<ProjectionRow[]>([]);
  const [categoryRules, setCategoryRules] = useState<CategoryRule[]>([]);
  const [draftRankings, setDraftRankings] = useState<DraftRanking[]>([]);

  const [selectedWeek, setSelectedWeek] = useState(1);
  const [loading, setLoading] = useState(true);
  const [weekLoading, setWeekLoading] = useState(false);
  const [error, setError] = useState("");

  const season = settings?.season ?? 0;

  const isCategories = useMemo(() => {
    const value = normalize(settings?.scoring_system);

    return value.includes("categor");
  }, [settings?.scoring_system]);

  const regularSeasonWeeks = Math.max(
    1,
    settings?.regular_season_weeks ?? 1
  );

  const playoffWeeks = Math.max(
    0,
    settings?.playoff_weeks ?? 0
  );

  const totalWeeks = Math.max(
    1,
    regularSeasonWeeks + playoffWeeks
  );


  const teamById = useMemo(
    () => new Map(teams.map((team) => [team.id, team])),
    [teams]
  );

  const standingByTeam = useMemo(
    () =>
      new Map(
        standings.map((standing) => [
          standing.fantasy_team_id,
          standing,
        ])
      ),
    [standings]
  );

  const projectionByPlayer = useMemo(
    () =>
      new Map(
        projections.map((projection) => [
          projection.nhl_player_id,
          projection,
        ])
      ),
    [projections]
  );

  const fantasyProjectionByPlayer = useMemo(
    () =>
      new Map(
        draftRankings.map((projection) => [
          projection.nhl_player_id,
          projection.projected_fantasy_points,
        ])
      ),
    [draftRankings]
  );

  const enabledCategories = useMemo(
    () => categoryRules.filter((rule) => rule.enabled),
    [categoryRules]
  );

  const loadBase = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const {
        data: settingsData,
        error: settingsError,
      } = await supabase
        .from("nhl_traditional_settings")
        .select(
          "season,league_format,position_mode,competition_format,lineup_period,regular_season_weeks,playoff_weeks,playoff_team_count,scoring_system"
        )
        .eq("league_id", leagueId)
        .single();

      if (settingsError) throw settingsError;

      const loadedSettings: Settings = {
        season: n(settingsData.season),
        league_format: text(settingsData.league_format) || null,
        position_mode: text(settingsData.position_mode) || null,
        competition_format:
          text(settingsData.competition_format) || null,
        lineup_period: text(settingsData.lineup_period) || null,
        regular_season_weeks: n(
          settingsData.regular_season_weeks
        ),
        playoff_weeks: n(settingsData.playoff_weeks),
        playoff_team_count: n(settingsData.playoff_team_count),
        scoring_system: text(settingsData.scoring_system) || null,
      };

      setSettings(loadedSettings);

      const [
        teamResult,
        standingResult,
        matchupWeekResult,
        categoryResult,
      ] = await Promise.all([
        supabase
          .from("fantasy_teams")
          .select("id,team_name,owner_id,is_cpu")
          .eq("league_id", leagueId)
          .eq("active", true)
          .order("id"),

        supabase
          .from("nhl_traditional_standings")
          .select(
            "fantasy_team_id,wins,losses,ties,points_for,points_against,rank"
          )
          .eq("league_id", leagueId)
          .eq("season", loadedSettings.season),

        supabase
          .from("nhl_traditional_matchups")
          .select("week,status")
          .eq("league_id", leagueId)
          .eq("season", loadedSettings.season)
          .order("week"),

        supabase
          .from("nhl_traditional_category_rules")
          .select("stat_key,enabled,direction")
          .eq("league_id", leagueId)
          .eq("enabled", true),
      ]);

      if (teamResult.error) throw teamResult.error;
      if (standingResult.error) throw standingResult.error;
      if (matchupWeekResult.error) throw matchupWeekResult.error;
      if (categoryResult.error) throw categoryResult.error;

      const loadedTeams: FantasyTeam[] = (teamResult.data ?? []).map(
        (row) => ({
          id: n(row.id),
          team_name: text(row.team_name, `Team ${row.id}`),
          owner_id: text(row.owner_id) || null,
          is_cpu: Boolean(row.is_cpu),
        })
      );

      setTeams(loadedTeams);

      setStandings(
        (standingResult.data ?? []).map((row) => ({
          fantasy_team_id: n(row.fantasy_team_id),
          wins: n(row.wins),
          losses: n(row.losses),
          ties: n(row.ties),
          points_for: n(row.points_for),
          points_against: n(row.points_against),
          rank: row.rank == null ? null : n(row.rank),
        }))
      );

      setCategoryRules(
        (categoryResult.data ?? []).map((row) => ({
          stat_key: text(row.stat_key),
          enabled: Boolean(row.enabled),
          direction: text(row.direction) || null,
        }))
      );

      const matchupWeekRows = (matchupWeekResult.data ?? []).map(
        (row) => ({
          week: n(row.week),
          status: text(row.status) || null,
        })
      );

      const statusesByWeek = new Map<number, Array<string | null>>();

      matchupWeekRows.forEach((row) => {
        const statuses = statusesByWeek.get(row.week) ?? [];
        statuses.push(row.status);
        statusesByWeek.set(row.week, statuses);
      });

      const scheduledWeeks = [...statusesByWeek.keys()].sort(
        (a, b) => a - b
      );

      const liveWeek = scheduledWeeks.find((week) =>
        (statusesByWeek.get(week) ?? []).some((status) =>
          isLive(status)
        )
      );

      // A week is complete only when every saved matchup for that
      // week is final. The member page therefore advances to the
      // first scheduled week that is not completely final.
      const currentWeek = scheduledWeeks.find((week) => {
        const statuses = statusesByWeek.get(week) ?? [];
        return statuses.length > 0 && !statuses.every(isFinal);
      });

      const lastCompletedWeek = [...scheduledWeeks]
        .reverse()
        .find((week) => {
          const statuses = statusesByWeek.get(week) ?? [];
          return statuses.length > 0 && statuses.every(isFinal);
        });

      setSelectedWeek(
        liveWeek ??
          currentWeek ??
          lastCompletedWeek ??
          scheduledWeeks[0] ??
          1
      );
    } catch (caught) {
      console.error("Unable to load NHL Matchups:", caught);

      setError(
        errorMessage(caught, "Unable to load NHL Matchups.")
      );
    } finally {
      setLoading(false);
    }
  }, [leagueId]);

  const loadWeek = useCallback(
    async (week: number) => {
      if (!season) return;

      setWeekLoading(true);
      setError("");

      try {
        const [
          matchupResult,
          lineupResult,
          projectionResult,
        ] = await Promise.all([
          supabase
            .from("nhl_traditional_matchups")
            .select(
              "id,league_id,season,week,home_fantasy_team_id,away_fantasy_team_id,home_score,away_score,status,winner_fantasy_team_id,is_tie"
            )
            .eq("league_id", leagueId)
            .eq("season", season)
            .eq("week", week)
            .order("id"),

          supabase
            .from("nhl_traditional_weekly_lineups")
            .select(
              "fantasy_team_id,nhl_player_id,nhl_game_id,lineup_slot,slot_index,lineup_date,game_start_at"
            )
            .eq("league_id", leagueId)
            .eq("season", season)
            .eq("week", week),

          supabase
            .from("nhl_player_projections")
            .select(
              "nhl_player_id,projected_games_played,projected_goals,projected_assists,projected_points,projected_plus_minus,projected_penalty_minutes,projected_power_play_goals,projected_power_play_assists,projected_power_play_points,projected_short_handed_goals,projected_short_handed_assists,projected_short_handed_points,projected_game_winning_goals,projected_shots_on_goal,projected_hits,projected_blocked_shots,projected_goalie_starts,projected_goalie_wins,projected_goalie_losses,projected_goalie_ot_losses,projected_saves,projected_shots_against,projected_goals_against,projected_shutouts,projected_save_percentage,projected_goals_against_average,projected_goalie_minutes_seconds"
            )
            .eq("season", season),
        ]);

        if (matchupResult.error) throw matchupResult.error;
        if (lineupResult.error) throw lineupResult.error;
        if (projectionResult.error) throw projectionResult.error;

        setMatchups(
          ((matchupResult.data ?? []) as unknown as Matchup[]).map(
            (row) => ({
              ...row,
              id: n(row.id),
              season: n(row.season),
              week: n(row.week),
              home_fantasy_team_id: n(row.home_fantasy_team_id),
              away_fantasy_team_id: n(row.away_fantasy_team_id),
              home_score: n(row.home_score),
              away_score: n(row.away_score),
              winner_fantasy_team_id:
                row.winner_fantasy_team_id == null
                  ? null
                  : n(row.winner_fantasy_team_id),
              is_tie: Boolean(row.is_tie),
            })
          )
        );

        setLineups(
          ((lineupResult.data ?? []) as unknown as LineupRow[]).map(
            (row) => ({
              ...row,
              fantasy_team_id: n(row.fantasy_team_id),
              nhl_player_id: n(row.nhl_player_id),
              nhl_game_id:
                row.nhl_game_id == null ? null : n(row.nhl_game_id),
              slot_index:
                row.slot_index == null ? null : n(row.slot_index),
            })
          )
        );

        setProjections(
          ((projectionResult.data ?? []) as unknown as ProjectionRow[]).map(
            (row) => {
              const normalized = { ...row };

              for (const key of Object.keys(normalized) as Array<
                keyof ProjectionRow
              >) {
                normalized[key] = n(normalized[key]) as never;
              }

              return normalized;
            }
          )
        );

        const rankingResult = await supabase.rpc(
          "get_nhl_traditional_draft_rankings",
          {
            p_league_id: leagueId,
            p_season: season,
          }
        );

        if (rankingResult.error) {
          console.warn(
            "Unable to load G365 NHL projections:",
            rankingResult.error
          );

          setDraftRankings([]);
        } else {
          const rows = Array.isArray(rankingResult.data)
            ? rankingResult.data
            : [];

          setDraftRankings(
            rows.map((raw) => {
              const row = raw as Record<string, unknown>;

              return {
                nhl_player_id: n(
                  row.nhl_player_id ?? row.player_id
                ),
                projected_fantasy_points: n(
                  row.projected_fantasy_points ??
                    row.fantasy_points ??
                    row.projected_points
                ),
              };
            })
          );
        }
      } catch (caught) {
        console.error(
          `Unable to load NHL Matchups Week ${week}:`,
          caught
        );

        setError(
          errorMessage(
            caught,
            `Unable to load Week ${week} matchups.`
          )
        );
      } finally {
        setWeekLoading(false);
      }
    },
    [leagueId, season]
  );

  useEffect(() => {
    void loadBase();
  }, [loadBase]);

  useEffect(() => {
    if (!loading && season) {
      void loadWeek(selectedWeek);
    }
  }, [loading, season, selectedWeek, loadWeek]);

  function activeLineupRows(teamId: number): LineupRow[] {
    return lineups.filter((row) => {
      if (row.fantasy_team_id !== teamId) return false;

      const slot = normalize(row.lineup_slot);

      return ![
        "bench",
        "bn",
        "ir",
        "injured_reserve",
      ].includes(slot);
    });
  }

  function uniquePlayers(teamId: number): number[] {
    return [
      ...new Set(
        activeLineupRows(teamId).map(
          (row) => row.nhl_player_id
        )
      ),
    ];
  }

  function scheduledGames(
    teamId: number,
    playerId: number
  ): number {
    const rows = activeLineupRows(teamId).filter(
      (row) => row.nhl_player_id === playerId
    );

    const gameIds = new Set<number>();

    rows.forEach((row) => {
      if (row.nhl_game_id) {
        gameIds.add(row.nhl_game_id);
      }
    });

    if (gameIds.size) return gameIds.size;

    const dates = new Set(
      rows
        .map((row) => row.lineup_date)
        .filter((value): value is string => Boolean(value))
    );

    return dates.size;
  }

  function teamProjection(teamId: number): TeamProjection {
    const categoryTotals: Record<string, number> = {};

    let fantasyPoints = 0;

    let projectedSaves = 0;
    let projectedShotsAgainst = 0;
    let projectedGoalsAgainst = 0;
    let projectedGoalieMinutes = 0;

    uniquePlayers(teamId).forEach((playerId) => {
      const projection = projectionByPlayer.get(playerId);

      if (!projection) return;

      const seasonGames = Math.max(
        projection.projected_games_played,
        1
      );

      const games = scheduledGames(teamId, playerId);

      const multiplier =
        games > 0 ? games / seasonGames : 0;

      fantasyPoints +=
        (fantasyProjectionByPlayer.get(playerId) ?? 0) *
        multiplier;

      enabledCategories.forEach((rule) => {
        const key = normalize(rule.stat_key);
        const definition = CATEGORY_DEFINITIONS[key];

        if (!definition?.projectionField) return;

        categoryTotals[key] =
          (categoryTotals[key] ?? 0) +
          n(projection[definition.projectionField]) *
            multiplier;
      });

      projectedSaves +=
        projection.projected_saves * multiplier;

      projectedShotsAgainst +=
        projection.projected_shots_against * multiplier;

      projectedGoalsAgainst +=
        projection.projected_goals_against * multiplier;

      projectedGoalieMinutes +=
        projection.projected_goalie_minutes_seconds *
        multiplier;
    });

    const savePercentage =
      projectedShotsAgainst > 0
        ? projectedSaves / projectedShotsAgainst
        : 0;

    const goalieMinutes = projectedGoalieMinutes / 60;

    const gaa =
      goalieMinutes > 0
        ? (projectedGoalsAgainst * 60) / goalieMinutes
        : 0;

    enabledCategories.forEach((rule) => {
      const key = normalize(rule.stat_key);
      const definition = CATEGORY_DEFINITIONS[key];

      if (definition?.ratio === "save_percentage") {
        categoryTotals[key] = savePercentage;
      }

      if (definition?.ratio === "gaa") {
        categoryTotals[key] = gaa;
      }
    });

    return {
      fantasyPoints,
      categories: categoryTotals,
    };
  }

  function projectedCategories(
    matchup: Matchup
  ): CategoryResult[] {
    const home = teamProjection(
      matchup.home_fantasy_team_id
    );

    const away = teamProjection(
      matchup.away_fantasy_team_id
    );

    return enabledCategories
      .map((rule): CategoryResult | null => {
        const key = normalize(rule.stat_key);
        const definition = CATEGORY_DEFINITIONS[key];

        if (!definition) return null;

        const homeValue = home.categories[key] ?? 0;
        const awayValue = away.categories[key] ?? 0;

        const direction = directionForRule(rule);

        const tolerance =
          definition.ratio === "save_percentage"
            ? 0.0005
            : definition.ratio === "gaa"
              ? 0.005
              : 0.0001;

        let winner: "home" | "away" | "tie" = "tie";

        if (Math.abs(homeValue - awayValue) > tolerance) {
          if (direction === "lower") {
            winner =
              homeValue < awayValue ? "home" : "away";
          } else {
            winner =
              homeValue > awayValue ? "home" : "away";
          }
        }

        return {
          key,
          label: definition.label,
          home: homeValue,
          away: awayValue,
          direction,
          winner,
        };
      })
      .filter(
        (result): result is CategoryResult =>
          result !== null
      );
  }

  if (loading) {
    return (
      <main style={styles.page}>
        <div style={styles.loading}>
          Loading NHL matchups…
        </div>
      </main>
    );
  }

  return (
    <main className="g365-nhl-matchups" style={styles.page}>
      <style>{`
        .g365-nhl-matchups, .g365-nhl-matchups * { box-sizing: border-box; }
        .g365-nhl-matchups { width: 100%; max-width: 100vw; overflow-x: hidden; }
        .g365-matchups-shell { width: 100%; min-width: 0; }
        .g365-matchups-hero { min-width: 0; }
        .g365-matchups-badges { min-width: 0; }
        .g365-matchups-week-scroller { width: 100%; max-width: 100%; overflow-x: auto; overflow-y: hidden; -webkit-overflow-scrolling: touch; scrollbar-width: thin; }
        .g365-matchups-week-scroller::-webkit-scrollbar { height: 8px; }
        .g365-matchups-week-scroller::-webkit-scrollbar-thumb { background: #3b3b40; border-radius: 999px; }
        .g365-matchups-week-scroller::-webkit-scrollbar-track { background: #111113; }
        .g365-matchups-grid { width: 100%; min-width: 0; }
        .g365-matchup-card { min-width: 0; max-width: 100%; }
        .g365-category-scroll { width: 100%; max-width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch; }
        .g365-matchup-card > div[style*="overflow"] { scrollbar-width: thin; }
        .g365-matchup-card > div[style*="overflow"]::-webkit-scrollbar { height: 7px; }
        .g365-matchup-card > div[style*="overflow"]::-webkit-scrollbar-thumb { background: #3b3b40; border-radius: 999px; }
        @media (max-width: 900px) {
          .g365-matchups-hero { flex-direction: column !important; align-items: stretch !important; }
          .g365-matchups-badges { justify-content: flex-start !important; }
          .g365-matchups-grid { grid-template-columns: minmax(0,1fr) !important; }
        }
        @media (max-width: 640px) {
          .g365-nhl-matchups { padding: 10px 8px 40px !important; }
          .g365-matchups-hero { padding: 16px 14px !important; border-radius: 13px !important; }
          .g365-matchups-title { font-size: 34px !important; line-height: .98 !important; }
          .g365-matchups-week-panel { padding: 12px 10px !important; }
          .g365-matchups-week-header { grid-template-columns: minmax(0,1fr) minmax(90px,auto) minmax(0,1fr) !important; gap: 6px !important; }
          .g365-matchups-week-nav { min-width: 0 !important; padding: 9px 7px !important; font-size: 9px !important; }
          .g365-matchups-week-title { font-size: 21px !important; }
          .g365-matchups-week-button { min-width: 44px !important; min-height: 42px !important; padding: 5px 6px !important; }
          .g365-matchup-teams { grid-template-columns: minmax(0,1fr) 28px minmax(0,1fr) !important; padding-left: 10px !important; padding-right: 10px !important; }
          .g365-matchup-team-name { font-size: 16px !important; white-space: normal !important; overflow-wrap: anywhere !important; }
          .g365-matchup-card { border-radius: 13px !important; }
        }
      `}</style>
      <div className="g365-matchups-shell" style={styles.shell}>
        <section className="g365-matchups-hero" style={styles.hero}>
          <div>
            <div style={styles.eyebrow}>
              GRIDIRON365 • NHL TRADITIONAL
            </div>

            <h1 className="g365-matchups-title" style={styles.title}>Matchups</h1>

            <p style={styles.sub}>
              Weekly head-to-head matchups, G365 projections and
              category comparisons.
            </p>
          </div>

          <div className="g365-matchups-badges" style={styles.badges}>
            <span style={styles.badge}>
              {titleCase(settings?.league_format)}
            </span>

            <span style={styles.badge}>
              {titleCase(settings?.scoring_system)}
            </span>

            <span style={styles.badge}>
              {titleCase(settings?.competition_format)}
            </span>

            <span style={styles.badge}>
              {season || "—"}
            </span>
          </div>
        </section>

        {error ? (
          <div style={styles.error}>
            <strong>Matchups could not load.</strong>
            <div>{error}</div>

            <button
              type="button"
              style={styles.retry}
              onClick={() => void loadWeek(selectedWeek)}
            >
              Try Again
            </button>
          </div>
        ) : null}

        <section
          className="g365-matchups-week-panel"
          style={styles.weekPanel}
        >
          <div
            className="g365-matchups-week-header"
            style={styles.weekHeader}
          >
            <button
              type="button"
              className="g365-matchups-week-nav"
              style={{
                ...styles.weekNavButton,
                ...(selectedWeek <= 1
                  ? styles.disabledButton
                  : {}),
              }}
              disabled={selectedWeek <= 1}
              onClick={() =>
                setSelectedWeek((current) =>
                  Math.max(1, current - 1)
                )
              }
              aria-label={`Go to Week ${Math.max(
                1,
                selectedWeek - 1
              )}`}
            >
              <span style={styles.navArrow}>‹</span>
              <span style={styles.navText}>
                {selectedWeek > 1
                  ? `WEEK ${selectedWeek - 1}`
                  : "PREVIOUS"}
              </span>
            </button>

            <div style={styles.weekTitleWrap}>
              <div style={styles.eyebrow}>
                {selectedWeek > regularSeasonWeeks
                  ? "NHL PLAYOFFS"
                  : "REGULAR SEASON"}
              </div>

              <div
                className="g365-matchups-week-title"
                style={styles.weekTitle}
              >
                Week {selectedWeek}
              </div>

              <div style={styles.weekSub}>
                {selectedWeek > regularSeasonWeeks
                  ? `Playoff Week ${
                      selectedWeek - regularSeasonWeeks
                    } of ${playoffWeeks}`
                  : `Week ${selectedWeek} of ${regularSeasonWeeks}`}
              </div>
            </div>

            <button
              type="button"
              className="g365-matchups-week-nav"
              style={{
                ...styles.weekNavButton,
                ...(selectedWeek >= totalWeeks
                  ? styles.disabledButton
                  : {}),
              }}
              disabled={selectedWeek >= totalWeeks}
              onClick={() =>
                setSelectedWeek((current) =>
                  Math.min(totalWeeks, current + 1)
                )
              }
              aria-label={`Go to Week ${Math.min(
                totalWeeks,
                selectedWeek + 1
              )}`}
            >
              <span style={styles.navText}>
                {selectedWeek < totalWeeks
                  ? `WEEK ${selectedWeek + 1}`
                  : "NEXT"}
              </span>
              <span style={styles.navArrow}>›</span>
            </button>
          </div>

          <div style={styles.weekProgress}>
            <div style={styles.weekProgressTrack}>
              <div
                style={{
                  ...styles.weekProgressFill,
                  width: `${
                    totalWeeks > 1
                      ? ((selectedWeek - 1) /
                          (totalWeeks - 1)) *
                        100
                      : 100
                  }%`,
                }}
              />
            </div>

            <div style={styles.weekProgressLabels}>
              <span>W1</span>
              <span>
                {regularSeasonWeeks < totalWeeks
                  ? `REGULAR SEASON W${regularSeasonWeeks}`
                  : `W${totalWeeks}`}
              </span>
              {playoffWeeks > 0 ? (
                <span>PLAYOFFS W{totalWeeks}</span>
              ) : null}
            </div>
          </div>
        </section>

        {weekLoading ? (
          <div style={styles.loadingPanel}>
            Loading Week {selectedWeek} matchups…
          </div>
        ) : null}

        {!weekLoading && matchups.length === 0 ? (
          <section style={styles.emptyPanel}>
            <div style={styles.emptyIcon}>🏒</div>

            <div style={styles.emptyEyebrow}>
              WEEK {selectedWeek}
            </div>

            <h2 style={styles.emptyTitle}>
              Matchups Not Generated Yet
            </h2>

            <p style={styles.emptyText}>
              The Week {selectedWeek} NHL head-to-head schedule has
              not been generated for this league yet.
            </p>
          </section>
        ) : null}

        {!weekLoading && matchups.length > 0 ? (
          <section>
            <div style={styles.sectionHead}>
              <div>
                <div style={styles.eyebrow}>
                  WEEK {selectedWeek}
                </div>

                <h2 style={styles.sectionTitle}>
                  League Matchups
                </h2>
              </div>

              <div style={styles.matchupCount}>
                {matchups.length}{" "}
                {matchups.length === 1 ? "MATCHUP" : "MATCHUPS"}
              </div>
            </div>

            <div className="g365-matchups-grid" style={styles.matchupGrid}>
              {matchups.map((matchup) => {
                const homeTeam = teamById.get(
                  matchup.home_fantasy_team_id
                );

                const awayTeam = teamById.get(
                  matchup.away_fantasy_team_id
                );

                const homeStanding = standingByTeam.get(
                  matchup.home_fantasy_team_id
                );

                const awayStanding = standingByTeam.get(
                  matchup.away_fantasy_team_id
                );

                const homeName =
                  homeTeam?.team_name ?? "Home Team";

                const awayName =
                  awayTeam?.team_name ?? "Away Team";

                const homeProjection = teamProjection(
                  matchup.home_fantasy_team_id
                );

                const awayProjection = teamProjection(
                  matchup.away_fantasy_team_id
                );

                const categoryResults = isCategories
                  ? projectedCategories(matchup)
                  : [];

                const projectedHomeCategoryWins =
                  categoryResults.filter(
                    (result) => result.winner === "home"
                  ).length;

                const projectedAwayCategoryWins =
                  categoryResults.filter(
                    (result) => result.winner === "away"
                  ).length;

                const projectedCategoryTies =
                  categoryResults.filter(
                    (result) => result.winner === "tie"
                  ).length;

                const categoryProjection = projectionPercent(
                  projectedHomeCategoryWins,
                  projectedAwayCategoryWins
                );

                const pointProjection = projectionPercent(
                  homeProjection.fantasyPoints,
                  awayProjection.fantasyPoints
                );

                const barProjection = isCategories
                  ? categoryProjection
                  : pointProjection;

                const final = isFinal(matchup.status);
                const live = isLive(matchup.status);

                return (
                  <article
                    key={matchup.id}
                    style={styles.matchupCard}
                  >
                    <div style={styles.matchupHeader}>
                      <div>
                        <div style={styles.matchupWeek}>
                          WEEK {matchup.week}
                        </div>

                        <div style={styles.matchupType}>
                          HEAD-TO-HEAD
                        </div>
                      </div>

                      <span
                        style={{
                          ...styles.statusBadge,
                          ...(live ? styles.liveBadge : {}),
                          ...(final ? styles.finalBadge : {}),
                        }}
                      >
                        {statusLabel(matchup.status)}
                      </span>
                    </div>

                    <div className="g365-matchup-teams" style={styles.teamsRow}>
                      <TeamBlock
                        teamName={homeName}
                        standing={homeStanding}
                        align="left"
                      />

                      <div style={styles.versus}>VS</div>

                      <TeamBlock
                        teamName={awayName}
                        standing={awayStanding}
                        align="right"
                      />
                    </div>

                    {(live || final) && !isCategories ? (
                      <div style={styles.liveScoreArea}>
                        <div style={styles.scoreLabel}>
                          {final ? "FINAL SCORE" : "LIVE SCORE"}
                        </div>

                        <div style={styles.actualScore}>
                          <strong>
                            {formatScore(matchup.home_score)}
                          </strong>

                          <span>—</span>

                          <strong>
                            {formatScore(matchup.away_score)}
                          </strong>
                        </div>
                      </div>
                    ) : null}

                    {isCategories && categoryResults.length > 0 ? (
                      <div style={styles.categoryPanel}>
                        <div className="g365-category-table" style={styles.categoryTableScroll}>
                          <div style={{...styles.categoryTableGrid,gridTemplateColumns:`150px repeat(${categoryResults.length}, minmax(66px, 1fr))`}}>
                            <div style={{...styles.categoryTableCell,...styles.categoryTeamHeader}}>TEAM</div>
                            {categoryResults.map((result) => <div key={`h-${result.key}`} style={{...styles.categoryTableCell,...styles.categoryStatHeader}}>{result.label}{result.direction==="lower"?<small>LOW</small>:null}</div>)}
                            <div style={{...styles.categoryTableCell,...styles.categoryTeamCell}}><strong>{homeName}</strong><small>{homeStanding?`${homeStanding.wins}-${homeStanding.losses}-${homeStanding.ties}`:"0-0-0"}</small></div>
                            {categoryResults.map((result) => <div key={`home-${result.key}`} style={{...styles.categoryTableCell,...styles.categoryStatCell,...(result.winner==="home"?styles.categoryWinnerCell:{})}}>{formatCategory(result.key,result.home)}</div>)}
                            <div style={{...styles.categoryTableCell,...styles.categoryTeamCell}}><strong>{awayName}</strong><small>{awayStanding?`${awayStanding.wins}-${awayStanding.losses}-${awayStanding.ties}`:"0-0-0"}</small></div>
                            {categoryResults.map((result) => <div key={`away-${result.key}`} style={{...styles.categoryTableCell,...styles.categoryStatCell,...(result.winner==="away"?styles.categoryWinnerCell:{})}}>{formatCategory(result.key,result.away)}</div>)}
                          </div>
                        </div>
                      </div>
                    ) : null}

                                        <div style={styles.projectionPanel}>
                      <div style={styles.projectionTitleRow}>
                        <div>
                          <div style={styles.eyebrow}>
                            G365 MATCHUP PROJECTION
                          </div>

                          <div style={styles.projectionTitle}>
                            {isCategories
                              ? "Matchup Probability"
                              : "Projected Fantasy Points"}
                          </div>
                        </div>

                        {isCategories ? (
                          <div style={styles.projectedCategoryScore}>
                            <strong>
                              {projectedHomeCategoryWins}
                            </strong>

                            <span>–</span>

                            <strong>
                              {projectedAwayCategoryWins}
                            </strong>
                          </div>
                        ) : null}
                      </div>

                      <div style={styles.projectionValues}>
                        <div>
                          <strong>
                            {isCategories
                              ? `${barProjection.home.toFixed(0)}%`
                              : formatScore(
                                  homeProjection.fantasyPoints
                                )}
                          </strong>

                          <span>{homeName}</span>
                        </div>

                        <div style={styles.projectionValuesRight}>
                          <strong>
                            {isCategories
                              ? `${barProjection.away.toFixed(0)}%`
                              : formatScore(
                                  awayProjection.fantasyPoints
                                )}
                          </strong>

                          <span>{awayName}</span>
                        </div>
                      </div>

                      <ProjectionBar
                        homePercent={barProjection.home}
                        awayPercent={barProjection.away}
                      />

                      <div style={styles.projectionFoot}>
                        {isCategories ? (
                          <>
                            Projected category score:{" "}
                            <strong>
                              {projectedHomeCategoryWins}–
                              {projectedAwayCategoryWins}
                            </strong>
                            {projectedCategoryTies > 0
                              ? ` • ${projectedCategoryTies} projected tie${
                                  projectedCategoryTies === 1
                                    ? ""
                                    : "s"
                                }`
                              : ""}
                            . G365 probability is derived from the projected category edge.
                          </>
                        ) : (
                          <>
                            The bar compares projected G365 fantasy
                            points. It is not a statistical win
                            probability.
                          </>
                        )}
                      </div>
                    </div>

                    {final ? (
                      <div style={styles.resultStrip}>
                        {matchup.is_tie ? (
                          <span>MATCHUP TIED</span>
                        ) : matchup.winner_fantasy_team_id ? (
                          <span style={styles.winnerText}>
                            {teamById.get(
                              matchup.winner_fantasy_team_id
                            )?.team_name ?? "Winner"}{" "}
                            WINS
                          </span>
                        ) : (
                          <span>FINAL</span>
                        )}
                      </div>
                    ) : null}

                    <div style={styles.cardFooter}>
                      <Link
                        href={`/league/${leagueId}/nhl/matchups/${matchup.id}`}
                        style={styles.detailButton}
                      >
                        VIEW DETAILED MATCHUP
                        <span>→</span>
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ) : null}
      </div>

      <style jsx global>{`
        @media (max-width: 680px) {
          .nhl-matchup-team-name {
            font-size: 17px !important;
          }

          .nhl-matchup-projection-label {
            display: none !important;
          }

          .g365-matchups-week-header {
            grid-template-columns: minmax(76px, 1fr) auto minmax(76px, 1fr) !important;
            gap: 7px !important;
          }

          .g365-matchups-week-nav {
            min-width: 0 !important;
            padding: 7px 8px !important;
          }

          .g365-matchups-week-title {
            font-size: 21px !important;
          }
        }
      `}</style>
    </main>
  );
}

function TeamBlock({
  teamName,
  standing,
  align,
}: {
  teamName: string;
  standing?: Standing;
  align: "left" | "right";
}) {
  return (
    <div
      style={{
        ...styles.teamBlock,
        textAlign: align,
        alignItems: align === "left" ? "flex-start" : "flex-end",
      }}
    >
      <div
        className="nhl-matchup-team-name g365-matchup-team-name"
        style={styles.teamName}
      >
        {teamName}
      </div>

      <div style={styles.teamRecord}>
        {formatRecord(standing)}
        {standing?.rank ? ` • #${standing.rank}` : ""}
      </div>

      <div style={styles.teamPf}>
        PF {formatScore(standing?.points_for ?? 0)}
      </div>
    </div>
  );
}

function ProjectionBar({
  homePercent,
  awayPercent,
}: {
  homePercent: number;
  awayPercent: number;
}) {
  return (
    <div style={styles.barOuter}>
      <div
        style={{
          ...styles.barHome,
          width: `${Math.max(
            0,
            Math.min(100, homePercent)
          )}%`,
        }}
      />

      <div
        style={{
          ...styles.barAway,
          width: `${Math.max(
            0,
            Math.min(100, awayPercent)
          )}%`,
        }}
      />

      <div style={styles.barCenter} />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    width: "100%",
    maxWidth: "100vw",
    minWidth: 0,
    overflowX: "hidden",
    boxSizing: "border-box",
    minHeight: "100vh",
    background: "#09090a",
    color: "#f7f7f8",
    padding: "18px 12px 60px",
  },

  shell: {
    width: "min(1180px, 100%)",
    margin: "0 auto",
    display: "grid",
    gap: 18,
  },

  loading: {
    padding: 40,
    textAlign: "center",
    color: "#aaa",
  },

  hero: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
    flexWrap: "wrap",
    textAlign: "center",
    padding: 20,
    border: "1px solid #29292d",
    borderRadius: 16,
    background:
      "linear-gradient(135deg,#171719,#0e0e10 62%,#251008)",
  },

  eyebrow: {
    color: "#ff6a00",
    fontSize: 11,
    fontWeight: 950,
    letterSpacing: 1.4,
  },

  title: {
    margin: "4px 0",
    fontSize: "clamp(28px,5vw,46px)",
    lineHeight: 0.95,
    fontWeight: 1000,
  },

  sub: {
    margin: "8px 0 0",
    color: "#aaa",
    fontSize: 14,
  },

  badges: {
    width: "100%",
    display: "flex",
    justifyContent: "center",
    gap: 7,
    flexWrap: "wrap",
  },

  badge: {
    padding: "7px 10px",
    border: "1px solid #4a2416",
    borderRadius: 999,
    background: "#1b100c",
    color: "#ff8a3d",
    fontSize: 11,
    fontWeight: 900,
  },

  error: {
    padding: 14,
    border: "1px solid #7d2d27",
    borderRadius: 12,
    background: "#2b1110",
    color: "#ffd1cc",
    display: "grid",
    gap: 6,
  },

  retry: {
    justifySelf: "start",
    border: 0,
    borderRadius: 8,
    padding: "8px 12px",
    background: "#ff4b20",
    color: "#fff",
    fontWeight: 900,
    cursor: "pointer",
  },

  weekPanel: {
    width: "100%",
    maxWidth: 900,
    margin: "0 auto",
    boxSizing: "border-box",
    padding: 16,
    border: "1px solid #29292d",
    borderRadius: 16,
    background:
      "linear-gradient(180deg,#141416,#0f0f11)",
  },

  weekHeader: {
    display: "grid",
    gridTemplateColumns: "minmax(90px,1fr) auto minmax(90px,1fr)",
    gap: 10,
    alignItems: "center",
  },

  weekTitleWrap: {
    textAlign: "center",
  },

  weekTitle: {
    marginTop: 3,
    fontSize: 24,
    fontWeight: 1000,
  },

  weekNavButton: {
    minHeight: 52,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    border: "1px solid #38383c",
    borderRadius: 10,
    background: "#19191c",
    color: "#fff",
    padding: "8px 12px",
    fontSize: 11,
    fontWeight: 950,
    cursor: "pointer",
  },

  disabledButton: {
    opacity: 0.3,
    cursor: "not-allowed",
  },

  weekSub: {
    marginTop: 4,
    color: "#777",
    fontSize: 10,
    fontWeight: 850,
  },

  navArrow: {
    fontSize: 24,
    lineHeight: 1,
    color: "#ff6a00",
    fontWeight: 1000,
  },

  navText: {
    fontSize: 11,
    fontWeight: 950,
    letterSpacing: 0.5,
  },

  weekProgress: {
    marginTop: 16,
    width: "100%",
  },

  weekProgressTrack: {
    position: "relative",
    height: 5,
    overflow: "hidden",
    borderRadius: 999,
    background: "#242427",
  },

  weekProgressFill: {
    height: "100%",
    borderRadius: 999,
    background:
      "linear-gradient(90deg,#a52413,#ff6a21)",
    transition: "width 180ms ease",
  },

  weekProgressLabels: {
    marginTop: 7,
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    color: "#68686d",
    fontSize: 9,
    fontWeight: 900,
    letterSpacing: 0.4,
  },

  loadingPanel: {
    width: "100%",
    maxWidth: 900,
    margin: "0 auto",
    boxSizing: "border-box",
    padding: 25,
    textAlign: "center",
    border: "1px solid #29292d",
    borderRadius: 16,
    background: "#111113",
    color: "#999",
    fontSize: 13,
    fontWeight: 800,
  },

  emptyPanel: {
    width: "100%",
    maxWidth: 900,
    margin: "0 auto",
    boxSizing: "border-box",
    padding: "54px 18px",
    textAlign: "center",
    border: "1px solid #29292d",
    borderRadius: 16,
    background:
      "radial-gradient(circle at center top,rgba(255,78,20,.08),transparent 55%),#101012",
  },

  emptyIcon: {
    fontSize: 38,
    marginBottom: 10,
  },

  emptyEyebrow: {
    color: "#ff6a00",
    fontSize: 10,
    fontWeight: 1000,
    letterSpacing: 1.4,
  },

  emptyTitle: {
    margin: "5px 0 7px",
    fontSize: 22,
  },

  emptyText: {
    maxWidth: 520,
    margin: "0 auto",
    color: "#888",
    fontSize: 13,
    lineHeight: 1.5,
  },

  sectionHead: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "end",
    gap: 12,
    marginBottom: 10,
  },

  sectionTitle: {
    margin: "2px 0 0",
    fontSize: 23,
  },

  matchupCount: {
    color: "#777",
    fontSize: 10,
    fontWeight: 950,
    letterSpacing: 0.7,
  },

  matchupGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit,minmax(min(100%,500px),1fr))",
    gap: 14,
  },

  matchupCard: {
    overflow: "hidden",
    border: "1px solid #29292d",
    borderRadius: 16,
    background: "#101012",
    boxShadow: "0 12px 34px rgba(0,0,0,.18)",
  },

  matchupHeader: {
    padding: "12px 14px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    borderBottom: "1px solid #29292d",
    background:
      "linear-gradient(90deg,#171719,#120c09)",
  },

  matchupWeek: {
    color: "#ff6a00",
    fontSize: 10,
    fontWeight: 1000,
    letterSpacing: 1.2,
  },

  matchupType: {
    marginTop: 2,
    color: "#777",
    fontSize: 9,
    fontWeight: 900,
  },

  statusBadge: {
    padding: "5px 8px",
    border: "1px solid #3c3c40",
    borderRadius: 999,
    background: "#19191c",
    color: "#bbb",
    fontSize: 9,
    fontWeight: 1000,
    letterSpacing: 0.7,
  },

  liveBadge: {
    borderColor: "#7a351c",
    background: "#26130c",
    color: "#ff8a3d",
  },

  finalBadge: {
    borderColor: "#225f38",
    background: "#102418",
    color: "#62d88b",
  },

  teamsRow: {
    display: "grid",
    gridTemplateColumns: "minmax(0,1fr) 38px minmax(0,1fr)",
    alignItems: "center",
    gap: 7,
    padding: "20px 14px 17px",
  },

  teamBlock: {
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
  },

  teamName: {
    width: "100%",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    fontSize: 21,
    fontWeight: 1000,
    lineHeight: 1.05,
  },

  teamRecord: {
    marginTop: 5,
    color: "#aaa",
    fontSize: 11,
    fontWeight: 850,
  },

  teamPf: {
    marginTop: 3,
    color: "#626267",
    fontSize: 9,
    fontWeight: 800,
  },

  versus: {
    textAlign: "center",
    color: "#555",
    fontSize: 10,
    fontWeight: 1000,
  },

  liveScoreArea: {
    margin: "0 14px 14px",
    padding: 12,
    border: "1px solid #29292d",
    borderRadius: 10,
    background: "#151517",
  },

  scoreLabel: {
    textAlign: "center",
    color: "#777",
    fontSize: 9,
    fontWeight: 950,
    letterSpacing: 1,
  },

  actualScore: {
    marginTop: 6,
    display: "grid",
    gridTemplateColumns: "1fr auto 1fr",
    gap: 10,
    alignItems: "center",
    textAlign: "center",
    fontSize: 28,
  },

  projectionPanel: {
    margin: "0 14px 14px",
    padding: 13,
    border: "1px solid #422116",
    borderRadius: 12,
    background:
      "linear-gradient(135deg,#1b100c,#151214 65%,#1d0d08)",
  },

  projectionTitleRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },

  projectionTitle: {
    marginTop: 2,
    color: "#ddd",
    fontSize: 12,
    fontWeight: 900,
  },

  projectedCategoryScore: {
    display: "flex",
    alignItems: "center",
    gap: 7,
    color: "#fff",
    fontSize: 22,
    fontWeight: 1000,
  },

  projectionValues: {
    marginTop: 13,
    marginBottom: 7,
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
  },

  projectionValuesRight: {
    textAlign: "right",
  },

  barOuter: {
    position: "relative",
    width: "100%",
    height: 13,
    display: "flex",
    overflow: "hidden",
    border: "1px solid #40302b",
    borderRadius: 999,
    background: "#09090a",
  },

  barHome: {
    height: "100%",
    background:
      "linear-gradient(90deg,#a52413,#ff6a21)",
  },

  barAway: {
    height: "100%",
    background:
      "linear-gradient(90deg,#6b6b70,#343438)",
  },

  barCenter: {
    position: "absolute",
    left: "50%",
    top: 0,
    bottom: 0,
    width: 1,
    background: "rgba(255,255,255,.55)",
  },

  projectionFoot: {
    marginTop: 8,
    color: "#777",
    fontSize: 9,
    lineHeight: 1.4,
  },

  categoryPanel: {
    margin: "0 14px 14px",
    overflow: "hidden",
    border: "1px solid #29292d",
    borderRadius: 8,
    background: "#101113",
  },

  categoryTableScroll: {
    width: "100%",
    overflowX: "auto",
    overflowY: "hidden",
    WebkitOverflowScrolling: "touch",
    scrollbarWidth: "thin",
  },

  categoryTableGrid: {
    display: "grid",
    minWidth: "max-content",
  },

  categoryTableCell: {
    minHeight: 44,
    padding: "8px 9px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRight: "1px solid #29292d",
    borderBottom: "1px solid #29292d",
  },

  categoryTeamHeader: {
    position: "sticky",
    left: 0,
    zIndex: 3,
    justifyContent: "flex-start",
    background: "#0d0e10",
    color: "#8e9298",
    fontSize: 9,
    fontWeight: 1000,
  },

  categoryStatHeader: {
    flexDirection: "column",
    gap: 1,
    background: "#0d0e10",
    color: "#c7c9cd",
    fontSize: 10,
    fontWeight: 1000,
  },

  categoryTeamCell: {
    position: "sticky",
    left: 0,
    zIndex: 2,
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 2,
    background: "#141518",
    color: "#f4f5f6",
    fontSize: 11,
  },

  categoryStatCell: {
    background: "#111214",
    color: "#d7d9dc",
    fontSize: 14,
    fontWeight: 800,
  },

  categoryWinnerCell: {
    color: "#ff6a00",
    fontWeight: 1000,
    background: "#1a120e",
  },

  resultStrip: {
    margin: "0 14px 14px",
    padding: 9,
    textAlign: "center",
    border: "1px solid #294b34",
    borderRadius: 9,
    background: "#102018",
    color: "#aaa",
    fontSize: 10,
    fontWeight: 1000,
  },

  winnerText: {
    color: "#62d88b",
  },

  cardFooter: {
    padding: 14,
    borderTop: "1px solid #29292d",
    background: "#0d0d0f",
  },

  detailButton: {
    minHeight: 43,
    width: "100%",
    boxSizing: "border-box",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    padding: "10px 13px",
    border: "1px solid #7d2e18",
    borderRadius: 10,
    background:
      "linear-gradient(90deg,#8e2514,#e45320)",
    color: "#fff",
    textDecoration: "none",
    fontSize: 10,
    fontWeight: 1000,
    letterSpacing: 0.8,
  },
};