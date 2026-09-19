import { redirect } from "next/navigation";

import NhlTraditionalTrades from "@/components/nhl-traditional/NhlTraditionalTrades";
import { requireLeagueMember } from "@/lib/leagues/requireLeagueMember";

type PageProps = {
  params: Promise<{
    leagueId: string;
  }>;
};

export default async function NhlTraditionalTradesPage({
  params,
}: PageProps) {
  const { leagueId } = await params;

  const access = await requireLeagueMember(leagueId);

  if (String(access.league.leagueType) !== "nhl_traditional") {
    redirect(`/league/${leagueId}`);
  }

  return <NhlTraditionalTrades leagueId={leagueId} />;
}