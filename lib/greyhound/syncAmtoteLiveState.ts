import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  getAmtoteRaces,
  getAmtoteToteState,
  g365TrackCodeForAmtote,
  type AmtoteRace,
  type AmtoteTrackId,
  type G365GreyhoundTrackCode,
} from "@/lib/greyhound/amtote";

type LiveTrackResult = {
  trackId: AmtoteTrackId;
  trackCode: G365GreyhoundTrackCode;
  raceDate: string;
  session: string;
  currentRaceNumber: number | null;
  currentRaceMtp: number | null;
  currentRaceScheduledPostTime: string | null;
  currentRaceProjectedPostTime: string | null;
  delayMinutes: number | null;
  isDelayed: boolean;
  cardFound: boolean;
  racesChecked: number;
  raceStatusesUpdated: number;
  scratchesApplied: number;
  skipped: boolean;
  skipReason: string | null;
  failed: boolean;
  errorMessage: string | null;
};

export type SyncAmtoteLiveStateResult = {
  success: boolean;
  syncedAt: string;
  tracks: LiveTrackResult[];
};

type SavedRaceRow = {
  id: number;
  race_number: number;
  race_status: string;
  scheduled_post_time: string | null;
  actual_post_time: string | null;
};

function hasResultSignal(race: AmtoteRace): boolean {
  return race.resultsAvailable;
}

function feedRaceStatus(args: {
  race: AmtoteRace;
  currentRaceNumber: number | null;
}): "scheduled" | "upcoming" | "off" {
  if (args.race.raceOffFlag || hasResultSignal(args.race)) {
    return "off";
  }

  if (
    args.currentRaceNumber !== null &&
    args.race.raceNumber === args.currentRaceNumber
  ) {
    return "upcoming";
  }

  return "scheduled";
}

function nextStatus(
  current: string,
  incoming: "scheduled" | "upcoming" | "off",
) {
  if (current === "official") return "official";
  if (current === "cancelled" || current === "no_contest") return current;
  if (current === "off") return "off";

  const rank: Record<string, number> = {
    scheduled: 0,
    upcoming: 1,
    off: 2,
  };

  return (rank[incoming] ?? 0) >= (rank[current] ?? 0)
    ? incoming
    : current;
}

function scratchedBoxesForRace(race: AmtoteRace): number[] {
  return [
    ...new Set<number>([
      ...race.scratchedBoxes,
      ...race.runners
        .filter((runner) => runner.scratched)
        .map((runner) => Number(runner.post ?? runner.starter))
        .filter((box) => Number.isInteger(box) && box >= 1 && box <= 8),
    ]),
  ].sort((a, b) => a - b);
}

function getDelayState(args: {
  scheduledPostTime: string | null;
  currentRaceMtp: number | null;
}) {
  if (
    !args.scheduledPostTime ||
    args.currentRaceMtp === null ||
    !Number.isFinite(args.currentRaceMtp)
  ) {
    return {
      currentRaceScheduledPostTime: args.scheduledPostTime,
      currentRaceProjectedPostTime: null,
      delayMinutes: null,
      isDelayed: false,
    };
  }

  const scheduledMs = new Date(args.scheduledPostTime).getTime();

  if (!Number.isFinite(scheduledMs)) {
    return {
      currentRaceScheduledPostTime: args.scheduledPostTime,
      currentRaceProjectedPostTime: null,
      delayMinutes: null,
      isDelayed: false,
    };
  }

  const projectedPostMs =
    Date.now() + Math.max(0, args.currentRaceMtp) * 60_000;

  const rawDelayMinutes = Math.round(
    (projectedPostMs - scheduledMs) / 60_000,
  );

  const delayMinutes = Math.max(0, rawDelayMinutes);

  return {
    currentRaceScheduledPostTime: new Date(scheduledMs).toISOString(),
    currentRaceProjectedPostTime: new Date(projectedPostMs).toISOString(),
    delayMinutes,
    isDelayed: delayMinutes >= 2,
  };
}

