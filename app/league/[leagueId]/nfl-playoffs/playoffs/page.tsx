import Link from "next/link";

import {
  requireLeagueMember,
} from "@/lib/leagues/requireLeagueMember";

import {
  createSupabaseServerClient,
} from "@/lib/supabase/server";


type PageProps = {
  params:
    Promise<{
      leagueId: string;
    }>;
};


type TeamRow = {
  id: number;
  abbreviation:
    string |
    null;
  name:
    string |
    null;
};


type BracketGame = {
  bracketOrder: number;
  nflGameId: number;
  espnEventId:
    string |
    null;
  kickoffAt:
    string |
    null;
  awayTeamId:
    number |
    null;
  homeTeamId:
    number |
    null;
  awayScore:
    number |
    null;
  homeScore:
    number |
    null;
  statusType:
    string |
    null;
  statusName:
    string |
    null;
  statusDetail:
    string |
    null;
  isFinal: boolean;
  winnerTeamId:
    number |
    null;
};


type BracketRound = {
  roundNumber: number;
  roundName: string;
  nflWeek:
    number |
    null;
  status:
    string |
    null;
  firstKickoffAt:
    string |
    null;
  lastScheduledKickoffAt:
    string |
    null;
  games: BracketGame[];
};


type BracketPayload = {
  success?: boolean;
  leagueId?: string;
  season?: number;
  title?: string;
  rounds?: BracketRound[];
};


const EXPECTED_GAMES:
  Record<
    number,
    number
  > = {
    1: 6,
    2: 4,
    3: 2,
    4: 1,
  };


const ROUND_NAMES:
  Record<
    number,
    string
  > = {
    1: "Wild Card",
    2: "Divisional",
    3: "Conference Championships",
    4: "Super Bowl",
  };


function safeNumber(
  value:
    unknown
):
  number |
  null {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const parsed =
    Number(
      value
    );

  return Number.isFinite(
    parsed
  )
    ? parsed
    : null;
}


function asObject(
  value:
    unknown
):
  Record<
    string,
    unknown
  > {
  return value &&
    typeof value ===
      "object" &&
    !Array.isArray(
      value
    )
    ? value as Record<
        string,
        unknown
      >
    : {};
}


function parseGame(
  value:
    unknown
):
  BracketGame {
  const row =
    asObject(
      value
    );

  return {
    bracketOrder:
      safeNumber(
        row.bracketOrder ??
        row.bracket_order
      ) ??
      1,

    nflGameId:
      safeNumber(
        row.nflGameId ??
        row.nfl_game_id
      ) ??
      0,

    espnEventId:
      typeof (
        row.espnEventId ??
        row.espn_event_id
      ) === "string"
        ? String(
            row.espnEventId ??
            row.espn_event_id
          )
        : null,

    kickoffAt:
      typeof (
        row.kickoffAt ??
        row.kickoff_at
      ) === "string"
        ? String(
            row.kickoffAt ??
            row.kickoff_at
          )
        : null,

    awayTeamId:
      safeNumber(
        row.awayTeamId ??
        row.away_team_id
      ),

    homeTeamId:
      safeNumber(
        row.homeTeamId ??
        row.home_team_id
      ),

    awayScore:
      safeNumber(
        row.awayScore ??
        row.away_score
      ),

    homeScore:
      safeNumber(
        row.homeScore ??
        row.home_score
      ),

    statusType:
      typeof (
        row.statusType ??
        row.status_type
      ) === "string"
        ? String(
            row.statusType ??
            row.status_type
          )
        : null,

    statusName:
      typeof (
        row.statusName ??
        row.status_name
      ) === "string"
        ? String(
            row.statusName ??
            row.status_name
          )
        : null,

    statusDetail:
      typeof (
        row.statusDetail ??
        row.status_detail
      ) === "string"
        ? String(
            row.statusDetail ??
            row.status_detail
          )
        : null,

    isFinal:
      Boolean(
        row.isFinal ??
        row.is_final
      ),

    winnerTeamId:
      safeNumber(
        row.winnerTeamId ??
        row.winner_team_id
      ),
  };
}


