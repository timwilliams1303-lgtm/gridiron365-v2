"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

type Props = { leagueId: string };

type Settings = {
  season: number;
  league_format: string | null;
  position_mode: string | null;
  competition_format: string | null;
};

type RosterSettings = {
  starting_c: number;
  starting_lw: number;
  starting_rw: number;
  starting_d: number;
  starting_g: number;
  starting_util: number;
  starting_f: number;
  bench_slots: number;
  ir_slots: number;
};

type Team = {
  id: number;
  owner_id: string | null;
  team_name: string;
  is_cpu: boolean;
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

type RosterRow = {
  id: number;
  fantasy_team_id: number;
  nhl_player_id: number;
  roster_status: string | null;
  acquired_via: string | null;
};

type LineupRow = {
  fantasy_team_id: number;
  nhl_player_id: number;
  lineup_slot: string | null;
  slot_index: number | null;
  week: number;
  lineup_date: string | null;
};

type Player = {
  id: number;
  display_name: string;
  team_abbreviation: string | null;
  position: string | null;
  position_group: string | null;
  headshot_url: string | null;
  active: boolean | null;
  status: string | null;
  injury_status: string | null;
};

type Projection = {
  nhl_player_id: number;
  overall_rank: number | null;
  position_rank: number | null;
  projected_fantasy_points: number;
  projected_fantasy_points_per_game: number;
  projected_games_played: number;
};

type SeasonActual = {
  nhl_player_id: number;
  fantasy_points: number;
  games_played: number;
  goals: number;
  assists: number;
  points: number;
  shots_on_goal: number;
  hits: number;
  blocked_shots: number;
  goalie_wins: number;
  goalie_saves: number;
};

type ViewPlayer = {
  roster: RosterRow;
  player: Player;
  projection: Projection | null;
  lineup: LineupRow | null;
};

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const n = (v: unknown) => Number(v ?? 0) || 0;
const text = (v: unknown, fallback = "") =>
  typeof v === "string" && v.trim() ? v.trim() : fallback;

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === "object") {
    const e = error as Record<string, unknown>;
    const parts = [e.message, e.details, e.hint, e.code ? `Code: ${e.code}` : ""]
      .filter((x) => typeof x === "string" && x)
      .map(String);
    if (parts.length) return parts.join(" • ");
  }
  return fallback;
}

function fmt(value: number, digits = 1) {
  return Number.isFinite(value) ? value.toFixed(digits) : "0.0";
}

function normalizePlayer(row: Record<string, unknown>): Player {
  const first = text(row.first_name);
  const last = text(row.last_name);
  return {
    id: n(row.id),
    display_name: text(row.display_name, `${first} ${last}`.trim() || `Player #${n(row.id)}`),
    team_abbreviation: text(row.team_abbreviation) || null,
    position: text(row.position) || null,
    position_group: text(row.position_group) || null,
    headshot_url: text(row.headshot_url) || null,
    active: typeof row.active === "boolean" ? row.active : null,
    status: text(row.status) || null,
    injury_status: text(row.injury_status) || text(row.injury_designation) || null,
  };
}

function normalizeProjection(row: Record<string, unknown>): Projection {
  return {
    nhl_player_id: n(row.nhl_player_id),
    overall_rank: row.overall_rank == null ? null : n(row.overall_rank),
    position_rank: row.position_rank == null ? null : n(row.position_rank),
    projected_fantasy_points: n(
      row.projected_fantasy_points ?? row.projected_points ?? row.fantasy_points
    ),
    projected_fantasy_points_per_game: n(
      row.projected_fantasy_points_per_game ?? row.projected_fppg ?? row.fppg
    ),
    projected_games_played: n(
      row.projected_games_played ?? row.projected_gp ?? row.games_played
    ),
  };
}

function slotLabel(row: ViewPlayer) {
  const slot = text(row.lineup?.lineup_slot).toUpperCase();
  if (slot) {
    const index = n(row.lineup?.slot_index);
    return index > 0 ? `${slot}${index}` : slot;
  }
  const status = text(row.roster.roster_status, "ROSTER").toUpperCase();
  return status === "ACTIVE" ? "ROSTER" : status;
}

