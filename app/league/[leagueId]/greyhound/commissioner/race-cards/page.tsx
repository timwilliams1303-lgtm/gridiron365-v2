import { notFound } from "next/navigation";

import GreyhoundConfirmedRaceCards from "@/components/greyhound/GreyhoundConfirmedRaceCards";
import GreyhoundEntriesImporter from "@/components/greyhound/GreyhoundEntriesImporter";
import GreyhoundRaceCardImporter from "@/components/greyhound/GreyhoundRaceCardImporter";
import { requireLeagueMember } from "@/lib/leagues/requireLeagueMember";

type Props = {
  params: Promise<{ leagueId: string }>;
};

export default async function GreyhoundRaceCardsPage({
  params,
}: Props) {
  const { leagueId } =
    await params;

  const membership =
    await requireLeagueMember(
      leagueId
    );

  if (!membership.isCommissioner) {
    notFound();
  }

  return (
    <main
      style={{
        display: "grid",
        gap: 16,
      }}
    >
      <GreyhoundConfirmedRaceCards
        leagueId={leagueId}
      />

      <GreyhoundEntriesImporter
        leagueId={leagueId}
      />

      <GreyhoundRaceCardImporter
        leagueId={leagueId}
      />
    </main>
  );
}