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

function xmlDecode(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
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
  const parsed = Number(value.trim());
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
      Boolean(resultText && resultText.trim()) ||
      Boolean(replayText && replayText.trim()),
    minutesToPost: intOrNull(tagValue(block, "mtp")),
    runners,
  };
}

export async function getAmtoteRaces(
  trackId: AmtoteTrackId,
): Promise<AmtoteRaceCard> {
  const xml = await soapRequest(
    "GetRaces",
    `<tid>${trackId}</tid>`,
  );

  const payload = resultPayload(xml, "GetRaces");

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

export async function getAmtoteTrackState(
  trackId: AmtoteTrackId,
): Promise<AmtoteTrackState> {
  const xml = await soapRequest("GetTracks", "<sid></sid>");
  const payload = resultPayload(xml, "GetTracks");

  /*
   * GetTracks is a legacy .NET DataSet response and the row element name
   * is not stable across serializers. Do not depend on a specific row tag.
   *
   * Instead, find the exact <tid> value and isolate the XML span belonging
   * to that track by cutting at the neighboring <tid> elements. This is
   * intentionally tolerant of wrappers such as Table, Table1, TrackInfo,
   * diffgr rows, or other DataSet-generated names.
   */
  const tidExpression = /<(?:\w+:)?tid(?:\s[^>]*)?>([\s\S]*?)<\/(?:\w+:)?tid>/gi;
  const tidMatches = [...payload.matchAll(tidExpression)];

  const targetIndex = tidMatches.findIndex((match) => {
    const value = xmlDecode(stripCdata(match[1] ?? "")).trim().toUpperCase();
    return value === trackId;
  });

  if (targetIndex < 0) {
    throw new Error(
      `AmTote GetTracks did not return track ${trackId}. Track ids seen: ${
        tidMatches
          .map((match) => xmlDecode(stripCdata(match[1] ?? "")).trim())
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

  /*
   * Include a bounded amount of XML before <tid> in case a serializer puts
   * fields such as track name/date ahead of tid, while never crossing the
   * previous track's tid.
   */
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