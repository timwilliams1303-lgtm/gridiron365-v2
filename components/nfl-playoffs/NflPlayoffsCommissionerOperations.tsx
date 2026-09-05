"use client";

import {
  CSSProperties,
  useMemo,
  useState,
} from "react";

import {
  createBrowserClient,
} from "@supabase/ssr";

import {
  useRouter,
} from "next/navigation";


type Props = {
  leagueId: string;
};


type ActionKey =
  | "safe_lifecycle"
  | "sync_schedule"
  | "refresh_status"
  | "lock_players"
  | "refresh_scoring"
  | "refresh_projections"
  | "rebuild_standings";


type ActionDefinition = {
  key: ActionKey;
  title: string;
  description: string;
  buttonLabel: string;
  caution?: string;
};


const ACTIONS: ActionDefinition[] = [
  {
    key: "safe_lifecycle",
    title: "Safe Lifecycle Check",
    description:
      "Runs the complete repair pass for this league: schedule sync, round status, player locks, scoring refresh and safe advancement.",
    buttonLabel: "RUN LIFECYCLE CHECK",
    caution:
      "This does not force a round final. Existing completion safeguards remain in control.",
  },

  {
    key: "refresh_scoring",
    title: "Refresh Round Scoring",
    description:
      "Recalculates the active NFL Playoffs round using the latest synchronized NFL player and game data.",
    buttonLabel: "REFRESH SCORING",
  },

  {
    key: "refresh_status",
    title: "Refresh Round Status",
    description:
      "Rechecks whether the active round should currently be Open, Live or Finalizing.",
    buttonLabel: "REFRESH STATUS",
  },

  {
    key: "lock_players",
    title: "Repair Player Locks",
    description:
      "Locks lineup players whose real NFL games have already started.",
    buttonLabel: "REPAIR LOCKS",
  },

  {
    key: "sync_schedule",
    title: "Sync Playoff Schedule",
    description:
      "Resynchronizes mapped NFL postseason games and the four G365 playoff round kickoff windows.",
    buttonLabel: "SYNC SCHEDULE",
  },

  {
    key: "refresh_projections",
    title: "Refresh Projections",
    description:
      "Rebuilds active-round player projections from the current postseason schedule and current-season data.",
    buttonLabel: "REFRESH PROJECTIONS",
    caution:
      "Protected after kickoff and after a Salary league's board has been published.",
  },

  {
    key: "rebuild_standings",
    title: "Rebuild Standings",
    description:
      "Repairs cumulative NFL Playoffs standings from completed round score records.",
    buttonLabel: "REBUILD STANDINGS",
    caution:
      "Blocked while the active round contains unfinished fantasy score rows.",
  },
];


function formatResult(
  value: unknown
) {
  try {
    return JSON.stringify(
      value,
      null,
      2
    );
  } catch {
    return String(value);
  }
}


