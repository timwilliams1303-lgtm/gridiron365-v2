"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

type Props = {
  leagueId: string;
};

type LeagueRow = {
  id: string;
  name: string;
  season: number;
};

type SettingsRow = {
  league_format: string | null;
};

type FantasyTeamRow = {
  id: number;
  team_name: string;
  owner_id: string | null;
  active: boolean | null;
};

type RosterRow = {
  fantasy_team_id: number;
  nhl_player_id: number;
};

type PlayerRow = {
  id: number;
  display_name: string;
  first_name: string | null;
  last_name: string | null;
  position: string | null;
  position_group: string | null;
  team_id: number | null;
  injury_status: string | null;
  headshot_url: string | null;
};

type NhlTeamRow = {
  id: number;
  abbreviation?: string | null;
  short_name?: string | null;
  name?: string | null;
  display_name?: string | null;
};

type PickAssetRow = {
  id: number;
  league_id: string;
  draft_season: number;
  round_number: number;
  original_fantasy_team_id: number;
  current_fantasy_team_id: number;
  pick_number: number | null;
  used_nhl_player_id: number | null;
  used_at: string | null;
};

type TradeOfferRow = {
  id: number;
  league_id: string;
  season: number;
  proposing_fantasy_team_id: number;
  receiving_fantasy_team_id: number;
  status: string;
  message: string | null;
  failure_reason: string | null;
  proposed_at: string;
  responded_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
};

type TradePlayerRow = {
  id: number;
  trade_offer_id: number;
  nhl_player_id: number;
  from_fantasy_team_id: number;
  to_fantasy_team_id: number;
};

type TradePickRow = {
  id: number;
  trade_offer_id: number;
  draft_pick_asset_id: number;
  from_fantasy_team_id: number;
  to_fantasy_team_id: number;
};

type OfferView = TradeOfferRow & {
  offeredPlayers: PlayerRow[];
  requestedPlayers: PlayerRow[];
  offeredPicks: PickAssetRow[];
  requestedPicks: PickAssetRow[];
};

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function playerName(player: PlayerRow) {
  return (
    player.display_name?.trim() ||
    `${player.first_name ?? ""} ${player.last_name ?? ""}`.trim() ||
    `Player ${player.id}`
  );
}

function normalizePosition(player: PlayerRow) {
  return String(player.position ?? player.position_group ?? "—").toUpperCase();
}

