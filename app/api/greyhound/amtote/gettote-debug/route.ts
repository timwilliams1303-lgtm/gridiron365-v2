import { NextRequest, NextResponse } from "next/server";

import {
  getAmtoteGetToteDiagnostic,
  type AmtoteTrackId,
} from "@/lib/greyhound/amtote";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function hasValidSyncSecret(request: NextRequest): boolean {
  const expected = process.env.GRIDIRON_SYNC_SECRET;
  const provided = request.headers.get("x-gridiron-sync-secret");

  return Boolean(expected && provided && provided === expected);
}

function isAmtoteTrackId(value: string | null): value is AmtoteTrackId {
  return value === "WEM" || value === "TSE";
}

export async function GET(request: NextRequest) {
  if (!hasValidSyncSecret(request)) {
    return NextResponse.json(
      { success: false, error: "Unauthorized." },
      {
        status: 401,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  const requestedTrack = request.nextUrl.searchParams
    .get("track")
    ?.trim()
    .toUpperCase() ?? null;

  if (requestedTrack && !isAmtoteTrackId(requestedTrack)) {
    return NextResponse.json(
      {
        success: false,
        error: "track must be WEM or TSE when provided.",
      },
      {
        status: 400,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  const trackIds: AmtoteTrackId[] = isAmtoteTrackId(requestedTrack)
    ? [requestedTrack]
    : ["WEM", "TSE"];

  try {
    const results = await Promise.all(
      trackIds.map(async (trackId) => {
        const diagnostic = await getAmtoteGetToteDiagnostic(trackId);

        return {
          trackId,
          rawSoapLength: diagnostic.rawSoapXml.length,
          decodedPayloadLength: diagnostic.decodedPayload.length,
          rawSoapXml: diagnostic.rawSoapXml,
          decodedPayload: diagnostic.decodedPayload,
        };
      }),
    );

    return NextResponse.json(
      {
        success: true,
        fetchedAt: new Date().toISOString(),
        results,
      },
      {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        fetchedAt: new Date().toISOString(),
        error:
          error instanceof Error
            ? error.message
            : "Unknown AmTote GetTote diagnostic error.",
      },
      {
        status: 500,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
