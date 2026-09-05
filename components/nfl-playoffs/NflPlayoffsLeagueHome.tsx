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


type StateRow = {
  active_round: number | null;
  status: string | null;
  completed_at: string | null;
};


type RoundRow = {
  round_number: number;
  round_name: string | null;
  status: string | null;
  first_kickoff_at: string | null;
  last_scheduled_kickoff_at: string | null;
  finalized_at: string | null;
};


type EntryRow = {
  fantasy_team_id: number;
  status: string | null;
  salary_used: number | string | null;
  projected_points: number | string | null;
  submitted_at: string | null;
};


type RoundScoreRow = {
  fantasy_team_id: number;
  fantasy_points: number | string | null;
};


type StandingRow = {
  fantasy_team_id: number;
  total_points: number | string | null;
  current_rank: number | null;
};


type TeamRow = {
  id: number;
  team_name: string;
};


function n(
  value:
    | number
    | string
    | null
    | undefined
) {
  const parsed =
    Number(value ?? 0);

  return Number.isFinite(parsed)
    ? parsed
    : 0;
}


function points(
  value:
    | number
    | string
    | null
    | undefined
) {
  return n(value).toFixed(2);
}


function roundName(
  roundNumber: number
) {
  switch (roundNumber) {
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
    | string
    | null
    | undefined
) {
  if (!value) {
    return "Setup";
  }

  return value
    .replaceAll("_", " ")
    .replace(
      /\b\w/g,
      (character) =>
        character.toUpperCase()
    );
}


function formatDate(
  value:
    | string
    | null
    | undefined
) {
  if (!value) {
    return "TBD";
  }

  const date =
    new Date(value);

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
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }
  ).format(date);
}


