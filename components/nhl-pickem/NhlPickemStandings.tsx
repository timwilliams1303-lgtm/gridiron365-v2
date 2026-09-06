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

type SettingsRow = {
  scoring_mode: ScoringMode;
};

type EntryRow = {
  id: number;
  fantasy_team_id: number;
  entry_name: string;
  active: boolean;
};

type StandingRow = {
  league_id: string;
  season: number;

  entry_id: number;
  fantasy_team_id: number;

  wins: number;
  pushes: number;
  losses: number;

  missing_picks: number;

  points:
    | number
    | string;

  periods_won: number;
  periods_played: number;

  updated_at: string;
};

type PeriodRow = {
  id: number;
  period_number: number;
  status: string;
};

type PeriodResultRow = {
  nhl_pickem_period_id: number;
  entry_id: number;
  fantasy_team_id: number;

  required_picks: number;
  submitted_picks: number;
  missing_picks: number;

  wins: number;
  pushes: number;
  losses: number;
  ungraded: number;

  points:
    | number
    | string;

  rank:
    | number
    | null;

  is_period_winner: boolean;

  finalized_at:
    | string
    | null;
};

type DisplayStanding = {
  entryId: number;
  fantasyTeamId: number;
  entryName: string;

  wins: number;
  pushes: number;
  losses: number;

  missingPicks: number;

  points: number;

  periodsWon: number;
  periodsPlayed: number;
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
  value: number
) {
  return value
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

function statusLabel(
  value: string
) {
  return value
    .replaceAll(
      "_",
      " "
    )
    .toUpperCase();
}

function scoringLabel(
  mode: ScoringMode
) {
  if (
    mode ===
    "confidence"
  ) {
    return "Confidence Points";
  }

  if (
    mode ===
    "standard"
  ) {
    return "Points";
  }

  return "Record";
}

const CSS = `
  .g365-nhl-standings-page {
    width: 100%;
    min-width: 0;
    box-sizing: border-box;
  }

  .g365-nhl-standings-page * {
    box-sizing: border-box;
  }

  .g365-nhl-standings-header,
  .g365-nhl-standing-row {
    display: grid;
    grid-template-columns:
      54px
      minmax(180px, 1fr)
      100px
      90px
      90px
      90px;
    gap: 10px;
    align-items: center;
  }

  .g365-nhl-live-header,
  .g365-nhl-live-row {
    display: grid;
    grid-template-columns:
      54px
      minmax(180px, 1fr)
      100px
      90px
      90px;
    gap: 10px;
    align-items: center;
  }

  @media (max-width: 820px) {
    .g365-nhl-standings-scroll {
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
    }

    .g365-nhl-standings-header,
    .g365-nhl-standing-row {
      min-width: 700px;
    }

    .g365-nhl-live-header,
    .g365-nhl-live-row {
      min-width: 610px;
    }
  }

  @media (max-width: 760px) {
    .g365-nhl-standings-page {
      padding:
        14px 12px 30px !important;
      gap:
        14px !important;
    }

    .g365-nhl-standings-page h1 {
      font-size:
        clamp(
          26px,
          8vw,
          34px
        ) !important;
    }
  }

  @media (max-width: 430px) {
    .g365-nhl-standings-page {
      padding:
        12px 10px 26px !important;
    }
  }
`;

export default function NhlPickemStandings({
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
    entries,
    setEntries,
  ] =
    useState<
      EntryRow[]
    >([]);

  const [
    standings,
    setStandings,
  ] =
    useState<
      StandingRow[]
    >([]);

  const [
    periods,
    setPeriods,
  ] =
    useState<
      PeriodRow[]
    >([]);

  const [
    periodResults,
    setPeriodResults,
  ] =
    useState<
      PeriodResultRow[]
    >([]);

  const entryById =
    useMemo(
      () =>
        new Map<
          number,
          EntryRow
        >(
          entries.map(
            (entry) => [
              entry.id,
              entry,
            ]
          )
        ),
      [
        entries,
      ]
    );

  const officialStandings =
    useMemo<
      DisplayStanding[]
    >(
      () => {
        const rows =
          standings.map(
            (row) => {
              const entry =
                entryById.get(
                  row.entry_id
                );

              return {
                entryId:
                  row.entry_id,

                fantasyTeamId:
                  row.fantasy_team_id,

                entryName:
                  entry?.entry_name ??
                  `Entry ${row.entry_id}`,

                wins:
                  row.wins,

                pushes:
                  row.pushes,

                losses:
                  row.losses,

                missingPicks:
                  row.missing_picks,

                points:
                  numberValue(
                    row.points
                  ),

                periodsWon:
                  row.periods_won,

                periodsPlayed:
                  row.periods_played,
              };
            }
          );

        rows.sort(
          (a, b) => {
            if (
              scoringMode !==
                "record_only" &&
              b.points !==
                a.points
            ) {
              return (
                b.points -
                a.points
              );
            }

            if (
              b.wins !==
              a.wins
            ) {
              return (
                b.wins -
                a.wins
              );
            }

            if (
              a.losses !==
              b.losses
            ) {
              return (
                a.losses -
                b.losses
              );
            }

            if (
              b.pushes !==
              a.pushes
            ) {
              return (
                b.pushes -
                a.pushes
              );
            }

            if (
              b.periodsWon !==
              a.periodsWon
            ) {
              return (
                b.periodsWon -
                a.periodsWon
              );
            }

            return a.entryName.localeCompare(
              b.entryName
            );
          }
        );

        return rows;
      },
      [
        entryById,
        scoringMode,
        standings,
      ]
    );

  const activePeriod =
    useMemo(
      () =>
        periods.find(
          (period) =>
            period.status !==
            "final"
        ) ??
        null,
      [
        periods,
      ]
    );

  const activePeriodResults =
    useMemo(
      () => {
        if (
          !activePeriod
        ) {
          return [];
        }

        const rows =
          periodResults
            .filter(
              (row) =>
                row.nhl_pickem_period_id ===
                activePeriod.id
            )
            .map(
              (row) => {
                const entry =
                  entryById.get(
                    row.entry_id
                  );

                return {
                  ...row,
                  entryName:
                    entry?.entry_name ??
                    `Entry ${row.entry_id}`,
                  numericPoints:
                    numberValue(
                      row.points
                    ),
                };
              }
            );

        rows.sort(
          (a, b) => {
            if (
              scoringMode !==
                "record_only" &&
              b.numericPoints !==
                a.numericPoints
            ) {
              return (
                b.numericPoints -
                a.numericPoints
              );
            }

            if (
              b.wins !==
              a.wins
            ) {
              return (
                b.wins -
                a.wins
              );
            }

            if (
              a.losses !==
              b.losses
            ) {
              return (
                a.losses -
                b.losses
              );
            }

            if (
              b.pushes !==
              a.pushes
            ) {
              return (
                b.pushes -
                a.pushes
              );
            }

            return a.entryName.localeCompare(
              b.entryName
            );
          }
        );

        return rows;
      },
      [
        activePeriod,
        entryById,
        periodResults,
        scoringMode,
      ]
    );

  const finalizedPeriodCount =
    useMemo(
      () =>
        periods.filter(
          (period) =>
            period.status ===
            "final"
        ).length,
      [
        periods,
      ]
    );

  const load =
    useCallback(
      async () => {
        const [
          settingsResult,
          entriesResult,
          standingsResult,
          periodsResult,
          periodResultsResult,
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
                "nhl_pickem_entries"
              )
              .select(
                "id,fantasy_team_id,entry_name,active"
              )
              .eq(
                "league_id",
                leagueId
              )
              .eq(
                "season",
                season
              ),

            supabase
              .from(
                "nhl_pickem_standings"
              )
              .select(
                "league_id,season,entry_id,fantasy_team_id,wins,pushes,losses,missing_picks,points,periods_won,periods_played,updated_at"
              )
              .eq(
                "league_id",
                leagueId
              )
              .eq(
                "season",
                season
              ),

            supabase
              .from(
                "nhl_pickem_periods"
              )
              .select(
                "id,period_number,status"
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

            supabase
              .from(
                "nhl_pickem_period_results"
              )
              .select(
                "nhl_pickem_period_id,entry_id,fantasy_team_id,required_picks,submitted_picks,missing_picks,wins,pushes,losses,ungraded,points,rank,is_period_winner,finalized_at"
              )
              .eq(
                "league_id",
                leagueId
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
          entriesResult.error
        ) {
          throw new Error(
            entriesResult
              .error.message
          );
        }

        if (
          standingsResult.error
        ) {
          throw new Error(
            standingsResult
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
          periodResultsResult.error
        ) {
          throw new Error(
            periodResultsResult
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

        setEntries(
          (
            entriesResult.data ??
            []
          ) as EntryRow[]
        );

        setStandings(
          (
            standingsResult.data ??
            []
          ) as StandingRow[]
        );

        setPeriods(
          (
            periodsResult.data ??
            []
          ) as PeriodRow[]
        );

        setPeriodResults(
          (
            periodResultsResult.data ??
            []
          ) as PeriodResultRow[]
        );
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
        await load();
      } catch (error) {
        if (
          !active
        ) {
          return;
        }

        setMessage(
          error instanceof Error
            ? error.message
            : "NHL Pick'em standings could not be loaded."
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
    load,
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
          void load();
        },
        15_000
      );

    return () => {
      window.clearInterval(
        timer
      );
    };
  }, [
    load,
    loading,
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
        standings…
      </main>
    );
  }

  return (
    <main
      className="g365-nhl-standings-page"
      style={{
        display:
          "grid",
        gap: 18,
        maxWidth:
          1180,
        padding:
          "22px 18px 36px",
      }}
    >
      <style>
        {CSS}
      </style>

      <section
        style={{
          padding: 20,
          borderRadius:
            18,
          border:
            "1px solid rgba(255,108,33,0.25)",
          background:
            "linear-gradient(135deg,rgba(100,7,13,0.40),rgba(17,17,21,0.98) 58%)",
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
              "clamp(28px,5vw,42px)",
          }}
        >
          Standings
        </h1>

        <p
          style={{
            margin: 0,
            maxWidth:
              850,
            color:
              "#a5a5ad",
            lineHeight:
              1.6,
          }}
        >
          Official season standings
          include finalized NHL
          Pick&apos;em periods. The
          active period is shown
          separately until it is
          finalized.
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

      <section
        style={{
          overflow:
            "hidden",
          borderRadius:
            16,
          border:
            "1px solid rgba(255,255,255,0.08)",
          background:
            "#101014",
        }}
      >
        <div
          style={{
            display:
              "flex",
            justifyContent:
              "space-between",
            alignItems:
              "center",
            gap: 12,
            flexWrap:
              "wrap",
            padding:
              "15px 16px",
            borderBottom:
              "1px solid rgba(255,255,255,0.07)",
            background:
              "rgba(0,0,0,0.22)",
          }}
        >
          <div>
            <h2
              style={{
                margin: 0,
                color:
                  "#fff",
                fontSize:
                  20,
              }}
            >
              Official Season Standings
            </h2>

            <div
              style={{
                marginTop:
                  4,
                color:
                  "#85858e",
                fontSize:
                  12,
              }}
            >
              {
                finalizedPeriodCount
              }{" "}
              finalized period
              {finalizedPeriodCount ===
              1
                ? ""
                : "s"}
            </div>
          </div>

          <div
            style={{
              padding:
                "6px 9px",
              borderRadius:
                999,
              background:
                "rgba(255,118,39,0.10)",
              color:
                "#ff9b59",
              fontSize:
                10,
              fontWeight:
                1000,
            }}
          >
            {scoringLabel(
              scoringMode
            )}
          </div>
        </div>

        {officialStandings.length ===
        0 ? (
          <EmptyLine>
            No NHL Pick&apos;em
            standings are available
            yet.
          </EmptyLine>
        ) : (
          <div className="g365-nhl-standings-scroll">
            <div
              className="g365-nhl-standings-header"
              style={{
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
              }}
            >
              <div>RANK</div>
              <div>ENTRY</div>
              <div
                style={{
                  textAlign:
                    "right",
                }}
              >
                RECORD
              </div>

              <div
                style={{
                  textAlign:
                    "right",
                }}
              >
                POINTS
              </div>

              <div
                style={{
                  textAlign:
                    "right",
                }}
              >
                PERIOD WINS
              </div>

              <div
                style={{
                  textAlign:
                    "right",
                }}
              >
                PLAYED
              </div>
            </div>

            {officialStandings.map(
              (
                row,
                index
              ) => (
                <div
                  key={
                    row.entryId
                  }
                  className="g365-nhl-standing-row"
                  style={{
                    padding:
                      "13px 14px",
                    borderBottom:
                      index ===
                      officialStandings.length -
                        1
                        ? "none"
                        : "1px solid rgba(255,255,255,0.045)",
                    background:
                      viewerFantasyTeamId ===
                      row.fantasyTeamId
                        ? "linear-gradient(90deg,rgba(156,18,20,0.18),rgba(255,118,39,0.04))"
                        : "transparent",
                  }}
                >
                  <RankBadge
                    rank={
                      index +
                      1
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
                        fontSize:
                          13,
                        fontWeight:
                          1000,
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

                    {viewerFantasyTeamId ===
                    row.fantasyTeamId ? (
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
                      row.periodsWon
                    }
                  </StatValue>

                  <StatValue>
                    {
                      row.periodsPlayed
                    }
                  </StatValue>
                </div>
              )
            )}
          </div>
        )}
      </section>

      {activePeriod ? (
        <section
          style={{
            overflow:
              "hidden",
            borderRadius:
              16,
            border:
              "1px solid rgba(255,118,39,0.18)",
            background:
              "#101014",
          }}
        >
          <div
            style={{
              display:
                "flex",
              justifyContent:
                "space-between",
              alignItems:
                "center",
              gap: 12,
              flexWrap:
                "wrap",
              padding:
                "15px 16px",
              borderBottom:
                "1px solid rgba(255,255,255,0.07)",
              background:
                "rgba(255,118,39,0.035)",
            }}
          >
            <div>
              <h2
                style={{
                  margin: 0,
                  color:
                    "#fff",
                  fontSize:
                    18,
                }}
              >
                Period{" "}
                {
                  activePeriod.period_number
                }{" "}
                Snapshot
              </h2>

              <div
                style={{
                  marginTop:
                    4,
                  color:
                    "#85858e",
                  fontSize:
                    11,
                }}
              >
                Live period results
                are not official
                season standings until
                finalization.
              </div>
            </div>

            <span
              style={{
                color:
                  "#ffc46c",
                fontSize:
                  10,
                fontWeight:
                  1000,
              }}
            >
              {statusLabel(
                activePeriod.status
              )}
            </span>
          </div>

          {activePeriodResults.length ===
          0 ? (
            <EmptyLine>
              No Period{" "}
              {
                activePeriod.period_number
              }{" "}
              results are available
              yet.
            </EmptyLine>
          ) : (
            <div className="g365-nhl-standings-scroll">
              <div
                className="g365-nhl-live-header"
                style={{
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
                }}
              >
                <div>RANK</div>
                <div>ENTRY</div>

                <div
                  style={{
                    textAlign:
                      "right",
                  }}
                >
                  RECORD
                </div>

                <div
                  style={{
                    textAlign:
                      "right",
                  }}
                >
                  POINTS
                </div>

                <div
                  style={{
                    textAlign:
                      "right",
                  }}
                >
                  PICKS
                </div>
              </div>

              {activePeriodResults.map(
                (
                  row,
                  index
                ) => (
                  <div
                    key={
                      row.entry_id
                    }
                    className="g365-nhl-live-row"
                    style={{
                      padding:
                        "12px 14px",
                      borderBottom:
                        index ===
                        activePeriodResults.length -
                          1
                          ? "none"
                          : "1px solid rgba(255,255,255,0.045)",
                      background:
                        viewerFantasyTeamId ===
                        row.fantasy_team_id
                          ? "linear-gradient(90deg,rgba(156,18,20,0.16),rgba(255,118,39,0.03))"
                          : "transparent",
                    }}
                  >
                    <RankBadge
                      rank={
                        index +
                        1
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
                            row.numericPoints
                          )}
                    </StatValue>

                    <StatValue>
                      {
                        row.submitted_picks
                      }
                      /
                      {
                        row.required_picks
                      }
                    </StatValue>
                  </div>
                )
              )}
            </div>
          )}
        </section>
      ) : null}
    </main>
  );
}

function RankBadge({
  rank,
}: {
  rank: number;
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
          rank === 1
            ? "linear-gradient(135deg,#9b1517,#ff7627)"
            : "rgba(255,255,255,0.055)",
        color:
          "#fff",
        fontSize:
          12,
        fontWeight:
          1000,
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
          "#e5e5e8",
        fontSize:
          12,
        fontWeight:
          900,
        fontVariantNumeric:
          "tabular-nums",
        whiteSpace:
          "nowrap",
      }}
    >
      {children}
    </div>
  );
}

function EmptyLine({
  children,
}: {
  children:
    React.ReactNode;
}) {
  return (
    <div
      style={{
        padding:
          "20px 16px",
        color:
          "#8f8f98",
        fontSize:
          12,
      }}
    >
      {children}
    </div>
  );
}