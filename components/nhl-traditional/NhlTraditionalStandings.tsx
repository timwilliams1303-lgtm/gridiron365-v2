"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

type Props = { leagueId: string };

type Settings = {
  season: number;
  league_format: string | null;
  competition_format: string | null;
  scoring_system: string | null;
  regular_season_weeks: number | null;
  playoff_team_count: number | null;
  divisions_enabled: boolean;
  division_playoff_mode:
    | "overall"
    | "division_winners_qualify"
    | "division_winners_top_seeds";
};

type Division = {
  id: number;
  name: string;
  sort_order: number;
};

type TeamDivision = {
  fantasy_team_id: number;
  division_id: number;
};

type Team = {
  id: number;
  team_name: string;
  owner_id: string | null;
  active: boolean | null;
  is_cpu: boolean | null;
};

type Standing = {
  fantasy_team_id: number;
  wins: number;
  losses: number;
  ties: number;
  points_for: number;
  points_against: number;
  rank: number | null;
};

type Matchup = {
  week: number;
  home_fantasy_team_id: number;
  away_fantasy_team_id: number;
  home_score: number;
  away_score: number;
  status: string | null;
  winner_fantasy_team_id: number | null;
  is_tie: boolean | null;
};

type PlayoffStatus = "CLINCHED" | "IN THE HUNT" | "ELIMINATED" | "—";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function n(v: unknown) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function title(v: string | null | undefined) {
  return (v ?? "—")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function pct(w: number, l: number, t: number) {
  const games = w + l + t;
  return games ? (w + t * 0.5) / games : 0;
}

export default function NhlTraditionalStandings({ leagueId }: Props) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [standings, setStandings] = useState<Standing[]>([]);
  const [matchups, setMatchups] = useState<Matchup[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [teamDivisions, setTeamDivisions] = useState<TeamDivision[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      setUserId(user?.id ?? null);

      const { data: settingData, error: settingError } = await supabase
        .from("nhl_traditional_settings")
        .select(
          "season,league_format,competition_format,scoring_system,regular_season_weeks,playoff_team_count,divisions_enabled,division_playoff_mode"
        )
        .eq("league_id", leagueId)
        .maybeSingle();

      if (settingError) throw settingError;
      if (!settingData)
        throw new Error("NHL Traditional settings were not found.");

      const nextSettings: Settings = {
        season: n(settingData.season),
        league_format: settingData.league_format,
        competition_format: settingData.competition_format,
        scoring_system: settingData.scoring_system,
        regular_season_weeks: settingData.regular_season_weeks,
        playoff_team_count: settingData.playoff_team_count,
        divisions_enabled: Boolean(settingData.divisions_enabled),
        division_playoff_mode:
          (settingData.division_playoff_mode as Settings["division_playoff_mode"]) ??
          "overall",
      };

      setSettings(nextSettings);

      const [
        teamResult,
        standingResult,
        matchupResult,
        divisionResult,
        teamDivisionResult,
      ] = await Promise.all([
        supabase
          .from("fantasy_teams")
          .select("id,team_name,owner_id,active,is_cpu")
          .eq("league_id", leagueId)
          .eq("active", true),

        supabase
          .from("nhl_traditional_standings")
          .select(
            "fantasy_team_id,wins,losses,ties,points_for,points_against,rank"
          )
          .eq("league_id", leagueId)
          .eq("season", nextSettings.season),

        supabase
          .from("nhl_traditional_matchups")
          .select(
            "week,home_fantasy_team_id,away_fantasy_team_id,home_score,away_score,status,winner_fantasy_team_id,is_tie"
          )
          .eq("league_id", leagueId)
          .eq("season", nextSettings.season)
          .lte("week", nextSettings.regular_season_weeks ?? 999),

        supabase
          .from("nhl_traditional_divisions")
          .select("id,name,sort_order")
          .eq("league_id", leagueId)
          .eq("season", nextSettings.season)
          .order("sort_order", { ascending: true }),

        supabase
          .from("nhl_traditional_team_divisions")
          .select("fantasy_team_id,division_id")
          .eq("league_id", leagueId)
          .eq("season", nextSettings.season),
      ]);

      if (teamResult.error) throw teamResult.error;
      if (standingResult.error) throw standingResult.error;
      if (matchupResult.error) throw matchupResult.error;
      if (divisionResult.error) throw divisionResult.error;
      if (teamDivisionResult.error) throw teamDivisionResult.error;

      setTeams(
        (teamResult.data ?? []).map((x) => ({
          id: n(x.id),
          team_name: x.team_name ?? "Unnamed Team",
          owner_id: x.owner_id,
          active: x.active,
          is_cpu: x.is_cpu,
        }))
      );

      setStandings(
        (standingResult.data ?? []).map((x) => ({
          fantasy_team_id: n(x.fantasy_team_id),
          wins: n(x.wins),
          losses: n(x.losses),
          ties: n(x.ties),
          points_for: n(x.points_for),
          points_against: n(x.points_against),
          rank: x.rank == null ? null : n(x.rank),
        }))
      );

      setDivisions(
        (divisionResult.data ?? []).map((x) => ({
          id: n(x.id),
          name: x.name ?? "Division",
          sort_order: n(x.sort_order),
        }))
      );

      setTeamDivisions(
        (teamDivisionResult.data ?? []).map((x) => ({
          fantasy_team_id: n(x.fantasy_team_id),
          division_id: n(x.division_id),
        }))
      );

      setMatchups(
        (matchupResult.data ?? []).map((x) => ({
          week: n(x.week),
          home_fantasy_team_id: n(x.home_fantasy_team_id),
          away_fantasy_team_id: n(x.away_fantasy_team_id),
          home_score: n(x.home_score),
          away_score: n(x.away_score),
          status: x.status,
          winner_fantasy_team_id:
            x.winner_fantasy_team_id == null
              ? null
              : n(x.winner_fantasy_team_id),
          is_tie: x.is_tie,
        }))
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to load standings."
      );
    } finally {
      setLoading(false);
    }
  }, [leagueId]);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = useMemo(() => {
    const byTeam = new Map(
      standings.map((s) => [s.fantasy_team_id, s])
    );

    return teams
      .map((team) => {
        const standing = byTeam.get(team.id) ?? {
          fantasy_team_id: team.id,
          wins: 0,
          losses: 0,
          ties: 0,
          points_for: 0,
          points_against: 0,
          rank: null,
        };

        return {
          team,
          ...standing,
          percentage: pct(
            standing.wins,
            standing.losses,
            standing.ties
          ),
        };
      })
      .sort((a, b) => {
        if (
          a.rank != null &&
          b.rank != null &&
          a.rank !== b.rank
        ) {
          return a.rank - b.rank;
        }

        if (a.rank != null && b.rank == null) return -1;
        if (a.rank == null && b.rank != null) return 1;

        if (b.percentage !== a.percentage) {
          return b.percentage - a.percentage;
        }

        if (b.points_for !== a.points_for) {
          return b.points_for - a.points_for;
        }

        return a.team.team_name.localeCompare(b.team.team_name);
      });
  }, [teams, standings]);

  const divisionRows = useMemo(() => {
    if (!settings?.divisions_enabled || divisions.length === 0) return [];

    const assignmentByTeam = new Map(
      teamDivisions.map((assignment) => [
        assignment.fantasy_team_id,
        assignment.division_id,
      ])
    );

    return [...divisions]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((division) => ({
        division,
        rows: rows
          .filter(
            (row) => assignmentByTeam.get(row.team.id) === division.id
          )
          .sort((a, b) => {
            if (b.percentage !== a.percentage) {
              return b.percentage - a.percentage;
            }
            if (b.points_for !== a.points_for) {
              return b.points_for - a.points_for;
            }
            return a.team.team_name.localeCompare(b.team.team_name);
          }),
      }));
  }, [settings?.divisions_enabled, divisions, teamDivisions, rows]);

  const unassignedDivisionRows = useMemo(() => {
    if (!settings?.divisions_enabled) return [];
    const assigned = new Set(
      teamDivisions.map((assignment) => assignment.fantasy_team_id)
    );
    return rows.filter((row) => !assigned.has(row.team.id));
  }, [settings?.divisions_enabled, teamDivisions, rows]);

  const playoffCount = Math.max(
    0,
    n(settings?.playoff_team_count)
  );

  const playoffStatusByTeam = useMemo(() => {
    const result = new Map<number, PlayoffStatus>();

    if (!rows.length || playoffCount <= 0) {
      return result;
    }

    const completed = matchups.filter((m) => {
      const status = (m.status ?? "").toLowerCase();

      return (
        ["final", "complete", "completed"].includes(status) ||
        m.winner_fantasy_team_id != null ||
        m.is_tie === true
      );
    });

    // Keep preseason standings neutral until at least one
    // regular-season matchup has actually been completed.
    if (!completed.length) {
      rows.forEach((r) => result.set(r.team.id, "—"));
      return result;
    }

    const remainingByTeam = new Map<number, number>();

    rows.forEach((r) => {
      remainingByTeam.set(r.team.id, 0);
    });

    for (const m of matchups) {
      const status = (m.status ?? "").toLowerCase();

      const done =
        ["final", "complete", "completed"].includes(status) ||
        m.winner_fantasy_team_id != null ||
        m.is_tie === true;

      if (!done) {
        remainingByTeam.set(
          m.home_fantasy_team_id,
          (remainingByTeam.get(m.home_fantasy_team_id) ?? 0) + 1
        );

        remainingByTeam.set(
          m.away_fantasy_team_id,
          (remainingByTeam.get(m.away_fantasy_team_id) ?? 0) + 1
        );
      }
    }

    // Standings are matchup W-L-T, so each remaining matchup can add
    // at most one win. These bounds are intentionally conservative.
    //
    // CLINCHED only when enough teams cannot possibly catch the team.
    // ELIMINATED only when enough teams are already unreachable.
    for (const row of rows) {
      const teamMaxWins =
        row.wins +
        (remainingByTeam.get(row.team.id) ?? 0);

      let teamsThatCanFinishAhead = 0;
      let teamsAlreadyUnreachable = 0;

      for (const other of rows) {
        if (other.team.id === row.team.id) {
          continue;
        }

        const otherMaxWins =
          other.wins +
          (remainingByTeam.get(other.team.id) ?? 0);

        // A tie at the win boundary may still be decided by league
        // tiebreakers, so equality remains capable of passing.
        if (otherMaxWins >= row.wins) {
          teamsThatCanFinishAhead += 1;
        }

        // If another team already has strictly more wins than this
        // team's maximum possible total, this team cannot catch it.
        if (other.wins > teamMaxWins) {
          teamsAlreadyUnreachable += 1;
        }
      }

      if (teamsThatCanFinishAhead < playoffCount) {
        result.set(row.team.id, "CLINCHED");
      } else if (
        teamsAlreadyUnreachable >= playoffCount
      ) {
        result.set(row.team.id, "ELIMINATED");
      } else {
        result.set(row.team.id, "IN THE HUNT");
      }
    }

    return result;
  }, [rows, matchups, playoffCount]);

  const isCategories = (
    settings?.scoring_system ?? ""
  )
    .toLowerCase()
    .includes("categor");

  if (loading) {
    return (
      <main style={S.page}>
        <div style={S.shell}>
          <div style={S.loading}>
            Loading NHL standings…
          </div>
        </div>
      </main>
    );
  }

  return (
    <main
      className="g365-standings-page"
      style={S.page}
    >
      <style>{`
        .g365-standings-scroll {
          width: 100%;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: thin;
        }

        .g365-standings-scroll::-webkit-scrollbar {
          height: 7px;
        }

        .g365-standings-scroll::-webkit-scrollbar-thumb {
          background: #3b3d42;
          border-radius: 999px;
        }

        .g365-standing-row:hover > div {
          background-color: #17191c !important;
        }

        @media (max-width: 650px) {
          .g365-standings-page {
            width: 100% !important;
            max-width: 100% !important;
            min-width: 0 !important;
            padding: 8px 5px 40px !important;
            overflow-x: hidden !important;
          }

          .g365-standings-page > *,
          .g365-standings-page section,
          .g365-standings-page div {
            min-width: 0;
            max-width: 100%;
          }

          .g365-standings-hero {
            padding: 14px 12px !important;
          }

          .g365-standings-mobile-redundant-nav {
            display: none !important;
          }

          .g365-standings-scroll {
            width: 100%;
            max-width: 100%;
            overflow-x: auto;
            overscroll-behavior-x: contain;
          }

          /* Mobile standings: keep playoff status visible instead of pushing it off-screen. */
          .g365-main-standings-grid {
            grid-template-columns:
              34px minmax(108px, 1fr) 30px 30px 30px 48px minmax(82px, 96px) !important;
            width: 100% !important;
            min-width: 0 !important;
          }

          .g365-main-standings-grid > :nth-child(7),
          .g365-main-standings-grid > :nth-child(8),
          .g365-main-standings-grid > :nth-child(9) {
            display: none !important;
          }

          .g365-main-standings-grid > :nth-child(10) {
            grid-column: 7;
          }

          .g365-main-standings-grid > div {
            padding-left: 4px !important;
            padding-right: 4px !important;
            font-size: 9px !important;
          }

          .g365-main-standings-grid a {
            font-size: 10px !important;
            overflow-wrap: anywhere;
          }

          .g365-main-standings-grid > :nth-child(10) span {
            min-width: 0 !important;
            width: 100%;
            max-width: 94px;
            padding: 5px 4px !important;
            font-size: 7px !important;
            white-space: normal !important;
            line-height: 1.05;
            text-align: center;
          }

          .g365-division-mini-grid {
            grid-template-columns:
              28px minmax(92px, 1fr) 27px 27px 27px 42px minmax(76px, 90px) !important;
            width: 100% !important;
            min-width: 0 !important;
            padding-left: 4px !important;
            padding-right: 4px !important;
          }

          .g365-division-mini-grid > * {
            min-width: 0 !important;
          }

          .g365-division-mini-grid > :last-child {
            min-width: 0 !important;
            width: 100%;
            max-width: 88px;
            padding: 4px 3px !important;
            font-size: 6px !important;
            white-space: normal !important;
            line-height: 1.05;
            text-align: center;
          }

          .g365-division-mini-grid a {
            overflow-wrap: anywhere;
          }

          .g365-standings-scroll {
            overflow-x: hidden !important;
          }
        }
      `}</style>

      <div style={S.shell}>
        <section
          className="g365-standings-hero"
          style={S.hero}
        >
          <div>
            <div style={S.eyebrow}>
              GRIDIRON365 • NHL TRADITIONAL
            </div>

            <h1 style={S.title}>Standings</h1>

            <p style={S.subtitle}>
              {settings?.season} •{" "}
              {title(settings?.league_format)} •{" "}
              {title(settings?.scoring_system)}
            </p>
          </div>

          <div style={S.badges}>
            <span style={S.badge}>
              {title(settings?.competition_format)}
            </span>

            <span style={S.badge}>
              {settings?.regular_season_weeks ?? "—"} WEEK
              REGULAR SEASON
            </span>

            <span style={S.badge}>
              {playoffCount || "—"} PLAYOFF TEAMS
            </span>

            {settings?.divisions_enabled ? (
              <span style={S.divisionBadge}>
                {divisions.length} DIVISIONS
              </span>
            ) : null}
          </div>
        </section>

        <Link
          href={`/league/${leagueId}/nhl`}
          className="g365-standings-mobile-redundant-nav"
          style={S.back}
        >
          ← LEAGUE HOME
        </Link>

        {error ? (
          <section style={S.error}>
            <strong>
              Standings could not be loaded.
            </strong>

            <span>{error}</span>

            <button
              type="button"
              onClick={() => void load()}
              style={S.retry}
            >
              RETRY
            </button>
          </section>
        ) : (
          <>
            {settings?.divisions_enabled && divisions.length > 0 ? (
              <section style={S.divisionsPanel}>
                <div style={S.divisionsHeader}>
                  <div>
                    <strong>DIVISION STANDINGS</strong>
                    <small style={S.divisionsSub}>
                      {settings.division_playoff_mode === "division_winners_top_seeds"
                        ? "Division winners receive the top playoff seeds."
                        : settings.division_playoff_mode === "division_winners_qualify"
                          ? "Division winners automatically qualify for the playoffs."
                          : "Divisions are displayed below; playoff qualification uses overall standings."}
                    </small>
                  </div>
                  <span>{divisions.length} DIVISIONS</span>
                </div>

                <div style={S.divisionGrid}>
                  {divisionRows.map(({ division, rows: groupRows }) => (
                    <div key={division.id} style={S.divisionCard}>
                      <div style={S.divisionTitle}>
                        <strong>{division.name.toUpperCase()}</strong>
                        <span>{groupRows.length} TEAMS</span>
                      </div>

                      <div className="g365-division-mini-grid g365-division-mini-header" style={S.divisionMiniHeader}>
                        <span>RK</span>
                        <span>TEAM</span>
                        <span>W</span>
                        <span>L</span>
                        <span>T</span>
                        <span>PCT</span>
                        <span>STATUS</span>
                      </div>

                      {groupRows.map((row, index) => {
                        const mine = Boolean(
                          userId && row.team.owner_id === userId
                        );
                        return (
                          <div
                            key={row.team.id}
                            className="g365-division-mini-grid g365-division-mini-row"
                            style={{
                              ...S.divisionMiniRow,
                              ...(mine ? S.divisionMiniMine : {}),
                            }}
                          >
                            <span style={index === 0 ? S.divisionLeader : S.rank}>
                              {index + 1}
                            </span>
                            <Link
                              href={`/league/${leagueId}/nhl/teams/${row.team.id}`}
                              style={S.divisionTeamLink}
                            >
                              {row.team.team_name}
                              {mine ? <small style={S.divisionYou}>YOU</small> : null}
                            </Link>
                            <span>{row.wins}</span>
                            <span>{row.losses}</span>
                            <span>{row.ties}</span>
                            <strong>
                              {row.percentage.toFixed(3).replace(/^0/, "") || ".000"}
                            </strong>
                            <span
                              style={{
                                ...S.divisionStatus,
                                ...(playoffStatusByTeam.get(row.team.id) === "CLINCHED"
                                  ? S.statusClinched
                                  : playoffStatusByTeam.get(row.team.id) === "IN THE HUNT"
                                    ? S.statusHunt
                                    : playoffStatusByTeam.get(row.team.id) === "ELIMINATED"
                                      ? S.statusEliminated
                                      : S.statusNeutral),
                              }}
                            >
                              {playoffStatusByTeam.get(row.team.id) ?? "—"}
                            </span>
                          </div>
                        );
                      })}

                      {!groupRows.length ? (
                        <div style={S.divisionEmpty}>No teams assigned.</div>
                      ) : null}
                    </div>
                  ))}

                  {unassignedDivisionRows.length > 0 ? (
                    <div style={S.divisionCard}>
                      <div style={S.divisionTitle}>
                        <strong>UNASSIGNED</strong>
                        <span>{unassignedDivisionRows.length} TEAMS</span>
                      </div>
                      <div style={S.divisionEmpty}>
                        {unassignedDivisionRows
                          .map((row) => row.team.team_name)
                          .join(" • ")}
                      </div>
                    </div>
                  ) : null}
                </div>
              </section>
            ) : null}

            {!settings?.divisions_enabled ? (
              <section style={S.panel}>
            <div style={S.panelHead}>
              <div
                style={{
                  display: "grid",
                  gap: 3,
                }}
              >
                <strong>LEAGUE STANDINGS</strong>

                <small
                  style={{
                    color: "#777a80",
                    fontSize: 8,
                  }}
                >
                  {isCategories
                    ? "Head-to-head category matchup record"
                    : "Head-to-head points matchup record"}
                </small>
              </div>

              <span>{rows.length} TEAMS</span>
            </div>

            <div className="g365-standings-scroll">
              <div style={S.table}>
                <div
                  className="g365-main-standings-grid g365-main-standings-header"
                  style={{
                    ...S.grid,
                    ...S.headerRow,
                  }}
                >
                  <div
                    style={{
                      ...S.cell,
                      ...S.rankCell,
                    }}
                  >
                    RK
                  </div>

                  <div
                    style={{
                      ...S.cell,
                      ...S.teamHeader,
                    }}
                  >
                    TEAM
                  </div>

                  <div style={S.cell}>W</div>
                  <div style={S.cell}>L</div>
                  <div style={S.cell}>T</div>
                  <div style={S.cell}>PCT</div>
                  <div style={S.cell}>PF</div>
                  <div style={S.cell}>PA</div>
                  <div style={S.cell}>DIFF</div>
                  <div style={S.cell}>
                    PLAYOFF STATUS
                  </div>
                </div>

                {rows.map((row, index) => {
                  const displayRank =
                    row.rank ?? index + 1;

                  const mine = Boolean(
                    userId &&
                      row.team.owner_id === userId
                  );

                  const playoff =
                    playoffCount > 0 &&
                    displayRank <= playoffCount;

                  const cutoff =
                    playoffCount > 0 &&
                    displayRank === playoffCount;

                  const status =
                    playoffStatusByTeam.get(
                      row.team.id
                    ) ?? "—";

                  return (
                    <div key={row.team.id}>
                      <div
                        className="g365-standing-row g365-main-standings-grid"
                        style={{
                          ...S.grid,
                          ...(mine ? S.myRow : {}),
                        }}
                      >
                        <div
                          style={{
                            ...S.cell,
                            ...S.rankCell,
                          }}
                        >
                          <span
                            style={
                              playoff
                                ? S.playoffRank
                                : S.rank
                            }
                          >
                            {displayRank}
                          </span>
                        </div>

                        <div
                          style={{
                            ...S.cell,
                            ...S.teamCell,
                            ...(mine
                              ? S.myTeamCell
                              : {}),
                          }}
                        >
                          <Link
                            href={`/league/${leagueId}/nhl/teams/${row.team.id}`}
                            style={S.teamLink}
                          >
                            {row.team.team_name}
                          </Link>

                          <div style={S.teamMeta}>
                            {mine ? (
                              <span style={S.you}>
                                YOUR TEAM
                              </span>
                            ) : null}

                            {row.team.is_cpu ? (
                              <span>CPU</span>
                            ) : null}
                          </div>
                        </div>

                        <div style={S.cell}>
                          {row.wins}
                        </div>

                        <div style={S.cell}>
                          {row.losses}
                        </div>

                        <div style={S.cell}>
                          {row.ties}
                        </div>

                        <div
                          style={{
                            ...S.cell,
                            ...S.strong,
                          }}
                        >
                          {row.percentage
                            .toFixed(3)
                            .replace(/^0/, "") ||
                            ".000"}
                        </div>

                        <div style={S.cell}>
                          {row.points_for.toFixed(1)}
                        </div>

                        <div style={S.cell}>
                          {row.points_against.toFixed(1)}
                        </div>

                        <div
                          style={{
                            ...S.cell,
                            ...(row.points_for -
                              row.points_against >
                            0
                              ? S.positive
                              : row.points_for -
                                    row.points_against <
                                  0
                                ? S.negative
                                : {}),
                          }}
                        >
                          {row.points_for -
                            row.points_against >
                          0
                            ? "+"
                            : ""}

                          {(
                            row.points_for -
                            row.points_against
                          ).toFixed(1)}
                        </div>

                        <div style={S.cell}>
                          <span
                            style={{
                              ...S.statusPill,
                              ...(status ===
                              "CLINCHED"
                                ? S.statusClinched
                                : status ===
                                    "IN THE HUNT"
                                  ? S.statusHunt
                                  : status ===
                                      "ELIMINATED"
                                    ? S.statusEliminated
                                    : S.statusNeutral),
                            }}
                          >
                            {status}
                          </span>
                        </div>
                      </div>

                      {cutoff &&
                      index < rows.length - 1 ? (
                        <div style={S.cutoff}>
                          <span>
                            PLAYOFF CUT LINE
                          </span>
                        </div>
                      ) : null}
                    </div>
                  );
                })}

                {!rows.length ? (
                  <div style={S.empty}>
                    No active fantasy teams are
                    available yet.
                  </div>
                ) : null}
              </div>
            </div>

            <div style={S.footerNote}>
              <span style={S.legendDot} />

              <span>
                Orange rank markers indicate the
                current configured playoff
                positions.
              </span>
            </div>
          </section>
            ) : null}
          </>
        )}
      </div>
    </main>
  );
}

