import Link from "next/link";
import { redirect } from "next/navigation";

import { requireLeagueMember } from "@/lib/leagues/requireLeagueMember";

type PageProps = {
  params: Promise<{
    leagueId: string;
  }>;
};

export default async function GreyhoundHomePage({
  params,
}: PageProps) {
  const { leagueId } = await params;

  const access = await requireLeagueMember(leagueId);

  if (String(access.league.leagueType) !== "greyhound") {
    redirect(`/league/${leagueId}`);
  }

  const base = `/league/${leagueId}/greyhound`;

  return (
    <main className="min-h-screen bg-[#090909] text-white">
      <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        {/* Back */}
        <div className="mb-5">
          <Link
            href={`/league/${leagueId}`}
            className="inline-flex min-h-11 items-center rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white transition hover:border-orange-500/40 hover:bg-white/[0.07]"
          >
            ← League Home
          </Link>
        </div>

        {/* Hero */}
        <section className="overflow-hidden rounded-3xl border border-red-500/20 bg-gradient-to-br from-[#181818] via-[#111111] to-[#080808] shadow-2xl">
          <div className="h-1.5 bg-gradient-to-r from-red-700 via-orange-500 to-red-700" />

          <div className="p-5 sm:p-7 lg:p-9">
            <div className="mb-3 inline-flex rounded-full border border-orange-500/25 bg-orange-500/10 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-orange-300">
              G365 Greyhound Racing
            </div>

            <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
              {access.league.name}
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400 sm:text-base">
              Your Greyhound Racing league headquarters. View today&apos;s
              racing action, place wagers, follow the league standings, and
              track the season.
            </p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link
                href={`${base}/wagers`}
                className="inline-flex min-h-12 items-center justify-center rounded-xl bg-gradient-to-r from-red-600 to-orange-500 px-5 py-3 text-sm font-black uppercase tracking-wide text-white shadow-lg transition hover:brightness-110"
              >
                Open Wager Board
              </Link>

              <Link
                href={`${base}/league-wagers`}
                className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] px-5 py-3 text-sm font-bold text-white transition hover:border-orange-500/40 hover:bg-white/[0.08]"
              >
                League Wagers
              </Link>
            </div>
          </div>
        </section>

        {/* Main navigation */}
        <section className="mt-6">
          <div className="mb-3">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-400">
              Greyhound Racing
            </p>

            <h2 className="mt-1 text-xl font-black text-white">
              League Center
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <HomeCard
              href={`${base}/wagers`}
              eyebrow="Racebook"
              title="My Wagers"
              description="View the race cards, build wagers, manage your bankroll, and review your tickets."
            />

            <HomeCard
              href={`${base}/league-wagers`}
              eyebrow="Live League"
              title="League Wagers"
              description="Follow league entries, wager totals, returns, open tickets, and live results."
            />

            <HomeCard
              href={`${base}/standings`}
              eyebrow="Competition"
              title="Standings"
              description="See the current Greyhound league standings and competition results."
            />

            <HomeCard
              href={`${base}/recap`}
              eyebrow="Results"
              title="Recap"
              description="Review completed racing action, results, and league performance."
            />

            <HomeCard
              href={`${base}/trophy-case`}
              eyebrow="History"
              title="Trophy Case"
              description="View champions, awards, and the historical accomplishments of the league."
            />

            <HomeCard
              href={`${base}/settings`}
              eyebrow="League"
              title="Settings"
              description="View the Greyhound league configuration and available league settings."
            />
          </div>
        </section>

        {/* Commissioner */}
        {access.isCommissioner ? (
          <section className="mt-6 rounded-3xl border border-red-500/20 bg-gradient-to-br from-red-950/20 via-[#111111] to-[#0a0a0a] p-5 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-red-400">
                  Commissioner
                </p>

                <h2 className="mt-1 text-xl font-black text-white">
                  Commissioner Center
                </h2>

                <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-400">
                  Manage race cards, results, scratches, teams, season
                  controls, and Greyhound league settings.
                </p>
              </div>

              <Link
                href={`${base}/commissioner`}
                className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-xl border border-red-500/30 bg-red-500/10 px-5 py-3 text-sm font-black text-red-100 transition hover:border-orange-500/50 hover:bg-red-500/20"
              >
                Commissioner Center →
              </Link>
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}

type HomeCardProps = {
  href: string;
  eyebrow: string;
  title: string;
  description: string;
};

function HomeCard({
  href,
  eyebrow,
  title,
  description,
}: HomeCardProps) {
  return (
    <Link
      href={href}
      className="group flex min-h-[170px] flex-col rounded-2xl border border-white/10 bg-gradient-to-br from-[#171717] to-[#0d0d0d] p-5 transition hover:-translate-y-0.5 hover:border-orange-500/40 hover:bg-[#181818]"
    >
      <span className="text-[11px] font-black uppercase tracking-[0.16em] text-orange-400">
        {eyebrow}
      </span>

      <h3 className="mt-2 text-xl font-black text-white transition group-hover:text-orange-100">
        {title}
      </h3>

      <p className="mt-2 flex-1 text-sm leading-6 text-zinc-400">
        {description}
      </p>

      <div className="mt-4 text-sm font-black text-orange-400">
        Open →
      </div>
    </Link>
  );
}