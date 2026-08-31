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
  sport: "ncaaf" | "nfl";
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
  is_started: boolean;
  is_final: boolean;
  is_eligible: boolean;
  exclusion_reason:
    string | null;
  g365_home_spread:
    number | string | null;
  spread_status:
    | "pending"
    | "published"
    | "frozen"
    | "excluded";
  consensus_source_count:
    number | null;
  last_score_sync_at:
    string | null;
  possession_team_abbreviation:
    string | null;
  down: number | null;
  distance: number | null;
  yard_line: number | null;
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
};


function numberValue(
  value:
    number | string | null
) {
  if (value === null) {
    return null;
  }

  const parsed =
    Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : null;
}


function formatNumber(
  value: number
) {
  return Number.isInteger(value)
    ? String(value)
    : value
        .toFixed(2)
        .replace(/0+$/, "")
        .replace(/\.$/, "");
}


function formatSpread(
  value: number
) {
  if (
    Math.abs(value) <
    0.0001
  ) {
    return "PK";
  }

  return value > 0
    ? `+${formatNumber(value)}`
    : formatNumber(value);
}


function formatKickoff(
  value: string
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
  game: GameRow
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
    Math.abs(margin) <
    0.0001
  ) {
    return game.is_final
      ? "ATS PUSH"
      : "ATS CURRENTLY PUSH";
  }

  if (margin > 0) {
    return game.is_final
      ? "HOME COVERED"
      : "HOME CURRENTLY COVERING";
  }

  return game.is_final
    ? "AWAY COVERED"
    : "AWAY CURRENTLY COVERING";
}


