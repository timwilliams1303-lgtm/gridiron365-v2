import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const eventId = "401873272";

    const url =
      `https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=${eventId}`;

    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0 Gridiron365/1.0",
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
          preview: text.slice(0, 2000),
        },
        { status: 500 }
      );
    }

    const data = JSON.parse(text);

    const boxscore = data?.boxscore ?? null;

    const players = boxscore?.players ?? [];

    const teams = players.map((team: any) => ({
      team: {
        id: team?.team?.id ?? null,
        abbreviation:
          team?.team?.abbreviation ?? null,
        displayName:
          team?.team?.displayName ?? null,
      },

      statistics:
        (team?.statistics ?? []).map(
          (category: any) => ({
            name: category?.name ?? null,
            displayName:
              category?.displayName ?? null,
            labels: category?.labels ?? [],
            athletes:
              (category?.athletes ?? []).map(
                (entry: any) => ({
                  athlete: {
                    id:
                      entry?.athlete?.id ??
                      null,
                    name:
                      entry?.athlete
                        ?.displayName ??
                      entry?.athlete
                        ?.fullName ??
                      null,
                    position:
                      entry?.athlete
                        ?.position
                        ?.abbreviation ??
                      null,
                  },

                  stats:
                    entry?.stats ?? [],
                })
              ),
          })
        ),
    }));

    return NextResponse.json({
      success: true,
      source: "ESPN",
      eventId,

      game: {
        season:
          data?.header?.season?.year ??
          null,

        seasonType:
          data?.header?.season?.type ??
          null,

        week:
          data?.header?.week ??
          null,

        status:
          data?.header
            ?.competitions?.[0]
            ?.status?.type?.name ??
          null,

        state:
          data?.header
            ?.competitions?.[0]
            ?.status?.type?.state ??
          null,

        completed:
          data?.header
            ?.competitions?.[0]
            ?.status?.type
            ?.completed ??
          false,
      },

      teams,
    });
  } catch (error) {
    console.error(
      "ESPN box score test failed:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown error",
      },
      { status: 500 }
    );
  }
}