"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  createSupabaseBrowserClient,
} from "@/lib/supabase/browser";

type Props = {
  leagueId: string;
  season: number;
  viewerFantasyTeamId:
    | number
    | null;
};

type ScoringMode =
  | "record_only"
  | "standard"
  | "confidence";

type PeriodRow = {
  id: number;
  period_number: number;
  status: string;
  finalized_at:
    | string
    | null;
};

type RecapPeriod = {
  id: number;
  periodNumber: number;
  startsAt:
    | string
    | null;
  endsAt:
    | string
    | null;
  status: string;
  finalizedAt:
    | string
    | null;
};

type PeriodResult = {
  entryId: number;
  entryName: string;

  rank:
    | number
    | null;

  winner: boolean;

  requiredPicks: number;
  submittedPicks: number;
  missingPicks: number;

  wins: number;
  pushes: number;
  losses: number;
  ungraded: number;

  points:
    | number
    | string;
};

type SeasonStanding = {
  entryId: number;
  entryName: string;

  rank:
    | number
    | null;

  wins: number;
  pushes: number;
  losses: number;
  ungraded: number;

  points:
    | number
    | string;
};

type RecapAward = {
  awardType: string;
  awardKey: string;
  title: string;

  description:
    | string
    | null;

  entryName:
    | string
    | null;

  awardedAt:
    | string
    | null;

  metadata:
    | Record<
        string,
        unknown
      >
    | null;
};

type RecapPayload = {
  success?: boolean;

  leagueId?: string;
  season?: number;

  period:
    | RecapPeriod
    | null;

  periodResults:
    PeriodResult[];

  standings:
    SeasonStanding[];

  awards:
    RecapAward[];
};

type TrophyAward = {
  season: number;

  awardType: string;
  awardKey: string;
  title: string;

  description:
    | string
    | null;

  franchiseId:
    | string
    | null;

  franchiseName:
    | string
    | null;

  awardedAt:
    | string
    | null;

  metadata:
    | Record<
        string,
        unknown
      >
    | null;
};

type TrophyPayload = {
  success?: boolean;

  historyId?:
    | string
    | null;

  awards?: TrophyAward[];
};

function numberValue(
  value:
    | number
    | string
    | null
    | undefined
) {
  if (
    value === null ||
    value === undefined
  ) {
    return 0;
  }

  const parsed =
    Number(value);

  return Number.isFinite(
    parsed
  )
    ? parsed
    : 0;
}

function formatPoints(
  value:
    | number
    | string
) {
  const numeric =
    numberValue(
      value
    );

  return numeric
    .toFixed(2)
    .replace(
      /\.00$/,
      ""
    )
    .replace(
      /(\.\d)0$/,
      "$1"
    );
}

function recordText(
  wins: number,
  losses: number,
  pushes: number
) {
  return `${wins}-${losses}-${pushes}`;
}

function formatDate(
  value:
    | string
    | null
    | undefined
) {
  if (!value) {
    return "";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }

  return new Intl.DateTimeFormat(
    "en-US",
    {
      month:
        "short",
      day:
        "numeric",
      year:
        "numeric",
    }
  ).format(date);
}

function awardIcon(
  awardType: string
) {
  if (
    awardType ===
    "season_champion"
  ) {
    return "🏆";
  }

  if (
    awardType ===
    "period_winner"
  ) {
    return "🥇";
  }

  return "🏅";
}

function awardTypeLabel(
  awardType: string
) {
  if (
    awardType ===
    "season_champion"
  ) {
    return "SEASON CHAMPION";
  }

  if (
    awardType ===
    "period_winner"
  ) {
    return "PERIOD WINNER";
  }

  return awardType
    .replaceAll(
      "_",
      " "
    )
    .toUpperCase();
}

