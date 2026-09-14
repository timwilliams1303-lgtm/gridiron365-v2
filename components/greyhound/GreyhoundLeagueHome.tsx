"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "./GreyhoundLeagueHome.module.css";

type WorkspaceData = {
  success: boolean;
  league?: { id: string; name: string };
  settings?: {
    trackScope?: string;
    startingBankroll?: number | string;
  };
  card?: {
    id: number;
    raceDate: string;
    session: string | null;
    cardStatus: string;
    scheduledFirstPost: string | null;
    lockAt: string | null;
    track: {
      id: number;
      code: string;
      name: string | null;
    } | null;
  } | null;
  bankroll?: {
    id: number;
    startingBankroll: number;
    amountAllocated: number;
    amountUnallocated: number;
    officialReturn: number;
    cardStatus: string;
  } | null;
  races?: Array<{
    id: number;
    raceNumber: number;
    scheduledPostTime: string | null;
    raceStatus: string;
  }>;
  error?: string;
};

type Props = {
  leagueId: string;
};

function money(value: unknown) {
  const numeric = Number(value ?? 0);

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(Number.isFinite(numeric) ? numeric : 0);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not available yet";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Not posted yet";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function trackScopeLabel(value: unknown) {
  const scope = String(value ?? "wheeling").toLowerCase();

  if (scope === "all" || scope === "both") {
    return "Wheeling + Tri-State";
  }

  if (
    scope === "tri_state" ||
    scope === "tri-state" ||
    scope === "tri state" ||
    scope === "tristate"
  ) {
    return "Tri-State";
  }

  return "Wheeling Island";
}

export default function GreyhoundLeagueHome({ leagueId }: Props) {
  const [data, setData] = useState<WorkspaceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);

      try {
        const response = await fetch(
          `/api/greyhound/wager-workspace?leagueId=${encodeURIComponent(
            leagueId,
          )}`,
          { cache: "no-store" },
        );

        const payload = (await response.json()) as WorkspaceData;

        if (!response.ok || payload.success === false) {
          throw new Error(
            payload.error ?? "Unable to load Greyhound league overview.",
          );
        }

        setData(payload);
        setError("");
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load Greyhound league overview.",
        );
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [leagueId],
  );

  useEffect(() => {
    void load(false);
  }, [load]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void load(true);
    }, 60000);

    return () => window.clearInterval(interval);
  }, [load]);

  const races = data?.races ?? [];

  const nextRace = useMemo(() => {
    const now = Date.now();

    return (
      races.find((race) => {
        if (!race.scheduledPostTime) return false;

        const post = new Date(race.scheduledPostTime).getTime();

        return (
          Number.isFinite(post) &&
          post > now &&
          ["scheduled", "upcoming"].includes(
            String(race.raceStatus).toLowerCase(),
          )
        );
      }) ?? null
    );
  }, [races]);

  const startingBankroll =
    data?.bankroll?.startingBankroll ??
    Number(data?.settings?.startingBankroll ?? 0);

  const availableBankroll =
    data?.bankroll?.amountUnallocated ?? startingBankroll;

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            marginBottom: "12px",
          }}
        >
          <Link
            href="/my-leagues"
            style={{
              display: "inline-flex",
              minHeight: "42px",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              padding: "0 14px",
              border: "1px solid rgba(255, 103, 29, 0.38)",
              borderRadius: "10px",
              background:
                "linear-gradient(135deg, rgba(128, 24, 17, 0.48), rgba(54, 19, 12, 0.58))",
              color: "#ff9a62",
              textDecoration: "none",
              fontSize: "10px",
              fontWeight: 950,
              letterSpacing: "0.07em",
              textTransform: "uppercase",
            }}
          >
            <span aria-hidden="true">←</span>
            <span>Back to My Leagues</span>
          </Link>
        </div>

        <section className={styles.hero}>
          <div className={styles.heroTop}>
            <div>
              <div className={styles.eyebrow}>G365 Greyhound Racing</div>
              <h1 className={styles.title}>
                {data?.league?.name ?? "Greyhound League"}
              </h1>
              <p className={styles.subtitle}>
                League overview, bankroll status, race-card availability,
                standings access, and quick links to the betting terminal.
              </p>
            </div>

            <Link
              href={`/league/${leagueId}/greyhound/wagers`}
              className={styles.primaryButton}
            >
              Open My Wagers
            </Link>
          </div>

          <div className={styles.statGrid}>
            <div className={styles.statCard}>
              <span>Available Bankroll</span>
              <strong>{money(availableBankroll)}</strong>
              <small>Starting bankroll {money(startingBankroll)}</small>
            </div>

            <div className={styles.statCard}>
              <span>Wagered This Card</span>
              <strong>{money(data?.bankroll?.amountAllocated ?? 0)}</strong>
              <small>
                Official return {money(data?.bankroll?.officialReturn ?? 0)}
              </small>
            </div>

            <div className={styles.statCard}>
              <span>Track</span>
              <strong className={styles.statText}>
                {data?.card?.track?.name ??
                  trackScopeLabel(data?.settings?.trackScope)}
              </strong>
              <small>{data?.card?.track?.code ?? "Waiting for card"}</small>
            </div>

            <div className={styles.statCard}>
              <span>Card Status</span>
              <strong className={styles.statText}>
                {data?.card?.cardStatus?.replaceAll("_", " ") ?? "Waiting"}
              </strong>
              <small>
                {data?.card
                  ? formatDate(data.card.raceDate)
                  : "Next card loads automatically"}
              </small>
            </div>
          </div>
        </section>

        {error ? <div className={styles.error}>{error}</div> : null}

        <div className={styles.mainGrid}>
          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <div className={styles.eyebrow}>Today&apos;s Racing</div>
                <h2>Race Card Overview</h2>
              </div>

              <span
                className={
                  data?.card ? styles.statusLive : styles.statusWaiting
                }
              >
                {data?.card ? "Card Available" : "Waiting"}
              </span>
            </div>

            {loading && !data ? (
              <div className={styles.emptyState}>Loading league overview...</div>
            ) : data?.card ? (
              <div className={styles.panelBody}>
                <div className={styles.infoGrid}>
                  <div className={styles.infoBox}>
                    <span>Race Date</span>
                    <strong>{formatDate(data.card.raceDate)}</strong>
                  </div>

                  <div className={styles.infoBox}>
                    <span>First Post</span>
                    <strong>
                      {formatDateTime(data.card.scheduledFirstPost)}
                    </strong>
                  </div>

                  <div className={styles.infoBox}>
                    <span>Next Race</span>
                    <strong>
                      {nextRace ? `Race ${nextRace.raceNumber}` : "None"}
                    </strong>
                  </div>

                  <div className={styles.infoBox}>
                    <span>Races Loaded</span>
                    <strong>{races.length}</strong>
                  </div>
                </div>

                <div className={styles.raceStrip}>
                  {races.map((race) => (
                    <div key={race.id} className={styles.raceChip}>
                      <strong>Race {race.raceNumber}</strong>
                      <span>{race.raceStatus.replaceAll("_", " ")}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className={styles.panelBody}>
                <div className={styles.waitingBox}>
                  <h3>Waiting for the next active race card</h3>
                  <p>
                    G365 is checking the Greyhound feed automatically. When
                    today&apos;s card is published, races and dogs will appear
                    in My Wagers automatically.
                  </p>
                </div>

                <div className={styles.placeholderRaces}>
                  {Array.from({ length: 8 }, (_, index) => index + 1).map(
                    (raceNumber) => (
                      <div
                        key={raceNumber}
                        className={styles.placeholderRace}
                      >
                        <strong>Race {raceNumber}</strong>
                        <span>Waiting</span>
                      </div>
                    ),
                  )}
                </div>
              </div>
            )}
          </section>

          <aside className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <div className={styles.eyebrow}>League Hub</div>
                <h2>Quick Access</h2>
              </div>
            </div>

            <div className={styles.quickLinks}>
              <Link
                href={`/league/${leagueId}/greyhound/wagers`}
                className={styles.quickPrimary}
              >
                <strong>My Wagers</strong>
                <span>
                  Open the race card, select dogs, build wagers, and manage
                  your bankroll.
                </span>
              </Link>

              <Link
                href={`/league/${leagueId}/greyhound/league-wagers`}
                className={styles.quickLink}
              >
                <strong>League Wagers</strong>
                <span>View league wagering activity and results.</span>
              </Link>

              <Link
                href={`/league/${leagueId}/greyhound/standings`}
                className={styles.quickLink}
              >
                <strong>Standings</strong>
                <span>Follow bankroll performance and league position.</span>
              </Link>

              <Link
                href={`/league/${leagueId}/greyhound/recap`}
                className={styles.quickLink}
              >
                <strong>Recap</strong>
                <span>Review completed cards, returns, and highlights.</span>
              </Link>
            </div>
          </aside>
        </div>

        <div className={styles.bottomGrid}>
          <div className={styles.bottomCard}>
            <span>Next Race</span>
            <strong>
              {nextRace ? `Race ${nextRace.raceNumber}` : "Waiting for card"}
            </strong>
            <small>
              {nextRace
                ? formatDateTime(nextRace.scheduledPostTime)
                : "Race timing will appear automatically."}
            </small>
          </div>

          <div className={styles.bottomCard}>
            <span>Card Lock</span>
            <strong>
              {data?.card?.lockAt
                ? formatDateTime(data.card.lockAt)
                : "Not posted yet"}
            </strong>
            <small>Wager controls enforce card and race lock times.</small>
          </div>

          <div className={styles.bottomCard}>
            <span>Feed Status</span>
            <strong className={styles.green}>Automatic</strong>
            <small>This dashboard checks for new cards every minute.</small>
          </div>
        </div>
      </div>
    </main>
  );
}
