import Link from "next/link";

export type G365KickerDistanceSummary = {
  made: number[];
  missed: number[];
};


export type G365MobileMatchupPlayer = {
  playerId: number;
  espnPlayerId: string | null;
  fullName: string;
  position: string;
  teamAbbreviation: string | null;
  lineupSlot: string;
  slotIndex: number;
  fantasyPoints: number;
  projectedPoints: number;
  scoreIsLive: boolean;
  scoreIsFinal: boolean;
  isLocked: boolean;
  nflOpponent: string | null;
  opponentPrefix: "vs" | "@" | null;
  kickoffAt: string | null;
  injuryStatus: string | null;
  gameContext: {
    isActuallyLive: boolean;
    statusCompleted: boolean;
    period: number | null;
    clock: string | null;
  } | null;
  stats: {
    passingAttempts: number;
    passingCompletions: number;
    passingYards: number;
    passingTouchdowns: number;
    passingInterceptions: number;
    rushingAttempts: number;
    rushingYards: number;
    rushingTouchdowns: number;
    receivingTargets: number;
    receptions: number;
    receivingYards: number;
    receivingTouchdowns: number;
    fumblesLost: number;
    fieldGoalsMade: number;
    fieldGoalsAttempted: number;
    extraPointsMade: number;
    extraPointsAttempted: number;
    dstSacks: number;
    dstInterceptions: number;
    dstFumbleRecoveries: number;
    dstTouchdowns: number;
    dstSafeties: number;
    dstBlockedKicks: number;
    dstPointsAllowed: number;
    dstYardsAllowed: number;
  };
};


export type G365MobileMatchupTeam = {
  fantasyTeamId: number;
  teamName: string;
  points: number;
  expectedFinalPoints: number;
  isMyTeam: boolean;
  starters: G365MobileMatchupPlayer[];
  bench: G365MobileMatchupPlayer[];
};


export type G365MobileMatchupData = {
  matchupId: number;
  season: number;
  week: number;
  status: "scheduled" | "live" | "final";
  isLive: boolean;
  isFinal: boolean;
  tied: boolean;
  away: G365MobileMatchupTeam;
  home: G365MobileMatchupTeam;
  recentScoringPlays: Array<{
    espnPlayId: string;
    period: number | null;
    clock: string | null;
    possessionTeamAbbreviation: string | null;
    scoreValue: number | null;
    text: string | null;
    participantEspnPlayerIds: string[];
  }>;
};


type Props = {
  data: G365MobileMatchupData;
  title: string;
  previousHref: string | null;
  nextHref: string | null;
  allMatchupsHref: string;
  allMatchupsLabel?: string;
  matchupNumber?: number | null;
  matchupCount?: number | null;
  kickerDistances?: Record<
    string,
    G365KickerDistanceSummary
  >;
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


function kickoffLabel(
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

  return new Intl.DateTimeFormat(
    "en-US",
    {
      weekday:
        "short",

      hour:
        "numeric",

      minute:
        "2-digit",

      timeZone:
        "America/New_York",
    }
  ).format(
    date
  );
}


function matchupStatus(
  data:
    G365MobileMatchupData
) {
  if (
    data.isFinal &&
    data.tied
  ) {
    return "FINAL • TIE";
  }

  if (data.isFinal) {
    return "FINAL";
  }

  if (data.isLive) {
    return "LIVE";
  }

  return "SCHEDULED";
}


function playerStatus(
  player:
    G365MobileMatchupPlayer
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
    return "Final";
  }

  if (
    player.nflOpponent
  ) {
    return kickoffLabel(
      player.kickoffAt
    );
  }

  return "BYE";
}


function compactPlayerName(
  fullName: string
) {
  const parts =
    fullName
      .trim()
      .split(
        /\s+/
      );

  if (
    parts.length <=
    1
  ) {
    return fullName;
  }

  const first =
    parts[0]?.[0] ??
    "";

  const last =
    parts[
      parts.length -
      1
    ] ??
    "";

  if (
    !first ||
    !last
  ) {
    return fullName;
  }

  return `${first}. ${last}`;
}


function compactTeamName(
  value: string
) {
  const clean =
    value.trim();

  if (
    clean.length <=
    18
  ) {
    return clean;
  }

  return `${clean.slice(0, 17)}…`;
}


function slotLabel(
  value:
    string |
    null
) {
  const normalized =
    String(
      value ??
      ""
    )
      .trim()
      .toUpperCase();

  if (
    normalized ===
    "FLEX"
  ) {
    return "FLX";
  }

  if (
    normalized ===
    "SUPERFLEX"
  ) {
    return "SFX";
  }

  if (
    normalized ===
      "DST" ||
    normalized ===
      "DEF"
  ) {
    return "D/ST";
  }

  if (
    normalized ===
      "BENCH" ||
    normalized ===
      "BN"
  ) {
    return "BN";
  }

  return (
    normalized ||
    "—"
  );
}


