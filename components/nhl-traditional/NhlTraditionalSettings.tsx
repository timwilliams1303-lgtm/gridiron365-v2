"use client";

import { useCallback, useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

type Props = {
  leagueId: string;
};

type LeagueRow = {
  id: string;
  name: string;
  season: number;
  status: string;
  league_type: string;
};

type NhlSettings = {
  league_id: string;
  season: number;
  league_format: "redraft" | "dynasty";
  position_mode: "detailed" | "fdg";
  scoring_system: "points" | "categories";
  goalie_minimum_starts: number;
  competition_format: string;
  lineup_period: string;
  allow_daily_lineup_changes: boolean;
  player_lock_mode: "individual_game";
  max_teams: number;
  regular_season_weeks: number;
  playoff_team_count: number;
  playoff_weeks: number;
  playoff_reseeding: boolean;
  divisions_enabled: boolean;
  division_playoff_mode:
    | "overall"
    | "division_winners_qualify"
    | "division_winners_top_seeds";
  playoff_tiebreaker:
    | "higher_seed"
    | "regular_season_head_to_head"
    | "regular_season_points";
  trade_deadline_at: string | null;
  trade_deadline_week: number | null;
  trade_review_mode: "none" | "commissioner";
  waiver_mode: "rolling" | "reverse_standings" | "faab";
  faab_budget: number | null;
  matchup_acquisition_limit: number | null;
  dynasty_rookie_rounds: number;
  dynasty_future_pick_years: number;
  dynasty_rosters_carry_over: boolean;
  dynasty_protected_players: number;
  dynasty_protection_deadline_week: number | null;
  dynasty_protection_deadline_day: number | null;
  dynasty_protection_deadline_time: string | null;
  dynasty_protection_status:
    | "protection_closed"
    | "protection_open"
    | "protection_locked";
  dynasty_protection_deadline: string | null;
};

type RosterSettings = {
  league_id: string;
  starting_c: number;
  starting_lw: number;
  starting_rw: number;
  starting_f: number;
  starting_d: number;
  starting_g: number;
  starting_util: number;
  bench_slots: number;
  ir_slots: number;
  max_c: number | null;
  max_lw: number | null;
  max_rw: number | null;
  max_f: number | null;
  max_d: number | null;
  max_g: number | null;
};

type ScoringRule = {
  id: number;
  stat_key: string;
  points: number | string;
  enabled: boolean;
};

type CategoryRule = {
  id: number;
  stat_key: string;
  enabled: boolean;
  direction: "higher" | "lower";
};

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const scoringGroups = [
  { title: "SKATER - OFFENSE", keys: ["goal","assist","total_point","shot_on_goal","shooting_percentage","game_winning_goal","two_goal_game","hat_trick","two_point_game","three_point_game","five_shot_game"] },
  { title: "SPECIAL TEAMS", keys: ["power_play_goal","power_play_assist","power_play_point","short_handed_goal","short_handed_assist","short_handed_point","two_power_play_point_game"] },
  { title: "PHYSICAL / DEFENSIVE", keys: ["plus_minus","penalty_minute","hit","blocked_shot","takeaway","giveaway","three_block_game","five_hit_game"] },
  { title: "FACEOFFS & USAGE", keys: ["faceoff_win","faceoff_loss","faceoff_percentage","total_faceoff","shift","time_on_ice"] },
  { title: "GOALTENDING", keys: ["goalie_start","goalie_win","goalie_loss","goalie_overtime_loss","goalie_save","shot_against","goal_against","save_percentage","goals_against_average","shutout","goalie_minutes","goalie_win_percentage","quality_start","quality_start_percentage","goalie_30_save_game","goalie_40_save_game","shutout_win"] },
] as const;

const scoringLabels: Record<string, string> = {
  goal:"Goals", assist:"Assists", total_point:"Total Points", shot_on_goal:"Shots on Goal", shooting_percentage:"Shooting Percentage", game_winning_goal:"Game-Winning Goals",
  power_play_goal:"Power-Play Goals", power_play_assist:"Power-Play Assists", power_play_point:"Power-Play Points", short_handed_goal:"Short-Handed Goals", short_handed_assist:"Short-Handed Assists", short_handed_point:"Short-Handed Points",
  plus_minus:"Plus / Minus", penalty_minute:"Penalty Minutes", hit:"Hits", blocked_shot:"Blocked Shots", takeaway:"Takeaways", giveaway:"Giveaways",
  faceoff_win:"Faceoff Wins", faceoff_loss:"Faceoff Losses", faceoff_percentage:"Faceoff Win Percentage", total_faceoff:"Total Faceoffs", shift:"Shifts", time_on_ice:"Time on Ice",
  goalie_start:"Goalie Starts", goalie_win:"Goalie Wins", goalie_loss:"Goalie Losses", goalie_overtime_loss:"Overtime Losses", goalie_save:"Saves", shot_against:"Shots Against", goal_against:"Goals Against",
  save_percentage:"Save Percentage", goals_against_average:"Goals-Against Average", shutout:"Shutouts", goalie_minutes:"Goalie Minutes Played", goalie_win_percentage:"Goalie Win Percentage",
  quality_start:"G365 Quality Starts", quality_start_percentage:"Quality Start Percentage",
  two_goal_game:"2+ Goal Game", hat_trick:"Hat Trick", two_point_game:"2+ Point Game", three_point_game:"3+ Point Game", five_shot_game:"5+ Shots on Goal",
  three_block_game:"3+ Blocked Shots", five_hit_game:"5+ Hits", two_power_play_point_game:"2+ Power-Play Points", goalie_30_save_game:"30+ Saves", goalie_40_save_game:"40+ Saves", shutout_win:"Shutout Win",
};

function pretty(value?: string | null) {
  return value
    ? value.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase())
    : "—";
}

