"use client";

import Image from "next/image";
import Link from "next/link";
import {
  usePathname,
} from "next/navigation";


type TraditionalLeagueNavProps = {
  leagueId: string;
  leagueName: string;
  season: number;
  teamName: string | null;
  isCommissioner: boolean;
};


type NavigationItem = {
  label: string;
  href: string;
  commissionerOnly?: boolean;
};


export default function TraditionalLeagueNav({
  leagueId,
  leagueName,
  season,
  teamName,
  isCommissioner,
}: TraditionalLeagueNavProps) {
  const pathname =
    usePathname();


  const navigationItems:
    NavigationItem[] = [
    {
      label:
        "Home",

      href:
        `/league/${leagueId}`,
    },

    {
      label:
        "My Team",

      href:
        `/league/${leagueId}/team`,
    },

    {
      label:
        "Players",

      href:
        `/league/${leagueId}/players`,
    },

    {
      label:
        "Matchups",

      href:
        `/league/${leagueId}/matchups`,
    },

    {
      label:
        "Standings",

      href:
        `/league/${leagueId}/standings`,
    },

    {
      label:
        "Waivers",

      href:
        `/league/${leagueId}/waivers`,
    },

    {
      label:
        "Trades",

      href:
        `/league/${leagueId}/trades`,
    },

    {
      label:
        "Playoffs",

      href:
        `/league/${leagueId}/playoffs`,
    },

    {
      label:
        "Settings",

      href:
        `/league/${leagueId}/settings`,
    },

    {
      label:
        "Draft",

      href:
        `/league/${leagueId}/draft`,
    },

    {
      label:
        "Commissioner",

      href:
        `/league/${leagueId}/commissioner`,

      commissionerOnly:
        true,
    },
  ];


  const visibleItems =
    navigationItems.filter(
      (
        item
      ) =>
        !item
          .commissionerOnly ||
        isCommissioner
    );


  function isActive(
    href: string
  ) {
    if (
      href ===
      `/league/${leagueId}`
    ) {
      return (
        pathname === href
      );
    }

    return (
      pathname === href ||
      pathname.startsWith(
        `${href}/`
      )
    );
  }


  return (
    <header
      style={
        styles.header
      }
    >
      <div
        style={
          styles.topRow
        }
      >
        <Link
          href="/my-leagues"
          style={
            styles.logoLink
          }
        >
          <Image
            src="/branding/gridiron365-logo-compact.png"
            alt="Gridiron365"
            width={230}
            height={72}
            priority
            style={
              styles.logo
            }
          />
        </Link>


        <div
          style={
            styles.leagueIdentity
          }
        >
          <span
            style={
              styles.leagueLabel
            }
          >
            TRADITIONAL
          </span>

          <strong
            style={
              styles.leagueName
            }
          >
            {leagueName}
          </strong>

          <span
            style={
              styles.leagueMeta
            }
          >
            {season}

            {teamName
              ? ` • ${teamName}`
              : ""}
          </span>
        </div>


        <Link
          href="/my-leagues"
          style={
            styles.myLeaguesButton
          }
        >
          My Leagues
        </Link>
      </div>


      <nav
        aria-label="Traditional league navigation"
        style={
          styles.navViewport
        }
      >
        <div
          style={
            styles.nav
          }
        >
          {visibleItems.map(
            (
              item
            ) => {
              const active =
                isActive(
                  item.href
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
                    ...styles.navLink,

                    ...(active
                      ? styles.navLinkActive
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
    </header>
  );
}


const styles = {
  header: {
    width:
      "100%",

    borderBottom:
      "1px solid rgba(255,255,255,.08)",

    background:
      "linear-gradient(180deg,rgba(16,16,17,.98),rgba(8,8,9,.98))",

    boxShadow:
      "0 14px 35px rgba(0,0,0,.20)",
  },

  topRow: {
    width:
      "min(1400px,100%)",

    minHeight:
      "88px",

    margin:
      "0 auto",

    padding:
      "12px 18px",

    display:
      "grid",

    gridTemplateColumns:
      "minmax(180px,240px) minmax(0,1fr) auto",

    alignItems:
      "center",

    gap:
      "22px",
  },

  logoLink: {
    display:
      "inline-flex",

    alignItems:
      "center",

    textDecoration:
      "none",
  },

  logo: {
    width:
      "min(220px,100%)",

    height:
      "auto",

    objectFit:
      "contain" as const,

    objectPosition:
      "left center",
  },

  leagueIdentity: {
    minWidth:
      0,

    display:
      "grid",

    justifyItems:
      "center",

    gap:
      "3px",

    textAlign:
      "center" as const,
  },

  leagueLabel: {
    color:
      "#ff7a18",

    fontSize:
      "9px",

    fontWeight:
      900,

    letterSpacing:
      ".15em",
  },

  leagueName: {
    maxWidth:
      "100%",

    overflow:
      "hidden",

    textOverflow:
      "ellipsis",

    whiteSpace:
      "nowrap" as const,

    color:
      "#ffffff",

    fontSize:
      "19px",
  },

  leagueMeta: {
    color:
      "#7e838d",

    fontSize:
      "11px",

    fontWeight:
      700,
  },

  myLeaguesButton: {
    minHeight:
      "38px",

    padding:
      "9px 13px",

    display:
      "inline-flex",

    alignItems:
      "center",

    justifyContent:
      "center",

    border:
      "1px solid rgba(255,140,0,.22)",

    borderRadius:
      "8px",

    background:
      "rgba(255,90,0,.07)",

    color:
      "#ff8c00",

    fontSize:
      "11px",

    fontWeight:
      900,

    textDecoration:
      "none",

    whiteSpace:
      "nowrap" as const,
  },

  navViewport: {
    width:
      "100%",

    overflowX:
      "auto" as const,

    borderTop:
      "1px solid rgba(255,255,255,.05)",
  },

  nav: {
    width:
      "max-content",

    minWidth:
      "100%",

    margin:
      "0 auto",

    display:
      "flex",

    alignItems:
      "stretch",

    justifyContent:
      "center",
  },

  navLink: {
    position:
      "relative" as const,

    minHeight:
      "48px",

    padding:
      "0 16px",

    display:
      "inline-flex",

    alignItems:
      "center",

    justifyContent:
      "center",

    borderBottom:
      "3px solid transparent",

    color:
      "#8e949e",

    fontSize:
      "11px",

    fontWeight:
      900,

    textDecoration:
      "none",

    whiteSpace:
      "nowrap" as const,
  },

  navLinkActive: {
    borderBottom:
      "3px solid #ff5a00",

    background:
      "linear-gradient(180deg,rgba(255,70,0,.02),rgba(255,70,0,.09))",

    color:
      "#ffffff",
  },
};