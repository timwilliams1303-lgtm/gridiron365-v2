import { NextResponse } from "next/server";

import { requireLeagueMember } from "@/lib/leagues/requireLeagueMember";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type RequestBody = {
  leagueId?: string;
  bankrollCardId?: number;
  raceId?: number;
  entryId?: number | null;
};

function jsonError(error: string, status: number) {
  return NextResponse.json(
    {
      success: false,
      error,
    },
    {
      status,
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    }
  );
}

function positiveInteger(value: unknown) {
  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0
    ? parsed
    : null;
}

export async function POST(request: Request) {
  try {
    const body =
      (await request.json().catch(() => null)) as RequestBody | null;

    const leagueId =
      typeof body?.leagueId === "string"
        ? body.leagueId.trim()
        : "";

    const bankrollCardId = positiveInteger(body?.bankrollCardId);
    const raceId = positiveInteger(body?.raceId);

    const entryId =
      body?.entryId === null || body?.entryId === undefined
        ? null
        : positiveInteger(body.entryId);

    if (!leagueId) {
      return jsonError("leagueId is required.", 400);
    }

    if (bankrollCardId === null) {
      return jsonError("A valid bankrollCardId is required.", 400);
    }

    if (raceId === null) {
      return jsonError("A valid raceId is required.", 400);
    }

    if (
      body?.entryId !== null &&
      body?.entryId !== undefined &&
      entryId === null
    ) {
      return jsonError("entryId must be a valid positive integer or null.", 400);
    }

    const access = await requireLeagueMember(leagueId);

    if (String(access.league.leagueType) !== "greyhound") {
      return jsonError(
        "This endpoint is only available for Greyhound leagues.",
        400
      );
    }

    const admin = createSupabaseAdminClient();

    const {
      data: settings,
      error: settingsError,
    } = await admin
      .from("greyhound_league_settings")
      .select(`
        wagering_style,
        live_auto_wager_enabled
      `)
      .eq("league_id", leagueId)
      .order("id", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (settingsError) {
      return jsonError(settingsError.message, 500);
    }

    if (
      String(settings?.wagering_style ?? "whole_card")
        .trim()
        .toLowerCase() !== "live_bankroll"
    ) {
      return jsonError(
        "Auto-wager selections are only available in Live Bankroll Challenge.",
        409
      );
    }

    if (settings?.live_auto_wager_enabled === false) {
      return jsonError(
        "Live Bankroll auto-wager is disabled for this league.",
        409
      );
    }

    /*
     * Resolve the authenticated member's Greyhound participant.
     *
     * We intentionally use the same user -> league -> fantasy-team ownership
     * relationship already used by the Greyhound wagering engine instead of
     * trusting a fantasy_team_id supplied by the browser.
     */
    const {
      data: participants,
      error: participantError,
    } = await admin
      .from("greyhound_participants")
      .select(`
        id,
        fantasy_team_id
      `)
      .eq("league_id", leagueId);

    if (participantError) {
      return jsonError(participantError.message, 500);
    }

    /*
     * The existing wager RPC is authoritative for resolving user ownership.
     * For this write endpoint we verify the requested bankroll against the
     * Live race state and then use the participant/team relationship recorded
     * by that state. We never accept a fantasy_team_id from the client.
     */
    const {
      data: bankroll,
      error: bankrollError,
    } = await admin
      .from("greyhound_bankroll_cards")
      .select(`
        id,
        league_id,
        fantasy_team_id,
        racing_card_id,
        card_status
      `)
      .eq("id", bankrollCardId)
      .eq("league_id", leagueId)
      .maybeSingle();

    if (bankrollError) {
      return jsonError(bankrollError.message, 500);
    }

    if (!bankroll) {
      return jsonError("Greyhound bankroll card was not found.", 404);
    }

    /*
     * Confirm this fantasy team belongs to the authenticated user by asking
     * the same ownership source used by the wagering RPC: ensure the user's
     * bankroll for this exact racing card and compare the returned card id.
     */
    const {
      data: ownedBankrollResult,
      error: ownedBankrollError,
    } = await admin.rpc(
      "ensure_greyhound_bankroll_card",
      {
        p_league_id: leagueId,
        p_user_id: access.userId,
        p_racing_card_id: Number(bankroll.racing_card_id),
      }
    );

    if (ownedBankrollError) {
      return jsonError(ownedBankrollError.message, 500);
    }

    const ownedBankrollCardId =
      typeof ownedBankrollResult === "object" &&
      ownedBankrollResult !== null &&
      "bankrollCardId" in ownedBankrollResult
        ? positiveInteger(
            (ownedBankrollResult as Record<string, unknown>).bankrollCardId
          )
        : positiveInteger(ownedBankrollResult);

    if (
      ownedBankrollCardId === null ||
      ownedBankrollCardId !== bankrollCardId
    ) {
      return jsonError(
        "You may only change the auto-wager selection for your own bankroll.",
        403
      );
    }

    /*
     * Refresh/open before checking the state so a newly-created member
     * bankroll gets the current immutable race snapshot.
     */
    const {
      error: openError,
    } = await admin.rpc(
      "open_greyhound_live_race",
      {
        p_league_id: leagueId,
        p_racing_card_id: Number(bankroll.racing_card_id),
      }
    );

    if (openError) {
      return jsonError(openError.message, 500);
    }

    const {
      data: liveState,
      error: liveStateError,
    } = await admin
      .from("greyhound_live_race_bankrolls")
      .select(`
        id,
        league_id,
        bankroll_card_id,
        racing_card_id,
        race_id,
        fantasy_team_id,
        race_number,
        race_state,
        opening_bankroll
      `)
      .eq("league_id", leagueId)
      .eq("bankroll_card_id", bankrollCardId)
      .eq("race_id", raceId)
      .maybeSingle();

    if (liveStateError) {
      return jsonError(liveStateError.message, 500);
    }

    if (!liveState) {
      return jsonError(
        "This race is not the current Live Bankroll race for your bankroll.",
        409
      );
    }

    if (
      Number(liveState.racing_card_id) !==
      Number(bankroll.racing_card_id)
    ) {
      return jsonError(
        "The Live Bankroll race does not belong to this racing card.",
        409
      );
    }

    if (
      Number(liveState.fantasy_team_id) !==
      Number(bankroll.fantasy_team_id)
    ) {
      return jsonError(
        "The Live Bankroll state does not belong to this bankroll.",
        403
      );
    }

    if (String(liveState.race_state) !== "open") {
      return jsonError(
        "The auto-wager dog can only be changed while the current race is open.",
        409
      );
    }

    if (Number(liveState.opening_bankroll ?? 0) <= 0) {
      return jsonError(
        "This Live Bankroll entry is busted.",
        409
      );
    }

    const {
      data: race,
      error: raceError,
    } = await admin
      .from("greyhound_races")
      .select(`
        id,
        card_id,
        race_status,
        scheduled_post_time
      `)
      .eq("id", raceId)
      .eq("card_id", Number(bankroll.racing_card_id))
      .maybeSingle();

    if (raceError) {
      return jsonError(raceError.message, 500);
    }

    if (!race) {
      return jsonError("Greyhound race was not found.", 404);
    }

    if (
      !["scheduled", "upcoming"].includes(
        String(race.race_status ?? "").trim().toLowerCase()
      )
    ) {
      return jsonError(
        "The auto-wager dog can no longer be changed for this race.",
        409
      );
    }

    /*
     * The Live engine is authoritative for the exact lock deadline.
     * validate_greyhound_live_wager performs the same current-race and
     * race-lock validation used for manual Live wagers. It does not place
     * a wager.
     */
    const {
      error: validationError,
    } = await admin.rpc(
      "validate_greyhound_live_wager",
      {
        p_league_id: leagueId,
        p_user_id: access.userId,
        p_race_id: raceId,
      }
    );

    if (validationError) {
      const message =
        validationError.message ??
        "The Live Bankroll race is no longer open.";

      return jsonError(message, 409);
    }

    if (entryId !== null) {
      const {
        data: entry,
        error: entryError,
      } = await admin
        .from("greyhound_entries")
        .select(`
          id,
          race_id,
          dog_id,
          box_number,
          entry_status
        `)
        .eq("id", entryId)
        .eq("race_id", raceId)
        .maybeSingle();

      if (entryError) {
        return jsonError(entryError.message, 500);
      }

      if (!entry) {
        return jsonError(
          "The selected Greyhound is not entered in this race.",
          400
        );
      }

      if (entry.dog_id === null) {
        return jsonError(
          "A vacant box cannot be selected for auto-wager.",
          400
        );
      }

      if (
        String(entry.entry_status ?? "").trim().toLowerCase() !== "active"
      ) {
        return jsonError(
          "The selected Greyhound is not active for this race.",
          409
        );
      }
    }

    if (entryId === null) {
      const {
        error: deleteError,
      } = await admin
        .from("greyhound_live_auto_wager_selections")
        .delete()
        .eq("league_id", leagueId)
        .eq("bankroll_card_id", bankrollCardId)
        .eq("race_id", raceId);

      if (deleteError) {
        return jsonError(deleteError.message, 500);
      }

      return NextResponse.json(
        {
          success: true,
          selection: null,
          fallback: "lowest_active_box",
        },
        {
          headers: {
            "Cache-Control": "no-store, max-age=0",
          },
        }
      );
    }

    const {
      data: savedSelection,
      error: saveError,
    } = await admin
      .from("greyhound_live_auto_wager_selections")
      .upsert(
        {
          league_id: leagueId,
          bankroll_card_id: bankrollCardId,
          race_id: raceId,
          entry_id: entryId,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "bankroll_card_id,race_id",
        }
      )
      .select(`
        id,
        league_id,
        bankroll_card_id,
        race_id,
        entry_id,
        created_at,
        updated_at
      `)
      .single();

    if (saveError) {
      return jsonError(saveError.message, 500);
    }

    return NextResponse.json(
      {
        success: true,
        selection: savedSelection,
        fallback: null,
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    console.error(
      "Greyhound Live Bankroll auto-selection failed:",
      error
    );

    return jsonError(
      error instanceof Error
        ? error.message
        : "Unable to save the Live Bankroll auto-wager selection.",
      500
    );
  }
}
