import NhlTraditionalDraft from "@/components/nhl-traditional/NhlTraditionalDraft";

type NhlTraditionalDraftPageProps = {
  params: Promise<{
    leagueId: string;
  }>;
};

export default async function NhlTraditionalDraftPage({
  params,
}: NhlTraditionalDraftPageProps) {
  const { leagueId } = await params;

  return <NhlTraditionalDraft leagueId={leagueId} />;
}