import {
  redirect,
} from "next/navigation";

import NflPlayoffsStandings from "@/components/nfl-playoffs/NflPlayoffsStandings";

import {
  requireLeagueMember,
} from "@/lib/leagues/requireLeagueMember";


type PageProps = {
  params: Promise<{
    leagueId: string;
  }>;
};


export default async function NflPlayoffsStandingsPage({
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
    "nfl_playoffs"
  ) {
    redirect(
      `/league/${leagueId}`
    );
  }


  return (
    <NflPlayoffsStandings
      leagueId={
        leagueId
      }
    />
  );
}