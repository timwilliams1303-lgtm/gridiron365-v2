import { redirect } from "next/navigation";

import NhlTraditionalDraft from "@/components/nhl-traditional/NhlTraditionalDraft";
import { requireLeagueMember } from "@/lib/leagues/requireLeagueMember";

type NhlTraditionalDraftPageProps = {
  params: Promise<{
    leagueId: string;
  }>;
};

export default async function NhlTraditionalDraftPage({
  params,
}: NhlTraditionalDraftPageProps) {
  const { leagueId } = await params;

  const access = await requireLeagueMember(leagueId);

  if (String(access.league.leagueType) !== "nhl_traditional") {
    redirect(`/league/${leagueId}`);
  }

  /*
   * Permanent NHL Draft route.
   *
   * This route represents the CURRENT league-season draft.
   *
   * Dynasty example:
   *   league season = 2026
   *   draft season  = 2026
   *
   * The 2027 Annual Dynasty Draft belongs to the Offseason
   * workspace while the league is still on source season 2026.
   */
  const draftSeason = Number(access.league.season);

  if (!Number.isFinite(draftSeason)) {
    redirect(`/league/${leagueId}/nhl`);
  }

  return (
    <NhlTraditionalDraft
      leagueId={leagueId}
      draftSeason={draftSeason}
    />
  );
}