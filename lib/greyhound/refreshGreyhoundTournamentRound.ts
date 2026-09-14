import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type SettingsRow = {
  game_format: string;
  competition_days: number[] | null;
};

type RoundRow = {
  id: number;
  round_number: number;
  round_name: string | null;
  start_date: string;
  end_date: string;
  status: string;
  started_at: string | null;
  finalized_at: string | null;
  advance_count: number | null;
};

type IdentityRow = {
  participant_id: number;
  fantasy_team_id: number;
  entry_name: string | null;
  member_name: string | null;
};

type RoundParticipantRow = {
  id: number;
  participant_id: number;
  status: string;
};

type CardRow = {
  id: number;
  race_date: string;
};

type RaceRow = {
  card_id: number;
  race_status: string | null;
};

type WagerRow = {
  fantasy_team_id: number;
  racing_card_id: number;
  total_cost: number | string | null;
  official_return: number | string | null;
  wager_status: string | null;
};

export type TournamentRoundScore = {
  participantId: number;
  participantName: string;
  totalWagered: number;
  totalReturned: number;
  net: number;
  rank: number;
};

export type TournamentRoundRefreshResult = {
  success: boolean;
  leagueId: string;
  roundId: number;
  roundNumber: number;
  status:
    | "scheduled"
    | "active"
    | "final"
    | "blocked_cutoff_tie"
    | "blocked_missing_advance_count"
    | "blocked_no_next_round";
  advanceCount: number | null;
  advancedParticipantIds: number[];
  eliminatedParticipantIds: number[];
  championParticipantId: number | null;
  tiedCutoffParticipantIds: number[];
  cutoffAdvanceSlots: number;
  scores: TournamentRoundScore[];
};

