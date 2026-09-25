"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

type Props = { leagueId: string };

type Settings = {
  season: number;
  league_format: string | null;
  position_mode: string | null;
  waiver_mode: string | null;
  faab_budget: number | null;
};

type FantasyTeam = {
  id: number;
  team_name: string;
  owner_id: string | null;
};

type NhlTeam = {
  id: number;
  display_name: string | null;
  name: string | null;
  abbreviation: string | null;
};

type Player = {
  id: number;
  display_name: string;
  short_name: string | null;
  team_id: number | null;
  position: string | null;
  position_group: string | null;
  jersey_number: string | null;
  status: string | null;
  injury_status: string | null;
  injury_detail: string | null;
  injury_return_date: string | null;
  injury_source: string | null;
  headshot_url: string | null;
};

type RosterRow = {
  id: number;
  fantasy_team_id: number;
  nhl_player_id: number;
  roster_status: string;
};

type SeasonTotal = {
  nhl_player_id: number;
  games_played: number | string | null;
  fantasy_points: number | string | null;
  fantasy_points_per_game: number | string | null;
  goals: number | string | null;
  assists: number | string | null;
  points: number | string | null;
  shots_on_goal: number | string | null;
  hits: number | string | null;
  blocked_shots: number | string | null;
  power_play_points: number | string | null;
  short_handed_points: number | string | null;
  goalie_starts: number | string | null;
  goalie_wins: number | string | null;
  saves: number | string | null;
  shots_against: number | string | null;
  goals_against: number | string | null;
  shutouts: number | string | null;
  save_percentage: number | string | null;
  goals_against_average: number | string | null;
};

type PreseasonRanking = {
  overall_rank: number | string | null;
  nhl_player_id: number | string;
  projected_fantasy_points: number | string | null;
  projected_fantasy_points_per_game: number | string | null;
};

type PlayerWaiverState = {
  nhl_player_id: number;
  status: string;
  clears_at: string | null;
};

type WaiverClaim = {
  id: number;
  fantasy_team_id: number;
  nhl_player_id: number;
  drop_nhl_player_id: number | null;
  claim_priority: number;
  faab_bid: number | null;
  status: string;
  processed_at: string | null;
  failure_reason: string | null;
  created_at: string;
};

type WaiverTeamState = {
  fantasy_team_id: number;
  waiver_priority: number;
  faab_spent: number;
};

type Transaction = {
  id: number;
  fantasy_team_id: number;
  transaction_type: string;
  nhl_player_id: number;
  related_nhl_player_id: number | null;
  notes: string | null;
  created_at: string;
};

type PlayerView = Player & {
  teamName: string;
  teamAbbr: string;
  waiverStatus: "available" | "waivers" | "processing";
  clearsAt: string | null;
  gp: number;
  fp: number;
  fppg: number;
  goals: number;
  assists: number;
  points: number;
  sog: number;
  hits: number;
  blocks: number;
  ppp: number;
  shp: number;
  goalieStarts: number;
  goalieWins: number;
  saves: number;
  shotsAgainst: number;
  goalsAgainst: number;
  shutouts: number;
  savePct: number | null;
  gaa: number | null;
  preseasonRank: number | null;
  projectedFp: number;
  projectedFppg: number;
};

type SortKey =
  | "fp" | "fppg" | "gp" | "goals" | "assists" | "points"
  | "sog" | "hits" | "blocks" | "ppp" | "shp"
  | "goalieStarts" | "goalieWins" | "saves" | "shotsAgainst"
  | "goalsAgainst" | "shutouts" | "savePct" | "gaa";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const num = (value: unknown) => {
  const result = Number(value ?? 0);
  return Number.isFinite(result) ? result : 0;
};

const nullableNum = (value: unknown) => {
  if (value == null || value === "") return null;
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
};

const title = (value: string | null | undefined) =>
  (value ?? "—").replaceAll("_", " ").replace(/\b\w/g, c => c.toUpperCase());

