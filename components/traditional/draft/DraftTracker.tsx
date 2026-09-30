"use client";

import type { CSSProperties } from "react";

type TrackerTeam = {
  id: number;
  teamName: string;
};

type TrackerPlayer = {
  id: number;
  name: string;
  position?: string | null;
  nflTeam?: string | null;
};

type TrackerPick = {
  overall: number;
  round: number;
  pickInRound: number;
  team: TrackerTeam | null;
  player: TrackerPlayer | null;
  current?: boolean;
};

type Props = {
  picks: TrackerPick[];
};

export default function DraftTracker({
  picks,
}: Props) {
  return (
    <section style={styles.card}>
      <div style={styles.heading}>
        DRAFT TRACKER
      </div>

      <div style={styles.scroll}>
        <div style={styles.row}>
          {picks.map((pick) => (
            <div
              key={pick.overall}
              style={{
                ...styles.pick,
                ...(pick.current
                  ? styles.current
                  : {}),
              }}
            >
              <div style={styles.pickNumber}>
                #{pick.overall}
              </div>

              <div style={styles.round}>
                R{pick.round} • P
                {pick.pickInRound}
              </div>

              <div style={styles.team}>
                {pick.team?.teamName ??
                  "TBD"}
              </div>

              <div style={styles.player}>
                {pick.player
                  ? pick.player.name
                  : pick.current
                    ? "ON THE CLOCK"
                    : "Upcoming"}
              </div>

              {pick.player ? (
                <div
                  style={styles.playerMeta}
                >
                  {[
                    pick.player.position,
                    pick.player.nflTeam,
                  ]
                    .filter(Boolean)
                    .join(" • ")}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const styles: Record<
  string,
  CSSProperties
> = {
  card: {
    border:
      "1px solid rgba(255,255,255,.07)",
    borderRadius: 14,
    background:
      "rgba(255,255,255,.025)",
    overflow: "hidden",
  },

  heading: {
    padding: "9px 12px",
    borderBottom:
      "1px solid rgba(255,255,255,.06)",
    color:
      "rgba(255,255,255,.58)",
    fontSize: 9,
    fontWeight: 950,
    letterSpacing: ".1em",
  },

  scroll: {
    overflowX: "auto",
    WebkitOverflowScrolling:
      "touch",
  },

  row: {
    display: "flex",
    minWidth: "max-content",
    padding: 8,
    gap: 7,
  },

  pick: {
    width: 145,
    minHeight: 94,
    padding: 9,
    border:
      "1px solid rgba(255,255,255,.07)",
    borderRadius: 10,
    background:
      "rgba(0,0,0,.24)",
  },

  current: {
    border:
      "1px solid rgba(255,89,30,.65)",
    background:
      "rgba(255,72,15,.09)",
    boxShadow:
      "0 0 20px rgba(255,72,15,.08)",
  },

  pickNumber: {
    color: "#ff6b35",
    fontSize: 10,
    fontWeight: 950,
  },

  round: {
    marginTop: 2,
    color:
      "rgba(255,255,255,.38)",
    fontSize: 9,
  },

  team: {
    marginTop: 7,
    overflow: "hidden",
    color: "#fff",
    fontSize: 11,
    fontWeight: 850,
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },

  player: {
    marginTop: 3,
    color:
      "rgba(255,255,255,.75)",
    fontSize: 10,
    fontWeight: 700,
  },

  playerMeta: {
    marginTop: 2,
    color:
      "rgba(255,255,255,.38)",
    fontSize: 8,
  },
};