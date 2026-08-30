import {
  redirect,
} from "next/navigation";

import TraditionalCommissioner from "@/components/traditional/TraditionalCommissioner";

import SeasonLongCommissioner from "@/components/season-long/SeasonLongCommissioner";

import {
  requireLeagueMember,
} from "@/lib/leagues/requireLeagueMember";


type PageProps = {
  params:
    Promise<{
      leagueId: string;
    }>;
};


export default async function CommissionerPage({
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
    !access.isCommissioner
  ) {
    redirect(
      `/league/${leagueId}`
    );
  }

  switch (
    access.league.leagueType
  ) {
    case "traditional":
      return (
        <TraditionalCommissioner />
      );

    case "season_long":
      return (
        <SeasonLongCommissioner
          leagueId={
            leagueId
          }
        />
      );

    case "nfl_playoffs":
      redirect(
        `/league/${leagueId}`
      );

    default:
      redirect(
        `/league/${leagueId}`
      );
  }
}