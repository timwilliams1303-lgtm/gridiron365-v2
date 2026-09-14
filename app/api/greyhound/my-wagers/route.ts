import { NextRequest, NextResponse } from "next/server";

import { requireLeagueMember } from "@/lib/leagues/requireLeagueMember";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type EntryRow = {
  id: number;
  race_id: number;
  dog_id: number | null;
  box_number: number;
  entry_status: string;
};

type DogRow = {
  id: number;
  name: string | null;
};

type RaceRow = {
  id: number;
  card_id: number;
  race_number: number;
  grade: string | null;
  distance_yards: number | null;
  scheduled_post_time: string | null;
  actual_post_time: string | null;
  race_status: string;
};

type CardRow = {
  id: number;
  track_id: number;
  race_date: string;
  session: string | null;
  card_status: string;
  lock_at: string | null;
  finalized_at: string | null;
};

type TrackRow = {
  id: number;
  code: string;
  name: string | null;
};

type BankrollRow = {
  id: number;
  racing_card_id: number;
  starting_bankroll: number | string;
  amount_allocated: number | string;
  amount_unallocated: number | string;
  official_return: number | string;
  card_status: string;
  submitted_at: string | null;
  locked_at: string | null;
  finalized_at: string | null;
  created_at: string;
  updated_at: string;
};

type WagerRow = {
  id: number;
  bankroll_card_id: number;
  race_id: number;
  wager_type: string;
  wager_structure: string;
  denomination: number | string;
  combination_count: number;
  total_cost: number | string;
  selected_entry_ids: number[] | null;
  combination_json: unknown;
  alternate_1_entry_id: number | null;
  alternate_2_entry_id: number | null;
  wager_status: string;
  official_return: number | string;
  graded_at: string | null;
  created_at: string;
  updated_at: string;
  grading_status: string;
  refund_reason: string | null;
};


type GreyhoundSettingsRow = {
  game_format: string | null;
};

type GreyhoundParticipantRow = {
  id: number;
  entry_name: string | null;
};

type GreyhoundCompetitionMembershipRow = {
  competition_team_id: number;
};

type GreyhoundCompetitionTeamRow = {
  id: number;
  team_number: number;
  team_name: string;
};

function numeric(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function uniqueNumbers(values: Array<number | null | undefined>) {
  return Array.from(
    new Set(
      values.filter(
        (value): value is number =>
          typeof value === "number" && Number.isFinite(value),
      ),
    ),
  );
}


function cleanName(value: unknown) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
}

function isSharedTeamFormat(gameFormat: string | null | undefined) {
  return (
    gameFormat === "team_head_to_head" ||
    gameFormat === "team_total_winnings"
  );
}

