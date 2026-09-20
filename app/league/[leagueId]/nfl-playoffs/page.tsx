import { redirect } from "next/navigation";

import NflPlayoffsLeagueHome from "@/components/nfl-playoffs/NflPlayoffsLeagueHome";
import { requireLeagueMember } from "@/lib/leagues/requireLeagueMember";

type PageProps = {
  params: Promise<{
    leagueId: string;
  }>;
};

export default async function NflPlayoffsHomePage({
  params,
}: PageProps) {
  const { leagueId } = await params;

  const access = await requireLeagueMember(leagueId);

  if (String(access.league.leagueType) !== "nfl_playoffs") {
    redirect(`/league/${leagueId}`);
  }

  return <NflPlayoffsLeagueHome leagueId={leagueId} />;
}