import Link from "next/link";

import {
  notFound,
  redirect,
} from "next/navigation";

import LeagueNav from "@/components/leagues/LeagueNav";

import {
  requireLeagueMember,
} from "@/lib/leagues/requireLeagueMember";

import type {
  G365LeagueType,
} from "@/lib/leagues/leagueCapabilities";

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
  value: string,
) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
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
      leagueId,
    )
  ) {
    redirect(
      "/my-leagues",
    );
  }


  /*
   * ============================================================
   * SHARED LEAGUE ACCESS
   * ============================================================
   */
  const access =
    await requireLeagueMember(
      leagueId,
    );


  if (
    !access ||
    !access.league
  ) {
    notFound();
  }


  const league =
    access.league;


  const isCommissioner =
    Boolean(
      access.isCommissioner,
    );


  const isSeasonLong =
    league.leagueType ===
    "season_long";


  /*
   * ============================================================
   * SEASON-LONG NAVIGATION SETTINGS
   * ============================================================
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
          "season_long_settings",
        )
        .select(`
          competition_format,
          playoffs_enabled
        `)
        .eq(
          "league_id",
          leagueId,
        )
        .maybeSingle();


    if (
      seasonLongSettingsError
    ) {
      throw new Error(
        `Could not load Season-Long navigation settings: ${seasonLongSettingsError.message}`,
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
          ?.playoffs_enabled,
      );
  }


  const leagueType =
    league.leagueType as
      G365LeagueType;


  return (
    <div
      className="g365-league-shell"
    >
      {/* ==================================================
          BACK TO MY LEAGUES
      =================================================== */}

      <div
        className="g365-back-to-leagues-bar"
      >
        <Link
          href="/my-leagues"
          className="g365-back-to-leagues-button"
        >
          <span
            aria-hidden="true"
          >
            ←
          </span>

          <span>
            Back to My Leagues
          </span>
        </Link>
      </div>


      {/* ==================================================
          LEAGUE NAVIGATION
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