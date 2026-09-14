import { NextRequest, NextResponse } from "next/server";

import { requireLeagueMember } from "@/lib/leagues/requireLeagueMember";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function jsonError(message: string, status: number) {
  return NextResponse.json(
    { success: false, error: message },
    {
      status,
      headers: { "Cache-Control": "no-store, max-age=0" },
    },
  );
}

export async function GET(request: NextRequest) {
  try {
    const leagueId =
      request.nextUrl.searchParams.get("leagueId")?.trim() ?? "";

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
        { success: true, enabled: false },
        {
          headers: { "Cache-Control": "no-store, max-age=0" },
        },
      );
    }

    const { data: games, error: gamesError } = await admin
      .from("greyhound_daily_survivor_games")
      .select(
        "id,game_number,race_date,track_id,card_id,status,starting_race_id,current_race_id,winner_participant_id,started_at,completed_at",
      )
      .eq("league_id", leagueId)
      .order("race_date", { ascending: false })
      .order("game_number", { ascending: false });

    if (gamesError) throw gamesError;

    const gameIds = (games ?? []).map((game) => Number(game.id));
    const participantIds = new Set<number>();

    const { data: entryRows, error: entryRowsError } =
      gameIds.length === 0
        ? { data: [], error: null }
        : await admin
            .from("greyhound_daily_survivor_game_entries")
            .select(
              "game_id,participant_id,status,eliminated_race_id,eliminated_at,won_at",
            )
            .in("game_id", gameIds);

    if (entryRowsError) throw entryRowsError;

    for (const row of entryRows ?? []) {
      participantIds.add(Number(row.participant_id));
    }

    for (const game of games ?? []) {
      if (game.winner_participant_id != null) {
        participantIds.add(Number(game.winner_participant_id));
      }
    }

    const { data: identityRows, error: identityError } =
      participantIds.size === 0
        ? { data: [], error: null }
        : await admin
            .from("greyhound_participant_identity")
            .select(
              "participant_id,entry_name,member_name",
            )
            .eq("league_id", leagueId)
            .in("participant_id", Array.from(participantIds));

    if (identityError) throw identityError;

    const identityByParticipant = new Map<
      number,
      {
        name: string;
      }
    >();

    for (const row of identityRows ?? []) {
      const participantId = Number(row.participant_id);
      const name =
        String(row.entry_name ?? "").trim() ||
        String(row.member_name ?? "").trim() ||
        `Entry ${participantId}`;

      identityByParticipant.set(participantId, {
        name: String(name),
      });
    }

    const trackIds = Array.from(
      new Set(
        (games ?? []).map((game) => Number(game.track_id)),
      ),
    );

    const { data: tracks, error: tracksError } =
      trackIds.length === 0
        ? { data: [], error: null }
        : await admin
            .from("greyhound_tracks")
            .select("id,code")
            .in("id", trackIds);

    if (tracksError) throw tracksError;

    const trackById = new Map<number, string>();
    for (const track of tracks ?? []) {
      const code = String(track.code ?? "");
      trackById.set(
        Number(track.id),
        code === "GWD"
          ? "Wheeling"
          : code === "GTS"
            ? "Tri-State"
            : code || `Track ${track.id}`,
      );
    }

    const raceIds = Array.from(
      new Set(
        (games ?? [])
          .flatMap((game) => [
            game.starting_race_id == null
              ? null
              : Number(game.starting_race_id),
            game.current_race_id == null
              ? null
              : Number(game.current_race_id),
          ])
          .filter((id): id is number => id != null),
      ),
    );

    const { data: races, error: racesError } =
      raceIds.length === 0
        ? { data: [], error: null }
        : await admin
            .from("greyhound_races")
            .select("id,race_number")
            .in("id", raceIds);

    if (racesError) throw racesError;

    const raceNumberById = new Map<number, number>();
    for (const race of races ?? []) {
      raceNumberById.set(Number(race.id), Number(race.race_number));
    }

    const entriesByGame = new Map<
      number,
      Array<{
        participantId: number;
        name: string;
        status: string;
        eliminatedRaceId: number | null;
        eliminatedRaceNumber: number | null;
        eliminatedAt: string | null;
        wonAt: string | null;
      }>
    >();

    for (const row of entryRows ?? []) {
      const gameId = Number(row.game_id);
      const participantId = Number(row.participant_id);

      const item = {
        participantId,
        name:
          identityByParticipant.get(participantId)?.name ??
          `Entry ${participantId}`,
        status: String(row.status),
        eliminatedRaceId:
          row.eliminated_race_id == null
            ? null
            : Number(row.eliminated_race_id),
        eliminatedRaceNumber:
          row.eliminated_race_id == null
            ? null
            : raceNumberById.get(Number(row.eliminated_race_id)) ?? null,
        eliminatedAt:
          row.eliminated_at == null
            ? null
            : String(row.eliminated_at),
        wonAt: row.won_at == null ? null : String(row.won_at),
      };

      const current = entriesByGame.get(gameId) ?? [];
      current.push(item);
      entriesByGame.set(gameId, current);
    }

    const payloadGames = (games ?? []).map((game) => {
      const id = Number(game.id);
      const entries = (entriesByGame.get(id) ?? []).sort((a, b) => {
        const order = (status: string) =>
          status === "winner" ? 0 : status === "alive" ? 1 : 2;

        return (
          order(a.status) - order(b.status) ||
          a.name.localeCompare(b.name)
        );
      });

      const alive = entries.filter((entry) => entry.status === "alive");
      const eliminated = entries.filter(
        (entry) => entry.status === "eliminated",
      );
      const winner = entries.find(
        (entry) => entry.status === "winner",
      );

      return {
        id,
        gameNumber: Number(game.game_number),
        raceDate: String(game.race_date),
        trackId: Number(game.track_id),
        trackName:
          trackById.get(Number(game.track_id)) ??
          `Track ${game.track_id}`,
        status: String(game.status),
        startingRaceNumber:
          game.starting_race_id == null
            ? null
            : raceNumberById.get(Number(game.starting_race_id)) ?? null,
        currentRaceNumber:
          game.current_race_id == null
            ? null
            : raceNumberById.get(Number(game.current_race_id)) ?? null,
        winnerParticipantId:
          game.winner_participant_id == null
            ? null
            : Number(game.winner_participant_id),
        winnerName:
          winner?.name ??
          (game.winner_participant_id == null
            ? null
            : identityByParticipant.get(
                Number(game.winner_participant_id),
              )?.name ?? null),
        aliveCount: alive.length,
        eliminatedCount: eliminated.length,
        startedAt: String(game.started_at),
        completedAt:
          game.completed_at == null
            ? null
            : String(game.completed_at),
        entries,
      };
    });

    const activeGames = payloadGames.filter(
      (game) => game.status === "active",
    );
    const completedGames = payloadGames.filter(
      (game) => game.status === "won",
    );

    return NextResponse.json(
      {
        success: true,
        enabled: true,
        league: {
          id: leagueId,
          name: access.league.name,
        },
        summary: {
          activeGames: activeGames.length,
          completedGames: completedGames.length,
          totalGames: payloadGames.length,
          currentAlive:
            activeGames.reduce(
              (sum, game) => sum + game.aliveCount,
              0,
            ),
        },
        activeGames,
        completedGames,
      },
      {
        headers: { "Cache-Control": "no-store, max-age=0" },
      },
    );
  } catch (error) {
    console.error(
      "[greyhound/daily-survivor/league-view] GET failed",
      error,
    );

    return jsonError(
      error instanceof Error
        ? error.message
        : "Unable to load Daily Survivor standings.",
      500,
    );
  }
}
