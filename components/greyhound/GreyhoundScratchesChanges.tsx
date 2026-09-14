"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type EntryRow = {
  id: number;
  raceId: number;
  dogId: number | null;
  dogName: string;
  boxNumber: number;
  morningLineOdds: string | null;
  kennel: string | null;
  trainer: string | null;
  weight: number | null;
  entryStatus: string;
  scratchDetectedAt: string | null;
};

type ReplacementRow = {
  id: number;
  wagerId: number;
  scratchedEntryId: number;
  scratchedDogName: string;
  scratchedBoxNumber: number | null;
  replacementEntryId: number | null;
  replacementDogName: string | null;
  replacementBoxNumber: number | null;
  alternateUsed: number | null;
  replacementStatus: string;
  detectedAt: string | null;
  appliedAt: string | null;
  notes: string | null;
};

type RaceRow = {
  id: number;
  raceNumber: number;
  grade: string | null;
  distanceYards: number | null;
  scheduledPostTime: string | null;
  actualPostTime: string | null;
  raceStatus: string;
  entries: EntryRow[];
  scratchSummary: {
    totalEntries: number;
    activeEntries: number;
    changedEntries: number;
    replacementRows: number;
    affectedLeagueWagers: number;
    noActionReplacements: number;
  };
  replacements: ReplacementRow[];
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
  scratchSummary: {
    racesWithChanges: number;
    changedEntries: number;
    replacementRows: number;
    noActionReplacements: number;
  };
  races: RaceRow[];
};

type ApiResponse = {
  success: boolean;
  error?: string;
  league?: {
    id: string;
    name: string;
  };
  summary?: {
    cards: number;
    races: number;
    entries: number;
    activeEntries: number;
    changedEntries: number;
    replacements: number;
    noActionReplacements: number;
  };
  cards?: CardRow[];
};

type Props = {
  leagueId: string;
};

