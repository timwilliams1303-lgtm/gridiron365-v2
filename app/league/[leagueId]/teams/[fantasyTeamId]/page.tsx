import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireLeagueMember } from "@/lib/leagues/requireLeagueMember";
import SeasonLongLiveRefresh from "@/components/season-long/SeasonLongLiveRefresh";
import {
  getSeasonLongTeamLiveLineupData,
  type SeasonLongLiveLineupPlayer,
} from "@/lib/season-long/team-live-lineup.service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  params: Promise<{
    leagueId: string;
    fantasyTeamId: string;
  }>;
  searchParams: Promise<{
    week?: string;
  }>;
};

function clampWeek(value: number) {
  if (!Number.isFinite(value)) return 1;

  return Math.min(
    18,
    Math.max(
      1,
      Math.trunc(value)
    )
  );
}

function points(value: number) {
  return value.toFixed(2);
}

function projectionPoints(
  value: number
) {
  return Number(
    value ?? 0
  ).toFixed(1);
}


function money(
  value: number | null
) {
  if (value === null) {
    return "—";
  }

  return new Intl.NumberFormat(
    "en-US",
    {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }
  ).format(value);
}

function prettyStatus(
  value: string
) {
  return value
    .replaceAll("_", " ")
    .replace(
      /\b\w/g,
      (character) =>
        character.toUpperCase()
    );
}

function quarter(
  period: number | null
) {
  switch (period) {
    case 1:
      return "Q1";

    case 2:
      return "Q2";

    case 3:
      return "Q3";

    case 4:
      return "Q4";

    case 5:
      return "OT";

    default:
      return "";
  }
}

function gameLabel(
  player: SeasonLongLiveLineupPlayer
) {
  const context =
    player.gameContext;

  if (
    player.scoreIsFinal ||
    context?.statusCompleted
  ) {
    return "FINAL";
  }

  if (
    player.scoreIsLive ||
    context?.isActuallyLive
  ) {
    const details = [
      quarter(
        context?.period ?? null
      ),
      context?.clock,
    ]
      .filter(Boolean)
      .join(" ");

    return details
      ? `LIVE ${details}`
      : "LIVE";
  }

  if (
    !player.nflGameId &&
    !player.opponentAbbreviation
  ) {
    return "BYE";
  }

  return "UPCOMING";
}

