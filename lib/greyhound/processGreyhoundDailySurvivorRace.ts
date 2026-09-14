import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type DailySurvivorProcessResult = {
  leagueId: string;
  raceId: number;
  gameId: number | null;
  processed: boolean;
  blocked: boolean;
  reason: string | null;
  aliveBefore: number;
  survived: number;
  eliminated: number;
  allRemainingMissed: boolean;
  winnerParticipantId: number | null;
  nextRaceId: number | null;
};

function lower(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function isOfficialResult(value: unknown) {
  return ["official", "final"].includes(lower(value));
}

async function nextEligibleRaceId(args: {
  cardId: number;
  raceNumber: number;
}) {
  const admin = createSupabaseAdminClient();

  const { data, error } = await admin
    .from("greyhound_races")
    .select("id,race_number,race_status")
    .eq("card_id", args.cardId)
    .gt("race_number", args.raceNumber)
    .order("race_number", { ascending: true });

  if (error) throw error;

  const next = (data ?? []).find(
    (row) =>
      !["cancelled", "no_contest"].includes(
        lower(row.race_status),
      ),
  );

  return next ? Number(next.id) : null;
}

export async function processGreyhoundDailySurvivorRace(
  raceId: number,
): Promise<DailySurvivorProcessResult[]> {
  const admin = createSupabaseAdminClient();

  const { data: race, error: raceError } = await admin
    .from("greyhound_races")
    .select("id,card_id,race_number,race_status")
    .eq("id", raceId)
    .maybeSingle();

  if (raceError) throw raceError;
  if (!race) return [];

  const cardId = Number(race.card_id);
  const raceNumber = Number(race.race_number);

  const { data: card, error: cardError } = await admin
    .from("greyhound_cards")
    .select("id,track_id,race_date")
    .eq("id", cardId)
    .maybeSingle();

  if (cardError) throw cardError;
  if (!card) return [];

  const { data: settingsRows, error: settingsError } = await admin
    .from("greyhound_league_settings")
    .select("league_id,competition_start_date,competition_end_date,competition_days")
    .eq("game_format", "survivor")
    .eq("survivor_mode", "daily");

  if (settingsError) throw settingsError;

  const results: DailySurvivorProcessResult[] = [];
  const raceDate = String(card.race_date);

  for (const settings of settingsRows ?? []) {
    const leagueId = String(settings.league_id);

    if (
      settings.competition_start_date &&
      raceDate < String(settings.competition_start_date)
    ) {
      continue;
    }

    if (
      settings.competition_end_date &&
      raceDate > String(settings.competition_end_date)
    ) {
      continue;
    }

    const competitionDays = Array.isArray(settings.competition_days)
      ? settings.competition_days.map(Number)
      : [0, 1, 2, 3, 4, 5, 6];

    const [y, m, d] = raceDate.split("-").map(Number);
    const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();

    if (!competitionDays.includes(weekday)) {
      continue;
    }

    let { data: activeGame, error: gameError } = await admin
      .from("greyhound_daily_survivor_games")
      .select(
        "id,league_id,game_number,card_id,current_race_id,status",
      )
      .eq("league_id", leagueId)
      .eq("race_date", raceDate)
      .eq("track_id", Number(card.track_id))
      .eq("status", "active")
      .maybeSingle();

    if (gameError) throw gameError;

    if (!activeGame) {
      const { data: priorGames, error: priorGamesError } = await admin
        .from("greyhound_daily_survivor_games")
        .select("id,status")
        .eq("league_id", leagueId)
        .eq("race_date", raceDate)
        .eq("track_id", Number(card.track_id))
        .order("game_number", { ascending: false })
        .limit(1);

      if (priorGamesError) throw priorGamesError;

      /*
       * A Daily Survivor game is started only if this track/date has not
       * already produced a winner. A reset game may be started again.
       */
      const latest = priorGames?.[0] ?? null;

      if (latest && latest.status === "won") {
        continue;
      }

      const { data: gameId, error: startError } = await admin.rpc(
        "start_greyhound_daily_survivor_game",
        {
          p_league_id: leagueId,
          p_card_id: cardId,
          p_starting_race_id: raceId,
        },
      );

      if (startError) throw startError;

      const { data: startedGame, error: startedGameError } = await admin
        .from("greyhound_daily_survivor_games")
        .select(
          "id,league_id,game_number,card_id,current_race_id,status",
        )
        .eq("id", Number(gameId))
        .single();

      if (startedGameError) throw startedGameError;
      activeGame = startedGame;
    }

    if (Number(activeGame.current_race_id) !== raceId) {
      continue;
    }

    const gameId = Number(activeGame.id);

    const { data: aliveRows, error: aliveError } = await admin
      .from("greyhound_daily_survivor_game_entries")
      .select("participant_id")
      .eq("league_id", leagueId)
      .eq("game_id", gameId)
      .eq("status", "alive");

    if (aliveError) throw aliveError;

    const aliveParticipantIds = (aliveRows ?? []).map((row) =>
      Number(row.participant_id),
    );

    if (aliveParticipantIds.length === 0) {
      const nextRaceId = await nextEligibleRaceId({
        cardId,
        raceNumber,
      });

      const now = new Date().toISOString();

      const { error: resetError } = await admin
        .from("greyhound_daily_survivor_games")
        .update({
          status: "reset",
          completed_at: now,
          updated_at: now,
        })
        .eq("id", gameId);

      if (resetError) throw resetError;

      if (nextRaceId) {
        const { error: restartError } = await admin.rpc(
          "start_greyhound_daily_survivor_game",
          {
            p_league_id: leagueId,
            p_card_id: cardId,
            p_starting_race_id: nextRaceId,
          },
        );

        if (restartError) throw restartError;
      }

      results.push({
        leagueId,
        raceId,
        gameId,
        processed: true,
        blocked: false,
        reason: "No alive entries remained, so the game was reset.",
        aliveBefore: 0,
        survived: 0,
        eliminated: 0,
        allRemainingMissed: false,
        winnerParticipantId: null,
        nextRaceId,
      });

      continue;
    }

    const { data: picks, error: picksError } = await admin
      .from("greyhound_daily_survivor_picks")
      .select(
        "id,participant_id,entry_id,box_number,alternate_entry_id,alternate_box_number,pick_status",
      )
      .eq("league_id", leagueId)
      .eq("game_id", gameId)
      .eq("race_id", raceId)
      .in("participant_id", aliveParticipantIds);

    if (picksError) throw picksError;

    if ((picks ?? []).length !== aliveParticipantIds.length) {
      results.push({
        leagueId,
        raceId,
        gameId,
        processed: false,
        blocked: true,
        reason:
          "Waiting for one Daily Survivor dog selection from every alive entry.",
        aliveBefore: aliveParticipantIds.length,
        survived: 0,
        eliminated: 0,
        allRemainingMissed: false,
        winnerParticipantId: null,
        nextRaceId: null,
      });
      continue;
    }

    const pickEntryIds = Array.from(
      new Set(
        (picks ?? [])
          .flatMap((pick) => [
            Number(pick.entry_id),
            pick.alternate_entry_id == null
              ? null
              : Number(pick.alternate_entry_id),
          ])
          .filter((value): value is number => value != null && value > 0),
      ),
    );

    const entryStatusById = new Map<number, string>();

    if (pickEntryIds.length > 0) {
      const { data: pickEntries, error: pickEntriesError } = await admin
        .from("greyhound_entries")
        .select("id,entry_status")
        .in("id", pickEntryIds);

      if (pickEntriesError) throw pickEntriesError;

      for (const row of pickEntries ?? []) {
        entryStatusById.set(
          Number(row.id),
          lower(row.entry_status),
        );
      }
    }

    const { data: officialResults, error: resultError } = await admin
      .from("greyhound_race_results")
      .select(
        "entry_id,box_number,finish_position,result_status",
      )
      .eq("race_id", raceId)
      .eq("result_status", "official");

    if (resultError) throw resultError;

    if ((officialResults ?? []).length < 3) {
      results.push({
        leagueId,
        raceId,
        gameId,
        processed: false,
        blocked: true,
        reason: "Waiting for official top-3 race results.",
        aliveBefore: aliveParticipantIds.length,
        survived: 0,
        eliminated: 0,
        allRemainingMissed: false,
        winnerParticipantId: null,
        nextRaceId: null,
      });
      continue;
    }

    const officialByEntry = new Map<number, number>();
    const officialByBox = new Map<number, number>();

    for (const result of officialResults ?? []) {
      if (!isOfficialResult(result.result_status)) continue;

      const finish = Number(result.finish_position);
      if (!Number.isInteger(finish) || finish < 1) continue;

      if (result.entry_id != null) {
        officialByEntry.set(Number(result.entry_id), finish);
      }
      if (result.box_number != null) {
        officialByBox.set(Number(result.box_number), finish);
      }
    }

    const grading = (picks ?? []).map((pick) => {
      const primaryEntryId = Number(pick.entry_id);
      const primaryBoxNumber = Number(pick.box_number);
      const primaryStatus = entryStatusById.get(primaryEntryId) ?? "active";

      const alternateEntryId =
        pick.alternate_entry_id == null
          ? null
          : Number(pick.alternate_entry_id);
      const alternateBoxNumber =
        pick.alternate_box_number == null
          ? null
          : Number(pick.alternate_box_number);
      const alternateStatus =
        alternateEntryId == null
          ? null
          : entryStatusById.get(alternateEntryId) ?? "active";

      const primaryScratched = primaryStatus === "scratched";
      const useAlternate =
        primaryScratched &&
        alternateEntryId != null &&
        alternateBoxNumber != null &&
        alternateStatus !== "scratched";

      const effectiveEntryId = useAlternate
        ? alternateEntryId
        : primaryEntryId;
      const effectiveBoxNumber = useAlternate
        ? alternateBoxNumber
        : primaryBoxNumber;

      const unresolvedScratch =
        primaryScratched && !useAlternate;

      const finish = unresolvedScratch
        ? null
        : officialByEntry.get(effectiveEntryId) ??
          officialByBox.get(effectiveBoxNumber) ??
          null;

      const survived =
        !unresolvedScratch && finish != null && finish <= 3;

      return {
        pickId: Number(pick.id),
        participantId: Number(pick.participant_id),
        finish,
        survived,
        unresolvedScratch,
        effectiveEntryId,
        effectiveBoxNumber,
      };
    });

    const unresolvedScratchRows = grading.filter(
      (row) => row.unresolvedScratch,
    );

    if (unresolvedScratchRows.length > 0) {
      results.push({
        leagueId,
        raceId,
        gameId,
        processed: false,
        blocked: true,
        reason:
          "A primary Survivor dog was scratched and no valid scratch alternate is available.",
        aliveBefore: grading.length,
        survived: 0,
        eliminated: 0,
        allRemainingMissed: false,
        winnerParticipantId: null,
        nextRaceId: null,
      });
      continue;
    }

    const survivors = grading.filter((row) => row.survived);
    const misses = grading.filter((row) => !row.survived);
    const allRemainingMissed =
      grading.length > 0 && survivors.length === 0;

    const now = new Date().toISOString();

    for (const row of grading) {
      const { error: pickUpdateError } = await admin
        .from("greyhound_daily_survivor_picks")
        .update({
          pick_status: row.survived ? "survived" : "missed",
          effective_entry_id: row.effectiveEntryId,
          effective_box_number: row.effectiveBoxNumber,
          finish_position: row.finish,
          result_status: "official",
          graded_at: now,
          updated_at: now,
        })
        .eq("id", row.pickId);

      if (pickUpdateError) throw pickUpdateError;
    }

    const nextRaceId = await nextEligibleRaceId({
      cardId,
      raceNumber,
    });

    /*
     * Special Daily Survivor rule:
     * if every remaining live entry misses the same race, nobody is
     * eliminated. The same live field carries forward to the next race.
     */
    if (allRemainingMissed) {
      if (nextRaceId) {
        const { error: gameAdvanceError } = await admin
          .from("greyhound_daily_survivor_games")
          .update({
            current_race_id: nextRaceId,
            updated_at: now,
          })
          .eq("id", gameId);

        if (gameAdvanceError) throw gameAdvanceError;
      }

      results.push({
        leagueId,
        raceId,
        gameId,
        processed: true,
        blocked: nextRaceId == null,
        reason:
          nextRaceId == null
            ? "All remaining entries missed, but there is no later race on this card."
            : "All remaining entries missed; nobody was eliminated and the live field advances.",
        aliveBefore: grading.length,
        survived: grading.length,
        eliminated: 0,
        allRemainingMissed: true,
        winnerParticipantId: null,
        nextRaceId,
      });

      continue;
    }

    if (misses.length > 0) {
      const { error: eliminateError } = await admin
        .from("greyhound_daily_survivor_game_entries")
        .update({
          status: "eliminated",
          eliminated_race_id: raceId,
          eliminated_at: now,
          updated_at: now,
        })
        .eq("league_id", leagueId)
        .eq("game_id", gameId)
        .in(
          "participant_id",
          misses.map((row) => row.participantId),
        );

      if (eliminateError) throw eliminateError;
    }

    if (survivors.length === 1) {
      const winnerParticipantId = survivors[0].participantId;

      const { error: winnerEntryError } = await admin
        .from("greyhound_daily_survivor_game_entries")
        .update({
          status: "winner",
          won_at: now,
          updated_at: now,
        })
        .eq("league_id", leagueId)
        .eq("game_id", gameId)
        .eq("participant_id", winnerParticipantId);

      if (winnerEntryError) throw winnerEntryError;

      const { error: winnerGameError } = await admin
        .from("greyhound_daily_survivor_games")
        .update({
          status: "won",
          winner_participant_id: winnerParticipantId,
          completed_at: now,
          updated_at: now,
        })
        .eq("id", gameId);

      if (winnerGameError) throw winnerGameError;

      results.push({
        leagueId,
        raceId,
        gameId,
        processed: true,
        blocked: false,
        reason: "Daily Survivor winner determined.",
        aliveBefore: grading.length,
        survived: 1,
        eliminated: misses.length,
        allRemainingMissed: false,
        winnerParticipantId,
        nextRaceId,
      });

      continue;
    }

    if (nextRaceId) {
      const { error: gameAdvanceError } = await admin
        .from("greyhound_daily_survivor_games")
        .update({
          current_race_id: nextRaceId,
          updated_at: now,
        })
        .eq("id", gameId);

      if (gameAdvanceError) throw gameAdvanceError;
    }

    results.push({
      leagueId,
      raceId,
      gameId,
      processed: true,
      blocked: nextRaceId == null,
      reason:
        nextRaceId == null
          ? "Survivors remain, but there is no later race on this card."
          : "Daily Survivor advanced to the next race.",
      aliveBefore: grading.length,
      survived: survivors.length,
      eliminated: misses.length,
      allRemainingMissed: false,
      winnerParticipantId: null,
      nextRaceId,
    });
  }

  return results;
}
