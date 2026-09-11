"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type RaceTimeRow = {
  raceNumber: number;
  grade: string | null;
  distanceYards: number | null;
  scheduledPostTime: string | null;
};

type Props = {
  leagueId: string;
  cardId: number;
  raceDate: string;
  trackName: string;
  timeZone: string;
  confirmed: boolean;
  automationEnabled: boolean;
  cardStatus: string;
  scheduledFirstPost: string | null;
  races: RaceTimeRow[];
};

type SaveResult = {
  success?: boolean;
  error?: string;
  result?: {
    automationEnabled?: boolean;
    awaitingRaceTimes?: boolean;
    missingRaceTimes?: number;
    scheduledFirstPost?: string | null;
  };
};

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function utcIsoToZonedInput(
  iso: string | null,
  timeZone: string,
): string {
  if (!iso) return "";

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

  const parts = formatter.formatToParts(date);
  const values = new Map(parts.map((part) => [part.type, part.value]));

  return `${values.get("year")}-${values.get("month")}-${values.get("day")}T${values.get("hour")}:${values.get("minute")}`;
}

function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  const parts = formatter.formatToParts(date);
  const values = new Map(parts.map((part) => [part.type, part.value]));

  const asUtc = Date.UTC(
    Number(values.get("year")),
    Number(values.get("month")) - 1,
    Number(values.get("day")),
    Number(values.get("hour")),
    Number(values.get("minute")),
    Number(values.get("second")),
  );

  return asUtc - date.getTime();
}

function zonedInputToUtcIso(value: string, timeZone: string): string {
  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/,
  );

  if (!match) {
    throw new Error("A race time is not in a valid date/time format.");
  }

  const [, year, month, day, hour, minute] = match;
  const wallClockUtc = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    0,
  );

  let guess = new Date(wallClockUtc);
  let offset = getTimeZoneOffsetMs(guess, timeZone);
  let utc = wallClockUtc - offset;

  guess = new Date(utc);
  const refinedOffset = getTimeZoneOffsetMs(guess, timeZone);

  if (refinedOffset !== offset) {
    offset = refinedOffset;
    utc = wallClockUtc - offset;
  }

  return new Date(utc).toISOString();
}

function addMinutesToLocalInput(value: string, minutes: number): string {
  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/,
  );

  if (!match) return "";

  const [, year, month, day, hour, minute] = match;
  const date = new Date(
    Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      0,
    ),
  );

  date.setUTCMinutes(date.getUTCMinutes() + minutes);

  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}T${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
}

function formatZoneLabel(timeZone: string): string {
  if (timeZone === "America/New_York") return "ET";
  return timeZone;
}

