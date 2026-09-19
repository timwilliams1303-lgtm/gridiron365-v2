import Link from "next/link";

import Card from "@/components/ui/Card";
import { requireLeagueMember } from "@/lib/leagues/requireLeagueMember";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type NhlTraditionalMyTeamProps = {
  leagueId: string;
};

type NhlSettingsRow = {
  league_format: string | null;
  position_mode: string | null;
  lineup_period: string | null;
  allow_daily_lineup_changes: boolean | null;
  player_lock_mode: string | null;
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

type FantasyTeamRow = {
  id: number;
  team_name: string | null;
  owner_id: string | null;
  active: boolean | null;
};

type RosterRow = {
  id: number;
  fantasy_team_id: number;
  nhl_player_id: number;
  roster_status: string | null;
  acquired_via: string | null;
  acquired_at: string | null;
};

type StandingRow = {
  fantasy_team_id: number;
  wins: number | null;
  losses: number | null;
  ties: number | null;
  points_for: number | string | null;
  points_against: number | string | null;
  rank: number | null;
};

type SeasonStateRow = {
  active_week: number | null;
  phase: string | null;
  regular_season_complete: boolean | null;
  playoffs_started: boolean | null;
  season_complete: boolean | null;
};

type LineupRow = {
  id: number;
  nhl_player_id: number;
  lineup_slot: string | null;
  slot_index: number | null;
  lineup_date: string | null;
  nhl_game_id: number | null;
  game_start_at: string | null;
  is_locked: boolean | null;
};

function asNumber(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);

  return Number.isFinite(parsed) ? parsed : 0;
}

function formatPoints(value: number | string | null | undefined) {
  return asNumber(value).toFixed(2);
}

