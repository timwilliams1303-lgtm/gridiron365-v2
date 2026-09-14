"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type SurvivorEntry = {
  id: number;
  dogId: number | null;
  dogName: string | null;
  boxNumber: number;
  morningLineOdds: string | null;
  entryStatus: string;
};

type SurvivorPayload = {
  success: boolean;
  error?: string;
  enabled?: boolean;
  message?: string;
  participant?: {
    id: number;
    fantasyTeamId: number;
    entryName: string | null;
  } | null;
  game?: {
    id: number;
    gameNumber: number;
    status: string;
    winnerParticipantId?: number | null;
    winnerName?: string | null;
    aliveCount?: number;
    myStatus?: string;
    race?: {
      id: number;
      raceNumber: number;
      grade: string | null;
      distanceYards: number | null;
      scheduledPostTime: string | null;
      actualPostTime: string | null;
      raceStatus: string;
      open: boolean;
    } | null;
    entries?: SurvivorEntry[];
    myPick?: {
      id: number;
      entryId: number;
      dogId: number | null;
      boxNumber: number;
      alternateEntryId: number | null;
      alternateDogId: number | null;
      alternateBoxNumber: number | null;
      effectiveEntryId: number | null;
      effectiveBoxNumber: number | null;
      pickStatus: string;
      finishPosition: number | null;
      resultStatus: string | null;
      submittedAt: string;
    } | null;
  } | null;
};

type Props = {
  leagueId: string;
  cardId: number | null;
};

