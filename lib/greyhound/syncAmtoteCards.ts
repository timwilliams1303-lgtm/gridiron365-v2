import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  getAmtoteRaces,
  getAmtoteUSOControlTrackStates,
  g365TrackCodeForAmtote,
  type AmtoteRace,
  type AmtoteRaceCard,
  type AmtoteTrackId,
  type AmtoteTrackState,
  type G365GreyhoundTrackCode,
} from "@/lib/greyhound/amtote";

const TRAP_COLORS: Record<number, string> = {
  1: "Red",
  2: "Blue",
  3: "White",
  4: "Green",
  5: "Black",
  6: "Yellow",
  7: "Green / White",
  8: "Yellow / Black",
};

type SyncTrackResult = {
  trackId: AmtoteTrackId;
  trackCode: G365GreyhoundTrackCode;
  raceDate: string;
  session: string;
  racesSeen: number;
  racesImported: number;
  entriesSeen: number;
  scratchesApplied: number;
  autoConfirmed: boolean;
  skipped: boolean;
  skipReason: string | null;
  failed: boolean;
  errorMessage: string | null;
  controlRaceDate: string | null;
  controlNumberOfRaces: number | null;
  controlCurrentRaceNumber: number | null;
  controlMinutesToPost: number | null;
  controlStatus: string | null;
  controlDone: boolean | null;
};

export type SyncAmtoteCardsResult = {
  success: boolean;
  syncedAt: string;
  tracks: SyncTrackResult[];
};

function racePayload(card: AmtoteRaceCard, race: AmtoteRace) {
  return {
    track: card.g365TrackCode,
    raceNumber: race.raceNumber,
    raceDate: race.raceDate,
    raceTime: null,
    grade: race.grade,
    distance: race.distanceYards ? `${race.distanceYards} Yards` : null,
    prizeMoney: null,
    weather: null,
    trackCondition: null,
    source: "amtote",
    sourceTrackId: card.trackId,
    runners: race.runners
      .filter((runner) => {
        const box = runner.post ?? runner.starter;
        return (
          Boolean(runner.name) &&
          Number.isInteger(box) &&
          Number(box) >= 1 &&
          Number(box) <= 8
        );
      })
      .map((runner) => {
        const box = Number(runner.post ?? runner.starter);

        return {
          trapNumber: box,
          trapColor: TRAP_COLORS[box] ?? null,
          name: runner.name,
          trainer: null,
          weight: null,
          form: null,
          odds: runner.morningLine,
        };
      }),
  };
}

async function writeFeedStatus(args: {
  trackId: number;
  raceDate: string;
  session: string;
  status: "success" | "failed" | "skipped";
  errorMessage?: string | null;
}) {
  const supabase = createSupabaseAdminClient();
  const now = new Date().toISOString();

  const payload = {
    track_id: args.trackId,
    race_date: args.raceDate,
    session: args.session,
    source: "amtote",
    status: args.status,
    last_attempt_at: now,
    last_success_at: args.status === "success" ? now : null,
    error_message: args.errorMessage ?? null,
    updated_at: now,
  };

  const { error } = await supabase
    .from("greyhound_feed_sync_status")
    .upsert(payload, {
      onConflict: "track_id,race_date,session",
    });

  if (error) {
    console.error("Could not persist Greyhound feed sync status:", error);
  }
}

async function applyFeedScratches(args: {
  cardId: number;
  card: AmtoteRaceCard;
}) {
  const supabase = createSupabaseAdminClient();

  const { data: savedRaces, error: savedRacesError } = await supabase
    .from("greyhound_races")
    .select("id, race_number, race_status")
    .eq("card_id", args.cardId);

  if (savedRacesError) throw savedRacesError;

  let scratchesApplied = 0;

  for (const savedRace of savedRaces ?? []) {
    if (["official", "cancelled", "no_contest"].includes(savedRace.race_status)) {
      continue;
    }

    const feedRace = args.card.races.find(
      (race) => race.raceNumber === Number(savedRace.race_number),
    );

    if (!feedRace) continue;

    const scratchedBoxes = new Set<number>([
      ...feedRace.scratchedBoxes,
      ...feedRace.runners
        .filter((runner) => runner.scratched)
        .map((runner) => Number(runner.post ?? runner.starter))
        .filter((box) => Number.isInteger(box) && box >= 1 && box <= 8),
    ]);

    if (scratchedBoxes.size === 0) continue;

    const { data: entries, error: entriesError } = await supabase
      .from("greyhound_entries")
      .select("id, box_number, entry_status")
      .eq("race_id", savedRace.id)
      .in("box_number", [...scratchedBoxes]);

    if (entriesError) throw entriesError;

    for (const entry of entries ?? []) {
      if (entry.entry_status !== "active") continue;

      const { error: scratchError } = await supabase.rpc(
        "set_greyhound_entry_status",
        {
          p_entry_id: entry.id,
          p_entry_status: "scratched",
          p_changed_by: null,
        },
      );

      if (scratchError) {
        throw new Error(
          `${args.card.g365TrackCode} Race ${savedRace.race_number} Box ${entry.box_number} scratch update failed: ${scratchError.message}`,
        );
      }

      scratchesApplied += 1;
    }
  }

  return scratchesApplied;
}


