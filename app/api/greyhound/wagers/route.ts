import { NextResponse } from "next/server";

import { requireLeagueMember } from "@/lib/leagues/requireLeagueMember";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type WagerType =
  | "win"
  | "place"
  | "show"
  | "exacta"
  | "quinella"
  | "trifecta"
  | "superfecta";

type WagerStructure =
  | "straight"
  | "key"
  | "box";

type RequestBody = {
  leagueId?: string;
  raceId?: number;
  wagerType?: string;
  wagerStructure?: string;
  denomination?: number;
  combinationJson?: number[][];
  alternate1EntryId?: number | null;
  alternate2EntryId?: number | null;
};

const ALLOWED_WAGER_TYPES = new Set<WagerType>([
  "win",
  "place",
  "show",
  "exacta",
  "quinella",
  "trifecta",
  "superfecta",
]);

const ALLOWED_STRUCTURES = new Set<WagerStructure>([
  "straight",
  "key",
  "box",
]);

const REQUIRED_LEGS: Record<WagerType, number> = {
  win: 1,
  place: 1,
  show: 1,
  exacta: 2,
  quinella: 2,
  trifecta: 3,
  superfecta: 4,
};

const MINIMUM_DENOMINATION: Record<WagerType, number> = {
  win: 2,
  place: 2,
  show: 2,
  exacta: 1,
  quinella: 1,
  trifecta: 0.5,
  superfecta: 0.1,
};

function jsonError(
  error: string,
  status: number
) {
  return NextResponse.json(
    {
      success: false,
      error,
    },
    {
      status,
      headers: {
        "Cache-Control":
          "no-store, max-age=0",
      },
    }
  );
}

function roundMoney(
  value: number
) {
  return Math.round(
    (value + Number.EPSILON) *
      100
  ) / 100;
}

function normalizeOptionalEntryId(
  value:
    | number
    | null
    | undefined
) {
  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  const id = Number(
    value
  );

  if (
    !Number.isInteger(id) ||
    id <= 0
  ) {
    throw new Error(
      "Alternate entry IDs must be valid positive integers."
    );
  }

  return id;
}

