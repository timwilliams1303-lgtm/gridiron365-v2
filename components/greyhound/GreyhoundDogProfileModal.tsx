"use client";

import {
  useEffect,
  useState,
} from "react";

type DogIdentity = {
  dogId: number;
  name: string;
  normalizedName: string | null;
  sex: string | null;
  color: string | null;
  sire: string | null;
  dam: string | null;
  active: boolean;
};

type DogSummary = {
  recordedResults: number;
  wins: number;
  seconds: number;
  thirds: number;
  topFourFinishes: number;
  recordedWinPct: number;
  recordedItmPct: number;
  averageRecordedFinish: number | null;
  averageOddsDecimal: number | null;
  latestRecordedRaceDate: string | null;
  partialHistory: boolean;
};

type RecentFormRow = {
  dogResultId: number;
  // Legacy imported-program renderer fields remain optional only so the
  // preserved JSX below stays type-safe. recentTimeline now contains G365
  // rows exclusively, so these fields are never used for Recent Form.
  performanceCode?: string | null;
  finishTime?: number | null;
  speedRating?: number | null;
  odds?: string | null;
  condition?: string | null;
  runningPositions?: number[] | null;
  marginText?: string | null;
  comment?: string | null;
  raceId: number | null;
  raceDate: string;
  raceNumber: number;
  trackId: number;
  trackCode: string | null;
  trackName: string | null;
  boxNumber: number | null;
  grade: string | null;
  distanceYards: number | null;
  finishPosition: number | null;
  fieldSize: number | null;
  weight: number | string | null;
  officialTime: number | string | null;
  winnerTime: number | string | null;
  margin: string | null;
  oddsText: string | null;
  oddsDecimal: number | null;
  raceComment: string | null;
  kennel: string | null;
  trainer: string | null;
  recentResultNumber: number;
};

type ProgramHistoryRow = {
  id: number;
  raceDate: string | null;
  performanceCode: string | null;
  trackCode: string | null;
  trackName: string | null;
  distanceYards: number | null;
  condition: string | null;
  weight: number | string | null;
  boxNumber: number | null;
  runningPositions: number[];
  finishPosition: number | null;
  marginText: string | null;
  finishTime: number | string | null;
  speedRating: number | null;
  odds: string | null;
  grade: string | null;
  comment: string | null;
  source: string;
};

type ProgramBlock = {
  id: number;
  programTrackCode: string | null;
  programDate: string | null;
  kennel: string | null;
  trainer: string | null;
  programBlockText: string;
  programBlockImageDataUrl: string | null;
  source: string;
};

type TrackSplit = {
  trackId: number;
  trackCode: string;
  trackName: string;
  recordedResults: number;
  wins: number;
  itmFinishes: number;
  averageRecordedFinish: number | null;
};

type GradeSplit = {
  grade: string | null;
  recordedResults: number;
  wins: number;
  itmFinishes: number;
  averageRecordedFinish: number | null;
};

type DistanceSplit = {
  distanceYards: number | null;
  recordedResults: number;
  wins: number;
  itmFinishes: number;
  averageRecordedFinish: number | null;
};

type BoxSplit = {
  boxNumber: number | null;
  recordedResults: number;
  wins: number;
  itmFinishes: number;
  averageRecordedFinish: number | null;
};

type DogProfile = {
  dog: DogIdentity;
  summary: DogSummary;
  recentForm: RecentFormRow[];
  programHistory: ProgramHistoryRow[];
  programBlocks: ProgramBlock[];
  splits: {
    tracks: TrackSplit[];
    grades: GradeSplit[];
    distances: DistanceSplit[];
    boxes: BoxSplit[];
  };
  historyNotice: string;
};

type TabKey =
  | "recent"
  | "program";

type Props = {
  leagueId: string;
  dogId: number;
  dogName: string;
  className?: string;
};

function formatDate(
  value: string | null,
) {
  if (!value) {
    return "—";
  }

  const parsed =
    new Date(
      `${value}T12:00:00`,
    );

  if (
    Number.isNaN(
      parsed.getTime(),
    )
  ) {
    return value;
  }

  return new Intl.DateTimeFormat(
    "en-US",
    {
      month: "short",
      day: "numeric",
      year: "numeric",
    },
  ).format(parsed);
}

function formatNumber(
  value:
    | number
    | string
    | null
    | undefined,
  digits = 2,
) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "—";
  }

  const numeric =
    Number(value);

  if (
    Number.isNaN(
      numeric,
    )
  ) {
    return String(value);
  }

  return numeric.toFixed(
    digits,
  );
}

function ordinal(
  value: number | null,
) {
  if (
    value === null
  ) {
    return "—";
  }

  const remainder100 =
    value % 100;

  if (
    remainder100 >= 11 &&
    remainder100 <= 13
  ) {
    return `${value}th`;
  }

  switch (
    value % 10
  ) {
    case 1:
      return `${value}st`;

    case 2:
      return `${value}nd`;

    case 3:
      return `${value}rd`;

    default:
      return `${value}th`;
  }
}

function runningPositionLabels(
  count: number,
): string[] {
  if (count >= 4) {
    return [
      "Break",
      "1st Turn",
      "Backstretch",
      "Finish",
    ].slice(0, count);
  }

  if (count === 4) {
    return [
      "Break",
      "1st Turn",
      "Backstretch",
      "Finish",
    ];
  }

  if (count === 3) {
    return [
      "Break",
      "Turn",
      "Finish",
    ];
  }

  if (count === 2) {
    return [
      "Break",
      "Finish",
    ];
  }

  if (count === 1) {
    return [
      "Finish",
    ];
  }

  return [];
}

