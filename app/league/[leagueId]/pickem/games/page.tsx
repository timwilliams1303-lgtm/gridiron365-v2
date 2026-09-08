import {
  redirect,
} from "next/navigation";

import PickemGames from "@/components/pickem/PickemGames";
import MixedPickemGames from "@/components/pickem/MixedPickemGames";
import NhlPickemGames from "@/components/nhl-pickem/NhlPickemGames";

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
  if (
    Array.isArray(
      enabledSports
    )
  ) {
    const normalized =
      enabledSports
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
            value === "nhl"
        );

    if (
      normalized.length > 0
    ) {
      return Array.from(
        new Set(
          normalized
        )
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

export default async function PickemGamesPage({
  params,
}: PageProps) {
  const {
    leagueId,
  } =
    await params;

  const access =
    await requireLeagueMember(
      leagueId
    );

  if (
    access.league.leagueType !==
    "pickem"
  ) {
    redirect(
      `/league/${leagueId}`
    );
  }

  const supabase =
    await createSupabaseServerClient();

  const {
    data:
      settingsData,
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

  const enabledSports =
    normalizeEnabledSports(
      settingsData
        ?.enabled_sports,
      settingsData
        ?.football_scope ??
        null
    );

  const nhlOnly =
    enabledSports.length ===
      1 &&
    enabledSports[0] ===
      "nhl";

  const mixed =
    enabledSports.includes(
      "nhl"
    ) &&
    (
      enabledSports.includes(
        "cfb"
      ) ||
      enabledSports.includes(
        "nfl"
      )
    );

  if (nhlOnly) {
    return (
      <NhlPickemGames
        leagueId={
          leagueId
        }
        season={
          access.league.season
        }
      />
    );
  }

  if (mixed) {
    return (
      <MixedPickemGames
        leagueId={
          leagueId
        }
        season={
          access.league.season
        }
        enabledSports={
          enabledSports
        }
      />
    );
  }

  return (
    <PickemGames
      leagueId={
        leagueId
      }
      season={
        access.league.season
      }
    />
  );
}
