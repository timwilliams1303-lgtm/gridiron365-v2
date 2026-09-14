import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type SettingsRow = {
  league_id: string;
  game_format: string | null;
  survivor_mode: string | null;
  duration_mode: string | null;
  competition_start_date: string | null;
  competition_end_date: string | null;
  competition_days: number[] | null;
  starting_bankroll: number | string | null;
};

type IdentityRow = Record<string, unknown>;

type FantasyTeamRow = {
  id: number;
  team_name: string | null;
  active: boolean;
};

type CardRow = {
  id: number;
  race_date: string;
};

type RaceRow = {
  id: number;
  card_id: number;
  race_status: string | null;
};

type WagerRow = {
  wager_id: number;
  fantasy_team_id: number;
  racing_card_id: number;
  race_id: number;
  race_number: number;
  wager_type: string;
  total_cost: number | string;
  wager_status: string | null;
  grading_status: string | null;
  official_return: number | string;
};

type RosterEntry = {
  key: number;
  name: string;
  fantasyTeamIds: number[];
  memberCount: number;
};

type LifecycleRoundRow = {
  id: number;
  round_number: number;
  status: string;
  finalized_at: string | null;
};

type LifecycleParticipantRow = {
  round_id: number;
  participant_id: number;
  status: string;
  round_rank: number | null;
  total_wagered: number | string | null;
  total_returned: number | string | null;
  net: number | string | null;
};

type H2HMatchupRow = {
  id: number;
  status: string;
};

type H2HRecordRow = {
  competition_team_id: number;
  wins: number;
  losses: number;
  ties: number;
  total_returned: number | string | null;
  total_wagered: number | string | null;
  net: number | string | null;
};


type DailySurvivorGameRow = {
  id: number;
  game_number: number;
  race_date: string;
  track_id: number;
  card_id: number;
  status: string;
  starting_race_id: number | null;
  current_race_id: number | null;
  winner_participant_id: number | null;
  started_at: string | null;
  completed_at: string | null;
};

type DailySurvivorEntryRow = {
  id: number;
  game_id: number;
  participant_id: number;
  status: string;
  eliminated_race_id: number | null;
  eliminated_at: string | null;
  won_at: string | null;
};

type DailySurvivorPickRow = {
  id: number;
  game_id: number;
  participant_id: number;
  race_id: number;
  entry_id: number;
  dog_id: number | null;
  box_number: number | null;
  pick_status: string | null;
  finish_position: number | null;
  result_status: string | null;
  alternate_entry_id: number | null;
  alternate_dog_id: number | null;
  alternate_box_number: number | null;
  effective_entry_id: number | null;
  effective_box_number: number | null;
  submitted_at: string | null;
  graded_at: string | null;
};

type DailyRaceRow = {
  id: number;
  race_number: number;
  race_status: string | null;
};

type TrackRow = {
  id: number;
  code: string;
  name: string | null;
};

type ExistingDailyHistoryRow = {
  id: number;
  competition_number: number;
  cards_snapshot: unknown;
};

export type GreyhoundArchiveResult = {
  leagueId: string;
  archived: boolean;
  competitionNumber: number | null;
  reason: string;
};

const SUPPORTED_AUTOMATIC_FORMATS = new Set([
  "bankroll",
  "team_total_winnings",
  "team_head_to_head",
  "survivor",
  "tournament",
]);

