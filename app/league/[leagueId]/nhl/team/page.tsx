import NhlTraditionalMyTeam from "@/components/nhl-traditional/NhlTraditionalMyTeam";

type NhlTraditionalMyTeamPageProps = {
  params: Promise<{
    leagueId: string;
  }>;
};

export default async function NhlTraditionalMyTeamPage({
  params,
}: NhlTraditionalMyTeamPageProps) {
  const { leagueId } = await params;

  return <NhlTraditionalMyTeam leagueId={leagueId} />;
}