import Link from "next/link";
import { notFound } from "next/navigation";

import GreyhoundConfirmedRaceCards from "@/components/greyhound/GreyhoundConfirmedRaceCards";
import GreyhoundEntriesImporter from "@/components/greyhound/GreyhoundEntriesImporter";
import GreyhoundRaceCardImporter from "@/components/greyhound/GreyhoundRaceCardImporter";
import { requireLeagueMember } from "@/lib/leagues/requireLeagueMember";

type Props = {
  params: Promise<{ leagueId: string }>;
};

export default async function GreyhoundRaceCardsPage({ params }: Props) {
  const { leagueId } = await params;

  const membership = await requireLeagueMember(leagueId);

  if (!membership.isCommissioner) {
    notFound();
  }

  return (
    <main style={{ display: "grid", gap: 16 }}>
      <Link
        href={`/league/${leagueId}/greyhound/commissioner`}
        style={backButtonStyle}
      >
        ← Back to Commissioner
      </Link>

      <GreyhoundConfirmedRaceCards leagueId={leagueId} />
      <GreyhoundEntriesImporter leagueId={leagueId} />
      <GreyhoundRaceCardImporter leagueId={leagueId} />
    </main>
  );
}

const backButtonStyle: React.CSSProperties = {
  width: "fit-content",
  minHeight: 44,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "9px 15px",
  border: "1px solid rgba(255,106,0,.5)",
  borderRadius: 11,
  background:
    "linear-gradient(135deg,rgba(255,61,0,.14),rgba(255,106,0,.08)),#141518",
  color: "#ff7a1a",
  fontSize: 13,
  fontWeight: 900,
  textDecoration: "none",
};