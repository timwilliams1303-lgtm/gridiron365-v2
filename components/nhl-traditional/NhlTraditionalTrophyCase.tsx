"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

type TrophyCaseProps = {
  leagueId: string;
};

type TrophyChampion = {
  franchiseId: string | null;
  teamName: string | null;
  regularSeasonRank: number | null;
  wins: number | null;
  losses: number | null;
  ties: number | null;
  pointsFor: number | null;
  pointsAgainst: number | null;
};

type TrophyRunnerUp = {
  franchiseId: string | null;
  teamName: string | null;
  regularSeasonRank: number | null;
};

type RegularSeasonChampion = {
  franchiseId: string | null;
  teamName: string | null;
};

type TrophySeason = {
  season: number;
  leagueId: string;
  leagueFormat: string;
  scoringSystem: string;
  champion: TrophyChampion | null;
  runnerUp: TrophyRunnerUp | null;
  regularSeasonChampion: RegularSeasonChampion | null;
  completedAt: string | null;
};

type TrophyFranchise = {
  franchiseId: string;
  teamName: string;
  championships: number;
  runnerUps: number;
  regularSeasonTitles: number;
  badgeCount: number;
  championshipSeasons: number[];
};

type TrophyBadge = {
  id: number;
  franchiseId: string;
  teamName: string;
  season: number;
  badgeKey: string;
  badgeName: string;
  description: string;
  category: string;
  icon: string;
  tier: string;
  value: number | null;
  detail: Record<string, unknown>;
  earnedAt: string | null;
};

type TrophyCaseResponse = {
  success: boolean;

  league: {
    leagueId: string;
    leagueName: string;
    currentSeason: number;
    historyId: string | null;
  };

  totalCompletedSeasons: number;
  totalBadges: number;

  seasons: TrophySeason[];
  franchises: TrophyFranchise[];
  badges: TrophyBadge[];
};

type DynastySeasonHistory = {
  season: number;
  teamName: string;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  regularSeasonRank: number | null;
  madePlayoffs: boolean;
  playoffFinish: string | null;
  playoffChampion: boolean;
  playoffRunnerUp: boolean;
  madeConsolation: boolean;
  consolationFinish: string | null;
  consolationChampion: boolean;
  consolationRunnerUp: boolean;
  leagueChampion: boolean;
};

type DynastyFranchiseHistory = {
  fantasyTeamId: number;
  franchiseId: string;
  currentTeamName: string;
  active: boolean;
  orphaned: boolean;
  currentOwnerId: string | null;
  seasonsPlayed: number;
  championships: number;
  playoffAppearances: number;
  consolationChampionships: number;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  firstArchivedSeason: number | null;
  latestArchivedSeason: number | null;
  seasonHistory: DynastySeasonHistory[];
};

type DynastyOwnershipPeriod = {
  historyId: number;
  fantasyTeamId: number;
  franchiseId: string;
  ownerUserId: string;
  startedAt: string | null;
  endedAt: string | null;
  currentOwner: boolean;
  changeReason: string | null;
};

type DynastyHistoryResponse = {
  success: boolean;
  leagueId: string;
  leagueFormat: string;
  firstArchivedSeason: number | null;
  latestArchivedSeason: number | null;
  completedSeasons: number;
  franchises: DynastyFranchiseHistory[];
  ownershipHistory: DynastyOwnershipPeriod[];
};

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function numberValue(value: unknown, fallback = 0): number {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return parsed;
}

function displayNumber(
  value: number | null | undefined,
  maximumFractionDigits = 2
): string {
  if (value === null || value === undefined) {
    return "—";
  }

  return Number(value).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  });
}

function displayRecord(
  wins: number | null | undefined,
  losses: number | null | undefined,
  ties: number | null | undefined
): string {
  if (
    wins === null ||
    wins === undefined ||
    losses === null ||
    losses === undefined
  ) {
    return "—";
  }

  const tieCount = ties ?? 0;

  if (tieCount > 0) {
    return `${wins}-${losses}-${tieCount}`;
  }

  return `${wins}-${losses}`;
}

function displayLeagueFormat(value: string | null | undefined): string {
  switch (String(value ?? "").toLowerCase()) {
    case "dynasty":
      return "Dynasty";

    case "keeper":
      return "Keeper";

    default:
      return "Redraft";
  }
}

function displayScoringSystem(
  value: string | null | undefined
): string {
  return String(value ?? "").toLowerCase() === "categories"
    ? "Categories"
    : "Points";
}

