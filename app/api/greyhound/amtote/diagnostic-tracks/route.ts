import { NextResponse } from "next/server";

import {
  getAmtoteGetTracksUSOControlDiagnostic,
} from "@/lib/greyhound/amtote";

function hasValidSyncSecret(request: Request): boolean {
  const expected = process.env.GRIDIRON_SYNC_SECRET;
  const supplied = request.headers.get("x-gridiron-sync-secret");

  return Boolean(
    expected &&
      supplied &&
      supplied === expected,
  );
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
    const diagnostic =
      await getAmtoteGetTracksUSOControlDiagnostic();

    return NextResponse.json({
      success: true,
      method: "GetTracksUSOControl",
      checkedAt: new Date().toISOString(),
      decodedPayload: diagnostic.decodedPayload,
    });
  } catch (error) {
    console.error(
      "AmTote GetTracksUSOControl diagnostic failed:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        method: "GetTracksUSOControl",
        error:
          error instanceof Error
            ? error.message
            : "AmTote GetTracksUSOControl diagnostic failed.",
      },
      { status: 500 },
    );
  }
}
