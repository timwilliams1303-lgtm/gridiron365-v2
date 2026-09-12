import "server-only";

const AMTOTE_ENDPOINT = "https://uso.rosnet2000.com/wsUSO.asmx";
const AMTOTE_NAMESPACE = "http://gws.amtote.com/";

export type AmtoteTrackId = "WEM" | "TSE";
export type G365GreyhoundTrackCode = "GWD" | "GTS";

export type AmtoteRunner = {
  starter: number | null;
  post: number | null;
  alternate: number | null;
  name: string | null;
  tag: string | null;
  morningLine: string | null;
  odds: string | null;
  probability: string | null;
  scratched: boolean;
  silk: string | null;
  image: string | null;
  jockey: string | null;
};

export type AmtoteRace = {
  trackId: AmtoteTrackId;
  trackName: string | null;
  raceDate: string;
  signal: string | null;
  raceNumber: number;
  grade: string | null;
  distanceYards: number | null;
  postTimeText: string | null;
  maxRunners: number | null;
  runningBoxes: number[];
  scratchedBoxes: number[];
  resultText: string | null;
  replayText: string | null;
  raceOffFlag: boolean;
  resultsAvailable: boolean;
  minutesToPost: number | null;
  runners: AmtoteRunner[];
};

export type AmtoteRaceCard = {
  trackId: AmtoteTrackId;
  g365TrackCode: G365GreyhoundTrackCode;
  raceDate: string;
  signal: string | null;
  session: "morning" | "afternoon" | "evening" | "night";
  races: AmtoteRace[];
};

export type AmtoteToteState = {
  trackId: AmtoteTrackId;
  currentRaceNumber: number | null;
  minutesToPost: number | null;
  poolTotal: string | null;
  odds: string | null;
};

export type AmtoteTrackState = {
  trackId: AmtoteTrackId;
  trackCode: string | null;
  trackName: string | null;
  raceDate: string | null;
  signal: string | null;
  sport: string | null;
  currentRaceNumber: number | null;
  numberOfRaces: number | null;
  minutesToPost: number | null;
  status: string | null;
  done: boolean;
};

export type AmtoteRaceResultRow = {
  sort: number | null;
  raceDate: string | null;
  trackId: string | null;
  raceNumber: number | null;
  signal: string | null;
  sport: string | null;
  trackName: string | null;
  poolCode: string | null;
  template: string | null;
  baseAmount: number | null;
  text: string | null;
  name: string | null;
  finishPosition: number | null;
  winPayout: number | null;
  placePayout: number | null;
  showPayout: number | null;
  payout: number | null;
  replay: number | null;
};

export type AmtoteDetailedRaceResult = {
  trackId: AmtoteTrackId;
  raceDate: string;
  raceNumber: number;
  reportReady: boolean;
  rows: AmtoteRaceResultRow[];
};

export type AmtoteRaceResultsSummaryRow = {
  raceNumber: number;
  topFour: number[];
  rawText: string;
};

export type AmtoteRaceResultsSummary = {
  trackId: AmtoteTrackId;
  raceDate: string;
  signal: string | null;
  currentRaceNumber: number | null;
  rows: AmtoteRaceResultsSummaryRow[];
};

function xmlDecode(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function stripCdata(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith("<![CDATA[") && trimmed.endsWith("]]>")) {
    return trimmed.slice(9, -3);
  }
  return trimmed;
}

function tagValue(xml: string, tag: string): string | null {
  const expression = new RegExp(
    `<(?:\\w+:)?${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:\\w+:)?${tag}>`,
    "i",
  );
  const match = xml.match(expression);
  if (!match) return null;
  return xmlDecode(stripCdata(match[1])).trim() || null;
}

function allBlocks(xml: string, tag: string): string[] {
  const expression = new RegExp(
    `<(?:\\w+:)?${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:\\w+:)?${tag}>`,
    "gi",
  );

  const blocks: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = expression.exec(xml)) !== null) {
    blocks.push(match[1]);
  }

  return blocks;
}

