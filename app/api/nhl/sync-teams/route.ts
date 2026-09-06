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

type EspnLogo = {
  href?: string;
  width?: number;
  height?: number;
  alt?: string;
  rel?: string[];
  lastUpdated?: string;
};

type EspnTeam = {
  id?: string;
  uid?: string;
  slug?: string;
  abbreviation?: string;
  displayName?: string;
  shortDisplayName?: string;
  name?: string;
  nickname?: string;
  location?: string;
  color?: string;
  alternateColor?: string;
  isActive?: boolean;
  logos?: EspnLogo[];
};

type EspnTeamWrapper = {
  team?: EspnTeam;
};

type EspnLeague = {
  id?: string;
  uid?: string;
  name?: string;
  abbreviation?: string;
  shortName?: string;
  slug?: string;
  teams?: EspnTeamWrapper[];
};

type EspnSport = {
  id?: string;
  uid?: string;
  name?: string;
  slug?: string;
  leagues?: EspnLeague[];
};

type EspnTeamsResponse = {
  sports?: EspnSport[];
};

type ExistingNhlTeamRow = {
  id: number;
  espn_team_id: string | null;
  abbreviation: string;
  name: string;
  display_name: string;
  short_name: string | null;
  location: string | null;
  conference: string | null;
  division: string | null;
  logo_url: string | null;
  active: boolean;
};

type NhlTeamUpsertRow = {
  id: number;
  espn_team_id: string;
  abbreviation: string;
  name: string;
  display_name: string;
  short_name: string | null;
  location: string | null;
  conference: string | null;
  division: string | null;
  logo_url: string | null;
  active: boolean;
  provider_data: Record<
    string,
    unknown
  >;
  updated_at: string;
};

const ESPN_NHL_TEAMS_URL =
  "https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/teams?limit=100";

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
    process.env
      .GRIDIRON_SYNC_SECRET ??
    process.env
      .NFL_SYNC_SECRET;

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

function asTrimmedString(
  value:
    string |
    null |
    undefined
) {
  if (
    typeof value !==
    "string"
  ) {
    return null;
  }

  const trimmed =
    value.trim();

  return trimmed.length > 0
    ? trimmed
    : null;
}

function numericEspnTeamId(
  value:
    string |
    null |
    undefined
) {
  if (!value) {
    return null;
  }

  const parsed =
    Number(value);

  if (
    !Number.isSafeInteger(
      parsed
    ) ||
    parsed <= 0
  ) {
    return null;
  }

  return parsed;
}

function getLogoUrl(
  team: EspnTeam
) {
  const logos =
    team.logos ?? [];

  const preferred =
    logos.find(
      (logo) =>
        Array.isArray(
          logo.rel
        ) &&
        logo.rel.includes(
          "default"
        )
    ) ??
    logos[0];

  return asTrimmedString(
    preferred?.href
  );
}

function normalizedAbbreviation(
  team: EspnTeam
) {
  const abbreviation =
    asTrimmedString(
      team.abbreviation
    );

  if (!abbreviation) {
    return null;
  }

  return abbreviation
    .toUpperCase();
}

function getTeamsFromPayload(
  payload:
    EspnTeamsResponse
) {
  const teams:
    EspnTeam[] = [];

  for (
    const sport of
      payload.sports ?? []
  ) {
    for (
      const league of
        sport.leagues ?? []
    ) {
      for (
        const wrapper of
          league.teams ?? []
      ) {
        if (
          wrapper.team
        ) {
          teams.push(
            wrapper.team
          );
        }
      }
    }
  }

  return teams;
}

async function fetchEspnNhlTeams() {
  const response =
    await fetch(
      ESPN_NHL_TEAMS_URL,
      {
        method: "GET",
        cache: "no-store",
        headers: {
          Accept:
            "application/json",
          "User-Agent":
            "Mozilla/5.0 Gridiron365/2.0",
        },
      }
    );

  const text =
    await response.text();

  if (!response.ok) {
    throw new Error(
      `ESPN NHL teams request returned HTTP ${response.status}: ${text.slice(
        0,
        300
      )}`
    );
  }

  let payload:
    EspnTeamsResponse;

  try {
    payload =
      JSON.parse(
        text
      ) as EspnTeamsResponse;
  } catch {
    throw new Error(
      "ESPN NHL teams returned invalid JSON."
    );
  }

  return payload;
}

