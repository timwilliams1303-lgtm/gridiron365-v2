import {
  redirect,
} from "next/navigation";

import NflPlayoffsLeagueTeamsRealtime from "@/components/nfl-playoffs/NflPlayoffsLeagueTeamsRealtime";

import {
  requireLeagueMember,
} from "@/lib/leagues/requireLeagueMember";

import {
  createSupabaseServerClient,
} from "@/lib/supabase/server";


type PageProps = {
  params: Promise<{
    leagueId: string;
  }>;
};


type LeagueStateRow = {
  active_round:
    number |
    null;
};


function validRound(
  value:
    number |
    null |
    undefined
) {
  const parsed =
    Number(
      value
    );


  if (
    !Number.isInteger(
      parsed
    ) ||
    parsed < 1 ||
    parsed > 4
  ) {
    return 1;
  }


  return parsed;
}


export default async function NflPlayoffsTeamsPage({
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


  const {
    data:
      stateData,

    error:
      stateError,
  } =
    await supabase
      .from(
        "nfl_playoff_league_state"
      )
      .select(
        "active_round"
      )
      .eq(
        "league_id",
        leagueId
      )
      .eq(
        "season",
        season
      )
      .maybeSingle();


  if (
    stateError
  ) {
    throw new Error(
      `Could not load NFL Playoffs league state: ${stateError.message}`
    );
  }


  const state =
    stateData as
      LeagueStateRow |
      null;


  const roundNumber =
    validRound(
      state?.active_round
    );


  return (
    <NflPlayoffsLeagueTeamsRealtime
      leagueId={
        leagueId
      }
      season={
        season
      }
      roundNumber={
        roundNumber
      }
    />
  );
}