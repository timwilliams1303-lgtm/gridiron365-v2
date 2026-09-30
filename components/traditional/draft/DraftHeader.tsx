"use client";

import type { CSSProperties } from "react";

import {
  getDraftFormatLabel,
  getDraftTitle,
  TraditionalDraftType,
} from "./draftHelpers";

type Props = {
  draftType: TraditionalDraftType;
  season: number;
  teamCount: number;
  currentRound: number;
  totalRounds: number;
  currentOverallPick: number;
  totalPicks: number;
  status: string;
  isPaused: boolean;
  secondsRemaining?: number | null;
};

export default function DraftHeader({
  draftType,
  season,
  teamCount,
  currentRound,
  totalRounds,
  currentOverallPick,
  totalPicks,
  status,
  isPaused,
  secondsRemaining,
}: Props) {
  return (
    <header style={styles.header}>
      <div style={styles.brand}>
        <div style={styles.logo}>G365</div>

        <div>
          <div style={styles.title}>
            {getDraftTitle(draftType, season)}
          </div>

          <div style={styles.sub}>
            {season}
            {" • "}
            {getDraftFormatLabel(draftType)}
            {" • "}
            {teamCount} Teams
          </div>
        </div>
      </div>

      <div style={styles.statusGrid}>
        <Status
          label="Round"
          value={`${currentRound}/${totalRounds}`}
        />

        <Status
          label="Overall"
          value={`${Math.min(
            currentOverallPick,
            totalPicks
          )}/${totalPicks}`}
        />

        <Status
          label="Status"
          value={
            isPaused
              ? "PAUSED"
              : status.toUpperCase()
          }
        />

        {secondsRemaining != null ? (
          <Status
            label="Clock"
            value={`${Math.max(
              0,
              secondsRemaining
            )}s`}
          />
        ) : null}
      </div>
    </header>
  );
}

function Status({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div style={styles.status}>
      <div style={styles.statusLabel}>
        {label}
      </div>

      <div style={styles.statusValue}>
        {value}
      </div>
    </div>
  );
}

const styles: Record<
  string,
  CSSProperties
> = {
  header: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    padding: 16,
    border:
      "1px solid rgba(255,91,35,.25)",
    borderRadius: 16,
    background:
      "linear-gradient(135deg,rgba(120,12,12,.20),rgba(255,75,15,.07),rgba(255,255,255,.02))",
  },

  brand: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    minWidth: 0,
  },

  logo: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 48,
    height: 48,
    flex: "0 0 48px",
    borderRadius: 12,
    background:
      "linear-gradient(135deg,#8e1111,#ff531d)",
    color: "#fff",
    fontSize: 13,
    fontWeight: 950,
    letterSpacing: ".05em",
  },

  title: {
    color: "#fff",
    fontSize:
      "clamp(16px,3vw,22px)",
    fontWeight: 950,
    lineHeight: 1.1,
  },

  sub: {
    marginTop: 5,
    color:
      "rgba(255,255,255,.55)",
    fontSize: 11,
    fontWeight: 700,
  },

  statusGrid: {
    display: "flex",
    flexWrap: "wrap",
    gap: 7,
  },

  status: {
    minWidth: 76,
    padding: "7px 9px",
    border:
      "1px solid rgba(255,255,255,.08)",
    borderRadius: 9,
    background:
      "rgba(0,0,0,.22)",
  },

  statusLabel: {
    color:
      "rgba(255,255,255,.42)",
    fontSize: 8,
    fontWeight: 900,
    letterSpacing: ".08em",
    textTransform: "uppercase",
  },

  statusValue: {
    marginTop: 2,
    color: "#fff",
    fontSize: 12,
    fontWeight: 950,
  },
};