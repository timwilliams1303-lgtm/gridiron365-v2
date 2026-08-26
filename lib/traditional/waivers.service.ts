import type {
  SupabaseClient,
} from "@supabase/supabase-js";


export type TraditionalWaiverClaimRow = {
  claimId: number;

  fantasyTeamId: number;

  fantasyTeamName: string;

  playerId: number;

  playerName: string;

  playerPosition: string;

  playerTeamAbbreviation:
    string | null;

  playerHeadshotUrl:
    string | null;

  dropPlayerId:
    number | null;

  dropPlayerName:
    string | null;

  priority:
    number | null;

  claimRank:
    number | null;

  faabBid:
    number | null;

  status: string;

  processAfter:
    string | null;

  submittedAt: string;

  processedAt:
    string | null;

  isMyClaim: boolean;
};


export type TraditionalWaiverSettingsData = {
  waiverType: string;

  continuousWaivers: boolean;

  waiverPeriodHours: number;

  faabBudget: number;

  allowFreeAgentAdds: boolean;
};


export type TraditionalWaiversData = {
  activeWeek: number;

  currentPriority:
    number | null;

  settings:
    TraditionalWaiverSettingsData;

  pendingClaims:
    TraditionalWaiverClaimRow[];

  processedClaims:
    TraditionalWaiverClaimRow[];

  myPendingClaims: number;
};


type SeasonStateRow = {
  active_week:
    number | null;
};


type WaiverSettingsRow = {
  waiver_type: string;

  continuous_waivers: boolean;

  waiver_period_hours: number;

  faab_budget: number;

  allow_free_agent_adds: boolean;
};


type WaiverClaimRow = {
  id: number;

  fantasy_team_id: number;

  player_id: number;

  drop_player_id:
    number | null;

  priority:
    number | null;

  claim_rank:
    number | null;

  faab_bid:
    number | null;

  status: string;

  process_after:
    string | null;

  submitted_at: string;

  processed_at:
    string | null;
};


type FantasyTeamRow = {
  id: number;

  team_name: string;
};


type PlayerRow = {
  id: number;

  full_name: string;

  primary_position: string;

  team_abbreviation:
    string | null;

  headshot_url:
    string | null;
};


type PriorityRow = {
  priority:
    number | null;
};


function normalizePosition(
  position: string
) {
  if (
    position === "PK"
  ) {
    return "K";
  }

  return position;
}


