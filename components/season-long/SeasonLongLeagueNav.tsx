"use client";

import Link from "next/link";

import {
  usePathname,
} from "next/navigation";


type SeasonLongLeagueNavProps = {
  leagueId:
    string;
};


type NavItem = {
  label:
    string;

  href:
    string;

  exact?:
    boolean;
};


export default function SeasonLongLeagueNav({
  leagueId,
}: SeasonLongLeagueNavProps) {
  const pathname =
    usePathname();


  const items:
    NavItem[] = [
      {
        label:
          "Home",

        href:
          `/league/${leagueId}`,

        exact:
          true,
      },

      {
        label:
          "My Entry",

        href:
          `/league/${leagueId}/entry`,
      },

      {
        label:
          "League Teams",

        href:
          `/league/${leagueId}/teams`,
      },

      {
        label:
          "Standings",

        href:
          `/league/${leagueId}/standings`,
      },

      {
        label:
          "Commissioner",

        href:
          `/league/${leagueId}/commissioner`,
      },
    ];


  return (
    <nav
      aria-label="Season-Long League Navigation"
      style={
        styles.nav
      }
    >
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
              item.exact
                ? pathname ===
                  item.href
                : pathname ===
                    item.href ||
                  pathname.startsWith(
                    `${item.href}/`
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
                {item.label}
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

    borderBottom:
      "2px solid transparent",

    color:
      "#8f96a3",

    fontSize:
      "11px",

    fontWeight:
      900,

    textDecoration:
      "none",

    whiteSpace:
      "nowrap" as const,

    transition:
      "color .15s ease,border-color .15s ease,background .15s ease",
  },

  linkActive: {
    borderBottom:
      "2px solid #ff7200",

    background:
      "linear-gradient(180deg,rgba(255,74,0,.08),rgba(255,74,0,.02))",

    color:
      "#ffffff",
  },
} as const;