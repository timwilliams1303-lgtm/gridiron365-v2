"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

type Props = {
  leagueId: string;
  draftSeason: number;
  viewerOnly?: boolean;
};

type LotteryStatus = "setup" | "locked" | "live" | "completed";

type LotteryEntry = {
  fantasyTeamId: number;
  teamName: string;
  finalStanding: number | null;
  lotteryPosition: number | null;
  percentage: number;
  ballCount: number;
};

type RevealedPick = {
  eventId?: number;
  revealOrder: number;
  draftPick: number;
  fantasyTeamId: number;
  teamName: string;
  finalStanding: number | null;
  originalNumberOnePercentage: number;
  revealedAt?: string;
};

type LotteryState = {
  success: boolean;
  exists: boolean;
  lotteryId?: number;
  leagueId?: string;
  sourceSeason?: number;
  draftSeason: number;
  lotteryType?: "startup" | "rookie" | null;
  isStartup?: boolean;
  drawMethod?: string | null;
  draftStyle?: "snake" | "linear" | null;
  displayName?: string | null;
  status?: LotteryStatus;
  teamCount?: number;
  pickCount?: number;
  revealSeconds?: number;
  revealedCount?: number;
  remainingCount?: number;
  lockedAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  entries?: LotteryEntry[];
  revealed?: RevealedPick[];
};

type PrepareResult = {
  success: boolean;
  lotteryId: number;
  leagueId: string;
  sourceSeason: number;
  draftSeason: number;
  teamCount: number;
  status: "setup";
};

type LockResult = {
  success: boolean;
  lotteryId: number;
  draftSeason: number;
  status: "locked";
  teamCount: number;
  pickCount: number;
};

type StartResult = {
  success: boolean;
  lotteryId: number;
  draftSeason: number;
  status: "live";
  teamCount: number;
  pickCount: number;
  revealSeconds: number;
};

type RevealResult = {
  success: boolean;
  lotteryId: number;
  draftSeason: number;
  status: "live" | "completed";
  revealOrder: number;
  draftPick: number;
  team: {
    fantasyTeamId: number;
    teamName: string;
    finalStanding: number;
    originalNumberOnePercentage: number;
  };
  revealedCount: number;
  remainingCount: number;
  isFinalReveal: boolean;
  draftOrderApplied: boolean;
  assetResult?: unknown;
};

