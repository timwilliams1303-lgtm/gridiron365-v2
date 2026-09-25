"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";

import NhlInjuryBadge from "@/components/nhl-traditional/NhlInjuryBadge";

type Props = {
  leagueId: string;
  fantasyTeamId: number;
  sourceSeason: number;
  targetSeason: number;
};

type KeeperState = {
  success: boolean;
  leagueId: string;
  fantasyTeamId: number;
  sourceSeason: number;
  targetSeason: number;
  keeperLimit: number;
  selectedCount: number;
  remainingSelections: number;
  submitted: boolean;
  submittedAt: string | null;
  locked: boolean;
  editable: boolean;
  protectionStatus: string;
  protectionDeadline: string | null;
  keepers: unknown[];
};

type RosterRow = {
  nhl_player_id: number;
  roster_status: string | null;
};

type PlayerRow = {
  id: number;
  display_name: string;
  first_name: string | null;
  last_name: string | null;
  position: string | null;
  position_group: string | null;
  team_id: number | null;
  jersey_number: number | null;
  injury_status: string | null;
  injury_detail: string | null;
  injury_return_date: string | null;
  injury_source: string | null;
  headshot_url: string | null;
};

type NhlTeamRow = {
  id: number;
  abbreviation: string | null;
  short_name: string | null;
  name: string | null;
  display_name: string | null;
};

type KeeperProgressTeam = {
  fantasyTeamId: number;
  teamName: string;
  ownerId: string | null;
  isCpu: boolean;
  selectedCount: number;
  keeperLimit: number;
  submitted: boolean;
  submittedAt: string | null;
  lockedCount: number;
  carriedOverCount: number;
  complete: boolean;
  finalized: boolean;
};

type KeeperProgress = {
  activeTeams: number;
  submittedTeams: number;
  remainingTeams: number;
  allSubmitted: boolean;
  finalized: boolean;
  teams: KeeperProgressTeam[];
};

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function normalize(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function playerName(player: PlayerRow) {
  return (
    player.display_name?.trim() ||
    `${player.first_name ?? ""} ${player.last_name ?? ""}`.trim() ||
    `Player ${player.id}`
  );
}

function playerPosition(player: PlayerRow) {
  return String(
    player.position ??
      player.position_group ??
      "—"
  ).toUpperCase();
}

function getKeeperPlayerId(row: unknown): number | null {
  if (typeof row === "number" && Number.isFinite(row)) {
    return row;
  }

  if (!row || typeof row !== "object") {
    return null;
  }

  const value = row as Record<string, unknown>;

  const candidates = [
    value.nhlPlayerId,
    value.nhl_player_id,
    value.playerId,
    value.player_id,
    value.id,
  ];

  for (const candidate of candidates) {
    const id = Number(candidate);

    if (Number.isFinite(id) && id > 0) {
      return id;
    }
  }

  return null;
}

function keeperStateFromRpc(value: unknown): KeeperState {
  const row =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};

  const keeperLimit = Number(
    row.keeperLimit ??
      row.keeper_limit ??
      0
  );

  const selectedCount = Number(
    row.selectedCount ??
      row.selected_count ??
      0
  );

  const remainingSelections = Number(
    row.remainingSelections ??
      row.remaining_selections ??
      Math.max(
        0,
        keeperLimit - selectedCount
      )
  );

  const keepers = Array.isArray(row.keepers)
    ? row.keepers
    : [];

  return {
    success:
      row.success === undefined
        ? true
        : Boolean(row.success),

    leagueId: String(
      row.leagueId ??
        row.league_id ??
        ""
    ),

    fantasyTeamId: Number(
      row.fantasyTeamId ??
        row.fantasy_team_id ??
        0
    ),

    sourceSeason: Number(
      row.sourceSeason ??
        row.source_season ??
        0
    ),

    targetSeason: Number(
      row.targetSeason ??
        row.target_season ??
        0
    ),

    keeperLimit:
      Number.isFinite(keeperLimit)
        ? keeperLimit
        : 0,

    selectedCount:
      Number.isFinite(selectedCount)
        ? selectedCount
        : 0,

    remainingSelections:
      Number.isFinite(remainingSelections)
        ? remainingSelections
        : 0,

    submitted: Boolean(row.submitted),

    submittedAt: (row.submittedAt ?? row.submitted_at ?? null) as string | null,

    locked: Boolean(row.locked),

    editable: Boolean(row.editable),

    protectionStatus: String(
      row.protectionStatus ?? row.protection_status ?? "protection_closed"
    ),

    protectionDeadline: (
      row.protectionDeadline ?? row.protection_deadline ?? null
    ) as string | null,

    keepers,
  };
}

