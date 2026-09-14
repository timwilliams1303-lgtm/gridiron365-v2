"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type TrophyAward = {
  id: number;
  key: string;
  title: string;
  recipientKey: number | null;
  recipientName: string;
  value: number | null;
  detail: string | null;
  icon: string;
  category: string;
  tone: string;
};

type Competition = {
  id: number;
  competitionNumber: number;
  gameFormat: string;
  competitionStartDate: string | null;
  competitionEndDate: string | null;
  completedAt: string;
  championKey: number | null;
  championName: string;
  runnerUpKey: number | null;
  runnerUpName: string | null;
  totalEntries: number;
  totalTickets: number;
  totalWagered: number;
  totalReturned: number;
  championNet: number;
  championReturned: number;
  standingsSnapshot: unknown[];
  awardsSnapshot: Record<string, unknown>;
  cardsSnapshot: unknown[];
  awards: TrophyAward[];
};

type ApiResponse = {
  success: boolean;
  error?: string;
  league?: {
    id: string;
    name: string;
  };
  summary?: {
    competitions: number;
    uniqueChampions: number;
    totalAwards: number;
    latestChampion: string | null;
  };
  dynastyBoard?: Array<{
    name: string;
    championships: number;
    dailySurvivorWins: number;
    legacyWins: number;
    totalChampionNet: number;
    totalChampionReturned: number;
    latestCompetition: number;
  }>;
  competitions?: Competition[];
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

function label(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function date(value: string | null | undefined) {
  if (!value) return "Date unavailable";

  const raw = value.slice(0, 10);
  const [year, month, day] = raw.split("-").map(Number);

  if (!year || !month || !day) return raw;

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}


type DailySurvivorMeta = {
  gameId: number | null;
  gameNumber: number | null;
  raceDate: string | null;
  trackId: number | null;
  trackCode: string | null;
  trackName: string | null;
  finalRaceId: number | null;
  finalRaceNumber: number | null;
};

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function nullableNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function dailySurvivorMeta(competition: Competition): DailySurvivorMeta | null {
  if (competition.gameFormat !== "daily_survivor") return null;

  const awards = record(competition.awardsSnapshot);
  const daily = record(awards?.dailySurvivor);

  if (daily) {
    return {
      gameId: nullableNumber(daily.gameId),
      gameNumber: nullableNumber(daily.gameNumber),
      raceDate:
        typeof daily.raceDate === "string" ? daily.raceDate : null,
      trackId: nullableNumber(daily.trackId),
      trackCode:
        typeof daily.trackCode === "string" ? daily.trackCode : null,
      trackName:
        typeof daily.trackName === "string" ? daily.trackName : null,
      finalRaceId: nullableNumber(daily.finalRaceId),
      finalRaceNumber: nullableNumber(daily.finalRaceNumber),
    };
  }

  const firstCard =
    Array.isArray(competition.cardsSnapshot) &&
    competition.cardsSnapshot.length > 0
      ? record(competition.cardsSnapshot[0])
      : null;

  return {
    gameId: nullableNumber(firstCard?.dailySurvivorGameId),
    gameNumber: nullableNumber(firstCard?.gameNumber),
    raceDate:
      typeof firstCard?.raceDate === "string" ? firstCard.raceDate : null,
    trackId: nullableNumber(firstCard?.trackId),
    trackCode:
      typeof firstCard?.trackCode === "string" ? firstCard.trackCode : null,
    trackName:
      typeof firstCard?.trackName === "string" ? firstCard.trackName : null,
    finalRaceId: nullableNumber(firstCard?.finalRaceId),
    finalRaceNumber: nullableNumber(firstCard?.finalRaceNumber),
  };
}

export default function GreyhoundTrophyCase({ leagueId }: Props) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/greyhound/trophy-case?leagueId=${encodeURIComponent(
            leagueId,
          )}`,
          {
            method: "GET",
            cache: "no-store",
          },
        );

        const payload = (await response.json()) as ApiResponse;

        if (!response.ok || !payload.success) {
          throw new Error(
            payload.error ?? "Unable to load Greyhound Trophy Case.",
          );
        }

        if (!cancelled) setData(payload);
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load Greyhound Trophy Case.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [leagueId]);

  const summary = data?.summary ?? {
    competitions: 0,
    uniqueChampions: 0,
    totalAwards: 0,
    latestChampion: null,
  };

  const dynastyBoard = data?.dynastyBoard ?? [];
  const competitions = data?.competitions ?? [];

  if (loading) {
    return (
      <main className="ght-page">
        <style>{styles}</style>
        <div className="ght-shell">
          <div className="ght-empty">Opening the Greyhound Trophy Case…</div>
        </div>
      </main>
    );
  }

  return (
    <main className="ght-page">
      <style>{styles}</style>

      <div className="ght-shell">
        <div className="ght-top">
          <Link href={`/league/${leagueId}`} className="ght-link">
            ← Greyhound Home
          </Link>

          <Link
            href={`/league/${leagueId}/greyhound/recap`}
            className="ght-link"
          >
            Recap
          </Link>
        </div>

        <section className="ght-hero">
          <div className="ght-trophy">🏆</div>

          <div>
            <div className="ght-kicker">G365 GREYHOUND LEGACY</div>
            <h1>Trophy Case</h1>
            <p>
              Permanent champions, competition awards, milestone winners,
              and historical Greyhound results.
            </p>
          </div>
        </section>

        {error ? <div className="ght-error">{error}</div> : null}

        <section className="ght-summary">
          <article>
            <span>Completed Competitions</span>
            <strong>{summary.competitions}</strong>
          </article>

          <article>
            <span>Unique Champions</span>
            <strong>{summary.uniqueChampions}</strong>
          </article>

          <article>
            <span>Permanent Awards</span>
            <strong>{summary.totalAwards}</strong>
          </article>

          <article>
            <span>Latest Champion</span>
            <strong>{summary.latestChampion ?? "Waiting"}</strong>
          </article>
        </section>

        <section className="ght-section">
          <div className="ght-section-head">
            <div>
              <div className="ght-kicker">CHAMPIONSHIP HISTORY</div>
              <h2>Dynasty Board</h2>
              <p>
                Champions remain here even if an Entry Name or Team Name is
                changed later.
              </p>
            </div>
          </div>

          {dynastyBoard.length === 0 ? (
            <div className="ght-empty">
              The Dynasty Board is empty. The first archived Greyhound
              champion will appear here after a competition is completed.
            </div>
          ) : (
            <div className="ght-dynasty">
              {dynastyBoard.map((row, index) => (
                <article key={`${row.name}-${index}`}>
                  <div className="ght-medal">
                    {index === 0 ? "👑" : "🏆"}
                  </div>
                  <div>
                    <span>#{index + 1} ALL-TIME</span>
                    <strong>{row.name}</strong>
                    <small>
                      Latest legacy event: #{row.latestCompetition}
                    </small>
                  </div>
                  <div className="ght-title-count">
                    <strong>{row.legacyWins}</strong>
                    <span>
                      {row.legacyWins === 1 ? "LEGACY WIN" : "LEGACY WINS"}
                    </span>
                    <small className="ght-title-breakdown">
                      {row.championships} title{row.championships === 1 ? "" : "s"}
                      {" · "}
                      {row.dailySurvivorWins} daily win
                      {row.dailySurvivorWins === 1 ? "" : "s"}
                    </small>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="ght-section">
          <div className="ght-section-head">
            <div>
              <div className="ght-kicker">THE VAULT</div>
              <h2>Competition Archive</h2>
              <p>
                Each completed competition keeps the names and results that
                existed when it ended.
              </p>
            </div>
          </div>

          {competitions.length === 0 ? (
            <div className="ght-empty">
              No completed Greyhound competitions have been archived yet.
            </div>
          ) : (
            <div className="ght-history">
              {competitions.map((competition) => {
                const daily = dailySurvivorMeta(competition);
                const isDailySurvivor =
                  competition.gameFormat === "daily_survivor";

                return (
                  <article key={competition.id} className="ght-history-card">
                    <div className="ght-history-top">
                      <div>
                        <span className="ght-number">
                          {isDailySurvivor
                            ? `DAILY SURVIVOR${
                                daily?.gameNumber
                                  ? ` · GAME ${daily.gameNumber}`
                                  : ""
                              }`
                            : `COMPETITION ${competition.competitionNumber}`}
                        </span>

                        <h3>
                          {isDailySurvivor
                            ? daily?.trackName ??
                              daily?.trackCode ??
                              "Daily Survivor"
                            : label(competition.gameFormat)}
                        </h3>

                        <small>
                          {isDailySurvivor
                            ? daily?.raceDate
                              ? date(daily.raceDate)
                              : competition.competitionStartDate
                                ? date(competition.competitionStartDate)
                                : "Date unavailable"
                            : <>
                                {competition.competitionStartDate
                                  ? date(competition.competitionStartDate)
                                  : "Start date unavailable"}
                                {competition.competitionEndDate
                                  ? ` – ${date(
                                      competition.competitionEndDate,
                                    )}`
                                  : ""}
                              </>}
                        </small>
                      </div>

                      <div className="ght-champion-badge">
                        <span>
                          {isDailySurvivor
                            ? "DAILY SURVIVOR WINNER"
                            : "CHAMPION"}
                        </span>
                        <strong>{competition.championName}</strong>
                      </div>
                    </div>

                    {isDailySurvivor ? (
                      <div className="ght-final-grid">
                        <div>
                          <span>Track</span>
                          <strong>
                            {daily?.trackName ??
                              daily?.trackCode ??
                              "Track unavailable"}
                          </strong>
                        </div>

                        <div>
                          <span>Game Date</span>
                          <strong>
                            {daily?.raceDate
                              ? date(daily.raceDate)
                              : competition.competitionStartDate
                                ? date(competition.competitionStartDate)
                                : "Unavailable"}
                          </strong>
                        </div>

                        <div>
                          <span>Final Surviving Race</span>
                          <strong>
                            {daily?.finalRaceNumber
                              ? `Race ${daily.finalRaceNumber}`
                              : "Unavailable"}
                          </strong>
                        </div>

                        <div>
                          <span>Entries</span>
                          <strong>{competition.totalEntries}</strong>
                        </div>

                        <div>
                          <span>Picks Recorded</span>
                          <strong>{competition.totalTickets}</strong>
                        </div>

                        <div>
                          <span>History Event</span>
                          <strong>#{competition.competitionNumber}</strong>
                        </div>
                      </div>
                    ) : (
                      <div className="ght-final-grid">
                        <div>
                          <span>Champion Net</span>
                          <strong
                            className={
                              competition.championNet >= 0
                                ? "positive"
                                : "negative"
                            }
                          >
                            {competition.championNet > 0 ? "+" : ""}
                            {money(competition.championNet)}
                          </strong>
                        </div>

                        <div>
                          <span>Champion Returned</span>
                          <strong>
                            {money(competition.championReturned)}
                          </strong>
                        </div>

                        <div>
                          <span>League Wagered</span>
                          <strong>{money(competition.totalWagered)}</strong>
                        </div>

                        <div>
                          <span>League Returned</span>
                          <strong>{money(competition.totalReturned)}</strong>
                        </div>

                        <div>
                          <span>Entries</span>
                          <strong>{competition.totalEntries}</strong>
                        </div>

                        <div>
                          <span>Tickets</span>
                          <strong>{competition.totalTickets}</strong>
                        </div>
                      </div>
                    )}

                    {competition.runnerUpName ? (
                      <div className="ght-runner-up">
                        <span>
                          {isDailySurvivor ? "LAST ELIMINATED" : "RUNNER-UP"}
                        </span>
                        <strong>{competition.runnerUpName}</strong>
                      </div>
                    ) : null}

                    {competition.awards.length > 0 ? (
                      <div className="ght-awards">
                        {competition.awards.map((award) => (
                          <div
                            key={award.id}
                            className={`ght-award ght-award-${award.tone}`}
                          >
                            <div className="ght-award-icon">
                              {award.icon}
                            </div>

                            <div className="ght-award-copy">
                              <span>{award.category}</span>
                              <strong>{award.title}</strong>
                              <b>{award.recipientName}</b>
                              <small>
                                {award.detail ??
                                  (award.value == null
                                    ? "Competition award"
                                    : isDailySurvivor
                                      ? String(award.value)
                                      : money(award.value))}
                              </small>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

const styles = `
  .ght-page,.ght-page *{box-sizing:border-box}
  .ght-page{
    min-height:100vh;padding:18px 16px 70px;color:#fff;
    background:
      radial-gradient(circle at 20% 0%,rgba(180,47,19,.18),transparent 29%),
      linear-gradient(180deg,#07080a,#0b0c0f 48%,#07080a)
  }
  .ght-shell{width:min(1400px,100%);margin:0 auto}
  .ght-top{display:flex;justify-content:space-between;gap:8px;margin-bottom:12px}
  .ght-link{
    display:inline-flex;align-items:center;justify-content:center;min-height:40px;
    padding:0 13px;border:1px solid #34363a;border-radius:10px;background:#101113;
    color:#e6e8eb;text-decoration:none;font-size:10px;font-weight:900
  }
  .ght-hero{
    display:flex;align-items:center;gap:18px;padding:22px;
    border:1px solid rgba(255,104,30,.30);border-radius:18px;
    background:linear-gradient(135deg,rgba(121,20,12,.40),rgba(233,90,24,.10) 48%,#111214);
    box-shadow:0 24px 60px rgba(0,0,0,.30)
  }
  .ght-trophy{
    display:grid;place-items:center;width:72px;height:72px;flex:0 0 72px;
    border:1px solid rgba(244,125,49,.38);border-radius:18px;
    background:rgba(84,26,9,.28);font-size:36px
  }
  .ght-kicker{color:#ff6d25;font-size:9px;font-weight:950;letter-spacing:.14em}
  .ght-hero h1{margin:6px 0 7px;font-size:clamp(30px,4vw,44px);line-height:1;font-weight:950}
  .ght-hero p,.ght-section-head p{margin:0;color:#90959c;font-size:11px;line-height:1.55}
  .ght-error,.ght-empty{
    margin-top:12px;padding:18px;border:1px solid #2d2f33;border-radius:13px;
    background:#101113;color:#989da4;text-align:center;font-size:11px
  }
  .ght-error{border-color:rgba(198,51,43,.55);color:#ffaaa5}
  .ght-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:12px 0}
  .ght-summary article{
    padding:14px;border:1px solid #2d2f33;border-radius:14px;background:#101113
  }
  .ght-summary span,.ght-final-grid span,.ght-dynasty span,.ght-awards span,.ght-runner-up span{
    display:block;color:#858a91;font-size:8px;font-weight:900;letter-spacing:.06em;text-transform:uppercase
  }
  .ght-summary strong{display:block;margin-top:6px;font-size:17px;font-weight:950}
  .ght-section{
    margin-top:14px;padding:16px;border:1px solid #2d2f33;border-radius:16px;background:#101113
  }
  .ght-section-head{margin-bottom:12px}
  .ght-section-head h2{margin:4px 0;font-size:22px;font-weight:950}
  .ght-dynasty{display:grid;gap:7px}
  .ght-dynasty article{
    display:grid;grid-template-columns:50px minmax(0,1fr) 90px;align-items:center;gap:9px;
    min-height:72px;padding:10px 12px;border:1px solid #292b2f;border-radius:12px;background:#0c0d0f
  }
  .ght-dynasty article:first-child{
    border-color:rgba(235,100,30,.38);
    background:linear-gradient(90deg,rgba(100,28,12,.30),#0c0d0f)
  }
  .ght-medal{font-size:25px;text-align:center}
  .ght-dynasty strong{display:block;margin-top:3px;font-size:13px;font-weight:950}
  .ght-dynasty small{display:block;margin-top:3px;color:#747a82;font-size:9px}
  .ght-title-count{text-align:center}
  .ght-title-count strong{font-size:22px;color:#ff8b4d}
  .ght-title-count span{margin-top:2px}
  .ght-title-breakdown{margin-top:4px!important;line-height:1.35}
  .ght-history{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
  .ght-history-card{
    padding:14px;border:1px solid #2c2e32;border-radius:14px;background:#0c0d0f
  }
  .ght-history-top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
  .ght-number{color:#ff6d25;font-size:8px;font-weight:950;letter-spacing:.09em}
  .ght-history-card h3{margin:5px 0 3px;font-size:16px;font-weight:950}
  .ght-history-card small{color:#747a82;font-size:9px}
  .ght-champion-badge{
    min-width:150px;padding:9px 10px;border:1px solid rgba(235,100,30,.35);
    border-radius:10px;background:rgba(91,27,10,.25);text-align:right
  }
  .ght-champion-badge span{display:block;color:#ff8c50;font-size:7px;font-weight:950}
  .ght-champion-badge strong{display:block;margin-top:4px;font-size:11px}
  .ght-final-grid{
    display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;margin-top:12px
  }
  .ght-final-grid>div{
    padding:9px;border:1px solid #292b2f;border-radius:9px;background:#111214
  }
  .ght-final-grid strong{display:block;margin-top:4px;font-size:11px;font-weight:950}
  .ght-runner-up{margin-top:10px;padding:9px 10px;border-top:1px solid #282a2e}
  .ght-runner-up strong{display:block;margin-top:3px;font-size:11px}
  .ght-awards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:12px}
  .ght-award{
    display:grid;grid-template-columns:44px minmax(0,1fr);gap:9px;align-items:center;
    min-height:76px;padding:10px;border:1px solid #303238;border-radius:11px;
    background:linear-gradient(135deg,#111214,#0c0d0f)
  }
  .ght-award-icon{
    display:grid;place-items:center;width:42px;height:42px;border-radius:50%;
    border:1px solid rgba(255,111,37,.30);background:rgba(255,111,37,.08);
    font-size:22px
  }
  .ght-award-copy span{font-size:7px;letter-spacing:.10em}
  .ght-award-copy strong{display:block;margin-top:3px;font-size:11px;font-weight:950}
  .ght-award-copy b{display:block;margin-top:2px;color:#f3f4f6;font-size:10px}
  .ght-award-copy small{display:block;margin-top:3px;color:#777d85;font-size:8px}
  .ght-award-gold{border-color:rgba(235,177,52,.40);background:linear-gradient(135deg,rgba(103,73,10,.23),#0c0d0f)}
  .ght-award-silver{border-color:rgba(190,197,207,.34)}
  .ght-award-green{border-color:rgba(71,194,126,.32)}
  .ght-award-red{border-color:rgba(221,61,49,.36)}
  .ght-award-orange{border-color:rgba(242,107,34,.36)}
  .ght-award-purple{border-color:rgba(157,102,255,.36)}
  .positive{color:#55d38a!important}
  .negative{color:#ff746b!important}
  @media(max-width:900px){
    .ght-summary{grid-template-columns:repeat(2,minmax(0,1fr))}
    .ght-history{grid-template-columns:1fr}
  }
  @media(max-width:650px){
    .ght-page{padding:12px 10px 70px}
    .ght-hero{align-items:flex-start;padding:16px}
    .ght-trophy{width:54px;height:54px;flex-basis:54px;font-size:26px}
    .ght-history-top{flex-direction:column}
    .ght-champion-badge{width:100%;text-align:left}
    .ght-final-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
  }
  @media(max-width:430px){
    .ght-top{flex-direction:column}
    .ght-summary{grid-template-columns:1fr}
    .ght-dynasty article{grid-template-columns:42px minmax(0,1fr) 64px}
    .ght-final-grid,.ght-awards{grid-template-columns:1fr}
  }
`;