const CSS = `
  .g365-nhl-recap-page {
    width: 100%;
    min-width: 0;
    box-sizing: border-box;
  }

  .g365-nhl-recap-page * {
    box-sizing: border-box;
  }

  .g365-nhl-recap-results-head,
  .g365-nhl-recap-results-row {
    display: grid;
    grid-template-columns:
      52px
      minmax(180px, 1fr)
      100px
      90px
      82px
      82px;
    gap: 10px;
    align-items: center;
  }

  .g365-nhl-recap-standing-head,
  .g365-nhl-recap-standing-row {
    display: grid;
    grid-template-columns:
      52px
      minmax(180px, 1fr)
      110px
      90px;
    gap: 10px;
    align-items: center;
  }

  .g365-nhl-recap-awards-grid {
    display: grid;
    grid-template-columns:
      repeat(
        auto-fit,
        minmax(
          240px,
          1fr
        )
      );
    gap: 12px;
  }

  .g365-nhl-trophy-grid {
    display: grid;
    grid-template-columns:
      repeat(
        auto-fit,
        minmax(
          280px,
          1fr
        )
      );
    gap: 12px;
  }

  @media (max-width: 800px) {
    .g365-nhl-recap-scroll {
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
    }

    .g365-nhl-recap-results-head,
    .g365-nhl-recap-results-row {
      min-width: 690px;
    }

    .g365-nhl-recap-standing-head,
    .g365-nhl-recap-standing-row {
      min-width: 520px;
    }
  }

  @media (max-width: 760px) {
    .g365-nhl-recap-page {
      padding:
        14px 12px 30px !important;
      gap:
        14px !important;
    }

    .g365-nhl-recap-hero {
      padding:
        16px !important;
    }

    .g365-nhl-recap-page h1 {
      font-size:
        clamp(
          27px,
          8vw,
          35px
        ) !important;
    }

    .g365-nhl-recap-awards-grid,
    .g365-nhl-trophy-grid {
      grid-template-columns:
        1fr;
    }
  }

  @media (max-width: 430px) {
    .g365-nhl-recap-page {
      padding:
        12px 10px 26px !important;
    }
  }
`;

