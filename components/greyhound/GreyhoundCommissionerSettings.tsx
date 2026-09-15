"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type GameFormat =
  | "team_total_winnings"
  | "team_head_to_head"
  | "bankroll"
  | "survivor"
  | "tournament";

type TeamSetupMode = "random" | "manual";
type SurvivorMode = "round" | "daily";
type WageringStyle = "whole_card" | "live_bankroll";
type DurationMode = "single_day" | "date_range" | "weeks" | "rounds";
type CompetitionDay = 0 | 1 | 2 | 3 | 4 | 5 | 6;
type TrackScope = "wheeling" | "tri_state" | "all";

type RoundDraft = {
  id?: number;
  roundNumber: number;
  name: string;
  startDate: string;
  days: number;
  endDate: string;
};

export type GreyhoundCommissionerSettingsData = {
  gameFormat: GameFormat;
  teamSetupMode: TeamSetupMode | null;
  survivorMode: SurvivorMode;
  durationMode: DurationMode;
  competitionStartDate: string | null;
  competitionEndDate: string | null;
  competitionWeeks: number | null;
  competitionDays: CompetitionDay[];
  startingBankroll: number;
  trackScope: TrackScope;
  wageringStyle: WageringStyle;
  liveRaceLockMinutesBeforePost: number;
  liveMandatoryRaceAction: boolean;
  liveMinimumWagerPercent: number;
  liveAutoWagerEnabled: boolean;
  cardLockMinutesBeforeFirstPost: number;
  scratchCheckMinutesBeforeFirstPost: number;
  entryPullTimezone: string;
  allowWin: boolean;
  allowPlace: boolean;
  allowShow: boolean;
  allowExacta: boolean;
  allowQuinella: boolean;
  allowTrifecta: boolean;
  allowSuperfecta: boolean;
  rounds: RoundDraft[];
};

type Props = {
  leagueId: string;
  initialSettings: GreyhoundCommissionerSettingsData;
};

const COMPETITION_DAYS: Array<{
  id: CompetitionDay;
  short: string;
  label: string;
}> = [
  { id: 0, short: "Sun", label: "Sunday" },
  { id: 1, short: "Mon", label: "Monday" },
  { id: 2, short: "Tue", label: "Tuesday" },
  { id: 3, short: "Wed", label: "Wednesday" },
  { id: 4, short: "Thu", label: "Thursday" },
  { id: 5, short: "Fri", label: "Friday" },
  { id: 6, short: "Sat", label: "Saturday" },
];

const GAME_OPTIONS: Array<{
  id: GameFormat;
  title: string;
  description: string;
}> = [
  {
    id: "team_total_winnings",
    title: "Team Season — Total Winnings",
    description:
      "Teams compete across the configured contest window. Highest official total winnings wins.",
  },
  {
    id: "team_head_to_head",
    title: "Team Season — Head-to-Head",
    description:
      "Teams compete in scheduled head-to-head matchups across the configured season.",
  },
  {
    id: "bankroll",
    title: "Bankroll Challenge",
    description:
      "Every entry starts with the configured bankroll and competes on bankroll performance.",
  },
  {
    id: "survivor",
    title: "Survivor",
    description:
      "Each round can have its own start date and number of days. Lowest round winnings is eliminated.",
  },
  {
    id: "tournament",
    title: "Tournament",
    description:
      "Build custom tournament rounds with exact start dates and independently configured day counts.",
  },
];

function addDays(dateText: string, daysToAdd: number) {
  if (!dateText || !Number.isFinite(daysToAdd)) return "";
  const [year, month, day] = dateText.split("-").map(Number);
  if (!year || !month || !day) return "";
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + daysToAdd);
  return date.toISOString().slice(0, 10);
}

function gameLabel(value: GameFormat) {
  return GAME_OPTIONS.find((item) => item.id === value)?.title ?? value;
}