function formatPlayerStatLine(
  player: SeasonLongLiveLineupPlayer
): string {
  if (!player.isRevealed) {
    return (
      "Selection becomes visible when " +
      "this player's NFL game begins."
    );
  }

  const stats =
    player.stats;

  const parts:
    string[] = [];

  const position =
    player.position
      .trim()
      .toUpperCase();

  if (position === "QB") {
    if (
      stats.passingAttempts > 0 ||
      stats.passingCompletions > 0 ||
      stats.passingYards !== 0 ||
      stats.passingTouchdowns > 0 ||
      stats.passingInterceptions > 0
    ) {
      parts.push(
        `${stats.passingCompletions}/${stats.passingAttempts} CMP`,
        `${stats.passingYards} PASS YDS`
      );

      if (
        stats.passingTouchdowns > 0
      ) {
        parts.push(
          `${stats.passingTouchdowns} PASS TD`
        );
      }

      if (
        stats.passingInterceptions > 0
      ) {
        parts.push(
          `${stats.passingInterceptions} INT`
        );
      }
    }

    if (
      stats.rushingAttempts > 0 ||
      stats.rushingYards !== 0 ||
      stats.rushingTouchdowns > 0
    ) {
      parts.push(
        `${stats.rushingAttempts} CAR`,
        `${stats.rushingYards} RUSH YDS`
      );

      if (
        stats.rushingTouchdowns > 0
      ) {
        parts.push(
          `${stats.rushingTouchdowns} RUSH TD`
        );
      }
    }
  } else if (
    position === "RB"
  ) {
    if (
      stats.rushingAttempts > 0 ||
      stats.rushingYards !== 0 ||
      stats.rushingTouchdowns > 0
    ) {
      parts.push(
        `${stats.rushingAttempts} CAR`,
        `${stats.rushingYards} RUSH YDS`
      );

      if (
        stats.rushingTouchdowns > 0
      ) {
        parts.push(
          `${stats.rushingTouchdowns} RUSH TD`
        );
      }
    }

    if (
      stats.receivingTargets > 0 ||
      stats.receptions > 0 ||
      stats.receivingYards !== 0 ||
      stats.receivingTouchdowns > 0
    ) {
      parts.push(
        `${stats.receptions}/${stats.receivingTargets} REC/TGT`,
        `${stats.receivingYards} REC YDS`
      );

      if (
        stats.receivingTouchdowns > 0
      ) {
        parts.push(
          `${stats.receivingTouchdowns} REC TD`
        );
      }
    }
  } else if (
    position === "WR" ||
    position === "TE"
  ) {
    if (
      stats.receivingTargets > 0 ||
      stats.receptions > 0 ||
      stats.receivingYards !== 0 ||
      stats.receivingTouchdowns > 0
    ) {
      parts.push(
        `${stats.receptions}/${stats.receivingTargets} REC/TGT`,
        `${stats.receivingYards} REC YDS`
      );

      if (
        stats.receivingTouchdowns > 0
      ) {
        parts.push(
          `${stats.receivingTouchdowns} REC TD`
        );
      }
    }

    if (
      stats.rushingAttempts > 0 ||
      stats.rushingYards !== 0 ||
      stats.rushingTouchdowns > 0
    ) {
      parts.push(
        `${stats.rushingAttempts} CAR`,
        `${stats.rushingYards} RUSH YDS`
      );

      if (
        stats.rushingTouchdowns > 0
      ) {
        parts.push(
          `${stats.rushingTouchdowns} RUSH TD`
        );
      }
    }
  } else if (
    position === "K" ||
    position === "PK"
  ) {
    if (
      stats.fieldGoalsAttempted > 0 ||
      stats.fieldGoalsMade > 0
    ) {
      parts.push(
        `${stats.fieldGoalsMade}/${stats.fieldGoalsAttempted} FG`
      );
    }

    if (
      stats.extraPointsAttempted > 0 ||
      stats.extraPointsMade > 0
    ) {
      parts.push(
        `${stats.extraPointsMade}/${stats.extraPointsAttempted} XP`
      );
    }
  } else if (
    position === "DST" ||
    position === "DEF"
  ) {
    parts.push(
      `${stats.dstPointsAllowed} PA`,
      `${stats.dstYardsAllowed} YA`,
      `${stats.defensiveTotalTackles} TKL`,
      `${stats.defensiveTacklesForLoss} TFL`,
      `${stats.dstSacks} SACK`
    );

    if (
      stats.dstInterceptions > 0
    ) {
      parts.push(
        `${stats.dstInterceptions} INT`
      );
    }

    if (
      stats.dstFumbleRecoveries > 0
    ) {
      parts.push(
        `${stats.dstFumbleRecoveries} FR`
      );
    }

    if (
      stats.dstTouchdowns > 0
    ) {
      parts.push(
        `${stats.dstTouchdowns} TD`
      );
    }

    if (
      stats.dstSafeties > 0
    ) {
      parts.push(
        `${stats.dstSafeties} SAFETY`
      );
    }

    if (
      stats.dstBlockedKicks > 0
    ) {
      parts.push(
        `${stats.dstBlockedKicks} BLK`
      );
    }
  }

  if (
    stats.fumblesLost > 0
  ) {
    parts.push(
      `${stats.fumblesLost} FUM LOST`
    );
  }

  if (
    parts.length > 0
  ) {
    return parts.join(" • ");
  }

  const status =
    gameLabel(player);

  if (
    status === "UPCOMING"
  ) {
    return (
      "Stats will update when " +
      "the NFL game begins."
    );
  }

  if (
    status === "BYE"
  ) {
    return "BYE WEEK";
  }

  if (
    status === "FINAL"
  ) {
    return "NO RECORDED STATS";
  }

  return (
    "LIVE • Waiting for first " +
    "recorded stat"
  );
}

