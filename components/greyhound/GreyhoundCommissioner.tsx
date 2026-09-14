"use client";

import Link from "next/link";

type Props = {
  leagueId: string;
};

type AdminCard = {
  eyebrow: string;
  title: string;
  description: string;
  href: string;
  action: string;
  enabled: boolean;
  status: string;
  icon: string;
};

export default function GreyhoundCommissioner({
  leagueId,
}: Props) {
  const base = `/league/${leagueId}/greyhound`;

  const cards: AdminCard[] = [
    {
      eyebrow: "RACE OPERATIONS",
      title: "Race Cards",
      description:
        "Sync official race cards, review every race and runner, confirm cards for wagering, and manage card lifecycle status.",
      href: `${base}/commissioner/race-cards`,
      action: "Open Race Cards",
      enabled: true,
      status: "LIVE",
      icon: "RC",
    },
    {
      eyebrow: "RACE OPERATIONS",
      title: "Scratches & Changes",
      description:
        "Review scratches, withdrawals, vacant boxes, replacement runners, and automatic alternate activity from the live Greyhound feed.",
      href: `${base}/commissioner/scratches-changes`,
      action: "Open Scratches & Changes",
      enabled: true,
      status: "LIVE",
      icon: "SC",
    },
    {
      eyebrow: "RACE OPERATIONS",
      title: "Results & Settlements",
      description:
        "Review official race results, mutuel payouts, wager grading, settlement status, corrections, and refund activity.",
      href: `${base}/commissioner/results-settlements`,
      action: "Open Results & Settlements",
      enabled: true,
      status: "LIVE",
      icon: "RS",
    },
    {
      eyebrow: "LEAGUE SETUP",
      title: "Greyhound Settings",
      description:
        "Manage game format, competition dates and rounds, starting bankroll, track eligibility, wager types, locks, and scratch timing.",
      href: `${base}/commissioner/settings`,
      action: "Open Settings",
      enabled: true,
      status: "LIVE",
      icon: "GS",
    },
    {
      eyebrow: "LEAGUE MANAGEMENT",
      title: "Teams & Entries",
      description:
        "Manage personal Entry Names, create shared teams, randomize or manually assign members, and maintain the Team Names used across the competition.",
      href: `${base}/commissioner/teams-entries`,
      action: "Open Teams & Entries",
      enabled: true,
      status: "LIVE",
      icon: "TE",
    },
    {
      eyebrow: "LEAGUE LIFECYCLE",
      title: "Season Control",
      description:
        "Monitor competition status, round progression, survivor eliminations, tournament advancement, Head-to-Head lifecycle, and official completion controls.",
      href: `${base}/commissioner/season-control`,
      action: "Open Season Control",
      enabled: true,
      status: "LIVE",
      icon: "SC",
    },
  ];

  return (
    <main className="ghc-page">
      <style>{`
        .ghc-page,
        .ghc-page * {
          box-sizing: border-box;
        }

        .ghc-page {
          min-height: 100vh;
          padding: 20px 18px 72px;
          background:
            radial-gradient(circle at 14% -4%, rgba(166, 26, 18, 0.22), transparent 30%),
            radial-gradient(circle at 88% 8%, rgba(241, 101, 28, 0.10), transparent 24%),
            linear-gradient(180deg, #07080a 0%, #0b0c0f 48%, #07080a 100%);
          color: #ffffff;
        }

        .ghc-shell {
          width: min(1500px, 100%);
          margin: 0 auto;
        }

        .ghc-hero {
          position: relative;
          overflow: hidden;
          border: 1px solid rgba(255, 103, 29, 0.30);
          border-radius: 20px;
          background:
            linear-gradient(
              125deg,
              rgba(118, 16, 13, 0.58) 0%,
              rgba(69, 18, 13, 0.45) 31%,
              rgba(255, 102, 25, 0.08) 62%,
              #101114 100%
            );
          box-shadow:
            0 22px 60px rgba(0, 0, 0, 0.36),
            inset 0 1px 0 rgba(255, 255, 255, 0.025);
        }

        .ghc-hero::before {
          content: "";
          position: absolute;
          top: -90px;
          right: -70px;
          width: 300px;
          height: 300px;
          border-radius: 999px;
          background: radial-gradient(
            circle,
            rgba(244, 93, 22, 0.16),
            transparent 68%
          );
          pointer-events: none;
        }

        .ghc-hero-inner {
          position: relative;
          z-index: 1;
          padding: 28px 28px 26px;
        }

        .ghc-kicker {
          color: #ff6b22;
          font-size: 10px;
          font-weight: 950;
          letter-spacing: 0.17em;
          text-transform: uppercase;
        }

        .ghc-title {
          margin: 8px 0 8px;
          color: #ffffff;
          font-size: clamp(31px, 4vw, 48px);
          line-height: 1;
          font-weight: 950;
          letter-spacing: -0.04em;
        }

        .ghc-copy {
          max-width: 860px;
          margin: 0;
          color: #a7abb2;
          font-size: 13px;
          line-height: 1.7;
          font-weight: 650;
        }

        .ghc-hero-accent {
          height: 4px;
          background: linear-gradient(
            90deg,
            #8f1713 0%,
            #d93418 36%,
            #f36a20 72%,
            #ff8a3d 100%
          );
        }

        .ghc-overview {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 10px;
          margin: 14px 0 20px;
        }

        .ghc-stat {
          min-height: 112px;
          padding: 15px 16px;
          border: 1px solid #2b2d31;
          border-radius: 15px;
          background:
            linear-gradient(145deg, rgba(46, 15, 10, 0.26), transparent 58%),
            #101114;
          box-shadow: 0 10px 26px rgba(0, 0, 0, 0.22);
        }

        .ghc-stat-label {
          color: #e7682d;
          font-size: 8px;
          font-weight: 950;
          letter-spacing: 0.13em;
          text-transform: uppercase;
        }

        .ghc-stat-value {
          margin-top: 8px;
          color: #ffffff;
          font-size: 20px;
          font-weight: 950;
          letter-spacing: -0.02em;
        }

        .ghc-stat-copy {
          margin-top: 4px;
          color: #727780;
          font-size: 9px;
          line-height: 1.45;
          font-weight: 650;
        }

        .ghc-section-head {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 16px;
          margin: 8px 0 12px;
        }

        .ghc-section-kicker {
          color: #e76227;
          font-size: 8px;
          font-weight: 950;
          letter-spacing: 0.14em;
          text-transform: uppercase;
        }

        .ghc-section-title {
          margin: 5px 0 0;
          color: #ffffff;
          font-size: 26px;
          font-weight: 950;
          letter-spacing: -0.025em;
        }

        .ghc-section-copy {
          margin: 6px 0 0;
          color: #7d828a;
          font-size: 10px;
          line-height: 1.55;
        }

        .ghc-count {
          flex: 0 0 auto;
          padding: 9px 12px;
          border: 1px solid rgba(232, 97, 36, 0.34);
          border-radius: 10px;
          background: rgba(89, 30, 11, 0.27);
          color: #ffad7c;
          font-size: 9px;
          font-weight: 950;
          letter-spacing: 0.08em;
        }

        .ghc-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
        }

        .ghc-card {
          position: relative;
          overflow: hidden;
          min-height: 252px;
          display: flex;
          flex-direction: column;
          border: 1px solid #2d2f33;
          border-radius: 17px;
          background:
            linear-gradient(
              145deg,
              rgba(89, 20, 12, 0.20),
              rgba(14, 15, 18, 0) 44%
            ),
            #101113;
          box-shadow: 0 16px 38px rgba(0, 0, 0, 0.25);
        }

        .ghc-card::before {
          content: "";
          position: absolute;
          inset: 0 auto 0 0;
          width: 3px;
          background: linear-gradient(
            180deg,
            #9d1f16,
            #dc3d1d 52%,
            #f26b22
          );
          opacity: 0.9;
        }

        .ghc-card.disabled {
          background: #0f1012;
          border-color: #26282c;
        }

        .ghc-card.disabled::before {
          opacity: 0.22;
        }

        .ghc-card-top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          padding: 17px 18px 0 20px;
        }

        .ghc-card-icon {
          display: inline-flex;
          width: 42px;
          height: 42px;
          flex: 0 0 auto;
          align-items: center;
          justify-content: center;
          border: 1px solid rgba(231, 91, 30, 0.40);
          border-radius: 11px;
          background:
            linear-gradient(145deg, rgba(135, 27, 18, 0.68), rgba(74, 22, 12, 0.58));
          color: #ffb084;
          font-size: 10px;
          font-weight: 950;
          letter-spacing: 0.08em;
        }

        .ghc-card.disabled .ghc-card-icon {
          border-color: #34363a;
          background: #17181b;
          color: #666b72;
        }

        .ghc-status {
          display: inline-flex;
          min-height: 27px;
          align-items: center;
          justify-content: center;
          padding: 5px 8px;
          border-radius: 999px;
          font-size: 7px;
          font-weight: 950;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          white-space: nowrap;
        }

        .ghc-status.live {
          border: 1px solid rgba(50, 166, 93, 0.38);
          background: rgba(17, 87, 48, 0.28);
          color: #96e6b7;
        }

        .ghc-status.pending {
          border: 1px solid rgba(221, 99, 34, 0.35);
          background: rgba(92, 36, 12, 0.25);
          color: #f5a26f;
        }

        .ghc-card-body {
          display: flex;
          flex: 1;
          flex-direction: column;
          padding: 15px 18px 18px 20px;
        }

        .ghc-card-eyebrow {
          color: #e8652a;
          font-size: 8px;
          font-weight: 950;
          letter-spacing: 0.14em;
          text-transform: uppercase;
        }

        .ghc-card.disabled .ghc-card-eyebrow {
          color: #6f737a;
        }

        .ghc-card-title {
          margin: 7px 0 0;
          color: #ffffff;
          font-size: 21px;
          line-height: 1.12;
          font-weight: 950;
          letter-spacing: -0.02em;
        }

        .ghc-card.disabled .ghc-card-title {
          color: #a5a8ad;
        }

        .ghc-card-description {
          margin: 9px 0 0;
          color: #90959c;
          font-size: 11px;
          line-height: 1.6;
          font-weight: 600;
        }

        .ghc-card.disabled .ghc-card-description {
          color: #676b72;
        }

        .ghc-card-action {
          margin-top: auto;
          padding-top: 18px;
        }

        .ghc-button {
          display: inline-flex;
          width: 100%;
          min-height: 44px;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 0 13px 0 15px;
          border: 1px solid rgba(255, 119, 42, 0.32);
          border-radius: 10px;
          background: linear-gradient(
            90deg,
            #991d16 0%,
            #cb341a 52%,
            #ee641e 100%
          );
          color: #ffffff;
          text-decoration: none;
          font-size: 10px;
          font-weight: 950;
          letter-spacing: 0.07em;
          text-transform: uppercase;
          box-shadow: 0 10px 24px rgba(146, 35, 17, 0.20);
          transition:
            transform 0.15s ease,
            filter 0.15s ease;
        }

        .ghc-button:hover {
          transform: translateY(-1px);
          filter: brightness(1.08);
        }

        .ghc-button-arrow {
          font-size: 15px;
          line-height: 1;
        }

        .ghc-coming {
          display: inline-flex;
          width: 100%;
          min-height: 44px;
          align-items: center;
          justify-content: center;
          border: 1px solid #303237;
          border-radius: 10px;
          background: #17181b;
          color: #686d75;
          font-size: 9px;
          font-weight: 950;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        @media (max-width: 1050px) {
          .ghc-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .ghc-overview {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 700px) {
          .ghc-page {
            padding: 12px 10px 70px;
          }

          .ghc-hero-inner {
            padding: 18px 16px;
          }

          .ghc-title {
            font-size: 30px;
          }

          .ghc-copy {
            font-size: 11px;
          }

          .ghc-section-head {
            align-items: flex-start;
            flex-direction: column;
          }

          .ghc-count {
            width: 100%;
            text-align: center;
          }

          .ghc-grid {
            grid-template-columns: 1fr;
          }

          .ghc-card {
            min-height: 228px;
          }
        }

        @media (max-width: 440px) {
          .ghc-overview {
            grid-template-columns: 1fr;
          }

          .ghc-stat {
            min-height: 92px;
          }

          .ghc-card-top {
            padding-left: 17px;
          }

          .ghc-card-body {
            padding-left: 17px;
          }
        }
      `}</style>

      <div className="ghc-shell">
        <section className="ghc-hero">
          <div className="ghc-hero-inner">
            <div className="ghc-kicker">
              G365 Greyhound Racing · Commissioner
            </div>

            <h1 className="ghc-title">
              League Administration
            </h1>

            <p className="ghc-copy">
              Control the complete G365 Greyhound league from one workspace:
              official race cards, wagering rules, contest configuration,
              settlements, members, and competition lifecycle.
            </p>
          </div>

          <div className="ghc-hero-accent" />
        </section>

        <section className="ghc-overview">
          <div className="ghc-stat">
            <div className="ghc-stat-label">
              League Type
            </div>
            <div className="ghc-stat-value">
              Greyhound
            </div>
            <div className="ghc-stat-copy">
              G365 racing competition
            </div>
          </div>

          <div className="ghc-stat">
            <div className="ghc-stat-label">
              Race Cards
            </div>
            <div className="ghc-stat-value">
              Active
            </div>
            <div className="ghc-stat-copy">
              Official feed, review and confirmation
            </div>
          </div>

          <div className="ghc-stat">
            <div className="ghc-stat-label">
              Commissioner Settings
            </div>
            <div className="ghc-stat-value">
              Active
            </div>
            <div className="ghc-stat-copy">
              Formats, dates, bankroll and wagering
            </div>
          </div>

          <div className="ghc-stat">
            <div className="ghc-stat-label">
              Commissioner
            </div>
            <div className="ghc-stat-value">
              Full Access
            </div>
            <div className="ghc-stat-copy">
              Complete league administration
            </div>
          </div>
        </section>

        <div className="ghc-section-head">
          <div>
            <div className="ghc-section-kicker">
              Commissioner Control Center
            </div>

            <h2 className="ghc-section-title">
              Greyhound League Tools
            </h2>

            <p className="ghc-section-copy">
              Open the live tools below or see what is coming next in the
              Greyhound commissioner build.
            </p>
          </div>

          <div className="ghc-count">
            4 LIVE · 2 BUILDING
          </div>
        </div>

        <section className="ghc-grid">
          {cards.map((card) => {
            const statusClass =
              card.status === "LIVE"
                ? "live"
                : "pending";

            return (
              <article
                key={card.title}
                className={`ghc-card${card.enabled ? "" : " disabled"}`}
              >
                <div className="ghc-card-top">
                  <div className="ghc-card-icon">
                    {card.icon}
                  </div>

                  <span className={`ghc-status ${statusClass}`}>
                    {card.status}
                  </span>
                </div>

                <div className="ghc-card-body">
                  <div className="ghc-card-eyebrow">
                    {card.eyebrow}
                  </div>

                  <h3 className="ghc-card-title">
                    {card.title}
                  </h3>

                  <p className="ghc-card-description">
                    {card.description}
                  </p>

                  <div className="ghc-card-action">
                    {card.enabled ? (
                      <Link
                        href={card.href}
                        className="ghc-button"
                      >
                        <span>
                          {card.action}
                        </span>

                        <span className="ghc-button-arrow">
                          →
                        </span>
                      </Link>
                    ) : (
                      <div className="ghc-coming">
                        {card.action}
                      </div>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      </div>
    </main>
  );
}