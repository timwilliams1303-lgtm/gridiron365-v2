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

type Props = {
  leagueId: string;
  season: number;
  viewerFantasyTeamId: number | null;
  enabledSports: PickemSport[];
};

type WeekRow = {
  id: number;
  week: number;
  status: string;
  required_picks: number;
};

type FantasyTeamRow = {
  id: number;
  team_name: string;
  owner_id: string | null;
  active: boolean;
};

type WeeklyResultRow = {
  fantasy_team_id: number;
  wins: number;
  losses: number;
  pushes: number;
  pending: number;
  points: number | string;
  is_final: boolean;
  weekly_rank: number | null;
  missing_picks?: number | null;
  is_disqualified?: boolean | null;
};

type FootballPickRow = {
  fantasy_team_id: number;
  team_name: string;
  pick_id: number | null;
  game_id: number | null;
  sport: "ncaaf" | "nfl" | null;
  kickoff_at: string | null;
  away_team_name: string | null;
  home_team_name: string | null;
  away_score: number | null;
  home_score: number | null;
  status_type: string | null;
  status_name: string | null;
  status_detail: string | null;
  is_final: boolean;
  pick_visible: boolean;
  selected_side: "home" | "away" | null;
  frozen_home_spread: number | string | null;
  pick_result: "pending" | "win" | "loss" | "push" | "void" | null;
  points_awarded: number | string | null;
};

type NhlPeriodRow = {
  id: number;
  period_number: number;
  status: string;
};

type NhlPickRow = {
  entry_id: number;
  fantasy_team_id: number;
  entry_name: string;
  user_id: string | null;
  pick_id: number;
  nhl_pickem_game_id: number;
  nhl_game_id: number;
  market_type: "puck_line" | "total";
  selected_side: "home" | "away" | "over" | "under";
  snapshot_home_puck_line: number | string | null;
  snapshot_away_puck_line: number | string | null;
  snapshot_total: number | string | null;
  confidence_value: number | string | null;
  locked_at: string | null;
  result: "pending" | "win" | "loss" | "push" | "void" | null;
  points_awarded: number | string | null;
  start_time: string;
  home_team_id: number | null;
  away_team_id: number | null;
  home_score: number | null;
  away_score: number | null;
  game_status: string | null;
  is_own_entry: boolean;
};

type NhlTeamRow = {
  id: number;
  abbreviation: string;
  display_name: string;
  logo_url: string | null;
};

type UnifiedPick =
  | {
      key: string;
      sport: "cfb" | "nfl";
      fantasyTeamId: number;
      kickoffAt: string | null;
      matchup: string;
      selection: string;
      result: string;
      points: number | null;
      confidence: number | null;
      final: boolean;
      liveText: string | null;
    }
  | {
      key: string;
      sport: "nhl";
      fantasyTeamId: number;
      kickoffAt: string | null;
      matchup: string;
      selection: string;
      result: string;
      points: number | null;
      confidence: number | null;
      final: boolean;
      liveText: string | null;
    };