type MachinePhase = "idle" | "mixing" | "suction" | "reveal" | "complete";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function wait(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

function normalizeState(value: unknown): LotteryState {
  const raw = (value ?? {}) as Record<string, unknown>;

  return {
    success: raw.success === true,
    exists: raw.exists === true,
    lotteryId: raw.lotteryId == null ? undefined : Number(raw.lotteryId),
    leagueId: raw.leagueId == null ? undefined : String(raw.leagueId),
    sourceSeason:
      raw.sourceSeason == null ? undefined : Number(raw.sourceSeason),
    draftSeason: raw.draftSeason == null ? 0 : Number(raw.draftSeason),

    lotteryType:
      raw.lotteryType === "startup" || raw.lotteryType === "rookie"
        ? raw.lotteryType
        : null,

    isStartup: raw.isStartup === true,

    drawMethod:
      raw.drawMethod == null ? null : String(raw.drawMethod),

    draftStyle:
      raw.draftStyle === "snake" || raw.draftStyle === "linear"
        ? raw.draftStyle
        : null,

    displayName:
      raw.displayName == null ? null : String(raw.displayName),

    status:
      raw.status === "setup" ||
      raw.status === "locked" ||
      raw.status === "live" ||
      raw.status === "completed"
        ? raw.status
        : undefined,

    teamCount:
      raw.teamCount == null ? undefined : Number(raw.teamCount),

    pickCount:
      raw.pickCount == null ? undefined : Number(raw.pickCount),

    revealSeconds:
      raw.revealSeconds == null ? undefined : Number(raw.revealSeconds),

    revealedCount:
      raw.revealedCount == null ? undefined : Number(raw.revealedCount),

    remainingCount:
      raw.remainingCount == null ? undefined : Number(raw.remainingCount),

    lockedAt:
      raw.lockedAt == null ? null : String(raw.lockedAt),

    startedAt:
      raw.startedAt == null ? null : String(raw.startedAt),

    completedAt:
      raw.completedAt == null ? null : String(raw.completedAt),

    entries: Array.isArray(raw.entries)
      ? raw.entries.map((item) => {
          const entry = item as Record<string, unknown>;

          return {
            fantasyTeamId: Number(entry.fantasyTeamId),
            teamName: String(entry.teamName ?? "Unknown Team"),
            finalStanding:
              entry.finalStanding == null
                ? null
                : Number(entry.finalStanding),
            lotteryPosition:
              entry.lotteryPosition == null
                ? null
                : Number(entry.lotteryPosition),
            percentage: Number(entry.percentage),
            ballCount: Number(entry.ballCount),
          };
        })
      : [],

    revealed: Array.isArray(raw.revealed)
      ? raw.revealed.map((item) => {
          const pick = item as Record<string, unknown>;

          return {
            eventId:
              pick.eventId == null ? undefined : Number(pick.eventId),
            revealOrder: Number(pick.revealOrder),
            draftPick: Number(pick.draftPick),
            fantasyTeamId: Number(pick.fantasyTeamId),
            teamName: String(pick.teamName ?? "Unknown Team"),
            finalStanding:
              pick.finalStanding == null
                ? null
                : Number(pick.finalStanding),
            originalNumberOnePercentage: Number(
              pick.originalNumberOnePercentage
            ),
            revealedAt:
              pick.revealedAt == null
                ? undefined
                : String(pick.revealedAt),
          };
        })
      : [],
  };
}

export default function TraditionalDynastyLotteryOfficial({
  leagueId,
  draftSeason,
  viewerOnly = false,
}: Props) {
  const [lotteryState, setLotteryState] =
    useState<LotteryState | null>(null);

  const [loading, setLoading] = useState(true);
  const [actionRunning, setActionRunning] = useState(false);
  const [machineRunning, setMachineRunning] = useState(false);

  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  const [successMessage, setSuccessMessage] =
    useState<string | null>(null);

  const [countdown, setCountdown] =
    useState<number | null>(null);

  const [currentPick, setCurrentPick] =
    useState<number | null>(null);

  const [drawnTeam, setDrawnTeam] =
    useState<RevealedPick | null>(null);

  const [phase, setPhase] =
    useState<MachinePhase>("idle");

  const runRef = useRef(0);

  const entries = useMemo(
    () => lotteryState?.entries ?? [],
    [lotteryState]
  );

  const revealedPicks = useMemo(
    () => lotteryState?.revealed ?? [],
    [lotteryState]
  );

  const isStartupLottery =
    lotteryState?.lotteryType === "startup" ||
    lotteryState?.isStartup === true;

  const lotteryTitle = isStartupLottery
    ? `${draftSeason} Dynasty Startup Draft Lottery`
    : `${draftSeason} Dynasty Annual Draft Lottery`;

  const lotteryDraftBadge = isStartupLottery
    ? `${draftSeason} STARTUP DRAFT`
    : `${draftSeason} ANNUAL DRAFT`;

  const lotterySourceLabel =
    !isStartupLottery && lotteryState?.sourceSeason
      ? `${lotteryState.sourceSeason} FINAL STANDINGS`
      : null;

  const revealedByPick = useMemo(() => {
    const result: Record<number, RevealedPick> = {};

    for (const item of revealedPicks) {
      result[item.draftPick] = item;
    }

    return result;
  }, [revealedPicks]);

  const pickCount =
    lotteryState?.pickCount ??
    lotteryState?.teamCount ??
    entries.length;

  const nextPick =
    lotteryState?.status === "live"
      ? Math.max(
          pickCount - (lotteryState.revealedCount ?? 0),
          1
        )
      : null;

  const displayBalls = useMemo(() => {
    const balls: Array<{
      key: string;
      team: LotteryEntry;
    }> = [];

    entries.forEach((team) => {
      const count = Math.max(
        2,
        Math.round(Number(team.percentage) * 0.7)
      );

      for (let i = 0; i < count; i += 1) {
        balls.push({
          key: `${team.fantasyTeamId}-${i}`,
          team,
        });
      }
    });

    return balls;
  }, [entries]);

  const loadState = useCallback(
    async (showLoader = false) => {
      if (!leagueId || !draftSeason) return;

      if (showLoader) {
        setLoading(true);
      }

      try {
        const { data, error } = await supabase.rpc(
          "get_traditional_dynasty_draft_lottery_state",
          {
            p_league_id: leagueId,
            p_draft_season: draftSeason,
          }
        );

        if (error) {
          throw new Error(error.message);
        }

        const nextState = normalizeState(data);

        if (!nextState.success) {
          throw new Error(
            "The Dynasty lottery state could not be loaded."
          );
        }

        setLotteryState(nextState);

        if (nextState.status === "completed") {
          setPhase("complete");
        } else if (!machineRunning) {
          setPhase("idle");
        }
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "The Dynasty lottery state could not be loaded."
        );
      } finally {
        if (showLoader) {
          setLoading(false);
        }
      }
    },
    [draftSeason, leagueId, machineRunning]
  );

  useEffect(() => {
    void loadState(true);
  }, [loadState]);

  useEffect(() => {
    if (!viewerOnly) return;

    const interval = window.setInterval(() => {
      void loadState(false);
    }, 2000);

    return () => window.clearInterval(interval);
  }, [loadState, viewerOnly]);

  async function prepareLottery() {
    if (actionRunning || machineRunning) return;

    setActionRunning(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const { data, error } = await supabase.rpc(
        "prepare_traditional_dynasty_draft_lottery",
        {
          p_league_id: leagueId,
          p_draft_season: draftSeason,
        }
      );

      if (error) {
        throw new Error(error.message);
      }

      const result = data as PrepareResult | null;

      if (!result?.success || result.status !== "setup") {
        throw new Error(
          "The server returned an invalid lottery preparation result."
        );
      }

      setSuccessMessage(
        `${lotteryTitle} prepared. Review the official odds before locking the results.`
      );

      await loadState();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "The Dynasty lottery could not be prepared."
      );
    } finally {
      setActionRunning(false);
    }
  }

  async function lockLottery() {
    if (
      actionRunning ||
      machineRunning ||
      lotteryState?.status !== "setup"
    ) {
      return;
    }

    const confirmed = window.confirm(
      `LOCK THE ${draftSeason} ${
        isStartupLottery ? "STARTUP" : "ANNUAL"
      } DYNASTY LOTTERY?\n\n` +
        (isStartupLottery
          ? "This generates and permanently stores the official equal-odds startup draft order. Every remaining franchise has the same chance at the next available pick.\n\n"
          : "This generates and permanently stores the official weighted Dynasty draft order.\n\n") +
        "The result cannot be rerolled after it is locked. The picks will remain hidden and will only be published one at a time during the official reveal.\n\n" +
        "Continue?"
    );

    if (!confirmed) return;

    const secondConfirmed = window.confirm(
      "FINAL CONFIRMATION\n\n" +
        "Once you lock this lottery, the official result is permanent.\n\n" +
        "Lock official results now?"
    );

    if (!secondConfirmed) return;

    setActionRunning(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const { data, error } = await supabase.rpc(
        "lock_traditional_dynasty_draft_lottery",
        {
          p_league_id: leagueId,
          p_draft_season: draftSeason,
        }
      );

      if (error) {
        throw new Error(error.message);
      }

      const result = data as LockResult | null;

      if (!result?.success || result.status !== "locked") {
        throw new Error(
          "The server returned an invalid lottery lock result."
        );
      }

      setSuccessMessage(
        "Official lottery results are locked. No draft positions have been revealed."
      );

      await loadState();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "The official Dynasty lottery could not be locked."
      );
    } finally {
      setActionRunning(false);
    }
  }
    async function startLottery() {
    if (
      actionRunning ||
      machineRunning ||
      lotteryState?.status !== "locked"
    ) {
      return;
    }

    setActionRunning(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const { data, error } = await supabase.rpc(
        "start_traditional_dynasty_draft_lottery",
        {
          p_league_id: leagueId,
          p_draft_season: draftSeason,
        }
      );

      if (error) {
        throw new Error(error.message);
      }

      const result = data as StartResult | null;

      if (!result?.success || result.status !== "live") {
        throw new Error(
          "The server returned an invalid lottery start result."
        );
      }

      setSuccessMessage(
        `${lotteryTitle} is live. Pick ${result.pickCount} will be revealed first.`
      );

      await loadState();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "The Dynasty lottery could not be started."
      );
    } finally {
      setActionRunning(false);
    }
  }

  async function revealNextPick() {
    if (
      viewerOnly ||
      actionRunning ||
      machineRunning ||
      lotteryState?.status !== "live"
    ) {
      return;
    }

    const thisRun = runRef.current + 1;
    runRef.current = thisRun;

    setMachineRunning(true);
    setActionRunning(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setDrawnTeam(null);

    const pickToReveal =
      nextPick ??
      Math.max(
        pickCount - (lotteryState.revealedCount ?? 0),
        1
      );

    setCurrentPick(pickToReveal);

    try {
      setPhase("mixing");

      const revealSeconds = Math.max(
        3,
        Number(lotteryState.revealSeconds ?? 5)
      );

      for (
        let remaining = revealSeconds;
        remaining >= 1;
        remaining -= 1
      ) {
        if (runRef.current !== thisRun) {
          return;
        }

        setCountdown(remaining);
        await wait(1000);
      }

      if (runRef.current !== thisRun) {
        return;
      }

      setCountdown(null);
      setPhase("suction");

      await wait(900);

      if (runRef.current !== thisRun) {
        return;
      }

      const { data, error } = await supabase.rpc(
        "reveal_next_traditional_dynasty_draft_lottery_pick",
        {
          p_league_id: leagueId,
          p_draft_season: draftSeason,
        }
      );

      if (error) {
        throw new Error(error.message);
      }

      const result = data as RevealResult | null;

      if (!result?.success) {
        throw new Error(
          "The server returned an invalid lottery reveal result."
        );
      }

      const revealed: RevealedPick = {
        revealOrder: result.revealOrder,
        draftPick: result.draftPick,
        fantasyTeamId: result.team.fantasyTeamId,
        teamName: result.team.teamName,
        finalStanding: result.team.finalStanding,
        originalNumberOnePercentage:
          result.team.originalNumberOnePercentage,
      };

      setDrawnTeam(revealed);
      setCurrentPick(result.draftPick);
      setPhase("reveal");

      await loadState();

      await wait(2500);

      if (runRef.current !== thisRun) {
        return;
      }

      if (result.isFinalReveal || result.status === "completed") {
        setPhase("complete");
        setSuccessMessage(
          `The ${draftSeason} Dynasty draft lottery is complete. The official draft order has been applied.`
        );
      } else {
        setPhase("idle");
        setCurrentPick(null);
        setDrawnTeam(null);
      }
    } catch (error) {
      setPhase("idle");
      setCountdown(null);
      setCurrentPick(null);
      setDrawnTeam(null);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "The next lottery pick could not be revealed."
      );
    } finally {
      setMachineRunning(false);
      setActionRunning(false);
    }
  }

  useEffect(() => {
    return () => {
      runRef.current += 1;
    };
  }, []);

  if (loading) {
    return (
      <section className="dynasty-lottery-page">
        <style>{lotteryStyles}</style>

        <div className="lottery-loading">
          <div className="loading-spinner" />
          <strong>Loading NFL Dynasty lottery...</strong>
        </div>
      </section>
    );
  }

  if (!lotteryState?.exists) {
    return (
      <section className="dynasty-lottery-page">
        <style>{lotteryStyles}</style>

        <div className="lottery-card empty-card">
          <div>
            <p className="lottery-kicker">
              G365 NFL DYNASTY
            </p>

            <h2>{lotteryTitle}</h2>

            <p>
              The annual Dynasty lottery has not been prepared yet.
              The completed season standings will determine the
              weighted lottery entries.
            </p>
          </div>

          {errorMessage ? (
            <div className="lottery-error">
              {errorMessage}
            </div>
          ) : null}

          {!viewerOnly ? (
            <button
              type="button"
              className="primary-action"
              disabled={actionRunning}
              onClick={() => void prepareLottery()}
            >
              {actionRunning
                ? "PREPARING..."
                : "PREPARE ANNUAL LOTTERY"}
            </button>
          ) : (
            <div className="viewer-waiting">
              Waiting for the commissioner to prepare the lottery.
            </div>
          )}
        </div>
      </section>
    );
  }

  const status = lotteryState.status ?? "setup";
  const revealedCount = lotteryState.revealedCount ?? 0;
  const remainingCount =
    lotteryState.remainingCount ??
    Math.max(0, pickCount - revealedCount);

  return (
    <section className="dynasty-lottery-page">
      <style>{lotteryStyles}</style>

      <header className="lottery-hero">
        <div>
          <div className="hero-badges">
            <span className="g365-badge">
              G365 NFL DYNASTY
            </span>

            <span className="draft-badge">
              {lotteryDraftBadge}
            </span>

            {lotterySourceLabel ? (
              <span className="source-badge">
                {lotterySourceLabel}
              </span>
            ) : null}
          </div>

          <h2>{lotteryTitle}</h2>

          <p>
            {isStartupLottery
              ? "Each franchise has equal odds for the next available startup draft position."
              : "The official weighted annual draft order is generated on the server and permanently locked before any pick is revealed."}
          </p>
        </div>

        <div className={`status-pill status-${status}`}>
          {status === "setup"
            ? "SETUP"
            : status === "locked"
              ? "RESULT LOCKED"
              : status === "live"
                ? "LIVE"
                : "COMPLETE"}
        </div>
      </header>

      {errorMessage ? (
        <div className="lottery-error">
          {errorMessage}
        </div>
      ) : null}

      {successMessage ? (
        <div className="lottery-success">
          {successMessage}
        </div>
      ) : null}

      <div className="lottery-summary-grid">
        <article className="summary-box">
          <span>TEAMS</span>
          <strong>{lotteryState.teamCount ?? entries.length}</strong>
        </article>

        <article className="summary-box">
          <span>REVEALED</span>
          <strong>
            {revealedCount}/{pickCount}
          </strong>
        </article>

        <article className="summary-box">
          <span>REMAINING</span>
          <strong>{remainingCount}</strong>
        </article>

        <article className="summary-box">
          <span>DRAFT STYLE</span>
          <strong>
            {(lotteryState.draftStyle ?? "linear").toUpperCase()}
          </strong>
        </article>
      </div>

      <div className="lottery-layout">
        <div className="lottery-main-column">
          <section className="lottery-card machine-card">
            <div className="section-heading">
              <div>
                <p className="lottery-kicker">
                  OFFICIAL LOTTERY MACHINE
                </p>

                <h3>
                  {status === "completed"
                    ? "Final Draft Order"
                    : status === "live"
                      ? `Drawing Pick #${currentPick ?? nextPick ?? pickCount}`
                      : "Weighted Lottery Chamber"}
                </h3>
              </div>

              {status === "live" ? (
                <span className="live-indicator">
                  <i />
                  LIVE
                </span>
              ) : null}
            </div>

            <div
              className={`lottery-machine phase-${phase}`}
            >
              <div className="machine-top">
                <div className="machine-neck">
                  <div className="machine-tube" />
                </div>
              </div>

              <div className="machine-chamber">
                <div className="chamber-glass">
                  <div className="ball-field">
                    {displayBalls.map((ball, index) => {
                      const angle =
                        (index * 137.5) % 360;

                      const radius =
                        22 + ((index * 17) % 27);

                      const left =
                        50 +
                        Math.cos(
                          (angle * Math.PI) / 180
                        ) *
                          radius;

                      const top =
                        50 +
                        Math.sin(
                          (angle * Math.PI) / 180
                        ) *
                          radius;

                      return (
                        <div
                          key={ball.key}
                          className="lottery-ball"
                          style={{
                            left: `${left}%`,
                            top: `${top}%`,
                            animationDelay: `${
                              (index % 12) * -0.13
                            }s`,
                          }}
                          title={ball.team.teamName}
                        >
                          {ball.team.lotteryPosition ??
                            index + 1}
                        </div>
                      );
                    })}
                  </div>

                  <div className="machine-center">
                    {phase === "mixing" ? (
                      <>
                        <span className="machine-label">
                          MIXING
                        </span>

                        <strong>
                          {countdown ?? ""}
                        </strong>

                        <small>
                          PICK #
                          {currentPick ?? nextPick ?? ""}
                        </small>
                      </>
                    ) : phase === "suction" ? (
                      <>
                        <span className="machine-label">
                          SELECTING
                        </span>

                        <strong className="pulse-text">
                          ...
                        </strong>

                        <small>
                          OFFICIAL SERVER RESULT
                        </small>
                      </>
                    ) : phase === "reveal" &&
                      drawnTeam ? (
                      <>
                        <span className="machine-label">
                          PICK #{drawnTeam.draftPick}
                        </span>

                        <strong className="winner-name">
                          {drawnTeam.teamName}
                        </strong>

                        <small>
                          {isStartupLottery
                            ? "EQUAL ODDS DRAW"
                            : `${drawnTeam.originalNumberOnePercentage.toFixed(
                                1
                              )}% ORIGINAL #1 ODDS`}
                        </small>
                      </>
                    ) : phase === "complete" ? (
                      <>
                        <span className="machine-label">
                          LOTTERY
                        </span>

                        <strong className="complete-text">
                          COMPLETE
                        </strong>

                        <small>
                          OFFICIAL ORDER APPLIED
                        </small>
                      </>
                    ) : (
                      <>
                        <span className="machine-label">
                          {status === "locked"
                            ? "RESULTS LOCKED"
                            : status === "live"
                              ? "READY"
                              : "LOTTERY ODDS"}
                        </span>

                        <strong>
                          {status === "live"
                            ? `#${nextPick ?? pickCount}`
                            : `${entries.length}`}
                        </strong>

                        <small>
                          {status === "live"
                            ? "NEXT PICK"
                            : "FRANCHISES"}
                        </small>
                      </>
                    )}
                  </div>
                </div>

                <div className="machine-base">
                  <span>GRIDIRON365</span>
                  <strong>NFL DYNASTY LOTTERY</strong>
                </div>
              </div>
            </div>

            {!viewerOnly ? (
              <div className="machine-actions">
                {status === "setup" ? (
                  <button
                    type="button"
                    className="danger-action"
                    disabled={
                      actionRunning || machineRunning
                    }
                    onClick={() => void lockLottery()}
                  >
                    {actionRunning
                      ? "LOCKING..."
                      : "LOCK OFFICIAL RESULT"}
                  </button>
                ) : null}

                {status === "locked" ? (
                  <button
                    type="button"
                    className="primary-action"
                    disabled={
                      actionRunning || machineRunning
                    }
                    onClick={() => void startLottery()}
                  >
                    {actionRunning
                      ? "STARTING..."
                      : "START LIVE LOTTERY"}
                  </button>
                ) : null}

                {status === "live" ? (
                  <button
                    type="button"
                    className="primary-action reveal-button"
                    disabled={
                      actionRunning || machineRunning
                    }
                    onClick={() =>
                      void revealNextPick()
                    }
                  >
                    {machineRunning
                      ? "DRAWING..."
                      : `REVEAL PICK #${
                          nextPick ?? pickCount
                        }`}
                  </button>
                ) : null}
              </div>
            ) : status === "live" ? (
              <div className="viewer-waiting">
                Live viewer mode - waiting for the
                commissioner to reveal the next pick.
              </div>
            ) : null}
          </section>

          <section className="lottery-card">
            <div className="section-heading">
              <div>
                <p className="lottery-kicker">
                  OFFICIAL DRAFT ORDER
                </p>

                <h3>
                  {status === "completed"
                    ? `${draftSeason} Draft Order`
                    : "Live Reveal Board"}
                </h3>
              </div>
            </div>

            <div className="draft-order-board">
              {Array.from(
                { length: pickCount },
                (_, index) => pickCount - index
              ).map((pickNumber) => {
                const result =
                  revealedByPick[pickNumber];

                return (
                  <article
                    key={pickNumber}
                    className={`draft-slot ${
                      result ? "revealed" : "hidden"
                    }`}
                  >
                    <div className="pick-number">
                      <span>PICK</span>
                      <strong>
                        #{pickNumber}
                      </strong>
                    </div>

                    {result ? (
                      <div className="pick-team">
                        <strong>
                          {result.teamName}
                        </strong>

                        <span>
                          {result.finalStanding
                            ? `Previous finish: #${result.finalStanding}`
                            : "Startup franchise"}
                        </span>
                      </div>
                    ) : (
                      <div className="pick-team hidden-team">
                        <strong>
                          NOT REVEALED
                        </strong>

                        <span>
                          Official result remains hidden
                        </span>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        </div>
                <aside className="lottery-side-column">
          <section className="lottery-card">
            <div className="section-heading">
              <div>
                <p className="lottery-kicker">
                  LOTTERY ODDS
                </p>

                <h3>
                  {isStartupLottery
                    ? "Equal Odds"
                    : "Weighted Odds"}
                </h3>
              </div>
            </div>

            <div className="odds-list">
              {entries
                .slice()
                .sort(
                  (a, b) =>
                    (a.lotteryPosition ?? 999) -
                    (b.lotteryPosition ?? 999)
                )
                .map((entry) => (
                  <article
                    key={entry.fantasyTeamId}
                    className="odds-row"
                  >
                    <div className="odds-position">
                      <span>LOTTO</span>
                      <strong>
                        #
                        {entry.lotteryPosition ??
                          "-"}
                      </strong>
                    </div>

                    <div className="odds-team">
                      <strong>
                        {entry.teamName}
                      </strong>

                      <span>
                        {entry.finalStanding
                          ? `Previous finish #${entry.finalStanding}`
                          : isStartupLottery
                            ? "Startup franchise"
                            : "Final standing unavailable"}
                      </span>
                    </div>

                    <div className="odds-value">
                      <strong>
                        {Number(
                          entry.percentage
                        ).toFixed(1)}
                        %
                      </strong>

                      <span>
                        {entry.ballCount} balls
                      </span>
                    </div>
                  </article>
                ))}
            </div>
          </section>

          <section className="lottery-card">
            <div className="section-heading">
              <div>
                <p className="lottery-kicker">
                  LOTTERY STATUS
                </p>

                <h3>Official State</h3>
              </div>
            </div>

            <div className="info-list">
              <div>
                <span>Draft Season</span>
                <strong>
                  {draftSeason}
                </strong>
              </div>

              <div>
                <span>Source Season</span>
                <strong>
                  {lotteryState.sourceSeason ??
                    "-"}
                </strong>
              </div>

              <div>
                <span>Lottery Type</span>
                <strong>
                  {isStartupLottery
                    ? "Startup"
                    : "Annual"}
                </strong>
              </div>

              <div>
                <span>Draw Method</span>
                <strong>
                  {String(
                    lotteryState.drawMethod ??
                      (isStartupLottery
                        ? "Equal Odds"
                        : "Weighted")
                  )
                    .replaceAll("_", " ")
                    .toUpperCase()}
                </strong>
              </div>

              <div>
                <span>Draft Style</span>
                <strong>
                  {(
                    lotteryState.draftStyle ??
                    "linear"
                  ).toUpperCase()}
                </strong>
              </div>

              <div>
                <span>Status</span>
                <strong>
                  {status.toUpperCase()}
                </strong>
              </div>
            </div>
          </section>

          <section className="lottery-card rules-card">
            <p className="lottery-kicker">
              HOW IT WORKS
            </p>

            <h3>
              {isStartupLottery
                ? "Startup Lottery"
                : "Annual Dynasty Lottery"}
            </h3>

            {isStartupLottery ? (
              <p>
                Every franchise has equal odds
                when each available startup draft
                position is selected. Once a team
                receives a position, it is removed
                from the remaining draw.
              </p>
            ) : (
              <p>
                Lottery odds are based on the
                completed prior season. The
                official order is generated and
                stored on the server before the
                live reveal begins.
              </p>
            )}

            <p>
              Locking the result makes the
              official order permanent. The live
              reveal only publishes the already
              stored result one pick at a time.
            </p>

            <p>
              When the final pick is revealed,
              the official base order is applied
              to the Dynasty annual draft.
              Traded pick ownership remains with
              the draft-pick assets.
            </p>
          </section>

          {viewerOnly ? (
            <section className="lottery-card viewer-card">
              <p className="lottery-kicker">
                LEAGUE VIEW
              </p>

              <h3>Live Viewer</h3>

              <p>
                Commissioner controls are hidden.
                This page automatically refreshes
                while the lottery is being run.
              </p>
            </section>
          ) : (
            <section className="lottery-card commissioner-card">
              <p className="lottery-kicker">
                COMMISSIONER
              </p>

              <h3>Lottery Control</h3>

              <p>
                Prepare the lottery, verify the
                displayed odds, permanently lock
                the result, then start the live
                reveal.
              </p>

              <div className="commissioner-state">
                {status === "setup" ? (
                  <span>
                    NEXT: LOCK OFFICIAL RESULT
                  </span>
                ) : status === "locked" ? (
                  <span>
                    NEXT: START LIVE LOTTERY
                  </span>
                ) : status === "live" ? (
                  <span>
                    NEXT: REVEAL PICK #
                    {nextPick ?? pickCount}
                  </span>
                ) : (
                  <span>
                    LOTTERY COMPLETE
                  </span>
                )}
              </div>
            </section>
          )}
        </aside>
      </div>
    </section>
  );
}

const lotteryStyles = `
.dynasty-lottery-page{
  width:100%;
  color:#f6f7f9;
}
.lottery-loading{
  min-height:320px;
  display:flex;
  flex-direction:column;
  align-items:center;
  justify-content:center;
  gap:12px;
  border:1px solid rgba(255,255,255,.08);
  border-radius:16px;
  background:#0d1015;
}
.loading-spinner{
  width:34px;
  height:34px;
  border:3px solid rgba(255,255,255,.1);
  border-top-color:#ff5b1f;
  border-radius:999px;
  animation:spin .8s linear infinite;
}
@keyframes spin{
  to{transform:rotate(360deg)}
}
.lottery-hero{
  display:flex;
  justify-content:space-between;
  align-items:flex-start;
  gap:18px;
  padding:18px;
  border:1px solid rgba(255,91,31,.24);
  border-radius:14px;
  background:
    linear-gradient(
      135deg,
      rgba(129,20,12,.18),
      rgba(255,86,24,.04)
    ),
    #0d1015;
}
.hero-badges{
  display:flex;
  flex-wrap:wrap;
  gap:6px;
  margin-bottom:8px;
}
.g365-badge,
.draft-badge,
.source-badge{
  display:inline-flex;
  align-items:center;
  min-height:23px;
  padding:4px 8px;
  border-radius:999px;
  font-size:8px;
  font-weight:950;
  letter-spacing:.08em;
}
.g365-badge{
  color:#fff;
  border:1px solid rgba(255,91,31,.4);
  background:rgba(255,91,31,.13);
}
.draft-badge{
  color:#ff9366;
  border:1px solid rgba(255,91,31,.22);
  background:rgba(255,91,31,.06);
}
.source-badge{
  color:#aeb5be;
  border:1px solid rgba(255,255,255,.08);
  background:rgba(255,255,255,.03);
}
.lottery-hero h2,
.lottery-card h2,
.lottery-card h3{
  margin:0;
  font-weight:950;
  letter-spacing:-.02em;
}
.lottery-hero h2{
  font-size:clamp(24px,4vw,38px);
}
.lottery-hero p{
  max-width:760px;
  margin:7px 0 0;
  color:#9da5af;
  font-size:11px;
  line-height:1.55;
}
.status-pill{
  flex:none;
  padding:8px 10px;
  border-radius:999px;
  font-size:9px;
  font-weight:950;
  letter-spacing:.08em;
}
.status-setup{
  color:#d4d8dd;
  border:1px solid rgba(255,255,255,.1);
  background:#15181d;
}
.status-locked{
  color:#ff9b73;
  border:1px solid rgba(255,91,31,.3);
  background:rgba(255,91,31,.08);
}
.status-live{
  color:#ff7540;
  border:1px solid rgba(255,91,31,.45);
  background:rgba(255,72,22,.12);
}
.status-completed{
  color:#72df91;
  border:1px solid rgba(34,197,94,.28);
  background:rgba(22,101,52,.13);
}
.lottery-error,
.lottery-success{
  margin-top:12px;
  padding:11px 13px;
  border-radius:9px;
  font-size:11px;
  line-height:1.45;
}
.lottery-error{
  color:#ffb5a5;
  border:1px solid rgba(239,68,68,.3);
  background:rgba(127,29,29,.16);
}
.lottery-success{
  color:#77e398;
  border:1px solid rgba(34,197,94,.27);
  background:rgba(20,83,45,.15);
}
.lottery-summary-grid{
  display:grid;
  grid-template-columns:repeat(4,minmax(0,1fr));
  gap:8px;
  margin-top:12px;
}
.summary-box{
  padding:12px;
  border:1px solid rgba(255,255,255,.07);
  border-radius:10px;
  background:#0d1015;
}
.summary-box span{
  display:block;
  color:#828b96;
  font-size:8px;
  font-weight:950;
  letter-spacing:.08em;
}
.summary-box strong{
  display:block;
  margin-top:5px;
  font-size:18px;
}
.lottery-layout{
  display:grid;
  grid-template-columns:minmax(0,1.8fr) minmax(280px,.75fr);
  gap:12px;
  margin-top:12px;
}
.lottery-main-column,
.lottery-side-column{
  min-width:0;
}
.lottery-side-column{
  display:flex;
  flex-direction:column;
  gap:12px;
}
.lottery-card{
  padding:16px;
  border:1px solid rgba(255,255,255,.075);
  border-radius:13px;
  background:#0d1015;
}
.lottery-main-column>.lottery-card+.lottery-card{
  margin-top:12px;
}
.empty-card{
  min-height:280px;
  display:flex;
  flex-direction:column;
  align-items:flex-start;
  justify-content:center;
  gap:15px;
}
.empty-card p{
  max-width:700px;
  color:#9ba3ad;
  line-height:1.55;
}
.lottery-kicker{
  margin:0 0 5px;
  color:#ff6429!important;
  font-size:8px!important;
  font-weight:950;
  letter-spacing:.12em;
}
.section-heading{
  display:flex;
  justify-content:space-between;
  align-items:center;
  gap:12px;
  margin-bottom:13px;
}
.live-indicator{
  display:flex;
  align-items:center;
  gap:6px;
  color:#ff6b35;
  font-size:9px;
  font-weight:950;
}
.live-indicator i{
  width:7px;
  height:7px;
  border-radius:999px;
  background:#ff4d22;
  box-shadow:0 0 12px rgba(255,77,34,.8);
  animation:livePulse 1s ease-in-out infinite;
}
@keyframes livePulse{
  50%{opacity:.35}
}
.lottery-machine{
  position:relative;
  width:min(560px,100%);
  margin:8px auto 4px;
  padding-top:34px;
}
.machine-top{
  position:absolute;
  top:0;
  left:50%;
  z-index:4;
  transform:translateX(-50%);
}
.machine-neck{
  width:86px;
  height:55px;
  padding:0 17px;
  border:2px solid rgba(255,255,255,.16);
  border-bottom:0;
  border-radius:18px 18px 0 0;
  background:#171b21;
}
.machine-tube{
  width:100%;
  height:100%;
  border-left:2px solid rgba(255,255,255,.1);
  border-right:2px solid rgba(255,255,255,.1);
  background:linear-gradient(
    90deg,
    rgba(255,255,255,.02),
    rgba(255,255,255,.08),
    rgba(255,255,255,.02)
  );
}
.machine-chamber{
  position:relative;
  z-index:2;
}
.chamber-glass{
  position:relative;
  width:min(430px,90vw);
  aspect-ratio:1/1;
  margin:0 auto;
  overflow:hidden;
  border:5px solid #242a32;
  border-radius:999px;
  background:
    radial-gradient(
      circle at 35% 28%,
      rgba(255,255,255,.09),
      transparent 18%
    ),
    radial-gradient(
      circle,
      rgba(255,73,24,.06),
      rgba(7,9,13,.82) 68%
    );
  box-shadow:
    inset 0 0 35px rgba(255,255,255,.025),
    0 16px 45px rgba(0,0,0,.35);
}
.ball-field{
  position:absolute;
  inset:8%;
}
.lottery-ball{
  position:absolute;
  width:29px;
  height:29px;
  display:flex;
  align-items:center;
  justify-content:center;
  transform:translate(-50%,-50%);
  border:2px solid rgba(255,255,255,.28);
  border-radius:999px;
  color:#fff;
  background:
    radial-gradient(
      circle at 32% 27%,
      #ff9a65,
      #e84418 42%,
      #861d0b 100%
    );
  box-shadow:0 3px 9px rgba(0,0,0,.45);
  font-size:8px;
  font-weight:950;
}
.phase-mixing .lottery-ball{
  animation:ballMix .72s ease-in-out infinite alternate;
}
.phase-suction .lottery-ball{
  animation:ballSuction .55s ease-in forwards;
}
@keyframes ballMix{
  from{
    transform:
      translate(-50%,-50%)
      rotate(-10deg)
      translateY(-5px);
  }
  to{
    transform:
      translate(-50%,-50%)
      rotate(14deg)
      translateY(7px);
  }
}
@keyframes ballSuction{
  to{
    transform:
      translate(-50%,-50%)
      scale(.8)
      translateY(-18px);
  }
}
.machine-center{
  position:absolute;
  top:50%;
  left:50%;
  z-index:5;
  width:190px;
  min-height:128px;
  padding:15px;
  display:flex;
  flex-direction:column;
  align-items:center;
  justify-content:center;
  transform:translate(-50%,-50%);
  text-align:center;
  border:1px solid rgba(255,91,31,.26);
  border-radius:18px;
  background:rgba(8,10,14,.9);
  box-shadow:0 12px 35px rgba(0,0,0,.45);
  backdrop-filter:blur(8px);
}
.machine-label{
  color:#ff6b30;
  font-size:8px;
  font-weight:950;
  letter-spacing:.12em;
}
.machine-center>strong{
  margin:5px 0;
  font-size:38px;
  line-height:1;
}
.machine-center small{
  color:#919aa5;
  font-size:8px;
  font-weight:800;
}
.machine-center .winner-name{
  max-width:165px;
  font-size:20px;
  line-height:1.05;
}
.complete-text{
  color:#6ee28f;
  font-size:24px!important;
}
.pulse-text{
  animation:textPulse .7s ease-in-out infinite;
}
@keyframes textPulse{
  50%{opacity:.3}
}
.machine-base{
  width:min(360px,78%);
  margin:-23px auto 0;
  padding:32px 15px 13px;
  position:relative;
  z-index:1;
  text-align:center;
  border:2px solid #292f37;
  border-radius:0 0 20px 20px;
  background:
    linear-gradient(
      180deg,
      #1d2229,
      #101318
    );
  box-shadow:0 16px 30px rgba(0,0,0,.35);
}
.machine-base span,
.machine-base strong{
  display:block;
}
.machine-base span{
  color:#ff632a;
  font-size:8px;
  font-weight:950;
  letter-spacing:.13em;
}
.machine-base strong{
  margin-top:3px;
  font-size:11px;
}
.machine-actions{
  display:flex;
  justify-content:center;
  margin-top:16px;
}
.primary-action,
.danger-action{
  min-height:42px;
  padding:10px 16px;
  border-radius:8px;
  color:#fff;
  font-size:9px;
  font-weight:950;
  letter-spacing:.05em;
  cursor:pointer;
}
.primary-action{
  border:1px solid rgba(255,91,31,.58);
  background:
    linear-gradient(
      135deg,
      #b81e16,
      #ff5a1f
    );
}
.danger-action{
  border:1px solid rgba(239,68,68,.5);
  background:
    linear-gradient(
      135deg,
      #7f1515,
      #d82b1f
    );
}
.primary-action:disabled,
.danger-action:disabled{
  opacity:.45;
  cursor:not-allowed;
}
.reveal-button{
  min-width:190px;
}
.viewer-waiting{
  margin-top:13px;
  padding:10px;
  text-align:center;
  color:#9ba3ad;
  border:1px solid rgba(255,255,255,.07);
  border-radius:8px;
  background:rgba(255,255,255,.025);
  font-size:10px;
}
.draft-order-board{
  display:grid;
  grid-template-columns:repeat(2,minmax(0,1fr));
  gap:7px;
}
.draft-slot{
  min-width:0;
  display:grid;
  grid-template-columns:58px minmax(0,1fr);
  align-items:center;
  gap:10px;
  padding:10px;
  border:1px solid rgba(255,255,255,.07);
  border-radius:9px;
  background:#11151a;
}
.draft-slot.revealed{
  border-color:rgba(255,91,31,.25);
  background:
    linear-gradient(
      135deg,
      rgba(124,27,14,.16),
      #11151a
    );
}
.pick-number span,
.pick-number strong,
.pick-team strong,
.pick-team span{
  display:block;
}
.pick-number span{
  color:#747d88;
  font-size:7px;
  font-weight:950;
}
.pick-number strong{
  margin-top:2px;
  color:#ff6a31;
  font-size:18px;
}
.pick-team{
  min-width:0;
}
.pick-team strong{
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
  font-size:11px;
}
.pick-team span{
  margin-top:3px;
  color:#808995;
  font-size:8px;
}
.hidden-team strong{
  color:#626a74;
}
.odds-list{
  display:flex;
  flex-direction:column;
  gap:6px;
}
.odds-row{
  display:grid;
  grid-template-columns:42px minmax(0,1fr) auto;
  align-items:center;
  gap:8px;
  padding:9px;
  border:1px solid rgba(255,255,255,.06);
  border-radius:8px;
  background:#111419;
}
.odds-position span,
.odds-position strong,
.odds-team strong,
.odds-team span,
.odds-value strong,
.odds-value span{
  display:block;
}
.odds-position span{
  color:#727b86;
  font-size:6px;
  font-weight:950;
}
.odds-position strong{
  margin-top:2px;
  color:#ff6b31;
  font-size:14px;
}
.odds-team{
  min-width:0;
}
.odds-team strong{
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
  font-size:10px;
}
.odds-team span{
  margin-top:2px;
  color:#79828d;
  font-size:7px;
}
.odds-value{
  text-align:right;
}
.odds-value strong{
  font-size:11px;
}
.odds-value span{
  margin-top:2px;
  color:#7e8792;
  font-size:7px;
}
.info-list{
  display:flex;
  flex-direction:column;
  gap:6px;
}
.info-list>div{
  display:flex;
  justify-content:space-between;
  gap:10px;
  padding:8px 0;
  border-bottom:1px solid rgba(255,255,255,.055);
}
.info-list>div:last-child{
  border-bottom:0;
}
.info-list span{
  color:#818a95;
  font-size:8px;
  font-weight:850;
}
.info-list strong{
  text-align:right;
  font-size:9px;
}
.rules-card p,
.viewer-card p,
.commissioner-card p{
  color:#929ba6;
  font-size:9px;
  line-height:1.55;
}
.commissioner-state{
  margin-top:10px;
  padding:9px;
  text-align:center;
  color:#ff7a43;
  border:1px solid rgba(255,91,31,.18);
  border-radius:7px;
  background:rgba(255,91,31,.05);
  font-size:8px;
  font-weight:950;
}
@media(max-width:1000px){
  .lottery-layout{
    grid-template-columns:1fr;
  }
  .lottery-side-column{
    display:grid;
    grid-template-columns:repeat(2,minmax(0,1fr));
  }
}
@media(max-width:700px){
  .lottery-hero{
    flex-direction:column;
  }
  .status-pill{
    align-self:flex-start;
  }
  .lottery-summary-grid{
    grid-template-columns:repeat(2,minmax(0,1fr));
  }
  .draft-order-board{
    grid-template-columns:1fr;
  }
  .lottery-side-column{
    display:flex;
  }
  .chamber-glass{
    width:min(340px,88vw);
  }
  .lottery-ball{
    width:25px;
    height:25px;
    font-size:7px;
  }
  .machine-center{
    width:165px;
    min-height:112px;
  }
  .machine-center>strong{
    font-size:31px;
  }
  .machine-center .winner-name{
    font-size:17px;
  }
}
@media(max-width:430px){
  .lottery-card{
    padding:12px;
  }
  .lottery-summary-grid{
    gap:6px;
  }
  .summary-box{
    padding:10px;
  }
  .chamber-glass{
    width:min(300px,86vw);
  }
  .machine-center{
    width:145px;
    min-height:100px;
    padding:11px;
  }
  .machine-center>strong{
    font-size:27px;
  }
  .machine-center .winner-name{
    max-width:125px;
    font-size:15px;
  }
  .lottery-ball{
    width:22px;
    height:22px;
  }
  .machine-base{
    width:75%;
  }
}
`;