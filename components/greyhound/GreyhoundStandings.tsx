"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type StandingRow = {
  key: number;
  name: string;
  active: boolean;
  memberCount: number;
  fantasyTeamIds: number[];
  rank: number;
  tickets: number;
  totalStaked: number;
  totalReturned: number;
  net: number;
  openingBankroll: number;
  currentBankroll: number;
  pending: number;
  winners: number;
  losers: number;
  refunded: number;
  racesGraded: number;
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
  summary?: {
    entries: number;
    totalTickets: number;
    totalStaked: number;
    totalReturned: number;
    leaderName: string | null;
    leaderValue: number;
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

  const summary = data?.summary ?? {
    entries: 0,
    totalTickets: 0,
    totalStaked: 0,
    totalReturned: 0,
    leaderName: null,
    leaderValue: 0,
  };

  const gameFormat = data?.competition?.gameFormat ?? "bankroll";
  const primaryLabel = data?.competition?.primaryLabel ?? "Net";
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
              Every active {sharedTeamFormat ? "team" : "entry"} appears before
              the first wager is placed. Rankings update from official graded
              results whenever the page is opened or manually refreshed.
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

        <section className="ghst-summary-grid">
          <article>
            <span>{sharedTeamFormat ? "Teams" : "Entries"}</span>
            <strong>{summary.entries}</strong>
            <small>Active competition roster</small>
          </article>

          <article>
            <span>Leader</span>
            <strong>{summary.leaderName ?? "No leader yet"}</strong>
            <small>
              {summary.leaderName
                ? `${primaryLabel}: ${money(summary.leaderValue)}`
                : "Standings start at zero"}
            </small>
          </article>

          <article>
            <span>Total Wagered</span>
            <strong>{money(summary.totalStaked)}</strong>
            <small>{summary.totalTickets} tickets</small>
          </article>

          <article>
            <span>Total Returned</span>
            <strong>{money(summary.totalReturned)}</strong>
            <small>Official graded returns</small>
          </article>
        </section>

        <section className="ghst-board-head">
          <div>
            <div className="ghst-kicker">LIVE TABLE</div>
            <h2>{primaryLabel} Standings</h2>
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
              Active participants will appear here automatically even before
              they place a wager.
            </span>
          </section>
        ) : (
          <section className="ghst-table-wrap">
            <div className="ghst-table">
              <div className="ghst-row ghst-head">
                <div>RK</div>
                <div>{sharedTeamFormat ? "TEAM" : "ENTRY"}</div>
                <div>{primaryLabel.toUpperCase()}</div>
                <div>WAGERED</div>
                <div>RETURNED</div>
                <div>NET</div>
                <div>TICKETS</div>
                <div>W-L</div>
                <div>OPEN</div>
              </div>

              {rows.map((row) => (
                <div className="ghst-row" key={row.key}>
                  <div className="ghst-rank">
                    <strong>#{row.rank}</strong>
                  </div>

                  <div className="ghst-identity">
                    <strong>{row.name}</strong>
                    <span>
                      {sharedTeamFormat && row.memberCount > 1
                        ? `${row.memberCount} members · `
                        : ""}
                      {row.racesGraded} races graded
                    </span>
                  </div>

                  <div className="ghst-primary">
                    <strong>
                      {gameFormat === "team_total_winnings"
                        ? money(row.totalReturned)
                        : gameFormat === "bankroll"
                          ? money(row.currentBankroll)
                          : `${row.net > 0 ? "+" : ""}${money(row.net)}`}
                    </strong>
                    {gameFormat === "bankroll" ? (
                      <span>Started {money(row.openingBankroll)}</span>
                    ) : null}
                  </div>

                  <div className="ghst-cell">
                    <strong>{money(row.totalStaked)}</strong>
                  </div>

                  <div className="ghst-cell">
                    <strong>{money(row.totalReturned)}</strong>
                  </div>

                  <div className="ghst-cell">
                    <strong
                      className={
                        row.net > 0
                          ? "ghst-positive"
                          : row.net < 0
                            ? "ghst-negative"
                            : ""
                      }
                    >
                      {row.net > 0 ? "+" : ""}
                      {money(row.net)}
                    </strong>
                  </div>

                  <div className="ghst-cell">
                    <strong>{row.tickets}</strong>
                  </div>

                  <div className="ghst-cell">
                    <strong>
                      {row.winners}-{row.losers}
                    </strong>
                    {row.refunded > 0 ? (
                      <span>{row.refunded} refund</span>
                    ) : null}
                  </div>

                  <div className="ghst-cell">
                    <strong>{row.pending}</strong>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {gameFormat === "team_head_to_head" ? (
          <div className="ghst-note">
            <strong>Head-to-Head:</strong> this table currently shows the
            shared-team live wager totals. Matchup W-L records will populate
            from the dedicated Greyhound matchup schedule when that competition
            layer is connected.
          </div>
        ) : null}
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

  .ghst-shell {
    width: min(1450px,100%);
    margin: 0 auto;
  }

  .ghst-top-links {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 12px;
  }

  .ghst-back,
  .ghst-secondary-link {
    min-height: 40px;
    display: inline-flex;
    align-items: center;
    padding: 0 13px;
    border: 1px solid #34363a;
    border-radius: 10px;
    background: #101113;
    color: #e5e7ea;
    font-size: 10px;
    font-weight: 900;
    text-decoration: none;
  }

  .ghst-secondary-link {
    border-color: rgba(230,98,34,.38);
    color: #ff9861;
  }

  .ghst-hero {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 18px;
    padding: 22px;
    border: 1px solid rgba(255,91,29,.28);
    border-radius: 18px;
    background:
      linear-gradient(135deg,rgba(126,16,13,.38),rgba(255,94,24,.09) 46%,#101113 100%);
    box-shadow: 0 22px 60px rgba(0,0,0,.30);
  }

  .ghst-kicker {
    color: #ff6b22;
    font-size: 9px;
    font-weight: 950;
    letter-spacing: .14em;
    text-transform: uppercase;
  }

  .ghst-hero h1 {
    margin: 7px 0 8px;
    font-size: clamp(30px,4vw,44px);
    line-height: 1;
    font-weight: 950;
    letter-spacing: -.035em;
  }

  .ghst-hero p {
    max-width: 820px;
    margin: 0;
    color: #9da2a9;
    font-size: 12px;
    line-height: 1.6;
    font-weight: 600;
  }

  .ghst-live {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  .ghst-live span,
  .ghst-format {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    min-height: 36px;
    padding: 0 11px;
    border: 1px solid rgba(230,98,34,.38);
    border-radius: 999px;
    background: rgba(89,28,11,.26);
    color: #ff9660;
    font-size: 9px;
    font-weight: 950;
    text-transform: uppercase;
    letter-spacing: .05em;
  }

  .ghst-live i {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #39c771;
    box-shadow: 0 0 0 4px rgba(57,199,113,.10);
  }

  .ghst-live button {
    min-height: 36px;
    padding: 0 12px;
    border: 1px solid #3b3d41;
    border-radius: 9px;
    background: #151618;
    color: #fff;
    cursor: pointer;
    font-size: 9px;
    font-weight: 950;
  }

  .ghst-live button:disabled { opacity: .55; cursor: not-allowed; }

  .ghst-error {
    margin-top: 12px;
    padding: 12px 13px;
    border: 1px solid rgba(198,51,43,.55);
    border-radius: 11px;
    background: rgba(79,15,13,.30);
    color: #ffaaa5;
    font-size: 11px;
    font-weight: 800;
  }

  .ghst-summary-grid {
    display: grid;
    grid-template-columns: repeat(4,minmax(0,1fr));
    gap: 10px;
    margin: 12px 0;
  }

  .ghst-summary-grid article {
    padding: 14px;
    border: 1px solid #2d2e31;
    border-radius: 14px;
    background: #101113;
  }

  .ghst-summary-grid span,
  .ghst-cell span,
  .ghst-primary span,
  .ghst-identity span {
    display: block;
    color: #7f858c;
    font-size: 9px;
    line-height: 1.4;
  }

  .ghst-summary-grid article > span {
    color: #9ea3aa;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: .05em;
  }

  .ghst-summary-grid strong {
    display: block;
    margin-top: 5px;
    font-size: 18px;
    font-weight: 950;
  }

  .ghst-summary-grid small {
    display: block;
    margin-top: 4px;
    color: #70767e;
    font-size: 9px;
  }

  .ghst-board-head {
    display: flex;
    align-items: end;
    justify-content: space-between;
    gap: 12px;
    margin: 20px 0 10px;
  }

  .ghst-board-head h2 {
    margin: 5px 0 0;
    font-size: 22px;
    font-weight: 950;
  }

  .ghst-toolbar {
    margin-bottom: 10px;
    padding: 12px;
    border: 1px solid #2d2f33;
    border-radius: 13px;
    background: #101113;
  }

  .ghst-toolbar label {
    display: grid;
    gap: 6px;
  }

  .ghst-toolbar label > span {
    color: #b9bdc2;
    font-size: 9px;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: .05em;
  }

  .ghst-toolbar input {
    width: 100%;
    min-height: 42px;
    padding: 9px 11px;
    border: 1px solid #36383c;
    border-radius: 10px;
    outline: none;
    background: #0b0c0e;
    color: #fff;
    font-size: 12px;
    font-weight: 750;
  }

  .ghst-toolbar input:focus {
    border-color: #e86124;
    box-shadow: 0 0 0 3px rgba(232,97,36,.10);
  }

  .ghst-table-wrap {
    overflow-x: auto;
    border: 1px solid #2d2f33;
    border-radius: 15px;
    background: #101113;
  }

  .ghst-table {
    min-width: 1000px;
  }

  .ghst-row {
    display: grid;
    grid-template-columns: 64px minmax(220px,1.6fr) minmax(130px,1fr) repeat(6,minmax(90px,.8fr));
    align-items: center;
    min-height: 68px;
    border-top: 1px solid #24262a;
  }

  .ghst-row > div {
    padding: 10px 12px;
    min-width: 0;
  }

  .ghst-row.ghst-head {
    min-height: 42px;
    border-top: 0;
    background: #0b0c0e;
    color: #777d85;
    font-size: 8px;
    font-weight: 950;
    letter-spacing: .07em;
  }

  .ghst-rank strong {
    color: #ff8a4d;
    font-size: 17px;
    font-weight: 950;
  }

  .ghst-identity strong,
  .ghst-primary strong,
  .ghst-cell strong {
    display: block;
    font-size: 12px;
    font-weight: 950;
  }

  .ghst-identity strong { font-size: 13px; }

  .ghst-positive { color: #54d488; }
  .ghst-negative { color: #ff756b; }

  .ghst-empty,
  .ghst-loading {
    padding: 28px;
    border: 1px solid #2d2f33;
    border-radius: 15px;
    background: #101113;
    text-align: center;
  }

  .ghst-empty strong {
    display: block;
    font-size: 14px;
  }

  .ghst-empty span {
    display: block;
    margin-top: 6px;
    color: #7f858c;
    font-size: 10px;
  }

  .ghst-note {
    margin-top: 11px;
    padding: 11px 13px;
    border: 1px solid rgba(230,98,34,.28);
    border-radius: 11px;
    background: rgba(92,31,12,.18);
    color: #c8b3a8;
    font-size: 10px;
    line-height: 1.55;
  }

  @media (max-width: 900px) {
    .ghst-summary-grid { grid-template-columns: repeat(2,minmax(0,1fr)); }
  }

  @media (max-width: 700px) {
    .ghst-page { padding: 12px 10px 70px; }

    .ghst-hero {
      align-items: stretch;
      flex-direction: column;
      padding: 16px;
    }

    .ghst-live {
      width: 100%;
      justify-content: space-between;
    }

    .ghst-live button { flex: 1; }

    .ghst-board-head {
      align-items: flex-start;
      flex-direction: column;
    }

    .ghst-format { max-width: 100%; }

    .ghst-table {
      min-width: 930px;
    }
  }

  @media (max-width: 430px) {
    .ghst-summary-grid { grid-template-columns: 1fr; }
    .ghst-top-links { align-items: stretch; flex-direction: column; }
    .ghst-back, .ghst-secondary-link { width: 100%; justify-content: center; }
  }
`;