import Image from "next/image";
import Link from "next/link";

import {
  notFound,
} from "next/navigation";

import {
  createSupabaseServerClient,
} from "@/lib/supabase/server";

import {
  getTraditionalMatchupDetailData,
  type MatchupDetailGameContext,
  type MatchupDetailPlayer,
  type MatchupDetailTeam,
} from "@/lib/traditional/matchup-detail.service";

import {
  requireTraditionalLeague,
} from "@/lib/traditional/requireTraditionalLeague";


type PageProps = {
  params:
    Promise<{
      leagueId: string;
      matchupId: string;
    }>;
};


function points(
  value: number
) {
  return value.toFixed(2);
}


function quarter(
  period:
    number |
    null
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


function matchupStatus(
  isLive: boolean,
  isFinal: boolean,
  tied: boolean
) {
  if (
    isFinal &&
    tied
  ) {
    return "FINAL • TIE";
  }


  if (isFinal) {
    return "FINAL";
  }


  if (isLive) {
    return "LIVE";
  }


  return "SCHEDULED";
}


function playerStatus(
  player:
    MatchupDetailPlayer
) {
  const context =
    player.gameContext;


  if (
    context
      ?.isActuallyLive
  ) {
    return [
      quarter(
        context.period
      ),

      context.clock,
    ]
      .filter(Boolean)
      .join(" ");
  }


  if (
    player.scoreIsFinal ||
    context
      ?.statusCompleted
  ) {
    return "FINAL";
  }


  if (
    player.isLocked
  ) {
    return "LOCKED";
  }


  return "—";
}


function calculateSimpleWinProbability(
  away:
    MatchupDetailTeam,
  home:
    MatchupDetailTeam,
  awayCurrent: number,
  homeCurrent: number
) {
  /*
   * Temporary win-probability model.
   *
   * Both teams must have starters. Current/displayed fantasy
   * points are used immediately. Remaining-player expectation
   * stays intentionally simple until true projections exist.
   */

  if (
    away.starters.length ===
      0 ||
    home.starters.length ===
      0
  ) {
    return null;
  }


  if (
    away.playersRemaining ===
      0 &&
    home.playersRemaining ===
      0
  ) {
    if (
      awayCurrent ===
      homeCurrent
    ) {
      return {
        away: 50,
        home: 50,
      };
    }


    return {
      away:
        awayCurrent >
        homeCurrent
          ? 100
          : 0,

      home:
        homeCurrent >
        awayCurrent
          ? 100
          : 0,
    };
  }


  const awayExpectedRemaining =
    away.playersRemaining *
    8;


  const homeExpectedRemaining =
    home.playersRemaining *
    8;


  const awayExpectedFinal =
    awayCurrent +
    awayExpectedRemaining;


  const homeExpectedFinal =
    homeCurrent +
    homeExpectedRemaining;


  const expectedDifference =
    awayExpectedFinal -
    homeExpectedFinal;


  const rawAway =
    100 /
    (
      1 +
      Math.exp(
        -expectedDifference /
        14
      )
    );


  const awayPct =
    Math.max(
      1,
      Math.min(
        99,
        rawAway
      )
    );


  return {
    away:
      awayPct,

    home:
      100 -
      awayPct,
  };
}


function displayedPlayersLive(
  team:
    MatchupDetailTeam
) {
  return team.starters.filter(
    (
      player
    ) =>
      Boolean(
        player.gameContext
          ?.isActuallyLive ||
        player.scoreIsLive
      )
  ).length;
}


export default async function TraditionalMatchupDetailPage({
  params,
}: PageProps) {
  const {
    leagueId,
    matchupId:
      rawMatchupId,
  } =
    await params;


  const matchupId =
    Number(
      rawMatchupId
    );


  if (
    !Number.isInteger(
      matchupId
    ) ||
    matchupId <= 0
  ) {
    notFound();
  }


  const access =
    await requireTraditionalLeague(
      leagueId
    );


  const supabase =
    await createSupabaseServerClient();


  let data;


  try {
    data =
      await getTraditionalMatchupDetailData(
        supabase,
        leagueId,
        matchupId,
        access.fantasyTeam
          ?.id ??
          null
      );
  } catch (
    error
  ) {
    console.error(
      "Could not load matchup:",
      error
    );

    notFound();
  }


  const leader =
    data.home.points >
    data.away.points
      ? data.home
      : data.away.points >
          data.home.points
        ? data.away
        : null;


  const margin =
    Math.abs(
      data.home.points -
        data.away.points
    );


  const latestScoringPlay =
    data
      .recentScoringPlays[0] ??
    null;


  const hasActuallyLiveGame =
    data.liveGames.some(
      (
        game
      ) =>
        game.isActuallyLive
    );


  const displayIsLive =
    data.isLive ||
    hasActuallyLiveGame;


  const awayDisplayPoints =
    data.away.points;


  const homeDisplayPoints =
    data.home.points;


  const winProbability =
    calculateSimpleWinProbability(
      data.away,
      data.home,
      awayDisplayPoints,
      homeDisplayPoints
    );


  const awayPlayersLive =
    Math.max(
      data.away.playersLive,
      displayedPlayersLive(
        data.away
      )
    );


  const homePlayersLive =
    Math.max(
      data.home.playersLive,
      displayedPlayersLive(
        data.home
      )
    );


  const totalPlayersLive =
    awayPlayersLive +
    homePlayersLive;


  const liveNflGamesCount =
    data.liveGames.length;


  return (
    <main
      style={
        styles.page
      }
    >
      <div
        style={
          styles.shell
        }
      >
        {/* ==================================================
            TOP BAR
        =================================================== */}

        <div
          style={
            styles.topBar
          }
        >
          <Link
            href={`/league/${leagueId}/matchups?week=${data.week}`}
            style={
              styles.backLink
            }
          >
            ← Back to Matchups
          </Link>


          <strong
            style={
              styles.weekTitle
            }
          >
            Week {data.week} Matchup
          </strong>


          <span
            style={
              styles.matchupId
            }
          >
            #{data.matchupId}
          </span>
        </div>


        {/* ==================================================
            SCOREBOARD
        =================================================== */}

        <section
          style={
            styles.scoreboard
          }
        >
          <ScoreTeam
            team={
              data.away
            }
            displayPoints={
              awayDisplayPoints
            }
            playersLive={
              awayPlayersLive
            }
            playersRemaining={
              data.away.playersRemaining
            }
          />


          <div
            style={
              styles.centerScore
            }
          >
            <span
              style={
                displayIsLive
                  ? styles.liveBadge
                  : data.isFinal
                    ? styles.finalBadge
                    : styles.scheduledBadge
              }
            >
              {matchupStatus(
                displayIsLive,
                data.isFinal,
                data.tied
              )}
            </span>


            {displayIsLive ? (
              <>
                <strong
                  style={
                    styles.gameClock
                  }
                >
                  {totalPlayersLive}{" "}
                  {totalPlayersLive ===
                  1
                    ? "PLAYER"
                    : "PLAYERS"}{" "}
                  LIVE
                </strong>


                <span
                  style={
                    styles.liveSituation
                  }
                >
                  {liveNflGamesCount}{" "}
                  {liveNflGamesCount ===
                  1
                    ? "NFL GAME"
                    : "NFL GAMES"}
                </span>
              </>
            ) : (
              <span
                style={
                  styles.statusSub
                }
              >
                {leader
                  ? `${leader.teamName} +${points(margin)}`
                  : "Even matchup"}
              </span>
            )}
          </div>


          <ScoreTeam
            team={
              data.home
            }
            displayPoints={
              homeDisplayPoints
            }
            playersLive={
              homePlayersLive
            }
            playersRemaining={
              data.home.playersRemaining
            }
            right
          />
        </section>


        {/* ==================================================
            WIN PROBABILITY
        =================================================== */}

        <section
          style={
            styles.winProbabilityPanel
          }
        >
          <div
            style={
              styles.winProbabilityHeader
            }
          >
            <span
              style={
                styles.winProbabilityLabel
              }
            >
              WIN PROBABILITY
            </span>


            {!winProbability ? (
              <span
                style={
                  styles.winProbabilityUnavailable
                }
              >
                Unavailable until both lineups are set
              </span>
            ) : null}
          </div>


          {winProbability ? (
            <>
              <div
                style={
                  styles.winProbabilityTeams
                }
              >
                <div
                  style={
                    styles.probabilityTeamLeft
                  }
                >
                  <strong
                    style={
                      styles.probabilityValue
                    }
                  >
                    {winProbability.away.toFixed(
                      1
                    )}
                    %
                  </strong>

                  <span>
                    {data.away.teamName}
                  </span>
                </div>


                <div
                  style={
                    styles.probabilityTeamRight
                  }
                >
                  <strong
                    style={
                      styles.probabilityValue
                    }
                  >
                    {winProbability.home.toFixed(
                      1
                    )}
                    %
                  </strong>

                  <span>
                    {data.home.teamName}
                  </span>
                </div>
              </div>


              <div
                style={
                  styles.probabilityTrack
                }
              >
                <div
                  style={{
                    ...styles.probabilityAway,

                    width:
                      `${winProbability.away}%`,
                  }}
                />

                <div
                  style={{
                    ...styles.probabilityHome,

                    width:
                      `${winProbability.home}%`,
                  }}
                />
              </div>
            </>
          ) : (
            <div
              style={
                styles.probabilityEmptyBar
              }
            >
              <div
                style={
                  styles.probabilityEmptyHalf
                }
              />

              <div
                style={
                  styles.probabilityEmptyHalf
                }
              />
            </div>
          )}
        </section>


        {/* ==================================================
            QUICK SUMMARY BAR
        =================================================== */}

        <section
          style={
            styles.summaryBar
          }
        >
          <div
            style={
              styles.scoringHighlight
            }
          >
            <span
              style={
                styles.smallLabel
              }
            >
              LAST SCORING PLAY
            </span>


            <strong
              style={
                styles.scoringText
              }
            >
              {latestScoringPlay
                ?.text ??
                "No scoring play yet"}
            </strong>


            {latestScoringPlay ? (
              <span
                style={
                  styles.scoringTime
                }
              >
                {latestScoringPlay.period
                  ? quarter(
                      latestScoringPlay
                        .period
                    )
                  : ""}

                {latestScoringPlay.clock
                  ? ` • ${latestScoringPlay.clock}`
                  : ""}
              </span>
            ) : null}
          </div>


          <div
            style={
              styles.matchupActivity
            }
          >
            <span
              style={
                styles.smallLabel
              }
            >
              MATCHUP ACTIVITY
            </span>

            <strong
              style={
                styles.matchupActivityValue
              }
            >
              {totalPlayersLive}{" "}
              {totalPlayersLive ===
              1
                ? "PLAYER LIVE"
                : "PLAYERS LIVE"}
              {" • "}
              {liveNflGamesCount}{" "}
              {liveNflGamesCount ===
              1
                ? "NFL GAME"
                : "NFL GAMES"}
            </strong>
          </div>
        </section>


        {/* ==================================================
            MAIN GAME CENTER
        =================================================== */}

        <section
          style={
            styles.mainGrid
          }
        >
          <CompactRoster
            team={
              data.away
            }
            label="STARTERS"
            week={
              data.week
            }
          />


          <div
            style={
              styles.centerColumn
            }
          >
            <Panel
              title={`LIVE NFL GAMES • ${liveNflGamesCount}`}
            >
              {data.liveGames.length >
              0 ? (
                data.liveGames
                  .slice(
                    0,
                    3
                  )
                  .map(
                    (
                      game
                    ) => (
                      <LiveGame
                        key={
                          game.nflGameId
                        }
                        game={
                          game
                        }
                      />
                    )
                  )
              ) : (
                <div
                  style={
                    styles.emptyCenter
                  }
                >
                  No NFL games currently
                  live.
                </div>
              )}
            </Panel>


            <Panel
              title="RECENT SCORING PLAYS"
            >
              {data
                .recentScoringPlays
                .length >
              0 ? (
                data
                  .recentScoringPlays
                  .slice(
                    0,
                    5
                  )
                  .map(
                    (
                      play
                    ) => (
                      <div
                        key={
                          play.espnPlayId
                        }
                        style={
                          styles.scoringRow
                        }
                      >
                        <span
                          style={
                            styles.scoringDot
                          }
                        >
                          TD
                        </span>


                        <div
                          style={
                            styles.scoringRowText
                          }
                        >
                          <strong>
                            {play
                              .possessionTeamAbbreviation ??
                              "NFL"}
                          </strong>

                          <span>
                            {play.text}
                          </span>
                        </div>


                        <span
                          style={
                            styles.scoringPoints
                          }
                        >
                          {play.scoreValue
                            ? `+${play.scoreValue}`
                            : ""}
                        </span>
                      </div>
                    )
                  )
              ) : (
                <div
                  style={
                    styles.emptyCenter
                  }
                >
                  No scoring plays yet.
                </div>
              )}
            </Panel>
          </div>


          <CompactRoster
            team={
              data.home
            }
            label="STARTERS"
            week={
              data.week
            }
          />
        </section>


        {/* ==================================================
            COMPACT BENCH
        =================================================== */}

        <section
          style={
            styles.benchGrid
          }
        >
          <CompactBench
            team={
              data.away
            }
          />


          <div />


          <CompactBench
            team={
              data.home
            }
          />
        </section>
      </div>
    </main>
  );
}


function ScoreTeam({
  team,
  displayPoints,
  playersLive,
  playersRemaining,
  right = false,
}: {
  team:
    MatchupDetailTeam;

  displayPoints: number;

  playersLive: number;

  playersRemaining: number;

  right?: boolean;
}) {
  const logo = (
    <div
      style={{
        ...styles.teamCircle,

        ...(team.isMyTeam
          ? styles.myTeamCircle
          : {}),
      }}
    >
      {team.teamName
        .slice(
          0,
          1
        )
        .toUpperCase()}
    </div>
  );


  const teamInfo = (
    <div
      style={{
        ...styles.scoreTeamText,

        ...(right
          ? styles.scoreTeamTextRight
          : {}),
      }}
    >
      <strong
        style={{
          ...styles.scoreTeamName,

          ...(right
            ? styles.scoreTeamNameRight
            : {}),
        }}
      >
        {team.teamName}
      </strong>


      <div
        style={{
          ...styles.teamMetaLine,

          ...(right
            ? styles.teamMetaLineRight
            : {}),
        }}
      >
        {team.isMyTeam ? (
          <span
            style={
              styles.myTeamMeta
            }
          >
            MY TEAM
          </span>
        ) : team.isWinner ? (
          <span
            style={
              styles.winnerMeta
            }
          >
            WINNER
          </span>
        ) : null}


        <span
          style={
            playersLive >
            0
              ? styles.liveMeta
              : styles.mutedMeta
          }
        >
          {playersLive} LIVE
        </span>


        <span
          style={
            styles.metaDivider
          }
        >
          •
        </span>


        <span
          style={
            styles.remainingMeta
          }
        >
          {playersRemaining} REMAINING
        </span>
      </div>
    </div>
  );


  const score = (
    <strong
      style={{
        ...styles.mainScore,

        ...(team.isWinner
          ? styles.winnerScore
          : {}),
      }}
    >
      {points(
        displayPoints
      )}
    </strong>
  );


  return (
    <div
      style={{
        ...styles.scoreTeam,

        ...(right
          ? styles.scoreTeamRight
          : {}),
      }}
    >
      {right ? (
        <>
          {score}
          {teamInfo}
          {logo}
        </>
      ) : (
        <>
          {logo}
          {teamInfo}
          {score}
        </>
      )}
    </div>
  );
}


function QuickStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div
      style={
        styles.quickStat
      }
    >
      <span
        style={
          styles.smallLabel
        }
      >
        {label}
      </span>

      <strong
        style={
          styles.quickValue
        }
      >
        {value}
      </strong>
    </div>
  );
}


