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

type PickemSport = "cfb" | "nfl" | "nhl";
type SportFilter = "all" | PickemSport;
type FootballMarketMode = "spread_only" | "total_only" | "spread_total";
type NhlMarketMode = "puck_line_only" | "total_only" | "puck_line_and_total";

type Props = {
  leagueId: string;
  season: number;
  enabledSports: PickemSport[];
};

type WeekRow = {
  id: number;
  week: number;
  status: string;
};

type FootballGameRow = {
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
  status_name: string | null;
  status_detail: string | null;
  period: number | null;
  display_clock: string | null;
  is_started: boolean;
  is_final: boolean;
  is_eligible: boolean;
  exclusion_reason: string | null;
  g365_home_spread: number | string | null;
  spread_status: string | null;
  consensus_source_count: number | null;
  g365_total: number | string | null;
  total_status: string | null;
  total_consensus_source_count: number | null;
  last_score_sync_at: string | null;
  possession_team_abbreviation: string | null;
  down_distance_text: string | null;
  possession_text: string | null;
  is_red_zone: boolean | null;
  last_play_text: string | null;
};

type NhlPeriodRow = {
  id: number;
  period_number: number;
  status: string;
};

type NhlContestRow = {
  id: number;
  nhl_pickem_period_id: number;
  nhl_game_id: number;
  league_id: string;
  season: number;
  eligible: boolean;
  excluded_reason: string | null;
  official_home_puck_line: number | string | null;
  official_away_puck_line: number | string | null;
  official_total: number | string | null;
  puck_line_source_count: number;
  total_source_count: number;
  freeze_scheduled_at: string | null;
  frozen_at: string | null;
  is_frozen: boolean;
  final_home_score: number | null;
  final_away_score: number | null;
  graded_at: string | null;
  market_mode_at_freeze: string | null;
  line_status: string;
  line_finalized_at: string | null;
};

type NhlGameRow = {
  id: number;
  season: number;
  season_type: string | null;
  game_date: string | null;
  start_time: string;
  away_team_id: number | null;
  home_team_id: number | null;
  away_score: number | null;
  home_score: number | null;
  status_type: string | null;
  status_name: string | null;
  status_detail: string | null;
  period: number | null;
  display_clock: string | null;
  status_completed: boolean | null;
  is_overtime: boolean | null;
  is_shootout: boolean | null;
  venue_name: string | null;
  nhl_game_id: string | number | null;
};

type NhlTeamRow = {
  id: number;
  abbreviation: string;
  name: string | null;
  display_name: string;
  short_name: string | null;
  logo_url: string | null;
};

type NhlDisplayGame = {
  contest: NhlContestRow;
  game: NhlGameRow | null;
  homeTeam: NhlTeamRow | null;
  awayTeam: NhlTeamRow | null;
};

const PICKEM_DAY_TIME_ZONE = "America/New_York";