function displayDate(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function badgeTierLabel(tier: string): string {
  switch (tier.toLowerCase()) {
    case "legendary":
      return "LEGENDARY";

    case "elite":
      return "ELITE";

    case "gold":
      return "GOLD";

    case "silver":
      return "SILVER";

    default:
      return "ACHIEVEMENT";
  }
}

function badgeValueText(badge: TrophyBadge): string | null {
  const detail = badge.detail ?? {};

  switch (badge.badgeKey) {
    case "best_regular_season_record": {
      const wins = numberValue(detail.wins);
      const losses = numberValue(detail.losses);
      const ties = numberValue(detail.ties);

      return ties > 0
        ? `${wins}-${losses}-${ties}`
        : `${wins}-${losses}`;
    }

    case "highest_scoring_team":
      return detail.pointsFor !== undefined
        ? `${displayNumber(numberValue(detail.pointsFor))} PF`
        : null;

    case "lowest_points_against":
      return detail.pointsAgainst !== undefined
        ? `${displayNumber(numberValue(detail.pointsAgainst))} PA`
        : null;

    case "best_single_week":
      return detail.score !== undefined
        ? `Week ${numberValue(detail.week)} • ${displayNumber(
            numberValue(detail.score)
          )}`
        : null;

    case "biggest_blowout":
      return detail.margin !== undefined
        ? `Week ${numberValue(detail.week)} • +${displayNumber(
            numberValue(detail.margin)
          )}`
        : null;

    case "closest_win":
      return detail.margin !== undefined
        ? `Week ${numberValue(detail.week)} • ${displayNumber(
            numberValue(detail.margin)
          )}`
        : null;

    case "longest_winning_streak":
      return badge.value !== null
        ? `${displayNumber(badge.value, 0)} straight wins`
        : null;

    case "playoff_cinderella":
      return detail.championSeed !== undefined
        ? `#${numberValue(detail.championSeed)} Seed`
        : null;

    case "back_to_back_champion":
      return detail.previousSeason !== undefined
        ? `${numberValue(detail.previousSeason)} & ${badge.season}`
        : null;

    case "two_time_champion":
    case "three_time_champion":
    case "four_time_champion":
    case "five_time_champion":
    case "dynasty_champion":
    case "dynasty_legacy":
      return detail.championshipCount !== undefined
        ? `${numberValue(detail.championshipCount)} Championships`
        : null;

    default:
      return null;
  }
}

function BadgeCard({ badge }: { badge: TrophyBadge }) {
  const detailText = badgeValueText(badge);

  return (
    <article
      className={`badge-card badge-tier-${badge.tier.toLowerCase()}`}
    >
      <div className="badge-icon-shell">
        <span>{badge.icon}</span>
      </div>

      <div className="badge-body">
        <div className="badge-heading">
          <div>
            <div className="badge-tier">
              {badgeTierLabel(badge.tier)}
            </div>

            <h4>{badge.badgeName}</h4>
          </div>

          <span className="badge-season">{badge.season}</span>
        </div>

        <p>{badge.description}</p>

        {detailText ? (
          <div className="badge-detail">{detailText}</div>
        ) : null}

        <div className="badge-owner">{badge.teamName}</div>
      </div>
    </article>
  );
}

export default function NhlTraditionalTrophyCase({
  leagueId,
}: TrophyCaseProps) {
  const [data, setData] = useState<TrophyCaseResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [leagueFormat, setLeagueFormat] = useState<string>("redraft");
  const [dynastyHistory, setDynastyHistory] = useState<DynastyHistoryResponse | null>(null);

  const loadTrophyCase = useCallback(
    async (manualRefresh = false) => {
      if (manualRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError(null);

      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) {
          throw userError;
        }

        if (!user) {
          throw new Error(
            "You must be signed in to view this Trophy Case."
          );
        }

        const settingsResult = await supabase
          .from("nhl_traditional_settings")
          .select("league_format")
          .eq("league_id", leagueId)
          .single();

        if (settingsResult.error) {
          throw settingsResult.error;
        }

        const nextLeagueFormat = String(
          settingsResult.data?.league_format ?? "redraft"
        ).toLowerCase();

        setLeagueFormat(nextLeagueFormat);

        const { data: rpcData, error: rpcError } =
          await supabase.rpc("get_nhl_traditional_trophy_case", {
            p_league_id: leagueId,
          });

        if (rpcError) {
          throw rpcError;
        }

        if (nextLeagueFormat === "dynasty") {
          const historyResult = await supabase.rpc("get_nhl_dynasty_history", {
            p_league_id: leagueId,
          });

          if (historyResult.error) {
            throw historyResult.error;
          }

          setDynastyHistory(
            historyResult.data && typeof historyResult.data === "object"
              ? (historyResult.data as DynastyHistoryResponse)
              : null
          );
        } else {
          setDynastyHistory(null);
        }

        if (!rpcData || typeof rpcData !== "object") {
          throw new Error("The Trophy Case returned no data.");
        }

        const raw = rpcData as Partial<TrophyCaseResponse>;

        const normalized: TrophyCaseResponse = {
          success: raw.success !== false,

          league: {
            leagueId: String(raw.league?.leagueId ?? leagueId),

            leagueName: String(
              raw.league?.leagueName ??
                "NHL Traditional League"
            ),

            currentSeason: numberValue(
              raw.league?.currentSeason
            ),

            historyId: raw.league?.historyId
              ? String(raw.league.historyId)
              : null,
          },

          totalCompletedSeasons: numberValue(
            raw.totalCompletedSeasons
          ),

          totalBadges: numberValue(raw.totalBadges),

          seasons: Array.isArray(raw.seasons)
            ? (raw.seasons as TrophySeason[])
            : [],

          franchises: Array.isArray(raw.franchises)
            ? (raw.franchises as TrophyFranchise[])
            : [],

          badges: Array.isArray(raw.badges)
            ? (raw.badges as TrophyBadge[])
            : [],
        };

        setData(normalized);
      } catch (caughtError: unknown) {
        const errorDetails =
          caughtError && typeof caughtError === "object"
            ? {
                message:
                  "message" in caughtError
                    ? String(caughtError.message)
                    : null,
                details:
                  "details" in caughtError
                    ? String(caughtError.details)
                    : null,
                hint:
                  "hint" in caughtError
                    ? String(caughtError.hint)
                    : null,
                code:
                  "code" in caughtError
                    ? String(caughtError.code)
                    : null,
              }
            : {
                message: String(caughtError),
                details: null,
                hint: null,
                code: null,
              };

        console.error(
          "Failed to load NHL Traditional Trophy Case:",
          errorDetails
        );

        setError(
          [
            errorDetails.message,
            errorDetails.details,
            errorDetails.hint,
            errorDetails.code
              ? `Code: ${errorDetails.code}`
              : null,
          ]
            .filter(Boolean)
            .join(" — ") ||
            "Unable to load the Trophy Case."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [leagueId]
  );

  useEffect(() => {
    void loadTrophyCase();
  }, [loadTrophyCase]);

  const trophyBoard = useMemo(() => {
    if (!data) {
      return [];
    }

    return [...data.franchises].sort((a, b) => {
      const titles =
        numberValue(b.championships) -
        numberValue(a.championships);

      if (titles !== 0) {
        return titles;
      }

      const regularSeason =
        numberValue(b.regularSeasonTitles) -
        numberValue(a.regularSeasonTitles);

      if (regularSeason !== 0) {
        return regularSeason;
      }

      const badges =
        numberValue(b.badgeCount) -
        numberValue(a.badgeCount);

      if (badges !== 0) {
        return badges;
      }

      const runnerUps =
        numberValue(b.runnerUps) - numberValue(a.runnerUps);

      if (runnerUps !== 0) {
        return runnerUps;
      }

      return a.teamName.localeCompare(b.teamName);
    });
  }, [data]);

  const badgesByFranchise = useMemo(() => {
    const map = new Map<string, TrophyBadge[]>();

    if (!data) {
      return map;
    }

    for (const badge of data.badges) {
      const existing = map.get(badge.franchiseId) ?? [];
      existing.push(badge);
      map.set(badge.franchiseId, existing);
    }

    return map;
  }, [data]);

  const totalChampionships = useMemo(() => {
    if (!data) {
      return 0;
    }

    return data.franchises.reduce(
      (total, franchise) =>
        total + numberValue(franchise.championships),
      0
    );
  }, [data]);

  const championshipLeaderCount = useMemo(() => {
    if (!data || data.franchises.length === 0) {
      return 0;
    }

    return Math.max(
      0,
      ...data.franchises.map((franchise) =>
        numberValue(franchise.championships)
      )
    );
  }, [data]);

  const dynastyOwnershipCounts = useMemo(() => {
    const counts = new Map<number, number>();
    for (const period of dynastyHistory?.ownershipHistory ?? []) {
      counts.set(period.fantasyTeamId, (counts.get(period.fantasyTeamId) ?? 0) + 1);
    }
    return counts;
  }, [dynastyHistory]);

  const dynastyFranchises = useMemo(() => {
    return [...(dynastyHistory?.franchises ?? [])].sort((a, b) => {
      const titleDifference = numberValue(b.championships) - numberValue(a.championships);
      if (titleDifference !== 0) return titleDifference;
      const winsDifference = numberValue(b.wins) - numberValue(a.wins);
      if (winsDifference !== 0) return winsDifference;
      return a.currentTeamName.localeCompare(b.currentTeamName);
    });
  }, [dynastyHistory]);

  if (loading) {
    return (
      <main className="page-shell">
        <div className="loading-card">
          <div className="loading-flame" />

          <div>
            <strong>Loading Trophy Case</strong>

            <span>
              Building NHL Traditional league history...
            </span>
          </div>
        </div>

        <style jsx>{styles}</style>
      </main>
    );
  }

  if (error) {
    return (
      <main className="page-shell">
        <section className="error-card">
          <div className="kicker">NHL TRADITIONAL</div>

          <h1>Trophy Case</h1>

          <p>{error}</p>

          <div className="error-actions">
            <button
              type="button"
              className="primary-button"
              onClick={() => void loadTrophyCase()}
            >
              Try Again
            </button>

            <Link
              href={`/league/${leagueId}/nhl`}
              className="secondary-button"
            >
              NHL Home
            </Link>
          </div>
        </section>

        <style jsx>{styles}</style>
      </main>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <main className="page-shell">
      <section className="hero-card">
        <div className="hero-glow hero-glow-one" />
        <div className="hero-glow hero-glow-two" />

        <div className="hero-content">
          <div className="hero-nav">
            <Link
              href={`/league/${leagueId}/nhl`}
              className="back-link"
            >
              ← NHL Home
            </Link>

            <button
              type="button"
              className="refresh-button"
              onClick={() => void loadTrophyCase(true)}
              disabled={refreshing}
            >
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          <div className="kicker">NHL TRADITIONAL</div>

          <div className="hero-title-row">
            <div>
              <h1>Trophy Case</h1>
              <div className="league-name">
                {data.league.leagueName}
              </div>
            </div>

            <div className="hero-trophy">🏆</div>
          </div>

          <p className="hero-copy">
            Permanent league history, championships, franchise
            accomplishments, and earned GRIDIRON365 badges.
          </p>

          <div className="hero-stats">
            <div className="hero-stat">
              <span>Current Season</span>
              <strong>
                {data.league.currentSeason || "—"}
              </strong>
            </div>

            <div className="hero-stat">
              <span>Completed</span>
              <strong>{data.totalCompletedSeasons}</strong>
            </div>

            <div className="hero-stat">
              <span>Championships</span>
              <strong>{totalChampionships}</strong>
            </div>

            <div className="hero-stat">
              <span>Badges</span>
              <strong>{data.totalBadges}</strong>
            </div>
          </div>
        </div>
      </section>

      {data.seasons.length === 0 ? (
        <section className="empty-card">
          <div className="empty-icon">🏆</div>

          <div className="kicker">THE HISTORY STARTS HERE</div>

          <h2>No completed seasons yet</h2>

          <p>
            The {data.league.currentSeason || "current"} NHL
            Traditional season has not produced a champion yet.
            When the championship is finalized, GRIDIRON365 will
            automatically preserve the champion, runner-up,
            regular-season champion, franchise accomplishments,
            and earned badges here.
          </p>

          <div className="empty-note">
            Redraft history remains preserved when rosters reset.
            Dynasty history follows the permanent franchise across
            future seasons.
          </div>
        </section>
      ) : (
        <>
          <section className="section-card">
            <div className="section-header">
              <div>
                <div className="kicker">HALL OF CHAMPIONS</div>
                <h2>Championship History</h2>
              </div>

              <div className="section-count">
                {data.totalCompletedSeasons} completed
              </div>
            </div>

            <div className="champion-grid">
              {data.seasons.map((season) => (
                <article
                  key={`${season.leagueId}-${season.season}`}
                  className="champion-card"
                >
                  <div className="champion-card-top">
                    <div>
                      <div className="season-label">
                        {season.season} CHAMPION
                      </div>

                      <h3>
                        {season.champion?.teamName ??
                          "League Champion"}
                      </h3>
                    </div>

                    <div className="champion-icon">🏆</div>
                  </div>

                  <div className="format-row">
                    <span>
                      {displayLeagueFormat(
                        season.leagueFormat
                      )}
                    </span>

                    <span>
                      {displayScoringSystem(
                        season.scoringSystem
                      )}
                    </span>
                  </div>

                  <div className="champion-metrics">
                    <div>
                      <span>Record</span>

                      <strong>
                        {displayRecord(
                          season.champion?.wins,
                          season.champion?.losses,
                          season.champion?.ties
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>Seed</span>

                      <strong>
                        {season.champion?.regularSeasonRank
                          ? `#${season.champion.regularSeasonRank}`
                          : "—"}
                      </strong>
                    </div>

                    <div>
                      <span>Points For</span>

                      <strong>
                        {displayNumber(
                          season.champion?.pointsFor
                        )}
                      </strong>
                    </div>
                  </div>

                  <div className="champion-details">
                    <div>
                      <span>Runner-Up</span>

                      <strong>
                        {season.runnerUp?.teamName ?? "—"}
                      </strong>
                    </div>

                    <div>
                      <span>Regular Season Champion</span>

                      <strong>
                        {season.regularSeasonChampion
                          ?.teamName ?? "—"}
                      </strong>
                    </div>

                    <div>
                      <span>Completed</span>

                      <strong>
                        {displayDate(season.completedAt)}
                      </strong>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="section-card">
            <div className="section-header">
              <div>
                <div className="kicker">
                  FRANCHISE LEGACY
                </div>

                <h2>All-Time Trophy Board</h2>
              </div>
            </div>

            <div className="trophy-board">
              {trophyBoard.map((franchise, index) => {
                const titles = numberValue(
                  franchise.championships
                );

                const titleLeader =
                  titles > 0 &&
                  titles === championshipLeaderCount;

                return (
                  <article
                    className="trophy-row"
                    key={franchise.franchiseId}
                  >
                    <div className="rank-box">
                      {index + 1}
                    </div>

                    <div className="team-cell">
                      <div className="team-title-row">
                        <strong>{franchise.teamName}</strong>

                        {titleLeader ? (
                          <span className="leader-chip">
                            TITLE LEADER
                          </span>
                        ) : null}
                      </div>

                      <div className="title-years">
                        {franchise.championshipSeasons
                          ?.length > 0
                          ? `Champions: ${franchise.championshipSeasons.join(
                              ", "
                            )}`
                          : "No championships yet"}
                      </div>
                    </div>

                    <div className="board-stat title-stat">
                      <span>Titles</span>

                      <strong>
                        {franchise.championships}
                      </strong>
                    </div>

                    <div className="board-stat">
                      <span>Runner-Up</span>

                      <strong>{franchise.runnerUps}</strong>
                    </div>

                    <div className="board-stat">
                      <span>Reg. Season</span>

                      <strong>
                        {franchise.regularSeasonTitles}
                      </strong>
                    </div>

                    <div className="board-stat">
                      <span>Badges</span>

                      <strong>{franchise.badgeCount}</strong>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          {leagueFormat === "dynasty" && dynastyHistory ? (
            <section className="section-card dynasty-history-card">
              <div className="section-header">
                <div>
                  <div className="kicker">DYNASTY FRANCHISE HISTORY</div>
                  <h2>Permanent Franchise Records</h2>
                </div>
                <div className="section-count">
                  {dynastyHistory.completedSeasons} archived {dynastyHistory.completedSeasons === 1 ? "season" : "seasons"}
                </div>
              </div>

              <p className="dynasty-history-copy">
                Dynasty history stays with the permanent franchise when ownership changes. Historical team names are preserved by season, while rosters, future picks, records, and championships continue with the franchise.
              </p>

              {dynastyFranchises.length === 0 ? (
                <div className="no-badges">No completed Dynasty franchise seasons have been archived yet.</div>
              ) : (
                <div className="dynasty-franchise-grid">
                  {dynastyFranchises.map((franchise) => {
                    const ownershipCount = dynastyOwnershipCounts.get(franchise.fantasyTeamId) ?? 0;
                    const seasons = [...(franchise.seasonHistory ?? [])].sort((a, b) => b.season - a.season);

                    return (
                      <article className="dynasty-franchise-card" key={franchise.franchiseId}>
                        <div className="dynasty-franchise-head">
                          <div>
                            <div className="dynasty-franchise-eyebrow">PERMANENT FRANCHISE</div>
                            <h3>{franchise.currentTeamName}</h3>
                          </div>
                          <span className={franchise.orphaned ? "orphan-chip" : "active-chip"}>
                            {franchise.orphaned ? "ORPHANED" : "OWNED"}
                          </span>
                        </div>

                        <div className="dynasty-career-grid">
                          <div><span>Career Record</span><strong>{displayRecord(franchise.wins, franchise.losses, franchise.ties)}</strong></div>
                          <div><span>Titles</span><strong>{franchise.championships}</strong></div>
                          <div><span>Playoffs</span><strong>{franchise.playoffAppearances}</strong></div>
                          <div><span>Seasons</span><strong>{franchise.seasonsPlayed}</strong></div>
                        </div>

                        <div className="dynasty-franchise-meta">
                          <span>{displayNumber(franchise.pointsFor)} career PF</span>
                          <span>{ownershipCount} ownership {ownershipCount === 1 ? "period" : "periods"}</span>
                          {franchise.firstArchivedSeason ? (
                            <span>{franchise.firstArchivedSeason}{franchise.latestArchivedSeason && franchise.latestArchivedSeason !== franchise.firstArchivedSeason ? `–${franchise.latestArchivedSeason}` : ""}</span>
                          ) : null}
                        </div>

                        <div className="dynasty-season-list">
                          {seasons.map((season) => (
                            <div className="dynasty-season-row" key={`${franchise.franchiseId}-${season.season}`}>
                              <div className="dynasty-season-main">
                                <strong>{season.season}</strong>
                                <span>{season.teamName}</span>
                              </div>
                              <div className="dynasty-season-record">
                                <strong>{displayRecord(season.wins, season.losses, season.ties)}</strong>
                                <span>{season.regularSeasonRank ? `#${season.regularSeasonRank} Regular Season` : "Regular Season"}</span>
                              </div>
                              <div className="dynasty-season-result">
                                {season.leagueChampion ? (
                                  <span className="season-title-chip">🏆 CHAMPION</span>
                                ) : season.playoffRunnerUp ? (
                                  <span className="season-result-chip">RUNNER-UP</span>
                                ) : season.madePlayoffs ? (
                                  <span className="season-result-chip">PLAYOFFS</span>
                                ) : season.consolationChampion ? (
                                  <span className="season-result-chip">CONSOLATION CHAMP</span>
                                ) : (
                                  <span className="season-muted-chip">SEASON COMPLETE</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          ) : null}

          <section className="section-card">
            <div className="section-header">
              <div>
                <div className="kicker">
                  GRIDIRON365 ACHIEVEMENTS
                </div>

                <h2>Badge Cabinet</h2>
              </div>

              <div className="section-count">
                {data.totalBadges} earned
              </div>
            </div>

            {data.badges.length === 0 ? (
              <div className="no-badges">
                No badges have been recorded yet.
              </div>
            ) : (
              <div className="franchise-badge-sections">
                {trophyBoard
                  .filter(
                    (franchise) =>
                      (
                        badgesByFranchise.get(
                          franchise.franchiseId
                        ) ?? []
                      ).length > 0
                  )
                  .map((franchise) => {
                    const franchiseBadges =
                      badgesByFranchise.get(
                        franchise.franchiseId
                      ) ?? [];

                    return (
                      <section
                        key={franchise.franchiseId}
                        className="franchise-badge-group"
                      >
                        <div className="franchise-badge-header">
                          <div>
                            <span>FRANCHISE</span>
                            <h3>{franchise.teamName}</h3>
                          </div>

                          <div className="badge-total">
                            {franchiseBadges.length}{" "}
                            {franchiseBadges.length === 1
                              ? "Badge"
                              : "Badges"}
                          </div>
                        </div>

                        <div className="badge-grid">
                          {franchiseBadges.map((badge) => (
                            <BadgeCard
                              key={badge.id}
                              badge={badge}
                            />
                          ))}
                        </div>
                      </section>
                    );
                  })}
              </div>
            )}
          </section>
        </>
      )}

      <style jsx>{styles}</style>
    </main>
  );
}

const styles = `
  .page-shell {
    min-height: 100vh;
    padding: 18px;
    color: #ffffff;
    background:
      radial-gradient(
        circle at top right,
        rgba(255, 90, 31, 0.09),
        transparent 28%
      ),
      #09090a;
  }

  .hero-card,
  .section-card,
  .empty-card,
  .loading-card,
  .error-card {
    width: 100%;
    max-width: 1180px;
    margin-left: auto;
    margin-right: auto;
  }

  .hero-card {
    position: relative;
    overflow: hidden;
    border: 1px solid rgba(255, 106, 0, 0.34);
    border-radius: 22px;
    background:
      linear-gradient(
        135deg,
        rgba(255, 90, 31, 0.14),
        rgba(17, 17, 19, 0.97) 42%,
        #111113
      );
    box-shadow:
      0 24px 65px rgba(0, 0, 0, 0.38),
      inset 0 1px 0 rgba(255, 255, 255, 0.04);
  }

  .hero-content {
    position: relative;
    z-index: 2;
    padding: 26px;
  }

  .hero-glow {
    position: absolute;
    border-radius: 999px;
    filter: blur(70px);
    opacity: 0.22;
  }

  .hero-glow-one {
    width: 270px;
    height: 270px;
    right: -80px;
    top: -110px;
    background: #ff5a1f;
  }

  .hero-glow-two {
    width: 180px;
    height: 180px;
    left: 18%;
    bottom: -130px;
    background: #ff7b31;
  }

  .hero-nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 28px;
  }

  .back-link {
    color: #f4f4f5;
    text-decoration: none;
    font-size: 14px;
    font-weight: 900;
  }

  .back-link:hover {
    color: #ff7b31;
  }

  .refresh-button {
    min-height: 42px;
    padding: 9px 14px;
    border: 1px solid rgba(255, 123, 49, 0.45);
    border-radius: 12px;
    background: rgba(255, 106, 0, 0.08);
    color: #ff9a61;
    font-weight: 900;
    cursor: pointer;
  }

  .refresh-button:disabled {
    opacity: 0.55;
    cursor: default;
  }

  .kicker,
  .season-label {
    color: #ff7b31;
    font-size: 11px;
    font-weight: 1000;
    letter-spacing: 0.16em;
  }

  .hero-title-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
  }

  h1 {
    margin: 7px 0 0;
    font-size: clamp(36px, 7vw, 60px);
    line-height: 0.98;
    letter-spacing: -0.045em;
  }

  .league-name {
    margin-top: 10px;
    font-size: 20px;
    font-weight: 900;
  }

  .hero-trophy {
    font-size: clamp(52px, 9vw, 88px);
    filter: drop-shadow(
      0 10px 20px rgba(255, 106, 0, 0.22)
    );
  }

  .hero-copy {
    max-width: 700px;
    margin: 12px 0 0;
    color: #a1a1aa;
    font-size: 14px;
    line-height: 1.65;
  }

  .hero-stats {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 10px;
    margin-top: 24px;
  }

  .hero-stat {
    padding: 13px;
    border: 1px solid #29292d;
    border-radius: 14px;
    background: rgba(8, 8, 9, 0.7);
  }

  .hero-stat span {
    display: block;
    color: #85858d;
    font-size: 10px;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .hero-stat strong {
    display: block;
    margin-top: 5px;
    font-size: 23px;
  }

  .section-card {
    margin-top: 18px;
    padding: 22px;
    border: 1px solid #27272a;
    border-radius: 20px;
    background: #111113;
  }

  .section-header {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 18px;
  }

  .section-header h2,
  .empty-card h2 {
    margin: 5px 0 0;
    font-size: 25px;
    letter-spacing: -0.025em;
  }

  .section-count {
    color: #8d8d96;
    font-size: 12px;
    font-weight: 900;
  }

  .champion-grid {
    display: grid;
    grid-template-columns:
      repeat(auto-fit, minmax(min(100%, 320px), 1fr));
    gap: 14px;
  }

  .champion-card {
    overflow: hidden;
    border: 1px solid rgba(255, 106, 0, 0.3);
    border-radius: 18px;
    background:
      linear-gradient(
        145deg,
        rgba(255, 106, 0, 0.08),
        #0d0d0f 38%
      );
  }

  .champion-card-top {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    padding: 18px 18px 10px;
  }

  .champion-card-top h3 {
    margin: 5px 0 0;
    font-size: 23px;
    line-height: 1.1;
  }

  .champion-icon {
    font-size: 34px;
  }

  .format-row {
    display: flex;
    flex-wrap: wrap;
    gap: 7px;
    padding: 0 18px 15px;
  }

  .format-row span {
    padding: 5px 9px;
    border: 1px solid #343438;
    border-radius: 999px;
    background: #171719;
    color: #c7c7cd;
    font-size: 10px;
    font-weight: 900;
    text-transform: uppercase;
  }

  .champion-metrics {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    border-top: 1px solid #27272a;
    border-bottom: 1px solid #27272a;
  }

  .champion-metrics > div {
    padding: 13px 8px;
    text-align: center;
  }

  .champion-metrics > div + div {
    border-left: 1px solid #27272a;
  }

  .champion-metrics span,
  .board-stat span {
    display: block;
    color: #85858d;
    font-size: 9px;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .champion-metrics strong {
    display: block;
    margin-top: 4px;
    font-size: 16px;
  }

  .champion-details {
    padding: 9px 18px 14px;
  }

  .champion-details > div {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    padding: 9px 0;
    border-bottom: 1px solid #202023;
  }

  .champion-details > div:last-child {
    border-bottom: 0;
  }

  .champion-details span {
    color: #8d8d96;
    font-size: 12px;
  }

  .champion-details strong {
    text-align: right;
    font-size: 12px;
  }

  .trophy-board {
    display: grid;
    gap: 8px;
  }

  .trophy-row {
    display: grid;
    grid-template-columns:
      44px minmax(0, 1fr) repeat(4, 88px);
    align-items: center;
    gap: 10px;
    padding: 12px;
    border: 1px solid #29292d;
    border-radius: 14px;
    background: #0c0c0e;
  }

  .rank-box {
    display: grid;
    place-items: center;
    width: 34px;
    height: 34px;
    border-radius: 10px;
    background: #19191c;
    color: #ff7b31;
    font-size: 14px;
    font-weight: 1000;
  }

  .team-title-row {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
  }

  .team-title-row strong {
    font-size: 14px;
  }

  .leader-chip {
    padding: 3px 7px;
    border: 1px solid rgba(255, 106, 0, 0.45);
    border-radius: 999px;
    background: rgba(255, 106, 0, 0.09);
    color: #ff8b4b;
    font-size: 8px;
    font-weight: 1000;
    letter-spacing: 0.06em;
  }

  .title-years {
    margin-top: 4px;
    color: #777780;
    font-size: 10px;
  }

  .board-stat {
    text-align: center;
  }

  .board-stat strong {
    display: block;
    margin-top: 3px;
    font-size: 17px;
  }

  .title-stat strong {
    color: #ff7b31;
  }

  .dynasty-history-card {
    border-color: rgba(255, 106, 0, 0.34);
    background: linear-gradient(180deg, rgba(255, 90, 31, 0.045), #111113 180px);
  }

  .dynasty-history-copy {
    max-width: 850px;
    margin: -4px 0 18px;
    color: #a1a1aa;
    font-size: 12px;
    line-height: 1.6;
  }

  .dynasty-franchise-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 440px), 1fr));
    gap: 12px;
  }

  .dynasty-franchise-card {
    min-width: 0;
    overflow: hidden;
    border: 1px solid #2c2c30;
    border-radius: 16px;
    background: #0c0c0e;
  }

  .dynasty-franchise-head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
    padding: 16px;
    border-bottom: 1px solid #252528;
  }

  .dynasty-franchise-eyebrow {
    color: #ff7b31;
    font-size: 8px;
    font-weight: 1000;
    letter-spacing: .12em;
  }

  .dynasty-franchise-head h3 {
    margin: 4px 0 0;
    font-size: 19px;
  }

  .orphan-chip,
  .active-chip,
  .season-title-chip,
  .season-result-chip,
  .season-muted-chip {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 5px 8px;
    border-radius: 999px;
    font-size: 8px;
    font-weight: 1000;
    letter-spacing: .05em;
    white-space: nowrap;
  }

  .orphan-chip {
    border: 1px solid rgba(255, 106, 0, .45);
    background: rgba(255, 90, 31, .09);
    color: #ff8b4b;
  }

  .active-chip {
    border: 1px solid rgba(70, 220, 130, .28);
    background: rgba(30, 140, 80, .12);
    color: #79e6a6;
  }

  .dynasty-career-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    border-bottom: 1px solid #252528;
  }

  .dynasty-career-grid > div {
    min-width: 0;
    padding: 12px 8px;
    text-align: center;
  }

  .dynasty-career-grid > div + div {
    border-left: 1px solid #252528;
  }

  .dynasty-career-grid span {
    display: block;
    color: #777780;
    font-size: 8px;
    font-weight: 900;
    text-transform: uppercase;
  }

  .dynasty-career-grid strong {
    display: block;
    margin-top: 4px;
    font-size: 15px;
  }

  .dynasty-franchise-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    padding: 10px 14px;
    border-bottom: 1px solid #252528;
  }

  .dynasty-franchise-meta span {
    padding: 4px 7px;
    border: 1px solid #2d2d31;
    border-radius: 999px;
    color: #a1a1aa;
    font-size: 9px;
  }

  .dynasty-season-list {
    display: grid;
  }

  .dynasty-season-row {
    display: grid;
    grid-template-columns: minmax(120px, 1fr) minmax(115px, auto) minmax(110px, auto);
    gap: 10px;
    align-items: center;
    padding: 11px 14px;
  }

  .dynasty-season-row + .dynasty-season-row {
    border-top: 1px solid #222225;
  }

  .dynasty-season-main,
  .dynasty-season-record {
    display: flex;
    flex-direction: column;
    min-width: 0;
    gap: 3px;
  }

  .dynasty-season-main strong {
    color: #ff7b31;
    font-size: 12px;
  }

  .dynasty-season-main span,
  .dynasty-season-record span {
    overflow: hidden;
    color: #85858d;
    font-size: 9px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .dynasty-season-record strong {
    font-size: 11px;
  }

  .dynasty-season-result {
    text-align: right;
  }

  .season-title-chip {
    border: 1px solid rgba(255, 123, 49, .48);
    background: rgba(255, 106, 0, .1);
    color: #ff9a61;
  }

  .season-result-chip {
    border: 1px solid #343438;
    background: #171719;
    color: #c7c7cd;
  }

  .season-muted-chip {
    border: 1px solid #29292d;
    background: #121214;
    color: #777780;
  }

  .franchise-badge-sections {
    display: grid;
    gap: 22px;
  }

  .franchise-badge-group {
    padding-top: 4px;
  }

  .franchise-badge-group + .franchise-badge-group {
    padding-top: 22px;
    border-top: 1px solid #29292d;
  }

  .franchise-badge-header {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 14px;
    margin-bottom: 12px;
  }

  .franchise-badge-header span {
    color: #777780;
    font-size: 9px;
    font-weight: 1000;
    letter-spacing: 0.1em;
  }

  .franchise-badge-header h3 {
    margin: 3px 0 0;
    font-size: 19px;
  }

  .badge-total {
    color: #a1a1aa;
    font-size: 11px;
    font-weight: 900;
  }

  .badge-grid {
    display: grid;
    grid-template-columns:
      repeat(auto-fit, minmax(min(100%, 265px), 1fr));
    gap: 10px;
  }

  .badge-card {
    display: flex;
    gap: 12px;
    min-width: 0;
    padding: 14px;
    border: 1px solid #303034;
    border-radius: 15px;
    background: #0c0c0e;
  }

  .badge-tier-gold {
    border-color: rgba(255, 169, 44, 0.42);
    background:
      linear-gradient(
        135deg,
        rgba(255, 164, 32, 0.08),
        #0c0c0e 45%
      );
  }

  .badge-tier-silver {
    border-color: rgba(205, 210, 218, 0.35);
  }

  .badge-tier-elite {
    border-color: rgba(255, 106, 0, 0.5);
    background:
      linear-gradient(
        135deg,
        rgba(255, 90, 31, 0.1),
        #0c0c0e 48%
      );
  }

  .badge-tier-legendary {
    border-color: rgba(255, 123, 49, 0.75);
    background:
      radial-gradient(
        circle at top left,
        rgba(255, 106, 0, 0.15),
        transparent 42%
      ),
      #0c0c0e;
    box-shadow:
      inset 0 0 28px rgba(255, 90, 31, 0.05);
  }

  .badge-icon-shell {
    display: grid;
    flex: 0 0 auto;
    place-items: center;
    width: 48px;
    height: 48px;
    border: 1px solid #333337;
    border-radius: 14px;
    background: #18181b;
  }

  .badge-icon-shell span {
    font-size: 25px;
  }

  .badge-body {
    min-width: 0;
    flex: 1;
  }

  .badge-heading {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 8px;
  }

  .badge-tier {
    color: #ff7b31;
    font-size: 8px;
    font-weight: 1000;
    letter-spacing: 0.09em;
  }

  .badge-heading h4 {
    margin: 3px 0 0;
    font-size: 14px;
  }

  .badge-season {
    flex: 0 0 auto;
    padding: 3px 6px;
    border-radius: 7px;
    background: #1c1c1f;
    color: #a1a1aa;
    font-size: 9px;
    font-weight: 900;
  }

  .badge-body p {
    margin: 7px 0 0;
    color: #85858d;
    font-size: 10px;
    line-height: 1.45;
  }

  .badge-detail {
    margin-top: 8px;
    color: #ff9a61;
    font-size: 10px;
    font-weight: 900;
  }

  .badge-owner {
    margin-top: 7px;
    color: #d4d4d8;
    font-size: 10px;
    font-weight: 800;
  }

  .empty-card {
    margin-top: 18px;
    padding: 44px 24px;
    border: 1px solid rgba(255, 106, 0, 0.25);
    border-radius: 20px;
    background: #111113;
    text-align: center;
  }

  .empty-icon {
    margin-bottom: 12px;
    font-size: 54px;
  }

  .empty-card p {
    max-width: 680px;
    margin: 13px auto 0;
    color: #a1a1aa;
    font-size: 14px;
    line-height: 1.65;
  }

  .empty-note {
    max-width: 680px;
    margin: 20px auto 0;
    padding: 12px;
    border: 1px solid #29292d;
    border-radius: 12px;
    background: #0c0c0e;
    color: #777780;
    font-size: 11px;
    line-height: 1.5;
  }

  .no-badges {
    padding: 24px;
    border: 1px dashed #343438;
    border-radius: 14px;
    color: #85858d;
    text-align: center;
    font-size: 13px;
  }

  .loading-card,
  .error-card {
    margin-top: 24px;
    padding: 24px;
    border: 1px solid #29292d;
    border-radius: 20px;
    background: #111113;
  }

  .loading-card {
    display: flex;
    align-items: center;
    gap: 15px;
  }

  .loading-card strong,
  .loading-card span {
    display: block;
  }

  .loading-card span {
    margin-top: 3px;
    color: #85858d;
    font-size: 12px;
  }

  .loading-flame {
    width: 18px;
    height: 38px;
    border-radius: 70% 30% 70% 30%;
    background:
      linear-gradient(
        180deg,
        #ffb05f,
        #ff6a00 55%,
        #ff3b00
      );
    transform: rotate(12deg);
    animation:
      flamePulse 0.85s ease-in-out infinite alternate;
  }

  @keyframes flamePulse {
    from {
      transform: rotate(12deg) scale(0.92);
      opacity: 0.7;
    }

    to {
      transform: rotate(12deg) scale(1.08);
      opacity: 1;
    }
  }

  .error-card h1 {
    margin: 6px 0 0;
  }

  .error-card p {
    color: #a1a1aa;
  }

  .error-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-top: 18px;
  }

  .primary-button,
  .secondary-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 42px;
    padding: 10px 15px;
    border-radius: 12px;
    font-weight: 900;
    text-decoration: none;
  }

  .primary-button {
    border: 0;
    background:
      linear-gradient(
        135deg,
        #ff5a1f,
        #ff7b31
      );
    color: #ffffff;
    cursor: pointer;
  }

  .secondary-button {
    border: 1px solid #343438;
    background: #171719;
    color: #ffffff;
  }

  @media (max-width: 780px) {
    .page-shell {
      width: 100%;
      max-width: 100%;
      min-width: 0;
      padding: 10px;
      overflow-x: hidden;
    }

    .page-shell *,
    .page-shell > * {
      min-width: 0;
      max-width: 100%;
    }

    .badge-card,
    .dynasty-season-row,
    .trophy-row,
    .section-card {
      overflow-wrap: anywhere;
    }

    .hero-content,
    .section-card {
      padding: 16px;
    }

    .hero-card {
      border-radius: 18px;
    }

    .dynasty-career-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .dynasty-career-grid > div:nth-child(3) {
      border-left: 0;
      border-top: 1px solid #252528;
    }

    .dynasty-career-grid > div:nth-child(4) {
      border-top: 1px solid #252528;
    }

    .dynasty-season-row {
      grid-template-columns: minmax(0, 1fr) auto;
    }

    .dynasty-season-result {
      grid-column: 1 / -1;
      text-align: left;
    }

    .hero-trophy {
      font-size: 52px;
    }

    .hero-stats {
      grid-template-columns: repeat(2, 1fr);
    }

    .trophy-row {
      grid-template-columns:
        36px minmax(0, 1fr);
    }

    .rank-box {
      width: 32px;
      height: 32px;
    }

    .board-stat {
      padding-top: 9px;
      border-top: 1px solid #242427;
    }

    .trophy-row .board-stat:nth-of-type(1),
    .trophy-row .board-stat:nth-of-type(3) {
      grid-column: 1 / 2;
    }

    .trophy-row .board-stat:nth-of-type(2),
    .trophy-row .board-stat:nth-of-type(4) {
      grid-column: 2 / 3;
    }
  }

  @media (max-width: 520px) {
    .hero-title-row {
      align-items: flex-start;
    }

    .hero-trophy {
      font-size: 42px;
    }

    .section-header,
    .franchise-badge-header {
      align-items: flex-start;
    }

    .champion-metrics {
      grid-template-columns: 1fr;
    }

    .champion-metrics > div {
      display: flex;
      align-items: center;
      justify-content: space-between;
      text-align: left;
      padding: 11px 14px;
    }

    .champion-metrics > div + div {
      border-top: 1px solid #27272a;
      border-left: 0;
    }

    .champion-metrics strong {
      margin-top: 0;
    }

    .champion-details > div {
      align-items: flex-start;
    }

    .badge-card {
      padding: 12px;
    }

    .badge-icon-shell {
      width: 43px;
      height: 43px;
    }
  }
`;