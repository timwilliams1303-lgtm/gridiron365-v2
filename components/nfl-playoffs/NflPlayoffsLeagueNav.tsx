"use client";

import Link from "next/link";

import {
  usePathname,
} from "next/navigation";


type Props = {
  leagueId: string;
  season: number;
  isCommissioner: boolean;
};


type NavItem = {
  label: string;
  mobileLabel: string;
  href: string;
};


export default function NflPlayoffsLeagueNav({
  leagueId,
  season,
  isCommissioner,
}: Props) {
  const pathname =
    usePathname();


  const base =
    `/league/${leagueId}`;


  const navItems:
    NavItem[] = [
      {
        label:
          "Home",

        mobileLabel:
          "Home",

        href:
          base,
      },

      {
        label:
          "My Entry",

        mobileLabel:
          "Entry",

        href:
          `${base}/entry`,
      },

      {
        label:
          "League Teams",

        mobileLabel:
          "Teams",

        href:
          `${base}/nfl-playoffs/teams`,
      },

      {
        label:
          "Standings",

        mobileLabel:
          "Standings",

        href:
          `${base}/nfl-playoffs/standings`,
      },

      {
        label:
          "Playoffs",

        mobileLabel:
          "Bracket",

        href:
          `${base}/nfl-playoffs/playoffs`,
      },

      {
        label:
          "Recap",

        mobileLabel:
          "Recap",

        href:
          `${base}/nfl-playoffs/recap`,
      },

      {
        label:
          "Trophy Case",

        mobileLabel:
          "Trophies",

        href:
          `${base}/nfl-playoffs/trophy-case`,
      },
    ];


  if (
    isCommissioner
  ) {
    navItems.push(
      {
        label:
          "Commissioner",

        mobileLabel:
          "Commish",

        href:
          `${base}/commissioner`,
      },

      {
        label:
          "Settings",

        mobileLabel:
          "Settings",

        href:
          `${base}/nfl-playoffs/settings`,
      }
    );
  }


  function isActive(
    item:
      NavItem
  ) {
    if (
      item.href ===
      base
    ) {
      return (
        pathname ===
          base ||
        pathname ===
          `${base}/`
      );
    }


    return (
      pathname ===
        item.href ||
      pathname.startsWith(
        `${item.href}/`
      )
    );
  }


  return (
    <nav
      className="g365-nfl-playoffs-nav"
      aria-label={`${season} NFL Playoffs league navigation`}
    >
      <style>{`
        .g365-nfl-playoffs-nav {
          position: relative;
          width: 100%;
          overflow: hidden;
          border-top: 1px solid rgba(255,255,255,.07);
          border-bottom: 1px solid rgba(255,255,255,.09);
          background:
            linear-gradient(
              180deg,
              rgba(21,21,24,.98),
              rgba(12,12,14,.98)
            );
        }

        .g365-nfl-playoffs-nav *,
        .g365-nfl-playoffs-nav *::before,
        .g365-nfl-playoffs-nav *::after {
          box-sizing: border-box;
        }

        .g365-nfl-playoffs-nav-scroll {
          display: flex;
          align-items: stretch;
          gap: 4px;
          width: 100%;
          overflow-x: auto;
          overflow-y: hidden;
          padding: 8px 12px;
          scrollbar-width: thin;
          scrollbar-color:
            rgba(255,92,28,.55)
            rgba(255,255,255,.04);
          -webkit-overflow-scrolling: touch;
        }

        .g365-nfl-playoffs-nav-scroll::-webkit-scrollbar {
          height: 5px;
        }

        .g365-nfl-playoffs-nav-scroll::-webkit-scrollbar-track {
          background:
            rgba(255,255,255,.04);
        }

        .g365-nfl-playoffs-nav-scroll::-webkit-scrollbar-thumb {
          border-radius: 999px;
          background:
            rgba(255,92,28,.55);
        }

        .g365-nfl-playoffs-nav-link {
          position: relative;
          display: inline-flex;
          flex: 0 0 auto;
          align-items: center;
          justify-content: center;
          min-height: 40px;
          padding: 9px 14px;
          border: 1px solid transparent;
          border-radius: 9px;
          color: #a9adb5;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: .035em;
          line-height: 1;
          text-decoration: none;
          white-space: nowrap;
          transition:
            color .18s ease,
            border-color .18s ease,
            background .18s ease,
            transform .18s ease;
        }

        .g365-nfl-playoffs-nav-link:hover {
          color: #ffffff;
          border-color:
            rgba(255,94,28,.24);
          background:
            rgba(255,82,18,.07);
        }

        .g365-nfl-playoffs-nav-link:active {
          transform:
            translateY(1px);
        }

        .g365-nfl-playoffs-nav-link-active {
          color: #ffffff;
          border-color:
            rgba(255,93,25,.48);
          background:
            linear-gradient(
              135deg,
              rgba(189,28,16,.32),
              rgba(255,90,18,.20)
            );
          box-shadow:
            inset 0 -2px 0
            rgba(255,92,26,.95);
        }

        .g365-nfl-playoffs-nav-desktop {
          display: inline;
        }

        .g365-nfl-playoffs-nav-mobile {
          display: none;
        }

        @media (max-width: 760px) {
          .g365-nfl-playoffs-nav-scroll {
            gap: 3px;
            padding:
              7px 8px;
          }

          .g365-nfl-playoffs-nav-link {
            min-height: 38px;
            padding:
              8px 11px;
            font-size:
              11px;
          }

          .g365-nfl-playoffs-nav-desktop {
            display: none;
          }

          .g365-nfl-playoffs-nav-mobile {
            display: inline;
          }
        }
      `}</style>


      <div
        className="g365-nfl-playoffs-nav-scroll"
      >
        {navItems.map(
          (
            item
          ) => {
            const active =
              isActive(
                item
              );


            return (
              <Link
                key={
                  item.href
                }
                href={
                  item.href
                }
                className={[
                  "g365-nfl-playoffs-nav-link",

                  active
                    ? "g365-nfl-playoffs-nav-link-active"
                    : "",
                ]
                  .filter(
                    Boolean
                  )
                  .join(
                    " "
                  )}
                aria-current={
                  active
                    ? "page"
                    : undefined
                }
              >
                <span
                  className="g365-nfl-playoffs-nav-desktop"
                >
                  {
                    item.label
                  }
                </span>

                <span
                  className="g365-nfl-playoffs-nav-mobile"
                >
                  {
                    item.mobileLabel
                  }
                </span>
              </Link>
            );
          }
        )}
      </div>
    </nav>
  );
}