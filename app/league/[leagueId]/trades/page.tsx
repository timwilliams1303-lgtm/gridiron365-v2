"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useParams } from "next/navigation";

type TradeStatus =
  | "pending"
  | "accepted"
  | "rejected"
  | "cancelled"
  | "executed"
  | "vetoed"
  | "expired";

type TradeSummary = {
  trade_offer_id: number;
  direction: "sent" | "received";
  status: TradeStatus;
  season: number;
  week: number;
  proposing_fantasy_team_id: number;
  proposing_team_name: string;
  receiving_fantasy_team_id: number;
  receiving_team_name: string;
  message: string | null;
  created_at: string;
  accepted_at: string | null;
  rejected_at: string | null;
  cancelled_at: string | null;
  executed_at: string | null;
  proposing_player_count: number;
  receiving_player_count: number;
  proposing_draft_pick_count?: number;
  receiving_draft_pick_count?: number;
};

type TradePlayer = {
  playerId: number;
  fullName: string;
  position: string;
  team: string | null;
  headshotUrl: string | null;
};

type TradePick = {
  assetId: number;
  draftSeason: number;
  roundNumber: number;
  originalFantasyTeamId: number;
  currentFantasyTeamId: number;
  pickNumber: number | null;
  overallPick: number | null;
  draftType: string;
};

type TradeDetail = {
  id: number;
  leagueId: string;
  season: number;
  week: number;
  status: string;
  message: string | null;
  createdAt: string;
  proposingTeam: {
    id: number;
    name: string;
    players: TradePlayer[];
    draftPicks: TradePick[];
  };
  receivingTeam: {
    id: number;
    name: string;
    players: TradePlayer[];
    draftPicks: TradePick[];
  };
};

type FantasyTeam = {
  id: number;
  team_name: string;
  owner_id: string | null;
};

type RosterPlayer = {
  fantasy_team_id: number;
  player_id: number;
  nfl_players:
    | {
        full_name: string;
        primary_position: string;
        team_abbreviation: string | null;
        headshot_url: string | null;
      }
    | {
        full_name: string;
        primary_position: string;
        team_abbreviation: string | null;
        headshot_url: string | null;
      }[]
    | null;
};

type ComposerPlayer = TradePlayer;

type DraftPickAssetRow = {
  id: number;
  league_id: string;
  draft_season: number;
  round_number: number;
  original_fantasy_team_id: number;
  current_fantasy_team_id: number;
  pick_number: number | null;
  overall_pick: number | null;
  draft_id: string | null;
  used_nfl_player_id: number | null;
  used_at: string | null;
  league_format: string;
  draft_type: string;
};

type TradeDraftPickRow = {
  trade_offer_id: number;
  league_id: string;
  draft_pick_asset_id: number;
  from_fantasy_team_id: number;
  to_fantasy_team_id: number;
};

type LeagueSettingsRow = {
  league_format: string;
  dynasty_protected_players: number;
  dynasty_future_pick_years: number;
  dynasty_annual_draft_rounds: number;
};

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function asTradePick(row: DraftPickAssetRow): TradePick {
  return {
    assetId: Number(row.id),
    draftSeason: Number(row.draft_season),
    roundNumber: Number(row.round_number),
    originalFantasyTeamId: Number(row.original_fantasy_team_id),
    currentFantasyTeamId: Number(row.current_fantasy_team_id),
    pickNumber: row.pick_number == null ? null : Number(row.pick_number),
    overallPick: row.overall_pick == null ? null : Number(row.overall_pick),
    draftType: row.draft_type,
  };
}

