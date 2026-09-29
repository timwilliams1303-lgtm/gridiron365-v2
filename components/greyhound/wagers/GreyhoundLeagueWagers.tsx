"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
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
type MultiRaceSelection = { entryId:number; boxNumber:number|null; dogName:string; entryStatus:string|null };
type MultiRaceLeg = {
  legNumber:number;
  race:{id:number;raceNumber:number;status:string|null}|null;
  entryIds:number[];
  selections:MultiRaceSelection[];
};
type MultiRaceDetail = {
  poolId:number; poolStatus:string|null; legCount:number;
  startRace:{id:number;raceNumber:number;status:string|null}|null;
  legs:MultiRaceLeg[]; resultSnapshot:unknown; payoutSnapshot:unknown; gradeRevision:number|null;
};
type Wager = {
  id: number;
  ticketKind?: "standard" | "multi_race";
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
  picksRevealed: boolean;
  multiRace?: MultiRaceDetail | null;
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
    wageringStyle?: "whole_card" | "live_bankroll";
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
  if (["refunded","no_action","void","cancelled"].includes(status)) return "refunded";
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
type TicketDog = {
  entryId: number | null;
  boxNumber: number | null;
  dogName: string;
};
function selectedTicketDogs(value: unknown): TicketDog[] {
  if (!Array.isArray(value)) return [];
  const dogs = value
    .filter(isObject)
    .map((item) => {
      const entryIdRaw = item.entry_id ?? item.entryId ?? item.id;
      const boxRaw =
        item.box_number ??
        item.boxNumber ??
        item.trap ??
        item.post_position;
      const dogNameRaw = item.dog_name ?? item.dogName ?? item.name;
      const entryId = Number(entryIdRaw);
      const boxNumber = Number(boxRaw);
      return {
        entryId: Number.isFinite(entryId) ? entryId : null,
        boxNumber: Number.isFinite(boxNumber) ? boxNumber : null,
        dogName: String(dogNameRaw ?? "Runner"),
      };
    });
  const unique = new Map<string, TicketDog>();
  for (const dog of dogs) {
    const key =
      dog.entryId !== null
        ? `entry:${dog.entryId}`
        : `box:${dog.boxNumber ?? "x"}:${dog.dogName.toLowerCase()}`;
    if (!unique.has(key)) unique.set(key, dog);
  }
  return Array.from(unique.values()).sort((a, b) => {
    const aBox = a.boxNumber ?? Number.MAX_SAFE_INTEGER;
    const bBox = b.boxNumber ?? Number.MAX_SAFE_INTEGER;
    return aBox - bBox;
  });
}
function ticketDogsForDisplay(wager: Wager): Array<TicketDog & { positionLabel?: string }> {
  const dogs = selectedTicketDogs(wager.selectedDogs);
  const structure = wager.wagerStructure.toLowerCase();
  if (structure !== "straight" || !Array.isArray(wager.combinationJson)) {
    return dogs;
  }
  const firstCombination = wager.combinationJson.find(
    (combo): combo is unknown[] => Array.isArray(combo),
  );
  if (!firstCombination) return dogs;
  const byEntryId = new Map<number, TicketDog>();
  for (const dog of dogs) {
    if (dog.entryId !== null) byEntryId.set(dog.entryId, dog);
  }
  const ordered = firstCombination
    .map((entryId, index) => {
      const id = Number(entryId);
      const dog = byEntryId.get(id);
      if (!dog) return null;
      const ordinal =
        index === 0
          ? "1st"
          : index === 1
            ? "2nd"
            : index === 2
              ? "3rd"
              : index === 3
                ? "4th"
                : `${index + 1}th`;
      return { ...dog, positionLabel: ordinal };
    })
    .filter(
      (dog): dog is TicketDog & { positionLabel: string } => dog !== null,
    );
  return ordered.length > 0 ? ordered : dogs;
}
function wagerTypeLabel(wagerType: string) {
  const labels: Record<string, string> = {
    win: "Win",
    place: "Place",
    show: "Show",
    win_place: "Win + Place",
    win_show: "Win + Show",
    place_show: "Place + Show",
    win_place_show: "Win + Place + Show",
    exacta: "Exacta",
    quinella: "Quinella",
    trifecta: "Trifecta",
    superfecta: "Superfecta",
    pick4: "Pick 4",
    pick5: "Pick 5",
  };
  return labels[wagerType.toLowerCase()] ?? title(wagerType);
}
function isMultiRaceWager(wager:Wager) {
  return wager.ticketKind==="multi_race" || wager.wagerType==="pick4" || wager.wagerType==="pick5" || Boolean(wager.multiRace);
}
function ticketKey(wager:Wager) { return `${isMultiRaceWager(wager) ? "multi" : "standard"}:${wager.id}`; }
function multiRaceLabel(wager:Wager) {
  const legs=wager.multiRace?.legs ?? [];
  const first=legs[0]?.race?.raceNumber ?? wager.raceNumber;
  const last=legs[legs.length-1]?.race?.raceNumber;
  return first && last && first!==last ? `Races ${first}–${last}` : `Race ${first || "—"}`;
}
function multiSelectionLabel(selection:MultiRaceSelection) { return `#${selection.boxNumber ?? "—"} ${selection.dogName}`; }
function combineSameDogWinPlaceShow(wagers: Wager[]): Wager[] {
  const componentTypes = new Set(["win", "place", "show"]);
  const groups = new Map<string, Wager[]>();
  const passthrough: Wager[] = [];
  for (const wager of wagers) {
    const type = wager.wagerType.toLowerCase();
    if (isMultiRaceWager(wager) || !componentTypes.has(type) || wager.selectedEntryIds.length !== 1) {
      passthrough.push(wager);
      continue;
    }
    const createdSecond = wager.createdAt.slice(0, 19);
    const key = [
      wager.racingCardId,
      wager.raceId,
      wager.selectedEntryIds[0],
      wager.denomination,
      createdSecond,
    ].join(":");
    const group = groups.get(key) ?? [];
    group.push(wager);
    groups.set(key, group);
  }
  const combined: Wager[] = [];
  for (const group of groups.values()) {
    const distinctTypes = Array.from(
      new Set(group.map((wager) => wager.wagerType.toLowerCase())),
    );
    if (distinctTypes.length < 2) {
      combined.push(...group);
      continue;
    }
    const typeOrder = ["win", "place", "show"];
    distinctTypes.sort(
      (a, b) => typeOrder.indexOf(a) - typeOrder.indexOf(b),
    );
    const base = group[0];
    const totalCost = group.reduce((sum, wager) => sum + wager.totalCost, 0);
    const officialReturn = group.reduce(
      (sum, wager) => sum + wager.officialReturn,
      0,
    );
    const allRefunded = group.every((wager) => {
      const status = wager.wagerStatus.toLowerCase();
      return status === "refunded" || status === "no_action";
    });
    const anyPending = group.some(
      (wager) => statusGroup(wager) === "pending",
    );
    combined.push({
      ...base,
      id: Math.min(...group.map((wager) => wager.id)),
      wagerType: distinctTypes.join("_"),
      totalCost,
      officialReturn,
      bankrollImpact: group.reduce(
        (sum, wager) => sum + wager.bankrollImpact,
        0,
      ),
      combinationCount: group.reduce(
        (sum, wager) => sum + wager.combinationCount,
        0,
      ),
      wagerStatus: anyPending
        ? "pending"
        : allRefunded
          ? "refunded"
          : officialReturn > 0
            ? "winner"
            : "loser",
      gradingStatus: anyPending ? "pending" : "graded",
      gradedAt: anyPending
        ? null
        : group
            .map((wager) => wager.gradedAt)
            .filter((value): value is string => Boolean(value))
            .sort()
            .at(-1) ?? null,
    });
  }
  return [...passthrough, ...combined].sort((a, b) => {
    const aDay = a.card?.raceDate ?? "";
    const bDay = b.card?.raceDate ?? "";
    if (aDay !== bDay) return aDay.localeCompare(bDay);
    if (a.raceNumber !== b.raceNumber) return a.raceNumber - b.raceNumber;
    return a.id - b.id;
  });
}
function groupWagersByDay(wagers: Wager[]) {
  const groups = new Map<string, Wager[]>();
  for (const wager of combineSameDogWinPlaceShow(wagers)) {
    const day = wager.card?.raceDate ?? "Unknown date";
    const group = groups.get(day) ?? [];
    group.push(wager);
    groups.set(day, group);
  }
  return Array.from(groups.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, dayWagers]) => ({
      day,
      wagers: dayWagers,
      bet: dayWagers.reduce((sum, wager) => sum + wager.totalCost, 0),
      returned: dayWagers.reduce(
        (sum, wager) => sum + wager.officialReturn,
        0,
      ),
    }));
}
function trapStyle(box: number | null): CSSProperties {
  switch (box) {
    case 1:
      return { background: "#d71920", color: "#fff" };
    case 2:
      return { background: "#1266d6", color: "#fff" };
    case 3:
      return { background: "#f4f4f5", color: "#09090b" };
    case 4:
      return { background: "#159447", color: "#fff" };
    case 5:
      return { background: "#111827", color: "#fff" };
    case 6:
      return { background: "#f4d318", color: "#111" };
    case 7:
      return {
        background:
          "linear-gradient(135deg,#159447 0 50%,#f4f4f5 50% 100%)",
        color: "#111",
        textShadow: "0 1px 2px #fff",
      };
    case 8:
      return {
        background:
          "linear-gradient(135deg,#f4d318 0 50%,#111827 50% 100%)",
        color: "#fff",
        textShadow: "0 1px 2px #000",
      };
    default:
      return { background: "#3f3f46", color: "#fff" };
  }
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
      ...(wager.picksRevealed
        ? [...selectedDogLabels(wager.selectedDogs), ...(wager.multiRace?.legs.flatMap((leg)=>[
            `race ${leg.race?.raceNumber ?? ""}`, ...leg.selections.map(multiSelectionLabel),
          ]) ?? [])]
        : []),
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
    useState<Set<string>>(new Set());
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
        return {
          ...entry,
          wagers: [...wagers].sort((a, b) => {
            const aDay = a.card?.raceDate ?? "";
            const bDay = b.card?.raceDate ?? "";
            if (aDay !== bDay) {
              return aDay.localeCompare(bDay);
            }
            if (a.raceNumber !== b.raceNumber) {
              return a.raceNumber - b.raceNumber;
            }
            return a.id - b.id;
          }),
        };
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
  const selectedPersonSummary = useMemo(() => {
    if (teamFilter === "all") return null;
    const entry = (data?.leaderboard ?? []).find(
      (item) => String(item.fantasyTeamId) === teamFilter,
    );
    if (!entry) return null;
    return {
      teamName: entry.teamName,
      totalWagers: entry.totalWagers,
      totalStaked: entry.totalStaked,
      totalReturned: entry.totalReturned,
      pending: entry.pending,
      winners: entry.winners,
      difference: entry.totalReturned - entry.totalStaked,
    };
  }, [data?.leaderboard, teamFilter]);
  function toggleTeam(id: number) {
    setExpandedTeams((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleTicket(id: string) {
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
              League tickets update automatically as Greyhound wagers are graded winner, loser, refunded, or remain open.
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
        {selectedPersonSummary ? (
          <section className={styles.summaryGrid}>
            <article className={styles.summaryCard}>
              <span>{selectedPersonSummary.teamName} · Wagered</span>
              <strong>{money(selectedPersonSummary.totalStaked)}</strong>
              <small>{selectedPersonSummary.totalWagers} tickets</small>
            </article>
            <article className={styles.summaryCard}>
              <span>Returned</span>
              <strong>{money(selectedPersonSummary.totalReturned)}</strong>
              <small>{selectedPersonSummary.winners} winning tickets</small>
            </article>
            <article className={styles.summaryCard}>
              <span>
                {selectedPersonSummary.difference >= 0 ? "Winning" : "Losing"}
              </span>
              <strong>
                {selectedPersonSummary.difference >= 0 ? "+" : "-"}
                {money(Math.abs(selectedPersonSummary.difference))}
              </strong>
              <small>Return minus wagered</small>
            </article>
            <article className={styles.summaryCard}>
              <span>Open Tickets</span>
              <strong>{selectedPersonSummary.pending}</strong>
              <small>Live / awaiting grade</small>
            </article>
          </section>
        ) : null}
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
                      <span>
                        {entry.totalReturned - entry.totalStaked >= 0
                          ? "Winning"
                          : "Losing"}
                      </span>
                      <strong>
                        {entry.totalReturned - entry.totalStaked >= 0 ? "+" : "-"}
                        {money(Math.abs(entry.totalReturned - entry.totalStaked))}
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
                          groupWagersByDay(entry.wagers).map((dayGroup) => (
                            <details
                              key={dayGroup.day}
                              style={{
                                border: "1px solid rgba(255,255,255,.09)",
                                borderRadius: 12,
                                background: "rgba(0,0,0,.18)",
                                overflow: "hidden",
                              }}
                            >
                              <summary
                                style={{
                                  cursor: "pointer",
                                  listStyle: "none",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                  gap: 10,
                                  padding: "9px 10px",
                                  fontWeight: 950,
                                  color: "#fff",
                                }}
                              >
                                <span>{dateLabel(dayGroup.day)}</span>
                                <span
                                  style={{
                                    color: "#a1a1aa",
                                    fontSize: 11,
                                    fontWeight: 850,
                                  }}
                                >
                                  {dayGroup.wagers.length} tickets · Bet{" "}
                                  {money(dayGroup.bet)} · Return{" "}
                                  {money(dayGroup.returned)}
                                </span>
                              </summary>
                              <div
                                style={{
                                  display: "grid",
                                  gap: 6,
                                  padding: "0 6px 6px",
                                }}
                              >
                                {dayGroup.wagers.map((wager) => {
                            const key = ticketKey(wager);
                            const isMultiRace = isMultiRaceWager(wager);
                            const ticketExpanded = expandedTickets.has(key);
                            const ticketDogs = ticketDogsForDisplay(wager);
                            const ticketBoxes = new Set(
                              ticketDogs
                                .map((dog) => dog.boxNumber)
                                .filter((box): box is number => box !== null),
                            );
                            const usesAllDogs =
                              ticketBoxes.size === 8 &&
                              Array.from({ length: 8 }, (_, index) => index + 1).every(
                                (box) => ticketBoxes.has(box),
                              );
                            const dogNames = selectedDogLabels(
                              wager.selectedDogs,
                            );
                            const combos = combinationLines(
                              wager.combinationJson,
                              wager.selectedDogs,
                            );
                            return (
                              <article
                                key={key}
                                className={styles.ticketCard}
                              >
                                <div className={styles.ticketTop}>
                                  <div>
                                    <div className={styles.raceTitle}>
                                      {wager.track?.name ??
                                        wager.track?.code ??
                                        "Track"}{" "}
                                      · {isMultiRace ? multiRaceLabel(wager) : `Race ${wager.raceNumber}`}
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
                                        {money(wager.denomination)} BET
                                      </span>
                                      <span>
                                        {wagerTypeLabel(wager.wagerType)}
                                      </span>
                                      <span>{isMultiRace ? `${wager.multiRace?.legCount ?? (wager.wagerType === "pick5" ? 5 : 4)} Races` : title(wager.wagerStructure)}</span>
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
                                <div
                                  className={styles.ticketGrid}
                                  style={{
                                    gridTemplateColumns:
                                      "repeat(3,minmax(0,1fr))",
                                  }}
                                >
                                  <div>
                                    <span>Bet</span>
                                    <strong>{money(wager.totalCost)}</strong>
                                  </div>
                                  <div>
                                    <span>Return</span>
                                    <strong>
                                      {statusGroup(wager) === "pending"
                                        ? "—"
                                        : money(wager.officialReturn)}
                                    </strong>
                                  </div>
                                  <div>
                                    <span>Difference</span>
                                    <strong>
                                      {statusGroup(wager) === "pending"
                                        ? "—"
                                        : `${wager.officialReturn - wager.totalCost >= 0 ? "+" : "-"}${money(
                                            Math.abs(
                                              wager.officialReturn -
                                                wager.totalCost,
                                            ),
                                          )}`}
                                    </strong>
                                  </div>
                                </div>
                                {wager.picksRevealed ? (
                                  isMultiRace && wager.multiRace ? (
                                    <div className={styles.runners}>
                                      <span>{wagerTypeLabel(wager.wagerType)} Selections</span>
                                      <div style={{display:"grid",gap:6,marginTop:4}}>
                                        {wager.multiRace.legs.map((leg)=>(
                                          <div key={`${key}-leg-${leg.legNumber}`} style={{padding:"7px 9px",border:"1px solid rgba(255,255,255,.09)",borderRadius:10,background:"rgba(0,0,0,.22)"}}>
                                            <strong style={{display:"block",marginBottom:5,color:"#fb923c",fontSize:11}}>Leg {leg.legNumber} · Race {leg.race?.raceNumber ?? "—"}</strong>
                                            <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                                              {leg.selections.length ? leg.selections.map((selection)=>(
                                                <span key={`${key}-${leg.legNumber}-${selection.entryId}`} style={{display:"inline-flex",alignItems:"center",gap:6}}>
                                                  <i style={{...trapStyle(selection.boxNumber),width:27,height:27,borderRadius:999,display:"grid",placeItems:"center",fontStyle:"normal",fontSize:12,fontWeight:950,border:"1px solid rgba(255,255,255,.18)"}}>{selection.boxNumber ?? "—"}</i>
                                                  <b style={{fontSize:12}}>{selection.dogName}</b>
                                                </span>
                                              )) : <b>Selection unavailable</b>}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  ) : ticketDogs.length > 0 ? (
                                    <div className={styles.runners}>
                                      <span>Selected Dogs</span>
                                      {usesAllDogs ? (
                                        <div style={{marginTop:4,padding:"7px 9px",border:"1px solid rgba(255,122,26,.30)",borderRadius:9,background:"rgba(255,122,26,.07)",color:"#ff9b54",fontSize:12,fontWeight:950}}>ALL DOGS</div>
                                      ) : (
                                        <div style={{display:"grid",gap:4,marginTop:4}}>
                                          {ticketDogs.map((dog,index)=>(
                                            <div key={`${key}-dog-${dog.entryId ?? index}`} style={{display:"grid",gridTemplateColumns:"34px minmax(0,1fr)",alignItems:"center",gap:7,padding:"6px 8px",border:"1px solid rgba(255,255,255,.08)",borderRadius:10,background:"rgba(0,0,0,.22)"}}>
                                              <span style={{...trapStyle(dog.boxNumber),width:27,height:27,borderRadius:999,display:"grid",placeItems:"center",fontSize:12,fontWeight:950,border:"1px solid rgba(255,255,255,.18)"}}>{dog.boxNumber ?? "—"}</span>
                                              <div style={{display:"flex",alignItems:"center",gap:7,minWidth:0}}>
                                                {dog.positionLabel ? <span style={{color:"#fb923c",fontSize:11,fontWeight:950,flex:"0 0 auto"}}>{dog.positionLabel}</span> : null}
                                                <strong style={{color:"#fff",fontSize:12,fontWeight:900,minWidth:0}}>{dog.dogName}</strong>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  ) : null
                                ) : (
                                  <div className={styles.runners}><span>Selections</span><div><strong>🔒 Picks hidden until reveal</strong></div></div>
                                )}
                                <div className={styles.cardFooter} style={{ display: "none" }}>
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
                                      toggleTicket(key)
                                    }
                                  >
                                    {ticketExpanded
                                      ? "Hide Details"
                                      : "Ticket Details"}
                                  </button>
                                </div>
                                {false && ticketExpanded ? (
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
                                    {!wager.picksRevealed ? (
                                      <div className={styles.comboBlock}>
                                        <span>Selections Locked</span>
                                        <div>
                                          <code>
                                            {data?.competition?.wageringStyle ===
                                            "live_bankroll"
                                              ? "Picks reveal when this race is live/locked."
                                              : "Picks reveal when the race card locks."}
                                          </code>
                                        </div>
                                      </div>
                                    ) : null}
                                    {wager.picksRevealed && combos.length > 0 ? (
                                      <div
                                        className={styles.comboBlock}
                                      >
                                        <span>Combinations</span>
                                        <div>
                                          {combos.map(
                                            (combo, index) => (
                                              <code
                                                key={`${key}-combo-${index}`}
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
                                })}
                              </div>
                            </details>
                          ))
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
