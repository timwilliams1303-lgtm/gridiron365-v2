import { redirect } from "next/navigation";

import PickemLeagueHome from "@/components/pickem/PickemLeagueHome";
import { requireLeagueMember } from "@/lib/leagues/requireLeagueMember";

type PageProps = {
  params: Promise<{
    leagueId: string;
  }>;
};

export default async function PickemHomePage({
  params,
}: PageProps) {
  const { leagueId } = await params;

  const access = await requireLeagueMember(leagueId);

  if (String(access.league.leagueType) !== "pickem") {
    redirect(`/league/${leagueId}`);
  }

  return <PickemLeagueHome leagueId={leagueId} />;
}