function parseRound(
  value:
    unknown
):
  BracketRound {
  const row =
    asObject(
      value
    );

  const roundNumber =
    safeNumber(
      row.roundNumber ??
      row.round_number
    ) ??
    1;

  const games =
    Array.isArray(
      row.games
    )
      ? row.games.map(
          parseGame
        )
      : [];

  return {
    roundNumber,

    roundName:
      typeof (
        row.roundName ??
        row.round_name
      ) === "string"
        ? String(
            row.roundName ??
            row.round_name
          )
        : ROUND_NAMES[
            roundNumber
          ] ??
          `Round ${roundNumber}`,

    nflWeek:
      safeNumber(
        row.nflWeek ??
        row.nfl_week
      ),

    status:
      typeof row.status ===
        "string"
        ? row.status
        : null,

    firstKickoffAt:
      typeof (
        row.firstKickoffAt ??
        row.first_kickoff_at
      ) === "string"
        ? String(
            row.firstKickoffAt ??
            row.first_kickoff_at
          )
        : null,

    lastScheduledKickoffAt:
      typeof (
        row.lastScheduledKickoffAt ??
        row.last_scheduled_kickoff_at
      ) === "string"
        ? String(
            row.lastScheduledKickoffAt ??
            row.last_scheduled_kickoff_at
          )
        : null,

    games:
      games.sort(
        (
          a,
          b
        ) =>
          a.bracketOrder -
          b.bracketOrder
      ),
  };
}


function parsePayload(
  value:
    unknown
):
  BracketPayload {
  const row =
    asObject(
      value
    );

  return {
    success:
      typeof row.success ===
        "boolean"
        ? row.success
        : undefined,

    leagueId:
      typeof row.leagueId ===
        "string"
        ? row.leagueId
        : typeof row.league_id ===
            "string"
          ? row.league_id
          : undefined,

    season:
      safeNumber(
        row.season
      ) ??
      undefined,

    title:
      typeof row.title ===
        "string"
        ? row.title
        : undefined,

    rounds:
      Array.isArray(
        row.rounds
      )
        ? row.rounds.map(
            parseRound
          )
        : [],
  };
}


function formatKickoff(
  value:
    string |
    null
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
      timeZoneName:
        "short",
    }
  ).format(
    date
  );
}


function gameStatus(
  game:
    BracketGame
) {
  if (
    game.isFinal
  ) {
    return "FINAL";
  }

  const raw =
    (
      game.statusDetail ??
      game.statusName ??
      game.statusType ??
      "SCHEDULED"
    ).trim();

  return raw ||
    "SCHEDULED";
}


