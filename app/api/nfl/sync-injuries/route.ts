import {
  NextResponse,
} from "next/server";

import {
  createClient,
} from "@supabase/supabase-js";

import {
  createSupabaseServerClient,
} from "@/lib/supabase/server";


export const dynamic =
  "force-dynamic";

export const maxDuration =
  300;


/* =========================================================
   TYPES
========================================================= */

type EspnLink = {
  href?: string;
  rel?: string[];
};


type EspnAthlete = {
  firstName?: string;
  lastName?: string;
  displayName?: string;
  shortName?: string;

  links?: EspnLink[];

  position?: {
    abbreviation?: string;
  };

  team?: {
    id?: string;
    abbreviation?: string;
    displayName?: string;
  };

  notes?: {
    items?: Array<{
      id?: string;
      type?: string;
      date?: string;
      headline?: string;
      text?: string;
      source?: string;
    }>;
  };

  status?: {
    id?: string;
    name?: string;
    type?: string;
    abbreviation?: string;
  };
};


type EspnInjury = {
  id?: string;

  longComment?: string;
  shortComment?: string;

  status?: string;

  date?: string;

  athlete?: EspnAthlete;

  source?: {
    id?: string;
    description?: string;
    state?: string;
  };

  type?: {
    id?: string;
    name?: string;
    description?: string;
    abbreviation?: string;
  };
};


type EspnTeamInjuries = {
  id?: string;
  displayName?: string;
  injuries?: EspnInjury[];
};


type EspnInjuryResponse = {
  timestamp?: string;

  status?: string;

  season?: {
    year?: number;
    type?: number;
    name?: string;
    displayName?: string;
  };

  injuries?: EspnTeamInjuries[];
};


type NflPlayer = {
  id: number;

  espn_player_id:
    string | null;

  full_name:
    string;

  primary_position:
    string;

  team_abbreviation:
    string | null;
};


type ExistingInjury = {
  id: number;

  nfl_player_id:
    number;

  espn_player_id:
    string;

  season:
    number;

  status:
    string | null;

  injury_type:
    string | null;

  injury_location:
    string | null;

  injury_detail:
    string | null;

  injury_date:
    string | null;

  return_date:
    string | null;

  source_updated_at:
    string | null;

  is_active:
    boolean;

  first_seen_at:
    string;

  last_seen_at:
    string;
};


type EspnPlayerRecord = {
  espnPlayerId:
    string;

  fullName:
    string;

  team:
    string | null;

  position:
    string | null;

  rawStatus:
    string | null;

  status:
    string | null;

  injuryType:
    string | null;

  injuryLocation:
    string | null;

  injuryDetail:
    string | null;

  injuryDate:
    string | null;

  sourceUpdatedAt:
    string | null;
};


type NormalizedInjury = {
  nfl_player_id:
    number;

  espn_player_id:
    string;

  season:
    number;

  status:
    string | null;

  injury_type:
    string | null;

  injury_location:
    string | null;

  injury_detail:
    string | null;

  injury_date:
    string | null;

  return_date:
    string | null;

  source_updated_at:
    string | null;
};


/* =========================================================
   SUPABASE
========================================================= */

