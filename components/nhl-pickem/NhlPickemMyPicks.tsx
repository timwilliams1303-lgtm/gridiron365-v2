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


type NhlMarketMode =
  | "puck_line_only"
  | "total_only"
  | "puck_line_and_total";


type MarketType =
  | "puck_line"
  | "total";


type SelectedSide =
  | "home"
  | "away"
  | "over"
  | "under";


type SettingsRow = {
  picks_per_period: number;
  market_mode: NhlMarketMode;
  allow_same_game_multiple_markets: boolean;
  pick_lock_mode: string;
  minimum_source_books: number;
  scoring_mode: string;
  confidence_points:
    | number[]
    | string[];
  confidence_push_multiplier:
    number | string;
};


type PeriodRow = {
  id: number;
  season: number;
  period_number: number;
  starts_at: string;
  ends_at: string;
  status: string;
  finalized_at: string | null;
};


type EntryRow = {
  id: number;
  league_id: string;
  fantasy_team_id: number;
  season: number;
  entry_name: string;
  active: boolean;
};


type PickemGameRow = {
  id: number;
  nhl_pickem_period_id: number;
  nhl_game_id: number;
  league_id: string;
  season: number;
  eligible: boolean;
  excluded_reason: string | null;
  consensus_favorite_team_id:
    number | null;
  consensus_favorite_moneyline:
    number | string | null;
  consensus_underdog_team_id:
    number | null;
  official_home_puck_line:
    number | string | null;
  official_away_puck_line:
    number | string | null;
  official_total:
    number | string | null;
  puck_line_source_count: number;
  total_source_count: number;
  freeze_scheduled_at:
    string | null;
  frozen_at: string | null;
  is_frozen: boolean;
  final_home_score:
    number | null;
  final_away_score:
    number | null;
  graded_at: string | null;
  market_mode_at_freeze:
    string | null;
  line_status: string;
  line_finalized_at:
    string | null;
};


type NhlGameRow = {
  id: number;
  season: number;
  season_type: string;
  game_date: string | null;
  start_time: string;
  away_team_id:
    number | null;
  home_team_id:
    number | null;
  away_score: number;
  home_score: number;
  status_type: string | null;
  status_name: string | null;
  status_detail: string | null;
  period: number | null;
  display_clock: string | null;
  status_completed: boolean;
  is_overtime: boolean;
  is_shootout: boolean;
  venue_name: string | null;
  nhl_game_id: string | null;
};


type TeamRow = {
  id: number;
  abbreviation: string;
  name: string;
  display_name: string;
  short_name: string | null;
  logo_url: string | null;
};


type PickRow = {
  id: number;
  league_id: string;
  nhl_pickem_period_id: number;
  nhl_pickem_game_id: number;
  entry_id: number;
  fantasy_team_id: number;
  user_id: string | null;
  market_type: MarketType;
  selected_side: SelectedSide;
  snapshot_home_puck_line:
    number | string | null;
  snapshot_away_puck_line:
    number | string | null;
  snapshot_total:
    number | string | null;
  confidence_value:
    number | string | null;
  locked_at: string | null;
  result: string | null;
  points_awarded:
    number | string;
  graded_at: string | null;
};


type CardStatus = {
  periodReady: boolean;
  selectedPicks: number;
  requiredPicks: number;
  remainingPicks: number;
  isComplete: boolean;
};


type RpcStatus = {
  periodReady?: boolean;
  weekReady?: boolean;
  selectedPicks?: number;
  requiredPicks?: number;
  remainingPicks?: number;
  isComplete?: boolean;
};


type DisplayGame = {
  contest: PickemGameRow;
  game: NhlGameRow | null;
  homeTeam: TeamRow | null;
  awayTeam: TeamRow | null;
};


function numericValue(
  value:
    | number
    | string
    | null
) {
  if (value === null) {
    return null;
  }

  const parsed =
    typeof value === "number"
      ? value
      : Number(value);

  return Number.isFinite(
    parsed
  )
    ? parsed
    : null;
}


function formatLine(
  value: number
) {
  if (value === 0) {
    return "PK";
  }

  return value > 0
    ? `+${value}`
    : String(value);
}


function formatStartTime(
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


function formatPeriodRange(
  period: PeriodRow
) {
  const formatter =
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone:
          "America/New_York",
        month: "short",
        day: "numeric",
      }
    );

  return `${formatter.format(
    new Date(
      period.starts_at
    )
  )} – ${formatter.format(
    new Date(
      period.ends_at
    )
  )}`;
}


function normalizeStatus(
  data: unknown,
  fallbackRequired: number,
  fallbackSelected = 0
): CardStatus {
  const raw =
    (data ?? {}) as RpcStatus;

  const selected =
    Number(
      raw.selectedPicks ??
        fallbackSelected
    );

  const required =
    Number(
      raw.requiredPicks ??
        fallbackRequired
    );

  const remainingRaw =
    Number(
      raw.remainingPicks
    );

  return {
    periodReady:
      Boolean(
        raw.periodReady ??
          raw.weekReady ??
          true
      ),

    selectedPicks:
      Number.isFinite(
        selected
      )
        ? selected
        : fallbackSelected,

    requiredPicks:
      Number.isFinite(
        required
      )
        ? required
        : fallbackRequired,

    remainingPicks:
      Number.isFinite(
        remainingRaw
      )
        ? remainingRaw
        : Math.max(
            required -
              selected,
            0
          ),

    isComplete:
      typeof raw.isComplete ===
      "boolean"
        ? raw.isComplete
        : selected >=
          required,
  };
}