export default async function NflPlayoffsBracketPage({
  params,
}: PageProps) {
  const {
    leagueId,
  } =
    await params;

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

  const [
    bracketResult,
    teamResult,
    stateResult,
  ] =
    await Promise.all([
      supabase.rpc(
        "get_nfl_playoff_bracket",
        {
          p_league_id:
            leagueId,
          p_season:
            season,
        }
      ),

      supabase
        .from(
          "nfl_teams"
        )
        .select(
          "id, abbreviation, name"
        ),

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
    ]);

  if (
    bracketResult.error
  ) {
    throw new Error(
      `Could not load NFL Playoffs bracket: ${bracketResult.error.message}`
    );
  }

  if (
    teamResult.error
  ) {
    throw new Error(
      `Could not load NFL teams: ${teamResult.error.message}`
    );
  }

  if (
    stateResult.error
  ) {
    throw new Error(
      `Could not load NFL Playoffs league state: ${stateResult.error.message}`
    );
  }

  const payload =
    parsePayload(
      bracketResult.data
    );

  const teams =
    (
      teamResult.data ??
      []
    ) as TeamRow[];

  const teamMap =
    new Map<
      number,
      TeamRow
    >(
      teams.map(
        (
          team
        ) => [
          team.id,
          team,
        ]
      )
    );

  const rawRounds =
    payload.rounds ??
    [];

  const roundByNumber =
    new Map<
      number,
      BracketRound
    >(
      rawRounds.map(
        (
          round
        ) => [
          round.roundNumber,
          round,
        ]
      )
    );

  const rounds:
    BracketRound[] =
    [
      1,
      2,
      3,
      4,
    ].map(
      (
        roundNumber
      ) =>
        roundByNumber.get(
          roundNumber
        ) ?? {
          roundNumber,
          roundName:
            ROUND_NAMES[
              roundNumber
            ],
          nflWeek:
            roundNumber === 4
              ? 5
              : roundNumber,
          status:
            null,
          firstKickoffAt:
            null,
          lastScheduledKickoffAt:
            null,
          games:
            [],
        }
    );

  const leagueState =
    stateResult.data;

  const activeRound =
    Number(
      leagueState
        ?.active_round ??
      1
    );

  const mappedGames =
    rounds.reduce(
      (
        total,
        round
      ) =>
        total +
        round.games.length,
      0
    );

  const finalGames =
    rounds.reduce(
      (
        total,
        round
      ) =>
        total +
        round.games.filter(
          (
            game
          ) =>
            game.isFinal
        ).length,
      0
    );

  return (
    <main
      className="g365-nflp-bracket-page"
      style={
        styles.page
      }
    >
      <style>{`
        .g365-nflp-bracket-page,
        .g365-nflp-bracket-page * {
          box-sizing: border-box;
        }

        .g365-nflp-bracket-grid {
          display: grid;
          grid-template-columns:
            minmax(265px,1.5fr)
            minmax(250px,1fr)
            minmax(250px,1fr)
            minmax(250px,1fr);
          gap: 14px;
          align-items: stretch;
        }

        .g365-nflp-round {
          min-width: 0;
        }

        .g365-nflp-game-team-name {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        @media (max-width: 1120px) {
          .g365-nflp-bracket-viewport {
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
            padding-bottom: 8px;
          }

          .g365-nflp-bracket-grid {
            min-width: 1080px;
          }
        }

        @media (max-width: 760px) {
          .g365-nflp-bracket-page {
            padding: 12px 10px !important;
          }

          .g365-nflp-hero {
            padding: 16px !important;
          }

          .g365-nflp-hero h1 {
            font-size: 28px !important;
          }

          .g365-nflp-summary {
            grid-template-columns:
              repeat(2,minmax(0,1fr)) !important;
          }

          .g365-nflp-bracket-viewport {
            overflow-x: visible;
            padding-bottom: 0;
          }

          .g365-nflp-bracket-grid {
            min-width: 0;
            display: grid;
            grid-template-columns: minmax(0,1fr);
            gap: 12px;
          }

          .g365-nflp-round {
            width: 100%;
          }

          .g365-nflp-round-body {
            gap: 9px !important;
          }

          .g365-nflp-game-card {
            border-radius: 11px !important;
          }

          .g365-nflp-game-team-row {
            min-height: 48px;
          }

          .g365-nflp-mobile-note {
            display: block !important;
          }
        }

        @media (max-width: 430px) {
          .g365-nflp-summary {
            grid-template-columns:
              minmax(0,1fr) !important;
          }

          .g365-nflp-hero h1 {
            font-size: 25px !important;
          }
        }
      `}</style>

      <div
        style={
          styles.shell
        }
      >
        <header
          className="g365-nflp-hero"
          style={
            styles.hero
          }
        >
          <div>
            <div
              style={
                styles.eyebrow
              }
            >
              G365 • REAL NFL POSTSEASON
            </div>

            <h1
              style={
                styles.title
              }
            >
              {season} NFL Playoffs
            </h1>

            <p
              style={
                styles.subtitle
              }
            >
              Wild Card → Divisional → Conference Championships → Super Bowl
            </p>
          </div>

          <Link
            href={
              `/league/${leagueId}/standings`
            }
            style={
              styles.button
            }
          >
            FANTASY STANDINGS
          </Link>
        </header>

        <section
          style={
            styles.section
          }
        >
          <div
            className="g365-nflp-summary"
            style={
              styles.summary
            }
          >
            <Stat
              label="Fantasy League"
              value={
                access.league.name
              }
            />

            <Stat
              label="Active Round"
              value={
                ROUND_NAMES[
                  activeRound
                ] ??
                `Round ${activeRound}`
              }
            />

            <Stat
              label="NFL Games Mapped"
              value={
                mappedGames
              }
            />

            <Stat
              label="NFL Games Final"
              value={
                finalGames
              }
            />
          </div>
        </section>

        <section
          style={
            styles.section
          }
        >
          <div
            style={
              styles.sectionHead
            }
          >
            <div>
              <div
                style={
                  styles.sectionEyebrow
                }
              >
                LIVE NFL BRACKET
              </div>

              <h2
                style={
                  styles.sectionTitle
                }
              >
                Road to the Super Bowl
              </h2>
            </div>

            <span
              style={
                styles.sectionMeta
              }
            >
              Winners are shown only after their NFL game is final. Future matchups remain TBD until the actual NFL playoff field is known.
            </span>
          </div>

          <div
            className="g365-nflp-mobile-note"
            style={
              styles.mobileNote
            }
          >
            On mobile, each playoff round is stacked vertically for easier reading and tapping.
          </div>

          <div
            className="g365-nflp-bracket-viewport"
          >
            <div
              className="g365-nflp-bracket-grid"
            >
              {rounds.map(
                (
                  round
                ) => (
                  <RoundColumn
                    key={
                      round.roundNumber
                    }
                    round={
                      round
                    }
                    teamMap={
                      teamMap
                    }
                    isActive={
                      activeRound ===
                      round.roundNumber
                    }
                  />
                )
              )}
            </div>
          </div>
        </section>

        <section
          style={
            styles.notice
          }
        >
          <strong>
            REAL NFL BRACKET
          </strong>

          <span>
            This page follows the actual NFL postseason. It does not create a fantasy head-to-head bracket. The same mapped games determine which NFL teams remain alive and which players are eligible for the next G365 playoff round.
          </span>
        </section>
      </div>
    </main>
  );
}


