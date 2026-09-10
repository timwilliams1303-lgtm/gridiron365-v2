
import Image from "next/image";
import Link from "next/link";

import {
  notFound,
  redirect,
} from "next/navigation";


import TraditionalLiveRefresh from "@/components/traditional/TraditionalLiveRefresh";

import LeagueNav from "@/components/leagues/LeagueNav";

import {
  requireLeagueMember,
} from "@/lib/leagues/requireLeagueMember";

import {
  getLeaguePrimaryAction,
} from "@/lib/leagues/leagueRoutes";

import type {
  G365LeagueType,
} from "@/lib/leagues/leagueCapabilities";

import {
  getLeagueDisplayLabels,
} from "@/lib/leagues/leagueDisplayLabels";

import {
  createSupabaseServerClient,
} from "@/lib/supabase/server";

import "./league-shell.css";


type LayoutProps = {
  children:
    React.ReactNode;

  params:
    Promise<{
      leagueId: string;
    }>;
};


function isUuid(
  value:
    string
) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}


export default async function LeagueLayout({
  children,
  params,
}: LayoutProps) {
  const {
    leagueId,
  } =
    await params;


  /*
   * ============================================================
   * ROUTE SAFETY
   * ============================================================
   */
  if (
    !leagueId ||
    !isUuid(
      leagueId
    )
  ) {
    redirect(
      "/my-leagues"
    );
  }


  /*
   * ============================================================
   * SHARED LEAGUE ACCESS
   * ============================================================
   */
  const access =
    await requireLeagueMember(
      leagueId
    );


  if (
    !access ||
    !access.league
  ) {
    notFound();
  }


  const league =
    access.league;


  const fantasyTeam =
    access.fantasyTeam;


  const isCommissioner =
    Boolean(
      access.isCommissioner
    );


  const isTraditional =
    league.leagueType ===
    "traditional";


  const isSeasonLong =
    league.leagueType ===
    "season_long";


  /*
   * ============================================================
   * SEASON-LONG NAVIGATION SETTINGS
   * ============================================================
   *
   * The selected league decides which tabs are visible.
   * Total Points leagues do not expose H2H-only pages.
   * Head-to-Head leagues expose Matchups, and Stage 5 will use
   * playoffsEnabled to expose the playoff/bracket tab only when
   * that league actually has H2H playoffs enabled.
   */
  let seasonLongCompetitionFormat:
    | "total_points"
    | "head_to_head" =
      "total_points";

  let seasonLongPlayoffsEnabled =
    false;


  if (
    isSeasonLong
  ) {
    const supabase =
      await createSupabaseServerClient();

    const {
      data:
        seasonLongSettings,
      error:
        seasonLongSettingsError,
    } =
      await supabase
        .from(
          "season_long_settings"
        )
        .select(`
          competition_format,
          playoffs_enabled
        `)
        .eq(
          "league_id",
          leagueId
        )
        .maybeSingle();


    if (
      seasonLongSettingsError
    ) {
      throw new Error(
        `Could not load Season-Long navigation settings: ${seasonLongSettingsError.message}`
      );
    }


    seasonLongCompetitionFormat =
      seasonLongSettings
        ?.competition_format ===
        "head_to_head"
        ? "head_to_head"
        : "total_points";

    seasonLongPlayoffsEnabled =
      Boolean(
        seasonLongSettings
          ?.playoffs_enabled
      );
  }


  const leagueType =
    league.leagueType as
      G365LeagueType;


  const {
    leagueTypeLabel,
    mobileLeagueTypeLabel,
    selectionModeLabel,
    mobileSelectionModeLabel,
  } =
    getLeagueDisplayLabels({
      leagueType,
      playerSelectionMode:
        league.playerSelectionMode,
      seasonLongCompetitionFormat,
    });


  const primaryAction =
    getLeaguePrimaryAction({
      leagueId,
      leagueType,
    });


  const primaryActionLabel =
    primaryAction.label;


  const primaryActionHref =
    primaryAction.href;


  return (
    <div
      className="g365-league-shell"
    >
      {/* ==================================================
          TRADITIONAL REALTIME ONLY
      =================================================== */}

      <LeagueNav
        leagueId={
          leagueId
        }
        leagueType={
          leagueType
        }
        isCommissioner={
          isCommissioner
        }
        competitionFormat={
          isSeasonLong
            ? seasonLongCompetitionFormat
            : null
        }
        playoffsEnabled={
          isSeasonLong
            ? seasonLongPlayoffsEnabled
            : false
        }
        ariaLabel="League Navigation"
      />


      {/* ==================================================
          CURRENT PAGE
      =================================================== */}

      <div
        className="g365-league-content"
      >
        {children}
      </div>
    </div>
  );
}
