"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useParams } from "next/navigation";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type AnyRow = Record<string, any>;

export default function HistoricalSeasonPage() {
  const params = useParams<{ leagueId: string; season: string }>();
  const leagueId = params.leagueId;
  const season = Number(params.season);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const result = await supabase.rpc("get_traditional_historical_season", {
      p_league_id: leagueId,
      p_season: season,
    });

    if (result.error) {
      setError(result.error.message);
      setLoading(false);
      return;
    }

    setData(result.data);
    setSelectedTeamId(result.data?.teams?.[0]?.fantasy_team_id ?? null);
    setLoading(false);
  }, [leagueId, season]);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedTeam = useMemo(
    () => data?.teams?.find((t: AnyRow) => t.fantasy_team_id === selectedTeamId) ?? null,
    [data, selectedTeamId]
  );

  const selectedBadges = useMemo(
    () => (data?.team_badges ?? []).filter((b: AnyRow) => b.fantasy_team_id === selectedTeamId),
    [data, selectedTeamId]
  );

  if (loading) return <main className="g365-hseason-page" style={styles.page}>
      <style>{`
@media (max-width: 760px) {
  .g365-hseason-page { overflow-x: hidden !important; }
  .g365-hseason-shell { width: calc(100% - 20px) !important; padding: 14px 0 50px !important; }
  .g365-hseason-hero { padding: 36px 14px !important; }
  .g365-hseason-grid { grid-template-columns: repeat(2,minmax(0,1fr)) !important; }
  .g365-hseason-stats { grid-template-columns: repeat(2,minmax(0,1fr)) !important; }
  .g365-hseason-badges,
  .g365-hseason-players { grid-template-columns: 1fr !important; }
}
@media (max-width: 430px) {
  .g365-hseason-grid,
  .g365-hseason-stats { grid-template-columns: 1fr !important; }
}
`}</style><div style={styles.center}>Opening {season} archive…</div></main>;
  if (error) return <main className="g365-hseason-page" style={styles.page}><div className="g365-hseason-shell" style={styles.shell}><div style={styles.error}>{error}</div></div></main>;

  if (!data?.found) {
    return (
      <main className="g365-hseason-page" style={styles.page}>
        <div className="g365-hseason-shell" style={styles.shell}>
          <Link href={`/league/${leagueId}/history`} style={styles.back}>← LEAGUE HISTORY</Link>
          <div style={styles.empty}>No archived recap exists for {season}.</div>
        </div>
      </main>
    );
  }

  const league = data.league;
  const teams = data.teams ?? [];
  const players = data.players ?? [];

  return (
    <main className="g365-hseason-page" style={styles.page}>
      <div className="g365-hseason-shell" style={styles.shell}>
        <Link href={`/league/${leagueId}/history`} style={styles.back}>← LEAGUE HISTORY</Link>

        <section className="g365-hseason-hero" style={styles.hero}>
          <div style={styles.eyebrow}>GRIDIRON365 • {season} SEASON ARCHIVE</div>
          <div style={styles.trophy}>🏆</div>
          <h1 style={styles.title}>{league.champion_team_name}</h1>
          <div style={styles.champion}>LEAGUE CHAMPION</div>
          <p style={styles.copy}>
            {league.league_name} • {league.total_teams} teams • {league.total_matchups} matchups •{" "}
            {Number(league.total_fantasy_points ?? 0).toFixed(1)} fantasy points
          </p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>FINAL STANDINGS</h2>
          <div className="g365-hseason-grid" style={styles.grid}>
            {teams.map((team: AnyRow) => (
              <button
                type="button"
                key={team.fantasy_team_id}
                onClick={() => setSelectedTeamId(team.fantasy_team_id)}
                style={{
                  ...styles.teamCard,
                  ...(team.fantasy_team_id === selectedTeamId ? styles.active : {}),
                }}
              >
                <span style={styles.rank}>#{team.final_finish ?? team.regular_season_rank ?? "—"}</span>
                <strong>{team.team_name}</strong>
                <span style={styles.muted}>{team.wins}-{team.losses}{team.ties ? `-${team.ties}` : ""}</span>
                <span style={styles.muted}>{Number(team.points_for ?? 0).toFixed(1)} PTS</span>
              </button>
            ))}
          </div>
        </section>

        {selectedTeam ? (
          <section style={styles.section}>
            <div style={styles.eyebrow}>{selectedTeam.team_personality_title ?? "TEAM STORY"}</div>
            <h2 style={styles.teamTitle}>{selectedTeam.team_name}</h2>
            <p style={styles.copy}>{selectedTeam.recap_headline}</p>

            <div className="g365-hseason-stats" style={styles.statGrid}>
              <Stat label="Final Finish" value={`#${selectedTeam.final_finish ?? "—"}`} />
              <Stat label="Record" value={`${selectedTeam.wins}-${selectedTeam.losses}${selectedTeam.ties ? `-${selectedTeam.ties}` : ""}`} />
              <Stat label="Points" value={Number(selectedTeam.points_for ?? 0).toFixed(1)} />
              <Stat label="Best Week" value={selectedTeam.highest_week_score ? `${Number(selectedTeam.highest_week_score).toFixed(1)} • W${selectedTeam.highest_week}` : "—"} />
              <Stat label="Playoff Wins" value={String(selectedTeam.playoff_wins ?? 0)} />
              <Stat label="Roster Moves" value={String(selectedTeam.roster_moves ?? 0)} />
            </div>

            <p style={styles.story}>{selectedTeam.recap_summary}</p>

            <div className="g365-hseason-badges" style={styles.badges}>
              {selectedBadges.map((badge: AnyRow) => (
                <div key={badge.badge_key} style={styles.badge}>
                  <span style={styles.badgeIcon}>{badge.icon ?? "◆"}</span>
                  <div>
                    <strong>{badge.name}</strong>
                    <div style={styles.muted}>{badge.description}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>SEASON AWARDS</h2>
          <div className="g365-hseason-grid" style={styles.grid}>
            {(data.awards ?? []).map((award: AnyRow) => (
              <div key={award.award_key} style={styles.card}>
                <div style={styles.eyebrow}>{award.award_name}</div>
                <strong style={styles.cardTitle}>{award.recipient_name}</strong>
                <p style={styles.muted}>{award.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>SEASON TIMELINE</h2>
          <div style={styles.timeline}>
            {(data.highlights ?? []).map((h: AnyRow, index: number) => (
              <div key={`${h.highlight_key}-${index}`} className="g365-hseason-timeline-row" style={styles.timelineRow}>
                <span style={styles.dot} />
                <div>
                  <div style={styles.eyebrow}>{h.week ? `WEEK ${h.week}` : (h.season_phase ?? "SEASON")}</div>
                  <strong>{h.title}</strong>
                  <div style={styles.muted}>{h.description}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>PLAYER YEARBOOK</h2>
          <div className="g365-hseason-players" style={styles.playerGrid}>
            {players.slice(0, 40).map((p: AnyRow) => (
              <div key={p.nfl_player_id} style={styles.card}>
                <div style={styles.eyebrow}>#{p.league_player_rank ?? "—"} • {p.position ?? "—"}</div>
                <strong style={styles.cardTitle}>{p.player_name}</strong>
                <div style={styles.points}>{Number(p.fantasy_points ?? 0).toFixed(1)}</div>
                <div style={styles.muted}>
                  {Number(p.fantasy_points_per_game ?? 0).toFixed(1)} PPG • {p.games_25_plus ?? 0} games 25+
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div style={styles.stat}><span style={styles.statLabel}>{label}</span><strong>{value}</strong></div>;
}

const styles: Record<string, React.CSSProperties> = {
  page:{minHeight:"100vh",background:"#070707",color:"#fff",fontFamily:"Inter,system-ui,sans-serif"},
  shell:{width:"min(1400px,calc(100% - 28px))",margin:"0 auto",padding:"22px 0 70px"},
  back:{display:"inline-block",color:"#ff7130",textDecoration:"none",fontSize:11,fontWeight:950,marginBottom:16},
  hero:{textAlign:"center",padding:"62px 22px",borderRadius:22,border:"1px solid rgba(255,100,20,.24)",background:"linear-gradient(145deg,rgba(120,12,5,.34),#0b0b0b 58%,rgba(70,26,0,.28))"},
  eyebrow:{color:"#ff6922",fontSize:10,fontWeight:950,letterSpacing:".11em",textTransform:"uppercase"},
  trophy:{fontSize:64,marginTop:18},
  title:{fontSize:"clamp(36px,6vw,72px)",lineHeight:.98,margin:"8px 0",letterSpacing:"-.045em",textTransform:"uppercase"},
  champion:{display:"inline-block",padding:"8px 13px",borderRadius:999,background:"linear-gradient(90deg,#c8180f,#ff7500)",fontSize:11,fontWeight:950},
  copy:{color:"#999",lineHeight:1.65,maxWidth:760,margin:"14px auto 0"},
  section:{marginTop:18,padding:20,borderRadius:16,border:"1px solid rgba(255,255,255,.08)",background:"#0c0c0c"},
  sectionTitle:{margin:"0 0 15px",fontSize:27},
  grid:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(210px,1fr))",gap:9},
  teamCard:{display:"grid",gap:5,textAlign:"left",padding:14,borderRadius:11,border:"1px solid rgba(255,255,255,.07)",background:"#090909",color:"#fff",cursor:"pointer"},
  active:{border:"1px solid rgba(255,100,20,.5)",background:"rgba(120,20,4,.18)"},
  rank:{color:"#ff6a22",fontWeight:950},
  muted:{color:"#777",fontSize:11,lineHeight:1.45},
  teamTitle:{fontSize:34,margin:"5px 0 0"},
  statGrid:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:8,marginTop:18},
  stat:{padding:13,borderRadius:10,border:"1px solid rgba(255,255,255,.07)",background:"#090909"},
  statLabel:{display:"block",color:"#747474",fontSize:9,fontWeight:950,textTransform:"uppercase",marginBottom:5},
  story:{color:"#aaa",lineHeight:1.7},
  badges:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:8},
  badge:{display:"grid",gridTemplateColumns:"40px 1fr",gap:9,padding:12,border:"1px solid rgba(255,255,255,.07)",borderRadius:10,background:"#090909"},
  badgeIcon:{fontSize:26},
  card:{padding:15,border:"1px solid rgba(255,255,255,.07)",borderRadius:12,background:"#090909"},
  cardTitle:{display:"block",fontSize:18,marginTop:5},
  points:{fontSize:28,fontWeight:1000,marginTop:10},
  timeline:{display:"grid",gap:12},
  timelineRow:{display:"grid",gridTemplateColumns:"14px 1fr",gap:10},
  dot:{width:8,height:8,borderRadius:999,background:"#ff681f",marginTop:4},
  playerGrid:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(230px,1fr))",gap:8},
  center:{minHeight:"70vh",display:"grid",placeContent:"center",color:"#777"},
  error:{padding:15,color:"#ff8c83",border:"1px solid rgba(255,80,80,.25)",borderRadius:10},
  empty:{padding:18,color:"#777",border:"1px dashed rgba(255,255,255,.1)",borderRadius:10},
};