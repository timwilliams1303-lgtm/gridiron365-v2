"use client";

import Link from "next/link";

import {
  usePathname,
} from "next/navigation";


type NflPlayoffsLeagueNavProps = {
  leagueId: string;

  season: number;

  isCommissioner:
    boolean;
};


type NavItem = {
  label: string;

  mobileLabel: string;

  href: string;

  exact?: boolean;
};


export default function NflPlayoffsLeagueNav({
  leagueId,
  season,
  isCommissioner,
}: NflPlayoffsLeagueNavProps) {
  const pathname =
    usePathname();


  const base =
    `/league/${leagueId}`;


  const items:
    NavItem[] = [
      {
        label:
          "Home",

        mobileLabel:
          "Home",

        href:
          base,

        exact:
          true,
      },

      {
        label:
          "My Entry",

        mobileLabel:
          "My Entry",

        href:
          `${base}/entry`,
      },

      {
        label:
          "League Teams",

        mobileLabel:
          "Teams",

        href:
          `${base}/teams`,
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
          `${season} NFL Playoffs`,

        mobileLabel:
          "Playoffs",

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

      ...(isCommissioner
        ? [
            {
              label:
                "Settings",

              mobileLabel:
                "Settings",

              href:
                `${base}/nfl-playoffs/settings`,
            },

            {
              label:
                "Commissioner",

              mobileLabel:
                "Commish",

              href:
                `${base}/commissioner`,
            },
          ]
        : []),
    ];


  function isActive(
    item: NavItem
  ) {
    if (
      item.exact
    ) {
      return (
        pathname ===
        item.href
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
      aria-label="NFL Playoffs League Navigation"
      className="g365-nfl-playoffs-nav"
      style={
        styles.nav
      }
    >
      <style>{`
        .g365-nfl-playoffs-nav .g365-nflp-mobile-label {
          display: none;
        }

        @media (max-width: 760px) {
          .g365-nfl-playoffs-nav > div {
            display: grid !important;
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 7px !important;
            padding: 9px 10px !important;
            overflow-x: visible !important;
          }

          .g365-nfl-playoffs-nav a {
            width: 100%;
            min-width: 0;
            min-height: 44px !important;
            padding: 8px 7px !important;
            border: 1px solid rgba(255,255,255,.08);
            border-radius: 9px;
            white-space: normal !important;
            text-align: center;
            line-height: 1.15;
          }

          .g365-nfl-playoffs-nav .g365-nflp-desktop-label {
            display: none;
          }

          .g365-nfl-playoffs-nav .g365-nflp-mobile-label {
            display: inline;
          }
        }

        @media (max-width: 390px) {
          .g365-nfl-playoffs-nav > div {
            gap: 6px !important;
            padding: 8px !important;
          }

          .g365-nfl-playoffs-nav a {
            min-height: 42px !important;
            padding: 7px 6px !important;
            font-size: 10px !important;
          }
        }
      `}</style>


      <div
        style={
          styles.inner
        }
      >
        {items.map(
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
                style={{
                  ...styles.link,

                  ...(active
                    ? styles.linkActive
                    : {}),
                }}
              >
                <span className="g365-nflp-desktop-label">
                  {
                    item.label
                  }
                </span>


                <span className="g365-nflp-mobile-label">
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


const styles = {
  nav: {
    width:
      "100%",

    borderTop:
      "1px solid rgba(255,255,255,.06)",

    borderBottom:
      "1px solid rgba(255,255,255,.08)",

    background:
      "linear-gradient(180deg,rgba(15,15,17,.98),rgba(8,8,10,.98))",
  },


  inner: {
    width:
      "min(1420px,100%)",

    margin:
      "0 auto",

    display:
      "flex",

    alignItems:
      "center",

    gap:
      "4px",

    padding:
      "0 18px",

    overflowX:
      "auto" as const,
  },


  link: {
    flex:
      "0 0 auto",

    minHeight:
      "48px",

    display:
      "inline-flex",

    alignItems:
      "center",

    justifyContent:
      "center",

    padding:
      "0 15px",

    borderBottomWidth:
      "2px",

    borderBottomStyle:
      "solid",

    borderBottomColor:
      "transparent",

    color:
      "#c7cbd2",

    fontSize:
      "11px",

    fontWeight:
      900,

    letterSpacing:
      ".025em",

    textDecoration:
      "none",

    whiteSpace:
      "nowrap" as const,

    transition:
      "border-color .15s ease, color .15s ease, background .15s ease",
  },


  linkActive: {
    borderBottomColor:
      "#ff5d22",

    color:
      "#ffffff",

    background:
      "linear-gradient(180deg,rgba(210,42,24,.11),rgba(255,92,28,.04))",
  },
} satisfies Record<
  string,
  React.CSSProperties
>;