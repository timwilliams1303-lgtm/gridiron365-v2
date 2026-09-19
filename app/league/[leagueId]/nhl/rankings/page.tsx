import NhlTraditionalRankings from "@/components/nhl-traditional/NhlTraditionalRankings";

type NhlTraditionalRankingsPageProps = {
  params: Promise<{
    leagueId: string;
  }>;
};

export default async function NhlTraditionalRankingsPage({
  params,
}: NhlTraditionalRankingsPageProps) {
  const { leagueId } = await params;

  return <NhlTraditionalRankings leagueId={leagueId} />;
}