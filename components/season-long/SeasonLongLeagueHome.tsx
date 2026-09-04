import Link from "next/link";

import Card from "@/components/ui/Card";

import {
  createSupabaseServerClient,
} from "@/lib/supabase/server";

import {
  requireLeagueMember,
} from "@/lib/leagues/requireLeagueMember";


type SeasonLongLeagueHomeProps = {
  leagueId: string;
};


function formatPoints(
  value:
    | number
    | string
    | null
    | undefined
) {
  const parsed =
    Number(
      value ?? 0
    );

  return Number.isFinite(
    parsed
  )
    ? parsed.toFixed(2)
    : "0.00";
}


function formatMoney(
  value:
    | number
    | string
    | null
    | undefined
) {
  const parsed =
    Number(
      value ?? 0
    );

  if (
    !Number.isFinite(
      parsed
    )
  ) {
    return "$0";
  }

  return new Intl.NumberFormat(
    "en-US",
    {
      style:
        "currency",
      currency:
        "USD",
      maximumFractionDigits:
        0,
    }
  ).format(
    parsed
  );
}


function formatStatus(
  value:
    string
    | null
    | undefined
) {
  if (
    !value
  ) {
    return "Not Started";
  }

  return value
    .replaceAll(
      "_",
      " "
    )
    .replace(
      /\b\w/g,
      (
        character
      ) =>
        character.toUpperCase()
    );
}


