import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  getAmtoteRaces,
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

function feedRaceStatus(
  race: AmtoteRace,
): "scheduled" | "upcoming" | "off" | "official" {
  if (race.resultsAvailable) return "official";
  if (race.raceOffFlag) return "off";
  if (race.minutesToPost !== null) return "upcoming";
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

  return (rank[incoming] ?? 0) >= (rank[current] ?? 0) ? incoming : current;
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
    /*
     * Never auto-reactivate and never overwrite another non-active state.
     * Only an active runner can become scratched from the live feed.
     */
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

async function syncOneTrack(trackId: AmtoteTrackId): Promise<LiveTrackResult> {
  const supabase = createSupabaseAdminClient();
  const trackCode = g365TrackCodeForAmtote(trackId);
  const feedCard: AmtoteRaceCard = await getAmtoteRaces(trackId);

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

  /*
   * CRITICAL DATE SAFETY:
   * We ONLY select the exact track + feed date + feed session. A Sep 10
   * AmTote program can never mutate a Sep 11 G365 card.
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
  let anyOff = false;
  let allOfficial = (savedRaces?.length ?? 0) > 0;

  for (const savedRace of savedRaces ?? []) {
    const feedRace = feedCard.races.find(
      (race) => race.raceNumber === Number(savedRace.race_number),
    );

    if (!feedRace) {
      allOfficial = false;
      continue;
    }

    const incoming = feedRaceStatus(feedRace);
    const resolved = nextStatus(savedRace.race_status, incoming);

    if (resolved === "off" || resolved === "official") {
      anyOff = true;
    }

    if (resolved !== "official") {
      allOfficial = false;
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

    if (!["official", "cancelled", "no_contest"].includes(resolved)) {
      scratchesApplied += await applyRaceScratches({
        raceId: savedRace.id,
        raceNumber: Number(savedRace.race_number),
        trackCode,
        feedRace,
      });
    }
  }

  /*
   * Card-level lifecycle follows actual feed state. This does not finalize
   * wagering settlement; it only reflects whether racing has started/ended.
   */
  let nextCardStatus = card.card_status;

  if (allOfficial) {
    nextCardStatus = "final";
  } else if (anyOff && !["in_progress", "final"].includes(card.card_status)) {
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
        cardFound: false,
        racesChecked: 0,
        raceStatusesUpdated: 0,
        scratchesApplied: 0,
        skipped: false,
        skipReason: null,
        failed: true,
        errorMessage:
          error instanceof Error ? error.message : "Unknown live-state sync error.",
      });
    }
  }

  return {
    success: tracks.every((track) => !track.failed),
    syncedAt: new Date().toISOString(),
    tracks,
  };
}
