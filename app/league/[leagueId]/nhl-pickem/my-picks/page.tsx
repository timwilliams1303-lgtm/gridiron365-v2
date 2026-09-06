import {
  requireLeagueMember,
} from "@/lib/leagues/requireLeagueMember";

import NhlPickemLeagueNav from "@/components/nhl-pickem/NhlPickemLeagueNav";
import NhlPickemMyPicks from "@/components/nhl-pickem/NhlPickemMyPicks";


type PageProps = {
  params: Promise<{
    leagueId: string;
  }>;
};


export default async function NhlPickemMyPicksPage({
  params,
}: PageProps) {
  const {
    leagueId,
  } = await params;

  const access =
    await requireLeagueMember(
      leagueId
    );

  const fantasyTeamId =
    access.fantasyTeam?.id;

  if (!fantasyTeamId) {
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
          Your fantasy team could not
          be found for this league.
        </main>
      </>
    );
  }


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
          The NHL Pick&apos;em season
          could not be determined.
        </main>
      </>
    );
  }


  const teamName =
    access.fantasyTeam?.teamName ??
    "My Entry";


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

      <NhlPickemMyPicks
        leagueId={leagueId}
        season={season}
        fantasyTeamId={
          fantasyTeamId
        }
        teamName={
          teamName
        }
      />
    </>
  );
}