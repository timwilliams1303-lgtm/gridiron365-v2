import { redirect } from "next/navigation";

import TraditionalOffseason from "@/components/traditional/TraditionalOffseason";
import { requireLeagueMember } from "@/lib/leagues/requireLeagueMember";

type PageProps = {
  params: Promise<{
    leagueId: string;
  }>;
};

export default async function TraditionalOffseasonPage({
  params,
}: PageProps) {
  const { leagueId } = await params;

  const access = await requireLeagueMember(leagueId);

  if (String(access.league.leagueType) !== "traditional") {
    redirect(`/league/${leagueId}`);
  }

  return (
    <TraditionalOffseason
      leagueId={leagueId}
      season={Number(access.league.season)}
      isCommissioner={access.isCommissioner}
    />
  );
}