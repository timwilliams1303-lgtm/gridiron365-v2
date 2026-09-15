import {
  NextResponse,
} from "next/server";

import {
  createClient,
} from "@supabase/supabase-js";

import {
  requireLeagueMember,
} from "@/lib/leagues/requireLeagueMember";

import {
  createSupabaseServerClient,
} from "@/lib/supabase/server";


type RunnerPayload = {
  trapNumber?: number | string | null;
  trapColor?: string | null;
  name?: string | null;
  kennel?: string | null;
  trainer?: string | null;
  weight?: number | string | null;
  form?: string | null;
  odds?: string | null;
};


type RacePayload = {
  track?: string | null;
  raceNumber?: number | string | null;
  raceDate?: string | null;
  raceTime?: string | null;
  cardFirstPostTime?: string | null;
  grade?: string | null;
  distance?: string | number | null;
  prizeMoney?: string | number | null;
  weather?: string | null;
  trackCondition?: string | null;
  session?: string | null;
  runners?: RunnerPayload[] | null;
};


type ImportRequest = {
  leagueId?: string;
  action?: "import_race" | "finalize_card";
  race?: RacePayload;
  cardId?: number | string | null;
  track?: string | null;
  raceDate?: string | null;
  session?: string | null;
};


type DeleteCardRequest = {
  leagueId?: string;
  cardId?: number | string | null;
  track?: string | null;
  raceDate?: string | null;
  session?: string | null;
};


function errorResponse(
  message: string,
  status = 400
) {
  return NextResponse.json(
    {
      success: false,
      error: message,
    },
    {
      status,
    }
  );
}


function cleanText(
  value: unknown
): string | null {
  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  const text =
    String(value).trim();

  return text.length > 0
    ? text
    : null;
}


function parsePositiveInteger(
  value: unknown
): number | null {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const parsed =
    Number.parseInt(
      String(value),
      10
    );

  if (
    !Number.isFinite(parsed) ||
    parsed <= 0
  ) {
    return null;
  }

  return parsed;
}


function normalizeTrackCode(
  track: unknown
):
  | "GWD"
  | "GTS"
  | null {
  const normalized =
    String(
      track ?? ""
    )
      .trim()
      .toLowerCase()
      .replace(
        /[^a-z0-9]+/g,
        " "
      )
      .trim();


  if (
    normalized === "gwd" ||
    normalized === "wheeling" ||
    normalized ===
      "wheeling island" ||
    normalized ===
      "wheeling island greyhound" ||
    normalized ===
      "wheeling island greyhound racing"
  ) {
    return "GWD";
  }


  if (
    normalized === "gts" ||
    normalized ===
      "tri state" ||
    normalized ===
      "tristate" ||
    normalized ===
      "tri state greyhound" ||
    normalized ===
      "tri state greyhound racing"
  ) {
    return "GTS";
  }


  return null;
}


function normalizeSession(
  race: RacePayload
): string {
  const explicit =
    cleanText(
      race.session
    )?.toLowerCase();

  if (
    explicit === "morning" ||
    explicit === "afternoon" ||
    explicit === "evening" ||
    explicit === "night"
  ) {
    return explicit;
  }

  /*
   * Session is based on the CARD'S FIRST POST time, not the
   * clock time of each individual race.
   *
   * Examples:
   *   13:00 first post -> afternoon
   *   18:00 first post -> evening
   */
  const firstPostTime =
    cleanText(
      race.cardFirstPostTime
    );

  if (firstPostTime) {
    const match =
      firstPostTime.match(
        /^(\d{1,2}):(\d{2})/
      );

    if (match) {
      const hour =
        Number(match[1]);

      if (Number.isFinite(hour)) {
        if (hour < 12) {
          return "morning";
        }

        if (hour >= 17) {
          return "evening";
        }

        return "afternoon";
      }
    }
  }

  /*
   * Compatibility fallback only when the caller did not send
   * a first-post value. Do not use race.raceTime here because
   * later races must never change the card's session.
   */
  const trackCode =
    normalizeTrackCode(
      race.track
    );

  if (trackCode === "GTS") {
    return "evening";
  }

  return "afternoon";
}



