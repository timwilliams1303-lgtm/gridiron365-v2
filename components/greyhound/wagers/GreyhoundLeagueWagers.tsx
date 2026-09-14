"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import styles from "./GreyhoundLeagueWagers.module.css";

type Track = {
  id: number;
  code: string;
  name: string | null;
};

type Card = {
  id: number;
  raceDate: string;
  session: string | null;
  status: string;
  lockAt: string | null;
  finalizedAt: string | null;
};

type Wager = {
  id: number;
  fantasyTeamId: number;
  teamName: string;
  teamActive: boolean;
  racingCardId: number;
  card: Card | null;
  track: Track | null;
  raceId: number;
  raceNumber: number;
  raceStatus: string | null;
  wagerType: string;
  wagerStructure: string;
  denomination: number;
  combinationCount: number;
  totalCost: number;
  wagerStatus: string;
  gradingStatus: string | null;
  officialReturn: number;
  bankrollImpact: number;
  selectedEntryIds: number[];
  selectedDogs: unknown;
  alternate1: unknown;
  alternate2: unknown;
  combinationJson: unknown;
  refundReason: string | null;
  gradedAt: string | null;
  lastRegradedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type LeaderboardEntry = {
  fantasyTeamId: number;
  teamName: string;
  teamActive: boolean;
  rank: number;
  totalWagers: number;
  totalStaked: number;
  totalReturned: number;
  net: number;
  pending: number;
  winners: number;
  losers: number;
  refunded: number;
  racesCompleted: number;
  wagers: Wager[];
};

type ApiResponse = {
  success: boolean;
  error?: string;
  league?: {
    id: string;
    name: string;
  };
  competition?: {
    gameFormat: string;
    leaderboardMode: string;
    leaderboardLabel: string;
  };
  summary?: {
    totalWagers: number;
    totalStaked: number;
    totalReturned: number;
    net: number;
    pending: number;
    winners: number;
    losers: number;
    refunded: number;
  };
  filters?: {
    teams: Array<{ id: number; name: string }>;
    tracks: Track[];
  };
  leaderboard?: LeaderboardEntry[];
  wagers?: Wager[];
};

type Props = {
  leagueId: string;
};

type StatusFilter =
  | "all"
  | "pending"
  | "winner"
  | "loser"
  | "refunded";

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function dateLabel(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function dateTimeLabel(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function title(value: string | null | undefined) {
  return String(value ?? "—")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function statusGroup(wager: Wager): StatusFilter {
  const status = wager.wagerStatus.toLowerCase();

  if (status === "winner") return "winner";
  if (status === "loser") return "loser";
  if (status === "refunded" || status === "no_action") return "refunded";
  return "pending";
}

function statusClass(wager: Wager) {
  const group = statusGroup(wager);
  if (group === "winner") return styles.statusWinner;
  if (group === "loser") return styles.statusLoser;
  if (group === "refunded") return styles.statusRefunded;
  return styles.statusPending;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function dogLabel(value: unknown) {
  if (!isObject(value)) return null;

  const box =
    value.box_number ??
    value.boxNumber ??
    value.trap ??
    value.post_position;

  const name = value.dog_name ?? value.dogName ?? value.name;

  if (!name && box === undefined) return null;

  const boxText =
    box === undefined || box === null ? "" : `#${String(box)} `;

  return `${boxText}${String(name ?? "Runner")}`.trim();
}

function selectedDogLabels(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => dogLabel(item))
    .filter((item): item is string => Boolean(item));
}

function combinationLines(
  combinationJson: unknown,
  selectedDogs: unknown,
) {
  if (!Array.isArray(combinationJson)) return [];

  const dogs = Array.isArray(selectedDogs)
    ? selectedDogs.filter(isObject)
    : [];

  const byEntryId = new Map<number, string>();

  for (const dog of dogs) {
    const id = Number(dog.entry_id ?? dog.entryId ?? dog.id);
    const label = dogLabel(dog);

    if (Number.isFinite(id) && label) {
      byEntryId.set(id, label);
    }
  }

  return combinationJson
    .filter((combo): combo is unknown[] => Array.isArray(combo))
    .map((combo) =>
      combo
        .map((entryId) => {
          const id = Number(entryId);
          return byEntryId.get(id) ?? `Entry ${String(entryId)}`;
        })
        .join(" → "),
    );
}

function entrySearchText(entry: LeaderboardEntry) {
  return [
    entry.teamName,
    ...entry.wagers.flatMap((wager) => [
      wager.track?.name,
      wager.track?.code,
      wager.wagerType,
      wager.wagerStructure,
      `race ${wager.raceNumber}`,
      ...selectedDogLabels(wager.selectedDogs),
    ]),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export default function GreyhoundLeagueWagers({ leagueId }: Props) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [teamFilter, setTeamFilter] = useState("all");
  const [trackFilter, setTrackFilter] = useState("all");
  const [statusFilter, setStatusFilter] =
    useState<StatusFilter>("all");
  const [raceFilter, setRaceFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [expandedTeams, setExpandedTeams] =
    useState<Set<number>>(new Set());
  const [expandedTickets, setExpandedTickets] =
    useState<Set<number>>(new Set());

  const load = useCallback(
    async (silent = false) => {
      if (silent) setRefreshing(true);
      else setLoading(true);

      setError(null);

      try {
        const response = await fetch(
          `/api/greyhound/league-wagers?leagueId=${encodeURIComponent(
            leagueId,
          )}`,
          {
            method: "GET",
            cache: "no-store",
          },
        );

        const payload = (await response.json()) as ApiResponse;

        if (!response.ok || !payload.success) {
          throw new Error(
            payload.error ?? "Unable to load league wagers.",
          );
        }

        setData(payload);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load league wagers.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [leagueId],
  );

  useEffect(() => {
    void load(false);
  }, [load]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void load(true);
    }, 10000);

    return () => window.clearInterval(interval);
  }, [load]);

  const races = useMemo(
    () =>
      Array.from(
        new Set(
          (data?.wagers ?? []).map((wager) => wager.raceNumber),
        ),
      ).sort((a, b) => a - b),
    [data?.wagers],
  );

  const filteredLeaderboard = useMemo(() => {
    const needle = search.trim().toLowerCase();

    return (data?.leaderboard ?? [])
      .map((entry) => {
        const wagers = entry.wagers.filter((wager) => {
          if (
            trackFilter !== "all" &&
            String(wager.track?.id ?? "") !== trackFilter
          ) {
            return false;
          }

          if (
            statusFilter !== "all" &&
            statusGroup(wager) !== statusFilter
          ) {
            return false;
          }

          if (
            raceFilter !== "all" &&
            String(wager.raceNumber) !== raceFilter
          ) {
            return false;
          }

          return true;
        });

        return { ...entry, wagers };
      })
      .filter((entry) => {
        if (
          teamFilter !== "all" &&
          String(entry.fantasyTeamId) !== teamFilter
        ) {
          return false;
        }

        if (needle && !entrySearchText(entry).includes(needle)) {
          return false;
        }

        if (
          trackFilter !== "all" ||
          statusFilter !== "all" ||
          raceFilter !== "all"
        ) {
          return entry.wagers.length > 0;
        }

        return true;
      });
  }, [
    data?.leaderboard,
    teamFilter,
    trackFilter,
    statusFilter,
    raceFilter,
    search,
  ]);

  const summary = data?.summary ?? {
    totalWagers: 0,
    totalStaked: 0,
    totalReturned: 0,
    net: 0,
    pending: 0,
    winners: 0,
    losers: 0,
    refunded: 0,
  };

  function toggleTeam(id: number) {
    setExpandedTeams((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleTicket(id: number) {
    setExpandedTickets((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function resetFilters() {
    setTeamFilter("all");
    setTrackFilter("all");
    setStatusFilter("all");
    setRaceFilter("all");
    setSearch("");
  }

  if (loading && !data) {
    return (
      <main className={styles.page}>
        <div className={styles.shell}>
          <div className={styles.loadingCard}>
            Loading Live League Wagers…
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <div className={styles.topLinks}>
          <Link
            href={`/league/${leagueId}`}
            className={styles.backButton}
          >
            ← Greyhound Home
          </Link>

          <Link
            href={`/league/${leagueId}/greyhound/wagers`}
            className={styles.secondaryLink}
          >
            My Wagers
          </Link>
        </div>

        <header className={styles.hero}>
          <div>
            <div className={styles.eyebrow}>
              G365 Greyhound Racing · Live
            </div>
            <h1>League Wagers</h1>
            <p>
              Live team and entry leaderboard. Totals and rankings
              refresh automatically as Greyhound wagers are graded.
            </p>
          </div>

          <div className={styles.liveControls}>
            <span className={styles.liveBadge}>
              <i />
              Live · 10s
            </span>
            <button
              type="button"
              className={styles.refreshButton}
              onClick={() => void load(true)}
              disabled={refreshing}
            >
              {refreshing ? "Refreshing…" : "Refresh Now"}
            </button>
          </div>
        </header>

        {error ? (
          <div className={styles.errorBar}>{error}</div>
        ) : null}

        <section className={styles.summaryGrid}>
          <article className={styles.summaryCard}>
            <span>Total Wagered</span>
            <strong>{money(summary.totalStaked)}</strong>
            <small>{summary.totalWagers} tickets</small>
          </article>

          <article className={styles.summaryCard}>
            <span>Total Returned</span>
            <strong>{money(summary.totalReturned)}</strong>
            <small>{summary.winners} winning tickets</small>
          </article>

          <article
            className={`${styles.summaryCard} ${
              summary.net >= 0 ? styles.positive : styles.negative
            }`}
          >
            <span>League Net</span>
            <strong>
              {summary.net >= 0 ? "+" : ""}
              {money(summary.net)}
            </strong>
            <small>Return minus stake</small>
          </article>

          <article className={styles.summaryCard}>
            <span>Open Tickets</span>
            <strong>{summary.pending}</strong>
            <small>Live / awaiting grade</small>
          </article>
        </section>

        <section className={styles.boardHeading}>
          <div>
            <span className={styles.filterKicker}>
              Live Leaderboard
            </span>
            <h2>
              {data?.competition?.leaderboardLabel ??
                "League Standings"}
            </h2>
          </div>
          <span className={styles.formatBadge}>
            {title(data?.competition?.gameFormat ?? "greyhound")}
          </span>
        </section>

        <section className={styles.filters}>
          <div className={styles.filterHeader}>
            <div>
              <span className={styles.filterKicker}>Board Filters</span>
              <h2>Find Team, Entry or Ticket</h2>
            </div>

            <button
              type="button"
              className={styles.resetButton}
              onClick={resetFilters}
            >
              Reset
            </button>
          </div>

          <div className={styles.filterGrid}>
            <label>
              <span>Team / Entry</span>
              <select
                value={teamFilter}
                onChange={(event) =>
                  setTeamFilter(event.target.value)
                }
              >
                <option value="all">All Entries</option>
                {(data?.filters?.teams ?? []).map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Track</span>
              <select
                value={trackFilter}
                onChange={(event) =>
                  setTrackFilter(event.target.value)
                }
              >
                <option value="all">All Tracks</option>
                {(data?.filters?.tracks ?? []).map((track) => (
                  <option key={track.id} value={track.id}>
                    {track.name ?? track.code}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Status</span>
              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(
                    event.target.value as StatusFilter,
                  )
                }
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="winner">Won</option>
                <option value="loser">Lost</option>
                <option value="refunded">Refunded</option>
              </select>
            </label>

            <label>
              <span>Race</span>
              <select
                value={raceFilter}
                onChange={(event) =>
                  setRaceFilter(event.target.value)
                }
              >
                <option value="all">All Races</option>
                {races.map((raceNumber) => (
                  <option key={raceNumber} value={raceNumber}>
                    Race {raceNumber}
                  </option>
                ))}
              </select>
            </label>

            <label className={styles.searchLabel}>
              <span>Search</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Team, entry, dog, wager type…"
              />
            </label>
          </div>
        </section>

        <div className={styles.resultBar}>
          <strong>{filteredLeaderboard.length}</strong>
          <span>
            {filteredLeaderboard.length === 1 ? "entry" : "entries"} shown
          </span>
        </div>

        {filteredLeaderboard.length === 0 ? (
          <section className={styles.emptyCard}>
            <strong>No league wagers yet.</strong>
            <span>
              Entries will appear here automatically as members place
              Greyhound wagers.
            </span>
          </section>
        ) : (
          <section className={styles.leaderboard}>
            {filteredLeaderboard.map((entry) => {
              const expanded = expandedTeams.has(entry.fantasyTeamId);

              return (
                <article
                  key={entry.fantasyTeamId}
                  className={styles.entryCard}
                >
                  <button
                    type="button"
                    className={styles.entryHeader}
                    onClick={() => toggleTeam(entry.fantasyTeamId)}
                    aria-expanded={expanded}
                  >
                    <div className={styles.rankBlock}>
                      <span>Rank</span>
                      <strong>#{entry.rank}</strong>
                    </div>

                    <div className={styles.entryIdentity}>
                      <strong>{entry.teamName}</strong>
                      <span>
                        {entry.totalWagers} tickets ·{" "}
                        {entry.racesCompleted} races graded
                      </span>
                    </div>

                    <div className={styles.liveMetric}>
                      <span>Wagered</span>
                      <strong>{money(entry.totalStaked)}</strong>
                    </div>

                    <div className={styles.liveMetric}>
                      <span>Returned</span>
                      <strong>{money(entry.totalReturned)}</strong>
                    </div>

                    <div className={styles.liveMetric}>
                      <span>Net</span>
                      <strong
                        className={
                          entry.net > 0
                            ? styles.moneyPositive
                            : entry.net < 0
                              ? styles.moneyNegative
                              : undefined
                        }
                      >
                        {entry.net > 0 ? "+" : ""}
                        {money(entry.net)}
                      </strong>
                    </div>

                    <div className={styles.liveMetric}>
                      <span>Open</span>
                      <strong>{entry.pending}</strong>
                    </div>

                    <div className={styles.chevron}>
                      {expanded ? "−" : "+"}
                    </div>
                  </button>

                  {expanded ? (
                    <div className={styles.entryBody}>
                      <div className={styles.entryStatStrip}>
                        <span>
                          <b>{entry.winners}</b> Winners
                        </span>
                        <span>
                          <b>{entry.losers}</b> Losses
                        </span>
                        <span>
                          <b>{entry.refunded}</b> Refunded
                        </span>
                        <span>
                          <b>{entry.pending}</b> Pending
                        </span>
                      </div>

                      <div className={styles.ticketList}>
                        {entry.wagers.length === 0 ? (
                          <div className={styles.filteredEmpty}>
                            No tickets inside this entry match the
                            current filters.
                          </div>
                        ) : (
                          entry.wagers.map((wager) => {
                            const ticketExpanded =
                              expandedTickets.has(wager.id);
                            const dogNames = selectedDogLabels(
                              wager.selectedDogs,
                            );
                            const combos = combinationLines(
                              wager.combinationJson,
                              wager.selectedDogs,
                            );

                            return (
                              <article
                                key={wager.id}
                                className={styles.ticketCard}
                              >
                                <div className={styles.ticketTop}>
                                  <div>
                                    <div className={styles.raceTitle}>
                                      {wager.track?.name ??
                                        wager.track?.code ??
                                        "Track"}{" "}
                                      · Race {wager.raceNumber}
                                    </div>
                                    <div className={styles.raceMeta}>
                                      <span>
                                        {dateLabel(
                                          wager.card?.raceDate,
                                        )}
                                      </span>
                                      {wager.card?.session ? (
                                        <span>
                                          {title(
                                            wager.card.session,
                                          )}
                                        </span>
                                      ) : null}
                                      <span>
                                        {title(wager.wagerType)}
                                      </span>
                                      <span>
                                        {title(
                                          wager.wagerStructure,
                                        )}
                                      </span>
                                    </div>
                                  </div>

                                  <div
                                    className={`${styles.statusBadge} ${statusClass(
                                      wager,
                                    )}`}
                                  >
                                    {title(wager.wagerStatus)}
                                  </div>
                                </div>

                                <div className={styles.ticketGrid}>
                                  <div>
                                    <span>Denomination</span>
                                    <strong>
                                      {money(wager.denomination)}
                                    </strong>
                                  </div>
                                  <div>
                                    <span>Combinations</span>
                                    <strong>
                                      {wager.combinationCount}
                                    </strong>
                                  </div>
                                  <div>
                                    <span>Wagered</span>
                                    <strong>
                                      {money(wager.totalCost)}
                                    </strong>
                                  </div>
                                  <div>
                                    <span>Return</span>
                                    <strong>
                                      {money(wager.officialReturn)}
                                    </strong>
                                  </div>
                                  <div>
                                    <span>Net</span>
                                    <strong
                                      className={
                                        wager.bankrollImpact > 0
                                          ? styles.moneyPositive
                                          : wager.bankrollImpact < 0
                                            ? styles.moneyNegative
                                            : undefined
                                      }
                                    >
                                      {wager.bankrollImpact > 0
                                        ? "+"
                                        : ""}
                                      {money(
                                        wager.bankrollImpact,
                                      )}
                                    </strong>
                                  </div>
                                </div>

                                {dogNames.length > 0 ? (
                                  <div className={styles.runners}>
                                    <span>Selected Dogs</span>
                                    <div>
                                      {dogNames.map(
                                        (dog, index) => (
                                          <strong
                                            key={`${wager.id}-${dog}-${index}`}
                                          >
                                            {dog}
                                          </strong>
                                        ),
                                      )}
                                    </div>
                                  </div>
                                ) : null}

                                <div className={styles.cardFooter}>
                                  <div className={styles.timestamps}>
                                    Placed{" "}
                                    {dateTimeLabel(wager.createdAt)}
                                    {wager.gradedAt
                                      ? ` · Graded ${dateTimeLabel(
                                          wager.gradedAt,
                                        )}`
                                      : ""}
                                  </div>

                                  <button
                                    type="button"
                                    className={styles.detailsButton}
                                    onClick={() =>
                                      toggleTicket(wager.id)
                                    }
                                  >
                                    {ticketExpanded
                                      ? "Hide Details"
                                      : "Ticket Details"}
                                  </button>
                                </div>

                                {ticketExpanded ? (
                                  <div
                                    className={styles.detailsPanel}
                                  >
                                    <div
                                      className={styles.detailGrid}
                                    >
                                      <div>
                                        <span>Ticket ID</span>
                                        <strong>#{wager.id}</strong>
                                      </div>
                                      <div>
                                        <span>Race Status</span>
                                        <strong>
                                          {title(
                                            wager.raceStatus,
                                          )}
                                        </strong>
                                      </div>
                                      <div>
                                        <span>Grading</span>
                                        <strong>
                                          {title(
                                            wager.gradingStatus,
                                          )}
                                        </strong>
                                      </div>
                                      <div>
                                        <span>Card Status</span>
                                        <strong>
                                          {title(
                                            wager.card?.status,
                                          )}
                                        </strong>
                                      </div>
                                    </div>

                                    {combos.length > 0 ? (
                                      <div
                                        className={styles.comboBlock}
                                      >
                                        <span>Combinations</span>
                                        <div>
                                          {combos.map(
                                            (combo, index) => (
                                              <code
                                                key={`${wager.id}-combo-${index}`}
                                              >
                                                {combo}
                                              </code>
                                            ),
                                          )}
                                        </div>
                                      </div>
                                    ) : null}

                                    {wager.refundReason ? (
                                      <div
                                        className={
                                          styles.refundReason
                                        }
                                      >
                                        <span>
                                          Refund / No Action Reason
                                        </span>
                                        <strong>
                                          {wager.refundReason}
                                        </strong>
                                      </div>
                                    ) : null}
                                  </div>
                                ) : null}
                              </article>
                            );
                          })
                        )}
                      </div>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </section>
        )}
      </div>
    </main>
  );
}
