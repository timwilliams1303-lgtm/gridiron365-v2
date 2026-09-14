import { NextRequest, NextResponse } from "next/server";

import { requireLeagueMember } from "@/lib/leagues/requireLeagueMember";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function jsonError(error: string, status: number) {
  return NextResponse.json(
    { success: false, error },
    {
      status,
      headers: { "Cache-Control": "no-store, max-age=0" },
    },
  );
}

function lower(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function isOpenRaceStatus(value: unknown) {
  return ["scheduled", "upcoming"].includes(lower(value));
}

async function participantForUser(
  leagueId: string,
  userId: string,
) {
  const admin = createSupabaseAdminClient();

  const { data: fantasyTeam, error: fantasyTeamError } = await admin
    .from("fantasy_teams")
    .select("id")
    .eq("league_id", leagueId)
    .eq("owner_id", userId)
    .eq("active", true)
    .maybeSingle();

  if (fantasyTeamError) throw fantasyTeamError;
  if (!fantasyTeam?.id) return null;

  const { data: participant, error: participantError } = await admin
    .from("greyhound_participants")
    .select("id,fantasy_team_id,entry_name")
    .eq("league_id", leagueId)
    .eq("fantasy_team_id", Number(fantasyTeam.id))
    .maybeSingle();

  if (participantError) throw participantError;

  return participant
    ? {
        id: Number(participant.id),
        fantasyTeamId: Number(participant.fantasy_team_id),
        entryName: participant.entry_name
          ? String(participant.entry_name)
          : null,
      }
    : null;
}

async function ensureActiveGame(args: {
  leagueId: string;
  cardId: number;
}) {
  const admin = createSupabaseAdminClient();

  const { data: card, error: cardError } = await admin
    .from("greyhound_cards")
    .select("id,track_id,race_date")
    .eq("id", args.cardId)
    .maybeSingle();

  if (cardError) throw cardError;
  if (!card) return null;

  const { data: activeGame, error: activeGameError } = await admin
    .from("greyhound_daily_survivor_games")
    .select(
      "id,game_number,race_date,track_id,card_id,status,starting_race_id,current_race_id,winner_participant_id",
    )
    .eq("league_id", args.leagueId)
    .eq("race_date", card.race_date)
    .eq("track_id", Number(card.track_id))
    .eq("status", "active")
    .maybeSingle();

  if (activeGameError) throw activeGameError;
  if (activeGame) return activeGame;

  const { data: latestGames, error: latestGameError } = await admin
    .from("greyhound_daily_survivor_games")
    .select("id,status,game_number,winner_participant_id")
    .eq("league_id", args.leagueId)
    .eq("race_date", card.race_date)
    .eq("track_id", Number(card.track_id))
    .order("game_number", { ascending: false })
    .limit(1);

  if (latestGameError) throw latestGameError;

  const latest = latestGames?.[0] ?? null;

  if (latest?.status === "won") {
    return {
      id: Number(latest.id),
      game_number: Number(latest.game_number),
      race_date: card.race_date,
      track_id: Number(card.track_id),
      card_id: args.cardId,
      status: "won",
      starting_race_id: null,
      current_race_id: null,
      winner_participant_id:
        latest.winner_participant_id == null
          ? null
          : Number(latest.winner_participant_id),
    };
  }

  const { data: races, error: racesError } = await admin
    .from("greyhound_races")
    .select("id,race_number,race_status")
    .eq("card_id", args.cardId)
    .order("race_number", { ascending: true });

  if (racesError) throw racesError;

  const firstOpenRace = (races ?? []).find((race) =>
    isOpenRaceStatus(race.race_status),
  );

  if (!firstOpenRace) return null;

  const { data: gameId, error: startError } = await admin.rpc(
    "start_greyhound_daily_survivor_game",
    {
      p_league_id: args.leagueId,
      p_card_id: args.cardId,
      p_starting_race_id: Number(firstOpenRace.id),
    },
  );

  if (startError) throw startError;

  const { data: startedGame, error: startedGameError } = await admin
    .from("greyhound_daily_survivor_games")
    .select(
      "id,game_number,race_date,track_id,card_id,status,starting_race_id,current_race_id,winner_participant_id",
    )
    .eq("id", Number(gameId))
    .single();

  if (startedGameError) throw startedGameError;

  return startedGame;
}

export async function GET(request: NextRequest) {
  try {
    const leagueId =
      request.nextUrl.searchParams.get("leagueId")?.trim() ?? "";
    const cardId = Number(
      request.nextUrl.searchParams.get("cardId") ?? 0,
    );

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

    const { data: settings, error: settingsError } = await admin
      .from("greyhound_league_settings")
      .select("game_format,survivor_mode")
      .eq("league_id", leagueId)
      .maybeSingle();

    if (settingsError) throw settingsError;

    if (
      settings?.game_format !== "survivor" ||
      settings?.survivor_mode !== "daily"
    ) {
      return NextResponse.json(
        {
          success: true,
          enabled: false,
        },
        {
          headers: { "Cache-Control": "no-store, max-age=0" },
        },
      );
    }

    const participant = await participantForUser(
      leagueId,
      access.userId,
    );

    if (!participant) {
      return NextResponse.json(
        {
          success: true,
          enabled: true,
          participant: null,
          game: null,
          message:
            "Your Greyhound participant entry has not been created yet.",
        },
        {
          headers: { "Cache-Control": "no-store, max-age=0" },
        },
      );
    }

    if (!Number.isInteger(cardId) || cardId <= 0) {
      return NextResponse.json(
        {
          success: true,
          enabled: true,
          participant,
          game: null,
          message: "Choose an active Greyhound race card.",
        },
        {
          headers: { "Cache-Control": "no-store, max-age=0" },
        },
      );
    }

    const game = await ensureActiveGame({
      leagueId,
      cardId,
    });

    if (!game) {
      return NextResponse.json(
        {
          success: true,
          enabled: true,
          participant,
          game: null,
          message:
            "No open Daily Survivor race is available on this card.",
        },
        {
          headers: { "Cache-Control": "no-store, max-age=0" },
        },
      );
    }

    if (game.status === "won") {
      const { data: winnerIdentity } = await admin
        .from("greyhound_participant_identity")
        .select(
          "participant_id,entry_name,member_name",
        )
        .eq("league_id", leagueId)
        .eq(
          "participant_id",
          Number(game.winner_participant_id),
        )
        .maybeSingle();

      const winnerName =
        String(winnerIdentity?.entry_name ?? "").trim() ||
        String(winnerIdentity?.member_name ?? "").trim() ||
        `Entry ${game.winner_participant_id}`;

      return NextResponse.json(
        {
          success: true,
          enabled: true,
          participant,
          game: {
            id: Number(game.id),
            gameNumber: Number(game.game_number),
            status: "won",
            winnerParticipantId:
              game.winner_participant_id == null
                ? null
                : Number(game.winner_participant_id),
            winnerName,
          },
        },
        {
          headers: { "Cache-Control": "no-store, max-age=0" },
        },
      );
    }

    const currentRaceId = Number(game.current_race_id);

    const [
      raceResult,
      gameEntryResult,
      entriesResult,
      picksResult,
      aliveCountResult,
    ] = await Promise.all([
      admin
        .from("greyhound_races")
        .select(
          "id,card_id,race_number,grade,distance_yards,scheduled_post_time,actual_post_time,race_status",
        )
        .eq("id", currentRaceId)
        .maybeSingle(),
      admin
        .from("greyhound_daily_survivor_game_entries")
        .select("status,eliminated_race_id")
        .eq("game_id", Number(game.id))
        .eq("participant_id", participant.id)
        .maybeSingle(),
      admin
        .from("greyhound_entries")
        .select(
          "id,race_id,dog_id,box_number,morning_line_odds,entry_status",
        )
        .eq("race_id", currentRaceId)
        .order("box_number", { ascending: true }),
      admin
        .from("greyhound_daily_survivor_picks")
        .select(
          "id,entry_id,dog_id,box_number,alternate_entry_id,alternate_dog_id,alternate_box_number,effective_entry_id,effective_box_number,pick_status,finish_position,result_status,submitted_at",
        )
        .eq("game_id", Number(game.id))
        .eq("participant_id", participant.id)
        .eq("race_id", currentRaceId)
        .maybeSingle(),
      admin
        .from("greyhound_daily_survivor_game_entries")
        .select("participant_id", { count: "exact" })
        .eq("game_id", Number(game.id))
        .eq("status", "alive"),
    ]);

    if (raceResult.error) throw raceResult.error;
    if (gameEntryResult.error) throw gameEntryResult.error;
    if (entriesResult.error) throw entriesResult.error;
    if (picksResult.error) throw picksResult.error;
    if (aliveCountResult.error) throw aliveCountResult.error;

    const dogIds = Array.from(
      new Set(
        (entriesResult.data ?? [])
          .map((entry) =>
            entry.dog_id == null ? null : Number(entry.dog_id),
          )
          .filter((id): id is number => id != null),
      ),
    );

    const dogNames = new Map<number, string>();

    if (dogIds.length > 0) {
      const { data: dogs, error: dogsError } = await admin
        .from("greyhound_dogs")
        .select("id,display_name")
        .in("id", dogIds);

      if (dogsError) throw dogsError;

      for (const dog of dogs ?? []) {
        dogNames.set(
          Number(dog.id),
          String(dog.display_name ?? `Dog ${dog.id}`),
        );
      }
    }

    const race = raceResult.data;
    const raceOpen =
      race != null && isOpenRaceStatus(race.race_status);

    return NextResponse.json(
      {
        success: true,
        enabled: true,
        participant,
        game: {
          id: Number(game.id),
          gameNumber: Number(game.game_number),
          status: String(game.status),
          aliveCount: aliveCountResult.count ?? 0,
          myStatus: String(
            gameEntryResult.data?.status ?? "eliminated",
          ),
          race: race
            ? {
                id: Number(race.id),
                raceNumber: Number(race.race_number),
                grade: race.grade,
                distanceYards: race.distance_yards,
                scheduledPostTime: race.scheduled_post_time,
                actualPostTime: race.actual_post_time,
                raceStatus: String(race.race_status),
                open: raceOpen,
              }
            : null,
          entries: (entriesResult.data ?? []).map((entry) => ({
            id: Number(entry.id),
            dogId:
              entry.dog_id == null
                ? null
                : Number(entry.dog_id),
            dogName:
              entry.dog_id == null
                ? null
                : dogNames.get(Number(entry.dog_id)) ?? null,
            boxNumber: Number(entry.box_number),
            morningLineOdds: entry.morning_line_odds,
            entryStatus: String(entry.entry_status),
          })),
          myPick: picksResult.data
            ? {
                id: Number(picksResult.data.id),
                entryId: Number(picksResult.data.entry_id),
                dogId:
                  picksResult.data.dog_id == null
                    ? null
                    : Number(picksResult.data.dog_id),
                boxNumber: Number(picksResult.data.box_number),
                alternateEntryId:
                  picksResult.data.alternate_entry_id == null
                    ? null
                    : Number(picksResult.data.alternate_entry_id),
                alternateDogId:
                  picksResult.data.alternate_dog_id == null
                    ? null
                    : Number(picksResult.data.alternate_dog_id),
                alternateBoxNumber:
                  picksResult.data.alternate_box_number == null
                    ? null
                    : Number(picksResult.data.alternate_box_number),
                effectiveEntryId:
                  picksResult.data.effective_entry_id == null
                    ? null
                    : Number(picksResult.data.effective_entry_id),
                effectiveBoxNumber:
                  picksResult.data.effective_box_number == null
                    ? null
                    : Number(picksResult.data.effective_box_number),
                pickStatus: String(picksResult.data.pick_status),
                finishPosition:
                  picksResult.data.finish_position == null
                    ? null
                    : Number(picksResult.data.finish_position),
                resultStatus:
                  picksResult.data.result_status == null
                    ? null
                    : String(picksResult.data.result_status),
                submittedAt: String(
                  picksResult.data.submitted_at,
                ),
              }
            : null,
        },
      },
      {
        headers: { "Cache-Control": "no-store, max-age=0" },
      },
    );
  } catch (error) {
    console.error("[greyhound/daily-survivor] GET failed", error);

    return jsonError(
      error instanceof Error
        ? error.message
        : "Unable to load Daily Survivor.",
      500,
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      leagueId?: string;
      gameId?: number;
      raceId?: number;
      entryId?: number;
      alternateEntryId?: number | null;
    };

    const leagueId = String(body.leagueId ?? "").trim();
    const gameId = Number(body.gameId);
    const raceId = Number(body.raceId);
    const entryId = Number(body.entryId);
    const alternateEntryId =
      body.alternateEntryId == null || body.alternateEntryId === 0
        ? null
        : Number(body.alternateEntryId);

    if (!leagueId) {
      return jsonError("leagueId is required.", 400);
    }

    if (
      !Number.isInteger(gameId) ||
      !Number.isInteger(raceId) ||
      !Number.isInteger(entryId) ||
      gameId <= 0 ||
      raceId <= 0 ||
      entryId <= 0 ||
      (alternateEntryId != null &&
        (!Number.isInteger(alternateEntryId) || alternateEntryId <= 0))
    ) {
      return jsonError("Valid game, race, and dog selection are required.", 400);
    }

    if (alternateEntryId != null && alternateEntryId === entryId) {
      return jsonError(
        "Your scratch alternate must be a different dog.",
        400,
      );
    }

    const access = await requireLeagueMember(leagueId);

    if (String(access.league.leagueType) !== "greyhound") {
      return jsonError(
        "This endpoint is only available for Greyhound leagues.",
        400,
      );
    }

    const admin = createSupabaseAdminClient();

    const { data: settings, error: settingsError } = await admin
      .from("greyhound_league_settings")
      .select("game_format,survivor_mode")
      .eq("league_id", leagueId)
      .maybeSingle();

    if (settingsError) throw settingsError;

    if (
      settings?.game_format !== "survivor" ||
      settings?.survivor_mode !== "daily"
    ) {
      return jsonError(
        "This league is not configured for Daily Race Survivor.",
        409,
      );
    }

    const participant = await participantForUser(
      leagueId,
      access.userId,
    );

    if (!participant) {
      return jsonError(
        "Your Greyhound participant entry was not found.",
        404,
      );
    }

    const { data: game, error: gameError } = await admin
      .from("greyhound_daily_survivor_games")
      .select("id,status,current_race_id")
      .eq("league_id", leagueId)
      .eq("id", gameId)
      .maybeSingle();

    if (gameError) throw gameError;
    if (!game || game.status !== "active") {
      return jsonError("This Daily Survivor game is no longer active.", 409);
    }

    if (Number(game.current_race_id) !== raceId) {
      return jsonError(
        "This is not the current Daily Survivor race.",
        409,
      );
    }

    const { data: gameEntry, error: gameEntryError } = await admin
      .from("greyhound_daily_survivor_game_entries")
      .select("status")
      .eq("game_id", gameId)
      .eq("participant_id", participant.id)
      .maybeSingle();

    if (gameEntryError) throw gameEntryError;

    if (gameEntry?.status !== "alive") {
      return jsonError(
        "You are not alive in the current Daily Survivor game.",
        409,
      );
    }

    const [
      { data: race, error: raceError },
      { data: entry, error: entryError },
      { data: alternateEntry, error: alternateEntryError },
    ] = await Promise.all([
      admin
        .from("greyhound_races")
        .select("id,race_status,actual_post_time")
        .eq("id", raceId)
        .maybeSingle(),
      admin
        .from("greyhound_entries")
        .select("id,race_id,dog_id,box_number,entry_status")
        .eq("id", entryId)
        .maybeSingle(),
      alternateEntryId == null
        ? Promise.resolve({ data: null, error: null })
        : admin
            .from("greyhound_entries")
            .select("id,race_id,dog_id,box_number,entry_status")
            .eq("id", alternateEntryId)
            .maybeSingle(),
    ]);

    if (raceError) throw raceError;
    if (entryError) throw entryError;
    if (alternateEntryError) throw alternateEntryError;

    if (!race || !isOpenRaceStatus(race.race_status)) {
      return jsonError(
        "Daily Survivor selections are closed for this race.",
        409,
      );
    }

    if (race.actual_post_time) {
      return jsonError(
        "This race has already gone off.",
        409,
      );
    }

    if (!entry || Number(entry.race_id) !== raceId) {
      return jsonError(
        "The selected dog does not belong to this race.",
        400,
      );
    }

    if (lower(entry.entry_status) !== "active") {
      return jsonError(
        "That dog is not active in this race.",
        409,
      );
    }

    if (alternateEntryId != null) {
      if (!alternateEntry || Number(alternateEntry.race_id) !== raceId) {
        return jsonError(
          "The scratch alternate does not belong to this race.",
          400,
        );
      }

      if (lower(alternateEntry.entry_status) !== "active") {
        return jsonError(
          "Your scratch alternate must be an active dog.",
          409,
        );
      }
    }

    const now = new Date().toISOString();

    const { data: pick, error: pickError } = await admin
      .from("greyhound_daily_survivor_picks")
      .upsert(
        {
          league_id: leagueId,
          game_id: gameId,
          participant_id: participant.id,
          race_id: raceId,
          entry_id: entryId,
          dog_id:
            entry.dog_id == null
              ? null
              : Number(entry.dog_id),
          box_number: Number(entry.box_number),
          alternate_entry_id:
            alternateEntry == null ? null : Number(alternateEntry.id),
          alternate_dog_id:
            alternateEntry?.dog_id == null
              ? null
              : Number(alternateEntry.dog_id),
          alternate_box_number:
            alternateEntry == null
              ? null
              : Number(alternateEntry.box_number),
          effective_entry_id: null,
          effective_box_number: null,
          pick_status: "pending",
          finish_position: null,
          result_status: null,
          submitted_at: now,
          graded_at: null,
          updated_at: now,
        },
        {
          onConflict: "game_id,participant_id,race_id",
        },
      )
      .select(
        "id,entry_id,dog_id,box_number,alternate_entry_id,alternate_dog_id,alternate_box_number,pick_status,submitted_at",
      )
      .single();

    if (pickError) throw pickError;

    return NextResponse.json(
      {
        success: true,
        pick: {
          id: Number(pick.id),
          entryId: Number(pick.entry_id),
          dogId:
            pick.dog_id == null ? null : Number(pick.dog_id),
          boxNumber: Number(pick.box_number),
          alternateEntryId:
            pick.alternate_entry_id == null
              ? null
              : Number(pick.alternate_entry_id),
          alternateDogId:
            pick.alternate_dog_id == null
              ? null
              : Number(pick.alternate_dog_id),
          alternateBoxNumber:
            pick.alternate_box_number == null
              ? null
              : Number(pick.alternate_box_number),
          pickStatus: String(pick.pick_status),
          submittedAt: String(pick.submitted_at),
        },
      },
      {
        headers: { "Cache-Control": "no-store, max-age=0" },
      },
    );
  } catch (error) {
    console.error("[greyhound/daily-survivor] POST failed", error);

    return jsonError(
      error instanceof Error
        ? error.message
        : "Unable to save Daily Survivor selection.",
      500,
    );
  }
}
