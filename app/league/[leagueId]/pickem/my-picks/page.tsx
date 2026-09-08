import {
  redirect,
} from "next/navigation";

import PickemMyPicks from "@/components/pickem/PickemMyPicks";
import NhlPickemMyPicks from "@/components/nhl-pickem/NhlPickemMyPicks";
import MixedPickemMyPicks from "@/components/pickem/MixedPickemMyPicks";

import {
  requireLeagueMember,
} from "@/lib/leagues/requireLeagueMember";

import {
  createSupabaseServerClient,
} from "@/lib/supabase/server";


type PageProps = {
  params: Promise<{
    leagueId: string;
  }>;
};


type PickemSport =
  | "cfb"
  | "nfl"
  | "nhl";


function normalizeEnabledSports(
  enabledSports: unknown,
  footballScope: string | null
): PickemSport[] {
  if (Array.isArray(enabledSports)) {
    const normalized =
      enabledSports
        .map((value) =>
          String(value).trim().toLowerCase()
        )
        .filter(
          (value): value is PickemSport =>
            value === "cfb" ||
            value === "nfl" ||
            value === "nhl"
        );

    if (normalized.length > 0) {
      return Array.from(new Set(normalized));
    }
  }

  if (footballScope === "college_only") {
    return ["cfb"];
  }

  if (footballScope === "nfl_only") {
    return ["nfl"];
  }

  return ["cfb", "nfl"];
}


export default async function PickemMyPicksPage({
  params,
}: PageProps) {
  const { leagueId } = await params;

  const access =
    await requireLeagueMember(leagueId);

  if (
    access.league.leagueType !== "pickem"
  ) {
    redirect(`/league/${leagueId}`);
  }

  if (!access.fantasyTeam) {
    redirect(`/league/${leagueId}`);
  }

  const supabase =
    await createSupabaseServerClient();

  const { data: settingsData } =
    await supabase
      .from("pickem_settings")
      .select("enabled_sports,football_scope")
      .eq("league_id", leagueId)
      .maybeSingle();

  const enabledSports =
    normalizeEnabledSports(
      settingsData?.enabled_sports,
      settingsData?.football_scope ?? null
    );

  const nhlOnly =
    enabledSports.length === 1 &&
    enabledSports[0] === "nhl";

  const includesNhl =
    enabledSports.includes("nhl");

  const includesFootball =
    enabledSports.includes("cfb") ||
    enabledSports.includes("nfl");

  const mixed =
    includesNhl && includesFootball;

  if (nhlOnly) {
    return (
      <NhlPickemMyPicks
        leagueId={leagueId}
        season={access.league.season}
        fantasyTeamId={access.fantasyTeam.id}
        teamName={access.fantasyTeam.teamName}
      />
    );
  }

  if (mixed) {
    return (
      <MixedPickemMyPicks
        leagueId={leagueId}
        season={access.league.season}
        fantasyTeamId={access.fantasyTeam.id}
        teamName={access.fantasyTeam.teamName}
        enabledSports={enabledSports}
      />
    );
  }

  return (
    <PickemMyPicks
      leagueId={leagueId}
      season={access.league.season}
      fantasyTeamId={access.fantasyTeam.id}
      teamName={access.fantasyTeam.teamName}
    />
  );
}
