"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { createBrowserClient } from "@supabase/ssr";

type Props = {
  leagueId: string;
};

type Settings = {
  season: number;
  league_format: string | null;
  waiver_mode: string | null;
  faab_budget: number | null;
};

type FantasyTeam = {
  id: number;
  team_name: string;
  owner_id: string | null;
  active: boolean | null;
  is_cpu: boolean | null;
};

type Player = {
  id: number;
  display_name: string;
  short_name: string | null;
  team_id: number | null;
  position: string | null;
  position_group: string | null;
  jersey_number: string | null;
  active: boolean | null;
  status: string | null;
  injury_status: string | null;
  headshot_url: string | null;
};

type RosterRow = {
  id: number;
  fantasy_team_id: number;
  nhl_player_id: number;
  roster_status: string;
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

type WaiverState = {
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

type ClaimModalState = {
  player: Player;
} | null;

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function n(value: unknown) {
  const result = Number(value);
  return Number.isFinite(result) ? result : 0;
}

function title(value: string | null | undefined) {
  return (value ?? "—")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();
}

export default function NhlTraditionalWaivers({
  leagueId,
}: Props) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [teams, setTeams] = useState<FantasyTeam[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [rosters, setRosters] = useState<RosterRow[]>([]);
  const [claims, setClaims] = useState<WaiverClaim[]>([]);
  const [waiverState, setWaiverState] = useState<WaiverState[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [search, setSearch] = useState("");
  const [positionFilter, setPositionFilter] = useState("ALL");

  const [tab, setTab] = useState<
    "AVAILABLE" | "CLAIMS" | "ORDER" | "HISTORY"
  >("AVAILABLE");

  const [claimModal, setClaimModal] = useState<ClaimModalState>(null);
  const [dropPlayerId, setDropPlayerId] = useState<number | null>(null);
  const [faabBid, setFaabBid] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [actionId, setActionId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError) {
        throw authError;
      }

      const currentUserId = authData.user?.id ?? null;
      setUserId(currentUserId);

      const { data: settingsData, error: settingsError } =
        await supabase
          .from("nhl_traditional_settings")
          .select(`
            season,
            league_format,
            waiver_mode,
            faab_budget
          `)
          .eq("league_id", leagueId)
          .single();

      if (settingsError) {
        throw settingsError;
      }

      const normalizedSettings: Settings = {
        season: n(settingsData.season),
        league_format: settingsData.league_format ?? null,
        waiver_mode: settingsData.waiver_mode ?? "rolling",
        faab_budget:
          settingsData.faab_budget == null
            ? null
            : n(settingsData.faab_budget),
      };

      setSettings(normalizedSettings);

      const [
        teamsResult,
        playersResult,
        rostersResult,
        claimsResult,
        stateResult,
        transactionsResult,
      ] = await Promise.all([
        supabase
          .from("fantasy_teams")
          .select(`
            id,
            team_name,
            owner_id,
            active,
            is_cpu
          `)
          .eq("league_id", leagueId)
          .eq("active", true)
          .order("team_name"),

        (async () => {
          const pageSize = 1000;
          const allPlayers: Player[] = [];

          for (let from = 0; ; from += pageSize) {
            const { data, error } = await supabase
              .from("nhl_players")
              .select(`
                id,
                display_name,
                short_name,
                team_id,
                position,
                position_group,
                jersey_number,
                active,
                status,
                injury_status,
                headshot_url
              `)
              .eq("active", true)
              .order("display_name", { ascending: true })
              .order("id", { ascending: true })
              .range(from, from + pageSize - 1);

            if (error) {
              return { data: null as Player[] | null, error };
            }

            const page = (data as Player[] | null) ?? [];
            allPlayers.push(...page);

            if (page.length < pageSize) break;
          }

          return { data: allPlayers, error: null };
        })(),

        supabase
          .from("nhl_traditional_rosters")
          .select(`
            id,
            fantasy_team_id,
            nhl_player_id,
            roster_status
          `)
          .eq("league_id", leagueId)
          .eq("season", normalizedSettings.season),

        supabase
          .from("nhl_traditional_waiver_claims")
          .select(`
            id,
            fantasy_team_id,
            nhl_player_id,
            drop_nhl_player_id,
            claim_priority,
            faab_bid,
            status,
            processed_at,
            failure_reason,
            created_at
          `)
          .eq("league_id", leagueId)
          .eq("season", normalizedSettings.season)
          .order("created_at", {
            ascending: false,
          }),

        supabase
          .from("nhl_traditional_waiver_team_state")
          .select(`
            fantasy_team_id,
            waiver_priority,
            faab_spent
          `)
          .eq("league_id", leagueId)
          .eq("season", normalizedSettings.season)
          .order("waiver_priority"),

        supabase
          .from("nhl_traditional_transactions")
          .select(`
            id,
            fantasy_team_id,
            transaction_type,
            nhl_player_id,
            related_nhl_player_id,
            notes,
            created_at
          `)
          .eq("league_id", leagueId)
          .eq("season", normalizedSettings.season)
          .in("transaction_type", ["waiver_add", "drop"])
          .order("created_at", {
            ascending: false,
          })
          .limit(100),
      ]);

      if (teamsResult.error) throw teamsResult.error;
      if (playersResult.error) throw playersResult.error;
      if (rostersResult.error) throw rostersResult.error;
      if (claimsResult.error) throw claimsResult.error;
      if (stateResult.error) throw stateResult.error;
      if (transactionsResult.error) throw transactionsResult.error;

      setTeams(
        (teamsResult.data ?? []).map((row) => ({
          id: n(row.id),
          team_name: row.team_name ?? "Unnamed Team",
          owner_id: row.owner_id ?? null,
          active: row.active,
          is_cpu: row.is_cpu,
        }))
      );

      setPlayers(
        (playersResult.data ?? []).map((row) => ({
          id: n(row.id),
          display_name:
            row.display_name ??
            row.short_name ??
            `Player ${row.id}`,
          short_name: row.short_name ?? null,
          team_id: row.team_id == null ? null : n(row.team_id),
          position: row.position ?? null,
          position_group: row.position_group ?? null,
          jersey_number: row.jersey_number ?? null,
          active: row.active,
          status: row.status ?? null,
          injury_status: row.injury_status ?? null,
          headshot_url: row.headshot_url ?? null,
        }))
      );

      setRosters(
        (rostersResult.data ?? []).map((row) => ({
          id: n(row.id),
          fantasy_team_id: n(row.fantasy_team_id),
          nhl_player_id: n(row.nhl_player_id),
          roster_status: row.roster_status ?? "bench",
        }))
      );

      setClaims(
        (claimsResult.data ?? []).map((row) => ({
          id: n(row.id),
          fantasy_team_id: n(row.fantasy_team_id),
          nhl_player_id: n(row.nhl_player_id),
          drop_nhl_player_id:
            row.drop_nhl_player_id == null
              ? null
              : n(row.drop_nhl_player_id),
          claim_priority: n(row.claim_priority),
          faab_bid:
            row.faab_bid == null
              ? null
              : n(row.faab_bid),
          status: row.status ?? "pending",
          processed_at: row.processed_at ?? null,
          failure_reason: row.failure_reason ?? null,
          created_at: row.created_at,
        }))
      );

      setWaiverState(
        (stateResult.data ?? []).map((row) => ({
          fantasy_team_id: n(row.fantasy_team_id),
          waiver_priority: n(row.waiver_priority),
          faab_spent: n(row.faab_spent),
        }))
      );

      setTransactions(
        (transactionsResult.data ?? []).map((row) => ({
          id: n(row.id),
          fantasy_team_id: n(row.fantasy_team_id),
          transaction_type: row.transaction_type ?? "",
          nhl_player_id: n(row.nhl_player_id),
          related_nhl_player_id:
            row.related_nhl_player_id == null
              ? null
              : n(row.related_nhl_player_id),
          notes: row.notes ?? null,
          created_at: row.created_at,
        }))
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load NHL waivers."
      );
    } finally {
      setLoading(false);
    }
  }, [leagueId]);

  useEffect(() => {
    void load();
  }, [load]);

  const myTeam = useMemo(
    () =>
      teams.find((team) => team.owner_id === userId) ?? null,
    [teams, userId]
  );

  const playerById = useMemo(
    () =>
      new Map(
        players.map((player) => [
          player.id,
          player,
        ])
      ),
    [players]
  );

  const teamById = useMemo(
    () =>
      new Map(
        teams.map((team) => [
          team.id,
          team,
        ])
      ),
    [teams]
  );

  const rosteredPlayerIds = useMemo(
    () =>
      new Set(
        rosters.map((row) => row.nhl_player_id)
      ),
    [rosters]
  );

  const myRoster = useMemo(() => {
    if (!myTeam) return [];

    return rosters
      .filter(
        (row) =>
          row.fantasy_team_id === myTeam.id
      )
      .map((row) => ({
        roster: row,
        player:
          playerById.get(row.nhl_player_id) ?? null,
      }))
      .filter(
        (
          item
        ): item is {
          roster: RosterRow;
          player: Player;
        } => item.player != null
      )
      .sort((a, b) =>
        a.player.display_name.localeCompare(
          b.player.display_name
        )
      );
  }, [myTeam, rosters, playerById]);

  const availablePlayers = useMemo(() => {
    const query = search.trim().toLowerCase();

    return players
      .filter(
        (player) =>
          !rosteredPlayerIds.has(player.id)
      )
      .filter((player) => {
        if (positionFilter === "ALL") {
          return true;
        }

        const position = (
          player.position ?? ""
        ).toUpperCase();

        const group = (
          player.position_group ?? ""
        ).toUpperCase();

        if (positionFilter === "F") {
          return (
            ["C", "LW", "RW", "F"].includes(position) ||
            group === "F"
          );
        }

        return (
          position === positionFilter ||
          group === positionFilter
        );
      })
      .filter((player) => {
        if (!query) return true;

        return (
          player.display_name
            .toLowerCase()
            .includes(query) ||
          (player.short_name ?? "")
            .toLowerCase()
            .includes(query) ||
          (player.position ?? "")
            .toLowerCase()
            .includes(query)
        );
      });
  }, [
    players,
    rosteredPlayerIds,
    search,
    positionFilter,
  ]);

  const myClaims = useMemo(() => {
    if (!myTeam) return [];

    return claims
      .filter(
        (claim) =>
          claim.fantasy_team_id === myTeam.id
      )
      .sort((a, b) => {
        if (
          a.status === "pending" &&
          b.status !== "pending"
        ) {
          return -1;
        }

        if (
          a.status !== "pending" &&
          b.status === "pending"
        ) {
          return 1;
        }

        if (
          a.status === "pending" &&
          b.status === "pending"
        ) {
          return (
            a.claim_priority -
            b.claim_priority
          );
        }

        return (
          new Date(b.created_at).getTime() -
          new Date(a.created_at).getTime()
        );
      });
  }, [claims, myTeam]);

  const pendingClaims = useMemo(
    () =>
      myClaims.filter(
        (claim) =>
          claim.status === "pending"
      ),
    [myClaims]
  );

  const myWaiverState = useMemo(() => {
    if (!myTeam) return null;

    return (
      waiverState.find(
        (row) =>
          row.fantasy_team_id === myTeam.id
      ) ?? null
    );
  }, [waiverState, myTeam]);

  const faabMode =
    (
      settings?.waiver_mode ?? ""
    ).toLowerCase() === "faab";

  const faabBudget = n(settings?.faab_budget);

  const faabRemaining = Math.max(
    0,
    faabBudget - n(myWaiverState?.faab_spent)
  );

  const openClaim = (player: Player) => {
    setMessage("");
    setDropPlayerId(null);
    setFaabBid("");
    setClaimModal({ player });
  };

  const submitClaim = async () => {
    if (!claimModal || !myTeam) {
      return;
    }

    setSubmitting(true);
    setError("");
    setMessage("");

    try {
      const nextPriority =
        pendingClaims.length + 1;

      const bid = faabMode
        ? Number(faabBid)
        : null;

      if (
        faabMode &&
        (
          !Number.isFinite(bid) ||
          bid == null ||
          bid < 0
        )
      ) {
        throw new Error(
          "Enter a valid FAAB bid."
        );
      }

      if (
        faabMode &&
        bid != null &&
        bid > faabRemaining
      ) {
        throw new Error(
          "FAAB bid exceeds your remaining budget."
        );
      }

      const { error: rpcError } =
        await supabase.rpc(
          "submit_nhl_traditional_waiver_claim",
          {
            p_league_id: leagueId,
            p_fantasy_team_id: myTeam.id,
            p_nhl_player_id: claimModal.player.id,
            p_drop_nhl_player_id: dropPlayerId,
            p_faab_bid: bid,
            p_claim_priority: nextPriority,
          }
        );

      if (rpcError) {
        throw rpcError;
      }

      const claimedName =
        claimModal.player.display_name;

      setClaimModal(null);
      setDropPlayerId(null);
      setFaabBid("");

      setMessage(
        `Waiver claim submitted for ${claimedName}.`
      );

      setTab("CLAIMS");

      await load();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to submit waiver claim."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const cancelClaim = async (
    claimId: number
  ) => {
    setActionId(claimId);
    setError("");
    setMessage("");

    try {
      const { error: rpcError } =
        await supabase.rpc(
          "cancel_nhl_traditional_waiver_claim",
          {
            p_claim_id: claimId,
          }
        );

      if (rpcError) {
        throw rpcError;
      }

      setMessage(
        "Waiver claim cancelled."
      );

      await load();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to cancel claim."
      );
    } finally {
      setActionId(null);
    }
  };

  const moveClaim = async (
    claimId: number,
    direction: -1 | 1
  ) => {
    if (!myTeam) return;

    const ordered =
      pendingClaims.map(
        (claim) => claim.id
      );

    const index =
      ordered.indexOf(claimId);

    const target =
      index + direction;

    if (
      index < 0 ||
      target < 0 ||
      target >= ordered.length
    ) {
      return;
    }

    [
      ordered[index],
      ordered[target],
    ] = [
      ordered[target],
      ordered[index],
    ];

    setActionId(claimId);
    setError("");
    setMessage("");

    try {
      const { error: rpcError } =
        await supabase.rpc(
          "reorder_nhl_traditional_waiver_claims",
          {
            p_league_id: leagueId,
            p_fantasy_team_id: myTeam.id,
            p_claim_ids: ordered,
          }
        );

      if (rpcError) {
        throw rpcError;
      }

      setMessage(
        "Claim priority updated."
      );

      await load();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to reorder claims."
      );
    } finally {
      setActionId(null);
    }
  };

  if (loading) {
    return (
      <main style={S.page}>
        <div style={S.loading}>
          Loading NHL waivers...
        </div>
      </main>
    );
  }

  return (
    <main style={S.page}>
      <div style={S.shell}>
        <section style={S.hero}>
          <div>
            <div style={S.eyebrow}>
              GRIDIRON365 • NHL TRADITIONAL
            </div>

            <h1 style={S.title}>
              Waivers
            </h1>

            <div style={S.subtitle}>
              {settings?.season ?? "—"}
              {" • "}
              {title(settings?.league_format)}
              {" • "}
              {title(settings?.waiver_mode)} Waivers
            </div>
          </div>

          <div style={S.heroStats}>
            {!faabMode && (
              <div style={S.statBox}>
                <span style={S.statLabel}>
                  MY PRIORITY
                </span>

                <strong style={S.statValue}>
                  {myWaiverState
                    ? `#${myWaiverState.waiver_priority}`
                    : "—"}
                </strong>
              </div>
            )}

            {faabMode && (
              <div style={S.statBox}>
                <span style={S.statLabel}>
                  FAAB LEFT
                </span>

                <strong style={S.statValue}>
                  ${faabRemaining.toFixed(0)}
                </strong>
              </div>
            )}

            <div style={S.statBox}>
              <span style={S.statLabel}>
                PENDING
              </span>

              <strong style={S.statValue}>
                {pendingClaims.length}
              </strong>
            </div>
          </div>
        </section>

        <Link
          href={`/league/${leagueId}/nhl`}
          style={S.back}
        >
          ← LEAGUE HOME
        </Link>

        {error && (
          <div style={S.error}>
            <strong>
              WAIVERS ERROR
            </strong>

            <span>{error}</span>

            <button
              type="button"
              onClick={() => {
                setError("");
                void load();
              }}
              style={S.retry}
            >
              RETRY
            </button>
          </div>
        )}

        {message && (
          <div style={S.success}>
            {message}
          </div>
        )}

        {!myTeam && (
          <div style={S.warning}>
            No active fantasy team is
            associated with your account in
            this league.
          </div>
        )}

        <nav style={S.tabs}>
          {[
            ["AVAILABLE", "Available"],
            [
              "CLAIMS",
              `My Claims (${pendingClaims.length})`,
            ],
            ["ORDER", "Waiver Order"],
            ["HISTORY", "History"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() =>
                setTab(
                  value as typeof tab
                )
              }
              style={{
                ...S.tab,
                ...(tab === value
                  ? S.activeTab
                  : {}),
              }}
            >
              {label}
            </button>
          ))}
        </nav>

        {tab === "AVAILABLE" && (
          <section style={S.panel}>
            <div style={S.panelHead}>
              <div>
                <strong>
                  AVAILABLE PLAYERS
                </strong>

                <div style={S.panelSub}>
                  Search unrostered NHL
                  players and submit a
                  waiver claim.
                </div>
              </div>

              <div style={S.countBadge}>
                {availablePlayers.length}
              </div>
            </div>

            <div style={S.filters}>
              <input
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value
                  )
                }
                placeholder="Search players..."
                style={S.search}
              />

              <div style={S.positionFilters}>
                {[
                  "ALL",
                  "C",
                  "LW",
                  "RW",
                  "F",
                  "D",
                  "G",
                ].map((position) => (
                  <button
                    key={position}
                    type="button"
                    onClick={() =>
                      setPositionFilter(
                        position
                      )
                    }
                    style={{
                      ...S.filterButton,
                      ...(positionFilter ===
                      position
                        ? S.filterActive
                        : {}),
                    }}
                  >
                    {position}
                  </button>
                ))}
              </div>
            </div>

            <div style={S.playerList}>
              {availablePlayers.length ===
              0 ? (
                <div style={S.empty}>
                  No available players match
                  these filters.
                </div>
              ) : (
                availablePlayers.map(
                  (player) => (
                    <div
                      key={player.id}
                      style={S.playerRow}
                    >
                      <div style={S.playerIdentity}>
                        <div style={S.headshotWrap}>
                          {player.headshot_url ? (
                            <img
                              src={player.headshot_url}
                              alt=""
                              style={S.headshot}
                            />
                          ) : (
                            <span style={S.initials}>
                              {initials(
                                player.display_name
                              )}
                            </span>
                          )}
                        </div>

                        <div style={S.playerText}>
                          <strong style={S.playerName}>
                            {player.display_name}
                          </strong>

                          <div style={S.playerMeta}>
                            <span style={S.position}>
                              {player.position ??
                                player.position_group ??
                                "—"}
                            </span>

                            {player.jersey_number && (
                              <span>
                                #{player.jersey_number}
                              </span>
                            )}

                            {player.injury_status && (
                              <span style={S.injury}>
                                {player.injury_status}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={!myTeam}
                        onClick={() =>
                          openClaim(player)
                        }
                        style={{
                          ...S.claimButton,
                          ...(!myTeam
                            ? S.disabledButton
                            : {}),
                        }}
                      >
                        CLAIM
                      </button>
                    </div>
                  )
                )
              )}
            </div>
          </section>
        )}

        {tab === "CLAIMS" && (
          <section style={S.panel}>
            <div style={S.panelHead}>
              <div>
                <strong>
                  MY WAIVER CLAIMS
                </strong>

                <div style={S.panelSub}>
                  Move pending claims up or
                  down to set your preferred
                  claim order.
                </div>
              </div>
            </div>

            {myClaims.length === 0 ? (
              <div style={S.empty}>
                You have not submitted any
                waiver claims.
              </div>
            ) : (
              <div style={S.claimList}>
                {myClaims.map((claim) => {
                  const player =
                    playerById.get(
                      claim.nhl_player_id
                    );

                  const dropPlayer =
                    claim.drop_nhl_player_id
                      ? playerById.get(
                          claim.drop_nhl_player_id
                        )
                      : null;

                  const pending =
                    claim.status === "pending";

                  const pendingIndex =
                    pendingClaims.findIndex(
                      (row) =>
                        row.id === claim.id
                    );

                  return (
                    <div
                      key={claim.id}
                      style={S.claimRow}
                    >
                      <div style={S.claimPriority}>
                        {pending
                          ? `#${claim.claim_priority}`
                          : "—"}
                      </div>

                      <div style={S.claimMain}>
                        <strong style={S.playerName}>
                          {player?.display_name ??
                            `Player ${claim.nhl_player_id}`}
                        </strong>

                        <div style={S.claimDetails}>
                          {dropPlayer && (
                            <span>
                              Drop:{" "}
                              {dropPlayer.display_name}
                            </span>
                          )}

                          {faabMode &&
                            claim.faab_bid != null && (
                              <span>
                                Bid: ${claim.faab_bid}
                              </span>
                            )}

                          <span>
                            Submitted{" "}
                            {formatDate(
                              claim.created_at
                            )}
                          </span>
                        </div>

                        {claim.failure_reason && (
                          <div style={S.failure}>
                            {claim.failure_reason}
                          </div>
                        )}
                      </div>

                      <div style={S.claimActions}>
                        <span
                          style={{
                            ...S.status,
                            ...(claim.status === "won"
                              ? S.statusWon
                              : claim.status === "pending"
                                ? S.statusPending
                                : claim.status === "failed"
                                  ? S.statusFailed
                                  : S.statusLost),
                          }}
                        >
                          {claim.status.toUpperCase()}
                        </span>

                        {pending && (
                          <>
                            <div style={S.moveButtons}>
                              <button
                                type="button"
                                disabled={
                                  pendingIndex <= 0 ||
                                  actionId === claim.id
                                }
                                onClick={() =>
                                  void moveClaim(
                                    claim.id,
                                    -1
                                  )
                                }
                                style={S.smallButton}
                              >
                                ↑
                              </button>

                              <button
                                type="button"
                                disabled={
                                  pendingIndex ===
                                    pendingClaims.length -
                                      1 ||
                                  actionId === claim.id
                                }
                                onClick={() =>
                                  void moveClaim(
                                    claim.id,
                                    1
                                  )
                                }
                                style={S.smallButton}
                              >
                                ↓
                              </button>
                            </div>

                            <button
                              type="button"
                              disabled={
                                actionId === claim.id
                              }
                              onClick={() =>
                                void cancelClaim(
                                  claim.id
                                )
                              }
                              style={S.cancelButton}
                            >
                              CANCEL
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {tab === "ORDER" && (
          <section style={S.panel}>
            <div style={S.panelHead}>
              <div>
                <strong>
                  {faabMode
                    ? "FAAB STATUS"
                    : "WAIVER PRIORITY"}
                </strong>

                <div style={S.panelSub}>
                  {faabMode
                    ? "Current league FAAB balances and tiebreak priority."
                    : "A successful rolling waiver claim moves that team to the bottom."}
                </div>
              </div>
            </div>

            <div style={S.orderList}>
              {waiverState.map((state) => {
                const team =
                  teamById.get(
                    state.fantasy_team_id
                  );

                const mine =
                  myTeam?.id ===
                  state.fantasy_team_id;

                return (
                  <div
                    key={state.fantasy_team_id}
                    style={{
                      ...S.orderRow,
                      ...(mine
                        ? S.myOrderRow
                        : {}),
                    }}
                  >
                    <div style={S.orderNumber}>
                      #{state.waiver_priority}
                    </div>

                    <div style={S.orderTeam}>
                      <strong>
                        {team?.team_name ??
                          `Team ${state.fantasy_team_id}`}
                      </strong>

                      <div style={S.orderMeta}>
                        {mine && "YOUR TEAM"}

                        {team?.is_cpu &&
                          `${mine ? " • " : ""}CPU`}
                      </div>
                    </div>

                    {faabMode && (
                      <div style={S.faabBalance}>
                        <span>
                          REMAINING
                        </span>

                        <strong>
                          $
                          {Math.max(
                            0,
                            faabBudget -
                              state.faab_spent
                          ).toFixed(0)}
                        </strong>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {tab === "HISTORY" && (
          <section style={S.panel}>
            <div style={S.panelHead}>
              <div>
                <strong>
                  WAIVER HISTORY
                </strong>

                <div style={S.panelSub}>
                  Completed waiver adds and
                  related drops.
                </div>
              </div>
            </div>

            {transactions.length === 0 ? (
              <div style={S.empty}>
                No waiver transactions yet.
              </div>
            ) : (
              <div style={S.transactionList}>
                {transactions.map(
                  (transaction) => {
                    const team =
                      teamById.get(
                        transaction.fantasy_team_id
                      );

                    const player =
                      playerById.get(
                        transaction.nhl_player_id
                      );

                    return (
                      <div
                        key={transaction.id}
                        style={S.transactionRow}
                      >
                        <div>
                          <strong>
                            {team?.team_name ??
                              "Unknown Team"}
                          </strong>

                          <div style={S.transactionText}>
                            {transaction.transaction_type ===
                            "waiver_add"
                              ? "Added"
                              : "Dropped"}{" "}
                            <strong>
                              {player?.display_name ??
                                `Player ${transaction.nhl_player_id}`}
                            </strong>
                          </div>
                        </div>

                        <div style={S.transactionDate}>
                          {formatDate(
                            transaction.created_at
                          )}
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
            )}
          </section>
        )}
      </div>

      {claimModal && (
        <div
          style={S.modalBackdrop}
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setClaimModal(null);
            }
          }}
        >
          <div style={S.modal}>
            <div style={S.modalHead}>
              <div>
                <div style={S.eyebrow}>
                  WAIVER CLAIM
                </div>

                <h2 style={S.modalTitle}>
                  {claimModal.player.display_name}
                </h2>

                <div style={S.subtitle}>
                  {claimModal.player.position ??
                    claimModal.player.position_group ??
                    "—"}
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  setClaimModal(null)
                }
                style={S.close}
              >
                ×
              </button>
            </div>

            {faabMode && (
              <label style={S.field}>
                <span style={S.fieldLabel}>
                  FAAB BID
                </span>

                <input
                  type="number"
                  min="0"
                  max={faabRemaining}
                  step="1"
                  value={faabBid}
                  onChange={(event) =>
                    setFaabBid(
                      event.target.value
                    )
                  }
                  placeholder={`$0 - $${faabRemaining.toFixed(
                    0
                  )}`}
                  style={S.input}
                />

                <span style={S.help}>
                  Remaining budget: $
                  {faabRemaining.toFixed(0)}
                </span>
              </label>
            )}

            <label style={S.field}>
              <span style={S.fieldLabel}>
                DROP PLAYER
              </span>

              <select
                value={dropPlayerId ?? ""}
                onChange={(event) =>
                  setDropPlayerId(
                    event.target.value
                      ? Number(
                          event.target.value
                        )
                      : null
                  )
                }
                style={S.input}
              >
                <option value="">
                  No drop selected
                </option>

                {myRoster.map(
                  ({ roster, player }) => (
                    <option
                      key={roster.id}
                      value={player.id}
                    >
                      {player.display_name} —{" "}
                      {player.position ??
                        player.position_group ??
                        "—"}{" "}
                      ({title(
                        roster.roster_status
                      )})
                    </option>
                  )
                )}
              </select>

              <span style={S.help}>
                If your standard roster is
                full, you must select a
                player to drop.
              </span>
            </label>

            <div style={S.modalSummary}>
              <div>
                <span style={S.summaryLabel}>
                  CLAIM ORDER
                </span>

                <strong>
                  #{pendingClaims.length + 1}
                </strong>
              </div>

              {!faabMode && (
                <div>
                  <span style={S.summaryLabel}>
                    WAIVER PRIORITY
                  </span>

                  <strong>
                    {myWaiverState
                      ? `#${myWaiverState.waiver_priority}`
                      : "—"}
                  </strong>
                </div>
              )}
            </div>

            <div style={S.modalActions}>
              <button
                type="button"
                onClick={() =>
                  setClaimModal(null)
                }
                style={S.secondaryButton}
              >
                CANCEL
              </button>

              <button
                type="button"
                disabled={submitting}
                onClick={() =>
                  void submitClaim()
                }
                style={{
                  ...S.primaryButton,
                  ...(submitting
                    ? S.disabledButton
                    : {}),
                }}
              >
                {submitting
                  ? "SUBMITTING..."
                  : "SUBMIT CLAIM"}
              </button>
            </div>
          </div>
        </div>
      )}
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
    padding: 50,
    textAlign: "center",
    color: "#999ca2",
    fontWeight: 800,
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
    gap: 18,
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
    marginTop: 7,
    color: "#a0a0a5",
    fontSize: 11,
    fontWeight: 800,
  },

  heroStats: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },

  statBox: {
    minWidth: 95,
    padding: "9px 12px",
    border: "1px solid #493025",
    borderRadius: 7,
    background: "#17110e",
    display: "grid",
    gap: 3,
  },

  statLabel: {
    color: "#8e8e94",
    fontSize: 7,
    fontWeight: 1000,
    letterSpacing: 0.8,
  },

  statValue: {
    color: "#ff7b31",
    fontSize: 18,
    fontWeight: 1000,
  },

  back: {
    justifySelf: "start",
    color: "#ff7b31",
    textDecoration: "none",
    fontSize: 10,
    fontWeight: 1000,
  },

  tabs: {
    display: "flex",
    gap: 6,
    overflowX: "auto",
    paddingBottom: 2,
  },

  tab: {
    flex: "0 0 auto",
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "#303034",
    borderRadius: 6,
    background: "#121214",
    color: "#9a9aa0",
    padding: "9px 12px",
    fontSize: 9,
    fontWeight: 1000,
    cursor: "pointer",
  },

  activeTab: {
    background: "#26150d",
    borderColor: "#7c3c1d",
    color: "#ff7b31",
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
    fontSize: 10,
  },

  panelSub: {
    marginTop: 4,
    color: "#777a80",
    fontSize: 8,
    fontWeight: 700,
  },

  countBadge: {
    minWidth: 32,
    padding: "5px 8px",
    borderRadius: 999,
    background: "#26150d",
    border: "1px solid #66351f",
    color: "#ff7b31",
    textAlign: "center",
    fontSize: 9,
    fontWeight: 1000,
  },

  filters: {
    padding: 12,
    borderBottom: "1px solid #242428",
    display: "grid",
    gap: 9,
  },

  search: {
    width: "100%",
    boxSizing: "border-box",
    minHeight: 42,
    border: "1px solid #333338",
    borderRadius: 7,
    background: "#0d0d0f",
    color: "#fff",
    padding: "0 12px",
    outline: "none",
    fontSize: 13,
  },

  positionFilters: {
    display: "flex",
    gap: 5,
    overflowX: "auto",
  },

  filterButton: {
    flex: "0 0 auto",
    minWidth: 42,
    minHeight: 34,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "#303034",
    borderRadius: 5,
    background: "#151517",
    color: "#999ca2",
    fontSize: 9,
    fontWeight: 1000,
    cursor: "pointer",
  },

  filterActive: {
    background: "#ff5a1f",
    borderColor: "#ff5a1f",
    color: "#fff",
  },

  playerList: {
    display: "grid",
  },

  playerRow: {
    minHeight: 68,
    padding: "8px 12px",
    borderBottom: "1px solid #242428",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },

  playerIdentity: {
    minWidth: 0,
    display: "flex",
    alignItems: "center",
    gap: 10,
  },

  headshotWrap: {
    width: 44,
    height: 44,
    flex: "0 0 44px",
    borderRadius: "50%",
    overflow: "hidden",
    border: "1px solid #343438",
    background: "#1a1a1d",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  headshot: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },

  initials: {
    color: "#777a80",
    fontSize: 10,
    fontWeight: 1000,
  },

  playerText: {
    minWidth: 0,
  },

  playerName: {
    color: "#f4f4f5",
    fontSize: 12,
    fontWeight: 1000,
  },

  playerMeta: {
    marginTop: 4,
    display: "flex",
    gap: 7,
    flexWrap: "wrap",
    color: "#777a80",
    fontSize: 8,
    fontWeight: 800,
  },

  position: {
    color: "#ff7b31",
  },

  injury: {
    color: "#e78378",
  },

  claimButton: {
    flex: "0 0 auto",
    minHeight: 38,
    padding: "0 14px",
    borderWidth: 0,
    borderStyle: "solid",
    borderColor: "transparent",
    borderRadius: 6,
    background:
      "linear-gradient(135deg, #ff3d18, #ff7628)",
    color: "#fff",
    fontSize: 9,
    fontWeight: 1000,
    cursor: "pointer",
  },

  disabledButton: {
    opacity: 0.45,
    cursor: "not-allowed",
  },

  empty: {
    padding: 30,
    textAlign: "center",
    color: "#777a80",
    fontSize: 11,
    fontWeight: 700,
  },

  claimList: {
    display: "grid",
  },

  claimRow: {
    padding: 12,
    borderBottom: "1px solid #242428",
    display: "grid",
    gridTemplateColumns: "44px minmax(0, 1fr) auto",
    gap: 10,
    alignItems: "center",
  },

  claimPriority: {
    width: 34,
    height: 34,
    borderRadius: "50%",
    background: "#21140f",
    border: "1px solid #66351f",
    color: "#ff7b31",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 10,
    fontWeight: 1000,
  },

  claimMain: {
    minWidth: 0,
  },

  claimDetails: {
    marginTop: 5,
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    color: "#777a80",
    fontSize: 8,
    fontWeight: 700,
  },

  failure: {
    marginTop: 5,
    color: "#e78378",
    fontSize: 8,
    fontWeight: 800,
  },

  claimActions: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 6,
    flexWrap: "wrap",
  },

  moveButtons: {
    display: "flex",
    gap: 3,
  },

  smallButton: {
    width: 30,
    height: 30,
    border: "1px solid #38383d",
    borderRadius: 5,
    background: "#18181b",
    color: "#fff",
    fontWeight: 1000,
    cursor: "pointer",
  },

  cancelButton: {
    minHeight: 30,
    padding: "0 8px",
    border: "1px solid #57302c",
    borderRadius: 5,
    background: "#211413",
    color: "#e78378",
    fontSize: 7,
    fontWeight: 1000,
    cursor: "pointer",
  },

  status: {
    padding: "5px 8px",
    borderRadius: 999,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "#343438",
    fontSize: 7,
    fontWeight: 1000,
    letterSpacing: 0.4,
  },

  statusPending: {
    background: "#26150d",
    borderColor: "#6a351e",
    color: "#ff7b31",
  },

  statusWon: {
    background: "#102319",
    borderColor: "#245d39",
    color: "#67d68a",
  },

  statusLost: {
    background: "#171719",
    borderColor: "#343438",
    color: "#8d8d93",
  },

  statusFailed: {
    background: "#211313",
    borderColor: "#58302d",
    color: "#e78378",
  },

  orderList: {
    display: "grid",
  },

  orderRow: {
    minHeight: 60,
    padding: "8px 12px",
    borderBottom: "1px solid #242428",
    borderLeftWidth: 3,
    borderLeftStyle: "solid",
    borderLeftColor: "transparent",
    display: "grid",
    gridTemplateColumns: "50px minmax(0, 1fr) auto",
    gap: 10,
    alignItems: "center",
  },

  myOrderRow: {
    background: "#19120f",
    borderLeftColor: "#ff5a1f",
  },

  orderNumber: {
    color: "#ff7b31",
    fontSize: 17,
    fontWeight: 1000,
  },

  orderTeam: {
    fontSize: 11,
  },

  orderMeta: {
    minHeight: 10,
    marginTop: 3,
    color: "#ff7b31",
    fontSize: 7,
    fontWeight: 1000,
  },

  faabBalance: {
    display: "grid",
    justifyItems: "end",
    gap: 2,
    color: "#777a80",
    fontSize: 7,
    fontWeight: 1000,
  },

  transactionList: {
    display: "grid",
  },

  transactionRow: {
    padding: "11px 13px",
    borderBottom: "1px solid #242428",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    fontSize: 10,
  },

  transactionText: {
    marginTop: 4,
    color: "#9a9aa0",
    fontSize: 9,
  },

  transactionDate: {
    flex: "0 0 auto",
    color: "#777a80",
    fontSize: 8,
  },

  error: {
    padding: 14,
    border: "1px solid #742b25",
    borderRadius: 8,
    background: "#29110f",
    color: "#ffd1cc",
    display: "grid",
    gap: 7,
    fontSize: 10,
  },

  retry: {
    justifySelf: "start",
    border: 0,
    borderRadius: 5,
    padding: "7px 10px",
    background: "#ff4b20",
    color: "#fff",
    fontWeight: 1000,
    cursor: "pointer",
  },

  success: {
    padding: "11px 13px",
    border: "1px solid #245d39",
    borderRadius: 7,
    background: "#102319",
    color: "#67d68a",
    fontSize: 10,
    fontWeight: 900,
  },

  warning: {
    padding: "11px 13px",
    border: "1px solid #65421f",
    borderRadius: 7,
    background: "#24180d",
    color: "#ffb66d",
    fontSize: 10,
    fontWeight: 800,
  },

  modalBackdrop: {
    position: "fixed",
    inset: 0,
    zIndex: 1000,
    background: "rgba(0,0,0,.78)",
    padding: 12,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  modal: {
    width: "min(560px, 100%)",
    maxHeight: "90vh",
    overflowY: "auto",
    border: "1px solid #38383d",
    borderRadius: 10,
    background: "#111113",
    boxShadow:
      "0 24px 70px rgba(0,0,0,.55)",
  },

  modalHead: {
    padding: "16px 18px",
    borderBottom: "1px solid #29292d",
    background:
      "linear-gradient(135deg, #171719, #21110b)",
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
  },

  modalTitle: {
    margin: "4px 0 0",
    fontSize: 23,
    fontWeight: 1000,
  },

  close: {
    width: 36,
    height: 36,
    border: "1px solid #3b3b40",
    borderRadius: 6,
    background: "#171719",
    color: "#fff",
    fontSize: 22,
    cursor: "pointer",
  },

  field: {
    padding: "14px 18px 0",
    display: "grid",
    gap: 6,
  },

  fieldLabel: {
    color: "#ff7b31",
    fontSize: 8,
    fontWeight: 1000,
    letterSpacing: 0.7,
  },

  input: {
    width: "100%",
    boxSizing: "border-box",
    minHeight: 42,
    border: "1px solid #343438",
    borderRadius: 6,
    background: "#0d0d0f",
    color: "#fff",
    padding: "0 10px",
    fontSize: 11,
  },

  help: {
    color: "#777a80",
    fontSize: 8,
    lineHeight: 1.4,
  },

  modalSummary: {
    margin: "15px 18px 0",
    padding: 12,
    border: "1px solid #2e2e32",
    borderRadius: 7,
    background: "#0d0d0f",
    display: "flex",
    gap: 24,
    flexWrap: "wrap",
  },

  summaryLabel: {
    display: "block",
    marginBottom: 4,
    color: "#777a80",
    fontSize: 7,
    fontWeight: 1000,
  },

  modalActions: {
    padding: 18,
    display: "flex",
    justifyContent: "flex-end",
    gap: 8,
  },

  secondaryButton: {
    minHeight: 40,
    padding: "0 14px",
    border: "1px solid #38383d",
    borderRadius: 6,
    background: "#18181b",
    color: "#aaaab0",
    fontSize: 9,
    fontWeight: 1000,
    cursor: "pointer",
  },

  primaryButton: {
    minHeight: 40,
    padding: "0 16px",
    border: 0,
    borderRadius: 6,
    background:
      "linear-gradient(135deg, #ff3d18, #ff7628)",
    color: "#fff",
    fontSize: 9,
    fontWeight: 1000,
    cursor: "pointer",
  },
};