export default function NhlPickemRecap({
  leagueId,
  season,
  viewerFantasyTeamId,
}: Props) {
  const supabase =
    useMemo(
      () =>
        createSupabaseBrowserClient(),
      []
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    message,
    setMessage,
  ] =
    useState("");

  const [
    scoringMode,
    setScoringMode,
  ] =
    useState<ScoringMode>(
      "record_only"
    );

  const [
    periods,
    setPeriods,
  ] =
    useState<
      PeriodRow[]
    >([]);

  const [
    selectedPeriodNumber,
    setSelectedPeriodNumber,
  ] =
    useState<
      number
      | null
    >(
      null
    );

  const [
    recap,
    setRecap,
  ] =
    useState<RecapPayload>({
      period:
        null,
      periodResults:
        [],
      standings:
        [],
      awards:
        [],
    });

  const [
    trophyAwards,
    setTrophyAwards,
  ] =
    useState<
      TrophyAward[]
    >([]);

  const finalPeriods =
    useMemo(
      () =>
        periods.filter(
          (period) =>
            period.status ===
            "final"
        ),
      [
        periods,
      ]
    );

  const viewerEntryId =
    useMemo(
      () => {
        if (
          viewerFantasyTeamId ===
          null
        ) {
          return null;
        }

        /*
         * The recap RPC returns
         * entry IDs rather than
         * fantasy-team IDs.
         *
         * Viewer highlighting is
         * optional here; the
         * permanent trophy and
         * recap data remain fully
         * available even when no
         * direct ID relationship is
         * present in the payload.
         */
        return null;
      },
      [
        viewerFantasyTeamId,
      ]
    );

  const loadBase =
    useCallback(
      async () => {
        const [
          settingsResult,
          periodsResult,
          trophyResult,
        ] =
          await Promise.all([
            supabase
              .from(
                "nhl_pickem_settings"
              )
              .select(
                "scoring_mode"
              )
              .eq(
                "league_id",
                leagueId
              )
              .maybeSingle(),

            supabase
              .from(
                "nhl_pickem_periods"
              )
              .select(
                "id,period_number,status,finalized_at"
              )
              .eq(
                "league_id",
                leagueId
              )
              .eq(
                "season",
                season
              )
              .order(
                "period_number",
                {
                  ascending:
                    true,
                }
              ),

            supabase.rpc(
              "get_nhl_pickem_trophy_case",
              {
                p_league_id:
                  leagueId,
              }
            ),
          ]);

        if (
          settingsResult.error
        ) {
          throw new Error(
            settingsResult
              .error.message
          );
        }

        if (
          periodsResult.error
        ) {
          throw new Error(
            periodsResult
              .error.message
          );
        }

        if (
          trophyResult.error
        ) {
          throw new Error(
            trophyResult
              .error.message
          );
        }

        setScoringMode(
          (
            settingsResult
              .data
              ?.scoring_mode ??
            "record_only"
          ) as ScoringMode
        );

        const nextPeriods =
          (
            periodsResult.data ??
            []
          ) as PeriodRow[];

        setPeriods(
          nextPeriods
        );

        setSelectedPeriodNumber(
          (
            current
          ) => {
            const finals =
              nextPeriods.filter(
                (period) =>
                  period.status ===
                  "final"
              );

            if (
              current !==
                null &&
              finals.some(
                (period) =>
                  period.period_number ===
                  current
              )
            ) {
              return current;
            }

            return (
              finals.at(-1)
                ?.period_number ??
              null
            );
          }
        );

        const trophyData =
          (
            trophyResult.data ??
            {}
          ) as TrophyPayload;

        setTrophyAwards(
          trophyData.awards ??
            []
        );
      },
      [
        leagueId,
        season,
        supabase,
      ]
    );

  const loadRecap =
    useCallback(
      async (
        periodNumber:
          | number
          | null
      ) => {
        const {
          data,
          error,
        } =
          await supabase.rpc(
            "get_nhl_pickem_recap",
            {
              p_league_id:
                leagueId,

              p_season:
                season,

              p_period_number:
                periodNumber,
            }
          );

        if (error) {
          throw new Error(
            error.message
          );
        }

        const payload =
          (
            data ??
            {}
          ) as RecapPayload;

        setRecap({
          success:
            payload.success,

          leagueId:
            payload.leagueId,

          season:
            payload.season,

          period:
            payload.period ??
            null,

          periodResults:
            payload.periodResults ??
            [],

          standings:
            payload.standings ??
            [],

          awards:
            payload.awards ??
            [],
        });
      },
      [
        leagueId,
        season,
        supabase,
      ]
    );

  useEffect(() => {
    let active =
      true;

    async function run() {
      setLoading(
        true
      );

      setMessage(
        ""
      );

      try {
        await loadBase();
      } catch (error) {
        if (
          !active
        ) {
          return;
        }

        setMessage(
          error instanceof Error
            ? error.message
            : "NHL Pick'em recap could not be loaded."
        );
      } finally {
        if (
          active
        ) {
          setLoading(
            false
          );
        }
      }
    }

    void run();

    return () => {
      active =
        false;
    };
  }, [
    loadBase,
  ]);

  useEffect(() => {
    if (
      selectedPeriodNumber ===
      null
    ) {
      setRecap({
        period:
          null,
        periodResults:
          [],
        standings:
          [],
        awards:
          [],
      });

      return;
    }

    let active =
      true;

    async function run() {
      setMessage(
        ""
      );

      try {
        await loadRecap(
          selectedPeriodNumber
        );
      } catch (error) {
        if (
          !active
        ) {
          return;
        }

        setMessage(
          error instanceof Error
            ? error.message
            : "The selected NHL Pick'em recap could not be loaded."
        );
      }
    }

    void run();

    return () => {
      active =
        false;
    };
  }, [
    loadRecap,
    selectedPeriodNumber,
  ]);

  useEffect(() => {
    if (
      loading
    ) {
      return;
    }

    const timer =
      window.setInterval(
        () => {
          void loadBase();

          if (
            selectedPeriodNumber !==
            null
          ) {
            void loadRecap(
              selectedPeriodNumber
            );
          }
        },
        30_000
      );

    return () => {
      window.clearInterval(
        timer
      );
    };
  }, [
    loadBase,
    loadRecap,
    loading,
    selectedPeriodNumber,
  ]);

  if (
    loading
  ) {
    return (
      <main
        style={{
          padding:
            "22px 18px",
          color:
            "#aaaab2",
        }}
      >
        Loading NHL Pick&apos;em
        recap…
      </main>
    );
  }

  return (
    <main
      className="g365-nhl-recap-page"
      style={{
        display:
          "grid",
        gap: 18,
        maxWidth:
          1180,
        padding:
          "22px 18px 40px",
      }}
    >
      <style>
        {CSS}
      </style>

      <section
        className="g365-nhl-recap-hero"
        style={{
          padding: 20,
          borderRadius:
            18,
          border:
            "1px solid rgba(255,108,33,0.25)",
          background:
            "linear-gradient(135deg,rgba(100,7,13,0.42),rgba(17,17,21,0.98) 58%)",
        }}
      >
        <div
          style={{
            color:
              "#ff7627",
            fontSize: 12,
            fontWeight:
              1000,
            letterSpacing:
              "0.12em",
            textTransform:
              "uppercase",
          }}
        >
          G365 NHL Pick&apos;em
        </div>

        <h1
          style={{
            margin:
              "7px 0 6px",
            color:
              "#fff",
            fontSize:
              "clamp(30px,5vw,44px)",
          }}
        >
          Recap & Trophy Room
        </h1>

        <p
          style={{
            margin: 0,
            color:
              "#a6a6ae",
            lineHeight:
              1.6,
            maxWidth:
              880,
          }}
        >
          Official period winners,
          NHL Pick&apos;em records,
          season standings and a
          continuous Trophy Room
          that preserves awards
          across renewed seasons.
        </p>
      </section>

      {message ? (
        <div
          style={{
            padding:
              "12px 14px",
            borderRadius:
              12,
            border:
              "1px solid rgba(255,80,80,0.40)",
            background:
              "rgba(120,0,0,0.20)",
            color:
              "#ff999c",
          }}
        >
          {message}
        </div>
      ) : null}

      {finalPeriods.length ===
      0 ? (
        <EmptyState
          text="Recaps unlock after the first NHL Pick'em period is officially finalized."
        />
      ) : (
        <>
          <section
            style={cardStyle}
          >
            <div
              style={
                sectionHeaderStyle
              }
            >
              <div>
                <div
                  style={
                    eyebrowStyle
                  }
                >
                  PERIOD RECAP
                </div>

                <h2
                  style={
                    titleStyle
                  }
                >
                  Official Results
                </h2>
              </div>

              <select
                value={
                  selectedPeriodNumber ??
                  ""
                }
                onChange={(
                  event
                ) =>
                  setSelectedPeriodNumber(
                    Number(
                      event.target
                        .value
                    )
                  )
                }
                style={{
                  minHeight:
                    42,
                  padding:
                    "8px 11px",
                  borderRadius:
                    9,
                  border:
                    "1px solid rgba(255,118,39,0.35)",
                  background:
                    "#09090c",
                  color:
                    "#fff",
                  fontWeight:
                    900,
                }}
              >
                {finalPeriods.map(
                  (
                    period
                  ) => (
                    <option
                      key={
                        period.id
                      }
                      value={
                        period.period_number
                      }
                    >
                      Period{" "}
                      {
                        period.period_number
                      }
                    </option>
                  )
                )}
              </select>
            </div>

            {recap.period ? (
              <div
                style={{
                  marginBottom:
                    14,
                  padding:
                    "10px 12px",
                  borderRadius:
                    10,
                  background:
                    "rgba(255,255,255,0.035)",
                  color:
                    "#9999a2",
                  fontSize:
                    11,
                }}
              >
                Period{" "}
                {
                  recap.period
                    .periodNumber
                }

                {recap.period
                  .finalizedAt
                  ? ` finalized ${formatDate(
                      recap.period
                        .finalizedAt
                    )}`
                  : ""}
              </div>
            ) : null}

            {recap.periodResults
              .length ===
            0 ? (
              <EmptyState
                text="No finalized results are available for this period."
              />
            ) : (
              <div className="g365-nhl-recap-scroll">
                <div
                  className="g365-nhl-recap-results-head"
                  style={
                    tableHeaderStyle
                  }
                >
                  <div>
                    RANK
                  </div>

                  <div>
                    ENTRY
                  </div>

                  <Right>
                    RECORD
                  </Right>

                  <Right>
                    POINTS
                  </Right>

                  <Right>
                    PICKS
                  </Right>

                  <Right>
                    MISSING
                  </Right>
                </div>

                {recap.periodResults.map(
                  (
                    row,
                    index
                  ) => (
                    <div
                      key={
                        row.entryId
                      }
                      className="g365-nhl-recap-results-row"
                      style={{
                        padding:
                          "13px 14px",
                        borderBottom:
                          index ===
                          recap
                            .periodResults
                            .length -
                            1
                            ? "none"
                            : "1px solid rgba(255,255,255,0.045)",
                        background:
                          row.winner
                            ? "linear-gradient(90deg,rgba(139,15,19,0.20),rgba(255,118,39,0.045))"
                            : "transparent",
                      }}
                    >
                      <RankBadge
                        rank={
                          row.rank ??
                          index +
                            1
                        }
                        winner={
                          row.winner
                        }
                      />

                      <div
                        style={{
                          minWidth:
                            0,
                        }}
                      >
                        <div
                          style={{
                            color:
                              "#fff",
                            fontWeight:
                              1000,
                            fontSize:
                              13,
                            overflow:
                              "hidden",
                            whiteSpace:
                              "nowrap",
                            textOverflow:
                              "ellipsis",
                          }}
                        >
                          {
                            row.entryName
                          }
                        </div>

                        {row.winner ? (
                          <div
                            style={{
                              marginTop:
                                3,
                              color:
                                "#ff9b59",
                              fontSize:
                                9,
                              fontWeight:
                                1000,
                            }}
                          >
                            PERIOD WINNER
                          </div>
                        ) : null}

                        {viewerEntryId ===
                        row.entryId ? (
                          <div
                            style={{
                              marginTop:
                                3,
                              color:
                                "#ff9b59",
                              fontSize:
                                9,
                              fontWeight:
                                1000,
                            }}
                          >
                            YOUR ENTRY
                          </div>
                        ) : null}
                      </div>

                      <StatValue>
                        {recordText(
                          row.wins,
                          row.losses,
                          row.pushes
                        )}
                      </StatValue>

                      <StatValue>
                        {scoringMode ===
                        "record_only"
                          ? "—"
                          : formatPoints(
                              row.points
                            )}
                      </StatValue>

                      <StatValue>
                        {
                          row.submittedPicks
                        }
                        /
                        {
                          row.requiredPicks
                        }
                      </StatValue>

                      <StatValue>
                        {
                          row.missingPicks
                        }
                      </StatValue>
                    </div>
                  )
                )}
              </div>
            )}
          </section>

          <section
            style={cardStyle}
          >
            <div
              style={
                sectionHeaderStyle
              }
            >
              <div>
                <div
                  style={
                    eyebrowStyle
                  }
                >
                  SEASON PICTURE
                </div>

                <h2
                  style={
                    titleStyle
                  }
                >
                  Season Standings
                </h2>
              </div>

              <span
                style={
                  countBadgeStyle
                }
              >
                {season}
              </span>
            </div>

            {recap.standings
              .length ===
            0 ? (
              <EmptyState
                text="Season standings will appear after finalized NHL Pick'em results are available."
              />
            ) : (
              <div className="g365-nhl-recap-scroll">
                <div
                  className="g365-nhl-recap-standing-head"
                  style={
                    tableHeaderStyle
                  }
                >
                  <div>
                    RANK
                  </div>

                  <div>
                    ENTRY
                  </div>

                  <Right>
                    RECORD
                  </Right>

                  <Right>
                    POINTS
                  </Right>
                </div>

                {recap.standings.map(
                  (
                    row,
                    index
                  ) => (
                    <div
                      key={
                        row.entryId
                      }
                      className="g365-nhl-recap-standing-row"
                      style={{
                        padding:
                          "12px 14px",
                        borderBottom:
                          index ===
                          recap
                            .standings
                            .length -
                            1
                            ? "none"
                            : "1px solid rgba(255,255,255,0.045)",
                      }}
                    >
                      <RankBadge
                        rank={
                          row.rank ??
                          index +
                            1
                        }
                      />

                      <div
                        style={{
                          minWidth:
                            0,
                          color:
                            "#fff",
                          fontWeight:
                            900,
                          fontSize:
                            12,
                          overflow:
                            "hidden",
                          whiteSpace:
                            "nowrap",
                          textOverflow:
                            "ellipsis",
                        }}
                      >
                        {
                          row.entryName
                        }
                      </div>

                      <StatValue>
                        {recordText(
                          row.wins,
                          row.losses,
                          row.pushes
                        )}
                      </StatValue>

                      <StatValue>
                        {scoringMode ===
                        "record_only"
                          ? "—"
                          : formatPoints(
                              row.points
                            )}
                      </StatValue>
                    </div>
                  )
                )}
              </div>
            )}
          </section>

          <section
            style={cardStyle}
          >
            <div
              style={
                sectionHeaderStyle
              }
            >
              <div>
                <div
                  style={
                    eyebrowStyle
                  }
                >
                  PERIOD{" "}
                  {selectedPeriodNumber ??
                    "—"}
                </div>

                <h2
                  style={
                    titleStyle
                  }
                >
                  Awards Earned
                </h2>
              </div>

              <span
                style={
                  countBadgeStyle
                }
              >
                {
                  recap.awards
                    .length
                }{" "}
                AWARDS
              </span>
            </div>

            {recap.awards
              .length >
            0 ? (
              <div className="g365-nhl-recap-awards-grid">
                {recap.awards.map(
                  (
                    award,
                    index
                  ) => (
                    <AwardCard
                      key={`${award.awardKey}-${index}`}
                      icon={awardIcon(
                        award.awardType
                      )}
                      category={awardTypeLabel(
                        award.awardType
                      )}
                      title={
                        award.title
                      }
                      name={
                        award.entryName
                      }
                      description={
                        award.description
                      }
                      date={
                        award.awardedAt
                      }
                    />
                  )
                )}
              </div>
            ) : (
              <EmptyState
                text="No NHL Pick'em awards were earned for this finalized period."
              />
            )}
          </section>
        </>
      )}

      <section
        style={cardStyle}
      >
        <div
          style={
            sectionHeaderStyle
          }
        >
          <div>
            <div
              style={
                eyebrowStyle
              }
            >
              CONTINUOUS HISTORY
            </div>

            <h2
              style={
                titleStyle
              }
            >
              NHL Trophy Room
            </h2>

            <div
              style={{
                marginTop:
                  5,
                color:
                  "#878790",
                fontSize:
                  11,
                lineHeight:
                  1.45,
              }}
            >
              Permanent NHL
              Pick&apos;em awards
              remain here across
              renewed seasons.
            </div>
          </div>

          <span
            style={
              countBadgeStyle
            }
          >
            {
              trophyAwards.length
            }{" "}
            TOTAL
          </span>
        </div>

        {trophyAwards.length ===
        0 ? (
          <EmptyState
            text="The NHL Trophy Room will populate when the first permanent award is earned."
          />
        ) : (
          <TrophyRoom
            awards={
              trophyAwards
            }
          />
        )}
      </section>
    </main>
  );
}

