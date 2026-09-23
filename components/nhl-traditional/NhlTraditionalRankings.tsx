"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { createBrowserClient } from "@supabase/ssr";

type Props = { leagueId: string };

type LeagueRow = {
  id: string;
  name: string;
  season: number;
  league_type: string | null;
  status: string | null;
};

type SettingsRow = {
  league_format: string | null;
  position_mode: string | null;
};

type DraftRow = {
  id: string;
  status: string;
  current_overall_pick: number;
};

type DraftPickRow = {
  id: number;
  draft_id: string;
  overall_pick: number;
  nhl_player_id: number;
};

type RankingRow = {
  overall_rank: number;
  position_rank: number;
  nhl_player_id: number;
  display_name: string;
  team_abbreviation: string | null;
  player_position: string | null;
  player_position_group: string | null;
  projected_games_played: number;
  projected_fantasy_points: number;
  projected_fantasy_points_per_game: number;
  projected_goals: number;
  projected_assists: number;
  projected_points: number;
  projected_plus_minus: number;
  projected_penalty_minutes: number;
  projected_power_play_points: number;
  projected_short_handed_points: number;
  projected_shots_on_goal: number;
  projected_hits: number;
  projected_blocked_shots: number;
  projected_goalie_starts: number;
  projected_goalie_wins: number;
  projected_goalie_losses: number;
  projected_goalie_ot_losses: number;
  projected_saves: number;
  projected_shots_against: number;
  projected_goals_against: number;
  projected_shutouts: number;
  projected_save_percentage: number | null;
  projected_goals_against_average: number | null;
  projection_method: string | null;
  headshot_url: string | null;
};

type UserRankingRow = {
  nhl_player_id: number;
  rank_order: number;
};

