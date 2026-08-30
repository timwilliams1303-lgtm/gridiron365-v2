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
  slate_starts_at:
    string | null;
  slate_ends_at:
    string | null;
  schedule_synced_at:
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
  last_score_sync_at:
    string | null;
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


function formatDateTime(
  value:
    string | null
) {
  if (!value) {
    return "Not available yet";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "Not available yet";
  }

  return date.toLocaleString(
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
      timeZoneName:
        "short",
    }
  );
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
                "season,football_scope,picks_per_week,pick_lock_mode,minimum_source_books"
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
                "id,season,week,status,required_picks,line_day_at,finalize_not_before,slate_starts_at,slate_ends_at,schedule_synced_at"
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
              "id,pickem_week_id,sport,kickoff_at,away_team_name,home_team_name,g365_home_spread,spread_status,consensus_source_count,exclusion_reason,is_started,is_final,last_score_sync_at"
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

      const {
        error,
      } =
        await supabase.rpc(
          "save_pickem_settings",
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


  async function syncLifecycleNow() {
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
        data: sessionData,
      } =
        await supabase.auth
          .getSession();

      const token =
        sessionData.session
          ?.access_token;

      if (!token) {
        throw new Error(
          "Your login session is missing."
        );
      }

      const response =
        await fetch(
          "/api/pickem/commissioner-sync",
          {
            method:
              "POST",
            headers: {
              "Content-Type":
                "application/json",
              Authorization:
                `Bearer ${token}`,
            },
            body:
              JSON.stringify({
                leagueId,
              }),
          }
        );

      const payload =
        (
          await response.json()
        ) as {
          success?:
            boolean;
          error?:
            string;
          sync?: {
            gamesUpserted?:
              number;
            weeksProcessed?:
              number;
          };
        };

      if (
        !response.ok ||
        payload.success !==
          true
      ) {
        throw new Error(
          payload.error ??
          "Automatic Pick'em sync failed."
        );
      }

      await load();

      setMessage(
        `Automatic lifecycle refreshed. ESPN game slate sync completed.`
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
          : "Automatic Pick'em lifecycle sync failed."
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
          Configure the contest, monitor the automatic weekly lifecycle, review source sportsbook lines, and freeze the official G365 Spread.
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
        title="Automatic Weekly Lifecycle"
        description="G365 contest weeks and ESPN game slates are created and maintained automatically. The commissioner only needs to intervene for an unusual schedule correction."
      >
        {weeks.length ===
        0 ? (
          <Info>
            The automatic lifecycle has not prepared the season yet. Use Sync Now once; the scheduled worker will maintain it after that.
          </Info>
        ) : (
          <>
            <div
              style={{
                display:
                  "grid",
                gridTemplateColumns:
                  "repeat(auto-fit,minmax(185px,1fr))",
                gap:
                  10,
              }}
            >
              <LifecycleStat
                label="Current G365 Week"
                value={
                  selectedWeek
                    ? `Week ${selectedWeek.week}`
                    : "—"
                }
              />

              <LifecycleStat
                label="Game Slate"
                value={`${games.length} ESPN games`}
              />

              <LifecycleStat
                label="G365 Line Day"
                value={
                  formatDateTime(
                    selectedWeek
                      ?.line_day_at ??
                    null
                  )
                }
              />

              <LifecycleStat
                label="Finalize Gate"
                value={
                  formatDateTime(
                    selectedWeek
                      ?.finalize_not_before ??
                    null
                  )
                }
              />
            </div>

            {selectedWeek ? (
              <div
                style={{
                  display:
                    "grid",
                  gap:
                    8,
                  marginTop:
                    14,
                  padding:
                    13,
                  borderRadius:
                    12,
                  border:
                    "1px solid rgba(255,255,255,0.08)",
                  background:
                    "rgba(255,255,255,0.025)",
                  color:
                    "#a8a8b1",
                  lineHeight:
                    1.55,
                  fontSize:
                    13,
                }}
              >
                <div>
                  <strong
                    style={{
                      color:
                        "#fff",
                    }}
                  >
                    Slate Window:
                  </strong>{" "}
                  {formatDateTime(
                    selectedWeek
                      .slate_starts_at
                  )}{" "}
                  →{" "}
                  {formatDateTime(
                    selectedWeek
                      .slate_ends_at
                  )}
                </div>

                <div>
                  <strong
                    style={{
                      color:
                        "#fff",
                    }}
                  >
                    Schedule Sync:
                  </strong>{" "}
                  {formatDateTime(
                    selectedWeek
                      .schedule_synced_at
                  )}
                </div>

                <div>
                  Games are grouped by the G365 Tuesday-through-Monday contest window, so College and NFL provider week numbers do not need to match.
                </div>
              </div>
            ) : null}
          </>
        )}

        <div
          style={{
            marginTop:
              14,
            display:
              "flex",
            gap:
              10,
            flexWrap:
              "wrap",
          }}
        >
          <button
            type="button"
            disabled={
              saving
            }
            onClick={() =>
              void syncLifecycleNow()
            }
            style={{
              border:
                "1px solid rgba(255,112,34,0.65)",
              borderRadius:
                10,
              padding:
                "11px 16px",
              color:
                "#fff",
              fontWeight:
                950,
              cursor:
                saving
                  ? "not-allowed"
                  : "pointer",
              background:
                "linear-gradient(135deg,#d60000,#ff5c00)",
              opacity:
                saving
                  ? 0.65
                  : 1,
            }}
          >
            {saving
              ? "SYNCING…"
              : "SYNC NOW"}
          </button>
        </div>

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


function LifecycleStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div
      style={{
        padding:
          13,
        borderRadius:
          12,
        border:
          "1px solid rgba(255,255,255,0.08)",
        background:
          "#0b0b0e",
      }}
    >
      <div
        style={{
          color:
            "#858590",
          fontSize:
            10,
          fontWeight:
            950,
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
          marginTop:
            6,
          color:
            "#fff",
          fontSize:
            14,
          fontWeight:
            900,
          lineHeight:
            1.35,
        }}
      >
        {value}
      </div>
    </div>
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