function yesNo(value: boolean | null | undefined) {
  return value ? "Yes" : "No";
}

function formatDeadline(value: string | null) {
  if (!value) return "None";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function Rule({
  label,
  value,
  note,
}: {
  label: string;
  value: React.ReactNode;
  note?: string;
}) {
  return (
    <div className="g365-setting-rule">
      <div>
        <span>{label}</span>
        {note ? <small>{note}</small> : null}
      </div>
      <strong>{value}</strong>
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="g365-settings-section">
      <div className="g365-settings-section-head">
        <div>
          <p>G365 LEAGUE RULES</p>
          <h2>{title}</h2>
        </div>
        {subtitle ? <span>{subtitle}</span> : null}
      </div>
      <div className="g365-settings-rule-list">{children}</div>
    </section>
  );
}

export default function NhlTraditionalSettings({ leagueId }: Props) {
  const [league, setLeague] = useState<LeagueRow | null>(null);
  const [settings, setSettings] = useState<NhlSettings | null>(null);
  const [roster, setRoster] = useState<RosterSettings | null>(null);
  const [scoringRules, setScoringRules] = useState<ScoringRule[]>([]);
  const [categoryRules, setCategoryRules] = useState<CategoryRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [leagueResult, settingsResult, rosterResult, scoringResult, categoryResult] =
      await Promise.all([
        supabase
          .from("leagues")
          .select("id,name,season,status,league_type")
          .eq("id", leagueId)
          .single(),
        supabase
          .from("nhl_traditional_settings")
          .select("*")
          .eq("league_id", leagueId)
          .single(),
        supabase
          .from("nhl_traditional_roster_settings")
          .select("*")
          .eq("league_id", leagueId)
          .single(),
        supabase
          .from("nhl_traditional_scoring_rules")
          .select("id,stat_key,points,enabled")
          .eq("league_id", leagueId),
        supabase
          .from("nhl_traditional_category_rules")
          .select("id,stat_key,enabled,direction")
          .eq("league_id", leagueId),
      ]);

    const failed = [
      leagueResult,
      settingsResult,
      rosterResult,
      scoringResult,
      categoryResult,
    ].find((result) => result.error);

    if (failed?.error) {
      setError(failed.error.message);
      setLoading(false);
      return;
    }

    setLeague(leagueResult.data as LeagueRow);
    setSettings(settingsResult.data as NhlSettings);
    setRoster(rosterResult.data as RosterSettings);
    setScoringRules((scoringResult.data ?? []) as ScoringRule[]);
    setCategoryRules((categoryResult.data ?? []) as CategoryRule[]);
    setLoading(false);
  }, [leagueId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <main className="g365-settings-page">
        <div className="g365-settings-state">Loading league settings...</div>
        <style jsx>{styles}</style>
      </main>
    );
  }

  if (error || !league || !settings || !roster) {
    return (
      <main className="g365-settings-page">
        <div className="g365-settings-state error">
          <strong>Settings could not be loaded.</strong>
          <span>{error ?? "League settings are unavailable."}</span>
          <button type="button" onClick={() => void load()}>
            RETRY
          </button>
        </div>
        <style jsx>{styles}</style>
      </main>
    );
  }

  const enabledPointRules = scoringRules.filter((rule) => rule.enabled);
  const enabledCategoryRules = categoryRules.filter((rule) => rule.enabled);
  const isDynasty = settings.league_format === "dynasty";

  return (
    <main className="g365-settings-page">
      <header className="g365-settings-hero">
        <div>
          <p className="eyebrow">NHL TRADITIONAL · READ ONLY</p>
          <h1>League Settings</h1>
          <p className="hero-copy">
            The official rules currently configured for {league.name}. Commissioners
            make changes from the Commissioner workspace.
          </p>
        </div>
        <div className="season-badge">
          <span>SEASON</span>
          <strong>{settings.season}</strong>
        </div>
      </header>

      <div className="g365-settings-grid">
        <Section title="League Format">
          <Rule label="League Type" value={pretty(settings.league_format)} />
          <Rule label="Competition" value={pretty(settings.competition_format)} />
          <Rule label="Teams" value={settings.max_teams} />
          <Rule label="Position Mode" value={pretty(settings.position_mode)} />
          <Rule label="Regular Season" value={`${settings.regular_season_weeks} weeks`} />
        </Section>

        <Section title="Roster & Lineup">
          <Rule label="Centers" value={roster.starting_c} />
          <Rule label="Left Wings" value={roster.starting_lw} />
          <Rule label="Right Wings" value={roster.starting_rw} />
          <Rule label="Forwards" value={roster.starting_f} />
          <Rule label="Defensemen" value={roster.starting_d} />
          <Rule label="Goalies" value={roster.starting_g} />
          <Rule label="Utility" value={roster.starting_util} />
          <Rule label="Bench" value={roster.bench_slots} />
          <Rule label="IR" value={roster.ir_slots} />
          <Rule label="Lineup Period" value={pretty(settings.lineup_period)} />
          <Rule
            label="Daily Lineup Changes"
            value={yesNo(settings.allow_daily_lineup_changes)}
          />
          <Rule label="Player Lock" value={pretty(settings.player_lock_mode)} />
        </Section>

        <Section title="Roster Moves & Waivers">
          <Rule label="Waiver Mode" value={pretty(settings.waiver_mode)} />
          {settings.waiver_mode === "faab" ? (
            <Rule
              label="FAAB Budget"
              value={settings.faab_budget == null ? "—" : `$${settings.faab_budget}`}
            />
          ) : null}
          <Rule
            label="Matchup Acquisitions Allowed"
            value={
              settings.matchup_acquisition_limit == null
                ? "Unlimited"
                : settings.matchup_acquisition_limit
            }
            note="Successful free-agent and waiver additions count. Pending same-day pickups reserve a spot."
          />
          <div className="g365-acquisition-rule">
            <strong>HOW ACQUISITIONS COUNT</strong>
            <p>
              A same-day pickup that is dropped before being used in a fantasy lineup
              game does not count. A pickup becomes permanent for the matchup once the
              player remains on the roster into the next league day or appears in a
              fantasy lineup game. Later drops do not refund a counted acquisition.
            </p>
          </div>
        </Section>

        <Section title="Trades">
          <Rule label="Trade Review" value={pretty(settings.trade_review_mode)} />
          <Rule
            label="Trade Deadline Week"
            value={settings.trade_deadline_week ?? "None"}
          />
          <Rule
            label="Trade Deadline"
            value={formatDeadline(settings.trade_deadline_at)}
          />
        </Section>

        <Section title="Playoffs">
          <Rule label="Playoff Teams" value={settings.playoff_team_count} />
          <Rule label="Playoff Weeks" value={settings.playoff_weeks} />
          <Rule label="Reseeding" value={yesNo(settings.playoff_reseeding)} />
          <Rule label="Tiebreaker" value={pretty(settings.playoff_tiebreaker)} />
          <Rule label="Divisions Enabled" value={yesNo(settings.divisions_enabled)} />
          {settings.divisions_enabled ? (
            <Rule
              label="Division Playoff Rule"
              value={pretty(settings.division_playoff_mode)}
            />
          ) : null}
        </Section>

        <Section
          title="Scoring"
          subtitle={settings.scoring_system === "points" ? "POINTS" : "CATEGORIES"}
        >
          <Rule label="Scoring System" value={pretty(settings.scoring_system)} />
          <Rule
            label="Goalie Minimum Starts"
            value={settings.goalie_minimum_starts}
          />

          {settings.scoring_system === "points" ? (
            <div className="g365-scoring-groups">
              {scoringGroups.map((group) => {
                const rows = enabledPointRules.filter((rule) =>
                  (group.keys as readonly string[]).includes(rule.stat_key)
                );
                if (!rows.length) return null;
                return (
                  <div key={group.title} className="g365-scoring-group">
                    <h3>{group.title}</h3>
                    {rows.map((rule) => (
                      <div key={rule.id} className="g365-scoring-row">
                        <span>{scoringLabels[rule.stat_key] ?? pretty(rule.stat_key)}</span>
                        <strong>{Number(rule.points)}</strong>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="g365-scoring-groups">
              <div className="g365-scoring-group">
                <h3>ACTIVE CATEGORIES</h3>
                {enabledCategoryRules.map((rule) => (
                  <div key={rule.id} className="g365-scoring-row">
                    <span>{scoringLabels[rule.stat_key] ?? pretty(rule.stat_key)}</span>
                    <strong>{rule.direction === "lower" ? "LOWER WINS" : "HIGHER WINS"}</strong>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Section>

        {isDynasty ? (
          <Section title="Dynasty">
            <Rule
              label="Protected Players"
              value={settings.dynasty_protected_players}
            />
            <Rule
              label="Annual Draft Rounds"
              value={settings.dynasty_rookie_rounds}
            />
            <Rule
              label="Future Picks Tradable"
              value={`${settings.dynasty_future_pick_years} years`}
            />
            <Rule
              label="Rosters Carry Over"
              value={yesNo(settings.dynasty_rosters_carry_over)}
            />
            <Rule
              label="Protection Status"
              value={pretty(settings.dynasty_protection_status)}
            />
            <Rule
              label="Protection Deadline"
              value={formatDeadline(settings.dynasty_protection_deadline)}
            />
          </Section>
        ) : null}
      </div>

      <div className="g365-readonly-note">
        <strong>READ-ONLY LEAGUE RULEBOOK</strong>
        <span>
          These settings are shown to all league members. Only the commissioner can
          change league configuration.
        </span>
      </div>

      <style jsx>{styles}</style>
    </main>
  );
}

const styles = `
  .g365-settings-page {
    width: 100%;
    min-height: 100vh;
    padding: 18px 14px 44px;
    color: #fff;
    background:
      radial-gradient(circle at 15% 0%, rgba(185, 27, 15, .12), transparent 28%),
      linear-gradient(180deg, #090909 0%, #050505 100%);
  }

  .g365-settings-hero {
    max-width: 1180px;
    margin: 0 auto 14px;
    padding: 18px 20px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 18px;
    border: 1px solid rgba(255, 82, 20, .28);
    border-radius: 16px;
    background: linear-gradient(135deg, rgba(116, 11, 8, .28), rgba(18, 18, 18, .98) 52%);
  }

  .eyebrow,
  .g365-settings-section-head p {
    margin: 0;
    color: #ff6b28;
    font-size: 9px;
    font-weight: 1000;
    letter-spacing: .12em;
  }

  .g365-settings-hero h1 {
    margin: 4px 0 0;
    font-size: clamp(24px, 4vw, 38px);
    line-height: 1;
  }

  .hero-copy {
    max-width: 720px;
    margin: 8px 0 0;
    color: #a7acb4;
    font-size: 12px;
    line-height: 1.5;
  }

  .season-badge {
    min-width: 94px;
    padding: 10px 14px;
    border: 1px solid rgba(255, 110, 35, .3);
    border-radius: 12px;
    background: rgba(255, 83, 15, .07);
    text-align: center;
  }

  .season-badge span {
    display: block;
    color: #8e949d;
    font-size: 8px;
    font-weight: 900;
    letter-spacing: .12em;
  }

  .season-badge strong {
    display: block;
    margin-top: 3px;
    font-size: 20px;
  }

  .g365-settings-grid {
    max-width: 1180px;
    margin: 0 auto;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }

  .g365-settings-section {
    overflow: hidden;
    border: 1px solid #242424;
    border-radius: 14px;
    background: rgba(12, 12, 12, .97);
  }

  .g365-settings-section-head {
    min-height: 58px;
    padding: 12px 14px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    border-bottom: 1px solid #242424;
    background: linear-gradient(90deg, rgba(104, 13, 7, .22), rgba(255,255,255,.015));
  }

  .g365-settings-section-head h2 {
    margin: 3px 0 0;
    font-size: 16px;
  }

  .g365-settings-section-head > span {
    padding: 4px 7px;
    border: 1px solid rgba(255, 106, 32, .25);
    border-radius: 999px;
    color: #ff7a36;
    font-size: 8px;
    font-weight: 900;
    letter-spacing: .08em;
  }

  .g365-settings-rule-list {
    padding: 4px 14px 8px;
  }

  .g365-setting-rule {
    min-height: 42px;
    padding: 8px 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    border-bottom: 1px solid #1d1d1d;
  }

  .g365-setting-rule:last-child {
    border-bottom: 0;
  }

  .g365-setting-rule span {
    display: block;
    color: #b5bac2;
    font-size: 11px;
    font-weight: 700;
  }

  .g365-setting-rule small {
    display: block;
    max-width: 470px;
    margin-top: 3px;
    color: #6f7680;
    font-size: 9px;
    line-height: 1.35;
  }

  .g365-setting-rule strong {
    flex: 0 0 auto;
    color: #fff;
    font-size: 11px;
    text-align: right;
  }

  .g365-acquisition-rule {
    margin: 10px 0 5px;
    padding: 10px 11px;
    border: 1px solid rgba(255, 102, 25, .22);
    border-radius: 10px;
    background: rgba(255, 79, 10, .05);
  }

  .g365-acquisition-rule strong {
    color: #ff7a36;
    font-size: 8px;
    letter-spacing: .1em;
  }

  .g365-acquisition-rule p {
    margin: 5px 0 0;
    color: #9298a2;
    font-size: 10px;
    line-height: 1.45;
  }

  .g365-scoring-groups {
    padding: 8px 0 4px;
    display: grid;
    gap: 8px;
  }

  .g365-scoring-group {
    overflow: hidden;
    border: 1px solid #202020;
    border-radius: 9px;
    background: #090909;
  }

  .g365-scoring-group h3 {
    margin: 0;
    padding: 7px 9px;
    color: #ff742f;
    background: #111;
    font-size: 8px;
    letter-spacing: .09em;
  }

  .g365-scoring-row {
    padding: 6px 9px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    border-top: 1px solid #181818;
  }

  .g365-scoring-row span {
    color: #aeb3bb;
    font-size: 10px;
  }

  .g365-scoring-row strong {
    color: #fff;
    font-size: 10px;
  }

  .g365-readonly-note {
    max-width: 1180px;
    margin: 12px auto 0;
    padding: 10px 12px;
    display: flex;
    align-items: center;
    gap: 10px;
    border: 1px solid #222;
    border-radius: 10px;
    background: #0c0c0c;
  }

  .g365-readonly-note strong {
    color: #ff6b28;
    font-size: 8px;
    letter-spacing: .08em;
  }

  .g365-readonly-note span {
    color: #777e88;
    font-size: 10px;
  }

  .g365-settings-state {
    max-width: 760px;
    margin: 40px auto;
    padding: 18px;
    display: grid;
    gap: 8px;
    border: 1px solid #252525;
    border-radius: 14px;
    background: #0d0d0d;
    color: #c5c9cf;
  }

  .g365-settings-state.error {
    border-color: rgba(255, 67, 35, .35);
  }

  .g365-settings-state button {
    width: fit-content;
    border: 1px solid #ff5b20;
    border-radius: 8px;
    padding: 8px 12px;
    background: #ff3b0a;
    color: #fff;
    font-weight: 900;
    cursor: pointer;
  }

  @media (max-width: 760px) {
    .g365-settings-page {
      padding: 10px 8px 34px;
    }

    .g365-settings-hero {
      padding: 14px;
      align-items: flex-start;
    }

    .season-badge {
      min-width: 76px;
      padding: 8px 9px;
    }

    .g365-settings-grid {
      grid-template-columns: 1fr;
    }

    .g365-setting-rule {
      align-items: flex-start;
    }

    .g365-setting-rule strong {
      max-width: 46%;
    }

    .g365-readonly-note {
      align-items: flex-start;
      flex-direction: column;
      gap: 4px;
    }
  }

  @media (max-width: 430px) {
    .g365-settings-hero {
      display: grid;
      grid-template-columns: 1fr auto;
    }

    .hero-copy {
      grid-column: 1 / -1;
    }

    .g365-settings-section-head {
      min-height: 52px;
    }
  }
`;
