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
  viewerFantasyTeamId: number | null;
  enabledSports: Array<"cfb" | "nfl" | "ncaamb" | "nhl">;
};

type ScoringMode =
  | "record_only"
  | "standard"
  | "three_one_zero"
  | "custom"
  | "confidence";

type TeamRow = {
  id: number;
  team_name: string;
};

type WeekRow = {
  id: number;
  week: number;
  status: string;
  finalized_at: string | null;
  scoring_mode: ScoringMode;
};

type WeeklyResultRow = {
  pickem_week_id: number;
  fantasy_team_id: number;
  wins: number;
  losses: number;
  pushes: number;
  pending: number;
  points: number | string;
  is_final: boolean;
  weekly_rank: number | null;
  missing_picks: number;
  is_disqualified: boolean;
};

type FootballPickRow = {
  fantasy_team_id: number;
  result: string | null;
  points_awarded: number | string | null;
};

type NhlPeriodRow = {
  id: number;
};

type NhlPickRow = {
  fantasy_team_id: number;
  result: string | null;
  points_awarded: number | string | null;
};

type Standing = {
  fantasyTeamId: number;
  teamName: string;
  wins: number;
  losses: number;
  pushes: number;
  points: number;
  finalizedWeeks: number;
};

type LiveStanding = {
  fantasyTeamId: number;
  teamName: string;
  wins: number;
  losses: number;
  pushes: number;
  pending: number;
  points: number;
};

function n(
  value:
    | number
    | string
    | null
    | undefined
) {
  const parsed = Number(value);
  return Number.isFinite(parsed)
    ? parsed
    : 0;
}

function recordText(
  wins: number,
  losses: number,
  pushes: number
) {
  return pushes > 0
    ? `${wins}-${losses}-${pushes}`
    : `${wins}-${losses}`;
}

function pointsText(
  value: number
) {
  return value.toFixed(1);
}

