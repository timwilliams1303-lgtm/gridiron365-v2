"use client";

import { useEffect, useState } from "react";

type Entry = {
  dogId: number | null;
  dogName: string | null;
  boxNumber: number;
};

type Props = {
  leagueId: string;
  raceNumber: number;
  raceDate: string | null | undefined;
  trackCode: string | null | undefined;
  // Kept so the existing Wager Workspace call does not need to change.
  entries?: Entry[];
};

type ProgramPage = {
  id: number;
  trackCode: string;
  programDate: string;
  raceNumber: number;
  pageNumber: number;
  imageDataUrl: string;
  sourceFileName: string | null;
};

export default function GreyhoundRaceProgramCard({
  leagueId,
  raceNumber,
  raceDate,
  trackCode,
}: Props) {
  const [page, setPage] = useState<ProgramPage | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setExpanded(false);

    async function load() {
      if (!raceDate || !trackCode) {
        setPage(null);
        return;
      }

      setLoading(true);

      try {
        const params = new URLSearchParams({
          leagueId,
          trackCode,
          programDate: raceDate,
          raceNumber: String(raceNumber),
        });

        const response = await fetch(
          `/api/greyhound/program-pages?${params.toString()}`,
          {
            method: "GET",
            cache: "no-store",
          },
        );

        const payload = (await response.json().catch(() => ({}))) as {
          success?: boolean;
          programPage?: ProgramPage | null;
        };

        if (!cancelled) {
          setPage(
            response.ok && payload.success === true
              ? payload.programPage ?? null
              : null,
          );
        }
      } catch {
        if (!cancelled) setPage(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [leagueId, raceDate, raceNumber, trackCode]);

  if (loading) {
    return (
      <section className="grp-shell">
        <div className="grp-loading">Loading official Program page…</div>
        <style jsx>{styles}</style>
      </section>
    );
  }

  if (!page?.imageDataUrl) {
    return null;
  }

  return (
    <section className="grp-shell">
      <button
        type="button"
        className="grp-toggle"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
      >
        <span className="grp-title">
          <span className="grp-kicker">OFFICIAL PROGRAM</span>
          <span className="grp-race">Race {raceNumber} · Full Program Page</span>
        </span>

        <span className="grp-action">
          {expanded ? "Collapse Program" : "Expand Program"}
          <span
            className={`grp-chevron ${expanded ? "is-open" : ""}`}
            aria-hidden="true"
          >
            ▼
          </span>
        </span>
      </button>

      {expanded ? (
        <div className="grp-content">
          <div className="grp-page-row">
            <span>OFFICIAL RACE {raceNumber} PROGRAM</span>
            <span>PAGE {page.pageNumber}</span>
          </div>

          <div className="grp-scroll">
            <img
              src={page.imageDataUrl}
              alt={`Official Program page ${page.pageNumber} for Race ${raceNumber}`}
              className="grp-image"
            />
          </div>
        </div>
      ) : null}

      <style jsx>{styles}</style>
    </section>
  );
}

const styles = `
  .grp-shell {
    margin-top: 14px;
    overflow: hidden;
    border: 1px solid rgba(249, 115, 22, 0.34);
    border-radius: 14px;
    background:
      linear-gradient(180deg, rgba(249, 115, 22, 0.07), transparent 90px),
      #090909;
  }

  .grp-toggle {
    display: flex;
    width: 100%;
    min-height: 62px;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 12px 16px;
    border: 0;
    background: transparent;
    color: #fff;
    text-align: left;
    cursor: pointer;
  }

  .grp-toggle:hover {
    background: rgba(255, 255, 255, 0.025);
  }

  .grp-title {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 3px;
  }

  .grp-kicker {
    color: #f97316;
    font-size: 10px;
    font-weight: 900;
    letter-spacing: .13em;
  }

  .grp-race {
    overflow: hidden;
    color: #fff;
    font-size: 15px;
    font-weight: 900;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .grp-action {
    display: inline-flex;
    flex: 0 0 auto;
    align-items: center;
    gap: 8px;
    border: 1px solid rgba(249, 115, 22, 0.5);
    border-radius: 999px;
    padding: 8px 11px;
    color: #fff;
    font-size: 11px;
    font-weight: 900;
  }

  .grp-chevron {
    display: inline-block;
    color: #f97316;
    font-size: 10px;
    transition: transform 160ms ease;
  }

  .grp-chevron.is-open {
    transform: rotate(180deg);
  }

  .grp-content {
    border-top: 1px solid rgba(255, 255, 255, 0.08);
  }

  .grp-page-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 9px 14px;
    background: rgba(249, 115, 22, 0.06);
    color: rgba(255, 255, 255, 0.72);
    font-size: 10px;
    font-weight: 900;
    letter-spacing: .08em;
  }

  .grp-scroll {
    width: 100%;
    overflow-x: auto;
    overscroll-behavior-x: contain;
    -webkit-overflow-scrolling: touch;
    background: #111;
  }

  .grp-image {
    display: block;
    width: 100%;
    min-width: 760px;
    height: auto;
    background: #fff;
  }

  .grp-loading {
    padding: 15px 16px;
    color: rgba(255,255,255,.68);
    font-size: 13px;
    font-weight: 800;
  }

  @media (max-width: 720px) {
    .grp-shell {
      margin-top: 10px;
      border-radius: 12px;
    }

    .grp-toggle {
      min-height: 58px;
      gap: 10px;
      padding: 10px 12px;
    }

    .grp-race {
      font-size: 13px;
    }

    .grp-action {
      padding: 7px 9px;
      font-size: 10px;
    }

    .grp-image {
      min-width: 720px;
    }

    .grp-page-row {
      padding: 8px 12px;
    }
  }
`;
