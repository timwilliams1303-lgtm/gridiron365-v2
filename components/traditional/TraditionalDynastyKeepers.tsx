"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";

type Props = {
  leagueId: string;
  fantasyTeamId: number;
  sourceSeason: number;
  targetSeason: number;
};

type KeeperState = {
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

type TeamRow = {
  id: number;
  team_name: string;
  owner_id: string | null;
  is_cpu: boolean | null;
};

type RosterRow = {
  player_id: number;
  acquired_via: string | null;
  acquired_at: string | null;
};

type PlayerRow = {
  id: number;
  full_name: string;
  primary_position: string | null;
  team_abbreviation: string | null;
  headshot_url: string | null;
  status: string | null;
  injury_status: string | null;
};

type TeamProgress = {
  team: TeamRow;
  state: KeeperState;
};

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function normalize(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function pretty(value: unknown) {
  const text = normalize(value);
  if (!text) return "Not Started";
  return text
    .replaceAll("_", " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function keeperPlayerId(row: unknown): number | null {
  if (typeof row === "number" && Number.isFinite(row)) return row;
  if (!row || typeof row !== "object") return null;

  const value = row as Record<string, unknown>;
  for (const candidate of [
    value.playerId,
    value.player_id,
    value.nflPlayerId,
    value.nfl_player_id,
    value.id,
  ]) {
    const id = Number(candidate);
    if (Number.isFinite(id) && id > 0) return id;
  }
  return null;
}

function parseKeeperState(value: unknown): KeeperState {
  const row =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};

  const keeperLimit = Number(row.keeperLimit ?? row.keeper_limit ?? 0);
  const selectedCount = Number(row.selectedCount ?? row.selected_count ?? 0);

  return {
    keeperLimit: Number.isFinite(keeperLimit) ? keeperLimit : 0,
    selectedCount: Number.isFinite(selectedCount) ? selectedCount : 0,
    remainingSelections: Number(
      row.remainingSelections ??
        row.remaining_selections ??
        Math.max(0, keeperLimit - selectedCount)
    ),
    submitted: Boolean(row.submitted),
    submittedAt: (row.submittedAt ?? row.submitted_at ?? null) as string | null,
    locked: Boolean(row.locked),
    editable: Boolean(row.editable),
    protectionStatus: String(
      row.protectionStatus ?? row.protection_status ?? "protection_closed"
    ),
    protectionDeadline: (
      row.protectionDeadline ??
      row.protection_deadline ??
      null
    ) as string | null,
    keepers: Array.isArray(row.keepers) ? row.keepers : [],
  };
}

function formatDate(value: string | null) {
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

export default function TraditionalDynastyKeepers({
  leagueId,
  fantasyTeamId,
  sourceSeason,
  targetSeason,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [workingPlayerId, setWorkingPlayerId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isCommissioner, setIsCommissioner] = useState(false);
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState(fantasyTeamId);
  const [keeperState, setKeeperState] = useState<KeeperState | null>(null);
  const [progress, setProgress] = useState<TeamProgress[]>([]);
  const [roster, setRoster] = useState<RosterRow[]>([]);
  const [players, setPlayers] = useState<PlayerRow[]>([]);

  const activeTeamId = isCommissioner ? selectedTeamId : fantasyTeamId;

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const auth = await supabase.auth.getUser();
      if (auth.error) throw auth.error;
      if (!auth.data.user) throw new Error("You must be signed in.");

      const [membershipResult, teamsResult] = await Promise.all([
        supabase
          .from("league_members")
          .select("role")
          .eq("league_id", leagueId)
          .eq("user_id", auth.data.user.id)
          .maybeSingle(),
        supabase
          .from("fantasy_teams")
          .select("id,team_name,owner_id,is_cpu")
          .eq("league_id", leagueId)
          .eq("active", true)
          .order("id"),
      ]);

      if (membershipResult.error) throw membershipResult.error;
      if (teamsResult.error) throw teamsResult.error;

      const commissioner = ["commissioner", "co_commissioner"].includes(
        normalize(membershipResult.data?.role)
      );
      setIsCommissioner(commissioner);

      const teamRows = (teamsResult.data ?? []) as TeamRow[];
      setTeams(teamRows);

      let effectiveTeamId = commissioner ? selectedTeamId : fantasyTeamId;
      if (
        commissioner &&
        !teamRows.some((team) => Number(team.id) === Number(effectiveTeamId)) &&
        teamRows.length > 0
      ) {
        effectiveTeamId = Number(teamRows[0].id);
        setSelectedTeamId(effectiveTeamId);
      }

      if (!effectiveTeamId) {
        throw new Error("No fantasy team is available for keeper selection.");
      }

      const stateResult = await supabase.rpc(
        "get_traditional_dynasty_keeper_state",
        {
          p_league_id: leagueId,
          p_fantasy_team_id: effectiveTeamId,
          p_target_season: targetSeason,
        }
      );

      if (stateResult.error) throw stateResult.error;
      const nextState = parseKeeperState(stateResult.data);

      const rosterResult = await supabase
        .from("team_rosters")
        .select("player_id,acquired_via,acquired_at")
        .eq("league_id", leagueId)
        .eq("fantasy_team_id", effectiveTeamId);

      if (rosterResult.error) throw rosterResult.error;

      const rosterRows = (rosterResult.data ?? []) as RosterRow[];
      const playerIds = [
        ...new Set(
          rosterRows
            .map((row) => Number(row.player_id))
            .filter((id) => Number.isFinite(id) && id > 0)
        ),
      ];

      let playerRows: PlayerRow[] = [];
      if (playerIds.length > 0) {
        const playersResult = await supabase
          .from("nfl_players")
          .select(
            "id,full_name,primary_position,team_abbreviation,headshot_url,status,injury_status"
          )
          .in("id", playerIds);

        if (playersResult.error) throw playersResult.error;
        playerRows = (playersResult.data ?? []) as PlayerRow[];
      }

      let progressRows: TeamProgress[] = [];
      if (commissioner && teamRows.length > 0) {
        progressRows = await Promise.all(
          teamRows.map(async (team) => {
            const result = await supabase.rpc(
              "get_traditional_dynasty_keeper_state",
              {
                p_league_id: leagueId,
                p_fantasy_team_id: team.id,
                p_target_season: targetSeason,
              }
            );

            if (result.error) throw result.error;
            return { team, state: parseKeeperState(result.data) };
          })
        );
      }

      setKeeperState(nextState);
      setRoster(rosterRows);
      setPlayers(playerRows);
      setProgress(progressRows);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to load NFL Dynasty keepers."
      );
    } finally {
      setLoading(false);
    }
  }, [fantasyTeamId, leagueId, selectedTeamId, targetSeason]);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedIds = useMemo(
    () =>
      new Set(
        (keeperState?.keepers ?? [])
          .map(keeperPlayerId)
          .filter((id): id is number => id !== null)
      ),
    [keeperState]
  );

  const sortedPlayers = useMemo(() => {
    const order = new Map([
      ["QB", 1],
      ["RB", 2],
      ["WR", 3],
      ["TE", 4],
      ["K", 5],
      ["DST", 6],
      ["DL", 7],
      ["DE", 8],
      ["DT", 9],
      ["LB", 10],
      ["DB", 11],
      ["CB", 12],
      ["S", 13],
    ]);

    return [...players].sort((a, b) => {
      const aSelected = selectedIds.has(a.id);
      const bSelected = selectedIds.has(b.id);
      if (aSelected !== bSelected) return aSelected ? -1 : 1;

      const positionDifference =
        (order.get(String(a.primary_position ?? "").toUpperCase()) ?? 99) -
        (order.get(String(b.primary_position ?? "").toUpperCase()) ?? 99);

      if (positionDifference !== 0) return positionDifference;
      return a.full_name.localeCompare(b.full_name);
    });
  }, [players, selectedIds]);

  const keeperLimit = keeperState?.keeperLimit ?? 0;
  const selectedCount = keeperState?.selectedCount ?? 0;
  const remaining =
    keeperState?.remainingSelections ??
    Math.max(0, keeperLimit - selectedCount);
  const locked = keeperState?.locked ?? false;
  const editable = keeperState?.editable ?? false;
  const submitted = keeperState?.submitted ?? false;

  const allSubmitted =
    progress.length > 0 && progress.every((item) => item.state.submitted);
  const allFinalized =
    progress.length > 0 && progress.every((item) => item.state.locked);

  async function toggleKeeper(player: PlayerRow) {
    if (!keeperState || !editable || locked || workingPlayerId !== null) return;

    const selected = selectedIds.has(player.id);
    if (!selected && selectedCount >= keeperLimit) {
      setError(
        `You already selected all ${keeperLimit} keepers. Remove one before selecting another.`
      );
      return;
    }

    setWorkingPlayerId(player.id);
    setError("");
    setMessage("");

    try {
      const result = isCommissioner
        ? await supabase.rpc("commissioner_manage_traditional_dynasty_keeper", {
            p_league_id: leagueId,
            p_fantasy_team_id: activeTeamId,
            p_player_id: player.id,
            p_target_season: targetSeason,
            p_action: selected ? "unselect" : "select",
          })
        : await supabase.rpc("manage_my_traditional_dynasty_keeper", {
            p_league_id: leagueId,
            p_player_id: player.id,
            p_target_season: targetSeason,
            p_action: selected ? "unselect" : "select",
          });

      if (result.error) throw result.error;

      setMessage(
        selected
          ? `${player.full_name} removed from the keeper list.`
          : `${player.full_name} selected as a keeper.`
      );
      await load();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to update keeper."
      );
    } finally {
      setWorkingPlayerId(null);
    }
  }

  async function submitKeepers() {
    if (
      !keeperState ||
      !editable ||
      locked ||
      selectedCount !== keeperLimit ||
      submitting
    ) {
      return;
    }

    setSubmitting(true);
    setError("");
    setMessage("");

    try {
      const result = isCommissioner
        ? await supabase.rpc("commissioner_submit_traditional_dynasty_keepers", {
            p_league_id: leagueId,
            p_fantasy_team_id: activeTeamId,
            p_target_season: targetSeason,
          })
        : await supabase.rpc("submit_my_traditional_dynasty_keepers", {
            p_league_id: leagueId,
            p_target_season: targetSeason,
          });

      if (result.error) throw result.error;

      setMessage(
        isCommissioner
          ? `Keeper list submitted for ${teams.find((t) => t.id === activeTeamId)?.team_name ?? "team"}.`
          : `Your ${targetSeason} keeper list has been submitted.`
      );
      await load();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to submit keeper selections."
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function finalizeAll() {
    if (!isCommissioner || !allSubmitted || finalizing || allFinalized) return;

    if (
      !window.confirm(
        `Finalize all ${targetSeason} NFL Dynasty keepers? This permanently locks the submitted keeper lists and carries those players into ${targetSeason}.`
      )
    ) {
      return;
    }

    setFinalizing(true);
    setError("");
    setMessage("");

    try {
      const result = await supabase.rpc(
        "commissioner_finalize_traditional_dynasty_keepers",
        {
          p_league_id: leagueId,
          p_target_season: targetSeason,
        }
      );

      if (result.error) throw result.error;

      setMessage(`All ${targetSeason} keeper lists were finalized.`);
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
          <div className="panel">Loading NFL Dynasty keepers…</div>
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
            <p className="eyebrow">G365 NFL DYNASTY</p>
            <h1>Protected Players</h1>
            <p className="subtitle">
              Protect {keeperLimit} players from the {sourceSeason} roster for
              the {targetSeason} season.
            </p>
          </div>

          <Link href={`/league/${leagueId}/offseason`} className="back-button">
            ← OFFSEASON
          </Link>
        </header>

        {error ? <div className="error-box">{error}</div> : null}
        {message ? <div className="success-box">{message}</div> : null}

        {isCommissioner ? (
          <section className="panel commissioner-panel">
            <div className="commissioner-copy">
              <p className="eyebrow">COMMISSIONER KEEPER CONTROL</p>
              <h2>Manage Every Team</h2>
              <p>
                Select a team, review its roster, make keeper selections and
                submit on its behalf. Finalize only after every active team has
                submitted exactly {keeperLimit} keepers.
              </p>
            </div>

            <label className="team-select-wrap">
              <span>TEAM</span>
              <select
                value={activeTeamId}
                disabled={finalizing || allFinalized}
                onChange={(event) => {
                  setError("");
                  setMessage("");
                  setSelectedTeamId(Number(event.target.value));
                }}
              >
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.team_name}
                    {team.is_cpu ? " • CPU" : ""}
                  </option>
                ))}
              </select>
            </label>

            <div className="commissioner-progress">
              <strong>
                {progress.filter((item) => item.state.submitted).length}/
                {progress.length}
              </strong>
              <span>TEAMS SUBMITTED</span>
            </div>

            <button
              type="button"
              className="finalize-button"
              disabled={!allSubmitted || finalizing || allFinalized}
              onClick={() => void finalizeAll()}
            >
              {allFinalized
                ? "KEEPERS FINALIZED"
                : finalizing
                  ? "FINALIZING…"
                  : "FINALIZE ALL KEEPERS"}
            </button>
          </section>
        ) : null}

        {isCommissioner && progress.length > 0 ? (
          <section className="team-progress-grid">
            {progress.map(({ team, state }) => (
              <button
                type="button"
                key={team.id}
                className={`team-progress-card ${
                  team.id === activeTeamId ? "active" : ""
                }`}
                onClick={() => setSelectedTeamId(team.id)}
              >
                <strong>{team.team_name}</strong>
                <span>
                  {state.selectedCount}/{state.keeperLimit} selected
                </span>
                <small>
                  {state.locked
                    ? "Finalized"
                    : state.submitted
                      ? "Submitted"
                      : "Waiting"}
                </small>
              </button>
            ))}
          </section>
        ) : null}

        {keeperState ? (
          <>
            <section className="status-grid">
              <div className="status-card">
                <span>SELECTED</span>
                <strong>
                  {selectedCount}/{keeperLimit}
                </strong>
              </div>
              <div className="status-card">
                <span>REMAINING</span>
                <strong>{remaining}</strong>
              </div>
              <div className="status-card">
                <span>STATUS</span>
                <strong>{locked ? "Finalized" : submitted ? "Submitted" : "Open"}</strong>
              </div>
              <div className="status-card">
                <span>PROTECTION</span>
                <strong>{pretty(keeperState.protectionStatus)}</strong>
              </div>
              <div className="status-card">
                <span>DEADLINE</span>
                <strong className="small-value">
                  {formatDate(keeperState.protectionDeadline)}
                </strong>
              </div>
            </section>

            {!editable && !locked ? (
              <div className="notice-box">
                Keeper selections are currently read-only. The commissioner
                must open the protection period before changes can be made.
              </div>
            ) : null}

            <section className="panel">
              <div className="roster-heading">
                <div>
                  <p className="eyebrow">SOURCE ROSTER • {sourceSeason}</p>
                  <h2>
                    {teams.find((team) => team.id === activeTeamId)?.team_name ??
                      "My Team"}
                  </h2>
                </div>

                <div className="selection-meter">
                  <strong>{selectedCount}</strong>
                  <span>OF {keeperLimit} KEEPERS</span>
                </div>
              </div>

              <div className="player-grid">
                {sortedPlayers.map((player) => {
                  const selected = selectedIds.has(player.id);
                  const working = workingPlayerId === player.id;

                  return (
                    <button
                      type="button"
                      key={player.id}
                      className={`player-card ${selected ? "selected" : ""}`}
                      disabled={!editable || locked || workingPlayerId !== null}
                      onClick={() => void toggleKeeper(player)}
                    >
                      <div className="player-photo-wrap">
                        {player.headshot_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={player.headshot_url}
                            alt=""
                            className="player-photo"
                          />
                        ) : (
                          <div className="player-photo fallback">
                            {String(player.primary_position ?? "?").toUpperCase()}
                          </div>
                        )}

                        <span className={`keeper-check ${selected ? "on" : ""}`}>
                          {selected ? "✓" : "+"}
                        </span>
                      </div>

                      <div className="player-copy">
                        <strong>{player.full_name}</strong>
                        <span>
                          {String(player.primary_position ?? "—").toUpperCase()}
                          {" • "}
                          {player.team_abbreviation ?? "FA"}
                        </span>

                        {player.injury_status ? (
                          <small className="injury">
                            {pretty(player.injury_status)}
                          </small>
                        ) : player.status ? (
                          <small>{pretty(player.status)}</small>
                        ) : null}
                      </div>

                      <span className={`select-label ${selected ? "selected" : ""}`}>
                        {working
                          ? "SAVING…"
                          : selected
                            ? "KEEPER"
                            : "SELECT"}
                      </span>
                    </button>
                  );
                })}
              </div>

              {sortedPlayers.length === 0 ? (
                <div className="empty-roster">
                  No active roster players were found for this fantasy team.
                </div>
              ) : null}
            </section>

            <section className="submit-bar">
              <div>
                <strong>
                  {locked
                    ? `${targetSeason} keepers are finalized.`
                    : selectedCount === keeperLimit
                      ? "Keeper list is ready to submit."
                      : `Select ${remaining} more player${remaining === 1 ? "" : "s"}.`}
                </strong>
                <span>
                  {submitted && !locked
                    ? "You may still change selections and submit again until league-wide finalization."
                    : "All configured keeper slots must be filled before submission."}
                </span>
              </div>

              <button
                type="button"
                className="submit-button"
                disabled={
                  !editable ||
                  locked ||
                  selectedCount !== keeperLimit ||
                  submitting ||
                  workingPlayerId !== null
                }
                onClick={() => void submitKeepers()}
              >
                {locked
                  ? "FINALIZED"
                  : submitting
                    ? "SUBMITTING…"
                    : submitted
                      ? "RESUBMIT KEEPERS"
                      : "SUBMIT KEEPERS"}
              </button>
            </section>
          </>
        ) : (
          <section className="panel">
            Keeper state could not be loaded.
          </section>
        )}
      </section>
    </main>
  );
}

