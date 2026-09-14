import { redirect } from "next/navigation";

import GreyhoundTeamsEntries from "@/components/greyhound/GreyhoundTeamsEntries";
import { requireLeagueMember } from "@/lib/leagues/requireLeagueMember";

type PageProps = {
  params: Promise<{
    leagueId: string;
  }>;
};

export default async function GreyhoundTeamsEntriesPage({
  params,
}: PageProps) {
  const { leagueId } = await params;

  const access =
    await requireLeagueMember(
      leagueId,
    );

  if (
    String(
      access.league.leagueType,
    ) !== "greyhound"
  ) {
    redirect(
      `/league/${leagueId}`,
    );
  }

  if (
    !access.isCommissioner
  ) {
    redirect(
      `/league/${leagueId}/greyhound`,
    );
  }

  return (
    <GreyhoundTeamsEntries
      leagueId={
        leagueId
      }
    />
  );
}