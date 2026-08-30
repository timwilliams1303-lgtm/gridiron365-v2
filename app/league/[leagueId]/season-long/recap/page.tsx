import SeasonLongRecap from "@/components/season-long/SeasonLongRecap";

type PageProps = {
  params: Promise<{
    leagueId: string;
  }>;

  searchParams: Promise<{
    week?: string;
  }>;
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function SeasonLongRecapPage({
  params,
  searchParams,
}: PageProps) {
  const {
    leagueId,
  } = await params;

  const {
    week,
  } = await searchParams;

  return (
    <SeasonLongRecap
      leagueId={leagueId}
    />
  );
}