import { redirect } from "next/navigation";

import NhlDynastyLotteryOfficial from "@/components/nhl-traditional/NhlDynastyLotteryOfficial";
import { requireLeagueMember } from "@/lib/leagues/requireLeagueMember";

type PageProps = {
  params: Promise<{
    leagueId: string;
  }>;
};

export default async function NhlTraditionalDraftLotteryPage({
  params,
}: PageProps) {
  const { leagueId } = await params;
  const access = await requireLeagueMember(leagueId);

  if (String(access.league.leagueType) !== "nhl_traditional") {
    redirect(`/league/${leagueId}`);
  }

  const draftSeason = Number(access.league.season);

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "18px",
        background: "linear-gradient(180deg,#07080c,#0b0d12 50%,#07080b)",
        color: "#f5f7fa",
      }}
    >
      <div style={{ maxWidth: "1550px", margin: "0 auto" }}>
        <div
          style={{
            marginBottom: "14px",
            padding: "16px",
            border: "1px solid rgba(255,92,40,.28)",
            borderRadius: "14px",
            background: "linear-gradient(135deg,rgba(140,14,14,.22),rgba(255,90,30,.08),rgba(255,255,255,.02))",
          }}
        >
          <div style={{ color: "#ff6b2c", fontSize: "11px", fontWeight: 900, letterSpacing: ".14em" }}>
            G365 NHL DYNASTY
          </div>
          <h1 style={{ margin: "5px 0 0", fontSize: "28px", fontWeight: 950 }}>
            Draft Lottery
          </h1>
          <p style={{ margin: "6px 0 0", color: "#9ca3ad", fontSize: "12px", lineHeight: 1.5 }}>
            Watch the official {draftSeason} league draft lottery and follow each published draft position live.
          </p>
        </div>

        <NhlDynastyLotteryOfficial
          leagueId={leagueId}
          draftSeason={draftSeason}
          viewerOnly
        />
      </div>
    </main>
  );
}