export default function NflPlayoffsCommissionerOperations({
  leagueId,
}: Props) {
  const router = useRouter();

  const supabase = useMemo(() => {
    const supabaseUrl =
      process.env
        .NEXT_PUBLIC_SUPABASE_URL;

    const supabaseKey =
      process.env
        .NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
      process.env
        .NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (
      !supabaseUrl ||
      !supabaseKey
    ) {
      return null;
    }

    return createBrowserClient(
      supabaseUrl,
      supabaseKey
    );
  }, []);


  const [
    runningAction,
    setRunningAction,
  ] = useState<ActionKey | null>(
    null
  );


  const [
    result,
    setResult,
  ] = useState<unknown>(
    null
  );


  const [
    resultTitle,
    setResultTitle,
  ] = useState(
    ""
  );


  const [
    error,
    setError,
  ] = useState(
    ""
  );


  async function runAction(
    action: ActionDefinition
  ) {
    if (!supabase) {
      setError(
        "Supabase browser configuration is missing."
      );

      return;
    }


    setRunningAction(
      action.key
    );

    setError("");
    setResult(null);

    setResultTitle(
      action.title
    );


    try {
      const {
        data,
        error: rpcError,
      } = await supabase.rpc(
        "run_nfl_playoff_commissioner_action",
        {
          p_league_id:
            leagueId,

          p_action:
            action.key,
        }
      );


      if (rpcError) {
        throw rpcError;
      }


      setResult(
        data
      );


      router.refresh();

    } catch (
      actionError: unknown
    ) {
      const message =
        actionError instanceof Error
          ? actionError.message
          : (
              typeof actionError ===
              "object" &&
              actionError !== null &&
              "message" in actionError
            )
          ? String(
              (
                actionError as {
                  message?: unknown;
                }
              ).message ??
              "Operation failed."
            )
          : "Operation failed.";


      setError(
        message
      );

    } finally {
      setRunningAction(
        null
      );
    }
  }


  const anyRunning =
    runningAction !== null;


  return (
    <section
      style={
        styles.section
      }
    >
      <div
        style={
          styles.headingRow
        }
      >
        <div>
          <div
            style={
              styles.eyebrow
            }
          >
            COMMISSIONER OPERATIONS
          </div>

          <h2
            style={
              styles.title
            }
          >
            Lifecycle & Repair Controls
          </h2>

          <p
            style={
              styles.subtitle
            }
          >
            Use these controls only when
            you need an immediate repair or
            refresh. Normal NFL Playoffs
            scoring and lifecycle processing
            already runs automatically every
            minute.
          </p>
        </div>

        <div
          style={
            styles.autoBadge
          }
        >
          <span
            style={
              styles.liveDot
            }
          />

          AUTO: 1 MIN
        </div>
      </div>


      <div
        style={
          styles.safetyNotice
        }
      >
        <div
          style={
            styles.safetyIcon
          }
        >
          🛡️
        </div>

        <div>
          <div
            style={
              styles.safetyTitle
            }
          >
            Protected lifecycle
          </div>

          <div
            style={
              styles.safetyText
            }
          >
            There is intentionally no
            Force Finalize control. A round
            can only finalize when the real
            NFL games and fantasy scoring
            satisfy the existing completion
            checks.
          </div>
        </div>
      </div>


      <div
        style={
          styles.grid
        }
      >
        {ACTIONS.map(
          (
            action
          ) => {
            const isRunning =
              runningAction ===
              action.key;


            return (
              <article
                key={
                  action.key
                }
                style={
                  action.key ===
                  "safe_lifecycle"
                    ? {
                        ...styles.card,
                        ...styles.primaryCard,
                      }
                    : styles.card
                }
              >
                <div
                  style={
                    styles.cardBody
                  }
                >
                  <div
                    style={
                      styles.cardTitle
                    }
                  >
                    {
                      action.title
                    }
                  </div>

                  <p
                    style={
                      styles.cardDescription
                    }
                  >
                    {
                      action.description
                    }
                  </p>

                  {action.caution ? (
                    <div
                      style={
                        styles.caution
                      }
                    >
                      {
                        action.caution
                      }
                    </div>
                  ) : null}
                </div>


                <button
                  type="button"
                  disabled={
                    anyRunning
                  }
                  onClick={() =>
                    runAction(
                      action
                    )
                  }
                  style={{
                    ...(
                      action.key ===
                      "safe_lifecycle"
                        ? styles.primaryButton
                        : styles.button
                    ),

                    opacity:
                      anyRunning
                        ? 0.55
                        : 1,

                    cursor:
                      anyRunning
                        ? "not-allowed"
                        : "pointer",
                  }}
                >
                  {isRunning
                    ? "RUNNING..."
                    : action.buttonLabel}
                </button>
              </article>
            );
          }
        )}
      </div>


      {error ? (
        <div
          style={
            styles.errorBox
          }
        >
          <strong>
            Operation failed
          </strong>

          <div
            style={{
              marginTop: 6,
            }}
          >
            {error}
          </div>
        </div>
      ) : null}


      {result !== null ? (
        <div
          style={
            styles.resultBox
          }
        >
          <div
            style={
              styles.resultHeader
            }
          >
            <div>
              <div
                style={
                  styles.resultEyebrow
                }
              >
                LAST RESULT
              </div>

              <div
                style={
                  styles.resultTitle
                }
              >
                {resultTitle}
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setResult(
                  null
                );

                setResultTitle(
                  ""
                );
              }}
              style={
                styles.closeButton
              }
            >
              CLOSE
            </button>
          </div>

          <pre
            style={
              styles.pre
            }
          >
            {
              formatResult(
                result
              )
            }
          </pre>
        </div>
      ) : null}


      <div
        style={
          styles.footerNote
        }
      >
        Salary publication is not manually
        forced from this panel. Salary
        leagues continue using the automated
        hourly publication check, with the
        actual salary board protected by its
        scheduled publication and freeze
        rules.
      </div>
    </section>
  );
}


const styles: Record<
  string,
  CSSProperties