function resultLabel(
  value: string | null
) {
  switch (value) {
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
  value: string | null
) {
  switch (value) {
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


function periodGameState(
  game: NhlGameRow | null
) {
  if (!game) {
    return {
      started: false,
      final: false,
      live: false,
    };
  }

  const startedByTime =
    Date.now() >=
    new Date(
      game.start_time
    ).getTime();

  const final =
    game.status_completed;

  return {
    started:
      startedByTime ||
      final,

    final,

    live:
      startedByTime &&
      !final,
  };
}


export default function NhlPickemMyPicks({
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
    workingKey,
    setWorkingKey,
  ] =
    useState<
      string | null
    >(null);

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
    useState<
      SettingsRow | null
    >(null);

  const [
    entry,
    setEntry,
  ] =
    useState<
      EntryRow | null
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
    displayGames,
    setDisplayGames,
  ] =
    useState<
      DisplayGame[]
    >([]);

  const [
    picks,
    setPicks,
  ] =
    useState<
      PickRow[]
    >([]);

  const [
    cardStatus,
    setCardStatus,
  ] =
    useState<CardStatus>({
      periodReady: false,
      selectedPicks: 0,
      requiredPicks: 5,
      remainingPicks: 5,
      isComplete: false,
    });


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


  /*
   * NHL can allow two selections
   * from one game:
   *
   * 1. puck line
   * 2. total
   *
   * Never key picks by game alone.
   */
  const pickByKey =
    useMemo(() => {
      const map =
        new Map<
          string,
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
            `${pick.nhl_pickem_game_id}:${pick.market_type}`,
            pick
          );
        }
      }

      return map;
    }, [picks]);


  const picksByGame =
    useMemo(() => {
      const map =
        new Map<
          number,
          PickRow[]
        >();

      for (
        const pick of picks
      ) {
        if (
          pick.result ===
          "void"
        ) {
          continue;
        }

        const current =
          map.get(
            pick.nhl_pickem_game_id
          ) ?? [];

        current.push(
          pick
        );

        map.set(
          pick.nhl_pickem_game_id,
          current
        );
      }

      return map;
    }, [picks]);


  const confidenceChoices =
    useMemo(() => {
      const raw =
        settings
          ?.confidence_points ??
        [];

      return raw
        .map(
          (value) =>
            Number(value)
        )
        .filter(
          Number.isFinite
        )
        .sort(
          (a, b) =>
            b - a
        );
    }, [settings]);


  const loadLeagueShell =
    useCallback(
      async () => {
        const [
          settingsResult,
          periodsResult,
          entryResult,
        ] =
          await Promise.all([
            supabase
              .from(
                "nhl_pickem_settings"
              )
              .select(
                "picks_per_period,market_mode,allow_same_game_multiple_markets,pick_lock_mode,minimum_source_books,scoring_mode,confidence_points,confidence_push_multiplier"
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
                "id,league_id,fantasy_team_id,season,entry_name,active"
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
                "fantasy_team_id",
                fantasyTeamId
              )
              .eq(
                "active",
                true
              )
              .maybeSingle(),
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
          entryResult.error
        ) {
          throw new Error(
            entryResult
              .error.message
          );
        }


        const nextSettings =
          settingsResult.data as
            | SettingsRow
            | null;

        const nextPeriods =
          (
            periodsResult.data ??
            []
          ) as PeriodRow[];

        const nextEntry =
          entryResult.data as
            | EntryRow
            | null;


        setSettings(
          nextSettings
        );

        setPeriods(
          nextPeriods
        );

        setEntry(
          nextEntry
        );


        const required =
          nextSettings
            ?.picks_per_period ??
          5;

        setCardStatus(
          (current) => ({
            ...current,
            requiredPicks:
              required,
            remainingPicks:
              required,
          })
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
        fantasyTeamId,
        leagueId,
        season,
        supabase,
      ]
    );


  const loadPeriod =
    useCallback(
      async (
        period:
          | PeriodRow
          | null
      ) => {
        if (!period) {
          setDisplayGames(
            []
          );

          setPicks([]);

          const required =
            settings
              ?.picks_per_period ??
            5;

          setCardStatus({
            periodReady: false,
            selectedPicks: 0,
            requiredPicks:
              required,
            remainingPicks:
              required,
            isComplete: false,
          });

          return;
        }


        const contestResult =
          await supabase
            .from(
              "nhl_pickem_games"
            )
            .select(
              "id,nhl_pickem_period_id,nhl_game_id,league_id,season,eligible,excluded_reason,consensus_favorite_team_id,consensus_favorite_moneyline,consensus_underdog_team_id,official_home_puck_line,official_away_puck_line,official_total,puck_line_source_count,total_source_count,freeze_scheduled_at,frozen_at,is_frozen,final_home_score,final_away_score,graded_at,market_mode_at_freeze,line_status,line_finalized_at"
            )
            .eq(
              "league_id",
              leagueId
            )
            .eq(
              "nhl_pickem_period_id",
              period.id
            )
            .order(
              "id",
              {
                ascending:
                  true,
              }
            );


        if (
          contestResult.error
        ) {
          throw new Error(
            contestResult
              .error.message
          );
        }


        const contests =
          (
            contestResult.data ??
            []
          ) as PickemGameRow[];


        const nhlGameIds =
          Array.from(
            new Set(
              contests.map(
                (contest) =>
                  contest.nhl_game_id
              )
            )
          );


        let nhlGames:
          NhlGameRow[] = [];

        if (
          nhlGameIds.length >
          0
        ) {
          const gamesResult =
            await supabase
              .from(
                "nhl_games"
              )
              .select(
                "id,season,season_type,game_date,start_time,away_team_id,home_team_id,away_score,home_score,status_type,status_name,status_detail,period,display_clock,status_completed,is_overtime,is_shootout,venue_name,nhl_game_id"
              )
              .in(
                "id",
                nhlGameIds
              );


          if (
            gamesResult.error
          ) {
            throw new Error(
              gamesResult
                .error.message
            );
          }

          nhlGames =
            (
              gamesResult.data ??
              []
            ) as NhlGameRow[];
        }


        const teamIds =
          Array.from(
            new Set(
              nhlGames
                .flatMap(
                  (game) => [
                    game.home_team_id,
                    game.away_team_id,
                  ]
                )
                .filter(
                  (
                    id
                  ): id is number =>
                    id !== null
                )
            )
          );


        let teams:
          TeamRow[] = [];

        if (
          teamIds.length >
          0
        ) {
          const teamsResult =
            await supabase
              .from(
                "nhl_teams"
              )
              .select(
                "id,abbreviation,name,display_name,short_name,logo_url"
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

          teams =
            (
              teamsResult.data ??
              []
            ) as TeamRow[];
        }


        const gameMap =
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
          );

        const teamMap =
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
          );


        const nextDisplayGames =
          contests
            .map(
              (
                contest
              ): DisplayGame => {
                const game =
                  gameMap.get(
                    contest.nhl_game_id
                  ) ??
                  null;

                return {
                  contest,
                  game,

                  homeTeam:
                    game
                      ?.home_team_id
                      ? teamMap.get(
                          game.home_team_id
                        ) ??
                        null
                      : null,

                  awayTeam:
                    game
                      ?.away_team_id
                      ? teamMap.get(
                          game.away_team_id
                        ) ??
                        null
                      : null,
                };
              }
            )
            .sort(
              (a, b) => {
                if (
                  !a.game ||
                  !b.game
                ) {
                  return (
                    a.contest.id -
                    b.contest.id
                  );
                }

                return (
                  new Date(
                    a.game.start_time
                  ).getTime() -
                  new Date(
                    b.game.start_time
                  ).getTime()
                );
              }
            );


        setDisplayGames(
          nextDisplayGames
        );


        if (!entry) {
          setPicks([]);

          const required =
            settings
              ?.picks_per_period ??
            5;

          setCardStatus({
            periodReady: true,
            selectedPicks: 0,
            requiredPicks:
              required,
            remainingPicks:
              required,
            isComplete: false,
          });

          return;
        }


        const [
          picksResult,
          statusResult,
        ] =
          await Promise.all([
            supabase
              .from(
                "nhl_pickem_picks"
              )
              .select(
                "id,league_id,nhl_pickem_period_id,nhl_pickem_game_id,entry_id,fantasy_team_id,user_id,market_type,selected_side,snapshot_home_puck_line,snapshot_away_puck_line,snapshot_total,confidence_value,locked_at,result,points_awarded,graded_at"
              )
              .eq(
                "league_id",
                leagueId
              )
              .eq(
                "nhl_pickem_period_id",
                period.id
              )
              .eq(
                "entry_id",
                entry.id
              ),

            supabase.rpc(
              "get_nhl_pickem_my_card_status",
              {
                p_league_id:
                  leagueId,

                p_season:
                  season,

                p_period_number:
                  period.period_number,
              }
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
          statusResult.error
        ) {
          throw new Error(
            statusResult
              .error.message
          );
        }


        const nextPicks =
          (
            picksResult.data ??
            []
          ) as PickRow[];

        setPicks(
          nextPicks
        );


        setCardStatus(
          normalizeStatus(
            statusResult.data,
            settings
              ?.picks_per_period ??
              5,
            nextPicks.filter(
              (pick) =>
                pick.result !==
                "void"
            ).length
          )
        );
      },
      [
        entry,
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
            : "NHL Pick'em could not be loaded."
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
        await loadPeriod(
          selectedPeriod
        );
      } catch (error) {
        if (!active) {
          return;
        }

        setIsError(true);

        setMessage(
          error instanceof Error
            ? error.message
            : "This NHL Pick'em period could not be loaded."
        );
      }
    }

    void run();


    /*
     * NHL score/game-state refresh.
     */
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
    loadPeriod,
    loading,
    selectedPeriod,
  ]);


  async function savePick(
    gameId: number,
    marketType: MarketType,
    side: SelectedSide
  ) {
    if (
      !selectedPeriod ||
      workingKey !== null
    ) {
      return;
    }

    const key =
      `${gameId}:${marketType}`;

    setWorkingKey(key);
    setMessage("");
    setIsError(false);

    try {
      const {
        data,
        error,
      } =
        await supabase.rpc(
          "save_nhl_pickem_pick",
          {
            p_league_id:
              leagueId,

            p_season:
              season,

            p_period_number:
              selectedPeriod.period_number,

            p_nhl_pickem_game_id:
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
          selectedPeriod
            ? settings
                ?.picks_per_period ??
              5
            : 5,
          cardStatus.selectedPicks
        )
      );


      await loadPeriod(
        selectedPeriod
      );

      setMessage(
        "NHL pick saved."
      );
    } catch (error) {
      setIsError(true);

      setMessage(
        error instanceof Error
          ? error.message
          : "The NHL pick could not be saved."
      );
    } finally {
      setWorkingKey(null);
    }
  }


  async function removePick(
    gameId: number,
    marketType: MarketType
  ) {
    if (
      !selectedPeriod ||
      workingKey !== null
    ) {
      return;
    }

    const key =
      `${gameId}:${marketType}`;

    setWorkingKey(key);
    setMessage("");
    setIsError(false);

    try {
      const {
        data,
        error,
      } =
        await supabase.rpc(
          "remove_nhl_pickem_pick",
          {
            p_league_id:
              leagueId,

            p_season:
              season,

            p_period_number:
              selectedPeriod.period_number,

            p_nhl_pickem_game_id:
              gameId,

            p_market_type:
              marketType,
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
          settings
            ?.picks_per_period ??
            5,
          Math.max(
            cardStatus.selectedPicks -
              1,
            0
          )
        )
      );


      await loadPeriod(
        selectedPeriod
      );

      setMessage(
        "NHL pick removed."
      );
    } catch (error) {
      setIsError(true);

      setMessage(
        error instanceof Error
          ? error.message
          : "The NHL pick could not be removed."
      );
    } finally {
      setWorkingKey(null);
    }
  }


  async function setConfidence(
    gameId: number,
    marketType: MarketType,
    value: number
  ) {
    if (
      !selectedPeriod ||
      workingKey !== null
    ) {
      return;
    }

    const key =
      `${gameId}:${marketType}:confidence`;

    setWorkingKey(key);
    setMessage("");
    setIsError(false);

    try {
      const {
        error,
      } =
        await supabase.rpc(
          "set_nhl_pickem_confidence_value",
          {
            p_league_id:
              leagueId,

            p_season:
              season,

            p_period_number:
              selectedPeriod.period_number,

            p_nhl_pickem_game_id:
              gameId,

            p_market_type:
              marketType,

            p_confidence_value:
              value,
          }
        );


      if (error) {
        throw new Error(
          error.message
        );
      }


      await loadPeriod(
        selectedPeriod
      );

      setMessage(
        "Confidence value updated."
      );
    } catch (error) {
      setIsError(true);

      setMessage(
        error instanceof Error
          ? error.message
          : "The confidence value could not be updated."
      );
    } finally {
      setWorkingKey(null);
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
        Loading your NHL
        Pick&apos;em card…
      </main>
    );
  }


  const marketMode =
    settings
      ?.market_mode ??
    "puck_line_and_total";

  const puckLineEnabled =
    marketMode ===
      "puck_line_only" ||
    marketMode ===
      "puck_line_and_total";

  const totalEnabled =
    marketMode ===
      "total_only" ||
    marketMode ===
      "puck_line_and_total";

  const confidenceMode =
    settings
      ?.scoring_mode ===
    "confidence";


  return (
    <main
      className="g365-nhl-my-picks"
      style={{
        display:
          "grid",
        gap: 18,
        padding:
          "22px 18px 36px",
        maxWidth: 1180,
        width: "100%",
        minWidth: 0,
      }}
    >
      <style>{`
        .g365-nhl-my-picks * {
          box-sizing: border-box;
        }

        @media (max-width: 760px) {
          .g365-nhl-my-picks {
            padding: 14px 12px 28px !important;
            gap: 14px !important;
            overflow-x: hidden;
          }

          .g365-nhl-my-picks .g365-nhl-summary-grid {
            grid-template-columns:
              repeat(2,minmax(0,1fr)) !important;
          }

          .g365-nhl-my-picks .g365-nhl-team-button {
            grid-template-columns:
              minmax(0,1fr) auto auto !important;
          }
        }

        @media (max-width: 430px) {
          .g365-nhl-my-picks {
            padding: 12px 10px 24px !important;
          }

          .g365-nhl-my-picks .g365-nhl-summary-grid {
            grid-template-columns:
              minmax(0,1fr) !important;
          }
        }
      `}</style>


      <section
        style={{
          display:
            "grid",
          gap: 14,
          padding: 20,
          borderRadius: 18,
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
              margin:
                "7px 0 5px",
              color: "#fff",
              fontSize:
                "clamp(28px,5vw,42px)",
            }}
          >
            My Picks
          </h1>

          <div
            style={{
              color:
                "#a9a9b1",
              lineHeight: 1.55,
            }}
          >
            {teamName} · {season}
            {entry?.entry_name
              ? ` · ${entry.entry_name}`
              : ""}
          </div>
        </div>


        <div
          className="g365-nhl-summary-grid"
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit,minmax(150px,1fr))",
            gap: 10,
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
            label="Markets"
            value={
              marketMode ===
              "puck_line_only"
                ? "PUCK LINE"
                : marketMode ===
                  "total_only"
                  ? "TOTALS"
                  : "PUCK + TOTAL"
            }
          />
        </div>


        <div
          style={{
            padding:
              "10px 12px",
            borderRadius: 10,
            background:
              "rgba(0,0,0,0.24)",
            color: "#c7c7cd",
            fontSize: 13,
            lineHeight: 1.5,
          }}
        >
          Every NHL selection
          remains private until that
          game reaches its start
          time. The frozen G365 puck
          line or total attached to
          your selection is the line
          used when the pick is
          graded.
        </div>
      </section>


      <section
        style={{
          display: "flex",
          gap: 10,
          alignItems:
            "center",
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
          htmlFor="nhl-pickem-period"
          style={{
            color: "#b9b9c0",
            fontSize: 13,
            fontWeight: 800,
          }}
        >
          Period
        </label>

        <select
          id="nhl-pickem-period"
          value={
            selectedPeriodId ??
            ""
          }
          onChange={(
            event
          ) => {
            const next =
              Number(
                event.target.value
              );

            setSelectedPeriodId(
              Number.isFinite(
                next
              )
                ? next
                : null
            );
          }}
          disabled={
            periods.length ===
            0
          }
          style={{
            minWidth: 175,
            padding:
              "10px 12px",
            borderRadius: 10,
            border:
              "1px solid rgba(255,118,39,0.35)",
            background:
              "#09090c",
            color: "#fff",
            fontWeight: 800,
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
                  }{" "}
                  ·{" "}
                  {period.status
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


        {selectedPeriod ? (
          <div
            style={{
              marginLeft:
                "auto",
              color:
                "#8f8f98",
              fontSize: 12,
            }}
          >
            {formatPeriodRange(
              selectedPeriod
            )}
            {" · "}
            Required:{" "}
            <strong
              style={{
                color: "#fff",
              }}
            >
              {
                cardStatus.requiredPicks
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
            borderRadius: 12,
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


      {!entry ? (
        <EmptyState
          title="Your NHL Pick'em entry is not ready."
          description="You are a member of the league, but an active NHL Pick'em entry was not found for this season."
        />
      ) : !selectedPeriod ? (
        <EmptyState
          title="The NHL Pick'em period is not ready yet."
          description="A contest period must be initialized before selections can be made."
        />
      ) : displayGames.length ===
        0 ? (
        <EmptyState
          title={`Period ${selectedPeriod.period_number} has no NHL games loaded yet.`}
          description="The period exists, but its NHL game slate has not been prepared yet."
        />
      ) : (
        <section
          style={{
            display: "grid",
            gap: 12,
          }}
        >
          {displayGames.map(
            ({
              contest,
              game,
              homeTeam,
              awayTeam,
            }) => {
              const state =
                periodGameState(
                  game
                );

              const gameLocked =
                state.started ||
                state.final ||
                Boolean(
                  picksByGame
                    .get(
                      contest.id
                    )
                    ?.some(
                      (pick) =>
                        pick.locked_at !==
                        null
                    )
                );


              const homeLine =
                numericValue(
                  contest.official_home_puck_line
                );

              const awayLine =
                numericValue(
                  contest.official_away_puck_line
                );

              const total =
                numericValue(
                  contest.official_total
                );


              const frozen =
                contest.eligible &&
                contest.is_frozen &&
                contest.line_status ===
                  "frozen";


              const puckAvailable =
                frozen &&
                homeLine !==
                  null &&
                awayLine !==
                  null;

              const totalAvailable =
                frozen &&
                total !==
                  null;


              const puckPick =
                pickByKey.get(
                  `${contest.id}:puck_line`
                );

              const totalPick =
                pickByKey.get(
                  `${contest.id}:total`
                );


              const anotherMarketExists =
                Boolean(
                  puckPick ||
                  totalPick
                );


              const blockNewPuck =
                !settings
                  ?.allow_same_game_multiple_markets &&
                Boolean(
                  totalPick
                ) &&
                !puckPick;

              const blockNewTotal =
                !settings
                  ?.allow_same_game_multiple_markets &&
                Boolean(
                  puckPick
                ) &&
                !totalPick;


              const canSelectPuck =
                puckLineEnabled &&
                puckAvailable &&
                !gameLocked &&
                !blockNewPuck;

              const canSelectTotal =
                totalEnabled &&
                totalAvailable &&
                !gameLocked &&
                !blockNewTotal;


              const homeScore =
                state.final
                  ? contest.final_home_score ??
                    game?.home_score ??
                    null
                  : game?.home_score ??
                    null;

              const awayScore =
                state.final
                  ? contest.final_away_score ??
                    game?.away_score ??
                    null
                  : game?.away_score ??
                    null;


              return (
                <article
                  key={
                    contest.id
                  }
                  style={{
                    overflow:
                      "hidden",
                    borderRadius: 16,
                    border:
                      anotherMarketExists
                        ? "1px solid rgba(255,104,24,0.55)"
                        : "1px solid rgba(255,255,255,0.08)",
                    background:
                      anotherMarketExists
                        ? "linear-gradient(145deg,rgba(100,8,12,0.34),#101014 55%)"
                        : "#101014",
                  }}
                >
                  <div
                    style={{
                      display:
                        "flex",
                      justifyContent:
                        "space-between",
                      gap: 12,
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
                        gap: 8,
                        alignItems:
                          "center",
                        flexWrap:
                          "wrap",
                      }}
                    >
                      <Badge>
                        NHL
                      </Badge>

                      {state.final ? (
                        <Badge>
                          FINAL
                          {game?.is_overtime
                            ? " · OT"
                            : ""}
                          {game?.is_shootout
                            ? " · SO"
                            : ""}
                        </Badge>
                      ) : state.live ? (
                        <Badge>
                          LIVE
                          {game?.period
                            ? ` · P${game.period}`
                            : ""}
                          {game?.display_clock
                            ? ` · ${game.display_clock}`
                            : ""}
                        </Badge>
                      ) : game ? (
                        <span
                          style={{
                            color:
                              "#a3a3aa",
                            fontSize: 12,
                          }}
                        >
                          {formatStartTime(
                            game.start_time
                          )}
                        </span>
                      ) : (
                        <span
                          style={{
                            color:
                              "#777780",
                            fontSize: 12,
                          }}
                        >
                          Game data pending
                        </span>
                      )}
                    </div>


                    <div
                      style={{
                        color:
                          frozen
                            ? "#ff9b59"
                            : "#8e8e97",
                        fontSize: 12,
                        fontWeight: 900,
                      }}
                    >
                      {frozen
                        ? "G365 LINE FROZEN"
                        : contest.line_status
                            .replaceAll(
                              "_",
                              " "
                            )
                            .toUpperCase()}
                    </div>
                  </div>


                  <div
                    style={{
                      display: "grid",
                      gap: 10,
                      padding: 14,
                    }}
                  >
                    {puckLineEnabled ? (
                      <>
                        <MarketHeading
                          title="G365 Puck Line"
                          ready={
                            puckAvailable
                          }
                        />

                        <TeamPickButton
                          label={
                            awayTeam
                              ?.display_name ??
                            "Away Team"
                          }
                          abbreviation={
                            awayTeam
                              ?.abbreviation ??
                            null
                          }
                          logoUrl={
                            awayTeam
                              ?.logo_url ??
                            null
                          }
                          line={
                            awayLine
                          }
                          score={
                            awayScore
                          }
                          selected={
                            puckPick
                              ?.selected_side ===
                            "away"
                          }
                          disabled={
                            !canSelectPuck ||
                            workingKey !==
                              null
                          }
                          onClick={() =>
                            void savePick(
                              contest.id,
                              "puck_line",
                              "away"
                            )
                          }
                        />

                        <TeamPickButton
                          label={
                            homeTeam
                              ?.display_name ??
                            "Home Team"
                          }
                          abbreviation={
                            homeTeam
                              ?.abbreviation ??
                            null
                          }
                          logoUrl={
                            homeTeam
                              ?.logo_url ??
                            null
                          }
                          line={
                            homeLine
                          }
                          score={
                            homeScore
                          }
                          selected={
                            puckPick
                              ?.selected_side ===
                            "home"
                          }
                          disabled={
                            !canSelectPuck ||
                            workingKey !==
                              null
                          }
                          onClick={() =>
                            void savePick(
                              contest.id,
                              "puck_line",
                              "home"
                            )
                          }
                        />


                        {puckPick ? (
                          <PickSummary
                            pick={
                              puckPick
                            }
                            description={
                              puckPick.selected_side ===
                              "home"
                                ? `${
                                    homeTeam
                                      ?.display_name ??
                                    "Home Team"
                                  } ${
                                    numericValue(
                                      puckPick.snapshot_home_puck_line
                                    ) !==
                                    null
                                      ? formatLine(
                                          numericValue(
                                            puckPick.snapshot_home_puck_line
                                          )!
                                        )
                                      : ""
                                  }`
                                : `${
                                    awayTeam
                                      ?.display_name ??
                                    "Away Team"
                                  } ${
                                    numericValue(
                                      puckPick.snapshot_away_puck_line
                                    ) !==
                                    null
                                      ? formatLine(
                                          numericValue(
                                            puckPick.snapshot_away_puck_line
                                          )!
                                        )
                                      : ""
                                  }`
                            }
                            locked={
                              gameLocked
                            }
                            working={
                              workingKey !==
                              null
                            }
                            confidenceMode={
                              confidenceMode
                            }
                            confidenceChoices={
                              confidenceChoices
                            }
                            onRemove={() =>
                              void removePick(
                                contest.id,
                                "puck_line"
                              )
                            }
                            onConfidence={(
                              value
                            ) =>
                              void setConfidence(
                                contest.id,
                                "puck_line",
                                value
                              )
                            }
                          />
                        ) : null}
                      </>
                    ) : null}


                    {totalEnabled ? (
                      <div
                        style={{
                          display: "grid",
                          gap: 8,
                          marginTop:
                            puckLineEnabled
                              ? 8
                              : 0,
                          paddingTop:
                            puckLineEnabled
                              ? 14
                              : 0,
                          borderTop:
                            puckLineEnabled
                              ? "1px solid rgba(255,255,255,0.07)"
                              : "none",
                        }}
                      >
                        <MarketHeading
                          title="G365 Total"
                          ready={
                            totalAvailable
                          }
                          value={
                            total !==
                            null
                              ? total.toFixed(
                                  1
                                )
                              : undefined
                          }
                        />

                        <div
                          style={{
                            display:
                              "grid",
                            gridTemplateColumns:
                              "repeat(2,minmax(0,1fr))",
                            gap: 8,
                          }}
                        >
                          <TotalButton
                            label="OVER"
                            total={
                              total
                            }
                            selected={
                              totalPick
                                ?.selected_side ===
                              "over"
                            }
                            disabled={
                              !canSelectTotal ||
                              workingKey !==
                                null
                            }
                            onClick={() =>
                              void savePick(
                                contest.id,
                                "total",
                                "over"
                              )
                            }
                          />

                          <TotalButton
                            label="UNDER"
                            total={
                              total
                            }
                            selected={
                              totalPick
                                ?.selected_side ===
                              "under"
                            }
                            disabled={
                              !canSelectTotal ||
                              workingKey !==
                                null
                            }
                            onClick={() =>
                              void savePick(
                                contest.id,
                                "total",
                                "under"
                              )
                            }
                          />
                        </div>


                        {totalPick ? (
                          <PickSummary
                            pick={
                              totalPick
                            }
                            description={`${totalPick.selected_side.toUpperCase()} ${
                              numericValue(
                                totalPick.snapshot_total
                              )?.toFixed(
                                1
                              ) ?? ""
                            }`}
                            locked={
                              gameLocked
                            }
                            working={
                              workingKey !==
                              null
                            }
                            confidenceMode={
                              confidenceMode
                            }
                            confidenceChoices={
                              confidenceChoices
                            }
                            onRemove={() =>
                              void removePick(
                                contest.id,
                                "total"
                              )
                            }
                            onConfidence={(
                              value
                            ) =>
                              void setConfidence(
                                contest.id,
                                "total",
                                value
                              )
                            }
                          />
                        ) : null}
                      </div>
                    ) : null}


                    {!frozen ? (
                      <div
                        style={{
                          marginTop: 4,
                          color:
                            "#8f8f98",
                          fontSize: 12,
                          lineHeight: 1.5,
                        }}
                      >
                        {contest.excluded_reason ??
                          "Official G365 lines for this NHL game are not frozen yet."}
                      </div>
                    ) : null}


                    {!settings
                      ?.allow_same_game_multiple_markets &&
                    puckPick &&
                    totalEnabled &&
                    !totalPick ? (
                      <div
                        style={{
                          color:
                            "#898992",
                          fontSize: 11,
                        }}
                      >
                        This league allows
                        only one market
                        selection from the
                        same NHL game.
                      </div>
                    ) : null}


                    {!settings
                      ?.allow_same_game_multiple_markets &&
                    totalPick &&
                    puckLineEnabled &&
                    !puckPick ? (
                      <div
                        style={{
                          color:
                            "#898992",
                          fontSize: 11,
                        }}
                      >
                        This league allows
                        only one market
                        selection from the
                        same NHL game.
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
        borderRadius: 12,
        border:
          "1px solid rgba(255,255,255,0.07)",
        background:
          "rgba(0,0,0,0.26)",
      }}
    >
      <div
        style={{
          marginBottom: 5,
          color: "#8d8d96",
          fontSize: 11,
          fontWeight: 900,
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
          color: accent,
          fontSize: 20,
          fontWeight: 1000,
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
        minHeight: 25,
        padding:
          "4px 8px",
        borderRadius: 999,
        border:
          "1px solid rgba(255,118,39,0.28)",
        background:
          "rgba(255,91,24,0.10)",
        color: "#ff9d5f",
        fontSize: 10,
        fontWeight: 1000,
        letterSpacing:
          "0.08em",
      }}
    >
      {children}
    </span>
  );
}


function MarketHeading({
  title,
  ready,
  value,
}: {
  title: string;
  ready: boolean;
  value?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent:
          "space-between",
        alignItems:
          "center",
        gap: 10,
        color: "#a9a9b1",
        fontSize: 11,
        fontWeight: 900,
        letterSpacing:
          "0.06em",
        textTransform:
          "uppercase",
      }}
    >
      <span>
        {title}
      </span>

      <strong
        style={{
          color:
            ready
              ? "#ff9b59"
              : "#777780",
        }}
      >
        {ready
          ? value ??
            "FROZEN"
          : "NOT FROZEN"}
      </strong>
    </div>
  );
}


function TeamPickButton({
  label,
  abbreviation,
  logoUrl,
  line,
  score,
  selected,
  disabled,
  onClick,
}: {
  label: string;
  abbreviation:
    string | null;
  logoUrl:
    string | null;
  line:
    number | null;
  score:
    number | null;
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className="g365-nhl-team-button"
      type="button"
      onClick={
        onClick
      }
      disabled={
        disabled
      }
      style={{
        width: "100%",
        display: "grid",
        gridTemplateColumns:
          "minmax(0,1fr) auto auto",
        gap: 12,
        alignItems:
          "center",
        minHeight: 64,
        padding:
          "11px 13px",
        borderRadius: 12,
        border:
          selected
            ? "1px solid #ff6926"
            : "1px solid rgba(255,255,255,0.09)",
        background:
          selected
            ? "linear-gradient(90deg,rgba(172,15,19,0.45),rgba(255,101,26,0.17))"
            : "rgba(255,255,255,0.025)",
        color: "#fff",
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
          minWidth: 0,
          display: "flex",
          gap: 10,
          alignItems:
            "center",
        }}
      >
        {logoUrl ? (
          <img
            src={logoUrl}
            alt=""
            width={34}
            height={34}
            style={{
              width: 34,
              height: 34,
              objectFit:
                "contain",
              flexShrink: 0,
            }}
          />
        ) : null}

        <span
          style={{
            minWidth: 0,
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
              whiteSpace:
                "nowrap",
              color: "#fff",
              fontWeight: 900,
              fontSize: 15,
            }}
          >
            {label}
          </span>

          {abbreviation ? (
            <span
              style={{
                display:
                  "block",
                marginTop: 3,
                color:
                  "#84848d",
                fontSize: 11,
                fontWeight: 800,
              }}
            >
              {abbreviation}
            </span>
          ) : null}
        </span>
      </span>


      {score !== null ? (
        <span
          style={{
            color:
              "#d2d2d8",
            fontSize: 18,
            fontWeight: 1000,
          }}
        >
          {score}
        </span>
      ) : null}


      <span
        style={{
          minWidth: 64,
          textAlign:
            "right",
          color:
            line === null
              ? "#777780"
              : selected
                ? "#fff"
                : "#ff9b59",
          fontSize: 17,
          fontWeight: 1000,
        }}
      >
        {line === null
          ? "—"
          : formatLine(
              line
            )}
      </span>
    </button>
  );
}


function TotalButton({
  label,
  total,
  selected,
  disabled,
  onClick,
}: {
  label:
    | "OVER"
    | "UNDER";
  total:
    number | null;
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
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
        width: "100%",
        minHeight: 50,
        padding:
          "10px 12px",
        borderRadius: 11,
        border:
          selected
            ? "1px solid #ff6926"
            : "1px solid rgba(255,255,255,0.09)",
        background:
          selected
            ? "linear-gradient(90deg,rgba(172,15,19,0.45),rgba(255,101,26,0.17))"
            : "rgba(255,255,255,0.025)",
        color: "#fff",
        cursor:
          disabled
            ? "not-allowed"
            : "pointer",
        opacity:
          disabled &&
          !selected
            ? 0.62
            : 1,
        fontWeight: 950,
        textAlign:
          "center",
      }}
    >
      {label}{" "}
      {total !== null
        ? total.toFixed(1)
        : "—"}
    </button>
  );
}


function PickSummary({
  pick,
  description,
  locked,
  working,
  confidenceMode,
  confidenceChoices,
  onRemove,
  onConfidence,
}: {
  pick: PickRow;
  description: string;
  locked: boolean;
  working: boolean;
  confidenceMode:
    boolean;
  confidenceChoices:
    number[];
  onRemove: () => void;
  onConfidence:
    (value: number) => void;
}) {
  const currentConfidence =
    numericValue(
      pick.confidence_value
    );

  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        alignItems:
          "center",
        justifyContent:
          "space-between",
        flexWrap:
          "wrap",
        padding:
          "10px 0 2px",
        color: "#9797a0",
        fontSize: 12,
      }}
    >
      <div>
        <strong
          style={{
            color: "#fff",
          }}
        >
          Your pick:
        </strong>{" "}
        {description}

        {pick.result &&
        pick.result !==
          "pending" ? (
          <>
            {" · "}
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

        {numericValue(
          pick.points_awarded
        ) !== null &&
        pick.graded_at ? (
          <>
            {" · "}
            {
              numericValue(
                pick.points_awarded
              )
            }{" "}
            pts
          </>
        ) : null}
      </div>


      <div
        style={{
          display: "flex",
          gap: 8,
          alignItems:
            "center",
          flexWrap:
            "wrap",
        }}
      >
        {confidenceMode &&
        confidenceChoices.length >
          0 ? (
          <select
            aria-label="Confidence value"
            value={
              currentConfidence ??
              ""
            }
            disabled={
              locked ||
              working
            }
            onChange={(
              event
            ) => {
              const value =
                Number(
                  event.target
                    .value
                );

              if (
                Number.isFinite(
                  value
                )
              ) {
                onConfidence(
                  value
                );
              }
            }}
            style={{
              padding:
                "7px 9px",
              borderRadius: 8,
              border:
                "1px solid rgba(255,118,39,0.30)",
              background:
                "#09090c",
              color: "#fff",
              fontWeight: 800,
            }}
          >
            <option value="">
              Confidence
            </option>

            {confidenceChoices.map(
              (value) => (
                <option
                  key={
                    value
                  }
                  value={
                    value
                  }
                >
                  {value}
                </option>
              )
            )}
          </select>
        ) : null}


        {!locked ? (
          <button
            type="button"
            onClick={
              onRemove
            }
            disabled={
              working
            }
            style={{
              padding:
                "8px 11px",
              borderRadius: 9,
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
              fontWeight: 800,
            }}
          >
            Remove Pick
          </button>
        ) : (
          <span
            style={{
              color:
                "#ffb84a",
              fontWeight: 850,
            }}
          >
            LOCKED
          </span>
        )}
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