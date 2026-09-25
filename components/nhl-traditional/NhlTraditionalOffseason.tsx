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
  dynasty_protection_status: string | null;
  dynasty_protection_deadline: string | null;
};

type DraftRow = {
  id: number;
  season: number | null;
  status: string | null;
};

function normalize(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function formatDateTime(
  value: string | null | undefined
) {
  if (!value) {
    return null;
  }

  const parsed =
    new Date(value);

  if (
    Number.isNaN(
      parsed.getTime()
    )
  ) {
    return null;
  }

  return new Intl.DateTimeFormat(
    "en-US",
    {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }
  ).format(parsed);
}

function statusLabel(
  value: string | null | undefined
) {
  const normalized =
    normalize(value);

  if (!normalized) {
    return "Not Started";
  }

  return normalized
    .replaceAll("_", " ")
    .split(" ")
    .filter(Boolean)
    .map(
      (part) =>
        part.charAt(0).toUpperCase() +
        part.slice(1)
    )
    .join(" ");
}

export default async function NhlTraditionalOffseason({
  leagueId,
  season,
  isCommissioner,
}: Props) {
  const supabase =
    await createSupabaseServerClient();

  /*
   * ============================================================
   * SETTINGS
   * ============================================================
   */
  const {
    data: settingsData,
    error: settingsError,
  } =
    await supabase
      .from(
        "nhl_traditional_settings"
      )
      .select(
        [
          "league_format",
          "dynasty_protected_players",
          "dynasty_protection_status",
          "dynasty_protection_deadline",
        ].join(",")
      )
      .eq(
        "league_id",
        leagueId
      )
      .maybeSingle();

  if (settingsError) {
    throw new Error(
      `Unable to load NHL offseason settings: ${settingsError.message}`
    );
  }

  const settings =
    settingsData as
      | SettingsRow
      | null;

  if (!settings) {
    throw new Error(
      "NHL Traditional league settings are missing."
    );
  }

  const leagueFormat =
    normalize(
      settings.league_format
    );

  const isDynasty =
    leagueFormat ===
    "dynasty";

  /*
   * ============================================================
   * DRAFT STATE
   * ============================================================
   *
   * Do not assume that the offseason draft has already been
   * created. The workspace must remain useful before, during,
   * and after draft preparation.
   */
  const {
    data: draftData,
    error: draftError,
  } =
    await supabase
      .from(
        "nhl_traditional_drafts"
      )
      .select(
        "id,season,status"
      )
      .eq(
        "league_id",
        leagueId
      )
      .order(
        "season",
        {
          ascending: false,
        }
      )
      .order(
        "id",
        {
          ascending: false,
        }
      )
      .limit(1)
      .maybeSingle();

  if (draftError) {
    throw new Error(
      `Unable to load NHL draft state: ${draftError.message}`
    );
  }

  const draft =
    draftData as
      | DraftRow
      | null;

  const draftStatus =
    normalize(
      draft?.status
    );

  const draftCompleted =
    draftStatus ===
    "completed";

  const draftExists =
    draft != null;

  /*
   * ============================================================
   * DYNASTY PROTECTION STATE
   * ============================================================
   */
  const keeperCount =
    Math.max(
      0,
      Number(
        settings
          .dynasty_protected_players ??
          0
      )
    );

  const protectionStatus =
    normalize(
      settings
        .dynasty_protection_status
    );

  const protectionDeadline =
    formatDateTime(
      settings
        .dynasty_protection_deadline
    );

  const keeperProtectionComplete =
    !isDynasty ||
    [
      "locked",
      "finalized",
      "complete",
      "completed",
    ].includes(
      protectionStatus
    );

  /*
   * ============================================================
   * ROUTES
   * ============================================================
   */
  const targetDraftSeason = season + 1;

  let annualDraftSettings: {
    rosterSize: number;
    keeperCount: number;
    draftRounds: number;
    teamCount: number;
    totalDraftPicks: number;
    secondsPerPick: number;
    draftOrderMethod: string;
    cpuAutoDraft: boolean;
  } | null = null;

  if (isDynasty) {
    const { data: annualSettingsData, error: annualSettingsError } =
      await supabase.rpc("get_nhl_dynasty_annual_draft_settings", {
        p_league_id: leagueId,
        p_draft_season: targetDraftSeason,
      });

    if (annualSettingsError) {
      throw new Error(
        `Unable to load annual Dynasty draft settings: ${annualSettingsError.message}`
      );
    }

    const row =
      annualSettingsData &&
      typeof annualSettingsData === "object" &&
      !Array.isArray(annualSettingsData)
        ? (annualSettingsData as Record<string, unknown>)
        : {};

    annualDraftSettings = {
      rosterSize: Number(row.rosterSize ?? 0),
      keeperCount: Number(row.keeperCount ?? keeperCount),
      draftRounds: Number(row.draftRounds ?? 0),
      teamCount: Number(row.teamCount ?? 0),
      totalDraftPicks: Number(row.totalDraftPicks ?? 0),
      secondsPerPick: Number(row.secondsPerPick ?? 90),
      draftOrderMethod: String(row.draftOrderMethod ?? "lottery"),
      cpuAutoDraft: row.cpuAutoDraft !== false,
    };
  }

  const targetDraftPrepared =
    Boolean(draft && Number(draft.season) === targetDraftSeason);

  const annualDraftOrderMethod =
    normalize(annualDraftSettings?.draftOrderMethod);

  const usesDraftLottery =
    isDynasty &&
    annualDraftOrderMethod === "lottery";

  async function saveAnnualDraftSettings(formData: FormData) {
    "use server";

    const actionSupabase = await createSupabaseServerClient();
    const secondsPerPick = Number(formData.get("secondsPerPick") ?? 90);
    const draftOrderMethod = String(formData.get("draftOrderMethod") ?? "lottery");
    const cpuAutoDraft = formData.get("cpuAutoDraft") === "on";

    const { error } = await actionSupabase.rpc(
      "save_nhl_dynasty_annual_draft_settings",
      {
        p_league_id: leagueId,
        p_draft_season: targetDraftSeason,
        p_seconds_per_pick: secondsPerPick,
        p_draft_order_method: draftOrderMethod,
        p_scheduled_at: null,
        p_cpu_auto_draft: cpuAutoDraft,
      }
    );

    if (error) {
      throw new Error(`Unable to save annual Dynasty draft settings: ${error.message}`);
    }

    revalidatePath(`/league/${leagueId}/nhl/offseason`);
  }

  const base =
    `/league/${leagueId}/nhl`;

  const recapHref =
    `${base}/recap`;

  const trophyHref =
    `${base}/trophy-case`;

  const keepersHref =
    `${base}/offseason/keepers`;

  const lotteryHref =
    `${base}/draft-lottery`;

  const draftHref =
    `${base}/draft`;

  const draftResultsHref =
    `${base}/offseason/draft-results`;

  const newSeasonHref =
    `${base}/offseason/new-season`;

  /*
   * ============================================================
   * WORKFLOW STATUS
   * ============================================================
   */
  const formatLabel =
    isDynasty
      ? "DYNASTY"
      : "REDRAFT";

  const nextAction =
    isDynasty &&
    !keeperProtectionComplete
      ? "Keeper selections are the next offseason step."
      : !draftExists
        ? "The offseason draft has not been prepared yet."
        : draftCompleted
          ? "The draft is complete. Review the results and prepare the new season."
          : "The offseason draft is ready or currently in progress.";

  return (
    <main className="g365-nhl-offseason-page">
      <style>{styles}</style>

      <section className="g365-nhl-offseason-shell">
        {/*
         * ======================================================
         * HERO
         * ======================================================
         */}
        <header className="g365-nhl-offseason-hero">
          <div className="g365-nhl-offseason-hero-copy">
            <p className="g365-nhl-offseason-eyebrow">
              G365 NHL {formatLabel}
            </p>

            <h1>
              Offseason
            </h1>

            <p className="g365-nhl-offseason-subtitle">
              Review the completed season, manage offseason
              decisions, prepare the draft, and move the league
              into its next NHL season.
            </p>
          </div>

          <div className="g365-nhl-offseason-season">
            <span>
              COMPLETED SEASON
            </span>

            <strong>
              {season}
            </strong>

            <small>
              {formatLabel}
            </small>
          </div>
        </header>

        {/*
         * ======================================================
         * CURRENT STATUS
         * ======================================================
         */}
        <section className="g365-nhl-offseason-status-grid">
          <Card>
            <div className="g365-nhl-offseason-stat">
              <span>
                FORMAT
              </span>

              <strong>
                {formatLabel}
              </strong>

              <small>
                League structure
              </small>
            </div>
          </Card>

          {isDynasty ? (
            <Card>
              <div className="g365-nhl-offseason-stat">
                <span>
                  KEEPERS
                </span>

                <strong>
                  {keeperCount}
                </strong>

                <small>
                  Protected per team
                </small>
              </div>
            </Card>
          ) : (
            <Card>
              <div className="g365-nhl-offseason-stat">
                <span>
                  ROSTERS
                </span>

                <strong>
                  RESET
                </strong>

                <small>
                  Full redraft
                </small>
              </div>
            </Card>
          )}

          <Card>
            <div className="g365-nhl-offseason-stat">
              <span>
                DRAFT
              </span>

              <strong>
                {draftExists
                  ? statusLabel(
                      draft?.status
                    )
                  : "Pending"}
              </strong>

              <small>
                {draft?.season
                  ? `${draft.season} draft`
                  : "Not prepared"}
              </small>
            </div>
          </Card>

          <Card>
            <div className="g365-nhl-offseason-stat">
              <span>
                ROLE
              </span>

              <strong>
                {isCommissioner
                  ? "COMMISH"
                  : "MEMBER"}
              </strong>

              <small>
                Offseason access
              </small>
            </div>
          </Card>
        </section>

        {/*
         * ======================================================
         * OFFSEASON WORKSPACE
         * ======================================================
         */}
        <section className="g365-nhl-offseason-section">
          <div className="g365-nhl-offseason-heading">
            <div>
              <p className="g365-nhl-offseason-eyebrow">
                OFFSEASON WORKSPACE
              </p>

              <h2>
                League Offseason
              </h2>
            </div>

            <span className="g365-nhl-offseason-live-pill">
              ACTIVE
            </span>
          </div>

          <div className="g365-nhl-offseason-workflow">
            <OffseasonCard
              step="01"
              title="Overview"
              description={
                nextAction
              }
              href={`${base}/offseason`}
              status="Current"
              active
            />

            <OffseasonCard
              step="02"
              title="Season Recap"
              description="Review final standings, season awards, top performances, milestones, and the completed season summary."
              href={recapHref}
              status="Available"
            />

            <OffseasonCard
              step="03"
              title="Trophy Case"
              description="View championships, league history, awards, and trophies carried across seasons."
              href={trophyHref}
              status="Available"
            />

            {isDynasty ? (
              <OffseasonCard
                step="04"
                title="Keepers"
                description={
                  keeperProtectionComplete
                    ? "Keeper protection has been completed for the upcoming season."
                    : `Select and lock the ${keeperCount} protected players that will carry into the next season.`
                }
                href={keepersHref}
                status={
                  statusLabel(
                    settings
                      .dynasty_protection_status
                  )
                }
                detail={
                  protectionDeadline
                    ? `Deadline: ${protectionDeadline}`
                    : null
                }
                emphasis={
                  !keeperProtectionComplete
                }
              />
            ) : null}

            {usesDraftLottery ? (
              <OffseasonCard
                step="05"
                title="Draft Lottery"
                description="Watch the official weighted lottery and determine the upcoming Dynasty draft order."
                href={lotteryHref}
                status={
                  keeperProtectionComplete
                    ? "Available"
                    : "Upcoming"
                }
              />
            ) : null}

            <OffseasonCard
              step={
                isDynasty
                  ? usesDraftLottery
                    ? "06"
                    : "05"
                  : "04"
              }
              title="Draft"
              description={
                isDynasty
                  ? usesDraftLottery
                    ? "Enter the annual Dynasty redraft after the Draft Lottery establishes the order."
                    : "Enter the annual Dynasty redraft using previous-season standings from worst to best."
                  : "Enter the upcoming full NHL redraft."
              }
              href={draftHref}
              status={
                draftExists
                  ? statusLabel(
                      draft?.status
                    )
                  : "Pending"
              }
              emphasis={
                draftExists &&
                !draftCompleted
              }
            />

            <OffseasonCard
              step={
                isDynasty
                  ? usesDraftLottery
                    ? "07"
                    : "06"
                  : "05"
              }
              title="Draft Results"
              description="Review the completed draft board, every selection, and the rosters created for the new season."
              href={draftResultsHref}
              status={
                draftCompleted
                  ? "Available"
                  : "Upcoming"
              }
            />

            <OffseasonCard
              step={
                isDynasty
                  ? usesDraftLottery
                    ? "08"
                    : "07"
                  : "06"
              }
              title="New Season"
              description="Review final offseason checks and activate the league's next NHL season."
              href={newSeasonHref}
              status={
                draftCompleted
                  ? "Ready"
                  : "Upcoming"
              }
              emphasis={
                draftCompleted
              }
            />
          </div>
        </section>

        {/*
         * ======================================================
         * COMMISSIONER NOTE
         * ======================================================
         */}
        {isDynasty && annualDraftSettings ? (
          <section className="g365-nhl-offseason-section">
            <div className="g365-nhl-offseason-heading">
              <div>
                <p className="g365-nhl-offseason-eyebrow">ANNUAL DYNASTY DRAFT</p>
                <h2>{targetDraftSeason} Draft Settings</h2>
              </div>
              <span className={`g365-nhl-offseason-settings-pill${targetDraftPrepared ? " locked" : ""}`}>
                {targetDraftPrepared ? "LOCKED" : "EDITABLE"}
              </span>
            </div>

            <form action={saveAnnualDraftSettings} className="g365-nhl-offseason-draft-settings">
              <div className="g365-nhl-offseason-derived-grid">
                <DraftSettingStat label="DRAFT SEASON" value={String(targetDraftSeason)} detail={`From ${season} season`} />
                <DraftSettingStat label="ROSTER SIZE" value={String(annualDraftSettings.rosterSize)} detail="IR excluded" />
                <DraftSettingStat label="KEEPERS" value={String(annualDraftSettings.keeperCount)} detail="Protected per team" />
                <DraftSettingStat label="DRAFT ROUNDS" value={String(annualDraftSettings.draftRounds)} detail="Roster size minus keepers" />
                <DraftSettingStat label="TEAMS" value={String(annualDraftSettings.teamCount)} detail="Active teams" />
                <DraftSettingStat label="TOTAL PICKS" value={String(annualDraftSettings.totalDraftPicks)} detail="Annual selections" />
              </div>

              <div className="g365-nhl-offseason-form-grid">
                <label className="g365-nhl-offseason-field">
                  <span>SECONDS PER PICK</span>
                  <input type="number" name="secondsPerPick" min="0" step="1"
                    defaultValue={annualDraftSettings.secondsPerPick}
                    disabled={!isCommissioner || targetDraftPrepared} required />
                  <small>Use 0 for no pick timer.</small>
                </label>

                <label className="g365-nhl-offseason-field">
                  <span>DRAFT ORDER</span>
                  <select name="draftOrderMethod"
                    defaultValue={annualDraftSettings.draftOrderMethod}
                    disabled={!isCommissioner || targetDraftPrepared}>
                    <option value="lottery">Draft Lottery</option>
                    <option value="last_place_first">Previous Season Standings (Worst → Best)</option>
                  </select>
                  <small>
                    {usesDraftLottery
                      ? "Draft Lottery is part of the offseason workflow. Annual Dynasty drafts use a linear order each round."
                      : "Draft Lottery is not used. Previous-season standings set the order worst to best, repeated linearly each round."}
                  </small>
                </label>

                <label className="g365-nhl-offseason-toggle">
                  <input type="checkbox" name="cpuAutoDraft"
                    defaultChecked={annualDraftSettings.cpuAutoDraft}
                    disabled={!isCommissioner || targetDraftPrepared} />
                  <span className="g365-nhl-offseason-toggle-copy">
                    <strong>CPU AUTO DRAFT</strong>
                    <small>Allow CPU-controlled teams to make automatic selections.</small>
                  </span>
                </label>
              </div>

              <div className="g365-nhl-offseason-settings-footer">
                <div>
                  <strong>
                    {targetDraftPrepared
                      ? "Draft settings are locked."
                      : isCommissioner
                        ? "Settings remain editable until the annual draft is prepared."
                        : "Commissioner-controlled draft settings."}
                  </strong>
                  <span>Keeper count, roster size, rounds, and total picks are derived automatically.</span>
                </div>

                {isCommissioner && !targetDraftPrepared ? (
                  <button type="submit" className="g365-nhl-offseason-save-button">
                    Save Draft Settings
                  </button>
                ) : null}
              </div>
            </form>
          </section>
        ) : null}

        {isCommissioner ? (
          <section className="g365-nhl-offseason-commissioner">
            <div>
              <p className="g365-nhl-offseason-eyebrow">
                COMMISSIONER
              </p>

              <h2>
                Commissioner Controls Stay Separate
              </h2>

              <p>
                League administration remains available from the
                permanent Commissioner tab. The Offseason workspace
                is the league-wide offseason flow for commissioners
                and members.
              </p>
            </div>

            <Link
              href={`${base}/commissioner`}
              className="g365-nhl-offseason-secondary-button"
            >
              Commissioner
            </Link>
          </section>
        ) : null}
      </section>
    </main>
  );
}

function DraftSettingStat({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="g365-nhl-offseason-derived-stat">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

function OffseasonCard({
  step,
  title,
  description,
  href,
  status,
  detail = null,
  active = false,
  emphasis = false,
}: {
  step: string;
  title: string;
  description: string;
  href: string;
  status: string;
  detail?: string | null;
  active?: boolean;
  emphasis?: boolean;
}) {
  return (
    <Link
      href={href}
      className={[
        "g365-nhl-offseason-card",
        active
          ? "active"
          : "",
        emphasis
          ? "emphasis"
          : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="g365-nhl-offseason-card-top">
        <span className="g365-nhl-offseason-step">
          {step}
        </span>

        <span className="g365-nhl-offseason-card-status">
          {status}
        </span>
      </div>

      <div className="g365-nhl-offseason-card-copy">
        <h3>
          {title}
        </h3>

        <p>
          {description}
        </p>

        {detail ? (
          <small>
            {detail}
          </small>
        ) : null}
      </div>

      <div className="g365-nhl-offseason-card-footer">
        <span>
          OPEN
        </span>

        <strong aria-hidden="true">
          →
        </strong>
      </div>
    </Link>
  );
}

const styles = `
  .g365-nhl-offseason-page,
  .g365-nhl-offseason-page * {
    box-sizing: border-box;
  }

  .g365-nhl-offseason-page {
    min-height: calc(100vh - 140px);
    padding: 30px 18px 64px;
    color: #ffffff;
    background:
      radial-gradient(
        circle at 50% 0%,
        rgba(255, 72, 0, 0.09),
        transparent 34%
      );
  }

  .g365-nhl-offseason-shell {
    width: min(1320px, 100%);
    margin: 0 auto;
    display: grid;
    gap: 22px;
  }

  .g365-nhl-offseason-hero {
    min-height: 178px;
    padding: 26px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 24px;
    border: 1px solid rgba(255, 101, 0, 0.24);
    border-radius: 16px;
    background:
      linear-gradient(
        135deg,
        rgba(180, 20, 20, 0.19),
        rgba(255, 78, 0, 0.07) 48%,
        rgba(8, 8, 10, 0.97)
      );
    overflow: hidden;
  }

  .g365-nhl-offseason-hero-copy {
    min-width: 0;
  }

  .g365-nhl-offseason-eyebrow {
    margin: 0;
    color: #ff7426;
    font-size: 9px;
    font-weight: 950;
    letter-spacing: 0.14em;
    line-height: 1.2;
  }

  .g365-nhl-offseason-hero h1 {
    margin: 7px 0 0;
    font-size: clamp(34px, 6vw, 52px);
    font-weight: 950;
    line-height: 1;
  }

  .g365-nhl-offseason-subtitle {
    max-width: 720px;
    margin: 12px 0 0;
    color: #969ca6;
    font-size: 13px;
    line-height: 1.55;
  }

  .g365-nhl-offseason-season {
    width: 132px;
    min-width: 132px;
    min-height: 112px;
    padding: 14px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 7px;
    border: 1px solid rgba(255, 111, 31, 0.26);
    border-radius: 14px;
    background: rgba(0, 0, 0, 0.26);
    text-align: center;
  }

  .g365-nhl-offseason-season span {
    color: #858b95;
    font-size: 8px;
    font-weight: 900;
    letter-spacing: 0.08em;
  }

  .g365-nhl-offseason-season strong {
    font-size: 30px;
    line-height: 1;
  }

  .g365-nhl-offseason-season small {
    color: #ff7b2c;
    font-size: 9px;
    font-weight: 900;
  }

  .g365-nhl-offseason-status-grid {
    display: grid;
    grid-template-columns:
      repeat(4, minmax(0, 1fr));
    gap: 12px;
  }

  .g365-nhl-offseason-stat {
    min-height: 112px;
    padding: 14px 8px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 9px;
    text-align: center;
  }

  .g365-nhl-offseason-stat span {
    color: #838994;
    font-size: 8px;
    font-weight: 950;
    letter-spacing: 0.1em;
  }

  .g365-nhl-offseason-stat strong {
    max-width: 100%;
    color: #ffffff;
    font-size: 20px;
    font-weight: 950;
    line-height: 1.05;
    overflow-wrap: anywhere;
  }

  .g365-nhl-offseason-stat small {
    color: #777e89;
    font-size: 9px;
  }

  .g365-nhl-offseason-section {
    padding: 22px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 16px;
    background:
      linear-gradient(
        180deg,
        rgba(17, 18, 21, 0.96),
        rgba(9, 10, 12, 0.98)
      );
  }

  .g365-nhl-offseason-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 18px;
  }

  .g365-nhl-offseason-heading h2,
  .g365-nhl-offseason-commissioner h2 {
    margin: 5px 0 0;
    font-size: 23px;
    line-height: 1.1;
  }

  .g365-nhl-offseason-live-pill {
    padding: 7px 10px;
    border: 1px solid rgba(34, 197, 94, 0.35);
    border-radius: 999px;
    color: #5ee27d;
    background: rgba(34, 197, 94, 0.08);
    font-size: 8px;
    font-weight: 950;
    letter-spacing: 0.09em;
  }

  .g365-nhl-offseason-workflow {
    display: grid;
    grid-template-columns:
      repeat(4, minmax(0, 1fr));
    gap: 12px;
  }

  .g365-nhl-offseason-card {
    min-width: 0;
    min-height: 220px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 13px;
    color: #ffffff;
    background:
      linear-gradient(
        180deg,
        rgba(24, 25, 29, 0.96),
        rgba(13, 14, 17, 0.98)
      );
    text-decoration: none;
    transition:
      transform 0.15s ease,
      border-color 0.15s ease,
      background 0.15s ease;
  }

  .g365-nhl-offseason-card:hover {
    transform: translateY(-2px);
    border-color: rgba(255, 100, 30, 0.42);
    background:
      linear-gradient(
        180deg,
        rgba(42, 25, 22, 0.97),
        rgba(14, 14, 17, 0.99)
      );
  }

  .g365-nhl-offseason-card.active {
    border-color: rgba(255, 102, 31, 0.48);
  }

  .g365-nhl-offseason-card.emphasis {
    border-color: rgba(239, 68, 68, 0.38);
    box-shadow:
      0 0 24px rgba(239, 68, 68, 0.06);
  }

  .g365-nhl-offseason-card-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }

  .g365-nhl-offseason-step {
    width: 28px;
    height: 28px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid rgba(255, 104, 31, 0.28);
    border-radius: 8px;
    color: #ff7b2c;
    background: rgba(255, 92, 0, 0.06);
    font-size: 9px;
    font-weight: 950;
  }

  .g365-nhl-offseason-card-status {
    max-width: 130px;
    color: #8d949e;
    font-size: 8px;
    font-weight: 900;
    line-height: 1.2;
    text-align: right;
    text-transform: uppercase;
  }

  .g365-nhl-offseason-card-copy {
    flex: 1;
    padding-top: 19px;
  }

  .g365-nhl-offseason-card-copy h3 {
    margin: 0;
    font-size: 18px;
    font-weight: 950;
  }

  .g365-nhl-offseason-card-copy p {
    margin: 9px 0 0;
    color: #8f959f;
    font-size: 11px;
    line-height: 1.5;
  }

  .g365-nhl-offseason-card-copy small {
    display: block;
    margin-top: 10px;
    color: #ff8a3d;
    font-size: 9px;
    line-height: 1.4;
  }

  .g365-nhl-offseason-card-footer {
    min-height: 28px;
    margin-top: 18px;
    padding-top: 12px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
    color: #ff7128;
  }

  .g365-nhl-offseason-card-footer span {
    font-size: 8px;
    font-weight: 950;
    letter-spacing: 0.1em;
  }

  .g365-nhl-offseason-card-footer strong {
    font-size: 18px;
    line-height: 1;
  }

  .g365-nhl-offseason-settings-pill {
    padding: 7px 10px;
    border: 1px solid rgba(255, 112, 35, 0.34);
    border-radius: 999px;
    color: #ff8338;
    background: rgba(255, 92, 0, 0.07);
    font-size: 8px;
    font-weight: 950;
    letter-spacing: 0.09em;
  }

  .g365-nhl-offseason-settings-pill.locked {
    border-color: rgba(255, 255, 255, 0.12);
    color: #8c929b;
    background: rgba(255, 255, 255, 0.04);
  }

  .g365-nhl-offseason-draft-settings { display: grid; gap: 16px; }

  .g365-nhl-offseason-derived-grid {
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: 9px;
  }

  .g365-nhl-offseason-derived-stat {
    min-width: 0;
    padding: 13px 10px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 10px;
    background: rgba(0, 0, 0, 0.22);
  }

  .g365-nhl-offseason-derived-stat span,
  .g365-nhl-offseason-field > span {
    color: #858b95;
    font-size: 8px;
    font-weight: 950;
    letter-spacing: 0.09em;
  }

  .g365-nhl-offseason-derived-stat strong { font-size: 22px; font-weight: 950; }

  .g365-nhl-offseason-derived-stat small,
  .g365-nhl-offseason-field small,
  .g365-nhl-offseason-toggle small {
    color: #777e89;
    font-size: 9px;
    line-height: 1.4;
  }

  .g365-nhl-offseason-form-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 11px;
  }

  .g365-nhl-offseason-field,
  .g365-nhl-offseason-toggle {
    min-width: 0;
    padding: 14px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 11px;
    background: rgba(0, 0, 0, 0.18);
  }

  .g365-nhl-offseason-field { display: grid; gap: 8px; }

  .g365-nhl-offseason-field input,
  .g365-nhl-offseason-field select {
    width: 100%;
    min-height: 43px;
    padding: 0 11px;
    border: 1px solid rgba(255, 113, 40, 0.24);
    border-radius: 8px;
    outline: none;
    color: #ffffff;
    background: #111216;
    font: inherit;
    font-size: 12px;
  }

  .g365-nhl-offseason-field input:disabled,
  .g365-nhl-offseason-field select:disabled {
    cursor: not-allowed;
    color: #777e89;
    opacity: 0.72;
  }

  .g365-nhl-offseason-toggle {
    min-height: 86px;
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .g365-nhl-offseason-toggle input {
    width: 20px;
    height: 20px;
    flex: 0 0 auto;
    accent-color: #f97316;
  }

  .g365-nhl-offseason-toggle-copy { display: grid; gap: 5px; }
  .g365-nhl-offseason-toggle-copy strong { font-size: 10px; letter-spacing: 0.07em; }

  .g365-nhl-offseason-settings-footer {
    padding-top: 14px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    border-top: 1px solid rgba(255, 255, 255, 0.07);
  }

  .g365-nhl-offseason-settings-footer > div { display: grid; gap: 4px; }
  .g365-nhl-offseason-settings-footer strong { font-size: 11px; }
  .g365-nhl-offseason-settings-footer span { color: #7f8690; font-size: 9px; line-height: 1.4; }

  .g365-nhl-offseason-save-button {
    min-height: 44px;
    padding: 0 16px;
    flex: 0 0 auto;
    border: 1px solid rgba(255, 111, 31, 0.48);
    border-radius: 9px;
    color: #ffffff;
    background: linear-gradient(135deg, #b91c1c, #ea580c);
    font-size: 9px;
    font-weight: 950;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    cursor: pointer;
  }

  .g365-nhl-offseason-commissioner {
    padding: 20px 22px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
    border: 1px solid rgba(255, 91, 26, 0.2);
    border-radius: 14px;
    background:
      linear-gradient(
        135deg,
        rgba(137, 20, 20, 0.12),
        rgba(255, 80, 0, 0.04),
        rgba(10, 10, 12, 0.95)
      );
  }

  .g365-nhl-offseason-commissioner p:not(.g365-nhl-offseason-eyebrow) {
    max-width: 760px;
    margin: 8px 0 0;
    color: #8e949e;
    font-size: 11px;
    line-height: 1.5;
  }

  .g365-nhl-offseason-secondary-button {
    min-height: 42px;
    padding: 0 15px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    border: 1px solid rgba(255, 112, 35, 0.32);
    border-radius: 9px;
    color: #ff8338;
    background: rgba(255, 92, 0, 0.06);
    font-size: 9px;
    font-weight: 950;
    letter-spacing: 0.05em;
    text-decoration: none;
    text-transform: uppercase;
  }

  @media (max-width: 1050px) {
    .g365-nhl-offseason-workflow {
      grid-template-columns:
        repeat(2, minmax(0, 1fr));
    }

    .g365-nhl-offseason-status-grid {
      grid-template-columns:
        repeat(2, minmax(0, 1fr));
    }

    .g365-nhl-offseason-derived-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }

  @media (max-width: 700px) {
    .g365-nhl-offseason-page {
      padding:
        18px 12px
        max(
          44px,
          env(safe-area-inset-bottom)
        );
    }

    .g365-nhl-offseason-shell {
      gap: 14px;
    }

    .g365-nhl-offseason-hero {
      min-height: 0;
      padding: 18px;
      align-items: stretch;
      flex-direction: column;
    }

    .g365-nhl-offseason-season {
      width: 100%;
      min-width: 0;
      min-height: 82px;
      flex-direction: row;
      justify-content: flex-start;
      gap: 12px;
    }

    .g365-nhl-offseason-season strong {
      font-size: 24px;
    }

    .g365-nhl-offseason-status-grid {
      grid-template-columns:
        repeat(2, minmax(0, 1fr));
      gap: 8px;
    }

    .g365-nhl-offseason-stat {
      min-height: 96px;
      padding: 10px 6px;
    }

    .g365-nhl-offseason-stat strong {
      font-size: 16px;
    }

    .g365-nhl-offseason-section {
      padding: 15px;
    }

    .g365-nhl-offseason-workflow {
      grid-template-columns:
        1fr;
      gap: 9px;
    }

    .g365-nhl-offseason-card {
      min-height: 0;
      padding: 14px;
    }

    .g365-nhl-offseason-card-copy {
      padding-top: 14px;
    }

    .g365-nhl-offseason-commissioner {
      padding: 17px;
      align-items: stretch;
      flex-direction: column;
    }

    .g365-nhl-offseason-secondary-button {
      width: 100%;
    }

    .g365-nhl-offseason-derived-grid,
    .g365-nhl-offseason-form-grid {
      grid-template-columns: 1fr;
    }

    .g365-nhl-offseason-settings-footer {
      align-items: stretch;
      flex-direction: column;
    }

    .g365-nhl-offseason-save-button {
      width: 100%;
    }
  }

  @media (max-width: 420px) {
    .g365-nhl-offseason-status-grid {
      grid-template-columns:
        1fr 1fr;
    }

    .g365-nhl-offseason-heading {
      align-items: flex-start;
    }
  }
`;