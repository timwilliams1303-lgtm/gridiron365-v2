import { redirect } from "next/navigation";

import NhlTraditionalPlayoffs from "@/components/nhl-traditional/NhlTraditionalPlayoffs";
import { requireLeagueMember } from "@/lib/leagues/requireLeagueMember";

type PageProps = {
  params: Promise<{
    leagueId: string;
  }>;
};

export default async function NhlTraditionalPlayoffsPage({
  params,
}: PageProps) {
  const { leagueId } = await params;

  const access = await requireLeagueMember(leagueId);

  if (String(access.league.leagueType) !== "nhl_traditional") {
    redirect(`/league/${leagueId}`);
  }

  return <NhlTraditionalPlayoffs leagueId={leagueId} />;
}