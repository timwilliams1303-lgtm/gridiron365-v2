import { redirect } from "next/navigation";

import PickemCommissioner from "@/components/pickem/PickemCommissioner";
import { requireLeagueMember } from "@/lib/leagues/requireLeagueMember";

type PageProps = {
  params: Promise<{
    leagueId: string;
  }>;
};

export default async function PickemCommissionerPage({
  params,
}: PageProps) {
  const { leagueId } = await params;

  const access = await requireLeagueMember(leagueId);

  if (String(access.league.leagueType) !== "pickem") {
    redirect(`/league/${leagueId}`);
  }

  return (
    <PickemCommissioner
      leagueId={leagueId}
    />
  );
}