function playerNameMeta(
  player: SeasonLongLiveLineupPlayer
) {
  if (
    !player.isRevealed
  ) {
    return "";
  }

  const position =
    player.position || "—";

  const jersey =
    player.jerseyNumber
      ? ` #${player.jerseyNumber}`
      : "";

  return `${position}${jersey}`;
}

export default async function SeasonLongTeamPage({
  params,
  searchParams,
}: PageProps) {
  const {
    leagueId,
    fantasyTeamId:
      rawFantasyTeamId,
  } = await params;

  const query =
    await searchParams;

  const fantasyTeamId =
    Number(
      rawFantasyTeamId
    );

  if (
    !Number.isInteger(
      fantasyTeamId
    ) ||
    fantasyTeamId <= 0
  ) {
    notFound();
  }

  const access =
    await requireLeagueMember(
      leagueId
    );

  if (
    access.league.leagueType !==
    "season_long"
  ) {
    redirect(
      `/league/${leagueId}`
    );
  }

  const supabase =
    await createSupabaseServerClient();

  const season =
    access.league.season;

  const activeWeekResult =
    await supabase.rpc(
      "get_active_season_long_week",
      {
        p_season: season,
      }
    );

  if (
    activeWeekResult.error
  ) {
    throw new Error(
      activeWeekResult.error.message
    );
  }

  const activeWeek =
    clampWeek(
      Number(
        activeWeekResult.data ??
          1
      )
    );

  const requestedWeek =
    Number(query.week);

  const selectedWeek =
    query.week
      ? clampWeek(
          requestedWeek
        )
      : activeWeek;

  const selectionMode =
    access.league
      .playerSelectionMode ===
    "salary"
      ? "salary"
      : "no_salary";

  const data =
    await getSeasonLongTeamLiveLineupData(
      supabase,
      {
        leagueId,

        fantasyTeamId,

        viewerFantasyTeamId:
          access.fantasyTeam
            ?.id ?? null,

        season,

        week:
          selectedWeek,

        selectionMode,

        activeWeek,
      }
    );

  const lineupGridTemplate =
    selectionMode ===
    "salary"
      ? (
        "120px " +
        "minmax(330px,2.25fr) " +
        "115px 115px 95px 95px " +
        "130px 150px"
      )
      : (
        "120px " +
        "minmax(330px,2.25fr) " +
        "115px 115px 95px 95px " +
        "150px"
      );

  return (
    <main style={styles.page}>
      <SeasonLongLiveRefresh
        enabled={
          data.shouldAutoRefresh
        }
        live={
          data.hasLiveGames
        }
      />

      <section
        style={styles.shell}
      >
        <header
          style={styles.hero}
        >
          <div>
            <Link
              href={
                `/league/${leagueId}` +
                `/teams?week=${selectedWeek}`
              }
              style={
                styles.backLink
              }
            >
              ← Back to Teams
            </Link>

            <div
              style={
                styles.eyebrow
              }
            >
              SEASON-LONG •{" "}
              {selectionMode ===
              "salary"
                ? "SALARY"
                : "NO SALARY"}
            </div>

            <h1
              style={styles.title}
            >
              {data.team.teamName}
            </h1>

            <div
              style={
                styles.subtitle
              }
            >
              Week{" "}
              {selectedWeek}{" "}
              Lineup
              {data.team
                .isMyTeam
                ? " • Your Entry"
                : ""}
            </div>
          </div>

          <div
            style={
              styles.weekNav
            }
          >
            {selectedWeek >
            1 ? (
              <Link
                href={
                  `/league/${leagueId}` +
                  `/teams/${fantasyTeamId}` +
                  `?week=${
                    selectedWeek - 1
                  }`
                }
                style={
                  styles.weekButton
                }
              >
                ← W
                {selectedWeek -
                  1}
              </Link>
            ) : null}

            <Link
              href={
                `/league/${leagueId}` +
                `/teams/${fantasyTeamId}` +
                `?week=${activeWeek}`
              }
              style={
                styles.weekButtonActive
              }
            >
              W{activeWeek}
            </Link>

            {selectedWeek <
            18 ? (
              <Link
                href={
                  `/league/${leagueId}` +
                  `/teams/${fantasyTeamId}` +
                  `?week=${
                    selectedWeek + 1
                  }`
                }
                style={
                  styles.weekButton
                }
              >
                W
                {selectedWeek +
                  1}{" "}
                →
              </Link>
            ) : null}
          </div>
        </header>

        <section
          style={
            styles.summaryGrid
          }
        >
          <SummaryCard
            label="STATUS"
            value={
              data.isFinal
                ? "Final"
                : prettyStatus(
                    data.entryStatus
                  )
            }
          />

          <SummaryCard
            label="LINEUP"
            value={String(
              data.lineupPlayerCount
            )}
          />

          <SummaryCard
            label="WEEK PTS"
            value={points(
              data.weekPoints
            )}
            highlight
          />

          <SummaryCard
            label="PROJECTED"
            value={projectionPoints(
              data.projectedPoints
            )}
          />

          {selectionMode ===
          "salary" ? (
            <SummaryCard
              label="SALARY"
              value={money(
                data.salaryUsed
              )}
              moneyValue
            />
          ) : null}
        </section>

        <section
          style={
            styles.lineupCard
          }
        >
          <div
            style={
              styles.lineupHeader
            }
          >
            <div>
              <h2
                style={
                  styles.sectionTitle
                }
              >
                Week{" "}
                {selectedWeek}{" "}
                Lineup
              </h2>

              <div
                style={
                  styles.sectionSubtitle
                }
              >
                {data.team.teamName}
              </div>
            </div>

            <span
              style={
                styles.modeBadge
              }
            >
              {selectionMode ===
              "salary"
                ? "SALARY"
                : "NO SALARY"}
            </span>
          </div>

          {data.players.length ===
          0 ? (
            <div
              style={
                styles.emptyState
              }
            >
              No lineup has been
              submitted for this
              week.
            </div>
          ) : (
            <div
              style={
                styles.tableWrap
              }
            >
              <div
                style={{
                  ...styles.tableHeaderRow,
                  gridTemplateColumns:
                    lineupGridTemplate,
                }}
              >
                <span>SLOT</span>
                <span>PLAYER</span>
                <span>TEAM</span>
                <span>OPP</span>
                <span>PROJ</span>
                <span>PTS</span>

                {selectionMode ===
                "salary" ? (
                  <span>
                    SALARY
                  </span>
                ) : null}

                <span>GAME</span>
              </div>

              {data.players.map(
                (player) => {
                  const status =
                    gameLabel(
                      player
                    );

                  const live =
                    status.startsWith(
                      "LIVE"
                    );

                  const final =
                    status ===
                    "FINAL";

                  const statLine =
                    formatPlayerStatLine(
                      player
                    );

                  return (
                    <div
                      key={
                        `${player.lineupSlot}:` +
                        `${player.slotIndex}:` +
                        `${player.playerId}`
                      }
                      style={{
                        ...styles.playerRow,

                        gridTemplateColumns:
                          lineupGridTemplate,

                        ...(live
                          ? styles.playerRowLive
                          : {}),
                      }}
                    >
                      <div
                        style={
                          styles.slotCell
                        }
                      >
                        <span
                          style={
                            styles.slotBadge
                          }
                        >
                          {
                            player.lineupSlot
                          }
                        </span>
                      </div>

                      <div
                        style={
                          styles.playerCell
                        }
                      >
                        <div
                          style={
                            styles.playerNameLine
                          }
                        >
                          <strong
                            style={
                              styles.playerName
                            }
                          >
                            {
                              player.fullName
                            }
                          </strong>

                          {playerNameMeta(
                            player
                          ) ? (
                            <span
                              style={
                                styles.playerMetaInline
                              }
                            >
                              ·{" "}
                              {playerNameMeta(
                                player
                              )}
                            </span>
                          ) : null}
                        </div>

                        <div
                          style={{
                            ...styles.statLine,

                            ...(live
                              ? styles.statLineLive
                              : {}),
                          }}
                        >
                          {statLine}
                        </div>
                      </div>

                      <strong
                        style={
                          styles.teamCell
                        }
                      >
                        {player.isRevealed
                          ? player.teamAbbreviation ??
                            "FA"
                          : "—"}
                      </strong>

                      <strong
                        style={
                          styles.opponentCell
                        }
                      >
                        {player
                          .opponentAbbreviation
                          ? `${
                              player.opponentPrefix ??
                              "vs"
                            } ${
                              player.opponentAbbreviation
                            }`
                          : "BYE"}
                      </strong>

                      <strong
                        style={
                          styles.numericCell
                        }
                      >
                        {projectionPoints(
                          player.projectedPoints
                        )}
                      </strong>

                      <strong
                        style={{
                          ...styles.pointsCell,

                          ...(live
                            ? styles.pointsCellLive
                            : {}),
                        }}
                      >
                        {points(
                          player.fantasyPoints
                        )}
                      </strong>

                      {selectionMode ===
                      "salary" ? (
                        <strong
                          style={
                            styles.salaryCell
                          }
                        >
                          {money(
                            player.salary
                          )}
                        </strong>
                      ) : null}

                      <div
                        style={
                          styles.gameCell
                        }
                      >
                        <span
                          style={{
                            ...styles.gameBadge,

                            ...(live
                              ? styles.gameBadgeLive
                              : {}),

                            ...(final
                              ? styles.gameBadgeFinal
                              : {}),
                          }}
                        >
                          {status}
                        </span>
                      </div>
                    </div>
                  );
                }
              )}

              <div
                style={{
                  ...styles.totalRow,

                  gridTemplateColumns:
                    lineupGridTemplate,
                }}
              >
                <strong>
                  TEAM TOTAL
                </strong>

                <span />
                <span />
                <span />

                <strong
                  style={
                    styles.numericCell
                  }
                >
                  {projectionPoints(
                    data.projectedPoints
                  )}
                </strong>

                <strong
                  style={
                    styles.totalPoints
                  }
                >
                  {points(
                    data.weekPoints
                  )}
                </strong>

                {selectionMode ===
                "salary" ? (
                  <strong
                    style={
                      styles.salaryCell
                    }
                  >
                    {money(
                      data.salaryUsed
                    )}
                  </strong>
                ) : null}

                <strong
                  style={
                    styles.totalStatus
                  }
                >
                  {data.isFinal
                    ? "FINAL"
                    : "LIVE"}
                </strong>
              </div>
            </div>
          )}
        </section>

        {data.shouldAutoRefresh ? (
          <div
            style={
              styles.refreshNote
            }
          >
            {data.hasLiveGames
              ? (
                "Live stats and fantasy points " +
                "refresh automatically while " +
                "games are in progress."
              )
              : (
                "This page will begin showing " +
                "live stats automatically when " +
                "the selected players' games start."
              )}
          </div>
        ) : null}
      </section>
    </main>
  );
}