async function loadParticipantNamingContext(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  leagueId: string,
  fantasyTeamId: number,
) {
  const { data: settingsRaw, error: settingsError } = await supabase
    .from("greyhound_league_settings")
    .select("game_format")
    .eq("league_id", leagueId)
    .maybeSingle();

  if (settingsError) {
    throw new Error(
      `Unable to load Greyhound league format: ${settingsError.message}`,
    );
  }

  const settings = settingsRaw as GreyhoundSettingsRow | null;
  const gameFormat = String(settings?.game_format ?? "").trim() || null;

  const { data: greyhoundParticipantRaw, error: greyhoundParticipantError } =
    await supabase
      .from("greyhound_participants")
      .select("id, entry_name")
      .eq("league_id", leagueId)
      .eq("fantasy_team_id", fantasyTeamId)
      .maybeSingle();

  if (greyhoundParticipantError) {
    throw new Error(
      `Unable to load Greyhound entry identity: ${greyhoundParticipantError.message}`,
    );
  }

  const greyhoundParticipant =
    greyhoundParticipantRaw as GreyhoundParticipantRow | null;

  if (!greyhoundParticipant?.id) {
    return {
      gameFormat,
      namingMode: isSharedTeamFormat(gameFormat) ? "team" : "entry",
      participantId: null,
      entryName: null,
      competitionTeamId: null,
      teamNumber: null,
      teamName: null,
      editable: false,
    } as const;
  }

  if (!isSharedTeamFormat(gameFormat)) {
    return {
      gameFormat,
      namingMode: "entry",
      participantId: Number(greyhoundParticipant.id),
      entryName: greyhoundParticipant.entry_name ?? null,
      competitionTeamId: null,
      teamNumber: null,
      teamName: null,
      editable: true,
    } as const;
  }

  const { data: membershipRaw, error: membershipError } = await supabase
    .from("greyhound_competition_team_members")
    .select("competition_team_id")
    .eq("league_id", leagueId)
    .eq("participant_id", Number(greyhoundParticipant.id))
    .maybeSingle();

  if (membershipError) {
    throw new Error(
      `Unable to load Greyhound team membership: ${membershipError.message}`,
    );
  }

  const membership =
    membershipRaw as GreyhoundCompetitionMembershipRow | null;

  if (!membership?.competition_team_id) {
    return {
      gameFormat,
      namingMode: "team",
      participantId: Number(greyhoundParticipant.id),
      entryName: greyhoundParticipant.entry_name ?? null,
      competitionTeamId: null,
      teamNumber: null,
      teamName: null,
      editable: false,
    } as const;
  }

  const { data: teamRaw, error: teamError } = await supabase
    .from("greyhound_competition_teams")
    .select("id, team_number, team_name")
    .eq("league_id", leagueId)
    .eq("id", Number(membership.competition_team_id))
    .maybeSingle();

  if (teamError) {
    throw new Error(
      `Unable to load Greyhound competition team: ${teamError.message}`,
    );
  }

  const team = teamRaw as GreyhoundCompetitionTeamRow | null;

  return {
    gameFormat,
    namingMode: "team",
    participantId: Number(greyhoundParticipant.id),
    entryName: greyhoundParticipant.entry_name ?? null,
    competitionTeamId: team?.id ? Number(team.id) : null,
    teamNumber: team?.team_number ? Number(team.team_number) : null,
    teamName: team?.team_name ?? null,
    editable: Boolean(team?.id),
  } as const;
}