function numberOrNull(value: string | null): number | null {
  if (!value) return null;

  const cleaned = value
    .trim()
    .replace(/[$,]/g, "")
    .replace(/^of\d+\s+/i, "");

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function intOrNull(value: string | null): number | null {
  const parsed = numberOrNull(value);
  return parsed === null ? null : Math.trunc(parsed);
}

function boolValue(value: string | null): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
}

/**
 * AmTote uses <res> and <rep> as availability flags in GetRaces.
 *
 * A value of "0" means the result/replay is NOT available. Treating any
 * non-empty string as truthy incorrectly turns "0" into an official result.
 *
 * Keep this helper slightly defensive in case the feed returns another
 * documented truthy/falsey representation later.
 */
function feedAvailabilityFlag(value: string | null): boolean {
  if (!value) return false;

  const normalized = value.trim().toLowerCase();

  if (
    normalized === "" ||
    normalized === "0" ||
    normalized === "false" ||
    normalized === "no" ||
    normalized === "null" ||
    normalized === "n/a"
  ) {
    return false;
  }

  if (
    normalized === "1" ||
    normalized === "true" ||
    normalized === "yes" ||
    normalized === "y"
  ) {
    return true;
  }

  const numeric = Number(normalized);
  if (Number.isFinite(numeric)) {
    return numeric > 0;
  }

  // If AmTote ever returns a non-empty non-numeric marker here, preserve
  // forward compatibility by treating it as available rather than silently
  // discarding a legitimate signal.
  return true;
}

function csvInts(value: string | null): number[] {
  if (!value) return [];

  return value
    .split(",")
    .map((part) => Number(part.trim()))
    .filter((part) => Number.isInteger(part) && part >= 1 && part <= 8);
}

function normalizeFeedDate(value: string | null): string | null {
  if (!value) return null;

  const raw = value.trim();

  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const us = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (us) {
    return `${us[3]}-${us[1].padStart(2, "0")}-${us[2].padStart(2, "0")}`;
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return null;
}

function sessionFromSignal(
  signal: string | null,
): "morning" | "afternoon" | "evening" | "night" {
  const normalized = (signal ?? "").trim().toUpperCase();

  if (normalized === "E" || normalized === "N") {
    return "evening";
  }

  if (normalized === "M") {
    return "morning";
  }

  return "afternoon";
}

function parseTopFour(value: string | null): number[] {
  if (!value) return [];

  return value
    .split(/[^0-9]+/)
    .map((part) => Number(part))
    .filter((part) => Number.isInteger(part) && part >= 1 && part <= 8)
    .slice(0, 4);
}

export function g365TrackCodeForAmtote(
  trackId: AmtoteTrackId,
): G365GreyhoundTrackCode {
  return trackId === "WEM" ? "GWD" : "GTS";
}

async function soapRequest(
  method: string,
  bodyXml: string,
): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(AMTOTE_ENDPOINT, {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction: `${AMTOTE_NAMESPACE}${method}`,
      },
      body: `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
               xmlns:xsd="http://www.w3.org/2001/XMLSchema"
               xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <${method} xmlns="${AMTOTE_NAMESPACE}">
      ${bodyXml}
    </${method}>
  </soap:Body>
</soap:Envelope>`,
      signal: controller.signal,
    });

    const text = await response.text();

    if (!response.ok) {
      throw new Error(
        `AmTote ${method} failed with HTTP ${response.status}: ${text.slice(0, 500)}`,
      );
    }

    const fault = tagValue(text, "faultstring");
    if (fault) {
      throw new Error(`AmTote ${method} SOAP fault: ${fault}`);
    }

    return text;
  } finally {
    clearTimeout(timeout);
  }
}

function resultPayload(xml: string, method: string): string {
  const direct =
    tagValue(xml, `${method}Result`) ??
    tagValue(xml, "string");

  return direct ? xmlDecode(direct) : xml;
}

