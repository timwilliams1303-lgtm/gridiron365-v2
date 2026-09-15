import { NextResponse } from "next/server";

import { requireLeagueMember } from "@/lib/leagues/requireLeagueMember";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function clean(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text || null;
}

function validTrack(value: unknown): "GWD" | "GTS" | null {
  const code = clean(value)?.toUpperCase();
  return code === "GWD" || code === "GTS" ? code : null;
}

function validDate(value: unknown): string | null {
  const date = clean(value);
  return date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
}

function positiveInt(value: unknown): number | null {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

async function authorize(leagueId: string) {
  const access = await requireLeagueMember(leagueId);

  if (String(access.league.leagueType) !== "greyhound") {
    throw new Error("This endpoint is only available for Greyhound leagues.");
  }

  return access;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const leagueId = clean(url.searchParams.get("leagueId"));
    const trackCode = validTrack(url.searchParams.get("trackCode"));
    const programDate = validDate(url.searchParams.get("programDate"));
    const raceNumber = positiveInt(url.searchParams.get("raceNumber"));

    if (!leagueId || !trackCode || !programDate || !raceNumber) {
      return NextResponse.json(
        {
          success: false,
          message:
            "leagueId, trackCode, programDate, and raceNumber are required.",
        },
        { status: 400 },
      );
    }

    await authorize(leagueId);

    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from("greyhound_race_program_pages")
      .select(
        "id,track_code,program_date,race_number,page_number,image_data_url,source_file_name",
      )
      .eq("track_code", trackCode)
      .eq("program_date", programDate)
      .eq("race_number", raceNumber)
      .maybeSingle();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      programPage: data
        ? {
            id: Number(data.id),
            trackCode: data.track_code,
            programDate: data.program_date,
            raceNumber: Number(data.race_number),
            pageNumber: Number(data.page_number),
            imageDataUrl: data.image_data_url,
            sourceFileName: data.source_file_name,
          }
        : null,
    });
  } catch (error) {
    console.error("Greyhound Program page GET failed:", error);

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Could not load the official Program page.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as
      | {
          leagueId?: unknown;
          trackCode?: unknown;
          programDate?: unknown;
          raceNumber?: unknown;
          pageNumber?: unknown;
          imageDataUrl?: unknown;
          sourceFileName?: unknown;
        }
      | null;

    const leagueId = clean(body?.leagueId);
    const trackCode = validTrack(body?.trackCode);
    const programDate = validDate(body?.programDate);
    const raceNumber = positiveInt(body?.raceNumber);
    const pageNumber = positiveInt(body?.pageNumber);
    const imageDataUrl = clean(body?.imageDataUrl);
    const sourceFileName = clean(body?.sourceFileName);

    if (
      !leagueId ||
      !trackCode ||
      !programDate ||
      !raceNumber ||
      !pageNumber ||
      !imageDataUrl
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "leagueId, trackCode, programDate, raceNumber, pageNumber, and imageDataUrl are required.",
        },
        { status: 400 },
      );
    }

    if (!imageDataUrl.startsWith("data:image/")) {
      return NextResponse.json(
        {
          success: false,
          message: "Official Program page must be an image data URL.",
        },
        { status: 400 },
      );
    }

    // For the supported official programs, page N is race N.
    if (pageNumber !== raceNumber) {
      return NextResponse.json(
        {
          success: false,
          message: `Program Page ${pageNumber} must be saved as Race ${pageNumber}.`,
        },
        { status: 400 },
      );
    }

    const access = await authorize(leagueId);

    if (!access.isCommissioner) {
      return NextResponse.json(
        {
          success: false,
          message: "Only the league commissioner can save Program pages.",
        },
        { status: 403 },
      );
    }

    const admin = createSupabaseAdminClient();
    const now = new Date().toISOString();

    const { data, error } = await admin
      .from("greyhound_race_program_pages")
      .upsert(
        {
          track_code: trackCode,
          program_date: programDate,
          race_number: raceNumber,
          page_number: pageNumber,
          image_data_url: imageDataUrl,
          source_file_name: sourceFileName,
          source: "commissioner_program",
          updated_at: now,
        },
        {
          onConflict: "track_code,program_date,race_number",
        },
      )
      .select("id")
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      id: Number(data.id),
      trackCode,
      programDate,
      raceNumber,
      pageNumber,
    });
  } catch (error) {
    console.error("Greyhound Program page POST failed:", error);

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Could not save the official Program page.",
      },
      { status: 500 },
    );
  }
}