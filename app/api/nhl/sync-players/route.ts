import {
  NextResponse,
} from "next/server";

import {
  createClient,
} from "@supabase/supabase-js";


export const dynamic =
  "force-dynamic";

export const maxDuration =
  300;


/* =========================================================
   TYPES
========================================================= */

type SyncPlayersRequestBody = {
  season?: number;
  team?: string;
};


type NhlTeamRow = {
  id: number;
  abbreviation: string;
  display_name: string;
  active: boolean;
};


type LocalizedText = {
  default?: string;
};


type NhlRosterPlayer = {
  id?: number;

  firstName?:
    LocalizedText;

  lastName?:
    LocalizedText;

  headshot?:
    string;

  sweaterNumber?:
    number;

  positionCode?:
    string;

  shootsCatches?:
    string;

  heightInInches?:
    number;

  weightInPounds?:
    number;

  heightInCentimeters?:
    number;

  weightInKilograms?:
    number;

  birthDate?:
    string;

  birthCity?:
    LocalizedText;

  birthStateProvince?:
    LocalizedText;

  birthCountry?:
    string;
};


type NhlRosterResponse = {
  forwards?:
    NhlRosterPlayer[];

  defensemen?:
    NhlRosterPlayer[];

  goalies?:
    NhlRosterPlayer[];
};


type NhlPlayerUpsertRow = {
  nhl_player_id:
    string;

  team_id:
    number;

  first_name:
    string | null;

  last_name:
    string | null;

  display_name:
    string;

  short_name:
    string | null;

  jersey_number:
    string | null;

  position:
    string | null;

  position_group:
    "FORWARD" |
    "DEFENSE" |
    "GOALIE" |
    null;

  shoots_catches:
    string | null;

  active:
    boolean;

  status:
    string | null;

  injury_status:
    string | null;

  headshot_url:
    string | null;

  provider_data:
    Record<
      string,
      unknown
    >;

  updated_at:
    string;
};


type TeamSyncResult = {
  teamId:
    number;

  abbreviation:
    string;

  officialNhlAbbreviation:
    string;

  displayName:
    string;

  rosterUrl:
    string;

  success:
    boolean;

  playersReceived:
    number;

  playersUpserted:
    number;

  forwards:
    number;

  defensemen:
    number;

  goalies:
    number;

  error?:
    string;
};


/* =========================================================
   SUPABASE
========================================================= */

function createSupabaseAdmin() {
  const supabaseUrl =
    process.env
      .NEXT_PUBLIC_SUPABASE_URL;

  const serviceRoleKey =
    process.env
      .SUPABASE_SERVICE_ROLE_KEY;

  if (
    !supabaseUrl ||
    !serviceRoleKey
  ) {
    throw new Error(
      "Missing Supabase server environment variables."
    );
  }

  return createClient(
    supabaseUrl,
    serviceRoleKey,
    {
      auth: {
        persistSession:
          false,

        autoRefreshToken:
          false,

        detectSessionInUrl:
          false,
      },
    }
  );
}


/* =========================================================
   AUTHORIZATION
========================================================= */

function isAuthorized(
  request:
    Request
) {
  if (
    process.env.NODE_ENV !==
    "production"
  ) {
    return true;
  }

  const configuredSecret =
    process.env
      .GRIDIRON_SYNC_SECRET ??
    process.env
      .NFL_SYNC_SECRET;

  if (
    !configuredSecret
  ) {
    return false;
  }

  const headerSecret =
    request.headers.get(
      "x-gridiron-sync-secret"
    );

  const authorization =
    request.headers.get(
      "authorization"
    );

  const bearerSecret =
    authorization
      ?.startsWith(
        "Bearer "
      )
      ? authorization.slice(
          7
        )
      : null;

  return (
    headerSecret ===
      configuredSecret ||
    bearerSecret ===
      configuredSecret
  );
}


/* =========================================================
   HELPERS
========================================================= */