export default function NhlDynastyKeepers({
  leagueId,
  fantasyTeamId,
  sourceSeason,
  targetSeason,
}: Props) {
  const [loading, setLoading] =
    useState(true);

  const [teamLoading, setTeamLoading] =
    useState(false);

  const hasLoadedOnceRef =
    useRef(false);

  const [workingPlayerId, setWorkingPlayerId] =
    useState<number | null>(null);

  const [submitting, setSubmitting] =
    useState(false);

  const [error, setError] =
    useState("");

  const [message, setMessage] =
    useState("");

  const [keeperState, setKeeperState] =
    useState<KeeperState | null>(null);

  const [roster, setRoster] =
    useState<RosterRow[]>([]);

  const [players, setPlayers] =
    useState<PlayerRow[]>([]);

  const [nhlTeams, setNhlTeams] =
    useState<NhlTeamRow[]>([]);

  const [isCommissioner, setIsCommissioner] =
    useState(false);

  const [selectedTeamId, setSelectedTeamId] =
    useState(fantasyTeamId);

  const [progress, setProgress] =
    useState<KeeperProgress | null>(null);

  const [finalizing, setFinalizing] =
    useState(false);

  const activeFantasyTeamId =
    isCommissioner ? selectedTeamId : fantasyTeamId;

  const load = useCallback(async () => {
    if (hasLoadedOnceRef.current) {
      setTeamLoading(true);
    } else {
      setLoading(true);
    }

    setError("");

    try {
      const {
        data: authData,
        error: authError,
      } =
        await supabase.auth.getUser();

      if (authError) {
        throw authError;
      }

      if (!authData.user) {
        throw new Error(
          "You must be signed in to manage Dynasty keepers."
        );
      }

      const { data: membershipData, error: membershipError } =
        await supabase
          .from("league_members")
          .select("role")
          .eq("league_id", leagueId)
          .eq("user_id", authData.user.id)
          .maybeSingle();

      if (membershipError) {
        throw membershipError;
      }

      const commissioner =
        normalize(membershipData?.role) === "commissioner";

      setIsCommissioner(commissioner);

      let nextProgress: KeeperProgress | null = null;

      if (commissioner) {
        const { data: progressData, error: progressError } =
          await supabase.rpc(
            "get_nhl_dynasty_keeper_submission_progress",
            {
              p_league_id: leagueId,
              p_target_season: targetSeason,
            }
          );

        if (progressError) {
          throw progressError;
        }

        const raw =
          progressData && typeof progressData === "object"
            ? (progressData as Record<string, unknown>)
            : {};

        const rawTeams = Array.isArray(raw.teams) ? raw.teams : [];

        const teams: KeeperProgressTeam[] = rawTeams.map((item) => {
          const row =
            item && typeof item === "object"
              ? (item as Record<string, unknown>)
              : {};

          return {
            fantasyTeamId: Number(row.fantasyTeamId ?? row.fantasy_team_id ?? 0),
            teamName: String(row.teamName ?? row.team_name ?? "Team"),
            ownerId: (row.ownerId ?? row.owner_id ?? null) as string | null,
            isCpu: Boolean(row.isCpu ?? row.is_cpu),
            selectedCount: Number(row.selectedCount ?? row.selected_count ?? 0),
            keeperLimit: Number(row.keeperLimit ?? row.keeper_limit ?? 0),
            submitted: Boolean(row.submitted),
            submittedAt: (row.submittedAt ?? row.submitted_at ?? null) as string | null,
            lockedCount: Number(row.lockedCount ?? row.locked_count ?? 0),
            carriedOverCount: Number(row.carriedOverCount ?? row.carried_over_count ?? 0),
            complete: Boolean(row.complete),
            finalized: Boolean(row.finalized),
          };
        }).filter((team) => team.fantasyTeamId > 0);

        nextProgress = {
          activeTeams: Number(raw.activeTeams ?? raw.active_teams ?? teams.length),
          submittedTeams: Number(raw.submittedTeams ?? raw.submitted_teams ?? 0),
          remainingTeams: Number(raw.remainingTeams ?? raw.remaining_teams ?? 0),
          allSubmitted: Boolean(raw.allSubmitted ?? raw.all_submitted),
          finalized: Boolean(raw.finalized),
          teams,
        };

        setProgress(nextProgress);

        if (
          !teams.some((team) => team.fantasyTeamId === selectedTeamId) &&
          teams.length > 0
        ) {
          setSelectedTeamId(teams[0].fantasyTeamId);
          return;
        }
      } else {
        setProgress(null);
      }

      /*
       * --------------------------------------------------------
       * Keeper state
       * --------------------------------------------------------
       */
      const {
        data: keeperData,
        error: keeperError,
      } =
        await supabase.rpc(
          "get_nhl_dynasty_keeper_state",
          {
            p_league_id: leagueId,
            p_fantasy_team_id:
              activeFantasyTeamId,
            p_target_season:
              targetSeason,
          }
        );

      if (keeperError) {
        throw keeperError;
      }

      const nextKeeperState =
        keeperStateFromRpc(
          keeperData
        );

      /*
       * --------------------------------------------------------
       * Source-season roster
       * --------------------------------------------------------
       */
      const {
        data: rosterData,
        error: rosterError,
      } =
        await supabase
          .from(
            "nhl_traditional_rosters"
          )
          .select(
            "nhl_player_id,roster_status"
          )
          .eq(
            "league_id",
            leagueId
          )
          .eq(
            "fantasy_team_id",
            activeFantasyTeamId
          )
          .eq(
            "season",
            sourceSeason
          )
          .is(
            "dropped_at",
            null
          );

      if (rosterError) {
        throw rosterError;
      }

      const rosterRows =
        (rosterData ??
          []) as unknown as RosterRow[];

      const playerIds = [
        ...new Set(
          rosterRows
            .map((row) =>
              Number(
                row.nhl_player_id
              )
            )
            .filter(
              (id) =>
                Number.isFinite(id) &&
                id > 0
            )
        ),
      ];

      let playerRows: PlayerRow[] =
        [];

      if (playerIds.length > 0) {
        const {
          data: playersData,
          error: playersError,
        } =
          await supabase
            .from("nhl_players")
            .select(
              [
                "id",
                "display_name",
                "first_name",
                "last_name",
                "position",
                "position_group",
                "team_id",
                "jersey_number",
                "injury_status",
                "injury_detail",
                "injury_return_date",
                "injury_source",
                "headshot_url",
              ].join(",")
            )
            .in(
              "id",
              playerIds
            );

        if (playersError) {
          throw playersError;
        }

        /*
         * Supabase's generated type inference can return
         * GenericStringError[] for dynamic select strings.
         * Cast through unknown intentionally.
         */
        playerRows =
          (playersData ??
            []) as unknown as PlayerRow[];
      }

      const {
        data: teamData,
        error: teamError,
      } =
        await supabase
          .from("nhl_teams")
          .select(
            "id,abbreviation,short_name,name,display_name"
          );

      if (teamError) {
        throw teamError;
      }

      setKeeperState(
        nextKeeperState
      );

      setRoster(
        rosterRows
      );

      setPlayers(
        playerRows
      );

      setNhlTeams(
        (teamData ??
          []) as unknown as NhlTeamRow[]
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to load Dynasty keepers."
      );
    } finally {
      setLoading(false);
      setTeamLoading(false);
      hasLoadedOnceRef.current = true;
    }
  }, [
    activeFantasyTeamId,
    fantasyTeamId,
    leagueId,
    selectedTeamId,
    sourceSeason,
    targetSeason,
  ]);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedPlayerIds =
    useMemo(() => {
      const ids =
        keeperState?.keepers
          .map(
            getKeeperPlayerId
          )
          .filter(
            (
              value
            ): value is number =>
              value !== null
          ) ?? [];

      return new Set(ids);
    }, [keeperState]);

  const nhlTeamMap =
    useMemo(
      () =>
        new Map(
          nhlTeams.map(
            (team) => [
              team.id,
              team,
            ]
          )
        ),
      [nhlTeams]
    );

  const rosterStatusMap =
    useMemo(
      () =>
        new Map(
          roster.map(
            (row) => [
              row.nhl_player_id,
              row.roster_status,
            ]
          )
        ),
      [roster]
    );

  const sortedPlayers =
    useMemo(() => {
      const positionOrder =
        new Map([
          ["C", 1],
          ["LW", 2],
          ["RW", 3],
          ["F", 4],
          ["D", 5],
          ["G", 6],
        ]);

      return [...players].sort(
        (a, b) => {
          const aSelected =
            selectedPlayerIds.has(
              a.id
            );

          const bSelected =
            selectedPlayerIds.has(
              b.id
            );

          if (
            aSelected !==
            bSelected
          ) {
            return aSelected
              ? -1
              : 1;
          }

          const aPosition =
            playerPosition(a);

          const bPosition =
            playerPosition(b);

          const positionDiff =
            (positionOrder.get(
              aPosition
            ) ?? 99) -
            (positionOrder.get(
              bPosition
            ) ?? 99);

          if (positionDiff !== 0) {
            return positionDiff;
          }

          return playerName(
            a
          ).localeCompare(
            playerName(b)
          );
        }
      );
    }, [
      players,
      selectedPlayerIds,
    ]);

  const keeperLimit =
    keeperState?.keeperLimit ??
    0;

  const selectedCount =
    keeperState?.selectedCount ??
    0;

  const remaining =
    keeperState?.remainingSelections ??
    Math.max(
      0,
      keeperLimit -
        selectedCount
    );

  const locked = keeperState?.locked ?? false;
  const submitted = keeperState?.submitted ?? false;
  const editable = keeperState?.editable ?? false;

  const canSubmit =
    editable &&
    !locked &&
    keeperLimit > 0 &&
    selectedCount === keeperLimit &&
    !submitting &&
    workingPlayerId === null;

  async function toggleKeeper(player: PlayerRow) {
    if (!keeperState || !editable || locked || submitting || workingPlayerId !== null) {
      return;
    }

    const selected = selectedPlayerIds.has(player.id);

    if (!selected && selectedCount >= keeperLimit) {
      setError(`You already selected all ${keeperLimit} keepers. Uncheck one before selecting another.`);
      return;
    }

    setWorkingPlayerId(player.id);
    setError("");
    setMessage("");

    try {
      const { error: rpcError } = isCommissioner
        ? await supabase.rpc(
            "commissioner_manage_nhl_dynasty_keeper",
            {
              p_league_id: leagueId,
              p_fantasy_team_id: activeFantasyTeamId,
              p_nhl_player_id: player.id,
              p_target_season: targetSeason,
              p_action: selected ? "unselect" : "select",
            }
          )
        : await supabase.rpc(
            selected
              ? "unselect_nhl_dynasty_keeper"
              : "select_nhl_dynasty_keeper",
            {
              p_league_id: leagueId,
              p_fantasy_team_id: fantasyTeamId,
              p_nhl_player_id: player.id,
              p_target_season: targetSeason,
            }
          );

      if (rpcError) throw rpcError;

      setMessage(
        selected
          ? `${playerName(player)} removed. Submit your keeper list again when finished.`
          : `${playerName(player)} selected. Submit your keeper list when finished.`
      );
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update keeper selection.");
    } finally {
      setWorkingPlayerId(null);
    }
  }

  async function submitKeepers() {
    if (!canSubmit) return;

    setSubmitting(true);
    setError("");
    setMessage("");

    try {
      const { error: rpcError } = await supabase.rpc(
        isCommissioner
          ? "commissioner_submit_nhl_dynasty_keeper_list"
          : "submit_nhl_dynasty_keeper_list",
        {
          p_league_id: leagueId,
          p_fantasy_team_id: activeFantasyTeamId,
          p_target_season: targetSeason,
        }
      );

      if (rpcError) throw rpcError;

      const selectedTeam =
        progress?.teams.find(
          (team) => team.fantasyTeamId === activeFantasyTeamId
        );

      setMessage(
        isCommissioner
          ? `${selectedTeam?.teamName ?? "Team"} keeper list was submitted for ${targetSeason}.`
          : `Your ${targetSeason} keeper list was submitted. You can still change it and resubmit until the commissioner finalizes all teams.`
      );
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to submit keeper list.");
    } finally {
      setSubmitting(false);
    }
  }

  async function finalizeAllKeepers() {
    if (
      !isCommissioner ||
      !progress?.allSubmitted ||
      progress.finalized ||
      finalizing
    ) {
      return;
    }

    const confirmed = window.confirm(
      `Finalize all ${targetSeason} Dynasty keepers? This locks every team's keeper list and carries the protected players into ${targetSeason}.`
    );

    if (!confirmed) return;

    setFinalizing(true);
    setError("");
    setMessage("");

    try {
      const { error: finalizeError } = await supabase.rpc(
        "commissioner_lock_and_finalize_nhl_dynasty_keepers",
        {
          p_league_id: leagueId,
          p_target_season: targetSeason,
        }
      );

      if (finalizeError) throw finalizeError;

      setMessage(
        `All ${targetSeason} Dynasty keeper lists were finalized successfully.`
      );

      await load();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to finalize Dynasty keepers."
      );
    } finally {
      setFinalizing(false);
    }
  }

  if (loading) {
    return (
      <main className="keeper-page">
        <style>{styles}</style>

        <section className="keeper-shell">
          <div className="panel loading">
            Loading Dynasty keepers…
          </div>
        </section>
      </main>
    );
  }

  if (!keeperState) {
    return (
      <main className="keeper-page">
        <style>{styles}</style>

        <section className="keeper-shell">
          <div className="panel">
            <h1>
              Dynasty Keepers
            </h1>

            <p className="muted">
              Keeper information could
              not be loaded.
            </p>

            {error ? (
              <div className="error-box">
                {error}
              </div>
            ) : null}

            <button
              type="button"
              className="secondary-button"
              onClick={() =>
                void load()
              }
            >
              Try Again
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="keeper-page">
      <style>{styles}</style>

      <section className="keeper-shell">
        <header className="keeper-header">
          <div>
            <p className="eyebrow">
              G365 NHL DYNASTY
            </p>

            <h1>
              Dynasty Keepers
            </h1>

            <p className="subtitle">
              {isCommissioner
                ? `Review and manage every team's ${sourceSeason} keepers for the ${targetSeason} season.`
                : <>Protect your players from the {sourceSeason} roster for the {targetSeason} season.</>}
            </p>
          </div>

          <Link
            href={`/league/${leagueId}/nhl/offseason`}
            className="back-button"
          >
            ← Offseason
          </Link>
        </header>

        {error ? (
          <div className="error-box">
            {error}
          </div>
        ) : null}

        {message ? (
          <div className="success-box">
            {message}
          </div>
        ) : null}

        {isCommissioner && progress ? (
          <section className="panel commissioner-panel">
            <div className="commissioner-copy">
              <p className="eyebrow">COMMISSIONER KEEPER CONTROL</p>
              <h2>Manage Team Keepers</h2>
              <p>
                Choose any active team, set its keeper list, and submit it.
                Finalize all keepers after every team is submitted.
              </p>
            </div>

            <label className="team-select-wrap">
              <span>TEAM</span>
              <select
                value={activeFantasyTeamId}
                disabled={finalizing || progress.finalized || teamLoading}
                onChange={(event) => {
                  setError("");
                  setMessage("");
                  setSelectedTeamId(Number(event.target.value));
                }}
              >
                {progress.teams.map((team) => (
                  <option
                    key={team.fantasyTeamId}
                    value={team.fantasyTeamId}
                  >
                    {team.teamName}
                    {team.isCpu ? " • CPU" : ""}
                    {team.submitted ? " • Submitted" : ""}
                  </option>
                ))}
              </select>
            </label>

            <div className="commissioner-progress">
              <strong>
                {teamLoading
                  ? "…"
                  : `${progress.submittedTeams}/${progress.activeTeams}`}
              </strong>
              <span>
                {teamLoading ? "LOADING TEAM…" : "TEAMS SUBMITTED"}
              </span>
            </div>

            <button
              type="button"
              className="finalize-button"
              disabled={
                !progress.allSubmitted ||
                progress.finalized ||
                finalizing
              }
              onClick={() => void finalizeAllKeepers()}
            >
              {progress.finalized
                ? "Keepers Finalized"
                : finalizing
                  ? "Finalizing…"
                  : "Finalize Keepers"}
            </button>
          </section>
        ) : null}

        <section className="summary-grid">
          <div className="panel stat-card">
            <span>
              KEEPERS
            </span>

            <strong>
              {selectedCount}
              <small>
                /{keeperLimit}
              </small>
            </strong>

            <p>
              Selected
            </p>
          </div>

          <div className="panel stat-card">
            <span>
              REMAINING
            </span>

            <strong>
              {remaining}
            </strong>

            <p>
              Selections
            </p>
          </div>

          <div className="panel stat-card">
            <span>
              TARGET
            </span>

            <strong>
              {targetSeason}
            </strong>

            <p>
              NHL Season
            </p>
          </div>

          <div
            className={`panel stat-card ${
              locked
                ? "locked"
                : ""
            }`}
          >
            <span>
              STATUS
            </span>

            <strong className="status-text">
              {locked
                ? "FINAL"
                : submitted
                  ? "SUBMITTED"
                  : editable
                    ? "OPEN"
                    : "CLOSED"}
            </strong>

            <p>
              Keeper list
            </p>
          </div>
        </section>

        <section className="panel keeper-hero">
          <div>
            <p className="eyebrow">
              KEEPER SELECTION
            </p>

            <h2>
              {locked
                ? isCommissioner
                  ? "This keeper list is final"
                  : "Your keeper list is final"
                : submitted
                  ? "Keeper list submitted"
                  : `Choose exactly ${keeperLimit} keepers`}
            </h2>

            <p>
              {locked
                ? `These ${keeperLimit} players are finalized for ${targetSeason}.`
                : submitted
                  ? "Your list is submitted, but you can still change checkboxes and resubmit until the commissioner finalizes all teams."
                  : `Check exactly ${keeperLimit} players from your ${sourceSeason} roster, then submit the list.`}
            </p>
          </div>

          <div
            className={`progress ${
              selectedCount ===
              keeperLimit
                ? "complete"
                : ""
            }`}
          >
            <strong>
              {selectedCount}
            </strong>

            <span>
              of {keeperLimit}
            </span>
          </div>
        </section>

        <section
          className={`players-section ${teamLoading ? "team-loading" : ""}`}
          aria-busy={teamLoading}
        >
          <div className="section-heading">
            <div>
              <p className="eyebrow">{sourceSeason} ROSTER</p>
              <h2>Your Team</h2>
            </div>
            <span>{players.length} players</span>
          </div>

          {players.length === 0 ? (
            <div className="panel empty">No active source-season roster players were found.</div>
          ) : (
            <div className="roster-list">
              {sortedPlayers.map((player) => {
                const selected = selectedPlayerIds.has(player.id);
                const busy = workingPlayerId === player.id;
                const team = player.team_id ? nhlTeamMap.get(player.team_id) : null;
                const teamLabel = team?.abbreviation ?? team?.short_name ?? team?.name ?? team?.display_name ?? "FA";
                const rosterStatus = normalize(rosterStatusMap.get(player.id));
                const disabled = !editable || locked || submitting || workingPlayerId !== null || (!selected && selectedCount >= keeperLimit);

                return (
                  <label key={player.id} className={`roster-row ${selected ? "selected" : ""} ${disabled && !selected ? "disabled" : ""}`}>
                    <div className="check-wrap">
                      <input
                        type="checkbox"
                        checked={selected}
                        disabled={disabled}
                        onChange={() => void toggleKeeper(player)}
                        aria-label={`${selected ? "Remove" : "Select"} ${playerName(player)} as keeper`}
                      />
                    </div>

                    <div className="row-photo-wrap">
                      {player.headshot_url ? (
                        <img src={player.headshot_url} alt="" className="row-photo" />
                      ) : (
                        <div className="row-photo fallback">{playerName(player).slice(0, 1).toUpperCase()}</div>
                      )}
                    </div>

                    <div className="row-player-main">
                      <div className="player-name-line">
                        <strong>{playerName(player)}</strong>
                        <NhlInjuryBadge
                          status={player.injury_status}
                          detail={player.injury_detail}
                          returnDate={player.injury_return_date}
                          source={player.injury_source}
                        />
                      </div>
                      <span>
                        {teamLabel}{player.jersey_number != null ? ` • #${player.jersey_number}` : ""}
                        {rosterStatus ? ` • ${rosterStatus.toUpperCase()}` : ""}
                      </span>
                    </div>

                    <div className="row-position">{playerPosition(player)}</div>
                    <div className={`row-keeper-state ${selected ? "on" : ""}`}>
                      {busy ? "WORKING…" : selected ? "KEEP" : "—"}
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </section>

        <section className={`panel lock-panel ${locked ? "complete" : submitted ? "submitted" : ""}`}>
          <div>
            <p className="eyebrow">SUBMIT KEEPER LIST</p>
            <h2>
              {locked
                ? "Keeper list finalized"
                : submitted
                  ? "List submitted"
                  : selectedCount === keeperLimit
                    ? "Ready to submit"
                    : `${remaining} selection${remaining === 1 ? "" : "s"} remaining`}
            </h2>
            <p>
              {locked
                ? `The commissioner finalized your ${keeperLimit} keepers for ${targetSeason}. No more changes can be made.`
                : submitted
                  ? "You may still change any checkbox while protection is open. Any change returns this list to Not Submitted until you submit it again."
                  : selectedCount === keeperLimit
                    ? "Review the checked players and submit your list. Submission does not lock it; the commissioner finalizes all teams together."
                    : `Select exactly ${keeperLimit} players before submitting your keeper list.`}
            </p>
            {keeperState.submittedAt && submitted && !locked ? (
              <p className="submitted-time">Submitted {new Date(keeperState.submittedAt).toLocaleString()}</p>
            ) : null}
          </div>

          <button type="button" className="lock-button" disabled={!canSubmit} onClick={() => void submitKeepers()}>
            {locked
              ? "Finalized"
              : submitting
                ? "Submitting…"
                : submitted
                  ? "Resubmit Keeper List"
                  : "Submit Keeper List"}
          </button>
        </section>
      </section>
    </main>
  );
}

const styles = `
  * {
    box-sizing: border-box;
  }

  .keeper-page {
    min-height: 100vh;
    padding: 30px 18px 64px;
    color: #fff;
    background:
      radial-gradient(
        circle at 12% 0%,
        rgba(255, 91, 20, .12),
        transparent 30rem
      ),
      radial-gradient(
        circle at 90% 18%,
        rgba(190, 25, 20, .10),
        transparent 26rem
      ),
      #08090b;
  }

  .keeper-shell {
    width: min(1240px, 100%);
    margin: 0 auto;
    display: grid;
    gap: 18px;
  }

  .keeper-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
    padding: 22px;
    border: 1px solid rgba(255, 105, 25, .28);
    border-radius: 16px;
    background:
      linear-gradient(
        135deg,
        rgba(125, 17, 17, .28),
        rgba(255, 82, 15, .07),
        rgba(10, 11, 14, .96)
      );
  }

  .eyebrow {
    margin: 0 0 7px;
    color: #ff7625;
    font-size: 9px;
    font-weight: 950;
    letter-spacing: .15em;
  }

  .keeper-header h1 {
    margin: 0;
    font-size: clamp(30px, 5vw, 44px);
    line-height: 1;
    letter-spacing: -.035em;
  }

  .subtitle {
    margin: 9px 0 0;
    color: #969ca6;
    font-size: 12px;
    line-height: 1.5;
  }

  .back-button {
    min-height: 40px;
    padding: 0 14px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    border: 1px solid rgba(255, 116, 38, .35);
    border-radius: 9px;
    color: #ff8b43;
    background: rgba(255, 100, 20, .06);
    font-size: 10px;
    font-weight: 900;
    text-decoration: none;
  }

  .panel {
    border: 1px solid rgba(255, 116, 38, .20);
    border-radius: 15px;
    background:
      linear-gradient(
        145deg,
        rgba(27, 28, 32, .97),
        rgba(12, 13, 16, .98)
      );
    box-shadow:
      0 15px 40px rgba(0, 0, 0, .25);
  }

  .summary-grid {
    display: grid;
    grid-template-columns:
      repeat(4, minmax(0, 1fr));
    gap: 10px;
  }

  .stat-card {
    min-height: 105px;
    padding: 15px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
  }

  .stat-card > span {
    color: #818791;
    font-size: 8px;
    font-weight: 900;
    letter-spacing: .1em;
  }

  .stat-card strong {
    margin-top: 7px;
    font-size: 24px;
    line-height: 1;
  }

  .stat-card strong small {
    color: #777d87;
    font-size: 13px;
  }

  .stat-card p {
    margin: 7px 0 0;
    color: #777e88;
    font-size: 9px;
  }

  .status-text {
    color: #ff8a3d;
    font-size: 17px !important;
  }

  .stat-card.locked .status-text {
    color: #5fdb7a;
  }

  .keeper-hero {
    padding: 20px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 22px;
    border-color:
      rgba(255, 108, 25, .36);
    background:
      radial-gradient(
        circle at 90% 20%,
        rgba(255, 93, 20, .11),
        transparent 22rem
      ),
      linear-gradient(
        135deg,
        rgba(85, 17, 14, .62),
        rgba(18, 17, 18, .98) 58%
      );
  }

  .keeper-hero h2,
  .lock-panel h2 {
    margin: 0;
    font-size: 21px;
  }

  .keeper-hero p:not(.eyebrow),
  .lock-panel p:not(.eyebrow) {
    max-width: 720px;
    margin: 7px 0 0;
    color: #9da2ab;
    font-size: 12px;
    line-height: 1.5;
  }

  .progress {
    width: 88px;
    height: 88px;
    flex: 0 0 88px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    border: 2px solid #454950;
    border-radius: 50%;
    background: #0b0c0f;
  }

  .progress.complete {
    border-color: #ff7625;
    box-shadow:
      0 0 24px rgba(255, 98, 25, .14);
  }

  .progress strong {
    font-size: 25px;
    line-height: 1;
  }

  .progress span {
    margin-top: 4px;
    color: #8e949e;
    font-size: 9px;
  }

  .players-section {
    display: grid;
    gap: 12px;
  }

  .players-section.team-loading {
    opacity: .58;
    pointer-events: none;
    transition: opacity .12s ease;
  }

  .section-heading {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 15px;
  }

  .section-heading h2 {
    margin: 0;
    font-size: 22px;
  }

  .section-heading > span {
    color: #7f858f;
    font-size: 10px;
  }

  .player-grid {
    display: grid;
    grid-template-columns:
      repeat(3, minmax(0, 1fr));
    gap: 10px;
  }

  .player-card {
    min-width: 0;
    padding: 13px;
    border: 1px solid #2c2f34;
    border-radius: 13px;
    background:
      linear-gradient(
        145deg,
        #15171b,
        #0e0f12
      );
    transition:
      border-color .15s ease,
      transform .15s ease;
  }

  .player-card:hover {
    border-color:
      rgba(255, 112, 35, .48);
    transform: translateY(-1px);
  }

  .player-card.selected {
    border-color: #ff7625;
    background:
      linear-gradient(
        135deg,
        rgba(165, 31, 22, .25),
        rgba(255, 105, 25, .07),
        #101114
      );
  }

  .player-top {
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .player-photo-wrap {
    position: relative;
    flex: 0 0 auto;
  }

  .player-photo {
    width: 46px;
    height: 46px;
    display: block;
    border: 1px solid #373a40;
    border-radius: 50%;
    object-fit: cover;
    background: #090a0c;
  }

  .player-photo.fallback {
    display: grid;
    place-items: center;
    color: #ff934d;
    font-size: 16px;
    font-weight: 950;
  }

  .position-badge {
    position: absolute;
    right: -4px;
    bottom: -3px;
    min-width: 20px;
    height: 17px;
    padding: 0 4px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid #ff7625;
    border-radius: 999px;
    color: #fff;
    background: #a8261c;
    font-size: 7px;
    font-weight: 950;
  }

  .player-info {
    min-width: 0;
    flex: 1;
  }

  .player-name-line {
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .player-name-line h3 {
    min-width: 0;
    margin: 0;
    overflow: hidden;
    color: #fff;
    font-size: 13px;
    font-weight: 900;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .player-info p {
    margin: 5px 0 0;
    color: #8d939d;
    font-size: 9px;
  }

  .keeper-mark {
    width: 25px;
    height: 25px;
    display: grid;
    place-items: center;
    flex: 0 0 25px;
    border-radius: 50%;
    color: #fff;
    background:
      linear-gradient(
        135deg,
        #c52b1f,
        #ff7625
      );
    font-size: 12px;
    font-weight: 950;
  }

  .select-button,
  .remove-button,
  .lock-button,
  .secondary-button {
    font: inherit;
    cursor: pointer;
  }

  .select-button,
  .remove-button {
    width: 100%;
    min-height: 37px;
    margin-top: 13px;
    border-radius: 8px;
    font-size: 9px;
    font-weight: 950;
    letter-spacing: .04em;
    text-transform: uppercase;
  }

  .select-button {
    border: 1px solid
      rgba(255, 115, 35, .38);
    color: #ff954f;
    background:
      rgba(255, 105, 25, .06);
  }

  .remove-button {
    border: 1px solid #ff7625;
    color: #fff;
    background:
      linear-gradient(
        135deg,
        #b9231c,
        #e65d1d
      );
  }

  button:disabled {
    opacity: .48;
    cursor: not-allowed;
  }

  .lock-panel {
    padding: 20px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 22px;
  }

  .lock-panel.complete {
    border-color:
      rgba(70, 190, 95, .35);
  }

  .lock-button {
    min-width: 170px;
    min-height: 44px;
    padding: 0 16px;
    flex-shrink: 0;
    border: 1px solid #ff7625;
    border-radius: 9px;
    color: #fff;
    background:
      linear-gradient(
        135deg,
        #bc241c,
        #ff7625
      );
    font-size: 10px;
    font-weight: 950;
  }

  .secondary-button {
    min-height: 40px;
    margin-top: 14px;
    padding: 0 14px;
    border: 1px solid
      rgba(255, 112, 35, .4);
    border-radius: 8px;
    color: #ff9148;
    background:
      rgba(255, 105, 25, .07);
    font-weight: 900;
  }

  .commissioner-panel {
    padding: 18px;
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(220px, 320px) auto auto;
    align-items: center;
    gap: 16px;
    border-color: rgba(255, 116, 38, .42);
  }

  .commissioner-copy h2 {
    margin: 0;
    font-size: 20px;
  }

  .commissioner-copy p:not(.eyebrow) {
    margin: 6px 0 0;
    color: #9298a2;
    font-size: 11px;
    line-height: 1.45;
  }

  .team-select-wrap {
    display: grid;
    gap: 7px;
  }

  .team-select-wrap > span,
  .commissioner-progress > span {
    color: #858b95;
    font-size: 8px;
    font-weight: 950;
    letter-spacing: .1em;
  }

  .team-select-wrap select {
    width: 100%;
    min-height: 44px;
    padding: 0 12px;
    border: 1px solid rgba(255, 116, 38, .38);
    border-radius: 9px;
    color: #fff;
    background: #111318;
    font: inherit;
    font-size: 11px;
    font-weight: 850;
  }

  .commissioner-progress {
    min-width: 110px;
    display: grid;
    gap: 4px;
    text-align: center;
  }

  .commissioner-progress strong {
    color: #ff8a3d;
    font-size: 22px;
  }

  .finalize-button {
    min-height: 44px;
    padding: 0 16px;
    border: 1px solid #ff7625;
    border-radius: 9px;
    color: #fff;
    background: linear-gradient(135deg, #bc241c, #ff7625);
    font: inherit;
    font-size: 10px;
    font-weight: 950;
    cursor: pointer;
    white-space: nowrap;
  }

  .loading,
  .empty {
    padding: 30px;
    color: #9298a2;
    text-align: center;
  }

  .muted {
    color: #9298a2;
  }

  .error-box,
  .success-box {
    padding: 11px 13px;
    border-radius: 10px;
    font-size: 11px;
    font-weight: 700;
  }

  .error-box {
    border: 1px solid
      rgba(255, 75, 75, .42);
    color: #ff9c9c;
    background:
      rgba(170, 25, 25, .12);
  }

  .success-box {
    border: 1px solid
      rgba(70, 190, 100, .4);
    color: #8ee5a5;
    background:
      rgba(70, 190, 100, .08);
  }

  @media (max-width: 1000px) {
    .player-grid {
      grid-template-columns:
        repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 720px) {
    .keeper-page {
      width: 100%;
      max-width: 100%;
      min-width: 0;
      padding:
        18px 12px
        max(
          46px,
          env(safe-area-inset-bottom)
        );
      overflow-x: hidden;
    }

    .keeper-page *,
    .keeper-page > * {
      min-width: 0;
      max-width: 100%;
    }

    .keeper-header {
      padding: 17px;
      align-items: stretch;
      flex-direction: column;
    }

    .back-button {
      width: 100%;
    }

    .commissioner-panel {
      grid-template-columns: 1fr;
      align-items: stretch;
    }

    .commissioner-progress {
      text-align: left;
    }

    .finalize-button {
      width: 100%;
    }

    .summary-grid {
      grid-template-columns:
        repeat(2, minmax(0, 1fr));
      gap: 8px;
    }

    .stat-card {
      min-height: 92px;
      padding: 10px 6px;
    }

    .keeper-hero {
      padding: 17px;
      align-items: stretch;
      flex-direction: column;
    }

    .progress {
      width: 76px;
      height: 76px;
      flex-basis: 76px;
    }

    .player-grid {
      grid-template-columns: 1fr;
      gap: 8px;
    }

    .player-card {
      padding: 12px;
    }

    .lock-panel {
      padding: 17px;
      align-items: stretch;
      flex-direction: column;
    }

    .lock-button {
      width: 100%;
      min-width: 0;
    }
  }

  @media (max-width: 390px) {
    .player-photo {
      width: 42px;
      height: 42px;
    }

    .player-name-line h3 {
      font-size: 12px;
    }
  }


  .roster-list {
    display: grid;
    gap: 8px;
  }

  .roster-row {
    min-height: 72px;
    display: grid;
    grid-template-columns: 34px 48px minmax(0, 1fr) 58px 74px;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border: 1px solid rgba(255, 255, 255, .08);
    border-radius: 12px;
    background: linear-gradient(135deg, rgba(27,28,32,.98), rgba(12,13,16,.98));
    cursor: pointer;
    transition: border-color .15s ease, background .15s ease, transform .15s ease;
  }

  .roster-row:hover { border-color: rgba(255, 116, 38, .34); }
  .roster-row.selected {
    border-color: rgba(255, 112, 35, .72);
    background: linear-gradient(135deg, rgba(100, 22, 15, .46), rgba(25, 16, 13, .98));
  }
  .roster-row.disabled { cursor: default; opacity: .66; }

  .check-wrap { display: flex; align-items: center; justify-content: center; }
  .check-wrap input {
    width: 20px;
    height: 20px;
    accent-color: #f97316;
    cursor: pointer;
  }
  .check-wrap input:disabled { cursor: default; }

  .row-photo-wrap { width: 46px; height: 46px; }
  .row-photo {
    width: 46px;
    height: 46px;
    border-radius: 50%;
    object-fit: cover;
    background: #15171b;
    border: 1px solid rgba(255,255,255,.1);
  }
  .row-photo.fallback { display:flex; align-items:center; justify-content:center; font-weight:950; color:#ff7b2d; }

  .row-player-main { min-width: 0; display: grid; gap: 5px; }
  .row-player-main .player-name-line { display:flex; align-items:center; gap:6px; min-width:0; }
  .row-player-main strong { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:14px; }
  .row-player-main > span { color:#858b95; font-size:10px; font-weight:700; }

  .row-position {
    justify-self: center;
    min-width: 34px;
    padding: 5px 7px;
    border-radius: 999px;
    text-align: center;
    color: #fff;
    background: rgba(255,255,255,.07);
    font-size: 10px;
    font-weight: 950;
  }

  .row-keeper-state {
    justify-self: end;
    color:#6f7680;
    font-size:9px;
    font-weight:950;
    letter-spacing:.08em;
  }
  .row-keeper-state.on { color:#ff8a3d; }
  .lock-panel.submitted { border-color: rgba(255, 132, 46, .5); }
  .submitted-time { margin-top:8px !important; color:#ff9a5c !important; font-size:10px !important; font-weight:800; }

  @media (max-width: 640px) {
    .roster-row {
      grid-template-columns: 30px 42px minmax(0, 1fr) 38px;
      gap: 8px;
      padding: 9px 8px;
    }
    .row-photo-wrap, .row-photo { width:40px; height:40px; }
    .row-keeper-state { display:none; }
    .row-player-main strong { font-size:12px; }
    .row-player-main > span { font-size:9px; }
  }
`;