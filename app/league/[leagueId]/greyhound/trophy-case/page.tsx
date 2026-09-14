import GreyhoundTrophyCase from "@/components/greyhound/GreyhoundTrophyCase";
import { requireLeagueMember } from "@/lib/leagues/requireLeagueMember";

type PageProps = {
  params: Promise<{
    leagueId: string;
  }>;
};

export default async function GreyhoundTrophyCasePage({
  params,
}: PageProps) {
  const { leagueId } = await params;

  const access = await requireLeagueMember(leagueId);

  if (String(access.league.leagueType) !== "greyhound") {
    throw new Error("This page is only available for Greyhound leagues.");
  }

  return <GreyhoundTrophyCase leagueId={leagueId} />;
}
