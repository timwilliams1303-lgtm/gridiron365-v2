import { redirect } from "next/navigation";

import NhlTraditionalRecap from "@/components/nhl-traditional/NhlTraditionalRecap";
import { requireLeagueMember } from "@/lib/leagues/requireLeagueMember";

type PageProps = {
  params: Promise<{
    leagueId: string;
  }>;
};

export default async function NhlTraditionalRecapPage({
  params,
}: PageProps) {
  const { leagueId } = await params;

  const access = await requireLeagueMember(leagueId);

  if (String(access.league.leagueType) !== "nhl_traditional") {
    redirect(`/league/${leagueId}`);
  }

  return <NhlTraditionalRecap leagueId={leagueId} />;
}