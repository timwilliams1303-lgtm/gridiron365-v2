import {
  redirect,
} from "next/navigation";

import TraditionalStandings from "@/components/traditional/TraditionalStandings";

import SeasonLongStandings from "@/components/season-long/SeasonLongStandings";

import {
  requireLeagueMember,
} from "@/lib/leagues/requireLeagueMember";


type PageProps = {
  params:
    Promise<{
      leagueId: string;
    }>;
};


export default async function StandingsPage({
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


  switch (
    access.league.leagueType
  ) {
    case "traditional":
      return (
        <TraditionalStandings
          leagueId={
            leagueId
          }
        />
      );


    case "season_long":
      return (
        <SeasonLongStandings
          leagueId={
            leagueId
          }
        />
      );


    case "nfl_playoffs":
      redirect(
        `/league/${leagueId}`
      );
  }
}