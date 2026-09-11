import { NextResponse } from "next/server";

import { requireLeagueMember } from "@/lib/leagues/requireLeagueMember";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type RouteContext = {
  params: Promise<{
    cardId: string;
  }>;
};

type RaceTimePayload = {
  raceNumber?: number;
  scheduledPostTime?: string | null;
};

type RequestBody = {
  leagueId?: string;
  raceTimes?: RaceTimePayload[];
};

export async function POST(
  request: Request,
  context: RouteContext,
) {
  try {
    const { cardId } = await context.params;
    const numericCardId = Number(cardId);

    if (!Number.isInteger(numericCardId) || numericCardId <= 0) {
      return NextResponse.json(
        { error: "Invalid Greyhound card ID." },
        { status: 400 },
      );
    }

    const body = (await request.json().catch(() => null)) as RequestBody | null;
    const leagueId =
      typeof body?.leagueId === "string" ? body.leagueId.trim() : "";

    if (!leagueId) {
      return NextResponse.json(
        { error: "leagueId is required." },
        { status: 400 },
      );
    }

    if (!Array.isArray(body?.raceTimes)) {
      return NextResponse.json(
        { error: "raceTimes must be an array." },
        { status: 400 },
      );
    }

    const seenRaceNumbers = new Set<number>();
    const raceTimes = body.raceTimes.map((item) => {
      const raceNumber = Number(item?.raceNumber);

      if (!Number.isInteger(raceNumber) || raceNumber <= 0) {
        throw new Error("Every race time requires a valid raceNumber.");
      }

      if (seenRaceNumbers.has(raceNumber)) {
        throw new Error(`Race ${raceNumber} was included more than once.`);
      }

      seenRaceNumbers.add(raceNumber);

      const scheduledPostTime =
        typeof item?.scheduledPostTime === "string"
          ? item.scheduledPostTime.trim()
          : item?.scheduledPostTime === null
            ? null
            : null;

      if (
        scheduledPostTime &&
        Number.isNaN(Date.parse(scheduledPostTime))
      ) {
        throw new Error(`Race ${raceNumber} has an invalid scheduled post time.`);
      }

      return {
        raceNumber,
        scheduledPostTime: scheduledPostTime || null,
      };
    });

    const access = await requireLeagueMember(leagueId);

    if (String(access.league.leagueType) !== "greyhound") {
      return NextResponse.json(
        { error: "This endpoint is only available for Greyhound leagues." },
        { status: 400 },
      );
    }

    if (!access.isCommissioner) {
      return NextResponse.json(
        { error: "Only the league commissioner can edit race times." },
        { status: 403 },
      );
    }

    const userSupabase = await createSupabaseServerClient();
    const { data: authData, error: authError } =
      await userSupabase.auth.getUser();

    if (authError || !authData.user) {
      return NextResponse.json(
        { error: "You must be signed in to edit race times." },
        { status: 401 },
      );
    }

    const adminSupabase = createSupabaseAdminClient();

    const { data: card, error: cardError } = await adminSupabase
      .from("greyhound_cards")
      .select(
        `
        id,
        card_status,
        import_status,
        commissioner_confirmed_at,
        automation_enabled
      `,
      )
      .eq("id", numericCardId)
      .maybeSingle();

    if (cardError) {
      console.error("Greyhound race-time card lookup failed:", cardError);
      return NextResponse.json({ error: cardError.message }, { status: 500 });
    }

    if (!card) {
      return NextResponse.json(
        { error: "Greyhound race card was not found." },
        { status: 404 },
      );
    }

    if (["locked", "in_progress", "final", "cancelled"].includes(card.card_status)) {
      return NextResponse.json(
        {
          error: `Race times cannot be edited while card status is ${card.card_status}.`,
        },
        { status: 409 },
      );
    }

    if (!["imported", "updated"].includes(card.import_status)) {
      return NextResponse.json(
        {
          error: `Race times cannot be edited while import status is ${card.import_status}.`,
        },
        { status: 409 },
      );
    }

    const { data: cardRaces, error: raceError } = await adminSupabase
      .from("greyhound_races")
      .select("race_number")
      .eq("card_id", numericCardId);

    if (raceError) {
      console.error("Greyhound race-time race lookup failed:", raceError);
      return NextResponse.json({ error: raceError.message }, { status: 500 });
    }

    const expectedRaceNumbers = new Set(
      (cardRaces ?? []).map((race) => Number(race.race_number)),
    );

    if (expectedRaceNumbers.size === 0) {
      return NextResponse.json(
        { error: "This Greyhound card does not have any races." },
        { status: 409 },
      );
    }

    for (const raceTime of raceTimes) {
      if (!expectedRaceNumbers.has(raceTime.raceNumber)) {
        return NextResponse.json(
          {
            error: `Race ${raceTime.raceNumber} does not belong to this Greyhound card.`,
          },
          { status: 400 },
        );
      }
    }

    const { data: result, error: saveError } = await adminSupabase.rpc(
      "set_greyhound_card_race_times",
      {
        p_card_id: numericCardId,
        p_race_times: raceTimes,
        p_updated_by: authData.user.id,
      },
    );

    if (saveError) {
      console.error("Greyhound race-time RPC failed:", saveError);
      return NextResponse.json({ error: saveError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      cardId: numericCardId,
      result,
    });
  } catch (error) {
    console.error("Greyhound race-time save failed:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Greyhound race-time save failed.",
      },
      { status: 500 },
    );
  }
}
