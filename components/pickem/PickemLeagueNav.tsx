"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";


type Props = {
  leagueId: string;
  isCommissioner: boolean;
};


const links = [
  ["Home", "Home", ""],
  ["My Picks", "Picks", "/pickem/my-picks"],
  ["League Picks", "League", "/pickem/league-picks"],
  ["Games", "Games", "/pickem/games"],
  ["Standings", "Standings", "/pickem/standings"],
  ["Recap", "Recap", "/pickem/recap"],
  ["Settings", "Settings", "/pickem/settings"],
] as const;


const linkStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 40,
  minWidth: 0,
  padding: "8px 13px",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "rgba(255,255,255,0.10)",
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


const activeLinkStyle: React.CSSProperties = {
  borderColor: "rgba(255,95,31,0.72)",
  color: "#ffffff",
  background:
    "linear-gradient(135deg, rgba(166,14,20,0.62), rgba(255,102,0,0.48))",
  boxShadow: "inset 0 0 0 1px rgba(255,135,36,0.10)",
};


export default function PickemLeagueNav({
  leagueId,
  isCommissioner,
}: Props) {
  const pathname =
    usePathname();

  const leagueRoot =
    `/league/${leagueId}`;

  function isActive(href: string) {
    if (href === leagueRoot) {
      return pathname === leagueRoot;
    }

    return pathname === href || pathname.startsWith(`${href}/`);
  }

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

        .g365-pickem-nav .g365-mobile-label {
          display: none;
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

          .g365-pickem-nav .g365-desktop-label {
            display: none;
          }

          .g365-pickem-nav .g365-mobile-label {
            display: inline;
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
        {links.map(([label, mobileLabel, suffix]) => {
          const href =
            suffix === ""
              ? `/league/${leagueId}`
              : `/league/${leagueId}${suffix}`;

          return (
            <Link
              key={href}
              href={href}
              aria-current={
                isActive(href)
                  ? "page"
                  : undefined
              }
              style={{
                ...linkStyle,
                ...(isActive(href)
                  ? activeLinkStyle
                  : {}),
              }}
            >
              <span className="g365-desktop-label">
                {label}
              </span>
              <span className="g365-mobile-label">
                {mobileLabel}
              </span>
            </Link>
          );
        })}

        {isCommissioner ? (
          <Link
            href={`/league/${leagueId}/commissioner`}
            aria-current={
              isActive(`/league/${leagueId}/commissioner`)
                ? "page"
                : undefined
            }
            style={{
              ...linkStyle,
              ...(isActive(`/league/${leagueId}/commissioner`)
                ? activeLinkStyle
                : {}),
            }}
          >
            <span className="g365-desktop-label">
              Commissioner
            </span>
            <span className="g365-mobile-label">
              Commish
            </span>
          </Link>
        ) : null}
      </nav>
    </>
  );
}