export async function GET(request: NextRequest) {
  try {
    const leagueId = request.nextUrl.searchParams.get("leagueId")?.trim();

    if (!leagueId) {
      return NextResponse.json(
        {
          success: false,
          error: "leagueId is required.",
        },
        { status: 400 },
      );
    }

    const access = await requireLeagueMember(leagueId);

    if (String(access.league.leagueType) !== "greyhound") {
      return NextResponse.json(
        {
          success: false,
          error: "This endpoint is only available for Greyhound leagues.",
        },
        { status: 400 },
      );
    }

    const supabase = createSupabaseAdminClient();

    const emptyResponse = (
      fantasyTeamId: number | null,
      naming:
        | Awaited<ReturnType<typeof loadParticipantNamingContext>>
        | null = null,
    ) =>
      NextResponse.json(
        {
          success: true,
          league: {
            id: leagueId,
            name: access.league.name,
          },
          participant:
            fantasyTeamId === null
              ? null
              : {
                  fantasyTeamId,
                  participantId: naming?.participantId ?? null,
                  gameFormat: naming?.gameFormat ?? null,
                  namingMode: naming?.namingMode ?? "entry",
                  entryName: naming?.entryName ?? null,
                  competitionTeamId:
                    naming?.competitionTeamId ?? null,
                  teamNumber: naming?.teamNumber ?? null,
                  teamName: naming?.teamName ?? null,
                  canEditName: naming?.editable ?? false,
                },
          summary: {
            totalCards: 0,
            totalWagers: 0,
            totalStaked: 0,
            totalReturned: 0,
            net: 0,
            pendingWagers: 0,
            winningWagers: 0,
            losingWagers: 0,
            refundedWagers: 0,
          },
          currentCards: [],
          completedCards: [],
        },
        {
          status: 200,
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );

    /*
     * Greyhound participants use an internal fantasy_teams row.
     * This route is read-only, so it does not create one.
     */
    const { data: participant, error: participantError } = await supabase
      .from("fantasy_teams")
      .select("id")
      .eq("league_id", leagueId)
      .eq("owner_id", access.userId)
      .eq("active", true)
      .maybeSingle();

    if (participantError) {
      throw new Error(
        `Unable to load Greyhound participant: ${participantError.message}`,
      );
    }

    if (!participant?.id) {
      return emptyResponse(null);
    }

    const fantasyTeamId = Number(participant.id);
    const naming = await loadParticipantNamingContext(
      supabase,
      leagueId,
      fantasyTeamId,
    );

    const { data: bankrollRowsRaw, error: bankrollError } = await supabase
      .from("greyhound_bankroll_cards")
      .select(
        "id, racing_card_id, starting_bankroll, amount_allocated, amount_unallocated, official_return, card_status, submitted_at, locked_at, finalized_at, created_at, updated_at",
      )
      .eq("league_id", leagueId)
      .eq("fantasy_team_id", fantasyTeamId)
      .order("id", { ascending: false });

    if (bankrollError) {
      throw new Error(
        `Unable to load Greyhound bankroll history: ${bankrollError.message}`,
      );
    }

    const bankrollRows = (bankrollRowsRaw ?? []) as BankrollRow[];

    if (bankrollRows.length === 0) {
      return emptyResponse(fantasyTeamId, naming);
    }

    const bankrollIds = bankrollRows.map((row) => Number(row.id));

    const { data: wagerRowsRaw, error: wagerError } = await supabase
      .from("greyhound_wagers")
      .select(
        "id, bankroll_card_id, race_id, wager_type, wager_structure, denomination, combination_count, total_cost, selected_entry_ids, combination_json, alternate_1_entry_id, alternate_2_entry_id, wager_status, official_return, graded_at, created_at, updated_at, grading_status, refund_reason",
      )
      .in("bankroll_card_id", bankrollIds)
      .order("created_at", { ascending: false });

    if (wagerError) {
      throw new Error(
        `Unable to load Greyhound wagers: ${wagerError.message}`,
      );
    }

    const wagerRows = (wagerRowsRaw ?? []) as WagerRow[];

    const raceIds = uniqueNumbers(
      wagerRows.map((row) => Number(row.race_id)),
    );

    let raceRows: RaceRow[] = [];

    if (raceIds.length > 0) {
      const { data, error } = await supabase
        .from("greyhound_races")
        .select(
          "id, card_id, race_number, grade, distance_yards, scheduled_post_time, actual_post_time, race_status",
        )
        .in("id", raceIds);

      if (error) {
        throw new Error(
          `Unable to load Greyhound races: ${error.message}`,
        );
      }

      raceRows = (data ?? []) as RaceRow[];
    }

    const cardIds = uniqueNumbers([
      ...bankrollRows.map((row) => Number(row.racing_card_id)),
      ...raceRows.map((row) => Number(row.card_id)),
    ]);

    let cardRows: CardRow[] = [];

    if (cardIds.length > 0) {
      const { data, error } = await supabase
        .from("greyhound_cards")
        .select(
          "id, track_id, race_date, session, card_status, lock_at, finalized_at",
        )
        .in("id", cardIds);

      if (error) {
        throw new Error(
          `Unable to load Greyhound cards: ${error.message}`,
        );
      }

      cardRows = (data ?? []) as CardRow[];
    }

    const trackIds = uniqueNumbers(
      cardRows.map((row) => Number(row.track_id)),
    );

    let trackRows: TrackRow[] = [];

    if (trackIds.length > 0) {
      const { data, error } = await supabase
        .from("greyhound_tracks")
        .select("id, code, name")
        .in("id", trackIds);

      if (error) {
        throw new Error(
          `Unable to load Greyhound tracks: ${error.message}`,
        );
      }

      trackRows = (data ?? []) as TrackRow[];
    }

    const selectedEntryIds = uniqueNumbers(
      wagerRows.flatMap((row) => [
        ...(Array.isArray(row.selected_entry_ids)
          ? row.selected_entry_ids.map((value) => Number(value))
          : []),
        row.alternate_1_entry_id,
        row.alternate_2_entry_id,
      ]),
    );

    let entryRows: EntryRow[] = [];

    if (selectedEntryIds.length > 0) {
      const { data, error } = await supabase
        .from("greyhound_entries")
        .select("id, race_id, dog_id, box_number, entry_status")
        .in("id", selectedEntryIds);

      if (error) {
        throw new Error(
          `Unable to load Greyhound wager selections: ${error.message}`,
        );
      }

      entryRows = (data ?? []) as EntryRow[];
    }

    const dogIds = uniqueNumbers(
      entryRows.map((row) =>
        row.dog_id === null ? null : Number(row.dog_id),
      ),
    );

    let dogRows: DogRow[] = [];

    if (dogIds.length > 0) {
      const { data, error } = await supabase
        .from("greyhound_dogs")
        .select("id, name")
        .in("id", dogIds);

      if (error) {
        throw new Error(
          `Unable to load Greyhound dogs: ${error.message}`,
        );
      }

      dogRows = (data ?? []) as DogRow[];
    }

    const raceById = new Map(
      raceRows.map((row) => [Number(row.id), row] as const),
    );

    const cardById = new Map(
      cardRows.map((row) => [Number(row.id), row] as const),
    );

    const trackById = new Map(
      trackRows.map((row) => [Number(row.id), row] as const),
    );

    const entryById = new Map(
      entryRows.map((row) => [Number(row.id), row] as const),
    );

    const dogById = new Map(
      dogRows.map((row) => [Number(row.id), row] as const),
    );

    const wagersByBankrollId = new Map<number, WagerRow[]>();

    for (const wager of wagerRows) {
      const bankrollCardId = Number(wager.bankroll_card_id);
      const existing =
        wagersByBankrollId.get(bankrollCardId) ?? [];

      existing.push(wager);
      wagersByBankrollId.set(bankrollCardId, existing);
    }

    const resolveEntry = (
      entryId: number | null | undefined,
    ) => {
      if (!entryId) {
        return null;
      }

      const entry = entryById.get(Number(entryId));

      if (!entry) {
        return {
          entryId: Number(entryId),
          dogId: null,
          dogName: null,
          boxNumber: null,
          entryStatus: null,
        };
      }

      const dog =
        entry.dog_id !== null
          ? dogById.get(Number(entry.dog_id))
          : undefined;

      return {
        entryId: Number(entry.id),
        dogId:
          entry.dog_id === null
            ? null
            : Number(entry.dog_id),
        dogName: dog?.name ?? null,
        boxNumber: Number(entry.box_number),
        entryStatus: entry.entry_status,
      };
    };

    const cards = bankrollRows.map((bankroll) => {
      const card = cardById.get(
        Number(bankroll.racing_card_id),
      );

      const track = card
        ? trackById.get(Number(card.track_id))
        : undefined;

      const cardWagers =
        wagersByBankrollId.get(Number(bankroll.id)) ?? [];

      const wagers = cardWagers.map((wager) => {
        const race = raceById.get(Number(wager.race_id));

        const selections = Array.isArray(
          wager.selected_entry_ids,
        )
          ? wager.selected_entry_ids
              .map((entryId) =>
                resolveEntry(Number(entryId)),
              )
              .filter(
                (
                  entry,
                ): entry is NonNullable<
                  ReturnType<typeof resolveEntry>
                > => entry !== null,
              )
          : [];

        return {
          id: Number(wager.id),

          race: race
            ? {
                id: Number(race.id),
                raceNumber: Number(race.race_number),
                grade: race.grade,
                distanceYards:
                  race.distance_yards === null
                    ? null
                    : Number(race.distance_yards),
                scheduledPostTime:
                  race.scheduled_post_time,
                actualPostTime: race.actual_post_time,
                status: race.race_status,
              }
            : null,

          wagerType: wager.wager_type,
          wagerStructure: wager.wager_structure,
          denomination: numeric(wager.denomination),
          combinationCount: Number(
            wager.combination_count,
          ),
          totalCost: numeric(wager.total_cost),

          selectedEntryIds: Array.isArray(
            wager.selected_entry_ids,
          )
            ? wager.selected_entry_ids.map((value) =>
                Number(value),
              )
            : [],

          selections,
          combinationJson: wager.combination_json,

          alternate1: resolveEntry(
            wager.alternate_1_entry_id,
          ),
          alternate2: resolveEntry(
            wager.alternate_2_entry_id,
          ),

          wagerStatus: wager.wager_status,
          gradingStatus: wager.grading_status,
          officialReturn: numeric(
            wager.official_return,
          ),
          refundReason: wager.refund_reason,

          gradedAt: wager.graded_at,

          createdAt: wager.created_at,
          updatedAt: wager.updated_at,
        };
      });

      const totalStaked = wagers.reduce(
        (sum, wager) => sum + wager.totalCost,
        0,
      );

      const totalReturned = wagers.reduce(
        (sum, wager) => sum + wager.officialReturn,
        0,
      );

      return {
        bankrollCardId: Number(bankroll.id),

        card: card
          ? {
              id: Number(card.id),
              raceDate: card.race_date,
              session: card.session,
              status: card.card_status,
              lockAt: card.lock_at,
              finalizedAt: card.finalized_at,
            }
          : null,

        track: track
          ? {
              id: Number(track.id),
              code: track.code,
              name: track.name,
            }
          : null,

        bankroll: {
          startingBankroll: numeric(
            bankroll.starting_bankroll,
          ),
          amountAllocated: numeric(
            bankroll.amount_allocated,
          ),
          amountUnallocated: numeric(
            bankroll.amount_unallocated,
          ),
          officialReturn: numeric(
            bankroll.official_return,
          ),
          status: bankroll.card_status,
          submittedAt: bankroll.submitted_at,
          lockedAt: bankroll.locked_at,
          finalizedAt: bankroll.finalized_at,
        },

        totals: {
          wagerCount: wagers.length,
          totalStaked,
          totalReturned,
          net: totalReturned - totalStaked,
        },

        wagers,
      };
    });

    const terminalCardStatuses = new Set([
      "final",
      "cancelled",
    ]);

    const completedCards = cards.filter((item) => {
      const cardStatus = item.card?.status ?? "";
      const bankrollStatus = item.bankroll.status ?? "";

      return (
        terminalCardStatuses.has(cardStatus) ||
        terminalCardStatuses.has(bankrollStatus)
      );
    });

    const completedBankrollIds = new Set(
      completedCards.map((item) => item.bankrollCardId),
    );

    const currentCards = cards.filter(
      (item) =>
        !completedBankrollIds.has(item.bankrollCardId),
    );

    const totalStaked = wagerRows.reduce(
      (sum, wager) =>
        sum + numeric(wager.total_cost),
      0,
    );

    const totalReturned = wagerRows.reduce(
      (sum, wager) =>
        sum + numeric(wager.official_return),
      0,
    );

    const normalizedStatuses = wagerRows.map((wager) =>
      String(wager.wager_status ?? "").toLowerCase(),
    );

    return NextResponse.json(
      {
        success: true,

        league: {
          id: leagueId,
          name: access.league.name,
        },

        participant: {
          fantasyTeamId,
          participantId: naming.participantId,
          gameFormat: naming.gameFormat,
          namingMode: naming.namingMode,
          entryName: naming.entryName,
          competitionTeamId: naming.competitionTeamId,
          teamNumber: naming.teamNumber,
          teamName: naming.teamName,
          canEditName: naming.editable,
        },

        summary: {
          totalCards: bankrollRows.length,
          totalWagers: wagerRows.length,
          totalStaked,
          totalReturned,
          net: totalReturned - totalStaked,

          pendingWagers: normalizedStatuses.filter(
            (status) =>
              status === "pending" ||
              status === "locked",
          ).length,

          winningWagers: normalizedStatuses.filter(
            (status) => status === "winner",
          ).length,

          losingWagers: normalizedStatuses.filter(
            (status) => status === "loser",
          ).length,

          refundedWagers: normalizedStatuses.filter(
            (status) =>
              status === "refunded" ||
              status === "no_action" ||
              status === "cancelled",
          ).length,
        },

        currentCards,
        completedCards,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error(
      "[greyhound/my-wagers] GET failed",
      error,
    );

    const message =
      error instanceof Error
        ? error.message
        : "Unable to load Greyhound wagers.";

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }
}


export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      leagueId?: string;
      action?: "save_name" | "cancel_wager";
      name?: string;
      wagerId?: number;
    };

    const leagueId = String(body.leagueId ?? "").trim();
    const action = body.action ?? "save_name";

    if (!leagueId) {
      return NextResponse.json(
        { success: false, error: "leagueId is required." },
        { status: 400 },
      );
    }

    if (action !== "save_name" && action !== "cancel_wager") {
      return NextResponse.json(
        { success: false, error: "Unsupported My Wagers action." },
        { status: 400 },
      );
    }

    const access = await requireLeagueMember(leagueId);

    if (String(access.league.leagueType) !== "greyhound") {
      return NextResponse.json(
        {
          success: false,
          error: "This endpoint is only available for Greyhound leagues.",
        },
        { status: 400 },
      );
    }

    const supabase = createSupabaseAdminClient();

    if (action === "cancel_wager") {
      const wagerId = Number(body.wagerId);

      if (!Number.isInteger(wagerId) || wagerId <= 0) {
        return NextResponse.json(
          { success: false, error: "A valid wagerId is required." },
          { status: 400 },
        );
      }

      const { data: cancelResult, error: cancelError } = await supabase.rpc(
        "cancel_greyhound_wager",
        {
          p_league_id: leagueId,
          p_user_id: access.userId,
          p_wager_id: wagerId,
        },
      );

      if (cancelError) {
        const message =
          cancelError.message ?? "Unable to cancel Greyhound wager.";
        const lower = message.toLowerCase();

        const status = lower.includes("not found")
          ? 404
          : lower.includes("locked") ||
              lower.includes("cutoff") ||
              lower.includes("underway") ||
              lower.includes("pending") ||
              lower.includes("grading") ||
              lower.includes("cannot be cancelled")
            ? 409
            : 400;

        return NextResponse.json(
          { success: false, error: message },
          {
            status,
            headers: { "Cache-Control": "no-store" },
          },
        );
      }

      return NextResponse.json(
        {
          success: true,
          action: "cancel_wager",
          wagerId,
          result: cancelResult,
          message: "Wager cancelled and bankroll restored.",
        },
        {
          status: 200,
          headers: { "Cache-Control": "no-store" },
        },
      );
    }

    const name = cleanName(body.name);

    if (name.length < 2) {
      return NextResponse.json(
        {
          success: false,
          error: "Name must be at least 2 characters.",
        },
        { status: 400 },
      );
    }

    const { data: participant, error: participantError } = await supabase
      .from("fantasy_teams")
      .select("id")
      .eq("league_id", leagueId)
      .eq("owner_id", access.userId)
      .eq("active", true)
      .maybeSingle();

    if (participantError) {
      throw new Error(
        `Unable to load Greyhound participant: ${participantError.message}`,
      );
    }

    if (!participant?.id) {
      return NextResponse.json(
        {
          success: false,
          error: "No active Greyhound entry was found for this league.",
        },
        { status: 404 },
      );
    }

    const fantasyTeamId = Number(participant.id);
    const naming = await loadParticipantNamingContext(
      supabase,
      leagueId,
      fantasyTeamId,
    );

    if (!naming.participantId) {
      return NextResponse.json(
        {
          success: false,
          error: "Greyhound participant identity has not been created yet.",
        },
        { status: 409 },
      );
    }

    if (naming.namingMode === "team") {
      if (!naming.competitionTeamId) {
        return NextResponse.json(
          {
            success: false,
            error: "You are not assigned to a Greyhound competition team yet.",
          },
          { status: 409 },
        );
      }

      const { error: teamUpdateError } = await supabase
        .from("greyhound_competition_teams")
        .update({ team_name: name })
        .eq("league_id", leagueId)
        .eq("id", naming.competitionTeamId);

      if (teamUpdateError) {
        throw new Error(
          `Unable to save Greyhound Team Name: ${teamUpdateError.message}`,
        );
      }
    } else {
      const { error: entryUpdateError } = await supabase
        .from("greyhound_participants")
        .update({ entry_name: name })
        .eq("league_id", leagueId)
        .eq("id", naming.participantId);

      if (entryUpdateError) {
        throw new Error(
          `Unable to save Greyhound Entry Name: ${entryUpdateError.message}`,
        );
      }

      /*
       * Keep the backing fantasy team name aligned with the Greyhound
       * Entry Name so older pages that still read fantasy_teams.team_name
       * continue to display the member's chosen name.
       */
      const { error: fantasyTeamUpdateError } = await supabase
        .from("fantasy_teams")
        .update({ team_name: name })
        .eq("league_id", leagueId)
        .eq("id", fantasyTeamId)
        .eq("owner_id", access.userId);

      if (fantasyTeamUpdateError) {
        throw new Error(
          `Entry Name saved, but the legacy team-name mirror failed: ${fantasyTeamUpdateError.message}`,
        );
      }
    }

    const updatedNaming = await loadParticipantNamingContext(
      supabase,
      leagueId,
      fantasyTeamId,
    );

    return NextResponse.json(
      {
        success: true,
        participant: {
          fantasyTeamId,
          participantId: updatedNaming.participantId,
          gameFormat: updatedNaming.gameFormat,
          namingMode: updatedNaming.namingMode,
          entryName: updatedNaming.entryName,
          competitionTeamId: updatedNaming.competitionTeamId,
          teamNumber: updatedNaming.teamNumber,
          teamName: updatedNaming.teamName,
          canEditName: updatedNaming.editable,
        },
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error("[greyhound/my-wagers] POST failed", error);

    const message =
      error instanceof Error
        ? error.message
        : "Unable to update Greyhound My Wagers.";

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }
}