function dateLabel(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function pickLabel(pick: PickAssetRow, teams: Map<number, FantasyTeamRow>) {
  const original = teams.get(pick.original_fantasy_team_id)?.team_name ?? "Original team";
  const pickNo = pick.pick_number ? ` • Pick ${pick.pick_number}` : "";
  return `${pick.draft_season} Round ${pick.round_number}${pickNo} • ${original}`;
}

function statusLabel(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function NhlTraditionalTrades({ leagueId }: Props) {
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [userId, setUserId] = useState<string | null>(null);
  const [league, setLeague] = useState<LeagueRow | null>(null);
  const [leagueFormat, setLeagueFormat] = useState("redraft");
  const [teams, setTeams] = useState<FantasyTeamRow[]>([]);
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [nhlTeams, setNhlTeams] = useState<NhlTeamRow[]>([]);
  const [rosters, setRosters] = useState<RosterRow[]>([]);
  const [pickAssets, setPickAssets] = useState<PickAssetRow[]>([]);
  const [offers, setOffers] = useState<OfferView[]>([]);

  const [partnerTeamId, setPartnerTeamId] = useState<number | null>(null);
  const [offeredPlayerIds, setOfferedPlayerIds] = useState<number[]>([]);
  const [requestedPlayerIds, setRequestedPlayerIds] = useState<number[]>([]);
  const [offeredPickIds, setOfferedPickIds] = useState<number[]>([]);
  const [requestedPickIds, setRequestedPickIds] = useState<number[]>([]);
  const [tradeMessage, setTradeMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;

      const uid = authData.user?.id ?? null;
      setUserId(uid);

      const [
        leagueResult,
        settingsResult,
        teamsResult,
        rosterResult,
        playersResult,
        nhlTeamsResult,
        offersResult,
      ] = await Promise.all([
        supabase
          .from("leagues")
          .select("id,name,season")
          .eq("id", leagueId)
          .single(),
        supabase
          .from("nhl_traditional_settings")
          .select("league_format")
          .eq("league_id", leagueId)
          .maybeSingle(),
        supabase
          .from("fantasy_teams")
          .select("id,team_name,owner_id,active")
          .eq("league_id", leagueId)
          .eq("active", true)
          .order("id"),
        supabase
          .from("nhl_traditional_rosters")
          .select("fantasy_team_id,nhl_player_id")
          .eq("league_id", leagueId)
          .is("dropped_at", null),
        supabase
          .from("nhl_players")
          .select(
            "id,display_name,first_name,last_name,position,position_group,team_id,injury_status,headshot_url"
          )
          .eq("active", true)
          .order("display_name"),
        supabase
          .from("nhl_teams")
          .select("id,abbreviation,short_name,name,display_name"),
        supabase
          .from("nhl_traditional_trade_offers")
          .select(
            "id,league_id,season,proposing_fantasy_team_id,receiving_fantasy_team_id,status,message,failure_reason,proposed_at,responded_at,completed_at,cancelled_at"
          )
          .eq("league_id", leagueId)
          .order("proposed_at", { ascending: false }),
      ]);

      if (leagueResult.error) throw leagueResult.error;
      if (settingsResult.error) throw settingsResult.error;
      if (teamsResult.error) throw teamsResult.error;
      if (rosterResult.error) throw rosterResult.error;
      if (playersResult.error) throw playersResult.error;
      if (nhlTeamsResult.error) throw nhlTeamsResult.error;
      if (offersResult.error) throw offersResult.error;

      const leagueRow = leagueResult.data as LeagueRow;
      const settingsRow = settingsResult.data as SettingsRow | null;
      const teamRows = (teamsResult.data ?? []) as FantasyTeamRow[];
      const offerRows = (offersResult.data ?? []) as TradeOfferRow[];

      setLeague(leagueRow);
      setLeagueFormat(settingsRow?.league_format === "dynasty" ? "dynasty" : "redraft");
      setTeams(teamRows);
      setRosters((rosterResult.data ?? []) as RosterRow[]);
      setPlayers((playersResult.data ?? []) as PlayerRow[]);
      setNhlTeams((nhlTeamsResult.data ?? []) as NhlTeamRow[]);

      let assets: PickAssetRow[] = [];
      if (settingsRow?.league_format === "dynasty") {
        const { data, error: assetError } = await supabase
          .from("nhl_dynasty_draft_pick_assets")
          .select(
            "id,league_id,draft_season,round_number,original_fantasy_team_id,current_fantasy_team_id,pick_number,used_nhl_player_id,used_at"
          )
          .eq("league_id", leagueId)
          .gte("draft_season", leagueRow.season + 1)
          .lte("draft_season", leagueRow.season + 2)
          .is("used_at", null)
          .order("draft_season")
          .order("round_number")
          .order("pick_number");
        if (assetError) throw assetError;
        assets = (data ?? []) as PickAssetRow[];
      }
      setPickAssets(assets);

      const offerIds = offerRows.map((offer) => offer.id);
      let tradePlayers: TradePlayerRow[] = [];
      let tradePicks: TradePickRow[] = [];

      if (offerIds.length > 0) {
        const [tradePlayersResult, tradePicksResult] = await Promise.all([
          supabase
            .from("nhl_traditional_trade_players")
            .select(
              "id,trade_offer_id,nhl_player_id,from_fantasy_team_id,to_fantasy_team_id"
            )
            .in("trade_offer_id", offerIds),
          supabase
            .from("nhl_traditional_trade_draft_picks")
            .select(
              "id,trade_offer_id,draft_pick_asset_id,from_fantasy_team_id,to_fantasy_team_id"
            )
            .in("trade_offer_id", offerIds),
        ]);

        if (tradePlayersResult.error) throw tradePlayersResult.error;
        if (tradePicksResult.error) throw tradePicksResult.error;

        tradePlayers = (tradePlayersResult.data ?? []) as TradePlayerRow[];
        tradePicks = (tradePicksResult.data ?? []) as TradePickRow[];
      }

      const playerMap = new Map(
        ((playersResult.data ?? []) as PlayerRow[]).map((player) => [player.id, player])
      );
      const assetMap = new Map(assets.map((asset) => [asset.id, asset]));

      const builtOffers: OfferView[] = offerRows.map((offer) => {
        const rows = tradePlayers.filter((row) => row.trade_offer_id === offer.id);
        const pickRows = tradePicks.filter((row) => row.trade_offer_id === offer.id);

        return {
          ...offer,
          offeredPlayers: rows
            .filter((row) => row.from_fantasy_team_id === offer.proposing_fantasy_team_id)
            .map((row) => playerMap.get(row.nhl_player_id))
            .filter((row): row is PlayerRow => Boolean(row)),
          requestedPlayers: rows
            .filter((row) => row.from_fantasy_team_id === offer.receiving_fantasy_team_id)
            .map((row) => playerMap.get(row.nhl_player_id))
            .filter((row): row is PlayerRow => Boolean(row)),
          offeredPicks: pickRows
            .filter((row) => row.from_fantasy_team_id === offer.proposing_fantasy_team_id)
            .map((row) => assetMap.get(row.draft_pick_asset_id))
            .filter((row): row is PickAssetRow => Boolean(row)),
          requestedPicks: pickRows
            .filter((row) => row.from_fantasy_team_id === offer.receiving_fantasy_team_id)
            .map((row) => assetMap.get(row.draft_pick_asset_id))
            .filter((row): row is PickAssetRow => Boolean(row)),
        };
      });

      setOffers(builtOffers);

      const mine = teamRows.find((team) => team.owner_id === uid);
      if (!partnerTeamId && mine) {
        const firstPartner = teamRows.find((team) => team.id !== mine.id);
        setPartnerTeamId(firstPartner?.id ?? null);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load NHL trades.");
    } finally {
      setLoading(false);
    }
  }, [leagueId, partnerTeamId]);

  useEffect(() => {
    void load();
  }, [load]);

  const teamMap = useMemo(
    () => new Map(teams.map((team) => [team.id, team])),
    [teams]
  );
  const nhlTeamMap = useMemo(
    () => new Map(nhlTeams.map((team) => [team.id, team])),
    [nhlTeams]
  );
  const playerMap = useMemo(
    () => new Map(players.map((player) => [player.id, player])),
    [players]
  );

  const myTeam = useMemo(
    () => teams.find((team) => team.owner_id === userId) ?? null,
    [teams, userId]
  );

  const partnerTeam = partnerTeamId ? teamMap.get(partnerTeamId) ?? null : null;

  const rosterFor = useCallback(
    (teamId: number | null) => {
      if (!teamId) return [];
      return rosters
        .filter((row) => row.fantasy_team_id === teamId)
        .map((row) => playerMap.get(row.nhl_player_id))
        .filter((row): row is PlayerRow => Boolean(row))
        .sort((a, b) => playerName(a).localeCompare(playerName(b)));
    },
    [rosters, playerMap]
  );

  const myRoster = useMemo(() => rosterFor(myTeam?.id ?? null), [myTeam, rosterFor]);
  const partnerRoster = useMemo(
    () => rosterFor(partnerTeamId),
    [partnerTeamId, rosterFor]
  );

  const myPicks = useMemo(
    () =>
      pickAssets.filter(
        (pick) =>
          myTeam &&
          pick.current_fantasy_team_id === myTeam.id &&
          pick.used_nhl_player_id === null
      ),
    [pickAssets, myTeam]
  );

  const partnerPicks = useMemo(
    () =>
      pickAssets.filter(
        (pick) =>
          partnerTeamId &&
          pick.current_fantasy_team_id === partnerTeamId &&
          pick.used_nhl_player_id === null
      ),
    [pickAssets, partnerTeamId]
  );

  const myOffers = useMemo(() => {
    if (!myTeam) return [];
    return offers.filter(
      (offer) =>
        offer.proposing_fantasy_team_id === myTeam.id ||
        offer.receiving_fantasy_team_id === myTeam.id
    );
  }, [offers, myTeam]);

  function toggle(setter: React.Dispatch<React.SetStateAction<number[]>>, id: number) {
    setter((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id]
    );
  }

  function resetBuilder() {
    setOfferedPlayerIds([]);
    setRequestedPlayerIds([]);
    setOfferedPickIds([]);
    setRequestedPickIds([]);
    setTradeMessage("");
  }

  async function submitTrade() {
    if (!myTeam || !partnerTeamId) {
      setError("Choose a trade partner first.");
      return;
    }

    if (
      offeredPlayerIds.length === 0 &&
      requestedPlayerIds.length === 0 &&
      offeredPickIds.length === 0 &&
      requestedPickIds.length === 0
    ) {
      setError("Add at least one player or draft pick to the trade.");
      return;
    }

    setWorking(true);
    setError("");
    setMessage("");

    const { error: rpcError } = await supabase.rpc(
      "submit_nhl_traditional_trade_offer",
      {
        p_league_id: leagueId,
        p_proposing_fantasy_team_id: myTeam.id,
        p_receiving_fantasy_team_id: partnerTeamId,
        p_offered_player_ids: offeredPlayerIds,
        p_requested_player_ids: requestedPlayerIds,
        p_offered_draft_pick_asset_ids:
          leagueFormat === "dynasty" ? offeredPickIds : [],
        p_requested_draft_pick_asset_ids:
          leagueFormat === "dynasty" ? requestedPickIds : [],
        p_message: tradeMessage.trim() || null,
      }
    );

    if (rpcError) {
      setError(rpcError.message);
      setWorking(false);
      return;
    }

    resetBuilder();
    setMessage("Trade offer sent.");
    await load();
    setWorking(false);
  }

  async function actOnOffer(
    action: "accept" | "reject" | "cancel",
    offer: OfferView
  ) {
    if (!myTeam) return;

    setWorking(true);
    setError("");
    setMessage("");

    const rpcName =
      action === "accept"
        ? "accept_nhl_traditional_trade_offer"
        : action === "reject"
          ? "reject_nhl_traditional_trade_offer"
          : "cancel_nhl_traditional_trade_offer";

    const args =
      action === "cancel"
        ? {
            p_trade_offer_id: offer.id,
            p_proposing_fantasy_team_id: myTeam.id,
          }
        : {
            p_trade_offer_id: offer.id,
            p_receiving_fantasy_team_id: myTeam.id,
          };

    const { error: rpcError } = await supabase.rpc(rpcName, args);

    if (rpcError) {
      setError(rpcError.message);
      setWorking(false);
      return;
    }

    setMessage(
      action === "accept"
        ? "Trade accepted."
        : action === "reject"
          ? "Trade rejected."
          : "Trade cancelled."
    );
    await load();
    setWorking(false);
  }

  if (loading) {
    return (
      <main className="g365-trades-page">
        <style>{styles}</style>
        <div className="g365-trades-shell">
          <div className="g365-panel loading-panel">Loading NHL trades…</div>
        </div>
      </main>
    );
  }

  if (!league || !myTeam) {
    return (
      <main className="g365-trades-page">
        <style>{styles}</style>
        <div className="g365-trades-shell">
          <div className="g365-panel">
            <h1>Trades</h1>
            <p className="muted">
              No active fantasy team is attached to your account in this league.
            </p>
            {error ? <div className="error-box">{error}</div> : null}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="g365-trades-page">
      <style>{styles}</style>

      <section className="g365-trades-shell">
        <header className="page-header">
          <div>
            <p className="eyebrow">
              {leagueFormat === "dynasty" ? "NHL DYNASTY" : "NHL REDRAFT"}
            </p>
            <h1>Trades</h1>
            <p className="subtitle">
              {league.name} • {league.season} • {myTeam.team_name}
            </p>
          </div>

          <div className={`format-pill ${leagueFormat}`}>
            {leagueFormat === "dynasty" ? "DYNASTY" : "REDRAFT"}
          </div>
        </header>

        {error ? <div className="error-box">{error}</div> : null}
        {message ? <div className="success-box">{message}</div> : null}

        <section className="g365-panel trade-hero">
          <div>
            <p className="eyebrow">TRADE CENTER</p>
            <h2>Build an offer</h2>
            <p>
              {leagueFormat === "dynasty"
                ? `Trade NHL players and eligible ${league.season + 1}–${league.season + 2} draft-pick assets.`
                : "Trade NHL players with another team in your league."}
            </p>
          </div>

          <label className="partner-select">
            <span>Trade partner</span>
            <select
              value={partnerTeamId ?? ""}
              onChange={(event) => {
                const next = Number(event.target.value);
                setPartnerTeamId(Number.isFinite(next) ? next : null);
                resetBuilder();
              }}
            >
              {teams
                .filter((team) => team.id !== myTeam.id)
                .map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.team_name}
                  </option>
                ))}
            </select>
          </label>
        </section>

        <section className="trade-grid">
          <TradeSide
            title={`You send • ${myTeam.team_name}`}
            players={myRoster}
            selectedPlayerIds={offeredPlayerIds}
            onTogglePlayer={(id) => toggle(setOfferedPlayerIds, id)}
            picks={leagueFormat === "dynasty" ? myPicks : []}
            selectedPickIds={offeredPickIds}
            onTogglePick={(id) => toggle(setOfferedPickIds, id)}
            teamMap={teamMap}
            nhlTeamMap={nhlTeamMap}
            dynasty={leagueFormat === "dynasty"}
          />

          <div className="trade-arrow" aria-hidden="true">
            ⇄
          </div>

          <TradeSide
            title={`You receive • ${partnerTeam?.team_name ?? "Choose team"}`}
            players={partnerRoster}
            selectedPlayerIds={requestedPlayerIds}
            onTogglePlayer={(id) => toggle(setRequestedPlayerIds, id)}
            picks={leagueFormat === "dynasty" ? partnerPicks : []}
            selectedPickIds={requestedPickIds}
            onTogglePick={(id) => toggle(setRequestedPickIds, id)}
            teamMap={teamMap}
            nhlTeamMap={nhlTeamMap}
            dynasty={leagueFormat === "dynasty"}
          />
        </section>

        <section className="g365-panel submit-panel">
          <label>
            <span>Message <em>optional</em></span>
            <textarea
              value={tradeMessage}
              onChange={(event) => setTradeMessage(event.target.value)}
              maxLength={500}
              placeholder="Add a note to the trade offer…"
            />
          </label>

          <div className="submit-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={resetBuilder}
              disabled={working}
            >
              Clear
            </button>
            <button
              type="button"
              className="primary-button"
              onClick={() => void submitTrade()}
              disabled={working || !partnerTeamId}
            >
              {working ? "Working…" : "Send Trade Offer"}
            </button>
          </div>
        </section>

        <section className="offers-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">LEAGUE ACTIVITY</p>
              <h2>Your trade offers</h2>
            </div>
            <span>{myOffers.length} total</span>
          </div>

          {myOffers.length === 0 ? (
            <div className="g365-panel empty-state">
              No trade offers yet.
            </div>
          ) : (
            <div className="offers-list">
              {myOffers.map((offer) => {
                const incoming = offer.receiving_fantasy_team_id === myTeam.id;
                const otherTeamId = incoming
                  ? offer.proposing_fantasy_team_id
                  : offer.receiving_fantasy_team_id;
                const otherTeam = teamMap.get(otherTeamId);

                const myPlayers = incoming
                  ? offer.requestedPlayers
                  : offer.offeredPlayers;
                const theirPlayers = incoming
                  ? offer.offeredPlayers
                  : offer.requestedPlayers;
                const myOfferPicks = incoming
                  ? offer.requestedPicks
                  : offer.offeredPicks;
                const theirOfferPicks = incoming
                  ? offer.offeredPicks
                  : offer.requestedPicks;

                return (
                  <article className="g365-panel offer-card" key={offer.id}>
                    <div className="offer-top">
                      <div>
                        <span className={incoming ? "direction incoming" : "direction outgoing"}>
                          {incoming ? "INCOMING" : "OUTGOING"}
                        </span>
                        <h3>{otherTeam?.team_name ?? `Team ${otherTeamId}`}</h3>
                        <p>{dateLabel(offer.proposed_at)}</p>
                      </div>
                      <span className={`status status-${offer.status.toLowerCase()}`}>
                        {statusLabel(offer.status)}
                      </span>
                    </div>

                    <div className="offer-assets">
                      <AssetSummary
                        heading="You give"
                        players={myPlayers}
                        picks={myOfferPicks}
                        teams={teamMap}
                      />
                      <AssetSummary
                        heading="You get"
                        players={theirPlayers}
                        picks={theirOfferPicks}
                        teams={teamMap}
                      />
                    </div>

                    {offer.message ? (
                      <div className="offer-message">“{offer.message}”</div>
                    ) : null}

                    {offer.failure_reason ? (
                      <div className="error-box">{offer.failure_reason}</div>
                    ) : null}

                    {offer.status === "pending" ? (
                      <div className="offer-actions">
                        {incoming ? (
                          <>
                            <button
                              type="button"
                              className="secondary-button"
                              disabled={working}
                              onClick={() => void actOnOffer("reject", offer)}
                            >
                              Reject
                            </button>
                            <button
                              type="button"
                              className="primary-button"
                              disabled={working}
                              onClick={() => void actOnOffer("accept", offer)}
                            >
                              Accept Trade
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            className="secondary-button"
                            disabled={working}
                            onClick={() => void actOnOffer("cancel", offer)}
                          >
                            Cancel Offer
                          </button>
                        )}
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}

function TradeSide({
  title,
  players,
  selectedPlayerIds,
  onTogglePlayer,
  picks,
  selectedPickIds,
  onTogglePick,
  teamMap,
  nhlTeamMap,
  dynasty,
}: {
  title: string;
  players: PlayerRow[];
  selectedPlayerIds: number[];
  onTogglePlayer: (id: number) => void;
  picks: PickAssetRow[];
  selectedPickIds: number[];
  onTogglePick: (id: number) => void;
  teamMap: Map<number, FantasyTeamRow>;
  nhlTeamMap: Map<number, NhlTeamRow>;
  dynasty: boolean;
}) {
  return (
    <section className="g365-panel trade-side">
      <h2>{title}</h2>

      <div className="asset-block">
        <div className="asset-title">
          <span>Players</span>
          <span>{selectedPlayerIds.length} selected</span>
        </div>

        {players.length === 0 ? (
          <div className="mini-empty">No active players found.</div>
        ) : (
          <div className="player-list">
            {players.map((player) => {
              const checked = selectedPlayerIds.includes(player.id);
              const nhlTeam = player.team_id ? nhlTeamMap.get(player.team_id) : null;
              const teamLabel =
                nhlTeam?.abbreviation ??
                nhlTeam?.short_name ??
                nhlTeam?.name ??
                nhlTeam?.display_name ??
                "FA";

              return (
                <button
                  type="button"
                  key={player.id}
                  className={`asset-row ${checked ? "selected" : ""}`}
                  onClick={() => onTogglePlayer(player.id)}
                >
                  <span className="check">{checked ? "✓" : ""}</span>
                  <span className="asset-main">
                    <strong>{playerName(player)}</strong>
                    <small>
                      {normalizePosition(player)} • {teamLabel}
                      {player.injury_status &&
                      !["active", "healthy"].includes(player.injury_status.toLowerCase())
                        ? ` • ${player.injury_status}`
                        : ""}
                    </small>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {dynasty ? (
        <div className="asset-block">
          <div className="asset-title">
            <span>Draft Picks</span>
            <span>{selectedPickIds.length} selected</span>
          </div>

          {picks.length === 0 ? (
            <div className="mini-empty">
              No eligible future draft-pick assets found.
            </div>
          ) : (
            <div className="player-list">
              {picks.map((pick) => {
                const checked = selectedPickIds.includes(pick.id);
                return (
                  <button
                    type="button"
                    key={pick.id}
                    className={`asset-row ${checked ? "selected" : ""}`}
                    onClick={() => onTogglePick(pick.id)}
                  >
                    <span className="check">{checked ? "✓" : ""}</span>
                    <span className="asset-main">
                      <strong>
                        {pick.draft_season} Round {pick.round_number}
                      </strong>
                      <small>
                        {pick.pick_number ? `Pick ${pick.pick_number} • ` : ""}
                        Originally {teamMap.get(pick.original_fantasy_team_id)?.team_name ?? "Unknown"}
                      </small>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}

function AssetSummary({
  heading,
  players,
  picks,
  teams,
}: {
  heading: string;
  players: PlayerRow[];
  picks: PickAssetRow[];
  teams: Map<number, FantasyTeamRow>;
}) {
  return (
    <div className="summary-box">
      <strong>{heading}</strong>
      {players.length === 0 && picks.length === 0 ? (
        <span className="muted">Nothing</span>
      ) : (
        <>
          {players.map((player) => (
            <span key={`player-${player.id}`}>
              {playerName(player)} • {normalizePosition(player)}
            </span>
          ))}
          {picks.map((pick) => (
            <span key={`pick-${pick.id}`}>{pickLabel(pick, teams)}</span>
          ))}
        </>
      )}
    </div>
  );
}

const styles = `
  * { box-sizing: border-box; }

  .g365-trades-page {
    min-height: 100vh;
    padding: 32px 18px 60px;
    color: #fff;
    background:
      radial-gradient(circle at 15% 0%, rgba(255, 105, 0, .13), transparent 28rem),
      radial-gradient(circle at 88% 18%, rgba(215, 30, 25, .10), transparent 24rem),
      #08090b;
  }

  .g365-trades-shell {
    width: min(1240px, 100%);
    margin: 0 auto;
    display: grid;
    gap: 22px;
  }

  .page-header, .trade-hero, .section-heading, .offer-top, .submit-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }

  .page-header h1 {
    margin: 2px 0 4px;
    font-size: clamp(30px, 5vw, 44px);
    line-height: 1;
    letter-spacing: -.04em;
  }

  .eyebrow {
    margin: 0 0 7px;
    color: #ff7a18;
    font-size: 10px;
    font-weight: 900;
    letter-spacing: .18em;
  }

  .subtitle, .muted, .offer-top p {
    margin: 0;
    color: #9298a3;
    font-size: 13px;
  }

  .format-pill, .status, .direction {
    border: 1px solid rgba(255, 122, 24, .42);
    border-radius: 999px;
    padding: 8px 11px;
    color: #ffb26f;
    background: rgba(255, 122, 24, .08);
    font-size: 10px;
    font-weight: 900;
    letter-spacing: .1em;
  }

  .format-pill.dynasty {
    border-color: rgba(224, 44, 30, .55);
    background: rgba(224, 44, 30, .10);
  }

  .g365-panel {
    border: 1px solid rgba(255, 122, 24, .22);
    border-radius: 16px;
    background:
      linear-gradient(145deg, rgba(28, 29, 33, .97), rgba(12, 13, 16, .98));
    box-shadow: 0 16px 45px rgba(0, 0, 0, .28);
  }

  .trade-hero {
    padding: 20px;
    border-color: rgba(255, 122, 24, .42);
    background:
      radial-gradient(circle at 85% 15%, rgba(255, 122, 24, .12), transparent 20rem),
      linear-gradient(135deg, rgba(82, 17, 12, .65), rgba(19, 17, 17, .98) 55%);
  }

  .trade-hero h2, .section-heading h2, .trade-side h2 {
    margin: 0;
    font-size: 20px;
  }

  .trade-hero p:not(.eyebrow) {
    margin: 7px 0 0;
    color: #a7acb5;
    font-size: 13px;
  }

  .partner-select {
    display: grid;
    gap: 7px;
    min-width: min(280px, 100%);
  }

  label > span, .asset-title {
    color: #b5bac3;
    font-size: 11px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: .08em;
  }

  select, textarea {
    width: 100%;
    border: 1px solid #34373d;
    border-radius: 10px;
    background: #101216;
    color: #fff;
    outline: none;
  }

  select { min-height: 44px; padding: 0 12px; }
  textarea { min-height: 88px; resize: vertical; padding: 12px; font: inherit; }

  select:focus, textarea:focus { border-color: #ff7a18; }

  .trade-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 48px minmax(0, 1fr);
    gap: 12px;
    align-items: start;
  }

  .trade-arrow {
    display: grid;
    place-items: center;
    min-height: 70px;
    color: #ff7a18;
    font-size: 27px;
    font-weight: 900;
  }

  .trade-side { padding: 18px; min-width: 0; }
  .trade-side h2 { margin-bottom: 16px; }

  .asset-block + .asset-block {
    margin-top: 20px;
    padding-top: 18px;
    border-top: 1px solid #292c31;
  }

  .asset-title {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 9px;
  }

  .asset-title span:last-child {
    color: #ff8b36;
    letter-spacing: 0;
    text-transform: none;
  }

  .player-list {
    display: grid;
    gap: 7px;
    max-height: 430px;
    overflow-y: auto;
    padding-right: 3px;
  }

  .asset-row {
    width: 100%;
    min-height: 58px;
    display: flex;
    align-items: center;
    gap: 11px;
    padding: 9px 10px;
    border: 1px solid #2d3035;
    border-radius: 11px;
    color: #fff;
    background: #111318;
    text-align: left;
    cursor: pointer;
  }

  .asset-row:hover { border-color: rgba(255, 122, 24, .55); }

  .asset-row.selected {
    border-color: #ff7a18;
    background: linear-gradient(135deg, rgba(180, 39, 22, .24), rgba(255, 122, 24, .08));
  }

  .check {
    width: 25px;
    height: 25px;
    flex: 0 0 25px;
    display: grid;
    place-items: center;
    border: 1px solid #454950;
    border-radius: 7px;
    color: #fff;
    background: #090a0d;
    font-weight: 900;
  }

  .selected .check {
    border-color: #ff7a18;
    background: linear-gradient(135deg, #d92d1d, #ff7a18);
  }

  .asset-main { min-width: 0; display: grid; gap: 4px; }
  .asset-main strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .asset-main small { color: #9298a3; font-size: 11px; }

  .mini-empty, .empty-state, .loading-panel {
    padding: 24px;
    color: #9298a3;
    text-align: center;
  }

  .submit-panel { padding: 18px; display: grid; gap: 14px; }
  .submit-panel label { display: grid; gap: 7px; }
  .submit-panel em { color: #777d87; font-style: normal; font-weight: 600; text-transform: none; }

  button {
    font: inherit;
  }

  .primary-button, .secondary-button {
    min-height: 42px;
    border-radius: 9px;
    padding: 0 15px;
    font-weight: 900;
    cursor: pointer;
  }

  .primary-button {
    border: 1px solid #ff7a18;
    color: #fff;
    background: linear-gradient(135deg, #c51f1a, #ff7418);
  }

  .secondary-button {
    border: 1px solid rgba(255, 122, 24, .42);
    color: #ff9b4f;
    background: rgba(255, 122, 24, .08);
  }

  button:disabled { opacity: .55; cursor: not-allowed; }

  .offers-section { display: grid; gap: 12px; }
  .section-heading > span { color: #777d87; font-size: 12px; }
  .offers-list { display: grid; gap: 12px; }
  .offer-card { padding: 18px; }
  .offer-top h3 { margin: 8px 0 4px; }

  .direction { display: inline-block; padding: 5px 8px; }
  .direction.incoming { color: #ffb26f; }
  .direction.outgoing { color: #d7dbe2; border-color: #444850; background: #17191d; }

  .status { white-space: nowrap; }
  .status-accepted, .status-completed {
    color: #82e09b;
    border-color: rgba(77, 190, 105, .4);
    background: rgba(77, 190, 105, .08);
  }

  .offer-assets {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin-top: 16px;
  }

  .summary-box {
    min-width: 0;
    display: grid;
    align-content: start;
    gap: 6px;
    padding: 12px;
    border: 1px solid #292c31;
    border-radius: 11px;
    background: #0d0f12;
  }

  .summary-box > strong { color: #ff8b36; font-size: 11px; text-transform: uppercase; }
  .summary-box > span { font-size: 12px; overflow-wrap: anywhere; }

  .offer-message {
    margin-top: 12px;
    padding: 11px 12px;
    border-left: 3px solid #ff7a18;
    color: #c5c9cf;
    background: rgba(255, 122, 24, .05);
    font-size: 12px;
  }

  .offer-actions {
    display: flex;
    justify-content: flex-end;
    gap: 9px;
    margin-top: 14px;
  }

  .error-box, .success-box {
    border-radius: 10px;
    padding: 11px 13px;
    font-size: 12px;
    font-weight: 700;
  }

  .error-box {
    border: 1px solid rgba(255, 76, 76, .42);
    color: #ff9b9b;
    background: rgba(175, 26, 26, .12);
  }

  .success-box {
    border: 1px solid rgba(77, 190, 105, .4);
    color: #8ee5a5;
    background: rgba(77, 190, 105, .08);
  }

  @media (max-width: 820px) {
    .g365-trades-page { padding: 22px 12px 46px; }
    .page-header, .trade-hero { align-items: stretch; flex-direction: column; }
    .format-pill { align-self: flex-start; }
    .partner-select { min-width: 0; width: 100%; }
    .trade-grid { grid-template-columns: 1fr; }
    .trade-arrow { min-height: 28px; transform: rotate(90deg); }
  }

  @media (max-width: 560px) {
    .g365-trades-page { padding-inline: 9px; }
    .trade-hero, .trade-side, .submit-panel, .offer-card { padding: 14px; }
    .offer-assets { grid-template-columns: 1fr; }
    .submit-actions, .offer-actions { display: grid; grid-template-columns: 1fr; }
    .primary-button, .secondary-button { width: 100%; min-height: 46px; }
    .asset-row { min-height: 62px; }
    .section-heading { align-items: flex-end; }
  }
`;
