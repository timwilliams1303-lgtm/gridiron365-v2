import { redirect } from "next/navigation";

import GreyhoundSeasonControl from "@/components/greyhound/GreyhoundSeasonControl";
import { requireLeagueMember } from "@/lib/leagues/requireLeagueMember";

type PageProps = {
  params: Promise<{
    leagueId: string;
  }>;
};

export default async function GreyhoundSeasonControlPage({
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

  return <GreyhoundSeasonControl leagueId={leagueId} />;
}