function createSupabaseAdminClient() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.SUPABASE_URL;

  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Supabase admin environment variables are not configured."
    );
  }

  return createClient(
    supabaseUrl,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}


function normalizeDeleteSession(
  value: unknown
): string {
  const session =
    cleanText(value)?.toLowerCase();

  if (
    session === "morning" ||
    session === "afternoon" ||
    session === "evening" ||
    session === "night"
  ) {
    return session;
  }

  return "afternoon";
}


async function countRowsByRaceIds(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  table: string,
  raceIds: number[]
): Promise<number> {
  if (raceIds.length === 0) {
    return 0;
  }

  const {
    count,
    error,
  } = await supabase
    .from(table)
    .select("id", {
      count: "exact",
      head: true,
    })
    .in(
      "race_id",
      raceIds
    );

  if (error) {
    throw new Error(
      `Unable to check ${table}: ${error.message}`
    );
  }

  return count ?? 0;
}


type FinalizeCardResult = {
  success: boolean;
  confirmed: boolean;
  cardId: number;
  trackCode: "GWD" | "GTS";
  expectedRaceCount: number;
  savedRaceCount: number;
  savedEntryCount: number;
  message: string;
};

async function finalizeGreyhoundCard(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  params: {
    cardId: number;
    trackCode: "GWD" | "GTS";
    commissionerUserId: string;
  }
): Promise<FinalizeCardResult> {
  const {
    cardId,
    trackCode,
    commissionerUserId,
  } = params;

  const {
    data: card,
    error: cardError,
  } = await admin
    .from("greyhound_cards")
    .select("id, total_races, scheduled_first_post, lock_at")
    .eq("id", cardId)
    .maybeSingle();

  if (cardError) {
    throw new Error(
      `Unable to inspect the Greyhound card: ${cardError.message}`
    );
  }

  if (!card) {
    throw new Error(
      "The Greyhound card could not be found for final confirmation."
    );
  }

  const {
    data: raceRows,
    error: racesError,
  } = await admin
    .from("greyhound_races")
    .select(
      "id, race_number, grade, distance_yards, scheduled_post_time"
    )
    .eq("card_id", cardId)
    .order("race_number", {
      ascending: true,
    });

  if (racesError) {
    throw new Error(
      `Unable to inspect the Greyhound races: ${racesError.message}`
    );
  }

  const races = raceRows ?? [];

  const expectedRaceCount =
    trackCode === "GTS"
      ? 14
      : Number(card.total_races ?? 0);

  const raceIds =
    races
      .map((row) => Number(row.id))
      .filter(
        (id) =>
          Number.isFinite(id) &&
          id > 0
      );

  const raceNumbers =
    races.map((row) =>
      Number(row.race_number)
    );

  const hasCompleteRaceSet =
    expectedRaceCount > 0 &&
    races.length === expectedRaceCount &&
    raceNumbers.every(
      (raceNo, index) =>
        raceNo === index + 1
    );

  const allProgramFieldsPresent =
    races.every(
      (row) =>
        cleanText(row.grade) !== null &&
        Number(row.distance_yards) > 0 &&
        cleanText(row.scheduled_post_time) !== null
    );

  let entryRows: Array<{
    race_id: number | string | null;
    box_number: number | string | null;
    dog_id: number | string | null;
  }> = [];

  if (raceIds.length > 0) {
    const {
      data: entries,
      error: entriesError,
    } = await admin
      .from("greyhound_entries")
      .select("race_id, box_number, dog_id")
      .in("race_id", raceIds);

    if (entriesError) {
      throw new Error(
        `Unable to inspect Greyhound entries: ${entriesError.message}`
      );
    }

    entryRows = entries ?? [];
  }

  /*
   * SAME RULE FOR BOTH TRACKS:
   * official vacancies are absent entry rows, never fake dogs.
   */
  const hasCompleteEntries =
    hasCompleteRaceSet &&
    raceIds.length === expectedRaceCount &&
    entryRows.length > 0 &&
    raceIds.every((raceId) => {
      const raceEntries =
        entryRows.filter(
          (entry) =>
            Number(entry.race_id) === raceId
        );

      if (raceEntries.length === 0) {
        return false;
      }

      const boxes =
        raceEntries.map((entry) =>
          Number(entry.box_number)
        );

      return (
        boxes.every(
          (box) =>
            Number.isInteger(box) &&
            box >= 1 &&
            box <= 8
        ) &&
        new Set(boxes).size === boxes.length &&
        raceEntries.every(
          (entry) =>
            entry.dog_id !== null &&
            Number(entry.dog_id) > 0
        )
      );
    });

  if (
    !hasCompleteRaceSet ||
    !allProgramFieldsPresent ||
    !hasCompleteEntries
  ) {
    const problems: string[] = [];

    if (!hasCompleteRaceSet) {
      problems.push(
        `expected ${expectedRaceCount} sequential races but found ${races.length}`
      );
    }

    if (!allProgramFieldsPresent) {
      problems.push(
        "one or more races are missing grade, distance, or scheduled post time"
      );
    }

    if (!hasCompleteEntries) {
      problems.push(
        "one or more races have invalid or incomplete authoritative entry assignments"
      );
    }

    return {
      success: false,
      confirmed: false,
      cardId,
      trackCode,
      expectedRaceCount,
      savedRaceCount: races.length,
      savedEntryCount: entryRows.length,
      message:
        `Card is not ready for confirmation: ${problems.join("; ")}.`,
    };
  }

  const now =
    new Date().toISOString();

  /*
   * Whole-card wagering lock:
   * both GWD and GTS lock exactly 5 minutes before the card's FIRST post.
   * Recalculate it during explicit finalization so every future imported
   * card is published with a usable lock_at value.
   */
  const scheduledFirstPost =
    cleanText(card.scheduled_first_post);

  if (!scheduledFirstPost) {
    return {
      success: false,
      confirmed: false,
      cardId,
      trackCode,
      expectedRaceCount,
      savedRaceCount: races.length,
      savedEntryCount: entryRows.length,
      message:
        "Card is not ready for confirmation: scheduled_first_post is missing.",
    };
  }

  const firstPostDate =
    new Date(scheduledFirstPost);

  if (Number.isNaN(firstPostDate.getTime())) {
    return {
      success: false,
      confirmed: false,
      cardId,
      trackCode,
      expectedRaceCount,
      savedRaceCount: races.length,
      savedEntryCount: entryRows.length,
      message:
        "Card is not ready for confirmation: scheduled_first_post is invalid.",
    };
  }

  const lockAt =
    new Date(
      firstPostDate.getTime() - 5 * 60 * 1000
    ).toISOString();

  const {
    error: updateError,
  } = await admin
    .from("greyhound_cards")
    .update({
      lock_at: lockAt,
      commissioner_confirmed_at: now,
      commissioner_confirmed_by:
        commissionerUserId,
      updated_at: now,
    })
    .eq("id", cardId);

  if (updateError) {
    throw new Error(
      `The completed ${trackCode === "GTS" ? "Tri-State" : "Wheeling"} card could not be commissioner-confirmed: ${updateError.message}`
    );
  }

  return {
    success: true,
    confirmed: true,
    cardId,
    trackCode,
    expectedRaceCount,
    savedRaceCount: races.length,
    savedEntryCount: entryRows.length,
    message:
      `${trackCode === "GTS" ? "Tri-State" : "Wheeling"} card confirmed and published successfully.`,
  };
}