function liveStatus(
  game: GameRow
) {
  if (game.is_final) {
    return "FINAL";
  }

  if (game.is_started) {
    const parts = ["LIVE"];

    if (game.period) {
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


function situationText(
  game: GameRow
) {
  if (
    !game.is_started ||
    game.is_final
  ) {
    return null;
  }

  const possession =
    game.possession_team_abbreviation;

  const down =
    game.down_distance_text;

  const field =
    game.possession_text;

  if (possession && down) {
    if (
      field &&
      !down.includes(field)
    ) {
      return `${possession} BALL · ${down} · ${field}`;
    }

    return `${possession} BALL · ${down}`;
  }

  if (possession && field) {
    return `${possession} BALL · ${field}`;
  }

  if (possession) {
    return `${possession} BALL`;
  }

  return down ?? field ?? null;
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

  const selectedWeek =
    useMemo(
      () =>
        weeks.find(
          (row) =>
            row.id ===
            selectedWeekId
        ) ?? null,
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
          (data ??
            []) as WeekRow[];

        setWeeks(rows);

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
          number | null
      ) => {
        if (
          weekId === null
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
              "id,pickem_week_id,sport,kickoff_at,away_team_name,away_team_abbreviation,home_team_name,home_team_abbreviation,away_score,home_score,status_name,status_detail,period,display_clock,is_started,is_final,is_eligible,exclusion_reason,g365_home_spread,spread_status,consensus_source_count,last_score_sync_at,possession_team_abbreviation,down,distance,yard_line,yards_to_endzone,down_distance_text,possession_text,is_red_zone,last_play_text"
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
          (data ??
            []) as GameRow[]
        );
      },
      [
        leagueId,
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
            : "Pick'em weeks could not be loaded."
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
        10000
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
    selectedWeekId,
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
        Loading Pick&apos;em games…
      </main>
    );
  }

  return (
    <main
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
      <section
        style={{
          padding: 20,
          borderRadius: 18,
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
            fontSize: 12,
            fontWeight: 1000,
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
            color: "#fff",
            fontSize:
              "clamp(28px, 5vw, 42px)",
          }}
        >
          Games
        </h1>

        <p
          style={{
            margin: 0,
            color:
              "#a3a3ab",
            lineHeight: 1.55,
          }}
        >
          ESPN supplies the live score, quarter, clock, possession, down-and-distance, field position, and final status. G365 spreads remain frozen independently.
        </p>
      </section>

      <section
        style={{
          display: "flex",
          alignItems:
            "center",
          gap: 10,
          flexWrap:
            "wrap",
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
          htmlFor="games-week"
          style={{
            color:
              "#bcbcc3",
            fontSize: 13,
            fontWeight: 900,
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
            minWidth: 155,
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
          <span
            style={{
              marginLeft:
                "auto",
              color:
                "#909099",
              fontSize: 12,
              fontWeight: 800,
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
            borderRadius: 12,
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
      ) : games.length === 0 ? (
        <EmptyState
          title={`No Week ${selectedWeek.week} games are loaded yet.`}
          description="The ESPN sync worker has not populated this Pick'em slate yet."
        />
      ) : (
        <section
          style={{
            display:
              "grid",
            gap: 12,
          }}
        >
          {games.map(
            (game) => {
              const homeSpread =
                numberValue(
                  game.g365_home_spread
                );

              const awaySpread =
                homeSpread === null
                  ? null
                  : -homeSpread;

              const ats =
                atsState(game);

              const situation =
                situationText(
                  game
                );

              return (
                <article
                  key={game.id}
                  style={{
                    overflow:
                      "hidden",
                    borderRadius: 16,
                    border:
                      "1px solid rgba(255,255,255,0.08)",
                    background:
                      "#101014",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
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
                        "rgba(0,0,0,0.22)",
                    }}
                  >
                    <span
                      style={{
                        color:
                          "#ff9b59",
                        fontSize: 11,
                        fontWeight: 1000,
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
                        fontSize: 12,
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
                      gap: 10,
                      padding: 14,
                    }}
                  >
                    <TeamLine
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
                      hasBall={
                        !!game
                          .possession_team_abbreviation &&
                        game
                          .possession_team_abbreviation ===
                          game
                            .away_team_abbreviation
                      }
                    />

                    <TeamLine
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
                      hasBall={
                        !!game
                          .possession_team_abbreviation &&
                        game
                          .possession_team_abbreviation ===
                          game
                            .home_team_abbreviation
                      }
                    />

                    {situation ? (
                      <div
                        style={{
                          padding:
                            "9px 11px",
                          borderRadius: 10,
                          border:
                            game.is_red_zone
                              ? "1px solid rgba(255,143,39,0.28)"
                              : "1px solid rgba(255,255,255,0.07)",
                          background:
                            game.is_red_zone
                              ? "rgba(255,108,33,0.08)"
                              : "rgba(255,255,255,0.025)",
                          color:
                            game.is_red_zone
                              ? "#ffc06f"
                              : "#d4d4da",
                          fontSize: 12,
                          fontWeight: 900,
                        }}
                      >
                        {situation}
                        {game.is_red_zone
                          ? " · RED ZONE"
                          : ""}
                      </div>
                    ) : null}

                    {game.is_started &&
                    !game.is_final &&
                    game.last_play_text ? (
                      <div
                        style={{
                          color:
                            "#92929b",
                          fontSize: 11,
                          lineHeight: 1.45,
                        }}
                      >
                        Last play:{" "}
                        {
                          game.last_play_text
                        }
                      </div>
                    ) : null}

                    <div
                      style={{
                        display: "flex",
                        alignItems:
                          "center",
                        gap: 10,
                        flexWrap:
                          "wrap",
                        paddingTop: 3,
                      }}
                    >
                      <span
                        style={{
                          color:
                            homeSpread !==
                            null
                              ? "#ffb16f"
                              : "#888891",
                          fontSize: 11,
                          fontWeight: 900,
                        }}
                      >
                        {homeSpread !==
                        null
                          ? `G365: ${game.home_team_abbreviation ?? game.home_team_name} ${formatSpread(homeSpread)}`
                          : "G365 Spread pending"}
                      </span>

                      {ats ? (
                        <span
                          style={{
                            color:
                              ats.includes(
                                "PUSH"
                              )
                                ? "#ffc46c"
                                : "#55df8a",
                            fontSize: 11,
                            fontWeight: 1000,
                          }}
                        >
                          {ats}
                        </span>
                      ) : null}

                      {game.last_score_sync_at ? (
                        <span
                          style={{
                            marginLeft:
                              "auto",
                            color:
                              "#707078",
                            fontSize: 10,
                          }}
                        >
                          Synced{" "}
                          {new Date(
                            game.last_score_sync_at
                          ).toLocaleTimeString(
                            undefined,
                            {
                              hour:
                                "numeric",
                              minute:
                                "2-digit",
                              second:
                                "2-digit",
                            }
                          )}
                        </span>
                      ) : null}
                    </div>
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


function TeamLine({
  name,
  abbreviation,
  score,
  spread,
  hasBall,
}: {
  name: string;
  abbreviation:
    string | null;
  score: number | null;
  spread: number | null;
  hasBall: boolean;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns:
          "minmax(0,1fr) auto auto",
        gap: 10,
        alignItems:
          "center",
      }}
    >
      <div
        style={{
          minWidth: 0,
          color: "#fff",
          fontSize: 15,
          fontWeight: 900,
        }}
      >
        {hasBall ? (
          <span
            title="Possession"
            style={{
              marginRight: 7,
              color:
                "#ff8d3a",
              fontSize: 12,
            }}
          >
            ●
          </span>
        ) : null}
        {name}
        {abbreviation ? (
          <span
            style={{
              marginLeft: 7,
              color:
                "#777780",
              fontSize: 10,
              fontWeight: 900,
            }}
          >
            {abbreviation}
          </span>
        ) : null}
      </div>

      <div
        style={{
          color:
            "#ffb16f",
          fontSize: 12,
          fontWeight: 900,
        }}
      >
        {spread === null
          ? "—"
          : formatSpread(
              spread
            )}
      </div>

      <div
        style={{
          minWidth: 28,
          textAlign:
            "right",
          color: "#fff",
          fontSize: 20,
          fontWeight: 1000,
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
