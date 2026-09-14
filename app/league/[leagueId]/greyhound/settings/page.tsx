import Link from "next/link";
import { redirect } from "next/navigation";

import { requireLeagueMember } from "@/lib/leagues/requireLeagueMember";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type PageProps = {
  params: Promise<{
    leagueId: string;
  }>;
};

type SettingsRow = {
  game_format: string | null;
  team_setup_mode: string | null;
  survivor_mode: string | null;
  duration_mode: string | null;
  competition_start_date: string | null;
  competition_end_date: string | null;
  competition_weeks: number | null;
  competition_days: number[] | null;
  starting_bankroll: number | string | null;
  card_lock_minutes_before_first_post: number | null;
  scratch_check_minutes_before_first_post: number | null;
  race_scratch_check_minutes_before_post: number | null;
  results_poll_minutes: number | null;
  entry_pull_timezone: string | null;
  allow_win: boolean | null;
  allow_place: boolean | null;
  allow_show: boolean | null;
  allow_exacta: boolean | null;
  allow_quinella: boolean | null;
  allow_trifecta: boolean | null;
  allow_superfecta: boolean | null;
};

const GAME_FORMAT_LABELS: Record<string, string> = {
  team_total_winnings: "Team Season — Total Winnings",
  team_head_to_head: "Team Season — Head-to-Head",
  bankroll: "Bankroll Challenge",
  survivor: "Survivor",
  tournament: "Tournament",
};

const DURATION_LABELS: Record<string, string> = {
  single_day: "Single Day",
  date_range: "Date Range",
  weeks: "Weeks",
  rounds: "Rounds",
};

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function money(value: unknown) {
  const number = Number(value ?? 0);

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(number) ? number : 0);
}

