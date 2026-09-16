import { NextResponse } from "next/server";

import { requireLeagueMember } from "@/lib/leagues/requireLeagueMember";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type TrackRow = {
  id: number;
  code: string;
  name: string | null;
};

type CardRow = {
  id: number;
  track_id: number;
  race_date: string;
  session: string | null;
  scheduled_first_post: string | null;
  card_status: string;
  lock_at: string | null;
  commissioner_confirmed_at: string | null;
};

type RaceRow = {
  id: number;
  card_id: number;
  race_number: number;
  scheduled_post_time: string | null;
  race_status: string;
};

function jsonError(error: string, status: number) {
  return NextResponse.json(
    { success: false, error },
    {
      status,
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    },
  );
}

function easternTodayIsoDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function cardSortValue(card: CardRow) {
  if (card.scheduled_first_post) {
    const value = new Date(card.scheduled_first_post).getTime();

    if (Number.isFinite(value)) {
      return value;
    }
  }

  return new Date(`${card.race_date}T23:59:59Z`).getTime();
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const leagueId = (url.searchParams.get("leagueId") ?? "").trim();

    if (!leagueId) {
      return jsonError("leagueId is required.", 400);
    }

    const access = await requireLeagueMember(leagueId);

    if (String(access.league.leagueType) !== "greyhound") {
      return jsonError(
        "This endpoint is only available for Greyhound leagues.",
        400,
      );
    }

    const admin = createSupabaseAdminClient();
    const today = easternTodayIsoDate();

    /*
     * League Home discovery is deliberately independent from wager-workspace.
     * A commissioner-confirmed GWD/GTS card is the authority for what the
     * dashboard should display next.
     */
    const { data: tracksData, error: tracksError } = await admin
      .from("greyhound_tracks")
      .select("id, code, name")
      .in("code", ["GWD", "GTS"])
      .eq("active", true);

    if (tracksError) {
      return jsonError(tracksError.message, 500);
    }

    const tracks = (tracksData ?? []) as TrackRow[];
    const trackIds = tracks.map((track) => Number(track.id));

    if (trackIds.length === 0) {
      return NextResponse.json(
        {
          success: true,
          card: null,
          races: [],
          message: "No active Greyhound tracks are available.",
        },
        {
          headers: {
            "Cache-Control": "no-store, max-age=0",
          },
        },
      );
    }

    const { data: cardsData, error: cardsError } = await admin
      .from("greyhound_cards")
      .select(`
        id,
        track_id,
        race_date,
        session,
        scheduled_first_post,
        card_status,
        lock_at,
        commissioner_confirmed_at
      `)
      .in("track_id", trackIds)
      .gte("race_date", today)
      .not("commissioner_confirmed_at", "is", null)
      .order("race_date", { ascending: true })
      .order("scheduled_first_post", { ascending: true })
      .limit(60);

    if (cardsError) {
      return jsonError(cardsError.message, 500);
    }

    const cards = ((cardsData ?? []) as CardRow[])
      .filter(
        (card) =>
          !["final", "cancelled"].includes(
            String(card.card_status ?? "").toLowerCase(),
          ),
      )
      .sort((a, b) => cardSortValue(a) - cardSortValue(b));

    if (cards.length === 0) {
      return NextResponse.json(
        {
          success: true,
          card: null,
          races: [],
          message: "No upcoming published Greyhound race card is available.",
        },
        {
          headers: {
            "Cache-Control": "no-store, max-age=0",
          },
        },
      );
    }

    /*
     * Require actual scheduled/upcoming race rows. If an otherwise-published
     * card has no usable races, continue to the next published card.
     */
    for (const card of cards) {
      const { data: racesData, error: racesError } = await admin
        .from("greyhound_races")
        .select(`
          id,
          card_id,
          race_number,
          scheduled_post_time,
          race_status
        `)
        .eq("card_id", Number(card.id))
        .order("race_number", { ascending: true });

      if (racesError) {
        return jsonError(racesError.message, 500);
      }

      const races = (racesData ?? []) as RaceRow[];
      const hasUsableRace = races.some((race) =>
        ["scheduled", "upcoming"].includes(
          String(race.race_status ?? "").toLowerCase(),
        ),
      );

      if (!hasUsableRace) {
        continue;
      }

      const track =
        tracks.find(
          (item) => Number(item.id) === Number(card.track_id),
        ) ?? null;

      return NextResponse.json(
        {
          success: true,
          card: {
            id: Number(card.id),
            raceDate: card.race_date,
            session: card.session,
            cardStatus: card.card_status,
            scheduledFirstPost: card.scheduled_first_post,
            lockAt: card.lock_at,
            track: track
              ? {
                  id: Number(track.id),
                  code: track.code,
                  name: track.name,
                }
              : null,
          },
          races: races.map((race) => ({
            id: Number(race.id),
            raceNumber: Number(race.race_number),
            scheduledPostTime: race.scheduled_post_time,
            raceStatus: String(race.race_status),
          })),
        },
        {
          headers: {
            "Cache-Control": "no-store, max-age=0",
          },
        },
      );
    }

    return NextResponse.json(
      {
        success: true,
        card: null,
        races: [],
        message: "No upcoming published Greyhound race card has scheduled races.",
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      },
    );
  } catch (error) {
    console.error("[greyhound/league-home-card] GET failed:", error);

    return jsonError(
      error instanceof Error
        ? error.message
        : "Unable to load the next Greyhound race card.",
      500,
    );
  }
}
