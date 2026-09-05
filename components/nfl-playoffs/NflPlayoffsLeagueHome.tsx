import Link from "next/link";

import {
  createSupabaseServerClient,
} from "@/lib/supabase/server";

import {
  requireLeagueMember,
} from "@/lib/leagues/requireLeagueMember";


type Props = {
  leagueId: string;
};


type LeagueStateRow = {
  active_round:
    number |
    null;

  status:
    string |
    null;

  champion_fantasy_team_id:
    number |
    null;

  completed_at:
    string |
    null;
};


type RoundRow = {
  round_number:
    number;

  round_name:
    string |
    null;

  status:
    string |
    null;

  first_kickoff_at:
    string |
    null;

  last_scheduled_kickoff_at:
    string |
    null;

  finalized_at:
    string |
    null;
};


type EntryRow = {
  fantasy_team_id:
    number;

  round_number:
    number;

  status:
    string |
    null;

  fantasy_points:
    number |
    string |
    null;

  projected_points:
    number |
    string |
    null;
};


type StandingRow = {
  fantasy_team_id:
    number;

  total_points:
    number |
    string |
    null;

  rank:
    number |
    null;
};


type TeamRow = {
  id:
    number;

  team_name:
    string;
};


function safeNumber(
  value:
    number |
    string |
    null |
    undefined
) {
  const parsed =
    Number(
      value ??
      0
    );

  return Number.isFinite(
    parsed
  )
    ? parsed
    : 0;
}


function roundName(
  roundNumber:
    number
) {
  switch (
    roundNumber
  ) {
    case 1:
      return "Wild Card";

    case 2:
      return "Divisional";

    case 3:
      return "Conference Championships";

    case 4:
      return "Super Bowl";

    default:
      return `Round ${roundNumber}`;
  }
}


