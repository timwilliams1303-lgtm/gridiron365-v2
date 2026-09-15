import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { requireLeagueMember } from "@/lib/leagues/requireLeagueMember";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type EntryInput = {
  raceNumber: number;
  trapNumber: number;
  dogName: string;
  odds?: string | null;
  kennel?: string | null;
  weight?: number | null;
};

function normalizeAuthoritativeDogName(value: string) {
  let name = String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\s*'\s*/g, "'")
    .replace(/\s*-\s*/g, "-");

  /*
   * Official Entries is authoritative. OCR can collapse the space after
   * common greyhound name prefixes. Repair only known/high-confidence
   * prefixes; never use Program OCR to determine current-card identity.
   */
  name = name
    .replace(/^WW(?=[A-Z])/i, "WW ")
    .replace(/^JSP(?=[A-Z])/i, "JSP ")
    .replace(/^JS(?=[A-Z])/i, "JS ")
    .replace(/^CET(?=[A-Z])/i, "CET ")
    .replace(/^GLS(?=[A-Z])/i, "GLS ")
    .replace(/^TNT(?=[A-Z])/i, "TNT ")
    .replace(/^FF(?=[A-Z])/i, "FF ")
    .replace(/^DD(?=[A-Z])/i, "DD ")
    .replace(/^DC(?=[A-Z])/i, "DC ")
    .replace(/^FG(?=[A-Z])/i, "FG ")
    .replace(/^XMC(?=[A-Z])/i, "XMC ")
    .replace(/^AJN(?=[A-Z])/i, "AJN ")
    .replace(/^NS(?=[A-Z])/i, "NS ")
    .replace(/^RG(?=[A-Z])/i, "RG ")
    .replace(/^BL(?=[A-Z])/i, "BL ")
    .replace(/^MD(?=[A-Z])/i, "MD ")
    .replace(/^RJ'S(?=[A-Z])/i, "RJ'S ")
    .replace(/^TF'S(?=[A-Z])/i, "TF'S ")
    .replace(/^CG'S(?=[A-Z])/i, "CG'S ")
    .replace(/^HJ'S(?=[A-Z])/i, "HJ'S ")
    .replace(/^JA'S(?=[A-Z])/i, "JA'S ")
    .replace(/^OYA(?=[A-Z])/i, "O YA ")
    .replace(/^ARKWILDB(?=[A-Z])/i, "ARKWILD B ");

  return name.replace(/\s+/g, " ").trim();
}

function normalizeEntries(entries: EntryInput[]) {
  return entries
    .map((entry) => ({
      raceNumber: Number(entry.raceNumber),
      trapNumber: Number(entry.trapNumber),
      dogName: normalizeAuthoritativeDogName(entry.dogName),
      odds:
        typeof entry.odds === "string"
          ? entry.odds.replace(/\s+/g, " ").trim() || null
          : null,
      kennel:
        typeof entry.kennel === "string"
          ? entry.kennel.replace(/\s+/g, " ").trim() || null
          : null,
      weight:
        typeof entry.weight === "number" && Number.isFinite(entry.weight)
          ? entry.weight
          : null,
    }))
    .filter(
      (entry) =>
        Number.isInteger(entry.raceNumber) &&
        entry.raceNumber >= 1 &&
        entry.raceNumber <= 17 &&
        Number.isInteger(entry.trapNumber) &&
        entry.trapNumber >= 1 &&
        entry.trapNumber <= 8 &&
        entry.dogName.length > 0,
    );
}

function parseFirstPost(
  raceDate: string,
  firstPostTime: string | null | undefined,
) {
  if (!firstPostTime) return null;

  const match = firstPostTime
    .replace(/\s+/g, "")
    .match(/^(\d{1,2}):(\d{2})(AM|PM)$/i);

  if (!match) return null;

  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const meridiem = match[3].toUpperCase();

  if (hour === 12) hour = 0;
  if (meridiem === "PM") hour += 12;

  /*
   * Tri-State is in West Virginia and uses America/New_York.
   * The Entries import is only setting the scheduled first post.
   * Use an explicit offset appropriate to the 2026 racing season date.
   *
   * For the current September card this is EDT (-04:00).
   * The normal race-program import can later provide/enrich exact post times.
   */
  return `${raceDate}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00-04:00`;
}

export async function GET(request: NextRequest) {
  try {
    const leagueId = request.nextUrl.searchParams.get("leagueId");
    const trackCode = request.nextUrl.searchParams.get("trackCode");
    const raceDate = request.nextUrl.searchParams.get("raceDate");
    const session = request.nextUrl.searchParams.get("session");

    if (!leagueId) {
      return NextResponse.json({ error: "leagueId is required." }, { status: 400 });
    }

    if (trackCode !== "GTS" && trackCode !== "GWD") {
      return NextResponse.json(
        { error: "Authoritative Entries lookup supports Tri-State (GTS) and Wheeling (GWD)." },
        { status: 400 },
      );
    }

    const trackName = trackCode === "GWD" ? "Wheeling" : "Tri-State";

    if (!raceDate || !/^\d{4}-\d{2}-\d{2}$/.test(raceDate)) {
      return NextResponse.json(
        { error: "A valid raceDate is required." },
        { status: 400 },
      );
    }

    if (!session?.trim()) {
      return NextResponse.json({ error: "session is required." }, { status: 400 });
    }

    const membership = await requireLeagueMember(leagueId);

    if (!membership.isCommissioner) {
      return NextResponse.json(
        { error: "Only the commissioner can load authoritative Entries." },
        { status: 403 },
      );
    }

    /*
     * The normal server client uses the publishable key + user cookies and is
     * subject to RLS. That client can verify league membership, but the
     * greyhound card/entry tables are not visible through the same RLS path.
     *
     * Authorization is already established above. Use a server-only service
     * role client for the authoritative Entries read so card 19 and future
     * commissioner-imported cards are visible.
     */
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: "Supabase service-role environment variables are missing." },
        { status: 500 },
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    /*
     * Resolve the authoritative card without guessing the physical code/name
     * columns on greyhound_tracks. The Entries POST/RPC already created the
     * correct card. Find the requested date/session card, then verify its
     * joined track is GTS/Tri-State.
     */
    // Look up the official card by date first. Older Tri-State imports could
    // carry the wrong session label even though the Entries PDF is authoritative.
    // We verify GTS below, then prefer the requested session when one exists.
    const { data: candidateCards, error: candidateCardsError } = await supabase
      .from("greyhound_cards")
      .select("id,track_id,session")
      .eq("race_date", raceDate);

    if (candidateCardsError) {
      return NextResponse.json(
        { error: `Could not load greyhound cards: ${candidateCardsError.message}` },
        { status: 500 },
      );
    }

    if (!candidateCards?.length) {
      return NextResponse.json(
        {
          error:
            `No greyhound card exists for ${raceDate}. The Entries import and ` +
            `Program lookup are not pointing at the same saved card.`,
        },
        { status: 404 },
      );
    }

    const candidateTrackIds = Array.from(
      new Set(candidateCards.map((card) => Number(card.track_id))),
    ).filter((id) => Number.isFinite(id));

    const { data: tracks, error: tracksError } = await supabase
      .from("greyhound_tracks")
      .select("id,code,name")
      .in("id", candidateTrackIds)
      .eq("code", trackCode);

    if (tracksError) {
      return NextResponse.json(
        { error: `Could not load greyhound tracks: ${tracksError.message}` },
        { status: 500 },
      );
    }

    const requestedTrackIds = new Set(
      (tracks ?? []).map((row) => Number(row.id)),
    );

    const requestedTrackCards = candidateCards.filter((card) =>
      requestedTrackIds.has(Number(card.track_id)),
    );

    // Prefer the exact official Entries session. If legacy data has a stale
    // session label but there is only one GTS card for this date, use that card
    // rather than pretending the authoritative Entries card does not exist.
    const requestedSession = session.trim().toLowerCase();
    const matchedCard =
      requestedTrackCards.find(
        (card) => String(card.session ?? "").trim().toLowerCase() === requestedSession,
      ) ??
      (requestedTrackCards.length === 1 ? requestedTrackCards[0] : undefined);

    if (!matchedCard) {
      return NextResponse.json(
        {
          error:
            `A card exists for ${raceDate} (${session.trim().toLowerCase()}), ` +
            `${"but its track could not be verified as "}${trackName}/${trackCode}.`,
        },
        { status: 404 },
      );
    }

    const trackId = Number(matchedCard.track_id);

    const { data: card, error: cardError } = await supabase
      .from("greyhound_cards")
      .select("id")
      .eq("id", matchedCard.id)
      .eq("track_id", trackId)
      .maybeSingle();

    if (cardError) {
      return NextResponse.json(
        { error: `Could not load the ${trackName} card: ${cardError.message}` },
        { status: 500 },
      );
    }

    if (!card) {
      return NextResponse.json(
        {
          error:
            `No authoritative ${trackName} Entries card exists for ${raceDate} ` +
            `(${session.trim().toLowerCase()}). Import Entries first.`,
        },
        { status: 404 },
      );
    }

    const { data: races, error: racesError } = await supabase
      .from("greyhound_races")
      .select("id,race_number")
      .eq("card_id", card.id)
      .order("race_number");

    if (racesError) {
      return NextResponse.json(
        { error: `Could not load ${trackName} races: ${racesError.message}` },
        { status: 500 },
      );
    }

    const raceIds = (races ?? []).map((race) => race.id);

    if (raceIds.length === 0) {
      return NextResponse.json(
        { error: `${"The authoritative "}${trackName} card has no races.` },
        { status: 404 },
      );
    }

    const { data: entries, error: entriesError } = await supabase
      .from("greyhound_entries")
      .select(
        "race_id,dog_id,box_number,morning_line_odds,kennel,weight",
      )
      .in("race_id", raceIds)
      .order("race_id")
      .order("box_number");

    if (entriesError) {
      return NextResponse.json(
        { error: `Could not load ${trackName} Entries: ${entriesError.message}` },
        { status: 500 },
      );
    }

    const dogIds = Array.from(
      new Set(
        (entries ?? [])
          .map((entry) => entry.dog_id)
          .filter((id): id is number => typeof id === "number"),
      ),
    );

    const { data: dogs, error: dogsError } = dogIds.length
      ? await supabase
          .from("greyhound_dogs")
          .select("id,display_name")
          .in("id", dogIds)
      : { data: [], error: null };

    if (dogsError) {
      return NextResponse.json(
        { error: `Could not load authoritative dog names: ${dogsError.message}` },
        { status: 500 },
      );
    }

    const raceNumberById = new Map(
      (races ?? []).map((race) => [race.id, race.race_number]),
    );
    const dogNameById = new Map(
      (dogs ?? []).map((dog) => [dog.id, dog.display_name]),
    );

    const authoritative = (entries ?? [])
      .map((entry) => ({
        raceNumber: Number(raceNumberById.get(entry.race_id)),
        boxNumber: Number(entry.box_number),
        dogId: Number(entry.dog_id),
        dogName: String(dogNameById.get(entry.dog_id) ?? "").trim(),
        odds: entry.morning_line_odds ?? null,
        kennel: entry.kennel ?? null,
        weight:
          entry.weight === null || entry.weight === undefined
            ? null
            : Number(entry.weight),
      }))
      .filter(
        (entry) =>
          Number.isInteger(entry.raceNumber) &&
          Number.isInteger(entry.boxNumber) &&
          Number.isFinite(entry.dogId) &&
          entry.dogName.length > 0,
      )
      .sort(
        (a, b) =>
          a.raceNumber - b.raceNumber ||
          a.boxNumber - b.boxNumber,
      );

    return NextResponse.json({
      success: true,
      cardId: card.id,
      raceDate,
      session: session.trim().toLowerCase(),
      entries: authoritative,
      count: authoritative.length,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Authoritative Entries lookup failed.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      leagueId?: string;
      trackCode?: string;
      sourceFileName?: string;
      raceDate?: string;
      session?: string;
      firstPostTime?: string | null;
      entries?: EntryInput[];
    };

    if (!body.leagueId) {
      return NextResponse.json(
        { error: "leagueId is required." },
        { status: 400 },
      );
    }

    if (body.trackCode !== "GTS" && body.trackCode !== "GWD") {
      return NextResponse.json(
        { error: "Entries track must be Tri-State (GTS) or Wheeling (GWD)." },
        { status: 400 },
      );
    }

    const trackCode = body.trackCode;
    const trackName = trackCode === "GWD" ? "Wheeling" : "Tri-State";
    const expectedRaceCount = trackCode === "GWD" ? 17 : 14;

    if (!body.raceDate || !/^\d{4}-\d{2}-\d{2}$/.test(body.raceDate)) {
      return NextResponse.json(
        { error: "A valid Entries race date is required." },
        { status: 400 },
      );
    }

    if (!body.session?.trim()) {
      return NextResponse.json(
        { error: "Entries session is required." },
        { status: 400 },
      );
    }

    if (!Array.isArray(body.entries) || body.entries.length === 0) {
      return NextResponse.json(
        { error: "entries are required." },
        { status: 400 },
      );
    }

    const membership = await requireLeagueMember(body.leagueId);

    if (!membership.isCommissioner) {
      return NextResponse.json(
        { error: "Only the commissioner can import Entries." },
        { status: 403 },
      );
    }

    const entries = normalizeEntries(body.entries);
    const races = new Set(entries.map((entry) => entry.raceNumber));

    if (races.size !== expectedRaceCount) {
      return NextResponse.json(
        {
          error:
            `Entries import requires all ${expectedRaceCount} ${trackName} races. ` +
            `Received ${races.size}.`,
        },
        { status: 400 },
      );
    }

    for (let raceNumber = 1; raceNumber <= expectedRaceCount; raceNumber += 1) {
      if (!races.has(raceNumber)) {
        return NextResponse.json(
          { error: `${trackName} Entries is missing Race ${raceNumber}.` },
          { status: 400 },
        );
      }
    }

    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase.rpc(
      "g365_greyhound_import_entries_card",
      {
        p_track_code: trackCode,
        p_race_date: body.raceDate,
        p_session: body.session.trim().toLowerCase(),
        p_entries: entries,
        p_source_file_name: body.sourceFileName ?? null,
        p_scheduled_first_post: parseFirstPost(
          body.raceDate,
          body.firstPostTime,
        ),
      },
    );

    if (error) {
      return NextResponse.json(
        {
          error: `${trackName} Entries database import failed: ${error.message}`,
        },
        { status: 500 },
      );
    }

    /*
     * The RPC can reuse an existing greyhound_dogs row. If that row was
     * originally created from collapsed OCR (for example "DDBraun"), merely
     * re-importing the Entries card may leave display_name unchanged.
     *
     * Resolve this exact card's Race + Box -> dog_id mapping after the RPC and
     * explicitly set each reused dog's display_name to the authoritative
     * Entries name. Program text never participates in this update.
     */
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: "Supabase service-role environment variables are missing." },
        { status: 500 },
      );
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data: trackRow, error: trackError } = await admin
      .from("greyhound_tracks")
      .select("id")
      .eq("code", trackCode)
      .maybeSingle();

    if (trackError || !trackRow) {
      return NextResponse.json(
        {
          error:
            `Entries were imported, but the ${trackName} track could not be ` +
            `resolved for authoritative dog-name synchronization${
              trackError ? `: ${trackError.message}` : "."
            }`,
        },
        { status: 500 },
      );
    }

    const normalizedSession = body.session.trim().toLowerCase();

    const { data: cardRows, error: cardRowsError } = await admin
      .from("greyhound_cards")
      .select("id,session")
      .eq("track_id", trackRow.id)
      .eq("race_date", body.raceDate);

    if (cardRowsError) {
      return NextResponse.json(
        {
          error:
            `Entries were imported, but the card could not be reloaded for ` +
            `authoritative dog-name synchronization: ${cardRowsError.message}`,
        },
        { status: 500 },
      );
    }

    const cardRow =
      (cardRows ?? []).find(
        (row) =>
          String(row.session ?? "").trim().toLowerCase() === normalizedSession,
      ) ??
      ((cardRows ?? []).length === 1 ? cardRows?.[0] : undefined);

    if (!cardRow) {
      return NextResponse.json(
        {
          error:
            `Entries were imported, but the ${trackName} card could not be ` +
            `uniquely resolved for authoritative dog-name synchronization.`,
        },
        { status: 500 },
      );
    }

    const { data: importedRaces, error: importedRacesError } = await admin
      .from("greyhound_races")
      .select("id,race_number")
      .eq("card_id", cardRow.id);

    if (importedRacesError) {
      return NextResponse.json(
        {
          error:
            `Entries were imported, but races could not be reloaded for ` +
            `authoritative dog-name synchronization: ${importedRacesError.message}`,
        },
        { status: 500 },
      );
    }

    const raceNumberById = new Map(
      (importedRaces ?? []).map((race) => [
        Number(race.id),
        Number(race.race_number),
      ]),
    );
    const raceIds = [...raceNumberById.keys()];

    const { data: importedEntryRows, error: importedEntryRowsError } =
      raceIds.length > 0
        ? await admin
            .from("greyhound_entries")
            .select("race_id,dog_id,box_number")
            .in("race_id", raceIds)
        : { data: [], error: null };

    if (importedEntryRowsError) {
      return NextResponse.json(
        {
          error:
            `Entries were imported, but Race + Box dog identities could not ` +
            `be reloaded: ${importedEntryRowsError.message}`,
        },
        { status: 500 },
      );
    }

    const authoritativeNameByRaceBox = new Map(
      entries.map((entry) => [
        `${entry.raceNumber}:${entry.trapNumber}`,
        entry.dogName,
      ]),
    );

    const authoritativeNameByDogId = new Map<number, string>();

    for (const row of importedEntryRows ?? []) {
      const raceNumber = raceNumberById.get(Number(row.race_id));
      const boxNumber = Number(row.box_number);
      const dogId = Number(row.dog_id);

      if (
        !Number.isInteger(raceNumber) ||
        !Number.isInteger(boxNumber) ||
        !Number.isFinite(dogId)
      ) {
        continue;
      }

      const dogName = authoritativeNameByRaceBox.get(
        `${raceNumber}:${boxNumber}`,
      );

      if (dogName) {
        authoritativeNameByDogId.set(dogId, dogName);
      }
    }

    for (const [dogId, dogName] of authoritativeNameByDogId) {
      const { error: dogUpdateError } = await admin
        .from("greyhound_dogs")
        .update({
          display_name: dogName,
          updated_at: new Date().toISOString(),
        })
        .eq("id", dogId);

      if (dogUpdateError) {
        return NextResponse.json(
          {
            error:
              `Entries were imported, but authoritative dog name "${dogName}" ` +
              `could not be synchronized: ${dogUpdateError.message}`,
          },
          { status: 500 },
        );
      }
    }

    return NextResponse.json({
      success: true,
      trackCode,
      trackName,
      entriesImported: entries.length,
      dogNamesSynchronized: authoritativeNameByDogId.size,
      ...(
        data && typeof data === "object"
          ? data
          : { result: data }
      ),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Entries import failed.",
      },
      { status: 500 },
    );
  }
}