export default function TraditionalTradesPage() {
  const params = useParams<{ leagueId: string }>();
  const leagueId = params.leagueId;

  const [activeTab, setActiveTab] = useState<"incoming" | "sent" | "history">("incoming");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [season, setSeason] = useState(new Date().getFullYear());
  const [trades, setTrades] = useState<TradeSummary[]>([]);
  const [tradeDetails, setTradeDetails] = useState<Record<number, TradeDetail>>({});
  const [teams, setTeams] = useState<FantasyTeam[]>([]);
  const [myTeamId, setMyTeamId] = useState<number | null>(null);

  const [leagueFormat, setLeagueFormat] = useState("redraft");
  const [futurePickYears, setFuturePickYears] = useState(0);
  const [annualDraftRounds, setAnnualDraftRounds] = useState(0);

  const [composerOpen, setComposerOpen] = useState(false);
  const [selectedOpponentId, setSelectedOpponentId] = useState<number | null>(null);
  const [myRoster, setMyRoster] = useState<ComposerPlayer[]>([]);
  const [opponentRoster, setOpponentRoster] = useState<ComposerPlayer[]>([]);
  const [myPicks, setMyPicks] = useState<TradePick[]>([]);
  const [opponentPicks, setOpponentPicks] = useState<TradePick[]>([]);
  const [mySelectedPlayers, setMySelectedPlayers] = useState<number[]>([]);
  const [opponentSelectedPlayers, setOpponentSelectedPlayers] = useState<number[]>([]);
  const [mySelectedPicks, setMySelectedPicks] = useState<number[]>([]);
  const [opponentSelectedPicks, setOpponentSelectedPicks] = useState<number[]>([]);
  const [tradeMessage, setTradeMessage] = useState("");
  const [submitLoading, setSubmitLoading] = useState(false);

  const isDynasty = leagueFormat === "dynasty";

  const teamName = useCallback(
    (teamId: number) =>
      teams.find((team) => Number(team.id) === Number(teamId))?.team_name ??
      `Team ${teamId}`,
    [teams]
  );

  const loadTradeDetails = useCallback(
    async (summaries: TradeSummary[]) => {
      const next: Record<number, TradeDetail> = {};

      for (const trade of summaries) {
        const { data, error: detailError } = await supabase.rpc(
          "get_traditional_trade_offer_detail",
          { p_trade_offer_id: trade.trade_offer_id }
        );

        if (detailError || !data) continue;

        const detail = data as TradeDetail;
        detail.proposingTeam = {
          ...detail.proposingTeam,
          players: detail.proposingTeam?.players ?? [],
          draftPicks: [],
        };
        detail.receivingTeam = {
          ...detail.receivingTeam,
          players: detail.receivingTeam?.players ?? [],
          draftPicks: [],
        };

        const { data: linkRows, error: linkError } = await supabase
          .from("traditional_trade_draft_picks")
          .select(
            "trade_offer_id,league_id,draft_pick_asset_id,from_fantasy_team_id,to_fantasy_team_id"
          )
          .eq("trade_offer_id", trade.trade_offer_id);

        if (!linkError && linkRows?.length) {
          const links = linkRows as TradeDraftPickRow[];
          const assetIds = links.map((row) => Number(row.draft_pick_asset_id));

          const { data: assetRows, error: assetError } = await supabase
            .from("traditional_dynasty_draft_pick_assets")
            .select(
              "id,league_id,draft_season,round_number,original_fantasy_team_id,current_fantasy_team_id,pick_number,overall_pick,draft_id,used_nfl_player_id,used_at,league_format,draft_type"
            )
            .in("id", assetIds);

          if (!assetError && assetRows) {
            const assets = assetRows as DraftPickAssetRow[];
            const byId = new Map(assets.map((row) => [Number(row.id), asTradePick(row)]));

            for (const link of links) {
              const pick = byId.get(Number(link.draft_pick_asset_id));
              if (!pick) continue;

              if (
                Number(link.from_fantasy_team_id) ===
                Number(detail.proposingTeam.id)
              ) {
                detail.proposingTeam.draftPicks.push(pick);
              } else if (
                Number(link.from_fantasy_team_id) ===
                Number(detail.receivingTeam.id)
              ) {
                detail.receivingTeam.draftPicks.push(pick);
              }
            }
          }
        }

        next[trade.trade_offer_id] = detail;
      }

      setTradeDetails(next);
    },
    []
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data: sessionData } = await supabase.auth.getUser();
    const userId = sessionData.user?.id ?? null;

    if (!userId) {
      setError("You must be signed in.");
      setLoading(false);
      return;
    }

    const { data: leagueData, error: leagueError } = await supabase
      .from("leagues")
      .select("season")
      .eq("id", leagueId)
      .single();

    if (leagueError) {
      setError(leagueError.message);
      setLoading(false);
      return;
    }

    const currentSeason = Number(leagueData.season);
    setSeason(currentSeason);

    const [teamResult, myTeamResult, tradeResult, settingsResult] =
      await Promise.all([
        supabase
          .from("fantasy_teams")
          .select("id,team_name,owner_id")
          .eq("league_id", leagueId)
          .eq("active", true)
          .not("owner_id", "is", null)
          .order("team_name"),
        supabase
          .from("fantasy_teams")
          .select("id")
          .eq("league_id", leagueId)
          .eq("owner_id", userId)
          .eq("active", true)
          .maybeSingle(),
        supabase.rpc("get_my_traditional_trades", {
          p_league_id: leagueId,
          p_season: currentSeason,
        }),
        supabase
          .from("traditional_league_settings")
          .select(
            "league_format,dynasty_protected_players,dynasty_future_pick_years,dynasty_annual_draft_rounds"
          )
          .eq("league_id", leagueId)
          .eq("season", currentSeason)
          .maybeSingle(),
      ]);

    const firstError =
      teamResult.error ??
      myTeamResult.error ??
      tradeResult.error ??
      settingsResult.error;

    if (firstError) {
      setError(firstError.message);
      setLoading(false);
      return;
    }

    const loadedTeams = (teamResult.data ?? []) as FantasyTeam[];
    const summaries = (tradeResult.data ?? []) as TradeSummary[];
    const settings = settingsResult.data as LeagueSettingsRow | null;

    setTeams(loadedTeams);
    setMyTeamId(myTeamResult.data?.id ?? null);
    setTrades(summaries);
    setLeagueFormat(settings?.league_format ?? "redraft");
    setFuturePickYears(Number(settings?.dynasty_future_pick_years ?? 0));
    setAnnualDraftRounds(Number(settings?.dynasty_annual_draft_rounds ?? 0));

    await loadTradeDetails(summaries);
    setLoading(false);
  }, [leagueId, loadTradeDetails]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const incomingTrades = useMemo(
    () =>
      trades.filter(
        (trade) => trade.direction === "received" && trade.status === "pending"
      ),
    [trades]
  );

  const sentTrades = useMemo(
    () =>
      trades.filter(
        (trade) => trade.direction === "sent" && trade.status === "pending"
      ),
    [trades]
  );

  const historyTrades = useMemo(
    () => trades.filter((trade) => trade.status !== "pending"),
    [trades]
  );

  const visibleTrades =
    activeTab === "incoming"
      ? incomingTrades
      : activeTab === "sent"
        ? sentTrades
        : historyTrades;

  const tradePartners = useMemo(
    () =>
      teams.filter(
        (team) => team.id !== myTeamId && Boolean(team.owner_id)
      ),
    [teams, myTeamId]
  );

  async function loadRoster(fantasyTeamId: number) {
    const { data, error: rosterError } = await supabase
      .from("team_rosters")
      .select(`
        fantasy_team_id,
        player_id,
        nfl_players (
          full_name,
          primary_position,
          team_abbreviation,
          headshot_url
        )
      `)
      .eq("league_id", leagueId)
      .eq("fantasy_team_id", fantasyTeamId);

    if (rosterError) throw new Error(rosterError.message);

    const order = ["QB", "RB", "WR", "TE", "K", "DST"];

    return ((data ?? []) as RosterPlayer[])
      .map((row) => {
        const joined = Array.isArray(row.nfl_players)
          ? row.nfl_players[0]
          : row.nfl_players;

        return {
          playerId: row.player_id,
          fullName: joined?.full_name ?? "Unknown Player",
          position: joined?.primary_position ?? "—",
          team: joined?.team_abbreviation ?? null,
          headshotUrl: joined?.headshot_url ?? null,
        };
      })
      .sort((a, b) => {
        const ai = order.indexOf(a.position);
        const bi = order.indexOf(b.position);
        const av = ai === -1 ? 99 : ai;
        const bv = bi === -1 ? 99 : bi;
        return av !== bv ? av - bv : a.fullName.localeCompare(b.fullName);
      });
  }

  async function loadDraftPicks(fantasyTeamId: number) {
    if (!isDynasty) return [] as TradePick[];

    let query = supabase
      .from("traditional_dynasty_draft_pick_assets")
      .select(
        "id,league_id,draft_season,round_number,original_fantasy_team_id,current_fantasy_team_id,pick_number,overall_pick,draft_id,used_nfl_player_id,used_at,league_format,draft_type"
      )
      .eq("league_id", leagueId)
      .eq("league_format", "dynasty")
      .eq("draft_type", "dynasty")
      .eq("current_fantasy_team_id", fantasyTeamId)
      .is("used_nfl_player_id", null)
      .is("used_at", null)
      .gt("draft_season", season)
      .order("draft_season")
      .order("round_number");

    if (futurePickYears > 0) {
      query = query.lte("draft_season", season + futurePickYears);
    }

    const { data, error: pickError } = await query;
    if (pickError) throw new Error(pickError.message);

    return ((data ?? []) as DraftPickAssetRow[]).map(asTradePick);
  }

  async function openComposer() {
    if (!myTeamId) {
      setError("Your fantasy team could not be found.");
      return;
    }

    if (tradePartners.length === 0) {
      setError("There are no other owned teams available to trade with yet.");
      return;
    }

    try {
      setError(null);
      const [mine, picks] = await Promise.all([
        loadRoster(myTeamId),
        loadDraftPicks(myTeamId),
      ]);

      setMyRoster(mine);
      setMyPicks(picks);
      setOpponentRoster([]);
      setOpponentPicks([]);
      setSelectedOpponentId(null);
      setMySelectedPlayers([]);
      setOpponentSelectedPlayers([]);
      setMySelectedPicks([]);
      setOpponentSelectedPicks([]);
      setTradeMessage("");
      setComposerOpen(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load trade assets.");
    }
  }

  async function chooseOpponent(fantasyTeamId: number) {
    try {
      setSelectedOpponentId(fantasyTeamId);
      setOpponentSelectedPlayers([]);
      setOpponentSelectedPicks([]);

      const [roster, picks] = await Promise.all([
        loadRoster(fantasyTeamId),
        loadDraftPicks(fantasyTeamId),
      ]);

      setOpponentRoster(roster);
      setOpponentPicks(picks);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not load opponent assets."
      );
    }
  }

  function toggleId(
    id: number,
    setter: React.Dispatch<React.SetStateAction<number[]>>
  ) {
    setter((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id]
    );
  }

  async function submitTrade() {
    if (!myTeamId || !selectedOpponentId) {
      setError("Choose a team to trade with.");
      return;
    }

    const selectedOpponent = teams.find(
      (team) => team.id === selectedOpponentId
    );

    if (!selectedOpponent?.owner_id) {
      setError("Trades can only be sent to teams that currently have an owner.");
      return;
    }

    const myAssetCount = mySelectedPlayers.length + mySelectedPicks.length;
    const theirAssetCount =
      opponentSelectedPlayers.length + opponentSelectedPicks.length;

    if (myAssetCount === 0 || theirAssetCount === 0) {
      setError("Select at least one player or draft pick from each team.");
      return;
    }

    if (!isDynasty && (mySelectedPicks.length || opponentSelectedPicks.length)) {
      setError("Future draft-pick trading is only available in Dynasty leagues.");
      return;
    }

    setSubmitLoading(true);
    setError(null);

    try {
      const { data: stateData, error: stateError } = await supabase
        .from("traditional_season_state")
        .select("active_week")
        .eq("league_id", leagueId)
        .eq("season", season)
        .maybeSingle();

      if (stateError) throw new Error(stateError.message);

      const activeWeek = Number(stateData?.active_week ?? 0);

      const { data: tradeData, error: tradeError } = await supabase.rpc(
        "submit_traditional_trade_offer",
        {
          p_league_id: leagueId,
          p_season: season,
          p_week: activeWeek,
          p_proposing_fantasy_team_id: myTeamId,
          p_receiving_fantasy_team_id: selectedOpponentId,
          p_proposing_player_ids: mySelectedPlayers,
          p_receiving_player_ids: opponentSelectedPlayers,
          p_proposing_draft_pick_asset_ids: mySelectedPicks,
          p_receiving_draft_pick_asset_ids: opponentSelectedPicks,
          p_message: tradeMessage.trim() || null,
        }
      );

      if (tradeError) throw new Error(tradeError.message);
      if (!tradeData?.success) {
        throw new Error("The trade offer could not be created.");
      }

      setComposerOpen(false);
      setSelectedOpponentId(null);
      setMySelectedPlayers([]);
      setOpponentSelectedPlayers([]);
      setMySelectedPicks([]);
      setOpponentSelectedPicks([]);
      setTradeMessage("");
      setActiveTab("sent");
      await loadData();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not submit trade.");
    } finally {
      setSubmitLoading(false);
    }
  }

  async function runTradeAction(
    tradeOfferId: number,
    action: "accept" | "reject" | "cancel"
  ) {
    setActionLoading(tradeOfferId);
    setError(null);

    try {
      const functionName =
        action === "accept"
          ? "accept_traditional_trade_offer"
          : action === "reject"
            ? "reject_traditional_trade_offer"
            : "cancel_traditional_trade_offer";

      const { error: actionError } = await supabase.rpc(functionName, {
        p_trade_offer_id: tradeOfferId,
      });

      if (actionError) throw new Error(actionError.message);
      await loadData();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Trade action failed.");
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <main className="g365-trades-page" style={styles.page}>
      <style jsx global>{`
        @media (max-width: 760px) {
          .g365-trades-page { padding: 12px 10px 32px !important; overflow-x: hidden !important; }
          .g365-shell { width: 100% !important; min-width: 0 !important; }
          .g365-header { align-items: flex-start !important; flex-direction: column !important; }
          .g365-summary-grid { grid-template-columns: repeat(3,minmax(0,1fr)) !important; }
          .g365-package-grid, .g365-composer-grid { grid-template-columns: minmax(0,1fr) !important; }
          .g365-package-swap { min-height: 26px !important; }
          .g365-modal { width: 100% !important; max-height: 94vh !important; }
          .g365-modal-footer { align-items: stretch !important; flex-direction: column !important; }
          .g365-modal-actions { width: 100% !important; }
          .g365-modal-actions button { flex: 1 1 0 !important; min-height: 44px !important; }
          .g365-tabs { overflow-x: auto !important; flex-wrap: nowrap !important; }
          .g365-tabs button { flex: 0 0 auto !important; min-height: 42px !important; }
          .g365-trade-teams { flex-wrap: wrap !important; }
          .g365-asset-tabs { grid-template-columns: 1fr 1fr !important; }
          .g365-trades-page input, .g365-trades-page select, .g365-trades-page textarea {
            font-size: 16px !important; max-width: 100% !important; box-sizing: border-box !important;
          }
        }
      `}</style>

      <div className="g365-shell" style={styles.shell}>
        <header className="g365-header" style={styles.header}>
          <div>
            <p style={styles.eyebrow}>
              {isDynasty ? "TRADITIONAL DYNASTY" : "TRADITIONAL"}
            </p>
            <h1 style={styles.title}>Trades</h1>
            <p style={styles.subtitle}>
              {isDynasty
                ? "Trade rostered players and future Dynasty draft picks."
                : "Build player offers, review incoming deals, and track trade history."}
            </p>
            {isDynasty ? (
              <div style={styles.dynastyMeta}>
                <span>{futurePickYears} future pick year(s)</span>
                <span>•</span>
                <span>{annualDraftRounds} annual round(s)</span>
              </div>
            ) : null}
          </div>

          <button
            type="button"
            style={{
              ...styles.primaryButton,
              ...(tradePartners.length === 0 ? styles.disabledButton : {}),
            }}
            disabled={tradePartners.length === 0}
            onClick={() => void openComposer()}
          >
            {tradePartners.length === 0 ? "NO TRADE PARTNERS" : "+ MAKE TRADE"}
          </button>
        </header>

        {error ? <div style={styles.errorBox}>{error}</div> : null}

        <section className="g365-summary-grid" style={styles.summaryGrid}>
          <SummaryCard label="INCOMING" value={incomingTrades.length} />
          <SummaryCard label="SENT" value={sentTrades.length} />
          <SummaryCard label="HISTORY" value={historyTrades.length} />
        </section>

        <section style={styles.contentCard}>
          <div className="g365-tabs" style={styles.tabs}>
            <TabButton
              active={activeTab === "incoming"}
              label="Incoming"
              count={incomingTrades.length}
              onClick={() => setActiveTab("incoming")}
            />
            <TabButton
              active={activeTab === "sent"}
              label="Sent"
              count={sentTrades.length}
              onClick={() => setActiveTab("sent")}
            />
            <TabButton
              active={activeTab === "history"}
              label="History"
              count={historyTrades.length}
              onClick={() => setActiveTab("history")}
            />
          </div>

          {loading ? (
            <div style={styles.emptyState}>Loading trades...</div>
          ) : visibleTrades.length === 0 ? (
            <div style={styles.emptyState}>
              <strong style={styles.emptyTitle}>No trades here yet</strong>
              <span style={styles.emptyText}>
                {activeTab === "incoming"
                  ? "Incoming offers will appear here."
                  : activeTab === "sent"
                    ? "Your pending offers will appear here."
                    : "Completed, rejected, cancelled, and expired trades will appear here."}
              </span>
            </div>
          ) : (
            <div style={styles.tradeList}>
              {visibleTrades.map((trade) => (
                <TradeCard
                  key={trade.trade_offer_id}
                  trade={trade}
                  detail={tradeDetails[trade.trade_offer_id]}
                  loading={actionLoading === trade.trade_offer_id}
                  teamName={teamName}
                  onAccept={() =>
                    void runTradeAction(trade.trade_offer_id, "accept")
                  }
                  onReject={() =>
                    void runTradeAction(trade.trade_offer_id, "reject")
                  }
                  onCancel={() =>
                    void runTradeAction(trade.trade_offer_id, "cancel")
                  }
                />
              ))}
            </div>
          )}
        </section>
      </div>

      {composerOpen ? (
        <TradeComposer
          isDynasty={isDynasty}
          teams={tradePartners}
          teamName={teamName}
          myRoster={myRoster}
          opponentRoster={opponentRoster}
          myPicks={myPicks}
          opponentPicks={opponentPicks}
          selectedOpponentId={selectedOpponentId}
          mySelectedPlayers={mySelectedPlayers}
          opponentSelectedPlayers={opponentSelectedPlayers}
          mySelectedPicks={mySelectedPicks}
          opponentSelectedPicks={opponentSelectedPicks}
          message={tradeMessage}
          submitting={submitLoading}
          onClose={() => setComposerOpen(false)}
          onChooseOpponent={(teamId) => void chooseOpponent(teamId)}
          onToggleMyPlayer={(id) => toggleId(id, setMySelectedPlayers)}
          onToggleOpponentPlayer={(id) =>
            toggleId(id, setOpponentSelectedPlayers)
          }
          onToggleMyPick={(id) => toggleId(id, setMySelectedPicks)}
          onToggleOpponentPick={(id) =>
            toggleId(id, setOpponentSelectedPicks)
          }
          onMessageChange={setTradeMessage}
          onSubmit={() => void submitTrade()}
        />
      ) : null}
    </main>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div style={styles.summaryCard}>
      <span style={styles.summaryLabel}>{label}</span>
      <strong style={styles.summaryValue}>{value}</strong>
    </div>
  );
}

