import PickemLeagueHome from "@/components/pickem/PickemLeagueHome";
import SeasonLongLeagueHome from "@/components/season-long/SeasonLongLeagueHome";
import TraditionalLeagueHome from "@/components/traditional/TraditionalLeagueHome";
import NflPlayoffsLeagueHome from "@/components/nfl-playoffs/NflPlayoffsLeagueHome";

import {
  requireLeagueMember,
} from "@/lib/leagues/requireLeagueMember";


type PageProps = {
  params: Promise<{
    leagueId: string;
  }>;
};


export default async function LeagueHomePage({
  params,
}: PageProps) {
  const {
    leagueId,
  } =
    await params;


  const access =
    await requireLeagueMember(
      leagueId
    );


  const leagueType =
    String(
      access.league.leagueType
    );


  switch (
    leagueType
  ) {
    case "traditional":
      return (
        <TraditionalLeagueHome
          leagueId={
            leagueId
          }
        />
      );


    case "season_long":
      return (
        <SeasonLongLeagueHome
          leagueId={
            leagueId
          }
        />
      );


    case "pickem":
      return (
        <PickemLeagueHome
          leagueId={
            leagueId
          }
        />
      );


    case "nfl_playoffs":
      return (
        <NflPlayoffsLeagueHome
          leagueId={
            leagueId
          }
        />
      );


    case "greyhound":
      return (
        <main className="min-h-screen bg-[#090909] px-4 py-8 text-white sm:px-6">
          <div className="mx-auto max-w-5xl">
            <section className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950">
              <div className="border-b border-zinc-800 bg-gradient-to-r from-red-950/60 via-zinc-950 to-orange-950/40 px-6 py-6">
                <div className="text-xs font-black uppercase tracking-[0.2em] text-orange-400">
                  G365 Greyhound Racing
                </div>

                <h1 className="mt-2 text-3xl font-black">
                  Greyhound Racing
                </h1>

                <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
                  Race cards, wagers, results, standings, recap, and league competition
                  will live here as the Greyhound experience is completed.
                </p>
              </div>

              <div className="p-6">
                <div className="rounded-2xl border border-zinc-800 bg-black/30 p-6">
                  <div className="text-lg font-black">
                    Greyhound league home
                  </div>

                  <p className="mt-2 text-sm leading-6 text-zinc-400">
                    Commissioners can use the Commissioner tab to manage race cards and
                    race-day operations.
                  </p>
                </div>
              </div>
            </section>
          </div>
        </main>
      );


    default:
      throw new Error(
        `Unsupported league type: ${leagueType}`
      );
  }
}
