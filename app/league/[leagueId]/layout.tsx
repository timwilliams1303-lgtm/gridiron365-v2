import Image from "next/image";
import Link from "next/link";

import {
  notFound,
  redirect,
} from "next/navigation";

import SeasonLongLeagueNav from "@/components/season-long/SeasonLongLeagueNav";
import PickemLeagueNav from "@/components/pickem/PickemLeagueNav";
import NflPlayoffsLeagueNav from "@/components/nfl-playoffs/NflPlayoffsLeagueNav";

import TraditionalLeagueNav from "@/components/traditional/TraditionalLeagueNav";
import TraditionalLiveRefresh from "@/components/traditional/TraditionalLiveRefresh";

import {
  requireLeagueMember,
} from "@/lib/leagues/requireLeagueMember";

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


function getLeagueTypeLabel(
  leagueType:
    string,
  playerSelectionMode:
    string
) {
  if (
    leagueType ===
    "traditional"
  ) {
    return "TRADITIONAL";
  }


  if (
    leagueType ===
    "season_long"
  ) {
    return "SEASON-LONG";
  }


  if (
    leagueType ===
    "nfl_playoffs"
  ) {
    return "NFL PLAYOFFS";
  }


  if (
    leagueType ===
    "pickem"
  ) {
    return "G365 FOOTBALL PICK'EM";
  }


  return "GRIDIRON365";
}


function getSelectionModeLabel(
  leagueType:
    string,
  playerSelectionMode:
    string
) {
  if (
    leagueType ===
    "traditional"
  ) {
    return null;
  }


  if (
    playerSelectionMode ===
    "salary"
  ) {
    return "SALARY CAP";
  }


  if (
    playerSelectionMode ===
    "no_salary"
  ) {
    return "NO SALARY CAP";
  }


  return null;
}



function getMobileLeagueTypeLabel(
  leagueType:
    string,
  seasonLongCompetitionFormat:
    | "total_points"
    | "head_to_head"
) {
  if (
    leagueType ===
    "traditional"
  ) {
    return "TRAD";
  }

  if (
    leagueType ===
    "season_long"
  ) {
    return seasonLongCompetitionFormat ===
      "head_to_head"
      ? "SL-H2H"
      : "SL-TP";
  }

  if (
    leagueType ===
    "nfl_playoffs"
  ) {
    return "NFLP";
  }

  if (
    leagueType ===
    "pickem"
  ) {
    return "PICK'EM";
  }

  return "G365";
}


