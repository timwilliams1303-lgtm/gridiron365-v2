import { redirect } from "next/navigation";

import NhlTraditionalCommissioner from "@/components/nhl-traditional/NhlTraditionalCommissioner";

import {
  requireLeagueMember,
} from "@/lib/leagues/requireLeagueMember";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  params: Promise<{
    leagueId: string;
  }>;
};

export default async function NhlTraditionalCommissionerPage({
  params,
}: PageProps) {
  const { leagueId } = await params;

  const access = await requireLeagueMember(leagueId);

  if (access.league.leagueType !== "nhl_traditional") {
    redirect(`/league/${leagueId}`);
  }

  if (!access.isCommissioner) {
    redirect(`/league/${leagueId}`);
  }

  return (
    <NhlTraditionalCommissioner
      leagueId={leagueId}
    />
  );
}