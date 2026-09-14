"use client";

import Link from "next/link";

import GreyhoundH2HScheduleManager from "@/components/greyhound/GreyhoundH2HScheduleManager";
import { useCallback, useEffect, useMemo, useState } from "react";

type RoundRow = {
  id: number;
  round_number: number;
  round_name: string;
  start_date: string;
  end_date: string;
  number_of_days: number;
  status: string;
  started_at: string | null;
  finalized_at: string | null;
  advance_count: number | null;
};

type RoundParticipant = {
  round_id: number;
  participant_id: number;
  status: string;
  total_wagered: number | string;
  total_returned: number | string;
  net: number | string;
  round_rank: number | null;
  eliminated_at: string | null;
  advanced_at: string | null;
};

type ParticipantIdentity = {
  participantId: number;
  name: string;
};

type SurvivorScore = {
  participantId: number;
  participantName: string;
  totalWagered: number;
  totalReturned: number;
  net: number;
  rank: number;
};

type SurvivorRefreshResult = {
  success?: boolean;
  error?: string;
  status?:
    | "scheduled"
    | "active"
    | "final"
    | "blocked_tie"
    | "blocked_no_next_round";
  eliminatedParticipantId?: number | null;
  championParticipantId?: number | null;
  blockedTieParticipantIds?: number[];
  scores?: SurvivorScore[];
};

type TournamentRefreshResult = {
  success?: boolean;
  error?: string;
  status?:
    | "scheduled"
    | "active"
    | "final"
    | "blocked_cutoff_tie"
    | "blocked_missing_advance_count"
    | "blocked_no_next_round";
  advanceCount?: number | null;
  advancedParticipantIds?: number[];
  eliminatedParticipantIds?: number[];
  championParticipantId?: number | null;
  tiedCutoffParticipantIds?: number[];
  cutoffAdvanceSlots?: number;
  scores?: SurvivorScore[];
};

type ApiResponse = {
  success: boolean;
  error?: string;
  league?: { id: string; name: string };
  gameFormat?: string;
  survivorMode?: string | null;
  durationMode?: string | null;
  competitionStartDate?: string | null;
  competitionEndDate?: string | null;
  competitionStatus?: string;
  rounds?: RoundRow[];
  teams?: Array<{
    id: number;
    team_number: number;
    team_name: string;
    active: boolean;
  }>;
  h2hMatchups?: unknown[];
  h2hRecords?: unknown[];
  roundParticipants?: RoundParticipant[];
  participantIdentities?: ParticipantIdentity[];
};

type Props = {
  leagueId: string;
};

