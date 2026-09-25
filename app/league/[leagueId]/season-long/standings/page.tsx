import { redirect } from "next/navigation";

import SeasonLongStandings from "@/components/season-long/SeasonLongStandings";
import { requireLeagueMember } from "@/lib/leagues/requireLeagueMember";

type PageProps = {
  params: Promise<{
    leagueId: string;
  }>;
};

export default async function SeasonLongStandingsPage({
  params,
}: PageProps) {
  const { leagueId } = await params;

  const access =
    await requireLeagueMember(
      leagueId
    );

  if (
    String(
      access.league.leagueType
    ) !== "season_long"
  ) {
    redirect(
      `/league/${leagueId}`
    );
  }

  return (
    <SeasonLongStandings
      leagueId={leagueId}
    />
  );
}