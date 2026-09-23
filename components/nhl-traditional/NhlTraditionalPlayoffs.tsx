"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";

type Props = {
  leagueId: string;
};

type LeagueRow = {
  id: string;
  name: string;
  season: number;
};

type PlayoffBracket = {
  id: number;
  status: string;
  playoffTeamCount: number;
  playoffWeeks: number;
  generatedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  championFantasyTeamId: number | null;
  championTeamName: string | null;
  runnerUpFantasyTeamId: number | null;
  runnerUpTeamName: string | null;
};

type PlayoffSeed = {
  seed: number;
  fantasyTeamId: number;
  teamName: string;
  regularSeasonRank: number | null;
  regularSeasonWins: number;
  regularSeasonLosses: number;
  regularSeasonTies: number;
  regularSeasonPointsFor: number | string;
  regularSeasonPointsAgainst: number | string;
};

type CategoryResult = {
  home?: number | string;
  away?: number | string;
  direction?: string;
  winner?: "home" | "away" | "tie" | string;
  goalieCategory?: boolean;
  goalieMinimumApplied?: boolean;
};

type ScoringBreakdown = {
  fantasyWeek?: number;
  scoringSystem?: string;
  fantasyPoints?: number | string;
  categoryWins?: number;
  categoryLosses?: number;
  categoryTies?: number;
  goalieStarts?: number;
  goalieMinimumMet?: boolean;
  categories?: Record<string, CategoryResult>;
};

type PlayoffMatchup = {
  id: number;
  playoffWeek?: number;
  roundNumber?: number;
  matchupNumber: number;
  roundName?: string | null;

  status: string;
  isBye: boolean;

  homeSeed: number | null;
  awaySeed: number | null;

  homeFantasyTeamId: number | null;
  awayFantasyTeamId: number | null;

  homeTeamName: string | null;
  awayTeamName: string | null;

  homeScore: number | string | null;
  awayScore: number | string | null;

  scoringSystem: string | null;

  homeScoringBreakdown?: ScoringBreakdown;
  awayScoringBreakdown?: ScoringBreakdown;

  homeGoalieStarts?: number;
  awayGoalieStarts?: number;

  homeGoalieMinimumMet?: boolean | null;
  awayGoalieMinimumMet?: boolean | null;

  winnerFantasyTeamId: number | null;
  winnerTeamName?: string | null;

  loserFantasyTeamId?: number | null;
  loserTeamName?: string | null;

  isTie: boolean;

  tiebreaker?: string | null;

  nextMatchupId?: number | null;
  nextSlot?: "home" | "away" | null;

  startedAt?: string | null;
  scoredAt?: string | null;
  completedAt?: string | null;
};

type PlayoffRound = {
  roundNumber: number;
  playoffWeek: number;
  roundName: string | null;
  matchups: PlayoffMatchup[];
};

type BracketResponse = {
  success: boolean;
  exists: boolean;
  leagueId: string;
  season: number;
  bracket: PlayoffBracket | null;
  seeds: PlayoffSeed[];
  rounds: PlayoffRound[];
  matchups: PlayoffMatchup[];
};

type ProjectedSeed = {
  seed: number;
  fantasyTeamId: number;
  teamName: string;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number | string;
  pointsAgainst: number | string;
  projected: boolean;
};

type ProjectedMatchup = {
  playoffWeek: number;
  roundNumber: number;
  matchupNumber: number;
  roundName: string | null;
  homeSeed: number | null;
  awaySeed: number | null;
  homeFantasyTeamId: number | null;
  awayFantasyTeamId: number | null;
  homeTeamName: string | null;
  awayTeamName: string | null;
  isBye: boolean;
  status: string;
  projected: boolean;
};

type ProjectedBracketResponse = {
  success: boolean;
  exists: boolean;
  projected: boolean;
  realBracketExists: boolean;
  leagueId: string;
  season: number;
  playoffTeamCount: number;
  playoffWeeks: number;
  requiredRounds: number;
  bracketSize: number;
  seeds: ProjectedSeed[];
  matchups: ProjectedMatchup[];
};

