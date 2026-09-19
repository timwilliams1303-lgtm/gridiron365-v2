"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  paused_at: string | null;
  completed_at: string | null;
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
};

type RpcJson = Record<string, unknown>;

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
    "players" | "queue" | "rankings" | "board"
  >("players");
  const [queueIds, setQueueIds] = useState<number[]>([]);
  const [nowMs, setNowMs] = useState(() => Date.now());

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
            p_season: loadedLeague.season,
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
              paused_at:
                typeof draftState?.pausedAt === "string"
                  ? draftState.pausedAt
                  : null,
              completed_at:
                typeof draftState?.completedAt === "string"
                  ? draftState.completedAt
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

        setDraftTeams(
          (draftTeamsResult.data as DraftTeamRow[] | null) ?? []
        );

        setDraftPicks(
          (draftPicksResult.data as DraftPickRow[] | null) ?? []
        );
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
        "get_nhl_traditional_player_season_totals",
        {
          p_league_id: leagueId,
          p_season: league.season - 1,
          p_season_type: "regular",
        }
      );

      if (totalsError) throw totalsError;

      const rows = Array.isArray(data) ? (data as SeasonTotalsRow[]) : [];
      const match =
        rows.find(
          (row) =>
            Number(row.nhl_player_id ?? row.player_id ?? row.id) === playerId
        ) ?? null;

      setDetailLastSeason(match);
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
    if (!draft || draftTeams.length === 0) {
      return [];
    }

    const teamCount = draftTeams.length;

    const picksByOverall = new Map(
      draftPicks.map((pick) => [
        pick.overall_pick,
        pick,
      ])
    );

    const cells: DraftBoardCell[] = [];

    for (
      let round = 1;
      round <= draft.rounds;
      round += 1
    ) {
      for (
        let pickInRound = 1;
        pickInRound <= teamCount;
        pickInRound += 1
      ) {
        const overallPick =
          (round - 1) * teamCount + pickInRound;

        const snakeSlot =
          round % 2 === 1
            ? pickInRound
            : teamCount - pickInRound + 1;

        const draftTeam = draftTeams.find(
          (team) => team.draft_slot === snakeSlot
        );

        if (!draftTeam) {
          continue;
        }

        const pick = picksByOverall.get(overallPick);

        cells.push({
          overallPick,
          round,
          pickInRound,
          draftSlot: snakeSlot,
          fantasyTeamId: draftTeam.fantasy_team_id,
          teamName:
            fantasyTeamById.get(
              draftTeam.fantasy_team_id
            )?.team_name ??
            `Team ${draftTeam.fantasy_team_id}`,
          player: pick
            ? playerById.get(pick.nhl_player_id) ?? null
            : null,
          isCurrent:
            draft.status === "drafting" &&
            draft.current_overall_pick === overallPick,
        });
      }
    }

    return cells;
  }, [
    draft,
    draftPicks,
    draftTeams,
    fantasyTeamById,
    playerById,
  ]);

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

  const leagueFormat =
    settings?.league_format === "dynasty" ? "Dynasty" : "Redraft";

  const positionMode =
    settings?.position_mode === "fdg" ? "F / D / G" : "C / LW / RW / D / G";

  const positionFilters =
    settings?.position_mode === "fdg"
      ? ["ALL", "F", "D", "G"]
      : ["ALL", "C", "LW", "RW", "D", "G"];

  const totalPicks = draft ? draft.rounds * draftTeams.length : 0;

  const currentPickStartedAt = (() => {
    if (!draft || draft.status !== "drafting") return null;
    const lastPick = draftPicks[draftPicks.length - 1];
    const raw = lastPick?.picked_at ?? draft.started_at;
    if (!raw) return null;
    const parsed = Date.parse(raw);
    return Number.isFinite(parsed) ? parsed : null;
  })();

  const timerEnabled = Boolean(draft && draft.seconds_per_pick > 0);

  const remainingSeconds =
    draft && timerEnabled && currentPickStartedAt != null
      ? Math.max(
          0,
          draft.seconds_per_pick -
            Math.floor((nowMs - currentPickStartedAt) / 1000)
        )
      : draft?.seconds_per_pick ?? 0;

  const clockText = timerEnabled
    ? `${Math.floor(remainingSeconds / 60)}:${String(
        remainingSeconds % 60
      ).padStart(2, "0")}`
    : "NO TIMER";

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

  const rankingPlayers = [...players]
    .filter((player) => !draftedPlayerIds.has(player.id))
    .sort((a, b) => playerName(a).localeCompare(playerName(b)));

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

  function toggleQueue(playerId: number) {
    setQueueIds((current) =>
      current.includes(playerId)
        ? current.filter((id) => id !== playerId)
        : [...current, playerId]
    );
  }

  return (
    <main style={styles.page}>
      <style>{`
        @media (max-width: 1050px) {
          .g365-nhl-draft-room { grid-template-columns: 1fr !important; }
          .g365-nhl-draft-left, .g365-nhl-draft-right { display: block !important; }
        }
        @media (max-width: 720px) {
          .g365-nhl-player-head { grid-template-columns: 30px minmax(0,1fr) 36px 58px 54px 54px !important; gap: 4px !important; padding-left: 5px !important; padding-right: 5px !important; }
          .g365-nhl-player-row { grid-template-columns: 30px minmax(0,1fr) 36px 58px 54px 54px !important; gap: 4px !important; padding-left: 5px !important; padding-right: 5px !important; }
          .g365-nhl-player-head span:nth-child(4),
          .g365-nhl-player-row > div:nth-child(4) { display: none !important; }
        }
      `}</style>
      <div style={styles.container}>
        <section style={styles.topBar}>
          <div style={styles.brandBlock}>
            <div style={styles.eyebrow}>GRIDIRON365 • NHL TRADITIONAL</div>
            <div style={styles.draftTitleRow}>
              <h1 style={styles.title}>Live Draft</h1>
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
                <div style={styles.clockMeta}>
                  {picksUntilMine == null
                    ? "No upcoming pick"
                    : picksUntilMine === 0
                      ? "YOU ARE ON THE CLOCK"
                      : `${picksUntilMine} pick${picksUntilMine === 1 ? "" : "s"} away`}
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

            <section style={styles.draftTickerShell}>
              <div style={styles.draftTickerLabel}>DRAFT TICKER</div>
              <div style={styles.draftTickerScroller}>
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
                        style={{
                          ...styles.draftTickerPick,
                          ...(isOnClock ? styles.draftTickerCurrent : {}),
                          ...(isMine && !isOnClock ? styles.draftTickerMine : {}),
                        }}
                      >
                        <div style={styles.draftTickerNumber}>
                          {cell.overallPick}
                        </div>
                        <div style={styles.draftTickerInfo}>
                          {pickedPlayer ? (
                            <>
                              <strong style={styles.draftTickerPrimary}>
                                {playerName(pickedPlayer)}
                              </strong>
                              <span style={styles.draftTickerSecondary}>
                                {normalizePosition(
                                  pickedPlayer.position,
                                  pickedPlayer.position_group
                                )} • {cell.teamName}
                              </span>
                            </>
                          ) : isOnClock ? (
                            <>
                              <strong style={styles.draftTickerPrimary}>
                                ON THE CLOCK
                              </strong>
                              <span style={styles.draftTickerSecondary}>
                                {cell.teamName}
                              </span>
                            </>
                          ) : (
                            <>
                              <strong style={styles.draftTickerPrimary}>
                                {cell.teamName}
                              </strong>
                              <span style={styles.draftTickerSecondary}>
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
                    {draft.rounds} rounds • {draftTeams.length} teams • snake order
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
                <section style={styles.sideCard}>
                  <div style={styles.cardHead}>
                    <span style={styles.cardTitle}>DRAFT HISTORY</span>
                    <span style={styles.cardMeta}>{draftPicks.length} PICKS</span>
                  </div>
                  <div style={styles.historyRailList}>
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
                </section>
              </aside>

              <section style={styles.centerColumn}>
                <nav style={styles.workspaceTabs} aria-label="NHL draft workspace">
                  {(
                    [
                      ["players", "Players"],
                      ["queue", "Queue"],
                      ["rankings", "My Rankings"],
                      ["board", "Draft Board"],
                    ] as const
                  ).map(([tab, label]) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setActiveTab(tab)}
                      style={{
                        ...styles.workspaceTab,
                        ...(activeTab === tab ? styles.workspaceTabActive : {}),
                      }}
                    >
                      {label}
                      {tab === "queue" && queuedPlayers.length > 0 ? (
                        <span style={styles.tabCount}>{queuedPlayers.length}</span>
                      ) : null}
                    </button>
                  ))}
                </nav>

                <section style={styles.workspace}>
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
                              ? "Current NHL player list for your ranking workspace. Persistent custom rankings are the next backend step."
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
                              <div style={styles.draftRank}>
                                {ranking?.overall_rank ?? "—"}
                              </div>

                              <div style={styles.playerIdentity}>
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

                              <div style={styles.positionBadge}>{pos}</div>

                              <div style={styles.teamBadge}>
                                {player.team_id != null
                                  ? nhlTeamLabel(nhlTeamById.get(player.team_id))
                                  : "FA"}
                              </div>

                              <div style={styles.projectionValue}>
                                {ranking?.projected_fantasy_points != null
                                  ? Number(ranking.projected_fantasy_points).toFixed(2)
                                  : "—"}
                              </div>

                              <button
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
                    <div style={styles.simpleList}>
                      {rankingPlayers.map((player, index) => (
                        <div key={player.id} style={styles.rankingRow}>
                          <span style={styles.queueRank}>{index + 1}</span>
                          <div style={styles.queuePlayerInfo}>
                            <strong>{playerName(player)}</strong>
                            <span style={styles.playerMeta}>
                              {normalizePosition(
                                player.position,
                                player.position_group
                              )}
                            </span>
                          </div>
                          <button
                            type="button"
                            style={{
                              ...styles.queueButton,
                              ...(queueIds.includes(player.id)
                                ? styles.queueButtonActive
                                : {}),
                            }}
                            onClick={() => toggleQueue(player.id)}
                          >
                            {queueIds.includes(player.id) ? "Queued" : "+ Queue"}
                          </button>
                        </div>
                      ))}
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
                            <div key={round} style={styles.boardRound}>
                              <div style={styles.roundLabel}>ROUND {round}</div>
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
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                </section>
              </section>

              <aside className="g365-nhl-draft-right" style={styles.rightRail}>
                <section style={styles.sideCard}>
                  <div style={styles.cardHead}>
                    <span style={styles.cardTitle}>ROSTERS</span>
                    <span style={styles.cardMeta}>{rosterPicks.length}/{draft.rounds}</span>
                  </div>
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
                </section>
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
};