function titleCase(value: string | null | undefined) {
  if (!value) {
    return "—";
  }

  return value
    .replaceAll("_", " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export default async function NhlTraditionalMyTeam({
  leagueId,
}: NhlTraditionalMyTeamProps) {
  const access = await requireLeagueMember(leagueId);

  if (String(access.league.leagueType) !== "nhl_traditional") {
    throw new Error(
      "This page is only available for NHL Traditional leagues."
    );
  }

  const fantasyTeamId = access.fantasyTeam?.id ?? null;

  if (fantasyTeamId == null) {
    return (
      <main className="g365-nhl-my-team-page">
        <style>{baseStyles}</style>

        <section className="g365-nhl-my-team-shell">
          <Card>
            <div className="g365-nhl-empty">
              <span className="g365-nhl-eyebrow">
                NHL TRADITIONAL
              </span>

              <h1>No Fantasy Team Assigned</h1>

              <p>
                Your league membership is active, but you do not currently
                have an NHL fantasy team assigned to your account.
              </p>

              <Link
                href={`/league/${leagueId}/nhl`}
                className="g365-nhl-button g365-nhl-button-secondary"
              >
                ← League Home
              </Link>
            </div>
          </Card>
        </section>
      </main>
    );
  }

  const supabase = await createSupabaseServerClient();
  const season = Number(access.league.season);

  const [
    settingsResult,
    rosterSettingsResult,
    teamResult,
    rosterResult,
    standingResult,
    seasonStateResult,
    lineupResult,
  ] = await Promise.all([
    supabase
      .from("nhl_traditional_settings")
      .select(
        "league_format, position_mode, lineup_period, allow_daily_lineup_changes, player_lock_mode"
      )
      .eq("league_id", leagueId)
      .maybeSingle(),

    supabase
      .from("nhl_traditional_roster_settings")
      .select(
        "starting_c, starting_lw, starting_rw, starting_d, starting_g, starting_util, starting_f, bench_slots, ir_slots"
      )
      .eq("league_id", leagueId)
      .maybeSingle(),

    supabase
      .from("fantasy_teams")
      .select("id, team_name, owner_id, active")
      .eq("id", fantasyTeamId)
      .eq("league_id", leagueId)
      .maybeSingle(),

    supabase
      .from("nhl_traditional_rosters")
      .select(
        "id, fantasy_team_id, nhl_player_id, roster_status, acquired_via, acquired_at"
      )
      .eq("league_id", leagueId)
      .eq("fantasy_team_id", fantasyTeamId)
      .eq("season", season)
      .is("dropped_at", null)
      .order("id", {
        ascending: true,
      }),

    supabase
      .from("nhl_traditional_standings")
      .select(
        "fantasy_team_id, wins, losses, ties, points_for, points_against, rank"
      )
      .eq("league_id", leagueId)
      .eq("season", season)
      .eq("fantasy_team_id", fantasyTeamId)
      .maybeSingle(),

    supabase
      .from("nhl_traditional_season_state")
      .select(
        "active_week, phase, regular_season_complete, playoffs_started, season_complete"
      )
      .eq("league_id", leagueId)
      .eq("season", season)
      .maybeSingle(),

    supabase
      .from("nhl_traditional_weekly_lineups")
      .select(
        "id, nhl_player_id, lineup_slot, slot_index, lineup_date, nhl_game_id, game_start_at, is_locked"
      )
      .eq("league_id", leagueId)
      .eq("fantasy_team_id", fantasyTeamId)
      .eq("season", season)
      .order("lineup_slot", {
        ascending: true,
      })
      .order("slot_index", {
        ascending: true,
      }),
  ]);

  if (settingsResult.error) {
    throw new Error(
      `Unable to load NHL league settings: ${settingsResult.error.message}`
    );
  }

  if (rosterSettingsResult.error) {
    throw new Error(
      `Unable to load NHL roster settings: ${rosterSettingsResult.error.message}`
    );
  }

  if (teamResult.error) {
    throw new Error(
      `Unable to load your NHL fantasy team: ${teamResult.error.message}`
    );
  }

  if (rosterResult.error) {
    throw new Error(
      `Unable to load your NHL roster: ${rosterResult.error.message}`
    );
  }

  if (standingResult.error) {
    throw new Error(
      `Unable to load your NHL standing: ${standingResult.error.message}`
    );
  }

  if (seasonStateResult.error) {
    throw new Error(
      `Unable to load NHL season state: ${seasonStateResult.error.message}`
    );
  }

  if (lineupResult.error) {
    throw new Error(
      `Unable to load your NHL lineup: ${lineupResult.error.message}`
    );
  }

  const settings = settingsResult.data as NhlSettingsRow | null;

  const rosterSettings =
    rosterSettingsResult.data as RosterSettingsRow | null;

  const team = teamResult.data as FantasyTeamRow | null;

  const roster = (rosterResult.data ?? []) as RosterRow[];

  const standing = standingResult.data as StandingRow | null;

  const seasonState =
    seasonStateResult.data as SeasonStateRow | null;

  const lineupRows = (lineupResult.data ?? []) as LineupRow[];

  if (!settings) {
    throw new Error(
      "NHL Traditional league settings are missing."
    );
  }

  if (!rosterSettings) {
    throw new Error(
      "NHL Traditional roster settings are missing."
    );
  }

  if (!team) {
    throw new Error(
      "Your NHL fantasy team could not be found."
    );
  }

  const leagueFormat = String(
    settings.league_format ?? "redraft"
  );

  const positionMode = String(
    settings.position_mode ?? "detailed"
  );

  const formatLabel =
    leagueFormat === "dynasty"
      ? "NHL DYNASTY"
      : "NHL REDRAFT";

  const positionLabel =
    positionMode === "fdg"
      ? "F / D / G"
      : "C / LW / RW / D / G / UTIL";

  const activeWeek = Number(
    seasonState?.active_week ?? 1
  );

  const wins = Number(
    standing?.wins ?? 0
  );

  const losses = Number(
    standing?.losses ?? 0
  );

  const ties = Number(
    standing?.ties ?? 0
  );

  const activeRoster = roster.filter(
    (row) =>
      String(
        row.roster_status ?? ""
      ).toLowerCase() !== "ir"
  );

  const irRoster = roster.filter(
    (row) =>
      String(
        row.roster_status ?? ""
      ).toLowerCase() === "ir"
  );

  const lineupByPlayer =
    new Map<number, LineupRow>();

  for (const row of lineupRows) {
    lineupByPlayer.set(
      Number(row.nhl_player_id),
      row
    );
  }

  const starterSlots =
    positionMode === "fdg"
      ? [
          {
            label: "F",
            count: Number(
              rosterSettings.starting_f ?? 0
            ),
          },
          {
            label: "D",
            count: Number(
              rosterSettings.starting_d ?? 0
            ),
          },
          {
            label: "G",
            count: Number(
              rosterSettings.starting_g ?? 0
            ),
          },
          {
            label: "UTIL",
            count: Number(
              rosterSettings.starting_util ?? 0
            ),
          },
        ]
      : [
          {
            label: "C",
            count: Number(
              rosterSettings.starting_c ?? 0
            ),
          },
          {
            label: "LW",
            count: Number(
              rosterSettings.starting_lw ?? 0
            ),
          },
          {
            label: "RW",
            count: Number(
              rosterSettings.starting_rw ?? 0
            ),
          },
          {
            label: "D",
            count: Number(
              rosterSettings.starting_d ?? 0
            ),
          },
          {
            label: "G",
            count: Number(
              rosterSettings.starting_g ?? 0
            ),
          },
          {
            label: "UTIL",
            count: Number(
              rosterSettings.starting_util ?? 0
            ),
          },
        ];

  const totalStartingSlots =
    starterSlots.reduce(
      (total, slot) =>
        total + slot.count,
      0
    );

  const lockedPlayers =
    lineupRows.filter(
      (row) => row.is_locked
    ).length;

  return (
    <main className="g365-nhl-my-team-page">
      <style>{baseStyles}</style>

      <section className="g365-nhl-my-team-shell">
        <header className="g365-nhl-my-team-header">
          <div>
            <p className="g365-nhl-eyebrow">
              {formatLabel}
            </p>

            <h1 className="g365-nhl-page-title">
              My Team
            </h1>

            <p className="g365-nhl-page-subtitle">
              {access.league.name}
              {" • "}
              {season}
              {" • "}
              {positionLabel}
            </p>
          </div>

          <div className="g365-nhl-header-actions">
            <Link
              href={`/league/${leagueId}/nhl`}
              className="g365-nhl-button g365-nhl-button-secondary"
            >
              ← League Home
            </Link>

            <Link
              href={`/league/${leagueId}/nhl/teams`}
              className="g365-nhl-button g365-nhl-button-secondary"
            >
              Teams
            </Link>

            {access.isCommissioner ? (
              <Link
                href={`/league/${leagueId}/nhl/commissioner`}
                className="g365-nhl-button g365-nhl-button-primary"
              >
                Commissioner
              </Link>
            ) : null}
          </div>
        </header>

        <section className="g365-nhl-team-hero">
          <div className="g365-nhl-team-hero-content">
            <p className="g365-nhl-small-label">
              YOUR NHL TEAM
            </p>

            <h2>
              {team.team_name ?? "My NHL Team"}
            </h2>

            <p>
              {leagueFormat === "dynasty"
                ? "Dynasty"
                : "Redraft"}
              {" • "}
              {titleCase(settings.lineup_period)}
              {" Lineups • Week "}
              {activeWeek}
            </p>
          </div>

          <div className="g365-nhl-rank">
            <span>RANK</span>

            <strong>
              {standing?.rank != null
                ? `#${standing.rank}`
                : "—"}
            </strong>
          </div>
        </section>

        <section className="g365-nhl-summary-grid">
          <SummaryCard
            label="RECORD"
            value={`${wins}-${losses}-${ties}`}
            detail={`Week ${activeWeek}`}
          />

          <SummaryCard
            label="POINTS FOR"
            value={formatPoints(
              standing?.points_for
            )}
            detail="Season total"
          />

          <SummaryCard
            label="ROSTER"
            value={String(roster.length)}
            detail={`${activeRoster.length} active • ${irRoster.length} IR`}
          />

          <SummaryCard
            label="STARTING SLOTS"
            value={String(
              totalStartingSlots
            )}
            detail={`${Number(
              rosterSettings.bench_slots ?? 0
            )} bench • ${Number(
              rosterSettings.ir_slots ?? 0
            )} IR`}
          />
        </section>

        <section className="g365-nhl-content-grid">
          <Card>
            <div className="g365-nhl-card-content">
              <div className="g365-nhl-section-header">
                <div className="g365-nhl-section-title-block">
                  <p className="g365-nhl-small-label">
                    LINEUP STRUCTURE
                  </p>

                  <h2>
                    Starting Lineup
                  </h2>
                </div>

                <span className="g365-nhl-pill">
                  {positionMode === "fdg"
                    ? "F / D / G"
                    : "Detailed"}
                </span>
              </div>

              <div className="g365-nhl-slot-grid">
                {starterSlots
                  .filter(
                    (slot) =>
                      slot.count > 0
                  )
                  .map((slot) => (
                    <div
                      key={slot.label}
                      className="g365-nhl-slot"
                    >
                      <span>
                        {slot.label}
                      </span>

                      <strong>
                        {slot.count}
                      </strong>
                    </div>
                  ))}
              </div>

              <div className="g365-nhl-info-list">
                <InfoRow
                  label="Lineup Period"
                  value={titleCase(
                    settings.lineup_period
                  )}
                />

                <InfoRow
                  label="Daily Changes"
                  value={
                    settings.allow_daily_lineup_changes
                      ? "Allowed"
                      : "Disabled"
                  }
                />

                <InfoRow
                  label="Player Lock"
                  value={titleCase(
                    settings.player_lock_mode
                  )}
                />

                <InfoRow
                  label="Locked Players"
                  value={String(
                    lockedPlayers
                  )}
                />
              </div>
            </div>
          </Card>

          <Card>
            <div className="g365-nhl-card-content">
              <div className="g365-nhl-section-header g365-nhl-section-header-centered">
                <div className="g365-nhl-section-title-block">
                  <p className="g365-nhl-small-label">
                    SEASON STATUS
                  </p>

                  <h2>
                    Team Snapshot
                  </h2>
                </div>
              </div>

              <div className="g365-nhl-info-list">
                <InfoRow
                  label="Phase"
                  value={titleCase(
                    seasonState?.phase
                  )}
                />

                <InfoRow
                  label="Active Week"
                  value={String(
                    activeWeek
                  )}
                />

                <InfoRow
                  label="Points Against"
                  value={formatPoints(
                    standing?.points_against
                  )}
                />

                <InfoRow
                  label="Playoffs Started"
                  value={
                    seasonState?.playoffs_started
                      ? "Yes"
                      : "No"
                  }
                />

                <InfoRow
                  label="Season Complete"
                  value={
                    seasonState?.season_complete
                      ? "Yes"
                      : "No"
                  }
                />
              </div>
            </div>
          </Card>
        </section>

        <section>
          <div className="g365-nhl-section-heading">
            <div className="g365-nhl-section-title-block">
              <p className="g365-nhl-small-label">
                CURRENT OWNERSHIP
              </p>

              <h2>
                My Roster
              </h2>
            </div>

            <span className="g365-nhl-pill">
              {roster.length} PLAYER
              {roster.length === 1
                ? ""
                : "S"}
            </span>
          </div>

          {roster.length === 0 ? (
            <Card>
              <div className="g365-nhl-empty">
                <strong>
                  Your roster is empty
                </strong>

                <p>
                  Players will appear here after the NHL draft or after
                  they are added through league transactions.
                </p>
              </div>
            </Card>
          ) : (
            <div className="g365-nhl-roster-grid">
              {roster.map(
                (row) => {
                  const lineup =
                    lineupByPlayer.get(
                      Number(
                        row.nhl_player_id
                      )
                    );

                  const isIr =
                    String(
                      row.roster_status ?? ""
                    ).toLowerCase() === "ir";

                  return (
                    <Card key={row.id}>
                      <div className="g365-nhl-player-card">
                        <div className="g365-nhl-player-top">
                          <div className="g365-nhl-player-heading">
                            <span
                              className={
                                isIr
                                  ? "g365-nhl-status g365-nhl-status-ir"
                                  : "g365-nhl-status"
                              }
                            >
                              {isIr
                                ? "IR"
                                : lineup?.lineup_slot
                                  ? String(
                                      lineup.lineup_slot
                                    ).toUpperCase()
                                  : "ROSTER"}
                            </span>

                            <h3>
                              Player #{row.nhl_player_id}
                            </h3>
                          </div>

                          {lineup?.is_locked ? (
                            <span className="g365-nhl-lock">
                              LOCKED
                            </span>
                          ) : null}
                        </div>

                        <div className="g365-nhl-info-list">
                          <InfoRow
                            label="NHL Player ID"
                            value={String(
                              row.nhl_player_id
                            )}
                          />

                          <InfoRow
                            label="Roster Status"
                            value={titleCase(
                              row.roster_status
                            )}
                          />

                          <InfoRow
                            label="Acquired Via"
                            value={titleCase(
                              row.acquired_via
                            )}
                          />

                          <InfoRow
                            label="Acquired"
                            value={formatDate(
                              row.acquired_at
                            )}
                          />

                          <InfoRow
                            label="Lineup Slot"
                            value={
                              lineup?.lineup_slot
                                ? String(
                                    lineup.lineup_slot
                                  ).toUpperCase()
                                : "Not Assigned"
                            }
                          />
                        </div>
                      </div>
                    </Card>
                  );
                }
              )}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}

function SummaryCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <Card>
      <div className="g365-nhl-summary-card">
        <span>
          {label}
        </span>

        <strong>
          {value}
        </strong>

        <small>
          {detail}
        </small>
      </div>
    </Card>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="g365-nhl-info-row">
      <span>
        {label}
      </span>

      <strong>
        {value}
      </strong>
    </div>
  );
}

const baseStyles = `
  .g365-nhl-my-team-page,
  .g365-nhl-my-team-page * {
    box-sizing: border-box;
  }

  .g365-nhl-my-team-page {
    min-height: calc(100vh - 140px);
    padding: 32px 18px 60px;
    color: #ffffff;
    background:
      radial-gradient(
        circle at 50% 0%,
        rgba(255, 72, 0, 0.07),
        transparent 35%
      );
  }

  .g365-nhl-my-team-shell {
    width: min(1240px, 100%);
    margin: 0 auto;
    display: grid;
    gap: 26px;
  }

  .g365-nhl-my-team-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
    flex-wrap: wrap;
  }

  .g365-nhl-eyebrow,
  .g365-nhl-small-label {
    margin: 0;
    color: #ff7a18;
    font-size: 9px;
    font-weight: 900;
    letter-spacing: 0.13em;
    line-height: 1.2;
  }

  .g365-nhl-page-title {
    margin: 7px 0 0;
    color: #ffffff;
    font-size: clamp(30px, 5vw, 42px);
    line-height: 1.05;
  }

  .g365-nhl-page-subtitle {
    margin: 8px 0 0;
    color: #9298a3;
    font-size: 13px;
    line-height: 1.4;
  }

  .g365-nhl-header-actions {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 9px;
    flex-wrap: wrap;
  }

  .g365-nhl-button {
    min-height: 42px;
    padding: 0 14px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 9px;
    font-size: 10px;
    font-weight: 900;
    line-height: 1;
    letter-spacing: 0.04em;
    text-align: center;
    text-decoration: none;
    text-transform: uppercase;
  }

  .g365-nhl-button-secondary {
    border: 1px solid rgba(255, 122, 24, 0.28);
    background: rgba(255, 90, 20, 0.06);
    color: #ff8a3d;
  }

  .g365-nhl-button-primary {
    border: 1px solid rgba(255, 92, 0, 0.55);
    background:
      linear-gradient(
        135deg,
        #d91d1d,
        #ff4b00,
        #ff7900
      );
    color: #ffffff;
  }

  .g365-nhl-team-hero {
    min-height: 150px;
    padding: 24px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 22px;
    border: 1px solid rgba(255, 101, 0, 0.18);
    border-radius: 14px;
    background:
      linear-gradient(
        135deg,
        rgba(207, 24, 24, 0.12),
        rgba(255, 76, 0, 0.055) 45%,
        rgba(8, 8, 8, 0.96)
      );
  }

  .g365-nhl-team-hero-content {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }

  .g365-nhl-team-hero h2 {
    margin: 7px 0 0;
    color: #ffffff;
    font-size: clamp(24px, 4vw, 34px);
    line-height: 1.1;
  }

  .g365-nhl-team-hero p:not(.g365-nhl-small-label) {
    margin: 8px 0 0;
    color: #8e949e;
    font-size: 11px;
    line-height: 1.4;
  }

  .g365-nhl-rank {
    width: 80px;
    min-width: 80px;
    height: 80px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 7px;
    border: 1px solid rgba(255, 123, 24, 0.2);
    border-radius: 12px;
    background: rgba(255, 92, 0, 0.05);
    text-align: center;
  }

  .g365-nhl-rank span {
    margin: 0;
    color: #858b95;
    font-size: 8px;
    font-weight: 900;
    line-height: 1;
    letter-spacing: 0.09em;
  }

  .g365-nhl-rank strong {
    margin: 0;
    color: #ffffff;
    font-size: 25px;
    line-height: 1;
  }

  .g365-nhl-summary-grid {
    display: grid;
    grid-template-columns:
      repeat(4, minmax(0, 1fr));
    gap: 14px;
    align-items: stretch;
  }

  .g365-nhl-summary-grid > * {
    min-width: 0;
    height: 100%;
  }

  .g365-nhl-summary-card {
    width: 100%;
    min-height: 120px;
    height: 100%;
    padding: 12px 8px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    text-align: center;
  }

  .g365-nhl-summary-card > span {
    margin: 0;
    color: #858b95;
    font-size: 9px;
    font-weight: 900;
    line-height: 1;
    letter-spacing: 0.1em;
    text-align: center;
  }

  .g365-nhl-summary-card > strong {
    margin: 0;
    color: #ffffff;
    font-size: 28px;
    font-weight: 900;
    line-height: 1;
    text-align: center;
  }

  .g365-nhl-summary-card > small {
    margin: 0;
    color: #858b95;
    font-size: 10px;
    line-height: 1.25;
    text-align: center;
  }

  .g365-nhl-content-grid {
    display: grid;
    grid-template-columns:
      minmax(0, 1.25fr)
      minmax(300px, 0.75fr);
    gap: 15px;
    align-items: stretch;
  }

  .g365-nhl-content-grid > * {
    min-width: 0;
    height: 100%;
  }

  .g365-nhl-card-content {
    width: 100%;
    min-width: 0;
    min-height: 100%;
    padding: 8px 4px;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
  }

  .g365-nhl-section-header {
    width: 100%;
    min-height: 64px;
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: 12px;
  }

  .g365-nhl-section-header .g365-nhl-section-title-block {
    grid-column: 2;
    min-width: 0;
    text-align: center;
  }

  .g365-nhl-section-header > .g365-nhl-pill {
    grid-column: 3;
    justify-self: end;
  }

  .g365-nhl-section-header-centered {
    grid-template-columns: 1fr;
  }

  .g365-nhl-section-header-centered .g365-nhl-section-title-block {
    grid-column: 1;
    justify-self: center;
  }

  .g365-nhl-section-title-block {
    min-width: 0;
    text-align: center;
  }

  .g365-nhl-section-title-block .g365-nhl-small-label {
    text-align: center;
  }

  .g365-nhl-section-header h2,
  .g365-nhl-section-heading h2 {
    margin: 6px 0 0;
    color: #ffffff;
    font-size: 20px;
    line-height: 1.15;
    text-align: center;
  }

  .g365-nhl-section-heading {
    min-height: 60px;
    margin-bottom: 13px;
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: 12px;
  }

  .g365-nhl-section-heading .g365-nhl-section-title-block {
    grid-column: 2;
  }

  .g365-nhl-section-heading > .g365-nhl-pill {
    grid-column: 3;
    justify-self: end;
  }

  .g365-nhl-pill {
    min-height: 28px;
    padding: 0 9px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid rgba(255, 119, 0, 0.18);
    border-radius: 7px;
    background: rgba(255, 119, 0, 0.06);
    color: #ff8a20;
    font-size: 8px;
    font-weight: 900;
    line-height: 1;
    letter-spacing: 0.07em;
    text-align: center;
  }

  .g365-nhl-slot-grid {
    width: 100%;
    margin-top: 18px;
    display: grid;
    grid-template-columns:
      repeat(auto-fit, minmax(80px, 1fr));
    gap: 8px;
  }

  .g365-nhl-slot {
    width: 100%;
    min-width: 0;
    min-height: 78px;
    padding: 10px 6px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    border: 1px solid rgba(255, 255, 255, 0.065);
    border-radius: 9px;
    background: rgba(255, 255, 255, 0.018);
    text-align: center;
  }

  .g365-nhl-slot span {
    margin: 0;
    color: #ff7a18;
    font-size: 9px;
    font-weight: 900;
    line-height: 1;
    text-align: center;
  }

  .g365-nhl-slot strong {
    margin: 0;
    color: #ffffff;
    font-size: 22px;
    font-weight: 900;
    line-height: 1;
    text-align: center;
  }

  .g365-nhl-info-list {
    width: 100%;
    margin-top: 18px;
    display: grid;
  }

  .g365-nhl-info-row {
    width: 100%;
    min-height: 46px;
    padding: 8px 10px;
    display: grid;
    grid-template-columns:
      minmax(0, 1fr)
      minmax(90px, 1fr);
    align-items: center;
    gap: 16px;
    border-bottom:
      1px solid rgba(255, 255, 255, 0.055);
    color: #898f99;
    font-size: 10px;
    line-height: 1.25;
  }

  .g365-nhl-info-row > span {
    display: flex;
    align-items: center;
    min-height: 28px;
  }

  .g365-nhl-info-row > strong {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    min-height: 28px;
    color: #ffffff;
    text-align: right;
  }

  .g365-nhl-roster-grid {
    display: grid;
    grid-template-columns:
      repeat(auto-fit, minmax(290px, 1fr));
    gap: 14px;
    align-items: stretch;
  }

  .g365-nhl-roster-grid > * {
    height: 100%;
  }

  .g365-nhl-player-card {
    width: 100%;
    min-width: 0;
    height: 100%;
    padding: 8px 4px;
  }

  .g365-nhl-player-top {
    min-height: 72px;
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: 12px;
  }

  .g365-nhl-player-heading {
    grid-column: 2;
    min-width: 0;
    text-align: center;
  }

  .g365-nhl-player-top > .g365-nhl-lock {
    grid-column: 3;
    justify-self: end;
  }

  .g365-nhl-player-top h3 {
    margin: 8px 0 0;
    color: #ffffff;
    font-size: 18px;
    line-height: 1.2;
    text-align: center;
  }

  .g365-nhl-status,
  .g365-nhl-lock {
    min-height: 24px;
    padding: 0 8px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 5px;
    background: rgba(255, 92, 0, 0.1);
    color: #ff7a18;
    font-size: 8px;
    font-weight: 900;
    line-height: 1;
    letter-spacing: 0.07em;
    text-align: center;
  }

  .g365-nhl-status-ir {
    background: rgba(255, 255, 255, 0.07);
    color: #a7adb6;
  }

  .g365-nhl-lock {
    background: rgba(255, 255, 255, 0.06);
    color: #9ba1aa;
  }

  .g365-nhl-empty {
    width: 100%;
    min-height: 200px;
    padding: 24px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    text-align: center;
  }

  .g365-nhl-empty h1,
  .g365-nhl-empty strong {
    margin: 0;
    color: #ffffff;
    text-align: center;
  }

  .g365-nhl-empty p {
    max-width: 550px;
    margin: 0;
    color: #858b95;
    font-size: 11px;
    line-height: 1.6;
    text-align: center;
  }

  @media (max-width: 900px) {
    .g365-nhl-summary-grid {
      grid-template-columns:
        repeat(2, minmax(0, 1fr));
    }

    .g365-nhl-content-grid {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 760px) {
    .g365-nhl-my-team-page {
      padding: 18px 10px 44px;
      overflow-x: hidden;
    }

    .g365-nhl-my-team-shell {
      width: 100%;
      min-width: 0;
    }

    .g365-nhl-my-team-header {
      display: grid;
      grid-template-columns: 1fr;
      align-items: stretch;
    }

    .g365-nhl-my-team-header > div:first-child {
      text-align: center;
    }

    .g365-nhl-header-actions {
      width: 100%;
    }

    .g365-nhl-team-hero {
      align-items: center;
    }

    .g365-nhl-roster-grid {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 520px) {
    .g365-nhl-summary-grid {
      grid-template-columns: 1fr;
    }

    .g365-nhl-header-actions {
      display: grid;
      grid-template-columns: 1fr;
    }

    .g365-nhl-header-actions a {
      width: 100%;
      min-height: 44px;
    }

    .g365-nhl-team-hero {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
    }

    .g365-nhl-team-hero-content {
      align-items: center;
      text-align: center;
    }

    .g365-nhl-rank {
      width: 82px;
      min-width: 82px;
    }

    .g365-nhl-section-header,
    .g365-nhl-section-heading {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 10px;
      text-align: center;
    }

    .g365-nhl-section-header .g365-nhl-section-title-block,
    .g365-nhl-section-heading .g365-nhl-section-title-block {
      width: 100%;
    }

    .g365-nhl-section-header > .g365-nhl-pill,
    .g365-nhl-section-heading > .g365-nhl-pill {
      align-self: center;
    }

    .g365-nhl-slot-grid {
      grid-template-columns:
        repeat(2, minmax(0, 1fr));
    }

    .g365-nhl-info-row {
      grid-template-columns:
        minmax(0, 1fr)
        minmax(0, 1fr);
      padding: 10px 6px;
    }

    .g365-nhl-player-top {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 10px;
    }

    .g365-nhl-player-heading {
      text-align: center;
    }
  }

  @media (max-width: 360px) {
    .g365-nhl-slot-grid {
      grid-template-columns: 1fr;
    }
  }
`;