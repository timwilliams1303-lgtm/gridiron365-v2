import NhlTraditionalStandings from "@/components/nhl-traditional/NhlTraditionalStandings";

export default async function NhlTraditionalStandingsPage({
  params,
}: {
  params: Promise<{ leagueId: string }>;
}) {
  const { leagueId } = await params;

  return <NhlTraditionalStandings leagueId={leagueId} />;
}