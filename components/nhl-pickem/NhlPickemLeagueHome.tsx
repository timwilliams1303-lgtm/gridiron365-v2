import Link from "next/link";

import {
  createSupabaseServerClient,
} from "@/lib/supabase/server";

import {
  requireLeagueMember,
} from "@/lib/leagues/requireLeagueMember";


type Props = {
  leagueId: string;
};


type NhlPickemSettingsRow = {
  picks_per_period: number;
  market_mode: string;
  pick_lock_mode: string;
  minimum_source_books: number;
  scoring_mode: string;
};


type NhlPickemPeriodRow = {
  id: number;
  league_id: string;
  season: number;
  period_number: number;
  starts_at: string;
  ends_at: string;
  status: string;
  finalized_at: string | null;
};


type NhlPickemEntryRow = {
  id: number;
  league_id: string;
  fantasy_team_id: number;
  season: number;
  entry_name: string;
  active: boolean;
};


type NhlPickemPeriodResultRow = {
  required_picks: number;
  submitted_picks: number;
  missing_picks: number;
  wins: number;
  pushes: number;
  losses: number;
  ungraded: number;
  points: number | string;
  rank: number | null;
  is_period_winner: boolean;
};


function formatMarketMode(
  value: string
) {
  if (
    value === "puck_line_only"
  ) {
    return "Puck Line";
  }

  if (
    value === "total_only"
  ) {
    return "Game Totals";
  }

  return "Puck Line + Totals";
}


function formatLockMode(
  value: string
) {
  if (
    value === "period"
  ) {
    return "Full Period Lock";
  }

  return "Each Pick Locks at Game Start";
}


function formatScoringMode(
  value: string
) {
  if (
    value === "confidence"
  ) {
    return "Confidence Points";
  }

  if (
    value === "standard"
  ) {
    return "Points Scoring";
  }

  return "Record Only";
}


function formatPeriodDates(
  startsAt: string,
  endsAt: string
) {
  const formatter =
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone:
          "America/New_York",
        month: "short",
        day: "numeric",
      }
    );

  return `${formatter.format(
    new Date(startsAt)
  )} – ${formatter.format(
    new Date(endsAt)
  )}`;
}