type SeasonTotalsRow = Record<string, unknown>;
type RpcJson = Record<string, unknown>;

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function num(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function nullableNum(v: unknown) {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function normalizeRanking(row: Record<string, unknown>): RankingRow {
  return {
    overall_rank: num(row.overall_rank),
    position_rank: num(row.position_rank),
    nhl_player_id: num(row.nhl_player_id),
    display_name:
      typeof row.display_name === "string"
        ? row.display_name
        : `Player #${num(row.nhl_player_id)}`,
    team_abbreviation:
      typeof row.team_abbreviation === "string" ? row.team_abbreviation : null,
    player_position:
      typeof row.player_position === "string" ? row.player_position : null,
    player_position_group:
      typeof row.player_position_group === "string"
        ? row.player_position_group
        : null,
    projected_games_played: num(row.projected_games_played),
    projected_fantasy_points: num(row.projected_fantasy_points),
    projected_fantasy_points_per_game: num(
      row.projected_fantasy_points_per_game
    ),
    projected_goals: num(row.projected_goals),
    projected_assists: num(row.projected_assists),
    projected_points: num(row.projected_points),
    projected_plus_minus: num(row.projected_plus_minus),
    projected_penalty_minutes: num(row.projected_penalty_minutes),
    projected_power_play_points: num(row.projected_power_play_points),
    projected_short_handed_points: num(row.projected_short_handed_points),
    projected_shots_on_goal: num(row.projected_shots_on_goal),
    projected_hits: num(row.projected_hits),
    projected_blocked_shots: num(row.projected_blocked_shots),
    projected_goalie_starts: num(row.projected_goalie_starts),
    projected_goalie_wins: num(row.projected_goalie_wins),
    projected_goalie_losses: num(row.projected_goalie_losses),
    projected_goalie_ot_losses: num(row.projected_goalie_ot_losses),
    projected_saves: num(row.projected_saves),
    projected_shots_against: num(row.projected_shots_against),
    projected_goals_against: num(row.projected_goals_against),
    projected_shutouts: num(row.projected_shutouts),
    projected_save_percentage: nullableNum(row.projected_save_percentage),
    projected_goals_against_average: nullableNum(
      row.projected_goals_against_average
    ),
    projection_method:
      typeof row.projection_method === "string" ? row.projection_method : null,
    headshot_url:
      typeof row.headshot_url === "string" && row.headshot_url.trim()
        ? row.headshot_url
        : null,
  };
}

function pos(player: RankingRow) {
  const p = (player.player_position ?? "").trim().toUpperCase();
  const g = (player.player_position_group ?? "").trim().toUpperCase();
  if (p === "CENTER") return "C";
  if (["LW", "LEFT WING", "LEFTWING"].includes(p)) return "LW";
  if (["RW", "RIGHT WING", "RIGHTWING"].includes(p)) return "RW";
  if (["D", "DEFENSE", "DEFENSEMAN", "DEFENCEMAN"].includes(p)) return "D";
  if (["G", "GOALIE", "GOALTENDER"].includes(p)) return "G";
  if (g === "GOALIE" || g === "G") return "G";
  if (g === "DEFENSE" || g === "D") return "D";
  if (g === "FORWARD" || g === "F") return "F";
  return p || "—";
}

function isForward(player: RankingRow) {
  return ["C", "LW", "RW", "F"].includes(pos(player));
}

function positionRank(player: RankingRow, mode: string) {
  const p = mode === "fdg" && isForward(player) ? "F" : pos(player);
  return `${p}${player.position_rank}`;
}

function recordNumber(row: SeasonTotalsRow | null, ...keys: string[]) {
  if (!row) return null;
  for (const key of keys) {
    const value = row[key];
    if (value !== null && value !== undefined && value !== "") {
      const n = Number(value);
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}

function stat(v: number | null | undefined, digits = 0) {
  return v == null ? "—" : Number(v).toFixed(digits);
}

export default function NhlTraditionalRankings({ leagueId }: Props) {
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [league, setLeague] = useState<LeagueRow | null>(null);
  const [settings, setSettings] = useState<SettingsRow | null>(null);
  const [rankings, setRankings] = useState<RankingRow[]>([]);
  const [myRankings, setMyRankings] = useState<UserRankingRow[]>([]);
  const [draft, setDraft] = useState<DraftRow | null>(null);
  const [draftPicks, setDraftPicks] = useState<DraftPickRow[]>([]);

  const [search, setSearch] = useState("");
  const [teamFilter, setTeamFilter] = useState("ALL");
  const [positionFilter, setPositionFilter] = useState("ALL");
  const [moveValues, setMoveValues] = useState<Record<number, string>>({});

  const [detailId, setDetailId] = useState<number | null>(null);
  const [lastSeason, setLastSeason] = useState<SeasonTotalsRow | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const loadDraft = useCallback(async () => {
    const { data, error: stateError } = await supabase.rpc(
      "get_nhl_traditional_draft_state",
      { p_league_id: leagueId }
    );
    if (stateError) throw stateError;

    const state =
      data && typeof data === "object" ? (data as RpcJson) : null;

    if (state?.exists !== true) {
      setDraft(null);
      setDraftPicks([]);
      return;
    }

    const loaded: DraftRow = {
      id: String(state.draftId ?? ""),
      status: String(state.status ?? "setup"),
      current_overall_pick: Number(state.currentOverallPick ?? 1),
    };
    setDraft(loaded);

    if (!loaded.id) {
      setDraftPicks([]);
      return;
    }

    const { data: picks, error: picksError } = await supabase
      .from("nhl_traditional_draft_picks")
      .select("id,draft_id,overall_pick,nhl_player_id")
      .eq("draft_id", loaded.id)
      .order("overall_pick", { ascending: true });

    if (picksError) throw picksError;
    setDraftPicks((picks as DraftPickRow[] | null) ?? []);
  }, [leagueId]);

  const loadMyRankings = useCallback(async () => {
    const { data, error: rankingError } = await supabase
      .from("nhl_traditional_user_rankings")
      .select("nhl_player_id,rank_order")
      .eq("league_id", leagueId)
      .order("rank_order", { ascending: true });

    if (rankingError) throw rankingError;
    setMyRankings((data as UserRankingRow[] | null) ?? []);
  }, [leagueId]);

  const loadPage = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [leagueResult, settingsResult] = await Promise.all([
        supabase
          .from("leagues")
          .select("id,name,season,league_type,status")
          .eq("id", leagueId)
          .single(),
        supabase
          .from("nhl_traditional_settings")
          .select("league_format,position_mode")
          .eq("league_id", leagueId)
          .maybeSingle(),
      ]);

      if (leagueResult.error) throw leagueResult.error;
      if (settingsResult.error) throw settingsResult.error;

      const loadedLeague = leagueResult.data as LeagueRow;
      if (loadedLeague.league_type !== "nhl_traditional") {
        throw new Error("This league is not an NHL Traditional league.");
      }

      setLeague(loadedLeague);
      setSettings((settingsResult.data as SettingsRow | null) ?? null);

      const { data: master, error: masterError } = await supabase.rpc(
        "get_nhl_traditional_draft_rankings",
        { p_league_id: leagueId, p_season: loadedLeague.season }
      );
      if (masterError) throw masterError;

      setRankings(
        Array.isArray(master)
          ? master.map((row) =>
              normalizeRanking(row as Record<string, unknown>)
            )
          : []
      );

      const { error: initializeError } = await supabase.rpc(
        "initialize_nhl_traditional_user_rankings",
        { p_league_id: leagueId, p_season: loadedLeague.season }
      );
      if (initializeError) throw initializeError;

      await Promise.all([loadMyRankings(), loadDraft()]);
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "Unable to load My Rankings.");
    } finally {
      setLoading(false);
    }
  }, [leagueId, loadDraft, loadMyRankings]);

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  useEffect(() => {
    if (draft?.status !== "drafting" && draft?.status !== "paused") return;
    const timer = window.setInterval(() => void loadDraft(), 5000);
    return () => window.clearInterval(timer);
  }, [draft?.status, loadDraft]);

  const mode = settings?.position_mode === "fdg" ? "fdg" : "detailed";
  const positionFilters =
    mode === "fdg" ? ["ALL", "F", "D", "G"] : ["ALL", "C", "LW", "RW", "D", "G"];

  const masterById = useMemo(
    () => new Map(rankings.map((player) => [player.nhl_player_id, player])),
    [rankings]
  );

  const myRankById = useMemo(
    () => new Map(myRankings.map((row) => [row.nhl_player_id, row.rank_order])),
    [myRankings]
  );

  const draftedIds = useMemo(
    () => new Set(draftPicks.map((pick) => pick.nhl_player_id)),
    [draftPicks]
  );

  const rankingsLocked = draft?.status === "completed";

  const hideDrafted =
    draft?.status === "drafting" || draft?.status === "paused";

  const orderedPlayers = useMemo(() => {
    return [...rankings].sort((a, b) => {
      const ar = myRankById.get(a.nhl_player_id) ?? a.overall_rank;
      const br = myRankById.get(b.nhl_player_id) ?? b.overall_rank;
      return ar - br;
    });
  }, [rankings, myRankById]);

  const teamOptions = useMemo(() => {
    return [
      ...new Set(
        rankings
          .map((player) => player.team_abbreviation?.trim().toUpperCase())
          .filter((value): value is string => Boolean(value))
      ),
    ].sort();
  }, [rankings]);

  const shownPlayers = useMemo(() => {
    const q = search.trim().toLowerCase();

    return orderedPlayers.filter((player) => {
      if (hideDrafted && draftedIds.has(player.nhl_player_id)) return false;

      const p = pos(player);
      if (positionFilter !== "ALL") {
        if (positionFilter === "F" && mode === "fdg") {
          if (!isForward(player)) return false;
        } else if (p !== positionFilter) {
          return false;
        }
      }

      const team = player.team_abbreviation?.toUpperCase() ?? "FA";
      if (teamFilter !== "ALL" && team !== teamFilter) return false;

      if (!q) return true;
      return `${player.display_name} ${team} ${p} ${positionRank(player, mode)}`
        .toLowerCase()
        .includes(q);
    });
  }, [
    draftedIds,
    hideDrafted,
    mode,
    orderedPlayers,
    positionFilter,
    search,
    teamFilter,
  ]);

  async function movePlayer(playerId: number, newRank: number) {
    if (working) return;
    setWorking(true);
    setError(null);

    try {
      const { error: moveError } = await supabase.rpc(
        "move_nhl_traditional_user_ranking",
        {
          p_league_id: leagueId,
          p_nhl_player_id: playerId,
          p_new_rank: newRank,
        }
      );
      if (moveError) throw moveError;
      await loadMyRankings();
      setMoveValues((current) => ({ ...current, [playerId]: "" }));
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "Unable to move player.");
    } finally {
      setWorking(false);
    }
  }

  async function resetRankings() {
    if (!league || working) return;
    if (!window.confirm("Reset My Rankings back to the original G365 order?")) {
      return;
    }

    setWorking(true);
    setError(null);
    try {
      const { error: resetError } = await supabase.rpc(
        "reset_nhl_traditional_user_rankings",
        { p_league_id: leagueId, p_season: league.season }
      );
      if (resetError) throw resetError;
      await loadMyRankings();
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "Unable to reset rankings.");
    } finally {
      setWorking(false);
    }
  }

  async function openDetail(playerId: number) {
    if (!league) return;
    setDetailId(playerId);
    setLastSeason(null);
    setDetailError(null);
    setDetailLoading(true);

    try {
      const { data, error: totalsError } = await supabase.rpc(
        "get_nhl_traditional_player_season_totals",
        {
          p_league_id: leagueId,
          p_season: league.season - 1,
          p_season_type: "regular",
        }
      );
      if (totalsError) throw totalsError;

      const rows = Array.isArray(data) ? (data as SeasonTotalsRow[]) : [];
      setLastSeason(
        rows.find(
          (row) =>
            Number(row.nhl_player_id ?? row.player_id ?? row.id) === playerId
        ) ?? null
      );
    } catch (e) {
      console.error(e);
      setDetailError(
        e instanceof Error ? e.message : "Unable to load previous season."
      );
    } finally {
      setDetailLoading(false);
    }
  }

  const detail = detailId == null ? null : masterById.get(detailId) ?? null;

  if (loading) {
    return (
      <main style={styles.page}>
        <div style={styles.container}>
          <div style={styles.card}>Loading My Rankings...</div>
        </div>
      </main>
    );
  }

  if (!league) {
    return (
      <main style={styles.page}>
        <div style={styles.container}>
          <div style={styles.error}>NHL Traditional league was not found.</div>
        </div>
      </main>
    );
  }

  if (rankingsLocked) {
    return (
      <main style={styles.page}>
        <style>{`
          @media (max-width:760px) {
            .my-rank-locked-card { padding:28px 18px !important; }
          }
        `}</style>
        <div style={styles.container}>
          <section
            className="my-rank-locked-card"
            style={{
              ...styles.card,
              minHeight: 320,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
              textAlign: "center",
              opacity: 0.72,
              filter: "grayscale(0.72)",
            }}
          >
            <div style={styles.eyebrow}>GRIDIRON365 • NHL TRADITIONAL</div>
            <h1 style={{ ...styles.title, margin: 0 }}>My Rankings</h1>
            <span
              style={{
                ...styles.badge,
                color: "#8d929a",
                borderColor: "rgba(255,255,255,.12)",
                background: "rgba(255,255,255,.035)",
              }}
            >
              LOCKED • DRAFT COMPLETE
            </span>
            <div
              style={{
                ...styles.description,
                maxWidth: 560,
                color: "#7f858e",
              }}
            >
              Rankings are closed because this draft is complete. They will
              automatically reopen when the next NHL draft is created for the
              league.
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <style>{`
        .my-rank-row:hover { background:#17171a; }
        .my-rank-name:hover { color:#ff8a3d !important; text-decoration:underline; }
        .my-rank-table-wrap { width:100%; overflow-x:hidden; }
        .my-rank-player-wrap { display:flex; align-items:center; gap:7px; min-width:0; }
        .my-rank-headshot {
          width:30px;
          height:30px;
          flex:0 0 30px;
          border-radius:50%;
          object-fit:cover;
          object-position:center top;
          background:#18181b;
          border:1px solid #34343a;
        }
        .my-rank-headshot-fallback {
          display:grid;
          place-items:center;
          color:#737780;
          font-size:8px;
          font-weight:950;
        }
        @media (max-width:900px) {
          .my-rank-team { display:none !important; }
          .my-rank-gp { display:none !important; }
        }
        @media (max-width:760px) {
          .my-rank-header { flex-direction:column !important; align-items:stretch !important; }
          .my-rank-controls { grid-template-columns:1fr !important; }
          .my-rank-posrank { display:none !important; }
          .my-rank-fppg { display:none !important; }
          .my-rank-table th, .my-rank-table td { padding:6px 3px !important; }
          .my-rank-player { min-width:0 !important; }
          .my-rank-headshot { width:26px; height:26px; flex-basis:26px; }
        }
      `}</style>

      <div style={styles.container}>
        <section className="my-rank-header" style={styles.header}>
          <div>
            <div style={styles.eyebrow}>GRIDIRON365 • NHL TRADITIONAL</div>
            <h1 style={styles.title}>My Rankings</h1>
            <div style={styles.subtitle}>
              {league.name} • {league.season}-{String(league.season + 1).slice(-2)} •{" "}
              {settings?.league_format === "dynasty" ? "Dynasty" : "Redraft"}
            </div>
            <div style={styles.description}>
              Your private draft board. It starts with the G365 preseason order,
              then you can move players anywhere you want.
            </div>
          </div>

          <div style={styles.headerActions}>
            <span style={styles.badge}>
              {draft?.status === "drafting"
                ? `LIVE • PICK ${draft.current_overall_pick}`
                : draft?.status?.toUpperCase() ?? "PRE-DRAFT"}
            </span>
            <button
              type="button"
              onClick={() => void resetRankings()}
              disabled={working}
              style={styles.resetButton}
            >
              Reset to G365
            </button>
          </div>
        </section>

        {error ? <div style={styles.error}>{error}</div> : null}

        {hideDrafted ? (
          <div style={styles.liveNotice}>
            Drafted players automatically disappear. Your custom order stays
            intact and returns if the commissioner resets the draft.
          </div>
        ) : null}

        <section style={styles.summary}>
          <div style={styles.summaryBox}>
            <span>MY BOARD</span>
            <strong>{myRankings.length}</strong>
          </div>
          <div style={styles.summaryBox}>
            <span>SHOWING</span>
            <strong>{shownPlayers.length}</strong>
          </div>
          <div style={styles.summaryBox}>
            <span>DRAFTED</span>
            <strong>{draftPicks.length}</strong>
          </div>
        </section>

        <section style={styles.controls}>
          <div className="my-rank-controls" style={styles.controlGrid}>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search player, team or position..."
              style={styles.input}
            />
            <select
              value={teamFilter}
              onChange={(e) => setTeamFilter(e.target.value)}
              style={styles.input}
            >
              <option value="ALL">All NHL Teams</option>
              <option value="FA">NHL Free Agents</option>
              {teamOptions.map((team) => (
                <option key={team} value={team}>
                  {team}
                </option>
              ))}
            </select>
          </div>

          <div style={styles.positionBar}>
            {positionFilters.map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setPositionFilter(filter)}
                style={{
                  ...styles.positionButton,
                  ...(positionFilter === filter
                    ? styles.positionButtonActive
                    : {}),
                }}
              >
                {filter}
              </button>
            ))}
          </div>
        </section>

        <section style={styles.tableCard}>
          <div style={styles.tableHeader}>
            <div>
              <strong>MY DRAFT BOARD</strong>
              <div style={styles.tableSub}>
                ↑/↓ moves one spot. Use Move to # for a large jump. Player name
                opens projections and previous NHL season.
              </div>
            </div>
            <span style={styles.g365}>G365 BASELINE</span>
          </div>

          <div className="my-rank-table-wrap">
            <table className="my-rank-table" style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.centerHead}>MY RK</th>
                  <th style={styles.centerHead}>G365</th>
                  <th className="my-rank-posrank" style={styles.centerHead}>
                    POS RK
                  </th>
                  <th style={styles.playerHead}>PLAYER</th>
                  <th className="my-rank-team" style={styles.centerHead}>
                    TEAM
                  </th>
                  <th style={styles.centerHead}>POS</th>
                  <th style={styles.numberHead}>FP</th>
                  <th className="my-rank-fppg" style={styles.numberHead}>
                    FPPG
                  </th>
                  <th className="my-rank-gp" style={styles.numberHead}>
                    GP
                  </th>
                  <th style={styles.centerHead}>MOVE</th>
                </tr>
              </thead>
              <tbody>
                {shownPlayers.map((player) => {
                  const myRank =
                    myRankById.get(player.nhl_player_id) ?? player.overall_rank;
                  const maxRank = myRankings.length || rankings.length;

                  return (
                    <tr
                      key={player.nhl_player_id}
                      className="my-rank-row"
                      style={styles.row}
                    >
                      <td style={styles.myRank}>{myRank}</td>
                      <td style={styles.g365Rank}>#{player.overall_rank}</td>
                      <td className="my-rank-posrank" style={styles.centerCell}>
                        {positionRank(player, mode)}
                      </td>
                      <td className="my-rank-player" style={styles.playerCell}>
                        <div className="my-rank-player-wrap">
                          {player.headshot_url ? (
                            <img
                              className="my-rank-headshot"
                              src={player.headshot_url}
                              alt=""
                              loading="lazy"
                            />
                          ) : (
                            <span
                              className="my-rank-headshot my-rank-headshot-fallback"
                              aria-hidden="true"
                            >
                              NHL
                            </span>
                          )}
                          <button
                            type="button"
                            className="my-rank-name"
                            onClick={() => void openDetail(player.nhl_player_id)}
                            style={styles.playerButton}
                          >
                            {player.display_name}
                          </button>
                        </div>
                      </td>
                      <td className="my-rank-team" style={styles.centerCell}>
                        {player.team_abbreviation ?? "FA"}
                      </td>
                      <td style={styles.centerCell}>{pos(player)}</td>
                      <td style={styles.fpCell}>
                        {player.projected_fantasy_points.toFixed(2)}
                      </td>
                      <td className="my-rank-fppg" style={styles.numberCell}>
                        {player.projected_fantasy_points_per_game.toFixed(2)}
                      </td>
                      <td className="my-rank-gp" style={styles.numberCell}>
                        {player.projected_games_played.toFixed(1)}
                      </td>
                      <td style={styles.moveCell}>
                        <div style={styles.moveTop}>
                          <button
                            type="button"
                            title="Move up"
                            disabled={working || myRank <= 1}
                            onClick={() =>
                              void movePlayer(player.nhl_player_id, myRank - 1)
                            }
                            style={styles.arrowButton}
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            title="Move down"
                            disabled={working || myRank >= maxRank}
                            onClick={() =>
                              void movePlayer(player.nhl_player_id, myRank + 1)
                            }
                            style={styles.arrowButton}
                          >
                            ↓
                          </button>
                        </div>
                        <div style={styles.moveTo}>
                          <input
                            inputMode="numeric"
                            value={moveValues[player.nhl_player_id] ?? ""}
                            onChange={(e) =>
                              setMoveValues((current) => ({
                                ...current,
                                [player.nhl_player_id]: e.target.value.replace(
                                  /\D/g,
                                  ""
                                ),
                              }))
                            }
                            placeholder="#"
                            style={styles.rankInput}
                          />
                          <button
                            type="button"
                            disabled={
                              working ||
                              !Number(moveValues[player.nhl_player_id] ?? 0)
                            }
                            onClick={() =>
                              void movePlayer(
                                player.nhl_player_id,
                                Number(moveValues[player.nhl_player_id])
                              )
                            }
                            style={styles.goButton}
                          >
                            GO
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {detail ? (
          <div
            style={styles.backdrop}
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setDetailId(null);
            }}
          >
            <section style={styles.modal} role="dialog" aria-modal="true">
              <div style={styles.modalHeader}>
                <div>
                  <div style={styles.eyebrow}>G365 DRAFT PROFILE</div>
                  <h2 style={styles.modalTitle}>{detail.display_name}</h2>
                  <div style={styles.modalMeta}>
                    {pos(detail)} • {detail.team_abbreviation ?? "NHL FA"} • MY
                    RK #{myRankById.get(detail.nhl_player_id) ?? detail.overall_rank} •
                    G365 #{detail.overall_rank}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setDetailId(null)}
                  style={styles.close}
                >
                  ×
                </button>
              </div>

              <div style={styles.modalBody}>
                <StatSection
                  title={`${league.season}-${String(league.season + 1).slice(-2)} G365 PROJECTION`}
                  subtitle="League-specific fantasy scoring"
                  stats={
                    pos(detail) === "G"
                      ? [
                          ["FP", stat(detail.projected_fantasy_points, 2)],
                          ["FPPG", stat(detail.projected_fantasy_points_per_game, 2)],
                          ["GP", stat(detail.projected_games_played, 1)],
                          ["Starts", stat(detail.projected_goalie_starts, 1)],
                          ["W", stat(detail.projected_goalie_wins, 1)],
                          ["Saves", stat(detail.projected_saves, 1)],
                          ["SA", stat(detail.projected_shots_against, 1)],
                          ["GA", stat(detail.projected_goals_against, 1)],
                          ["SO", stat(detail.projected_shutouts, 1)],
                          ["SV%", stat(detail.projected_save_percentage, 3)],
                          ["GAA", stat(detail.projected_goals_against_average, 2)],
                        ]
                      : [
                          ["FP", stat(detail.projected_fantasy_points, 2)],
                          ["FPPG", stat(detail.projected_fantasy_points_per_game, 2)],
                          ["GP", stat(detail.projected_games_played, 1)],
                          ["G", stat(detail.projected_goals, 1)],
                          ["A", stat(detail.projected_assists, 1)],
                          ["PTS", stat(detail.projected_points, 1)],
                          ["PPP", stat(detail.projected_power_play_points, 1)],
                          ["SHP", stat(detail.projected_short_handed_points, 1)],
                          ["SOG", stat(detail.projected_shots_on_goal, 1)],
                          ["HIT", stat(detail.projected_hits, 1)],
                          ["BLK", stat(detail.projected_blocked_shots, 1)],
                        ]
                  }
                />

                <section style={styles.statSection}>
                  <div style={styles.statHead}>
                    <strong>
                      {league.season - 1}-{String(league.season).slice(-2)} NHL
                      ACTUAL STATS
                    </strong>
                    <span>Previous regular season</span>
                  </div>

                  {detailLoading ? (
                    <div style={styles.notice}>Loading last season...</div>
                  ) : detailError ? (
                    <div style={styles.error}>{detailError}</div>
                  ) : !lastSeason ||
                    (recordNumber(lastSeason, "games_played", "gp", "games") ??
                      0) <= 0 ? (
                    <div style={styles.rookie}>
                      <strong>NONE — ROOKIE</strong>
                      <span>No previous NHL regular-season stats.</span>
                    </div>
                  ) : (
                    <StatGrid
                      stats={
                        pos(detail) === "G"
                          ? [
                              ["FP", stat(recordNumber(lastSeason, "fantasy_points", "total_fantasy_points"), 2)],
                              ["GP", stat(recordNumber(lastSeason, "games_played", "gp", "games"))],
                              ["Starts", stat(recordNumber(lastSeason, "goalie_starts", "starts"))],
                              ["W", stat(recordNumber(lastSeason, "goalie_wins", "wins"))],
                              ["L", stat(recordNumber(lastSeason, "goalie_losses", "losses"))],
                              ["OTL", stat(recordNumber(lastSeason, "goalie_ot_losses", "goalie_overtime_losses", "overtime_losses"))],
                              ["Saves", stat(recordNumber(lastSeason, "saves", "goalie_saves"))],
                              ["SA", stat(recordNumber(lastSeason, "shots_against", "goalie_shots_against"))],
                              ["GA", stat(recordNumber(lastSeason, "goals_against", "goalie_goals_against"))],
                              ["SO", stat(recordNumber(lastSeason, "shutouts"))],
                              ["SV%", stat(recordNumber(lastSeason, "save_percentage"), 3)],
                              ["GAA", stat(recordNumber(lastSeason, "goals_against_average"), 2)],
                            ]
                          : [
                              ["FP", stat(recordNumber(lastSeason, "fantasy_points", "total_fantasy_points"), 2)],
                              ["GP", stat(recordNumber(lastSeason, "games_played", "gp", "games"))],
                              ["G", stat(recordNumber(lastSeason, "goals"))],
                              ["A", stat(recordNumber(lastSeason, "assists"))],
                              ["PTS", stat(recordNumber(lastSeason, "points", "total_points"))],
                              ["+/-", stat(recordNumber(lastSeason, "plus_minus"))],
                              ["PIM", stat(recordNumber(lastSeason, "penalty_minutes"))],
                              ["PPP", stat(recordNumber(lastSeason, "power_play_points"))],
                              ["SHP", stat(recordNumber(lastSeason, "short_handed_points"))],
                              ["SOG", stat(recordNumber(lastSeason, "shots_on_goal"))],
                              ["HIT", stat(recordNumber(lastSeason, "hits"))],
                              ["BLK", stat(recordNumber(lastSeason, "blocked_shots"))],
                            ]
                      }
                    />
                  )}
                </section>
              </div>
            </section>
          </div>
        ) : null}
      </div>
    </main>
  );
}

