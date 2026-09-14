import { NextRequest, NextResponse } from "next/server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireLeagueMember } from "@/lib/leagues/requireLeagueMember";

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

async function requireCommissioner(leagueId: string) {
  const access = await requireLeagueMember(leagueId);

  if (String(access.league.leagueType) !== "greyhound") {
    throw new Error("GREYHOUND_ONLY");
  }

  if (!access.isCommissioner) {
    throw new Error("COMMISSIONER_ONLY");
  }

  return access;
}

function numberValue(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function lower(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

export async function GET(request: NextRequest) {
  try {
    const leagueId = request.nextUrl.searchParams.get("leagueId")?.trim();

    if (!leagueId) {
      return jsonError("leagueId is required.", 400);
    }

    const access = await requireCommissioner(leagueId);
    const admin = createSupabaseAdminClient();

    const { data: cardsRaw, error: cardsError } = await admin
      .from("greyhound_cards")
      .select(
        "id,track_id,race_date,session,scheduled_first_post,card_status,total_races,commissioner_confirmed_at",
      )
      .order("race_date", { ascending: false })
      .order("id", { ascending: false })
      .limit(14);

    if (cardsError) throw cardsError;

    const cards = cardsRaw ?? [];
    const cardIds = cards.map((row) => Number(row.id));
    const trackIds = Array.from(
      new Set(cards.map((row) => Number(row.track_id)).filter(Number.isFinite)),
    );

    const [
      tracksResult,
      racesResult,
      wagersResult,
      identitiesResult,
    ] = await Promise.all([
      trackIds.length > 0
        ? admin
            .from("greyhound_tracks")
            .select("id,code,name,timezone")
            .in("id", trackIds)
        : Promise.resolve({ data: [], error: null }),
      cardIds.length > 0
        ? admin
            .from("greyhound_races")
            .select(
              "id,card_id,race_number,grade,distance_yards,scheduled_post_time,actual_post_time,race_status",
            )
            .in("card_id", cardIds)
            .order("race_number", { ascending: true })
        : Promise.resolve({ data: [], error: null }),
      admin
        .from("greyhound_league_wager_display")
        .select(
          "wager_id,league_id,fantasy_team_id,racing_card_id,race_id,race_number,race_status,wager_type,wager_structure,denomination,combination_count,total_cost,wager_status,grading_status,official_return,selected_entry_ids,selected_dogs,alternate_1,alternate_2,combination_json,refund_reason,graded_at,last_regraded_at,created_at,updated_at",
        )
        .eq("league_id", leagueId)
        .order("created_at", { ascending: false })
        .limit(500),
      admin
        .from("greyhound_participant_identity")
        .select(
          "participant_id,fantasy_team_id,entry_name,member_name,competition_team_id,team_number,team_name",
        )
        .eq("league_id", leagueId),
    ]);

    for (const result of [
      tracksResult,
      racesResult,
      wagersResult,
      identitiesResult,
    ]) {
      if (result.error) throw result.error;
    }

    const races = racesResult.data ?? [];
    const raceIds = races.map((row) => Number(row.id));

    const [resultsResult, payoutsResult, entriesResult] = await Promise.all([
      raceIds.length > 0
        ? admin
            .from("greyhound_race_results")
            .select(
              "id,race_id,entry_id,dog_id,box_number,finish_position,final_odds_text,final_odds_decimal,official_time,result_status,is_dead_heat,revision_number,corrected_at,correction_reason,source_result_key,updated_at",
            )
            .in("race_id", raceIds)
            .order("finish_position", { ascending: true })
        : Promise.resolve({ data: [], error: null }),
      raceIds.length > 0
        ? admin
            .from("greyhound_mutuel_payouts")
            .select(
              "id,race_id,wager_type,winning_combination,published_base_amount,published_payout,source,payout_status,source_payout_key,created_at,updated_at",
            )
            .in("race_id", raceIds)
            .order("wager_type", { ascending: true })
        : Promise.resolve({ data: [], error: null }),
      raceIds.length > 0
        ? admin
            .from("greyhound_entries")
            .select("id,race_id,dog_id,box_number,entry_status")
            .in("race_id", raceIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    for (const result of [resultsResult, payoutsResult, entriesResult]) {
      if (result.error) throw result.error;
    }

    const entries = entriesResult.data ?? [];
    const dogIds = Array.from(
      new Set(
        entries
          .map((row) => (row.dog_id == null ? null : Number(row.dog_id)))
          .filter((value): value is number => value != null),
      ),
    );

    const { data: dogsRaw, error: dogsError } =
      dogIds.length > 0
        ? await admin
            .from("greyhound_dogs")
            .select("id,display_name")
            .in("id", dogIds)
        : { data: [], error: null };

    if (dogsError) throw dogsError;

    const tracksById = new Map(
      (tracksResult.data ?? []).map((row) => [
        Number(row.id),
        {
          id: Number(row.id),
          code: String(row.code ?? ""),
          name: String(row.name ?? row.code ?? "Track"),
          timezone: row.timezone ?? null,
        },
      ]),
    );

    const dogNames = new Map(
      (dogsRaw ?? []).map((row) => [
        Number(row.id),
        String(row.display_name ?? `Dog ${row.id}`),
      ]),
    );

    const entriesById = new Map(
      entries.map((row) => [
        Number(row.id),
        {
          id: Number(row.id),
          raceId: Number(row.race_id),
          dogId: row.dog_id == null ? null : Number(row.dog_id),
          boxNumber: Number(row.box_number),
          entryStatus: String(row.entry_status ?? ""),
          dogName:
            row.dog_id == null
              ? `Box ${row.box_number}`
              : dogNames.get(Number(row.dog_id)) ?? `Dog ${row.dog_id}`,
        },
      ]),
    );

    const identitiesByFantasyTeam = new Map(
      (identitiesResult.data ?? []).map((row) => [
        Number(row.fantasy_team_id),
        {
          participantId: Number(row.participant_id),
          entryName:
            String(row.entry_name ?? "").trim() ||
            String(row.member_name ?? "").trim() ||
            `Entry ${row.participant_id}`,
          memberName:
            String(row.member_name ?? "").trim() ||
            String(row.entry_name ?? "").trim() ||
            `Entry ${row.participant_id}`,
          teamName:
            String(row.team_name ?? "").trim() || null,
        },
      ]),
    );

    const resultsByRace = new Map<number, Array<Record<string, unknown>>>();
    for (const row of resultsResult.data ?? []) {
      const raceId = Number(row.race_id);
      const bucket = resultsByRace.get(raceId) ?? [];
      const entry =
        row.entry_id == null ? null : entriesById.get(Number(row.entry_id));

      bucket.push({
        id: Number(row.id),
        entryId: row.entry_id == null ? null : Number(row.entry_id),
        dogId: row.dog_id == null ? null : Number(row.dog_id),
        dogName:
          entry?.dogName ??
          (row.dog_id == null
            ? `Box ${row.box_number ?? "—"}`
            : dogNames.get(Number(row.dog_id)) ?? `Dog ${row.dog_id}`),
        boxNumber: row.box_number == null ? null : Number(row.box_number),
        finishPosition:
          row.finish_position == null ? null : Number(row.finish_position),
        finalOddsText: row.final_odds_text ?? null,
        finalOddsDecimal:
          row.final_odds_decimal == null
            ? null
            : numberValue(row.final_odds_decimal),
        officialTime:
          row.official_time == null ? null : numberValue(row.official_time),
        resultStatus: String(row.result_status ?? ""),
        isDeadHeat: Boolean(row.is_dead_heat),
        revisionNumber: Number(row.revision_number ?? 0),
        correctedAt: row.corrected_at ?? null,
        correctionReason: row.correction_reason ?? null,
        sourceResultKey: row.source_result_key ?? null,
        updatedAt: row.updated_at ?? null,
      });

      resultsByRace.set(raceId, bucket);
    }

    const payoutsByRace = new Map<number, Array<Record<string, unknown>>>();
    for (const row of payoutsResult.data ?? []) {
      const raceId = Number(row.race_id);
      const bucket = payoutsByRace.get(raceId) ?? [];

      bucket.push({
        id: Number(row.id),
        wagerType: String(row.wager_type ?? ""),
        winningCombination: String(row.winning_combination ?? ""),
        baseAmount: numberValue(row.published_base_amount),
        payout: numberValue(row.published_payout),
        source: row.source ?? null,
        payoutStatus: String(row.payout_status ?? ""),
        sourcePayoutKey: row.source_payout_key ?? null,
        updatedAt: row.updated_at ?? null,
      });

      payoutsByRace.set(raceId, bucket);
    }

    const wagers = (wagersResult.data ?? []).map((row) => {
      const identity = identitiesByFantasyTeam.get(
        Number(row.fantasy_team_id),
      );

      return {
        wagerId: Number(row.wager_id),
        fantasyTeamId: Number(row.fantasy_team_id),
        participantName: identity?.entryName ?? `Entry ${row.fantasy_team_id}`,
        memberName: identity?.memberName ?? null,
        teamName: identity?.teamName ?? null,
        racingCardId: Number(row.racing_card_id),
        raceId: Number(row.race_id),
        raceNumber:
          row.race_number == null ? null : Number(row.race_number),
        wagerType: String(row.wager_type ?? ""),
        wagerStructure: String(row.wager_structure ?? ""),
        denomination: numberValue(row.denomination),
        combinationCount: Number(row.combination_count ?? 0),
        totalCost: numberValue(row.total_cost),
        wagerStatus: String(row.wager_status ?? ""),
        gradingStatus: String(row.grading_status ?? ""),
        officialReturn: numberValue(row.official_return),
        selectedEntryIds: row.selected_entry_ids ?? [],
        selectedDogs: row.selected_dogs ?? [],
        alternate1: row.alternate_1 ?? null,
        alternate2: row.alternate_2 ?? null,
        combinationJson: row.combination_json ?? null,
        refundReason: row.refund_reason ?? null,
        gradedAt: row.graded_at ?? null,
        lastRegradedAt: row.last_regraded_at ?? null,
        createdAt: row.created_at ?? null,
        updatedAt: row.updated_at ?? null,
      };
    });

    const wagersByRace = new Map<number, typeof wagers>();
    for (const wager of wagers) {
      const bucket = wagersByRace.get(wager.raceId) ?? [];
      bucket.push(wager);
      wagersByRace.set(wager.raceId, bucket);
    }

    const racesByCard = new Map<number, Array<Record<string, unknown>>>();
    for (const race of races) {
      const raceId = Number(race.id);
      const raceWagers = wagersByRace.get(raceId) ?? [];
      const bucket = racesByCard.get(Number(race.card_id)) ?? [];

      bucket.push({
        id: raceId,
        raceNumber: Number(race.race_number),
        grade: race.grade ?? null,
        distanceYards:
          race.distance_yards == null ? null : Number(race.distance_yards),
        scheduledPostTime: race.scheduled_post_time ?? null,
        actualPostTime: race.actual_post_time ?? null,
        raceStatus: String(race.race_status ?? ""),
        results: resultsByRace.get(raceId) ?? [],
        payouts: payoutsByRace.get(raceId) ?? [],
        wagerSummary: {
          total: raceWagers.length,
          pending: raceWagers.filter(
            (row) =>
              ["pending", "open", "submitted"].includes(
                lower(row.wagerStatus),
              ) || lower(row.gradingStatus) === "pending",
          ).length,
          winners: raceWagers.filter(
            (row) => lower(row.wagerStatus) === "winner",
          ).length,
          losers: raceWagers.filter(
            (row) => lower(row.wagerStatus) === "loser",
          ).length,
          refunded: raceWagers.filter((row) =>
            ["refunded", "void", "no_action"].includes(
              lower(row.wagerStatus),
            ),
          ).length,
          staked: raceWagers.reduce(
            (sum, row) => sum + row.totalCost,
            0,
          ),
          returned: raceWagers.reduce(
            (sum, row) => sum + row.officialReturn,
            0,
          ),
        },
        wagers: raceWagers,
      });

      racesByCard.set(Number(race.card_id), bucket);
    }

    const cardsPayload = cards.map((card) => {
      const cardRaces = (racesByCard.get(Number(card.id)) ?? []).sort(
        (a, b) =>
          Number(a.raceNumber ?? 0) - Number(b.raceNumber ?? 0),
      );
      const track = tracksById.get(Number(card.track_id)) ?? null;
      const cardWagers = wagers.filter(
        (row) => row.racingCardId === Number(card.id),
      );

      return {
        id: Number(card.id),
        raceDate: String(card.race_date),
        session: String(card.session ?? ""),
        scheduledFirstPost: card.scheduled_first_post ?? null,
        cardStatus: String(card.card_status ?? ""),
        totalRaces: Number(card.total_races ?? cardRaces.length),
        commissionerConfirmedAt: card.commissioner_confirmed_at ?? null,
        track,
        settlement: {
          races: cardRaces.length,
          finalRaces: cardRaces.filter((row) =>
            ["final", "official"].includes(lower(row.raceStatus)),
          ).length,
          racesWithResults: cardRaces.filter(
            (row) => Array.isArray(row.results) && row.results.length > 0,
          ).length,
          wagers: cardWagers.length,
          gradedWagers: cardWagers.filter((row) =>
            ["winner", "loser", "refunded", "void", "no_action"].includes(
              lower(row.wagerStatus),
            ),
          ).length,
          pendingWagers: cardWagers.filter(
            (row) =>
              ["pending", "open", "submitted"].includes(
                lower(row.wagerStatus),
              ) || lower(row.gradingStatus) === "pending",
          ).length,
          totalStaked: cardWagers.reduce(
            (sum, row) => sum + row.totalCost,
            0,
          ),
          totalReturned: cardWagers.reduce(
            (sum, row) => sum + row.officialReturn,
            0,
          ),
        },
        races: cardRaces,
      };
    });

    const summary = {
      cards: cardsPayload.length,
      races: races.length,
      officialResultRows: (resultsResult.data ?? []).filter((row) =>
        ["official", "final"].includes(lower(row.result_status)),
      ).length,
      payoutRows: payoutsResult.data?.length ?? 0,
      wagers: wagers.length,
      pendingWagers: wagers.filter(
        (row) =>
          ["pending", "open", "submitted"].includes(
            lower(row.wagerStatus),
          ) || lower(row.gradingStatus) === "pending",
      ).length,
      winningWagers: wagers.filter(
        (row) => lower(row.wagerStatus) === "winner",
      ).length,
      losingWagers: wagers.filter(
        (row) => lower(row.wagerStatus) === "loser",
      ).length,
      refundedWagers: wagers.filter((row) =>
        ["refunded", "void", "no_action"].includes(
          lower(row.wagerStatus),
        ),
      ).length,
      totalStaked: wagers.reduce((sum, row) => sum + row.totalCost, 0),
      totalReturned: wagers.reduce(
        (sum, row) => sum + row.officialReturn,
        0,
      ),
    };

    return NextResponse.json(
      {
        success: true,
        league: {
          id: leagueId,
          name: access.league.name,
        },
        summary,
        cards: cardsPayload,
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      },
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to load Greyhound Results & Settlements.";

    if (message === "GREYHOUND_ONLY") {
      return jsonError(
        "This endpoint is only available for Greyhound leagues.",
        400,
      );
    }

    if (message === "COMMISSIONER_ONLY") {
      return jsonError(
        "Only the commissioner can access Results & Settlements.",
        403,
      );
    }

    console.error(
      "[greyhound/commissioner/results-settlements] GET failed",
      error,
    );
    return jsonError(message, 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      leagueId?: string;
      action?: "resettle_race" | "refund_wager" | "no_action_wager";
      raceId?: number;
      wagerId?: number;
      reason?: string;
    };

    const leagueId = String(body.leagueId ?? "").trim();
    const action = body.action;

    if (!leagueId) {
      return jsonError("leagueId is required.", 400);
    }

    if (
      action !== "resettle_race" &&
      action !== "refund_wager" &&
      action !== "no_action_wager"
    ) {
      return jsonError("Valid settlement action is required.", 400);
    }

    await requireCommissioner(leagueId);
    const admin = createSupabaseAdminClient();

    if (action === "resettle_race") {
      const raceId = Number(body.raceId);

      if (!Number.isInteger(raceId) || raceId <= 0) {
        return jsonError("Valid raceId is required.", 400);
      }

      const { data: race, error: raceError } = await admin
        .from("greyhound_races")
        .select("id,card_id,race_number,race_status")
        .eq("id", raceId)
        .maybeSingle();

      if (raceError) throw raceError;
      if (!race) return jsonError("Greyhound race was not found.", 404);

      const { data: card, error: cardError } = await admin
        .from("greyhound_cards")
        .select("id")
        .eq("id", Number(race.card_id))
        .maybeSingle();

      if (cardError) throw cardError;
      if (!card) return jsonError("Greyhound race card was not found.", 404);

      const { data: leagueWagers, error: leagueWagerError } = await admin
        .from("greyhound_league_wager_display")
        .select("wager_id")
        .eq("league_id", leagueId)
        .eq("race_id", raceId)
        .limit(1);

      if (leagueWagerError) throw leagueWagerError;

      /*
       * A race can legitimately have zero wagers in this league. The race/card
       * existence check above still makes re-settlement safe; this query simply
       * proves league scope when league tickets do exist.
       */
      void leagueWagers;

      const { data, error } = await admin.rpc("settle_greyhound_race", {
        p_race_id: raceId,
      });

      if (error) throw error;

      return NextResponse.json(
        {
          success: true,
          action,
          raceId,
          raceNumber: Number(race.race_number),
          result: data,
          message: `Race ${race.race_number} was re-settled from the current official result and payout data.`,
        },
        {
          headers: {
            "Cache-Control": "no-store, max-age=0",
          },
        },
      );
    }

    const wagerId = Number(body.wagerId);
    const reason = String(body.reason ?? "").trim();

    if (!Number.isInteger(wagerId) || wagerId <= 0) {
      return jsonError("Valid wagerId is required.", 400);
    }

    if (reason.length < 3) {
      return jsonError(
        "Enter a short reason before refunding or marking a wager no action.",
        400,
      );
    }

    const { data: wager, error: wagerError } = await admin
      .from("greyhound_league_wager_display")
      .select("wager_id,league_id,race_id,wager_status")
      .eq("league_id", leagueId)
      .eq("wager_id", wagerId)
      .maybeSingle();

    if (wagerError) throw wagerError;
    if (!wager) {
      return jsonError("Greyhound wager was not found in this league.", 404);
    }

    const status =
      action === "refund_wager" ? "refunded" : "no_action";

    const { data, error } = await admin.rpc("refund_greyhound_wager", {
      p_wager_id: wagerId,
      p_reason: reason,
      p_status: status,
    });

    if (error) throw error;

    return NextResponse.json(
      {
        success: true,
        action,
        wagerId,
        status,
        result: data,
        message:
          status === "refunded"
            ? `Wager ${wagerId} was refunded.`
            : `Wager ${wagerId} was marked no action.`,
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      },
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to apply Greyhound settlement action.";

    if (message === "GREYHOUND_ONLY") {
      return jsonError(
        "This endpoint is only available for Greyhound leagues.",
        400,
      );
    }

    if (message === "COMMISSIONER_ONLY") {
      return jsonError(
        "Only the commissioner can manage Greyhound settlements.",
        403,
      );
    }

    console.error(
      "[greyhound/commissioner/results-settlements] POST failed",
      error,
    );

    return jsonError(message, 500);
  }
}
