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
  | "tracks"
  | "grades"
  | "distances"
  | "boxes";

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

                  <button
                    type="button"
                    className={
                      activeTab ===
                      "tracks"
                        ? "active"
                        : ""
                    }
                    onClick={() =>
                      setActiveTab(
                        "tracks",
                      )
                    }
                  >
                    Track
                  </button>

                  <button
                    type="button"
                    className={
                      activeTab ===
                      "grades"
                        ? "active"
                        : ""
                    }
                    onClick={() =>
                      setActiveTab(
                        "grades",
                      )
                    }
                  >
                    Grade
                  </button>

                  <button
                    type="button"
                    className={
                      activeTab ===
                      "distances"
                        ? "active"
                        : ""
                    }
                    onClick={() =>
                      setActiveTab(
                        "distances",
                      )
                    }
                  >
                    Distance
                  </button>

                  <button
                    type="button"
                    className={
                      activeTab ===
                      "boxes"
                        ? "active"
                        : ""
                    }
                    onClick={() =>
                      setActiveTab(
                        "boxes",
                      )
                    }
                  >
                    Box
                  </button>
                </div>

                <div className="gdp-content">
                  {activeTab ===
                  "recent" ? (
                    profile.recentForm
                      .length ===
                    0 ? (
                      <div className="gdp-empty">
                        No recorded
                        official results
                        yet.
                      </div>
                    ) : (
                      <div className="gdp-form-list">
                        {profile.recentForm.map(
                          (
                            row,
                          ) => (
                            <div
                              key={
                                row.dogResultId
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
                          ),
                        )}
                      </div>
                    )
                  ) : null}

                  {activeTab ===
                  "tracks" ? (
                    <SplitTable
                      headers={[
                        "Track",
                        "Recorded",
                        "Wins",
                        "ITM",
                        "Avg Finish",
                      ]}
                      rows={profile.splits.tracks.map(
                        (
                          row,
                        ) => [
                          `${row.trackCode} · ${row.trackName}`,
                          row.recordedResults,
                          row.wins,
                          row.itmFinishes,
                          row.averageRecordedFinish ??
                            "—",
                        ],
                      )}
                    />
                  ) : null}

                  {activeTab ===
                  "grades" ? (
                    <SplitTable
                      headers={[
                        "Grade",
                        "Recorded",
                        "Wins",
                        "ITM",
                        "Avg Finish",
                      ]}
                      rows={profile.splits.grades.map(
                        (
                          row,
                        ) => [
                          row.grade ??
                            "—",
                          row.recordedResults,
                          row.wins,
                          row.itmFinishes,
                          row.averageRecordedFinish ??
                            "—",
                        ],
                      )}
                    />
                  ) : null}

                  {activeTab ===
                  "distances" ? (
                    <SplitTable
                      headers={[
                        "Distance",
                        "Recorded",
                        "Wins",
                        "ITM",
                        "Avg Finish",
                      ]}
                      rows={profile.splits.distances.map(
                        (
                          row,
                        ) => [
                          row.distanceYards
                            ? `${row.distanceYards} Yards`
                            : "—",
                          row.recordedResults,
                          row.wins,
                          row.itmFinishes,
                          row.averageRecordedFinish ??
                            "—",
                        ],
                      )}
                    />
                  ) : null}

                  {activeTab ===
                  "boxes" ? (
                    <SplitTable
                      headers={[
                        "Box",
                        "Recorded",
                        "Wins",
                        "ITM",
                        "Avg Finish",
                      ]}
                      rows={profile.splits.boxes.map(
                        (
                          row,
                        ) => [
                          row.boxNumber ??
                            "—",
                          row.recordedResults,
                          row.wins,
                          row.itmFinishes,
                          row.averageRecordedFinish ??
                            "—",
                        ],
                      )}
                    />
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