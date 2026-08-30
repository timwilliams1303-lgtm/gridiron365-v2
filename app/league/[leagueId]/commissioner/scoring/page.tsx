import {
  redirect,
} from "next/navigation";

import SeasonLongScoring from "@/components/season-long/SeasonLongScoring";
import TraditionalScoring from "@/components/traditional/TraditionalScoring";

import {
  requireLeagueMember,
} from "@/lib/leagues/requireLeagueMember";

type PageProps = {
  params:
    Promise<{
      leagueId: string;
    }>;
};

export default async function CommissionerScoringPage({
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
        <TraditionalScoring
          leagueId={
            leagueId
          }
        />
      );

    case "season_long":
      return (
        <SeasonLongScoring
          leagueId={
            leagueId
          }
        />
      );

    case "nfl_playoffs":
    default:
      redirect(
        `/league/${leagueId}`
      );
  }
}
