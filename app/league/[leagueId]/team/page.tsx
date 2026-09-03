import Image from "next/image";
import Link from "next/link";

import Card from "@/components/ui/Card";

import TraditionalTeamNameEditor from "@/components/traditional/TraditionalTeamNameEditor";

import TraditionalLineupManager from "@/components/traditional/TraditionalLineupManager";

import {
  createSupabaseServerClient,
} from "@/lib/supabase/server";

import {
  getTraditionalTeamData,
} from "@/lib/traditional/team.service";

import {
  requireTraditionalLeague,
} from "@/lib/traditional/requireTraditionalLeague";


import InjuryReportButton from "@/components/ui/InjuryReportButton";

type PageProps = {
  params:
    Promise<{
      leagueId: string;
    }>;
};


function formatStatus(
  value: string
) {
  return value
    .replaceAll(
      "_",
      " "
    )
    .replace(
      /\b\w/g,
      (
        character
      ) =>
        character.toUpperCase()
    );
}


function getInjuryStyle(
  status:
    string |
    null
) {
  const normalized =
    (
      status ??
      ""
    ).toUpperCase();


  if (
    normalized.includes(
      "IR"
    ) ||
    normalized.includes(
      "OUT"
    )
  ) {
    return styles.injuryDanger;
  }


  return styles.injuryWarning;
}




function getInjuryDisplay(
  status:
    string |
    null |
    undefined,
  detail?:
    string |
    null
) {
  const normalized =
    (status ?? "")
      .trim()
      .toUpperCase();

  if (
    !normalized ||
    ["ACTIVE", "HEALTHY", "NORMAL"].includes(normalized)
  ) {
    return null;
  }

  let code: string;
  let label: string;

  if (normalized.includes("QUESTION") || normalized === "Q") {
    code = "Q";
    label = "Questionable";
  } else if (normalized.includes("DOUBT") || normalized === "D") {
    code = "D";
    label = "Doubtful";
  } else if (normalized === "O" || normalized.includes("OUT")) {
    code = "OUT";
    label = "Out";
  } else if (normalized.includes("INJURED RESERVE") || normalized === "IR") {
    code = "IR";
    label = "Injured Reserve";
  } else if (normalized.includes("PUP") || normalized.includes("PHYSICALLY UNABLE")) {
    code = "PUP";
    label = "Physically Unable to Perform";
  } else if (normalized.includes("NFI") || normalized.includes("NON-FOOTBALL")) {
    code = "NFI";
    label = "Non-Football Injury";
  } else if (normalized.includes("SUSPEND") || normalized === "SUS") {
    code = "SUSP";
    label = "Suspended";
  } else if (normalized.includes("DAY-TO-DAY") || normalized.includes("DAY TO DAY")) {
    code = "DTD";
    label = "Day-to-Day";
  } else {
    code = normalized.length <= 6 ? normalized : "INJ";
    label = status ?? "Injury status";
  }

  const cleanDetail = detail?.trim() || null;

  return {
    code,
    label,
    detail: cleanDetail,
    text: cleanDetail ? `${code} · ${cleanDetail}` : code,
  };
}


