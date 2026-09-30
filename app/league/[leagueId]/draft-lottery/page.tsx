import { redirect } from "next/navigation";

import TraditionalDynastyLotteryOfficial from "@/components/traditional/TraditionalDynastyLotteryOfficial";
import { requireLeagueMember } from "@/lib/leagues/requireLeagueMember";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type PageProps = {
  params: Promise<{
    leagueId: string;
  }>;
};

type DynastySettingsRow = {
  league_format: string | null;
  dynasty_draft_order_method: string | null;
};

type SeasonStateRow = {
  season_complete: boolean | null;
};

type DraftRow = {
  id: number;
  season: number;
  status: string | null;
  draft_type?: string | null;
  completed_at?: string | null;
};

function normalize(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function isCompleteDraft(draft: DraftRow | null) {
  if (!draft) return false;

  return (
    normalize(draft.status) === "complete" ||
    normalize(draft.status) === "completed" ||
    Boolean(draft.completed_at)
  );
}

export default async function TraditionalDraftLotteryPage({
  params,
}: PageProps) {
  const { leagueId } = await params;

  const access = await requireLeagueMember(leagueId);

  if (String(access.league.leagueType) !== "traditional") {
    redirect(`/league/${leagueId}`);
  }

  const currentSeason = Number(access.league.season);

  if (!Number.isFinite(currentSeason)) {
    redirect(`/league/${leagueId}`);
  }

  const supabase = await createSupabaseServerClient();

  /*
   * ------------------------------------------------------------
   * DYNASTY SETTINGS
   * ------------------------------------------------------------
   */

  const settingsResponse = await supabase
    .from("traditional_league_settings")
    .select("league_format,dynasty_draft_order_method")
    .eq("league_id", leagueId)
    .eq("season", currentSeason)
    .maybeSingle();

  if (settingsResponse.error) {
    throw new Error(
      `Unable to load NFL Dynasty settings: ${settingsResponse.error.message}`
    );
  }

  const settings =
    settingsResponse.data as unknown as DynastySettingsRow | null;

  if (normalize(settings?.league_format) !== "dynasty") {
    redirect(`/league/${leagueId}`);
  }

  /*
   * ------------------------------------------------------------
   * LOTTERY ORDER METHOD
   * ------------------------------------------------------------
   */

  if (
    normalize(settings?.dynasty_draft_order_method) !== "lottery"
  ) {
    redirect(`/league/${leagueId}/offseason`);
  }

  /*
   * ------------------------------------------------------------
   * CURRENT SEASON STATE
   * ------------------------------------------------------------
   */

  const seasonStateResponse = await supabase
    .from("traditional_season_state")
    .select("season_complete")
    .eq("league_id", leagueId)
    .eq("season", currentSeason)
    .maybeSingle();

  if (seasonStateResponse.error) {
    throw new Error(
      `Unable to load NFL season state: ${seasonStateResponse.error.message}`
    );
  }

  const seasonState =
    seasonStateResponse.data as unknown as SeasonStateRow | null;

  const seasonComplete =
    seasonState?.season_complete === true;

  /*
   * ------------------------------------------------------------
   * CURRENT / STARTUP DRAFT
   * ------------------------------------------------------------
   *
   * Startup lottery:
   * current season is not complete AND the initial draft has not
   * been completed.
   *
   * Annual lottery:
   * current season is complete and the lottery is for next season.
   */

  const draftResponse = await supabase
    .from("league_drafts")
    .select("id,season,status,draft_type,completed_at")
    .eq("league_id", leagueId)
    .order("season", {
      ascending: true,
    });

  if (draftResponse.error) {
    throw new Error(
      `Unable to load NFL Dynasty draft state: ${draftResponse.error.message}`
    );
  }

  const drafts =
    (draftResponse.data ?? []) as unknown as DraftRow[];

  const currentSeasonDraft =
    drafts.find(
      (draft) =>
        Number(draft.season) === currentSeason
    ) ?? null;

  const startupDraftComplete =
    isCompleteDraft(currentSeasonDraft);

  /*
   * ------------------------------------------------------------
   * DETERMINE LOTTERY TYPE
   * ------------------------------------------------------------
   */

  const isStartup =
    !seasonComplete &&
    !startupDraftComplete;

  const isAnnual = seasonComplete;

  /*
   * A completed startup draft + an active NFL season means there
   * should be no Dynasty lottery available yet.
   */

  if (!isStartup && !isAnnual) {
    redirect(`/league/${leagueId}`);
  }

  /*
   * ------------------------------------------------------------
   * DRAFT SEASON
   * ------------------------------------------------------------
   */

  const draftSeason = isStartup
    ? currentSeason
    : currentSeason + 1;

  const title = isStartup
    ? `${draftSeason} Dynasty Startup Draft Lottery`
    : `${draftSeason} Dynasty Annual Draft Lottery`;

  const description = isStartup
    ? `Establish the official draft order for the ${draftSeason} NFL Dynasty startup draft. Each franchise begins with equal lottery odds, and the locked result feeds the initial Dynasty draft order.`
    : `Establish the official base order for the ${draftSeason} NFL Dynasty annual draft using the completed ${currentSeason} season. The lottery result feeds the annual draft while traded draft-pick ownership remains attached to the pick assets.`;

  const backHref = isStartup
    ? `/league/${leagueId}/commissioner`
    : `/league/${leagueId}/offseason`;

  const backLabel = isStartup
    ? "COMMISSIONER"
    : "OFFSEASON";

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "18px",
        background:
          "linear-gradient(180deg,#07080c,#0b0d12 50%,#07080b)",
        color: "#f5f7fa",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "1550px",
          margin: "0 auto",
        }}
      >
        <header
          style={{
            marginBottom: "14px",
            padding: "16px",
            border:
              "1px solid rgba(255,92,40,.28)",
            borderRadius: "14px",
            background:
              "linear-gradient(135deg,rgba(140,14,14,.22),rgba(255,90,30,.08),rgba(255,255,255,.02))",
          }}
        >
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "6px",
              marginBottom: "7px",
            }}
          >
            <span
              style={{
                padding: "4px 8px",
                border:
                  "1px solid rgba(255,92,40,.3)",
                borderRadius: "999px",
                color: "#ff6b2c",
                background:
                  "rgba(255,92,40,.07)",
                fontSize: "9px",
                fontWeight: 950,
                letterSpacing: ".1em",
              }}
            >
              G365 NFL DYNASTY
            </span>

            <span
              style={{
                padding: "4px 8px",
                border:
                  "1px solid rgba(255,255,255,.08)",
                borderRadius: "999px",
                color: "#aab1bb",
                background:
                  "rgba(255,255,255,.03)",
                fontSize: "9px",
                fontWeight: 950,
                letterSpacing: ".08em",
              }}
            >
              {isStartup
                ? "STARTUP LOTTERY"
                : "ANNUAL LOTTERY"}
            </span>
          </div>

          <h1
            style={{
              margin: 0,
              fontSize: "clamp(25px,4vw,34px)",
              fontWeight: 950,
              letterSpacing: "-.025em",
            }}
          >
            {title}
          </h1>

          <p
            style={{
              maxWidth: "850px",
              margin: "7px 0 0",
              color: "#9ca3ad",
              fontSize: "11px",
              lineHeight: 1.55,
            }}
          >
            {description}
          </p>

          <div
            style={{
              marginTop: "12px",
              display: "flex",
              flexWrap: "wrap",
              gap: "8px",
            }}
          >
            <a
              href={backHref}
              style={{
                minHeight: "38px",
                padding: "9px 12px",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                border:
                  "1px solid rgba(255,255,255,.10)",
                borderRadius: "9px",
                background: "#15181e",
                color: "#f5f7fa",
                fontSize: "10px",
                fontWeight: 950,
                textDecoration: "none",
              }}
            >
              ← {backLabel}
            </a>

            <a
              href={`/league/${leagueId}/draft`}
              style={{
                minHeight: "38px",
                padding: "9px 12px",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                border:
                  "1px solid rgba(255,92,40,.35)",
                borderRadius: "9px",
                background:
                  "rgba(255,92,40,.08)",
                color: "#ff8b58",
                fontSize: "10px",
                fontWeight: 950,
                textDecoration: "none",
              }}
            >
              {isStartup
                ? "STARTUP DRAFT →"
                : "ANNUAL DRAFT →"}
            </a>
          </div>
        </header>

        <TraditionalDynastyLotteryOfficial
          leagueId={leagueId}
          draftSeason={draftSeason}
          viewerOnly={!access.isCommissioner}
        />
      </div>
    </main>
  );
}