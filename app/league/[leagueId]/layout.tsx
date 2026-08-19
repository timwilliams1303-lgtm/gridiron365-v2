import type {
  ReactNode,
} from "react";

import TraditionalLeagueNav from "@/components/traditional/TraditionalLeagueNav";

import {
  requireTraditionalLeague,
} from "@/lib/traditional/requireTraditionalLeague";


type TraditionalLeagueLayoutProps = {
  children: ReactNode;

  params:
    Promise<{
      leagueId: string;
    }>;
};


export default async function TraditionalLeagueLayout({
  children,
  params,
}: TraditionalLeagueLayoutProps) {
  const {
    leagueId,
  } =
    await params;

  const access =
    await requireTraditionalLeague(
      leagueId
    );

  return (
    <>
      <TraditionalLeagueNav
        leagueId={
          leagueId
        }
        leagueName={
          access.league.name
        }
        season={
          access.league.season
        }
        teamName={
          access.fantasyTeam
            ?.teamName ??
          null
        }
        isCommissioner={
          access.isCommissioner
        }
      />

      {children}
    </>
  );
}