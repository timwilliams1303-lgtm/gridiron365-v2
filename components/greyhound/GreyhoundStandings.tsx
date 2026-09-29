"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type StandingRow = {
  key: number;
  name: string;
  rank: number;
  primaryValue: number;
};

type ApiResponse = {
  success: boolean;
  error?: string;
  league?: {
    id: string;
    name: string;
  };
  competition?: {
    gameFormat: string;
    sharedTeamFormat: boolean;
    primaryLabel: string;
    startingBankroll: number;
  };
  standings?: StandingRow[];
};

type Props = {
  leagueId: string;
};

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function title(value: string | null | undefined) {
  return String(value ?? "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export default function GreyhoundStandings({ leagueId }: Props) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const load = useCallback(
    async (silent = false) => {
      if (silent) setRefreshing(true);
      else setLoading(true);

      setError(null);

      try {
        const response = await fetch(
          `/api/greyhound/standings?leagueId=${encodeURIComponent(leagueId)}`,
          {
            method: "GET",
            cache: "no-store",
          },
        );

        const payload = (await response.json()) as ApiResponse;

        if (!response.ok || !payload.success) {
          throw new Error(payload.error ?? "Unable to load standings.");
        }

        setData(payload);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load standings.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [leagueId],
  );

  useEffect(() => {
    void load(false);
  }, [load]);

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();

    return (data?.standings ?? []).filter((row) =>
      needle ? row.name.toLowerCase().includes(needle) : true,
    );
  }, [data?.standings, search]);

  const gameFormat = data?.competition?.gameFormat ?? "bankroll";
  const primaryLabel = data?.competition?.primaryLabel ?? "Amount";
  const sharedTeamFormat = Boolean(data?.competition?.sharedTeamFormat);

  if (loading && !data) {
    return (
      <main className="ghst-page">
        <style>{baseCss}</style>
        <div className="ghst-shell">
          <div className="ghst-loading">Loading Greyhound standings…</div>
        </div>
      </main>
    );
  }

  return (
    <main className="ghst-page">
      <style>{baseCss}</style>

      <div className="ghst-shell">
        <div className="ghst-top-links">
          <Link href={`/league/${leagueId}`} className="ghst-back">
            ← Greyhound Home
          </Link>

          <Link
            href={`/league/${leagueId}/greyhound/league-wagers`}
            className="ghst-secondary-link"
          >
            League Wagers
          </Link>
        </div>

        <section className="ghst-hero">
          <div>
            <div className="ghst-kicker">G365 GREYHOUND RACING</div>
            <h1>Standings</h1>
            <p>
              {title(gameFormat)} standings ranked by {primaryLabel.toLowerCase()}.
            </p>
          </div>

          <div className="ghst-live">
            <span>
              <i />
              UPDATED AFTER RESULTS
            </span>

            <button
              type="button"
              onClick={() => void load(true)}
              disabled={refreshing}
            >
              {refreshing ? "Refreshing…" : "Refresh Now"}
            </button>
          </div>
        </section>

        {error ? <div className="ghst-error">{error}</div> : null}

        <section className="ghst-board-head">
          <div>
            <div className="ghst-kicker">LIVE STANDINGS</div>
            <h2>{primaryLabel}</h2>
          </div>

          <div className="ghst-format">{title(gameFormat)}</div>
        </section>

        <section className="ghst-toolbar">
          <label>
            <span>Find {sharedTeamFormat ? "Team" : "Entry"}</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={
                sharedTeamFormat ? "Search team name…" : "Search entry name…"
              }
            />
          </label>
        </section>

        {rows.length === 0 ? (
          <section className="ghst-empty">
            <strong>No matching standings rows.</strong>
            <span>
              Active {sharedTeamFormat ? "teams" : "entries"} will appear here
              automatically.
            </span>
          </section>
        ) : (
          <section className="ghst-table-wrap">
            <div className="ghst-table">
              <div className="ghst-row ghst-head">
                <div>RK</div>
                <div>{sharedTeamFormat ? "TEAM" : "ENTRY"}</div>
                <div>{primaryLabel.toUpperCase()}</div>
              </div>

              {rows.map((row) => (
                <div className="ghst-row" key={row.key}>
                  <div className="ghst-rank">
                    <strong>#{row.rank}</strong>
                  </div>

                  <div className="ghst-identity">
                    <strong>{row.name}</strong>
                  </div>

                  <div className="ghst-primary">
                    <strong>{money(row.primaryValue)}</strong>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

const baseCss = `
  .ghst-page,
  .ghst-page * { box-sizing: border-box; }

  .ghst-page {
    min-height: 100vh;
    padding: 18px 16px 70px;
    background:
      radial-gradient(circle at top left, rgba(132,18,13,.17), transparent 30%),
      linear-gradient(180deg,#07080b,#0c0c0f 48%,#07080a);
    color: #fff;
  }

  .ghst-shell { width: min(1100px,100%); margin: 0 auto; }

  .ghst-top-links {
    display: flex; align-items: center; justify-content: space-between;
    gap: 10px; margin-bottom: 12px;
  }

  .ghst-back,
  .ghst-secondary-link {
    min-height: 40px; display: inline-flex; align-items: center;
    padding: 0 13px; border: 1px solid #34363a; border-radius: 10px;
    background: #101113; color: #e5e7ea; font-size: 10px;
    font-weight: 900; text-decoration: none;
  }

  .ghst-secondary-link {
    border-color: rgba(230,98,34,.38); color: #ff9861;
  }

  .ghst-hero {
    display: flex; align-items: center; justify-content: space-between;
    gap: 18px; padding: 22px; border: 1px solid rgba(255,91,29,.28);
    border-radius: 18px;
    background: linear-gradient(135deg,rgba(126,16,13,.38),rgba(255,94,24,.09) 46%,#101113 100%);
    box-shadow: 0 22px 60px rgba(0,0,0,.30);
  }

  .ghst-kicker {
    color: #ff6b22; font-size: 9px; font-weight: 950;
    letter-spacing: .14em; text-transform: uppercase;
  }

  .ghst-hero h1 {
    margin: 7px 0 8px; font-size: clamp(30px,4vw,44px);
    line-height: 1; font-weight: 950; letter-spacing: -.035em;
  }

  .ghst-hero p {
    margin: 0; color: #9da2a9; font-size: 12px;
    line-height: 1.6; font-weight: 600;
  }

  .ghst-live {
    display: flex; align-items: center; gap: 8px; flex-shrink: 0;
  }

  .ghst-live span,
  .ghst-format {
    display: inline-flex; align-items: center; gap: 7px; min-height: 36px;
    padding: 0 11px; border: 1px solid rgba(230,98,34,.38);
    border-radius: 999px; background: rgba(89,28,11,.26);
    color: #ff9660; font-size: 9px; font-weight: 950;
    text-transform: uppercase; letter-spacing: .05em;
  }

  .ghst-live i {
    width: 7px; height: 7px; border-radius: 50%; background: #39c771;
    box-shadow: 0 0 0 4px rgba(57,199,113,.10);
  }

  .ghst-live button {
    min-height: 36px; padding: 0 12px; border: 1px solid #3b3d41;
    border-radius: 9px; background: #151618; color: #fff;
    cursor: pointer; font-size: 9px; font-weight: 950;
  }

  .ghst-live button:disabled { opacity: .55; cursor: not-allowed; }

  .ghst-error {
    margin-top: 12px; padding: 12px 13px;
    border: 1px solid rgba(198,51,43,.55); border-radius: 11px;
    background: rgba(79,15,13,.30); color: #ffaaa5;
    font-size: 11px; font-weight: 800;
  }

  .ghst-board-head {
    display: flex; align-items: end; justify-content: space-between;
    gap: 12px; margin: 20px 0 10px;
  }

  .ghst-board-head h2 {
    margin: 5px 0 0; font-size: 22px; font-weight: 950;
  }

  .ghst-toolbar {
    margin-bottom: 10px; padding: 12px; border: 1px solid #2d2f33;
    border-radius: 13px; background: #101113;
  }

  .ghst-toolbar label { display: grid; gap: 6px; }

  .ghst-toolbar label > span {
    color: #b9bdc2; font-size: 9px; font-weight: 900;
    text-transform: uppercase; letter-spacing: .05em;
  }

  .ghst-toolbar input {
    width: 100%; min-height: 42px; padding: 9px 11px;
    border: 1px solid #36383c; border-radius: 10px; outline: none;
    background: #0b0c0e; color: #fff; font-size: 12px; font-weight: 750;
  }

  .ghst-toolbar input:focus {
    border-color: #e86124; box-shadow: 0 0 0 3px rgba(232,97,36,.10);
  }

  .ghst-table-wrap {
    overflow: hidden; border: 1px solid #2d2f33;
    border-radius: 15px; background: #101113;
  }

  .ghst-row {
    display: grid;
    grid-template-columns: 70px minmax(0,1fr) minmax(135px,auto);
    align-items: center; min-height: 68px; border-top: 1px solid #24262a;
  }

  .ghst-row > div { padding: 12px 14px; min-width: 0; }

  .ghst-row.ghst-head {
    min-height: 42px; border-top: 0; background: #0b0c0e;
    color: #777d85; font-size: 8px; font-weight: 950;
    letter-spacing: .07em;
  }

  .ghst-row.ghst-head > div:last-child,
  .ghst-primary { text-align: right; }

  .ghst-rank strong {
    color: #ff8a4d; font-size: 17px; font-weight: 950;
  }

  .ghst-identity strong {
    display: block; overflow: hidden; color: #fff;
    font-size: 14px; font-weight: 950; text-overflow: ellipsis;
    white-space: nowrap;
  }

  .ghst-primary strong {
    display: block; color: #fff; font-size: 17px; font-weight: 950;
  }

  .ghst-empty,
  .ghst-loading {
    padding: 28px; border: 1px solid #2d2f33; border-radius: 15px;
    background: #101113; text-align: center;
  }

  .ghst-empty strong { display: block; font-size: 14px; }

  .ghst-empty span {
    display: block; margin-top: 6px; color: #7f858c; font-size: 10px;
  }

  @media (max-width: 700px) {
    .ghst-page { padding: 12px 10px 70px; }

    .ghst-hero {
      align-items: stretch; flex-direction: column; padding: 16px;
    }

    .ghst-live { width: 100%; justify-content: space-between; }
    .ghst-live button { flex: 1; }

    .ghst-board-head {
      align-items: flex-start; flex-direction: column;
    }

    .ghst-row {
      grid-template-columns: 52px minmax(0,1fr) minmax(105px,auto);
      min-height: 62px;
    }

    .ghst-row > div { padding: 10px 8px; }
    .ghst-identity strong { font-size: 12px; }
    .ghst-primary strong { font-size: 14px; }
  }

  @media (max-width: 430px) {
    .ghst-top-links { align-items: stretch; flex-direction: column; }

    .ghst-back,
    .ghst-secondary-link {
      width: 100%; justify-content: center;
    }
  }
`;
