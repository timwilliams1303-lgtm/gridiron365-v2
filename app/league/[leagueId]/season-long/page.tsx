import { redirect } from "next/navigation";

import SeasonLongLeagueHome from "@/components/season-long/SeasonLongLeagueHome";
import { requireLeagueMember } from "@/lib/leagues/requireLeagueMember";

type PageProps = {
  params: Promise<{
    leagueId: string;
  }>;
};

export default async function SeasonLongHomePage({
  params,
}: PageProps) {
  const { leagueId } = await params;

  const access = await requireLeagueMember(leagueId);

  if (String(access.league.leagueType) !== "season_long") {
    redirect(`/league/${leagueId}`);
  }

  return <SeasonLongLeagueHome leagueId={leagueId} />;
}