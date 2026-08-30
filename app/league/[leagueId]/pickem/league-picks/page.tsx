import {
  redirect,
} from "next/navigation";

import PickemLeaguePicks from "@/components/pickem/PickemLeaguePicks";

import {
  requireLeagueMember,
} from "@/lib/leagues/requireLeagueMember";


type PageProps = {
  params: Promise<{
    leagueId: string;
  }>;
};


export default async function PickemLeaguePicksPage({
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

  return (
    <PickemLeaguePicks
      leagueId={
        leagueId
      }
      season={
        access.league.season
      }
      viewerFantasyTeamId={
        access.fantasyTeam
          ?.id ??
        null
      }
    />
  );
}
