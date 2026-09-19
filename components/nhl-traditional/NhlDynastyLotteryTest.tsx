"use client";

import { useMemo, useRef, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

type LotteryTeam = {
  id: number;
  team_name: string;
  active: boolean;
};

type Props = {
  leagueId: string;
  teams: LotteryTeam[];
};

type TestTeam = {
  id: number;
  teamName: string;
  finish: number;
  lotteryPosition: number;
  percentage: number;
};

const SIX_TEAM_WEIGHTS = [30, 24, 18, 13, 9, 6];

type ServerLotteryItem = {
  draftPick: number;
  revealOrder: number;
  fantasyTeamId: number;
  teamName: string;
  testFinishPosition: number;
  originalNumberOnePercentage: number;
};

type ServerLotteryResult = {
  success: boolean;
  testMode: boolean;
  saved: boolean;
  leagueId: string;
  teamCount: number;
  message: string;
  officialOrder: ServerLotteryItem[];
  revealOrder: ServerLotteryItem[];
};

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function wait(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

export default function NhlDynastyLotteryTest({ leagueId, teams }: Props) {
  const activeTeams = useMemo(
    () => teams.filter((team) => team.active).slice(0, 6),
    [teams]
  );

  const testTeams = useMemo<TestTeam[]>(() => {
    // Test-only finishing order:
    // first active team = best finish, last active team = worst finish.
    return activeTeams.map((team, index) => {
      const finish = index + 1;
      const lotteryPosition = activeTeams.length - index;
      const weightIndex = lotteryPosition - 1;

      return {
        id: team.id,
        teamName: team.team_name,
        finish,
        lotteryPosition,
        percentage:
          activeTeams.length === 6
            ? SIX_TEAM_WEIGHTS[weightIndex]
            : 100 / Math.max(activeTeams.length, 1),
      };
    });
  }, [activeTeams]);

  const [running, setRunning] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [currentPick, setCurrentPick] = useState<number | null>(null);
  const [revealed, setRevealed] = useState<Record<number, TestTeam>>({});
  const [drawnTeam, setDrawnTeam] = useState<TestTeam | null>(null);
  const [phase, setPhase] = useState<"idle" | "mixing" | "suction" | "reveal" | "complete">("idle");
  const runRef = useRef(0);

  const displayBalls = useMemo(() => {
    const balls: Array<{ key: string; team: TestTeam }> = [];
    testTeams.forEach((team) => {
      const count = Math.max(2, Math.round(team.percentage * 0.7));
      for (let i = 0; i < count; i += 1) {
        balls.push({ key: `${team.id}-${i}`, team });
      }
    });
    return balls;
  }, [testTeams]);

  async function runLottery() {
    if (running || testTeams.length !== 6) return;

    const runId = runRef.current + 1;
    runRef.current = runId;

    setRunning(true);
    setErrorMessage(null);
    setRevealed({});
    setDrawnTeam(null);
    setCountdown(null);
    setCurrentPick(null);
    setPhase("idle");

    try {
      /*
       * The server generates the complete test result using pgcrypto.
       * The RPC is test-only and saves nothing.
       */
      const { data, error } = await supabase.rpc("test_nhl_dynasty_lottery", {
        p_league_id: leagueId,
      });

      if (error) {
        throw new Error(error.message);
      }

      const serverResult = data as ServerLotteryResult | null;

      if (
        !serverResult?.success ||
        !serverResult.testMode ||
        serverResult.saved !== false ||
        !Array.isArray(serverResult.revealOrder) ||
        serverResult.revealOrder.length !== testTeams.length
      ) {
        throw new Error("The server returned an invalid test lottery result.");
      }

      /*
       * The backend already generated the real weighted order #1-first.
       * We use only its reverse reveal sequence for the show.
       */
      const revealSequence = [...serverResult.revealOrder].sort(
        (a, b) => a.revealOrder - b.revealOrder
      );

      for (const serverItem of revealSequence) {
        if (runRef.current !== runId) return;

        const team: TestTeam = {
          id: Number(serverItem.fantasyTeamId),
          teamName: String(serverItem.teamName),
          finish: Number(serverItem.testFinishPosition),
          lotteryPosition: Number(serverItem.testFinishPosition),
          percentage: Number(serverItem.originalNumberOnePercentage),
        };

        const pick = Number(serverItem.draftPick);

        setCurrentPick(pick);
        setDrawnTeam(null);
        setPhase("mixing");

        for (let seconds = 5; seconds >= 1; seconds -= 1) {
          if (runRef.current !== runId) return;
          setCountdown(seconds);
          await wait(1000);
        }

        setCountdown(null);
        setPhase("suction");
        setDrawnTeam(team);
        await wait(1100);

        if (runRef.current !== runId) return;

        setPhase("reveal");
        setRevealed((current) => ({ ...current, [pick]: team }));
        await wait(pick === 1 ? 1900 : 1200);
      }

      if (runRef.current === runId) {
        setCurrentPick(null);
        setCountdown(null);
        setDrawnTeam(null);
        setPhase("complete");
      }
    } catch (error) {
      if (runRef.current === runId) {
        setCurrentPick(null);
        setCountdown(null);
        setDrawnTeam(null);
        setPhase("idle");
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "The server test lottery could not be generated."
        );
      }
    } finally {
      if (runRef.current === runId) {
        setRunning(false);
      }
    }
  }

  if (activeTeams.length < 2) {
    return (
      <div className="g365-lottery-empty">
        At least two active teams are required to preview the Dynasty lottery.
      </div>
    );
  }

  return (
    <div className="g365-lottery-test">
      <style>{`
        .g365-lottery-test {
          margin-top: 18px;
          border: 1px solid rgba(255,91,31,.32);
          border-radius: 16px;
          overflow: hidden;
          background:
            radial-gradient(circle at 50% 0%, rgba(255,83,24,.11), transparent 38%),
            linear-gradient(180deg,#090a0f,#050609);
          color: #f7f7f8;
        }
        .g365-lottery-head {
          display:flex; justify-content:space-between; gap:16px; align-items:center;
          padding:16px 18px; border-bottom:1px solid rgba(255,255,255,.08);
          background:linear-gradient(90deg,rgba(142,17,13,.25),rgba(255,91,25,.06));
        }
        .g365-lottery-kicker { color:#ff6829; font-size:10px; font-weight:950; letter-spacing:.14em; }
        .g365-lottery-title { margin:3px 0 0; font-size:21px; font-weight:950; }
        .g365-lottery-test-badge {
          border:1px solid rgba(255,151,61,.35); border-radius:999px; padding:6px 9px;
          color:#ffad72; background:rgba(255,101,32,.08); font-size:9px; font-weight:950;
          letter-spacing:.08em; white-space:nowrap;
        }
        .g365-lottery-layout {
          display:grid; grid-template-columns:minmax(230px,.75fr) minmax(340px,1.25fr) minmax(220px,.7fr);
          gap:14px; padding:14px;
        }
        .g365-lottery-panel {
          border:1px solid rgba(255,255,255,.08); border-radius:12px;
          background:rgba(255,255,255,.025); padding:13px; min-width:0;
        }
        .g365-lottery-panel-title {
          color:#ff6a2a; font-size:10px; font-weight:950; letter-spacing:.1em; margin-bottom:10px;
        }
        .g365-odds-row {
          display:grid; grid-template-columns:34px minmax(0,1fr) 54px; gap:8px; align-items:center;
          padding:8px 0; border-bottom:1px solid rgba(255,255,255,.055);
        }
        .g365-odds-row:last-child { border-bottom:0; }
        .g365-finish {
          width:30px; height:30px; display:flex; align-items:center; justify-content:center;
          border-radius:8px; background:rgba(255,83,24,.09); color:#ff7b3b; font-weight:950; font-size:11px;
        }
        .g365-odds-name { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:11px; font-weight:850; }
        .g365-odds-sub { margin-top:2px; color:#777f8b; font-size:9px; }
        .g365-percent { text-align:right; color:#fff; font-size:14px; font-weight:950; }

        .g365-machine-wrap { position:relative; min-height:440px; display:flex; flex-direction:column; align-items:center; justify-content:flex-end; }
        .g365-tube {
          position:absolute; z-index:8; top:8px; left:50%; transform:translateX(-50%);
          width:68px; height:126px; border:3px solid rgba(255,255,255,.24);
          border-bottom:0; border-radius:16px 16px 0 0;
          background:linear-gradient(90deg,rgba(255,255,255,.025),rgba(255,255,255,.08),rgba(255,255,255,.02));
          box-shadow:inset 0 0 18px rgba(255,255,255,.04),0 0 22px rgba(255,75,20,.09);
        }
        .g365-machine {
          position:relative; width:min(100%,390px); height:310px; overflow:hidden;
          border:4px solid rgba(255,255,255,.18); border-radius:50% 50% 43% 43%;
          background:
            radial-gradient(circle at 35% 22%,rgba(255,255,255,.09),transparent 17%),
            radial-gradient(circle at 50% 65%,rgba(255,67,15,.08),transparent 48%),
            rgba(5,7,11,.78);
          box-shadow:inset 0 0 45px rgba(255,255,255,.04),0 0 32px rgba(255,63,15,.08);
        }
        .g365-ball {
          position:absolute; width:42px; height:42px; border-radius:50%;
          display:flex; align-items:center; justify-content:center; text-align:center;
          padding:3px; box-sizing:border-box; border:2px solid rgba(255,255,255,.55);
          background:radial-gradient(circle at 32% 27%,#fff1df,#ff8b43 38%,#d82d13 72%,#71120c);
          color:#170705; font-size:7px; line-height:1.05; font-weight:1000;
          box-shadow:0 4px 10px rgba(0,0,0,.35);
          left:calc(8% + (var(--x) * 1%));
          top:calc(10% + (var(--y) * 1%));
          transform:translate(-50%,-50%);
        }
        .g365-mixing .g365-ball { animation:g365Bounce var(--speed) ease-in-out infinite alternate; }
        @keyframes g365Bounce {
          0% { transform:translate(-50%,-50%) translate(-16px,24px) rotate(-18deg); }
          35% { transform:translate(-50%,-50%) translate(22px,-26px) rotate(40deg); }
          70% { transform:translate(-50%,-50%) translate(-25px,-10px) rotate(105deg); }
          100% { transform:translate(-50%,-50%) translate(18px,22px) rotate(165deg); }
        }
        .g365-suction-ball {
          position:absolute; z-index:12; top:72px; left:50%; width:52px; height:52px; border-radius:50%;
          transform:translateX(-50%);
          display:flex; align-items:center; justify-content:center; text-align:center; padding:4px;
          box-sizing:border-box; border:2px solid rgba(255,255,255,.7);
          background:radial-gradient(circle at 32% 27%,#fff4e5,#ff9149 38%,#df3517 72%,#72120c);
          color:#160705; font-size:8px; line-height:1.05; font-weight:1000;
          box-shadow:0 0 24px rgba(255,91,31,.55);
          animation:g365Suck 1s cubic-bezier(.2,.7,.2,1) both;
        }
        @keyframes g365Suck {
          from { top:300px; transform:translateX(-50%) scale(.8) rotate(-90deg); }
          to { top:42px; transform:translateX(-50%) scale(1) rotate(0deg); }
        }
        .g365-countdown {
          position:absolute; z-index:20; inset:0; display:flex; align-items:center; justify-content:center;
          pointer-events:none; font-size:86px; font-weight:1000; color:#fff;
          text-shadow:0 0 12px #ff4b1a,0 0 34px rgba(255,64,10,.8);
        }
        .g365-pick-banner {
          margin-top:12px; min-height:70px; width:100%; display:flex; flex-direction:column;
          align-items:center; justify-content:center; text-align:center;
          border:1px solid rgba(255,89,29,.24); border-radius:10px;
          background:linear-gradient(90deg,rgba(130,15,12,.18),rgba(255,89,29,.06),rgba(130,15,12,.18));
        }
        .g365-pick-label { color:#ff7534; font-size:10px; font-weight:950; letter-spacing:.13em; }
        .g365-pick-name { margin-top:4px; color:#fff; font-size:24px; font-weight:1000; }
        .g365-results { display:grid; gap:7px; }
        .g365-result-row {
          min-height:45px; display:grid; grid-template-columns:42px minmax(0,1fr); gap:8px; align-items:center;
          padding:7px; border:1px solid rgba(255,255,255,.065); border-radius:9px; background:rgba(255,255,255,.018);
        }
        .g365-result-pick {
          width:34px; height:34px; display:flex; align-items:center; justify-content:center;
          border-radius:8px; background:linear-gradient(135deg,rgba(222,42,18,.28),rgba(255,125,25,.12));
          border:1px solid rgba(255,93,27,.3); color:#ff7c36; font-weight:1000;
        }
        .g365-result-name { color:#fff; font-size:11px; font-weight:900; }
        .g365-result-wait { color:#59606a; font-size:10px; font-weight:800; }
        .g365-lottery-actions { display:flex; justify-content:center; padding:0 14px 16px; }
        .g365-lottery-button {
          min-height:46px; border:1px solid rgba(255,94,25,.55); border-radius:9px; padding:10px 18px;
          background:linear-gradient(135deg,#a51d12,#ef4d18,#ff7a24); color:#fff;
          font-size:11px; font-weight:1000; letter-spacing:.05em; cursor:pointer;
          box-shadow:0 8px 24px rgba(178,43,15,.2);
        }
        .g365-lottery-button:disabled { opacity:.45; cursor:not-allowed; }
        .g365-lottery-note { padding:0 16px 15px; text-align:center; color:#777f8b; font-size:9px; line-height:1.45; }
        .g365-lottery-error {
          margin:0 14px 14px; border:1px solid rgba(255,76,55,.42); border-radius:9px;
          padding:10px 12px; background:rgba(150,24,18,.13); color:#ffb0a5;
          font-size:10px; font-weight:850; line-height:1.45; text-align:center;
        }
        @media (max-width:980px) {
          .g365-lottery-layout { grid-template-columns:1fr 1.3fr; }
          .g365-lottery-results-panel { grid-column:1 / -1; }
          .g365-results { grid-template-columns:repeat(3,minmax(0,1fr)); }
        }
        @media (max-width:680px) {
          .g365-lottery-head { align-items:flex-start; }
          .g365-lottery-layout { grid-template-columns:1fr; padding:10px; }
          .g365-lottery-results-panel { grid-column:auto; }
          .g365-results { grid-template-columns:repeat(2,minmax(0,1fr)); }
          .g365-machine-wrap { min-height:400px; }
          .g365-machine { height:280px; }
          .g365-ball { width:38px; height:38px; font-size:6px; }
          .g365-countdown { font-size:70px; }
          .g365-pick-name { font-size:20px; }
        }
      `}</style>

      <div className="g365-lottery-head">
        <div>
          <div className="g365-lottery-kicker">G365 NHL DYNASTY</div>
          <h3 className="g365-lottery-title">Draft Lottery Machine</h3>
        </div>
        <div className="g365-lottery-test-badge">TEST MODE • NO PICKS SAVED</div>
      </div>

      <div className="g365-lottery-layout">
        <div className="g365-lottery-panel">
          <div className="g365-lottery-panel-title">ORIGINAL #1 PICK ODDS</div>
          {[...testTeams]
            .sort((a, b) => b.finish - a.finish)
            .map((team) => (
              <div className="g365-odds-row" key={team.id}>
                <div className="g365-finish">{team.finish}</div>
                <div>
                  <div className="g365-odds-name">{team.teamName}</div>
                  <div className="g365-odds-sub">
                    {team.finish === testTeams.length
                      ? "Worst finish"
                      : team.finish === 1
                        ? "Best finish"
                        : `Final finish: ${team.finish}`}
                  </div>
                </div>
                <div className="g365-percent">{team.percentage.toFixed(0)}%</div>
              </div>
            ))}
        </div>

        <div className="g365-lottery-panel">
          <div className="g365-lottery-panel-title">
            {currentPick ? `REVEALING PICK #${currentPick}` : phase === "complete" ? "LOTTERY COMPLETE" : "LOTTERY MACHINE"}
          </div>

          <div className="g365-machine-wrap">
            <div className="g365-tube" />

            {drawnTeam && (phase === "suction" || phase === "reveal") ? (
              <div className="g365-suction-ball">{drawnTeam.teamName}</div>
            ) : null}

            <div className={`g365-machine ${phase === "mixing" ? "g365-mixing" : ""}`}>
              {displayBalls.map((ball, index) => {
                const x = 10 + ((index * 37) % 80);
                const y = 15 + ((index * 53) % 72);
                const speed = 0.55 + ((index % 7) * 0.08);
                return (
                  <div
                    key={ball.key}
                    className="g365-ball"
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

              {countdown != null ? <div className="g365-countdown">{countdown}</div> : null}
            </div>

            <div className="g365-pick-banner">
              {currentPick ? (
                <>
                  <div className="g365-pick-label">PICK #{currentPick}</div>
                  <div className="g365-pick-name">
                    {phase === "reveal" && drawnTeam ? drawnTeam.teamName : "MIXING…"}
                  </div>
                </>
              ) : phase === "complete" ? (
                <>
                  <div className="g365-pick-label">#1 OVERALL</div>
                  <div className="g365-pick-name">{revealed[1]?.teamName ?? "—"}</div>
                </>
              ) : (
                <>
                  <div className="g365-pick-label">READY</div>
                  <div className="g365-pick-name">Run Test Lottery</div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="g365-lottery-panel g365-lottery-results-panel">
          <div className="g365-lottery-panel-title">DRAFT ORDER REVEAL</div>
          <div className="g365-results">
            {Array.from({ length: testTeams.length }, (_, index) => testTeams.length - index).map((pick) => (
              <div className="g365-result-row" key={pick}>
                <div className="g365-result-pick">#{pick}</div>
                <div className={revealed[pick] ? "g365-result-name" : "g365-result-wait"}>
                  {revealed[pick]?.teamName ?? "Waiting…"}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="g365-lottery-actions">
        <button
          type="button"
          className="g365-lottery-button"
          disabled={running || testTeams.length !== 6}
          onClick={() => void runLottery()}
        >
          {running ? "LOTTERY IN PROGRESS…" : phase === "complete" ? "RUN ANOTHER TEST LOTTERY" : "RUN TEST LOTTERY"}
        </button>
      </div>

      {errorMessage ? (
        <div className="g365-lottery-error">{errorMessage}</div>
      ) : null}

      <div className="g365-lottery-note">
        Test mode uses the six active teams only. The server generates the weighted result with pgcrypto #1-first, then the machine visually reveals it #6 through #1.
        Nothing from this preview is written to standings, official lottery history, events, or Dynasty draft-pick assets.
      </div>
    </div>
  );
}