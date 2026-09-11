import { NextResponse } from "next/server";

import { requireLeagueMember } from "@/lib/leagues/requireLeagueMember";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type TrackCode = "GWD" | "GTS";

type BackupContext = {
  trackCode?: TrackCode;
  raceDate?: string;
  session?: string;
};

type RacePayload = {
  track?: string;
  raceNumber?: number;
  raceDate?: string | null;
  raceTime?: string | null;
  grade?: string | null;
  distance?: string | null;
  prizeMoney?: string | null;
  weather?: string | null;
  trackCondition?: string | null;
  runners?: unknown[];
  [key: string]: unknown;
};

type RequestBody = {
  leagueId?: string;
  backup?: BackupContext;
  race?: RacePayload;
};

function normalizeTrackCode(value: unknown): TrackCode | null {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();

  if (
    normalized === "gwd" ||
    normalized === "wheeling" ||
    normalized === "wheeling island" ||
    normalized === "wheeling island greyhound" ||
    normalized === "wheeling island greyhound racing"
  ) {
    return "GWD";
  }

  if (
    normalized === "gts" ||
    normalized === "tri-state" ||
    normalized === "tri state" ||
    normalized === "tri-state greyhound" ||
    normalized === "tri state greyhound"
  ) {
    return "GTS";
  }

  return null;
}

function validIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as RequestBody | null;

    const leagueId =
      typeof body?.leagueId === "string"
        ? body.leagueId.trim()
        : "";

    if (!leagueId) {
      return NextResponse.json(
        { success: false, message: "leagueId is required." },
        { status: 400 },
      );
    }

    const access = await requireLeagueMember(leagueId);

    if (String(access.league.leagueType) !== "greyhound") {
      return NextResponse.json(
        {
          success: false,
          message: "This endpoint is only available for Greyhound leagues.",
        },
        { status: 400 },
      );
    }

    if (!access.isCommissioner) {
      return NextResponse.json(
        {
          success: false,
          message: "Only the league commissioner can use the manual Greyhound backup importer.",
        },
        { status: 403 },
      );
    }

    const backupTrackCode = normalizeTrackCode(body?.backup?.trackCode);
    const raceTrackCode = normalizeTrackCode(body?.race?.track);
    const backupRaceDate =
      typeof body?.backup?.raceDate === "string"
        ? body.backup.raceDate.trim()
        : "";
    const raceDate =
      typeof body?.race?.raceDate === "string"
        ? body.race.raceDate.trim()
        : "";
    const session =
      typeof body?.backup?.session === "string"
        ? body.backup.session.trim().toLowerCase()
        : "";

    if (!backupTrackCode || !backupRaceDate || !session) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Manual backup requires an exact track, race date, and session.",
        },
        { status: 400 },
      );
    }

    if (!validIsoDate(backupRaceDate)) {
      return NextResponse.json(
        {
          success: false,
          message: "The manual backup race date is invalid.",
        },
        { status: 400 },
      );
    }

    if (!body?.race || !raceTrackCode || !raceDate) {
      return NextResponse.json(
        {
          success: false,
          message: "The parsed race is missing its track or race date.",
        },
        { status: 400 },
      );
    }

    if (raceTrackCode !== backupTrackCode) {
      return NextResponse.json(
        {
          success: false,
          message: `This backup is locked to ${backupTrackCode}; the parsed race belongs to ${raceTrackCode}.`,
        },
        { status: 409 },
      );
    }

    if (raceDate !== backupRaceDate) {
      return NextResponse.json(
        {
          success: false,
          message: `This backup is locked to ${backupRaceDate}; the parsed race belongs to ${raceDate}.`,
        },
        { status: 409 },
      );
    }

    const raceNumber = Number(body.race.raceNumber);

    if (!Number.isInteger(raceNumber) || raceNumber <= 0) {
      return NextResponse.json(
        {
          success: false,
          message: "A valid race number is required.",
        },
        { status: 400 },
      );
    }

    if (!Array.isArray(body.race.runners) || body.race.runners.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "The race must contain at least one runner.",
        },
        { status: 400 },
      );
    }

    const supabase = createSupabaseAdminClient();

    const { data: track, error: trackError } = await supabase
      .from("greyhound_tracks")
      .select("id, code, name")
      .eq("code", backupTrackCode)
      .eq("active", true)
      .maybeSingle();

    if (trackError) {
      throw trackError;
    }

    if (!track) {
      return NextResponse.json(
        {
          success: false,
          message: `Active Greyhound track ${backupTrackCode} was not found.`,
        },
        { status: 404 },
      );
    }

    const { data: feedFailure, error: feedFailureError } = await supabase
      .from("greyhound_feed_sync_status")
      .select(
        "id, status, source, error_message, last_attempt_at",
      )
      .eq("track_id", track.id)
      .eq("race_date", backupRaceDate)
      .eq("session", session)
      .eq("source", "amtote")
      .maybeSingle();

    if (feedFailureError) {
      throw feedFailureError;
    }

    if (!feedFailure || feedFailure.status !== "failed") {
      return NextResponse.json(
        {
          success: false,
          message:
            "Manual import is not available for this track/date/session because the official AmTote feed has not failed for it.",
        },
        { status: 409 },
      );
    }

    const { data: existingCard, error: existingCardError } = await supabase
      .from("greyhound_cards")
      .select("id, card_status")
      .eq("track_id", track.id)
      .eq("race_date", backupRaceDate)
      .eq("session", session)
      .maybeSingle();

    if (existingCardError) {
      throw existingCardError;
    }

    if (
      existingCard &&
      ["locked", "in_progress", "final", "cancelled"].includes(
        existingCard.card_status,
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message: `Manual import is closed because this card is ${existingCard.card_status}.`,
        },
        { status: 409 },
      );
    }

    const racePayload = {
      ...body.race,
      track: backupTrackCode,
      raceDate: backupRaceDate,
      source: "commissioner_backup",
    };

    const { data, error } = await supabase.rpc(
      "g365_greyhound_import_race",
      {
        p_track_code: backupTrackCode,
        p_race: racePayload,
        p_session: session,
      },
    );

    if (error) {
      return NextResponse.json(
        {
          success: false,
          message: error.message,
        },
        { status: 400 },
      );
    }

    return NextResponse.json({
      success: true,
      race: data,
      message: `${track.name} Race ${raceNumber} imported through the day-specific manual backup.`,
    });
  } catch (error) {
    console.error("Greyhound manual backup import failed:", error);

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "The Greyhound manual backup import failed.",
      },
      { status: 500 },
    );
  }
}
