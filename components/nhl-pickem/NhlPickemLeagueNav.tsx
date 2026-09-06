"use client";

import Link from "next/link";

import {
  usePathname,
} from "next/navigation";

type Props = {
  leagueId: string;
  isCommissioner: boolean;
};

type NavItem = {
  desktopLabel: string;
  mobileLabel: string;
  path: string;
};

const linkStyle:
  React.CSSProperties = {
    display:
      "inline-flex",
    alignItems:
      "center",
    justifyContent:
      "center",
    minHeight:
      40,
    minWidth:
      0,
    padding:
      "8px 13px",
    borderWidth:
      1,
    borderStyle:
      "solid",
    borderColor:
      "rgba(255,255,255,0.10)",
    borderRadius:
      9,
    color:
      "#f5f5f5",
    textDecoration:
      "none",
    fontSize:
      12,
    fontWeight:
      900,
    letterSpacing:
      "0.05em",
    textTransform:
      "uppercase",
    background:
      "rgba(255,255,255,0.035)",
    textAlign:
      "center",
  };

const activeLinkStyle:
  React.CSSProperties = {
    borderColor:
      "rgba(255,95,31,0.72)",
    color:
      "#ffffff",
    background:
      "linear-gradient(135deg,rgba(166,14,20,0.62),rgba(255,102,0,0.48))",
    boxShadow:
      "inset 0 0 0 1px rgba(255,135,36,0.10)",
  };

export default function NhlPickemLeagueNav({
  leagueId,
  isCommissioner,
}: Props) {
  const pathname =
    usePathname();

  const leagueRoot =
    `/league/${leagueId}/nhl-pickem`;

  const links:
    NavItem[] = [
      {
        desktopLabel:
          "Home",
        mobileLabel:
          "Home",
        path:
          "",
      },
      {
        desktopLabel:
          "My Picks",
        mobileLabel:
          "Picks",
        path:
          "/my-picks",
      },
      {
        desktopLabel:
          "League Picks",
        mobileLabel:
          "League",
        path:
          "/league-picks",
      },
      {
        desktopLabel:
          "Games",
        mobileLabel:
          "Games",
        path:
          "/games",
      },
      {
        desktopLabel:
          "Standings",
        mobileLabel:
          "Standings",
        path:
          "/standings",
      },
      {
        desktopLabel:
          "Recap",
        mobileLabel:
          "Recap",
        path:
          "/recap",
      },
      {
        desktopLabel:
          "Trophy Case",
        mobileLabel:
          "Trophies",
        path:
          "/trophy-case",
      },
      {
        desktopLabel:
          "Settings",
        mobileLabel:
          "Settings",
        path:
          "/settings",
      },
    ];

  function isActive(
    href: string
  ) {
    if (
      href ===
      leagueRoot
    ) {
      return (
        pathname ===
        leagueRoot
      );
    }

    return (
      pathname ===
        href ||
      pathname.startsWith(
        `${href}/`
      )
    );
  }

  return (
    <>
      <style>{`
        .g365-nhl-pickem-nav {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          padding: 10px 18px;
          border-top: 1px solid rgba(255,255,255,0.07);
          border-bottom: 1px solid rgba(255,255,255,0.08);
          background: rgba(8,8,10,0.96);
        }

        .g365-nhl-pickem-nav .g365-mobile-label {
          display: none;
        }

        @media (max-width: 760px) {
          .g365-nhl-pickem-nav {
            display: grid;
            grid-template-columns: repeat(2,minmax(0,1fr));
            gap: 7px;
            padding: 9px 10px;
          }

          .g365-nhl-pickem-nav a {
            width: 100%;
            min-width: 0;
            min-height: 44px;
            padding: 8px 7px !important;
            font-size: 10px !important;
            letter-spacing: 0.035em !important;
            line-height: 1.15;
            white-space: normal;
          }

          .g365-nhl-pickem-nav .g365-desktop-label {
            display: none;
          }

          .g365-nhl-pickem-nav .g365-mobile-label {
            display: inline;
          }
        }

        @media (max-width: 420px) {
          .g365-nhl-pickem-nav {
            gap: 6px;
            padding: 8px;
          }

          .g365-nhl-pickem-nav a {
            min-height: 42px;
            font-size: 9px !important;
          }
        }
      `}</style>

      <nav
        className="g365-nhl-pickem-nav"
        aria-label="G365 NHL Pick'em Navigation"
      >
        {links.map(
          (item) => {
            const href =
              `${leagueRoot}${item.path}`;

            const active =
              isActive(
                href
              );

            return (
              <Link
                key={
                  href
                }
                href={
                  href
                }
                aria-current={
                  active
                    ? "page"
                    : undefined
                }
                style={{
                  ...linkStyle,
                  ...(active
                    ? activeLinkStyle
                    : {}),
                }}
              >
                <span className="g365-desktop-label">
                  {
                    item.desktopLabel
                  }
                </span>

                <span className="g365-mobile-label">
                  {
                    item.mobileLabel
                  }
                </span>
              </Link>
            );
          }
        )}

        {isCommissioner ? (
          <Link
            href={`${leagueRoot}/commissioner`}
            aria-current={
              isActive(
                `${leagueRoot}/commissioner`
              )
                ? "page"
                : undefined
            }
            style={{
              ...linkStyle,
              borderColor:
                "rgba(255,95,31,0.55)",
              background:
                isActive(
                  `${leagueRoot}/commissioner`
                )
                  ? activeLinkStyle.background
                  : "linear-gradient(135deg,rgba(166,14,20,0.42),rgba(255,102,0,0.34))",
              boxShadow:
                isActive(
                  `${leagueRoot}/commissioner`
                )
                  ? activeLinkStyle.boxShadow
                  : undefined,
            }}
          >
            <span className="g365-desktop-label">
              Commissioner
            </span>

            <span className="g365-mobile-label">
              Commissioner
            </span>
          </Link>
        ) : null}
      </nav>
    </>
  );
}