export default async function TraditionalTeamPage({
  params,
}: PageProps) {
  const {
    leagueId,
  } =
    await params;


  const access =
    await requireTraditionalLeague(
      leagueId
    );


  if (
    !access.fantasyTeam
  ) {
    return (
      <main
        style={
          styles.page
        }
      >

      <style>{`
        @media (max-width: 760px) {
          .g365-mobile-page-header,
          .g365-mobile-hero,
          .g365-mobile-week-header,
          .g365-mobile-section-header {
            align-items: flex-start !important;
            flex-direction: column !important;
            gap: 10px !important;
          }

          .g365-mobile-header-actions,
          .g365-mobile-week-nav,
          .g365-mobile-week-buttons {
            width: 100% !important;
            max-width: 100% !important;
            overflow-x: auto !important;
            flex-wrap: nowrap !important;
            -webkit-overflow-scrolling: touch;
          }

          .g365-mobile-summary-grid,
          .g365-mobile-team-grid,
          .g365-mobile-matchup-grid {
            grid-template-columns: repeat(2, minmax(0,1fr)) !important;
            gap: 8px !important;
          }

          .g365-mobile-player-row,
          .g365-mobile-team-row {
            min-width: 0 !important;
          }

          .g365-mobile-player-identity {
            min-width: 0 !important;
          }

          .g365-mobile-status-column {
            min-width: 0 !important;
          }

          .g365-mobile-week-viewport,
          .g365-mobile-table-wrap,
          .g365-mobile-lineup-viewport {
            width: 100% !important;
            max-width: 100% !important;
            overflow-x: auto !important;
            -webkit-overflow-scrolling: touch;
          }

          .g365-mobile-lineup-grid {
            min-width: 760px !important;
          }
        }

        @media (max-width: 430px) {
          .g365-mobile-summary-grid,
          .g365-mobile-team-grid,
          .g365-mobile-matchup-grid {
            grid-template-columns: minmax(0,1fr) !important;
          }

          .g365-mobile-player-row {
            gap: 8px !important;
          }
        }
      `}</style>
        <section
          style={
            styles.shell
          }
        >
          <Card
            style={
              styles.noTeamCard
            }
          >
            <p
              style={
                styles.eyebrow
              }
            >
              MY TEAM
            </p>

            <h1
              style={
                styles.title
              }
            >
              No Fantasy Team Assigned
            </h1>

            <p
              style={
                styles.description
              }
            >
              Your league membership is
              active, but you do not
              currently have an active
              Traditional fantasy team.
            </p>

            <Link
              href={
                `/league/${leagueId}`
              }
              style={
                styles.primaryLink
              }
            >
              Return to League Home
            </Link>
          </Card>
        </section>
      </main>
    );
  }


  const supabase =
    await createSupabaseServerClient();


  const teamData =
    await getTraditionalTeamData(
      supabase,
      leagueId,
      access.league.season,
      access.fantasyTeam.id
    );



  return (
    <main
      style={
        styles.page
      }
    >
      <section
        style={
          styles.shell
        }
      >
        {/* ==========================================
            PAGE HEADER
        =========================================== */}

        <header
          className="g365-mobile-page-header"
          style={styles.pageHeader}
        >
          <div>
            <p
              style={
                styles.eyebrow
              }
            >
              MY TEAM
            </p>

            <TraditionalTeamNameEditor
              leagueId={
                leagueId
              }
              fantasyTeamId={
                access
                  .fantasyTeam
                  .id
              }
              initialTeamName={
                access
                  .fantasyTeam
                  .teamName
              }
            />

            <p
              style={
                styles.description
              }
            >
              Week{" "}
              {teamData.activeWeek}

              {" • "}

              {formatStatus(
                teamData.phase
              )}
            </p>
          </div>


          <div
            className="g365-mobile-header-actions"
            style={styles.headerActions}
          >
            <Link
              href={
                `/league/${leagueId}/players`
              }
              style={
                styles.secondaryLink
              }
            >
              Players
            </Link>

            <Link
              href={
                `/league/${leagueId}/matchups`
              }
              style={
                styles.primaryLink
              }
            >
              Week{" "}
              {teamData.activeWeek}{" "}
              Matchup
            </Link>
          </div>
        </header>


        {/* ==========================================
            TEAM SUMMARY
        =========================================== */}

        <section
          className="g365-mobile-summary-grid"
          style={styles.summaryGrid}
        >
          <SummaryCard
            label="ROSTER"
            value={
              teamData.rosterCount
            }
            detail="Total players"
          />

          <SummaryCard
            label="STARTERS"
            value={
              teamData.startersCount
            }
            detail={`Week ${teamData.activeWeek}`}
          />

          <SummaryCard
            label="BENCH / IR"
            value={
              teamData.benchCount
            }
            detail="Non-starters"
          />

          <SummaryCard
            label="INJURY ALERTS"
            value={
              teamData.injuredCount
            }
            detail={
              teamData.injuredCount ===
              0
                ? "Roster clear"
                : "Review status"
            }
            good={
              teamData.injuredCount ===
              0
            }
          />
        </section>


        {/* ==========================================
            INTERACTIVE LINEUP MANAGER
        =========================================== */}

        <section>
          <div
            className="g365-mobile-section-header"
            style={styles.sectionHeader}
          >
            <div>
              <p
                style={
                  styles.sectionEyebrow
                }
              >
                LINEUP MANAGER
              </p>

              <h2
                style={
                  styles.sectionTitle
                }
              >
                Set Week{" "}
                {teamData.activeWeek}{" "}
                Lineup
              </h2>
            </div>


            <span
              style={
                styles.sectionMeta
              }
            >
              Select a player to move
            </span>
          </div>


          <TraditionalLineupManager
            leagueId={
              leagueId
            }

            fantasyTeamId={
              access
                .fantasyTeam
                .id
            }

            season={
              access.league.season
            }

            week={
              teamData.activeWeek
            }

            players={
              teamData.roster
            }

            rosterSettings={
              teamData.rosterSettings
            }
          />
        </section>



      </section>
    </main>
  );
}