const S: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#09090a",
    color: "#f5f5f5",
    padding: "14px 10px 48px",
  },

  shell: {
    width: "min(1100px, 100%)",
    margin: "0 auto",
    display: "grid",
    gap: 12,
  },

  loading: {
    padding: 48,
    textAlign: "center",
    color: "#999ca2",
  },

  hero: {
    padding: "18px 20px",
    border: "1px solid #29292d",
    borderRadius: 10,
    background:
      "linear-gradient(135deg, #171719 0%, #111113 60%, #21110b 100%)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
    flexWrap: "wrap",
  },

  eyebrow: {
    color: "#ff6a00",
    fontSize: 9,
    fontWeight: 1000,
    letterSpacing: 1.3,
  },

  title: {
    margin: "4px 0 0",
    fontSize: "clamp(28px, 5vw, 42px)",
    lineHeight: 1,
    fontWeight: 1000,
  },

  subtitle: {
    margin: "7px 0 0",
    color: "#a0a0a5",
    fontSize: 11,
    fontWeight: 800,
  },

  badges: {
    display: "flex",
    gap: 6,
    flexWrap: "wrap",
  },

  badge: {
    padding: "6px 9px",
    border: "1px solid #493025",
    borderRadius: 5,
    background: "#21140f",
    color: "#ff8a45",
    fontSize: 8,
    fontWeight: 1000,
  },

  divisionBadge: {
    padding: "6px 9px",
    border: "1px solid #6a351e",
    borderRadius: 5,
    background: "#26150d",
    color: "#ff7b31",
    fontSize: 8,
    fontWeight: 1000,
  },

  divisionsPanel: {
    border: "1px solid #3b2a22",
    borderRadius: 9,
    overflow: "hidden",
    background: "#111113",
  },

  divisionsHeader: {
    padding: "12px 14px",
    background: "linear-gradient(90deg, #171719 0%, #21110b 100%)",
    borderBottom: "1px solid #3b2a22",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    color: "#f5f5f5",
    fontSize: 10,
  },

  divisionsSub: {
    display: "block",
    marginTop: 4,
    color: "#8d8d93",
    fontSize: 8,
    fontWeight: 700,
  },

  divisionGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 390px), 1fr))",
    gap: 10,
    padding: 10,
  },

  divisionCard: {
    minWidth: 0,
    border: "1px solid #29292d",
    borderRadius: 8,
    overflow: "hidden",
    background: "#0d0d0f",
  },

  divisionTitle: {
    padding: "10px 11px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
    background: "#18110e",
    borderBottom: "1px solid #4d2a1d",
    color: "#ff7b31",
    fontSize: 9,
    fontWeight: 1000,
  },

  divisionMiniHeader: {
    display: "grid",
    gridTemplateColumns: "34px minmax(120px, 1fr) 34px 34px 34px 52px 104px",
    alignItems: "center",
    minWidth: 410,
    padding: "7px 8px",
    color: "#777a80",
    background: "#121214",
    borderBottom: "1px solid #242428",
    fontSize: 7,
    fontWeight: 1000,
    textAlign: "center",
  },

  divisionMiniRow: {
    display: "grid",
    gridTemplateColumns: "34px minmax(120px, 1fr) 34px 34px 34px 52px 104px",
    alignItems: "center",
    minWidth: 410,
    padding: "8px",
    borderBottom: "1px solid #202024",
    color: "#d7d7da",
    fontSize: 10,
    textAlign: "center",
  },

  divisionMiniMine: {
    background: "#17120f",
    boxShadow: "inset 3px 0 0 #ff5a1f",
  },

  divisionLeader: {
    width: 22,
    height: 22,
    margin: "0 auto",
    borderRadius: "50%",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#ff5a1f",
    color: "#fff",
    fontWeight: 1000,
  },

  divisionTeamLink: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    minWidth: 0,
    color: "#f5f5f5",
    textDecoration: "none",
    fontWeight: 1000,
    textAlign: "left",
  },

  divisionYou: {
    color: "#ff7b31",
    fontSize: 6,
    fontWeight: 1000,
  },

  divisionStatus: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    justifySelf: "center",
    minWidth: 82,
    padding: "4px 6px",
    borderRadius: 999,
    fontSize: 7,
    fontWeight: 1000,
    letterSpacing: 0.3,
    whiteSpace: "nowrap",
  },

  divisionEmpty: {
    padding: 16,
    color: "#777a80",
    fontSize: 9,
    textAlign: "center",
  },

  back: {
    justifySelf: "start",
    color: "#ff7b31",
    textDecoration: "none",
    fontSize: 10,
    fontWeight: 1000,
  },

  panel: {
    border: "1px solid #29292d",
    borderRadius: 9,
    overflow: "hidden",
    background: "#111113",
  },

  panelHead: {
    padding: "12px 14px",
    background: "#0d0d0f",
    borderBottom: "1px solid #29292d",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    color: "#d9d9dc",
    fontSize: 10,
  },

  table: {
    minWidth: 760,
  },

  grid: {
    display: "grid",
    gridTemplateColumns:
      "54px minmax(210px, 1fr) 64px 64px 64px 78px 92px 92px 92px 150px",
    alignItems: "stretch",
  },

  headerRow: {
    background: "#151517",
    color: "#8d8d93",
    fontSize: 9,
    fontWeight: 1000,
    letterSpacing: 0.5,
  },

  cell: {
    minHeight: 52,
    padding: "9px 10px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRight: "1px solid #242428",
    borderBottom: "1px solid #242428",
    fontSize: 12,
  },

  rankCell: {
    background: "#0f0f11",
  },

  teamHeader: {
    justifyContent: "flex-start",
  },

  teamCell: {
    justifyContent: "center",
    alignItems: "flex-start",
    flexDirection: "column",
    gap: 4,
    background: "#121214",
  },

  myTeamCell: {
    borderLeft: "3px solid #ff5a1f",
  },

  myRow: {
    background: "#17120f",
  },

  teamLink: {
    color: "#f5f5f5",
    textDecoration: "none",
    fontWeight: 1000,
    fontSize: 13,
  },

  teamMeta: {
    minHeight: 12,
    display: "flex",
    gap: 6,
    color: "#777a80",
    fontSize: 7,
    fontWeight: 1000,
  },

  you: {
    color: "#ff7b31",
  },

  statusPill: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 92,
    padding: "5px 8px",
    borderRadius: 999,
    fontSize: 8,
    fontWeight: 1000,
    letterSpacing: 0.45,
    whiteSpace: "nowrap",
  },

  statusClinched: {
    background: "#102319",
    border: "1px solid #245d39",
    color: "#67d68a",
  },

  statusHunt: {
    background: "#26150d",
    border: "1px solid #6a351e",
    color: "#ff7b31",
  },

  statusEliminated: {
    background: "#1b1717",
    border: "1px solid #4a3030",
    color: "#b9827d",
  },

  statusNeutral: {
    background: "#171719",
    border: "1px solid #343438",
    color: "#777a80",
  },

  rank: {
    color: "#c9c9cc",
    fontWeight: 1000,
  },

  playoffRank: {
    width: 26,
    height: 26,
    borderRadius: "50%",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#ff5a1f",
    color: "#fff",
    fontWeight: 1000,
  },

  strong: {
    fontWeight: 1000,
    color: "#fff",
  },

  positive: {
    color: "#67d68a",
    fontWeight: 1000,
  },

  negative: {
    color: "#e78378",
    fontWeight: 1000,
  },

  cutoff: {
    height: 20,
    display: "flex",
    alignItems: "center",
    paddingLeft: 66,
    borderBottom: "1px solid #5b301f",
    background: "#1b110d",
    color: "#ff7b31",
    fontSize: 7,
    fontWeight: 1000,
    letterSpacing: 1,
  },

  footerNote: {
    padding: "10px 14px",
    display: "flex",
    alignItems: "center",
    gap: 7,
    background: "#0d0d0f",
    color: "#777a80",
    fontSize: 9,
  },

  legendDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: "#ff5a1f",
    flex: "0 0 auto",
  },

  empty: {
    padding: 30,
    textAlign: "center",
    color: "#777a80",
  },

  error: {
    padding: 16,
    border: "1px solid #742b25",
    borderRadius: 9,
    background: "#29110f",
    color: "#ffd1cc",
    display: "grid",
    gap: 8,
  },

  retry: {
    justifySelf: "start",
    border: 0,
    borderRadius: 5,
    padding: "8px 12px",
    background: "#ff4b20",
    color: "#fff",
    fontWeight: 1000,
    cursor: "pointer",
  },
};