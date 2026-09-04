"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Props = {
  leagueId: string;
  isCommissioner: boolean;
};

type NavItem = {
  label: string;
  mobileLabel: string;
  href: string;
  exact?: boolean;
};

export default function TraditionalLeagueNav({
  leagueId,
  isCommissioner,
}: Props) {
  const pathname = usePathname();
  const base = `/league/${leagueId}`;

  const items: NavItem[] = [
    { label: "Home", mobileLabel: "Home", href: base, exact: true },
    { label: "My Team", mobileLabel: "Team", href: `${base}/team` },
    { label: "Players", mobileLabel: "Players", href: `${base}/players` },
    { label: "My Rankings", mobileLabel: "Rankings", href: `${base}/rankings` },
    { label: "Matchups", mobileLabel: "Matchups", href: `${base}/matchups` },
    { label: "Standings", mobileLabel: "Standings", href: `${base}/standings` },
    { label: "Waivers", mobileLabel: "Waivers", href: `${base}/waivers` },
    { label: "Trades", mobileLabel: "Trades", href: `${base}/trades` },
    { label: "Playoffs", mobileLabel: "Playoffs", href: `${base}/playoffs` },
    { label: "Season Recap", mobileLabel: "Recap", href: `${base}/season-recap` },
    { label: "League History", mobileLabel: "History", href: `${base}/history` },
    { label: "Draft", mobileLabel: "Draft", href: `${base}/draft` },
    { label: "Settings", mobileLabel: "Settings", href: `${base}/settings` },
  ];

  if (isCommissioner) {
    items.push({
      label: "Commissioner",
      mobileLabel: "Commish",
      href: `${base}/commissioner`,
    });
  }

  function isActive(item: NavItem) {
    if (item.exact) return pathname === item.href;

    return (
      pathname === item.href ||
      pathname.startsWith(`${item.href}/`)
    );
  }

  return (
    <nav className="g365-league-nav" aria-label="League navigation">
      <div className="g365-league-nav-inner">
        {items.map((item) => {
          const active = isActive(item);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                "g365-league-nav-link",
                active ? "g365-league-nav-link-active" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <span className="g365-nav-label-desktop">
                {item.label}
              </span>
              <span className="g365-nav-label-mobile">
                {item.mobileLabel}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
