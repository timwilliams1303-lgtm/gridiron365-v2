import Link from "next/link";
import { redirect } from "next/navigation";

import GreyhoundSeasonControl from "@/components/greyhound/GreyhoundSeasonControl";
import { requireLeagueMember } from "@/lib/leagues/requireLeagueMember";

type PageProps = {
  params: Promise<{
    leagueId: string;
  }>;
};

export default async function GreyhoundSeasonControlPage({
  params,
}: PageProps) {
  const { leagueId } = await params;

  const access = await requireLeagueMember(leagueId);

  if (
    String(access.league.leagueType) !== "greyhound" ||
    !access.isCommissioner
  ) {
    redirect(`/league/${leagueId}`);
  }

  return (
    <>
      <div style={styles.nav}>
        <Link
          href={`/league/${leagueId}/greyhound/commissioner`}
          style={styles.back}
        >
          ← BACK TO COMMISSIONER
        </Link>
      </div>

      <GreyhoundSeasonControl leagueId={leagueId} />
    </>
  );
}

const styles: Record<string, React.CSSProperties> = {
  nav: {
    width: "min(1200px, calc(100% - 20px))",
    margin: "12px auto 0",
  },
  back: {
    display: "inline-flex",
    alignItems: "center",
    minHeight: 38,
    padding: "8px 12px",
    border: "1px solid #4b2a1d",
    borderRadius: 7,
    background: "#17110e",
    color: "#ff7b31",
    textDecoration: "none",
    fontSize: 10,
    fontWeight: 1000,
    letterSpacing: 0.5,
  },
};