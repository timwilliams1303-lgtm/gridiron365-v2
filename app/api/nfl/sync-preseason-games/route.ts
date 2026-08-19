import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

type EspnTeam = {
  id?: string;
  abbreviation?: string;
  displayName?: string;
};

type EspnCompetitor = {
  homeAway?: "home" | "away";
  score?: string;

  team?: EspnTeam;
};

type EspnCompetition = {
  id?: string;
  date?: string;

  neutralSite?: boolean;

  venue?: {
    fullName?: string;

    address?: {
      city?: string;
      state?: string;
    };
  };

  status?: {
    type?: {
      id?: string;
      name?: string;
      state?: string;
      completed?: boolean;
      description?: string;
      detail?: string;
      shortDetail?: string;
    };
  };

  competitors?: EspnCompetitor[];
};

type EspnEvent = {
  id?: string;
  date?: string;

  season?: {
    year?: number;
    type?: number;
    slug?: string;
  };

  week?: {
    number?: number;
  };

  competitions?: EspnCompetition[];
};

type EspnScoreboard = {
  events?: EspnEvent[];
};

type NflTeamRow = {
  id: number;
  espn_team_id: string;
  abbreviation: string;
};

function toInteger(
  value:
    | string
    | number
    | null
    | undefined
) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return 0;
  }

  const parsed =
    Number(value);

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.trunc(parsed);
}

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
      "Missing Supabase environment variables."
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

