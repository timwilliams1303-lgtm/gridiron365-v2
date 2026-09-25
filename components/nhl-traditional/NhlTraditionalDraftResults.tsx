import Link from "next/link";

import NhlInjuryBadge from "@/components/nhl-traditional/NhlInjuryBadge";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Props = {
  leagueId: string;
  sourceSeason: number;
  draftSeason: number;
};

type DraftRow = {
  id: string;
  season: number;
  draft_type: string;
  status: string;
  rounds: number;
  seconds_per_pick: number;
  draft_order_method: string | null;
  started_at: string | null;
  completed_at: string | null;
};

type PickRow = {
  id: number;
  round_number: number;
  pick_in_round: number;
  overall_pick: number;
  draft_slot: number | null;
  fantasy_team_id: number;
  nhl_player_id: number | null;
  pick_type: string;
  picked_at: string | null;
};

type TeamRow = {
  id: number;
  team_name: string;
  is_cpu: boolean;
};

type DraftTeamRow = {
  fantasy_team_id: number;
  draft_slot: number;
  is_cpu: boolean;
};

type HistoricalRosterRow = {
  fantasy_team_id: number;
  nhl_player_id: number;
  roster_status: "keeper" | "drafted";
  acquired_via: "keeper" | "draft";
};

type KeeperRow = {
  fantasy_team_id: number;
  nhl_player_id: number;
  status: string;
};

type PlayerRow = {
  id: number;
  display_name: string;
  jersey_number: string | null;
  position: string | null;
  position_group: string | null;
  injury_status: string | null;
  injury_detail: string | null;
  injury_return_date: string | null;
  injury_source: string | null;
  headshot_url: string | null;
};

