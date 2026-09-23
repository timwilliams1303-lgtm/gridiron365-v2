"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

type Props = {
  leagueId: string;
};

type LeagueInfo = {
  leagueId: string;
  leagueName: string;
  season: number;
  currentLeagueSeason: number;
  leagueFormat: string | null;
  scoringSystem: string | null;
  regularSeasonWeeks: number | null;
  playoffTeamCount: number | null;
  playoffWeeks: number | null;
};

type Championship = {
  bracketId: number | null;
  bracketStatus: string | null;
  championTeamId: number | null;
  championTeamName: string | null;
  runnerUpTeamId: number | null;
  runnerUpTeamName: string | null;
};

type RegularSeasonChampion = {
  fantasyTeamId: number;
  teamName: string;
};

type TeamRecord = {
  fantasyTeamId: number;
  teamName: string;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  pointDifferential: number;
};

type PlayoffMatchup = {
  matchupId: number;
  playoffWeek: number;
  roundNumber: number;
  roundName: string;
  matchupNumber: number;

  homeSeed: number | null;
  awaySeed: number | null;

  homeTeamId: number | null;
  homeTeamName: string | null;

  awayTeamId: number | null;
  awayTeamName: string | null;

  homeScore: number | null;
  awayScore: number | null;

  winnerTeamId: number | null;
  winnerTeamName: string | null;

  loserTeamId: number | null;
  loserTeamName: string | null;

  isTie: boolean;
  isBye: boolean;
  status: string | null;

  scoringSystem: string | null;

  homeScoringBreakdown: Record<string, unknown> | null;
  awayScoringBreakdown: Record<string, unknown> | null;

  homeGoalieStarts: number;
  awayGoalieStarts: number;

  homeGoalieMinimumMet: boolean | null;
  awayGoalieMinimumMet: boolean | null;

  completedAt: string | null;
};

type WeekAward = {
  week: number;
  fantasyTeamId: number;
  teamName: string;
  score: number;
};

type MatchupAward = {
  matchupId: number;
  week: number;

  homeTeamId: number;
  homeTeamName: string;
  homeScore: number;

  awayTeamId: number;
  awayTeamName: string;
  awayScore: number;

  margin: number;

  winnerTeamId: number | null;
  winnerTeamName: string | null;

  isTie?: boolean;
};

type Awards = {
  bestWeek: WeekAward | null;
  worstWeek: WeekAward | null;
  biggestBlowout: MatchupAward | null;
  closestMatchup: MatchupAward | null;
};

type RecapCounts = {
  completedRegularSeasonMatchups: number;
  completedPlayoffMatchups: number;
};

