import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  getAmtoteRaces,
  getAmtoteToteState,
  g365TrackCodeForAmtote,
  type AmtoteRace,
  type AmtoteRaceCard,
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

function hasAuthoritativeResult(race: AmtoteRace): boolean {
  return race.resultsAvailable;
}

function feedRaceStatus(args: {
  race: AmtoteRace;
  currentRaceNumber: number | null;
}): "scheduled" | "upcoming" | "off" | "official" {
  if (hasAuthoritativeResult(args.race)) {
    return "official";
  }

  if (args.race.raceOffFlag) {
    return "off";
  }

  /*
   * IMPORTANT:
   * A race-level mtp field is not enough to identify "upcoming".
   * AmTote may populate mtp throughout the entire card.
   *
   * Only the exact current race number from GetTote/crc is allowed
   * to become upcoming.
   */
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
  incoming: "scheduled" | "upcoming" | "off" | "official",
) {
  if (current === "official") return "official";
  if (current === "cancelled" || current === "no_contest") return current;
  if (current === "off" && incoming !== "official") return "off";

  const rank: Record<string, number> = {
    scheduled: 0,
    upcoming: 1,
    off: 2,
    official: 3,
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

  /*
   * GetRaces is the authoritative source for the loaded card/date, scratches,
   * race-off flags, and result availability. GetTote anonymously exposes the
   * current race number (crc) and minutes-to-post (mtp). GetTracks is not used
   * because the service requires a logged-in SID.
   */
  const [feedCard, toteState] = await Promise.all([
    getAmtoteRaces(trackId),
    getAmtoteToteState(trackId),
  ]);

  const currentRaceNumber = toteState.currentRaceNumber;
  const currentRaceMtp = toteState.minutesToPost;

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

  /*
   * CRITICAL DATE/SESSION SAFETY:
   * Only mutate the exact card represented by the live AmTote feed.
   */
  const { data: card, error: cardError } = await supabase
    .from("greyhound_cards")
    .select(
      "id, race_date, session, card_status, import_status, commissioner_confirmed_at",
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
      currentRaceNumber: currentRaceNumber,
      currentRaceMtp: currentRaceMtp,
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

  if (["final", "cancelled"].includes(card.card_status)) {
    return {
      trackId,
      trackCode,
      raceDate: feedCard.raceDate,
      session: feedCard.session,
      currentRaceNumber: currentRaceNumber,
      currentRaceMtp: currentRaceMtp,
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
      currentRaceNumber: currentRaceNumber,
      currentRaceMtp: currentRaceMtp,
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

  const { data: savedRaces, error: racesError } = await supabase
    .from("greyhound_races")
    .select("id, race_number, race_status")
    .eq("card_id", card.id)
    .order("race_number", { ascending: true });

  if (racesError) throw racesError;

  let raceStatusesUpdated = 0;
  let scratchesApplied = 0;
  let anyOffOrOfficial = false;

  for (const savedRace of savedRaces ?? []) {
    const feedRace = feedCard.races.find(
      (race) => race.raceNumber === Number(savedRace.race_number),
    );

    if (!feedRace) {
      continue;
    }

    const incoming = feedRaceStatus({
      race: feedRace,
      currentRaceNumber: currentRaceNumber,
    });

    const resolved = nextStatus(
      savedRace.race_status,
      incoming,
    );

    if (resolved === "off" || resolved === "official") {
      anyOffOrOfficial = true;
    }

    if (resolved !== "official") {
    }

    if (resolved !== savedRace.race_status) {
      const update: Record<string, unknown> = {
        race_status: resolved,
        updated_at: new Date().toISOString(),
      };

      if (resolved === "off") {
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

    if (
      !["official", "cancelled", "no_contest"].includes(resolved)
    ) {
      scratchesApplied += await applyRaceScratches({
        raceId: savedRace.id,
        raceNumber: Number(savedRace.race_number),
        trackCode,
        feedRace,
      });
    }
  }

  /*
   * Card-level state follows actual completed/off races, not MTP.
   */
  let nextCardStatus = card.card_status;

  /*
   * Live-state sync may advance a card into in_progress, but it intentionally
   * does NOT mark the card final. Finalization belongs to the result / wager
   * settlement lifecycle so we do not bypass settlement work.
   */
  if (
    anyOffOrOfficial &&
    !["in_progress", "final"].includes(card.card_status)
  ) {
    nextCardStatus = "in_progress";
  }

  if (nextCardStatus !== card.card_status) {
    const { error: cardUpdateError } = await supabase
      .from("greyhound_cards")
      .update({
        card_status: nextCardStatus,
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
    currentRaceNumber: currentRaceNumber,
    currentRaceMtp: currentRaceMtp,
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
        session:
          trackId === "TSE" ? "evening" : "afternoon",
        currentRaceNumber: null,
        currentRaceMtp: null,
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
