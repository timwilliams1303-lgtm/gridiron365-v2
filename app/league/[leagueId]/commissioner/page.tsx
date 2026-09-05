import type {
  CSSProperties,
} from "react";

import Link from "next/link";

import {
  redirect,
} from "next/navigation";

import PickemCommissioner from "@/components/pickem/PickemCommissioner";
import SeasonLongCommissioner from "@/components/season-long/SeasonLongCommissioner";
import TraditionalCommissioner from "@/components/traditional/TraditionalCommissioner";

import NflPlayoffsCommissionerOperations
  from "@/components/nfl-playoffs/NflPlayoffsCommissionerOperations";

import NflPlayoffsCommissionerSettingsEditor
  from "@/components/nfl-playoffs/NflPlayoffsCommissionerSettingsEditor";

import NflPlayoffsSalarySettingsEditor
  from "@/components/nfl-playoffs/NflPlayoffsSalarySettingsEditor";

import NflPlayoffsLeagueTeamsRealtime
  from "@/components/nfl-playoffs/NflPlayoffsLeagueTeamsRealtime";

import NflPlayoffsInviteForm
  from "@/components/nfl-playoffs/NflPlayoffsInviteForm";

import NflPlayoffsDeleteLeague
  from "@/components/nfl-playoffs/NflPlayoffsDeleteLeague";

import SeasonLongScoring
  from "@/components/season-long/SeasonLongScoring";

import {
  createSupabaseServerClient,
} from "@/lib/supabase/server";

import {
  requireLeagueMember,
} from "@/lib/leagues/requireLeagueMember";


export const dynamic =
  "force-dynamic";

export const revalidate =
  0;