function TabButton({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...styles.tabButton,
        ...(active ? styles.tabButtonActive : {}),
      }}
    >
      {label}
      <span
        style={{
          ...styles.tabCount,
          ...(active ? styles.tabCountActive : {}),
        }}
      >
        {count}
      </span>
    </button>
  );
}

function TradeCard({
  trade,
  detail,
  loading,
  teamName,
  onAccept,
  onReject,
  onCancel,
}: {
  trade: TradeSummary;
  detail: TradeDetail | undefined;
  loading: boolean;
  teamName: (id: number) => string;
  onAccept: () => void;
  onReject: () => void;
  onCancel: () => void;
}) {
  const proposingCount =
    Number(trade.proposing_player_count ?? 0) +
    Number(trade.proposing_draft_pick_count ?? 0);
  const receivingCount =
    Number(trade.receiving_player_count ?? 0) +
    Number(trade.receiving_draft_pick_count ?? 0);

  return (
    <article style={styles.tradeCard}>
      <div style={styles.tradeHeader}>
        <div>
          <div className="g365-trade-teams" style={styles.tradeTeams}>
            <strong>{trade.proposing_team_name}</strong>
            <span style={styles.swapArrow}>⇄</span>
            <strong>{trade.receiving_team_name}</strong>
          </div>
          <span style={styles.tradeMeta}>
            Week {trade.week} • {new Date(trade.created_at).toLocaleDateString()}
          </span>
        </div>
        <StatusBadge status={trade.status} />
      </div>

      {detail ? (
        <div className="g365-package-grid" style={styles.packageGrid}>
          <TradePackage
            title={`${detail.proposingTeam.name} gives`}
            players={detail.proposingTeam.players}
            picks={detail.proposingTeam.draftPicks}
            teamName={teamName}
          />
          <div className="g365-package-swap" style={styles.packageSwap}>⇄</div>
          <TradePackage
            title={`${detail.receivingTeam.name} gives`}
            players={detail.receivingTeam.players}
            picks={detail.receivingTeam.draftPicks}
            teamName={teamName}
          />
        </div>
      ) : (
        <div style={styles.tradeCounts}>
          {proposingCount} asset(s) ⇄ {receivingCount} asset(s)
        </div>
      )}

      {trade.message ? <div style={styles.messageBox}>“{trade.message}”</div> : null}

      {trade.status === "pending" ? (
        <div style={styles.tradeActions}>
          {trade.direction === "received" ? (
            <>
              <button
                type="button"
                disabled={loading}
                onClick={onAccept}
                style={styles.acceptButton}
              >
                {loading ? "WORKING..." : "ACCEPT"}
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={onReject}
                style={styles.secondaryButton}
              >
                REJECT
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={loading}
              onClick={onCancel}
              style={styles.secondaryButton}
            >
              {loading ? "WORKING..." : "CANCEL OFFER"}
            </button>
          )}
        </div>
      ) : null}
    </article>
  );
}

