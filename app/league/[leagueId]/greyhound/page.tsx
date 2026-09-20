import { redirect } from "next/navigation";

import GreyhoundLeagueHome from "@/components/greyhound/GreyhoundLeagueHome";
import { requireLeagueMember } from "@/lib/leagues/requireLeagueMember";

type PageProps = {
  params: Promise<{
    leagueId: string;
  }>;
};

export default async function GreyhoundHomePage({
  params,
}: PageProps) {
  const { leagueId } = await params;

  const access = await requireLeagueMember(leagueId);

  if (String(access.league.leagueType) !== "greyhound") {
    redirect(`/league/${leagueId}`);
  }

  return <GreyhoundLeagueHome leagueId={leagueId} />;
}