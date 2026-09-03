import TraditionalRankingsManager from "@/components/traditional/TraditionalRankingsManager";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getTraditionalRankingsData } from "@/lib/traditional/rankings.service";
import { requireTraditionalLeague } from "@/lib/traditional/requireTraditionalLeague";

type PageProps = {
  params: Promise<{ leagueId: string }>;
};

export default async function TraditionalRankingsPage({ params }: PageProps) {
  const { leagueId } = await params;
  const access = await requireTraditionalLeague(leagueId);
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("You must be signed in to manage draft rankings.");
  }

  const data = await getTraditionalRankingsData(
    supabase,
    leagueId,
    access.league.season,
    user.id
  );

  return (
    <main className="g365-rankings-page" style={styles.page}>
      <style>{mobileCss}</style>
      <section className="g365-rankings-shell" style={styles.shell}>
        <header className="g365-rankings-header" style={styles.header}>
          <div>
            <p style={styles.eyebrow}>DRAFT PREPARATION</p>
            <h1 style={styles.title}>My Rankings</h1>
            <p style={styles.subtitle}>
              Start from the 2026 ESPN PPR rankings, then customize your personal
              draft order. Your saved rankings will be used as your Auto-Pick
              priority during the draft.
            </p>
          </div>

          <div className="g365-rankings-meta" style={styles.headerMeta}>
            <div style={styles.metaBox}>
              <span style={styles.metaLabel}>SEASON</span>
              <strong style={styles.metaValue}>{access.league.season}</strong>
            </div>
            <div style={styles.metaBox}>
              <span style={styles.metaLabel}>PLAYER POOL</span>
              <strong style={styles.metaValue}>{data.totalPlayers}</strong>
            </div>
            <div style={styles.metaBox}>
              <span style={styles.metaLabel}>RANKING BASE</span>
              <strong style={styles.metaValue}>ESPN PPR</strong>
            </div>
          </div>
        </header>

        <TraditionalRankingsManager
          leagueId={leagueId}
          season={access.league.season}
          initialized={data.initialized}
          initialPlayers={data.players}
          teams={data.teams}
        />
      </section>
    </main>
  );
}

const mobileCss = `
@media (max-width: 760px) {
  .g365-rankings-page { padding: 20px 10px 48px !important; overflow-x: hidden !important; }
  .g365-rankings-shell { min-width: 0 !important; gap: 18px !important; }
  .g365-rankings-header { display: grid !important; grid-template-columns: 1fr !important; align-items: stretch !important; }
  .g365-rankings-meta { display: grid !important; grid-template-columns: repeat(3,minmax(0,1fr)) !important; width: 100% !important; }
  .g365-rankings-meta > div { min-width: 0 !important; }
}
@media (max-width: 500px) {
  .g365-rankings-meta { grid-template-columns: 1fr !important; }
}
`;

const styles = {
  page:{minHeight:"calc(100vh - 140px)",padding:"32px 18px 60px",background:"radial-gradient(circle at 50% 0%,rgba(255,67,0,.05),transparent 34%)"},
  shell:{width:"min(1320px,100%)",margin:"0 auto",display:"grid",gap:"22px"},
  header:{display:"flex",alignItems:"flex-end",justifyContent:"space-between",gap:"20px",flexWrap:"wrap" as const},
  eyebrow:{margin:0,color:"#ff7a18",fontSize:"10px",fontWeight:900,letterSpacing:".15em"},
  title:{margin:"7px 0 0",color:"#ffffff",fontSize:"36px"},
  subtitle:{maxWidth:"720px",margin:"8px 0 0",color:"#8f96a3",fontSize:"13px",lineHeight:1.5},
  headerMeta:{display:"flex",gap:"9px",flexWrap:"wrap" as const},
  metaBox:{minWidth:"120px",padding:"11px 14px",display:"grid",gap:"4px",border:"1px solid rgba(255,135,0,.16)",borderRadius:"9px",background:"rgba(255,85,0,.04)"},
  metaLabel:{color:"#707781",fontSize:"7px",fontWeight:900,letterSpacing:".09em"},
  metaValue:{color:"#ff8724",fontSize:"11px"},
};