function RoundColumn({
  round,
  teamMap,
  isActive,
}: {
  round:
    BracketRound;
  teamMap:
    Map<
      number,
      TeamRow
    >;
  isActive:
    boolean;
}) {
  const expected =
    EXPECTED_GAMES[
      round.roundNumber
    ] ??
    0;

  const slots =
    Array.from(
      {
        length:
          expected,
      },
      (
        _,
        index
      ) =>
        round.games[
          index
        ] ??
        null
    );

  return (
    <section
      className="g365-nflp-round"
      style={{
        ...styles.round,
        ...(isActive
          ? styles.roundActive
          : {}),
      }}
    >
      <div
        style={
          styles.roundHead
        }
      >
        <div>
          <span
            style={
              styles.roundKicker
            }
          >
            ROUND {round.roundNumber}
          </span>

          <strong
            style={
              styles.roundTitle
            }
          >
            {round.roundName}
          </strong>
        </div>

        <span
          style={{
            ...styles.roundStatus,
            ...(isActive
              ? styles.roundStatusActive
              : {}),
          }}
        >
          {isActive
            ? "ACTIVE"
            : round.status
              ? round.status.toUpperCase()
              : "—"}
        </span>
      </div>

      <div
        className="g365-nflp-round-body"
        style={
          styles.roundBody
        }
      >
        {slots.map(
          (
            game,
            index
          ) =>
            game
              ? (
                <GameCard
                  key={
                    game.nflGameId ||
                    `${round.roundNumber}-${index}`
                  }
                  game={
                    game
                  }
                  teamMap={
                    teamMap
                  }
                />
              )
              : (
                <TbdGame
                  key={
                    `${round.roundNumber}-tbd-${index}`
                  }
                  slot={
                    index + 1
                  }
                />
              )
        )}
      </div>
    </section>
  );
}