const styles = `
  .keeper-page{min-height:100vh;padding:24px 16px 60px;color:#f6f7f9;background:radial-gradient(circle at top right,rgba(255,79,22,.1),transparent 28%),linear-gradient(180deg,#090b0f,#06080b)}
  .keeper-shell{width:min(1240px,100%);margin:0 auto}
  .keeper-header{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;padding:22px;border:1px solid rgba(255,91,31,.22);border-radius:16px;background:linear-gradient(135deg,rgba(118,18,12,.16),rgba(255,80,20,.03)),#0d1015}
  .keeper-header h1,.panel h2{margin:0;font-weight:950;letter-spacing:-.025em}.keeper-header h1{font-size:clamp(30px,5vw,48px)}
  .eyebrow{margin:0 0 6px;color:#ff6429;font-size:10px;font-weight:950;letter-spacing:.12em}.subtitle,.commissioner-copy p{max-width:720px;margin:8px 0 0;color:#9ca4af;line-height:1.55}
  .back-button,.submit-button,.finalize-button{min-height:42px;padding:10px 14px;border-radius:9px;font-size:10px;font-weight:950;letter-spacing:.04em;text-decoration:none}
  .back-button{color:#fff;border:1px solid rgba(255,255,255,.1);background:#15181e}
  .error-box,.success-box,.notice-box{margin-top:14px;padding:13px;border-radius:10px;font-size:12px}.error-box{color:#ffb3a0;border:1px solid rgba(239,68,68,.35);background:rgba(127,29,29,.18)}.success-box{color:#76e395;border:1px solid rgba(34,197,94,.3);background:rgba(20,83,45,.18)}.notice-box{color:#e4b49f;border:1px solid rgba(255,91,31,.25);background:rgba(111,34,16,.16)}
  .panel{margin-top:16px;padding:18px;border:1px solid rgba(255,255,255,.08);border-radius:14px;background:#0d1015}
  .commissioner-panel{display:grid;grid-template-columns:minmax(260px,1fr) minmax(180px,.5fr) 120px auto;align-items:end;gap:14px;border-color:rgba(255,91,31,.25)}
  .team-select-wrap{display:flex;flex-direction:column;gap:6px}.team-select-wrap span,.status-card span,.selection-meter span{color:#8f97a3;font-size:9px;font-weight:900;letter-spacing:.08em}.team-select-wrap select{min-height:42px;padding:0 10px;color:#fff;border:1px solid rgba(255,255,255,.1);border-radius:8px;background:#11151b}
  .commissioner-progress strong{display:block;font-size:24px}.commissioner-progress span{color:#8f97a3;font-size:8px;font-weight:900}
  .finalize-button,.submit-button{border:1px solid rgba(255,91,31,.55);color:#fff;background:linear-gradient(135deg,#bd2018,#ff5a1f);cursor:pointer}.finalize-button:disabled,.submit-button:disabled{opacity:.42;cursor:not-allowed}
  .team-progress-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:8px;margin-top:12px}.team-progress-card{padding:12px;text-align:left;color:#fff;border:1px solid rgba(255,255,255,.08);border-radius:10px;background:#0d1015;cursor:pointer}.team-progress-card.active{border-color:rgba(255,91,31,.6)}.team-progress-card strong,.team-progress-card span,.team-progress-card small{display:block}.team-progress-card span{margin-top:5px;color:#a4abb5;font-size:10px}.team-progress-card small{margin-top:4px;color:#ff7a42;font-size:9px}
  .status-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:9px;margin-top:16px}.status-card{padding:13px;border:1px solid rgba(255,255,255,.08);border-radius:11px;background:#0d1015}.status-card strong{display:block;margin-top:7px;font-size:18px}.status-card .small-value{font-size:11px;line-height:1.4}
  .roster-heading{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;margin-bottom:14px}.selection-meter{text-align:right}.selection-meter strong{display:block;color:#ff6429;font-size:28px}
  .player-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}.player-card{min-width:0;padding:10px;display:grid;grid-template-columns:52px minmax(0,1fr) auto;align-items:center;gap:10px;text-align:left;color:#fff;border:1px solid rgba(255,255,255,.08);border-radius:11px;background:#11141a;cursor:pointer}.player-card.selected{border-color:rgba(255,91,31,.62);background:linear-gradient(135deg,rgba(137,25,14,.25),#11141a)}.player-card:disabled{cursor:not-allowed}
  .player-photo-wrap{position:relative}.player-photo{width:52px;height:52px;object-fit:cover;border-radius:9px;background:#20242b}.player-photo.fallback{display:flex;align-items:center;justify-content:center;font-weight:950}.keeper-check{position:absolute;right:-5px;bottom:-5px;width:21px;height:21px;display:flex;align-items:center;justify-content:center;border-radius:999px;color:#fff;background:#3a4049;font-size:12px;font-weight:950}.keeper-check.on{background:#e5481e}
  .player-copy{min-width:0}.player-copy strong,.player-copy span,.player-copy small{display:block}.player-copy strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px}.player-copy span{margin-top:4px;color:#a5acb6;font-size:10px}.player-copy small{margin-top:3px;color:#7f8791;font-size:9px}.player-copy .injury{color:#ff8d62}
  .select-label{padding:5px 7px;border-radius:999px;color:#a7aeb7;background:rgba(255,255,255,.05);font-size:8px;font-weight:950}.select-label.selected{color:#ff8b5a;background:rgba(255,91,31,.1)}
  .empty-roster{padding:24px;text-align:center;color:#8d95a0}
  .submit-bar{position:sticky;bottom:12px;z-index:5;margin-top:16px;padding:14px 16px;display:flex;justify-content:space-between;align-items:center;gap:16px;border:1px solid rgba(255,91,31,.3);border-radius:13px;background:rgba(12,14,18,.96);backdrop-filter:blur(10px)}.submit-bar strong,.submit-bar span{display:block}.submit-bar span{margin-top:4px;color:#8f97a3;font-size:10px}
  @media(max-width:980px){.commissioner-panel{grid-template-columns:1fr 1fr}.player-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.status-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
  @media(max-width:650px){.keeper-page{padding:12px 9px 40px}.keeper-header,.submit-bar{flex-direction:column;align-items:stretch}.back-button{text-align:center}.commissioner-panel{grid-template-columns:1fr}.status-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.player-grid{grid-template-columns:1fr}.player-card{grid-template-columns:48px minmax(0,1fr) auto}.player-photo{width:48px;height:48px}.submit-button{width:100%}}
`;