export async function GET(
  request: Request
) {
  try {
    const url =
      new URL(request.url);

    const leagueId =
      cleanText(
        url.searchParams.get("leagueId")
      );

    if (!leagueId) {
      return errorResponse(
        "leagueId is required."
      );
    }

    const access =
      await requireLeagueMember(
        leagueId
      );

    if (
      String(access.league.leagueType) !==
      "greyhound"
    ) {
      return errorResponse(
        "This endpoint is only available for Greyhound leagues.",
        400
      );
    }

    if (!access.isCommissioner) {
      return errorResponse(
        "Commissioner access is required.",
        403
      );
    }

    const admin =
      createSupabaseAdminClient();

    /*
     * Cards are global track/date/session racing objects rather than
     * league-owned rows. The commissioner page therefore shows published
     * official cards from the supported G365 tracks. This is the same
     * publication gate used by the wagering workspace.
     */
    const {
      data: cards,
      error: cardsError,
    } =
      await admin
        .from("greyhound_cards")
        .select(
          `
            id,
            track_id,
            race_date,
            session,
            scheduled_first_post,
            lock_at,
            card_status,
            source,
            import_status,
            total_races,
            commissioner_confirmed_at,
            commissioner_confirmed_by,
            greyhound_tracks!inner (
              id,
              code,
              name
            )
          `
        )
        .not(
          "commissioner_confirmed_at",
          "is",
          null
        )
        .in(
          "greyhound_tracks.code",
          ["GWD", "GTS"]
        )
        .order(
          "race_date",
          {
            ascending: false,
          }
        )
        .order(
          "scheduled_first_post",
          {
            ascending: true,
          }
        )
        .limit(40);

    if (cardsError) {
      console.error(
        "[G365 GREYHOUND CONFIRMED CARDS GET]",
        cardsError
      );

      return errorResponse(
        `Unable to load confirmed Greyhound cards: ${cardsError.message}`,
        500
      );
    }

    const cardIds =
      (cards ?? [])
        .map((card) =>
          Number(card.id)
        )
        .filter((id) =>
          Number.isFinite(id) &&
          id > 0
        );

    const raceCountByCard =
      new Map<number, number>();

    const entryCountByCard =
      new Map<number, number>();

    if (cardIds.length > 0) {
      const {
        data: races,
        error: racesError,
      } =
        await admin
          .from("greyhound_races")
          .select("id, card_id")
          .in(
            "card_id",
            cardIds
          );

      if (racesError) {
        return errorResponse(
          `Unable to count confirmed Greyhound races: ${racesError.message}`,
          500
        );
      }

      const raceToCard =
        new Map<number, number>();

      const raceIds: number[] =
        [];

      for (const race of races ?? []) {
        const raceId =
          Number(race.id);
        const cardId =
          Number(race.card_id);

        if (
          !Number.isFinite(raceId) ||
          !Number.isFinite(cardId)
        ) {
          continue;
        }

        raceIds.push(raceId);
        raceToCard.set(
          raceId,
          cardId
        );
        raceCountByCard.set(
          cardId,
          (raceCountByCard.get(cardId) ?? 0) + 1
        );
      }

      if (raceIds.length > 0) {
        const {
          data: entries,
          error: entriesError,
        } =
          await admin
            .from("greyhound_entries")
            .select("race_id")
            .in(
              "race_id",
              raceIds
            );

        if (entriesError) {
          return errorResponse(
            `Unable to count confirmed Greyhound entries: ${entriesError.message}`,
            500
          );
        }

        for (const entry of entries ?? []) {
          const cardId =
            raceToCard.get(
              Number(entry.race_id)
            );

          if (!cardId) {
            continue;
          }

          entryCountByCard.set(
            cardId,
            (entryCountByCard.get(cardId) ?? 0) + 1
          );
        }
      }
    }

    const confirmedCards =
      (cards ?? []).map((card) => {
        const trackRelation =
          (
            card as {
              greyhound_tracks?:
                | {
                    id?: number | null;
                    code?: string | null;
                    name?: string | null;
                  }
                | Array<{
                    id?: number | null;
                    code?: string | null;
                    name?: string | null;
                  }>;
            }
          ).greyhound_tracks;

        const track =
          Array.isArray(trackRelation)
            ? trackRelation[0] ?? null
            : trackRelation ?? null;

        const cardId =
          Number(card.id);

        return {
          id: cardId,
          trackId:
            Number(card.track_id),
          trackCode:
            cleanText(track?.code),
          trackName:
            cleanText(track?.name),
          raceDate:
            card.race_date,
          session:
            card.session,
          scheduledFirstPost:
            card.scheduled_first_post,
          lockAt:
            card.lock_at,
          cardStatus:
            card.card_status,
          source:
            card.source,
          importStatus:
            card.import_status,
          totalRaces:
            Number(card.total_races ?? 0),
          raceCount:
            raceCountByCard.get(cardId) ?? 0,
          entryCount:
            entryCountByCard.get(cardId) ?? 0,
          commissionerConfirmedAt:
            card.commissioner_confirmed_at,
          commissionerConfirmedBy:
            card.commissioner_confirmed_by,
        };
      });

    return NextResponse.json({
      success: true,
      leagueId,
      cards:
        confirmedCards,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown confirmed Greyhound cards error.";

    console.error(
      "[G365 GREYHOUND CONFIRMED CARDS GET]",
      error
    );

    return errorResponse(
      message,
      500
    );
  }
}


export async function DELETE(
  request: Request
) {
  try {
    const body =
      (await request.json()) as
        DeleteCardRequest;

    const leagueId =
      cleanText(
        body.leagueId
      );

    if (!leagueId) {
      return errorResponse(
        "leagueId is required."
      );
    }

    /*
     * The destructive operation is commissioner-only.
     * requireLeagueMember is intentionally run before
     * the service-role client is created/used.
     */
    const access =
      await requireLeagueMember(
        leagueId
      );

    if (
      String(access.league.leagueType) !== "greyhound"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "This endpoint is only available for Greyhound leagues.",
        },
        {
          status: 400,
        }
      );
    }

    if (!access.isCommissioner) {
      return errorResponse(
        "Commissioner access is required.",
        403
      );
    }

    const admin =
      createSupabaseAdminClient();

    const requestedCardId =
      parsePositiveInteger(
        body.cardId
      );

    const raceDate =
      cleanText(
        body.raceDate
      );

    const session =
      normalizeDeleteSession(
        body.session
      );

    const trackCode =
      normalizeTrackCode(
        body.track
      );

    let cardQuery =
      admin
        .from("greyhound_cards")
        .select(
          `
            id,
            track_id,
            race_date,
            session,
            greyhound_tracks!inner (
              id,
              code,
              name
            )
          `
        )
        .limit(1);

    if (requestedCardId) {
      cardQuery =
        cardQuery.eq(
          "id",
          requestedCardId
        );
    } else {
      if (!trackCode) {
        return errorResponse(
          "A valid track or cardId is required."
        );
      }

      if (
        !raceDate ||
        !/^\\d{4}-\\d{2}-\\d{2}$/.test(
          raceDate
        )
      ) {
        return errorResponse(
          "raceDate must be in YYYY-MM-DD format."
        );
      }

      cardQuery =
        cardQuery
          .eq(
            "race_date",
            raceDate
          )
          .eq(
            "session",
            session
          )
          .eq(
            "greyhound_tracks.code",
            trackCode
          );
    }

    const {
      data: card,
      error: cardError,
    } =
      await cardQuery.maybeSingle();

    if (cardError) {
      console.error(
        "[G365 GREYHOUND DELETE CARD LOOKUP]",
        cardError
      );

      return errorResponse(
        `Unable to locate the Greyhound card: ${cardError.message}`,
        500
      );
    }

    if (!card) {
      return errorResponse(
        "No saved Greyhound card matched that track, date, and session.",
        404
      );
    }

    const cardId =
      Number(card.id);

    const {
      data: raceRows,
      error: raceError,
    } =
      await admin
        .from("greyhound_races")
        .select("id")
        .eq(
          "card_id",
          cardId
        );

    if (raceError) {
      return errorResponse(
        `Unable to inspect the Greyhound races: ${raceError.message}`,
        500
      );
    }

    const raceIds =
      (raceRows ?? [])
        .map((row) =>
          Number(row.id)
        )
        .filter((id) =>
          Number.isFinite(id)
        );

    /*
     * A card can be reset only while it is still an import/setup card.
     * We deliberately refuse to erase real competition/race activity.
     *
     * Rows such as entries and bankroll-card shells may safely cascade.
     * Dog program history is not linked to the card and is preserved.
     */
    const [
      wagerCount,
      raceResultCount,
      mutuelCount,
      survivorPickCount,
      scratchReplacementCount,
      dogResultCount,
    ] =
      await Promise.all([
        countRowsByRaceIds(
          admin,
          "greyhound_wagers",
          raceIds
        ),
        countRowsByRaceIds(
          admin,
          "greyhound_race_results",
          raceIds
        ),
        countRowsByRaceIds(
          admin,
          "greyhound_mutuel_payouts",
          raceIds
        ),
        countRowsByRaceIds(
          admin,
          "greyhound_daily_survivor_picks",
          raceIds
        ),
        countRowsByRaceIds(
          admin,
          "greyhound_scratch_replacements",
          raceIds
        ),
        countRowsByRaceIds(
          admin,
          "greyhound_dog_results",
          raceIds
        ),
      ]);

    const activity = {
      wagers: wagerCount,
      raceResults: raceResultCount,
      mutuelPayouts: mutuelCount,
      survivorPicks: survivorPickCount,
      scratchReplacements:
        scratchReplacementCount,
      dogResults: dogResultCount,
    };

    const activityTotal =
      Object.values(activity)
        .reduce(
          (sum, value) =>
            sum + value,
          0
        );

    if (activityTotal > 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            "This card already has race or competition activity and cannot be deleted with the re-import reset button.",
          cardId,
          activity,
        },
        {
          status: 409,
        }
      );
    }

    const {
      count: raceCount,
    } =
      await admin
        .from("greyhound_races")
        .select("id", {
          count: "exact",
          head: true,
        })
        .eq(
          "card_id",
          cardId
        );

    const {
      error: deleteError,
    } =
      await admin
        .from("greyhound_cards")
        .delete()
        .eq(
          "id",
          cardId
        );

    if (deleteError) {
      console.error(
        "[G365 GREYHOUND DELETE CARD]",
        deleteError
      );

      return errorResponse(
        `Greyhound card delete failed: ${deleteError.message}`,
        500
      );
    }

    return NextResponse.json({
      success: true,
      deleted: true,
      leagueId,
      cardId,
      trackCode:
        (
          card as {
            greyhound_tracks?:
              | {
                  code?: string | null;
                  name?: string | null;
                }
              | Array<{
                  code?: string | null;
                  name?: string | null;
                }>;
          }
        ).greyhound_tracks &&
        !Array.isArray(
          (
            card as {
              greyhound_tracks?: unknown;
            }
          ).greyhound_tracks
        )
          ? (
              card as {
                greyhound_tracks?: {
                  code?: string | null;
                };
              }
            ).greyhound_tracks?.code ??
            trackCode
          : trackCode,
      raceDate:
        card.race_date,
      session:
        card.session,
      racesDeleted:
        raceCount ?? raceIds.length,
      message:
        "Saved Greyhound card deleted. The parsed program can now be imported again.",
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown Greyhound card delete error.";

    console.error(
      "[G365 GREYHOUND DELETE CARD]",
      error
    );

    return errorResponse(
      message,
      500
    );
  }
}