function normalizeProjectedBracket(
  projected: ProjectedBracketResponse
): BracketResponse {
  const seeds: PlayoffSeed[] = (projected.seeds ?? []).map((seed) => ({
    seed: seed.seed,
    fantasyTeamId: seed.fantasyTeamId,
    teamName: seed.teamName,
    regularSeasonRank: seed.seed,
    regularSeasonWins: seed.wins,
    regularSeasonLosses: seed.losses,
    regularSeasonTies: seed.ties,
    regularSeasonPointsFor: seed.pointsFor,
    regularSeasonPointsAgainst: seed.pointsAgainst,
  }));

  const matchups: PlayoffMatchup[] = (projected.matchups ?? []).map(
    (matchup, index) => ({
      id: -(index + 1),
      playoffWeek: matchup.playoffWeek,
      roundNumber: matchup.roundNumber,
      matchupNumber: matchup.matchupNumber,
      roundName: matchup.roundName,
      status: "projected",
      isBye: matchup.isBye,
      homeSeed: matchup.homeSeed,
      awaySeed: matchup.awaySeed,
      homeFantasyTeamId: matchup.homeFantasyTeamId,
      awayFantasyTeamId: matchup.awayFantasyTeamId,
      homeTeamName: matchup.homeTeamName,
      awayTeamName: matchup.awayTeamName,
      homeScore: null,
      awayScore: null,
      scoringSystem: null,
      winnerFantasyTeamId: null,
      isTie: false,
    })
  );

  const roundMap = new Map<number, PlayoffRound>();

  for (const matchup of matchups) {
    const roundNumber = matchup.roundNumber ?? 1;
    const existing = roundMap.get(roundNumber);

    if (existing) {
      existing.matchups.push(matchup);
    } else {
      roundMap.set(roundNumber, {
        roundNumber,
        playoffWeek: matchup.playoffWeek ?? roundNumber,
        roundName: matchup.roundName ?? null,
        matchups: [matchup],
      });
    }
  }

  return {
    success: projected.success,
    exists: projected.exists,
    leagueId: projected.leagueId,
    season: projected.season,
    bracket: projected.exists
      ? {
          id: 0,
          status: "projected",
          playoffTeamCount: projected.playoffTeamCount,
          playoffWeeks: projected.playoffWeeks,
          generatedAt: null,
          startedAt: null,
          completedAt: null,
          championFantasyTeamId: null,
          championTeamName: null,
          runnerUpFantasyTeamId: null,
          runnerUpTeamName: null,
        }
      : null,
    seeds,
    rounds: [...roundMap.values()].sort(
      (a, b) => a.roundNumber - b.roundNumber
    ),
    matchups,
  };
}

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const categoryLabels: Record<string, string> = {
  goal: "Goals",
  assist: "Assists",
  total_point: "Total Points",
  plus_minus: "Plus / Minus",
  penalty_minute: "Penalty Minutes",

  power_play_goal: "Power-Play Goals",
  power_play_assist: "Power-Play Assists",
  power_play_point: "Power-Play Points",

  short_handed_goal: "Short-Handed Goals",
  short_handed_assist: "Short-Handed Assists",
  short_handed_point: "Short-Handed Points",

  game_winning_goal: "Game-Winning Goals",

  shot_on_goal: "Shots on Goal",
  shooting_percentage: "Shooting Percentage",

  hit: "Hits",
  blocked_shot: "Blocked Shots",
  takeaway: "Takeaways",
  giveaway: "Giveaways",

  faceoff_win: "Faceoff Wins",
  faceoff_loss: "Faceoff Losses",
  faceoff_percentage: "Faceoff Percentage",

  shift: "Shifts",
  time_on_ice: "Time on Ice",

  goalie_save: "Saves",
  shot_against: "Shots Against",
  goal_against: "Goals Against",

  goalie_win: "Goalie Wins",
  goalie_loss: "Goalie Losses",
  goalie_overtime_loss: "Overtime Losses",

  save_percentage: "Save Percentage",
  goals_against_average: "Goals-Against Average",
  goalie_win_percentage: "Goalie Win Percentage",

  shutout: "Shutouts",
  shutout_win: "Shutout Wins",

  quality_start: "G365 Quality Starts",
  quality_start_percentage: "Quality Start Percentage",

  goalie_30_save_game: "30+ Save Games",
  goalie_40_save_game: "40+ Save Games",

  hat_trick: "Hat Tricks",
  two_goal_game: "2+ Goal Games",
  two_point_game: "2+ Point Games",
  three_point_game: "3+ Point Games",
  five_shot_game: "5+ Shot Games",
  five_hit_game: "5+ Hit Games",
  three_block_game: "3+ Block Games",
  two_power_play_point_game: "2+ Power-Play Point Games",
};

