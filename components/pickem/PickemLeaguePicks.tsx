"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  createSupabaseBrowserClient,
} from "@/lib/supabase/browser";


type Props = {
  leagueId: string;
  season: number;
  viewerFantasyTeamId:
    number | null;
};


type WeekRow = {
  id: number;
  week: number;
  status: string;
  required_picks: number;
};


type LeaguePickRow = {
  fantasy_team_id: number;
  team_name: string;
  pick_id: number | null;
  game_id: number | null;
  sport:
    | "ncaaf"
    | "nfl"
    | null;
  kickoff_at: string | null;
  away_team_name:
    string | null;
  home_team_name:
    string | null;
  away_score:
    number | null;
  home_score:
    number | null;
  status_type:
    string | null;
  status_name:
    string | null;
  status_detail:
    string | null;
  period:
    number | null;
  display_clock:
    string | null;
  possession_team_espn_id:
    string | null;
  possession_team_abbreviation:
    string | null;
  down:
    number | null;
  distance:
    number | null;
  yard_line:
    number | null;
  yards_to_endzone:
    number | null;
  down_distance_text:
    string | null;
  possession_text:
    string | null;
  is_red_zone:
    boolean | null;
  last_play_text:
    string | null;
  is_final: boolean;
  pick_visible: boolean;
  selected_side:
    | "home"
    | "away"
    | null;
  frozen_home_spread:
    number |
    string |
    null;
  pick_result:
    | "pending"
    | "win"
    | "loss"
    | "push"
    | "void"
    | null;
  points_awarded:
    number |
    string |
    null;
};


type WeeklyResultRow = {
  fantasy_team_id: number;
  wins: number;
  losses: number;
  pushes: number;
  pending: number;
  points:
    number |
    string;
  is_final: boolean;
  weekly_rank:
    number | null;
};


type TeamGroup = {
  fantasyTeamId: number;
  teamName: string;
  rows: LeaguePickRow[];
};


function numberValue(
  value:
    number |
    string |
    null
) {
  if (
    value === null
  ) {
    return null;
  }

  const parsed =
    Number(value);

  return Number.isFinite(
    parsed
  )
    ? parsed
    : null;
}


function formatSpread(
  value:
    number
) {
  if (
    Math.abs(
      value
    ) <
    0.0001
  ) {
    return "PK";
  }

  return value > 0
    ? `+${value}`
    : String(value);
}


function formatKickoff(
  value:
    string
) {
  return new Date(
    value
  ).toLocaleString(
    undefined,
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
    }
  );
}


function sportLabel(
  sport:
    "ncaaf" |
    "nfl"
) {
  return sport ===
    "nfl"
    ? "NFL"
    : "COLLEGE";
}


function liveLabel(
  row:
    LeaguePickRow
) {
  if (
    row.is_final
  ) {
    return "FINAL";
  }

  const parts =
    [
      "LIVE",
    ];

  if (
    row.period
  ) {
    parts.push(
      `Q${row.period}`
    );
  }

  if (
    row.display_clock
  ) {
    parts.push(
      row.display_clock
    );
  }

  return parts.join(
    " · "
  );
}


function pickTeamName(
  row:
    LeaguePickRow
) {
  if (
    row.selected_side ===
    "home"
  ) {
    return (
      row.home_team_name ??
      "Home"
    );
  }

  return (
    row.away_team_name ??
    "Away"
  );
}


function pickSpread(
  row:
    LeaguePickRow
) {
  const homeSpread =
    numberValue(
      row.frozen_home_spread
    );

  if (
    homeSpread ===
    null
  ) {
    return null;
  }

  return row.selected_side ===
    "home"
    ? homeSpread
    : -homeSpread;
}


