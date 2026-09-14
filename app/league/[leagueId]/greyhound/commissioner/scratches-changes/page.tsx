import { redirect } from "next/navigation";

import GreyhoundScratchesChanges from "@/components/greyhound/GreyhoundScratchesChanges";
import { requireLeagueMember } from "@/lib/leagues/requireLeagueMember";

type PageProps = {
  params: Promise<{
    leagueId: string;
  }>;
};

export default async function GreyhoundScratchesChangesPage({
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

  return <GreyhoundScratchesChanges leagueId={leagueId} />;
}
