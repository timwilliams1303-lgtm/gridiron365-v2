"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type LeaderboardRow = {
  key: number;
  name: string;
  memberCount: number;
  tickets: number;
  staked: number;
  returned: number;
  net: number;
  wins: number;
  losses: number;
  refunds: number;
  pending: number;
  biggestReturn: number;
  biggestReturnWagerType: string | null;
  biggestReturnRace: number | null;
  bestWinningTicketProfit: number;
  openingBankroll: number;
  currentBankroll: number;
  rank: number;
};

type CardParticipant = {
  key: number;
  name: string;
  tickets: number;
  staked: number;
  returned: number;
  net: number;
  wins: number;
  losses: number;
};

type CardRecap = {
  cardId: number;
  raceDate: string;
  session: string | null;
  cardStatus: string;
  finalizedAt: string | null;
  trackCode: string;
  trackName: string;
  tickets: number;
  staked: number;
  returned: number;
  net: number;
  winners: number;
  losses: number;
  refunds: number;
  leader: CardParticipant | null;
  topThree: CardParticipant[];
};

type WagerTypeRow = {
  wagerType: string;
  tickets: number;
  staked: number;
  returned: number;
  wins: number;
  net: number;
  winRate: number;
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
    startingBankroll: number;
  };
  summary?: {
    entries: number;
    completedCards: number;
    totalTickets: number;
    totalStaked: number;
    totalReturned: number;
    totalNet: number;
    totalWinners: number;
  };
  leaderboard?: LeaderboardRow[];
  cards?: CardRecap[];
  awards?: {
    leader: LeaderboardRow | null;
    bestNet: LeaderboardRow | null;
    mostWinners: LeaderboardRow | null;
    mostActive: LeaderboardRow | null;
    bestReturn: LeaderboardRow | null;
    biggestTicket:
      | {
          name: string;
          officialReturn: number;
          profit: number;
          wagerType: string;
          raceNumber: number;
          raceDate: string | null;
          trackCode: string | null;
        }
      | null;
  };
  wagerTypes?: WagerTypeRow[];
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

