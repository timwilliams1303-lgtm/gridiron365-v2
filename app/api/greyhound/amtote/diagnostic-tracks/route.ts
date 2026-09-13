import { NextResponse } from "next/server";

import { getAmtoteGetTracksDiagnostic } from "@/lib/greyhound/amtote";

function hasValidSyncSecret(request: Request): boolean {
  const expected = process.env.GRIDIRON_SYNC_SECRET;
  const supplied = request.headers.get("x-gridiron-sync-secret");

  return Boolean(expected && supplied && supplied === expected);
}

export async function GET(request: Request) {
  if (!hasValidSyncSecret(request)) {
    return NextResponse.json(
      {
        success: false,
        error: "Unauthorized.",
      },
      { status: 401 },
    );
  }

  try {
    const diagnostic = await getAmtoteGetTracksDiagnostic();

    return NextResponse.json({
      success: true,
      checkedAt: new Date().toISOString(),
      decodedPayload: diagnostic.decodedPayload,
    });
  } catch (error) {
    console.error("AmTote GetTracks diagnostic failed:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "AmTote GetTracks diagnostic failed.",
      },
      { status: 500 },
    );
  }
}