export async function POST(
  request: Request
) {
  try {
    /*
     * ==========================================================
     * BODY
     * ==========================================================
     */
    const body =
      (await request.json()) as
        ImportRequest;


    const leagueId =
      cleanText(
        body.leagueId
      );


    const race =
      body.race;


    if (!leagueId) {
      return errorResponse(
        "leagueId is required."
      );
    }


    /*
     * ==========================================================
     * AUTHORIZATION
     * ==========================================================
     */
    const access =
      await requireLeagueMember(
        leagueId
      );


    if (String(access.league.leagueType) !== "greyhound") {
  return NextResponse.json(
    { error: "This endpoint is only available for Greyhound leagues." },
    { status: 400 },
  );
}

    if (
      !access.isCommissioner
    ) {
      return errorResponse(
        "Commissioner access is required.",
        403
      );
    }


    /*
     * ==========================================================
     * EXPLICIT CARD FINALIZATION
     * ==========================================================
     *
     * Save All calls this once AFTER every race, Program page and
     * Program-history row has been saved. The same finalization
     * behavior is used for GWD and GTS.
     */
    if (body.action === "finalize_card") {
      const requestedCardId =
        parsePositiveInteger(body.cardId);

      const requestedTrackCode =
        normalizeTrackCode(body.track);

      if (!requestedCardId) {
        return errorResponse(
          "A valid cardId is required to finalize a Greyhound card."
        );
      }

      if (!requestedTrackCode) {
        return errorResponse(
          "A valid GWD or GTS track is required to finalize a Greyhound card."
        );
      }

      const admin =
        createSupabaseAdminClient();

      const finalization =
        await finalizeGreyhoundCard(
          admin,
          {
            cardId: requestedCardId,
            trackCode: requestedTrackCode,
            commissionerUserId:
              access.userId,
          }
        );

      if (!finalization.success) {
        return NextResponse.json(
          finalization,
          {
            status: 409,
          }
        );
      }

      return NextResponse.json(
        finalization
      );
    }


    /*
     * Normal race imports require a race payload. Explicit card
     * finalization does not, so this validation must remain AFTER
     * the finalize_card branch above.
     */
    if (
      !race ||
      typeof race !== "object" ||
      Array.isArray(race)
    ) {
      return errorResponse(
        "A Greyhound race payload is required."
      );
    }


    /*
     * ==========================================================
     * TRACK
     * ==========================================================
     */
    const trackCode =
      normalizeTrackCode(
        race.track
      );


    if (!trackCode) {
      return errorResponse(
        `Unsupported Greyhound track: ${
          cleanText(
            race.track
          ) ?? "Unknown"
        }.`
      );
    }


    /*
     * ==========================================================
     * RACE VALIDATION
     * ==========================================================
     */
    const raceNumber =
      parsePositiveInteger(
        race.raceNumber
      );


    if (!raceNumber) {
      return errorResponse(
        "A valid race number is required."
      );
    }


    const raceDate =
      cleanText(
        race.raceDate
      );


    if (
      !raceDate ||
      !/^\d{4}-\d{2}-\d{2}$/.test(
        raceDate
      )
    ) {
      return errorResponse(
        "raceDate must be in YYYY-MM-DD format."
      );
    }


    const distance =
      cleanText(
        race.distance
      );


    if (!distance) {
      return errorResponse(
        "Race distance is required."
      );
    }


    if (
      !Array.isArray(
        race.runners
      ) ||
      race.runners.length === 0
    ) {
      return errorResponse(
        "At least one Greyhound runner is required."
      );
    }


    /*
     * ==========================================================
     * NORMALIZE RUNNERS
     * ==========================================================
     */
    const runners =
      race.runners
        .map(
          (
            runner
          ): RunnerPayload | null => {
            const trapNumber =
              parsePositiveInteger(
                runner.trapNumber
              );


            const name =
              cleanText(
                runner.name
              );


            if (
              !trapNumber ||
              trapNumber < 1 ||
              trapNumber > 8 ||
              !name
            ) {
              return null;
            }


            if (
              name.toUpperCase() ===
              "NO GREYHOUND"
            ) {
              return null;
            }


            return {
              trapNumber,

              trapColor:
                cleanText(
                  runner.trapColor
                ),

              name,

              kennel:
                cleanText(
                  runner.kennel
                ),

              trainer:
                cleanText(
                  runner.trainer
                ),

              weight:
                runner.weight ??
                null,

              form:
                cleanText(
                  runner.form
                ),

              odds:
                cleanText(
                  runner.odds
                ),
            };
          }
        )
        .filter(
          (
            runner
          ): runner is RunnerPayload =>
            runner !== null
        );


    if (
      runners.length === 0
    ) {
      return errorResponse(
        "No valid Greyhound runners were found in this race."
      );
    }


    /*
     * Do not allow the parser to accidentally create
     * duplicate boxes.
     */
    const boxes =
      runners.map(
        (runner) =>
          Number(
            runner.trapNumber
          )
      );


    if (
      new Set(
        boxes
      ).size !==
      boxes.length
    ) {
      return errorResponse(
        "The parsed race contains duplicate trap numbers."
      );
    }


    /*
     * ==========================================================
     * NORMALIZED RPC PAYLOAD
     * ==========================================================
     *
     * prizeMoney, weather, trackCondition, trapColor and form
     * are intentionally preserved in the frontend payload but
     * are not written yet because the current Greyhound schema
     * does not have matching race/entry columns for them.
     * ==========================================================
     */
    const normalizedRace = {
      track:
        cleanText(
          race.track
        ),

      raceNumber,

      raceDate,

      raceTime:
        cleanText(
          race.raceTime
        ),

      grade:
        cleanText(
          race.grade
        ),

      distance,

      prizeMoney:
        race.prizeMoney ??
        null,

      weather:
        cleanText(
          race.weather
        ),

      trackCondition:
        cleanText(
          race.trackCondition
        ),

      runners,
    };


    const session =
      normalizeSession(
        race
      );


    /*
     * ==========================================================
     * DATABASE IMPORT
     * ==========================================================
     */
    const supabase =
      await createSupabaseServerClient();


    const {
      data: importResult,
      error: importError,
    } =
      await supabase.rpc(
        "g365_greyhound_import_race",
        {
          p_track_code:
            trackCode,

          p_race:
            normalizedRace,

          p_session:
            session,
        }
      );


    if (importError) {
      console.error(
        "[G365 GREYHOUND RACE IMPORT RPC]",
        importError
      );


      return errorResponse(
        `Greyhound race import failed: ${importError.message}`,
        500
      );
    }


    const result =
      importResult as
        | {
            success?: boolean;
            cardId?: number;
            raceId?: number;
            raceNumber?: number;
            runnersSeen?: number;
            runnersInserted?: number;
            runnersUpdated?: number;
            staleEntriesRemoved?: number;
          }
        | null;


    if (
      !result ||
      result.success !== true
    ) {
      return errorResponse(
        "The Greyhound race import did not return a successful result.",
        500
      );
    }


    /*
     * ==========================================================
     * COMMISSIONER CONFIRMATION
     * ==========================================================
     *
     * Keep single-race saves backward-compatible: if that save
     * completes a valid card, publish it. Save All also performs
     * an explicit finalization after the full loop.
     */
    let commissionerConfirmed = false;

    if (
      (trackCode === "GTS" || trackCode === "GWD") &&
      result.cardId
    ) {
      const admin =
        createSupabaseAdminClient();

      const finalization =
        await finalizeGreyhoundCard(
          admin,
          {
            cardId:
              Number(result.cardId),
            trackCode,
            commissionerUserId:
              access.userId,
          }
        );

      commissionerConfirmed =
        finalization.confirmed;
    }


    /*
     * ==========================================================
     * SUCCESS
     * ==========================================================
     */
    return NextResponse.json({
      success: true,

      imported: true,

      commissionerConfirmed,

      leagueId,

      trackCode,

      session,

      cardId:
        result.cardId ??
        null,

      raceId:
        result.raceId ??
        null,

      raceNumber:
        result.raceNumber ??
        raceNumber,

      runnersSeen:
        result.runnersSeen ??
        runners.length,

      runnersInserted:
        result.runnersInserted ??
        null,

      runnersUpdated:
        result.runnersUpdated ??
        null,

      staleEntriesRemoved:
        result.staleEntriesRemoved ??
        null,

      importResult:
        result,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown Greyhound race import error.";


    console.error(
      "[G365 GREYHOUND RACE IMPORT]",
      error
    );


    return errorResponse(
      message,
      500
    );
  }
}