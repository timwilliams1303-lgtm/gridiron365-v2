import { redirect } from "next/navigation";

import PickemMyPicks from "@/components/pickem/PickemMyPicks";
import MixedPickemMyPicks from "@/components/pickem/MixedPickemMyPicks";
import NhlPickemMyPicks from "@/components/nhl-pickem/NhlPickemMyPicks";

import { requireLeagueMember } from "@/lib/leagues/requireLeagueMember";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type PageProps = {
  params: Promise<{
    leagueId: string;
  }>;
};

type PickemSport =
  | "cfb"
  | "nfl"
  | "ncaamb"
  | "nhl";

type PickemSettingsRow = {
  enabled_sports: string[] | null;
  football_scope: string | null;
};

function normalizeEnabledSports(
  enabledSports: unknown,
  footballScope: string | null
): PickemSport[] {
  if (Array.isArray(enabledSports)) {
    const normalized = enabledSports
      .map((value) =>
        String(value)
          .trim()
          .toLowerCase()
      )
      .filter(
        (
          value
        ): value is PickemSport =>
          value === "cfb" ||
          value === "nfl" ||
          value === "ncaamb" ||
          value === "nhl"
      );

    if (normalized.length > 0) {
      return Array.from(
        new Set(normalized)
      );
    }
  }

  if (
    footballScope ===
    "college_only"
  ) {
    return ["cfb"];
  }

  if (
    footballScope ===
    "nfl_only"
  ) {
    return ["nfl"];
  }

  return ["cfb", "nfl"];
}

export default async function PickemMyPicksPage({
  params,
}: PageProps) {
  const { leagueId } =
    await params;

  const access =
    await requireLeagueMember(
      leagueId
    );

  if (
    String(
      access.league.leagueType
    ) !== "pickem"
  ) {
    redirect(
      `/league/${leagueId}`
    );
  }

  if (!access.fantasyTeam) {
    redirect(
      `/league/${leagueId}`
    );
  }

  const supabase =
    await createSupabaseServerClient();

  const {
    data: settingsData,
    error: settingsError,
  } =
    await supabase
      .from(
        "pickem_settings"
      )
      .select(
        "enabled_sports,football_scope"
      )
      .eq(
        "league_id",
        leagueId
      )
      .maybeSingle();

  if (settingsError) {
    throw new Error(
      `Unable to load Pick'em settings: ${settingsError.message}`
    );
  }

  const settings =
    settingsData as
      | PickemSettingsRow
      | null;

  const enabledSports =
    normalizeEnabledSports(
      settings?.enabled_sports,
      settings?.football_scope ??
        null
    );

  const nhlOnly =
    enabledSports.length === 1 &&
    enabledSports[0] === "nhl";

  const sharedSports =
    enabledSports.filter(
      (
        sport
      ): sport is
        | "cfb"
        | "nfl"
        | "ncaamb" =>
        sport === "cfb" ||
        sport === "nfl" ||
        sport === "ncaamb"
    );

  const includesNhl =
    enabledSports.includes(
      "nhl"
    );

  const includesShared =
    sharedSports.length > 0;

  const mixed =
    includesNhl &&
    includesShared;

  /*
   * NHL-only Pick'em
   */
  if (nhlOnly) {
    return (
      <NhlPickemMyPicks
        leagueId={
          leagueId
        }
        season={
          access.league.season
        }
        fantasyTeamId={
          access.fantasyTeam.id
        }
        teamName={
          access.fantasyTeam.teamName
        }
      />
    );
  }

  /*
   * Mixed Pick'em
   *
   * Example:
   * CFB + NFL + NHL
   * CFB + NFL + NCAAMB + NHL
   */
  if (mixed) {
    return (
      <MixedPickemMyPicks
        leagueId={
          leagueId
        }
        season={
          access.league.season
        }
        fantasyTeamId={
          access.fantasyTeam.id
        }
        teamName={
          access.fantasyTeam.teamName
        }
        enabledSports={
          enabledSports
        }
      />
    );
  }

  /*
   * Shared Pick'em
   *
   * CFB
   * NFL
   * NCAAMB
   * or any combination of those.
   */
  return (
    <PickemMyPicks
      leagueId={
        leagueId
      }
      season={
        access.league.season
      }
      fantasyTeamId={
        access.fantasyTeam.id
      }
      teamName={
        access.fantasyTeam.teamName
      }
      visibleSports={
        sharedSports
      }
    />
  );
}