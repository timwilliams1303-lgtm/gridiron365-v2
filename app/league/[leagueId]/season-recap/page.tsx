"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useParams } from "next/navigation";

type Team = {
  fantasy_team_id: number;
  team_name: string;
  regular_season_rank: number | null;
  playoff_seed: number | null;
  final_finish: number | null;
  wins: number;
  losses: number;
  ties: number;
  points_for: number;
  points_against: number;
  points_per_game: number;
  highest_week_score: number | null;
  highest_week: number | null;
  longest_win_streak: number;
  playoff_wins: number;
  playoff_losses: number;
  made_playoffs: boolean;
  won_championship: boolean;
  runner_up: boolean;
  lineup_efficiency: number | null;
  bench_points: number | null;
  waiver_adds: number;
  waiver_claims: number;
  trades_completed: number;
  roster_moves: number;
  luck_score: number | null;
  schedule_strength: number | null;
  consistency_score: number | null;
  volatility_score: number | null;
  clutch_score: number | null;
  draft_score: number | null;
  waiver_score: number | null;
  trade_score: number | null;
  lineup_management_score: number | null;
  offense_score: number | null;
  team_personality_title: string | null;
  team_mvp_name: string | null;
  best_draft_pick_name: string | null;
  best_waiver_pickup_name: string | null;
  best_trade_acquisition_name: string | null;
  biggest_surprise_name: string | null;
  biggest_disappointment_name: string | null;
  playoff_mvp_name: string | null;
  recap_headline: string | null;
  recap_summary: string | null;
  recap_story: Record<string, unknown>;
};

type Player = {
  nfl_player_id: number;
  player_name: string;
  position: string | null;
  nfl_team_abbreviation: string | null;
  fantasy_points: number;
  fantasy_points_per_game: number | null;
  games_played: number;
  league_player_rank: number | null;
  positional_rank: number | null;
  games_25_plus: number;
  games_40_plus: number;
  season_high_score: number | null;
  season_high_week: number | null;
  drafted: boolean;
  draft_round: number | null;
  draft_overall_pick: number | null;
  original_team_name: string | null;
  final_team_name: string | null;
  waiver_adds: number;
  trades: number;
  consistency_score: number | null;
  value_score: number | null;
  league_impact_score: number | null;
  recap_headline: string | null;
  recap_summary: string | null;
};

type Badge = {
  fantasy_team_id?: number;
  nfl_player_id?: number;
  badge_key: string;
  badge_value: number | null;
  name: string;
  description: string;
  category: string;
  rarity: string;
  tier: string;
  icon: string | null;
};

type Award = {
  award_key: string;
  award_name: string;
  recipient_type: string;
  fantasy_team_id: number | null;
  nfl_player_id: number | null;
  recipient_name: string;
  award_value: number | null;
  headline: string | null;
  description: string | null;
};

type Highlight = {
  week: number | null;
  season_phase: string | null;
  highlight_key: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  value: number | null;
};

type RecordRow = {
  record_key: string;
  record_name: string;
  record_scope: string;
  value: number;
  value_display: string | null;
  season: number;
  week: number | null;
  holder_name: string;
  opponent_name: string | null;
};

type Payload = {
  success: boolean;
  generated: boolean;
  season: number;
  readiness?: {
    ready?: boolean;
    phase?: string;
    season_complete?: boolean;
    season_result_exists?: boolean;
    unfinalized_regular_matchups?: number;
    unfinalized_playoff_matchups?: number;
  };
  viewer?: { user_id: string; fantasy_team_id: number | null };
  league?: {
    league_name: string;
    champion_team_name: string | null;
    runner_up_team_name: string | null;
    regular_season_champion_team_name: string | null;
    total_teams: number;
    total_matchups: number;
    total_transactions: number;
    total_trades: number;
    total_waiver_claims: number;
    total_fantasy_points: number;
  };
  teams?: Team[];
  players?: Player[];
  awards?: Award[];
  highlights?: Highlight[];
  team_badges?: Badge[];
  player_badges?: Badge[];
  records?: RecordRow[];
};

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const NAV = [
  ["overview", "Overview"],
  ["your-season", "Your Season"],
  ["teams", "Teams"],
  ["awards", "Awards"],
  ["badges", "Badges"],
  ["players", "Players"],
  ["draft", "Draft"],
  ["transactions", "Transactions"],
  ["playoffs", "Playoffs"],
] as const;