function pretty(value?: string | null) {
  if (!value) return "—";

  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function n(value: number | string | null | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatScore(
  value: number | string | null | undefined,
  scoringSystem?: string | null
) {
  if (value == null) return "—";

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return String(value);
  }

  if (scoringSystem === "categories") {
    return String(parsed);
  }

  return Number.isInteger(parsed)
    ? parsed.toFixed(1)
    : parsed.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function formatCategoryValue(key: string, value: number | string | undefined) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return value == null ? "0" : String(value);
  }

  if (
    key === "save_percentage" ||
    key === "goalie_win_percentage" ||
    key === "quality_start_percentage"
  ) {
    return parsed.toFixed(3);
  }

  if (
    key === "faceoff_percentage" ||
    key === "shooting_percentage"
  ) {
    return `${parsed.toFixed(1)}%`;
  }

  if (key === "goals_against_average") {
    return parsed.toFixed(2);
  }

  if (key === "time_on_ice") {
    const totalSeconds = Math.max(0, Math.round(parsed));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, "0")}:${String(
        seconds
      ).padStart(2, "0")}`;
    }

    return `${minutes}:${String(seconds).padStart(2, "0")}`;
  }

  return Number.isInteger(parsed)
    ? String(parsed)
    : parsed.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function formatRecord(seed: PlayoffSeed) {
  if (seed.regularSeasonTies > 0) {
    return `${seed.regularSeasonWins}-${seed.regularSeasonLosses}-${seed.regularSeasonTies}`;
  }

  return `${seed.regularSeasonWins}-${seed.regularSeasonLosses}`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function statusLabel(status?: string | null) {
  switch (status) {
    case "ready":
      return "READY";
    case "in_progress":
      return "LIVE";
    case "final":
      return "FINAL";
    case "scheduled":
      return "UPCOMING";
    case "setup":
      return "SETUP";
    case "projected":
      return "PROJECTED";
    default:
      return pretty(status).toUpperCase();
  }
}

function getMatchupCategoryResults(matchup: PlayoffMatchup) {
  return (
    matchup.homeScoringBreakdown?.categories ??
    matchup.awayScoringBreakdown?.categories ??
    {}
  );
}

function MatchupTeamRow({
  side,
  matchup,
}: {
  side: "home" | "away";
  matchup: PlayoffMatchup;
}) {
  const isHome = side === "home";

  const teamId = isHome
    ? matchup.homeFantasyTeamId
    : matchup.awayFantasyTeamId;

  const teamName = isHome
    ? matchup.homeTeamName
    : matchup.awayTeamName;

  const seed = isHome
    ? matchup.homeSeed
    : matchup.awaySeed;

  const score = isHome
    ? matchup.homeScore
    : matchup.awayScore;

  const isWinner =
    matchup.status === "final" &&
    teamId != null &&
    matchup.winnerFantasyTeamId === teamId;

  return (
    <div
      className={`g365-playoff-team-row ${
        isWinner ? "g365-playoff-team-winner" : ""
      }`}
    >
      <div className="g365-playoff-seed">
        {seed != null ? seed : "—"}
      </div>

      <div className="g365-playoff-team-name">
        {teamName ?? "TBD"}

        {isWinner ? (
          <span className="g365-playoff-advance">
            ADVANCES
          </span>
        ) : null}
      </div>

      <div className="g365-playoff-score">
        {teamId == null
          ? "—"
          : formatScore(score, matchup.scoringSystem)}
      </div>
    </div>
  );
}

function CategoryBreakdown({
  matchup,
}: {
  matchup: PlayoffMatchup;
}) {
  const categories = getMatchupCategoryResults(matchup);

  const entries = Object.entries(categories);

  if (
    matchup.scoringSystem !== "categories" ||
    entries.length === 0
  ) {
    return null;
  }

  return (
    <details className="g365-category-details">
      <summary>VIEW CATEGORY RESULTS</summary>

      <div className="g365-category-table">
        <div className="g365-category-header">
          <span>CATEGORY</span>
          <span>HOME</span>
          <span>AWAY</span>
        </div>

        {entries.map(([key, result]) => {
          const homeWinner = result.winner === "home";
          const awayWinner = result.winner === "away";

          return (
            <div
              key={key}
              className="g365-category-row"
            >
              <div className="g365-category-name">
                <strong>
                  {categoryLabels[key] ?? pretty(key)}
                </strong>

                {result.goalieMinimumApplied ? (
                  <span className="g365-minimum-note">
                    Goalie minimum applied
                  </span>
                ) : null}
              </div>

              <div
                className={
                  homeWinner
                    ? "g365-category-value g365-category-win"
                    : "g365-category-value"
                }
              >
                {formatCategoryValue(key, result.home)}
              </div>

              <div
                className={
                  awayWinner
                    ? "g365-category-value g365-category-win"
                    : "g365-category-value"
                }
              >
                {formatCategoryValue(key, result.away)}
              </div>
            </div>
          );
        })}
      </div>
    </details>
  );
}

function MatchupCard({
  matchup,
}: {
  matchup: PlayoffMatchup;
}) {
  const homeBreakdown = matchup.homeScoringBreakdown;
  const awayBreakdown = matchup.awayScoringBreakdown;

  return (
    <article className="g365-matchup-card">
      <div className="g365-matchup-head">
        <div>
          <span className="g365-matchup-label">
            MATCHUP {matchup.matchupNumber}
          </span>

          {matchup.isBye ? (
            <span className="g365-bye-badge">
              BYE
            </span>
          ) : null}
        </div>

        <span
          className={`g365-status g365-status-${matchup.status}`}
        >
          {statusLabel(matchup.status)}
        </span>
      </div>

      {matchup.isBye ? (
        <div className="g365-bye-only">
          <div className="g365-bye-team">
            <div className="g365-playoff-seed">
              {matchup.homeFantasyTeamId != null
                ? matchup.homeSeed ?? "—"
                : matchup.awaySeed ?? "—"}
            </div>

            <div className="g365-bye-team-name">
              {matchup.homeFantasyTeamId != null
                ? matchup.homeTeamName ?? "TBD"
                : matchup.awayTeamName ?? "TBD"}
            </div>
          </div>

          <strong>BYE</strong>
          <span>Advances automatically</span>
        </div>
      ) : (
        <div className="g365-matchup-teams">
          <MatchupTeamRow
            side="home"
            matchup={matchup}
          />

          <div className="g365-versus">
            VS
          </div>

          <MatchupTeamRow
            side="away"
            matchup={matchup}
          />
        </div>
      )}

      {matchup.scoringSystem === "categories" ? (
        <div className="g365-category-summary">
          <div>
            <span>HOME</span>
            <strong>
              {homeBreakdown?.categoryWins ?? n(matchup.homeScore)}
            </strong>
            <small>category wins</small>
          </div>

          <div>
            <span>TIES</span>
            <strong>
              {homeBreakdown?.categoryTies ??
                awayBreakdown?.categoryTies ??
                0}
            </strong>
            <small>categories</small>
          </div>

          <div>
            <span>AWAY</span>
            <strong>
              {awayBreakdown?.categoryWins ?? n(matchup.awayScore)}
            </strong>
            <small>category wins</small>
          </div>
        </div>
      ) : null}

      {matchup.scoringSystem === "categories" ? (
        <div className="g365-goalie-summary">
          <div>
            <span>
              Home goalie starts
            </span>

            <strong>
              {matchup.homeGoalieStarts ?? 0}
            </strong>

            {matchup.homeGoalieMinimumMet === false ? (
              <small className="g365-minimum-failed">
                MINIMUM NOT MET
              </small>
            ) : matchup.homeGoalieMinimumMet === true ? (
              <small className="g365-minimum-met">
                MINIMUM MET
              </small>
            ) : null}
          </div>

          <div>
            <span>
              Away goalie starts
            </span>

            <strong>
              {matchup.awayGoalieStarts ?? 0}
            </strong>

            {matchup.awayGoalieMinimumMet === false ? (
              <small className="g365-minimum-failed">
                MINIMUM NOT MET
              </small>
            ) : matchup.awayGoalieMinimumMet === true ? (
              <small className="g365-minimum-met">
                MINIMUM MET
              </small>
            ) : null}
          </div>
        </div>
      ) : null}

      {matchup.status === "final" && matchup.isTie ? (
        <div className="g365-tiebreak">
          <strong>PLAYOFF TIE</strong>
          <span>
            Higher seed advances
            {matchup.winnerTeamName
              ? ` — ${matchup.winnerTeamName}`
              : ""}
            .
          </span>
        </div>
      ) : null}


      <CategoryBreakdown matchup={matchup} />

      {matchup.completedAt ? (
        <div className="g365-matchup-footer">
          Finalized {formatDate(matchup.completedAt)}
        </div>
      ) : null}
    </article>
  );
}

export default function NhlTraditionalPlayoffs({
  leagueId,
}: Props) {
  const router = useRouter();

  const [league, setLeague] =
    useState<LeagueRow | null>(null);

  const [data, setData] =
    useState<BracketResponse | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const load = useCallback(
    async (showFullLoading = true) => {
      if (showFullLoading) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      setError(null);

      try {
        const leagueResult = await supabase
          .from("leagues")
          .select("id,name,season")
          .eq("id", leagueId)
          .single();

        if (leagueResult.error) {
          throw new Error(
            leagueResult.error.message
          );
        }

        const nextLeague =
          leagueResult.data as LeagueRow;

        const bracketResult = await supabase.rpc(
          "get_nhl_traditional_playoff_bracket",
          {
            p_league_id: leagueId,
            p_season: nextLeague.season,
          }
        );

        if (bracketResult.error) {
          throw new Error(bracketResult.error.message);
        }

        const official = (bracketResult.data ??
          null) as BracketResponse | null;

        if (official?.exists && official.bracket) {
          setLeague(nextLeague);
          setData(official);
          return;
        }

        const projectedResult = await supabase.rpc(
          "get_nhl_traditional_projected_playoff_bracket",
          {
            p_league_id: leagueId,
            p_season: nextLeague.season,
          }
        );

        if (projectedResult.error) {
          throw new Error(projectedResult.error.message);
        }

        const projected = (projectedResult.data ??
          null) as ProjectedBracketResponse | null;

        setLeague(nextLeague);

        setData(
          projected?.exists
            ? normalizeProjectedBracket(projected)
            : official
        );
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "The NHL playoff bracket could not be loaded."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [leagueId]
  );

  useEffect(() => {
    void load();
  }, [load]);

  /*
   * Keep an active playoff bracket reasonably fresh without
   * hammering Supabase.
   */
  useEffect(() => {
    if (
      !data?.exists ||
      data.bracket?.status === "final" ||
      data.bracket?.status === "projected"
    ) {
      return;
    }

    const interval = window.setInterval(() => {
      void load(false);
    }, 30000);

    return () => {
      window.clearInterval(interval);
    };
  }, [data?.exists, data?.bracket?.status, load]);

  const sortedRounds = useMemo(() => {
    return [...(data?.rounds ?? [])].sort(
      (a, b) => a.roundNumber - b.roundNumber
    );
  }, [data?.rounds]);

  const sortedSeeds = useMemo(() => {
    return [...(data?.seeds ?? [])].sort(
      (a, b) => a.seed - b.seed
    );
  }, [data?.seeds]);

  if (loading) {
    return (
      <main className="g365-playoffs-page">
        <style>{pageCss}</style>

        <div className="g365-loading">
          Loading NHL Playoffs…
        </div>
      </main>
    );
  }

  return (
    <main className="g365-playoffs-page">
      <style>{pageCss}</style>

      <div className="g365-playoffs-shell">
        <header className="g365-playoffs-hero">
          <div>
            <div className="g365-eyebrow">
              G365 • NHL TRADITIONAL
            </div>

            <h1>
              PLAYOFFS
            </h1>

            <p>
              {league?.name ?? "NHL League"}{" "}
              {league?.season
                ? `• ${league.season}`
                : ""}
            </p>
          </div>

          <div className="g365-hero-actions">
            <button
              type="button"
              className="g365-button g365-button-secondary"
              onClick={() =>
                router.push(`/league/${leagueId}`)
              }
            >
              LEAGUE HOME
            </button>

            <button
              type="button"
              className="g365-button"
              disabled={refreshing}
              onClick={() => void load(false)}
            >
              {refreshing
                ? "REFRESHING…"
                : "REFRESH"}
            </button>
          </div>
        </header>

        {error ? (
          <div className="g365-error">
            {error}
          </div>
        ) : null}

        {!data?.exists ? (
          <section className="g365-empty">
            <div className="g365-empty-icon">
              G365
            </div>

            <h2>
              PLAYOFF BRACKET UNAVAILABLE
            </h2>

            <p>
              The {league?.season ?? ""} playoff structure is not
              available yet. It will appear automatically as soon
              as the league has enough standings data.
            </p>
          </section>
        ) : null}

        {data?.exists && data.bracket ? (
          <>
            {data.bracket.status === "projected" ? (
              <section className="g365-projected-banner">
                <div>
                  <span>LIVE PLAYOFF PICTURE</span>
                  <strong>PROJECTED BRACKET</strong>
                </div>
                <p>
                  Seeds are based on the current standings and can
                  change through the end of the regular season. The
                  official bracket locks automatically when the
                  regular season is complete.
                </p>
              </section>
            ) : null}

            <section className="g365-overview">
              <div className="g365-overview-card">
                <span>STATUS</span>
                <strong>
                  {statusLabel(
                    data.bracket.status
                  )}
                </strong>
              </div>

              <div className="g365-overview-card">
                <span>PLAYOFF TEAMS</span>
                <strong>
                  {data.bracket.playoffTeamCount}
                </strong>
              </div>

              <div className="g365-overview-card">
                <span>ROUNDS</span>
                <strong>
                  {data.bracket.playoffWeeks}
                </strong>
              </div>

              <div className="g365-overview-card">
                <span>FORMAT</span>
                <strong>
                  {data.matchups.find(
                    (matchup) =>
                      matchup.scoringSystem
                  )?.scoringSystem ===
                  "categories"
                    ? "CATEGORIES"
                    : data.matchups.find(
                        (matchup) =>
                          matchup.scoringSystem
                      )?.scoringSystem ===
                      "points"
                    ? "POINTS"
                    : data.bracket.status === "projected"
                    ? "TBD"
                    : "—"}
                </strong>
              </div>
            </section>

            {data.bracket.status === "final" &&
            data.bracket.championFantasyTeamId ? (
              <section className="g365-champion">
                <div className="g365-champion-flame">
                  G365
                </div>

                <div>
                  <div className="g365-champion-label">
                    {league?.season ?? ""} NHL CHAMPION
                  </div>

                  <h2>
                    {data.bracket
                      .championTeamName ??
                      "Champion"}
                  </h2>

                  {data.bracket
                    .runnerUpTeamName ? (
                    <p>
                      Runner-Up:{" "}
                      <strong>
                        {
                          data.bracket
                            .runnerUpTeamName
                        }
                      </strong>
                    </p>
                  ) : null}
                </div>
              </section>
            ) : null}

            <section className="g365-section">
              <div className="g365-section-head">
                <div>
                  <span className="g365-section-kicker">
                    ROAD TO THE TITLE
                  </span>

                  <h2>
                    PLAYOFF BRACKET
                  </h2>

                  <p>
                    {data.bracket.status === "projected"
                      ? "This is the current playoff path based on today's standings. Seeds update until the regular season is complete."
                      : "Winners advance automatically. If a playoff matchup finishes tied, the higher seed advances."}
                  </p>
                </div>
              </div>

              {sortedRounds.length ? (
                <div className="g365-bracket-scroll">
                  <div
                    className="g365-bracket"
                    style={{
                      gridTemplateColumns: `repeat(${Math.max(
                        sortedRounds.length,
                        1
                      )}, minmax(300px, 1fr))`,
                    }}
                  >
                    {sortedRounds.map(
                      (round) => (
                        <div
                          key={
                            round.roundNumber
                          }
                          className="g365-round"
                        >
                          <div className="g365-round-head">
                            <span>
                              ROUND{" "}
                              {round.roundNumber}
                            </span>

                            <h3>
                              {round.roundName ??
                                `Round ${round.roundNumber}`}
                            </h3>

                            <small>
                              Playoff Week{" "}
                              {round.playoffWeek}
                            </small>
                          </div>

                          <div
                            className={`g365-round-matchups g365-round-matchups-${round.roundNumber}`}
                          >
                            {[...round.matchups]
                              .sort(
                                (a, b) =>
                                  a.matchupNumber -
                                  b.matchupNumber
                              )
                              .map((matchup) => (
                                <MatchupCard
                                  key={matchup.id}
                                  matchup={
                                    matchup
                                  }
                                />
                              ))}
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </div>
              ) : (
                <div className="g365-empty-small">
                  The bracket has been created,
                  but no playoff matchups are
                  available yet.
                </div>
              )}
            </section>

            {data.bracket.status !== "projected" ? (
              <section className="g365-playoff-info">
                <div>
                  <span>BRACKET GENERATED</span>
                  <strong>{formatDate(data.bracket.generatedAt)}</strong>
                </div>

                <div>
                  <span>PLAYOFFS STARTED</span>
                  <strong>{formatDate(data.bracket.startedAt)}</strong>
                </div>

                <div>
                  <span>COMPLETED</span>
                  <strong>{formatDate(data.bracket.completedAt)}</strong>
                </div>
              </section>
            ) : null}
          </>
        ) : null}
      </div>
    </main>
  );
}

const pageCss = `
  * {
    box-sizing: border-box;
  }

  .g365-playoffs-page {
    min-height: 100vh;
    padding: 24px 18px 60px;
    background:
      radial-gradient(circle at top right, rgba(255, 72, 0, 0.14), transparent 32%),
      radial-gradient(circle at top left, rgba(180, 0, 0, 0.12), transparent 28%),
      #070707;
    color: #ffffff;
  }

  .g365-playoffs-shell {
    width: min(1500px, 100%);
    margin: 0 auto;
  }

  .g365-loading {
    width: min(900px, 100%);
    margin: 80px auto;
    padding: 30px;
    border: 1px solid #2c2c2c;
    border-radius: 18px;
    background: #111111;
    text-align: center;
    font-weight: 900;
    letter-spacing: 0.08em;
  }

  .g365-playoffs-hero {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 24px;
    padding: 24px;
    margin-bottom: 18px;
    border: 1px solid #3a1a10;
    border-radius: 22px;
    background:
      linear-gradient(135deg, rgba(143, 0, 0, 0.38), rgba(255, 74, 0, 0.12) 48%, rgba(15, 15, 15, 0.96)),
      #111111;
    box-shadow: 0 18px 45px rgba(0, 0, 0, 0.35);
  }

  .g365-eyebrow {
    margin-bottom: 7px;
    color: #ff6a21;
    font-size: 12px;
    font-weight: 950;
    letter-spacing: 0.16em;
  }

  .g365-playoffs-hero h1 {
    margin: 0;
    font-size: clamp(32px, 5vw, 58px);
    line-height: 0.95;
    letter-spacing: -0.04em;
  }

  .g365-playoffs-hero p {
    margin: 10px 0 0;
    color: #c8c8c8;
    font-weight: 700;
  }

  .g365-hero-actions {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }

  .g365-button {
    min-height: 44px;
    padding: 11px 18px;
    border: 1px solid #ff5a16;
    border-radius: 11px;
    background: linear-gradient(135deg, #b61500, #ff5a16);
    color: #ffffff;
    font-size: 12px;
    font-weight: 950;
    letter-spacing: 0.06em;
    cursor: pointer;
  }

  .g365-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .g365-button-secondary {
    border-color: #444444;
    background: #151515;
  }

  .g365-error {
    margin-bottom: 16px;
    padding: 14px 16px;
    border: 1px solid #9d1b1b;
    border-radius: 12px;
    background: rgba(126, 0, 0, 0.25);
    color: #ffd4d4;
    font-weight: 800;
  }


  .g365-projected-banner {
    display: grid;
    grid-template-columns: minmax(220px, 0.7fr) minmax(0, 1.3fr);
    gap: 18px;
    align-items: center;
    margin-bottom: 18px;
    padding: 16px 18px;
    border: 1px solid #7a3212;
    border-radius: 16px;
    background:
      linear-gradient(135deg, rgba(123, 29, 0, 0.34), rgba(255, 83, 18, 0.08)),
      #111111;
  }

  .g365-projected-banner span {
    display: block;
    margin-bottom: 4px;
    color: #ff6a21;
    font-size: 9px;
    font-weight: 950;
    letter-spacing: 0.14em;
  }

  .g365-projected-banner strong {
    font-size: 18px;
    letter-spacing: 0.03em;
  }

  .g365-projected-banner p {
    margin: 0;
    color: #b6b6b6;
    font-size: 12px;
    font-weight: 700;
    line-height: 1.5;
  }

  .g365-empty {
    padding: 50px 24px;
    border: 1px solid #2e2e2e;
    border-radius: 22px;
    background: #101010;
    text-align: center;
  }

  .g365-empty-icon {
    display: grid;
    width: 78px;
    height: 78px;
    margin: 0 auto 18px;
    place-items: center;
    border: 2px solid #ff4d13;
    border-radius: 50%;
    background:
      radial-gradient(circle, #6e1600, #171717 68%);
    color: #ffffff;
    font-size: 17px;
    font-weight: 950;
  }

  .g365-empty h2 {
    margin: 0 0 10px;
    font-size: 25px;
  }

  .g365-empty p {
    max-width: 650px;
    margin: 0 auto;
    color: #aaaaaa;
    line-height: 1.6;
  }

  .g365-overview {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 12px;
    margin-bottom: 18px;
  }

  .g365-overview-card {
    min-width: 0;
    padding: 16px;
    border: 1px solid #292929;
    border-radius: 15px;
    background: linear-gradient(180deg, #151515, #0e0e0e);
  }

  .g365-overview-card span {
    display: block;
    margin-bottom: 6px;
    color: #888888;
    font-size: 10px;
    font-weight: 900;
    letter-spacing: 0.12em;
  }

  .g365-overview-card strong {
    color: #ffffff;
    font-size: 20px;
  }

  .g365-champion {
    display: flex;
    align-items: center;
    gap: 20px;
    margin-bottom: 18px;
    padding: 22px;
    border: 1px solid #704218;
    border-radius: 20px;
    background:
      linear-gradient(135deg, rgba(111, 58, 0, 0.5), rgba(255, 94, 0, 0.14)),
      #111111;
  }

  .g365-champion-flame {
    display: grid;
    flex: 0 0 74px;
    width: 74px;
    height: 74px;
    place-items: center;
    border: 2px solid #ff7a18;
    border-radius: 50%;
    background: #1b0d07;
    color: #ff7a18;
    font-weight: 950;
  }

  .g365-champion-label {
    margin-bottom: 4px;
    color: #ff7a18;
    font-size: 11px;
    font-weight: 950;
    letter-spacing: 0.13em;
  }

  .g365-champion h2 {
    margin: 0;
    font-size: clamp(25px, 4vw, 38px);
  }

  .g365-champion p {
    margin: 6px 0 0;
    color: #bbbbbb;
  }

  .g365-section {
    margin-bottom: 18px;
    padding: 20px;
    border: 1px solid #292929;
    border-radius: 20px;
    background: rgba(16, 16, 16, 0.96);
  }

  .g365-section-head {
    margin-bottom: 16px;
  }

  .g365-section-kicker {
    display: block;
    margin-bottom: 4px;
    color: #ff5c17;
    font-size: 10px;
    font-weight: 950;
    letter-spacing: 0.14em;
  }

  .g365-section-head h2 {
    margin: 0;
    font-size: 24px;
  }

  .g365-section-head p {
    margin: 7px 0 0;
    color: #999999;
    line-height: 1.5;
  }

  .g365-seeds {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
  }

  .g365-seed-card {
    display: grid;
    grid-template-columns: 48px minmax(0, 1fr) auto;
    gap: 12px;
    align-items: center;
    min-width: 0;
    padding: 12px;
    border: 1px solid #292929;
    border-radius: 13px;
    background: #0c0c0c;
  }

  .g365-seed-number {
    display: grid;
    width: 42px;
    height: 42px;
    place-items: center;
    border: 1px solid #c93a0d;
    border-radius: 10px;
    background: #351006;
    color: #ff6a28;
    font-size: 18px;
    font-weight: 950;
  }

  .g365-seed-main {
    min-width: 0;
  }

  .g365-seed-main strong {
    display: block;
    overflow: hidden;
    color: #ffffff;
    font-size: 14px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .g365-seed-main span {
    display: block;
    margin-top: 3px;
    color: #8f8f8f;
    font-size: 11px;
  }

  .g365-seed-rank {
    text-align: right;
  }

  .g365-seed-rank span {
    display: block;
    color: #777777;
    font-size: 8px;
    font-weight: 900;
  }

  .g365-seed-rank strong {
    color: #ffffff;
    font-size: 16px;
  }

  .g365-bracket-scroll {
    width: 100%;
    overflow-x: auto;
    padding-bottom: 8px;
    -webkit-overflow-scrolling: touch;
  }

  .g365-bracket {
    display: grid;
    gap: 16px;
    min-width: max-content;
  }

  .g365-round {
    display: flex;
    flex-direction: column;
    width: 100%;
    min-width: 300px;
    max-width: 430px;
  }

  .g365-round-head {
    min-height: 88px;
    padding: 14px;
    border: 1px solid #3a2118;
    border-radius: 14px 14px 0 0;
    background:
      linear-gradient(135deg, rgba(119, 24, 0, 0.4), rgba(30, 30, 30, 0.7)),
      #141414;
  }

  .g365-round-head span {
    color: #ff5a16;
    font-size: 9px;
    font-weight: 950;
    letter-spacing: 0.14em;
  }

  .g365-round-head h3 {
    margin: 4px 0 3px;
    font-size: 19px;
  }

  .g365-round-head small {
    color: #929292;
    font-weight: 700;
  }

  .g365-round-matchups {
    display: flex;
    flex: 1;
    flex-direction: column;
    justify-content: space-around;
    gap: 22px;
    min-height: 520px;
    padding: 18px 0;
  }

  .g365-round-matchups-2 {
    padding-top: 82px;
    padding-bottom: 82px;
  }

  .g365-round-matchups-3 {
    justify-content: center;
    padding-top: 150px;
    padding-bottom: 150px;
  }

  .g365-matchup-card {
    overflow: hidden;
    border: 1px solid #2c2c2c;
    border-radius: 15px;
    background: #0b0b0b;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.25);
  }

  .g365-matchup-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 10px 12px;
    border-bottom: 1px solid #252525;
    background: #131313;
  }

  .g365-matchup-label {
    color: #888888;
    font-size: 9px;
    font-weight: 950;
    letter-spacing: 0.12em;
  }

  .g365-bye-badge {
    margin-left: 7px;
    padding: 3px 6px;
    border: 1px solid #6b3b1d;
    border-radius: 999px;
    background: #261207;
    color: #ff8a42;
    font-size: 8px;
    font-weight: 950;
  }

  .g365-status {
    padding: 4px 7px;
    border: 1px solid #414141;
    border-radius: 999px;
    background: #1c1c1c;
    color: #cccccc;
    font-size: 8px;
    font-weight: 950;
    letter-spacing: 0.08em;
  }

  .g365-status-final {
    border-color: #29613b;
    background: #102919;
    color: #75dc91;
  }

  .g365-status-in_progress {
    border-color: #b33713;
    background: #371006;
    color: #ff7140;
  }

  .g365-status-ready {
    border-color: #84400c;
    background: #2d1607;
    color: #ff9b4a;
  }

  .g365-status-projected {
    border-color: #6d3218;
    background: #281208;
    color: #ff8a42;
  }

  .g365-matchup-teams {
    padding: 8px;
  }

  .g365-bye-only {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 4px 12px;
    align-items: center;
    min-height: 86px;
    padding: 14px 16px;
  }

  .g365-bye-team {
    display: flex;
    gap: 10px;
    align-items: center;
    min-width: 0;
    grid-row: 1 / span 2;
  }

  .g365-bye-team-name {
    min-width: 0;
    overflow: hidden;
    color: #ffffff;
    font-size: 14px;
    font-weight: 950;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .g365-bye-only > strong {
    color: #ff7a2d;
    font-size: 16px;
    font-weight: 950;
    letter-spacing: 0.08em;
    text-align: right;
  }

  .g365-bye-only > span {
    color: #858585;
    font-size: 9px;
    font-weight: 800;
    text-align: right;
  }

  .g365-playoff-team-row {
    display: grid;
    grid-template-columns: 32px minmax(0, 1fr) auto;
    gap: 9px;
    align-items: center;
    min-height: 51px;
    padding: 8px;
    border: 1px solid transparent;
    border-radius: 10px;
  }

  .g365-playoff-team-winner {
    border-color: #245b34;
    background: rgba(24, 85, 43, 0.22);
  }

  .g365-playoff-seed {
    display: grid;
    width: 29px;
    height: 29px;
    place-items: center;
    border: 1px solid #454545;
    border-radius: 8px;
    color: #d0d0d0;
    font-size: 12px;
    font-weight: 950;
  }

  .g365-playoff-team-name {
    min-width: 0;
    overflow: hidden;
    color: #eeeeee;
    font-size: 13px;
    font-weight: 900;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .g365-playoff-advance {
    display: block;
    margin-top: 2px;
    color: #66d887;
    font-size: 7px;
    font-weight: 950;
    letter-spacing: 0.1em;
  }

  .g365-playoff-score {
    min-width: 45px;
    color: #ffffff;
    font-size: 17px;
    font-weight: 950;
    text-align: right;
  }

  .g365-versus {
    padding: 1px 0;
    color: #555555;
    font-size: 8px;
    font-weight: 950;
    text-align: center;
  }

  .g365-category-summary {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 1px;
    border-top: 1px solid #242424;
    background: #242424;
  }

  .g365-category-summary > div {
    padding: 9px 6px;
    background: #111111;
    text-align: center;
  }

  .g365-category-summary span,
  .g365-category-summary small {
    display: block;
    color: #777777;
    font-size: 7px;
    font-weight: 900;
    letter-spacing: 0.08em;
  }

  .g365-category-summary strong {
    display: block;
    margin: 2px 0;
    font-size: 18px;
  }

  .g365-goalie-summary {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1px;
    border-top: 1px solid #242424;
    background: #242424;
  }

  .g365-goalie-summary > div {
    padding: 8px 10px;
    background: #0e0e0e;
  }

  .g365-goalie-summary span {
    display: block;
    color: #777777;
    font-size: 8px;
    font-weight: 800;
  }

  .g365-goalie-summary strong {
    display: block;
    margin-top: 2px;
  }

  .g365-minimum-met,
  .g365-minimum-failed {
    display: block;
    margin-top: 3px;
    font-size: 7px;
    font-weight: 950;
  }

  .g365-minimum-met {
    color: #66d887;
  }

  .g365-minimum-failed {
    color: #ff664d;
  }

  .g365-tiebreak {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin: 8px;
    padding: 9px 10px;
    border: 1px solid #73401b;
    border-radius: 9px;
    background: #211107;
    color: #e8c1a5;
    font-size: 10px;
  }

  .g365-tiebreak strong {
    color: #ff7d37;
    font-size: 9px;
    letter-spacing: 0.08em;
  }

  .g365-bye-note {
    margin: 8px;
    padding: 9px 10px;
    border: 1px solid #333333;
    border-radius: 9px;
    background: #141414;
    color: #aaaaaa;
    font-size: 10px;
  }

  .g365-bye-note strong {
    color: #ffffff;
  }

  .g365-category-details {
    margin: 8px;
    border: 1px solid #282828;
    border-radius: 9px;
    background: #101010;
  }

  .g365-category-details summary {
    padding: 10px;
    color: #ff6c28;
    font-size: 9px;
    font-weight: 950;
    letter-spacing: 0.08em;
    cursor: pointer;
  }

  .g365-category-table {
    border-top: 1px solid #292929;
  }

  .g365-category-header,
  .g365-category-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 70px 70px;
    gap: 6px;
    align-items: center;
  }

  .g365-category-header {
    padding: 7px 8px;
    color: #777777;
    font-size: 7px;
    font-weight: 950;
    letter-spacing: 0.08em;
  }

  .g365-category-row {
    min-height: 38px;
    padding: 6px 8px;
    border-top: 1px solid #202020;
  }

  .g365-category-name {
    min-width: 0;
  }

  .g365-category-name strong {
    display: block;
    color: #bdbdbd;
    font-size: 9px;
  }

  .g365-minimum-note {
    display: block;
    margin-top: 2px;
    color: #ff7742;
    font-size: 7px;
  }

  .g365-category-value {
    color: #aaaaaa;
    font-size: 10px;
    font-weight: 900;
    text-align: right;
  }

  .g365-category-win {
    color: #69d78a;
  }

  .g365-matchup-footer {
    padding: 7px 10px;
    border-top: 1px solid #222222;
    color: #666666;
    font-size: 8px;
    text-align: right;
  }

  .g365-empty-small {
    padding: 20px;
    border: 1px dashed #353535;
    border-radius: 12px;
    color: #888888;
    text-align: center;
  }

  .g365-playoff-info {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
  }

  .g365-playoff-info > div {
    min-width: 0;
    padding: 12px;
    border: 1px solid #262626;
    border-radius: 12px;
    background: #0e0e0e;
  }

  .g365-playoff-info span {
    display: block;
    margin-bottom: 4px;
    color: #696969;
    font-size: 8px;
    font-weight: 950;
    letter-spacing: 0.09em;
  }

  .g365-playoff-info strong {
    display: block;
    overflow: hidden;
    color: #bcbcbc;
    font-size: 10px;
    text-overflow: ellipsis;
  }

  @media (max-width: 900px) {
    .g365-overview {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .g365-seeds {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 760px) {
    .g365-playoffs-page {
      padding: 12px 9px 44px;
      overflow-x: hidden;
    }

    .g365-playoffs-hero {
      align-items: stretch;
      flex-direction: column;
      padding: 16px;
    }

    .g365-hero-actions {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      width: 100%;
    }

    .g365-button {
      width: 100%;
    }

    .g365-section {
      padding: 13px 10px;
    }

    .g365-projected-banner {
      grid-template-columns: minmax(0, 1fr);
      gap: 8px;
      padding: 14px;
    }

    .g365-bracket-scroll {
      overflow: visible;
    }

    .g365-bracket {
      display: grid;
      grid-template-columns: minmax(0, 1fr) !important;
      min-width: 0;
      width: 100%;
    }

    .g365-round {
      min-width: 0;
      max-width: none;
      width: 100%;
    }

    .g365-round-matchups,
    .g365-round-matchups-2,
    .g365-round-matchups-3 {
      display: grid;
      gap: 12px;
      min-height: 0;
      padding: 12px 0 0;
    }

    .g365-playoff-info {
      grid-template-columns: minmax(0, 1fr);
    }
  }

  @media (max-width: 520px) {
    .g365-overview,
    .g365-seeds {
      grid-template-columns: minmax(0, 1fr);
    }

    .g365-champion {
      align-items: flex-start;
      flex-direction: column;
    }

    .g365-seed-card {
      grid-template-columns: 46px minmax(0, 1fr) auto;
    }

    .g365-category-header,
    .g365-category-row {
      grid-template-columns: minmax(0, 1fr) 58px 58px;
    }

    .g365-playoff-team-row {
      grid-template-columns: 30px minmax(0, 1fr) 48px;
    }
  }
`;