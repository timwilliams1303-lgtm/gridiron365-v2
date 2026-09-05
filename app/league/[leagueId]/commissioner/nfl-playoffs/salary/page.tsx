import {
  redirect,
} from "next/navigation";

import {
  createSupabaseServerClient,
} from "@/lib/supabase/server";

import {
  requireLeagueMember,
} from "@/lib/leagues/requireLeagueMember";

import NflPlayoffsSalarySettingsEditor from "@/components/nfl-playoffs/NflPlayoffsSalarySettingsEditor";


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

  recent_form_weight:
    number |
    string;

  usage_weight:
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


type LeagueSettingsRow = {
  weekly_salary_cap:
    number |
    string |
    null;
};


type RoundRow = {
  status:
    string |
    null;

  first_kickoff_at:
    string |
    null;

  finalized_at:
    string |
    null;
};


function numberValue(
  value:
    number |
    string |
    null |
    undefined
) {
  const parsed =
    Number(
      value ??
      0
    );

  return Number.isFinite(
    parsed
  )
    ? parsed
    : 0;
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


function postseasonStarted(
  rounds:
    RoundRow[]
) {
  const now =
    Date.now();


  return rounds.some(
    (
      round
    ) => {
      if (
        round.finalized_at
      ) {
        return true;
      }


      if (
        [
          "live",
          "in_progress",
          "in progress",
          "final",
          "finalized",
          "complete",
          "completed",
        ].includes(
          normalizedStatus(
            round.status
          )
        )
      ) {
        return true;
      }


      if (
        round.first_kickoff_at
      ) {
        const kickoff =
          new Date(
            round.first_kickoff_at
          ).getTime();


        if (
          Number.isFinite(
            kickoff
          ) &&
          kickoff <=
            now
        ) {
          return true;
        }
      }


      return false;
    }
  );
}


export default async function NflPlayoffsCommissionerSalaryPage({
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


  /*
   * Salary pricing controls do not apply to No-Salary leagues.
   */

  if (
    access.league
      .playerSelectionMode !==
    "salary"
  ) {
    redirect(
      `/league/${leagueId}/commissioner/nfl-playoffs`
    );
  }


  const season =
    access.league
      .season;


  const supabase =
    await createSupabaseServerClient();


  /*
   * ============================================================
   * ENSURE DEFAULT PRICING SETTINGS EXIST
   * ============================================================
   */

  const existingResult =
    await supabase
      .from(
        "nfl_playoff_salary_settings"
      )
      .select(`
        minimum_salary,
        maximum_salary,
        salary_increment,
        projection_weight,
        qb_multiplier,
        rb_multiplier,
        wr_multiplier,
        te_multiplier,
        k_multiplier,
        dst_multiplier,
        recent_form_weight,
        usage_weight,
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
      .maybeSingle();


  if (
    existingResult.error
  ) {
    throw new Error(
      `Could not load NFL Playoffs salary settings: ${existingResult.error.message}`
    );
  }


  if (
    !existingResult.data
  ) {
    const insertResult =
      await supabase
        .from(
          "nfl_playoff_salary_settings"
        )
        .insert({
          league_id:
            leagueId,
        })
        .select(`
          minimum_salary,
          maximum_salary,
          salary_increment,
          projection_weight,
          qb_multiplier,
          rb_multiplier,
          wr_multiplier,
          te_multiplier,
          k_multiplier,
          dst_multiplier,
          recent_form_weight,
          usage_weight,
          maximum_round_increase,
          maximum_round_decrease,
          questionable_multiplier,
          doubtful_multiplier,
          out_multiplier
        `)
        .single();


    if (
      insertResult.error
    ) {
      throw new Error(
        `Could not initialize NFL Playoffs salary settings: ${insertResult.error.message}`
      );
    }
  }


  /*
   * ============================================================
   * LOAD FINAL CURRENT STATE
   * ============================================================
   */

  const [
    salaryResult,
    leagueSettingsResult,
    roundsResult,
  ] =
    await Promise.all([
      supabase
        .from(
          "nfl_playoff_salary_settings"
        )
        .select(`
          minimum_salary,
          maximum_salary,
          salary_increment,
          projection_weight,
          qb_multiplier,
          rb_multiplier,
          wr_multiplier,
          te_multiplier,
          k_multiplier,
          dst_multiplier,
          recent_form_weight,
          usage_weight,
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
        .single(),

      supabase
        .from(
          "nfl_playoff_settings"
        )
        .select(`
          weekly_salary_cap
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
          status,
          first_kickoff_at,
          finalized_at
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
    salaryResult.error
  ) {
    throw new Error(
      `Could not load NFL Playoffs salary pricing settings: ${salaryResult.error.message}`
    );
  }


  if (
    leagueSettingsResult.error
  ) {
    throw new Error(
      `Could not load NFL Playoffs league settings: ${leagueSettingsResult.error.message}`
    );
  }


  if (
    roundsResult.error
  ) {
    throw new Error(
      `Could not load NFL Playoffs rounds: ${roundsResult.error.message}`
    );
  }


  const salary =
    salaryResult.data as
      SalarySettingsRow;


  const leagueSettings =
    leagueSettingsResult.data as
      LeagueSettingsRow |
      null;


  const rounds =
    (
      roundsResult.data ??
      []
    ) as RoundRow[];


  const locked =
    postseasonStarted(
      rounds
    );


  return (
    <NflPlayoffsSalarySettingsEditor
      leagueId={
        leagueId
      }
      leagueName={
        access.league
          .name
      }
      season={
        season
      }
      salaryCap={
        leagueSettings
          ?.weekly_salary_cap ===
          null ||
        leagueSettings
          ?.weekly_salary_cap ===
          undefined
          ? null
          : numberValue(
              leagueSettings
                .weekly_salary_cap
            )
      }
      settingsLocked={
        locked
      }
      lockedReason={
        locked
          ? "The NFL postseason has already started. Salary-generation rules are now locked so the pricing model cannot change during official competition."
          : null
      }
      initialSettings={{
        minimumSalary:
          numberValue(
            salary.minimum_salary
          ),

        maximumSalary:
          numberValue(
            salary.maximum_salary
          ),

        salaryIncrement:
          numberValue(
            salary.salary_increment
          ),

        projectionWeight:
          numberValue(
            salary.projection_weight
          ),

        recentFormWeight:
          numberValue(
            salary.recent_form_weight
          ),

        usageWeight:
          numberValue(
            salary.usage_weight
          ),

        qbMultiplier:
          numberValue(
            salary.qb_multiplier
          ),

        rbMultiplier:
          numberValue(
            salary.rb_multiplier
          ),

        wrMultiplier:
          numberValue(
            salary.wr_multiplier
          ),

        teMultiplier:
          numberValue(
            salary.te_multiplier
          ),

        kMultiplier:
          numberValue(
            salary.k_multiplier
          ),

        dstMultiplier:
          numberValue(
            salary.dst_multiplier
          ),

        maximumRoundIncrease:
          numberValue(
            salary.maximum_round_increase
          ),

        maximumRoundDecrease:
          numberValue(
            salary.maximum_round_decrease
          ),

        questionableMultiplier:
          numberValue(
            salary.questionable_multiplier
          ),

        doubtfulMultiplier:
          numberValue(
            salary.doubtful_multiplier
          ),

        outMultiplier:
          numberValue(
            salary.out_multiplier
          ),
      }}
    />
  );
}