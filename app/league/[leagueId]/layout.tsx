import Image from "next/image";
import Link from "next/link";

import {
  notFound,
  redirect,
} from "next/navigation";

import TraditionalLeagueNav from "@/components/traditional/TraditionalLeagueNav";
import TraditionalLiveRefresh from "@/components/traditional/TraditionalLiveRefresh";

import {
  requireTraditionalLeague,
} from "@/lib/traditional/requireTraditionalLeague";

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


export default async function TraditionalLeagueLayout({
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
   *
   * Prevent paths such as:
   *
   * /league/commissioner
   * /league/settings
   * /league/draft
   *
   * from ever being sent to Supabase as league UUIDs.
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


  const access =
    await requireTraditionalLeague(
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


  return (
    <div
      className="g365-league-shell"
    >
      {/* ==================================================
          MATCHUPS LEAGUE-SCOPED REALTIME
          Invisible and only activates on matchup routes.
      =================================================== */}

      <TraditionalLiveRefresh
        leagueId={
          leagueId
        }
        mode="league"
      />


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
              TRADITIONAL
            </span>


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
              href={`/league/${leagueId}/team`}
              className="
                g365-league-action
                g365-league-action-primary
              "
            >
              My Team
            </Link>
          ) : null}
        </div>
      </header>


      {/* ==================================================
          LEAGUE NAV
      =================================================== */}

      <TraditionalLeagueNav
        leagueId={
          leagueId
        }
        isCommissioner={
          isCommissioner
        }
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
