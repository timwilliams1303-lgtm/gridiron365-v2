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


type WeekRow = {
  id: number;
  week: number;
  status: string;
};


type GameRow = {
  id: number;
  pickem_week_id: number;
  sport:
    | "ncaaf"
    | "nfl";
  kickoff_at: string;
  away_team_name: string;
  away_team_abbreviation:
    string | null;
  home_team_name: string;
  home_team_abbreviation:
    string | null;
  away_score:
    number | null;
  home_score:
    number | null;
  status_name:
    string | null;
  status_detail:
    string | null;
  period:
    number | null;
  display_clock:
    string | null;
  is_started:
    boolean;
  is_final:
    boolean;
  is_eligible:
    boolean;
  exclusion_reason:
    string | null;
  g365_home_spread:
    number |
    string |
    null;
  spread_status:
    | "pending"
    | "published"
    | "frozen"
    | "excluded";
  consensus_source_count:
    number | null;
  last_score_sync_at:
    string | null;
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
    value === 0
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


function atsState(
  game:
    GameRow
) {
  const spread =
    numberValue(
      game.g365_home_spread
    );

  if (
    spread === null ||
    game.home_score ===
      null ||
    game.away_score ===
      null ||
    !game.is_started
  ) {
    return null;
  }

  const margin =
    game.home_score +
    spread -
    game.away_score;

  if (
    Math.abs(
      margin
    ) <
    0.0001
  ) {
    return game.is_final
      ? "ATS PUSH"
      : "ATS CURRENTLY PUSH";
  }

  if (
    margin > 0
  ) {
    return game.is_final
      ? "HOME COVERED"
      : "HOME CURRENTLY COVERING";
  }

  return game.is_final
    ? "AWAY COVERED"
    : "AWAY CURRENTLY COVERING";
}


function liveStatus(
  game:
    GameRow
) {
  if (
    game.is_final
  ) {
    return "FINAL";
  }

  if (
    game.is_started
  ) {
    const parts =
      [
        "LIVE",
      ];

    if (
      game.period
    ) {
      parts.push(
        `Q${game.period}`
      );
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

  return formatKickoff(
    game.kickoff_at
  );
}


export default function PickemGames({
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
              "id,week,status"
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

        const rows =
          (
            data ??
            []
          ) as WeekRow[];

        setWeeks(
          rows
        );

        setSelectedWeekId(
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
        weekId:
          number |
          null
      ) => {
        if (
          weekId ===
          null
        ) {
          setGames([]);
          return;
        }

        const {
          data,
          error,
        } =
          await supabase
            .from(
              "pickem_games"
            )
            .select(
              "id,pickem_week_id,sport,kickoff_at,away_team_name,away_team_abbreviation,home_team_name,home_team_abbreviation,away_score,home_score,status_name,status_detail,period,display_clock,is_started,is_final,is_eligible,exclusion_reason,g365_home_spread,spread_status,consensus_source_count,last_score_sync_at"
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

        if (error) {
          throw new Error(
            error.message
          );
        }

        setGames(
          (
            data ??
            []
          ) as GameRow[]
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
      setMessage(
        ""
      );

      try {
        await loadWeeks();
      } catch (error) {
        if (!active) {
          return;
        }

        setMessage(
          error instanceof Error
            ? error.message
            : "Pick'em weeks could not be loaded."
        );
      } finally {
        if (active) {
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
        await loadGames(
          selectedWeekId
        );
      } catch (error) {
        if (!active) {
          return;
        }

        setMessage(
          error instanceof Error
            ? error.message
            : "Pick'em games could not be loaded."
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
      active =
        false;

      window.clearInterval(
        timer
      );
    };
  }, [
    loadGames,
    loading,
    selectedWeekId,
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
        Loading Pick&apos;em games…
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
          padding:
            20,
          borderRadius:
            18,
          border:
            "1px solid rgba(255,108,33,0.25)",
          background:
            "linear-gradient(135deg, rgba(100,7,13,0.38), rgba(17,17,21,0.98) 58%)",
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
              "7px 0 6px",
            color:
              "#fff",
            fontSize:
              "clamp(28px, 5vw, 42px)",
          }}
        >
          Games
        </h1>

        <p
          style={{
            margin:
              0,
            color:
              "#a3a3ab",
            lineHeight:
              1.55,
          }}
        >
          ESPN game state feeds the live score, quarter, clock, and final result. The G365 Spread remains frozen separately and never changes from later market movement.
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
          htmlFor="games-week"
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
          id="games-week"
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
          <span
            style={{
              marginLeft:
                "auto",
              color:
                "#909099",
              fontSize:
                12,
              fontWeight:
                800,
            }}
          >
            {selectedWeek.status
              .replaceAll(
                "_",
                " "
              )
              .toUpperCase()}
          </span>
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
          title="The weekly slate is not ready yet."
          description="A Pick'em week must be initialized before ESPN games can be attached to it."
        />
      ) : games.length ===
        0 ? (
        <EmptyState
          title={`No Week ${selectedWeek.week} games are loaded yet.`}
          description="The ESPN sync worker has not populated this Pick'em slate yet."
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
          {games.map(
            (game) => {
              const homeSpread =
                numberValue(
                  game.g365_home_spread
                );

              const awaySpread =
                homeSpread ===
                null
                  ? null
                  : -homeSpread;

              const ats =
                atsState(
                  game
                );

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
                      gap:
                        12,
                      flexWrap:
                        "wrap",
                      padding:
                        "10px 14px",
                      borderBottom:
                        "1px solid rgba(255,255,255,0.06)",
                      background:
                        "rgba(0,0,0,0.22)",
                    }}
                  >
                    <span
                      style={{
                        color:
                          game.sport ===
                          "nfl"
                            ? "#ff9b59"
                            : "#ffc36b",
                        fontSize:
                          11,
                        fontWeight:
                          1000,
                        letterSpacing:
                          "0.09em",
                      }}
                    >
                      {game.sport ===
                      "nfl"
                        ? "NFL"
                        : "COLLEGE"}
                    </span>

                    <span
                      style={{
                        color:
                          game.is_started
                            ? "#fff"
                            : "#a0a0a8",
                        fontSize:
                          12,
                        fontWeight:
                          game.is_started
                            ? 1000
                            : 700,
                      }}
                    >
                      {liveStatus(
                        game
                      )}
                    </span>
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
                    <TeamRow
                      name={
                        game.away_team_name
                      }
                      abbreviation={
                        game.away_team_abbreviation
                      }
                      score={
                        game.away_score
                      }
                      spread={
                        awaySpread
                      }
                    />

                    <TeamRow
                      name={
                        game.home_team_name
                      }
                      abbreviation={
                        game.home_team_abbreviation
                      }
                      score={
                        game.home_score
                      }
                      spread={
                        homeSpread
                      }
                    />
                  </div>


                  <div
                    style={{
                      display:
                        "flex",
                      justifyContent:
                        "space-between",
                      gap:
                        10,
                      alignItems:
                        "center",
                      flexWrap:
                        "wrap",
                      padding:
                        "10px 14px 13px",
                      borderTop:
                        "1px solid rgba(255,255,255,0.05)",
                    }}
                  >
                    <span
                      style={{
                        color:
                          game.spread_status ===
                          "frozen"
                            ? "#ff9b59"
                            : "#898992",
                        fontSize:
                          12,
                        fontWeight:
                          850,
                      }}
                    >
                      {game.spread_status ===
                      "frozen"
                        ? `G365 Spread · ${
                            game.consensus_source_count ??
                            0
                          } sources`
                        : game.spread_status ===
                            "excluded"
                          ? "Excluded from Pick'em"
                          : "G365 Spread not frozen yet"}
                    </span>

                    {ats ? (
                      <span
                        style={{
                          color:
                            game.is_final
                              ? "#fff"
                              : "#ffca76",
                          fontSize:
                            12,
                          fontWeight:
                            1000,
                        }}
                      >
                        {ats}
                      </span>
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


function TeamRow({
  name,
  abbreviation,
  score,
  spread,
}: {
  name: string;
  abbreviation:
    string | null;
  score:
    number | null;
  spread:
    number | null;
}) {
  return (
    <div
      style={{
        display:
          "grid",
        gridTemplateColumns:
          "minmax(0, 1fr) auto auto",
        gap:
          12,
        alignItems:
          "center",
        minHeight:
          58,
        padding:
          "10px 12px",
        borderRadius:
          12,
        border:
          "1px solid rgba(255,255,255,0.07)",
        background:
          "rgba(255,255,255,0.025)",
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
            overflow:
              "hidden",
            textOverflow:
              "ellipsis",
            whiteSpace:
              "nowrap",
            color:
              "#fff",
            fontWeight:
              900,
          }}
        >
          {name}
        </div>

        {abbreviation ? (
          <div
            style={{
              marginTop:
                3,
              color:
                "#7f7f88",
              fontSize:
                11,
              fontWeight:
                800,
            }}
          >
            {abbreviation}
          </div>
        ) : null}
      </div>

      <div
        style={{
          minWidth:
            28,
          textAlign:
            "right",
          color:
            "#fff",
          fontSize:
            19,
          fontWeight:
            1000,
        }}
      >
        {score ??
          ""}
      </div>

      <div
        style={{
          minWidth:
            66,
          textAlign:
            "right",
          color:
            spread ===
            null
              ? "#777780"
              : "#ff9b59",
          fontSize:
            16,
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
      </div>
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
