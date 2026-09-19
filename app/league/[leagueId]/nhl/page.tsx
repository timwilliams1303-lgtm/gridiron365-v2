import NhlTraditionalLeagueHome from "@/components/nhl-traditional/NhlTraditionalLeagueHome";

type NhlTraditionalHomePageProps = {
  params: Promise<{
    leagueId: string;
  }>;
};

export default async function NhlTraditionalHomePage({
  params,
}: NhlTraditionalHomePageProps) {
  const { leagueId } = await params;

  return <NhlTraditionalLeagueHome leagueId={leagueId} />;
}