function cleanText(
  value:
    unknown
) {
  if (
    typeof value !==
    "string"
  ) {
    return null;
  }

  const trimmed =
    value.trim();

  return (
    trimmed.length >
    0
  )
    ? trimmed
    : null;
}


function localizedText(
  value:
    LocalizedText |
    undefined
) {
  return cleanText(
    value?.default
  );
}


function buildDisplayName(
  player:
    NhlRosterPlayer
) {
  const firstName =
    localizedText(
      player.firstName
    );

  const lastName =
    localizedText(
      player.lastName
    );

  return [
    firstName,
    lastName,
  ]
    .filter(
      Boolean
    )
    .join(
      " "
    )
    .trim();
}


function buildShortName(
  player:
    NhlRosterPlayer
) {
  const firstName =
    localizedText(
      player.firstName
    );

  const lastName =
    localizedText(
      player.lastName
    );

  if (
    firstName &&
    lastName
  ) {
    return `${firstName.charAt(
      0
    )}. ${lastName}`;
  }

  return (
    lastName ??
    firstName ??
    null
  );
}


function normalizePosition(
  value:
    unknown
) {
  const position =
    cleanText(
      value
    )
      ?.toUpperCase();

  if (
    !position
  ) {
    return null;
  }

  if (
    position ===
    "C"
  ) {
    return "C";
  }

  if (
    position ===
    "L"
  ) {
    return "LW";
  }

  if (
    position ===
    "R"
  ) {
    return "RW";
  }

  if (
    position ===
    "D"
  ) {
    return "D";
  }

  if (
    position ===
    "G"
  ) {
    return "G";
  }

  return position;
}


function getPositionGroup(
  position:
    string | null
):
  "FORWARD" |
  "DEFENSE" |
  "GOALIE" |
  null {
  if (
    position ===
      "C" ||
    position ===
      "LW" ||
    position ===
      "RW"
  ) {
    return "FORWARD";
  }

  if (
    position ===
    "D"
  ) {
    return "DEFENSE";
  }

  if (
    position ===
    "G"
  ) {
    return "GOALIE";
  }

  return null;
}


/* =========================================================
   NHL ABBREVIATION MAPPING

   Keep Gridiron365's internal abbreviations unchanged.

   Only translate when calling the official NHL API.
========================================================= */

function getOfficialNhlAbbreviation(
  abbreviation:
    string
) {
  const normalized =
    abbreviation
      .trim()
      .toUpperCase();

  const mappings:
    Record<
      string,
      string
    > = {
      LA:
        "LAK",

      NJ:
        "NJD",

      SJ:
        "SJS",

      TB:
        "TBL",

      UTAH:
        "UTA",
    };

  return (
    mappings[
      normalized
    ] ??
    normalized
  );
}


function buildSeasonKey(
  season:
    number
) {
  return `${season}${season + 1}`;
}


function buildRosterUrl(
  abbreviation:
    string,
  season:
    number
) {
  const officialNhlAbbreviation =
    getOfficialNhlAbbreviation(
      abbreviation
    );

  return (
    "https://api-web.nhle.com/v1/roster/" +
    `${encodeURIComponent(
      officialNhlAbbreviation
    )}/` +
    buildSeasonKey(
      season
    )
  );
}


async function fetchRoster(
  abbreviation:
    string,
  season:
    number
) {
  const officialNhlAbbreviation =
    getOfficialNhlAbbreviation(
      abbreviation
    );

  const url =
    buildRosterUrl(
      abbreviation,
      season
    );

  const response =
    await fetch(
      url,
      {
        method:
          "GET",

        headers: {
          Accept:
            "application/json",

          "User-Agent":
            "Gridiron365/1.0",
        },

        cache:
          "no-store",
      }
    );

  const text =
    await response.text();

  if (
    !response.ok
  ) {
    throw new Error(
      `NHL roster request failed for ${abbreviation} (${officialNhlAbbreviation}): HTTP ${response.status} ${response.statusText}. ${text.slice(
        0,
        300
      )}`
    );
  }

  let parsed:
    unknown;

  try {
    parsed =
      JSON.parse(
        text
      );
  } catch {
    throw new Error(
      `NHL roster response for ${abbreviation} (${officialNhlAbbreviation}) was not valid JSON.`
    );
  }

  return {
    url,

    officialNhlAbbreviation,

    roster:
      parsed as
        NhlRosterResponse,
  };
}


