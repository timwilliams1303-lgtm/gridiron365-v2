"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { createBrowserClient } from "@supabase/ssr";

type NhlTraditionalDraftProps = {
  leagueId: string;
};

type LeagueRow = {
  id: string;
  name: string;
  season: number;
  commissioner_user_id: string | null;
  status: string | null;
};

type NhlSettingsRow = {
  league_format: string | null;
  position_mode: string | null;
};

type RosterSettingsRow = {
  starting_c: number | null;
  starting_lw: number | null;
  starting_rw: number | null;
  starting_d: number | null;
  starting_g: number | null;
  starting_util: number | null;
  starting_f: number | null;
  bench_slots: number | null;
  ir_slots: number | null;
};

type DraftRow = {
  id: string;
  league_id: string;
  season: number;
  draft_type: string;
  status: string;
  rounds: number;
  seconds_per_pick: number;
  current_overall_pick: number;
  current_round: number;
  current_pick_in_round: number;
  current_fantasy_team_id: number | null;
  started_at: string | null;
  current_pick_started_at: string | null;
  current_pick_expires_at: string | null;
  paused_at: string | null;
  completed_at: string | null;
  updated_at: string | null;
};

type DraftTeamRow = {
  draft_slot: number;
  fantasy_team_id: number;
  is_cpu: boolean;
};

type FantasyTeamRow = {
  id: number;
  team_name: string;
  owner_id: string | null;
  active: boolean | null;
};

type DraftPickRow = {
  id: number;
  draft_id: string;
  round_number: number;
  pick_in_round: number;
  overall_pick: number;
  draft_slot: number;
  fantasy_team_id: number;
  nhl_player_id: number;
  picked_at: string;
};

type NhlPlayerRow = {
  id: number;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  team_id: number | null;
  position: string | null;
  position_group: string | null;
  jersey_number: string | null;
  active: boolean | null;
  status: string | null;
  injury_status: string | null;
  headshot_url: string | null;
};

type NhlTeamRow = {
  id: number;
  abbreviation?: string | null;
  team_abbreviation?: string | null;
  short_name?: string | null;
  display_name?: string | null;
  name?: string | null;
  active?: boolean | null;
};

type DraftRankingRow = {
  nhl_player_id: number;
  overall_rank: number | null;
  position_rank: number | null;
  projected_fantasy_points: number | null;
  projected_fantasy_points_per_game: number | null;
  projected_games_played: number | null;
  projected_goals?: number | null;
  projected_assists?: number | null;
  projected_points?: number | null;
  projected_plus_minus?: number | null;
  projected_penalty_minutes?: number | null;
  projected_power_play_points?: number | null;
  projected_short_handed_points?: number | null;
  projected_shots_on_goal?: number | null;
  projected_hits?: number | null;
  projected_blocked_shots?: number | null;
  projected_goalie_starts?: number | null;
  projected_goalie_wins?: number | null;
  projected_goalie_losses?: number | null;
  projected_goalie_ot_losses?: number | null;
  projected_saves?: number | null;
  projected_shots_against?: number | null;
  projected_goals_against?: number | null;
  projected_shutouts?: number | null;
  projected_save_percentage?: number | null;
  projected_goals_against_average?: number | null;
  rookie_eligible?: boolean | null;
  player_class?: string | null;
};

type SeasonTotalsRow = Record<string, unknown>;

type DraftBoardCell = {
  overallPick: number;
  round: number;
  pickInRound: number;
  draftSlot: number;
  fantasyTeamId: number;
  teamName: string;
  player: NhlPlayerRow | null;
  isCurrent: boolean;
  originalFantasyTeamId?: number;
  originalTeamName?: string;
  isTraded?: boolean;
};

type LivePickAsset = {
  draftPickAssetId: number;
  overallPick: number | null;
  roundNumber: number;
  originalFantasyTeamId: number;
  originalTeamName: string;
  currentFantasyTeamId: number;
  currentTeamName: string;
  isTraded: boolean;
  used: boolean;
};

type TradeAssetPlayer = { nhlPlayerId: number; playerName: string; position: string; fantasyTeamId: number; fantasyTeamName: string };
type TradeAssetPick = { draftPickAssetId: number; draftSeason: number; roundNumber: number; overallPick: number | null; originalFantasyTeamId: number; originalTeamName: string; currentFantasyTeamId: number; currentTeamName: string; isTraded: boolean; used: boolean };
type TradeAssets = { players: TradeAssetPlayer[]; draftPicks: TradeAssetPick[] };

type RpcJson = Record<string, unknown>;

type MyDraftRankingRow = {
  nhl_player_id: number;
  rank: number;
};

type AutoDraftCandidate = {
  exists?: boolean;
  nhlPlayerId?: number;
  playerName?: string;
  position?: string;
  source?: string;
  reason?: string;
  forceNeed?: boolean;
};

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function normalizePosition(
  position: string | null,
  positionGroup: string | null
) {
  const pos = (position ?? "").trim().toUpperCase();
  const group = (positionGroup ?? "").trim().toUpperCase();

  if (pos === "C" || pos === "CENTER") return "C";

  if (
    pos === "LW" ||
    pos === "LEFT WING" ||
    pos === "LEFTWING"
  ) {
    return "LW";
  }

  if (
    pos === "RW" ||
    pos === "RIGHT WING" ||
    pos === "RIGHTWING"
  ) {
    return "RW";
  }

  if (
    pos === "D" ||
    pos === "DEFENSE" ||
    pos === "DEFENSEMAN" ||
    pos === "DEFENCEMAN"
  ) {
    return "D";
  }

  if (
    pos === "G" ||
    pos === "GOALIE" ||
    pos === "GOALTENDER"
  ) {
    return "G";
  }

  if (group === "G" || group === "GOALIE") return "G";
  if (group === "D" || group === "DEFENSE") return "D";
  if (group === "F" || group === "FORWARD") return "F";

  return pos || "—";
}

function nhlTeamLabel(team: NhlTeamRow | null | undefined) {
  if (!team) return "FA";

  return (
    team.abbreviation?.trim() ||
    team.team_abbreviation?.trim() ||
    team.short_name?.trim() ||
    team.display_name?.trim() ||
    team.name?.trim() ||
    `Team ${team.id}`
  ).toUpperCase();
}