function TrophyRoom({
  awards,
}: {
  awards: TrophyAward[];
}) {
  const grouped =
    useMemo(
      () => {
        const map =
          new Map<
            string,
            TrophyAward[]
          >();

        for (
          const award of
          awards
        ) {
          const name =
            award.franchiseName ??
            "NHL Pick'em Entry";

          const current =
            map.get(
              name
            ) ??
            [];

          current.push(
            award
          );

          map.set(
            name,
            current
          );
        }

        return Array.from(
          map.entries()
        ).sort(
          (
            a,
            b
          ) =>
            b[1].length -
              a[1].length ||
            a[0].localeCompare(
              b[0]
            )
        );
      },
      [
        awards,
      ]
    );

  return (
    <div className="g365-nhl-trophy-grid">
      {grouped.map(
        ([
          franchiseName,
          franchiseAwards,
        ]) => (
          <article
            key={
              franchiseName
            }
            style={{
              padding:
                15,
              borderRadius:
                14,
              border:
                "1px solid rgba(255,255,255,0.07)",
              background:
                "linear-gradient(180deg,rgba(255,255,255,0.035),rgba(0,0,0,0.12))",
            }}
          >
            <div
              style={{
                display:
                  "flex",
                alignItems:
                  "center",
                justifyContent:
                  "space-between",
                gap: 10,
                marginBottom:
                  12,
              }}
            >
              <strong
                style={{
                  color:
                    "#fff",
                  fontSize:
                    15,
                }}
              >
                {
                  franchiseName
                }
              </strong>

              <span
                style={
                  countBadgeStyle
                }
              >
                {
                  franchiseAwards.length
                }{" "}
                TROPHIES
              </span>
            </div>

            <div
              style={{
                display:
                  "grid",
                gap: 8,
              }}
            >
              {franchiseAwards.map(
                (
                  award,
                  index
                ) => (
                  <div
                    key={`${award.season}-${award.awardKey}-${index}`}
                    style={{
                      display:
                        "grid",
                      gridTemplateColumns:
                        "38px minmax(0,1fr)",
                      gap: 10,
                      padding:
                        "10px 0",
                      borderTop:
                        index ===
                        0
                          ? "none"
                          : "1px solid rgba(255,255,255,0.05)",
                    }}
                  >
                    <div
                      style={{
                        width:
                          36,
                        height:
                          36,
                        borderRadius:
                          10,
                        display:
                          "grid",
                        placeItems:
                          "center",
                        background:
                          "rgba(255,118,39,0.10)",
                        fontSize:
                          18,
                      }}
                    >
                      {awardIcon(
                        award.awardType
                      )}
                    </div>

                    <div
                      style={{
                        minWidth:
                          0,
                      }}
                    >
                      <div
                        style={{
                          color:
                            "#ff8d43",
                          fontSize:
                            9,
                          fontWeight:
                            1000,
                        }}
                      >
                        {
                          award.season
                        }{" "}
                        ·{" "}
                        {awardTypeLabel(
                          award.awardType
                        )}
                      </div>

                      <div
                        style={{
                          marginTop:
                            3,
                          color:
                            "#fff",
                          fontSize:
                            12,
                          fontWeight:
                            900,
                        }}
                      >
                        {
                          award.title
                        }
                      </div>

                      {award.description ? (
                        <div
                          style={{
                            marginTop:
                              4,
                            color:
                              "#8e8e97",
                            fontSize:
                              10,
                            lineHeight:
                              1.4,
                          }}
                        >
                          {
                            award.description
                          }
                        </div>
                      ) : null}
                    </div>
                  </div>
                )
              )}
            </div>
          </article>
        )
      )}
    </div>
  );
}

