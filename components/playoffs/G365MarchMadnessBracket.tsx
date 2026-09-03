"use client";

import type {
  CSSProperties,
  ReactNode,
} from "react";

import Link from "next/link";


export type G365BracketTeam = {
  id: number | string;
  seed: number | null;
  name: string;
  record?: string | null;
  score?: number | null;
  projectedScore?: number | null;
  statusText?: string | null;
  isWinner?: boolean;
};


export type G365BracketMatchup = {
  id: number | string;
  round: number;
  slot: number;
  week?: number | null;
  home: G365BracketTeam | null;
  away: G365BracketTeam | null;
  status?: string | null;
  isFinal?: boolean;
  isTie?: boolean;
  href?: string | null;
};


type Props = {
  leagueName: string;
  season: number;
  playoffTeamCount: number;
  playoffStartWeek: number;
  seededTeams: G365BracketTeam[];
  matchups: G365BracketMatchup[];
  championName?: string | null;
  statusLabel?: string | null;
  rightHeader?: ReactNode;
};


type DisplaySlot = {
  key: string;
  round: number;
  slot: number;
  week: number;
  home: G365BracketTeam | null;
  away: G365BracketTeam | null;
  byeTeam: G365BracketTeam | null;
  status?: string | null;
  isFinal?: boolean;
  isTie?: boolean;
  href?: string | null;
};


const CARD_WIDTH = 260;
const CARD_HEIGHT = 96;
const COLUMN_GAP = 44;
const TOP_OFFSET = 62;
const ROW_GAP = 22;


function clampNumber(
  value: number,
  minimum: number
) {
  return Math.max(
    minimum,
    Number.isFinite(value)
      ? Math.trunc(value)
      : minimum
  );
}


function isPowerOfTwo(
  value: number
) {
  return (
    value > 0 &&
    (
      value &
      (
        value - 1
      )
    ) === 0
  );
}


function highestPowerOfTwoBelow(
  value: number
) {
  let power = 1;

  while (
    power * 2 <
    value
  ) {
    power *= 2;
  }

  return power;
}


function nextPowerOfTwo(
  value: number
) {
  let power = 1;

  while (
    power <
    value
  ) {
    power *= 2;
  }

  return power;
}


/**
 * Canonical bracket seed order.
 *
 * 8 teams:
 *   1-8, 4-5, 2-7, 3-6
 *
 * 16 teams:
 *   1-16, 8-9, 4-13, 5-12,
 *   2-15, 7-10, 3-14, 6-11
 */
function bracketSeedOrder(
  bracketSize: number
) {
  if (
    bracketSize <=
    2
  ) {
    return [
      1,
      2,
    ];
  }

  let order = [
    1,
    2,
  ];

  let size = 2;

  while (
    size <
    bracketSize
  ) {
    const nextSize =
      size * 2;

    const next:
      number[] = [];

    for (
      const seed
      of order
    ) {
      next.push(
        seed,
        nextSize +
          1 -
          seed
      );
    }

    order = next;
    size = nextSize;
  }

  return order;
}


function placeholderSeedTeam(
  seed: number
): G365BracketTeam {
  return {
    id:
      `tbd-seed-${seed}`,
    seed,
    name:
      "TBD",
    record:
      "Seed not finalized",
    score:
      null,
    projectedScore:
      null,
    statusText:
      "Seed not finalized",
    isWinner:
      false,
  };
}


/**
 * This is bracket geometry only.
 * It never changes the commissioner-selected playoff field size.
 *
 * Example:
 * 7 selected teams = exactly 7 playoff teams.
 * The first round contains 3 games + 1 real bye, leaving 4 teams.
 */
function getBracketShape(
  playoffTeamCount: number
) {
  const teamCount =
    clampNumber(
      playoffTeamCount,
      2
    );

  const teamsAfterOpeningRound =
    isPowerOfTwo(
      teamCount
    )
      ? Math.max(
          1,
          teamCount / 2
        )
      : highestPowerOfTwoBelow(
          teamCount
        );

  const openingGames =
    teamCount -
    teamsAfterOpeningRound;

  const openingByes =
    teamsAfterOpeningRound -
    openingGames;

  const roundCount =
    Math.max(
      1,
      Math.ceil(
        Math.log2(
          teamCount
        )
      )
    );

  const bracketSize =
    nextPowerOfTwo(
      teamCount
    );

  return {
    teamCount,
    bracketSize,
    teamsAfterOpeningRound,
    openingGames,
    openingByes,
    roundCount,
  };
}


