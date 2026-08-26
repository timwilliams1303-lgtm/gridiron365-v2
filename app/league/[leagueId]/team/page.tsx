import Image from "next/image";
import Link from "next/link";

import Card from "@/components/ui/Card";

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


  const starters =
    teamData.roster.filter(
      (
        player
      ) =>
        player.isStarter
    );


  const bench =
    teamData.roster.filter(
      (
        player
      ) =>
        !player.isStarter
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
          style={
            styles.pageHeader
          }
        >
          <div>
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
              {access
                .fantasyTeam
                .teamName}
            </h1>

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
            style={
              styles.headerActions
            }
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
          style={
            styles.summaryGrid
          }
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
            style={
              styles.sectionHeader
            }
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


        {/* ==========================================
            CURRENT STARTERS
        =========================================== */}

        <section>
          <div
            style={
              styles.sectionHeader
            }
          >
            <div>
              <p
                style={
                  styles.sectionEyebrow
                }
              >
                CURRENT LINEUP
              </p>

              <h2
                style={
                  styles.sectionTitle
                }
              >
                Starting Lineup
              </h2>
            </div>

            <span
              style={
                styles.sectionMeta
              }
            >
              {starters.length} starter
              {starters.length ===
              1
                ? ""
                : "s"}
            </span>
          </div>


          <Card
            style={
              styles.rosterCard
            }
          >
            {starters.length >
            0 ? (
              <div
                style={
                  styles.playerList
                }
              >
                {starters.map(
                  (
                    player
                  ) => (
                    <PlayerRow
                      key={
                        player.playerId
                      }

                      player={
                        player
                      }
                    />
                  )
                )}
              </div>
            ) : (
              <div
                style={
                  styles.emptyState
                }
              >
                <strong>
                  No starting lineup
                  prepared
                </strong>

                <span>
                  Week{" "}
                  {teamData.activeWeek}{" "}
                  starting lineup slots
                  will appear here once
                  players are assigned.
                </span>
              </div>
            )}
          </Card>
        </section>


        {/* ==========================================
            CURRENT BENCH
        =========================================== */}

        <section>
          <div
            style={
              styles.sectionHeader
            }
          >
            <div>
              <p
                style={
                  styles.sectionEyebrow
                }
              >
                ROSTER
              </p>

              <h2
                style={
                  styles.sectionTitle
                }
              >
                Bench & Reserve
              </h2>
            </div>

            <span
              style={
                styles.sectionMeta
              }
            >
              {bench.length} player
              {bench.length ===
              1
                ? ""
                : "s"}
            </span>
          </div>


          <Card
            style={
              styles.rosterCard
            }
          >
            {bench.length >
            0 ? (
              <div
                style={
                  styles.playerList
                }
              >
                {bench.map(
                  (
                    player
                  ) => (
                    <PlayerRow
                      key={
                        player.playerId
                      }

                      player={
                        player
                      }
                    />
                  )
                )}
              </div>
            ) : (
              <div
                style={
                  styles.emptyState
                }
              >
                <strong>
                  No bench players
                </strong>

                <span>
                  Players not assigned to
                  a starting slot will
                  appear here.
                </span>
              </div>
            )}
          </Card>
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
  return (
    <article
      style={
        styles.playerRow
      }
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
        style={
          styles.playerIdentity
        }
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
          <strong
            style={
              styles.playerName
            }
          >
            {player.fullName}
          </strong>

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
        style={
          styles.statusColumn
        }
      >
        {player.injuryStatus ? (
          <span
            title={
              player.injuryDetail ??
              player.injuryStatus
            }
            style={{
              ...styles.injuryBadge,
              ...getInjuryStyle(
                player.injuryStatus
              ),
            }}
          >
            {player.injuryStatus}
          </span>
        ) : (
          <span
            style={
              styles.healthyBadge
            }
          >
            ACTIVE
          </span>
        )}


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