function number(value: unknown, digits = 1) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n.toFixed(digits) : "0.0";
}

function score(value: unknown) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "—";
  return Math.max(0, Math.min(100, n)).toFixed(0);
}

function ordinal(value: number | null) {
  if (!value) return "—";
  const n = value;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  if (n % 10 === 1) return `${n}st`;
  if (n % 10 === 2) return `${n}nd`;
  if (n % 10 === 3) return `${n}rd`;
  return `${n}th`;
}

export default function SeasonRecapPage() {
  const params = useParams<{ leagueId: string }>();
  const leagueId = params.leagueId;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<Payload | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
  const [playerSearch, setPlayerSearch] = useState("");
  const refs = useRef<Record<string, HTMLElement | null>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const leagueResult = await supabase
      .from("leagues")
      .select("season")
      .eq("id", leagueId)
      .single();

    if (leagueResult.error) {
      setError(leagueResult.error.message);
      setLoading(false);
      return;
    }

    const currentSeason = Number(leagueResult.data.season);

    const recapResult = await supabase.rpc("get_traditional_season_recap", {
      p_league_id: leagueId,
      p_season: currentSeason,
    });

    if (recapResult.error) {
      setError(recapResult.error.message);
      setLoading(false);
      return;
    }

    const data = recapResult.data as Payload;
    setPayload(data);
    setSelectedTeamId(
      data.viewer?.fantasy_team_id ??
        data.teams?.[0]?.fantasy_team_id ??
        null
    );
    setLoading(false);
  }, [leagueId]);

  useEffect(() => {
    void load();
  }, [load]);

  const teams = payload?.teams ?? [];
  const players = payload?.players ?? [];
  const teamBadges = payload?.team_badges ?? [];
  const playerBadges = payload?.player_badges ?? [];

  const selectedTeam = useMemo(
    () => teams.find((t) => t.fantasy_team_id === selectedTeamId) ?? null,
    [teams, selectedTeamId]
  );

  const myTeam = useMemo(
    () =>
      teams.find(
        (t) => t.fantasy_team_id === payload?.viewer?.fantasy_team_id
      ) ?? null,
    [teams, payload?.viewer?.fantasy_team_id]
  );

  const selectedTeamBadges = useMemo(
    () => teamBadges.filter((b) => b.fantasy_team_id === selectedTeamId),
    [teamBadges, selectedTeamId]
  );

  const filteredPlayers = useMemo(() => {
    const q = playerSearch.trim().toLowerCase();
    return players
      .filter((p) =>
        !q ||
        `${p.player_name} ${p.position ?? ""} ${p.nfl_team_abbreviation ?? ""}`
          .toLowerCase()
          .includes(q)
      )
      .slice(0, 40);
  }, [players, playerSearch]);

  function jump(id: string) {
    refs.current[id]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (loading) {
    return (
      <main style={styles.page}>
        <div style={styles.loading}>
          <div style={styles.brand}>G365</div>
          <div>Building your season story…</div>
        </div>
      </main>
    );
  }

  if (error || !payload) {
    return (
      <main style={styles.page}>
        <div style={styles.shell}>
          <div style={styles.error}>{error ?? "Unable to load season recap."}</div>
        </div>
      </main>
    );
  }

  if (!payload.generated) {
    const r = payload.readiness;
    return (
      <main style={styles.page}>
        <div style={styles.shell}>
          <section style={styles.notReady}>
            <div style={styles.eyebrow}>GRIDIRON365 • {payload.season} SEASON RECAP</div>
            <h1 style={styles.title}>YOUR STORY IS STILL BEING WRITTEN</h1>
            <p style={styles.copy}>
              The full recap unlocks after the championship is final and the season
              archive is generated.
            </p>
            <div style={styles.statGrid}>
              <Stat label="Phase" value={r?.phase ?? "—"} />
              <Stat label="Season Complete" value={r?.season_complete ? "YES" : "NOT YET"} />
              <Stat label="Final Result" value={r?.season_result_exists ? "RECORDED" : "WAITING"} />
              <Stat
                label="Open Matchups"
                value={String(
                  Number(r?.unfinalized_regular_matchups ?? 0) +
                    Number(r?.unfinalized_playoff_matchups ?? 0)
                )}
              />
            </div>
          </section>
        </div>
      </main>
    );
  }

  const league = payload.league!;

  return (
    <main style={styles.page}>
      <div style={styles.shell}>
        <nav style={styles.recapNav}>
          {NAV.map(([id, label]) => (
            <button key={id} type="button" onClick={() => jump(id)} style={styles.navButton}>
              {label}
            </button>
          ))}
          <Link href={`/league/${leagueId}/history`} style={styles.historyLink}>
            League History →
          </Link>
        </nav>

        <section ref={(el) => { refs.current.overview = el; }} style={styles.hero}>
          <div style={styles.heroGlow} />
          <div style={styles.eyebrow}>GRIDIRON365 • {payload.season} SEASON RECAP</div>
          <div style={styles.trophy}>🏆</div>
          <h1 style={styles.title}>{league.champion_team_name}</h1>
          <div style={styles.championPill}>LEAGUE CHAMPION</div>
          <p style={styles.copy}>
            {league.league_name} has written another chapter. This is the complete
            story of the season — the champion, the chaos, the steals, the heartbreak,
            the badges and the players who defined it.
          </p>

          <div style={styles.statGrid}>
            <Stat label="Teams" value={String(league.total_teams)} />
            <Stat label="Matchups" value={String(league.total_matchups)} />
            <Stat label="Fantasy Points" value={number(league.total_fantasy_points)} />
            <Stat label="Transactions" value={String(league.total_transactions)} />
            <Stat label="Trades" value={String(league.total_trades)} />
            <Stat label="Waivers Won" value={String(league.total_waiver_claims)} />
          </div>
        </section>

        <Section title="FINAL PODIUM" subtitle="The teams that reached the top.">
          <div style={styles.podium}>
            {teams.slice(0, 3).map((team, index) => (
              <div key={team.fantasy_team_id} style={{...styles.podiumCard,...(index===0?styles.podiumChampion:{})}}>
                <div style={styles.podiumIcon}>{index===0?"🏆":index===1?"🥈":"🥉"}</div>
                <strong style={styles.podiumName}>{team.team_name}</strong>
                <span style={styles.muted}>
                  {team.wins}-{team.losses}{team.ties?`-${team.ties}`:""} • {number(team.points_for)} PTS
                </span>
              </div>
            ))}
          </div>
        </Section>

        <section ref={(el) => { refs.current["your-season"] = el; }} style={styles.section}>
          <SectionHeader title="YOUR SEASON" subtitle="Your personal Gridiron365 yearbook." />
          {myTeam ? (
            <TeamStory team={myTeam} badges={teamBadges.filter((b)=>b.fantasy_team_id===myTeam.fantasy_team_id)} />
          ) : (
            <Empty text="You do not have an archived fantasy team for this season." />
          )}
        </section>

        <section ref={(el) => { refs.current.teams = el; }} style={styles.section}>
          <SectionHeader title="TEAM STORIES" subtitle="Every roster gets its own identity and season DNA." />
          <div style={styles.teamTabs}>
            {teams.map((team)=>(
              <button
                key={team.fantasy_team_id}
                type="button"
                onClick={()=>setSelectedTeamId(team.fantasy_team_id)}
                style={{...styles.teamTab,...(selectedTeamId===team.fantasy_team_id?styles.teamTabActive:{})}}
              >
                #{team.final_finish ?? team.regular_season_rank ?? "—"} {team.team_name}
              </button>
            ))}
          </div>
          {selectedTeam ? <TeamStory team={selectedTeam} badges={selectedTeamBadges} /> : null}
        </section>

        <section ref={(el) => { refs.current.awards = el; }} style={styles.section}>
          <SectionHeader title="SEASON AWARDS" subtitle="The performances and stories everyone will remember." />
          <div style={styles.cardGrid}>
            {(payload.awards ?? []).map((award)=>(
              <div key={award.award_key} style={styles.awardCard}>
                <div style={styles.awardStar}>★</div>
                <div style={styles.eyebrow}>{award.award_name}</div>
                <strong style={styles.cardTitle}>{award.recipient_name}</strong>
                {award.headline ? <div style={styles.awardHeadline}>{award.headline}</div> : null}
                {award.description ? <p style={styles.muted}>{award.description}</p> : null}
              </div>
            ))}
          </div>
        </section>

        <section ref={(el) => { refs.current.badges = el; }} style={styles.section}>
          <SectionHeader title="BADGE VAULT" subtitle={`${teamBadges.length + playerBadges.length} achievements earned this season.`} />
          <div style={styles.badgeVault}>
            {teamBadges.map((badge, i)=>(
              <BadgeCard key={`t-${badge.badge_key}-${badge.fantasy_team_id}-${i}`} badge={badge} />
            ))}
            {playerBadges.map((badge, i)=>(
              <BadgeCard key={`p-${badge.badge_key}-${badge.nfl_player_id}-${i}`} badge={badge} />
            ))}
          </div>
        </section>

        <section ref={(el) => { refs.current.players = el; }} style={styles.section}>
          <SectionHeader title="PLAYER YEARBOOK" subtitle={`${players.length} league-relevant player stories captured.`} />
          <input
            value={playerSearch}
            onChange={(e)=>setPlayerSearch(e.target.value)}
            placeholder="Search player, position or NFL team…"
            style={styles.search}
          />
          <div style={styles.playerGrid}>
            {filteredPlayers.map((p)=>(
              <div key={p.nfl_player_id} style={styles.playerCard}>
                <div style={styles.playerTop}>
                  <div>
                    <div style={styles.eyebrow}>#{p.league_player_rank ?? "—"} OVERALL</div>
                    <strong style={styles.playerName}>{p.player_name}</strong>
                    <div style={styles.muted}>{p.position ?? "—"} • {p.nfl_team_abbreviation ?? "FA"}</div>
                  </div>
                  <div style={styles.playerPoints}>{number(p.fantasy_points)}</div>
                </div>
                <div style={styles.playerMeta}>
                  <span>{number(p.fantasy_points_per_game)} PPG</span>
                  <span>{p.games_25_plus} × 25+</span>
                  <span>{p.games_40_plus} × 40+</span>
                  <span>{p.season_high_score ? `${number(p.season_high_score)} HIGH` : "—"}</span>
                </div>
                {p.recap_headline ? <div style={styles.playerHeadline}>{p.recap_headline}</div> : null}
                <div style={styles.miniBadges}>
                  {playerBadges
                    .filter((b)=>b.nfl_player_id===p.nfl_player_id)
                    .map((b)=>(
                      <span key={b.badge_key} style={styles.miniBadge}>{b.icon ?? "◆"} {b.name}</span>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section ref={(el) => { refs.current.draft = el; }} style={styles.section}>
          <SectionHeader title="DRAFT REPORT" subtitle="Who crushed draft night — and which picks changed the league." />
          <div style={styles.cardGrid}>
            {teams
              .slice()
              .sort((a,b)=>Number(b.draft_score ?? 0)-Number(a.draft_score ?? 0))
              .slice(0,6)
              .map((team, index)=>(
                <div key={team.fantasy_team_id} style={styles.rankCard}>
                  <div style={styles.rankNumber}>#{index+1}</div>
                  <strong>{team.team_name}</strong>
                  <div style={styles.bigMetric}>{score(team.draft_score)}</div>
                  <div style={styles.muted}>DRAFT SCORE</div>
                  <div style={styles.featureLine}>Best Pick: <strong>{team.best_draft_pick_name ?? "—"}</strong></div>
                </div>
              ))}
          </div>
        </section>

        <section ref={(el) => { refs.current.transactions = el; }} style={styles.section}>
          <SectionHeader title="FRONT OFFICE REPORT" subtitle="Waivers, trades and roster management." />
          <div style={styles.cardGrid}>
            {teams.map((team)=>(
              <div key={team.fantasy_team_id} style={styles.frontOfficeCard}>
                <strong style={styles.cardTitle}>{team.team_name}</strong>
                <div style={styles.dnaMini}>
                  <DNABar label="Waivers" value={team.waiver_score} />
                  <DNABar label="Trades" value={team.trade_score} />
                  <DNABar label="Management" value={team.lineup_management_score} />
                </div>
                <div style={styles.featureLine}>Waiver Star: <strong>{team.best_waiver_pickup_name ?? "—"}</strong></div>
                <div style={styles.featureLine}>{team.trades_completed} trades • {team.roster_moves} roster moves</div>
              </div>
            ))}
          </div>
        </section>

        <section ref={(el) => { refs.current.playoffs = el; }} style={styles.section}>
          <SectionHeader title="PLAYOFF STORY" subtitle="The path to the championship." />
          <div style={styles.timeline}>
            {(payload.highlights ?? []).map((h,index)=>(
              <div key={`${h.highlight_key}-${index}`} style={styles.timelineItem}>
                <div style={styles.timelineDot}/>
                <div>
                  <div style={styles.eyebrow}>{h.week ? `WEEK ${h.week}` : (h.season_phase ?? "SEASON")}</div>
                  <strong style={styles.timelineTitle}>{h.title}</strong>
                  {h.subtitle ? <div style={styles.timelineSub}>{h.subtitle}</div> : null}
                  {h.description ? <p style={styles.muted}>{h.description}</p> : null}
                </div>
              </div>
            ))}
          </div>
        </section>

        <Section title="RECORD BOOK" subtitle="The all-time marks this season helped shape.">
          <div style={styles.recordGrid}>
            {(payload.records ?? []).map((r)=>(
              <div key={r.record_key} style={styles.recordCard}>
                <div style={styles.eyebrow}>{r.record_name}</div>
                <strong style={styles.recordValue}>{r.value_display ?? number(r.value)}</strong>
                <div style={styles.recordHolder}>{r.holder_name}</div>
                <div style={styles.muted}>{r.season}{r.week?` • Week ${r.week}`:""}{r.opponent_name?` • vs ${r.opponent_name}`:""}</div>
              </div>
            ))}
          </div>
        </Section>
      </div>
    </main>
  );
}

function TeamStory({team,badges}:{team:Team;badges:Badge[]}) {
  const dna = [
    ["Offense",team.offense_score],
    ["Consistency",team.consistency_score],
    ["Draft",team.draft_score],
    ["Waivers",team.waiver_score],
    ["Trades",team.trade_score],
    ["Management",team.lineup_management_score],
    ["Clutch",team.clutch_score],
  ] as const;

  return (
    <div style={styles.teamStory}>
      <div style={styles.teamStoryTop}>
        <div>
          <div style={styles.personality}>{team.team_personality_title ?? "THE COMPETITOR"}</div>
          <h3 style={styles.teamName}>{team.team_name}</h3>
          <p style={styles.copy}>{team.recap_headline}</p>
        </div>
        <div style={styles.finish}>{team.won_championship?"🏆 CHAMPION":ordinal(team.final_finish)}</div>
      </div>

      <div style={styles.statGrid}>
        <Stat label="Record" value={`${team.wins}-${team.losses}${team.ties?`-${team.ties}`:""}`} />
        <Stat label="Points" value={number(team.points_for)} />
        <Stat label="PPG" value={number(team.points_per_game)} />
        <Stat label="Best Week" value={team.highest_week_score?`${number(team.highest_week_score)} • W${team.highest_week}`:"—"} />
        <Stat label="Win Streak" value={String(team.longest_win_streak)} />
        <Stat label="Luck" value={team.luck_score===null?"—":number(team.luck_score,2)} />
      </div>

      <div style={styles.dnaBlock}>
        <div style={styles.dnaTitle}>SEASON DNA</div>
        <div style={styles.dnaGrid}>
          {dna.map(([label,value])=><DNABar key={label} label={label} value={value}/>)}
        </div>
      </div>

      <div style={styles.featureGrid}>
        <Feature label="Team MVP" value={team.team_mvp_name} />
        <Feature label="Best Draft Pick" value={team.best_draft_pick_name} />
        <Feature label="Best Waiver Pickup" value={team.best_waiver_pickup_name} />
        <Feature label="Best Trade Acquisition" value={team.best_trade_acquisition_name} />
        <Feature label="Biggest Surprise" value={team.biggest_surprise_name} />
        <Feature label="Biggest Disappointment" value={team.biggest_disappointment_name} />
      </div>

      {team.recap_summary ? <p style={styles.story}>{team.recap_summary}</p> : null}

      <div style={styles.badgeRow}>
        {badges.length ? badges.map((badge)=><BadgeCard key={badge.badge_key} badge={badge}/>) : <Empty text="No season badges earned." />}
      </div>
    </div>
  );
}

function DNABar({label,value}:{label:string;value:number|null}) {
  const v = Math.max(0,Math.min(100,Number(value ?? 0)));
  return (
    <div>
      <div style={styles.dnaLabel}><span>{label}</span><strong>{value===null?"—":v.toFixed(0)}</strong></div>
      <div style={styles.barTrack}><div style={{...styles.barFill,width:`${v}%`}}/></div>
    </div>
  );
}

function Feature({label,value}:{label:string;value:string|null}) {
  return <div style={styles.feature}><span style={styles.statLabel}>{label}</span><strong>{value ?? "—"}</strong></div>;
}

function BadgeCard({badge}:{badge:Badge}) {
  return (
    <div style={styles.badgeCard}>
      <span style={styles.badgeIcon}>{badge.icon ?? "◆"}</span>
      <div>
        <div style={styles.badgeTier}>{badge.tier.toUpperCase()} • {badge.rarity.toUpperCase()}</div>
        <strong>{badge.name}</strong>
        <div style={styles.badgeDescription}>{badge.description}</div>
      </div>
    </div>
  );
}

function Section({title,subtitle,children}:{title:string;subtitle?:string;children:React.ReactNode}) {
  return <section style={styles.section}><SectionHeader title={title} subtitle={subtitle}/>{children}</section>;
}

function SectionHeader({title,subtitle}:{title:string;subtitle?:string}) {
  return <div style={styles.sectionHead}><div style={styles.eyebrow}>GRIDIRON365</div><h2 style={styles.sectionTitle}>{title}</h2>{subtitle?<p style={styles.sectionSub}>{subtitle}</p>:null}</div>;
}

function Stat({label,value}:{label:string;value:string}) {
  return <div style={styles.stat}><span style={styles.statLabel}>{label}</span><strong style={styles.statValue}>{value}</strong></div>;
}

function Empty({text}:{text:string}) {
  return <div style={styles.empty}>{text}</div>;
}

const styles: Record<string, React.CSSProperties> = {
  page:{minHeight:"100vh",background:"radial-gradient(circle at 50% -12%,rgba(255,79,0,.18),transparent 28%),#070707",color:"#fff",fontFamily:"Inter,system-ui,sans-serif"},
  shell:{width:"min(1450px,calc(100% - 28px))",margin:"0 auto",padding:"18px 0 70px"},
  recapNav:{position:"sticky",top:0,zIndex:30,display:"flex",gap:7,overflowX:"auto",alignItems:"center",padding:"10px",marginBottom:14,border:"1px solid rgba(255,255,255,.08)",borderRadius:13,background:"rgba(8,8,8,.94)",backdropFilter:"blur(14px)"},
  navButton:{flex:"0 0 auto",border:"1px solid rgba(255,255,255,.07)",background:"#101010",color:"#aaa",padding:"9px 11px",borderRadius:9,fontSize:10,fontWeight:900,cursor:"pointer"},
  historyLink:{marginLeft:"auto",flex:"0 0 auto",color:"#ff702a",textDecoration:"none",fontSize:10,fontWeight:950},
  hero:{position:"relative",overflow:"hidden",textAlign:"center",padding:"68px 24px 48px",border:"1px solid rgba(255,101,17,.22)",borderRadius:24,background:"linear-gradient(145deg,rgba(115,8,4,.43),rgba(13,13,13,.97) 56%,rgba(67,25,0,.40))"},
  heroGlow:{position:"absolute",inset:"-40%",background:"radial-gradient(circle,rgba(255,95,0,.17),transparent 38%)",pointerEvents:"none"},
  eyebrow:{color:"#ff6b24",fontSize:10,fontWeight:950,letterSpacing:".12em",textTransform:"uppercase"},
  trophy:{fontSize:70,margin:"17px 0 5px"},
  title:{fontSize:"clamp(38px,6vw,74px)",lineHeight:.96,letterSpacing:"-.05em",textTransform:"uppercase",margin:"7px 0"},
  championPill:{display:"inline-block",padding:"8px 14px",borderRadius:999,background:"linear-gradient(90deg,#c81710,#ff7900)",fontSize:11,fontWeight:950},
  copy:{maxWidth:780,margin:"14px auto 0",color:"#999",lineHeight:1.65},
  statGrid:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:8,marginTop:22},
  stat:{padding:13,border:"1px solid rgba(255,255,255,.07)",borderRadius:10,background:"rgba(255,255,255,.02)"},
  statLabel:{display:"block",color:"#777",fontSize:9,fontWeight:950,textTransform:"uppercase",letterSpacing:".07em",marginBottom:5},
  statValue:{fontSize:20},
  section:{marginTop:18,padding:21,border:"1px solid rgba(255,255,255,.08)",borderRadius:17,background:"rgba(12,12,12,.94)",scrollMarginTop:76},
  sectionHead:{marginBottom:16},
  sectionTitle:{fontSize:"clamp(24px,3vw,36px)",margin:"4px 0 0",letterSpacing:"-.035em"},
  sectionSub:{color:"#777",margin:"5px 0 0"},
  podium:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(210px,1fr))",gap:10},
  podiumCard:{padding:20,border:"1px solid rgba(255,255,255,.07)",borderRadius:14,background:"#090909",display:"grid",gap:5},
  podiumChampion:{border:"1px solid rgba(255,107,20,.4)",background:"linear-gradient(145deg,rgba(132,14,6,.24),#0a0a0a)"},
  podiumIcon:{fontSize:34},
  podiumName:{fontSize:20},
  muted:{color:"#777",fontSize:11,lineHeight:1.5},
  teamTabs:{display:"flex",gap:7,overflowX:"auto",paddingBottom:8},
  teamTab:{flex:"0 0 auto",padding:"10px 12px",border:"1px solid rgba(255,255,255,.07)",borderRadius:9,background:"#090909",color:"#999",fontWeight:850,cursor:"pointer"},
  teamTabActive:{color:"#fff",border:"1px solid rgba(255,105,20,.48)",background:"rgba(112,17,5,.22)"},
  teamStory:{marginTop:12,padding:19,border:"1px solid rgba(255,96,15,.17)",borderRadius:14,background:"linear-gradient(145deg,rgba(84,8,4,.18),#090909)"},
  teamStoryTop:{display:"flex",justifyContent:"space-between",gap:16,alignItems:"flex-start",flexWrap:"wrap"},
  personality:{color:"#ff6b22",fontSize:11,fontWeight:1000,letterSpacing:".1em"},
  teamName:{fontSize:34,margin:"4px 0 0"},
  finish:{padding:"8px 11px",borderRadius:999,border:"1px solid rgba(255,255,255,.09)",background:"#141414",fontWeight:950,fontSize:11},
  dnaBlock:{marginTop:20,padding:16,borderRadius:12,border:"1px solid rgba(255,255,255,.07)",background:"#080808"},
  dnaTitle:{fontSize:11,fontWeight:950,letterSpacing:".1em",color:"#ff6b22",marginBottom:13},
  dnaGrid:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:12},
  dnaMini:{display:"grid",gap:10,marginTop:13},
  dnaLabel:{display:"flex",justifyContent:"space-between",gap:10,fontSize:10,color:"#999",fontWeight:850},
  barTrack:{height:7,borderRadius:999,background:"#1b1b1b",overflow:"hidden",marginTop:5},
  barFill:{height:"100%",borderRadius:999,background:"linear-gradient(90deg,#c9160e,#ff7700)"},
  featureGrid:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:8,marginTop:16},
  feature:{padding:12,border:"1px solid rgba(255,255,255,.07)",borderRadius:10,background:"#080808"},
  featureLine:{marginTop:9,color:"#888",fontSize:11},
  story:{color:"#aaa",lineHeight:1.7,marginTop:18},
  badgeRow:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:8,marginTop:16},
  badgeVault:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:8},
  badgeCard:{display:"grid",gridTemplateColumns:"42px 1fr",gap:10,padding:12,border:"1px solid rgba(255,255,255,.07)",borderRadius:11,background:"#090909"},
  badgeIcon:{fontSize:28},
  badgeTier:{color:"#ff6f29",fontSize:8,fontWeight:950,letterSpacing:".08em",marginBottom:3},
  badgeDescription:{color:"#707070",fontSize:10,lineHeight:1.4,marginTop:3},
  cardGrid:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(225px,1fr))",gap:9},
  awardCard:{padding:16,border:"1px solid rgba(255,255,255,.07)",borderRadius:12,background:"#090909"},
  awardStar:{fontSize:21,color:"#ff6c23"},
  cardTitle:{display:"block",fontSize:18,marginTop:5},
  awardHeadline:{color:"#bbb",lineHeight:1.45,marginTop:8,fontSize:12},
  search:{width:"100%",boxSizing:"border-box",padding:"12px 13px",borderRadius:10,border:"1px solid rgba(255,255,255,.09)",background:"#080808",color:"#fff",outline:"none",marginBottom:12},
  playerGrid:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(250px,1fr))",gap:8},
  playerCard:{padding:15,border:"1px solid rgba(255,255,255,.07)",borderRadius:12,background:"#090909"},
  playerTop:{display:"flex",justifyContent:"space-between",gap:10},
  playerName:{display:"block",fontSize:17,marginTop:3},
  playerPoints:{fontSize:23,fontWeight:1000},
  playerMeta:{display:"flex",gap:6,flexWrap:"wrap",fontSize:9,color:"#777",fontWeight:850,marginTop:11},
  playerHeadline:{marginTop:11,color:"#ccc",fontSize:12,lineHeight:1.45},
  miniBadges:{display:"flex",gap:5,flexWrap:"wrap",marginTop:10},
  miniBadge:{fontSize:9,padding:"4px 6px",borderRadius:999,border:"1px solid rgba(255,103,20,.18)",background:"rgba(255,103,20,.08)",color:"#eab098"},
  rankCard:{padding:16,border:"1px solid rgba(255,255,255,.07)",borderRadius:12,background:"#090909"},
  rankNumber:{color:"#ff6b22",fontSize:10,fontWeight:950},
  bigMetric:{fontSize:35,fontWeight:1000,marginTop:9},
  frontOfficeCard:{padding:16,border:"1px solid rgba(255,255,255,.07)",borderRadius:12,background:"#090909"},
  timeline:{display:"grid",gap:11},
  timelineItem:{display:"grid",gridTemplateColumns:"15px 1fr",gap:10},
  timelineDot:{width:8,height:8,borderRadius:999,background:"#ff6822",marginTop:4,boxShadow:"0 0 16px rgba(255,104,34,.5)"},
  timelineTitle:{fontSize:16},
  timelineSub:{color:"#aaa",fontSize:11,marginTop:2},
  recordGrid:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:8},
  recordCard:{padding:15,border:"1px solid rgba(255,255,255,.07)",borderRadius:11,background:"#090909"},
  recordValue:{display:"block",fontSize:26,marginTop:6},
  recordHolder:{fontWeight:900,marginTop:5},
  notReady:{textAlign:"center",padding:"72px 24px",border:"1px solid rgba(255,255,255,.08)",borderRadius:20,background:"#0b0b0b"},
  loading:{minHeight:"74vh",display:"grid",placeContent:"center",textAlign:"center",gap:8,color:"#777"},
  brand:{fontSize:42,fontWeight:1000,letterSpacing:"-.07em",background:"linear-gradient(90deg,#cd160e,#ff7600)",WebkitBackgroundClip:"text",color:"transparent"},
  error:{padding:15,color:"#ff8c83",border:"1px solid rgba(255,80,80,.25)",borderRadius:10},
  empty:{padding:14,color:"#777",border:"1px dashed rgba(255,255,255,.1)",borderRadius:10},
};