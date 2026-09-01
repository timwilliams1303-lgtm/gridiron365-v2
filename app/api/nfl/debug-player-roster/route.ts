import {
  NextResponse,
} from "next/server";

type EspnCorePosition = {
  $ref?: string;
  id?: string;
  name?: string;
  displayName?: string;
  abbreviation?: string;
  leaf?: boolean;
  parent?: {
    $ref?: string;
  };
};

type EspnCoreStatus = {
  id?: string;
  name?: string;
  type?: string;
  abbreviation?: string;
};

type EspnCoreTeamReference = {
  $ref?: string;
};

type EspnCoreHeadshot = {
  href?: string;
  alt?: string;
};

type EspnCoreAthlete = {
  $ref?: string;

  id?: string;
  uid?: string;
  guid?: string;

  firstName?: string;
  lastName?: string;
  fullName?: string;
  displayName?: string;
  shortName?: string;

  jersey?: string;

  active?: boolean;

  position?: EspnCorePosition;

  status?: EspnCoreStatus;

  team?: EspnCoreTeamReference;

  teams?: EspnCoreTeamReference[];

  headshot?: EspnCoreHeadshot;

  [key: string]: unknown;
};

function errorResponse(
  message: string,
  status: number,
  extra?: Record<
    string,
    unknown
  >
) {
  return NextResponse.json(
    {
      success: false,
      error: message,
      ...(extra ?? {}),
    },
    {
      status,
    }
  );
}

function normalizeEspnUrl(
  value: string
) {
  if (
    value.startsWith(
      "http://"
    )
  ) {
    return (
      "https://" +
      value.slice(
        "http://".length
      )
    );
  }

  return value;
}

export async function GET() {
  try {
    /*
     * Remaining unmatched player:
     *
     * Team: PHI
     * Formation: Base 3-4 D
     * Position: NT
     * Slot: 2
     * Depth rank: 1
     * ESPN player ID: 3043133
     */
    const espnPlayerId =
      "3043133";

    const season =
      2026;

    const athleteUrl =
      normalizeEspnUrl(
        `https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/athletes/3043133?lang=en&region=us`
      );

    console.log(
      "[debug-player-roster] Fetching ESPN Core athlete:",
      {
        season,
        espnPlayerId,
        athleteUrl,
      }
    );

    const response =
      await fetch(
        athleteUrl,
        {
          method: "GET",

          headers: {
            Accept:
              "application/json",

            "User-Agent":
              "Mozilla/5.0",
          },

          cache:
            "no-store",
        }
      );

    const rawText =
      await response.text();

    if (
      !response.ok
    ) {
      console.error(
        "[debug-player-roster] ESPN Core request failed:",
        {
          status:
            response.status,

          statusText:
            response.statusText,

          body:
            rawText.slice(
              0,
              2000
            ),
        }
      );

      return errorResponse(
        "ESPN Core athlete request failed.",
        response.status,
        {
          espnPlayerId,

          season,

          athleteUrl,

          espnStatus:
            response.status,

          espnStatusText:
            response.statusText,

          espnBody:
            rawText.slice(
              0,
              5000
            ),
        }
      );
    }

    let raw:
      EspnCoreAthlete;

    try {
      raw =
        JSON.parse(
          rawText
        ) as EspnCoreAthlete;
    } catch (
      error
    ) {
      console.error(
        "[debug-player-roster] ESPN returned invalid JSON:",
        error
      );

      return errorResponse(
        "ESPN Core returned invalid JSON.",
        500,
        {
          espnPlayerId,

          season,

          athleteUrl,

          responsePreview:
            rawText.slice(
              0,
              5000
            ),
        }
      );
    }

    const athlete = {
      id:
        raw.id ??
        null,

      uid:
        raw.uid ??
        null,

      guid:
        raw.guid ??
        null,

      firstName:
        raw.firstName ??
        null,

      lastName:
        raw.lastName ??
        null,

      fullName:
        raw.fullName ??
        null,

      displayName:
        raw.displayName ??
        null,

      shortName:
        raw.shortName ??
        null,

      jersey:
        raw.jersey ??
        null,

      active:
        raw.active ??
        null,

      position:
        raw.position
          ? {
              $ref:
                raw.position
                  .$ref ??
                null,

              id:
                raw.position
                  .id ??
                null,

              name:
                raw.position
                  .name ??
                null,

              displayName:
                raw.position
                  .displayName ??
                null,

              abbreviation:
                raw.position
                  .abbreviation ??
                null,

              leaf:
                raw.position
                  .leaf ??
                null,

              parent:
                raw.position
                  .parent ??
                null,
            }
          : null,

      status:
        raw.status
          ? {
              id:
                raw.status
                  .id ??
                null,

              name:
                raw.status
                  .name ??
                null,

              type:
                raw.status
                  .type ??
                null,

              abbreviation:
                raw.status
                  .abbreviation ??
                null,
            }
          : null,

      team:
        raw.team ??
        null,

      teams:
        raw.teams ??
        null,

      headshot:
        raw.headshot
          ? {
              href:
                raw.headshot
                  .href ??
                null,

              alt:
                raw.headshot
                  .alt ??
                null,
            }
          : null,
    };

    console.log(
      "[debug-player-roster] ESPN Core athlete result:",
      {
        espnPlayerId,

        id:
          athlete.id,

        fullName:
          athlete.fullName,

        position:
          athlete.position
            ?.abbreviation,

        status:
          athlete.status
            ?.name,

        active:
          athlete.active,

        teamRef:
          athlete.team
            ?.$ref,
      }
    );

    return NextResponse.json(
      {
        success: true,

        season,

        espnPlayerId,

        athleteUrl,

        athlete,

        raw,
      }
    );
  } catch (
    error
  ) {
    console.error(
      "[debug-player-roster] Unexpected error:",
      error
    );

    return errorResponse(
      error instanceof
        Error
        ? error.message
        : "Unexpected debug route error.",
      500
    );
  }
}