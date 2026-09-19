import NhlTraditionalPlayers from "@/components/nhl-traditional/NhlTraditionalPlayers";

type NhlTraditionalPlayersPageProps = {
  params: Promise<{
    leagueId: string;
  }>;

  searchParams: Promise<{
    search?: string;
    ownership?: string;
    team?: string;
    position?: string;
    sort?: string;
    direction?: string;
  }>;
};

export default async function NhlTraditionalPlayersPage({
  params,
  searchParams,
}: NhlTraditionalPlayersPageProps) {
  const { leagueId } = await params;
  const filters = await searchParams;

  return (
    <NhlTraditionalPlayers
      leagueId={leagueId}
      filters={filters}
    />
  );
}