function getMobileSelectionModeLabel(
  leagueType:
    string,
  playerSelectionMode:
    string
) {
  if (
    leagueType ===
    "traditional"
  ) {
    return null;
  }

  if (
    playerSelectionMode ===
    "salary"
  ) {
    return "SAL";
  }

  if (
    playerSelectionMode ===
    "no_salary"
  ) {
    return "NO SAL";
  }

  return null;
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


  const isNflPlayoffs =
    league.leagueType ===
    "nfl_playoffs";


  const isPickem =
    league.leagueType ===
    "pickem";


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


  const leagueTypeLabel =
    getLeagueTypeLabel(
      league.leagueType,
      league.playerSelectionMode
    );


  const selectionModeLabel =
    getSelectionModeLabel(
      league.leagueType,
      league.playerSelectionMode
    );


  const mobileLeagueTypeLabel =
    getMobileLeagueTypeLabel(
      league.leagueType,
      seasonLongCompetitionFormat
    );


  const mobileSelectionModeLabel =
    getMobileSelectionModeLabel(
      league.leagueType,
      league.playerSelectionMode
    );


  const primaryActionLabel =
    isTraditional
      ? "My Team"
      : isSeasonLong ||
          isNflPlayoffs
        ? "My Entry"
        : isPickem
          ? "My Picks"
          : "League Home";


  const primaryActionHref =
    isTraditional
      ? `/league/${leagueId}/team`
      : isSeasonLong ||
          isNflPlayoffs
        ? `/league/${leagueId}/entry`
        : isPickem
          ? `/league/${leagueId}/pickem/my-picks`
          : `/league/${leagueId}`;


  return (
    <div
      className="g365-league-shell"
    >
      {/* ==================================================
          TRADITIONAL REALTIME ONLY
      =================================================== */}

      {isTraditional ? (
        <TraditionalLiveRefresh
          leagueId={
            leagueId
          }
          mode="league"
        />
      ) : null}


      {/* ==================================================
          COMPACT LEAGUE HEADER
      =================================================== */}

      <header
        className="g365-league-header"
      >
        {/* LOGO */}

        <div
          className="g365-league-logo-wrap"
        >
          <Link
            href={`/league/${leagueId}`}
            aria-label="Gridiron365 League Home"
          >
            <Image
              src="/branding/gridiron365-logo-full.png"
              alt="Gridiron365"
              width={300}
              height={170}
              priority
              className="g365-league-logo"
            />
          </Link>
        </div>


        {/* LEAGUE */}

        <div
          className="g365-league-identity"
        >
          <div
            className="g365-league-badges"
          >
            <span
              className="g365-league-badge"
            >
              <span className="g365-header-label-desktop">
                {leagueTypeLabel}
              </span>
              <span className="g365-header-label-mobile">
                {mobileLeagueTypeLabel}
              </span>
            </span>


            {selectionModeLabel ? (
              <span
                className="
                  g365-league-badge
                  g365-league-badge-muted
                "
              >
                <span className="g365-header-label-desktop">
                  {selectionModeLabel}
                </span>
                <span className="g365-header-label-mobile">
                  {mobileSelectionModeLabel}
                </span>
              </span>
            ) : null}


            <span
              className="
                g365-league-badge
                g365-league-badge-muted
              "
            >
              {league.season}
            </span>


            {isCommissioner ? (
              <span
                className="g365-league-badge"
              >
                <span className="g365-header-label-desktop">
                  COMMISSIONER
                </span>
                <span className="g365-header-label-mobile">
                  COMMISH
                </span>
              </span>
            ) : null}
          </div>


          <h1
            className="g365-league-title"
          >
            {league.name}
          </h1>


          {fantasyTeam ? (
            <span
              className="g365-league-team"
            >
              {fantasyTeam.teamName}
            </span>
          ) : (
            <span
              className="g365-league-team"
            >
              League Member
            </span>
          )}
        </div>


        {/* ACTIONS */}

        <div
          className="g365-league-actions"
        >
          <Link
            href="/my-leagues"
            className="g365-league-action"
          >
            My Leagues
          </Link>


          {fantasyTeam ? (
            <Link
              href={
                primaryActionHref
              }
              className="
                g365-league-action
                g365-league-action-primary
              "
            >
              {primaryActionLabel}
            </Link>
          ) : null}
        </div>
      </header>


      {/* ==================================================
          LEAGUE NAVIGATION
      =================================================== */}

      {isTraditional ? (
        <TraditionalLeagueNav
          leagueId={
            leagueId
          }
          isCommissioner={
            isCommissioner
          }
        />
      ) : null}


      {isSeasonLong ? (
        <SeasonLongLeagueNav
          leagueId={
            leagueId
          }
          isCommissioner={
            isCommissioner
          }
          competitionFormat={
            seasonLongCompetitionFormat
          }
          playoffsEnabled={
            seasonLongPlayoffsEnabled
          }
        />
      ) : null}


      {isPickem ? (
        <PickemLeagueNav
          leagueId={leagueId}
          isCommissioner={
            isCommissioner
          }
        />
      ) : null}


      {isNflPlayoffs ? (
        <NflPlayoffsLeagueNav
          leagueId={
            leagueId
          }
          season={
            league.season
          }
          isCommissioner={
            isCommissioner
          }
        />
      ) : null}


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
