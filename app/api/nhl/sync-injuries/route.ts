import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/* =========================================================
   TYPES
========================================================= */

type SyncInjuriesRequestBody = {
  team?: string;
  dryRun?: boolean;
};

type NhlTeamRow = {
  id: number;
  abbreviation: string;
  display_name: string;
  active: boolean;
};

type NhlPlayerRow = {
  id: number;
  nhl_player_id: string | null;
  cbs_player_id: string | null;
  team_id: number | null;
  display_name: string;
  position: string | null;
  active: boolean;
  injury_status: string | null;
  injury_detail: string | null;
  injury_return_date: string | null;
  injury_updated_at: string | null;
  injury_source: string | null;
};

type ParsedCbsInjury = {
  cbsPlayerId: string;
  playerName: string;
  position: string | null;
  updatedText: string | null;
  injury: string | null;
  injuryStatusRaw: string | null;
  injuryStatus: string;
  returnDate: string | null;
  cbsTeamAbbreviation: string;
  g365TeamAbbreviation: string;
};

type MatchedInjury = {
  injury: ParsedCbsInjury;
  player: NhlPlayerRow;
  matchMethod:
    | "cbs_player_id"
    | "team_name_position"
    | "team_name";
};

type UnmatchedInjury = {
  playerName: string;
  position: string | null;
  team: string;
  cbsPlayerId: string;
  injury: string | null;
  injuryStatus: string | null;
  reason: string;
};

type TeamSyncResult = {
  team: string;
  cbsTeam: string;
  injuriesFound: number;
  matched: number;
  unmatched: number;
  updated: number;
};

/* =========================================================
   SUPABASE
========================================================= */

function createSupabaseAdmin() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

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
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  );
}

/* =========================================================
   AUTHORIZATION
========================================================= */

function isAuthorized(
  request: Request
) {
  if (
    process.env.NODE_ENV !==
    "production"
  ) {
    return true;
  }

  const configuredSecret =
    process.env.GRIDIRON_SYNC_SECRET ??
    process.env.NFL_SYNC_SECRET;

  if (!configuredSecret) {
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
    authorization?.startsWith(
      "Bearer "
    )
      ? authorization.slice(7)
      : null;

  return (
    headerSecret ===
      configuredSecret ||
    bearerSecret ===
      configuredSecret
  );
}

/* =========================================================
   TEXT HELPERS
========================================================= */

function decodeHtmlEntities(
  value: string
) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&ndash;/gi, "–")
    .replace(/&mdash;/gi, "—")
    .replace(/&rsquo;/gi, "’")
    .replace(/&lsquo;/gi, "‘")
    .replace(/&ldquo;/gi, "“")
    .replace(/&rdquo;/gi, "”")
    .replace(/&#x27;/gi, "'")
    .replace(
      /&#(\d+);/g,
      (
        _,
        code: string
      ) => {
        const number =
          Number(code);

        return Number.isFinite(
          number
        )
          ? String.fromCharCode(
              number
            )
          : "";
      }
    );
}

function cleanText(
  value: unknown
) {
  if (
    typeof value !==
    "string"
  ) {
    return null;
  }

  const decoded =
    decodeHtmlEntities(
      value
    )
      .replace(/\s+/g, " ")
      .trim();

  return decoded.length > 0
    ? decoded
    : null;
}

function stripHtml(
  value: string
) {
  return cleanText(
    value
      .replace(
        /<script[\s\S]*?<\/script>/gi,
        " "
      )
      .replace(
        /<style[\s\S]*?<\/style>/gi,
        " "
      )
      .replace(
        /<[^>]+>/g,
        " "
      )
  );
}

function normalizeName(
  value: string
) {
  return value
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .replace(/[’']/g, "")
    .replace(
      /[^a-zA-Z0-9]+/g,
      " "
    )
    .trim()
    .toLowerCase();
}

function normalizePosition(
  value: string | null
) {
  const position =
    cleanText(
      value
    )?.toUpperCase();

  if (!position) {
    return null;
  }

  if (
    position === "L"
  ) {
    return "LW";
  }

  if (
    position === "R"
  ) {
    return "RW";
  }

  return position;
}

/* =========================================================
   CBS TEAM ABBREVIATION MAPPING
========================================================= */

function cbsToG365Team(
  abbreviation: string
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
      CLB: "CBJ",
      MON: "MTL",
      WAS: "WSH",
      LV: "VGK",
      LAK: "LA",
      NJD: "NJ",
      SJS: "SJ",
      TBL: "TB",
      UTA: "UTAH",
    };

  return (
    mappings[
      normalized
    ] ??
    normalized
  );
}

function g365ToCbsTeam(
  abbreviation: string
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
      CBJ: "CLB",
      MTL: "MON",
      WSH: "WAS",
      VGK: "LV",
      LA: "LA",
      NJ: "NJ",
      SJ: "SJ",
      TB: "TB",
      UTAH: "UTA",
    };

  return (
    mappings[
      normalized
    ] ??
    normalized
  );
}