function getAdminClient() {
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

async function authorizeSync(
  request: Request
) {
  /*
   * Manual admin sync:
   * accept the normal Gridiron365 Supabase SSR cookie session.
   */
  try {
    const serverSupabase =
      await createSupabaseServerClient();

    const {
      data: {
        user,
      },
      error:
        userError,
    } =
      await serverSupabase.auth
        .getUser();

    if (
      !userError &&
      user
    ) {
      return {
        authorized:
          true,

        response:
          null,

        authMode:
          "user_session",
      };
    }
  } catch {
    /*
     * Fall through to the server-secret path.
     * Automated cron/server callers do not need a browser session.
     */
  }


  /*
   * Automated sync:
   * preserve the existing x-gridiron-sync-secret authorization.
   */
  const configuredSecret =
    process.env
      .GRIDIRON_SYNC_SECRET ??
    process.env
      .NFL_SYNC_SECRET;

  if (!configuredSecret) {
    return {
      authorized:
        false,

      response:
        NextResponse.json(
          {
            success:
              false,

            error:
              "GRIDIRON_SYNC_SECRET / NFL_SYNC_SECRET is not configured on the server.",
          },
          {
            status:
              500,
          }
        ),

      authMode:
        null,
    };
  }


  const suppliedSecret =
    request.headers.get(
      "x-gridiron-sync-secret"
    );


  if (
    suppliedSecret !==
    configuredSecret
  ) {
    return {
      authorized:
        false,

      response:
        NextResponse.json(
          {
            success:
              false,

            error:
              "Unauthorized injury sync request.",
          },
          {
            status:
              401,
          }
        ),

      authMode:
        null,
    };
  }


  return {
    authorized:
      true,

    response:
      null,

    authMode:
      "sync_secret",
  };
}

/* =========================================================
   ESPN PLAYER ID
========================================================= */

function extractEspnPlayerId(
  athlete:
    EspnAthlete |
    undefined
) {
  if (!athlete) {
    return null;
  }


  const links =
    athlete.links ??
    [];


  for (
    const link
    of links
  ) {
    const href =
      link.href;


    if (!href) {
      continue;
    }


    const normalMatch =
      href.match(
        /\/id\/(\d+)/
      );


    if (
      normalMatch?.[1]
    ) {
      return normalMatch[1];
    }


    const appMatch =
      href.match(
        /~a:(\d+)/
      );


    if (
      appMatch?.[1]
    ) {
      return appMatch[1];
    }
  }


  return null;
}


/* =========================================================
   NORMALIZATION
========================================================= */

function normalizeText(
  value:
    string |
    null |
    undefined
) {
  const trimmed =
    value?.trim();


  return trimmed
    ? trimmed
    : null;
}


function normalizeDate(
  value:
    string |
    null |
    undefined
) {
  if (!value) {
    return null;
  }


  const parsed =
    new Date(
      value
    );


  if (
    Number.isNaN(
      parsed.getTime()
    )
  ) {
    return null;
  }


  return parsed
    .toISOString()
    .slice(
      0,
      10
    );
}


function normalizeDateTime(
  value:
    string |
    null |
    undefined
) {
  if (!value) {
    return null;
  }


  const parsed =
    new Date(
      value
    );


  if (
    Number.isNaN(
      parsed.getTime()
    )
  ) {
    return null;
  }


  return parsed
    .toISOString();
}


function normalizePosition(
  value:
    string |
    null |
    undefined
) {
  const position =
    (
      value ??
      ""
    )
      .trim()
      .toUpperCase();


  if (
    position ===
    "PK"
  ) {
    return "K";
  }


  if (
    position ===
    "FB"
  ) {
    return "RB";
  }


  return position;
}


/* =========================================================
   CURRENT INJURY STATUSES
========================================================= */

function normalizeInjuryStatus(
  value:
    string |
    null |
    undefined
) {
  const status =
    normalizeText(
      value
    );


  if (!status) {
    return null;
  }


  const normalized =
    status
      .toLowerCase()
      .replace(
        /[_-]+/g,
        " "
      )
      .replace(
        /\s+/g,
        " "
      )
      .trim();


  const statusMap:
    Record<
      string,
      string
    > =
  {
    questionable:
      "Questionable",

    doubtful:
      "Doubtful",

    out:
      "Out",

    "injured reserve":
      "Injured Reserve",

    "injury reserve":
      "Injured Reserve",

    ir:
      "Injured Reserve",

    "reserve injured":
      "Injured Reserve",

    "reserve injured list":
      "Injured Reserve",

    "physically unable to perform":
      "PUP",

    pup:
      "PUP",

    "active pup":
      "PUP",

    "reserve pup":
      "PUP",

    "non football injury":
      "NFI",

    nfi:
      "NFI",

    "reserve nfi":
      "NFI",

    suspended:
      "Suspended",

    suspension:
      "Suspended",

    probable:
      "Probable",

    "day to day":
      "Day-To-Day",

    "day-to-day":
      "Day-To-Day",

    inactive:
      "Inactive",
  };


  return (
    statusMap[
      normalized
    ] ??
    null
  );
}


function findInjuryLocation(
  value: string | null | undefined
) {
  const text = (value ?? "").trim().toLowerCase();
  if (!text) return null;

  const locations: Array<{ pattern: RegExp; label: string }> = [
    { pattern: /\bachilles\b/i, label: "Achilles" },
    { pattern: /\bhamstring\b/i, label: "Hamstring" },
    { pattern: /\bquadriceps\b|\bquad\b/i, label: "Quadriceps" },
    { pattern: /\bconcussion\b/i, label: "Concussion" },
    { pattern: /\bknee\b/i, label: "Knee" },
    { pattern: /\bankle\b/i, label: "Ankle" },
    { pattern: /\bshoulder\b/i, label: "Shoulder" },
    { pattern: /\bfoot\b/i, label: "Foot" },
    { pattern: /\btoe\b/i, label: "Toe" },
    { pattern: /\bcalf\b/i, label: "Calf" },
    { pattern: /\bgroin\b/i, label: "Groin" },
    { pattern: /\bhip\b/i, label: "Hip" },
    { pattern: /\bthigh\b/i, label: "Thigh" },
    { pattern: /\bback\b/i, label: "Back" },
    { pattern: /\bneck\b/i, label: "Neck" },
    { pattern: /\bchest\b/i, label: "Chest" },
    { pattern: /\brib(?:s)?\b/i, label: "Rib" },
    { pattern: /\belbow\b/i, label: "Elbow" },
    { pattern: /\bwrist\b/i, label: "Wrist" },
    { pattern: /\bhand\b/i, label: "Hand" },
    { pattern: /\bfinger\b/i, label: "Finger" },
    { pattern: /\bheel\b/i, label: "Heel" },
    { pattern: /\bleg\b/i, label: "Leg" },
    { pattern: /\bhead\b/i, label: "Head" },
  ];

  for (const location of locations) {
    if (location.pattern.test(text)) return location.label;
  }
  return null;
}

function inferInjuryLocation(
  ...values: Array<string | null | undefined>
) {
  // Search each source in priority order instead of concatenating all text.
  // This makes ESPN's explicit injury description win over lower-priority
  // prose such as "back at practice" in a news note.
  for (const value of values) {
    const location = findInjuryLocation(value);
    if (location) return location;
  }
  return null;
}


function hasCredibleInjuryInformation(
  record:
    EspnPlayerRecord
) {
  return Boolean(
    record.injuryType ||
    record.injuryDetail ||
    record.injuryDate
  );
}


function fallbackStatusForInjuryNews(
  rawStatus:
    string |
    null,
  hasInjuryInfo:
    boolean
) {
  if (
    !hasInjuryInfo
  ) {
    return null;
  }

  const normalizedRaw =
    (
      rawStatus ??
      ""
    )
      .trim()
      .toLowerCase();

  if (
    normalizedRaw ===
      "active" ||
    normalizedRaw ===
      "healthy"
  ) {
    return null;
  }

  return "Injury";
}


/* =========================================================
   FINGERPRINT
========================================================= */

function fingerprint(
  injury: {
    status:
      string | null;

    injury_type:
      string | null;

    injury_location:
      string | null;

    injury_detail:
      string | null;

    injury_date:
      string | null;

    return_date:
      string | null;
  }
) {
  return JSON.stringify({
    status:
      injury.status ??
      "",

    injuryType:
      injury.injury_type ??
      "",

    injuryLocation:
      injury.injury_location ??
      "",

    injuryDetail:
      injury.injury_detail ??
      "",

    injuryDate:
      injury.injury_date ??
      "",

    returnDate:
      injury.return_date ??
      "",
  });
}


/* =========================================================
   POST
========================================================= */

export async function POST(
  request: Request
) {
  const authorization =
    await authorizeSync(
      request
    );


  if (
    !authorization.authorized
  ) {
    return authorization
      .response!;
  }


  const startedAt =
    Date.now();


  try {
    const supabase =
      getAdminClient();


    /* =====================================================
       1. ESPN FEED
    ===================================================== */

    const espnUrl =
      "https://site.api.espn.com/apis/site/v2/sports/football/nfl/injuries";


    const response =
      await fetch(
        espnUrl,
        {
          method:
            "GET",

          cache:
            "no-store",

          headers: {
            Accept:
              "application/json",

            "User-Agent":
              "Mozilla/5.0",
          },
        }
      );


    if (
      !response.ok
    ) {
      return NextResponse.json(
        {
          success:
            false,

          error:
            `ESPN returned HTTP ${response.status}. Existing injury data was left unchanged.`,
        },
        {
          status:
            502,
        }
      );
    }


    let espnData:
      EspnInjuryResponse;


    try {
      espnData =
        (
          await response.json()
        ) as EspnInjuryResponse;
    } catch {
      return NextResponse.json(
        {
          success:
            false,

          error:
            "ESPN returned invalid JSON. Existing injury data was left unchanged.",
        },
        {
          status:
            502,
        }
      );
    }


    if (
      espnData.status !==
      "success"
    ) {
      return NextResponse.json(
        {
          success:
            false,

          error:
            "ESPN did not return a successful injury response. Existing injury data was left unchanged.",
        },
        {
          status:
            502,
        }
      );
    }


    if (
      !Array.isArray(
        espnData.injuries
      )
    ) {
      return NextResponse.json(
        {
          success:
            false,

          error:
            "ESPN returned no usable injury array. Existing injury data was left unchanged.",
        },
        {
          status:
            502,
        }
      );
    }


    const season =
      espnData
        .season
        ?.year ??
      new Date()
        .getFullYear();


    /* =====================================================
       2. FLATTEN FEED
    ===================================================== */

    const rawRecords:
      EspnPlayerRecord[] =
      [];


    let totalEspnRecords =
      0;

    let recordsWithoutPlayerId =
      0;

    let activeOrNonInjuryRecords =
      0;

    let designatedInjuryRecords =
      0;


    for (
      const teamGroup
      of espnData.injuries
    ) {
      const injuries =
        teamGroup.injuries ??
        [];


      for (
        const injury
        of injuries
      ) {
        totalEspnRecords +=
          1;


        const athlete =
          injury.athlete;


        const espnPlayerId =
          extractEspnPlayerId(
            athlete
          );


        if (
          !espnPlayerId
        ) {
          recordsWithoutPlayerId +=
            1;

          continue;
        }


        const latestNote =
          athlete
            ?.notes
            ?.items
            ?.slice()
            .sort(
              (
                a,
                b
              ) =>
                new Date(
                  b.date ??
                  0
                ).getTime() -
                new Date(
                  a.date ??
                  0
                ).getTime()
            )[0];


        const shortComment =
          normalizeText(
            injury.shortComment
          ) ??
          normalizeText(
            latestNote
              ?.headline
          );


        const longComment =
          normalizeText(
            injury.longComment
          ) ??
          normalizeText(
            latestNote
              ?.text
          );


        const injuryDetail =
          longComment ??
          shortComment;


        const explicitInjuryType =
          normalizeText(
            injury
              .type
              ?.description
          ) ??
          normalizeText(
            injury
              .type
              ?.name
          );


        const inferredInjuryLocation =
          inferInjuryLocation(
            explicitInjuryType,
            shortComment,
            longComment,
            latestNote
              ?.headline,
            latestNote
              ?.text
          );


        const rawStatus =
          normalizeText(
            injury.status
          ) ??
          normalizeText(
            athlete
              ?.status
              ?.name
          );


        const normalizedStatus =
          normalizeInjuryStatus(
            rawStatus
          );


        const hasInjuryInfo =
          Boolean(
            explicitInjuryType ||
            injuryDetail ||
            injury.date
          );


        const currentStatus =
          normalizedStatus ??
          fallbackStatusForInjuryNews(
            rawStatus,
            hasInjuryInfo
          );


        if (
          currentStatus
        ) {
          designatedInjuryRecords +=
            1;
        } else {
          activeOrNonInjuryRecords +=
            1;
        }


        rawRecords.push({
          espnPlayerId,

          fullName:
            athlete
              ?.displayName ??
            `${athlete?.firstName ?? ""} ${athlete?.lastName ?? ""}`
              .trim(),

          team:
            normalizeText(
              athlete
                ?.team
                ?.abbreviation
            ),

          position:
            normalizePosition(
              athlete
                ?.position
                ?.abbreviation
            ) ||
            null,

          rawStatus,

          status:
            currentStatus,

          injuryType:
            explicitInjuryType ??
            inferredInjuryLocation,

          injuryLocation:
            inferredInjuryLocation,

          injuryDetail,

          injuryDate:
            normalizeDate(
              injury.date ??
              latestNote
                ?.date
            ),

          sourceUpdatedAt:
            normalizeDateTime(
              injury.date ??
              latestNote
                ?.date ??
              espnData.timestamp
            ),
        });
      }
    }


    if (
      totalEspnRecords ===
        0 ||
      rawRecords.length ===
        0
    ) {
      return NextResponse.json(
        {
          success:
            false,

          error:
            "ESPN returned no usable NFL injury records. Existing injury data was left unchanged.",

          totalEspnRecords,

          usableEspnRecords:
            rawRecords.length,

          recordsWithoutPlayerId,
        },
        {
          status:
            502,
        }
      );
    }


    if (
      designatedInjuryRecords ===
      0
    ) {
      return NextResponse.json(
        {
          success:
            false,

          error:
            "ESPN returned records but no recognized current injury designations. Existing injury data was left unchanged.",

          totalEspnRecords,

          activeOrNonInjuryRecords,

          designatedInjuryRecords,
        },
        {
          status:
            502,
        }
      );
    }


    /* =====================================================
       3. LATEST ESPN RECORD PER PLAYER
    ===================================================== */

    const latestRecordByEspnPlayerId =
      new Map<
        string,
        EspnPlayerRecord
      >();


    for (
      const record
      of rawRecords
    ) {
      const existing =
        latestRecordByEspnPlayerId.get(
          record.espnPlayerId
        );


      if (
        !existing
      ) {
        latestRecordByEspnPlayerId.set(
          record.espnPlayerId,
          record
        );

        continue;
      }


      const oldTime =
        new Date(
          existing.sourceUpdatedAt ??
          0
        ).getTime();


      const newTime =
        new Date(
          record.sourceUpdatedAt ??
          0
        ).getTime();


      if (
        newTime >
        oldTime
      ) {
        latestRecordByEspnPlayerId.set(
          record.espnPlayerId,
          record
        );
      }
    }


    const latestEspnRecords =
      Array.from(
        latestRecordByEspnPlayerId.values()
      );


    /* =====================================================
       4. LOAD NFL PLAYERS FROM PUBLIC SCHEMA
    ===================================================== */

    const {
      data:
        playerRows,

      error:
        playerError,
    } =
      await supabase
        .schema(
          "public"
        )
        .from(
          "nfl_players"
        )
        .select(
          "id, espn_player_id, full_name, primary_position, team_abbreviation"
        )
        .not(
          "espn_player_id",
          "is",
          null
        );


    if (
      playerError
    ) {
      throw new Error(
        `Unable to load NFL players: ${playerError.message}`
      );
    }


    const players:
      NflPlayer[] =
      (
        playerRows ??
        []
      ).map(
        (
          row
        ) => ({
          id:
            Number(
              row.id
            ),

          espn_player_id:
            row.espn_player_id
              ? String(
                  row.espn_player_id
                )
              : null,

          full_name:
            String(
              row.full_name ??
              ""
            ),

          primary_position:
            String(
              row.primary_position ??
              ""
            ),

          team_abbreviation:
            row.team_abbreviation
              ? String(
                  row.team_abbreviation
                )
              : null,
        })
      );


    const playerByEspnId =
      new Map<
        string,
        NflPlayer
      >();


    for (
      const player
      of players
    ) {
      if (
        player.espn_player_id
      ) {
        playerByEspnId.set(
          player.espn_player_id,
          player
        );
      }
    }


    /* =====================================================
       5. MATCH CURRENT FANTASY + DEFENSIVE INJURIES
    ===================================================== */

    /*
     * Keep every fantasy-relevant offensive AND defensive position.
     *
     * Defensive injuries are required by the G365 matchup engine so
     * QB/RB/WR/TE matchup difficulty can react to injuries on the
     * opposing defense instead of only seeing offensive injuries.
     *
     * ESPN and our player table can use either broad or specific
     * defensive position labels, so retain all common variants.
     */
    const fantasyPositions =
      new Set([
        "QB",
        "RB",
        "WR",
        "TE",
        "K",

        "DL",
        "DE",
        "DT",
        "NT",
        "EDGE",

        "LB",
        "ILB",
        "OLB",
        "MLB",

        "DB",
        "CB",
        "S",
        "FS",
        "SS",
      ]);


    const normalized:
      NormalizedInjury[] =
      [];


    const unmatched:
      Array<{
        espnPlayerId:
          string;

        fullName:
          string;

        team:
          string | null;

        position:
          string | null;

        rawStatus:
          string | null;
      }> =
      [];


    let nonFantasyIgnored =
      0;

    let matchedActiveOrNews =
      0;

    let recordsWithNewsButNoOfficialDesignation =
      0;


    for (
      const injury
      of latestEspnRecords
    ) {
      const player =
        playerByEspnId.get(
          injury.espnPlayerId
        );


      if (
        !player
      ) {
        unmatched.push({
          espnPlayerId:
            injury.espnPlayerId,

          fullName:
            injury.fullName,

          team:
            injury.team,

          position:
            injury.position,

          rawStatus:
            injury.rawStatus,
        });

        continue;
      }


      const position =
        normalizePosition(
          player.primary_position
        );


      if (
        !fantasyPositions.has(
          position
        )
      ) {
        nonFantasyIgnored +=
          1;

        continue;
      }


      if (
        !injury.status
      ) {
        matchedActiveOrNews +=
          1;

        continue;
      }


      if (
        injury.status ===
        "Injury"
      ) {
        recordsWithNewsButNoOfficialDesignation +=
          1;
      }


      normalized.push({
        nfl_player_id:
          player.id,

        espn_player_id:
          injury.espnPlayerId,

        season,

        status:
          injury.status,

        injury_type:
          injury.injuryType,

        injury_location:
          injury.injuryLocation,

        injury_detail:
          injury.injuryDetail,

        injury_date:
          injury.injuryDate,

        return_date:
          null,

        source_updated_at:
          injury.sourceUpdatedAt,
      });
    }


    if (
      normalized.length ===
      0
    ) {
      return NextResponse.json(
        {
          success:
            false,

          error:
            "ESPN returned records, but no current fantasy or defensive injury designations could be matched. Existing injury data was left unchanged.",

          totalEspnRecords,

          latestEspnRecords:
            latestEspnRecords.length,

          matchedActiveOrNews,

          unmatchedCount:
            unmatched.length,

          unmatched:
            unmatched.slice(
              0,
              25
            ),
        },
        {
          status:
            502,
        }
      );
    }


    /* =====================================================
       6. LOAD CURRENT INJURIES FROM PUBLIC SCHEMA
    ===================================================== */

    const {
      data:
        existingRows,

      error:
        existingError,
    } =
      await supabase
        .schema(
          "public"
        )
        .from(
          "nfl_player_injuries"
        )
        .select(
          `
          id,
          nfl_player_id,
          espn_player_id,
          season,
          status,
          injury_type,
          injury_location,
          injury_detail,
          injury_date,
          return_date,
          source_updated_at,
          is_active,
          first_seen_at,
          last_seen_at
          `
        )
        .eq(
          "season",
          season
        )
        .eq(
          "is_active",
          true
        );


    if (
      existingError
    ) {
      throw new Error(
        `Unable to load existing injuries: ${existingError.message}`
      );
    }


    const existingInjuries:
      ExistingInjury[] =
      (
        existingRows ??
        []
      ).map(
        (
          row
        ) => ({
          id:
            Number(
              row.id
            ),

          nfl_player_id:
            Number(
              row.nfl_player_id
            ),

          espn_player_id:
            String(
              row.espn_player_id ??
              ""
            ),

          season:
            Number(
              row.season
            ),

          status:
            row.status
              ? String(
                  row.status
                )
              : null,

          injury_type:
            row.injury_type
              ? String(
                  row.injury_type
                )
              : null,

          injury_location:
            row.injury_location
              ? String(
                  row.injury_location
                )
              : null,

          injury_detail:
            row.injury_detail
              ? String(
                  row.injury_detail
                )
              : null,

          injury_date:
            row.injury_date
              ? String(
                  row.injury_date
                )
              : null,

          return_date:
            row.return_date
              ? String(
                  row.return_date
                )
              : null,

          source_updated_at:
            row.source_updated_at
              ? String(
                  row.source_updated_at
                )
              : null,

          is_active:
            Boolean(
              row.is_active
            ),

          first_seen_at:
            String(
              row.first_seen_at
            ),

          last_seen_at:
            String(
              row.last_seen_at
            ),
        })
      );


    const existingByPlayer =
      new Map<
        number,
        ExistingInjury
      >();


    for (
      const existing
      of existingInjuries
    ) {
      existingByPlayer.set(
        existing.nfl_player_id,
        existing
      );
    }


    /* =====================================================
       7. INSERT / UPDATE
    ===================================================== */

    const now =
      new Date()
        .toISOString();


    let injuriesInserted =
      0;

    let injuriesChanged =
      0;

    let injuriesUnchanged =
      0;


    for (
      const injury
      of normalized
    ) {
      const existing =
        existingByPlayer.get(
          injury.nfl_player_id
        );


      if (
        !existing
      ) {
        const {
          error:
            insertError,
        } =
          await supabase
            .schema(
              "public"
            )
            .from(
              "nfl_player_injuries"
            )
            .insert({
              ...injury,

              is_active:
                true,

              first_seen_at:
                now,

              last_seen_at:
                now,

              created_at:
                now,

              updated_at:
                now,
            });


        if (
          insertError
        ) {
          throw new Error(
            `Unable to insert injury for ESPN player ${injury.espn_player_id}: ${insertError.message}`
          );
        }


        injuriesInserted +=
          1;

        continue;
      }


      const oldFingerprint =
        fingerprint({
          status:
            existing.status,

          injury_type:
            existing.injury_type,

          injury_location:
            existing.injury_location,

          injury_detail:
            existing.injury_detail,

          injury_date:
            existing.injury_date,

          return_date:
            existing.return_date,
        });


      const newFingerprint =
        fingerprint(
          injury
        );


      if (
        oldFingerprint ===
        newFingerprint
      ) {
        const {
          error:
            refreshError,
        } =
          await supabase
            .schema(
              "public"
            )
            .from(
              "nfl_player_injuries"
            )
            .update({
              last_seen_at:
                now,

              source_updated_at:
                injury.source_updated_at ??
                existing.source_updated_at,

              updated_at:
                now,
            })
            .eq(
              "id",
              existing.id
            );


        if (
          refreshError
        ) {
          throw new Error(
            `Unable to refresh injury ${existing.id}: ${refreshError.message}`
          );
        }


        injuriesUnchanged +=
          1;

        continue;
      }


      const {
        error:
          closeError,
      } =
        await supabase
          .schema(
            "public"
          )
          .from(
            "nfl_player_injuries"
          )
          .update({
            is_active:
              false,

            last_seen_at:
              now,

            updated_at:
              now,
          })
          .eq(
            "id",
            existing.id
          );


      if (
        closeError
      ) {
        throw new Error(
          `Unable to close old injury ${existing.id}: ${closeError.message}`
        );
      }


      const {
        error:
          insertChangedError,
      } =
        await supabase
          .schema(
            "public"
          )
          .from(
            "nfl_player_injuries"
          )
          .insert({
            ...injury,

            is_active:
              true,

            first_seen_at:
              now,

            last_seen_at:
              now,

            created_at:
              now,

            updated_at:
              now,
          });


      if (
        insertChangedError
      ) {
        throw new Error(
          `Unable to insert changed injury for ESPN player ${injury.espn_player_id}: ${insertChangedError.message}`
        );
      }


      injuriesChanged +=
        1;
    }


    /* =====================================================
       8. CLEAR STALE INJURIES
    ===================================================== */

    const currentlyInjuredPlayerIds =
      new Set(
        normalized.map(
          (
            injury
          ) =>
            injury.nfl_player_id
        )
      );


    const espnPlayersWithCurrentInjuryInformation =
      new Set<number>();


    for (
      const record
      of latestEspnRecords
    ) {
      if (
        !hasCredibleInjuryInformation(
          record
        )
      ) {
        continue;
      }

      const player =
        playerByEspnId.get(
          record.espnPlayerId
        );

      if (
        player
      ) {
        espnPlayersWithCurrentInjuryInformation.add(
          player.id
        );
      }
    }


    let injuriesCleared =
      0;


    for (
      const existing
      of existingInjuries
    ) {
      if (
        currentlyInjuredPlayerIds.has(
          existing.nfl_player_id
        ) ||
        espnPlayersWithCurrentInjuryInformation.has(
          existing.nfl_player_id
        )
      ) {
        continue;
      }


      const {
        error:
          clearError,
      } =
        await supabase
          .schema(
            "public"
          )
          .from(
            "nfl_player_injuries"
          )
          .update({
            is_active:
              false,

            last_seen_at:
              now,

            updated_at:
              now,
          })
          .eq(
            "id",
            existing.id
          );


      if (
        clearError
      ) {
        throw new Error(
          `Unable to clear stale injury ${existing.id}: ${clearError.message}`
        );
      }


      injuriesCleared +=
        1;
    }


    /* =====================================================
       9. REFRESH WEEKLY PROJECTIONS
    ===================================================== */

    let projectionRefresh:
      unknown =
        null;

    let projectionRefreshError:
      string |
      null =
        null;


    try {
      const {
        data:
          refreshedProjectionData,

        error:
          refreshedProjectionError,
      } =
        await supabase.rpc(
          "refresh_active_traditional_weekly_projections"
        );


      if (
        refreshedProjectionError
      ) {
        projectionRefreshError =
          refreshedProjectionError.message;
      } else {
        projectionRefresh =
          refreshedProjectionData;
      }
    } catch (
      projectionError
    ) {
      projectionRefreshError =
        projectionError instanceof Error
          ? projectionError.message
          : "Projection refresh failed.";
    }


    /*
     * Injury changes also affect the Season-Long dynamic
     * matchup engine. Refresh every active Season-Long
     * league/week after the injury feed is persisted.
     */
    let seasonLongMatchupRefresh:
      unknown =
        null;

    let seasonLongMatchupRefreshError:
      string |
      null =
        null;


    try {
      const {
        data:
          refreshedSeasonLongData,

        error:
          refreshedSeasonLongError,
      } =
        await supabase.rpc(
          "refresh_active_season_long_dynamic_matchups"
        );


      if (
        refreshedSeasonLongError
      ) {
        seasonLongMatchupRefreshError =
          refreshedSeasonLongError.message;
      } else {
        seasonLongMatchupRefresh =
          refreshedSeasonLongData;
      }
    } catch (
      seasonLongError
    ) {
      seasonLongMatchupRefreshError =
        seasonLongError instanceof Error
          ? seasonLongError.message
          : "Season-Long dynamic matchup refresh failed.";
    }


    /* =====================================================
       10. SUCCESS
    ===================================================== */

    return NextResponse.json({
      success:
        true,

      provider:
        "ESPN",

      feed:
        "league-wide",

      automatic:
        true,

      authMode:
        authorization.authMode,

      espnTimestamp:
        espnData.timestamp ??
        null,

      season,

      seasonType:
        espnData
          .season
          ?.type ??
        null,

      seasonName:
        espnData
          .season
          ?.name ??
        null,

      totalEspnRecords,

      recordsWithoutPlayerId,

      designatedInjuryRecords,

      activeOrNonInjuryRecords,

      latestEspnRecords:
        latestEspnRecords.length,

      fantasyAndDefensiveInjuriesMatched:
        normalized.length,

      matchedActiveOrNews,

      recordsWithNewsButNoOfficialDesignation,

      nonFantasyIgnored,

      unmatchedCount:
        unmatched.length,

      injuriesInserted,

      injuriesChanged,

      injuriesUnchanged,

      injuriesCleared,

      projectionRefresh,

      projectionRefreshError,

      seasonLongMatchupRefresh,

      seasonLongMatchupRefreshError,

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
      "NFL injury sync failed:",
      error
    );


    return NextResponse.json(
      {
        success:
          false,

        error:
          error instanceof Error
            ? error.message
            : "NFL injury sync failed.",
      },
      {
        status:
          500,
      }
    );
  }
}