function Panel({
  title,
  children,
}: {
  title: string;

  children:
    React.ReactNode;
}) {
  return (
    <div
      style={
        styles.panel
      }
    >
      <div
        style={
          styles.panelTitle
        }
      >
        {title}
      </div>

      {children}
    </div>
  );
}


function LiveGame({
  game,
}: {
  game:
    MatchupDetailGameContext;
}) {
  return (
    <div
      style={{
        ...styles.liveGame,

        ...(game.redZone
          ? styles.liveGameRedZone
          : {}),
      }}
    >
      <div
        style={
          styles.liveGameTop
        }
      >
        <div
          style={
            styles.liveGameState
          }
        >
          <strong
            style={
              game.redZone
                ? styles.redText
                : styles.greenText
            }
          >
            {game.redZone
              ? "RED ZONE"
              : "LIVE"}
          </strong>


          <span
            style={
              styles.liveGamePossessionMini
            }
          >
            {game
              .possessionTeam
              ?.abbreviation ??
              "NFL"}{" "}
            BALL
          </span>
        </div>


        <span>
          {quarter(
            game.period
          )}
          {" • "}
          {game.clock ??
            "--:--"}
        </span>
      </div>


      <span
        style={
          styles.driveInfo
        }
      >
        {game.downLabel ??
          "Drive"}

        {game.yardsToEndzone !==
        null
          ? ` • ${game.yardsToEndzone} YDS TO GOAL`
          : ""}
      </span>


      {game.latestPlay?.text ? (
        <span
          style={
            styles.lastPlay
          }
        >
          {game.latestPlay.text}
        </span>
      ) : null}
    </div>
  );
}