/* =========================================================
   PLAYER NORMALIZATION
========================================================= */

function normalizePlayer({
  player,
  team,
  rosterGroup,
  season,
}: {
  player:
    NhlRosterPlayer;

  team:
    NhlTeamRow;

  rosterGroup:
    "forward" |
    "defenseman" |
    "goalie";

  season:
    number;
}):
  NhlPlayerUpsertRow |
  null {
  if (
    !player.id
  ) {
    return null;
  }

  const displayName =
    buildDisplayName(
      player
    );

  if (
    !displayName
  ) {
    return null;
  }

  const firstName =
    localizedText(
      player.firstName
    );

  const lastName =
    localizedText(
      player.lastName
    );

  const position =
    normalizePosition(
      player.positionCode
    );

  const officialNhlAbbreviation =
    getOfficialNhlAbbreviation(
      team.abbreviation
    );

  const now =
    new Date()
      .toISOString();

  return {
    nhl_player_id:
      String(
        player.id
      ),

    team_id:
      team.id,

    first_name:
      firstName,

    last_name:
      lastName,

    display_name:
      displayName,

    short_name:
      buildShortName(
        player
      ),

    jersey_number:
      player.sweaterNumber !==
        undefined &&
      player.sweaterNumber !==
        null
        ? String(
            player
              .sweaterNumber
          )
        : null,

    position,

    position_group:
      getPositionGroup(
        position
      ),

    shoots_catches:
      cleanText(
        player
          .shootsCatches
      ),

    active:
      true,

    status:
      "active",

    injury_status:
      null,

    headshot_url:
      cleanText(
        player.headshot
      ),

    provider_data: {
      provider:
        "NHL",

      source:
        "api-web.nhle.com",

      rosterGroup,

      internalTeamAbbreviation:
        team.abbreviation,

      officialNhlTeamAbbreviation:
        officialNhlAbbreviation,

      teamDisplayName:
        team.display_name,

      seasonStartYear:
        season,

      seasonKey:
        buildSeasonKey(
          season
        ),

      heightInInches:
        player
          .heightInInches ??
        null,

      weightInPounds:
        player
          .weightInPounds ??
        null,

      heightInCentimeters:
        player
          .heightInCentimeters ??
        null,

      weightInKilograms:
        player
          .weightInKilograms ??
        null,

      birthDate:
        player.birthDate ??
        null,

      birthCity:
        localizedText(
          player.birthCity
        ),

      birthStateProvince:
        localizedText(
          player
            .birthStateProvince
        ),

      birthCountry:
        cleanText(
          player
            .birthCountry
        ),

      rawPlayer:
        player,
    },

    updated_at:
      now,
  };
}


/* =========================================================
   UPSERT
========================================================= */

async function upsertPlayers(
  supabase:
    ReturnType<
      typeof createSupabaseAdmin
    >,

  rows:
    NhlPlayerUpsertRow[]
) {
  if (
    rows.length ===
    0
  ) {
    return 0;
  }

  const batchSize =
    250;

  let total =
    0;

  for (
    let index = 0;
    index < rows.length;
    index += batchSize
  ) {
    const batch =
      rows.slice(
        index,
        index +
          batchSize
      );

    const {
      error,
    } =
      await supabase
        .from(
          "nhl_players"
        )
        .upsert(
          batch,
          {
            onConflict:
              "nhl_player_id",
          }
        );

    if (
      error
    ) {
      throw new Error(
        `NHL player upsert failed: ${error.message}`
      );
    }

    total +=
      batch.length;
  }

  return total;
}