function hasAnyStats(
  player:
    G365MobileMatchupPlayer
) {
  const stats =
    player.stats;

  return (
    stats.passingAttempts !== 0 ||
    stats.passingCompletions !== 0 ||
    stats.passingYards !== 0 ||
    stats.passingTouchdowns !== 0 ||
    stats.passingInterceptions !== 0 ||
    stats.rushingAttempts !== 0 ||
    stats.rushingYards !== 0 ||
    stats.rushingTouchdowns !== 0 ||
    stats.receivingTargets !== 0 ||
    stats.receptions !== 0 ||
    stats.receivingYards !== 0 ||
    stats.receivingTouchdowns !== 0 ||
    stats.fumblesLost !== 0 ||
    stats.fieldGoalsMade !== 0 ||
    stats.fieldGoalsAttempted !== 0 ||
    stats.extraPointsMade !== 0 ||
    stats.extraPointsAttempted !== 0 ||
    stats.dstSacks !== 0 ||
    stats.dstInterceptions !== 0 ||
    stats.dstFumbleRecoveries !== 0 ||
    stats.dstTouchdowns !== 0 ||
    stats.dstSafeties !== 0 ||
    stats.dstBlockedKicks !== 0 ||
    stats.dstPointsAllowed !== 0 ||
    stats.dstYardsAllowed !== 0
  );
}


function compactStatLine(
  player:
    G365MobileMatchupPlayer,
  kickerDistance:
    G365KickerDistanceSummary |
    undefined
) {
  const stats =
    player.stats;

  const position =
    player.position
      .trim()
      .toUpperCase();

  const started =
    Boolean(
      player.scoreIsLive ||
      player.scoreIsFinal ||
      player.gameContext
        ?.isActuallyLive ||
      player.gameContext
        ?.statusCompleted ||
      hasAnyStats(
        player
      )
    );

  if (!started) {
    return "—";
  }

  const parts:
    string[] =
    [];

  if (
    position ===
    "QB"
  ) {
    parts.push(
      `${stats.passingYards} PY`,
      `${stats.passingTouchdowns} PTD`,
      `${stats.passingInterceptions} INT`
    );

    if (
      stats.rushingAttempts >
        0 ||
      stats.rushingYards !==
        0 ||
      stats.rushingTouchdowns >
        0
    ) {
      parts.push(
        `${stats.rushingAttempts} CAR`,
        `${stats.rushingYards} RY`,
        `${stats.rushingTouchdowns} RTD`
      );
    }
  } else if (
    position ===
    "RB"
  ) {
    parts.push(
      `${stats.rushingAttempts} CAR`,
      `${stats.rushingYards} RY`,
      `${stats.receptions} REC`,
      `${stats.receivingYards} REY`,
      `${stats.rushingTouchdowns + stats.receivingTouchdowns} TD`
    );
  } else if (
    position ===
      "WR" ||
    position ===
      "TE"
  ) {
    parts.push(
      `${stats.receptions} REC`,
      `${stats.receivingYards} YD`,
      `${stats.receivingTouchdowns + stats.rushingTouchdowns} TD`
    );

    if (
      stats.rushingAttempts >
        0 ||
      stats.rushingYards !==
        0
    ) {
      parts.push(
        `${stats.rushingAttempts} CAR`,
        `${stats.rushingYards} RY`
      );
    }
  } else if (
    position ===
      "K" ||
    position ===
      "PK"
  ) {
    parts.push(
      `${stats.fieldGoalsMade}/${stats.fieldGoalsAttempted} FG`
    );

    if (
      kickerDistance
        ?.made
        .length
    ) {
      parts.push(
        `M:${kickerDistance.made.join(",")}`
      );
    }

    if (
      kickerDistance
        ?.missed
        .length
    ) {
      parts.push(
        `X:${kickerDistance.missed.join(",")}`
      );
    }

    parts.push(
      `${stats.extraPointsMade}/${stats.extraPointsAttempted} XP`
    );
  } else if (
    position ===
      "DST" ||
    position ===
      "DEF"
  ) {
    parts.push(
      `${stats.dstSacks} SCK`,
      `${stats.dstInterceptions} INT`,
      `${stats.dstFumbleRecoveries} FR`
    );

    if (
      stats.dstTouchdowns >
      0
    ) {
      parts.push(
        `${stats.dstTouchdowns} TD`
      );
    }

    if (
      stats.dstSafeties >
      0
    ) {
      parts.push(
        `${stats.dstSafeties} SAF`
      );
    }

    if (
      stats.dstBlockedKicks >
      0
    ) {
      parts.push(
        `${stats.dstBlockedKicks} BLK`
      );
    }

    parts.push(
      `${stats.dstPointsAllowed} PA`,
      `${stats.dstYardsAllowed} YA`
    );
  } else {
    parts.push(
      `${stats.rushingAttempts} CAR`,
      `${stats.rushingYards} RY`,
      `${stats.receptions} REC`,
      `${stats.receivingYards} YD`,
      `${stats.rushingTouchdowns + stats.receivingTouchdowns} TD`
    );
  }

  if (
    stats.fumblesLost >
    0
  ) {
    parts.push(
      `${stats.fumblesLost} FUM`
    );
  }

  return parts.join(
    " • "
  );
}


