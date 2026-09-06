import {
  requireLeagueMember,
} from "@/lib/leagues/requireLeagueMember";

import NhlPickemLeagueNav from "@/components/nhl-pickem/NhlPickemLeagueNav";
import NhlPickemStandings from "@/components/nhl-pickem/NhlPickemStandings";

type PageProps = {
  params: Promise<{
    leagueId: string;
  }>;
};

export default async function NhlPickemStandingsPage({
  params,
}: PageProps) {
  const {
    leagueId,
  } = await params;

  const access =
    await requireLeagueMember(
      leagueId
    );

  const season =
    Number(
      access.league?.season
    );

  if (
    !Number.isFinite(
      season
    )
  ) {
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

        <main
          style={{
            padding:
              "22px 18px 36px",
            color:
              "#aaaab2",
          }}
        >
          The NHL Pick&apos;em
          season could not be
          determined.
        </main>
      </>
    );
  }

  const viewerFantasyTeamId =
    access.fantasyTeam?.id ??
    null;

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

      <NhlPickemStandings
        leagueId={leagueId}
        season={season}
        viewerFantasyTeamId={
          viewerFantasyTeamId
        }
      />
    </>
  );
}