function pos(player: Player) {
  return player.position || player.position_group || "—";
}

export default function NhlTraditionalTeams({ leagueId }: Props) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [rosterSettings, setRosterSettings] = useState<RosterSettings | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [standings, setStandings] = useState<Standing[]>([]);
  const [rosters, setRosters] = useState<RosterRow[]>([]);
  const [lineups, setLineups] = useState<LineupRow[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [projections, setProjections] = useState<Projection[]>([]);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
  const [detail, setDetail] = useState<ViewPlayer | null>(null);
  const [actual, setActual] = useState<SeasonActual | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data: authData } = await supabase.auth.getUser();
      setMyUserId(authData.user?.id ?? null);

      const [{ data: s, error: se }, { data: rs, error: rse }, { data: teamRows, error: te }] =
        await Promise.all([
          supabase
            .from("nhl_traditional_settings")
            .select("season,league_format,position_mode,competition_format")
            .eq("league_id", leagueId)
            .single(),
          supabase
            .from("nhl_traditional_roster_settings")
            .select(
              "starting_c,starting_lw,starting_rw,starting_d,starting_g,starting_util,starting_f,bench_slots,ir_slots"
            )
            .eq("league_id", leagueId)
            .single(),
          supabase
            .from("fantasy_teams")
            .select("id,owner_id,team_name,is_cpu")
            .eq("league_id", leagueId)
            .eq("active", true)
            .order("id"),
        ]);

      if (se) throw se;
      if (rse) throw rse;
      if (te) throw te;

      const loadedSettings: Settings = {
        season: n(s.season),
        league_format: text(s.league_format) || null,
        position_mode: text(s.position_mode) || null,
        competition_format: text(s.competition_format) || null,
      };
      setSettings(loadedSettings);
      setRosterSettings({
        starting_c: n(rs.starting_c),
        starting_lw: n(rs.starting_lw),
        starting_rw: n(rs.starting_rw),
        starting_d: n(rs.starting_d),
        starting_g: n(rs.starting_g),
        starting_util: n(rs.starting_util),
        starting_f: n(rs.starting_f),
        bench_slots: n(rs.bench_slots),
        ir_slots: n(rs.ir_slots),
      });

      const loadedTeams: Team[] = (teamRows ?? []).map((row) => ({
        id: n(row.id),
        owner_id: text(row.owner_id) || null,
        team_name: text(row.team_name, `Team ${row.id}`),
        is_cpu: Boolean(row.is_cpu),
      }));
      setTeams(loadedTeams);

      const teamIds = loadedTeams.map((t) => t.id);
      if (!selectedTeamId && teamIds.length) {
        const mine = loadedTeams.find((t) => t.owner_id === authData.user?.id);
        setSelectedTeamId(mine?.id ?? teamIds[0]);
      }

      const [{ data: standingRows, error: ste }, { data: rosterRows, error: re }] =
        await Promise.all([
          supabase
            .from("nhl_traditional_standings")
            .select("fantasy_team_id,wins,losses,ties,points_for,points_against,rank")
            .eq("league_id", leagueId)
            .eq("season", loadedSettings.season),
          supabase
            .from("nhl_traditional_rosters")
            .select("id,fantasy_team_id,nhl_player_id,roster_status,acquired_via")
            .eq("league_id", leagueId)
            .eq("season", loadedSettings.season)
            .is("dropped_at", null),
        ]);
      if (ste) throw ste;
      if (re) throw re;

      setStandings(
        (standingRows ?? []).map((row) => ({
          fantasy_team_id: n(row.fantasy_team_id),
          wins: n(row.wins),
          losses: n(row.losses),
          ties: n(row.ties),
          points_for: n(row.points_for),
          points_against: n(row.points_against),
          rank: row.rank == null ? null : n(row.rank),
        }))
      );

      const loadedRosters: RosterRow[] = (rosterRows ?? []).map((row) => ({
        id: n(row.id),
        fantasy_team_id: n(row.fantasy_team_id),
        nhl_player_id: n(row.nhl_player_id),
        roster_status: text(row.roster_status) || null,
        acquired_via: text(row.acquired_via) || null,
      }));
      setRosters(loadedRosters);

      const playerIds = [...new Set(loadedRosters.map((r) => r.nhl_player_id))];
      const loadedPlayers: Player[] = [];

      for (let i = 0; i < playerIds.length; i += 500) {
        const chunk = playerIds.slice(i, i + 500);
        const { data: playerRows, error: pe } = await supabase
          .from("nhl_players")
          .select("*")
          .in("id", chunk);
        if (pe) throw pe;
        loadedPlayers.push(
          ...(playerRows ?? []).map((row) =>
            normalizePlayer(row as Record<string, unknown>)
          )
        );
      }
      setPlayers(loadedPlayers);

      const { data: rankingRows, error: rankingError } = await supabase.rpc(
        "get_nhl_traditional_draft_rankings",
        { p_league_id: leagueId, p_season: loadedSettings.season }
      );
      if (rankingError) throw rankingError;
      setProjections(
        Array.isArray(rankingRows)
          ? rankingRows.map((row) =>
              normalizeProjection(row as Record<string, unknown>)
            )
          : []
      );

      if (teamIds.length) {
        const { data: lineupRows, error: le } = await supabase
          .from("nhl_traditional_weekly_lineups")
          .select(
            "fantasy_team_id,nhl_player_id,lineup_slot,slot_index,week,lineup_date"
          )
          .eq("league_id", leagueId)
          .eq("season", loadedSettings.season)
          .order("week", { ascending: false })
          .order("lineup_date", { ascending: false });
        if (le) throw le;

        const rows = (lineupRows ?? []).map((row) => ({
          fantasy_team_id: n(row.fantasy_team_id),
          nhl_player_id: n(row.nhl_player_id),
          lineup_slot: text(row.lineup_slot) || null,
          slot_index: row.slot_index == null ? null : n(row.slot_index),
          week: n(row.week),
          lineup_date: text(row.lineup_date) || null,
        }));

        // Keep only each team's most recent week/date snapshot.
        const latest = new Map<number, { week: number; date: string }>();
        for (const row of rows) {
          const prev = latest.get(row.fantasy_team_id);
          const date = row.lineup_date ?? "";
          if (!prev || row.week > prev.week || (row.week === prev.week && date > prev.date)) {
            latest.set(row.fantasy_team_id, { week: row.week, date });
          }
        }
        setLineups(
          rows.filter((row) => {
            const key = latest.get(row.fantasy_team_id);
            return !!key && row.week === key.week && (row.lineup_date ?? "") === key.date;
          })
        );
      } else {
        setLineups([]);
      }
    } catch (e) {
      console.error("Unable to load NHL Teams:", e);
      setError(errorMessage(e, "Unable to load NHL Teams."));
    } finally {
      setLoading(false);
    }
  }, [leagueId, selectedTeamId]);

  useEffect(() => {
    void load();
  }, [load]);

  const standingByTeam = useMemo(
    () => new Map(standings.map((s) => [s.fantasy_team_id, s])),
    [standings]
  );
  const playerById = useMemo(
    () => new Map(players.map((p) => [p.id, p])),
    [players]
  );
  const projectionById = useMemo(
    () => new Map(projections.map((p) => [p.nhl_player_id, p])),
    [projections]
  );
  const lineupByKey = useMemo(
    () =>
      new Map(
        lineups.map((l) => [`${l.fantasy_team_id}:${l.nhl_player_id}`, l])
      ),
    [lineups]
  );

  const selectedTeam =
    teams.find((team) => team.id === selectedTeamId) ?? teams[0] ?? null;

  const selectedPlayers = useMemo<ViewPlayer[]>(() => {
    if (!selectedTeam) return [];
    return rosters
      .filter((r) => r.fantasy_team_id === selectedTeam.id)
      .map((roster) => {
        const player = playerById.get(roster.nhl_player_id);
        if (!player) return null;
        return {
          roster,
          player,
          projection: projectionById.get(roster.nhl_player_id) ?? null,
          lineup:
            lineupByKey.get(`${roster.fantasy_team_id}:${roster.nhl_player_id}`) ??
            null,
        };
      })
      .filter((x): x is ViewPlayer => x !== null)
      .sort((a, b) => {
        const slotA = slotLabel(a);
        const slotB = slotLabel(b);
        const order = (slot: string) => {
          if (slot.startsWith("C")) return 10;
          if (slot.startsWith("LW")) return 20;
          if (slot.startsWith("RW")) return 30;
          if (slot.startsWith("F")) return 40;
          if (slot.startsWith("D")) return 50;
          if (slot.startsWith("G")) return 60;
          if (slot.startsWith("UTIL")) return 70;
          if (slot.startsWith("BN") || slot === "BENCH") return 80;
          if (slot.startsWith("IR")) return 90;
          return 75;
        };
        return (
          order(slotA) - order(slotB) ||
          slotA.localeCompare(slotB, undefined, { numeric: true }) ||
          (b.projection?.projected_fantasy_points ?? 0) -
            (a.projection?.projected_fantasy_points ?? 0)
        );
      });
  }, [selectedTeam, rosters, playerById, projectionById, lineupByKey]);

  const rosterCapacity = useMemo(() => {
    if (!rosterSettings) return 0;
    const starters =
      rosterSettings.starting_c +
      rosterSettings.starting_lw +
      rosterSettings.starting_rw +
      rosterSettings.starting_d +
      rosterSettings.starting_g +
      rosterSettings.starting_util +
      rosterSettings.starting_f;
    return starters + rosterSettings.bench_slots + rosterSettings.ir_slots;
  }, [rosterSettings]);

  async function openDetail(row: ViewPlayer) {
    setDetail(row);
    setActual(null);
    setDetailLoading(true);
    try {
      if (!settings) return;
      const priorSeason = settings.season - 1;
      const { data, error: actualError } = await supabase.rpc(
        "get_nhl_traditional_player_season_totals",
        {
          p_league_id: leagueId,
          p_season: priorSeason,
          p_season_type: "regular",
        }
      );
      if (actualError) throw actualError;
      const found = Array.isArray(data)
        ? data.find(
            (r) =>
              n((r as Record<string, unknown>).nhl_player_id) === row.player.id
          )
        : null;
      if (found) {
        const r = found as Record<string, unknown>;
        setActual({
          nhl_player_id: row.player.id,
          fantasy_points: n(r.fantasy_points),
          games_played: n(r.games_played),
          goals: n(r.goals),
          assists: n(r.assists),
          points: n(r.points),
          shots_on_goal: n(r.shots_on_goal),
          hits: n(r.hits),
          blocked_shots: n(r.blocked_shots),
          goalie_wins: n(r.goalie_wins ?? r.wins),
          goalie_saves: n(r.goalie_saves ?? r.saves),
        });
      }
    } catch (e) {
      console.error("Unable to load player detail:", e);
    } finally {
      setDetailLoading(false);
    }
  }

  if (loading) {
    return <main style={styles.page}><div style={styles.loading}>Loading NHL teams…</div></main>;
  }

  return (
    <main style={styles.page}>
      <div style={styles.shell}>
        <section style={styles.hero}>
          <div>
            <div style={styles.eyebrow}>GRIDIRON365 • NHL TRADITIONAL</div>
            <h1 style={styles.title}>League Teams</h1>
            <p style={styles.sub}>
              View every fantasy roster, current lineup and G365 projection.
            </p>
          </div>
          <div style={styles.badges}>
            <span style={styles.badge}>{text(settings?.league_format, "REDRAFT").toUpperCase()}</span>
            <span style={styles.badge}>{text(settings?.position_mode, "NHL").toUpperCase()}</span>
            <span style={styles.badge}>{settings?.season ?? "—"}</span>
          </div>
        </section>

        {error ? (
          <div style={styles.error}>
            <strong>Teams could not load.</strong>
            <div>{error}</div>
            <button style={styles.retry} onClick={() => void load()}>Try Again</button>
          </div>
        ) : null}

        <section>
          <div style={styles.sectionHead}>
            <div>
              <div style={styles.eyebrow}>LEAGUE TEAMS</div>
              <h2 style={styles.sectionTitle}>{teams.length} Teams</h2>
            </div>
          </div>

          <div style={styles.teamGrid}>
            {teams.map((team) => {
              const st = standingByTeam.get(team.id);
              const count = rosters.filter((r) => r.fantasy_team_id === team.id).length;
              const selected = selectedTeam?.id === team.id;
              const mine = team.owner_id && team.owner_id === myUserId;
              return (
                <button
                  key={team.id}
                  type="button"
                  onClick={() => setSelectedTeamId(team.id)}
                  style={{
                    ...styles.teamCard,
                    ...(selected ? styles.teamCardSelected : {}),
                  }}
                >
                  <div style={styles.teamTop}>
                    <div style={styles.teamName}>{team.team_name}</div>
                    {mine ? <span style={styles.mine}>MY TEAM</span> : null}
                    {team.is_cpu ? <span style={styles.cpu}>CPU</span> : null}
                  </div>
                  <div style={styles.teamStats}>
                    <span>#{st?.rank ?? "—"}</span>
                    <span>{st ? `${st.wins}-${st.losses}-${st.ties}` : "0-0-0"}</span>
                    <span>{count}/{rosterCapacity || "—"} Rostered</span>
                  </div>
                  <div style={styles.pf}>
                    PF {fmt(st?.points_for ?? 0)} • PA {fmt(st?.points_against ?? 0)}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {selectedTeam ? (
          <section style={styles.rosterPanel}>
            <div style={styles.rosterHeader}>
              <div>
                <div style={styles.eyebrow}>TEAM ROSTER</div>
                <h2 style={styles.rosterTitle}>{selectedTeam.team_name}</h2>
                <div style={styles.rosterMeta}>
                  {selectedPlayers.length}/{rosterCapacity || "—"} players
                  {lineups.some((l) => l.fantasy_team_id === selectedTeam.id)
                    ? " • Current lineup loaded"
                    : " • Pre-lineup roster view"}
                </div>
              </div>
              {standingByTeam.get(selectedTeam.id) ? (
                <div style={styles.recordBox}>
                  <strong>
                    {standingByTeam.get(selectedTeam.id)!.wins}-
                    {standingByTeam.get(selectedTeam.id)!.losses}-
                    {standingByTeam.get(selectedTeam.id)!.ties}
                  </strong>
                  <span>Rank #{standingByTeam.get(selectedTeam.id)!.rank ?? "—"}</span>
                </div>
              ) : null}
            </div>

            <div className="nhl-teams-desktop-table" style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>SLOT</th>
                    <th style={styles.th}>PLAYER</th>
                    <th style={styles.th}>NHL</th>
                    <th style={styles.th}>POS</th>
                    <th style={styles.th}>G365 RK</th>
                    <th style={styles.th}>PROJ FP</th>
                    <th style={styles.th}>FPPG</th>
                    <th style={styles.th}>GP</th>
                    <th style={styles.th}>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedPlayers.map((row) => (
                    <tr key={row.roster.id} style={styles.tr}>
                      <td style={styles.td}><span style={styles.slot}>{slotLabel(row)}</span></td>
                      <td style={{ ...styles.td, minWidth: 210 }}>
                        <div style={styles.playerIdentity}>
                          <div style={styles.headshotWrap}>
                            {row.player.headshot_url ? (
                              <img src={row.player.headshot_url} alt="" style={styles.headshot} />
                            ) : (
                              <span style={styles.fallback}>
                                {row.player.display_name.slice(0, 1)}
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => void openDetail(row)}
                            style={styles.playerName}
                          >
                            {row.player.display_name}
                          </button>
                        </div>
                      </td>
                      <td style={styles.td}>{row.player.team_abbreviation ?? "FA"}</td>
                      <td style={styles.td}>{pos(row.player)}</td>
                      <td style={styles.td}>
                        {row.projection?.overall_rank ? `#${row.projection.overall_rank}` : "—"}
                      </td>
                      <td style={styles.tdStrong}>
                        {fmt(row.projection?.projected_fantasy_points ?? 0)}
                      </td>
                      <td style={styles.td}>{fmt(row.projection?.projected_fantasy_points_per_game ?? 0, 2)}</td>
                      <td style={styles.td}>{fmt(row.projection?.projected_games_played ?? 0, 1)}</td>
                      <td style={styles.td}>
                        {row.player.injury_status ? (
                          <span style={styles.injury}>{row.player.injury_status}</span>
                        ) : (
                          <span style={styles.active}>ACTIVE</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {!selectedPlayers.length ? (
                <div style={styles.empty}>No players are currently rostered on this team.</div>
              ) : null}
            </div>

            <div className="mobile-roster" style={styles.mobileRoster}>
              {selectedPlayers.map((row) => (
                <article key={`mobile-${row.roster.id}`} style={styles.mobileCard}>
                  <div style={styles.mobileTop}>
                    <div style={styles.playerIdentity}>
                      <div style={styles.headshotWrap}>
                        {row.player.headshot_url ? (
                          <img src={row.player.headshot_url} alt="" style={styles.headshot} />
                        ) : (
                          <span style={styles.fallback}>{row.player.display_name.slice(0, 1)}</span>
                        )}
                      </div>
                      <div>
                        <button
                          type="button"
                          onClick={() => void openDetail(row)}
                          style={styles.playerName}
                        >
                          {row.player.display_name}
                        </button>
                        <div style={styles.mobileMeta}>
                          {row.player.team_abbreviation ?? "NHL FA"} • {pos(row.player)}
                        </div>
                      </div>
                    </div>
                    <span style={styles.slot}>{slotLabel(row)}</span>
                  </div>
                  <div style={styles.mobileStats}>
                    <div><small>G365 RK</small><strong>{row.projection?.overall_rank ? `#${row.projection.overall_rank}` : "—"}</strong></div>
                    <div><small>PROJ FP</small><strong>{fmt(row.projection?.projected_fantasy_points ?? 0)}</strong></div>
                    <div><small>FPPG</small><strong>{fmt(row.projection?.projected_fantasy_points_per_game ?? 0, 2)}</strong></div>
                    <div><small>GP</small><strong>{fmt(row.projection?.projected_games_played ?? 0, 1)}</strong></div>
                  </div>
                  {row.player.injury_status ? (
                    <div style={styles.mobileInjury}>{row.player.injury_status}</div>
                  ) : null}
                </article>
              ))}
            </div>
          </section>
        ) : null}
      </div>

      {detail ? (
        <div style={styles.overlay} onMouseDown={() => setDetail(null)}>
          <div style={styles.modal} onMouseDown={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div style={styles.modalIdentity}>
                <div style={styles.modalHeadshotWrap}>
                  {detail.player.headshot_url ? (
                    <img src={detail.player.headshot_url} alt="" style={styles.modalHeadshot} />
                  ) : (
                    <span style={styles.modalFallback}>{detail.player.display_name.slice(0, 1)}</span>
                  )}
                </div>
                <div>
                  <div style={styles.eyebrow}>G365 PLAYER PROFILE</div>
                  <h2 style={styles.modalTitle}>{detail.player.display_name}</h2>
                  <div style={styles.modalMeta}>
                    {detail.player.team_abbreviation ?? "NHL FA"} • {pos(detail.player)}
                    {" • "}G365 #{detail.projection?.overall_rank ?? "—"}
                  </div>
                </div>
              </div>
              <button style={styles.close} onClick={() => setDetail(null)} aria-label="Close">×</button>
            </div>

            <div style={styles.modalSection}>
              <div style={styles.modalSectionTitle}>{settings?.season ?? ""} G365 PROJECTION</div>
              <div style={styles.statGrid}>
                <Stat label="Projected FP" value={fmt(detail.projection?.projected_fantasy_points ?? 0)} />
                <Stat label="FPPG" value={fmt(detail.projection?.projected_fantasy_points_per_game ?? 0, 2)} />
                <Stat label="Games" value={fmt(detail.projection?.projected_games_played ?? 0, 1)} />
                <Stat label="Position Rank" value={detail.projection?.position_rank ? `#${detail.projection.position_rank}` : "—"} />
              </div>
            </div>

            <div style={styles.modalSection}>
              <div style={styles.modalSectionTitle}>{(settings?.season ?? 0) - 1} ACTUAL</div>
              {detailLoading ? (
                <div style={styles.empty}>Loading previous-season stats…</div>
              ) : actual ? (
                <div style={styles.statGrid}>
                  <Stat label="Fantasy FP" value={fmt(actual.fantasy_points)} />
                  <Stat label="Games" value={String(actual.games_played)} />
                  {pos(detail.player).toUpperCase() === "G" ? (
                    <>
                      <Stat label="Wins" value={String(actual.goalie_wins)} />
                      <Stat label="Saves" value={String(actual.goalie_saves)} />
                    </>
                  ) : (
                    <>
                      <Stat label="Goals" value={String(actual.goals)} />
                      <Stat label="Assists" value={String(actual.assists)} />
                      <Stat label="Points" value={String(actual.points)} />
                      <Stat label="SOG" value={String(actual.shots_on_goal)} />
                      <Stat label="Hits" value={String(actual.hits)} />
                      <Stat label="Blocks" value={String(actual.blocked_shots)} />
                    </>
                  )}
                </div>
              ) : (
                <div style={styles.empty}>NONE — ROOKIE / NO PRIOR NHL STATS</div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      <style jsx global>{`
        @media (max-width: 760px) {
          .nhl-teams-desktop-table { display: none !important; }
        }
        @media (min-width: 761px) {
          .mobile-roster { display: none !important; }
        }
      `}</style>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.stat}>
      <span style={styles.statLabel}>{label}</span>
      <strong style={styles.statValue}>{value}</strong>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: "#09090a", color: "#f7f7f8", padding: "18px 12px 60px" },
  shell: { width: "min(1240px, 100%)", margin: "0 auto", display: "grid", gap: 18 },
  loading: { padding: 40, textAlign: "center", color: "#aaa" },
  hero: { display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap", padding: "20px", border: "1px solid #29292d", borderRadius: 16, background: "linear-gradient(135deg,#171719,#0e0e10 62%,#251008)" },
  eyebrow: { color: "#ff6a00", fontSize: 11, fontWeight: 950, letterSpacing: 1.4 },
  title: { margin: "4px 0", fontSize: "clamp(28px,5vw,46px)", lineHeight: .95, fontWeight: 1000 },
  sub: { margin: "8px 0 0", color: "#aaa", fontSize: 14 },
  badges: { display: "flex", gap: 7, flexWrap: "wrap" },
  badge: { padding: "7px 10px", border: "1px solid #4a2416", borderRadius: 999, background: "#1b100c", color: "#ff8a3d", fontSize: 11, fontWeight: 900 },
  error: { padding: 14, border: "1px solid #7d2d27", borderRadius: 12, background: "#2b1110", color: "#ffd1cc", display: "grid", gap: 6 },
  retry: { justifySelf: "start", border: 0, borderRadius: 8, padding: "8px 12px", background: "#ff4b20", color: "#fff", fontWeight: 900, cursor: "pointer" },
  sectionHead: { display: "flex", justifyContent: "space-between", alignItems: "end", marginBottom: 10 },
  sectionTitle: { margin: "2px 0 0", fontSize: 22 },
  teamGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 10 },
  teamCard: { textAlign: "left", padding: 14, border: "1px solid #29292d", borderRadius: 13, background: "#121214", color: "#fff", cursor: "pointer" },
  teamCardSelected: { border: "1px solid #ff5b24", boxShadow: "0 0 0 1px rgba(255,91,36,.18), inset 0 0 28px rgba(255,73,20,.07)" },
  teamTop: { display: "flex", alignItems: "center", gap: 7, minHeight: 25 },
  teamName: { fontSize: 16, fontWeight: 950, flex: 1 },
  mine: { fontSize: 9, fontWeight: 1000, color: "#ff8a3d", border: "1px solid #5d2d17", borderRadius: 999, padding: "3px 6px" },
  cpu: { fontSize: 9, fontWeight: 1000, color: "#bbb", border: "1px solid #444", borderRadius: 999, padding: "3px 6px" },
  teamStats: { marginTop: 9, display: "flex", justifyContent: "space-between", gap: 8, color: "#ddd", fontSize: 12, fontWeight: 800 },
  pf: { marginTop: 7, color: "#777", fontSize: 11 },
  rosterPanel: { border: "1px solid #29292d", borderRadius: 16, overflow: "hidden", background: "#101012" },
  rosterHeader: { padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", borderBottom: "1px solid #27272a", background: "linear-gradient(90deg,#171719,#120c09)" },
  rosterTitle: { margin: "2px 0", fontSize: 25 },
  rosterMeta: { color: "#888", fontSize: 12 },
  recordBox: { display: "grid", justifyItems: "end", gap: 2 },
  tableWrap: { overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse", minWidth: 880 },
  th: { padding: "9px 8px", textAlign: "left", color: "#777", fontSize: 10, letterSpacing: .6, borderBottom: "1px solid #29292d", whiteSpace: "nowrap" },
  tr: { borderBottom: "1px solid #1f1f22" },
  td: { padding: "7px 8px", fontSize: 12, whiteSpace: "nowrap" },
  tdStrong: { padding: "7px 8px", fontSize: 14, fontWeight: 1000, color: "#fff", whiteSpace: "nowrap" },
  slot: { display: "inline-block", minWidth: 34, textAlign: "center", padding: "4px 6px", borderRadius: 6, background: "#25130d", border: "1px solid #512617", color: "#ff7b36", fontSize: 10, fontWeight: 1000 },
  playerIdentity: { display: "flex", alignItems: "center", gap: 8, minWidth: 0 },
  headshotWrap: { width: 38, height: 38, flex: "0 0 38px", borderRadius: "50%", overflow: "hidden", display: "grid", placeItems: "center", background: "#1a1a1d", border: "1px solid #333" },
  headshot: { width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top" },
  fallback: { color: "#ff6a00", fontWeight: 1000 },
  playerName: { padding: 0, border: 0, background: "transparent", color: "#fff", fontWeight: 950, cursor: "pointer", textAlign: "left" },
  injury: { color: "#ff9a62", fontWeight: 900, fontSize: 10 },
  active: { color: "#62d88b", fontWeight: 900, fontSize: 10 },
  empty: { padding: 20, textAlign: "center", color: "#888", fontSize: 13 },
  mobileRoster: { display: "grid", gap: 8, padding: 10 },
  mobileCard: { padding: 11, border: "1px solid #28282c", borderRadius: 12, background: "#151517" },
  mobileTop: { display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" },
  mobileMeta: { color: "#888", fontSize: 11, marginTop: 2 },
  mobileStats: { marginTop: 10, display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 5 },
  mobileInjury: { marginTop: 8, color: "#ff9a62", fontSize: 10, fontWeight: 900 },
  overlay: { position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,.78)", display: "grid", placeItems: "center", padding: 14 },
  modal: { width: "min(760px,100%)", maxHeight: "90vh", overflowY: "auto", border: "1px solid #3b302c", borderRadius: 16, background: "#111113", boxShadow: "0 24px 80px rgba(0,0,0,.6)" },
  modalHeader: { padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, borderBottom: "1px solid #29292d" },
  modalIdentity: { display: "flex", alignItems: "center", gap: 12, minWidth: 0 },
  modalHeadshotWrap: { width: 68, height: 68, flex: "0 0 68px", borderRadius: "50%", overflow: "hidden", display: "grid", placeItems: "center", background: "#19191c", border: "1px solid #5b2c18" },
  modalHeadshot: { width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top" },
  modalFallback: { fontSize: 24, color: "#ff6a00", fontWeight: 1000 },
  modalTitle: { margin: "3px 0", fontSize: 25, lineHeight: 1 },
  modalMeta: { color: "#999", fontSize: 12 },
  close: { width: 36, height: 36, border: "1px solid #3a3a3e", borderRadius: 9, background: "#19191c", color: "#fff", fontSize: 23, cursor: "pointer" },
  modalSection: { padding: 16, borderBottom: "1px solid #252528" },
  modalSectionTitle: { marginBottom: 9, color: "#ff6a00", fontSize: 11, fontWeight: 1000, letterSpacing: .8 },
  statGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(110px,1fr))", gap: 7 },
  stat: { padding: 10, border: "1px solid #29292d", borderRadius: 9, background: "#171719", display: "grid", gap: 4 },
  statLabel: { color: "#777", fontSize: 9, fontWeight: 900, textTransform: "uppercase" },
  statValue: { fontSize: 17, color: "#fff" },
};
