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


type PeriodRow = {
  id: number;
  season: number;
  period_number: number;
  starts_at: string;
  ends_at: string;
  status: string;
  finalized_at:
    string | null;
};


type SettingsRow = {
  picks_per_period: number;
  scoring_mode: string;
};


type EntryRow = {
  id: number;
  fantasy_team_id: number;
  entry_name: string;
  user_id: string | null;
  active: boolean;
};


type LeaguePickRow = {
  entry_id: number;
  fantasy_team_id: number;
  entry_name: string;
  user_id: string | null;

  pick_id: number;
  nhl_pickem_game_id: number;
  nhl_game_id: number;

  market_type:
    | "puck_line"
    | "total";

  selected_side:
    | "home"
    | "away"
    | "over"
    | "under";

  snapshot_home_puck_line:
    number | string | null;

  snapshot_away_puck_line:
    number | string | null;

  snapshot_total:
    number | string | null;

  confidence_value:
    number | string | null;

  locked_at:
    string | null;

  result:
    | "pending"
    | "win"
    | "loss"
    | "push"
    | "void"
    | null;

  points_awarded:
    number | string | null;

  start_time: string;

  home_team_id:
    number | null;

  away_team_id:
    number | null;

  home_score:
    number | null;

  away_score:
    number | null;

  game_status:
    string | null;

  period:
    number | null;

  display_clock:
    string | null;

  is_own_entry: boolean;
};


type PeriodResultRow = {
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
    number | string;

  rank:
    number | null;

  is_period_winner:
    boolean;

  finalized_at:
    string | null;
};


type TeamRow = {
  id: number;
  abbreviation: string;
  display_name: string;
  logo_url: string | null;
};


type TeamGroup = {
  entry: EntryRow;
  rows: LeaguePickRow[];
};