/* =========================================================
   CBS FETCH
========================================================= */

const CBS_INJURIES_URL =
  "https://www.cbssports.com/nhl/injuries/";

async function fetchCbsInjuryPage() {
  const response =
    await fetch(
      CBS_INJURIES_URL,
      {
        method: "GET",

        headers: {
          Accept:
            "text/html,application/xhtml+xml",

          "User-Agent":
            "Mozilla/5.0 (compatible; Gridiron365/1.0; +https://www.gridiron365fantasy.com)",
        },

        cache: "no-store",
      }
    );

  const html =
    await response.text();

  if (!response.ok) {
    throw new Error(
      `CBS NHL injury request failed: HTTP ${response.status} ${response.statusText}. ${html.slice(
        0,
        300
      )}`
    );
  }

  if (
    !html.includes(
      "TableBase"
    ) ||
    !html.includes(
      "Injury Status"
    )
  ) {
    throw new Error(
      "CBS NHL injury page did not contain the expected injury tables."
    );
  }

  return html;
}

/* =========================================================
   CBS HTML PARSING
========================================================= */

function extractTeamAbbreviation(
  block: string
) {
  const match =
    block.match(
      /\/nhl\/teams\/([^/"?]+)\/[^"]*"/i
    );

  return match?.[1]
    ? decodeURIComponent(
        match[1]
      ).toUpperCase()
    : null;
}

function extractTableRows(
  tableBlock: string
) {
  return Array.from(
    tableBlock.matchAll(
      /<tr\b[^>]*class="[^"]*TableBase-bodyTr[^"]*"[^>]*>([\s\S]*?)<\/tr>/gi
    )
  ).map(
    match =>
      match[1]
  );
}

function extractCells(
  rowHtml: string
) {
  return Array.from(
    rowHtml.matchAll(
      /<td\b[^>]*>([\s\S]*?)<\/td>/gi
    )
  ).map(
    match =>
      match[1]
  );
}

function extractPlayerFromCell(
  cellHtml: string
) {
  const longNameMatch =
    cellHtml.match(
      /CellPlayerName--long[\s\S]*?<a\b[^>]*href="\/nhl\/players\/(\d+)\/[^"]*"[^>]*>([\s\S]*?)<\/a>/i
    );

  if (
    longNameMatch
  ) {
    const playerName =
      stripHtml(
        longNameMatch[2]
      );

    if (
      playerName &&
      longNameMatch[1]
    ) {
      return {
        cbsPlayerId:
          longNameMatch[1],

        playerName,
      };
    }
  }

  const fallback =
    cellHtml.match(
      /<a\b[^>]*href="\/nhl\/players\/(\d+)\/[^"]*"[^>]*>([\s\S]*?)<\/a>/i
    );

  if (!fallback) {
    return null;
  }

  const playerName =
    stripHtml(
      fallback[2]
    );

  if (
    !playerName ||
    !fallback[1]
  ) {
    return null;
  }

  return {
    cbsPlayerId:
      fallback[1],

    playerName,
  };
}

/* =========================================================
   INJURY NORMALIZATION
========================================================= */

function normalizeInjuryStatus(
  rawStatus: string | null
) {
  const status =
    cleanText(
      rawStatus
    );

  if (!status) {
    return "injured";
  }

  const lower =
    status.toLowerCase();

  if (
    /\bir\b/.test(
      lower
    ) ||
    lower.includes(
      "injured reserve"
    )
  ) {
    return "injured_reserve";
  }

  if (
    lower.includes(
      "out for the season"
    )
  ) {
    return "out_for_season";
  }

  if (
    lower.includes(
      "expected to be out"
    ) ||
    lower.includes(
      "out"
    )
  ) {
    return "out";
  }

  if (
    lower.includes(
      "doubtful"
    )
  ) {
    return "doubtful";
  }

  if (
    lower.includes(
      "questionable"
    )
  ) {
    return "questionable";
  }

  if (
    lower.includes(
      "day-to-day"
    ) ||
    lower.includes(
      "day to day"
    )
  ) {
    return "day_to_day";
  }

  return "injured";
}

