"use client";

import type { CSSProperties } from "react";
import Link from "next/link";

import {
  getCompletedDraftTitle,
  TraditionalDraftType,
} from "./draftHelpers";

type Props = {
  leagueId: string;
  draftType: TraditionalDraftType;
  season: number;
  pickCount: number;
};

export default function DraftCompleted({
  leagueId,
  draftType,
  season,
  pickCount,
}: Props) {
  const redraft =
    draftType === "redraft";

  const startup =
    draftType === "startup";

  return (
    <section style={styles.card}>
      <div style={styles.badge}>
        DRAFT COMPLETE
      </div>

      <h1 style={styles.title}>
        {getCompletedDraftTitle(
          draftType,
          season
        )}
      </h1>

      <div style={styles.sub}>
        {season} • {pickCount} selections
      </div>

      <p style={styles.copy}>
        {redraft
          ? "The NFL Redraft draft is complete. Draft Grades are now available."
          : startup
            ? "The Dynasty startup draft is complete. These selections form the league's initial permanent Dynasty rosters."
            : "The annual Dynasty draft is complete. Drafted players and traded-pick ownership have been preserved by the Dynasty system."}
      </p>

      <div style={styles.actions}>
        {redraft ? (
          <Link
            href={`/league/${leagueId}/draft-grades`}
            style={styles.primary}
          >
            VIEW DRAFT GRADES
          </Link>
        ) : startup ? (
          <Link
            href={`/league/${leagueId}`}
            style={styles.primary}
          >
            LEAGUE HOME
          </Link>
        ) : (
          <Link
            href={`/league/${leagueId}/offseason`}
            style={styles.primary}
          >
            CONTINUE OFFSEASON
          </Link>
        )}

        <Link
          href={`/league/${leagueId}/draft`}
          style={styles.button}
        >
          COMPLETE DRAFT BOARD
        </Link>
      </div>
    </section>
  );
}

const styles: Record<
  string,
  CSSProperties
> = {
  card: {
    padding: "28px 18px",
    border:
      "1px solid rgba(255,91,35,.25)",
    borderRadius: 18,
    background:
      "linear-gradient(135deg,rgba(120,12,12,.18),rgba(255,75,15,.07),rgba(255,255,255,.02))",
    textAlign: "center",
  },

  badge: {
    display: "inline-flex",
    padding: "5px 9px",
    border:
      "1px solid rgba(255,91,35,.3)",
    borderRadius: 999,
    color: "#ff713d",
    fontSize: 8,
    fontWeight: 950,
    letterSpacing: ".1em",
  },

  title: {
    margin: "10px 0 0",
    color: "#fff",
    fontSize:
      "clamp(22px,5vw,34px)",
    fontWeight: 950,
  },

  sub: {
    marginTop: 6,
    color:
      "rgba(255,255,255,.45)",
    fontSize: 11,
  },

  copy: {
    maxWidth: 700,
    margin: "14px auto 0",
    color:
      "rgba(255,255,255,.70)",
    fontSize: 13,
    lineHeight: 1.55,
  },

  actions: {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
    marginTop: 18,
  },

  button: {
    minHeight: 40,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "9px 13px",
    border:
      "1px solid rgba(255,255,255,.10)",
    borderRadius: 9,
    background: "#15181e",
    color: "#fff",
    fontSize: 9,
    fontWeight: 950,
    textDecoration: "none",
  },

  primary: {
    minHeight: 40,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "9px 13px",
    border:
      "1px solid rgba(255,91,35,.35)",
    borderRadius: 9,
    background:
      "linear-gradient(135deg,#8d1710,#d84416)",
    color: "#fff",
    fontSize: 9,
    fontWeight: 950,
    textDecoration: "none",
  },
};