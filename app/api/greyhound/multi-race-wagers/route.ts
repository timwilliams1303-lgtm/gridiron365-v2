import { NextResponse } from "next/server";

import { requireLeagueMember } from "@/lib/leagues/requireLeagueMember";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getAmtoteRaces, type AmtoteTrackId } from "@/lib/greyhound/amtote";

export const dynamic = "force-dynamic";

type LegSelection = {

  raceId?: number;

  entryIds?: number[];

};

type RequestBody = {

  leagueId?: string;

  poolId?: number;

  denomination?: number;

  legSelections?: LegSelection[];

  fantasyTeamId?: number | null;

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

function roundMoney(value: number) {

  return Math.round((value + Number.EPSILON) * 100) / 100;

}

function amtoteTrackId(trackCode: string): AmtoteTrackId | null {
  const code = trackCode.trim().toUpperCase();
  if (code === "GWD") return "WEM";
  if (code === "GTS") return "TSE";
  return null;
}

async function enforceLiveBankrollMtp(params: { wageringStyle: string; trackCode: string; raceDate: string; raceNumber: number }) {
  if (params.wageringStyle !== "live_bankroll") return;
  const trackId = amtoteTrackId(params.trackCode);
  if (!trackId) throw new Error("This Greyhound track is not supported by the live AmTote wagering lock.");
  const card = await getAmtoteRaces(trackId);
  if (card.raceDate !== params.raceDate) throw new Error("Live wagering is unavailable because the AmTote racing date does not match this card.");
  const race = card.races.find((item) => item.raceNumber === params.raceNumber);
  if (!race) throw new Error("Live wagering is unavailable because this race was not found in the current AmTote card.");
  if (race.minutesToPost === null) throw new Error("Live wagering is unavailable because AmTote minutes-to-post is not available.");
  if (race.minutesToPost <= 0) throw new Error("Live wagering is closed because this race has reached 0 minutes to post.");
}

export async function POST(request: Request) {

  try {

    const body = (await request.json().catch(() => null)) as RequestBody | null;

    const leagueId =

      typeof body?.leagueId === "string"

        ? body.leagueId.trim()

        : "";

    const poolId = Number(body?.poolId);

    const denomination = roundMoney(Number(body?.denomination));

    if (!leagueId) {

      return jsonError("leagueId is required.", 400);

    }

    if (!Number.isInteger(poolId) || poolId <= 0) {

      return jsonError("A valid poolId is required.", 400);

    }

    if (!Number.isFinite(denomination) || denomination < 0.25) {

      return jsonError(

        "Pick 4 and Pick 5 wagers have a minimum denomination of $0.25.",

        400

      );

    }

    if (Math.round(denomination * 100) !== denomination * 100) {

      return jsonError(

        "Wager denomination cannot contain fractions of a cent.",

        400

      );

    }

    if (!Array.isArray(body?.legSelections) || body.legSelections.length === 0) {

      return jsonError(

        "At least one multi-race leg selection is required.",

        400

      );

    }

    const normalizedLegSelections = body.legSelections.map(

      (leg, legIndex) => {

        const raceId = Number(leg?.raceId);

        if (!Number.isInteger(raceId) || raceId <= 0) {

          throw new Error(

            `Leg ${legIndex + 1} has an invalid race ID.`

          );

        }

        if (!Array.isArray(leg?.entryIds) || leg.entryIds.length === 0) {

          throw new Error(

            `Leg ${legIndex + 1} requires at least one Greyhound selection.`

          );

        }

        const entryIds = leg.entryIds.map((value) => {

          const entryId = Number(value);

          if (!Number.isInteger(entryId) || entryId <= 0) {

            throw new Error(

              `Leg ${legIndex + 1} contains an invalid entry ID.`

            );

          }

          return entryId;

        });

        const uniqueEntryIds = [...new Set(entryIds)];

        if (uniqueEntryIds.length !== entryIds.length) {

          throw new Error(

            `Leg ${legIndex + 1} contains duplicate Greyhound selections.`

          );

        }

        return {

          raceId,

          entryIds: uniqueEntryIds,

        };

      }

    );

    const raceIds = normalizedLegSelections.map(

      (leg) => leg.raceId

    );

    if (new Set(raceIds).size !== raceIds.length) {

      return jsonError(

        "Each Pick 4 or Pick 5 leg must reference a different race.",

        400

      );

    }

    const access = await requireLeagueMember(leagueId);

    if (String(access.league.leagueType) !== "greyhound") {

      return jsonError(

        "This endpoint is only available for Greyhound leagues.",

        400

      );

    }

    const admin = createSupabaseAdminClient();

    const requestedFantasyTeamId = body?.fantasyTeamId == null ? null : Number(body.fantasyTeamId);

    if (requestedFantasyTeamId !== null && (!Number.isInteger(requestedFantasyTeamId) || requestedFantasyTeamId <= 0)) return jsonError("fantasyTeamId must be a positive integer.", 400);

    const { data: ownTeamData, error: ownTeamError } = await admin.from("fantasy_teams").select("id").eq("league_id", leagueId).eq("owner_id", access.userId).eq("active", true).maybeSingle();

    if (ownTeamError) return jsonError(ownTeamError.message, 500);

    const ownFantasyTeamId = ownTeamData ? Number(ownTeamData.id) : null;

    const targetFantasyTeamId = requestedFantasyTeamId ?? ownFantasyTeamId;

    if (!targetFantasyTeamId) return jsonError("No active Greyhound team was found for this member.", 409);

    const placingForAnotherTeam = ownFantasyTeamId === null || targetFantasyTeamId !== ownFantasyTeamId;

    if (placingForAnotherTeam) {

      const { data: membership, error: membershipError } = await admin.from("league_members").select("role").eq("league_id", leagueId).eq("user_id", access.userId).maybeSingle();

      if (membershipError) return jsonError(membershipError.message, 500);

      if (String(membership?.role ?? "").toLowerCase() !== "commissioner") return jsonError("Only the league commissioner can place a wager for another team.", 403);

      const { data: targetTeam, error: targetTeamError } = await admin.from("fantasy_teams").select("id").eq("id", targetFantasyTeamId).eq("league_id", leagueId).eq("active", true).maybeSingle();

      if (targetTeamError) return jsonError(targetTeamError.message, 500);

      if (!targetTeam) return jsonError("The selected Greyhound team is not active in this league.", 404);

    }

    /*

     * Load the official imported pool before placement.

     *

     * The database placement function remains authoritative, but

     * validating the pool here gives the UI clean errors and prevents

     * malformed requests from reaching the RPC.

     */

    const {

      data: pool,

      error: poolError,

    } = await admin

      .from("greyhound_multi_race_pools")

      .select(`

        id,

        card_id,

        start_race_id,

        wager_type,

        leg_count,

        denomination,

        pool_status

      `)

      .eq("id", poolId)

      .maybeSingle();

    if (poolError) {

      return jsonError(poolError.message, 500);

    }

    if (!pool) {

      return jsonError(

        "Pick 4 or Pick 5 pool was not found.",

        404

      );

    }

    const wagerType = String(

      pool.wager_type ?? ""

    )

      .trim()

      .toLowerCase();

    if (wagerType !== "pick4" && wagerType !== "pick5") {

      return jsonError(

        "The selected pool is not a Pick 4 or Pick 5 pool.",

        400

      );

    }

    const legCount = Number(pool.leg_count);

    if (

      (wagerType === "pick4" && legCount !== 4) ||

      (wagerType === "pick5" && legCount !== 5)

    ) {

      return jsonError(

        "The multi-race pool has an invalid leg configuration.",

        409

      );

    }

    if (normalizedLegSelections.length !== legCount) {

      return jsonError(

        `${wagerType === "pick4" ? "Pick 4" : "Pick 5"} requires exactly ${legCount} race legs.`,

        400

      );

    }

    const poolStatus = String(

      pool.pool_status ?? ""

    )

      .trim()

      .toLowerCase();

    if (poolStatus !== "open") {

      return jsonError(

        "This Pick 4 or Pick 5 pool is not open for wagering.",

        409

      );

    }

    const minimumDenomination = Number(

      pool.denomination ?? 0.25

    );

    if (

      Number.isFinite(minimumDenomination) &&

      denomination < minimumDenomination

    ) {

      return jsonError(

        `This pool has a minimum denomination of $${minimumDenomination.toFixed(2)}.`,

        400

      );

    }

    /*

     * Verify the submitted races exactly match the official imported

     * pool legs.

     */

    const {

      data: officialLegs,

      error: officialLegsError,

    } = await admin

      .from("greyhound_multi_race_pool_legs")

      .select(`

        leg_number,

        race_id

      `)

      .eq("pool_id", poolId)

      .order("leg_number", {

        ascending: true,

      });

    if (officialLegsError) {

      return jsonError(

        officialLegsError.message,

        500

      );

    }

    if (!officialLegs || officialLegs.length !== legCount) {

      return jsonError(

        "The official Pick 4 or Pick 5 pool legs are incomplete.",

        409

      );

    }

    for (let index = 0; index < officialLegs.length; index += 1) {

      const officialLeg = officialLegs[index];

      const submittedLeg = normalizedLegSelections[index];

      const officialLegNumber = Number(

        officialLeg.leg_number

      );

      const officialRaceId = Number(

        officialLeg.race_id

      );

      if (officialLegNumber !== index + 1) {

        return jsonError(

          "The official Pick 4 or Pick 5 leg sequence is invalid.",

          409

        );

      }

      if (submittedLeg.raceId !== officialRaceId) {

        return jsonError(

          `Leg ${index + 1} does not match the official race for this pool.`,

          400

        );

      }

    }

    /*

     * Calculate a preview total for the response.

     *

     * The database independently recalculates this and remains

     * authoritative for the actual charge.

     */

    let combinationCount = 1;

    for (const leg of normalizedLegSelections) {

      combinationCount *= leg.entryIds.length;

      if (

        !Number.isSafeInteger(combinationCount) ||

        combinationCount <= 0

      ) {

        return jsonError(

          "This Pick 4 or Pick 5 ticket contains too many combinations.",

          400

        );

      }

    }

    const totalCost = roundMoney(

      combinationCount * denomination

    );

    /*

     * The RPC performs the authoritative checks:

     *

     * - authenticated member ownership

     * - league / track scope

     * - official pool

     * - official legs

     * - active entries

     * - Whole Card or Live Bankroll lock

     * - available bankroll

     * - combination count

     * - final ticket cost

     * - atomic bankroll deduction

     * - Live Bankroll requirement synchronization

     */

    const { data: wageringSettings, error: wageringSettingsError } = await admin.from("greyhound_league_settings").select("wagering_style").eq("league_id", leagueId).order("id", { ascending: true }).limit(1).maybeSingle();
    if (wageringSettingsError) return jsonError(wageringSettingsError.message, 500);
    const wageringStyle = String(wageringSettings?.wagering_style ?? "whole_card").trim().toLowerCase();
    if (wageringStyle !== "whole_card" && wageringStyle !== "live_bankroll") return jsonError(`Unsupported Greyhound wagering style: ${wageringStyle}.`, 500);
    if (wageringStyle === "live_bankroll") {
      const startRaceId = Number(pool.start_race_id);
      const { data: startRace, error: startRaceError } = await admin.from("greyhound_races").select("id, card_id, race_number").eq("id", startRaceId).maybeSingle();
      if (startRaceError) return jsonError(startRaceError.message, 500);
      if (!startRace || Number(startRace.card_id) !== Number(pool.card_id)) return jsonError("The Pick 4 or Pick 5 start race is invalid.", 409);
      const { data: startCard, error: startCardError } = await admin.from("greyhound_cards").select("id, race_date, track_id").eq("id", Number(pool.card_id)).maybeSingle();
      if (startCardError) return jsonError(startCardError.message, 500);
      if (!startCard) return jsonError("Greyhound racing card was not found.", 404);
      const { data: trackData, error: trackError } = await admin.from("greyhound_tracks").select("code").eq("id", Number(startCard.track_id)).maybeSingle();
      if (trackError) return jsonError(trackError.message, 500);
      if (!trackData) return jsonError("Greyhound track was not found.", 404);
      try {
        await enforceLiveBankrollMtp({
          wageringStyle,
          trackCode: String(trackData.code ?? ""),
          raceDate: String(startCard.race_date ?? ""),
          raceNumber: Number(startRace.race_number),
        });
      } catch (error) {
        return jsonError(error instanceof Error ? error.message : "Unable to verify AmTote minutes to post.", 409);
      }
    }

    const { data, error } = placingForAnotherTeam

      ? await admin.rpc("commissioner_place_greyhound_multi_race_wager", {

          p_league_id: leagueId, p_commissioner_user_id: access.userId, p_fantasy_team_id: targetFantasyTeamId,

          p_pool_id: poolId, p_denomination: denomination, p_leg_selections: normalizedLegSelections,

        })

      : await admin.rpc("place_greyhound_multi_race_wager", {

          p_league_id: leagueId, p_user_id: access.userId, p_pool_id: poolId,

          p_denomination: denomination, p_leg_selections: normalizedLegSelections,

        });

    if (error) {

      const message =

        error.message ??

        "Unable to place Pick 4 or Pick 5 wager.";

      const lower = message.toLowerCase();

      const status =

        lower.includes("insufficient bankroll") ||

        lower.includes("closed") ||

        lower.includes("locked") ||

        lower.includes("post time") ||

        lower.includes("not open") ||

        lower.includes("not currently open") ||

        lower.includes("already started") ||

        lower.includes("live bankroll") ||

        lower.includes("busted") ||

        lower.includes("inactive") ||

        lower.includes("cancelled") ||

        lower.includes("pool status")

          ? 409

          : 400;

      return jsonError(

        message,

        status

      );

    }

    return NextResponse.json(

      {

        success: true,

        wager: data,

        preview: {

          wagerType,

          legCount,

          combinationCount,

          denomination,

          totalCost,

        },

      },

      {

        headers: {

          "Cache-Control": "no-store, max-age=0",

        },

      }

    );

  } catch (error) {

    console.error(

      "Greyhound multi-race wager placement failed:",

      error

    );

    return jsonError(

      error instanceof Error

        ? error.message

        : "Unable to place Pick 4 or Pick 5 wager.",

      500

    );

  }

}
