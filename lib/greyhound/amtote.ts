import "server-only";

const AMTOTE_ENDPOINT = "https://uso.rosnet2000.com/wsUSO.asmx";
const AMTOTE_NAMESPACE = "http://gws.amtote.com/";

export type G365GreyhoundTrackCode = "GWD" | "GTS";
export type AmtoteTrackId = "WEM" | "TSE";

export type AmtoteRunner = {
  starter: number | null;
  post: number | null;
  alternate: string | null;
  name: string;
  morningLine: string | null;
  liveOdds: string | null;
  probable: string | null;
  scratched: boolean;
  image: string | null;
  jockeyOrTrainer: string | null;
};

export type AmtoteRace = {
  trackId: string;
  trackName: string;
  raceDate: string;
  signal: string | null;
  raceNumber: number;
  grade: string | null;
  distanceYards: number | null;
  postTimeRaw: string | null;
  maxRunners: number | null;
  activeBoxes: number[];
  scratchedBoxes: number[];
  resultsAvailable: boolean;
  replayAvailable: boolean;
  raceOffFlag: boolean;
  minutesToPost: number | null;
  runners: AmtoteRunner[];
};

export type AmtoteRaceCard = {
  trackId: AmtoteTrackId;
  g365TrackCode: G365GreyhoundTrackCode;
  raceDate: string;
  signal: string | null;
  session: string;
  races: AmtoteRace[];
};

const TRACK_MAP: Record<AmtoteTrackId, G365GreyhoundTrackCode> = {
  WEM: "GWD",
  TSE: "GTS",
};

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function decodeXml(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .trim();
}

function tagValue(xml: string, tag: string): string {
  const escapedTag = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = xml.match(
    new RegExp(`<${escapedTag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escapedTag}>`, "i"),
  );

  return match ? decodeXml(match[1].replace(/<[^>]+>/g, "")) : "";
}

function blocks(xml: string, tag: string): string[] {
  const escapedTag = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const expression = new RegExp(
    `<${escapedTag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escapedTag}>`,
    "gi",
  );
  const values: string[] = [];

  let match: RegExpExecArray | null;
  while ((match = expression.exec(xml)) !== null) {
    values.push(match[1]);
  }

  return values;
}

function nullableText(value: string): string | null {
  const cleaned = value.trim();
  return cleaned ? cleaned : null;
}

function nullableNumber(value: string): number | null {
  const cleaned = value.trim();
  if (!cleaned) return null;

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseCsvNumbers(value: string): number[] {
  if (!value.trim()) return [];

  return value
    .split(",")
    .map((part) => Number(part.trim()))
    .filter((part) => Number.isInteger(part) && part >= 1 && part <= 8);
}

function parseBoolean(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "y";
}

function normalizeDate(value: string): string {
  const trimmed = value.trim();
  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const us = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (us) {
    return `${us[3]}-${us[1].padStart(2, "0")}-${us[2].padStart(2, "0")}`;
  }

  throw new Error(`AmTote returned an unsupported race date: ${trimmed || "(blank)"}`);
}

function sessionFromSignal(signal: string | null): string {
  const normalized = signal?.trim().toUpperCase();
  if (normalized === "E" || normalized === "N") return "evening";
  return "afternoon";
}

async function soapRequest(method: string, body: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const response = await fetch(AMTOTE_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction: `"${AMTOTE_NAMESPACE}${method}"`,
      },
      body: `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <${method} xmlns="${AMTOTE_NAMESPACE}">${body}</${method}>
  </soap:Body>
</soap:Envelope>`,
      cache: "no-store",
      signal: controller.signal,
    });

    const text = await response.text();

    if (!response.ok) {
      throw new Error(`AmTote ${method} returned HTTP ${response.status}.`);
    }

    const fault = tagValue(text, "faultstring");
    if (fault) {
      throw new Error(`AmTote ${method} SOAP fault: ${fault}`);
    }

    return text;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`AmTote ${method} timed out after 15 seconds.`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function g365TrackCodeForAmtote(trackId: string): G365GreyhoundTrackCode {
  const normalized = trackId.trim().toUpperCase() as AmtoteTrackId;
  const code = TRACK_MAP[normalized];

  if (!code) {
    throw new Error(`Unsupported AmTote Greyhound track ID: ${trackId}`);
  }

  return code;
}

