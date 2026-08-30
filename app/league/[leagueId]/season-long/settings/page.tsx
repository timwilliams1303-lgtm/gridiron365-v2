import SeasonLongSettings from "@/components/season-long/SeasonLongSettings";

type PageProps = {
  params: Promise<{
    leagueId: string;
  }>;
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function SeasonLongSettingsPage({
  params,
}: PageProps) {
  const {
    leagueId,
  } = await params;

  return (
    <SeasonLongSettings
      leagueId={leagueId}
    />
  );
}