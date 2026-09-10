"use client";

import Link from "next/link";
import {
  usePathname,
} from "next/navigation";

import {
  getLeagueCapabilities,
  type G365LeagueType,
  type SeasonLongCompetitionFormat,
} from "@/lib/leagues/leagueCapabilities";

import {
  getLeagueNavItems,
  type LeagueNavItem,
} from "@/lib/leagues/leagueRoutes";


type Props = {
  leagueId: string;
  leagueType: G365LeagueType;
  isCommissioner?: boolean;
  competitionFormat?: SeasonLongCompetitionFormat | null;
  playoffsEnabled?: boolean;
  ariaLabel?: string;
};


function itemIsActive(
  pathname: string,
  item: LeagueNavItem
) {
  if (item.exact) {
    return pathname === item.href;
  }

  return (
    pathname === item.href ||
    pathname.startsWith(
      `${item.href}/`
    )
  );
}


export default function LeagueNav({
  leagueId,
  leagueType,
  isCommissioner = false,
  competitionFormat = null,
  playoffsEnabled = false,
  ariaLabel = "League navigation",
}: Props) {
  const pathname =
    usePathname();

  const capabilities =
    getLeagueCapabilities({
      leagueType,
      competitionFormat,
      playoffsEnabled,
      isCommissioner,
    });

  const items =
    getLeagueNavItems({
      leagueId,
      leagueType,
      competitionFormat,
      playoffsEnabled,
      isCommissioner,
    }).filter(
      (item) =>
        capabilities[item.key]
    );

  return (
    <nav
      aria-label={ariaLabel}
      className="g365-universal-league-nav"
    >
      <style>{`
        .g365-universal-league-nav,
        .g365-universal-league-nav * {
          box-sizing: border-box;
        }

        .g365-universal-league-nav {
          width: 100%;
          border-top: 1px solid rgba(255,255,255,.06);
          border-bottom: 1px solid rgba(255,255,255,.08);
          background:
            linear-gradient(
              180deg,
              rgba(15,15,17,.98),
              rgba(8,8,10,.98)
            );
        }

        .g365-universal-league-nav-inner {
          width: min(1420px,100%);
          margin: 0 auto;
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 0 18px;
          overflow-x: auto;
          overflow-y: hidden;
          -webkit-overflow-scrolling: touch;
          overscroll-behavior-x: contain;
          scrollbar-width: thin;
        }

        .g365-universal-league-nav-link {
          position: relative;
          flex: 0 0 auto;
          min-height: 48px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0 15px;
          border: 0;
          border-bottom: 2px solid transparent;
          color: #b4b7bd;
          background: transparent;
          text-decoration: none;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: .045em;
          text-transform: uppercase;
          white-space: nowrap;
          transition:
            color .15s ease,
            background .15s ease,
            border-color .15s ease;
        }

        .g365-universal-league-nav-link:hover {
          color: #fff;
          background: rgba(255,255,255,.035);
        }

        .g365-universal-league-nav-link-active {
          color: #fff;
          border-bottom-color: #ff6427;
          background:
            linear-gradient(
              180deg,
              rgba(160,20,20,.14),
              rgba(255,95,31,.08)
            );
        }

        .g365-universal-league-nav-mobile-label {
          display: none;
        }

        @media (max-width: 760px) {
          .g365-universal-league-nav-inner {
            gap: 7px;
            padding: 8px 10px;
            scroll-snap-type: x proximity;
          }

          .g365-universal-league-nav-link {
            min-width: 88px;
            min-height: 42px;
            padding: 8px 10px;
            border: 1px solid rgba(255,255,255,.08);
            border-radius: 9px;
            font-size: 10px;
            letter-spacing: .035em;
            line-height: 1.1;
            scroll-snap-align: start;
          }

          .g365-universal-league-nav-link-active {
            border-color: rgba(255,98,35,.72);
            background:
              linear-gradient(
                135deg,
                rgba(166,14,20,.62),
                rgba(255,102,0,.48)
              );
            box-shadow:
              inset 0 0 0 1px rgba(255,135,36,.10);
          }

          .g365-universal-league-nav-desktop-label {
            display: none;
          }

          .g365-universal-league-nav-mobile-label {
            display: inline;
          }
        }
      `}</style>

      <div className="g365-universal-league-nav-inner">
        {items.map(
          (item) => {
            const active =
              itemIsActive(
                pathname,
                item
              );

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={
                  active
                    ? "page"
                    : undefined
                }
                className={[
                  "g365-universal-league-nav-link",
                  active
                    ? "g365-universal-league-nav-link-active"
                    : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <span className="g365-universal-league-nav-desktop-label">
                  {item.label}
                </span>

                <span className="g365-universal-league-nav-mobile-label">
                  {item.mobileLabel}
                </span>
              </Link>
            );
          }
        )}
      </div>
    </nav>
  );
}