const formatDate = (value: string | null | undefined) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString([], {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
};

const seasonLabel = (season: number) => `${season}-${String(season + 1).slice(-2)}`;

const fmt = (value: number | null, decimals = 0) =>
  value == null ? "—" : value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map(x => x[0]).join("").toUpperCase();

const injuryStatusLabel = (value: string | null | undefined) => {
  const status = String(value ?? "").trim().toLowerCase();
  if (!status) return null;
  if (status === "injured_reserve" || status === "injury_reserve") return "IR";
  if (status === "out") return "O";
  if (status === "day_to_day") return "DTD";
  if (status === "suspension" || status === "suspended") return "SUS";
  return status.slice(0, 3).toUpperCase();
};

const injuryReturnLabel = (value: string | null | undefined) => {
  if (!value) return null;
  const parsed = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(parsed);
};

function InjuryBadge({ player }: { player: Player }) {
  const [open, setOpen] = useState(false);
  const label = injuryStatusLabel(player.injury_status);
  if (!label) return null;

  const returnLabel = injuryReturnLabel(player.injury_return_date);

  return (
    <span className={`g365-waivers-injury-wrap${open ? " is-open" : ""}`}>
      <button
        type="button"
        className="g365-waivers-injury-badge"
        aria-label={`View ${player.display_name} injury information`}
        aria-expanded={open}
        onClick={event => {
          event.stopPropagation();
          setOpen(value => !value);
        }}
      >
        {label}
      </button>
      {open ? (
        <span className="g365-waivers-injury-popover" role="status">
          <strong>{title(player.injury_status)}</strong>
          {player.injury_detail ? <span>{player.injury_detail}</span> : null}
          {returnLabel ? <span>Expected return: {returnLabel}</span> : null}
          {player.injury_source ? <small>Source: {player.injury_source}</small> : null}
        </span>
      ) : null}
    </span>
  );
}

const normalizePosition = (player: Player, mode: string) => {
  const pos = String(player.position ?? player.position_group ?? "").toUpperCase();
  if (mode === "fdg") {
    if (pos === "G") return "G";
    if (pos === "D") return "D";
    if (["C", "LW", "RW", "F"].includes(pos)) return "F";
  }
  return pos || "—";
};

const sortValue = (p: PlayerView, key: SortKey) => {
  const value = p[key];
  return typeof value === "number" ? value : -1;
};

export default function NhlTraditionalWaivers({ leagueId }: Props) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [teams, setTeams] = useState<FantasyTeam[]>([]);
  const [nhlTeams, setNhlTeams] = useState<NhlTeam[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [rosters, setRosters] = useState<RosterRow[]>([]);
  const [totals, setTotals] = useState<SeasonTotal[]>([]);
  const [preseasonRankings, setPreseasonRankings] = useState<PreseasonRanking[]>([]);
  const [playerWaivers, setPlayerWaivers] = useState<PlayerWaiverState[]>([]);
  const [claims, setClaims] = useState<WaiverClaim[]>([]);
  const [waiverOrder, setWaiverOrder] = useState<WaiverTeamState[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  const [tab, setTab] = useState<"PLAYERS" | "CLAIMS" | "ORDER" | "HISTORY">("PLAYERS");
  const [search, setSearch] = useState("");
  const [teamFilter, setTeamFilter] = useState("ALL");
  const [positionFilter, setPositionFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "AVAILABLE" | "WAIVERS">("ALL");
  const [sortKey, setSortKey] = useState<SortKey>("fp");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const [selectedPlayer, setSelectedPlayer] = useState<PlayerView | null>(null);
  const [claimPlayer, setClaimPlayer] = useState<PlayerView | null>(null);
  const [dropPlayerId, setDropPlayerId] = useState<number | null>(null);
  const [faabBid, setFaabBid] = useState("");
  const [actionId, setActionId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      const currentUserId = authData.user?.id ?? null;
      setUserId(currentUserId);

      const { data: settingsData, error: settingsError } = await supabase
        .from("nhl_traditional_settings")
        .select("season, league_format, position_mode, waiver_mode, faab_budget")
        .eq("league_id", leagueId)
        .single();

      if (settingsError) throw settingsError;

      const normalized: Settings = {
        season: num(settingsData.season),
        league_format: settingsData.league_format ?? "redraft",
        position_mode: settingsData.position_mode ?? "detailed",
        waiver_mode: settingsData.waiver_mode ?? "rolling",
        faab_budget: settingsData.faab_budget == null ? null : num(settingsData.faab_budget),
      };
      setSettings(normalized);

      const [
        fantasyTeamsResult,
        nhlTeamsResult,
        playersResult,
        rostersResult,
        totalsResult,
        rankingsResult,
        playerWaiversResult,
        claimsResult,
        waiverOrderResult,
        transactionsResult,
      ] = await Promise.all([
        supabase.from("fantasy_teams")
          .select("id, team_name, owner_id")
          .eq("league_id", leagueId).eq("active", true).order("team_name"),

        supabase.from("nhl_teams")
          .select("id, display_name, name, abbreviation")
          .eq("active", true).order("name"),

        (async () => {
          const all: Player[] = [];
          const pageSize = 1000;
          for (let from = 0; ; from += pageSize) {
            const { data, error } = await supabase.from("nhl_players")
              .select("id, display_name, short_name, team_id, position, position_group, jersey_number, status, injury_status, injury_detail, injury_return_date, injury_source, headshot_url")
              .eq("active", true)
              .order("display_name")
              .range(from, from + pageSize - 1);
            if (error) return { data: null as Player[] | null, error };
            const page = (data ?? []) as Player[];
            all.push(...page);
            if (page.length < pageSize) break;
          }
          return { data: all, error: null };
        })(),

        supabase.from("nhl_traditional_rosters")
          .select("id, fantasy_team_id, nhl_player_id, roster_status")
          .eq("league_id", leagueId).eq("season", normalized.season),

        supabase.rpc("get_nhl_traditional_player_season_totals", {
          p_league_id: leagueId,
          p_season: normalized.season,
          p_season_type: "regular",
        }),

        supabase.rpc("get_nhl_traditional_draft_rankings", {
          p_league_id: leagueId,
          p_season: normalized.season,
        }),

        supabase.from("nhl_traditional_player_waiver_state")
          .select("nhl_player_id, status, clears_at")
          .eq("league_id", leagueId).eq("season", normalized.season),

        supabase.from("nhl_traditional_waiver_claims")
          .select("id, fantasy_team_id, nhl_player_id, drop_nhl_player_id, claim_priority, faab_bid, status, processed_at, failure_reason, created_at")
          .eq("league_id", leagueId).eq("season", normalized.season)
          .order("created_at", { ascending: false }),

        supabase.from("nhl_traditional_waiver_team_state")
          .select("fantasy_team_id, waiver_priority, faab_spent")
          .eq("league_id", leagueId).eq("season", normalized.season)
          .order("waiver_priority"),

        supabase.from("nhl_traditional_transactions")
          .select("id, fantasy_team_id, transaction_type, nhl_player_id, related_nhl_player_id, notes, created_at")
          .eq("league_id", leagueId).eq("season", normalized.season)
          .in("transaction_type", ["waiver_add", "free_agent_add", "drop"])
          .order("created_at", { ascending: false }).limit(100),
      ]);

      const results = [
        fantasyTeamsResult, nhlTeamsResult, playersResult, rostersResult,
        totalsResult, rankingsResult, playerWaiversResult, claimsResult, waiverOrderResult,
        transactionsResult,
      ];
      const failed = results.find(result => result.error);
      if (failed?.error) throw failed.error;

      setTeams((fantasyTeamsResult.data ?? []).map(row => ({
        id: num(row.id), team_name: row.team_name ?? "Unnamed Team", owner_id: row.owner_id ?? null,
      })));
      setNhlTeams((nhlTeamsResult.data ?? []) as NhlTeam[]);
      setPlayers(((playersResult.data ?? []) as Player[]).map(row => ({
        ...row,
        id: num(row.id),
        display_name: row.display_name ?? row.short_name ?? `Player ${row.id}`,
      })));
      setRosters((rostersResult.data ?? []).map(row => ({
        id: num(row.id), fantasy_team_id: num(row.fantasy_team_id),
        nhl_player_id: num(row.nhl_player_id), roster_status: row.roster_status ?? "bench",
      })));
      setTotals((totalsResult.data ?? []) as SeasonTotal[]);
      setPreseasonRankings((rankingsResult.data ?? []) as PreseasonRanking[]);
      setPlayerWaivers((playerWaiversResult.data ?? []).map(row => ({
        nhl_player_id: num(row.nhl_player_id), status: row.status ?? "available",
        clears_at: row.clears_at ?? null,
      })));
      setClaims((claimsResult.data ?? []).map(row => ({
        ...row,
        id: num(row.id), fantasy_team_id: num(row.fantasy_team_id),
        nhl_player_id: num(row.nhl_player_id),
        drop_nhl_player_id: row.drop_nhl_player_id == null ? null : num(row.drop_nhl_player_id),
        claim_priority: num(row.claim_priority),
        faab_bid: row.faab_bid == null ? null : num(row.faab_bid),
        status: row.status ?? "pending",
      })));
      setWaiverOrder((waiverOrderResult.data ?? []).map(row => ({
        fantasy_team_id: num(row.fantasy_team_id),
        waiver_priority: num(row.waiver_priority),
        faab_spent: num(row.faab_spent),
      })));
      setTransactions((transactionsResult.data ?? []).map(row => ({
        ...row, id: num(row.id), fantasy_team_id: num(row.fantasy_team_id),
        nhl_player_id: num(row.nhl_player_id),
        related_nhl_player_id: row.related_nhl_player_id == null ? null : num(row.related_nhl_player_id),
      })));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load NHL waivers.");
    } finally {
      setLoading(false);
    }
  }, [leagueId]);

  useEffect(() => { void load(); }, [load]);

  const myTeam = useMemo(
    () => teams.find(team => team.owner_id === userId) ?? null,
    [teams, userId]
  );

  const teamMap = useMemo(() => new Map(teams.map(t => [t.id, t])), [teams]);
  const nhlTeamMap = useMemo(() => new Map(nhlTeams.map(t => [t.id, t])), [nhlTeams]);
  const playerMap = useMemo(() => new Map(players.map(p => [p.id, p])), [players]);
  const rostered = useMemo(() => new Set(rosters.map(r => r.nhl_player_id)), [rosters]);
  const totalMap = useMemo(
    () => new Map(totals.map(t => [num(t.nhl_player_id), t])),
    [totals]
  );
  const playerWaiverMap = useMemo(
    () => new Map(playerWaivers.map(w => [w.nhl_player_id, w])),
    [playerWaivers]
  );

  const preseasonRankingMap = useMemo(
    () => new Map(
      preseasonRankings.map(row => [
        num(row.nhl_player_id),
        {
          rank: num(row.overall_rank),
          projectedFp: num(row.projected_fantasy_points),
          projectedFppg: num(row.projected_fantasy_points_per_game),
        },
      ])
    ),
    [preseasonRankings]
  );

  // Before regular-season stats exist, Add Players is ordered by the same
  // G365 league-specific projections/rankings used by the draft board.
  // Once games have been played, actual fantasy production becomes authoritative.
  const seasonHasStarted = useMemo(
    () => totals.some(total => num(total.games_played) > 0),
    [totals]
  );

  const myRoster = useMemo(() => {
    if (!myTeam) return [];
    return rosters
      .filter(r => r.fantasy_team_id === myTeam.id)
      .map(r => ({ roster: r, player: playerMap.get(r.nhl_player_id) }))
      .filter((x): x is { roster: RosterRow; player: Player } => Boolean(x.player))
      .sort((a, b) => a.player.display_name.localeCompare(b.player.display_name));
  }, [myTeam, rosters, playerMap]);

  const views = useMemo<PlayerView[]>(() => {
    const now = Date.now();
    return players.filter(p => !rostered.has(p.id)).map(player => {
      const total = totalMap.get(player.id);
      const ws = playerWaiverMap.get(player.id);
      const preseason = preseasonRankingMap.get(player.id);
      const clears = ws?.clears_at ? new Date(ws.clears_at).getTime() : null;
      const hasPending = claims.some(c => c.nhl_player_id === player.id && c.status === "pending");

      let waiverStatus: PlayerView["waiverStatus"] = "available";
      if (ws?.status === "waivers") {
        if (clears != null && clears <= now && hasPending) waiverStatus = "processing";
        else if (clears != null && clears <= now && !hasPending) waiverStatus = "available";
        else waiverStatus = "waivers";
      }

      const team = player.team_id == null ? null : nhlTeamMap.get(player.team_id);
      return {
        ...player,
        teamName: team?.display_name ?? team?.name ?? (player.team_id == null ? "NHL Free Agent" : "Unknown"),
        teamAbbr: team?.abbreviation ?? (player.team_id == null ? "FA" : "—"),
        waiverStatus,
        clearsAt: ws?.clears_at ?? null,
        gp: num(total?.games_played),
        fp: num(total?.fantasy_points),
        fppg: num(total?.fantasy_points_per_game),
        goals: num(total?.goals),
        assists: num(total?.assists),
        points: num(total?.points),
        sog: num(total?.shots_on_goal),
        hits: num(total?.hits),
        blocks: num(total?.blocked_shots),
        ppp: num(total?.power_play_points),
        shp: num(total?.short_handed_points),
        goalieStarts: num(total?.goalie_starts),
        goalieWins: num(total?.goalie_wins),
        saves: num(total?.saves),
        shotsAgainst: num(total?.shots_against),
        goalsAgainst: num(total?.goals_against),
        shutouts: num(total?.shutouts),
        savePct: nullableNum(total?.save_percentage),
        gaa: nullableNum(total?.goals_against_average),
        preseasonRank: preseason?.rank ?? null,
        projectedFp: preseason?.projectedFp ?? 0,
        projectedFppg: preseason?.projectedFppg ?? 0,
      };
    });
  }, [players, rostered, totalMap, playerWaiverMap, preseasonRankingMap, claims, nhlTeamMap]);

  const positionMode = String(settings?.position_mode ?? "detailed").toLowerCase() === "fdg" ? "fdg" : "detailed";
  const positions = positionMode === "fdg" ? ["ALL", "F", "D", "G"] : ["ALL", "C", "LW", "RW", "D", "G"];

  const filteredPlayers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...views]
      .filter(p => !q || p.display_name.toLowerCase().includes(q) || p.teamName.toLowerCase().includes(q) || p.teamAbbr.toLowerCase().includes(q))
      .filter(p => teamFilter === "ALL" || String(p.team_id ?? "") === teamFilter)
      .filter(p => positionFilter === "ALL" || normalizePosition(p, positionMode) === positionFilter)
      .filter(p => statusFilter === "ALL" ||
        (statusFilter === "AVAILABLE" && p.waiverStatus === "available") ||
        (statusFilter === "WAIVERS" && p.waiverStatus !== "available"))
      .sort((a, b) => {
        if (!seasonHasStarted && sortKey === "fp") {
          const aRank = a.preseasonRank ?? Number.MAX_SAFE_INTEGER;
          const bRank = b.preseasonRank ?? Number.MAX_SAFE_INTEGER;

          if (aRank !== bRank) return aRank - bRank;
          if (a.projectedFp !== b.projectedFp) return b.projectedFp - a.projectedFp;
          return a.display_name.localeCompare(b.display_name);
        }

        const av = sortValue(a, sortKey);
        const bv = sortValue(b, sortKey);
        if (av !== bv) return sortDirection === "asc" ? av - bv : bv - av;
        return b.fp - a.fp || a.display_name.localeCompare(b.display_name);
      });
  }, [
    views,
    search,
    teamFilter,
    positionFilter,
    statusFilter,
    sortKey,
    sortDirection,
    positionMode,
    seasonHasStarted,
  ]);

  const myClaims = useMemo(() => {
    if (!myTeam) return [];
    return claims.filter(c => c.fantasy_team_id === myTeam.id).sort((a, b) => {
      if (a.status === "pending" && b.status !== "pending") return -1;
      if (a.status !== "pending" && b.status === "pending") return 1;
      if (a.status === "pending" && b.status === "pending") return a.claim_priority - b.claim_priority;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [claims, myTeam]);

  const pendingClaims = useMemo(() => myClaims.filter(c => c.status === "pending"), [myClaims]);
  const myWaiverState = useMemo(
    () => myTeam ? waiverOrder.find(w => w.fantasy_team_id === myTeam.id) ?? null : null,
    [waiverOrder, myTeam]
  );
  const faabMode = String(settings?.waiver_mode ?? "").toLowerCase() === "faab";
  const faabBudget = num(settings?.faab_budget);
  const faabRemaining = Math.max(0, faabBudget - num(myWaiverState?.faab_spent));

  const changeSort = (key: SortKey) => {
    if (sortKey === key) setSortDirection(d => d === "desc" ? "asc" : "desc");
    else {
      setSortKey(key);
      setSortDirection(key === "gaa" ? "asc" : "desc");
    }
  };

  const addPlayer = async (player: PlayerView) => {
    if (!myTeam) return;
    setActionId(player.id);
    setError("");
    setMessage("");
    try {
      const { error: rpcError } = await supabase.rpc("add_nhl_traditional_free_agent", {
        p_league_id: leagueId,
        p_fantasy_team_id: myTeam.id,
        p_nhl_player_id: player.id,
      });
      if (rpcError) throw rpcError;
      setMessage(`${player.display_name} added to your roster.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to add free agent.");
    } finally {
      setActionId(null);
    }
  };

  const openClaim = (player: PlayerView) => {
    setClaimPlayer(player);
    setDropPlayerId(null);
    setFaabBid("");
    setError("");
    setMessage("");
  };

  const submitClaim = async () => {
    if (!claimPlayer || !myTeam) return;
    setSubmitting(true);
    setError("");
    try {
      const bid = faabMode ? Number(faabBid) : null;
      if (faabMode && (!Number.isFinite(bid) || bid == null || bid < 0 || bid > faabRemaining)) {
        throw new Error("Enter a valid FAAB bid within your remaining budget.");
      }
      const { error: rpcError } = await supabase.rpc("submit_nhl_traditional_waiver_claim", {
        p_league_id: leagueId,
        p_fantasy_team_id: myTeam.id,
        p_nhl_player_id: claimPlayer.id,
        p_drop_nhl_player_id: dropPlayerId,
        p_faab_bid: bid,
        p_claim_priority: pendingClaims.length + 1,
      });
      if (rpcError) throw rpcError;
      setMessage(`Waiver claim submitted for ${claimPlayer.display_name}.`);
      setClaimPlayer(null);
      setTab("CLAIMS");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to submit waiver claim.");
    } finally {
      setSubmitting(false);
    }
  };

  const cancelClaim = async (claimId: number) => {
    setActionId(claimId);
    setError("");
    try {
      const { error: rpcError } = await supabase.rpc("cancel_nhl_traditional_waiver_claim", { p_claim_id: claimId });
      if (rpcError) throw rpcError;
      setMessage("Waiver claim cancelled.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to cancel claim.");
    } finally {
      setActionId(null);
    }
  };

  const moveClaim = async (claimId: number, direction: -1 | 1) => {
    if (!myTeam) return;
    const ordered = pendingClaims.map(c => c.id);
    const index = ordered.indexOf(claimId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= ordered.length) return;
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    setActionId(claimId);
    try {
      const { error: rpcError } = await supabase.rpc("reorder_nhl_traditional_waiver_claims", {
        p_league_id: leagueId,
        p_fantasy_team_id: myTeam.id,
        p_claim_ids: ordered,
      });
      if (rpcError) throw rpcError;
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to reorder claims.");
    } finally {
      setActionId(null);
    }
  };

  if (loading) return <main className="g365-nhl-waivers-page" style={S.page}>
      <style>{`
        @media (max-width: 760px) {
          .g365-nhl-waivers-page {
            width: 100% !important;
            max-width: 100% !important;
            min-width: 0 !important;
            padding: 10px 8px 40px !important;
            overflow-x: hidden !important;
          }

          .g365-nhl-waivers-page *,
          .g365-nhl-waivers-page > * {
            min-width: 0;
            max-width: 100%;
          }

          .g365-nhl-waivers-mobile-redundant-nav {
            display: none !important;
          }

          .g365-nhl-waivers-page nav {
            width: 100%;
            max-width: 100%;
            overscroll-behavior-x: contain;
            -webkit-overflow-scrolling: touch;
          }

          .g365-nhl-waivers-page input,
          .g365-nhl-waivers-page select,
          .g365-nhl-waivers-page textarea {
            max-width: 100%;
          }
        }

        @media (max-width: 560px) {
          .g365-nhl-waivers-page {
            padding-inline: 6px !important;
          }
        }
      `}</style><div style={S.loading}>Loading NHL player pool...</div></main>;

  const skaterHeaders: Array<[string, SortKey]> = [
    ["FP", "fp"],
    ["FPPG", "fppg"],
    ["GP", "gp"],
    ["G", "goals"],
    ["A", "assists"],
    ["PTS", "points"],
    ["SOG", "sog"],
    ["HIT", "hits"],
    ["BLK", "blocks"],
    ["PPP", "ppp"],
    ["SHP", "shp"],
  ];

  const goalieHeaders: Array<[string, SortKey]> = [
    ["FP", "fp"],
    ["FPPG", "fppg"],
    ["GP", "gp"],
    ["GS", "goalieStarts"],
    ["W", "goalieWins"],
    ["SV", "saves"],
    ["SA", "shotsAgainst"],
    ["GA", "goalsAgainst"],
    ["SO", "shutouts"],
    ["SV%", "savePct"],
    ["GAA", "gaa"],
  ];

  const allHeaders: Array<[string, SortKey]> = [
    ["FP", "fp"],
    ["FPPG", "fppg"],
    ["GP", "gp"],
    ["G", "goals"],
    ["A", "assists"],
    ["PTS", "points"],
    ["SOG", "sog"],
    ["HIT", "hits"],
    ["BLK", "blocks"],
    ["PPP", "ppp"],
    ["SHP", "shp"],
    ["GS", "goalieStarts"],
    ["W", "goalieWins"],
    ["SV", "saves"],
    ["SA", "shotsAgainst"],
    ["GA", "goalsAgainst"],
    ["SO", "shutouts"],
    ["SV%", "savePct"],
    ["GAA", "gaa"],
  ];

  const showingAllPositions = positionFilter === "ALL";
  const showingGoalies = positionFilter === "G";
  const headers = showingAllPositions
    ? allHeaders
    : showingGoalies
      ? goalieHeaders
      : skaterHeaders;

  return (
    <main className="g365-nhl-waivers-page" style={S.page}>
      <style>{`
        .g365-waivers-desktop-player-identity {
          display: flex;
          align-items: center;
          gap: 4px;
          position: relative;
        }

        .g365-waivers-player-name-line {
          display: flex;
          align-items: center;
          gap: 5px;
          min-width: 0;
        }

        .g365-waivers-injury-wrap {
          position: relative;
          display: inline-flex;
          align-items: center;
          flex: 0 0 auto;
          z-index: 50;
          overflow: visible;
        }

        .g365-waivers-injury-wrap.is-open {
          z-index: 99999;
        }

        .g365-waivers-desktop-player-cell:has(.g365-waivers-injury-wrap.is-open) {
          z-index: 99998 !important;
          overflow: visible !important;
        }

        .g365-waivers-desktop-player-identity:has(.g365-waivers-injury-wrap.is-open) {
          z-index: 99999;
          overflow: visible;
        }

        .g365-waivers-injury-badge {
          width: 25px;
          height: 25px;
          min-width: 25px;
          padding: 0;
          border: 1px solid #9a3d26;
          border-radius: 50%;
          background: #2a120d;
          color: #ff7b31;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 8px;
          line-height: 1;
          font-weight: 1000;
          cursor: pointer;
        }

        .g365-waivers-injury-badge-static {
          cursor: default;
          flex: 0 0 25px;
        }

        .g365-waivers-injury-popover {
          position: absolute;
          top: calc(100% + 6px);
          left: 0;
          z-index: 100000;
          width: min(260px, calc(100vw - 36px));
          padding: 9px 10px;
          border: 1px solid #63321f;
          border-radius: 7px;
          background: #17110e;
          color: #fff;
          box-shadow: 0 12px 30px rgba(0,0,0,.5);
          display: grid;
          gap: 4px;
          white-space: normal;
          text-align: left;
          font-size: 9px;
          line-height: 1.35;
        }

        .g365-waivers-injury-popover strong { color: #ff7b31; font-size: 9px; }
        .g365-waivers-injury-popover small { color: #8f8f95; font-size: 8px; }

        .g365-waivers-modal-injury {
          margin-top: 8px;
          display: flex;
          align-items: flex-start;
          gap: 8px;
          color: #fff;
          font-size: 9px;
        }

        .g365-waivers-modal-injury > span:last-child { display: grid; gap: 2px; }
        .g365-waivers-modal-injury strong { color: #ff7b31; }
        .g365-waivers-modal-injury small { color: #9a9aa0; font-size: 8px; }

        .g365-waivers-mobile-player-list {
          display: none;
        }

        @media (max-width: 760px) {
          .g365-nhl-waivers-page {
            width: 100% !important;
            max-width: 100% !important;
            min-width: 0 !important;
            padding: 10px 8px 40px !important;
            overflow-x: hidden !important;
          }

          .g365-nhl-waivers-page *,
          .g365-nhl-waivers-page > * {
            min-width: 0;
            max-width: 100%;
          }

          .g365-nhl-waivers-mobile-redundant-nav {
            display: none !important;
          }

          .g365-waivers-desktop-category-bar,
          .g365-waivers-desktop-player-table {
            display: none !important;
          }

          .g365-waivers-mobile-player-list {
            display: grid !important;
            gap: 8px;
            padding: 10px;
          }

          .g365-waivers-mobile-sort {
            display: grid;
            grid-template-columns: minmax(0, 1fr) auto;
            gap: 8px;
            align-items: end;
            padding: 10px 12px 12px;
            border-top: 1px solid #1f1f22;
          }

          .g365-waivers-mobile-sort label {
            display: grid;
            gap: 5px;
          }

          .g365-waivers-mobile-sort select {
            width: 100%;
            min-height: 44px;
            border: 1px solid #343438;
            border-radius: 6px;
            background: #0d0d0f;
            color: #fff;
            padding: 0 10px;
            font-size: 16px;
          }

          .g365-waivers-mobile-sort button {
            min-width: 48px;
            min-height: 44px;
            border: 1px solid #493025;
            border-radius: 6px;
            background: #17110e;
            color: #ff7b31;
            font-size: 16px;
            font-weight: 1000;
          }

          .g365-waivers-mobile-player {
            width: 100%;
            border: 1px solid #29292d;
            border-radius: 9px;
            background: #111113;
            overflow: hidden;
          }

          .g365-waivers-mobile-player-main {
            display: grid;
            grid-template-columns: minmax(0, 1fr) auto auto;
            gap: 8px;
            align-items: center;
            padding: 9px;
          }

          .g365-waivers-mobile-player-name {
            width: 100%;
            min-height: 48px;
            border: 0;
            background: transparent;
            color: #fff;
            display: flex;
            align-items: center;
            gap: 9px;
            padding: 0;
            text-align: left;
            cursor: pointer;
          }

          .g365-waivers-mobile-player-name strong {
            display: block;
            font-size: 13px;
            line-height: 1.2;
            overflow-wrap: anywhere;
          }

          .g365-waivers-mobile-player-name small {
            display: block;
            margin-top: 3px;
            color: #85858b;
            font-size: 10px;
            line-height: 1.25;
            overflow-wrap: anywhere;
          }

          .g365-waivers-mobile-player-meta {
            display: flex;
            flex-wrap: wrap;
            gap: 5px;
            padding: 0 9px 9px;
          }

          .g365-waivers-mobile-chip {
            border: 1px solid #303034;
            border-radius: 999px;
            background: #151517;
            color: #b6b6bb;
            padding: 4px 7px;
            font-size: 9px;
            font-weight: 900;
          }

          .g365-waivers-mobile-fp {
            color: #ff7b31;
            border-color: #66351f;
            background: #21140f;
          }

          .g365-waivers-mobile-action button {
            min-height: 44px !important;
            min-width: 66px;
            padding-inline: 10px !important;
            font-size: 9px !important;
          }

          .g365-nhl-waivers-page nav {
            width: 100%;
            max-width: 100%;
            overscroll-behavior-x: contain;
            -webkit-overflow-scrolling: touch;
          }

          .g365-nhl-waivers-page input,
          .g365-nhl-waivers-page select,
          .g365-nhl-waivers-page textarea {
            max-width: 100%;
          }
        }

        @media (max-width: 420px) {
          .g365-nhl-waivers-page {
            padding-inline: 6px !important;
          }

          .g365-waivers-mobile-player-main {
            grid-template-columns: minmax(0, 1fr) auto;
          }

          .g365-waivers-mobile-action {
            grid-column: 1 / -1;
          }

          .g365-waivers-mobile-action,
          .g365-waivers-mobile-action button {
            width: 100%;
          }
        }
      `}</style>
      <div style={S.shell}>
        <section style={S.hero}>
          <div>
            <div style={S.eyebrow}>GRIDIRON365 • NHL TRADITIONAL</div>
            <h1 style={S.title}>Add Players</h1>
            <div style={S.subtitle}>
              Waivers & Free Agents • {settings ? seasonLabel(settings.season) : "—"} • {title(settings?.league_format)} • {title(settings?.waiver_mode)}
            </div>
          </div>
          <div style={S.heroStats}>
            {!faabMode && <Stat label="MY PRIORITY" value={myWaiverState ? `#${myWaiverState.waiver_priority}` : "—"} />}
            {faabMode && <Stat label="FAAB LEFT" value={`$${faabRemaining.toFixed(0)}`} />}
            <Stat label="UNROSTERED" value={String(views.length)} />
            <Stat label="PENDING" value={String(pendingClaims.length)} />
          </div>
        </section>

        <Link className="g365-nhl-waivers-mobile-redundant-nav" href={`/league/${leagueId}/nhl`} style={S.back}>← LEAGUE HOME</Link>

        {error && <div style={S.error}><strong>WAIVERS ERROR</strong><span>{error}</span></div>}
        {message && <div style={S.success}>{message}</div>}
        {!myTeam && <div style={S.warning}>No active fantasy team is associated with your account in this league.</div>}

        <nav style={S.tabs}>
          {([
            ["PLAYERS", `Add Players (${views.length})`],
            ["CLAIMS", `My Claims (${pendingClaims.length})`],
            ["ORDER", "Waiver Order"],
            ["HISTORY", "Transactions"],
          ] as const).map(([value, label]) => (
            <button key={value} type="button" onClick={() => setTab(value)}
              style={{ ...S.tab, ...(tab === value ? S.activeTab : {}) }}>{label}</button>
          ))}
        </nav>

        {tab === "PLAYERS" && (
          <>
            <section style={S.panel}>
              <div style={S.panelHead}>
                <div>
                  <strong>ADD PLAYERS</strong>
                  <div style={S.panelSub}>
                    Search the unrostered NHL player pool. {seasonHasStarted
                      ? "Players default to actual fantasy production for the current season."
                      : "Before the season starts, players default to G365 projected fantasy rankings."} Skaters show skater categories; select G to show the complete goalie categories.
                  </div>
                </div>
                <div style={S.countBadge}>{filteredPlayers.length}</div>
              </div>

              <div style={S.filters}>
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search player or NHL team..." style={S.input} />
                <select value={teamFilter} onChange={e => setTeamFilter(e.target.value)} style={S.input}>
                  <option value="ALL">All NHL Teams</option>
                  {nhlTeams.map(team => (
                    <option key={team.id} value={String(team.id)}>
                      {team.display_name ?? team.name ?? team.abbreviation ?? `Team ${team.id}`}
                    </option>
                  ))}
                </select>
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as typeof statusFilter)} style={S.input}>
                  <option value="ALL">Available + Waivers</option>
                  <option value="AVAILABLE">Available Now</option>
                  <option value="WAIVERS">On Waivers</option>
                </select>
              </div>

              <div style={S.positionRow}>
                {positions.map(position => (
                  <button key={position} type="button" onClick={() => setPositionFilter(position)}
                    style={{ ...S.filterButton, ...(positionFilter === position ? S.filterActive : {}) }}>
                    {position}
                  </button>
                ))}
              </div>

              <div className="g365-waivers-desktop-category-bar" style={S.categoryBar}>
                <strong style={S.categoryTitle}>
                  {showingAllPositions ? "ALL STAT CATEGORIES" : showingGoalies ? "GOALIE STATS" : "SKATER STATS"}
                </strong>
                <div style={S.categoryList}>
                  {headers.map(([label]) => <span key={label} style={S.categoryChip}>{label}</span>)}
                </div>
              </div>

              <div className="g365-waivers-mobile-sort">
                <label>
                  <span style={S.categoryTitle}>SORT PLAYERS BY</span>
                  <select
                    value={sortKey}
                    onChange={e => {
                      const next = e.target.value as SortKey;
                      setSortKey(next);
                      setSortDirection(next === "gaa" ? "asc" : "desc");
                    }}
                  >
                    {headers.map(([label, key]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  aria-label={sortDirection === "desc" ? "Sort descending" : "Sort ascending"}
                  title={sortDirection === "desc" ? "Descending" : "Ascending"}
                  onClick={() => setSortDirection(d => d === "desc" ? "asc" : "desc")}
                >
                  {sortDirection === "desc" ? "↓" : "↑"}
                </button>
              </div>
            </section>

            <section style={S.panel}>
              <div className="g365-waivers-mobile-player-list">
                {filteredPlayers.map(player => (
                  <article key={player.id} className="g365-waivers-mobile-player">
                    <div className="g365-waivers-mobile-player-main">
                      <button
                        type="button"
                        className="g365-waivers-mobile-player-name"
                        onClick={() => setSelectedPlayer(player)}
                        aria-label={`View ${player.display_name} stats`}
                      >
                        <span style={S.avatar}>
                          {player.headshot_url
                            ? <img src={player.headshot_url} alt="" style={S.headshot} />
                            : initials(player.display_name)}
                        </span>
                        <span className="g365-waivers-mobile-player-copy">
                          <span className="g365-waivers-player-name-line">
                            <strong>{player.display_name}</strong>
                          </span>
                          <small>{normalizePosition(player, positionMode)} • {player.teamAbbr}</small>
                        </span>
                      </button>
                      <InjuryBadge player={player} />

                      <div className="g365-waivers-mobile-action">
                        {player.waiverStatus === "available" ? (
                          <button
                            type="button"
                            disabled={!myTeam || actionId === player.id}
                            onClick={() => void addPlayer(player)}
                            style={S.addButton}
                          >
                            {actionId === player.id ? "ADDING..." : "+ ADD"}
                          </button>
                        ) : player.waiverStatus === "waivers" ? (
                          <button
                            type="button"
                            disabled={!myTeam}
                            onClick={() => openClaim(player)}
                            style={S.claimButton}
                          >
                            + CLAIM
                          </button>
                        ) : (
                          <button type="button" disabled style={S.disabledButton}>WAIT</button>
                        )}
                      </div>
                    </div>

                    <div className="g365-waivers-mobile-player-meta">
                      <span className="g365-waivers-mobile-chip g365-waivers-mobile-fp">
                        {seasonHasStarted ? "FP" : "PROJ FP"} {fmt(seasonHasStarted ? player.fp : player.projectedFp, 1)}
                      </span>
                      <span className="g365-waivers-mobile-chip">
                        {seasonHasStarted ? "FPPG" : "PROJ/G"} {fmt(seasonHasStarted ? player.fppg : player.projectedFppg, 1)}
                      </span>
                      {seasonHasStarted ? (
                        <span className="g365-waivers-mobile-chip">GP {fmt(player.gp)}</span>
                      ) : null}
                      <span className="g365-waivers-mobile-chip">
                        {player.waiverStatus === "available"
                          ? "AVAILABLE"
                          : player.waiverStatus === "processing"
                            ? "PROCESSING"
                            : `WAIVERS • ${formatDate(player.clearsAt)}`}
                      </span>
                    </div>
                  </article>
                ))}
                {filteredPlayers.length === 0 && (
                  <div style={S.empty}>No unrostered players match these filters.</div>
                )}
              </div>

              <div className="g365-waivers-desktop-player-table" style={S.tableWrap}>
                <table style={{ ...S.table, minWidth: showingAllPositions ? 1240 : 940 }}>
                  <thead>
                    <tr>
                      <th style={S.actionHead}>ACTION</th>
                      <th style={S.leftHead}>PLAYER</th>
                      <th>POS</th><th>NHL</th><th>STATUS</th>
                      {headers.map(([label, key]) => (
                        <th key={key}>
                          <button type="button" onClick={() => changeSort(key)} style={S.sortButton}>
                            {label}{sortKey === key ? (sortDirection === "desc" ? " ▼" : " ▲") : ""}
                          </button>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPlayers.map(player => (
                      <tr key={player.id}>
                        <td style={S.actionCell}>
                          {player.waiverStatus === "available" ? (
                            <button type="button" disabled={!myTeam || actionId === player.id}
                              onClick={() => void addPlayer(player)} style={S.addButton}>
                              {actionId === player.id ? "ADDING..." : "+ ADD"}
                            </button>
                          ) : player.waiverStatus === "waivers" ? (
                            <button type="button" disabled={!myTeam} onClick={() => openClaim(player)} style={S.claimButton}>+ CLAIM</button>
                          ) : (
                            <button type="button" disabled style={S.disabledButton}>WAIT</button>
                          )}
                        </td>
                        <td className="g365-waivers-desktop-player-cell" style={S.playerCell}>
                          <div className="g365-waivers-desktop-player-identity">
                            <button type="button" onClick={() => setSelectedPlayer(player)} style={S.playerButton}>
                              <span style={S.avatar}>
                                {player.headshot_url ? <img src={player.headshot_url} alt="" style={S.headshot} /> : initials(player.display_name)}
                              </span>
                              <span>
                                <strong style={S.playerName}>{player.display_name}</strong>
                                <small style={S.playerSub}>{player.teamName}</small>
                              </span>
                            </button>
                            <InjuryBadge player={player} />
                          </div>
                        </td>
                        <td><strong style={S.orange}>{normalizePosition(player, positionMode)}</strong></td>
                        <td>{player.teamAbbr}</td>
                        <td>
                          {player.waiverStatus === "available" ? (
                            <span style={S.availableBadge}>AVAILABLE</span>
                          ) : player.waiverStatus === "processing" ? (
                            <span style={S.processingBadge}>PROCESSING</span>
                          ) : (
                            <span style={S.waiverBadge}>WAIVERS<br/><small>{formatDate(player.clearsAt)}</small></span>
                          )}
                        </td>
                        <td style={S.fp}>{fmt(seasonHasStarted ? player.fp : player.projectedFp, 1)}</td>
                        <td>{fmt(seasonHasStarted ? player.fppg : player.projectedFppg, 1)}</td>
                        <td>{seasonHasStarted ? fmt(player.gp) : "—"}</td>

                        {showingAllPositions ? (
                          normalizePosition(player, positionMode) === "G" ? (
                            <>
                              <td>—</td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td>
                              <td>{fmt(player.goalieStarts)}</td>
                              <td>{fmt(player.goalieWins)}</td>
                              <td>{fmt(player.saves)}</td>
                              <td>{fmt(player.shotsAgainst)}</td>
                              <td>{fmt(player.goalsAgainst)}</td>
                              <td>{fmt(player.shutouts)}</td>
                              <td>{fmt(player.savePct, 3)}</td>
                              <td>{fmt(player.gaa, 2)}</td>
                            </>
                          ) : (
                            <>
                              <td>{fmt(player.goals)}</td>
                              <td>{fmt(player.assists)}</td>
                              <td>{fmt(player.points)}</td>
                              <td>{fmt(player.sog)}</td>
                              <td>{fmt(player.hits)}</td>
                              <td>{fmt(player.blocks)}</td>
                              <td>{fmt(player.ppp)}</td>
                              <td>{fmt(player.shp)}</td>
                              <td>—</td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td>
                            </>
                          )
                        ) : showingGoalies ? (
                          <>
                            <td>{fmt(player.goalieStarts)}</td>
                            <td>{fmt(player.goalieWins)}</td>
                            <td>{fmt(player.saves)}</td>
                            <td>{fmt(player.shotsAgainst)}</td>
                            <td>{fmt(player.goalsAgainst)}</td>
                            <td>{fmt(player.shutouts)}</td>
                            <td>{fmt(player.savePct, 3)}</td>
                            <td>{fmt(player.gaa, 2)}</td>
                          </>
                        ) : (
                          <>
                            <td>{fmt(player.goals)}</td>
                            <td>{fmt(player.assists)}</td>
                            <td>{fmt(player.points)}</td>
                            <td>{fmt(player.sog)}</td>
                            <td>{fmt(player.hits)}</td>
                            <td>{fmt(player.blocks)}</td>
                            <td>{fmt(player.ppp)}</td>
                            <td>{fmt(player.shp)}</td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredPlayers.length === 0 && <div style={S.empty}>No unrostered players match these filters.</div>}
              </div>
            </section>
          </>
        )}

        {tab === "CLAIMS" && (
          <section style={S.panel}>
            <div style={S.panelHead}><strong>MY WAIVER CLAIMS</strong><div style={S.countBadge}>{myClaims.length}</div></div>
            {myClaims.length === 0 ? <div style={S.empty}>No waiver claims yet.</div> : (
              <div>
                {myClaims.map((claim, index) => {
                  const player = playerMap.get(claim.nhl_player_id);
                  const drop = claim.drop_nhl_player_id == null ? null : playerMap.get(claim.drop_nhl_player_id);
                  return (
                    <div key={claim.id} style={S.claimRow}>
                      <div style={S.claimPriority}>#{claim.claim_priority}</div>
                      <div>
                        <strong>{player?.display_name ?? `Player ${claim.nhl_player_id}`}</strong>
                        <div style={S.claimDetails}>
                          <span>{claim.status.toUpperCase()}</span>
                          {faabMode && <span>Bid ${num(claim.faab_bid).toFixed(0)}</span>}
                          {drop && <span>Drop: {drop.display_name}</span>}
                          <span>{formatDate(claim.created_at)}</span>
                        </div>
                        {claim.failure_reason && <div style={S.failure}>{claim.failure_reason}</div>}
                      </div>
                      {claim.status === "pending" && (
                        <div style={S.claimActions}>
                          <button disabled={index === 0 || actionId === claim.id} onClick={() => void moveClaim(claim.id, -1)} style={S.smallButton}>↑</button>
                          <button disabled={index === pendingClaims.length - 1 || actionId === claim.id} onClick={() => void moveClaim(claim.id, 1)} style={S.smallButton}>↓</button>
                          <button disabled={actionId === claim.id} onClick={() => void cancelClaim(claim.id)} style={S.cancelButton}>CANCEL</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {tab === "ORDER" && (
          <section style={S.panel}>
            <div style={S.panelHead}><strong>{faabMode ? "FAAB BALANCES" : "WAIVER PRIORITY"}</strong></div>
            {waiverOrder.map(row => {
              const team = teamMap.get(row.fantasy_team_id);
              const mine = myTeam?.id === row.fantasy_team_id;
              return (
                <div key={row.fantasy_team_id} style={{ ...S.orderRow, ...(mine ? S.myOrderRow : {}) }}>
                  <strong style={S.orderNumber}>#{row.waiver_priority}</strong>
                  <div><strong>{team?.team_name ?? "Unknown Team"}</strong>{mine && <div style={S.orange}>YOUR TEAM</div>}</div>
                  {faabMode && <strong>${Math.max(0, faabBudget - row.faab_spent).toFixed(0)}</strong>}
                </div>
              );
            })}
          </section>
        )}

        {tab === "HISTORY" && (
          <section style={S.panel}>
            <div style={S.panelHead}><strong>TRANSACTION HISTORY</strong></div>
            {transactions.length === 0 ? <div style={S.empty}>No waiver or free-agent transactions yet.</div> : transactions.map(tx => (
              <div key={tx.id} style={S.transactionRow}>
                <div>
                  <strong>{teamMap.get(tx.fantasy_team_id)?.team_name ?? "Unknown Team"}</strong>
                  <div style={S.panelSub}>
                    {tx.transaction_type === "waiver_add" ? "Claimed" : tx.transaction_type === "free_agent_add" ? "Added" : "Dropped"}{" "}
                    <strong>{playerMap.get(tx.nhl_player_id)?.display_name ?? `Player ${tx.nhl_player_id}`}</strong>
                  </div>
                </div>
                <span style={S.panelSub}>{formatDate(tx.created_at)}</span>
              </div>
            ))}
          </section>
        )}
      </div>

      {selectedPlayer && (
        <div style={S.modalBackdrop} onMouseDown={e => e.target === e.currentTarget && setSelectedPlayer(null)}>
          <div style={S.modal}>
            <div style={S.modalHead}>
              <div style={S.modalIdentity}>
                <span style={S.bigAvatar}>
                  {selectedPlayer.headshot_url ? <img src={selectedPlayer.headshot_url} alt="" style={S.headshot} /> : initials(selectedPlayer.display_name)}
                </span>
                <div>
                  <div style={S.eyebrow}>PLAYER DETAILS</div>
                  <h2 style={S.modalTitle}>{selectedPlayer.display_name}</h2>
                  <div style={S.subtitle}>{selectedPlayer.teamName} • {normalizePosition(selectedPlayer, positionMode)}</div>
                  {injuryStatusLabel(selectedPlayer.injury_status) ? (
                    <div className="g365-waivers-modal-injury">
                      <span className="g365-waivers-injury-badge g365-waivers-injury-badge-static">
                        {injuryStatusLabel(selectedPlayer.injury_status)}
                      </span>
                      <span>
                        <strong>{title(selectedPlayer.injury_status)}</strong>
                        {selectedPlayer.injury_detail ? <small>{selectedPlayer.injury_detail}</small> : null}
                        {injuryReturnLabel(selectedPlayer.injury_return_date) ? (
                          <small>Expected return: {injuryReturnLabel(selectedPlayer.injury_return_date)}</small>
                        ) : null}
                        {selectedPlayer.injury_source ? <small>Source: {selectedPlayer.injury_source}</small> : null}
                      </span>
                    </div>
                  ) : null}
                </div>
              </div>
              <button type="button" onClick={() => setSelectedPlayer(null)} style={S.close}>×</button>
            </div>
            <div style={S.detailGrid}>
              <Detail
                label={seasonHasStarted ? "Fantasy Points" : "Projected Fantasy Points"}
                value={fmt(seasonHasStarted ? selectedPlayer.fp : selectedPlayer.projectedFp, 1)}
              />
              <Detail
                label={seasonHasStarted ? "Fantasy PPG" : "Projected Fantasy PPG"}
                value={fmt(seasonHasStarted ? selectedPlayer.fppg : selectedPlayer.projectedFppg, 1)}
              />
              <Detail label="Games Played" value={seasonHasStarted ? fmt(selectedPlayer.gp) : "—"} />

              {normalizePosition(selectedPlayer, positionMode) === "G" ? (
                <>
                  <Detail label="Goalie Starts" value={fmt(selectedPlayer.goalieStarts)} />
                  <Detail label="Wins" value={fmt(selectedPlayer.goalieWins)} />
                  <Detail label="Saves" value={fmt(selectedPlayer.saves)} />
                  <Detail label="Shots Against" value={fmt(selectedPlayer.shotsAgainst)} />
                  <Detail label="Goals Against" value={fmt(selectedPlayer.goalsAgainst)} />
                  <Detail label="Shutouts" value={fmt(selectedPlayer.shutouts)} />
                  <Detail label="Save %" value={fmt(selectedPlayer.savePct, 3)} />
                  <Detail label="GAA" value={fmt(selectedPlayer.gaa, 2)} />
                </>
              ) : (
                <>
                  <Detail label="Goals" value={fmt(selectedPlayer.goals)} />
                  <Detail label="Assists" value={fmt(selectedPlayer.assists)} />
                  <Detail label="Points" value={fmt(selectedPlayer.points)} />
                  <Detail label="Shots" value={fmt(selectedPlayer.sog)} />
                  <Detail label="Hits" value={fmt(selectedPlayer.hits)} />
                  <Detail label="Blocks" value={fmt(selectedPlayer.blocks)} />
                  <Detail label="Power Play Pts" value={fmt(selectedPlayer.ppp)} />
                  <Detail label="Short-Handed Pts" value={fmt(selectedPlayer.shp)} />
                </>
              )}
            </div>
            <div style={S.modalActions}>
              {selectedPlayer.waiverStatus === "available" ? (
                <button type="button" onClick={() => { setSelectedPlayer(null); void addPlayer(selectedPlayer); }} style={S.addButton}>ADD PLAYER</button>
              ) : selectedPlayer.waiverStatus === "waivers" ? (
                <button type="button" onClick={() => { const p = selectedPlayer; setSelectedPlayer(null); openClaim(p); }} style={S.claimButton}>CLAIM PLAYER</button>
              ) : <button disabled style={S.disabledButton}>WAIVER PROCESSING</button>}
            </div>
          </div>
        </div>
      )}

      {claimPlayer && (
        <div style={S.modalBackdrop} onMouseDown={e => e.target === e.currentTarget && setClaimPlayer(null)}>
          <div style={S.modal}>
            <div style={S.modalHead}>
              <div>
                <div style={S.eyebrow}>WAIVER CLAIM</div>
                <h2 style={S.modalTitle}>{claimPlayer.display_name}</h2>
                <div style={S.subtitle}>Clears {formatDate(claimPlayer.clearsAt)}</div>
              </div>
              <button type="button" onClick={() => setClaimPlayer(null)} style={S.close}>×</button>
            </div>

            {faabMode && (
              <label style={S.field}>
                <span style={S.fieldLabel}>FAAB BID</span>
                <input type="number" min="0" max={faabRemaining} step="1" value={faabBid}
                  onChange={e => setFaabBid(e.target.value)} style={S.input} />
                <span style={S.help}>Remaining budget: ${faabRemaining.toFixed(0)}</span>
              </label>
            )}

            <label style={S.field}>
              <span style={S.fieldLabel}>DROP PLAYER</span>
              <select value={dropPlayerId ?? ""} onChange={e => setDropPlayerId(e.target.value ? Number(e.target.value) : null)} style={S.input}>
                <option value="">No drop selected</option>
                {myRoster.map(({ roster, player }) => (
                  <option key={roster.id} value={player.id}>
                    {player.display_name} — {player.position ?? player.position_group ?? "—"} ({title(roster.roster_status)})
                  </option>
                ))}
              </select>
              <span style={S.help}>If your standard roster is full, select the player to drop if this claim wins.</span>
            </label>

            <div style={S.modalActions}>
              <button type="button" onClick={() => setClaimPlayer(null)} style={S.secondaryButton}>CANCEL</button>
              <button type="button" disabled={submitting} onClick={() => void submitClaim()} style={S.claimButton}>
                {submitting ? "SUBMITTING..." : "SUBMIT CLAIM"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div style={S.statBox}><span style={S.statLabel}>{label}</span><strong style={S.statValue}>{value}</strong></div>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div style={S.detail}><span style={S.statLabel}>{label.toUpperCase()}</span><strong style={S.detailValue}>{value}</strong></div>;
}

const S: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: "#09090a", color: "#f5f5f5", padding: "14px 10px 48px" },
  shell: { width: "min(1400px, 100%)", margin: "0 auto", display: "grid", gap: 12 },
  loading: { padding: 50, textAlign: "center", color: "#999ca2", fontWeight: 800 },
  hero: { padding: "18px 20px", border: "1px solid #29292d", borderRadius: 10, background: "linear-gradient(135deg,#171719 0%,#111113 60%,#21110b 100%)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 18, flexWrap: "wrap" },
  eyebrow: { color: "#ff6a00", fontSize: 9, fontWeight: 1000, letterSpacing: 1.3 },
  title: { margin: "4px 0 0", fontSize: "clamp(28px,5vw,42px)", lineHeight: 1, fontWeight: 1000 },
  subtitle: { marginTop: 7, color: "#a0a0a5", fontSize: 11, fontWeight: 800 },
  heroStats: { display: "flex", gap: 8, flexWrap: "wrap" },
  statBox: { minWidth: 95, padding: "9px 12px", border: "1px solid #493025", borderRadius: 7, background: "#17110e", display: "grid", gap: 3 },
  statLabel: { color: "#8e8e94", fontSize: 7, fontWeight: 1000, letterSpacing: .8 },
  statValue: { color: "#ff7b31", fontSize: 18, fontWeight: 1000 },
  back: { justifySelf: "start", color: "#ff7b31", textDecoration: "none", fontSize: 10, fontWeight: 1000 },
  tabs: { display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2 },
  tab: { flex: "0 0 auto", border: "1px solid #303034", borderRadius: 6, background: "#121214", color: "#9a9aa0", padding: "9px 12px", fontSize: 9, fontWeight: 1000, cursor: "pointer" },
  activeTab: { background: "#26150d", border: "1px solid #7c3c1d", color: "#ff7b31" },
  panel: { border: "1px solid #29292d", borderRadius: 9, overflow: "hidden", background: "#111113" },
  panelHead: { padding: "12px 14px", background: "#0d0d0f", borderBottom: "1px solid #29292d", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, fontSize: 10 },
  panelSub: { marginTop: 4, color: "#777a80", fontSize: 8, fontWeight: 700 },
  countBadge: { minWidth: 32, padding: "5px 8px", borderRadius: 999, background: "#26150d", border: "1px solid #66351f", color: "#ff7b31", textAlign: "center", fontSize: 9, fontWeight: 1000 },
  filters: { padding: 12, display: "grid", gridTemplateColumns: "minmax(180px,2fr) minmax(150px,1fr) minmax(150px,1fr)", gap: 8, borderBottom: "1px solid #242428" },
  input: { width: "100%", boxSizing: "border-box", minHeight: 42, border: "1px solid #343438", borderRadius: 6, background: "#0d0d0f", color: "#fff", padding: "0 10px", fontSize: 11 },
  positionRow: { display: "flex", gap: 5, overflowX: "auto", padding: "10px 12px 7px" },
  categoryBar: { padding: "0 12px 11px", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", borderTop: "1px solid #1f1f22" },
  categoryTitle: { color: "#ff7b31", fontSize: 8, fontWeight: 1000, letterSpacing: .8, paddingTop: 9 },
  categoryList: { display: "flex", gap: 4, flexWrap: "wrap", paddingTop: 8 },
  categoryChip: { padding: "4px 6px", border: "1px solid #303034", borderRadius: 4, background: "#151517", color: "#b6b6bb", fontSize: 7, fontWeight: 1000 },
  filterButton: { flex: "0 0 auto", minWidth: 42, minHeight: 34, border: "1px solid #303034", borderRadius: 5, background: "#151517", color: "#999ca2", fontSize: 9, fontWeight: 1000, cursor: "pointer" },
  filterActive: { background: "#ff5a1f", border: "1px solid #ff5a1f", color: "#fff" },
  tableWrap: { width: "100%", overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 8, textAlign: "center", tableLayout: "auto", lineHeight: 1.15 },
  actionHead: { position: "sticky", left: 0, zIndex: 4, width: 62, minWidth: 62, background: "#0d0d0f", textAlign: "center", fontSize: 7, padding: "7px 3px" },
  leftHead: { position: "sticky", left: 62, zIndex: 4, textAlign: "left", width: 180, minWidth: 180, background: "#0d0d0f", fontSize: 7, padding: "7px 5px" },
  sortButton: { border: 0, background: "transparent", color: "#aaaab0", fontSize: 7, fontWeight: 1000, cursor: "pointer", padding: "7px 3px", whiteSpace: "nowrap" },
  actionCell: { position: "sticky", left: 0, zIndex: 3, width: 62, minWidth: 62, background: "#111113", textAlign: "center", padding: "3px 3px" },
  playerCell: { textAlign: "left", position: "sticky", left: 62, zIndex: 2, background: "#111113", width: 180, minWidth: 180, padding: "2px 4px" },
  playerButton: { width: "100%", border: 0, background: "transparent", color: "#fff", display: "flex", alignItems: "center", gap: 6, textAlign: "left", cursor: "pointer", padding: "4px 4px" },
  avatar: { width: 28, height: 28, flex: "0 0 28px", borderRadius: "50%", overflow: "hidden", background: "#1b1b1e", border: "1px solid #333338", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 7, fontWeight: 1000, color: "#777" },
  bigAvatar: { width: 58, height: 58, flex: "0 0 58px", borderRadius: "50%", overflow: "hidden", background: "#1b1b1e", border: "1px solid #3a3a3e", display: "flex", alignItems: "center", justifyContent: "center" },
  headshot: { width: "100%", height: "100%", objectFit: "cover" },
  playerName: { display: "block", fontSize: 9, fontWeight: 1000, whiteSpace: "nowrap" },
  playerSub: { display: "block", marginTop: 1, color: "#777a80", fontSize: 6, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 135 },
  orange: { color: "#ff7b31", fontSize: 8, fontWeight: 1000 },
  fp: { color: "#fff", fontWeight: 1000, fontSize: 8 },
  availableBadge: { display: "inline-block", padding: "3px 5px", borderRadius: 999, background: "#102319", border: "1px solid #245d39", color: "#67d68a", fontSize: 6, fontWeight: 1000, whiteSpace: "nowrap" },
  waiverBadge: { display: "inline-block", padding: "3px 5px", borderRadius: 5, background: "#26150d", border: "1px solid #6a351e", color: "#ff7b31", fontSize: 6, fontWeight: 1000, lineHeight: 1.25, whiteSpace: "nowrap" },
  processingBadge: { display: "inline-block", padding: "3px 5px", borderRadius: 999, background: "#211b0e", border: "1px solid #66511f", color: "#f2c14e", fontSize: 6, fontWeight: 1000, whiteSpace: "nowrap" },
  addButton: { minHeight: 28, padding: "0 7px", border: "1px solid #245d39", borderRadius: 5, background: "#102319", color: "#67d68a", fontSize: 7, fontWeight: 1000, cursor: "pointer", whiteSpace: "nowrap" },
  claimButton: { minHeight: 28, padding: "0 7px", border: 0, borderRadius: 5, background: "linear-gradient(135deg,#ff3d18,#ff7628)", color: "#fff", fontSize: 7, fontWeight: 1000, cursor: "pointer", whiteSpace: "nowrap" },
  disabledButton: { minHeight: 28, padding: "0 6px", border: "1px solid #333", borderRadius: 5, background: "#18181b", color: "#666", fontSize: 7, fontWeight: 1000, cursor: "not-allowed", whiteSpace: "nowrap" },
  empty: { padding: 30, textAlign: "center", color: "#777a80", fontSize: 11, fontWeight: 700 },
  claimRow: { padding: 12, borderBottom: "1px solid #242428", display: "grid", gridTemplateColumns: "44px minmax(0,1fr) auto", gap: 10, alignItems: "center" },
  claimPriority: { width: 34, height: 34, borderRadius: "50%", background: "#21140f", border: "1px solid #66351f", color: "#ff7b31", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 1000 },
  claimDetails: { marginTop: 5, display: "flex", gap: 8, flexWrap: "wrap", color: "#777a80", fontSize: 8, fontWeight: 700 },
  failure: { marginTop: 5, color: "#e78378", fontSize: 8, fontWeight: 800 },
  claimActions: { display: "flex", gap: 5, flexWrap: "wrap" },
  smallButton: { width: 30, height: 30, border: "1px solid #38383d", borderRadius: 5, background: "#18181b", color: "#fff", fontWeight: 1000, cursor: "pointer" },
  cancelButton: { minHeight: 30, padding: "0 8px", border: "1px solid #57302c", borderRadius: 5, background: "#211413", color: "#e78378", fontSize: 7, fontWeight: 1000, cursor: "pointer" },
  orderRow: { minHeight: 60, padding: "8px 12px", borderBottom: "1px solid #242428", borderLeft: "3px solid transparent", display: "grid", gridTemplateColumns: "50px minmax(0,1fr) auto", gap: 10, alignItems: "center" },
  myOrderRow: { background: "#19120f", borderLeft: "3px solid #ff5a1f" },
  orderNumber: { color: "#ff7b31", fontSize: 17, fontWeight: 1000 },
  transactionRow: { padding: "11px 13px", borderBottom: "1px solid #242428", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, fontSize: 10 },
  error: { padding: 14, border: "1px solid #742b25", borderRadius: 8, background: "#29110f", color: "#ffd1cc", display: "grid", gap: 7, fontSize: 10 },
  success: { padding: "11px 13px", border: "1px solid #245d39", borderRadius: 7, background: "#102319", color: "#67d68a", fontSize: 10, fontWeight: 900 },
  warning: { padding: "11px 13px", border: "1px solid #65421f", borderRadius: 7, background: "#24180d", color: "#ffb66d", fontSize: 10, fontWeight: 800 },
  modalBackdrop: { position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,.78)", padding: 12, display: "flex", alignItems: "center", justifyContent: "center" },
  modal: { width: "min(680px,100%)", maxHeight: "90vh", overflowY: "auto", border: "1px solid #38383d", borderRadius: 10, background: "#111113", boxShadow: "0 24px 70px rgba(0,0,0,.55)" },
  modalHead: { padding: "16px 18px", borderBottom: "1px solid #29292d", background: "linear-gradient(135deg,#171719,#21110b)", display: "flex", justifyContent: "space-between", gap: 12 },
  modalIdentity: { display: "flex", alignItems: "center", gap: 12 },
  modalTitle: { margin: "4px 0 0", fontSize: 23, fontWeight: 1000 },
  close: { width: 36, height: 36, border: "1px solid #3b3b40", borderRadius: 6, background: "#171719", color: "#fff", fontSize: 22, cursor: "pointer" },
  detailGrid: { padding: 16, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 8 },
  detail: { padding: 10, border: "1px solid #29292d", borderRadius: 7, background: "#0d0d0f", display: "grid", gap: 5 },
  detailValue: { color: "#fff", fontSize: 16, fontWeight: 1000 },
  field: { padding: "14px 18px 0", display: "grid", gap: 6 },
  fieldLabel: { color: "#ff7b31", fontSize: 8, fontWeight: 1000, letterSpacing: .7 },
  help: { color: "#777a80", fontSize: 8, lineHeight: 1.4 },
  modalActions: { padding: 18, display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" },
  secondaryButton: { minHeight: 40, padding: "0 14px", border: "1px solid #38383d", borderRadius: 6, background: "#18181b", color: "#aaaab0", fontSize: 9, fontWeight: 1000, cursor: "pointer" },
};