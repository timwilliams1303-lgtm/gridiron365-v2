import NhlTraditionalPlayerDetail from "@/components/nhl-traditional/NhlTraditionalPlayerDetail";

type NhlTraditionalPlayerDetailPageProps = {
  params: Promise<{
    leagueId: string;
    playerId: string;
  }>;
};

export default async function NhlTraditionalPlayerDetailPage({
  params,
}: NhlTraditionalPlayerDetailPageProps) {
  const { leagueId, playerId } = await params;

  return (
    <NhlTraditionalPlayerDetail
      leagueId={leagueId}
      playerId={playerId}
    />
  );
}