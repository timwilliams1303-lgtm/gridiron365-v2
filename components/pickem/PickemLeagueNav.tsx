import Link from "next/link";


type Props = {
  leagueId: string;
  isCommissioner: boolean;
};


const links = [
  ["Home", ""],
  ["My Picks", "/pickem/my-picks"],
  ["League Picks", "/pickem/league-picks"],
  ["Games", "/pickem/games"],
  ["Standings", "/pickem/standings"],
  ["Recap", "/pickem/recap"],
  ["Settings", "/pickem/settings"],
] as const;


const linkStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 40,
  minWidth: 0,
  padding: "8px 13px",
  border: "1px solid rgba(255,255,255,0.10)",
  borderRadius: 9,
  color: "#f5f5f5",
  textDecoration: "none",
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: "0.05em",
  textTransform: "uppercase",
  background: "rgba(255,255,255,0.035)",
  textAlign: "center",
};


export default function PickemLeagueNav({
  leagueId,
  isCommissioner,
}: Props) {
  return (
    <>
      <style>{`
        .g365-pickem-nav {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          padding: 10px 18px;
          border-top: 1px solid rgba(255,255,255,0.07);
          border-bottom: 1px solid rgba(255,255,255,0.08);
          background: rgba(8,8,10,0.96);
        }

        @media (max-width: 760px) {
          .g365-pickem-nav {
            display: grid;
            grid-template-columns: repeat(2, minmax(0,1fr));
            gap: 7px;
            padding: 9px 10px;
          }

          .g365-pickem-nav a {
            width: 100%;
            min-width: 0;
            min-height: 44px;
            padding: 8px 7px !important;
            font-size: 10px !important;
            letter-spacing: 0.035em !important;
            line-height: 1.15;
            white-space: normal;
          }
        }

        @media (max-width: 390px) {
          .g365-pickem-nav {
            grid-template-columns: repeat(2, minmax(0,1fr));
            gap: 6px;
            padding: 8px;
          }
        }
      `}</style>

      <nav
        aria-label="G365 Football Pick'em Navigation"
        className="g365-pickem-nav"
      >
        {links.map(([label, suffix]) => {
          const href =
            suffix === ""
              ? `/league/${leagueId}`
              : `/league/${leagueId}${suffix}`;

          return (
            <Link
              key={href}
              href={href}
              style={linkStyle}
            >
              {label}
            </Link>
          );
        })}

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
    </>
  );
}