export default function GreyhoundCommissionerSettings({
  leagueId,
  initialSettings,
}: Props) {
  const router = useRouter();

  const [settings, setSettings] =
    useState<GreyhoundCommissionerSettingsData>(initialSettings);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  const isTeamGame =
    settings.gameFormat === "team_total_winnings" ||
    settings.gameFormat === "team_head_to_head";

  const isRoundGame =
    settings.gameFormat === "tournament" ||
    (settings.gameFormat === "survivor" &&
      settings.survivorMode === "round");

  const isDailySurvivor =
    settings.gameFormat === "survivor" &&
    settings.survivorMode === "daily";

  const calculatedEndDate = useMemo(() => {
    if (!settings.competitionStartDate) return "";

    if (settings.durationMode === "single_day") {
      return settings.competitionStartDate;
    }

    if (
      settings.durationMode === "weeks" &&
      settings.competitionWeeks &&
      settings.competitionWeeks > 0
    ) {
      return addDays(
        settings.competitionStartDate,
        settings.competitionWeeks * 7 - 1,
      );
    }

    return settings.competitionEndDate ?? "";
  }, [
    settings.competitionStartDate,
    settings.competitionEndDate,
    settings.competitionWeeks,
    settings.durationMode,
  ]);

  function update<K extends keyof GreyhoundCommissionerSettingsData>(
    key: K,
    value: GreyhoundCommissionerSettingsData[K],
  ) {
    setSettings((current) => ({
      ...current,
      [key]: value,
    }));
    setMessage("");
    setIsError(false);
  }

  function toggleCompetitionDay(day: CompetitionDay) {
    setSettings((current) => {
      const exists = current.competitionDays.includes(day);
      const nextDays = exists
        ? current.competitionDays.filter((value) => value !== day)
        : [...current.competitionDays, day].sort((a, b) => a - b);

      return {
        ...current,
        competitionDays: nextDays,
      };
    });
    setMessage("");
    setIsError(false);
  }

  function selectGameFormat(gameFormat: GameFormat) {
    const teamGame =
      gameFormat === "team_total_winnings" || gameFormat === "team_head_to_head";

    setSettings((current) => {
      const survivorMode =
        gameFormat === "survivor"
          ? current.survivorMode ?? "round"
          : current.survivorMode;

      const roundGame =
        gameFormat === "tournament" ||
        (gameFormat === "survivor" && survivorMode === "round");

      return {
        ...current,
        gameFormat,
        survivorMode,
        teamSetupMode: teamGame ? current.teamSetupMode ?? "random" : null,
        durationMode: roundGame
          ? "rounds"
          : current.durationMode === "rounds"
            ? "single_day"
            : current.durationMode,
        rounds:
          roundGame && current.rounds.length === 0
            ? [
                {
                  roundNumber: 1,
                  name: "Round 1",
                  startDate: "",
                  days: 1,
                  endDate: "",
                },
              ]
            : current.rounds,
      };
    });
    setMessage("");
    setIsError(false);
  }

  function addRound() {
    setSettings((current) => {
      const number = current.rounds.length + 1;
      const previous = current.rounds[current.rounds.length - 1];
      const suggestedStart =
        previous?.startDate && previous.days > 0
          ? addDays(previous.startDate, previous.days)
          : "";

      return {
        ...current,
        rounds: [
          ...current.rounds,
          {
            roundNumber: number,
            name: `Round ${number}`,
            startDate: suggestedStart,
            days: 1,
            endDate: suggestedStart,
          },
        ],
      };
    });
  }

  function updateRound(
    index: number,
    field: "name" | "startDate" | "days",
    value: string | number,
  ) {
    setSettings((current) => ({
      ...current,
      rounds: current.rounds.map((round, roundIndex) => {
        if (roundIndex !== index) return round;

        const next = {
          ...round,
          [field]: value,
        };

        const days = Number(next.days);
        next.endDate =
          next.startDate && Number.isInteger(days) && days > 0
            ? addDays(next.startDate, days - 1)
            : "";

        return next;
      }),
    }));
  }

  function removeRound(index: number) {
    setSettings((current) => ({
      ...current,
      rounds: current.rounds
        .filter((_, roundIndex) => roundIndex !== index)
        .map((round, roundIndex) => ({
          ...round,
          roundNumber: roundIndex + 1,
          name:
            /^Round \d+$/.test(round.name)
              ? `Round ${roundIndex + 1}`
              : round.name,
        })),
    }));
  }

  async function saveSettings() {
    if (saving) return;

    setSaving(true);
    setMessage("");
    setIsError(false);

    try {
      if (!Number.isFinite(settings.startingBankroll) || settings.startingBankroll <= 0) {
        throw new Error("Starting bankroll must be greater than $0.");
      }

      if (
        settings.wageringStyle === "live_bankroll" &&
        (
          !Number.isInteger(settings.liveRaceLockMinutesBeforePost) ||
          settings.liveRaceLockMinutesBeforePost < 0 ||
          settings.liveRaceLockMinutesBeforePost > 60
        )
      ) {
        throw new Error(
          "Live race lock must be between 0 and 60 minutes before post.",
        );
      }

      if (
        settings.wageringStyle === "live_bankroll" &&
        settings.liveMandatoryRaceAction &&
        (
          !Number.isFinite(settings.liveMinimumWagerPercent) ||
          settings.liveMinimumWagerPercent <= 0 ||
          settings.liveMinimumWagerPercent > 100
        )
      ) {
        throw new Error(
          "Live minimum bankroll action must be greater than 0% and no more than 100%.",
        );
      }

      if (
        !Number.isInteger(settings.cardLockMinutesBeforeFirstPost) ||
        settings.cardLockMinutesBeforeFirstPost < 0 ||
        settings.cardLockMinutesBeforeFirstPost > 1440
      ) {
        throw new Error("Card lock must be between 0 and 1,440 minutes.");
      }

      if (
        !Number.isInteger(settings.scratchCheckMinutesBeforeFirstPost) ||
        settings.scratchCheckMinutesBeforeFirstPost < 0 ||
        settings.scratchCheckMinutesBeforeFirstPost > 1440
      ) {
        throw new Error("Scratch check must be between 0 and 1,440 minutes.");
      }

      if (isRoundGame) {
        if (settings.rounds.length < 1) {
          throw new Error("Add at least one round.");
        }

        let previousEndDate = "";

        for (let index = 0; index < settings.rounds.length; index += 1) {
          const round = settings.rounds[index];
          const name = round.name.trim();
          const days = Number(round.days);

          if (!name) {
            throw new Error(`Round ${index + 1} needs a name.`);
          }

          if (!round.startDate) {
            throw new Error(`${name} needs a start date.`);
          }

          if (!Number.isInteger(days) || days < 1 || days > 365) {
            throw new Error(`${name} must run for 1 to 365 days.`);
          }

          const endDate = addDays(round.startDate, days - 1);

          if (previousEndDate && round.startDate <= previousEndDate) {
            throw new Error(`${name} must start after the previous round ends.`);
          }

          previousEndDate = endDate;
        }
      } else {
        if (!settings.competitionStartDate) {
          throw new Error("Choose a competition start date.");
        }

        if (
          settings.durationMode === "date_range" &&
          !settings.competitionEndDate
        ) {
          throw new Error("Choose a competition end date.");
        }

        if (
          settings.durationMode === "date_range" &&
          settings.competitionEndDate &&
          settings.competitionEndDate < settings.competitionStartDate
        ) {
          throw new Error("Competition end date cannot be before the start date.");
        }

        if (settings.durationMode === "weeks") {
          if (
            !Number.isInteger(settings.competitionWeeks) ||
            !settings.competitionWeeks ||
            settings.competitionWeeks < 1 ||
            settings.competitionWeeks > 52
          ) {
            throw new Error("Number of weeks must be between 1 and 52.");
          }
        }

        if (
          (settings.durationMode === "date_range" ||
            settings.durationMode === "weeks") &&
          settings.competitionDays.length === 0
        ) {
          throw new Error("Choose at least one competition day.");
        }
      }

      const response = await fetch(
        `/api/greyhound/commissioner/settings?leagueId=${encodeURIComponent(leagueId)}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify((() => {
            const { trackScope: _legacyTrackScope, ...settingsToSave } = settings;
            return settingsToSave;
          })()),
        },
      );

      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error ?? "Unable to save Greyhound settings.");
      }

      setSettings(payload.settings as GreyhoundCommissionerSettingsData);
      setMessage("Greyhound commissioner settings saved.");
      setIsError(false);
      router.refresh();
    } catch (error) {
      setIsError(true);
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to save Greyhound settings.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="ghs-page">
      <style>{`
        .ghs-page,
        .ghs-page * { box-sizing: border-box; }

        .ghs-page {
          min-height: 100vh;
          padding: 18px 16px 70px;
          background:
            radial-gradient(circle at top left, rgba(132,18,13,.16), transparent 30%),
            linear-gradient(180deg,#07080b,#0c0c0f 48%,#07080a);
          color: #fff;
        }

        .ghs-shell {
          width: min(1450px, 100%);
          margin: 0 auto;
        }

        .ghs-hero {
          overflow: hidden;
          border: 1px solid rgba(255,91,29,.28);
          border-radius: 18px;
          background:
            linear-gradient(135deg,rgba(126,16,13,.38),rgba(255,94,24,.09) 46%,#101113 100%);
          box-shadow: 0 22px 60px rgba(0,0,0,.30);
        }

        .ghs-hero-inner { padding: 22px; }
        .ghs-accent { height: 4px; background: linear-gradient(90deg,#981e17,#d73c1c,#f27525); }

        .ghs-kicker,
        .ghs-eyebrow {
          color: #ff6b22;
          font-size: 9px;
          font-weight: 950;
          letter-spacing: .14em;
          text-transform: uppercase;
        }

        .ghs-title {
          margin: 7px 0 8px;
          font-size: clamp(28px,4vw,42px);
          line-height: 1;
          font-weight: 950;
          letter-spacing: -.035em;
        }

        .ghs-date-input {
          color: #ffffff !important;
          -webkit-text-fill-color: #ffffff !important;
          color-scheme: dark;
          cursor: pointer;
        }

        .ghs-date-input::-webkit-datetime-edit,
        .ghs-date-input::-webkit-datetime-edit-fields-wrapper,
        .ghs-date-input::-webkit-datetime-edit-text,
        .ghs-date-input::-webkit-datetime-edit-month-field,
        .ghs-date-input::-webkit-datetime-edit-day-field,
        .ghs-date-input::-webkit-datetime-edit-year-field {
          color: #ffffff !important;
          -webkit-text-fill-color: #ffffff !important;
        }

        .ghs-date-input {
          position: relative;
          padding-right: 42px !important;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='%23ffffff' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='3' y='5' width='18' height='16' rx='2'/%3E%3Cpath d='M16 3v4M8 3v4M3 10h18'/%3E%3C/svg%3E") !important;
          background-repeat: no-repeat !important;
          background-position: right 12px center !important;
          background-size: 19px 19px !important;
        }

        .ghs-date-input::-webkit-calendar-picker-indicator {
          position: absolute;
          right: 8px;
          width: 28px;
          height: 28px;
          opacity: 0;
          cursor: pointer;
        }

        .ghs-copy {
          max-width: 880px;
          margin: 0;
          color: #a2a7ae;
          font-size: 13px;
          line-height: 1.65;
          font-weight: 600;
        }

        .ghs-summary {
          display: grid;
          grid-template-columns: repeat(4,minmax(0,1fr));
          gap: 9px;
          margin: 12px 0;
        }

        .ghs-summary-card,
        .ghs-section {
          border: 1px solid #2d2e31;
          border-radius: 15px;
          background: #101113;
        }

        .ghs-summary-card { padding: 13px; }
        .ghs-summary-value { margin-top: 6px; font-size: 16px; font-weight: 950; }
        .ghs-summary-note { margin-top: 3px; color: #777d85; font-size: 9px; }

        .ghs-grid {
          display: grid;
          grid-template-columns: repeat(2,minmax(0,1fr));
          gap: 12px;
        }

        .ghs-section { padding: 17px; }
        .ghs-section-wide { grid-column: 1 / -1; }

        .ghs-section h2 {
          margin: 5px 0 0;
          font-size: 20px;
          font-weight: 950;
        }

        .ghs-help {
          margin: 6px 0 0;
          color: #858a91;
          font-size: 11px;
          line-height: 1.55;
        }

        .ghs-choice-grid,
        .ghs-segment-grid,
        .ghs-wager-grid {
          display: grid;
          gap: 8px;
          margin-top: 13px;
        }

        .ghs-choice-grid { grid-template-columns: repeat(5,minmax(0,1fr)); }
        .ghs-segment-grid { grid-template-columns: repeat(3,minmax(0,1fr)); }
        .ghs-wager-grid { grid-template-columns: repeat(4,minmax(0,1fr)); }

        .ghs-choice,
        .ghs-segment,
        .ghs-toggle {
          min-height: 46px;
          border: 1px solid #35373a;
          border-radius: 11px;
          background: #151618;
          color: #d6d8db;
          cursor: pointer;
          text-align: left;
          transition: border-color .15s ease, background .15s ease, transform .15s ease;
        }

        .ghs-choice { min-height: 110px; padding: 12px; }
        .ghs-segment { padding: 10px 12px; font-weight: 900; text-align: center; }
        .ghs-toggle { padding: 12px; }

        .ghs-choice:hover,
        .ghs-segment:hover,
        .ghs-toggle:hover { border-color: rgba(255,107,34,.65); }

        .ghs-choice.active,
        .ghs-segment.active,
        .ghs-toggle.active {
          border-color: #e66124;
          background: linear-gradient(145deg,rgba(109,25,13,.58),rgba(49,24,14,.68));
          box-shadow: 0 10px 24px rgba(194,55,20,.10);
        }

        .ghs-choice strong,
        .ghs-toggle strong { display: block; color: #fff; font-size: 11px; }
        .ghs-choice span,
        .ghs-toggle span {
          display: block;
          margin-top: 5px;
          color: #7f848b;
          font-size: 9px;
          line-height: 1.45;
        }

        .ghs-fields {
          display: grid;
          grid-template-columns: repeat(2,minmax(0,1fr));
          gap: 10px;
          margin-top: 13px;
        }

        .ghs-day-wrap {
          margin-top: 14px;
        }

        .ghs-day-label {
          color: #b9bdc2;
          font-size: 9px;
          font-weight: 900;
          letter-spacing: .04em;
          text-transform: uppercase;
        }

        .ghs-day-help {
          margin-top: 5px;
          color: #777d85;
          font-size: 9px;
          line-height: 1.5;
        }

        .ghs-day-grid {
          display: grid;
          grid-template-columns: repeat(7,minmax(0,1fr));
          gap: 7px;
          margin-top: 9px;
        }

        .ghs-day {
          min-height: 42px;
          border: 1px solid #35373a;
          border-radius: 10px;
          background: #151618;
          color: #cfd2d6;
          cursor: pointer;
          font-size: 10px;
          font-weight: 950;
          transition: border-color .15s ease, background .15s ease, transform .15s ease;
        }

        .ghs-day:hover {
          border-color: rgba(255,107,34,.65);
        }

        .ghs-day.active {
          border-color: #e66124;
          background: linear-gradient(145deg,rgba(109,25,13,.66),rgba(49,24,14,.78));
          color: #fff;
          box-shadow: 0 8px 20px rgba(194,55,20,.10);
        }

        .ghs-day:disabled {
          opacity: .55;
          cursor: not-allowed;
        }

        .ghs-field {
          display: grid;
          gap: 6px;
          color: #b9bdc2;
          font-size: 9px;
          font-weight: 900;
          letter-spacing: .04em;
          text-transform: uppercase;
        }

        .ghs-input,
        .ghs-select {
          width: 100%;
          min-height: 44px;
          padding: 9px 11px;
          border: 1px solid #36383c;
          border-radius: 10px;
          outline: none;
          background: #0b0c0e;
          color: #fff;
          font-size: 12px;
          font-weight: 750;
          text-transform: none;
          letter-spacing: 0;
        }

        .ghs-input:focus,
        .ghs-select:focus {
          border-color: #e86124;
          box-shadow: 0 0 0 3px rgba(232,97,36,.10);
        }

        .ghs-round-list {
          display: grid;
          gap: 9px;
          margin-top: 13px;
        }

        .ghs-round {
          padding: 12px;
          border: 1px solid #303236;
          border-radius: 12px;
          background: #0c0d0f;
        }

        .ghs-round-head,
        .ghs-action-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }

        .ghs-round-title { font-size: 11px; font-weight: 950; color: #ff9660; }

        .ghs-remove,
        .ghs-secondary {
          min-height: 38px;
          padding: 0 12px;
          border: 1px solid #4a3430;
          border-radius: 9px;
          background: #17100f;
          color: #f1a081;
          cursor: pointer;
          font-size: 9px;
          font-weight: 950;
        }

        .ghs-add {
          min-height: 42px;
          padding: 0 14px;
          border: 1px solid rgba(230,97,36,.48);
          border-radius: 10px;
          background: rgba(99,32,12,.30);
          color: #ff9a62;
          cursor: pointer;
          font-size: 9px;
          font-weight: 950;
        }

        .ghs-end {
          margin-top: 8px;
          color: #7f858c;
          font-size: 9px;
        }

        .ghs-rule {
          margin-top: 10px;
          padding: 10px 12px;
          border: 1px solid rgba(232,97,36,.28);
          border-radius: 10px;
          background: rgba(92,31,12,.18);
          color: #c6b0a5;
          font-size: 10px;
          line-height: 1.55;
        }

        .ghs-message {
          margin-top: 12px;
          padding: 12px 13px;
          border-radius: 11px;
          font-size: 11px;
          font-weight: 800;
        }

        .ghs-message.good {
          border: 1px solid rgba(56,169,99,.42);
          background: rgba(20,91,50,.24);
          color: #9ce8bc;
        }

        .ghs-message.bad {
          border: 1px solid rgba(198,51,43,.55);
          background: rgba(79,15,13,.30);
          color: #ffaaa5;
        }

        .ghs-save {
          min-height: 46px;
          padding: 0 20px;
          border: 0;
          border-radius: 11px;
          background: linear-gradient(90deg,#a51e18,#ee671e);
          color: #fff;
          cursor: pointer;
          font-size: 11px;
          font-weight: 950;
          letter-spacing: .05em;
        }

        .ghs-save:disabled,
        .ghs-choice:disabled,
        .ghs-segment:disabled,
        .ghs-toggle:disabled,
        .ghs-add:disabled,
        .ghs-remove:disabled {
          opacity: .55;
          cursor: not-allowed;
        }

        @media (max-width: 1050px) {
          .ghs-choice-grid { grid-template-columns: repeat(2,minmax(0,1fr)); }
          .ghs-wager-grid { grid-template-columns: repeat(2,minmax(0,1fr)); }
        }

        @media (max-width: 760px) {
          .ghs-page { padding: 12px 10px 70px; }
          .ghs-hero-inner { padding: 16px; }
          .ghs-summary { grid-template-columns: repeat(2,minmax(0,1fr)); }
          .ghs-grid { grid-template-columns: 1fr; }
          .ghs-section-wide { grid-column: auto; }
          .ghs-choice-grid,
          .ghs-segment-grid,
          .ghs-fields { grid-template-columns: 1fr; }
          .ghs-day-grid { grid-template-columns: repeat(4,minmax(0,1fr)); }
          .ghs-choice { min-height: 86px; }
          .ghs-action-row { align-items: stretch; flex-direction: column; }
          .ghs-save, .ghs-secondary, .ghs-add { width: 100%; }
        }

        @media (max-width: 430px) {
          .ghs-summary { grid-template-columns: 1fr; }
          .ghs-wager-grid { grid-template-columns: 1fr; }
          .ghs-day-grid { grid-template-columns: repeat(2,minmax(0,1fr)); }
          .ghs-title { font-size: 28px; }
        }
      `}</style>

      <div className="ghs-shell">
        <section className="ghs-hero">
          <div className="ghs-hero-inner">
            <div className="ghs-kicker">
              G365 Greyhound Racing · Commissioner
            </div>

            <h1 className="ghs-title">Greyhound Settings</h1>

            <p className="ghs-copy">
              Control the Greyhound game format, competition schedule, bankroll,
              eligible tracks, wager types, race-card locking, and scratch timing.
              Changes save directly to this league.
            </p>
          </div>

          <div className="ghs-accent" />
        </section>

        <section className="ghs-summary">
          <div className="ghs-summary-card">
            <div className="ghs-eyebrow">GAME FORMAT</div>
            <div className="ghs-summary-value">
              {gameLabel(settings.gameFormat)}
            </div>
            <div className="ghs-summary-note">Current competition format</div>
          </div>

          <div className="ghs-summary-card">
            <div className="ghs-eyebrow">START</div>
            <div className="ghs-summary-value">
              {isRoundGame
                ? settings.rounds[0]?.startDate || "Not set"
                : settings.competitionStartDate || "Not set"}
            </div>
            <div className="ghs-summary-note">Competition start date</div>
          </div>

          <div className="ghs-summary-card">
            <div className="ghs-eyebrow">END</div>
            <div className="ghs-summary-value">
              {isRoundGame
                ? settings.rounds[settings.rounds.length - 1]?.endDate || "Not set"
                : calculatedEndDate || "Not set"}
            </div>
            <div className="ghs-summary-note">Calculated contest end</div>
          </div>

          <div className="ghs-summary-card">
            <div className="ghs-eyebrow">BANKROLL</div>
            <div className="ghs-summary-value">
              ${Number(settings.startingBankroll).toFixed(2)}
            </div>
            <div className="ghs-summary-note">Starting amount per entry</div>
          </div>
        </section>

        <div className="ghs-grid">
          <section className="ghs-section ghs-section-wide">
            <div className="ghs-eyebrow">COMPETITION</div>
            <h2>Game Format</h2>
            <p className="ghs-help">
              These are the five Greyhound formats available when creating or
              administering a league.
            </p>

            <div className="ghs-choice-grid">
              {GAME_OPTIONS.map((option) => {
                const selected = settings.gameFormat === option.id;

                return (
                  <button
                    key={option.id}
                    type="button"
                    disabled={saving}
                    onClick={() => selectGameFormat(option.id)}
                    className={`ghs-choice${selected ? " active" : ""}`}
                  >
                    <strong>{option.title}</strong>
                    <span>{option.description}</span>
                  </button>
                );
              })}
            </div>

            {isTeamGame ? (
              <>
                <div className="ghs-eyebrow" style={{ marginTop: 16 }}>
                  TEAM SETUP
                </div>
                <div className="ghs-segment-grid">
                  {(["random", "manual"] as TeamSetupMode[]).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      disabled={saving}
                      onClick={() => update("teamSetupMode", mode)}
                      className={`ghs-segment${
                        settings.teamSetupMode === mode ? " active" : ""
                      }`}
                    >
                      {mode === "random"
                        ? "Randomize Teams"
                        : "Manual Teams"}
                    </button>
                  ))}
                </div>
              </>
            ) : null}

            {settings.gameFormat === "survivor" ? (
              <>
                <div className="ghs-eyebrow" style={{ marginTop: 16 }}>
                  SURVIVOR MODE
                </div>
                <div className="ghs-segment-grid">
                  {(
                    [
                      ["round", "Round Survivor"],
                      ["daily", "Daily Race Survivor"],
                    ] as Array<[SurvivorMode, string]>
                  ).map(([mode, label]) => (
                    <button
                      key={mode}
                      type="button"
                      disabled={saving}
                      onClick={() =>
                        setSettings((current) => ({
                          ...current,
                          survivorMode: mode,
                          durationMode:
                            mode === "round"
                              ? "rounds"
                              : current.durationMode === "rounds"
                                ? "single_day"
                                : current.durationMode,
                          rounds:
                            mode === "round" && current.rounds.length === 0
                              ? [
                                  {
                                    roundNumber: 1,
                                    name: "Round 1",
                                    startDate: "",
                                    days: 1,
                                    endDate: "",
                                  },
                                ]
                              : current.rounds,
                        }))
                      }
                      className={`ghs-segment${
                        settings.survivorMode === mode ? " active" : ""
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <div className="ghs-rule">
                  {settings.survivorMode === "daily" ? (
                    <>
                      <strong>Daily Race Survivor:</strong> each active entry picks
                      one dog in each eligible race. A 1st, 2nd, or 3rd-place finish
                      survives. A finish outside the top 3 eliminates the entry.
                      If every remaining entry misses in the same race, all of those
                      entries stay alive and continue to the next race.
                    </>
                  ) : (
                    <>
                      <strong>Round Survivor:</strong> the lowest official total
                      winnings at the end of each configured round is eliminated.
                    </>
                  )}
                </div>
              </>
            ) : null}
          </section>

          <section className="ghs-section ghs-section-wide">
            <div className="ghs-eyebrow">SCHEDULE</div>
            <h2>{isRoundGame ? "Round Builder" : isDailySurvivor ? "Daily Survivor Dates" : "Competition Dates"}</h2>
            <p className="ghs-help">
              {isRoundGame
                ? "Each round gets its own exact start date and number of days."
                : isDailySurvivor
                  ? "Choose the dates and competition days when Daily Race Survivor games can run."
                  : "Choose the exact start date and how long the competition runs."}
            </p>

            {isRoundGame ? (
              <>
                <div className="ghs-round-list">
                  {settings.rounds.map((round, index) => {
                    const endDate =
                      round.startDate && round.days > 0
                        ? addDays(round.startDate, round.days - 1)
                        : "";

                    return (
                      <div className="ghs-round" key={`${round.id ?? "new"}-${index}`}>
                        <div className="ghs-round-head">
                          <div className="ghs-round-title">
                            Round {index + 1}
                          </div>

                          <button
                            type="button"
                            className="ghs-remove"
                            disabled={saving || settings.rounds.length <= 1}
                            onClick={() => removeRound(index)}
                          >
                            Remove
                          </button>
                        </div>

                        <div className="ghs-fields">
                          <label className="ghs-field">
                            Round Name
                            <input
                              className="ghs-input"
                              value={round.name}
                              maxLength={80}
                              disabled={saving}
                              onChange={(event) =>
                                updateRound(index, "name", event.target.value)
                              }
                            />
                          </label>

                          <label className="ghs-field">
                            Start Date
                            <input
                              className="ghs-input ghs-date-input"
                              type="date"
                              value={round.startDate}
                              disabled={saving}
                              onChange={(event) =>
                                updateRound(index, "startDate", event.target.value)
                              }
                            />
                          </label>

                          <label className="ghs-field">
                            Number of Days
                            <input
                              className="ghs-input"
                              type="number"
                              min={1}
                              max={365}
                              step={1}
                              value={round.days}
                              disabled={saving}
                              onChange={(event) =>
                                updateRound(
                                  index,
                                  "days",
                                  Number(event.target.value),
                                )
                              }
                            />
                          </label>

                          <label className="ghs-field">
                            End Date
                            <input
                              className="ghs-input"
                              value={endDate}
                              readOnly
                            />
                          </label>
                        </div>

                        <div className="ghs-end">
                          {endDate
                            ? `${round.name || `Round ${index + 1}`} runs ${round.startDate} through ${endDate}.`
                            : "Choose a start date and number of days."}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="ghs-action-row" style={{ marginTop: 10 }}>
                  <button
                    type="button"
                    className="ghs-add"
                    disabled={saving}
                    onClick={addRound}
                  >
                    + Add Round
                  </button>
                </div>

                {settings.gameFormat === "survivor" &&
                settings.survivorMode === "round" ? (
                  <div className="ghs-rule">
                    <strong>Round Survivor rule:</strong> the lowest official total
                    winnings for each configured round is eliminated at the end
                    of that round.
                  </div>
                ) : null}
              </>
            ) : (
              <>
                <div className="ghs-segment-grid">
                  {(
                    [
                      ["single_day", "1 Day"],
                      ["date_range", "Date Range"],
                      ["weeks", "Number of Weeks"],
                    ] as Array<[DurationMode, string]>
                  ).map(([mode, label]) => (
                    <button
                      key={mode}
                      type="button"
                      disabled={saving}
                      onClick={() => update("durationMode", mode)}
                      className={`ghs-segment${
                        settings.durationMode === mode ? " active" : ""
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <div className="ghs-fields">
                  <label className="ghs-field">
                    Start Date
                    <input
                      className="ghs-input ghs-date-input"
                      type="date"
                      value={settings.competitionStartDate ?? ""}
                      disabled={saving}
                      onChange={(event) =>
                        update(
                          "competitionStartDate",
                          event.target.value || null,
                        )
                      }
                    />
                  </label>

                  {settings.durationMode === "date_range" ? (
                    <label className="ghs-field">
                      End Date
                      <input
                        className="ghs-input ghs-date-input"
                        type="date"
                        min={settings.competitionStartDate ?? undefined}
                        value={settings.competitionEndDate ?? ""}
                        disabled={saving}
                        onChange={(event) =>
                          update(
                            "competitionEndDate",
                            event.target.value || null,
                          )
                        }
                      />
                    </label>
                  ) : null}

                  {settings.durationMode === "weeks" ? (
                    <label className="ghs-field">
                      Number of Weeks
                      <input
                        className="ghs-input"
                        type="number"
                        min={1}
                        max={52}
                        step={1}
                        value={settings.competitionWeeks ?? ""}
                        disabled={saving}
                        onChange={(event) =>
                          update(
                            "competitionWeeks",
                            event.target.value
                              ? Number(event.target.value)
                              : null,
                          )
                        }
                      />
                    </label>
                  ) : null}

                  <label className="ghs-field">
                    Calculated End
                    <input
                      className="ghs-input"
                      value={calculatedEndDate}
                      readOnly
                    />
                  </label>
                </div>

                {settings.durationMode === "date_range" ||
                settings.durationMode === "weeks" ? (
                  <div className="ghs-day-wrap">
                    <div className="ghs-day-label">Competition Days</div>
                    <div className="ghs-day-help">
                      Choose which days of the week count for this competition.
                      Racing cards on unselected days are outside the contest window.
                    </div>

                    <div className="ghs-day-grid">
                      {COMPETITION_DAYS.map((day) => {
                        const active = settings.competitionDays.includes(day.id);

                        return (
                          <button
                            key={day.id}
                            type="button"
                            className={`ghs-day${active ? " active" : ""}`}
                            disabled={saving}
                            onClick={() => toggleCompetitionDay(day.id)}
                            title={day.label}
                          >
                            {day.short}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : settings.durationMode === "single_day" &&
                  settings.competitionStartDate ? (
                  <div className="ghs-rule">
                    <strong>Competition day:</strong> this one-day contest uses the
                    weekday of the selected start date automatically.
                  </div>
                ) : null}

                {isDailySurvivor ? (
                  <div className="ghs-rule">
                    <strong>Daily Race Survivor lifecycle:</strong> every active
                    entry makes one dog selection per eligible race. Top 3 survives;
                    4th or worse is eliminated. If all remaining live entries miss
                    the same race, they all carry forward. When one entry remains,
                    that entry wins the game. The next eligible race starts a new
                    game with the full field.
                  </div>
                ) : null}
              </>
            )}
          </section>

          <section className="ghs-section">
            <div className="ghs-eyebrow">BANKROLL</div>
            <h2>Starting Bankroll</h2>
            <p className="ghs-help">
              Starting amount used when a new competition bankroll is created.
            </p>

            <div className="ghs-fields">
              <label className="ghs-field">
                Starting Bankroll ($)
                <input
                  className="ghs-input"
                  type="number"
                  inputMode="decimal"
                  min={0.01}
                  step={0.01}
                  value={settings.startingBankroll}
                  disabled={saving}
                  onChange={(event) =>
                    update("startingBankroll", Number(event.target.value))
                  }
                />
              </label>
            </div>
          </section>

          <section className="ghs-section">
            <div className="ghs-eyebrow">RACE CARD SELECTION</div>
            <h2>Tracks & Racing Dates</h2>
            <p className="ghs-help">
              Members choose the racing date and available Wheeling or Tri-State
              card from My Wagers. Track selection is no longer a commissioner
              league setting.
            </p>
          </section>

          <section className="ghs-section ghs-section-wide">
            <div className="ghs-eyebrow">WAGERING</div>
            <h2>Allowed Wager Types</h2>
            <p className="ghs-help">
              Win/Place/Show combination bets use these base wager permissions.
              Perfecta is not offered in G365 Greyhound Racing.
            </p>

            <div className="ghs-wager-grid">
              {[
                ["allowWin", "Win", "Enable straight Win wagers."],
                ["allowPlace", "Place", "Enable straight Place wagers."],
                ["allowShow", "Show", "Enable straight Show wagers."],
                ["allowExacta", "Exacta", "Enable Exacta wagers."],
                ["allowQuinella", "Quinella", "Enable Quinella wagers."],
                ["allowTrifecta", "Trifecta", "Enable Trifecta wagers."],
                ["allowSuperfecta", "Superfecta", "Enable Superfecta wagers."],
              ].map(([key, label, description]) => {
                const typedKey =
                  key as keyof Pick<
                    GreyhoundCommissionerSettingsData,
                    | "allowWin"
                    | "allowPlace"
                    | "allowShow"
                    | "allowExacta"
                    | "allowQuinella"
                    | "allowTrifecta"
                    | "allowSuperfecta"
                  >;
                const active = Boolean(settings[typedKey]);

                return (
                  <button
                    key={key}
                    type="button"
                    disabled={saving}
                    onClick={() => update(typedKey, !active)}
                    className={`ghs-toggle${active ? " active" : ""}`}
                  >
                    <strong>{label}</strong>
                    <span>{active ? "Enabled" : "Disabled"} · {description}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="ghs-section ghs-section-wide">
            <div className="ghs-eyebrow">WAGERING LIFECYCLE</div>
            <h2>Wagering Style</h2>
            <p className="ghs-help">
              Whole Card keeps the existing card-wide lock. Live Bankroll Challenge
              opens one race at a time and makes official returns available for the
              next race.
            </p>

            <div className="ghs-segment-grid">
              <button
                type="button"
                disabled={saving}
                onClick={() => update("wageringStyle", "whole_card")}
                className={`ghs-segment${
                  settings.wageringStyle === "whole_card" ? " active" : ""
                }`}
              >
                Whole Card
              </button>

              <button
                type="button"
                disabled={saving}
                onClick={() => update("wageringStyle", "live_bankroll")}
                className={`ghs-segment${
                  settings.wageringStyle === "live_bankroll" ? " active" : ""
                }`}
              >
                Live Bankroll Challenge
              </button>
            </div>

            {settings.wageringStyle === "whole_card" ? (
              <>
                <div className="ghs-rule">
                  <strong>Whole Card:</strong> the entire racing card locks before
                  Race 1. Winnings are graded through the existing Whole Card
                  lifecycle and are not reused for later races on that card.
                </div>

                <div className="ghs-fields">
                  <label className="ghs-field">
                    Lock Minutes Before First Post
                    <input
                      className="ghs-input"
                      type="number"
                      min={0}
                      max={1440}
                      step={1}
                      value={settings.cardLockMinutesBeforeFirstPost}
                      disabled={saving}
                      onChange={(event) =>
                        update(
                          "cardLockMinutesBeforeFirstPost",
                          Number(event.target.value),
                        )
                      }
                    />
                  </label>
                </div>
              </>
            ) : (
              <>
                <div className="ghs-rule">
                  <strong>Live Bankroll Challenge:</strong> only the current race is
                  open. Each race locks independently, and official returns from the
                  settled race become available for the next race. A $0 available
                  bankroll is BUSTED for that card.
                </div>

                <div className="ghs-fields">
                  <label className="ghs-field">
                    Race Lock Minutes Before Post
                    <input
                      className="ghs-input"
                      type="number"
                      min={0}
                      max={60}
                      step={1}
                      value={settings.liveRaceLockMinutesBeforePost}
                      disabled={saving}
                      onChange={(event) =>
                        update(
                          "liveRaceLockMinutesBeforePost",
                          Number(event.target.value),
                        )
                      }
                    />
                  </label>
                </div>

                <div className="ghs-eyebrow" style={{ marginTop: 16 }}>
                  MANDATORY RACE ACTION
                </div>

                <div className="ghs-segment-grid">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => update("liveMandatoryRaceAction", false)}
                    className={`ghs-segment${
                      !settings.liveMandatoryRaceAction ? " active" : ""
                    }`}
                  >
                    Optional
                  </button>

                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => update("liveMandatoryRaceAction", true)}
                    className={`ghs-segment${
                      settings.liveMandatoryRaceAction ? " active" : ""
                    }`}
                  >
                    Required
                  </button>
                </div>

                {!settings.liveMandatoryRaceAction ? (
                  <div className="ghs-rule">
                    <strong>Optional:</strong> members may skip a race. No minimum
                    wager and no automatic wager is required.
                  </div>
                ) : (
                  <>
                    <div className="ghs-fields">
                      <label className="ghs-field">
                        Minimum Bankroll Action (%)
                        <input
                          className="ghs-input"
                          type="number"
                          inputMode="decimal"
                          min={0.01}
                          max={100}
                          step={0.01}
                          value={settings.liveMinimumWagerPercent}
                          disabled={saving}
                          onChange={(event) =>
                            update(
                              "liveMinimumWagerPercent",
                              Number(event.target.value),
                            )
                          }
                        />
                      </label>
                    </div>

                    <button
                      type="button"
                      disabled={saving}
                      onClick={() =>
                        update(
                          "liveAutoWagerEnabled",
                          !settings.liveAutoWagerEnabled,
                        )
                      }
                      className={`ghs-toggle${
                        settings.liveAutoWagerEnabled ? " active" : ""
                      }`}
                      style={{ marginTop: 12, width: "100%" }}
                    >
                      <strong>Auto-Wager Shortfall</strong>
                      <span>
                        {settings.liveAutoWagerEnabled ? "Enabled" : "Disabled"} ·
                        At race lock, any remaining required amount is placed as a
                        Win wager on the member&apos;s selected Auto-Wager dog. If
                        none was selected, G365 uses the lowest-numbered active box.
                      </span>
                    </button>

                    <div className="ghs-rule">
                      <strong>Fixed requirement:</strong> the minimum is calculated
                      from the bankroll available when that race opens. For example,
                      a $742.00 opening bankroll at 10% requires $74.20 of action,
                      even after the member begins placing wagers.
                    </div>
                  </>
                )}
              </>
            )}
          </section>

          <section className="ghs-section">
            <div className="ghs-eyebrow">SCRATCHES</div>
            <h2>Scratch Check</h2>
            <p className="ghs-help">
              Set how early the automated scratch check begins before first post.
            </p>

            <div className="ghs-fields">
              <label className="ghs-field">
                Scratch Check Minutes
                <input
                  className="ghs-input"
                  type="number"
                  min={0}
                  max={1440}
                  step={1}
                  value={settings.scratchCheckMinutesBeforeFirstPost}
                  disabled={saving}
                  onChange={(event) =>
                    update(
                      "scratchCheckMinutesBeforeFirstPost",
                      Number(event.target.value),
                    )
                  }
                />
              </label>

              <label className="ghs-field">
                Racing Time Zone
                <select
                  className="ghs-select"
                  value={settings.entryPullTimezone}
                  disabled={saving}
                  onChange={(event) =>
                    update("entryPullTimezone", event.target.value)
                  }
                >
                  <option value="America/New_York">America/New_York</option>
                  <option value="America/Chicago">America/Chicago</option>
                  <option value="America/Denver">America/Denver</option>
                  <option value="America/Los_Angeles">America/Los_Angeles</option>
                </select>
              </label>
            </div>
          </section>
        </div>

        {message ? (
          <div className={`ghs-message ${isError ? "bad" : "good"}`}>
            {message}
          </div>
        ) : null}

        <div className="ghs-action-row" style={{ marginTop: 12 }}>
          <button
            type="button"
            className="ghs-save"
            disabled={saving}
            onClick={saveSettings}
          >
            {saving ? "Saving..." : "Save Greyhound Settings"}
          </button>

          <button
            type="button"
            className="ghs-secondary"
            disabled={saving}
            onClick={() =>
              router.push(`/league/${leagueId}/greyhound/commissioner/race-cards`)
            }
          >
            Race Cards
          </button>
        </div>
      </div>
    </main>
  );
}