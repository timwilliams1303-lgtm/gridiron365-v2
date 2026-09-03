import Link from "next/link";

import Card from "@/components/ui/Card";

import TraditionalWaiverClaims from "@/components/traditional/TraditionalWaiverClaims";

import {
  createSupabaseServerClient,
} from "@/lib/supabase/server";

import {
  getTraditionalWaiversData,
} from "@/lib/traditional/waivers.service";

import {
  requireTraditionalLeague,
} from "@/lib/traditional/requireTraditionalLeague";


type PageProps = {
  params:
    Promise<{
      leagueId: string;
    }>;
};


function formatValue(
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


function formatDateTime(
  value:
    string |
    null
) {
  if (!value) {
    return "—";
  }


  const date =
    new Date(
      value
    );


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "—";
  }


  return date.toLocaleString(
    undefined,
    {
      month:
        "short",

      day:
        "numeric",

      hour:
        "numeric",

      minute:
        "2-digit",
    }
  );
}


export default async function TraditionalWaiversPage({
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


  const supabase =
    await createSupabaseServerClient();


  const data =
    await getTraditionalWaiversData(
      supabase,
      leagueId,
      access.league.season,
      access.fantasyTeam
        ?.id ??
        null
    );


  return (
    <main
      className="g365-waivers-page"
      style={
        styles.page
      }
    >
      <style>{mobileCss}</style>
      <section
        className="g365-waivers-shell"
        style={
          styles.shell
        }
      >
        {/* ==========================================
            PAGE HEADER
        =========================================== */}

        <header
          className="g365-waivers-header"
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
              WAIVER CENTER
            </p>

            <h1
              style={
                styles.title
              }
            >
              Waivers
            </h1>

            <p
              style={
                styles.subtitle
              }
            >
              Manage your private
              pending claims and review
              league-wide waiver results
              after processing.
            </p>
          </div>


          <Link
            href={
              `/league/${leagueId}/players`
            }
            style={
              styles.primaryLink
            }
          >
            Browse Players
          </Link>
        </header>


        {/* ==========================================
            SUMMARY
        =========================================== */}

        <section
          className="g365-waivers-summary"
          style={
            styles.summaryGrid
          }
        >
          <SummaryCard
            label="WAIVER TYPE"
            value={
              formatValue(
                data.settings
                  .waiverType
              )
            }
            detail="League setting"
          />


          <SummaryCard
            label="WAIVER PERIOD"
            value={`${data.settings.waiverPeriodHours}h`}
            detail="Player hold time"
          />


          <SummaryCard
            label="MY PENDING"
            value={
              String(
                data.myPendingClaims
              )
            }
            detail="Private open claims"
            accent
          />


          <SummaryCard
            label="CURRENT PRIORITY"
            value={
              data.currentPriority !==
              null
                ? `#${data.currentPriority}`
                : "—"
            }
            detail="Rolling waiver order"
          />
        </section>


        {/* ==========================================
            PRIVATE PENDING CLAIMS
        =========================================== */}

        <section>
          <div
            className="g365-waivers-section-header"
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
                PRIVATE
              </p>

              <h2
                style={
                  styles.sectionTitle
                }
              >
                My Pending Claims
              </h2>

              <p
                style={
                  styles.sectionDescription
                }
              >
                These claims are visible
                only to you until waivers
                are processed.
              </p>
            </div>


            <span
              style={
                styles.sectionMeta
              }
            >
              Week{" "}
              {data.activeWeek}
            </span>
          </div>


          <Card
            style={
              styles.claimCard
            }
          >
            <TraditionalWaiverClaims
              leagueId={
                leagueId
              }
              claims={
                data.pendingClaims
              }
            />
          </Card>
        </section>


        {/* ==========================================
            LEAGUE-WIDE RESULTS
        =========================================== */}

        <section>
          <div
            className="g365-waivers-section-header"
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
                LEAGUE RESULTS
              </p>

              <h2
                style={
                  styles.sectionTitle
                }
              >
                Waiver Results
              </h2>

              <p
                style={
                  styles.sectionDescription
                }
              >
                Completed waiver results
                are visible to the entire
                league.
              </p>
            </div>
          </div>


          <Card
            style={
              styles.claimCard
            }
          >
            {data
              .processedClaims
              .length >
            0 ? (
              <div
                className="g365-waivers-results-scroll"
                style={
                  styles.claimList
                }
              >
                {data
                  .processedClaims
                  .map(
                    (
                      claim
                    ) => (
                      <article
                        key={
                          claim.claimId
                        }
                        className="g365-waivers-history-row"
                        style={
                          styles.historyRow
                        }
                      >
                        <div>
                          <strong
                            style={
                              styles.playerName
                            }
                          >
                            {claim
                              .playerName}
                          </strong>

                          <span
                            style={
                              styles.historyMeta
                            }
                          >
                            {claim
                              .fantasyTeamName}
                          </span>

                          {claim
                            .dropPlayerName ? (
                            <span
                              style={
                                styles.historyDrop
                              }
                            >
                              Drop:{" "}
                              {claim
                                .dropPlayerName}
                            </span>
                          ) : null}
                        </div>


                        <div
                          style={
                            styles.historyDetails
                          }
                        >
                          <span
                            style={
                              styles.historyLabel
                            }
                          >
                            PROCESSED
                          </span>

                          <strong
                            style={
                              styles.historyValue
                            }
                          >
                            {formatDateTime(
                              claim
                                .processedAt
                            )}
                          </strong>
                        </div>


                        <div
                          style={
                            styles.historyDetails
                          }
                        >
                          <span
                            style={
                              styles.historyLabel
                            }
                          >
                            PRIORITY
                          </span>

                          <strong
                            style={
                              styles.historyValue
                            }
                          >
                            {claim
                              .priority ??
                              "—"}
                          </strong>
                        </div>


                        <div
                          style={
                            styles.historyDetails
                          }
                        >
                          <span
                            style={
                              styles.historyLabel
                            }
                          >
                            RESULT
                          </span>

                          <span
                            style={
                              claim.status ===
                              "won"
                                ? styles.wonBadge
                                : claim.status ===
                                    "failed"
                                  ? styles.failedBadge
                                  : claim.status ===
                                      "cancelled"
                                    ? styles.cancelledBadge
                                    : styles.resultBadge
                            }
                          >
                            {formatValue(
                              claim.status
                            )}
                          </span>
                        </div>
                      </article>
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
                  No processed waiver
                  results yet
                </strong>

                <span>
                  Once waivers process,
                  league-wide results
                  will appear here.
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
  accent,
}: {
  label: string;

  value: string;

  detail: string;

  accent?: boolean;
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

          ...(accent
            ? styles.accentValue
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



const mobileCss = `
@media (max-width: 760px) {
  .g365-waivers-page {
    width: 100% !important;
    max-width: 100% !important;
    min-width: 0 !important;
    padding: 12px 8px 32px !important;
    overflow-x: hidden !important;
    box-sizing: border-box !important;
  }

  .g365-waivers-page *,
  .g365-waivers-page *::before,
  .g365-waivers-page *::after {
    box-sizing: border-box;
  }

  .g365-waivers-shell {
    width: 100% !important;
    max-width: 100% !important;
    min-width: 0 !important;
    margin-left: 0 !important;
    margin-right: 0 !important;
  }

  .g365-waivers-shell > *,
  .g365-waivers-shell > section,
  .g365-waivers-shell > section > *,
  .g365-waivers-header,
  .g365-waivers-summary,
  .g365-waivers-section-header {
    width: 100% !important;
    max-width: 100% !important;
    min-width: 0 !important;
  }

  .g365-waivers-header > div,
  .g365-waivers-section-header > div {
    min-width: 0 !important;
    max-width: 100% !important;
  }

  .g365-waivers-header p,
  .g365-waivers-section-header p,
  .g365-waivers-section-header h2 {
    max-width: 100% !important;
    white-space: normal !important;
    overflow-wrap: anywhere !important;
    word-break: normal !important;
  }

  .g365-waivers-header > div > p:first-child { font-size: 8px !important; letter-spacing: .11em !important; }
  .g365-waivers-header h1 { font-size: 25px !important; line-height: 1.05 !important; margin-top: 4px !important; }
  .g365-waivers-header > div > p:last-child { font-size: 10px !important; line-height: 1.35 !important; margin-top: 5px !important; max-width: 100% !important; }

  .g365-waivers-shell {
    min-width: 0 !important;
    gap: 15px !important;
  }

  .g365-waivers-header {
    display: grid !important;
    grid-template-columns: 1fr !important;
    align-items: stretch !important;
  }

  .g365-waivers-header > a {
    width: 100% !important;
    max-width: 100% !important;
    min-width: 0 !important;
    box-sizing: border-box !important;
    min-height: 38px !important;
    padding: 0 12px !important;
    font-size: 9px !important;
  }

  .g365-waivers-summary {
    grid-template-columns: repeat(2,minmax(0,1fr)) !important;
    gap: 7px !important;
  }

  .g365-waivers-summary > * { min-height: 78px !important; padding: 10px !important; }
  .g365-waivers-summary > * > span:first-child { font-size: 7px !important; letter-spacing: .07em !important; }
  .g365-waivers-summary > * > strong { font-size: 18px !important; line-height: 1.05 !important; }
  .g365-waivers-summary > * > span:last-child { font-size: 8px !important; line-height: 1.2 !important; }

  .g365-waivers-section-header {
    align-items: flex-start !important;
    margin-bottom: 7px !important;
    gap: 7px !important;
  }
  .g365-waivers-section-header p:first-child { font-size: 7px !important; }
  .g365-waivers-section-header h2 { font-size: 16px !important; line-height: 1.1 !important; margin-top: 2px !important; }
  .g365-waivers-section-header h2 + p { font-size: 8px !important; line-height: 1.35 !important; margin-top: 3px !important; }
  .g365-waivers-section-header > span { font-size: 8px !important; }

  .g365-waivers-results-scroll {
    display: block !important;
    width: 100% !important;
    max-width: 100% !important;
    min-width: 0 !important;
    overflow-x: scroll !important;
    overflow-y: hidden !important;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior-x: contain;
    touch-action: pan-x pan-y;
  }

  .g365-waivers-history-row {
    grid-template-columns: minmax(0,1fr) minmax(95px,.7fr) 70px 84px !important;
    gap: 10px !important;
    min-width: 620px !important;
  }

  .g365-waivers-history-row > div {
    min-width: 0 !important;
  }
}


@media (max-height: 600px) and (orientation: landscape) and (max-width: 950px) {
  .g365-waivers-page {
    width: 100% !important;
    max-width: 100vw !important;
    min-width: 0 !important;
    padding: 14px 10px 34px !important;
    overflow-x: hidden !important;
  }

  .g365-waivers-shell,
  .g365-waivers-shell > section {
    width: 100% !important;
    max-width: 100% !important;
    min-width: 0 !important;
  }

  .g365-waivers-header {
    display: grid !important;
    grid-template-columns: minmax(0,1fr) auto !important;
    align-items: end !important;
  }

  .g365-waivers-header h1 { font-size: 24px !important; }
  .g365-waivers-header > div > p:last-child { font-size: 10px !important; margin-top: 4px !important; }
  .g365-waivers-header > a { min-height: 36px !important; font-size: 9px !important; padding: 0 12px !important; }
  .g365-waivers-shell { gap: 14px !important; }
  .g365-waivers-summary { gap: 7px !important; }
  .g365-waivers-summary > * { min-height: 72px !important; padding: 9px !important; }
  .g365-waivers-summary > * > strong { font-size: 17px !important; }
  .g365-waivers-section-header { margin-bottom: 6px !important; }
  .g365-waivers-section-header h2 { font-size: 15px !important; }

  .g365-waivers-summary {
    grid-template-columns: repeat(4,minmax(0,1fr)) !important;
  }

  .g365-waivers-results-scroll {
    display: block !important;
    width: 100% !important;
    max-width: 100% !important;
    min-width: 0 !important;
    overflow-x: scroll !important;
    overflow-y: hidden !important;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior-x: contain;
    touch-action: pan-x pan-y;
  }

  .g365-waivers-history-row {
    min-width: 720px !important;
  }
}

@media (max-width: 430px) {
  .g365-waivers-summary {
    grid-template-columns: 1fr !important;
  }
}
`;

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
      "18px",

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


  subtitle: {
    maxWidth:
      "680px",

    margin:
      "8px 0 0",

    color:
      "#8f96a3",

    fontSize:
      "13px",

    lineHeight:
      1.5,
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
      "120px",

    padding:
      "18px",

    display:
      "grid",

    alignContent:
      "center",

    gap:
      "5px",
  },


  summaryLabel: {
    color:
      "#747b85",

    fontSize:
      "8px",

    fontWeight:
      900,

    letterSpacing:
      ".10em",
  },


  summaryValue: {
    color:
      "#ffffff",

    fontSize:
      "24px",
  },


  summaryDetail: {
    color:
      "#838a94",

    fontSize:
      "10px",
  },


  accentValue: {
    color:
      "#ff9129",
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


  sectionDescription: {
    maxWidth:
      "620px",

    margin:
      "5px 0 0",

    color:
      "#777e88",

    fontSize:
      "9px",

    lineHeight:
      1.45,
  },


  sectionMeta: {
    color:
      "#787f89",

    fontSize:
      "10px",
  },


  claimCard: {
    padding:
      0,

    overflow:
      "visible",
  },


  claimList: {
    display:
      "grid",
  },


  historyRow: {
    minHeight:
      "68px",

    padding:
      "12px 15px",

    display:
      "grid",

    gridTemplateColumns:
      "minmax(220px,1.7fr) minmax(130px,1fr) 90px 100px",

    alignItems:
      "center",

    gap:
      "14px",

    borderBottom:
      "1px solid rgba(255,255,255,.055)",
  },


  playerName: {
    color:
      "#ffffff",

    fontSize:
      "12px",
  },


  historyMeta: {
    display:
      "block",

    marginTop:
      "3px",

    color:
      "#727983",

    fontSize:
      "8px",
  },


  historyDrop: {
    display:
      "block",

    marginTop:
      "3px",

    color:
      "#ff9560",

    fontSize:
      "8px",
  },


  historyDetails: {
    minWidth:
      0,

    display:
      "grid",

    gap:
      "3px",
  },


  historyLabel: {
    color:
      "#626974",

    fontSize:
      "7px",

    fontWeight:
      900,

    letterSpacing:
      ".06em",
  },


  historyValue: {
    overflow:
      "hidden",

    textOverflow:
      "ellipsis",

    whiteSpace:
      "nowrap" as const,

    color:
      "#d8dbe0",

    fontSize:
      "9px",
  },


  wonBadge: {
    color:
      "#42d982",

    fontSize:
      "8px",

    fontWeight:
      950,
  },


  failedBadge: {
    color:
      "#ff6969",

    fontSize:
      "8px",

    fontWeight:
      950,
  },


  cancelledBadge: {
    color:
      "#ff9a3d",

    fontSize:
      "8px",

    fontWeight:
      950,
  },


  resultBadge: {
    color:
      "#898f98",

    fontSize:
      "8px",

    fontWeight:
      950,
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
      "6px",

    color:
      "#ffffff",
  },
};