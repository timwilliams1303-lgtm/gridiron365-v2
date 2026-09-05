import type {
  CSSProperties,
} from "react";

import Link from "next/link";

import {
  redirect,
} from "next/navigation";

import {
  createSupabaseServerClient,
} from "@/lib/supabase/server";

import {
  requireLeagueMember,
} from "@/lib/leagues/requireLeagueMember";

import NflPlayoffsCommissionerOperations
  from "@/components/nfl-playoffs/NflPlayoffsCommissionerOperations";


export const dynamic =
  "force-dynamic";

export const revalidate = 0;


type PageProps = {
  params:
    Promise<{
      leagueId:
        string;
    }>;
};


type StateRow = {
  active_round:
    number |
    null;

  status:
    string |
    null;

  champion_fantasy_team_id:
    number |
    null;

  completed_at:
    string |
    null;
};


type RoundRow = {
  round_number:
    number;

  round_key:
    string |
    null;

  round_name:
    string |
    null;

  nfl_week:
    number |
    null;

  status:
    string |
    null;

  opens_at:
    string |
    null;

  first_kickoff_at:
    string |
    null;

  last_scheduled_kickoff_at:
    string |
    null;

  finalized_at:
    string |
    null;
};


type SettingsRow = {
  weekly_salary_cap:
    number |
    string |
    null;

  starting_qb:
    number;

  starting_rb:
    number;

  starting_wr:
    number;

  starting_te:
    number;

  starting_flex:
    number;

  starting_superflex:
    number;

  starting_k:
    number;

  starting_dst:
    number;
};


type TeamRow = {
  id:
    number;

  team_name:
    string;

  active:
    boolean;
};


type EntryRow = {
  fantasy_team_id:
    number;

  round_number:
    number;

  status:
    string |
    null;

  submitted_at:
    string |
    null;
};


function normalizedStatus(
  value:
    string |
    null |
    undefined
) {
  return (
    value ??
    ""
  )
    .trim()
    .toLowerCase();
}