function assertAmtoteSuccess(
  payload: string,
  method: string,
  trackId: AmtoteTrackId,
) {
  const exm = (tagValue(payload, "exm") ?? "").trim();

  if (exm && exm.toLowerCase() !== "success") {
    throw new Error(
      `AmTote ${method} failed for ${trackId}: ${exm}`,
    );
  }
}

function parseRunner(block: string): AmtoteRunner {
  return {
    starter: intOrNull(tagValue(block, "stl")),
    post: intOrNull(tagValue(block, "pst")),
    alternate: intOrNull(tagValue(block, "alt")),
    name: tagValue(block, "nam"),
    tag: tagValue(block, "tag"),
    morningLine: tagValue(block, "mln"),
    odds: tagValue(block, "odd"),
    probability: tagValue(block, "prb"),
    scratched: boolValue(tagValue(block, "scr")),
    silk: tagValue(block, "slk"),
    image: tagValue(block, "img"),
    jockey: tagValue(block, "jky"),
  };
}

function parseRace(block: string, trackId: AmtoteTrackId): AmtoteRace | null {
  const raceNumber = intOrNull(tagValue(block, "rac"));
  const raceDate = normalizeFeedDate(tagValue(block, "dat"));

  if (!raceNumber || !raceDate) return null;

  const nestedRunnerBlocks = [
    ...allBlocks(block, "runnersinfo"),
    ...allBlocks(block, "runnerinfo"),
  ];

  const runners =
    nestedRunnerBlocks.length > 0
      ? nestedRunnerBlocks.map(parseRunner)
      : allBlocks(block, "runner").map(parseRunner);

  const raceOffRaw =
    tagValue(block, "rof") ??
    tagValue(block, "off");

  const resultText = tagValue(block, "res");
  const replayText = tagValue(block, "rep");

  return {
    trackId,
    trackName: tagValue(block, "trk"),
    raceDate,
    signal: tagValue(block, "sig"),
    raceNumber,
    grade: tagValue(block, "znh") ?? tagValue(block, "grd"),
    distanceYards: intOrNull(tagValue(block, "dst")),
    postTimeText: tagValue(block, "ptm"),
    maxRunners: intOrNull(tagValue(block, "mxr")),
    runningBoxes: csvInts(tagValue(block, "run")),
    scratchedBoxes: csvInts(tagValue(block, "scr")),
    resultText,
    replayText,
    raceOffFlag: boolValue(raceOffRaw),
    resultsAvailable:
      feedAvailabilityFlag(resultText) ||
      feedAvailabilityFlag(replayText),
    minutesToPost: intOrNull(tagValue(block, "mtp")),
    runners,
  };
}

function parseDetailedResultRow(block: string): AmtoteRaceResultRow {
  return {
    sort: intOrNull(tagValue(block, "srt")),
    raceDate: normalizeFeedDate(tagValue(block, "dat")),
    trackId: tagValue(block, "tid")?.trim() ?? null,
    raceNumber: intOrNull(tagValue(block, "rac")),
    signal: tagValue(block, "sig"),
    sport: tagValue(block, "spt"),
    trackName: tagValue(block, "trk"),
    poolCode: tagValue(block, "tps"),
    template: tagValue(block, "tpl"),
    baseAmount: numberOrNull(tagValue(block, "dol")),
    text: tagValue(block, "txt"),
    name: tagValue(block, "nam"),
    finishPosition: intOrNull(tagValue(block, "fin")),
    winPayout: numberOrNull(tagValue(block, "win")),
    placePayout: numberOrNull(tagValue(block, "plc")),
    showPayout: numberOrNull(tagValue(block, "shw")),
    payout: numberOrNull(tagValue(block, "pay")),
    replay: intOrNull(tagValue(block, "rep")),
  };
}

