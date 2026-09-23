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

type MachinePhase =
  | "idle"
  | "mixing"
  | "suction"
  | "reveal"
  | "complete";

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

    lotteryId:
      raw.lotteryId == null ? undefined : Number(raw.lotteryId),

    leagueId:
      raw.leagueId == null ? undefined : String(raw.leagueId),

    sourceSeason:
      raw.sourceSeason == null ? undefined : Number(raw.sourceSeason),

    draftSeason:
      raw.draftSeason == null ? 0 : Number(raw.draftSeason),

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
              entry.finalStanding == null ? null : Number(entry.finalStanding),
            lotteryPosition:
              entry.lotteryPosition == null ? null : Number(entry.lotteryPosition),
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
              pick.finalStanding == null ? null : Number(pick.finalStanding),
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

export default function NhlDynastyLotteryOfficial({
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

  /*
   * Lottery copy must describe the draft this lottery is actually ordering.
   * Startup = initial Dynasty startup draft.
   * Annual = next-season Dynasty annual draft, using prior-season standings.
   */
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
          "get_nhl_dynasty_draft_lottery_state",
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
        "prepare_nhl_dynasty_draft_lottery",
        {
          p_league_id: leagueId,
          p_draft_season: draftSeason,
        }
      );

      if (error) {
        throw new Error(error.message);
      }

      const result = data as PrepareResult | null;

      if (
        !result?.success ||
        result.status !== "setup"
      ) {
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
      `LOCK THE ${draftSeason} ${isStartupLottery ? "STARTUP" : "ANNUAL"} DYNASTY LOTTERY?\n\n` +
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
        "lock_nhl_dynasty_draft_lottery",
        {
          p_league_id: leagueId,
          p_draft_season: draftSeason,
        }
      );

      if (error) {
        throw new Error(error.message);
      }

      const result = data as LockResult | null;

      if (
        !result?.success ||
        result.status !== "locked"
      ) {
        throw new Error(
          "The server returned an invalid lottery lock result."
        );
      }

      /*
       * The lock RPC intentionally returns NO hidden team/pick result.
       * Future picks stay server-side until reveal_next publishes them.
       */
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

    const confirmed = window.confirm(
      `Start the ${draftSeason} G365 NHL Dynasty ${isStartupLottery ? "Startup" : "Annual"} Draft Lottery?\n\n` +
        `The official result is already locked. Starting the lottery will move it into live reveal mode, beginning with pick #${pickCount} and ending with pick #1.`
    );

    if (!confirmed) return;

    setActionRunning(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const { data, error } = await supabase.rpc(
        "start_nhl_dynasty_draft_lottery",
        {
          p_league_id: leagueId,
          p_draft_season: draftSeason,
        }
      );

      if (error) {
        throw new Error(error.message);
      }

      const result = data as StartResult | null;

      if (
        !result?.success ||
        result.status !== "live"
      ) {
        throw new Error(
          "The server returned an invalid lottery start result."
        );
      }

      setSuccessMessage(
        `The ${draftSeason} Dynasty Draft Lottery is live. Reveal pick #${result.pickCount} when ready.`
      );

      await loadState();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "The official Dynasty lottery could not be started."
      );
    } finally {
      setActionRunning(false);
    }
  }

  async function revealNextPick() {
    if (
      actionRunning ||
      machineRunning ||
      lotteryState?.status !== "live" ||
      !nextPick
    ) {
      return;
    }

    const expectedPick = nextPick;
    const runId = runRef.current + 1;

    runRef.current = runId;

    setMachineRunning(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setCurrentPick(expectedPick);
    setDrawnTeam(null);
    setCountdown(null);
    setPhase("mixing");

    try {
      /*
       * Keep the existing G365 five-second lottery presentation.
       * The RPC is not called until the countdown finishes, so the
       * browser does not know which team is coming during the mix.
       */
      for (let seconds = 5; seconds >= 1; seconds -= 1) {
        if (runRef.current !== runId) return;

        setCountdown(seconds);
        await wait(1000);
      }

      if (runRef.current !== runId) return;

      setCountdown(null);

      /*
       * The server publishes exactly ONE previously hidden pick.
       * It never returns future lottery results.
       */
      const { data, error } = await supabase.rpc(
        "reveal_next_nhl_dynasty_lottery_pick",
        {
          p_league_id: leagueId,
          p_draft_season: draftSeason,
        }
      );

      if (error) {
        throw new Error(error.message);
      }

      const result = data as RevealResult | null;

      if (
        !result?.success ||
        !result.team ||
        Number(result.draftPick) !== expectedPick
      ) {
        throw new Error(
          "The server returned an invalid official reveal result."
        );
      }

      const revealedPick: RevealedPick = {
        revealOrder: Number(result.revealOrder),
        draftPick: Number(result.draftPick),
        fantasyTeamId: Number(
          result.team.fantasyTeamId
        ),
        teamName: String(result.team.teamName),
        finalStanding:
          result.team.finalStanding == null
            ? null
            : Number(result.team.finalStanding),
        originalNumberOnePercentage: Number(
          result.team.originalNumberOnePercentage
        ),
      };

      setPhase("suction");
      setDrawnTeam(revealedPick);

      await wait(1100);

      if (runRef.current !== runId) return;

      setPhase("reveal");

      /*
       * Refresh the safe state after the event has been published.
       * Only this newly revealed pick becomes visible.
       */
      await loadState();

      await wait(
        result.isFinalReveal ? 1900 : 1200
      );

      if (runRef.current !== runId) return;

      if (result.isFinalReveal) {
        setCurrentPick(null);
        setCountdown(null);
        setPhase("complete");

        setSuccessMessage(
          result.draftOrderApplied
            ? isStartupLottery
              ? `The ${draftSeason} Dynasty Startup Lottery is complete. The official Round 1 order has been applied to the startup snake draft.`
              : `The ${draftSeason} Dynasty Annual Draft Lottery is complete. The official order has been applied automatically to the annual Dynasty draft-pick assets.`
            : `The ${lotteryTitle} is complete.`
        );
      } else {
        setCurrentPick(null);
        setDrawnTeam(null);
        setCountdown(null);
        setPhase("idle");

        setSuccessMessage(
          `Pick #${result.draftPick} is official. ${
            result.remainingCount
          } ${
            result.remainingCount === 1
              ? "pick remains"
              : "picks remain"
          }.`
        );
      }

      await loadState();
    } catch (error) {
      if (runRef.current === runId) {
        setCurrentPick(null);
        setCountdown(null);
        setDrawnTeam(null);
        setPhase("idle");

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "The next official lottery pick could not be revealed."
        );

        /*
         * A network interruption could occur after the server
         * publishes a pick but before the browser receives it.
         * Reload the safe state so we never accidentally reveal
         * another pick based on stale client state.
         */
        await loadState();
      }
    } finally {
      if (runRef.current === runId) {
        setMachineRunning(false);
      }
    }
  }

  const statusLabel = !lotteryState?.exists
    ? "NOT PREPARED"
    : lotteryState.status === "setup"
      ? "PREPARED"
      : lotteryState.status === "locked"
        ? "OFFICIAL RESULTS LOCKED"
        : lotteryState.status === "live"
          ? "LIVE LOTTERY"
          : lotteryState.status === "completed"
            ? "LOTTERY COMPLETE"
            : "UNKNOWN";

  const button = (() => {
    if (loading) {
      return {
        label: "LOADING LOTTERY…",
        disabled: true,
        action: () => undefined,
      };
    }

    if (!lotteryState?.exists) {
      return {
        label: `PREPARE ${draftSeason} ${isStartupLottery ? "STARTUP" : "ANNUAL"} LOTTERY`,
        disabled: actionRunning || machineRunning,
        action: () => void prepareLottery(),
      };
    }

    if (lotteryState.status === "setup") {
      return {
        label: "LOCK OFFICIAL RESULTS",
        disabled: actionRunning || machineRunning,
        action: () => void lockLottery(),
      };
    }

    if (lotteryState.status === "locked") {
      return {
        label: `START ${isStartupLottery ? "STARTUP" : "ANNUAL"} LOTTERY`,
        disabled: actionRunning || machineRunning,
        action: () => void startLottery(),
      };
    }

    if (lotteryState.status === "live") {
      return {
        label: machineRunning
          ? `REVEALING PICK #${currentPick ?? nextPick ?? "…"}`
          : `REVEAL PICK #${nextPick ?? "…"}`,
        disabled:
          actionRunning ||
          machineRunning ||
          !nextPick,
        action: () => void revealNextPick(),
      };
    }

    return {
      label: "OFFICIAL LOTTERY COMPLETE",
      disabled: true,
      action: () => undefined,
    };
  })();

  if (loading && lotteryState == null) {
    return (
      <div className="g365-official-lottery-loading">
        Loading official Dynasty draft lottery…
      </div>
    );
  }

  return (
    <div className="g365-official-lottery">
      <style>{`
        .g365-official-lottery {
          margin-top:18px;
          border:1px solid rgba(255,72,24,.48);
          border-radius:16px;
          overflow:hidden;
          background:
            radial-gradient(circle at 50% 0%,rgba(255,67,20,.15),transparent 38%),
            linear-gradient(180deg,#090a0f,#050609);
          color:#f7f7f8;
          box-shadow:0 18px 48px rgba(0,0,0,.24);
        }

        .g365-official-lottery-loading {
          margin-top:18px;
          padding:18px;
          border:1px solid rgba(255,91,31,.28);
          border-radius:14px;
          background:#08090d;
          color:#aeb4bd;
          font-size:12px;
          font-weight:800;
        }

        .g365-official-head {
          display:flex;
          justify-content:space-between;
          align-items:center;
          gap:16px;
          padding:16px 18px;
          border-bottom:1px solid rgba(255,255,255,.08);
          background:
            linear-gradient(
              90deg,
              rgba(151,16,10,.35),
              rgba(255,91,25,.08)
            );
        }

        .g365-official-kicker {
          color:#ff6829;
          font-size:10px;
          font-weight:950;
          letter-spacing:.14em;
        }

        .g365-official-title {
          margin:3px 0 0;
          font-size:21px;
          font-weight:950;
        }

        .g365-official-purpose {
          margin-top:5px;
          color:#9aa2ad;
          font-size:10px;
          font-weight:750;
          line-height:1.4;
        }

        .g365-official-badges {
          display:flex;
          flex-wrap:wrap;
          justify-content:flex-end;
          gap:7px;
        }

        .g365-official-badge {
          border:1px solid rgba(255,84,34,.55);
          border-radius:999px;
          padding:6px 9px;
          color:#ff9a68;
          background:rgba(196,40,16,.13);
          font-size:9px;
          font-weight:950;
          letter-spacing:.08em;
          white-space:nowrap;
        }

        .g365-official-badge-live {
          color:#fff;
          border-color:rgba(255,72,24,.85);
          background:
            linear-gradient(
              135deg,
              rgba(174,26,12,.72),
              rgba(239,77,24,.48)
            );
          box-shadow:0 0 20px rgba(239,77,24,.18);
        }

        .g365-official-warning {
          margin:14px 14px 0;
          padding:11px 12px;
          border:1px solid rgba(255,122,36,.28);
          border-radius:10px;
          background:rgba(255,95,24,.06);
          color:#d9a183;
          font-size:10px;
          font-weight:750;
          line-height:1.5;
        }

        .g365-official-layout {
          display:grid;
          grid-template-columns:
            minmax(230px,.75fr)
            minmax(340px,1.25fr)
            minmax(220px,.7fr);
          gap:14px;
          padding:14px;
        }

        .g365-official-panel {
          min-width:0;
          padding:13px;
          border:1px solid rgba(255,255,255,.08);
          border-radius:12px;
          background:rgba(255,255,255,.025);
        }

        .g365-official-panel-title {
          margin-bottom:10px;
          color:#ff6a2a;
          font-size:10px;
          font-weight:950;
          letter-spacing:.1em;
        }

        .g365-official-empty {
          padding:16px 8px;
          color:#777f8b;
          font-size:10px;
          font-weight:750;
          line-height:1.5;
        }

        .g365-official-odds-row {
          display:grid;
          grid-template-columns:36px minmax(0,1fr) 58px;
          gap:8px;
          align-items:center;
          padding:8px 0;
          border-bottom:1px solid rgba(255,255,255,.055);
        }

        .g365-official-odds-row:last-child {
          border-bottom:0;
        }

        .g365-official-standing {
          width:30px;
          height:30px;
          display:flex;
          align-items:center;
          justify-content:center;
          border-radius:8px;
          background:rgba(255,83,24,.09);
          color:#ff7b3b;
          font-size:11px;
          font-weight:950;
        }

        .g365-official-odds-name {
          overflow:hidden;
          text-overflow:ellipsis;
          white-space:nowrap;
          color:#fff;
          font-size:11px;
          font-weight:850;
        }

        .g365-official-odds-sub {
          margin-top:2px;
          color:#777f8b;
          font-size:9px;
        }

        .g365-official-percent {
          text-align:right;
          color:#fff;
          font-size:14px;
          font-weight:950;
        }

        .g365-official-machine-wrap {
          position:relative;
          min-height:440px;
          display:flex;
          flex-direction:column;
          align-items:center;
          justify-content:flex-end;
        }

        .g365-official-tube {
          position:absolute;
          z-index:8;
          top:8px;
          left:50%;
          width:68px;
          height:126px;
          transform:translateX(-50%);
          border:3px solid rgba(255,255,255,.24);
          border-bottom:0;
          border-radius:16px 16px 0 0;
          background:
            linear-gradient(
              90deg,
              rgba(255,255,255,.025),
              rgba(255,255,255,.08),
              rgba(255,255,255,.02)
            );
          box-shadow:
            inset 0 0 18px rgba(255,255,255,.04),
            0 0 22px rgba(255,75,20,.09);
        }

        .g365-official-machine {
          position:relative;
          width:min(100%,390px);
          height:310px;
          overflow:hidden;
          border:4px solid rgba(255,255,255,.18);
          border-radius:50% 50% 43% 43%;
          background:
            radial-gradient(
              circle at 35% 22%,
              rgba(255,255,255,.09),
              transparent 17%
            ),
            radial-gradient(
              circle at 50% 65%,
              rgba(255,67,15,.08),
              transparent 48%
            ),
            rgba(5,7,11,.78);
          box-shadow:
            inset 0 0 45px rgba(255,255,255,.04),
            0 0 32px rgba(255,63,15,.08);
        }

        .g365-official-ball {
          position:absolute;
          left:calc(8% + (var(--x) * 1%));
          top:calc(10% + (var(--y) * 1%));
          width:42px;
          height:42px;
          display:flex;
          align-items:center;
          justify-content:center;
          box-sizing:border-box;
          padding:3px;
          transform:translate(-50%,-50%);
          border:2px solid rgba(255,255,255,.55);
          border-radius:50%;
          background:
            radial-gradient(
              circle at 32% 27%,
              #fff1df,
              #ff8b43 38%,
              #d82d13 72%,
              #71120c
            );
          color:#170705;
          text-align:center;
          font-size:7px;
          line-height:1.05;
          font-weight:1000;
          box-shadow:0 4px 10px rgba(0,0,0,.35);
        }

        .g365-official-mixing .g365-official-ball {
          animation:
            g365OfficialBounce
            var(--speed)
            ease-in-out
            infinite
            alternate;
        }

        @keyframes g365OfficialBounce {
          0% {
            transform:
              translate(-50%,-50%)
              translate(-16px,24px)
              rotate(-18deg);
          }

          35% {
            transform:
              translate(-50%,-50%)
              translate(22px,-26px)
              rotate(40deg);
          }

          70% {
            transform:
              translate(-50%,-50%)
              translate(-25px,-10px)
              rotate(105deg);
          }

          100% {
            transform:
              translate(-50%,-50%)
              translate(18px,22px)
              rotate(165deg);
          }
        }

        .g365-official-suction-ball {
          position:absolute;
          z-index:12;
          top:72px;
          left:50%;
          width:52px;
          height:52px;
          display:flex;
          align-items:center;
          justify-content:center;
          box-sizing:border-box;
          padding:4px;
          transform:translateX(-50%);
          border:2px solid rgba(255,255,255,.7);
          border-radius:50%;
          background:
            radial-gradient(
              circle at 32% 27%,
              #fff4e5,
              #ff9149 38%,
              #df3517 72%,
              #72120c
            );
          color:#160705;
          text-align:center;
          font-size:8px;
          line-height:1.05;
          font-weight:1000;
          box-shadow:0 0 24px rgba(255,91,31,.55);
          animation:
            g365OfficialSuck
            1s
            cubic-bezier(.2,.7,.2,1)
            both;
        }

        @keyframes g365OfficialSuck {
          from {
            top:300px;
            transform:
              translateX(-50%)
              scale(.8)
              rotate(-90deg);
          }

          to {
            top:42px;
            transform:
              translateX(-50%)
              scale(1)
              rotate(0deg);
          }
        }

        .g365-official-countdown {
          position:absolute;
          z-index:20;
          inset:0;
          display:flex;
          align-items:center;
          justify-content:center;
          pointer-events:none;
          color:#fff;
          font-size:86px;
          font-weight:1000;
          text-shadow:
            0 0 12px #ff4b1a,
            0 0 34px rgba(255,64,10,.8);
        }

        .g365-official-pick-banner {
          width:100%;
          min-height:70px;
          margin-top:12px;
          display:flex;
          flex-direction:column;
          align-items:center;
          justify-content:center;
          border:1px solid rgba(255,89,29,.24);
          border-radius:10px;
          background:
            linear-gradient(
              90deg,
              rgba(130,15,12,.18),
              rgba(255,89,29,.06),
              rgba(130,15,12,.18)
            );
          text-align:center;
        }

        .g365-official-pick-label {
          color:#ff7534;
          font-size:10px;
          font-weight:950;
          letter-spacing:.13em;
        }

        .g365-official-pick-name {
          margin-top:4px;
          color:#fff;
          font-size:24px;
          font-weight:1000;
        }

        .g365-official-results {
          display:grid;
          gap:7px;
        }

        .g365-official-result-row {
          min-height:45px;
          display:grid;
          grid-template-columns:42px minmax(0,1fr);
          gap:8px;
          align-items:center;
          padding:7px;
          border:1px solid rgba(255,255,255,.065);
          border-radius:9px;
          background:rgba(255,255,255,.018);
        }

        .g365-official-result-pick {
          width:34px;
          height:34px;
          display:flex;
          align-items:center;
          justify-content:center;
          border:1px solid rgba(255,93,27,.3);
          border-radius:8px;
          background:
            linear-gradient(
              135deg,
              rgba(222,42,18,.28),
              rgba(255,125,25,.12)
            );
          color:#ff7c36;
          font-weight:1000;
        }

        .g365-official-result-name {
          color:#fff;
          font-size:11px;
          font-weight:900;
        }

        .g365-official-result-wait {
          color:#59606a;
          font-size:10px;
          font-weight:800;
        }

        .g365-official-actions {
          display:flex;
          flex-wrap:wrap;
          justify-content:center;
          gap:9px;
          padding:0 14px 16px;
        }

        .g365-official-button {
          min-height:48px;
          border:1px solid rgba(255,94,25,.65);
          border-radius:9px;
          padding:10px 18px;
          background:
            linear-gradient(
              135deg,
              #97180f,
              #e94516,
              #ff7622
            );
          color:#fff;
          font-size:11px;
          font-weight:1000;
          letter-spacing:.05em;
          cursor:pointer;
          box-shadow:0 8px 24px rgba(178,43,15,.2);
        }

        .g365-official-button:disabled {
          opacity:.45;
          cursor:not-allowed;
        }

        .g365-official-refresh {
          min-height:48px;
          border:1px solid rgba(255,255,255,.12);
          border-radius:9px;
          padding:10px 15px;
          background:rgba(255,255,255,.035);
          color:#b8bec7;
          font-size:10px;
          font-weight:900;
          cursor:pointer;
        }

        .g365-official-refresh:disabled {
          opacity:.45;
          cursor:not-allowed;
        }

        .g365-official-error,
        .g365-official-success {
          margin:0 14px 14px;
          padding:10px 12px;
          border-radius:9px;
          font-size:10px;
          font-weight:850;
          line-height:1.45;
          text-align:center;
        }

        .g365-official-error {
          border:1px solid rgba(255,76,55,.42);
          background:rgba(150,24,18,.13);
          color:#ffb0a5;
        }

        .g365-official-success {
          border:1px solid rgba(55,210,118,.28);
          background:rgba(20,118,66,.11);
          color:#8de7b3;
        }

        .g365-official-note {
          padding:0 16px 15px;
          color:#777f8b;
          text-align:center;
          font-size:9px;
          line-height:1.5;
        }

        @media (max-width:980px) {
          .g365-official-layout {
            grid-template-columns:1fr 1.3fr;
          }

          .g365-official-results-panel {
            grid-column:1 / -1;
          }

          .g365-official-results {
            grid-template-columns:
              repeat(3,minmax(0,1fr));
          }
        }

        @media (max-width:680px) {
          .g365-official-head {
            align-items:flex-start;
            flex-direction:column;
          }

          .g365-official-badges {
            justify-content:flex-start;
          }

          .g365-official-layout {
            grid-template-columns:1fr;
            padding:10px;
          }

          .g365-official-results-panel {
            grid-column:auto;
          }

          .g365-official-results {
            grid-template-columns:
              repeat(2,minmax(0,1fr));
          }

          .g365-official-machine-wrap {
            min-height:400px;
          }

          .g365-official-machine {
            height:280px;
          }

          .g365-official-ball {
            width:38px;
            height:38px;
            font-size:6px;
          }

          .g365-official-countdown {
            font-size:70px;
          }

          .g365-official-pick-name {
            font-size:20px;
          }

          .g365-official-actions {
            align-items:stretch;
            flex-direction:column;
          }

          .g365-official-button,
          .g365-official-refresh {
            width:100%;
          }
        }
      `}</style>

      <div className="g365-official-head">
        <div>
          <div className="g365-official-kicker">
            G365 NHL DYNASTY
          </div>

          <h3 className="g365-official-title">
            {lotteryTitle}
          </h3>
          <div className="g365-official-purpose">
            {isStartupLottery
              ? "Sets the initial Round 1 order for the Dynasty startup draft."
              : `Sets the ${draftSeason} annual Dynasty draft order${
                  lotteryState?.sourceSeason
                    ? ` from ${lotteryState.sourceSeason} final standings`
                    : ""
                }.`}
          </div>
        </div>

        <div className="g365-official-badges">
          <div className="g365-official-badge">
            {lotteryDraftBadge}
          </div>

          {lotterySourceLabel ? (
            <div className="g365-official-badge">
              {lotterySourceLabel}
            </div>
          ) : null}

          <div
            className={`g365-official-badge ${
              lotteryState?.status === "live"
                ? "g365-official-badge-live"
                : ""
            }`}
          >
            {statusLabel}
          </div>
        </div>
      </div>

      <div className="g365-official-warning">
        {viewerOnly ? "League member view — commissioner controls are hidden. This page refreshes automatically while the lottery is open or live. " : ""}
        {isStartupLottery
          ? "This is the official Dynasty startup lottery. Every active franchise has equal odds for each remaining draft slot. Once a franchise is drawn, it is removed and every remaining franchise again has equal odds for the next slot. Locking creates the permanent result server-side. The result cannot be rerolled, and unrevealed picks remain hidden until each official reveal."
          : `This is the official ${draftSeason} Dynasty annual draft lottery. Preparing the lottery snapshots the eligible teams and weighted odds${lotteryState?.sourceSeason ? ` from the ${lotteryState.sourceSeason} final standings` : " from the prior season"}. Locking generates the permanent weighted result server-side. Once locked, the result cannot be rerolled. Future picks remain hidden until each official reveal.`}
      </div>

      <div className="g365-official-layout">
        <div className="g365-official-panel">
          <div className="g365-official-panel-title">
            {isStartupLottery ? "STARTUP — EQUAL ODDS" : `${draftSeason} ANNUAL — ORIGINAL #1 PICK ODDS`}
          </div>

          {entries.length ? (
            [...entries]
              .sort(
                (a, b) =>
                  isStartupLottery
                    ? a.teamName.localeCompare(b.teamName)
                    : (b.lotteryPosition ?? 0) -
                      (a.lotteryPosition ?? 0)
              )
              .map((team) => (
                <div
                  className="g365-official-odds-row"
                  key={team.fantasyTeamId}
                >
                  <div className="g365-official-standing">
                    {isStartupLottery ? "EQ" : team.finalStanding ?? "—"}
                  </div>

                  <div>
                    <div className="g365-official-odds-name">
                      {team.teamName}
                    </div>

                    <div className="g365-official-odds-sub">
                      {isStartupLottery
                        ? "Equal chance at each remaining slot"
                        : `Lottery position ${team.lotteryPosition ?? "—"} • ${team.ballCount} balls`}
                    </div>
                  </div>

                  <div className="g365-official-percent">
                    {team.percentage.toFixed(0)}%
                  </div>
                </div>
              ))
          ) : (
            <div className="g365-official-empty">
              {isStartupLottery
                ? "Prepare the official startup lottery to snapshot the active franchises and equal odds."
                : lotteryState?.sourceSeason
                  ? `Prepare the ${draftSeason} annual draft lottery using ${lotteryState.sourceSeason} final standings and weighted odds.`
                  : `Prepare the ${draftSeason} annual draft lottery to snapshot the prior-season final standings and weighted odds.`}
            </div>
          )}
        </div>

        <div className="g365-official-panel">
          <div className="g365-official-panel-title">
            {currentPick
              ? `REVEALING PICK #${currentPick}`
              : lotteryState?.status === "completed"
                ? "LOTTERY COMPLETE"
                : lotteryState?.status === "live"
                  ? `NEXT: PICK #${nextPick ?? "—"}`
                  : "OFFICIAL LOTTERY MACHINE"}
          </div>

          <div className="g365-official-machine-wrap">
            <div className="g365-official-tube" />

            {drawnTeam &&
            (phase === "suction" ||
              phase === "reveal") ? (
              <div className="g365-official-suction-ball">
                {drawnTeam.teamName}
              </div>
            ) : null}

            <div
              className={`g365-official-machine ${
                phase === "mixing"
                  ? "g365-official-mixing"
                  : ""
              }`}
            >
              {displayBalls.map((ball, index) => {
                const x =
                  10 + ((index * 37) % 80);

                const y =
                  15 + ((index * 53) % 72);

                const speed =
                  0.55 +
                  (index % 7) * 0.08;

                return (
                  <div
                    key={ball.key}
                    className="g365-official-ball"
                    style={
                      {
                        "--x": x,
                        "--y": y,
                        "--speed": `${speed}s`,
                      } as React.CSSProperties
                    }
                  >
                    {ball.team.teamName}
                  </div>
                );
              })}

              {countdown != null ? (
                <div className="g365-official-countdown">
                  {countdown}
                </div>
              ) : null}
            </div>

            <div className="g365-official-pick-banner">
              {currentPick ? (
                <>
                  <div className="g365-official-pick-label">
                    PICK #{currentPick}
                  </div>

                  <div className="g365-official-pick-name">
                    {phase === "reveal" &&
                    drawnTeam
                      ? drawnTeam.teamName
                      : "MIXING…"}
                  </div>
                </>
              ) : lotteryState?.status ===
                "completed" ? (
                <>
                  <div className="g365-official-pick-label">
                    #1 OVERALL
                  </div>

                  <div className="g365-official-pick-name">
                    {revealedByPick[1]
                      ?.teamName ?? "—"}
                  </div>
                </>
              ) : lotteryState?.status ===
                "live" ? (
                <>
                  <div className="g365-official-pick-label">
                    READY
                  </div>

                  <div className="g365-official-pick-name">
                    Reveal Pick #
                    {nextPick ?? "—"}
                  </div>
                </>
              ) : lotteryState?.status ===
                "locked" ? (
                <>
                  <div className="g365-official-pick-label">
                    RESULTS LOCKED
                  </div>

                  <div className="g365-official-pick-name">
                    Ready to Go Live
                  </div>
                </>
              ) : lotteryState?.status ===
                "setup" ? (
                <>
                  <div className="g365-official-pick-label">
                    PREPARED
                  </div>

                  <div className="g365-official-pick-name">
                    Review & Lock
                  </div>
                </>
              ) : (
                <>
                  <div className="g365-official-pick-label">
                    OFFICIAL LOTTERY
                  </div>

                  <div className="g365-official-pick-name">
                    Not Prepared
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="g365-official-panel g365-official-results-panel">
          <div className="g365-official-panel-title">
            {isStartupLottery
              ? `${draftSeason} STARTUP DRAFT ORDER`
              : `${draftSeason} ANNUAL DRAFT ORDER`}
          </div>

          <div className="g365-official-results">
            {pickCount > 0
              ? Array.from(
                  { length: pickCount },
                  (_, index) =>
                    pickCount - index
                ).map((pick) => (
                  <div
                    className="g365-official-result-row"
                    key={pick}
                  >
                    <div className="g365-official-result-pick">
                      #{pick}
                    </div>

                    <div
                      className={
                        revealedByPick[pick]
                          ? "g365-official-result-name"
                          : "g365-official-result-wait"
                      }
                    >
                      {revealedByPick[pick]
                        ?.teamName ??
                        "Waiting…"}
                    </div>
                  </div>
                ))
              : (
                <div className="g365-official-empty">
                  Draft positions will appear here
                  as they are officially revealed.
                </div>
              )}
          </div>
        </div>
      </div>

      <div className="g365-official-actions">
        {!viewerOnly ? (
          <button
            type="button"
            className="g365-official-button"
            disabled={button.disabled}
            onClick={button.action}
          >
            {actionRunning
              ? "PLEASE WAIT…"
              : button.label}
          </button>
        ) : null}

        <button
          type="button"
          className="g365-official-refresh"
          disabled={
            actionRunning ||
            machineRunning
          }
          onClick={() => {
            setErrorMessage(null);
            setSuccessMessage(null);
            void loadState(true);
          }}
        >
          {viewerOnly ? "REFRESH LOTTERY" : "REFRESH STATE"}
        </button>
      </div>

      {errorMessage ? (
        <div className="g365-official-error">
          {errorMessage}
        </div>
      ) : null}

      {successMessage ? (
        <div className="g365-official-success">
          {successMessage}
        </div>
      ) : null}

      <div className="g365-official-note">
        Official results are generated once and stored server-side.
        The browser never receives future unrevealed picks. Picks are
        published one at a time from #{pickCount || "—"} through #1.{" "}
        {isStartupLottery
          ? "The final reveal applies the official Round 1 order to the startup draft. The startup draft then snakes each round."
          : `The final reveal applies the official ${draftSeason} annual Dynasty draft order to the draft-pick assets while preserving traded pick ownership.`}
      </div>
    </div>
  );
}