function calculateWinProbability(
  away:
    G365MobileMatchupTeam,
  home:
    G365MobileMatchupTeam,
  isFinal: boolean
) {
  if (isFinal) {
    if (
      away.points ===
      home.points
    ) {
      return {
        away: 50,
        home: 50,
      };
    }

    return away.points >
      home.points
      ? {
          away: 100,
          home: 0,
        }
      : {
          away: 0,
          home: 100,
        };
  }

  const difference =
    away.expectedFinalPoints -
    home.expectedFinalPoints;

  const raw =
    100 /
    (
      1 +
      Math.exp(
        -difference /
        14
      )
    );

  const awayPercent =
    Math.max(
      1,
      Math.min(
        99,
        raw
      )
    );

  return {
    away:
      awayPercent,

    home:
      100 -
      awayPercent,
  };
}


function scoringPlayType(
  text:
    string |
    null
) {
  const value =
    String(
      text ??
      ""
    )
      .toLowerCase();

  if (
    value.includes(
      "field goal"
    )
  ) {
    return "FG";
  }

  if (
    value.includes(
      "extra point"
    )
  ) {
    return "XP";
  }

  if (
    value.includes(
      "safety"
    )
  ) {
    return "SAF";
  }

  if (
    value.includes(
      "interception"
    ) &&
    (
      value.includes(
        "touchdown"
      ) ||
      value.includes(
        "return"
      )
    )
  ) {
    return "INT TD";
  }

  if (
    value.includes(
      "fumble"
    ) &&
    value.includes(
      "touchdown"
    )
  ) {
    return "FUM TD";
  }

  if (
    value.includes(
      "touchdown"
    )
  ) {
    return "TD";
  }

  return "SCORE";
}


function playerAliases(
  fullName: string
) {
  const clean =
    fullName.trim();

  const parts =
    clean.split(
      /\s+/
    );

  const aliases =
    new Set<string>();

  if (clean) {
    aliases.add(
      clean
    );
  }

  if (
    parts.length >=
      2 &&
    parts[0]
  ) {
    const first =
      parts[0][0];

    const last =
      parts[
        parts.length -
        1
      ];

    if (
      first &&
      last
    ) {
      aliases.add(
        `${first}.${last}`
      );

      aliases.add(
        `${first}. ${last}`
      );
    }
  }

  return Array.from(
    aliases
  );
}


function HighlightedPlayText({
  text,
  data,
  participantEspnPlayerIds,
}: {
  text:
    string |
    null;
  data:
    G365MobileMatchupData;
  participantEspnPlayerIds:
    string[];
}) {
  const value =
    text ??
    "";

  const participantIds =
    new Set(
      participantEspnPlayerIds.map(
        (
          id
        ) =>
          String(
            id
          )
      )
    );

  const allPlayers = [
    ...data.away.starters.map(
      (
        player
      ) => ({
        player,
        myTeam:
          data.away.isMyTeam,
      })
    ),

    ...data.away.bench.map(
      (
        player
      ) => ({
        player,
        myTeam:
          data.away.isMyTeam,
      })
    ),

    ...data.home.starters.map(
      (
        player
      ) => ({
        player,
        myTeam:
          data.home.isMyTeam,
      })
    ),

    ...data.home.bench.map(
      (
        player
      ) => ({
        player,
        myTeam:
          data.home.isMyTeam,
      })
    ),
  ];

  /*
   * ESPN scoring plays provide participant player IDs. Those are the
   * strongest signal for deciding which fantasy side a scorer belongs to.
   * If ESPN omits the participant list, fall back to every rostered player.
   */
  const participantPlayers =
    allPlayers.filter(
      ({
        player,
      }) =>
        Boolean(
          player.espnPlayerId &&
          participantIds.has(
            String(
              player.espnPlayerId
            )
          )
        )
    );

  const players =
    participantPlayers.length >
    0
      ? [
          ...participantPlayers,
          ...allPlayers.filter(
            ({
              player,
            }) =>
              !participantPlayers.some(
                ({
                  player:
                    participant,
                }) =>
                  participant.playerId ===
                  player.playerId
              )
          ),
        ]
      : allPlayers;

  const aliases =
    players
      .flatMap(
        ({
          player,
          myTeam,
        }) =>
          playerAliases(
            player.fullName
          ).map(
            (
              alias
            ) => ({
              alias,
              myTeam,
              participant:
                Boolean(
                  player.espnPlayerId &&
                  participantIds.has(
                    String(
                      player.espnPlayerId
                    )
                  )
                ),
            })
          )
      )
      .filter(
        (
          item
        ) =>
          item.alias.length >
          0
      )
      .sort(
        (
          a,
          b
        ) => {
          if (
            a.participant !==
            b.participant
          ) {
            return a.participant
              ? -1
              : 1;
          }

          return (
            b.alias.length -
            a.alias.length
          );
        }
      );

  if (
    aliases.length ===
    0
  ) {
    return (
      <>
        {value}
      </>
    );
  }

  const escaped =
    aliases.map(
      (
        item
      ) =>
        item.alias.replace(
          /[.*+?^${}()|[\]\\]/g,
          "\\$&"
        )
    );

  const pattern =
    new RegExp(
      `(${escaped.join("|")})`,
      "gi"
    );

  return (
    <>
      {value
        .split(
          pattern
        )
        .map(
          (
            part,
            index
          ) => {
            const match =
              aliases.find(
                (
                  item
                ) =>
                  item.alias
                    .toLowerCase() ===
                  part
                    .toLowerCase()
              );

            if (!match) {
              return (
                <span
                  key={
                    `${part}-${index}`
                  }
                >
                  {part}
                </span>
              );
            }

            return (
              <strong
                key={
                  `${part}-${index}`
                }
                className={
                  match.myTeam
                    ? "g365-mm-play-my"
                    : "g365-mm-play-opp"
                }
              >
                {part}
              </strong>
            );
          }
        )}
    </>
  );
}