function AwardCard({
  icon,
  category,
  title,
  name,
  description,
  date,
}: {
  icon: string;
  category: string;
  title: string;

  name:
    | string
    | null;

  description:
    | string
    | null;

  date:
    | string
    | null;
}) {
  return (
    <article
      style={{
        display:
          "grid",
        gridTemplateColumns:
          "46px minmax(0,1fr)",
        gap: 12,
        padding: 14,
        borderRadius:
          13,
        border:
          "1px solid rgba(255,255,255,0.07)",
        background:
          "rgba(255,255,255,0.025)",
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          display:
            "grid",
          placeItems:
            "center",
          borderRadius:
            12,
          background:
            "rgba(255,118,39,0.10)",
          fontSize:
            22,
        }}
      >
        {icon}
      </div>

      <div>
        <div
          style={{
            color:
              "#ff8d43",
            fontSize:
              9,
            fontWeight:
              1000,
            letterSpacing:
              "0.07em",
          }}
        >
          {category}
        </div>

        <h3
          style={{
            margin:
              "4px 0 0",
            color:
              "#fff",
            fontSize:
              15,
          }}
        >
          {title}
        </h3>

        {name ? (
          <strong
            style={{
              display:
                "block",
              marginTop:
                4,
              color:
                "#d3d3d8",
              fontSize:
                11,
            }}
          >
            {name}
          </strong>
        ) : null}

        {description ? (
          <p
            style={{
              margin:
                "6px 0 0",
              color:
                "#909099",
              fontSize:
                11,
              lineHeight:
                1.45,
            }}
          >
            {description}
          </p>
        ) : null}

        {date ? (
          <div
            style={{
              marginTop:
                7,
              color:
                "#676770",
              fontSize:
                9,
            }}
          >
            {formatDate(
              date
            )}
          </div>
        ) : null}
      </div>
    </article>
  );
}