export async function POST() {
  try {
    const supabase =
      createSupabaseAdmin();

    const season =
      2026;

    const espnUrl =
      `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=${season}&seasontype=1&limit=100`;

    const espnResponse =
      await fetch(
        espnUrl,
        {
          method: "GET",

          headers: {
            Accept:
              "application/json",

            "User-Agent":
              "Mozilla/5.0 Gridiron365/1.0",
          },

          cache:
            "no-store",
        }
      );

    const espnText =
      await espnResponse.text();

    if (!espnResponse.ok) {
      return NextResponse.json(
        {
          success: false,
          source: "ESPN",
          status:
            espnResponse.status,
          statusText:
            espnResponse.statusText,
          responsePreview:
            espnText.slice(
              0,
              2000
            ),
        },
        {
          status: 502,
        }
      );
    }

    let scoreboard:
      EspnScoreboard;

    try {
      scoreboard =
        JSON.parse(
          espnText
        ) as EspnScoreboard;
    } catch {
      return NextResponse.json(
        {
          success: false,
          error:
            "ESPN returned invalid JSON.",
        },
        {
          status: 502,
        }
      );
    }

    const {
      data: nflTeams,
      error: teamError,
    } =
      await supabase
        .from("nfl_teams")
        .select(
          `
            id,
            espn_team_id,
            abbreviation
          `
        );

    if (teamError) {
      throw new Error(
        `Unable to load NFL teams: ${teamError.message}`
      );
    }

    const teamRows =
      (nflTeams ??
        []) as NflTeamRow[];

    const teamByEspnId =
      new Map<
        string,
        NflTeamRow
      >();

    for (
      const team
      of teamRows
    ) {
      teamByEspnId.set(
        String(
          team.espn_team_id
        ),
        team
      );
    }

    const events =
      scoreboard.events ??
      [];

    let processed =
      0;

    let insertedOrUpdated =
      0;

    let skipped =
      0;

    const skippedGames:
      Array<{
        eventId: string | null;
        reason: string;
      }> =
      [];

    const syncedGames:
      Array<{
        espnEventId: string;
        week: number;
        home: string | null;
        away: string | null;
        status: string | null;
      }> =
      [];

    for (
      const event
      of events
    ) {
      processed += 1;

      const eventId =
        event.id;

      const competition =
        event.competitions?.[0];

      if (
        !eventId ||
        !competition
      ) {
        skipped += 1;

        skippedGames.push({
          eventId:
            eventId ?? null,

          reason:
            "Missing ESPN event ID or competition.",
        });

        continue;
      }

      const competitors =
        competition.competitors ??
        [];

      const home =
        competitors.find(
          (competitor) =>
            competitor.homeAway ===
            "home"
        );

      const away =
        competitors.find(
          (competitor) =>
            competitor.homeAway ===
            "away"
        );

      const homeEspnTeamId =
        home?.team?.id;

      const awayEspnTeamId =
        away?.team?.id;

      if (
        !homeEspnTeamId ||
        !awayEspnTeamId
      ) {
        skipped += 1;

        skippedGames.push({
          eventId,
          reason:
            "Missing home or away ESPN team ID.",
        });

        continue;
      }

      const homeInternalTeam =
        teamByEspnId.get(
          homeEspnTeamId
        );

      const awayInternalTeam =
        teamByEspnId.get(
          awayEspnTeamId
        );

      if (
        !homeInternalTeam ||
        !awayInternalTeam
      ) {
        skipped += 1;

        skippedGames.push({
          eventId,
          reason:
            `Could not map ESPN teams. Home=${homeEspnTeamId}, Away=${awayEspnTeamId}`,
        });

        continue;
      }

      const kickoffAt =
        competition.date ??
        event.date;

      if (!kickoffAt) {
        skipped += 1;

        skippedGames.push({
          eventId,
          reason:
            "Missing kickoff date.",
        });

        continue;
      }

      const eventSeason =
        event.season?.year ??
        season;

      const seasonType =
        event.season?.type ??
        1;

      const week =
        event.week?.number ??
        0;

      const statusType =
        competition
          .status
          ?.type
          ?.id ??
        null;

      const statusName =
        competition
          .status
          ?.type
          ?.name ??
        null;

      const statusDetail =
        competition
          .status
          ?.type
          ?.detail ??
        competition
          .status
          ?.type
          ?.description ??
        null;

      const completed =
        competition
          .status
          ?.type
          ?.completed ??
        false;

      const payload = {
        espn_event_id:
          eventId,

        season:
          eventSeason,

        season_type:
          seasonType,

        week,

        kickoff_at:
          kickoffAt,

        home_team_id:
          homeInternalTeam.id,

        away_team_id:
          awayInternalTeam.id,

        home_score:
          toInteger(
            home?.score
          ),

        away_score:
          toInteger(
            away?.score
          ),

        status_type:
          statusType,

        status_name:
          statusName,

        status_detail:
          statusDetail,

        status_completed:
          completed,

        venue_name:
          competition
            .venue
            ?.fullName ??
          null,

        venue_city:
          competition
            .venue
            ?.address
            ?.city ??
          null,

        venue_state:
          competition
            .venue
            ?.address
            ?.state ??
          null,

        neutral_site:
          competition
            .neutralSite ??
          false,

        updated_at:
          new Date()
            .toISOString(),
      };

      const {
        error: upsertError,
      } =
        await supabase
          .from("nfl_games")
          .upsert(
            payload,
            {
              onConflict:
                "espn_event_id",
            }
          );

      if (upsertError) {
        throw new Error(
          `Unable to upsert ESPN game ${eventId}: ${upsertError.message}`
        );
      }

      insertedOrUpdated +=
        1;

      syncedGames.push({
        espnEventId:
          eventId,

        week,

        home:
          home
            ?.team
            ?.abbreviation ??
          null,

        away:
          away
            ?.team
            ?.abbreviation ??
          null,

        status:
          statusName,
      });
    }

    return NextResponse.json({
      success: true,

      source:
        "ESPN",

      season,

      seasonType: 1,

      processed,

      insertedOrUpdated,

      skipped,

      syncedGames,

      skippedGames,
    });
  } catch (error) {
    console.error(
      "Preseason ESPN game sync failed:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        error:
          error instanceof Error
            ? error.message
            : "Unknown preseason sync error.",
      },
      {
        status: 500,
      }
    );
  }
}