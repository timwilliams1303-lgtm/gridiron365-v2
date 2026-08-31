"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  createSupabaseBrowserClient,
} from "@/lib/supabase/browser";

import PickemParticipantManager from "@/components/pickem/PickemParticipantManager";


type Props = {
  leagueId: string;
};


type FootballScope =
  | "college_nfl"
  | "college_only"
  | "nfl_only";


type PickLockMode =
  | "per_game"
  | "full_card";


type ScoringMode =
  | "record_only"
  | "standard"
  | "three_one_zero"
  | "custom"
  | "confidence";


type SettingsRow = {
  season: number;
  football_scope:
    FootballScope;
  picks_per_week:
    number;
  pick_lock_mode:
    PickLockMode;
  minimum_source_books:
    number;
  scoring_mode:
    ScoringMode;
  win_points:
    number | string;
  push_points:
    number | string;
  loss_points:
    number | string;
  confidence_points:
    number[] | null;
  confidence_push_multiplier:
    number | string;
};


type WeekRow = {
  id: number;
  season: number;
  week: number;
  status: string;
  required_picks: number;
  line_day_at:
    string | null;
  finalize_not_before:
    string | null;
  scoring_mode:
    ScoringMode;
};


type GameRow = {
  id: number;
  pickem_week_id: number;
  sport:
    | "ncaaf"
    | "nfl";
  kickoff_at:
    string;
  away_team_name:
    string;
  home_team_name:
    string;
  g365_home_spread:
    number |
    string |
    null;
  spread_status:
    "pending" |
    "published" |
    "frozen" |
    "excluded";
  consensus_source_count:
    number | null;
  exclusion_reason:
    string | null;
  is_started:
    boolean;
  is_final:
    boolean;
};


type LineRow = {
  id: number;
  pickem_game_id:
    number;
  captured_at:
    string;
  source_provider:
    string;
  sportsbook_key:
    string;
  sportsbook_name:
    string | null;
  home_spread:
    number |
    string;
};


function formatSpread(
  value:
    number |
    string |
    null
) {
  if (
    value === null
  ) {
    return "—";
  }

  const parsed =
    Number(value);

  if (
    !Number.isFinite(
      parsed
    )
  ) {
    return "—";
  }

  if (
    parsed ===
    0
  ) {
    return "PK";
  }

  return parsed >
    0
    ? `+${parsed}`
    : String(parsed);
}


function datetimeLocalToIso(
  value:
    string
) {
  if (!value) {
    return null;
  }

  const date =
    new Date(
      value
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    throw new Error(
      "One of the lifecycle dates is invalid."
    );
  }

  return date.toISOString();
}