export async function POST(
  request: Request
) {
  if (
    !isAuthorized(
      request
    )
  ) {
    return NextResponse.json(
      {
        success: false,
        source: "ESPN",
        sport: "NHL",
        error:
          "Unauthorized NHL team sync request.",
      },
      {
        status: 401,
      }
    );
  }

  try {
    const supabase =
      createSupabaseAdmin();

    const payload =
      await fetchEspnNhlTeams();

    const providerTeams =
      getTeamsFromPayload(
        payload
      );

    if (
      providerTeams.length ===
      0
    ) {
      return NextResponse.json(
        {
          success: false,
          source: "ESPN",
          sport: "NHL",
          error:
            "ESPN returned no NHL teams.",
        },
        {
          status: 502,
        }
      );
    }

    const {
      data:
        existingData,
      error:
        existingError,
    } =
      await supabase
        .from(
          "nhl_teams"
        )
        .select(`
          id,
          espn_team_id,
          abbreviation,
          name,
          display_name,
          short_name,
          location,
          conference,
          division,
          logo_url,
          active
        `);

    if (
      existingError
    ) {
      throw new Error(
        `Could not load existing NHL teams: ${existingError.message}`
      );
    }

    const existingTeams =
      (
        existingData ??
        []
      ) as ExistingNhlTeamRow[];

    const existingByEspnId =
      new Map<
        string,
        ExistingNhlTeamRow
      >();

    for (
      const team of
        existingTeams
    ) {
      if (
        team.espn_team_id
      ) {
        existingByEspnId.set(
          team.espn_team_id,
          team
        );
      }
    }

    const nowIso =
      new Date()
        .toISOString();

    const rows:
      NhlTeamUpsertRow[] =
      [];

    const skipped:
      Array<{
        espnTeamId:
          string | null;
        displayName:
          string | null;
        reason:
          string;
      }> = [];

    for (
      const team of
        providerTeams
    ) {
      const espnTeamId =
        asTrimmedString(
          team.id
        );

      const providerNumericId =
        numericEspnTeamId(
          espnTeamId
        );

      const abbreviation =
        normalizedAbbreviation(
          team
        );

      const displayName =
        asTrimmedString(
          team.displayName
        );

      const name =
        asTrimmedString(
          team.name
        ) ??
        asTrimmedString(
          team.nickname
        );

      if (
        !espnTeamId ||
        providerNumericId ===
          null ||
        !abbreviation ||
        !displayName ||
        !name
      ) {
        skipped.push({
          espnTeamId,
          displayName,
          reason:
            "Required ESPN NHL team identity fields were missing or invalid.",
        });

        continue;
      }

      const existing =
        existingByEspnId.get(
          espnTeamId
        );

      /*
       * For new NHL team rows we intentionally use ESPN's
       * numeric team ID as the shared nhl_teams primary key.
       *
       * Once a team already exists, preserve its current
       * internal ID so future syncs never change references
       * used by nhl_games, stats, fantasy data, or Pick'em.
       */
      const internalId =
        existing?.id ??
        providerNumericId;

      rows.push({
        id:
          internalId,

        espn_team_id:
          espnTeamId,

        abbreviation,

        name,

        display_name:
          displayName,

        short_name:
          asTrimmedString(
            team.shortDisplayName
          ),

        location:
          asTrimmedString(
            team.location
          ),

        /*
         * The ESPN league team-list payload does not need to
         * be treated as authoritative for conference/division.
         * Preserve values if we already have them. A later
         * NHL metadata sync can populate these from a verified
         * provider source without this basic identity sync
         * erasing them.
         */
        conference:
          existing?.conference ??
          null,

        division:
          existing?.division ??
          null,

        logo_url:
          getLogoUrl(
            team
          ),

        active:
          team.isActive !==
          false,

        provider_data: {
          provider:
            "ESPN",
          espn_team_id:
            espnTeamId,
          uid:
            team.uid ??
            null,
          slug:
            team.slug ??
            null,
          abbreviation:
            team.abbreviation ??
            null,
          displayName:
            team.displayName ??
            null,
          shortDisplayName:
            team.shortDisplayName ??
            null,
          name:
            team.name ??
            null,
          nickname:
            team.nickname ??
            null,
          location:
            team.location ??
            null,
          color:
            team.color ??
            null,
          alternateColor:
            team.alternateColor ??
            null,
          isActive:
            team.isActive ??
            null,
          logos:
            team.logos ??
            [],
          syncedAt:
            nowIso,
        },

        updated_at:
          nowIso,
      });
    }

    if (
      rows.length ===
      0
    ) {
      return NextResponse.json(
        {
          success: false,
          source: "ESPN",
          sport: "NHL",
          teamsReceived:
            providerTeams.length,
          teamsValid: 0,
          teamsSkipped:
            skipped.length,
          skipped,
          error:
            "No valid NHL teams were available to save.",
        },
        {
          status: 502,
        }
      );
    }

    /*
     * Upsert against the primary key rather than assuming an
     * espn_team_id unique constraint. New rows use ESPN's
     * numeric team ID; existing rows retain their current ID.
     */
    const {
      error:
        upsertError,
    } =
      await supabase
        .from(
          "nhl_teams"
        )
        .upsert(
          rows,
          {
            onConflict:
              "id",
          }
        );

    if (
      upsertError
    ) {
      throw new Error(
        `Could not save NHL teams: ${upsertError.message}`
      );
    }

    const providerIds =
      new Set(
        rows.map(
          (row) =>
            row.espn_team_id
        )
      );

    /*
     * Do not hard-delete teams that disappear from a provider
     * response. Historical game/stat rows may reference them.
     *
     * Only mark an existing team inactive when:
     * - it has an ESPN identity, and
     * - it is absent from the current complete NHL team feed.
     */
    const idsToDeactivate =
      existingTeams
        .filter(
          (team) =>
            team.espn_team_id !==
              null &&
            !providerIds.has(
              team.espn_team_id
            ) &&
            team.active
        )
        .map(
          (team) =>
            team.id
        );

    let teamsDeactivated =
      0;

    if (
      idsToDeactivate.length >
      0
    ) {
      const {
        error:
          deactivateError,
      } =
        await supabase
          .from(
            "nhl_teams"
          )
          .update({
            active:
              false,
            updated_at:
              nowIso,
          })
          .in(
            "id",
            idsToDeactivate
          );

      if (
        deactivateError
      ) {
        throw new Error(
          `Could not deactivate stale NHL teams: ${deactivateError.message}`
        );
      }

      teamsDeactivated =
        idsToDeactivate.length;
    }

    const {
      data:
        savedData,
      error:
        savedError,
    } =
      await supabase
        .from(
          "nhl_teams"
        )
        .select(
          "id,espn_team_id,abbreviation,display_name,active"
        )
        .order(
          "display_name",
          {
            ascending:
              true,
          }
        );

    if (
      savedError
    ) {
      throw new Error(
        `NHL teams were saved, but verification failed: ${savedError.message}`
      );
    }

    const savedTeams =
      savedData ?? [];

    const activeTeams =
      savedTeams.filter(
        (team) =>
          team.active ===
          true
      );

    return NextResponse.json({
      success: true,
      source: "ESPN",
      sport: "NHL",
      endpoint:
        ESPN_NHL_TEAMS_URL,

      teamsReceived:
        providerTeams.length,

      teamsSaved:
        rows.length,

      teamsSkipped:
        skipped.length,

      teamsDeactivated,

      totalTeamsInDatabase:
        savedTeams.length,

      activeTeams:
        activeTeams.length,

      skipped,

      teams:
        savedTeams,
    });
  } catch (
    error
  ) {
    console.error(
      "NHL team sync failed:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        source: "ESPN",
        sport: "NHL",
        error:
          error instanceof
          Error
            ? error.message
            : "Unknown NHL team sync error.",
      },
      {
        status: 500,
      }
    );
  }
}