function numberValue(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function nullableNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function firstText(...values: unknown[]) {
  for (const value of values) {
    const result = text(value);
    if (result) return result;
  }

  return "";
}

function participantName(
  row: IdentityRow,
  fantasyTeamName: string | null | undefined,
  fantasyTeamId: number,
) {
  const fullName = [text(row.first_name), text(row.last_name)]
    .filter(Boolean)
    .join(" ");

  return (
    firstText(
      row.entry_name,
      row.display_name,
      row.member_display_name,
      row.owner_display_name,
      fullName,
      fantasyTeamName,
    ) || `Entry ${fantasyTeamId}`
  );
}

function sharedTeamName(row: IdentityRow, competitionTeamId: number) {
  return (
    firstText(
      row.competition_team_name,
      row.team_name,
      row.greyhound_team_name,
    ) || `Team ${competitionTeamId}`
  );
}

function sharedTeamKey(competitionTeamId: number) {
  return -1_000_000_000 - competitionTeamId;
}

function lower(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function isoTodayUtc() {
  return new Date().toISOString().slice(0, 10);
}

function isFinalRaceStatus(value: unknown) {
  return ["final", "official", "cancelled", "no_contest"].includes(
    lower(value),
  );
}

function isFinalWagerStatus(value: unknown) {
  return ["winner", "loser", "refunded", "void", "no_action"].includes(
    lower(value),
  );
}

function weekdayUtc(isoDate: string) {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function dateInCompetition(
  raceDate: string,
  startDate: string,
  endDate: string,
  competitionDays: number[],
) {
  return (
    raceDate >= startDate &&
    raceDate <= endDate &&
    competitionDays.includes(weekdayUtc(raceDate))
  );
}


function dailySnapshotGameId(snapshot: unknown) {
  if (!Array.isArray(snapshot)) return null;

  for (const item of snapshot) {
    if (!item || typeof item !== "object") continue;

    const row = item as Record<string, unknown>;
    const value = nullableNumber(row.dailySurvivorGameId);

    if (value !== null) return value;
  }

  return null;
}

function dailyParticipantIdentity(
  participantId: number,
  identityRows: IdentityRow[],
  fantasyTeamById: Map<number, FantasyTeamRow>,
) {
  const identity =
    identityRows.find(
      (row) => nullableNumber(row.participant_id) === participantId,
    ) ?? null;

  const fantasyTeamId = identity
    ? nullableNumber(identity.fantasy_team_id)
    : null;

  const fantasyTeam =
    fantasyTeamId === null
      ? null
      : fantasyTeamById.get(fantasyTeamId) ?? null;

  return {
    participantId,
    fantasyTeamId,
    key: fantasyTeamId ?? participantId,
    name: identity
      ? participantName(
          identity,
          fantasyTeam?.team_name,
          fantasyTeamId ?? participantId,
        )
      : fantasyTeam?.team_name?.trim() || `Entry ${participantId}`,
  };
}

async function archiveDailySurvivorGames(
  settings: SettingsRow,
): Promise<GreyhoundArchiveResult[]> {
  const admin = createSupabaseAdminClient();
  const leagueId = settings.league_id;

  const { data: gamesRaw, error: gamesError } = await admin
    .from("greyhound_daily_survivor_games")
    .select(
      [
        "id",
        "game_number",
        "race_date",
        "track_id",
        "card_id",
        "status",
        "starting_race_id",
        "current_race_id",
        "winner_participant_id",
        "started_at",
        "completed_at",
      ].join(", "),
    )
    .eq("league_id", leagueId)
    .not("completed_at", "is", null)
    .not("winner_participant_id", "is", null)
    .order("race_date", { ascending: true })
    .order("game_number", { ascending: true });

  if (gamesError) {
    throw new Error(
      `Unable to load completed Daily Survivor games: ${gamesError.message}`,
    );
  }

  const games =
    (gamesRaw ?? []) as unknown as DailySurvivorGameRow[];

  if (games.length === 0) {
    return [
      {
        leagueId,
        archived: false,
        competitionNumber: null,
        reason:
          "No completed Daily Survivor games are ready for Trophy Case archive.",
      },
    ];
  }

  const [
    identityResult,
    fantasyTeamsResult,
    historyResult,
  ] = await Promise.all([
    admin
      .from("greyhound_participant_identity")
      .select("*")
      .eq("league_id", leagueId),
    admin
      .from("fantasy_teams")
      .select("id, team_name, active")
      .eq("league_id", leagueId),
    admin
      .from("greyhound_competition_history")
      .select("id, competition_number, cards_snapshot")
      .eq("league_id", leagueId)
      .eq("game_format", "daily_survivor"),
  ]);

  if (identityResult.error) {
    throw new Error(
      `Unable to load Daily Survivor participant identities: ${identityResult.error.message}`,
    );
  }

  if (fantasyTeamsResult.error) {
    throw new Error(
      `Unable to load Daily Survivor fantasy teams: ${fantasyTeamsResult.error.message}`,
    );
  }

  if (historyResult.error) {
    throw new Error(
      `Unable to verify Daily Survivor Trophy history: ${historyResult.error.message}`,
    );
  }

  const identityRows =
    (identityResult.data ?? []) as unknown as IdentityRow[];

  const fantasyTeams =
    (fantasyTeamsResult.data ?? []) as unknown as FantasyTeamRow[];

  const fantasyTeamById = new Map(
    fantasyTeams.map((team) => [Number(team.id), team] as const),
  );

  const existingHistory =
    (historyResult.data ?? []) as unknown as ExistingDailyHistoryRow[];

  const archivedGameIds = new Set(
    existingHistory
      .map((row) => dailySnapshotGameId(row.cards_snapshot))
      .filter((value): value is number => value !== null),
  );

  const results: GreyhoundArchiveResult[] = [];

  for (const game of games) {
    const gameId = Number(game.id);

    if (archivedGameIds.has(gameId)) continue;

    const winnerParticipantId =
      game.winner_participant_id === null
        ? null
        : Number(game.winner_participant_id);

    if (
      winnerParticipantId === null ||
      !Number.isFinite(winnerParticipantId)
    ) {
      continue;
    }

    const [
      entriesResult,
      picksResult,
      trackResult,
    ] = await Promise.all([
      admin
        .from("greyhound_daily_survivor_game_entries")
        .select(
          [
            "id",
            "game_id",
            "participant_id",
            "status",
            "eliminated_race_id",
            "eliminated_at",
            "won_at",
          ].join(", "),
        )
        .eq("league_id", leagueId)
        .eq("game_id", gameId),
      admin
        .from("greyhound_daily_survivor_picks")
        .select(
          [
            "id",
            "game_id",
            "participant_id",
            "race_id",
            "entry_id",
            "dog_id",
            "box_number",
            "pick_status",
            "finish_position",
            "result_status",
            "alternate_entry_id",
            "alternate_dog_id",
            "alternate_box_number",
            "effective_entry_id",
            "effective_box_number",
            "submitted_at",
            "graded_at",
          ].join(", "),
        )
        .eq("league_id", leagueId)
        .eq("game_id", gameId),
      admin
        .from("greyhound_tracks")
        .select("id, code, name")
        .eq("id", Number(game.track_id))
        .maybeSingle(),
    ]);

    if (entriesResult.error) {
      throw new Error(
        `Unable to load Daily Survivor game entries for game ${gameId}: ${entriesResult.error.message}`,
      );
    }

    if (picksResult.error) {
      throw new Error(
        `Unable to load Daily Survivor picks for game ${gameId}: ${picksResult.error.message}`,
      );
    }

    if (trackResult.error) {
      throw new Error(
        `Unable to load Daily Survivor track for game ${gameId}: ${trackResult.error.message}`,
      );
    }

    const entries =
      (entriesResult.data ?? []) as unknown as DailySurvivorEntryRow[];

    const picks =
      (picksResult.data ?? []) as unknown as DailySurvivorPickRow[];

    const track = (trackResult.data ?? null) as TrackRow | null;

    const raceIds = Array.from(
      new Set(
        [
          game.starting_race_id,
          game.current_race_id,
          ...entries.map((entry) => entry.eliminated_race_id),
          ...picks.map((pick) => pick.race_id),
        ]
          .map((value) => nullableNumber(value))
          .filter((value): value is number => value !== null),
      ),
    );

    let races: DailyRaceRow[] = [];

    if (raceIds.length > 0) {
      const { data: racesRaw, error: racesError } = await admin
        .from("greyhound_races")
        .select("id, race_number, race_status")
        .in("id", raceIds);

      if (racesError) {
        throw new Error(
          `Unable to load Daily Survivor race details for game ${gameId}: ${racesError.message}`,
        );
      }

      races = (racesRaw ?? []) as unknown as DailyRaceRow[];
    }

    const raceById = new Map(
      races.map((race) => [Number(race.id), race] as const),
    );

    const winner = dailyParticipantIdentity(
      winnerParticipantId,
      identityRows,
      fantasyTeamById,
    );

    const eliminatedCandidates = entries
      .filter(
        (entry) =>
          Number(entry.participant_id) !== winnerParticipantId &&
          Boolean(entry.eliminated_at),
      )
      .sort((a, b) =>
        String(b.eliminated_at ?? "").localeCompare(
          String(a.eliminated_at ?? ""),
        ),
      );

    let runnerUp:
      | ReturnType<typeof dailyParticipantIdentity>
      | null = null;

    if (eliminatedCandidates.length > 0) {
      const latestElimination =
        eliminatedCandidates[0]?.eliminated_at ?? null;

      const latestGroup = eliminatedCandidates.filter(
        (entry) => entry.eliminated_at === latestElimination,
      );

      /*
       * If multiple entries were eliminated together in the final race,
       * there is no arbitrary single runner-up. Preserve that as a tie by
       * leaving runner-up blank.
       */
      if (latestGroup.length === 1) {
        runnerUp = dailyParticipantIdentity(
          Number(latestGroup[0].participant_id),
          identityRows,
          fantasyTeamById,
        );
      }
    }

    const finalRaceId =
      nullableNumber(game.current_race_id) ??
      picks
        .map((pick) => Number(pick.race_id))
        .filter(Number.isFinite)
        .sort(
          (a, b) =>
            Number(raceById.get(b)?.race_number ?? 0) -
            Number(raceById.get(a)?.race_number ?? 0),
        )[0] ??
      null;

    const finalRaceNumber =
      finalRaceId === null
        ? null
        : nullableNumber(raceById.get(finalRaceId)?.race_number);

    const startingRaceNumber =
      game.starting_race_id === null
        ? null
        : nullableNumber(
            raceById.get(Number(game.starting_race_id))?.race_number,
          );

    const trackName =
      track?.name?.trim() ||
      track?.code?.trim() ||
      `Track ${Number(game.track_id)}`;

    const standingsSnapshot = entries
      .map((entry) => {
        const identity = dailyParticipantIdentity(
          Number(entry.participant_id),
          identityRows,
          fantasyTeamById,
        );

        const participantPicks = picks
          .filter(
            (pick) =>
              Number(pick.participant_id) ===
              Number(entry.participant_id),
          )
          .sort(
            (a, b) =>
              Number(raceById.get(Number(a.race_id))?.race_number ?? 0) -
              Number(raceById.get(Number(b.race_id))?.race_number ?? 0),
          )
          .map((pick) => ({
            pickId: Number(pick.id),
            raceId: Number(pick.race_id),
            raceNumber:
              nullableNumber(
                raceById.get(Number(pick.race_id))?.race_number,
              ),
            entryId: Number(pick.entry_id),
            dogId:
              pick.dog_id === null ? null : Number(pick.dog_id),
            boxNumber:
              pick.box_number === null
                ? null
                : Number(pick.box_number),
            effectiveEntryId:
              pick.effective_entry_id === null
                ? null
                : Number(pick.effective_entry_id),
            effectiveBoxNumber:
              pick.effective_box_number === null
                ? null
                : Number(pick.effective_box_number),
            finishPosition:
              pick.finish_position === null
                ? null
                : Number(pick.finish_position),
            pickStatus: pick.pick_status,
            resultStatus: pick.result_status,
            submittedAt: pick.submitted_at,
            gradedAt: pick.graded_at,
          }));

        const eliminatedRaceId =
          entry.eliminated_race_id === null
            ? null
            : Number(entry.eliminated_race_id);

        return {
          participantId: Number(entry.participant_id),
          fantasyTeamId: identity.fantasyTeamId,
          key: identity.key,
          name: identity.name,
          status: entry.status,
          eliminatedRaceId,
          eliminatedRaceNumber:
            eliminatedRaceId === null
              ? null
              : nullableNumber(
                  raceById.get(eliminatedRaceId)?.race_number,
                ),
          eliminatedAt: entry.eliminated_at,
          wonAt: entry.won_at,
          picks: participantPicks,
        };
      })
      .sort((a, b) => {
        if (a.participantId === winnerParticipantId) return -1;
        if (b.participantId === winnerParticipantId) return 1;

        return String(b.eliminatedAt ?? "").localeCompare(
          String(a.eliminatedAt ?? ""),
        );
      });

    const { data: latestHistoryRaw, error: latestHistoryError } =
      await admin
        .from("greyhound_competition_history")
        .select("competition_number")
        .eq("league_id", leagueId)
        .order("competition_number", { ascending: false })
        .limit(1);

    if (latestHistoryError) {
      throw new Error(
        `Unable to determine Daily Survivor Trophy number: ${latestHistoryError.message}`,
      );
    }

    const latestHistory =
      (latestHistoryRaw ?? []) as unknown as Array<{
        competition_number: number;
      }>;

    const competitionNumber =
      Number(latestHistory[0]?.competition_number ?? 0) + 1;

    const cardsSnapshot = [
      {
        archiveType: "daily_survivor_game",
        dailySurvivorGameId: gameId,
        gameNumber: Number(game.game_number),
        cardId: Number(game.card_id),
        raceDate: game.race_date,
        trackId: Number(game.track_id),
        trackCode: track?.code ?? null,
        trackName,
        startingRaceId:
          game.starting_race_id === null
            ? null
            : Number(game.starting_race_id),
        startingRaceNumber,
        finalRaceId,
        finalRaceNumber,
        startedAt: game.started_at,
        completedAt: game.completed_at,
      },
    ];

    const awardsSnapshot = {
      archiveType: "daily_survivor_game",
      dailySurvivor: {
        gameId,
        gameNumber: Number(game.game_number),
        raceDate: game.race_date,
        trackId: Number(game.track_id),
        trackCode: track?.code ?? null,
        trackName,
        finalRaceId,
        finalRaceNumber,
      },
      winner: {
        participantId: winner.participantId,
        fantasyTeamId: winner.fantasyTeamId,
        key: winner.key,
        name: winner.name,
      },
      runnerUp: runnerUp
        ? {
            participantId: runnerUp.participantId,
            fantasyTeamId: runnerUp.fantasyTeamId,
            key: runnerUp.key,
            name: runnerUp.name,
          }
        : null,
    };

    const { data: insertedRaw, error: insertError } = await admin
      .from("greyhound_competition_history")
      .insert({
        league_id: leagueId,
        competition_number: competitionNumber,
        /*
         * Daily Survivor games are individual Trophy/history events.
         * They are intentionally stored separately from round Survivor so
         * the Trophy Case never presents one daily season as a single title.
         */
        game_format: "daily_survivor",
        competition_start_date: game.race_date,
        competition_end_date: game.race_date,
        completed_at:
          game.completed_at ?? new Date().toISOString(),
        champion_key: winner.key,
        champion_name: winner.name,
        runner_up_key: runnerUp?.key ?? null,
        runner_up_name: runnerUp?.name ?? null,
        total_entries: entries.length,
        total_tickets: picks.length,
        total_wagered: 0,
        total_returned: 0,
        champion_net: 0,
        champion_returned: 0,
        standings_snapshot: standingsSnapshot,
        awards_snapshot: awardsSnapshot,
        cards_snapshot: cardsSnapshot,
      })
      .select("id, competition_number")
      .single();

    if (insertError) {
      throw new Error(
        `Unable to archive Daily Survivor game ${gameId}: ${insertError.message}`,
      );
    }

    const inserted = insertedRaw as unknown as {
      id: number;
      competition_number: number;
    };

    const finalRaceText =
      finalRaceNumber === null
        ? "Final surviving race unavailable"
        : `Survived through Race ${finalRaceNumber}`;

    const awardRows = [
      {
        league_id: leagueId,
        competition_history_id: inserted.id,
        award_key: "daily_survivor_winner",
        award_title: "Daily Survivor Winner",
        recipient_key: winner.key,
        recipient_name: winner.name,
        award_value: finalRaceNumber,
        award_detail: `${trackName} · ${game.race_date} · ${finalRaceText}`,
      },
      runnerUp
        ? {
            league_id: leagueId,
            competition_history_id: inserted.id,
            award_key: "daily_survivor_runner_up",
            award_title: "Daily Survivor Runner-Up",
            recipient_key: runnerUp.key,
            recipient_name: runnerUp.name,
            award_value: finalRaceNumber,
            award_detail: `${trackName} · ${game.race_date}`,
          }
        : null,
    ].filter((row): row is NonNullable<typeof row> => row !== null);

    const { error: awardsError } = await admin
      .from("greyhound_trophy_awards")
      .insert(awardRows);

    if (awardsError) {
      throw new Error(
        `Daily Survivor history saved for game ${gameId}, but Trophy awards failed: ${awardsError.message}`,
      );
    }

    archivedGameIds.add(gameId);

    results.push({
      leagueId,
      archived: true,
      competitionNumber: inserted.competition_number,
      reason: `Daily Survivor Game ${Number(
        game.game_number,
      )} archived: ${winner.name} won at ${trackName} on ${
        game.race_date
      }.`,
    });
  }

  if (results.length === 0) {
    return [
      {
        leagueId,
        archived: false,
        competitionNumber: null,
        reason:
          "No unarchived completed Daily Survivor games are ready for Trophy Case archive.",
      },
    ];
  }

  return results;
}

async function archiveOneLeague(
  settings: SettingsRow,
): Promise<GreyhoundArchiveResult> {
  const admin = createSupabaseAdminClient();
  const leagueId = settings.league_id;
  const gameFormat = String(settings.game_format ?? "");

  if (!SUPPORTED_AUTOMATIC_FORMATS.has(gameFormat)) {
    return {
      leagueId,
      archived: false,
      competitionNumber: null,
      reason:
        "Automatic archive waits for dedicated lifecycle semantics for this format.",
    };
  }

  if (
    gameFormat === "survivor" &&
    String(settings.survivor_mode ?? "round") !== "round"
  ) {
    return {
      leagueId,
      archived: false,
      competitionNumber: null,
      reason:
        "Daily Race Survivor uses game-by-game winners and is not archived as one round competition.",
    };
  }

  const roundLifecycleFormat =
    gameFormat === "survivor" || gameFormat === "tournament";

  const h2hFormat = gameFormat === "team_head_to_head";

  const startDate = settings.competition_start_date;
  const endDate = settings.competition_end_date;

  if (!startDate || !endDate) {
    return {
      leagueId,
      archived: false,
      competitionNumber: null,
      reason: "Competition start/end dates are not fully configured.",
    };
  }

  if (endDate > isoTodayUtc()) {
    return {
      leagueId,
      archived: false,
      competitionNumber: null,
      reason: "Competition has not reached its end date.",
    };
  }

  const competitionDays =
    Array.isArray(settings.competition_days) &&
    settings.competition_days.length > 0
      ? settings.competition_days.map(Number)
      : [0, 1, 2, 3, 4, 5, 6];

  let lifecycleChampionParticipantId: number | null = null;
  let lifecycleRunnerUpParticipantId: number | null = null;

  let h2hChampionCompetitionTeamId: number | null = null;
  let h2hRunnerUpCompetitionTeamId: number | null = null;
  let h2hRecords: H2HRecordRow[] = [];

  if (h2hFormat) {
    const [matchupsResult, recordsResult] = await Promise.all([
      admin
        .from("greyhound_h2h_matchups")
        .select("id,status")
        .eq("league_id", leagueId),
      admin
        .from("greyhound_h2h_team_records")
        .select(
          "competition_team_id,wins,losses,ties,total_returned,total_wagered,net",
        )
        .eq("league_id", leagueId),
    ]);

    if (matchupsResult.error) {
      throw new Error(
        `Unable to verify Greyhound Head-to-Head matchups: ${matchupsResult.error.message}`,
      );
    }

    if (recordsResult.error) {
      throw new Error(
        `Unable to verify Greyhound Head-to-Head records: ${recordsResult.error.message}`,
      );
    }

    const h2hMatchups =
      (matchupsResult.data ?? []) as unknown as H2HMatchupRow[];

    if (h2hMatchups.length === 0) {
      return {
        leagueId,
        archived: false,
        competitionNumber: null,
        reason:
          "Head-to-Head competition does not have a matchup schedule to archive.",
      };
    }

    const openMatchups = h2hMatchups.filter(
      (matchup) => lower(matchup.status) !== "final",
    );

    if (openMatchups.length > 0) {
      return {
        leagueId,
        archived: false,
        competitionNumber: null,
        reason: `${openMatchups.length} Head-to-Head matchup(s) are not final yet.`,
      };
    }

    h2hRecords =
      (recordsResult.data ?? []) as unknown as H2HRecordRow[];

    if (h2hRecords.length < 2) {
      return {
        leagueId,
        archived: false,
        competitionNumber: null,
        reason:
          "Head-to-Head standings do not yet contain at least two team records.",
      };
    }

    h2hRecords.sort((a, b) => {
      const winsA = Number(a.wins ?? 0);
      const winsB = Number(b.wins ?? 0);
      const lossesA = Number(a.losses ?? 0);
      const lossesB = Number(b.losses ?? 0);
      const tiesA = Number(a.ties ?? 0);
      const tiesB = Number(b.ties ?? 0);

      return (
        winsB - winsA ||
        lossesA - lossesB ||
        tiesB - tiesA ||
        numberValue(b.total_returned) - numberValue(a.total_returned)
      );
    });

    const sameH2HRecord = (
      a: H2HRecordRow | undefined,
      b: H2HRecordRow | undefined,
    ) =>
      Boolean(
        a &&
          b &&
          Number(a.wins ?? 0) === Number(b.wins ?? 0) &&
          Number(a.losses ?? 0) === Number(b.losses ?? 0) &&
          Number(a.ties ?? 0) === Number(b.ties ?? 0) &&
          numberValue(a.total_returned) === numberValue(b.total_returned),
      );

    if (sameH2HRecord(h2hRecords[0], h2hRecords[1])) {
      return {
        leagueId,
        archived: false,
        competitionNumber: null,
        reason:
          "Head-to-Head championship is tied after wins, losses, ties, and total returned. Commissioner resolution is required before Trophy Case archive.",
      };
    }

    if (
      h2hRecords.length > 2 &&
      sameH2HRecord(h2hRecords[1], h2hRecords[2])
    ) {
      return {
        leagueId,
        archived: false,
        competitionNumber: null,
        reason:
          "Head-to-Head runner-up is tied after wins, losses, ties, and total returned. Commissioner resolution is required before Trophy Case archive.",
      };
    }

    h2hChampionCompetitionTeamId = Number(
      h2hRecords[0].competition_team_id,
    );
    h2hRunnerUpCompetitionTeamId = Number(
      h2hRecords[1].competition_team_id,
    );
  }

  if (roundLifecycleFormat) {
    const { data: lifecycleRoundsRaw, error: lifecycleRoundsError } =
      await admin
        .from("greyhound_competition_rounds")
        .select("id,round_number,status,finalized_at")
        .eq("league_id", leagueId)
        .order("round_number", { ascending: true });

    if (lifecycleRoundsError) {
      throw new Error(
        `Unable to verify Greyhound round lifecycle: ${lifecycleRoundsError.message}`,
      );
    }

    const lifecycleRounds =
      (lifecycleRoundsRaw ?? []) as unknown as LifecycleRoundRow[];

    if (lifecycleRounds.length === 0) {
      return {
        leagueId,
        archived: false,
        competitionNumber: null,
        reason: "No configured competition rounds are available to archive.",
      };
    }

    const unfinishedRounds = lifecycleRounds.filter(
      (round) => lower(round.status) !== "final",
    );

    if (unfinishedRounds.length > 0) {
      return {
        leagueId,
        archived: false,
        competitionNumber: null,
        reason: `${unfinishedRounds.length} competition round(s) are not final yet.`,
      };
    }

    const finalRound = lifecycleRounds[lifecycleRounds.length - 1];

    const { data: finalParticipantsRaw, error: finalParticipantsError } =
      await admin
        .from("greyhound_round_participants")
        .select(
          "round_id,participant_id,status,round_rank,total_wagered,total_returned,net",
        )
        .eq("league_id", leagueId)
        .eq("round_id", Number(finalRound.id))
        .order("round_rank", { ascending: true });

    if (finalParticipantsError) {
      throw new Error(
        `Unable to verify Greyhound final-round participants: ${finalParticipantsError.message}`,
      );
    }

    const finalParticipants =
      (finalParticipantsRaw ?? []) as unknown as LifecycleParticipantRow[];

    const championRow = finalParticipants.find(
      (row) => lower(row.status) === "champion",
    );

    if (!championRow) {
      return {
        leagueId,
        archived: false,
        competitionNumber: null,
        reason:
          "The final round is complete but a lifecycle champion has not been recorded yet.",
      };
    }

    lifecycleChampionParticipantId = Number(championRow.participant_id);

    const runnerUpRow = finalParticipants
      .filter(
        (row) =>
          Number(row.participant_id) !== lifecycleChampionParticipantId,
      )
      .sort((a, b) => {
        const rankA = Number(a.round_rank ?? Number.MAX_SAFE_INTEGER);
        const rankB = Number(b.round_rank ?? Number.MAX_SAFE_INTEGER);
        return (
          rankA - rankB ||
          numberValue(b.total_returned) - numberValue(a.total_returned) ||
          numberValue(b.net) - numberValue(a.net)
        );
      })[0];

    lifecycleRunnerUpParticipantId = runnerUpRow
      ? Number(runnerUpRow.participant_id)
      : null;
  }

  const { data: existingRaw, error: existingError } = await admin
    .from("greyhound_competition_history")
    .select("id, competition_number")
    .eq("league_id", leagueId)
    .eq("game_format", gameFormat)
    .eq("competition_start_date", startDate)
    .eq("competition_end_date", endDate)
    .maybeSingle();

  if (existingError) {
    throw new Error(
      `Greyhound archive duplicate check failed: ${existingError.message}`,
    );
  }

  const existing = existingRaw as unknown as
    | { id: number; competition_number: number }
    | null;

  if (existing) {
    return {
      leagueId,
      archived: false,
      competitionNumber: Number(existing.competition_number),
      reason: "Competition is already archived.",
    };
  }

  const { data: cardsRaw, error: cardsError } = await admin
    .from("greyhound_cards")
    .select("id, race_date")
    .gte("race_date", startDate)
    .lte("race_date", endDate);

  if (cardsError) {
    throw new Error(
      `Unable to load Greyhound cards for archive: ${cardsError.message}`,
    );
  }

  const cards = ((cardsRaw ?? []) as unknown as CardRow[]).filter((card) =>
    dateInCompetition(
      String(card.race_date),
      startDate,
      endDate,
      competitionDays,
    ),
  );

  const cardIds = cards.map((card) => Number(card.id));

  if (cardIds.length === 0) {
    return {
      leagueId,
      archived: false,
      competitionNumber: null,
      reason: "No eligible Greyhound cards exist in this competition window.",
    };
  }

  const { data: racesRaw, error: racesError } = await admin
    .from("greyhound_races")
    .select("id, card_id, race_status")
    .in("card_id", cardIds);

  if (racesError) {
    throw new Error(
      `Unable to verify Greyhound race completion: ${racesError.message}`,
    );
  }

  const races = (racesRaw ?? []) as unknown as RaceRow[];
  const openRaces = races.filter(
    (race) => !isFinalRaceStatus(race.race_status),
  );

  if (openRaces.length > 0) {
    return {
      leagueId,
      archived: false,
      competitionNumber: null,
      reason: `${openRaces.length} competition race(s) are still open.`,
    };
  }

  const [
    identityResult,
    fantasyTeamsResult,
    wagersResult,
    latestHistoryResult,
  ] = await Promise.all([
    admin
      .from("greyhound_participant_identity")
      .select("*")
      .eq("league_id", leagueId),
    admin
      .from("fantasy_teams")
      .select("id, team_name, active")
      .eq("league_id", leagueId),
    admin
      .from("greyhound_league_wager_display")
      .select(
        [
          "wager_id",
          "fantasy_team_id",
          "racing_card_id",
          "race_id",
          "race_number",
          "wager_type",
          "total_cost",
          "wager_status",
          "grading_status",
          "official_return",
        ].join(", "),
      )
      .eq("league_id", leagueId)
      .in("racing_card_id", cardIds),
    admin
      .from("greyhound_competition_history")
      .select("competition_number")
      .eq("league_id", leagueId)
      .order("competition_number", { ascending: false })
      .limit(1),
  ]);

  if (identityResult.error) throw identityResult.error;
  if (fantasyTeamsResult.error) throw fantasyTeamsResult.error;
  if (wagersResult.error) throw wagersResult.error;
  if (latestHistoryResult.error) throw latestHistoryResult.error;

  const identityRows =
    (identityResult.data ?? []) as unknown as IdentityRow[];
  const fantasyTeams =
    (fantasyTeamsResult.data ?? []) as unknown as FantasyTeamRow[];
  const wagers = (wagersResult.data ?? []) as unknown as WagerRow[];

  const pendingWagers = wagers.filter(
    (wager) => !isFinalWagerStatus(wager.wager_status),
  );

  if (pendingWagers.length > 0) {
    return {
      leagueId,
      archived: false,
      competitionNumber: null,
      reason: `${pendingWagers.length} wager(s) are still awaiting settlement.`,
    };
  }

  const sharedTeamFormat =
    gameFormat === "team_total_winnings" ||
    gameFormat === "team_head_to_head";

  const fantasyTeamById = new Map(
    fantasyTeams.map((team) => [Number(team.id), team] as const),
  );

  const rosterByKey = new Map<number, RosterEntry>();
  const keyByFantasyTeamId = new Map<number, number>();

  for (const row of identityRows) {
    const fantasyTeamId = nullableNumber(row.fantasy_team_id);
    if (fantasyTeamId === null) continue;

    const fantasyTeam = fantasyTeamById.get(fantasyTeamId);
    if (fantasyTeam?.active === false) continue;

    const competitionTeamId = nullableNumber(row.competition_team_id);

    if (sharedTeamFormat && competitionTeamId !== null) {
      const key = sharedTeamKey(competitionTeamId);
      const existingRoster = rosterByKey.get(key);

      if (existingRoster) {
        if (!existingRoster.fantasyTeamIds.includes(fantasyTeamId)) {
          existingRoster.fantasyTeamIds.push(fantasyTeamId);
          existingRoster.memberCount += 1;
        }
      } else {
        rosterByKey.set(key, {
          key,
          name: sharedTeamName(row, competitionTeamId),
          fantasyTeamIds: [fantasyTeamId],
          memberCount: 1,
        });
      }

      keyByFantasyTeamId.set(fantasyTeamId, key);
      continue;
    }

    rosterByKey.set(fantasyTeamId, {
      key: fantasyTeamId,
      name: participantName(
        row,
        fantasyTeam?.team_name,
        fantasyTeamId,
      ),
      fantasyTeamIds: [fantasyTeamId],
      memberCount: 1,
    });

    keyByFantasyTeamId.set(fantasyTeamId, fantasyTeamId);
  }

  for (const team of fantasyTeams) {
    const fantasyTeamId = Number(team.id);

    if (!Number.isFinite(fantasyTeamId) || !team.active) continue;
    if (keyByFantasyTeamId.has(fantasyTeamId)) continue;

    rosterByKey.set(fantasyTeamId, {
      key: fantasyTeamId,
      name: team.team_name?.trim() || `Entry ${fantasyTeamId}`,
      fantasyTeamIds: [fantasyTeamId],
      memberCount: 1,
    });

    keyByFantasyTeamId.set(fantasyTeamId, fantasyTeamId);
  }

  type Standing = {
    key: number;
    name: string;
    memberCount: number;
    tickets: number;
    staked: number;
    returned: number;
    net: number;
    wins: number;
    losses: number;
    refunds: number;
    biggestReturn: number;
    biggestReturnWagerType: string | null;
    biggestReturnRace: number | null;
  };

  const standingsByKey = new Map<number, Standing>();

  for (const roster of rosterByKey.values()) {
    standingsByKey.set(roster.key, {
      key: roster.key,
      name: roster.name,
      memberCount: roster.memberCount,
      tickets: 0,
      staked: 0,
      returned: 0,
      net: 0,
      wins: 0,
      losses: 0,
      refunds: 0,
      biggestReturn: 0,
      biggestReturnWagerType: null,
      biggestReturnRace: null,
    });
  }

  let biggestTicket:
    | {
        key: number;
        name: string;
        returnAmount: number;
        profit: number;
        wagerType: string;
        raceNumber: number;
      }
    | null = null;

  for (const wager of wagers) {
    const fantasyTeamId = Number(wager.fantasy_team_id);
    const key =
      keyByFantasyTeamId.get(fantasyTeamId) ?? fantasyTeamId;

    let standing = standingsByKey.get(key);

    if (!standing) {
      standing = {
        key,
        name:
          fantasyTeamById.get(fantasyTeamId)?.team_name?.trim() ||
          `Entry ${fantasyTeamId}`,
        memberCount: 1,
        tickets: 0,
        staked: 0,
        returned: 0,
        net: 0,
        wins: 0,
        losses: 0,
        refunds: 0,
        biggestReturn: 0,
        biggestReturnWagerType: null,
        biggestReturnRace: null,
      };
      standingsByKey.set(key, standing);
    }

    const cost = numberValue(wager.total_cost);
    const returned = numberValue(wager.official_return);
    const net = returned - cost;
    const wagerStatus = lower(wager.wager_status);

    standing.tickets += 1;
    standing.staked += cost;
    standing.returned += returned;
    standing.net += net;

    if (wagerStatus === "winner") standing.wins += 1;
    else if (wagerStatus === "loser") standing.losses += 1;
    else if (
      wagerStatus === "refunded" ||
      wagerStatus === "void" ||
      wagerStatus === "no_action"
    ) {
      standing.refunds += 1;
    }

    if (returned > standing.biggestReturn) {
      standing.biggestReturn = returned;
      standing.biggestReturnWagerType = wager.wager_type;
      standing.biggestReturnRace = Number(wager.race_number);
    }

    if (
      wagerStatus === "winner" &&
      (!biggestTicket || returned > biggestTicket.returnAmount)
    ) {
      biggestTicket = {
        key,
        name: standing.name,
        returnAmount: returned,
        profit: net,
        wagerType: wager.wager_type,
        raceNumber: Number(wager.race_number),
      };
    }
  }

  const startingBankroll = numberValue(settings.starting_bankroll || 100);

  const h2hRecordByKey = new Map<
    number,
    {
      wins: number;
      losses: number;
      ties: number;
      totalReturned: number;
      totalWagered: number;
      net: number;
    }
  >();

  if (h2hFormat) {
    for (const record of h2hRecords) {
      const competitionTeamId = Number(record.competition_team_id);
      h2hRecordByKey.set(sharedTeamKey(competitionTeamId), {
        wins: Number(record.wins ?? 0),
        losses: Number(record.losses ?? 0),
        ties: Number(record.ties ?? 0),
        totalReturned: numberValue(record.total_returned),
        totalWagered: numberValue(record.total_wagered),
        net: numberValue(record.net),
      });
    }
  }

  const standings = Array.from(standingsByKey.values())
    .map((standing) => ({
      ...standing,
      openingBankroll: startingBankroll * standing.memberCount,
      currentBankroll:
        startingBankroll * standing.memberCount + standing.net,
      h2hRecord: h2hRecordByKey.get(standing.key) ?? null,
    }))
    .sort((a, b) => {
      if (gameFormat === "team_head_to_head") {
        const recordA = a.h2hRecord;
        const recordB = b.h2hRecord;

        return (
          Number(recordB?.wins ?? 0) - Number(recordA?.wins ?? 0) ||
          Number(recordA?.losses ?? 0) - Number(recordB?.losses ?? 0) ||
          Number(recordB?.ties ?? 0) - Number(recordA?.ties ?? 0) ||
          Number(recordB?.totalReturned ?? 0) -
            Number(recordA?.totalReturned ?? 0) ||
          a.name.localeCompare(b.name)
        );
      }

      if (gameFormat === "team_total_winnings") {
        return (
          b.returned - a.returned ||
          b.net - a.net ||
          a.name.localeCompare(b.name)
        );
      }

      return (
        b.currentBankroll - a.currentBankroll ||
        b.net - a.net ||
        a.name.localeCompare(b.name)
      );
    })
    .map((standing, index) => ({
      ...standing,
      rank: index + 1,
    }));

  if (standings.length === 0) {
    return {
      leagueId,
      archived: false,
      competitionNumber: null,
      reason: "No active Greyhound participants are available to archive.",
    };
  }

  type StandingRow = (typeof standings)[number];

  let champion: StandingRow = standings[0]!;
  let runnerUp: StandingRow | null = standings[1] ?? null;

  if (
    h2hFormat &&
    h2hChampionCompetitionTeamId !== null &&
    h2hRunnerUpCompetitionTeamId !== null
  ) {
    const h2hChampion = standings.find(
      (row) =>
        row.key === sharedTeamKey(h2hChampionCompetitionTeamId!),
    );
    const h2hRunnerUp = standings.find(
      (row) =>
        row.key === sharedTeamKey(h2hRunnerUpCompetitionTeamId!),
    );

    if (!h2hChampion || !h2hRunnerUp) {
      return {
        leagueId,
        archived: false,
        competitionNumber: null,
        reason:
          "Head-to-Head champion or runner-up could not be matched to the archived team standings.",
      };
    }

    champion = h2hChampion;
    runnerUp = h2hRunnerUp;
  }

  if (
    roundLifecycleFormat &&
    lifecycleChampionParticipantId !== null
  ) {
    const championIdentity = identityRows.find(
      (row) =>
        nullableNumber(row.participant_id) ===
        lifecycleChampionParticipantId,
    );

    const championFantasyTeamId = championIdentity
      ? nullableNumber(championIdentity.fantasy_team_id)
      : null;

    if (championFantasyTeamId === null) {
      return {
        leagueId,
        archived: false,
        competitionNumber: null,
        reason:
          "Lifecycle champion could not be matched to a Greyhound entry.",
      };
    }

    const lifecycleChampionStanding = standings.find(
      (row) => row.key === championFantasyTeamId,
    );

    if (!lifecycleChampionStanding) {
      return {
        leagueId,
        archived: false,
        competitionNumber: null,
        reason:
          "Lifecycle champion is not present in the archived standings.",
      };
    }

    champion = lifecycleChampionStanding;

    if (lifecycleRunnerUpParticipantId !== null) {
      const runnerIdentity = identityRows.find(
        (row) =>
          nullableNumber(row.participant_id) ===
          lifecycleRunnerUpParticipantId,
      );

      const runnerFantasyTeamId = runnerIdentity
        ? nullableNumber(runnerIdentity.fantasy_team_id)
        : null;

      runnerUp =
        runnerFantasyTeamId === null
          ? null
          : standings.find((row) => row.key === runnerFantasyTeamId) ??
            null;
    } else {
      runnerUp = null;
    }
  }

  const bestNet =
    [...standings].sort(
      (a, b) => b.net - a.net || a.name.localeCompare(b.name),
    )[0] ?? null;

  const mostWinners =
    [...standings].sort(
      (a, b) =>
        b.wins - a.wins ||
        b.net - a.net ||
        a.name.localeCompare(b.name),
    )[0] ?? null;

  const mostActive =
    [...standings].sort(
      (a, b) =>
        b.tickets - a.tickets ||
        b.staked - a.staked ||
        a.name.localeCompare(b.name),
    )[0] ?? null;

  const biggestReturn =
    [...standings].sort(
      (a, b) =>
        b.biggestReturn - a.biggestReturn ||
        a.name.localeCompare(b.name),
    )[0] ?? null;

  const latestRows =
    (latestHistoryResult.data ?? []) as unknown as Array<{
      competition_number: number;
    }>;

  const competitionNumber =
    (latestRows[0]?.competition_number ?? 0) + 1;

  const totalTickets = standings.reduce(
    (sum, row) => sum + row.tickets,
    0,
  );
  const totalWagered = standings.reduce(
    (sum, row) => sum + row.staked,
    0,
  );
  const totalReturned = standings.reduce(
    (sum, row) => sum + row.returned,
    0,
  );

  const awardsSnapshot = {
    champion: {
      key: champion.key,
      name: champion.name,
      h2hRecord:
        gameFormat === "team_head_to_head"
          ? champion.h2hRecord
          : null,
    },
    bestNet: bestNet
      ? { key: bestNet.key, name: bestNet.name, value: bestNet.net }
      : null,
    mostWinners: mostWinners
      ? {
          key: mostWinners.key,
          name: mostWinners.name,
          value: mostWinners.wins,
        }
      : null,
    mostActive: mostActive
      ? {
          key: mostActive.key,
          name: mostActive.name,
          value: mostActive.tickets,
        }
      : null,
    biggestReturn: biggestReturn
      ? {
          key: biggestReturn.key,
          name: biggestReturn.name,
          value: biggestReturn.biggestReturn,
        }
      : null,
    biggestTicket,
  };

  const cardSnapshot = cards.map((card) => ({
    cardId: Number(card.id),
    raceDate: card.race_date,
  }));

  const { data: insertedRaw, error: insertError } = await admin
    .from("greyhound_competition_history")
    .insert({
      league_id: leagueId,
      competition_number: competitionNumber,
      game_format: gameFormat,
      competition_start_date: startDate,
      competition_end_date: endDate,
      completed_at: new Date().toISOString(),
      champion_key: champion.key,
      champion_name: champion.name,
      runner_up_key: runnerUp?.key ?? null,
      runner_up_name: runnerUp?.name ?? null,
      total_entries: standings.length,
      total_tickets: totalTickets,
      total_wagered: totalWagered,
      total_returned: totalReturned,
      champion_net: champion.net,
      champion_returned: champion.returned,
      standings_snapshot: standings,
      awards_snapshot: awardsSnapshot,
      cards_snapshot: cardSnapshot,
    })
    .select("id, competition_number")
    .single();

  if (insertError) {
    throw new Error(
      `Unable to archive Greyhound competition: ${insertError.message}`,
    );
  }

  const inserted = insertedRaw as unknown as {
    id: number;
    competition_number: number;
  };

  const awardRows = [
    {
      league_id: leagueId,
      competition_history_id: inserted.id,
      award_key: "champion",
      award_title: "Competition Champion",
      recipient_key: champion.key,
      recipient_name: champion.name,
      award_value:
        gameFormat === "team_head_to_head"
          ? Number(champion.h2hRecord?.wins ?? 0)
          : gameFormat === "team_total_winnings" ||
              roundLifecycleFormat
            ? champion.returned
            : champion.currentBankroll,
      award_detail:
        gameFormat === "team_head_to_head"
          ? `${Number(champion.h2hRecord?.wins ?? 0)}-${Number(
              champion.h2hRecord?.losses ?? 0,
            )}-${Number(
              champion.h2hRecord?.ties ?? 0,
            )} H2H record · ${Number(
              champion.h2hRecord?.totalReturned ?? 0,
            ).toFixed(2)} total returned`
          : gameFormat === "team_total_winnings"
            ? `${champion.returned.toFixed(2)} total returned`
            : roundLifecycleFormat
              ? `${champion.returned.toFixed(2)} total returned · lifecycle champion`
              : `${champion.currentBankroll.toFixed(2)} final bankroll`,
    },
    bestNet
      ? {
          league_id: leagueId,
          competition_history_id: inserted.id,
          award_key: "best_net",
          award_title: "Best Net",
          recipient_key: bestNet.key,
          recipient_name: bestNet.name,
          award_value: bestNet.net,
          award_detail: `${bestNet.net.toFixed(2)} net`,
        }
      : null,
    mostWinners
      ? {
          league_id: leagueId,
          competition_history_id: inserted.id,
          award_key: "most_winners",
          award_title: "Most Winning Tickets",
          recipient_key: mostWinners.key,
          recipient_name: mostWinners.name,
          award_value: mostWinners.wins,
          award_detail: `${mostWinners.wins} winning ticket${
            mostWinners.wins === 1 ? "" : "s"
          }`,
        }
      : null,
    biggestReturn && biggestReturn.biggestReturn > 0
      ? {
          league_id: leagueId,
          competition_history_id: inserted.id,
          award_key: "biggest_return",
          award_title: "Biggest Return",
          recipient_key: biggestReturn.key,
          recipient_name: biggestReturn.name,
          award_value: biggestReturn.biggestReturn,
          award_detail: biggestReturn.biggestReturnWagerType
            ? `${biggestReturn.biggestReturnWagerType} · Race ${
                biggestReturn.biggestReturnRace ?? "—"
              }`
            : null,
        }
      : null,
    biggestTicket
      ? {
          league_id: leagueId,
          competition_history_id: inserted.id,
          award_key: "ticket_of_competition",
          award_title: "Ticket of the Competition",
          recipient_key: biggestTicket.key,
          recipient_name: biggestTicket.name,
          award_value: biggestTicket.returnAmount,
          award_detail: `${biggestTicket.wagerType} · Race ${biggestTicket.raceNumber}`,
        }
      : null,
  ].filter((row): row is NonNullable<typeof row> => row !== null);

  if (awardRows.length > 0) {
    const { error: awardsError } = await admin
      .from("greyhound_trophy_awards")
      .insert(awardRows);

    if (awardsError) {
      throw new Error(
        `Competition history saved but Greyhound trophy awards failed: ${awardsError.message}`,
      );
    }
  }

  return {
    leagueId,
    archived: true,
    competitionNumber: inserted.competition_number,
    reason: "Completed Greyhound competition archived.",
  };
}

export async function archiveCompletedGreyhoundCompetitions(): Promise<
  GreyhoundArchiveResult[]
> {
  const admin = createSupabaseAdminClient();

  const { data: settingsRaw, error: settingsError } = await admin
    .from("greyhound_league_settings")
    .select(
      [
        "league_id",
        "game_format",
        "survivor_mode",
        "duration_mode",
        "competition_start_date",
        "competition_end_date",
        "competition_days",
        "starting_bankroll",
      ].join(", "),
    )
    .not("competition_start_date", "is", null)
    .not("competition_end_date", "is", null);

  if (settingsError) {
    throw new Error(
      `Unable to scan Greyhound competitions for archive: ${settingsError.message}`,
    );
  }

  const settingsRows =
    (settingsRaw ?? []) as unknown as SettingsRow[];

  const results: GreyhoundArchiveResult[] = [];

  for (const settings of settingsRows) {
    try {
      const gameFormat = String(settings.game_format ?? "");
      const survivorMode = String(settings.survivor_mode ?? "round");

      if (gameFormat === "survivor" && survivorMode === "daily") {
        results.push(...(await archiveDailySurvivorGames(settings)));
        continue;
      }

      results.push(await archiveOneLeague(settings));
    } catch (error) {
      results.push({
        leagueId: settings.league_id,
        archived: false,
        competitionNumber: null,
        reason:
          error instanceof Error
            ? error.message
            : "Unknown Greyhound archive error.",
      });
    }
  }

  return results;
}