function playerName(player: NhlPlayerRow) {
  if (player.display_name?.trim()) {
    return player.display_name.trim();
  }

  const name = [player.first_name, player.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();

  return name || `Player #${player.id}`;
}

function rpcString(
  value: RpcJson | null,
  key: string
) {
  const result = value?.[key];

  return typeof result === "string" ? result : null;
}

function formatDraftStatus(status: string | null) {
  switch (status) {
    case "setup":
      return "Setup";
    case "ready":
      return "Ready";
    case "drafting":
      return "Live";
    case "paused":
      return "Paused";
    case "completed":
      return "Complete";
    default:
      return status || "Not Prepared";
  }
}


function recordNumber(row: SeasonTotalsRow | null, ...keys: string[]) {
  if (!row) return null;
  for (const key of keys) {
    const value = row[key];
    if (value !== null && value !== undefined && value !== "") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

function statText(value: number | null, digits = 0) {
  if (value == null) return "—";
  return value.toFixed(digits);
}

export default function NhlTraditionalDraft({
  leagueId,
}: NhlTraditionalDraftProps) {
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [draftingPlayerId, setDraftingPlayerId] =
    useState<number | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [userId, setUserId] = useState<string | null>(null);
  const [league, setLeague] = useState<LeagueRow | null>(null);
  const [settings, setSettings] =
    useState<NhlSettingsRow | null>(null);

  const [draft, setDraft] = useState<DraftRow | null>(null);
  const [rosterSettings, setRosterSettings] = useState<RosterSettingsRow | null>(null);
  const [selectedRosterTeamId, setSelectedRosterTeamId] = useState<number | null>(null);
  const [draftTeams, setDraftTeams] = useState<DraftTeamRow[]>([]);
  const [fantasyTeams, setFantasyTeams] =
    useState<FantasyTeamRow[]>([]);
  const [draftPicks, setDraftPicks] = useState<DraftPickRow[]>([]);
  const [players, setPlayers] = useState<NhlPlayerRow[]>([]);
  const [nhlTeams, setNhlTeams] = useState<NhlTeamRow[]>([]);
  const [draftRankings, setDraftRankings] = useState<DraftRankingRow[]>([]);
  const [detailPlayerId, setDetailPlayerId] = useState<number | null>(null);
  const [detailLastSeason, setDetailLastSeason] = useState<SeasonTotalsRow | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [positionFilter, setPositionFilter] = useState("ALL");
  const [teamFilter, setTeamFilter] = useState("ALL");
  const [activeTab, setActiveTab] = useState<
    "players" | "queue" | "rankings" | "board" | "trade" | "summary"
  >("players");
  const [queueIds, setQueueIds] = useState<number[]>([]);
  const [myRankingIds, setMyRankingIds] = useState<number[]>([]);
  const [rankingBusy, setRankingBusy] = useState(false);
  const [autoDraftEnabled, setAutoDraftEnabled] = useState(false);
  const [autoCandidate, setAutoCandidate] = useState<AutoDraftCandidate | null>(null);
  const [autoBusy, setAutoBusy] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const audioContextRef = useRef<AudioContext | null>(null);
  const autoAttemptRef = useRef<string | null>(null);
  const previousDraftStatusRef = useRef<string | null>(null);
  const previousPickIdsRef = useRef<Set<number>>(new Set());
  const countdownSoundRef = useRef<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [livePickAssets, setLivePickAssets] = useState<LivePickAsset[]>([]);
  const [tradeBusy, setTradeBusy] = useState(false);
  const [tradeSection, setTradeSection] = useState<"teams" | "pending" | "block">("teams");
  const [conversations, setConversations] = useState<RpcJson[]>([]);
  const [pendingOffers, setPendingOffers] = useState<RpcJson[]>([]);
  const [pendingOfferAssets, setPendingOfferAssets] = useState<RpcJson[]>([]);
  const [tradeBlock, setTradeBlock] = useState<RpcJson[]>([]);
  const [myTradeNeeds, setMyTradeNeeds] = useState<string[]>([]);
  const [tradeNeedsBusy, setTradeNeedsBusy] = useState(false);
  const [tradeSummary, setTradeSummary] = useState<RpcJson[]>([]);
  const [chatUnread, setChatUnread] = useState(0);
  const [selectedTradeTeamId, setSelectedTradeTeamId] = useState<number | null>(null);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [chatMessages, setChatMessages] = useState<RpcJson[]>([]);
  const [chatBody, setChatBody] = useState("");
  const [myTradeAssets, setMyTradeAssets] = useState<TradeAssets>({ players: [], draftPicks: [] });
  const [theirTradeAssets, setTheirTradeAssets] = useState<TradeAssets>({ players: [], draftPicks: [] });
  const [offerMinePlayers, setOfferMinePlayers] = useState<number[]>([]);
  const [offerTheirPlayers, setOfferTheirPlayers] = useState<number[]>([]);
  const [offerMinePicks, setOfferMinePicks] = useState<number[]>([]);
  const [offerTheirPicks, setOfferTheirPicks] = useState<number[]>([]);
  const [counteringOfferId, setCounteringOfferId] = useState<number | null>(null);
  const chatListRef = useRef<HTMLDivElement | null>(null);

  const loadDraft = useCallback(
    async (showLoader = true) => {
      if (showLoader) {
        setLoading(true);
      }

      setError(null);

      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) {
          throw userError;
        }

        if (!user) {
          throw new Error("You must be signed in.");
        }

        setUserId(user.id);

        const [
          leagueResult,
          settingsResult,
          rosterSettingsResult,
          draftResult,
          teamsResult,
          nhlTeamsResult,
          playersResult,
        ] = await Promise.all([
          supabase
            .from("leagues")
            .select(
              "id,name,season,commissioner_user_id,status"
            )
            .eq("id", leagueId)
            .single(),

          supabase
            .from("nhl_traditional_settings")
            .select("league_format,position_mode")
            .eq("league_id", leagueId)
            .maybeSingle(),

          supabase
            .from("nhl_traditional_roster_settings")
            .select("starting_c,starting_lw,starting_rw,starting_d,starting_g,starting_util,starting_f,bench_slots,ir_slots")
            .eq("league_id", leagueId)
            .maybeSingle(),

          supabase.rpc("get_nhl_traditional_draft_state", {
            p_league_id: leagueId,
          }),

          supabase
            .from("fantasy_teams")
            .select("id,team_name,owner_id,active")
            .eq("league_id", leagueId)
            .eq("active", true)
            .order("id", { ascending: true }),

          supabase
            .from("nhl_teams")
            .select("*")
            .order("id", { ascending: true }),

          (async () => {
            const pageSize = 1000;
            const allPlayers: NhlPlayerRow[] = [];

            for (let from = 0; ; from += pageSize) {
              const { data, error: playersPageError } = await supabase
                .from("nhl_players")
                .select(
                  "id,display_name,first_name,last_name,team_id,position,position_group,jersey_number,active,status,injury_status,headshot_url"
                )
                .eq("active", true)
                .order("display_name", { ascending: true })
                .order("id", { ascending: true })
                .range(from, from + pageSize - 1);

              if (playersPageError) {
                throw playersPageError;
              }

              const page = (data as NhlPlayerRow[] | null) ?? [];
              allPlayers.push(...page);

              if (page.length < pageSize) {
                break;
              }
            }

            return allPlayers;
          })(),
        ]);

        if (leagueResult.error) {
          throw leagueResult.error;
        }

        if (settingsResult.error) {
          throw settingsResult.error;
        }

        if (rosterSettingsResult.error) {
          throw rosterSettingsResult.error;
        }

        if (draftResult.error) {
          throw draftResult.error;
        }

        if (teamsResult.error) {
          throw teamsResult.error;
        }

        if (nhlTeamsResult.error) {
          throw nhlTeamsResult.error;
        }

        const loadedLeague =
          leagueResult.data as LeagueRow;

        const { data: rankingsData, error: rankingsError } = await supabase.rpc(
          "get_nhl_traditional_draft_rankings",
          {
            p_league_id: leagueId,
            p_season: Number((draftResult.data as RpcJson | null)?.season ?? loadedLeague.season),
          }
        );

        if (rankingsError) {
          throw rankingsError;
        }

        const loadedSettings =
          (settingsResult.data as NhlSettingsRow | null) ?? null;

        const draftState =
          draftResult.data && typeof draftResult.data === "object"
            ? (draftResult.data as RpcJson)
            : null;

        const draftExists = draftState?.exists === true;

        const loadedDraft: DraftRow | null = draftExists
          ? {
              id: String(draftState?.draftId ?? ""),
              league_id: leagueId,
              season: Number(draftState?.season ?? loadedLeague.season),
              draft_type: String(draftState?.draftType ?? "redraft"),
              status: String(draftState?.status ?? "setup"),
              rounds: Number(draftState?.rounds ?? 0),
              seconds_per_pick: Number(draftState?.secondsPerPick ?? 90),
              current_overall_pick: Number(draftState?.currentOverallPick ?? 1),
              current_round: Number(draftState?.currentRound ?? 1),
              current_pick_in_round: Number(draftState?.currentPickInRound ?? 1),
              current_fantasy_team_id:
                draftState?.currentFantasyTeamId == null
                  ? null
                  : Number(draftState.currentFantasyTeamId),
              started_at:
                typeof draftState?.startedAt === "string"
                  ? draftState.startedAt
                  : null,
              current_pick_started_at:
                typeof draftState?.currentPickStartedAt === "string"
                  ? draftState.currentPickStartedAt
                  : null,
              current_pick_expires_at:
                typeof draftState?.currentPickExpiresAt === "string"
                  ? draftState.currentPickExpiresAt
                  : null,
              paused_at:
                typeof draftState?.pausedAt === "string"
                  ? draftState.pausedAt
                  : null,
              completed_at:
                typeof draftState?.completedAt === "string"
                  ? draftState.completedAt
                  : null,
              updated_at:
                typeof draftState?.updatedAt === "string"
                  ? draftState.updatedAt
                  : null,
            }
          : null;

        const loadedFantasyTeams =
          (teamsResult.data as FantasyTeamRow[] | null) ?? [];

        const loadedPlayers = playersResult;
        const loadedNhlTeams =
          (nhlTeamsResult.data as NhlTeamRow[] | null) ?? [];

        setLeague(loadedLeague);
        setSettings(loadedSettings);
        setRosterSettings((rosterSettingsResult.data as RosterSettingsRow | null) ?? null);
        setDraft(loadedDraft);
        setFantasyTeams(loadedFantasyTeams);
        setNhlTeams(loadedNhlTeams);
        setPlayers(loadedPlayers);
        setDraftRankings((rankingsData as DraftRankingRow[] | null) ?? []);

        if (!loadedDraft) {
          setDraftTeams([]);
          setDraftPicks([]);
          return;
        }

        const [draftTeamsResult, draftPicksResult] =
          await Promise.all([
            supabase
              .from("nhl_traditional_draft_teams")
              .select(
                "draft_slot,fantasy_team_id,is_cpu"
              )
              .eq("draft_id", loadedDraft.id)
              .order("draft_slot", { ascending: true }),

            supabase
              .from("nhl_traditional_draft_picks")
              .select(
                "id,draft_id,round_number,pick_in_round,overall_pick,draft_slot,fantasy_team_id,nhl_player_id,picked_at"
              )
              .eq("draft_id", loadedDraft.id)
              .order("overall_pick", { ascending: true }),
          ]);

        if (draftTeamsResult.error) {
          throw draftTeamsResult.error;
        }

        if (draftPicksResult.error) {
          throw draftPicksResult.error;
        }

        let loadedDraftTeams =
          (draftTeamsResult.data as DraftTeamRow[] | null) ?? [];
        let loadedDraftPicks =
          (draftPicksResult.data as DraftPickRow[] | null) ?? [];

        // Browser RLS can legitimately hide these two draft tables.
        // The member-safe RPC is the authoritative Draft Room fallback.
        if (loadedDraftTeams.length === 0) {
          const { data: roomData, error: roomError } = await supabase.rpc(
            "get_nhl_traditional_draft_room_data",
            { p_league_id: leagueId }
          );
          if (roomError) throw roomError;
          const room = roomData && typeof roomData === "object" ? (roomData as RpcJson) : null;
          loadedDraftTeams = Array.isArray(room?.draftTeams)
            ? (room?.draftTeams as DraftTeamRow[])
            : loadedDraftTeams;
          loadedDraftPicks = Array.isArray(room?.draftPicks)
            ? (room?.draftPicks as DraftPickRow[])
            : loadedDraftPicks;
        }

        setDraftTeams(loadedDraftTeams);
        setDraftPicks(loadedDraftPicks);

        const ownedTeam = loadedFantasyTeams.find((team) => team.owner_id === user.id) ?? null;
        if (ownedTeam) {
          const { data: liveBoardData, error: liveBoardError } = await supabase.rpc(
            "get_nhl_live_draft_board_state",
            { p_league_id: leagueId, p_fantasy_team_id: ownedTeam.id }
          );
          if (liveBoardError) throw liveBoardError;
          const liveState = liveBoardData && typeof liveBoardData === "object" ? (liveBoardData as RpcJson) : null;
          const rawAssets = Array.isArray(liveState?.draftPickAssets) ? liveState?.draftPickAssets : [];
          setLivePickAssets(rawAssets as LivePickAsset[]);

          await supabase.rpc("initialize_nhl_traditional_my_draft_rankings", {
            p_league_id: leagueId,
            p_fantasy_team_id: ownedTeam.id,
          });

          const [myRanksResult, rankingsPageResult, autoPrefResult] = await Promise.all([
            supabase
              .from("nhl_traditional_draft_player_rankings")
              .select("nhl_player_id,rank")
              .eq("draft_id", loadedDraft.id)
              .eq("fantasy_team_id", ownedTeam.id)
              .order("rank", { ascending: true }),
            supabase
              .from("nhl_traditional_user_rankings")
              .select("nhl_player_id,rank_order")
              .eq("league_id", leagueId)
              .order("rank_order", { ascending: true }),
            supabase.rpc("get_nhl_traditional_auto_draft_preferences", {
              p_league_id: leagueId,
              p_fantasy_team_id: ownedTeam.id,
            }),
          ]);

          if (myRanksResult.error) throw myRanksResult.error;
          if (rankingsPageResult.error) throw rankingsPageResult.error;
          if (autoPrefResult.error) throw autoPrefResult.error;

          const draftedIds = new Set(loadedDraftPicks.map((pick) => pick.nhl_player_id));
          const rankingsPageIds = ((rankingsPageResult.data as Array<{ nhl_player_id: number; rank_order: number }> | null) ?? [])
            .map((row) => Number(row.nhl_player_id))
            .filter((id) => Number.isFinite(id) && !draftedIds.has(id));
          const draftSpecificIds = ((myRanksResult.data as MyDraftRankingRow[] | null) ?? [])
            .map((row) => row.nhl_player_id)
            .filter((id) => !draftedIds.has(id));

          // The standalone My Rankings page is the source of truth for the user's order.
          // Mirror it into this draft's saved rankings so the Draft Room and Auto Draft use the same list.
          const effectiveRankingIds = rankingsPageIds.length > 0 ? rankingsPageIds : draftSpecificIds;
          setMyRankingIds(effectiveRankingIds);

          if (rankingsPageIds.length > 0 && rankingsPageIds.join(",") !== draftSpecificIds.join(",")) {
            const { error: syncRankingsError } = await supabase.rpc(
              "save_nhl_traditional_my_draft_rankings",
              {
                p_league_id: leagueId,
                p_fantasy_team_id: ownedTeam.id,
                p_rankings: rankingsPageIds.map((nhlPlayerId, index) => ({
                  nhlPlayerId,
                  rank: index + 1,
                })),
              },
            );
            if (syncRankingsError) throw syncRankingsError;
          }

          const pref =
            autoPrefResult.data && typeof autoPrefResult.data === "object"
              ? (autoPrefResult.data as RpcJson)
              : null;
          setAutoDraftEnabled(
            pref?.autoDraftEnabled === true || pref?.auto_draft_enabled === true
          );

          const updatedAt =
            typeof liveState?.updatedAt === "string"
              ? liveState.updatedAt
              : null;

          const currentPickStartedAt =
            typeof liveState?.currentPickStartedAt === "string"
              ? liveState.currentPickStartedAt
              : null;

          const currentPickExpiresAt =
            typeof liveState?.currentPickExpiresAt === "string"
              ? liveState.currentPickExpiresAt
              : null;

          setDraft((current) =>
            current
              ? {
                  ...current,
                  updated_at: updatedAt ?? current.updated_at,
                  current_pick_started_at: currentPickStartedAt,
                  current_pick_expires_at: currentPickExpiresAt,
                }
              : current
          );
        } else {
          setLivePickAssets([]);
        }
      } catch (caughtError) {
        console.error(caughtError);

        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to load the NHL draft."
        );
      } finally {
        if (showLoader) {
          setLoading(false);
        }
      }
    },
    [leagueId]
  );

  useEffect(() => {
    void loadDraft();
  }, [loadDraft]);

  useEffect(() => {
    if (!draft || draft.status !== "drafting") {
      return;
    }

    const interval = window.setInterval(() => {
      void loadDraft(false);
    }, 5000);

    return () => {
      window.clearInterval(interval);
    };
  }, [draft?.id, draft?.status, loadDraft]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => window.clearInterval(interval);
  }, []);

  const isCommissioner =
    Boolean(
      userId &&
        league?.commissioner_user_id &&
        userId === league.commissioner_user_id
    );

  const fantasyTeamById = useMemo(() => {
    return new Map(
      fantasyTeams.map((team) => [team.id, team])
    );
  }, [fantasyTeams]);

  const playerById = useMemo(() => {
    return new Map(
      players.map((player) => [player.id, player])
    );
  }, [players]);

  const nhlTeamById = useMemo(() => {
    return new Map(nhlTeams.map((team) => [team.id, team]));
  }, [nhlTeams]);

  const detailPlayer =
    detailPlayerId == null ? null : playerById.get(detailPlayerId) ?? null;

  const detailRanking =
    detailPlayerId == null
      ? null
      : draftRankings.find((row) => row.nhl_player_id === detailPlayerId) ?? null;

  async function openPlayerDetail(playerId: number) {
    setDetailPlayerId(playerId);
    setDetailLastSeason(null);
    setDetailError(null);
    setDetailLoading(true);

    try {
      if (!league) throw new Error("League season is unavailable.");

      const { data, error: totalsError } = await supabase.rpc(
        "get_nhl_traditional_single_player_season_totals",
        {
          p_league_id: leagueId,
          p_nhl_player_id: playerId,
          p_season: league.season - 1,
          p_season_type: "regular",
        }
      );

      if (totalsError) throw totalsError;

      const rows = Array.isArray(data) ? (data as SeasonTotalsRow[]) : [];
      setDetailLastSeason(rows[0] ?? null);
    } catch (caughtError) {
      console.error(caughtError);
      setDetailError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to load last season's NHL stats."
      );
    } finally {
      setDetailLoading(false);
    }
  }

  function closePlayerDetail() {
    setDetailPlayerId(null);
    setDetailLastSeason(null);
    setDetailError(null);
    setDetailLoading(false);
  }

  const teamOptions = useMemo(() => {
    const usedTeamIds = new Set(
      players
        .map((player) => player.team_id)
        .filter((teamId): teamId is number => teamId != null)
    );

    return nhlTeams
      .filter((team) => usedTeamIds.has(team.id))
      .sort((a, b) => nhlTeamLabel(a).localeCompare(nhlTeamLabel(b)));
  }, [nhlTeams, players]);

  const draftedPlayerIds = useMemo(() => {
    return new Set(
      draftPicks.map((pick) => pick.nhl_player_id)
    );
  }, [draftPicks]);

  const draftRankingByPlayerId = useMemo(() => {
    return new Map(
      draftRankings.map((ranking) => [ranking.nhl_player_id, ranking])
    );
  }, [draftRankings]);

  useEffect(() => {
    setQueueIds((current) =>
      current.filter((playerId) => !draftedPlayerIds.has(playerId))
    );
  }, [draftedPlayerIds]);

  const currentTeam =
    draft?.current_fantasy_team_id != null
      ? fantasyTeamById.get(
          draft.current_fantasy_team_id
        ) ?? null
      : null;

  const myFantasyTeam =
    fantasyTeams.find(
      (team) => team.owner_id === userId
    ) ?? null;

  const isMyTurn =
    Boolean(
      draft?.status === "drafting" &&
        currentTeam &&
        currentTeam.owner_id === userId
    );

  const canCommissionerPick =
    Boolean(
      draft?.status === "drafting" &&
        isCommissioner
    );

  const canMakePick =
    isMyTurn || canCommissionerPick;

  const filteredPlayers = useMemo(() => {
    const query = search.trim().toLowerCase();

    return players.filter((player) => {
      if (draftedPlayerIds.has(player.id)) {
        return false;
      }

      const normalizedPosition =
        normalizePosition(
          player.position,
          player.position_group
        );

      if (
        teamFilter !== "ALL" &&
        String(player.team_id ?? "FA") !== teamFilter
      ) {
        return false;
      }

      if (
        positionFilter !== "ALL" &&
        normalizedPosition !== positionFilter &&
        !(
          positionFilter === "F" &&
          ["C", "LW", "RW", "F"].includes(
            normalizedPosition
          )
        )
      ) {
        return false;
      }

      if (!query) {
        return true;
      }

      const searchable = [
        playerName(player),
        normalizedPosition,
        player.team_id != null
          ? nhlTeamLabel(nhlTeamById.get(player.team_id))
          : "FA",
        "active",
        player.status ?? "",
        player.injury_status ?? "",
      ]
        .join(" ")
        .toLowerCase();

      return searchable.includes(query);
    }).sort((a, b) => {
      const aRank = draftRankingByPlayerId.get(a.id)?.overall_rank ?? Number.MAX_SAFE_INTEGER;
      const bRank = draftRankingByPlayerId.get(b.id)?.overall_rank ?? Number.MAX_SAFE_INTEGER;
      if (aRank !== bRank) return aRank - bRank;
      return playerName(a).localeCompare(playerName(b));
    });
  }, [
    draftedPlayerIds,
    draftRankingByPlayerId,
    nhlTeamById,
    players,
    positionFilter,
    search,
    teamFilter,
  ]);

  const boardCells = useMemo<DraftBoardCell[]>(() => {
    if (!draft || draftTeams.length === 0) return [];
    const teamCount = draftTeams.length;
    const picksByOverall = new Map(draftPicks.map((pick) => [pick.overall_pick, pick]));
    const liveAssetByOverall = new Map(
      livePickAssets.filter((asset) => asset.overallPick != null).map((asset) => [Number(asset.overallPick), asset])
    );
    const cells: DraftBoardCell[] = [];

    for (let round = 1; round <= draft.rounds; round += 1) {
      for (let pickInRound = 1; pickInRound <= teamCount; pickInRound += 1) {
        const overallPick = (round - 1) * teamCount + pickInRound;
        const originalSlot = draft.draft_type === "dynasty"
          ? pickInRound
          : round % 2 === 1 ? pickInRound : teamCount - pickInRound + 1;
        const originalDraftTeam = draftTeams.find((team) => team.draft_slot === originalSlot);
        if (!originalDraftTeam) continue;

        const asset = ["redraft", "startup", "dynasty"].includes(draft.draft_type) ? liveAssetByOverall.get(overallPick) : undefined;
        const ownerId = asset?.currentFantasyTeamId ?? originalDraftTeam.fantasy_team_id;
        const originalId = asset?.originalFantasyTeamId ?? originalDraftTeam.fantasy_team_id;
        const ownerName = asset?.currentTeamName ?? fantasyTeamById.get(ownerId)?.team_name ?? `Team ${ownerId}`;
        const originalName = asset?.originalTeamName ?? fantasyTeamById.get(originalId)?.team_name ?? `Team ${originalId}`;
        const pick = picksByOverall.get(overallPick);

        cells.push({
          overallPick, round, pickInRound, draftSlot: originalSlot, fantasyTeamId: ownerId,
          teamName: asset?.isTraded ? `${ownerName} (via ${originalName})` : ownerName,
          originalFantasyTeamId: originalId, originalTeamName: originalName, isTraded: Boolean(asset?.isTraded),
          player: pick ? playerById.get(pick.nhl_player_id) ?? null : null,
          isCurrent: draft.status === "drafting" && draft.current_overall_pick === overallPick,
        });
      }
    }
    return cells;
  }, [draft, draftPicks, draftTeams, fantasyTeamById, playerById, livePickAssets]);


  async function runCommissionerAction(
    action:
      | "prepare"
      | "start"
      | "pause"
      | "resume"
      | "reset"
  ) {
    if (actionLoading) {
      return;
    }

    setActionLoading(true);
    setError(null);
    setMessage(null);

    try {
      let functionName:
        | "prepare_nhl_traditional_draft"
        | "commissioner_start_nhl_traditional_draft"
        | "commissioner_pause_nhl_traditional_draft"
        | "commissioner_resume_nhl_traditional_draft"
        | "commissioner_reset_nhl_traditional_draft";

      switch (action) {
        case "prepare":
          functionName =
            "prepare_nhl_traditional_draft";
          break;

        case "start":
          functionName =
            "commissioner_start_nhl_traditional_draft";
          break;

        case "pause":
          functionName =
            "commissioner_pause_nhl_traditional_draft";
          break;

        case "resume":
          functionName =
            "commissioner_resume_nhl_traditional_draft";
          break;

        case "reset":
          functionName =
            "commissioner_reset_nhl_traditional_draft";
          break;
      }

      const { data, error: rpcError } =
        await supabase.rpc(functionName, {
          p_league_id: leagueId,
        });

      if (rpcError) {
        throw rpcError;
      }

      const result =
        data && typeof data === "object"
          ? (data as RpcJson)
          : null;

      const rpcMessage =
        rpcString(result, "message") ??
        rpcString(result, "status");

      setMessage(
        rpcMessage ??
          (action === "prepare"
            ? "Draft prepared."
            : action === "start"
              ? "Draft started."
              : action === "pause"
                ? "Draft paused."
                : action === "resume"
                  ? "Draft resumed."
                  : "Draft reset.")
      );

      await loadDraft(false);
    } catch (caughtError) {
      console.error(caughtError);

      setError(
        caughtError instanceof Error
          ? caughtError.message
          : `Unable to ${action} the draft.`
      );
    } finally {
      setActionLoading(false);
    }
  }

  async function draftPlayer(player: NhlPlayerRow) {
    if (
      !draft ||
      draft.status !== "drafting" ||
      !canMakePick ||
      draftingPlayerId !== null
    ) {
      return;
    }

    const confirmed = window.confirm(
      `Draft ${playerName(player)} (${normalizePosition(
        player.position,
        player.position_group
      )}) with Pick #${draft.current_overall_pick}?`
    );

    if (!confirmed) {
      return;
    }

    setDraftingPlayerId(player.id);
    setError(null);
    setMessage(null);

    try {
      const { data, error: rpcError } =
        await supabase.rpc(
          "make_nhl_traditional_draft_pick",
          {
            p_league_id: leagueId,
            p_nhl_player_id: player.id,
          }
        );

      if (rpcError) {
        throw rpcError;
      }

      const result =
        data && typeof data === "object"
          ? (data as RpcJson)
          : null;

      const selectedName =
        rpcString(result, "playerName") ??
        playerName(player);

      setMessage(
        `${selectedName} was drafted successfully.`
      );

      await loadDraft(false);
    } catch (caughtError) {
      console.error(caughtError);

      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to make the draft pick."
      );
    } finally {
      setDraftingPlayerId(null);
    }
  }

  async function saveMyRankings(nextIds: number[]) {
    if (!myFantasyTeam || !draft || rankingBusy) return;
    setRankingBusy(true);
    setError(null);
    try {
      const payload = nextIds.map((nhlPlayerId, index) => ({
        nhlPlayerId,
        rank: index + 1,
      }));
      const { error: saveError } = await supabase.rpc(
        "save_nhl_traditional_my_draft_rankings",
        {
          p_league_id: leagueId,
          p_fantasy_team_id: myFantasyTeam.id,
          p_rankings: payload,
        }
      );
      if (saveError) throw saveError;
      setMyRankingIds(nextIds);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to save My Rankings.");
    } finally {
      setRankingBusy(false);
    }
  }

  function moveMyRanking(playerId: number, direction: -1 | 1) {
    const currentIndex = myRankingIds.indexOf(playerId);
    if (currentIndex < 0) return;
    const nextIndex = currentIndex + direction;
    if (nextIndex < 0 || nextIndex >= myRankingIds.length) return;
    const next = [...myRankingIds];
    [next[currentIndex], next[nextIndex]] = [next[nextIndex], next[currentIndex]];
    void saveMyRankings(next);
  }

  async function toggleAutoDraft() {
    if (!myFantasyTeam || !draft) return;
    setAutoBusy(true);
    setError(null);
    try {
      const next = !autoDraftEnabled;
      const { error: prefError } = await supabase.rpc("set_nhl_traditional_auto_draft", {
        p_league_id: leagueId,
        p_fantasy_team_id: myFantasyTeam.id,
        p_enabled: next,
      });
      if (prefError) throw prefError;
      setAutoDraftEnabled(next);
      autoAttemptRef.current = null;
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to change Auto Draft.");
    } finally {
      setAutoBusy(false);
    }
  }

  function playDraftSound(kind: "start" | "turn" | "countdown" | "queue") {
    if (!soundEnabled || typeof window === "undefined") return;
    try {
      const AudioCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtor) return;
      const ctx = audioContextRef.current ?? new AudioCtor();
      audioContextRef.current = ctx;
      if (ctx.state === "suspended") void ctx.resume();
      const now = ctx.currentTime;
      const notes = kind === "start" ? [523, 659, 784] : kind === "turn" ? [784, 988] : kind === "queue" ? [440, 330] : [880];
      notes.forEach((frequency, index) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = kind === "countdown" ? "square" : "sine";
        osc.frequency.value = frequency;
        gain.gain.setValueAtTime(0.0001, now + index * 0.09);
        gain.gain.exponentialRampToValueAtTime(0.12, now + index * 0.09 + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.09 + 0.13);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + index * 0.09);
        osc.stop(now + index * 0.09 + 0.14);
      });
    } catch {
      // Audio is optional; browser autoplay rules may block it until a user gesture.
    }
  }

  const leagueFormat =
    settings?.league_format === "dynasty" ? "Dynasty" : "Redraft";

  const positionMode =
    settings?.position_mode === "fdg" ? "F / D / G" : "C / LW / RW / D / G";

  const positionFilters =
    settings?.position_mode === "fdg"
      ? ["ALL", "F", "D", "G"]
      : ["ALL", "C", "LW", "RW", "D", "G"];

  const totalPicks = draft ? draft.rounds * draftTeams.length : 0;

  const currentPickExpiresAt = (() => {
    if (!draft || draft.status !== "drafting") return null;
    if (!draft.current_pick_expires_at) return null;

    const parsed = Date.parse(draft.current_pick_expires_at);

    return Number.isFinite(parsed) ? parsed : null;
  })();

  const timerEnabled = Boolean(draft && draft.seconds_per_pick > 0);

  const remainingSeconds =
    draft &&
    draft.status === "drafting" &&
    timerEnabled &&
    currentPickExpiresAt != null
      ? Math.max(
          0,
          Math.ceil((currentPickExpiresAt - nowMs) / 1000)
        )
      : draft?.seconds_per_pick ?? 0;

  const clockText = timerEnabled
    ? `${Math.floor(remainingSeconds / 60)}:${String(
        remainingSeconds % 60
      ).padStart(2, "0")}`
    : "NO TIMER";

  useEffect(() => {
    const saved = window.localStorage.getItem("g365-nhl-draft-sound");
    if (saved === "off") setSoundEnabled(false);
  }, []);

  useEffect(() => {
    if (!draft) return;
    const previous = previousDraftStatusRef.current;
    if (previous && previous !== "drafting" && draft.status === "drafting") playDraftSound("start");
    previousDraftStatusRef.current = draft.status;
  }, [draft?.status]);

  useEffect(() => {
    if (isMyTurn) playDraftSound("turn");
  }, [isMyTurn, draft?.current_overall_pick]);

  useEffect(() => {
    if (!draft || draft.status !== "drafting" || remainingSeconds < 1 || remainingSeconds > 10) return;
    const key = `${draft.id}:${draft.current_overall_pick}:${remainingSeconds}`;
    if (countdownSoundRef.current === key) return;
    countdownSoundRef.current = key;
    playDraftSound("countdown");
  }, [draft?.id, draft?.status, draft?.current_overall_pick, remainingSeconds]);

  useEffect(() => {
    const previous = previousPickIdsRef.current;
    const newPicks = draftPicks.filter((pick) => !previous.has(pick.id));
    if (previous.size > 0 && newPicks.some((pick) => queueIds.includes(pick.nhl_player_id) && pick.fantasy_team_id !== myFantasyTeam?.id)) {
      playDraftSound("queue");
    }
    previousPickIdsRef.current = new Set(draftPicks.map((pick) => pick.id));
  }, [draftPicks]);

  useEffect(() => {
    if (!draft || draft.status !== "drafting" || !myFantasyTeam) {
      setAutoCandidate(null);
      return;
    }
    if (draft.current_fantasy_team_id !== myFantasyTeam.id) {
      setAutoCandidate(null);
      return;
    }
    let cancelled = false;
    void supabase.rpc("get_nhl_traditional_auto_draft_candidate", {
      p_league_id: leagueId,
      p_fantasy_team_id: myFantasyTeam.id,
    }).then(({ data, error: candidateError }) => {
      if (!cancelled && !candidateError && data && typeof data === "object") {
        setAutoCandidate(data as AutoDraftCandidate);
      }
    });
    return () => { cancelled = true; };
  }, [draft?.id, draft?.status, draft?.current_overall_pick, draft?.current_fantasy_team_id, myFantasyTeam?.id, leagueId]);

  useEffect(() => {
    if (!draft || draft.status !== "drafting" || autoBusy) return;
    const currentDraftTeam = draftTeams.find((team) => team.fantasy_team_id === draft.current_fantasy_team_id);
    const shouldRun = remainingSeconds === 0 || Boolean(currentDraftTeam?.is_cpu) || (isMyTurn && autoDraftEnabled);
    if (!shouldRun) return;
    const key = `${draft.id}:${draft.current_overall_pick}`;
    if (autoAttemptRef.current === key) return;
    autoAttemptRef.current = key;
    setAutoBusy(true);
    void supabase.rpc("run_nhl_traditional_auto_draft_pick", {
      p_league_id: leagueId,
      p_expected_overall_pick: draft.current_overall_pick,
    }).then(async ({ data, error: autoError }) => {
      if (autoError) {
        setError(autoError.message);
        autoAttemptRef.current = null;
      } else {
        const result = data && typeof data === "object" ? (data as RpcJson) : null;
        if (result?.picked === true) {
          setMessage(`${String(result.playerName ?? "Player")} was auto drafted.`);
          await loadDraft(false);
        } else if (remainingSeconds === 0) {
          autoAttemptRef.current = null;
        }
      }
      setAutoBusy(false);
    });
  }, [draft?.id, draft?.status, draft?.current_overall_pick, draft?.current_fantasy_team_id, remainingSeconds, autoDraftEnabled, isMyTurn, draftTeams, autoBusy, leagueId, loadDraft]);

  const myFuturePicks =
    draft && myFantasyTeam
      ? boardCells.filter(
          (cell) =>
            cell.fantasyTeamId === myFantasyTeam.id &&
            !cell.player &&
            cell.overallPick >= draft.current_overall_pick
        )
      : [];

  const nextMyPick = myFuturePicks[0] ?? null;
  const picksUntilMine =
    draft && nextMyPick
      ? Math.max(0, nextMyPick.overallPick - draft.current_overall_pick)
      : null;

  const queuedPlayers = queueIds
    .map((id) => playerById.get(id))
    .filter((player): player is NhlPlayerRow => Boolean(player));

  const rankingPlayers = myRankingIds
    .filter((id) => !draftedPlayerIds.has(id))
    .map((id) => playerById.get(id))
    .filter((player): player is NhlPlayerRow => Boolean(player));

  const rosterTeamId =
    selectedRosterTeamId ?? myFantasyTeam?.id ?? draftTeams[0]?.fantasy_team_id ?? null;

  const rosterTeam = rosterTeamId == null ? null : fantasyTeamById.get(rosterTeamId) ?? null;

  const rosterPicks =
    rosterTeamId == null
      ? []
      : draftPicks.filter((pick) => pick.fantasy_team_id === rosterTeamId);

  const rosterSlots = (() => {
    const rs = rosterSettings;
    if ((settings?.position_mode ?? "detailed").toLowerCase() === "fdg") {
      return [
        { key: "F", label: "F", target: rs?.starting_f ?? 8 },
        { key: "D", label: "D", target: rs?.starting_d ?? 4 },
        { key: "G", label: "G", target: rs?.starting_g ?? 2 },
        { key: "UTIL", label: "UTIL", target: rs?.starting_util ?? 1 },
        { key: "BENCH", label: "BENCH", target: rs?.bench_slots ?? 5 },
      ];
    }
    return [
      { key: "C", label: "C", target: rs?.starting_c ?? 2 },
      { key: "LW", label: "LW", target: rs?.starting_lw ?? 2 },
      { key: "RW", label: "RW", target: rs?.starting_rw ?? 2 },
      { key: "D", label: "D", target: rs?.starting_d ?? 4 },
      { key: "G", label: "G", target: rs?.starting_g ?? 2 },
      { key: "UTIL", label: "UTIL", target: rs?.starting_util ?? 1 },
      { key: "BENCH", label: "BENCH", target: rs?.bench_slots ?? 5 },
    ];
  })();

  const rosterAssignments = (() => {
    const assigned: Record<string, NhlPlayerRow[]> = {};
    for (const slot of rosterSlots) assigned[slot.key] = [];

    const targetFor = (key: string) => rosterSlots.find((slot) => slot.key === key)?.target ?? 0;
    const isFdg = (settings?.position_mode ?? "detailed").toLowerCase() === "fdg";

    for (const pick of [...rosterPicks].sort((a, b) => a.overall_pick - b.overall_pick)) {
      const player = playerById.get(pick.nhl_player_id);
      if (!player) continue;
      const pos = normalizePosition(player.position, player.position_group);
      const natural = isFdg && ["C", "LW", "RW", "F"].includes(pos) ? "F" : pos;

      if (assigned[natural] && assigned[natural].length < targetFor(natural)) {
        assigned[natural].push(player);
        continue;
      }

      if (natural !== "G" && assigned.UTIL && assigned.UTIL.length < targetFor("UTIL")) {
        assigned.UTIL.push(player);
        continue;
      }

      if (assigned.BENCH && assigned.BENCH.length < targetFor("BENCH")) {
        assigned.BENCH.push(player);
      }
    }

    return assigned;
  })();

  const rpcRows = (data: unknown): RpcJson[] => {
    if (Array.isArray(data)) return data as RpcJson[];
    if (!data || typeof data !== "object") return [];
    const row = data as RpcJson;
    for (const key of ["items", "conversations", "offers", "tradeBlock", "trade_block", "trades", "messages"]) {
      if (Array.isArray(row[key])) return row[key] as RpcJson[];
    }
    return [];
  };
  const numField = (row: RpcJson, ...keys: string[]) => { for (const key of keys) { const n = Number(row[key]); if (Number.isFinite(n)) return n; } return null; };
  const strField = (row: RpcJson, ...keys: string[]) => { for (const key of keys) { const v = row[key]; if (typeof v === "string") return v; } return ""; };


  const numberArrayField = (row: RpcJson, ...keys: string[]) => {
    for (const key of keys) {
      const value = row[key];
      if (!Array.isArray(value)) continue;
      return value
        .map((item) => {
          if (typeof item === "number") return item;
          if (typeof item === "string" && item.trim() !== "") {
            const parsed = Number(item);
            return Number.isFinite(parsed) ? parsed : null;
          }
          if (item && typeof item === "object") {
            const objectItem = item as RpcJson;
            return numField(
              objectItem,
              "nhl_player_id",
              "nhlPlayerId",
              "draft_pick_asset_id",
              "draftPickAssetId",
              "id",
            );
          }
          return null;
        })
        .filter((id): id is number => id != null);
    }
    return [];
  };

  const offerPlayerIds = (offer: RpcJson, side: "offered" | "requested") =>
    numberArrayField(
      offer,
      `${side}_player_ids`,
      `${side}PlayerIds`,
      `${side}_players`,
      `${side}Players`,
    );

  const offerPickIds = (offer: RpcJson, side: "offered" | "requested") =>
    numberArrayField(
      offer,
      `${side}_draft_pick_asset_ids`,
      `${side}DraftPickAssetIds`,
      `${side}_draft_picks`,
      `${side}DraftPicks`,
      `${side}_picks`,
      `${side}Picks`,
    );

  const tradePlayerLabel = (playerId: number) => {
    const player = playerById.get(playerId);
    if (player) {
      return `${playerName(player)} • ${normalizePosition(player.position, player.position_group)}`;
    }
    const asset = [...myTradeAssets.players, ...theirTradeAssets.players].find(
      (row) => row.nhlPlayerId === playerId,
    );
    return asset ? `${asset.playerName} • ${asset.position}` : `Player #${playerId}`;
  };

  const tradePickLabel = (pickId: number) => {
    const asset = [...myTradeAssets.draftPicks, ...theirTradeAssets.draftPicks].find(
      (row) => row.draftPickAssetId === pickId,
    );
    if (asset) {
      return `${asset.draftSeason} Round ${asset.roundNumber}${asset.overallPick ? ` • #${asset.overallPick}` : ""}${asset.isTraded ? ` • via ${asset.originalTeamName}` : ""}`;
    }
    const live = livePickAssets.find((row) => row.draftPickAssetId === pickId);
    if (live) {
      return `${draft?.season ?? league?.season ?? ""} Round ${live.roundNumber}${live.overallPick ? ` • #${live.overallPick}` : ""}${live.isTraded ? ` • via ${live.originalTeamName}` : ""}`;
    }
    return `Draft Pick #${pickId}`;
  };

  const pendingAssetsForOffer = (offerId: number) =>
    pendingOfferAssets.filter(
      (row) => numField(row, "trade_offer_id", "tradeOfferId") === offerId,
    );

  const pendingPlayerIds = (offerId: number, fromTeamId: number | null) =>
    pendingAssetsForOffer(offerId)
      .filter(
        (row) =>
          strField(row, "asset_type", "assetType") === "player" &&
          (fromTeamId == null ||
            numField(row, "from_fantasy_team_id", "fromFantasyTeamId") === fromTeamId),
      )
      .map((row) => numField(row, "nhl_player_id", "nhlPlayerId"))
      .filter((id): id is number => id != null);

  const pendingPickIds = (offerId: number, fromTeamId: number | null) =>
    pendingAssetsForOffer(offerId)
      .filter(
        (row) =>
          strField(row, "asset_type", "assetType") === "draft_pick" &&
          (fromTeamId == null ||
            numField(row, "from_fantasy_team_id", "fromFantasyTeamId") === fromTeamId),
      )
      .map((row) => numField(row, "draft_pick_asset_id", "draftPickAssetId"))
      .filter((id): id is number => id != null);

  const tradeNeedLabel = (need: string) => ({
    C: "Center",
    LW: "Left Wing",
    RW: "Right Wing",
    F: "Forward",
    D: "Defense",
    G: "Goalie",
    PICKS: "Draft Picks",
    PROSPECTS: "Prospects / Young Players",
  }[need] ?? need);

  const toggleTradeNeed = (need: string) =>
    setMyTradeNeeds((current) =>
      current.includes(need)
        ? current.filter((value) => value !== need)
        : [...current, need],
    );

  async function saveTradeNeeds() {
    if (!myFantasyTeam) return;
    setTradeNeedsBusy(true);
    setError(null);
    try {
      const result = await supabase.rpc("set_nhl_trade_block_needs", {
        p_league_id: leagueId,
        p_fantasy_team_id: myFantasyTeam.id,
        p_needs: myTradeNeeds,
      });
      if (result.error) throw result.error;
      setMessage("Trade Block updated.");
      await loadTradeHub();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to update the Trade Block.");
    } finally {
      setTradeNeedsBusy(false);
    }
  }

  function beginCounterOffer(offer: RpcJson) {
    if (!myFantasyTeam) return;
    const id = numField(offer, "trade_offer_id", "id");
    const proposer = numField(offer, "proposing_fantasy_team_id", "proposingFantasyTeamId");
    const receiver = numField(offer, "receiving_fantasy_team_id", "receivingFantasyTeamId");
    if (id == null || proposer == null || receiver == null) return;

    const otherTeamId = proposer === myFantasyTeam.id ? receiver : proposer;
    const offeredPlayers = pendingPlayerIds(id, proposer);
    const requestedPlayers = pendingPlayerIds(id, receiver);
    const offeredPicks = pendingPickIds(id, proposer);
    const requestedPicks = pendingPickIds(id, receiver);

    // A counter is from my perspective, so reverse the original proposal when I was the receiver.
    const iWasReceiver = receiver === myFantasyTeam.id;
    setOfferMinePlayers(iWasReceiver ? requestedPlayers : offeredPlayers);
    setOfferTheirPlayers(iWasReceiver ? offeredPlayers : requestedPlayers);
    setOfferMinePicks(iWasReceiver ? requestedPicks : offeredPicks);
    setOfferTheirPicks(iWasReceiver ? offeredPicks : requestedPicks);
    setCounteringOfferId(id);
    setTradeSection("teams");
    void openTradeTeam(otherTeamId);
  }

  const loadTradeHub = useCallback(async () => {
    if (!myFantasyTeam) return;
    const [c, p, pa, b, u, sm] = await Promise.all([
      supabase.rpc("get_nhl_trade_conversations", { p_league_id: leagueId, p_fantasy_team_id: myFantasyTeam.id }),
      supabase.rpc("get_nhl_pending_trade_offers", { p_league_id: leagueId, p_fantasy_team_id: myFantasyTeam.id }),
      supabase.rpc("get_nhl_pending_trade_offer_assets", { p_league_id: leagueId, p_fantasy_team_id: myFantasyTeam.id }),
      supabase.rpc("get_nhl_trade_block_needs", { p_league_id: leagueId, p_fantasy_team_id: myFantasyTeam.id }),
      supabase.rpc("get_nhl_trade_chat_unread_count", { p_league_id: leagueId, p_fantasy_team_id: myFantasyTeam.id }),
      supabase.rpc("get_nhl_completed_trade_summary", { p_league_id: leagueId, p_fantasy_team_id: myFantasyTeam.id }),
    ]);
    for (const result of [c,p,pa,b,u,sm]) if (result.error) throw result.error;
    setConversations(rpcRows(c.data));
    setPendingOffers(rpcRows(p.data));
    setPendingOfferAssets(rpcRows(pa.data));
    const blockRows = rpcRows(b.data);
    setTradeBlock(blockRows);
    const mine = blockRows.find((row) => numField(row, "fantasy_team_id", "fantasyTeamId") === myFantasyTeam.id);
    const needs = mine?.needs;
    setMyTradeNeeds(Array.isArray(needs) ? needs.map((value) => String(value)) : []);
    setTradeSummary(rpcRows(sm.data));
    const unreadValue = typeof u.data === "number" ? u.data : Number((u.data as RpcJson | null)?.unreadCount ?? (u.data as RpcJson | null)?.unread_count ?? 0);
    setChatUnread(Number.isFinite(unreadValue) ? unreadValue : 0);
  }, [leagueId, myFantasyTeam?.id]);

  const incomingTradeOfferCount = pendingOffers.filter((offer) =>
    numField(offer, "receiving_fantasy_team_id", "receivingFantasyTeamId") === myFantasyTeam?.id
  ).length;

  const tradeAttentionCount = chatUnread + incomingTradeOfferCount;

  const unreadForTradeTeam = (teamId: number) => {
    const row = conversations.find((conversation) => {
      const otherId = numField(
        conversation,
        "other_fantasy_team_id",
        "otherFantasyTeamId",
        "other_team_id",
        "otherTeamId",
        "fantasy_team_id",
        "fantasyTeamId",
      );
      return otherId === teamId;
    });
    if (!row) return 0;
    const unread = numField(row, "unread_count", "unreadCount", "unread_messages", "unreadMessages") ?? 0;
    return Math.max(0, unread);
  };

  useEffect(() => {
    const node = chatListRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [chatMessages, selectedTradeTeamId]);

  useEffect(() => {
    if (!myFantasyTeam) return;
    void loadTradeHub().catch((e) => console.error(e));
    const interval = window.setInterval(() => void loadTradeHub().catch((e) => console.error(e)), 5000);
    return () => window.clearInterval(interval);
  }, [myFantasyTeam?.id, loadTradeHub]);

  async function openTradeTeam(teamId: number) {
    if (!myFantasyTeam || teamId === myFantasyTeam.id) return;
    setTradeBusy(true); setError(null); setSelectedTradeTeamId(teamId);
    try {
      const [conv, mine, theirs] = await Promise.all([
        supabase.rpc("get_or_create_nhl_trade_conversation", { p_league_id: leagueId, p_fantasy_team_id: myFantasyTeam.id, p_other_fantasy_team_id: teamId }),
        supabase.rpc("get_nhl_trade_builder_assets", { p_league_id: leagueId, p_requesting_fantasy_team_id: myFantasyTeam.id, p_asset_fantasy_team_id: myFantasyTeam.id }),
        supabase.rpc("get_nhl_trade_builder_assets", { p_league_id: leagueId, p_requesting_fantasy_team_id: myFantasyTeam.id, p_asset_fantasy_team_id: teamId }),
      ]);
      for (const result of [conv,mine,theirs]) if (result.error) throw result.error;
      const cid = Number(conv.data);
      setConversationId(cid);
      const mineData = (mine.data ?? {}) as RpcJson, theirData = (theirs.data ?? {}) as RpcJson;
      setMyTradeAssets({ players: (mineData.players as TradeAssetPlayer[]) ?? [], draftPicks: (mineData.draftPicks as TradeAssetPick[]) ?? [] });
      setTheirTradeAssets({ players: (theirData.players as TradeAssetPlayer[]) ?? [], draftPicks: (theirData.draftPicks as TradeAssetPick[]) ?? [] });
      const msgs = await supabase.rpc("get_nhl_trade_messages", { p_conversation_id: cid, p_limit: 100 });
      if (msgs.error) throw msgs.error;
      setChatMessages(rpcRows(msgs.data));
      await supabase.rpc("mark_nhl_trade_conversation_read", { p_conversation_id: cid, p_fantasy_team_id: myFantasyTeam.id });
      await loadTradeHub();
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to open trade conversation."); }
    finally { setTradeBusy(false); }
  }

  async function sendTradeChat() {
    if (!myFantasyTeam || !conversationId || !chatBody.trim()) return;
    setTradeBusy(true); setError(null);
    try {
      const r = await supabase.rpc("send_nhl_trade_message", { p_conversation_id: conversationId, p_sender_fantasy_team_id: myFantasyTeam.id, p_body: chatBody.trim() });
      if (r.error) throw r.error; setChatBody("");
      const msgs = await supabase.rpc("get_nhl_trade_messages", { p_conversation_id: conversationId, p_limit: 100 });
      if (msgs.error) throw msgs.error; setChatMessages(rpcRows(msgs.data)); await loadTradeHub();
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to send message."); }
    finally { setTradeBusy(false); }
  }

  async function submitTradeOffer() {
    if (!myFantasyTeam || !selectedTradeTeamId) return;
    if (![offerMinePlayers.length, offerTheirPlayers.length, offerMinePicks.length, offerTheirPicks.length].some(Boolean)) { setError("Select at least one trade asset."); return; }
    setTradeBusy(true); setError(null);
    try {
      const r = counteringOfferId == null
        ? await supabase.rpc("submit_nhl_traditional_trade_offer", {
            p_league_id: leagueId, p_proposing_fantasy_team_id: myFantasyTeam.id, p_receiving_fantasy_team_id: selectedTradeTeamId,
            p_offered_player_ids: offerMinePlayers, p_requested_player_ids: offerTheirPlayers,
            p_offered_draft_pick_asset_ids: offerMinePicks, p_requested_draft_pick_asset_ids: offerTheirPicks, p_message: null,
          })
        : await supabase.rpc("counter_nhl_traditional_trade_offer", {
            p_trade_offer_id: counteringOfferId, p_countering_fantasy_team_id: myFantasyTeam.id,
            p_offered_player_ids: offerMinePlayers, p_requested_player_ids: offerTheirPlayers,
            p_offered_draft_pick_asset_ids: offerMinePicks, p_requested_draft_pick_asset_ids: offerTheirPicks, p_message: null,
          });
      if (r.error) throw r.error;
      const wasCounter = counteringOfferId != null;
      setOfferMinePlayers([]); setOfferTheirPlayers([]); setOfferMinePicks([]); setOfferTheirPicks([]); setCounteringOfferId(null); setMessage(wasCounter ? "Counter offer sent." : "Trade offer sent.");
      await openTradeTeam(selectedTradeTeamId); await loadDraft(false);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to send trade offer."); }
    finally { setTradeBusy(false); }
  }

  async function actOnOffer(offerId: number, action: "accept" | "reject" | "cancel") {
    if (!myFantasyTeam) return;
    setTradeBusy(true); setError(null);
    try {
      const name = action === "accept" ? "accept_nhl_traditional_trade_offer" : action === "reject" ? "reject_nhl_traditional_trade_offer" : "cancel_nhl_traditional_trade_offer";
      const args = action === "cancel" ? { p_trade_offer_id: offerId, p_proposing_fantasy_team_id: myFantasyTeam.id } : { p_trade_offer_id: offerId, p_receiving_fantasy_team_id: myFantasyTeam.id };
      const r = await supabase.rpc(name, args); if (r.error) throw r.error;
      setMessage(`Trade offer ${action === "accept" ? "accepted" : action === "reject" ? "rejected" : "cancelled"}.`);
      await Promise.all([loadTradeHub(), loadDraft(false)]);
    } catch (e) { setError(e instanceof Error ? e.message : `Unable to ${action} trade offer.`); }
    finally { setTradeBusy(false); }
  }

  const toggleId = (setter: Dispatch<SetStateAction<number[]>>, id: number) => setter((xs) => xs.includes(id) ? xs.filter((x) => x !== id) : [...xs,id]);

  function toggleQueue(playerId: number) {
    setQueueIds((current) =>
      current.includes(playerId)
        ? current.filter((id) => id !== playerId)
        : [...current, playerId]
    );
  }

  if (loading) {
    return (
      <main style={styles.page}>
        <div style={styles.loadingCard}>Loading NHL Draft...</div>
      </main>
    );
  }

  if (!league) {
    return (
      <main style={styles.page}>
        <div style={styles.errorBox}>NHL Traditional league was not found.</div>
      </main>
    );
  }

  return (
    <main className="g365-nhl-draft-page" style={styles.page}>
      <style>{`
        .g365-draft-mobile-tab-select, .g365-trade-mobile-tab-select { display:none; }
        @media (min-width: 721px) {
          .g365-mobile-collapse:not([open]) > .g365-mobile-collapse-body { display:block !important; }
          .g365-mobile-collapse-chevron { display:none !important; }
          .g365-mobile-collapse-summary { cursor:default !important; }
        }
        @media (max-width: 1050px) {
          .g365-nhl-draft-room { grid-template-columns: 1fr !important; }
          .g365-nhl-draft-left, .g365-nhl-draft-right { display: block !important; }
        }
        @media (max-width: 720px) {
          .g365-nhl-draft-page,
          .g365-nhl-draft-shell,
          .g365-nhl-draft-room,
          .g365-nhl-draft-left,
          .g365-nhl-draft-right {
            width: 100% !important;
            max-width: 100% !important;
            min-width: 0 !important;
          }
          .g365-nhl-draft-page { overflow-x: hidden !important; }

          /* Mobile order: Draft History -> Rosters -> Draft workspace. */
          .g365-nhl-draft-left { order: 1 !important; }
          .g365-nhl-draft-right { order: 2 !important; }
          .g365-nhl-draft-room > section { order: 3 !important; }

          .g365-nhl-draft-room > *,
          .g365-nhl-draft-left > *,
          .g365-nhl-draft-right > * {
            min-width: 0 !important;
            max-width: 100% !important;
          }
          .g365-nhl-trade-layout { grid-template-columns: 1fr !important; }
          .g365-nhl-player-head { grid-template-columns: 30px minmax(0,1fr) 36px 58px 54px 54px !important; gap: 4px !important; padding-left: 5px !important; padding-right: 5px !important; }
          .g365-nhl-player-row { grid-template-columns: 30px minmax(0,1fr) 36px 58px 54px 54px !important; gap: 4px !important; padding-left: 5px !important; padding-right: 5px !important; }
          .g365-nhl-player-head { display:none !important; }
          .g365-nhl-player-row {
            grid-template-columns:42px minmax(0,1fr) auto !important;
            grid-template-areas:"rank player fp" "rank actions actions" !important;
            gap:8px 10px !important; padding:12px 10px !important; align-items:center !important;
          }
          .g365-player-rank { grid-area:rank; }
          .g365-player-identity { grid-area:player; }
          .g365-player-pos, .g365-player-team { display:none !important; }
          .g365-player-fp { grid-area:fp; font-size:15px !important; }
          .g365-player-queue { grid-area:actions; justify-self:start; min-height:44px !important; min-width:92px; }
          .g365-player-draft { grid-area:actions; justify-self:end; min-height:44px !important; min-width:82px; }
          .g365-player-name { white-space:normal !important; overflow:visible !important; text-overflow:clip !important; font-size:14px !important; line-height:1.15; }
          .g365-draft-desktop-tabs { display:none !important; }
          .g365-draft-mobile-tab-select { display:block !important; width:100%; min-height:48px; margin:0 0 10px; padding:0 12px; border:1px solid #3a3a40; border-radius:10px; background:#121214; color:#fff; font-size:16px; font-weight:900; }
          .g365-trade-desktop-tabs { display:none !important; }
          .g365-trade-mobile-tab-select { display:block !important; width:100%; min-height:48px; margin-bottom:10px; padding:0 12px; border:1px solid #4b2a1f; border-radius:10px; background:#151113; color:#fff; font-size:16px; font-weight:900; }
          .g365-nhl-trade-layout { min-height:0 !important; }
          .g365-draft-workspace { overflow:visible !important; }

          /* Compact mobile draft ticker: show several picks at once. */
          .g365-draft-ticker-shell {
            display:block !important;
            overflow:hidden !important;
          }
          .g365-draft-ticker-label {
            min-height:32px !important;
            width:100% !important;
            flex:none !important;
            padding:6px 10px !important;
            border-right:0 !important;
            border-bottom:1px solid #2b2b30 !important;
            justify-content:flex-start !important;
            font-size:10px !important;
          }
          .g365-draft-ticker-scroller {
            display:grid !important;
            grid-auto-flow:column !important;
            grid-auto-columns:72px !important;
            gap:6px !important;
            overflow-x:auto !important;
            padding:7px !important;
            scroll-snap-type:x proximity;
          }
          .g365-draft-ticker-pick {
            width:72px !important;
            min-width:72px !important;
            max-width:72px !important;
            min-height:72px !important;
            padding:6px 4px !important;
            gap:3px !important;
            border:1px solid #29292d !important;
            border-radius:8px !important;
            display:flex !important;
            flex-direction:column !important;
            justify-content:center !important;
            align-items:center !important;
            text-align:center !important;
            scroll-snap-align:start;
          }
          .g365-draft-ticker-number {
            width:24px !important;
            height:24px !important;
            flex:0 0 24px !important;
            font-size:10px !important;
          }
          .g365-draft-ticker-info {
            width:100% !important;
            align-items:center !important;
            gap:1px !important;
          }
          .g365-draft-ticker-primary,
          .g365-draft-ticker-secondary {
            display:block !important;
            width:100% !important;
            overflow:hidden !important;
            text-overflow:ellipsis !important;
            white-space:nowrap !important;
            text-align:center !important;
          }
          .g365-draft-ticker-primary { font-size:8px !important; }
          .g365-draft-ticker-secondary { font-size:7px !important; }

          /* Draft History and Rosters are collapsed mobile sections. */
          .g365-mobile-collapse { width:100% !important; }
          .g365-mobile-collapse-summary {
            cursor:pointer !important;
            list-style:none !important;
            user-select:none;
          }
          .g365-mobile-collapse-summary::-webkit-details-marker { display:none; }
          .g365-mobile-collapse-meta {
            display:flex;
            align-items:center;
            gap:8px;
          }
          .g365-mobile-collapse-chevron {
            display:inline-grid;
            place-items:center;
            width:28px;
            height:28px;
            border-radius:7px;
            border:1px solid #34343a;
            color:#ff7a28;
            font-size:18px;
            line-height:1;
            transition:transform .18s ease;
          }
          .g365-mobile-collapse[open] .g365-mobile-collapse-chevron {
            transform:rotate(180deg);
          }

          /* My Rankings becomes a mobile card grid instead of a clipped desktop table. */
          .g365-my-rankings-scroll {
            overflow:visible !important;
            width:100% !important;
          }
          .g365-my-rankings-table {
            min-width:0 !important;
            width:100% !important;
          }
          .g365-my-rankings-head { display:none !important; }
          .g365-my-ranking-row {
            display:grid !important;
            grid-template-columns:36px minmax(0,1fr) auto auto !important;
            grid-template-areas:
              "rank player player player"
              "rank team pos fp"
              "rank fppg actions actions" !important;
            gap:8px 10px !important;
            width:100% !important;
            min-width:0 !important;
            padding:12px 10px !important;
            border-top:1px solid #29292d !important;
            align-items:center !important;
          }
          .g365-my-ranking-number {
            grid-area:rank;
            align-self:stretch;
            display:grid !important;
            place-items:center !important;
            font-size:20px !important;
          }
          .g365-my-ranking-player { grid-area:player; min-width:0 !important; }
          .g365-my-ranking-team { grid-area:team; text-align:left !important; }
          .g365-my-ranking-pos { grid-area:pos; text-align:left !important; }
          .g365-my-ranking-fp { grid-area:fp; text-align:right !important; }
          .g365-my-ranking-fppg {
            grid-area:fppg;
            text-align:left !important;
          }
          .g365-my-ranking-fp::before { content:"FP "; color:#7d818a; font-size:9px; }
          .g365-my-ranking-fppg::before { content:"FPPG "; color:#7d818a; font-size:9px; }
          .g365-my-ranking-actions {
            grid-area:actions;
            justify-self:end;
            display:flex !important;
            flex-wrap:wrap !important;
            justify-content:flex-end !important;
            gap:5px !important;
            min-width:0 !important;
          }
          .g365-my-ranking-actions button {
            min-height:38px !important;
          }

          .g365-draft-topbar { padding:18px 16px !important; }
          .g365-draft-title { font-size:34px !important; }
        }
        @media (max-width: 430px) {
          .g365-nhl-player-row { grid-template-columns:38px minmax(0,1fr) auto !important; padding:11px 8px !important; }
          .g365-draft-title { font-size:30px !important; }
        }
      `}</style>
      <div style={styles.container}>
        <section className="g365-draft-topbar" style={styles.topBar}>
          <div style={styles.brandBlock}>
            <div style={styles.eyebrow}>GRIDIRON365 • NHL TRADITIONAL</div>
            <div style={styles.draftTitleRow}>
              <h1 className="g365-draft-title" style={styles.title}>Live Draft</h1>
              <span style={styles.formatPill}>{leagueFormat}</span>
            </div>
            <div style={styles.subtitle}>
              {league.name} • {league.season} • {positionMode}
            </div>
          </div>

          <div style={styles.statusBadge}>
            {formatDraftStatus(draft?.status ?? null)}
          </div>
        </section>

        {error ? <div style={styles.errorBox}>{error}</div> : null}
        {message ? <div style={styles.successBox}>{message}</div> : null}

        {!draft ? (
          <section style={styles.emptyCard}>
            <div style={styles.emptyTitle}>Draft has not been prepared</div>
            <div style={styles.emptyText}>
              Prepare the draft to generate the NHL snake-order board and draft
              slots for this league.
            </div>
            {isCommissioner ? (
              <button
                type="button"
                style={styles.primaryButton}
                disabled={actionLoading}
                onClick={() => void runCommissionerAction("prepare")}
              >
                {actionLoading ? "Preparing..." : "Prepare Draft"}
              </button>
            ) : (
              <div style={styles.mutedText}>
                Waiting for the commissioner to prepare the draft.
              </div>
            )}
          </section>
        ) : (
          <>
            <section style={styles.clockStrip}>
              <div style={styles.clockTeamBlock}>
                <div style={styles.clockLabel}>ON THE CLOCK</div>
                <div style={styles.clockTeamName}>
                  {draft.status === "completed"
                    ? "DRAFT COMPLETE"
                    : currentTeam?.team_name ?? "—"}
                </div>
                <div style={styles.clockMeta}>
                  Round {draft.current_round} • Pick {draft.current_pick_in_round} •
                  Overall #{draft.current_overall_pick}
                </div>
              </div>

              <div style={styles.clockCenter}>
                <div style={styles.clockLabel}>
                  {draft.status === "drafting" ? "PICK CLOCK" : "CLOCK"}
                </div>
                <div style={styles.clockValue}>
                  {draft.status === "completed" ? "FINAL" : clockText}
                </div>
                <div style={styles.clockMeta}>
                  {timerEnabled ? `${draft.seconds_per_pick}-second selections` : "No pick timer"}
                </div>
              </div>

              <div style={styles.nextPickBlock}>
                <div style={styles.clockLabel}>YOUR NEXT PICK</div>
                <div style={styles.nextPickValue}>
                  {nextMyPick ? `#${nextMyPick.overallPick}` : "—"}
                </div>
                <div
                  style={{
                    ...styles.clockMeta,
                    fontWeight: 950,
                    color:
                      picksUntilMine === 0
                        ? "#22c55e"
                        : picksUntilMine != null && picksUntilMine <= 3
                          ? "#fb923c"
                          : "#f8fafc",
                  }}
                >
                  {picksUntilMine == null
                    ? "NO UPCOMING PICK"
                    : picksUntilMine === 0
                      ? "YOU ARE ON THE CLOCK"
                      : picksUntilMine === 1
                        ? "1 PICK UNTIL YOUR PICK"
                        : `${picksUntilMine} PICKS UNTIL YOUR PICK`}
                </div>
              </div>

              <div style={styles.progressBlock}>
                <div style={styles.clockLabel}>DRAFT PROGRESS</div>
                <div style={styles.progressValue}>
                  {draftPicks.length} / {totalPicks}
                </div>
                <div style={styles.progressTrack}>
                  <div
                    style={{
                      ...styles.progressFill,
                      width: `${totalPicks > 0 ? Math.min(100, (draftPicks.length / totalPicks) * 100) : 0}%`,
                    }}
                  />
                </div>
              </div>
            </section>

            <section style={styles.autoDraftBar}>
              <div style={styles.autoDraftInfo}>
                <span style={styles.clockLabel}>AUTO PICK</span>
                <strong style={styles.autoDraftPlayer}>
                  {autoCandidate?.exists
                    ? `${autoCandidate.playerName ?? "Player"} • ${autoCandidate.position ?? "—"}`
                    : isMyTurn
                      ? "Calculating best available player…"
                      : "Shown when your team is on the clock"}
                </strong>
                {autoCandidate?.source ? (
                  <span style={styles.clockMeta}>
                    {autoCandidate.source === "my_rankings" ? "My Rankings" : "G365 Best Available"}
                    {autoCandidate.forceNeed ? " • roster need" : ""}
                  </span>
                ) : null}
              </div>
              <div style={styles.autoDraftControls}>
                <button
                  type="button"
                  disabled={!myFantasyTeam || autoBusy}
                  onClick={() => void toggleAutoDraft()}
                  style={{
                    ...styles.autoToggle,
                    ...(autoDraftEnabled ? styles.autoToggleOn : {}),
                  }}
                >
                  AUTO DRAFT {autoDraftEnabled ? "ON" : "OFF"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const next = !soundEnabled;
                    setSoundEnabled(next);
                    window.localStorage.setItem("g365-nhl-draft-sound", next ? "on" : "off");
                    if (next) playDraftSound("turn");
                  }}
                  style={styles.soundButton}
                >
                  SOUND {soundEnabled ? "ON" : "OFF"}
                </button>
              </div>
            </section>

            <section className="g365-draft-ticker-shell" style={styles.draftTickerShell}>
              <div className="g365-draft-ticker-label" style={styles.draftTickerLabel}>DRAFT TICKER</div>
              <div className="g365-draft-ticker-scroller" style={styles.draftTickerScroller}>
                {(() => {
                  const currentIndex = Math.max(
                    0,
                    boardCells.findIndex(
                      (cell) => cell.overallPick === draft.current_overall_pick
                    )
                  );
                  const start = Math.max(0, currentIndex - 5);
                  const end = Math.min(boardCells.length, currentIndex + 8);
                  return boardCells.slice(start, end).map((cell) => {
                    const isMine = cell.fantasyTeamId === myFantasyTeam?.id;
                    const completedPick = draftPicks.find(
                      (pick) => pick.overall_pick === cell.overallPick
                    );
                    const pickedPlayer = completedPick
                      ? playerById.get(completedPick.nhl_player_id) ?? null
                      : null;
                    const isOnClock =
                      draft.status === "drafting" &&
                      cell.overallPick === draft.current_overall_pick;

                    return (
                      <div
                        key={cell.overallPick}
                        className="g365-draft-ticker-pick"
                        style={{
                          ...styles.draftTickerPick,
                          ...(isOnClock ? styles.draftTickerCurrent : {}),
                          ...(isMine && !isOnClock ? styles.draftTickerMine : {}),
                        }}
                      >
                        <div className="g365-draft-ticker-number" style={styles.draftTickerNumber}>
                          {cell.overallPick}
                        </div>
                        <div className="g365-draft-ticker-info" style={styles.draftTickerInfo}>
                          {pickedPlayer ? (
                            <>
                              <strong className="g365-draft-ticker-primary" style={styles.draftTickerPrimary}>
                                {playerName(pickedPlayer)}
                              </strong>
                              <span className="g365-draft-ticker-secondary" style={styles.draftTickerSecondary}>
                                {normalizePosition(
                                  pickedPlayer.position,
                                  pickedPlayer.position_group
                                )} • {cell.teamName}
                              </span>
                            </>
                          ) : isOnClock ? (
                            <>
                              <strong className="g365-draft-ticker-primary" style={styles.draftTickerPrimary}>
                                ON THE CLOCK
                              </strong>
                              <span className="g365-draft-ticker-secondary" style={styles.draftTickerSecondary}>
                                {cell.teamName}
                              </span>
                            </>
                          ) : (
                            <>
                              <strong className="g365-draft-ticker-primary" style={styles.draftTickerPrimary}>
                                {cell.teamName}
                              </strong>
                              <span className="g365-draft-ticker-secondary" style={styles.draftTickerSecondary}>
                                Upcoming Pick
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </section>

            {isMyTurn ? (
              <section style={styles.yourTurn}>
                <strong>IT&apos;S YOUR TURN</strong>
                <span>
                  {myFantasyTeam?.team_name ?? "Your Team"} is on the clock.
                </span>
              </section>
            ) : null}

            {isCommissioner ? (
              <section style={styles.commissionerBar}>
                <div>
                  <div style={styles.sectionTitle}>Commissioner Draft Controls</div>
                  <div style={styles.mutedText}>
                    {draft.rounds} rounds • {draftTeams.length} teams • {draft.draft_type === "dynasty" ? "linear order" : "snake order"}
                  </div>
                </div>

                <div style={styles.buttonRow}>
                  {draft.status === "ready" || draft.status === "setup" ? (
                    <button
                      type="button"
                      style={styles.primaryButton}
                      disabled={actionLoading}
                      onClick={() => void runCommissionerAction("start")}
                    >
                      {actionLoading ? "Working..." : "Start Draft"}
                    </button>
                  ) : null}

                  {draft.status === "drafting" ? (
                    <button
                      type="button"
                      style={styles.secondaryButton}
                      disabled={actionLoading}
                      onClick={() => void runCommissionerAction("pause")}
                    >
                      Pause Draft
                    </button>
                  ) : null}

                  {draft.status === "paused" ? (
                    <button
                      type="button"
                      style={styles.primaryButton}
                      disabled={actionLoading}
                      onClick={() => void runCommissionerAction("resume")}
                    >
                      Resume Draft
                    </button>
                  ) : null}

                  <button
                    type="button"
                    style={styles.dangerButton}
                    disabled={actionLoading}
                    onClick={() => {
                      const confirmed = window.confirm(
                        "Reset the NHL draft? This removes draft picks and players acquired through this draft."
                      );
                      if (confirmed) void runCommissionerAction("reset");
                    }}
                  >
                    Reset Draft
                  </button>
                </div>
              </section>
            ) : null}

            <section className="g365-nhl-draft-room" style={styles.roomGrid}>
              <aside className="g365-nhl-draft-left" style={styles.leftRail}>
                <details className="g365-mobile-collapse g365-draft-history-card" style={styles.sideCard}>
                  <summary className="g365-mobile-collapse-summary" style={styles.cardHead}>
                    <span style={styles.cardTitle}>DRAFT HISTORY</span>
                    <span className="g365-mobile-collapse-meta">
                      <span style={styles.cardMeta}>{draftPicks.length} PICKS</span>
                      <span className="g365-mobile-collapse-chevron" aria-hidden="true">⌄</span>
                    </span>
                  </summary>
                  <div className="g365-mobile-collapse-body" style={styles.historyRailList}>
                    {draftPicks.length === 0 ? (
                      <div style={styles.noPlayers}>No picks have been made yet.</div>
                    ) : (
                      [...draftPicks].reverse().map((pick) => {
                        const player = playerById.get(pick.nhl_player_id);
                        const team = fantasyTeamById.get(pick.fantasy_team_id);
                        return (
                          <div key={pick.id} style={styles.historyRailRow}>
                            <div style={styles.historyRailPick}>#{pick.overall_pick}</div>
                            <div style={styles.historyRailInfo}>
                              <strong>{player ? playerName(player) : `Player #${pick.nhl_player_id}`}</strong>
                              <span>{team?.team_name ?? `Team ${pick.fantasy_team_id}`}</span>
                              <span>R{pick.round_number} P{pick.pick_in_round}{player ? ` • ${normalizePosition(player.position, player.position_group)}` : ""}</span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </details>
              </aside>

              <section style={styles.centerColumn}>
                <select className="g365-draft-mobile-tab-select" value={activeTab} onChange={(e) => setActiveTab(e.target.value as typeof activeTab)} aria-label="Draft section">
                  <option value="players">Players</option><option value="queue">Queue</option><option value="rankings">My Rankings</option><option value="board">Draft Board</option><option value="trade">Trade Center</option><option value="summary">Trade Summary</option>
                </select>
                <nav className="g365-draft-desktop-tabs" style={styles.workspaceTabs} aria-label="NHL draft workspace">
                  {(
                    [
                      ["players", "Players"],
                      ["queue", "Queue"],
                      ["rankings", "My Rankings"],
                      ["board", "Draft Board"],
                      ["trade", "Trade Center"],
                      ["summary", "Trade Summary"],
                    ] as const
                  ).map(([tab, label]) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => {
                        setActiveTab(tab);
                        if (tab === "summary" && myFantasyTeam) {
                          void supabase
                            .rpc("mark_all_nhl_completed_trades_read", {
                              p_league_id: leagueId,
                              p_fantasy_team_id: myFantasyTeam.id,
                            })
                            .then(() => loadTradeHub());
                        }
                      }}
                      style={{
                        ...styles.workspaceTab,
                        ...(activeTab === tab ? styles.workspaceTabActive : {}),
                      }}
                    >
                      {label}
                      {tab === "queue" && queuedPlayers.length > 0 ? (
                        <span style={styles.tabCount}>{queuedPlayers.length}</span>
                      ) : null}
                      {tab === "trade" && tradeAttentionCount > 0 ? (
                        <span style={styles.tabCount}>{tradeAttentionCount}</span>
                      ) : null}
                    </button>
                  ))}
                </nav>

                <section className="g365-draft-workspace" style={styles.workspace}>
                  <div style={styles.cardHead}>
                    <div>
                      <div style={styles.cardTitle}>
                        {activeTab === "players"
                          ? "AVAILABLE PLAYERS"
                          : activeTab === "queue"
                            ? "PICK QUEUE"
                            : activeTab === "rankings"
                              ? "MY RANKINGS"
                              : "DRAFT BOARD"}
                      </div>
                      <div style={styles.workspaceSubhead}>
                        {activeTab === "players"
                          ? "G365 draft rankings and projections. Drafted players disappear automatically."
                          : activeTab === "queue"
                            ? "Your saved draft targets. Drafted players are removed automatically."
                            : activeTab === "rankings"
                              ? "Saved draft-specific rankings. Auto Draft uses this order first, then G365 best available and late-draft roster need."
                              : `${draftPicks.length} of ${totalPicks} selections completed.`}
                      </div>
                    </div>
                    {activeTab === "players" ? (
                      <span style={styles.cardMeta}>
                        {canMakePick ? "PICK ENABLED" : "WAITING"}
                      </span>
                    ) : null}
                  </div>

                  {activeTab === "players" ? (
                    <div style={styles.playerWorkspace}>
                      <div style={styles.filters}>
                        <input
                          type="search"
                          value={search}
                          onChange={(event) => setSearch(event.target.value)}
                          placeholder="Search NHL players..."
                          style={styles.searchInput}
                        />
                        <select
                          value={teamFilter}
                          onChange={(event) => setTeamFilter(event.target.value)}
                          style={styles.teamSelect}
                          aria-label="Filter available players by NHL team"
                        >
                          <option value="ALL">All Teams</option>
                          <option value="FA">Free Agents</option>
                          {teamOptions.map((team) => (
                            <option key={team.id} value={String(team.id)}>
                              {nhlTeamLabel(team)}
                            </option>
                          ))}
                        </select>
                        <div style={styles.positionFilters}>
                          {positionFilters.map((filter) => (
                            <button
                              key={filter}
                              type="button"
                              onClick={() => setPositionFilter(filter)}
                              style={{
                                ...styles.filterButton,
                                ...(positionFilter === filter
                                  ? styles.activeFilterButton
                                  : {}),
                              }}
                            >
                              {filter}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="g365-nhl-player-head" style={styles.playerTableHead}>
                        <span>RK</span>
                        <span>Player</span>
                        <span>Pos</span>
                        <span>Team</span>
                        <span>Proj FP</span>
                        <span>Queue</span>
                        <span>Draft</span>
                      </div>

                      <div style={styles.playerList}>
                        {filteredPlayers.map((player) => {
                          const pos = normalizePosition(
                            player.position,
                            player.position_group
                          );
                          const ranking = draftRankingByPlayerId.get(player.id);
                          const queued = queueIds.includes(player.id);
                          const isDrafting = draftingPlayerId === player.id;

                          return (
                            <div
                              key={player.id}
                              className="g365-nhl-player-row"
                              style={styles.playerRow}
                            >
                              <div className="g365-player-rank" style={styles.draftRank}>
                                {ranking?.overall_rank ?? "—"}
                              </div>

                              <div className="g365-player-identity" style={styles.playerIdentity}>
                                {player.headshot_url ? (
                                  <img
                                    src={player.headshot_url}
                                    alt=""
                                    width={42}
                                    height={42}
                                    style={styles.headshot}
                                  />
                                ) : (
                                  <div style={styles.headshotFallback}>{pos}</div>
                                )}
                                <div style={styles.playerTextBlock}>
                                  <button
                                    type="button"
                                    onClick={() => void openPlayerDetail(player.id)}
                                    className="g365-player-name"
                                    style={styles.playerNameButton}
                                    title={`View ${playerName(player)} projections and last-season stats`}
                                  >
                                    {playerName(player)}
                                  </button>
                                  <div style={styles.playerMeta}>
                                    {ranking?.position_rank != null
                                      ? `${pos}${ranking.position_rank}`
                                      : pos}
                                    {ranking?.projected_fantasy_points_per_game != null
                                      ? ` • ${Number(ranking.projected_fantasy_points_per_game).toFixed(2)} FPPG`
                                      : ""}
                                    {ranking?.projected_games_played != null
                                      ? ` • ${Number(ranking.projected_games_played).toFixed(1)} GP`
                                      : ""}
                                    {player.injury_status
                                      ? ` • ${player.injury_status}`
                                      : ""}
                                  </div>
                                </div>
                              </div>

                              <div className="g365-player-pos" style={styles.positionBadge}>{pos}</div>

                              <div className="g365-player-team" style={styles.teamBadge}>
                                {player.team_id != null
                                  ? nhlTeamLabel(nhlTeamById.get(player.team_id))
                                  : "FA"}
                              </div>

                              <div className="g365-player-fp" style={styles.projectionValue}>
                                {ranking?.projected_fantasy_points != null
                                  ? Number(ranking.projected_fantasy_points).toFixed(2)
                                  : "—"}
                              </div>

                              <button
                                className="g365-player-queue"
                                type="button"
                                onClick={() => toggleQueue(player.id)}
                                style={{
                                  ...styles.queueButton,
                                  ...(queued ? styles.queueButtonActive : {}),
                                }}
                              >
                                {queued ? "Queued" : "+ Queue"}
                              </button>

                              <button
                                className="g365-player-draft"
                                type="button"
                                disabled={!canMakePick || draftingPlayerId !== null}
                                onClick={() => void draftPlayer(player)}
                                style={{
                                  ...styles.draftButton,
                                  ...(!canMakePick ? styles.disabledButton : {}),
                                }}
                              >
                                {isDrafting ? "Drafting..." : "Draft"}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  {activeTab === "queue" ? (
                    <div style={styles.simpleList}>
                      {queuedPlayers.length === 0 ? (
                        <div style={styles.noPlayers}>
                          Your queue is empty. Add players from the Players tab.
                        </div>
                      ) : (
                        queuedPlayers.map((player, index) => (
                          <div key={player.id} style={styles.queueRow}>
                            <span style={styles.queueRank}>{index + 1}</span>
                            <div style={styles.queuePlayerInfo}>
                              <strong>{playerName(player)}</strong>
                              <span style={styles.playerMeta}>
                                {normalizePosition(
                                  player.position,
                                  player.position_group
                                )}
                                {player.injury_status
                                  ? ` • ${player.injury_status}`
                                  : ""}
                              </span>
                            </div>
                            <button
                              type="button"
                              style={styles.removeQueueButton}
                              onClick={() => toggleQueue(player.id)}
                            >
                              Remove
                            </button>
                            <button
                              type="button"
                              disabled={!canMakePick || draftingPlayerId !== null}
                              style={{
                                ...styles.draftButton,
                                ...(!canMakePick ? styles.disabledButton : {}),
                              }}
                              onClick={() => void draftPlayer(player)}
                            >
                              Draft
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  ) : null}

                  {activeTab === "rankings" ? (
                    <div className="g365-my-rankings-scroll" style={styles.rankingsTableScroll}>
                      {rankingPlayers.length === 0 ? (
                        <div style={styles.noPlayers}>Initializing your rankings for this draft…</div>
                      ) : (
                        <div className="g365-my-rankings-table" style={styles.rankingsTable}>
                          <div className="g365-my-rankings-head" style={styles.rankingsTableHead}>
                            <span>MY</span><span>PLAYER</span><span>TEAM</span><span>POS</span><span>FP</span><span>FPPG</span><span>MOVE</span>
                          </div>
                          {rankingPlayers.map((player, index) => {
                            const ranking = draftRankingByPlayerId.get(player.id);
                            const pos = normalizePosition(player.position, player.position_group);
                            const team = player.team_id != null ? nhlTeamLabel(nhlTeamById.get(player.team_id)) : "FA";
                            return (
                              <div key={player.id} className="g365-my-ranking-row" style={styles.rankingsTableRow}>
                                <span className="g365-my-ranking-number" style={styles.myRankValue}>{index + 1}</span>
                                <div className="g365-my-ranking-player" style={styles.rankingPlayerIdentity}>
                                  {player.headshot_url ? <img src={player.headshot_url} alt="" style={styles.rankingHeadshot} /> : <span style={styles.rankingHeadshotFallback}>{playerName(player).slice(0,1).toUpperCase()}</span>}
                                  <div style={styles.rankingPlayerText}>
                                    <button type="button" onClick={() => void openPlayerDetail(player.id)} style={styles.rankingPlayerButton}>{playerName(player)}</button>
                                    <span style={styles.rankingPlayerMeta}>G365 {ranking?.overall_rank != null ? `#${ranking.overall_rank}` : "—"}{ranking?.position_rank != null ? ` • ${pos}${ranking.position_rank}` : ""}</span>
                                  </div>
                                </div>
                                <span className="g365-my-ranking-team" style={styles.rankCenter}>{team}</span>
                                <span className="g365-my-ranking-pos" style={styles.rankCenter}>{pos}</span>
                                <span className="g365-my-ranking-fp" style={styles.rankNumber}>{ranking?.projected_fantasy_points != null ? ranking.projected_fantasy_points.toFixed(2) : "—"}</span>
                                <span className="g365-my-ranking-fppg" style={styles.rankNumber}>{ranking?.projected_fantasy_points_per_game != null ? ranking.projected_fantasy_points_per_game.toFixed(2) : "—"}</span>
                                <div className="g365-my-ranking-actions" style={styles.rankingActions}>
                                  <button type="button" title="Move up" disabled={rankingBusy || index === 0} style={styles.rankMoveButton} onClick={() => moveMyRanking(player.id, -1)}>↑</button>
                                  <button type="button" title="Move down" disabled={rankingBusy || index === rankingPlayers.length - 1} style={styles.rankMoveButton} onClick={() => moveMyRanking(player.id, 1)}>↓</button>
                                  <button type="button" style={{ ...styles.queueButton, ...(queueIds.includes(player.id) ? styles.queueButtonActive : {}) }} onClick={() => toggleQueue(player.id)}>{queueIds.includes(player.id) ? "Queued" : "+ Queue"}</button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ) : null}

                  {activeTab === "board" ? (
                    <div style={styles.boardScroller}>
                      <div
                        style={{
                          ...styles.board,
                          minWidth: Math.max(760, draftTeams.length * 170),
                        }}
                      >
                        <div
                          style={{
                            ...styles.boardHeaderRow,
                            gridTemplateColumns: `repeat(${draftTeams.length}, minmax(160px, 1fr))`,
                          }}
                        >
                          {draftTeams.map((draftTeam) => {
                            const team = fantasyTeamById.get(
                              draftTeam.fantasy_team_id
                            );
                            const mine = team?.owner_id === userId;
                            return (
                              <div
                                key={draftTeam.fantasy_team_id}
                                style={{
                                  ...styles.boardTeamHeader,
                                  ...(mine ? styles.myBoardTeamHeader : {}),
                                }}
                              >
                                #{draftTeam.draft_slot} {team?.team_name ?? "Team"}
                              </div>
                            );
                          })}
                        </div>

                        {Array.from(
                          { length: draft.rounds },
                          (_, index) => index + 1
                        ).map((round) => {
                          const roundCells = boardCells.filter(
                            (cell) => cell.round === round
                          );
                          return (
                            <details
                              key={round}
                              style={styles.boardRound}
                              open={round === draft.current_round}
                            >
                              <summary style={styles.roundLabel}>
                                ROUND {round} • {roundCells.filter((cell) => Boolean(cell.player)).length}/{roundCells.length}
                              </summary>
                              <div
                                style={{
                                  ...styles.boardRow,
                                  gridTemplateColumns: `repeat(${draftTeams.length}, minmax(160px, 1fr))`,
                                }}
                              >
                                {roundCells.map((cell) => (
                                  <div
                                    key={cell.overallPick}
                                    style={{
                                      ...styles.boardCell,
                                      ...(cell.isCurrent
                                        ? styles.currentBoardCell
                                        : {}),
                                      ...(cell.fantasyTeamId === myFantasyTeam?.id
                                        ? styles.myBoardCell
                                        : {}),
                                    }}
                                  >
                                    <div style={styles.boardPickNumber}>
                                      #{cell.overallPick}
                                    </div>
                                    <div style={styles.boardTeamName}>
                                      {cell.teamName}
                                    </div>
                                    {cell.player ? (
                                      <>
                                        <div style={styles.boardPlayerName}>
                                          {playerName(cell.player)}
                                        </div>
                                        <div style={styles.boardPosition}>
                                          {normalizePosition(
                                            cell.player.position,
                                            cell.player.position_group
                                          )}
                                        </div>
                                      </>
                                    ) : (
                                      <div style={styles.boardEmpty}>
                                        {cell.isCurrent ? "ON THE CLOCK" : "—"}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </details>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  {activeTab === "trade" ? (
                    <section style={styles.tradePanel}>
                      <select className="g365-trade-mobile-tab-select" value={tradeSection} onChange={(e) => setTradeSection(e.target.value as typeof tradeSection)} aria-label="Trade Center section">
                        <option value="teams">Teams / Private Chats</option><option value="pending">Pending Offers</option><option value="block">Trade Block</option>
                      </select>
                      <div className="g365-trade-desktop-tabs" style={styles.tradeSubtabs}>
                        {(
                          [
                            ["teams", "Teams / Private Chats"],
                            ["pending", "Pending Offers"],
                            ["block", "Trade Block"],
                          ] as const
                        ).map(([k, l]) => (
                          <button
                            key={k}
                            type="button"
                            onClick={() => setTradeSection(k)}
                            style={{
                              ...styles.workspaceTab,
                              ...(tradeSection === k ? styles.workspaceTabActive : {}),
                            }}
                          >
                            {l}
                            {k === "teams" && chatUnread > 0 ? (
                              <span style={styles.tabCount}>{chatUnread}</span>
                            ) : null}
                            {k === "pending" && incomingTradeOfferCount > 0 ? (
                              <span style={styles.tabCount}>{incomingTradeOfferCount}</span>
                            ) : null}
                          </button>
                        ))}
                      </div>

                      {tradeSection === "teams" ? (
                        <div className="g365-nhl-trade-layout" style={styles.tradeLayout}>
                          <div style={styles.tradeTeams}>
                            {fantasyTeams
                              .filter((t) => t.id !== myFantasyTeam?.id)
                              .map((t) => (
                                <button
                                  type="button"
                                  key={t.id}
                                  onClick={() => void openTradeTeam(t.id)}
                                  style={{
                                    ...styles.tradeTeamButton,
                                    ...(selectedTradeTeamId === t.id
                                      ? styles.tradeTeamButtonActive
                                      : {}),
                                  }}
                                >
                                  <span>{t.team_name}</span>
                                  {unreadForTradeTeam(t.id) > 0 ? (
                                    <span style={styles.notificationBadge}>{unreadForTradeTeam(t.id)}</span>
                                  ) : null}
                                </button>
                              ))}
                          </div>

                          <div style={styles.tradeWorkspace}>
                            {selectedTradeTeamId ? (
                              <>
                                <div style={styles.cardHead}>
                                  <div>
                                    <div style={styles.cardTitle}>
                                      PRIVATE TRADE CHAT •{" "}
                                      {fantasyTeamById.get(selectedTradeTeamId)?.team_name}
                                    </div>
                                    <div style={styles.workspaceSubhead}>
                                      Only these two teams can view this negotiation.
                                    </div>
                                  </div>
                                </div>

                                <div ref={chatListRef} style={styles.chatList}>
                                  {chatMessages.length ? (
                                    chatMessages.map((m, i) => (
                                      <div
                                        key={numField(m, "message_id", "id") ?? i}
                                        style={styles.chatMessage}
                                      >
                                        <strong>
                                          {numField(
                                            m,
                                            "sender_fantasy_team_id",
                                            "senderFantasyTeamId",
                                          ) === myFantasyTeam?.id
                                            ? "You"
                                            : fantasyTeamById.get(
                                                numField(
                                                  m,
                                                  "sender_fantasy_team_id",
                                                  "senderFantasyTeamId",
                                                ) ?? -1,
                                              )?.team_name ?? "Trade"}
                                        </strong>
                                        <span>{strField(m, "body", "message_body")}</span>
                                      </div>
                                    ))
                                  ) : (
                                    <div style={styles.noPlayers}>No messages yet.</div>
                                  )}
                                </div>

                                <div style={styles.chatComposer}>
                                  <input
                                    value={chatBody}
                                    onChange={(e) => setChatBody(e.target.value)}
                                    placeholder="Private message..."
                                    style={styles.searchInput}
                                  />
                                  <button
                                    type="button"
                                    disabled={tradeBusy || !chatBody.trim()}
                                    onClick={() => void sendTradeChat()}
                                    style={styles.primaryButton}
                                  >
                                    Send
                                  </button>
                                </div>

                                <div style={styles.offerBuilder}>
                                  <div style={styles.cardTitle}>BUILD OFFER</div>
                                  <div style={styles.compactAssetGrid}>
                                    <details style={styles.assetDetails}>
                                      <summary style={styles.assetSummary}>
                                        YOU SEND • {offerMinePlayers.length + offerMinePicks.length} SELECTED
                                      </summary>
                                      <details style={styles.assetSubDetails}>
                                        <summary style={styles.assetSubSummary}>PLAYERS • {myTradeAssets.players.length}</summary>
                                        <div style={styles.playerPositionGrid}>
                                          {myTradeAssets.players.length ? Array.from(new Set(myTradeAssets.players.map((a) => a.position || "OTHER"))).sort().map((position) => {
                                            const positionPlayers = myTradeAssets.players.filter((a) => (a.position || "OTHER") === position).sort((a,b) => a.playerName.localeCompare(b.playerName));
                                            return <details key={`mp-pos-${position}`} style={styles.pickYearDetails}>
                                              <summary style={styles.pickYearSummary}><strong>{position}</strong><span>{positionPlayers.length} PLAYER{positionPlayers.length === 1 ? "" : "S"} ▾</span></summary>
                                              <div style={styles.pickYearList}>{positionPlayers.map((a) => <label key={`mp${a.nhlPlayerId}`} style={styles.pickAssetRow}>
                                                <input type="checkbox" checked={offerMinePlayers.includes(a.nhlPlayerId)} onChange={() => toggleId(setOfferMinePlayers, a.nhlPlayerId)} />
                                                <span><strong>{a.playerName}</strong> • {a.position}</span>
                                              </label>)}</div>
                                            </details>;
                                          }) : <div style={styles.assetEmpty}>No players available.</div>}
                                        </div>
                                      </details>
                                      <details style={styles.assetSubDetails}>
                                        <summary style={styles.assetSubSummary}>DRAFT PICKS • {myTradeAssets.draftPicks.length}</summary>
                                        <div style={styles.pickYearGrid}>
                                          {myTradeAssets.draftPicks.length ? Array.from(new Set(myTradeAssets.draftPicks.map((a) => a.draftSeason))).sort((a,b) => a-b).map((year) => {
                                            const yearPicks = myTradeAssets.draftPicks.filter((a) => a.draftSeason === year).sort((a,b) => a.roundNumber - b.roundNumber || (a.overallPick ?? 9999) - (b.overallPick ?? 9999));
                                            return <details key={`my-year-${year}`} style={styles.pickYearDetails}>
                                              <summary style={styles.pickYearSummary}><strong>{year}</strong><span>{yearPicks.length} PICK{yearPicks.length === 1 ? "" : "S"} ▾</span></summary>
                                              <div style={styles.pickYearList}>{yearPicks.map((a) => <label key={`mk${a.draftPickAssetId}`} style={styles.pickAssetRow}>
                                                <input type="checkbox" checked={offerMinePicks.includes(a.draftPickAssetId)} onChange={() => toggleId(setOfferMinePicks, a.draftPickAssetId)} />
                                                <span><strong>Round {a.roundNumber}</strong>{a.overallPick ? ` • Pick #${a.overallPick}` : " • Pick TBD"}{a.isTraded ? ` • via ${a.originalTeamName}` : ""}</span>
                                              </label>)}</div>
                                            </details>;
                                          }) : <div style={styles.assetEmpty}>No tradable picks.</div>}
                                        </div>
                                      </details>
                                    </details>

                                    <details style={styles.assetDetails}>
                                      <summary style={styles.assetSummary}>
                                        YOU RECEIVE • {offerTheirPlayers.length + offerTheirPicks.length} SELECTED
                                      </summary>
                                      <details style={styles.assetSubDetails}>
                                        <summary style={styles.assetSubSummary}>PLAYERS • {theirTradeAssets.players.length}</summary>
                                        <div style={styles.playerPositionGrid}>
                                          {theirTradeAssets.players.length ? Array.from(new Set(theirTradeAssets.players.map((a) => a.position || "OTHER"))).sort().map((position) => {
                                            const positionPlayers = theirTradeAssets.players.filter((a) => (a.position || "OTHER") === position).sort((a,b) => a.playerName.localeCompare(b.playerName));
                                            return <details key={`tp-pos-${position}`} style={styles.pickYearDetails}>
                                              <summary style={styles.pickYearSummary}><strong>{position}</strong><span>{positionPlayers.length} PLAYER{positionPlayers.length === 1 ? "" : "S"} ▾</span></summary>
                                              <div style={styles.pickYearList}>{positionPlayers.map((a) => <label key={`tp${a.nhlPlayerId}`} style={styles.pickAssetRow}>
                                                <input type="checkbox" checked={offerTheirPlayers.includes(a.nhlPlayerId)} onChange={() => toggleId(setOfferTheirPlayers, a.nhlPlayerId)} />
                                                <span><strong>{a.playerName}</strong> • {a.position}</span>
                                              </label>)}</div>
                                            </details>;
                                          }) : <div style={styles.assetEmpty}>No players available.</div>}
                                        </div>
                                      </details>
                                      <details style={styles.assetSubDetails}>
                                        <summary style={styles.assetSubSummary}>DRAFT PICKS • {theirTradeAssets.draftPicks.length}</summary>
                                        <div style={styles.pickYearGrid}>
                                          {theirTradeAssets.draftPicks.length ? Array.from(new Set(theirTradeAssets.draftPicks.map((a) => a.draftSeason))).sort((a,b) => a-b).map((year) => {
                                            const yearPicks = theirTradeAssets.draftPicks.filter((a) => a.draftSeason === year).sort((a,b) => a.roundNumber - b.roundNumber || (a.overallPick ?? 9999) - (b.overallPick ?? 9999));
                                            return <details key={`their-year-${year}`} style={styles.pickYearDetails}>
                                              <summary style={styles.pickYearSummary}><strong>{year}</strong><span>{yearPicks.length} PICK{yearPicks.length === 1 ? "" : "S"} ▾</span></summary>
                                              <div style={styles.pickYearList}>{yearPicks.map((a) => <label key={`tk${a.draftPickAssetId}`} style={styles.pickAssetRow}>
                                                <input type="checkbox" checked={offerTheirPicks.includes(a.draftPickAssetId)} onChange={() => toggleId(setOfferTheirPicks, a.draftPickAssetId)} />
                                                <span><strong>Round {a.roundNumber}</strong>{a.overallPick ? ` • Pick #${a.overallPick}` : " • Pick TBD"}{a.isTraded ? ` • via ${a.originalTeamName}` : ""}</span>
                                              </label>)}</div>
                                            </details>;
                                          }) : <div style={styles.assetEmpty}>No tradable picks.</div>}
                                        </div>
                                      </details>
                                    </details>
                                  </div>

                                  <button
                                    type="button"
                                    disabled={tradeBusy}
                                    onClick={() => void submitTradeOffer()}
                                    style={styles.primaryButton}
                                  >
                                    {counteringOfferId == null
                                      ? "Send Trade Offer"
                                      : `Send Counter to Offer #${counteringOfferId}`}
                                  </button>
                                  {counteringOfferId != null ? (
                                    <button
                                      type="button"
                                      onClick={() => setCounteringOfferId(null)}
                                      style={styles.secondaryButton}
                                    >
                                      Cancel Counter
                                    </button>
                                  ) : null}
                                </div>
                              </>
                            ) : (
                              <div style={styles.noPlayers}>
                                Choose a team to open its private trade room.
                              </div>
                            )}
                          </div>
                        </div>
                      ) : null}

                      {tradeSection === "pending" ? (
                        <div style={styles.offerList}>
                          {pendingOffers.length ? (
                            pendingOffers.map((o, i) => {
                              const id = numField(o, "trade_offer_id", "id") ?? i;
                              const proposer = numField(o, "proposing_fantasy_team_id", "proposingFantasyTeamId");
                              const receiver = numField(o, "receiving_fantasy_team_id", "receivingFantasyTeamId");
                              const incoming = receiver === myFantasyTeam?.id;
                              const offeredPlayers = pendingPlayerIds(Number(id), proposer);
                              const requestedPlayers = pendingPlayerIds(Number(id), receiver);
                              const offeredPicks = pendingPickIds(Number(id), proposer);
                              const requestedPicks = pendingPickIds(Number(id), receiver);
                              const receivePlayers = incoming ? offeredPlayers : requestedPlayers;
                              const receivePicks = incoming ? offeredPicks : requestedPicks;
                              const sendPlayers = incoming ? requestedPlayers : offeredPlayers;
                              const sendPicks = incoming ? requestedPicks : offeredPicks;
                              const otherTeamId = incoming ? proposer : receiver;
                              const otherTeamName = fantasyTeamById.get(otherTeamId ?? -1)?.team_name ?? "Team";

                              return (
                                <details key={id} style={styles.offerCard} open={incoming}>
                                  <summary style={styles.compactOfferSummary}>
                                    <span>
                                      <strong>{incoming ? `${otherTeamName} OFFERED YOU A TRADE` : `TRADE SENT TO ${otherTeamName}`}</strong>
                                      <small style={styles.offerNumber}>Offer #{id} • {sendPlayers.length + sendPicks.length} out / {receivePlayers.length + receivePicks.length} in</small>
                                    </span>
                                    {incoming ? <span style={styles.notificationBadge}>NEW</span> : null}
                                  </summary>

                                  <div style={styles.pendingTradeGrid}>
                                    <div style={styles.pendingTradeSide}>
                                      <strong style={styles.pendingTradeHeading}>YOU RECEIVE</strong>
                                      <div style={styles.pendingAssetLabel}>PLAYERS</div>
                                      {receivePlayers.length ? receivePlayers.map((playerId) => (
                                        <div key={`rp-${id}-${playerId}`} style={styles.pendingAssetRow}>{tradePlayerLabel(playerId)}</div>
                                      )) : <div style={styles.pendingAssetEmpty}>No players</div>}
                                      <div style={styles.pendingAssetLabel}>PICKS</div>
                                      {receivePicks.length ? receivePicks.map((pickId) => (
                                        <div key={`rk-${id}-${pickId}`} style={styles.pendingAssetRow}>{tradePickLabel(pickId)}</div>
                                      )) : <div style={styles.pendingAssetEmpty}>No picks</div>}
                                    </div>

                                    <div style={styles.pendingTradeSide}>
                                      <strong style={styles.pendingTradeHeading}>YOU SEND</strong>
                                      <div style={styles.pendingAssetLabel}>PLAYERS</div>
                                      {sendPlayers.length ? sendPlayers.map((playerId) => (
                                        <div key={`sp-${id}-${playerId}`} style={styles.pendingAssetRow}>{tradePlayerLabel(playerId)}</div>
                                      )) : <div style={styles.pendingAssetEmpty}>No players</div>}
                                      <div style={styles.pendingAssetLabel}>PICKS</div>
                                      {sendPicks.length ? sendPicks.map((pickId) => (
                                        <div key={`sk-${id}-${pickId}`} style={styles.pendingAssetRow}>{tradePickLabel(pickId)}</div>
                                      )) : <div style={styles.pendingAssetEmpty}>No picks</div>}
                                    </div>
                                  </div>

                                  <div style={styles.buttonRow}>
                                    {incoming ? (
                                      <>
                                        <button type="button" disabled={tradeBusy} onClick={() => void actOnOffer(id, "accept")} style={styles.primaryButton}>Accept Trade</button>
                                        <button type="button" disabled={tradeBusy} onClick={() => beginCounterOffer(o)} style={styles.secondaryButton}>Counter Trade</button>
                                        <button type="button" disabled={tradeBusy} onClick={() => void actOnOffer(id, "reject")} style={styles.secondaryButton}>Reject</button>
                                      </>
                                    ) : (
                                      <button type="button" disabled={tradeBusy} onClick={() => void actOnOffer(id, "cancel")} style={styles.dangerButton}>Cancel Offer</button>
                                    )}
                                  </div>
                                </details>
                              );
                            })
                          ) : (
                            <div style={styles.noPlayers}>No pending offers.</div>
                          )}
                        </div>
                      ) : null}

                      {tradeSection === "block" ? (
                        <div style={styles.offerList}>
                          <div style={styles.offerCard}>
                            <div style={styles.offerCardHead}>
                              <div>
                                <strong style={styles.tradeBlockTitle}>WHAT YOUR TEAM IS LOOKING FOR</strong>
                                <div style={styles.tradeBlockHelp}>Choose every position or asset type your team wants. Other owners will see these needs on the Trade Block.</div>
                              </div>
                            </div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
                              {["C", "LW", "RW", "F", "D", "G", "PICKS", "PROSPECTS"].map((need) => {
                                const selected = myTradeNeeds.includes(need);
                                return (
                                  <button
                                    key={need}
                                    type="button"
                                    onClick={() => toggleTradeNeed(need)}
                                    style={{
                                      ...styles.secondaryButton,
                                      ...(selected ? styles.workspaceTabActive : {}),
                                    }}
                                  >
                                    {selected ? "✓ " : ""}{tradeNeedLabel(need)}
                                  </button>
                                );
                              })}
                            </div>
                            <div style={{ ...styles.buttonRow, marginTop: 14 }}>
                              <button
                                type="button"
                                disabled={tradeNeedsBusy}
                                onClick={() => void saveTradeNeeds()}
                                style={styles.primaryButton}
                              >
                                {tradeNeedsBusy ? "Saving..." : "Save Trade Block"}
                              </button>
                            </div>
                          </div>

                          {tradeBlock
                            .filter((row) => numField(row, "fantasy_team_id", "fantasyTeamId") !== myFantasyTeam?.id)
                            .map((row, i) => {
                              const teamId = numField(row, "fantasy_team_id", "fantasyTeamId");
                              const teamName = strField(row, "team_name", "teamName") || `Team ${teamId ?? i + 1}`;
                              const rawNeeds = row.needs;
                              const needs = Array.isArray(rawNeeds) ? rawNeeds.map((value) => String(value)) : [];
                              return (
                                <details key={teamId ?? i} style={styles.offerCard}>
                                  <summary style={styles.compactOfferSummary}>
                                    <span>
                                      <strong>{teamName}</strong>
                                      <small style={styles.tradeBlockTeamNeeds}>{needs.length ? `LOOKING FOR • ${needs.length} NEED${needs.length === 1 ? "" : "S"}` : "NO NEEDS POSTED"}</small>
                                    </span>
                                  </summary>
                                  {needs.length ? (
                                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
                                      {needs.map((need) => (
                                        <span key={need} style={styles.tradeNeedChip}>
                                          {tradeNeedLabel(need)}
                                        </span>
                                      ))}
                                    </div>
                                  ) : (
                                    <div style={styles.pendingAssetEmpty}>No needs posted yet.</div>
                                  )}
                                  {teamId != null ? (
                                    <div style={{ ...styles.buttonRow, marginTop: 14 }}>
                                      <button
                                        type="button"
                                        disabled={tradeBusy}
                                        onClick={() => {
                                          setTradeSection("teams");
                                          void openTradeTeam(teamId);
                                        }}
                                        style={styles.primaryButton}
                                      >
                                        Start Trade
                                      </button>
                                    </div>
                                  ) : null}
                                </details>
                              );
                            })}
                        </div>
                      ) : null}
                    </section>
                  ) : null}

                  {activeTab === "summary" ? (
                    <section style={styles.tradePanel}>
                      <div style={styles.cardHead}>
                        <div>
                          <div style={styles.cardTitle}>COMPLETED TRADE SUMMARY</div>
                          <div style={styles.workspaceSubhead}>
                            League-wide completed trades only. Private negotiations remain
                            private.
                          </div>
                        </div>
                      </div>
                      <div style={styles.offerList}>
                        {tradeSummary.length ? (
                          tradeSummary.map((t, i) => {
                            const id = numField(t, "trade_offer_id", "id") ?? i;
                            return (
                              <div key={id} style={styles.offerCard}>
                                <strong>Trade #{id}</strong>
                                <span>
                                  {fantasyTeamById.get(
                                    numField(
                                      t,
                                      "proposing_fantasy_team_id",
                                      "proposingFantasyTeamId",
                                    ) ?? -1,
                                  )?.team_name ?? "Team"}{" "}
                                  ↔{" "}
                                  {fantasyTeamById.get(
                                    numField(
                                      t,
                                      "receiving_fantasy_team_id",
                                      "receivingFantasyTeamId",
                                    ) ?? -1,
                                  )?.team_name ?? "Team"}
                                </span>
                                <span style={styles.mutedText}>
                                  {strField(t, "completed_at", "completedAt")
                                    ? new Date(
                                        strField(t, "completed_at", "completedAt"),
                                      ).toLocaleString()
                                    : "Completed"}
                                </span>
                              </div>
                            );
                          })
                        ) : (
                          <div style={styles.noPlayers}>No completed trades yet.</div>
                        )}
                      </div>
                    </section>
                  ) : null}

                </section>
              </section>

              <aside className="g365-nhl-draft-right" style={styles.rightRail}>
                <details className="g365-mobile-collapse g365-draft-rosters-card" style={styles.sideCard}>
                  <summary className="g365-mobile-collapse-summary" style={styles.cardHead}>
                    <span style={styles.cardTitle}>ROSTERS</span>
                    <span className="g365-mobile-collapse-meta">
                      <span style={styles.cardMeta}>{rosterPicks.length}/{draft.rounds}</span>
                      <span className="g365-mobile-collapse-chevron" aria-hidden="true">⌄</span>
                    </span>
                  </summary>
                  <div className="g365-mobile-collapse-body">
                  <div style={styles.rosterSelectorWrap}>
                    <select
                      value={rosterTeamId ?? ""}
                      onChange={(event) => setSelectedRosterTeamId(Number(event.target.value))}
                      style={styles.rosterSelect}
                    >
                      {draftTeams.map((draftTeam) => {
                        const team = fantasyTeamById.get(draftTeam.fantasy_team_id);
                        return (
                          <option key={draftTeam.fantasy_team_id} value={draftTeam.fantasy_team_id}>
                            #{draftTeam.draft_slot} {team?.team_name ?? `Team ${draftTeam.fantasy_team_id}`}
                          </option>
                        );
                      })}
                    </select>
                    <div style={styles.rosterTeamLabel}>{rosterTeam?.team_name ?? "Team Roster"}</div>
                  </div>
                  <div style={styles.rosterSlotList}>
                    {rosterSlots.map((slot) => {
                      const naturalPlayers = rosterAssignments[slot.key] ?? [];
                      const filled = Math.min(naturalPlayers.length, slot.target);
                      return (
                        <div key={slot.key} style={styles.rosterSlotGroup}>
                          <div style={styles.rosterSlotHead}>
                            <span>{slot.label}</span>
                            <strong>{filled}/{slot.target}</strong>
                          </div>
                          <div style={styles.rosterMiniPlayers}>
                            {naturalPlayers.slice(0, slot.target).map((player) => (
                              <div key={player.id} style={styles.rosterMiniPlayer}>
                                <span>{playerName(player)}</span>
                                <b>{normalizePosition(player.position, player.position_group)}</b>
                              </div>
                            ))}
                            {Array.from({ length: Math.max(0, slot.target - naturalPlayers.length) }).map((_, index) => (
                              <div key={`${slot.key}-empty-${index}`} style={styles.rosterEmptySlot}>Empty {slot.label}</div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div style={styles.rosterFooter}>
                    <span>TOTAL DRAFTED</span>
                    <strong>{rosterPicks.length}/{draft.rounds}</strong>
                  </div>
                  </div>
                </details>
              </aside>
            </section>
          </>
        )}


        {detailPlayer ? (
          <div
            style={styles.modalBackdrop}
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) closePlayerDetail();
            }}
          >
            <section
              role="dialog"
              aria-modal="true"
              aria-label={`${playerName(detailPlayer)} draft profile`}
              style={styles.playerModal}
            >
              <div style={styles.modalHeader}>
                <div style={styles.modalIdentity}>
                  {detailPlayer.headshot_url ? (
                    <img
                      src={detailPlayer.headshot_url}
                      alt=""
                      width={54}
                      height={54}
                      style={styles.modalHeadshot}
                    />
                  ) : null}
                  <div>
                    <div style={styles.modalEyebrow}>G365 DRAFT PROFILE</div>
                    <h2 style={styles.modalTitle}>{playerName(detailPlayer)}</h2>
                    <div style={styles.modalMeta}>
                      {normalizePosition(detailPlayer.position, detailPlayer.position_group)}
                      {" • "}
                      {detailPlayer.team_id != null
                        ? nhlTeamLabel(nhlTeamById.get(detailPlayer.team_id))
                        : "NHL FA"}
                      {detailRanking?.overall_rank != null
                        ? ` • G365 RK #${detailRanking.overall_rank}`
                        : ""}
                      {detailRanking?.position_rank != null
                        ? ` • POS #${detailRanking.position_rank}`
                        : ""}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closePlayerDetail}
                  style={styles.modalClose}
                  aria-label="Close player profile"
                >
                  ×
                </button>
              </div>

              <div style={styles.modalBody}>
                <section style={styles.statSection}>
                  <div style={styles.statSectionHead}>
                    <strong>{league.season}–{String(league.season + 1).slice(-2)} G365 PROJECTION</strong>
                    <span>League-specific fantasy scoring</span>
                  </div>

                  {normalizePosition(detailPlayer.position, detailPlayer.position_group) === "G" ? (
                    <div style={styles.statGrid}>
                      {[
                        ["FP", statText(detailRanking?.projected_fantasy_points ?? null, 2)],
                        ["FPPG", statText(detailRanking?.projected_fantasy_points_per_game ?? null, 2)],
                        ["GP", statText(detailRanking?.projected_games_played ?? null, 1)],
                        ["Starts", statText(detailRanking?.projected_goalie_starts ?? null, 1)],
                        ["W", statText(detailRanking?.projected_goalie_wins ?? null, 1)],
                        ["Saves", statText(detailRanking?.projected_saves ?? null, 1)],
                        ["SA", statText(detailRanking?.projected_shots_against ?? null, 1)],
                        ["GA", statText(detailRanking?.projected_goals_against ?? null, 1)],
                        ["SO", statText(detailRanking?.projected_shutouts ?? null, 1)],
                        ["SV%", statText(detailRanking?.projected_save_percentage ?? null, 3)],
                        ["GAA", statText(detailRanking?.projected_goals_against_average ?? null, 2)],
                      ].map(([label, value]) => (
                        <div key={label} style={styles.statTile}>
                          <span style={styles.statLabel}>{label}</span>
                          <strong style={styles.statValue}>{value}</strong>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={styles.statGrid}>
                      {[
                        ["FP", statText(detailRanking?.projected_fantasy_points ?? null, 2)],
                        ["FPPG", statText(detailRanking?.projected_fantasy_points_per_game ?? null, 2)],
                        ["GP", statText(detailRanking?.projected_games_played ?? null, 1)],
                        ["G", statText(detailRanking?.projected_goals ?? null, 1)],
                        ["A", statText(detailRanking?.projected_assists ?? null, 1)],
                        ["PTS", statText(detailRanking?.projected_points ?? null, 1)],
                        ["PPP", statText(detailRanking?.projected_power_play_points ?? null, 1)],
                        ["SHP", statText(detailRanking?.projected_short_handed_points ?? null, 1)],
                        ["SOG", statText(detailRanking?.projected_shots_on_goal ?? null, 1)],
                        ["HIT", statText(detailRanking?.projected_hits ?? null, 1)],
                        ["BLK", statText(detailRanking?.projected_blocked_shots ?? null, 1)],
                      ].map(([label, value]) => (
                        <div key={label} style={styles.statTile}>
                          <span style={styles.statLabel}>{label}</span>
                          <strong style={styles.statValue}>{value}</strong>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <section style={styles.statSection}>
                  <div style={styles.statSectionHead}>
                    <strong>{league.season - 1}–{String(league.season).slice(-2)} NHL ACTUAL STATS</strong>
                    <span>Previous regular season</span>
                  </div>

                  {detailLoading ? (
                    <div style={styles.modalNotice}>Loading last season...</div>
                  ) : detailError ? (
                    <div style={styles.modalError}>{detailError}</div>
                  ) : !detailLastSeason ||
                    (recordNumber(detailLastSeason, "games_played", "gp", "games") ?? 0) <= 0 ? (
                    <div style={styles.rookieNotice}>
                      <strong>NONE — ROOKIE</strong>
                      <span>No previous NHL regular-season stats are available for this player.</span>
                    </div>
                  ) : normalizePosition(detailPlayer.position, detailPlayer.position_group) === "G" ? (
                    <div style={styles.statGrid}>
                      {[
                        ["FP", statText(recordNumber(detailLastSeason, "fantasy_points", "total_fantasy_points"), 2)],
                        ["GP", statText(recordNumber(detailLastSeason, "games_played", "gp", "games"))],
                        ["Starts", statText(recordNumber(detailLastSeason, "goalie_starts", "starts"))],
                        ["W", statText(recordNumber(detailLastSeason, "goalie_wins", "wins"))],
                        ["L", statText(recordNumber(detailLastSeason, "goalie_losses", "losses"))],
                        ["OTL", statText(recordNumber(detailLastSeason, "goalie_overtime_losses", "goalie_ot_losses", "overtime_losses"))],
                        ["Saves", statText(recordNumber(detailLastSeason, "saves", "goalie_saves"))],
                        ["SA", statText(recordNumber(detailLastSeason, "shots_against", "goalie_shots_against"))],
                        ["GA", statText(recordNumber(detailLastSeason, "goals_against", "goalie_goals_against"))],
                        ["SO", statText(recordNumber(detailLastSeason, "shutouts"))],
                        ["SV%", statText(recordNumber(detailLastSeason, "save_percentage"), 3)],
                        ["GAA", statText(recordNumber(detailLastSeason, "goals_against_average"), 2)],
                      ].map(([label, value]) => (
                        <div key={label} style={styles.statTile}>
                          <span style={styles.statLabel}>{label}</span>
                          <strong style={styles.statValue}>{value}</strong>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={styles.statGrid}>
                      {[
                        ["FP", statText(recordNumber(detailLastSeason, "fantasy_points", "total_fantasy_points"), 2)],
                        ["GP", statText(recordNumber(detailLastSeason, "games_played", "gp", "games"))],
                        ["G", statText(recordNumber(detailLastSeason, "goals"))],
                        ["A", statText(recordNumber(detailLastSeason, "assists"))],
                        ["PTS", statText(recordNumber(detailLastSeason, "points", "total_points"))],
                        ["+/-", statText(recordNumber(detailLastSeason, "plus_minus"))],
                        ["PIM", statText(recordNumber(detailLastSeason, "penalty_minutes"))],
                        ["PPP", statText(recordNumber(detailLastSeason, "power_play_points"))],
                        ["SHP", statText(recordNumber(detailLastSeason, "short_handed_points"))],
                        ["SOG", statText(recordNumber(detailLastSeason, "shots_on_goal"))],
                        ["HIT", statText(recordNumber(detailLastSeason, "hits"))],
                        ["BLK", statText(recordNumber(detailLastSeason, "blocked_shots"))],
                      ].map(([label, value]) => (
                        <div key={label} style={styles.statTile}>
                          <span style={styles.statLabel}>{label}</span>
                          <strong style={styles.statValue}>{value}</strong>
                        </div>
                      ))}
                    </div>
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

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background:
      "radial-gradient(circle at 50% -10%, rgba(255,72,0,.12), transparent 28%), #050506",
    color: "#fff",
    padding: "14px 10px 48px",
  },
  container: { width: "100%", maxWidth: 1600, margin: "0 auto" },
  loadingCard: {
    maxWidth: 700,
    margin: "80px auto",
    padding: 28,
    borderRadius: 16,
    border: "1px solid #2b2b2f",
    background: "#101012",
    textAlign: "center",
    fontWeight: 900,
  },
  topBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
    flexWrap: "wrap",
    padding: "16px 18px",
    border: "1px solid rgba(255,96,25,.24)",
    borderRadius: 14,
    background: "linear-gradient(135deg,#150b08,#0b0b0d 58%,#09090a)",
    marginBottom: 10,
  },
  brandBlock: { minWidth: 0 },
  eyebrow: {
    color: "#ff6a00",
    fontSize: 11,
    fontWeight: 950,
    letterSpacing: 1.2,
  },
  draftTitleRow: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" },
  title: { margin: "3px 0", fontSize: "clamp(26px,4vw,38px)", lineHeight: 1 },
  formatPill: {
    padding: "5px 9px",
    borderRadius: 999,
    border: "1px solid rgba(255,106,0,.35)",
    background: "rgba(255,88,0,.10)",
    color: "#ff8a3d",
    fontSize: 10,
    fontWeight: 950,
    textTransform: "uppercase",
  },
  subtitle: { color: "#aeb1b7", fontSize: 12 },
  statusBadge: {
    borderRadius: 999,
    padding: "8px 13px",
    background: "linear-gradient(135deg,#b91c00,#ff5a00)",
    fontWeight: 950,
    fontSize: 11,
    textTransform: "uppercase",
  },
  errorBox: {
    marginBottom: 10,
    padding: 12,
    borderRadius: 10,
    border: "1px solid #7f1d1d",
    background: "#2a0b0b",
    color: "#fecaca",
    fontWeight: 800,
  },
  successBox: {
    marginBottom: 10,
    padding: 12,
    borderRadius: 10,
    border: "1px solid #166534",
    background: "#052e1b",
    color: "#bbf7d0",
    fontWeight: 800,
  },
  emptyCard: {
    padding: 26,
    borderRadius: 14,
    border: "1px solid #29292d",
    background: "#101012",
  },
  emptyTitle: { fontSize: 21, fontWeight: 950, marginBottom: 7 },
  emptyText: { color: "#aeb1b7", lineHeight: 1.55, marginBottom: 16 },
  clockStrip: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))",
    border: "1px solid #29292d",
    borderRadius: 12,
    overflow: "hidden",
    background: "#0d0d0f",
    marginBottom: 10,
  },
  clockTeamBlock: { padding: "13px 15px", borderRight: "1px solid #252529" },
  clockCenter: { padding: "13px 15px", textAlign: "center", borderRight: "1px solid #252529" },
  nextPickBlock: { padding: "13px 15px", textAlign: "center", borderRight: "1px solid #252529" },
  progressBlock: { padding: "13px 15px" },
  clockLabel: { color: "#ff6a00", fontSize: 9, fontWeight: 950, letterSpacing: 1.1 },
  clockTeamName: { marginTop: 4, fontSize: 19, fontWeight: 950, overflow: "hidden", textOverflow: "ellipsis" },
  clockMeta: { marginTop: 4, color: "#858993", fontSize: 10 },
  clockValue: { marginTop: 2, fontSize: 32, fontWeight: 950, letterSpacing: 1 },
  nextPickValue: { marginTop: 2, fontSize: 28, fontWeight: 950 },
  progressValue: { marginTop: 4, fontSize: 18, fontWeight: 950 },
  progressTrack: { height: 5, marginTop: 9, borderRadius: 99, background: "#242429", overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 99, background: "linear-gradient(90deg,#b91c00,#ff6a00)" },
  yourTurn: {
    display: "flex",
    gap: 10,
    alignItems: "center",
    flexWrap: "wrap",
    padding: "11px 14px",
    marginBottom: 10,
    borderRadius: 10,
    border: "1px solid #b93800",
    background: "linear-gradient(90deg,#4b1300,#180b07)",
  },
  commissionerBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 12,
    padding: 12,
    marginBottom: 10,
    borderRadius: 12,
    border: "1px solid #33251f",
    background: "#100e0d",
  },
  sectionTitle: { fontSize: 15, fontWeight: 950 },
  mutedText: { marginTop: 3, color: "#8c9098", fontSize: 11 },
  buttonRow: { display: "flex", gap: 7, flexWrap: "wrap" },
  primaryButton: { minHeight: 38, padding: "8px 14px", border: 0, borderRadius: 8, background: "linear-gradient(135deg,#c52600,#ff6500)", color: "#fff", fontWeight: 950, cursor: "pointer" },
  secondaryButton: { minHeight: 38, padding: "8px 14px", borderRadius: 8, border: "1px solid #4b4b50", background: "#1c1c20", color: "#fff", fontWeight: 950, cursor: "pointer" },
  dangerButton: { minHeight: 38, padding: "8px 14px", borderRadius: 8, border: "1px solid #7f1d1d", background: "#2b0b0b", color: "#fecaca", fontWeight: 950, cursor: "pointer" },
  roomGrid: { display: "grid", gridTemplateColumns: "minmax(220px,270px) minmax(0,1fr) minmax(240px,300px)", gap: 9, alignItems: "start" },
  leftRail: { display: "flex", flexDirection: "column", gap: 9, minWidth: 0 },
  rightRail: { display: "flex", flexDirection: "column", gap: 9, minWidth: 0 },
  centerColumn: { minWidth: 0 },
  sideCard: { border: "1px solid #29292d", borderRadius: 10, background: "#0f0f11", overflow: "hidden" },
  cardHead: { minHeight: 43, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "9px 11px", borderBottom: "1px solid #29292d", background: "linear-gradient(180deg,#151518,#101012)" },
  cardTitle: { color: "#fff", fontSize: 10, fontWeight: 950, letterSpacing: .9 },
  cardMeta: { color: "#ff7a28", fontSize: 9, fontWeight: 950, whiteSpace: "nowrap" },
  orderList: { maxHeight: 390, overflowY: "auto", padding: 6 },
  orderRow: { display: "flex", alignItems: "center", gap: 8, minHeight: 48, padding: "6px 7px", borderBottom: "1px solid #202024" },
  myOrderRow: { background: "rgba(255,88,0,.08)" },
  onClockOrderRow: { outline: "1px solid rgba(255,98,0,.55)", background: "rgba(255,88,0,.13)" },
  slotNumber: { width: 25, height: 25, display: "grid", placeItems: "center", borderRadius: 6, background: "#222227", color: "#ff7a28", fontSize: 10, fontWeight: 950, flexShrink: 0 },
  orderIdentity: { minWidth: 0, flex: 1 },
  teamName: { fontSize: 11, fontWeight: 900, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  smallText: { marginTop: 2, color: "#737780", fontSize: 8, fontWeight: 800 },
  liveDot: { color: "#ff6a00", fontSize: 8, fontWeight: 950 },
  myDraftStats: { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 1, background: "#242428" },
  sideStatLabel: { display: "block", paddingTop: 9, color: "#737780", fontSize: 8, textAlign: "center", textTransform: "uppercase" },
  sideStatValue: { display: "block", padding: "3px 4px 10px", background: "#101012", textAlign: "center", fontSize: 18 },
  draftTickerShell: { display: "flex", alignItems: "stretch", gap: 0, marginBottom: 10, border: "1px solid #29292d", borderRadius: 9, background: "#0c0c0e", overflow: "hidden" },
  draftTickerLabel: { display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 94px", padding: "8px 10px", borderRight: "1px solid #2b2b30", background: "#151518", color: "#fff", fontSize: 9, fontWeight: 950, letterSpacing: .5, textAlign: "center" },
  draftTickerScroller: { display: "flex", flex: "1 1 auto", minWidth: 0, overflowX: "auto", WebkitOverflowScrolling: "touch", scrollbarWidth: "thin" },
  draftTickerPick: { display: "flex", alignItems: "center", gap: 8, flex: "0 0 180px", minHeight: 62, padding: "7px 10px", borderRight: "1px solid #252529", background: "linear-gradient(180deg,#151517,#101012)" },
  draftTickerCurrent: { border: "1px solid #ff5a00", background: "linear-gradient(135deg,#5a1305,#24100a)", boxShadow: "inset 0 0 0 1px rgba(255,111,0,.22)" },
  draftTickerMine: { background: "linear-gradient(180deg,#261109,#151012)", boxShadow: "inset 0 0 0 1px rgba(255,90,0,.28)" },
  draftTickerNumber: { display: "grid", placeItems: "center", width: 28, height: 28, flex: "0 0 28px", borderRadius: 6, background: "#202024", color: "#ff7a28", fontSize: 11, fontWeight: 950 },
  draftTickerInfo: { display: "flex", flexDirection: "column", minWidth: 0, gap: 3 },
  draftTickerPrimary: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#fff", fontSize: 10, fontWeight: 950 },
  draftTickerSecondary: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#81858e", fontSize: 8, fontWeight: 800 },
  workspaceTabs: { display: "flex", gap: 3, overflowX: "auto", padding: "0 2px 6px", WebkitOverflowScrolling: "touch" },
  workspaceTab: { minHeight: 36, padding: "7px 11px", flex: "0 0 auto", border: "1px solid #2b2b30", borderRadius: "8px 8px 0 0", background: "#111114", color: "#969aa3", fontSize: 9, fontWeight: 950, textTransform: "uppercase", cursor: "pointer" },
  workspaceTabActive: { border: "1px solid rgba(255,99,0,.6)", background: "linear-gradient(180deg,#321006,#160c09)", color: "#fff" },
  tabCount: { marginLeft: 6, padding: "2px 5px", borderRadius: 99, background: "#ff5a00", color: "#fff", fontSize: 8 },
  workspace: { minHeight: 620, border: "1px solid #29292d", borderRadius: 10, background: "#0e0e10", overflow: "hidden" },
  workspaceSubhead: { marginTop: 3, color: "#747882", fontSize: 9, lineHeight: 1.35 },
  playerWorkspace: { padding: 9 },
  filters: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 8 },
  searchInput: { flex: "1 1 240px", minWidth: 0, minHeight: 38, padding: "8px 10px", borderRadius: 7, border: "1px solid #34343a", outline: "none", background: "#08080a", color: "#fff", fontSize: 13 },
  teamSelect: { flex: "0 1 170px", minWidth: 140, minHeight: 38, padding: "8px 10px", borderRadius: 7, border: "1px solid #34343a", outline: "none", background: "#111113", color: "#fff", fontSize: 11, fontWeight: 850, cursor: "pointer" },
  positionFilters: { display: "flex", gap: 4, flexWrap: "wrap" },
  filterButton: { minWidth: 38, minHeight: 34, padding: "6px 9px", borderRadius: 7, border: "1px solid #333338", background: "#17171a", color: "#aeb1b7", fontSize: 9, fontWeight: 950, cursor: "pointer" },
  activeFilterButton: { border: "1px solid #ff5a00", background: "#351006", color: "#fff" },
  playerTableHead: { display: "grid", gridTemplateColumns: "34px minmax(0,1fr) 42px 52px 66px 62px 62px", gap: 5, padding: "6px 7px", color: "#6f737c", fontSize: 7, fontWeight: 950, textTransform: "uppercase", alignItems: "center" },
  playerList: { maxHeight: 590, overflowY: "auto", overflowX: "hidden", paddingRight: 2 },
  playerRow: { display: "grid", gridTemplateColumns: "34px minmax(0,1fr) 42px 52px 66px 62px 62px", gap: 5, alignItems: "center", minHeight: 52, padding: "5px 7px", borderTop: "1px solid #232327", background: "#111113" },
  draftedPlayerRow: { opacity: .52, background: "#0b0b0d" },
  draftRank: { color: "#ff7a28", fontSize: 12, fontWeight: 950, textAlign: "center" },
  projectionValue: { color: "#f1f2f4", fontSize: 10, fontWeight: 900, textAlign: "right", fontVariantNumeric: "tabular-nums" },
  playerIdentity: { display: "flex", alignItems: "center", gap: 8, minWidth: 0 },
  playerTextBlock: { minWidth: 0 },
  headshot: { width: 36, height: 36, borderRadius: 6, objectFit: "cover", background: "#202024", flexShrink: 0 },
  headshotFallback: { width: 36, height: 36, display: "grid", placeItems: "center", borderRadius: 6, background: "#222227", color: "#ff7a28", fontSize: 9, fontWeight: 950, flexShrink: 0 },
  playerName: { fontSize: 11, fontWeight: 900, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  playerMeta: { display: "block", marginTop: 2, color: "#7d818a", fontSize: 9 },
  positionBadge: { color: "#ff8a3d", fontSize: 10, fontWeight: 950 },
  teamBadge: { color: "#d5d7dc", fontSize: 9, fontWeight: 950 },
  statusText: { color: "#a7aab1", fontSize: 9 },
  activeBadge: { color: "#35c46a", fontSize: 8, fontWeight: 950, letterSpacing: .35 },
  draftedBadge: { color: "#777b83", fontSize: 8, fontWeight: 950 },
  queueButton: { minHeight: 32, padding: "5px 7px", borderRadius: 6, border: "1px solid #3a3a40", background: "#18181b", color: "#c7cad0", fontSize: 8, fontWeight: 950, cursor: "pointer" },
  queueButtonActive: { border: "1px solid #ff6a00", background: "#321006", color: "#fff" },
  draftButton: { minHeight: 32, padding: "5px 8px", border: 0, borderRadius: 6, background: "linear-gradient(135deg,#b91c00,#ff5a00)", color: "#fff", fontSize: 8, fontWeight: 950, cursor: "pointer" },
  disabledButton: { opacity: .34, cursor: "not-allowed" },
  simpleList: { maxHeight: 650, overflowY: "auto", padding: 8 },
  noPlayers: { padding: 24, color: "#777b83", textAlign: "center", fontSize: 11 },
  queueRow: { display: "grid", gridTemplateColumns: "34px minmax(0,1fr) 74px 68px", gap: 8, alignItems: "center", padding: "8px 7px", borderBottom: "1px solid #232327" },
  rankingRow: { display: "grid", gridTemplateColumns: "34px minmax(0,1fr) 76px", gap: 8, alignItems: "center", padding: "8px 7px", borderBottom: "1px solid #232327" },
  queueRank: { color: "#ff7a28", fontSize: 11, fontWeight: 950, textAlign: "center" },
  queuePlayerInfo: { minWidth: 0, fontSize: 11 },
  removeQueueButton: { minHeight: 30, borderRadius: 6, border: "1px solid #3b3b40", background: "#17171a", color: "#b9bcc3", fontSize: 8, fontWeight: 900, cursor: "pointer" },
  historyRow: { display: "grid", gridTemplateColumns: "52px minmax(0,1fr)", gap: 8, alignItems: "center", padding: "8px 7px", borderBottom: "1px solid #232327" },
  historyPick: { color: "#ff6a00", fontSize: 11, fontWeight: 950 },
  boardScroller: { maxHeight: 680, overflow: "auto", WebkitOverflowScrolling: "touch", padding: 8 },
  board: { display: "flex", flexDirection: "column", gap: 6 },
  boardHeaderRow: { position: "sticky", top: 0, zIndex: 3, display: "grid", gap: 5, background: "#0e0e10", paddingBottom: 4 },
  boardTeamHeader: { minHeight: 35, display: "flex", alignItems: "center", justifyContent: "center", padding: "5px 7px", border: "1px solid #2d2d32", borderRadius: 6, background: "#17171a", color: "#aeb1b7", fontSize: 9, fontWeight: 950, textAlign: "center" },
  myBoardTeamHeader: { border: "1px solid #ff5a00", background: "#321006", color: "#fff" },
  boardRound: { display: "flex", flexDirection: "column", gap: 4 },
  roundLabel: { position: "sticky", left: 0, width: "fit-content", padding: "3px 7px", borderRadius: 5, background: "#242428", color: "#8d9199", fontSize: 8, fontWeight: 950 },
  boardRow: { display: "grid", gap: 5 },
  boardCell: { minHeight: 92, padding: 8, borderRadius: 7, border: "1px solid #28282d", background: "#141416" },
  currentBoardCell: { border: "1px solid #ff5a00", background: "#291006", boxShadow: "inset 0 0 0 1px rgba(255,90,0,.18)" },
  myBoardCell: { boxShadow: "inset 0 0 0 1px rgba(255,106,0,.42)" },
  boardPickNumber: { color: "#ff6a00", fontSize: 8, fontWeight: 950 },
  boardTeamName: { marginTop: 2, color: "#747882", fontSize: 8, fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  boardPlayerName: { marginTop: 9, fontSize: 10, fontWeight: 950, lineHeight: 1.15 },
  boardPosition: { marginTop: 3, color: "#ff8a3d", fontSize: 9, fontWeight: 950 },
  boardEmpty: { marginTop: 13, color: "#5f636b", fontSize: 8, fontWeight: 950 },
  pickControlBody: { padding: 12, textAlign: "center" },
  pickControlTeam: { fontSize: 15, fontWeight: 950 },
  pickControlMeta: { marginTop: 4, color: "#777b83", fontSize: 9 },
  pickControlClock: { marginTop: 12, fontSize: 34, fontWeight: 950, letterSpacing: 1 },
  pickControlHint: { marginTop: 10, color: "#8d9199", fontSize: 9, lineHeight: 1.45 },
  recentList: { maxHeight: 370, overflowY: "auto", padding: 6 },
  recentRow: { display: "flex", alignItems: "center", gap: 7, padding: "7px 5px", borderBottom: "1px solid #222226" },
  recentPickNumber: { width: 34, color: "#ff6a00", fontSize: 9, fontWeight: 950, flexShrink: 0 },
  recentInfo: { display: "flex", flexDirection: "column", minWidth: 0, fontSize: 9 },
  historyRailList: { maxHeight: 720, overflowY: "auto", padding: 6 },
  historyRailRow: { display: "grid", gridTemplateColumns: "42px minmax(0,1fr)", gap: 7, padding: "8px 6px", borderBottom: "1px solid #222226" },
  historyRailPick: { color: "#ff6a00", fontSize: 10, fontWeight: 950, paddingTop: 2 },
  historyRailInfo: { display: "flex", flexDirection: "column", minWidth: 0, gap: 2, fontSize: 9 },
  rosterSelectorWrap: { padding: 8, borderBottom: "1px solid #242428" },
  rosterSelect: { width: "100%", minHeight: 38, padding: "7px 9px", borderRadius: 7, border: "1px solid #38383d", background: "#09090b", color: "#fff", fontSize: 11, fontWeight: 850 },
  rosterTeamLabel: { marginTop: 7, color: "#ff7a28", fontSize: 10, fontWeight: 950, textTransform: "uppercase" },
  rosterSlotList: { maxHeight: 650, overflowY: "auto", padding: 7 },
  rosterSlotGroup: { marginBottom: 7, border: "1px solid #29292e", borderRadius: 7, overflow: "hidden", background: "#111113" },
  rosterSlotHead: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 8px", background: "#19191c", color: "#ff8a3d", fontSize: 9, fontWeight: 950 },
  rosterMiniPlayers: { padding: "3px 6px 5px" },
  rosterMiniPlayer: { display: "flex", justifyContent: "space-between", gap: 8, padding: "5px 2px", borderBottom: "1px solid #222226", color: "#e6e7ea", fontSize: 9 },
  rosterEmptySlot: { padding: "5px 2px", borderBottom: "1px solid #1d1d20", color: "#555962", fontSize: 8, fontStyle: "italic" },
  rosterFooter: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 11px", borderTop: "1px solid #29292d", background: "#171719", color: "#9da0a7", fontSize: 9, fontWeight: 950 },
  playerNameButton: { display: "block", width: "100%", padding: 0, border: 0, background: "transparent", color: "#fff", textAlign: "left", fontSize: 11, fontWeight: 950, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", cursor: "pointer", textDecoration: "underline", textDecorationColor: "rgba(255,106,0,.55)", textUnderlineOffset: 2 },
  modalBackdrop: { position: "fixed", inset: 0, zIndex: 1000, display: "grid", placeItems: "center", padding: 14, background: "rgba(0,0,0,.78)", overflowY: "auto" },
  playerModal: { width: "min(820px,100%)", maxHeight: "calc(100vh - 28px)", overflowY: "auto", border: "1px solid rgba(255,96,25,.55)", borderRadius: 14, background: "#0b0b0d", boxShadow: "0 24px 80px rgba(0,0,0,.6)" },
  modalHeader: { position: "sticky", top: 0, zIndex: 2, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: 14, borderBottom: "1px solid #29292d", background: "linear-gradient(135deg,#1b0c08,#101012 65%)" },
  modalIdentity: { display: "flex", alignItems: "center", gap: 11, minWidth: 0 },
  modalHeadshot: { width: 54, height: 54, flex: "0 0 54px", borderRadius: 9, objectFit: "cover", background: "#202024" },
  modalEyebrow: { color: "#ff6a00", fontSize: 8, fontWeight: 950, letterSpacing: .9 },
  modalTitle: { margin: "2px 0 0", fontSize: "clamp(19px,4vw,27px)", lineHeight: 1.05 },
  modalMeta: { marginTop: 5, color: "#969aa3", fontSize: 10, fontWeight: 800 },
  modalClose: { width: 38, height: 38, flex: "0 0 38px", borderRadius: 8, border: "1px solid #3a3a40", background: "#18181b", color: "#fff", fontSize: 24, lineHeight: 1, cursor: "pointer" },
  modalBody: { display: "grid", gap: 12, padding: 12 },
  statSection: { overflow: "hidden", border: "1px solid #29292d", borderRadius: 10, background: "#101012" },
  statSectionHead: { display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap", padding: "11px 12px", borderBottom: "1px solid #34343a", background: "#171719", color: "#fff", fontSize: 10 },
  statGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(105px,1fr))", gap: 1, background: "#34343a" },
  statTile: { display: "flex", flexDirection: "column", justifyContent: "center", gap: 4, minWidth: 0, minHeight: 68, padding: "9px 10px", background: "#101012", textAlign: "center" },
  statLabel: { display: "block", color: "#8f939c", fontSize: 9, fontWeight: 950, letterSpacing: .45, textTransform: "uppercase" },
  statValue: { display: "block", color: "#fff", fontSize: 18, fontWeight: 950, lineHeight: 1.05, fontVariantNumeric: "tabular-nums" },
  rookieNotice: { display: "flex", flexDirection: "column", gap: 5, padding: 18, color: "#c9cbd0", textAlign: "center", fontSize: 10 },
  modalNotice: { padding: 18, color: "#aeb1b7", textAlign: "center", fontSize: 10 },
  modalError: { padding: 18, color: "#fecaca", textAlign: "center", fontSize: 10 },
  mainTabs: { display: "flex", gap: 5, overflowX: "auto", marginBottom: 10, padding: 4, border: "1px solid #29292d", borderRadius: 10, background: "#0d0d0f", WebkitOverflowScrolling: "touch" },
  mainTab: { minHeight: 40, flex: "0 0 auto", padding: "8px 14px", border: "1px solid #333338", borderRadius: 8, background: "#151518", color: "#aeb1b7", fontSize: 10, fontWeight: 950, cursor: "pointer", textTransform: "uppercase" },
  mainTabActive: { border: "1px solid #ff5a00", background: "linear-gradient(135deg,#4b1300,#1a0c08)", color: "#fff" },
  tradePanel: { marginBottom: 10, border: "1px solid #29292d", borderRadius: 12, background: "#0e0e10", overflow: "hidden" },
  tradeSubtabs: { display: "flex", gap: 4, overflowX: "auto", padding: 8, borderBottom: "1px solid #29292d" },
  tradeLayout: { display: "grid", gridTemplateColumns: "minmax(180px,240px) minmax(0,1fr)", minHeight: 560 },
  tradeTeams: { padding: 8, borderRight: "1px solid #29292d", overflowY: "auto" },
  tradeTeamButton: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, width: "100%", minHeight: 42, marginBottom: 5, padding: "8px 10px", border: "1px solid #333338", borderRadius: 7, background: "#151518", color: "#ddd", textAlign: "left", fontWeight: 900, cursor: "pointer" },
  tradeTeamButtonActive: { border: "1px solid #ff5a00", background: "#321006", color: "#fff" },
  tradeWorkspace: { minWidth: 0, padding: 8 },
  chatList: { height: 164, maxHeight: 164, overflowY: "auto", overscrollBehavior: "contain", padding: 8, border: "1px solid #252529", borderRadius: 8, background: "#09090b", scrollbarGutter: "stable" },
  chatMessage: { display: "flex", flexDirection: "column", gap: 3, padding: "8px 6px", borderBottom: "1px solid #222226", fontSize: 10 },
  chatComposer: { display: "flex", gap: 7, padding: "8px 0" },
  offerBuilder: { marginTop: 6, padding: 10, border: "1px solid #33251f", borderRadius: 9, background: "#100e0d" },
  assetGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 8, padding: 10 },
  assetColumn: { minWidth: 0, border: "1px solid #29292d", borderRadius: 8, background: "#101012", overflow: "hidden" },
  assetHeading: { display: "block", padding: "9px 10px", borderBottom: "1px solid #29292d", color: "#ff7a28", fontSize: 9, letterSpacing: .7 },
  assetRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, minHeight: 38, padding: "7px 9px", borderBottom: "1px solid #222226", color: "#e5e7eb", fontSize: 10, cursor: "pointer" },
  tradeTextarea: { width: "100%", minHeight: 72, margin: "8px 0", padding: 9, resize: "vertical", borderRadius: 7, border: "1px solid #34343a", background: "#08080a", color: "#fff", fontFamily: "inherit" },
  offerList: { display: "grid", gap: 8, padding: 10 },
  offerCard: { display: "flex", flexDirection: "column", gap: 7, padding: 11, border: "1px solid #2b2b30", borderRadius: 9, background: "#111113", fontSize: 11 },
  assetGroupTitle: { padding: "8px 10px 6px", borderBottom: "1px solid #29292d", background: "#171719", color: "#9da0a7", fontSize: 8, fontWeight: 950, letterSpacing: .8 },
  assetEmpty: { padding: "10px", color: "#666b74", fontSize: 9, fontStyle: "italic" },
  offerCardHead: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, paddingBottom: 8, borderBottom: "1px solid #29292d" },
  offerNumber: { marginTop: 3, color: "#ff7a28", fontSize: 9, fontWeight: 900 },
  pendingTradeGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 8 },
  pendingTradeSide: { minWidth: 0, overflow: "hidden", border: "1px solid #29292d", borderRadius: 8, background: "#0d0d0f" },
  pendingTradeHeading: { display: "block", padding: "9px 10px", background: "linear-gradient(135deg,#321006,#151518)", color: "#fff", fontSize: 10, letterSpacing: .6 },
  pendingAssetLabel: { padding: "7px 9px 5px", borderTop: "1px solid #242428", borderBottom: "1px solid #242428", background: "#171719", color: "#ff7a28", fontSize: 8, fontWeight: 950, letterSpacing: .7 },
  pendingAssetRow: { padding: "8px 9px", borderBottom: "1px solid #202024", color: "#e5e7eb", fontSize: 10, fontWeight: 800 },
  pendingAssetEmpty: { padding: "8px 9px", color: "#646872", fontSize: 9, fontStyle: "italic" },
  tradeNeedChip: { display: "inline-flex", alignItems: "center", minHeight: 32, padding: "7px 10px", borderRadius: 999, border: "1px solid #5b2517", background: "linear-gradient(180deg, #2a130d, #160d0a)", color: "#ffb36b", fontSize: 10, fontWeight: 900, textTransform: "uppercase", letterSpacing: ".04em" },
  notificationBadge: { display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 22, height: 22, padding: "0 6px", borderRadius: 999, border: "1px solid #ff6a00", background: "linear-gradient(135deg,#8f1f00,#ff4d00)", color: "#fff", fontSize: 9, fontWeight: 950, lineHeight: 1, boxShadow: "0 0 14px rgba(255,77,0,.28)" },
  compactAssetGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 8, margin: "9px 0" },
  assetDetails: { minWidth: 0, overflow: "hidden", border: "1px solid #33251f", borderRadius: 9, background: "#101012" },
  assetSummary: { padding: "11px 12px", cursor: "pointer", color: "#ff8a3d", fontSize: 10, fontWeight: 950, letterSpacing: .5, listStylePosition: "inside" },
  assetSubDetails: { borderTop: "1px solid #29292d", background: "#0d0d0f" },
  assetSubSummary: { padding: "9px 11px", cursor: "pointer", color: "#c9cbd0", fontSize: 9, fontWeight: 950, letterSpacing: .5, listStylePosition: "inside" },
  assetScroll: { maxHeight: 230, overflowY: "auto", overscrollBehavior: "contain", scrollbarGutter: "stable" },
  compactOfferSummary: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, cursor: "pointer", color: "#fff", listStylePosition: "inside" },
  autoDraftBar: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 10, padding: 12, border: "1px solid rgba(255,90,0,.42)", borderRadius: 10, background: "linear-gradient(135deg,#1f0b05,#101012 62%)" },
  autoDraftInfo: { display: "flex", flexDirection: "column", gap: 3, minWidth: 0, flex: "1 1 260px" },
  autoDraftPlayer: { color: "#fff", fontSize: 14, fontWeight: 950, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  autoDraftControls: { display: "flex", gap: 7, flexWrap: "wrap" },
  autoToggle: { minHeight: 40, padding: "8px 12px", border: "1px solid #4a4a50", borderRadius: 8, background: "#17171a", color: "#c7c9ce", fontSize: 10, fontWeight: 950, cursor: "pointer" },
  autoToggleOn: { border: "1px solid #ff5a00", background: "linear-gradient(135deg,#641800,#2b0c04)", color: "#fff", boxShadow: "0 0 18px rgba(255,90,0,.16)" },
  soundButton: { minHeight: 40, padding: "8px 12px", border: "1px solid #38383e", borderRadius: 8, background: "#121214", color: "#fff", fontSize: 10, fontWeight: 950, cursor: "pointer" },
  rankingsTableScroll: { maxHeight: 650, overflowY: "auto", overflowX: "hidden", WebkitOverflowScrolling: "touch" },
  rankingsTable: { width: "100%", minWidth: 0 },
  rankingsTableHead: { display: "grid", gridTemplateColumns: "34px minmax(140px,1fr) 44px 36px 58px 52px 128px", gap: 6, alignItems: "center", minHeight: 38, padding: "7px 9px", position: "sticky", top: 0, zIndex: 2, borderBottom: "1px solid #34343a", background: "#171719", color: "#8f939c", fontSize: 8, fontWeight: 950, textAlign: "center", letterSpacing: .45 },
  rankingsTableRow: { display: "grid", gridTemplateColumns: "34px minmax(140px,1fr) 44px 36px 58px 52px 128px", gap: 6, alignItems: "center", minHeight: 58, padding: "6px 9px", borderBottom: "1px solid #232327", background: "#101012" },
  myRankValue: { color: "#ff6500", fontSize: 13, fontWeight: 950, textAlign: "center" },
  g365RankValue: { color: "#fff", fontSize: 10, fontWeight: 900, textAlign: "center" },
  rankCenter: { color: "#d4d6db", fontSize: 9, fontWeight: 850, textAlign: "center" },
  rankNumber: { color: "#f1f2f4", fontSize: 10, fontWeight: 900, textAlign: "right", fontVariantNumeric: "tabular-nums" },
  rankingPlayerIdentity: { display: "flex", alignItems: "center", gap: 7, minWidth: 0 },
  rankingPlayerText: { display: "flex", flexDirection: "column", gap: 2, minWidth: 0 },
  rankingPlayerMeta: { color: "#8f939c", fontSize: 7, fontWeight: 850, whiteSpace: "nowrap" },
  rankingHeadshot: { width: 34, height: 34, flex: "0 0 34px", borderRadius: 7, objectFit: "cover", background: "#202024" },
  rankingHeadshotFallback: { width: 34, height: 34, flex: "0 0 34px", display: "grid", placeItems: "center", borderRadius: 7, background: "#222227", color: "#ff7a28", fontSize: 12, fontWeight: 950 },
  rankingPlayerButton: { minWidth: 0, padding: 0, border: 0, background: "transparent", color: "#fff", fontSize: 10, fontWeight: 950, textAlign: "left", cursor: "pointer", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textDecoration: "underline", textDecorationColor: "rgba(255,106,0,.45)", textUnderlineOffset: 2 },
  playerPositionGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 7, padding: 8, borderTop: "1px solid #29292d" },
  pickYearGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(145px,1fr))", gap: 7, padding: 8, borderTop: "1px solid #29292d" },
  pickYearDetails: { minWidth: 0, alignSelf: "start", overflow: "hidden", border: "1px solid #35353a", borderRadius: 8, background: "#111113" },
  pickYearSummary: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, minHeight: 42, padding: "8px 10px", cursor: "pointer", listStyle: "none", background: "linear-gradient(180deg,#1b1b1f,#121214)", color: "#fff", fontSize: 10, fontWeight: 950 },
  pickYearList: { maxHeight: 240, overflowY: "auto", scrollbarGutter: "stable" },
  pickAssetRow: { display: "grid", gridTemplateColumns: "22px minmax(0,1fr)", alignItems: "center", gap: 7, minHeight: 43, padding: "7px 8px", borderTop: "1px solid #252529", color: "#e5e7eb", fontSize: 9, lineHeight: 1.35, cursor: "pointer" },
  tradeBlockTitle: { display: "block", color: "#fff", fontSize: 12, fontWeight: 950, letterSpacing: .35 },
  tradeBlockHelp: { maxWidth: 680, marginTop: 7, color: "#a4a7ae", fontSize: 10, lineHeight: 1.5, fontWeight: 700 },
  tradeBlockTeamNeeds: { display: "block", marginTop: 6, color: "#ff7a28", fontSize: 9, fontWeight: 900, letterSpacing: .25 },
  rankingActions: { display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 5, flexWrap: "wrap" },
  rankMoveButton: { width: 34, height: 34, border: "1px solid #3a3a40", borderRadius: 7, background: "#17171a", color: "#fff", fontSize: 16, fontWeight: 950, cursor: "pointer" },
};