export default function PickemCommissioner({
  leagueId,
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
    saving,
    setSaving,
  ] =
    useState(false);

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
      SettingsRow |
      null
    >(null);

  const [
    footballScope,
    setFootballScope,
  ] =
    useState<FootballScope>(
      "college_nfl"
    );

  const [
    picksPerWeek,
    setPicksPerWeek,
  ] =
    useState(5);

  const [
    pickLockMode,
    setPickLockMode,
  ] =
    useState<PickLockMode>(
      "per_game"
    );

  const [
    minimumSourceBooks,
    setMinimumSourceBooks,
  ] =
    useState(3);


  const [
    scoringMode,
    setScoringMode,
  ] =
    useState<ScoringMode>(
      "record_only"
    );

  const [
    winPoints,
    setWinPoints,
  ] =
    useState(1);

  const [
    pushPoints,
    setPushPoints,
  ] =
    useState(0.5);

  const [
    lossPoints,
    setLossPoints,
  ] =
    useState(0);

  const [
    confidencePointsText,
    setConfidencePointsText,
  ] =
    useState(
      "50, 40, 30, 20, 10"
    );

  const [
    confidencePushMultiplier,
    setConfidencePushMultiplier,
  ] =
    useState(0.5);

  const [
    weekNumber,
    setWeekNumber,
  ] =
    useState(1);

  const [
    lineDayAt,
    setLineDayAt,
  ] =
    useState("");

  const [
    finalizeNotBefore,
    setFinalizeNotBefore,
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
    games,
    setGames,
  ] =
    useState<
      GameRow[]
    >([]);

  const [
    lines,
    setLines,
  ] =
    useState<
      LineRow[]
    >([]);

  const [
    sourceProvider,
    setSourceProvider,
  ] =
    useState(
      "manual"
    );

  const [
    sportsbookKey,
    setSportsbookKey,
  ] =
    useState("");

  const [
    sportsbookName,
    setSportsbookName,
  ] =
    useState("");

  const [
    homeSpread,
    setHomeSpread,
  ] =
    useState("");

  const [
    lineGameId,
    setLineGameId,
  ] =
    useState<
      number |
      null
    >(null);


  const [
    activeWeekScoringLocked,
    setActiveWeekScoringLocked,
  ] = useState(false);

  const [
    lifecycleAdvancedOpen,
    setLifecycleAdvancedOpen,
  ] = useState(false);

  const [
    gamesOpen,
    setGamesOpen,
  ] = useState(false);

  const [
    auditOpen,
    setAuditOpen,
  ] = useState(false);

  const [
    manualLineOpen,
    setManualLineOpen,
  ] = useState(false);

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


  const lineSummary =
    useMemo(() => {
      const frozen = games.filter(
        (game) => game.spread_status === "frozen"
      ).length;
      const pending = games.filter(
        (game) =>
          game.spread_status === "pending" ||
          game.spread_status === "published"
      ).length;
      const excluded = games.filter(
        (game) => game.spread_status === "excluded"
      ).length;

      return {
        total: games.length,
        frozen,
        pending,
        excluded,
      };
    }, [games]);

  const activeWeek =
    useMemo(
      () =>
        weeks.find((week) => week.status !== "final") ??
        weeks.at(-1) ??
        null,
      [weeks]
    );


  const load =
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
                "season,football_scope,picks_per_week,pick_lock_mode,minimum_source_books,scoring_mode,win_points,push_points,loss_points,confidence_points,confidence_push_multiplier"
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
                "id,season,week,status,required_picks,line_day_at,finalize_not_before,scoring_mode"
              )
              .eq(
                "league_id",
                leagueId
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

        const nextActiveWeek =
          nextWeeks.find(
            (row) =>
              row.status !==
              "final"
          ) ??
          nextWeeks.at(-1) ??
          null;

        if (nextActiveWeek) {
          const {
            data:
              activeWeekGameData,
            error:
              activeWeekGameError,
          } =
            await supabase
              .from(
                "pickem_games"
              )
              .select(
                "id,is_started,kickoff_at"
              )
              .eq(
                "league_id",
                leagueId
              )
              .eq(
                "pickem_week_id",
                nextActiveWeek.id
              );

          if (
            activeWeekGameError
          ) {
            throw new Error(
              activeWeekGameError.message
            );
          }

          const now =
            Date.now();

          setActiveWeekScoringLocked(
            (
              activeWeekGameData ??
              []
            ).some(
              (game) =>
                game.is_started ===
                  true ||
                (
                  typeof game.kickoff_at ===
                    "string" &&
                  new Date(
                    game.kickoff_at
                  ).getTime() <=
                    now
                )
            )
          );
        } else {
          setActiveWeekScoringLocked(
            false
          );
        }

        setSettings(
          nextSettings
        );

        if (
          nextSettings
        ) {
          setFootballScope(
            nextSettings.football_scope
          );
          setPicksPerWeek(
            nextSettings.picks_per_week
          );
          setPickLockMode(
            nextSettings.pick_lock_mode
          );
          setMinimumSourceBooks(
            nextSettings.minimum_source_books
          );
          setScoringMode(
            nextSettings.scoring_mode ?? "record_only"
          );
          setWinPoints(
            Number(nextSettings.win_points ?? 1)
          );
          setPushPoints(
            Number(nextSettings.push_points ?? 0.5)
          );
          setLossPoints(
            Number(nextSettings.loss_points ?? 0)
          );
          setConfidencePointsText(
            Array.isArray(nextSettings.confidence_points) &&
            nextSettings.confidence_points.length > 0
              ? nextSettings.confidence_points.join(", ")
              : "50, 40, 30, 20, 10"
          );
          setConfidencePushMultiplier(
            Number(nextSettings.confidence_push_multiplier ?? 0.5)
          );
        }

        setWeeks(
          nextWeeks
        );

        setSelectedWeekId(
          (
            current
          ) => {
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

            const active =
              nextWeeks.find(
                (row) =>
                  row.status !==
                  "final"
              );

            return (
              active?.id ??
              nextWeeks.at(-1)
                ?.id ??
              null
            );
          }
        );

        setWeekNumber(
          (
            nextWeeks.at(-1)
              ?.week ??
            0
          ) +
            1
        );
      },
      [
        leagueId,
        supabase,
      ]
    );


  const loadWeekLines =
    useCallback(
      async (
        weekId:
          number |
          null
      ) => {
        if (
          weekId ===
          null
        ) {
          setGames([]);
          setLines([]);
          setLineGameId(
            null
          );
          return;
        }

        const {
          data:
            gameData,
          error:
            gameError,
        } =
          await supabase
            .from(
              "pickem_games"
            )
            .select(
              "id,pickem_week_id,sport,kickoff_at,away_team_name,home_team_name,g365_home_spread,spread_status,consensus_source_count,exclusion_reason,is_started,is_final"
            )
            .eq(
              "league_id",
              leagueId
            )
            .eq(
              "pickem_week_id",
              weekId
            )
            .order(
              "kickoff_at",
              {
                ascending:
                  true,
              }
            );

        if (
          gameError
        ) {
          throw new Error(
            gameError.message
          );
        }

        const nextGames =
          (
            gameData ??
            []
          ) as GameRow[];

        setGames(
          nextGames
        );

        setLineGameId(
          (
            current
          ) =>
            current &&
            nextGames.some(
              (game) =>
                game.id ===
                current
            )
              ? current
              : nextGames[0]
                  ?.id ??
                null
        );

        const ids =
          nextGames.map(
            (game) =>
              game.id
          );

        if (
          ids.length ===
          0
        ) {
          setLines([]);
          return;
        }

        const {
          data:
            lineData,
          error:
            lineError,
        } =
          await supabase
            .from(
              "pickem_line_sources"
            )
            .select(
              "id,pickem_game_id,captured_at,source_provider,sportsbook_key,sportsbook_name,home_spread"
            )
            .in(
              "pickem_game_id",
              ids
            )
            .order(
              "captured_at",
              {
                ascending:
                  false,
              }
            );

        if (
          lineError
        ) {
          throw new Error(
            lineError.message
          );
        }

        setLines(
          (
            lineData ??
            []
          ) as LineRow[]
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
      setLoading(
        true
      );

      try {
        await load();
      } catch (
        error
      ) {
        if (
          !active
        ) {
          return;
        }

        setIsError(
          true
        );
        setMessage(
          error instanceof Error
            ? error.message
            : "Pick'em commissioner controls could not be loaded."
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

    void loadWeekLines(
      selectedWeekId
    );
  }, [
    loading,
    selectedWeekId,
    loadWeekLines,
  ]);


  async function saveSettings(
    event:
      FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setSaving(
      true
    );
    setMessage(
      ""
    );
    setIsError(
      false
    );

    try {
      if (
        !Number.isInteger(
          picksPerWeek
        ) ||
        picksPerWeek <
          1 ||
        picksPerWeek >
          20
      ) {
        throw new Error(
          "Picks required per week must be between 1 and 20."
        );
      }

      const confidencePoints =
        confidencePointsText
          .split(",")
          .map((value) =>
            Number(
              value.trim()
            )
          )
          .filter((value) =>
            Number.isFinite(value)
          );

      if (
        scoringMode ===
          "confidence" &&
        confidencePoints.length !==
          picksPerWeek
      ) {
        throw new Error(
          `Confidence scoring needs exactly ${picksPerWeek} unique point values — one for each required pick.`
        );
      }

      if (
        scoringMode ===
          "confidence" &&
        new Set(
          confidencePoints
        ).size !==
          confidencePoints.length
      ) {
        throw new Error(
          "Each confidence point value must be unique."
        );
      }

      const {
        error,
      } =
        await supabase.rpc(
          "save_pickem_settings_v2",
          {
            p_league_id:
              leagueId,
            p_football_scope:
              footballScope,
            p_picks_per_week:
              picksPerWeek,
            p_pick_lock_mode:
              pickLockMode,
            p_minimum_source_books:
              minimumSourceBooks,
            p_scoring_mode:
              scoringMode,
            p_win_points:
              winPoints,
            p_push_points:
              pushPoints,
            p_loss_points:
              lossPoints,
            p_confidence_points:
              confidencePoints,
            p_confidence_push_multiplier:
              confidencePushMultiplier,
          }
        );

      if (error) {
        throw new Error(
          error.message
        );
      }

      await load();

      setMessage(
        activeWeekScoringLocked
          ? "Pick'em settings saved. The current week's scoring snapshot is locked because games have begun; scoring changes apply to the next unlocked week."
          : "Pick'em settings saved. The active unstarted week and future weeks now use the updated scoring settings."
      );
    } catch (
      error
    ) {
      setIsError(
        true
      );
      setMessage(
        error instanceof Error
          ? error.message
          : "Pick'em settings could not be saved."
      );
    } finally {
      setSaving(
        false
      );
    }
  }


  async function initializeWeek(
    event:
      FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!settings) {
      return;
    }

    setSaving(
      true
    );
    setMessage(
      ""
    );
    setIsError(
      false
    );

    try {
      const {
        error,
      } =
        await supabase.rpc(
          "initialize_pickem_week",
          {
            p_league_id:
              leagueId,
            p_season:
              settings.season,
            p_week:
              weekNumber,
            p_line_day_at:
              datetimeLocalToIso(
                lineDayAt
              ),
            p_finalize_not_before:
              datetimeLocalToIso(
                finalizeNotBefore
              ),
          }
        );

      if (error) {
        throw new Error(
          error.message
        );
      }

      await load();

      setMessage(
        `Pick'em Week ${weekNumber} initialized with the current required-pick setting.`
      );
    } catch (
      error
    ) {
      setIsError(
        true
      );
      setMessage(
        error instanceof Error
          ? error.message
          : "The Pick'em week could not be initialized."
      );
    } finally {
      setSaving(
        false
      );
    }
  }


  async function addSourceLine(
    event:
      FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (
      lineGameId ===
      null
    ) {
      return;
    }

    const spread =
      Number(
        homeSpread
      );

    setSaving(
      true
    );
    setMessage(
      ""
    );
    setIsError(
      false
    );

    try {
      if (
        !sportsbookKey.trim()
      ) {
        throw new Error(
          "Sportsbook key is required."
        );
      }

      if (
        !Number.isFinite(
          spread
        )
      ) {
        throw new Error(
          "A valid home-team spread is required."
        );
      }

      const {
        error,
      } =
        await supabase.rpc(
          "add_pickem_line_source",
          {
            p_pickem_game_id:
              lineGameId,
            p_source_provider:
              sourceProvider,
            p_sportsbook_key:
              sportsbookKey,
            p_sportsbook_name:
              sportsbookName ||
              null,
            p_home_spread:
              spread,
            p_away_spread:
              -spread,
            p_source_event_id:
              null,
            p_source_market_key:
              "spread",
            p_raw_audit:
              {
                entryMode:
                  "commissioner_manual",
              },
          }
        );

      if (error) {
        throw new Error(
          error.message
        );
      }

      setSportsbookKey(
        ""
      );
      setSportsbookName(
        ""
      );
      setHomeSpread(
        ""
      );

      await loadWeekLines(
        selectedWeekId
      );

      setMessage(
        "Source line added to the audit trail."
      );
    } catch (
      error
    ) {
      setIsError(
        true
      );
      setMessage(
        error instanceof Error
          ? error.message
          : "The source line could not be added."
      );
    } finally {
      setSaving(
        false
      );
    }
  }


  async function freezeGame(
    gameId:
      number
  ) {
    setSaving(
      true
    );
    setMessage(
      ""
    );
    setIsError(
      false
    );

    try {
      const {
        data,
        error,
      } =
        await supabase.rpc(
          "freeze_pickem_g365_spread",
          {
            p_pickem_game_id:
              gameId,
          }
        );

      if (error) {
        throw new Error(
          error.message
        );
      }

      await loadWeekLines(
        selectedWeekId
      );

      const response =
        data as {
          success?:
            boolean;
          excluded?:
            boolean;
          sourceCount?:
            number;
        };

      setMessage(
        response.excluded
          ? `Game excluded because only ${response.sourceCount ?? 0} trustworthy source lines were available.`
          : "G365 Spread frozen successfully."
      );
    } catch (
      error
    ) {
      setIsError(
        true
      );
      setMessage(
        error instanceof Error
          ? error.message
          : "The G365 Spread could not be frozen."
      );
    } finally {
      setSaving(
        false
      );
    }
  }


  if (
    loading
  ) {
    return (
      <main
        style={{
          padding:
            24,
          color:
            "#aaaab2",
        }}
      >
        Loading Pick&apos;em commissioner controls…
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
          1100,
        padding:
          "22px 18px 36px",
      }}
    >
      <section>
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
          Commissioner
        </div>

        <h1
          style={{
            margin:
              "6px 0 7px",
            color:
              "#fff",
            fontSize:
              34,
          }}
        >
          G365 Football Pick&apos;em
        </h1>

        <p
          style={{
            margin:
              0,
            color:
              "#a1a1aa",
            lineHeight:
              1.6,
          }}
        >
          Configure the contest, initialize weekly cards, review source sportsbook lines, and freeze the official G365 Spread.
        </p>
      </section>


      {message ? (
        <div
          style={{
            padding:
              12,
            borderRadius:
              10,
            color:
              isError
                ? "#fecaca"
                : "#bbf7d0",
            background:
              isError
                ? "rgba(127,29,29,0.28)"
                : "rgba(20,83,45,0.26)",
            border:
              `1px solid ${
                isError
                  ? "rgba(248,113,113,0.28)"
                  : "rgba(74,222,128,0.24)"
              }`,
          }}
        >
          {message}
        </div>
      ) : null}


      <Panel
        title="League Rules"
        description="League scoring changes update unstarted weeks immediately. Once a week reaches kickoff, that week keeps its scoring snapshot for competitive integrity."
      >
        <form
          onSubmit={
            saveSettings
          }
          style={{
            display:
              "grid",
            gap:
              16,
          }}
        >
          <label
            style={
              styles.label
            }
          >
            Football Slate
            <select
              value={
                footballScope
              }
              onChange={(
                event
              ) =>
                setFootballScope(
                  event.target
                    .value as FootballScope
                )
              }
              style={
                styles.input
              }
            >
              <option value="college_nfl">
                College + NFL
              </option>
              <option value="college_only">
                College only
              </option>
              <option value="nfl_only">
                NFL only
              </option>
            </select>
          </label>

          <label
            style={
              styles.label
            }
          >
            Required Picks Per Week
            <input
              type="number"
              min={
                1
              }
              max={
                20
              }
              value={
                picksPerWeek
              }
              onChange={(
                event
              ) =>
                setPicksPerWeek(
                  Number(
                    event.target
                      .value
                  )
                )
              }
              style={
                styles.input
              }
            />
          </label>

          <label
            style={
              styles.label
            }
          >
            Pick Lock Mode
            <select
              value={
                pickLockMode
              }
              onChange={(
                event
              ) =>
                setPickLockMode(
                  event.target
                    .value as PickLockMode
                )
              }
              style={
                styles.input
              }
            >
              <option value="per_game">
                Per-game lock
              </option>
              <option value="full_card">
                Full-card lock
              </option>
            </select>
          </label>

          <div
            style={{
              display: "grid",
              gap: 12,
              padding: 14,
              borderRadius: 12,
              border: "1px solid rgba(255,108,33,0.18)",
              background: "rgba(255,82,20,0.04)",
            }}
          >
            <label style={styles.label}>
              Pick&apos;em Scoring System
              <select
                value={scoringMode}
                onChange={(event) => {
                  const mode =
                    event.target.value as ScoringMode;
                  setScoringMode(mode);

                  if (mode === "standard") {
                    setWinPoints(1);
                    setPushPoints(0.5);
                    setLossPoints(0);
                  } else if (mode === "three_one_zero") {
                    setWinPoints(3);
                    setPushPoints(1);
                    setLossPoints(0);
                  }
                }}
                style={styles.input}
              >
                <option value="record_only">
                  Record Only — no points
                </option>
                <option value="standard">
                  Standard — Win 1 / Push 0.5 / Loss 0
                </option>
                <option value="three_one_zero">
                  3 / 1 / 0 — Win 3 / Push 1 / Loss 0
                </option>
                <option value="custom">
                  Custom Win / Push / Loss Points
                </option>
                <option value="confidence">
                  Confidence Points
                </option>
              </select>
            </label>

            {scoringMode === "record_only" ? (
              <Info>
                Standings are determined by ATS record. No pick points are awarded.
              </Info>
            ) : null}

            {scoringMode === "standard" ||
            scoringMode === "three_one_zero" ? (
              <Info>
                Current scoring: Win {winPoints} · Push {pushPoints} · Loss {lossPoints}.
              </Info>
            ) : null}

            {scoringMode === "custom" ? (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(3,minmax(0,1fr))",
                  gap: 10,
                }}
              >
                <label style={styles.label}>
                  Win Points
                  <input
                    type="number"
                    step="0.25"
                    value={winPoints}
                    onChange={(event) =>
                      setWinPoints(
                        Number(event.target.value)
                      )
                    }
                    style={styles.input}
                  />
                </label>
                <label style={styles.label}>
                  Push Points
                  <input
                    type="number"
                    step="0.25"
                    value={pushPoints}
                    onChange={(event) =>
                      setPushPoints(
                        Number(event.target.value)
                      )
                    }
                    style={styles.input}
                  />
                </label>
                <label style={styles.label}>
                  Loss Points
                  <input
                    type="number"
                    step="0.25"
                    value={lossPoints}
                    onChange={(event) =>
                      setLossPoints(
                        Number(event.target.value)
                      )
                    }
                    style={styles.input}
                  />
                </label>
              </div>
            ) : null}

            {scoringMode === "confidence" ? (
              <>
                <label style={styles.label}>
                  Confidence Values
                  <input
                    type="text"
                    value={confidencePointsText}
                    onChange={(event) =>
                      setConfidencePointsText(
                        event.target.value
                      )
                    }
                    placeholder="50, 40, 30, 20, 10"
                    style={styles.input}
                  />
                  <span style={styles.help}>
                    Enter exactly one unique value for every required weekly pick. For 5 picks, the default is 50, 40, 30, 20, 10.
                  </span>
                </label>

                <label style={styles.label}>
                  Push Credit
                  <select
                    value={confidencePushMultiplier}
                    onChange={(event) =>
                      setConfidencePushMultiplier(
                        Number(event.target.value)
                      )
                    }
                    style={styles.input}
                  >
                    <option value={0}>
                      0% of confidence value
                    </option>
                    <option value={0.5}>
                      50% of confidence value
                    </option>
                    <option value={1}>
                      100% of confidence value
                    </option>
                  </select>
                </label>

                <Info>
                  Members assign each confidence value once per weekly card. A winning ATS pick earns its assigned confidence value.
                </Info>
              </>
            ) : null}
          </div>

          {activeWeek ? (
            <div
              style={{
                display:
                  "grid",
                gap:
                  10,
                padding:
                  14,
                borderRadius:
                  12,
                border:
                  activeWeekScoringLocked
                    ? "1px solid rgba(248,113,113,0.28)"
                    : "1px solid rgba(74,222,128,0.24)",
                background:
                  activeWeekScoringLocked
                    ? "rgba(127,29,29,0.16)"
                    : "rgba(20,83,45,0.14)",
              }}
            >
              <div
                style={{
                  display:
                    "grid",
                  gridTemplateColumns:
                    "repeat(auto-fit,minmax(170px,1fr))",
                  gap:
                    10,
                }}
              >
                <StatusCard
                  label="League Scoring"
                  value={formatScoringMode(
                    scoringMode
                  )}
                />
                <StatusCard
                  label={`Week ${activeWeek.week} Scoring`}
                  value={formatScoringMode(
                    activeWeek.scoring_mode
                  )}
                />
                <StatusCard
                  label={`Week ${activeWeek.week} Scoring Status`}
                  value={
                    activeWeekScoringLocked
                      ? "LOCKED"
                      : "UNLOCKED"
                  }
                  good={
                    !activeWeekScoringLocked
                  }
                />
              </div>

              <div
                style={{
                  color:
                    activeWeekScoringLocked
                      ? "#fecaca"
                      : "#bbf7d0",
                  fontSize:
                    13,
                  lineHeight:
                    1.6,
                }}
              >
                {activeWeekScoringLocked
                  ? `Week ${activeWeek.week} has reached kickoff, so its scoring system cannot change. Saving a new league scoring system will apply beginning with the next unlocked week.`
                  : `Week ${activeWeek.week} has not reached kickoff. Saving changes now will update this week's scoring snapshot and future unlocked weeks.`}
              </div>
            </div>
          ) : null}

          <label
            style={
              styles.label
            }
          >
            Minimum Sportsbook Sources
            <input
              type="number"
              min={
                1
              }
              max={
                20
              }
              value={
                minimumSourceBooks
              }
              onChange={(
                event
              ) =>
                setMinimumSourceBooks(
                  Number(
                    event.target
                      .value
                  )
                )
              }
              style={
                styles.input
              }
            />
          </label>

          <Info>
            Pick privacy remains fixed: every individual selection stays hidden from the league until that specific game reaches kickoff.
          </Info>

          <ActionButton
            disabled={
              saving
            }
          >
            SAVE PICK&apos;EM SETTINGS
          </ActionButton>
        </form>
      </Panel>


      <Panel
        title="Weekly Lifecycle"
        description="Pick'em weeks are prepared automatically. Use this panel to review the current lifecycle; manual initialization is reserved for commissioner exceptions."
      >
        {activeWeek ? (
          <div
            style={{
              display: "grid",
              gap: 12,
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit,minmax(150px,1fr))",
                gap: 10,
              }}
            >
              <StatusCard
                label="Current Week"
                value={`Week ${activeWeek.week}`}
              />
              <StatusCard
                label="Status"
                value={activeWeek.status.toUpperCase()}
              />
              <StatusCard
                label="Required Picks"
                value={String(activeWeek.required_picks)}
              />
              <StatusCard
                label="Lifecycle"
                value="AUTOMATIC"
                good
              />
            </div>

            <div
              style={{
                padding: 13,
                borderRadius: 11,
                border:
                  "1px solid rgba(255,255,255,0.08)",
                background:
                  "rgba(255,255,255,0.025)",
                color: "#b7b7c0",
                fontSize: 13,
                lineHeight: 1.65,
              }}
            >
              <div>
                <strong style={{ color: "#fff" }}>
                  G365 line windows:
                </strong>{" "}
                Tuesday 10:00 AM ET for Tuesday–Thursday games,
                then Thursday 10:00 AM ET for Friday–Monday games.
              </div>
              <div>
                <strong style={{ color: "#fff" }}>
                  Finalization gate:
                </strong>{" "}
                {activeWeek.finalize_not_before
                  ? new Date(
                      activeWeek.finalize_not_before
                    ).toLocaleString()
                  : "Automatically assigned by the weekly lifecycle."}
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                setLifecycleAdvancedOpen(
                  (current) => !current
                )
              }
              style={styles.secondaryButton}
            >
              {lifecycleAdvancedOpen
                ? "HIDE COMMISSIONER OVERRIDE"
                : "ADVANCED / COMMISSIONER OVERRIDE"}
            </button>

            {lifecycleAdvancedOpen ? (
              <>
                <Info>
                  Normal weeks do not need manual initialization.
                  Use this only to repair or create a week when the
                  automatic lifecycle requires an exception.
                </Info>

                <form
                  onSubmit={initializeWeek}
                  style={{
                    display: "grid",
                    gap: 14,
                    padding: 14,
                    borderRadius: 12,
                    border:
                      "1px solid rgba(255,107,31,0.22)",
                    background:
                      "rgba(255,82,20,0.035)",
                  }}
                >
                  <label style={styles.label}>
                    Pick&apos;em Week
                    <input
                      type="number"
                      min={1}
                      max={25}
                      value={weekNumber}
                      onChange={(event) =>
                        setWeekNumber(
                          Number(event.target.value)
                        )
                      }
                      style={styles.input}
                    />
                  </label>

                  <label style={styles.label}>
                    G365 Line Day Override
                    <input
                      type="datetime-local"
                      value={lineDayAt}
                      onChange={(event) =>
                        setLineDayAt(event.target.value)
                      }
                      style={styles.input}
                    />
                  </label>

                  <label style={styles.label}>
                    Finalize Not Before Override
                    <input
                      type="datetime-local"
                      value={finalizeNotBefore}
                      onChange={(event) =>
                        setFinalizeNotBefore(
                          event.target.value
                        )
                      }
                      style={styles.input}
                    />
                  </label>

                  <ActionButton
                    disabled={saving || !settings}
                  >
                    INITIALIZE / REPAIR WEEK
                  </ActionButton>
                </form>
              </>
            ) : null}

            {weeks.length > 0 ? (
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  overflowX: "auto",
                  paddingBottom: 4,
                }}
              >
                {weeks.map((week) => (
                  <button
                    key={week.id}
                    type="button"
                    onClick={() =>
                      setSelectedWeekId(week.id)
                    }
                    style={{
                      ...styles.secondaryButton,
                      whiteSpace: "nowrap",
                      border:
                        selectedWeekId === week.id
                          ? "1px solid rgba(255,107,31,0.65)"
                          : styles.secondaryButton.border,
                      background:
                        selectedWeekId === week.id
                          ? "rgba(255,93,20,0.10)"
                          : styles.secondaryButton.background,
                    }}
                  >
                    Week {week.week} · {week.status} ·{" "}
                    {week.required_picks} picks
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <Info>
            No Pick&apos;em week is available yet. The automatic
            lifecycle will prepare the contest week.
          </Info>
        )}
      </Panel>


      <Panel
        title="G365 Lines & Audit"
        description="Official G365 spreads are populated automatically from sportsbook sources and frozen by the scheduled Tuesday/Thursday line windows."
      >
        {!selectedWeek ? (
          <Info>
            Select a week to review its G365 line status.
          </Info>
        ) : games.length === 0 ? (
          <Info>
            Week {selectedWeek.week} currently has no games loaded.
            ESPN game synchronization and weekly preparation run
            automatically.
          </Info>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit,minmax(140px,1fr))",
                gap: 10,
              }}
            >
              <StatusCard
                label="Week"
                value={`Week ${selectedWeek.week}`}
              />
              <StatusCard
                label="Games"
                value={String(lineSummary.total)}
              />
              <StatusCard
                label="Frozen"
                value={String(lineSummary.frozen)}
                good={lineSummary.frozen > 0}
              />
              <StatusCard
                label="Pending"
                value={String(lineSummary.pending)}
              />
              <StatusCard
                label="Excluded"
                value={String(lineSummary.excluded)}
              />
            </div>

            <div
              style={{
                color: "#aaaab3",
                fontSize: 13,
                lineHeight: 1.6,
              }}
            >
              Week {selectedWeek.week} · {lineSummary.total} games
              {" · "}
              {lineSummary.frozen} frozen
              {" · "}
              {lineSummary.pending} pending
              {" · "}
              {lineSummary.excluded} excluded
            </div>

            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                onClick={() =>
                  setGamesOpen((current) => !current)
                }
                style={styles.secondaryButton}
              >
                {gamesOpen ? "HIDE GAMES" : "VIEW GAMES"}
              </button>

              <button
                type="button"
                onClick={() =>
                  setAuditOpen((current) => !current)
                }
                style={styles.secondaryButton}
              >
                {auditOpen
                  ? "HIDE LINE AUDIT"
                  : "VIEW LINE AUDIT"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setManualLineOpen(
                    (current) => !current
                  );
                  if (lineGameId === null && games[0]) {
                    setLineGameId(games[0].id);
                  }
                }}
                style={styles.secondaryButton}
              >
                {manualLineOpen
                  ? "HIDE MANUAL OVERRIDE"
                  : "ADVANCED LINE OVERRIDE"}
              </button>
            </div>

            {gamesOpen ? (
              <div
                style={{
                  display: "grid",
                  gap: 8,
                }}
              >
                {games.map((game) => (
                  <div
                    key={game.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 12,
                      flexWrap: "wrap",
                      padding: "11px 12px",
                      borderRadius: 10,
                      border:
                        "1px solid rgba(255,255,255,0.08)",
                      background:
                        "rgba(255,255,255,0.02)",
                    }}
                  >
                    <div>
                      <strong style={{ color: "#fff" }}>
                        {game.away_team_name} @{" "}
                        {game.home_team_name}
                      </strong>
                      <div
                        style={{
                          marginTop: 4,
                          color: "#888891",
                          fontSize: 12,
                        }}
                      >
                        {game.sport.toUpperCase()} ·{" "}
                        {new Date(
                          game.kickoff_at
                        ).toLocaleString()}{" "}
                        · {game.consensus_source_count ?? 0}{" "}
                        consensus sources
                      </div>
                    </div>

                    <strong
                      style={{
                        color:
                          game.spread_status === "frozen"
                            ? "#55df8a"
                            : game.spread_status ===
                              "excluded"
                            ? "#ff8b7d"
                            : "#ff9b59",
                        fontSize: 12,
                      }}
                    >
                      {game.spread_status === "frozen"
                        ? `G365 ${formatSpread(
                            game.g365_home_spread
                          )}`
                        : game.spread_status.toUpperCase()}
                    </strong>
                  </div>
                ))}
              </div>
            ) : null}

            {auditOpen ? (
              <div
                style={{
                  display: "grid",
                  gap: 10,
                  padding: 14,
                  borderRadius: 12,
                  border:
                    "1px solid rgba(255,255,255,0.08)",
                  background:
                    "rgba(255,255,255,0.02)",
                }}
              >
                {games.map((game) => {
                  const gameLines = lines.filter(
                    (line) =>
                      line.pickem_game_id === game.id
                  );

                  return (
                    <div
                      key={game.id}
                      style={{
                        display: "grid",
                        gap: 6,
                        paddingBottom: 10,
                        borderBottom:
                          "1px solid rgba(255,255,255,0.06)",
                      }}
                    >
                      <strong style={{ color: "#fff" }}>
                        {game.away_team_name} @{" "}
                        {game.home_team_name}
                      </strong>
                      <div
                        style={{
                          color: "#8f8f98",
                          fontSize: 12,
                        }}
                      >
                        {gameLines.length} audit line
                        {gameLines.length === 1 ? "" : "s"} ·{" "}
                        {game.consensus_source_count ?? 0}{" "}
                        consensus sources ·{" "}
                        {game.spread_status}
                      </div>

                      {gameLines.slice(0, 5).map((line) => (
                        <div
                          key={line.id}
                          style={{
                            display: "flex",
                            justifyContent:
                              "space-between",
                            gap: 10,
                            color: "#b9b9c1",
                            fontSize: 12,
                          }}
                        >
                          <span>
                            {line.sportsbook_name ??
                              line.sportsbook_key}{" "}
                            · {line.source_provider}
                          </span>
                          <strong
                            style={{ color: "#fff" }}
                          >
                            HOME{" "}
                            {formatSpread(
                              line.home_spread
                            )}
                          </strong>
                        </div>
                      ))}

                      {game.exclusion_reason ? (
                        <div
                          style={{
                            color: "#ffb4a8",
                            fontSize: 12,
                          }}
                        >
                          {game.exclusion_reason}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : null}

            {manualLineOpen && lineGameId !== null ? (
              <form
                onSubmit={addSourceLine}
                style={{
                  display: "grid",
                  gap: 12,
                  padding: 15,
                  borderRadius: 12,
                  border:
                    "1px solid rgba(255,108,33,0.20)",
                  background:
                    "rgba(100,8,12,0.13)",
                }}
              >
                <strong style={{ color: "#fff" }}>
                  Commissioner Line Override
                </strong>

                <Info>
                  Automatic sportsbook ingestion and freezing are
                  the normal path. These controls are only for an
                  unusual line exception or audit repair.
                </Info>

                <label style={styles.label}>
                  Game
                  <select
                    value={lineGameId}
                    onChange={(event) =>
                      setLineGameId(
                        Number(event.target.value)
                      )
                    }
                    style={styles.input}
                  >
                    {games.map((game) => (
                      <option
                        key={game.id}
                        value={game.id}
                      >
                        {game.away_team_name} @{" "}
                        {game.home_team_name}
                      </option>
                    ))}
                  </select>
                </label>

                <label style={styles.label}>
                  Source Provider
                  <input
                    value={sourceProvider}
                    onChange={(event) =>
                      setSourceProvider(
                        event.target.value
                      )
                    }
                    style={styles.input}
                  />
                </label>

                <label style={styles.label}>
                  Sportsbook Key
                  <input
                    value={sportsbookKey}
                    onChange={(event) =>
                      setSportsbookKey(
                        event.target.value
                      )
                    }
                    placeholder="example-book-key"
                    style={styles.input}
                  />
                </label>

                <label style={styles.label}>
                  Sportsbook Name
                  <input
                    value={sportsbookName}
                    onChange={(event) =>
                      setSportsbookName(
                        event.target.value
                      )
                    }
                    placeholder="Optional display name"
                    style={styles.input}
                  />
                </label>

                <label style={styles.label}>
                  Home Team Spread
                  <input
                    type="number"
                    step="0.5"
                    value={homeSpread}
                    onChange={(event) =>
                      setHomeSpread(event.target.value)
                    }
                    placeholder="-3.5"
                    style={styles.input}
                  />
                </label>

                <ActionButton disabled={saving}>
                  SAVE SOURCE LINE
                </ActionButton>

                <button
                  type="button"
                  disabled={
                    saving ||
                    games.find(
                      (game) => game.id === lineGameId
                    )?.spread_status === "frozen"
                  }
                  onClick={() =>
                    void freezeGame(lineGameId)
                  }
                  style={styles.freezeButton}
                >
                  MANUALLY FREEZE SELECTED GAME
                </button>
              </form>
            ) : null}
          </div>
        )}
      </Panel>


      <PickemParticipantManager
        leagueId={
          leagueId
        }
      />
    </main>
  );
}


function formatScoringMode(
  mode:
    ScoringMode
) {
  switch (mode) {
    case "standard":
      return "STANDARD 1 / 0.5 / 0";
    case "three_one_zero":
      return "3 / 1 / 0";
    case "custom":
      return "CUSTOM";
    case "confidence":
      return "CONFIDENCE";
    case "record_only":
    default:
      return "RECORD ONLY";
  }
}


function Panel({
  title,
  description,
  children,
}: {
  title:
    string;
  description:
    string;
  children:
    React.ReactNode;
}) {
  return (
    <section
      style={{
        padding:
          20,
        borderRadius:
          16,
        border:
          "1px solid rgba(255,102,0,0.22)",
        background:
          "#111115",
      }}
    >
      <h2
        style={{
          margin:
            0,
          color:
            "#fff",
          fontSize:
            21,
        }}
      >
        {title}
      </h2>

      <p
        style={{
          margin:
            "6px 0 16px",
          color:
            "#8f8f98",
          lineHeight:
            1.55,
          fontSize:
            13,
        }}
      >
        {description}
      </p>

      {children}
    </section>
  );
}


function StatusCard({
  label,
  value,
  good = false,
}: {
  label: string;
  value: string;
  good?: boolean;
}) {
  return (
    <div
      style={{
        padding: "12px 13px",
        borderRadius: 11,
        border:
          "1px solid rgba(255,255,255,0.08)",
        background:
          "rgba(255,255,255,0.025)",
      }}
    >
      <div
        style={{
          color: "#85858f",
          fontSize: 11,
          fontWeight: 900,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
      <div
        style={{
          marginTop: 5,
          color: good ? "#55df8a" : "#fff",
          fontSize: 16,
          fontWeight: 1000,
        }}
      >
        {value}
      </div>
    </div>
  );
}


function Info({
  children,
}: {
  children:
    React.ReactNode;
}) {
  return (
    <div
      style={{
        padding:
          13,
        borderRadius:
          11,
        border:
          "1px solid rgba(52,211,153,0.18)",
        background:
          "rgba(16,185,129,0.065)",
        color:
          "#c9f7e5",
        lineHeight:
          1.55,
        fontSize:
          13,
      }}
    >
      {children}
    </div>
  );
}


function ActionButton({
  disabled,
  children,
}: {
  disabled:
    boolean;
  children:
    React.ReactNode;
}) {
  return (
    <button
      type="submit"
      disabled={
        disabled
      }
      style={{
        minHeight:
          46,
        border:
          0,
        borderRadius:
          11,
        cursor:
          disabled
            ? "wait"
            : "pointer",
        fontWeight:
          1000,
        letterSpacing:
          "0.04em",
        color:
          "#fff",
        background:
          "linear-gradient(135deg,#a80d18,#ff6500)",
        opacity:
          disabled
            ? 0.65
            : 1,
      }}
    >
      {children}
    </button>
  );
}


const styles:
  Record<
    string,
    React.CSSProperties
  > = {
  label: {
    display:
      "grid",
    gap:
      8,
    color:
      "#f4f4f5",
    fontSize:
      13,
    fontWeight:
      900,
  },

  input: {
    minHeight:
      44,
    width:
      "100%",
    padding:
      "10px 12px",
    borderRadius:
      10,
    border:
      "1px solid rgba(255,255,255,0.12)",
    background:
      "#09090b",
    color:
      "#fff",
    outline:
      "none",
  },

  help: {
    color:
      "#8f8f98",
    fontSize:
      12,
    fontWeight:
      500,
    lineHeight:
      1.5,
  },

  secondaryButton: {
    padding:
      "8px 10px",
    borderRadius:
      9,
    border:
      "1px solid rgba(255,255,255,0.12)",
    background:
      "rgba(255,255,255,0.04)",
    color:
      "#d0d0d6",
    fontSize:
      11,
    fontWeight:
      900,
    cursor:
      "pointer",
  },

  freezeButton: {
    padding:
      "8px 10px",
    borderRadius:
      9,
    border:
      "1px solid rgba(255,107,31,0.45)",
    background:
      "linear-gradient(135deg,rgba(160,14,20,0.35),rgba(255,102,0,0.25))",
    color:
      "#fff",
    fontSize:
      11,
    fontWeight:
      1000,
    cursor:
      "pointer",
  },
};