function formatLabel(value: string | null | undefined) {
  return String(value ?? "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function money(value: number | string | null | undefined) {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function participantStatusClass(status: string) {
  switch (status) {
    case "champion":
      return "champion";
    case "advanced":
      return "advanced";
    case "eliminated":
      return "eliminated";
    default:
      return "active";
  }
}

export default function GreyhoundSeasonControl({ leagueId }: Props) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [advanceCounts, setAdvanceCounts] = useState<Record<number, string>>({});
  const [survivorResults, setSurvivorResults] = useState<
    Record<number, SurvivorRefreshResult>
  >({});
  const [tournamentResults, setTournamentResults] = useState<
    Record<number, TournamentRefreshResult>
  >({});
  const [tournamentTieSelections, setTournamentTieSelections] = useState<
    Record<number, number[]>
  >({});

  const load = useCallback(async () => {
    setError(null);

    try {
      const response = await fetch(
        `/api/greyhound/commissioner/season-control?leagueId=${encodeURIComponent(
          leagueId,
        )}`,
        { cache: "no-store" },
      );

      const payload = (await response.json()) as ApiResponse;

      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? "Unable to load Season Control.");
      }

      setData(payload);
      setAdvanceCounts(
        Object.fromEntries(
          (payload.rounds ?? []).map((round) => [
            round.id,
            String(round.advance_count ?? ""),
          ]),
        ),
      );
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load Season Control.",
      );
    } finally {
      setLoading(false);
    }
  }, [leagueId]);

  useEffect(() => {
    void load();
  }, [load]);

  const isRoundSurvivor =
    data?.gameFormat === "survivor" && data?.survivorMode === "round";

  const isRoundFormat =
    isRoundSurvivor || data?.gameFormat === "tournament";

  const identityByParticipant = useMemo(
    () =>
      new Map(
        (data?.participantIdentities ?? []).map((row) => [
          row.participantId,
          row.name,
        ]),
      ),
    [data?.participantIdentities],
  );

  const participantsByRound = useMemo(() => {
    const map = new Map<number, RoundParticipant[]>();

    for (const row of data?.roundParticipants ?? []) {
      const current = map.get(row.round_id) ?? [];
      current.push(row);
      map.set(row.round_id, current);
    }

    for (const rows of map.values()) {
      rows.sort((a, b) => {
        const rankA = a.round_rank ?? 999999;
        const rankB = b.round_rank ?? 999999;

        return (
          rankA - rankB ||
          Number(b.total_returned ?? 0) - Number(a.total_returned ?? 0) ||
          String(identityByParticipant.get(a.participant_id) ?? "").localeCompare(
            String(identityByParticipant.get(b.participant_id) ?? ""),
          )
        );
      });
    }

    return map;
  }, [data?.roundParticipants, identityByParticipant]);

  const formatDescription = useMemo(() => {
    switch (data?.gameFormat) {
      case "team_head_to_head":
        return "Head-to-Head lifecycle uses scheduled team matchups and official settled returns.";
      case "survivor":
        return data?.survivorMode === "daily"
          ? "Daily Race Survivor advances race by race when the selected dog finishes in the Top 3."
          : "Round Survivor eliminates the lowest official total-winnings entry after each fully settled round.";
      case "tournament":
        return "Use Advance Count to control how many entries move forward from each round.";
      case "team_total_winnings":
        return "Total Winnings archives automatically after the configured competition is fully settled.";
      default:
        return "Bankroll Challenge archives automatically after the configured competition is fully settled.";
    }
  }, [data?.gameFormat, data?.survivorMode]);

  async function saveAdvanceCount(round: RoundRow) {
    const advanceCount = Number(advanceCounts[round.id]);

    if (!Number.isInteger(advanceCount) || advanceCount <= 0) {
      setError("Advance Count must be a whole number greater than zero.");
      return;
    }

    setWorking(round.id);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(
        "/api/greyhound/commissioner/season-control",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            leagueId,
            action: "set_round_advance_count",
            roundId: round.id,
            advanceCount,
          }),
        },
      );

      const payload = (await response.json()) as {
        success?: boolean;
        error?: string;
      };

      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? "Unable to save Advance Count.");
      }

      setMessage(`Round ${round.round_number} advance count saved.`);
      await load();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save Advance Count.",
      );
    } finally {
      setWorking(null);
    }
  }

  async function refreshSurvivorRound(round: RoundRow) {
    setWorking(round.id);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(
        "/api/greyhound/commissioner/survivor-round",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            leagueId,
            roundId: round.id,
            action: "refresh",
          }),
        },
      );

      const payload = (await response.json()) as SurvivorRefreshResult;

      if (!response.ok || !payload.success) {
        throw new Error(
          payload.error ?? "Unable to refresh Survivor round.",
        );
      }

      setSurvivorResults((current) => ({
        ...current,
        [round.id]: payload,
      }));

      if (payload.status === "blocked_tie") {
        setMessage(
          `Round ${round.round_number} is fully settled but tied for the lowest total winnings. Choose which tied entry is eliminated.`,
        );
      } else if (payload.status === "blocked_no_next_round") {
        setMessage(
          `Round ${round.round_number} is settled, but multiple entries would remain and no next round is configured.`,
        );
      } else if (payload.championParticipantId) {
        setMessage(
          `${identityByParticipant.get(payload.championParticipantId) ?? "Survivor"} is the Round Survivor champion.`,
        );
      } else if (payload.eliminatedParticipantId) {
        setMessage(
          `${identityByParticipant.get(payload.eliminatedParticipantId) ?? "Entry"} was eliminated from Round ${round.round_number}.`,
        );
      } else {
        setMessage(
          `Round ${round.round_number} official totals refreshed.`,
        );
      }

      await load();
    } catch (refreshError) {
      setError(
        refreshError instanceof Error
          ? refreshError.message
          : "Unable to refresh Survivor round.",
      );
    } finally {
      setWorking(null);
    }
  }

  async function resolveTie(
    round: RoundRow,
    eliminateParticipantId: number,
  ) {
    const entryName =
      identityByParticipant.get(eliminateParticipantId) ??
      `Entry ${eliminateParticipantId}`;

    if (
      !window.confirm(
        `Eliminate ${entryName} from the tied-lowest group for Round ${round.round_number}?`,
      )
    ) {
      return;
    }

    setWorking(round.id);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(
        "/api/greyhound/commissioner/survivor-round",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            leagueId,
            roundId: round.id,
            action: "resolve_tie",
            eliminateParticipantId,
          }),
        },
      );

      const payload = (await response.json()) as SurvivorRefreshResult;

      if (!response.ok || !payload.success) {
        throw new Error(
          payload.error ?? "Unable to resolve Survivor tie.",
        );
      }

      setSurvivorResults((current) => ({
        ...current,
        [round.id]: payload,
      }));

      setMessage(
        payload.championParticipantId
          ? `${identityByParticipant.get(payload.championParticipantId) ?? "Survivor"} is the Round Survivor champion.`
          : `${entryName} was eliminated and the remaining entries advanced.`,
      );

      await load();
    } catch (resolveError) {
      setError(
        resolveError instanceof Error
          ? resolveError.message
          : "Unable to resolve Survivor tie.",
      );
    } finally {
      setWorking(null);
    }
  }

  async function refreshTournamentRound(round: RoundRow) {
    setWorking(round.id);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(
        "/api/greyhound/commissioner/tournament-round",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            leagueId,
            roundId: round.id,
            action: "refresh",
          }),
        },
      );

      const payload = (await response.json()) as TournamentRefreshResult;

      if (!response.ok || !payload.success) {
        throw new Error(
          payload.error ?? "Unable to refresh Tournament round.",
        );
      }

      setTournamentResults((current) => ({
        ...current,
        [round.id]: payload,
      }));

      if (payload.status === "blocked_cutoff_tie") {
        setTournamentTieSelections((current) => ({
          ...current,
          [round.id]: [],
        }));
        setMessage(
          `Round ${round.round_number} is fully settled but tied across the advancement cutoff. Select exactly ${payload.cutoffAdvanceSlots ?? 0} tied entr${(payload.cutoffAdvanceSlots ?? 0) === 1 ? "y" : "ies"} to advance, then resolve the tie.`,
        );
      } else if (payload.status === "blocked_missing_advance_count") {
        setMessage(
          `Round ${round.round_number} is settled, but an Advance Count must be saved before advancement can finalize.`,
        );
      } else if (payload.status === "blocked_no_next_round") {
        setMessage(
          `Round ${round.round_number} is settled, but multiple entries would advance and no next round is configured.`,
        );
      } else if (payload.championParticipantId) {
        setMessage(
          `${identityByParticipant.get(payload.championParticipantId) ?? "Tournament entry"} is the Tournament champion.`,
        );
      } else if (payload.status === "final") {
        setMessage(
          `Round ${round.round_number} finalized. ${payload.advancedParticipantIds?.length ?? 0} entr${(payload.advancedParticipantIds?.length ?? 0) === 1 ? "y" : "ies"} advanced.`,
        );
      } else {
        setMessage(
          `Round ${round.round_number} official Tournament totals refreshed.`,
        );
      }

      await load();
    } catch (refreshError) {
      setError(
        refreshError instanceof Error
          ? refreshError.message
          : "Unable to refresh Tournament round.",
      );
    } finally {
      setWorking(null);
    }
  }

  function toggleTournamentTieSelection(
    round: RoundRow,
    participantId: number,
  ) {
    const result = tournamentResults[round.id];

    if (result?.status !== "blocked_cutoff_tie") {
      return;
    }

    const tiedIds = new Set(result.tiedCutoffParticipantIds ?? []);
    const required = Number(result.cutoffAdvanceSlots ?? 0);

    if (!tiedIds.has(participantId) || required <= 0) {
      return;
    }

    setTournamentTieSelections((current) => {
      const selected = current[round.id] ?? [];

      if (selected.includes(participantId)) {
        return {
          ...current,
          [round.id]: selected.filter((id) => id !== participantId),
        };
      }

      if (selected.length >= required) {
        return current;
      }

      return {
        ...current,
        [round.id]: [...selected, participantId],
      };
    });
  }

  async function resolveTournamentCutoffTie(round: RoundRow) {
    const result = tournamentResults[round.id];

    if (result?.status !== "blocked_cutoff_tie") {
      setError("Refresh Official Results before resolving the Tournament cutoff tie.");
      return;
    }

    const tiedIds = new Set(result.tiedCutoffParticipantIds ?? []);
    const required = Number(result.cutoffAdvanceSlots ?? 0);
    const selected = Array.from(
      new Set(tournamentTieSelections[round.id] ?? []),
    ).filter((participantId) => tiedIds.has(participantId));

    if (required <= 0 || selected.length !== required) {
      setError(
        `Select exactly ${required} tied entr${required === 1 ? "y" : "ies"} to advance.`,
      );
      return;
    }

    const selectedNames = selected.map(
      (participantId) =>
        identityByParticipant.get(participantId) ??
        `Entry ${participantId}`,
    );

    if (
      !window.confirm(
        `Advance ${selectedNames.join(", ")} from the cutoff tie in Round ${round.round_number}? The other tied entries will be eliminated.`,
      )
    ) {
      return;
    }

    setWorking(round.id);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(
        "/api/greyhound/commissioner/tournament-round",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            leagueId,
            roundId: round.id,
            action: "resolve_cutoff_tie",
            advancingParticipantIds: selected,
          }),
        },
      );

      const payload = (await response.json()) as TournamentRefreshResult;

      if (!response.ok || !payload.success) {
        throw new Error(
          payload.error ?? "Unable to resolve Tournament cutoff tie.",
        );
      }

      setTournamentResults((current) => ({
        ...current,
        [round.id]: payload,
      }));

      setTournamentTieSelections((current) => ({
        ...current,
        [round.id]: [],
      }));

      if (payload.championParticipantId) {
        setMessage(
          `${identityByParticipant.get(payload.championParticipantId) ?? "Tournament entry"} is the Tournament champion.`,
        );
      } else if (payload.status === "final") {
        const advancedNames = (payload.advancedParticipantIds ?? []).map(
          (participantId) =>
            identityByParticipant.get(participantId) ??
            `Entry ${participantId}`,
        );

        setMessage(
          `Round ${round.round_number} cutoff tie resolved. ${
            advancedNames.length > 0
              ? `${advancedNames.join(", ")} advanced.`
              : "The round was finalized."
          }`,
        );
      } else if (payload.status === "blocked_no_next_round") {
        setMessage(
          `The cutoff tie selection is valid, but Round ${round.round_number} cannot finalize because no next round is configured.`,
        );
      } else {
        setMessage(
          `Round ${round.round_number} cutoff tie was resolved.`,
        );
      }

      await load();
    } catch (resolveError) {
      setError(
        resolveError instanceof Error
          ? resolveError.message
          : "Unable to resolve Tournament cutoff tie.",
      );
    } finally {
      setWorking(null);
    }
  }

  if (loading) {
    return (
      <main className="gsc-page">
        <style>{styles}</style>
        <div className="gsc-shell">
          <div className="gsc-empty">
            Loading Greyhound Season Control…
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="gsc-page">
      <style>{styles}</style>

      <div className="gsc-shell">
        <div className="gsc-top">
          <Link
            href={`/league/${leagueId}/commissioner`}
            className="gsc-back"
          >
            ← Commissioner
          </Link>
        </div>

        <section className="gsc-hero">
          <div>
            <div className="gsc-kicker">
              G365 GREYHOUND · COMMISSIONER
            </div>
            <h1>Season Control</h1>
            <p>
              Monitor competition lifecycle, official advancement,
              eliminations, Head-to-Head scheduling, and competition
              completion.
            </p>
          </div>

          <span
            className={`gsc-status ${
              data?.competitionStatus ?? "scheduled"
            }`}
          >
            {formatLabel(data?.competitionStatus)}
          </span>
        </section>

        {error ? <div className="gsc-error">{error}</div> : null}
        {message ? (
          <div className="gsc-message">{message}</div>
        ) : null}

        <section className="gsc-summary">
          <article>
            <span>FORMAT</span>
            <strong>
              {data?.gameFormat === "survivor"
                ? data?.survivorMode === "daily"
                  ? "Daily Race Survivor"
                  : "Round Survivor"
                : formatLabel(data?.gameFormat)}
            </strong>
          </article>
          <article>
            <span>START</span>
            <strong>
              {data?.competitionStartDate ?? "Not set"}
            </strong>
          </article>
          <article>
            <span>END</span>
            <strong>
              {data?.competitionEndDate ?? "Not set"}
            </strong>
          </article>
          <article>
            <span>ROUND COUNT</span>
            <strong>{data?.rounds?.length ?? 0}</strong>
          </article>
        </section>

        {(data?.gameFormat === "team_head_to_head" ||
          data?.gameFormat === "team_total_winnings") ? (
          <section className="gsc-panel">
            <div className="gsc-panel-head gsc-team-head">
              <div>
                <div className="gsc-kicker">
                  COMPETITION TEAMS
                </div>
                <h2>Teams</h2>
                <p>
                  These are the shared Greyhound Team Names currently
                  entered in this competition.
                </p>
              </div>

              <span className="gsc-team-count">
                {data?.teams?.length ?? 0} TEAM
                {(data?.teams?.length ?? 0) === 1 ? "" : "S"}
              </span>
            </div>

            {(data?.teams?.length ?? 0) > 0 ? (
              <div className="gsc-team-grid">
                {(data?.teams ?? []).map((team) => (
                  <article
                    key={team.id}
                    className="gsc-team-card"
                  >
                    <span>TEAM {team.team_number}</span>
                    <strong>{team.team_name}</strong>
                    <small>
                      {team.active ? "ACTIVE" : "INACTIVE"}
                    </small>
                  </article>
                ))}
              </div>
            ) : (
              <div className="gsc-empty">
                No shared competition teams are set up yet. Use
                Commissioner → Teams & Entries to create or assign
                the teams first.
              </div>
            )}
          </section>
        ) : null}

        <section className="gsc-panel">
          <div className="gsc-panel-head">
            <div>
              <div className="gsc-kicker">
                LIFECYCLE RULES
              </div>
              <h2>
                {data?.gameFormat === "survivor"
                  ? data?.survivorMode === "daily"
                    ? "Daily Race Survivor"
                    : "Round Survivor"
                  : formatLabel(data?.gameFormat)}
              </h2>
              <p>{formatDescription}</p>
            </div>
          </div>

          {isRoundFormat ? (
            (data?.rounds ?? []).length > 0 ? (
              <div className="gsc-rounds">
                {(data?.rounds ?? []).map((round) => {
                  const participants =
                    participantsByRound.get(round.id) ?? [];
                  const survivorResult =
                    survivorResults[round.id];
                  const tournamentResult =
                    tournamentResults[round.id];
                  const tiedIds = new Set(
                    survivorResult?.blockedTieParticipantIds ??
                      [],
                  );
                  const tournamentCutoffTies = new Set(
                    tournamentResult?.tiedCutoffParticipantIds ??
                      [],
                  );
                  const tournamentAdvanced = new Set(
                    tournamentResult?.advancedParticipantIds ??
                      [],
                  );
                  const tournamentEliminated = new Set(
                    tournamentResult?.eliminatedParticipantIds ??
                      [],
                  );
                  const tournamentSelected = new Set(
                    tournamentTieSelections[round.id] ?? [],
                  );
                  const tournamentCutoffSlots =
                    Number(tournamentResult?.cutoffAdvanceSlots ?? 0);
                  const tournamentSelectedCount =
                    tournamentSelected.size;
                  const tournamentTieBlocked =
                    tournamentResult?.status ===
                    "blocked_cutoff_tie";

                  return (
                    <article
                      key={round.id}
                      className="gsc-round-card"
                    >
                      <div className="gsc-round-top">
                        <div>
                          <span>
                            ROUND {round.round_number}
                          </span>
                          <h3>{round.round_name}</h3>
                          <p>
                            {round.start_date} → {round.end_date} ·{" "}
                            {round.number_of_days} day
                            {round.number_of_days === 1
                              ? ""
                              : "s"}
                          </p>
                        </div>

                        <div className="gsc-round-status">
                          <span>
                            {formatLabel(
                              tournamentResult?.status ??
                                survivorResult?.status ??
                                round.status,
                            )}
                          </span>
                        </div>
                      </div>

                      {data?.gameFormat ===
                      "tournament" ? (
                        <>
                          <div className="gsc-advance">
                            <label
                              htmlFor={`advance-${round.id}`}
                            >
                              Advance Count
                            </label>
                            <div>
                              <input
                                id={`advance-${round.id}`}
                                type="number"
                                min={1}
                                step={1}
                                value={
                                  advanceCounts[round.id] ?? ""
                                }
                                onChange={(event) =>
                                  setAdvanceCounts(
                                    (current) => ({
                                      ...current,
                                      [round.id]:
                                        event.target.value,
                                    }),
                                  )
                                }
                              />
                              <button
                                type="button"
                                disabled={
                                  working === round.id
                                }
                                onClick={() =>
                                  void saveAdvanceCount(round)
                                }
                              >
                                {working === round.id
                                  ? "Saving…"
                                  : "Save Advance Count"}
                              </button>
                            </div>
                          </div>

                          <div className="gsc-survivor-actions">
                            <div>
                              Tournament scoring uses official total winnings.
                              After the round is fully settled, the Top N entries
                              advance using the saved Advance Count.
                            </div>
                            <button
                              type="button"
                              disabled={
                                working === round.id ||
                                round.status === "final"
                              }
                              onClick={() =>
                                void refreshTournamentRound(
                                  round,
                                )
                              }
                            >
                              {working === round.id
                                ? "Refreshing…"
                                : round.status === "final"
                                  ? "Round Final"
                                  : "Refresh Official Results"}
                            </button>
                          </div>

                          {tournamentTieBlocked ? (
                            <div className="gsc-tournament-tie">
                              <div className="gsc-tournament-tie-copy">
                                <span>ADVANCEMENT CUTOFF TIE</span>
                                <strong>
                                  Select {tournamentCutoffSlots} tied entr
                                  {tournamentCutoffSlots === 1
                                    ? "y"
                                    : "ies"}{" "}
                                  to advance
                                </strong>
                                <p>
                                  {tournamentSelectedCount} of{" "}
                                  {tournamentCutoffSlots} selected. Only
                                  entries tied at the advancement cutoff
                                  can be selected.
                                </p>
                              </div>

                              <button
                                type="button"
                                disabled={
                                  working === round.id ||
                                  tournamentSelectedCount !==
                                    tournamentCutoffSlots
                                }
                                onClick={() =>
                                  void resolveTournamentCutoffTie(
                                    round,
                                  )
                                }
                              >
                                {working === round.id
                                  ? "Resolving…"
                                  : "Resolve Tie"}
                              </button>
                            </div>
                          ) : null}

                          <div className="gsc-survivor-table">
                            <div className="gsc-survivor-head">
                              <span>Rank</span>
                              <span>Entry</span>
                              <span>Winnings</span>
                              <span>Wagered</span>
                              <span>Net</span>
                              <span>Status</span>
                            </div>

                            {participants.length > 0 ? (
                              participants.map(
                                (participant) => {
                                  const isCutoffTie =
                                    tournamentCutoffTies.has(
                                      participant.participant_id,
                                    );
                                  const justAdvanced =
                                    tournamentAdvanced.has(
                                      participant.participant_id,
                                    );
                                  const justEliminated =
                                    tournamentEliminated.has(
                                      participant.participant_id,
                                    );

                                  return (
                                    <div
                                      key={`${round.id}-${participant.participant_id}`}
                                      className={`gsc-survivor-row ${participantStatusClass(
                                        participant.status,
                                      )} ${
                                        isCutoffTie
                                          ? "tied-lowest"
                                          : ""
                                      }`}
                                    >
                                      <strong>
                                        {participant.round_rank ??
                                          "—"}
                                      </strong>
                                      <div>
                                        <b>
                                          {identityByParticipant.get(
                                            participant.participant_id,
                                          ) ??
                                            `Entry ${participant.participant_id}`}
                                        </b>
                                        {isCutoffTie ? (
                                          <small>
                                            TIED AT ADVANCEMENT CUTOFF
                                          </small>
                                        ) : justAdvanced ? (
                                          <small>
                                            ADVANCED
                                          </small>
                                        ) : justEliminated ? (
                                          <small>
                                            ELIMINATED
                                          </small>
                                        ) : null}
                                      </div>
                                      <span>
                                        {money(
                                          participant.total_returned,
                                        )}
                                      </span>
                                      <span>
                                        {money(
                                          participant.total_wagered,
                                        )}
                                      </span>
                                      <span>
                                        {money(
                                          participant.net,
                                        )}
                                      </span>
                                      <div className="gsc-status-cell">
                                        <em>
                                          {formatLabel(
                                            participant.status,
                                          )}
                                        </em>

                                        {isCutoffTie &&
                                        tournamentTieBlocked ? (
                                          <button
                                            type="button"
                                            className={
                                              tournamentSelected.has(
                                                participant.participant_id,
                                              )
                                                ? "selected"
                                                : ""
                                            }
                                            disabled={
                                              working === round.id ||
                                              (!tournamentSelected.has(
                                                participant.participant_id,
                                              ) &&
                                                tournamentSelectedCount >=
                                                  tournamentCutoffSlots)
                                            }
                                            onClick={() =>
                                              toggleTournamentTieSelection(
                                                round,
                                                participant.participant_id,
                                              )
                                            }
                                          >
                                            {tournamentSelected.has(
                                              participant.participant_id,
                                            )
                                              ? "Selected to Advance"
                                              : "Select to Advance"}
                                          </button>
                                        ) : null}
                                      </div>
                                    </div>
                                  );
                                },
                              )
                            ) : (
                              <div className="gsc-empty compact">
                                No entries are seeded into this
                                round yet. Refresh Official Results
                                to initialize the round when
                                applicable.
                              </div>
                            )}
                          </div>
                        </>                      ) : (
                        <>
                          <div className="gsc-survivor-actions">
                            <div>
                              Lowest official total winnings is
                              eliminated after every eligible race
                              and wager in the round is settled.
                            </div>
                            <button
                              type="button"
                              disabled={
                                working === round.id ||
                                round.status === "final"
                              }
                              onClick={() =>
                                void refreshSurvivorRound(
                                  round,
                                )
                              }
                            >
                              {working === round.id
                                ? "Refreshing…"
                                : round.status === "final"
                                  ? "Round Final"
                                  : "Refresh Official Results"}
                            </button>
                          </div>

                          <div className="gsc-survivor-table">
                            <div className="gsc-survivor-head">
                              <span>Rank</span>
                              <span>Entry</span>
                              <span>Winnings</span>
                              <span>Wagered</span>
                              <span>Net</span>
                              <span>Status</span>
                            </div>

                            {participants.length > 0 ? (
                              participants.map(
                                (participant) => {
                                  const isTiedLowest =
                                    tiedIds.has(
                                      participant.participant_id,
                                    );

                                  return (
                                    <div
                                      key={`${round.id}-${participant.participant_id}`}
                                      className={`gsc-survivor-row ${participantStatusClass(
                                        participant.status,
                                      )} ${
                                        isTiedLowest
                                          ? "tied-lowest"
                                          : ""
                                      }`}
                                    >
                                      <strong>
                                        {participant.round_rank ??
                                          "—"}
                                      </strong>
                                      <div>
                                        <b>
                                          {identityByParticipant.get(
                                            participant.participant_id,
                                          ) ??
                                            `Entry ${participant.participant_id}`}
                                        </b>
                                        {isTiedLowest ? (
                                          <small>
                                            TIED FOR LOWEST
                                          </small>
                                        ) : null}
                                      </div>
                                      <span>
                                        {money(
                                          participant.total_returned,
                                        )}
                                      </span>
                                      <span>
                                        {money(
                                          participant.total_wagered,
                                        )}
                                      </span>
                                      <span>
                                        {money(
                                          participant.net,
                                        )}
                                      </span>
                                      <div className="gsc-status-cell">
                                        <em>
                                          {formatLabel(
                                            participant.status,
                                          )}
                                        </em>
                                        {isTiedLowest ? (
                                          <button
                                            type="button"
                                            disabled={
                                              working ===
                                              round.id
                                            }
                                            onClick={() =>
                                              void resolveTie(
                                                round,
                                                participant.participant_id,
                                              )
                                            }
                                          >
                                            Eliminate
                                          </button>
                                        ) : null}
                                      </div>
                                    </div>
                                  );
                                },
                              )
                            ) : (
                              <div className="gsc-empty compact">
                                No entries are seeded into this
                                round yet. Refresh Official Results
                                to initialize the round when
                                applicable.
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="gsc-empty">
                No rounds are configured. Add them under
                Greyhound Settings.
              </div>
            )
          ) : data?.gameFormat ===
            "team_head_to_head" ? (
            <GreyhoundH2HScheduleManager
              leagueId={leagueId}
            />
          ) : data?.gameFormat === "survivor" &&
            data?.survivorMode === "daily" ? (
            <div className="gsc-empty">
              Daily Race Survivor is controlled race by race from
              the live Survivor game. Season Control does not use
              round elimination for Daily Survivor.
            </div>
          ) : (
            <div className="gsc-empty">
              This format finalizes automatically after all
              eligible races and wagers in the configured
              competition window are officially settled.
            </div>
          )}
        </section>

        <section className="gsc-panel">
          <div className="gsc-panel-head">
            <div>
              <div className="gsc-kicker">SAFETY</div>
              <h2>Official Completion Only</h2>
              <p>
                Season Control does not force-finalize unfinished
                races or unsettled wagers. Final standings and
                Trophy Case history stay tied to official settled
                results.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

const styles = `
.gsc-page,.gsc-page *{box-sizing:border-box}
.gsc-page{min-height:100vh;padding:18px 16px 70px;color:#fff;background:radial-gradient(circle at 15% 0%,rgba(165,37,18,.20),transparent 30%),linear-gradient(180deg,#07080a,#0b0c0f 50%,#07080a)}
.gsc-shell{width:min(1400px,100%);margin:0 auto}
.gsc-top{margin-bottom:10px}
.gsc-back{display:inline-flex;min-height:40px;align-items:center;padding:0 13px;border:1px solid #33363a;border-radius:10px;background:#101113;color:#eee;text-decoration:none;font-size:10px;font-weight:900}
.gsc-hero{display:flex;justify-content:space-between;align-items:center;gap:16px;padding:22px;border:1px solid rgba(242,107,34,.30);border-radius:18px;background:linear-gradient(135deg,rgba(121,20,12,.36),rgba(242,107,34,.08),#111214)}
.gsc-kicker{color:#ff6b22;font-size:9px;font-weight:950;letter-spacing:.14em}
.gsc-hero h1,.gsc-panel h2{margin:6px 0;font-weight:950}
.gsc-hero h1{font-size:clamp(30px,4vw,44px)}
.gsc-hero p,.gsc-panel p{margin:0;color:#92979e;font-size:11px;line-height:1.55}
.gsc-status{padding:8px 10px;border:1px solid #414348;border-radius:999px;font-size:8px;font-weight:950;letter-spacing:.08em;text-transform:uppercase}
.gsc-status.active{border-color:rgba(58,190,115,.45);color:#68d99a}
.gsc-status.ended{border-color:rgba(242,107,34,.42);color:#ff8750}
.gsc-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px;margin:12px 0}
.gsc-summary article{padding:13px;border:1px solid #2d2f33;border-radius:13px;background:#101113}
.gsc-summary span{display:block;color:#81868d;font-size:8px;font-weight:950}
.gsc-summary strong{display:block;margin-top:5px;font-size:14px;font-weight:950}
.gsc-panel{margin-top:12px;padding:16px;border:1px solid #2d2f33;border-radius:15px;background:#101113}
.gsc-panel-head{margin-bottom:12px}
.gsc-team-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}
.gsc-team-count{flex:0 0 auto;padding:7px 9px;border:1px solid rgba(242,107,34,.34);border-radius:999px;background:rgba(90,31,12,.22);color:#ff9b67;font-size:7px;font-weight:950;letter-spacing:.08em}
.gsc-team-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.gsc-team-card{padding:12px;border:1px solid #2c2e32;border-radius:11px;background:linear-gradient(145deg,rgba(100,25,15,.18),transparent 56%),#0c0d0f}
.gsc-team-card span{display:block;color:#e76227;font-size:7px;font-weight:950;letter-spacing:.10em}
.gsc-team-card strong{display:block;margin-top:5px;color:#fff;font-size:13px;font-weight:950}
.gsc-team-card small{display:inline-block;margin-top:7px;padding:4px 6px;border:1px solid rgba(55,170,96,.30);border-radius:999px;color:#8ddfae;font-size:7px;font-weight:950}
.gsc-rounds{display:grid;gap:10px}
.gsc-round-card{padding:12px;border:1px solid #2b2d31;border-radius:12px;background:#0c0d0f}
.gsc-round-top{display:grid;grid-template-columns:minmax(0,1fr) 130px;align-items:center;gap:12px}
.gsc-round-top>div>span{color:#ff6b22;font-size:8px;font-weight:950}
.gsc-round-top h3{margin:4px 0;font-size:14px}
.gsc-round-top p{font-size:9px}
.gsc-round-status{text-align:right}
.gsc-round-status span{display:inline-block;padding:6px 8px;border:1px solid #3a3c40;border-radius:999px}
.gsc-advance{margin-top:10px;padding-top:10px;border-top:1px solid #25272b}
.gsc-advance label{display:block;margin-bottom:5px;color:#8d9299;font-size:8px;font-weight:900;text-transform:uppercase}
.gsc-advance>div{display:flex;gap:6px}
.gsc-advance input{width:90px;min-height:38px;border:1px solid #3a3d42;border-radius:9px;background:#090a0c;color:#fff;padding:0 9px}
.gsc-advance button,.gsc-survivor-actions button,.gsc-status-cell button{min-height:38px;padding:0 12px;border:0;border-radius:9px;background:linear-gradient(90deg,#a92318,#f26b22);color:#fff;font-size:9px;font-weight:950;cursor:pointer}
.gsc-survivor-actions{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-top:10px;padding:10px;border:1px solid #292b2f;border-radius:10px;background:#111214;color:#8b9097;font-size:9px;line-height:1.45}
.gsc-survivor-actions button:disabled,.gsc-status-cell button:disabled{opacity:.48;cursor:not-allowed}
.gsc-survivor-table{margin-top:10px;border:1px solid #2a2c30;border-radius:11px;overflow:hidden}
.gsc-survivor-head,.gsc-survivor-row{display:grid;grid-template-columns:58px minmax(160px,1.4fr) 110px 110px 110px 160px;gap:8px;align-items:center}
.gsc-survivor-head{padding:8px 10px;background:#161719;color:#767b82;font-size:7px;font-weight:950;text-transform:uppercase}
.gsc-survivor-row{padding:9px 10px;border-top:1px solid #24262a;background:#0d0e10;font-size:9px}
.gsc-survivor-row>strong{font-size:12px}
.gsc-survivor-row b{display:block;color:#fff;font-size:10px}
.gsc-survivor-row small{display:block;margin-top:2px;color:#ff8f58;font-size:7px;font-weight:950}
.gsc-survivor-row span{color:#d0d3d7}
.gsc-survivor-row.eliminated{opacity:.55}
.gsc-survivor-row.champion{background:linear-gradient(90deg,rgba(153,29,22,.26),rgba(242,107,34,.08),#0d0e10);border-left:3px solid #ff6b22}
.gsc-survivor-row.advanced{border-left:3px solid rgba(69,190,110,.72)}
.gsc-survivor-row.tied-lowest{background:rgba(122,30,22,.16);box-shadow:inset 3px 0 #d84232}
.gsc-status-cell{display:flex;align-items:center;justify-content:space-between;gap:8px}
.gsc-status-cell em{font-style:normal;color:#9da2a8;font-size:8px;font-weight:950}
.gsc-status-cell button{min-height:30px;padding:0 9px;background:linear-gradient(90deg,#8f1713,#cb341a);font-size:8px}
.gsc-status-cell button.selected{border:1px solid rgba(82,208,126,.55);background:rgba(39,123,71,.28);color:#9af0b8}
.gsc-tournament-tie{display:flex;justify-content:space-between;align-items:center;gap:14px;margin-top:10px;padding:12px;border:1px solid rgba(242,107,34,.45);border-radius:11px;background:linear-gradient(135deg,rgba(125,31,18,.24),rgba(242,107,34,.07),#111214)}
.gsc-tournament-tie-copy{min-width:0}
.gsc-tournament-tie-copy>span{display:block;color:#ff7540;font-size:8px;font-weight:950;letter-spacing:.10em}
.gsc-tournament-tie-copy>strong{display:block;margin-top:4px;color:#fff;font-size:12px;font-weight:950}
.gsc-tournament-tie-copy>p{margin-top:4px;color:#9a9fa6;font-size:9px}
.gsc-tournament-tie>button{flex:0 0 auto;min-height:40px;padding:0 14px;border:0;border-radius:9px;background:linear-gradient(90deg,#a92318,#f26b22);color:#fff;font-size:9px;font-weight:950;cursor:pointer}
.gsc-tournament-tie>button:disabled{opacity:.45;cursor:not-allowed}
.gsc-empty,.gsc-error,.gsc-message{padding:17px;border:1px solid #2c2e32;border-radius:12px;background:#0c0d0f;color:#92979e;font-size:10px}
.gsc-empty.compact{margin:0;border:0;border-radius:0}
.gsc-error{margin-top:10px;border-color:rgba(211,55,42,.50);color:#ffaaa1}
.gsc-message{margin-top:10px;border-color:rgba(242,107,34,.38);background:rgba(83,28,10,.16);color:#ffb184}
@media(max-width:1050px){.gsc-survivor-head,.gsc-survivor-row{grid-template-columns:48px minmax(145px,1.3fr) 96px 96px 96px 140px}}
@media(max-width:900px){.gsc-summary{grid-template-columns:repeat(2,minmax(0,1fr))}.gsc-team-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.gsc-survivor-table{overflow-x:auto}.gsc-survivor-head,.gsc-survivor-row{min-width:760px}}
@media(max-width:560px){.gsc-page{padding:12px 10px 70px}.gsc-hero{align-items:flex-start;flex-direction:column}.gsc-summary{grid-template-columns:1fr}.gsc-team-head{flex-direction:column}.gsc-team-grid{grid-template-columns:1fr}.gsc-round-top{grid-template-columns:1fr}.gsc-round-status{text-align:left}.gsc-survivor-actions{align-items:stretch;flex-direction:column}.gsc-survivor-actions button{width:100%}.gsc-tournament-tie{align-items:stretch;flex-direction:column}.gsc-tournament-tie>button{width:100%}}
`;
