"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import styles from "./GreyhoundMyWagers.module.css";

type Selection = {
  entryId: number;
  dogId: number | null;
  dogName: string | null;
  boxNumber: number | null;
  entryStatus: string | null;
};

type Wager = {
  id: number;
  race: {
    id: number;
    raceNumber: number;
    grade: string | null;
    distanceYards: number | null;
    scheduledPostTime: string | null;
    actualPostTime: string | null;
    status: string;
  } | null;
  wagerType: string;
  wagerStructure: string;
  denomination: number;
  combinationCount: number;
  totalCost: number;
  selectedEntryIds: number[];
  selections: Selection[];
  combinationJson: unknown;
  alternate1: Selection | null;
  alternate2: Selection | null;
  wagerStatus: string;
  gradingStatus: string;
  officialReturn: number;
  refundReason: string | null;
  gradedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type CardGroup = {
  bankrollCardId: number;
  card: {
    id: number;
    raceDate: string;
    session: string | null;
    status: string;
    lockAt: string | null;
    finalizedAt: string | null;
  } | null;
  track: {
    id: number;
    code: string;
    name: string | null;
  } | null;
  bankroll: {
    startingBankroll: number;
    amountAllocated: number;
    amountUnallocated: number;
    officialReturn: number;
    status: string;
    submittedAt: string | null;
    lockedAt: string | null;
    finalizedAt: string | null;
  };
  totals: {
    wagerCount: number;
    totalStaked: number;
    totalReturned: number;
    net: number;
  };
  wagers: Wager[];
};

type ApiResponse = {
  success: boolean;
  error?: string;
  league?: {
    id: string;
    name: string;
  };
  participant?: {
    fantasyTeamId: number;
    participantId: number | null;
    gameFormat: string | null;
    namingMode: "entry" | "team";
    entryName: string | null;
    competitionTeamId: number | null;
    teamNumber: number | null;
    teamName: string | null;
    canEditName: boolean;
  } | null;
  summary?: {
    totalCards: number;
    totalWagers: number;
    totalStaked: number;
    totalReturned: number;
    net: number;
    pendingWagers: number;
    winningWagers: number;
    losingWagers: number;
    refundedWagers: number;
  };
  currentCards?: CardGroup[];
  completedCards?: CardGroup[];
};

type Props = {
  leagueId: string;
  embedded?: boolean;
  onSelectTrack?: (trackCode: "GWD" | "GTS") => void;
};

type Filter =
  | "all"
  | "pending"
  | "winner"
  | "loser"
  | "refunded";

const FILTER_LABELS: Record<Filter, string> = {
  all: "All",
  pending: "Pending",
  winner: "Won",
  loser: "Lost",
  refunded: "Refunded / Void / Cancelled",
};

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

function titleCase(value: string | null | undefined) {
  if (!value) {
    return "—";
  }

  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function dateOnly(value: string | null | undefined) {
  if (!value) {
    return "Date TBD";
  }

  const parsed = new Date(`${value}T12:00:00`);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function dateTime(value: string | null | undefined) {
  if (!value) {
    return "—";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function wagerStatusGroup(wager: Wager): Exclude<Filter, "all"> {
  const status = String(wager.wagerStatus ?? "").toLowerCase();

  if (status === "winner") {
    return "winner";
  }

  if (status === "loser") {
    return "loser";
  }

  if (
    status === "refunded" ||
    status === "no_action" ||
    status === "void" ||
    status === "cancelled"
  ) {
    return "refunded";
  }

  return "pending";
}

function statusText(wager: Wager) {
  const status = wagerStatusGroup(wager);

  if (status === "winner") {
    return "Won";
  }

  if (status === "loser") {
    return "Lost";
  }

  if (status === "refunded") {
    const rawStatus = String(wager.wagerStatus ?? "").toLowerCase();
    const refundReason = String(wager.refundReason ?? "").toLowerCase();

    if (rawStatus === "cancelled" || refundReason.startsWith("cancelled by member")) {
      return "Cancelled";
    }

    return rawStatus === "no_action"
      ? "No Action"
      : "Refunded";
  }

  if (String(wager.wagerStatus).toLowerCase() === "locked") {
    return "Locked";
  }

  return "Pending";
}

function profitLoss(wager: Wager) {
  if (wagerStatusGroup(wager) === "pending") {
    return null;
  }

  return wager.officialReturn - wager.totalCost;
}

function canCancelWager(wager: Wager, cardGroup: CardGroup) {
  if (String(wager.wagerStatus ?? "").toLowerCase() !== "pending") {
    return false;
  }

  const cardStatus = String(cardGroup.card?.status ?? "").toLowerCase();
  const bankrollStatus = String(cardGroup.bankroll.status ?? "").toLowerCase();
  const closedStatuses = new Set([
    "locked",
    "in_progress",
    "final",
    "cancelled",
  ]);

  if (closedStatuses.has(cardStatus) || closedStatuses.has(bankrollStatus)) {
    return false;
  }

  const lockAt = cardGroup.card?.lockAt ?? cardGroup.bankroll.lockedAt;

  if (lockAt) {
    const lockMs = new Date(lockAt).getTime();

    if (Number.isFinite(lockMs) && lockMs <= Date.now()) {
      return false;
    }
  }

  return true;
}

function selectionLabel(selection: Selection) {
  const box =
    selection.boxNumber !== null
      ? `#${selection.boxNumber}`
      : "Trap —";

  return `${box} ${selection.dogName ?? "Runner"}`;
}

function combinationLines(wager: Wager) {
  if (!Array.isArray(wager.combinationJson)) {
    return [];
  }

  const selectionByEntryId = new Map(
    wager.selections.map((selection) => [
      selection.entryId,
      selection,
    ]),
  );

  return wager.combinationJson
    .filter((value): value is unknown[] => Array.isArray(value))
    .map((combo) =>
      combo
        .map((value) => {
          const id = Number(value);
          const selection = selectionByEntryId.get(id);

          return selection
            ? selectionLabel(selection)
            : `Entry ${id}`;
        })
        .join(" → "),
    );
}

export default function GreyhoundMyWagers({
  leagueId,
  embedded = false,
  onSelectTrack,
}: Props) {
  const [data, setData] =
    useState<ApiResponse | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const [filter, setFilter] =
    useState<Filter>("all");

  const [nameDraft, setNameDraft] =
    useState("");

  const [editingName, setEditingName] =
    useState(false);

  const [savingName, setSavingName] =
    useState(false);

  const [nameMessage, setNameMessage] =
    useState<string | null>(null);

  const [wagerMessage, setWagerMessage] =
    useState<string | null>(null);

  const [cancellingWagerId, setCancellingWagerId] =
    useState<number | null>(null);

  const [expandedIds, setExpandedIds] =
    useState<Set<number>>(new Set());

  const load = useCallback(
    async (silent = false) => {
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError(null);

      try {
        const response = await fetch(
          `/api/greyhound/my-wagers?leagueId=${encodeURIComponent(
            leagueId,
          )}`,
          {
            method: "GET",
            cache: "no-store",
          },
        );

        const payload =
          (await response.json()) as ApiResponse;

        if (!response.ok || !payload.success) {
          throw new Error(
            payload.error ??
              "Unable to load your Greyhound wagers.",
          );
        }

        setData(payload);

        const participantName =
          payload.participant?.namingMode === "team"
            ? payload.participant.teamName
            : payload.participant?.entryName;

        setNameDraft(participantName ?? "");
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load your Greyhound wagers.",
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

  const allCards = useMemo(
    () => [
      ...(data?.currentCards ?? []),
      ...(data?.completedCards ?? []),
    ],
    [data?.currentCards, data?.completedCards],
  );

  const hasPendingWagers = useMemo(
    () =>
      allCards.some((card) =>
        card.wagers.some(
          (wager) =>
            wagerStatusGroup(wager) === "pending",
        ),
      ),
    [allCards],
  );

  useEffect(() => {
    if (!hasPendingWagers) {
      return;
    }

    const interval = window.setInterval(() => {
      void load(true);
    }, 30000);

    return () => window.clearInterval(interval);
  }, [hasPendingWagers, load]);

  const summary = data?.summary ?? {
    totalCards: 0,
    totalWagers: 0,
    totalStaked: 0,
    totalReturned: 0,
    net: 0,
    pendingWagers: 0,
    winningWagers: 0,
    losingWagers: 0,
    refundedWagers: 0,
  };

  const filteredCards = useMemo(
    () =>
      allCards
        .map((card) => ({
          ...card,
          wagers:
            filter === "all"
              ? card.wagers
              : card.wagers.filter(
                  (wager) =>
                    wagerStatusGroup(wager) === filter,
                ),
        }))
        .filter((card) => card.wagers.length > 0),
    [allCards, filter],
  );


  async function saveParticipantName() {
    if (!data?.participant?.canEditName) {
      return;
    }

    const name = nameDraft.replace(/\s+/g, " ").trim();

    if (name.length < 2) {
      setError("Name must be at least 2 characters.");
      return;
    }

    setSavingName(true);
    setError(null);
    setNameMessage(null);

    try {
      const response = await fetch(
        "/api/greyhound/my-wagers",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            leagueId,
            action: "save_name",
            name,
          }),
        },
      );

      const payload = (await response.json()) as {
        success?: boolean;
        error?: string;
        participant?: ApiResponse["participant"];
      };

      if (!response.ok || !payload.success || !payload.participant) {
        throw new Error(
          payload.error ?? "Unable to save Greyhound name.",
        );
      }

      setData((current) =>
        current
          ? {
              ...current,
              participant: payload.participant ?? current.participant,
            }
          : current,
      );

      const savedName =
        payload.participant.namingMode === "team"
          ? payload.participant.teamName
          : payload.participant.entryName;

      setNameDraft(savedName ?? name);
      setEditingName(false);
      setNameMessage(
        payload.participant.namingMode === "team"
          ? "Team Name saved."
          : "Entry Name saved.",
      );
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save Greyhound name.",
      );
    } finally {
      setSavingName(false);
    }
  }

  async function cancelWager(wager: Wager) {
    if (cancellingWagerId !== null) {
      return;
    }

    const confirmed = window.confirm(
      `Cancel this ${money(wager.totalCost)} ${titleCase(
        wager.wagerType,
      )} wager? The amount will be restored to your available bankroll.`,
    );

    if (!confirmed) {
      return;
    }

    setCancellingWagerId(wager.id);
    setError(null);
    setWagerMessage(null);

    try {
      const response = await fetch(
        "/api/greyhound/my-wagers",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            leagueId,
            action: "cancel_wager",
            wagerId: wager.id,
          }),
        },
      );

      const payload = (await response.json()) as {
        success?: boolean;
        error?: string;
        message?: string;
      };

      if (!response.ok || !payload.success) {
        throw new Error(
          payload.error ?? "Unable to cancel Greyhound wager.",
        );
      }

      setWagerMessage(
        payload.message ??
          `${money(wager.totalCost)} restored to your available bankroll.`,
      );

      setExpandedIds((current) => {
        const next = new Set(current);
        next.delete(wager.id);
        return next;
      });

      await load(true);
    } catch (cancelError) {
      setError(
        cancelError instanceof Error
          ? cancelError.message
          : "Unable to cancel Greyhound wager.",
      );
    } finally {
      setCancellingWagerId(null);
    }
  }

  function toggleExpanded(wagerId: number) {
    setExpandedIds((current) => {
      const next = new Set(current);

      if (next.has(wagerId)) {
        next.delete(wagerId);
      } else {
        next.add(wagerId);
      }

      return next;
    });
  }

  if (loading && !data) {
    return (
      <div className={styles.loadingCard}>
        Loading your Greyhound wagers…
      </div>
    );
  }

  return (
    <section className={styles.page}>
      {embedded ? (
        <div className={styles.embeddedHeader}>
          <div>
            <div className={styles.eyebrow}>
              Bet History
            </div>
            <h2>My Wagers</h2>
            <p>
              Pending tickets move here automatically as races are graded.
            </p>
          </div>

          <button
            type="button"
            className={styles.refreshButton}
            onClick={() => void load(true)}
            disabled={refreshing}
          >
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      ) : (
        <header className={styles.hero}>
          <div>
            <div className={styles.eyebrow}>
              G365 Greyhound Racing
            </div>

            <h1>My Wagers</h1>

            <p>
              Review pending tickets, official results,
              payouts, refunds, and bankroll impact.
            </p>
          </div>

          <button
            type="button"
            className={styles.refreshButton}
            onClick={() => void load(true)}
            disabled={refreshing}
          >
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </header>
      )}

      {error ? (
        <div className={styles.errorBar}>
          {error}
        </div>
      ) : null}

      {wagerMessage ? (
        <div className={styles.successBar}>
          {wagerMessage}
        </div>
      ) : null}

      {data?.participant ? (
        <div className={styles.identityCard}>
          <div className={styles.identityCopy}>
            <span className={styles.eyebrow}>
              {data.participant.namingMode === "team"
                ? "Greyhound Team"
                : "Greyhound Entry"}
            </span>

            <div className={styles.identityTitleRow}>
              <strong>
                {data.participant.namingMode === "team"
                  ? data.participant.teamName ||
                    (data.participant.teamNumber
                      ? `Team ${data.participant.teamNumber}`
                      : "Team Name Not Set")
                  : data.participant.entryName ||
                    "Entry Name Not Set"}
              </strong>

              {data.participant.namingMode === "team" &&
              data.participant.teamNumber ? (
                <small>TEAM {data.participant.teamNumber}</small>
              ) : null}
            </div>

            <p>
              {data.participant.namingMode === "team"
                ? "This shared Team Name is used anywhere your Greyhound competition team is shown."
                : "This Entry Name is your display identity for this Greyhound league."}
            </p>
          </div>

          {editingName ? (
            <div className={styles.identityEditor}>
              <label htmlFor="greyhound-entry-name">
                {data.participant.namingMode === "team"
                  ? "Team Name"
                  : "Entry Name"}
              </label>

              <input
                id="greyhound-entry-name"
                type="text"
                maxLength={60}
                value={nameDraft}
                disabled={savingName}
                onChange={(event) =>
                  setNameDraft(event.target.value)
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void saveParticipantName();
                  }

                  if (event.key === "Escape") {
                    setEditingName(false);
                    setNameDraft(
                      data.participant?.namingMode === "team"
                        ? data.participant?.teamName ?? ""
                        : data.participant?.entryName ?? "",
                    );
                  }
                }}
              />

              <div className={styles.identityActions}>
                <button
                  type="button"
                  className={styles.identityCancel}
                  disabled={savingName}
                  onClick={() => {
                    setEditingName(false);
                    setNameDraft(
                      data.participant?.namingMode === "team"
                        ? data.participant?.teamName ?? ""
                        : data.participant?.entryName ?? "",
                    );
                  }}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className={styles.identitySave}
                  disabled={
                    savingName ||
                    nameDraft.trim().length < 2
                  }
                  onClick={() => void saveParticipantName()}
                >
                  {savingName ? "Saving…" : "Save Name"}
                </button>
              </div>
            </div>
          ) : (
            <div className={styles.identityControls}>
              {nameMessage ? (
                <span className={styles.identitySaved}>
                  {nameMessage}
                </span>
              ) : null}

              <button
                type="button"
                className={styles.identityEdit}
                disabled={!data.participant.canEditName}
                onClick={() => {
                  setNameMessage(null);
                  setEditingName(true);
                }}
              >
                {data.participant.namingMode === "team"
                  ? data.participant.teamName
                    ? "Edit Team Name"
                    : "Create Team Name"
                  : data.participant.entryName
                    ? "Edit Entry Name"
                    : "Create Entry Name"}
              </button>

              {!data.participant.canEditName ? (
                <small className={styles.identityHelp}>
                  {data.participant.namingMode === "team"
                    ? "You must be assigned to a competition team before the Team Name can be edited."
                    : "Your Greyhound participant identity is still being created."}
                </small>
              ) : null}
            </div>
          )}
        </div>
      ) : null}

      {embedded && onSelectTrack ? (
        <div className={styles.trackBetBar}>
          <div>
            <span className={styles.eyebrow}>Bet Today&apos;s Races</span>
            <strong>Choose a track to return to the betting board.</strong>
          </div>
          <div className={styles.trackBetButtons}>
            <button type="button" onClick={() => onSelectTrack("GWD")}>
              Wheeling
            </button>
            <button type="button" onClick={() => onSelectTrack("GTS")}>
              Tri-State
            </button>
          </div>
        </div>
      ) : null}

      {!data?.participant ? (
        <div className={styles.emptyCard}>
          <strong>No Greyhound entry found</strong>
          <span>
            Join this Greyhound league before wager history
            can be displayed.
          </span>
        </div>
      ) : (
        <>
          <div className={styles.summaryGrid}>
            <div className={styles.summaryCard}>
              <span>Total Wagered</span>
              <strong>
                {money(summary.totalStaked)}
              </strong>
            </div>

            <div className={styles.summaryCard}>
              <span>Total Returned</span>
              <strong>
                {money(summary.totalReturned)}
              </strong>
            </div>

            <div className={styles.summaryCard}>
              <span>Net</span>
              <strong
                className={
                  summary.net > 0
                    ? styles.positive
                    : summary.net < 0
                      ? styles.negative
                      : ""
                }
              >
                {summary.net > 0 ? "+" : ""}
                {money(summary.net)}
              </strong>
            </div>

            <div className={styles.summaryCard}>
              <span>Pending</span>
              <strong>
                {summary.pendingWagers}
              </strong>
            </div>

            <div className={styles.summaryCard}>
              <span>Won</span>
              <strong className={styles.positive}>
                {summary.winningWagers}
              </strong>
            </div>

            <div className={styles.summaryCard}>
              <span>Lost</span>
              <strong className={styles.negative}>
                {summary.losingWagers}
              </strong>
            </div>
          </div>

          <div className={styles.filterBar}>
            {(Object.keys(FILTER_LABELS) as Filter[]).map(
              (option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setFilter(option)}
                  className={`${styles.filterButton} ${
                    filter === option
                      ? styles.filterButtonActive
                      : ""
                  }`}
                >
                  {FILTER_LABELS[option]}
                </button>
              ),
            )}
          </div>

          {filteredCards.length === 0 ? (
            <div className={styles.emptyCard}>
              <strong>No wagers to show</strong>
              <span>
                {filter === "all"
                  ? "Your Greyhound tickets will appear here after you place a wager."
                  : `You do not have any ${FILTER_LABELS[
                      filter
                    ].toLowerCase()} wagers yet.`}
              </span>
            </div>
          ) : (
            <div className={styles.cardList}>
              {filteredCards.map((cardGroup) => {
                const trackName =
                  cardGroup.track?.name ??
                  cardGroup.track?.code ??
                  "Greyhound Track";

                return (
                  <article
                    key={cardGroup.bankrollCardId}
                    className={styles.cardGroup}
                  >
                    <div className={styles.cardHeader}>
                      <div>
                        <div className={styles.cardTrack}>
                          {trackName}
                        </div>

                        <div className={styles.cardMeta}>
                          <span>
                            {dateOnly(
                              cardGroup.card?.raceDate,
                            )}
                          </span>

                          {cardGroup.card?.session ? (
                            <span>
                              {titleCase(
                                cardGroup.card.session,
                              )}
                            </span>
                          ) : null}

                          <span>
                            {titleCase(
                              cardGroup.card?.status ??
                                cardGroup.bankroll.status,
                            )}
                          </span>
                        </div>
                      </div>

                      <div className={styles.cardTotals}>
                        <div>
                          <span>Wagered</span>
                          <strong>
                            {money(
                              cardGroup.totals.totalStaked,
                            )}
                          </strong>
                        </div>

                        <div>
                          <span>Returned</span>
                          <strong>
                            {money(
                              cardGroup.totals
                                .totalReturned,
                            )}
                          </strong>
                        </div>

                        <div>
                          <span>Net</span>
                          <strong
                            className={
                              cardGroup.totals.net > 0
                                ? styles.positive
                                : cardGroup.totals.net < 0
                                  ? styles.negative
                                  : ""
                            }
                          >
                            {cardGroup.totals.net > 0
                              ? "+"
                              : ""}
                            {money(
                              cardGroup.totals.net,
                            )}
                          </strong>
                        </div>
                      </div>
                    </div>

                    <div className={styles.ticketList}>
                      {cardGroup.wagers.map((wager) => {
                        const status =
                          wagerStatusGroup(wager);

                        const expanded =
                          expandedIds.has(wager.id);

                        const net =
                          profitLoss(wager);

                        const combinations =
                          combinationLines(wager);

                        const cancellable =
                          canCancelWager(wager, cardGroup);

                        return (
                          <div
                            key={wager.id}
                            className={styles.ticket}
                          >
                            <button
                              type="button"
                              className={styles.ticketMain}
                              onClick={() =>
                                toggleExpanded(wager.id)
                              }
                              aria-expanded={expanded}
                            >
                              <div className={styles.ticketRace}>
                                <span>
                                  Race{" "}
                                  {wager.race?.raceNumber ??
                                    "—"}
                                </span>

                                <small>
                                  {wager.race?.grade
                                    ? `${wager.race.grade} • `
                                    : ""}
                                  {wager.race
                                    ?.distanceYards
                                    ? `${wager.race.distanceYards} yds`
                                    : "Distance —"}
                                </small>
                              </div>

                              <div className={styles.ticketType}>
                                <strong>
                                  {titleCase(
                                    wager.wagerType,
                                  )}
                                </strong>

                                <small>
                                  {titleCase(
                                    wager.wagerStructure,
                                  )}
                                </small>
                              </div>

                              <div className={styles.ticketSelections}>
                                {wager.selections.length > 0 ? (
                                  wager.selections.map(
                                    (selection) => (
                                      <span
                                        key={
                                          selection.entryId
                                        }
                                      >
                                        {selectionLabel(
                                          selection,
                                        )}
                                      </span>
                                    ),
                                  )
                                ) : (
                                  <span>
                                    Selection details
                                    unavailable
                                  </span>
                                )}
                              </div>

                              <div className={styles.ticketMoney}>
                                <span>
                                  {money(wager.totalCost)}
                                </span>
                                <small>
                                  {wager.combinationCount}{" "}
                                  {wager.combinationCount ===
                                  1
                                    ? "combo"
                                    : "combos"}{" "}
                                  @{" "}
                                  {money(
                                    wager.denomination,
                                  )}
                                </small>
                              </div>

                              <div
                                className={`${styles.statusBadge} ${
                                  status === "winner"
                                    ? styles.statusWon
                                    : status === "loser"
                                      ? styles.statusLost
                                      : status ===
                                          "refunded"
                                        ? styles.statusRefunded
                                        : styles.statusPending
                                }`}
                              >
                                {statusText(wager)}
                              </div>

                              <div className={styles.chevron}>
                                {expanded ? "−" : "+"}
                              </div>
                            </button>

                            {expanded ? (
                              <div
                                className={
                                  styles.ticketDetails
                                }
                              >
                                <div
                                  className={
                                    styles.detailGrid
                                  }
                                >
                                  <div>
                                    <span>
                                      Placed
                                    </span>
                                    <strong>
                                      {dateTime(
                                        wager.createdAt,
                                      )}
                                    </strong>
                                  </div>

                                  <div>
                                    <span>
                                      Race Post
                                    </span>
                                    <strong>
                                      {dateTime(
                                        wager.race
                                          ?.scheduledPostTime,
                                      )}
                                    </strong>
                                  </div>

                                  <div>
                                    <span>
                                      Grading
                                    </span>
                                    <strong>
                                      {titleCase(
                                        wager.gradingStatus,
                                      )}
                                    </strong>
                                  </div>

                                  <div>
                                    <span>
                                      Official Return
                                    </span>
                                    <strong>
                                      {money(
                                        wager.officialReturn,
                                      )}
                                    </strong>
                                  </div>

                                  <div>
                                    <span>
                                      Profit / Loss
                                    </span>
                                    <strong
                                      className={
                                        net === null
                                          ? ""
                                          : net > 0
                                            ? styles.positive
                                            : net < 0
                                              ? styles.negative
                                              : ""
                                      }
                                    >
                                      {net === null
                                        ? "Pending"
                                        : `${
                                            net > 0
                                              ? "+"
                                              : ""
                                          }${money(net)}`}
                                    </strong>
                                  </div>

                                  <div>
                                    <span>
                                      Graded
                                    </span>
                                    <strong>
                                      {dateTime(
                                        wager.gradedAt,
                                      )}
                                    </strong>
                                  </div>
                                </div>

                                {combinations.length > 0 ? (
                                  <div
                                    className={
                                      styles.combinationBox
                                    }
                                  >
                                    <div
                                      className={
                                        styles.detailLabel
                                      }
                                    >
                                      Ticket Combinations
                                    </div>

                                    <div
                                      className={
                                        styles.combinationList
                                      }
                                    >
                                      {combinations.map(
                                        (
                                          combination,
                                          index,
                                        ) => (
                                          <div
                                            key={`${wager.id}-combo-${index}`}
                                          >
                                            <span>
                                              {index + 1}
                                            </span>
                                            <strong>
                                              {
                                                combination
                                              }
                                            </strong>
                                          </div>
                                        ),
                                      )}
                                    </div>
                                  </div>
                                ) : null}

                                {wager.alternate1 ||
                                wager.alternate2 ? (
                                  <div
                                    className={
                                      styles.alternateBox
                                    }
                                  >
                                    <div
                                      className={
                                        styles.detailLabel
                                      }
                                    >
                                      Alternates
                                    </div>

                                    {wager.alternate1 ? (
                                      <span>
                                        1.{" "}
                                        {selectionLabel(
                                          wager.alternate1,
                                        )}
                                      </span>
                                    ) : null}

                                    {wager.alternate2 ? (
                                      <span>
                                        2.{" "}
                                        {selectionLabel(
                                          wager.alternate2,
                                        )}
                                      </span>
                                    ) : null}
                                  </div>
                                ) : null}

                                {wager.refundReason ? (
                                  <div
                                    className={
                                      styles.refundBox
                                    }
                                  >
                                    <strong>
                                      {String(
                                        wager.refundReason ?? "",
                                      )
                                        .toLowerCase()
                                        .startsWith("cancelled by member")
                                        ? "Cancelled Wager"
                                        : "Refund / No Action"}
                                    </strong>
                                    <span>
                                      {
                                        wager.refundReason
                                      }
                                    </span>
                                  </div>
                                ) : null}

                                {cancellable ? (
                                  <div className={styles.cancelWagerBox}>
                                    <div>
                                      <strong>Cancel this wager</strong>
                                      <span>
                                        Available only before the whole card locks 5 minutes before Race 1.
                                      </span>
                                    </div>

                                    <button
                                      type="button"
                                      className={styles.cancelWagerButton}
                                      disabled={
                                        cancellingWagerId !== null
                                      }
                                      onClick={() =>
                                        void cancelWager(wager)
                                      }
                                    >
                                      {cancellingWagerId === wager.id
                                        ? "Cancelling…"
                                        : `Cancel Wager • ${money(
                                            wager.totalCost,
                                          )}`}
                                    </button>
                                  </div>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>

                    <div className={styles.bankrollFooter}>
                      <div>
                        <span>Starting Bankroll</span>
                        <strong>
                          {money(
                            cardGroup.bankroll
                              .startingBankroll,
                          )}
                        </strong>
                      </div>

                      <div>
                        <span>Wagered</span>
                        <strong>
                          {money(
                            cardGroup.bankroll
                              .amountAllocated,
                          )}
                        </strong>
                      </div>

                      <div>
                        <span>Available</span>
                        <strong>
                          {money(
                            cardGroup.bankroll
                              .amountUnallocated,
                          )}
                        </strong>
                      </div>

                      <div>
                        <span>Official Return</span>
                        <strong>
                          {money(
                            cardGroup.bankroll
                              .officialReturn,
                          )}
                        </strong>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {hasPendingWagers ? (
            <div className={styles.liveNote}>
              Pending tickets refresh automatically every 30
              seconds.
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}