/* =========================================================
   SYNC ONE TEAM
========================================================= */

async function syncTeam({
  supabase,
  team,
  season,
}: {
  supabase:
    ReturnType<
      typeof createSupabaseAdmin
    >;

  team:
    NhlTeamRow;

  season:
    number;
}):
  Promise<TeamSyncResult> {
  const officialNhlAbbreviation =
    getOfficialNhlAbbreviation(
      team.abbreviation
    );

  const rosterUrl =
    buildRosterUrl(
      team.abbreviation,
      season
    );

  try {
    const {
      roster,
    } =
      await fetchRoster(
        team.abbreviation,
        season
      );

    const forwards =
      Array.isArray(
        roster.forwards
      )
        ? roster.forwards
        : [];

    const defensemen =
      Array.isArray(
        roster.defensemen
      )
        ? roster.defensemen
        : [];

    const goalies =
      Array.isArray(
        roster.goalies
      )
        ? roster.goalies
        : [];

    const rows:
      NhlPlayerUpsertRow[] =
      [];

    for (
      const player
      of forwards
    ) {
      const row =
        normalizePlayer({
          player,
          team,
          rosterGroup:
            "forward",
          season,
        });

      if (
        row
      ) {
        rows.push(
          row
        );
      }
    }

    for (
      const player
      of defensemen
    ) {
      const row =
        normalizePlayer({
          player,
          team,
          rosterGroup:
            "defenseman",
          season,
        });

      if (
        row
      ) {
        rows.push(
          row
        );
      }
    }

    for (
      const player
      of goalies
    ) {
      const row =
        normalizePlayer({
          player,
          team,
          rosterGroup:
            "goalie",
          season,
        });

      if (
        row
      ) {
        rows.push(
          row
        );
      }
    }

    const uniqueRows =
      Array.from(
        new Map(
          rows.map(
            row => [
              row.nhl_player_id,
              row,
            ]
          )
        ).values()
      );

    const playersUpserted =
      await upsertPlayers(
        supabase,
        uniqueRows
      );

    return {
      teamId:
        team.id,

      abbreviation:
        team.abbreviation,

      officialNhlAbbreviation,

      displayName:
        team.display_name,

      rosterUrl,

      success:
        true,

      playersReceived:
        forwards.length +
        defensemen.length +
        goalies.length,

      playersUpserted,

      forwards:
        forwards.length,

      defensemen:
        defensemen.length,

      goalies:
        goalies.length,
    };
  } catch (
    error
  ) {
    return {
      teamId:
        team.id,

      abbreviation:
        team.abbreviation,

      officialNhlAbbreviation,

      displayName:
        team.display_name,

      rosterUrl,

      success:
        false,

      playersReceived:
        0,

      playersUpserted:
        0,

      forwards:
        0,

      defensemen:
        0,

      goalies:
        0,

      error:
        error instanceof
        Error
          ? error.message
          : "Unknown NHL roster sync error.",
    };
  }
}


/* =========================================================
   POST
========================================================= */

