"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type LeagueFormat = "dynasty" | "redraft";

type Props = {
  leagueId: string;
  sourceSeason: number;
  leagueFormat: LeagueFormat;
  isCommissioner: boolean;
  sourceSeasonComplete: boolean;
  championRecorded: boolean;
};

type ChecklistItem = {
  key?: string | null;
  label?: string | null;
  complete?: boolean | null;
  required?: boolean | null;
  [key: string]: unknown;
};

type DynastyChecklist = {
  success?: boolean;
  leagueId?: string;
  leagueStatus?: string | null;
  currentLeagueSeason?: number | null;
  checklistType?: string | null;
  sourceSeason?: number | null;
  targetSeason?: number | null;
  readyToActivate?: boolean | null;
  draftId?: string | null;
  draftStatus?: string | null;
  draftOrderMethod?: string | null;
  activeTeams?: number | null;
  rosterSize?: number | null;
  items?: ChecklistItem[] | null;
};

type RedraftReadiness = {
  activeTeams: number;
  targetRosterRows: number;
  targetDrafts: number;
};

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function numberValue(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function prettyStatus(value: string | null | undefined): string {
  const text = String(value ?? "").trim();
  if (!text) return "Not Ready";

  return text
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function itemDetail(item: ChecklistItem): string | null {
  const key = String(item.key ?? "");

  if (key === "keepers_finalized") {
    return `${numberValue(item.carriedOver)} / ${numberValue(
      item.expected
    )} protected players carried forward`;
  }

  if (key === "draft_pick_assets") {
    return `${numberValue(item.resolvedAssets)} / ${numberValue(
      item.expectedAssets
    )} pick assets resolved`;
  }

  if (
    key === "annual_draft_completed" ||
    key === "startup_draft_completed"
  ) {
    return `${numberValue(item.completedPicks)} / ${numberValue(
      item.expectedPicks
    )} draft picks completed`;
  }

  if (key === "rosters_valid") {
    return `${numberValue(item.rosteredPlayers)} / ${numberValue(
      item.expectedPlayers
    )} roster spots filled`;
  }

  if (key === "teams_ready") {
    return `${numberValue(item.readyTeams)} / ${numberValue(
      item.activeTeams
    )} teams ready`;
  }

  if (key === "draft_order" && item.method) {
    return `Order method: ${prettyStatus(String(item.method))}`;
  }

  if (key === "calendar_ready") {
    return `${numberValue(item.calendarRows)} calendar rows currently prepared`;
  }

  if (key === "matchups_ready") {
    return `${numberValue(item.matchups)} matchups currently prepared`;
  }

  return null;
}

export default function NhlTraditionalNewSeason({
  leagueId,
  sourceSeason,
  leagueFormat,
  isCommissioner,
  sourceSeasonComplete,
  championRecorded,
}: Props) {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState(false);
  const [checklist, setChecklist] = useState<DynastyChecklist | null>(null);
  const [redraftReadiness, setRedraftReadiness] =
    useState<RedraftReadiness | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const targetSeason = sourceSeason + 1;

  const loadState = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const supabase = createSupabaseBrowserClient();

      if (leagueFormat === "dynasty") {
        const { data, error: rpcError } = await supabase.rpc(
          "get_nhl_dynasty_season_checklist",
          {
            p_league_id: leagueId,
            p_target_season: targetSeason,
          }
        );

        if (rpcError) {
          throw new Error(rpcError.message);
        }

        setChecklist(asRecord(data) as DynastyChecklist);
        setRedraftReadiness(null);
      } else {
        const [
          activeTeamsResult,
          targetRosterResult,
          targetDraftResult,
        ] = await Promise.all([
          supabase
            .from("fantasy_teams")
            .select("id", { count: "exact", head: true })
            .eq("league_id", leagueId)
            .eq("active", true),

          supabase
            .from("nhl_traditional_rosters")
            .select("id", { count: "exact", head: true })
            .eq("league_id", leagueId)
            .eq("season", targetSeason),

          supabase
            .from("nhl_traditional_drafts")
            .select("id", { count: "exact", head: true })
            .eq("league_id", leagueId)
            .eq("season", targetSeason),
        ]);

        if (activeTeamsResult.error) {
          throw new Error(activeTeamsResult.error.message);
        }
        if (targetRosterResult.error) {
          throw new Error(targetRosterResult.error.message);
        }
        if (targetDraftResult.error) {
          throw new Error(targetDraftResult.error.message);
        }

        setRedraftReadiness({
          activeTeams: activeTeamsResult.count ?? 0,
          targetRosterRows: targetRosterResult.count ?? 0,
          targetDrafts: targetDraftResult.count ?? 0,
        });
        setChecklist(null);
      }
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to load New Season readiness."
      );
    } finally {
      setLoading(false);
    }
  }, [leagueFormat, leagueId, targetSeason]);

  useEffect(() => {
    void loadState();
  }, [loadState]);

  const dynastyItems = useMemo(
    () => (Array.isArray(checklist?.items) ? checklist.items : []),
    [checklist]
  );

  const dynastyRequiredItems = useMemo(
    () => dynastyItems.filter((item) => item.required !== false),
    [dynastyItems]
  );

  const dynastyBlockingItems = useMemo(
    () =>
      dynastyRequiredItems.filter((item) => {
        const key = String(item.key ?? "");

        /*
         * The activation RPC intentionally creates the calendar and
         * matchups transactionally. They are informational here and
         * are not part of readyToActivate.
         */
        if (key === "calendar_ready" || key === "matchups_ready") {
          return false;
        }

        return item.complete !== true;
      }),
    [dynastyRequiredItems]
  );

  const redraftChecks = useMemo(() => {
    const activeTeams = redraftReadiness?.activeTeams ?? 0;
    const targetRosterRows = redraftReadiness?.targetRosterRows ?? 0;
    const targetDrafts = redraftReadiness?.targetDrafts ?? 0;

    return [
      {
        key: "source_complete",
        label: `${sourceSeason} Season Complete`,
        complete: sourceSeasonComplete,
        detail:
          "The completed season must remain the canonical source season until renewal.",
      },
      {
        key: "champion",
        label: `${sourceSeason} Champion Recorded`,
        complete: championRecorded,
        detail:
          "A champion is required before the completed season can be archived.",
      },
      {
        key: "active_teams",
        label: "Active Teams Ready",
        complete: activeTeams >= 2,
        detail: `${activeTeams} active teams`,
      },
      {
        key: "empty_target_rosters",
        label: `${targetSeason} Rosters Empty`,
        complete: targetRosterRows === 0,
        detail:
          targetRosterRows === 0
            ? "Ready for a clean Redraft season."
            : `${targetRosterRows} existing target-season roster rows would be protected from overwrite.`,
      },
      {
        key: "no_target_draft",
        label: `No Existing ${targetSeason} Draft`,
        complete: targetDrafts === 0,
        detail:
          targetDrafts === 0
            ? "Renewal can create the new Redraft safely."
            : `${targetDrafts} target-season draft record(s) already exist.`,
      },
    ];
  }, [
    championRecorded,
    redraftReadiness,
    sourceSeason,
    sourceSeasonComplete,
    targetSeason,
  ]);

  const redraftReady =
    !loading &&
    !error &&
    redraftChecks.every((item) => item.complete);

  const dynastyReady =
    !loading &&
    !error &&
    checklist?.readyToActivate === true &&
    dynastyBlockingItems.length === 0;

  const canActivate =
    isCommissioner &&
    (leagueFormat === "dynasty" ? dynastyReady : redraftReady);

  async function activateSeason() {
    if (!canActivate || activating) return;

    setActivating(true);
    setError(null);

    try {
      const supabase = createSupabaseBrowserClient();

      if (leagueFormat === "dynasty") {
        const { data, error: rpcError } = await supabase.rpc(
          "commissioner_activate_nhl_dynasty_season",
          {
            p_league_id: leagueId,
            p_target_season: targetSeason,
          }
        );

        if (rpcError) {
          throw new Error(rpcError.message);
        }

        const result = asRecord(data);

        if (result.success !== true) {
          throw new Error(
            String(
              result.message ??
                `Unable to activate the ${targetSeason} Dynasty season.`
            )
          );
        }
      } else {
        const { data, error: rpcError } = await supabase.rpc(
          "commissioner_rollover_nhl_redraft_season",
          {
            p_league_id: leagueId,
            p_expected_current_season: sourceSeason,
          }
        );

        if (rpcError) {
          throw new Error(rpcError.message);
        }

        const result = asRecord(data);

        if (result.success !== true) {
          throw new Error(
            String(
              result.message ??
                `Unable to renew the league for ${targetSeason}.`
            )
          );
        }
      }

      setConfirmOpen(false);

      /*
       * The canonical league season has now changed. Leave the old
       * offseason workspace and force fresh server data.
       */
      router.replace(`/league/${leagueId}/nhl`);
      router.refresh();
    } catch (caught) {
      setConfirmOpen(false);
      setError(
        caught instanceof Error
          ? caught.message
          : "New Season activation failed."
      );
      setActivating(false);
    }
  }

  const isDynasty = leagueFormat === "dynasty";

  return (
    <main className="ns-page">
      <div className="ns-shell">
        <div className="ns-topbar">
          <Link
            href={`/league/${leagueId}/nhl/offseason`}
            className="ns-back"
          >
            ← Back to Offseason
          </Link>

          <span className="ns-format">
            {isDynasty ? "DYNASTY" : "REDRAFT"}
          </span>
        </div>

        <section className="ns-hero">
          <div className="ns-kicker">G365 NHL TRADITIONAL</div>
          <h1>New Season</h1>
          <p>
            {isDynasty
              ? `Finish the ${sourceSeason} → ${targetSeason} Dynasty transition and activate the new fantasy season.`
              : `Archive ${sourceSeason} and renew this Redraft league for ${targetSeason}.`}
          </p>

          <div className="ns-season-flow">
            <div className="ns-season-box">
              <span>Current</span>
              <strong>{sourceSeason}</strong>
            </div>
            <div className="ns-arrow">→</div>
            <div className="ns-season-box ns-season-target">
              <span>Next</span>
              <strong>{targetSeason}</strong>
            </div>
          </div>
        </section>

        {error ? (
          <section className="ns-alert ns-alert-error">
            <strong>Unable to continue</strong>
            <span>{error}</span>
            <button type="button" onClick={() => void loadState()}>
              Retry
            </button>
          </section>
        ) : null}

        <div className="ns-grid">
          <section className="ns-card">
            <div className="ns-card-heading">
              <div>
                <span className="ns-eyebrow">READINESS</span>
                <h2>
                  {isDynasty
                    ? `${targetSeason} Activation Checklist`
                    : `${targetSeason} Renewal Checklist`}
                </h2>
              </div>

              <span
                className={`ns-state ${
                  (isDynasty ? dynastyReady : redraftReady)
                    ? "ns-state-ready"
                    : "ns-state-waiting"
                }`}
              >
                {loading
                  ? "CHECKING"
                  : isDynasty
                    ? dynastyReady
                      ? "READY"
                      : "WAITING"
                    : redraftReady
                      ? "READY"
                      : "WAITING"}
              </span>
            </div>

            {loading ? (
              <div className="ns-loading">
                <div className="ns-spinner" />
                Checking season readiness…
              </div>
            ) : isDynasty ? (
              <div className="ns-checklist">
                {dynastyItems.map((item, index) => {
                  const key = String(item.key ?? `item-${index}`);
                  const informational =
                    key === "calendar_ready" || key === "matchups_ready";
                  const complete = item.complete === true;
                  const detail = itemDetail(item);

                  return (
                    <div
                      key={key}
                      className={`ns-check ${
                        complete ? "ns-check-pass" : "ns-check-wait"
                      }`}
                    >
                      <div className="ns-check-icon">
                        {complete ? "✓" : informational ? "↻" : "!"}
                      </div>
                      <div className="ns-check-copy">
                        <strong>
                          {String(item.label ?? "Season Requirement")}
                        </strong>
                        {detail ? <span>{detail}</span> : null}
                        {informational && !complete ? (
                          <span>
                            Created automatically when the season is
                            activated.
                          </span>
                        ) : null}
                      </div>
                      <span className="ns-check-status">
                        {complete
                          ? "PASS"
                          : informational
                            ? "ON ACTIVATION"
                            : "WAITING"}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="ns-checklist">
                {redraftChecks.map((item) => (
                  <div
                    key={item.key}
                    className={`ns-check ${
                      item.complete ? "ns-check-pass" : "ns-check-wait"
                    }`}
                  >
                    <div className="ns-check-icon">
                      {item.complete ? "✓" : "!"}
                    </div>
                    <div className="ns-check-copy">
                      <strong>{item.label}</strong>
                      <span>{item.detail}</span>
                    </div>
                    <span className="ns-check-status">
                      {item.complete ? "PASS" : "WAITING"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <aside className="ns-side">
            <section className="ns-card ns-summary">
              <span className="ns-eyebrow">
                {isDynasty ? "ACTIVATION" : "RENEWAL"}
              </span>
              <h2>
                {isDynasty
                  ? `Activate ${targetSeason}`
                  : `Renew for ${targetSeason}`}
              </h2>

              {isDynasty ? (
                <>
                  <p>
                    Protected players and the completed annual draft
                    already form the {targetSeason} rosters.
                  </p>

                  <div className="ns-stat-grid">
                    <div>
                      <span>Teams</span>
                      <strong>{checklist?.activeTeams ?? "—"}</strong>
                    </div>
                    <div>
                      <span>Roster Size</span>
                      <strong>{checklist?.rosterSize ?? "—"}</strong>
                    </div>
                    <div>
                      <span>Draft</span>
                      <strong>
                        {prettyStatus(checklist?.draftStatus)}
                      </strong>
                    </div>
                    <div>
                      <span>Order</span>
                      <strong>
                        {prettyStatus(checklist?.draftOrderMethod)}
                      </strong>
                    </div>
                  </div>

                  <div className="ns-info">
                    <strong>What activation does</strong>
                    <p>
                      Advances the canonical league season to{" "}
                      {targetSeason}, creates the season calendar and
                      matchup schedule, refreshes the future Dynasty
                      pick window, and starts the new season lifecycle.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <p>
                    Redraft renewal preserves {sourceSeason} history,
                    advances the league to {targetSeason}, and creates
                    the fresh draft.
                  </p>

                  <div className="ns-stat-grid">
                    <div>
                      <span>Teams</span>
                      <strong>
                        {redraftReadiness?.activeTeams ?? "—"}
                      </strong>
                    </div>
                    <div>
                      <span>New Rosters</span>
                      <strong>EMPTY</strong>
                    </div>
                    <div>
                      <span>Old Season</span>
                      <strong>PRESERVED</strong>
                    </div>
                    <div>
                      <span>New Draft</span>
                      <strong>AUTO-CREATED</strong>
                    </div>
                  </div>

                  <div className="ns-warning">
                    <strong>Redraft reset</strong>
                    <p>
                      {targetSeason} begins with empty fantasy rosters.
                      The renewal process archives {sourceSeason} and
                      creates the new Redraft in Ready status.
                    </p>
                  </div>
                </>
              )}

              {!isCommissioner ? (
                <div className="ns-member-note">
                  Only the league commissioner can complete this
                  season transition.
                </div>
              ) : null}

              <button
                type="button"
                className="ns-primary"
                disabled={!canActivate || activating}
                onClick={() => setConfirmOpen(true)}
              >
                {activating
                  ? "WORKING…"
                  : isDynasty
                    ? `ACTIVATE ${targetSeason} SEASON`
                    : `RENEW LEAGUE FOR ${targetSeason}`}
              </button>

              {isCommissioner && !canActivate && !loading ? (
                <p className="ns-disabled-help">
                  Complete every required item marked WAITING before
                  continuing.
                </p>
              ) : null}
            </section>

            <section className="ns-card ns-history">
              <span className="ns-eyebrow">HISTORY</span>
              <h3>{sourceSeason} stays preserved</h3>
              <p>
                Season history, recap, trophies, standings, and draft
                records remain tied to their original season.
              </p>
              <div className="ns-links">
                <Link href={`/league/${leagueId}/nhl/recap`}>
                  Season Recap
                </Link>
                <Link href={`/league/${leagueId}/nhl/trophy-case`}>
                  Trophy Case
                </Link>
                <Link
                  href={`/league/${leagueId}/nhl/offseason/draft-results`}
                >
                  Draft Results
                </Link>
              </div>
            </section>
          </aside>
        </div>
      </div>

      {confirmOpen ? (
        <div
          className="ns-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !activating) {
              setConfirmOpen(false);
            }
          }}
        >
          <section
            className="ns-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-season-confirm-title"
          >
            <span className="ns-eyebrow">FINAL CONFIRMATION</span>
            <h2 id="new-season-confirm-title">
              {isDynasty
                ? `Activate the ${targetSeason} season?`
                : `Renew this league for ${targetSeason}?`}
            </h2>

            <p>
              {isDynasty
                ? `This advances the league from ${sourceSeason} to ${targetSeason}. The finalized keepers and completed annual draft become the active ${targetSeason} rosters.`
                : `This archives ${sourceSeason}, advances the league to ${targetSeason}, starts with empty Redraft rosters, and creates the new ${targetSeason} draft.`}
            </p>

            <div className="ns-modal-actions">
              <button
                type="button"
                className="ns-secondary"
                disabled={activating}
                onClick={() => setConfirmOpen(false)}
              >
                CANCEL
              </button>
              <button
                type="button"
                className="ns-primary"
                disabled={activating}
                onClick={() => void activateSeason()}
              >
                {activating
                  ? "PROCESSING…"
                  : isDynasty
                    ? `YES, ACTIVATE ${targetSeason}`
                    : `YES, RENEW FOR ${targetSeason}`}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      <style jsx>{`
        .ns-page {
          min-height: 100vh;
          padding: 22px 16px 56px;
          color: #f8fafc;
          background:
            radial-gradient(circle at 8% 0%, rgba(239, 68, 68, 0.16), transparent 31rem),
            radial-gradient(circle at 95% 10%, rgba(249, 115, 22, 0.1), transparent 28rem),
            #07090d;
        }

        .ns-shell {
          width: min(1180px, 100%);
          margin: 0 auto;
        }

        .ns-topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 16px;
        }

        .ns-back,
        .ns-links a {
          color: #fdba74;
          text-decoration: none;
          font-weight: 800;
        }

        .ns-back:hover,
        .ns-links a:hover {
          color: #fff;
        }

        .ns-format {
          border: 1px solid rgba(249, 115, 22, 0.4);
          border-radius: 999px;
          padding: 7px 11px;
          color: #fed7aa;
          background: rgba(249, 115, 22, 0.08);
          font-size: 11px;
          font-weight: 950;
          letter-spacing: 0.14em;
        }

        .ns-hero {
          overflow: hidden;
          position: relative;
          padding: 28px;
          border: 1px solid rgba(248, 113, 113, 0.2);
          border-radius: 22px;
          background:
            linear-gradient(125deg, rgba(127, 29, 29, 0.48), rgba(20, 12, 10, 0.84) 54%, rgba(9, 9, 11, 0.96)),
            #111318;
          box-shadow: 0 24px 60px rgba(0, 0, 0, 0.32);
        }

        .ns-kicker,
        .ns-eyebrow {
          color: #fb923c;
          font-size: 11px;
          font-weight: 950;
          letter-spacing: 0.16em;
        }

        .ns-hero h1 {
          margin: 7px 0 6px;
          font-size: clamp(34px, 7vw, 64px);
          line-height: 0.96;
          letter-spacing: -0.045em;
        }

        .ns-hero > p {
          max-width: 720px;
          margin: 0;
          color: #cbd5e1;
          font-size: 15px;
          line-height: 1.6;
        }

        .ns-season-flow {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-top: 24px;
        }

        .ns-season-box {
          min-width: 112px;
          padding: 12px 16px;
          border: 1px solid #30343b;
          border-radius: 14px;
          background: rgba(3, 7, 18, 0.66);
        }

        .ns-season-box span {
          display: block;
          margin-bottom: 2px;
          color: #94a3b8;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        .ns-season-box strong {
          font-size: 24px;
        }

        .ns-season-target {
          border-color: rgba(249, 115, 22, 0.55);
          box-shadow: inset 0 0 24px rgba(249, 115, 22, 0.08);
        }

        .ns-arrow {
          color: #f97316;
          font-size: 24px;
          font-weight: 950;
        }

        .ns-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.55fr) minmax(300px, 0.75fr);
          gap: 16px;
          margin-top: 16px;
          align-items: start;
        }

        .ns-side {
          display: grid;
          gap: 16px;
        }

        .ns-card {
          border: 1px solid #272b31;
          border-radius: 18px;
          padding: 20px;
          background: linear-gradient(180deg, #12151a, #0c0e12);
          box-shadow: 0 18px 42px rgba(0, 0, 0, 0.22);
        }

        .ns-card-heading {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 14px;
          padding-bottom: 16px;
          border-bottom: 1px solid #252930;
        }

        .ns-card h2,
        .ns-card h3 {
          margin: 5px 0 0;
        }

        .ns-state {
          flex: 0 0 auto;
          border-radius: 999px;
          padding: 7px 10px;
          font-size: 10px;
          font-weight: 950;
          letter-spacing: 0.12em;
        }

        .ns-state-ready {
          border: 1px solid rgba(34, 197, 94, 0.45);
          color: #86efac;
          background: rgba(34, 197, 94, 0.09);
        }

        .ns-state-waiting {
          border: 1px solid rgba(249, 115, 22, 0.42);
          color: #fdba74;
          background: rgba(249, 115, 22, 0.08);
        }

        .ns-checklist {
          display: grid;
          gap: 9px;
          margin-top: 16px;
        }

        .ns-check {
          display: grid;
          grid-template-columns: 34px minmax(0, 1fr) auto;
          gap: 11px;
          align-items: center;
          padding: 12px;
          border: 1px solid #292d34;
          border-radius: 13px;
          background: #0b0d11;
        }

        .ns-check-pass {
          border-color: rgba(34, 197, 94, 0.2);
        }

        .ns-check-wait {
          border-color: rgba(249, 115, 22, 0.22);
        }

        .ns-check-icon {
          display: grid;
          width: 30px;
          height: 30px;
          place-items: center;
          border-radius: 50%;
          color: #fff;
          background: #252a31;
          font-weight: 950;
        }

        .ns-check-pass .ns-check-icon {
          color: #86efac;
          background: rgba(34, 197, 94, 0.13);
        }

        .ns-check-wait .ns-check-icon {
          color: #fdba74;
          background: rgba(249, 115, 22, 0.12);
        }

        .ns-check-copy {
          min-width: 0;
        }

        .ns-check-copy strong,
        .ns-check-copy span {
          display: block;
        }

        .ns-check-copy strong {
          font-size: 13px;
        }

        .ns-check-copy span {
          margin-top: 3px;
          color: #8f9aaa;
          font-size: 11px;
          line-height: 1.4;
        }

        .ns-check-status {
          color: #9ca3af;
          font-size: 9px;
          font-weight: 950;
          letter-spacing: 0.1em;
          white-space: nowrap;
        }

        .ns-check-pass .ns-check-status {
          color: #86efac;
        }

        .ns-summary > p,
        .ns-history p,
        .ns-info p,
        .ns-warning p,
        .ns-disabled-help,
        .ns-member-note {
          color: #aab4c2;
          font-size: 12px;
          line-height: 1.55;
        }

        .ns-stat-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          margin: 16px 0;
        }

        .ns-stat-grid > div {
          min-width: 0;
          padding: 11px;
          border: 1px solid #292d34;
          border-radius: 12px;
          background: #090b0f;
        }

        .ns-stat-grid span,
        .ns-stat-grid strong {
          display: block;
        }

        .ns-stat-grid span {
          color: #7f8a99;
          font-size: 9px;
          font-weight: 900;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .ns-stat-grid strong {
          overflow: hidden;
          margin-top: 4px;
          color: #f8fafc;
          font-size: 12px;
          text-overflow: ellipsis;
        }

        .ns-info,
        .ns-warning,
        .ns-member-note {
          margin: 14px 0;
          padding: 12px;
          border-radius: 12px;
        }

        .ns-info {
          border: 1px solid rgba(249, 115, 22, 0.22);
          background: rgba(249, 115, 22, 0.055);
        }

        .ns-warning {
          border: 1px solid rgba(239, 68, 68, 0.28);
          background: rgba(127, 29, 29, 0.13);
        }

        .ns-member-note {
          border: 1px solid #30343b;
          background: #0a0c10;
        }

        .ns-info strong,
        .ns-warning strong {
          font-size: 12px;
        }

        .ns-info p,
        .ns-warning p {
          margin: 5px 0 0;
        }

        .ns-primary,
        .ns-secondary,
        .ns-alert button {
          min-height: 44px;
          border-radius: 11px;
          padding: 0 15px;
          font-weight: 950;
          letter-spacing: 0.035em;
          cursor: pointer;
        }

        .ns-primary {
          width: 100%;
          border: 1px solid #fb923c;
          color: #fff;
          background: linear-gradient(135deg, #dc2626, #f97316);
          box-shadow: 0 10px 26px rgba(220, 38, 38, 0.18);
        }

        .ns-primary:disabled {
          border-color: #353a42;
          color: #6b7280;
          background: #1a1d22;
          box-shadow: none;
          cursor: not-allowed;
        }

        .ns-secondary {
          border: 1px solid #3a4049;
          color: #e5e7eb;
          background: #14171c;
        }

        .ns-disabled-help {
          margin: 9px 0 0;
          text-align: center;
        }

        .ns-history h3 {
          font-size: 17px;
        }

        .ns-links {
          display: flex;
          flex-wrap: wrap;
          gap: 10px 14px;
          margin-top: 12px;
          font-size: 12px;
        }

        .ns-alert {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-top: 16px;
          padding: 12px 14px;
          border-radius: 13px;
        }

        .ns-alert span {
          flex: 1;
          font-size: 12px;
        }

        .ns-alert-error {
          border: 1px solid rgba(239, 68, 68, 0.38);
          color: #fecaca;
          background: rgba(127, 29, 29, 0.22);
        }

        .ns-alert button {
          min-height: 36px;
          border: 1px solid rgba(248, 113, 113, 0.4);
          color: #fff;
          background: rgba(127, 29, 29, 0.4);
        }

        .ns-loading {
          display: flex;
          align-items: center;
          gap: 10px;
          min-height: 150px;
          justify-content: center;
          color: #94a3b8;
          font-size: 13px;
        }

        .ns-spinner {
          width: 18px;
          height: 18px;
          border: 2px solid #3f4650;
          border-top-color: #f97316;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        .ns-modal-backdrop {
          position: fixed;
          z-index: 10000;
          inset: 0;
          display: grid;
          place-items: center;
          padding: 16px;
          background: rgba(0, 0, 0, 0.78);
          backdrop-filter: blur(5px);
        }

        .ns-modal {
          width: min(520px, 100%);
          padding: 22px;
          border: 1px solid rgba(249, 115, 22, 0.42);
          border-radius: 18px;
          background: #101217;
          box-shadow: 0 30px 90px rgba(0, 0, 0, 0.62);
        }

        .ns-modal h2 {
          margin: 7px 0 8px;
        }

        .ns-modal > p {
          color: #aeb8c5;
          font-size: 13px;
          line-height: 1.6;
        }

        .ns-modal-actions {
          display: grid;
          grid-template-columns: 0.8fr 1.4fr;
          gap: 9px;
          margin-top: 18px;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 820px) {
          .ns-page {
            padding: 14px 10px 42px;
          }

          .ns-grid {
            grid-template-columns: 1fr;
          }

          .ns-hero {
            padding: 21px 17px;
            border-radius: 17px;
          }

          .ns-card {
            padding: 15px;
            border-radius: 15px;
          }
        }

        @media (max-width: 520px) {
          .ns-season-flow {
            width: 100%;
          }

          .ns-season-box {
            flex: 1;
            min-width: 0;
          }

          .ns-check {
            grid-template-columns: 30px minmax(0, 1fr);
          }

          .ns-check-status {
            grid-column: 2;
          }

          .ns-card-heading {
            align-items: center;
          }

          .ns-stat-grid {
            grid-template-columns: 1fr 1fr;
          }

          .ns-modal-actions {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </main>
  );
}