function gameDayKey(value: string | null): string {
  if (!value) return "unknown";
  const date = new Date(value);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: PICKEM_DAY_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function gameDayLabel(value: string | null): string {
  if (!value) return "TBD";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: PICKEM_DAY_TIME_ZONE,
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function numeric(
  value: number | string | null | undefined
): number | null {
  if (value === null || value === undefined) return null;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatLine(value: number | null): string {
  if (value === null) return "—";
  if (Math.abs(value) < 0.0001) return "PK";

  return value > 0
    ? `+${value}`
    : String(value);
}

function formatTotal(value: number | null): string {
  if (value === null) return "—";
  return value.toFixed(1);
}

function formatKickoff(value: string | null): string {
  if (!value) return "Time TBD";

  return new Date(value).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function sportLabel(sport: PickemSport): string {
  if (sport === "cfb") return "CFB";
  if (sport === "nfl") return "NFL";
  return "NHL";
}

function normalizeStatus(value: string): string {
  return value.replaceAll("_", " ").toUpperCase();
}

function footballLiveStatus(game: FootballGameRow): string {
  if (game.is_final) return "FINAL";

  if (game.is_started) {
    const parts = ["LIVE"];

    if (game.period) {
      parts.push(`Q${game.period}`);
    }

    if (game.display_clock) {
      parts.push(game.display_clock);
    }

    return parts.join(" · ");
  }

  return formatKickoff(game.kickoff_at);
}

function nhlLiveStatus(game: NhlGameRow | null): string {
  if (!game) return "GAME DATA PENDING";

  const upper =
    `${game.status_type ?? ""} ${game.status_name ?? ""}`.toUpperCase();

  if (
    game.status_completed ||
    upper.includes("FINAL")
  ) {
    return "FINAL";
  }

  if (
    upper.includes("IN") ||
    upper.includes("LIVE") ||
    (game.period ?? 0) > 0
  ) {
    const parts = ["LIVE"];

    if (game.period) {
      if (game.period <= 3) {
        parts.push(`P${game.period}`);
      } else if (game.is_shootout) {
        parts.push("SO");
      } else {
        parts.push("OT");
      }
    }

    if (game.display_clock) {
      parts.push(game.display_clock);
    }

    return parts.join(" · ");
  }

  return formatKickoff(game.start_time);
}

function footballSituation(game: FootballGameRow): string | null {
  if (!game.is_started || game.is_final) return null;

  const possession = game.possession_team_abbreviation;
  const down = game.down_distance_text;
  const field = game.possession_text;

  if (possession && down && field && !down.includes(field)) {
    return `${possession} BALL · ${down} · ${field}`;
  }

  if (possession && down) {
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

function FootballTeamLine({
  name,
  abbreviation,
  score,
  spread,
  hasBall,
}: {
  name: string;
  abbreviation: string | null;
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
        alignItems: "center",
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
              color: "#ff8d3a",
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
              color: "#777780",
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
          color: "#ffb16f",
          fontSize: 12,
          fontWeight: 900,
        }}
      >
        {formatLine(spread)}
      </div>

      <div
        style={{
          minWidth: 28,
          textAlign: "right",
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

function NhlTeamLine({
  team,
  score,
  puckLine,
}: {
  team: NhlTeamRow | null;
  score: number | null;
  puckLine: number | null;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns:
          "minmax(0,1fr) auto auto",
        gap: 10,
        alignItems: "center",
      }}
    >
      <div
        style={{
          minWidth: 0,
          display: "flex",
          alignItems: "center",
          gap: 9,
          color: "#fff",
          fontSize: 15,
          fontWeight: 900,
        }}
      >
        {team?.logo_url ? (
          <img
            src={team.logo_url}
            alt=""
            width={28}
            height={28}
            style={{
              width: 28,
              height: 28,
              objectFit: "contain",
              flex: "0 0 auto",
            }}
          />
        ) : null}

        <span style={{ minWidth: 0 }}>
          {team?.display_name ?? "NHL Team"}

          {team?.abbreviation ? (
            <span
              style={{
                marginLeft: 7,
                color: "#777780",
                fontSize: 10,
                fontWeight: 900,
              }}
            >
              {team.abbreviation}
            </span>
          ) : null}
        </span>
      </div>

      <div
        style={{
          color: "#8fc2ff",
          fontSize: 12,
          fontWeight: 900,
        }}
      >
        {formatLine(puckLine)}
      </div>

      <div
        style={{
          minWidth: 28,
          textAlign: "right",
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

export default function MixedPickemGames({
  leagueId,
  season,
  enabledSports,
}: Props) {
  const supabase = useMemo(
    () => createSupabaseBrowserClient(),
    []
  );

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const [weeks, setWeeks] = useState<WeekRow[]>([]);
  const [selectedWeek, setSelectedWeek] =
    useState<number | null>(null);

  const [footballGames, setFootballGames] =
    useState<FootballGameRow[]>([]);

  const [nhlGames, setNhlGames] =
    useState<NhlDisplayGame[]>([]);

  const [sportFilter, setSportFilter] =
    useState<SportFilter>("all");

  const [footballMarketMode, setFootballMarketMode] =
    useState<FootballMarketMode>("spread_total");
  const [nhlMarketMode, setNhlMarketMode] =
    useState<NhlMarketMode>("puck_line_and_total");
  const [selectedGameDayKey, setSelectedGameDayKey] =
    useState<string | null>(null);

  const selectedWeekRow =
    weeks.find((row) => row.week === selectedWeek) ?? null;

  const includesFootball =
    enabledSports.includes("cfb") ||
    enabledSports.includes("nfl");

  const includesNhl =
    enabledSports.includes("nhl");

  const loadSettings = useCallback(async () => {
    const [footballSettings, nhlSettings] = await Promise.all([
      includesFootball
        ? supabase
            .from("pickem_settings")
            .select("pick_market_mode")
            .eq("league_id", leagueId)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      includesNhl
        ? supabase
            .from("nhl_pickem_settings")
            .select("market_mode")
            .eq("league_id", leagueId)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

    if (footballSettings.error) {
      throw new Error(footballSettings.error.message);
    }
    if (nhlSettings.error) {
      throw new Error(nhlSettings.error.message);
    }

    const nextFootball = String(
      (footballSettings.data as { pick_market_mode?: string } | null)
        ?.pick_market_mode ?? "spread_total"
    );
    if (
      nextFootball === "spread_only" ||
      nextFootball === "total_only" ||
      nextFootball === "spread_total"
    ) {
      setFootballMarketMode(nextFootball);
    }

    const nextNhl = String(
      (nhlSettings.data as { market_mode?: string } | null)
        ?.market_mode ?? "puck_line_and_total"
    );
    if (
      nextNhl === "puck_line_only" ||
      nextNhl === "total_only" ||
      nextNhl === "puck_line_and_total"
    ) {
      setNhlMarketMode(nextNhl);
    }
  }, [includesFootball, includesNhl, leagueId, supabase]);

  const loadWeeks = useCallback(async () => {
    const { data, error } =
      await supabase
        .from("pickem_weeks")
        .select("id,week,status")
        .eq("league_id", leagueId)
        .eq("season", season)
        .order("week", {
          ascending: true,
        });

    if (error) {
      throw new Error(error.message);
    }

    const rows =
      (data ?? []) as WeekRow[];

    setWeeks(rows);

    setSelectedWeek((current) => {
      if (
        current !== null &&
        rows.some(
          (row) => row.week === current
        )
      ) {
        return current;
      }

      const active =
        rows.find(
          (row) => row.status !== "final"
        ) ??
        rows.at(-1) ??
        null;

      return active?.week ?? null;
    });
  }, [
    leagueId,
    season,
    supabase,
  ]);

  const loadFootball = useCallback(async () => {
    if (
      !includesFootball ||
      !selectedWeekRow
    ) {
      setFootballGames([]);
      return;
    }

    const { data, error } =
      await supabase
        .from("pickem_games")
        .select(
          "id,pickem_week_id,sport,kickoff_at,away_team_name,away_team_abbreviation,home_team_name,home_team_abbreviation,away_score,home_score,status_name,status_detail,period,display_clock,is_started,is_final,is_eligible,exclusion_reason,g365_home_spread,spread_status,consensus_source_count,g365_total,total_status,total_consensus_source_count,last_score_sync_at,possession_team_abbreviation,down_distance_text,possession_text,is_red_zone,last_play_text"
        )
        .eq("league_id", leagueId)
        .eq(
          "pickem_week_id",
          selectedWeekRow.id
        )
        .order("kickoff_at", {
          ascending: true,
        });

    if (error) {
      throw new Error(error.message);
    }

    const rows =
      (data ?? []) as FootballGameRow[];

    setFootballGames(
      rows.filter((row) => {
        if (
          row.sport === "ncaaf" &&
          !enabledSports.includes("cfb")
        ) {
          return false;
        }

        if (
          row.sport === "nfl" &&
          !enabledSports.includes("nfl")
        ) {
          return false;
        }

        return true;
      })
    );
  }, [
    enabledSports,
    includesFootball,
    leagueId,
    selectedWeekRow,
    supabase,
  ]);

  const loadNhl = useCallback(async () => {
    if (
      !includesNhl ||
      selectedWeek === null
    ) {
      setNhlGames([]);
      return;
    }

    const {
      data: periodData,
      error: periodError,
    } = await supabase
      .from("nhl_pickem_periods")
      .select("id,period_number,status")
      .eq("league_id", leagueId)
      .eq("season", season)
      .eq(
        "period_number",
        selectedWeek
      )
      .maybeSingle();

    if (periodError) {
      throw new Error(periodError.message);
    }

    const period =
      periodData as NhlPeriodRow | null;

    if (!period) {
      setNhlGames([]);
      return;
    }

    const {
      data: contestData,
      error: contestError,
    } = await supabase
      .from("nhl_pickem_games")
      .select(
        "id,nhl_pickem_period_id,nhl_game_id,league_id,season,eligible,excluded_reason,official_home_puck_line,official_away_puck_line,official_total,puck_line_source_count,total_source_count,freeze_scheduled_at,frozen_at,is_frozen,final_home_score,final_away_score,graded_at,market_mode_at_freeze,line_status,line_finalized_at"
      )
      .eq("league_id", leagueId)
      .eq(
        "nhl_pickem_period_id",
        period.id
      )
      .order("id", {
        ascending: true,
      });

    if (contestError) {
      throw new Error(
        contestError.message
      );
    }

    const contests =
      (contestData ?? []) as NhlContestRow[];

    if (contests.length === 0) {
      setNhlGames([]);
      return;
    }

    const gameIds =
      Array.from(
        new Set(
          contests.map(
            (contest) =>
              contest.nhl_game_id
          )
        )
      );

    const {
      data: gameData,
      error: gameError,
    } = await supabase
      .from("nhl_games")
      .select(
        "id,season,season_type,game_date,start_time,away_team_id,home_team_id,away_score,home_score,status_type,status_name,status_detail,period,display_clock,status_completed,is_overtime,is_shootout,venue_name,nhl_game_id"
      )
      .in("id", gameIds);

    if (gameError) {
      throw new Error(gameError.message);
    }

    const games =
      (gameData ?? []) as NhlGameRow[];

    const teamIds =
      Array.from(
        new Set(
          games
            .flatMap((game) => [
              game.home_team_id,
              game.away_team_id,
            ])
            .filter(
              (id): id is number =>
                id !== null
            )
        )
      );

    let teams: NhlTeamRow[] = [];

    if (teamIds.length > 0) {
      const {
        data: teamData,
        error: teamError,
      } = await supabase
        .from("nhl_teams")
        .select(
          "id,abbreviation,name,display_name,short_name,logo_url"
        )
        .in("id", teamIds);

      if (teamError) {
        throw new Error(teamError.message);
      }

      teams =
        (teamData ?? []) as NhlTeamRow[];
    }

    const gameById =
      new Map(
        games.map((game) => [
          game.id,
          game,
        ])
      );

    const teamById =
      new Map(
        teams.map((team) => [
          team.id,
          team,
        ])
      );

    const display =
      contests
        .map(
          (
            contest
          ): NhlDisplayGame => {
            const game =
              gameById.get(
                contest.nhl_game_id
              ) ??
              null;

            return {
              contest,
              game,
              homeTeam:
                game?.home_team_id
                  ? teamById.get(
                      game.home_team_id
                    ) ??
                    null
                  : null,
              awayTeam:
                game?.away_team_id
                  ? teamById.get(
                      game.away_team_id
                    ) ??
                    null
                  : null,
            };
          }
        )
        .sort((a, b) => {
          const aTime =
            a.game
              ? new Date(
                  a.game.start_time
                ).getTime()
              : Number.MAX_SAFE_INTEGER;

          const bTime =
            b.game
              ? new Date(
                  b.game.start_time
                ).getTime()
              : Number.MAX_SAFE_INTEGER;

          return aTime - bTime;
        });

    setNhlGames(display);
  }, [
    includesNhl,
    leagueId,
    season,
    selectedWeek,
    supabase,
  ]);

  useEffect(() => {
    let active = true;

    async function run() {
      setLoading(true);
      setMessage("");

      try {
        await Promise.all([
          loadWeeks(),
          loadSettings(),
        ]);
      } catch (error) {
        if (!active) return;

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
  }, [loadSettings, loadWeeks]);

  useEffect(() => {
    if (loading) return;

    let active = true;

    async function refresh() {
      try {
        await Promise.all([
          loadFootball(),
          loadNhl(),
        ]);
      } catch (error) {
        if (!active) return;

        setMessage(
          error instanceof Error
            ? error.message
            : "Pick'em games could not be refreshed."
        );
      }
    }

    void refresh();

    const timer =
      window.setInterval(
        () => {
          if (
            document.visibilityState ===
            "visible"
          ) {
            void refresh();
          }
        },
        10_000
      );

    const footballChannel =
      supabase
        .channel(
          `mixed-games-football-${leagueId}-${selectedWeek ?? "none"}`
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "pickem_games",
          },
          () => void refresh()
        )
        .subscribe();

    const nhlContestChannel =
      supabase
        .channel(
          `mixed-games-nhl-contest-${leagueId}-${selectedWeek ?? "none"}`
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table:
              "nhl_pickem_games",
          },
          () => void refresh()
        )
        .subscribe();

    const nhlGameChannel =
      supabase
        .channel(
          `mixed-games-nhl-live-${leagueId}-${selectedWeek ?? "none"}`
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "nhl_games",
          },
          () => void refresh()
        )
        .subscribe();

    function onVisibility() {
      if (
        document.visibilityState ===
        "visible"
      ) {
        void refresh();
      }
    }

    document.addEventListener(
      "visibilitychange",
      onVisibility
    );

    return () => {
      active = false;
      window.clearInterval(timer);

      document.removeEventListener(
        "visibilitychange",
        onVisibility
      );

      void supabase.removeChannel(
        footballChannel
      );

      void supabase.removeChannel(
        nhlContestChannel
      );

      void supabase.removeChannel(
        nhlGameChannel
      );
    };
  }, [
    leagueId,
    loadFootball,
    loadNhl,
    loading,
    selectedWeek,
    supabase,
  ]);

  const footballVisible =
    sportFilter === "all"
      ? footballGames
      : footballGames.filter(
          (game) =>
            sportFilter === "cfb"
              ? game.sport === "ncaaf"
              : sportFilter === "nfl"
                ? game.sport === "nfl"
                : false
        );

  const showNhl =
    includesNhl &&
    (
      sportFilter === "all" ||
      sportFilter === "nhl"
    );

  const combinedDayGames = useMemo(() => {
    const items: Array<{
      key: string;
      kickoff: string | null;
      final: boolean;
      kind: "football" | "nhl";
      football?: FootballGameRow;
      nhl?: NhlDisplayGame;
    }> = [];

    for (const game of footballVisible) {
      items.push({
        key: `football-${game.id}`,
        kickoff: game.kickoff_at,
        final: game.is_final,
        kind: "football",
        football: game,
      });
    }

    if (showNhl) {
      for (const item of nhlGames) {
        items.push({
          key: `nhl-${item.contest.id}`,
          kickoff: item.game?.start_time ?? null,
          final: Boolean(item.game?.status_completed),
          kind: "nhl",
          nhl: item,
        });
      }
    }

    return items.sort((a, b) => {
      const aTime = a.kickoff ? new Date(a.kickoff).getTime() : Number.MAX_SAFE_INTEGER;
      const bTime = b.kickoff ? new Date(b.kickoff).getTime() : Number.MAX_SAFE_INTEGER;
      return aTime - bTime;
    });
  }, [footballVisible, nhlGames, showNhl]);

  const gameDays = useMemo(() => {
    const map = new Map<
      string,
      { key: string; label: string; kickoff: string | null; count: number; done: boolean }
    >();

    for (const item of combinedDayGames) {
      const key = gameDayKey(item.kickoff);
      const existing = map.get(key);
      if (!existing) {
        map.set(key, {
          key,
          label: gameDayLabel(item.kickoff),
          kickoff: item.kickoff,
          count: 1,
          done: item.final,
        });
      } else {
        existing.count += 1;
        existing.done = existing.done && item.final;
      }
    }

    return [...map.values()].sort((a, b) => {
      const aTime = a.kickoff ? new Date(a.kickoff).getTime() : Number.MAX_SAFE_INTEGER;
      const bTime = b.kickoff ? new Date(b.kickoff).getTime() : Number.MAX_SAFE_INTEGER;
      return aTime - bTime;
    });
  }, [combinedDayGames]);

  useEffect(() => {
    if (gameDays.length === 0) {
      setSelectedGameDayKey(null);
      return;
    }

    if (
      selectedGameDayKey &&
      gameDays.some((day) => day.key === selectedGameDayKey)
    ) {
      return;
    }

    const next = gameDays.find((day) => !day.done) ?? gameDays.at(-1) ?? null;
    setSelectedGameDayKey(next?.key ?? null);
  }, [gameDays, selectedGameDayKey]);

  const totalGameCount = combinedDayGames.length;

  if (loading) {
    return (
      <main
        style={{
          padding: "22px 18px",
          color: "#aaaab2",
        }}
      >
        Loading Pick&apos;em games…
      </main>
    );
  }

  return (
    <main
      className="g365-mixed-games"
      style={{
        display: "grid",
        gap: 18,
        maxWidth: 1180,
        margin: "0 auto",
        padding: "22px 18px 36px",
      }}
    >
      <style>{`
        .g365-mixed-games,
        .g365-mixed-games * {
          box-sizing: border-box;
        }

        @media (max-width: 760px) {
          .g365-mixed-games {
            width: 100% !important;
            max-width: 100% !important;
            min-width: 0 !important;
            padding: 14px 12px 30px !important;
            gap: 14px !important;
            overflow-x: hidden !important;
          }

          .g365-mixed-games .g365-game-grid {
            grid-template-columns: minmax(0,1fr) !important;
          }

          .g365-mixed-games select {
            width: 100% !important;
            max-width: 100% !important;
          }
        }
      `}</style>

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
            color: "#ff7627",
            fontSize: 12,
            fontWeight: 1000,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
          }}
        >
          G365 Pick&apos;em · Mixed Sports
        </div>

        <h1
          style={{
            margin: "7px 0 6px",
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
            maxWidth: 880,
            color: "#a3a3ab",
            lineHeight: 1.55,
          }}
        >
          Follow one combined G365 contest slate. Football keeps its
          enabled frozen markets, while NHL keeps its own mature line
          engine. Only commissioner-enabled markets are shown below, and
          excluded games remain visible with their exclusion reason.
        </p>
      </section>

      <section
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
          padding: "14px 16px",
          borderRadius: 14,
          border:
            "1px solid rgba(255,255,255,0.08)",
          background: "#111115",
        }}
      >
        <label
          htmlFor="mixed-games-week"
          style={{
            color: "#bcbcc3",
            fontSize: 13,
            fontWeight: 900,
          }}
        >
          Week
        </label>

        <select
          id="mixed-games-week"
          value={selectedWeek ?? ""}
          onChange={(event) => {
            const value =
              Number(event.target.value);

            setSelectedWeek(
              Number.isFinite(value)
                ? value
                : null
            );
          }}
          disabled={weeks.length === 0}
          style={{
            minWidth: 160,
            padding: "10px 12px",
            borderRadius: 10,
            border:
              "1px solid rgba(255,118,39,0.35)",
            background: "#09090c",
            color: "#fff",
            fontWeight: 900,
          }}
        >
          {weeks.length === 0 ? (
            <option value="">
              No week ready
            </option>
          ) : (
            weeks.map((week) => (
              <option
                key={week.id}
                value={week.week}
              >
                Week {week.week} ·{" "}
                {normalizeStatus(
                  week.status
                )}
              </option>
            ))
          )}
        </select>

        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          {(
            [
              ["all", "ALL"],
              ...(enabledSports.includes("cfb")
                ? [["cfb", "CFB"]]
                : []),
              ...(enabledSports.includes("nfl")
                ? [["nfl", "NFL"]]
                : []),
              ...(enabledSports.includes("nhl")
                ? [["nhl", "NHL"]]
                : []),
            ] as Array<
              [SportFilter, string]
            >
          ).map(([value, label]) => {
            const active =
              sportFilter === value;

            return (
              <button
                key={value}
                type="button"
                onClick={() =>
                  setSportFilter(value)
                }
                style={{
                  padding: "9px 13px",
                  borderRadius: 999,
                  border: active
                    ? "1px solid rgba(255,118,39,0.85)"
                    : "1px solid rgba(255,255,255,0.10)",
                  background: active
                    ? "linear-gradient(135deg,#8d1018,#f05a1b)"
                    : "#0b0b0f",
                  color: active
                    ? "#fff"
                    : "#aaaab2",
                  fontSize: 12,
                  fontWeight: 1000,
                  cursor: "pointer",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        {selectedWeekRow ? (
          <span
            style={{
              marginLeft: "auto",
              color: "#909099",
              fontSize: 12,
              fontWeight: 800,
            }}
          >
            {normalizeStatus(
              selectedWeekRow.status
            )} · {totalGameCount} GAMES
          </span>
        ) : null}
      </section>

      {gameDays.length > 0 ? (
        <section
          style={{
            display: "flex",
            gap: 8,
            overflowX: "auto",
            padding: "10px 2px 2px",
            WebkitOverflowScrolling: "touch",
          }}
        >
          {gameDays.map((day) => {
            const active = day.key === selectedGameDayKey;
            return (
              <button
                key={day.key}
                type="button"
                onClick={() => setSelectedGameDayKey(day.key)}
                style={{
                  flex: "0 0 auto",
                  minWidth: 128,
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: active
                    ? "1px solid rgba(255,118,39,0.85)"
                    : "1px solid rgba(255,255,255,0.09)",
                  background: active
                    ? "linear-gradient(135deg,rgba(141,16,24,.92),rgba(240,90,27,.92))"
                    : "#0d0d11",
                  color: active ? "#fff" : "#b2b2ba",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 1000 }}>
                  {day.label}
                </div>
                <div
                  style={{
                    marginTop: 3,
                    color: active ? "rgba(255,255,255,.82)" : "#767680",
                    fontSize: 10,
                    fontWeight: 900,
                  }}
                >
                  {day.count} {day.count === 1 ? "GAME" : "GAMES"}
                  {day.done ? " · FINAL" : ""}
                </div>
              </button>
            );
          })}
        </section>
      ) : null}

      {message ? (
        <div
          style={{
            padding: "12px 14px",
            borderRadius: 12,
            border:
              "1px solid rgba(255,80,80,0.40)",
            background:
              "rgba(120,0,0,0.20)",
            color: "#ff9a9d",
          }}
        >
          {message}
        </div>
      ) : null}

      {totalGameCount === 0 ? (
        <section
          style={{
            padding: 24,
            borderRadius: 16,
            border:
              "1px solid rgba(255,255,255,0.08)",
            background: "#101014",
          }}
        >
          <div
            style={{
              color: "#fff",
              fontWeight: 1000,
            }}
          >
            No games in this view
          </div>

          <div
            style={{
              marginTop: 6,
              color: "#92929b",
              lineHeight: 1.5,
            }}
          >
            This week does not currently have games for the selected
            sport filter.
          </div>
        </section>
      ) : (
        <section
          className="g365-game-grid"
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit,minmax(340px,1fr))",
            gap: 12,
          }}
        >
          {footballVisible
            .filter((game) =>
              selectedGameDayKey === null ||
              gameDayKey(game.kickoff_at) === selectedGameDayKey
            )
            .map((game) => {
              const homeSpread =
                numeric(
                  game.g365_home_spread
                );

              const awaySpread =
                homeSpread === null
                  ? null
                  : -homeSpread;

              const total =
                numeric(
                  game.g365_total
                );

              const situation =
                footballSituation(
                  game
                );

              const sport:
                | "cfb"
                | "nfl" =
                  game.sport ===
                  "ncaaf"
                    ? "cfb"
                    : "nfl";

              return (
                <article
                  key={`football-${game.id}`}
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
                        fontWeight:
                          1000,
                        letterSpacing:
                          "0.09em",
                      }}
                    >
                      {sportLabel(
                        sport
                      )}
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
                      {footballLiveStatus(
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
                    <FootballTeamLine
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
                        !!game.possession_team_abbreviation &&
                        game.possession_team_abbreviation ===
                          game.away_team_abbreviation
                      }
                    />

                    <FootballTeamLine
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
                        !!game.possession_team_abbreviation &&
                        game.possession_team_abbreviation ===
                          game.home_team_abbreviation
                      }
                    />

                    {situation ? (
                      <div
                        style={{
                          padding:
                            "9px 11px",
                          borderRadius:
                            10,
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
                          fontSize:
                            12,
                          fontWeight:
                            900,
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
                          fontSize:
                            11,
                          lineHeight:
                            1.45,
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
                        gap: 10,
                        flexWrap:
                          "wrap",
                        alignItems:
                          "center",
                        paddingTop: 4,
                      }}
                    >
                      {footballMarketMode !== "total_only" ? (
                      <span
                        style={{
                          color:
                            homeSpread !==
                            null
                              ? "#ffb16f"
                              : "#888891",
                          fontSize:
                            11,
                          fontWeight:
                            900,
                        }}
                      >
                        {homeSpread !==
                        null
                          ? `G365 Spread: ${game.home_team_abbreviation ?? game.home_team_name} ${formatLine(
                              homeSpread
                            )}`
                          : "G365 Spread pending"}
                      </span>
                      ) : null}

                      {footballMarketMode !== "spread_only" ? (
                      <span
                        style={{
                          color:
                            total !==
                            null
                              ? "#ffcf8a"
                              : "#888891",
                          fontSize:
                            11,
                          fontWeight:
                            900,
                        }}
                      >
                        {total !==
                        null
                          ? `G365 Total: ${formatTotal(
                              total
                            )}`
                          : "G365 Total pending"}
                      </span>
                      ) : null}
                    </div>

                    <div
                      style={{
                        color:
                          "#6f6f77",
                        fontSize: 10,
                      }}
                    >
                      {game.is_eligible ? "ELIGIBLE" : `EXCLUDED${game.exclusion_reason ? ` · ${game.exclusion_reason}` : ""}`}
                      {footballMarketMode !== "total_only"
                        ? ` · Spread ${normalizeStatus(game.spread_status ?? "pending")} · ${game.consensus_source_count ?? 0} books`
                        : ""}
                      {footballMarketMode !== "spread_only"
                        ? ` · Total ${normalizeStatus(game.total_status ?? "pending")} · ${game.total_consensus_source_count ?? 0} books`
                        : ""}
                    </div>
                  </div>
                </article>
              );
            }
          )}

          {showNhl
            ? nhlGames
                .filter((item) =>
                  selectedGameDayKey === null ||
                  gameDayKey(item.game?.start_time ?? null) === selectedGameDayKey
                )
                .map(
                ({
                  contest,
                  game,
                  homeTeam,
                  awayTeam,
                }) => {
                  const homeLine =
                    numeric(
                      contest.official_home_puck_line
                    );

                  const awayLine =
                    numeric(
                      contest.official_away_puck_line
                    );

                  const total =
                    numeric(
                      contest.official_total
                    );

                  return (
                    <article
                      key={`nhl-${contest.id}`}
                      style={{
                        overflow:
                          "hidden",
                        borderRadius:
                          16,
                        border:
                          "1px solid rgba(90,160,255,0.18)",
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
                            "rgba(15,55,100,0.16)",
                        }}
                      >
                        <span
                          style={{
                            color:
                              "#8fc2ff",
                            fontSize:
                              11,
                            fontWeight:
                              1000,
                            letterSpacing:
                              "0.09em",
                          }}
                        >
                          NHL
                        </span>

                        <span
                          style={{
                            color:
                              "#fff",
                            fontSize:
                              12,
                            fontWeight:
                              900,
                          }}
                        >
                          {nhlLiveStatus(
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
                        <NhlTeamLine
                          team={
                            awayTeam
                          }
                          score={
                            game
                              ?.away_score ??
                            contest.final_away_score
                          }
                          puckLine={
                            awayLine
                          }
                        />

                        <NhlTeamLine
                          team={
                            homeTeam
                          }
                          score={
                            game
                              ?.home_score ??
                            contest.final_home_score
                          }
                          puckLine={
                            homeLine
                          }
                        />

                        {game?.status_detail ? (
                          <div
                            style={{
                              color:
                                "#b7cde8",
                              fontSize:
                                11,
                              lineHeight:
                                1.45,
                            }}
                          >
                            {
                              game.status_detail
                            }
                          </div>
                        ) : null}

                        <div
                          style={{
                            display:
                              "flex",
                            gap: 10,
                            flexWrap:
                              "wrap",
                            alignItems:
                              "center",
                            paddingTop:
                              4,
                          }}
                        >
                          {nhlMarketMode !== "total_only" ? (
                          <span
                            style={{
                              color:
                                contest.is_frozen && homeLine !== null && awayLine !== null
                                  ? "#8fc2ff"
                                  : "#888891",
                              fontSize:
                                11,
                              fontWeight:
                                900,
                            }}
                          >
                            {contest.is_frozen && homeLine !== null && awayLine !== null
                              ? "G365 Puck Line frozen"
                              : "G365 Puck Line pending"}
                          </span>
                          ) : null}

                          {nhlMarketMode !== "puck_line_only" ? (
                          <span
                            style={{
                              color:
                                total !==
                                null
                                  ? "#c6ddff"
                                  : "#888891",
                              fontSize:
                                11,
                              fontWeight:
                                900,
                            }}
                          >
                            {total !==
                            null
                              ? `G365 Total: ${formatTotal(
                                  total
                                )}`
                              : "G365 Total pending"}
                          </span>
                          ) : null}
                        </div>

                        <div
                          style={{
                            color:
                              "#6f6f77",
                            fontSize:
                              10,
                          }}
                        >
                          {contest.eligible ? "ELIGIBLE" : `EXCLUDED${contest.excluded_reason ? ` · ${contest.excluded_reason}` : ""}`}
                          {nhlMarketMode !== "total_only"
                            ? ` · Puck Line ${contest.puck_line_source_count} books`
                            : ""}
                          {nhlMarketMode !== "puck_line_only"
                            ? ` · Total ${contest.total_source_count} books`
                            : ""}
                          {` · ${normalizeStatus(contest.line_status)}`}
                        </div>

                        {game?.venue_name ? (
                          <div
                            style={{
                              color:
                                "#6f6f77",
                              fontSize:
                                10,
                            }}
                          >
                            {
                              game.venue_name
                            }
                          </div>
                        ) : null}
                      </div>
                    </article>
                  );
                }
              )
            : null}
        </section>
      )}
    </main>
  );
}