function TeamAvatar({
  team,
}: {
  team:
    G365MobileMatchupTeam;
}) {
  return (
    <div
      className={
        team.isMyTeam
          ? "g365-mm-avatar g365-mm-avatar-my"
          : "g365-mm-avatar"
      }
      aria-hidden="true"
    >
      {team.teamName
        .slice(
          0,
          1
        )
        .toUpperCase()}
    </div>
  );
}


function PlayerSide({
  player,
  right = false,
  kickerDistances,
}: {
  player:
    G365MobileMatchupPlayer |
    null;
  right?: boolean;
  kickerDistances:
    Record<
      string,
      G365KickerDistanceSummary
    >;
}) {
  if (!player) {
    return (
      <div
        className={
          right
            ? "g365-mm-player g365-mm-player-right g365-mm-player-empty"
            : "g365-mm-player g365-mm-player-empty"
        }
      >
        <div
          className="g365-mm-player-copy"
        >
          <strong>—</strong>
          <span>EMPTY</span>
        </div>
      </div>
    );
  }

  const opponent =
    player.nflOpponent
      ? `${player.opponentPrefix ?? "vs"} ${player.nflOpponent}`
      : "BYE";

  const status =
    playerStatus(
      player
    );

  const injury =
    player.injuryStatus
      ? ` • ${player.injuryStatus}`
      : "";

  const kickerDistance =
    player.espnPlayerId
      ? kickerDistances[
          player.espnPlayerId
        ]
      : undefined;

  return (
    <div
      className={
        right
          ? "g365-mm-player g365-mm-player-right"
          : "g365-mm-player"
      }
    >
      <div
        className="g365-mm-player-copy"
      >
        <strong
          className="g365-mm-player-name"
          title={
            player.fullName
          }
        >
          {compactPlayerName(
            player.fullName
          )}
        </strong>

        <span
          className="g365-mm-player-meta"
        >
          {player.teamAbbreviation ??
            "FA"}{" "}
          {opponent}
          {" • "}
          {status}
          {injury}
        </span>

        <span
          className={
            player.gameContext
              ?.isActuallyLive ||
            player.scoreIsLive
              ? "g365-mm-player-stats g365-mm-player-stats-live"
              : "g365-mm-player-stats"
          }
        >
          {compactStatLine(
            player,
            kickerDistance
          )}
        </span>
      </div>

      <div
        className="g365-mm-player-values"
      >
        <strong>
          {points(
            player.fantasyPoints
          )}
        </strong>

        <span>
          {player.projectedPoints >
          0
            ? points(
                player.projectedPoints
              )
            : "—"}
        </span>
      </div>
    </div>
  );
}