function RankBadge({
  rank,
  winner = false,
}: {
  rank: number;
  winner?: boolean;
}) {
  return (
    <div
      style={{
        width: 32,
        height: 32,
        display:
          "grid",
        placeItems:
          "center",
        borderRadius:
          10,
        background:
          winner ||
          rank === 1
            ? "linear-gradient(135deg,#9b1517,#ff7627)"
            : "rgba(255,255,255,0.055)",
        color:
          "#fff",
        fontWeight:
          1000,
        fontSize:
          12,
        fontVariantNumeric:
          "tabular-nums",
      }}
    >
      {rank}
    </div>
  );
}

function StatValue({
  children,
}: {
  children:
    React.ReactNode;
}) {
  return (
    <div
      style={{
        textAlign:
          "right",
        color:
          "#e4e4e7",
        fontSize:
          12,
        fontWeight:
          900,
        whiteSpace:
          "nowrap",
        fontVariantNumeric:
          "tabular-nums",
      }}
    >
      {children}
    </div>
  );
}

function Right({
  children,
}: {
  children:
    React.ReactNode;
}) {
  return (
    <div
      style={{
        textAlign:
          "right",
      }}
    >
      {children}
    </div>
  );
}

function EmptyState({
  text,
}: {
  text: string;
}) {
  return (
    <div
      style={{
        padding:
          "22px 16px",
        borderRadius:
          13,
        border:
          "1px dashed rgba(255,255,255,0.10)",
        background:
          "rgba(255,255,255,0.018)",
        color:
          "#8f8f98",
        fontSize:
          12,
        lineHeight:
          1.5,
      }}
    >
      {text}
    </div>
  );
}

