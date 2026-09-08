import { redirect } from "next/navigation";

import PickemReadOnlySettings from "@/components/pickem/PickemReadOnlySettings";
import PickemRealtimeRefresh from "@/components/pickem/PickemRealtimeRefresh";
import { requireLeagueMember } from "@/lib/leagues/requireLeagueMember";

type PageProps = { params: Promise<{ leagueId: string }> };

export default async function PickemSettingsPage({ params }: PageProps) {
  const { leagueId } = await params;
  const access = await requireLeagueMember(leagueId);

  if (access.league.leagueType !== "pickem") {
    redirect(`/league/${leagueId}`);
  }

  return (
    <>
      <PickemRealtimeRefresh leagueId={leagueId} />
      <PickemReadOnlySettings leagueId={leagueId} />
    </>
  );
}
