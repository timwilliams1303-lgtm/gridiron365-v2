import { redirect } from "next/navigation";

import NhlTraditionalWaivers from "@/components/nhl-traditional/NhlTraditionalWaivers";
import { requireLeagueMember } from "@/lib/leagues/requireLeagueMember";

type PageProps = {
  params: Promise<{
    leagueId: string;
  }>;
};

export default async function NhlTraditionalWaiversPage({
  params,
}: PageProps) {
  const { leagueId } = await params;

  const access = await requireLeagueMember(leagueId);

  if (String(access.league.leagueType) !== "nhl_traditional") {
    redirect(`/league/${leagueId}`);
  }

  return <NhlTraditionalWaivers leagueId={leagueId} />;
}