function roundName(
  round: number,
  roundCount: number,
  matchupCount: number
) {
  if (
    round ===
    roundCount
  ) {
    return "CHAMPIONSHIP";
  }

  if (
    round ===
    roundCount - 1
  ) {
    return "SEMIFINALS";
  }

  if (
    matchupCount === 4
  ) {
    return "QUARTERFINALS";
  }

  if (
    matchupCount === 8
  ) {
    return "ROUND OF 16";
  }

  if (
    matchupCount === 16
  ) {
    return "ROUND OF 32";
  }

  return round === 1
    ? "OPENING ROUND"
    : `ROUND ${round}`;
}


function buildProjectedOpeningRound(
  seededTeams: G365BracketTeam[],
  playoffTeamCount: number,
  playoffStartWeek: number
): DisplaySlot[] {
  const shape =
    getBracketShape(
      playoffTeamCount
    );

  const teamBySeed =
    new Map<
      number,
      G365BracketTeam
    >();

  for (
    const team
    of seededTeams
  ) {
    const seed =
      Number(
        team.seed
      );

    if (
      Number.isFinite(
        seed
      ) &&
      seed >= 1 &&
      seed <=
        shape.teamCount
    ) {
      teamBySeed.set(
        seed,
        team
      );
    }
  }

  const seedOrder =
    bracketSeedOrder(
      shape.bracketSize
    );

  const slots:
    DisplaySlot[] = [];

  for (
    let index = 0;
    index <
    seedOrder.length;
    index += 2
  ) {
    const firstSeed =
      seedOrder[
        index
      ];

    const secondSeed =
      seedOrder[
        index + 1
      ];

    if (
      firstSeed ===
        undefined ||
      secondSeed ===
        undefined
    ) {
      continue;
    }

    const firstExists =
      firstSeed <=
      shape.teamCount;

    const secondExists =
      secondSeed <=
      shape.teamCount;

    const firstTeam =
      firstExists
        ? (
            teamBySeed.get(
              firstSeed
            ) ??
            placeholderSeedTeam(
              firstSeed
            )
          )
        : null;

    const secondTeam =
      secondExists
        ? (
            teamBySeed.get(
              secondSeed
            ) ??
            placeholderSeedTeam(
              secondSeed
            )
          )
        : null;

    const byeTeam =
      firstTeam &&
      !secondExists
        ? firstTeam
        : secondTeam &&
            !firstExists
          ? secondTeam
          : null;

    slots.push({
      key:
        `projected-opening-${index / 2 + 1}`,
      round: 1,
      slot:
        index / 2 +
        1,
      week:
        playoffStartWeek,
      home:
        byeTeam
          ? null
          : firstTeam,
      away:
        byeTeam
          ? null
          : secondTeam,
      byeTeam,
      status:
        byeTeam
          ? "BYE"
          : "PROJECTED",
      isFinal:
        false,
      isTie:
        false,
      href:
        null,
    });
  }

  return slots;
}

function buildProjectedRounds(
  seededTeams: G365BracketTeam[],
  playoffTeamCount: number,
  playoffStartWeek: number
) {
  const shape =
    getBracketShape(
      playoffTeamCount
    );

  const result =
    new Map<
      number,
      DisplaySlot[]
    >();

  result.set(
    1,
    buildProjectedOpeningRound(
      seededTeams,
      playoffTeamCount,
      playoffStartWeek
    )
  );

  let matchupCount =
    Math.max(
      1,
      shape.teamsAfterOpeningRound /
      2
    );

  for (
    let round = 2;
    round <=
    shape.roundCount;
    round += 1
  ) {
    const roundSlots:
      DisplaySlot[] = [];

    for (
      let slot = 1;
      slot <=
      matchupCount;
      slot += 1
    ) {
      roundSlots.push({
        key:
          `projected-${round}-${slot}`,
        round,
        slot,
        week:
          playoffStartWeek +
          round -
          1,
        home:
          null,
        away:
          null,
        byeTeam:
          null,
        status:
          "TBD",
        isFinal:
          false,
        isTie:
          false,
        href:
          null,
      });
    }

    result.set(
      round,
      roundSlots
    );

    matchupCount =
      Math.max(
        1,
        Math.floor(
          matchupCount /
          2
        )
      );
  }

  return result;
}