function SummaryCard({
  label,
  value,
  highlight = false,
  moneyValue = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  moneyValue?: boolean;
}) {
  return (
    <div
      style={
        styles.summaryCard
      }
    >
      <span
        style={
          styles.summaryLabel
        }
      >
        {label}
      </span>

      <strong
        style={{
          ...styles.summaryValue,

          ...(highlight
            ? styles.summaryValueHighlight
            : {}),

          ...(moneyValue
            ? styles.summaryValueMoney
            : {}),
        }}
      >
        {value}
      </strong>
    </div>
  );
}

const styles:
  Record<
    string,
    React.CSSProperties
  > = {
  page: {
    minHeight: "100vh",
    background: "#090a0c",
    color: "#fff",
    padding:
      "24px 16px 60px",
  },

  shell: {
    width:
      "min(1420px,100%)",
    margin: "0 auto",
    display: "grid",
    gap: "14px",
  },

  hero: {
    display: "flex",
    justifyContent:
      "space-between",
    alignItems:
      "flex-end",
    gap: "20px",
    flexWrap: "wrap",
  },

  backLink: {
    display:
      "inline-block",
    marginBottom: "12px",
    color: "#ff7a1a",
    textDecoration: "none",
    fontWeight: 900,
    fontSize: "13px",
  },

  eyebrow: {
    color: "#ff6a00",
    fontSize: "11px",
    fontWeight: 950,
    letterSpacing:
      ".1em",
  },

  title: {
    margin:
      "6px 0 3px",
    fontSize: "30px",
    lineHeight: 1.05,
  },

  subtitle: {
    color: "#8e96a3",
    fontSize: "13px",
    fontWeight: 800,
  },

  weekNav: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexWrap: "wrap",
  },

  weekButton: {
    padding:
      "9px 12px",
    border:
      "1px solid rgba(255,255,255,.10)",
    borderRadius: "8px",
    color: "#c9ced6",
    background:
      "#111318",
    textDecoration: "none",
    fontWeight: 900,
    fontSize: "12px",
  },

  weekButtonActive: {
    padding:
      "9px 12px",
    border:
      "1px solid rgba(255,93,20,.45)",
    borderRadius: "8px",
    color: "#ff8a2a",
    background:
      "rgba(255,82,10,.08)",
    textDecoration: "none",
    fontWeight: 950,
    fontSize: "12px",
  },

  summaryGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit,minmax(155px,1fr))",
    gap: "10px",
  },

  summaryCard: {
    minHeight: "70px",
    padding:
      "12px 14px",
    border:
      "1px solid rgba(255,255,255,.08)",
    borderRadius: "10px",
    background:
      "linear-gradient(180deg,#111318,#0d0f12)",
    display: "grid",
    alignContent: "center",
    gap: "5px",
  },

  summaryLabel: {
    color: "#717b89",
    fontSize: "10px",
    fontWeight: 950,
    letterSpacing:
      ".08em",
  },

  summaryValue: {
    color: "#f5f7fa",
    fontSize: "19px",
    fontVariantNumeric:
      "tabular-nums",
  },

  summaryValueHighlight: {
    color: "#ff7a1a",
  },

  summaryValueMoney: {
    color: "#ff9900",
  },

  lineupCard: {
    overflow: "hidden",
    border:
      "1px solid rgba(255,255,255,.085)",
    borderRadius: "10px",
    background:
      "#0d0f12",
  },

  lineupHeader: {
    minHeight: "74px",
    padding:
      "16px 20px",
    display: "flex",
    alignItems: "center",
    justifyContent:
      "space-between",
    gap: "16px",
    borderBottom:
      "1px solid rgba(255,255,255,.07)",
  },

  sectionTitle: {
    margin: 0,
    fontSize: "18px",
  },

  sectionSubtitle: {
    marginTop: "5px",
    color: "#76808d",
    fontSize: "11px",
    fontWeight: 800,
  },

  modeBadge: {
    padding:
      "6px 10px",
    border:
      "1px solid rgba(255,105,0,.45)",
    borderRadius:
      "999px",
    color: "#ff8a1d",
    background:
      "rgba(255,95,0,.07)",
    fontSize: "10px",
    fontWeight: 950,
  },

  tableWrap: {
    overflowX: "auto",
  },

  tableHeaderRow: {
    minWidth: "1050px",
    minHeight: "38px",
    padding:
      "0 16px",
    display: "grid",
    gridTemplateColumns:
      (
        "120px " +
        "minmax(330px,2.25fr) " +
        "115px 115px 95px 95px " +
        "130px 150px"
      ),
    alignItems: "center",
    gap: "12px",
    color: "#657188",
    fontSize: "9px",
    fontWeight: 950,
    letterSpacing:
      ".1em",
  },

  playerRow: {
    minWidth: "1050px",
    minHeight: "76px",
    padding:
      "10px 16px",
    display: "grid",
    gridTemplateColumns:
      (
        "120px " +
        "minmax(330px,2.25fr) " +
        "115px 115px 95px 95px " +
        "130px 150px"
      ),
    alignItems: "center",
    gap: "12px",
    borderTop:
      "1px solid rgba(255,255,255,.055)",
    transition:
      "background .2s ease",
  },

  playerRowLive: {
    background:
      (
        "linear-gradient(" +
        "90deg," +
        "rgba(255,88,15,.04)," +
        "rgba(255,255,255,0)" +
        ")"
      ),
  },

  slotCell: {
    display: "flex",
    alignItems: "center",
  },

  slotBadge: {
    minWidth: "48px",
    padding:
      "7px 9px",
    textAlign: "center",
    border:
      "1px solid rgba(255,87,0,.52)",
    borderRadius: "7px",
    color: "#ff8518",
    background:
      "rgba(255,78,0,.07)",
    fontSize: "11px",
    fontWeight: 950,
  },

  playerCell: {
    minWidth: 0,
    display: "grid",
    gap: "5px",
  },

  playerNameLine: {
    minWidth: 0,
    display: "flex",
    alignItems:
      "baseline",
    gap: "5px",
    flexWrap: "wrap",
  },

  playerName: {
    color: "#fff",
    fontSize: "14px",
  },

  playerMetaInline: {
    color: "#8d96a5",
    fontSize: "11px",
    fontWeight: 900,
  },

  statLine: {
    overflow: "hidden",
    textOverflow:
      "ellipsis",
    whiteSpace:
      "nowrap",
    color: "#687385",
    fontSize: "10px",
    fontWeight: 800,
  },

  statLineLive: {
    color: "#b3bbc7",
  },

  teamCell: {
    color: "#e9edf2",
    fontSize: "12px",
  },

  opponentCell: {
    color: "#dce2ea",
    fontSize: "12px",
  },

  numericCell: {
    color: "#c7e1ff",
    fontSize: "12px",
    fontVariantNumeric:
      "tabular-nums",
  },

  pointsCell: {
    color: "#fff",
    fontSize: "14px",
    fontVariantNumeric:
      "tabular-nums",
  },

  pointsCellLive: {
    color: "#ff8b2b",
  },

  salaryCell: {
    color: "#cce4ff",
    fontSize: "12px",
    fontVariantNumeric:
      "tabular-nums",
  },

  gameCell: {
    display: "flex",
    justifyContent:
      "flex-start",
  },

  gameBadge: {
    padding:
      "6px 9px",
    border:
      "1px solid rgba(255,255,255,.09)",
    borderRadius:
      "999px",
    color: "#718098",
    background:
      "rgba(255,255,255,.02)",
    fontSize: "9px",
    fontWeight: 950,
    whiteSpace:
      "nowrap",
  },

  gameBadgeLive: {
    color: "#49dc85",
    border:
      "1px solid rgba(73,220,133,.35)",
    background:
      "rgba(73,220,133,.06)",
  },

  gameBadgeFinal: {
    color: "#b9c0ca",
    border:
      "1px solid rgba(255,255,255,.12)",
  },

  totalRow: {
    minWidth: "1050px",
    minHeight: "54px",
    padding:
      "0 16px",
    display: "grid",
    gridTemplateColumns:
      (
        "120px " +
        "minmax(330px,2.25fr) " +
        "115px 115px 95px 95px " +
        "130px 150px"
      ),
    alignItems: "center",
    gap: "12px",
    borderTop:
      "1px solid rgba(255,112,25,.20)",
    background:
      "rgba(255,255,255,.015)",
  },

  totalPoints: {
    color: "#ff8a2a",
    fontSize: "16px",
    fontVariantNumeric:
      "tabular-nums",
  },

  totalStatus: {
    color: "#8d96a5",
    fontSize: "10px",
  },

  emptyState: {
    padding:
      "38px 20px",
    textAlign: "center",
    color: "#747d8a",
  },

  refreshNote: {
    color: "#747d8a",
    fontSize: "11px",
    textAlign: "right",
  },
};