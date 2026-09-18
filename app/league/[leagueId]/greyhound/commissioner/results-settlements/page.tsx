import Link from "next/link";
import { notFound } from "next/navigation";

import { requireLeagueMember } from "@/lib/leagues/requireLeagueMember";

type Props = {
  params: Promise<{ leagueId: string }>;
};

export default async function GreyhoundResultsSettlementsPage({
  params,
}: Props) {
  const { leagueId } = await params;

  const membership = await requireLeagueMember(leagueId);

  if (!membership.isCommissioner) {
    notFound();
  }

  return (
    <main style={styles.page}>
      <Link
        href={`/league/${leagueId}/greyhound/commissioner`}
        style={styles.backButton}
      >
        ← Back to Commissioner
      </Link>

      <section style={styles.panel}>
        <div style={styles.eyebrow}>GREYHOUND COMMISSIONER</div>
        <h1 style={styles.title}>Results & Settlements</h1>
        <p style={styles.description}>
          Manage race results, grading, settlements, and completed race
          processing.
        </p>
      </section>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    display: "grid",
    gap: 16,
  },

  backButton: {
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
  },

  panel: {
    padding: 22,
    border: "1px solid #292b30",
    borderRadius: 16,
    background: "#141518",
  },

  eyebrow: {
    color: "#ff6a00",
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: ".14em",
  },

  title: {
    margin: "7px 0 0",
    color: "#fff",
    fontSize: 28,
  },

  description: {
    margin: "10px 0 0",
    color: "#9a9da5",
    fontSize: 14,
  },
};