"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

type DraftType = "redraft" | "startup" | "dynasty";
type TradeSection = "teams" | "pending" | "block";

type Team = {
  id: number;
  team_name: string;
  owner_id: string | null;
  active: boolean;
};

type Player = {
  id: number;
  full_name: string;
  primary_position: string;
  team_abbreviation: string | null;
};

type Roster = {
  fantasy_team_id: number;
  player_id: number;
};

type PickAsset = {
  id: number;
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
  draft_type: "startup" | "dynasty" | "redraft";
};

type Offer = {
  id: number;
  season: number;
  week: number;
  proposing_fantasy_team_id: number;
  receiving_fantasy_team_id: number;
  status: string;
  message: string | null;
  proposed_by: string | null;
  created_at: string;
};

type TradePlayer = {
  id: number;
  trade_offer_id: number;
  from_fantasy_team_id: number;
  player_id: number;
};

type TradePick = {
  id: number;
  trade_offer_id: number;
  draft_pick_asset_id: number;
  from_fantasy_team_id: number;
  to_fantasy_team_id: number;
};

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

export default function DraftTradesPanel({
  leagueId,
  season,
  draftType,
  teams,
  players,
  myTeamId,
  currentUserId,
}: {
  leagueId: string;
  season: number;
  draftType: DraftType;
  teams: Team[];
  players: Player[];
  myTeamId: number | null;
  currentUserId: string | null;
}) {
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [tradeSection, setTradeSection] = useState<TradeSection>("teams");
  const [activeWeek, setActiveWeek] = useState(1);
  const [partnerId, setPartnerId] = useState<number | null>(null);

  const [rosters, setRosters] = useState<Roster[]>([]);
  const [assets, setAssets] = useState<PickAsset[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [tradePlayers, setTradePlayers] = useState<TradePlayer[]>([]);
  const [tradePicks, setTradePicks] = useState<TradePick[]>([]);

  const [givePlayers, setGivePlayers] = useState<number[]>([]);
  const [getPlayers, setGetPlayers] = useState<number[]>([]);
  const [givePicks, setGivePicks] = useState<number[]>([]);
  const [getPicks, setGetPicks] = useState<number[]>([]);
  const [message, setMessage] = useState("");

  const [counteringOfferId, setCounteringOfferId] = useState<number | null>(null);

  const teamMap = useMemo(
    () => new Map(teams.map((team) => [Number(team.id), team] as const)),
    [teams],
  );

  const playerMap = useMemo(
    () => new Map(players.map((player) => [Number(player.id), player] as const)),
    [players],
  );

  const assetMap = useMemo(
    () => new Map(assets.map((asset) => [Number(asset.id), asset] as const)),
    [assets],
  );

  /*
   * Do not require owner_id here.
   *
   * During league setup/test leagues the other franchises can exist before
   * owners are assigned. NHL's trade-center presentation still needs those
   * franchises visible, and the NFL Dynasty test league currently has that
   * same shape.
   */
  const partners = useMemo(
    () =>
      teams
        .filter(
          (team) =>
            team.active &&
            Number(team.id) !== Number(myTeamId),
        )
        .sort((a, b) => a.team_name.localeCompare(b.team_name)),
    [teams, myTeamId],
  );

  const pendingOffers = useMemo(
    () => offers.filter((offer) => offer.status === "pending"),
    [offers],
  );

  const incomingTradeOfferCount = useMemo(
    () =>
      pendingOffers.filter(
        (offer) =>
          Number(offer.receiving_fantasy_team_id) === Number(myTeamId),
      ).length,
    [pendingOffers, myTeamId],
  );

  const historyOffers = useMemo(
    () => offers.filter((offer) => offer.status !== "pending"),
    [offers],
  );

  const load = useCallback(async () => {
    if (!myTeamId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const [stateResult, rosterResult, assetResult, offerResult] =
      await Promise.all([
        supabase
          .from("traditional_season_state")
          .select("active_week")
          .eq("league_id", leagueId)
          .eq("season", season)
          .maybeSingle(),

        supabase
          .from("team_rosters")
          .select("fantasy_team_id, player_id")
          .eq("league_id", leagueId),

        supabase
          .from("traditional_dynasty_draft_pick_assets")
          .select(
            "id, draft_season, round_number, original_fantasy_team_id, current_fantasy_team_id, pick_number, overall_pick, draft_id, used_nfl_player_id, used_at, league_format, draft_type",
          )
          .eq("league_id", leagueId)
          .eq("league_format", "dynasty")
          .is("used_nfl_player_id", null)
          .is("used_at", null)
          .order("draft_season")
          .order("round_number")
          .order("overall_pick"),

        supabase
          .from("traditional_trade_offers")
          .select(
            "id, season, week, proposing_fantasy_team_id, receiving_fantasy_team_id, status, message, proposed_by, created_at",
          )
          .eq("league_id", leagueId)
          .eq("season", season)
          .or(
            `proposing_fantasy_team_id.eq.${myTeamId},receiving_fantasy_team_id.eq.${myTeamId}`,
          )
          .order("created_at", { ascending: false }),
      ]);

    const firstError =
      stateResult.error ??
      rosterResult.error ??
      assetResult.error ??
      offerResult.error;

    if (firstError) {
      setError(firstError.message);
      setLoading(false);
      return;
    }

    setActiveWeek(Number(stateResult.data?.active_week ?? 1));

    setRosters(
      (rosterResult.data ?? []).map((row) => ({
        fantasy_team_id: Number(row.fantasy_team_id),
        player_id: Number(row.player_id),
      })),
    );

    setAssets(
      (assetResult.data ?? []).map((row) => ({
        ...(row as PickAsset),
        id: Number(row.id),
        draft_season: Number(row.draft_season),
        round_number: Number(row.round_number),
        original_fantasy_team_id: Number(row.original_fantasy_team_id),
        current_fantasy_team_id: Number(row.current_fantasy_team_id),
        pick_number:
          row.pick_number == null ? null : Number(row.pick_number),
        overall_pick:
          row.overall_pick == null ? null : Number(row.overall_pick),
      })),
    );

    const nextOffers = (offerResult.data ?? []).map((row) => ({
      ...(row as Offer),
      id: Number(row.id),
      season: Number(row.season),
      week: Number(row.week),
      proposing_fantasy_team_id: Number(row.proposing_fantasy_team_id),
      receiving_fantasy_team_id: Number(row.receiving_fantasy_team_id),
    }));

    setOffers(nextOffers);

    const offerIds = nextOffers.map((offer) => offer.id);

    if (!offerIds.length) {
      setTradePlayers([]);
      setTradePicks([]);
      setLoading(false);
      return;
    }

    const [tradePlayerResult, tradePickResult] = await Promise.all([
      supabase
        .from("traditional_trade_players")
        .select(
          "id, trade_offer_id, from_fantasy_team_id, player_id",
        )
        .in("trade_offer_id", offerIds),

      supabase
        .from("traditional_trade_draft_picks")
        .select(
          "id, trade_offer_id, draft_pick_asset_id, from_fantasy_team_id, to_fantasy_team_id",
        )
        .in("trade_offer_id", offerIds),
    ]);

    const componentError =
      tradePlayerResult.error ?? tradePickResult.error;

    if (componentError) {
      setError(componentError.message);
      setLoading(false);
      return;
    }

    setTradePlayers(
      (tradePlayerResult.data ?? []).map((row) => ({
        id: Number(row.id),
        trade_offer_id: Number(row.trade_offer_id),
        from_fantasy_team_id: Number(row.from_fantasy_team_id),
        player_id: Number(row.player_id),
      })),
    );

    setTradePicks(
      (tradePickResult.data ?? []).map((row) => ({
        id: Number(row.id),
        trade_offer_id: Number(row.trade_offer_id),
        draft_pick_asset_id: Number(row.draft_pick_asset_id),
        from_fantasy_team_id: Number(row.from_fantasy_team_id),
        to_fantasy_team_id: Number(row.to_fantasy_team_id),
      })),
    );

    setLoading(false);
  }, [leagueId, season, myTeamId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (
      partnerId &&
      partners.some((team) => Number(team.id) === Number(partnerId))
    ) {
      return;
    }

    setPartnerId(partners[0]?.id ?? null);
  }, [partners, partnerId]);

  useEffect(() => {
    if (counteringOfferId !== null) {
      return;
    }

    setGivePlayers([]);
    setGetPlayers([]);
    setGivePicks([]);
    setGetPicks([]);
    setMessage("");
    setSuccess(null);
  }, [partnerId, counteringOfferId]);

  const rosterFor = (teamId: number | null) =>
    rosters
      .filter((row) => row.fantasy_team_id === teamId)
      .map((row) => playerMap.get(row.player_id))
      .filter((player): player is Player => Boolean(player))
      .sort(
        (a, b) =>
          a.primary_position.localeCompare(b.primary_position) ||
          a.full_name.localeCompare(b.full_name),
      );

  const picksFor = (teamId: number | null) =>
    assets
      .filter((asset) => asset.current_fantasy_team_id === teamId)
      .sort((a, b) => {
        if (a.draft_season !== b.draft_season) {
          return a.draft_season - b.draft_season;
        }

        if (a.round_number !== b.round_number) {
          return a.round_number - b.round_number;
        }

        return (a.overall_pick ?? 99999) - (b.overall_pick ?? 99999);
      });

  const toggle = (
    setter: React.Dispatch<React.SetStateAction<number[]>>,
    id: number,
  ) => {
    setter((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    );
  };

  const pickLabel = (asset: PickAsset) => {
    const originalTeam =
      teamMap.get(asset.original_fantasy_team_id)?.team_name ??
      "Original Team";

    const currentTeam =
      teamMap.get(asset.current_fantasy_team_id)?.team_name ??
      "Current Team";

    const isStartup = asset.draft_type === "startup";
    const pickText =
      asset.overall_pick != null
        ? `Pick ${asset.overall_pick}`
        : asset.pick_number != null
          ? `Pick ${asset.pick_number}`
          : "Pick TBD";

    const via =
      asset.original_fantasy_team_id !== asset.current_fantasy_team_id
        ? ` • via ${originalTeam}`
        : "";

    return `${asset.draft_season} • Round ${asset.round_number} • ${
      isStartup ? pickText : pickText
    }${via}${currentTeam ? "" : ""}`;
  };

  const resetComposer = () => {
    setGivePlayers([]);
    setGetPlayers([]);
    setGivePicks([]);
    setGetPicks([]);
    setMessage("");
    setCounteringOfferId(null);
  };

  async function submit() {
    if (!myTeamId || !partnerId || working) {
      return;
    }

    if (!givePlayers.length && !givePicks.length) {
      setError("Select at least one player or pick from your team.");
      return;
    }

    if (!getPlayers.length && !getPicks.length) {
      setError("Select at least one player or pick from the other team.");
      return;
    }

    setWorking(true);
    setError(null);
    setSuccess(null);

    const rpcName =
      counteringOfferId !== null
        ? "counter_traditional_trade_offer"
        : "submit_traditional_trade_offer";

    const rpcArgs =
      counteringOfferId !== null
        ? {
            p_trade_offer_id: counteringOfferId,
            p_countering_fantasy_team_id: myTeamId,
            p_offered_player_ids: givePlayers,
            p_requested_player_ids: getPlayers,
            p_offered_draft_pick_asset_ids: givePicks,
            p_requested_draft_pick_asset_ids: getPicks,
            p_message: message.trim() || null,
          }
        : {
            p_league_id: leagueId,
            p_season: season,
            p_week: activeWeek,
            p_proposing_fantasy_team_id: myTeamId,
            p_receiving_fantasy_team_id: partnerId,
            p_proposing_player_ids: givePlayers,
            p_receiving_player_ids: getPlayers,
            p_proposing_draft_pick_asset_ids: givePicks,
            p_receiving_draft_pick_asset_ids: getPicks,
            p_message: message.trim() || null,
          };

    const { error: rpcError } = await supabase.rpc(
      rpcName,
      rpcArgs,
    );

    if (rpcError) {
      setError(rpcError.message);
    } else {
      const wasCounter = counteringOfferId !== null;
      resetComposer();
      setSuccess(
        wasCounter ? "Counter offer sent." : "Trade offer sent.",
      );
      await load();
      setTradeSection("pending");
    }

    setWorking(false);
  }

  async function act(
    id: number,
    action: "accept" | "reject" | "cancel",
  ) {
    if (working) {
      return;
    }

    setWorking(true);
    setError(null);
    setSuccess(null);

    const functionName =
      action === "accept"
        ? "accept_traditional_trade_offer"
        : action === "reject"
          ? "reject_traditional_trade_offer"
          : "cancel_traditional_trade_offer";

    const { error: rpcError } = await supabase.rpc(functionName, {
      p_trade_offer_id: id,
    });

    if (rpcError) {
      setError(rpcError.message);
    } else {
      setSuccess(
        action === "accept"
          ? "Trade accepted."
          : action === "reject"
            ? "Trade rejected."
            : "Trade cancelled.",
      );

      await load();
    }

    setWorking(false);
  }

  const pendingPlayerIds = (
    offerId: number,
    fromTeamId: number,
  ) =>
    tradePlayers
      .filter(
        (row) =>
          row.trade_offer_id === offerId &&
          row.from_fantasy_team_id === fromTeamId,
      )
      .map((row) => row.player_id);

  const pendingPickIds = (
    offerId: number,
    fromTeamId: number,
  ) =>
    tradePicks
      .filter(
        (row) =>
          row.trade_offer_id === offerId &&
          row.from_fantasy_team_id === fromTeamId,
      )
      .map((row) => row.draft_pick_asset_id);

  function beginCounterOffer(offer: Offer) {
    if (!myTeamId) {
      return;
    }

    const proposer = offer.proposing_fantasy_team_id;
    const receiver = offer.receiving_fantasy_team_id;

    const otherTeamId =
      proposer === myTeamId ? receiver : proposer;

    const proposerPlayers = pendingPlayerIds(offer.id, proposer);
    const receiverPlayers = pendingPlayerIds(offer.id, receiver);
    const proposerPicks = pendingPickIds(offer.id, proposer);
    const receiverPicks = pendingPickIds(offer.id, receiver);

    const iWasReceiver = receiver === myTeamId;

    setGivePlayers(
      iWasReceiver ? receiverPlayers : proposerPlayers,
    );
    setGetPlayers(
      iWasReceiver ? proposerPlayers : receiverPlayers,
    );
    setGivePicks(
      iWasReceiver ? receiverPicks : proposerPicks,
    );
    setGetPicks(
      iWasReceiver ? proposerPicks : receiverPicks,
    );

    setMessage(offer.message ?? "");
    setCounteringOfferId(offer.id);
    setPartnerId(otherTeamId);
    setTradeSection("teams");
    setError(null);
    setSuccess(null);
  }

  function AssetButton({
    selected,
    onClick,
    children,
  }: {
    selected: boolean;
    onClick: () => void;
    children: React.ReactNode;
  }) {
    return (
      <button
        type="button"
        onClick={onClick}
        style={{
          ...S.asset,
          ...(selected ? S.assetSelected : {}),
        }}
      >
        <span style={S.check}>{selected ? "✓" : ""}</span>
        <span style={S.assetText}>{children}</span>
      </button>
    );
  }

  function TradeAssetColumn({
    title,
    teamId,
    mine,
  }: {
    title: string;
    teamId: number | null;
    mine: boolean;
  }) {
    const rosterPlayers = rosterFor(teamId);
    const pickAssets = picksFor(teamId);

    const selectedPlayers = mine ? givePlayers : getPlayers;
    const selectedPicks = mine ? givePicks : getPicks;

    const playerSetter = mine ? setGivePlayers : setGetPlayers;
    const pickSetter = mine ? setGivePicks : setGetPicks;

    const groupedPicks = new Map<number, PickAsset[]>();

    for (const asset of pickAssets) {
      const current = groupedPicks.get(asset.draft_season) ?? [];
      current.push(asset);
      groupedPicks.set(asset.draft_season, current);
    }

    return (
      <section style={S.assetColumn}>
        <div style={S.assetColumnHead}>
          <span style={S.assetColumnEyebrow}>{title}</span>
          <strong style={S.assetColumnTeam}>
            {teamId ? teamMap.get(teamId)?.team_name ?? "Team" : "Team"}
          </strong>
        </div>

        <div style={S.assetGroup}>
          <div style={S.assetGroupTitle}>PLAYERS</div>

          <div style={S.assetScroll}>
            {rosterPlayers.length ? (
              rosterPlayers.map((player) => (
                <AssetButton
                  key={player.id}
                  selected={selectedPlayers.includes(player.id)}
                  onClick={() => toggle(playerSetter, player.id)}
                >
                  <strong>{player.full_name}</strong>
                  <small style={S.assetMeta}>
                    {player.primary_position} •{" "}
                    {player.team_abbreviation ?? "FA"}
                  </small>
                </AssetButton>
              ))
            ) : (
              <div style={S.assetEmpty}>No players.</div>
            )}
          </div>
        </div>

        <div style={S.assetGroup}>
          <div style={S.assetGroupTitle}>DRAFT PICKS</div>

          <div style={S.pickSeasonList}>
            {Array.from(groupedPicks.entries()).map(
              ([draftSeason, seasonAssets]) => (
                <div key={draftSeason} style={S.pickSeason}>
                  <div style={S.pickSeasonTitle}>
                    {draftSeason === season
                      ? `${draftSeason} STARTUP`
                      : `${draftSeason} DYNASTY`}
                  </div>

                  <div style={S.pickSeasonAssets}>
                    {seasonAssets.map((asset) => (
                      <AssetButton
                        key={asset.id}
                        selected={selectedPicks.includes(asset.id)}
                        onClick={() => toggle(pickSetter, asset.id)}
                      >
                        <strong>
                          Round {asset.round_number}
                        </strong>

                        <small style={S.assetMeta}>
                          {asset.overall_pick != null
                            ? `Pick ${asset.overall_pick}`
                            : asset.pick_number != null
                              ? `Pick ${asset.pick_number}`
                              : "Pick TBD"}
                          {asset.original_fantasy_team_id !==
                          asset.current_fantasy_team_id
                            ? ` • via ${
                                teamMap.get(
                                  asset.original_fantasy_team_id,
                                )?.team_name ?? "Original Team"
                              }`
                            : ""}
                        </small>
                      </AssetButton>
                    ))}
                  </div>
                </div>
              ),
            )}

            {!pickAssets.length ? (
              <div style={S.assetEmpty}>
                No unused Dynasty picks currently owned.
              </div>
            ) : null}
          </div>
        </div>
      </section>
    );
  }

  function OfferAssets({
    offer,
    from,
  }: {
    offer: Offer;
    from: number;
  }) {
    const offerPlayers = tradePlayers.filter(
      (row) =>
        row.trade_offer_id === offer.id &&
        row.from_fantasy_team_id === from,
    );

    const offerPicks = tradePicks.filter(
      (row) =>
        row.trade_offer_id === offer.id &&
        row.from_fantasy_team_id === from,
    );

    return (
      <div style={S.offerAssets}>
        <div style={S.pendingAssetLabel}>PLAYERS</div>

        {offerPlayers.length ? (
          offerPlayers.map((row) => {
            const player = playerMap.get(row.player_id);

            return (
              <div key={`player-${row.id}`} style={S.pendingAssetRow}>
                <strong>
                  {player?.full_name ?? `Player #${row.player_id}`}
                </strong>

                {player ? (
                  <small style={S.assetMeta}>
                    {player.primary_position} •{" "}
                    {player.team_abbreviation ?? "FA"}
                  </small>
                ) : null}
              </div>
            );
          })
        ) : (
          <div style={S.pendingAssetEmpty}>No players</div>
        )}

        <div style={S.pendingAssetLabel}>PICKS</div>

        {offerPicks.length ? (
          offerPicks.map((row) => {
            const asset = assetMap.get(row.draft_pick_asset_id);

            return (
              <div key={`pick-${row.id}`} style={S.pendingAssetRow}>
                <strong>
                  {asset
                    ? pickLabel(asset)
                    : `Draft Pick #${row.draft_pick_asset_id}`}
                </strong>
              </div>
            );
          })
        ) : (
          <div style={S.pendingAssetEmpty}>No picks</div>
        )}
      </div>
    );
  }

  function PendingOfferCard({ offer }: { offer: Offer }) {
    const proposer = teamMap.get(offer.proposing_fantasy_team_id);
    const receiver = teamMap.get(offer.receiving_fantasy_team_id);

    const incoming =
      offer.receiving_fantasy_team_id === myTeamId;

    return (
      <details style={S.offerCard}>
        <summary style={S.compactOfferSummary}>
          <span style={S.offerSummaryTeams}>
            <strong>
              {proposer?.team_name ?? "Team"} ↔{" "}
              {receiver?.team_name ?? "Team"}
            </strong>

            <small style={S.offerSummaryMeta}>
              {incoming ? "INCOMING OFFER" : "OUTGOING OFFER"} • #
              {offer.id}
            </small>
          </span>

          <span style={S.pendingPill}>PENDING</span>
        </summary>

        <div className="g365-trade-offer-grid" style={S.offerGrid}>
          <div style={S.offerSide}>
            <b>{proposer?.team_name ?? "Team"} gives</b>
            <OfferAssets
              offer={offer}
              from={offer.proposing_fantasy_team_id}
            />
          </div>

          <div style={S.offerSide}>
            <b>{receiver?.team_name ?? "Team"} gives</b>
            <OfferAssets
              offer={offer}
              from={offer.receiving_fantasy_team_id}
            />
          </div>
        </div>

        {offer.message ? (
          <div style={S.offerMessage}>“{offer.message}”</div>
        ) : null}

        <div style={S.buttonRow}>
          {incoming ? (
            <>
              <button
                type="button"
                disabled={working}
                onClick={() => void act(offer.id, "accept")}
                style={S.primaryButton}
              >
                Accept Trade
              </button>

              <button
                type="button"
                disabled={working}
                onClick={() => beginCounterOffer(offer)}
                style={S.secondaryButton}
              >
                Counter Trade
              </button>

              <button
                type="button"
                disabled={working}
                onClick={() => void act(offer.id, "reject")}
                style={S.secondaryButton}
              >
                Reject
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={working}
              onClick={() => void act(offer.id, "cancel")}
              style={S.dangerButton}
            >
              Cancel Offer
            </button>
          )}
        </div>
      </details>
    );
  }

  if (draftType !== "startup" && draftType !== "dynasty") {
    return (
      <div style={S.empty}>
        Draft-pick trading is available in NFL Traditional Dynasty
        drafts.
      </div>
    );
  }

  if (!myTeamId || !currentUserId) {
    return (
      <div style={S.empty}>
        You need an owned fantasy team to use the Trade Center.
      </div>
    );
  }

  return (
    <div style={S.panel}>
      <style>{`
        .g365-trade-mobile-tab-select {
          display: none;
        }

        @media (max-width: 900px) {
          .g365-nfl-trade-layout {
            grid-template-columns: minmax(0, 1fr) !important;
          }

          .g365-nfl-trade-team-list {
            display: grid !important;
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
        }

        @media (max-width: 760px) {
          .g365-trade-desktop-tabs {
            display: none !important;
          }

          .g365-trade-mobile-tab-select {
            display: block !important;
            width: 100%;
            min-height: 44px;
            padding: 0 12px;
            border: 1px solid rgba(255,255,255,.10);
            border-radius: 8px;
            background: #0c0e10;
            color: #fff;
            font-weight: 900;
          }

          .g365-nfl-trade-team-list {
            grid-template-columns: minmax(0, 1fr) !important;
          }

          .g365-trade-builder-grid,
          .g365-trade-offer-grid {
            grid-template-columns: minmax(0, 1fr) !important;
          }
        }
      `}</style>

      <div style={S.header}>
        <div>
          <span style={S.eyebrow}>NFL DYNASTY</span>
          <strong style={S.title}>Trade Center</strong>
          <span style={S.subtitle}>
            Private team negotiations, player packages and tradable
            startup/future Dynasty picks.
          </span>
        </div>

        <button
          type="button"
          onClick={() => void load()}
          disabled={loading || working}
          style={S.refresh}
        >
          REFRESH
        </button>
      </div>

      {error ? <div style={S.error}>{error}</div> : null}
      {success ? <div style={S.success}>{success}</div> : null}

      <select
        className="g365-trade-mobile-tab-select"
        value={tradeSection}
        onChange={(event) =>
          setTradeSection(event.target.value as TradeSection)
        }
        aria-label="Trade Center section"
      >
        <option value="teams">Teams / Private Chats</option>
        <option value="pending">
          Pending Offers
          {incomingTradeOfferCount
            ? ` (${incomingTradeOfferCount})`
            : ""}
        </option>
        <option value="block">Trade Block</option>
      </select>

      <div className="g365-trade-desktop-tabs" style={S.tradeSubtabs}>
        {(
          [
            ["teams", "Teams / Private Chats"],
            ["pending", "Pending Offers"],
            ["block", "Trade Block"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTradeSection(key)}
            style={{
              ...S.workspaceTab,
              ...(tradeSection === key
                ? S.workspaceTabActive
                : {}),
            }}
          >
            {label}

            {key === "pending" && incomingTradeOfferCount > 0 ? (
              <span style={S.tabCount}>
                {incomingTradeOfferCount}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={S.empty}>Loading Trade Center…</div>
      ) : null}

      {!loading && tradeSection === "teams" ? (
        <div className="g365-nfl-trade-layout" style={S.tradeLayout}>
          <div className="g365-nfl-trade-team-list" style={S.tradeTeams}>
            {partners.map((team) => (
              <button
                type="button"
                key={team.id}
                onClick={() => {
                  resetComposer();
                  setPartnerId(team.id);
                }}
                style={{
                  ...S.tradeTeamButton,
                  ...(partnerId === team.id
                    ? S.tradeTeamButtonActive
                    : {}),
                }}
              >
                <span>{team.team_name}</span>
              </button>
            ))}
          </div>

          <div style={S.tradeWorkspace}>
            {partnerId ? (
              <>
                <div style={S.cardHead}>
                  <div>
                    <div style={S.cardTitle}>
                      PRIVATE TRADE CHAT •{" "}
                      {teamMap.get(partnerId)?.team_name}
                    </div>

                    <div style={S.workspaceSubhead}>
                      Trade negotiation workspace between these two
                      teams.
                    </div>
                  </div>
                </div>

                {counteringOfferId !== null ? (
                  <div style={S.counterBanner}>
                    <span>
                      Building counter offer for Trade #
                      {counteringOfferId}
                    </span>

                    <button
                      type="button"
                      onClick={resetComposer}
                      style={S.counterCancel}
                    >
                      CANCEL COUNTER
                    </button>
                  </div>
                ) : null}

                <div
                  className="g365-trade-builder-grid"
                  style={S.builder}
                >
                  <TradeAssetColumn
                    title="YOUR ASSETS"
                    teamId={myTeamId}
                    mine
                  />

                  <TradeAssetColumn
                    title="THEIR ASSETS"
                    teamId={partnerId}
                    mine={false}
                  />
                </div>

                <div style={S.composer}>
                  <textarea
                    value={message}
                    onChange={(event) =>
                      setMessage(event.target.value)
                    }
                    placeholder="Optional trade message…"
                    rows={3}
                    style={S.textarea}
                  />

                  <button
                    type="button"
                    disabled={
                      working ||
                      (!givePlayers.length && !givePicks.length) ||
                      (!getPlayers.length && !getPicks.length)
                    }
                    onClick={() => void submit()}
                    style={S.send}
                  >
                    {working
                      ? "WORKING…"
                      : counteringOfferId !== null
                        ? "SEND COUNTER OFFER"
                        : "SEND TRADE OFFER"}
                  </button>
                </div>
              </>
            ) : (
              <div style={S.empty}>
                Select a team to open its trade workspace.
              </div>
            )}
          </div>
        </div>
      ) : null}

      {!loading && tradeSection === "pending" ? (
        <div style={S.offerList}>
          {pendingOffers.length ? (
            pendingOffers.map((offer) => (
              <PendingOfferCard key={offer.id} offer={offer} />
            ))
          ) : (
            <div style={S.empty}>No pending offers.</div>
          )}

          {historyOffers.length ? (
            <details style={S.historyCard}>
              <summary style={S.historySummary}>
                TRADE HISTORY • {historyOffers.length}
              </summary>

              <div style={S.historyList}>
                {historyOffers.map((offer) => (
                  <div key={offer.id} style={S.historyRow}>
                    <span>
                      <strong>
                        {teamMap.get(
                          offer.proposing_fantasy_team_id,
                        )?.team_name ?? "Team"}
                      </strong>{" "}
                      ↔{" "}
                      <strong>
                        {teamMap.get(
                          offer.receiving_fantasy_team_id,
                        )?.team_name ?? "Team"}
                      </strong>
                    </span>

                    <span style={S.closedPill}>
                      {offer.status.toUpperCase()}
                    </span>
                  </div>
                ))}
              </div>
            </details>
          ) : null}
        </div>
      ) : null}

      {!loading && tradeSection === "block" ? (
        <div style={S.offerList}>
          <div style={S.offerCardStatic}>
            <div style={S.offerCardHead}>
              <div>
                <strong style={S.tradeBlockTitle}>
                  NFL DYNASTY TRADE BLOCK
                </strong>

                <div style={S.tradeBlockHelp}>
                  The NHL screen includes saved team needs here. The
                  NFL trade/player/pick backend is live, but there is
                  not yet an NFL Trade Block needs RPC/table in the
                  supplied code. This panel is intentionally not
                  writing fake client-only needs.
                </div>
              </div>
            </div>

            <div style={S.tradeBlockGrid}>
              {partners.map((team) => {
                const teamRoster = rosterFor(team.id);
                const teamPicks = picksFor(team.id);

                return (
                  <div key={team.id} style={S.tradeBlockTeamCard}>
                    <div>
                      <strong>{team.team_name}</strong>
                      <small style={S.tradeBlockTeamNeeds}>
                        {teamRoster.length} PLAYERS •{" "}
                        {teamPicks.length} TRADABLE PICKS
                      </small>
                    </div>

                    <button
                      type="button"
                      disabled={working}
                      onClick={() => {
                        resetComposer();
                        setPartnerId(team.id);
                        setTradeSection("teams");
                      }}
                      style={S.primaryButton}
                    >
                      Start Trade
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  panel: {
    height: "100%",
    minHeight: 0,
    padding: 12,
    display: "grid",
    alignContent: "start",
    gap: 12,
    overflowY: "auto",
    background: "#0f1113",
    color: "#f4f5f6",
  },

  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  },

  eyebrow: {
    display: "block",
    color: "#ff7b25",
    fontSize: 10,
    fontWeight: 1000,
    letterSpacing: ".08em",
  },

  title: {
    display: "block",
    fontSize: 18,
    fontWeight: 1000,
  },

  subtitle: {
    display: "block",
    marginTop: 3,
    color: "#858c95",
    fontSize: 11,
  },

  refresh: {
    minHeight: 36,
    padding: "0 13px",
    border: "1px solid rgba(255,105,18,.22)",
    borderRadius: 6,
    background: "rgba(255,92,15,.07)",
    color: "#ff8a32",
    fontWeight: 1000,
    cursor: "pointer",
  },

  tradeSubtabs: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    paddingBottom: 2,
  },

  workspaceTab: {
    minHeight: 38,
    padding: "0 12px",
    display: "inline-flex",
    alignItems: "center",
    gap: 7,
    border: "1px solid rgba(255,255,255,.08)",
    borderRadius: 7,
    background: "#15171a",
    color: "#9ba1a8",
    fontSize: 11,
    fontWeight: 1000,
    cursor: "pointer",
  },

  workspaceTabActive: {
    border: "1px solid rgba(255,101,18,.45)",
    background:
      "linear-gradient(135deg,rgba(183,29,27,.20),rgba(255,101,18,.11))",
    color: "#fff",
    boxShadow: "inset 3px 0 0 #ff6512",
  },

  tabCount: {
    minWidth: 20,
    height: 20,
    padding: "0 6px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    background: "#b71d1b",
    color: "#fff",
    fontSize: 10,
  },

  tradeLayout: {
    minHeight: 0,
    display: "grid",
    gridTemplateColumns: "210px minmax(0,1fr)",
    gap: 10,
  },

  tradeTeams: {
    minWidth: 0,
    display: "grid",
    alignContent: "start",
    gap: 6,
  },

  tradeTeamButton: {
    width: "100%",
    minHeight: 46,
    padding: "8px 10px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    border: "1px solid rgba(255,255,255,.07)",
    borderRadius: 7,
    background: "#15171a",
    color: "#d7dbe0",
    textAlign: "left",
    fontSize: 11,
    fontWeight: 900,
    cursor: "pointer",
  },

  tradeTeamButtonActive: {
    border: "1px solid rgba(255,101,18,.48)",
    background:
      "linear-gradient(135deg,rgba(183,29,27,.22),rgba(255,101,18,.10))",
    boxShadow: "inset 3px 0 0 #ff6512",
    color: "#fff",
  },

  tradeWorkspace: {
    minWidth: 0,
    border: "1px solid rgba(255,255,255,.07)",
    borderRadius: 8,
    background: "linear-gradient(180deg,#15171a,#101214)",
    overflow: "hidden",
  },

  cardHead: {
    minHeight: 58,
    padding: "11px 12px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    borderBottom: "1px solid rgba(255,255,255,.06)",
  },

  cardTitle: {
    color: "#fff",
    fontSize: 12,
    fontWeight: 1000,
    letterSpacing: ".03em",
  },

  workspaceSubhead: {
    marginTop: 3,
    color: "#7f8790",
    fontSize: 10,
  },

  counterBanner: {
    margin: 10,
    padding: "9px 10px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    flexWrap: "wrap",
    border: "1px solid rgba(255,139,45,.20)",
    borderRadius: 7,
    background: "rgba(255,120,20,.07)",
    color: "#ff9b43",
    fontSize: 11,
    fontWeight: 900,
  },

  counterCancel: {
    minHeight: 30,
    padding: "0 9px",
    border: "1px solid rgba(255,255,255,.10)",
    borderRadius: 5,
    background: "#111315",
    color: "#d8dce1",
    fontSize: 9,
    fontWeight: 1000,
    cursor: "pointer",
  },

  builder: {
    padding: 10,
    display: "grid",
    gridTemplateColumns: "repeat(2,minmax(0,1fr))",
    gap: 10,
  },

  assetColumn: {
    minWidth: 0,
    display: "grid",
    alignContent: "start",
    gap: 9,
    border: "1px solid rgba(255,255,255,.07)",
    borderRadius: 7,
    background: "#0d0f11",
    overflow: "hidden",
  },

  assetColumnHead: {
    padding: "9px 10px",
    display: "grid",
    gap: 2,
    borderBottom: "1px solid rgba(255,255,255,.06)",
    background:
      "linear-gradient(135deg,rgba(183,29,27,.12),rgba(255,101,18,.06))",
  },

  assetColumnEyebrow: {
    color: "#ff7b25",
    fontSize: 9,
    fontWeight: 1000,
    letterSpacing: ".08em",
  },

  assetColumnTeam: {
    color: "#fff",
    fontSize: 12,
  },

  assetGroup: {
    padding: "0 9px 9px",
    display: "grid",
    gap: 6,
  },

  assetGroupTitle: {
    color: "#737b84",
    fontSize: 9,
    fontWeight: 1000,
    letterSpacing: ".08em",
  },

  assetScroll: {
    maxHeight: 220,
    display: "grid",
    gap: 5,
    overflowY: "auto",
  },

  pickSeasonList: {
    maxHeight: 300,
    display: "grid",
    gap: 8,
    overflowY: "auto",
  },

  pickSeason: {
    display: "grid",
    gap: 5,
  },

  pickSeasonTitle: {
    padding: "5px 7px",
    borderRadius: 5,
    background: "rgba(255,101,18,.06)",
    color: "#ff8a32",
    fontSize: 9,
    fontWeight: 1000,
    letterSpacing: ".05em",
  },

  pickSeasonAssets: {
    display: "grid",
    gap: 5,
  },

  asset: {
    width: "100%",
    minHeight: 45,
    padding: "7px 8px",
    display: "grid",
    gridTemplateColumns: "22px minmax(0,1fr)",
    alignItems: "center",
    gap: 8,
    border: "1px solid rgba(255,255,255,.06)",
    borderRadius: 6,
    background: "#15181b",
    color: "#eef0f2",
    textAlign: "left",
    cursor: "pointer",
  },

  assetSelected: {
    border: "1px solid rgba(255,103,18,.55)",
    background:
      "linear-gradient(135deg,rgba(183,29,27,.20),rgba(255,101,18,.11))",
    boxShadow: "inset 3px 0 0 #ff6512",
  },

  check: {
    width: 20,
    height: 20,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: "1px solid rgba(255,255,255,.14)",
    borderRadius: 5,
    color: "#ff7b25",
    fontWeight: 1000,
  },

  assetText: {
    minWidth: 0,
    display: "grid",
    gap: 2,
  },

  assetMeta: {
    color: "#7f8790",
    fontSize: 9,
    fontWeight: 700,
  },

  assetEmpty: {
    padding: "10px 8px",
    color: "#737b84",
    fontSize: 10,
  },

  composer: {
    padding: "0 10px 10px",
    display: "grid",
    gridTemplateColumns: "minmax(0,1fr) auto",
    gap: 9,
  },

  textarea: {
    width: "100%",
    minWidth: 0,
    padding: "9px 10px",
    border: "1px solid rgba(255,255,255,.09)",
    borderRadius: 6,
    background: "#0c0e10",
    color: "#f2f3f5",
    resize: "vertical",
  },

  send: {
    minWidth: 165,
    minHeight: 42,
    padding: "0 14px",
    border: 0,
    borderRadius: 6,
    background: "linear-gradient(135deg,#b71d1b,#ff6512)",
    color: "#fff",
    fontSize: 10,
    fontWeight: 1000,
    cursor: "pointer",
  },

  offerList: {
    display: "grid",
    gap: 9,
  },

  offerCard: {
    padding: 10,
    display: "grid",
    gap: 10,
    border: "1px solid rgba(255,107,18,.13)",
    borderRadius: 8,
    background: "linear-gradient(180deg,#15171a,#101214)",
  },

  offerCardStatic: {
    padding: 12,
    display: "grid",
    gap: 12,
    border: "1px solid rgba(255,107,18,.13)",
    borderRadius: 8,
    background: "linear-gradient(180deg,#15171a,#101214)",
  },

  compactOfferSummary: {
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    listStyle: "none",
  },

  offerSummaryTeams: {
    display: "grid",
    gap: 2,
  },

  offerSummaryMeta: {
    color: "#7f8790",
    fontSize: 9,
  },

  pendingPill: {
    padding: "4px 7px",
    borderRadius: 999,
    border: "1px solid rgba(255,139,45,.18)",
    color: "#ff9b43",
    fontSize: 9,
    fontWeight: 1000,
  },

  offerGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2,minmax(0,1fr))",
    gap: 8,
  },

  offerSide: {
    minWidth: 0,
    padding: 8,
    display: "grid",
    gap: 6,
    border: "1px solid rgba(255,255,255,.055)",
    borderRadius: 6,
    background: "#121416",
  },

  offerAssets: {
    display: "grid",
    gap: 5,
  },

  pendingAssetLabel: {
    marginTop: 3,
    color: "#737b84",
    fontSize: 8,
    fontWeight: 1000,
    letterSpacing: ".08em",
  },

  pendingAssetRow: {
    padding: "7px 8px",
    display: "grid",
    gap: 2,
    borderRadius: 5,
    background: "rgba(255,255,255,.035)",
  },

  pendingAssetEmpty: {
    padding: "6px 8px",
    color: "#737b84",
    fontSize: 10,
  },

  offerMessage: {
    padding: "8px 9px",
    borderLeft: "3px solid #ff6512",
    background: "rgba(255,101,18,.05)",
    color: "#c8cdd2",
    fontSize: 11,
    fontStyle: "italic",
  },

  buttonRow: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 7,
    flexWrap: "wrap",
  },

  primaryButton: {
    minHeight: 34,
    padding: "0 12px",
    border: "1px solid rgba(255,101,18,.35)",
    borderRadius: 6,
    background: "linear-gradient(135deg,#b71d1b,#ff6512)",
    color: "#fff",
    fontSize: 10,
    fontWeight: 1000,
    cursor: "pointer",
  },

  secondaryButton: {
    minHeight: 34,
    padding: "0 12px",
    border: "1px solid rgba(255,255,255,.10)",
    borderRadius: 6,
    background: "#15181b",
    color: "#d8dce1",
    fontSize: 10,
    fontWeight: 1000,
    cursor: "pointer",
  },

  dangerButton: {
    minHeight: 34,
    padding: "0 12px",
    border: "1px solid rgba(255,80,80,.20)",
    borderRadius: 6,
    background: "rgba(180,30,30,.08)",
    color: "#ff8c8c",
    fontSize: 10,
    fontWeight: 1000,
    cursor: "pointer",
  },

  historyCard: {
    border: "1px solid rgba(255,255,255,.07)",
    borderRadius: 8,
    background: "#111315",
    overflow: "hidden",
  },

  historySummary: {
    padding: "11px 12px",
    cursor: "pointer",
    color: "#9ba1a8",
    fontSize: 10,
    fontWeight: 1000,
    letterSpacing: ".05em",
  },

  historyList: {
    padding: "0 10px 10px",
    display: "grid",
    gap: 6,
  },

  historyRow: {
    padding: "8px 9px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    borderRadius: 6,
    background: "rgba(255,255,255,.03)",
    fontSize: 10,
  },

  closedPill: {
    padding: "4px 7px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,.08)",
    color: "#8d949d",
    fontSize: 8,
    fontWeight: 1000,
  },

  offerCardHead: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },

  tradeBlockTitle: {
    color: "#fff",
    fontSize: 12,
  },

  tradeBlockHelp: {
    marginTop: 4,
    maxWidth: 760,
    color: "#7f8790",
    fontSize: 10,
    lineHeight: 1.45,
  },

  tradeBlockGrid: {
    display: "grid",
    gap: 7,
  },

  tradeBlockTeamCard: {
    minHeight: 56,
    padding: "9px 10px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    flexWrap: "wrap",
    border: "1px solid rgba(255,255,255,.06)",
    borderRadius: 7,
    background: "#111315",
  },

  tradeBlockTeamNeeds: {
    display: "block",
    marginTop: 3,
    color: "#7f8790",
    fontSize: 9,
    fontWeight: 800,
  },

  error: {
    padding: "9px 10px",
    border: "1px solid rgba(255,80,80,.20)",
    borderRadius: 6,
    background: "rgba(180,30,30,.10)",
    color: "#ff8c8c",
    fontSize: 12,
  },

  success: {
    padding: "9px 10px",
    border: "1px solid rgba(70,220,135,.18)",
    borderRadius: 6,
    background: "rgba(70,220,135,.08)",
    color: "#58df8d",
    fontSize: 12,
  },

  empty: {
    padding: "18px 12px",
    color: "#777f88",
    fontSize: 12,
    textAlign: "center",
  },
};
