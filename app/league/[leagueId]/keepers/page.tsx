import { redirect } from "next/navigation";

import TraditionalDynastyKeepers from "@/components/traditional/TraditionalDynastyKeepers";
import { requireLeagueMember } from "@/lib/leagues/requireLeagueMember";

type PageProps = {
  params: Promise<{
    leagueId: string;
  }>;
};

export default async function TraditionalDynastyKeepersPage({
  params,
}: PageProps) {
  const { leagueId } = await params;
  const access = await requireLeagueMember(leagueId);

  if (String(access.league.leagueType) !== "traditional") {
    redirect(`/league/${leagueId}`);
  }

  const fantasyTeamId = Number(access.fantasyTeam?.id ?? 0);

  if (!fantasyTeamId && !access.isCommissioner) {
    redirect(`/league/${leagueId}`);
  }

  const season = Number(access.league.season);

  return (
    <TraditionalDynastyKeepers
      leagueId={leagueId}
      fantasyTeamId={fantasyTeamId}
      sourceSeason={season}
      targetSeason={season + 1}
    />
  );
}