async function autoConfirmOfficialFeedCard(cardId: number) {
  const supabase = createSupabaseAdminClient();

  /*
   * Official AmTote cards do not require a commissioner click.
   *
   * The database function performs the authoritative validation:
   * - supported import status
   * - at least one race
   * - entries exist
   * - every race has entry rows
   *
   * p_confirmed_by is intentionally null because this is an automated
   * confirmation from the official feed, not a commissioner action.
   *
   * If scheduled_first_post is still unavailable, the existing database
   * function confirms the card but leaves timed automation disabled. The
   * live-state sync will still enforce the whole-card lock from AmTote MTP.
   */
  const { data, error } = await supabase.rpc(
    "confirm_greyhound_card_for_racing",
    {
      p_card_id: cardId,
      p_confirmed_by: null,
    },
  );

  if (error) {
    throw new Error(
      `Automatic Greyhound card confirmation failed for card ${cardId}: ${error.message}`,
    );
  }

  return data;
}

async function syncOneTrack(
  trackId: AmtoteTrackId,
  controlState: AmtoteTrackState | null,
): Promise<SyncTrackResult> {
  const supabase = createSupabaseAdminClient();
  const trackCode = g365TrackCodeForAmtote(trackId);

  const { data: track, error: trackError } = await supabase
    .from("greyhound_tracks")
    .select("id, code")
    .eq("code", trackCode)
    .eq("active", true)
    .maybeSingle();

  if (trackError) throw trackError;
  if (!track) {
    throw new Error(`Active G365 Greyhound track ${trackCode} was not found.`);
  }

  let card: AmtoteRaceCard;

  try {
    card = await getAmtoteRaces(trackId);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown AmTote feed error.";

    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());

    const defaultSession = trackId === "TSE" ? "evening" : "afternoon";

    await writeFeedStatus({
      trackId: track.id,
      raceDate: today,
      session: defaultSession,
      status: "failed",
      errorMessage: message,
    });

    return {
      trackId,
      trackCode,
      raceDate: today,
      session: defaultSession,
      racesSeen: 0,
      racesImported: 0,
      entriesSeen: 0,
      scratchesApplied: 0,
      autoConfirmed: false,
      skipped: false,
      skipReason: null,
      failed: true,
      errorMessage: message,
      controlRaceDate: controlState?.raceDate ?? null,
      controlNumberOfRaces: controlState?.numberOfRaces ?? null,
      controlCurrentRaceNumber: controlState?.currentRaceNumber ?? null,
      controlMinutesToPost: controlState?.minutesToPost ?? null,
      controlStatus: controlState?.status ?? null,
      controlDone: controlState?.done ?? null,
    };
  }

  const { data: existingCard, error: existingCardError } = await supabase
    .from("greyhound_cards")
    .select(
      "id, card_status, import_status, automation_enabled, commissioner_confirmed_at",
    )
    .eq("track_id", track.id)
    .eq("race_date", card.raceDate)
    .eq("session", card.session)
    .maybeSingle();

  if (existingCardError) throw existingCardError;

  const entriesSeen = card.races.reduce(
    (total, race) => total + race.runners.length,
    0,
  );

  /*
   * Once a card is confirmed/automated or already racing, do not re-run the
   * general race importer. The official feed is still allowed to apply
   * explicit scratches to the exact matching card.
   */
  const importClosed =
    existingCard &&
    (Boolean(existingCard.automation_enabled) ||
      Boolean(existingCard.commissioner_confirmed_at) ||
      ["locked", "in_progress", "final", "cancelled"].includes(
        existingCard.card_status,
      ));

  if (importClosed && existingCard) {
    const scratchesApplied =
      existingCard.card_status === "final" ||
      existingCard.card_status === "cancelled"
        ? 0
        : await applyFeedScratches({
            cardId: existingCard.id,
            card,
          });

    await writeFeedStatus({
      trackId: track.id,
      raceDate: card.raceDate,
      session: card.session,
      status: "success",
    });

    return {
      trackId,
      trackCode: card.g365TrackCode,
      raceDate: card.raceDate,
      session: card.session,
      racesSeen: card.races.length,
      racesImported: 0,
      entriesSeen,
      scratchesApplied,
      autoConfirmed: false,
      skipped: true,
      skipReason:
        existingCard.card_status === "final" ||
        existingCard.card_status === "cancelled"
          ? `Existing card is ${existingCard.card_status}; import is closed.`
          : "Card is confirmed/automated; race definitions were preserved and only official scratches were checked.",
      failed: false,
      errorMessage: null,
      controlRaceDate: controlState?.raceDate ?? null,
      controlNumberOfRaces: controlState?.numberOfRaces ?? null,
      controlCurrentRaceNumber: controlState?.currentRaceNumber ?? null,
      controlMinutesToPost: controlState?.minutesToPost ?? null,
      controlStatus: controlState?.status ?? null,
      controlDone: controlState?.done ?? null,
    };
  }

  let racesImported = 0;

  for (const race of card.races) {
    const payload = racePayload(card, race);

    if (payload.runners.length === 0) continue;

    const { error } = await supabase.rpc("g365_greyhound_import_race", {
      p_track_code: card.g365TrackCode,
      p_race: payload,
      p_session: card.session,
    });

    if (error) {
      throw new Error(
        `${card.g365TrackCode} Race ${race.raceNumber} import failed: ${error.message}`,
      );
    }

    racesImported += 1;
  }

  const { data: savedCard, error: savedCardError } = await supabase
    .from("greyhound_cards")
    .select("id")
    .eq("track_id", track.id)
    .eq("race_date", card.raceDate)
    .eq("session", card.session)
    .maybeSingle();

  if (savedCardError) throw savedCardError;
  if (!savedCard) {
    throw new Error(`${card.g365TrackCode} card was not found after AmTote import.`);
  }

  const scratchesApplied = await applyFeedScratches({
    cardId: savedCard.id,
    card,
  });

  /*
   * A clean official AmTote import becomes wager-visible immediately.
   * Manual confirmation remains only for backup/manual imports or a card
   * that fails the database validation above.
   */
  await autoConfirmOfficialFeedCard(Number(savedCard.id));

  await writeFeedStatus({
    trackId: track.id,
    raceDate: card.raceDate,
    session: card.session,
    status: "success",
  });

  return {
    trackId,
    trackCode: card.g365TrackCode,
    raceDate: card.raceDate,
    session: card.session,
    racesSeen: card.races.length,
    racesImported,
    entriesSeen,
    scratchesApplied,
    autoConfirmed: true,
    skipped: false,
    skipReason: null,
    failed: false,
    errorMessage: null,
    controlRaceDate: controlState?.raceDate ?? null,
    controlNumberOfRaces: controlState?.numberOfRaces ?? null,
    controlCurrentRaceNumber: controlState?.currentRaceNumber ?? null,
    controlMinutesToPost: controlState?.minutesToPost ?? null,
    controlStatus: controlState?.status ?? null,
    controlDone: controlState?.done ?? null,
  };
}