function parseReturnDate(
  status: string | null
) {
  if (!status) {
    return null;
  }

  const match =
    status.match(
      /until at least\s+([A-Za-z]{3,9})\s+(\d{1,2})(?:,\s*(\d{4}))?/i
    );

  if (!match) {
    return null;
  }

  const monthName =
    match[1];

  const day =
    Number(
      match[2]
    );

  let year =
    match[3]
      ? Number(
          match[3]
        )
      : new Date()
          .getUTCFullYear();

  const monthLookup:
    Record<
      string,
      number
    > = {
      jan: 0,
      january: 0,

      feb: 1,
      february: 1,

      mar: 2,
      march: 2,

      apr: 3,
      april: 3,

      may: 4,

      jun: 5,
      june: 5,

      jul: 6,
      july: 6,

      aug: 7,
      august: 7,

      sep: 8,
      sept: 8,
      september: 8,

      oct: 9,
      october: 9,

      nov: 10,
      november: 10,

      dec: 11,
      december: 11,
    };

  const month =
    monthLookup[
      monthName
        .toLowerCase()
    ];

  if (
    month ===
      undefined ||
    !Number.isInteger(
      day
    ) ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }

  if (
    !match[3]
  ) {
    const now =
      new Date();

    const candidate =
      new Date(
        Date.UTC(
          year,
          month,
          day
        )
      );

    const sixMonthsAgo =
      new Date(
        Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth() - 6,
          now.getUTCDate()
        )
      );

    if (
      candidate <
      sixMonthsAgo
    ) {
      year += 1;
    }
  }

  const date =
    new Date(
      Date.UTC(
        year,
        month,
        day
      )
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return null;
  }

  return date
    .toISOString()
    .slice(
      0,
      10
    );
}

/* =========================================================
   PARSE CBS INJURIES
========================================================= */

function parseCbsInjuries(
  html: string
) {
  const injuries:
    ParsedCbsInjury[] =
    [];

  const blocks =
    html.split(
      /(?=<div class="TableBaseWrapper")/i
    );

  for (
    const block
    of blocks
  ) {
    if (
      !block.includes(
        "TableBase-title"
      ) ||
      !block.includes(
        "Injury Status"
      )
    ) {
      continue;
    }

    const cbsTeamAbbreviation =
      extractTeamAbbreviation(
        block
      );

    if (
      !cbsTeamAbbreviation
    ) {
      continue;
    }

    const g365TeamAbbreviation =
      cbsToG365Team(
        cbsTeamAbbreviation
      );

    const rows =
      extractTableRows(
        block
      );

    for (
      const row
      of rows
    ) {
      const cells =
        extractCells(
          row
        );

      if (
        cells.length <
        5
      ) {
        continue;
      }

      const player =
        extractPlayerFromCell(
          cells[0]
        );

      if (!player) {
        continue;
      }

      const position =
        normalizePosition(
          stripHtml(
            cells[1]
          )
        );

      const updatedText =
        stripHtml(
          cells[2]
        );

      const injury =
        stripHtml(
          cells[3]
        );

      const injuryStatusRaw =
        stripHtml(
          cells[4]
        );

      injuries.push({
        cbsPlayerId:
          player.cbsPlayerId,

        playerName:
          player.playerName,

        position,

        updatedText,

        injury,

        injuryStatusRaw,

        injuryStatus:
          normalizeInjuryStatus(
            injuryStatusRaw
          ),

        returnDate:
          parseReturnDate(
            injuryStatusRaw
          ),

        cbsTeamAbbreviation,

        g365TeamAbbreviation,
      });
    }
  }

  return injuries;
}

/* =========================================================
   PLAYER MATCHING
========================================================= */