export default async function NflPlayoffsLeagueHome({
  leagueId,
}: Props) {
  const access =
    await requireLeagueMember(
      leagueId
    );

  if (
    access.league.leagueType !==
    "nfl_playoffs"
  ) {
    throw new Error(
      "This page is only available for NFL Playoffs leagues."
    );
  }

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
            ascending: true,
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
            ascending: true,
          }
        ),

      supabase
        .from(
          "nfl_playoff_standings"
        )
        .select(`
          fantasy_team_id,
          total_points,
          current_rank
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


  const firstError =
    [
      stateResult,
      roundsResult,
      teamsResult,
      standingsResult,
    ].find(
      (result) =>
        result.error
    )?.error;


  if (firstError) {
    throw new Error(
      `NFL Playoffs Home could not be loaded: ${firstError.message}`
    );
  }


  const state =
    stateResult.data as
      | StateRow
      | null;

  const rounds =
    (roundsResult.data ??
      []) as RoundRow[];

  const teams =
    (teamsResult.data ??
      []) as TeamRow[];

  const standings =
    (standingsResult.data ??
      []) as StandingRow[];


  const activeRound =
    Math.min(
      4,
      Math.max(
        1,
        Number(
          state?.active_round ??
            1
        )
      )
    );


  const activeRoundRow =
    rounds.find(
      (round) =>
        round.round_number ===
        activeRound
    ) ??
    null;


  const finalizedRounds =
    rounds.filter(
      (round) =>
        Boolean(
          round.finalized_at
        ) ||
        round.status ===
          "final"
    );


  let myEntry:
    | EntryRow
    | null =
    null;

  let myRoundScore:
    | RoundScoreRow
    | null =
    null;


  if (fantasyTeamId) {
    const [
      entryResult,
      scoreResult,
    ] =
      await Promise.all([
        supabase
          .from(
            "nfl_playoff_round_entries"
          )
          .select(`
            fantasy_team_id,
            status,
            salary_used,
            projected_points,
            submitted_at
          `)
          .eq(
            "league_id",
            leagueId
          )
          .eq(
            "fantasy_team_id",
            fantasyTeamId
          )
          .eq(
            "season",
            season
          )
          .eq(
            "round_number",
            activeRound
          )
          .maybeSingle(),

        supabase
          .from(
            "nfl_playoff_round_scores"
          )
          .select(`
            fantasy_team_id,
            fantasy_points
          `)
          .eq(
            "league_id",
            leagueId
          )
          .eq(
            "fantasy_team_id",
            fantasyTeamId
          )
          .eq(
            "season",
            season
          )
          .eq(
            "round_number",
            activeRound
          )
          .maybeSingle(),
      ]);


    if (
      entryResult.error
    ) {
      throw new Error(
        `NFL Playoffs Home could not load your entry: ${entryResult.error.message}`
      );
    }


    if (
      scoreResult.error
    ) {
      throw new Error(
        `NFL Playoffs Home could not load your round score: ${scoreResult.error.message}`
      );
    }


    myEntry =
      entryResult.data as
        | EntryRow
        | null;

    myRoundScore =
      scoreResult.data as
        | RoundScoreRow
        | null;
  }


  const myTeam =
    fantasyTeamId
      ? teams.find(
          (team) =>
            team.id ===
            fantasyTeamId
        ) ??
        null
      : null;


  const myStanding =
    fantasyTeamId
      ? standings.find(
          (standing) =>
            standing
              .fantasy_team_id ===
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
    finalizedRounds.length ===
      4;


  return (
    <main
      className="g365-nflp-home"
      style={{
        width: "100%",
        minWidth: 0,
        display: "grid",
        gap: 18,
        padding:
          "22px 18px 40px",
      }}
    >
      <style>{`
        .g365-nflp-home * {
          box-sizing: border-box;
        }

        .g365-nflp-home-stats {
          display: grid;
          grid-template-columns:
            repeat(4,minmax(0,1fr));
          gap: 12px;
        }

        .g365-nflp-home-rounds {
          display: grid;
          grid-template-columns:
            repeat(4,minmax(0,1fr));
          gap: 12px;
        }

        .g365-nflp-home-links {
          display: grid;
          grid-template-columns:
            repeat(3,minmax(0,1fr));
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

        @media (max-width: 650px) {
          .g365-nflp-home {
            padding:
              14px 10px 34px !important;
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
        style={{
          padding: 22,
          borderRadius: 18,
          border:
            "1px solid rgba(255,105,28,.32)",
          background:
            "linear-gradient(135deg,rgba(111,9,14,.5),rgba(17,17,20,.98) 52%,rgba(136,47,0,.3))",
        }}
      >
        <p
          style={{
            margin: 0,
            color: "#ff7627",
            fontWeight: 1000,
            fontSize: 11,
            letterSpacing:
              ".12em",
          }}
        >
          G365 NFL PLAYOFFS
        </p>

        <h2
          style={{
            margin:
              "8px 0",
            color: "#fff",
            fontSize:
              "clamp(30px,5vw,48px)",
          }}
        >
          {access.league.name}
        </h2>

        <p
          style={{
            margin: 0,
            color: "#aeb2bb",
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
              )} · Active`}
        </p>
      </section>


      <section
        className="g365-nflp-home-stats"
      >
        <Stat
          label="ACTIVE ROUND"
          value={
            leagueComplete
              ? "Complete"
              : roundName(
                  activeRound
                )
          }
          detail={`Round ${activeRound} of 4`}
        />

        <Stat
          label="LEAGUE STATUS"
          value={
            prettyStatus(
              state?.status
            )
          }
          detail="Automatic postseason lifecycle"
        />

        <Stat
          label="ACTIVE TEAMS"
          value={String(
            teams.length
          )}
          detail="Accepted league entries"
        />

        <Stat
          label="ROUNDS FINAL"
          value={`${finalizedRounds.length} / 4`}
          detail="Official completed rounds"
        />

        <Stat
          label="MY TEAM"
          value={
            myTeam?.team_name ??
            "League Member"
          }
          detail={
            prettyStatus(
              myEntry?.status
            )
          }
        />

        <Stat
          label="MY ROUND POINTS"
          value={points(
            myRoundScore
              ?.fantasy_points
          )}
          detail={`Projected ${points(
            myEntry
              ?.projected_points
          )}`}
        />

        <Stat
          label="MY TOTAL"
          value={points(
            myStanding
              ?.total_points
          )}
          detail="Cumulative playoff points"
        />

        <Stat
          label="MY RANK"
          value={
            myStanding
              ?.current_rank
              ? `#${myStanding.current_rank}`
              : "—"
          }
          detail={`of ${teams.length} teams`}
        />
      </section>


      <section
        style={styles.section}
      >
        <p style={styles.eyebrow}>
          POSTSEASON PROGRESS
        </p>

        <h3 style={styles.heading}>
          NFL Playoff Rounds
        </h3>

        <div
          className="g365-nflp-home-rounds"
        >
          {[1, 2, 3, 4].map(
            (roundNumber) => {
              const round =
                rounds.find(
                  (row) =>
                    row.round_number ===
                    roundNumber
                );

              const isFinal =
                Boolean(
                  round?.finalized_at
                ) ||
                round?.status ===
                  "final";

              const isActive =
                !leagueComplete &&
                activeRound ===
                  roundNumber;

              return (
                <article
                  key={
                    roundNumber
                  }
                  style={{
                    ...styles.card,
                    ...(isActive
                      ? styles.activeCard
                      : {}),
                  }}
                >
                  <span
                    style={{
                      ...styles.eyebrow,
                      color:
                        isFinal
                          ? "#64df80"
                          : isActive
                            ? "#ff7627"
                            : "#858994",
                    }}
                  >
                    {isFinal
                      ? "FINAL"
                      : isActive
                        ? "ACTIVE"
                        : "UPCOMING"}
                  </span>

                  <strong
                    style={{
                      color: "#fff",
                      fontSize: 17,
                    }}
                  >
                    {roundName(
                      roundNumber
                    )}
                  </strong>

                  <span
                    style={
                      styles.detail
                    }
                  >
                    {formatDate(
                      round
                        ?.first_kickoff_at
                    )}
                  </span>
                </article>
              );
            }
          )}
        </div>
      </section>


      <section
        style={styles.section}
      >
        <p style={styles.eyebrow}>
          CURRENT ROUND
        </p>

        <h3 style={styles.heading}>
          {leagueComplete
            ? "Postseason Complete"
            : roundName(
                activeRound
              )}
        </h3>

        <div
          style={{
            display: "grid",
            gap: 7,
            color: "#afb2ba",
          }}
        >
          <span>
            Status:{" "}
            <strong
              style={{
                color: "#fff",
              }}
            >
              {prettyStatus(
                activeRoundRow
                  ?.status
              )}
            </strong>
          </span>

          <span>
            First kickoff:{" "}
            <strong
              style={{
                color: "#fff",
              }}
            >
              {formatDate(
                activeRoundRow
                  ?.first_kickoff_at
              )}
            </strong>
          </span>

          <span>
            Last scheduled kickoff:{" "}
            <strong
              style={{
                color: "#fff",
              }}
            >
              {formatDate(
                activeRoundRow
                  ?.last_scheduled_kickoff_at
              )}
            </strong>
          </span>
        </div>
      </section>


      <section
        style={styles.section}
      >
        <p style={styles.eyebrow}>
          LEAGUE
        </p>

        <h3 style={styles.heading}>
          Quick Links
        </h3>

        <div
          className="g365-nflp-home-links"
        >
          <QuickLink
            href={`/league/${leagueId}/entry`}
            title="My Entry"
            text="Build and manage your current-round lineup."
          />

          <QuickLink
            href={`/league/${leagueId}/nfl-playoffs/teams`}
            title="League Teams"
            text="See every team's current postseason lineup."
          />

          <QuickLink
            href={`/league/${leagueId}/nfl-playoffs/standings`}
            title="Standings"
            text="View live cumulative postseason standings."
          />

          <QuickLink
            href={`/league/${leagueId}/nfl-playoffs/playoffs`}
            title="NFL Playoffs"
            text="Follow the playoff bracket through the Super Bowl."
          />

          <QuickLink
            href={`/league/${leagueId}/nfl-playoffs/recap`}
            title="Recap"
            text="Review round leaders and results."
          />

          <QuickLink
            href={`/league/${leagueId}/nfl-playoffs/trophy-case`}
            title="Trophy Case"
            text="View postseason awards and achievements."
          />
        </div>
      </section>
    </main>
  );
}


function Stat({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article
      style={styles.card}
    >
      <span style={styles.eyebrow}>
        {label}
      </span>

      <strong
        style={{
          color: "#fff",
          fontSize: 22,
        }}
      >
        {value}
      </strong>

      <span style={styles.detail}>
        {detail}
      </span>
    </article>
  );
}


function QuickLink({
  href,
  title,
  text,
}: {
  href: string;
  title: string;
  text: string;
}) {
  return (
    <Link
      href={href}
      style={{
        ...styles.card,
        textDecoration: "none",
      }}
    >
      <strong
        style={{
          color: "#fff",
          fontSize: 16,
        }}
      >
        {title}
      </strong>

      <span style={styles.detail}>
        {text}
      </span>

      <span
        style={{
          color: "#ff7627",
          fontWeight: 900,
          fontSize: 11,
        }}
      >
        OPEN →
      </span>
    </Link>
  );
}


const styles = {
  section: {
    padding: 18,
    border:
      "1px solid rgba(255,255,255,.08)",
    borderRadius: 15,
    background:
      "linear-gradient(180deg,rgba(20,20,23,.98),rgba(11,11,13,.98))",
  },

  card: {
    display: "grid",
    gap: 7,
    padding: 16,
    border:
      "1px solid rgba(255,255,255,.08)",
    borderRadius: 13,
    background:
      "linear-gradient(180deg,rgba(22,22,25,.97),rgba(12,12,14,.97))",
  },

  activeCard: {
    border:
      "1px solid rgba(255,105,28,.55)",
    background:
      "linear-gradient(180deg,rgba(91,28,10,.46),rgba(12,12,14,.97))",
  },

  eyebrow: {
    margin: 0,
    color: "#ff7627",
    fontSize: 10,
    fontWeight: 1000,
    letterSpacing:
      ".1em",
    textTransform:
      "uppercase" as const,
  },

  heading: {
    margin:
      "5px 0 15px",
    color: "#fff",
    fontSize: 22,
  },

  detail: {
    color: "#9297a1",
    fontSize: 12,
    lineHeight: 1.5,
  },
};