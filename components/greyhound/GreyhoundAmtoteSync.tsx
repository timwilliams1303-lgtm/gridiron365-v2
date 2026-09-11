"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  leagueId: string;
};

type TrackResult = {
  trackCode: string;
  raceDate: string;
  racesSeen: number;
  racesImported: number;
  entriesSeen: number;
  scratchesApplied: number;
  skipped: boolean;
  skipReason: string | null;
};

type SyncResponse = {
  success?: boolean;
  error?: string;
  tracks?: TrackResult[];
};

export default function GreyhoundAmtoteSync({ leagueId }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const syncNow = async () => {
    if (busy) return;

    setBusy(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/greyhound/amtote/sync-cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leagueId, track: "all" }),
      });

      const result = (await response.json().catch(() => null)) as SyncResponse | null;

      if (!response.ok) {
        throw new Error(result?.error ?? `Sync failed with HTTP ${response.status}.`);
      }

      const trackResults = result?.tracks ?? [];
      const imported = trackResults.reduce((sum, item) => sum + item.racesImported, 0);
      const entries = trackResults.reduce((sum, item) => sum + item.entriesSeen, 0);
      const scratches = trackResults.reduce((sum, item) => sum + item.scratchesApplied, 0);

      setMessage(
        `Official feed synced: ${imported} races processed, ${entries} entries seen${
          scratches > 0 ? `, ${scratches} scratch${scratches === 1 ? "" : "es"} applied` : ""
        }.`
      );

      router.refresh();
    } catch (unknownError) {
      setError(
        unknownError instanceof Error
          ? unknownError.message
          : "Could not sync the official Greyhound feed.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="gh-feed-sync">
      <style>{`
        .gh-feed-sync {
          margin-bottom: 22px;
          overflow: hidden;
          border: 1px solid #34363a;
          border-radius: 18px;
          background: linear-gradient(135deg, rgba(96,18,14,.36), #101113 42%, rgba(210,77,18,.12));
          box-shadow: 0 16px 40px rgba(0,0,0,.28);
        }
        .gh-feed-inner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          padding: 18px;
        }
        .gh-feed-kicker {
          color: #ff7b39;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: .18em;
          text-transform: uppercase;
        }
        .gh-feed-title {
          margin: 5px 0 0;
          color: #fff;
          font-size: 20px;
          font-weight: 900;
        }
        .gh-feed-copy {
          max-width: 720px;
          margin: 6px 0 0;
          color: #a3a7ad;
          font-size: 12px;
          line-height: 1.6;
        }
        .gh-feed-button {
          min-height: 44px;
          flex: 0 0 auto;
          padding: 0 18px;
          border: 1px solid rgba(255,139,67,.52);
          border-radius: 11px;
          background: linear-gradient(135deg,#a92317,#f06c22);
          color: #fff;
          font-size: 12px;
          font-weight: 900;
          cursor: pointer;
          box-shadow: 0 8px 24px rgba(221,70,24,.18);
        }
        .gh-feed-button:disabled { opacity: .55; cursor: wait; }
        .gh-feed-message, .gh-feed-error {
          margin: 0 18px 16px;
          padding: 10px 12px;
          border-radius: 10px;
          font-size: 11px;
          line-height: 1.5;
        }
        .gh-feed-message { border: 1px solid #275a3c; background: #10251a; color: #8de7ae; }
        .gh-feed-error { border: 1px solid #71302d; background: #2b1211; color: #ff9c94; }
        @media (max-width: 700px) {
          .gh-feed-inner { align-items: stretch; flex-direction: column; padding: 15px; }
          .gh-feed-button { width: 100%; }
          .gh-feed-title { font-size: 18px; }
          .gh-feed-message, .gh-feed-error { margin: 0 15px 15px; }
        }
      `}</style>

      <div className="gh-feed-inner">
        <div>
          <div className="gh-feed-kicker">Official AmTote Feed</div>
          <h2 className="gh-feed-title">Automatic Daily Race Cards</h2>
          <p className="gh-feed-copy">
            Wheeling and Tri-State entries now come directly from the official feed. The scheduled server sync keeps cards current automatically; this button is only for an immediate commissioner refresh.
          </p>
        </div>

        <button className="gh-feed-button" type="button" onClick={syncNow} disabled={busy}>
          {busy ? "SYNCING…" : "SYNC OFFICIAL ENTRIES NOW"}
        </button>
      </div>

      {message ? <div className="gh-feed-message">{message}</div> : null}
      {error ? <div className="gh-feed-error">{error}</div> : null}
    </section>
  );
}
