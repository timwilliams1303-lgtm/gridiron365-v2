"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Props = {
  leagueId: string;
  isCommissioner: boolean;
};

type NavItem = {
  label: string;
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
    { label: "Home", href: base, exact: true },
    { label: "My Team", href: `${base}/team` },
    { label: "Players", href: `${base}/players` },
    { label: "My Rankings", href: `${base}/rankings` },
    { label: "Matchups", href: `${base}/matchups` },
    { label: "Standings", href: `${base}/standings` },
    { label: "Waivers", href: `${base}/waivers` },
    { label: "Trades", href: `${base}/trades` },
    { label: "Playoffs", href: `${base}/playoffs` },
    { label: "Season Recap", href: `${base}/season-recap` },
    { label: "League History", href: `${base}/history` },
    { label: "Draft", href: `${base}/draft` },
    { label: "Settings", href: `${base}/settings` },
  ];

  if (isCommissioner) {
    items.push({
      label: "Commissioner",
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
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
