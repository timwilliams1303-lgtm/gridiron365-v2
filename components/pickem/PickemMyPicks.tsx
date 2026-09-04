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
  fantasyTeamId: number;
  teamName: string;
};


type PickLockMode =
  | "per_game"
  | "full_card";


type FootballScope =
  | "college_nfl"
  | "college_only"
  | "nfl_only";


type PickMarketMode =
  | "spread_only"
  | "total_only"
  | "spread_total";


type PickMarketType =
  | "spread"
  | "total";


type SettingsRow = {
  football_scope: FootballScope;
  picks_per_week: number;
  pick_lock_mode: PickLockMode;
  pick_market_mode:
    PickMarketMode;
};


type WeekRow = {
  id: number;
  season: number;
  week: number;
  status: string;
  required_picks: number;
  line_day_at: string | null;
  finalize_not_before: string | null;
};


type GameRow = {
  id: number;
  pickem_week_id: number;
  sport: "ncaaf" | "nfl";
  kickoff_at: string;
  away_team_name: string;
  away_team_abbreviation: string | null;
  home_team_name: string;
  home_team_abbreviation: string | null;
  away_score: number | null;
  home_score: number | null;
  status_detail: string | null;
  period: number | null;
  display_clock: string | null;
  is_started: boolean;
  is_final: boolean;
  is_eligible: boolean;
  exclusion_reason: string | null;
  g365_home_spread: number | string | null;
  g365_total: number | string | null;
  total_status:
    | "pending"
    | "published"
    | "frozen"
    | "excluded";
  spread_status:
    | "pending"
    | "published"
    | "frozen"
    | "excluded";
};


type PickRow = {
  id: number;
  pickem_week_id: number;
  fantasy_team_id: number;
  pickem_game_id: number;
  market_type:
    PickMarketType;
  selected_side:
    | "home"
    | "away"
    | "over"
    | "under";
  frozen_home_spread:
    number |
    string |
    null;
  frozen_total:
    number |
    string |
    null;
  submitted_at: string;
  updated_at: string;
  result:
    | "pending"
    | "win"
    | "loss"
    | "push"
    | "void";
  points_awarded: number | string | null;
};


type CardStatus = {
  weekReady: boolean;
  selectedPicks: number;
  requiredPicks: number;
  remainingPicks: number;
  isComplete: boolean;
};


type RpcCardStatus = {
  weekReady?: boolean;
  selectedPicks?: number;
  requiredPicks?: number;
  remainingPicks?: number;
  isComplete?: boolean;
};


function numericValue(
  value: number | string | null
) {
  if (value === null) {
    return null;
  }

  const parsed =
    typeof value === "number"
      ? value
      : Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : null;
}


function formatSpread(
  spread: number
) {
  if (spread === 0) {
    return "PK";
  }

  return spread > 0
    ? `+${spread}`
    : String(spread);
}


