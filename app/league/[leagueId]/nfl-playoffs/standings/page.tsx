import {
  redirect,
} from "next/navigation";

import NflPlayoffsStandings from "@/components/nfl-playoffs/NflPlayoffsStandings";

import {
  requireLeagueMember,
} from "@/lib/leagues/requireLeagueMember";


export const dynamic = "force-dynamic";
export const revalidate = 0;


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
    <main
      style={{
        width: "100%",
        maxWidth: "100%",
        minWidth: 0,
        overflowX: "hidden",
      }}
    >
      <NflPlayoffsStandings
        leagueId={
          leagueId
        }
      />
    </main>
  );
}
