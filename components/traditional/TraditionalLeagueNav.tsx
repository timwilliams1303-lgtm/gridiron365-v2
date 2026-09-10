"use client";

import LeagueNav
  from "@/components/leagues/LeagueNav";


type Props = {
  leagueId: string;
  isCommissioner: boolean;
};


export default function TraditionalLeagueNav({
  leagueId,
  isCommissioner,
}: Props) {
  return (
    <LeagueNav
      leagueId={leagueId}
      leagueType="traditional"
      isCommissioner={isCommissioner}
      ariaLabel="Traditional League Navigation"
    />
  );
}