function findPlayerMatch({
  injury,
  team,
  players,
}: {
  injury:
    ParsedCbsInjury;

  team:
    NhlTeamRow;

  players:
    NhlPlayerRow[];
}):
  | {
      player:
        NhlPlayerRow;

      method:
        MatchedInjury["matchMethod"];
    }
  | {
      player:
        null;

      method:
        null;

      reason:
        string;
    } {
  const byCbsId =
    players.filter(
      player =>
        player
          .cbs_player_id ===
        injury.cbsPlayerId
    );

  if (
    byCbsId.length ===
    1
  ) {
    return {
      player:
        byCbsId[0],

      method:
        "cbs_player_id",
    };
  }

  if (
    byCbsId.length >
    1
  ) {
    return {
      player: null,
      method: null,

      reason:
        "Multiple G365 players have the same CBS player ID.",
    };
  }

  const injuryName =
    normalizeName(
      injury.playerName
    );

  const teamPlayers =
    players.filter(
      player =>
        player.team_id ===
        team.id
    );

  const nameMatches =
    teamPlayers.filter(
      player =>
        normalizeName(
          player.display_name
        ) ===
        injuryName
    );

  if (
    nameMatches.length ===
    0
  ) {
    return {
      player: null,
      method: null,

      reason:
        "No player on the matching G365 NHL team has this normalized name.",
    };
  }

  const injuryPosition =
    normalizePosition(
      injury.position
    );

  if (
    injuryPosition
  ) {
    const positionMatches =
      nameMatches.filter(
        player =>
          normalizePosition(
            player.position
          ) ===
          injuryPosition
      );

    if (
      positionMatches.length ===
      1
    ) {
      return {
        player:
          positionMatches[0],

        method:
          "team_name_position",
      };
    }

    if (
      positionMatches.length >
      1
    ) {
      return {
        player: null,
        method: null,

        reason:
          "Multiple G365 players matched team, name, and position.",
      };
    }
  }

  if (
    nameMatches.length ===
    1
  ) {
    return {
      player:
        nameMatches[0],

      method:
        "team_name",
    };
  }

  return {
    player: null,
    method: null,

    reason:
      "Multiple G365 players matched team and normalized name.",
  };
}

/* =========================================================
   POST
========================================================= */

