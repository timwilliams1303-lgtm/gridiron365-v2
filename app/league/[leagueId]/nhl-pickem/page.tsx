import {
  requireLeagueMember,
} from "@/lib/leagues/requireLeagueMember";

import NhlPickemLeagueHome from "@/components/nhl-pickem/NhlPickemLeagueHome";
import NhlPickemLeagueNav from "@/components/nhl-pickem/NhlPickemLeagueNav";


type PageProps = {
  params: Promise<{
    leagueId: string;
  }>;
};


export default async function NhlPickemPage({
  params,
}: PageProps) {
  const {
    leagueId,
  } = await params;

  const access =
    await requireLeagueMember(
      leagueId
    );

  return (
    <>
      <NhlPickemLeagueNav
        leagueId={leagueId}
        isCommissioner={
          Boolean(
            access.isCommissioner
          )
        }
      />

      <NhlPickemLeagueHome
        leagueId={leagueId}
      />
    </>
  );
}