"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";
import type {
  CSSProperties,
  MouseEvent,
} from "react";
import { createPortal } from "react-dom";

type Props = {
  status: string | null | undefined;
  injuryType?: string | null;
  injuryLocation?: string | null;
  injuryDetail?: string | null;
  playerName?: string | null;
  buttonStyle?: CSSProperties;
  className?: string;
};

function normalizeStatus(status: string | null | undefined) {
  const value = (status ?? "").trim().toUpperCase();

  if (!value || ["ACTIVE", "HEALTHY", "NORMAL"].includes(value)) {
    return null;
  }

  if (value === "Q" || value.includes("QUESTION")) {
    return { code: "Q", label: "Questionable" };
  }

  if (value === "D" || value.includes("DOUBT")) {
    return { code: "D", label: "Doubtful" };
  }

  if (value === "O" || value.includes("OUT")) {
    return { code: "OUT", label: "Out" };
  }

  if (value === "IR" || value.includes("INJURED RESERVE")) {
    return { code: "IR", label: "Injured Reserve" };
  }

  if (value === "PUP" || value.includes("PHYSICALLY UNABLE")) {
    return { code: "PUP", label: "Physically Unable to Perform" };
  }

  if (value === "NFI" || value.includes("NON-FOOTBALL")) {
    return { code: "NFI", label: "Non-Football Injury" };
  }

  if (
    value === "SUSP" ||
    value === "SUS" ||
    value.includes("SUSPEND")
  ) {
    return { code: "SUSP", label: "Suspended" };
  }

  if (
    value === "DTD" ||
    value.includes("DAY-TO-DAY") ||
    value.includes("DAY TO DAY")
  ) {
    return { code: "DTD", label: "Day-to-Day" };
  }

  return {
    code: value.length <= 6 ? value : "INJ",
    label: status?.trim() || "Injury Status",
  };
}

export default function InjuryReportButton({
  status,
  injuryType,
  injuryLocation,
  injuryDetail,
  playerName,
  buttonStyle,
  className,
}: Props) {
  const [open, setOpen] = useState(false);

  const injury = useMemo(
    () => normalizeStatus(status),
    [status]
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  if (!injury) {
    return null;
  }

  const openReport = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setOpen(true);
  };

  const closeReport = (event?: MouseEvent<HTMLElement>) => {
    event?.preventDefault();
    event?.stopPropagation();
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        className={className}
        aria-label={`${injury.label}. Open injury report.`}
        aria-haspopup="dialog"
        onClick={openReport}
        style={{
          border: "1px solid rgba(248,113,113,.6)",
          borderRadius: 999,
          background: "rgba(127,29,29,.28)",
          color: "#fecaca",
          fontSize: 10,
          fontWeight: 900,
          lineHeight: 1,
          minHeight: 22,
          padding: "4px 6px",
          cursor: "pointer",
          flexShrink: 0,
          ...buttonStyle,
        }}
      >
        {injury.code}
      </button>

      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              role="presentation"
              onClick={closeReport}
              style={styles.overlay}
            >
              <section
                role="dialog"
                aria-modal="true"
                aria-label={`${playerName ?? "Player"} injury report`}
                onClick={(event) => event.stopPropagation()}
                style={styles.dialog}
              >
                <div style={styles.header}>
                  <div>
                    <div style={styles.eyebrow}>INJURY REPORT</div>
                    <h3 style={styles.title}>
                      {playerName ?? "Player status"}
                    </h3>
                  </div>

                  <button
                    type="button"
                    aria-label="Close injury report"
                    onClick={closeReport}
                    style={styles.closeButton}
                  >
                    ×
                  </button>
                </div>

                <div style={styles.statusRow}>
                  <span style={styles.statusBadge}>{injury.code}</span>
                  <strong style={styles.statusLabel}>{injury.label}</strong>
                </div>

                <div style={styles.details}>
                  {injuryType ? (
                    <ReportRow label="Injury" value={injuryType} />
                  ) : null}

                  {injuryLocation && injuryLocation !== injuryType ? (
                    <ReportRow label="Location" value={injuryLocation} />
                  ) : null}

                  {injuryDetail ? (
                    <ReportRow label="Report" value={injuryDetail} />
                  ) : null}

                  {!injuryType && !injuryLocation && !injuryDetail ? (
                    <div style={styles.emptyDetail}>
                      No additional injury details are currently available.
                    </div>
                  ) : null}
                </div>

                <button
                  type="button"
                  onClick={closeReport}
                  style={styles.doneButton}
                >
                  CLOSE
                </button>
              </section>
            </div>,
            document.body
          )
        : null}
    </>
  );
}

function ReportRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div style={styles.reportRow}>
      <span style={styles.reportLabel}>{label}</span>
      <span style={styles.reportValue}>{value}</span>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  overlay: {
    position: "fixed",
    inset: 0,
    zIndex: 10000,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "max(12px, env(safe-area-inset-top)) 12px max(12px, env(safe-area-inset-bottom))",
    overflowY: "auto",
    overscrollBehavior: "contain",
    background: "rgba(0,0,0,.72)",
    backdropFilter: "blur(3px)",
  },
  dialog: {
    width: "min(500px, 100%)",
    maxHeight: "calc(100dvh - 24px)",
    overflowY: "auto",
    WebkitOverflowScrolling: "touch",
    overscrollBehavior: "contain",
    border: "1px solid rgba(249,115,22,.38)",
    borderRadius: 18,
    background: "linear-gradient(180deg,#18181b 0%,#09090b 100%)",
    boxShadow: "0 24px 70px rgba(0,0,0,.55)",
    padding: 18,
    color: "#f8fafc",
  },
  header: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 14,
    marginBottom: 16,
  },
  eyebrow: {
    color: "#fb923c",
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: ".12em",
  },
  title: {
    margin: "4px 0 0",
    color: "#fff",
    fontSize: 20,
    lineHeight: 1.2,
  },
  closeButton: {
    width: 34,
    height: 34,
    border: "1px solid rgba(255,255,255,.12)",
    borderRadius: 10,
    background: "rgba(255,255,255,.05)",
    color: "#fff",
    fontSize: 24,
    lineHeight: 1,
    cursor: "pointer",
  },
  statusRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "12px 14px",
    border: "1px solid rgba(248,113,113,.28)",
    borderRadius: 12,
    background: "rgba(127,29,29,.18)",
    marginBottom: 14,
  },
  statusBadge: {
    borderRadius: 999,
    background: "#991b1b",
    color: "#fff",
    fontSize: 11,
    fontWeight: 900,
    padding: "6px 8px",
  },
  statusLabel: {
    color: "#fecaca",
    fontSize: 14,
  },
  details: {
    display: "grid",
    gap: 10,
  },
  reportRow: {
    display: "grid",
    gap: 5,
    padding: "11px 12px",
    borderRadius: 11,
    background: "rgba(255,255,255,.035)",
    border: "1px solid rgba(255,255,255,.07)",
  },
  reportLabel: {
    color: "#a1a1aa",
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: ".08em",
    textTransform: "uppercase",
  },
  reportValue: {
    color: "#f4f4f5",
    fontSize: 14,
    lineHeight: 1.45,
    overflowWrap: "anywhere",
  },
  emptyDetail: {
    color: "#d4d4d8",
    fontSize: 13,
    lineHeight: 1.5,
    padding: "12px 2px",
  },
  doneButton: {
    width: "100%",
    marginTop: 16,
    border: 0,
    borderRadius: 11,
    background: "linear-gradient(90deg,#dc2626,#f97316)",
    color: "#fff",
    fontWeight: 900,
    fontSize: 12,
    letterSpacing: ".04em",
    padding: "11px 14px",
    cursor: "pointer",
  },
};