import { redirect } from "next/navigation";

import NhlTraditionalOffseason from "@/components/nhl-traditional/NhlTraditionalOffseason";
import { requireLeagueMember } from "@/lib/leagues/requireLeagueMember";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type NhlTraditionalOffseasonPageProps = {
  params: Promise<{
    leagueId: string;
  }>;
};

type SeasonStateRow = {
  phase: string | null;
};

export default async function NhlTraditionalOffseasonPage({
  params,
}: NhlTraditionalOffseasonPageProps) {
  const { leagueId } = await params;

  /*
   * ============================================================
   * MEMBER + LEAGUE GUARD
   * ============================================================
   *
   * Offseason is only available to authenticated members of an
   * NHL Traditional league.
   */
  const access =
    await requireLeagueMember(
      leagueId
    );

  if (
    String(
      access.league.leagueType
    ) !== "nhl_traditional"
  ) {
    redirect(
      `/league/${leagueId}`
    );
  }

  /*
   * ============================================================
   * CURRENT SEASON
   * ============================================================
   */
  const season =
    Number(
      access.league.season
    );

  if (
    !Number.isFinite(season)
  ) {
    redirect(
      `/league/${leagueId}/nhl`
    );
  }

  /*
   * ============================================================
   * AUTHORITATIVE NHL LIFECYCLE CHECK
   * ============================================================
   *
   * The navigation hiding Offseason is only presentation.
   *
   * This server-side check is the real route guard and prevents
   * members from manually entering /nhl/offseason before the
   * league has actually entered its offseason lifecycle.
   */
  const supabase =
    await createSupabaseServerClient();

  const {
    data,
    error,
  } =
    await supabase
      .from(
        "nhl_traditional_season_state"
      )
      .select(
        "phase"
      )
      .eq(
        "league_id",
        leagueId
      )
      .eq(
        "season",
        season
      )
      .maybeSingle();

  if (error) {
    throw new Error(
      `Unable to load NHL season state: ${error.message}`
    );
  }

  const seasonState =
    data as
      | SeasonStateRow
      | null;

  const phase =
    String(
      seasonState?.phase ??
        ""
    )
      .trim()
      .toLowerCase();

  /*
   * ============================================================
   * OFFSEASON-ONLY ROUTE
   * ============================================================
   *
   * Preseason
   * Draft
   * Regular Season
   * Playoffs
   * Complete
   *
   * ...all remain outside this workspace.
   */
  if (
    phase !== "offseason"
  ) {
    redirect(
      `/league/${leagueId}/nhl`
    );
  }

  /*
   * ============================================================
   * OFFSEASON WORKSPACE
   * ============================================================
   */
  return (
    <NhlTraditionalOffseason
      leagueId={leagueId}
      season={season}
      isCommissioner={
        Boolean(
          access.isCommissioner
        )
      }
    />
  );
}