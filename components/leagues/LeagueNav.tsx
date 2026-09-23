"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

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
  leagueName: string;
  leagueSeason?: number | null;
  leagueType: G365LeagueType;
  isCommissioner?: boolean;
  competitionFormat?: SeasonLongCompetitionFormat | null;
  playoffsEnabled?: boolean;
  ariaLabel?: string;
};

type LeagueChoice = {
  id: string;
  name: string;
  league_type: G365LeagueType;
  season: number | null;
};

function itemIsActive(pathname: string, item: LeagueNavItem) {
  if (item.exact) {
    return pathname === item.href;
  }

  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function leagueTypeLabel(leagueType: G365LeagueType) {
  switch (leagueType) {
    case "traditional":
      return "NFL Traditional";
    case "season_long":
      return "NFL Season-Long";
    case "nfl_playoffs":
      return "NFL Playoffs";
    case "pickem":
      return "G365 Pick'em";
    case "nhl_traditional":
      return "NHL Traditional";
    case "greyhound":
      return "Greyhound Racing";
    default:
      return "G365 League";
  }
}

export default function LeagueNav({
  leagueId,
  leagueName,
  leagueSeason = null,
  leagueType,
  isCommissioner = false,
  competitionFormat = null,
  playoffsEnabled = false,
  ariaLabel = "League navigation",
}: Props) {
  const pathname = usePathname();
  const router = useRouter();

  const [rankingsLocked, setRankingsLocked] = useState(false);
  const [leagueChoices, setLeagueChoices] = useState<LeagueChoice[]>([]);
  const [leagueChoicesLoading, setLeagueChoicesLoading] = useState(true);

  useEffect(() => {
    if (leagueType !== "nhl_traditional") {
      setRankingsLocked(false);
      return;
    }

    let cancelled = false;
    const supabase = createSupabaseBrowserClient();

    async function loadRankingsAvailability() {
      const { data, error } = await supabase.rpc(
        "get_nhl_traditional_draft_state",
        {
          p_league_id: leagueId,
        }
      );

      if (cancelled || error) {
        return;
      }

      const state =
        data && typeof data === "object"
          ? (data as Record<string, unknown>)
          : null;

      const draftExists = state?.exists === true;
      const draftStatus = String(state?.status ?? "")
        .trim()
        .toLowerCase();

      setRankingsLocked(draftExists && draftStatus === "completed");
    }

    void loadRankingsAvailability();

    const timer = window.setInterval(() => {
      void loadRankingsAvailability();
    }, 15000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [leagueId, leagueType]);

  /*
   * Mobile league switcher.
   *
   * The leagues SELECT is intentionally performed with the signed-in browser
   * client. Existing league RLS remains the authority for which leagues this
   * member may see; the navigation does not create a second membership system.
   */
  useEffect(() => {
    let cancelled = false;
    const supabase = createSupabaseBrowserClient();

    async function loadLeagueChoices() {
      setLeagueChoicesLoading(true);

      const { data, error } = await supabase
        .from("leagues")
        .select("id,name,league_type,season")
        .order("name", { ascending: true });

      if (cancelled) {
        return;
      }

      if (error) {
        // Keep the current league available even if the optional switcher
        // query is blocked by an unexpected RLS/configuration issue.
        setLeagueChoices([
          {
            id: leagueId,
            name: leagueName,
            league_type: leagueType,
            season: leagueSeason,
          },
        ]);
        setLeagueChoicesLoading(false);
        return;
      }

      const rows = (data ?? [])
        .map((row) => ({
          id: String(row.id),
          name: String(row.name ?? "League"),
          league_type: String(row.league_type ?? "") as G365LeagueType,
          season:
            typeof row.season === "number"
              ? row.season
              : row.season != null
                ? Number(row.season)
                : null,
        }))
        .filter((row) => Boolean(row.id));

      if (!rows.some((row) => row.id === leagueId)) {
        rows.unshift({
          id: leagueId,
          name: leagueName,
          league_type: leagueType,
          season: leagueSeason,
        });
      }

      setLeagueChoices(rows);
      setLeagueChoicesLoading(false);
    }

    void loadLeagueChoices();

    return () => {
      cancelled = true;
    };
  }, [leagueId, leagueName, leagueSeason, leagueType]);

  const capabilities = getLeagueCapabilities({
    leagueType,
    competitionFormat,
    playoffsEnabled,
    isCommissioner,
  });

  const items = getLeagueNavItems({
    leagueId,
    leagueType,
    competitionFormat,
    playoffsEnabled,
    isCommissioner,
  }).filter((item) => capabilities[item.key]);

  const activeItem = useMemo(
    () => items.find((item) => itemIsActive(pathname, item)) ?? items[0] ?? null,
    [items, pathname]
  );

  function itemIsDisabled(item: LeagueNavItem) {
    return (
      leagueType === "nhl_traditional" &&
      item.key === "rankings" &&
      rankingsLocked
    );
  }

  function handleLeagueChange(value: string) {
    if (!value || value === leagueId) {
      return;
    }

    // Every league switch starts at that league's shared League Home.
    router.push(`/league/${value}`);
  }

  function handlePageChange(value: string) {
    if (!value || value === pathname) {
      return;
    }

    const target = items.find((item) => item.href === value);
    if (!target || itemIsDisabled(target)) {
      return;
    }

    router.push(value);
  }

  return (
    <nav aria-label={ariaLabel} className="g365-universal-league-nav">
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
            border-color .15s ease,
            opacity .15s ease;
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

        .g365-universal-league-nav-link-disabled,
        .g365-universal-league-nav-link-disabled:hover {
          color: #555a63;
          background: rgba(255,255,255,.012);
          border-bottom-color: transparent;
          cursor: not-allowed;
          opacity: .52;
          filter: grayscale(1);
        }

        .g365-universal-league-nav-mobile {
          display: none;
        }

        @media (max-width: 760px) {
          .g365-universal-league-nav {
            border-top: 0;
            background:
              linear-gradient(
                180deg,
                rgba(18,18,20,.99),
                rgba(7,7,9,.99)
              );
          }

          .g365-universal-league-nav-inner {
            display: none;
          }

          .g365-universal-league-nav-mobile {
            width: 100%;
            display: grid;
            gap: 10px;
            padding: 12px;
          }

          .g365-mobile-league-context {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 10px;
            padding: 0 2px;
          }

          .g365-mobile-league-context-copy {
            min-width: 0;
          }

          .g365-mobile-league-kicker {
            margin: 0 0 3px;
            color: #ff6b24;
            font-size: 9px;
            font-weight: 950;
            letter-spacing: .12em;
            text-transform: uppercase;
          }

          .g365-mobile-league-name {
            margin: 0;
            overflow: hidden;
            color: #fff;
            font-size: 16px;
            font-weight: 950;
            line-height: 1.15;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .g365-mobile-league-meta {
            margin-top: 4px;
            color: #8f96a1;
            font-size: 10px;
            font-weight: 800;
          }

          .g365-mobile-my-leagues {
            flex: 0 0 auto;
            min-height: 34px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            padding: 0 10px;
            border: 1px solid rgba(255,102,31,.42);
            border-radius: 8px;
            color: #ff9a55;
            background: rgba(255,91,26,.06);
            text-decoration: none;
            font-size: 9px;
            font-weight: 950;
            letter-spacing: .04em;
            text-transform: uppercase;
          }

          .g365-mobile-nav-grid {
            display: grid;
            grid-template-columns: minmax(0,1fr) minmax(0,1fr);
            gap: 8px;
          }

          .g365-mobile-nav-field {
            min-width: 0;
            display: grid;
            gap: 5px;
          }

          .g365-mobile-nav-field label {
            color: #8e949e;
            font-size: 8px;
            font-weight: 950;
            letter-spacing: .1em;
            text-transform: uppercase;
          }

          .g365-mobile-nav-field select {
            width: 100%;
            min-width: 0;
            min-height: 46px;
            padding: 0 34px 0 11px;
            border: 1px solid rgba(255,255,255,.12);
            border-radius: 10px;
            outline: none;
            color: #fff;
            background: #111318;
            font-size: 12px;
            font-weight: 850;
          }

          .g365-mobile-nav-field select:focus {
            border-color: rgba(255,98,35,.85);
            box-shadow: 0 0 0 2px rgba(255,98,35,.12);
          }

          .g365-mobile-nav-field select option {
            color: #fff;
            background: #111318;
          }

          .g365-mobile-current-page {
            min-height: 30px;
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 0 2px;
            color: #747b86;
            font-size: 9px;
            font-weight: 800;
          }

          .g365-mobile-current-page strong {
            color: #d7d9de;
          }
        }

        @media (max-width: 470px) {
          .g365-mobile-nav-grid {
            grid-template-columns: 1fr;
          }

          .g365-mobile-league-name {
            font-size: 15px;
          }
        }
      `}</style>

      {/* Desktop keeps the existing navigation exactly as a tab row. */}
      <div className="g365-universal-league-nav-inner">
        {items.map((item) => {
          const active = itemIsActive(pathname, item);
          const disabled = itemIsDisabled(item);

          if (disabled) {
            return (
              <span
                key={item.href}
                aria-disabled="true"
                title="Rankings reopen when the next draft is created."
                className={[
                  "g365-universal-league-nav-link",
                  "g365-universal-league-nav-link-disabled",
                ].join(" ")}
              >
                {item.label}
              </span>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={[
                "g365-universal-league-nav-link",
                active ? "g365-universal-league-nav-link-active" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {item.label}
            </Link>
          );
        })}
      </div>

      {/* Phone navigation: switch league first, then choose a page in it. */}
      <div className="g365-universal-league-nav-mobile">
        <div className="g365-mobile-league-context">
          <div className="g365-mobile-league-context-copy">
            <p className="g365-mobile-league-kicker">Current League</p>
            <p className="g365-mobile-league-name">{leagueName}</p>
            <div className="g365-mobile-league-meta">
              {leagueSeason ? `${leagueSeason} • ` : ""}
              {leagueTypeLabel(leagueType)}
            </div>
          </div>

          <Link href="/my-leagues" className="g365-mobile-my-leagues">
            My Leagues
          </Link>
        </div>

        <div className="g365-mobile-nav-grid">
          <div className="g365-mobile-nav-field">
            <label htmlFor={`g365-league-switcher-${leagueId}`}>
              Switch League
            </label>
            <select
              id={`g365-league-switcher-${leagueId}`}
              value={leagueId}
              disabled={leagueChoicesLoading}
              onChange={(event) => handleLeagueChange(event.target.value)}
            >
              {leagueChoices.map((choice) => (
                <option key={choice.id} value={choice.id}>
                  {choice.name}
                  {choice.season ? ` • ${choice.season}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="g365-mobile-nav-field">
            <label htmlFor={`g365-page-switcher-${leagueId}`}>
              Navigate To
            </label>
            <select
              id={`g365-page-switcher-${leagueId}`}
              value={activeItem?.href ?? ""}
              onChange={(event) => handlePageChange(event.target.value)}
            >
              {items.map((item) => (
                <option
                  key={item.href}
                  value={item.href}
                  disabled={itemIsDisabled(item)}
                >
                  {item.label}
                  {itemIsDisabled(item) ? " • Locked" : ""}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="g365-mobile-current-page">
          Page:
          <strong>{activeItem?.label ?? "League Home"}</strong>
        </div>
      </div>
    </nav>
  );
}