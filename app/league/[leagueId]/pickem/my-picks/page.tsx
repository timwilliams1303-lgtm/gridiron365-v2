import {
  redirect,
} from "next/navigation";

import PickemMyPicks from "@/components/pickem/PickemMyPicks";

import {
  requireLeagueMember,
} from "@/lib/leagues/requireLeagueMember";


type PageProps = {
  params: Promise<{
    leagueId: string;
  }>;
};


export default async function PickemMyPicksPage({
  params,
}: PageProps) {
  const {
    leagueId,
  } =
    await params;

  const access =
    await requireLeagueMember(
      leagueId
    );

  if (
    access.league.leagueType !==
    "pickem"
  ) {
    redirect(
      `/league/${leagueId}`
    );
  }

  if (
    !access.fantasyTeam
  ) {
    redirect(
      `/league/${leagueId}`
    );
  }

  return (
    <PickemMyPicks
      leagueId={
        leagueId
      }
      season={
        access.league.season
      }
      fantasyTeamId={
        access.fantasyTeam.id
      }
      teamName={
        access.fantasyTeam.teamName
      }
    />
  );
}
