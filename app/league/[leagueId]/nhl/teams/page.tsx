import NhlTraditionalTeams from "@/components/nhl-traditional/NhlTraditionalTeams";

type PageProps = {
  params: Promise<{ leagueId: string }>;
};

export default async function NhlTraditionalTeamsPage({ params }: PageProps) {
  const { leagueId } = await params;
  return <NhlTraditionalTeams leagueId={leagueId} />;
}