export default async function NhlPickemLeagueHome({
  leagueId,
}: Props) {
  const access =
    await requireLeagueMember(
      leagueId
    );

  const supabase =
    await createSupabaseServerClient();

  const {
    data: settingsData,
  } = await supabase
    .from("nhl_pickem_settings")
    .select(
      [
        "picks_per_period",
        "market_mode",
        "pick_lock_mode",
        "minimum_source_books",
        "scoring_mode",
      ].join(",")
    )
    .eq(
      "league_id",
      leagueId
    )
    .maybeSingle();

  const settings =
    settingsData as
      | NhlPickemSettingsRow
      | null;


  /*
   * Find the current NHL Pick'em
   * period.
   *
   * Prefer the first period that
   * is not final. If the season is
   * complete, fall back to the most
   * recently finalized period.
   */
  const {
    data: openPeriodData,
  } = await supabase
    .from("nhl_pickem_periods")
    .select(
      [
        "id",
        "league_id",
        "season",
        "period_number",
        "starts_at",
        "ends_at",
        "status",
        "finalized_at",
      ].join(",")
    )
    .eq(
      "league_id",
      leagueId
    )
    .neq(
      "status",
      "final"
    )
    .order(
      "period_number",
      {
        ascending: true,
      }
    )
    .limit(1)
    .maybeSingle();

  let currentPeriod =
    openPeriodData as
      | NhlPickemPeriodRow
      | null;

  if (!currentPeriod) {
    const {
      data: latestFinalData,
    } = await supabase
      .from(
        "nhl_pickem_periods"
      )
      .select(
        [
          "id",
          "league_id",
          "season",
          "period_number",
          "starts_at",
          "ends_at",
          "status",
          "finalized_at",
        ].join(",")
      )
      .eq(
        "league_id",
        leagueId
      )
      .eq(
        "status",
        "final"
      )
      .order(
        "period_number",
        {
          ascending: false,
        }
      )
      .limit(1)
      .maybeSingle();

    currentPeriod =
      latestFinalData as
        | NhlPickemPeriodRow
        | null;
  }


  const fantasyTeamId =
    access.fantasyTeam?.id ??
    null;


  /*
   * Resolve this member's NHL
   * Pick'em entry.
   *
   * NHL Pick'em entries are
   * season-specific, so when a
   * current period exists we match
   * its season directly.
   */
  let entry:
    | NhlPickemEntryRow
    | null = null;

  if (fantasyTeamId) {
    let entryQuery =
      supabase
        .from(
          "nhl_pickem_entries"
        )
        .select(
          [
            "id",
            "league_id",
            "fantasy_team_id",
            "season",
            "entry_name",
            "active",
          ].join(",")
        )
        .eq(
          "league_id",
          leagueId
        )
        .eq(
          "fantasy_team_id",
          fantasyTeamId
        )
        .eq(
          "active",
          true
        );

    if (currentPeriod) {
      entryQuery =
        entryQuery.eq(
          "season",
          currentPeriod.season
        );
    }

    const {
      data: entryData,
    } = await entryQuery
      .order(
        "season",
        {
          ascending: false,
        }
      )
      .limit(1)
      .maybeSingle();

    entry =
      entryData as
        | NhlPickemEntryRow
        | null;
  }


  let selectedPicks = 0;
  let requiredPicks =
    settings?.picks_per_period ??
    5;

  let wins = 0;
  let losses = 0;
  let pushes = 0;
  let points = 0;
  let rank: number | null =
    null;
  let isPeriodWinner =
    false;


  /*
   * Count the member's active
   * selections for the current
   * period.
   */
  if (
    currentPeriod &&
    entry
  ) {
    const {
      count,
    } = await supabase
      .from(
        "nhl_pickem_picks"
      )
      .select(
        "id",
        {
          count: "exact",
          head: true,
        }
      )
      .eq(
        "league_id",
        leagueId
      )
      .eq(
        "nhl_pickem_period_id",
        currentPeriod.id
      )
      .eq(
        "entry_id",
        entry.id
      )
      .neq(
        "result",
        "void"
      );

    selectedPicks =
      count ?? 0;


    /*
     * Period results may not exist
     * until grading/finalization has
     * begun. That is normal.
     */
    const {
      data: resultData,
    } = await supabase
      .from(
        "nhl_pickem_period_results"
      )
      .select(
        [
          "required_picks",
          "submitted_picks",
          "missing_picks",
          "wins",
          "pushes",
          "losses",
          "ungraded",
          "points",
          "rank",
          "is_period_winner",
        ].join(",")
      )
      .eq(
        "league_id",
        leagueId
      )
      .eq(
        "nhl_pickem_period_id",
        currentPeriod.id
      )
      .eq(
        "entry_id",
        entry.id
      )
      .maybeSingle();

    const result =
      resultData as
        | NhlPickemPeriodResultRow
        | null;

    if (result) {
      requiredPicks =
        Number(
          result.required_picks
        ) ||
        requiredPicks;

      wins =
        Number(
          result.wins
        ) || 0;

      losses =
        Number(
          result.losses
        ) || 0;

      pushes =
        Number(
          result.pushes
        ) || 0;

      points =
        Number(
          result.points
        ) || 0;

      rank =
        result.rank;

      isPeriodWinner =
        Boolean(
          result.is_period_winner
        );
    }
  }


  const periodLabel =
    currentPeriod
      ? `Period ${currentPeriod.period_number}`
      : "Not Open Yet";

  const periodDates =
    currentPeriod
      ? formatPeriodDates(
          currentPeriod.starts_at,
          currentPeriod.ends_at
        )
      : null;

  const scoringMode =
    settings?.scoring_mode ??
    "record_only";

  const marketMode =
    settings?.market_mode ??
    "puck_line_and_total";

  const pickLockMode =
    settings?.pick_lock_mode ??
    "game";

  const record =
    `${wins}-${losses}${
      pushes
        ? `-${pushes}`
        : ""
    }`;

  const root =
    `/league/${leagueId}/nhl-pickem`;


  return (
    <main
      className="g365-nhl-pickem-home"
      style={{
        display: "grid",
        gap: 18,
        padding:
          "22px 18px 34px",
        width: "100%",
        minWidth: 0,
      }}
    >
      <style>{`
        .g365-nhl-pickem-home * {
          box-sizing: border-box;
        }

        @media (max-width: 760px) {
          .g365-nhl-pickem-home {
            width: 100% !important;
            max-width: 100% !important;
            min-width: 0 !important;
            padding: 14px 12px 28px !important;
            gap: 14px !important;
            overflow-x: hidden;
          }

          .g365-nhl-pickem-home > section {
            min-width: 0;
            max-width: 100%;
          }

          .g365-nhl-pickem-home .g365-nhl-pickem-home-hero {
            padding: 17px !important;
            border-radius: 15px !important;
          }

          .g365-nhl-pickem-home .g365-nhl-pickem-home-stats {
            grid-template-columns:
              repeat(
                2,
                minmax(0,1fr)
              ) !important;
            gap: 9px !important;
          }

          .g365-nhl-pickem-home .g365-nhl-pickem-home-links {
            grid-template-columns:
              minmax(
                0,
                1fr
              ) !important;
            gap: 9px !important;
          }

          .g365-nhl-pickem-home .g365-nhl-pickem-home-stat {
            padding: 13px !important;
            min-width: 0;
          }

          .g365-nhl-pickem-home .g365-nhl-pickem-home-link {
            padding: 15px !important;
            min-width: 0;
          }

          .g365-nhl-pickem-home h2 {
            font-size:
              clamp(
                29px,
                9vw,
                38px
              ) !important;
            line-height:
              1.03 !important;
          }

          .g365-nhl-pickem-home p,
          .g365-nhl-pickem-home div,
          .g365-nhl-pickem-home strong {
            overflow-wrap: anywhere;
          }
        }

        @media (max-width: 430px) {
          .g365-nhl-pickem-home {
            padding:
              12px 10px 24px !important;
          }

          .g365-nhl-pickem-home .g365-nhl-pickem-home-stats {
            grid-template-columns:
              minmax(
                0,
                1fr
              ) !important;
          }
        }
      `}</style>


      <section
        className="g365-nhl-pickem-home-hero"
        style={{
          padding: 22,
          borderRadius: 18,
          border:
            "1px solid rgba(255,102,0,0.28)",
          background:
            "linear-gradient(135deg, rgba(105,7,12,0.42), rgba(20,20,24,0.96) 48%, rgba(132,48,0,0.28))",
          boxShadow:
            "0 20px 50px rgba(0,0,0,0.28)",
        }}
      >
        <div
          style={{
            color: "#ff7627",
            fontSize: 12,
            fontWeight: 1000,
            letterSpacing:
              "0.12em",
            textTransform:
              "uppercase",
          }}
        >
          G365 NHL Pick&apos;em
        </div>

        <h2
          style={{
            margin:
              "7px 0 8px",
            color: "white",
            fontSize:
              "clamp(28px, 5vw, 46px)",
            lineHeight: 1,
          }}
        >
          Beat the G365 Hockey
          Lines.
        </h2>

        <p
          style={{
            margin: 0,
            maxWidth: 760,
            color: "#b9b9bf",
            lineHeight: 1.65,
          }}
        >
          Make{" "}
          <strong
            style={{
              color: "#fff",
            }}
          >
            {requiredPicks}
          </strong>{" "}
          selections during each NHL
          Pick&apos;em period using
          the official frozen G365
          puck lines and game totals.
          Each selection remains
          private until its game
          reaches its start time.
        </p>

        {periodDates ? (
          <div
            style={{
              marginTop: 14,
              color: "#8f8f98",
              fontSize: 12,
              fontWeight: 850,
              letterSpacing:
                "0.05em",
              textTransform:
                "uppercase",
            }}
          >
            {periodLabel}
            {" · "}
            {periodDates}
          </div>
        ) : null}
      </section>


      <section
        className="g365-nhl-pickem-home-stats"
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit,minmax(180px,1fr))",
          gap: 12,
        }}
      >
        {[
          [
            "Current Period",
            periodLabel,
          ],
          [
            "Your Picks",
            `${selectedPicks} / ${requiredPicks}`,
          ],
          [
            "Live Record",
            record,
          ],
          [
            "Markets",
            formatMarketMode(
              marketMode
            ),
          ],
        ].map(
          ([
            label,
            value,
          ]) => (
            <div
              className="g365-nhl-pickem-home-stat"
              key={label}
              style={{
                padding: 16,
                borderRadius: 14,
                border:
                  "1px solid rgba(255,255,255,0.08)",
                background:
                  "#111115",
              }}
            >
              <div
                style={{
                  color:
                    "#8f8f98",
                  fontSize: 11,
                  fontWeight: 900,
                  letterSpacing:
                    "0.08em",
                  textTransform:
                    "uppercase",
                }}
              >
                {label}
              </div>

              <div
                style={{
                  marginTop: 7,
                  color: "#fff",
                  fontSize: 20,
                  fontWeight: 950,
                }}
              >
                {value}
              </div>
            </div>
          )
        )}
      </section>


      {scoringMode !==
      "record_only" ? (
        <section
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit,minmax(180px,1fr))",
            gap: 12,
          }}
        >
          <div
            style={{
              padding: 16,
              borderRadius: 14,
              border:
                "1px solid rgba(255,255,255,0.08)",
              background:
                "#111115",
            }}
          >
            <div
              style={{
                color: "#8f8f98",
                fontSize: 11,
                fontWeight: 900,
                letterSpacing:
                  "0.08em",
                textTransform:
                  "uppercase",
              }}
            >
              Points
            </div>

            <div
              style={{
                marginTop: 7,
                color: "#fff",
                fontSize: 20,
                fontWeight: 950,
              }}
            >
              {points}
            </div>
          </div>

          <div
            style={{
              padding: 16,
              borderRadius: 14,
              border:
                "1px solid rgba(255,255,255,0.08)",
              background:
                "#111115",
            }}
          >
            <div
              style={{
                color: "#8f8f98",
                fontSize: 11,
                fontWeight: 900,
                letterSpacing:
                  "0.08em",
                textTransform:
                  "uppercase",
              }}
            >
              Scoring
            </div>

            <div
              style={{
                marginTop: 7,
                color: "#fff",
                fontSize: 20,
                fontWeight: 950,
              }}
            >
              {formatScoringMode(
                scoringMode
              )}
            </div>
          </div>

          <div
            style={{
              padding: 16,
              borderRadius: 14,
              border:
                isPeriodWinner
                  ? "1px solid rgba(43,202,123,0.50)"
                  : "1px solid rgba(255,255,255,0.08)",
              background:
                isPeriodWinner
                  ? "rgba(22,106,67,0.18)"
                  : "#111115",
            }}
          >
            <div
              style={{
                color: "#8f8f98",
                fontSize: 11,
                fontWeight: 900,
                letterSpacing:
                  "0.08em",
                textTransform:
                  "uppercase",
              }}
            >
              Period Rank
            </div>

            <div
              style={{
                marginTop: 7,
                color:
                  isPeriodWinner
                    ? "#6ee7a8"
                    : "#fff",
                fontSize: 20,
                fontWeight: 950,
              }}
            >
              {rank
                ? `#${rank}`
                : "—"}
            </div>
          </div>
        </section>
      ) : null}


      <section
        className="g365-nhl-pickem-home-links"
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit,minmax(220px,1fr))",
          gap: 12,
        }}
      >
        {[
          [
            "My Picks",
            `Choose your ${requiredPicks} NHL selections for the current period.`,
            `${root}/my-picks`,
          ],
          [
            "League Picks",
            "See league selections as each game's picks become eligible to be revealed.",
            `${root}/league-picks`,
          ],
          [
            "Games",
            "Follow NHL scores, period, game clock and the status of the official G365 lines.",
            `${root}/games`,
          ],
          [
            "Standings",
            "Track NHL Pick'em records, points and period wins across the season.",
            `${root}/standings`,
          ],
        ].map(
          ([
            title,
            description,
            href,
          ]) => (
            <Link
              className="g365-nhl-pickem-home-link"
              key={href}
              href={href}
              style={{
                display: "block",
                padding: 18,
                borderRadius: 14,
                border:
                  "1px solid rgba(255,255,255,0.09)",
                background:
                  "linear-gradient(180deg,#151519,#0e0e11)",
                color: "inherit",
                textDecoration:
                  "none",
              }}
            >
              <div
                style={{
                  color: "#fff",
                  fontSize: 18,
                  fontWeight: 950,
                }}
              >
                {title}
              </div>

              <div
                style={{
                  marginTop: 7,
                  color: "#9f9fa7",
                  lineHeight: 1.5,
                }}
              >
                {description}
              </div>
            </Link>
          )
        )}
      </section>


      <section
        style={{
          padding: 16,
          borderRadius: 14,
          border:
            "1px solid rgba(255,255,255,0.08)",
          background:
            "#0f0f12",
          color: "#aaaab2",
          lineHeight: 1.6,
        }}
      >
        <strong
          style={{
            color: "white",
          }}
        >
          League rules:
        </strong>{" "}
        {formatMarketMode(
          marketMode
        )}.{" "}
        {formatLockMode(
          pickLockMode
        )}.{" "}
        Official G365 lines are
        created from qualifying
        sportsbook sources and frozen
        before the applicable NHL
        games. Once frozen, the line
        attached to a member&apos;s
        selection does not change.
      </section>
    </main>
  );
}