function SummaryCard({
  label,
  value,
  detail,
  good,
}: {
  label: string;
  value: number;
  detail: string;
  good?: boolean;
}) {
  return (
    <Card
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

          ...(good === true
            ? styles.goodValue
            : {}),
        }}
      >
        {value}
      </strong>

      <span
        style={
          styles.summaryDetail
        }
      >
        {detail}
      </span>
    </Card>
  );
}


function PlayerRow({
  player,
}: {
  player: {
    playerId: number;

    fullName: string;

    position: string;

    teamAbbreviation:
      string | null;

    headshotUrl:
      string | null;

    lineupSlot:
      string | null;

    slotIndex:
      number | null;

    isLocked:
      boolean;

    injuryStatus:
      string | null;

    injuryDetail:
      string | null;
  };
}) {
  const injury =
    getInjuryDisplay(
      player.injuryStatus,
      player.injuryDetail
    );


  return (
    <article
      className="g365-mobile-player-row"
      style={styles.playerRow}
    >
      <div
        style={
          styles.slotColumn
        }
      >
        <strong
          style={
            styles.slotBadge
          }
        >
          {player.lineupSlot ??
            "BN"}
        </strong>

        {player.slotIndex !==
        null ? (
          <span
            style={
              styles.slotIndex
            }
          >
            #{player.slotIndex}
          </span>
        ) : null}
      </div>


      <div
        className="g365-mobile-player-identity"
        style={styles.playerIdentity}
      >
        <div
          style={
            styles.headshotWrap
          }
        >
          {player.headshotUrl ? (
            <Image
              src={
                player.headshotUrl
              }
              alt={
                player.fullName
              }
              width={54}
              height={54}
              style={
                styles.headshot
              }
            />
          ) : (
            <div
              aria-hidden="true"
              style={
                styles.headshotFallback
              }
            >
              {player.position}
            </div>
          )}
        </div>


        <div
          style={
            styles.playerText
          }
        >
          <div
            style={styles.playerNameRow}
          >
            <strong
              style={
                styles.playerName
              }
            >
              {player.fullName}
            </strong>

            {injury ? (
              <InjuryReportButton
                status={player.injuryStatus}
                injuryDetail={player.injuryDetail}
                playerName={player.fullName}
                buttonStyle={{
                  minWidth: 0,
                  padding: "3px 5px",
                  borderRadius: 5,
                  fontSize: 8,
                  lineHeight: 1,
                }}
              />
            ) : null}
          </div>

          <span
            style={
              styles.playerMeta
            }
          >
            {player.position}

            {player
              .teamAbbreviation
              ? ` • ${player.teamAbbreviation}`
              : ""}
          </span>
        </div>
      </div>


      <div
        className="g365-mobile-status-column"
        style={styles.statusColumn}
      >
        {player.isLocked ? (
          <span
            style={
              styles.lockedLabel
            }
          >
            LOCKED
          </span>
        ) : null}
      </div>
    </article>
  );
}


