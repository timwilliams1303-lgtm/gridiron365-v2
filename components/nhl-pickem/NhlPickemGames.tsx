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
};

type PeriodRow = {
  id: number;
  period_number: number;
  status: string;
  starts_at: string;
  ends_at: string;
};

type SettingsRow = {
  market_mode: string;
  minimum_source_books: number;
};

type ContestGameRow = {
  id: number;
  nhl_pickem_period_id: number;
  nhl_game_id: number;

  eligible: boolean;
  excluded_reason: string | null;

  official_home_puck_line:
    | number
    | string
    | null;

  official_away_puck_line:
    | number
    | string
    | null;

  official_total:
    | number
    | string
    | null;

  puck_line_source_count: number;
  total_source_count: number;

  freeze_scheduled_at:
    | string
    | null;

  frozen_at:
    | string
    | null;

  is_frozen: boolean;

  final_home_score:
    | number
    | null;

  final_away_score:
    | number
    | null;

  graded_at:
    | string
    | null;

  market_mode_at_freeze:
    | string
    | null;

  line_status: string;

  line_finalized_at:
    | string
    | null;
};

type NhlGameRow = {
  id: number;
  start_time: string;

  away_team_id:
    | number
    | null;

  home_team_id:
    | number
    | null;

  away_score: number;
  home_score: number;

  status_type:
    | string
    | null;

  status_name:
    | string
    | null;

  status_detail:
    | string
    | null;

  period:
    | number
    | null;

  display_clock:
    | string
    | null;

  status_completed: boolean;
  is_overtime: boolean;
  is_shootout: boolean;

  venue_name:
    | string
    | null;
};

type TeamRow = {
  id: number;
  abbreviation: string;
  display_name: string;
  logo_url:
    | string
    | null;
};

