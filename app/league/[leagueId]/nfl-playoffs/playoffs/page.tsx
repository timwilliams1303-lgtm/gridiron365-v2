import type {
  CSSProperties,
} from "react";

import Link from "next/link";

import {
  requireLeagueMember,
} from "@/lib/leagues/requireLeagueMember";

import {
  createSupabaseServerClient,
} from "@/lib/supabase/server";


type PageProps = {
  params: Promise<{
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
    3:
      "Conference Championships",
    4: "Super Bowl",
  };


function safeNumber(
  value: unknown
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
  value: unknown
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
  value: unknown
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
      ) ===
      "string"
        ? String(
            row.espnEventId ??
            row.espn_event_id
          )
        : null,

    kickoffAt:
      typeof (
        row.kickoffAt ??
        row.kickoff_at
      ) ===
      "string"
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
      ) ===
      "string"
        ? String(
            row.statusType ??
            row.status_type
          )
        : null,

    statusName:
      typeof (
        row.statusName ??
        row.status_name
      ) ===
      "string"
        ? String(
            row.statusName ??
            row.status_name
          )
        : null,

    statusDetail:
      typeof (
        row.statusDetail ??
        row.status_detail
      ) ===
      "string"
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
  value: unknown
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
      ) ===
      "string"
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
      ) ===
      "string"
        ? String(
            row.firstKickoffAt ??
            row.first_kickoff_at
          )
        : null,

    lastScheduledKickoffAt:
      typeof (
        row.lastScheduledKickoffAt ??
        row.last_scheduled_kickoff_at
      ) ===
      "string"
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
  value: unknown
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
  if (
    !value
  ) {
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


  return new Intl
    .DateTimeFormat(
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
    )
    .format(
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


  return (
    raw ||
    "SCHEDULED"
  );
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
            roundNumber ===
            4
              ? 5
              : roundNumber,

          status:
            null,

          firstKickoffAt:
            null,

          lastScheduledKickoffAt:
            null,

          games: [],
        }
    );


  const leagueState =
    stateResult.data;


  const activeRoundRaw =
    Number(
      leagueState
        ?.active_round ??
      1
    );


  const activeRound =
    Number.isInteger(
      activeRoundRaw
    ) &&
    activeRoundRaw >=
      1 &&
    activeRoundRaw <=
      4
      ? activeRoundRaw
      : 1;


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

        .g365-nflp-game-team-name {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        /*
         * =========================================================
         * REAL BRACKET
         * =========================================================
         */

        .g365-real-bracket-viewport {
          width: 100%;
          overflow-x: auto;
          overflow-y: visible;
          padding: 8px 2px 30px;
          -webkit-overflow-scrolling: touch;
        }

        .g365-real-bracket {
          min-width: 1500px;
          min-height: 1040px;

          display: grid;

          grid-template-columns:
            250px
            58px
            250px
            58px
            250px
            58px
            250px
            58px
            220px;

          gap: 0;

          align-items: stretch;

          position: relative;
        }

        /*
         * Round columns.
         */

        .g365-bracket-round,
        .g365-champion-column {
          min-width: 0;

          display: grid;

          grid-template-rows:
            58px
            1fr;
        }

        .g365-bracket-round-heading {
          display: grid;

          align-content: center;

          justify-items: center;

          gap: 3px;

          text-align: center;
        }

        .g365-bracket-round-heading > span {
          color: #ff6a2b;

          font-size: 10px;

          font-weight: 950;

          letter-spacing: .12em;
        }

        .g365-bracket-round-heading > small {
          color: #737d8c;

          font-size: 8px;

          font-weight: 900;

          letter-spacing: .05em;
        }

        .g365-bracket-round-track {
          height: 960px;

          display: grid;

          align-items: center;
        }

        /*
         * Wild Card — six games.
         */

        .round-wild-card
        .g365-bracket-round-track {
          grid-template-rows:
            repeat(
              6,
              minmax(0,1fr)
            );

          gap: 12px;
        }

        /*
         * Divisional — four games,
         * vertically centered between Wild Card slots.
         */

        .round-divisional
        .g365-bracket-round-track {
          grid-template-rows:
            repeat(
              4,
              minmax(0,1fr)
            );

          gap: 72px;

          padding:
            54px 0;
        }

        /*
         * Conference Championships.
         */

        .round-conference
        .g365-bracket-round-track {
          grid-template-rows:
            repeat(
              2,
              minmax(0,1fr)
            );

          gap: 285px;

          padding:
            145px 0;
        }

        /*
         * Super Bowl.
         */

        .round-super-bowl
        .g365-bracket-round-track {
          display: flex;

          align-items: center;

          justify-content: center;
        }

        .round-super-bowl
        .g365-nflp-game-card {
          width: 100%;
        }

        /*
         * =========================================================
         * CONNECTORS
         * =========================================================
         */

        .g365-bracket-connectors {
          position: relative;

          min-height: 960px;

          margin-top: 58px;
        }

        .g365-bracket-connector {
          position: absolute;

          left: 0;

          right: 0;

          height: 2px;

          background:
            linear-gradient(
              90deg,
              rgba(255,105,42,.55),
              rgba(255,255,255,.24),
              rgba(255,105,42,.55)
            );
        }

        .g365-bracket-connector::before,
        .g365-bracket-connector::after {
          content: "";

          position: absolute;

          width: 2px;

          height: 46px;

          top: -22px;

          background:
            rgba(255,112,45,.40);
        }

        .g365-bracket-connector::before {
          left: 0;
        }

        .g365-bracket-connector::after {
          right: 0;
        }

        /*
         * Wild Card -> Divisional.
         */

        .connector-1
        .g365-bracket-connector:nth-child(1) {
          top: 13%;
        }

        .connector-1
        .g365-bracket-connector:nth-child(2) {
          top: 37%;
        }

        .connector-1
        .g365-bracket-connector:nth-child(3) {
          top: 63%;
        }

        .connector-1
        .g365-bracket-connector:nth-child(4) {
          top: 87%;
        }

        /*
         * Divisional -> Conference.
         */

        .connector-2
        .g365-bracket-connector:nth-child(1) {
          top: 25%;
        }

        .connector-2
        .g365-bracket-connector:nth-child(2) {
          top: 75%;
        }

        /*
         * Conference -> Super Bowl.
         */

        .connector-3
        .g365-bracket-connector {
          top: 50%;
        }

        /*
         * Super Bowl -> Champion.
         */

        .connector-4
        .g365-bracket-connector {
          top: 50%;
        }

        /*
         * =========================================================
         * CHAMPION
         * =========================================================
         */

        .g365-champion-column {
          padding-left: 4px;
        }

        .g365-champion-track {
          display: flex;

          align-items: center;

          justify-content: center;
        }

        .g365-champion-card {
          width: 100%;

          display: grid;

          justify-items: center;

          gap: 8px;

          padding: 24px 14px;

          border:
            1px solid
            rgba(255,171,55,.44);

          border-radius: 15px;

          background:
            linear-gradient(
              145deg,
              rgba(255,151,35,.15),
              rgba(127,22,14,.17),
              #0c0e13
            );

          box-shadow:
            0 0 30px
            rgba(255,105,30,.10);

          text-align: center;
        }

        .g365-champion-trophy {
          font-size: 30px;
        }

        .g365-champion-card strong {
          color: #fff;

          font-size: 17px;

          font-weight: 950;

          line-height: 1.2;
        }

        .g365-champion-card span {
          color: #f2b758;

          font-size: 9px;

          font-weight: 900;

          line-height: 1.4;
        }

        /*
         * =========================================================
         * MOBILE
         * =========================================================
         */

        @media (max-width: 760px) {
          .g365-nflp-bracket-page {
            padding:
              12px 10px 76px
              !important;
          }

          .g365-nflp-hero {
            padding:
              16px
              !important;
          }

          .g365-nflp-hero h1 {
            font-size:
              27px
              !important;
          }

          .g365-nflp-summary {
            grid-template-columns:
              repeat(
                2,
                minmax(0,1fr)
              )
              !important;
          }

          .g365-real-bracket-viewport {
            overflow-x: visible;

            padding-bottom: 0;
          }

          .g365-real-bracket {
            min-width: 0;

            min-height: auto;

            display: grid;

            grid-template-columns:
              minmax(0,1fr);

            gap: 16px;
          }

          .g365-bracket-connectors {
            display: none;
          }

          .g365-bracket-round,
          .g365-champion-column {
            display: block;
          }

          .g365-bracket-round-heading {
            min-height: 48px;
          }

          .g365-bracket-round-track,
          .round-wild-card
          .g365-bracket-round-track,
          .round-divisional
          .g365-bracket-round-track,
          .round-conference
          .g365-bracket-round-track,
          .round-super-bowl
          .g365-bracket-round-track {
            width: 100%;

            height: auto;

            display: grid;

            grid-template-rows: none;

            gap: 9px;

            padding: 0;
          }

          .g365-champion-column {
            padding-left: 0;
          }

          .g365-champion-track {
            display: block;
          }

          .g365-champion-card {
            margin-top: 8px;
          }

          .g365-nflp-mobile-note {
            display:
              block
              !important;
          }
        }

        @media (max-width: 430px) {
          .g365-nflp-summary {
            grid-template-columns:
              minmax(0,1fr)
              !important;
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
              Wild Card → Divisional → Conference Championships → Super Bowl → Champion
            </p>
          </div>


          <Link
            href={`/league/${leagueId}/nfl-playoffs/standings`}
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
              The bracket follows the actual NFL postseason. Completed NFL games advance their winners while future matchups remain TBD until officially determined.
            </span>
          </div>


          <div
            className="g365-nflp-mobile-note"
            style={
              styles.mobileNote
            }
          >
            On mobile, playoff rounds stack vertically. On desktop, follow the connected bracket from Wild Card through the Champion.
          </div>


          <div
            className="g365-real-bracket-viewport"
          >
            <div
              className="g365-real-bracket"
            >
              <BracketRoundColumn
                title="WILD CARD"
                subtitle="6 GAMES"
                className="round-wild-card"
                round={
                  rounds[0]
                }
                teamMap={
                  teamMap
                }
                expectedGames={
                  6
                }
                active={
                  activeRound ===
                  1
                }
              />


              <BracketConnectors
                className="connector-1"
                count={
                  4
                }
              />


              <BracketRoundColumn
                title="DIVISIONAL"
                subtitle="4 GAMES"
                className="round-divisional"
                round={
                  rounds[1]
                }
                teamMap={
                  teamMap
                }
                expectedGames={
                  4
                }
                active={
                  activeRound ===
                  2
                }
              />


              <BracketConnectors
                className="connector-2"
                count={
                  2
                }
              />


              <BracketRoundColumn
                title="CONFERENCE"
                subtitle="AFC + NFC CHAMPIONSHIPS"
                className="round-conference"
                round={
                  rounds[2]
                }
                teamMap={
                  teamMap
                }
                expectedGames={
                  2
                }
                active={
                  activeRound ===
                  3
                }
              />


              <BracketConnectors
                className="connector-3"
                count={
                  1
                }
              />


              <BracketRoundColumn
                title="SUPER BOWL"
                subtitle="NFL CHAMPIONSHIP"
                className="round-super-bowl"
                round={
                  rounds[3]
                }
                teamMap={
                  teamMap
                }
                expectedGames={
                  1
                }
                active={
                  activeRound ===
                  4
                }
              />


              <BracketConnectors
                className="connector-4"
                count={
                  1
                }
              />


              <ChampionCard
                round={
                  rounds[3]
                }
                teamMap={
                  teamMap
                }
              />
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
            This is the actual NFL postseason bracket, not a fantasy head-to-head playoff bracket. The NFL teams that remain alive determine which players remain eligible for each G365 postseason round.
          </span>
        </section>


        <div
          aria-hidden="true"
          style={{
            height:
              20,
          }}
        />
      </div>
    </main>
  );
}


function BracketRoundColumn({
  title,
  subtitle,
  className,
  round,
  teamMap,
  expectedGames,
  active,
}: {
  title: string;

  subtitle: string;

  className: string;

  round:
    BracketRound;

  teamMap:
    Map<
      number,
      TeamRow
    >;

  expectedGames:
    number;

  active:
    boolean;
}) {
  const slots =
    Array.from(
      {
        length:
          expectedGames,
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
      className={`g365-bracket-round ${className}`}
    >
      <div
        className="g365-bracket-round-heading"
      >
        <span>
          {title}
        </span>


        <small>
          {subtitle}
          {active
            ? " • ACTIVE"
            : ""}
        </small>
      </div>


      <div
        className="g365-bracket-round-track"
      >
        {slots.map(
          (
            game,
            index
          ) =>
            game ? (
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
            ) : (
              <TbdGame
                key={`${round.roundNumber}-tbd-${index}`}
                slot={
                  index +
                  1
                }
              />
            )
        )}
      </div>
    </section>
  );
}


function BracketConnectors({
  className,
  count,
}: {
  className: string;

  count: number;
}) {
  return (
    <div
      className={`g365-bracket-connectors ${className}`}
      aria-hidden="true"
    >
      {Array.from({
        length:
          count,
      }).map(
        (
          _,
          index
        ) => (
          <span
            key={
              index
            }
            className="g365-bracket-connector"
          />
        )
      )}
    </div>
  );
}


function ChampionCard({
  round,
  teamMap,
}: {
  round:
    BracketRound;

  teamMap:
    Map<
      number,
      TeamRow
    >;
}) {
  const superBowl =
    round.games[0] ??
    null;


  const championTeamId =
    superBowl
      ?.isFinal
      ? superBowl
          .winnerTeamId
      : null;


  const champion =
    championTeamId
      ? teamMap.get(
          championTeamId
        ) ??
        null
      : null;


  return (
    <section
      className="g365-champion-column"
    >
      <div
        className="g365-bracket-round-heading"
      >
        <span>
          CHAMPION
        </span>


        <small>
          NFL CHAMPION
        </small>
      </div>


      <div
        className="g365-champion-track"
      >
        <div
          className="g365-champion-card"
        >
          <div
            className="g365-champion-trophy"
          >
            🏆
          </div>


          <strong>
            {champion
              ?.name ??
              "TBD"}
          </strong>


          <span>
            {champion
              ?.abbreviation ??
              "Waiting for Super Bowl Final"}
          </span>
        </div>
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
            game
              .winnerTeamId ===
              game
                .awayTeamId
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
            game
              .winnerTeamId ===
              game
                .homeTeamId
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
    CSSProperties
  > = {
    page: {
      minHeight:
        "100vh",

      padding:
        "20px 20px 64px",

      background:
        "linear-gradient(180deg,#07080c,#0b0d12 50%,#07080b)",

      color:
        "#f5f7fa",
    },


    shell: {
      width:
        "min(1600px,100%)",

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


    game: {
      overflow:
        "hidden",

      border:
        "1px solid rgba(255,255,255,.11)",

      borderRadius:
        "10px",

      background:
        "#0d1016",

      boxShadow:
        "0 8px 18px rgba(0,0,0,.22)",
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
        "linear-gradient(90deg,rgba(31,132,77,.18),rgba(31,132,77,.05))",
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
        "1px dashed rgba(255,255,255,.13)",

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
        "#ff6f34",

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