type PageProps = {
  params: Promise<{
    leagueId: string;
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


type SalarySettingsRow = {
  minimum_salary:
    number |
    string;

  maximum_salary:
    number |
    string;

  salary_increment:
    number |
    string;

  projection_weight:
    number |
    string;

  recent_form_weight:
    number |
    string;

  usage_weight:
    number |
    string;

  qb_multiplier:
    number |
    string;

  rb_multiplier:
    number |
    string;

  wr_multiplier:
    number |
    string;

  te_multiplier:
    number |
    string;

  k_multiplier:
    number |
    string;

  dst_multiplier:
    number |
    string;

  maximum_round_increase:
    number |
    string;

  maximum_round_decrease:
    number |
    string;

  questionable_multiplier:
    number |
    string;

  doubtful_multiplier:
    number |
    string;

  out_multiplier:
    number |
    string;
};


type TeamRow = {
  id:
    number;

  team_name:
    string;

  owner_id:
    string |
    null;

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


function numberValue(
  value:
    number |
    string |
    null |
    undefined,
  fallback =
    0
) {
  const parsed =
    Number(
      value
    );

  return Number.isFinite(
    parsed
  )
    ? parsed
    : fallback;
}


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
  if (!value) {
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
  if (!value) {
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


export default async function CommissionerPage({
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
    !access.isCommissioner
  ) {
    redirect(
      `/league/${leagueId}`
    );
  }


  switch (
    access.league.leagueType
  ) {
    case "traditional":
      return (
        <TraditionalCommissioner
          leagueId={
            leagueId
          }
        />
      );

    case "season_long":
      return (
        <SeasonLongCommissioner
          leagueId={
            leagueId
          }
        />
      );

    case "pickem":
      return (
        <PickemCommissioner
          leagueId={
            leagueId
          }
        />
      );

    case "nfl_playoffs":
      return (
        <NflPlayoffsCommissionerWorkspace
          leagueId={
            leagueId
          }
        />
      );

    default:
      redirect(
        `/league/${leagueId}`
      );
  }
}


async function NflPlayoffsCommissionerWorkspace({
  leagueId,
}: {
  leagueId:
    string;
}) {
  const access =
    await requireLeagueMember(
      leagueId
    );


  if (
    access.league.leagueType !==
    "nfl_playoffs"
  ) {
    redirect(
      `/league/${leagueId}`
    );
  }


  const supabase =
    await createSupabaseServerClient();


  const season =
    access.league.season;


  const isSalary =
    access.league.playerSelectionMode ===
    "salary";


  const [
    stateResult,
    roundsResult,
    settingsResult,
    salarySettingsResult,
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

      isSalary
        ? supabase
            .from(
              "nfl_playoff_salary_settings"
            )
            .select(`
              minimum_salary,
              maximum_salary,
              salary_increment,
              projection_weight,
              recent_form_weight,
              usage_weight,
              qb_multiplier,
              rb_multiplier,
              wr_multiplier,
              te_multiplier,
              k_multiplier,
              dst_multiplier,
              maximum_round_increase,
              maximum_round_decrease,
              questionable_multiplier,
              doubtful_multiplier,
              out_multiplier
            `)
            .eq(
              "league_id",
              leagueId
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
        .select(`
          id,
          team_name,
          owner_id,
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
    salarySettingsResult.error
  ) {
    throw new Error(
      `Could not load NFL Playoffs salary settings: ${salarySettingsResult.error.message}`
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


  const salarySettings =
    salarySettingsResult.data as
      SalarySettingsRow |
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


  const activeRoundRaw =
    Number(
      state?.active_round ??
      1
    );


  const activeRound =
    Number.isInteger(
      activeRoundRaw
    ) &&
    activeRoundRaw >=
      1 &&
    activeRoundRaw <=
      4
      ? activeRoundRaw
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
      state?.completed_at
    ) ||
    [
      "complete",
      "completed",
      "final",
      "finalized",
    ].includes(
      normalizedStatus(
        state?.status
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


  const firstKickoff =
    rounds
      .map(
        (
          round
        ) =>
          round.first_kickoff_at
      )
      .filter(
        (
          value
        ): value is string =>
          Boolean(
            value
          )
      )
      .map(
        (
          value
        ) =>
          new Date(
            value
          )
      )
      .filter(
        (
          value
        ) =>
          !Number.isNaN(
            value.getTime()
          )
      )
      .sort(
        (
          first,
          second
        ) =>
          first.getTime() -
          second.getTime()
      )[0] ??
    null;


  const settingsLocked =
    Boolean(
      firstKickoff &&
      firstKickoff.getTime() <=
        Date.now()
    ) ||
    finalizedRounds.length >
      0;


  const lockedReason =
    settingsLocked
      ? "NFL Playoffs commissioner setup is locked because postseason play has already started."
      : null;


  const activeRoundDisplay =
    leagueComplete
      ? "Complete"
      : activeRoundRow
          ?.round_name ??
        roundName(
          activeRound
        );


  const defaultSettings = {
    weeklySalaryCap:
      isSalary
        ? 65000
        : null,

    startingQb:
      1,

    startingRb:
      2,

    startingWr:
      2,

    startingTe:
      1,

    startingFlex:
      2,

    startingSuperflex:
      0,

    startingK:
      1,

    startingDst:
      1,
  };


  const editorSettings = {
    weeklySalaryCap:
      settings
        ?.weekly_salary_cap ===
        null ||
      settings
        ?.weekly_salary_cap ===
        undefined
        ? defaultSettings
            .weeklySalaryCap
        : numberValue(
            settings
              .weekly_salary_cap,
            65000
          ),

    startingQb:
      settings
        ?.starting_qb ??
      defaultSettings
        .startingQb,

    startingRb:
      settings
        ?.starting_rb ??
      defaultSettings
        .startingRb,

    startingWr:
      settings
        ?.starting_wr ??
      defaultSettings
        .startingWr,

    startingTe:
      settings
        ?.starting_te ??
      defaultSettings
        .startingTe,

    startingFlex:
      settings
        ?.starting_flex ??
      defaultSettings
        .startingFlex,

    startingSuperflex:
      settings
        ?.starting_superflex ??
      defaultSettings
        .startingSuperflex,

    startingK:
      settings
        ?.starting_k ??
      defaultSettings
        .startingK,

    startingDst:
      settings
        ?.starting_dst ??
      defaultSettings
        .startingDst,
  };


  const editorSalarySettings = {
    minimumSalary:
      numberValue(
        salarySettings
          ?.minimum_salary,
        3000
      ),

    maximumSalary:
      numberValue(
        salarySettings
          ?.maximum_salary,
        12000
      ),

    salaryIncrement:
      numberValue(
        salarySettings
          ?.salary_increment,
        100
      ),

    projectionWeight:
      numberValue(
        salarySettings
          ?.projection_weight,
        1
      ),

    recentFormWeight:
      numberValue(
        salarySettings
          ?.recent_form_weight,
        0.3
      ),

    usageWeight:
      numberValue(
        salarySettings
          ?.usage_weight,
        0.15
      ),

    qbMultiplier:
      numberValue(
        salarySettings
          ?.qb_multiplier,
        0.95
      ),

    rbMultiplier:
      numberValue(
        salarySettings
          ?.rb_multiplier,
        1.08
      ),

    wrMultiplier:
      numberValue(
        salarySettings
          ?.wr_multiplier,
        1.05
      ),

    teMultiplier:
      numberValue(
        salarySettings
          ?.te_multiplier,
        1.08
      ),

    kMultiplier:
      numberValue(
        salarySettings
          ?.k_multiplier,
        0.7
      ),

    dstMultiplier:
      numberValue(
        salarySettings
          ?.dst_multiplier,
        0.75
      ),

    maximumRoundIncrease:
      numberValue(
        salarySettings
          ?.maximum_round_increase,
        1500
      ),

    maximumRoundDecrease:
      numberValue(
        salarySettings
          ?.maximum_round_decrease,
        1500
      ),

    questionableMultiplier:
      numberValue(
        salarySettings
          ?.questionable_multiplier,
        0.95
      ),

    doubtfulMultiplier:
      numberValue(
        salarySettings
          ?.doubtful_multiplier,
        0.75
      ),

    outMultiplier:
      numberValue(
        salarySettings
          ?.out_multiplier,
        0
      ),
  };


  return (
    <main
      className="g365-nflp-admin"
      style={
        styles.page
      }
    >
      <style>{`
        .g365-nflp-admin,
        .g365-nflp-admin * {
          box-sizing: border-box;
        }

        .g365-nflp-admin details > summary {
          list-style: none;
        }

        .g365-nflp-admin details > summary::-webkit-details-marker {
          display: none;
        }

        .g365-nflp-admin .summary-grid {
          display: grid;
          grid-template-columns: repeat(4,minmax(0,1fr));
          gap: 10px;
        }

        .g365-nflp-admin .team-grid {
          display: grid;
          grid-template-columns: repeat(3,minmax(0,1fr));
          gap: 10px;
        }

        @media (max-width: 1000px) {
          .g365-nflp-admin .summary-grid {
            grid-template-columns: repeat(2,minmax(0,1fr));
          }

          .g365-nflp-admin .team-grid {
            grid-template-columns: repeat(2,minmax(0,1fr));
          }
        }

        @media (max-width: 650px) {
          .g365-nflp-admin {
            padding: 12px 10px 70px !important;
          }

          .g365-nflp-admin .summary-grid,
          .g365-nflp-admin .team-grid {
            grid-template-columns: 1fr;
          }

          .g365-nflp-admin .hero {
            flex-direction: column !important;
            align-items: flex-start !important;
          }

          .g365-nflp-admin .hero-actions {
            width: 100%;
          }

          .g365-nflp-admin .hero-actions a {
            flex: 1 1 auto;
            text-align: center;
          }
        }
      `}</style>


      <section
        style={
          styles.shell
        }
      >
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
              League Administration
            </h1>

            <p
              style={
                styles.subtitle
              }
            >
              {access.league.name}
              {" · "}
              {season}
              {" · "}
              {isSalary
                ? "Salary Cap"
                : "No Salary Cap"}
            </p>

            <p
              style={
                styles.subtitle
              }
            >
              Everything for this NFL Playoffs league is managed directly on this page.
            </p>
          </div>


          <div
            className="hero-actions"
            style={
              styles.actions
            }
          >
            <Link
              href={`/league/${leagueId}/entry`}
              style={
                styles.secondaryButton
              }
            >
              MY ENTRY
            </Link>

            <Link
              href={`/league/${leagueId}/nfl-playoffs/playoffs`}
              style={
                styles.primaryButton
              }
            >
              NFL BRACKET
            </Link>
          </div>
        </header>


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
                state?.status
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
            detail="Submitted for the active round"
          />

          <Summary
            label="LINEUP SIZE"
            value={
              String(
                starterCount
              )
            }
            detail="Required starters per round"
          />

          <Summary
            label={
              isSalary
                ? "SALARY CAP"
                : "SELECTION MODE"
            }
            value={
              isSalary
                ? money(
                    settings
                      ?.weekly_salary_cap
                  )
                : "No Salary"
            }
            detail={
              isSalary
                ? "Per postseason lineup"
                : "No player salary restriction"
            }
          />

          <Summary
            label="SETTINGS"
            value={
              settingsLocked
                ? "Locked"
                : "Editable"
            }
            detail={
              settingsLocked
                ? "Postseason play has started"
                : "Commissioner changes allowed"
            }
          />
        </section>


        <AdminPanel
          title="League & Lineup Settings"
          eyebrow="LEAGUE SETUP"
          description="League construction, salary/no-salary mode, salary cap and required starting positions."
          defaultOpen
        >
          <NflPlayoffsCommissionerSettingsEditor
            leagueId={
              leagueId
            }
            leagueName={
              access.league.name
            }
            season={
              season
            }
            isSalary={
              isSalary
            }
            settingsLocked={
              settingsLocked
            }
            lockedReason={
              lockedReason
            }
            initialSettings={
              editorSettings
            }
          />
        </AdminPanel>


        {isSalary ? (
          <AdminPanel
            title="Salary & Pricing"
            eyebrow="PLAYER PRICING"
            description="Salary ranges, position multipliers, round movement limits and injury adjustments."
          >
            <NflPlayoffsSalarySettingsEditor
              leagueId={
                leagueId
              }
              leagueName={
                access.league.name
              }
              season={
                season
              }
              salaryCap={
                editorSettings
                  .weeklySalaryCap
              }
              settingsLocked={
                settingsLocked
              }
              lockedReason={
                lockedReason
              }
              initialSettings={
                editorSalarySettings
              }
            />
          </AdminPanel>
        ) : null}


        <AdminPanel
          title="Scoring Settings"
          eyebrow="FANTASY SCORING"
          description="Passing, rushing, receiving, kicking, D/ST, bonuses and custom scoring."
        >
          <SeasonLongScoring
            leagueId={
              leagueId
            }
          />
        </AdminPanel>


        <AdminPanel
          title="Teams & Members"
          eyebrow="LEAGUE MEMBERSHIP"
          description="See every league team, owner status and send new owner invitations without leaving this page."
        >
          <NflPlayoffsLeagueTeamsRealtime
            leagueId={
              leagueId
            }
            season={
              season
            }
            roundNumber={
              activeRound
            }
          />

          <div
            style={
              styles.panelInner
            }
          >
            <NflPlayoffsInviteForm
              leagueId={
                leagueId
              }
            />


            <div
              style={{
                marginTop:
                  16,
              }}
            >
              <div
                className="team-grid"
              >
                {teams.map(
                  (
                    team
                  ) => (
                    <article
                      key={
                        team.id
                      }
                      style={
                        styles.teamCard
                      }
                    >
                      <span
                        style={
                          styles.teamLabel
                        }
                      >
                        TEAM #{team.id}
                      </span>

                      <strong
                        style={
                          styles.teamName
                        }
                      >
                        {team.team_name}
                      </strong>

                      <span
                        style={{
                          ...styles.ownerBadge,

                          ...(team.owner_id
                            ? styles.ownerAssigned
                            : styles.ownerVacant),
                        }}
                      >
                        {team.owner_id
                          ? "OWNER ASSIGNED"
                          : "VACANT"}
                      </span>
                    </article>
                  )
                )}
              </div>
            </div>
          </div>
        </AdminPanel>


        <AdminPanel
          title="NFL Playoffs Operations"
          eyebrow="COMMISSIONER OPERATIONS"
          description="Run safe postseason sync, scoring, standings and lifecycle maintenance from this page."
        >
          <NflPlayoffsCommissionerOperations
            leagueId={
              leagueId
            }
          />
        </AdminPanel>


        <AdminPanel
          title="Round & Season Control"
          eyebrow="POSTSEASON LIFECYCLE"
          description="Review each NFL playoff round and league completion status."
        >
          <div
            style={
              styles.panelInner
            }
          >
            <div
              style={
                styles.roundGrid
              }
            >
              {[1, 2, 3, 4].map(
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
                    activeRound ===
                      roundNumber;

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
                      <span
                        style={
                          styles.roundNumber
                        }
                      >
                        ROUND {roundNumber}
                      </span>

                      <h3
                        style={
                          styles.roundTitle
                        }
                      >
                        {round
                          ?.round_name ??
                          roundName(
                            roundNumber
                          )}
                      </h3>

                      <InfoRow
                        title="Status"
                        value={
                          final
                            ? "Final"
                            : active
                              ? "Active"
                              : prettyStatus(
                                  round?.status
                                )
                        }
                      />

                      <InfoRow
                        title="NFL Week"
                        value={
                          round?.nfl_week
                            ? String(
                                round.nfl_week
                              )
                            : "TBD"
                        }
                      />

                      <InfoRow
                        title="First Kickoff"
                        value={
                          formatDate(
                            round?.first_kickoff_at ??
                            null
                          )
                        }
                      />

                      <InfoRow
                        title="Finalized"
                        value={
                          formatDate(
                            round?.finalized_at ??
                            null
                          )
                        }
                      />
                    </article>
                  );
                }
              )}
            </div>


            <div
              style={
                styles.seasonControl
              }
            >
              <div>
                <span
                  style={
                    styles.sectionEyebrow
                  }
                >
                  SEASON CONTROL
                </span>

                <h3
                  style={
                    styles.seasonTitle
                  }
                >
                  {season} NFL Playoffs
                </h3>

                <p
                  style={
                    styles.seasonText
                  }
                >
                  {leagueComplete
                    ? `The ${season} postseason is complete. The next renewal target is ${season + 1}.`
                    : `Renewal stays unavailable until the ${season} postseason is fully finalized.`}
                </p>
              </div>

              <div
                style={
                  styles.renewPlaceholder
                }
              >
                {leagueComplete
                  ? `READY FOR ${season + 1} RENEWAL`
                  : "RENEWAL LOCKED UNTIL COMPLETE"}
              </div>
            </div>
          </div>
        </AdminPanel>


        <AdminPanel
          title="League Administration"
          eyebrow="ADMINISTRATION"
          description="Central commissioner status and review area. No separate admin page is required for NFL Playoffs."
        >
          <div
            style={
              styles.panelInner
            }
          >
            <div
              style={
                styles.adminGrid
              }
            >
              <AdminStat
                label="League"
                value={
                  access.league.name
                }
              />

              <AdminStat
                label="Season"
                value={
                  String(
                    season
                  )
                }
              />

              <AdminStat
                label="Format"
                value={
                  isSalary
                    ? "Salary Cap"
                    : "No Salary"
                }
              />

              <AdminStat
                label="League Complete"
                value={
                  leagueComplete
                    ? "Yes"
                    : "No"
                }
              />

              <AdminStat
                label="Current Round"
                value={
                  activeRoundDisplay
                }
              />

              <AdminStat
                label="Active Teams"
                value={
                  String(
                    teams.length
                  )
                }
              />
            </div>

            <NflPlayoffsDeleteLeague
              leagueId={
                leagueId
              }
              leagueName={
                access.league.name
              }
            />
          </div>
        </AdminPanel>


        <div
          style={
            styles.notice
          }
        >
          NFL Playoffs commissioner controls now live on this single page. Traditional draft, waivers, trades and traditional fantasy playoff controls do not apply to this league type.
        </div>
      </section>
    </main>
  );
}


function AdminPanel({
  title,
  eyebrow,
  description,
  defaultOpen =
    false,
  children,
}: {
  title:
    string;

  eyebrow:
    string;

  description:
    string;

  defaultOpen?:
    boolean;

  children:
    React.ReactNode;
}) {
  return (
    <details
      open={
        defaultOpen
      }
      style={
        styles.panel
      }
    >
      <summary
        style={
          styles.panelSummary
        }
      >
        <div>
          <span
            style={
              styles.sectionEyebrow
            }
          >
            {eyebrow}
          </span>

          <h2
            style={
              styles.sectionTitle
            }
          >
            {title}
          </h2>

          <p
            style={
              styles.panelDescription
            }
          >
            {description}
          </p>
        </div>

        <span
          style={
            styles.expandBadge
          }
        >
          OPEN / CLOSE
        </span>
      </summary>

      <div
        style={
          styles.panelBody
        }
      >
        {children}
      </div>
    </details>
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


function AdminStat({
  label,
  value,
}: {
  label:
    string;

  value:
    string;
}) {
  return (
    <article
      style={
        styles.adminStat
      }
    >
      <span
        style={
          styles.adminStatLabel
        }
      >
        {label}
      </span>

      <strong
        style={
          styles.adminStatValue
        }
      >
        {value}
      </strong>
    </article>
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
        "20px 20px 70px",

      background:
        "linear-gradient(180deg,#07080b,#0d0d0f 48%,#07080a)",

      color:
        "#f5f5f5",
    },


    shell: {
      width:
        "min(1500px,100%)",

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

      padding:
        22,

      marginBottom:
        14,

      border:
        "1px solid rgba(255,91,29,.27)",

      borderRadius:
        16,

      background:
        "linear-gradient(135deg,rgba(128,18,15,.28),rgba(255,92,28,.08),#111)",
    },


    eyebrow: {
      margin:
        0,

      color:
        "#ff671e",

      fontSize:
        10,

      fontWeight:
        950,

      letterSpacing:
        ".13em",
    },


    title: {
      margin:
        "5px 0",

      fontSize:
        32,

      fontWeight:
        950,

      lineHeight:
        1.05,
    },


    subtitle: {
      margin:
        "5px 0 0",

      color:
        "#898f99",

      fontSize:
        11,

      lineHeight:
        1.5,
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
      marginBottom:
        14,
    },


    summary: {
      padding:
        14,

      border:
        "1px solid #292929",

      borderRadius:
        12,

      background:
        "#111214",
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
        "5px 0",

      fontSize:
        17,
    },


    summaryDetail: {
      display:
        "block",

      color:
        "#696d74",

      fontSize:
        8,

      lineHeight:
        1.4,
    },


    panel: {
      marginBottom:
        14,

      overflow:
        "hidden",

      border:
        "1px solid #292929",

      borderRadius:
        15,

      background:
        "#101113",
    },


    panelSummary: {
      display:
        "flex",

      justifyContent:
        "space-between",

      alignItems:
        "center",

      gap:
        16,

      padding:
        "17px 18px",

      cursor:
        "pointer",

      background:
        "linear-gradient(90deg,rgba(139,26,13,.18),rgba(255,91,29,.04),transparent)",
    },


    panelDescription: {
      margin:
        "5px 0 0",

      maxWidth:
        900,

      color:
        "#777e88",

      fontSize:
        10,

      lineHeight:
        1.45,
    },


    panelBody: {
      borderTop:
        "1px solid #242424",
    },


    panelInner: {
      padding:
        16,
    },


    sectionEyebrow: {
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


    expandBadge: {
      flex:
        "0 0 auto",

      padding:
        "6px 9px",

      border:
        "1px solid #47301f",

      borderRadius:
        999,

      background:
        "#1b140f",

      color:
        "#df7939",

      fontSize:
        7,

      fontWeight:
        900,
    },


    teamCard: {
      display:
        "flex",

      flexDirection:
        "column",

      gap:
        7,

      padding:
        14,

      border:
        "1px solid #2f2f2f",

      borderRadius:
        11,

      background:
        "#151618",
    },


    teamLabel: {
      color:
        "#747981",

      fontSize:
        7,

      fontWeight:
        900,

      letterSpacing:
        ".08em",
    },


    teamName: {
      color:
        "#fff",

      fontSize:
        14,
    },


    ownerBadge: {
      alignSelf:
        "flex-start",

      padding:
        "5px 7px",

      borderRadius:
        999,

      fontSize:
        7,

      fontWeight:
        900,
    },


    ownerAssigned: {
      border:
        "1px solid #2f553a",

      background:
        "#132018",

      color:
        "#72d690",
    },


    ownerVacant: {
      border:
        "1px solid #573228",

      background:
        "#21140f",

      color:
        "#ef8655",
    },


    roundGrid: {
      display:
        "grid",

      gridTemplateColumns:
        "repeat(4,minmax(0,1fr))",

      gap:
        10,
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
        "4px 0 10px",

      fontSize:
        12,
    },


    infoRow: {
      display:
        "flex",

      justifyContent:
        "space-between",

      gap:
        8,

      padding:
        "8px 0",

      borderBottom:
        "1px solid #222",
    },


    infoLabel: {
      color:
        "#62666d",

      fontSize:
        7,
    },


    infoValue: {
      color:
        "#a9adb4",

      textAlign:
        "right",

      fontSize:
        7,
    },


    seasonControl: {
      display:
        "flex",

      justifyContent:
        "space-between",

      alignItems:
        "center",

      gap:
        16,

      flexWrap:
        "wrap",

      marginTop:
        16,

      padding:
        16,

      border:
        "1px solid #342920",

      borderRadius:
        11,

      background:
        "#14110f",
    },


    seasonTitle: {
      margin:
        "4px 0",

      fontSize:
        15,
    },


    seasonText: {
      margin:
        0,

      color:
        "#7d746d",

      fontSize:
        9,

      lineHeight:
        1.5,
    },


    renewPlaceholder: {
      padding:
        "10px 12px",

      border:
        "1px solid #4a3224",

      borderRadius:
        8,

      background:
        "#1b130f",

      color:
        "#d9814f",

      fontSize:
        8,

      fontWeight:
        900,
    },


    adminGrid: {
      display:
        "grid",

      gridTemplateColumns:
        "repeat(3,minmax(0,1fr))",

      gap:
        10,
    },


    adminStat: {
      padding:
        12,

      border:
        "1px solid #292929",

      borderRadius:
        10,

      background:
        "#151515",
    },


    adminStatLabel: {
      display:
        "block",

      color:
        "#696969",

      fontSize:
        7,

      fontWeight:
        900,

      letterSpacing:
        ".06em",
    },


    adminStatValue: {
      display:
        "block",

      marginTop:
        5,

      fontSize:
        11,
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