function liveStarterCount(
  team:
    G365MobileMatchupTeam
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


function remainingStarterCount(
  team:
    G365MobileMatchupTeam
) {
  return team.starters.filter(
    (
      player
    ) => {
      const isLive =
        Boolean(
          player.gameContext
            ?.isActuallyLive ||
          player.scoreIsLive
        );

      const isFinal =
        Boolean(
          player.scoreIsFinal ||
          player.gameContext
            ?.statusCompleted
        );

      return (
        !isLive &&
        !isFinal
      );
    }
  ).length;
}


function RosterComparison({
  away,
  home,
  label,
  bench = false,
  kickerDistances,
}: {
  away:
    G365MobileMatchupTeam;
  home:
    G365MobileMatchupTeam;
  label: string;
  bench?: boolean;
  kickerDistances:
    Record<
      string,
      G365KickerDistanceSummary
    >;
}) {
  const awayPlayers =
    bench
      ? away.bench
      : away.starters;

  const homePlayers =
    bench
      ? home.bench
      : home.starters;

  const awayLive =
    liveStarterCount(
      away
    );


  const homeLive =
    liveStarterCount(
      home
    );


  const awayRemaining =
    remainingStarterCount(
      away
    );


  const homeRemaining =
    remainingStarterCount(
      home
    );


  const rowCount =
    Math.max(
      awayPlayers.length,
      homePlayers.length
    );

  const rows =
    Array.from(
      {
        length:
          rowCount,
      },
      (
        _,
        index
      ) => ({
        away:
          awayPlayers[
            index
          ] ??
          null,

        home:
          homePlayers[
            index
          ] ??
          null,
      })
    );

  return (
    <section
      className="g365-mm-roster"
    >
      <div
        className="g365-mm-roster-head"
      >
        <div>
          <strong
            title={
              away.teamName
            }
          >
            {compactTeamName(
              away.teamName
            )}
          </strong>

          {!bench ? (
            <em
              className="g365-mm-team-status"
            >
              {awayLive} LIVE • {awayRemaining} LEFT
            </em>
          ) : null}

          <span>
            {points(
              away.points
            )}
          </span>

          <small>
            PROJ{" "}
            {points(
              away.expectedFinalPoints
            )}
          </small>
        </div>

        <b>
          {label}
        </b>

        <div
          className="g365-mm-roster-head-right"
        >
          <strong
            title={
              home.teamName
            }
          >
            {compactTeamName(
              home.teamName
            )}
          </strong>

          {!bench ? (
            <em
              className="g365-mm-team-status"
            >
              {homeLive} LIVE • {homeRemaining} LEFT
            </em>
          ) : null}

          <span>
            {points(
              home.points
            )}
          </span>

          <small>
            PROJ{" "}
            {points(
              home.expectedFinalPoints
            )}
          </small>
        </div>
      </div>

      {rows.length ===
      0 ? (
        <div
          className="g365-mm-empty"
        >
          No players.
        </div>
      ) : (
        rows.map(
          (
            row,
            index
          ) => (
            <div
              className="g365-mm-row"
              key={
                `${label}-${index}-${row.away?.playerId ?? "empty"}-${row.home?.playerId ?? "empty"}`
              }
            >
              <PlayerSide
                player={
                  row.away
                }
                kickerDistances={
                  kickerDistances
                }
              />

              <div
                className="g365-mm-slot"
              >
                {bench
                  ? "BN"
                  : slotLabel(
                      row.away
                        ?.lineupSlot ??
                        row.home
                          ?.lineupSlot ??
                        null
                    )}
              </div>

              <PlayerSide
                player={
                  row.home
                }
                right
                kickerDistances={
                  kickerDistances
                }
              />
            </div>
          )
        )
      )}

      {!bench ? (
        <div
          className="g365-mm-total-row"
        >
          <div>
            <strong>
              {points(
                away.points
              )}
            </strong>

            <span>
              PROJ{" "}
              {points(
                away.expectedFinalPoints
              )}
            </span>
          </div>

          <b>
            TOTAL
          </b>

          <div
            className="g365-mm-total-right"
          >
            <strong>
              {points(
                home.points
              )}
            </strong>

            <span>
              PROJ{" "}
              {points(
                home.expectedFinalPoints
              )}
            </span>
          </div>
        </div>
      ) : null}
    </section>
  );
}


export default function G365MobileMatchupDetail({
  data,
  title,
  previousHref,
  nextHref,
  allMatchupsHref,
  allMatchupsLabel =
    "All Matchups",
  matchupNumber =
    null,
  matchupCount =
    null,
  kickerDistances =
    {},
}: Props) {
  const winProbability =
    calculateWinProbability(
      data.away,
      data.home,
      data.isFinal
    );

  const leader =
    data.away.points >
    data.home.points
      ? data.away
      : data.home.points >
          data.away.points
        ? data.home
        : null;

  const margin =
    Math.abs(
      data.away.points -
      data.home.points
    );

  const lastPlay =
    data
      .recentScoringPlays[0] ??
    null;

  return (
    <section
      className="g365-mobile-matchup-v2"
    >
      <style>{`
        .g365-mobile-matchup-v2 {
          display: none;
        }

        @media (max-width: 760px) {
          .g365-existing-matchup-detail {
            display: none !important;
          }

          .g365-mobile-matchup-v2,
          .g365-mobile-matchup-v2 * {
            box-sizing: border-box;
          }

          .g365-mobile-matchup-v2 {
            display: grid;
            gap: 8px;
            width: 100%;
            min-width: 0;
            padding: 8px max(6px, env(safe-area-inset-right)) 18px max(6px, env(safe-area-inset-left));
            overflow: hidden;
            background: #0c0d0f;
            color: #f7f7f8;
          }

          .g365-mm-nav {
            display: grid;
            grid-template-columns: 62px minmax(104px,1fr) 62px 96px;
            align-items: center;
            gap: 5px;
          }

          .g365-mm-nav-button {
            min-height: 38px;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 0 7px;
            border: 1px solid rgba(255,255,255,.13);
            border-radius: 8px;
            background: linear-gradient(180deg,#1b1e22,#121416);
            color: #e2e4e8;
            font-size: 10px;
            font-weight: 900;
            text-decoration: none;
            white-space: nowrap;
          }

          .g365-mm-nav-disabled {
            opacity: .36;
          }

          .g365-mm-nav-title {
            min-width: 0;
            display: grid;
            justify-items: center;
            gap: 1px;
            text-align: center;
          }

          .g365-mm-nav-title strong {
            max-width: 100%;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            color: #fff;
            font-size: 13px;
          }

          .g365-mm-nav-title span {
            color: #818894;
            font-size: 8px;
            font-weight: 800;
          }

          .g365-mm-nav-all {
            border-color: rgba(255,105,25,.42);
            color: #ff8b2c;
          }

          .g365-mm-scoreboard {
            display: grid;
            grid-template-columns: minmax(0,1fr) 68px minmax(0,1fr);
            align-items: center;
            gap: 5px;
            padding: 11px 8px;
            border: 1px solid rgba(255,255,255,.10);
            border-radius: 9px 9px 0 0;
            background: linear-gradient(180deg,#1a1d20,#111315);
          }

          .g365-mm-score-team {
            min-width: 0;
            display: grid;
            grid-template-columns: 42px minmax(0,1fr);
            gap: 7px;
            align-items: center;
          }

          .g365-mm-score-team-right {
            grid-template-columns: minmax(0,1fr) 42px;
            text-align: right;
          }

          .g365-mm-score-copy {
            min-width: 0;
            display: grid;
            gap: 2px;
          }

          .g365-mm-score-copy strong {
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            font-size: 11px;
          }

          .g365-mm-score-copy b {
            color: #fff;
            font-size: 25px;
            line-height: 1;
            font-variant-numeric: tabular-nums;
          }

          .g365-mm-score-copy small {
            color: #ff8a2b;
            font-size: 9px;
            font-weight: 950;
          }

          .g365-mm-avatar {
            width: 42px;
            height: 42px;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 1px solid #565d68;
            border-radius: 50%;
            background: #242830;
            color: #fff;
            font-size: 18px;
            font-weight: 950;
          }

          .g365-mm-avatar-my {
            border-color: #ff5c17;
            color: #ff8b2c;
          }

          .g365-mm-score-center {
            display: grid;
            justify-items: center;
            gap: 4px;
            text-align: center;
          }

          .g365-mm-score-center strong {
            color: #a0a6b0;
            font-size: 9px;
          }

          .g365-mm-score-center span {
            max-width: 68px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            color: #737a85;
            font-size: 7px;
          }

          .g365-mm-vs {
            width: 29px;
            height: 29px;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 1px solid rgba(255,255,255,.12);
            border-radius: 50%;
            background: #202328;
            color: #d8dbe0;
            font-size: 9px;
            font-weight: 950;
          }

          .g365-mm-win {
            display: grid;
            grid-template-columns: auto minmax(0,1fr) auto;
            align-items: center;
            gap: 8px;
            padding: 7px 9px 9px;
            border: 1px solid rgba(255,255,255,.10);
            border-top: 0;
            border-radius: 0 0 9px 9px;
            background: #111315;
          }

          .g365-mm-win strong {
            font-size: 11px;
            font-variant-numeric: tabular-nums;
          }

          .g365-mm-win-track {
            position: relative;
            height: 7px;
            overflow: hidden;
            border-radius: 999px;
            background: #30343a;
          }

          .g365-mm-win-fill {
            position: absolute;
            inset: 0;
            background: linear-gradient(90deg,#df1d1b 0%,#ff3d0d 55%,#ff8a16 100%);
          }

          .g365-mm-win-label {
            position: absolute;
            inset: -15px 0 auto;
            color: #7f8690;
            font-size: 7px;
            font-weight: 900;
            text-align: center;
          }

          .g365-mm-roster {
            min-width: 0;
            overflow: hidden;
            border: 1px solid rgba(255,255,255,.09);
            border-radius: 9px;
            background: #111315;
          }

          .g365-mm-roster-head {
            display: grid;
            grid-template-columns: minmax(0,1fr) 42px minmax(0,1fr);
            gap: 0;
            align-items: end;
            padding: 8px 7px;
            border-bottom: 1px solid rgba(255,255,255,.09);
            background: linear-gradient(180deg,#1b1e21,#151719);
          }

          .g365-mm-roster-head > div {
            min-width: 0;
            display: grid;
            gap: 1px;
          }

          .g365-mm-roster-head-right {
            justify-items: end;
            text-align: right;
          }

          .g365-mm-roster-head strong {
            max-width: 100%;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            font-size: 11px;
          }

          .g365-mm-team-status {
            color: #8e949d;
            font-size: 7.5px;
            font-style: normal;
            font-weight: 900;
            letter-spacing: .025em;
            line-height: 1.1;
            white-space: nowrap;
          }

          .g365-mm-roster-head span {
            color: #fff;
            font-size: 20px;
            font-weight: 950;
            line-height: 1;
          }

          .g365-mm-roster-head small {
            color: #ff8a2b;
            font-size: 8px;
            font-weight: 950;
          }

          .g365-mm-roster-head b {
            color: #89909a;
            font-size: 8px;
            text-align: center;
          }

          .g365-mm-row {
            display: grid;
            grid-template-columns: minmax(0,1fr) 42px minmax(0,1fr);
            min-height: 72px;
            border-bottom: 1px solid rgba(255,255,255,.055);
          }

          .g365-mm-row:last-of-type {
            border-bottom: 0;
          }

          .g365-mm-player {
            min-width: 0;
            display: grid;
            grid-template-columns: minmax(0,1fr) auto;
            gap: 5px;
            align-items: start;
            padding: 7px 6px;
            background: #181a1c;
          }

          .g365-mm-player-right {
            grid-template-columns: auto minmax(0,1fr);
            text-align: right;
          }

          .g365-mm-player-right .g365-mm-player-copy {
            grid-column: 2;
            grid-row: 1;
            align-items: end;
          }

          .g365-mm-player-right .g365-mm-player-values {
            grid-column: 1;
            grid-row: 1;
            align-items: start;
          }

          .g365-mm-player-empty {
            opacity: .35;
          }

          .g365-mm-player-copy {
            min-width: 0;
            display: grid;
            gap: 2px;
          }

          .g365-mm-player-name {
            max-width: 100%;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            color: #f4f5f6;
            font-size: 10.5px;
          }

          .g365-mm-player-meta {
            max-width: 100%;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            color: #969ca5;
            font-size: 7.4px;
            line-height: 1.18;
          }

          .g365-mm-player-stats {
            display: -webkit-box;
            max-width: 100%;
            overflow: hidden;
            color: #a8adb5;
            font-size: 7.6px;
            line-height: 1.25;
            -webkit-box-orient: vertical;
            -webkit-line-clamp: 2;
          }

          .g365-mm-player-stats-live {
            color: #ff9a43;
          }

          .g365-mm-player-values {
            min-width: 34px;
            display: grid;
            justify-items: end;
            gap: 1px;
            font-variant-numeric: tabular-nums;
          }

          .g365-mm-player-values strong {
            color: #fff;
            font-size: 13px;
            line-height: 1;
          }

          .g365-mm-player-values span {
            color: #858c96;
            font-size: 8px;
          }

          .g365-mm-slot {
            display: flex;
            align-items: center;
            justify-content: center;
            border-left: 1px solid rgba(255,255,255,.055);
            border-right: 1px solid rgba(255,255,255,.055);
            background: #0d0f11;
            color: #969ca6;
            font-size: 9px;
            font-weight: 950;
          }

          .g365-mm-total-row {
            display: grid;
            grid-template-columns: minmax(0,1fr) 42px minmax(0,1fr);
            align-items: center;
            min-height: 52px;
            border-top: 1px solid rgba(255,255,255,.10);
            background: #101214;
          }

          .g365-mm-total-row > div {
            display: grid;
            gap: 2px;
            padding: 7px 8px;
          }

          .g365-mm-total-right {
            justify-items: end;
            text-align: right;
          }

          .g365-mm-total-row strong {
            color: #fff;
            font-size: 15px;
          }

          .g365-mm-total-row span {
            color: #ff8a2b;
            font-size: 8px;
            font-weight: 950;
          }

          .g365-mm-total-row b {
            color: #89909a;
            font-size: 8px;
            text-align: center;
          }

          .g365-mm-section-label {
            margin: 4px 2px 0;
            color: #ff8125;
            font-size: 9px;
            font-weight: 950;
            letter-spacing: .08em;
          }

          .g365-mm-plays {
            overflow: hidden;
            border: 1px solid rgba(255,255,255,.09);
            border-radius: 9px;
            background: #111315;
          }

          .g365-mm-plays-head {
            padding: 8px 9px;
            border-bottom: 1px solid rgba(255,255,255,.08);
            color: #ff8125;
            font-size: 9px;
            font-weight: 950;
          }

          .g365-mm-play {
            display: grid;
            grid-template-columns: 48px minmax(0,1fr) auto;
            gap: 7px;
            align-items: start;
            padding: 8px 9px;
            border-bottom: 1px solid rgba(255,255,255,.055);
          }

          .g365-mm-play:last-child {
            border-bottom: 0;
          }

          .g365-mm-play-type {
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 24px;
            border-radius: 6px;
            background: rgba(255,92,20,.11);
            color: #ff8a2b;
            font-size: 8px;
            font-weight: 950;
          }

          .g365-mm-play-copy {
            min-width: 0;
            display: grid;
            gap: 2px;
            color: #aeb3ba;
            font-size: 8px;
            line-height: 1.3;
          }

          .g365-mm-play-copy strong {
            color: #fff;
          }

          .g365-mm-play-time {
            color: #777e88;
            font-size: 7px;
            white-space: nowrap;
          }

          .g365-mm-play-my {
            color: #43d982;
            font-weight: 950;
          }

          .g365-mm-play-opp {
            color: #ff5a50;
            font-weight: 950;
          }

          .g365-mm-all-bottom {
            min-height: 43px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            margin: 4px auto 0;
            padding: 0 18px;
            border: 1px solid rgba(255,255,255,.16);
            border-radius: 999px;
            background: linear-gradient(180deg,#1a1d20,#111315);
            color: #fff;
            font-size: 10px;
            font-weight: 950;
            text-decoration: none;
          }

          .g365-mm-empty {
            padding: 14px 10px;
            color: #7d848e;
            font-size: 9px;
            text-align: center;
          }
        }

        @media (max-width: 390px) {
          .g365-mm-nav {
            grid-template-columns: 56px minmax(0,1fr) 56px;
          }

          .g365-mm-nav-all {
            grid-column: 1 / -1;
          }

          .g365-mm-scoreboard {
            grid-template-columns: minmax(0,1fr) 54px minmax(0,1fr);
          }

          .g365-mm-score-team {
            grid-template-columns: 34px minmax(0,1fr);
            gap: 5px;
          }

          .g365-mm-score-team-right {
            grid-template-columns: minmax(0,1fr) 34px;
          }

          .g365-mm-avatar {
            width: 34px;
            height: 34px;
            font-size: 15px;
          }

          .g365-mm-score-copy b {
            font-size: 22px;
          }

          .g365-mm-row,
          .g365-mm-roster-head,
          .g365-mm-total-row {
            grid-template-columns: minmax(0,1fr) 36px minmax(0,1fr);
          }

          .g365-mm-player {
            padding: 6px 4px;
          }

          .g365-mm-player-name {
            font-size: 9.7px;
          }

          .g365-mm-player-meta,
          .g365-mm-player-stats {
            font-size: 7px;
          }
        }
      `}</style>

      <div
        className="g365-mm-nav"
      >
        {previousHref ? (
          <Link
            className="g365-mm-nav-button"
            href={
              previousHref
            }
          >
            ‹ Prev
          </Link>
        ) : (
          <span
            className="g365-mm-nav-button g365-mm-nav-disabled"
          >
            ‹ Prev
          </span>
        )}

        <div
          className="g365-mm-nav-title"
        >
          <strong>
            {title}
          </strong>

          <span>
            {matchupNumber &&
            matchupCount
              ? `${matchupNumber} of ${matchupCount}`
              : `#${data.matchupId}`}
          </span>
        </div>

        {nextHref ? (
          <Link
            className="g365-mm-nav-button"
            href={
              nextHref
            }
          >
            Next ›
          </Link>
        ) : (
          <span
            className="g365-mm-nav-button g365-mm-nav-disabled"
          >
            Next ›
          </span>
        )}

        <Link
          className="g365-mm-nav-button g365-mm-nav-all"
          href={
            allMatchupsHref
          }
        >
          All Matchups
        </Link>
      </div>

      <div>
        <section
          className="g365-mm-scoreboard"
        >
          <div
            className="g365-mm-score-team"
          >
            <TeamAvatar
              team={
                data.away
              }
            />

            <div
              className="g365-mm-score-copy"
            >
              <strong
                title={
                  data.away
                    .teamName
                }
              >
                {compactTeamName(
                  data.away
                    .teamName
                )}
              </strong>

              <b>
                {points(
                  data.away
                    .points
                )}
              </b>

              <small>
                PROJ{" "}
                {points(
                  data.away
                    .expectedFinalPoints
                )}
              </small>
            </div>
          </div>

          <div
            className="g365-mm-score-center"
          >
            <div
              className="g365-mm-vs"
            >
              VS
            </div>

            <strong>
              {matchupStatus(
                data
              )}
            </strong>

            <span>
              {leader
                ? `${compactTeamName(leader.teamName)} +${points(margin)}`
                : "EVEN"}
            </span>
          </div>

          <div
            className="g365-mm-score-team g365-mm-score-team-right"
          >
            <div
              className="g365-mm-score-copy"
            >
              <strong
                title={
                  data.home
                    .teamName
                }
              >
                {compactTeamName(
                  data.home
                    .teamName
                )}
              </strong>

              <b>
                {points(
                  data.home
                    .points
                )}
              </b>

              <small>
                PROJ{" "}
                {points(
                  data.home
                    .expectedFinalPoints
                )}
              </small>
            </div>

            <TeamAvatar
              team={
                data.home
              }
            />
          </div>
        </section>

        <section
          className="g365-mm-win"
        >
          <strong>
            {winProbability.away.toFixed(
              1
            )}
            %
          </strong>

          <div
            className="g365-mm-win-track"
          >
            <span
              className="g365-mm-win-label"
            >
              WIN PROBABILITY
            </span>

            <div
              className="g365-mm-win-fill"
              style={{
                clipPath:
                  `inset(0 ${100 - winProbability.away}% 0 0)`,
              }}
            />
          </div>

          <strong>
            {winProbability.home.toFixed(
              1
            )}
            %
          </strong>
        </section>
      </div>

      <RosterComparison
        away={
          data.away
        }
        home={
          data.home
        }
        label="STARTERS"
        kickerDistances={
          kickerDistances
        }
      />

      {(
        data.away.bench.length >
          0 ||
        data.home.bench.length >
          0
      ) ? (
        <>
          <div
            className="g365-mm-section-label"
          >
            BENCH
          </div>

          <RosterComparison
            away={
              data.away
            }
            home={
              data.home
            }
            label="BENCH"
            bench
            kickerDistances={
              kickerDistances
            }
          />
        </>
      ) : null}

      <section
        className="g365-mm-plays"
      >
        <div
          className="g365-mm-plays-head"
        >
          RECENT SCORING PLAYS
        </div>

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
                  className="g365-mm-play"
                  key={
                    play.espnPlayId
                  }
                >
                  <span
                    className="g365-mm-play-type"
                  >
                    {scoringPlayType(
                      play.text
                    )}
                  </span>

                  <div
                    className="g365-mm-play-copy"
                  >
                    <strong>
                      {play.possessionTeamAbbreviation ??
                        "NFL"}
                    </strong>

                    <span>
                      <HighlightedPlayText
                        text={
                          play.text
                        }
                        data={
                          data
                        }
                        participantEspnPlayerIds={
                          play.participantEspnPlayerIds
                        }
                      />
                    </span>
                  </div>

                  <span
                    className="g365-mm-play-time"
                  >
                    {play.period
                      ? quarter(
                          play.period
                        )
                      : ""}

                    {play.clock
                      ? ` ${play.clock}`
                      : ""}
                  </span>
                </div>
              )
            )
        ) : (
          <div
            className="g365-mm-empty"
          >
            No scoring plays yet.
          </div>
        )}
      </section>

      <Link
        className="g365-mm-all-bottom"
        href={
          allMatchupsHref
        }
      >
        ▦ {allMatchupsLabel} ›
      </Link>
    </section>
  );
}