function normalize(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function pretty(value: unknown) {
  const text = normalize(value);
  if (!text) return "—";
  return text
    .replaceAll("_", " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function positionLabel(player: PlayerRow | undefined) {
  return String(
    player?.position ??
      player?.position_group ??
      "—"
  ).toUpperCase();
}

function formatDate(value: string | null | undefined) {
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

function keeperStatusIsFinal(status: string) {
  return ["locked", "carried_over", "finalized", "complete", "completed"].includes(
    normalize(status)
  );
}

export default async function NhlTraditionalDraftResults({
  leagueId,
  sourceSeason,
  draftSeason,
}: Props) {
  const supabase = await createSupabaseServerClient();

  /*
   * Exact target-season lookup is intentional.
   * Never fall back to the previous startup draft.
   */
  const { data: draftData, error: draftError } = await supabase
    .from("nhl_traditional_drafts")
    .select(
      [
        "id",
        "season",
        "draft_type",
        "status",
        "rounds",
        "seconds_per_pick",
        "draft_order_method",
        "started_at",
        "completed_at",
      ].join(",")
    )
    .eq("league_id", leagueId)
    .eq("season", draftSeason)
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (draftError) {
    throw new Error(`Unable to load ${draftSeason} NHL draft: ${draftError.message}`);
  }

  const draft = draftData as DraftRow | null;
  const draftCompleted = normalize(draft?.status) === "completed";

  if (!draft || !draftCompleted) {
    return (
      <main className="g365-results-page">
        <style>{styles}</style>

        <section className="g365-results-shell">
          <header className="g365-results-hero">
            <div>
              <p className="g365-results-eyebrow">G365 NHL DRAFT RESULTS</p>
              <h1>{draftSeason} Draft Results</h1>
              <p>
                Results will appear here after the {draftSeason} draft is completed.
                Previous-season draft data is intentionally excluded.
              </p>
            </div>

            <div className="g365-results-season">
              <span>DRAFT SEASON</span>
              <strong>{draftSeason}</strong>
              <small>{draft ? pretty(draft.status) : "NOT PREPARED"}</small>
            </div>
          </header>

          <section className="g365-results-empty">
            <span className="g365-results-empty-icon">DR</span>
            <p className="g365-results-eyebrow">DRAFT RESULTS</p>
            <h2>Draft Results Not Available Yet</h2>
            <p>
              {draft
                ? `The ${draftSeason} draft is currently ${pretty(draft.status).toLowerCase()}. The completed board, keeper history, and final team rosters will unlock automatically when the draft finishes.`
                : `The ${draftSeason} annual draft has not been prepared yet.`}
            </p>

            <div className="g365-results-actions">
              <Link href={`/league/${leagueId}/nhl/offseason`} className="g365-results-secondary">
                Back to Offseason
              </Link>
              <Link href={`/league/${leagueId}/nhl/draft`} className="g365-results-primary">
                Draft Room
              </Link>
            </div>
          </section>
        </section>
      </main>
    );
  }

  const [
    picksResult,
    draftTeamsResult,
    keepersResult,
  ] = await Promise.all([
    supabase
      .from("nhl_traditional_draft_picks")
      .select(
        "id,round_number,pick_in_round,overall_pick,draft_slot,fantasy_team_id,nhl_player_id,pick_type,picked_at"
      )
      .eq("draft_id", draft.id)
      .eq("league_id", leagueId)
      .eq("season", draftSeason)
      .not("nhl_player_id", "is", null)
      .order("overall_pick", { ascending: true }),

    supabase
      .from("nhl_traditional_draft_teams")
      .select("fantasy_team_id,draft_slot,is_cpu")
      .eq("draft_id", draft.id)
      .eq("league_id", leagueId)
      .order("draft_slot", { ascending: true }),

    supabase
      .from("nhl_dynasty_keeper_selections")
      .select("fantasy_team_id,nhl_player_id,status")
      .eq("league_id", leagueId)
      .eq("source_season", sourceSeason)
      .eq("target_season", draftSeason),
  ]);

  if (picksResult.error) {
    throw new Error(`Unable to load NHL draft picks: ${picksResult.error.message}`);
  }
  if (draftTeamsResult.error) {
    throw new Error(`Unable to load NHL draft teams: ${draftTeamsResult.error.message}`);
  }
  if (keepersResult.error) {
    throw new Error(`Unable to load Dynasty keepers: ${keepersResult.error.message}`);
  }

  const picks = (picksResult.data ?? []) as PickRow[];
  const draftTeams = (draftTeamsResult.data ?? []) as DraftTeamRow[];
  const keepers = ((keepersResult.data ?? []) as KeeperRow[]).filter((row) =>
    keeperStatusIsFinal(row.status)
  );

  /*
   * The team set comes from the historical draft itself, not from
   * fantasy_teams.active. This keeps teams that later become inactive
   * visible in old Draft Results.
   *
   * fantasy_teams is used only for the display name. The membership of
   * the historical draft is anchored by nhl_traditional_draft_teams.
   */
  const historicalTeamIds = Array.from(
    new Set(draftTeams.map((row) => row.fantasy_team_id))
  );

  let teams: TeamRow[] = [];

  if (historicalTeamIds.length > 0) {
    const { data, error } = await supabase
      .from("fantasy_teams")
      .select("id,team_name,is_cpu")
      .eq("league_id", leagueId)
      .in("id", historicalTeamIds);

    if (error) {
      throw new Error(`Unable to load NHL fantasy teams: ${error.message}`);
    }

    const teamRows = (data ?? []) as TeamRow[];
    const teamById = new Map(teamRows.map((team) => [team.id, team]));

    teams = draftTeams.map((draftTeam) => {
      const current = teamById.get(draftTeam.fantasy_team_id);

      return {
        id: draftTeam.fantasy_team_id,
        team_name:
          current?.team_name ?? `Team ${draftTeam.fantasy_team_id}`,
        is_cpu: draftTeam.is_cpu,
      };
    });
  }

  /*
   * IMPORTANT: Final Draft Rosters are reconstructed only from immutable
   * draft-day sources: finalized keeper selections plus completed picks.
   * We intentionally do NOT read nhl_traditional_rosters here because
   * later adds, drops, waivers, and trades must never rewrite history.
   */
  const historicalRosterMap = new Map<string, HistoricalRosterRow>();

  for (const keeper of keepers) {
    historicalRosterMap.set(
      `${keeper.fantasy_team_id}:${keeper.nhl_player_id}`,
      {
        fantasy_team_id: keeper.fantasy_team_id,
        nhl_player_id: keeper.nhl_player_id,
        roster_status: "keeper",
        acquired_via: "keeper",
      }
    );
  }

  for (const pick of picks) {
    if (pick.nhl_player_id == null) continue;

    historicalRosterMap.set(
      `${pick.fantasy_team_id}:${pick.nhl_player_id}`,
      {
        fantasy_team_id: pick.fantasy_team_id,
        nhl_player_id: pick.nhl_player_id,
        roster_status: "drafted",
        acquired_via: "draft",
      }
    );
  }

  const rosters = Array.from(historicalRosterMap.values());

  const playerIds = Array.from(
    new Set(
      [
        ...picks.map((row) => row.nhl_player_id),
        ...keepers.map((row) => row.nhl_player_id),
        ...rosters.map((row) => row.nhl_player_id),
      ].filter((id): id is number => id != null)
    )
  );

  let players: PlayerRow[] = [];

  if (playerIds.length > 0) {
    const { data, error } = await supabase
      .from("nhl_players")
      .select(
        [
          "id",
          "display_name",
          "jersey_number",
          "position",
          "position_group",
          "injury_status",
          "injury_detail",
          "injury_return_date",
          "injury_source",
          "headshot_url",
        ].join(",")
      )
      .in("id", playerIds);

    if (error) {
      throw new Error(`Unable to load NHL players: ${error.message}`);
    }

    players = (data ?? []) as unknown as PlayerRow[];
  }

  const playerById = new Map(players.map((player) => [player.id, player]));
  const teamById = new Map(teams.map((team) => [team.id, team]));

  const rounds = Array.from(
    new Set(picks.map((pick) => pick.round_number))
  ).sort((a, b) => a - b);

  const keeperIds = new Set(
    keepers.map((row) => `${row.fantasy_team_id}:${row.nhl_player_id}`)
  );

  const draftedIds = new Set(
    picks
      .filter((row) => row.nhl_player_id != null)
      .map((row) => `${row.fantasy_team_id}:${row.nhl_player_id}`)
  );

  const totalKeepers = keepers.length;
  const totalDrafted = picks.length;

  return (
    <main className="g365-results-page">
      <style>{styles}</style>

      <section className="g365-results-shell">
        <header className="g365-results-hero">
          <div>
            <p className="g365-results-eyebrow">G365 NHL DRAFT RESULTS</p>
            <h1>{draftSeason} Draft Results</h1>
            <p>
              Historical record reconstructed from finalized keepers and completed
              draft selections, so later roster moves cannot rewrite it.
            </p>
          </div>

          <div className="g365-results-season">
            <span>DRAFT SEASON</span>
            <strong>{draftSeason}</strong>
            <small>COMPLETE</small>
          </div>
        </header>

        <section className="g365-results-stats">
          <ResultStat label="STATUS" value="COMPLETE" detail={formatDate(draft.completed_at)} />
          <ResultStat label="ORDER" value={pretty(draft.draft_order_method)} detail="Linear annual order" />
          <ResultStat label="KEEPERS" value={String(totalKeepers)} detail="Protected players" />
          <ResultStat label="DRAFTED" value={String(totalDrafted)} detail={`${draft.rounds} rounds`} />
        </section>

        <section className="g365-results-section">
          <div className="g365-results-heading">
            <div>
              <p className="g365-results-eyebrow">ROUND BY ROUND</p>
              <h2>Draft Board</h2>
            </div>
            <span className="g365-results-complete-pill">FINAL</span>
          </div>

          {rounds.length === 0 ? (
            <div className="g365-results-inline-empty">
              No completed selections were found for this draft.
            </div>
          ) : (
            <div className="g365-results-rounds">
              {rounds.map((round) => {
                const roundPicks = picks.filter(
                  (pick) => pick.round_number === round
                );

                return (
                  <section key={round} className="g365-results-round">
                    <div className="g365-results-round-title">
                      <span>ROUND</span>
                      <strong>{round}</strong>
                    </div>

                    <div className="g365-results-pick-grid">
                      {roundPicks.map((pick) => {
                        const player =
                          pick.nhl_player_id != null
                            ? playerById.get(pick.nhl_player_id)
                            : undefined;
                        const team = teamById.get(pick.fantasy_team_id);

                        return (
                          <article key={pick.id} className="g365-results-pick">
                            <div className="g365-results-pick-number">
                              <span>#{pick.overall_pick}</span>
                              <small>R{pick.round_number} · P{pick.pick_in_round}</small>
                            </div>

                            <div className="g365-results-player">
                              <PlayerAvatar player={player} />
                              <div>
                                <div className="g365-results-player-name">
                                  <strong>{player?.display_name ?? "Unknown Player"}</strong>
                                  {player ? (
                                    <NhlInjuryBadge
                                      status={player.injury_status}
                                      detail={player.injury_detail}
                                      returnDate={player.injury_return_date}
                                      source={player.injury_source}
                                    />
                                  ) : null}
                                </div>
                                <span>
                                  {positionLabel(player)}
                                  {player?.jersey_number ? ` · #${player.jersey_number}` : ""}
                                </span>
                              </div>
                            </div>

                            <div className="g365-results-pick-team">
                              <strong>{team?.team_name ?? `Team ${pick.fantasy_team_id}`}</strong>
                              <span>{pretty(pick.pick_type)}</span>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </section>

        <section className="g365-results-section">
          <div className="g365-results-heading">
            <div>
              <p className="g365-results-eyebrow">TEAM BY TEAM</p>
              <h2>Final Draft Rosters</h2>
            </div>
          </div>

          <div className="g365-results-team-grid">
            {teams.map((team) => {
              const teamRoster = rosters
                .filter((row) => row.fantasy_team_id === team.id)
                .sort((a, b) => {
                  const pa = playerById.get(a.nhl_player_id);
                  const pb = playerById.get(b.nhl_player_id);
                  return (
                    positionLabel(pa).localeCompare(positionLabel(pb)) ||
                    String(pa?.display_name ?? "").localeCompare(
                      String(pb?.display_name ?? "")
                    )
                  );
                });

              const teamKeepers = keepers.filter(
                (row) => row.fantasy_team_id === team.id
              ).length;
              const teamDrafted = picks.filter(
                (row) => row.fantasy_team_id === team.id
              ).length;

              return (
                <article key={team.id} className="g365-results-team-card">
                  <header>
                    <div>
                      <span>{team.is_cpu ? "CPU TEAM" : "TEAM"}</span>
                      <h3>{team.team_name}</h3>
                    </div>
                    <div className="g365-results-team-count">
                      <strong>{teamRoster.length}</strong>
                      <span>ROSTERED</span>
                    </div>
                  </header>

                  <div className="g365-results-team-summary">
                    <span><strong>{teamKeepers}</strong> Keepers</span>
                    <span><strong>{teamDrafted}</strong> Drafted</span>
                  </div>

                  <div className="g365-results-roster-list">
                    {teamRoster.length === 0 ? (
                      <div className="g365-results-inline-empty">
                        No target-season roster players found.
                      </div>
                    ) : (
                      teamRoster.map((roster) => {
                        const player = playerById.get(roster.nhl_player_id);
                        const key = `${team.id}:${roster.nhl_player_id}`;

                        const acquisition =
                          keeperIds.has(key)
                            ? "KEEPER"
                            : draftedIds.has(key)
                              ? "DRAFTED"
                              : pretty(roster.acquired_via).toUpperCase();

                        return (
                          <div
                            key={`${team.id}-${roster.nhl_player_id}`}
                            className="g365-results-roster-row"
                          >
                            <div className="g365-results-roster-pos">
                              {positionLabel(player)}
                            </div>

                            <PlayerAvatar player={player} small />

                            <div className="g365-results-roster-player">
                              <div className="g365-results-player-name">
                                <strong>{player?.display_name ?? "Unknown Player"}</strong>
                                {player ? (
                                  <NhlInjuryBadge
                                    status={player.injury_status}
                                    detail={player.injury_detail}
                                    returnDate={player.injury_return_date}
                                    source={player.injury_source}
                                  />
                                ) : null}
                              </div>
                              <span>
                                {player?.jersey_number
                                  ? `#${player.jersey_number} · `
                                  : ""}
                                {pretty(roster.roster_status)}
                              </span>
                            </div>

                            <span
                              className={`g365-results-acquisition ${
                                acquisition === "KEEPER"
                                  ? "keeper"
                                  : acquisition === "DRAFTED"
                                    ? "drafted"
                                    : ""
                              }`}
                            >
                              {acquisition}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <div className="g365-results-footer-actions">
          <Link href={`/league/${leagueId}/nhl`} className="g365-results-secondary">
            League Home
          </Link>
          <Link
            href={`/league/${leagueId}/nhl/offseason/draft-results?season=${draftSeason}`}
            className="g365-results-primary"
          >
            {draftSeason} Draft Results
          </Link>
        </div>
      </section>
    </main>
  );
}

function ResultStat({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="g365-results-stat">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

function PlayerAvatar({
  player,
  small = false,
}: {
  player: PlayerRow | undefined;
  small?: boolean;
}) {
  if (player?.headshot_url) {
    return (
      <img
        className={`g365-results-avatar${small ? " small" : ""}`}
        src={player.headshot_url}
        alt=""
      />
    );
  }

  return (
    <div className={`g365-results-avatar fallback${small ? " small" : ""}`}>
      {String(player?.display_name ?? "?").charAt(0).toUpperCase()}
    </div>
  );
}

const styles = `
  .g365-results-page,
  .g365-results-page * { box-sizing: border-box; }

  .g365-results-page {
    min-height: calc(100vh - 140px);
    padding: 30px 18px 64px;
    color: #fff;
    background:
      radial-gradient(circle at 50% 0%, rgba(255,72,0,.09), transparent 34%);
  }

  .g365-results-shell {
    width: min(1320px, 100%);
    margin: 0 auto;
    display: grid;
    gap: 20px;
  }

  .g365-results-hero {
    min-height: 170px;
    padding: 25px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 24px;
    border: 1px solid rgba(255,101,0,.24);
    border-radius: 16px;
    background:
      linear-gradient(135deg, rgba(180,20,20,.19), rgba(255,78,0,.07) 48%, rgba(8,8,10,.97));
  }

  .g365-results-hero h1,
  .g365-results-heading h2,
  .g365-results-team-card h3,
  .g365-results-empty h2 { margin: 6px 0 0; }

  .g365-results-hero h1 {
    font-size: clamp(32px, 6vw, 50px);
    font-weight: 950;
    line-height: 1;
  }

  .g365-results-hero p:not(.g365-results-eyebrow) {
    max-width: 720px;
    margin: 12px 0 0;
    color: #969ca6;
    font-size: 12px;
    line-height: 1.55;
  }

  .g365-results-eyebrow {
    margin: 0;
    color: #ff7426;
    font-size: 9px;
    font-weight: 950;
    letter-spacing: .14em;
  }

  .g365-results-season {
    width: 142px;
    min-width: 142px;
    min-height: 112px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 7px;
    border: 1px solid rgba(255,111,31,.26);
    border-radius: 14px;
    background: rgba(0,0,0,.26);
  }

  .g365-results-season span,
  .g365-results-season small {
    color: #858b95;
    font-size: 8px;
    font-weight: 900;
    letter-spacing: .08em;
  }

  .g365-results-season strong { font-size: 30px; }
  .g365-results-season small { color: #ff7b2c; }

  .g365-results-stats {
    display: grid;
    grid-template-columns: repeat(4, minmax(0,1fr));
    gap: 10px;
  }

  .g365-results-stat {
    min-height: 104px;
    padding: 14px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 7px;
    border: 1px solid rgba(255,255,255,.08);
    border-radius: 12px;
    background: linear-gradient(180deg, rgba(22,23,27,.97), rgba(10,11,13,.98));
    text-align: center;
  }

  .g365-results-stat span,
  .g365-results-stat small {
    color: #838994;
    font-size: 8px;
    font-weight: 900;
  }

  .g365-results-stat strong {
    font-size: 19px;
    font-weight: 950;
  }

  .g365-results-section,
  .g365-results-empty {
    padding: 22px;
    border: 1px solid rgba(255,255,255,.08);
    border-radius: 16px;
    background: linear-gradient(180deg, rgba(17,18,21,.96), rgba(9,10,12,.98));
  }

  .g365-results-heading {
    margin-bottom: 17px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
  }

  .g365-results-heading h2 { font-size: 23px; }

  .g365-results-complete-pill {
    padding: 7px 10px;
    border: 1px solid rgba(34,197,94,.35);
    border-radius: 999px;
    color: #5ee27d;
    background: rgba(34,197,94,.08);
    font-size: 8px;
    font-weight: 950;
  }

  .g365-results-rounds { display: grid; gap: 15px; }

  .g365-results-round {
    overflow: hidden;
    border: 1px solid rgba(255,255,255,.07);
    border-radius: 13px;
    background: rgba(0,0,0,.18);
  }

  .g365-results-round-title {
    padding: 12px 14px;
    display: flex;
    align-items: center;
    gap: 8px;
    border-bottom: 1px solid rgba(255,255,255,.07);
    background: linear-gradient(90deg, rgba(185,28,28,.12), rgba(234,88,12,.05));
  }

  .g365-results-round-title span {
    color: #8b919b;
    font-size: 8px;
    font-weight: 950;
  }

  .g365-results-round-title strong {
    color: #ff7b2c;
    font-size: 18px;
  }

  .g365-results-pick-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0,1fr));
  }

  .g365-results-pick {
    min-width: 0;
    padding: 13px;
    display: grid;
    grid-template-columns: 56px minmax(0,1fr) minmax(100px,.55fr);
    align-items: center;
    gap: 11px;
    border-right: 1px solid rgba(255,255,255,.05);
    border-bottom: 1px solid rgba(255,255,255,.05);
  }

  .g365-results-pick-number {
    display: grid;
    gap: 3px;
  }

  .g365-results-pick-number span {
    color: #ff7b2c;
    font-size: 16px;
    font-weight: 950;
  }

  .g365-results-pick-number small,
  .g365-results-player span,
  .g365-results-pick-team span,
  .g365-results-roster-player span {
    color: #7e858f;
    font-size: 8px;
  }

  .g365-results-player {
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 9px;
  }

  .g365-results-player > div:last-child { min-width: 0; }

  .g365-results-player-name {
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .g365-results-player-name strong {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 11px;
  }

  .g365-results-avatar {
    width: 38px;
    height: 38px;
    flex: 0 0 auto;
    object-fit: cover;
    border: 1px solid rgba(255,112,35,.22);
    border-radius: 50%;
    background: #15161a;
  }

  .g365-results-avatar.small {
    width: 30px;
    height: 30px;
  }

  .g365-results-avatar.fallback {
    display: flex;
    align-items: center;
    justify-content: center;
    color: #ff7b2c;
    font-size: 13px;
    font-weight: 950;
  }

  .g365-results-pick-team {
    min-width: 0;
    display: grid;
    gap: 4px;
    text-align: right;
  }

  .g365-results-pick-team strong {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 9px;
  }

  .g365-results-team-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0,1fr));
    gap: 12px;
  }

  .g365-results-team-card {
    min-width: 0;
    overflow: hidden;
    border: 1px solid rgba(255,255,255,.08);
    border-radius: 13px;
    background: rgba(0,0,0,.2);
  }

  .g365-results-team-card > header {
    padding: 14px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    border-bottom: 1px solid rgba(255,255,255,.07);
    background: linear-gradient(90deg, rgba(185,28,28,.11), rgba(234,88,12,.04));
  }

  .g365-results-team-card header span {
    color: #838994;
    font-size: 8px;
    font-weight: 900;
  }

  .g365-results-team-card h3 {
    font-size: 17px;
    font-weight: 950;
  }

  .g365-results-team-count {
    display: grid;
    text-align: right;
  }

  .g365-results-team-count strong {
    color: #ff7b2c;
    font-size: 20px;
  }

  .g365-results-team-summary {
    padding: 10px 14px;
    display: flex;
    gap: 14px;
    border-bottom: 1px solid rgba(255,255,255,.06);
    color: #858b95;
    font-size: 9px;
  }

  .g365-results-team-summary strong { color: #fff; }

  .g365-results-roster-list { display: grid; }

  .g365-results-roster-row {
    min-width: 0;
    padding: 9px 12px;
    display: grid;
    grid-template-columns: 38px 30px minmax(0,1fr) auto;
    align-items: center;
    gap: 8px;
    border-bottom: 1px solid rgba(255,255,255,.045);
  }

  .g365-results-roster-pos {
    color: #ff7b2c;
    font-size: 9px;
    font-weight: 950;
  }

  .g365-results-roster-player { min-width: 0; }

  .g365-results-acquisition {
    padding: 5px 7px;
    border: 1px solid rgba(255,255,255,.1);
    border-radius: 999px;
    color: #8d949e;
    font-size: 7px;
    font-weight: 950;
    letter-spacing: .05em;
  }

  .g365-results-acquisition.keeper {
    border-color: rgba(255,113,40,.3);
    color: #ff8a3d;
    background: rgba(255,92,0,.06);
  }

  .g365-results-acquisition.drafted {
    border-color: rgba(239,68,68,.3);
    color: #ff6666;
    background: rgba(239,68,68,.06);
  }

  .g365-results-inline-empty {
    padding: 20px;
    color: #777e89;
    font-size: 10px;
    text-align: center;
  }

  .g365-results-empty {
    min-height: 350px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
  }

  .g365-results-empty-icon {
    width: 58px;
    height: 58px;
    margin-bottom: 15px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid rgba(255,112,35,.28);
    border-radius: 15px;
    color: #ff7b2c;
    background: rgba(255,92,0,.06);
    font-size: 16px;
    font-weight: 950;
  }

  .g365-results-empty h2 { font-size: 25px; }

  .g365-results-empty > p:not(.g365-results-eyebrow) {
    max-width: 600px;
    margin: 10px auto 0;
    color: #858b95;
    font-size: 11px;
    line-height: 1.55;
  }

  .g365-results-actions,
  .g365-results-footer-actions {
    display: flex;
    justify-content: flex-end;
    gap: 9px;
  }

  .g365-results-actions { margin-top: 20px; }

  .g365-results-primary,
  .g365-results-secondary {
    min-height: 42px;
    padding: 0 14px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 9px;
    font-size: 9px;
    font-weight: 950;
    text-decoration: none;
    text-transform: uppercase;
  }

  .g365-results-primary {
    border: 1px solid rgba(255,111,31,.48);
    color: #fff;
    background: linear-gradient(135deg, #b91c1c, #ea580c);
  }

  .g365-results-secondary {
    border: 1px solid rgba(255,112,35,.3);
    color: #ff8338;
    background: rgba(255,92,0,.05);
  }

  @media (max-width: 900px) {
    .g365-results-pick-grid,
    .g365-results-team-grid { grid-template-columns: 1fr; }
  }

  @media (max-width: 700px) {
    .g365-results-page {
      padding: 18px 12px max(44px, env(safe-area-inset-bottom));
    }

    .g365-results-hero {
      min-height: 0;
      padding: 18px;
      align-items: stretch;
      flex-direction: column;
    }

    .g365-results-season {
      width: 100%;
      min-width: 0;
      min-height: 76px;
      flex-direction: row;
      justify-content: flex-start;
      padding: 12px;
    }

    .g365-results-stats {
      grid-template-columns: repeat(2, minmax(0,1fr));
    }

    .g365-results-section { padding: 14px; }

    .g365-results-pick {
      grid-template-columns: 45px minmax(0,1fr);
    }

    .g365-results-pick-team {
      grid-column: 2;
      text-align: left;
    }

    .g365-results-roster-row {
      grid-template-columns: 32px 28px minmax(0,1fr) auto;
      padding: 9px 8px;
      gap: 6px;
    }

    .g365-results-actions,
    .g365-results-footer-actions {
      align-items: stretch;
      flex-direction: column;
    }

    .g365-results-primary,
    .g365-results-secondary { width: 100%; }
  }

  @media (max-width: 420px) {
    .g365-results-stat strong { font-size: 15px; }
    .g365-results-acquisition { padding: 4px 5px; font-size: 6px; }
  }
`;
