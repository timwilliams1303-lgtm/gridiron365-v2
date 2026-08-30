import {
  redirect,
} from "next/navigation";

import PickemStandings from "@/components/pickem/PickemStandings";

import {
  requireLeagueMember,
} from "@/lib/leagues/requireLeagueMember";


type PageProps = {
  params: Promise<{
    leagueId: string;
  }>;
};


export default async function PickemStandingsPage({
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
    <PickemStandings
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
