import Link from "next/link";
import { notFound } from "next/navigation";

import { requireLeagueMember } from "@/lib/leagues/requireLeagueMember";

type Props = {
  params: Promise<{ leagueId: string }>;
};

const commissionerSections = [
  {
    title: "Race Cards",
    description:
      "Import and manage race cards, entries programs, and confirmed race information.",
    href: "race-cards",
    icon: "🏁",
  },
  {
    title: "Results & Settlements",
    description:
      "Manage race results, wager grading, settlements, and completed race processing.",
    href: "results-settlements",
    icon: "🏆",
  },
  {
    title: "Scratches & Changes",
    description:
      "Review scratches, entry changes, replacements, and race-card updates.",
    href: "scratches-changes",
    icon: "⚠️",
  },
  {
    title: "Season Control",
    description:
      "Control league lifecycle, rounds, contest status, advancement, and season progression.",
    href: "season-control",
    icon: "🎛️",
  },
  {
    title: "Settings",
    description:
      "Configure Greyhound league formats, wagering rules, contest settings, and league options.",
    href: "settings",
    icon: "⚙️",
  },
  {
    title: "Teams & Entries",
    description:
      "Manage league teams, owners, contest entries, entry names, and participation.",
    href: "teams-entries",
    icon: "👥",
  },
] as const;

export default async function GreyhoundCommissionerPage({
  params,
}: Props) {
  const { leagueId } = await params;

  const membership = await requireLeagueMember(leagueId);

  if (!membership.isCommissioner) {
    notFound();
  }

  return (
    <main className="commissioner-page">
      <section className="hero">
        <div className="eyebrow">GREYHOUND RACING</div>

        <h1>Commissioner</h1>

        <p>
          Manage race operations, results, league settings, season control,
          and contest entries.
        </p>
      </section>

      <section className="section-grid">
        {commissionerSections.map((section) => (
          <Link
            key={section.href}
            href={`/league/${leagueId}/greyhound/commissioner/${section.href}`}
            className="section-card"
          >
            <div className="card-top">
              <div className="icon-box">{section.icon}</div>

              <div className="arrow">›</div>
            </div>

            <div className="card-content">
              <h2>{section.title}</h2>
              <p>{section.description}</p>
            </div>

            <div className="open-label">OPEN</div>
          </Link>
        ))}
      </section>

      <style>{`
        .commissioner-page {
          width: 100%;
          max-width: 1180px;
          margin: 0 auto;
          padding: 18px 16px 40px;
          color: #ffffff;
        }

        .hero {
          position: relative;
          overflow: hidden;
          margin-bottom: 18px;
          padding: 24px;
          border: 1px solid rgba(255, 106, 0, 0.28);
          border-radius: 18px;
          background:
            radial-gradient(
              circle at top right,
              rgba(255, 106, 0, 0.18),
              transparent 38%
            ),
            linear-gradient(
              135deg,
              #18191c 0%,
              #111214 55%,
              #0b0b0c 100%
            );
          box-shadow:
            0 16px 36px rgba(0, 0, 0, 0.3),
            inset 0 1px 0 rgba(255, 255, 255, 0.03);
        }

        .hero::after {
          content: "";
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          height: 3px;
          background: linear-gradient(
            90deg,
            #ff3d00 0%,
            #ff6a00 48%,
            #ff9d00 100%
          );
        }

        .eyebrow {
          margin-bottom: 7px;
          color: #ff6a00;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.16em;
        }

        .hero h1 {
          margin: 0;
          font-size: clamp(28px, 5vw, 42px);
          line-height: 1;
          font-weight: 950;
          letter-spacing: -0.035em;
        }

        .hero p {
          max-width: 700px;
          margin: 11px 0 0;
          color: #a9abb2;
          font-size: 14px;
          line-height: 1.55;
        }

        .section-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 14px;
        }

        .section-card {
          position: relative;
          min-height: 210px;
          display: flex;
          flex-direction: column;
          padding: 18px;
          overflow: hidden;
          border: 1px solid #292b30;
          border-radius: 16px;
          background:
            linear-gradient(
              145deg,
              rgba(255, 255, 255, 0.025),
              rgba(255, 255, 255, 0)
            ),
            #141518;
          color: #ffffff;
          text-decoration: none;
          transition:
            transform 140ms ease,
            border-color 140ms ease,
            background 140ms ease,
            box-shadow 140ms ease;
        }

        .section-card:hover {
          transform: translateY(-2px);
          border-color: rgba(255, 106, 0, 0.62);
          background:
            linear-gradient(
              145deg,
              rgba(255, 106, 0, 0.09),
              rgba(255, 255, 255, 0)
            ),
            #17181b;
          box-shadow: 0 12px 30px rgba(0, 0, 0, 0.28);
        }

        .section-card:focus-visible {
          outline: 2px solid #ff6a00;
          outline-offset: 3px;
        }

        .card-top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
        }

        .icon-box {
          width: 48px;
          height: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid rgba(255, 106, 0, 0.3);
          border-radius: 13px;
          background: rgba(255, 106, 0, 0.09);
          font-size: 23px;
        }

        .arrow {
          color: #5f626a;
          font-size: 30px;
          font-weight: 400;
          line-height: 1;
          transition:
            color 140ms ease,
            transform 140ms ease;
        }

        .section-card:hover .arrow {
          color: #ff6a00;
          transform: translateX(2px);
        }

        .card-content {
          flex: 1;
          margin-top: 20px;
        }

        .card-content h2 {
          margin: 0;
          font-size: 18px;
          font-weight: 900;
          letter-spacing: -0.015em;
        }

        .card-content p {
          margin: 8px 0 0;
          color: #9699a1;
          font-size: 13px;
          line-height: 1.5;
        }

        .open-label {
          margin-top: 18px;
          color: #ff6a00;
          font-size: 10px;
          font-weight: 950;
          letter-spacing: 0.13em;
        }

        @media (max-width: 900px) {
          .section-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 620px) {
          .commissioner-page {
            padding: 12px 10px 30px;
          }

          .hero {
            padding: 19px 16px;
            border-radius: 15px;
          }

          .hero p {
            font-size: 13px;
          }

          .section-grid {
            grid-template-columns: 1fr;
            gap: 10px;
          }

          .section-card {
            min-height: 0;
            padding: 15px;
            border-radius: 14px;
          }

          .icon-box {
            width: 43px;
            height: 43px;
            font-size: 20px;
          }

          .card-content {
            margin-top: 15px;
          }

          .card-content h2 {
            font-size: 17px;
          }

          .card-content p {
            font-size: 12px;
          }

          .open-label {
            margin-top: 14px;
          }
        }
      `}</style>
    </main>
  );
}