function GameCard({
  game,
  teamMap,
}: {
  game:
    BracketGame;
  teamMap:
    Map<
      number,
      TeamRow
    >;
}) {
  return (
    <article
      className="g365-nflp-game-card"
      style={
        styles.game
      }
    >
      <div
        style={
          styles.gameTop
        }
      >
        <span>
          {formatKickoff(
            game.kickoffAt
          )}
        </span>

        <strong
          style={
            game.isFinal
              ? styles.statusFinal
              : styles.status
          }
        >
          {gameStatus(
            game
          )}
        </strong>
      </div>

      <TeamLine
        teamId={
          game.awayTeamId
        }
        score={
          game.awayScore
        }
        winner={
          Boolean(
            game.isFinal &&
            game.winnerTeamId ===
              game.awayTeamId
          )
        }
        teamMap={
          teamMap
        }
      />

      <TeamLine
        teamId={
          game.homeTeamId
        }
        score={
          game.homeScore
        }
        winner={
          Boolean(
            game.isFinal &&
            game.winnerTeamId ===
              game.homeTeamId
          )
        }
        teamMap={
          teamMap
        }
      />
    </article>
  );
}


function TeamLine({
  teamId,
  score,
  winner,
  teamMap,
}: {
  teamId:
    number |
    null;
  score:
    number |
    null;
  winner:
    boolean;
  teamMap:
    Map<
      number,
      TeamRow
    >;
}) {
  const team =
    teamId
      ? teamMap.get(
          teamId
        )
      : null;

  const abbreviation =
    team
      ?.abbreviation ??
    "TBD";

  const name =
    team
      ?.name ??
    (
      teamId
        ? `NFL Team ${teamId}`
        : "TBD"
    );

  return (
    <div
      className="g365-nflp-game-team-row"
      style={{
        ...styles.teamLine,
        ...(winner
          ? styles.teamLineWinner
          : {}),
      }}
    >
      <div
        style={
          styles.teamIdentity
        }
      >
        <span
          style={
            styles.teamAbbreviation
          }
        >
          {abbreviation}
        </span>

        <strong
          className="g365-nflp-game-team-name"
          title={
            name
          }
        >
          {name}
        </strong>
      </div>

      <strong
        style={
          styles.gameScore
        }
      >
        {score ??
          "—"}
      </strong>
    </div>
  );
}


function TbdGame({
  slot,
}: {
  slot:
    number;
}) {
  return (
    <article
      className="g365-nflp-game-card"
      style={
        styles.tbdGame
      }
    >
      <span
        style={
          styles.tbdLabel
        }
      >
        MATCHUP {slot}
      </span>

      <strong>
        TBD
      </strong>

      <span
        style={
          styles.tbdCopy
        }
      >
        Waiting for the NFL playoff matchup to be determined.
      </span>
    </article>
  );
}


