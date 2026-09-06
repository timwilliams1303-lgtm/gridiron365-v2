import {
  requireLeagueMember,
} from "@/lib/leagues/requireLeagueMember";

import NhlPickemLeagueNav from "@/components/nhl-pickem/NhlPickemLeagueNav";
import NhlPickemReadOnlySettings from "@/components/nhl-pickem/NhlPickemReadOnlySettings";

type PageProps = {
  params: Promise<{
    leagueId: string;
  }>;
};

export default async function NhlPickemSettingsPage({
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

      <NhlPickemReadOnlySettings
        leagueId={leagueId}
        season={season}
      />
    </>
  );
}