"use client";

import LeagueNav
  from "@/components/leagues/LeagueNav";


type Props = {
  leagueId: string;
  isCommissioner: boolean;
};


export default function PickemLeagueNav({
  leagueId,
  isCommissioner,
}: Props) {
  return (
    <LeagueNav
      leagueId={leagueId}
      leagueType="pickem"
      isCommissioner={isCommissioner}
      ariaLabel="G365 Pick'em Navigation"
    />
  );
}