function lower(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function num(value: unknown) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function money(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function utcWeekday(isoDate: string) {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

function finalRaceStatus(value: unknown) {
  return ["final", "official", "cancelled", "no_contest"].includes(
    lower(value),
  );
}

function finalWagerStatus(value: unknown) {
  return ["winner", "loser", "refunded", "void", "no_action"].includes(
    lower(value),
  );
}

function participantName(row: IdentityRow | undefined, participantId: number) {
  return (
    row?.entry_name?.trim() ||
    row?.member_name?.trim() ||
    `Entry ${participantId}`
  );
}

async function seedNextRound(args: {
  leagueId: string;
  currentRoundNumber: number;
  participantIds: number[];
  now: string;
}) {
  const admin = createSupabaseAdminClient();

  const { data: nextRound, error: nextRoundError } = await admin
    .from("greyhound_competition_rounds")
    .select("id,round_number")
    .eq("league_id", args.leagueId)
    .gt("round_number", args.currentRoundNumber)
    .order("round_number", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (nextRoundError) throw nextRoundError;
  if (!nextRound?.id) return null;

  const nextRoundId = Number(nextRound.id);

  const { data: existingRows, error: existingError } = await admin
    .from("greyhound_round_participants")
    .select("participant_id")
    .eq("league_id", args.leagueId)
    .eq("round_id", nextRoundId);

  if (existingError) throw existingError;

  const existing = new Set(
    (existingRows ?? []).map((row) => Number(row.participant_id)),
  );

  const missing = args.participantIds.filter((id) => !existing.has(id));

  if (missing.length > 0) {
    const { error: insertError } = await admin
      .from("greyhound_round_participants")
      .insert(
        missing.map((participantId) => ({
          league_id: args.leagueId,
          round_id: nextRoundId,
          participant_id: participantId,
          status: "active",
          total_wagered: 0,
          total_returned: 0,
          net: 0,
          round_rank: null,
          updated_at: args.now,
        })),
      );

    if (insertError) throw insertError;
  }

  return nextRoundId;
}

export async function refreshGreyhoundTournamentRound(
  leagueId: string,
  roundId: number,
  resolvedCutoffAdvancingParticipantIds: number[] = [],
): Promise<TournamentRoundRefreshResult> {
  const admin = createSupabaseAdminClient();

  const [
    settingsResult,
    roundResult,
    identityResult,
    roundParticipantsResult,
  ] = await Promise.all([
    admin
      .from("greyhound_league_settings")
      .select("game_format,competition_days")
      .eq("league_id", leagueId)
      .maybeSingle(),
    admin
      .from("greyhound_competition_rounds")
      .select(
        "id,round_number,round_name,start_date,end_date,status,started_at,finalized_at,advance_count",
      )
      .eq("league_id", leagueId)
      .eq("id", roundId)
      .maybeSingle(),
    admin
      .from("greyhound_participant_identity")
      .select("participant_id,fantasy_team_id,entry_name,member_name")
      .eq("league_id", leagueId),
    admin
      .from("greyhound_round_participants")
      .select("id,participant_id,status")
      .eq("league_id", leagueId)
      .eq("round_id", roundId),
  ]);

  if (settingsResult.error) throw settingsResult.error;
  if (roundResult.error) throw roundResult.error;
  if (identityResult.error) throw identityResult.error;
  if (roundParticipantsResult.error) throw roundParticipantsResult.error;

  const settings = settingsResult.data as unknown as SettingsRow | null;
  const round = roundResult.data as unknown as RoundRow | null;
  const identities = (identityResult.data ?? []) as unknown as IdentityRow[];
  let roundParticipants =
    (roundParticipantsResult.data ?? []) as unknown as RoundParticipantRow[];

  if (settings?.game_format !== "tournament") {
    throw new Error("TOURNAMENT_ONLY");
  }

  if (!round) throw new Error("ROUND_NOT_FOUND");

  if (roundParticipants.length === 0) {
    let participantIds: number[] = [];

    if (Number(round.round_number) === 1) {
      participantIds = identities.map((row) => Number(row.participant_id));
    } else {
      const { data: previousRound, error: previousRoundError } = await admin
        .from("greyhound_competition_rounds")
        .select("id")
        .eq("league_id", leagueId)
        .lt("round_number", round.round_number)
        .order("round_number", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (previousRoundError) throw previousRoundError;

      if (previousRound?.id) {
        const { data: previousParticipants, error: previousParticipantsError } =
          await admin
            .from("greyhound_round_participants")
            .select("participant_id,status")
            .eq("league_id", leagueId)
            .eq("round_id", Number(previousRound.id))
            .in("status", ["advanced", "champion"]);

        if (previousParticipantsError) throw previousParticipantsError;

        participantIds = (previousParticipants ?? []).map((row) =>
          Number(row.participant_id),
        );
      }
    }

    if (participantIds.length > 0) {
      const now = new Date().toISOString();
      const { data: inserted, error: insertError } = await admin
        .from("greyhound_round_participants")
        .insert(
          participantIds.map((participantId) => ({
            league_id: leagueId,
            round_id: roundId,
            participant_id: participantId,
            status: "active",
            total_wagered: 0,
            total_returned: 0,
            net: 0,
            round_rank: null,
            updated_at: now,
          })),
        )
        .select("id,participant_id,status");

      if (insertError) throw insertError;
      roundParticipants =
        (inserted ?? []) as unknown as RoundParticipantRow[];
    }
  }

  const participantIds = roundParticipants.map((row) =>
    Number(row.participant_id),
  );

  if (participantIds.length === 0) {
    throw new Error("NO_TOURNAMENT_PARTICIPANTS");
  }

  const identityByParticipant = new Map(
    identities.map((row) => [Number(row.participant_id), row] as const),
  );

  const competitionDays =
    Array.isArray(settings.competition_days) &&
    settings.competition_days.length > 0
      ? settings.competition_days.map(Number)
      : [0, 1, 2, 3, 4, 5, 6];

  const { data: cardRows, error: cardsError } = await admin
    .from("greyhound_cards")
    .select("id,race_date")
    .gte("race_date", round.start_date)
    .lte("race_date", round.end_date)
    .order("race_date", { ascending: true });

  if (cardsError) throw cardsError;

  const cards = ((cardRows ?? []) as unknown as CardRow[]).filter((card) =>
    competitionDays.includes(utcWeekday(card.race_date)),
  );

  const cardIds = cards.map((card) => Number(card.id));

  let races: RaceRow[] = [];
  let wagers: WagerRow[] = [];

  if (cardIds.length > 0) {
    const [racesResult, wagersResult] = await Promise.all([
      admin
        .from("greyhound_races")
        .select("card_id,race_status")
        .in("card_id", cardIds),
      admin
        .from("greyhound_league_wager_display")
        .select(
          "fantasy_team_id,racing_card_id,total_cost,official_return,wager_status",
        )
        .eq("league_id", leagueId)
        .in("racing_card_id", cardIds),
    ]);

    if (racesResult.error) throw racesResult.error;
    if (wagersResult.error) throw wagersResult.error;

    races = (racesResult.data ?? []) as unknown as RaceRow[];
    wagers = (wagersResult.data ?? []) as unknown as WagerRow[];
  }

  const fantasyTeamToParticipant = new Map<number, number>();
  for (const identity of identities) {
    fantasyTeamToParticipant.set(
      Number(identity.fantasy_team_id),
      Number(identity.participant_id),
    );
  }

  const scoreMap = new Map<
    number,
    { totalWagered: number; totalReturned: number }
  >();

  for (const participantId of participantIds) {
    scoreMap.set(participantId, {
      totalWagered: 0,
      totalReturned: 0,
    });
  }

  for (const wager of wagers) {
    const participantId = fantasyTeamToParticipant.get(
      Number(wager.fantasy_team_id),
    );

    if (!participantId || !scoreMap.has(participantId)) continue;

    const score = scoreMap.get(participantId)!;
    score.totalWagered += num(wager.total_cost);
    score.totalReturned += num(wager.official_return);
  }

  const sorted = Array.from(scoreMap.entries())
    .map(([participantId, score]) => ({
      participantId,
      participantName: participantName(
        identityByParticipant.get(participantId),
        participantId,
      ),
      totalWagered: money(score.totalWagered),
      totalReturned: money(score.totalReturned),
      net: money(score.totalReturned - score.totalWagered),
      rank: 0,
    }))
    .sort(
      (a, b) =>
        b.totalReturned - a.totalReturned ||
        b.net - a.net ||
        a.participantName.localeCompare(b.participantName),
    );

  sorted.forEach((row, index) => {
    row.rank = index + 1;
  });

  const now = new Date().toISOString();

  for (const score of sorted) {
    const { error: updateError } = await admin
      .from("greyhound_round_participants")
      .update({
        total_wagered: score.totalWagered,
        total_returned: score.totalReturned,
        net: score.net,
        round_rank: score.rank,
        updated_at: now,
      })
      .eq("league_id", leagueId)
      .eq("round_id", roundId)
      .eq("participant_id", score.participantId);

    if (updateError) throw updateError;
  }

  const today = todayUtc();
  const periodEnded = today > round.end_date;
  const allRacesFinal =
    cards.length > 0 &&
    races.length > 0 &&
    races.every((race) => finalRaceStatus(race.race_status));
  const allWagersFinal = wagers.every((wager) =>
    finalWagerStatus(wager.wager_status),
  );

  if (!periodEnded || !allRacesFinal || !allWagersFinal) {
    const status = today >= round.start_date ? "active" : "scheduled";

    const { error: roundUpdateError } = await admin
      .from("greyhound_competition_rounds")
      .update({
        status,
        started_at:
          status === "active" && !round.started_at ? now : round.started_at,
      })
      .eq("league_id", leagueId)
      .eq("id", roundId);

    if (roundUpdateError) throw roundUpdateError;

    return {
      success: true,
      leagueId,
      roundId,
      roundNumber: Number(round.round_number),
      status,
      advanceCount: round.advance_count,
      advancedParticipantIds: [],
      eliminatedParticipantIds: [],
      championParticipantId: null,
      tiedCutoffParticipantIds: [],
      cutoffAdvanceSlots: 0,
      scores: sorted,
    };
  }

  const advanceCount = Number(round.advance_count);

  if (
    !Number.isInteger(advanceCount) ||
    advanceCount <= 0
  ) {
    return {
      success: true,
      leagueId,
      roundId,
      roundNumber: Number(round.round_number),
      status: "blocked_missing_advance_count",
      advanceCount: null,
      advancedParticipantIds: [],
      eliminatedParticipantIds: [],
      championParticipantId: null,
      tiedCutoffParticipantIds: [],
      cutoffAdvanceSlots: 0,
      scores: sorted,
    };
  }

  const cappedAdvanceCount = Math.min(advanceCount, sorted.length);

  let advanced = sorted.slice(0, cappedAdvanceCount);
  let eliminated = sorted.slice(cappedAdvanceCount);

  if (cappedAdvanceCount < sorted.length) {
    const cutoffValue = sorted[cappedAdvanceCount - 1].totalReturned;
    const tiedAtCutoff = sorted.filter(
      (row) => row.totalReturned === cutoffValue,
    );
    const firstTiedIndex = sorted.findIndex(
      (row) => row.totalReturned === cutoffValue,
    );
    const lastTiedIndex = sorted.findLastIndex(
      (row) => row.totalReturned === cutoffValue,
    );

    if (
      firstTiedIndex < cappedAdvanceCount &&
      lastTiedIndex >= cappedAdvanceCount
    ) {
      const tiedIds = tiedAtCutoff.map((row) => row.participantId);
      const cutoffAdvanceSlots = cappedAdvanceCount - firstTiedIndex;
      const selected = Array.from(
        new Set(
          resolvedCutoffAdvancingParticipantIds
            .map(Number)
            .filter((id) => Number.isInteger(id) && id > 0),
        ),
      );

      if (selected.length === 0) {
        return {
          success: true,
          leagueId,
          roundId,
          roundNumber: Number(round.round_number),
          status: "blocked_cutoff_tie",
          advanceCount: cappedAdvanceCount,
          advancedParticipantIds: [],
          eliminatedParticipantIds: [],
          championParticipantId: null,
          tiedCutoffParticipantIds: tiedIds,
          cutoffAdvanceSlots,
          scores: sorted,
        };
      }

      if (selected.length !== cutoffAdvanceSlots) {
        throw new Error("TOURNAMENT_TIE_SELECTION_COUNT");
      }

      if (selected.some((participantId) => !tiedIds.includes(participantId))) {
        throw new Error("TOURNAMENT_TIE_SELECTION_INVALID");
      }

      const selectedSet = new Set(selected);
      const automaticallyAdvanced = sorted.slice(0, firstTiedIndex);
      const selectedTied = tiedAtCutoff.filter((row) =>
        selectedSet.has(row.participantId),
      );

      advanced = [...automaticallyAdvanced, ...selectedTied];

      const advancedIds = new Set(
        advanced.map((row) => row.participantId),
      );

      eliminated = sorted.filter(
        (row) => !advancedIds.has(row.participantId),
      );
    }
  }

  if (advanced.length === 1) {
    const championParticipantId = advanced[0].participantId;

    if (eliminated.length > 0) {
      const { error: eliminatedError } = await admin
        .from("greyhound_round_participants")
        .update({
          status: "eliminated",
          eliminated_at: now,
          updated_at: now,
        })
        .eq("league_id", leagueId)
        .eq("round_id", roundId)
        .in(
          "participant_id",
          eliminated.map((row) => row.participantId),
        );

      if (eliminatedError) throw eliminatedError;
    }

    const { error: championError } = await admin
      .from("greyhound_round_participants")
      .update({
        status: "champion",
        advanced_at: now,
        updated_at: now,
      })
      .eq("league_id", leagueId)
      .eq("round_id", roundId)
      .eq("participant_id", championParticipantId);

    if (championError) throw championError;

    const { error: roundFinalError } = await admin
      .from("greyhound_competition_rounds")
      .update({
        status: "final",
        finalized_at: round.finalized_at ?? now,
        started_at: round.started_at ?? now,
      })
      .eq("league_id", leagueId)
      .eq("id", roundId);

    if (roundFinalError) throw roundFinalError;

    return {
      success: true,
      leagueId,
      roundId,
      roundNumber: Number(round.round_number),
      status: "final",
      advanceCount: cappedAdvanceCount,
      advancedParticipantIds: [championParticipantId],
      eliminatedParticipantIds: eliminated.map(
        (row) => row.participantId,
      ),
      championParticipantId,
      tiedCutoffParticipantIds: [],
      cutoffAdvanceSlots: 0,
      scores: sorted,
    };
  }

  const nextRoundId = await seedNextRound({
    leagueId,
    currentRoundNumber: Number(round.round_number),
    participantIds: advanced.map((row) => row.participantId),
    now,
  });

  if (!nextRoundId) {
    return {
      success: true,
      leagueId,
      roundId,
      roundNumber: Number(round.round_number),
      status: "blocked_no_next_round",
      advanceCount: cappedAdvanceCount,
      advancedParticipantIds: [],
      eliminatedParticipantIds: [],
      championParticipantId: null,
      tiedCutoffParticipantIds: [],
      cutoffAdvanceSlots: 0,
      scores: sorted,
    };
  }

  if (eliminated.length > 0) {
    const { error: eliminatedError } = await admin
      .from("greyhound_round_participants")
      .update({
        status: "eliminated",
        eliminated_at: now,
        updated_at: now,
      })
      .eq("league_id", leagueId)
      .eq("round_id", roundId)
      .in(
        "participant_id",
        eliminated.map((row) => row.participantId),
      );

    if (eliminatedError) throw eliminatedError;
  }

  const { error: advanceError } = await admin
    .from("greyhound_round_participants")
    .update({
      status: "advanced",
      advanced_at: now,
      updated_at: now,
    })
    .eq("league_id", leagueId)
    .eq("round_id", roundId)
    .in(
      "participant_id",
      advanced.map((row) => row.participantId),
    );

  if (advanceError) throw advanceError;

  const { error: roundFinalError } = await admin
    .from("greyhound_competition_rounds")
    .update({
      status: "final",
      finalized_at: round.finalized_at ?? now,
      started_at: round.started_at ?? now,
    })
    .eq("league_id", leagueId)
    .eq("id", roundId);

  if (roundFinalError) throw roundFinalError;

  return {
    success: true,
    leagueId,
    roundId,
    roundNumber: Number(round.round_number),
    status: "final",
    advanceCount: cappedAdvanceCount,
    advancedParticipantIds: advanced.map((row) => row.participantId),
    eliminatedParticipantIds: eliminated.map((row) => row.participantId),
    championParticipantId: null,
    tiedCutoffParticipantIds: [],
    cutoffAdvanceSlots: 0,
    scores: sorted,
  };
}