type RecapData = {
  success: boolean;
  league: LeagueInfo;
  seasonComplete: boolean;
  championship: Championship;
  regularSeasonChampion: RegularSeasonChampion | null;
  standings: unknown;
  teamRecords: TeamRecord[];
  playoffs: PlayoffMatchup[];
  awards: Awards;
  counts: RecapCounts;
};

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function n(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function title(value: string | null | undefined) {
  return (value ?? "—")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function score(value: number | null | undefined) {
  if (value == null) return "—";

  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return "—";
  }

  return numberValue.toFixed(1);
}

function record(team: TeamRecord) {
  return `${team.wins}-${team.losses}-${team.ties}`;
}

function teamName(
  value: string | null | undefined,
  fallback = "TBD"
) {
  const cleaned = value?.trim();
  return cleaned ? cleaned : fallback;
}

export default function NhlTraditionalRecap({
  leagueId,
}: Props) {
  const [recap, setRecap] = useState<RecapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

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
          "You must be signed in to view the NHL Traditional recap."
        );
      }

      const { data: settingData, error: settingError } =
        await supabase
          .from("nhl_traditional_settings")
          .select("season")
          .eq("league_id", leagueId)
          .maybeSingle();

      if (settingError) {
        throw settingError;
      }

      if (!settingData) {
        throw new Error(
          "NHL Traditional settings were not found."
        );
      }

      const season = n(settingData.season);

      if (!season) {
        throw new Error(
          "The NHL Traditional season could not be determined."
        );
      }

      const { data, error: rpcError } = await supabase.rpc(
        "get_nhl_traditional_season_recap",
        {
          p_league_id: leagueId,
          p_season: season,
        }
      );

      if (rpcError) {
        throw rpcError;
      }

      if (!data) {
        throw new Error("The season recap returned no data.");
      }

      setRecap(data as RecapData);
    } catch (e) {
      setRecap(null);

      setError(
        e instanceof Error
          ? e.message
          : "Unable to load NHL Traditional recap."
      );
    } finally {
      setLoading(false);
    }
  }, [leagueId]);

  useEffect(() => {
    void load();
  }, [load]);

  const teamRecords = useMemo(() => {
    return [...(recap?.teamRecords ?? [])].sort((a, b) => {
      if (b.wins !== a.wins) {
        return b.wins - a.wins;
      }

      if (b.ties !== a.ties) {
        return b.ties - a.ties;
      }

      if (b.pointsFor !== a.pointsFor) {
        return b.pointsFor - a.pointsFor;
      }

      return a.teamName.localeCompare(b.teamName);
    });
  }, [recap]);

  const playoffRounds = useMemo(() => {
    const map = new Map<number, PlayoffMatchup[]>();

    for (const matchup of recap?.playoffs ?? []) {
      const round = n(matchup.roundNumber);

      const current = map.get(round) ?? [];
      current.push(matchup);

      map.set(round, current);
    }

    return [...map.entries()]
      .sort(([a], [b]) => a - b)
      .map(([roundNumber, matchups]) => ({
        roundNumber,
        roundName:
          matchups[0]?.roundName ??
          `Round ${roundNumber}`,
        matchups: [...matchups].sort(
          (a, b) => a.matchupNumber - b.matchupNumber
        ),
      }));
  }, [recap]);

  const champion = recap?.championship;
  const awards = recap?.awards;

  const hasChampion =
    champion?.championTeamId != null &&
    Boolean(champion.championTeamName);

  if (loading) {
    return (
      <main style={S.page}>
        <div style={S.shell}>
          <div style={S.loading}>
            Loading NHL season recap…
          </div>
        </div>
      </main>
    );
  }

  return (
    <main
      className="g365-nhl-recap-page"
      style={S.page}
    >
      <style>{`
        .g365-recap-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 10px;
        }

        .g365-recap-two {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }

        .g365-recap-awards {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 8px;
        }

        .g365-recap-rounds {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
          align-items: start;
        }

        .g365-recap-team-row:hover {
          background: #17191c !important;
        }

        .g365-recap-team-link:hover {
          color: #ff7b31 !important;
        }

        @media (max-width: 900px) {
          .g365-recap-grid,
          .g365-recap-awards {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .g365-recap-rounds {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 650px) {
          .g365-nhl-recap-page {
            width: 100% !important;
            max-width: 100% !important;
            min-width: 0 !important;
            padding: 8px 5px 40px !important;
            overflow-x: hidden !important;
          }

          .g365-nhl-recap-page *,
          .g365-nhl-recap-page > * {
            min-width: 0;
            max-width: 100%;
          }

          .g365-recap-mobile-redundant-nav {
            display: none !important;
          }

          .g365-recap-hero {
            padding: 14px 12px !important;
          }

          .g365-recap-champion {
            padding: 18px 14px !important;
          }

          .g365-recap-grid,
          .g365-recap-two,
          .g365-recap-awards {
            grid-template-columns: 1fr;
          }

          .g365-recap-record-header {
            display: none !important;
          }

          .g365-recap-record-row {
            grid-template-columns: 42px minmax(150px, 1fr) 76px 78px !important;
          }

          .g365-recap-hide-mobile {
            display: none !important;
          }
        }
      `}</style>

      <div style={S.shell}>
        <section
          className="g365-recap-hero"
          style={S.hero}
        >
          <div>
            <div style={S.eyebrow}>
              GRIDIRON365 • NHL TRADITIONAL
            </div>

            <h1 style={S.title}>Season Recap</h1>

            <p style={S.subtitle}>
              {recap?.league.season ?? "—"} •{" "}
              {title(recap?.league.leagueFormat)} •{" "}
              {title(recap?.league.scoringSystem)}
            </p>
          </div>

          <div style={S.badges}>
            <span style={S.badge}>
              {recap?.league.regularSeasonWeeks ?? "—"} WEEK
              REGULAR SEASON
            </span>

            <span style={S.badge}>
              {recap?.league.playoffTeamCount ?? "—"} PLAYOFF
              TEAMS
            </span>

            <span
              style={{
                ...S.badge,
                ...(recap?.seasonComplete
                  ? S.completeBadge
                  : {}),
              }}
            >
              {recap?.seasonComplete
                ? "SEASON COMPLETE"
                : "SEASON IN PROGRESS"}
            </span>
          </div>
        </section>

        <Link
          href={`/league/${leagueId}/nhl`}
          className="g365-recap-mobile-redundant-nav"
          style={S.back}
        >
          ← LEAGUE HOME
        </Link>

        {error ? (
          <section style={S.error}>
            <strong>
              Season recap could not be loaded.
            </strong>

            <span>{error}</span>

            <button
              type="button"
              onClick={() => void load()}
              style={S.retry}
            >
              RETRY
            </button>
          </section>
        ) : recap ? (
          <>
            <section
              className="g365-recap-champion"
              style={S.championHero}
            >
              <div style={S.championGlow} />

              <div style={S.championContent}>
                <div style={S.championLabel}>
                  {hasChampion
                    ? `${recap.league.season} NHL TRADITIONAL CHAMPION`
                    : "CHAMPIONSHIP"}
                </div>

                <div style={S.trophy}>🏆</div>

                <div style={S.championName}>
                  {hasChampion
                    ? champion?.championTeamName
                    : "Champion TBD"}
                </div>

                {champion?.runnerUpTeamName ? (
                  <div style={S.runnerUp}>
                    Runner-Up •{" "}
                    <strong>
                      {champion.runnerUpTeamName}
                    </strong>
                  </div>
                ) : (
                  <div style={S.runnerUp}>
                    The championship has not been finalized yet.
                  </div>
                )}
              </div>
            </section>

            <div className="g365-recap-grid">
              <SummaryCard
                label="REGULAR SEASON CHAMPION"
                value={
                  recap.regularSeasonChampion?.teamName ??
                  "TBD"
                }
                sub={
                  recap.regularSeasonChampion
                    ? "No. 1 postseason seed"
                    : "Not determined yet"
                }
              />

              <SummaryCard
                label="BEST TEAM WEEK"
                value={
                  awards?.bestWeek
                    ? score(awards.bestWeek.score)
                    : "—"
                }
                sub={
                  awards?.bestWeek
                    ? `${awards.bestWeek.teamName} • Week ${awards.bestWeek.week}`
                    : "No completed weeks"
                }
              />

              <SummaryCard
                label="BIGGEST BLOWOUT"
                value={
                  awards?.biggestBlowout
                    ? `${score(
                        awards.biggestBlowout.margin
                      )} PTS`
                    : "—"
                }
                sub={
                  awards?.biggestBlowout
                    ? `Week ${awards.biggestBlowout.week}`
                    : "No completed matchups"
                }
              />

              <SummaryCard
                label="CLOSEST MATCHUP"
                value={
                  awards?.closestMatchup
                    ? `${score(
                        awards.closestMatchup.margin
                      )} PTS`
                    : "—"
                }
                sub={
                  awards?.closestMatchup
                    ? `Week ${awards.closestMatchup.week}`
                    : "No completed matchups"
                }
              />
            </div>

            <section style={S.panel}>
              <div style={S.panelHead}>
                <div style={S.panelTitleGroup}>
                  <strong>SEASON AWARDS</strong>

                  <small style={S.panelSubtitle}>
                    Regular-season team and matchup
                    highlights
                  </small>
                </div>
              </div>

              <div
                className="g365-recap-awards"
                style={S.awardsBody}
              >
                <AwardCard
                  eyebrow="HIGH SCORE"
                  title={
                    awards?.bestWeek?.teamName ??
                    "No Result"
                  }
                  primary={
                    awards?.bestWeek
                      ? score(awards.bestWeek.score)
                      : "—"
                  }
                  secondary={
                    awards?.bestWeek
                      ? `Week ${awards.bestWeek.week}`
                      : "Waiting for completed matchups"
                  }
                />

                <AwardCard
                  eyebrow="LOW SCORE"
                  title={
                    awards?.worstWeek?.teamName ??
                    "No Result"
                  }
                  primary={
                    awards?.worstWeek
                      ? score(awards.worstWeek.score)
                      : "—"
                  }
                  secondary={
                    awards?.worstWeek
                      ? `Week ${awards.worstWeek.week}`
                      : "Waiting for completed matchups"
                  }
                />

                <AwardCard
                  eyebrow="BIGGEST BLOWOUT"
                  title={
                    awards?.biggestBlowout
                      ?.winnerTeamName ??
                    "No Result"
                  }
                  primary={
                    awards?.biggestBlowout
                      ? `${score(
                          awards.biggestBlowout.margin
                        )} PTS`
                      : "—"
                  }
                  secondary={
                    awards?.biggestBlowout
                      ? `${awards.biggestBlowout.homeTeamName} ${score(
                          awards.biggestBlowout.homeScore
                        )} – ${score(
                          awards.biggestBlowout.awayScore
                        )} ${awards.biggestBlowout.awayTeamName}`
                      : "Waiting for completed matchups"
                  }
                />

                <AwardCard
                  eyebrow="CLOSEST MATCHUP"
                  title={
                    awards?.closestMatchup?.isTie
                      ? "Tie Game"
                      : awards?.closestMatchup
                          ?.winnerTeamName ?? "No Result"
                  }
                  primary={
                    awards?.closestMatchup
                      ? `${score(
                          awards.closestMatchup.margin
                        )} PTS`
                      : "—"
                  }
                  secondary={
                    awards?.closestMatchup
                      ? `${awards.closestMatchup.homeTeamName} ${score(
                          awards.closestMatchup.homeScore
                        )} – ${score(
                          awards.closestMatchup.awayScore
                        )} ${awards.closestMatchup.awayTeamName}`
                      : "Waiting for completed matchups"
                  }
                />
              </div>
            </section>

            <section style={S.panel}>
              <div style={S.panelHead}>
                <div style={S.panelTitleGroup}>
                  <strong>FINAL TEAM RECORDS</strong>

                  <small style={S.panelSubtitle}>
                    Regular-season matchup results
                  </small>
                </div>

                <span style={S.panelCount}>
                  {teamRecords.length} TEAMS
                </span>
              </div>

              <div style={S.records}>
                <div
                  className="g365-recap-record-header"
                  style={{
                    ...S.recordGrid,
                    ...S.recordHeader,
                  }}
                >
                  <div>RK</div>
                  <div>TEAM</div>
                  <div>RECORD</div>
                  <div>PF</div>
                  <div>PA</div>
                  <div>DIFF</div>
                </div>

                {teamRecords.map((team, index) => (
                  <div
                    key={team.fantasyTeamId}
                    className="g365-recap-team-row g365-recap-record-row"
                    style={S.recordGrid}
                  >
                    <div style={S.rankCell}>
                      <span
                        style={
                          index === 0
                            ? S.firstRank
                            : S.rank
                        }
                      >
                        {index + 1}
                      </span>
                    </div>

                    <div style={S.teamCell}>
                      <Link
                        className="g365-recap-team-link"
                        href={`/league/${leagueId}/nhl/teams/${team.fantasyTeamId}`}
                        style={S.teamLink}
                      >
                        {team.teamName}
                      </Link>
                    </div>

                    <div style={S.recordCell}>
                      {record(team)}
                    </div>

                    <div
                      className="g365-recap-hide-mobile"
                      style={S.statCell}
                    >
                      {score(team.pointsFor)}
                    </div>

                    <div
                      className="g365-recap-hide-mobile"
                      style={S.statCell}
                    >
                      {score(team.pointsAgainst)}
                    </div>

                    <div
                      style={{
                        ...S.statCell,
                        ...(team.pointDifferential > 0
                          ? S.positive
                          : team.pointDifferential < 0
                            ? S.negative
                            : {}),
                      }}
                    >
                      {team.pointDifferential > 0
                        ? "+"
                        : ""}
                      {score(team.pointDifferential)}
                    </div>
                  </div>
                ))}

                {!teamRecords.length ? (
                  <div style={S.empty}>
                    No completed regular-season results
                    are available yet.
                  </div>
                ) : null}
              </div>
            </section>

            <section style={S.panel}>
              <div style={S.panelHead}>
                <div style={S.panelTitleGroup}>
                  <strong>PLAYOFF RECAP</strong>

                  <small style={S.panelSubtitle}>
                    Complete postseason path to the
                    championship
                  </small>
                </div>

                <span style={S.panelCount}>
                  {recap.counts.completedPlayoffMatchups}{" "}
                  FINAL
                </span>
              </div>

              {playoffRounds.length ? (
                <div
                  className="g365-recap-rounds"
                  style={S.rounds}
                >
                  {playoffRounds.map((round) => (
                    <div
                      key={round.roundNumber}
                      style={S.round}
                    >
                      <div style={S.roundHeader}>
                        <span>
                          {title(round.roundName)}
                        </span>

                        <small>
                          ROUND {round.roundNumber}
                        </small>
                      </div>

                      <div style={S.roundGames}>
                        {round.matchups.map((matchup) => (
                          <PlayoffGame
                            key={matchup.matchupId}
                            matchup={matchup}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={S.empty}>
                  The postseason bracket has not been
                  generated yet.
                </div>
              )}
            </section>

            <div className="g365-recap-two">
              <MatchupHighlight
                title="BIGGEST BLOWOUT"
                matchup={awards?.biggestBlowout ?? null}
              />

              <MatchupHighlight
                title="CLOSEST MATCHUP"
                matchup={awards?.closestMatchup ?? null}
              />
            </div>

            <section style={S.footer}>
              <div>
                <strong>
                  {recap.league.leagueName}
                </strong>

                <span>
                  {recap.league.season} NHL Traditional
                </span>
              </div>

              <div style={S.footerStats}>
                <span>
                  {
                    recap.counts
                      .completedRegularSeasonMatchups
                  }{" "}
                  REGULAR-SEASON MATCHUPS
                </span>

                <span>
                  {
                    recap.counts
                      .completedPlayoffMatchups
                  }{" "}
                  PLAYOFF MATCHUPS
                </span>
              </div>
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}

function SummaryCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div style={S.summaryCard}>
      <div style={S.summaryLabel}>{label}</div>

      <div style={S.summaryValue}>{value}</div>

      <div style={S.summarySub}>{sub}</div>
    </div>
  );
}

function AwardCard({
  eyebrow,
  title: awardTitle,
  primary,
  secondary,
}: {
  eyebrow: string;
  title: string;
  primary: string;
  secondary: string;
}) {
  return (
    <div style={S.awardCard}>
      <div style={S.awardEyebrow}>{eyebrow}</div>

      <div style={S.awardTitle}>{awardTitle}</div>

      <div style={S.awardPrimary}>{primary}</div>

      <div style={S.awardSecondary}>
        {secondary}
      </div>
    </div>
  );
}

function PlayoffGame({
  matchup,
}: {
  matchup: PlayoffMatchup;
}) {
  const homeWinner =
    matchup.winnerTeamId != null &&
    matchup.winnerTeamId === matchup.homeTeamId;

  const awayWinner =
    matchup.winnerTeamId != null &&
    matchup.winnerTeamId === matchup.awayTeamId;

  return (
    <div
      style={{
        ...S.playoffGame,
        ...(matchup.isBye ? S.byeGame : {}),
      }}
    >
      <div style={S.gameStatus}>
        <span>
          {matchup.isBye
            ? "BYE"
            : title(matchup.status)}
        </span>

        {matchup.isTie ? (
          <span style={S.tieTag}>TIE</span>
        ) : null}
      </div>

      <PlayoffTeamRow
        seed={matchup.homeSeed}
        name={teamName(matchup.homeTeamName)}
        scoreValue={matchup.homeScore}
        winner={homeWinner}
      />

      {!matchup.isBye ? (
        <PlayoffTeamRow
          seed={matchup.awaySeed}
          name={teamName(matchup.awayTeamName)}
          scoreValue={matchup.awayScore}
          winner={awayWinner}
        />
      ) : null}

      {matchup.winnerTeamName ? (
        <div style={S.gameWinner}>
          ADVANCES • {matchup.winnerTeamName}
        </div>
      ) : null}
    </div>
  );
}

function PlayoffTeamRow({
  seed,
  name,
  scoreValue,
  winner,
}: {
  seed: number | null;
  name: string;
  scoreValue: number | null;
  winner: boolean;
}) {
  return (
    <div
      style={{
        ...S.playoffTeam,
        ...(winner ? S.playoffWinner : {}),
      }}
    >
      <span style={S.seed}>
        {seed != null ? seed : "—"}
      </span>

      <span style={S.playoffTeamName}>
        {name}
      </span>

      <strong style={S.playoffScore}>
        {score(scoreValue)}
      </strong>
    </div>
  );
}

function MatchupHighlight({
  title: heading,
  matchup,
}: {
  title: string;
  matchup: MatchupAward | null;
}) {
  return (
    <section style={S.highlight}>
      <div style={S.highlightHeader}>
        <span>{heading}</span>

        <span>
          {matchup ? `WEEK ${matchup.week}` : "—"}
        </span>
      </div>

      {matchup ? (
        <>
          <div style={S.highlightTeams}>
            <div style={S.highlightTeam}>
              <span>{matchup.homeTeamName}</span>

              <strong>
                {score(matchup.homeScore)}
              </strong>
            </div>

            <div style={S.versus}>VS</div>

            <div style={S.highlightTeam}>
              <span>{matchup.awayTeamName}</span>

              <strong>
                {score(matchup.awayScore)}
              </strong>
            </div>
          </div>

          <div style={S.margin}>
            MARGIN • {score(matchup.margin)}
          </div>
        </>
      ) : (
        <div style={S.empty}>
          No completed matchup available.
        </div>
      )}
    </section>
  );
}

const S: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#09090a",
    color: "#f5f5f5",
    padding: "14px 10px 48px",
  },

  shell: {
    width: "min(1100px, 100%)",
    margin: "0 auto",
    display: "grid",
    gap: 12,
  },

  loading: {
    padding: 48,
    textAlign: "center",
    color: "#999ca2",
  },

  hero: {
    padding: "18px 20px",
    border: "1px solid #29292d",
    borderRadius: 10,
    background:
      "linear-gradient(135deg, #171719 0%, #111113 60%, #21110b 100%)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
    flexWrap: "wrap",
  },

  eyebrow: {
    color: "#ff6a00",
    fontSize: 9,
    fontWeight: 1000,
    letterSpacing: 1.3,
  },

  title: {
    margin: "4px 0 0",
    fontSize: "clamp(28px, 5vw, 42px)",
    lineHeight: 1,
    fontWeight: 1000,
  },

  subtitle: {
    margin: "7px 0 0",
    color: "#a0a0a5",
    fontSize: 11,
    fontWeight: 800,
  },

  badges: {
    display: "flex",
    gap: 6,
    flexWrap: "wrap",
  },

  badge: {
    padding: "6px 9px",
    border: "1px solid #493025",
    borderRadius: 5,
    background: "#21140f",
    color: "#ff8a45",
    fontSize: 8,
    fontWeight: 1000,
  },

  completeBadge: {
    border: "1px solid #245d39",
    background: "#102319",
    color: "#67d68a",
  },

  back: {
    justifySelf: "start",
    color: "#ff7b31",
    textDecoration: "none",
    fontSize: 10,
    fontWeight: 1000,
  },

  championHero: {
    position: "relative",
    overflow: "hidden",
    minHeight: 250,
    padding: "28px 24px",
    border: "1px solid #71341b",
    borderRadius: 12,
    background:
      "radial-gradient(circle at 50% 0%, rgba(255,90,31,.20), transparent 44%), linear-gradient(145deg, #1b0e09 0%, #111113 48%, #09090a 100%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  championGlow: {
    position: "absolute",
    width: 280,
    height: 280,
    borderRadius: "50%",
    background:
      "radial-gradient(circle, rgba(255,89,31,.15), transparent 68%)",
    pointerEvents: "none",
  },

  championContent: {
    position: "relative",
    zIndex: 1,
    display: "grid",
    justifyItems: "center",
    textAlign: "center",
  },

  championLabel: {
    color: "#ff7b31",
    fontSize: 9,
    fontWeight: 1000,
    letterSpacing: 1.6,
  },

  trophy: {
    marginTop: 10,
    fontSize: 44,
    lineHeight: 1,
  },

  championName: {
    marginTop: 10,
    fontSize: "clamp(27px, 6vw, 48px)",
    lineHeight: 1,
    fontWeight: 1000,
    color: "#fff",
  },

  runnerUp: {
    marginTop: 12,
    color: "#8e8e94",
    fontSize: 10,
  },

  summaryCard: {
    minHeight: 116,
    padding: 14,
    border: "1px solid #29292d",
    borderRadius: 9,
    background:
      "linear-gradient(145deg, #151517, #101012)",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
  },

  summaryLabel: {
    color: "#ff6a00",
    fontSize: 8,
    fontWeight: 1000,
    letterSpacing: 0.9,
  },

  summaryValue: {
    marginTop: 7,
    color: "#fff",
    fontSize: 20,
    fontWeight: 1000,
    lineHeight: 1.1,
  },

  summarySub: {
    marginTop: 7,
    color: "#777a80",
    fontSize: 9,
    fontWeight: 700,
  },

  panel: {
    border: "1px solid #29292d",
    borderRadius: 9,
    overflow: "hidden",
    background: "#111113",
  },

  panelHead: {
    minHeight: 54,
    padding: "12px 14px",
    background: "#0d0d0f",
    borderBottom: "1px solid #29292d",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    color: "#d9d9dc",
    fontSize: 10,
  },

  panelTitleGroup: {
    display: "grid",
    gap: 3,
  },

  panelSubtitle: {
    color: "#777a80",
    fontSize: 8,
  },

  panelCount: {
    color: "#777a80",
    fontSize: 8,
    fontWeight: 1000,
  },

  awardsBody: {
    padding: 10,
  },

  awardCard: {
    minHeight: 150,
    padding: 13,
    border: "1px solid #28282c",
    borderRadius: 8,
    background: "#141416",
    display: "flex",
    flexDirection: "column",
  },

  awardEyebrow: {
    color: "#ff6a00",
    fontSize: 7,
    fontWeight: 1000,
    letterSpacing: 0.9,
  },

  awardTitle: {
    marginTop: 8,
    color: "#f2f2f3",
    fontSize: 13,
    fontWeight: 1000,
  },

  awardPrimary: {
    marginTop: "auto",
    paddingTop: 14,
    color: "#fff",
    fontSize: 23,
    fontWeight: 1000,
  },

  awardSecondary: {
    marginTop: 5,
    color: "#777a80",
    fontSize: 8,
    lineHeight: 1.4,
  },

  records: {
    overflow: "hidden",
  },

  recordGrid: {
    minHeight: 52,
    display: "grid",
    gridTemplateColumns:
      "58px minmax(220px, 1fr) 110px 100px 100px 100px",
    alignItems: "center",
    borderBottom: "1px solid #242428",
  },

  recordHeader: {
    minHeight: 38,
    padding: "0 10px",
    background: "#151517",
    color: "#777a80",
    fontSize: 8,
    fontWeight: 1000,
  },

  rankCell: {
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  rank: {
    color: "#b8b8bc",
    fontSize: 12,
    fontWeight: 1000,
  },

  firstRank: {
    width: 26,
    height: 26,
    borderRadius: "50%",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#ff5a1f",
    color: "#fff",
    fontSize: 11,
    fontWeight: 1000,
  },

  teamCell: {
    minWidth: 0,
    padding: "0 10px",
  },

  teamLink: {
    color: "#f5f5f5",
    textDecoration: "none",
    fontSize: 12,
    fontWeight: 1000,
  },

  recordCell: {
    padding: "0 10px",
    fontSize: 12,
    fontWeight: 1000,
  },

  statCell: {
    padding: "0 10px",
    color: "#b9b9bd",
    fontSize: 11,
    fontWeight: 900,
  },

  positive: {
    color: "#67d68a",
  },

  negative: {
    color: "#e78378",
  },

  rounds: {
    padding: 10,
  },

  round: {
    border: "1px solid #28282c",
    borderRadius: 8,
    overflow: "hidden",
    background: "#0f0f11",
  },

  roundHeader: {
    minHeight: 48,
    padding: "10px 12px",
    borderBottom: "1px solid #28282c",
    background:
      "linear-gradient(90deg, #1e100b, #121214)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    color: "#ff7b31",
    fontSize: 10,
    fontWeight: 1000,
  },

  roundGames: {
    padding: 8,
    display: "grid",
    gap: 8,
  },

  playoffGame: {
    border: "1px solid #28282c",
    borderRadius: 7,
    overflow: "hidden",
    background: "#141416",
  },

  byeGame: {
    border: "1px solid #51301f",
  },

  gameStatus: {
    minHeight: 26,
    padding: "5px 8px",
    borderBottom: "1px solid #242428",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    color: "#737379",
    fontSize: 7,
    fontWeight: 1000,
  },

  tieTag: {
    color: "#ff7b31",
  },

  playoffTeam: {
    minHeight: 42,
    padding: "7px 8px",
    display: "grid",
    gridTemplateColumns: "28px minmax(0, 1fr) 58px",
    alignItems: "center",
    gap: 7,
    borderBottom: "1px solid #242428",
  },

  playoffWinner: {
    background: "#171d18",
    borderLeft: "3px solid #4aa866",
  },

  seed: {
    width: 22,
    height: 22,
    borderRadius: "50%",
    background: "#202023",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#bdbdc1",
    fontSize: 8,
    fontWeight: 1000,
  },

  playoffTeamName: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    fontSize: 10,
    fontWeight: 1000,
  },

  playoffScore: {
    textAlign: "right",
    fontSize: 12,
  },

  gameWinner: {
    padding: "6px 8px",
    color: "#67d68a",
    background: "#0e1711",
    fontSize: 7,
    fontWeight: 1000,
  },

  highlight: {
    border: "1px solid #29292d",
    borderRadius: 9,
    overflow: "hidden",
    background: "#111113",
  },

  highlightHeader: {
    minHeight: 42,
    padding: "9px 12px",
    borderBottom: "1px solid #29292d",
    background: "#0d0d0f",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    color: "#ff7b31",
    fontSize: 8,
    fontWeight: 1000,
  },

  highlightTeams: {
    padding: 16,
    display: "grid",
    gridTemplateColumns: "1fr auto 1fr",
    alignItems: "center",
    gap: 10,
  },

  highlightTeam: {
    minWidth: 0,
    display: "grid",
    gap: 6,
    textAlign: "center",
  },

  versus: {
    color: "#55555b",
    fontSize: 8,
    fontWeight: 1000,
  },

  margin: {
    padding: "8px 12px",
    borderTop: "1px solid #242428",
    textAlign: "center",
    color: "#8c8c92",
    fontSize: 8,
    fontWeight: 1000,
  },

  footer: {
    padding: "14px 16px",
    border: "1px solid #29292d",
    borderRadius: 9,
    background: "#0d0d0f",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
    fontSize: 10,
  },

  footerStats: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    color: "#777a80",
    fontSize: 8,
    fontWeight: 1000,
  },

  empty: {
    padding: 28,
    textAlign: "center",
    color: "#777a80",
    fontSize: 10,
  },

  error: {
    padding: 16,
    border: "1px solid #742b25",
    borderRadius: 9,
    background: "#29110f",
    color: "#ffd1cc",
    display: "grid",
    gap: 8,
  },

  retry: {
    justifySelf: "start",
    border: 0,
    borderRadius: 5,
    padding: "8px 12px",
    background: "#ff4b20",
    color: "#fff",
    fontWeight: 1000,
    cursor: "pointer",
  },
};