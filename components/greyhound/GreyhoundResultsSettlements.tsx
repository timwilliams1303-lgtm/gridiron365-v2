"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type WagerRow = {
  wagerId: number;
  participantName: string;
  memberName: string | null;
  teamName: string | null;
  raceId: number;
  raceNumber: number | null;
  wagerType: string;
  wagerStructure: string;
  denomination: number;
  combinationCount: number;
  totalCost: number;
  wagerStatus: string;
  gradingStatus: string;
  officialReturn: number;
  refundReason: string | null;
  gradedAt: string | null;
  lastRegradedAt: string | null;
};

type RaceRow = {
  id: number;
  raceNumber: number;
  grade: string | null;
  distanceYards: number | null;
  scheduledPostTime: string | null;
  actualPostTime: string | null;
  raceStatus: string;
  results: Array<{
    id: number;
    dogName: string;
    boxNumber: number | null;
    finishPosition: number | null;
    finalOddsText: string | null;
    officialTime: number | null;
    resultStatus: string;
    isDeadHeat: boolean;
    revisionNumber: number;
    correctedAt: string | null;
    correctionReason: string | null;
  }>;
  payouts: Array<{
    id: number;
    wagerType: string;
    winningCombination: string;
    baseAmount: number;
    payout: number;
    source: string | null;
    payoutStatus: string;
  }>;
  wagerSummary: {
    total: number;
    pending: number;
    winners: number;
    losers: number;
    refunded: number;
    staked: number;
    returned: number;
  };
  wagers: WagerRow[];
};

type CardRow = {
  id: number;
  raceDate: string;
  session: string;
  cardStatus: string;
  totalRaces: number;
  track: {
    id: number;
    code: string;
    name: string;
    timezone: string | null;
  } | null;
  settlement: {
    races: number;
    finalRaces: number;
    racesWithResults: number;
    wagers: number;
    gradedWagers: number;
    pendingWagers: number;
    totalStaked: number;
    totalReturned: number;
  };
  races: RaceRow[];
};

type ApiResponse = {
  success: boolean;
  error?: string;
  league?: { id: string; name: string };
  summary?: {
    cards: number;
    races: number;
    officialResultRows: number;
    payoutRows: number;
    wagers: number;
    pendingWagers: number;
    winningWagers: number;
    losingWagers: number;
    refundedWagers: number;
    totalStaked: number;
    totalReturned: number;
  };
  cards?: CardRow[];
};

type Props = {
  leagueId: string;
};

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number.isFinite(value) ? value : 0);
}

