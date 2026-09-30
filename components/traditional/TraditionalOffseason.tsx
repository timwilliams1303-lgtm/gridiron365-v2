"use server";

import Link from "next/link";
import { revalidatePath } from "next/cache";

import Card from "@/components/ui/Card";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Props = {
  leagueId: string;
  season: number;
  isCommissioner: boolean;
};

type SettingsRow = {
  league_format: string | null;
  dynasty_protected_players: number | null;
  dynasty_future_pick_years: number | null;
  dynasty_annual_draft_rounds: number | null;
  dynasty_draft_order_method: string | null;
  dynasty_protection_status: string | null;
  dynasty_protection_deadline: string | null;
};

type SeasonStateRow = {
  season: number | null;
  phase: string | null;
  season_complete: boolean | null;
};

type DraftRow = {
  id: string;
  season: number | null;
  draft_type: string | null;
  status: string | null;
  rounds: number | null;
};

type JsonObject = Record<string, unknown>;

function normalize(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function pretty(value: unknown) {
  const text = normalize(value);
  if (!text) return "Not Started";

  return text
    .replaceAll("_", " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function asObject(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
}

function boolFrom(value: unknown, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (value.toLowerCase() === "true") return true;
    if (value.toLowerCase() === "false") return false;
  }
  return fallback;
}

function numberFrom(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
}

export default async function TraditionalOffseason({
  leagueId,
  season,
  isCommissioner,
}: Props) {
  const supabase = await createSupabaseServerClient();
  const targetSeason = season + 1;

  const [
    settingsResult,
    seasonStateResult,
    draftResult,
    teamResult,
    keeperReadinessResult,
    rolloverReadinessResult,
  ] = await Promise.all([
    supabase
      .from("traditional_league_settings")
      .select(
        "league_format,dynasty_protected_players,dynasty_future_pick_years,dynasty_annual_draft_rounds,dynasty_draft_order_method,dynasty_protection_status,dynasty_protection_deadline"
      )
      .eq("league_id", leagueId)
      .eq("season", season)
      .maybeSingle(),

    supabase
      .from("traditional_season_state")
      .select("season,phase,season_complete")
      .eq("league_id", leagueId)
      .eq("season", season)
      .maybeSingle(),

    supabase
      .from("league_drafts")
      .select("id,season,draft_type,status,rounds")
      .eq("league_id", leagueId)
      .eq("season", targetSeason)
      .eq("draft_type", "dynasty")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),

    supabase
      .from("fantasy_teams")
      .select("id")
      .eq("league_id", leagueId)
      .eq("active", true),

    supabase.rpc("get_traditional_dynasty_protection_readiness", {
      p_league_id: leagueId,
      p_target_season: targetSeason,
    }),

    supabase.rpc("get_traditional_rollover_readiness", {
      p_league_id: leagueId,
    }),
  ]);

  if (settingsResult.error) {
    throw new Error(
      `Unable to load NFL Dynasty settings: ${settingsResult.error.message}`
    );
  }

  if (seasonStateResult.error) {
    throw new Error(
      `Unable to load NFL season state: ${seasonStateResult.error.message}`
    );
  }

  if (draftResult.error) {
    throw new Error(
      `Unable to load ${targetSeason} annual draft: ${draftResult.error.message}`
    );
  }

  if (teamResult.error) {
    throw new Error(
      `Unable to load active NFL Dynasty teams: ${teamResult.error.message}`
    );
  }

  const settings = settingsResult.data as SettingsRow | null;
  const seasonState = seasonStateResult.data as SeasonStateRow | null;
  const annualDraft = draftResult.data as DraftRow | null;

  if (!settings || normalize(settings.league_format) !== "dynasty") {
    return (
      <main className="g365-offseason-page">
        <style>{styles}</style>
        <section className="g365-offseason-shell">
          <div className="g365-message error">
            NFL Dynasty offseason controls are only available for Dynasty leagues.
          </div>
          <Link className="g365-button secondary" href={`/league/${leagueId}`}>
            BACK TO LEAGUE
          </Link>
        </section>
      </main>
    );
  }

  const seasonComplete = Boolean(seasonState?.season_complete);
  const keeperCount = Math.max(
    0,
    Number(settings.dynasty_protected_players ?? 0)
  );
  const futurePickYears = Math.max(
    0,
    Number(settings.dynasty_future_pick_years ?? 0)
  );
  const annualRounds = Math.max(
    0,
    Number(settings.dynasty_annual_draft_rounds ?? 0)
  );
  const activeTeams = teamResult.data?.length ?? 0;
  const annualPickCount = activeTeams * annualRounds;
  const futureAssetCount = annualPickCount * futurePickYears;

  const protectionStatus = normalize(settings.dynasty_protection_status);
  const protectionDeadline = formatDateTime(
    settings.dynasty_protection_deadline
  );
  const protectionLocked = [
    "protection_locked",
    "locked",
    "finalized",
    "complete",
    "completed",
  ].includes(protectionStatus);

  const keeperReadiness = keeperReadinessResult.error
    ? {}
    : asObject(keeperReadinessResult.data);

  const rolloverReadiness = rolloverReadinessResult.error
    ? {}
    : asObject(rolloverReadinessResult.data);

  const keeperReady =
    boolFrom(keeperReadiness.ready) ||
    boolFrom(keeperReadiness.allTeamsSubmitted) ||
    boolFrom(keeperReadiness.submissionsComplete) ||
    protectionLocked;

  const keepersFinalized =
    boolFrom(rolloverReadiness.dynasty_keeper_finalized) ||
    boolFrom(rolloverReadiness.dynastyKeeperFinalized);

  const draftStatus = normalize(annualDraft?.status);
  const draftPrepared = Boolean(annualDraft);
  const draftComplete = draftStatus === "completed";

  const orderMethod =
    normalize(settings.dynasty_draft_order_method) === "reverse_standings"
      ? "reverse_standings"
      : "lottery";

  const orderLabel =
    orderMethod === "reverse_standings"
      ? "Reverse Standings"
      : "Draft Lottery";

  const rosterIntegrityReady =
    boolFrom(rolloverReadiness.dynasty_roster_integrity_ready) ||
    boolFrom(rolloverReadiness.dynastyRosterIntegrityReady);

  const rolloverReady = boolFrom(rolloverReadiness.ready);
  const rolloverReason = String(
    rolloverReadiness.reason ?? "Complete every offseason step before rollover."
  );

  async function prepareAnnualDraft() {
    "use server";

    const actionSupabase = await createSupabaseServerClient();

    const result = await actionSupabase.rpc(
      "ensure_traditional_dynasty_annual_draft",
      {
        p_league_id: leagueId,
        p_draft_season: targetSeason,
      }
    );

    if (result.error) {
      throw new Error(result.error.message);
    }

    revalidatePath(`/league/${leagueId}/offseason`);
    revalidatePath(`/league/${leagueId}/draft`);
  }

  async function applyReverseStandings() {
    "use server";

    const actionSupabase = await createSupabaseServerClient();

    const result = await actionSupabase.rpc(
      "apply_traditional_dynasty_reverse_standings_order",
      {
        p_league_id: leagueId,
        p_draft_season: targetSeason,
      }
    );

    if (result.error) {
      throw new Error(result.error.message);
    }

    revalidatePath(`/league/${leagueId}/offseason`);
    revalidatePath(`/league/${leagueId}/draft`);
  }

  const steps = [
    {
      number: "1",
      title: "Protected Players",
      status: keepersFinalized
        ? "Finalized"
        : protectionLocked
          ? "Locked"
          : pretty(settings.dynasty_protection_status),
      complete: keepersFinalized,
      active: seasonComplete && !keepersFinalized,
      description: `${keeperCount} players per team carry into ${targetSeason}. Owners make their selections before the commissioner finalizes the protection period.`,
      href: `/league/${leagueId}/keepers`,
      button: "OPEN KEEPERS",
    },
    {
      number: "2",
      title: "Annual Draft",
      status: draftPrepared ? pretty(annualDraft?.status) : "Not Prepared",
      complete: draftPrepared,
      active: seasonComplete && keepersFinalized && !draftPrepared,
      description: `${annualRounds} rounds • ${annualPickCount} total ${targetSeason} picks • future-pick ownership remains attached after trades.`,
      href: `/league/${leagueId}/draft`,
      button: draftPrepared ? "OPEN DRAFT" : "DRAFT NOT PREPARED",
    },
    {
      number: "3",
      title: orderLabel,
      status:
        orderMethod === "lottery"
          ? draftPrepared
            ? "Available"
            : "Waiting for Draft"
          : draftPrepared
            ? "Ready to Apply"
            : "Waiting for Draft",
      complete:
        numberFrom(
          rolloverReadiness.dynasty_wrong_draft_asset_count,
          annualPickCount
        ) === 0 && draftPrepared,
      active: seasonComplete && draftPrepared && !draftComplete,
      description:
        orderMethod === "lottery"
          ? "Run the official weighted NFL Dynasty lottery and reveal the order one pick at a time."
          : "Set the annual draft order from the previous season's final standings, worst finish to best.",
      href:
        orderMethod === "lottery"
          ? `/league/${leagueId}/draft-lottery`
          : `/league/${leagueId}/offseason`,
      button:
        orderMethod === "lottery" ? "OPEN LOTTERY" : "REVERSE STANDINGS",
    },
    {
      number: "4",
      title: "Draft & Roster Integrity",
      status: draftComplete
        ? rosterIntegrityReady
          ? "Passed"
          : "Check Required"
        : pretty(annualDraft?.status),
      complete: draftComplete && rosterIntegrityReady,
      active: seasonComplete && draftPrepared,
      description:
        "Complete the annual draft. After the final pick, G365 verifies that every Dynasty roster is valid before rollover.",
      href: `/league/${leagueId}/draft`,
      button: "OPEN DRAFT ROOM",
    },
    {
      number: "5",
      title: `${targetSeason} New Season`,
      status: rolloverReady ? "Ready" : "Locked",
      complete: rolloverReady,
      active: rolloverReady,
      description: rolloverReady
        ? `Every required check has passed. The ${targetSeason} NFL Dynasty season can be prepared and activated.`
        : rolloverReason,
      href: `/league/${leagueId}/new-season`,
      button: rolloverReady ? "OPEN NEW SEASON" : "VIEW READINESS",
    },
  ];

  return (
    <main className="g365-offseason-page">
      <style>{styles}</style>

      <section className="g365-offseason-shell">
        <header className="g365-offseason-hero">
          <div>
            <p className="g365-eyebrow">GRIDIRON365 • NFL DYNASTY</p>
            <h1>Dynasty Offseason</h1>
            <p className="g365-subtitle">
              Move the league from the completed {season} season into the{" "}
              {targetSeason} season without skipping keeper, draft-order,
              annual-draft or roster-integrity requirements.
            </p>
          </div>

          <div className="g365-season-box">
            <span>CURRENT SEASON</span>
            <strong>{season}</strong>
            <small>{pretty(seasonState?.phase)}</small>
          </div>
        </header>

        {!seasonComplete ? (
          <section className="g365-locked">
            <div className="g365-lock-icon">🔒</div>
            <div>
              <strong>OFFSEASON LOCKED DURING ACTIVE SEASON</strong>
              <p>
                The Dynasty offseason workflow becomes actionable only after
                the {season} NFL season is marked complete. Keeper count,
                future-pick years and draft-round settings remain available
                from Commissioner → Dynasty Settings during the season.
              </p>
            </div>
          </section>
        ) : (
          <div className="g365-live-pill">OFFSEASON ACTIVE</div>
        )}

        <section className="g365-stat-grid">
          <Card>
            <Stat label="KEEPERS / TEAM" value={keeperCount} />
          </Card>
          <Card>
            <Stat label="ACTIVE TEAMS" value={activeTeams} />
          </Card>
          <Card>
            <Stat label="ANNUAL ROUNDS" value={annualRounds} />
          </Card>
          <Card>
            <Stat label="PICKS / YEAR" value={annualPickCount} />
          </Card>
          <Card>
            <Stat label="FUTURE PICK YEARS" value={futurePickYears} />
          </Card>
          <Card>
            <Stat label="TRADABLE FUTURE ASSETS" value={futureAssetCount} />
          </Card>
        </section>

        <section className="g365-summary">
          <div>
            <span>PROTECTION STATUS</span>
            <strong>{pretty(settings.dynasty_protection_status)}</strong>
            <small>
              {protectionDeadline
                ? `Deadline: ${protectionDeadline}`
                : "No protection deadline currently displayed."}
            </small>
          </div>

          <div>
            <span>DRAFT ORDER METHOD</span>
            <strong>{orderLabel}</strong>
            <small>
              {orderMethod === "lottery"
                ? "Official weighted reveal."
                : "Previous-season finish determines the order."}
            </small>
          </div>

          <div>
            <span>{targetSeason} DRAFT</span>
            <strong>
              {draftPrepared ? pretty(annualDraft?.status) : "Not Prepared"}
            </strong>
            <small>
              {draftPrepared
                ? `${annualDraft?.rounds ?? annualRounds} rounds`
                : "Created after keeper finalization."}
            </small>
          </div>

          <div>
            <span>ROLLOVER</span>
            <strong>{rolloverReady ? "Ready" : "Not Ready"}</strong>
            <small>{rolloverReason}</small>
          </div>
        </section>

        <div className="g365-section-heading">
          <div>
            <p className="g365-eyebrow">OFFSEASON WORKFLOW</p>
            <h2>{season} → {targetSeason}</h2>
          </div>
          <span className="g365-step-note">
            Complete the steps in order
          </span>
        </div>

        <section
          className={`g365-workflow ${!seasonComplete ? "disabled" : ""}`}
        >
          {steps.map((step) => (
            <article
              className={[
                "g365-workflow-card",
                step.complete ? "complete" : "",
                step.active ? "active" : "",
              ].join(" ")}
              key={step.number}
            >
              <div className="g365-card-top">
                <span className="g365-step">{step.number}</span>
                <span
                  className={`g365-status ${
                    step.complete ? "complete" : ""
                  }`}
                >
                  {step.status}
                </span>
              </div>

              <h3>{step.title}</h3>
              <p>{step.description}</p>

              {seasonComplete ? (
                step.number === "2" &&
                !draftPrepared &&
                isCommissioner &&
                keepersFinalized ? (
                  <form action={prepareAnnualDraft}>
                    <button className="g365-button primary" type="submit">
                      PREPARE {targetSeason} DRAFT
                    </button>
                  </form>
                ) : step.number === "3" &&
                  orderMethod === "reverse_standings" &&
                  draftPrepared &&
                  isCommissioner ? (
                  <form action={applyReverseStandings}>
                    <button className="g365-button primary" type="submit">
                      APPLY REVERSE STANDINGS
                    </button>
                  </form>
                ) : (
                  <Link className="g365-button secondary" href={step.href}>
                    {step.button}
                  </Link>
                )
              ) : (
                <span className="g365-button locked-button">LOCKED</span>
              )}
            </article>
          ))}
        </section>

        {seasonComplete && isCommissioner ? (
          <section className="g365-commissioner">
            <div>
              <p className="g365-eyebrow">COMMISSIONER</p>
              <h2>Offseason Control</h2>
              <p>
                Use the dedicated pages for keeper management, lottery,
                annual draft and rollover. The database readiness gates remain
                authoritative even if a page is refreshed or opened directly.
              </p>
            </div>

            <div className="g365-actions">
              <Link className="g365-button secondary" href={`/league/${leagueId}/keepers`}>
                KEEPERS
              </Link>

              {orderMethod === "lottery" ? (
                <Link
                  className="g365-button secondary"
                  href={`/league/${leagueId}/draft-lottery`}
                >
                  DRAFT LOTTERY
                </Link>
              ) : null}

              <Link className="g365-button secondary" href={`/league/${leagueId}/draft`}>
                ANNUAL DRAFT
              </Link>

              <Link className="g365-button primary" href={`/league/${leagueId}/new-season`}>
                NEW SEASON
              </Link>
            </div>
          </section>
        ) : null}

        <footer className="g365-footer-actions">
          <Link className="g365-button secondary" href={`/league/${leagueId}`}>
            BACK TO LEAGUE
          </Link>

          {isCommissioner ? (
            <Link
              className="g365-button secondary"
              href={`/league/${leagueId}/commissioner`}
            >
              COMMISSIONER
            </Link>
          ) : null}
        </footer>
      </section>
    </main>
  );
}