export async function syncAmtoteGreyhoundCards(
  trackIds: AmtoteTrackId[] = ["WEM", "TSE"],
): Promise<SyncAmtoteCardsResult> {
  const tracks: SyncTrackResult[] = [];

  let controlStates: AmtoteTrackState[] = [];

  try {
    controlStates =
      await getAmtoteUSOControlTrackStates(trackIds);
  } catch (error) {
    console.error(
      "AmTote GetTracksUSOControl discovery failed:",
      error,
    );
  }

  for (const trackId of trackIds) {
    const controlState =
      controlStates.find(
        (state) => state.trackId === trackId,
      ) ?? null;

    try {
      tracks.push(
        await syncOneTrack(
          trackId,
          controlState,
        ),
      );
    } catch (error) {
      const trackCode = g365TrackCodeForAmtote(trackId);
      const message =
        error instanceof Error ? error.message : "Unknown AmTote sync error.";

      tracks.push({
        trackId,
        trackCode,
        raceDate: "",
        session: trackId === "TSE" ? "evening" : "afternoon",
        racesSeen: 0,
        racesImported: 0,
        entriesSeen: 0,
        scratchesApplied: 0,
        autoConfirmed: false,
        skipped: false,
        skipReason: null,
        failed: true,
        errorMessage: message,
        controlRaceDate: controlState?.raceDate ?? null,
        controlNumberOfRaces: controlState?.numberOfRaces ?? null,
        controlCurrentRaceNumber: controlState?.currentRaceNumber ?? null,
        controlMinutesToPost: controlState?.minutesToPost ?? null,
        controlStatus: controlState?.status ?? null,
        controlDone: controlState?.done ?? null,
      });
    }
  }

  return {
    success: tracks.every((track) => !track.failed),
    syncedAt: new Date().toISOString(),
    tracks,
  };
}