export async function getAmtoteRaces(
  trackId: AmtoteTrackId,
): Promise<AmtoteRaceCard> {
  const xml = await soapRequest(
    "GetRaces",
    `<tid>${xmlEscape(trackId)}</tid>`,
  );

  const payload = resultPayload(xml, "GetRaces");
  assertAmtoteSuccess(payload, "GetRaces", trackId);

  let raceBlocks = allBlocks(payload, "raceinfo");

  if (raceBlocks.length === 0) {
    raceBlocks = allBlocks(payload, "RaceInfo");
  }

  const races = raceBlocks
    .map((block) => parseRace(block, trackId))
    .filter((race): race is AmtoteRace => Boolean(race))
    .sort((a, b) => a.raceNumber - b.raceNumber);

  if (races.length === 0) {
    throw new Error(`AmTote returned no races for ${trackId}.`);
  }

  const dates = [...new Set(races.map((race) => race.raceDate))];

  if (dates.length !== 1) {
    throw new Error(
      `AmTote ${trackId} returned multiple race dates: ${dates.join(", ")}.`,
    );
  }

  const signal =
    races.find((race) => race.signal)?.signal ?? null;

  return {
    trackId,
    g365TrackCode: g365TrackCodeForAmtote(trackId),
    raceDate: dates[0],
    signal,
    session: sessionFromSignal(signal),
    races,
  };
}

export async function getAmtoteToteState(
  trackId: AmtoteTrackId,
): Promise<AmtoteToteState> {
  const xml = await soapRequest(
    "GetTote",
    `<tid>${xmlEscape(trackId)}</tid><val></val>`,
  );

  const payload = resultPayload(xml, "GetTote");
  assertAmtoteSuccess(payload, "GetTote", trackId);

  return {
    trackId,
    currentRaceNumber: intOrNull(tagValue(payload, "crc")),
    minutesToPost: intOrNull(tagValue(payload, "mtp")),
    poolTotal: tagValue(payload, "ptd"),
    odds: tagValue(payload, "odd"),
  };
}

export async function getAmtoteRaceResult(
  trackId: AmtoteTrackId,
  raceDate: string,
  raceNumber: number,
): Promise<AmtoteDetailedRaceResult> {
  const xml = await soapRequest(
    "GetRaceResult",
    [
      `<tid>${xmlEscape(trackId)}</tid>`,
      `<dat>${xmlEscape(raceDate)}</dat>`,
      `<rac>${raceNumber}</rac>`,
    ].join(""),
  );

  const payload = resultPayload(xml, "GetRaceResult");
  assertAmtoteSuccess(payload, "GetRaceResult", trackId);

  const parsedRaceNumber =
    intOrNull(tagValue(payload, "rac")) ?? raceNumber;

  const rows = allBlocks(payload, "raceresultinfo")
    .map(parseDetailedResultRow)
    .sort((a, b) => (a.sort ?? 999) - (b.sort ?? 999));

  const rowDate =
    rows.find((row) => row.raceDate)?.raceDate ?? raceDate;

  return {
    trackId,
    raceDate: rowDate,
    raceNumber: parsedRaceNumber,
    reportReady: intOrNull(tagValue(payload, "rep")) === 1,
    rows,
  };
}