function currentAtsState(
  row:
    LeaguePickRow
) {
  if (
    !row.pick_visible ||
    !row.selected_side
  ) {
    return null;
  }

  if (
    row.pick_result ===
      "win"
  ) {
    return {
      text:
        "WIN",
      tone:
        "win" as const,
    };
  }

  if (
    row.pick_result ===
      "loss"
  ) {
    return {
      text:
        "LOSS",
      tone:
        "loss" as const,
    };
  }

  if (
    row.pick_result ===
      "push"
  ) {
    return {
      text:
        "PUSH",
      tone:
        "push" as const,
    };
  }

  if (
    row.pick_result ===
      "void"
  ) {
    return {
      text:
        "VOID",
      tone:
        "neutral" as const,
    };
  }

  const homeSpread =
    numberValue(
      row.frozen_home_spread
    );

  if (
    homeSpread ===
      null ||
    row.home_score ===
      null ||
    row.away_score ===
      null
  ) {
    return {
      text:
        "PENDING",
      tone:
        "neutral" as const,
    };
  }

  const adjustedHome =
    row.home_score +
    homeSpread;

  const margin =
    row.selected_side ===
    "home"
      ? adjustedHome -
        row.away_score
      : row.away_score -
        adjustedHome;

  if (
    Math.abs(
      margin
    ) <
    0.0001
  ) {
    return {
      text:
        "CURRENTLY PUSH",
      tone:
        "push" as const,
    };
  }

  if (
    margin > 0
  ) {
    return {
      text:
        "CURRENTLY WINNING ATS",
      tone:
        "win" as const,
    };
  }

  return {
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
  switch (
    tone
  ) {
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


  const realtimeRefreshTimerRef =
    useRef<number | null>(
      null
    );

  const realtimeRefreshBlockedRef =
    useRef(false);

  const realtimeRefreshPendingRef =
    useRef(false);

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
    useState<
      WeekRow[]
    >([]);

  const [
    selectedWeekId,
    setSelectedWeekId,
  ] =
    useState<
      number |
      null
    >(null);

  const [
    rows,
    setRows,
  ] =
    useState<
      LeaguePickRow[]
    >([]);

  const [
    results,
    setResults,
  ] =
    useState<
      WeeklyResultRow[]
    >([]);


  const [
    collapsedTeamIds,
    setCollapsedTeamIds,
  ] =
    useState<Set<number>>(
      () => new Set()
    );


  const toggleTeamCollapsed =
    useCallback(
      (
        fantasyTeamId:
          number
      ) => {
        setCollapsedTeamIds(
          (current) => {
            const next =
              new Set(
                current
              );

            if (
              next.has(
                fantasyTeamId
              )
            ) {
              next.delete(
                fantasyTeamId
              );
            } else {
              next.add(
                fantasyTeamId
              );
            }

            return next;
          }
        );
      },
      []
    );


  const selectedWeek =
    useMemo(
      () =>
        weeks.find(
          (week) =>
            week.id ===
            selectedWeekId
        ) ??
        null,
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
    }, [
      results,
    ]);


  const teamGroups =
    useMemo<
      TeamGroup[]
    >(() => {
      const map =
        new Map<
          number,
          TeamGroup
        >();

      for (
        const row
        of rows
      ) {
        let group =
          map.get(
            row.fantasy_team_id
          );

        if (
          !group
        ) {
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
      ].sort(
        (
          a,
          b
        ) =>
          a.teamName.localeCompare(
            b.teamName
          )
      );
    }, [
      rows,
    ]);


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
              "id,week,status,required_picks"
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

        if (
          error
        ) {
          throw new Error(
            error.message
          );
        }

        const next =
          (
            data ??
            []
          ) as WeekRow[];

        setWeeks(
          next
        );

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
          WeekRow |
          null
      ) => {
        if (
          !week
        ) {
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
              "get_pickem_league_picks",
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
          (
            picksResult.data ??
            []
          ) as LeaguePickRow[]
        );

        setResults(
          (
            resultsResult.data ??
            []
          ) as WeeklyResultRow[]
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
        await loadWeeks();
      } catch (
        error
      ) {
        if (
          !active
        ) {
          return;
        }

        setMessage(
          error instanceof Error
            ? error.message
            : "League Picks could not be loaded."
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
    loadWeeks,
  ]);


  useEffect(() => {
    if (
      loading
    ) {
      return;
    }

    let active =
      true;


    async function run() {
      try {
        await loadWeekData(
          selectedWeek
        );
      } catch (
        error
      ) {
        if (
          !active
        ) {
          return;
        }

        setMessage(
          error instanceof Error
            ? error.message
            : "League Picks could not be refreshed."
        );
      }
    }


    function performRefresh() {
      if (
        !active ||
        document.visibilityState ===
          "hidden"
      ) {
        return;
      }


      if (
        realtimeRefreshBlockedRef.current
      ) {
        realtimeRefreshPendingRef.current =
          true;

        return;
      }


      realtimeRefreshBlockedRef.current =
        true;

      realtimeRefreshPendingRef.current =
        false;

      void run().finally(
        () => {
          window.setTimeout(
            () => {
              if (!active) {
                return;
              }

              realtimeRefreshBlockedRef.current =
                false;

              if (
                realtimeRefreshPendingRef.current
              ) {
                realtimeRefreshPendingRef.current =
                  false;

                performRefresh();
              }
            },
            750
          );
        }
      );
    }


    function scheduleRefresh() {
      if (
        !active ||
        document.visibilityState ===
          "hidden"
      ) {
        return;
      }


      if (
        realtimeRefreshTimerRef.current !==
        null
      ) {
        window.clearTimeout(
          realtimeRefreshTimerRef.current
        );
      }


      realtimeRefreshTimerRef.current =
        window.setTimeout(
          () => {
            realtimeRefreshTimerRef.current =
              null;

            performRefresh();
          },
          200
        );
    }


    void run();


    /*
     * Realtime keeps League Picks synchronized with My Picks:
     *
     * - a participant adds/removes/changes a pick
     * - a game's live/final state changes
     * - grading updates the weekly result
     * - the week's lifecycle/status changes
     *
     * The privacy-safe RPC is re-read after each event, so hidden picks
     * remain hidden until their individual game reaches kickoff.
     */
    const channel =
      supabase
        .channel(
          `pickem-league-picks-${leagueId}-${season}-${selectedWeek?.id ?? "none"}`
        )
        .on(
          "postgres_changes",
          {
            event:
              "*",
            schema:
              "public",
            table:
              "pickem_picks",
            filter:
              `league_id=eq.${leagueId}`,
          },
          () => {
            scheduleRefresh();
          }
        )
        .on(
          "postgres_changes",
          {
            event:
              "*",
            schema:
              "public",
            table:
              "pickem_games",
            filter:
              `league_id=eq.${leagueId}`,
          },
          () => {
            scheduleRefresh();
          }
        )
        .on(
          "postgres_changes",
          {
            event:
              "*",
            schema:
              "public",
            table:
              "pickem_weekly_results",
            filter:
              `league_id=eq.${leagueId}`,
          },
          () => {
            scheduleRefresh();
          }
        )
        .on(
          "postgres_changes",
          {
            event:
              "*",
            schema:
              "public",
            table:
              "pickem_weeks",
            filter:
              `league_id=eq.${leagueId}`,
          },
          () => {
            scheduleRefresh();
          }
        )
        .subscribe(
          (
            status
          ) => {
            if (
              status ===
                "CHANNEL_ERROR"
            ) {
              console.error(
                "Pick'em League Picks Realtime channel error:",
                leagueId
              );
            }

            if (
              status ===
                "TIMED_OUT"
            ) {
              console.error(
                "Pick'em League Picks Realtime connection timed out:",
                leagueId
              );
            }
          }
        );


    /*
     * Realtime is the fast path. A one-second visible-page sync is also
     * intentional here so League Picks never depends on Realtime publication
     * configuration to reflect another owner's newly submitted/changed pick.
     */
    const fallbackTimer =
      window.setInterval(
        () => {
          performRefresh();
        },
        1_000
      );


    function handleFocus() {
      performRefresh();
    }


    function handleVisibilityChange() {
      if (
        document.visibilityState ===
          "visible"
      ) {
        performRefresh();
      }
    }


    window.addEventListener(
      "focus",
      handleFocus
    );

    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange
    );


    return () => {
      active =
        false;

      if (
        realtimeRefreshTimerRef.current !==
        null
      ) {
        window.clearTimeout(
          realtimeRefreshTimerRef.current
        );

        realtimeRefreshTimerRef.current =
          null;
      }

      window.clearInterval(
        fallbackTimer
      );

      window.removeEventListener(
        "focus",
        handleFocus
      );

      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      );

      void supabase.removeChannel(
        channel
      );
    };
  }, [
    leagueId,
    loadWeekData,
    loading,
    season,
    selectedWeek,
    supabase,
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
            margin:
              0,
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
            margin:
              0,
            maxWidth:
              850,
            color:
              "#a6a6ae",
            lineHeight:
              1.6,
          }}
        >
          Every participant&apos;s selections stay hidden until each individual game kicks off. As games begin, those specific picks reveal automatically with the frozen G365 Spread and live ATS position.
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
                event.target
                  .value
              );

            setSelectedWeekId(
              Number.isFinite(
                value
              )
                ? value
                : null
            );
          }}
          disabled={
            weeks.length ===
            0
          }
          style={{
            minWidth:
              155,
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
          {weeks.length ===
          0 ? (
            <option value="">
              No week ready
            </option>
          ) : (
            weeks.map(
              (week) => (
                <option
                  key={
                    week.id
                  }
                  value={
                    week.id
                  }
                >
                  Week{" "}
                  {week.week}
                </option>
              )
            )
          )}
        </select>

        {selectedWeek ? (
          <div
            style={{
              marginLeft:
                "auto",
              color:
                "#92929b",
              fontSize:
                12,
              fontWeight:
                800,
            }}
          >
            Required picks:{" "}
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
          </div>
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
      ) : teamGroups.length ===
        0 ? (
        <EmptyState
          title={`No Week ${selectedWeek.week} entries are available yet.`}
          description="League participants will appear here as soon as the week and entry data are ready."
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
            (
              group
            ) => {
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

              const isCollapsed =
                collapsedTeamIds.has(
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
                        "1px solid rgba(255,255,255,0.06)",
                      background:
                        "rgba(0,0,0,0.22)",
                    }}
                  >
                    <div
                      style={{
                        minWidth:
                          0,
                      }}
                    >
                      <div
                        style={{
                          display:
                            "flex",
                          gap:
                            8,
                          alignItems:
                            "center",
                          flexWrap:
                            "wrap",
                        }}
                      >
                        <h2
                          style={{
                            margin:
                              0,
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
                          {
                            group.teamName
                          }
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
                              letterSpacing:
                                "0.08em",
                            }}
                          >
                            YOU
                          </span>
                        ) : null}
                      </div>

                      <div
                        style={{
                          marginTop:
                            5,
                          color:
                            "#909099",
                          fontSize:
                            12,
                        }}
                      >
                        {submittedCount} /{" "}
                        {selectedWeek.required_picks} picks submitted
                        {remaining >
                        0
                          ? ` · ${remaining} remaining`
                          : " · Card complete"}
                      </div>
                    </div>

                    <RecordBox
                      result={
                        result
                      }
                      submittedCount={
                        submittedCount
                      }
                    />

                    <button
                      type="button"
                      onClick={() =>
                        toggleTeamCollapsed(
                          group.fantasyTeamId
                        )
                      }
                      aria-expanded={
                        !isCollapsed
                      }
                      aria-label={
                        isCollapsed
                          ? `Expand ${group.teamName}`
                          : `Minimize ${group.teamName}`
                      }
                      title={
                        isCollapsed
                          ? "Open team picks"
                          : "Minimize team picks"
                      }
                      style={{
                        width:
                          38,
                        height:
                          38,
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
                          isCollapsed
                            ? "rgba(255,108,33,0.12)"
                            : "rgba(255,255,255,0.035)",
                        color:
                          isCollapsed
                            ? "#ff9b59"
                            : "#d4d4d8",
                        fontSize:
                          20,
                        fontWeight:
                          1000,
                        lineHeight:
                          1,
                        cursor:
                          "pointer",
                      }}
                    >
                      {isCollapsed
                        ? "+"
                        : "−"}
                    </button>
                  </div>


                  {!isCollapsed ? (
                    <div
                      style={{
                        display:
                          "grid",
                        gap:
                          9,
                        padding:
                          13,
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
                              row={
                                row
                              }
                              pickNumber={
                                index +
                                1
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
}: {
  result:
    WeeklyResultRow |
    undefined;
  submittedCount:
    number;
}) {
  if (
    !result
  ) {
    return (
      <div
        style={{
          textAlign:
            "right",
        }}
      >
        <div
          style={{
            color:
              "#fff",
            fontSize:
              18,
            fontWeight:
              1000,
          }}
        >
          0-0
        </div>

        <div
          style={{
            marginTop:
              3,
            color:
              "#777780",
            fontSize:
              10,
            fontWeight:
              900,
            letterSpacing:
              "0.06em",
          }}
        >
          {submittedCount >
          0
            ? "PENDING"
            : "NO PICKS"}
        </div>
      </div>
    );
  }

  const remaining =
    Math.max(
      result.pending,
      0
    );

  return (
    <div
      style={{
        textAlign:
          "right",
      }}
    >
      <div
        style={{
          color:
            "#fff",
          fontSize:
            18,
          fontWeight:
            1000,
          whiteSpace:
            "nowrap",
        }}
      >
        {result.wins}-
        {result.losses}
        {result.pushes >
        0
          ? `-${result.pushes}`
          : ""}
      </div>

      <div
        style={{
          marginTop:
            3,
          color:
            result.is_final
              ? "#55df8a"
              : "#92929b",
          fontSize:
            10,
          fontWeight:
            900,
          letterSpacing:
            "0.05em",
          whiteSpace:
            "nowrap",
        }}
      >
        {result.is_final
          ? result.weekly_rank
            ? `FINAL · #${result.weekly_rank}`
            : "FINAL"
          : remaining >
              0
            ? `${remaining} REMAINING`
            : "AWAITING WEEK FINAL"}
      </div>
    </div>
  );
}


function PickRow({
  row,
  pickNumber,
}: {
  row:
    LeaguePickRow;
  pickNumber:
    number;
}) {
  if (
    !row.pick_visible
  ) {
    return (
      <div
        style={{
          display:
            "grid",
          gridTemplateColumns:
            "32px minmax(0,1fr)",
          gap:
            10,
          alignItems:
            "center",
          minHeight:
            58,
          padding:
            "10px 12px",
          borderRadius:
            11,
          border:
            "1px solid rgba(255,255,255,0.06)",
          background:
            "rgba(255,255,255,0.022)",
        }}
      >
        <PickNumber
          value={
            pickNumber
          }
        />

        <div
          style={{
            color:
              "#a0a0a9",
            fontSize:
              13,
            fontWeight:
              800,
          }}
        >
          🔒 Pick Hidden Until Kickoff
        </div>
      </div>
    );
  }

  const spread =
    pickSpread(
      row
    );

  const ats =
    currentAtsState(
      row
    );

  const kickoffReached =
    row.kickoff_at
      ? new Date(
          row.kickoff_at
        ).getTime() <=
        Date.now()
      : false;

  const hasLiveGamecast =
    !row.is_final &&
    kickoffReached &&
    Boolean(
      row.possession_team_abbreviation ||
      row.possession_text ||
      row.down_distance_text ||
      row.last_play_text ||
      row.display_clock ||
      row.period
    );

  const possessionLabel =
    row.possession_text ??
    (row.possession_team_abbreviation
      ? `${row.possession_team_abbreviation} ball`
      : null);

  const downDistanceLabel =
    row.down_distance_text ??
    (
      row.down !== null &&
      row.distance !== null
        ? `${row.down} & ${row.distance}`
        : null
    );

  const fieldPositionLabel =
    row.yards_to_endzone !== null
      ? `${row.yards_to_endzone} yd to goal`
      : row.yard_line !== null
        ? `Yard line ${row.yard_line}`
        : null;

  return (
    <div
      style={{
        display:
          "grid",
        gridTemplateColumns:
          "32px minmax(0,1fr) auto",
        gap:
          10,
        alignItems:
          "center",
        minHeight:
          hasLiveGamecast
            ? 92
            : 68,
        padding:
          "10px 12px",
        borderRadius:
          11,
        border:
          row.is_red_zone
            ? "1px solid rgba(255,70,70,0.34)"
            : "1px solid rgba(255,108,33,0.13)",
        background:
          row.is_red_zone
            ? "linear-gradient(135deg, rgba(130,15,18,0.16), rgba(255,82,20,0.035))"
            : "rgba(255,82,20,0.035)",
      }}
    >
      <PickNumber
        value={
          pickNumber
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
            display:
              "flex",
            gap:
              7,
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
                fontSize:
                  9,
                fontWeight:
                  1000,
                letterSpacing:
                  "0.08em",
              }}
            >
              {sportLabel(
                row.sport
              )}
            </span>
          ) : null}

          {row.is_final ? (
            <span
              style={{
                color:
                  "#b6b6be",
                fontSize:
                  10,
                fontWeight:
                  900,
              }}
            >
              FINAL
            </span>
          ) : kickoffReached ? (
            <span
              style={{
                color:
                  "#fff",
                fontSize:
                  10,
                fontWeight:
                  900,
              }}
            >
              {liveLabel(
                row
              )}
            </span>
          ) : null}

          {row.is_red_zone &&
          !row.is_final ? (
            <span
              style={{
                padding:
                  "2px 6px",
                borderRadius:
                  999,
                background:
                  "rgba(255,72,72,0.14)",
                color:
                  "#ff8588",
                fontSize:
                  9,
                fontWeight:
                  1000,
                letterSpacing:
                  "0.05em",
              }}
            >
              RED ZONE
            </span>
          ) : null}
        </div>

        <div
          style={{
            marginTop:
              4,
            overflow:
              "hidden",
            textOverflow:
              "ellipsis",
            color:
              "#fff",
            fontSize:
              14,
            fontWeight:
              950,
            whiteSpace:
              "nowrap",
          }}
        >
          {pickTeamName(
            row
          )}{" "}
          {spread !==
          null
            ? formatSpread(
                spread
              )
            : ""}
        </div>

        <div
          style={{
            marginTop:
              3,
            color:
              "#85858e",
            fontSize:
              11,
          }}
        >
          {row.away_team_name ??
          "Away"}{" "}
          {row.away_score !==
          null
            ? row.away_score
            : ""}
          {" @ "}
          {row.home_team_name ??
          "Home"}{" "}
          {row.home_score !==
          null
            ? row.home_score
            : ""}
          {row.kickoff_at &&
          !row.is_final &&
          !kickoffReached
            ? ` · ${formatKickoff(
                row.kickoff_at
              )}`
            : ""}
        </div>

        {hasLiveGamecast ? (
          <div
            style={{
              display:
                "grid",
              gap:
                3,
              marginTop:
                6,
            }}
          >
            {(possessionLabel ||
              downDistanceLabel ||
              fieldPositionLabel) ? (
              <div
                style={{
                  display:
                    "flex",
                  gap:
                    6,
                  alignItems:
                    "center",
                  flexWrap:
                    "wrap",
                  color:
                    "#b9b9c1",
                  fontSize:
                    10,
                  fontWeight:
                    850,
                }}
              >
                {possessionLabel ? (
                  <span>
                    {possessionLabel}
                  </span>
                ) : null}

                {downDistanceLabel ? (
                  <span>
                    · {downDistanceLabel}
                  </span>
                ) : null}

                {fieldPositionLabel ? (
                  <span>
                    · {fieldPositionLabel}
                  </span>
                ) : null}
              </div>
            ) : null}

            {row.last_play_text ? (
              <div
                style={{
                  overflow:
                    "hidden",
                  textOverflow:
                    "ellipsis",
                  color:
                    "#8d8d96",
                  fontSize:
                    10,
                  lineHeight:
                    1.35,
                  whiteSpace:
                    "nowrap",
                }}
                title={
                  row.last_play_text
                }
              >
                Last: {row.last_play_text}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div
        style={{
          minWidth:
            96,
          textAlign:
            "right",
        }}
      >
        <div
          style={{
            color:
              ats
                ? toneColor(
                    ats.tone
                  )
                : "#9999a2",
            fontSize:
              11,
            fontWeight:
              1000,
            lineHeight:
              1.3,
          }}
        >
          {ats?.text ??
            "PENDING"}
        </div>
      </div>
    </div>
  );
}


function PickNumber({
  value,
}: {
  value:
    number;
}) {
  return (
    <div
      style={{
        display:
          "grid",
        placeItems:
          "center",
        width:
          30,
        height:
          30,
        borderRadius:
          9,
        background:
          "linear-gradient(135deg, #9d1119, #f26722)",
        color:
          "#fff",
        fontSize:
          12,
        fontWeight:
          1000,
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
  title:
    string;
  description:
    string;
}) {
  return (
    <section
      style={{
        padding:
          22,
        borderRadius:
          16,
        border:
          "1px solid rgba(255,102,0,0.20)",
        background:
          "linear-gradient(135deg, rgba(88,8,12,0.25), #111115 55%)",
      }}
    >
      <h2
        style={{
          margin:
            "0 0 8px",
          color:
            "#fff",
          fontSize:
            22,
        }}
      >
        {title}
      </h2>

      <p
        style={{
          margin:
            0,
          color:
            "#9b9ba4",
          lineHeight:
            1.6,
        }}
      >
        {description}
      </p>
    </section>
  );
}