function StatSection({
  title,
  subtitle,
  stats,
}: {
  title: string;
  subtitle: string;
  stats: string[][];
}) {
  return (
    <section style={styles.statSection}>
      <div style={styles.statHead}>
        <strong>{title}</strong>
        <span>{subtitle}</span>
      </div>
      <StatGrid stats={stats} />
    </section>
  );
}

function StatGrid({ stats }: { stats: string[][] }) {
  return (
    <div style={styles.statGrid}>
      {stats.map(([label, value]) => (
        <div key={label} style={styles.statTile}>
          <span style={styles.statLabel}>{label}</span>
          <strong style={styles.statValue}>{value}</strong>
        </div>
      ))}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    background:
      "radial-gradient(circle at top,rgba(150,20,20,.16),transparent 30%),#070708",
    color: "#f5f5f5",
    padding: "18px 10px 40px",
  },
  container: { width: "100%", maxWidth: 1450, margin: "0 auto" },
  card: {
    padding: 24,
    border: "1px solid #303034",
    borderRadius: 12,
    background: "#111113",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
    padding: 16,
    border: "1px solid #343438",
    borderRadius: 14,
    background:
      "linear-gradient(135deg,#151518 0%,#0c0c0e 62%,rgba(120,15,15,.28) 100%)",
    marginBottom: 10,
  },
  eyebrow: {
    color: "#ff6a00",
    fontSize: 9,
    fontWeight: 950,
    letterSpacing: 1,
  },
  title: {
    margin: "4px 0 0",
    fontSize: "clamp(25px,4vw,38px)",
    lineHeight: 1,
    fontWeight: 950,
  },
  subtitle: { marginTop: 8, color: "#c5c5ca", fontSize: 11, fontWeight: 800 },
  description: {
    marginTop: 5,
    color: "#85858c",
    fontSize: 10,
    lineHeight: 1.45,
  },
  headerActions: { display: "flex", gap: 8, flexWrap: "wrap" },
  badge: {
    padding: "8px 10px",
    borderRadius: 8,
    border: "1px solid #8b2d16",
    background: "#28100b",
    color: "#ff8a3d",
    fontSize: 9,
    fontWeight: 950,
  },
  resetButton: {
    padding: "8px 10px",
    borderRadius: 8,
    border: "1px solid #49494f",
    background: "#1b1b1e",
    color: "#fff",
    fontSize: 9,
    fontWeight: 900,
    cursor: "pointer",
  },
  error: {
    marginBottom: 10,
    padding: 10,
    borderRadius: 8,
    border: "1px solid #7f1d1d",
    background: "#2a0d0d",
    color: "#fecaca",
    fontSize: 11,
  },
  liveNotice: {
    marginBottom: 10,
    padding: 10,
    border: "1px solid #8b2d16",
    borderRadius: 9,
    background: "#24100b",
    color: "#e4c7ba",
    fontSize: 10,
    fontWeight: 800,
  },
  summary: {
    display: "grid",
    gridTemplateColumns: "repeat(3,minmax(0,1fr))",
    gap: 7,
    marginBottom: 9,
  },
  summaryBox: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    padding: "9px 11px",
    border: "1px solid #29292d",
    borderRadius: 9,
    background: "#111113",
    color: "#777980",
    fontSize: 8,
    fontWeight: 950,
  },
  controls: {
    marginBottom: 9,
    padding: 9,
    border: "1px solid #2d2d31",
    borderRadius: 10,
    background: "#101012",
  },
  controlGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(200px,1fr) minmax(150px,220px)",
    gap: 7,
  },
  input: {
    width: "100%",
    minHeight: 38,
    padding: "7px 9px",
    border: "1px solid #39393e",
    borderRadius: 7,
    outline: "none",
    background: "#08080a",
    color: "#fff",
    fontSize: 11,
  },
  positionBar: {
    display: "flex",
    gap: 5,
    marginTop: 7,
    overflowX: "auto",
  },
  positionButton: {
    minWidth: 42,
    padding: "6px 9px",
    border: "1px solid #34343a",
    borderRadius: 7,
    background: "#171719",
    color: "#9da0a7",
    fontSize: 9,
    fontWeight: 950,
    cursor: "pointer",
  },
  positionButtonActive: {
    border: "1px solid #b23b16",
    background: "#351108",
    color: "#ff8a3d",
  },
  tableCard: {
    overflow: "hidden",
    border: "1px solid #2e2e33",
    borderRadius: 11,
    background: "#0d0d0f",
  },
  tableHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    padding: "10px 11px",
    borderBottom: "1px solid #2e2e33",
    background: "#141416",
    fontSize: 10,
  },
  tableSub: { marginTop: 3, color: "#777980", fontSize: 8 },
  g365: {
    color: "#ff6a00",
    fontSize: 8,
    fontWeight: 950,
    whiteSpace: "nowrap",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    tableLayout: "fixed",
    fontSize: 10,
  },
  centerHead: {
    width: 64,
    padding: "6px 4px",
    borderBottom: "1px solid #29292d",
    color: "#888b92",
    textAlign: "center",
    fontSize: 8,
  },
  playerHead: {
    width: "32%",
    padding: "6px 6px",
    borderBottom: "1px solid #29292d",
    color: "#888b92",
    textAlign: "left",
    fontSize: 8,
  },
  numberHead: {
    width: 72,
    padding: "6px 4px",
    borderBottom: "1px solid #29292d",
    color: "#888b92",
    textAlign: "right",
    fontSize: 8,
  },
  row: { borderBottom: "1px solid #202024" },
  myRank: {
    width: 58,
    padding: "6px 4px",
    textAlign: "center",
    color: "#fff",
    fontSize: 13,
    fontWeight: 950,
  },
  g365Rank: {
    width: 58,
    padding: "6px 4px",
    textAlign: "center",
    color: "#ff6a00",
    fontWeight: 900,
  },
  centerCell: { padding: "6px 4px", textAlign: "center", color: "#c7c9cf", overflow: "hidden", textOverflow: "ellipsis" },
  playerCell: { padding: "6px", width: "32%", minWidth: 0, overflow: "hidden" },
  playerButton: {
    padding: 0,
    border: 0,
    background: "transparent",
    color: "#fff",
    textAlign: "left",
    fontSize: 10,
    fontWeight: 950,
    cursor: "pointer",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    maxWidth: "100%",
  },
  fpCell: {
    width: 72,
    padding: "6px 4px",
    textAlign: "right",
    color: "#ff8a3d",
    fontWeight: 950,
  },
  numberCell: { width: 68, padding: "6px 4px", textAlign: "right", color: "#d0d1d5" },
  moveCell: { width: 84, padding: "4px 3px" },
  moveTop: { display: "flex", gap: 4, justifyContent: "center" },
  arrowButton: {
    width: 30,
    height: 25,
    border: "1px solid #4a4a50",
    borderRadius: 6,
    background: "#1a1a1d",
    color: "#fff",
    fontSize: 16,
    fontWeight: 950,
    cursor: "pointer",
  },
  moveTo: {
    display: "flex",
    justifyContent: "center",
    gap: 3,
    marginTop: 3,
  },
  rankInput: {
    width: 34,
    height: 23,
    border: "1px solid #3b3b40",
    borderRadius: 5,
    background: "#09090b",
    color: "#fff",
    textAlign: "center",
    fontSize: 9,
  },
  goButton: {
    height: 23,
    padding: "0 5px",
    border: "1px solid #9f2a16",
    borderRadius: 5,
    background: "#3a120a",
    color: "#ff8a3d",
    fontSize: 8,
    fontWeight: 950,
    cursor: "pointer",
  },
  backdrop: {
    position: "fixed",
    inset: 0,
    zIndex: 1000,
    display: "grid",
    placeItems: "center",
    padding: 12,
    background: "rgba(0,0,0,.8)",
    overflowY: "auto",
  },
  modal: {
    width: "min(820px,100%)",
    maxHeight: "calc(100vh - 24px)",
    overflowY: "auto",
    border: "1px solid rgba(255,96,25,.55)",
    borderRadius: 14,
    background: "#0b0b0d",
  },
  modalHeader: {
    position: "sticky",
    top: 0,
    zIndex: 2,
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    padding: 14,
    borderBottom: "1px solid #29292d",
    background: "linear-gradient(135deg,#1b0c08,#101012 65%)",
  },
  modalTitle: { margin: "2px 0 0", fontSize: 25, lineHeight: 1 },
  modalMeta: { marginTop: 5, color: "#999ca4", fontSize: 10 },
  close: {
    width: 38,
    height: 38,
    border: "1px solid #3a3a40",
    borderRadius: 8,
    background: "#18181b",
    color: "#fff",
    fontSize: 24,
    cursor: "pointer",
  },
  modalBody: { display: "grid", gap: 11, padding: 11 },
  statSection: {
    overflow: "hidden",
    border: "1px solid #29292d",
    borderRadius: 10,
    background: "#101012",
  },
  statHead: {
    display: "flex",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 6,
    padding: "10px 11px",
    borderBottom: "1px solid #34343a",
    background: "#171719",
    fontSize: 9,
  },
  statGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(100px,1fr))",
    gap: 1,
    background: "#34343a",
  },
  statTile: {
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    gap: 4,
    minHeight: 66,
    padding: 8,
    background: "#101012",
    textAlign: "center",
  },
  statLabel: {
    color: "#8f939c",
    fontSize: 9,
    fontWeight: 950,
    textTransform: "uppercase",
  },
  statValue: {
    color: "#fff",
    fontSize: 18,
    fontWeight: 950,
    fontVariantNumeric: "tabular-nums",
  },
  notice: { padding: 18, color: "#aaaeb6", textAlign: "center" },
  rookie: {
    display: "flex",
    flexDirection: "column",
    gap: 5,
    padding: 20,
    color: "#c9cbd0",
    textAlign: "center",
    fontSize: 10,
  },
};