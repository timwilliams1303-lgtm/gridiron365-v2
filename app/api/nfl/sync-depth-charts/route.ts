import {
  NextResponse,
} from "next/server";

import {
  createSupabaseAdminClient,
} from "@/lib/supabase/admin";

import {
  createSupabaseServerClient,
} from "@/lib/supabase/server";


type EspnRef = {
  $ref?: string;
};


type EspnDepthAthlete = {
  slot?: number;
  rank?: number;
  athlete?: EspnRef;
};


type EspnDepthPositionMetadata = {
  id?: string;
  name?: string;
  displayName?: string;
  abbreviation?: string;
};


type EspnDepthPosition = {
  position?: EspnDepthPositionMetadata;
  athletes?: EspnDepthAthlete[];
};


type EspnDepthChartItem = {
  id?: string;
  name?: string;
  positions?: Record<string, EspnDepthPosition>;
};


type EspnDepthChartResponse = {
  items?: EspnDepthChartItem[];
};


type EspnCoreAthlete = {
  id?: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  displayName?: string;
  jersey?: string;
  active?: boolean;
  position?: {
    id?: string;
    name?: string;
    displayName?: string;
    abbreviation?: string;
  };
  team?: EspnRef | null;
  status?: {
    id?: string;
    name?: string;
    type?: string;
    abbreviation?: string;
  };
  headshot?: {
    href?: string;
    alt?: string;
  };
};


type HydratedPlayerResult = {
  nflPlayerId: number | null;
  canonicalEspnPlayerId: string | null;
  hydrated: boolean;
  canonicalized: boolean;
  error: string | null;
};


type NflTeamRow = {
  espn_team_id: string;
  abbreviation: string;
  display_name: string;
};


type NflPlayerLookupRow = {
  id: number;
  espn_player_id: string;
  full_name: string;
  primary_position: string | null;
  team_abbreviation: string | null;
  is_active: boolean | null;
};


type DepthChartUpsertRow = {
  season: number;
  team_abbreviation: string;
  espn_team_id: string;
  formation_id: string;
  formation_name: string;
  position_key: string;
  position_id: string | null;
  position_name: string | null;
  position_abbreviation: string | null;
  slot: number;
  depth_rank: number;
  espn_player_id: string;
  nfl_player_id: number | null;
  source: string;
  synced_at: string;
};


type RequestBody = {
  season?: number;
};


