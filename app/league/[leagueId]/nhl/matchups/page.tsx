import NhlTraditionalMatchups from "@/components/nhl-traditional/NhlTraditionalMatchups";

type PageProps = {
  params: Promise<{ leagueId: string }>;
};

export default async function NhlTraditionalMatchupsPage({
  params,
}: PageProps) {
  const { leagueId } = await params;

  return <NhlTraditionalMatchups leagueId={leagueId} />;
}