type DisplayGame = {
  contest: ContestGameRow;
  game: NhlGameRow;
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

function formatNumber(
  value: number
) {
  return Number.isInteger(
    value
  )
    ? String(value)
    : value
        .toFixed(2)
        .replace(
          /0+$/,
          ""
        )
        .replace(
          /\.$/,
          ""
        );
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
    ? `+${formatNumber(
        value
      )}`
    : formatNumber(
        value
      );
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

function formatShortTime(
  value: string
) {
  return new Date(
    value
  ).toLocaleString(
    undefined,
    {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }
  );
}

function liveStatus(
  game: NhlGameRow
) {
  if (
    game.status_completed
  ) {
    if (
      game.is_shootout
    ) {
      return "FINAL · SO";
    }

    if (
      game.is_overtime
    ) {
      return "FINAL · OT";
    }

    return "FINAL";
  }

  const started =
    new Date(
      game.start_time
    ).getTime() <=
    Date.now();

  if (!started) {
    return formatStartTime(
      game.start_time
    );
  }

  const parts =
    ["LIVE"];

  if (
    game.period !== null
  ) {
    if (
      game.period <= 3
    ) {
      parts.push(
        `P${game.period}`
      );
    } else if (
      game.is_shootout
    ) {
      parts.push("SO");
    } else {
      parts.push("OT");
    }
  }

  if (
    game.display_clock
  ) {
    parts.push(
      game.display_clock
    );
  }

  return parts.join(
    " · "
  );
}

function marketModeLabel(
  value: string
) {
  if (
    value ===
    "puck_line_only"
  ) {
    return "Puck Line";
  }

  if (
    value ===
    "total_only"
  ) {
    return "Game Total";
  }

  return "Puck Line + O/U";
}

function showsPuckLine(
  value: string
) {
  return value !==
    "total_only";
}

function showsTotal(
  value: string
) {
  return value !==
    "puck_line_only";
}

function lineStatusText(
  contest:
    ContestGameRow
) {
  if (
    !contest.eligible ||
    contest.line_status ===
      "excluded"
  ) {
    return "EXCLUDED";
  }

  if (
    contest.is_frozen
  ) {
    return "G365 LINES FROZEN";
  }

  return "G365 LINES PENDING";
}

const MOBILE_CSS = `
  .g365-nhl-games-page {
    width: 100%;
    min-width: 0;
    box-sizing: border-box;
  }

  .g365-nhl-games-page * {
    box-sizing: border-box;
  }

  .g365-nhl-boxscore-grid {
    display: grid;
    grid-template-columns:
      44px
      minmax(0, 1fr)
      96px
      62px;
    gap: 10px;
    align-items: center;
  }

  .g365-nhl-boxscore-header {
    display: grid;
    grid-template-columns:
      44px
      minmax(0, 1fr)
      96px
      62px;
    gap: 10px;
    align-items: center;
  }

  .g365-nhl-total-row {
    display: grid;
    grid-template-columns:
      minmax(0, 1fr)
      96px
      62px;
    gap: 10px;
    align-items: center;
  }

  @media (max-width: 760px) {
    .g365-nhl-games-page {
      width: 100% !important;
      max-width: 100% !important;
      min-width: 0 !important;
      overflow-x: hidden !important;
      padding: 14px 12px 30px !important;
      gap: 14px !important;
    }

    .g365-nhl-games-page section,
    .g365-nhl-games-page article,
    .g365-nhl-games-page div {
      min-width: 0;
      max-width: 100%;
    }

    .g365-nhl-games-page h1 {
      font-size:
        clamp(
          26px,
          8vw,
          34px
        ) !important;
      line-height:
        1.08 !important;
    }

    .g365-nhl-games-page select {
      width: 100% !important;
      max-width: 100% !important;
    }

    .g365-nhl-boxscore-grid,
    .g365-nhl-boxscore-header {
      grid-template-columns:
        36px
        minmax(0, 1fr)
        74px
        48px !important;

      gap: 7px !important;
    }

    .g365-nhl-total-row {
      grid-template-columns:
        minmax(0, 1fr)
        74px
        48px !important;

      gap: 7px !important;
    }

    .g365-nhl-team-name {
      font-size:
        13px !important;
    }

    .g365-nhl-team-logo {
      width:
        32px !important;
      height:
        32px !important;
    }

    .g365-nhl-line-value {
      font-size:
        12px !important;
    }

    .g365-nhl-score-value {
      font-size:
        19px !important;
    }
  }

  @media (max-width: 430px) {
    .g365-nhl-games-page {
      padding:
        12px 10px 26px !important;
      gap:
        12px !important;
    }

    .g365-nhl-games-page article,
    .g365-nhl-games-page section {
      border-radius:
        13px !important;
    }

    .g365-nhl-boxscore-grid,
    .g365-nhl-boxscore-header {
      grid-template-columns:
        30px
        minmax(0, 1fr)
        68px
        42px !important;

      gap:
        6px !important;
    }

    .g365-nhl-total-row {
      grid-template-columns:
        minmax(0, 1fr)
        68px
        42px !important;

      gap:
        6px !important;
    }

    .g365-nhl-team-logo {
      width:
        28px !important;
      height:
        28px !important;
    }

    .g365-nhl-team-full-name {
      display:
        none !important;
    }

    .g365-nhl-team-abbr {
      display:
        inline !important;
    }
  }
`;

export default function NhlPickemGames({
  leagueId,
  season,
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
    settings,
    setSettings,
  ] =
    useState<
      SettingsRow | null
    >(null);

  const [
    contests,
    setContests,
  ] =
    useState<
      ContestGameRow[]
    >([]);

  const [
    nhlGames,
    setNhlGames,
  ] =
    useState<
      NhlGameRow[]
    >([]);

  const [
    teams,
    setTeams,
  ] =
    useState<
      TeamRow[]
    >([]);

  const selectedPeriod =
    useMemo(
      () =>
        periods.find(
          (row) =>
            row.id ===
            selectedPeriodId
        ) ??
        null,
      [
        periods,
        selectedPeriodId,
      ]
    );

  const gameById =
    useMemo(
      () =>
        new Map<
          number,
          NhlGameRow
        >(
          nhlGames.map(
            (game) => [
              game.id,
              game,
            ]
          )
        ),
      [
        nhlGames,
      ]
    );

  const teamById =
    useMemo(
      () =>
        new Map<
          number,
          TeamRow
        >(
          teams.map(
            (team) => [
              team.id,
              team,
            ]
          )
        ),
      [
        teams,
      ]
    );

  const displayGames =
    useMemo<
      DisplayGame[]
    >(
      () => {
        const rows:
          DisplayGame[] =
          [];

        for (
          const contest
          of contests
        ) {
          const game =
            gameById.get(
              contest.nhl_game_id
            );

          if (!game) {
            continue;
          }

          rows.push({
            contest,
            game,
          });
        }

        return rows.sort(
          (a, b) =>
            new Date(
              a.game.start_time
            ).getTime() -
            new Date(
              b.game.start_time
            ).getTime()
        );
      },
      [
        contests,
        gameById,
      ]
    );

  const effectiveMarketMode =
    settings?.market_mode ??
    "puck_line_and_total";

  const loadPeriods =
    useCallback(
      async () => {
        const [
          settingsResult,
          periodsResult,
        ] =
          await Promise.all([
            supabase
              .from(
                "nhl_pickem_settings"
              )
              .select(
                "market_mode,minimum_source_books"
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
                "id,period_number,status,starts_at,ends_at"
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

        const rows =
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
          rows
        );

        setSelectedPeriodId(
          (current) => {
            if (
              current !==
                null &&
              rows.some(
                (row) =>
                  row.id ===
                  current
              )
            ) {
              return current;
            }

            const active =
              rows.find(
                (row) =>
                  row.status !==
                  "final"
              );

            return (
              active?.id ??
              rows.at(-1)
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

  const loadGames =
    useCallback(
      async (
        periodId:
          number | null
      ) => {
        if (
          periodId === null
        ) {
          setContests([]);
          setNhlGames([]);
          setTeams([]);
          return;
        }

        const contestsResult =
          await supabase
            .from(
              "nhl_pickem_games"
            )
            .select(
              "id,nhl_pickem_period_id,nhl_game_id,eligible,excluded_reason,official_home_puck_line,official_away_puck_line,official_total,puck_line_source_count,total_source_count,freeze_scheduled_at,frozen_at,is_frozen,final_home_score,final_away_score,graded_at,market_mode_at_freeze,line_status,line_finalized_at"
            )
            .eq(
              "league_id",
              leagueId
            )
            .eq(
              "nhl_pickem_period_id",
              periodId
            );

        if (
          contestsResult.error
        ) {
          throw new Error(
            contestsResult
              .error.message
          );
        }

        const nextContests =
          (
            contestsResult.data ??
            []
          ) as ContestGameRow[];

        setContests(
          nextContests
        );

        const gameIds =
          Array.from(
            new Set(
              nextContests.map(
                (row) =>
                  row.nhl_game_id
              )
            )
          );

        if (
          gameIds.length ===
          0
        ) {
          setNhlGames([]);
          setTeams([]);
          return;
        }

        const gamesResult =
          await supabase
            .from(
              "nhl_games"
            )
            .select(
              "id,start_time,away_team_id,home_team_id,away_score,home_score,status_type,status_name,status_detail,period,display_clock,status_completed,is_overtime,is_shootout,venue_name"
            )
            .in(
              "id",
              gameIds
            );

        if (
          gamesResult.error
        ) {
          throw new Error(
            gamesResult
              .error.message
          );
        }

        const nextGames =
          (
            gamesResult.data ??
            []
          ) as NhlGameRow[];

        setNhlGames(
          nextGames
        );

        const teamIds =
          Array.from(
            new Set(
              nextGames
                .flatMap(
                  (game) => [
                    game.away_team_id,
                    game.home_team_id,
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
        await loadPeriods();
      } catch (error) {
        if (!active) {
          return;
        }

        setMessage(
          error instanceof Error
            ? error.message
            : "NHL Pick'em periods could not be loaded."
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
    loadPeriods,
  ]);

  useEffect(() => {
    if (loading) {
      return;
    }

    let active =
      true;

    async function run() {
      try {
        await loadGames(
          selectedPeriodId
        );
      } catch (error) {
        if (!active) {
          return;
        }

        setMessage(
          error instanceof Error
            ? error.message
            : "NHL Pick'em games could not be loaded."
        );
      }
    }

    void run();

    const timer =
      window.setInterval(
        () => {
          void run();
        },
        10_000
      );

    return () => {
      active = false;

      window.clearInterval(
        timer
      );
    };
  }, [
    loadGames,
    loading,
    selectedPeriodId,
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
        Loading NHL Pick&apos;em
        games…
      </main>
    );
  }

  return (
    <main
      className="g365-nhl-games-page"
      style={{
        display:
          "grid",
        gap: 18,
        padding:
          "22px 18px 36px",
        maxWidth:
          1180,
      }}
    >
      <style>
        {MOBILE_CSS}
      </style>

      <section
        style={{
          padding: 20,
          borderRadius:
            18,
          border:
            "1px solid rgba(255,108,33,0.25)",
          background:
            "linear-gradient(135deg,rgba(100,7,13,0.38),rgba(17,17,21,0.98) 58%)",
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
            color: "#fff",
            fontSize:
              "clamp(28px,5vw,42px)",
          }}
        >
          Games
        </h1>

        <p
          style={{
            margin: 0,
            color:
              "#a3a3ab",
            lineHeight:
              1.55,
          }}
        >
          Live NHL box scores with
          aligned G365 puck lines,
          scores and official
          over/under totals.
        </p>
      </section>

      <section
        style={{
          display:
            "flex",
          alignItems:
            "center",
          gap: 10,
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
          htmlFor="nhl-games-period"
          style={{
            color:
              "#bcbcc3",
            fontSize: 13,
            fontWeight:
              900,
          }}
        >
          Period
        </label>

        <select
          id="nhl-games-period"
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
          style={{
            minWidth:
              165,
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
          {periods.map(
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
          )}
        </select>

        {selectedPeriod ? (
          <div
            style={{
              marginLeft:
                "auto",
              display:
                "flex",
              gap: 10,
              alignItems:
                "center",
              flexWrap:
                "wrap",
            }}
          >
            <span
              style={{
                color:
                  "#909099",
                fontSize:
                  11,
                fontWeight:
                  900,
              }}
            >
              {selectedPeriod.status
                .replaceAll(
                  "_",
                  " "
                )
                .toUpperCase()}
            </span>

            <span
              style={{
                color:
                  "#ff9b59",
                fontSize:
                  11,
                fontWeight:
                  900,
              }}
            >
              {marketModeLabel(
                effectiveMarketMode
              )}
            </span>
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

      {!selectedPeriod ? (
        <EmptyState
          title="The NHL slate is not ready yet."
          description="An NHL Pick'em period must be initialized before games can appear here."
        />
      ) : displayGames.length ===
        0 ? (
        <EmptyState
          title={`No Period ${selectedPeriod.period_number} games are loaded yet.`}
          description="The NHL Pick'em lifecycle has not populated this period's game slate yet."
        />
      ) : (
        <section
          style={{
            display:
              "grid",
            gap: 12,
          }}
        >
          {displayGames.map(
            ({
              contest,
              game,
            }) => {
              const awayTeam =
                game.away_team_id !==
                null
                  ? teamById.get(
                      game.away_team_id
                    ) ??
                    null
                  : null;

              const homeTeam =
                game.home_team_id !==
                null
                  ? teamById.get(
                      game.home_team_id
                    ) ??
                    null
                  : null;

              const marketMode =
                contest.market_mode_at_freeze ??
                effectiveMarketMode;

              const showPuck =
                showsPuckLine(
                  marketMode
                );

              const showTotalMarket =
                showsTotal(
                  marketMode
                );

              const awayLine =
                numberValue(
                  contest.official_away_puck_line
                );

              const homeLine =
                numberValue(
                  contest.official_home_puck_line
                );

              const total =
                numberValue(
                  contest.official_total
                );

              return (
                <article
                  key={
                    contest.id
                  }
                  style={{
                    overflow:
                      "hidden",
                    borderRadius:
                      16,
                    border:
                      contest.eligible
                        ? "1px solid rgba(255,255,255,0.09)"
                        : "1px solid rgba(255,80,80,0.20)",
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
                        "10px 14px",
                      borderBottom:
                        "1px solid rgba(255,255,255,0.06)",
                      background:
                        "rgba(0,0,0,0.24)",
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
                      <span
                        style={{
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
                        NHL
                      </span>

                      <span
                        style={{
                          color:
                            contest.is_frozen
                              ? "#55df8a"
                              : contest.eligible
                                ? "#ffc46c"
                                : "#ff777a",
                          fontSize:
                            10,
                          fontWeight:
                            900,
                        }}
                      >
                        {lineStatusText(
                          contest
                        )}
                      </span>
                    </div>

                    <span
                      style={{
                        color:
                          "#fff",
                        fontSize:
                          12,
                        fontWeight:
                          1000,
                      }}
                    >
                      {liveStatus(
                        game
                      )}
                    </span>
                  </div>

                  <div
                    style={{
                      padding:
                        "12px 14px 14px",
                    }}
                  >
                    <div
                      className="g365-nhl-boxscore-header"
                      style={{
                        padding:
                          "0 0 6px",
                        borderBottom:
                          "1px solid rgba(255,255,255,0.06)",
                      }}
                    >
                      <div />

                      <div
                        style={{
                          color:
                            "#6f6f78",
                          fontSize:
                            9,
                          fontWeight:
                            1000,
                          letterSpacing:
                            "0.08em",
                        }}
                      >
                        TEAM
                      </div>

                      <div
                        style={{
                          textAlign:
                            "right",
                          color:
                            "#6f6f78",
                          fontSize:
                            9,
                          fontWeight:
                            1000,
                          letterSpacing:
                            "0.08em",
                        }}
                      >
                        {showPuck
                          ? "PUCK LINE"
                          : ""}
                      </div>

                      <div
                        style={{
                          textAlign:
                            "right",
                          color:
                            "#6f6f78",
                          fontSize:
                            9,
                          fontWeight:
                            1000,
                          letterSpacing:
                            "0.08em",
                        }}
                      >
                        SCORE
                      </div>
                    </div>

                    <BoxScoreTeamRow
                      team={
                        awayTeam
                      }
                      puckLine={
                        showPuck
                          ? awayLine
                          : null
                      }
                      score={
                        game.away_score
                      }
                    />

                    <BoxScoreTeamRow
                      team={
                        homeTeam
                      }
                      puckLine={
                        showPuck
                          ? homeLine
                          : null
                      }
                      score={
                        game.home_score
                      }
                    />

                    {showTotalMarket ? (
                      <div
                        className="g365-nhl-total-row"
                        style={{
                          marginTop:
                            8,
                          paddingTop:
                            9,
                          borderTop:
                            "1px solid rgba(255,255,255,0.07)",
                        }}
                      >
                        <div
                          style={{
                            display:
                              "flex",
                            alignItems:
                              "center",
                            gap: 8,
                            flexWrap:
                              "wrap",
                          }}
                        >
                          <span
                            style={{
                              color:
                                "#ff9b59",
                              fontSize:
                                10,
                              fontWeight:
                                1000,
                            }}
                          >
                            G365 TOTAL
                          </span>

                          <span
                            style={{
                              color:
                                "#777780",
                              fontSize:
                                9,
                            }}
                          >
                            {
                              contest.total_source_count
                            }{" "}
                            sportsbook
                            {contest.total_source_count ===
                            1
                              ? ""
                              : "s"}
                          </span>
                        </div>

                        <div
                          className="g365-nhl-line-value"
                          style={{
                            textAlign:
                              "right",
                            color:
                              total ===
                              null
                                ? "#777780"
                                : "#fff",
                            fontSize:
                              13,
                            fontWeight:
                              1000,
                            fontVariantNumeric:
                              "tabular-nums",
                            whiteSpace:
                              "nowrap",
                          }}
                        >
                          {total ===
                          null
                            ? "O/U —"
                            : `O/U ${formatNumber(
                                total
                              )}`}
                        </div>

                        <div />
                      </div>
                    ) : null}

                    <div
                      style={{
                        display:
                          "flex",
                        alignItems:
                          "center",
                        justifyContent:
                          "space-between",
                        gap: 10,
                        flexWrap:
                          "wrap",
                        marginTop:
                          10,
                        paddingTop:
                          9,
                        borderTop:
                          "1px solid rgba(255,255,255,0.05)",
                      }}
                    >
                      <div
                        style={{
                          display:
                            "flex",
                          alignItems:
                            "center",
                          gap: 8,
                          flexWrap:
                            "wrap",
                        }}
                      >
                        {showPuck ? (
                          <span
                            style={{
                              color:
                                "#777780",
                              fontSize:
                                9,
                            }}
                          >
                            Puck line:{" "}
                            {
                              contest.puck_line_source_count
                            }{" "}
                            sportsbook
                            {contest.puck_line_source_count ===
                            1
                              ? ""
                              : "s"}
                          </span>
                        ) : null}

                        {contest.frozen_at ? (
                          <span
                            style={{
                              color:
                                "#777780",
                              fontSize:
                                9,
                            }}
                          >
                            Frozen{" "}
                            {formatShortTime(
                              contest.frozen_at
                            )}
                          </span>
                        ) : contest.freeze_scheduled_at &&
                          contest.eligible ? (
                          <span
                            style={{
                              color:
                                "#777780",
                              fontSize:
                                9,
                            }}
                          >
                            Freeze{" "}
                            {formatShortTime(
                              contest.freeze_scheduled_at
                            )}
                          </span>
                        ) : null}
                      </div>

                      {game.venue_name ? (
                        <span
                          style={{
                            color:
                              "#66666f",
                            fontSize:
                              9,
                          }}
                        >
                          {
                            game.venue_name
                          }
                        </span>
                      ) : null}
                    </div>

                    {!contest.eligible &&
                    contest.excluded_reason ? (
                      <div
                        style={{
                          marginTop:
                            10,
                          padding:
                            "8px 10px",
                          borderRadius:
                            9,
                          border:
                            "1px solid rgba(255,80,80,0.20)",
                          background:
                            "rgba(120,0,0,0.12)",
                          color:
                            "#ff999c",
                          fontSize:
                            10,
                        }}
                      >
                        Excluded from
                        Pick&apos;em:{" "}
                        {
                          contest.excluded_reason
                        }
                      </div>
                    ) : null}
                  </div>
                </article>
              );
            }
          )}
        </section>
      )}
    </main>
  );
}

function BoxScoreTeamRow({
  team,
  puckLine,
  score,
}: {
  team:
    | TeamRow
    | null;

  puckLine:
    | number
    | null;

  score:
    | number
    | null;
}) {
  return (
    <div
      className="g365-nhl-boxscore-grid"
      style={{
        minHeight:
          50,
        padding:
          "7px 0",
        borderBottom:
          "1px solid rgba(255,255,255,0.035)",
      }}
    >
      <div
        className="g365-nhl-team-logo"
        style={{
          width: 36,
          height: 36,
          display:
            "grid",
          placeItems:
            "center",
          overflow:
            "hidden",
        }}
      >
        {team?.logo_url ? (
          <img
            src={
              team.logo_url
            }
            alt=""
            width={34}
            height={34}
            style={{
              width: 34,
              height: 34,
              objectFit:
                "contain",
            }}
          />
        ) : (
          <span
            style={{
              color:
                "#777780",
              fontSize:
                9,
              fontWeight:
                900,
            }}
          >
            NHL
          </span>
        )}
      </div>

      <div
        style={{
          minWidth: 0,
        }}
      >
        <div
          className="g365-nhl-team-name"
          style={{
            color:
              "#fff",
            fontSize:
              14,
            fontWeight:
              1000,
            lineHeight:
              1.2,
          }}
        >
          <span className="g365-nhl-team-full-name">
            {team
              ?.display_name ??
              "NHL Team"}
          </span>

          <span
            className="g365-nhl-team-abbr"
            style={{
              display:
                "none",
            }}
          >
            {team
              ?.abbreviation ??
              "NHL"}
          </span>
        </div>

        <div
          style={{
            marginTop: 3,
            color:
              "#777780",
            fontSize:
              9,
            fontWeight:
              900,
          }}
        >
          {team
            ?.abbreviation ??
            ""}
        </div>
      </div>

      <div
        className="g365-nhl-line-value"
        style={{
          textAlign:
            "right",
          color:
            puckLine ===
            null
              ? "#777780"
              : "#ffb16f",
          fontSize:
            13,
          fontWeight:
            1000,
          fontVariantNumeric:
            "tabular-nums",
          whiteSpace:
            "nowrap",
        }}
      >
        {puckLine ===
        null
          ? "—"
          : formatLine(
              puckLine
            )}
      </div>

      <div
        className="g365-nhl-score-value"
        style={{
          textAlign:
            "right",
          color:
            "#fff",
          fontSize:
            21,
          fontWeight:
            1000,
          fontVariantNumeric:
            "tabular-nums",
          whiteSpace:
            "nowrap",
        }}
      >
        {score ?? "—"}
      </div>
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
          color:
            "#fff",
          fontWeight:
            1000,
        }}
      >
        {title}
      </div>

      <div
        style={{
          marginTop: 6,
          color:
            "#92929b",
          lineHeight:
            1.5,
        }}
      >
        {description}
      </div>
    </section>
  );
}