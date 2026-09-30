"use client";

import type { CSSProperties } from "react";

import {
  getRoundDirection,
  TraditionalDraftType,
} from "./draftHelpers";

export type DraftBoardTeam = {
  id: number;
  teamName: string;
};

export type DraftBoardPlayer = {
  id: number;
  name: string;
  position?: string | null;
  nflTeam?: string | null;
};

export type DraftBoardPick = {
  overall: number;
  round: number;
  pickInRound: number;
  draftSlot: number;

  currentOwner:
    | DraftBoardTeam
    | null;

  originalOwner?:
    | DraftBoardTeam
    | null;

  player:
    | DraftBoardPlayer
    | null;
};

type Props = {
  draftType: TraditionalDraftType;
  totalRounds: number;
  teamCount: number;
  picks: DraftBoardPick[];
};

export default function DraftBoard({
  draftType,
  totalRounds,
  teamCount,
  picks,
}: Props) {
  const byRound = new Map<
    number,
    DraftBoardPick[]
  >();

  for (
    let round = 1;
    round <= totalRounds;
    round += 1
  ) {
    byRound.set(
      round,
      picks
        .filter(
          (pick) =>
            pick.round === round
        )
        .sort(
          (a, b) =>
            a.pickInRound -
            b.pickInRound
        )
    );
  }

  return (
    <section style={styles.card}>
      <div style={styles.header}>
        <div>
          <div style={styles.eyebrow}>
            COMPLETE DRAFT
          </div>

          <div style={styles.title}>
            Draft Board
          </div>
        </div>

        <div style={styles.meta}>
          {totalRounds} Rounds •{" "}
          {teamCount} Teams
        </div>
      </div>

      <div style={styles.scroll}>
        <div style={styles.board}>
          {Array.from(
            byRound.entries()
          ).map(
            ([
              round,
              roundPicks,
            ]) => (
              <div
                key={round}
                style={styles.round}
              >
                <div
                  style={
                    styles.roundLabel
                  }
                >
                  <strong>
                    ROUND {round}
                  </strong>

                  <span>
                    {getRoundDirection(
                      draftType,
                      round
                    )}
                  </span>
                </div>

                <div
                  style={
                    styles.pickGrid
                  }
                >
                  {roundPicks.map(
                    (pick) => {
                      const traded =
                        Boolean(
                          pick.originalOwner &&
                            pick.currentOwner &&
                            pick
                              .originalOwner
                              .id !==
                              pick
                                .currentOwner
                                .id
                        );

                      return (
                        <div
                          key={
                            pick.overall
                          }
                          style={
                            styles.pick
                          }
                        >
                          <div
                            style={
                              styles.pickTop
                            }
                          >
                            <span>
                              #
                              {
                                pick.overall
                              }
                            </span>

                            <span>
                              {round}.
                              {
                                pick.pickInRound
                              }
                            </span>
                          </div>

                          <div
                            style={
                              styles.owner
                            }
                          >
                            {pick
                              .currentOwner
                              ?.teamName ??
                              "TBD"}
                          </div>

                          {traded ? (
                            <div
                              style={
                                styles.traded
                              }
                            >
                              VIA{" "}
                              {
                                pick
                                  .originalOwner
                                  ?.teamName
                              }
                            </div>
                          ) : null}

                          <div
                            style={
                              styles.player
                            }
                          >
                            {pick.player
                              ? pick
                                  .player
                                  .name
                              : "—"}
                          </div>

                          {pick.player ? (
                            <div
                              style={
                                styles.playerMeta
                              }
                            >
                              {[
                                pick
                                  .player
                                  .position,
                                pick
                                  .player
                                  .nflTeam,
                              ]
                                .filter(
                                  Boolean
                                )
                                .join(
                                  " • "
                                )}
                            </div>
                          ) : null}
                        </div>
                      );
                    }
                  )}
                </div>
              </div>
            )
          )}
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

  header: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    padding: 14,
    borderBottom:
      "1px solid rgba(255,255,255,.06)",
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
    fontSize: 18,
    fontWeight: 950,
  },

  meta: {
    color:
      "rgba(255,255,255,.45)",
    fontSize: 10,
    fontWeight: 750,
  },

  scroll: {
    overflowX: "auto",
    WebkitOverflowScrolling:
      "touch",
  },

  board: {
    minWidth: 760,
    padding: 10,
  },

  round: {
    display: "grid",
    gridTemplateColumns:
      "100px minmax(650px,1fr)",
    gap: 7,
    marginBottom: 7,
  },

  roundLabel: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    minHeight: 95,
    borderRadius: 9,
    background:
      "rgba(255,72,15,.08)",
    color: "#fff",
    fontSize: 10,
  },

  pickGrid: {
    display: "grid",
    gridAutoFlow: "column",
    gridAutoColumns:
      "minmax(125px,1fr)",
    gap: 6,
  },

  pick: {
    minHeight: 95,
    padding: 8,
    border:
      "1px solid rgba(255,255,255,.07)",
    borderRadius: 9,
    background:
      "rgba(0,0,0,.22)",
  },

  pickTop: {
    display: "flex",
    justifyContent: "space-between",
    color:
      "rgba(255,255,255,.38)",
    fontSize: 8,
    fontWeight: 800,
  },

  owner: {
    marginTop: 6,
    overflow: "hidden",
    color: "#fff",
    fontSize: 10,
    fontWeight: 900,
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },

  traded: {
    marginTop: 2,
    color: "#ff8b58",
    fontSize: 7,
    fontWeight: 900,
    letterSpacing: ".04em",
  },

  player: {
    marginTop: 7,
    color:
      "rgba(255,255,255,.82)",
    fontSize: 10,
    fontWeight: 750,
  },

  playerMeta: {
    marginTop: 2,
    color:
      "rgba(255,255,255,.38)",
    fontSize: 8,
  },
};