export default function MixedPickemStandings({
  leagueId,
  season,
  viewerFantasyTeamId,
  enabledSports,
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
    teams,
    setTeams,
  ] =
    useState<TeamRow[]>([]);

  const [
    weeks,
    setWeeks,
  ] =
    useState<WeekRow[]>([]);

  const [
    results,
    setResults,
  ] =
    useState<WeeklyResultRow[]>([]);

  const [
    scoringMode,
    setScoringMode,
  ] =
    useState<ScoringMode>(
      "record_only"
    );

  const [
    liveRows,
    setLiveRows,
  ] =
    useState<LiveStanding[]>([]);

  const finalWeekIds =
    useMemo(
      () =>
        new Set(
          weeks
            .filter(
              (week) =>
                week.status ===
                "final"
            )
            .map(
              (week) =>
                week.id
            )
        ),
      [weeks]
    );

  const activeWeek =
    useMemo(
      () =>
        weeks.find(
          (week) =>
            week.status !==
            "final"
        ) ??
        null,
      [weeks]
    );

  const seasonStandings =
    useMemo<Standing[]>(() => {
      const map =
        new Map<
          number,
          Standing
        >();

      for (
        const team
        of teams
      ) {
        map.set(
          team.id,
          {
            fantasyTeamId:
              team.id,
            teamName:
              team.team_name,
            wins: 0,
            losses: 0,
            pushes: 0,
            points: 0,
            finalizedWeeks: 0,
          }
        );
      }

      for (
        const result
        of results
      ) {
        if (
          !result.is_final ||
          !finalWeekIds.has(
            result.pickem_week_id
          )
        ) {
          continue;
        }

        const row =
          map.get(
            result.fantasy_team_id
          );

        if (!row) {
          continue;
        }

        row.wins +=
          result.wins;

        row.losses +=
          result.losses;

        row.pushes +=
          result.pushes;

        row.points +=
          n(result.points);

        row.finalizedWeeks +=
          1;
      }

      return [
        ...map.values(),
      ].sort(
        (a, b) =>
          scoringMode ===
          "record_only"
            ? b.wins -
                a.wins ||
              a.losses -
                b.losses ||
              b.pushes -
                a.pushes ||
              a.teamName.localeCompare(
                b.teamName
              )
            : b.points -
                a.points ||
              b.wins -
                a.wins ||
              a.losses -
                b.losses ||
              a.teamName.localeCompare(
                b.teamName
              )
      );
    }, [
      finalWeekIds,
      results,
      scoringMode,
      teams,
    ]);

  const load =
    useCallback(
      async () => {
        const [
          teamResult,
          weekResult,
          resultResult,
          settingsResult,
        ] =
          await Promise.all([
            supabase
              .from(
                "fantasy_teams"
              )
              .select(
                "id,team_name"
              )
              .eq(
                "league_id",
                leagueId
              )
              .eq(
                "active",
                true
              ),

            supabase
              .from(
                "pickem_weeks"
              )
              .select(
                "id,week,status,finalized_at,scoring_mode"
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

            supabase
              .from(
                "pickem_weekly_results"
              )
              .select(
                "pickem_week_id,fantasy_team_id,wins,losses,pushes,pending,points,is_final,weekly_rank,missing_picks,is_disqualified"
              )
              .eq(
                "league_id",
                leagueId
              ),

            supabase
              .from(
                "pickem_settings"
              )
              .select(
                "scoring_mode"
              )
              .eq(
                "league_id",
                leagueId
              )
              .maybeSingle(),
          ]);

        if (teamResult.error) {
          throw new Error(
            teamResult.error.message
          );
        }

        if (weekResult.error) {
          throw new Error(
            weekResult.error.message
          );
        }

        if (resultResult.error) {
          throw new Error(
            resultResult.error.message
          );
        }

        if (settingsResult.error) {
          throw new Error(
            settingsResult.error.message
          );
        }

        const nextTeams =
          (
            teamResult.data ??
            []
          ) as TeamRow[];

        const nextWeeks =
          (
            weekResult.data ??
            []
          ) as WeekRow[];

        const nextResults =
          (
            resultResult.data ??
            []
          ) as WeeklyResultRow[];

        setTeams(
          nextTeams
        );

        setWeeks(
          nextWeeks
        );

        setResults(
          nextResults
        );

        setScoringMode(
          (
            settingsResult.data
              ?.scoring_mode ??
            "record_only"
          ) as ScoringMode
        );

        const currentWeek =
          nextWeeks.find(
            (row) =>
              row.status !==
              "final"
          ) ??
          null;

        if (!currentWeek) {
          setLiveRows([]);
          return;
        }

        const {
          data:
            footballPicksData,
          error:
            footballPicksError,
        } =
          await supabase
            .from(
              "pickem_picks"
            )
            .select(
              "fantasy_team_id,result,points_awarded"
            )
            .eq(
              "league_id",
              leagueId
            )
            .eq(
              "pickem_week_id",
              currentWeek.id
            );

        if (
          footballPicksError
        ) {
          throw new Error(
            footballPicksError.message
          );
        }

        const {
          data:
            nhlPeriodData,
          error:
            nhlPeriodError,
        } =
          await supabase
            .from(
              "nhl_pickem_periods"
            )
            .select(
              "id"
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
              "period_number",
              currentWeek.week
            )
            .maybeSingle();

        if (
          nhlPeriodError
        ) {
          throw new Error(
            nhlPeriodError.message
          );
        }

        let nhlPicks:
          NhlPickRow[] = [];

        const nhlPeriod =
          nhlPeriodData as
            | NhlPeriodRow
            | null;

        if (nhlPeriod) {
          const {
            data:
              nhlPicksData,
            error:
              nhlPicksError,
          } =
            await supabase
              .from(
                "nhl_pickem_picks"
              )
              .select(
                "fantasy_team_id,result,points_awarded"
              )
              .eq(
                "league_id",
                leagueId
              )
              .eq(
                "nhl_pickem_period_id",
                nhlPeriod.id
              );

          if (
            nhlPicksError
          ) {
            throw new Error(
              nhlPicksError.message
            );
          }

          nhlPicks =
            (
              nhlPicksData ??
              []
            ) as NhlPickRow[];
        }

        const footballPicks =
          (
            footballPicksData ??
            []
          ) as FootballPickRow[];

        const liveMap =
          new Map<
            number,
            LiveStanding
          >();

        for (
          const team
          of nextTeams
        ) {
          liveMap.set(
            team.id,
            {
              fantasyTeamId:
                team.id,
              teamName:
                team.team_name,
              wins: 0,
              losses: 0,
              pushes: 0,
              pending: 0,
              points: 0,
            }
          );
        }

        const addPick = (
          pick:
            | FootballPickRow
            | NhlPickRow
        ) => {
          const row =
            liveMap.get(
              pick.fantasy_team_id
            );

          if (!row) {
            return;
          }

          const result =
            pick.result ??
            "pending";

          if (
            result ===
            "win"
          ) {
            row.wins += 1;
          } else if (
            result ===
            "loss"
          ) {
            row.losses += 1;
          } else if (
            result ===
            "push"
          ) {
            row.pushes += 1;
          } else if (
            result !==
            "void"
          ) {
            row.pending += 1;
          }

          if (
            result !==
            "void"
          ) {
            row.points +=
              n(
                pick.points_awarded
              );
          }
        };

        footballPicks.forEach(
          addPick
        );

        nhlPicks.forEach(
          addPick
        );

        const nextLiveRows =
          [
            ...liveMap.values(),
          ].sort(
            (a, b) =>
              currentWeek.scoring_mode ===
              "record_only"
                ? b.wins -
                    a.wins ||
                  a.losses -
                    b.losses ||
                  b.pushes -
                    a.pushes ||
                  a.teamName.localeCompare(
                    b.teamName
                  )
                : b.points -
                    a.points ||
                  b.wins -
                    a.wins ||
                  a.losses -
                    b.losses ||
                  a.teamName.localeCompare(
                    b.teamName
                  )
          );

        setLiveRows(
          nextLiveRows
        );
      },
      [
        leagueId,
        season,
        supabase,
      ]
    );

  useEffect(() => {
    let active = true;

    async function run() {
      setLoading(true);
      setMessage("");

      try {
        await load();
      } catch (error) {
        if (!active) {
          return;
        }

        setMessage(
          error instanceof Error
            ? error.message
            : "Mixed Pick'em standings could not be loaded."
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
  }, [load]);

  useEffect(() => {
    if (loading) return;

    const refresh = () => {
      if (document.visibilityState === "visible") void load();
    };

    const channel = supabase
      .channel(`mixed-pickem-standings-${leagueId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "pickem_weekly_results", filter: `league_id=eq.${leagueId}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "pickem_weeks", filter: `league_id=eq.${leagueId}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "pickem_picks", filter: `league_id=eq.${leagueId}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "pickem_games", filter: `league_id=eq.${leagueId}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "nhl_pickem_picks", filter: `league_id=eq.${leagueId}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "nhl_pickem_games", filter: `league_id=eq.${leagueId}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "nhl_pickem_period_results", filter: `league_id=eq.${leagueId}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "pickem_settings", filter: `league_id=eq.${leagueId}` }, refresh)
      .subscribe();

    const customRefresh = (event: Event) => {
      const detail = (event as CustomEvent<{ leagueId?: string }>).detail;
      if (!detail?.leagueId || detail.leagueId === leagueId) refresh();
    };

    const timer = window.setInterval(refresh, 2_000);
    window.addEventListener("focus", refresh);
    window.addEventListener("g365-pickem-realtime", customRefresh);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("g365-pickem-realtime", customRefresh);
      void supabase.removeChannel(channel);
    };
  }, [leagueId, load, loading, supabase]);

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
        Loading G365 Pick&apos;em standings…
      </main>
    );
  }

  const sportsLabel =
    [
      enabledSports.includes(
        "cfb"
      )
        ? "CFB"
        : null,
      enabledSports.includes(
        "nfl"
      )
        ? "NFL"
        : null,
      enabledSports.includes(
        "ncaamb"
      )
        ? "NCAAMB"
        : null,
      enabledSports.includes(
        "nhl"
      )
        ? "NHL"
        : null,
    ]
      .filter(Boolean)
      .join(" + ");

  return (
    <main
      style={{
        display:
          "grid",
        gap:
          18,
        maxWidth:
          1180,
        padding:
          "22px 18px 36px",
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
            "linear-gradient(135deg, rgba(100,7,13,0.40), rgba(17,17,21,0.98) 58%)",
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
          G365 Pick&apos;em · {sportsLabel}
        </div>

        <h1
          style={{
            margin:
              "7px 0 6px",
            color:
              "#fff",
            fontSize:
              "clamp(28px,5vw,42px)",
          }}
        >
          Standings
        </h1>

        <p
          style={{
            margin:
              0,
            maxWidth:
              900,
            color:
              "#a5a5ad",
            lineHeight:
              1.6,
          }}
        >
          Official season standings use the finalized combined G365 card across all enabled sports. CFB, NFL, NCAAMB, and NHL selections count together toward one weekly record, one points total, and one missing-pick result.
        </p>
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

      <StandingsSection
        title="Official Season Standings"
        subtitle={`${finalWeekIds.size} finalized combined week${finalWeekIds.size === 1 ? "" : "s"}`}
        rows={seasonStandings.map(
          (row) => ({
            fantasyTeamId:
              row.fantasyTeamId,
            teamName:
              row.teamName,
            record:
              recordText(
                row.wins,
                row.losses,
                row.pushes
              ),
            points:
              pointsText(
                row.points
              ),
            note:
              `${row.finalizedWeeks} official week${row.finalizedWeeks === 1 ? "" : "s"}`,
          })
        )}
        viewerFantasyTeamId={
          viewerFantasyTeamId
        }
      />

      <StandingsSection
        title={
          activeWeek
            ? `Week ${activeWeek.week} Live Combined Standings`
            : "Current Week"
        }
        subtitle={
          activeWeek
            ? "Unofficial live snapshot across all enabled G365 sports until the combined week is finalized."
            : "There is no active unfinished week."
        }
        rows={
          activeWeek
            ? liveRows.map(
                (row) => ({
                  fantasyTeamId:
                    row.fantasyTeamId,
                  teamName:
                    row.teamName,
                  record:
                    recordText(
                      row.wins,
                      row.losses,
                      row.pushes
                    ),
                  points:
                    pointsText(
                      row.points
                    ),
                  note:
                    row.pending > 0
                      ? `${row.pending} pick${row.pending === 1 ? "" : "s"} pending`
                      : "Awaiting combined weekly finalization",
                })
              )
            : []
        }
        viewerFantasyTeamId={
          viewerFantasyTeamId
        }
      />
    </main>
  );
}

function StandingsSection({
  title,
  subtitle,
  rows,
  viewerFantasyTeamId,
}: {
  title: string;
  subtitle: string;
  rows: Array<{
    fantasyTeamId: number;
    teamName: string;
    record: string;
    points: string;
    note: string;
  }>;
  viewerFantasyTeamId:
    number | null;
}) {
  return (
    <section
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
          padding:
            "15px 16px",
          borderBottom:
            "1px solid rgba(255,255,255,0.07)",
          background:
            "rgba(0,0,0,0.22)",
        }}
      >
        <h2
          style={{
            margin:
              0,
            color:
              "#fff",
            fontSize:
              20,
          }}
        >
          {title}
        </h2>

        <div
          style={{
            marginTop:
              4,
            color:
              "#8d8d96",
            fontSize:
              12,
          }}
        >
          {subtitle}
        </div>
      </div>

      {rows.length === 0 ? (
        <div
          style={{
            padding:
              18,
            color:
              "#8f8f98",
          }}
        >
          No standings are available yet.
        </div>
      ) : (
        rows.map(
          (
            row,
            index
          ) => (
            <StandingRow
              key={
                row.fantasyTeamId
              }
              rank={
                index + 1
              }
              teamName={
                row.teamName
              }
              record={
                row.record
              }
              points={
                row.points
              }
              note={
                row.note
              }
              isViewer={
                viewerFantasyTeamId ===
                row.fantasyTeamId
              }
            />
          )
        )
      )}
    </section>
  );
}