function formatFinalOdds(
  value: string | null | undefined,
): string | null {
  const raw = String(value ?? "")
    .trim()
    .replace(/\*+$/, "");

  if (!raw || raw === "----") {
    return null;
  }

  // Preserve odds already supplied in program/fractional style.
  const fractional = raw.match(
    /^(\d+)\s*[-/]\s*(\d+)$/,
  );

  if (fractional) {
    return `${fractional[1]}-${fractional[2]}`;
  }

  const decimal = Number(raw);

  if (!Number.isFinite(decimal) || decimal < 0) {
    return raw;
  }

  /*
   * The imported program value is the track's final odds-to-1 price.
   * Display it in the familiar racebook style:
   *
   *   9.30  -> 9-1
   *   7.30  -> 7-1
   *   4.30  -> 4-1
   *   11.50 -> 11-1
   *
   * For odds below even money, retain useful precision:
   *   0.80 -> 4-5
   *   0.50 -> 1-2
   */
  if (decimal >= 1) {
    return `${Math.floor(decimal)}-1`;
  }

  if (decimal === 0) {
    return "0-1";
  }

  const denominators = [
    2, 5, 10, 20, 100,
  ];

  let bestNumerator = 1;
  let bestDenominator = 1;
  let bestError = Number.POSITIVE_INFINITY;

  for (const denominator of denominators) {
    const numerator = Math.max(
      1,
      Math.round(decimal * denominator),
    );
    const error = Math.abs(
      decimal - numerator / denominator,
    );

    if (error < bestError) {
      bestError = error;
      bestNumerator = numerator;
      bestDenominator = denominator;
    }
  }

  const gcd = (a: number, b: number): number =>
    b === 0 ? a : gcd(b, a % b);

  const divisor = gcd(
    bestNumerator,
    bestDenominator,
  );

  return `${bestNumerator / divisor}-${bestDenominator / divisor}`;
}
function RunningPositionLine({
  boxNumber,
  positions,
  marginText,
  finalOdds,
}: {
  boxNumber: number | null;
  positions: number[];
  finishPosition: number | null;
  marginText: string | null;
  finalOdds?: string | null;
}) {
  const cleanPositions =
    Array.isArray(
      positions,
    )
      ? positions.filter(
          (position) =>
            Number.isInteger(
              Number(
                position,
              ),
            ) &&
            Number(
              position,
            ) >= 1 &&
            Number(
              position,
            ) <= 8,
        )
      : [];

  if (
    boxNumber === null &&
    cleanPositions.length === 0
  ) {
    return null;
  }

  const labels =
    runningPositionLabels(
      cleanPositions.length,
    );

  return (
    <div className="gdp-running-wrap">
      <div className="gdp-running-title">
        RUNNING POSITIONS
      </div>

      <div className="gdp-running-line">
        {boxNumber !== null ? (
          <>
            <div className="gdp-running-call">
              <span>
                Box
              </span>

              <strong>
                {boxNumber}
              </strong>
            </div>

            {cleanPositions.length >
            0 ? (
              <span className="gdp-running-arrow">
                →
              </span>
            ) : null}
          </>
        ) : null}

        {cleanPositions.map(
          (
            position,
            index,
          ) => {
            const isLast =
              index ===
              cleanPositions.length -
                1;

            return (
              <div
                key={`${labels[index] ?? "Call"}-${index}`}
                className="gdp-running-fragment"
              >
                <div
                  className={`gdp-running-call ${
                    isLast
                      ? "finish"
                      : ""
                  }`}
                >
                  <span>
                    {labels[
                      index
                    ] ??
                      `Call ${
                        index + 1
                      }`}
                  </span>

                  <strong>
                    {position}
                  </strong>

                  {isLast &&
                  marginText ? (
                    <small>
                      Margin {marginText}
                    </small>
                  ) : null}
                </div>

                {!isLast ? (
                  <span className="gdp-running-arrow">
                    →
                  </span>
                ) : null}
              </div>
            );
          },
        )}

        {formatFinalOdds(finalOdds) ? (
          <>
            <span className="gdp-running-arrow">
              →
            </span>

            <div className="gdp-final-odds">
              <span>Final Odds</span>
              <strong>
                {formatFinalOdds(finalOdds)}
              </strong>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}


function StatBox({
  label,
  value,
}: {
  label: string;
  value:
    | string
    | number;
}) {
  return (
    <div className="gdp-stat">
      <strong>
        {value}
      </strong>

      <span>
        {label}
      </span>
    </div>
  );
}

export default function GreyhoundDogProfileModal({
  leagueId,
  dogId,
  dogName,
  className = "",
}: Props) {
  const [
    open,
    setOpen,
  ] =
    useState(false);

  const [
    loading,
    setLoading,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null,
    );

  const [
    profile,
    setProfile,
  ] =
    useState<DogProfile | null>(
      null,
    );

  const [
    activeTab,
    setActiveTab,
  ] =
    useState<TabKey>(
      "recent",
    );

  useEffect(
    () => {
      if (!open) {
        return;
      }

      const previousOverflow =
        document.body.style
          .overflow;

      document.body.style
        .overflow =
        "hidden";

      const onKeyDown = (
        event: KeyboardEvent,
      ) => {
        if (
          event.key ===
          "Escape"
        ) {
          setOpen(false);
        }
      };

      window.addEventListener(
        "keydown",
        onKeyDown,
      );

      return () => {
        document.body.style
          .overflow =
          previousOverflow;

        window.removeEventListener(
          "keydown",
          onKeyDown,
        );
      };
    },
    [
      open,
    ],
  );

  async function loadProfile() {
    if (
      profile ||
      loading
    ) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response =
        await fetch(
          `/api/greyhound/dogs/${dogId}/profile?leagueId=${encodeURIComponent(
            leagueId,
          )}`,
          {
            method:
              "GET",

            cache:
              "no-store",
          },
        );

      const payload =
        (await response.json()) as {
          success?: boolean;
          profile?: DogProfile;
          error?: string;
        };

      if (
        !response.ok ||
        !payload.success ||
        !payload.profile
      ) {
        throw new Error(
          payload.error ??
            "Could not load Greyhound profile.",
        );
      }

      setProfile(
        payload.profile,
      );
    } catch (
      caught
    ) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not load Greyhound profile.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function openProfile() {
    setOpen(true);

    await loadProfile();
  }

  const summary =
    profile?.summary;

  const recentTimeline =
    profile
      ? profile.recentForm
          .map((row) => ({
            kind: "g365" as const,
            key: `g365-${row.dogResultId}`,
            sortDate: row.raceDate ?? "",
            row,
          }))
          .sort(
            (first, second) =>
              second.sortDate.localeCompare(
                first.sortDate,
              ),
          )
      : [];


  return (
    <>
      <button
        type="button"
        className={`gdp-name-button ${className}`}
        onClick={
          openProfile
        }
        title={`View ${dogName} stats`}
      >
        {dogName}
      </button>

      {open ? (
        <div
          className="gdp-overlay"
          role="presentation"
          onMouseDown={(
            event,
          ) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setOpen(
                false,
              );
            }
          }}
        >
          <div
            className="gdp-modal"
            role="dialog"
            aria-modal="true"
            aria-label={`${dogName} Greyhound profile`}
          >
            <div className="gdp-header">
              <div>
                <div className="gdp-kicker">
                  G365 GREYHOUND
                  PROFILE
                </div>

                <h2 className="gdp-title">
                  {profile?.dog
                    .name ??
                    dogName}
                </h2>

                {profile ? (
                  <div className="gdp-dog-meta">
                    {profile.dog
                      .color ? (
                      <span>
                        {
                          profile
                            .dog
                            .color
                        }
                      </span>
                    ) : null}

                    {profile.dog
                      .sex ? (
                      <span>
                        {
                          profile
                            .dog
                            .sex
                        }
                      </span>
                    ) : null}

                    {profile.dog
                      .sire ? (
                      <span>
                        Sire:{" "}
                        {
                          profile
                            .dog
                            .sire
                        }
                      </span>
                    ) : null}

                    {profile.dog
                      .dam ? (
                      <span>
                        Dam:{" "}
                        {
                          profile
                            .dog
                            .dam
                        }
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <button
                type="button"
                className="gdp-close"
                onClick={() =>
                  setOpen(
                    false,
                  )
                }
                aria-label="Close dog profile"
              >
                ×
              </button>
            </div>

            {loading ? (
              <div className="gdp-state">
                Loading Greyhound
                profile…
              </div>
            ) : error ? (
              <div className="gdp-error">
                <strong>
                  Could not load
                  profile
                </strong>

                <span>
                  {error}
                </span>

                <button
                  type="button"
                  onClick={() => {
                    setProfile(
                      null,
                    );

                    void loadProfile();
                  }}
                >
                  TRY AGAIN
                </button>
              </div>
            ) : profile &&
              summary ? (
              <>
                <div className="gdp-summary">
                  <StatBox
                    label="Recorded"
                    value={
                      summary.recordedResults
                    }
                  />

                  <StatBox
                    label="Wins"
                    value={
                      summary.wins
                    }
                  />

                  <StatBox
                    label="Place"
                    value={
                      summary.seconds
                    }
                  />

                  <StatBox
                    label="Show"
                    value={
                      summary.thirds
                    }
                  />

                  <StatBox
                    label="Win %"
                    value={`${summary.recordedWinPct}%`}
                  />

                  <StatBox
                    label="ITM %"
                    value={`${summary.recordedItmPct}%`}
                  />

                  <StatBox
                    label="Avg Finish"
                    value={
                      summary.averageRecordedFinish ??
                      "—"
                    }
                  />

                  <StatBox
                    label="Top 4"
                    value={
                      summary.topFourFinishes
                    }
                  />
                </div>

                <div className="gdp-history-note">
                  <strong>
                    RECORDED G365
                    HISTORY
                  </strong>

                  <span>
                    {
                      profile.historyNotice
                    }
                  </span>

                  {summary.latestRecordedRaceDate ? (
                    <span>
                      Latest recorded
                      result:{" "}
                      {formatDate(
                        summary.latestRecordedRaceDate,
                      )}
                    </span>
                  ) : null}
                </div>

                <div className="gdp-tabs">
                  <button
                    type="button"
                    className={
                      activeTab ===
                      "recent"
                        ? "active"
                        : ""
                    }
                    onClick={() =>
                      setActiveTab(
                        "recent",
                      )
                    }
                  >
                    Recent Form
                  </button>
                </div>

                <div className="gdp-content">
                  {activeTab ===
                  "recent" ? (
                    recentTimeline.length ===
                    0 ? (
                      <div className="gdp-empty">
                        No G365 race results
                        recorded yet.
                      </div>
                    ) : (
                      <div className="gdp-form-list">
                        {recentTimeline.map(
                          (item) => {
                            if (
                              item.kind ===
                              "g365"
                            ) {
                              const row =
                                item.row;

                              return (
                                <div
                                  key={
                                    item.key
                                  }
                                  className="gdp-form-card"
                                >
                                  <div className="gdp-finish">
                                    <strong>
                                      {ordinal(
                                        row.finishPosition,
                                      )}
                                    </strong>

                                    <span>
                                      FINISH
                                    </span>
                                  </div>

                                  <div className="gdp-form-main">
                                    <div className="gdp-history-source-row">
                                      <span className="gdp-history-source g365">
                                        G365 RESULT
                                      </span>
                                    </div>

                                    <div className="gdp-form-title">
                                      {row.trackCode ??
                                        "G365"}{" "}
                                      · Race{" "}
                                      {
                                        row.raceNumber
                                      }
                                    </div>

                                    <div className="gdp-form-date">
                                      {formatDate(
                                        row.raceDate,
                                      )}
                                    </div>

                                    <div className="gdp-form-meta">
                                      {row.grade ? (
                                        <span>
                                          Grade{" "}
                                          {
                                            row.grade
                                          }
                                        </span>
                                      ) : null}

                                      {row.distanceYards ? (
                                        <span>
                                          {
                                            row.distanceYards
                                          }{" "}
                                          Yards
                                        </span>
                                      ) : null}

                                      {row.boxNumber ? (
                                        <span>
                                          Box{" "}
                                          {
                                            row.boxNumber
                                          }
                                        </span>
                                      ) : null}

                                      {row.fieldSize ? (
                                        <span>
                                          {
                                            row.fieldSize
                                          }{" "}
                                          Dogs
                                        </span>
                                      ) : null}

                                      {row.oddsText ? (
                                        <span>
                                          Odds{" "}
                                          {
                                            row.oddsText
                                          }
                                        </span>
                                      ) : null}
                                    </div>

                                    {(row.trainer ||
                                      row.kennel) && (
                                      <div className="gdp-form-secondary">
                                        {row.trainer
                                          ? `Trainer: ${row.trainer}`
                                          : ""}

                                        {row.trainer &&
                                        row.kennel
                                          ? " · "
                                          : ""}

                                        {row.kennel
                                          ? `Kennel: ${row.kennel}`
                                          : ""}
                                      </div>
                                    )}

                                    {row.raceComment ? (
                                      <div className="gdp-comment">
                                        {
                                          row.raceComment
                                        }
                                      </div>
                                    ) : null}
                                  </div>
                                </div>
                              );
                            }

                            const row =
                              item.row;

                            return (
                              <div
                                key={
                                  item.key
                                }
                                className="gdp-form-card gdp-program-form-card"
                              >
                                <div className="gdp-program-history-mark">
                                  <strong>
                                    {row.performanceCode ??
                                      "PP"}
                                  </strong>

                                  <span>
                                    PROGRAM
                                  </span>
                                </div>

                                <div className="gdp-form-main">
                                  <div className="gdp-history-source-row">
                                    <span className="gdp-history-source program">
                                      PROGRAM HISTORY
                                    </span>
                                  </div>

                                  <div className="gdp-form-title">
                                    {row.trackName ??
                                      row.trackCode ??
                                      "Track"}
                                    {row.performanceCode
                                      ? ` · ${row.performanceCode}`
                                      : ""}
                                  </div>

                                  <div className="gdp-form-date">
                                    {formatDate(
                                      row.raceDate,
                                    )}
                                  </div>

                                  <div className="gdp-form-meta">
                                    {row.grade ? (
                                      <span>
                                        Grade{" "}
                                        {
                                          row.grade
                                        }
                                      </span>
                                    ) : null}

                                    {row.distanceYards ? (
                                      <span>
                                        {
                                          row.distanceYards
                                        }{" "}
                                        Yards
                                      </span>
                                    ) : null}

                                    {row.boxNumber ? (
                                      <span>
                                        Box{" "}
                                        {
                                          row.boxNumber
                                        }
                                      </span>
                                    ) : null}

                                    {row.weight !==
                                    null ? (
                                      <span>
                                        Wgt{" "}
                                        {formatNumber(
                                          row.weight,
                                          0,
                                        )}
                                      </span>
                                    ) : null}

                                    {row.finishTime !==
                                    null ? (
                                      <span>
                                        Time{" "}
                                        {formatNumber(
                                          row.finishTime,
                                          2,
                                        )}
                                      </span>
                                    ) : null}

                                    {row.speedRating !==
                                    null ? (
                                      <span>
                                        SPD{" "}
                                        {
                                          row.speedRating
                                        }
                                      </span>
                                    ) : null}

                                    {row.odds ? (
                                      <span>
                                        Odds{" "}
                                        {
                                          formatFinalOdds(
                                            row.odds,
                                          )
                                        }
                                      </span>
                                    ) : null}

                                    {row.condition ? (
                                      <span>
                                        {
                                          row.condition
                                        }
                                      </span>
                                    ) : null}
                                  </div>

                                  <RunningPositionLine
                                    boxNumber={
                                      row.boxNumber
                                    }
                                    positions={
                                      row.runningPositions ?? []
                                    }
                                    finishPosition={
                                      row.finishPosition
                                    }
                                    marginText={
                                      row.marginText ?? null
                                    }
                                    finalOdds={
                                      row.odds
                                    }
                                  />

                                  {row.comment ? (
                                    <div className="gdp-comment">
                                      {
                                        row.comment
                                      }
                                    </div>
                                  ) : null}
                                </div>
                              </div>
                            );
                          },
                        )}
                      </div>
                    )
                  ) : null}

                  {activeTab ===
                  "program" ? (
                    (profile.programBlocks ?? []).length === 0 ? (
                      <div className="gdp-empty">
                        No preserved imported program block yet. Re-import the
                        official Wheeling or Tri-State program once.
                      </div>
                    ) : (
                      <div className="gdp-source-program-list">
                        {(profile.programBlocks ?? []).map((block) => (
                          <section key={block.id} className="gdp-source-program-card">
                            <div className="gdp-source-program-head">
                              <div>
                                <strong>
                                  {block.programTrackCode === "GWD"
                                    ? "WHEELING"
                                    : block.programTrackCode === "GTS"
                                      ? "TRI-STATE"
                                      : block.programTrackCode ?? "PROGRAM"}
                                </strong>
                                <span>OFFICIAL IMPORTED PROGRAM</span>
                              </div>
                              {block.programDate ? (
                                <time>{formatDate(block.programDate)}</time>
                              ) : null}
                            </div>

                            {(block.kennel || block.trainer) ? (
                              <div className="gdp-source-program-meta">
                                {block.kennel ? <span>KENNEL: {block.kennel}</span> : null}
                                {block.trainer ? <span>TRAINER: {block.trainer}</span> : null}
                              </div>
                            ) : null}

                            <div className="gdp-source-program-scroll">
                              {block.programBlockImageDataUrl ? (
                                <img
                                  className="gdp-source-program-image"
                                  src={block.programBlockImageDataUrl}
                                  alt={`${dogName} official imported program past performances`}
                                  draggable={false}
                                />
                              ) : (
                                <pre className="gdp-source-program-text">
                                  {block.programBlockText}
                                </pre>
                              )}
                            </div>
                          </section>
                        ))}
                      </div>
                    )
                  ) : null}

                </div>
              </>
            ) : null}
          </div>

          <style jsx global>{`
            .gdp-name-button {
              appearance: none;
              margin: 0;
              padding: 0;
              border: 0;
              background: transparent;
              color: inherit;
              font: inherit;
              font-weight: inherit;
              text-align: left;
              cursor: pointer;
              text-decoration: underline;
              text-decoration-color: rgba(255, 106, 34, 0.55);
              text-decoration-thickness: 1px;
              text-underline-offset: 3px;
              transition:
                color 0.15s ease,
                text-decoration-color 0.15s ease;
            }

            .gdp-name-button:hover {
              color: #ff8b4d;
              text-decoration-color: #ff6b22;
            }

            .gdp-overlay {
              position: fixed;
              inset: 0;
              z-index: 10000;
              display: flex;
              align-items: center;
              justify-content: center;
              padding:
                max(14px, env(safe-area-inset-top))
                max(12px, env(safe-area-inset-right))
                max(14px, env(safe-area-inset-bottom))
                max(12px, env(safe-area-inset-left));
              background: rgba(0, 0, 0, 0.82);
              backdrop-filter: blur(8px);
            }

            .gdp-modal {
              width: min(920px, 100%);
              max-height: min(840px, calc(100dvh - 28px));
              overflow-y: auto;
              overscroll-behavior: contain;
              border: 1px solid rgba(255, 94, 24, 0.34);
              border-radius: 18px;
              background:
                radial-gradient(
                  circle at top left,
                  rgba(151, 27, 15, 0.2),
                  transparent 30%
                ),
                #0d0e10;
              box-shadow:
                0 30px 100px rgba(0, 0, 0, 0.72),
                0 0 0 1px rgba(255, 255, 255, 0.025);
              color: #fff;
              scrollbar-width: thin;
            }

            .gdp-header {
              position: sticky;
              top: 0;
              z-index: 4;
              display: flex;
              align-items: flex-start;
              justify-content: space-between;
              gap: 18px;
              padding: 20px;
              border-bottom: 1px solid #2b2c2f;
              background:
                linear-gradient(
                  135deg,
                  rgba(105, 17, 13, 0.96),
                  rgba(36, 18, 13, 0.98) 44%,
                  rgba(14, 15, 17, 0.98)
                );
              backdrop-filter: blur(12px);
            }

            .gdp-kicker {
              color: #ff712c;
              font-size: 9px;
              font-weight: 950;
              letter-spacing: 0.14em;
            }

            .gdp-title {
              margin: 5px 0 0;
              color: #fff;
              font-size: clamp(25px, 5vw, 38px);
              line-height: 1;
              font-weight: 950;
              letter-spacing: -0.03em;
            }

            .gdp-dog-meta {
              display: flex;
              flex-wrap: wrap;
              gap: 5px 14px;
              margin-top: 8px;
              color: #b2b5ba;
              font-size: 10px;
              font-weight: 700;
            }

            .gdp-close {
              width: 40px;
              height: 40px;
              flex: 0 0 40px;
              border: 1px solid #45474b;
              border-radius: 10px;
              background: rgba(0, 0, 0, 0.38);
              color: #fff;
              font-size: 26px;
              line-height: 1;
              cursor: pointer;
            }

            .gdp-close:hover {
              border-color: #e86328;
              color: #ff8e57;
            }

            .gdp-state {
              padding: 80px 20px;
              color: #92979f;
              font-size: 13px;
              font-weight: 800;
              text-align: center;
            }

            .gdp-error {
              display: grid;
              gap: 7px;
              margin: 20px;
              padding: 16px;
              border: 1px solid rgba(198, 50, 42, 0.52);
              border-radius: 12px;
              background: rgba(92, 16, 13, 0.28);
              color: #ffb0aa;
            }

            .gdp-error strong {
              font-size: 12px;
            }

            .gdp-error span {
              font-size: 10px;
              line-height: 1.55;
            }

            .gdp-error button {
              width: max-content;
              margin-top: 5px;
              padding: 8px 12px;
              border: 1px solid rgba(255, 108, 35, 0.45);
              border-radius: 8px;
              background: rgba(105, 34, 11, 0.3);
              color: #ffa06b;
              font-size: 9px;
              font-weight: 950;
              cursor: pointer;
            }

            .gdp-summary {
              display: grid;
              grid-template-columns: repeat(8, minmax(0, 1fr));
              gap: 7px;
              padding: 14px;
              border-bottom: 1px solid #28292c;
            }

            .gdp-stat {
              min-width: 0;
              padding: 11px 6px;
              border: 1px solid #303236;
              border-radius: 10px;
              background: rgba(0, 0, 0, 0.25);
              text-align: center;
            }

            .gdp-stat strong {
              display: block;
              color: #fff;
              font-size: 17px;
              font-weight: 950;
            }

            .gdp-stat span {
              display: block;
              margin-top: 3px;
              overflow: hidden;
              color: #777c84;
              font-size: 7px;
              font-weight: 950;
              letter-spacing: 0.07em;
              text-overflow: ellipsis;
              text-transform: uppercase;
              white-space: nowrap;
            }

            .gdp-history-note {
              display: flex;
              flex-wrap: wrap;
              align-items: center;
              gap: 4px 12px;
              padding: 10px 14px;
              border-bottom: 1px solid #28292c;
              background: rgba(90, 35, 12, 0.18);
              color: #989ca3;
              font-size: 9px;
              line-height: 1.5;
            }

            .gdp-history-note strong {
              color: #ff8b4d;
              font-size: 8px;
              letter-spacing: 0.08em;
            }

            .gdp-tabs {
              position: sticky;
              top: 80px;
              z-index: 3;
              display: flex;
              overflow-x: auto;
              padding: 8px;
              border-bottom: 1px solid #28292c;
              background: rgba(13, 14, 16, 0.97);
              scrollbar-width: thin;
            }

            .gdp-tabs button {
              min-height: 38px;
              flex: 0 0 auto;
              padding: 0 13px;
              border: 1px solid transparent;
              border-radius: 8px;
              background: transparent;
              color: #858a92;
              font-size: 9px;
              font-weight: 950;
              cursor: pointer;
              white-space: nowrap;
            }

            .gdp-tabs button.active {
              border-color: rgba(255, 94, 24, 0.38);
              background:
                linear-gradient(
                  135deg,
                  rgba(121, 27, 15, 0.42),
                  rgba(255, 84, 17, 0.1)
                );
              color: #ff985f;
            }

            .gdp-content {
              padding: 14px;
            }

            .gdp-history-source-row {
              display: flex;
              flex-wrap: wrap;
              gap: 6px;
              margin-bottom: 6px;
            }

            .gdp-history-source {
              display: inline-flex;
              align-items: center;
              min-height: 22px;
              padding: 4px 7px;
              border-radius: 999px;
              font-size: 7px;
              font-weight: 950;
              letter-spacing: .08em;
              text-transform: uppercase;
            }

            .gdp-history-source.g365 {
              border: 1px solid rgba(48,156,91,.38);
              background: rgba(15,86,47,.28);
              color: #9ce8bc;
            }

            .gdp-history-source.program {
              border: 1px solid rgba(235,91,27,.42);
              background: rgba(105,35,10,.30);
              color: #ffab78;
            }

            .gdp-program-form-card {
              border-color: rgba(212,78,24,.35);
              background:
                linear-gradient(105deg,rgba(104,28,10,.18),#101113 44%);
            }

            .gdp-program-history-mark {
              display: flex;
              width: 64px;
              min-width: 64px;
              min-height: 64px;
              align-self: stretch;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              border-right: 1px solid rgba(218,82,25,.30);
              background: rgba(81,24,8,.28);
              text-align: center;
            }

            .gdp-program-history-mark strong {
              max-width: 58px;
              color: #fff;
              font-size: 13px;
              line-height: 1.05;
              font-weight: 950;
              overflow-wrap: anywhere;
            }

            .gdp-program-history-mark span {
              margin-top: 4px;
              color: #d97745;
              font-size: 6px;
              font-weight: 950;
              letter-spacing: .08em;
            }

            .gdp-running-wrap {
              width: fit-content;
              max-width: 100%;
              margin-top: 9px;
              padding: 8px 9px;
              border: 1px solid #2d3034;
              border-radius: 10px;
              background: rgba(0,0,0,.24);
            }

            .gdp-running-title {
              margin-bottom: 7px;
              color: #d26a38;
              font-size: 7px;
              font-weight: 950;
              letter-spacing: .10em;
              text-transform: uppercase;
            }

            .gdp-running-line {
              display: flex;
              max-width: 100%;
              align-items: center;
              gap: 5px;
              overflow-x: auto;
              padding-bottom: 2px;
              scrollbar-width: thin;
            }

            .gdp-running-fragment {
              display: flex;
              flex: 0 0 auto;
              align-items: center;
              gap: 5px;
            }

            .gdp-running-call {
              display: grid;
              min-width: 54px;
              min-height: 48px;
              place-items: center;
              align-content: center;
              gap: 2px;
              padding: 6px 7px;
              border: 1px solid #373a3f;
              border-radius: 9px;
              background: #121315;
              text-align: center;
            }

            .gdp-running-call.finish {
              border-color: rgba(231,91,28,.52);
              background: rgba(107,31,9,.28);
            }

            .gdp-running-call span {
              color: #777d84;
              font-size: 6px;
              font-weight: 950;
              letter-spacing: .06em;
              text-transform: uppercase;
              white-space: nowrap;
            }

            .gdp-running-call strong {
              color: #fff;
              font-size: 17px;
              line-height: 1;
              font-weight: 950;
            }

            .gdp-running-call small {
              margin-top: 1px;
              color: #ff9e67;
              font-size: 6px;
              font-weight: 900;
              letter-spacing: .02em;
              white-space: nowrap;
            }

            .gdp-final-odds {
              display: grid;
              min-width: 70px;
              min-height: 52px;
              flex: 0 0 auto;
              place-items: center;
              align-content: center;
              gap: 2px;
              padding: 6px 8px;
              border: 1px solid rgba(231,91,28,.42);
              border-radius: 9px;
              background: rgba(107,31,9,.18);
              text-align: center;
            }

            .gdp-final-odds span {
              color: #d26a38;
              font-size: 6px;
              font-weight: 950;
              letter-spacing: .06em;
              text-transform: uppercase;
              white-space: nowrap;
            }

            .gdp-final-odds strong {
              color: #fff;
              font-size: 14px;
              line-height: 1;
              font-weight: 950;
              white-space: nowrap;
            }

            .gdp-running-arrow {
              flex: 0 0 auto;
              color: #8b4a2b;
              font-size: 12px;
              font-weight: 950;
            }

            .gdp-form-list {
              display: grid;
              gap: 8px;
            }

            .gdp-form-card {
              display: grid;
              grid-template-columns: 76px minmax(0, 1fr);
              gap: 12px;
              padding: 12px;
              border: 1px solid #2b2d30;
              border-radius: 12px;
              background: #111214;
            }

            .gdp-finish {
              display: flex;
              min-height: 74px;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              border: 1px solid rgba(229, 97, 36, 0.36);
              border-radius: 10px;
              background:
                linear-gradient(
                  135deg,
                  rgba(130, 30, 17, 0.4),
                  rgba(214, 83, 24, 0.12)
                );
              text-align: center;
            }

            .gdp-finish strong {
              color: #fff;
              font-size: 22px;
              font-weight: 950;
            }

            .gdp-finish span {
              margin-top: 2px;
              color: #d46c39;
              font-size: 7px;
              font-weight: 950;
              letter-spacing: 0.1em;
            }

            .gdp-form-main {
              min-width: 0;
            }

            .gdp-form-title {
              color: #fff;
              font-size: 13px;
              font-weight: 950;
            }

            .gdp-form-date {
              margin-top: 2px;
              color: #82878f;
              font-size: 9px;
            }

            .gdp-form-meta {
              display: flex;
              flex-wrap: wrap;
              gap: 5px;
              margin-top: 8px;
            }

            .gdp-form-meta span {
              padding: 4px 6px;
              border: 1px solid #34363a;
              border-radius: 6px;
              background: #18191c;
              color: #b9bdc3;
              font-size: 8px;
              font-weight: 850;
            }

            .gdp-form-secondary {
              margin-top: 7px;
              color: #858a91;
              font-size: 9px;
              line-height: 1.5;
            }

            .gdp-comment {
              margin-top: 8px;
              color: #aeb2b8;
              font-size: 9px;
              line-height: 1.55;
            }

            .gdp-program-list {
              display: grid;
              gap: 8px;
            }

            .gdp-program-card {
              padding: 12px;
              border: 1px solid #2b2d30;
              border-radius: 12px;
              background: #111214;
            }

            .gdp-program-top {
              display: flex;
              align-items: flex-start;
              justify-content: space-between;
              gap: 12px;
            }

            .gdp-program-top > div:first-child {
              min-width: 0;
            }

            .gdp-program-top strong {
              display: block;
              color: #fff;
              font-size: 13px;
              font-weight: 950;
            }

            .gdp-program-top span {
              display: block;
              margin-top: 3px;
              color: #82878f;
              font-size: 9px;
            }

            .gdp-speed {
              display: flex;
              min-width: 48px;
              flex: 0 0 auto;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              padding: 7px 8px;
              border: 1px solid rgba(255, 101, 31, 0.36);
              border-radius: 9px;
              background: rgba(116, 31, 12, 0.22);
            }

            .gdp-speed strong {
              color: #fff;
              font-size: 17px;
              line-height: 1;
              font-weight: 950;
            }

            .gdp-speed span {
              margin-top: 3px;
              color: #e37840;
              font-size: 7px;
              font-weight: 950;
              letter-spacing: 0.09em;
            }

            .gdp-table-wrap {
              overflow-x: auto;
              border: 1px solid #2b2d30;
              border-radius: 11px;
            }

            .gdp-table {
              width: 100%;
              min-width: 600px;
              border-collapse: collapse;
            }

            .gdp-table th {
              padding: 10px;
              border-bottom: 1px solid #2d2f32;
              background: #161719;
              color: #e5763e;
              font-size: 8px;
              font-weight: 950;
              letter-spacing: 0.07em;
              text-align: left;
              text-transform: uppercase;
            }

            .gdp-table td {
              padding: 11px 10px;
              border-bottom: 1px solid #242629;
              color: #c9ccd1;
              font-size: 10px;
              font-weight: 700;
            }

            .gdp-table tr:last-child td {
              border-bottom: 0;
            }

            .gdp-empty {
              padding: 40px 16px;
              border: 1px dashed #383a3e;
              border-radius: 12px;
              color: #81868d;
              font-size: 10px;
              text-align: center;
            }

            @media (max-width: 760px) {
              .gdp-overlay {
                align-items: stretch;
                padding:
                  max(8px, env(safe-area-inset-top))
                  max(6px, env(safe-area-inset-right))
                  max(8px, env(safe-area-inset-bottom))
                  max(6px, env(safe-area-inset-left));
              }

              .gdp-modal {
                width: 100%;
                max-height: 100%;
                border-radius: 14px;
              }

              .gdp-header {
                padding: 14px;
              }

              .gdp-title {
                font-size: 25px;
              }

              .gdp-summary {
                grid-template-columns:
                  repeat(
                    4,
                    minmax(0, 1fr)
                  );
                padding: 9px;
              }

              .gdp-stat {
                padding: 9px 4px;
              }

              .gdp-stat strong {
                font-size: 15px;
              }

              .gdp-tabs {
                top: 69px;
              }

              .gdp-content {
                padding: 9px;
              }

              .gdp-form-card {
                grid-template-columns:
                  58px
                  minmax(0, 1fr);
                gap: 9px;
                padding: 9px;
              }

              .gdp-finish {
                min-height: 62px;
              }

              .gdp-finish strong {
                font-size: 18px;
              }
            }

            @media (max-width: 420px) {
              .gdp-summary {
                grid-template-columns:
                  repeat(
                    2,
                    minmax(0, 1fr)
                  );
              }

              .gdp-history-note {
                align-items: flex-start;
                flex-direction: column;
              }
            }

            .gdp-source-program-list { display:grid; gap:14px; }
            .gdp-source-program-card {
              overflow:hidden; border:1px solid #34363b; border-radius:14px;
              background:#f8f6ef; box-shadow:0 12px 30px rgba(0,0,0,.28);
            }
            .gdp-source-program-head {
              display:flex; align-items:center; justify-content:space-between; gap:12px;
              padding:10px 12px; border-bottom:2px solid #111;
              background:linear-gradient(90deg,#250805,#7f1d0d 55%,#111); color:#fff;
            }
            .gdp-source-program-head > div { display:flex; align-items:baseline; gap:9px; }
            .gdp-source-program-head strong { font-size:12px; font-weight:950; letter-spacing:.08em; }
            .gdp-source-program-head span,.gdp-source-program-head time {
              color:#fdba74; font-size:9px; font-weight:900; letter-spacing:.08em;
            }
            .gdp-source-program-meta {
              display:flex; flex-wrap:wrap; gap:6px 16px; padding:7px 12px;
              border-bottom:1px solid #b8b3a8; background:#e5e1d7; color:#18181b;
              font-size:9px; font-weight:900;
            }
            .gdp-source-program-scroll {
              overflow-x:auto; -webkit-overflow-scrolling:touch; background:#f8f6ef;
            }
            .gdp-source-program-image {
              display:block;
              width:auto;
              max-width:none;
              height:auto;
              min-width:100%;
              background:#fff;
              image-rendering:auto;
              user-select:none;
            }

            .gdp-source-program-text {
              width:max-content; min-width:100%; margin:0; padding:12px 14px 14px;
              background:transparent; color:#09090b;
              font-family:"Arial Narrow","Roboto Condensed",ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
              font-size:11px; font-weight:800; line-height:1.35; white-space:pre; tab-size:2;
            }
            @media (max-width:640px) {
              .gdp-source-program-head { align-items:flex-start; flex-direction:column; }
              .gdp-source-program-head > div { align-items:flex-start; flex-direction:column; gap:2px; }
              .gdp-source-program-text { font-size:10px; }
            }

          `}</style>
        </div>
      ) : null}
    </>
  );
}

function SplitTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: Array<
    Array<
      string | number
    >
  >;
}) {
  if (
    rows.length ===
    0
  ) {
    return (
      <div className="gdp-empty">
        No recorded split
        statistics yet.
      </div>
    );
  }

  return (
    <div className="gdp-table-wrap">
      <table className="gdp-table">
        <thead>
          <tr>
            {headers.map(
              (
                header,
              ) => (
                <th
                  key={
                    header
                  }
                >
                  {
                    header
                  }
                </th>
              ),
            )}
          </tr>
        </thead>

        <tbody>
          {rows.map(
            (
              row,
              rowIndex,
            ) => (
              <tr
                key={
                  rowIndex
                }
              >
                {row.map(
                  (
                    value,
                    columnIndex,
                  ) => (
                    <td
                      key={
                        columnIndex
                      }
                    >
                      {
                        value
                      }
                    </td>
                  ),
                )}
              </tr>
            ),
          )}
        </tbody>
      </table>
    </div>
  );
}