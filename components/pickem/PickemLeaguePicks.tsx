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
  viewerFantasyTeamId: number | null;
};

type ScoringMode =
  | "record_only"
  | "standard"
  | "three_one_zero"
  | "custom"
  | "confidence";

type WeekRow = {
  id: number;
  week: number;
  status: string;
  required_picks: number;
  scoring_mode: ScoringMode;
};

type LeaguePickRow = {
  fantasy_team_id: number;
  team_name: string;
  pick_id: number | null;
  game_id: number | null;
  sport: "ncaaf" | "nfl" | null;
  kickoff_at: string | null;
  away_team_name: string | null;
  home_team_name: string | null;
  away_score: number | null;
  home_score: number | null;
  status_type: string | null;
  status_name: string | null;
  status_detail: string | null;
  period: number | null;
  display_clock: string | null;
  is_final: boolean;
  pick_visible: boolean;
  selected_side: "home" | "away" | null;
  frozen_home_spread: number | string | null;
  confidence_value: number | string | null;
  pick_result:
    | "pending"
    | "win"
    | "loss"
    | "push"
    | "void"
    | null;
  points_awarded: number | string | null;
  possession_team_abbreviation: string | null;
  down: number | null;
  distance: number | null;
  yard_line: number | null;
  yards_to_endzone: number | null;
  down_distance_text: string | null;
  possession_text: string | null;
  is_red_zone: boolean | null;
  last_play_text: string | null;
};

type WeeklyResultRow = {
  fantasy_team_id: number;
  wins: number;
  losses: number;
  pushes: number;
  pending: number;
  points: number | string;
  is_final: boolean;
  weekly_rank: number | null;
};

type TeamGroup = {
  fantasyTeamId: number;
  teamName: string;
  rows: LeaguePickRow[];
};


