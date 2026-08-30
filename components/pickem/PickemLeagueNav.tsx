import Link from "next/link";


type Props = {
  leagueId: string;
  isCommissioner: boolean;
};


const linkStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 38,
  padding: "8px 13px",
  border: "1px solid rgba(255,255,255,0.10)",
  borderRadius: 9,
  color: "#f5f5f5",
  textDecoration: "none",
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  background: "rgba(255,255,255,0.035)",
};


export default function PickemLeagueNav({
  leagueId,
  isCommissioner,
}: Props) {
  const links = [
    ["Home", `/league/${leagueId}`],
    ["My Picks", `/league/${leagueId}/pickem/my-picks`],
    ["League Picks", `/league/${leagueId}/pickem/league-picks`],
    ["Games", `/league/${leagueId}/pickem/games`],
    ["Standings", `/league/${leagueId}/pickem/standings`],
    ["Recap", `/league/${leagueId}/pickem/recap`],
    ["Settings", `/league/${leagueId}/pickem/settings`],
  ] as const;

  return (
    <nav
      aria-label="G365 Football Pick'em Navigation"
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 8,
        padding: "10px 18px",
        borderTop: "1px solid rgba(255,255,255,0.07)",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        background: "rgba(8,8,10,0.96)",
      }}
    >
      {links.map(([label, href]) => (
        <Link
          key={href}
          href={href}
          style={linkStyle}
        >
          {label}
        </Link>
      ))}

      {isCommissioner ? (
        <Link
          href={`/league/${leagueId}/commissioner`}
          style={{
            ...linkStyle,
            borderColor: "rgba(255,95,31,0.55)",
            background:
              "linear-gradient(135deg, rgba(166,14,20,0.42), rgba(255,102,0,0.34))",
          }}
        >
          Commissioner
        </Link>
      ) : null}
    </nav>
  );
}