function prettyStatus(
  value:
    string |
    null |
    undefined
) {
  if (!value) {
    return "Setup";
  }

  return value
    .replace(
      /_/g,
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


function formatDate(
  value:
    string |
    null |
    undefined
) {
  if (!value) {
    return "TBD";
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
    return "TBD";
  }

  return new Intl.DateTimeFormat(
    "en-US",
    {
      weekday:
        "short",

      month:
        "short",

      day:
        "numeric",

      hour:
        "numeric",

      minute:
        "2-digit",
    }
  ).format(
    date
  );
}


export default async function NflPlayoffsLeagueHome({
  leagueId,
}: Props) {
  const access =
    await requireLeagueMember(
      leagueId
    );


  const supabase =
    await createSupabaseServerClient();


  const season =
    access.league.season;


  const fantasyTeamId =
    access.fantasyTeam?.id ??
    null;


  const isSalary =
    access.league
      .playerSelectionMode ===
    "salary";


  const [
    stateResult,
    roundsResult,
    teamsResult,
    standingsResult,
  ] =
    await Promise.all([
      supabase
        .from(
          "nfl_playoff_league_state"
        )
        .select(`
          active_round,
          status,
          champion_fantasy_team_id,
          completed_at
        `)
        .eq(
          "league_id",
          leagueId
        )
        .eq(
          "season",
          season
        )
        .maybeSingle(),

      supabase
        .from(
          "nfl_playoff_rounds"
        )
        .select(`
          round_number,
          round_name,
          status,
          first_kickoff_at,
          last_scheduled_kickoff_at,
          finalized_at
        `)
        .eq(
          "league_id",
          leagueId
        )
        .eq(
          "season",
          season
        )
        .order(
          "round_number",
          {
            ascending:
              true,
          }
        ),

      supabase
        .from(
          "fantasy_teams"
        )
        .select(`
          id,
          team_name
        `)
        .eq(
          "league_id",
          leagueId
        )
        .eq(
          "active",
          true
        )
        .order(
          "team_name",
          {
            ascending:
              true,
          }
        ),

      supabase
        .from(
          "nfl_playoff_standings"
        )
        .select(`
          fantasy_team_id,
          total_points,
          rank
        `)
        .eq(
          "league_id",
          leagueId
        )
        .eq(
          "season",
          season
        ),
    ]);


  if (
    stateResult.error
  ) {
    throw new Error(
      `Could not load NFL Playoffs league state: ${stateResult.error.message}`
    );
  }


  if (
    roundsResult.error
  ) {
    throw new Error(
      `Could not load NFL Playoffs rounds: ${roundsResult.error.message}`
    );
  }


  if (
    teamsResult.error
  ) {
    throw new Error(
      `Could not load NFL Playoffs teams: ${teamsResult.error.message}`
    );
  }


  if (
    standingsResult.error
  ) {
    throw new Error(
      `Could not load NFL Playoffs standings: ${standingsResult.error.message}`
    );
  }


  const state =
    stateResult.data as
      LeagueStateRow |
      null;


  const rounds =
    (roundsResult.data ??
      []) as
      RoundRow[];


  const teams =
    (teamsResult.data ??
      []) as
      TeamRow[];


  const standings =
    (standingsResult.data ??
      []) as
      StandingRow[];


  const activeRound =
    Math.min(
      4,
      Math.max(
        1,
        Number(
          state
            ?.active_round ??
            1
        )
      )
    );


  const activeRoundRow =
    rounds.find(
      (
        round
      ) =>
        round.round_number ===
        activeRound
    ) ??
    null;


  const finalizedRounds =
    rounds.filter(
      (
        round
      ) =>
        Boolean(
          round.finalized_at
        ) ||
        round.status ===
          "final"
    );


  let myEntry:
    EntryRow |
    null =
    null;


  if (
    fantasyTeamId
  ) {
    const {
      data:
        entryData,

      error:
        entryError,
    } =
      await supabase
        .from(
          "nfl_playoff_round_entries"
        )
        .select(`
          fantasy_team_id,
          round_number,
          status,
          fantasy_points,
          projected_points
        `)
        .eq(
          "league_id",
          leagueId
        )
        .eq(
          "season",
          season
        )
        .eq(
          "round_number",
          activeRound
        )
        .eq(
          "fantasy_team_id",
          fantasyTeamId
        )
        .maybeSingle();


    if (
      entryError
    ) {
      throw new Error(
        `Could not load your NFL Playoffs entry: ${entryError.message}`
      );
    }


    myEntry =
      entryData as
        EntryRow |
        null;
  }


  const myStanding =
    fantasyTeamId
      ? standings.find(
          (
            row
          ) =>
            row
              .fantasy_team_id ===
            fantasyTeamId
        ) ??
        null
      : null;


  const myTeam =
    fantasyTeamId
      ? teams.find(
          (
            team
          ) =>
            team.id ===
            fantasyTeamId
        ) ??
        null
      : null;


  const leagueComplete =
    Boolean(
      state?.completed_at
    ) ||
    state?.status ===
      "complete" ||
    finalizedRounds.length >=
      4;


  return (
    <main
      className="g365-nflp-home"
      style={{
        display:
          "grid",

        gap:
          18,

        width:
          "100%",

        padding:
          "22px 18px 40px",

        boxSizing:
          "border-box",
      }}
    >
      <style>{`
        .g365-nflp-home * {
          box-sizing: border-box;
        }

        .g365-nflp-home-hero {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 22px;
        }

        .g365-nflp-home-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }

        .g365-nflp-home-stats {
          display: grid;
          grid-template-columns: repeat(4,minmax(0,1fr));
          gap: 12px;
        }

        .g365-nflp-home-rounds {
          display: grid;
          grid-template-columns: repeat(4,minmax(0,1fr));
          gap: 12px;
        }

        .g365-nflp-home-links {
          display: grid;
          grid-template-columns: repeat(3,minmax(0,1fr));
          gap: 12px;
        }

        @media (max-width: 1000px) {
          .g365-nflp-home-stats,
          .g365-nflp-home-rounds {
            grid-template-columns:
              repeat(2,minmax(0,1fr));
          }

          .g365-nflp-home-links {
            grid-template-columns:
              repeat(2,minmax(0,1fr));
          }
        }

        @media (max-width: 700px) {
          .g365-nflp-home {
            padding:
              14px 11px 34px !important;
          }

          .g365-nflp-home-hero {
            flex-direction:
              column;
          }

          .g365-nflp-home-actions {
            width:
              100%;
          }

          .g365-nflp-home-actions a {
            flex:
              1 1 145px;
            text-align:
              center;
          }

          .g365-nflp-home-stats,
          .g365-nflp-home-rounds,
          .g365-nflp-home-links {
            grid-template-columns:
              1fr;
          }
        }
      `}</style>


      <section
        className="g365-nflp-home-hero"
        style={{
          padding:
            22,

          border:
            "1px solid rgba(255,91,26,.34)",

          borderRadius:
            18,

          background:
            "linear-gradient(135deg,rgba(120,8,12,.48),rgba(16,16,19,.98) 54%,rgba(145,50,0,.32))",

          boxShadow:
            "0 20px 50px rgba(0,0,0,.28)",
        }}
      >
        <div>
          <div
            style={{
              color:
                "#ff7627",

              fontSize:
                12,

              fontWeight:
                1000,

              letterSpacing:
                ".13em",

              textTransform:
                "uppercase",
            }}
          >
            G365 NFL PLAYOFFS
          </div>


          <h2
            style={{
              margin:
                "7px 0 8px",

              color:
                "#fff",

              fontSize:
                "clamp(30px,5vw,48px)",

              lineHeight:
                1,
            }}
          >
            {
              access.league
                .name
            }
          </h2>


          <p
            style={{
              margin:
                0,

              color:
                "#b7bac2",

              lineHeight:
                1.65,
            }}
          >
            {season}
            {" · "}
            {isSalary
              ? "Salary Cap"
              : "No Salary Cap"}
            {" · "}
            {leagueComplete
              ? "Postseason Complete"
              : `${roundName(
                  activeRound
                )} is the active round`}
          </p>
        </div>


        <div
          className="g365-nflp-home-actions"
        >
          <Link
            href={`/league/${leagueId}/entry`}
            style={
              styles.secondaryButton
            }
          >
            MY ENTRY
          </Link>

          <Link
            href={`/league/${leagueId}/nfl-playoffs/teams`}
            style={
              styles.primaryButton
            }
          >
            LEAGUE TEAMS
          </Link>
        </div>
      </section>


      <section
        className="g365-nflp-home-stats"
      >
        <StatCard
          label="ACTIVE ROUND"
          value={
            leagueComplete
              ? "Complete"
              : roundName(
                  activeRound
                )
          }
          detail={
            leagueComplete
              ? "All four rounds finished"
              : `Round ${activeRound} of 4`
          }
        />

        <StatCard
          label="LEAGUE STATUS"
          value={
            prettyStatus(
              state?.status
            )
          }
          detail="NFL Playoffs lifecycle"
        />

        <StatCard
          label="ACTIVE TEAMS"
          value={
            String(
              teams.length
            )
          }
          detail="Accepted league teams"
        />

        <StatCard
          label="ROUNDS FINAL"
          value={`${finalizedRounds.length} / 4`}
          detail="Official finalized rounds"
        />

        <StatCard
          label="MY TEAM"
          value={
            myTeam
              ?.team_name ??
            "League Member"
          }
          detail={
            myEntry
              ? prettyStatus(
                  myEntry.status
                )
              : "Entry not loaded"
          }
        />

        <StatCard
          label="MY ROUND POINTS"
          value={
            safeNumber(
              myEntry
                ?.fantasy_points
            ).toFixed(
              2
            )
          }
          detail={
            `Projected ${safeNumber(
              myEntry
                ?.projected_points
            ).toFixed(
              2
            )}`
          }
        />

        <StatCard
          label="MY TOTAL"
          value={
            safeNumber(
              myStanding
                ?.total_points
            ).toFixed(
              2
            )
          }
          detail="Cumulative postseason points"
        />

        <StatCard
          label="MY RANK"
          value={
            myStanding
              ?.rank
              ? `#${myStanding.rank}`
              : "—"
          }
          detail={
            teams.length > 0
              ? `of ${teams.length} teams`
              : "No standings yet"
          }
        />
      </section>


      <section
        style={
          styles.section
        }
      >
        <div
          style={
            styles.sectionHeader
          }
        >
          <div>
            <div
              style={
                styles.eyebrow
              }
            >
              POSTSEASON PROGRESS
            </div>

            <h3
              style={
                styles.sectionTitle
              }
            >
              Four-Round NFL Playoffs
            </h3>
          </div>
        </div>


        <div
          className="g365-nflp-home-rounds"
        >
          {[
            1,
            2,
            3,
            4,
          ].map(
            (
              roundNumber
            ) => {
              const round =
                rounds.find(
                  (
                    item
                  ) =>
                    item
                      .round_number ===
                    roundNumber
                ) ??
                null;


              const isActive =
                !leagueComplete &&
                roundNumber ===
                  activeRound;


              const isFinal =
                Boolean(
                  round
                    ?.finalized_at
                ) ||
                round
                  ?.status ===
                  "final";


              return (
                <article
                  key={
                    roundNumber
                  }
                  style={{
                    ...styles.roundCard,

                    ...(isActive
                      ? styles.roundCardActive
                      : {}),
                  }}
                >
                  <div
                    style={{
                      color:
                        isFinal
                          ? "#72df8a"
                          : isActive
                            ? "#ff7a2a"
                            : "#8f949e",

                      fontSize:
                        11,

                      fontWeight:
                        1000,

                      letterSpacing:
                        ".1em",
                    }}
                  >
                    {isFinal
                      ? "FINAL"
                      : isActive
                        ? "ACTIVE"
                        : "UPCOMING"}
                  </div>


                  <strong
                    style={{
                      color:
                        "#fff",

                      fontSize:
                        18,
                    }}
                  >
                    {
                      roundName(
                        roundNumber
                      )
                    }
                  </strong>


                  <span
                    style={
                      styles.detail
                    }
                  >
                    {round
                      ?.first_kickoff_at
                      ? `Starts ${formatDate(
                          round
                            .first_kickoff_at
                        )}`
                      : "Schedule pending"}
                  </span>
                </article>
              );
            }
          )}
        </div>
      </section>


      <section
        style={
          styles.section
        }
      >
        <div
          style={
            styles.sectionHeader
          }
        >
          <div>
            <div
              style={
                styles.eyebrow
              }
            >
              LEAGUE ACCESS
            </div>

            <h3
              style={
                styles.sectionTitle
              }
            >
              Quick Links
            </h3>
          </div>
        </div>


        <div
          className="g365-nflp-home-links"
        >
          <QuickLink
            href={`/league/${leagueId}/entry`}
            title="My Entry"
            description="Build and manage your current postseason lineup."
          />

          <QuickLink
            href={`/league/${leagueId}/nfl-playoffs/teams`}
            title="League Teams"
            description="View every active league team and current-round lineup."
          />

          <QuickLink
            href={`/league/${leagueId}/nfl-playoffs/standings`}
            title="Standings"
            description="See cumulative scoring and current league rank."
          />

          <QuickLink
            href={`/league/${leagueId}/nfl-playoffs/playoffs`}
            title="NFL Playoffs"
            description="Follow Wild Card through the Super Bowl bracket."
          />

          <QuickLink
            href={`/league/${leagueId}/nfl-playoffs/recap`}
            title="Recap"
            description="Review round results, leaders and postseason highlights."
          />

          <QuickLink
            href={`/league/${leagueId}/nfl-playoffs/trophy-case`}
            title="Trophy Case"
            description="View postseason awards and completed achievements."
          />
        </div>
      </section>


      <section
        style={{
          ...styles.section,

          borderColor:
            "rgba(255,115,35,.18)",

          background:
            "linear-gradient(180deg,rgba(34,20,14,.8),rgba(14,14,16,.95))",
        }}
      >
        <div
          style={
            styles.eyebrow
          }
        >
          CURRENT ROUND
        </div>

        <h3
          style={
            styles.sectionTitle
          }
        >
          {leagueComplete
            ? "Postseason Complete"
            : roundName(
                activeRound
              )}
        </h3>

        <div
          style={{
            display:
              "grid",

            gap:
              8,

            marginTop:
              14,

            color:
              "#b8bbc3",

            lineHeight:
              1.6,
          }}
        >
          <div>
            <strong
              style={{
                color:
                  "#fff",
              }}
            >
              Status:
            </strong>
            {" "}
            {prettyStatus(
              activeRoundRow
                ?.status
            )}
          </div>

          <div>
            <strong
              style={{
                color:
                  "#fff",
              }}
            >
              First kickoff:
            </strong>
            {" "}
            {formatDate(
              activeRoundRow
                ?.first_kickoff_at
            )}
          </div>

          <div>
            <strong
              style={{
                color:
                  "#fff",
              }}
            >
              Last scheduled kickoff:
            </strong>
            {" "}
            {formatDate(
              activeRoundRow
                ?.last_scheduled_kickoff_at
            )}
          </div>
        </div>
      </section>
    </main>
  );
}


function StatCard({
  label,
  value,
  detail,
}: {
  label:
    string;

  value:
    string;

  detail:
    string;
}) {
  return (
    <article
      style={
        styles.statCard
      }
    >
      <span
        style={
          styles.eyebrow
        }
      >
        {label}
      </span>

      <strong
        style={{
          color:
            "#fff",

          fontSize:
            23,

          lineHeight:
            1.15,
        }}
      >
        {value}
      </strong>

      <span
        style={
          styles.detail
        }
      >
        {detail}
      </span>
    </article>
  );
}


function QuickLink({
  href,
  title,
  description,
}: {
  href:
    string;

  title:
    string;

  description:
    string;
}) {
  return (
    <Link
      href={
        href
      }
      style={
        styles.quickLink
      }
    >
      <strong
        style={{
          color:
            "#fff",

          fontSize:
            16,
        }}
      >
        {title}
      </strong>

      <span
        style={
          styles.detail
        }
      >
        {description}
      </span>

      <span
        style={{
          color:
            "#ff7627",

          fontSize:
            12,

          fontWeight:
            900,

          marginTop:
            4,
        }}
      >
        OPEN →
      </span>
    </Link>
  );
}


const styles = {
  section: {
    padding:
      18,

    border:
      "1px solid rgba(255,255,255,.08)",

    borderRadius:
      16,

    background:
      "linear-gradient(180deg,rgba(20,20,23,.98),rgba(12,12,14,.98))",
  },

  sectionHeader: {
    display:
      "flex",

    alignItems:
      "center",

    justifyContent:
      "space-between",

    gap:
      12,

    marginBottom:
      14,
  },

  sectionTitle: {
    margin:
      "5px 0 0",

    color:
      "#fff",

    fontSize:
      22,
  },

  eyebrow: {
    color:
      "#ff7627",

    fontSize:
      10,

    fontWeight:
      1000,

    letterSpacing:
      ".11em",

    textTransform:
      "uppercase" as const,
  },

  detail: {
    color:
      "#9297a1",

    fontSize:
      12,

    lineHeight:
      1.5,
  },

  statCard: {
    display:
      "grid",

    gap:
      7,

    padding:
      16,

    border:
      "1px solid rgba(255,255,255,.08)",

    borderRadius:
      14,

    background:
      "linear-gradient(180deg,rgba(22,22,25,.96),rgba(12,12,14,.96))",
  },

  roundCard: {
    display:
      "grid",

    gap:
      8,

    padding:
      16,

    border:
      "1px solid rgba(255,255,255,.08)",

    borderRadius:
      14,

    background:
      "rgba(11,11,13,.82)",
  },

  roundCardActive: {
    border:
      "1px solid rgba(255,103,29,.56)",

    background:
      "linear-gradient(180deg,rgba(84,25,12,.5),rgba(13,13,15,.96))",

    boxShadow:
      "inset 0 0 0 1px rgba(255,103,29,.08)",
  },

  quickLink: {
    display:
      "grid",

    gap:
      7,

    minHeight:
      120,

    padding:
      17,

    border:
      "1px solid rgba(255,255,255,.08)",

    borderRadius:
      14,

    background:
      "linear-gradient(180deg,rgba(20,20,23,.98),rgba(11,11,13,.98))",

    textDecoration:
      "none",
  },

  primaryButton: {
    display:
      "inline-flex",

    alignItems:
      "center",

    justifyContent:
      "center",

    minHeight:
      42,

    padding:
      "0 16px",

    borderRadius:
      10,

    border:
      "1px solid rgba(255,101,28,.72)",

    background:
      "linear-gradient(135deg,#b51b11,#ff6a18)",

    color:
      "#fff",

    fontSize:
      12,

    fontWeight:
      1000,

    textDecoration:
      "none",
  },

  secondaryButton: {
    display:
      "inline-flex",

    alignItems:
      "center",

    justifyContent:
      "center",

    minHeight:
      42,

    padding:
      "0 16px",

    borderRadius:
      10,

    border:
      "1px solid rgba(255,255,255,.14)",

    background:
      "rgba(255,255,255,.04)",

    color:
      "#fff",

    fontSize:
      12,

    fontWeight:
      1000,

    textDecoration:
      "none",
  },
};