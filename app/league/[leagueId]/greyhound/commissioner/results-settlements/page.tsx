import { redirect } from "next/navigation";

import GreyhoundResultsSettlements from "@/components/greyhound/GreyhoundResultsSettlements";
import { requireLeagueMember } from "@/lib/leagues/requireLeagueMember";

type PageProps = {
  params: Promise<{
    leagueId: string;
  }>;
};

export default async function GreyhoundResultsSettlementsPage({
  params,
}: PageProps) {
  const { leagueId } = await params;
  const access = await requireLeagueMember(leagueId);

  if (
    String(access.league.leagueType) !== "greyhound" ||
    !access.isCommissioner
  ) {
    redirect(`/league/${leagueId}`);
  }

  return <GreyhoundResultsSettlements leagueId={leagueId} />;
}
