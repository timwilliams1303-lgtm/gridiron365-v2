"use client";

import LeagueNav
  from "@/components/leagues/LeagueNav";

import type {
  SeasonLongCompetitionFormat,
} from "@/lib/leagues/leagueCapabilities";


type SeasonLongLeagueNavProps = {
  leagueId: string;
  isCommissioner?: boolean;
  competitionFormat?:
    SeasonLongCompetitionFormat;
  playoffsEnabled?: boolean;
};


export default function SeasonLongLeagueNav({
  leagueId,
  isCommissioner = false,
  competitionFormat = "total_points",
  playoffsEnabled = false,
}: SeasonLongLeagueNavProps) {
  return (
    <LeagueNav
      leagueId={leagueId}
      leagueType="season_long"
      isCommissioner={isCommissioner}
      competitionFormat={competitionFormat}
      playoffsEnabled={playoffsEnabled}
      ariaLabel="Season-Long League Navigation"
    />
  );
}