export async function POST(
  request: Request
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
          success: false,

          error:
            "Unauthorized NHL injury sync request.",
        },
        {
          status: 401,
        }
      );
    }

    let body:
      SyncInjuriesRequestBody =
      {};

    try {
      body =
        (
          await request.json()
        ) as
          SyncInjuriesRequestBody;
    } catch {
      body = {};
    }

    const requestedTeam =
      cleanText(
        body.team
      )
        ?.toUpperCase() ??
      null;

    const dryRun =
      body.dryRun !==
      false;

    const supabase =
      createSupabaseAdmin();

    /* =====================================================
       LOAD ACTIVE NHL TEAMS
    ===================================================== */

    const {
      data: teamData,
      error: teamError,
    } =
      await supabase
        .from(
          "nhl_teams"
        )
        .select(
          "id, abbreviation, display_name, active"
        )
        .eq(
          "active",
          true
        )
        .order(
          "abbreviation",
          {
            ascending: true,
          }
        );

    if (
      teamError
    ) {
      throw new Error(
        `Unable to load NHL teams: ${teamError.message}`
      );
    }

    const allTeams:
      NhlTeamRow[] =
      (
        teamData ??
        []
      ).map(
        team => ({
          id:
            Number(
              team.id
            ),

          abbreviation:
            String(
              team.abbreviation
            ),

          display_name:
            String(
              team.display_name
            ),

          active:
            Boolean(
              team.active
            ),
        })
      );

    let teams =
      allTeams;

    if (
      requestedTeam
    ) {
      teams =
        allTeams.filter(
          team =>
            team.abbreviation
              .toUpperCase() ===
            requestedTeam
        );
    }

    if (
      teams.length ===
      0
    ) {
      return NextResponse.json(
        {
          success: false,

          error:
            requestedTeam
              ? `Active NHL team ${requestedTeam} was not found in nhl_teams.`
              : "No active NHL teams were found.",
        },
        {
          status: 404,
        }
      );
    }

    const allTeamByAbbreviation =
      new Map<
        string,
        NhlTeamRow
      >();

    for (
      const team
      of allTeams
    ) {
      allTeamByAbbreviation.set(
        team.abbreviation
          .toUpperCase(),
        team
      );
    }

    /* =====================================================
       LOAD ALL NHL PLAYERS

       Supabase/PostgREST can cap a single SELECT response,
       so page through the complete nhl_players table.
    ===================================================== */

    const players:
      NhlPlayerRow[] =
      [];

    const PLAYER_PAGE_SIZE =
      1000;

    let playerOffset =
      0;

    while (true) {
      const {
        data: playerPage,
        error: playerError,
      } =
        await supabase
          .from(
            "nhl_players"
          )
          .select(`
            id,
            nhl_player_id,
            cbs_player_id,
            team_id,
            display_name,
            position,
            active,
            injury_status,
            injury_detail,
            injury_return_date,
            injury_updated_at,
            injury_source
          `)
          .order(
            "id",
            {
              ascending: true,
            }
          )
          .range(
            playerOffset,
            playerOffset +
              PLAYER_PAGE_SIZE -
              1
          );

      if (
        playerError
      ) {
        throw new Error(
          `Unable to load NHL players: ${playerError.message}`
        );
      }

      const pageRows =
        playerPage ??
        [];

      for (
        const player
        of pageRows
      ) {
        players.push({
          id:
            Number(
              player.id
            ),

          nhl_player_id:
            player
              .nhl_player_id ===
            null
              ? null
              : String(
                  player
                    .nhl_player_id
                ),

          cbs_player_id:
            player
              .cbs_player_id ===
            null
              ? null
              : String(
                  player
                    .cbs_player_id
                ),

          team_id:
            player.team_id ===
            null
              ? null
              : Number(
                  player.team_id
                ),

          display_name:
            String(
              player
                .display_name
            ),

          position:
            player.position ===
            null
              ? null
              : String(
                  player.position
                ),

          active:
            Boolean(
              player.active
            ),

          injury_status:
            player
              .injury_status ===
            null
              ? null
              : String(
                  player
                    .injury_status
                ),

          injury_detail:
            player
              .injury_detail ===
            null
              ? null
              : String(
                  player
                    .injury_detail
                ),

          injury_return_date:
            player
              .injury_return_date ===
            null
              ? null
              : String(
                  player
                    .injury_return_date
                ),

          injury_updated_at:
            player
              .injury_updated_at ===
            null
              ? null
              : String(
                  player
                    .injury_updated_at
                ),

          injury_source:
            player
              .injury_source ===
            null
              ? null
              : String(
                  player
                    .injury_source
                ),
        });
      }

      if (
        pageRows.length <
        PLAYER_PAGE_SIZE
      ) {
        break;
      }

      playerOffset +=
        PLAYER_PAGE_SIZE;
    }

    /* =====================================================
       FETCH + PARSE CBS
    ===================================================== */

    const html =
      await fetchCbsInjuryPage();

    const allParsed =
      parseCbsInjuries(
        html
      );

    if (
      allParsed.length ===
      0
    ) {
      throw new Error(
        "CBS injury page was retrieved successfully, but no NHL injury rows were parsed. Existing injury data was left unchanged."
      );
    }

    const parsed =
      requestedTeam
        ? allParsed.filter(
            injury =>
              injury
                .g365TeamAbbreviation ===
              requestedTeam
          )
        : allParsed;

    const now =
      new Date()
        .toISOString();

    const matched:
      MatchedInjury[] =
      [];

    const unmatched:
      UnmatchedInjury[] =
      [];

    const seenPlayerIds =
      new Set<number>();

    const parsedTeams =
      new Set<string>();

    /* =====================================================
       MATCH INJURIES
    ===================================================== */

    for (
      const injury
      of parsed
    ) {
      parsedTeams.add(
        injury
          .g365TeamAbbreviation
      );

      const team =
        allTeamByAbbreviation.get(
          injury
            .g365TeamAbbreviation
        );

      if (!team) {
        unmatched.push({
          playerName:
            injury.playerName,

          position:
            injury.position,

          team:
            injury
              .g365TeamAbbreviation,

          cbsPlayerId:
            injury.cbsPlayerId,

          injury:
            injury.injury,

          injuryStatus:
            injury
              .injuryStatusRaw,

          reason:
            "CBS team could not be mapped to an active G365 NHL team.",
        });

        continue;
      }

      const result =
        findPlayerMatch({
          injury,
          team,
          players,
        });

      if (
        !result.player ||
        !result.method
      ) {
        unmatched.push({
          playerName:
            injury.playerName,

          position:
            injury.position,

          team:
            injury
              .g365TeamAbbreviation,

          cbsPlayerId:
            injury.cbsPlayerId,

          injury:
            injury.injury,

          injuryStatus:
            injury
              .injuryStatusRaw,

          reason:
            result.reason,
        });

        continue;
      }

      seenPlayerIds.add(
        result.player.id
      );

      matched.push({
        injury,

        player:
          result.player,

        matchMethod:
          result.method,
      });
    }

    /* =====================================================
       WRITE CURRENT INJURIES
    ===================================================== */

    let updated =
      0;

    if (
      !dryRun
    ) {
      for (
        const match
        of matched
      ) {
        const injuryDetail =
          [
            match.injury
              .injury,

            match.injury
              .injuryStatusRaw,
          ]
            .filter(
              (
                value
              ): value is string =>
                Boolean(
                  value
                )
            )
            .join(
              " — "
            ) ||
          null;

        const {
          error:
            updateError,
        } =
          await supabase
            .from(
              "nhl_players"
            )
            .update({
              cbs_player_id:
                match.injury
                  .cbsPlayerId,

              injury_status:
                match.injury
                  .injuryStatus,

              injury_detail:
                injuryDetail,

              injury_return_date:
                match.injury
                  .returnDate,

              injury_updated_at:
                now,

              injury_source:
                "CBS Sports",
            })
            .eq(
              "id",
              match.player.id
            );

        if (
          updateError
        ) {
          throw new Error(
            `Unable to update injury for ${match.player.display_name}: ${updateError.message}`
          );
        }

        updated +=
          1;
      }
    }

    /* =====================================================
       CLEAR STALE CBS INJURIES
    ===================================================== */

    let cleared =
      0;

    if (
      !dryRun
    ) {
      for (
        const team
        of teams
      ) {
        const stalePlayers =
          players.filter(
            player =>
              player.team_id ===
                team.id &&
              player
                .injury_source ===
                "CBS Sports" &&
              !seenPlayerIds.has(
                player.id
              )
          );

        for (
          const player
          of stalePlayers
        ) {
          const {
            error:
              clearError,
          } =
            await supabase
              .from(
                "nhl_players"
              )
              .update({
                injury_status:
                  null,

                injury_detail:
                  null,

                injury_return_date:
                  null,

                injury_updated_at:
                  now,

                injury_source:
                  null,
              })
              .eq(
                "id",
                player.id
              );

          if (
            clearError
          ) {
            throw new Error(
              `Unable to clear stale injury for ${player.display_name}: ${clearError.message}`
            );
          }

          cleared +=
            1;
        }
      }
    }

    /* =====================================================
       TEAM RESULTS
    ===================================================== */

    const results:
      TeamSyncResult[] =
      teams.map(
        team => {
          const abbreviation =
            team.abbreviation
              .toUpperCase();

          const cbsTeam =
            g365ToCbsTeam(
              abbreviation
            );

          const teamInjuries =
            parsed.filter(
              injury =>
                injury
                  .g365TeamAbbreviation ===
                abbreviation
            );

          const teamMatched =
            matched.filter(
              row =>
                row.injury
                  .g365TeamAbbreviation ===
                abbreviation
            );

          const teamUnmatched =
            unmatched.filter(
              row =>
                row.team ===
                abbreviation
            );

          return {
            team:
              abbreviation,

            cbsTeam,

            injuriesFound:
              teamInjuries.length,

            matched:
              teamMatched.length,

            unmatched:
              teamUnmatched.length,

            updated:
              dryRun
                ? 0
                : teamMatched.length,
          };
        }
      );

    /* =====================================================
       MATCH METHOD SUMMARY
    ===================================================== */

    const matchMethods =
      matched.reduce(
        (
          accumulator,
          row
        ) => {
          accumulator[
            row.matchMethod
          ] =
            (
              accumulator[
                row.matchMethod
              ] ??
              0
            ) +
            1;

          return accumulator;
        },
        {} as Record<
          string,
          number
        >
      );

    /* =====================================================
       RESPONSE
    ===================================================== */

    return NextResponse.json({
      success: true,

      provider:
        "CBS Sports",

      source:
        CBS_INJURIES_URL,

      dryRun,

      requestedTeam,

      injuriesParsed:
        parsed.length,

      injuriesMatched:
        matched.length,

      injuriesUnmatched:
        unmatched.length,

      playersUpdated:
        dryRun
          ? 0
          : updated,

      staleInjuriesCleared:
        dryRun
          ? 0
          : cleared,

      matchMethods,

      parsedTeams:
        Array.from(
          parsedTeams
        ).sort(),

      unmatched,

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
      "NHL injury sync failed:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        error:
          error instanceof
          Error
            ? error.message
            : "NHL injury sync failed.",
      },
      {
        status: 500,
      }
    );
  }
}