function getScheduledCardLockAt(
  scheduledFirstPost: string | null,
): string | null {
  if (!scheduledFirstPost) {
    return null;
  }

  const firstPostMs = new Date(scheduledFirstPost).getTime();

  if (!Number.isFinite(firstPostMs)) {
    return null;
  }

  return new Date(firstPostMs - 5 * 60_000).toISOString();
}

async function applyRaceScratches(args: {
  raceId: number;
  raceNumber: number;
  trackCode: G365GreyhoundTrackCode;
  feedRace: AmtoteRace;
}) {
  const boxes = scratchedBoxesForRace(args.feedRace);
  if (boxes.length === 0) return 0;

  const supabase = createSupabaseAdminClient();

  const { data: entries, error: entriesError } = await supabase
    .from("greyhound_entries")
    .select("id, box_number, entry_status")
    .eq("race_id", args.raceId)
    .in("box_number", boxes);

  if (entriesError) throw entriesError;

  let applied = 0;

  for (const entry of entries ?? []) {
    if (entry.entry_status !== "active") continue;

    const { error } = await supabase.rpc("set_greyhound_entry_status", {
      p_entry_id: entry.id,
      p_entry_status: "scratched",
      p_changed_by: null,
    });

    if (error) {
      throw new Error(
        `${args.trackCode} Race ${args.raceNumber} Box ${entry.box_number} scratch update failed: ${error.message}`,
      );
    }

    applied += 1;
  }

  return applied;
}

