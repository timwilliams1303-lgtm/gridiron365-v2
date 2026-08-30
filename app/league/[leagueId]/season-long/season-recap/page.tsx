import SeasonLongSeasonRecap from "../../../../../components/season-long/SeasonLongSeasonRecap";

type PageProps = {
  params:
    Promise<{
      leagueId: string;
    }>;
};

export const dynamic =
  "force-dynamic";

export const revalidate =
  0;

export default async function SeasonLongSeasonRecapPage({
  params,
}: PageProps) {
  const {
    leagueId,
  } =
    await params;

  return (
    <SeasonLongSeasonRecap
      leagueId={
        leagueId
      }
    />
  );
}