export default function GreyhoundRaceTimesEditor({
  leagueId,
  cardId,
  raceDate,
  trackName,
  timeZone,
  confirmed,
  automationEnabled,
  cardStatus,
  scheduledFirstPost,
  races,
}: Props) {
  const router = useRouter();

  const sortedRaces = useMemo(
    () => [...races].sort((a, b) => a.raceNumber - b.raceNumber),
    [races],
  );

  const [times, setTimes] = useState<Record<number, string>>(() =>
    Object.fromEntries(
      sortedRaces.map((race) => [
        race.raceNumber,
        utcIsoToZonedInput(race.scheduledPostTime, timeZone),
      ]),
    ),
  );

  const [firstPost, setFirstPost] = useState(() =>
    utcIsoToZonedInput(
      scheduledFirstPost ?? sortedRaces[0]?.scheduledPostTime ?? null,
      timeZone,
    ) || `${raceDate}T18:30`,
  );

  const [intervalMinutes, setIntervalMinutes] = useState(15);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const disabled =
    busy ||
    ["locked", "in_progress", "final", "cancelled"].includes(cardStatus);

  const missingCount = sortedRaces.filter(
    (race) => !times[race.raceNumber],
  ).length;

  const applySchedule = () => {
    setError("");
    setSuccess("");

    if (!firstPost) {
      setError("Enter the first post time before generating the race schedule.");
      return;
    }

    const next: Record<number, string> = {};

    sortedRaces.forEach((race, index) => {
      next[race.raceNumber] = addMinutesToLocalInput(
        firstPost,
        index * intervalMinutes,
      );
    });

    setTimes(next);
  };

  const clearSchedule = () => {
    setTimes(
      Object.fromEntries(sortedRaces.map((race) => [race.raceNumber, ""])),
    );
    setSuccess("");
    setError("");
  };

  const save = async () => {
    if (disabled) return;

    setBusy(true);
    setError("");
    setSuccess("");

    try {
      const raceTimes = sortedRaces.map((race) => ({
        raceNumber: race.raceNumber,
        scheduledPostTime: times[race.raceNumber]
          ? zonedInputToUtcIso(times[race.raceNumber], timeZone)
          : null,
      }));

      const response = await fetch(
        `/api/greyhound/cards/${cardId}/race-times`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            leagueId,
            raceTimes,
          }),
        },
      );

      const result = (await response.json().catch(() => null)) as SaveResult | null;

      if (!response.ok) {
        throw new Error(
          result?.error ?? `Race-time save failed with HTTP ${response.status}.`,
        );
      }

      const automationNow = Boolean(result?.result?.automationEnabled);
      const missingNow = result?.result?.missingRaceTimes ?? missingCount;

      if (automationNow) {
        setSuccess(
          "Race times saved. Lifecycle automation is active and scratch/lock times were generated.",
        );
      } else if (!confirmed) {
        setSuccess(
          "Race times saved. Confirm the card for racing before lifecycle automation can activate.",
        );
      } else if (missingNow > 0) {
        setSuccess(
          `Race times saved. ${missingNow} race time${missingNow === 1 ? " is" : "s are"} still missing, so automation remains off.`,
        );
      } else {
        setSuccess("Race times saved.");
      }

      router.refresh();
    } catch (unknownError) {
      setError(
        unknownError instanceof Error
          ? unknownError.message
          : "Could not save Greyhound race times.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="gh-time-editor">
      <style>{`
        .gh-time-editor {
          margin: 12px 14px 0;
          overflow: hidden;
          border: 1px solid #2b2d31;
          border-radius: 14px;
          background: #0d0e10;
        }
        .gh-time-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 14px;
          padding: 14px 16px;
          border-bottom: 1px solid #292b2f;
          background: linear-gradient(90deg, rgba(127, 20, 17, .30), rgba(232, 81, 23, .08), transparent);
        }
        .gh-time-kicker {
          color: #fb6b2c;
          font-size: 9px;
          font-weight: 900;
          letter-spacing: .16em;
          text-transform: uppercase;
        }
        .gh-time-title {
          margin-top: 4px;
          color: #fff;
          font-size: 17px;
          font-weight: 900;
        }
        .gh-time-copy {
          margin-top: 5px;
          max-width: 720px;
          color: #8d929a;
          font-size: 11px;
          line-height: 1.55;
        }
        .gh-time-state {
          flex: 0 0 auto;
          border: 1px solid #3b3d42;
          border-radius: 999px;
          padding: 7px 10px;
          color: #c9cbd0;
          background: #151619;
          font-size: 9px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .08em;
        }
        .gh-time-state.active {
          border-color: rgba(34,197,94,.35);
          color: #86efac;
          background: rgba(34,197,94,.09);
        }
        .gh-time-state.waiting {
          border-color: rgba(251,146,60,.35);
          color: #fdba74;
          background: rgba(251,146,60,.09);
        }
        .gh-time-tools {
          display: grid;
          grid-template-columns: minmax(190px, 1.5fr) minmax(120px, .6fr) auto auto;
          gap: 9px;
          align-items: end;
          padding: 13px 16px;
          border-bottom: 1px solid #24262a;
        }
        .gh-time-field label {
          display: block;
          margin-bottom: 5px;
          color: #777c84;
          font-size: 8px;
          font-weight: 900;
          letter-spacing: .10em;
          text-transform: uppercase;
        }
        .gh-time-input,
        .gh-time-select {
          width: 100%;
          min-height: 38px;
          border: 1px solid #34363b;
          border-radius: 9px;
          padding: 8px 10px;
          outline: none;
          color: #fff;
          background: #141518;
          font-size: 11px;
          font-weight: 700;
          color-scheme: dark;
        }
        .gh-time-input:focus,
        .gh-time-select:focus {
          border-color: #f05a24;
          box-shadow: 0 0 0 2px rgba(240,90,36,.12);
        }
        .gh-time-btn {
          min-height: 38px;
          border: 1px solid #3b3d42;
          border-radius: 9px;
          padding: 8px 12px;
          cursor: pointer;
          color: #fff;
          background: #1a1b1e;
          font-size: 9px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .06em;
        }
        .gh-time-btn:hover { filter: brightness(1.12); }
        .gh-time-btn.primary {
          border-color: rgba(239,68,68,.45);
          background: linear-gradient(90deg,#c51f1f,#ed641e);
        }
        .gh-time-btn:disabled {
          cursor: not-allowed;
          opacity: .45;
        }
        .gh-time-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0,1fr));
          gap: 8px;
          padding: 13px 16px;
        }
        .gh-time-race {
          border: 1px solid #292b2f;
          border-radius: 10px;
          padding: 10px;
          background: #111214;
        }
        .gh-time-race-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          margin-bottom: 7px;
        }
        .gh-time-race-head strong {
          color: #fff;
          font-size: 11px;
        }
        .gh-time-race-head span {
          color: #737880;
          font-size: 8px;
          font-weight: 800;
        }
        .gh-time-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 12px 16px 14px;
          border-top: 1px solid #24262a;
        }
        .gh-time-message {
          min-width: 0;
          color: #8b9098;
          font-size: 10px;
          line-height: 1.45;
        }
        .gh-time-message.error { color: #fca5a5; }
        .gh-time-message.success { color: #86efac; }
        .gh-time-save { min-width: 180px; }
        @media (max-width: 1000px) {
          .gh-time-grid { grid-template-columns: repeat(2,minmax(0,1fr)); }
          .gh-time-tools { grid-template-columns: 1fr 140px; }
          .gh-time-tools .gh-time-btn { width: 100%; }
        }
        @media (max-width: 650px) {
          .gh-time-editor { margin: 10px 8px 0; }
          .gh-time-head { flex-direction: column; padding: 12px; }
          .gh-time-tools { grid-template-columns: 1fr; padding: 11px 12px; }
          .gh-time-grid { grid-template-columns: 1fr; padding: 11px 12px; }
          .gh-time-footer { align-items: stretch; flex-direction: column; padding: 11px 12px 13px; }
          .gh-time-save { width: 100%; min-width: 0; }
        }
      `}</style>

      <div className="gh-time-head">
        <div>
          <div className="gh-time-kicker">Race Operations</div>
          <div className="gh-time-title">Race Times &amp; Automation</div>
          <div className="gh-time-copy">
            Set official post times for {trackName}. Times below are entered in {formatZoneLabel(timeZone)}. Automation turns on only after the card is confirmed and every race has a post time.
          </div>
        </div>

        <div
          className={`gh-time-state ${automationEnabled ? "active" : "waiting"}`}
        >
          {automationEnabled
            ? "Automation Active"
            : confirmed
              ? "Awaiting Race Times"
              : "Awaiting Confirmation"}
        </div>
      </div>

      <div className="gh-time-tools">
        <div className="gh-time-field">
          <label>First Post · {formatZoneLabel(timeZone)}</label>
          <input
            className="gh-time-input"
            type="datetime-local"
            value={firstPost}
            disabled={disabled}
            onChange={(event) => setFirstPost(event.target.value)}
          />
        </div>

        <div className="gh-time-field">
          <label>Race Interval</label>
          <select
            className="gh-time-select"
            value={intervalMinutes}
            disabled={disabled}
            onChange={(event) => setIntervalMinutes(Number(event.target.value))}
          >
            <option value={10}>10 minutes</option>
            <option value={12}>12 minutes</option>
            <option value={15}>15 minutes</option>
            <option value={20}>20 minutes</option>
          </select>
        </div>

        <button
          type="button"
          className="gh-time-btn"
          disabled={disabled}
          onClick={applySchedule}
        >
          Fill All Times
        </button>

        <button
          type="button"
          className="gh-time-btn"
          disabled={disabled}
          onClick={clearSchedule}
        >
          Clear
        </button>
      </div>

      <div className="gh-time-grid">
        {sortedRaces.map((race) => (
          <div className="gh-time-race" key={race.raceNumber}>
            <div className="gh-time-race-head">
              <strong>Race {race.raceNumber}</strong>
              <span>
                {[race.grade, race.distanceYards ? `${race.distanceYards} yd` : null]
                  .filter(Boolean)
                  .join(" · ") || "Scheduled"}
              </span>
            </div>

            <input
              className="gh-time-input"
              type="datetime-local"
              value={times[race.raceNumber] ?? ""}
              disabled={disabled}
              aria-label={`Race ${race.raceNumber} scheduled post time`}
              onChange={(event) =>
                setTimes((previous) => ({
                  ...previous,
                  [race.raceNumber]: event.target.value,
                }))
              }
            />
          </div>
        ))}
      </div>

      <div className="gh-time-footer">
        <div
          className={`gh-time-message ${error ? "error" : success ? "success" : ""}`}
        >
          {error ||
            success ||
            (missingCount > 0
              ? `${missingCount} race time${missingCount === 1 ? " is" : "s are"} currently missing.`
              : "All race times are filled in and ready to save.")}
        </div>

        <button
          type="button"
          className="gh-time-btn primary gh-time-save"
          disabled={disabled}
          onClick={save}
        >
          {busy ? "Saving..." : "Save Race Times"}
        </button>
      </div>
    </section>
  );
}
