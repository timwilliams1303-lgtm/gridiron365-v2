import {
  redirect,
} from "next/navigation";

import PickemGames from "@/components/pickem/PickemGames";

import {
  requireLeagueMember,
} from "@/lib/leagues/requireLeagueMember";


type PageProps = {
  params: Promise<{
    leagueId: string;
  }>;
};


export default async function PickemGamesPage({
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
    <PickemGames
      leagueId={
        leagueId
      }
      season={
        access.league.season
      }
    />
  );
}
