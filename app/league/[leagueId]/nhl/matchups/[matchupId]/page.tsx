import NhlTraditionalDetailedMatchup from "@/components/nhl-traditional/NhlTraditionalDetailedMatchup";

type PageProps = {
  params: Promise<{
    leagueId: string;
    matchupId: string;
  }>;
};

export default async function NhlTraditionalDetailedMatchupPage({
  params,
}: PageProps) {
  const { leagueId, matchupId } = await params;

  return (
    <NhlTraditionalDetailedMatchup
      leagueId={leagueId}
      matchupId={Number(matchupId)}
    />
  );
}