> = {
  section: {
    border:
      "1px solid rgba(255,255,255,0.10)",
    borderRadius: 22,
    padding: 22,
    background:
      "linear-gradient(180deg, rgba(18,18,18,0.98), rgba(8,8,8,0.98))",
    boxShadow:
      "0 20px 50px rgba(0,0,0,0.28)",
  },

  headingRow: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent:
      "space-between",
    gap: 18,
    flexWrap: "wrap",
    marginBottom: 18,
  },

  eyebrow: {
    fontSize: 11,
    letterSpacing: 1.5,
    fontWeight: 900,
    color: "#ff7a18",
    marginBottom: 7,
  },

  title: {
    margin: 0,
    fontSize:
      "clamp(22px, 4vw, 30px)",
    fontWeight: 950,
    letterSpacing: -0.6,
    color: "#ffffff",
  },

  subtitle: {
    margin:
      "9px 0 0 0",
    maxWidth: 720,
    fontSize: 14,
    lineHeight: 1.6,
    color:
      "rgba(255,255,255,0.66)",
  },

  autoBadge: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    minHeight: 36,
    padding: "0 13px",
    borderRadius: 999,
    border:
      "1px solid rgba(42,207,111,0.30)",
    background:
      "rgba(42,207,111,0.08)",
    color: "#7ff0ad",
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: 0.8,
  },

  liveDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: "#2acf6f",
    boxShadow:
      "0 0 12px rgba(42,207,111,0.75)",
  },

  safetyNotice: {
    display: "flex",
    gap: 12,
    alignItems: "flex-start",
    padding: 15,
    borderRadius: 16,
    border:
      "1px solid rgba(255,122,24,0.20)",
    background:
      "rgba(255,122,24,0.065)",
    marginBottom: 18,
  },

  safetyIcon: {
    fontSize: 20,
    lineHeight: 1,
  },

  safetyTitle: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: 900,
    marginBottom: 4,
  },

  safetyText: {
    color:
      "rgba(255,255,255,0.65)",
    fontSize: 12,
    lineHeight: 1.55,
  },

  grid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(250px, 1fr))",
    gap: 14,
  },

  card: {
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    justifyContent:
      "space-between",
    gap: 16,
    padding: 17,
    borderRadius: 17,
    border:
      "1px solid rgba(255,255,255,0.09)",
    background:
      "rgba(255,255,255,0.025)",
  },

  primaryCard: {
    border:
      "1px solid rgba(255,91,31,0.34)",
    background:
      "linear-gradient(145deg, rgba(190,24,24,0.14), rgba(255,122,24,0.06))",
  },

  cardBody: {
    minWidth: 0,
  },

  cardTitle: {
    fontSize: 16,
    fontWeight: 900,
    color: "#ffffff",
    marginBottom: 7,
  },

  cardDescription: {
    margin: 0,
    color:
      "rgba(255,255,255,0.62)",
    fontSize: 13,
    lineHeight: 1.55,
  },

  caution: {
    marginTop: 10,
    fontSize: 11,
    lineHeight: 1.5,
    color:
      "rgba(255,185,116,0.88)",
  },

  button: {
    width: "100%",
    minHeight: 42,
    borderRadius: 12,
    border:
      "1px solid rgba(255,255,255,0.12)",
    background:
      "rgba(255,255,255,0.06)",
    color: "#ffffff",
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: 0.6,
  },

  primaryButton: {
    width: "100%",
    minHeight: 42,
    borderRadius: 12,
    border: "none",
    background:
      "linear-gradient(90deg, #c91d1d, #ff6a1a)",
    color: "#ffffff",
    fontSize: 11,
    fontWeight: 950,
    letterSpacing: 0.65,
    boxShadow:
      "0 9px 24px rgba(210,42,24,0.22)",
  },

  errorBox: {
    marginTop: 16,
    padding: 15,
    borderRadius: 14,
    border:
      "1px solid rgba(255,80,80,0.28)",
    background:
      "rgba(255,40,40,0.08)",
    color: "#ffaaaa",
    fontSize: 13,
    lineHeight: 1.5,
  },

  resultBox: {
    marginTop: 16,
    padding: 16,
    borderRadius: 16,
    border:
      "1px solid rgba(42,207,111,0.22)",
    background:
      "rgba(42,207,111,0.045)",
    minWidth: 0,
  },

  resultHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent:
      "space-between",
    gap: 12,
    marginBottom: 12,
  },

  resultEyebrow: {
    color: "#7ff0ad",
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: 1.2,
    marginBottom: 4,
  },

  resultTitle: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: 900,
  },

  closeButton: {
    border:
      "1px solid rgba(255,255,255,0.12)",
    background:
      "rgba(255,255,255,0.05)",
    color:
      "rgba(255,255,255,0.75)",
    borderRadius: 10,
    padding: "8px 11px",
    fontSize: 10,
    fontWeight: 900,
    cursor: "pointer",
  },

  pre: {
    margin: 0,
    padding: 13,
    borderRadius: 12,
    overflowX: "auto",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    background:
      "rgba(0,0,0,0.30)",
    color:
      "rgba(255,255,255,0.78)",
    fontSize: 11,
    lineHeight: 1.55,
  },

  footerNote: {
    marginTop: 16,
    paddingTop: 14,
    borderTop:
      "1px solid rgba(255,255,255,0.07)",
    color:
      "rgba(255,255,255,0.48)",
    fontSize: 11,
    lineHeight: 1.55,
  },
};