function label(value: string | null | undefined) {
  return String(value ?? "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function dateLabel(value: string) {
  const [year, month, day] = value.split("-").map(Number);

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}

function timeLabel(value: string | null) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function statusClass(value: string) {
  const normalized = value.toLowerCase();

  if (normalized === "active") return "active";
  if (normalized.includes("scratch")) return "scratched";
  if (normalized.includes("withdraw")) return "withdrawn";
  if (normalized.includes("vacant")) return "vacant";

  return "changed";
}

export default function GreyhoundScratchesChanges({
  leagueId,
}: Props) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<number | null>(null);
  const [selectedRaceId, setSelectedRaceId] = useState<number | null>(null);

  const load = useCallback(
    async (silent = false) => {
      if (silent) setRefreshing(true);
      else setLoading(true);

      setError(null);

      try {
        const response = await fetch(
          `/api/greyhound/commissioner/scratches-changes?leagueId=${encodeURIComponent(
            leagueId,
          )}`,
          { cache: "no-store" },
        );

        const payload = (await response.json()) as ApiResponse;

        if (!response.ok || !payload.success) {
          throw new Error(
            payload.error ?? "Unable to load Scratches & Changes.",
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
            : "Unable to load Scratches & Changes.",
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

    const changedRace =
      selectedCard.races.find(
        (race) => race.scratchSummary.changedEntries > 0,
      ) ?? selectedCard.races[0];

    setSelectedRaceId((current) =>
      current && selectedCard.races.some((race) => race.id === current)
        ? current
        : changedRace?.id ?? null,
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
    entries: 0,
    activeEntries: 0,
    changedEntries: 0,
    replacements: 0,
    noActionReplacements: 0,
  };

  if (loading && !data) {
    return (
      <main className="gsc-page">
        <style>{styles}</style>
        <div className="gsc-shell">
          <div className="gsc-empty">Loading Scratches & Changes…</div>
        </div>
      </main>
    );
  }

  return (
    <main className="gsc-page">
      <style>{styles}</style>

      <div className="gsc-shell">
        <div className="gsc-topbar">
          <Link
            href={`/league/${leagueId}/greyhound/commissioner`}
            className="gsc-back"
          >
            ← Commissioner
          </Link>

          <button
            type="button"
            className="gsc-refresh"
            disabled={refreshing}
            onClick={() => void load(true)}
          >
            {refreshing ? "Refreshing…" : "Refresh Changes"}
          </button>
        </div>

        <section className="gsc-hero">
          <div>
            <div className="gsc-kicker">
              G365 GREYHOUND · COMMISSIONER
            </div>
            <h1>Scratches & Changes</h1>
            <p>
              Review official scratches, withdrawals, vacant boxes, and
              automatic wager alternate replacements detected from the
              Greyhound feed.
            </p>
          </div>

          <div className="gsc-live">LIVE FEED STATUS</div>
        </section>

        {error ? <div className="gsc-error">{error}</div> : null}

        <section className="gsc-summary">
          <article>
            <span>ENTRIES</span>
            <strong>{summary.entries}</strong>
            <small>{summary.activeEntries} active</small>
          </article>
          <article>
            <span>CHANGES</span>
            <strong>{summary.changedEntries}</strong>
            <small>non-active entries</small>
          </article>
          <article>
            <span>REPLACEMENTS</span>
            <strong>{summary.replacements}</strong>
            <small>automatic alternate actions</small>
          </article>
          <article>
            <span>NO ACTION</span>
            <strong>{summary.noActionReplacements}</strong>
            <small>no eligible alternate</small>
          </article>
        </section>

        <section className="gsc-panel">
          <div className="gsc-panel-head">
            <div>
              <div className="gsc-kicker">RACE CARDS</div>
              <h2>Cards with Scratch Monitoring</h2>
            </div>
          </div>

          {(data?.cards ?? []).length > 0 ? (
            <div className="gsc-card-strip">
              {(data?.cards ?? []).map((card) => (
                <button
                  key={card.id}
                  type="button"
                  className={`gsc-card-choice ${
                    card.id === selectedCardId ? "active" : ""
                  }`}
                  onClick={() => setSelectedCardId(card.id)}
                >
                  <span>
                    {card.track?.name ??
                      card.track?.code ??
                      "Greyhound Track"}
                  </span>
                  <strong>{dateLabel(card.raceDate)}</strong>
                  <small>
                    {card.scratchSummary.racesWithChanges} race
                    {card.scratchSummary.racesWithChanges === 1 ? "" : "s"}{" "}
                    with changes · {card.scratchSummary.changedEntries} changed
                    entries
                  </small>
                </button>
              ))}
            </div>
          ) : (
            <div className="gsc-empty">
              No Greyhound cards are available yet.
            </div>
          )}
        </section>

        {selectedCard ? (
          <>
            <section className="gsc-card-overview">
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
                <span>CHANGED ENTRIES</span>
                <strong>{selectedCard.scratchSummary.changedEntries}</strong>
              </article>
              <article>
                <span>REPLACEMENT LOGS</span>
                <strong>{selectedCard.scratchSummary.replacementRows}</strong>
              </article>
            </section>

            <section className="gsc-layout">
              <aside className="gsc-races">
                <div className="gsc-kicker">RACES</div>

                {selectedCard.races.map((race) => (
                  <button
                    key={race.id}
                    type="button"
                    className={`gsc-race-button ${
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

                    <small
                      className={
                        race.scratchSummary.changedEntries > 0
                          ? "changed"
                          : ""
                      }
                    >
                      {race.scratchSummary.changedEntries > 0
                        ? `${race.scratchSummary.changedEntries} change${
                            race.scratchSummary.changedEntries === 1 ? "" : "s"
                          }`
                        : "Clear"}
                    </small>
                  </button>
                ))}
              </aside>

              <div className="gsc-detail">
                {selectedRace ? (
                  <>
                    <section className="gsc-race-head">
                      <div>
                        <div className="gsc-kicker">RACE CHANGE REVIEW</div>
                        <h2>Race {selectedRace.raceNumber}</h2>
                        <p>
                          {selectedRace.grade ?? "Grade —"} ·{" "}
                          {selectedRace.distanceYards
                            ? `${selectedRace.distanceYards} yards`
                            : "Distance unavailable"}{" "}
                          · {label(selectedRace.raceStatus)}
                        </p>
                      </div>

                      <div className="gsc-race-stats">
                        <span>
                          {selectedRace.scratchSummary.activeEntries} active
                        </span>
                        <span>
                          {selectedRace.scratchSummary.changedEntries} changed
                        </span>
                        <span>
                          {selectedRace.scratchSummary.affectedLeagueWagers}{" "}
                          affected wagers
                        </span>
                      </div>
                    </section>

                    <section className="gsc-block">
                      <div className="gsc-block-title">
                        <div>
                          <span>RUNNERS</span>
                          <h3>Entry Status</h3>
                        </div>
                        <small>{selectedRace.entries.length} entries</small>
                      </div>

                      <div className="gsc-entry-grid">
                        {selectedRace.entries.map((entry) => (
                          <article
                            key={entry.id}
                            className={`gsc-entry ${statusClass(
                              entry.entryStatus,
                            )}`}
                          >
                            <div className="gsc-box">{entry.boxNumber}</div>

                            <div className="gsc-entry-info">
                              <strong>{entry.dogName}</strong>
                              <span>
                                {entry.trainer
                                  ? `Trainer: ${entry.trainer}`
                                  : "Trainer —"}
                                {entry.weight
                                  ? ` · ${entry.weight} lb`
                                  : ""}
                              </span>
                              {entry.scratchDetectedAt ? (
                                <small>
                                  Detected {timeLabel(entry.scratchDetectedAt)}
                                </small>
                              ) : null}
                            </div>

                            <div
                              className={`gsc-entry-status ${statusClass(
                                entry.entryStatus,
                              )}`}
                            >
                              {label(entry.entryStatus)}
                            </div>
                          </article>
                        ))}
                      </div>
                    </section>

                    <section className="gsc-block">
                      <div className="gsc-block-title">
                        <div>
                          <span>ALTERNATE PROCESSING</span>
                          <h3>Wager Replacement Log</h3>
                        </div>
                        <small>
                          {selectedRace.replacements.length} action
                          {selectedRace.replacements.length === 1 ? "" : "s"}
                        </small>
                      </div>

                      {selectedRace.replacements.length > 0 ? (
                        <div className="gsc-replacements">
                          {selectedRace.replacements.map((replacement) => (
                            <article key={replacement.id}>
                              <div>
                                <span className="gsc-replacement-ticket">
                                  WAGER #{replacement.wagerId}
                                </span>

                                <strong>
                                  Box {replacement.scratchedBoxNumber ?? "—"} ·{" "}
                                  {replacement.scratchedDogName}
                                </strong>

                                <small>
                                  {replacement.replacementEntryId != null
                                    ? `Replaced by Box ${
                                        replacement.replacementBoxNumber ?? "—"
                                      } · ${
                                        replacement.replacementDogName ??
                                        "Alternate"
                                      }${
                                        replacement.alternateUsed
                                          ? ` using Alternate ${replacement.alternateUsed}`
                                          : ""
                                      }`
                                    : "No eligible alternate was applied"}
                                </small>

                                {replacement.notes ? (
                                  <small className="gsc-note">
                                    {replacement.notes}
                                  </small>
                                ) : null}
                              </div>

                              <div className="gsc-replacement-status">
                                <span>
                                  {label(replacement.replacementStatus)}
                                </span>
                                <small>
                                  {replacement.appliedAt
                                    ? `Applied ${timeLabel(
                                        replacement.appliedAt,
                                      )}`
                                    : "Pending"}
                                </small>
                              </div>
                            </article>
                          ))}
                        </div>
                      ) : (
                        <div className="gsc-empty compact">
                          No league wager replacement activity for this race.
                        </div>
                      )}
                    </section>
                  </>
                ) : (
                  <div className="gsc-empty">
                    Select a race to review its scratches and changes.
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
.gsc-page,.gsc-page *{box-sizing:border-box}
.gsc-page{min-height:100vh;padding:18px 16px 70px;background:radial-gradient(circle at 12% -4%,rgba(145,24,14,.2),transparent 30%),linear-gradient(180deg,#07080a,#0b0c0f 52%,#07080a);color:#fff}
.gsc-shell{width:min(1500px,100%);margin:0 auto}
.gsc-topbar{display:flex;justify-content:space-between;gap:10px;margin-bottom:10px}
.gsc-back,.gsc-refresh{min-height:40px;padding:0 13px;border:1px solid #34373b;border-radius:10px;background:#101113;color:#eee;text-decoration:none;font-size:9px;font-weight:950;cursor:pointer}
.gsc-refresh{border-color:rgba(242,107,34,.42);background:linear-gradient(90deg,#7e1b13,#d7471d)}
.gsc-refresh:disabled{opacity:.55;cursor:not-allowed}
.gsc-hero{display:flex;justify-content:space-between;gap:18px;align-items:center;padding:22px;border:1px solid rgba(242,107,34,.3);border-radius:18px;background:linear-gradient(135deg,rgba(126,24,15,.42),rgba(242,107,34,.08),#101113)}
.gsc-kicker{color:#ff6b22;font-size:8px;font-weight:950;letter-spacing:.15em}
.gsc-hero h1{margin:6px 0;font-size:clamp(30px,4vw,44px);font-weight:950;letter-spacing:-.035em}
.gsc-hero p{max-width:820px;margin:0;color:#9a9fa6;font-size:11px;line-height:1.6}
.gsc-live{padding:8px 10px;border:1px solid rgba(242,107,34,.4);border-radius:999px;color:#ff9a64;font-size:8px;font-weight:950}
.gsc-error{margin-top:10px;padding:12px;border:1px solid rgba(205,56,43,.5);border-radius:11px;background:rgba(92,19,14,.18);color:#ffaaa2;font-size:10px}
.gsc-summary,.gsc-card-overview{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px;margin:12px 0}
.gsc-summary article,.gsc-card-overview article{padding:13px;border:1px solid #2c2f33;border-radius:12px;background:#101113}
.gsc-summary span,.gsc-card-overview span{display:block;color:#7e838a;font-size:7px;font-weight:950;letter-spacing:.08em}
.gsc-summary strong,.gsc-card-overview strong{display:block;margin-top:5px;font-size:15px;font-weight:950}
.gsc-summary small{display:block;margin-top:3px;color:#9a9fa5;font-size:8px}
.gsc-panel,.gsc-block{margin-top:12px;padding:15px;border:1px solid #2c2f33;border-radius:14px;background:#101113}
.gsc-panel-head,.gsc-block-title{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:10px}
.gsc-panel h2,.gsc-block h3{margin:4px 0 0;font-weight:950}
.gsc-card-strip{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}
.gsc-card-choice{padding:11px;border:1px solid #2c2e32;border-radius:11px;background:#0c0d0f;color:#fff;text-align:left;cursor:pointer}
.gsc-card-choice.active{border-color:#d94c22;background:linear-gradient(145deg,rgba(130,28,16,.28),#0c0d0f)}
.gsc-card-choice span{display:block;color:#ff6b22;font-size:7px;font-weight:950}
.gsc-card-choice strong{display:block;margin:4px 0;font-size:11px}
.gsc-card-choice small{display:block;color:#7f848b;font-size:8px;line-height:1.4}
.gsc-layout{display:grid;grid-template-columns:245px minmax(0,1fr);gap:12px;align-items:start}
.gsc-races{position:sticky;top:12px;padding:12px;border:1px solid #2c2f33;border-radius:13px;background:#101113}
.gsc-race-button{display:flex;width:100%;justify-content:space-between;align-items:center;gap:8px;margin-top:7px;padding:10px;border:1px solid #272a2e;border-radius:9px;background:#0b0c0e;color:#fff;text-align:left;cursor:pointer}
.gsc-race-button.active{border-color:#d74d24;background:rgba(115,28,15,.22)}
.gsc-race-button strong{display:block;font-size:10px}
.gsc-race-button span,.gsc-race-button small{display:block;color:#858a91;font-size:7px}
.gsc-race-button small.changed{color:#ff8454;font-weight:950}
.gsc-detail{min-width:0}
.gsc-race-head{display:flex;justify-content:space-between;align-items:flex-end;gap:12px;padding:15px;border:1px solid #2c2f33;border-radius:14px;background:#101113}
.gsc-race-head h2{margin:4px 0;font-size:24px;font-weight:950}
.gsc-race-head p{margin:0;color:#858a91;font-size:9px}
.gsc-race-stats{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:6px}
.gsc-race-stats span{padding:6px 8px;border:1px solid #34373b;border-radius:999px;color:#aeb2b8;font-size:7px;font-weight:900}
.gsc-block-title span{color:#e76227;font-size:7px;font-weight:950;letter-spacing:.12em}
.gsc-block-title small{color:#7d8289;font-size:8px}
.gsc-entry-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.gsc-entry{display:grid;grid-template-columns:42px minmax(0,1fr) auto;gap:10px;align-items:center;padding:10px;border:1px solid #292b2f;border-radius:10px;background:#0c0d0f}
.gsc-entry.scratched,.gsc-entry.withdrawn,.gsc-entry.vacant,.gsc-entry.changed{border-color:rgba(203,52,26,.45);background:rgba(94,22,14,.14)}
.gsc-box{display:grid;place-items:center;width:38px;height:38px;border-radius:9px;background:#17191c;border:1px solid #34373b;font-size:13px;font-weight:950}
.gsc-entry-info strong{display:block;font-size:10px}
.gsc-entry-info span,.gsc-entry-info small{display:block;margin-top:2px;color:#81868d;font-size:7px}
.gsc-entry-status{padding:5px 7px;border:1px solid #35383d;border-radius:999px;color:#a9adb3;font-size:7px;font-weight:950;text-transform:uppercase}
.gsc-entry-status.active{border-color:rgba(55,170,96,.36);color:#7bdca2}
.gsc-entry-status.scratched,.gsc-entry-status.withdrawn,.gsc-entry-status.vacant,.gsc-entry-status.changed{border-color:rgba(220,72,48,.44);color:#ff927f}
.gsc-replacements{display:grid;gap:8px}
.gsc-replacements article{display:flex;justify-content:space-between;gap:12px;padding:11px;border:1px solid #292b2f;border-radius:10px;background:#0c0d0f}
.gsc-replacement-ticket{display:block;color:#ff7b3b;font-size:7px;font-weight:950}
.gsc-replacements strong{display:block;margin-top:3px;font-size:10px}
.gsc-replacements small{display:block;margin-top:3px;color:#81868d;font-size:7px}
.gsc-note{color:#ffb184!important}
.gsc-replacement-status{text-align:right}
.gsc-replacement-status span{display:inline-block;padding:5px 7px;border:1px solid rgba(242,107,34,.42);border-radius:999px;color:#ff9d68;font-size:7px;font-weight:950}
.gsc-empty{padding:18px;border:1px solid #2c2f33;border-radius:12px;background:#0c0d0f;color:#8d9299;font-size:10px}
.gsc-empty.compact{border:0;padding:10px}
@media(max-width:1100px){.gsc-card-strip{grid-template-columns:repeat(2,minmax(0,1fr))}.gsc-layout{grid-template-columns:210px minmax(0,1fr)}}
@media(max-width:760px){.gsc-summary,.gsc-card-overview{grid-template-columns:repeat(2,minmax(0,1fr))}.gsc-layout{grid-template-columns:1fr}.gsc-races{position:static}.gsc-entry-grid{grid-template-columns:1fr}.gsc-race-head{align-items:flex-start;flex-direction:column}.gsc-race-stats{justify-content:flex-start}.gsc-card-strip{grid-template-columns:1fr}}
@media(max-width:520px){.gsc-page{padding:12px 10px 60px}.gsc-topbar,.gsc-hero{align-items:stretch;flex-direction:column}.gsc-summary,.gsc-card-overview{grid-template-columns:1fr}.gsc-replacements article{align-items:flex-start;flex-direction:column}.gsc-replacement-status{text-align:left}.gsc-entry{grid-template-columns:38px minmax(0,1fr)}.gsc-entry-status{grid-column:2}}
`;