export default async function SeasonLongLeagueHome({
  leagueId,
}: SeasonLongLeagueHomeProps) {
  const access =
    await requireLeagueMember(
      leagueId
    );


  if (
    access.league.leagueType !==
      "season_long"
  ) {
    throw new Error(
      "This page is only available for Season-Long leagues."
    );
  }


  const supabase =
    await createSupabaseServerClient();


  const fantasyTeamId =
    access.fantasyTeam
      ?.id ??
    null;


  /*
   * Keep the home dashboard on the exact same lifecycle week as My Entry.
   * Future prepared entries must never become the dashboard's "current" week.
   */
  const activeWeekResult =
    await supabase.rpc(
      "get_active_season_long_week",
      {
        p_season:
          access.league.season,
      }
    );


  if (
    activeWeekResult.error
  ) {
    throw new Error(
      `Could not resolve active Season-Long week: ${activeWeekResult.error.message}`
    );
  }


  const activeWeekValue =
    Number(
      activeWeekResult.data
    );


  const currentWeek =
    Number.isInteger(
      activeWeekValue
    ) &&
    activeWeekValue > 0
      ? activeWeekValue
      : 1;


  const [
    settingsResult,
    entryResult,
    standingsResult,
    scoreResult,
    teamCountResult,
    lineupProjectionResult,
  ] =
    await Promise.all([
      supabase
        .from(
          "season_long_settings"
        )
        .select(`
          season,
          weekly_salary_cap,
          starting_qb,
          starting_rb,
          starting_wr,
          starting_te,
          starting_flex,
          starting_superflex,
          starting_k,
          starting_dst
        `)
        .eq(
          "league_id",
          leagueId
        )
        .maybeSingle(),

      fantasyTeamId
        ? supabase
            .from(
              "season_long_weekly_entries"
            )
            .select(`
              week,
              status,
              salary_used,
              projected_points,
              submitted_at,
              last_modified_at
            `)
            .eq(
              "league_id",
              leagueId
            )
            .eq(
              "fantasy_team_id",
              fantasyTeamId
            )
            .eq(
              "season",
              access.league.season
            )
            .eq(
              "week",
              currentWeek
            )
            .maybeSingle()
        : Promise.resolve({
            data:
              null,
            error:
              null,
          }),

      fantasyTeamId
        ? supabase
            .from(
              "season_long_standings"
            )
            .select(`
              total_points,
              weeks_scored,
              highest_week_score,
              lowest_week_score,
              average_week_score,
              current_rank
            `)
            .eq(
              "league_id",
              leagueId
            )
            .eq(
              "fantasy_team_id",
              fantasyTeamId
            )
            .eq(
              "season",
              access.league.season
            )
            .maybeSingle()
        : Promise.resolve({
            data:
              null,
            error:
              null,
          }),

      fantasyTeamId
        ? supabase
            .from(
              "season_long_weekly_scores"
            )
            .select(`
              week,
              fantasy_points,
              salary_used,
              lineup_player_count,
              is_final
            `)
            .eq(
              "league_id",
              leagueId
            )
            .eq(
              "fantasy_team_id",
              fantasyTeamId
            )
            .eq(
              "season",
              access.league.season
            )
            .eq(
              "week",
              currentWeek
            )
            .maybeSingle()
        : Promise.resolve({
            data:
              null,
            error:
              null,
          }),

      supabase
        .from(
          "fantasy_teams"
        )
        .select(
          "id",
          {
            count:
              "exact",
            head:
              true,
          }
        )
        .eq(
          "league_id",
          leagueId
        )
        .eq(
          "active",
          true
        ),

      fantasyTeamId
        ? supabase
            .from(
              "season_long_weekly_lineups"
            )
            .select(
              "projected_points_at_selection"
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
              "season",
              access.league.season
            )
            .eq(
              "week",
              currentWeek
            )
        : Promise.resolve({
            data:
              [],
            error:
              null,
          }),
    ]);


  if (
    settingsResult.error
  ) {
    throw new Error(
      `Could not load Season-Long settings: ${settingsResult.error.message}`
    );
  }


  if (
    entryResult.error
  ) {
    throw new Error(
      `Could not load Season-Long weekly entry: ${entryResult.error.message}`
    );
  }


  if (
    standingsResult.error
  ) {
    throw new Error(
      `Could not load Season-Long standings: ${standingsResult.error.message}`
    );
  }


  if (
    scoreResult.error
  ) {
    throw new Error(
      `Could not load Season-Long score: ${scoreResult.error.message}`
    );
  }


  if (
    teamCountResult.error
  ) {
    throw new Error(
      `Could not load Season-Long participants: ${teamCountResult.error.message}`
    );
  }


  if (
    lineupProjectionResult.error
  ) {
    throw new Error(
      `Could not load current lineup projections: ${lineupProjectionResult.error.message}`
    );
  }


  const settings =
    settingsResult.data;

  const entry =
    entryResult.data;

  const standings =
    standingsResult.data;

  const latestScore =
    scoreResult.data;

  const lineupProjectedPoints =
    (
      lineupProjectionResult.data ??
      []
    ).reduce(
      (
        total,
        row
      ) =>
        total +
        Number(
          row.projected_points_at_selection ??
          0
        ),
      0
    );


  const projectedPoints =
    (
      lineupProjectionResult.data ??
      []
    ).length > 0
      ? lineupProjectedPoints
      : Number(
          entry
            ?.projected_points ??
          0
        );

  const isSalary =
    access.league
      .playerSelectionMode ===
      "salary";

  const salaryCap =
    Number(
      settings
        ?.weekly_salary_cap ??
        0
    );

  const salaryUsed =
    Number(
      entry
        ?.salary_used ??
      latestScore
        ?.salary_used ??
      0
    );

  const salaryRemaining =
    Math.max(
      0,
      salaryCap -
        salaryUsed
    );

  const lineupSize =
    [
      settings
        ?.starting_qb,
      settings
        ?.starting_rb,
      settings
        ?.starting_wr,
      settings
        ?.starting_te,
      settings
        ?.starting_flex,
      settings
        ?.starting_superflex,
      settings
        ?.starting_k,
      settings
        ?.starting_dst,
    ].reduce(
      (
        total,
        value
      ) =>
        total +
        Number(
          value ?? 0
        ),
      0
    );


  return (
    <main
      className="g365-season-long-mobile"
      style={
        styles.page
      }
    >

      <style>{`
        .g365-season-long-mobile,
        .g365-season-long-mobile * {
          box-sizing: border-box;
        }

        @media (max-width: 760px) {
          .g365-season-long-mobile {
            width: 100% !important;
            max-width: 100% !important;
            min-width: 0 !important;
            padding-left: 12px !important;
            padding-right: 12px !important;
            overflow-x: hidden !important;
          }

          .g365-season-long-mobile section,
          .g365-season-long-mobile article,
          .g365-season-long-mobile header,
          .g365-season-long-mobile form,
          .g365-season-long-mobile div {
            min-width: 0;
            max-width: 100%;
          }

          .g365-season-long-mobile h1 {
            font-size: clamp(27px, 8vw, 36px) !important;
            line-height: 1.08 !important;
            overflow-wrap: anywhere;
          }

          .g365-season-long-mobile h2,
          .g365-season-long-mobile h3,
          .g365-season-long-mobile p,
          .g365-season-long-mobile span,
          .g365-season-long-mobile strong {
            overflow-wrap: anywhere;
          }

          .g365-season-long-mobile input,
          .g365-season-long-mobile select,
          .g365-season-long-mobile textarea {
            width: 100% !important;
            max-width: 100% !important;
            min-width: 0 !important;
            font-size: 16px !important;
          }

          .g365-season-long-mobile button,
          .g365-season-long-mobile a {
            max-width: 100%;
          }

          .g365-season-long-mobile :not(button)[style*="grid-template-columns"] {
            grid-template-columns: minmax(0, 1fr) !important;
          }

          .g365-season-long-mobile [style*="white-space: nowrap"],
          .g365-season-long-mobile [style*="white-space:nowrap"] {
            white-space: normal !important;
          }

          .g365-season-long-mobile [style*="overflow-x: auto"],
          .g365-season-long-mobile [style*="overflowX: auto"] {
            max-width: 100%;
            -webkit-overflow-scrolling: touch;
          }
        }

        @media (max-width: 430px) {
          .g365-season-long-mobile {
            padding-left: 10px !important;
            padding-right: 10px !important;
          }

          .g365-season-long-mobile button {
            min-height: 42px;
          }
        }
      `}</style>

      <section
        style={
          styles.shell
        }
      >
        <header
          style={
            styles.pageHeader
          }
        >
          <div>
            <p
              style={
                styles.eyebrow
              }
            >
              {isSalary
                ? "SEASON-LONG SALARY CAP"
                : "SEASON-LONG NO SALARY CAP"}
            </p>

            <h1
              style={
                styles.title
              }
            >
              {access.league.name}
            </h1>

            <p
              style={
                styles.subtitle
              }
            >
              {access.league.season}
              {" • "}
              {access.fantasyTeam
                ?.teamName ??
                "No Entry Assigned"}
            </p>
          </div>

          <div
            style={
              styles.headerStatusGroup
            }
          >
            <div
              style={
                styles.statusBox
              }
            >
              <span
                style={
                  styles.statusLabel
                }
              >
                CURRENT WEEK
              </span>

              <strong
                style={
                  styles.statusValue
                }
              >
                Week{" "}
                {currentWeek}
              </strong>
            </div>

            <div
              style={
                styles.statusBox
              }
            >
              <span
                style={
                  styles.statusLabel
                }
              >
                LINEUP STATUS
              </span>

              <strong
                style={
                  styles.statusValue
                }
              >
                {formatStatus(
                  entry?.status
                )}
              </strong>
            </div>
          </div>
        </header>


        <section
          style={
            styles.statsGrid
          }
        >
          <Card
            style={
              styles.statCard
            }
          >
            <span
              style={
                styles.statLabel
              }
            >
              CURRENT RANK
            </span>

            <strong
              style={
                styles.statValue
              }
            >
              {standings
                ?.current_rank
                ? `#${standings.current_rank}`
                : "—"}
            </strong>

            <span
              style={
                styles.statSubtext
              }
            >
              {teamCountResult.count ??
                0}{" "}
              active entries
            </span>
          </Card>


          <Card
            style={
              styles.statCard
            }
          >
            <span
              style={
                styles.statLabel
              }
            >
              SEASON POINTS
            </span>

            <strong
              style={
                styles.statValue
              }
            >
              {formatPoints(
                standings
                  ?.total_points
              )}
            </strong>

            <span
              style={
                styles.statSubtext
              }
            >
              {standings
                ?.weeks_scored ??
                0}{" "}
              weeks scored
            </span>
          </Card>


          <Card
            style={
              styles.statCard
            }
          >
            <span
              style={
                styles.statLabel
              }
            >
              WEEK{" "}
              {currentWeek} SCORE
            </span>

            <strong
              style={
                styles.statValue
              }
            >
              {formatPoints(
                latestScore
                  ?.fantasy_points
              )}
            </strong>

            <span
              style={
                styles.statSubtext
              }
            >
              {latestScore
                ?.is_final
                ? "Final"
                : "Live / projected"}
            </span>
          </Card>


          <Card
            style={
              styles.statCard
            }
          >
            <span
              style={
                styles.statLabel
              }
            >
              PROJECTED POINTS
            </span>

            <strong
              style={
                styles.statValue
              }
            >
              {formatPoints(
                projectedPoints
              )}
            </strong>

            <span
              style={
                styles.statSubtext
              }
            >
              Current weekly lineup
            </span>
          </Card>
        </section>


        <section
          style={
            styles.dashboardGrid
          }
        >
          <Card
            style={
              styles.mainCard
            }
          >
            <div
              aria-hidden="true"
              style={
                styles.cardAccent
              }
            />

            <p
              style={
                styles.cardEyebrow
              }
            >
              WEEK{" "}
              {currentWeek}
            </p>

            <h2
              style={
                styles.cardTitle
              }
            >
              Weekly Lineup
            </h2>

            <div
              style={
                styles.summary
              }
            >
              <SummaryRow
                label="Status"
                value={
                  formatStatus(
                    entry?.status
                  )
                }
              />

              <SummaryRow
                label="Lineup Players"
                value={
                  String(
                    latestScore
                      ?.lineup_player_count ??
                    0
                  )
                }
              />

              <SummaryRow
                label="Required Slots"
                value={
                  String(
                    lineupSize
                  )
                }
              />

              <SummaryRow
                label="Projected Points"
                value={
                  formatPoints(
                    projectedPoints
                  )
                }
              />
            </div>

            <Link
              href={
                `/league/${leagueId}/entry`
              }
              style={
                styles.primaryAction
              }
            >
              Build / Edit Lineup →
            </Link>
          </Card>


          <Card
            style={
              styles.mainCard
            }
          >
            <div
              aria-hidden="true"
              style={
                styles.cardAccentOrange
              }
            />

            <p
              style={
                styles.cardEyebrow
              }
            >
              {isSalary
                ? "SALARY CAP"
                : "PLAYER SELECTION"}
            </p>

            <h2
              style={
                styles.cardTitle
              }
            >
              {isSalary
                ? "Weekly Budget"
                : "No Salary Cap"}
            </h2>

            {isSalary ? (
              <div
                style={
                  styles.summary
                }
              >
                <SummaryRow
                  label="Weekly Cap"
                  value={
                    formatMoney(
                      salaryCap
                    )
                  }
                />

                <SummaryRow
                  label="Salary Used"
                  value={
                    formatMoney(
                      salaryUsed
                    )
                  }
                />

                <SummaryRow
                  label="Remaining"
                  value={
                    formatMoney(
                      salaryRemaining
                    )
                  }
                />

                <SummaryRow
                  label="Mode"
                  value="Salary Cap"
                />
              </div>
            ) : (
              <div
                style={
                  styles.emptyFeature
                }
              >
                <strong>
                  No weekly salary cap
                </strong>

                <span>
                  Build your weekly lineup
                  from the eligible player
                  pool without salary
                  restrictions.
                </span>
              </div>
            )}
          </Card>


          <Card
            style={
              styles.mainCard
            }
          >
            <p
              style={
                styles.cardEyebrow
              }
            >
              SEASON
            </p>

            <h2
              style={
                styles.cardTitle
              }
            >
              Performance
            </h2>

            <div
              style={
                styles.summary
              }
            >
              <SummaryRow
                label="Average Week"
                value={
                  formatPoints(
                    standings
                      ?.average_week_score
                  )
                }
              />

              <SummaryRow
                label="Highest Week"
                value={
                  formatPoints(
                    standings
                      ?.highest_week_score
                  )
                }
              />

              <SummaryRow
                label="Lowest Week"
                value={
                  formatPoints(
                    standings
                      ?.lowest_week_score
                  )
                }
              />

              <SummaryRow
                label="Weeks Scored"
                value={
                  String(
                    standings
                      ?.weeks_scored ??
                    0
                  )
                }
              />
            </div>
          </Card>


          <Card
            style={
              styles.mainCard
            }
          >
            <p
              style={
                styles.cardEyebrow
              }
            >
              LEAGUE
            </p>

            <h2
              style={
                styles.cardTitle
              }
            >
              League Center
            </h2>

            <div
              style={
                styles.summary
              }
            >
              <SummaryRow
                label="Season"
                value={
                  String(
                    access.league
                      .season
                  )
                }
              />

              <SummaryRow
                label="Entries"
                value={
                  String(
                    teamCountResult
                      .count ??
                    0
                  )
                }
              />

              <SummaryRow
                label="Selection Mode"
                value={
                  isSalary
                    ? "Salary Cap"
                    : "No Salary Cap"
                }
              />

              <SummaryRow
                label="League Status"
                value={
                  formatStatus(
                    access.league
                      .status
                  )
                }
              />
            </div>
          </Card>
        </section>


        <section>
          <p
            style={
              styles.sectionLabel
            }
          >
            SEASON-LONG CENTER
          </p>

          <div
            style={
              styles.quickGrid
            }
          >
            <QuickLink
              href={
                `/league/${leagueId}/entry`
              }
              title="My Entry"
              subtitle="Build weekly lineup"
            />

            <QuickLink
              href={
                `/league/${leagueId}/players`
              }
              title="Players"
              subtitle={
                isSalary
                  ? "Salaries & player pool"
                  : "Weekly player pool"
              }
            />

            <QuickLink
              href={
                `/league/${leagueId}/standings`
              }
              title="Standings"
              subtitle="Season-long rankings"
            />

            <QuickLink
              href={
                `/league/${leagueId}/settings`
              }
              title="Settings"
              subtitle="League configuration"
            />

            {access.isCommissioner ? (
              <QuickLink
                href={
                  `/league/${leagueId}/commissioner`
                }
                title="Commissioner"
                subtitle="League controls"
              />
            ) : null}
          </div>
        </section>
      </section>
    </main>
  );
}


function SummaryRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div
      style={
        styles.summaryRow
      }
    >
      <span>
        {label}
      </span>

      <strong>
        {value}
      </strong>
    </div>
  );
}


function QuickLink({
  href,
  title,
  subtitle,
}: {
  href: string;
  title: string;
  subtitle: string;
}) {
  return (
    <Link
      href={
        href
      }
      style={
        styles.quickCard
      }
    >
      <strong>
        {title}
      </strong>

      <span
        style={
          styles.quickSubtitle
        }
      >
        {subtitle}
      </span>
    </Link>
  );
}


const styles = {
  page: {
    minHeight:
      "calc(100vh - 140px)",

    padding:
      "32px 18px 60px",

    background:
      "radial-gradient(circle at 50% 0%,rgba(255,67,0,.055),transparent 34%)",
  },

  shell: {
    width:
      "min(1240px,100%)",

    margin:
      "0 auto",

    display:
      "grid",

    gap:
      "28px",
  },

  pageHeader: {
    display:
      "flex",

    alignItems:
      "flex-end",

    justifyContent:
      "space-between",

    gap:
      "20px",

    flexWrap:
      "wrap" as const,
  },

  headerStatusGroup: {
    display:
      "flex",

    gap:
      "9px",

    flexWrap:
      "wrap" as const,
  },

  eyebrow: {
    margin:
      0,

    color:
      "#ff7a18",

    fontSize:
      "10px",

    fontWeight:
      900,

    letterSpacing:
      ".15em",
  },

  title: {
    margin:
      "7px 0 0",

    color:
      "#ffffff",

    fontSize:
      "36px",
  },

  subtitle: {
    margin:
      "8px 0 0",

    color:
      "#8f96a3",

    fontSize:
      "13px",
  },

  statusBox: {
    minWidth:
      "140px",

    padding:
      "12px 15px",

    display:
      "grid",

    gap:
      "4px",

    border:
      "1px solid rgba(255,140,0,.18)",

    borderRadius:
      "10px",

    background:
      "rgba(255,100,0,.05)",
  },

  statusLabel: {
    color:
      "#747a84",

    fontSize:
      "8px",

    fontWeight:
      900,

    letterSpacing:
      ".10em",
  },

  statusValue: {
    color:
      "#ff8c00",

    fontSize:
      "13px",
  },

  statsGrid: {
    display:
      "grid",

    gridTemplateColumns:
      "repeat(auto-fit,minmax(190px,1fr))",

    gap:
      "14px",
  },

  statCard: {
    minHeight:
      "145px",

    padding:
      "20px",

    display:
      "flex",

    flexDirection:
      "column" as const,

    gap:
      "8px",
  },

  statLabel: {
    color:
      "#757b85",

    fontSize:
      "9px",

    fontWeight:
      900,

    letterSpacing:
      ".10em",
  },

  statValue: {
    color:
      "#ffffff",

    fontSize:
      "29px",
  },

  statSubtext: {
    color:
      "#858b95",

    fontSize:
      "11px",
  },

  dashboardGrid: {
    display:
      "grid",

    gridTemplateColumns:
      "repeat(auto-fit,minmax(360px,1fr))",

    gap:
      "16px",
  },

  mainCard: {
    minHeight:
      "285px",

    padding:
      "23px",
  },

  cardAccent: {
    position:
      "absolute" as const,

    top:
      0,

    left:
      0,

    right:
      0,

    height:
      "3px",

    background:
      "linear-gradient(90deg,#e21d1d,#ff4500,#ff7700)",
  },

  cardAccentOrange: {
    position:
      "absolute" as const,

    top:
      0,

    left:
      0,

    right:
      0,

    height:
      "3px",

    background:
      "linear-gradient(90deg,#ff4500,#ff8c00)",
  },

  cardEyebrow: {
    margin:
      0,

    color:
      "#ff8c00",

    fontSize:
      "8px",

    fontWeight:
      900,

    letterSpacing:
      ".11em",
  },

  cardTitle: {
    margin:
      "5px 0 0",

    color:
      "#ffffff",

    fontSize:
      "20px",
  },

  summary: {
    display:
      "grid",

    marginTop:
      "18px",
  },

  summaryRow: {
    minHeight:
      "45px",

    display:
      "flex",

    alignItems:
      "center",

    justifyContent:
      "space-between",

    gap:
      "20px",

    borderBottom:
      "1px solid rgba(255,255,255,.06)",

    color:
      "#8f96a3",

    fontSize:
      "11px",
  },

  primaryAction: {
    display:
      "inline-flex",

    marginTop:
      "20px",

    padding:
      "11px 14px",

    borderRadius:
      "8px",

    background:
      "linear-gradient(90deg,#d71919,#ff4d00,#ff8a00)",

    color:
      "#ffffff",

    fontSize:
      "11px",

    fontWeight:
      900,

    textDecoration:
      "none",
  },

  emptyFeature: {
    minHeight:
      "145px",

    marginTop:
      "20px",

    padding:
      "22px",

    display:
      "grid",

    alignContent:
      "center",

    gap:
      "7px",

    border:
      "1px dashed rgba(255,255,255,.10)",

    borderRadius:
      "10px",

    color:
      "#ffffff",
  },

  sectionLabel: {
    margin:
      "0 0 11px",

    color:
      "#707681",

    fontSize:
      "9px",

    fontWeight:
      900,

    letterSpacing:
      ".12em",
  },

  quickGrid: {
    display:
      "grid",

    gridTemplateColumns:
      "repeat(auto-fit,minmax(155px,1fr))",

    gap:
      "11px",
  },

  quickCard: {
    minHeight:
      "82px",

    padding:
      "16px",

    display:
      "grid",

    alignContent:
      "center",

    gap:
      "5px",

    border:
      "1px solid rgba(255,255,255,.08)",

    borderRadius:
      "10px",

    background:
      "linear-gradient(145deg,#151515,#090909)",

    color:
      "#ffffff",

    textDecoration:
      "none",
  },

  quickSubtitle: {
    color:
      "#777e88",

    fontSize:
      "10px",
  },
};