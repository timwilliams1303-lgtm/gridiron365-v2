import { redirect } from "next/navigation";

import NhlTraditionalTrophyCase from "@/components/nhl-traditional/NhlTraditionalTrophyCase";
import { requireLeagueMember } from "@/lib/leagues/requireLeagueMember";

type PageProps = {
  params: Promise<{
    leagueId: string;
  }>;
};

export default async function NhlTraditionalTrophyCasePage({
  params,
}: PageProps) {
  const { leagueId } = await params;

  const access = await requireLeagueMember(leagueId);

  if (String(access.league.leagueType) !== "nhl_traditional") {
    redirect(`/league/${leagueId}`);
  }

  return <NhlTraditionalTrophyCase leagueId={leagueId} />;
}