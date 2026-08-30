import Image from "next/image";
import Link from "next/link";

import {
  notFound,
  redirect,
} from "next/navigation";

import SeasonLongLeagueNav from "@/components/season-long/SeasonLongLeagueNav";
import PickemLeagueNav from "@/components/pickem/PickemLeagueNav";

import TraditionalLeagueNav from "@/components/traditional/TraditionalLeagueNav";
import TraditionalLiveRefresh from "@/components/traditional/TraditionalLiveRefresh";

import {
  requireLeagueMember,
} from "@/lib/leagues/requireLeagueMember";

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


  const primaryActionLabel =
    isTraditional
      ? "My Team"
      : isSeasonLong
        ? "My Entry"
        : isPickem
          ? "My Picks"
          : "League Home";


  const primaryActionHref =
    isTraditional
      ? `/league/${leagueId}/team`
      : isSeasonLong
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
              {leagueTypeLabel}
            </span>


            {selectionModeLabel ? (
              <span
                className="
                  g365-league-badge
                  g365-league-badge-muted
                "
              >
                {selectionModeLabel}
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
                COMMISSIONER
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
        <nav
          aria-label="NFL Playoffs League Navigation"
          style={{
            display:
              "flex",

            flexWrap:
              "wrap",

            gap:
              "10px",

            padding:
              "10px 18px",

            borderTop:
              "1px solid rgba(255,255,255,0.07)",

            borderBottom:
              "1px solid rgba(255,255,255,0.08)",

            background:
              "rgba(8,8,10,0.94)",
          }}
        >
          <Link
            href={`/league/${leagueId}`}
            className="g365-league-action"
          >
            Home
          </Link>
        </nav>
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
