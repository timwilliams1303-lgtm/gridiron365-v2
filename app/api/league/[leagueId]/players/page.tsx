import Card from "@/components/ui/Card";

import TraditionalPlayersBrowser from "@/components/traditional/TraditionalPlayersBrowser";

import {
  createSupabaseServerClient,
} from "@/lib/supabase/server";

import {
  getTraditionalPlayersData,
} from "@/lib/traditional/players.service";

import {
  requireTraditionalLeague,
} from "@/lib/traditional/requireTraditionalLeague";


type PageProps = {
  params:
    Promise<{
      leagueId: string;
    }>;
};


export default async function TraditionalPlayersPage({
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
    await getTraditionalPlayersData(
      supabase,
      leagueId,
      access.league.season,
      access.fantasyTeam
        ?.id ??
        null
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
              PLAYER CENTER
            </p>

            <h1
              style={
                styles.title
              }
            >
              Players
            </h1>

            <p
              style={
                styles.subtitle
              }
            >
              Search the NFL player pool,
              review injuries, check
              availability, and manage
              your Traditional fantasy
              roster.
            </p>
          </div>


          <div
            style={
              styles.headerMeta
            }
          >
            <div
              style={
                styles.metaBox
              }
            >
              <span
                style={
                  styles.metaLabel
                }
              >
                CURRENT WEEK
              </span>

              <strong
                style={
                  styles.metaValue
                }
              >
                Week{" "}
                {data.activeWeek}
              </strong>
            </div>


            <div
              style={
                styles.metaBox
              }
            >
              <span
                style={
                  styles.metaLabel
                }
              >
                WAIVERS
              </span>

              <strong
                style={
                  styles.metaValue
                }
              >
                {formatValue(
                  data.waiverType
                )}
              </strong>
            </div>
          </div>
        </header>


        {/* ==========================================
            SUMMARY CARDS
        =========================================== */}

        <section
          style={
            styles.summaryGrid
          }
        >
          <SummaryCard
            label="PLAYER POOL"
            value={
              data.totalPlayers
            }
            detail="Fantasy eligible"
          />


          <SummaryCard
            label="FREE AGENTS"
            value={
              data.freeAgents
            }
            detail="Available"
            good
          />


          <SummaryCard
            label="ROSTERED"
            value={
              data.rosteredPlayers
            }
            detail="League-owned"
          />


          <SummaryCard
            label="INJURY REPORT"
            value={
              data.injuredPlayers
            }
            detail="Current alerts"
          />
        </section>


        {/* ==========================================
            PLAYER BROWSER
        =========================================== */}

        <TraditionalPlayersBrowser
          leagueId={
            leagueId
          }

          fantasyTeamId={
            access.fantasyTeam
              ?.id ??
            null
          }

          season={
            access.league.season
          }

          week={
            data.activeWeek
          }

          waiverType={
            data.waiverType
          }

          players={
            data.players
          }

          teams={
            data.teams
          }
        />
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

          ...(good
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
      "26px",
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


  subtitle: {
    maxWidth:
      "650px",

    margin:
      "8px 0 0",

    color:
      "#8f96a3",

    fontSize:
      "13px",

    lineHeight:
      1.5,
  },


  headerMeta: {
    display:
      "flex",

    gap:
      "9px",

    flexWrap:
      "wrap" as const,
  },


  metaBox: {
    minWidth:
      "130px",

    padding:
      "11px 14px",

    display:
      "grid",

    gap:
      "4px",

    border:
      "1px solid rgba(255,135,0,.16)",

    borderRadius:
      "9px",

    background:
      "rgba(255,85,0,.04)",
  },


  metaLabel: {
    color:
      "#707781",

    fontSize:
      "7px",

    fontWeight:
      900,

    letterSpacing:
      ".09em",
  },


  metaValue: {
    color:
      "#ff8724",

    fontSize:
      "11px",
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
      "27px",
  },


  summaryDetail: {
    color:
      "#838a94",

    fontSize:
      "10px",
  },


  goodValue: {
    color:
      "#42d982",
  },
};