function pretty(value: string | null | undefined) {
  if (!value) return "—";

  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default async function GreyhoundSettingsPage({
  params,
}: PageProps) {
  const { leagueId } = await params;
  const access = await requireLeagueMember(leagueId);

  if (String(access.league.leagueType) !== "greyhound") {
    redirect(`/league/${leagueId}`);
  }

  const admin = createSupabaseAdminClient();

  const { data, error } = await admin
    .from("greyhound_league_settings")
    .select(
      [
        "game_format",
        "team_setup_mode",
        "survivor_mode",
        "duration_mode",
        "competition_start_date",
        "competition_end_date",
        "competition_weeks",
        "competition_days",
        "starting_bankroll",
        "card_lock_minutes_before_first_post",
        "scratch_check_minutes_before_first_post",
        "race_scratch_check_minutes_before_post",
        "results_poll_minutes",
        "entry_pull_timezone",
        "allow_win",
        "allow_place",
        "allow_show",
        "allow_exacta",
        "allow_quinella",
        "allow_trifecta",
        "allow_superfecta",
      ].join(", "),
    )
    .eq("league_id", leagueId)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Unable to load Greyhound league settings: ${error.message}`,
    );
  }

  const settings = (data ?? null) as SettingsRow | null;

  const competitionDays =
    Array.isArray(settings?.competition_days) &&
    settings.competition_days.length > 0
      ? settings.competition_days
          .map(Number)
          .filter(
            (day) =>
              Number.isInteger(day) &&
              day >= 0 &&
              day <= 6,
          )
      : [0, 1, 2, 3, 4, 5, 6];

  const allowedWagers = [
    ["Win", settings?.allow_win],
    ["Place", settings?.allow_place],
    ["Show", settings?.allow_show],
    ["Exacta", settings?.allow_exacta],
    ["Quinella", settings?.allow_quinella],
    ["Trifecta", settings?.allow_trifecta],
    ["Superfecta", settings?.allow_superfecta],
  ].filter(([, allowed]) => allowed !== false);

  const isTeamGame =
    settings?.game_format === "team_total_winnings" ||
    settings?.game_format === "team_head_to_head";

  return (
    <main className="gh-settings-page">
      <style>{`
        .gh-settings-page {
          min-height: 100vh;
          padding: 18px 14px 72px;
          background:
            radial-gradient(circle at top left, rgba(143,23,19,.16), transparent 32%),
            linear-gradient(180deg, #07080a, #0c0d0f 48%, #07080a);
          color: #fff;
        }

        .gh-settings-shell {
          width: min(1320px, 100%);
          margin: 0 auto;
        }

        .gh-settings-hero {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          align-items: center;
          gap: 18px;
          padding: 24px;
          border: 1px solid rgba(242,107,34,.30);
          border-radius: 18px;
          background:
            linear-gradient(135deg, rgba(143,23,19,.34), rgba(231,98,39,.07) 50%, #101113);
          box-shadow: 0 22px 60px rgba(0,0,0,.28);
        }

        .gh-settings-kicker,
        .gh-card-kicker {
          color: #ff6b22;
          font-size: 10px;
          font-weight: 950;
          letter-spacing: .12em;
          text-transform: uppercase;
        }

        .gh-settings-title {
          margin: 7px 0 8px;
          font-size: clamp(30px, 4vw, 46px);
          line-height: 1;
          letter-spacing: -.035em;
          font-weight: 950;
        }

        .gh-settings-subtitle {
          max-width: 820px;
          margin: 0;
          color: #a4a8ae;
          font-size: 13px;
          line-height: 1.6;
        }

        .gh-settings-manage,
        .gh-settings-open {
          display: inline-flex;
          min-height: 42px;
          align-items: center;
          justify-content: center;
          padding: 0 16px;
          border-radius: 10px;
          text-decoration: none;
          font-size: 11px;
          font-weight: 950;
          white-space: nowrap;
        }

        .gh-settings-manage {
          border: 1px solid rgba(255,122,26,.35);
          background: linear-gradient(90deg,#8f1713,#e76227);
          color: #fff;
        }

        .gh-settings-summary {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
          margin-top: 14px;
        }

        .gh-summary-card {
          min-width: 0;
          padding: 16px;
          border: 1px solid #2b2d31;
          border-radius: 14px;
          background: #101113;
        }

        .gh-summary-label {
          display: block;
          color: #7e838b;
          font-size: 9px;
          font-weight: 950;
          letter-spacing: .09em;
          text-transform: uppercase;
        }

        .gh-summary-value {
          display: block;
          margin-top: 7px;
          color: #fff;
          font-size: 17px;
          line-height: 1.18;
          word-break: normal;
          overflow-wrap: anywhere;
        }

        .gh-summary-detail {
          display: block;
          margin-top: 7px;
          color: #8f949b;
          font-size: 10px;
          line-height: 1.4;
        }

        .gh-settings-content {
          display: grid;
          grid-template-columns: minmax(0, 1.25fr) minmax(0, .9fr);
          gap: 12px;
          margin-top: 12px;
        }

        .gh-card {
          min-width: 0;
          padding: 18px;
          border: 1px solid #2b2d31;
          border-radius: 16px;
          background: linear-gradient(180deg,#121315,#0d0e10);
        }

        .gh-card-title {
          margin: 6px 0 14px;
          font-size: 19px;
          line-height: 1.2;
        }

        .gh-schedule-card {
          grid-row: span 2;
        }

        .gh-day-grid {
          display: grid;
          grid-template-columns: repeat(7, minmax(52px, 1fr));
          gap: 7px;
          overflow-x: auto;
          padding-bottom: 3px;
        }

        .gh-day-pill {
          display: flex;
          min-height: 38px;
          align-items: center;
          justify-content: center;
          border-radius: 9px;
          font-size: 10px;
          font-weight: 950;
        }

        .gh-day-pill.active {
          border: 1px solid rgba(242,107,34,.55);
          background: linear-gradient(135deg,rgba(143,23,19,.78),rgba(231,98,39,.52));
          color: #fff;
        }

        .gh-day-pill.inactive {
          border: 1px solid #292b2f;
          background: #0b0c0e;
          color: #555a61;
        }

        .gh-info-rows {
          display: grid;
          gap: 8px;
          margin-top: 16px;
        }

        .gh-info-row {
          display: grid;
          grid-template-columns: minmax(125px, .8fr) minmax(0, 1.2fr);
          align-items: center;
          gap: 12px;
          min-height: 40px;
          padding: 8px 11px;
          border: 1px solid #25272b;
          border-radius: 9px;
          background: #0a0b0d;
        }

        .gh-info-row span {
          color: #888d95;
          font-size: 10px;
          font-weight: 800;
        }

        .gh-info-row strong {
          color: #fff;
          font-size: 10px;
          text-align: right;
          overflow-wrap: anywhere;
        }

        .gh-wager-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
        }

        .gh-wager-pill {
          display: flex;
          min-height: 38px;
          align-items: center;
          justify-content: center;
          padding: 0 10px;
          border: 1px solid rgba(242,107,34,.35);
          border-radius: 10px;
          background: rgba(231,98,39,.08);
          color: #ff9b67;
          font-size: 10px;
          font-weight: 900;
          text-align: center;
        }

        .gh-note {
          margin: 14px 0 0;
          color: #838890;
          font-size: 10px;
          line-height: 1.55;
        }

        .gh-footer-card {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          margin-top: 12px;
          padding: 17px;
          border: 1px solid #2b2d31;
          border-radius: 14px;
          background: #0f1012;
        }

        .gh-footer-title {
          display: block;
          margin-top: 5px;
          font-size: 12px;
          line-height: 1.45;
        }

        .gh-settings-open {
          border: 1px solid rgba(242,107,34,.38);
          background: #151618;
          color: #fff;
        }

        .gh-empty {
          margin-top: 14px;
          padding: 18px;
          border: 1px solid #2b2d31;
          border-radius: 14px;
          background: #101113;
          color: #a4a8ae;
        }

        @media (max-width: 1050px) {
          .gh-settings-summary {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .gh-settings-content {
            grid-template-columns: 1fr;
          }

          .gh-schedule-card {
            grid-row: auto;
          }
        }

        @media (max-width: 720px) {
          .gh-settings-page {
            padding: 12px 10px 64px;
          }

          .gh-settings-hero {
            grid-template-columns: 1fr;
            padding: 18px;
          }

          .gh-settings-manage {
            width: 100%;
          }

          .gh-settings-summary {
            grid-template-columns: 1fr 1fr;
            gap: 8px;
          }

          .gh-summary-card,
          .gh-card {
            padding: 14px;
          }

          .gh-summary-value {
            font-size: 15px;
          }

          .gh-day-grid {
            grid-template-columns: repeat(7, 52px);
          }

          .gh-info-row {
            grid-template-columns: 1fr;
            gap: 4px;
          }

          .gh-info-row strong {
            text-align: left;
          }

          .gh-footer-card,
          .gh-settings-open {
            width: 100%;
          }
        }

        @media (max-width: 440px) {
          .gh-settings-summary {
            grid-template-columns: 1fr;
          }

          .gh-wager-grid {
            grid-template-columns: 1fr 1fr;
          }
        }
      `}</style>

      <div className="gh-settings-shell">
        <section className="gh-settings-hero">
          <div>
            <div className="gh-settings-kicker">
              G365 Greyhound Racing
            </div>

            <h1 className="gh-settings-title">
              League Settings
            </h1>

            <p className="gh-settings-subtitle">
              {access.league.name} · View the competition rules,
              wager menu, bankroll, schedule, and race operations
              currently active for this league.
            </p>
          </div>

          {access.isCommissioner ? (
            <Link
              href={`/league/${leagueId}/commissioner`}
              className="gh-settings-manage"
            >
              Commissioner Controls
            </Link>
          ) : null}
        </section>

        {!settings ? (
          <section className="gh-empty">
            Greyhound league settings have not been configured yet.
          </section>
        ) : (
          <>
            <section className="gh-settings-summary">
              <SettingCard
                label="Game Format"
                value={
                  GAME_FORMAT_LABELS[
                    settings.game_format ?? ""
                  ] ?? pretty(settings.game_format)
                }
                detail={
                  settings.game_format === "survivor"
                    ? `Survivor Mode: ${pretty(settings.survivor_mode)}`
                    : isTeamGame
                      ? `Team Setup: ${pretty(settings.team_setup_mode)}`
                      : "Individual competition"
                }
              />

              <SettingCard
                label="Starting Bankroll"
                value={money(settings.starting_bankroll)}
                detail="Per Greyhound participant"
              />

              <SettingCard
                label="Competition Duration"
                value={
                  DURATION_LABELS[
                    settings.duration_mode ?? ""
                  ] ?? pretty(settings.duration_mode)
                }
                detail={
                  settings.duration_mode === "weeks"
                    ? `${Number(settings.competition_weeks ?? 0)} week${
                        Number(settings.competition_weeks ?? 0) === 1
                          ? ""
                          : "s"
                      }`
                    : settings.competition_start_date
                      ? `Starts ${settings.competition_start_date}`
                      : "Schedule pending"
                }
              />

              <SettingCard
                label="Card Lock"
                value={`${Number(
                  settings.card_lock_minutes_before_first_post ?? 5,
                )} MIN`}
                detail="Before Race 1 · whole card"
              />
            </section>

            <section className="gh-settings-content">
              <article className="gh-card gh-schedule-card">
                <div className="gh-card-kicker">
                  Competition Schedule
                </div>

                <h2 className="gh-card-title">
                  Eligible Racing Days
                </h2>

                <div className="gh-day-grid">
                  {DAY_LABELS.map((label, day) => {
                    const enabled = competitionDays.includes(day);

                    return (
                      <span
                        key={label}
                        className={`gh-day-pill ${
                          enabled ? "active" : "inactive"
                        }`}
                      >
                        {label}
                      </span>
                    );
                  })}
                </div>

                <div className="gh-info-rows">
                  <InfoRow
                    label="Start"
                    value={
                      settings.competition_start_date ?? "—"
                    }
                  />
                  <InfoRow
                    label="End"
                    value={
                      settings.competition_end_date ?? "—"
                    }
                  />
                  <InfoRow
                    label="Racing Time Zone"
                    value={
                      settings.entry_pull_timezone ??
                      "America/New_York"
                    }
                  />
                </div>
              </article>

              <article className="gh-card">
                <div className="gh-card-kicker">
                  Wager Menu
                </div>

                <h2 className="gh-card-title">
                  Allowed Wagers
                </h2>

                <div className="gh-wager-grid">
                  {allowedWagers.map(([label]) => (
                    <span
                      key={String(label)}
                      className="gh-wager-pill"
                    >
                      {label}
                    </span>
                  ))}
                </div>

                <p className="gh-note">
                  Scratch alternates are optional when you build a
                  monetary ticket. Alternate 1 is attempted before
                  Alternate 2.
                </p>
              </article>

              <article className="gh-card">
                <div className="gh-card-kicker">
                  Race Operations
                </div>

                <h2 className="gh-card-title">
                  Automated Timing
                </h2>

                <div className="gh-info-rows">
                  <InfoRow
                    label="Card Scratch Check"
                    value={`${Number(
                      settings.scratch_check_minutes_before_first_post ?? 0,
                    )} min before Race 1`}
                  />
                  <InfoRow
                    label="Race Scratch Check"
                    value={`${Number(
                      settings.race_scratch_check_minutes_before_post ?? 0,
                    )} min before post`}
                  />
                  <InfoRow
                    label="Results Poll"
                    value={`${Number(
                      settings.results_poll_minutes ?? 0,
                    )} min`}
                  />
                </div>
              </article>
            </section>

            <section className="gh-footer-card">
              <div>
                <div className="gh-card-kicker">
                  Settings Access
                </div>

                <strong className="gh-footer-title">
                  {access.isCommissioner
                    ? "Commissioner controls are available from the Commissioner tab."
                    : "League settings are controlled by the commissioner."}
                </strong>
              </div>

              <Link
                href={`/league/${leagueId}/greyhound/wagers`}
                className="gh-settings-open"
              >
                Open My Wagers
              </Link>
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function SettingCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article className="gh-summary-card">
      <span className="gh-summary-label">
        {label}
      </span>

      <strong className="gh-summary-value">
        {value}
      </strong>

      <small className="gh-summary-detail">
        {detail}
      </small>
    </article>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="gh-info-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
