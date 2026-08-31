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
                "id,season,week,status,required_picks,line_day_at,finalize_not_before"
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
        "Pick'em settings saved. Existing initialized weeks keep their required-pick snapshot."
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
        description="Changes apply to newly initialized weeks. Existing weeks keep their required-pick snapshot."
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
        description="Initialize the weekly card before ESPN game sync. Set the Line Day timestamp and the earliest official finalization time."
      >
        <form
          onSubmit={
            initializeWeek
          }
          style={{
            display:
              "grid",
            gap:
              14,
          }}
        >
          <label
            style={
              styles.label
            }
          >
            Pick&apos;em Week
            <input
              type="number"
              min={
                1
              }
              max={
                25
              }
              value={
                weekNumber
              }
              onChange={(
                event
              ) =>
                setWeekNumber(
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
            G365 Line Day
            <input
              type="datetime-local"
              value={
                lineDayAt
              }
              onChange={(
                event
              ) =>
                setLineDayAt(
                  event.target
                    .value
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
            Finalize Not Before
            <input
              type="datetime-local"
              value={
                finalizeNotBefore
              }
              onChange={(
                event
              ) =>
                setFinalizeNotBefore(
                  event.target
                    .value
                )
              }
              style={
                styles.input
              }
            />

            <span
              style={
                styles.help
              }
            >
              This is the Monday-night/weekly finalization gate. The database will still refuse finalization until every eligible game is final.
            </span>
          </label>

          <ActionButton
            disabled={
              saving ||
              !settings
            }
          >
            INITIALIZE WEEK
          </ActionButton>
        </form>

        {weeks.length >
        0 ? (
          <div
            style={{
              display:
                "grid",
              gap:
                8,
              marginTop:
                16,
            }}
          >
            {weeks.map(
              (
                week
              ) => (
                <button
                  key={
                    week.id
                  }
                  type="button"
                  onClick={() =>
                    setSelectedWeekId(
                      week.id
                    )
                  }
                  style={{
                    display:
                      "flex",
                    justifyContent:
                      "space-between",
                    gap:
                      10,
                    padding:
                      "11px 12px",
                    borderRadius:
                      10,
                    border:
                      selectedWeekId ===
                      week.id
                        ? "1px solid rgba(255,107,31,0.55)"
                        : "1px solid rgba(255,255,255,0.08)",
                    background:
                      selectedWeekId ===
                      week.id
                        ? "rgba(255,93,20,0.09)"
                        : "rgba(255,255,255,0.02)",
                    color:
                      "#fff",
                    cursor:
                      "pointer",
                  }}
                >
                  <strong>
                    Week{" "}
                    {
                      week.week
                    }
                  </strong>

                  <span
                    style={{
                      color:
                        "#9999a2",
                      fontSize:
                        12,
                    }}
                  >
                    {
                      week.status
                    }{" "}
                    ·{" "}
                    {
                      week.required_picks
                    }{" "}
                    picks
                  </span>
                </button>
              )
            )}
          </div>
        ) : null}
      </Panel>


      <Panel
        title="G365 Line Day & Audit"
        description="The official G365 Spread is the median of the latest line from each sportsbook. The normalized ingestion contract is provider-neutral."
      >
        {!selectedWeek ? (
          <Info>
            Initialize and select a week to manage source lines.
          </Info>
        ) : games.length ===
          0 ? (
          <Info>
            Week {selectedWeek.week} has no ESPN games loaded yet. Run the Pick&apos;em game sync after initializing the week.
          </Info>
        ) : (
          <>
            <div
              style={{
                display:
                  "grid",
                gap:
                  10,
              }}
            >
              {games.map(
                (
                  game
                ) => {
                  const gameLines =
                    lines.filter(
                      (
                        line
                      ) =>
                        line.pickem_game_id ===
                        game.id
                    );

                  return (
                    <div
                      key={
                        game.id
                      }
                      style={{
                        display:
                          "grid",
                        gap:
                          9,
                        padding:
                          13,
                        borderRadius:
                          12,
                        border:
                          "1px solid rgba(255,255,255,0.08)",
                        background:
                          "rgba(255,255,255,0.02)",
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
                          flexWrap:
                            "wrap",
                        }}
                      >
                        <strong
                          style={{
                            color:
                              "#fff",
                          }}
                        >
                          {
                            game.away_team_name
                          }{" "}
                          @{" "}
                          {
                            game.home_team_name
                          }
                        </strong>

                        <span
                          style={{
                            color:
                              game.spread_status ===
                              "frozen"
                                ? "#55df8a"
                                : "#ff9b59",
                            fontSize:
                              12,
                            fontWeight:
                              900,
                          }}
                        >
                          {game.spread_status ===
                          "frozen"
                            ? `G365 ${formatSpread(
                                game.g365_home_spread
                              )}`
                            : game.spread_status.toUpperCase()}
                        </span>
                      </div>

                      <div
                        style={{
                          color:
                            "#888891",
                          fontSize:
                            12,
                        }}
                      >
                        {gameLines.length} audit line
                        {gameLines.length ===
                        1
                          ? ""
                          : "s"}{" "}
                        · consensus sources{" "}
                        {
                          game.consensus_source_count ??
                          0
                        }
                      </div>

                      {gameLines
                        .slice(
                          0,
                          5
                        )
                        .map(
                          (
                            line
                          ) => (
                            <div
                              key={
                                line.id
                              }
                              style={{
                                display:
                                  "flex",
                                justifyContent:
                                  "space-between",
                                gap:
                                  10,
                                color:
                                  "#b9b9c1",
                                fontSize:
                                  12,
                              }}
                            >
                              <span>
                                {
                                  line.sportsbook_name ??
                                  line.sportsbook_key
                                }{" "}
                                ·{" "}
                                {
                                  line.source_provider
                                }
                              </span>

                              <strong
                                style={{
                                  color:
                                    "#fff",
                                }}
                              >
                                HOME{" "}
                                {formatSpread(
                                  line.home_spread
                                )}
                              </strong>
                            </div>
                          )
                        )}

                      <div
                        style={{
                          display:
                            "flex",
                          gap:
                            8,
                          flexWrap:
                            "wrap",
                        }}
                      >
                        <button
                          type="button"
                          onClick={() =>
                            setLineGameId(
                              game.id
                            )
                          }
                          disabled={
                            game.spread_status ===
                              "frozen" ||
                            game.is_started ||
                            game.is_final
                          }
                          style={
                            styles.secondaryButton
                          }
                        >
                          ADD SOURCE LINE
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            void freezeGame(
                              game.id
                            )
                          }
                          disabled={
                            saving ||
                            game.spread_status ===
                              "frozen" ||
                            game.is_started ||
                            game.is_final
                          }
                          style={
                            styles.freezeButton
                          }
                        >
                          FREEZE G365 SPREAD
                        </button>
                      </div>

                      {game.exclusion_reason ? (
                        <div
                          style={{
                            color:
                              "#ffb4a8",
                            fontSize:
                              12,
                          }}
                        >
                          {
                            game.exclusion_reason
                          }
                        </div>
                      ) : null}
                    </div>
                  );
                }
              )}
            </div>

            {lineGameId !==
            null ? (
              <form
                onSubmit={
                  addSourceLine
                }
                style={{
                  display:
                    "grid",
                  gap:
                    12,
                  marginTop:
                    16,
                  padding:
                    15,
                  borderRadius:
                    12,
                  border:
                    "1px solid rgba(255,108,33,0.20)",
                  background:
                    "rgba(100,8,12,0.13)",
                }}
              >
                <strong
                  style={{
                    color:
                      "#fff",
                  }}
                >
                  Add normalized sportsbook source line
                </strong>

                <label
                  style={
                    styles.label
                  }
                >
                  Game
                  <select
                    value={
                      lineGameId
                    }
                    onChange={(
                      event
                    ) =>
                      setLineGameId(
                        Number(
                          event.target
                            .value
                        )
                      )
                    }
                    style={
                      styles.input
                    }
                  >
                    {games.map(
                      (
                        game
                      ) => (
                        <option
                          key={
                            game.id
                          }
                          value={
                            game.id
                          }
                        >
                          {
                            game.away_team_name
                          }{" "}
                          @{" "}
                          {
                            game.home_team_name
                          }
                        </option>
                      )
                    )}
                  </select>
                </label>

                <label
                  style={
                    styles.label
                  }
                >
                  Source Provider
                  <input
                    value={
                      sourceProvider
                    }
                    onChange={(
                      event
                    ) =>
                      setSourceProvider(
                        event.target
                          .value
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
                  Sportsbook Key
                  <input
                    value={
                      sportsbookKey
                    }
                    onChange={(
                      event
                    ) =>
                      setSportsbookKey(
                        event.target
                          .value
                      )
                    }
                    placeholder="example-book-key"
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
                  Sportsbook Name
                  <input
                    value={
                      sportsbookName
                    }
                    onChange={(
                      event
                    ) =>
                      setSportsbookName(
                        event.target
                          .value
                      )
                    }
                    placeholder="Optional display name"
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
                  Home Team Spread
                  <input
                    type="number"
                    step="0.5"
                    value={
                      homeSpread
                    }
                    onChange={(
                      event
                    ) =>
                      setHomeSpread(
                        event.target
                          .value
                      )
                    }
                    placeholder="-3.5"
                    style={
                      styles.input
                    }
                  />

                  <span
                    style={
                      styles.help
                    }
                  >
                    Always enter the line from the HOME team&apos;s perspective. HOME -7.5 is entered as -7.5; HOME +3 is entered as +3.
                  </span>
                </label>

                <ActionButton
                  disabled={
                    saving
                  }
                >
                  SAVE SOURCE LINE
                </ActionButton>
              </form>
            ) : null}
          </>
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
