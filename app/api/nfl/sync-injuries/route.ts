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
   SUPABASE ADMIN CLIENT
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
   AUTOMATIC SYNC AUTHORIZATION
========================================================= */

function authorizeSync(
  request: Request
) {
  const configuredSecret =
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
              "NFL_SYNC_SECRET is not configured on the server.",
          },
          {
            status:
              500,
          }
        ),
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
    };
  }


  return {
    authorized:
      true,

    response:
      null,
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


    /*
     * Example:
     *
     * https://www.espn.com/nfl/player/_/id/4870808/...
     */

    const normalMatch =
      href.match(
        /\/id\/(\d+)/
      );


    if (
      normalMatch?.[1]
    ) {
      return normalMatch[1];
    }


    /*
     * ESPN deep-link format:
     *
     * ~a:4870808
     */

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
   BASIC NORMALIZATION
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
   CURRENT INJURY DESIGNATIONS
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
  };


  return (
    statusMap[
      normalized
    ] ??
    null
  );
}


/* =========================================================
   INJURY FINGERPRINT
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
    authorizeSync(
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
       1. ESPN LEAGUE-WIDE FEED
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


    /* =====================================================
       2. SAFETY VALIDATION
    ===================================================== */

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
       3. FLATTEN ESPN FEED
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


        const rawStatus =
          normalizeText(
            injury.status
          ) ??
          normalizeText(
            athlete
              ?.status
              ?.name
          );


        const currentStatus =
          normalizeInjuryStatus(
            rawStatus
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
            normalizeText(
              injury
                .type
                ?.description
            ) ??
            normalizeText(
              injury
                .type
                ?.name
            ),

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


    /* =====================================================
       4. FAIL CLOSED IF FEED LOOKS WRONG
    ===================================================== */

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
       5. DEDUPE LATEST ESPN RECORD PER PLAYER
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
       6. LOAD GRIDIRON365 PLAYERS
    ===================================================== */

    const {
      data:
        playerRows,

      error:
        playerError,
    } =
      await supabase
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
       7. MATCH CURRENT FANTASY INJURIES
    ===================================================== */

    const fantasyPositions =
      new Set([
        "QB",
        "RB",
        "WR",
        "TE",
        "K",
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


      /*
       * Active/general-news entries are not
       * current injuries.
       */

      if (
        !injury.status
      ) {
        matchedActiveOrNews +=
          1;

        continue;
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
          null,

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


    /*
     * Fail closed.
     *
     * We know ESPN normally gives us actual designations.
     * If suddenly none match, do not wipe Supabase.
     */

    if (
      normalized.length ===
      0
    ) {
      return NextResponse.json(
        {
          success:
            false,

          error:
            "ESPN returned records, but no current fantasy injury designations could be matched. Existing injury data was left unchanged.",

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
       8. LOAD CURRENT ACTIVE INJURY ROWS
    ===================================================== */

    const {
      data:
        existingRows,

      error:
        existingError,
    } =
      await supabase
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
       9. INSERT / UPDATE / REFRESH
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


      /* ---------------- NEW ---------------- */

      if (
        !existing
      ) {
        const {
          error:
            insertError,
        } =
          await supabase
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


      /* ------------- UNCHANGED ------------- */

      if (
        oldFingerprint ===
        newFingerprint
      ) {
        const {
          error:
            refreshError,
        } =
          await supabase
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


      /* -------------- CHANGED -------------- */

      const {
        error:
          closeError,
      } =
        await supabase
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
       10. CLEAR NO-LONGER-INJURED PLAYERS
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


    let injuriesCleared =
      0;


    for (
      const existing
      of existingInjuries
    ) {
      if (
        currentlyInjuredPlayerIds.has(
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
       11. SUCCESS
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

      fantasyInjuriesMatched:
        normalized.length,

      matchedActiveOrNews,

      nonFantasyIgnored,

      unmatchedCount:
        unmatched.length,

      injuriesInserted,

      injuriesChanged,

      injuriesUnchanged,

      injuriesCleared,

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