export default function GreyhoundDailySurvivorPanel({
  leagueId,
  cardId,
}: Props) {
  const [data, setData] = useState<SurvivorPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [primaryEntryId, setPrimaryEntryId] = useState<number | null>(null);
  const [alternateEntryId, setAlternateEntryId] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ leagueId });
      if (cardId) params.set("cardId", String(cardId));

      const response = await fetch(
        `/api/greyhound/daily-survivor?${params.toString()}`,
        { cache: "no-store" },
      );
      const payload = (await response.json()) as SurvivorPayload;

      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? "Unable to load Daily Survivor.");
      }

      setData(payload);

      if (payload.game?.myPick) {
        setPrimaryEntryId(payload.game.myPick.entryId);
        setAlternateEntryId(payload.game.myPick.alternateEntryId);
      } else {
        setPrimaryEntryId(null);
        setAlternateEntryId(null);
      }
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load Daily Survivor.",
      );
    } finally {
      setLoading(false);
    }
  }, [leagueId, cardId]);

  useEffect(() => {
    void load();
  }, [load]);

  const game = data?.game ?? null;
  const entries = game?.entries ?? [];
  const activeEntries = useMemo(
    () => entries.filter((entry) => entry.entryStatus === "active"),
    [entries],
  );

  const primary = entries.find((entry) => entry.id === primaryEntryId) ?? null;
  const alternate =
    entries.find((entry) => entry.id === alternateEntryId) ?? null;

  const canEdit =
    game?.status === "active" &&
    game?.myStatus === "alive" &&
    Boolean(game.race?.open);

  async function savePick() {
    if (!game?.race || !primaryEntryId || saving) return;

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/greyhound/daily-survivor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leagueId,
          gameId: game.id,
          raceId: game.race.id,
          entryId: primaryEntryId,
          alternateEntryId,
        }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.success) {
        throw new Error(
          payload?.error ?? "Unable to save Daily Survivor selection.",
        );
      }

      setMessage(
        `Top 3 pick saved: Box ${primary?.boxNumber ?? ""} ${primary?.dogName ?? "Runner"}${
          alternate
            ? ` · Scratch alternate: Box ${alternate.boxNumber} ${alternate.dogName ?? "Runner"}`
            : ""
        }.`,
      );

      await load();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save Daily Survivor selection.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (data && data.enabled === false) return null;

  if (!data && loading) {
    return (
      <section className="gds-card">
        <style>{styles}</style>
        Loading Daily Survivor…
      </section>
    );
  }

  if (!data?.enabled) return null;

  return (
    <section className="gds-card">
      <style>{styles}</style>

      <div className="gds-head">
        <div>
          <div className="gds-kicker">DAILY RACE SURVIVOR</div>
          <h2>
            {game?.status === "won"
              ? `Game ${game.gameNumber} Complete`
              : game
                ? `Game ${game.gameNumber}`
                : "Waiting for Race"}
          </h2>
          <p>
            Choose <strong>1 dog</strong>. Finish <strong>Top 3</strong> to survive.
          </p>
        </div>

        {game?.status === "active" ? (
          <div className="gds-live">
            <span>{game.aliveCount ?? 0}</span>
            ALIVE
          </div>
        ) : null}
      </div>

      {error ? <div className="gds-alert bad">{error}</div> : null}
      {message ? <div className="gds-alert good">{message}</div> : null}

      {game?.status === "won" ? (
        <div className="gds-winner">
          <span>🏆 DAILY SURVIVOR WINNER</span>
          <strong>{game.winnerName ?? "Winner"}</strong>
        </div>
      ) : null}

      {!game ? (
        <div className="gds-empty">
          {data.message ?? "No Daily Survivor race is available yet."}
        </div>
      ) : null}

      {game?.status === "active" && game.myStatus === "eliminated" ? (
        <div className="gds-eliminated">
          You have been eliminated from the current Daily Survivor game.
        </div>
      ) : null}

      {game?.race && game.myStatus === "alive" ? (
        <>
          <div className="gds-racebar">
            <div>
              <span>CURRENT SURVIVOR RACE</span>
              <strong>Race {game.race.raceNumber}</strong>
            </div>
            <div className="gds-meta">
              <b>TOP 3 SURVIVES</b>
              {game.race.grade ? <b>{game.race.grade}</b> : null}
              {game.race.distanceYards ? (
                <b>{game.race.distanceYards} yds</b>
              ) : null}
            </div>
          </div>

          <div className="gds-picker-block">
            <div className="gds-picker-title">
              <span>1</span>
              <div>
                <strong>Top 3 Pick</strong>
                <small>Choose the one dog you think will finish 1st, 2nd, or 3rd.</small>
              </div>
            </div>

            <div className="gds-grid">
              {activeEntries.map((entry) => {
                const selected = primaryEntryId === entry.id;
                return (
                  <button
                    key={`primary-${entry.id}`}
                    type="button"
                    disabled={!canEdit || saving}
                    className={`gds-dog${selected ? " selected" : ""}`}
                    onClick={() => {
                      setPrimaryEntryId(entry.id);
                      if (alternateEntryId === entry.id) {
                        setAlternateEntryId(null);
                      }
                      setMessage(null);
                    }}
                  >
                    <span className="gds-box">{entry.boxNumber}</span>
                    <span className="gds-doginfo">
                      <strong>{entry.dogName ?? "Runner"}</strong>
                      <small>{entry.morningLineOdds ? `ML ${entry.morningLineOdds}` : "ACTIVE"}</small>
                    </span>
                    <span className="gds-action">{selected ? "TOP 3 PICK" : "PICK"}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="gds-picker-block alt">
            <div className="gds-picker-title">
              <span>A</span>
              <div>
                <strong>Scratch Alternate</strong>
                <small>
                  Optional. This dog is used only if your Top 3 pick is scratched.
                </small>
              </div>
            </div>

            <div className="gds-grid">
              {activeEntries
                .filter((entry) => entry.id !== primaryEntryId)
                .map((entry) => {
                  const selected = alternateEntryId === entry.id;
                  return (
                    <button
                      key={`alternate-${entry.id}`}
                      type="button"
                      disabled={!canEdit || saving || !primaryEntryId}
                      className={`gds-dog alternate${selected ? " selected" : ""}`}
                      onClick={() => {
                        setAlternateEntryId(selected ? null : entry.id);
                        setMessage(null);
                      }}
                    >
                      <span className="gds-box">{entry.boxNumber}</span>
                      <span className="gds-doginfo">
                        <strong>{entry.dogName ?? "Runner"}</strong>
                        <small>{entry.morningLineOdds ? `ML ${entry.morningLineOdds}` : "ACTIVE"}</small>
                      </span>
                      <span className="gds-action">{selected ? "ALTERNATE" : "ALT"}</span>
                    </button>
                  );
                })}
            </div>
          </div>

          {primary ? (
            <div className="gds-ticket">
              <div>
                <span>TOP 3 PICK</span>
                <strong>Box {primary.boxNumber} · {primary.dogName ?? "Runner"}</strong>
              </div>
              <div>
                <span>SCRATCH ALTERNATE</span>
                <strong>
                  {alternate
                    ? `Box ${alternate.boxNumber} · ${alternate.dogName ?? "Runner"}`
                    : "None selected"}
                </strong>
              </div>
            </div>
          ) : null}

          <button
            type="button"
            className="gds-save"
            disabled={!canEdit || !primaryEntryId || saving}
            onClick={() => void savePick()}
          >
            {saving ? "Saving…" : "Save Survivor Pick"}
          </button>

          {game.myPick ? (
            <div className="gds-status">
              <span>SAVED PICK STATUS</span>
              <strong>
                {game.myPick.pickStatus === "pending"
                  ? "Waiting for official result"
                  : game.myPick.pickStatus === "survived"
                    ? "TOP 3 — SURVIVED"
                    : game.myPick.pickStatus === "missed"
                      ? "MISSED TOP 3"
                      : game.myPick.pickStatus}
              </strong>
              {game.myPick.effectiveBoxNumber &&
              game.myPick.effectiveBoxNumber !== game.myPick.boxNumber ? (
                <small>
                  Scratch alternate was activated: Box {game.myPick.effectiveBoxNumber}.
                </small>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}

      <div className="gds-rule">
        Your alternate does not count unless your primary dog is scratched. If every
        remaining live entry misses the Top 3 in the same race, nobody is eliminated.
      </div>
    </section>
  );
}

const styles = `
.gds-card,.gds-card *{box-sizing:border-box}
.gds-card{margin:14px 0;padding:16px;border:1px solid rgba(242,107,34,.38);border-radius:16px;background:radial-gradient(circle at top left,rgba(153,29,22,.24),transparent 38%),linear-gradient(145deg,#101113,#090a0c);color:#fff;box-shadow:0 18px 45px rgba(0,0,0,.22)}
.gds-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}
.gds-kicker{color:#ff6b22;font-size:9px;font-weight:950;letter-spacing:.14em}
.gds-head h2{margin:5px 0 4px;font-size:22px;font-weight:950}
.gds-head p{margin:0;color:#92979e;font-size:11px}.gds-head p strong{color:#fff}
.gds-live{min-width:70px;padding:9px 12px;border:1px solid rgba(242,107,34,.35);border-radius:11px;background:#15100e;color:#ff8750;font-size:8px;font-weight:950;text-align:center}
.gds-live span{display:block;color:#fff;font-size:20px;line-height:1}
.gds-alert,.gds-empty,.gds-eliminated{margin-top:10px;padding:10px 12px;border-radius:10px;font-size:10px;font-weight:800}
.gds-alert.bad,.gds-eliminated{border:1px solid rgba(198,51,43,.5);background:rgba(79,15,13,.3);color:#ffaaa5}
.gds-alert.good{border:1px solid rgba(56,169,99,.4);background:rgba(20,91,50,.22);color:#9ce8bc}
.gds-empty{border:1px solid #303238;background:#0c0d0f;color:#90959c}
.gds-winner{margin-top:12px;padding:16px;border:1px solid rgba(242,107,34,.48);border-radius:12px;background:linear-gradient(135deg,rgba(143,23,19,.38),rgba(242,107,34,.16))}
.gds-winner span,.gds-status span,.gds-ticket span{display:block;color:#ff8f55;font-size:8px;font-weight:950;letter-spacing:.12em}
.gds-winner strong{display:block;margin-top:5px;font-size:20px}
.gds-racebar{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:12px;padding:11px 12px;border:1px solid #2b2d31;border-radius:11px;background:#0c0d0f}
.gds-racebar span{display:block;color:#ff6b22;font-size:7px;font-weight:950;letter-spacing:.12em}.gds-racebar strong{display:block;margin-top:3px;font-size:15px}
.gds-meta{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}.gds-meta b{padding:5px 7px;border:1px solid #34363b;border-radius:999px;color:#aeb2b7;font-size:8px;text-transform:uppercase}
.gds-picker-block{margin-top:12px;padding:12px;border:1px solid #303236;border-radius:12px;background:#0c0d0f}.gds-picker-block.alt{border-color:#3b302b;background:#0e0c0b}
.gds-picker-title{display:flex;align-items:center;gap:9px}.gds-picker-title>span{display:grid;place-items:center;width:28px;height:28px;border-radius:999px;background:linear-gradient(135deg,#991d16,#f26b22);font-size:11px;font-weight:950}.gds-picker-title strong{display:block;font-size:11px}.gds-picker-title small{display:block;margin-top:2px;color:#858a91;font-size:8px}
.gds-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-top:10px}
.gds-dog{display:flex;align-items:center;gap:9px;min-height:58px;padding:8px;border:1px solid #34363a;border-radius:11px;background:#141517;color:#fff;cursor:pointer;text-align:left}.gds-dog.alternate{background:#12100f}
.gds-dog:hover:not(:disabled){border-color:#e76227;transform:translateY(-1px)}.gds-dog.selected{border-color:#ff6b22;background:linear-gradient(145deg,rgba(113,28,14,.55),rgba(48,20,12,.62))}.gds-dog:disabled{opacity:.45;cursor:not-allowed}
.gds-box{display:grid;place-items:center;width:34px;height:34px;flex:0 0 34px;border-radius:9px;background:#090a0c;border:1px solid #3c3e43;font-size:15px;font-weight:950}
.gds-doginfo{min-width:0;flex:1}.gds-doginfo strong{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10px}.gds-doginfo small{display:block;margin-top:3px;color:#848990;font-size:7px}.gds-action{color:#ff7b3b;font-size:7px;font-weight:950}
.gds-ticket{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px}.gds-ticket>div{padding:10px 11px;border:1px solid #34363a;border-radius:10px;background:#111214}.gds-ticket strong{display:block;margin-top:4px;font-size:10px}
.gds-save{width:100%;min-height:44px;margin-top:10px;border:0;border-radius:10px;background:linear-gradient(90deg,#991d16,#f26b22);color:#fff;font-size:10px;font-weight:950;cursor:pointer}.gds-save:disabled{opacity:.48;cursor:not-allowed}
.gds-status{margin-top:10px;padding:10px 11px;border:1px solid rgba(242,107,34,.3);border-radius:10px;background:rgba(92,31,12,.16)}.gds-status strong{display:block;margin-top:3px;font-size:10px}.gds-status small{display:block;margin-top:3px;color:#9a9fa6;font-size:8px}
.gds-rule{margin-top:12px;padding:9px 11px;border-left:3px solid #e76227;background:rgba(83,28,10,.14);color:#989da4;font-size:9px;line-height:1.5}
@media(max-width:950px){.gds-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:560px){.gds-card{padding:12px}.gds-head,.gds-racebar{align-items:stretch;flex-direction:column}.gds-meta{justify-content:flex-start}.gds-grid,.gds-ticket{grid-template-columns:1fr}.gds-live{align-self:flex-start}}
`;