function buildRealRounds(
  matchups: G365BracketMatchup[],
  playoffStartWeek: number,
  playoffTeamCount: number
) {
  const shape =
    getBracketShape(
      playoffTeamCount
    );

  const grouped =
    new Map<
      number,
      DisplaySlot[]
    >();

  for (
    const matchup
    of matchups
  ) {
    const round =
      Math.max(
        1,
        matchup.round
      );

    const existing =
      grouped.get(
        round
      ) ??
      [];

    const byeTeam =
      matchup.home &&
      !matchup.away
        ? matchup.home
        : matchup.away &&
            !matchup.home
          ? matchup.away
          : null;

    existing.push({
      key:
        `real-${matchup.id}`,
      round,
      slot:
        matchup.slot,
      week:
        matchup.week ??
        (
          playoffStartWeek +
          round -
          1
        ),
      home:
        byeTeam
          ? null
          : matchup.home,
      away:
        byeTeam
          ? null
          : matchup.away,
      byeTeam,
      status:
        matchup.status,
      isFinal:
        matchup.isFinal,
      isTie:
        matchup.isTie,
      href:
        matchup.href,
    });

    grouped.set(
      round,
      existing
    );
  }

  let expectedSlots =
    shape.teamsAfterOpeningRound;

  for (
    let round = 1;
    round <=
    shape.roundCount;
    round += 1
  ) {
    const rows =
      grouped.get(
        round
      ) ??
      [];

    const bySlot =
      new Map<
        number,
        DisplaySlot
      >();

    for (
      const row
      of rows
    ) {
      bySlot.set(
        row.slot,
        row
      );
    }

    const completeRound:
      DisplaySlot[] = [];

    for (
      let slot = 1;
      slot <=
      Math.max(
        1,
        expectedSlots
      );
      slot += 1
    ) {
      completeRound.push(
        bySlot.get(
          slot
        ) ?? {
          key:
            `real-tbd-${round}-${slot}`,
          round,
          slot,
          week:
            playoffStartWeek +
            round -
            1,
          home:
            null,
          away:
            null,
          byeTeam:
            null,
          status:
            "TBD",
          isFinal:
            false,
          isTie:
            false,
          href:
            null,
        }
      );
    }

    grouped.set(
      round,
      completeRound
    );

    expectedSlots =
      Math.max(
        1,
        Math.floor(
          expectedSlots /
          2
        )
      );
  }

  return grouped;
}

function displayScore(
  team:
    G365BracketTeam |
    null,
  isFinal:
    boolean
) {
  if (!team) {
    return "—";
  }

  if (
    team.score !==
      null &&
    team.score !==
      undefined
  ) {
    return team.score
      .toFixed(
        2
      );
  }

  if (
    !isFinal &&
    team.projectedScore !==
      null &&
    team.projectedScore !==
      undefined
  ) {
    return team.projectedScore
      .toFixed(
        2
      );
  }

  return "—";
}