function numeric(
  value: number | string | null | undefined
): number | null {
  if (value === null || value === undefined) return null;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function signed(value: number): string {
  if (Math.abs(value) < 0.0001) return "PK";
  return value > 0 ? `+${value}` : String(value);
}

function kickoff(value: string | null): string {
  if (!value) return "Time TBD";

  return new Date(value).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function resultLabel(value: string | null): string {
  switch ((value ?? "pending").toLowerCase()) {
    case "win":
      return "WIN";
    case "loss":
      return "LOSS";
    case "push":
      return "PUSH";
    case "void":
      return "VOID";
    case "ungraded":
      return "UNGRADED";
    default:
      return "PENDING";
  }
}

function resultColor(value: string): string {
  switch (value) {
    case "WIN":
      return "#3fd47a";
    case "LOSS":
      return "#ff6b6f";
    case "PUSH":
      return "#ffbf69";
    case "VOID":
    case "UNGRADED":
      return "#a6a6ae";
    default:
      return "#ffb84a";
  }
}

function sportText(sport: PickemSport): string {
  if (sport === "cfb") return "CFB";
  if (sport === "nfl") return "NFL";
  return "NHL";
}

function normalizeStatus(value: string): string {
  return value.replaceAll("_", " ").toUpperCase();
}

export default function MixedPickemLeaguePicks({
  leagueId,
  season,
  viewerFantasyTeamId,
  enabledSports,
}: Props) {
  const supabase = useMemo(
    () => createSupabaseBrowserClient(),
    []
  );

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const [weeks, setWeeks] = useState<WeekRow[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);

  const [teams, setTeams] = useState<FantasyTeamRow[]>([]);
  const [footballRows, setFootballRows] = useState<FootballPickRow[]>([]);
  const [nhlRows, setNhlRows] = useState<NhlPickRow[]>([]);
  const [nhlTeams, setNhlTeams] = useState<NhlTeamRow[]>([]);
  const [results, setResults] = useState<WeeklyResultRow[]>([]);

  const [sportFilter, setSportFilter] = useState<SportFilter>("all");
  const [collapsedTeamIds, setCollapsedTeamIds] = useState<Set<number>>(
    () => new Set()
  );

  const selectedWeekRow =
    weeks.find((row) => row.week === selectedWeek) ?? null;

  const resultsByTeam = useMemo(() => {
    const map = new Map<number, WeeklyResultRow>();

    for (const row of results) {
      map.set(row.fantasy_team_id, row);
    }

    return map;
  }, [results]);

  const nhlTeamById = useMemo(
    () =>
      new Map(
        nhlTeams.map((team) => [
          team.id,
          team,
        ])
      ),
    [nhlTeams]
  );

  const loadShell = useCallback(async () => {
    const [weeksResult, teamsResult] = await Promise.all([
      supabase
        .from("pickem_weeks")
        .select("id,week,status,required_picks")
        .eq("league_id", leagueId)
        .eq("season", season)
        .order("week", { ascending: true }),

      supabase
        .from("fantasy_teams")
        .select("id,team_name,owner_id,active")
        .eq("league_id", leagueId)
        .eq("active", true)
        .order("team_name", { ascending: true }),
    ]);

    if (weeksResult.error) {
      throw new Error(weeksResult.error.message);
    }

    if (teamsResult.error) {
      throw new Error(teamsResult.error.message);
    }

    const nextWeeks = (weeksResult.data ?? []) as WeekRow[];
    const nextTeams = (teamsResult.data ?? []) as FantasyTeamRow[];

    setWeeks(nextWeeks);
    setTeams(nextTeams);

    setSelectedWeek((current) => {
      if (
        current !== null &&
        nextWeeks.some((row) => row.week === current)
      ) {
        return current;
      }

      const active =
        nextWeeks.find((row) => row.status !== "final") ??
        nextWeeks.at(-1) ??
        null;

      return active?.week ?? null;
    });
  }, [leagueId, season, supabase]);

  const loadWeek = useCallback(async () => {
    if (selectedWeek === null || !selectedWeekRow) {
      setFootballRows([]);
      setNhlRows([]);
      setResults([]);
      setNhlTeams([]);
      return;
    }

    const wantsFootball =
      enabledSports.includes("cfb") ||
      enabledSports.includes("nfl");

    const wantsNhl =
      enabledSports.includes("nhl");

    const footballPromise = wantsFootball
      ? supabase.rpc("get_pickem_league_picks", {
          p_league_id: leagueId,
          p_season: season,
          p_week: selectedWeek,
        })
      : Promise.resolve({
          data: [],
          error: null,
        });

    const resultPromise = supabase
      .from("pickem_weekly_results")
      .select(
        "fantasy_team_id,wins,losses,pushes,pending,points,is_final,weekly_rank,missing_picks,is_disqualified"
      )
      .eq("league_id", leagueId)
      .eq("pickem_week_id", selectedWeekRow.id);

    const nhlPeriodPromise = wantsNhl
      ? supabase
          .from("nhl_pickem_periods")
          .select("id,period_number,status")
          .eq("league_id", leagueId)
          .eq("season", season)
          .eq("period_number", selectedWeek)
          .maybeSingle()
      : Promise.resolve({
          data: null,
          error: null,
        });

    const [
      footballResult,
      weeklyResult,
      nhlPeriodResult,
    ] = await Promise.all([
      footballPromise,
      resultPromise,
      nhlPeriodPromise,
    ]);

    if (footballResult.error) {
      throw new Error(footballResult.error.message);
    }

    if (weeklyResult.error) {
      throw new Error(weeklyResult.error.message);
    }

    if (nhlPeriodResult.error) {
      throw new Error(nhlPeriodResult.error.message);
    }

    setFootballRows(
      (footballResult.data ?? []) as FootballPickRow[]
    );

    setResults(
      (weeklyResult.data ?? []) as WeeklyResultRow[]
    );

    const nhlPeriod =
      nhlPeriodResult.data as NhlPeriodRow | null;

    if (!wantsNhl || !nhlPeriod) {
      setNhlRows([]);
      setNhlTeams([]);
      return;
    }

    const nhlPicksResult = await supabase.rpc(
      "get_nhl_pickem_league_picks",
      {
        p_league_id: leagueId,
        p_season: season,
        p_period_number: selectedWeek,
      }
    );

    if (nhlPicksResult.error) {
      throw new Error(nhlPicksResult.error.message);
    }

    const nextNhlRows =
      (nhlPicksResult.data ?? []) as NhlPickRow[];

    setNhlRows(nextNhlRows);

    const ids = Array.from(
      new Set(
        nextNhlRows
          .flatMap((row) => [
            row.home_team_id,
            row.away_team_id,
          ])
          .filter(
            (value): value is number =>
              value !== null
          )
      )
    );

    if (ids.length === 0) {
      setNhlTeams([]);
      return;
    }

    const nhlTeamsResult = await supabase
      .from("nhl_teams")
      .select("id,abbreviation,display_name,logo_url")
      .in("id", ids);

    if (nhlTeamsResult.error) {
      throw new Error(nhlTeamsResult.error.message);
    }

    setNhlTeams(
      (nhlTeamsResult.data ?? []) as NhlTeamRow[]
    );
  }, [
    enabledSports,
    leagueId,
    season,
    selectedWeek,
    selectedWeekRow,
    supabase,
  ]);

  useEffect(() => {
    let active = true;

    async function run() {
      setLoading(true);
      setMessage("");

      try {
        await loadShell();
      } catch (error) {
        if (!active) return;

        setMessage(
          error instanceof Error
            ? error.message
            : "League Picks could not be loaded."
        );
      } finally {
        if (active) setLoading(false);
      }
    }

    void run();

    return () => {
      active = false;
    };
  }, [loadShell]);

  useEffect(() => {
    if (loading) return;

    let active = true;

    async function refresh() {
      try {
        await loadWeek();
      } catch (error) {
        if (!active) return;

        setMessage(
          error instanceof Error
            ? error.message
            : "League Picks could not be refreshed."
        );
      }
    }

    void refresh();

    const timer = window.setInterval(
      () => {
        if (document.visibilityState === "visible") {
          void refresh();
        }
      },
      10_000
    );

    const footballChannel = supabase
      .channel(
        `mixed-league-picks-football-${leagueId}-${selectedWeek ?? "none"}`
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "pickem_picks",
        },
        () => void refresh()
      )
      .subscribe();

    const nhlChannel = supabase
      .channel(
        `mixed-league-picks-nhl-${leagueId}-${selectedWeek ?? "none"}`
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "nhl_pickem_picks",
        },
        () => void refresh()
      )
      .subscribe();

    const resultsChannel = supabase
      .channel(
        `mixed-league-picks-results-${leagueId}-${selectedWeek ?? "none"}`
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "pickem_weekly_results",
        },
        () => void refresh()
      )
      .subscribe();

    function visibleRefresh() {
      if (document.visibilityState === "visible") {
        void refresh();
      }
    }

    document.addEventListener(
      "visibilitychange",
      visibleRefresh
    );

    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener(
        "visibilitychange",
        visibleRefresh
      );
      void supabase.removeChannel(footballChannel);
      void supabase.removeChannel(nhlChannel);
      void supabase.removeChannel(resultsChannel);
    };
  }, [
    leagueId,
    loadWeek,
    loading,
    selectedWeek,
    supabase,
  ]);

  const unifiedPicks = useMemo<UnifiedPick[]>(() => {
    const next: UnifiedPick[] = [];

    for (const row of footballRows) {
      if (
        !row.pick_visible ||
        row.pick_id === null ||
        row.selected_side === null ||
        row.sport === null
      ) {
        continue;
      }

      const sport: "cfb" | "nfl" =
        row.sport === "ncaaf"
          ? "cfb"
          : "nfl";

      if (!enabledSports.includes(sport)) {
        continue;
      }

      const homeSpread =
        numeric(row.frozen_home_spread);

      const awaySpread =
        homeSpread === null
          ? null
          : -homeSpread;

      const selectedTeam =
        row.selected_side === "home"
          ? row.home_team_name
          : row.away_team_name;

      const selectedLine =
        row.selected_side === "home"
          ? homeSpread
          : awaySpread;

      const selection =
        selectedTeam
          ? `${selectedTeam}${
              selectedLine !== null
                ? ` ${signed(selectedLine)}`
                : ""
            }`
          : "Selection";

      const final =
        row.is_final ||
        (row.status_type ?? "")
          .toLowerCase()
          .includes("final");

      next.push({
        key: `football-${row.pick_id}`,
        sport,
        fantasyTeamId: row.fantasy_team_id,
        kickoffAt: row.kickoff_at,
        matchup: `${row.away_team_name ?? "Away"} @ ${row.home_team_name ?? "Home"}`,
        selection,
        result: resultLabel(row.pick_result),
        points: numeric(row.points_awarded),
        confidence: null,
        final,
        liveText:
          final && row.away_score !== null && row.home_score !== null
            ? `${row.away_score}-${row.home_score} FINAL`
            : row.status_detail ?? row.status_name,
      });
    }

    for (const row of nhlRows) {
      const home =
        row.home_team_id !== null
          ? nhlTeamById.get(row.home_team_id)
          : undefined;

      const away =
        row.away_team_id !== null
          ? nhlTeamById.get(row.away_team_id)
          : undefined;

      const homeName =
        home?.display_name ??
        home?.abbreviation ??
        "Home";

      const awayName =
        away?.display_name ??
        away?.abbreviation ??
        "Away";

      let selection: string;

      if (row.market_type === "total") {
        const total =
          numeric(row.snapshot_total);

        selection =
          `${row.selected_side === "over" ? "OVER" : "UNDER"}${
            total !== null
              ? ` ${total}`
              : ""
          }`;
      } else {
        const selectedHome =
          row.selected_side === "home";

        const teamName =
          selectedHome
            ? homeName
            : awayName;

        const line =
          selectedHome
            ? numeric(row.snapshot_home_puck_line)
            : numeric(row.snapshot_away_puck_line);

        selection =
          `${teamName}${
            line !== null
              ? ` ${signed(line)}`
              : ""
          }`;
      }

      const status =
        (row.game_status ?? "").toUpperCase();

      const final =
        status.includes("FINAL");

      next.push({
        key: `nhl-${row.pick_id}`,
        sport: "nhl",
        fantasyTeamId: row.fantasy_team_id,
        kickoffAt: row.start_time,
        matchup: `${awayName} @ ${homeName}`,
        selection,
        result: resultLabel(row.result),
        points: numeric(row.points_awarded),
        confidence: numeric(row.confidence_value),
        final,
        liveText:
          final &&
          row.away_score !== null &&
          row.home_score !== null
            ? `${row.away_score}-${row.home_score} FINAL`
            : row.game_status,
      });
    }

    return next.sort((a, b) => {
      const aTime =
        a.kickoffAt
          ? new Date(a.kickoffAt).getTime()
          : Number.MAX_SAFE_INTEGER;

      const bTime =
        b.kickoffAt
          ? new Date(b.kickoffAt).getTime()
          : Number.MAX_SAFE_INTEGER;

      return aTime - bTime;
    });
  }, [
    enabledSports,
    footballRows,
    nhlRows,
    nhlTeamById,
  ]);

  const filteredPicks = useMemo(
    () =>
      unifiedPicks.filter(
        (pick) =>
          sportFilter === "all" ||
          pick.sport === sportFilter
      ),
    [sportFilter, unifiedPicks]
  );

  const picksByTeam = useMemo(() => {
    const map = new Map<number, UnifiedPick[]>();

    for (const pick of filteredPicks) {
      const current =
        map.get(pick.fantasyTeamId) ?? [];

      current.push(pick);
      map.set(
        pick.fantasyTeamId,
        current
      );
    }

    return map;
  }, [filteredPicks]);

  function toggleTeam(teamId: number) {
    setCollapsedTeamIds((current) => {
      const next = new Set(current);

      if (next.has(teamId)) {
        next.delete(teamId);
      } else {
        next.add(teamId);
      }

      return next;
    });
  }

  function collapseAll() {
    setCollapsedTeamIds(
      new Set(teams.map((team) => team.id))
    );
  }

  function expandAll() {
    setCollapsedTeamIds(new Set());
  }

  const enabledLabel =
    enabledSports
      .map(sportText)
      .join(" + ");

  if (loading) {
    return (
      <main
        style={{
          padding: "22px 18px",
          color: "#aaaab2",
        }}
      >
        Loading league picks…
      </main>
    );
  }

  return (
    <main
      className="g365-mixed-league-picks"
      style={{
        display: "grid",
        gap: 18,
        maxWidth: 1180,
        margin: "0 auto",
        padding: "22px 18px 36px",
      }}
    >
      <style>{`
        .g365-mixed-league-picks,
        .g365-mixed-league-picks * {
          box-sizing: border-box;
        }

        @media (max-width: 760px) {
          .g365-mixed-league-picks {
            padding: 14px 12px 30px !important;
            gap: 14px !important;
          }

          .g365-mixed-league-picks .g365-team-header {
            grid-template-columns: minmax(0,1fr) auto !important;
          }

          .g365-mixed-league-picks .g365-team-record {
            grid-column: 1 / -1;
            text-align: left !important;
          }

          .g365-mixed-league-picks .g365-pick-row {
            grid-template-columns: 52px minmax(0,1fr) !important;
          }

          .g365-mixed-league-picks .g365-pick-result {
            grid-column: 2;
            text-align: left !important;
          }
        }
      `}</style>

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
            letterSpacing: "0.12em",
            textTransform: "uppercase",
          }}
        >
          G365 Pick&apos;em · {enabledLabel}
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
            maxWidth: 880,
            color: "#a6a6ae",
            lineHeight: 1.6,
          }}
        >
          Each team has one combined G365 card. CFB, NFL and NHL picks
          reveal according to their normal game-lock rules, then update
          together inside the same team card.
        </p>
      </section>

      <section
        style={{
          display: "flex",
          gap: 10,
          alignItems: "center",
          flexWrap: "wrap",
          padding: "14px 16px",
          borderRadius: 14,
          border:
            "1px solid rgba(255,255,255,0.08)",
          background: "#111115",
        }}
      >
        <label
          htmlFor="mixed-league-picks-week"
          style={{
            color: "#b9b9c0",
            fontSize: 13,
            fontWeight: 900,
          }}
        >
          Week
        </label>

        <select
          id="mixed-league-picks-week"
          value={selectedWeek ?? ""}
          onChange={(event) => {
            const next =
              Number(event.target.value);

            setSelectedWeek(
              Number.isFinite(next)
                ? next
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

        <div
          style={{
            display: "flex",
            gap: 8,
            marginLeft: "auto",
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            onClick={collapseAll}
            style={{
              padding: "9px 12px",
              borderRadius: 10,
              border:
                "1px solid rgba(255,255,255,0.10)",
              background: "#0b0b0f",
              color: "#c6c6ce",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            Collapse All
          </button>

          <button
            type="button"
            onClick={expandAll}
            style={{
              padding: "9px 12px",
              borderRadius: 10,
              border:
                "1px solid rgba(255,118,39,0.30)",
              background:
                "rgba(255,118,39,0.08)",
              color: "#ff8b45",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            Expand All
          </button>
        </div>
      </section>

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

      {teams.length === 0 ? (
        <section
          style={{
            padding: 20,
            borderRadius: 16,
            border:
              "1px solid rgba(255,255,255,0.08)",
            background: "#111115",
            color: "#aaaab2",
          }}
        >
          No active Pick&apos;em teams found.
        </section>
      ) : (
        <section
          style={{
            display: "grid",
            gap: 12,
          }}
        >
          {teams.map((team) => {
            const teamPicks =
              picksByTeam.get(team.id) ?? [];

            const allRevealed =
              unifiedPicks.filter(
                (pick) =>
                  pick.fantasyTeamId ===
                  team.id
              ).length;

            const result =
              resultsByTeam.get(team.id) ??
              null;

            const collapsed =
              collapsedTeamIds.has(
                team.id
              );

            const viewerTeam =
              viewerFantasyTeamId ===
              team.id;

            const required =
              selectedWeekRow
                ?.required_picks ??
              5;

            return (
              <article
                key={team.id}
                style={{
                  overflow: "hidden",
                  borderRadius: 16,
                  border: viewerTeam
                    ? "1px solid rgba(255,118,39,0.55)"
                    : "1px solid rgba(255,255,255,0.08)",
                  background:
                    viewerTeam
                      ? "linear-gradient(135deg,rgba(110,15,16,0.28),#111115 55%)"
                      : "#111115",
                }}
              >
                <button
                  type="button"
                  onClick={() =>
                    toggleTeam(team.id)
                  }
                  className="g365-team-header"
                  style={{
                    width: "100%",
                    display: "grid",
                    gridTemplateColumns:
                      "minmax(0,1fr) auto auto",
                    gap: 14,
                    alignItems: "center",
                    padding: "15px 16px",
                    border: 0,
                    background:
                      "transparent",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <div
                    style={{
                      minWidth: 0,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems:
                          "center",
                        gap: 8,
                        flexWrap:
                          "wrap",
                      }}
                    >
                      <strong
                        style={{
                          color: "#fff",
                          fontSize: 17,
                        }}
                      >
                        {
                          team.team_name
                        }
                      </strong>

                      {viewerTeam ? (
                        <span
                          style={{
                            padding:
                              "3px 7px",
                            borderRadius:
                              999,
                            background:
                              "rgba(255,118,39,0.14)",
                            color:
                              "#ff8b45",
                            fontSize:
                              10,
                            fontWeight:
                              1000,
                          }}
                        >
                          YOUR TEAM
                        </span>
                      ) : null}
                    </div>

                    <div
                      style={{
                        marginTop: 5,
                        color:
                          "#8f8f98",
                        fontSize: 12,
                      }}
                    >
                      {allRevealed}{" "}
                      revealed of{" "}
                      {required}{" "}
                      required picks
                    </div>
                  </div>

                  <div
                    className="g365-team-record"
                    style={{
                      textAlign:
                        "right",
                    }}
                  >
                    <div
                      style={{
                        color: "#fff",
                        fontWeight:
                          1000,
                      }}
                    >
                      {result
                        ? `${result.wins}-${result.losses}-${result.pushes}`
                        : "0-0-0"}
                    </div>

                    <div
                      style={{
                        marginTop: 3,
                        color:
                          "#8f8f98",
                        fontSize: 11,
                      }}
                    >
                      {result?.is_final &&
                      result.weekly_rank
                        ? `#${result.weekly_rank} FINAL`
                        : result
                          ? `${result.pending} pending`
                          : "No graded picks"}
                    </div>
                  </div>

                  <div
                    style={{
                      color:
                        "#ff8b45",
                      fontSize: 18,
                      fontWeight:
                        1000,
                    }}
                  >
                    {collapsed
                      ? "+"
                      : "−"}
                  </div>
                </button>

                {!collapsed ? (
                  <div
                    style={{
                      display:
                        "grid",
                      gap: 10,
                      padding:
                        "0 16px 16px",
                    }}
                  >
                    {teamPicks.length ===
                    0 ? (
                      <div
                        style={{
                          padding:
                            "14px",
                          borderRadius:
                            12,
                          background:
                            "rgba(0,0,0,0.22)",
                          color:
                            "#8f8f98",
                          fontSize:
                            13,
                          lineHeight:
                            1.5,
                        }}
                      >
                        No{" "}
                        {sportFilter ===
                        "all"
                          ? ""
                          : `${sportText(
                              sportFilter
                            )} `}
                        picks are visible
                        yet. Picks stay
                        private until their
                        applicable game lock.
                      </div>
                    ) : (
                      teamPicks.map(
                        (pick) => (
                          <div
                            key={
                              pick.key
                            }
                            className="g365-pick-row"
                            style={{
                              display:
                                "grid",
                              gridTemplateColumns:
                                "56px minmax(0,1fr) auto",
                              gap: 12,
                              alignItems:
                                "center",
                              padding:
                                "12px 13px",
                              borderRadius:
                                12,
                              border:
                                "1px solid rgba(255,255,255,0.06)",
                              background:
                                "rgba(0,0,0,0.20)",
                            }}
                          >
                            <div
                              style={{
                                display:
                                  "grid",
                                gap: 4,
                                justifyItems:
                                  "start",
                              }}
                            >
                              <span
                                style={{
                                  padding:
                                    "4px 7px",
                                  borderRadius:
                                    999,
                                  background:
                                    pick.sport ===
                                    "nhl"
                                      ? "rgba(80,150,255,0.14)"
                                      : "rgba(255,118,39,0.13)",
                                  color:
                                    pick.sport ===
                                    "nhl"
                                      ? "#8fc2ff"
                                      : "#ff8b45",
                                  fontSize:
                                    10,
                                  fontWeight:
                                    1000,
                                }}
                              >
                                {sportText(
                                  pick.sport
                                )}
                              </span>

                              {pick.confidence !==
                              null ? (
                                <span
                                  style={{
                                    color:
                                      "#b6b6be",
                                    fontSize:
                                      10,
                                    fontWeight:
                                      900,
                                  }}
                                >
                                  C{" "}
                                  {
                                    pick.confidence
                                  }
                                </span>
                              ) : null}
                            </div>

                            <div
                              style={{
                                minWidth:
                                  0,
                              }}
                            >
                              <div
                                style={{
                                  color:
                                    "#7f7f88",
                                  fontSize:
                                    11,
                                  fontWeight:
                                    800,
                                }}
                              >
                                {
                                  pick.matchup
                                }
                              </div>

                              <div
                                style={{
                                  marginTop:
                                    3,
                                  color:
                                    "#fff",
                                  fontSize:
                                    15,
                                  fontWeight:
                                    1000,
                                }}
                              >
                                {
                                  pick.selection
                                }
                              </div>

                              <div
                                style={{
                                  marginTop:
                                    4,
                                  color:
                                    "#8f8f98",
                                  fontSize:
                                    11,
                                }}
                              >
                                {kickoff(
                                  pick.kickoffAt
                                )}
                                {pick.liveText
                                  ? ` · ${pick.liveText}`
                                  : ""}
                              </div>
                            </div>

                            <div
                              className="g365-pick-result"
                              style={{
                                textAlign:
                                  "right",
                              }}
                            >
                              <div
                                style={{
                                  color:
                                    resultColor(
                                      pick.result
                                    ),
                                  fontWeight:
                                    1000,
                                  fontSize:
                                    12,
                                }}
                              >
                                {
                                  pick.result
                                }
                              </div>

                              {pick.points !==
                              null ? (
                                <div
                                  style={{
                                    marginTop:
                                      3,
                                    color:
                                      "#9c9ca5",
                                    fontSize:
                                      11,
                                  }}
                                >
                                  {
                                    pick.points
                                  }{" "}
                                  pts
                                </div>
                              ) : null}
                            </div>
                          </div>
                        )
                      )
                    )}

                    {result?.is_disqualified ? (
                      <div
                        style={{
                          padding:
                            "10px 12px",
                          borderRadius:
                            10,
                          border:
                            "1px solid rgba(255,80,80,0.32)",
                          background:
                            "rgba(120,0,0,0.18)",
                          color:
                            "#ff969a",
                          fontSize:
                            12,
                          fontWeight:
                            900,
                        }}
                      >
                        WEEK DISQUALIFIED
                      </div>
                    ) : null}

                    {result?.missing_picks ? (
                      <div
                        style={{
                          color:
                            "#ffb36e",
                          fontSize: 12,
                          fontWeight:
                            800,
                        }}
                      >
                        Missing picks:{" "}
                        {
                          result.missing_picks
                        }
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}