export async function POST(
  request: Request
) {
  try {
    const body =
      (await request
        .json()
        .catch(() => null)) as
        | RequestBody
        | null;

    const leagueId =
      typeof body?.leagueId ===
      "string"
        ? body.leagueId.trim()
        : "";

    const raceId = Number(
      body?.raceId
    );

    const rawWagerType =
      typeof body?.wagerType ===
      "string"
        ? body.wagerType
            .trim()
            .toLowerCase()
        : "";

    const rawWagerStructure =
      typeof body?.wagerStructure ===
      "string"
        ? body.wagerStructure
            .trim()
            .toLowerCase()
        : "";

    const denomination =
      roundMoney(
        Number(
          body?.denomination
        )
      );

    if (!leagueId) {
      return jsonError(
        "leagueId is required.",
        400
      );
    }

    if (
      !Number.isInteger(
        raceId
      ) ||
      raceId <= 0
    ) {
      return jsonError(
        "A valid raceId is required.",
        400
      );
    }

    if (
      rawWagerType ===
      "perfecta"
    ) {
      return jsonError(
        "Perfecta wagering is not supported.",
        400
      );
    }

    if (
      !ALLOWED_WAGER_TYPES.has(
        rawWagerType as WagerType
      )
    ) {
      return jsonError(
        "Invalid Greyhound wager type.",
        400
      );
    }

    if (
      !ALLOWED_STRUCTURES.has(
        rawWagerStructure as WagerStructure
      )
    ) {
      return jsonError(
        "Invalid Greyhound wager structure.",
        400
      );
    }

    const wagerType =
      rawWagerType as WagerType;

    const wagerStructure =
      rawWagerStructure as WagerStructure;

    if (
      !Number.isFinite(
        denomination
      ) ||
      denomination <= 0
    ) {
      return jsonError(
        "A positive denomination is required.",
        400
      );
    }

    const minimum =
      MINIMUM_DENOMINATION[
        wagerType
      ];

    if (
      denomination <
      minimum
    ) {
      return jsonError(
        `${wagerType
          .replaceAll(
            "_",
            " "
          )
          .toUpperCase()} has a minimum wager of $${minimum.toFixed(
          2
        )}.`,
        400
      );
    }

    if (
      !Array.isArray(
        body?.combinationJson
      ) ||
      body.combinationJson
        .length === 0
    ) {
      return jsonError(
        "At least one wager combination is required.",
        400
      );
    }

    const requiredLegs =
      REQUIRED_LEGS[
        wagerType
      ];

    const combinationJson =
      body.combinationJson.map(
        (
          combo,
          comboIndex
        ) => {
          if (
            !Array.isArray(
              combo
            )
          ) {
            throw new Error(
              `Combination ${
                comboIndex + 1
              } is invalid.`
            );
          }

          if (
            combo.length !==
            requiredLegs
          ) {
            throw new Error(
              `${wagerType.toUpperCase()} requires exactly ${requiredLegs} runner${
                requiredLegs === 1
                  ? ""
                  : "s"
              } per combination.`
            );
          }

          const normalized =
            combo.map(
              (
                value
              ) => {
                const id =
                  Number(
                    value
                  );

                if (
                  !Number.isInteger(
                    id
                  ) ||
                  id <= 0
                ) {
                  throw new Error(
                    "Wager combinations contain an invalid entry ID."
                  );
                }

                return id;
              }
            );

          if (
            new Set(
              normalized
            ).size !==
            normalized.length
          ) {
            throw new Error(
              "The same Greyhound cannot occupy multiple finishing positions in one combination."
            );
          }

          return normalized;
        }
      );

    /*
     * Remove duplicate generated combinations.
     *
     * A box/key UI can theoretically produce duplicates if
     * state is clicked rapidly or rebuilt. We reject them
     * instead of charging the member twice.
     */
    const uniqueKeys =
      new Set<string>();

    for (
      const combo of combinationJson
    ) {
      /*
       * Quinella is unordered.
       *
       * 1-2 and 2-1 represent the same wager.
       */
      const key =
        wagerType ===
        "quinella"
          ? [...combo]
              .sort(
                (a, b) =>
                  a - b
              )
              .join("-")
          : combo.join(
              "-"
            );

      if (
        uniqueKeys.has(
          key
        )
      ) {
        return jsonError(
          "Duplicate wager combinations are not allowed.",
          400
        );
      }

      uniqueKeys.add(
        key
      );
    }

    /*
     * Win, Place and Show are single-runner wagers.
     * There is no meaningful Key or Box version.
     */
    if (
      (
        wagerType ===
          "win" ||
        wagerType ===
          "place" ||
        wagerType ===
          "show"
      ) &&
      wagerStructure !==
        "straight"
    ) {
      return jsonError(
        `${wagerType.toUpperCase()} wagers must use the straight structure.`,
        400
      );
    }

    const alternate1EntryId =
      normalizeOptionalEntryId(
        body?.alternate1EntryId
      );

    const alternate2EntryId =
      normalizeOptionalEntryId(
        body?.alternate2EntryId
      );

    if (
      alternate1EntryId !==
        null &&
      alternate2EntryId !==
        null &&
      alternate1EntryId ===
        alternate2EntryId
    ) {
      return jsonError(
        "Alternate Greyhounds must be different runners.",
        400
      );
    }

    const access =
      await requireLeagueMember(
        leagueId
      );

    if (
      String(
        access.league
          .leagueType
      ) !== "greyhound"
    ) {
      return jsonError(
        "This endpoint is only available for Greyhound leagues.",
        400
      );
    }

    const admin =
      createSupabaseAdminClient();

    /*
     * ==========================================================
     * G365 WHOLE-CARD WAGER LOCK
     * ==========================================================
     *
     * Wheeling and Tri-State use the same rule:
     *
     *   The ENTIRE racing card locks 5 minutes before Race 1.
     *
     * Once the card is locked, no wagers may be submitted for
     * any later race on that card.
     *
     * This server-side check is intentionally performed again
     * immediately before the wager RPC so a stale browser cannot
     * bypass the card lock.
     * ==========================================================
     */

    const {
      data: raceLockData,
      error: raceLockError,
    } = await admin
      .from(
        "greyhound_races"
      )
      .select(
        "id, card_id, race_status"
      )
      .eq(
        "id",
        raceId
      )
      .maybeSingle();

    if (raceLockError) {
      return jsonError(
        raceLockError.message,
        500
      );
    }

    if (!raceLockData) {
      return jsonError(
        "Greyhound race was not found.",
        404
      );
    }

    const cardId =
      Number(
        raceLockData.card_id
      );

    const {
      data: cardLockData,
      error: cardLockError,
    } = await admin
      .from(
        "greyhound_cards"
      )
      .select(`
        id,
        card_status,
        scheduled_first_post,
        lock_at,
        commissioner_confirmed_at
      `)
      .eq(
        "id",
        cardId
      )
      .maybeSingle();

    if (cardLockError) {
      return jsonError(
        cardLockError.message,
        500
      );
    }

    if (!cardLockData) {
      return jsonError(
        "Greyhound racing card was not found.",
        404
      );
    }

    /*
     * Official AmTote cards are auto-confirmed after a clean import.
     * Manual / backup cards must still be confirmed through the
     * commissioner workflow.
     */
    if (
      !cardLockData
        .commissioner_confirmed_at
    ) {
      return jsonError(
        "This Greyhound card is not open for wagering yet.",
        409
      );
    }

    const cardStatus =
      String(
        cardLockData
          .card_status ??
        ""
      )
        .trim()
        .toLowerCase();

    const nowMs =
      Date.now();

    const persistedLockAtMs =
      cardLockData.lock_at
        ? new Date(
            cardLockData
              .lock_at
          ).getTime()
        : null;

    /*
     * Safety fallback:
     *
     * If lock_at has not been written yet but a first-post timestamp
     * exists, independently calculate the same whole-card cutoff:
     *
     *     Race 1 post time - 5 minutes
     */
    const firstPostMs =
      cardLockData
        .scheduled_first_post
        ? new Date(
            cardLockData
              .scheduled_first_post
          ).getTime()
        : null;

    const calculatedLockAtMs =
      firstPostMs !== null &&
      Number.isFinite(
        firstPostMs
      )
        ? firstPostMs -
          5 * 60 * 1000
        : null;

    const persistedLockReached =
      persistedLockAtMs !==
        null &&
      Number.isFinite(
        persistedLockAtMs
      ) &&
      persistedLockAtMs <=
        nowMs;

    const calculatedLockReached =
      calculatedLockAtMs !==
        null &&
      calculatedLockAtMs <=
        nowMs;

    const terminalOrLocked =
      [
        "locked",
        "in_progress",
        "final",
        "cancelled",
      ].includes(
        cardStatus
      );

    if (
      terminalOrLocked ||
      persistedLockReached ||
      calculatedLockReached
    ) {
      return jsonError(
        "Wagering is closed for this Greyhound card. The entire card locks 5 minutes before Race 1.",
        409
      );
    }

    const raceStatus =
      String(
        raceLockData
          .race_status ??
        ""
      )
        .trim()
        .toLowerCase();

    if (
      ![
        "scheduled",
        "upcoming",
      ].includes(
        raceStatus
      )
    ) {
      return jsonError(
        "Wagering is closed for this Greyhound race.",
        409
      );
    }

    const {
      data,
      error,
    } = await admin.rpc(
      "place_greyhound_wager",
      {
        p_league_id:
          leagueId,

        p_user_id:
          access.userId,

        p_race_id:
          raceId,

        p_wager_type:
          wagerType,

        p_wager_structure:
          wagerStructure,

        p_denomination:
          denomination,

        p_combination_json:
          combinationJson,

        p_alternate_1_entry_id:
          alternate1EntryId,

        p_alternate_2_entry_id:
          alternate2EntryId,
      }
    );

    if (error) {
      const message =
        error.message ??
        "Unable to place Greyhound wager.";

      const lower =
        message.toLowerCase();

      const status =
        lower.includes(
          "insufficient bankroll"
        ) ||
        lower.includes(
          "closed"
        ) ||
        lower.includes(
          "locked"
        ) ||
        lower.includes(
          "post time"
        ) ||
        lower.includes(
          "scratched"
        ) ||
        lower.includes(
          "inactive"
        ) ||
        lower.includes(
          "disabled"
        ) ||
        lower.includes(
          "already started"
        )
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
      },
      {
        headers: {
          "Cache-Control":
            "no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    console.error(
      "Greyhound wager placement failed:",
      error
    );

    return jsonError(
      error instanceof Error
        ? error.message
        : "Unable to place Greyhound wager.",
      500
    );
  }
}