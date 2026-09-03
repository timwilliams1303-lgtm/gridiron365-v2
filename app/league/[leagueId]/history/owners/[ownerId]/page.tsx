"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useParams } from "next/navigation";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function OwnerLegacyProfilePage() {
  const params = useParams<{ leagueId: string; ownerId: string }>();
  const leagueId = params.leagueId;
  const ownerId = params.ownerId;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const result = await supabase.rpc("get_traditional_owner_legacy_profile", {
      p_league_id: leagueId,
      p_owner_user_id: ownerId,
    });

    if (result.error) {
      setError(result.error.message);
      setLoading(false);
      return;
    }

    setData(result.data);
    setLoading(false);
  }, [leagueId, ownerId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <main style={styles.page}><div style={styles.center}>Loading legacy profile…</div></main>;
  if (error) return <main style={styles.page}><div style={styles.shell}><div style={styles.error}>{error}</div></div></main>;

  const profile = data?.profile;

  if (!profile) {
    return (
      <main style={styles.page}>
        <style>{mobileCss}</style>
        <div className="g365-owner-shell" style={styles.shell}>
          <Link href={`/league/${leagueId}/history`} style={styles.back}>← LEAGUE HISTORY</Link>
          <div style={styles.empty}>This owner does not have an archived league history yet.</div>
        </div>
      </main>
    );
  }

  return (
    <main className="g365-owner-page" style={styles.page}>
      <style>{mobileCss}</style>
      <div className="g365-owner-shell" style={styles.shell}>
        <Link href={`/league/${leagueId}/history`} style={styles.back}>← LEAGUE HISTORY</Link>

        <section className="g365-owner-hero" style={styles.hero}>
          <div style={styles.eyebrow}>G365 LEGACY PROFILE • {profile.legacy_tier}</div>
          <h1 style={styles.title}>{profile.display_name ?? "League Owner"}</h1>
          <div style={styles.score}>{Number(profile.legacy_score ?? 0).toFixed(0)}</div>
          <div style={styles.scoreLabel}>G365 LEGACY SCORE</div>

          <div className="g365-owner-stats" style={styles.statGrid}>
            <Stat label="Seasons" value={profile.seasons_played} />
            <Stat label="Championships" value={profile.championships} />
            <Stat label="Finals" value={profile.championship_appearances} />
            <Stat label="Playoff Trips" value={profile.playoff_appearances} />
            <Stat label="All-Time Wins" value={profile.all_time_wins} />
            <Stat label="Playoff Wins" value={profile.playoff_wins} />
            <Stat label="All-Time Points" value={Number(profile.all_time_points_for ?? 0).toFixed(1)} />
            <Stat label="Badges" value={profile.badges_earned} />
            <Stat label="Legendary" value={profile.legendary_badges} />
          </div>
        </section>

        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>TROPHY CASE</h2>
          <div className="g365-owner-badges" style={styles.badges}>
            {(data.badges ?? []).length ? (data.badges ?? []).map((badge: any, i: number) => (
              <div key={`${badge.badge_key}-${badge.season ?? "all"}-${i}`} style={styles.badge}>
                <span style={styles.icon}>{badge.icon ?? "◆"}</span>
                <div>
                  <div style={styles.eyebrow}>{badge.season ? `${badge.season} • ` : ""}{String(badge.tier).toUpperCase()}</div>
                  <strong>{badge.name}</strong>
                  <div style={styles.muted}>{badge.description}</div>
                </div>
              </div>
            )) : <div style={styles.empty}>No badges have been archived yet.</div>}
          </div>
        </section>

        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>CAREER TIMELINE</h2>
          <div style={styles.timeline}>
            {(data.seasons ?? []).map((season: any) => (
              <Link
                key={`${season.season}-${season.fantasy_team_id}`}
                href={`/league/${leagueId}/history/${season.season}`}
                className="g365-owner-season-card"
                style={styles.seasonCard}
              >
                <div>
                  <div style={styles.eyebrow}>{season.season}</div>
                  <strong style={styles.seasonName}>{season.team_name}</strong>
                  <div style={styles.muted}>{season.recap_headline}</div>
                </div>
                <div className="g365-owner-finish" style={styles.finish}>
                  {season.won_championship ? "🏆 CHAMPION" : `#${season.final_finish ?? "—"}`}
                  <small>{season.wins}-{season.losses}{season.ties ? `-${season.ties}` : ""}</small>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return <div style={styles.stat}><span style={styles.statLabel}>{label}</span><strong>{value}</strong></div>;
}

const mobileCss = `
@media (max-width: 760px) {
  .g365-owner-page { overflow-x: hidden !important; }
  .g365-owner-shell { width: calc(100% - 20px) !important; padding: 14px 0 50px !important; min-width: 0 !important; }
  .g365-owner-hero { padding: 38px 14px 24px !important; }
  .g365-owner-stats { grid-template-columns: repeat(2,minmax(0,1fr)) !important; }
  .g365-owner-badges { grid-template-columns: 1fr !important; }
  .g365-owner-season-card { min-width: 0 !important; }
}
@media (max-width: 430px) {
  .g365-owner-stats { grid-template-columns: 1fr !important; }
  .g365-owner-season-card { flex-direction: column !important; align-items: stretch !important; }
  .g365-owner-finish { text-align: left !important; justify-items: start !important; }
}
`;

const styles: Record<string, React.CSSProperties> = {
  page:{minHeight:"100vh",background:"radial-gradient(circle at 50% -10%,rgba(255,88,0,.14),transparent 28%),#070707",color:"#fff",fontFamily:"Inter,system-ui,sans-serif"},
  shell:{width:"min(1250px,calc(100% - 28px))",margin:"0 auto",padding:"22px 0 70px"},
  back:{display:"inline-block",color:"#ff7130",textDecoration:"none",fontSize:11,fontWeight:950,marginBottom:16},
  hero:{textAlign:"center",padding:"60px 24px 30px",borderRadius:22,border:"1px solid rgba(255,103,20,.22)",background:"linear-gradient(145deg,rgba(110,10,4,.32),#0a0a0a 60%,rgba(62,24,0,.27))"},
  eyebrow:{color:"#ff6b24",fontSize:10,fontWeight:950,letterSpacing:".11em",textTransform:"uppercase"},
  title:{fontSize:"clamp(38px,6vw,70px)",margin:"6px 0 12px",letterSpacing:"-.05em",textTransform:"uppercase"},
  score:{fontSize:56,fontWeight:1000,color:"#ff6b22",lineHeight:1},
  scoreLabel:{color:"#777",fontSize:10,fontWeight:950,letterSpacing:".12em",marginTop:5},
  statGrid:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:8,marginTop:28},
  stat:{padding:13,border:"1px solid rgba(255,255,255,.07)",borderRadius:10,background:"rgba(255,255,255,.02)"},
  statLabel:{display:"block",fontSize:9,color:"#777",fontWeight:950,textTransform:"uppercase",marginBottom:5},
  section:{marginTop:18,padding:20,border:"1px solid rgba(255,255,255,.08)",borderRadius:16,background:"#0c0c0c"},
  sectionTitle:{fontSize:27,margin:"0 0 15px"},
  badges:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:8},
  badge:{display:"grid",gridTemplateColumns:"44px 1fr",gap:10,padding:13,border:"1px solid rgba(255,255,255,.07)",borderRadius:11,background:"#090909"},
  icon:{fontSize:29},
  muted:{color:"#777",fontSize:11,lineHeight:1.5,marginTop:3},
  timeline:{display:"grid",gap:8},
  seasonCard:{display:"flex",justifyContent:"space-between",gap:16,textDecoration:"none",color:"#fff",padding:15,border:"1px solid rgba(255,255,255,.07)",borderRadius:11,background:"#090909"},
  seasonName:{display:"block",fontSize:18,marginTop:3},
  finish:{display:"grid",textAlign:"right",alignContent:"center",fontWeight:950,color:"#ff6b22"},
  center:{minHeight:"70vh",display:"grid",placeContent:"center",color:"#777"},
  error:{padding:15,color:"#ff8c83",border:"1px solid rgba(255,80,80,.25)",borderRadius:10},
  empty:{padding:18,color:"#777",border:"1px dashed rgba(255,255,255,.1)",borderRadius:10},
};
