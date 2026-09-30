"use client";

import type { CSSProperties } from "react";

type Props = {
  status: string;
  isPaused: boolean;
  busy?: boolean;

  onPause?: () => void;
  onResume?: () => void;
  onAdvance?: () => void;
};

export default function DraftCommissionerControls({
  status,
  isPaused,
  busy = false,
  onPause,
  onResume,
  onAdvance,
}: Props) {
  if (status === "completed") {
    return null;
  }

  return (
    <section style={styles.card}>
      <div>
        <div style={styles.eyebrow}>
          COMMISSIONER
        </div>

        <div style={styles.title}>
          Draft Controls
        </div>
      </div>

      <div style={styles.actions}>
        {isPaused ? (
          <button
            type="button"
            disabled={busy}
            onClick={onResume}
            style={styles.primary}
          >
            RESUME DRAFT
          </button>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={onPause}
            style={styles.button}
          >
            PAUSE DRAFT
          </button>
        )}

        {onAdvance ? (
          <button
            type="button"
            disabled={busy}
            onClick={onAdvance}
            style={styles.button}
          >
            PROCESS DRAFT
          </button>
        ) : null}
      </div>
    </section>
  );
}

const styles: Record<
  string,
  CSSProperties
> = {
  card: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    padding: 12,
    border:
      "1px solid rgba(255,91,35,.20)",
    borderRadius: 12,
    background:
      "rgba(255,72,15,.04)",
  },

  eyebrow: {
    color: "#ff6b35",
    fontSize: 8,
    fontWeight: 950,
    letterSpacing: ".1em",
  },

  title: {
    marginTop: 2,
    color: "#fff",
    fontSize: 14,
    fontWeight: 900,
  },

  actions: {
    display: "flex",
    flexWrap: "wrap",
    gap: 7,
  },

  button: {
    minHeight: 38,
    padding: "8px 12px",
    border:
      "1px solid rgba(255,255,255,.10)",
    borderRadius: 8,
    background: "#15181e",
    color: "#fff",
    fontSize: 9,
    fontWeight: 950,
    cursor: "pointer",
  },

  primary: {
    minHeight: 38,
    padding: "8px 12px",
    border:
      "1px solid rgba(255,91,35,.35)",
    borderRadius: 8,
    background:
      "linear-gradient(135deg,#8d1710,#d84416)",
    color: "#fff",
    fontSize: 9,
    fontWeight: 950,
    cursor: "pointer",
  },
};