function formatDate(value: string | null | undefined) {
  if (!value) return "Date pending";

  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return value;

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function formatLabel(value: string | null | undefined) {
  return String(value ?? "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function signedMoney(value: number) {
  return `${value > 0 ? "+" : ""}${money(value)}`;
}

export default function GreyhoundRecap({ leagueId }: Props) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cardFilter, setCardFilter] = useState("all");

  const load = useCallback(
    async (silent = false) => {
      if (silent) setRefreshing(true);
      else setLoading(true);

      setError(null);

      try {
        const response = await fetch(
          `/api/greyhound/recap?leagueId=${encodeURIComponent(leagueId)}`,
          {
            method: "GET",
            cache: "no-store",
          },
        );

        const payload = (await response.json()) as ApiResponse;

        if (!response.ok || !payload.success) {
          throw new Error(payload.error ?? "Unable to load Greyhound recap.");
        }

        setData(payload);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load Greyhound recap.",
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

  const cards = useMemo(() => {
    const all = data?.cards ?? [];

    if (cardFilter === "all") return all;

    return all.filter(
      (card) => card.trackCode.toUpperCase() === cardFilter.toUpperCase(),
    );
  }, [cardFilter, data?.cards]);

  const summary = data?.summary ?? {
    entries: 0,
    completedCards: 0,
    totalTickets: 0,
    totalStaked: 0,
    totalReturned: 0,
    totalNet: 0,
    totalWinners: 0,
  };

  const leaderboard = data?.leaderboard ?? [];
  const awards = data?.awards;
  const wagerTypes = data?.wagerTypes ?? [];
  const gameFormat = data?.competition?.gameFormat ?? "bankroll";
  const sharedTeamFormat = Boolean(data?.competition?.sharedTeamFormat);

  if (loading && !data) {
    return (
      <main className="ghr-page">
        <style>{styles}</style>
        <div className="ghr-shell">
          <div className="ghr-loading">Loading Greyhound recap…</div>
        </div>
      </main>
    );
  }

  return (
    <main className="ghr-page">
      <style>{styles}</style>

      <div className="ghr-shell">
        <div className="ghr-top-links">
          <Link href={`/league/${leagueId}`} className="ghr-link">
            ← Greyhound Home
          </Link>

          <div className="ghr-top-actions">
            <Link
              href={`/league/${leagueId}/greyhound/standings`}
              className="ghr-link"
            >
              Standings
            </Link>
            <Link
              href={`/league/${leagueId}/greyhound/league-wagers`}
              className="ghr-link"
            >
              League Wagers
            </Link>
          </div>
        </div>

        <section className="ghr-hero">
          <div>
            <div className="ghr-kicker">G365 GREYHOUND RACING</div>
            <h1>League Recap</h1>
            <p>
              Completed cards, finalized totals, top performers, winning
              tickets, wager trends, and competition highlights in one place.
            </p>
          </div>

          <div className="ghr-live">
            <span>UPDATED AFTER RESULTS</span>
            <button
              type="button"
              disabled={refreshing}
              onClick={() => void load(true)}
            >
              {refreshing ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </section>

        {error ? <div className="ghr-error">{error}</div> : null}

        <section className="ghr-summary">
          <article>
            <span>Completed Cards</span>
            <strong>{summary.completedCards}</strong>
            <small>Graded/final race cards</small>
          </article>
          <article>
            <span>Total Tickets</span>
            <strong>{summary.totalTickets}</strong>
            <small>{summary.totalWinners} winning tickets</small>
          </article>
          <article>
            <span>Total Wagered</span>
            <strong>{money(summary.totalStaked)}</strong>
            <small>League-wide stakes</small>
          </article>
          <article>
            <span>Total Returned</span>
            <strong>{money(summary.totalReturned)}</strong>
            <small className={summary.totalNet >= 0 ? "positive" : "negative"}>
              {signedMoney(summary.totalNet)} net
            </small>
          </article>
        </section>

        <section className="ghr-section">
          <div className="ghr-section-head">
            <div>
              <div className="ghr-kicker">COMPETITION RECAP</div>
              <h2>Recap Leaderboard</h2>
              <p>
                {sharedTeamFormat
                  ? "Shared Team Names remain consistent with League Wagers and Standings."
                  : "Entry Names remain consistent with League Wagers and Standings."}
              </p>
            </div>
            <div className="ghr-format">{formatLabel(gameFormat)}</div>
          </div>

          {leaderboard.length === 0 ? (
            <div className="ghr-empty">No active recap rows yet.</div>
          ) : (
            <div className="ghr-leaderboard">
              {leaderboard.slice(0, 10).map((row) => (
                <article className="ghr-leader-row" key={row.key}>
                  <div className="ghr-rank">#{row.rank}</div>
                  <div className="ghr-name">
                    <strong>{row.name}</strong>
                    <span>
                      {row.tickets} tickets · {row.wins}-{row.losses} W-L
                    </span>
                  </div>
                  <div>
                    <span>Wagered</span>
                    <strong>{money(row.staked)}</strong>
                  </div>
                  <div>
                    <span>Returned</span>
                    <strong>{money(row.returned)}</strong>
                  </div>
                  <div>
                    <span>Net</span>
                    <strong className={row.net >= 0 ? "positive" : "negative"}>
                      {signedMoney(row.net)}
                    </strong>
                  </div>
                  {gameFormat === "bankroll" ? (
                    <div>
                      <span>Bankroll</span>
                      <strong>{money(row.currentBankroll)}</strong>
                    </div>
                  ) : (
                    <div>
                      <span>Best Return</span>
                      <strong>{money(row.biggestReturn)}</strong>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="ghr-section">
          <div className="ghr-section-head">
            <div>
              <div className="ghr-kicker">AWARDS & HIGHLIGHTS</div>
              <h2>League Leaders</h2>
            </div>
          </div>

          <div className="ghr-awards">
            <article>
              <span>Overall Leader</span>
              <strong>{awards?.leader?.name ?? "No leader yet"}</strong>
              <small>
                {awards?.leader
                  ? gameFormat === "bankroll"
                    ? `${money(awards.leader.currentBankroll)} bankroll`
                    : `${signedMoney(awards.leader.net)} net`
                  : "Waiting for graded wagers"}
              </small>
            </article>

            <article>
              <span>Best Net Performance</span>
              <strong>{awards?.bestNet?.name ?? "—"}</strong>
              <small>
                {awards?.bestNet ? signedMoney(awards.bestNet.net) : "$0.00"}
              </small>
            </article>

            <article>
              <span>Most Winning Tickets</span>
              <strong>{awards?.mostWinners?.name ?? "—"}</strong>
              <small>{awards?.mostWinners?.wins ?? 0} winners</small>
            </article>

            <article>
              <span>Most Active</span>
              <strong>{awards?.mostActive?.name ?? "—"}</strong>
              <small>{awards?.mostActive?.tickets ?? 0} tickets placed</small>
            </article>

            <article>
              <span>Largest Return</span>
              <strong>{awards?.bestReturn?.name ?? "—"}</strong>
              <small>
                {awards?.bestReturn
                  ? `${money(awards.bestReturn.biggestReturn)} · ${formatLabel(
                      awards.bestReturn.biggestReturnWagerType,
                    )}`
                  : "$0.00"}
              </small>
            </article>

            <article className="ghr-award-feature">
              <span>Ticket of the Season</span>
              <strong>{awards?.biggestTicket?.name ?? "No winner yet"}</strong>
              <small>
                {awards?.biggestTicket
                  ? `${money(awards.biggestTicket.officialReturn)} returned · Race ${
                      awards.biggestTicket.raceNumber
                    } · ${formatLabel(awards.biggestTicket.wagerType)}`
                  : "The biggest winning ticket will appear here."}
              </small>
            </article>
          </div>
        </section>

        <section className="ghr-section">
          <div className="ghr-section-head ghr-card-head">
            <div>
              <div className="ghr-kicker">CARD-BY-CARD</div>
              <h2>Completed Racing Cards</h2>
              <p>Each completed card keeps its own leader and league totals.</p>
            </div>

            <div className="ghr-filter">
              {["all", "GWD", "GTS"].map((value) => (
                <button
                  key={value}
                  type="button"
                  className={cardFilter === value ? "active" : ""}
                  onClick={() => setCardFilter(value)}
                >
                  {value === "all" ? "All Cards" : value}
                </button>
              ))}
            </div>
          </div>

          {cards.length === 0 ? (
            <div className="ghr-empty">
              No completed cards for this filter yet.
            </div>
          ) : (
            <div className="ghr-card-grid">
              {cards.map((card) => (
                <article className="ghr-card" key={card.cardId}>
                  <div className="ghr-card-top">
                    <div>
                      <span className="ghr-track">{card.trackCode}</span>
                      <h3>{card.trackName}</h3>
                      <small>
                        {formatDate(card.raceDate)}
                        {card.session
                          ? ` · ${formatLabel(card.session)}`
                          : ""}
                      </small>
                    </div>
                    <div className="ghr-final">FINAL</div>
                  </div>

                  <div className="ghr-card-leader">
                    <span>Card Leader</span>
                    <strong>{card.leader?.name ?? "No graded wagers"}</strong>
                    <small>
                      {card.leader
                        ? `${signedMoney(card.leader.net)} net · ${money(
                            card.leader.returned,
                          )} returned`
                        : "Waiting for official grading"}
                    </small>
                  </div>

                  <div className="ghr-card-stats">
                    <div>
                      <span>Tickets</span>
                      <strong>{card.tickets}</strong>
                    </div>
                    <div>
                      <span>Wagered</span>
                      <strong>{money(card.staked)}</strong>
                    </div>
                    <div>
                      <span>Returned</span>
                      <strong>{money(card.returned)}</strong>
                    </div>
                    <div>
                      <span>Winners</span>
                      <strong>{card.winners}</strong>
                    </div>
                  </div>

                  {card.topThree.length > 0 ? (
                    <div className="ghr-podium">
                      {card.topThree.map((entry, index) => (
                        <div key={entry.key}>
                          <span>#{index + 1}</span>
                          <strong>{entry.name}</strong>
                          <small>{signedMoney(entry.net)}</small>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="ghr-section">
          <div className="ghr-section-head">
            <div>
              <div className="ghr-kicker">WAGER BREAKDOWN</div>
              <h2>Wager Type Performance</h2>
            </div>
          </div>

          {wagerTypes.length === 0 ? (
            <div className="ghr-empty">No wager-type history yet.</div>
          ) : (
            <div className="ghr-wager-table-wrap">
              <div className="ghr-wager-table">
                <div className="ghr-wager-row head">
                  <div>WAGER TYPE</div>
                  <div>TICKETS</div>
                  <div>WINS</div>
                  <div>WAGERED</div>
                  <div>RETURNED</div>
                  <div>NET</div>
                </div>

                {wagerTypes.map((row) => (
                  <div className="ghr-wager-row" key={row.wagerType}>
                    <div>
                      <strong>{formatLabel(row.wagerType)}</strong>
                    </div>
                    <div>{row.tickets}</div>
                    <div>{row.wins}</div>
                    <div>{money(row.staked)}</div>
                    <div>{money(row.returned)}</div>
                    <div
                      className={row.net >= 0 ? "positive" : "negative"}
                    >
                      <strong>{signedMoney(row.net)}</strong>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

const styles = `
  .ghr-page,.ghr-page *{box-sizing:border-box}
  .ghr-page{
    min-height:100vh;
    padding:18px 16px 70px;
    background:
      radial-gradient(circle at top left,rgba(132,18,13,.17),transparent 30%),
      linear-gradient(180deg,#07080b,#0c0c0f 48%,#07080a);
    color:#fff
  }
  .ghr-shell{width:min(1450px,100%);margin:0 auto}
  .ghr-top-links,.ghr-top-actions,.ghr-live,.ghr-section-head,.ghr-card-top{
    display:flex;align-items:center
  }
  .ghr-top-links{justify-content:space-between;gap:10px;margin-bottom:12px}
  .ghr-top-actions{gap:8px}
  .ghr-link{
    min-height:40px;display:inline-flex;align-items:center;padding:0 13px;
    border:1px solid #34363a;border-radius:10px;background:#101113;
    color:#e5e7ea;font-size:10px;font-weight:900;text-decoration:none
  }
  .ghr-hero{
    display:flex;align-items:center;justify-content:space-between;gap:18px;
    padding:22px;border:1px solid rgba(255,91,29,.28);border-radius:18px;
    background:linear-gradient(135deg,rgba(126,16,13,.38),rgba(255,94,24,.09) 46%,#101113 100%);
    box-shadow:0 22px 60px rgba(0,0,0,.30)
  }
  .ghr-kicker{color:#ff6b22;font-size:9px;font-weight:950;letter-spacing:.14em;text-transform:uppercase}
  .ghr-hero h1{margin:7px 0 8px;font-size:clamp(30px,4vw,44px);line-height:1;font-weight:950;letter-spacing:-.035em}
  .ghr-hero p,.ghr-section-head p{max-width:860px;margin:0;color:#8e949b;font-size:11px;line-height:1.6}
  .ghr-live{gap:8px;flex-shrink:0}
  .ghr-live span,.ghr-format,.ghr-track,.ghr-final{
    display:inline-flex;align-items:center;min-height:34px;padding:0 10px;border-radius:999px;
    font-size:8px;font-weight:950;letter-spacing:.06em;text-transform:uppercase
  }
  .ghr-live span,.ghr-format,.ghr-track{
    border:1px solid rgba(230,98,34,.38);background:rgba(89,28,11,.26);color:#ff9660
  }
  .ghr-live button{
    min-height:36px;padding:0 12px;border:1px solid #3b3d41;border-radius:9px;
    background:#151618;color:#fff;cursor:pointer;font-size:9px;font-weight:950
  }
  .ghr-live button:disabled{opacity:.55;cursor:not-allowed}
  .ghr-error,.ghr-loading,.ghr-empty{
    margin-top:12px;padding:18px;border:1px solid #2d2f33;border-radius:13px;background:#101113
  }
  .ghr-error{border-color:rgba(198,51,43,.55);background:rgba(79,15,13,.30);color:#ffaaa5;font-size:11px;font-weight:800}
  .ghr-loading,.ghr-empty{text-align:center;color:#9ca1a8;font-size:11px}
  .ghr-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:12px 0}
  .ghr-summary article,.ghr-awards article{
    padding:14px;border:1px solid #2d2e31;border-radius:14px;background:#101113
  }
  .ghr-summary span,.ghr-awards span,.ghr-leader-row span,.ghr-card span,.ghr-card-stats span{
    display:block;color:#858b92;font-size:8px;font-weight:900;text-transform:uppercase;letter-spacing:.05em
  }
  .ghr-summary strong{display:block;margin-top:5px;font-size:18px;font-weight:950}
  .ghr-summary small,.ghr-awards small,.ghr-card small,.ghr-name span{
    display:block;margin-top:4px;color:#70767e;font-size:9px;line-height:1.45
  }
  .ghr-section{
    margin-top:14px;padding:16px;border:1px solid #2d2f33;border-radius:16px;background:#101113
  }
  .ghr-section-head{justify-content:space-between;gap:12px;margin-bottom:12px}
  .ghr-section-head h2{margin:4px 0 4px;font-size:22px;font-weight:950}
  .ghr-leaderboard{overflow:hidden;border:1px solid #282a2e;border-radius:12px}
  .ghr-leader-row{
    display:grid;grid-template-columns:58px minmax(200px,1.5fr) repeat(4,minmax(105px,.8fr));
    align-items:center;min-height:66px;border-top:1px solid #25272b
  }
  .ghr-leader-row:first-child{border-top:0;background:linear-gradient(90deg,rgba(100,28,12,.24),transparent)}
  .ghr-leader-row>div{padding:10px 11px;min-width:0}
  .ghr-rank{color:#ff8649;font-size:18px;font-weight:950}
  .ghr-name strong,.ghr-leader-row>div>strong{font-size:12px;font-weight:950}
  .ghr-name strong{font-size:13px}
  .positive{color:#51d286!important}
  .negative{color:#ff756b!important}
  .ghr-awards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}
  .ghr-awards strong{display:block;margin-top:5px;font-size:14px;font-weight:950}
  .ghr-award-feature{border-color:rgba(230,98,34,.42)!important;background:linear-gradient(145deg,rgba(109,25,13,.34),#101113)!important}
  .ghr-card-head{align-items:flex-end}
  .ghr-filter{display:flex;gap:6px;flex-wrap:wrap}
  .ghr-filter button{
    min-height:36px;padding:0 11px;border:1px solid #35373a;border-radius:9px;
    background:#151618;color:#b8bdc3;cursor:pointer;font-size:9px;font-weight:950
  }
  .ghr-filter button.active{border-color:#e66124;background:rgba(108,31,12,.38);color:#ff9660}
  .ghr-card-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
  .ghr-card{padding:14px;border:1px solid #2d2f33;border-radius:14px;background:#0c0d0f}
  .ghr-card-top{justify-content:space-between;gap:10px}
  .ghr-card h3{margin:7px 0 0;font-size:16px;font-weight:950}
  .ghr-final{border:1px solid rgba(72,181,112,.35);background:rgba(30,94,54,.22);color:#77dc9c}
  .ghr-card-leader{
    margin-top:12px;padding:11px;border:1px solid rgba(230,98,34,.26);border-radius:11px;background:rgba(78,25,10,.18)
  }
  .ghr-card-leader strong{display:block;margin-top:4px;font-size:14px;font-weight:950}
  .ghr-card-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px;margin-top:10px}
  .ghr-card-stats>div{padding:9px;border:1px solid #292b2f;border-radius:9px;background:#111214}
  .ghr-card-stats strong{display:block;margin-top:4px;font-size:11px;font-weight:950}
  .ghr-podium{display:grid;gap:5px;margin-top:10px}
  .ghr-podium>div{
    display:grid;grid-template-columns:34px minmax(0,1fr) 90px;align-items:center;
    padding:8px 9px;border-top:1px solid #25272b
  }
  .ghr-podium>div>span{color:#ff8a4d}
  .ghr-podium strong{font-size:10px}
  .ghr-podium small{margin:0;text-align:right;color:#cfd2d6}
  .ghr-wager-table-wrap{overflow-x:auto;border:1px solid #292b2f;border-radius:12px}
  .ghr-wager-table{min-width:760px}
  .ghr-wager-row{
    display:grid;grid-template-columns:1.4fr repeat(5,minmax(100px,.8fr));
    align-items:center;min-height:48px;border-top:1px solid #25272b
  }
  .ghr-wager-row.head{min-height:40px;border-top:0;background:#0b0c0e;color:#777d85;font-size:8px;font-weight:950}
  .ghr-wager-row>div{padding:9px 11px;font-size:10px}
  .ghr-wager-row strong{font-weight:950}
  @media(max-width:950px){
    .ghr-summary{grid-template-columns:repeat(2,minmax(0,1fr))}
    .ghr-awards{grid-template-columns:repeat(2,minmax(0,1fr))}
    .ghr-card-grid{grid-template-columns:1fr}
    .ghr-leaderboard{overflow-x:auto}
    .ghr-leader-row{min-width:900px}
  }
  @media(max-width:700px){
    .ghr-page{padding:12px 10px 70px}
    .ghr-top-links,.ghr-hero,.ghr-section-head{align-items:stretch;flex-direction:column}
    .ghr-top-actions{display:grid;grid-template-columns:1fr 1fr}
    .ghr-link{justify-content:center}
    .ghr-hero{padding:16px}
    .ghr-live{width:100%;justify-content:space-between}
    .ghr-live button{flex:1}
    .ghr-awards{grid-template-columns:1fr}
    .ghr-card-stats{grid-template-columns:repeat(2,minmax(0,1fr))}
  }
  @media(max-width:430px){
    .ghr-summary{grid-template-columns:1fr}
    .ghr-top-actions{grid-template-columns:1fr}
  }
`;