function formatKickoff(
  value: string
) {
  const date =
    new Date(value);

  return date.toLocaleString(
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


function sportLabel(
  sport: "ncaaf" | "nfl"
) {
  return sport === "ncaaf"
    ? "COLLEGE"
    : "NFL";
}


function scopeLabel(
  scope: FootballScope
) {
  switch (scope) {
    case "college_only":
      return "College Football";
    case "nfl_only":
      return "NFL";
    default:
      return "College + NFL";
  }
}


function resultLabel(
  result: PickRow["result"]
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
  result: PickRow["result"]
) {
  switch (result) {
    case "win":
      return "#3fd47a";
    case "loss":
      return "#ff5a5f";
    case "push":
      return "#ffb84a";
    case "void":
      return "#9898a2";
    default:
      return "#d0d0d5";
  }
}


function normalizeStatus(
  data: unknown,
  fallbackRequired: number
): CardStatus {
  const raw =
    (data ?? {}) as RpcCardStatus;

  const selected =
    Number(
      raw.selectedPicks ??
        0
    );

  const required =
    Number(
      raw.requiredPicks ??
        fallbackRequired
    );

  return {
    weekReady:
      Boolean(
        raw.weekReady
      ),
    selectedPicks:
      Number.isFinite(
        selected
      )
        ? selected
        : 0,
    requiredPicks:
      Number.isFinite(
        required
      )
        ? required
        : fallbackRequired,
    remainingPicks:
      Number.isFinite(
        Number(
          raw.remainingPicks
        )
      )
        ? Number(
            raw.remainingPicks
          )
        : Math.max(
            required -
              selected,
            0
          ),
    isComplete:
      Boolean(
        raw.isComplete
      ),
  };
}


export default function PickemMyPicks({
  leagueId,
  season,
  fantasyTeamId,
  teamName,
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
    workingGameId,
    setWorkingGameId,
  ] =
    useState<number | null>(
      null
    );

  const [
    message,
    setMessage,
  ] =
    useState("");

  const [
    isError,
    setIsError,
  ] =
    useState(false);

  const [
    settings,
    setSettings,
  ] =
    useState<SettingsRow | null>(
      null
    );

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
    games,
    setGames,
  ] =
    useState<GameRow[]>([]);

  const [
    picks,
    setPicks,
  ] =
    useState<PickRow[]>([]);

  const [
    cardStatus,
    setCardStatus,
  ] =
    useState<CardStatus>({
      weekReady: false,
      selectedPicks: 0,
      requiredPicks: 5,
      remainingPicks: 5,
      isComplete: false,
    });


  const selectedWeek =
    useMemo(
      () =>
        weeks.find(
          (row) =>
            row.id ===
            selectedWeekId
        ) ??
        null,
      [
        selectedWeekId,
        weeks,
      ]
    );


  const pickByGameId =
    useMemo(() => {
      const map =
        new Map<
          number,
          PickRow
        >();

      for (
        const pick of picks
      ) {
        if (
          pick.result !==
          "void"
        ) {
          map.set(
            pick.pickem_game_id,
            pick
          );
        }
      }

      return map;
    }, [picks]);


  const earliestSelectedKickoff =
    useMemo(() => {
      const selectedKickoffs =
        games
          .filter((game) =>
            pickByGameId.has(
              game.id
            )
          )
          .map((game) =>
            new Date(
              game.kickoff_at
            ).getTime()
          )
          .filter(
            Number.isFinite
          );

      if (
        selectedKickoffs.length ===
        0
      ) {
        return null;
      }

      return Math.min(
        ...selectedKickoffs
      );
    }, [
      games,
      pickByGameId,
    ]);


  const fullCardLocked =
    settings
      ?.pick_lock_mode ===
      "full_card" &&
    earliestSelectedKickoff !==
      null &&
    Date.now() >=
      earliestSelectedKickoff;


  const loadLeagueShell =
    useCallback(
      async () => {
        const [
          settingsResult,
          weeksResult,
        ] =
          await Promise.all([
            supabase
              .from(
                "pickem_settings"
              )
              .select(
                "football_scope,picks_per_week,pick_lock_mode,pick_market_mode"
              )
              .eq(
                "league_id",
                leagueId
              )
              .maybeSingle(),

            supabase
              .from(
                "pickem_weeks"
              )
              .select(
                "id,season,week,status,required_picks,line_day_at,finalize_not_before"
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
          weeksResult.error
        ) {
          throw new Error(
            weeksResult
              .error.message
          );
        }

        const nextSettings =
          settingsResult.data as
            | SettingsRow
            | null;

        const nextWeeks =
          (
            weeksResult.data ??
            []
          ) as WeekRow[];

        setSettings(
          nextSettings
        );
        setWeeks(
          nextWeeks
        );

        setCardStatus(
          (current) => ({
            ...current,
            requiredPicks:
              nextSettings
                ?.picks_per_week ??
              current.requiredPicks,
            remainingPicks:
              nextSettings
                ?.picks_per_week ??
              current.remainingPicks,
          })
        );

        setSelectedWeekId(
          (current) => {
            if (
              current !==
                null &&
              nextWeeks.some(
                (row) =>
                  row.id ===
                  current
              )
            ) {
              return current;
            }

            const activeWeek =
              nextWeeks.find(
                (row) =>
                  row.status !==
                  "final"
              );

            return (
              activeWeek?.id ??
              nextWeeks.at(-1)
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


  const loadWeek =
    useCallback(
      async (
        week:
          WeekRow | null
      ) => {
        if (!week) {
          setGames([]);
          setPicks([]);

          setCardStatus({
            weekReady:
              false,
            selectedPicks:
              0,
            requiredPicks:
              settings
                ?.picks_per_week ??
              5,
            remainingPicks:
              settings
                ?.picks_per_week ??
              5,
            isComplete:
              false,
          });

          return;
        }

        const [
          gamesResult,
          picksResult,
          statusResult,
        ] =
          await Promise.all([
            supabase
              .from(
                "pickem_games"
              )
              .select(
                "id,pickem_week_id,sport,kickoff_at,away_team_name,away_team_abbreviation,home_team_name,home_team_abbreviation,away_score,home_score,status_detail,period,display_clock,is_started,is_final,is_eligible,exclusion_reason,g365_home_spread,spread_status,g365_total,total_status"
              )
              .eq(
                "league_id",
                leagueId
              )
              .eq(
                "pickem_week_id",
                week.id
              )
              .order(
                "kickoff_at",
                {
                  ascending:
                    true,
                }
              ),

            supabase
              .from(
                "pickem_picks"
              )
              .select(
                "id,pickem_week_id,fantasy_team_id,pickem_game_id,market_type,selected_side,frozen_home_spread,frozen_total,submitted_at,updated_at,result,points_awarded"
              )
              .eq(
                "league_id",
                leagueId
              )
              .eq(
                "pickem_week_id",
                week.id
              )
              .eq(
                "fantasy_team_id",
                fantasyTeamId
              ),

            supabase.rpc(
              "get_pickem_my_card_status",
              {
                p_league_id:
                  leagueId,
                p_season:
                  season,
                p_week:
                  week.week,
              }
            ),
          ]);

        if (
          gamesResult.error
        ) {
          throw new Error(
            gamesResult
              .error.message
          );
        }

        if (
          picksResult.error
        ) {
          throw new Error(
            picksResult
              .error.message
          );
        }

        if (
          statusResult.error
        ) {
          throw new Error(
            statusResult
              .error.message
          );
        }

        setGames(
          (
            gamesResult.data ??
            []
          ) as GameRow[]
        );

        setPicks(
          (
            picksResult.data ??
            []
          ) as PickRow[]
        );

        setCardStatus(
          normalizeStatus(
            statusResult.data,
            week.required_picks
          )
        );
      },
      [
        fantasyTeamId,
        leagueId,
        season,
        settings,
        supabase,
      ]
    );


  useEffect(() => {
    let active =
      true;

    async function run() {
      setLoading(true);
      setMessage("");
      setIsError(false);

      try {
        await loadLeagueShell();
      } catch (error) {
        if (!active) {
          return;
        }

        setIsError(true);
        setMessage(
          error instanceof Error
            ? error.message
            : "Pick'em could not be loaded."
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
    loadLeagueShell,
  ]);


  useEffect(() => {
    if (loading) {
      return;
    }

    let active =
      true;

    async function run() {
      try {
        await loadWeek(
          selectedWeek
        );
      } catch (error) {
        if (!active) {
          return;
        }

        setIsError(true);
        setMessage(
          error instanceof Error
            ? error.message
            : "This Pick'em week could not be loaded."
        );
      }
    }

    void run();

    const timer =
      window.setInterval(
        () => {
          void run();
        },
        15000
      );

    return () => {
      active = false;
      window.clearInterval(
        timer
      );
    };
  }, [
    loadWeek,
    loading,
    selectedWeek,
  ]);


  async function savePick(
    gameId: number,
    marketType:
      PickMarketType,
    side:
      | "home"
      | "away"
      | "over"
      | "under"
  ) {
    if (
      !selectedWeek ||
      workingGameId !==
        null
    ) {
      return;
    }

    setWorkingGameId(
      gameId
    );
    setMessage("");
    setIsError(false);

    try {
      const {
        data,
        error,
      } =
        await supabase.rpc(
          "save_pickem_pick_v2",
          {
            p_league_id:
              leagueId,
            p_season:
              season,
            p_week:
              selectedWeek.week,
            p_pickem_game_id:
              gameId,
            p_market_type:
              marketType,
            p_selected_side:
              side,
          }
        );

      if (error) {
        throw new Error(
          error.message
        );
      }

      setCardStatus(
        normalizeStatus(
          data,
          selectedWeek
            .required_picks
        )
      );

      await loadWeek(
        selectedWeek
      );

      setMessage(
        "Pick saved."
      );
    } catch (error) {
      setIsError(true);
      setMessage(
        error instanceof Error
          ? error.message
          : "The pick could not be saved."
      );
    } finally {
      setWorkingGameId(
        null
      );
    }
  }


  async function removePick(
    gameId: number
  ) {
    if (
      !selectedWeek ||
      workingGameId !==
        null
    ) {
      return;
    }

    setWorkingGameId(
      gameId
    );
    setMessage("");
    setIsError(false);

    try {
      const {
        data,
        error,
      } =
        await supabase.rpc(
          "remove_pickem_pick",
          {
            p_league_id:
              leagueId,
            p_season:
              season,
            p_week:
              selectedWeek.week,
            p_pickem_game_id:
              gameId,
          }
        );

      if (error) {
        throw new Error(
          error.message
        );
      }

      setCardStatus(
        normalizeStatus(
          data,
          selectedWeek
            .required_picks
        )
      );

      await loadWeek(
        selectedWeek
      );

      setMessage(
        "Pick removed."
      );
    } catch (error) {
      setIsError(true);
      setMessage(
        error instanceof Error
          ? error.message
          : "The pick could not be removed."
      );
    } finally {
      setWorkingGameId(
        null
      );
    }
  }


  if (loading) {
    return (
      <main
        style={{
          padding:
            "22px 18px 36px",
          color:
            "#aaaab2",
        }}
      >
        Loading your Pick&apos;em card…
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
        padding:
          "22px 18px 36px",
        maxWidth:
          1180,
      }}
    >
      <section
        style={{
          display:
            "grid",
          gap:
            14,
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
        <div>
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
                "7px 0 5px",
              color:
                "#fff",
              fontSize:
                "clamp(28px, 5vw, 42px)",
            }}
          >
            My Picks
          </h1>

          <div
            style={{
              color:
                "#a9a9b1",
              lineHeight:
                1.55,
            }}
          >
            {teamName} · {season}
            {settings
              ? ` · ${scopeLabel(
                  settings.football_scope
                )}`
              : ""}
          </div>
        </div>

        <div
          style={{
            display:
              "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(150px, 1fr))",
            gap:
              10,
          }}
        >
          <SummaryBox
            label="Selected"
            value={`${cardStatus.selectedPicks} / ${cardStatus.requiredPicks}`}
            accent={
              cardStatus.isComplete
                ? "#3fd47a"
                : "#ff7627"
            }
          />

          <SummaryBox
            label="Remaining"
            value={String(
              cardStatus.remainingPicks
            )}
          />

          <SummaryBox
            label="Card Status"
            value={
              cardStatus.isComplete
                ? "COMPLETE"
                : "INCOMPLETE"
            }
            accent={
              cardStatus.isComplete
                ? "#3fd47a"
                : "#ffb84a"
            }
          />

          <SummaryBox
            label="Lock Rule"
            value={
              settings
                ?.pick_lock_mode ===
              "full_card"
                ? "FULL CARD"
                : "PER GAME"
            }
          />
        </div>

        <div
          style={{
            padding:
              "10px 12px",
            borderRadius:
              10,
            background:
              "rgba(0,0,0,0.24)",
            color:
              "#c7c7cd",
            fontSize:
              13,
            lineHeight:
              1.5,
          }}
        >
          Every individual pick remains private from other league members until that specific game kicks off. The frozen G365 Spread shown on this card is the line used to grade the pick.
        </div>
      </section>


      <section
        style={{
          display:
            "flex",
          gap:
            10,
          alignItems:
            "center",
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
          htmlFor="pickem-week"
          style={{
            color:
              "#b9b9c0",
            fontSize:
              13,
            fontWeight:
              800,
          }}
        >
          Week
        </label>

        <select
          id="pickem-week"
          value={
            selectedWeekId ??
            ""
          }
          onChange={(
            event
          ) => {
            const next =
              Number(
                event.target
                  .value
              );

            setSelectedWeekId(
              Number.isFinite(
                next
              )
                ? next
                : null
            );
          }}
          disabled={
            weeks.length ===
            0
          }
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
              800,
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
                  {week.week} ·{" "}
                  {week.status
                    .replaceAll(
                      "_",
                      " "
                    )
                    .toUpperCase()}
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
                "#8f8f98",
              fontSize:
                12,
            }}
          >
            Required this week:{" "}
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
              `1px solid ${
                isError
                  ? "rgba(255,80,80,0.45)"
                  : "rgba(63,212,122,0.38)"
              }`,
            background:
              isError
                ? "rgba(120,0,0,0.22)"
                : "rgba(18,100,55,0.18)",
            color:
              isError
                ? "#ff999c"
                : "#80eba9",
          }}
        >
          {message}
        </div>
      ) : null}


      {!selectedWeek ? (
        <EmptyState
          title="The weekly card is not ready yet."
          description="A Pick'em week must be initialized before selections can be made. The commissioner controls the weekly setup."
        />
      ) : games.length ===
        0 ? (
        <EmptyState
          title={`Week ${selectedWeek.week} has no games loaded yet.`}
          description="The week exists, but the eligible College/NFL game slate and frozen G365 Spreads have not been loaded yet. Game ingestion is the next Pick'em build stage."
        />
      ) : (
        <section
          style={{
            display:
              "grid",
            gap:
              12,
          }}
        >
          {fullCardLocked ? (
            <div
              style={{
                padding:
                  "12px 14px",
                borderRadius:
                  12,
                border:
                  "1px solid rgba(255,184,74,0.35)",
                background:
                  "rgba(110,65,0,0.18)",
                color:
                  "#ffc96f",
                fontWeight:
                  800,
              }}
            >
              Your full weekly card is locked because the earliest selected game has kicked off.
            </div>
          ) : null}

          {games.map(
            (game) => {
              const pick =
                pickByGameId.get(
                  game.id
                );

              const homeSpread =
                numericValue(
                  game.g365_home_spread
                );

              const awaySpread =
                homeSpread ===
                null
                  ? null
                  : -homeSpread;

              const total =
                numericValue(
                  game.g365_total
                );

              const hasFrozenSpread =
                game.is_eligible &&
                game.spread_status ===
                  "frozen" &&
                homeSpread !==
                  null;

              const hasFrozenTotal =
                game.total_status ===
                  "frozen" &&
                total !==
                  null;

              const marketMode =
                settings
                  ?.pick_market_mode ??
                "spread_only";

              const spreadEnabled =
                marketMode ===
                  "spread_only" ||
                marketMode ===
                  "spread_total";

              const totalEnabled =
                marketMode ===
                  "total_only" ||
                marketMode ===
                  "spread_total";

              const hasFrozenLine =
                (
                  spreadEnabled &&
                  hasFrozenSpread
                ) ||
                (
                  totalEnabled &&
                  hasFrozenTotal
                );

              const gameLocked =
                Date.now() >=
                  new Date(
                    game.kickoff_at
                  ).getTime() ||
                game.is_started ||
                game.is_final;

              const locked =
                gameLocked ||
                Boolean(
                  fullCardLocked
                );

              const canSelectSpread =
                spreadEnabled &&
                hasFrozenSpread &&
                !locked;

              const canSelectTotal =
                totalEnabled &&
                hasFrozenTotal &&
                !locked;

              const working =
                workingGameId ===
                game.id;

              return (
                <article
                  key={
                    game.id
                  }
                  style={{
                    overflow:
                      "hidden",
                    borderRadius:
                      16,
                    border:
                      pick
                        ? "1px solid rgba(255,104,24,0.55)"
                        : "1px solid rgba(255,255,255,0.08)",
                    background:
                      pick
                        ? "linear-gradient(145deg, rgba(100,8,12,0.34), #101014 55%)"
                        : "#101014",
                  }}
                >
                  <div
                    style={{
                      display:
                        "flex",
                      justifyContent:
                        "space-between",
                      gap:
                        12,
                      alignItems:
                        "center",
                      flexWrap:
                        "wrap",
                      padding:
                        "10px 14px",
                      borderBottom:
                        "1px solid rgba(255,255,255,0.06)",
                      background:
                        "rgba(0,0,0,0.20)",
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
                      <Badge>
                        {sportLabel(
                          game.sport
                        )}
                      </Badge>

                      {game.is_final ? (
                        <Badge>
                          FINAL
                        </Badge>
                      ) : game.is_started ? (
                        <Badge>
                          LIVE
                          {game.period
                            ? ` · Q${game.period}`
                            : ""}
                          {game.display_clock
                            ? ` · ${game.display_clock}`
                            : ""}
                        </Badge>
                      ) : (
                        <span
                          style={{
                            color:
                              "#a3a3aa",
                            fontSize:
                              12,
                          }}
                        >
                          {formatKickoff(
                            game.kickoff_at
                          )}
                        </span>
                      )}
                    </div>

                    <div
                      style={{
                        color:
                          hasFrozenLine
                            ? "#ff9b59"
                            : "#8e8e97",
                        fontSize:
                          12,
                        fontWeight:
                          900,
                      }}
                    >
                      {hasFrozenLine
                        ? [
                            hasFrozenSpread
                              ? "SPREAD"
                              : null,
                            hasFrozenTotal
                              ? "TOTAL"
                              : null,
                          ]
                            .filter(Boolean)
                            .join(" + ") +
                          " FROZEN"
                        : "LINE NOT FROZEN"}
                    </div>
                  </div>


                  <div
                    style={{
                      display:
                        "grid",
                      gap:
                        10,
                      padding:
                        14,
                    }}
                  >
                    <TeamPickButton
                      label={
                        game.away_team_name
                      }
                      abbreviation={
                        game.away_team_abbreviation
                      }
                      spread={
                        awaySpread
                      }
                      score={
                        game.away_score
                      }
                      selected={
                        pick
                          ?.market_type ===
                          "spread" &&
                        pick
                          ?.selected_side ===
                        "away"
                      }
                      disabled={
                        !canSelectSpread ||
                        working
                      }
                      onClick={() =>
                        void savePick(
                          game.id,
                          "spread",
                          "away"
                        )
                      }
                    />

                    <TeamPickButton
                      label={
                        game.home_team_name
                      }
                      abbreviation={
                        game.home_team_abbreviation
                      }
                      spread={
                        homeSpread
                      }
                      score={
                        game.home_score
                      }
                      selected={
                        pick
                          ?.market_type ===
                          "spread" &&
                        pick
                          ?.selected_side ===
                        "home"
                      }
                      disabled={
                        !canSelectSpread ||
                        working
                      }
                      onClick={() =>
                        void savePick(
                          game.id,
                          "spread",
                          "home"
                        )
                      }
                    />

                    {totalEnabled ? (
                      <div
                        style={{
                          display:
                            "grid",
                          gap:
                            8,
                          marginTop:
                            4,
                          paddingTop:
                            12,
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
                            justifyContent:
                              "space-between",
                            gap:
                              10,
                            color:
                              "#a9a9b1",
                            fontSize:
                              11,
                            fontWeight:
                              900,
                            letterSpacing:
                              "0.06em",
                            textTransform:
                              "uppercase",
                          }}
                        >
                          <span>
                            G365 Total
                          </span>
                          <strong
                            style={{
                              color:
                                hasFrozenTotal
                                  ? "#ff9b59"
                                  : "#777780",
                            }}
                          >
                            {hasFrozenTotal
                              ? total?.toFixed(
                                  1
                                )
                              : "NOT FROZEN"}
                          </strong>
                        </div>

                        <div
                          className="g365-pickem-total-grid"
                          style={{
                            display:
                              "grid",
                            gridTemplateColumns:
                              "repeat(2,minmax(0,1fr))",
                            gap:
                              8,
                          }}
                        >
                          <TotalPickButton
                            label="OVER"
                            total={
                              total
                            }
                            selected={
                              pick
                                ?.market_type ===
                                "total" &&
                              pick
                                ?.selected_side ===
                                "over"
                            }
                            disabled={
                              !canSelectTotal ||
                              working
                            }
                            onClick={() =>
                              void savePick(
                                game.id,
                                "total",
                                "over"
                              )
                            }
                          />

                          <TotalPickButton
                            label="UNDER"
                            total={
                              total
                            }
                            selected={
                              pick
                                ?.market_type ===
                                "total" &&
                              pick
                                ?.selected_side ===
                                "under"
                            }
                            disabled={
                              !canSelectTotal ||
                              working
                            }
                            onClick={() =>
                              void savePick(
                                game.id,
                                "total",
                                "under"
                              )
                            }
                          />
                        </div>
                      </div>
                    ) : null}
                  </div>


                  <div
                    style={{
                      display:
                        "flex",
                      gap:
                        10,
                      alignItems:
                        "center",
                      justifyContent:
                        "space-between",
                      flexWrap:
                        "wrap",
                      padding:
                        "10px 14px 13px",
                    }}
                  >
                    <div
                      style={{
                        color:
                          "#9797a0",
                        fontSize:
                          12,
                        lineHeight:
                          1.45,
                      }}
                    >
                      {pick ? (
                        <>
                          <strong
                            style={{
                              color:
                                "#fff",
                            }}
                          >
                            Your pick:
                          </strong>{" "}
                          {pick.market_type ===
                          "total"
                            ? `${pick.selected_side.toUpperCase()} ${numericValue(
                                pick.frozen_total
                              )?.toFixed(1) ?? ""}`
                            : `${
                                pick.selected_side ===
                                "home"
                                  ? game.home_team_name
                                  : game.away_team_name
                              } ${
                                pick.selected_side ===
                                "home"
                                  ? formatSpread(
                                      numericValue(
                                        pick.frozen_home_spread
                                      ) ??
                                        0
                                    )
                                  : formatSpread(
                                      -(
                                        numericValue(
                                          pick.frozen_home_spread
                                        ) ??
                                          0
                                      )
                                    )
                              }`}
                          {pick.result !==
                          "pending" ? (
                            <>
                              {" "}
                              ·{" "}
                              <strong
                                style={{
                                  color:
                                    resultColor(
                                      pick.result
                                    ),
                                }}
                              >
                                {resultLabel(
                                  pick.result
                                )}
                              </strong>
                            </>
                          ) : null}
                        </>
                      ) : hasFrozenLine ? (
                        locked
                          ? "This game is locked."
                          : "Choose one side against the frozen G365 Spread."
                      ) : (
                        game.exclusion_reason ??
                        "This game is not currently selectable."
                      )}
                    </div>

                    {pick &&
                    !locked ? (
                      <button
                        type="button"
                        onClick={() =>
                          void removePick(
                            game.id
                          )
                        }
                        disabled={
                          working
                        }
                        style={{
                          padding:
                            "8px 11px",
                          borderRadius:
                            9,
                          border:
                            "1px solid rgba(255,255,255,0.12)",
                          background:
                            "rgba(255,255,255,0.04)",
                          color:
                            "#c8c8cf",
                          cursor:
                            working
                              ? "wait"
                              : "pointer",
                          fontWeight:
                            800,
                        }}
                      >
                        Remove Pick
                      </button>
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


function SummaryBox({
  label,
  value,
  accent = "#fff",
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div
      style={{
        padding:
          "12px 13px",
        borderRadius:
          12,
        border:
          "1px solid rgba(255,255,255,0.07)",
        background:
          "rgba(0,0,0,0.26)",
      }}
    >
      <div
        style={{
          marginBottom:
            5,
          color:
            "#8d8d96",
          fontSize:
            11,
          fontWeight:
            900,
          letterSpacing:
            "0.08em",
          textTransform:
            "uppercase",
        }}
      >
        {label}
      </div>

      <div
        style={{
          color:
            accent,
          fontSize:
            20,
          fontWeight:
            1000,
        }}
      >
        {value}
      </div>
    </div>
  );
}


function Badge({
  children,
}: {
  children:
    React.ReactNode;
}) {
  return (
    <span
      style={{
        display:
          "inline-flex",
        alignItems:
          "center",
        minHeight:
          25,
        padding:
          "4px 8px",
        borderRadius:
          999,
        border:
          "1px solid rgba(255,118,39,0.28)",
        background:
          "rgba(255,91,24,0.10)",
        color:
          "#ff9d5f",
        fontSize:
          10,
        fontWeight:
          1000,
        letterSpacing:
          "0.08em",
      }}
    >
      {children}
    </span>
  );
}



function TotalPickButton({
  label,
  total,
  selected,
  disabled,
  onClick,
}: {
  label:
    "OVER" |
    "UNDER";
  total:
    number |
    null;
  selected:
    boolean;
  disabled:
    boolean;
  onClick:
    () => void;
}) {
  return (
    <button
      type="button"
      onClick={
        onClick
      }
      disabled={
        disabled
      }
      style={{
        width:
          "100%",
        minHeight:
          50,
        padding:
          "10px 12px",
        borderRadius:
          11,
        border:
          selected
            ? "1px solid #ff6926"
            : "1px solid rgba(255,255,255,0.09)",
        background:
          selected
            ? "linear-gradient(90deg, rgba(172,15,19,0.45), rgba(255,101,26,0.17))"
            : "rgba(255,255,255,0.025)",
        color:
          "#fff",
        cursor:
          disabled
            ? "not-allowed"
            : "pointer",
        opacity:
          disabled &&
          !selected
            ? 0.62
            : 1,
        fontWeight:
          950,
        textAlign:
          "center",
      }}
    >
      {label}{" "}
      {total !== null
        ? total.toFixed(
            1
          )
        : "—"}
    </button>
  );
}


function TeamPickButton({
  label,
  abbreviation,
  spread,
  score,
  selected,
  disabled,
  onClick,
}: {
  label: string;
  abbreviation:
    string | null;
  spread:
    number | null;
  score:
    number | null;
  selected:
    boolean;
  disabled:
    boolean;
  onClick:
    () => void;
}) {
  return (
    <button
      type="button"
      onClick={
        onClick
      }
      disabled={
        disabled
      }
      style={{
        width:
          "100%",
        display:
          "grid",
        gridTemplateColumns:
          "minmax(0, 1fr) auto auto",
        gap:
          12,
        alignItems:
          "center",
        minHeight:
          62,
        padding:
          "11px 13px",
        borderRadius:
          12,
        border:
          selected
            ? "1px solid #ff6926"
            : "1px solid rgba(255,255,255,0.09)",
        background:
          selected
            ? "linear-gradient(90deg, rgba(172,15,19,0.45), rgba(255,101,26,0.17))"
            : "rgba(255,255,255,0.025)",
        color:
          "#fff",
        cursor:
          disabled
            ? "not-allowed"
            : "pointer",
        opacity:
          disabled &&
          !selected
            ? 0.62
            : 1,
        textAlign:
          "left",
      }}
    >
      <span
        style={{
          minWidth:
            0,
        }}
      >
        <span
          style={{
            display:
              "block",
            overflow:
              "hidden",
            textOverflow:
              "ellipsis",
            color:
              "#fff",
            fontWeight:
              900,
            fontSize:
              15,
            whiteSpace:
              "nowrap",
          }}
        >
          {label}
        </span>

        {abbreviation ? (
          <span
            style={{
              display:
                "block",
              marginTop:
                3,
              color:
                "#84848d",
              fontSize:
                11,
              fontWeight:
                800,
            }}
          >
            {abbreviation}
          </span>
        ) : null}
      </span>

      {score !==
      null ? (
        <span
          style={{
            color:
              "#d2d2d8",
            fontSize:
              18,
            fontWeight:
              1000,
          }}
        >
          {score}
        </span>
      ) : null}

      <span
        style={{
          minWidth:
            64,
          textAlign:
            "right",
          color:
            spread ===
            null
              ? "#777780"
              : selected
                ? "#fff"
                : "#ff9b59",
          fontSize:
            17,
          fontWeight:
            1000,
        }}
      >
        {spread ===
        null
          ? "—"
          : formatSpread(
              spread
            )}
      </span>
    </button>
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
