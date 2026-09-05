import {
  redirect,
} from "next/navigation";

import PickemLeagueHome from "@/components/pickem/PickemLeagueHome";
import SeasonLongLeagueHome from "@/components/season-long/SeasonLongLeagueHome";
import TraditionalLeagueHome from "@/components/traditional/TraditionalLeagueHome";

import {
  requireLeagueMember,
} from "@/lib/leagues/requireLeagueMember";


type PageProps = {
  params: Promise<{
    leagueId: string;
  }>;
};


export default async function LeagueHomePage({
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
        <TraditionalLeagueHome
          leagueId={
            leagueId
          }
        />
      );


    case "season_long":
      return (
        <SeasonLongLeagueHome
          leagueId={
            leagueId
          }
        />
      );


    case "pickem":
      return (
        <PickemLeagueHome
          leagueId={
            leagueId
          }
        />
      );


    case "nfl_playoffs":
      redirect(
        `/league/${leagueId}/entry`
      );


    default:
      throw new Error(
        `Unsupported league type: ${access.league.leagueType}`
      );
  }
}