function label(value: string | null | undefined) {
  return String(value ?? "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function dateLabel(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}

export default function GreyhoundResultsSettlements({
  leagueId,
}: Props) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<number | null>(null);
  const [selectedRaceId, setSelectedRaceId] = useState<number | null>(null);
  const [workingAction, setWorkingAction] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(
    async (silent = false) => {
      if (silent) setRefreshing(true);
      else setLoading(true);

      setError(null);

      try {
        const response = await fetch(
          `/api/greyhound/commissioner/results-settlements?leagueId=${encodeURIComponent(
            leagueId,
          )}`,
          { cache: "no-store" },
        );

        const payload = (await response.json()) as ApiResponse;

        if (!response.ok || !payload.success) {
          throw new Error(
            payload.error ?? "Unable to load Results & Settlements.",
          );
        }

        setData(payload);

        const cards = payload.cards ?? [];
        setSelectedCardId((current) =>
          current && cards.some((card) => card.id === current)
            ? current
            : cards[0]?.id ?? null,
        );
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load Results & Settlements.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [leagueId],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const selectedCard = useMemo(
    () =>
      (data?.cards ?? []).find((card) => card.id === selectedCardId) ??
      null,
    [data?.cards, selectedCardId],
  );

  useEffect(() => {
    if (!selectedCard) {
      setSelectedRaceId(null);
      return;
    }

    setSelectedRaceId((current) =>
      current && selectedCard.races.some((race) => race.id === current)
        ? current
        : selectedCard.races[0]?.id ?? null,
    );
  }, [selectedCard]);

  const selectedRace = useMemo(
    () =>
      selectedCard?.races.find((race) => race.id === selectedRaceId) ??
      null,
    [selectedCard, selectedRaceId],
  );

  const summary = data?.summary ?? {
    cards: 0,
    races: 0,
    officialResultRows: 0,
    payoutRows: 0,
    wagers: 0,
    pendingWagers: 0,
    winningWagers: 0,
    losingWagers: 0,
    refundedWagers: 0,
    totalStaked: 0,
    totalReturned: 0,
  };

  async function settlementAction(args: {
    action: "resettle_race" | "refund_wager" | "no_action_wager";
    raceId?: number;
    wagerId?: number;
    reason?: string;
    workingKey: string;
  }) {
    setWorkingAction(args.workingKey);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(
        "/api/greyhound/commissioner/results-settlements",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            leagueId,
            action: args.action,
            raceId: args.raceId,
            wagerId: args.wagerId,
            reason: args.reason,
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
          payload.error ?? "Unable to apply settlement action.",
        );
      }

      setMessage(payload.message ?? "Settlement action completed.");
      await load(true);
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Unable to apply settlement action.",
      );
    } finally {
      setWorkingAction(null);
    }
  }

  async function refundTicket(
    wager: WagerRow,
    status: "refunded" | "no_action",
  ) {
    const actionLabel =
      status === "refunded" ? "refund" : "mark no action";

    const reason = window.prompt(
      `Reason to ${actionLabel} wager #${wager.wagerId}:`,
      status === "refunded"
        ? "Commissioner refund"
        : "Commissioner no action",
    );

    if (reason == null) return;

    const trimmed = reason.trim();
    if (trimmed.length < 3) {
      setError("Enter a short reason for the settlement change.");
      return;
    }

    const confirmed = window.confirm(
      status === "refunded"
        ? `Refund wager #${wager.wagerId} for ${money(wager.totalCost)}?`
        : `Mark wager #${wager.wagerId} as no action and return ${money(
            wager.totalCost,
          )}?`,
    );

    if (!confirmed) return;

    await settlementAction({
      action:
        status === "refunded"
          ? "refund_wager"
          : "no_action_wager",
      wagerId: wager.wagerId,
      reason: trimmed,
      workingKey: `wager-${wager.wagerId}`,
    });
  }

  async function resettleRace(race: RaceRow) {
    const confirmed = window.confirm(
      `Re-settle Race ${race.raceNumber} from the current official result and payout data? This can regrade league tickets if official data changed.`,
    );

    if (!confirmed) return;

    await settlementAction({
      action: "resettle_race",
      raceId: race.id,
      workingKey: `race-${race.id}`,
    });
  }

  if (loading && !data) {
    return (
      <main className="grs-page">
        <style>{styles}</style>
        <div className="grs-shell">
          <div className="grs-empty">Loading Results & Settlements…</div>
        </div>
      </main>
    );
  }

  return (
    <main className="grs-page">
      <style>{styles}</style>

      <div className="grs-shell">
        <div className="grs-topbar">
          <Link
            href={`/league/${leagueId}/greyhound/commissioner`}
            className="grs-back"
          >
            ← Commissioner
          </Link>

          <button
            type="button"
            className="grs-refresh"
            disabled={refreshing}
            onClick={() => void load(true)}
          >
            {refreshing ? "Refreshing…" : "Refresh Results"}
          </button>
        </div>

        <section className="grs-hero">
          <div>
            <div className="grs-kicker">
              G365 GREYHOUND · COMMISSIONER
            </div>
            <h1>Results & Settlements</h1>
            <p>
              Review official finish order, mutuel payouts, wager grading,
              refunds, corrections, and settlement completeness.
            </p>
          </div>

          <div className="grs-live">LIVE DATA</div>
        </section>

        {error ? <div className="grs-error">{error}</div> : null}
        {message ? <div className="grs-message">{message}</div> : null}

        <section className="grs-summary">
          <article>
            <span>WAGERS</span>
            <strong>{summary.wagers}</strong>
            <small>{summary.pendingWagers} pending</small>
          </article>
          <article>
            <span>STAKED</span>
            <strong>{money(summary.totalStaked)}</strong>
            <small>{summary.winningWagers} winners</small>
          </article>
          <article>
            <span>RETURNED</span>
            <strong>{money(summary.totalReturned)}</strong>
            <small>{summary.refundedWagers} refunded</small>
          </article>
          <article>
            <span>OFFICIAL RESULTS</span>
            <strong>{summary.officialResultRows}</strong>
            <small>{summary.payoutRows} payout rows</small>
          </article>
        </section>

        <section className="grs-panel">
          <div className="grs-panel-head">
            <div>
              <div className="grs-kicker">RACE CARDS</div>
              <h2>Settlement Cards</h2>
            </div>
          </div>

          {(data?.cards ?? []).length > 0 ? (
            <div className="grs-card-strip">
              {(data?.cards ?? []).map((card) => (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => setSelectedCardId(card.id)}
                  className={`grs-card-choice ${
                    card.id === selectedCardId ? "active" : ""
                  }`}
                >
                  <span>
                    {card.track?.name ??
                      card.track?.code ??
                      "Greyhound Track"}
                  </span>
                  <strong>{dateLabel(card.raceDate)}</strong>
                  <small>
                    {card.settlement.finalRaces}/{card.settlement.races} races
                    final · {card.settlement.pendingWagers} wager
                    {card.settlement.pendingWagers === 1 ? "" : "s"} pending
                  </small>
                </button>
              ))}
            </div>
          ) : (
            <div className="grs-empty">
              No Greyhound race cards are available yet.
            </div>
          )}
        </section>

        {selectedCard ? (
          <>
            <section className="grs-card-overview">
              <article>
                <span>TRACK</span>
                <strong>
                  {selectedCard.track?.name ??
                    selectedCard.track?.code ??
                    "Track"}
                </strong>
              </article>
              <article>
                <span>CARD STATUS</span>
                <strong>{label(selectedCard.cardStatus)}</strong>
              </article>
              <article>
                <span>GRADED WAGERS</span>
                <strong>
                  {selectedCard.settlement.gradedWagers}/
                  {selectedCard.settlement.wagers}
                </strong>
              </article>
              <article>
                <span>CARD RETURN</span>
                <strong>
                  {money(selectedCard.settlement.totalReturned)}
                </strong>
              </article>
            </section>

            <section className="grs-layout">
              <aside className="grs-races">
                <div className="grs-kicker">RACES</div>
                {selectedCard.races.map((race) => (
                  <button
                    key={race.id}
                    type="button"
                    className={`grs-race-button ${
                      race.id === selectedRaceId ? "active" : ""
                    }`}
                    onClick={() => setSelectedRaceId(race.id)}
                  >
                    <div>
                      <strong>Race {race.raceNumber}</strong>
                      <span>
                        {race.grade ?? "Grade —"} ·{" "}
                        {race.distanceYards
                          ? `${race.distanceYards} yd`
                          : "Distance —"}
                      </span>
                    </div>
                    <small>
                      {race.wagerSummary.pending > 0
                        ? `${race.wagerSummary.pending} pending`
                        : label(race.raceStatus)}
                    </small>
                  </button>
                ))}
              </aside>

              <div className="grs-detail">
                {selectedRace ? (
                  <>
                    <section className="grs-race-head">
                      <div>
                        <div className="grs-kicker">
                          OFFICIAL RACE REVIEW
                        </div>
                        <h2>Race {selectedRace.raceNumber}</h2>
                        <p>
                          {selectedRace.grade ?? "Grade —"} ·{" "}
                          {selectedRace.distanceYards
                            ? `${selectedRace.distanceYards} yards`
                            : "Distance unavailable"}{" "}
                          · {label(selectedRace.raceStatus)}
                        </p>
                      </div>

                      <div className="grs-race-actions">
                        <div className="grs-race-stats">
                          <span>
                            {selectedRace.wagerSummary.total} tickets
                          </span>
                          <span>
                            {money(selectedRace.wagerSummary.staked)} staked
                          </span>
                          <span>
                            {money(selectedRace.wagerSummary.returned)} returned
                          </span>
                        </div>

                        <button
                          type="button"
                          className="grs-action-button"
                          disabled={
                            workingAction === `race-${selectedRace.id}`
                          }
                          onClick={() => void resettleRace(selectedRace)}
                        >
                          {workingAction === `race-${selectedRace.id}`
                            ? "Re-settling…"
                            : "Re-settle Race"}
                        </button>
                      </div>
                    </section>

                    <section className="grs-block">
                      <div className="grs-block-title">
                        <div>
                          <span>OFFICIAL RESULTS</span>
                          <h3>Finish Order</h3>
                        </div>
                        <small>
                          {selectedRace.results.length} result row
                          {selectedRace.results.length === 1 ? "" : "s"}
                        </small>
                      </div>

                      {selectedRace.results.length > 0 ? (
                        <div className="grs-result-grid">
                          {selectedRace.results.map((result) => (
                            <article key={result.id}>
                              <b>
                                {result.finishPosition
                                  ? `#${result.finishPosition}`
                                  : "—"}
                              </b>
                              <div>
                                <strong>
                                  Box {result.boxNumber ?? "—"} ·{" "}
                                  {result.dogName}
                                </strong>
                                <span>
                                  {label(result.resultStatus)}
                                  {result.isDeadHeat ? " · Dead Heat" : ""}
                                  {result.revisionNumber > 0
                                    ? ` · Revision ${result.revisionNumber}`
                                    : ""}
                                </span>
                                {result.correctionReason ? (
                                  <small>
                                    Correction: {result.correctionReason}
                                  </small>
                                ) : null}
                              </div>
                            </article>
                          ))}
                        </div>
                      ) : (
                        <div className="grs-empty compact">
                          No official results posted for this race yet.
                        </div>
                      )}
                    </section>

                    <section className="grs-block">
                      <div className="grs-block-title">
                        <div>
                          <span>MUTUEL PAYOUTS</span>
                          <h3>Official Payout Board</h3>
                        </div>
                        <small>
                          {selectedRace.payouts.length} payout
                          {selectedRace.payouts.length === 1 ? "" : "s"}
                        </small>
                      </div>

                      {selectedRace.payouts.length > 0 ? (
                        <div className="grs-payout-table">
                          <div className="grs-table-head">
                            <span>Type</span>
                            <span>Combination</span>
                            <span>Base</span>
                            <span>Payout</span>
                            <span>Status</span>
                          </div>
                          {selectedRace.payouts.map((payout) => (
                            <div className="grs-table-row" key={payout.id}>
                              <strong>{label(payout.wagerType)}</strong>
                              <span>{payout.winningCombination}</span>
                              <span>{money(payout.baseAmount)}</span>
                              <span>{money(payout.payout)}</span>
                              <span>{label(payout.payoutStatus)}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="grs-empty compact">
                          No mutuel payouts are posted for this race yet.
                        </div>
                      )}
                    </section>

                    <section className="grs-block">
                      <div className="grs-block-title">
                        <div>
                          <span>WAGER GRADING</span>
                          <h3>League Tickets</h3>
                        </div>
                        <small>
                          {selectedRace.wagers.length} ticket
                          {selectedRace.wagers.length === 1 ? "" : "s"}
                        </small>
                      </div>

                      {selectedRace.wagers.length > 0 ? (
                        <div className="grs-wagers">
                          {selectedRace.wagers.map((wager) => (
                            <article key={wager.wagerId}>
                              <div>
                                <span className="grs-ticket-owner">
                                  {wager.teamName ?? wager.participantName}
                                </span>
                                <strong>
                                  {label(wager.wagerType)} ·{" "}
                                  {label(wager.wagerStructure)}
                                </strong>
                                <small>
                                  {money(wager.totalCost)} ticket ·{" "}
                                  {wager.combinationCount} combination
                                  {wager.combinationCount === 1 ? "" : "s"}
                                </small>
                                {wager.refundReason ? (
                                  <small className="grs-refund">
                                    Refund: {wager.refundReason}
                                  </small>
                                ) : null}
                              </div>

                              <div className="grs-ticket-result">
                                <span
                                  className={`grs-pill ${wager.wagerStatus.toLowerCase()}`}
                                >
                                  {label(wager.wagerStatus)}
                                </span>
                                <strong>
                                  {money(wager.officialReturn)}
                                </strong>
                                <small>
                                  {label(wager.gradingStatus)}
                                </small>

                                {!["refunded", "no_action"].includes(
                                  wager.wagerStatus.toLowerCase(),
                                ) ? (
                                  <div className="grs-ticket-actions">
                                    <button
                                      type="button"
                                      disabled={
                                        workingAction ===
                                        `wager-${wager.wagerId}`
                                      }
                                      onClick={() =>
                                        void refundTicket(wager, "refunded")
                                      }
                                    >
                                      Refund
                                    </button>
                                    <button
                                      type="button"
                                      disabled={
                                        workingAction ===
                                        `wager-${wager.wagerId}`
                                      }
                                      onClick={() =>
                                        void refundTicket(wager, "no_action")
                                      }
                                    >
                                      No Action
                                    </button>
                                  </div>
                                ) : null}
                              </div>
                            </article>
                          ))}
                        </div>
                      ) : (
                        <div className="grs-empty compact">
                          No league wagers were placed on this race.
                        </div>
                      )}
                    </section>
                  </>
                ) : (
                  <div className="grs-empty">
                    Select a race to review its settlement.
                  </div>
                )}
              </div>
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}

const styles = `
.grs-page,.grs-page *{box-sizing:border-box}
.grs-page{min-height:100vh;padding:18px 16px 70px;background:radial-gradient(circle at 12% -4%,rgba(145,24,14,.2),transparent 30%),linear-gradient(180deg,#07080a,#0b0c0f 52%,#07080a);color:#fff}
.grs-shell{width:min(1500px,100%);margin:0 auto}
.grs-topbar{display:flex;justify-content:space-between;gap:10px;margin-bottom:10px}
.grs-back,.grs-refresh{min-height:40px;padding:0 13px;border:1px solid #34373b;border-radius:10px;background:#101113;color:#eee;text-decoration:none;font-size:9px;font-weight:950;cursor:pointer}
.grs-refresh{border-color:rgba(242,107,34,.42);background:linear-gradient(90deg,#7e1b13,#d7471d)}
.grs-refresh:disabled{opacity:.55;cursor:not-allowed}
.grs-hero{display:flex;justify-content:space-between;gap:18px;align-items:center;padding:22px;border:1px solid rgba(242,107,34,.3);border-radius:18px;background:linear-gradient(135deg,rgba(126,24,15,.42),rgba(242,107,34,.08),#101113)}
.grs-kicker{color:#ff6b22;font-size:8px;font-weight:950;letter-spacing:.15em}
.grs-hero h1{margin:6px 0;font-size:clamp(30px,4vw,44px);font-weight:950;letter-spacing:-.035em}
.grs-hero p{max-width:820px;margin:0;color:#9a9fa6;font-size:11px;line-height:1.6}
.grs-live{padding:8px 10px;border:1px solid rgba(242,107,34,.4);border-radius:999px;color:#ff9a64;font-size:8px;font-weight:950}
.grs-error{margin-top:10px;padding:12px;border:1px solid rgba(205,56,43,.5);border-radius:11px;background:rgba(92,19,14,.18);color:#ffaaa2;font-size:10px}
.grs-message{margin-top:10px;padding:12px;border:1px solid rgba(242,107,34,.4);border-radius:11px;background:rgba(104,35,12,.18);color:#ffb183;font-size:10px}
.grs-summary,.grs-card-overview{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px;margin:12px 0}
.grs-summary article,.grs-card-overview article{padding:13px;border:1px solid #2c2f33;border-radius:12px;background:#101113}
.grs-summary span,.grs-card-overview span{display:block;color:#7e838a;font-size:7px;font-weight:950;letter-spacing:.08em}
.grs-summary strong,.grs-card-overview strong{display:block;margin-top:5px;font-size:15px;font-weight:950}
.grs-summary small{display:block;margin-top:3px;color:#9a9fa5;font-size:8px}
.grs-panel,.grs-block{margin-top:12px;padding:15px;border:1px solid #2c2f33;border-radius:14px;background:#101113}
.grs-panel-head,.grs-block-title{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:10px}
.grs-panel h2,.grs-block h3{margin:4px 0 0;font-weight:950}
.grs-card-strip{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}
.grs-card-choice{padding:11px;border:1px solid #2c2e32;border-radius:11px;background:#0c0d0f;color:#fff;text-align:left;cursor:pointer}
.grs-card-choice.active{border-color:#d94c22;background:linear-gradient(145deg,rgba(130,28,16,.28),#0c0d0f)}
.grs-card-choice span{display:block;color:#ff6b22;font-size:7px;font-weight:950}
.grs-card-choice strong{display:block;margin:4px 0;font-size:11px}
.grs-card-choice small{display:block;color:#7f848b;font-size:8px;line-height:1.4}
.grs-layout{display:grid;grid-template-columns:245px minmax(0,1fr);gap:12px;align-items:start}
.grs-races{position:sticky;top:12px;padding:12px;border:1px solid #2c2f33;border-radius:13px;background:#101113}
.grs-race-button{display:flex;width:100%;justify-content:space-between;align-items:center;gap:8px;margin-top:7px;padding:10px;border:1px solid #272a2e;border-radius:9px;background:#0b0c0e;color:#fff;text-align:left;cursor:pointer}
.grs-race-button.active{border-color:#d74d24;background:rgba(115,28,15,.22)}
.grs-race-button strong{display:block;font-size:10px}
.grs-race-button span,.grs-race-button small{display:block;color:#858a91;font-size:7px}
.grs-detail{min-width:0}
.grs-race-head{display:flex;justify-content:space-between;align-items:flex-end;gap:12px;padding:15px;border:1px solid #2c2f33;border-radius:14px;background:#101113}
.grs-race-head h2{margin:4px 0;font-size:24px;font-weight:950}
.grs-race-head p{margin:0;color:#858a91;font-size:9px}
.grs-race-actions{display:flex;flex-direction:column;align-items:flex-end;gap:8px}
.grs-race-stats{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:6px}
.grs-action-button{min-height:34px;padding:0 11px;border:0;border-radius:9px;background:linear-gradient(90deg,#8f1713,#e76227);color:#fff;font-size:8px;font-weight:950;cursor:pointer}
.grs-action-button:disabled{opacity:.5;cursor:not-allowed}
.grs-race-stats span{padding:6px 8px;border:1px solid #34373b;border-radius:999px;color:#aeb2b8;font-size:7px;font-weight:900}
.grs-block-title span{color:#e76227;font-size:7px;font-weight:950;letter-spacing:.12em}
.grs-block-title small{color:#7d8289;font-size:8px}
.grs-result-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.grs-result-grid article{display:flex;gap:10px;align-items:center;padding:10px;border:1px solid #292b2f;border-radius:10px;background:#0c0d0f}
.grs-result-grid article>b{display:grid;place-items:center;min-width:38px;height:38px;border-radius:999px;background:linear-gradient(135deg,#8f1713,#e76227);font-size:11px}
.grs-result-grid strong{display:block;font-size:10px}
.grs-result-grid span,.grs-result-grid small{display:block;margin-top:2px;color:#83888f;font-size:7px}
.grs-payout-table{overflow-x:auto;border:1px solid #292b2f;border-radius:10px}
.grs-table-head,.grs-table-row{display:grid;grid-template-columns:110px minmax(140px,1fr) 90px 90px 100px;gap:8px;min-width:590px;padding:8px 10px}
.grs-table-head{background:#161719;color:#777c83;font-size:7px;font-weight:950;text-transform:uppercase}
.grs-table-row{border-top:1px solid #24262a;background:#0c0d0f;font-size:8px}
.grs-table-row strong{color:#fff}
.grs-wagers{display:grid;gap:8px}
.grs-wagers article{display:flex;justify-content:space-between;gap:12px;padding:11px;border:1px solid #292b2f;border-radius:10px;background:#0c0d0f}
.grs-ticket-owner{display:block;color:#ff7b3b;font-size:7px;font-weight:950;text-transform:uppercase}
.grs-wagers strong{display:block;margin-top:3px;font-size:10px}
.grs-wagers small{display:block;margin-top:3px;color:#7f848b;font-size:7px}
.grs-refund{color:#ffb07d!important}
.grs-ticket-result{text-align:right}
.grs-pill{display:inline-block;padding:5px 7px;border:1px solid #3b3e43;border-radius:999px;color:#aeb2b8;font-size:7px;font-weight:950}
.grs-pill.winner{border-color:rgba(52,173,98,.45);color:#74db9c}
.grs-pill.loser{border-color:rgba(204,67,54,.45);color:#ff8b82}
.grs-pill.refunded,.grs-pill.void,.grs-pill.no_action{border-color:rgba(242,107,34,.45);color:#ff9d68}
.grs-ticket-result strong{margin-top:5px;font-size:12px}
.grs-ticket-actions{display:flex;justify-content:flex-end;gap:5px;margin-top:7px}
.grs-ticket-actions button{min-height:28px;padding:0 8px;border:1px solid #3b3d42;border-radius:7px;background:#151619;color:#ddd;font-size:7px;font-weight:950;cursor:pointer}
.grs-ticket-actions button:first-child{border-color:rgba(242,107,34,.42);color:#ff9c69}
.grs-ticket-actions button:disabled{opacity:.45;cursor:not-allowed}
.grs-empty{padding:18px;border:1px solid #2c2f33;border-radius:12px;background:#0c0d0f;color:#8d9299;font-size:10px}
.grs-empty.compact{border:0;padding:10px}
@media(max-width:1100px){.grs-card-strip{grid-template-columns:repeat(2,minmax(0,1fr))}.grs-layout{grid-template-columns:210px minmax(0,1fr)}}
@media(max-width:760px){.grs-summary,.grs-card-overview{grid-template-columns:repeat(2,minmax(0,1fr))}.grs-layout{grid-template-columns:1fr}.grs-races{position:static}.grs-result-grid{grid-template-columns:1fr}.grs-race-head{align-items:flex-start;flex-direction:column}.grs-race-actions{align-items:flex-start}.grs-race-stats{justify-content:flex-start}.grs-card-strip{grid-template-columns:1fr}}
@media(max-width:520px){.grs-page{padding:12px 10px 60px}.grs-topbar,.grs-hero{align-items:stretch;flex-direction:column}.grs-summary,.grs-card-overview{grid-template-columns:1fr}.grs-wagers article{align-items:flex-start;flex-direction:column}.grs-ticket-result{text-align:left}}
`;