export async function getAmtoteRaces(trackId: AmtoteTrackId): Promise<AmtoteRaceCard> {
  const xml = await soapRequest("GetRaces", `<tid>${escapeXml(trackId)}</tid>`);
  const resultBlock = blocks(xml, "GetRacesResult")[0] ?? "";
  const status = tagValue(resultBlock, "exm").toLowerCase();

  if (status && status !== "success") {
    throw new Error(`AmTote GetRaces failed for ${trackId}: ${status}`);
  }

  const raceBlocks = blocks(resultBlock, "raceinfo");
  if (raceBlocks.length === 0) {
    throw new Error(`AmTote returned no races for ${trackId}.`);
  }

  const races: AmtoteRace[] = raceBlocks.map((raceXml) => {
    const nestedRunnerBlocks = blocks(raceXml, "runnersinfo");
    const runners: AmtoteRunner[] = nestedRunnerBlocks.map((runnerXml) => ({
      starter: nullableNumber(tagValue(runnerXml, "stl")),
      post: nullableNumber(tagValue(runnerXml, "pst")),
      alternate: nullableText(tagValue(runnerXml, "alt")),
      name: tagValue(runnerXml, "nam").trim(),
      morningLine: nullableText(tagValue(runnerXml, "mln")),
      liveOdds: nullableText(tagValue(runnerXml, "odd")),
      probable: nullableText(tagValue(runnerXml, "prb")),
      scratched: parseBoolean(tagValue(runnerXml, "scr")),
      image: nullableText(tagValue(runnerXml, "img")),
      jockeyOrTrainer: nullableText(tagValue(runnerXml, "jky")),
    }));

    const rawGrade = tagValue(raceXml, "znh") || tagValue(raceXml, "grd");
    const normalizedGrade = rawGrade.trim().toLowerCase() === "n/a" ? "" : rawGrade;

    return {
      trackId: tagValue(raceXml, "tid").trim(),
      trackName: tagValue(raceXml, "trk").trim(),
      raceDate: normalizeDate(tagValue(raceXml, "dat")),
      signal: nullableText(tagValue(raceXml, "sig")),
      raceNumber: Number(tagValue(raceXml, "rac")),
      grade: nullableText(normalizedGrade),
      distanceYards: nullableNumber(tagValue(raceXml, "dst")),
      postTimeRaw: nullableText(tagValue(raceXml, "ptm")),
      maxRunners: nullableNumber(tagValue(raceXml, "mxr")),
      activeBoxes: parseCsvNumbers(tagValue(raceXml, "run")),
      scratchedBoxes: parseCsvNumbers(tagValue(raceXml, "scr")),
      resultsAvailable: parseBoolean(tagValue(raceXml, "res")),
      replayAvailable: parseBoolean(tagValue(raceXml, "rep")),
      raceOffFlag: parseBoolean(tagValue(raceXml, "rof")),
      minutesToPost: nullableNumber(tagValue(raceXml, "mtp")),
      runners,
    };
  });

  const validRaces = races
    .filter((race) => Number.isInteger(race.raceNumber) && race.raceNumber > 0)
    .sort((a, b) => a.raceNumber - b.raceNumber);

  if (validRaces.length === 0) {
    throw new Error(`AmTote returned no valid races for ${trackId}.`);
  }

  const dates = new Set(validRaces.map((race) => race.raceDate));
  if (dates.size !== 1) {
    throw new Error(`AmTote returned mixed race dates for ${trackId}; refusing to import.`);
  }

  const raceDate = validRaces[0].raceDate;
  const signal = validRaces[0].signal;

  return {
    trackId,
    g365TrackCode: g365TrackCodeForAmtote(trackId),
    raceDate,
    signal,
    session: sessionFromSignal(signal),
    races: validRaces,
  };
}