function Stat({
  label,
  value,
}: {
  label:
    string;
  value:
    string |
    number;
}) {
  return (
    <div
      style={
        styles.stat
      }
    >
      <span
        style={
          styles.statLabel
        }
      >
        {label}
      </span>

      <strong
        style={
          styles.statValue
        }
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
      minHeight:
        "100vh",
      padding:
        "20px",
      background:
        "linear-gradient(180deg,#07080c,#0b0d12 50%,#07080b)",
      color:
        "#f5f7fa",
    },

    shell: {
      width:
        "min(1500px,100%)",
      margin:
        "0 auto",
    },

    hero: {
      display:
        "flex",
      alignItems:
        "center",
      justifyContent:
        "space-between",
      gap:
        "16px",
      flexWrap:
        "wrap",
      padding:
        "20px",
      marginBottom:
        "14px",
      border:
        "1px solid rgba(255,88,28,.28)",
      borderRadius:
        "16px",
      background:
        "linear-gradient(135deg,rgba(147,15,15,.24),rgba(255,91,27,.09),rgba(255,255,255,.02))",
    },

    eyebrow: {
      color:
        "#ff6a2b",
      fontSize:
        "11px",
      fontWeight:
        950,
      letterSpacing:
        ".14em",
    },

    title: {
      margin:
        "5px 0 0",
      fontSize:
        "34px",
      fontWeight:
        950,
      letterSpacing:
        "-.03em",
    },

    subtitle: {
      margin:
        "7px 0 0",
      color:
        "#969da8",
      fontSize:
        "13px",
      lineHeight:
        1.5,
    },

    button: {
      display:
        "inline-flex",
      alignItems:
        "center",
      justifyContent:
        "center",
      minHeight:
        "44px",
      padding:
        "10px 14px",
      border:
        "1px solid rgba(255,100,40,.35)",
      borderRadius:
        "9px",
      background:
        "linear-gradient(135deg,#b51b18,#ef531d)",
      color:
        "#fff",
      fontSize:
        "11px",
      fontWeight:
        900,
      textDecoration:
        "none",
    },

    section: {
      padding:
        "17px",
      marginBottom:
        "14px",
      border:
        "1px solid rgba(255,255,255,.08)",
      borderRadius:
        "14px",
      background:
        "rgba(14,17,23,.92)",
    },

    summary: {
      display:
        "grid",
      gridTemplateColumns:
        "repeat(4,minmax(0,1fr))",
      gap:
        "8px",
    },

    stat: {
      minWidth:
        0,
      padding:
        "12px",
      border:
        "1px solid rgba(255,255,255,.07)",
      borderRadius:
        "10px",
      background:
        "#0a0d12",
      display:
        "flex",
      flexDirection:
        "column",
      gap:
        "4px",
    },

    statLabel: {
      color:
        "#7f8793",
      fontSize:
        "9px",
      fontWeight:
        900,
      letterSpacing:
        ".08em",
      textTransform:
        "uppercase",
    },

    statValue: {
      overflow:
        "hidden",
      textOverflow:
        "ellipsis",
      color:
        "#fff",
      fontSize:
        "14px",
      fontWeight:
        950,
    },

    sectionHead: {
      display:
        "flex",
      justifyContent:
        "space-between",
      gap:
        "14px",
      alignItems:
        "flex-end",
      flexWrap:
        "wrap",
      marginBottom:
        "14px",
    },

    sectionEyebrow: {
      color:
        "#ff6a2b",
      fontSize:
        "10px",
      fontWeight:
        900,
      letterSpacing:
        ".12em",
    },

    sectionTitle: {
      margin:
        "3px 0 0",
      fontSize:
        "21px",
      fontWeight:
        950,
    },

    sectionMeta: {
      color:
        "#858d99",
      fontSize:
        "11px",
      lineHeight:
        1.45,
      maxWidth:
        "590px",
    },

    mobileNote: {
      display:
        "none",
      marginBottom:
        "10px",
      padding:
        "9px 10px",
      border:
        "1px solid rgba(255,255,255,.07)",
      borderRadius:
        "9px",
      background:
        "#0a0d12",
      color:
        "#8f97a3",
      fontSize:
        "10px",
      lineHeight:
        1.4,
    },

    round: {
      minWidth:
        0,
      border:
        "1px solid rgba(255,255,255,.08)",
      borderRadius:
        "13px",
      overflow:
        "hidden",
      background:
        "#090c11",
    },

    roundActive: {
      border:
        "1px solid rgba(255,91,30,.35)",
      boxShadow:
        "0 0 0 1px rgba(255,91,30,.06) inset",
    },

    roundHead: {
      minHeight:
        "62px",
      display:
        "flex",
      alignItems:
        "center",
      justifyContent:
        "space-between",
      gap:
        "10px",
      padding:
        "11px 12px",
      borderBottom:
        "1px solid rgba(255,255,255,.07)",
      background:
        "linear-gradient(135deg,rgba(142,18,18,.30),rgba(255,92,28,.08))",
    },

    roundKicker: {
      display:
        "block",
      marginBottom:
        "3px",
      color:
        "#8b929e",
      fontSize:
        "8px",
      fontWeight:
        900,
      letterSpacing:
        ".11em",
    },

    roundTitle: {
      display:
        "block",
      color:
        "#fff",
      fontSize:
        "13px",
      fontWeight:
        950,
      lineHeight:
        1.15,
    },

    roundStatus: {
      flex:
        "0 0 auto",
      padding:
        "4px 6px",
      border:
        "1px solid rgba(255,255,255,.08)",
      borderRadius:
        "999px",
      color:
        "#808894",
      background:
        "rgba(255,255,255,.025)",
      fontSize:
        "8px",
      fontWeight:
        900,
      letterSpacing:
        ".07em",
    },

    roundStatusActive: {
      border:
        "1px solid rgba(255,92,29,.26)",
      color:
        "#ff7840",
      background:
        "rgba(255,92,29,.08)",
    },

    roundBody: {
      display:
        "flex",
      flexDirection:
        "column",
      justifyContent:
        "space-around",
      gap:
        "11px",
      minHeight:
        "100%",
      padding:
        "11px",
    },

    game: {
      overflow:
        "hidden",
      border:
        "1px solid rgba(255,255,255,.10)",
      borderRadius:
        "10px",
      background:
        "#0d1016",
    },

    gameTop: {
      display:
        "flex",
      alignItems:
        "center",
      justifyContent:
        "space-between",
      gap:
        "8px",
      minHeight:
        "32px",
      padding:
        "7px 9px",
      borderBottom:
        "1px solid rgba(255,255,255,.06)",
      color:
        "#7e8692",
      fontSize:
        "8px",
      fontWeight:
        800,
      lineHeight:
        1.2,
    },

    status: {
      flex:
        "0 0 auto",
      color:
        "#9ea5af",
      fontSize:
        "8px",
      fontWeight:
        950,
      letterSpacing:
        ".05em",
      textTransform:
        "uppercase",
    },

    statusFinal: {
      flex:
        "0 0 auto",
      color:
        "#65d08d",
      fontSize:
        "8px",
      fontWeight:
        950,
      letterSpacing:
        ".06em",
    },

    teamLine: {
      minWidth:
        0,
      display:
        "flex",
      alignItems:
        "center",
      justifyContent:
        "space-between",
      gap:
        "8px",
      padding:
        "10px 9px",
      borderBottom:
        "1px solid rgba(255,255,255,.05)",
    },

    teamLineWinner: {
      background:
        "rgba(31,132,77,.14)",
    },

    teamIdentity: {
      minWidth:
        0,
      display:
        "flex",
      alignItems:
        "center",
      gap:
        "8px",
    },

    teamAbbreviation: {
      flex:
        "0 0 auto",
      minWidth:
        "34px",
      color:
        "#ff7437",
      fontSize:
        "10px",
      fontWeight:
        950,
      letterSpacing:
        ".03em",
    },

    gameScore: {
      flex:
        "0 0 auto",
      color:
        "#fff",
      fontSize:
        "16px",
      fontWeight:
        950,
      fontVariantNumeric:
        "tabular-nums",
    },

    tbdGame: {
      minHeight:
        "92px",
      display:
        "flex",
      flexDirection:
        "column",
      alignItems:
        "center",
      justifyContent:
        "center",
      gap:
        "3px",
      padding:
        "12px",
      border:
        "1px dashed rgba(255,255,255,.11)",
      borderRadius:
        "10px",
      background:
        "#090b10",
      color:
        "#929aa5",
      textAlign:
        "center",
    },

    tbdLabel: {
      color:
        "#6f7782",
      fontSize:
        "8px",
      fontWeight:
        900,
      letterSpacing:
        ".09em",
    },

    tbdCopy: {
      maxWidth:
        "190px",
      color:
        "#69717c",
      fontSize:
        "8px",
      lineHeight:
        1.35,
    },

    notice: {
      display:
        "flex",
      flexDirection:
        "column",
      gap:
        "5px",
      padding:
        "14px",
      marginBottom:
        "14px",
      border:
        "1px solid rgba(255,100,40,.18)",
      borderRadius:
        "11px",
      background:
        "rgba(102,29,14,.12)",
      color:
        "#c7cbd2",
      fontSize:
        "11px",
      lineHeight:
        1.5,
    },
  };
