"use client";

import LeagueNav
  from "@/components/leagues/LeagueNav";


type Props = {
  leagueId: string;
  season: number;
  isCommissioner?: boolean;
};


export default function NflPlayoffsLeagueNav({
  leagueId,
  season: _season,
  isCommissioner = false,
}: Props) {
  return (
    <LeagueNav
      leagueId={leagueId}
      leagueType="nfl_playoffs"
      isCommissioner={isCommissioner}
      ariaLabel="NFL Playoffs League Navigation"
    />
  );
}