function CompactRoster({
  team,
  label,
  week,
}: {
  team:
    MatchupDetailTeam;

  label: string;

  week: number;
}) {
  return (
    <div
      style={
        styles.rosterPanel
      }
    >
      <div
        style={
          styles.rosterHeader
        }
      >
        <span>
          {label}
        </span>

        <strong>
          {team.teamName}
        </strong>
      </div>


      {team.starters.length ===
      0 ? (
        <div
          style={
            styles.lineupEmptyState
          }
        >
          <strong
            style={
              styles.lineupEmptyTitle
            }
          >
            LINEUP NOT SET
          </strong>

          <span
            style={
              styles.lineupEmptyText
            }
          >
            No Week {week} lineup has
            been created for this team
            yet.
          </span>
        </div>
      ) : (
        <>
          <div
            style={
              styles.tableHeader
            }
          >
            <span>
              SLOT
            </span>

            <span>
              PLAYER
            </span>

            <span>
              OPP
            </span>

            <span>
              STATUS
            </span>

            <span
              style={
                styles.rightText
              }
            >
              PTS
            </span>
          </div>


          {team.starters.map(
            (
              player
            ) => (
              <CompactPlayerRow
                key={`${player.lineupSlot}:${player.slotIndex}:${player.playerId}`}
                player={
                  player
                }
              />
            )
          )}


          <div
            style={
              styles.totalRow
            }
          >
            <strong>
              TOTAL
            </strong>

            <strong>
              {points(
                team.points
              )}
            </strong>
          </div>
        </>
      )}
    </div>
  );
}


