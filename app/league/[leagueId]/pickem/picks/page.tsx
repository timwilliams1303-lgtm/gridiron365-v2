import { redirect } from "next/navigation";

type PageProps = {
  params: Promise<{
    leagueId: string;
  }>;
};

export default async function PickemPicksPage({
  params,
}: PageProps) {
  const { leagueId } = await params;

  redirect(
    `/league/${leagueId}/pickem/my-picks`
  );
}