function numberValue(
  value:
    | number
    | string
    | null
) {
  if (value === null) {
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


function formatLine(
  value: number
) {
  if (
    Math.abs(value) <
    0.0001
  ) {
    return "PK";
  }

  return value > 0
    ? `+${value}`
    : String(value);
}


function formatStartTime(
  value: string
) {
  return new Date(
    value
  ).toLocaleString(
    undefined,
    {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }
  );
}


function liveLabel(
  row: LeaguePickRow
) {
  const status =
    row.game_status
      ?.toUpperCase() ??
    "";

  if (
    status.includes(
      "FINAL"
    )
  ) {
    return "FINAL";
  }

  const parts =
    ["LIVE"];

  if (row.period) {
    if (row.period <= 3) {
      parts.push(
        `P${row.period}`
      );
    } else {
      parts.push("OT");
    }
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


function resultLabel(
  result:
    LeaguePickRow["result"]
) {
  switch (result) {
    case "win":
      return "WIN";

    case "loss":
      return "LOSS";

    case "push":
      return "PUSH";

    case "void":
      return "VOID";

    default:
      return "PENDING";
  }
}


function resultColor(
  result:
    LeaguePickRow["result"]
) {
  switch (result) {
    case "win":
      return "#55df8a";

    case "loss":
      return "#ff696d";

    case "push":
      return "#ffc46c";

    case "void":
      return "#9999a2";

    default:
      return "#aaaab2";
  }
}


function marketLabel(
  market:
    LeaguePickRow["market_type"]
) {
  return market ===
    "puck_line"
    ? "PUCK LINE"
    : "TOTAL";
}


const NHL_MOBILE_CSS = `
  .g365-nhl-league-picks {
    width: 100%;
    min-width: 0;
    box-sizing: border-box;
  }

  .g365-nhl-league-picks * {
    box-sizing: border-box;
  }

  @media (max-width: 760px) {
    .g365-nhl-league-picks {
      width: 100% !important;
      max-width: 100% !important;
      min-width: 0 !important;
      overflow-x: hidden !important;
      padding: 14px 12px 30px !important;
      gap: 14px !important;
    }

    .g365-nhl-league-picks section,
    .g365-nhl-league-picks article,
    .g365-nhl-league-picks div {
      min-width: 0;
      max-width: 100%;
    }

    .g365-nhl-league-picks h1 {
      font-size: clamp(
        26px,
        8vw,
        34px
      ) !important;
    }

    .g365-nhl-league-picks select {
      width: 100% !important;
      max-width: 100% !important;
    }

    .g365-nhl-team-header {
      grid-template-columns:
        minmax(0,1fr) auto !important;
    }

    .g365-nhl-team-record {
      grid-column: 1 / -1;
      text-align: left !important;
    }

    .g365-nhl-pick-row {
      grid-template-columns:
        32px minmax(0,1fr) !important;
    }

    .g365-nhl-pick-result {
      grid-column: 2;
      text-align: left !important;
    }
  }

  @media (max-width: 430px) {
    .g365-nhl-league-picks {
      padding:
        12px 10px 26px !important;
      gap: 12px !important;
    }

    .g365-nhl-league-picks article,
    .g365-nhl-league-picks section {
      border-radius:
        13px !important;
    }

    .g365-nhl-league-picks button {
      min-height: 42px;
    }
  }
`;


export default function NhlPickemLeaguePicks({
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


  const refreshTimerRef =
    useRef<
      number | null
    >(null);

  const refreshBlockedRef =
    useRef(false);

  const refreshPendingRef =
    useRef(false);

  const initializedPeriodRef =
    useRef<
      number | null
    >(null);


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
    settings,
    setSettings,
  ] =
    useState<
      SettingsRow | null
    >(null);

  const [
    periods,
    setPeriods,
  ] =
    useState<
      PeriodRow[]
    >([]);

  const [
    selectedPeriodId,
    setSelectedPeriodId,
  ] =
    useState<
      number | null
    >(null);

  const [
    entries,
    setEntries,
  ] =
    useState<
      EntryRow[]
    >([]);

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
      PeriodResultRow[]
    >([]);

  const [
    teams,
    setTeams,
  ] =
    useState<
      TeamRow[]
    >([]);

  const [
    collapsedEntryIds,
    setCollapsedEntryIds,
  ] =
    useState<
      Set<number>
    >(
      () => new Set()
    );


  const selectedPeriod =
    useMemo(
      () =>
        periods.find(
          (period) =>
            period.id ===
            selectedPeriodId
        ) ??
        null,
      [
        periods,
        selectedPeriodId,
      ]
    );


  const resultsByEntry =
    useMemo(() => {
      const map =
        new Map<
          number,
          PeriodResultRow
        >();

      for (
        const result
        of results
      ) {
        map.set(
          result.entry_id,
          result
        );
      }

      return map;
    }, [results]);


  const teamById =
    useMemo(() => {
      return new Map<
        number,
        TeamRow
      >(
        teams.map(
          (team) => [
            team.id,
            team,
          ]
        )
      );
    }, [teams]);


  const teamGroups =
    useMemo<
      TeamGroup[]
    >(() => {
      const picksByEntry =
        new Map<
          number,
          LeaguePickRow[]
        >();

      for (
        const row of rows
      ) {
        const current =
          picksByEntry.get(
            row.entry_id
          ) ?? [];

        current.push(row);

        picksByEntry.set(
          row.entry_id,
          current
        );
      }


      return entries
        .map(
          (
            entry
          ): TeamGroup => ({
            entry,
            rows:
              picksByEntry.get(
                entry.id
              ) ?? [],
          })
        )
        .sort(
          (a, b) =>
            a.entry.entry_name.localeCompare(
              b.entry.entry_name
            )
        );
    }, [
      entries,
      rows,
    ]);


  const toggleCollapsed =
    useCallback(
      (
        entryId: number
      ) => {
        setCollapsedEntryIds(
          (current) => {
            const next =
              new Set(
                current
              );

            if (
              next.has(
                entryId
              )
            ) {
              next.delete(
                entryId
              );
            } else {
              next.add(
                entryId
              );
            }

            return next;
          }
        );
      },
      []
    );


  useEffect(() => {
    if (
      selectedPeriodId ===
        null ||
      teamGroups.length ===
        0 ||
      initializedPeriodRef.current ===
        selectedPeriodId
    ) {
      return;
    }

    setCollapsedEntryIds(
      new Set(
        teamGroups.map(
          (group) =>
            group.entry.id
        )
      )
    );

    initializedPeriodRef.current =
      selectedPeriodId;
  }, [
    selectedPeriodId,
    teamGroups,
  ]);


  const loadShell =
    useCallback(
      async () => {
        const [
          settingsResult,
          periodsResult,
          entriesResult,
        ] =
          await Promise.all([
            supabase
              .from(
                "nhl_pickem_settings"
              )
              .select(
                "picks_per_period,scoring_mode"
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
                "id,season,period_number,starts_at,ends_at,status,finalized_at"
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
                "nhl_pickem_entries"
              )
              .select(
                "id,fantasy_team_id,entry_name,user_id,active"
              )
              .eq(
                "league_id",
                leagueId
              )
              .eq(
                "season",
                season
              )
              .eq(
                "active",
                true
              )
              .order(
                "entry_name",
                {
                  ascending:
                    true,
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
          entriesResult.error
        ) {
          throw new Error(
            entriesResult
              .error.message
          );
        }


        const nextPeriods =
          (
            periodsResult.data ??
            []
          ) as PeriodRow[];


        setSettings(
          settingsResult.data as
            | SettingsRow
            | null
        );

        setPeriods(
          nextPeriods
        );

        setEntries(
          (
            entriesResult.data ??
            []
          ) as EntryRow[]
        );


        setSelectedPeriodId(
          (current) => {
            if (
              current !==
                null &&
              nextPeriods.some(
                (period) =>
                  period.id ===
                  current
              )
            ) {
              return current;
            }

            const active =
              nextPeriods.find(
                (period) =>
                  period.status !==
                  "final"
              );

            return (
              active?.id ??
              nextPeriods.at(-1)
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


  const loadPeriodData =
    useCallback(
      async (
        period:
          | PeriodRow
          | null
      ) => {
        if (!period) {
          setRows([]);
          setResults([]);
          setTeams([]);

          return;
        }


        const [
          picksResult,
          resultsResult,
        ] =
          await Promise.all([
            supabase.rpc(
              "get_nhl_pickem_league_picks",
              {
                p_league_id:
                  leagueId,

                p_season:
                  season,

                p_period_number:
                  period.period_number,
              }
            ),

            supabase
              .from(
                "nhl_pickem_period_results"
              )
              .select(
                "entry_id,fantasy_team_id,required_picks,submitted_picks,missing_picks,wins,pushes,losses,ungraded,points,rank,is_period_winner,finalized_at"
              )
              .eq(
                "league_id",
                leagueId
              )
              .eq(
                "nhl_pickem_period_id",
                period.id
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


        const nextRows =
          (
            picksResult.data ??
            []
          ) as LeaguePickRow[];


        setRows(
          nextRows
        );

        setResults(
          (
            resultsResult.data ??
            []
          ) as PeriodResultRow[]
        );


        const teamIds =
          Array.from(
            new Set(
              nextRows
                .flatMap(
                  (row) => [
                    row.home_team_id,
                    row.away_team_id,
                  ]
                )
                .filter(
                  (
                    value
                  ): value is number =>
                    value !== null
                )
            )
          );


        if (
          teamIds.length ===
          0
        ) {
          setTeams([]);
          return;
        }


        const teamsResult =
          await supabase
            .from(
              "nhl_teams"
            )
            .select(
              "id,abbreviation,display_name,logo_url"
            )
            .in(
              "id",
              teamIds
            );


        if (
          teamsResult.error
        ) {
          throw new Error(
            teamsResult
              .error.message
          );
        }


        setTeams(
          (
            teamsResult.data ??
            []
          ) as TeamRow[]
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
      setLoading(true);
      setMessage("");

      try {
        await loadShell();
      } catch (error) {
        if (!active) {
          return;
        }

        setMessage(
          error instanceof Error
            ? error.message
            : "NHL League Picks could not be loaded."
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
  }, [
    loadShell,
  ]);


  useEffect(() => {
    if (loading) {
      return;
    }

    let active =
      true;


    async function run() {
      try {
        await loadPeriodData(
          selectedPeriod
        );
      } catch (error) {
        if (!active) {
          return;
        }

        setMessage(
          error instanceof Error
            ? error.message
            : "NHL League Picks could not be refreshed."
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
        refreshBlockedRef.current
      ) {
        refreshPendingRef.current =
          true;

        return;
      }

      refreshBlockedRef.current =
        true;

      refreshPendingRef.current =
        false;

      void run().finally(
        () => {
          window.setTimeout(
            () => {
              if (!active) {
                return;
              }

              refreshBlockedRef.current =
                false;

              if (
                refreshPendingRef.current
              ) {
                refreshPendingRef.current =
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
        refreshTimerRef.current !==
        null
      ) {
        window.clearTimeout(
          refreshTimerRef.current
        );
      }

      refreshTimerRef.current =
        window.setTimeout(
          () => {
            refreshTimerRef.current =
              null;

            performRefresh();
          },
          200
        );
    }


    void run();


    const channel =
      supabase
        .channel(
          `nhl-pickem-league-picks-${leagueId}-${season}-${selectedPeriod?.id ?? "none"}`
        )

        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table:
              "nhl_pickem_picks",
            filter:
              `league_id=eq.${leagueId}`,
          },
          scheduleRefresh
        )

        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table:
              "nhl_pickem_games",
            filter:
              `league_id=eq.${leagueId}`,
          },
          scheduleRefresh
        )

        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table:
              "nhl_pickem_period_results",
            filter:
              `league_id=eq.${leagueId}`,
          },
          scheduleRefresh
        )

        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table:
              "nhl_pickem_periods",
            filter:
              `league_id=eq.${leagueId}`,
          },
          scheduleRefresh
        )

        .subscribe(
          (status) => {
            if (
              status ===
                "CHANNEL_ERROR" ||
              status ===
                "TIMED_OUT"
            ) {
              console.error(
                "NHL Pick'em League Picks realtime error:",
                status,
                leagueId
              );
            }
          }
        );


    const fallbackTimer =
      window.setInterval(
        performRefresh,
        10_000
      );


    function handleVisibilityChange() {
      if (
        document.visibilityState ===
        "visible"
      ) {
        performRefresh();
      }
    }


    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange
    );


    return () => {
      active = false;

      if (
        refreshTimerRef.current !==
        null
      ) {
        window.clearTimeout(
          refreshTimerRef.current
        );

        refreshTimerRef.current =
          null;
      }

      window.clearInterval(
        fallbackTimer
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
    loadPeriodData,
    loading,
    season,
    selectedPeriod,
    supabase,
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
        Loading NHL League
        Picks…
      </main>
    );
  }


  return (
    <main
      className="g365-nhl-league-picks"
      style={{
        display: "grid",
        gap: 18,
        maxWidth: 1180,
        padding:
          "22px 18px 36px",
      }}
    >
      <style>
        {NHL_MOBILE_CSS}
      </style>


      <section
        style={{
          display: "grid",
          gap: 10,
          padding: 20,
          borderRadius: 18,
          border:
            "1px solid rgba(255,108,33,0.25)",
          background:
            "linear-gradient(135deg, rgba(100,7,13,0.40), rgba(17,17,21,0.98) 58%)",
        }}
      >
        <div
          style={{
            color: "#ff7627",
            fontSize: 12,
            fontWeight: 1000,
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
            margin: 0,
            color: "#fff",
            fontSize:
              "clamp(28px,5vw,42px)",
          }}
        >
          League Picks
        </h1>

        <p
          style={{
            margin: 0,
            maxWidth: 850,
            color: "#a6a6ae",
            lineHeight: 1.6,
          }}
        >
          Every member&apos;s NHL
          selections remain private
          until that individual game
          starts. Once the game
          begins, the database
          automatically reveals that
          puck-line or total selection
          with its frozen G365 line.
        </p>
      </section>


      <section
        style={{
          display: "flex",
          alignItems:
            "center",
          gap: 10,
          flexWrap: "wrap",
          padding:
            "14px 16px",
          borderRadius: 14,
          border:
            "1px solid rgba(255,255,255,0.08)",
          background:
            "#111115",
        }}
      >
        <label
          htmlFor="nhl-league-picks-period"
          style={{
            color: "#bcbcc3",
            fontSize: 13,
            fontWeight: 900,
          }}
        >
          Period
        </label>

        <select
          id="nhl-league-picks-period"
          value={
            selectedPeriodId ??
            ""
          }
          onChange={(
            event
          ) => {
            const value =
              Number(
                event.target.value
              );

            setSelectedPeriodId(
              Number.isFinite(
                value
              )
                ? value
                : null
            );
          }}
          disabled={
            periods.length ===
            0
          }
          style={{
            minWidth: 165,
            padding:
              "10px 12px",
            borderRadius: 10,
            border:
              "1px solid rgba(255,118,39,0.35)",
            background:
              "#09090c",
            color: "#fff",
            fontWeight: 900,
          }}
        >
          {periods.length ===
          0 ? (
            <option value="">
              No period ready
            </option>
          ) : (
            periods.map(
              (period) => (
                <option
                  key={
                    period.id
                  }
                  value={
                    period.id
                  }
                >
                  Period{" "}
                  {
                    period.period_number
                  }
                </option>
              )
            )
          )}
        </select>

        {selectedPeriod ? (
          <div
            style={{
              marginLeft:
                "auto",
              color: "#92929b",
              fontSize: 12,
              fontWeight: 800,
            }}
          >
            Required picks:{" "}
            <strong
              style={{
                color: "#fff",
              }}
            >
              {settings
                ?.picks_per_period ??
                "—"}
            </strong>
          </div>
        ) : null}
      </section>


      {message ? (
        <div
          style={{
            padding:
              "12px 14px",
            borderRadius: 12,
            border:
              "1px solid rgba(255,80,80,0.40)",
            background:
              "rgba(120,0,0,0.20)",
            color: "#ff999c",
          }}
        >
          {message}
        </div>
      ) : null}


      {!selectedPeriod ? (
        <EmptyState
          title="The NHL Pick'em period is not ready yet."
          description="League Picks will appear after an NHL Pick'em period has been initialized."
        />
      ) : teamGroups.length ===
        0 ? (
        <EmptyState
          title={`No Period ${selectedPeriod.period_number} entries are available yet.`}
          description="NHL Pick'em participants will appear here after entries are created."
        />
      ) : (
        <section
          style={{
            display: "grid",
            gap: 14,
          }}
        >
          {teamGroups.map(
            (group) => {
              const {
                entry,
                rows:
                  visibleRows,
              } = group;

              const result =
                resultsByEntry.get(
                  entry.id
                );

              const isViewer =
                viewerFantasyTeamId ===
                entry.fantasy_team_id;

              const isCollapsed =
                collapsedEntryIds.has(
                  entry.id
                );

              const required =
                result
                  ?.required_picks ??
                settings
                  ?.picks_per_period ??
                0;


              /*
               * For another member we
               * deliberately do NOT
               * infer submitted picks
               * from hidden database
               * rows.
               */
              const countText =
                isViewer
                  ? `${visibleRows.length} / ${required} picks submitted`
                  : result
                        ?.finalized_at
                    ? `${result.submitted_picks} / ${required} picks submitted`
                    : `${visibleRows.length} picks revealed`;


              return (
                <article
                  key={
                    entry.id
                  }
                  style={{
                    overflow:
                      "hidden",
                    borderRadius: 16,
                    border:
                      isViewer
                        ? "1px solid rgba(255,111,34,0.52)"
                        : "1px solid rgba(255,255,255,0.08)",
                    background:
                      isViewer
                        ? "linear-gradient(145deg,rgba(96,8,12,0.30),#101014 55%)"
                        : "#101014",
                  }}
                >
                  <div
                    className="g365-nhl-team-header"
                    style={{
                      display:
                        "grid",
                      gridTemplateColumns:
                        "minmax(0,1fr) auto auto",
                      gap: 14,
                      alignItems:
                        "center",
                      padding: 15,
                      borderBottom:
                        "1px solid rgba(255,255,255,0.06)",
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
                            fontSize: 18,
                            whiteSpace:
                              "nowrap",
                          }}
                        >
                          {
                            entry.entry_name
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
                              fontSize: 10,
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
                          marginTop: 5,
                          color:
                            "#909099",
                          fontSize: 12,
                        }}
                      >
                        {countText}

                        {!isViewer &&
                        !result?.finalized_at ? (
                          <>
                            {" · "}
                            Unstarted picks
                            remain private
                          </>
                        ) : null}
                      </div>
                    </div>


                    <div
                      className="g365-nhl-team-record"
                    >
                      <RecordBox
                        result={
                          result
                        }
                        scoringMode={
                          settings
                            ?.scoring_mode ??
                          "record_only"
                        }
                      />
                    </div>


                    <button
                      type="button"
                      onClick={() =>
                        toggleCollapsed(
                          entry.id
                        )
                      }
                      aria-expanded={
                        !isCollapsed
                      }
                      aria-label={
                        isCollapsed
                          ? `Expand ${entry.entry_name}`
                          : `Minimize ${entry.entry_name}`
                      }
                      title={
                        isCollapsed
                          ? "Open team picks"
                          : "Minimize team picks"
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
                        borderRadius: 10,
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
                        fontSize: 20,
                        fontWeight:
                          1000,
                        lineHeight: 1,
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
                        gap: 9,
                        padding: 13,
                      }}
                    >
                      {visibleRows.length ===
                      0 ? (
                        <div
                          style={{
                            padding:
                              "13px 14px",
                            borderRadius:
                              11,
                            border:
                              "1px solid rgba(255,255,255,0.06)",
                            background:
                              "rgba(255,255,255,0.025)",
                            color:
                              "#85858e",
                            fontSize: 13,
                          }}
                        >
                          {isViewer
                            ? "No picks submitted yet."
                            : "🔒 No picks have been revealed yet. Selections remain private until their NHL games begin."}
                        </div>
                      ) : (
                        visibleRows.map(
                          (
                            row,
                            index
                          ) => (
                            <PickRow
                              key={
                                row.pick_id
                              }
                              row={
                                row
                              }
                              pickNumber={
                                index +
                                1
                              }
                              teamById={
                                teamById
                              }
                              confidenceMode={
                                settings
                                  ?.scoring_mode ===
                                "confidence"
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
  scoringMode,
}: {
  result:
    | PeriodResultRow
    | undefined;

  scoringMode: string;
}) {
  if (!result) {
    return (
      <div
        style={{
          textAlign:
            "right",
        }}
      >
        <div
          style={{
            color: "#fff",
            fontSize: 18,
            fontWeight: 1000,
          }}
        >
          0-0
        </div>

        <div
          style={{
            marginTop: 3,
            color: "#777780",
            fontSize: 10,
            fontWeight: 900,
            letterSpacing:
              "0.06em",
          }}
        >
          PERIOD ACTIVE
        </div>
      </div>
    );
  }


  return (
    <div
      style={{
        textAlign:
          "right",
      }}
    >
      <div
        style={{
          color: "#fff",
          fontSize: 18,
          fontWeight: 1000,
          whiteSpace:
            "nowrap",
        }}
      >
        {result.wins}-
        {result.losses}

        {result.pushes > 0
          ? `-${result.pushes}`
          : ""}
      </div>

      <div
        style={{
          marginTop: 3,
          color:
            result.finalized_at
              ? "#55df8a"
              : "#92929b",
          fontSize: 10,
          fontWeight: 900,
          letterSpacing:
            "0.05em",
          whiteSpace:
            "nowrap",
        }}
      >
        {result.finalized_at
          ? result.rank
            ? `FINAL · #${result.rank}`
            : "FINAL"
          : result.ungraded > 0
            ? `${result.ungraded} REMAINING`
            : "PERIOD ACTIVE"}
      </div>

      {scoringMode !==
      "record_only" ? (
        <div
          style={{
            marginTop: 3,
            color: "#ff9b59",
            fontSize: 10,
            fontWeight: 900,
          }}
        >
          {numberValue(
            result.points
          ) ?? 0}{" "}
          PTS
        </div>
      ) : null}
    </div>
  );
}


function PickRow({
  row,
  pickNumber,
  teamById,
  confidenceMode,
}: {
  row: LeaguePickRow;
  pickNumber: number;

  teamById: Map<
    number,
    TeamRow
  >;

  confidenceMode:
    boolean;
}) {
  const homeTeam =
    row.home_team_id
      ? teamById.get(
          row.home_team_id
        ) ??
        null
      : null;

  const awayTeam =
    row.away_team_id
      ? teamById.get(
          row.away_team_id
        ) ??
        null
      : null;


  const started =
    new Date(
      row.start_time
    ).getTime() <=
    Date.now();


  const statusUpper =
    row.game_status
      ?.toUpperCase() ??
    "";

  const isFinal =
    statusUpper.includes(
      "FINAL"
    );


  let pickDescription =
    "";

  if (
    row.market_type ===
    "puck_line"
  ) {
    const selectedTeam =
      row.selected_side ===
      "home"
        ? homeTeam
        : awayTeam;

    const line =
      row.selected_side ===
      "home"
        ? numberValue(
            row.snapshot_home_puck_line
          )
        : numberValue(
            row.snapshot_away_puck_line
          );

    pickDescription =
      `${selectedTeam?.display_name ?? "Team"} ${
        line !== null
          ? formatLine(line)
          : ""
      }`;
  } else {
    const total =
      numberValue(
        row.snapshot_total
      );

    pickDescription =
      `${row.selected_side.toUpperCase()} ${
        total !== null
          ? total.toFixed(1)
          : ""
      }`;
  }


  const confidence =
    numberValue(
      row.confidence_value
    );


  return (
    <div
      className="g365-nhl-pick-row"
      style={{
        display: "grid",
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
        value={
          pickNumber
        }
      />


      <div
        style={{
          minWidth: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 7,
            alignItems:
              "center",
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              color: "#ff9b59",
              fontSize: 9,
              fontWeight: 1000,
              letterSpacing:
                "0.08em",
            }}
          >
            {marketLabel(
              row.market_type
            )}
          </span>

          {isFinal ? (
            <span
              style={{
                color: "#b6b6be",
                fontSize: 10,
                fontWeight: 900,
              }}
            >
              FINAL
            </span>
          ) : started ? (
            <span
              style={{
                color: "#fff",
                fontSize: 10,
                fontWeight: 900,
              }}
            >
              {liveLabel(row)}
            </span>
          ) : null}

          {row.is_own_entry ? (
            <span
              style={{
                color: "#85858e",
                fontSize: 9,
                fontWeight: 900,
              }}
            >
              YOUR PICK
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
          {pickDescription}
        </div>


        <div
          style={{
            marginTop: 3,
            color: "#85858e",
            fontSize: 11,
          }}
        >
          {awayTeam
            ?.abbreviation ??
            "AWAY"}{" "}
          {row.away_score ??
            ""}
          {" @ "}
          {homeTeam
            ?.abbreviation ??
            "HOME"}{" "}
          {row.home_score ??
            ""}

          {!started
            ? ` · ${formatStartTime(
                row.start_time
              )}`
            : ""}
        </div>


        {confidenceMode &&
        confidence !==
          null ? (
          <div
            style={{
              marginTop: 4,
              color: "#ffb35c",
              fontSize: 10,
              fontWeight: 900,
            }}
          >
            CONFIDENCE:{" "}
            {confidence}
          </div>
        ) : null}
      </div>


      <div
        className="g365-nhl-pick-result"
        style={{
          minWidth: 92,
          textAlign:
            "right",
        }}
      >
        <div
          style={{
            color:
              resultColor(
                row.result
              ),
            fontSize: 11,
            fontWeight: 1000,
            lineHeight: 1.3,
          }}
        >
          {resultLabel(
            row.result
          )}
        </div>

        {row.result &&
        row.result !==
          "pending" &&
        numberValue(
          row.points_awarded
        ) !== null ? (
          <div
            style={{
              marginTop: 3,
              color: "#909099",
              fontSize: 10,
              fontWeight: 850,
            }}
          >
            {numberValue(
              row.points_awarded
            )}{" "}
            pts
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
        display: "grid",
        placeItems:
          "center",
        width: 30,
        height: 30,
        borderRadius: 9,
        background:
          "linear-gradient(135deg,#9d1119,#f26722)",
        color: "#fff",
        fontSize: 12,
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
        padding: 22,
        borderRadius: 16,
        border:
          "1px solid rgba(255,102,0,0.20)",
        background:
          "linear-gradient(135deg,rgba(88,8,12,0.25),#111115 55%)",
      }}
    >
      <h2
        style={{
          margin:
            "0 0 8px",
          color: "#fff",
          fontSize: 22,
        }}
      >
        {title}
      </h2>

      <p
        style={{
          margin: 0,
          color: "#9b9ba4",
          lineHeight: 1.6,
        }}
      >
        {description}
      </p>
    </section>
  );
}