function StandingRow({
  rank,
  teamName,
  record,
  points,
  note,
  isViewer,
}: {
  rank: number;
  teamName: string;
  record: string;
  points: string;
  note: string;
  isViewer: boolean;
}) {
  return (
    <div
      style={{
        display:
          "grid",
        gridTemplateColumns:
          "42px minmax(0,1fr) auto auto",
        gap:
          12,
        alignItems:
          "center",
        minHeight:
          66,
        padding:
          "11px 15px",
        borderBottom:
          "1px solid rgba(255,255,255,0.055)",
        background:
          isViewer
            ? "linear-gradient(90deg, rgba(145,15,20,0.19), rgba(255,93,21,0.045))"
            : "transparent",
      }}
    >
      <div
        style={{
          color:
            rank === 1
              ? "#ff9d59"
              : "#a0a0a8",
          fontSize:
            16,
          fontWeight:
            1000,
          textAlign:
            "center",
        }}
      >
        #{rank}
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
              "#fff",
            fontWeight:
              950,
            overflow:
              "hidden",
            textOverflow:
              "ellipsis",
            whiteSpace:
              "nowrap",
          }}
        >
          {teamName}
          {isViewer
            ? " · YOU"
            : ""}
        </div>

        <div
          style={{
            marginTop:
              4,
            color:
              "#81818a",
            fontSize:
              12,
          }}
        >
          {note}
        </div>
      </div>

      <div
        style={{
          textAlign:
            "right",
        }}
      >
        <div
          style={{
            color:
              "#fff",
            fontWeight:
              950,
          }}
        >
          {record}
        </div>

        <div
          style={{
            marginTop:
              3,
            color:
              "#81818a",
            fontSize:
              11,
          }}
        >
          RECORD
        </div>
      </div>

      <div
        style={{
          minWidth:
            64,
          textAlign:
            "right",
        }}
      >
        <div
          style={{
            color:
              "#ff9d59",
            fontWeight:
              1000,
          }}
        >
          {points}
        </div>

        <div
          style={{
            marginTop:
              3,
            color:
              "#81818a",
            fontSize:
              11,
          }}
        >
          POINTS
        </div>
      </div>
    </div>
  );
}