const styles = {
  page: {
    minHeight:
      "calc(100vh - 140px)",

    padding:
      "32px 18px 60px",

    background:
      "radial-gradient(circle at 50% 0%,rgba(255,67,0,.05),transparent 34%)",
  },


  shell: {
    width:
      "min(1240px,100%)",

    margin:
      "0 auto",

    display:
      "grid",

    gap:
      "28px",
  },


  pageHeader: {
    display:
      "flex",

    alignItems:
      "flex-end",

    justifyContent:
      "space-between",

    gap:
      "20px",

    flexWrap:
      "wrap" as const,
  },


  eyebrow: {
    margin:
      0,

    color:
      "#ff7a18",

    fontSize:
      "10px",

    fontWeight:
      900,

    letterSpacing:
      ".15em",
  },


  title: {
    margin:
      "7px 0 0",

    color:
      "#ffffff",

    fontSize:
      "36px",
  },


  description: {
    margin:
      "8px 0 0",

    color:
      "#8f96a3",

    fontSize:
      "13px",
  },


  headerActions: {
    display:
      "flex",

    gap:
      "8px",

    flexWrap:
      "wrap" as const,
  },


  primaryLink: {
    minHeight:
      "39px",

    padding:
      "0 15px",

    display:
      "inline-flex",

    alignItems:
      "center",

    justifyContent:
      "center",

    border:
      "1px solid rgba(255,100,15,.45)",

    borderRadius:
      "8px",

    background:
      "linear-gradient(135deg,#cf1616,#ff5100,#ff8500)",

    color:
      "#ffffff",

    fontSize:
      "10px",

    fontWeight:
      900,

    textDecoration:
      "none",
  },


  secondaryLink: {
    minHeight:
      "39px",

    padding:
      "0 15px",

    display:
      "inline-flex",

    alignItems:
      "center",

    justifyContent:
      "center",

    border:
      "1px solid rgba(255,255,255,.09)",

    borderRadius:
      "8px",

    background:
      "rgba(255,255,255,.035)",

    color:
      "#abb0b8",

    fontSize:
      "10px",

    fontWeight:
      900,

    textDecoration:
      "none",
  },


  summaryGrid: {
    display:
      "grid",

    gridTemplateColumns:
      "repeat(auto-fit,minmax(180px,1fr))",

    gap:
      "13px",
  },


  summaryCard: {
    minHeight:
      "128px",

    padding:
      "18px",

    display:
      "grid",

    alignContent:
      "center",

    gap:
      "6px",
  },


  summaryLabel: {
    color:
      "#747b85",

    fontSize:
      "8px",

    fontWeight:
      900,

    letterSpacing:
      ".11em",
  },


  summaryValue: {
    color:
      "#ffffff",

    fontSize:
      "28px",
  },


  summaryDetail: {
    color:
      "#858b95",

    fontSize:
      "10px",
  },


  goodValue: {
    color:
      "#42d982",
  },


  sectionHeader: {
    marginBottom:
      "11px",

    display:
      "flex",

    alignItems:
      "flex-end",

    justifyContent:
      "space-between",

    gap:
      "14px",

    flexWrap:
      "wrap" as const,
  },


  sectionEyebrow: {
    margin:
      0,

    color:
      "#ff7a18",

    fontSize:
      "8px",

    fontWeight:
      900,

    letterSpacing:
      ".12em",
  },


  sectionTitle: {
    margin:
      "4px 0 0",

    color:
      "#ffffff",

    fontSize:
      "20px",
  },


  sectionMeta: {
    color:
      "#787f89",

    fontSize:
      "10px",

    fontWeight:
      800,
  },


  rosterCard: {
    padding:
      "0",

    overflow:
      "hidden",
  },


  playerList: {
    display:
      "grid",
  },


  playerRow: {
    minHeight:
      "82px",

    padding:
      "11px 16px",

    display:
      "grid",

    gridTemplateColumns:
      "68px minmax(0,1fr) auto",

    alignItems:
      "center",

    gap:
      "14px",

    borderBottom:
      "1px solid rgba(255,255,255,.06)",
  },


  slotColumn: {
    display:
      "grid",

    justifyItems:
      "center",

    gap:
      "4px",
  },


  slotBadge: {
    minWidth:
      "42px",

    padding:
      "6px 7px",

    border:
      "1px solid rgba(255,102,20,.19)",

    borderRadius:
      "6px",

    background:
      "rgba(255,77,15,.065)",

    color:
      "#ff8120",

    fontSize:
      "9px",

    fontWeight:
      950,

    textAlign:
      "center" as const,
  },


  slotIndex: {
    color:
      "#626975",

    fontSize:
      "8px",

    fontWeight:
      800,
  },


  playerIdentity: {
    minWidth:
      0,

    display:
      "flex",

    alignItems:
      "center",

    gap:
      "12px",
  },


  headshotWrap: {
    width:
      "54px",

    height:
      "54px",

    flex:
      "0 0 auto",

    overflow:
      "hidden",

    border:
      "1px solid rgba(255,255,255,.08)",

    borderRadius:
      "50%",

    background:
      "linear-gradient(145deg,#202023,#0b0b0c)",
  },


  headshot: {
    width:
      "54px",

    height:
      "54px",

    objectFit:
      "cover" as const,
  },


  headshotFallback: {
    width:
      "100%",

    height:
      "100%",

    display:
      "flex",

    alignItems:
      "center",

    justifyContent:
      "center",

    color:
      "#747b85",

    fontSize:
      "9px",

    fontWeight:
      950,
  },


  playerText: {
    minWidth:
      0,

    display:
      "grid",

    gap:
      "4px",
  },


  playerNameRow: {
    minWidth:
      0,

    display:
      "flex",

    alignItems:
      "center",

    gap:
      "5px",
  },


  playerName: {
    overflow:
      "hidden",

    textOverflow:
      "ellipsis",

    whiteSpace:
      "nowrap" as const,

    color:
      "#ffffff",

    fontSize:
      "13px",
  },


  playerMeta: {
    color:
      "#7e858f",

    fontSize:
      "10px",

    fontWeight:
      700,
  },


  statusColumn: {
    display:
      "grid",

    justifyItems:
      "end",

    gap:
      "5px",
  },


  injuryBadge: {
    maxWidth:
      "120px",

    padding:
      "5px 7px",

    overflow:
      "hidden",

    textOverflow:
      "ellipsis",

    whiteSpace:
      "nowrap" as const,

    borderRadius:
      "5px",

    fontSize:
      "8px",

    fontWeight:
      950,

    letterSpacing:
      ".03em",
  },


  injuryDanger: {
    border:
      "1px solid rgba(255,60,60,.22)",

    background:
      "rgba(210,30,30,.10)",

    color:
      "#ff6868",
  },


  injuryWarning: {
    border:
      "1px solid rgba(255,145,0,.22)",

    background:
      "rgba(255,130,0,.08)",

    color:
      "#ff9a2c",
  },


  healthyBadge: {
    padding:
      "5px 7px",

    border:
      "1px solid rgba(60,215,130,.18)",

    borderRadius:
      "5px",

    background:
      "rgba(35,190,100,.07)",

    color:
      "#43d883",

    fontSize:
      "8px",

    fontWeight:
      950,
  },


  lockedLabel: {
    color:
      "#777e88",

    fontSize:
      "7px",

    fontWeight:
      900,

    letterSpacing:
      ".08em",
  },


  emptyState: {
    minHeight:
      "150px",

    padding:
      "24px",

    display:
      "grid",

    alignContent:
      "center",

    gap:
      "7px",

    color:
      "#ffffff",
  },


  noTeamCard: {
    maxWidth:
      "700px",

    margin:
      "40px auto",

    padding:
      "28px",
  },
};