const cardStyle:
  React.CSSProperties = {
    overflow:
      "hidden",
    padding: 16,
    borderRadius:
      16,
    border:
      "1px solid rgba(255,255,255,0.08)",
    background:
      "#101014",
  };

const sectionHeaderStyle:
  React.CSSProperties = {
    display:
      "flex",
    justifyContent:
      "space-between",
    alignItems:
      "center",
    gap: 12,
    flexWrap:
      "wrap",
    marginBottom:
      14,
  };

const eyebrowStyle:
  React.CSSProperties = {
    color:
      "#ff7627",
    fontSize: 9,
    fontWeight:
      1000,
    letterSpacing:
      "0.10em",
  };

const titleStyle:
  React.CSSProperties = {
    margin:
      "3px 0 0",
    color:
      "#fff",
    fontSize:
      20,
  };

const countBadgeStyle:
  React.CSSProperties = {
    padding:
      "6px 9px",
    borderRadius:
      999,
    background:
      "rgba(255,118,39,0.10)",
    color:
      "#ff9b59",
    fontSize:
      9,
    fontWeight:
      1000,
  };

const tableHeaderStyle:
  React.CSSProperties = {
    padding:
      "9px 14px",
    borderBottom:
      "1px solid rgba(255,255,255,0.06)",
    color:
      "#74747d",
    fontSize:
      9,
    fontWeight:
      1000,
    letterSpacing:
      "0.07em",
  };