function numberValue(
  value: number | string | null
) {
  if (value === null) {
    return null;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : null;
}


function formatNumber(
  value: number
) {
  return Number.isInteger(value)
    ? String(value)
    : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}


function formatSpread(
  value: number
) {
  if (Math.abs(value) < 0.0001) {
    return "PK";
  }

  return value > 0
    ? `+${formatNumber(value)}`
    : formatNumber(value);
}


function sportLabel(
  sport: "ncaaf" | "nfl"
) {
  return sport === "nfl"
    ? "NFL"
    : "COLLEGE";
}


function scoringLabel(
  mode: ScoringMode
) {
  switch (mode) {
    case "standard":
      return "STANDARD POINTS";
    case "three_one_zero":
      return "3–1–0 POINTS";
    case "custom":
      return "CUSTOM POINTS";
    case "confidence":
      return "CONFIDENCE POINTS";
    default:
      return "RECORD ONLY";
  }
}


function usesPoints(
  mode: ScoringMode
) {
  return mode !== "record_only";
}


function liveLabel(
  row: LeaguePickRow
) {
  if (row.is_final) {
    return "FINAL";
  }

  const parts = ["LIVE"];

  if (row.period) {
    parts.push(`Q${row.period}`);
  }

  if (row.display_clock) {
    parts.push(row.display_clock);
  }

  return parts.join(" · ");
}


function pickTeamName(
  row: LeaguePickRow
) {
  return row.selected_side === "home"
    ? row.home_team_name ?? "Home"
    : row.away_team_name ?? "Away";
}


function pickSpread(
  row: LeaguePickRow
) {
  const homeSpread =
    numberValue(
      row.frozen_home_spread
    );

  if (homeSpread === null) {
    return null;
  }

  return row.selected_side === "home"
    ? homeSpread
    : -homeSpread;
}


function currentAtsState(
  row: LeaguePickRow
) {
  if (
    !row.pick_visible ||
    !row.selected_side
  ) {
    return null;
  }

  if (row.pick_result === "win") {
    return {
      text: "WIN",
      tone: "win" as const,
    };
  }

  if (row.pick_result === "loss") {
    return {
      text: "LOSS",
      tone: "loss" as const,
    };
  }

  if (row.pick_result === "push") {
    return {
      text: "PUSH",
      tone: "push" as const,
    };
  }

  if (row.pick_result === "void") {
    return {
      text: "VOID",
      tone: "neutral" as const,
    };
  }

  const homeSpread =
    numberValue(
      row.frozen_home_spread
    );

  if (
    homeSpread === null ||
    row.home_score === null ||
    row.away_score === null
  ) {
    return {
      text: "PENDING",
      tone: "neutral" as const,
    };
  }

  const adjustedHome =
    row.home_score +
    homeSpread;

  const margin =
    row.selected_side === "home"
      ? adjustedHome -
        row.away_score
      : row.away_score -
        adjustedHome;

  if (Math.abs(margin) < 0.0001) {
    return {
      text: "CURRENTLY PUSH",
      tone: "push" as const,
    };
  }

  return margin > 0
    ? {
        text:
          "CURRENTLY WINNING ATS",
        tone:
          "win" as const,
      }
    : {
        text:
          "CURRENTLY LOSING ATS",
        tone:
          "loss" as const,
      };
}


function toneColor(
  tone:
    | "win"
    | "loss"
    | "push"
    | "neutral"
) {
  switch (tone) {
    case "win":
      return "#55df8a";
    case "loss":
      return "#ff696d";
    case "push":
      return "#ffc46c";
    default:
      return "#aaaab2";
  }
}


function liveSituationText(
  row: LeaguePickRow
) {
  if (
    row.is_final ||
    !row.pick_visible
  ) {
    return null;
  }

  const possession =
    row.possession_team_abbreviation;

  const downText =
    row.down_distance_text;

  const fieldText =
    row.possession_text;

  if (
    possession &&
    downText
  ) {
    if (
      fieldText &&
      !downText.includes(
        fieldText
      )
    ) {
      return `${possession} BALL · ${downText} · ${fieldText}`;
    }

    return `${possession} BALL · ${downText}`;
  }

  if (possession && fieldText) {
    return `${possession} BALL · ${fieldText}`;
  }

  if (possession) {
    return `${possession} BALL`;
  }

  return downText ?? fieldText ?? null;
}


export default function PickemLeaguePicks({
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
    weeks,
    setWeeks,
  ] =
    useState<WeekRow[]>([]);

  const [
    selectedWeekId,
    setSelectedWeekId,
  ] =
    useState<number | null>(
      null
    );

  const [
    rows,
    setRows,
  ] =
    useState<LeaguePickRow[]>(
      []
    );

  const [
    results,
    setResults,
  ] =
    useState<
      WeeklyResultRow[]
    >([]);

  const [
    expandedTeamIds,
    setExpandedTeamIds,
  ] =
    useState<Set<number>>(
      () => new Set()
    );

  const selectedWeek =
    useMemo(
      () =>
        weeks.find(
          (week) =>
            week.id ===
            selectedWeekId
        ) ?? null,
      [
        selectedWeekId,
        weeks,
      ]
    );

  const resultsByTeam =
    useMemo(() => {
      const map =
        new Map<
          number,
          WeeklyResultRow
        >();

      for (
        const result
        of results
      ) {
        map.set(
          result.fantasy_team_id,
          result
        );
      }

      return map;
    }, [results]);

  const teamGroups =
    useMemo<TeamGroup[]>(
      () => {
        const map =
          new Map<
            number,
            TeamGroup
          >();

        for (const row of rows) {
          let group =
            map.get(
              row.fantasy_team_id
            );

          if (!group) {
            group = {
              fantasyTeamId:
                row.fantasy_team_id,
              teamName:
                row.team_name,
              rows:
                [],
            };

            map.set(
              row.fantasy_team_id,
              group
            );
          }

          if (
            row.pick_id !==
            null
          ) {
            group.rows.push(
              row
            );
          }
        }

        return [
          ...map.values(),
        ]
          .map((group) => ({
            ...group,
            rows: [...group.rows].sort((a, b) => {
              const aTime = a.kickoff_at
                ? new Date(a.kickoff_at).getTime()
                : Number.POSITIVE_INFINITY;
              const bTime = b.kickoff_at
                ? new Date(b.kickoff_at).getTime()
                : Number.POSITIVE_INFINITY;

              if (aTime !== bTime) {
                return aTime - bTime;
              }

              return (a.game_id ?? Number.MAX_SAFE_INTEGER) -
                (b.game_id ?? Number.MAX_SAFE_INTEGER);
            }),
          }))
          .sort((a, b) =>
            a.teamName.localeCompare(
              b.teamName
            )
          );
      },
      [rows]
    );

  const loadWeeks =
    useCallback(
      async () => {
        const {
          data,
          error,
        } =
          await supabase
            .from(
              "pickem_weeks"
            )
            .select(
              "id,week,status,required_picks,scoring_mode"
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
              "week",
              {
                ascending:
                  true,
              }
            );

        if (error) {
          throw new Error(
            error.message
          );
        }

        const next =
          (data ??
            []) as WeekRow[];

        setWeeks(next);

        setSelectedWeekId(
          (current) => {
            if (
              current !==
                null &&
              next.some(
                (row) =>
                  row.id ===
                  current
              )
            ) {
              return current;
            }

            const active =
              next.find(
                (row) =>
                  row.status !==
                  "final"
              );

            return (
              active?.id ??
              next.at(-1)
                ?.id ??
              null
            );
          }
        );
      },
      [
        leagueId,
        season,
        supabase,
      ]
    );

  const loadWeekData =
    useCallback(
      async (
        week:
          WeekRow | null
      ) => {
        if (!week) {
          setRows([]);
          setResults([]);
          return;
        }

        const [
          picksResult,
          resultsResult,
        ] =
          await Promise.all([
            supabase.rpc(
              "get_pickem_league_picks_v2",
              {
                p_league_id:
                  leagueId,
                p_season:
                  season,
                p_week:
                  week.week,
              }
            ),

            supabase
              .from(
                "pickem_weekly_results"
              )
              .select(
                "fantasy_team_id,wins,losses,pushes,pending,points,is_final,weekly_rank"
              )
              .eq(
                "league_id",
                leagueId
              )
              .eq(
                "pickem_week_id",
                week.id
              ),
          ]);

        if (
          picksResult.error
        ) {
          throw new Error(
            picksResult
              .error.message
          );
        }

        if (
          resultsResult.error
        ) {
          throw new Error(
            resultsResult
              .error.message
          );
        }

        setRows(
          (picksResult.data ??
            []) as LeaguePickRow[]
        );

        setResults(
          (resultsResult.data ??
            []) as WeeklyResultRow[]
        );
      },
      [
        leagueId,
        season,
        supabase,
      ]
    );

  useEffect(() => {
    let active = true;

    async function run() {
      setLoading(true);
      setMessage("");

      try {
        await loadWeeks();
      } catch (error) {
        if (!active) {
          return;
        }

        setMessage(
          error instanceof Error
            ? error.message
            : "League Picks could not be loaded."
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void run();

    return () => {
      active = false;
    };
  }, [loadWeeks]);

  useEffect(() => {
    if (loading) {
      return;
    }

    let active = true;

    async function run() {
      try {
        await loadWeekData(
          selectedWeek
        );
      } catch (error) {
        if (!active) {
          return;
        }

        setMessage(
          error instanceof Error
            ? error.message
            : "League Picks could not be refreshed."
        );
      }
    }

    void run();

    const timer =
      window.setInterval(
        () => {
          void run();
        },
        10000
      );

    return () => {
      active = false;
      window.clearInterval(
        timer
      );
    };
  }, [
    loadWeekData,
    loading,
    selectedWeek,
  ]);

  if (loading) {
    return (
      <main
        style={{
          padding:
            "22px 18px",
          color:
            "#aaaab2",
        }}
      >
        Loading league picks…
      </main>
    );
  }

  return (
    <main
      style={{
        display:
          "grid",
        gap:
          18,
        maxWidth:
          1180,
        padding:
          "22px 18px 36px",
      }}
    >
      <section
        style={{
          display:
            "grid",
          gap:
            10,
          padding:
            20,
          borderRadius:
            18,
          border:
            "1px solid rgba(255,108,33,0.25)",
          background:
            "linear-gradient(135deg, rgba(100,7,13,0.40), rgba(17,17,21,0.98) 58%)",
        }}
      >
        <div
          style={{
            color:
              "#ff7627",
            fontSize:
              12,
            fontWeight:
              1000,
            letterSpacing:
              "0.12em",
            textTransform:
              "uppercase",
          }}
        >
          G365 Football Pick&apos;em
        </div>

        <h1
          style={{
            margin: 0,
            color:
              "#fff",
            fontSize:
              "clamp(28px, 5vw, 42px)",
          }}
        >
          League Picks
        </h1>

        <p
          style={{
            margin: 0,
            maxWidth:
              900,
            color:
              "#a6a6ae",
            lineHeight:
              1.6,
          }}
        >
          Picks stay hidden until their individual games kick off. Revealed picks show the frozen G365 Spread, live ATS position, scoring value, and live football situation.
        </p>
      </section>

      <section
        style={{
          display:
            "flex",
          alignItems:
            "center",
          gap:
            10,
          flexWrap:
            "wrap",
          padding:
            "14px 16px",
          borderRadius:
            14,
          border:
            "1px solid rgba(255,255,255,0.08)",
          background:
            "#111115",
        }}
      >
        <label
          htmlFor="league-picks-week"
          style={{
            color:
              "#bcbcc3",
            fontSize:
              13,
            fontWeight:
              900,
          }}
        >
          Week
        </label>

        <select
          id="league-picks-week"
          value={
            selectedWeekId ??
            ""
          }
          onChange={(
            event
          ) => {
            const value =
              Number(
                event.target.value
              );

            setSelectedWeekId(
              Number.isFinite(
                value
              )
                ? value
                : null
            );
          }}
          style={{
            minWidth:
              150,
            padding:
              "10px 12px",
            borderRadius:
              10,
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
          {weeks.map(
            (week) => (
              <option
                key={week.id}
                value={week.id}
              >
                Week {week.week}
              </option>
            )
          )}
        </select>

        {selectedWeek ? (
          <>
            <span
              style={{
                marginLeft:
                  "auto",
                color:
                  "#ff9b59",
                fontSize:
                  11,
                fontWeight:
                  1000,
                letterSpacing:
                  "0.06em",
              }}
            >
              {scoringLabel(
                selectedWeek.scoring_mode
              )}
            </span>

            <span
              style={{
                color:
                  "#92929b",
                fontSize:
                  12,
                fontWeight:
                  800,
              }}
            >
              Required:{" "}
              <strong
                style={{
                  color:
                    "#fff",
                }}
              >
                {
                  selectedWeek.required_picks
                }
              </strong>
            </span>
          </>
        ) : null}
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

      {!selectedWeek ? (
        <EmptyState
          title="The weekly card is not ready yet."
          description="League Picks will appear after a Pick'em week has been initialized."
        />
      ) : (
        <section
          style={{
            display:
              "grid",
            gap:
              14,
          }}
        >
          {teamGroups.map(
            (group) => {
              const result =
                resultsByTeam.get(
                  group.fantasyTeamId
                );

              const submittedCount =
                group.rows.length;

              const remaining =
                Math.max(
                  selectedWeek.required_picks -
                    submittedCount,
                  0
                );

              const isViewer =
                viewerFantasyTeamId ===
                group.fantasyTeamId;

              const isExpanded =
                expandedTeamIds.has(
                  group.fantasyTeamId
                );

              return (
                <article
                  key={
                    group.fantasyTeamId
                  }
                  style={{
                    overflow:
                      "hidden",
                    borderRadius:
                      16,
                    border:
                      isViewer
                        ? "1px solid rgba(255,111,34,0.52)"
                        : "1px solid rgba(255,255,255,0.08)",
                    background:
                      isViewer
                        ? "linear-gradient(145deg, rgba(96,8,12,0.30), #101014 55%)"
                        : "#101014",
                  }}
                >
                  <div
                    style={{
                      display:
                        "grid",
                      gridTemplateColumns:
                        "minmax(0,1fr) auto auto",
                      gap:
                        14,
                      alignItems:
                        "center",
                      padding:
                        15,
                      borderBottom:
                        !isExpanded
                          ? "none"
                          : "1px solid rgba(255,255,255,0.06)",
                      background:
                        "rgba(0,0,0,0.22)",
                    }}
                  >
                    <div
                      style={{
                        minWidth: 0,
                      }}
                    >
                      <div
                        style={{
                          display:
                            "flex",
                          gap: 8,
                          alignItems:
                            "center",
                          flexWrap:
                            "wrap",
                        }}
                      >
                        <h2
                          style={{
                            margin: 0,
                            overflow:
                              "hidden",
                            textOverflow:
                              "ellipsis",
                            color:
                              "#fff",
                            fontSize:
                              18,
                            whiteSpace:
                              "nowrap",
                          }}
                        >
                          {group.teamName}
                        </h2>

                        {isViewer ? (
                          <span
                            style={{
                              padding:
                                "3px 7px",
                              borderRadius:
                                999,
                              background:
                                "rgba(255,108,33,0.13)",
                              color:
                                "#ff9b59",
                              fontSize:
                                10,
                              fontWeight:
                                1000,
                            }}
                          >
                            YOU
                          </span>
                        ) : null}
                      </div>

                      <div
                        style={{
                          marginTop: 5,
                          color:
                            "#909099",
                          fontSize:
                            12,
                        }}
                      >
                        {submittedCount} /{" "}
                        {selectedWeek.required_picks} picks submitted
                        {remaining > 0
                          ? ` · ${remaining} remaining`
                          : " · Card complete"}
                      </div>
                    </div>

                    <RecordBox
                      result={result}
                      submittedCount={
                        submittedCount
                      }
                      scoringMode={
                        selectedWeek.scoring_mode
                      }
                    />

                    <button
                      type="button"
                      onClick={() => {
                        setExpandedTeamIds(
                          (current) => {
                            const next =
                              new Set(
                                current
                              );

                            if (
                              next.has(
                                group.fantasyTeamId
                              )
                            ) {
                              next.delete(
                                group.fantasyTeamId
                              );
                            } else {
                              next.add(
                                group.fantasyTeamId
                              );
                            }

                            return next;
                          }
                        );
                      }}
                      aria-expanded={
                        isExpanded
                      }
                      style={{
                        width: 38,
                        height: 38,
                        display:
                          "inline-flex",
                        alignItems:
                          "center",
                        justifyContent:
                          "center",
                        borderRadius:
                          10,
                        border:
                          "1px solid rgba(255,118,39,0.28)",
                        background:
                          !isExpanded
                            ? "rgba(255,108,33,0.12)"
                            : "rgba(255,255,255,0.035)",
                        color:
                          !isExpanded
                            ? "#ff9b59"
                            : "#d4d4d8",
                        fontSize:
                          20,
                        fontWeight:
                          1000,
                        cursor:
                          "pointer",
                      }}
                    >
                      {isExpanded
                        ? "−"
                        : "+"}
                    </button>
                  </div>

                  {isExpanded ? (
                    <div
                      style={{
                        display:
                          "grid",
                        gap: 9,
                        padding: 13,
                      }}
                    >
                      {group.rows.length ===
                      0 ? (
                        <div
                          style={{
                            padding:
                              "13px 14px",
                            borderRadius:
                              11,
                            background:
                              "rgba(255,255,255,0.025)",
                            color:
                              "#85858e",
                            fontSize:
                              13,
                          }}
                        >
                          No picks submitted yet.
                        </div>
                      ) : (
                        group.rows.map(
                          (
                            row,
                            index
                          ) => (
                            <PickRow
                              key={
                                row.pick_id ??
                                `${group.fantasyTeamId}-${index}`
                              }
                              row={row}
                              pickNumber={
                                index + 1
                              }
                              scoringMode={
                                selectedWeek.scoring_mode
                              }
                            />
                          )
                        )
                      )}
                    </div>
                  ) : null}
                </article>
              );
            }
          )}
        </section>
      )}
    </main>
  );
}


function RecordBox({
  result,
  submittedCount,
  scoringMode,
}: {
  result:
    WeeklyResultRow | undefined;
  submittedCount: number;
  scoringMode: ScoringMode;
}) {
  const record =
    result
      ? `${result.wins}-${result.losses}${result.pushes ? `-${result.pushes}` : ""}`
      : "0-0";

  const points =
    result
      ? numberValue(
          result.points
        ) ?? 0
      : 0;

  return (
    <div
      style={{
        textAlign:
          "right",
        minWidth: 92,
      }}
    >
      <div
        style={{
          color: "#fff",
          fontSize: 18,
          fontWeight: 1000,
        }}
      >
        {record}
      </div>

      <div
        style={{
          marginTop: 3,
          color:
            result?.is_final
              ? "#55df8a"
              : "#8d8d96",
          fontSize: 10,
          fontWeight: 900,
          letterSpacing:
            "0.05em",
        }}
      >
        {result?.is_final
          ? "FINAL"
          : submittedCount > 0
            ? "AWAITING WEEK FINAL"
            : "NO PICKS"}
      </div>

      {usesPoints(
        scoringMode
      ) ? (
        <div
          style={{
            marginTop: 5,
            color:
              "#ffb16f",
            fontSize: 12,
            fontWeight: 1000,
          }}
        >
          {formatNumber(
            points
          )} PTS
        </div>
      ) : null}
    </div>
  );
}


function PickRow({
  row,
  pickNumber,
  scoringMode,
}: {
  row: LeaguePickRow;
  pickNumber: number;
  scoringMode: ScoringMode;
}) {
  if (!row.pick_visible) {
    return (
      <div
        style={{
          display:
            "grid",
          gridTemplateColumns:
            "32px minmax(0,1fr)",
          gap: 10,
          alignItems:
            "center",
          minHeight: 58,
          padding:
            "10px 12px",
          borderRadius: 11,
          border:
            "1px solid rgba(255,255,255,0.06)",
          background:
            "rgba(255,255,255,0.022)",
        }}
      >
        <PickNumber
          value={pickNumber}
        />

        <div
          style={{
            color:
              "#a0a0a9",
            fontSize: 13,
            fontWeight: 800,
          }}
        >
          🔒 Pick Hidden Until Kickoff
        </div>
      </div>
    );
  }

  const spread =
    pickSpread(row);

  const ats =
    currentAtsState(row);

  const confidence =
    numberValue(
      row.confidence_value
    );

  const points =
    numberValue(
      row.points_awarded
    );

  const situation =
    liveSituationText(row);

  return (
    <div
      style={{
        display:
          "grid",
        gridTemplateColumns:
          "32px minmax(0,1fr) auto",
        gap: 10,
        alignItems:
          "center",
        minHeight: 72,
        padding:
          "10px 12px",
        borderRadius: 11,
        border:
          "1px solid rgba(255,108,33,0.13)",
        background:
          "rgba(255,82,20,0.035)",
      }}
    >
      <PickNumber
        value={pickNumber}
      />

      <div
        style={{
          minWidth: 0,
        }}
      >
        <div
          style={{
            display:
              "flex",
            gap: 7,
            alignItems:
              "center",
            flexWrap:
              "wrap",
          }}
        >
          {row.sport ? (
            <span
              style={{
                color:
                  "#ff9b59",
                fontSize: 9,
                fontWeight: 1000,
                letterSpacing:
                  "0.08em",
              }}
            >
              {sportLabel(
                row.sport
              )}
            </span>
          ) : null}

          <span
            style={{
              color:
                row.is_final
                  ? "#b6b6be"
                  : "#fff",
              fontSize: 10,
              fontWeight: 900,
            }}
          >
            {row.is_final
              ? "FINAL"
              : liveLabel(row)}
          </span>

          {scoringMode ===
            "confidence" &&
          confidence !==
            null ? (
            <span
              style={{
                padding:
                  "2px 6px",
                borderRadius: 999,
                background:
                  "rgba(255,160,65,0.12)",
                color:
                  "#ffc06f",
                fontSize: 9,
                fontWeight: 1000,
              }}
            >
              CONF{" "}
              {formatNumber(
                confidence
              )}
            </span>
          ) : null}
        </div>

        <div
          style={{
            marginTop: 4,
            overflow:
              "hidden",
            textOverflow:
              "ellipsis",
            color: "#fff",
            fontSize: 14,
            fontWeight: 950,
            whiteSpace:
              "nowrap",
          }}
        >
          {pickTeamName(
            row
          )}{" "}
          {spread !== null
            ? formatSpread(
                spread
              )
            : ""}
        </div>

        {row.away_score !==
          null &&
        row.home_score !==
          null ? (
          <div
            style={{
              marginTop: 4,
              color:
                "#aaaab2",
              fontSize: 11,
              fontWeight: 800,
            }}
          >
            {row.away_team_name}{" "}
            {row.away_score} @{" "}
            {row.home_team_name}{" "}
            {row.home_score}
          </div>
        ) : null}

        {situation ? (
          <div
            style={{
              marginTop: 5,
              color:
                row.is_red_zone
                  ? "#ffb45f"
                  : "#d7d7dd",
              fontSize: 11,
              fontWeight: 900,
            }}
          >
            {situation}
            {row.is_red_zone
              ? " · RED ZONE"
              : ""}
          </div>
        ) : null}
      </div>

      <div
        style={{
          display: "grid",
          gap: 5,
          justifyItems:
            "end",
        }}
      >
        {ats ? (
          <div
            style={{
              color:
                toneColor(
                  ats.tone
                ),
              fontSize: 11,
              fontWeight: 1000,
              textAlign: "right",
            }}
          >
            {ats.text}
          </div>
        ) : null}

        {usesPoints(
          scoringMode
        ) &&
        points !== null ? (
          <div
            style={{
              color:
                points > 0
                  ? "#55df8a"
                  : "#aaaab2",
              fontSize: 11,
              fontWeight: 1000,
            }}
          >
            {points > 0
              ? "+"
              : ""}
            {formatNumber(
              points
            )} PTS
          </div>
        ) : null}
      </div>
    </div>
  );
}


function PickNumber({
  value,
}: {
  value: number;
}) {
  return (
    <div
      style={{
        width: 28,
        height: 28,
        display:
          "grid",
        placeItems:
          "center",
        borderRadius: 8,
        background:
          "rgba(255,108,33,0.12)",
        color:
          "#ff9b59",
        fontSize: 11,
        fontWeight: 1000,
      }}
    >
      {value}
    </div>
  );
}


function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <section
      style={{
        padding: 24,
        borderRadius: 16,
        border:
          "1px solid rgba(255,255,255,0.08)",
        background:
          "#101014",
      }}
    >
      <div
        style={{
          color: "#fff",
          fontWeight: 1000,
        }}
      >
        {title}
      </div>

      <div
        style={{
          marginTop: 6,
          color:
            "#92929b",
          lineHeight: 1.5,
        }}
      >
        {description}
      </div>
    </section>
  );
}