function CompactBench({
  team,
}: {
  team:
    MatchupDetailTeam;
}) {
  return (
    <div
      style={
        styles.rosterPanel
      }
    >
      <div
        style={
          styles.rosterHeader
        }
      >
        <span>
          BENCH
        </span>

        <strong>
          {team.teamName}
        </strong>
      </div>


      {team.bench.length ===
      0 ? (
        <div
          style={
            styles.benchEmpty
          }
        >
          No bench players.
        </div>
      ) : (
        team.bench
          .slice(
            0,
            6
          )
          .map(
            (
              player
            ) => (
              <CompactPlayerRow
                key={`${player.lineupSlot}:${player.slotIndex}:${player.playerId}`}
                player={
                  player
                }
                bench
              />
            )
          )
      )}
    </div>
  );
}


function CompactPlayerRow({
  player,
  bench = false,
}: {
  player:
    MatchupDetailPlayer;

  bench?: boolean;
}) {
  const possession =
    !bench &&
    player.hasPossession;


  const redZone =
    !bench &&
    player.isRedZone;


  const displayedOpponent =
    player.nflOpponent;


  return (
    <div
      style={{
        ...styles.playerRow,

        ...(possession
          ? styles.possessionRow
          : {}),

        ...(redZone
          ? styles.redZoneRow
          : {}),
      }}
    >
      <strong
        style={
          styles.slot
        }
      >
        {bench
          ? "BN"
          : player.lineupSlot}
      </strong>


      <div
        style={
          styles.playerCell
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
            width={28}
            height={28}
            style={
              styles.headshot
            }
          />
        ) : (
          <div
            style={
              styles.headshotFallback
            }
          >
            {player.position}
          </div>
        )}


        <div
          style={
            styles.playerNames
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
              {player.fullName}
            </strong>


            {redZone ? (
              <span
                style={
                  styles.redZoneTag
                }
              >
                RZ
              </span>
            ) : possession ? (
              <span
                style={
                  styles.possessionTag
                }
              >
                BALL
              </span>
            ) : null}
          </div>


          <span
            style={
              styles.playerSub
            }
          >
            {player.teamAbbreviation ??
              "FA"}{" "}
            {player.position}

            {player.injuryStatus
              ? ` • ${player.injuryStatus}`
              : ""}
          </span>
        </div>
      </div>


      <span
        style={
          styles.opp
        }
      >
        {displayedOpponent
          ? `vs ${displayedOpponent}`
          : "—"}
      </span>


      <span
        style={
          player
            .gameContext
            ?.isActuallyLive
            ? styles.liveStatus
            : styles.playerStatus
        }
      >
        {playerStatus(
          player
        )}
      </span>


      <strong
        style={{
          ...styles.playerPoints,

          ...(redZone
            ? styles.redPoints
            : possession
              ? styles.orangePoints
              : {}),
        }}
      >
        {points(
          player.fantasyPoints
        )}
      </strong>
    </div>
  );
}