export async function POST(
  request:
    Request
) {
  const startedAt =
    Date.now();

  try {
    if (
      !isAuthorized(
        request
      )
    ) {
      return NextResponse.json(
        {
          success:
            false,

          error:
            "Unauthorized NHL player sync request.",
        },
        {
          status:
            401,
        }
      );
    }


    let body:
      SyncPlayersRequestBody =
      {};

    try {
      body =
        (
          await request.json()
        ) as
          SyncPlayersRequestBody;
    } catch {
      body = {};
    }


    const season =
      body.season ===
      undefined
        ? 2026
        : Number(
            body.season
          );


    if (
      !Number.isInteger(
        season
      ) ||
      season <
        2000 ||
      season >
        2200
    ) {
      return NextResponse.json(
        {
          success:
            false,

          error:
            "A valid NHL season start year is required.",
        },
        {
          status:
            400,
        }
      );
    }


    const requestedTeam =
      cleanText(
        body.team
      )
        ?.toUpperCase() ??
      null;


    const supabase =
      createSupabaseAdmin();


    /* =====================================================
       LOAD ACTIVE NHL TEAMS
    ===================================================== */

    let teamQuery =
      supabase
        .from(
          "nhl_teams"
        )
        .select(
          "id, abbreviation, display_name, active"
        )
        .eq(
          "active",
          true
        );


    if (
      requestedTeam
    ) {
      teamQuery =
        teamQuery.eq(
          "abbreviation",
          requestedTeam
        );
    }


    const {
      data:
        teamData,

      error:
        teamError,
    } =
      await teamQuery
        .order(
          "abbreviation",
          {
            ascending:
              true,
          }
        );


    if (
      teamError
    ) {
      throw new Error(
        `Unable to load NHL teams: ${teamError.message}`
      );
    }


    const teams =
      (
        teamData ??
        []
      ) as
        NhlTeamRow[];


    if (
      teams.length ===
      0
    ) {
      return NextResponse.json(
        {
          success:
            false,

          error:
            requestedTeam
              ? `Active NHL team ${requestedTeam} was not found in nhl_teams.`
              : "No active NHL teams were found. Sync NHL teams first.",
        },
        {
          status:
            404,
        }
      );
    }


    /* =====================================================
       SYNC ROSTERS
    ===================================================== */

    const results:
      TeamSyncResult[] =
      [];


    for (
      const team
      of teams
    ) {
      const result =
        await syncTeam({
          supabase,
          team,
          season,
        });

      results.push(
        result
      );
    }


    /* =====================================================
       SUMMARY
    ===================================================== */

    const successfulTeams =
      results.filter(
        row =>
          row.success
      );

    const failedTeams =
      results.filter(
        row =>
          !row.success
      );

    const playersReceived =
      successfulTeams.reduce(
        (
          total,
          row
        ) =>
          total +
          row.playersReceived,
        0
      );

    const playersUpserted =
      successfulTeams.reduce(
        (
          total,
          row
        ) =>
          total +
          row.playersUpserted,
        0
      );

    const forwards =
      successfulTeams.reduce(
        (
          total,
          row
        ) =>
          total +
          row.forwards,
        0
      );

    const defensemen =
      successfulTeams.reduce(
        (
          total,
          row
        ) =>
          total +
          row.defensemen,
        0
      );

    const goalies =
      successfulTeams.reduce(
        (
          total,
          row
        ) =>
          total +
          row.goalies,
        0
      );


    return NextResponse.json({
      success:
        failedTeams.length ===
        0,

      provider:
        "NHL",

      source:
        "api-web.nhle.com",

      season,

      seasonKey:
        buildSeasonKey(
          season
        ),

      requestedTeam,

      teamsRequested:
        teams.length,

      teamsProcessed:
        successfulTeams.length,

      teamsFailed:
        failedTeams.length,

      playersReceived,

      playersUpserted,

      positionCounts: {
        forwards,
        defensemen,
        goalies,
      },

      failures:
        failedTeams.map(
          row => ({
            abbreviation:
              row.abbreviation,

            officialNhlAbbreviation:
              row.officialNhlAbbreviation,

            error:
              row.error,
          })
        ),

      results,

      completedAt:
        new Date()
          .toISOString(),

      durationMs:
        Date.now() -
        startedAt,
    });
  } catch (
    error
  ) {
    console.error(
      "NHL player sync failed:",
      error
    );

    return NextResponse.json(
      {
        success:
          false,

        error:
          error instanceof
          Error
            ? error.message
            : "NHL player sync failed.",
      },
      {
        status:
          500,
      }
    );
  }
}