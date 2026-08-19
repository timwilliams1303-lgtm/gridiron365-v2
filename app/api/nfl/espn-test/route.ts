import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const url =
      "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard";

    const response = await fetch(url, {
      method: "GET",

      headers: {
        Accept: "application/json",
        "User-Agent":
          "Mozilla/5.0 Gridiron365/1.0",
      },

      cache: "no-store",
    });

    const text = await response.text();

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          status: response.status,
          statusText: response.statusText,
          responsePreview: text.slice(0, 1000),
        },
        {
          status: 500,
        }
      );
    }

    let data: unknown;

    try {
      data = JSON.parse(text);
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: "ESPN did not return valid JSON.",
          responsePreview: text.slice(0, 1000),
        },
        {
          status: 500,
        }
      );
    }

    const scoreboard =
      data as {
        leagues?: unknown[];
        events?: Array<{
          id?: string;
          name?: string;
          shortName?: string;
          date?: string;

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

          competitions?: Array<{
            id?: string;

            competitors?: Array<{
              id?: string;
              homeAway?: string;
              score?: string;

              team?: {
                id?: string;
                abbreviation?: string;
                displayName?: string;
              };
            }>;
          }>;
        }>;
      };

    const events =
      scoreboard.events ?? [];

    const games = events.map((event) => {
      const competition =
        event.competitions?.[0];

      const competitors =
        competition?.competitors ?? [];

      const home =
        competitors.find(
          (team) =>
            team.homeAway === "home"
        );

      const away =
        competitors.find(
          (team) =>
            team.homeAway === "away"
        );

      return {
        espnEventId: event.id ?? null,

        name:
          event.name ?? null,

        shortName:
          event.shortName ?? null,

        date:
          event.date ?? null,

        status:
          event.status?.type?.name ??
          null,

        state:
          event.status?.type?.state ??
          null,

        completed:
          event.status?.type?.completed ??
          false,

        detail:
          event.status?.type?.detail ??
          null,

        home: {
          espnTeamId:
            home?.team?.id ?? null,

          abbreviation:
            home?.team?.abbreviation ??
            null,

          name:
            home?.team?.displayName ??
            null,

          score:
            home?.score ?? null,
        },

        away: {
          espnTeamId:
            away?.team?.id ?? null,

          abbreviation:
            away?.team?.abbreviation ??
            null,

          name:
            away?.team?.displayName ??
            null,

          score:
            away?.score ?? null,
        },
      };
    });

    return NextResponse.json({
      success: true,

      source: "ESPN",

      eventCount:
        games.length,

      games,
    });
  } catch (error) {
    console.error(
      "ESPN scoreboard test failed:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        error:
          error instanceof Error
            ? error.message
            : "Unknown ESPN error.",
      },
      {
        status: 500,
      }
    );
  }
}