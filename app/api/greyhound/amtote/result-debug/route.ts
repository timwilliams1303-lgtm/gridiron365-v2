import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const AMTOTE_URL = "https://uso.rosnet2000.com/wsUSO.asmx";
const AMTOTE_NAMESPACE = "http://gws.amtote.com/";

function xmlEscape(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function getSyncSecret(request: NextRequest) {
  return request.headers.get("x-gridiron-sync-secret")?.trim() ?? "";
}

function isAuthorized(request: NextRequest) {
  const expected = process.env.GRIDIRON_SYNC_SECRET?.trim();

  if (!expected) {
    return false;
  }

  return getSyncSecret(request) === expected;
}

async function callAmtoteSoap(
  method: string,
  innerXml: string,
): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const body = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:xsd="http://www.w3.org/2001/XMLSchema"
  xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
>
  <soap:Body>
    <${method} xmlns="${AMTOTE_NAMESPACE}">
      ${innerXml}
    </${method}>
  </soap:Body>
</soap:Envelope>`;

    const response = await fetch(AMTOTE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction: `"${AMTOTE_NAMESPACE}${method}"`,
      },
      body,
      cache: "no-store",
      signal: controller.signal,
    });

    const text = await response.text();

    if (!response.ok) {
      throw new Error(
        `AmTote ${method} HTTP ${response.status}: ${text.slice(0, 1000)}`,
      );
    }

    return text;
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      {
        success: false,
        error: "Unauthorized",
      },
      {
        status: 401,
      },
    );
  }

  const searchParams = request.nextUrl.searchParams;

  const track =
    searchParams.get("track")?.trim().toUpperCase() ?? "";

  const date =
    searchParams.get("date")?.trim() ?? "";

  const raceRaw =
    searchParams.get("race")?.trim() ?? "";

  const race = Number(raceRaw);

  if (!["WEM", "TSE"].includes(track)) {
    return NextResponse.json(
      {
        success: false,
        error: "track must be WEM or TSE",
      },
      {
        status: 400,
      },
    );
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      {
        success: false,
        error: "date must use YYYY-MM-DD",
      },
      {
        status: 400,
      },
    );
  }

  if (!Number.isInteger(race) || race < 1 || race > 99) {
    return NextResponse.json(
      {
        success: false,
        error: "race must be a valid race number",
      },
      {
        status: 400,
      },
    );
  }

  try {
    const safeTrack = xmlEscape(track);
    const safeDate = xmlEscape(date);
    const safeRace = xmlEscape(String(race));

    const [singleRaceResult, cardResults] =
      await Promise.all([
        callAmtoteSoap(
          "GetRaceResult",
          `
<tid>${safeTrack}</tid>
<dat>${safeDate}</dat>
<rac>${safeRace}</rac>
          `.trim(),
        ),

        callAmtoteSoap(
          "GetRaceResults",
          `
<tid>${safeTrack}</tid>
<dat>${safeDate}</dat>
          `.trim(),
        ),
      ]);

    return NextResponse.json({
      success: true,
      track,
      date,
      race,
      getRaceResult: singleRaceResult,
      getRaceResults: cardResults,
    });
  } catch (error) {
    console.error(
      "[greyhound/amtote/result-debug]",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        track,
        date,
        race,
        error:
          error instanceof Error
            ? error.message
            : "Unknown AmTote result debug error",
      },
      {
        status: 500,
      },
    );
  }
}