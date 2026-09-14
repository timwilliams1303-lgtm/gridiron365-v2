import GreyhoundWagerWorkspace from "@/components/greyhound/wagers/GreyhoundWagerWorkspace";
import { requireLeagueMember } from "@/lib/leagues/requireLeagueMember";

type Props = {
  params: Promise<{
    leagueId: string;
  }>;
};

export default async function GreyhoundWagersPage({
  params,
}: Props) {
  const { leagueId } = await params;

  const access = await requireLeagueMember(leagueId);

  if (String(access.league.leagueType) !== "greyhound") {
    return null;
  }

  return (
    <main className="min-h-screen bg-[#080808] px-3 py-4 text-white sm:px-5 sm:py-6">
      <div className="mx-auto max-w-[1500px]">
        <GreyhoundWagerWorkspace leagueId={leagueId} />
      </div>
    </main>
  );
}