async function syncOneTrack(
  trackId: AmtoteTrackId,
): Promise<LiveTrackResult> {
  const supabase = createSupabaseAdminClient();
  const trackCode = g365TrackCodeForAmtote(trackId);

  const [feedCard, toteState] = await Promise.all([
    getAmtoteRaces(trackId),
    getAmtoteToteState(trackId),
  ]);

  const currentRaceNumber = toteState.currentRaceNumber;
  const currentRaceMtp = toteState.minutesToPost;

  const noDelay = {
    currentRaceScheduledPostTime: null,
    currentRaceProjectedPostTime: null,
    delayMinutes: null,
    isDelayed: false,
  };

  if (
    currentRaceNumber !== null &&
    !feedCard.races.some((race) => race.raceNumber === currentRaceNumber)
  ) {
    return {
      trackId,
      trackCode,
      raceDate: feedCard.raceDate,
      session: feedCard.session,
      currentRaceNumber,
      currentRaceMtp,
      ...noDelay,
      cardFound: false,
      racesChecked: feedCard.races.length,
      raceStatusesUpdated: 0,
      scratchesApplied: 0,
      skipped: true,
      skipReason:
        `AmTote GetTote current race ${currentRaceNumber} is not present on the loaded ${trackCode} ${feedCard.raceDate} card. No database changes were made.`,
      failed: false,
      errorMessage: null,
    };
  }

  const { data: track, error: trackError } = await supabase
    .from("greyhound_tracks")
    .select("id, code")
    .eq("code", trackCode)
    .eq("active", true)
    .maybeSingle();

  if (trackError) throw trackError;

  if (!track) {
    throw new Error(
      `Active G365 Greyhound track ${trackCode} was not found.`,
    );
  }

  const { data: card, error: cardError } = await supabase
    .from("greyhound_cards")
    .select(
      "id, race_date, session, card_status, import_status, scheduled_first_post, lock_at, commissioner_confirmed_at",
    )
    .eq("track_id", track.id)
    .eq("race_date", feedCard.raceDate)
    .eq("session", feedCard.session)
    .maybeSingle();

  if (cardError) throw cardError;

  if (!card) {
    return {
      trackId,
      trackCode,
      raceDate: feedCard.raceDate,
      session: feedCard.session,
      currentRaceNumber,
      currentRaceMtp,
      ...noDelay,
      cardFound: false,
      racesChecked: feedCard.races.length,
      raceStatusesUpdated: 0,
      scratchesApplied: 0,
      skipped: true,
      skipReason:
        "No exact G365 card exists for the AmTote track/date/session yet. Card sync will create it.",
      failed: false,
      errorMessage: null,
    };
  }

  const { data: savedRacesData, error: racesError } = await supabase
    .from("greyhound_races")
    .select(
      "id, race_number, race_status, scheduled_post_time, actual_post_time",
    )
    .eq("card_id", card.id)
    .order("race_number", { ascending: true });

  if (racesError) throw racesError;

  const savedRaces = (savedRacesData ?? []) as SavedRaceRow[];

  const currentSavedRace =
    currentRaceNumber === null
      ? null
      : savedRaces.find(
          (race) => Number(race.race_number) === currentRaceNumber,
        ) ?? null;

  const liveDelay = getDelayState({
    scheduledPostTime: currentSavedRace?.scheduled_post_time ?? null,
    currentRaceMtp,
  });

  if (["final", "cancelled"].includes(card.card_status)) {
    return {
      trackId,
      trackCode,
      raceDate: feedCard.raceDate,
      session: feedCard.session,
      currentRaceNumber,
      currentRaceMtp,
      ...liveDelay,
      cardFound: true,
      racesChecked: feedCard.races.length,
      raceStatusesUpdated: 0,
      scratchesApplied: 0,
      skipped: true,
      skipReason: `Card is ${card.card_status}.`,
      failed: false,
      errorMessage: null,
    };
  }

  if (!["imported", "updated"].includes(card.import_status)) {
    return {
      trackId,
      trackCode,
      raceDate: feedCard.raceDate,
      session: feedCard.session,
      currentRaceNumber,
      currentRaceMtp,
      ...liveDelay,
      cardFound: true,
      racesChecked: feedCard.races.length,
      raceStatusesUpdated: 0,
      scratchesApplied: 0,
      skipped: true,
      skipReason: `Card import status is ${card.import_status}.`,
      failed: false,
      errorMessage: null,
    };
  }

  let raceStatusesUpdated = 0;
  let scratchesApplied = 0;
  let anyClosedRace = false;

  for (const savedRace of savedRaces) {
    const feedRace = feedCard.races.find(
      (race) => race.raceNumber === Number(savedRace.race_number),
    );

    if (!feedRace) continue;

    const incoming = feedRaceStatus({
      race: feedRace,
      currentRaceNumber,
    });

    const resolved = nextStatus(savedRace.race_status, incoming);

    if (resolved === "off" || resolved === "official") {
      anyClosedRace = true;
    }

    if (resolved !== savedRace.race_status) {
      const update: Record<string, unknown> = {
        race_status: resolved,
        updated_at: new Date().toISOString(),
      };

      if (resolved === "off" && !savedRace.actual_post_time) {
        update.actual_post_time = new Date().toISOString();
      }

      const { error: updateError } = await supabase
        .from("greyhound_races")
        .update(update)
        .eq("id", savedRace.id);

      if (updateError) {
        throw new Error(
          `${trackCode} Race ${savedRace.race_number} status update failed: ${updateError.message}`,
        );
      }

      raceStatusesUpdated += 1;
    }

    if (!["official", "cancelled", "no_contest"].includes(resolved)) {
      scratchesApplied += await applyRaceScratches({
        raceId: savedRace.id,
        raceNumber: Number(savedRace.race_number),
        trackCode,
        feedRace,
      });
    }
  }

  const nowMs = Date.now();

  /*
   * Whole-card wagering lock:
   *
   * The fixed G365 lock timestamp is always exactly five minutes before
   * scheduled_first_post. It must never be replaced with the time this
   * polling job happened to notice that the card should be locked.
   *
   * Prefer the canonical value derived from scheduled_first_post so this
   * live-state sync also self-heals a missing or incorrect persisted lock_at
   * on an active card.
   */
  const scheduledCardLockAt = getScheduledCardLockAt(
    card.scheduled_first_post,
  );

  const effectiveCardLockAt =
    scheduledCardLockAt ?? card.lock_at ?? null;

  const effectiveCardLockMs = effectiveCardLockAt
    ? new Date(String(effectiveCardLockAt)).getTime()
    : Number.NaN;

  const persistedLockReached =
    Number.isFinite(effectiveCardLockMs) &&
    effectiveCardLockMs <= nowMs;

  /*
   * AmTote MTP remains a secondary live trigger. This protects against a
   * timing-feed edge case where the fixed lock timestamp is unavailable.
   * Even when this trigger fires, lock_at is never stamped with now().
   */
  const liveFiveMinuteLockReached =
    currentRaceNumber === 1 &&
    currentRaceMtp !== null &&
    Number.isFinite(currentRaceMtp) &&
    currentRaceMtp <= 5;

  const wholeCardShouldLock =
    Boolean(card.commissioner_confirmed_at) &&
    (persistedLockReached || liveFiveMinuteLockReached);

  let nextCardStatus = card.card_status;

  /*
   * Keep lock_at deterministic. If scheduled_first_post exists, its
   * calculated five-minute cutoff is authoritative. Otherwise preserve the
   * existing value rather than inventing a polling timestamp.
   */
  let nextLockAt =
    scheduledCardLockAt ?? card.lock_at ?? null;

  if (
    wholeCardShouldLock &&
    !["locked", "final", "cancelled"].includes(card.card_status)
  ) {
    nextCardStatus = "locked";
  }

  /*
   * If the card was not locked yet and a race is already off, move the card
   * into in_progress. A card that has already reached the G365 whole-card
   * lock remains locked; live-state must never reopen it.
   *
   * Finalization still belongs to the result / wager settlement lifecycle.
   */
  if (
    anyClosedRace &&
    nextCardStatus !== "locked" &&
    !["in_progress", "final", "cancelled"].includes(nextCardStatus)
  ) {
    nextCardStatus = "in_progress";
  }

  if (
    nextCardStatus !== card.card_status ||
    nextLockAt !== card.lock_at
  ) {
    const { error: cardUpdateError } = await supabase
      .from("greyhound_cards")
      .update({
        card_status: nextCardStatus,
        lock_at: nextLockAt,
        updated_at: new Date().toISOString(),
      })
      .eq("id", card.id);

    if (cardUpdateError) {
      throw new Error(
        `${trackCode} card status update failed: ${cardUpdateError.message}`,
      );
    }
  }

  return {
    trackId,
    trackCode,
    raceDate: feedCard.raceDate,
    session: feedCard.session,
    currentRaceNumber,
    currentRaceMtp,
    ...liveDelay,
    cardFound: true,
    racesChecked: feedCard.races.length,
    raceStatusesUpdated,
    scratchesApplied,
    skipped: false,
    skipReason: null,
    failed: false,
    errorMessage: null,
  };
}

export async function syncAmtoteGreyhoundLiveState(
  trackIds: AmtoteTrackId[] = ["WEM", "TSE"],
): Promise<SyncAmtoteLiveStateResult> {
  const tracks: LiveTrackResult[] = [];

  for (const trackId of trackIds) {
    try {
      tracks.push(await syncOneTrack(trackId));
    } catch (error) {
      tracks.push({
        trackId,
        trackCode: g365TrackCodeForAmtote(trackId),
        raceDate: "",
        session: trackId === "TSE" ? "evening" : "afternoon",
        currentRaceNumber: null,
        currentRaceMtp: null,
        currentRaceScheduledPostTime: null,
        currentRaceProjectedPostTime: null,
        delayMinutes: null,
        isDelayed: false,
        cardFound: false,
        racesChecked: 0,
        raceStatusesUpdated: 0,
        scratchesApplied: 0,
        skipped: false,
        skipReason: null,
        failed: true,
        errorMessage:
          error instanceof Error
            ? error.message
            : "Unknown live-state sync error.",
      });
    }
  }

  return {
    success: tracks.every((track) => !track.failed),
    syncedAt: new Date().toISOString(),
    tracks,
  };
}
