import { NextRequest, NextResponse } from "next/server";

import { getAmtoteGetTracksDiagnostic } from "@/lib/greyhound/amtote";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function hasValidSyncSecret(request: NextRequest): boolean {
  const expected = process.env.GRIDIRON_SYNC_SECRET;
  const provided = request.headers.get("x-gridiron-sync-secret");

  return Boolean(expected && provided && provided === expected);
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

  try {
    const diagnostic = await getAmtoteGetTracksDiagnostic();

    return NextResponse.json(
      {
        success: true,
        fetchedAt: new Date().toISOString(),
        rawSoapLength: diagnostic.rawSoapXml.length,
        decodedPayloadLength: diagnostic.decodedPayload.length,
        rawSoapXml: diagnostic.rawSoapXml,
        decodedPayload: diagnostic.decodedPayload,
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
            : "Unknown AmTote GetTracks diagnostic error.",
      },
      {
        status: 500,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