export async function getAmtoteRaceResults(
  trackId: AmtoteTrackId,
  raceDate: string,
): Promise<AmtoteRaceResultsSummary> {
  const xml = await soapRequest(
    "GetRaceResults",
    [
      `<tid>${xmlEscape(trackId)}</tid>`,
      `<dat>${xmlEscape(raceDate)}</dat>`,
    ].join(""),
  );

  const payload = resultPayload(xml, "GetRaceResults");
  assertAmtoteSuccess(payload, "GetRaceResults", trackId);

  const returnedDate =
    normalizeFeedDate(tagValue(payload, "dat"));

  if (!returnedDate) {
    throw new Error(
      `AmTote GetRaceResults did not return a valid date for ${trackId}.`,
    );
  }

  const rows = allBlocks(payload, "raceresultsinfo")
    .map((block): AmtoteRaceResultsSummaryRow | null => {
      const raceNumber = intOrNull(tagValue(block, "rac"));
      const rawText = tagValue(block, "txt") ?? "";

      if (!raceNumber) return null;

      return {
        raceNumber,
        topFour: parseTopFour(rawText),
        rawText,
      };
    })
    .filter(
      (row): row is AmtoteRaceResultsSummaryRow => Boolean(row),
    )
    .sort((a, b) => a.raceNumber - b.raceNumber);

  return {
    trackId,
    raceDate: returnedDate,
    signal: tagValue(payload, "sig"),
    currentRaceNumber: intOrNull(tagValue(payload, "crc")),
    rows,
  };
}

export async function getAmtoteTrackState(
  trackId: AmtoteTrackId,
): Promise<AmtoteTrackState> {
  const xml = await soapRequest("GetTracks", "<sid></sid>");
  const payload = resultPayload(xml, "GetTracks");

  const tidExpression =
    /<(?:\w+:)?tid(?:\s[^>]*)?>([\s\S]*?)<\/(?:\w+:)?tid>/gi;
  const tidMatches = [...payload.matchAll(tidExpression)];

  const targetIndex = tidMatches.findIndex((match) => {
    const value = xmlDecode(stripCdata(match[1] ?? ""))
      .trim()
      .toUpperCase();

    return value === trackId;
  });

  if (targetIndex < 0) {
    throw new Error(
      `AmTote GetTracks did not return track ${trackId}. Track ids seen: ${
        tidMatches
          .map((match) =>
            xmlDecode(stripCdata(match[1] ?? "")).trim(),
          )
          .filter(Boolean)
          .join(", ") || "none"
      }.`,
    );
  }

  const targetMatch = tidMatches[targetIndex];
  const currentStart = targetMatch.index ?? 0;

  const previousTidEnd =
    targetIndex > 0
      ? (tidMatches[targetIndex - 1].index ?? 0) +
        tidMatches[targetIndex - 1][0].length
      : 0;

  const nextTidStart =
    targetIndex < tidMatches.length - 1
      ? (tidMatches[targetIndex + 1].index ?? payload.length)
      : payload.length;

  const sliceStart = Math.max(previousTidEnd, currentStart - 1500);
  const matching = payload.slice(sliceStart, nextTidStart);

  return {
    trackId,
    trackCode: tagValue(matching, "tcd"),
    trackName: tagValue(matching, "trk"),
    raceDate: normalizeFeedDate(tagValue(matching, "dat")),
    signal: tagValue(matching, "sig"),
    sport: tagValue(matching, "spt"),
    currentRaceNumber: intOrNull(tagValue(matching, "crc")),
    numberOfRaces: intOrNull(tagValue(matching, "nrs")),
    minutesToPost: intOrNull(tagValue(matching, "mtp")),
    status: tagValue(matching, "sts"),
    done: boolValue(tagValue(matching, "dun")),
  };
}

export async function getAmtoteGetTracksDiagnostic(): Promise<{
  rawSoapXml: string;
  decodedPayload: string;
}> {
  const rawSoapXml = await soapRequest("GetTracks", "<sid></sid>");
  const decodedPayload = resultPayload(rawSoapXml, "GetTracks");

  return {
    rawSoapXml,
    decodedPayload,
  };
}

export async function getAmtoteGetToteDiagnostic(
  trackId: AmtoteTrackId,
): Promise<{
  trackId: AmtoteTrackId;
  rawSoapXml: string;
  decodedPayload: string;
}> {
  const rawSoapXml = await soapRequest(
    "GetTote",
    `<tid>${xmlEscape(trackId)}</tid><val></val>`,
  );

  const decodedPayload = resultPayload(rawSoapXml, "GetTote");

  return {
    trackId,
    rawSoapXml,
    decodedPayload,
  };
}