export async function getTraditionalWaiversData(
  supabase:
    SupabaseClient,
  leagueId: string,
  season: number,
  myFantasyTeamId:
    number | null
): Promise<TraditionalWaiversData> {
  const {
    data:
      seasonStateData,

    error:
      seasonStateError,
  } =
    await supabase
      .from(
        "traditional_season_state"
      )
      .select(
        "active_week"
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
    seasonStateError
  ) {
    throw new Error(
      `Could not load active week: ${seasonStateError.message}`
    );
  }


  const seasonState =
    seasonStateData as
      SeasonStateRow |
      null;


  const {
    data:
      waiverSettingsData,

    error:
      waiverSettingsError,
  } =
    await supabase
      .from(
        "traditional_waiver_settings"
      )
      .select(`
        waiver_type,
        continuous_waivers,
        waiver_period_hours,
        faab_budget,
        allow_free_agent_adds
      `)
      .eq(
        "league_id",
        leagueId
      )
      .maybeSingle();


  if (
    waiverSettingsError
  ) {
    throw new Error(
      `Could not load waiver settings: ${waiverSettingsError.message}`
    );
  }


  if (
    !waiverSettingsData
  ) {
    throw new Error(
      "Traditional waiver settings were not found."
    );
  }


  const waiverSettings =
    waiverSettingsData as
      WaiverSettingsRow;


  let currentPriority:
    number |
    null =
      null;


  if (
    myFantasyTeamId !==
    null
  ) {
    const {
      data:
        priorityData,

      error:
        priorityError,
    } =
      await supabase
        .from(
          "traditional_waiver_priorities"
        )
        .select(
          "priority"
        )
        .eq(
          "league_id",
          leagueId
        )
        .eq(
          "fantasy_team_id",
          myFantasyTeamId
        )
        .maybeSingle();


    if (
      priorityError
    ) {
      throw new Error(
        `Could not load waiver priority: ${priorityError.message}`
      );
    }


    const priority =
      priorityData as
        PriorityRow |
        null;


    currentPriority =
      priority
        ?.priority ??
      null;
  }


  const {
    data:
      claimsData,

    error:
      claimsError,
  } =
    await supabase
      .from(
        "traditional_waiver_claims"
      )
      .select(`
        id,
        fantasy_team_id,
        player_id,
        drop_player_id,
        priority,
        claim_rank,
        faab_bid,
        status,
        process_after,
        submitted_at,
        processed_at
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
        "submitted_at",
        {
          ascending:
            false,
        }
      );


  if (
    claimsError
  ) {
    throw new Error(
      `Could not load waiver claims: ${claimsError.message}`
    );
  }


  const claimRows =
    (
      claimsData ??
      []
    ) as WaiverClaimRow[];


  const {
    data:
      fantasyTeamData,

    error:
      fantasyTeamError,
  } =
    await supabase
      .from(
        "fantasy_teams"
      )
      .select(
        "id, team_name"
      )
      .eq(
        "league_id",
        leagueId
      );


  if (
    fantasyTeamError
  ) {
    throw new Error(
      `Could not load fantasy teams: ${fantasyTeamError.message}`
    );
  }


  const fantasyTeams =
    (
      fantasyTeamData ??
      []
    ) as FantasyTeamRow[];


  const fantasyTeamNames =
    new Map<
      number,
      string
    >();


  for (
    const team
    of fantasyTeams
  ) {
    fantasyTeamNames.set(
      team.id,
      team.team_name
    );
  }


  const playerIds =
    new Set<number>();


  for (
    const claim
    of claimRows
  ) {
    playerIds.add(
      claim.player_id
    );


    if (
      claim.drop_player_id !==
      null
    ) {
      playerIds.add(
        claim.drop_player_id
      );
    }
  }


  const playerMap =
    new Map<
      number,
      PlayerRow
    >();


  if (
    playerIds.size >
    0
  ) {
    const {
      data:
        playersData,

      error:
        playersError,
    } =
      await supabase
        .from(
          "nfl_players"
        )
        .select(`
          id,
          full_name,
          primary_position,
          team_abbreviation,
          headshot_url
        `)
        .in(
          "id",
          Array.from(
            playerIds
          )
        );


    if (
      playersError
    ) {
      throw new Error(
        `Could not load waiver players: ${playersError.message}`
      );
    }


    for (
      const player
      of (
        playersData ??
        []
      ) as PlayerRow[]
    ) {
      playerMap.set(
        player.id,
        player
      );
    }
  }


  const claims:
    TraditionalWaiverClaimRow[] =
      claimRows.map(
        (
          claim
        ) => {
          const player =
            playerMap.get(
              claim.player_id
            );


          const dropPlayer =
            claim.drop_player_id !==
              null
              ? playerMap.get(
                  claim.drop_player_id
                )
              : undefined;


          return {
            claimId:
              claim.id,

            fantasyTeamId:
              claim.fantasy_team_id,

            fantasyTeamName:
              fantasyTeamNames.get(
                claim.fantasy_team_id
              ) ??
              "Unknown Team",

            playerId:
              claim.player_id,

            playerName:
              player
                ?.full_name ??
              "Unknown Player",

            playerPosition:
              normalizePosition(
                player
                  ?.primary_position ??
                "—"
              ),

            playerTeamAbbreviation:
              player
                ?.team_abbreviation ??
              null,

            playerHeadshotUrl:
              player
                ?.headshot_url ??
              null,

            dropPlayerId:
              claim
                .drop_player_id,

            dropPlayerName:
              dropPlayer
                ?.full_name ??
              null,

            priority:
              claim.priority,

            claimRank:
              claim.claim_rank,

            faabBid:
              claim.faab_bid,

            status:
              claim.status,

            processAfter:
              claim
                .process_after,

            submittedAt:
              claim
                .submitted_at,

            processedAt:
              claim
                .processed_at,

            isMyClaim:
              myFantasyTeamId !==
                null &&
              claim.fantasy_team_id ===
                myFantasyTeamId,
          };
        }
      );


  const pendingClaims =
    claims
      .filter(
        (
          claim
        ) =>
          claim.status ===
            "pending" &&
          claim.isMyClaim
      )
      .sort(
        (
          a,
          b
        ) => {
          const aRank =
            a.claimRank ??
            Number.MAX_SAFE_INTEGER;

          const bRank =
            b.claimRank ??
            Number.MAX_SAFE_INTEGER;


          if (
            aRank !==
            bRank
          ) {
            return (
              aRank -
              bRank
            );
          }


          return (
            new Date(
              a.submittedAt
            ).getTime() -
            new Date(
              b.submittedAt
            ).getTime()
          );
        }
      );


  const processedClaims =
    claims.filter(
      (
        claim
      ) =>
        claim.status !==
          "pending"
    );


  return {
    activeWeek:
      seasonState
        ?.active_week ??
      1,

    currentPriority,

    settings: {
      waiverType:
        waiverSettings
          .waiver_type,

      continuousWaivers:
        waiverSettings
          .continuous_waivers,

      waiverPeriodHours:
        waiverSettings
          .waiver_period_hours,

      faabBudget:
        waiverSettings
          .faab_budget,

      allowFreeAgentAdds:
        waiverSettings
          .allow_free_agent_adds,
    },

    pendingClaims,

    processedClaims,

    myPendingClaims:
      pendingClaims.length,
  };
}