function extractEspnPlayerId(
  athleteRef?: string
) {
  if (!athleteRef) {
    return null;
  }

  const match =
    athleteRef.match(
      /\/athletes\/([^/?#]+)/
    );

  if (!match?.[1]) {
    return null;
  }

  return decodeURIComponent(
    match[1]
  );
}


function cleanText(
  value?: string
) {
  const cleaned =
    value?.trim();

  return cleaned || null;
}



function normalizeHydratedPosition(
  corePosition?: string | null,
  fallbackPosition?: string | null
) {
  const normalizedCore =
    cleanText(
      corePosition ??
        undefined
    )?.toUpperCase();

  const invalidCorePositions =
    new Set([
      "-",
      "UNKNOWN",
      "UNK",
      "N/A",
      "NA",
      "NONE",
    ]);

  if (
    normalizedCore &&
    !invalidCorePositions.has(
      normalizedCore
    )
  ) {
    return normalizedCore;
  }

  return (
    cleanText(
      fallbackPosition ??
        undefined
    )?.toUpperCase() ??
    null
  );
}


function normalizeEspnRefUrl(
  value?: string
) {
  const cleaned =
    cleanText(value);

  if (!cleaned) {
    return null;
  }

  if (
    cleaned.startsWith(
      "http://"
    )
  ) {
    return (
      "https://" +
      cleaned.slice(7)
    );
  }

  return cleaned;
}


function normalizeNameKey(
  value?: string | null
) {
  return (
    cleanText(
      value ?? undefined
    )
      ?.toLowerCase()
      .replace(
        /[^a-z0-9]+/g,
        " "
      )
      .trim() ??
    ""
  );
}


function normalizePositionKey(
  value?: string | null
) {
  return (
    cleanText(
      value ?? undefined
    )
      ?.toUpperCase()
      .replace(
        /[^A-Z0-9]+/g,
        ""
      ) ??
    ""
  );
}


function getPositionFamily(
  value?: string | null
) {
  const position =
    normalizePositionKey(value);

  if (
    [
      "DT",
      "NT",
      "LDT",
      "RDT",
      "DL",
    ].includes(position)
  ) {
    return "INTERIOR";
  }

  if (
    [
      "DE",
      "LDE",
      "RDE",
      "EDGE",
    ].includes(position)
  ) {
    return "EDGE";
  }

  if (
    [
      "LB",
      "ILB",
      "OLB",
      "MLB",
      "LILB",
      "RILB",
      "WLB",
      "SLB",
    ].includes(position)
  ) {
    return "LINEBACKER";
  }

  if (
    [
      "CB",
      "LCB",
      "RCB",
      "NB",
      "DB",
    ].includes(position)
  ) {
    return "CORNER";
  }

  if (
    [
      "S",
      "FS",
      "SS",
    ].includes(position)
  ) {
    return "SAFETY";
  }

  return position || null;
}


function positionsAreCompatible(
  playerPosition?: string | null,
  depthPosition?: string | null
) {
  const playerFamily =
    getPositionFamily(
      playerPosition
    );

  const depthFamily =
    getPositionFamily(
      depthPosition
    );

  if (
    !playerFamily ||
    !depthFamily
  ) {
    return false;
  }

  if (
    playerFamily === depthFamily
  ) {
    return true;
  }

  // Some providers label 3-4 edge defenders as LB/OLB
  // and others as DE/EDGE. Treat those families as compatible.
  if (
    (
      playerFamily === "EDGE" &&
      depthFamily === "LINEBACKER"
    ) ||
    (
      playerFamily === "LINEBACKER" &&
      depthFamily === "EDGE"
    )
  ) {
    return true;
  }

  return false;
}


function extractEspnTeamId(
  teamRef?: string | null
) {
  if (!teamRef) {
    return null;
  }

  const match =
    teamRef.match(
      /\/teams\/([^/?#]+)/
    );

  return match?.[1]
    ? decodeURIComponent(
        match[1]
      )
    : null;
}


function isUsableCorePosition(
  athlete: EspnCoreAthlete
) {
  const abbreviation =
    normalizePositionKey(
      athlete.position
        ?.abbreviation
    );

  const id =
    cleanText(
      athlete.position?.id
    );

  return Boolean(
    abbreviation &&
    abbreviation !== "UNKNOWN" &&
    abbreviation !== "UNK" &&
    abbreviation !== "NA" &&
    abbreviation !== "NONE" &&
    abbreviation !== "0" &&
    abbreviation !== "-" &&
    id !== "0"
  );
}


function normalizeCoreStatus(
  athlete: EspnCoreAthlete
) {
  const rawStatus =
    cleanText(
      athlete.status?.type ??
      athlete.status?.name ??
      athlete.status?.abbreviation
    );

  if (!rawStatus) {
    return athlete.active === false
      ? "INACTIVE"
      : "ACTIVE";
  }

  return rawStatus
    .replace(
      /[^a-zA-Z0-9]+/g,
      "_"
    )
    .replace(
      /^_+|_+$/g,
      ""
    )
    .toUpperCase();
}


function chunkArray<T>(
  values: T[],
  size: number
) {
  const chunks: T[][] = [];

  for (
    let index = 0;
    index < values.length;
    index += size
  ) {
    chunks.push(
      values.slice(
        index,
        index + size
      )
    );
  }

  return chunks;
}


async function authorizeSync(
  request: Request
) {
  /*
   * Manual depth-chart sync:
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

        userId:
          user.id,
      };
    }
  } catch {
    /*
     * Fall through to the server-secret path.
     * Automated Supabase cron callers do not need a browser session.
     */
  }


  /*
   * Automated depth-chart sync:
   * use the same trusted server secret as the NFL injury sync.
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

      userId:
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
              "Unauthorized depth-chart sync request.",
          },
          {
            status:
              401,
          }
        ),

      authMode:
        null,

      userId:
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

    userId:
      null,
  };
}



export async function POST(
  request: Request
) {
  try {
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


    let body: RequestBody = {};

    try {
      body =
        await request.json() as
          RequestBody;
    } catch {
      // Empty request body is allowed.
    }


    const season =
      Number.isInteger(
        body.season
      ) &&
      Number(body.season) >= 2000
        ? Number(body.season)
        : 2026;


    const admin =
      createSupabaseAdminClient();


    const {
      data: teamData,
      error: teamError,
    } =
      await admin
        .from(
          "nfl_teams"
        )
        .select(
          "espn_team_id, abbreviation, display_name"
        )
        .eq(
          "is_active",
          true
        )
        .order(
          "abbreviation",
          {
            ascending: true,
          }
        );

    if (teamError) {
      throw new Error(
        teamError.message
      );
    }


    const teams =
      (
        teamData ??
        []
      ) as NflTeamRow[];

    if (
      teams.length === 0
    ) {
      throw new Error(
        "No active NFL teams were found. Sync NFL teams first."
      );
    }


    const nflPlayerMap =
      new Map<string, number>();

    const nflPlayerRowsById =
      new Map<
        number,
        NflPlayerLookupRow
      >();

    const playersByTeamAndName =
      new Map<
        string,
        NflPlayerLookupRow[]
      >();

    const addPlayerToIndexes = (
      player: NflPlayerLookupRow
    ) => {
      if (
        player.espn_player_id
      ) {
        nflPlayerMap.set(
          String(
            player.espn_player_id
          ),
          player.id
        );
      }

      nflPlayerRowsById.set(
        player.id,
        player
      );

      const team =
        cleanText(
          player.team_abbreviation ??
            undefined
        )?.toUpperCase();

      const nameKey =
        normalizeNameKey(
          player.full_name
        );

      if (
        !team ||
        !nameKey
      ) {
        return;
      }

      const key =
        `${team}:${nameKey}`;

      const existing =
        playersByTeamAndName.get(
          key
        ) ?? [];

      if (
        !existing.some(
          (candidate) =>
            candidate.id ===
            player.id
        )
      ) {
        existing.push(player);
      }

      playersByTeamAndName.set(
        key,
        existing
      );
    };


    const playerPageSize =
      1000;

    let playerPageStart =
      0;

    while (true) {
      const playerPageEnd =
        playerPageStart +
        playerPageSize -
        1;

      const {
        data: nflPlayerData,
        error: nflPlayerError,
      } =
        await admin
          .from(
            "nfl_players"
          )
          .select(
            "id, espn_player_id, full_name, primary_position, team_abbreviation, is_active"
          )
          .not(
            "espn_player_id",
            "is",
            null
          )
          .order(
            "id",
            {
              ascending: true,
            }
          )
          .range(
            playerPageStart,
            playerPageEnd
          );

      if (nflPlayerError) {
        throw new Error(
          nflPlayerError.message
        );
      }

      const playerPage =
        (
          nflPlayerData ??
          []
        ) as NflPlayerLookupRow[];

      for (
        const player
        of playerPage
      ) {
        if (
          !player.espn_player_id
        ) {
          continue;
        }

        addPlayerToIndexes(
          player
        );
      }

      if (
        playerPage.length <
        playerPageSize
      ) {
        break;
      }

      playerPageStart +=
        playerPageSize;
    }


    const hydrationCache =
      new Map<
        string,
        HydratedPlayerResult
      >();

    const coreAthleteCache =
      new Map<
        string,
        EspnCoreAthlete
      >();

    const canonicalAliasResolutions:
      {
        team: string;
        depthPosition: string | null;
        rawEspnPlayerId: string;
        canonicalEspnPlayerId: string;
        nflPlayerId: number;
        fullName: string;
      }[] =
      [];


    const fetchCoreAthlete =
      async (
        espnPlayerId: string,
        athleteRef?: string
      ) => {
        const cached =
          coreAthleteCache.get(
            espnPlayerId
          );

        if (cached) {
          return cached;
        }

        const athleteUrl =
          normalizeEspnRefUrl(
            athleteRef
          ) ??
          `https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/athletes/${encodeURIComponent(
            espnPlayerId
          )}?lang=en&region=us`;

        const athleteResponse =
          await fetch(
            athleteUrl,
            {
              cache:
                "no-store",
              headers: {
                Accept:
                  "application/json",
                "User-Agent":
                  "Gridiron365/1.0",
              },
            }
          );

        if (
          !athleteResponse.ok
        ) {
          throw new Error(
            `ESPN athlete HTTP ${athleteResponse.status}`
          );
        }

        const athlete =
          (
            await athleteResponse.json()
          ) as EspnCoreAthlete;

        coreAthleteCache.set(
          espnPlayerId,
          athlete
        );

        return athlete;
      };


    const findCanonicalExistingPlayer = ({
      fullName,
      teamAbbreviation,
      fallbackPosition,
      rawEspnPlayerId,
    }: {
      fullName: string;
      teamAbbreviation: string;
      fallbackPosition?: string | null;
      rawEspnPlayerId: string;
    }) => {
      const key =
        `${teamAbbreviation.toUpperCase()}:${normalizeNameKey(
          fullName
        )}`;

      const candidates =
        (
          playersByTeamAndName.get(
            key
          ) ??
          []
        )
          .filter(
            (candidate) =>
              candidate.espn_player_id !==
              rawEspnPlayerId
          )
          .filter(
            (candidate) =>
              candidate.is_active !== false
          );

      const compatible =
        candidates.filter(
          (candidate) =>
            positionsAreCompatible(
              candidate.primary_position,
              fallbackPosition
            )
        );

      if (
        compatible.length === 1
      ) {
        return compatible[0];
      }

      return null;
    };


    const hydrateMissingPlayer =
      async ({
        espnPlayerId,
        athleteRef,
        teamAbbreviation,
        expectedEspnTeamId,
        fallbackPosition,
      }: {
        espnPlayerId: string;
        athleteRef?: string;
        teamAbbreviation: string;
        expectedEspnTeamId: string;
        fallbackPosition?: string | null;
      }): Promise<HydratedPlayerResult> => {
        const cacheKey =
          [
            espnPlayerId,
            teamAbbreviation,
            fallbackPosition ?? "",
          ].join(":");

        const cached =
          hydrationCache.get(
            cacheKey
          );

        if (cached) {
          return cached;
        }

        try {
          const existingId =
            nflPlayerMap.get(
              espnPlayerId
            );

          const existingPlayer =
            existingId !== undefined
              ? nflPlayerRowsById.get(
                  existingId
                ) ?? null
              : null;

          // Normally an existing ESPN ID is enough. The exception is when
          // we have another current player on the same team with the same
          // exact name. In that case, validate the raw ESPN Core identity so
          // stale/legacy aliases cannot disconnect current depth-chart roles
          // from the canonical player and his historical production.
          if (existingPlayer) {
            const duplicateKey =
              `${teamAbbreviation.toUpperCase()}:${normalizeNameKey(
                existingPlayer.full_name
              )}`;

            const duplicateCandidates =
              (
                playersByTeamAndName.get(
                  duplicateKey
                ) ??
                []
              ).filter(
                (candidate) =>
                  candidate.id !==
                  existingPlayer.id
              );

            if (
              duplicateCandidates.length === 0
            ) {
              const result:
                HydratedPlayerResult =
                {
                  nflPlayerId:
                    existingPlayer.id,
                  canonicalEspnPlayerId:
                    existingPlayer.espn_player_id,
                  hydrated:
                    false,
                  canonicalized:
                    false,
                  error:
                    null,
                };

              hydrationCache.set(
                cacheKey,
                result
              );

              return result;
            }
          }

          const athlete =
            await fetchCoreAthlete(
              espnPlayerId,
              athleteRef
            );

          const fullName =
            cleanText(
              athlete.fullName ??
              athlete.displayName
            ) ??
            cleanText(
              [
                athlete.firstName,
                athlete.lastName,
              ]
                .filter(Boolean)
                .join(" ")
            );

          if (!fullName) {
            throw new Error(
              "ESPN athlete record did not include a usable name."
            );
          }

          const rawCoreTeamId =
            extractEspnTeamId(
              athlete.team?.$ref ??
                null
            );

          const coreIdentityIsTrustworthy =
            isUsableCorePosition(
              athlete
            ) &&
            rawCoreTeamId !== null &&
            rawCoreTeamId ===
              String(
                expectedEspnTeamId
              );

          if (
            !coreIdentityIsTrustworthy
          ) {
            const canonicalPlayer =
              findCanonicalExistingPlayer({
                fullName,
                teamAbbreviation,
                fallbackPosition,
                rawEspnPlayerId:
                  espnPlayerId,
              });

            if (canonicalPlayer) {
              const result:
                HydratedPlayerResult =
                {
                  nflPlayerId:
                    canonicalPlayer.id,
                  canonicalEspnPlayerId:
                    canonicalPlayer.espn_player_id,
                  hydrated:
                    false,
                  canonicalized:
                    true,
                  error:
                    null,
                };

              canonicalAliasResolutions.push({
                team:
                  teamAbbreviation,
                depthPosition:
                  fallbackPosition ??
                  null,
                rawEspnPlayerId:
                  espnPlayerId,
                canonicalEspnPlayerId:
                  canonicalPlayer.espn_player_id,
                nflPlayerId:
                  canonicalPlayer.id,
                fullName:
                  canonicalPlayer.full_name,
              });

              hydrationCache.set(
                cacheKey,
                result
              );

              return result;
            }

            throw new Error(
              `ESPN athlete ${espnPlayerId} has an untrusted Core identity (position/team missing or mismatched) and no unique canonical ${teamAbbreviation} player match was found.`
            );
          }

          if (existingPlayer) {
            const result:
              HydratedPlayerResult =
              {
                nflPlayerId:
                  existingPlayer.id,
                canonicalEspnPlayerId:
                  existingPlayer.espn_player_id,
                hydrated:
                  false,
                canonicalized:
                  false,
                error:
                  null,
              };

            hydrationCache.set(
              cacheKey,
              result
            );

            return result;
          }

          const primaryPosition =
            normalizeHydratedPosition(
              athlete.position
                ?.abbreviation,
              fallbackPosition
            );

          if (!primaryPosition) {
            throw new Error(
              "ESPN athlete record did not include a usable position."
            );
          }

          const upsertPayload = {
            espn_player_id:
              espnPlayerId,
            full_name:
              fullName,
            first_name:
              cleanText(
                athlete.firstName
              ),
            last_name:
              cleanText(
                athlete.lastName
              ),
            primary_position:
              primaryPosition
                .trim()
                .toUpperCase(),
            team_abbreviation:
              teamAbbreviation,
            jersey_number:
              cleanText(
                athlete.jersey
              ),
            status:
              normalizeCoreStatus(
                athlete
              ),
            is_active:
              athlete.active !== false,
            headshot_url:
              cleanText(
                athlete.headshot?.href
              ),
            updated_at:
              new Date()
                .toISOString(),
          };

          const {
            data: hydratedPlayerData,
            error: hydratedPlayerError,
          } =
            await admin
              .from(
                "nfl_players"
              )
              .upsert(
                upsertPayload,
                {
                  onConflict:
                    "espn_player_id",
                }
              )
              .select(
                "id, espn_player_id, full_name, primary_position, team_abbreviation, is_active"
              )
              .single();

          if (
            hydratedPlayerError
          ) {
            throw new Error(
              hydratedPlayerError.message
            );
          }

          const hydratedId =
            Number(
              hydratedPlayerData?.id
            );

          if (
            !Number.isInteger(
              hydratedId
            ) ||
            hydratedId <= 0
          ) {
            throw new Error(
              "Hydrated NFL player did not return a valid database ID."
            );
          }

          const hydratedPlayer =
            hydratedPlayerData as
            NflPlayerLookupRow;

          addPlayerToIndexes(
            hydratedPlayer
          );

          const result:
            HydratedPlayerResult =
            {
              nflPlayerId:
                hydratedId,
              canonicalEspnPlayerId:
                String(
                  hydratedPlayer.espn_player_id
                ),
              hydrated:
                true,
              canonicalized:
                false,
              error:
                null,
            };

          hydrationCache.set(
            cacheKey,
            result
          );

          return result;
        } catch (
          error
        ) {
          const result:
            HydratedPlayerResult =
            {
              nflPlayerId:
                null,
              canonicalEspnPlayerId:
                null,
              hydrated:
                false,
              canonicalized:
                false,
              error:
                error instanceof Error
                  ? error.message
                  : "Unknown ESPN athlete hydration error",
            };

          hydrationCache.set(
            cacheKey,
            result
          );

          return result;
        }
      };


    const teamErrors:
      {
        team: string;
        error: string;
      }[] =
      [];

    const teamResults:
      {
        team: string;
        formations: number;
        entries: number;
        matchedPlayers: number;
        unmatchedPlayers: number;
        hydratedPlayers: number;
        canonicalizedPlayers: number;
        hydrationFailures: number;
        staleRowsRemoved: number;
      }[] =
      [];


    let teamsProcessed = 0;
    let totalFormations = 0;
    let totalEntries = 0;
    let totalMatchedPlayers = 0;
    let totalUnmatchedPlayers = 0;
    let totalHydratedPlayers = 0;
    let totalCanonicalizedPlayers = 0;
    let totalHydrationFailures = 0;
    let totalStaleRowsRemoved = 0;


    for (
      const team
      of teams
    ) {
      try {
        const teamSyncTimestamp =
          new Date()
            .toISOString();

        const depthChartUrl =
          `https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/${season}/teams/${team.espn_team_id}/depthcharts?lang=en&region=us`;

        const depthResponse =
          await fetch(
            depthChartUrl,
            {
              cache: "no-store",
              headers: {
                Accept:
                  "application/json",
              },
            }
          );

        if (
          !depthResponse.ok
        ) {
          throw new Error(
            `ESPN depth chart HTTP ${depthResponse.status}`
          );
        }


        const payload =
          (
            await depthResponse.json()
          ) as EspnDepthChartResponse;

        const formations =
          payload.items ??
          [];

        if (
          formations.length === 0
        ) {
          throw new Error(
            "ESPN returned no depth-chart formations."
          );
        }


        const rowMap =
          new Map<
            string,
            DepthChartUpsertRow
          >();

        let matchedPlayers = 0;
        let unmatchedPlayers = 0;
        let hydratedPlayers = 0;
        let canonicalizedPlayers = 0;
        let hydrationFailures = 0;


        for (
          const formation
          of formations
        ) {
          const formationId =
            cleanText(
              formation.id
            );

          const formationName =
            cleanText(
              formation.name
            );

          if (
            !formationId ||
            !formationName
          ) {
            continue;
          }


          const positions =
            formation.positions ??
            {};

          for (
            const [
              rawPositionKey,
              positionData,
            ]
            of Object.entries(
              positions
            )
          ) {
            const positionKey =
              rawPositionKey
                .trim()
                .toLowerCase();

            if (
              !positionKey
            ) {
              continue;
            }

            const positionMetadata =
              positionData.position;

            for (
              const athleteEntry
              of (
                positionData.athletes ??
                []
              )
            ) {
              const espnPlayerId =
                extractEspnPlayerId(
                  athleteEntry
                    .athlete
                    ?.$ref
                );

              if (
                !espnPlayerId
              ) {
                continue;
              }


              const slot =
                Number(
                  athleteEntry.slot
                );

              const depthRank =
                Number(
                  athleteEntry.rank
                );

              if (
                !Number.isInteger(
                  slot
                ) ||
                slot <= 0 ||
                !Number.isInteger(
                  depthRank
                ) ||
                depthRank <= 0
              ) {
                continue;
              }


              const fallbackPosition =
                cleanText(
                  positionMetadata
                    ?.abbreviation
                ) ??
                positionKey
                  .toUpperCase();

              const hydrationResult =
                await hydrateMissingPlayer({
                  espnPlayerId,
                  athleteRef:
                    athleteEntry
                      .athlete
                      ?.$ref,
                  teamAbbreviation:
                    team.abbreviation,
                  expectedEspnTeamId:
                    team.espn_team_id,
                  fallbackPosition,
                });

              const nflPlayerId =
                hydrationResult
                  .nflPlayerId;

              const canonicalEspnPlayerId =
                hydrationResult
                  .canonicalEspnPlayerId ??
                espnPlayerId;

              if (
                hydrationResult
                  .hydrated
              ) {
                hydratedPlayers +=
                  1;
              }

              if (
                hydrationResult
                  .canonicalized
              ) {
                canonicalizedPlayers +=
                  1;
              }

              if (
                hydrationResult
                  .error
              ) {
                hydrationFailures +=
                  1;
              }

              if (
                nflPlayerId !== null
              ) {
                matchedPlayers += 1;
              } else {
                unmatchedPlayers += 1;
              }


              const row:
                DepthChartUpsertRow =
                {
                  season,
                  team_abbreviation:
                    team.abbreviation,
                  espn_team_id:
                    team.espn_team_id,
                  formation_id:
                    formationId,
                  formation_name:
                    formationName,
                  position_key:
                    positionKey,
                  position_id:
                    cleanText(
                      positionMetadata
                        ?.id
                    ),
                  position_name:
                    cleanText(
                      positionMetadata
                        ?.displayName ??
                      positionMetadata
                        ?.name
                    ),
                  position_abbreviation:
                    cleanText(
                      positionMetadata
                        ?.abbreviation
                    ),
                  slot,
                  depth_rank:
                    depthRank,
                  espn_player_id:
                    canonicalEspnPlayerId,
                  nfl_player_id:
                    nflPlayerId,
                  source:
                    "ESPN",
                  synced_at:
                    teamSyncTimestamp,
                };


              const uniqueKey =
                [
                  season,
                  team.espn_team_id,
                  formationId,
                  positionKey,
                  slot,
                  depthRank,
                ].join(":");

              rowMap.set(
                uniqueKey,
                row
              );
            }
          }
        }


        const rows =
          Array.from(
            rowMap.values()
          );

        if (
          rows.length === 0
        ) {
          throw new Error(
            "ESPN returned formations but no usable depth-chart player entries."
          );
        }


        const rowChunks =
          chunkArray(
            rows,
            500
          );

        for (
          const chunk
          of rowChunks
        ) {
          const {
            error: upsertError,
          } =
            await admin
              .from(
                "nfl_depth_chart_entries"
              )
              .upsert(
                chunk,
                {
                  onConflict:
                    "season,espn_team_id,formation_id,position_key,slot,depth_rank",
                }
              );

          if (
            upsertError
          ) {
            throw new Error(
              `Depth-chart upsert failed: ${upsertError.message}`
            );
          }
        }


        const {
          data: staleRows,
          error: staleDeleteError,
        } =
          await admin
            .from(
              "nfl_depth_chart_entries"
            )
            .delete()
            .eq(
              "season",
              season
            )
            .eq(
              "espn_team_id",
              team.espn_team_id
            )
            .lt(
              "synced_at",
              teamSyncTimestamp
            )
            .select(
              "id"
            );

        if (
          staleDeleteError
        ) {
          throw new Error(
            `Stale depth-chart cleanup failed: ${staleDeleteError.message}`
          );
        }


        const staleRowsRemoved =
          staleRows?.length ??
          0;

        teamsProcessed += 1;
        totalFormations +=
          formations.length;
        totalEntries +=
          rows.length;
        totalMatchedPlayers +=
          matchedPlayers;
        totalUnmatchedPlayers +=
          unmatchedPlayers;
        totalHydratedPlayers +=
          hydratedPlayers;
        totalCanonicalizedPlayers +=
          canonicalizedPlayers;
        totalHydrationFailures +=
          hydrationFailures;
        totalStaleRowsRemoved +=
          staleRowsRemoved;


        teamResults.push({
          team:
            team.abbreviation,
          formations:
            formations.length,
          entries:
            rows.length,
          matchedPlayers,
          unmatchedPlayers,
          hydratedPlayers,
          canonicalizedPlayers,
          hydrationFailures,
          staleRowsRemoved,
        });
      } catch (
        error
      ) {
        teamErrors.push({
          team:
            team.abbreviation,
          error:
            error instanceof Error
              ? error.message
              : "Unknown depth-chart sync error",
        });
      }
    }


    return NextResponse.json(
      {
        success:
          teamErrors.length === 0,
        userId:
          authorization.userId,
        authMode:
          authorization.authMode,
        season,
        source:
          "ESPN Core API",
        teamsExpected:
          teams.length,
        teamsProcessed,
        teamsFailed:
          teamErrors.length,
        formationsReceived:
          totalFormations,
        depthChartEntries:
          totalEntries,
        matchedPlayers:
          totalMatchedPlayers,
        unmatchedPlayers:
          totalUnmatchedPlayers,
        hydratedPlayers:
          totalHydratedPlayers,
        canonicalizedPlayers:
          totalCanonicalizedPlayers,
        canonicalAliasResolutions,
        hydrationFailures:
          totalHydrationFailures,
        distinctHydratedPlayers:
          Array.from(
            hydrationCache.values()
          ).filter(
            (result) =>
              result.hydrated
          ).length,
        distinctHydrationFailures:
          Array.from(
            hydrationCache.values()
          ).filter(
            (result) =>
              result.error !== null
          ).length,
        staleRowsRemoved:
          totalStaleRowsRemoved,
        teamResults,
        teamErrors,
      },
      {
        status:
          teamErrors.length ===
          teams.length
            ? 500
            : 200,
      }
    );
  } catch (
    error
  ) {
    console.error(
      "NFL depth-chart sync failed:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "NFL depth-chart sync failed.",
      },
      {
        status: 500,
      }
    );
  }
}