function Stat(props: { label: string; value: string | number }) {
  return (
    <div className="g365-stat">
      <span>{props.label}</span>
      <strong>{props.value}</strong>
    </div>
  );
}

const styles = `
  .g365-offseason-page {
    min-height: 100vh;
    padding: 24px 16px 60px;
    color: #f7f7f8;
    background:
      radial-gradient(circle at top right, rgba(255, 76, 20, .10), transparent 30%),
      linear-gradient(180deg, #0a0c10 0%, #07090c 100%);
  }

  .g365-offseason-shell {
    width: min(1280px, 100%);
    margin: 0 auto;
  }

  .g365-offseason-hero {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 24px;
    padding: 24px;
    border: 1px solid rgba(255, 91, 31, .20);
    border-radius: 16px;
    background:
      linear-gradient(135deg, rgba(125, 18, 12, .18), rgba(255, 83, 25, .04)),
      #0d1015;
  }

  .g365-eyebrow {
    margin: 0 0 6px;
    color: #ff6429;
    font-size: 10px;
    font-weight: 950;
    letter-spacing: .13em;
  }

  .g365-offseason-hero h1,
  .g365-section-heading h2,
  .g365-commissioner h2 {
    margin: 0;
    font-weight: 950;
    letter-spacing: -.025em;
  }

  .g365-offseason-hero h1 {
    font-size: clamp(30px, 5vw, 50px);
  }

  .g365-subtitle {
    max-width: 760px;
    margin: 10px 0 0;
    color: #a8afb9;
    line-height: 1.65;
  }

  .g365-season-box {
    min-width: 155px;
    padding: 14px;
    border: 1px solid rgba(255,255,255,.08);
    border-radius: 12px;
    background: rgba(0,0,0,.25);
  }

  .g365-season-box span,
  .g365-season-box small,
  .g365-stat span,
  .g365-summary span {
    display: block;
    color: #8f97a3;
    font-size: 9px;
    font-weight: 900;
    letter-spacing: .08em;
  }

  .g365-season-box strong {
    display: block;
    margin: 5px 0;
    font-size: 28px;
  }

  .g365-locked {
    display: flex;
    gap: 14px;
    margin-top: 16px;
    padding: 16px;
    border: 1px solid rgba(255, 93, 31, .45);
    border-radius: 12px;
    background: rgba(93, 20, 12, .20);
  }

  .g365-lock-icon {
    font-size: 24px;
  }

  .g365-locked strong {
    color: #ff9b72;
    font-size: 11px;
    letter-spacing: .06em;
  }

  .g365-locked p {
    margin: 6px 0 0;
    color: #d2b6aa;
    font-size: 12px;
    line-height: 1.55;
  }

  .g365-live-pill {
    width: fit-content;
    margin-top: 16px;
    padding: 7px 10px;
    border: 1px solid rgba(34,197,94,.35);
    border-radius: 999px;
    color: #5ee27d;
    background: rgba(34,197,94,.08);
    font-size: 9px;
    font-weight: 950;
    letter-spacing: .08em;
  }

  .g365-stat-grid {
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: 10px;
    margin-top: 16px;
  }

  .g365-stat {
    min-height: 76px;
  }

  .g365-stat strong {
    display: block;
    margin-top: 9px;
    color: #fff;
    font-size: 22px;
  }

  .g365-summary {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 10px;
    margin-top: 16px;
  }

  .g365-summary > div {
    padding: 14px;
    border: 1px solid rgba(255,255,255,.08);
    border-radius: 12px;
    background: #0d1015;
  }

  .g365-summary strong {
    display: block;
    margin: 6px 0;
    font-size: 14px;
  }

  .g365-summary small {
    display: block;
    color: #8e96a1;
    line-height: 1.45;
  }

  .g365-section-heading {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: 16px;
    margin: 28px 0 12px;
  }

  .g365-step-note {
    color: #858d98;
    font-size: 10px;
    font-weight: 850;
  }

  .g365-workflow {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 12px;
  }

  .g365-workflow.disabled {
    opacity: .52;
  }

  .g365-workflow-card {
    min-width: 0;
    min-height: 245px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    border: 1px solid rgba(255,255,255,.08);
    border-radius: 13px;
    background: linear-gradient(180deg, rgba(24,25,29,.96), rgba(13,14,17,.98));
  }

  .g365-workflow-card.active {
    border-color: rgba(255, 102, 31, .48);
    box-shadow: 0 0 24px rgba(255, 83, 25, .05);
  }

  .g365-workflow-card.complete {
    border-color: rgba(34,197,94,.28);
  }

  .g365-card-top {
    display: flex;
    justify-content: space-between;
    gap: 10px;
  }

  .g365-step {
    width: 28px;
    height: 28px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    color: #fff;
    background: linear-gradient(135deg, #b51b18, #ef531d);
    font-size: 11px;
    font-weight: 950;
  }

  .g365-status {
    height: fit-content;
    padding: 5px 7px;
    border: 1px solid rgba(255,255,255,.08);
    border-radius: 999px;
    color: #aab1bb;
    background: rgba(255,255,255,.035);
    font-size: 8px;
    font-weight: 950;
    text-transform: uppercase;
    letter-spacing: .06em;
  }

  .g365-status.complete {
    color: #64dd83;
    border-color: rgba(34,197,94,.25);
  }

  .g365-workflow-card h3 {
    margin: 17px 0 8px;
    font-size: 17px;
  }

  .g365-workflow-card p {
    flex: 1;
    margin: 0 0 18px;
    color: #929aa6;
    font-size: 11px;
    line-height: 1.6;
  }

  .g365-button {
    min-height: 40px;
    padding: 10px 12px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid rgba(255,255,255,.10);
    border-radius: 9px;
    font-size: 10px;
    font-weight: 950;
    letter-spacing: .04em;
    text-decoration: none;
    cursor: pointer;
  }

  .g365-button.primary {
    color: #fff;
    border-color: rgba(255,91,31,.55);
    background: linear-gradient(135deg, #c52217, #ff5a1f);
  }

  .g365-button.secondary {
    color: #f4f6f8;
    background: #15181e;
  }

  .locked-button {
    color: #747b84;
    cursor: not-allowed;
  }

  .g365-commissioner {
    margin-top: 22px;
    padding: 18px;
    display: flex;
    justify-content: space-between;
    gap: 20px;
    border: 1px solid rgba(255, 95, 35, .24);
    border-radius: 14px;
    background: linear-gradient(135deg, rgba(120,18,12,.12), rgba(255,90,25,.025));
  }

  .g365-commissioner p {
    max-width: 720px;
    margin: 8px 0 0;
    color: #949ca7;
    line-height: 1.55;
  }

  .g365-actions,
  .g365-footer-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .g365-actions {
    justify-content: flex-end;
    align-content: flex-start;
  }

  .g365-footer-actions {
    margin-top: 22px;
  }

  .g365-message {
    margin-bottom: 16px;
    padding: 14px;
    border-radius: 10px;
  }

  .g365-message.error {
    color: #ffb3a0;
    border: 1px solid rgba(239,68,68,.35);
    background: rgba(127,29,29,.18);
  }

  @media (max-width: 1100px) {
    .g365-stat-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .g365-workflow {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .g365-summary {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 700px) {
    .g365-offseason-page {
      padding: 14px 10px 40px;
    }

    .g365-offseason-hero,
    .g365-commissioner {
      flex-direction: column;
    }

    .g365-season-box {
      width: 100%;
      box-sizing: border-box;
    }

    .g365-stat-grid,
    .g365-summary,
    .g365-workflow {
      grid-template-columns: 1fr;
    }

    .g365-workflow-card {
      min-height: 0;
    }

    .g365-actions {
      width: 100%;
      justify-content: stretch;
    }

    .g365-actions .g365-button,
    .g365-footer-actions .g365-button {
      flex: 1 1 150px;
    }
  }
`;