function TradePackage({
  title,
  players,
  picks,
  teamName,
}: {
  title: string;
  players: TradePlayer[];
  picks: TradePick[];
  teamName: (id: number) => string;
}) {
  return (
    <div style={styles.packageCard}>
      <span style={styles.packageTitle}>{title}</span>
      <div style={styles.packageAssets}>
        {players.map((player) => (
          <div key={`player-${player.playerId}`} style={styles.packagePlayer}>
            <PlayerAvatar player={player} />
            <div style={styles.playerText}>
              <strong style={styles.playerName}>{player.fullName}</strong>
              <span style={styles.playerMeta}>
                {player.position}
                {player.team ? ` • ${player.team}` : ""}
              </span>
            </div>
          </div>
        ))}

        {picks.map((pick) => (
          <div key={`pick-${pick.assetId}`} style={styles.pickPackageRow}>
            <div style={styles.pickIcon}>P</div>
            <div style={styles.playerText}>
              <strong style={styles.pickName}>
                {pick.draftSeason} Round {pick.roundNumber}
              </strong>
              <span style={styles.playerMeta}>
                Originally {teamName(pick.originalFantasyTeamId)}
              </span>
            </div>
          </div>
        ))}

        {players.length === 0 && picks.length === 0 ? (
          <span style={styles.noPlayers}>No assets</span>
        ) : null}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const badgeStyle =
    status === "executed"
      ? styles.statusExecuted
      : status === "pending"
        ? styles.statusPending
        : status === "rejected" || status === "vetoed"
          ? styles.statusRejected
          : styles.statusNeutral;

  return (
    <span style={{ ...styles.statusBadge, ...badgeStyle }}>
      {status.toUpperCase()}
    </span>
  );
}

function TradeComposer({
  isDynasty,
  teams,
  teamName,
  myRoster,
  opponentRoster,
  myPicks,
  opponentPicks,
  selectedOpponentId,
  mySelectedPlayers,
  opponentSelectedPlayers,
  mySelectedPicks,
  opponentSelectedPicks,
  message,
  submitting,
  onClose,
  onChooseOpponent,
  onToggleMyPlayer,
  onToggleOpponentPlayer,
  onToggleMyPick,
  onToggleOpponentPick,
  onMessageChange,
  onSubmit,
}: {
  isDynasty: boolean;
  teams: FantasyTeam[];
  teamName: (id: number) => string;
  myRoster: ComposerPlayer[];
  opponentRoster: ComposerPlayer[];
  myPicks: TradePick[];
  opponentPicks: TradePick[];
  selectedOpponentId: number | null;
  mySelectedPlayers: number[];
  opponentSelectedPlayers: number[];
  mySelectedPicks: number[];
  opponentSelectedPicks: number[];
  message: string;
  submitting: boolean;
  onClose: () => void;
  onChooseOpponent: (teamId: number) => void;
  onToggleMyPlayer: (id: number) => void;
  onToggleOpponentPlayer: (id: number) => void;
  onToggleMyPick: (id: number) => void;
  onToggleOpponentPick: (id: number) => void;
  onMessageChange: (value: string) => void;
  onSubmit: () => void;
}) {
  const [myAssetTab, setMyAssetTab] = useState<"players" | "picks">("players");
  const [theirAssetTab, setTheirAssetTab] =
    useState<"players" | "picks">("players");

  const myTotal = mySelectedPlayers.length + mySelectedPicks.length;
  const theirTotal =
    opponentSelectedPlayers.length + opponentSelectedPicks.length;

  return (
    <div style={styles.modalBackdrop}>
      <div className="g365-modal" style={styles.modal}>
        <div style={styles.modalHeader}>
          <div>
            <span style={styles.eyebrow}>NEW OFFER</span>
            <h2 style={styles.modalTitle}>Build Trade</h2>
          </div>
          <button type="button" onClick={onClose} style={styles.closeButton}>
            ×
          </button>
        </div>

        <div style={styles.composerTop}>
          <label style={styles.fieldLabel}>TRADE WITH</label>
          <select
            value={selectedOpponentId ?? ""}
            onChange={(event) => {
              const value = Number(event.target.value);
              if (value) onChooseOpponent(value);
            }}
            style={styles.select}
          >
            <option value="">Choose a team</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.team_name}
              </option>
            ))}
          </select>
        </div>

        <div className="g365-composer-grid" style={styles.composerGrid}>
          <AssetSelector
            title="YOU GIVE"
            isDynasty={isDynasty}
            activeTab={myAssetTab}
            onTabChange={setMyAssetTab}
            players={myRoster}
            picks={myPicks}
            selectedPlayers={mySelectedPlayers}
            selectedPicks={mySelectedPicks}
            onTogglePlayer={onToggleMyPlayer}
            onTogglePick={onToggleMyPick}
            teamName={teamName}
          />

          <AssetSelector
            title="YOU RECEIVE"
            isDynasty={isDynasty}
            activeTab={theirAssetTab}
            onTabChange={setTheirAssetTab}
            players={opponentRoster}
            picks={opponentPicks}
            selectedPlayers={opponentSelectedPlayers}
            selectedPicks={opponentSelectedPicks}
            onTogglePlayer={onToggleOpponentPlayer}
            onTogglePick={onToggleOpponentPick}
            teamName={teamName}
            emptyText={
              selectedOpponentId
                ? "No assets available in this section."
                : "Choose a team first."
            }
          />
        </div>

        <div style={styles.messageField}>
          <label style={styles.fieldLabel}>MESSAGE</label>
          <textarea
            value={message}
            onChange={(event) => onMessageChange(event.target.value)}
            placeholder="Optional message..."
            style={styles.textarea}
          />
        </div>

        <div className="g365-modal-footer" style={styles.modalFooter}>
          <div style={styles.tradeSummaryText}>
            {myTotal} outgoing asset{myTotal === 1 ? "" : "s"} • {theirTotal} incoming asset
            {theirTotal === 1 ? "" : "s"}
          </div>

          <div className="g365-modal-actions" style={styles.modalActions}>
            <button type="button" onClick={onClose} style={styles.secondaryButton}>
              CANCEL
            </button>
            <button
              type="button"
              onClick={onSubmit}
              disabled={submitting || myTotal === 0 || theirTotal === 0}
              style={{
                ...styles.primaryButton,
                ...(submitting || myTotal === 0 || theirTotal === 0
                  ? styles.disabledButton
                  : {}),
              }}
            >
              {submitting ? "SENDING..." : "SEND OFFER"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AssetSelector({
  title,
  isDynasty,
  activeTab,
  onTabChange,
  players,
  picks,
  selectedPlayers,
  selectedPicks,
  onTogglePlayer,
  onTogglePick,
  teamName,
  emptyText = "No assets available.",
}: {
  title: string;
  isDynasty: boolean;
  activeTab: "players" | "picks";
  onTabChange: (tab: "players" | "picks") => void;
  players: ComposerPlayer[];
  picks: TradePick[];
  selectedPlayers: number[];
  selectedPicks: number[];
  onTogglePlayer: (id: number) => void;
  onTogglePick: (id: number) => void;
  teamName: (id: number) => string;
  emptyText?: string;
}) {
  const selectedTotal = selectedPlayers.length + selectedPicks.length;

  return (
    <section style={styles.rosterPanel}>
      <div style={styles.rosterHeader}>
        <strong>{title}</strong>
        <span style={styles.selectedCount}>{selectedTotal} SELECTED</span>
      </div>

      {isDynasty ? (
        <div className="g365-asset-tabs" style={styles.assetTabs}>
          <button
            type="button"
            onClick={() => onTabChange("players")}
            style={{
              ...styles.assetTab,
              ...(activeTab === "players" ? styles.assetTabActive : {}),
            }}
          >
            PLAYERS ({selectedPlayers.length})
          </button>
          <button
            type="button"
            onClick={() => onTabChange("picks")}
            style={{
              ...styles.assetTab,
              ...(activeTab === "picks" ? styles.assetTabActive : {}),
            }}
          >
            DRAFT PICKS ({selectedPicks.length})
          </button>
        </div>
      ) : null}

      <div style={styles.rosterList}>
        {activeTab === "players" || !isDynasty ? (
          players.length ? (
            players.map((player) => {
              const active = selectedPlayers.includes(player.playerId);
              return (
                <button
                  type="button"
                  key={player.playerId}
                  onClick={() => onTogglePlayer(player.playerId)}
                  style={{
                    ...styles.rosterPlayerButton,
                    ...(active ? styles.rosterPlayerButtonActive : {}),
                  }}
                >
                  <PlayerAvatar player={player} />
                  <div style={styles.playerText}>
                    <strong style={styles.playerName}>{player.fullName}</strong>
                    <span style={styles.playerMeta}>
                      {player.position}
                      {player.team ? ` • ${player.team}` : ""}
                    </span>
                  </div>
                  <span
                    style={{
                      ...styles.selectIndicator,
                      ...(active ? styles.selectIndicatorActive : {}),
                    }}
                  >
                    {active ? "✓" : "+"}
                  </span>
                </button>
              );
            })
          ) : (
            <div style={styles.rosterEmpty}>{emptyText}</div>
          )
        ) : picks.length ? (
          picks.map((pick) => {
            const active = selectedPicks.includes(pick.assetId);
            return (
              <button
                type="button"
                key={pick.assetId}
                onClick={() => onTogglePick(pick.assetId)}
                style={{
                  ...styles.pickButton,
                  ...(active ? styles.rosterPlayerButtonActive : {}),
                }}
              >
                <div style={styles.pickIcon}>P</div>
                <div style={styles.playerText}>
                  <strong style={styles.pickName}>
                    {pick.draftSeason} Round {pick.roundNumber}
                  </strong>
                  <span style={styles.playerMeta}>
                    Originally {teamName(pick.originalFantasyTeamId)}
                    {pick.pickNumber ? ` • Pick ${pick.pickNumber}` : ""}
                  </span>
                </div>
                <span
                  style={{
                    ...styles.selectIndicator,
                    ...(active ? styles.selectIndicatorActive : {}),
                  }}
                >
                  {active ? "✓" : "+"}
                </span>
              </button>
            );
          })
        ) : (
          <div style={styles.rosterEmpty}>
            No future Dynasty draft picks currently owned by this team.
          </div>
        )}
      </div>
    </section>
  );
}

function PlayerAvatar({
  player,
}: {
  player: Pick<TradePlayer, "fullName" | "headshotUrl">;
}) {
  if (player.headshotUrl) {
    return <img src={player.headshotUrl} alt="" style={styles.avatar} />;
  }

  return (
    <div style={styles.avatarFallback}>
      {player.fullName.slice(0, 1).toUpperCase()}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "calc(100vh - 90px)",
    padding: "18px 16px 36px",
    background: "#0c0d0f",
    color: "#fff",
  },
  shell: {
    width: "min(1380px,100%)",
    margin: "0 auto",
    display: "grid",
    gap: 14,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: 16,
    flexWrap: "wrap",
  },
  eyebrow: {
    margin: 0,
    color: "#ff7f1e",
    fontSize: 12,
    fontWeight: 950,
    letterSpacing: ".14em",
  },
  title: { margin: "4px 0 0", fontSize: 32, lineHeight: 1 },
  subtitle: { margin: "6px 0 0", color: "#747b84", fontSize: 14 },
  dynastyMeta: {
    marginTop: 7,
    display: "flex",
    gap: 7,
    flexWrap: "wrap",
    color: "#9b7d67",
    fontSize: 11,
    fontWeight: 800,
  },
  primaryButton: {
    border: 0,
    borderRadius: 6,
    padding: "9px 13px",
    background: "linear-gradient(135deg,#b61d18,#ff6512)",
    color: "#fff",
    fontSize: 12,
    fontWeight: 950,
    cursor: "pointer",
  },
  disabledButton: { opacity: 0.48, cursor: "not-allowed" },
  secondaryButton: {
    border: "1px solid rgba(255,255,255,.1)",
    borderRadius: 6,
    padding: "8px 11px",
    background: "#181a1d",
    color: "#cfd3d8",
    fontSize: 12,
    fontWeight: 900,
    cursor: "pointer",
  },
  acceptButton: {
    border: 0,
    borderRadius: 6,
    padding: "8px 12px",
    background: "linear-gradient(135deg,#0f8f4e,#33d17a)",
    color: "#fff",
    fontSize: 12,
    fontWeight: 950,
    cursor: "pointer",
  },
  errorBox: {
    padding: "10px 12px",
    border: "1px solid rgba(255,85,70,.22)",
    borderRadius: 6,
    background: "rgba(255,70,55,.05)",
    color: "#ff756c",
    fontSize: 12,
  },
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3,minmax(0,1fr))",
    gap: 8,
  },
  summaryCard: {
    padding: 11,
    border: "1px solid rgba(255,255,255,.07)",
    borderRadius: 7,
    background: "#111315",
    display: "grid",
    gap: 2,
  },
  summaryLabel: { color: "#737a84", fontSize: 11, fontWeight: 900 },
  summaryValue: { color: "#ff8a27", fontSize: 20 },
  contentCard: {
    overflow: "hidden",
    border: "1px solid rgba(255,255,255,.08)",
    borderRadius: 8,
    background: "linear-gradient(180deg,#151719,#101113)",
  },
  tabs: {
    display: "flex",
    gap: 4,
    padding: 8,
    borderBottom: "1px solid rgba(255,255,255,.06)",
  },
  tabButton: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    border: 0,
    borderRadius: 5,
    padding: "7px 9px",
    background: "transparent",
    color: "#7a818a",
    fontSize: 12,
    fontWeight: 900,
    cursor: "pointer",
  },
  tabButtonActive: { background: "rgba(255,110,20,.08)", color: "#fff" },
  tabCount: {
    minWidth: 17,
    padding: "2px 4px",
    borderRadius: 999,
    background: "#25282c",
    color: "#8b929b",
    fontSize: 11,
  },
  tabCountActive: {
    background: "rgba(255,120,25,.15)",
    color: "#ff8b2b",
  },
  tradeList: { display: "grid", gap: 10, padding: 10 },
  tradeCard: {
    padding: 12,
    border: "1px solid rgba(255,255,255,.07)",
    borderRadius: 7,
    background: "#111315",
  },
  tradeHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  tradeTeams: {
    display: "flex",
    alignItems: "center",
    gap: 7,
    color: "#f2f3f4",
    fontSize: 14,
  },
  swapArrow: { color: "#ff8425" },
  tradeMeta: {
    display: "block",
    marginTop: 3,
    color: "#727983",
    fontSize: 11,
  },
  statusBadge: { padding: "4px 7px", borderRadius: 4, fontSize: 11, fontWeight: 950 },
  statusPending: { background: "rgba(255,135,30,.09)", color: "#ff8c2a" },
  statusExecuted: { background: "rgba(60,210,125,.09)", color: "#4ddd89" },
  statusRejected: { background: "rgba(255,80,65,.08)", color: "#ff6259" },
  statusNeutral: { background: "#24272b", color: "#858c95" },
  packageGrid: {
    marginTop: 11,
    display: "grid",
    gridTemplateColumns: "minmax(0,1fr) 36px minmax(0,1fr)",
    gap: 8,
    alignItems: "stretch",
  },
  packageCard: {
    padding: 9,
    border: "1px solid rgba(255,255,255,.055)",
    borderRadius: 6,
    background: "#0e1012",
  },
  packageTitle: { color: "#7a818b", fontSize: 11, fontWeight: 950 },
  packageAssets: { marginTop: 8, display: "grid", gap: 7 },
  packagePlayer: { display: "flex", alignItems: "center", gap: 7 },
  pickPackageRow: {
    display: "grid",
    gridTemplateColumns: "29px minmax(0,1fr)",
    alignItems: "center",
    gap: 7,
    paddingTop: 3,
  },
  packageSwap: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#ff8425",
    fontSize: 16,
  },
  playerText: { minWidth: 0, display: "grid", gap: 2 },
  playerName: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    color: "#f0f2f4",
    fontSize: 12,
  },
  pickName: { color: "#ff9a45", fontSize: 12, fontWeight: 900 },
  playerMeta: { color: "#6e757e", fontSize: 11 },
  avatar: {
    width: 29,
    height: 29,
    objectFit: "cover",
    borderRadius: "50%",
    background: "#25282c",
  },
  avatarFallback: {
    width: 29,
    height: 29,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "50%",
    background: "#272a2e",
    color: "#f1f2f3",
    fontSize: 12,
    fontWeight: 950,
  },
  pickIcon: {
    width: 29,
    height: 29,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 6,
    border: "1px solid rgba(255,130,35,.25)",
    background: "rgba(255,105,20,.08)",
    color: "#ff8b2b",
    fontSize: 12,
    fontWeight: 950,
  },
  noPlayers: { color: "#666d76", fontSize: 11 },
  tradeCounts: { marginTop: 10, color: "#888f98", fontSize: 12 },
  messageBox: {
    marginTop: 10,
    padding: "8px 9px",
    borderLeft: "2px solid #ff7622",
    background: "rgba(255,110,20,.035)",
    color: "#9ca2aa",
    fontSize: 11,
    fontStyle: "italic",
  },
  tradeActions: {
    marginTop: 10,
    display: "flex",
    justifyContent: "flex-end",
    gap: 7,
    flexWrap: "wrap",
  },
  emptyState: {
    padding: "36px 20px",
    display: "grid",
    justifyItems: "center",
    gap: 5,
    color: "#707780",
    fontSize: 12,
  },
  emptyTitle: { color: "#e6e8eb", fontSize: 14 },
  emptyText: { color: "#707780", fontSize: 11 },
  modalBackdrop: {
    position: "fixed",
    inset: 0,
    zIndex: 1000,
    padding: 20,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(0,0,0,.76)",
  },
  modal: {
    width: "min(1120px,100%)",
    maxHeight: "90vh",
    overflow: "auto",
    border: "1px solid rgba(255,255,255,.1)",
    borderRadius: 10,
    background: "#0f1113",
    boxShadow: "0 24px 80px rgba(0,0,0,.45)",
  },
  modalHeader: {
    padding: "14px 16px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottom: "1px solid rgba(255,255,255,.07)",
  },
  modalTitle: { margin: "2px 0 0", fontSize: 22 },
  closeButton: {
    width: 30,
    height: 30,
    border: "1px solid rgba(255,255,255,.09)",
    borderRadius: "50%",
    background: "#17191c",
    color: "#aeb3ba",
    fontSize: 18,
    cursor: "pointer",
  },
  composerTop: { padding: "12px 16px", display: "grid", gap: 6 },
  fieldLabel: { color: "#767d86", fontSize: 11, fontWeight: 950 },
  select: {
    width: "100%",
    padding: "9px 10px",
    border: "1px solid rgba(255,255,255,.09)",
    borderRadius: 6,
    background: "#17191c",
    color: "#fff",
    fontSize: 13,
  },
  composerGrid: {
    padding: "0 16px",
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
  },
  rosterPanel: {
    overflow: "hidden",
    border: "1px solid rgba(255,255,255,.07)",
    borderRadius: 7,
    background: "#111315",
  },
  rosterHeader: {
    padding: "9px 10px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottom: "1px solid rgba(255,255,255,.055)",
    color: "#f0f1f2",
    fontSize: 12,
  },
  selectedCount: { color: "#ff8427", fontSize: 11 },
  assetTabs: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 5,
    padding: 6,
    borderBottom: "1px solid rgba(255,255,255,.055)",
  },
  assetTab: {
    border: "1px solid rgba(255,255,255,.06)",
    borderRadius: 5,
    padding: "7px 8px",
    background: "#17191c",
    color: "#777e87",
    fontSize: 10,
    fontWeight: 950,
    cursor: "pointer",
  },
  assetTabActive: {
    border: "1px solid rgba(255,120,25,.25)",
    background: "rgba(255,105,20,.07)",
    color: "#ff8b2b",
  },
  rosterList: { maxHeight: 360, overflowY: "auto", padding: 6 },
  rosterPlayerButton: {
    width: "100%",
    padding: 7,
    display: "grid",
    gridTemplateColumns: "29px minmax(0,1fr) 24px",
    alignItems: "center",
    gap: 7,
    border: "1px solid transparent",
    borderRadius: 5,
    background: "transparent",
    textAlign: "left",
    cursor: "pointer",
  },
  pickButton: {
    width: "100%",
    padding: 7,
    display: "grid",
    gridTemplateColumns: "29px minmax(0,1fr) 24px",
    alignItems: "center",
    gap: 7,
    border: "1px solid transparent",
    borderRadius: 5,
    background: "transparent",
    textAlign: "left",
    cursor: "pointer",
  },
  rosterPlayerButtonActive: {
    border: "1px solid rgba(255,115,25,.3)",
    background: "rgba(255,100,15,.065)",
  },
  selectIndicator: {
    width: 21,
    height: 21,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "50%",
    background: "#25282c",
    color: "#828991",
    fontSize: 13,
    fontWeight: 950,
  },
  selectIndicatorActive: {
    background: "linear-gradient(135deg,#b51d18,#ff6412)",
    color: "#fff",
  },
  rosterEmpty: {
    padding: "28px 10px",
    textAlign: "center",
    color: "#6e757e",
    fontSize: 11,
  },
  messageField: { padding: "12px 16px", display: "grid", gap: 6 },
  textarea: {
    minHeight: 72,
    resize: "vertical",
    padding: "9px 10px",
    border: "1px solid rgba(255,255,255,.09)",
    borderRadius: 6,
    background: "#17191c",
    color: "#fff",
    fontSize: 13,
  },
  modalFooter: {
    padding: "12px 16px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    borderTop: "1px solid rgba(255,255,255,.07)",
  },
  tradeSummaryText: { color: "#747b84", fontSize: 11 },
  modalActions: { display: "flex", gap: 7 },
};