function TeamLine({
  team,
  isFinal,
}: {
  team:
    G365BracketTeam |
    null;
  isFinal:
    boolean;
}) {
  if (!team) {
    return (
      <div
        className="g365-mm-team g365-mm-team-empty"
      >
        <span
          className="g365-mm-seed"
        >
          —
        </span>

        <div
          className="g365-mm-team-copy"
        >
          <strong>
            TBD
          </strong>

          <small>
            Awaiting winner
          </small>
        </div>

        <strong
          className="g365-mm-score"
        >
          —
        </strong>
      </div>
    );
  }

  return (
    <div
      className={[
        "g365-mm-team",
        team.isWinner
          ? "g365-mm-team-winner"
          : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span
        className="g365-mm-seed"
      >
        {team.seed ??
          "—"}
      </span>

      <div
        className="g365-mm-team-copy"
      >
        <strong>
          {team.name}
        </strong>

        <small>
          {team.record ??
            team.statusText ??
            ""}
        </small>
      </div>

      <strong
        className="g365-mm-score"
      >
        {displayScore(
          team,
          isFinal
        )}
      </strong>
    </div>
  );
}


function SlotCard({
  slot,
  isChampionship,
}: {
  slot: DisplaySlot;
  isChampionship:
    boolean;
}) {
  const isBye =
    Boolean(
      slot.byeTeam
    );

  const content = (
    <div
      className={[
        "g365-mm-card",
        isBye
          ? "g365-mm-card-bye"
          : "",
        isChampionship
          ? "g365-mm-card-final"
          : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {isBye ? (
        <div
          className="g365-mm-bye-line"
        >
          <span
            className="g365-mm-seed"
          >
            {slot.byeTeam
              ?.seed ??
              "—"}
          </span>

          <div
            className="g365-mm-team-copy"
          >
            <strong>
              {slot.byeTeam
                ?.name ??
                "TBD"}
            </strong>

            <small>
              {slot.byeTeam
                ?.record ??
                ""}
            </small>
          </div>

          <strong
            className="g365-mm-bye"
          >
            BYE
          </strong>
        </div>
      ) : (
        <>
          <TeamLine
            team={
              slot.home
            }
            isFinal={
              Boolean(
                slot.isFinal
              )
            }
          />

          <div
            className="g365-mm-divider"
          />

          <TeamLine
            team={
              slot.away
            }
            isFinal={
              Boolean(
                slot.isFinal
              )
            }
          />
        </>
      )}

      {slot.isTie ? (
        <div
          className="g365-mm-tie"
        >
          TIE • COMMISSIONER RESOLUTION REQUIRED
        </div>
      ) : null}
    </div>
  );

  if (
    slot.href &&
    !isBye
  ) {
    return (
      <Link
        href={
          slot.href
        }
        className="g365-mm-link"
      >
        {content}
      </Link>
    );
  }

  return content;
}


export default function G365MarchMadnessBracket({
  leagueName,
  season,
  playoffTeamCount,
  playoffStartWeek,
  seededTeams,
  matchups,
  championName,
  statusLabel,
  rightHeader,
}: Props) {
  const shape =
    getBracketShape(
      playoffTeamCount
    );

  const hasRealBracket =
    matchups.length >
    0;

  const rounds =
    hasRealBracket
      ? buildRealRounds(
          matchups,
          playoffStartWeek,
          playoffTeamCount
        )
      : buildProjectedRounds(
          seededTeams,
          playoffTeamCount,
          playoffStartWeek
        );

  const openingSlots =
    Math.max(
      1,
      rounds.get(
        1
      )?.length ??
        shape.teamsAfterOpeningRound
    );

  const boardHeight =
    TOP_OFFSET +
    openingSlots *
      CARD_HEIGHT +
    Math.max(
      0,
      openingSlots - 1
    ) *
      ROW_GAP +
    42;

  const columnCount =
    shape.roundCount +
    1;

  const boardWidth =
    columnCount *
      CARD_WIDTH +
    Math.max(
      0,
      columnCount - 1
    ) *
      COLUMN_GAP;

  const centers:
    number[][] =
      [];

  centers[0] =
    Array.from(
      {
        length:
          openingSlots,
      },
      (
        _,
        index
      ) =>
        TOP_OFFSET +
        CARD_HEIGHT /
          2 +
        index *
          (
            CARD_HEIGHT +
            ROW_GAP
          )
    );

  for (
    let roundIndex = 1;
    roundIndex <
    shape.roundCount;
    roundIndex += 1
  ) {
    const previous =
      centers[
        roundIndex -
        1
      ] ??
      [];

    const next:
      number[] = [];

    for (
      let index = 0;
      index <
      previous.length;
      index += 2
    ) {
      const first =
        previous[index] ??
        TOP_OFFSET;

      const second =
        previous[
          index + 1
        ] ??
        first;

      next.push(
        (
          first +
          second
        ) /
        2
      );
    }

    centers[
      roundIndex
    ] =
      next;
  }

  const championshipCenters =
    centers[
      shape.roundCount -
      1
    ] ??
    [
      TOP_OFFSET +
      CARD_HEIGHT /
        2,
    ];

  const championCenter =
    championshipCenters[0] ??
    (
      TOP_OFFSET +
      CARD_HEIGHT /
        2
    );

  return (
    <section
      className="g365-mm-shell"
    >
      <style>{`
        .g365-mm-shell,
        .g365-mm-shell * {
          box-sizing: border-box;
        }

        .g365-mm-shell {
          border: 1px solid rgba(255,255,255,.10);
          border-radius: 18px;
          overflow: hidden;
          background:
            radial-gradient(circle at 50% -10%, rgba(239,68,68,.10), transparent 34%),
            linear-gradient(180deg,#0a0d10,#06080a);
          box-shadow: 0 24px 70px rgba(0,0,0,.34);
        }

        .g365-mm-header {
          min-height: 112px;
          padding: 22px 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          border-bottom: 1px solid rgba(255,255,255,.09);
          background: rgba(255,255,255,.015);
        }

        .g365-mm-title-row {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .g365-mm-trophy {
          font-size: 34px;
          line-height: 1;
          filter: drop-shadow(0 0 12px rgba(249,115,22,.28));
        }

        .g365-mm-title {
          margin: 0;
          color: #f8fafc;
          font-size: clamp(24px,3vw,38px);
          line-height: 1;
          letter-spacing: -.02em;
        }

        .g365-mm-subtitle {
          display: block;
          margin-top: 8px;
          color: #fb4b2f;
          font-size: 13px;
          font-weight: 900;
          letter-spacing: .04em;
          text-transform: uppercase;
        }

        .g365-mm-meta {
          color: #cbd5e1;
          font-size: 14px;
          line-height: 1.5;
          text-align: right;
        }

        .g365-mm-status {
          margin-top: 4px;
          color: #f97316;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .06em;
          font-size: 11px;
        }

        .g365-mm-scroll {
          overflow-x: auto;
          overflow-y: hidden;
          padding: 0 0 6px;
          scrollbar-color: #f97316 #111827;
        }

        .g365-mm-board {
          position: relative;
          min-height: var(--board-height);
          width: var(--board-width);
          min-width: 100%;
        }

        .g365-mm-column {
          position: absolute;
          top: 0;
          width: ${CARD_WIDTH}px;
          height: var(--board-height);
        }

        .g365-mm-round-head {
          height: ${TOP_OFFSET - 8}px;
          display: grid;
          place-items: center;
          align-content: center;
          gap: 5px;
          color: #f8fafc;
          border-bottom: 1px solid rgba(255,255,255,.08);
        }

        .g365-mm-round-head strong {
          font-size: 14px;
          letter-spacing: .08em;
        }

        .g365-mm-round-head span {
          color: #aab2bd;
          font-size: 13px;
        }

        .g365-mm-position {
          position: absolute;
          left: 0;
          width: ${CARD_WIDTH}px;
          transform: translateY(-50%);
        }

        .g365-mm-card {
          position: relative;
          width: ${CARD_WIDTH}px;
          min-height: ${CARD_HEIGHT}px;
          overflow: hidden;
          border: 1px solid rgba(255,255,255,.20);
          border-radius: 9px;
          background:
            linear-gradient(180deg,rgba(255,255,255,.045),rgba(255,255,255,.016));
          box-shadow: 0 12px 28px rgba(0,0,0,.25);
        }

        .g365-mm-card:hover {
          border-color: rgba(249,115,22,.72);
          box-shadow:
            0 14px 34px rgba(0,0,0,.32),
            0 0 26px rgba(249,115,22,.08);
        }

        .g365-mm-card-final {
          border-color: rgba(249,115,22,.50);
        }

        .g365-mm-link {
          color: inherit;
          text-decoration: none;
          display: block;
        }

        .g365-mm-team,
        .g365-mm-bye-line {
          min-height: 46px;
          padding: 7px 10px;
          display: grid;
          grid-template-columns: 34px minmax(0,1fr) auto;
          align-items: center;
          gap: 10px;
        }

        .g365-mm-team-winner {
          background: linear-gradient(90deg,rgba(239,68,68,.12),transparent 65%);
        }

        .g365-mm-team-empty {
          opacity: .78;
        }

        .g365-mm-seed {
          color: #fb4b2f;
          font-weight: 1000;
          font-size: 15px;
          text-align: center;
        }

        .g365-mm-team-copy {
          min-width: 0;
          display: grid;
          gap: 3px;
        }

        .g365-mm-team-copy strong {
          overflow: hidden;
          color: #f8fafc;
          font-size: 15px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .g365-mm-team-copy small {
          overflow: hidden;
          color: #9ca3af;
          font-size: 12px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .g365-mm-score {
          color: #f8fafc;
          font-size: 18px;
          font-variant-numeric: tabular-nums;
        }

        .g365-mm-divider {
          height: 1px;
          margin-left: 12px;
          margin-right: 12px;
          background: rgba(255,255,255,.08);
        }

        .g365-mm-bye {
          color: #fb4b2f;
          font-size: 13px;
          letter-spacing: .06em;
        }

        .g365-mm-card-bye {
          min-height: 66px;
        }

        .g365-mm-tie {
          padding: 6px 10px;
          color: #fbbf24;
          border-top: 1px solid rgba(251,191,36,.24);
          background: rgba(251,191,36,.06);
          font-size: 10px;
          font-weight: 900;
          text-align: center;
          letter-spacing: .05em;
        }

        .g365-mm-connector {
          position: absolute;
          pointer-events: none;
        }

        .g365-mm-connector-h1,
        .g365-mm-connector-h2,
        .g365-mm-connector-v {
          position: absolute;
          background: rgba(248,250,252,.90);
          box-shadow: 0 0 8px rgba(255,255,255,.06);
        }

        .g365-mm-connector-h1,
        .g365-mm-connector-h2 {
          height: 3px;
        }

        .g365-mm-connector-v {
          width: 3px;
        }

        .g365-mm-champion {
          position: absolute;
          width: ${CARD_WIDTH}px;
          min-height: 170px;
          transform: translateY(-50%);
          border: 1px solid rgba(251,191,36,.48);
          border-radius: 12px;
          display: grid;
          place-items: center;
          align-content: center;
          gap: 10px;
          color: #f8fafc;
          background:
            radial-gradient(circle at 50% 0%,rgba(251,191,36,.12),transparent 58%),
            rgba(255,255,255,.018);
          box-shadow: 0 18px 42px rgba(0,0,0,.30);
          text-align: center;
        }

        .g365-mm-champion-icon {
          font-size: 46px;
          line-height: 1;
        }

        .g365-mm-champion strong {
          color: #fbbf24;
          font-size: 16px;
          letter-spacing: .08em;
        }

        .g365-mm-champion span {
          color: #f8fafc;
          font-size: 18px;
          font-weight: 900;
        }

        .g365-mm-footer {
          min-height: 60px;
          padding: 14px 22px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          color: #aab2bd;
          border-top: 1px solid rgba(255,255,255,.08);
          font-size: 12px;
        }

        .g365-mm-footer strong {
          color: #f8fafc;
        }

        @media (max-width: 760px) {
          .g365-mm-shell {
            border-radius: 14px;
          }

          .g365-mm-header {
            align-items: flex-start;
            flex-direction: column;
            padding: 16px 14px;
            gap: 14px;
          }

          .g365-mm-title-row {
            gap: 10px;
          }

          .g365-mm-trophy {
            font-size: 28px;
          }

          .g365-mm-title {
            font-size: 28px;
          }

          .g365-mm-subtitle {
            font-size: 12px;
          }

          .g365-mm-meta {
            width: 100%;
            text-align: left;
            font-size: 12px;
          }

          .g365-mm-scroll {
            overflow: visible;
            width: 100%;
            padding: 0;
          }

          .g365-mm-board {
            position: relative !important;
            width: 100% !important;
            min-width: 0 !important;
            min-height: 0 !important;
            height: auto !important;
            display: flex;
            flex-direction: column;
            gap: 0;
            padding: 0 12px 14px;
          }

          .g365-mm-column {
            position: relative !important;
            left: auto !important;
            top: auto !important;
            width: 100% !important;
            height: auto !important;
          }

          .g365-mm-round-head {
            height: auto;
            min-height: 58px;
            padding: 12px 6px 8px;
            border-bottom: 1px solid rgba(255,255,255,.10);
          }

          .g365-mm-round-head strong {
            font-size: 13px;
          }

          .g365-mm-round-head span {
            font-size: 12px;
          }

          .g365-mm-position {
            position: relative !important;
            left: auto !important;
            top: auto !important;
            width: 100% !important;
            transform: none !important;
            margin: 10px 0;
          }

          .g365-mm-card,
          .g365-mm-link,
          .g365-mm-champion {
            width: 100% !important;
            max-width: none !important;
          }

          .g365-mm-card {
            min-height: 104px;
          }

          .g365-mm-team,
          .g365-mm-bye-line {
            grid-template-columns: 30px minmax(0,1fr) auto;
            gap: 8px;
            padding: 8px 10px;
          }

          .g365-mm-seed {
            font-size: 18px;
          }

          .g365-mm-team-copy strong {
            font-size: 14px;
          }

          .g365-mm-score {
            font-size: 15px;
          }

          .g365-mm-connector {
            display: none !important;
          }

          .g365-mm-champion {
            position: relative !important;
            left: auto !important;
            top: auto !important;
            transform: none !important;
            min-height: 142px;
            margin: 12px 0 2px;
          }

          .g365-mm-champion-icon {
            font-size: 38px;
          }

          .g365-mm-footer {
            align-items: flex-start;
            flex-direction: column;
            padding: 12px 14px;
            gap: 8px;
            font-size: 11px;
          }
        }
      `}</style>

      <header
        className="g365-mm-header"
      >
        <div
          className="g365-mm-title-row"
        >
          <span
            className="g365-mm-trophy"
          >
            🏆
          </span>

          <div>
            <h2
              className="g365-mm-title"
            >
              PLAYOFFS
            </h2>

            <span
              className="g365-mm-subtitle"
            >
              {playoffTeamCount} Team Playoff Bracket
            </span>
          </div>
        </div>

        <div
          className="g365-mm-meta"
        >
          <div>
            <strong>
              {leagueName}
            </strong>
            {" • "}
            {season}
          </div>

          <div>
            Exactly {playoffTeamCount} teams in the playoff field
          </div>

          {statusLabel ? (
            <div
              className="g365-mm-status"
            >
              {statusLabel}
            </div>
          ) : null}

          {rightHeader}
        </div>
      </header>

      <div
        className="g365-mm-scroll"
      >
        <div
          className="g365-mm-board"
          style={{
            "--board-height":
              `${boardHeight}px`,
            "--board-width":
              `${boardWidth}px`,
          } as CSSProperties}
        >
          {Array.from(
            {
              length:
                shape.roundCount,
            },
            (
              _,
              roundIndex
            ) => {
              const round =
                roundIndex +
                1;

              const slots =
                rounds.get(
                  round
                ) ??
                [];

              const roundCenters =
                centers[
                  roundIndex
                ] ??
                [];

              const visualCount =
                round === 1
                  ? openingSlots
                  : Math.max(
                      1,
                      roundCenters.length
                    );

              return (
                <div
                  key={
                    round
                  }
                  className="g365-mm-column"
                  style={{
                    left:
                      roundIndex *
                      (
                        CARD_WIDTH +
                        COLUMN_GAP
                      ),
                  }}
                >
                  <div
                    className="g365-mm-round-head"
                  >
                    <strong>
                      {roundName(
                        round,
                        shape.roundCount,
                        visualCount
                      )}
                    </strong>

                    <span>
                      Week{" "}
                      {playoffStartWeek +
                        round -
                        1}
                    </span>
                  </div>

                  {Array.from(
                    {
                      length:
                        Math.max(
                          slots.length,
                          roundCenters.length
                        ),
                    },
                    (
                      __,
                      slotIndex
                    ) => {
                      const center =
                        roundCenters[
                          slotIndex
                        ] ??
                        (
                          TOP_OFFSET +
                          CARD_HEIGHT /
                            2
                        );

                      const slot =
                        slots[
                          slotIndex
                        ] ?? {
                          key:
                            `future-${round}-${slotIndex}`,
                          round,
                          slot:
                            slotIndex +
                            1,
                          week:
                            playoffStartWeek +
                            round -
                            1,
                          home:
                            null,
                          away:
                            null,
                          byeTeam:
                            null,
                          status:
                            "TBD",
                          isFinal:
                            false,
                          isTie:
                            false,
                          href:
                            null,
                        };

                      const nextCenter =
                        centers[
                          roundIndex +
                          1
                        ]?.[
                          Math.floor(
                            slotIndex /
                            2
                          )
                        ];

                      return (
                        <div
                          key={
                            slot.key
                          }
                          className="g365-mm-position"
                          style={{
                            top:
                              center,
                          }}
                        >
                          <SlotCard
                            slot={
                              slot
                            }
                            isChampionship={
                              round ===
                              shape.roundCount
                            }
                          />

                          {round <
                            shape.roundCount &&
                          nextCenter !==
                            undefined ? (
                            <Connector
                              fromY={
                                center
                              }
                              toY={
                                nextCenter
                              }
                            />
                          ) : null}
                        </div>
                      );
                    }
                  )}
                </div>
              );
            }
          )}

          <div
            className="g365-mm-column"
            style={{
              left:
                shape.roundCount *
                (
                  CARD_WIDTH +
                  COLUMN_GAP
                ),
            }}
          >
            <div
              className="g365-mm-round-head"
            >
              <strong>
                CHAMPION
              </strong>

              <span>
                G365
              </span>
            </div>

            <div
              className="g365-mm-champion"
              style={{
                top:
                  championCenter,
              }}
            >
              <span
                className="g365-mm-champion-icon"
              >
                🏆
              </span>

              <strong>
                CHAMPION
              </strong>

              <span>
                {championName ??
                  "TBD"}
              </span>
            </div>
          </div>
        </div>
      </div>

      <footer
        className="g365-mm-footer"
      >
        <span>
          <strong>
            Playoff field:
          </strong>{" "}
          exactly {playoffTeamCount} teams selected by the commissioner.
        </span>

        <span>
          Higher seeds receive the necessary opening-round byes when the field is uneven.
        </span>
      </footer>
    </section>
  );
}


function Connector({
  fromY,
  toY,
}: {
  fromY: number;
  toY: number;
}) {
  const horizontal =
    COLUMN_GAP;

  const firstWidth =
    Math.floor(
      horizontal /
      2
    );

  const secondWidth =
    horizontal -
    firstWidth;

  const delta =
    toY -
    fromY;

  const top =
    Math.min(
      0,
      delta
    );

  const height =
    Math.abs(
      delta
    );

  return (
    <div
      className="g365-mm-connector"
      style={{
        left:
          CARD_WIDTH,
        top:
          CARD_HEIGHT /
          2,
        width:
          horizontal,
        height:
          Math.max(
            height,
            3
          ),
      }}
    >
      <div
        className="g365-mm-connector-h1"
        style={{
          left: 0,
          top: 0,
          width:
            firstWidth,
        }}
      />

      <div
        className="g365-mm-connector-v"
        style={{
          left:
            firstWidth,
          top,
          height:
            Math.max(
              height,
              3
            ),
        }}
      />

      <div
        className="g365-mm-connector-h2"
        style={{
          left:
            firstWidth,
          top:
            delta,
          width:
            secondWidth,
        }}
      />
    </div>
  );
}