function prettyStatus(
  value:
    string |
    null |
    undefined
) {
  if (
    !value
  ) {
    return "Setup";
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


function isFinalRound(
  round:
    RoundRow
) {
  return Boolean(
    round.finalized_at
  ) ||
    [
      "final",
      "finalized",
      "complete",
      "completed",
    ].includes(
      normalizedStatus(
        round.status
      )
    );
}


function roundName(
  roundNumber:
    number
) {
  switch (
    roundNumber
  ) {
    case 1:
      return "Wild Card";

    case 2:
      return "Divisional";

    case 3:
      return "Conference Championships";

    case 4:
      return "Super Bowl";

    default:
      return `Round ${roundNumber}`;
  }
}


function formatDate(
  value:
    string |
    null
) {
  if (
    !value
  ) {
    return "TBD";
  }

  const date =
    new Date(
      value
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "TBD";
  }

  return new Intl.DateTimeFormat(
    "en-US",
    {
      weekday:
        "short",

      month:
        "short",

      day:
        "numeric",

      hour:
        "numeric",

      minute:
        "2-digit",

      timeZoneName:
        "short",
    }
  ).format(
    date
  );
}


function money(
  value:
    number |
    string |
    null |
    undefined
) {
  const amount =
    Number(
      value ??
      0
    );

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
    Number.isFinite(
      amount
    )
      ? amount
      : 0
  );
}


export default async function NflPlayoffsCommissionerPage({
  params,
}: PageProps) {
  const {
    leagueId,
  } =
    await params;

  /*
   * ============================================================
   * ACCESS
   * ============================================================
   */

  const access =
    await requireLeagueMember(
      leagueId
    );

  if (
    !access.isCommissioner
  ) {
    redirect(
      `/league/${leagueId}`
    );
  }

  if (
    access.league
      .leagueType !==
    "nfl_playoffs"
  ) {
    redirect(
      `/league/${leagueId}/commissioner`
    );
  }

  const supabase =
    await createSupabaseServerClient();

  const season =
    access.league
      .season;

  const isSalary =
    access.league
      .playerSelectionMode ===
    "salary";


  /*
   * ============================================================
   * LOAD COMMISSIONER STATE
   * ============================================================
   */

  const [
    stateResult,
    roundsResult,
    settingsResult,
    teamsResult,
    entriesResult,
  ] =
    await Promise.all([
      supabase
        .from(
          "nfl_playoff_league_state"
        )
        .select(`
          active_round,
          status,
          champion_fantasy_team_id,
          completed_at
        `)
        .eq(
          "league_id",
          leagueId
        )
        .eq(
          "season",
          season
        )
        .maybeSingle(),

      supabase
        .from(
          "nfl_playoff_rounds"
        )
        .select(`
          round_number,
          round_key,
          round_name,
          nfl_week,
          status,
          opens_at,
          first_kickoff_at,
          last_scheduled_kickoff_at,
          finalized_at
        `)
        .eq(
          "league_id",
          leagueId
        )
        .eq(
          "season",
          season
        )
        .order(
          "round_number",
          {
            ascending:
              true,
          }
        ),

      supabase
        .from(
          "nfl_playoff_settings"
        )
        .select(`
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
        .eq(
          "season",
          season
        )
        .maybeSingle(),

      supabase
        .from(
          "fantasy_teams"
        )
        .select(`
          id,
          team_name,
          active
        `)
        .eq(
          "league_id",
          leagueId
        )
        .eq(
          "active",
          true
        )
        .order(
          "team_name",
          {
            ascending:
              true,
          }
        ),

      supabase
        .from(
          "nfl_playoff_round_entries"
        )
        .select(`
          fantasy_team_id,
          round_number,
          status,
          submitted_at
        `)
        .eq(
          "league_id",
          leagueId
        )
        .eq(
          "season",
          season
        ),
    ]);


  if (
    stateResult.error
  ) {
    throw new Error(
      `Could not load NFL Playoffs state: ${stateResult.error.message}`
    );
  }

  if (
    roundsResult.error
  ) {
    throw new Error(
      `Could not load NFL Playoffs rounds: ${roundsResult.error.message}`
    );
  }

  if (
    settingsResult.error
  ) {
    throw new Error(
      `Could not load NFL Playoffs settings: ${settingsResult.error.message}`
    );
  }

  if (
    teamsResult.error
  ) {
    throw new Error(
      `Could not load NFL Playoffs teams: ${teamsResult.error.message}`
    );
  }

  if (
    entriesResult.error
  ) {
    throw new Error(
      `Could not load NFL Playoffs entries: ${entriesResult.error.message}`
    );
  }


  const state =
    stateResult.data as
      StateRow |
      null;

  const rounds =
    (
      roundsResult.data ??
      []
    ) as RoundRow[];

  const settings =
    settingsResult.data as
      SettingsRow |
      null;

  const teams =
    (
      teamsResult.data ??
      []
    ) as TeamRow[];

  const entries =
    (
      entriesResult.data ??
      []
    ) as EntryRow[];


  /*
   * ============================================================
   * DERIVED STATE
   * ============================================================
   */

  const activeRound =
    Number.isInteger(
      Number(
        state
          ?.active_round
      )
    ) &&
    Number(
      state
        ?.active_round
    ) >= 1 &&
    Number(
      state
        ?.active_round
    ) <= 4
      ? Number(
          state
            ?.active_round
        )
      : 1;


  const activeRoundRow =
    rounds.find(
      (
        round
      ) =>
        round.round_number ===
        activeRound
    ) ??
    null;


  const finalizedRounds =
    rounds.filter(
      isFinalRound
    );


  const leagueComplete =
    finalizedRounds.length >=
      4 ||
    Boolean(
      state
        ?.completed_at
    ) ||
    [
      "complete",
      "completed",
      "final",
      "finalized",
    ].includes(
      normalizedStatus(
        state
          ?.status
      )
    );


  const activeEntries =
    entries.filter(
      (
        entry
      ) =>
        entry.round_number ===
        activeRound
    );


  const submittedEntries =
    activeEntries.filter(
      (
        entry
      ) =>
        Boolean(
          entry.submitted_at
        ) ||
        [
          "submitted",
          "locked",
          "final",
          "finalized",
          "complete",
          "completed",
        ].includes(
          normalizedStatus(
            entry.status
          )
        )
    ).length;


  const starterCount =
    settings
      ? settings.starting_qb +
        settings.starting_rb +
        settings.starting_wr +
        settings.starting_te +
        settings.starting_flex +
        settings.starting_superflex +
        settings.starting_k +
        settings.starting_dst
      : 0;


  const championTeam =
    state
      ?.champion_fantasy_team_id
      ? teams.find(
          (
            team
          ) =>
            team.id ===
            state
              .champion_fantasy_team_id
        ) ??
        null
      : null;


  const activeRoundDisplay =
    leagueComplete
      ? "Complete"
      : activeRoundRow
          ?.round_name ??
        roundName(
          activeRound
        );


  return (
    <main
      className="g365-nflp-commissioner"
      style={
        styles.page
      }
    >
      <style>{`
        .g365-nflp-commissioner,
        .g365-nflp-commissioner * {
          box-sizing: border-box;
        }

        @media (max-width: 950px) {
          .g365-nflp-commissioner .hero {
            flex-direction: column !important;
            align-items: flex-start !important;
          }

          .g365-nflp-commissioner .summary-grid {
            grid-template-columns: repeat(2,minmax(0,1fr)) !important;
          }

          .g365-nflp-commissioner .tool-grid,
          .g365-nflp-commissioner .round-grid {
            grid-template-columns: repeat(2,minmax(0,1fr)) !important;
          }

          .g365-nflp-commissioner .two-col {
            grid-template-columns: 1fr !important;
          }
        }

        @media (max-width: 600px) {
          .g365-nflp-commissioner {
            padding: 12px 10px !important;
          }

          .g365-nflp-commissioner .summary-grid,
          .g365-nflp-commissioner .tool-grid,
          .g365-nflp-commissioner .round-grid {
            grid-template-columns: 1fr !important;
          }

          .g365-nflp-commissioner .hero-actions {
            width: 100% !important;
          }

          .g365-nflp-commissioner .hero-actions a {
            flex: 1 1 auto !important;
            text-align: center !important;
          }
        }
      `}</style>

      <section
        style={
          styles.shell
        }
      >
        {/* =====================================================
            HERO
            ===================================================== */}

        <header
          className="hero"
          style={
            styles.hero
          }
        >
          <div>
            <p
              style={
                styles.eyebrow
              }
            >
              G365 NFL PLAYOFFS · COMMISSIONER
            </p>

            <h1
              style={
                styles.title
              }
            >
              Commissioner Center
            </h1>

            <p
              style={
                styles.subtitle
              }
            >
              {
                access.league
                  .name
              }
              {" · "}
              {
                season
              }
              {" · "}
              {isSalary
                ? "Salary Cap"
                : "No Salary Cap"}
            </p>
          </div>

          <div
            className="hero-actions"
            style={
              styles.actions
            }
          >
            <Link
              href={`/league/${leagueId}/nfl-playoffs/settings`}
              style={
                styles.secondaryButton
              }
            >
              VIEW SETTINGS
            </Link>

            <Link
              href={`/league/${leagueId}/nfl-playoffs/standings`}
              style={
                styles.primaryButton
              }
            >
              VIEW STANDINGS
            </Link>
          </div>
        </header>


        {/* =====================================================
            STATUS SUMMARY
            ===================================================== */}

        <section
          className="summary-grid"
          style={
            styles.summaryGrid
          }
        >
          <Summary
            label="LEAGUE STATUS"
            value={
              prettyStatus(
                state
                  ?.status
              )
            }
            detail={
              leagueComplete
                ? "Postseason complete"
                : "NFL Playoffs lifecycle"
            }
          />

          <Summary
            label="ACTIVE ROUND"
            value={
              activeRoundDisplay
            }
            detail={
              leagueComplete
                ? "All four rounds finished"
                : `Round ${activeRound}`
            }
          />

          <Summary
            label="ROUNDS FINAL"
            value={`${finalizedRounds.length} / 4`}
            detail="Official finalized rounds"
          />

          <Summary
            label="ACTIVE TEAMS"
            value={
              String(
                teams.length
              )
            }
            detail="Teams currently in league"
          />

          <Summary
            label="ROUND ENTRIES"
            value={`${submittedEntries} / ${teams.length}`}
            detail={
              leagueComplete
                ? "Postseason completed"
                : "Submitted for active round"
            }
          />

          <Summary
            label="LINEUP SIZE"
            value={
              String(
                starterCount
              )
            }
            detail="Required starters each round"
          />

          {isSalary ? (
            <Summary
              label="SALARY CAP"
              value={
                money(
                  settings
                    ?.weekly_salary_cap
                )
              }
              detail="Per postseason lineup"
            />
          ) : (
            <Summary
              label="SELECTION MODE"
              value="No Salary"
              detail="No player salary restriction"
            />
          )}

          <Summary
            label="CHAMPION"
            value={
              championTeam
                ?.team_name ??
              "Not Yet"
            }
            detail={
              state
                ?.completed_at
                ? `Completed ${formatDate(
                    state.completed_at
                  )}`
                : "Awarded after Super Bowl finalization"
            }
          />
        </section>


        {/* =====================================================
            COMMISSIONER TOOLS
            ===================================================== */}

        <section
          style={
            styles.section
          }
        >
          <SectionHead
            eyebrow="LEAGUE MANAGEMENT"
            title="NFL Playoffs Controls"
            badge="COMMISSIONER ONLY"
          />

          <div
            className="tool-grid"
            style={
              styles.toolGrid
            }
          >
            <ToolCard
              title="League & Lineup Settings"
              description="Manage the official Salary/No-Salary mode, roster construction, salary cap, and four-round league rules."
              href={`/league/${leagueId}/commissioner/nfl-playoffs/settings`}
              action="MANAGE LINEUP"
            />

            {isSalary ? (
              <ToolCard
                title="Salary & Pricing"
                description="Manage NFL Playoffs salary ranges, position multipliers, movement limits, injury adjustments, and pricing behavior."
                href={`/league/${leagueId}/commissioner/nfl-playoffs/salary`}
                action="MANAGE SALARY"
              />
            ) : null}

            <ToolCard
              title="Scoring Settings"
              description="Manage the fantasy scoring rules used to score players throughout the NFL postseason."
              href={`/league/${leagueId}/commissioner/scoring`}
              action="MANAGE SCORING"
            />

            <ToolCard
              title="Teams & Members"
              description="Manage league ownership, invitations, team information, and member access."
              href={`/league/${leagueId}/commissioner/teams`}
              action="MANAGE TEAMS"
            />

            <ToolCard
              title="League Administration"
              description="Access commissioner-level administrative tools for the league."
              href={`/league/${leagueId}/commissioner/admin`}
              action="OPEN ADMIN"
              danger
            />
          </div>
        </section>


        {/* =====================================================
            COMMISSIONER OPERATIONS
            ===================================================== */}

        <NflPlayoffsCommissionerOperations
          leagueId={leagueId}
        />


        {/* =====================================================
            ROUND LIFECYCLE
            ===================================================== */}

        <section
          style={
            styles.section
          }
        >
          <SectionHead
            eyebrow="POSTSEASON LIFECYCLE"
            title="Round Status"
            badge={`${finalizedRounds.length}/4 FINAL`}
          />

          <div
            className="round-grid"
            style={
              styles.roundGrid
            }
          >
            {[
              1,
              2,
              3,
              4,
            ].map(
              (
                roundNumber
              ) => {
                const round =
                  rounds.find(
                    (
                      row
                    ) =>
                      row.round_number ===
                      roundNumber
                  ) ??
                  null;

                const final =
                  round
                    ? isFinalRound(
                        round
                      )
                    : false;

                const active =
                  !leagueComplete &&
                  !final &&
                  roundNumber ===
                    activeRound;

                const roundEntries =
                  entries.filter(
                    (
                      entry
                    ) =>
                      entry.round_number ===
                      roundNumber
                  );

                const submitted =
                  roundEntries.filter(
                    (
                      entry
                    ) =>
                      Boolean(
                        entry.submitted_at
                      ) ||
                      [
                        "submitted",
                        "locked",
                        "final",
                        "finalized",
                        "complete",
                        "completed",
                      ].includes(
                        normalizedStatus(
                          entry.status
                        )
                      )
                  ).length;

                return (
                  <article
                    key={
                      roundNumber
                    }
                    style={{
                      ...styles.roundCard,

                      ...(active
                        ? styles.activeRound
                        : {}),

                      ...(final
                        ? styles.finalRound
                        : {}),
                    }}
                  >
                    <div
                      style={
                        styles.roundTop
                      }
                    >
                      <div>
                        <span
                          style={
                            styles.roundNumber
                          }
                        >
                          ROUND {
                            roundNumber
                          }
                        </span>

                        <h3
                          style={
                            styles.roundTitle
                          }
                        >
                          {
                            round
                              ?.round_name ??
                            roundName(
                              roundNumber
                            )
                          }
                        </h3>
                      </div>

                      <span
                        style={{
                          ...styles.statusBadge,

                          ...(active
                            ? styles.activeBadge
                            : {}),

                          ...(final
                            ? styles.finalBadge
                            : {}),
                        }}
                      >
                        {final
                          ? "FINAL"
                          : active
                            ? "ACTIVE"
                            : "UPCOMING"}
                      </span>
                    </div>

                    <div
                      style={
                        styles.roundStats
                      }
                    >
                      <Detail
                        label="NFL WEEK"
                        value={
                          round
                            ?.nfl_week
                            ? String(
                                round.nfl_week
                              )
                            : "TBD"
                        }
                      />

                      <Detail
                        label="ENTRIES"
                        value={`${submitted} / ${teams.length}`}
                      />

                      <Detail
                        label="OPENS"
                        value={
                          formatDate(
                            round
                              ?.opens_at ??
                            null
                          )
                        }
                      />

                      <Detail
                        label="FIRST KICKOFF"
                        value={
                          formatDate(
                            round
                              ?.first_kickoff_at ??
                            null
                          )
                        }
                      />

                      <Detail
                        label="LAST GAME"
                        value={
                          formatDate(
                            round
                              ?.last_scheduled_kickoff_at ??
                            null
                          )
                        }
                      />

                      <Detail
                        label="FINALIZED"
                        value={
                          round
                            ?.finalized_at
                            ? formatDate(
                                round.finalized_at
                              )
                            : "—"
                        }
                      />
                    </div>
                  </article>
                );
              }
            )}
          </div>
        </section>


        {/* =====================================================
            ACTIVE ROUND HEALTH
            ===================================================== */}

        <section
          className="two-col"
          style={
            styles.twoColumn
          }
        >
          <article
            style={
              styles.section
            }
          >
            <SectionHead
              eyebrow="ACTIVE ROUND"
              title={
                leagueComplete
                  ? "Postseason Complete"
                  : activeRoundDisplay
              }
            />

            <div
              style={
                styles.infoList
              }
            >
              <InfoRow
                title="Round Number"
                value={
                  leagueComplete
                    ? "—"
                    : String(
                        activeRound
                      )
                }
              />

              <InfoRow
                title="Round Status"
                value={
                  leagueComplete
                    ? "Completed"
                    : prettyStatus(
                        activeRoundRow
                          ?.status
                      )
                }
              />

              <InfoRow
                title="Submitted Entries"
                value={`${submittedEntries} of ${teams.length}`}
              />

              <InfoRow
                title="First Kickoff"
                value={
                  leagueComplete
                    ? "—"
                    : formatDate(
                        activeRoundRow
                          ?.first_kickoff_at ??
                        null
                      )
                }
              />

              <InfoRow
                title="Last Scheduled Game"
                value={
                  leagueComplete
                    ? "—"
                    : formatDate(
                        activeRoundRow
                          ?.last_scheduled_kickoff_at ??
                        null
                      )
                }
              />
            </div>
          </article>


          <article
            style={
              styles.section
            }
          >
            <SectionHead
              eyebrow="LIFECYCLE SAFETY"
              title="Automatic Progression"
            />

            <div
              style={
                styles.ruleList
              }
            >
              <Rule
                title="Player Locks"
                text="Selected players lock individually when their NFL postseason games begin."
              />

              <Rule
                title="Round Results"
                text="Official standings and permanent Trophy Case awards rely on finalized postseason scoring."
              />

              <Rule
                title="No Force-Finalize Shortcut"
                text="This commissioner page does not bypass NFL game completion safeguards or manually mark a round final."
              />

              <Rule
                title="Four-Round Completion"
                text="The league completes after Wild Card, Divisional, Conference Championships, and Super Bowl results are finalized."
              />
            </div>
          </article>
        </section>


        {/* =====================================================
            QUICK LINKS
            ===================================================== */}

        <section
          style={
            styles.section
          }
        >
          <SectionHead
            eyebrow="VERIFY LEAGUE"
            title="Commissioner Review"
          />

          <div
            style={
              styles.quickLinks
            }
          >
            <Link
              href={`/league/${leagueId}/entry`}
              style={
                styles.quickLink
              }
            >
              MY ENTRY
            </Link>

            <Link
              href={`/league/${leagueId}/teams`}
              style={
                styles.quickLink
              }
            >
              LEAGUE TEAMS
            </Link>

            <Link
              href={`/league/${leagueId}/nfl-playoffs/standings`}
              style={
                styles.quickLink
              }
            >
              STANDINGS
            </Link>

            <Link
              href={`/league/${leagueId}/nfl-playoffs/playoffs`}
              style={
                styles.quickLink
              }
            >
              NFL PLAYOFF BRACKET
            </Link>

            <Link
              href={`/league/${leagueId}/nfl-playoffs/recap`}
              style={
                styles.quickLink
              }
            >
              RECAP
            </Link>

            <Link
              href={`/league/${leagueId}/nfl-playoffs/trophy-case`}
              style={
                styles.quickLink
              }
            >
              TROPHY CASE
            </Link>
          </div>
        </section>


        <div
          style={
            styles.notice
          }
        >
          G365 NFL Playoffs uses its
          own four-round postseason
          lifecycle. Traditional
          fantasy playoff seeding,
          reseeding, consolation
          brackets, waivers, trades,
          and draft controls do not
          apply to this league type.
        </div>
      </section>
    </main>
  );
}


function Summary({
  label,
  value,
  detail,
}: {
  label:
    string;

  value:
    string;

  detail:
    string;
}) {
  return (
    <article
      style={
        styles.summary
      }
    >
      <span
        style={
          styles.summaryLabel
        }
      >
        {label}
      </span>

      <strong
        style={
          styles.summaryValue
        }
      >
        {value}
      </strong>

      <span
        style={
          styles.summaryDetail
        }
      >
        {detail}
      </span>
    </article>
  );
}


function SectionHead({
  eyebrow,
  title,
  badge,
}: {
  eyebrow:
    string;

  title:
    string;

  badge?:
    string;
}) {
  return (
    <div
      style={
        styles.sectionHead
      }
    >
      <div>
        <p
          style={
            styles.sectionEyebrow
          }
        >
          {eyebrow}
        </p>

        <h2
          style={
            styles.sectionTitle
          }
        >
          {title}
        </h2>
      </div>

      {badge ? (
        <span
          style={
            styles.countBadge
          }
        >
          {badge}
        </span>
      ) : null}
    </div>
  );
}


function ToolCard({
  title,
  description,
  href,
  action,
  danger = false,
}: {
  title:
    string;

  description:
    string;

  href:
    string;

  action:
    string;

  danger?:
    boolean;
}) {
  return (
    <Link
      href={
        href
      }
      style={{
        ...styles.toolCard,

        ...(danger
          ? styles.dangerCard
          : {}),
      }}
    >
      <span
        style={{
          ...styles.toolEyebrow,

          ...(danger
            ? styles.dangerText
            : {}),
        }}
      >
        COMMISSIONER TOOL
      </span>

      <h3
        style={
          styles.toolTitle
        }
      >
        {title}
      </h3>

      <p
        style={
          styles.toolText
        }
      >
        {description}
      </p>

      <div
        style={{
          ...styles.toolAction,

          ...(danger
            ? styles.dangerText
            : {}),
        }}
      >
        {action} →
      </div>
    </Link>
  );
}


function Detail({
  label,
  value,
}: {
  label:
    string;

  value:
    string;
}) {
  return (
    <div
      style={
        styles.detail
      }
    >
      <span
        style={
          styles.detailLabel
        }
      >
        {label}
      </span>

      <strong
        style={
          styles.detailValue
        }
      >
        {value}
      </strong>
    </div>
  );
}


function InfoRow({
  title,
  value,
}: {
  title:
    string;

  value:
    string;
}) {
  return (
    <div
      style={
        styles.infoRow
      }
    >
      <span
        style={
          styles.infoLabel
        }
      >
        {title}
      </span>

      <strong
        style={
          styles.infoValue
        }
      >
        {value}
      </strong>
    </div>
  );
}


function Rule({
  title,
  text,
}: {
  title:
    string;

  text:
    string;
}) {
  return (
    <div
      style={
        styles.rule
      }
    >
      <strong
        style={
          styles.ruleTitle
        }
      >
        {title}
      </strong>

      <p
        style={
          styles.ruleText
        }
      >
        {text}
      </p>
    </div>
  );
}


const styles:
  Record<
    string,
    CSSProperties
  > = {
  page: {
    minHeight:
      "100vh",

    padding:
      22,

    color:
      "#f5f5f5",

    background:
      "linear-gradient(180deg,#080808,#101010)",
  },

  shell: {
    width:
      "100%",

    maxWidth:
      1320,

    margin:
      "0 auto",
  },

  hero: {
    display:
      "flex",

    justifyContent:
      "space-between",

    alignItems:
      "center",

    gap:
      18,

    marginBottom:
      16,

    padding:
      24,

    border:
      "1px solid #2c2c2c",

    borderRadius:
      20,

    background:
      "linear-gradient(135deg,rgba(139,24,10,.28),rgba(241,94,20,.08),#111)",
  },

  eyebrow: {
    margin:
      0,

    color:
      "#ff671e",

    fontSize:
      9,

    fontWeight:
      900,

    letterSpacing:
      ".13em",
  },

  title: {
    margin:
      "5px 0",

    fontSize:
      32,

    lineHeight:
      1,
  },

  subtitle: {
    margin:
      0,

    color:
      "#808080",

    fontSize:
      11,
  },

  actions: {
    display:
      "flex",

    gap:
      8,

    flexWrap:
      "wrap",
  },

  primaryButton: {
    padding:
      "10px 14px",

    borderRadius:
      9,

    color:
      "#fff",

    textDecoration:
      "none",

    background:
      "linear-gradient(135deg,#a32412,#ee6517)",

    fontSize:
      8,

    fontWeight:
      900,
  },

  secondaryButton: {
    padding:
      "10px 14px",

    border:
      "1px solid #373737",

    borderRadius:
      9,

    color:
      "#bdbdbd",

    textDecoration:
      "none",

    background:
      "#151515",

    fontSize:
      8,

    fontWeight:
      900,
  },

  summaryGrid: {
    display:
      "grid",

    gridTemplateColumns:
      "repeat(4,minmax(0,1fr))",

    gap:
      10,

    marginBottom:
      16,
  },

  summary: {
    padding:
      14,

    border:
      "1px solid #292929",

    borderRadius:
      13,

    background:
      "#121212",
  },

  summaryLabel: {
    display:
      "block",

    color:
      "#df5c20",

    fontSize:
      7,

    fontWeight:
      900,

    letterSpacing:
      ".09em",
  },

  summaryValue: {
    display:
      "block",

    margin:
      "4px 0",

    fontSize:
      17,
  },

  summaryDetail: {
    display:
      "block",

    color:
      "#666",

    fontSize:
      8,

    lineHeight:
      1.35,
  },

  section: {
    marginBottom:
      16,

    overflow:
      "hidden",

    border:
      "1px solid #292929",

    borderRadius:
      15,

    background:
      "#111",
  },

  sectionHead: {
    display:
      "flex",

    justifyContent:
      "space-between",

    alignItems:
      "center",

    gap:
      12,

    padding:
      "15px 17px",

    borderBottom:
      "1px solid #242424",
  },

  sectionEyebrow: {
    margin:
      0,

    color:
      "#dc5d21",

    fontSize:
      7,

    fontWeight:
      900,

    letterSpacing:
      ".1em",
  },

  sectionTitle: {
    margin:
      "4px 0 0",

    fontSize:
      18,
  },

  countBadge: {
    padding:
      "6px 8px",

    border:
      "1px solid #48301f",

    borderRadius:
      999,

    color:
      "#df7939",

    background:
      "#1d140e",

    fontSize:
      7,

    fontWeight:
      900,
  },

  toolGrid: {
    display:
      "grid",

    gridTemplateColumns:
      "repeat(4,minmax(0,1fr))",

    gap:
      10,

    padding:
      14,
  },

  toolCard: {
    display:
      "flex",

    flexDirection:
      "column",

    minHeight:
      175,

    padding:
      14,

    border:
      "1px solid #303030",

    borderRadius:
      12,

    color:
      "#fff",

    textDecoration:
      "none",

    background:
      "#151515",
  },

  dangerCard: {
    border:
      "1px solid #54272a",

    background:
      "#191011",
  },

  toolEyebrow: {
    color:
      "#df621f",

    fontSize:
      7,

    fontWeight:
      900,

    letterSpacing:
      ".09em",
  },

  toolTitle: {
    margin:
      "7px 0",

    fontSize:
      14,
  },

  toolText: {
    flex:
      1,

    margin:
      0,

    color:
      "#727272",

    fontSize:
      8,

    lineHeight:
      1.5,
  },

  toolAction: {
    marginTop:
      12,

    color:
      "#e16b2c",

    fontSize:
      7,

    fontWeight:
      900,
  },

  dangerText: {
    color:
      "#e1696c",
  },

  roundGrid: {
    display:
      "grid",

    gridTemplateColumns:
      "repeat(4,minmax(0,1fr))",

    gap:
      10,

    padding:
      14,
  },

  roundCard: {
    padding:
      13,

    border:
      "1px solid #2b2b2b",

    borderRadius:
      11,

    background:
      "#141414",
  },

  activeRound: {
    border:
      "1px solid #91411c",

    background:
      "linear-gradient(135deg,#22140e,#151311)",
  },

  finalRound: {
    border:
      "1px solid #324b39",

    background:
      "#111813",
  },

  roundTop: {
    display:
      "flex",

    justifyContent:
      "space-between",

    alignItems:
      "flex-start",

    gap:
      8,

    marginBottom:
      12,
  },

  roundNumber: {
    color:
      "#d65d24",

    fontSize:
      6,

    fontWeight:
      900,

    letterSpacing:
      ".08em",
  },

  roundTitle: {
    margin:
      "4px 0 0",

    fontSize:
      12,
  },

  statusBadge: {
    padding:
      "4px 6px",

    borderRadius:
      999,

    color:
      "#747474",

    background:
      "#222",

    fontSize:
      6,

    fontWeight:
      900,
  },

  activeBadge: {
    color:
      "#ff8d47",

    background:
      "#2d190f",
  },

  finalBadge: {
    color:
      "#72d690",

    background:
      "#142018",
  },

  roundStats: {
    display:
      "grid",

    gap:
      7,
  },

  detail: {
    display:
      "flex",

    alignItems:
      "center",

    justifyContent:
      "space-between",

    gap:
      8,

    paddingBottom:
      6,

    borderBottom:
      "1px solid #202020",
  },

  detailLabel: {
    color:
      "#5e5e5e",

    fontSize:
      6,

    fontWeight:
      900,
  },

  detailValue: {
    color:
      "#999",

    textAlign:
      "right",

    fontSize:
      7,
  },

  twoColumn: {
    display:
      "grid",

    gridTemplateColumns:
      "repeat(2,minmax(0,1fr))",

    gap:
      12,

    marginBottom:
      16,
  },

  infoList: {
    padding:
      "5px 15px 14px",
  },

  infoRow: {
    display:
      "flex",

    alignItems:
      "center",

    justifyContent:
      "space-between",

    gap:
      12,

    padding:
      "11px 0",

    borderBottom:
      "1px solid #222",
  },

  infoLabel: {
    color:
      "#777",

    fontSize:
      8,
  },

  infoValue: {
    fontSize:
      9,

    textAlign:
      "right",
  },

  ruleList: {
    padding:
      "4px 15px 14px",
  },

  rule: {
    padding:
      "10px 0",

    borderBottom:
      "1px solid #222",
  },

  ruleTitle: {
    display:
      "block",

    fontSize:
      9,
  },

  ruleText: {
    margin:
      "4px 0 0",

    color:
      "#717171",

    fontSize:
      8,

    lineHeight:
      1.45,
  },

  quickLinks: {
    display:
      "flex",

    flexWrap:
      "wrap",

    gap:
      8,

    padding:
      14,
  },

  quickLink: {
    padding:
      "9px 11px",

    border:
      "1px solid #323232",

    borderRadius:
      8,

    color:
      "#bdbdbd",

    textDecoration:
      "none",

    background:
      "#151515",

    fontSize:
      7,

    fontWeight:
      900,
  },

  notice: {
    padding:
      13,

    border:
      "1px solid #332a26",

    borderRadius:
      11,

    color:
      "#7d716b",

    background:
      "#13100f",

    fontSize:
      8,

    lineHeight:
      1.5,
  },
};