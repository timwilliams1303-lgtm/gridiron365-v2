import {
  redirect,
} from "next/navigation";

import NflPlayoffsCommissionerSettingsEditor from "@/components/nfl-playoffs/NflPlayoffsCommissionerSettingsEditor";

import {
  requireLeagueMember,
} from "@/lib/leagues/requireLeagueMember";

import {
  createSupabaseServerClient,
} from "@/lib/supabase/server";


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


type RoundRow = {
  round_number:
    number;

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


function normalizeStatus(
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


function hasPostseasonStarted(
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
          normalizeStatus(
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


export default async function NflPlayoffsCommissionerSettingsPage({
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


  const rawMode =
    access.league
      .playerSelectionMode;


  if (
    rawMode !==
      "salary" &&
    rawMode !==
      "no_salary"
  ) {
    throw new Error(
      "NFL Playoffs leagues must use Salary or No-Salary player selection."
    );
  }


  const isSalary =
    rawMode ===
    "salary";


  const season =
    access.league
      .season;


  const supabase =
    await createSupabaseServerClient();


  /*
   * ============================================================
   * LOAD CURRENT SETTINGS + ROUND STATE
   * ============================================================
   */

  const [
    settingsResult,
    roundsResult,
  ] =
    await Promise.all([
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
          "nfl_playoff_rounds"
        )
        .select(`
          round_number,
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
        )
        .order(
          "round_number",
          {
            ascending:
              true,
          }
        ),
    ]);


  if (
    settingsResult.error
  ) {
    throw new Error(
      `Could not load NFL Playoffs settings: ${settingsResult.error.message}`
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
    !settingsResult.data
  ) {
    throw new Error(
      "NFL Playoffs settings have not been initialized for this league."
    );
  }


  const settings =
    settingsResult.data as
      SettingsRow;


  const rounds =
    (
      roundsResult.data ??
      []
    ) as RoundRow[];


  const settingsLocked =
    hasPostseasonStarted(
      rounds
    );


  return (
    <NflPlayoffsCommissionerSettingsEditor
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
      isSalary={
        isSalary
      }
      settingsLocked={
        settingsLocked
      }
      lockedReason={
        settingsLocked
          ? "The NFL postseason has already started. League-wide roster requirements and the Salary-mode cap are now protected from changes."
          : null
      }
      initialSettings={{
        weeklySalaryCap:
          isSalary
            ? numberValue(
                settings.weekly_salary_cap
              )
            : null,

        startingQb:
          numberValue(
            settings.starting_qb
          ),

        startingRb:
          numberValue(
            settings.starting_rb
          ),

        startingWr:
          numberValue(
            settings.starting_wr
          ),

        startingTe:
          numberValue(
            settings.starting_te
          ),

        startingFlex:
          numberValue(
            settings.starting_flex
          ),

        startingSuperflex:
          numberValue(
            settings.starting_superflex
          ),

        startingK:
          numberValue(
            settings.starting_k
          ),

        startingDst:
          numberValue(
            settings.starting_dst
          ),
      }}
    />
  );
}