const styles = {
  page: {
    minHeight:
      "calc(100vh - 90px)",

    padding:
      "10px 14px 18px",

    background:
      "#0c0d0f",
  },


  shell: {
    width:
      "min(1500px,100%)",

    margin:
      "0 auto",

    display:
      "grid",

    gap:
      "7px",
  },


  topBar: {
    minHeight:
      "27px",

    display:
      "grid",

    gridTemplateColumns:
      "1fr auto 1fr",

    alignItems:
      "center",

    gap:
      "10px",
  },


  backLink: {
    color:
      "#ff7622",

    fontSize: "14px",

    fontWeight:
      900,

    textDecoration:
      "none",
  },


  weekTitle: {
    color:
      "#f4f4f5",

    fontSize: "17px",
  },


  matchupId: {
    justifySelf:
      "end",

    color:
      "#656b74",

    fontSize: "12px",
  },


  scoreboard: {
    minHeight:
      "88px",

    padding:
      "9px 18px",

    display:
      "grid",

    gridTemplateColumns:
      "1fr 165px 1fr",

    alignItems:
      "center",

    gap:
      "18px",

    border:
      "1px solid rgba(255,255,255,.09)",

    borderRadius:
      "6px",

    background:
      "linear-gradient(180deg,#191b1e,#111214)",
  },


  scoreTeam: {
    minWidth:
      0,

    display:
      "flex",

    alignItems:
      "center",

    gap:
      "10px",
  },


  scoreTeamRight: {
    justifyContent:
      "flex-end",
  },


  teamCircle: {
    width:
      "40px",

    height:
      "40px",

    display:
      "flex",

    alignItems:
      "center",

    justifyContent:
      "center",

    borderRadius:
      "50%",

    background:
      "#292c31",

    color:
      "#fff",

    fontSize: "18px",

    fontWeight:
      950,
  },


  myTeamCircle: {
    boxShadow:
      "0 0 0 1px rgba(255,90,20,.65)",
  },


  scoreTeamText: {
    minWidth:
      0,

    flex:
      "1 1 auto",

    display:
      "grid",

    gap:
      "2px",

    direction:
      "ltr" as const,
  },


  scoreTeamTextRight: {
    justifyItems:
      "end",

    textAlign:
      "right" as const,
  },


  scoreTeamNameRight: {
    textAlign:
      "right" as const,
  },


  teamMetaLineRight: {
    justifyContent:
      "flex-end",
  },


  scoreTeamName: {
    overflow:
      "hidden",

    textOverflow:
      "ellipsis",

    whiteSpace:
      "nowrap" as const,

    color:
      "#f8f8f9",

    fontSize: "17px",
  },


  teamSub: {
    minHeight:
      "10px",

    color:
      "#767c85",

    fontSize: "11px",

    direction:
      "ltr" as const,
  },


  teamMetaLine: {
    minHeight:
      "11px",

    display:
      "flex",

    alignItems:
      "center",

    gap:
      "4px",

    flexWrap:
      "wrap" as const,

    direction:
      "ltr" as const,
  },


  myTeamMeta: {
    color:
      "#ff8a2a",

    fontSize: "11px",

    fontWeight:
      950,
  },


  winnerMeta: {
    color:
      "#4ddd89",

    fontSize: "11px",

    fontWeight:
      950,
  },


  liveMeta: {
    color:
      "#45dc84",

    fontSize: "11px",

    fontWeight:
      950,
  },


  mutedMeta: {
    color:
      "#6f7680",

    fontSize: "11px",

    fontWeight:
      900,
  },


  metaDivider: {
    color:
      "#4f555e",

    fontSize: "11px",
  },


  remainingMeta: {
    color:
      "#8a919b",

    fontSize: "11px",

    fontWeight:
      900,
  },


  mainScore: {
    color:
      "#f6f6f7",

    fontSize: "28px",

    fontVariantNumeric:
      "tabular-nums",

    direction:
      "ltr" as const,
  },


  winnerScore: {
    color:
      "#4ddd89",
  },


  centerScore: {
    display:
      "grid",

    justifyItems:
      "center",

    gap:
      "3px",
  },


  liveBadge: {
    padding:
      "3px 7px",

    border:
      "1px solid rgba(65,220,125,.45)",

    borderRadius:
      "4px",

    color:
      "#45dc84",

    fontSize: "12px",

    fontWeight:
      950,
  },


  finalBadge: {
    color:
      "#aeb3ba",

    fontSize: "13px",

    fontWeight:
      950,
  },


  scheduledBadge: {
    color:
      "#767c84",

    fontSize: "13px",

    fontWeight:
      950,
  },


  gameClock: {
    color:
      "#f2f2f3",

    fontSize: "16px",
  },


  liveSituation: {
    color:
      "#49d888",

    fontSize: "13px",
  },


  redZoneSituation: {
    color:
      "#ff4e43",

    fontSize: "13px",

    fontWeight:
      950,
  },


  statusSub: {
    color:
      "#747a82",

    fontSize: "12px",
  },


  winProbabilityPanel: {
    padding:
      "8px 12px",

    border:
      "1px solid rgba(255,255,255,.075)",

    borderRadius:
      "6px",

    background:
      "#111214",
  },


  winProbabilityHeader: {
    display:
      "flex",

    alignItems:
      "center",

    justifyContent:
      "space-between",

    gap:
      "10px",

    marginBottom:
      "6px",
  },


  winProbabilityLabel: {
    color:
      "#9ca2aa",

    fontSize: "11px",

    fontWeight:
      950,

    letterSpacing:
      ".09em",
  },


  winProbabilityUnavailable: {
    color:
      "#707780",

    fontSize: "12px",
  },


  winProbabilityTeams: {
    marginBottom:
      "5px",

    display:
      "flex",

    justifyContent:
      "space-between",

    gap:
      "12px",
  },


  probabilityTeamLeft: {
    display:
      "flex",

    alignItems:
      "baseline",

    gap:
      "5px",

    color:
      "#8c929a",

    fontSize: "12px",
  },


  probabilityTeamRight: {
    display:
      "flex",

    flexDirection:
      "row-reverse" as const,

    alignItems:
      "baseline",

    gap:
      "5px",

    color:
      "#8c929a",

    fontSize: "12px",
  },


  probabilityValue: {
    color:
      "#ffffff",

    fontSize: "18px",
  },


  probabilityTrack: {
    width:
      "100%",

    height:
      "7px",

    display:
      "flex",

    overflow:
      "hidden",

    borderRadius:
      "999px",

    background:
      "#25272b",
  },


  probabilityAway: {
    height:
      "100%",

    background:
      "linear-gradient(90deg,#b81717,#ff5b0a)",
  },


  probabilityHome: {
    height:
      "100%",

    background:
      "linear-gradient(90deg,#ff8d1e,#ffb03a)",
  },


  probabilityEmptyBar: {
    height:
      "7px",

    display:
      "grid",

    gridTemplateColumns:
      "1fr 1fr",

    gap:
      "2px",
  },


  probabilityEmptyHalf: {
    borderRadius:
      "999px",

    background:
      "#24262a",
  },


  summaryBar: {
    minHeight:
      "46px",

    display:
      "grid",

    gridTemplateColumns:
      "minmax(0,1fr) auto",

    border:
      "1px solid rgba(255,255,255,.08)",

    borderRadius:
      "6px",

    background:
      "#111214",

    overflow:
      "hidden",
  },


  quickStat: {
    padding:
      "7px",

    display:
      "grid",

    placeItems:
      "center",

    gap:
      "2px",

    borderRight:
      "1px solid rgba(255,255,255,.06)",
  },


  smallLabel: {
    color:
      "#777d85",

    fontSize: "11px",

    fontWeight:
      900,
  },


  quickValue: {
    color:
      "#fff",

    fontSize: "17px",
  },


  scoringHighlight: {
    padding:
      "6px 10px",

    display:
      "grid",

    alignContent:
      "center",

    gap:
      "2px",
  },


  matchupActivity: {
    minWidth:
      "180px",

    padding:
      "6px 12px",

    display:
      "grid",

    alignContent:
      "center",

    justifyItems:
      "end",

    gap:
      "2px",

    borderLeft:
      "1px solid rgba(255,255,255,.06)",
  },


  matchupActivityValue: {
    color:
      "#d8dbe0",

    fontSize: "13px",

    fontWeight:
      900,

    whiteSpace:
      "nowrap" as const,
  },


  scoringText: {
    overflow:
      "hidden",

    textOverflow:
      "ellipsis",

    whiteSpace:
      "nowrap" as const,

    color:
      "#f3f3f4",

    fontSize: "13px",
  },


  scoringTime: {
    color:
      "#747a83",

    fontSize: "12px",
  },


  mainGrid: {
    display:
      "grid",

    gridTemplateColumns:
      "minmax(340px,1fr) minmax(280px,.85fr) minmax(340px,1fr)",

    gap:
      "7px",

    alignItems:
      "start",
  },


  centerColumn: {
    display:
      "grid",

    gap:
      "7px",
  },


  panel: {
    overflow:
      "hidden",

    border:
      "1px solid rgba(255,255,255,.08)",

    borderRadius:
      "6px",

    background:
      "#111214",
  },


  panelTitle: {
    padding:
      "6px 9px",

    borderBottom:
      "1px solid rgba(255,255,255,.06)",

    color:
      "#c5c8cd",

    fontSize: "12px",

    fontWeight:
      950,
  },


  liveGame: {
    padding:
      "8px 10px",

    display:
      "grid",

    gap:
      "3px",

    borderBottom:
      "1px solid rgba(255,255,255,.055)",
  },


  liveGameRedZone: {
    background:
      "rgba(185,20,20,.08)",
  },


  liveGameTop: {
    display:
      "flex",

    alignItems:
      "center",

    justifyContent:
      "space-between",

    gap:
      "8px",

    color:
      "#8f959d",

    fontSize: "12px",
  },


  liveGameState: {
    display:
      "flex",

    alignItems:
      "center",

    gap:
      "6px",
  },


  liveGamePossessionMini: {
    color:
      "#f2f2f3",

    fontSize: "12px",

    fontWeight:
      900,
  },


  greenText: {
    color:
      "#47dc85",
  },


  redText: {
    color:
      "#ff4f45",
  },


  possession: {
    color:
      "#f2f2f3",

    fontSize: "15px",
  },


  driveInfo: {
    color:
      "#44d982",

    fontSize: "12px",
  },


  lastPlay: {
    overflow:
      "hidden",

    display:
      "-webkit-box",

    WebkitLineClamp:
      2,

    WebkitBoxOrient:
      "vertical" as const,

    color:
      "#7e848c",

    fontSize: "12px",

    lineHeight:
      1.3,
  },


  emptyCenter: {
    padding:
      "12px",

    color:
      "#6d737b",

    fontSize: "13px",
  },


  scoringRow: {
    minHeight:
      "38px",

    padding:
      "5px 8px",

    display:
      "grid",

    gridTemplateColumns:
      "23px minmax(0,1fr) 32px",

    alignItems:
      "center",

    gap:
      "6px",

    borderBottom:
      "1px solid rgba(255,255,255,.05)",
  },


  scoringDot: {
    width:
      "21px",

    height:
      "21px",

    display:
      "flex",

    alignItems:
      "center",

    justifyContent:
      "center",

    borderRadius:
      "50%",

    background:
      "rgba(200,25,20,.12)",

    color:
      "#ff5449",

    fontSize: "11px",

    fontWeight:
      950,
  },


  scoringRowText: {
    minWidth:
      0,

    display:
      "grid",

    gap:
      "1px",

    color:
      "#f0f0f1",

    fontSize: "12px",
  },


  scoringPoints: {
    justifySelf:
      "end",

    color:
      "#44dc84",

    fontSize: "12px",

    fontWeight:
      950,
  },


  rosterPanel: {
    overflow:
      "hidden",

    border:
      "1px solid rgba(255,255,255,.08)",

    borderRadius:
      "6px",

    background:
      "#111214",
  },


  rosterHeader: {
    minHeight:
      "27px",

    padding:
      "5px 9px",

    display:
      "flex",

    alignItems:
      "center",

    justifyContent:
      "space-between",

    borderBottom:
      "1px solid rgba(255,255,255,.06)",

    color:
      "#e6e7e9",

    fontSize: "12px",
  },


  lineupEmptyState: {
    minHeight:
      "390px",

    padding:
      "20px",

    display:
      "grid",

    placeContent:
      "center",

    justifyItems:
      "center",

    gap:
      "6px",

    textAlign:
      "center" as const,
  },


  lineupEmptyTitle: {
    color:
      "#ff8423",

    fontSize: "16px",

    letterSpacing:
      ".08em",
  },


  lineupEmptyText: {
    maxWidth:
      "230px",

    color:
      "#767c85",

    fontSize: "13px",

    lineHeight:
      1.45,
  },


  tableHeader: {
    minHeight:
      "22px",

    padding:
      "4px 7px",

    display:
      "grid",

    gridTemplateColumns:
      "36px minmax(125px,1fr) 42px 58px 42px",

    alignItems:
      "center",

    gap:
      "5px",

    borderBottom:
      "1px solid rgba(255,255,255,.055)",

    color:
      "#747b84",

    fontSize: "11px",

    fontWeight:
      900,
  },


  rightText: {
    textAlign:
      "right" as const,
  },


  playerRow: {
    minHeight:
      "44px",

    padding:
      "3px 7px",

    display:
      "grid",

    gridTemplateColumns:
      "36px minmax(125px,1fr) 42px 58px 42px",

    alignItems:
      "center",

    gap:
      "5px",

    borderBottom:
      "1px solid rgba(255,255,255,.045)",
  },


  possessionRow: {
    boxShadow:
      "inset 4px 0 0 #ff7c22, inset 0 0 22px rgba(255,100,15,.08)",

    background:
      "linear-gradient(90deg,rgba(255,95,15,.15),rgba(255,95,15,.035) 52%,transparent)",

    borderTop:
      "1px solid rgba(255,125,35,.18)",

    borderBottom:
      "1px solid rgba(255,125,35,.18)",
  },


  redZoneRow: {
    boxShadow:
      "inset 4px 0 0 #ff4137, inset 0 0 26px rgba(210,25,20,.13)",

    background:
      "linear-gradient(90deg,rgba(210,25,20,.20),rgba(210,25,20,.055) 55%,transparent)",

    borderTop:
      "1px solid rgba(255,70,60,.22)",

    borderBottom:
      "1px solid rgba(255,70,60,.22)",
  },


  slot: {
    color:
      "#bbc0c7",

    fontSize: "12px",
  },


  playerCell: {
    minWidth:
      0,

    display:
      "flex",

    alignItems:
      "center",

    gap:
      "5px",
  },


  headshot: {
    width:
      "26px",

    height:
      "26px",

    flex:
      "0 0 auto",

    objectFit:
      "cover" as const,

    borderRadius:
      "50%",
  },


  headshotFallback: {
    width:
      "26px",

    height:
      "26px",

    flex:
      "0 0 auto",

    display:
      "flex",

    alignItems:
      "center",

    justifyContent:
      "center",

    borderRadius:
      "50%",

    background:
      "#26282c",

    color:
      "#777d85",

    fontSize: "11px",
  },


  playerNames: {
    minWidth:
      0,

    display:
      "grid",

    gap:
      "1px",
  },


  playerNameLine: {
    minWidth:
      0,

    display:
      "flex",

    alignItems:
      "center",

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
      "#f1f2f3",

    fontSize: "13px",
  },


  playerSub: {
    color:
      "#686e77",

    fontSize: "11px",
  },


  redZoneTag: {
    padding:
      "2px 4px",

    border:
      "1px solid rgba(255,77,67,.48)",

    borderRadius:
      "3px",

    background:
      "rgba(255,77,67,.12)",

    color:
      "#ff5e55",

    fontSize: "11px",

    fontWeight:
      950,
  },


  possessionTag: {
    padding:
      "2px 4px",

    border:
      "1px solid rgba(255,132,38,.42)",

    borderRadius:
      "3px",

    background:
      "rgba(255,132,38,.10)",

    color:
      "#ff9a43",

    fontSize: "11px",

    fontWeight:
      950,
  },


  opp: {
    color:
      "#9a9fa7",

    fontSize: "12px",
  },


  playerStatus: {
    color:
      "#858b94",

    fontSize: "12px",
  },


  liveStatus: {
    color:
      "#42d982",

    fontSize: "12px",
  },


  playerPoints: {
    justifySelf:
      "end",

    color:
      "#f2f2f3",

    fontSize: "14px",

    fontVariantNumeric:
      "tabular-nums",
  },


  orangePoints: {
    color:
      "#ff8527",
  },


  redPoints: {
    color:
      "#ff4c43",
  },


  totalRow: {
    minHeight:
      "31px",

    padding:
      "6px 9px",

    display:
      "flex",

    alignItems:
      "center",

    justifyContent:
      "space-between",

    color:
      "#f3f3f4",

    fontSize: "13px",
  },


  benchGrid: {
    display:
      "grid",

    gridTemplateColumns:
      "minmax(340px,1fr) minmax(280px,.85fr) minmax(340px,1fr)",

    gap:
      "7px",
  },


  benchEmpty: {
    padding:
      "10px",

    color:
      "#686e77",

    fontSize: "12px",

    textAlign:
      "center" as const,
  },
};