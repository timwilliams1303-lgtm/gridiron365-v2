"use client";

import {
  ChangeEvent,
  DragEvent,
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";

type GreyhoundPastPerformance = {
  raceDate: string | null;
  performanceCode: string | null;
  trackCode: string | null;
  distanceYards: number | null;
  condition: string | null;
  weight: number | null;
  boxNumber: number | null;
  runningPositions: number[];
  finishPosition: number | null;
  marginText: string | null;
  finishTime: number | null;
  speedRating: number | null;
  odds: string | null;
  grade: string | null;
  comment: string | null;
  rawText: string;
};

type GreyhoundRunner = {
  trapNumber: number | null;
  trapColor: string | null;
  name: string;
  trainer: string | null;
  weight: string | null;
  form: string | null;
  odds: string | null;
  rawText?: string;
  history?: GreyhoundPastPerformance[];
  programBlockImageDataUrl?: string | null;
};

type ParsedGreyhoundRace = {
  track: string;
  raceNumber: number;
  raceDate: string | null;
  raceTime: string | null;
  grade: string | null;
  distance: string | null;
  prizeMoney: string | null;
  weather: string | null;
  trackCondition: string | null;
  runners: GreyhoundRunner[];
  rawText: string;
  // Official Full Program: PDF page N is Race N for both GWD and GTS.
  programPageImageDataUrl?: string | null;
};

type ImportResult = {
  success?: boolean;
  race?: unknown;
  cardId?: string | number;
  raceId?: string | number;
  races?: unknown[];
  message?: string;
  [key: string]: unknown;
};

type GreyhoundAuthoritativeEntry = {
  raceNumber: number;
  boxNumber: number;
  dogId: number;
  dogName: string;
  odds: string | null;
  kennel: string | null;
  weight: number | null;
};

type GreyhoundRaceCardImporterProps = {
  leagueId: string;
  onImportSuccess?: (result: ImportResult) => void;
  backupOnly?: boolean;
  expectedTrackCode?: "GWD" | "GTS";
  expectedTrackName?: string;
  expectedRaceDate?: string;
  expectedSession?: string;
  importEndpoint?: string;
};

function applyAuthoritativeEntries(
  races: ParsedGreyhoundRace[],
  authoritativeEntries: GreyhoundAuthoritativeEntry[],
  trackCode: "GWD" | "GTS",
): ParsedGreyhoundRace[] {
  const entriesByRace = new Map<number, GreyhoundAuthoritativeEntry[]>();

  for (const entry of authoritativeEntries) {
    const current = entriesByRace.get(entry.raceNumber) ?? [];
    current.push(entry);
    entriesByRace.set(entry.raceNumber, current);
  }

  return races.map((race) => {
    if (normalizeTrackCode(race.track) !== trackCode) {
      return race;
    }

    const authoritativeForRace = (
      entriesByRace.get(race.raceNumber) ?? []
    ).sort((a, b) => a.boxNumber - b.boxNumber);

    /*
     * The official Entries PDF owns current-card dog identity.
     *
     * Rebuild the current runners FROM Entries Race + Box rather than from
     * Program OCR. The Program contributes only the matching box's details,
     * history and visual block.
     *
     * This is especially important at Wheeling because stakes races can have
     * legitimate NO GREYHOUND / vacant boxes. Vacant boxes do not have an
     * authoritative Entries dog row, so they are intentionally omitted here
     * instead of creating a fake greyhound.
     */
    const programRunnerByBox = new Map<number, GreyhoundRunner>();

    for (const runner of race.runners) {
      if (runner.trapNumber !== null) {
        programRunnerByBox.set(runner.trapNumber, runner);
      }
    }

    return {
      ...race,
      runners: authoritativeForRace.map((authoritative) => {
        const programRunner =
          programRunnerByBox.get(authoritative.boxNumber);

        return {
          trapNumber: authoritative.boxNumber,
          trapColor:
            programRunner?.trapColor ??
            (trackCode === "GWD"
              ? WHEELING_TRAP_COLORS[authoritative.boxNumber] ?? null
              : TRAP_COLORS[authoritative.boxNumber] ?? null),
          // Race + Box from the official Entries PDF is authoritative.
          name: authoritative.dogName,
          trainer:
            authoritative.kennel ??
            programRunner?.trainer ??
            null,
          weight:
            authoritative.weight !== null
              ? String(authoritative.weight)
              : programRunner?.weight ?? null,
          form: programRunner?.form ?? null,
          odds:
            authoritative.odds ??
            programRunner?.odds ??
            null,
          rawText: programRunner?.rawText,
          history: programRunner?.history ?? [],
          programBlockImageDataUrl:
            programRunner?.programBlockImageDataUrl ?? null,
        };
      }),
    };
  });
}

type ProcessingStage =
  | "idle"
  | "reading"
  | "pdf"
  | "extracting"
  | "ocr"
  | "parsing"
  | "importing"
  | "deleting";

const MIN_NATIVE_TEXT_LENGTH = 80;
const PDF_RENDER_SCALE = 2;

const TRAP_COLORS: Record<number, string> = {
  1: "Red",
  2: "Blue",
  3: "White",
  4: "Black",
  5: "Orange",
  6: "Stripes",
};

const WHEELING_TRAP_COLORS: Record<number, string> = {
  1: "Red",
  2: "Blue",
  3: "White",
  4: "Green",
  5: "Black",
  6: "Yellow",
  7: "Green / White",
  8: "Yellow / Black",
};

const WHEELING_PROGRAM_RACE_WORDS: Record<string, number> = {
  first: 1,
  second: 2,
  third: 3,
  fourth: 4,
  fifth: 5,
  sixth: 6,
  seventh: 7,
  eighth: 8,
  ninth: 9,
  tenth: 10,
  eleventh: 11,
  twelfth: 12,
  thirteenth: 13,
  fourteenth: 14,
  fifteenth: 15,
  sixteenth: 16,
  seventeenth: 17,
};

function normalizeWhitespace(value: string): string {
  return value
    .replace(/\u00a0/g, " ")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function cleanLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}


function normalizeTrackCode(value: string): "GWD" | "GTS" | null {
  const normalized = cleanLine(value).toLowerCase();

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

function normalizeTrackName(value: string): string {
  let result = cleanLine(value);

  result = result
    .replace(/^A\s*[-–—]\s*/i, "")
    .replace(/^B\s*[-–—]\s*/i, "")
    .replace(/^Track\s*[:\-]\s*/i, "")
    .replace(/\s+\d{1,2}:\d{2}.*$/i, "")
    .trim();

  return result;
}

function normalizeGreyhoundName(value: string): string {
  return cleanLine(value)
    .replace(/^[1-6][.\s):-]+/, "")
    .replace(/\s+\([A-Z]{2,4}\)$/i, "")
    .trim();
}

function parseDate(text: string): string | null {
  /*
   * Wheeling Program pages contain many MM/DD/YY dates for dog DOBs
   * and past performances. The race date is the long-form header date,
   * so it MUST be checked before any numeric date fallback.
   */
  const wheelingProgramDate = text.match(
    /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})\b/i,
  );

  if (wheelingProgramDate) {
    const programMonthMap: Record<string, string> = {
      january: "01",
      february: "02",
      march: "03",
      april: "04",
      may: "05",
      june: "06",
      july: "07",
      august: "08",
      september: "09",
      october: "10",
      november: "11",
      december: "12",
    };

    const month =
      programMonthMap[wheelingProgramDate[1].toLowerCase()];
    const day = wheelingProgramDate[2].padStart(2, "0");
    const year = wheelingProgramDate[3];

    if (month) {
      return `${year}-${month}-${day}`;
    }
  }

  const wheelingNumeric = text.match(
    /\b(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})\b/,
  );

  if (wheelingNumeric && /\bWHEELING\b/i.test(text)) {
    const month = wheelingNumeric[1].padStart(2, "0");
    const day = wheelingNumeric[2].padStart(2, "0");
    const rawYear = wheelingNumeric[3];
    const year =
      rawYear.length === 2 ? `20${rawYear}` : rawYear;

    return `${year}-${month}-${day}`;
  }

  const patterns = [
    /\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\s+(\d{4})\b/i,
    /\b(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\s+(\d{4})\b/i,
    /\b(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})\b/,
  ];

  const monthMap: Record<string, string> = {
    jan: "01",
    feb: "02",
    mar: "03",
    apr: "04",
    may: "05",
    jun: "06",
    jul: "07",
    aug: "08",
    sep: "09",
    sept: "09",
    oct: "10",
    nov: "11",
    dec: "12",
  };

  for (let i = 0; i < patterns.length; i += 1) {
    const match = text.match(patterns[i]);

    if (!match) {
      continue;
    }

    if (i <= 1) {
      const day = match[1].padStart(2, "0");
      const month = monthMap[match[2].toLowerCase()];
      const year = match[3];

      if (month) {
        return `${year}-${month}-${day}`;
      }
    }

    if (i === 2) {
      const day = match[1].padStart(2, "0");
      const month = match[2].padStart(2, "0");
      const year = match[3];

      return `${year}-${month}-${day}`;
    }
  }

  return null;
}

function normalizeClockTime(
  hourText: string,
  minuteText: string,
  meridiem?: string,
): string | null {
  let hour = Number(hourText);
  const minute = Number(minuteText);

  if (
    !Number.isFinite(hour) ||
    !Number.isFinite(minute) ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }

  if (meridiem) {
    const normalizedMeridiem = meridiem.toLowerCase();

    if (hour < 1 || hour > 12) {
      return null;
    }

    if (normalizedMeridiem === "pm" && hour !== 12) {
      hour += 12;
    }

    if (normalizedMeridiem === "am" && hour === 12) {
      hour = 0;
    }
  } else if (hour < 0 || hour > 23) {
    return null;
  }

  return `${String(hour).padStart(2, "0")}:${String(
    minute,
  ).padStart(2, "0")}`;
}

const WHEELING_DEFAULT_FIRST_POST_MINUTES = 13 * 60;
const WHEELING_DEFAULT_RACE_INTERVAL_MINUTES = 15;

function minutesToClockTime(totalMinutes: number): string {
  const normalized = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const hour = Math.floor(normalized / 60);
  const minute = normalized % 60;

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function getWheelingScheduledRaceTime(
  raceNumber: number,
  text: string,
): string | null {
  /*
   * IMPORTANT:
   * Never call the broad parseRaceTime(text) against an entire Wheeling
   * Program page. Those pages contain many historical performance times.
   * A historical "1:00" / "17:00" can otherwise be mistaken for the
   * current race's scheduled post time (the Race 6 / Race 12 bug).
   *
   * Only a CURRENT-RACE header explicitly labelled "Post Time" is allowed
   * to override Wheeling's card cadence.
   */
  const explicitPostTime = text.match(
    /\bPost\s*Time\s*:\s*(\d{1,2}):(\d{2})\s*(AM|PM)\b/i,
  );

  if (explicitPostTime) {
    return normalizeClockTime(
      explicitPostTime[1],
      explicitPostTime[2],
      explicitPostTime[3],
    );
  }

  if (raceNumber < 1) {
    return null;
  }

  /*
   * Wheeling's 2026 live schedule uses a 1:00 PM first post for normal
   * Wednesday-Sunday afternoon cards. The official Program does not print
   * race-by-race post times, so use the scheduled 15-minute card cadence.
   */
  const raceMinutes =
    WHEELING_DEFAULT_FIRST_POST_MINUTES +
    (raceNumber - 1) * WHEELING_DEFAULT_RACE_INTERVAL_MINUTES;

  return minutesToClockTime(raceMinutes);
}

function parseRaceTime(text: string): string | null {
  const postTimeMatch = text.match(
    /\bPost\s*Time\s*:\s*(\d{1,2}):(\d{2})\s*(AM|PM)\b/i,
  );

  if (postTimeMatch) {
    return normalizeClockTime(
      postTimeMatch[1],
      postTimeMatch[2],
      postTimeMatch[3],
    );
  }

  const meridiemMatch = text.match(
    /\b(\d{1,2}):(\d{2})\s*(AM|PM)\b/i,
  );

  if (meridiemMatch) {
    return normalizeClockTime(
      meridiemMatch[1],
      meridiemMatch[2],
      meridiemMatch[3],
    );
  }

  const twentyFourHourMatch = text.match(
    /\b([01]?\d|2[0-3]):([0-5]\d)\b/,
  );

  if (!twentyFourHourMatch) {
    return null;
  }

  return normalizeClockTime(
    twentyFourHourMatch[1],
    twentyFourHourMatch[2],
  );
}

function parseDistance(text: string): string | null {
  const yardsMatch = text.match(
    /\bDistance\s*:\s*(\d{3,4})\s*Yards?\b/i,
  );

  if (yardsMatch) {
    return `${yardsMatch[1]} Yards`;
  }

  const programYardsMatch = text.match(
    /\b(\d{3,4})\s+Yards?\b/i,
  );

  if (programYardsMatch) {
    return `${programYardsMatch[1]} Yards`;
  }

  const metricMatch = text.match(/\b(\d{3,4})\s*m\b/i);

  if (!metricMatch) {
    return null;
  }

  return `${metricMatch[1]}m`;
}

function parseGrade(text: string): string | null {
  const wheelingGrade = text.match(
    /\bGrade\s*:?\s*([A-Z]{1,4}\d{0,2})\b/i,
  );

  if (wheelingGrade) {
    return wheelingGrade[1].toUpperCase();
  }

  const patterns = [
    /\b([A-Z]\d{1,2})\b/,
    /\b(OR)\b/i,
    /\b(HP)\b/i,
    /\b(HCP)\b/i,
    /\b(SPRINT)\b/i,
    /\b(MAIDEN)\b/i,
    /\b(NOVICE)\b/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);

    if (match) {
      return match[1].toUpperCase();
    }
  }

  return null;
}

function parsePrizeMoney(text: string): string | null {
  const dollarMatches = Array.from(
    text.matchAll(/\$\s?([\d,]+(?:\.\d{2})?)/g),
  );

  for (const match of dollarMatches) {
    const numericValue = Number(
      match[1].replace(/,/g, ""),
    );

    /*
     * Wheeling programs contain wager denominations such as
     * "$3 Perfecta". Those are not race prize money. Only
     * treat a dollar amount as a purse/prize when it is large
     * enough to plausibly be one.
     */
    if (Number.isFinite(numericValue) && numericValue >= 100) {
      return `$${match[1]}`.replace(/\s+/g, "");
    }
  }

  const poundMatch = text.match(/£\s?[\d,]+(?:\.\d{2})?/);

  return poundMatch
    ? poundMatch[0].replace(/\s+/g, "")
    : null;
}

function parseWeather(text: string): string | null {
  const match = text.match(
    /(?:Weather|Forecast)\s*[:\-]\s*([^\n|]+)/i,
  );

  return match ? cleanLine(match[1]) : null;
}

function parseTrackCondition(text: string): string | null {
  const match = text.match(
    /(?:Track\s*Condition|Going|Track)\s*[:\-]\s*(Fast|Good|Normal|Slow|Wet|Heavy|Standard|Standard to Slow|Standard to Fast)[^\n]*/i,
  );

  return match ? cleanLine(match[1]) : null;
}

function detectTrackFromBlock(
  block: string,
  previousTrack = "",
): string {
  if (/\bWHEELING\b/i.test(block)) {
    return "Wheeling";
  }

  const lines = block
    .split("\n")
    .map(cleanLine)
    .filter(Boolean);

  for (const line of lines.slice(0, 15)) {
    const prefixedTrack = line.match(/^A\s*[-–—]\s*(.+)$/i);

    if (prefixedTrack) {
      return normalizeTrackName(prefixedTrack[1]);
    }
  }

  for (const line of lines.slice(0, 15)) {
    if (
      /^(Hove|Romford|Monmore|Towcester|Oxford|Nottingham|Newcastle|Sheffield|Sunderland|Yarmouth|Central Park|Crayford|Doncaster|Pelaw Grange|Kinsley|Swindon|Valley|Brighton|Perry Barr|Wheeling)\b/i.test(
        line,
      )
    ) {
      return normalizeTrackName(line);
    }
  }

  return previousTrack || "Unknown Track";
}

function isLikelyRunnerStart(line: string): boolean {
  return /^[1-8](?:\s|[.)-])/.test(line);
}

function extractTrapNumber(line: string): number | null {
  const match = line.match(/^([1-8])(?:\s|[.)-])/);

  if (!match) {
    return null;
  }

  return Number(match[1]);
}

function extractWeight(text: string): string | null {
  const programWeight = text.match(
    /\bWgt\s*-?\s*(\d{2,3})\b/i,
  );

  if (programWeight) {
    const weight = Number(programWeight[1]);

    if (weight >= 45 && weight <= 100) {
      return programWeight[1];
    }
  }

  const wheelingWeight = text.match(
    /[\[(](\d{2})[\])]\s*$/,
  );

  if (wheelingWeight) {
    const weight = Number(wheelingWeight[1]);

    if (weight >= 45 && weight <= 100) {
      return wheelingWeight[1];
    }
  }

  const patterns = [
    /\b(\d{2}\.\d{1,2})\s*kg\b/i,
    /\b(\d{2}\.\d{1,2})\b/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);

    if (match) {
      return match[1];
    }
  }

  return null;
}

function extractTrainer(text: string): string | null {
  const patterns = [
    /(?:Trainer|Trnr|T)\s*[:\-]\s*([A-Za-z .'-]+)/i,
    /\bTr:\s*([A-Za-z .'-]+)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);

    if (match) {
      return cleanLine(match[1]);
    }
  }

  return null;
}

function normalizeWheelingOddsToken(
  value: string,
): string | null {
  let token = cleanLine(value)
    .replace(/[—–−]/g, "-")
    .replace(/\//g, "-")
    .replace(/\s+/g, "");

  if (!token) {
    return null;
  }

  if (/^\d{1,2}-\d{1,2}$/.test(token)) {
    return token;
  }

  if (/^\d{1,2}\+$/.test(token)) {
    return `${token.slice(0, -1)}-1`;
  }

  if (/^\d{2,3}$/.test(token)) {
    const numerator = Number(token.slice(0, -1));
    const denominator = Number(token.slice(-1));

    if (
      numerator >= 1 &&
      numerator <= 20 &&
      [1, 2, 4].includes(denominator)
    ) {
      return `${numerator}-${denominator}`;
    }
  }

  if (/^\d{1,2}$/.test(token)) {
    return token;
  }

  return token.length <= 8 ? token : null;
}

function extractOdds(text: string): string | null {
  const fractionMatch = text.match(
    /\b(\d{1,3}\s*[-/]\s*\d{1,3})\b/,
  );

  if (fractionMatch) {
    return fractionMatch[1].replace(/\s+/g, "");
  }

  const decimalMatch = text.match(/\b(\d{1,2}\.\d{1,2})\b/);

  if (
    decimalMatch &&
    Number(decimalMatch[1]) >= 1.01 &&
    Number(decimalMatch[1]) <= 100
  ) {
    return decimalMatch[1];
  }

  return null;
}

function extractForm(text: string): string | null {
  const patterns = [
    /(?:Form)\s*[:\-]\s*([0-9A-Z\- ]{2,30})/i,
    /\b([1-6\-]{4,12})\b/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);

    if (match) {
      return cleanLine(match[1]);
    }
  }

  return null;
}

function extractRunnerName(firstLine: string): string {
  let value = firstLine.replace(/^[1-8](?:\s|[.)-])+\s*/, "");

  value = value
    .replace(/\b\d{2}\.\d{1,2}\s*kg\b.*$/i, "")
    .replace(/\bTrainer\s*[:\-].*$/i, "")
    .replace(/\bTrnr\s*[:\-].*$/i, "")
    .replace(/\bT\s*[:\-]\s*[A-Z].*$/i, "")
    .trim();

  const obviousBreak = value.search(
    /\s{2,}|\b(?:bk|bd|bkw|be|f|d|w|wbk|bk d|bk b)\b/i,
  );

  if (obviousBreak > 2) {
    value = value.slice(0, obviousBreak);
  }

  return normalizeGreyhoundName(value);
}

function parseWheelingRunnerLine(
  line: string,
): GreyhoundRunner | null {
  const startMatch = line.match(
    /^\s*([1-8])(?:\s|[.)-])+\s*(.+)$/,
  );

  if (!startMatch) {
    return null;
  }

  const trapNumber = Number(startMatch[1]);
  let rest = cleanLine(startMatch[2]);

  if (
    !rest ||
    /^NO\s+GREYHOUND\b/i.test(rest) ||
    /^Track\s+Handicapper\b/i.test(rest)
  ) {
    return null;
  }

  const firstParen = rest.match(
    /^(.+?)\s*[\[(]([^)\]]{1,10})[\])]\s*(.*)$/,
  );

  let name = rest;
  let odds: string | null = null;
  let kennel: string | null = null;
  let weight: string | null = null;

  if (firstParen) {
    name = cleanLine(firstParen[1]);
    odds = normalizeWheelingOddsToken(firstParen[2]);

    let tail = cleanLine(firstParen[3]);

    const finalWeight = tail.match(
      /^(.*?)(?:\s*[\[(](\d{2})[\])])\s*$/,
    );

    if (finalWeight) {
      const candidateWeight = Number(finalWeight[2]);

      if (candidateWeight >= 45 && candidateWeight <= 100) {
        weight = finalWeight[2];
        tail = cleanLine(finalWeight[1]);
      }
    }

    kennel = tail || null;
  } else {
    const noOddsWeight = rest.match(
      /^(.+?)\s+([A-Za-z][A-Za-z0-9 .,'&-]*Kennel[A-Za-z0-9 .,'&-]*)\s*[\[(](\d{2})[\])]$/,
    );

    if (noOddsWeight) {
      name = cleanLine(noOddsWeight[1]);
      kennel = cleanLine(noOddsWeight[2]);
      weight = noOddsWeight[3];
    }
  }

  name = normalizeGreyhoundName(name);

  if (
    !name ||
    /^NO\s+GREYHOUND\b/i.test(name) ||
    /^(race|trap|dog|greyhound|runner|selection)$/i.test(
      name,
    )
  ) {
    return null;
  }

  return {
    trapNumber,
    trapColor: TRAP_COLORS[trapNumber] ?? null,
    name,
    trainer: kennel,
    weight,
    form: null,
    odds,
    rawText: line,
  };
}

function parseWheelingRunners(
  block: string,
): GreyhoundRunner[] {
  const lines = block
    .split("\n")
    .map(cleanLine)
    .filter(Boolean);

  const deduped = new Map<number, GreyhoundRunner>();

  for (const line of lines) {
    if (
      /^Track\s+Handicapper\b/i.test(line) ||
      /\bGrade\s*:\s*[A-Z]/i.test(line)
    ) {
      continue;
    }

    const runner = parseWheelingRunnerLine(line);

    if (
      runner &&
      runner.trapNumber !== null &&
      !deduped.has(runner.trapNumber)
    ) {
      deduped.set(runner.trapNumber, runner);
    }
  }

  return Array.from(deduped.values()).sort(
    (a, b) => (a.trapNumber ?? 99) - (b.trapNumber ?? 99),
  );
}

function parseGenericRunners(
  block: string,
): GreyhoundRunner[] {
  const lines = block
    .split("\n")
    .map(cleanLine)
    .filter(Boolean);

  const runners: GreyhoundRunner[] = [];

  let currentLines: string[] = [];
  let currentTrap: number | null = null;

  const commitRunner = () => {
    if (currentTrap === null || currentLines.length === 0) {
      currentLines = [];
      currentTrap = null;
      return;
    }

    const combined = currentLines.join(" ");
    const firstLine = currentLines[0];
    const name = extractRunnerName(firstLine);

    if (
      !name ||
      /^(race|trap|dog|greyhound|runner|selection)$/i.test(name)
    ) {
      currentLines = [];
      currentTrap = null;
      return;
    }

    runners.push({
      trapNumber: currentTrap,
      trapColor: TRAP_COLORS[currentTrap] ?? null,
      name,
      trainer: extractTrainer(combined),
      weight: extractWeight(combined),
      form: extractForm(combined),
      odds: extractOdds(combined),
      rawText: combined,
    });

    currentLines = [];
    currentTrap = null;
  };

  for (const line of lines) {
    if (isLikelyRunnerStart(line)) {
      commitRunner();

      currentTrap = extractTrapNumber(line);
      currentLines = [line];
      continue;
    }

    if (currentTrap !== null) {
      if (
        /^Race\s+\d+/i.test(line) ||
        /^\d{1,2}(?:ST|ND|RD|TH)\s+Grade\s*:/i.test(line)
      ) {
        commitRunner();
        continue;
      }

      currentLines.push(line);
    }
  }

  commitRunner();

  const deduped = new Map<number, GreyhoundRunner>();

  for (const runner of runners) {
    if (runner.trapNumber === null) {
      continue;
    }

    if (!deduped.has(runner.trapNumber)) {
      deduped.set(runner.trapNumber, runner);
    }
  }

  return Array.from(deduped.values()).sort(
    (a, b) => (a.trapNumber ?? 99) - (b.trapNumber ?? 99),
  );
}

function isWheelingProgramText(text: string): boolean {
  return /\bWHEELING\s+(?:FIRST|SECOND|THIRD|FOURTH|FIFTH|SIXTH|SEVENTH|EIGHTH|NINTH|TENTH|ELEVENTH|TWELFTH|THIRTEENTH|FOURTEENTH|FIFTEENTH|SIXTEENTH|SEVENTEENTH)\s+RACE\b/i.test(
    text,
  );
}


function isTriStateProgramText(text: string): boolean {
  return /\bTRI[\s-]?STATE\s+(?:FIRST|SECOND|THIRD|FOURTH|FIFTH|SIXTH|SEVENTH|EIGHTH|NINTH|TENTH|ELEVENTH|TWELFTH|THIRTEENTH|FOURTEENTH|FIFTEENTH|SIXTEENTH|SEVENTEENTH)\s+RACE\b/i.test(
    text,
  );
}

function triStateRaceWordToNumber(value: string): number | null {
  return WHEELING_PROGRAM_RACE_WORDS[value.toLowerCase()] ?? null;
}

function normalizeTriStateColor(value: string): string | null {
  const normalized = cleanLine(value)
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z/]/g, "");

  const colors: Record<string, string> = {
    red: "Red",
    blue: "Blue",
    white: "White",
    green: "Green",
    black: "Black",
    yellow: "Yellow",
    "grn/wht": "Green / White",
    grnwht: "Green / White",
    "ylw/blk": "Yellow / Black",
    ylwblk: "Yellow / Black",
  };

  return colors[normalized] ?? null;
}

type TriStateProgramDescriptor = {
  trapNumber: number;
  trapColor: string | null;
  odds: string | null;
  trainer: string | null;
  kennel: string | null;
  weight: string | null;
  rawText: string;
};

function parseTriStateProgramDescriptors(
  block: string,
): TriStateProgramDescriptor[] {
  const flat = cleanLine(
    (block.split(/\bPicks\s*:/i)[0] ?? block)
      .replace(/\bGrn\s*\/?\s*Wht\b/gi, "Grn/Wht")
      .replace(/\bYlw\s*\/?\s*Blk\b/gi, "Ylw/Blk"),
  );

  /*
   * The Tri-State PDF text layer does not reliably expose dog names, but
   * morning-line odds + box/color markers are stable and give us eight
   * runner sections in official program order.
   *
   * Depending on the PDF extractor the marker can be either:
   *   "7-1 1 Red"
   * or:
   *   "7-1 Red 1"
   */
  const markerRegex =
    /\b(\d{1,2})\s*-\s*(\d{1,2})\s+(?:(\d)\s*(Red|Blue|White|Green|Black|Yellow|Grn\/Wht|Ylw\/Blk)|(Red|Blue|White|Green|Black|Yellow|Grn\/Wht|Ylw\/Blk)\s*(\d))\b/gi;

  const matches = Array.from(flat.matchAll(markerRegex));
  const descriptors: TriStateProgramDescriptor[] = [];
  const seen = new Set<number>();

  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const trapNumber = Number(match[3] ?? match[6]);
    const rawColor = match[4] ?? match[5] ?? "";

    if (
      !Number.isInteger(trapNumber) ||
      trapNumber < 1 ||
      trapNumber > 8 ||
      seen.has(trapNumber)
    ) {
      continue;
    }

    const startIndex = match.index ?? 0;
    const endIndex =
      matches[index + 1]?.index ??
      flat.length;
    const sectionText = flat.slice(startIndex, endIndex);

    const kennelMatch = sectionText.match(
      /\bKennel\s*:\s*(.+?)(?=\s+Trainer\s*:|$)/i,
    );
    const trainerMatch = sectionText.match(
      /\bTrainer\s*:\s*([A-Za-z][A-Za-z .,'’&-]{1,70}?)(?=\s+(?:[A-Z]{1,5}\.|(?:\d{2}\/\d{2}|[ASE]\d{1,2})\s+(?:TS|WD)\b)|$)/i,
    );

    /*
     * Current-card summary begins with best time + current weight:
     *   "30.68 75 TS ..."
     */
    const weightMatch = sectionText.match(
      /\b\d{2}\.\d{2}\s+(\d{2})\s+(?:TS|WD)\b/i,
    );

    descriptors.push({
      trapNumber,
      trapColor: normalizeTriStateColor(rawColor),
      odds: `${match[1]}-${match[2]}`,
      trainer: trainerMatch?.[1]
        ? cleanLine(trainerMatch[1])
        : null,
      kennel: kennelMatch?.[1]
        ? cleanLine(kennelMatch[1])
        : null,
      weight: weightMatch?.[1] ?? null,
      rawText: sectionText,
    });

    seen.add(trapNumber);
  }

  return descriptors.sort(
    (a, b) => a.trapNumber - b.trapNumber,
  );
}

function cleanTriStateOcrName(value: string): string {
  return cleanLine(value)
    .replace(/^[^A-Z0-9'’]+/i, "")
    .replace(/\s+(?:C|B|A|AA|D|M|TD)\s+[MD]\b.*$/i, "")
    .replace(/\s+\d{2}\.\d{2}\b.*$/i, "")
    .replace(/[|=:]+$/g, "")
    .trim();
}

function looksLikeTriStateDogName(value: string): boolean {
  const name = cleanTriStateOcrName(value);

  if (!name || name.length < 4 || name.length > 42) {
    return false;
  }

  /*
   * Never allow race/program metadata to become a Greyhound name.
   * These were the source of bad rows such as "Crs" and "TS 550 F".
   */
  if (
    /^(?:CSR|CRS|TS|WD|F|M|D|C|B|A|AA|TD)$/i.test(name) ||
    /\b(?:TS|WD)\s*\d{3,4}\b/i.test(name) ||
    /\b\d{3,4}\s*(?:YARDS?|YDS?)\b/i.test(name) ||
    /\b(?:CSR|CRS)\s*\d+\b/i.test(name) ||
    /\b(?:KENNEL|TRAINER|GRADE|RACE|POST|ODDS|WEIGHT|STATUS|PICKS?)\b/i.test(name) ||
    /^(TRI[\s-]?STATE|FIRST|SECOND|THIRD|FOURTH|FIFTH|SIXTH|SEVENTH|EIGHTH|NINTH|TENTH|ELEVENTH|TWELFTH|THIRTEENTH|FOURTEENTH|FIFTEENTH|SIXTEENTH|SEVENTEENTH|RACE|GRADE|YARDS?|RED|BLUE|WHITE|GREEN|BLACK|YELLOW|KENNEL|TRAINER|PICKS?|POST\s+TIME)$/i.test(
      name,
    )
  ) {
    return false;
  }

  /*
   * Official names are words, not numeric/program columns. Apostrophes,
   * periods, hyphens and spaces are allowed.
   */
  return (
    /[A-Z]{2}/i.test(name) &&
    !/\d/.test(name) &&
    !/^\d+(?:[-/.]\d+)*$/.test(name)
  );
}

function extractTriStateDogNameFromHeaderOcr(
  value: string,
): string | null {
  const lines = value
    .split("\n")
    .map((line) => cleanLine(line))
    .filter(Boolean);

  const candidates: string[] = [];

  for (const originalLine of lines) {
    let line = originalLine
      .replace(/^\s*\d{1,2}\s*-\s*\d{1,2}\s+/i, "")
      .replace(/^\s*[1-8]\s+/i, "")
      .replace(
        /^\s*(?:Red|Blue|White|Green|Black|Yellow|Grn\/?Wht|Ylw\/?Blk)\s+/i,
        "",
      )
      .replace(/\s+(?:CSR|CRS)\s*\d+.*$/i, "")
      .replace(/\s+Trainer\s*:.*$/i, "")
      .replace(/\s+Kennel\s*:.*$/i, "")
      .replace(/\s+\d{2}\.\d{2}\s+\d{2}\b.*$/i, "")
      .trim();

    /*
     * If OCR captured extra text on the same line, prefer the leading
     * all-caps phrase before obvious program metadata.
     */
    const leadingName = line.match(
      /^([A-Z][A-Z'’.-]*(?:\s+[A-Z][A-Z'’.-]*){0,5})(?=\s+(?:AA|A|B|C|D|M|TD|CSR|CRS|TS|WD|\d)|$)/,
    );

    if (leadingName) {
      line = leadingName[1];
    }

    const candidate = cleanTriStateOcrName(line);

    if (looksLikeTriStateDogName(candidate)) {
      candidates.push(candidate);
    }
  }

  if (candidates.length === 0) {
    return null;
  }

  /*
   * The bold dog-name line is normally short. Prefer the candidate with the
   * strongest name shape rather than a long OCR sentence.
   */
  return candidates.sort((a, b) => {
    const aWords = a.split(/\s+/).length;
    const bWords = b.split(/\s+/).length;
    const aScore = (aWords <= 4 ? 20 : 0) + Math.min(a.length, 24);
    const bScore = (bWords <= 4 ? 20 : 0) + Math.min(b.length, 24);
    return bScore - aScore;
  })[0];
}

function parseTriStateOcrNames(
  block: string,
): Map<number, string> {
  const names = new Map<number, string>();
  const lines = block
    .split("\n")
    .map(cleanLine)
    .filter(Boolean);

  for (const line of lines) {
    /*
     * Primary OCR shape:
     *   "1 JUST DID IT"
     *   "7 ARKWILD B COLFAX"
     */
    const directMatch = line.match(
      /^\s*([1-8])\s+(.{2,60}?)\s*$/i,
    );

    if (directMatch) {
      const trapNumber = Number(directMatch[1]);
      const candidate = cleanTriStateOcrName(directMatch[2]);

      if (
        !names.has(trapNumber) &&
        looksLikeTriStateDogName(candidate)
      ) {
        names.set(trapNumber, candidate);
        continue;
      }
    }

    /*
     * Tesseract sometimes keeps the morning-line odds/color before the
     * box/name on one line.
     */
    const markerMatch = line.match(
      /(?:^|\s)(?:\d{1,2}\s*-\s*\d{1,2})?\s*(?:Red|Blue|White|Green|Black|Yellow|Grn\/Wht|Ylw\/Blk)?\s*([1-8])\s+([A-Z][A-Z0-9'’.\- ]{1,42}?)(?=\s+(?:AA|A|B|C|D|M|TD)\s+[MD]\b|\s+\d{2}\.\d{2}\b|$)/i,
    );

    if (markerMatch) {
      const trapNumber = Number(markerMatch[1]);
      const candidate = cleanTriStateOcrName(markerMatch[2]);

      if (
        !names.has(trapNumber) &&
        looksLikeTriStateDogName(candidate)
      ) {
        names.set(trapNumber, candidate);
      }
    }
  }

  /*
   * Final flattened fallback for OCR engines that collapse visual rows.
   */
  const flat = cleanLine(block);
  const flatRegex =
    /\b([1-8])\s+([A-Z][A-Z0-9'’.\- ]{1,42}?)(?=\s+(?:AA|A|B|C|D|M|TD)\s+[MD]\b|\s+\d{2}\.\d{2}\b)/gi;

  for (const match of flat.matchAll(flatRegex)) {
    const trapNumber = Number(match[1]);
    const candidate = cleanTriStateOcrName(match[2]);

    if (
      !names.has(trapNumber) &&
      looksLikeTriStateDogName(candidate)
    ) {
      names.set(trapNumber, candidate);
    }
  }

  return names;
}

function parseTriStatePastPerformances(
  rawText: string,
  programDate: string | null,
): GreyhoundPastPerformance[] {
  const normalized = normalizeWhitespace(rawText);
  const candidates = new Set<string>();

  for (const line of normalized
    .split("\n")
    .map(cleanLine)
    .filter(Boolean)) {
    candidates.add(line);
  }

  /*
   * Native PDF extraction can flatten every runner row onto one line.
   * Recover each dated performance segment so we can still store history
   * even when OCR is imperfect.
   */
  const flat = cleanLine(normalized);
  const rowRegex =
    /(\d{2}\/\d{2})\s*([ASE])\s*(\d{1,2})\s+(TS|WD)\s+(\d{3,4})\s+([A-Z])\s+(\d{2}\.\d{2})\s+(\d{2})\s+([1-8])\s+(.+?)(?=\s+\d{2}\/\d{2}\s*[ASE]\s*\d{1,2}\s+(?:TS|WD)\b|$)/gi;

  for (const match of flat.matchAll(rowRegex)) {
    candidates.add(cleanLine(match[0]));
  }

  const history: GreyhoundPastPerformance[] = [];
  const seen = new Set<string>();

  for (const line of candidates) {
    const match = line.match(
      /^(\d{2}\/\d{2})\s*([ASE])\s*(\d{1,2})\s+(TS|WD)\s+(\d{3,4})\s+([A-Z])\s+(\d{2}\.\d{2})\s+(\d{2})\s+([1-8])\s+(.+)$/i,
    );

    if (!match) {
      continue;
    }

    const raceDate =
      inferProgramHistoryDate(match[1], programDate);
    const performanceCode =
      `${match[2].toUpperCase()}${match[3]}`;
    const trackCode = match[4].toUpperCase();
    const tail = cleanLine(match[10]);

    const tailMatch = tail.match(
      /(?:^|\s)(?:\d{1,2}\.\d{2}\s+)?(\d{2}\.\d{2}|OOP)\s+((?:\d+(?:\.\d+)?\*?)|----)\s+([A-Z-]{1,4})\s+(.+)$/i,
    );

    const runningCalls =
      parseProgramRunningCalls(
        tail,
      );

    const sourceKey = [
      raceDate,
      performanceCode,
      trackCode,
      match[5],
      match[9],
      tailMatch?.[1] ?? "",
    ].join("|");

    if (seen.has(sourceKey)) {
      continue;
    }

    seen.add(sourceKey);

    history.push({
      raceDate,
      performanceCode,
      trackCode,
      distanceYards: Number(match[5]),
      condition: match[6].toUpperCase(),
      weight: Number(match[8]),
      boxNumber: Number(match[9]),
      runningPositions:
        runningCalls.runningPositions,
      finishPosition:
        runningCalls.finishPosition,
      marginText:
        runningCalls.marginText,
      finishTime:
        tailMatch && /^\d{2}\.\d{2}$/.test(tailMatch[1])
          ? Number(tailMatch[1])
          : null,
      speedRating: null,
      odds: tailMatch?.[2] ?? null,
      grade: tailMatch?.[3] ?? null,
      comment: tailMatch?.[4]
        ? cleanLine(tailMatch[4])
        : tail,
      rawText: line,
    });
  }

  return history.slice(0, 12);
}


function parseTriStateSequentialOcrNames(
  block: string,
): string[] {
  const names: string[] = [];
  const seen = new Set<string>();

  for (const rawLine of block.split("\n")) {
    const line = cleanLine(rawLine);

    if (
      !line ||
      !/\bTrainer\s*:/i.test(line)
    ) {
      continue;
    }

    const currentTimeMatch = line.match(
      /\b\d{2}\.\d{2}\s+\d{2}\b/,
    );

    if (!currentTimeMatch || currentTimeMatch.index === undefined) {
      continue;
    }

    const prefix = line
      .slice(0, currentTimeMatch.index)
      .trim();

    /*
     * Pull the trailing uppercase name from the summary line. This works
     * even when OCR damages the box/color immediately before the name.
     */
    const nameMatch = prefix.match(
      /([A-Z][A-Z0-9'’.\-]*(?:\s+[A-Z][A-Z0-9'’.\-]*){0,5})$/,
    );

    if (!nameMatch) {
      continue;
    }

    const candidate =
      cleanTriStateOcrName(nameMatch[1]);

    if (
      looksLikeTriStateDogName(candidate) &&
      !seen.has(candidate)
    ) {
      seen.add(candidate);
      names.push(candidate);
    }
  }

  return names.slice(0, 8);
}

function splitTriStateOcrRunnerSections(
  block: string,
): Map<number, string> {
  const lines = block
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const starts: Array<{
    index: number;
    trapNumber: number;
  }> = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = cleanLine(lines[index]);

    const directMatch = line.match(
      /(?:^|\s)([1-8])\s+[A-Z][A-Z0-9'’.\- ]{1,42}(?=\s+(?:AA|A|B|C|D|M|TD)\s+[MD]\b|\s+\d{2}\.\d{2}\b|$)/i,
    );

    if (directMatch) {
      const trapNumber = Number(directMatch[1]);

      if (!starts.some((start) => start.trapNumber === trapNumber)) {
        starts.push({ index, trapNumber });
      }
    }
  }

  const sections = new Map<number, string>();

  for (let index = 0; index < starts.length; index += 1) {
    const start = starts[index];
    const end =
      starts[index + 1]?.index ??
      lines.findIndex(
        (line, lineIndex) =>
          lineIndex > start.index &&
          /^Picks\s*:/i.test(cleanLine(line)),
      );

    const sectionEnd =
      end >= 0 ? end : lines.length;

    sections.set(
      start.trapNumber,
      lines
        .slice(start.index, sectionEnd)
        .join("\n"),
    );
  }

  return sections;
}

function cleanTriStateRecoveredDogNameBoundary(
  value: string,
  knownProgramNames: string[],
): string {
  let original = cleanTriStateOcrName(value);

  if (!original) {
    return original;
  }

  /*
   * Tri-State's printed runner header has a single-letter grade/status
   * column immediately beside the dog-name area. OCR can bleed that printed
   * "B" into the left edge of the name:
   *
   *   "B WW BONNY SUE" -> "WW BONNY SUE"
   *   "BCET DWARF"     -> "CET DWARF"
   *
   * Only repair a LEADING boundary B. An internal B is never touched, so
   * "ARKWILD B COLFAX" remains exactly "ARKWILD B COLFAX".
   */
  if (/^B\s+[A-Z][A-Z'’.-]*(?:\s+[A-Z][A-Z'’.-]*)+/i.test(original)) {
    original = original.replace(/^B\s+/i, "");
  } else {
    const firstWord = original.split(/\s+/)[0] ?? "";
    const remainingWords = original.split(/\s+/).slice(1);

    if (
      /^B[A-Z]{3}$/i.test(firstWord) &&
      remainingWords.length >= 1 &&
      remainingWords.every((word) =>
        /^[A-Z][A-Z'’.-]*$/i.test(word),
      )
    ) {
      original = [
        firstWord.slice(1),
        ...remainingWords,
      ].join(" ");
    }
  }

  const normalizeKey = (name: string) =>
    cleanTriStateOcrName(name)
      .replace(/[^A-Z0-9]/gi, "")
      .toUpperCase();

  const known = knownProgramNames
    .map((name) => cleanTriStateOcrName(name))
    .filter((name) => looksLikeTriStateDogName(name));

  const originalKey = normalizeKey(original);

  /*
   * Prefer an exact name already independently recovered elsewhere from the
   * same official program. This safely repairs OCR boundary noise without
   * inventing spelling.
   */
  const exactKnown = known.find(
    (name) => normalizeKey(name) === originalKey,
  );

  if (exactKnown) {
    return exactKnown;
  }

  /*
   * OCR sometimes attaches ONE neighboring grade/column "B" to the left side
   * of a Tri-State dog name. Only remove it when doing so matches another
   * independently recovered program name. Never globally strip B because
   * legitimate names such as ARKWILD B COLFAX must retain it.
   */
  const withoutLeadingStandaloneB = original.replace(
    /^B\s+/i,
    "",
  );
  const withoutLeadingAttachedB =
    /^B[A-Z]/.test(original) ? original.slice(1) : original;

  for (const repaired of [
    withoutLeadingStandaloneB,
    withoutLeadingAttachedB,
  ]) {
    const repairedKey = normalizeKey(repaired);

    const match = known.find(
      (name) => normalizeKey(name) === repairedKey,
    );

    if (match) {
      return match;
    }
  }

  return original;
}

function parseTriStateNamesByTrainer(
  ocrBlock: string,
  descriptors: TriStateProgramDescriptor[],
  independentlyRecoveredNames: string[] = [],
): Map<number, string> {
  const names = new Map<number, string>();
  const lines = ocrBlock
    .split("\n")
    .map((line) => cleanLine(line))
    .filter(Boolean);

  for (const descriptor of descriptors) {
    const trainer = cleanLine(descriptor.trainer ?? "");

    if (!trainer) {
      continue;
    }

    const trainerKey = trainer
      .replace(/[^A-Z]/gi, "")
      .toUpperCase();

    if (trainerKey.length < 4) {
      continue;
    }

    const matchingLines = lines.filter((line) => {
      const lineKey = line
        .replace(/[^A-Z]/gi, "")
        .toUpperCase();

      return lineKey.includes(trainerKey);
    });

    for (const line of matchingLines) {
      const trainerIndex = line.search(/\bTrainer\s*:/i);
      const beforeTrainer =
        trainerIndex >= 0
          ? line.slice(0, trainerIndex)
          : line;

      /*
       * Tri-State summary line shape is normally:
       *   [odds] [box/color] DOG NAME ... current-time weight Trainer: Name
       *
       * Anchor on the already-correct trainer for THIS trap, then remove
       * stable numeric/program columns from the left and right. This prevents
       * names from shifting between boxes when OCR misses a trap number.
       */
      let candidateText = beforeTrainer
        .replace(
          /^\s*\d{1,2}\s*-\s*\d{1,2}\s+/,
          "",
        )
        .replace(
          /^\s*(?:[1-8]\s+)?(?:Red|Blue|White|Green|Black|Yellow|Grn\/?Wht|Ylw\/?Blk)\s+(?:[1-8]\s+)?/i,
          "",
        )
        .replace(
          /^\s*[1-8]\s+(?:Red|Blue|White|Green|Black|Yellow|Grn\/?Wht|Ylw\/?Blk)\s+/i,
          "",
        )
        .replace(
          /\s+\d{2}\.\d{2}\s+\d{2}\b.*$/i,
          "",
        )
        .replace(
          /\s+(?:TS|WD)\s+\d{3,4}\b.*$/i,
          "",
        )
        .trim();

      const words = candidateText.split(/\s+/);

      /*
       * Search every contiguous word span and keep the strongest valid dog
       * name. Metadata tokens are rejected by looksLikeTriStateDogName().
       */
      const candidates: string[] = [];

      for (let start = 0; start < words.length; start += 1) {
        for (
          let length = 1;
          length <= 5 && start + length <= words.length;
          length += 1
        ) {
          const candidate = cleanTriStateOcrName(
            words.slice(start, start + length).join(" "),
          );

          if (looksLikeTriStateDogName(candidate)) {
            candidates.push(candidate);
          }
        }
      }

      const best = candidates
        .filter(
          (candidate) =>
            !/\b(?:Trainer|Kennel|Weight|Odds|Status)\b/i.test(
              candidate,
            ),
        )
        .sort((a, b) => {
          const aUpper =
            a === a.toUpperCase() ? 30 : 0;
          const bUpper =
            b === b.toUpperCase() ? 30 : 0;
          const aWords = a.split(/\s+/).length;
          const bWords = b.split(/\s+/).length;
          const aShape =
            aWords >= 1 && aWords <= 4 ? 20 : 0;
          const bShape =
            bWords >= 1 && bWords <= 4 ? 20 : 0;

          return (
            bUpper +
            bShape +
            Math.min(b.length, 24) -
            (aUpper + aShape + Math.min(a.length, 24))
          );
        })[0];

      if (best) {
        names.set(
          descriptor.trapNumber,
          cleanTriStateRecoveredDogNameBoundary(
            best,
            independentlyRecoveredNames,
          ),
        );
        break;
      }
    }
  }

  return names;
}

function parseTriStateNamesFromTrapBlocks(
  ocrBlock: string,
  descriptors: TriStateProgramDescriptor[],
): Map<number, string> {
  const names = new Map<number, string>();
  const normalized = ocrBlock
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ");

  /*
   * Use the descriptor metadata already tied to each trap (trainer, color,
   * weight, odds) as anchors. This is intentionally race-agnostic: it runs
   * for every Tri-State race page, not only Race 1.
   */
  for (const descriptor of descriptors) {
    const trainer = cleanLine(descriptor.trainer ?? "");
    const trainerKey = trainer.replace(/[^A-Z]/gi, "").toUpperCase();

    if (trainerKey.length < 4) {
      continue;
    }

    const lines = normalized
      .split("\n")
      .map((line) => cleanLine(line))
      .filter(Boolean);

    const trainerLineIndexes = lines
      .map((line, index) => ({
        index,
        key: line.replace(/[^A-Z]/gi, "").toUpperCase(),
      }))
      .filter(({ key }) => key.includes(trainerKey))
      .map(({ index }) => index);

    for (const lineIndex of trainerLineIndexes) {
      /*
       * The dog header may wrap one or two OCR lines away from Trainer.
       * Keep the search inside this trap's small local block.
       */
      const localStart = Math.max(0, lineIndex - 3);
      const localEnd = Math.min(lines.length, lineIndex + 2);
      const localLines = lines.slice(localStart, localEnd);

      const candidates: string[] = [];

      for (const localLine of localLines) {
        let line = localLine
          .replace(/\bTrainer\s*:.*$/i, "")
          .replace(/\bKennel\s*:.*$/i, "")
          .replace(
            /^\s*\d{1,2}\s*-\s*\d{1,2}\s+/,
            "",
          )
          .replace(
            /^\s*[1-8]\s+(?:Red|Blue|White|Green|Black|Yellow|Green\s*\/\s*White|Yellow\s*\/\s*Black)\s+/i,
            "",
          )
          .replace(
            /^\s*(?:Red|Blue|White|Green|Black|Yellow|Green\s*\/\s*White|Yellow\s*\/\s*Black)\s+[1-8]\s+/i,
            "",
          )
          .replace(
            /\s+\d{2}\.\d{2}\s+\d{2}\b.*$/i,
            "",
          )
          .replace(
            /\s+(?:TS|WD)\s+\d{3,4}\b.*$/i,
            "",
          )
          .replace(
            /\s+(?:CSR|CRS)\s*\d+\b.*$/i,
            "",
          )
          .trim();

        if (!line) continue;

        const words = line.split(/\s+/);

        for (let start = 0; start < words.length; start += 1) {
          for (
            let length = 1;
            length <= 5 && start + length <= words.length;
            length += 1
          ) {
            const candidate =
              cleanTriStateRecoveredDogNameBoundary(
                words.slice(start, start + length).join(" "),
                [],
              );

            if (
              looksLikeTriStateDogName(candidate) &&
              !/\b(?:Trainer|Kennel|Weight|Odds|Status|Race|Grade|Yards|Post|Time)\b/i.test(
                candidate,
              )
            ) {
              candidates.push(candidate);
            }
          }
        }
      }

      const best = candidates.sort((a, b) => {
        const score = (value: string) => {
          const words = value.split(/\s+/);
          const upper =
            value === value.toUpperCase() ? 40 : 0;
          const wordShape =
            words.length >= 1 && words.length <= 4 ? 25 : 0;
          const alphaOnly =
            !/\d/.test(value) ? 20 : -50;
          const metadataPenalty =
            /^(?:TS|WD|CSR|CRS|F|M|D|C|B|A|AA|TD)$/i.test(
              value,
            )
              ? -100
              : 0;

          return (
            upper +
            wordShape +
            alphaOnly +
            metadataPenalty +
            Math.min(value.length, 28)
          );
        };

        return score(b) - score(a);
      })[0];

      if (best) {
        names.set(
          descriptor.trapNumber,
          cleanTriStateRecoveredDogNameBoundary(
            best,
            Array.from(names.values()),
          ),
        );
        break;
      }
    }
  }

  return names;
}

function parseTriStateProgramRunners(
  nativeBlock: string,
  ocrBlock: string,
  programDate: string | null,
): GreyhoundRunner[] {
  const descriptors =
    parseTriStateProgramDescriptors(nativeBlock || ocrBlock);
  const names = parseTriStateOcrNames(ocrBlock);
  const trainerAnchoredNames =
    parseTriStateNamesByTrainer(
      ocrBlock,
      descriptors,
      Array.from(names.values()),
    );
  const trapBlockNames =
    parseTriStateNamesFromTrapBlocks(
      ocrBlock,
      descriptors,
    );
  const ocrSections =
    splitTriStateOcrRunnerSections(ocrBlock);

  return descriptors
    .map((descriptor) => {
      const ocrSection =
        ocrSections.get(descriptor.trapNumber) ?? "";
      const historySource =
        ocrSection || ocrBlock;

      const historyByKey =
        new Map<string, GreyhoundPastPerformance>();

      for (const performance of [
        ...parseTriStatePastPerformances(
          descriptor.rawText,
          programDate,
        ),
        ...parseTriStatePastPerformances(
          historySource,
          programDate,
        ),
      ]) {
        const key = [
          performance.raceDate,
          performance.performanceCode,
          performance.trackCode,
          performance.distanceYards,
          performance.boxNumber,
          performance.finishTime,
        ].join("|");

        if (!historyByKey.has(key)) {
          historyByKey.set(key, performance);
        }
      }

      const history = Array.from(
        historyByKey.values(),
      ).slice(0, 12);

      return {
        trapNumber: descriptor.trapNumber,
        trapColor: descriptor.trapColor,
        name:
          names.get(descriptor.trapNumber) ??
          trainerAnchoredNames.get(
            descriptor.trapNumber,
          ) ??
          trapBlockNames.get(
            descriptor.trapNumber,
          ) ??
          `Tri-State Box ${descriptor.trapNumber}`,
        trainer: descriptor.trainer,
        weight: descriptor.weight,
        form: null,
        odds: descriptor.odds,
        rawText: [
          descriptor.rawText,
          ocrSection,
        ]
          .filter(Boolean)
          .join("\n\n"),
        history,
      };
    })
    .sort(
      (a, b) =>
        (a.trapNumber ?? 99) -
        (b.trapNumber ?? 99),
    );
}

function parseProgramHeaderRaceTime(
  text: string,
): string | null {
  /*
   * Program pages also contain historical race/performance times.
   * Limit current-race time detection to the header area so neither
   * GTS nor GWD can accidentally promote a dog's past-performance
   * clock value into scheduled_post_time.
   */
  const headerText =
    text
      .split("\n")
      .slice(0, 24)
      .join("\n");

  const explicitPostTime = headerText.match(
    /\bPost\s*Time\s*:\s*(\d{1,2}):(\d{2})\s*(AM|PM)\b/i,
  );

  if (explicitPostTime) {
    return normalizeClockTime(
      explicitPostTime[1],
      explicitPostTime[2],
      explicitPostTime[3],
    );
  }

  return parseRaceTime(headerText);
}


function parseTriStateProgramPage(
  nativePageText: string,
  ocrPageText: string,
  fallbackRaceNumber: number,
): ParsedGreyhoundRace | null {
  const native = normalizeWhitespace(nativePageText);
  const ocr = normalizeWhitespace(ocrPageText);
  const metadataText = native || ocr;

  if (!isTriStateProgramText(metadataText)) {
    return null;
  }

  const headerMatch = metadataText.match(
    /\bTRI[\s-]?STATE\s+(FIRST|SECOND|THIRD|FOURTH|FIFTH|SIXTH|SEVENTH|EIGHTH|NINTH|TENTH|ELEVENTH|TWELFTH|THIRTEENTH|FOURTEENTH|FIFTEENTH|SIXTEENTH|SEVENTEENTH)\s+RACE\b/i,
  );

  const raceNumber =
    (headerMatch
      ? triStateRaceWordToNumber(headerMatch[1])
      : null) ??
    fallbackRaceNumber;

  if (
    !Number.isInteger(raceNumber) ||
    raceNumber < 1 ||
    raceNumber > 99
  ) {
    return null;
  }

  const raceDate = parseDate(metadataText);
  const raceTime = parseProgramHeaderRaceTime(metadataText);
  const raceHeader = metadataText.match(
    /\b(\d{3,4})\s+YARDS?\s+GRADE\s*([A-Z]{1,4}\d{0,2})\b/i,
  );

  const runners =
    parseTriStateProgramRunners(
      native,
      ocr,
      raceDate,
    );

  return {
    track: "Tri-State",
    raceNumber,
    raceDate,
    raceTime,
    grade:
      raceHeader?.[2]?.toUpperCase() ??
      parseGrade(metadataText),
    distance: raceHeader?.[1]
      ? `${raceHeader[1]} Yards`
      : parseDistance(metadataText),
    prizeMoney: parsePrizeMoney(metadataText),
    weather: parseWeather(metadataText),
    trackCondition: parseTrackCondition(metadataText),
    runners,
    rawText: [
      native,
      ocr
        ? `===== OCR PAGE =====\n${ocr}`
        : "",
    ]
      .filter(Boolean)
      .join("\n\n"),
  };
}

function normalizeProgramGreyhoundName(value: string): string {
  return cleanLine(value)
    .replace(/^[^A-Z0-9'’]+/i, "")
    /*
     * Wheeling OCR occasionally damages the opening parenthesis around the
     * current grade:
     *   "SUPERIOR JADE (D)" -> expected
     *   "SUPERIOR JADE D)"  -> OCR variant
     *
     * Neither form is part of the greyhound's name.
     */
    .replace(/\s+\([A-Z]{1,4}\)\s*$/i, "")
    .replace(/\s+[A-Z]{1,4}\)\s*$/i, "")
    .replace(/\s+\([A-Z]{1,4}\s*$/i, "")
    .replace(/[=:|]+$/g, "")
    .trim();
}

type WheelingProgramTrapDescriptor = {
  trapNumber: number;
  trapColor: string | null;
  odds: string | null;
  trainer: string | null;
  kennel: string | null;
  weight: string | null;
  csr: string | null;
  rawText: string;
};

type WheelingProgramOcrRunner = {
  name: string;
  trainer: string | null;
  kennel: string | null;
  weight: string | null;
  csr: string | null;
  rawText: string;
};

function normalizeMatchValue(value: string | null): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function parseWheelingProgramNativeTraps(
  block: string,
): WheelingProgramTrapDescriptor[] {
  const flat = cleanLine(
    block.split(/\bPicks\s*:/i)[0] ?? block,
  );

  /*
   * In the text layer, dog names are frequently absent, but the active
   * runner marker is extremely stable: morning-line odds + box + color.
   * Example: "14-1 1 Red ..." or "3-1 7 Green White ...".
   */
  const markerRegex =
    /\b(\d{1,2})\s*[-/]\s*(\d{1,2})\s+([1-8])\s+(Red|Blue|White|Green(?:\s+White)?|Black|Yellow(?:\s+Black)?)\b/gi;

  const matches = Array.from(flat.matchAll(markerRegex));
  const descriptors: WheelingProgramTrapDescriptor[] = [];
  const seen = new Set<number>();

  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const trapNumber = Number(match[3]);

    if (
      !Number.isFinite(trapNumber) ||
      trapNumber < 1 ||
      trapNumber > 8 ||
      seen.has(trapNumber)
    ) {
      continue;
    }

    const startIndex = match.index ?? 0;
    const nextMatch = matches[index + 1];
    const endIndex = nextMatch?.index ?? flat.length;
    const sectionText = flat.slice(startIndex, endIndex);

    const trainerMatch = sectionText.match(
      /\bTrainer\s*:\s*([A-Za-z][A-Za-z .,'’&-]{1,60}?)(?=\s+\[Wgt-|\s+Wgt-|$)/i,
    );
    const kennelMatch = sectionText.match(
      /\bKennel\s*:\s*(.+?)(?=\s+Trainer\s*:|$)/i,
    );
    const weightMatch = sectionText.match(
      /\[?Wgt\s*-\s*(\d{2})\b/i,
    );
    const csrMatch = sectionText.match(/\bCSR\s*(\d{1,3})\b/i);

    descriptors.push({
      trapNumber,
      trapColor:
        WHEELING_TRAP_COLORS[trapNumber] ?? cleanLine(match[4]),
      odds: `${match[1]}-${match[2]}`,
      trainer: trainerMatch?.[1]
        ? cleanLine(trainerMatch[1])
        : null,
      kennel: kennelMatch?.[1]
        ? cleanLine(kennelMatch[1])
        : null,
      weight: weightMatch?.[1] ?? null,
      csr: csrMatch?.[1] ?? null,
      rawText: sectionText,
    });

    seen.add(trapNumber);
  }

  return descriptors.sort((a, b) => a.trapNumber - b.trapNumber);
}

function parseWheelingProgramOcrRunners(
  block: string,
): WheelingProgramOcrRunner[] {
  const lines = block
    .split("\n")
    .map(cleanLine)
    .filter(Boolean);

  const nameIndexes: number[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];

    /*
     * The OCR layer reliably recovers the dog name on the same line as
     * its current grade and CSR. Historical lines can also contain CSR-
     * like numbers, so require the parenthesized current grade before CSR.
     */
    if (
      /^.{2,70}?\bCSR\s*\d{1,3}\b/i.test(line) &&
      !/\b(?:LOW_GRADE|HI_GRADE|BESTTIME)\b/i.test(line) &&
      !/^WHEELING\b/i.test(line)
    ) {
      nameIndexes.push(index);
    }
  }

  const runners: WheelingProgramOcrRunner[] = [];

  for (let index = 0; index < nameIndexes.length; index += 1) {
    const lineIndex = nameIndexes[index];
    const nextLineIndex =
      index + 1 < nameIndexes.length
        ? nameIndexes[index + 1]
        : lines.length;

    const nameLine = lines[lineIndex];
    const sectionStart = Math.max(0, lineIndex - 1);
    const sectionEnd = nextLineIndex;
    const sectionLines = lines.slice(sectionStart, sectionEnd);
    const sectionText = sectionLines.join(" ");
    const sectionRawText = sectionLines.join("\n");

    const gradeIndex = nameLine.search(/\s*\([A-Z]{1,4}\)/i);
    const csrIndex = nameLine.search(/\s+CSR\s*\d{1,3}\b/i);
    const cutIndex =
      gradeIndex > 0
        ? gradeIndex
        : csrIndex > 0
          ? csrIndex
          : nameLine.length;
    const rawName = nameLine.slice(0, cutIndex);
    const name = normalizeProgramGreyhoundName(rawName);

    if (
      !name ||
      /^(WHEELING|GRADE|RACE)$/i.test(name)
    ) {
      continue;
    }

    const trainerMatch = sectionText.match(
      /\bTrainer\s*:\s*([A-Za-z][A-Za-z .,'’&-]{1,60}?)(?=\s+(?:[A-Z]{1,5}\.|\[?Wgt|$))/i,
    );
    const kennelMatch = sectionText.match(
      /\bKennel\s*:\s*(.+?)(?=\s+Trainer\s*:|$)/i,
    );
    const weightMatch = sectionText.match(
      /\[?Wgt\s*-\s*(\d{2})\b/i,
    );
    const csrMatch = nameLine.match(/\bCSR\s*(\d{1,3})\b/i);

    runners.push({
      name,
      trainer: trainerMatch?.[1]
        ? cleanLine(trainerMatch[1])
        : null,
      kennel: kennelMatch?.[1]
        ? cleanLine(kennelMatch[1])
        : null,
      weight: weightMatch?.[1] ?? null,
      csr: csrMatch?.[1] ?? null,
      rawText: sectionRawText,
    });
  }

  return runners.slice(0, 8);
}

function programRunnerDescriptorScore(
  runner: WheelingProgramOcrRunner,
  descriptor: WheelingProgramTrapDescriptor,
): number {
  let score = 0;

  if (runner.weight && descriptor.weight && runner.weight === descriptor.weight) {
    score += 5;
  }

  if (runner.csr && descriptor.csr && runner.csr === descriptor.csr) {
    score += 3;
  }

  const runnerTrainer = normalizeMatchValue(runner.trainer);
  const descriptorTrainer = normalizeMatchValue(descriptor.trainer);

  if (
    runnerTrainer &&
    descriptorTrainer &&
    (runnerTrainer === descriptorTrainer ||
      runnerTrainer.includes(descriptorTrainer) ||
      descriptorTrainer.includes(runnerTrainer))
  ) {
    score += 6;
  }

  const runnerKennel = normalizeMatchValue(runner.kennel);
  const descriptorKennel = normalizeMatchValue(descriptor.kennel);

  if (
    runnerKennel &&
    descriptorKennel &&
    (runnerKennel === descriptorKennel ||
      runnerKennel.includes(descriptorKennel) ||
      descriptorKennel.includes(runnerKennel))
  ) {
    score += 4;
  }

  return score;
}


function inferProgramHistoryDate(
  mmdd: string,
  programDate: string | null,
): string | null {
  if (!programDate || !/^\d{4}-\d{2}-\d{2}$/.test(programDate)) {
    return null;
  }

  const match = mmdd.match(/^(\d{2})\/(\d{2})$/);
  if (!match) return null;

  const program = new Date(`${programDate}T12:00:00Z`);
  let year = program.getUTCFullYear();
  const month = Number(match[1]);
  const day = Number(match[2]);

  if (month > program.getUTCMonth() + 1) year -= 1;

  const candidate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return /^\d{4}-\d{2}-\d{2}$/.test(candidate) ? candidate : null;
}

type ParsedRunningCalls = {
  runningPositions: number[];
  finishPosition: number | null;
  marginText: string | null;
};

function parseProgramRunningCalls(
  tail: string,
  distanceYards: number | null = null,
  trackCode: string | null = null,
): ParsedRunningCalls {
  const cleaned = cleanLine(tail);

  /*
   * Find the first final-time-looking token after the running calls.
   * This is intentionally independent of CSR/odds because Wheeling OCR can
   * merge those fields (for example "6831.10") while the call positions
   * before the final time remain usable.
   */
  const finalTimeMatch =
    cleaned.match(
      /(?:^|\s)(OOP|\d{2}\.\d{2}|\d{4})(?=\s|$)/i,
    );

  if (
    !finalTimeMatch ||
    finalTimeMatch.index === undefined
  ) {
    return {
      runningPositions: [],
      finishPosition: null,
      marginText: null,
    };
  }

  let prefix =
    cleaned
      .slice(
        0,
        finalTimeMatch.index,
      )
      .trim();

  /*
   * Tri-State may place a split immediately before final time.
   * It is not a running position.
   */
  if (
    String(trackCode ?? "").toUpperCase() === "TS"
  ) {
    prefix =
      prefix.replace(
        /\s+\d{1,2}\.\d{2}$/,
        "",
      );
  }

  type ParsedCallToken = {
    raw: string;
    position: number;
    suffix: string | null;
  };

  const parsedTokens: ParsedCallToken[] = [];

  for (
    const rawToken of
    prefix
      .split(/\s+/)
      .filter(Boolean)
  ) {
    /*
     * Normal compact calls:
     *   3, 31½, 717, 45½
     *
     * OCR-damaged Wheeling compact calls can end in punctuation:
     *   81:, 700%
     * The first digit is still the official position.
     */
    const token =
      rawToken
        .replace(/^[^0-9]+/, "")
        .replace(/[)\]}]+$/, "");

    const match =
      token.match(
        /^([1-8])([0-9½¼¾A-Za-z:;%+.\-]*)$/i,
      );

    if (!match) {
      continue;
    }

    /*
     * The first digit is the running position. Wheeling's PDF frequently
     * compresses the FINISH + MARGIN into one token:
     *
     *   813½ -> finish 8, margin 13½
     *   717  -> finish 7, margin 17
     *
     * OCR can destroy the fraction/margin while leaving the finish digit:
     *
     *   813½ -> 81:
     *   79½  -> 79:
     *   75½  -> 75:
     *
     * In those damaged cases retain the position but do NOT invent a margin.
     */
    const rawSuffix =
      match[2] || "";

    const suffix =
      rawSuffix &&
      !/[:;%+]/.test(rawSuffix)
        ? rawSuffix
        : null;

    parsedTokens.push({
      raw: token,
      position: Number(match[1]),
      suffix,
    });
  }

  /*
   * Wheeling 330 uses three calls after the box.
   * Wheeling 548 and the standard route use four.
   * Do not manufacture a checkpoint that the source did not provide.
   */
  const expectedCallCount =
    String(trackCode ?? "").toUpperCase() === "WD" &&
    distanceYards === 330
      ? 3
      : 4;

  const actualCalls =
    parsedTokens.slice(
      0,
      Math.min(
        expectedCallCount,
        parsedTokens.length,
      ),
    );

  const finishToken =
    actualCalls[
      actualCalls.length - 1
    ] ?? null;

  let marginText =
    finishToken?.suffix ?? null;

  /*
   * Some 548/TS extractions separate the finish margin into the token
   * immediately after the four running calls.
   */
  if (
    !marginText &&
    actualCalls.length === expectedCallCount &&
    parsedTokens.length > expectedCallCount
  ) {
    const candidate =
      parsedTokens[expectedCallCount];

    if (candidate) {
      marginText =
        candidate.raw;
    }
  }

  return {
    runningPositions:
      actualCalls.map(
        (token) =>
          token.position,
      ),
    finishPosition:
      finishToken?.position ??
      null,
    marginText,
  };
}

function normalizeProgramFinishTimeToken(
  value: string | null | undefined,
): string | null {
  if (!value) {
    return null;
  }

  const token = cleanLine(value).toUpperCase();

  if (token === "OOP") {
    return "OOP";
  }

  if (/^\d{2}\.\d{2}$/.test(token)) {
    return token;
  }

  /*
   * Wheeling OCR frequently drops the decimal:
   *   4045 -> 40.45
   *   3950 -> 39.50
   *   3889 -> 38.89
   */
  if (/^\d{4}$/.test(token)) {
    return `${token.slice(0, 2)}.${token.slice(2)}`;
  }

  return null;
}

function normalizeWheelingProgramOddsToken(
  value: string | null | undefined,
): string | null {
  if (!value) {
    return null;
  }

  const token =
    cleanLine(value)
      .replace(/\*+$/, "");

  if (
    token === "----"
  ) {
    return token;
  }

  if (
    /^\.\d{1,2}$/.test(token) ||
    /^\d{1,2}\.\d{1,2}$/.test(token)
  ) {
    return token;
  }

  /*
   * OCR commonly removes the decimal specifically from the final-odds
   * column. Because this helper is called only for that structural column,
   * these repairs are safe:
   *
   *   430  -> 4.30
   *   650  -> 6.50
   *   1150 -> 11.50
   */
  if (/^\d{3}$/.test(token)) {
    return `${token.slice(0, 1)}.${token.slice(1)}`;
  }

  if (/^\d{4}$/.test(token)) {
    return `${token.slice(0, 2)}.${token.slice(2)}`;
  }

  return token;
}

function parseWheelingPastPerformances(
  rawText: string,
  programDate: string | null,
): GreyhoundPastPerformance[] {
  const normalized =
    normalizeWhitespace(rawText);

  const candidates =
    new Set<string>();

  for (
    const line of
    normalized
      .split("\n")
      .map(cleanLine)
      .filter(Boolean)
  ) {
    candidates.add(line);
  }

  /*
   * Wheeling OCR often flattens multiple past-performance rows into one
   * runner section. Recover every dated row independently.
   */
  const flat =
    cleanLine(normalized);

  const rowRegex =
    /(\d{2}\/\d{2})\s*([ASE])\s*(\d{1,2})\s+(WD|TS)\s+(\d{3,4})\s+([A-Z])\s+(\d{1,2}(?:\.\d+)?)\s+(\d{2})\s+([1-8])\s+(.+?)(?=\s+\d{2}\/\d{2}\s*[ASE]\s*\d{1,2}\s+(?:WD|TS)\b|$)/gi;

  for (
    const rowMatch of
    flat.matchAll(rowRegex)
  ) {
    candidates.add(
      cleanLine(rowMatch[0]),
    );
  }

  const history: GreyhoundPastPerformance[] = [];
  const seen = new Set<string>();

  const expectedCallsForDistance = (
    distanceYards: number,
  ) => distanceYards === 330 ? 3 : 4;

  const parseCallToken = (
    token: string,
  ): {
    position: number;
    marginText: string | null;
  } | null => {
    const match = cleanLine(token).match(
      /^([1-8])([0-9½¼¾A-Za-z:;%+.\-]*)$/i,
    );

    if (!match) return null;

    const suffix = match[2] ?? "";

    /*
     * Wheeling compresses finish + margin into one token. OCR damage such
     * as 79:, 75:, 813:, 88+ still leaves a trustworthy first digit.
     * Keep that finish position, but never invent the damaged margin.
     */
    const marginText =
      suffix &&
      !/[:;%+]/.test(suffix) &&
      /^(?:\d+(?:½|¼|¾)?|½|¼|¾|nk|ns|hd|n|h)$/i.test(suffix)
        ? suffix
        : null;

    return {
      position: Number(match[1]),
      marginText,
    };
  };

  const normalizeFinalTime = (
    token: string | null,
    distanceYards: number,
  ): number | null => {
    if (!token) return null;

    if (/^\d{2}\.\d{2}$/.test(token)) {
      return Number(token);
    }

    if (/^\d{4}$/.test(token)) {
      const repaired =
        Number(`${token.slice(0, 2)}.${token.slice(2)}`);

      const plausible =
        distanceYards === 330
          ? repaired >= 16 && repaired <= 21
          : distanceYards >= 650
            ? repaired >= 34 && repaired <= 45
            : repaired >= 27 && repaired <= 36;

      return plausible ? repaired : null;
    }

    return null;
  };

  const normalizeOdds = (
    token: string | null,
  ): string | null => {
    if (!token) return null;

    const cleaned =
      cleanLine(token).replace(/\*+$/, "");

    if (
      cleaned === "----" ||
      /^\.\d{1,2}$/.test(cleaned) ||
      /^\d{1,2}\.\d{1,2}$/.test(cleaned)
    ) {
      return cleaned;
    }

    // Decimal dropped specifically from Wheeling's final-odds column.
    if (/^\d{3}$/.test(cleaned)) {
      return `${cleaned[0]}.${cleaned.slice(1)}`;
    }

    if (/^\d{4}$/.test(cleaned)) {
      return `${cleaned.slice(0, 2)}.${cleaned.slice(2)}`;
    }

    return cleaned;
  };

  for (const line of candidates) {
    const match =
      line.match(
        /^(\d{2}\/\d{2})\s*([ASE])\s*(\d{1,2})\s+(WD|TS)\s+(\d{3,4})\s+([A-Z])\s+(\d{1,2}(?:\.\d+)?)\s+(\d{2})\s+([1-8])\s+(.+)$/i,
      );

    if (!match) continue;

    const raceDate =
      inferProgramHistoryDate(
        match[1],
        programDate,
      );

    const performanceCode =
      `${match[2].toUpperCase()}${match[3]}`;

    const trackCode =
      match[4].toUpperCase();

    const distanceYards =
      Number(match[5]);

    const tail =
      cleanLine(match[10]);

    const tokens =
      tail.split(/\s+/).filter(Boolean);

    const expectedCalls =
      expectedCallsForDistance(
        distanceYards,
      );

    const callTokens =
      tokens.slice(0, expectedCalls);

    const parsedCalls =
      callTokens.map(parseCallToken);

    const structuralCallsValid =
      parsedCalls.length === expectedCalls &&
      parsedCalls.every(
        (row) => row !== null,
      );

    const structuralCalls =
      structuralCallsValid
        ? parsedCalls.filter(
            (
              row,
            ): row is {
              position: number;
              marginText: string | null;
            } => row !== null,
          )
        : [];

    const fallbackCalls =
      parseProgramRunningCalls(
        tail,
        distanceYards,
        trackCode,
      );

    const runningPositions =
      structuralCalls.length > 0
        ? structuralCalls.map(
            (row) => row.position,
          )
        : fallbackCalls.runningPositions;

    const finishPosition =
      structuralCalls.length > 0
        ? structuralCalls.at(-1)?.position ?? null
        : fallbackCalls.finishPosition;

    const marginText =
      structuralCalls.length > 0
        ? structuralCalls.at(-1)?.marginText ?? null
        : fallbackCalls.marginText;

    /*
     * Once the expected running-call columns are consumed, parse the
     * remaining Wheeling columns by POSITION. This handles OCR-dropped
     * decimals such as:
     *
     *   1825 -> 18.25
     *   4045 -> 40.45
     *   430  -> 4.30 odds
     *   650  -> 6.50 odds
     */
    let cursor =
      structuralCalls.length > 0
        ? expectedCalls
        : -1;

    let finishTime: number | null = null;
    let speedRating: number | null = null;
    let odds: string | null = null;
    let grade: string | null = null;
    let comment: string | null = null;

    if (cursor >= 0) {
      finishTime =
        normalizeFinalTime(
          tokens[cursor] ?? null,
          distanceYards,
        );

      if (finishTime !== null) {
        cursor += 1;

        const speedToken =
          tokens[cursor] ?? null;

        if (
          speedToken &&
          /^\d{1,3}$/.test(speedToken)
        ) {
          speedRating =
            Number(speedToken);
          cursor += 1;
        }

        const oddsToken =
          tokens[cursor] ?? null;

        if (oddsToken) {
          odds =
            normalizeOdds(oddsToken);
          cursor += 1;
        }

        const gradeToken =
          tokens[cursor] ?? null;

        if (
          gradeToken &&
          /^[A-Z-]{1,4}$/i.test(
            gradeToken,
          )
        ) {
          grade =
            gradeToken.toUpperCase();
          cursor += 1;
        }

        comment =
          tokens
            .slice(cursor)
            .join(" ")
            .trim() || null;
      }
    }

    /*
     * Fall back to the older metadata extraction only when structural
     * parsing could not recover that field.
     */
    const tailMatch =
      tail.match(
        /(?:^|\s)(\d{2}\.\d{2}|\d{4}|OOP)\s+(\d{1,3})\s+((?:(?:\d+(?:\.\d+)?)|(?:\.\d+)|\d{3,4})\*?|----)\s+([A-Z-]{1,4})\s+(.+)$/i,
      );

    const looseTailMatch =
      tail.match(
        /(?:^|\s)(\d{2}\.\d{2}|\d{4}|OOP)\s+(.+?)\s+([A-Z-]{1,4})\s+([A-Za-z].*)$/i,
      );

    if (finishTime === null) {
      const finishTimeText =
        normalizeProgramFinishTimeToken(
          tailMatch?.[1] ??
          looseTailMatch?.[1] ??
          null,
        );

      if (
        finishTimeText &&
        /^\d{2}\.\d{2}$/.test(
          finishTimeText,
        )
      ) {
        finishTime =
          Number(finishTimeText);
      }
    }

    if (
      speedRating === null &&
      tailMatch?.[2]
    ) {
      speedRating =
        Number(tailMatch[2]);
    }

    if (!odds) {
      odds =
        normalizeOdds(
          tailMatch?.[3] ?? null,
        );
    }

    if (!grade) {
      grade =
        (
          tailMatch?.[4] ??
          looseTailMatch?.[3] ??
          null
        )?.toUpperCase() ?? null;
    }

    if (!comment) {
      comment =
        cleanLine(
          tailMatch?.[5] ??
          looseTailMatch?.[4] ??
          "",
        ) || null;
    }

    const sourceKey = [
      raceDate,
      performanceCode,
      trackCode,
      distanceYards,
      match[9],
    ].join("|");

    if (seen.has(sourceKey)) {
      continue;
    }

    seen.add(sourceKey);

    history.push({
      raceDate,
      performanceCode,
      trackCode,
      distanceYards,
      condition:
        match[6].toUpperCase(),
      weight:
        Number(match[8]),
      boxNumber:
        Number(match[9]),
      runningPositions,
      finishPosition,
      marginText,
      finishTime,
      speedRating,
      odds,
      grade,
      comment,
      rawText:
        line,
    });
  }

  return history
    .sort((a, b) =>
      String(
        b.raceDate ?? "",
      ).localeCompare(
        String(
          a.raceDate ?? "",
        ),
      ),
    )
    .slice(0, 12);
}
function parseWheelingProgramRunners(
  ocrBlock: string,
  nativeBlock = "",
  programDate: string | null = null,
): GreyhoundRunner[] {
  const ocrRunners = parseWheelingProgramOcrRunners(ocrBlock);
  const descriptors = parseWheelingProgramNativeTraps(nativeBlock || ocrBlock);

  if (ocrRunners.length === 0) {
    return [];
  }

  const unused = new Set(descriptors.map((descriptor) => descriptor.trapNumber));
  const runners: GreyhoundRunner[] = [];

  for (let index = 0; index < ocrRunners.length; index += 1) {
    const ocrRunner = ocrRunners[index];
    let descriptor: WheelingProgramTrapDescriptor | undefined;
    let bestScore = -1;

    for (const candidate of descriptors) {
      if (!unused.has(candidate.trapNumber)) {
        continue;
      }

      const score = programRunnerDescriptorScore(ocrRunner, candidate);

      if (score > bestScore) {
        bestScore = score;
        descriptor = candidate;
      }
    }

    /*
     * When OCR metadata is too damaged to score, program order is still
     * reliable. This preserves scratched/empty boxes because the native
     * descriptor list contains only active runners and retains box numbers.
     */
    if (!descriptor || bestScore <= 0) {
      descriptor = descriptors.find((candidate) =>
        unused.has(candidate.trapNumber),
      );
    }

    const trapNumber = descriptor?.trapNumber ?? index + 1;

    if (descriptor) {
      unused.delete(descriptor.trapNumber);
    }

    const historyByKey =
      new Map<string, GreyhoundPastPerformance>();

    for (const performance of [
      ...parseWheelingPastPerformances(
        ocrRunner.rawText,
        programDate,
      ),
      ...parseWheelingPastPerformances(
        descriptor?.rawText ?? "",
        programDate,
      ),
      ...parseWheelingPastPerformances(
        [descriptor?.rawText, ocrRunner.rawText]
          .filter(Boolean)
          .join(" "),
        programDate,
      ),
    ]) {
      const key = [
        performance.raceDate,
        performance.performanceCode,
        performance.trackCode,
        performance.distanceYards,
        performance.boxNumber,
      ].join("|");

      const existing = historyByKey.get(key);

      /*
       * Keep the richer copy when native and OCR extraction both found the
       * same historical start.
       */
      const quality = (row: GreyhoundPastPerformance) =>
        row.runningPositions.length * 5 +
        (row.finishPosition !== null ? 3 : 0) +
        (row.finishTime !== null ? 3 : 0) +
        (row.speedRating !== null ? 1 : 0) +
        (row.odds ? 1 : 0) +
        (row.grade ? 1 : 0) +
        (row.comment ? 1 : 0);

      if (!existing || quality(performance) > quality(existing)) {
        historyByKey.set(key, performance);
      }
    }

    runners.push({
      trapNumber,
      trapColor:
        descriptor?.trapColor ??
        WHEELING_TRAP_COLORS[trapNumber] ??
        null,
      name: ocrRunner.name,
      trainer:
        ocrRunner.trainer ??
        descriptor?.trainer ??
        descriptor?.kennel ??
        null,
      weight: ocrRunner.weight ?? descriptor?.weight ?? null,
      form:
        ocrRunner.csr
          ? `CSR ${ocrRunner.csr}`
          : descriptor?.csr
            ? `CSR ${descriptor.csr}`
            : null,
      odds: descriptor?.odds ?? null,
      rawText: [descriptor?.rawText, ocrRunner.rawText]
        .filter(Boolean)
        .join(" || "),
      history: Array.from(historyByKey.values())
        .sort((a, b) =>
          String(b.raceDate ?? "").localeCompare(
            String(a.raceDate ?? ""),
          ),
        )
        .slice(0, 12),
    });
  }

  return runners.sort(
    (a, b) => (a.trapNumber ?? 99) - (b.trapNumber ?? 99),
  );
}

function parseWheelingProgramPage(
  nativePageText: string,
  ocrPageText: string,
  fallbackRaceNumber: number,
): ParsedGreyhoundRace | null {
  const native = normalizeWhitespace(nativePageText);
  const ocr = normalizeWhitespace(ocrPageText);
  const metadataText = native || ocr;

  const raceNumber =
    extractRaceNumber(native) ??
    extractRaceNumber(ocr) ??
    fallbackRaceNumber;

  if (raceNumber < 1 || raceNumber > 99) {
    return null;
  }

  const headerMatch = metadataText.match(
    /\b(\d{3,4})\s+YARDS?\s+GRADE\s+([A-Z]{1,4}\d{0,2})\b/i,
  );

  const raceDate = parseDate(metadataText);

  const explicitPostTime = metadataText.match(
    /\bPost\s*Time\s*:\s*(\d{1,2}):(\d{2})\s*(AM|PM)\b/i,
  );

  return {
    track: "Wheeling",
    raceNumber,
    raceDate,
    raceTime: explicitPostTime
      ? normalizeClockTime(
          explicitPostTime[1],
          explicitPostTime[2],
          explicitPostTime[3],
        )
      : getWheelingScheduledRaceTime(raceNumber, metadataText),
    grade: headerMatch?.[2]?.toUpperCase() ?? parseGrade(metadataText),
    distance: headerMatch?.[1]
      ? `${headerMatch[1]} Yards`
      : parseDistance(metadataText),
    prizeMoney: parsePrizeMoney(metadataText),
    weather: parseWeather(metadataText),
    trackCondition: parseTrackCondition(metadataText),
    runners: parseWheelingProgramRunners(ocr, native, raceDate),
    rawText: [native, ocr ? `===== OCR PAGE =====\n${ocr}` : ""]
      .filter(Boolean)
      .join("\n\n"),
  };
}

function parseRunners(block: string): GreyhoundRunner[] {
  if (isWheelingProgramText(block)) {
    return parseWheelingProgramRunners(block);
  }

  if (
    /\bGrade\s*:/i.test(block) &&
    /\bDistance\s*:\s*\d{3,4}\s*Yards?\b/i.test(block)
  ) {
    return parseWheelingRunners(block).map((runner) => ({
      ...runner,
      trapColor:
        runner.trapNumber !== null
          ? WHEELING_TRAP_COLORS[runner.trapNumber] ??
            runner.trapColor
          : runner.trapColor,
    }));
  }

  return parseGenericRunners(block);
}

function normalizeWheelingOcrText(text: string): string {
  return normalizeWhitespace(text)
    /* Common Tesseract mistakes seen in Wheeling race headers. */
    .replace(/(?:^|\n)\s*ATH\s+Grade\s*:/gi, "\n4TH Grade:")
    .replace(/(?:^|\n)\s*BTH\s+Grade\s*:/gi, "\n6TH Grade:")
    .replace(/(?:^|\n)\s*[Il]TH\s+Grade\s*:/g, "\n11TH Grade:")
    .replace(/(?:^|\n)\s*l([0-7])TH\s+Grade\s*:/gi, (_match, digit) =>
      `\n1${digit}TH Grade:`,
    );
}

function splitRaceBlocks(text: string): string[] {
  const normalized = /\bWHEELING\b/i.test(text)
    ? normalizeWheelingOcrText(text)
    : normalizeWhitespace(text);

  const indexes: number[] = [];

  const raceHeaderRegex =
    /\b(?:Race\s*(?:No\.?\s*)?\d{1,2}|\d{1,2}(?:ST|ND|RD|TH)\s+Grade\s*:)/gi;

  let match: RegExpExecArray | null;

  while ((match = raceHeaderRegex.exec(normalized)) !== null) {
    indexes.push(match.index);

    if (match.index === raceHeaderRegex.lastIndex) {
      raceHeaderRegex.lastIndex += 1;
    }
  }

  const programHeaderRegex =
    /\b(?:WHEELING|TRI[\s-]?STATE)\s+(?:FIRST|SECOND|THIRD|FOURTH|FIFTH|SIXTH|SEVENTH|EIGHTH|NINTH|TENTH|ELEVENTH|TWELFTH|THIRTEENTH|FOURTEENTH|FIFTEENTH|SIXTEENTH|SEVENTEENTH)\s+RACE(?:\s+(?:WHEELING|TRI[\s-]?STATE))?\b/gi;

  while ((match = programHeaderRegex.exec(normalized)) !== null) {
    indexes.push(match.index);

    if (match.index === programHeaderRegex.lastIndex) {
      programHeaderRegex.lastIndex += 1;
    }
  }

  const orderedIndexes = Array.from(new Set(indexes)).sort(
    (a, b) => a - b,
  );

  if (orderedIndexes.length === 0) {
    return [normalized];
  }

  const blocks: string[] = [];

  for (let i = 0; i < orderedIndexes.length; i += 1) {
    const start = orderedIndexes[i];
    const end =
      i + 1 < orderedIndexes.length
        ? orderedIndexes[i + 1]
        : normalized.length;

    const block = normalized.slice(start, end).trim();

    if (block) {
      blocks.push(block);
    }
  }

  return blocks;
}

function extractRaceNumber(block: string): number | null {
  const standardMatch = block.match(
    /\bRace\s*(?:No\.?\s*)?(\d{1,2})\b/i,
  );

  if (standardMatch) {
    return Number(standardMatch[1]);
  }

  const ordinalMatch = block.match(
    /\b(\d{1,2})(?:ST|ND|RD|TH)\s+Grade\s*:/i,
  );

  if (ordinalMatch) {
    return Number(ordinalMatch[1]);
  }

  const programMatch = block.match(
    /\b(?:WHEELING|TRI[\s-]?STATE)\s+(FIRST|SECOND|THIRD|FOURTH|FIFTH|SIXTH|SEVENTH|EIGHTH|NINTH|TENTH|ELEVENTH|TWELFTH|THIRTEENTH|FOURTEENTH|FIFTEENTH|SIXTEENTH|SEVENTEENTH)\s+RACE\b/i,
  );

  if (programMatch) {
    return (
      WHEELING_PROGRAM_RACE_WORDS[
        programMatch[1].toLowerCase()
      ] ?? null
    );
  }

  return null;
}

function parseRaceCardText(
  text: string,
): ParsedGreyhoundRace[] {
  const normalized = /\bWHEELING\b/i.test(text)
    ? normalizeWheelingOcrText(text)
    : normalizeWhitespace(text);

  if (!normalized) {
    return [];
  }

  const blocks = splitRaceBlocks(normalized);
  const parsed: ParsedGreyhoundRace[] = [];

  const globalTrack = /\bWHEELING\b/i.test(normalized)
    ? "Wheeling"
    : /\bTRI[\s-]?STATE\b/i.test(normalized)
      ? "Tri-State"
      : "";
  const globalDate = parseDate(normalized);
  const isWheelingCard = /\bWHEELING\b/i.test(normalized);

  let lastTrack = globalTrack;

  for (const block of blocks) {
    const raceNumber = extractRaceNumber(block);

    if (
      raceNumber === null ||
      !Number.isFinite(raceNumber) ||
      raceNumber < 1
    ) {
      continue;
    }

    const track = detectTrackFromBlock(
      block,
      lastTrack || globalTrack,
    );

    lastTrack = track;

    const runners = parseRunners(block);

    parsed.push({
      track:
        track === "Unknown Track" && globalTrack
          ? globalTrack
          : track,
      raceNumber,
      raceDate: parseDate(block) ?? globalDate,
      raceTime: isWheelingCard
        ? getWheelingScheduledRaceTime(raceNumber, block)
        : parseRaceTime(block),
      grade: parseGrade(block),
      distance: parseDistance(block),
      prizeMoney: parsePrizeMoney(block),
      weather: parseWeather(block) ?? parseWeather(normalized),
      trackCondition:
        parseTrackCondition(block) ??
        parseTrackCondition(normalized),
      runners,
      rawText: block,
    });
  }

  const deduped = new Map<number, ParsedGreyhoundRace>();

  for (const race of parsed) {
    const existing = deduped.get(race.raceNumber);

    if (!existing) {
      deduped.set(race.raceNumber, race);
      continue;
    }

    deduped.set(race.raceNumber, {
      ...existing,
      ...race,
      raceDate: race.raceDate ?? existing.raceDate,
      raceTime: race.raceTime ?? existing.raceTime,
      grade: race.grade ?? existing.grade,
      distance: race.distance ?? existing.distance,
      prizeMoney: race.prizeMoney ?? existing.prizeMoney,
      weather: race.weather ?? existing.weather,
      trackCondition:
        race.trackCondition ?? existing.trackCondition,
      runners: mergeRaceRunners(
        existing.runners,
        race.runners,
      ),
    });
  }

  return Array.from(deduped.values()).sort(
    (a, b) => a.raceNumber - b.raceNumber,
  );
}

function runnerQuality(runner: GreyhoundRunner): number {
  let score = 0;

  if (runner.name && !/^unknown$/i.test(runner.name)) score += 4;
  if (runner.odds) score += 2;
  if (runner.trainer) score += 2;
  if (runner.weight) score += 2;
  if (runner.form) score += 1;

  return score;
}

function mergeRaceRunners(
  first: GreyhoundRunner[],
  second: GreyhoundRunner[],
): GreyhoundRunner[] {
  const byTrap = new Map<number, GreyhoundRunner>();

  for (const runner of [...first, ...second]) {
    if (runner.trapNumber === null) {
      continue;
    }

    const existing = byTrap.get(runner.trapNumber);

    if (!existing) {
      byTrap.set(runner.trapNumber, runner);
      continue;
    }

    const preferred =
      runnerQuality(runner) > runnerQuality(existing)
        ? runner
        : existing;
    const fallback = preferred === runner ? existing : runner;

    byTrap.set(runner.trapNumber, {
      ...fallback,
      ...preferred,
      name: preferred.name || fallback.name,
      trapColor: preferred.trapColor ?? fallback.trapColor,
      trainer: preferred.trainer ?? fallback.trainer,
      weight: preferred.weight ?? fallback.weight,
      form: preferred.form ?? fallback.form,
      odds: preferred.odds ?? fallback.odds,
      rawText: preferred.rawText ?? fallback.rawText,
      history:
        (preferred.history?.length ?? 0) >=
        (fallback.history?.length ?? 0)
          ? preferred.history
          : fallback.history,
    });
  }

  return Array.from(byTrap.values()).sort(
    (a, b) => (a.trapNumber ?? 99) - (b.trapNumber ?? 99),
  );
}

function mergeParsedRaces(
  nativeTextRaces: ParsedGreyhoundRace[],
  ocrTextRaces: ParsedGreyhoundRace[],
): ParsedGreyhoundRace[] {
  const map = new Map<string, ParsedGreyhoundRace>();

  const add = (race: ParsedGreyhoundRace) => {
    const normalizedTrack =
      race.track === "Unknown Track"
        ? ""
        : race.track.toLowerCase();

    const key = `${normalizedTrack}-${race.raceNumber}`;
    const existing = map.get(key);

    if (!existing) {
      map.set(key, race);
      return;
    }

    const preferred =
      race.runners.length > existing.runners.length
        ? race
        : existing;
    const fallback =
      preferred === race ? existing : race;

    map.set(key, {
      ...fallback,
      ...preferred,
      raceDate: preferred.raceDate ?? fallback.raceDate,
      raceTime: preferred.raceTime ?? fallback.raceTime,
      grade: preferred.grade ?? fallback.grade,
      distance: preferred.distance ?? fallback.distance,
      prizeMoney:
        preferred.prizeMoney ?? fallback.prizeMoney,
      weather: preferred.weather ?? fallback.weather,
      trackCondition:
        preferred.trackCondition ??
        fallback.trackCondition,
      /*
       * Native extraction and OCR often each recover different
       * traps from the same Wheeling race. Merge trap-by-trap
       * instead of discarding the shorter result.
       */
      runners: mergeRaceRunners(
        existing.runners,
        race.runners,
      ),
    });
  };

  nativeTextRaces.forEach(add);
  ocrTextRaces.forEach(add);

  return Array.from(map.values()).sort((a, b) => {
    if (a.track !== b.track) {
      return a.track.localeCompare(b.track);
    }

    return a.raceNumber - b.raceNumber;
  });
}

function sessionFromFirstPostTime(
  value: string | null | undefined,
): "morning" | "afternoon" | "evening" | null {
  if (!value) {
    return null;
  }

  const match =
    value.match(
      /^(\d{1,2}):(\d{2})/,
    );

  if (!match) {
    return null;
  }

  const hour =
    Number(match[1]);

  if (!Number.isFinite(hour)) {
    return null;
  }

  if (hour < 12) {
    return "morning";
  }

  if (hour >= 17) {
    return "evening";
  }

  return "afternoon";
}


function getCardFirstPostTime(
  races: ParsedGreyhoundRace[],
): string | null {
  const firstRace =
    [...races]
      .sort(
        (a, b) =>
          a.raceNumber -
          b.raceNumber,
      )[0];

  return firstRace?.raceTime ?? null;
}


function inferCardSession(
  races: ParsedGreyhoundRace[],
  expectedSession?: string,
): "morning" | "afternoon" | "evening" | "night" {
  const explicit =
    cleanLine(
      expectedSession ?? "",
    ).toLowerCase();

  if (
    explicit === "morning" ||
    explicit === "afternoon" ||
    explicit === "evening" ||
    explicit === "night"
  ) {
    return explicit;
  }

  const fromFirstPost =
    sessionFromFirstPostTime(
      getCardFirstPostTime(
        races,
      ),
    );

  if (fromFirstPost) {
    return fromFirstPost;
  }

  const firstRace =
    [...races]
      .sort(
        (a, b) =>
          a.raceNumber -
          b.raceNumber,
      )[0];

  const trackCode =
    firstRace
      ? normalizeTrackCode(
          firstRace.track,
        )
      : null;

  if (trackCode === "GTS") {
    return "evening";
  }

  return "afternoon";
}


function formatStage(stage: ProcessingStage): string {
  switch (stage) {
    case "reading":
      return "Reading file...";
    case "pdf":
      return "Opening PDF...";
    case "extracting":
      return "Extracting PDF text...";
    case "ocr":
      return "Running OCR...";
    case "parsing":
      return "Parsing race card...";
    case "importing":
      return "Saving race...";
    case "deleting":
      return "Deleting saved card...";
    default:
      return "";
  }
}

export default function GreyhoundRaceCardImporter({
  leagueId,
  onImportSuccess,
  backupOnly = false,
  expectedTrackCode,
  expectedTrackName,
  expectedRaceDate,
  expectedSession,
  importEndpoint = "/api/greyhound/races/import",
}: GreyhoundRaceCardImporterProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [url, setUrl] = useState("");
  const [rawText, setRawText] = useState("");
  const [parsedRaces, setParsedRaces] = useState<
    ParsedGreyhoundRace[]
  >([]);
  const [selectedRaceIndex, setSelectedRaceIndex] = useState<
    number | null
  >(null);

  const [stage, setStage] = useState<ProcessingStage>("idle");
  const [progress, setProgress] = useState(0);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [importProgressLabel, setImportProgressLabel] = useState("");

  const [fileName, setFileName] = useState("");
  const [usedOcr, setUsedOcr] = useState(false);
  const [pageCount, setPageCount] = useState(0);

  const busy = stage !== "idle";

  const refreshRaceCardManagement = () => {
    if (typeof window === "undefined") return;

    window.setTimeout(() => {
      window.location.reload();
    }, 450);
  };

  const selectedRace = useMemo(() => {
    if (selectedRaceIndex === null) {
      return null;
    }

    return parsedRaces[selectedRaceIndex] ?? null;
  }, [parsedRaces, selectedRaceIndex]);

  const resetMessages = () => {
    setError("");
    setSuccess("");
  };


  const validateBackupRace = (race: ParsedGreyhoundRace): string | null => {
    if (!backupOnly) return null;

    if (!expectedTrackCode || !expectedRaceDate || !expectedSession) {
      return "Backup import is missing its locked track/date/session context.";
    }

    const parsedTrackCode = normalizeTrackCode(race.track);

    if (parsedTrackCode !== expectedTrackCode) {
      return `This backup is locked to ${expectedTrackName ?? expectedTrackCode}. The parsed race card is for ${race.track || "an unknown track"}.`;
    }

    if (race.raceDate !== expectedRaceDate) {
      return `This backup is locked to ${expectedRaceDate}. The parsed race card date is ${race.raceDate ?? "missing"}.`;
    }

    return null;
  };

  const backupContext = backupOnly
    ? {
        trackCode: expectedTrackCode,
        raceDate: expectedRaceDate,
        session: expectedSession,
      }
    : undefined;

  const parseAndSetText = useCallback((text: string) => {
    setStage("parsing");
    setProgress(95);

    const cleaned = normalizeWhitespace(text);
    const races = parseRaceCardText(cleaned);

    setRawText(cleaned);

    if (races.length === 0) {
      setParsedRaces([]);
      setSelectedRaceIndex(null);

      throw new Error(
        "No races could be detected in the race card. Check the extracted text below or try OCR.",
      );
    }

    if (backupOnly) {
      const invalidRace = races.find((race) => validateBackupRace(race));

      if (invalidRace) {
        setParsedRaces([]);
        setSelectedRaceIndex(null);
        throw new Error(validateBackupRace(invalidRace) ?? "Backup race-card validation failed.");
      }
    }

    setParsedRaces(races);
    setSelectedRaceIndex(races.length > 0 ? 0 : null);
    setProgress(100);

    setSuccess(
      backupOnly
        ? `Validated ${races.length} race${races.length === 1 ? "" : "s"} for ${expectedTrackName ?? expectedTrackCode} on ${expectedRaceDate}.`
        : `Parsed ${races.length} race${races.length === 1 ? "" : "s"} successfully.`,
    );
  }, [
    backupOnly,
    expectedTrackCode,
    expectedTrackName,
    expectedRaceDate,
    expectedSession,
  ]);

  const extractPdf = useCallback(
    async (file: File) => {
      resetMessages();

      setStage("pdf");
      setProgress(2);
      setUsedOcr(false);

      const buffer = await file.arrayBuffer();
      const data = new Uint8Array(buffer);

      const pdfjs = await import(
        "pdfjs-dist/legacy/build/pdf.mjs"
      );

      if (!pdfjs.GlobalWorkerOptions.workerSrc) {
        pdfjs.GlobalWorkerOptions.workerSrc =
          `https://unpkg.com/pdfjs-dist@${pdfjs.version}/legacy/build/pdf.worker.min.mjs`;
      }

      const loadingTask = pdfjs.getDocument({
        data,
      });

      const pdf = await loadingTask.promise;

      setPageCount(pdf.numPages);
      setStage("extracting");
      setProgress(5);

      const nativePageTexts: string[] = [];
      const sparsePages: number[] = [];

      for (
        let pageNumber = 1;
        pageNumber <= pdf.numPages;
        pageNumber += 1
      ) {
        const page = await pdf.getPage(pageNumber);
        const content = await page.getTextContent();

        const pageText = content.items
          .map((item) => {
            if ("str" in item) {
              return item.str;
            }

            return "";
          })
          .join(" ");

        const normalizedPageText =
          normalizeWhitespace(pageText);

        nativePageTexts.push(normalizedPageText);

        if (
          normalizedPageText.length <
          MIN_NATIVE_TEXT_LENGTH
        ) {
          sparsePages.push(pageNumber);
        }

        setProgress(
          Math.min(
            45,
            5 +
              Math.round(
                (pageNumber / pdf.numPages) * 40,
              ),
          ),
        );
      }

      const nativeText = nativePageTexts.join("\n\n");
      const nativeRaces = parseRaceCardText(nativeText);

      const isWheelingCard =
        /\bWHEELING\b/i.test(nativeText);
      const isWheelingProgram =
        isWheelingProgramText(nativeText);
      const isTriStateProgram =
        isTriStateProgramText(nativeText);
      const isWheelingEntriesCard =
        isWheelingCard && !isWheelingProgram;

      const needsOcr =
        isWheelingCard ||
        isTriStateProgram ||
        sparsePages.length > 0 ||
        nativeText.length < MIN_NATIVE_TEXT_LENGTH ||
        nativeRaces.length === 0 ||
        nativeRaces.some(
          (race) => race.runners.length === 0,
        );

      if (!needsOcr) {
        parseAndSetText(nativeText);
        await loadingTask.destroy();
        return;
      }

      setStage("ocr");
      setUsedOcr(true);
      setProgress(48);

      const { createWorker, PSM } = await import("tesseract.js");

      const worker = await createWorker(
        "eng",
        undefined,
        {
          logger(message) {
            if (message.status === "recognizing text") {
              const workerProgress =
                typeof message.progress === "number"
                  ? message.progress
                  : 0;

              setProgress((previous) =>
                Math.max(
                  previous,
                  Math.min(
                    90,
                    48 +
                      Math.round(
                        workerProgress * 35,
                      ),
                  ),
                ),
              );
            }
          },
        },
      );

      if (isTriStateProgram) {
        await worker.setParameters({
          tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
        });
      }

      const ocrPageTexts: string[] = [];
      const ocrPageTextByPage = new Map<number, string>();

      try {
        const pagesToOcr =
          isWheelingCard ||
          isTriStateProgram ||
          nativeRaces.length === 0 ||
          nativeRaces.some(
            (race) => race.runners.length === 0,
          )
            ? Array.from(
                { length: pdf.numPages },
                (_, index) => index + 1,
              )
            : sparsePages;

        for (
          let i = 0;
          i < pagesToOcr.length;
          i += 1
        ) {
          const pageNumber = pagesToOcr[i];
          const page = await pdf.getPage(pageNumber);

          const viewport = page.getViewport({
            scale: PDF_RENDER_SCALE,
          });

          const canvas =
            document.createElement("canvas");

          const context = canvas.getContext("2d", {
            alpha: false,
          });

          if (!context) {
            throw new Error(
              `Could not create canvas context for PDF page ${pageNumber}.`,
            );
          }

          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);

          context.fillStyle = "#ffffff";
          context.fillRect(
            0,
            0,
            canvas.width,
            canvas.height,
          );

          await page.render({
            canvas,
            canvasContext: context,
            viewport,
          }).promise;

          if (isWheelingEntriesCard) {
            const splitX = Math.floor(
              canvas.width / 2,
            );

            const columnSpecs = [
              {
                x: 0,
                width: splitX,
              },
              {
                x: splitX,
                width: canvas.width - splitX,
              },
            ];

            for (const column of columnSpecs) {
              if (column.width <= 0) {
                continue;
              }

              const columnCanvas =
                document.createElement("canvas");

              columnCanvas.width =
                column.width;
              columnCanvas.height =
                canvas.height;

              const columnContext =
                columnCanvas.getContext("2d", {
                  alpha: false,
                });

              if (!columnContext) {
                continue;
              }

              columnContext.fillStyle =
                "#ffffff";
              columnContext.fillRect(
                0,
                0,
                columnCanvas.width,
                columnCanvas.height,
              );

              columnContext.drawImage(
                canvas,
                column.x,
                0,
                column.width,
                canvas.height,
                0,
                0,
                column.width,
                canvas.height,
              );

              const columnResult =
                await worker.recognize(
                  columnCanvas,
                );

              const columnText =
                normalizeWhitespace(
                  columnResult.data.text || "",
                );

              if (columnText) {
                ocrPageTexts.push(
                  columnText,
                );
              }

              columnCanvas.width = 1;
              columnCanvas.height = 1;
            }
          } else {
            const result =
              await worker.recognize(canvas);

            const ocrText =
              normalizeWhitespace(
                result.data.text || "",
              );

            if (ocrText) {
              ocrPageTexts.push(ocrText);
              ocrPageTextByPage.set(pageNumber, ocrText);
            }
          }

          canvas.width = 1;
          canvas.height = 1;

          const pageProgress =
            pagesToOcr.length === 0
              ? 1
              : (i + 1) / pagesToOcr.length;

          setProgress(
            Math.min(
              92,
              50 +
                Math.round(pageProgress * 42),
            ),
          );
        }
      } finally {
        await worker.terminate();
      }

      const ocrText = ocrPageTexts.join("\n\n");

      setStage("parsing");
      setProgress(94);

      let mergedRaces = isWheelingProgram
        ? nativePageTexts
            .map((nativePageText, index) =>
              parseWheelingProgramPage(
                nativePageText,
                ocrPageTextByPage.get(index + 1) ?? "",
                index + 1,
              ),
            )
            .filter(
              (race): race is ParsedGreyhoundRace => race !== null,
            )
            .sort((a, b) => a.raceNumber - b.raceNumber)
        : isTriStateProgram
          ? nativePageTexts
              .map((nativePageText, index) =>
                parseTriStateProgramPage(
                  nativePageText,
                  ocrPageTextByPage.get(index + 1) ?? "",
                  index + 1,
                ),
              )
              .filter(
                (race): race is ParsedGreyhoundRace => race !== null,
              )
              .sort((a, b) => a.raceNumber - b.raceNumber)
          : mergeParsedRaces(
              nativeRaces,
              parseRaceCardText(ocrText),
            );

      let currentCardAuthoritativeEntries: GreyhoundAuthoritativeEntry[] = [];
      let currentCardAuthoritativeTrackCode: "GWD" | "GTS" | null = null;

      /*
       * CURRENT-CARD DOG IDENTITY — OFFICIAL ENTRIES PDF IS AUTHORITATIVE
       *
       * This applies to BOTH Tri-State and Wheeling.
       *
       * Match strictly by:
       *   track + race date + session + Race + Box
       *
       * The Full Program PDF may supply grade, distance, Past Performances,
       * runner-block images and the full official page, but it must NEVER
       * replace the dog identity already imported from Entries.
       *
       * Wheeling can contain legitimate vacant / NO GREYHOUND boxes. Those
       * boxes have no authoritative dog row and therefore are not turned into
       * fake greyhounds.
       */
      if (
        (isTriStateProgram || isWheelingProgram) &&
        mergedRaces.length > 0
      ) {
        const trackCode: "GWD" | "GTS" =
          isWheelingProgram ? "GWD" : "GTS";

        const trackLabel =
          trackCode === "GWD" ? "Wheeling" : "Tri-State";

        const raceDate =
          mergedRaces.find((race) => Boolean(race.raceDate))?.raceDate ??
          null;

        const session = inferCardSession(
          mergedRaces,
          expectedSession,
        );

        if (!raceDate) {
          throw new Error(
            `${trackLabel} Program date could not be determined, so authoritative Entries cannot be matched.`,
          );
        }

        const params = new URLSearchParams({
          leagueId,
          trackCode,
          raceDate,
          session,
        });

        const authoritativeResponse = await fetch(
          `/api/greyhound/entries/import?${params.toString()}`,
          { method: "GET", cache: "no-store" },
        );

        const authoritativePayload =
          (await authoritativeResponse.json().catch(() => ({}))) as {
            success?: boolean;
            entries?: GreyhoundAuthoritativeEntry[];
            error?: string;
            message?: string;
          };

        if (
          !authoritativeResponse.ok ||
          authoritativePayload.success !== true
        ) {
          throw new Error(
            authoritativePayload.error ??
              authoritativePayload.message ??
              `Could not load authoritative ${trackLabel} Entries.`,
          );
        }

        const authoritativeEntries =
          authoritativePayload.entries ?? [];

        /*
         * Preserve the exact display names returned by the Entries API.
         * Do not normalize, concatenate, title-case, or rebuild dogName.
         * Internal spaces from the authoritative Entries import are retained.
         */
        currentCardAuthoritativeEntries = authoritativeEntries;
        currentCardAuthoritativeTrackCode = trackCode;

        if (authoritativeEntries.length === 0) {
          throw new Error(
            `${trackLabel} Program import requires the official Entries PDF to be imported first. No authoritative Entries were found for ${raceDate} (${session}).`,
          );
        }

        /*
         * Tri-State has a fixed 14 x 8 = 112 current-card runners.
         * Keep that proven validation unchanged.
         *
         * Wheeling is deliberately NOT required to have 136 dog rows because
         * official stakes races can contain vacant / NO GREYHOUND boxes.
         */
        if (
          trackCode === "GTS" &&
          authoritativeEntries.length !== 112
        ) {
          throw new Error(
            `Tri-State Program import requires 112 authoritative Entries. Found ${authoritativeEntries.length}.`,
          );
        }

        const authoritativeRaceNumbers = new Set(
          authoritativeEntries.map((entry) => entry.raceNumber),
        );

        const racesMissingEntries = mergedRaces
          .filter(
            (race) =>
              !authoritativeRaceNumbers.has(race.raceNumber),
          )
          .map((race) => race.raceNumber);

        if (racesMissingEntries.length > 0) {
          throw new Error(
            `${trackLabel} Program does not match the imported Entries card. No authoritative dog rows were found for Race ${racesMissingEntries.join(", Race ")}.`,
          );
        }

        /*
         * Verify every authoritative Entries dog has a legal Race + Box key.
         * Do not require all eight boxes at Wheeling because vacancies are real.
         */
        const invalidAuthoritative = authoritativeEntries.filter(
          (entry) =>
            !Number.isInteger(entry.raceNumber) ||
            entry.raceNumber < 1 ||
            !Number.isInteger(entry.boxNumber) ||
            entry.boxNumber < 1 ||
            entry.boxNumber > 8 ||
            !Number.isFinite(entry.dogId) ||
            entry.dogId <= 0 ||
            !entry.dogName?.trim(),
        );

        if (invalidAuthoritative.length > 0) {
          throw new Error(
            `${trackLabel} Entries contain ${invalidAuthoritative.length} invalid Race + Box dog mapping${invalidAuthoritative.length === 1 ? "" : "s"}. Re-import the official Entries PDF before importing the Program.`,
          );
        }

        const duplicateKeys = new Set<string>();
        const seenKeys = new Set<string>();

        for (const entry of authoritativeEntries) {
          const key = `${entry.raceNumber}:${entry.boxNumber}`;

          if (seenKeys.has(key)) {
            duplicateKeys.add(key);
          }

          seenKeys.add(key);
        }

        if (duplicateKeys.size > 0) {
          throw new Error(
            `${trackLabel} Entries contain duplicate Race + Box mappings: ${Array.from(duplicateKeys)
              .map((key) => {
                const [raceNumber, boxNumber] = key.split(":");
                return `Race ${raceNumber} Box ${boxNumber}`;
              })
              .join(", ")}.`,
          );
        }

        mergedRaces = applyAuthoritativeEntries(
          mergedRaces,
          authoritativeEntries,
          trackCode,
        );

        /*
         * After rebuilding, every current runner now comes from Entries.
         * Program OCR can no longer shift one dog's identity into another box.
         */
        const unresolved = mergedRaces.flatMap((race) =>
          race.runners
            .filter(
              (runner) =>
                runner.trapNumber === null ||
                !runner.name?.trim(),
            )
            .map(
              (runner) =>
                `Race ${race.raceNumber} Box ${runner.trapNumber ?? "?"}`,
            ),
        );

        if (unresolved.length > 0) {
          throw new Error(
            `${trackLabel} Program could not resolve authoritative Entries identity for ${unresolved.join(", ")}.`,
          );
        }
      }

      /*
       * OFFICIAL FULL PROGRAM PAGE ARCHIVE
       *
       * Both supported tracks use one race per PDF page:
       *   Page 1 = Race 1, Page 2 = Race 2, ... Page N = Race N.
       *
       * Preserve the ENTIRE rendered page once on its race. This is the source
       * displayed beneath the eight runners in My Wagers. No dog-block crop,
       * OCR name, odds marker, or Past Performances tab is required for display.
       */
      if (isWheelingProgram || isTriStateProgram) {
        for (
          let pageNumber = 1;
          pageNumber <= pdf.numPages;
          pageNumber += 1
        ) {
          const raceForPage = mergedRaces.find(
            (race) => race.raceNumber === pageNumber,
          );

          if (!raceForPage) {
            continue;
          }

          const page = await pdf.getPage(pageNumber);
          const viewport = page.getViewport({
            scale: PDF_RENDER_SCALE,
          });
          const pageCanvas = document.createElement("canvas");
          const pageContext = pageCanvas.getContext("2d", {
            alpha: false,
          });

          if (!pageContext) {
            throw new Error(
              `Could not create the official Program image for Race ${pageNumber}.`,
            );
          }

          pageCanvas.width = Math.ceil(viewport.width);
          pageCanvas.height = Math.ceil(viewport.height);

          pageContext.fillStyle = "#ffffff";
          pageContext.fillRect(
            0,
            0,
            pageCanvas.width,
            pageCanvas.height,
          );

          await page.render({
            canvas: pageCanvas,
            canvasContext: pageContext,
            viewport,
          }).promise;

          raceForPage.programPageImageDataUrl =
            pageCanvas.toDataURL("image/png");

          pageCanvas.width = 1;
          pageCanvas.height = 1;
        }
      }

      const recoverTriStateNameFromExactCrop = async (
        cropCanvas: HTMLCanvasElement,
        worker: Awaited<ReturnType<typeof createWorker>>,
        knownRaceNames: string[],
      ): Promise<string | null> => {
        /*
         * Verified against the actual Sep. 15 Tri-State PDF:
         *
         * page width = 594 PDF points
         * trap number starts around x=44
         * bold dog name begins around x=58
         * the next statistical/header columns begin around x=250
         *
         * The bold dog names themselves are NOT exposed by the PDF text layer
         * even though the trap number and surrounding statistics are. So OCR
         * only this exact printed name strip. No history/comments/trainer text
         * can enter this rectangle.
         */
        const sourceScale =
          cropCanvas.width / 594;

        const sx = Math.max(
          0,
          Math.floor(57 * sourceScale),
        );
        /*
         * With the 16-point block top pad, the bold name is now actually
         * present near the top of this crop. Read a slightly taller strip to
         * cover font ascenders/descenders without reaching Trainer/history.
         */
        const sy = Math.max(
          0,
          Math.floor(1 * sourceScale),
        );
        const sw = Math.min(
          cropCanvas.width - sx,
          Math.ceil((250 - 57) * sourceScale),
        );
        const sh = Math.min(
          cropCanvas.height - sy,
          Math.ceil(24 * sourceScale),
        );

        if (sw <= 0 || sh <= 0) {
          return null;
        }

        const nameCanvas =
          document.createElement("canvas");

        /*
         * The source is already rendered at PDF_RENDER_SCALE. Enlarge the
         * isolated bold-name strip another 4x for Tesseract.
         */
        const upscale = 4;
        nameCanvas.width = sw * upscale;
        nameCanvas.height = sh * upscale;

        const context =
          nameCanvas.getContext("2d", {
            alpha: false,
          });

        if (!context) {
          return null;
        }

        context.fillStyle = "#ffffff";
        context.fillRect(
          0,
          0,
          nameCanvas.width,
          nameCanvas.height,
        );
        context.imageSmoothingEnabled = true;
        context.drawImage(
          cropCanvas,
          sx,
          sy,
          sw,
          sh,
          0,
          0,
          nameCanvas.width,
          nameCanvas.height,
        );

        await worker.setParameters({
          tessedit_pageseg_mode: PSM.SINGLE_LINE,
          preserve_interword_spaces: "1",
          tessedit_char_whitelist:
            "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'-. ",
        });

        const result =
          await worker.recognize(nameCanvas);

        nameCanvas.width = 1;
        nameCanvas.height = 1;

        const raw = cleanLine(
          (result.data.text ?? "")
            .replace(/\r/g, " ")
            .replace(/\n/g, " "),
        )
          .replace(/^\s*[1-8]\s+/, "")
          .replace(
            /\s+(?:TS|WD|Kennel|Trainer|Weight|Odds)\b.*$/i,
            "",
          )
          .trim();

        const cleaned =
          cleanTriStateRecoveredDogNameBoundary(
            raw,
            knownRaceNames,
          );

        if (
          !cleaned ||
          !looksLikeTriStateDogName(cleaned) ||
          /^Tri-State Box \d+$/i.test(cleaned) ||
          /\d/.test(cleaned)
        ) {
          return null;
        }

        return cleaned;
      };

      const recoverTriStateNameFromProgramImage = async (
        pageCanvas: HTMLCanvasElement,
        trapNumber: number,
        worker: Awaited<ReturnType<typeof createWorker>>,
      ): Promise<string | null> => {
        /*
         * Verified from the ACTUAL uploaded Tri-State PDF object structure:
         *
         * Each current dog name is its own embedded image object.
         * Page 1 name-image bounding boxes are exactly:
         *   trap 1: (57,  77) -> (242,  93)
         *   trap 2: (57, 157) -> (242, 173)
         *   trap 3: (57, 237) -> (242, 253)
         *   ...
         *   trap 8: (57, 637) -> (242, 653)
         *
         * So do NOT infer the name from text, comments, trainer, or a runner
         * crop. Read the exact embedded-name rectangle directly from the
         * rendered official program page.
         */
        if (
          trapNumber < 1 ||
          trapNumber > 8
        ) {
          return null;
        }

        const pageScale =
          pageCanvas.width / 594;

        const pdfX1 = 57;
        const pdfX2 = 242;
        const pdfY1 =
          77 + (trapNumber - 1) * 80;
        const pdfY2 = pdfY1 + 16;

        const sx = Math.round(
          pdfX1 * pageScale,
        );
        const sy = Math.round(
          pdfY1 * pageScale,
        );
        const sw = Math.round(
          (pdfX2 - pdfX1) * pageScale,
        );
        const sh = Math.round(
          (pdfY2 - pdfY1) * pageScale,
        );

        if (
          sx < 0 ||
          sy < 0 ||
          sw <= 0 ||
          sh <= 0 ||
          sx + sw > pageCanvas.width ||
          sy + sh > pageCanvas.height
        ) {
          return null;
        }

        const nameCanvas =
          document.createElement("canvas");

        const upscale = 5;
        nameCanvas.width = sw * upscale;
        nameCanvas.height = sh * upscale;

        const context =
          nameCanvas.getContext("2d", {
            alpha: false,
          });

        if (!context) {
          return null;
        }

        context.fillStyle = "#ffffff";
        context.fillRect(
          0,
          0,
          nameCanvas.width,
          nameCanvas.height,
        );
        context.imageSmoothingEnabled = true;
        context.drawImage(
          pageCanvas,
          sx,
          sy,
          sw,
          sh,
          0,
          0,
          nameCanvas.width,
          nameCanvas.height,
        );

        await worker.setParameters({
          tessedit_pageseg_mode:
            PSM.SINGLE_LINE,
          preserve_interword_spaces: "1",
          tessedit_char_whitelist:
            "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'-. ",
        });

        const result =
          await worker.recognize(
            nameCanvas,
          );

        nameCanvas.width = 1;
        nameCanvas.height = 1;

        const name = cleanLine(
          (result.data.text ?? "")
            .replace(/\r/g, " ")
            .replace(/\n/g, " "),
        ).trim();

        if (
          !name ||
          name.length < 2 ||
          /\d/.test(name) ||
          !/[A-Za-z]/.test(name)
        ) {
          return null;
        }

        return name;
      };

      /*
       * Preserve the EXACT visual dog block from the imported official PDF.
       *
       * IMPORTANT: crop boundaries are located from each trap's stable
       * morning-line/box/color marker, NOT from the parsed dog name. That
       * means a damaged OCR name cannot cause the wrong dog's program block
       * to be saved.
       *
       * For Tri-State, after the exact band is cropped we OCR only the header
       * portion of that band. This is the authoritative name-recovery fallback
       * for boxes whose full-page OCR missed the dog name.
       */
      if (isWheelingProgram || isTriStateProgram) {
        const normalizedMarkerText = (value: string) =>
          cleanLine(value)
            .replace(/\s+/g, "")
            .replace(/[^A-Z0-9/-]/gi, "")
            .toUpperCase();

        const nameWorker = isTriStateProgram
          ? await createWorker("eng")
          : null;

        if (nameWorker) {
          await nameWorker.setParameters({
            tessedit_pageseg_mode: PSM.SPARSE_TEXT,
          });
        }

        try {
          for (
            let pageNumber = 1;
            pageNumber <= pdf.numPages;
            pageNumber += 1
          ) {
            const parsedPage = isWheelingProgram
              ? parseWheelingProgramPage(
                  nativePageTexts[pageNumber - 1] ?? "",
                  ocrPageTextByPage.get(pageNumber) ?? "",
                  pageNumber,
                )
              : parseTriStateProgramPage(
                  nativePageTexts[pageNumber - 1] ?? "",
                  ocrPageTextByPage.get(pageNumber) ?? "",
                  pageNumber,
                );

            if (!parsedPage) {
              continue;
            }

            const raceForPage =
              mergedRaces.find(
                (race) => race.raceNumber === parsedPage.raceNumber,
              ) ?? parsedPage;

            if (raceForPage.runners.length === 0) {
              continue;
            }

            const page = await pdf.getPage(pageNumber);
            const viewport = page.getViewport({
              scale: PDF_RENDER_SCALE,
            });
            const content = await page.getTextContent();

            const textItems = content.items
              .map((item) => {
                if (
                  !("str" in item) ||
                  typeof item.str !== "string" ||
                  !("transform" in item) ||
                  !Array.isArray(item.transform)
                ) {
                  return null;
                }

                const transform = item.transform as number[];
                const [viewportX, viewportY] =
                  viewport.convertToViewportPoint(
                    Number(transform[4] ?? 0),
                    Number(transform[5] ?? 0),
                  );

                return {
                  text: item.str,
                  x: viewportX,
                  y: viewportY,
                };
              })
              .filter(
                (
                  item,
                ): item is {
                  text: string;
                  x: number;
                  y: number;
                } => item !== null,
              );

            /*
             * Rebuild visual text lines from native PDF coordinates. Morning
             * line + trap/color markers are much more stable than dog names.
             */
            const visualLines: Array<{
              y: number;
              text: string;
            }> = [];

            for (const item of [...textItems].sort(
              (a, b) =>
                Math.abs(a.y - b.y) <= 4
                  ? a.x - b.x
                  : a.y - b.y,
            )) {
              const existing = visualLines.find(
                (line) => Math.abs(line.y - item.y) <= 4,
              );

              if (existing) {
                existing.text += ` ${item.text}`;
              } else {
                visualLines.push({
                  y: item.y,
                  text: item.text,
                });
              }
            }

            /*
             * Native-PDF runner-name extraction for BOTH Tri-State and
             * Wheeling.
             *
             * IMPORTANT: Do not concatenate arbitrary same-line text. The
             * official program header is:
             *
             *   [morning line] [trap] [DOG NAME] ... other columns ...
             *
             * The dog name is the contiguous native-PDF text immediately
             * following the trap number. Stop as soon as a meaningful
             * horizontal gap or another program column begins.
             */
            const nativeNameByTrap = new Map<number, string>();

            type PositionedTextItem = {
              text: string;
              x: number;
              y: number;
              width: number;
              height: number;
            };

            const positionedTextItems: PositionedTextItem[] =
              content.items
                .map((item) => {
                  if (
                    !("str" in item) ||
                    typeof item.str !== "string" ||
                    !("transform" in item) ||
                    !Array.isArray(item.transform)
                  ) {
                    return null;
                  }

                  const transform = item.transform as number[];
                  const [x, y] =
                    viewport.convertToViewportPoint(
                      Number(transform[4] ?? 0),
                      Number(transform[5] ?? 0),
                    );

                  const rawWidth =
                    "width" in item &&
                    typeof item.width === "number"
                      ? item.width
                      : 0;
                  const rawHeight =
                    "height" in item &&
                    typeof item.height === "number"
                      ? item.height
                      : Math.abs(
                          Number(transform[3] ?? 0),
                        );

                  return {
                    text: cleanLine(item.str),
                    x,
                    y,
                    width:
                      rawWidth * PDF_RENDER_SCALE,
                    height:
                      Math.max(
                        rawHeight * PDF_RENDER_SCALE,
                        1,
                      ),
                  };
                })
                .filter(
                  (
                    item,
                  ): item is PositionedTextItem =>
                    item !== null && Boolean(item.text),
                );

            const isProgramColumnStart = (
              value: string,
            ) => {
              const text = cleanLine(value);

              return (
                /^(?:Kennel|Trainer)\s*:/i.test(text) ||
                /^(?:TS|WD)$/i.test(text) ||
                /^(?:CSR|CRS)$/i.test(text) ||
                /^(?:Red|Blue|White|Green|Black|Yellow)$/i.test(
                  text,
                ) ||
                /^\d{2}(?:\.\d+)?$/.test(text) ||
                /^[A-Z]\s+[A-Z]$/.test(text)
              );
            };

            for (let trap = 1; trap <= 8; trap += 1) {
              /*
               * A real trap header is followed immediately on the same
               * baseline by alphabetic dog-name text. This excludes trap
               * numbers that appear inside historical running lines.
               */
              const trapItems =
                positionedTextItems
                  .filter(
                    (item) =>
                      item.text === String(trap),
                  )
                  .sort((a, b) => a.y - b.y);

              const candidates: Array<{
                name: string;
                score: number;
              }> = [];

              for (const trapItem of trapItems) {
                const sameBaseline =
                  positionedTextItems
                    .filter(
                      (item) =>
                        item.x > trapItem.x &&
                        Math.abs(
                          item.y - trapItem.y,
                        ) <=
                          Math.max(
                            3,
                            trapItem.height * 0.38,
                          ),
                    )
                    .sort((a, b) => a.x - b.x);

                if (sameBaseline.length === 0) {
                  continue;
                }

                const pieces: string[] = [];
                let previousRight =
                  trapItem.x +
                  Math.max(trapItem.width, 1);

                for (const item of sameBaseline) {
                  const value = cleanLine(item.text);
                  if (!value) continue;

                  const gap = item.x - previousRight;

                  /*
                   * Names may be split into multiple PDF text items, but those
                   * pieces sit very close together. A large gap means the next
                   * program column has started. This prevents text such as
                   * "Comfortable Lead Oya Remember Win" from becoming a name.
                   */
                  const maxNameGap =
                    Math.max(
                      18,
                      trapItem.height * 1.15,
                    );

                  if (
                    pieces.length > 0 &&
                    gap > maxNameGap
                  ) {
                    break;
                  }

                  if (
                    pieces.length > 0 &&
                    isProgramColumnStart(value)
                  ) {
                    break;
                  }

                  /*
                   * Before accepting the first piece, require it to look like
                   * actual name text and to be physically close to the trap.
                   */
                  if (pieces.length === 0) {
                    if (
                      gap > Math.max(
                        28,
                        trapItem.height * 1.8,
                      ) ||
                      !/[A-Za-z]/.test(value) ||
                      isProgramColumnStart(value)
                    ) {
                      continue;
                    }
                  }

                  if (
                    /\b(?:Kennel|Trainer|Weight|Odds)\s*:/i.test(
                      value,
                    )
                  ) {
                    break;
                  }

                  pieces.push(value);
                  previousRight =
                    item.x +
                    Math.max(item.width, 1);

                  if (
                    pieces.length >= 5 ||
                    pieces.join(" ").length >= 36
                  ) {
                    break;
                  }
                }

                const rawName = cleanLine(
                  pieces.join(" "),
                )
                  .replace(
                    /^\s*[1-8]\s+/,
                    "",
                  )
                  .trim();

                /*
                 * Native names are usually uppercase in both official
                 * programs. Do not run the old broad OCR boundary heuristic
                 * here; native PDF text should be preserved as printed.
                 */
                if (
                  !rawName ||
                  rawName.length < 2 ||
                  /\d/.test(rawName) ||
                  isProgramColumnStart(rawName) ||
                  /\b(?:Kennel|Trainer|Weight|Odds|Race|Grade|Yards|Post|Time|Lead|Remember|Win)\b/i.test(
                    rawName,
                  )
                ) {
                  continue;
                }

                const words =
                  rawName.split(/\s+/);

                const uppercaseLetters =
                  rawName
                    .replace(/[^A-Za-z]/g, "");
                const uppercaseScore =
                  uppercaseLetters &&
                  uppercaseLetters ===
                    uppercaseLetters.toUpperCase()
                    ? 50
                    : 0;

                candidates.push({
                  name: rawName,
                  score:
                    uppercaseScore +
                    (words.length >= 1 &&
                    words.length <= 4
                      ? 30
                      : -30) +
                    Math.min(
                      rawName.length,
                      25,
                    ),
                });
              }

              const best =
                candidates.sort(
                  (a, b) =>
                    b.score - a.score,
                )[0];

              if (best) {
                nativeNameByTrap.set(
                  trap,
                  best.name,
                );
              }
            }

            /*
             * Apply native names only when confidently found. Otherwise keep
             * the existing parsed name and allow the narrow OCR fallback.
             */
            for (const runner of raceForPage.runners) {
              if (!runner.trapNumber) continue;

              const nativeName =
                nativeNameByTrap.get(
                  runner.trapNumber,
                );

              if (
                nativeName &&
                !["GTS", "GWD"].includes(
                  normalizeTrackCode(raceForPage.track) ?? "",
                )
              ) {
                /*
                 * Never let Program text replace an official Entries name.
                 * GTS/GWD current-card identity is Race + Box from Entries.
                 */
                runner.name = nativeName;
              }
            }

            const located: Array<{
              runner: GreyhoundRunner;
              y: number;
            }> = [];

            for (const runner of raceForPage.runners) {
              const trap = runner.trapNumber;

              if (!trap) continue;

              const oddsKey = normalizedMarkerText(
                runner.odds ?? "",
              );
              const colorKey = normalizedMarkerText(
                runner.trapColor ?? "",
              );

              const lineCandidates = visualLines
                .map((line) => ({
                  ...line,
                  key: normalizedMarkerText(line.text),
                }))
                .filter((line) => {
                  const hasTrap =
                    new RegExp(
                      `(?:^|[^0-9])${trap}(?:[^0-9]|$)`,
                    ).test(line.text);

                  if (!hasTrap) return false;

                  const hasOdds =
                    !oddsKey || line.key.includes(oddsKey);
                  const hasColor =
                    !colorKey || line.key.includes(colorKey);

                  /*
                   * Trap colors are unique on an eight-dog card, so require
                   * the color whenever it is available. Also require the
                   * morning line when the PDF text layer exposes it.
                   */
                  return hasColor && hasOdds;
                })
                .sort((a, b) => {
                  const aOdds =
                    oddsKey && a.key.includes(oddsKey) ? 1 : 0;
                  const bOdds =
                    oddsKey && b.key.includes(oddsKey) ? 1 : 0;
                  const aColor =
                    colorKey &&
                    a.key.includes(colorKey)
                      ? 1
                      : 0;
                  const bColor =
                    colorKey &&
                    b.key.includes(colorKey)
                      ? 1
                      : 0;

                  return bOdds + bColor - (aOdds + aColor);
                });

              const markerLine = lineCandidates[0];

              if (markerLine) {
                located.push({
                  runner,
                  y: markerLine.y,
                });
              }
            }

            /*
             * If native marker extraction is sparse, use the stable vertical
             * order of the markers we DID find to estimate only missing box
             * starts. We never use a bad dog name as a crop boundary.
             */
            located.sort((a, b) => a.y - b.y);

            if (located.length < 2) {
              continue;
            }

            const markerGaps = located
              .slice(1)
              .map(
                (entry, index) =>
                  entry.y - located[index].y,
              )
              .filter((gap) => gap > 30);

            const typicalBandHeight =
              markerGaps.length > 0
                ? [...markerGaps].sort((a, b) => a - b)[
                    Math.floor(markerGaps.length / 2)
                  ]
                : Math.max(120, viewport.height / 8);

            const byTrap = new Map(
              located.map((entry) => [
                entry.runner.trapNumber,
                entry,
              ]),
            );

            if (located.length >= 4) {
              const first = located[0];

              for (const runner of raceForPage.runners) {
                if (
                  !runner.trapNumber ||
                  byTrap.has(runner.trapNumber)
                ) {
                  continue;
                }

                const estimatedY =
                  first.y +
                  (runner.trapNumber -
                    (first.runner.trapNumber ?? 1)) *
                    typicalBandHeight;

                if (
                  estimatedY > 0 &&
                  estimatedY < viewport.height
                ) {
                  located.push({
                    runner,
                    y: estimatedY,
                  });
                }
              }

              located.sort((a, b) => a.y - b.y);
            }

            const pageCanvas =
              document.createElement("canvas");
            pageCanvas.width =
              Math.ceil(viewport.width);
            pageCanvas.height =
              Math.ceil(viewport.height);

            const pageContext =
              pageCanvas.getContext("2d", {
                alpha: false,
              });

            if (!pageContext) {
              continue;
            }

            pageContext.fillStyle = "#ffffff";
            pageContext.fillRect(
              0,
              0,
              pageCanvas.width,
              pageCanvas.height,
            );

            await page.render({
              canvas: pageCanvas,
              canvasContext: pageContext,
              viewport,
            }).promise;

            /*
             * Tri-State current names are embedded images at deterministic
             * coordinates. Resolve them directly from the page BEFORE any
             * runner-block crop or fallback parsing.
             */
            if (
              nameWorker &&
              normalizeTrackCode(
                raceForPage.track,
              ) === "GTS"
            ) {
              for (
                const runner of raceForPage.runners
              ) {
                if (!runner.trapNumber) {
                  continue;
                }

                const embeddedImageName =
                  await recoverTriStateNameFromProgramImage(
                    pageCanvas,
                    runner.trapNumber,
                    nameWorker,
                  );

                if (
                  embeddedImageName &&
                  !currentCardAuthoritativeTrackCode
                ) {
                  /*
                   * Legacy fallback only. When official Entries are loaded,
                   * the Program image is never allowed to change dog identity.
                   */
                  runner.name =
                    embeddedImageName;
                }
              }

              await nameWorker.setParameters({
                tessedit_pageseg_mode:
                  PSM.SPARSE_TEXT,
                preserve_interword_spaces:
                  "1",
              });
            }

            /*
             * The actual Tri-State PDF places the graphical bold dog name
             * about 11 PDF points ABOVE the odds/color marker line. The old
             * 4-point pad literally cropped the name out before OCR.
             *
             * Use 16 PDF points so the full trap/name header is preserved.
             * Crop bottoms still use the next runner marker, so each block
             * remains isolated.
             */
            const topPad = Math.max(
              24,
              Math.round(16 * PDF_RENDER_SCALE),
            );

            for (
              let index = 0;
              index < located.length;
              index += 1
            ) {
              const current = located[index];
              const next = located[index + 1];

              const cropTop = Math.max(
                0,
                Math.floor(current.y - topPad),
              );

              const cropBottom = Math.min(
                pageCanvas.height,
                Math.max(
                  cropTop + 80,
                  next
                    ? Math.floor(next.y - topPad)
                    : Math.floor(
                        current.y +
                          typicalBandHeight -
                          topPad,
                      ),
                ),
              );

              const cropHeight =
                cropBottom - cropTop;

              if (cropHeight <= 0) {
                continue;
              }

              const cropCanvas =
                document.createElement("canvas");
              cropCanvas.width =
                pageCanvas.width;
              cropCanvas.height =
                cropHeight;

              const cropContext =
                cropCanvas.getContext("2d", {
                  alpha: false,
                });

              if (!cropContext) {
                continue;
              }

              cropContext.fillStyle = "#ffffff";
              cropContext.fillRect(
                0,
                0,
                cropCanvas.width,
                cropCanvas.height,
              );

              cropContext.drawImage(
                pageCanvas,
                0,
                cropTop,
                pageCanvas.width,
                cropHeight,
                0,
                0,
                cropCanvas.width,
                cropHeight,
              );

              current.runner.programBlockImageDataUrl =
                cropCanvas.toDataURL("image/png");

              /*
               * Tri-State names are now authoritative from the previously
               * imported Entries PDF. Keep the exact Program crop for Past
               * Performances, but do not OCR/overwrite the saved dog identity.
               */

              cropCanvas.width = 1;
              cropCanvas.height = 1;
            }

            pageCanvas.width = 1;
            pageCanvas.height = 1;
          }
        } finally {
          if (nameWorker) {
            await nameWorker.terminate();
          }
        }
      }

      /*
       * FINAL IDENTITY LOCK
       *
       * Program parsing below the initial Entries merge can inspect names while
       * locating/cropping runner blocks. Rebuild the runners one final time
       * from authoritative Entries after ALL Program extraction is complete.
       *
       * This guarantees:
       *   - Race + Box determines the dog.
       *   - The exact Entries dogName is displayed/stored, including spaces.
       *   - Program OCR/native text can never leak into current dog identity.
       *   - Wheeling vacant boxes remain vacant instead of becoming fake dogs.
       */
      if (
        currentCardAuthoritativeTrackCode &&
        currentCardAuthoritativeEntries.length > 0
      ) {
        mergedRaces = applyAuthoritativeEntries(
          mergedRaces,
          currentCardAuthoritativeEntries,
          currentCardAuthoritativeTrackCode,
        );
      }

      const combinedText = normalizeWhitespace(
        [
          nativeText,
          ocrText
            ? `\n\n===== OCR EXTRACTED TEXT =====\n\n${ocrText}`
            : "",
        ].join(""),
      );

      setRawText(combinedText);

      if (mergedRaces.length === 0) {
        setParsedRaces([]);
        setSelectedRaceIndex(null);

        throw new Error(
          "PDF text extraction and OCR completed, but no races could be identified. Review the extracted text below.",
        );
      }

      if (backupOnly) {
        const invalidRace = mergedRaces.find((race) => validateBackupRace(race));

        if (invalidRace) {
          setParsedRaces([]);
          setSelectedRaceIndex(null);
          throw new Error(validateBackupRace(invalidRace) ?? "Backup race-card validation failed.");
        }
      }

      setParsedRaces(mergedRaces);
      setSelectedRaceIndex(0);
      setProgress(100);

      setSuccess(
        `Parsed ${mergedRaces.length} race${
          mergedRaces.length === 1 ? "" : "s"
        } from ${pdf.numPages} PDF page${
          pdf.numPages === 1 ? "" : "s"
        }${
          ocrText
            ? " using PDF text extraction + OCR"
            : ""
        }.`,
      );

      await loadingTask.destroy();
    },
    [
      parseAndSetText,
      backupOnly,
      expectedTrackCode,
      expectedTrackName,
      expectedRaceDate,
      expectedSession,
    ],
  );

  const processFile = useCallback(
    async (file: File) => {
      resetMessages();

      setFileName(file.name);
      setParsedRaces([]);
      setSelectedRaceIndex(null);
      setRawText("");
      setProgress(0);
      setPageCount(0);
      setUsedOcr(false);

      try {
        const lowerName = file.name.toLowerCase();
        const type = file.type.toLowerCase();

        if (
          type === "application/pdf" ||
          lowerName.endsWith(".pdf")
        ) {
          await extractPdf(file);
          return;
        }

        if (
          type.startsWith("text/") ||
          lowerName.endsWith(".txt")
        ) {
          setStage("reading");
          setProgress(30);

          const text = await file.text();

          setProgress(80);

          parseAndSetText(text);

          return;
        }

        throw new Error(
          "Unsupported file type. Upload a PDF or TXT race card.",
        );
      } catch (unknownError) {
        console.error(
          "Greyhound race card processing failed:",
          unknownError,
        );

        const message =
          unknownError instanceof Error
            ? unknownError.message
            : "The race card could not be processed.";

        setError(message);
        setProgress(0);
      } finally {
        setStage("idle");
      }
    },
    [extractPdf, parseAndSetText],
  );

  const handleFileChange = async (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    await processFile(file);

    event.target.value = "";
  };

  const handleDrop = async (
    event: DragEvent<HTMLDivElement>,
  ) => {
    event.preventDefault();

    if (busy) {
      return;
    }

    const file = event.dataTransfer.files?.[0];

    if (!file) {
      return;
    }

    await processFile(file);
  };

  const handleParsePastedText = async () => {
    resetMessages();

    if (!rawText.trim()) {
      setError("Paste race-card text first.");
      return;
    }

    try {
      setStage("parsing");
      setProgress(50);

      parseAndSetText(rawText);
    } catch (unknownError) {
      const message =
        unknownError instanceof Error
          ? unknownError.message
          : "The pasted race card could not be parsed.";

      setError(message);
      setProgress(0);
    } finally {
      setStage("idle");
    }
  };

  const handleLoadUrl = async () => {
    resetMessages();

    const trimmedUrl = url.trim();

    if (!trimmedUrl) {
      setError("Enter a race-card URL first.");
      return;
    }

    let parsedUrl: URL;

    try {
      parsedUrl = new URL(trimmedUrl);
    } catch {
      setError("Enter a valid URL.");
      return;
    }

    if (
      !["http:", "https:"].includes(
        parsedUrl.protocol,
      )
    ) {
      setError(
        "Only http:// and https:// URLs are supported.",
      );
      return;
    }

    try {
      setStage("reading");
      setProgress(15);

      const response = await fetch(trimmedUrl);

      if (!response.ok) {
        throw new Error(
          `The URL returned HTTP ${response.status}.`,
        );
      }

      const contentType =
        response.headers
          .get("content-type")
          ?.toLowerCase() ?? "";

      if (
        contentType.includes("application/pdf") ||
        parsedUrl.pathname
          .toLowerCase()
          .endsWith(".pdf")
      ) {
        const blob = await response.blob();

        const file = new File(
          [blob],
          parsedUrl.pathname
            .split("/")
            .pop() || "race-card.pdf",
          {
            type: "application/pdf",
          },
        );

        await processFile(file);
        return;
      }

      const text = await response.text();

      setProgress(75);

      const parser = new DOMParser();

      const documentObject =
        parser.parseFromString(
          text,
          "text/html",
        );

      documentObject
        .querySelectorAll(
          "script, style, noscript, svg, iframe, nav, footer",
        )
        .forEach((element) =>
          element.remove(),
        );

      const visibleText =
        documentObject.body?.innerText ||
        documentObject.body?.textContent ||
        text;

      parseAndSetText(visibleText);
    } catch (unknownError) {
      console.error(
        "Race card URL load failed:",
        unknownError,
      );

      const originalMessage =
        unknownError instanceof Error
          ? unknownError.message
          : "Unable to load that URL.";

      setError(
        `${originalMessage} If the site blocks browser requests with CORS, download the race card as a PDF and upload it here instead.`,
      );
    } finally {
      setStage("idle");
    }
  };

  const importProgramPage = async (race: ParsedGreyhoundRace) => {
    const imageDataUrl = race.programPageImageDataUrl?.trim();

    // TXT/manual imports and non-Full-Program sources do not have a page image.
    if (!imageDataUrl) {
      return { saved: false };
    }

    if (!race.raceDate) {
      throw new Error(
        `Race ${race.raceNumber} has an official Program page but no race date.`,
      );
    }

    const response = await fetch("/api/greyhound/program-pages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        leagueId,
        trackCode: normalizeTrackCode(race.track),
        programDate: race.raceDate,
        raceNumber: race.raceNumber,
        pageNumber: race.raceNumber,
        imageDataUrl,
        sourceFileName: fileName || null,
      }),
    });

    const payload = (await response.json().catch(() => ({}))) as {
      success?: boolean;
      message?: string;
    };

    if (!response.ok || payload.success !== true) {
      throw new Error(
        payload.message ??
          `Race ${race.raceNumber} official Program page failed to save with HTTP ${response.status}.`,
      );
    }

    return { saved: true };
  };

  const importProgramHistory = async (race: ParsedGreyhoundRace) => {
    const historyTrackCode = normalizeTrackCode(race.track);

    if (historyTrackCode === "GTS" || historyTrackCode === "GWD") {
      /*
       * Current-card identity for BOTH supported tracks comes from the official
       * Entries PDF Race + Box mapping.
       *
       * Tri-State must have eight dogs per race.
       * Wheeling may have fewer because official vacant / NO GREYHOUND boxes
       * are legitimate and must never become fake dog records.
       */
      if (
        historyTrackCode === "GTS" &&
        race.runners.length !== 8
      ) {
        throw new Error(
          `Tri-State Race ${race.raceNumber} is not ready to save: ` +
            `expected 8 authoritative Entries runners but found ${race.runners.length}.`,
        );
      }

      if (
        historyTrackCode === "GWD" &&
        race.runners.length === 0
      ) {
        throw new Error(
          `Wheeling Race ${race.raceNumber} is not ready to save: no authoritative Entries runners were found.`,
        );
      }

      const unresolved = race.runners.filter(
        (runner) =>
          !runner.name?.trim() ||
          /^Tri-State Box \d+$/i.test(runner.name.trim()) ||
          /^Wheeling Box \d+$/i.test(runner.name.trim()) ||
          /^NO\s+GREYHOUND$/i.test(runner.name.trim()),
      );

      if (unresolved.length > 0) {
        throw new Error(
          `${historyTrackCode === "GWD" ? "Wheeling" : "Tri-State"} Race ${race.raceNumber} is not ready to save: ` +
            `${unresolved.length} Race + Box identity ` +
            `${unresolved.length === 1 ? "is" : "are"} missing from the authoritative Entries mapping.`,
        );
      }
    }
    const runners = race.runners
      .filter(
        (runner) =>
          !/^Tri-State Box \d+$/i.test(
            runner.name.trim(),
          ) &&
          !/^Wheeling Box \d+$/i.test(
            runner.name.trim(),
          ) &&
          !/^NO\s+GREYHOUND$/i.test(
            runner.name.trim(),
          ) &&
          (
            (runner.history?.length ?? 0) > 0 ||
            Boolean(runner.rawText?.trim()) ||
            Boolean(
              runner.programBlockImageDataUrl,
            )
          ),
      )
      .map((runner) => {
        const historyByKey =
          new Map<string, GreyhoundPastPerformance>();

        for (const performance of runner.history ?? []) {
          const key = [
            performance.raceDate,
            performance.performanceCode,
            performance.trackCode,
            performance.distanceYards,
            performance.boxNumber,
          ].join("|");

          const existing = historyByKey.get(key);
          const quality = (row: GreyhoundPastPerformance) =>
            row.runningPositions.length * 5 +
            (row.finishPosition !== null ? 3 : 0) +
            (row.finishTime !== null ? 3 : 0) +
            (row.speedRating !== null ? 1 : 0) +
            (row.odds ? 1 : 0) +
            (row.grade ? 1 : 0) +
            (row.comment ? 1 : 0);

          if (!existing || quality(performance) > quality(existing)) {
            historyByKey.set(key, performance);
          }
        }

        return {
          name: runner.name,
          trainer: runner.trainer,
          kennel: null,
          programBlock: runner.rawText?.trim() || null,
          programBlockImageDataUrl:
            runner.programBlockImageDataUrl ?? null,
          history: Array.from(historyByKey.values()),
        };
      });

    if (runners.length === 0) return { imported: 0 };

    const response = await fetch("/api/greyhound/dog-history/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        leagueId,
        programTrack: race.track,
        programDate: race.raceDate,
        runners,
      }),
    });

    const payload = (await response.json().catch(() => ({}))) as {
      success?: boolean;
      imported?: number;
      message?: string;
    };

    if (!response.ok || !payload.success) {
      throw new Error(payload.message ?? `Dog history import failed with HTTP ${response.status}.`);
    }

    return { imported: Number(payload.imported ?? 0) };
  };

  const handleDeleteSavedCard = async () => {
    resetMessages();

    if (!selectedRace) {
      setError("Select a race from the card first.");
      return;
    }

    if (!selectedRace.raceDate) {
      setError(
        "This parsed card does not have a valid race date, so the saved card cannot be identified.",
      );
      return;
    }

    const session =
      inferCardSession(
        parsedRaces,
        expectedSession,
      );

    const confirmed =
      window.confirm(
        `Delete the saved ${selectedRace.track} card for ${selectedRace.raceDate} (${session})?\n\n` +
          "This is intended only for correcting/re-importing a card. " +
          "The delete will be refused automatically if wagers, race results, payouts, Survivor picks, scratches, or dog results already exist.",
      );

    if (!confirmed) {
      return;
    }

    try {
      setStage("deleting");
      setProgress(25);

      const response =
        await fetch(
          importEndpoint,
          {
            method: "DELETE",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              leagueId,
              track:
                selectedRace.track,
              raceDate:
                selectedRace.raceDate,
              session,
            }),
          },
        );

      setProgress(75);

      const payload =
        (await response
          .json()
          .catch(() => ({}))) as {
            success?: boolean;
            error?: string;
            message?: string;
            cardId?: number;
            racesDeleted?: number;
            activity?: Record<
              string,
              number
            >;
          };

      if (
        !response.ok ||
        payload.success !== true
      ) {
        let detail = "";

        if (payload.activity) {
          const activeItems =
            Object.entries(
              payload.activity,
            )
              .filter(
                ([, count]) =>
                  Number(count) > 0,
              )
              .map(
                ([key, count]) =>
                  `${key}: ${count}`,
              );

          if (
            activeItems.length > 0
          ) {
            detail =
              ` Existing activity: ${activeItems.join(", ")}.`;
          }
        }

        throw new Error(
          `${
            payload.error ??
            payload.message ??
            `Delete failed with HTTP ${response.status}.`
          }${detail}`,
        );
      }

      setProgress(100);

      setSuccess(
        `${
          payload.message ??
          "Saved card deleted."
        } ${
          payload.racesDeleted ?? 0
        } races were removed. You can now click SAVE ALL RACES to re-import this same parsed program.`,
      );
    } catch (unknownError) {
      console.error(
        "Greyhound card delete failed:",
        unknownError,
      );

      setError(
        unknownError instanceof Error
          ? unknownError.message
          : "The saved Greyhound card could not be deleted.",
      );

      setProgress(0);
    } finally {
      setStage("idle");
    }
  };


  const handleImportSelectedRace = async () => {
    resetMessages();

    if (!selectedRace) {
      setError("Select a race to import.");
      return;
    }

    if (selectedRace.runners.length === 0) {
      setError(
        "The selected race has no detected runners. Review the extracted data before importing.",
      );
      return;
    }

    const backupError = validateBackupRace(selectedRace);
    if (backupError) {
      setError(backupError);
      return;
    }

    try {
      setStage("importing");
      setProgress(20);

      const response = await fetch(
        importEndpoint,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            leagueId,
            backup: backupContext,
            race: {
              track: selectedRace.track,
              raceNumber:
                selectedRace.raceNumber,
              raceDate: selectedRace.raceDate,
              raceTime: selectedRace.raceTime,
              cardFirstPostTime:
                getCardFirstPostTime(parsedRaces),
              session:
                inferCardSession(
                  parsedRaces,
                  expectedSession,
                ),
              grade: selectedRace.grade,
              distance: selectedRace.distance,
              prizeMoney:
                selectedRace.prizeMoney,
              weather: selectedRace.weather,
              trackCondition:
                selectedRace.trackCondition,
              runners:
                selectedRace.runners.map(
                  (runner) => ({
                    trapNumber:
                      runner.trapNumber,
                    trapColor:
                      runner.trapColor,
                    name: runner.name,
                    trainer:
                      runner.trainer,
                    weight: runner.weight,
                    form: runner.form,
                    odds: runner.odds,
                    history: runner.history ?? [],
                  }),
                ),
            },
          }),
        },
      );

      setProgress(75);

      let result: ImportResult;

      try {
        result =
          (await response.json()) as ImportResult;
      } catch {
        result = {};
      }

      if (!response.ok) {
        throw new Error(
          typeof result.message === "string"
            ? result.message
            : `Import failed with HTTP ${response.status}.`,
        );
      }

      const pageResult = await importProgramPage(selectedRace);
      const historyResult = await importProgramHistory(selectedRace);

      setProgress(100);

      setSuccess(
        `${selectedRace.track} Race ${selectedRace.raceNumber} imported successfully. ${pageResult.saved ? "Official full Program page saved. " : ""}${historyResult.imported} program-history starts saved.`,
      );

      onImportSuccess?.(result);
      refreshRaceCardManagement();
    } catch (unknownError) {
      console.error(
        "Greyhound race import failed:",
        unknownError,
      );

      setError(
        unknownError instanceof Error
          ? unknownError.message
          : "The race could not be imported.",
      );

      setProgress(0);
    } finally {
      setStage("idle");
    }
  };

  const finalizeImportedCard = async (
    result: ImportResult,
    races: ParsedGreyhoundRace[],
  ) => {
    const cardId =
      typeof result.cardId === "number" ||
      typeof result.cardId === "string"
        ? result.cardId
        : null;

    const firstRace =
      [...races].sort(
        (a, b) =>
          a.raceNumber - b.raceNumber,
      )[0];

    const trackCode =
      firstRace
        ? normalizeTrackCode(
            firstRace.track,
          )
        : null;

    if (!cardId || !trackCode) {
      throw new Error(
        "All races were saved, but the card could not be finalized because its card ID or track could not be determined.",
      );
    }

    setImportProgressLabel(
      "Finalizing and publishing official race card...",
    );

    const response =
      await fetch(
        importEndpoint,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            leagueId,
            action: "finalize_card",
            cardId,
            track: trackCode,
            raceDate:
              firstRace?.raceDate ??
              null,
            session:
              inferCardSession(
                races,
                expectedSession,
              ),
          }),
        },
      );

    let payload: ImportResult & {
      confirmed?: boolean;
      error?: string;
    };

    try {
      payload =
        (await response.json()) as ImportResult & {
          confirmed?: boolean;
          error?: string;
        };
    } catch {
      payload = {};
    }

    if (
      !response.ok ||
      payload.confirmed !== true
    ) {
      throw new Error(
        typeof payload.error === "string"
          ? payload.error
          : typeof payload.message === "string"
            ? payload.message
            : `Card finalization failed with HTTP ${response.status}.`,
      );
    }

    return payload;
  };


  const handleImportAllRaces = async () => {
    resetMessages();

    if (parsedRaces.length === 0) {
      setError("There are no parsed races to import.");
      return;
    }

    const backupMismatch = parsedRaces
      .map((race) => validateBackupRace(race))
      .find((message): message is string => Boolean(message));

    if (backupMismatch) {
      setError(backupMismatch);
      return;
    }

    const racesWithoutRunners = parsedRaces.filter(
      (race) => race.runners.length === 0,
    );

    if (racesWithoutRunners.length > 0) {
      setError(
        `Cannot save all races because Race ${racesWithoutRunners
          .map((race) => race.raceNumber)
          .join(", Race ")} has no detected runners. Review the parsed card first.`,
      );
      return;
    }

    try {
      setStage("importing");
      setProgress(0);

      const results: ImportResult[] = [];
      const total = parsedRaces.length;

      for (let index = 0; index < parsedRaces.length; index += 1) {
        const race = parsedRaces[index];
        const current = index + 1;

        setImportProgressLabel(
          `Saving Race ${race.raceNumber} (${current} of ${total})...`,
        );
        setProgress(Math.round((index / total) * 100));

        const response = await fetch(
          importEndpoint,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              leagueId,
              backup: backupContext,
              race: {
                track: race.track,
                raceNumber: race.raceNumber,
                raceDate: race.raceDate,
                raceTime: race.raceTime,
                cardFirstPostTime:
                  getCardFirstPostTime(parsedRaces),
                session:
                  inferCardSession(
                    parsedRaces,
                    expectedSession,
                  ),
                grade: race.grade,
                distance: race.distance,
                prizeMoney: race.prizeMoney,
                weather: race.weather,
                trackCondition: race.trackCondition,
                runners: race.runners.map((runner) => ({
                  trapNumber: runner.trapNumber,
                  trapColor: runner.trapColor,
                  name: runner.name,
                  trainer: runner.trainer,
                  weight: runner.weight,
                  form: runner.form,
                  odds: runner.odds,
                  history: runner.history ?? [],
                })),
              },
            }),
          },
        );

        let result: ImportResult;

        try {
          result = (await response.json()) as ImportResult;
        } catch {
          result = {};
        }

        if (!response.ok) {
          throw new Error(
            `Race ${race.raceNumber} failed: ${
              typeof result.message === "string"
                ? result.message
                : `HTTP ${response.status}`
            }`,
          );
        }

        await importProgramPage(race);
        await importProgramHistory(race);
        results.push(result);
        setProgress(Math.round((current / total) * 100));
      }

      const lastResult = results[results.length - 1];

      if (!lastResult) {
        throw new Error(
          "The races were saved, but no final import result was available to finalize the card.",
        );
      }

      setProgress(98);

      const finalization =
        await finalizeImportedCard(
          lastResult,
          parsedRaces,
        );

      setProgress(100);
      setImportProgressLabel(
        `${total} of ${total} races saved and card published.`,
      );
      setSuccess(
        `${total} of ${total} races imported successfully. Official ${normalizeTrackCode(parsedRaces[0]?.track ?? "") === "GTS" ? "Tri-State" : "Wheeling"} card confirmed and published.`,
      );

      onImportSuccess?.({
        ...lastResult,
        ...finalization,
      });

      refreshRaceCardManagement();
    } catch (unknownError) {
      console.error(
        "Greyhound all-races import failed:",
        unknownError,
      );

      setError(
        unknownError instanceof Error
          ? unknownError.message
          : "The race card could not be fully imported.",
      );
    } finally {
      setStage("idle");
      setImportProgressLabel("");
    }
  };

  const clearImporter = () => {
    setUrl("");
    setRawText("");
    setParsedRaces([]);
    setSelectedRaceIndex(null);
    setStage("idle");
    setProgress(0);
    setError("");
    setSuccess("");
    setFileName("");
    setUsedOcr(false);
    setPageCount(0);
  };

  return (
    <div className="gh-importer">
      <style>{`
        .gh-importer,.gh-importer *{box-sizing:border-box}
        .gh-importer{width:100%;color:#f5f5f5}
        .gh-importer button,.gh-importer input,.gh-importer textarea{font:inherit}
        .gh-shell{overflow:hidden;border:1px solid #292a2d;border-radius:16px;background:linear-gradient(145deg,rgba(56,16,11,.16),#101113 42%,#0c0d0f);box-shadow:0 18px 45px rgba(0,0,0,.25)}
        .gh-head{display:flex;align-items:center;justify-content:space-between;gap:20px;padding:18px 20px;border-bottom:1px solid #292a2d;background:linear-gradient(100deg,rgba(117,20,14,.36),rgba(219,76,19,.10) 48%,rgba(14,15,17,.95))}
        .gh-kicker{color:#f06a27;font-size:9px;font-weight:950;letter-spacing:.14em;text-transform:uppercase}
        .gh-title{margin:5px 0 0;color:#fff;font-size:24px;line-height:1.15;font-weight:950;letter-spacing:-.025em}
        .gh-sub{max-width:720px;margin:6px 0 0;color:#92969d;font-size:11px;line-height:1.6;font-weight:600}
        .gh-meta{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:6px}
        .gh-pill{padding:7px 10px;border:1px solid #3b3d41;border-radius:999px;background:rgba(0,0,0,.32);color:#c4c6ca;font-size:9px;font-weight:800;white-space:nowrap}
        .gh-pill.orange{border-color:rgba(226,91,24,.45);background:rgba(108,38,11,.35);color:#ff9b64}
        .gh-body{padding:16px}
        .gh-methods{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(300px,.75fr);gap:12px}
        .gh-panel{min-width:0;border:1px solid #292a2e;border-radius:14px;background:#111214;overflow:hidden}
        .gh-panel-head{padding:14px 15px 0}
        .gh-panel-label{color:#e96629;font-size:8px;font-weight:950;letter-spacing:.12em;text-transform:uppercase}
        .gh-panel-title{margin:5px 0 0;color:#fff;font-size:16px;font-weight:950}
        .gh-panel-copy{margin:5px 0 0;color:#7f848b;font-size:10px;line-height:1.55}
        .gh-drop{display:flex;min-height:220px;margin:14px;padding:22px;align-items:center;justify-content:center;border:1px dashed #5a3c2c;border-radius:13px;background:radial-gradient(circle at center,rgba(153,43,16,.16),rgba(8,9,10,.42) 70%);text-align:center;transition:.16s}
        .gh-drop:hover{border-color:#ed6a28;background:radial-gradient(circle at center,rgba(178,50,15,.22),rgba(8,9,10,.50) 70%)}
        .gh-drop-inner{width:min(480px,100%)}
        .gh-file-icon{display:flex;width:52px;height:52px;margin:0 auto 12px;align-items:center;justify-content:center;border:1px solid #62311e;border-radius:14px;background:linear-gradient(135deg,#48150f,#1b1110);color:#ff7a35;font-size:13px;font-weight:950}
        .gh-drop-title{margin:0;color:#fff;font-size:18px;font-weight:950}
        .gh-drop-copy{max-width:430px;margin:7px auto 0;color:#858a91;font-size:10px;line-height:1.6}
        .gh-btn{display:inline-flex;min-height:43px;align-items:center;justify-content:center;padding:10px 16px;border-radius:9px;cursor:pointer;font-size:10px;font-weight:950;letter-spacing:.025em;transition:.15s}
        .gh-btn.primary{border:1px solid #e15b20;background:linear-gradient(135deg,#a32617,#ef681c);color:#fff;box-shadow:0 8px 22px rgba(112,24,11,.25)}
        .gh-btn.danger{background:#270808;color:#fecaca;border-color:#7f1d1d}
        .gh-btn.danger:hover:not(:disabled){background:#450a0a;border-color:#ef4444;color:#fff}
        .gh-btn.secondary{border:1px solid #93401f;background:#21130f;color:#ffad7c}
        .gh-btn.dark{border:1px solid #37393d;background:#191a1d;color:#c4c7cc}
        .gh-btn:hover{filter:brightness(1.12);transform:translateY(-1px)}
        .gh-btn:disabled{cursor:not-allowed;opacity:.4;filter:none;transform:none}
        .gh-choose{margin-top:15px;min-width:165px}
        .gh-alt{display:flex;flex-direction:column;gap:12px;padding:14px}
        .gh-label{display:block;margin-bottom:7px;color:#c5c7ca;font-size:9px;font-weight:900}
        .gh-url{display:flex;gap:7px}
        .gh-input,.gh-textarea{width:100%;border:1px solid #34363a;outline:none;background:#0b0c0e;color:#f4f4f4}
        .gh-input{min-width:0;height:43px;padding:0 12px;border-radius:9px;font-size:11px}
        .gh-textarea{min-height:160px;padding:12px;resize:vertical;border-radius:10px;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:9px;line-height:1.55}
        .gh-input:focus,.gh-textarea:focus{border-color:#d85d24}
        .gh-input::placeholder,.gh-textarea::placeholder{color:#51555b}
        .gh-text-head{display:flex;align-items:center;justify-content:space-between;gap:10px}
        .gh-count{color:#656a71;font-size:8px}
        .gh-actions{display:flex;flex-wrap:wrap;gap:7px;margin-top:8px}
        .gh-status{display:grid;gap:8px;margin-top:12px}
        .gh-progress,.gh-error,.gh-success{padding:12px 14px;border-radius:11px;font-size:10px;line-height:1.5;font-weight:700}
        .gh-progress{border:1px solid rgba(217,90,28,.38);background:rgba(84,29,11,.26);color:#ffc09b}
        .gh-error{border:1px solid rgba(188,38,30,.5);background:rgba(90,12,12,.32);color:#ffb6b2}
        .gh-success{border:1px solid rgba(36,145,87,.44);background:rgba(13,78,44,.27);color:#9ee7bd}
        .gh-progress-head{display:flex;justify-content:space-between;gap:10px;margin-bottom:8px}
        .gh-progress-track{height:7px;overflow:hidden;border-radius:999px;background:#27282b}
        .gh-progress-bar{height:100%;border-radius:inherit;background:linear-gradient(90deg,#ad2718,#f47525);transition:width .3s ease}
        .gh-results{display:grid;grid-template-columns:265px minmax(0,1fr);gap:12px;margin-top:14px}
        .gh-list,.gh-detail{overflow:hidden;border:1px solid #292a2e;border-radius:14px;background:#101113}
        .gh-list-head{padding:14px;border-bottom:1px solid #292a2e;background:linear-gradient(90deg,rgba(94,20,13,.28),rgba(18,19,21,.96))}
        .gh-list-title{margin:0;color:#fff;font-size:14px;font-weight:950}
        .gh-list-copy{margin-top:4px;color:#686d74;font-size:9px}
        .gh-list-scroll{max-height:680px;overflow-y:auto;padding:7px;scrollbar-width:thin;scrollbar-color:#b7481b #161719}
        .gh-race{width:100%;margin-bottom:6px;padding:11px;border:1px solid #292b2f;border-radius:10px;background:#151619;color:#fff;cursor:pointer;text-align:left;transition:.15s}
        .gh-race:hover{border-color:#70402b;background:#191719}
        .gh-race.selected{border-color:#d95d24;background:linear-gradient(135deg,rgba(108,29,13,.42),rgba(29,20,17,.92));box-shadow:inset 3px 0 0 #ed6a25}
        .gh-race-top{display:flex;align-items:center;justify-content:space-between;gap:8px}
        .gh-race-num{font-size:12px;font-weight:950}
        .gh-race-time{color:#ff9c62;font-size:9px;font-weight:900}
        .gh-race-track{margin-top:3px;overflow:hidden;color:#a3a6ab;font-size:9px;font-weight:700;text-overflow:ellipsis;white-space:nowrap}
        .gh-tags{display:flex;flex-wrap:wrap;gap:4px;margin-top:7px}
        .gh-tag{padding:4px 6px;border:1px solid #313338;border-radius:5px;background:#202125;color:#9a9ea4;font-size:8px;font-weight:750}
        .gh-detail-head{padding:16px;border-bottom:1px solid #292a2e;background:linear-gradient(115deg,rgba(107,20,13,.36),rgba(190,65,16,.10) 45%,#111214)}
        .gh-detail-main{display:flex;align-items:flex-start;justify-content:space-between;gap:18px}
        .gh-detail-track{color:#f17631;font-size:9px;font-weight:950;letter-spacing:.1em;text-transform:uppercase}
        .gh-detail-title{margin:4px 0 0;color:#fff;font-size:28px;line-height:1;font-weight:950;letter-spacing:-.035em}
        .gh-detail-tags{display:flex;flex-wrap:wrap;gap:5px;margin-top:10px}
        .gh-detail-tag{padding:5px 7px;border:1px solid #3a3b3e;border-radius:6px;background:rgba(0,0,0,.28);color:#c1c4c8;font-size:8px;font-weight:750}
        .gh-save{display:flex;flex-direction:column;gap:7px;flex:0 0 auto}
        .gh-save button{min-width:190px}
        .gh-weather{display:flex;flex-wrap:wrap;gap:16px;margin-top:12px;padding-top:11px;border-top:1px solid #2a2b2e;color:#888d94;font-size:9px}
        .gh-weather strong{color:#ddd}
        .gh-runners{padding:14px}
        .gh-runners-title{margin:0 0 9px;color:#777c83;font-size:8px;font-weight:950;letter-spacing:.12em;text-transform:uppercase}
        .gh-runner-list{display:grid;gap:6px}
        .gh-runner{display:grid;grid-template-columns:48px minmax(0,1fr) auto;align-items:center;gap:10px;min-width:0;padding:10px;border:1px solid #292b2e;border-radius:10px;background:linear-gradient(90deg,#151619,#111214)}
        .gh-trap{display:flex;width:42px;height:42px;align-items:center;justify-content:center;border:1px solid #414348;border-radius:9px;background:#08090a;color:#fff;font-size:16px;font-weight:950}
        .gh-runner-info{min-width:0}
        .gh-runner-name{overflow:hidden;color:#fff;font-size:12px;line-height:1.25;font-weight:950;text-overflow:ellipsis;white-space:nowrap}
        .gh-runner-meta{display:flex;flex-wrap:wrap;gap:3px 12px;margin-top:4px;color:#777c83;font-size:8px;line-height:1.5}
        .gh-runner-meta strong{color:#c7c9cd}
        .gh-odds{min-width:52px;padding:7px 8px;border:1px solid #754021;border-radius:8px;background:rgba(83,34,13,.35);color:#ff9b5f;font-size:11px;font-weight:950;text-align:center}
        .gh-no-runners{padding:16px;border:1px solid #735b1c;border-radius:10px;background:rgba(93,70,8,.20);color:#efd88b;font-size:10px;line-height:1.55}
        @media(max-width:900px){
          .gh-methods,.gh-results{grid-template-columns:1fr}
          .gh-list-scroll{display:flex;max-height:none;gap:7px;overflow-x:auto;overflow-y:hidden}
          .gh-race{flex:0 0 190px;margin-bottom:0}
        }
        @media(max-width:650px){
          .gh-head{align-items:flex-start;flex-direction:column;padding:15px}
          .gh-meta{justify-content:flex-start}
          .gh-title{font-size:20px}
          .gh-body{padding:9px}
          .gh-drop{min-height:200px;margin:9px;padding:18px 12px}
          .gh-alt{padding:10px}
          .gh-url{flex-direction:column}
          .gh-url button,.gh-actions button,.gh-choose{width:100%}
          .gh-textarea{min-height:135px}
          .gh-results{gap:9px;margin-top:9px}
          .gh-detail-main{flex-direction:column}
          .gh-save{width:100%}
          .gh-save button{width:100%;min-width:0}
          .gh-detail-title{font-size:24px}
          .gh-runners{padding:9px}
          .gh-runner{grid-template-columns:42px minmax(0,1fr) auto;gap:8px;padding:9px}
          .gh-trap{width:38px;height:38px;font-size:14px}
          .gh-runner-name{font-size:11px;white-space:normal;overflow-wrap:anywhere}
          .gh-runner-meta{display:grid;gap:2px}
          .gh-odds{min-width:46px;padding:6px;font-size:10px}
        }
        @media(max-width:420px){
          .gh-runner{grid-template-columns:38px minmax(0,1fr)}
          .gh-runner>.gh-odds{grid-column:2;justify-self:start}
          .gh-drop{min-height:170px;padding:14px 10px}
          .gh-detail-head{padding:13px}
          .gh-body{padding:7px}
        }
      `}</style>

      <section className="gh-shell">
        <header className="gh-head">
          <div>
            <div className="gh-kicker">
              {backupOnly ? "Official Feed Backup" : "G365 Race Program Processing"}
            </div>
            <h2 className="gh-title">
              {backupOnly ? "Manual Race Card Backup" : "Greyhound Race Card Importer"}
            </h2>
            <p className="gh-sub">
              {backupOnly
                ? `This backup is locked to ${expectedTrackName ?? expectedTrackCode ?? "this track"} · ${expectedRaceDate ?? "this race date"} · ${expectedSession ?? "this session"}. A different track or date will be rejected before anything is saved.`
                : "Upload an official PDF or TXT race program. Gridiron365 reads text-based PDFs directly and automatically uses OCR when scanned pages require it."}
            </p>
          </div>

          {(fileName || pageCount > 0 || usedOcr) && (
            <div className="gh-meta">
              {fileName && <span className="gh-pill">{fileName}</span>}
              {pageCount > 0 && (
                <span className="gh-pill">
                  {pageCount} page{pageCount === 1 ? "" : "s"}
                </span>
              )}
              {usedOcr && <span className="gh-pill orange">OCR USED</span>}
            </div>
          )}
        </header>

        <div className="gh-body">
          <div className="gh-methods">
            <section className="gh-panel">
              <div className="gh-panel-head">
                <div className="gh-panel-label">Recommended</div>
                <h3 className="gh-panel-title">Upload Race Program</h3>
                <p className="gh-panel-copy">
                  PDF is the preferred import method for official Wheeling and
                  supported Greyhound race programs.
                </p>
              </div>

              <div
                className="gh-drop"
                onDragOver={(event) => event.preventDefault()}
                onDrop={handleDrop}
              >
                <input
                  ref={inputRef}
                  type="file"
                  accept=".pdf,.txt,application/pdf,text/plain"
                  style={{ display: "none" }}
                  onChange={handleFileChange}
                  disabled={busy}
                />

                <div className="gh-drop-inner">
                  <div className="gh-file-icon">PDF</div>
                  <h3 className="gh-drop-title">Drop Race Card Here</h3>
                  <p className="gh-drop-copy">
                    Drag and drop the official race-card PDF, or select it from
                    your computer. Scanned pages automatically fall back to OCR.
                  </p>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => inputRef.current?.click()}
                    className="gh-btn primary gh-choose"
                  >
                    CHOOSE RACE CARD
                  </button>
                </div>
              </div>
            </section>

            <section className="gh-panel">
              <div className="gh-panel-head">
                <div className="gh-panel-label">Alternate Import</div>
                <h3 className="gh-panel-title">URL or Race-Card Text</h3>
                <p className="gh-panel-copy">
                  Load a direct race-card URL or paste extracted program text manually.
                </p>
              </div>

              <div className="gh-alt">
                <div>
                  <label className="gh-label">RACE CARD URL</label>
                  <div className="gh-url">
                    <input
                      value={url}
                      onChange={(event) => setUrl(event.target.value)}
                      disabled={busy}
                      placeholder="https://..."
                      className="gh-input"
                    />
                    <button
                      type="button"
                      onClick={handleLoadUrl}
                      disabled={busy || !url.trim()}
                      className="gh-btn secondary"
                    >
                      LOAD URL
                    </button>
                  </div>
                </div>

                <div>
                  <div className="gh-text-head">
                    <label className="gh-label">RACE CARD TEXT</label>
                    {rawText && (
                      <span className="gh-count">
                        {rawText.length.toLocaleString()} characters
                      </span>
                    )}
                  </div>

                  <textarea
                    value={rawText}
                    onChange={(event) => setRawText(event.target.value)}
                    disabled={busy}
                    placeholder="Paste race-card text here..."
                    className="gh-textarea"
                  />

                  <div className="gh-actions">
                    <button
                      type="button"
                      disabled={busy || !rawText.trim()}
                      onClick={handleParsePastedText}
                      className="gh-btn primary"
                    >
                      PARSE RACE CARD
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={clearImporter}
                      className="gh-btn dark"
                    >
                      CLEAR
                    </button>
                  </div>
                </div>
              </div>
            </section>
          </div>

          {(busy || error || success) && (
            <div className="gh-status">
              {busy && (
                <div className="gh-progress">
                  <div className="gh-progress-head">
                    <span>
                      {stage === "importing" && importProgressLabel
                        ? importProgressLabel
                        : formatStage(stage)}
                    </span>
                    <strong>{Math.round(progress)}%</strong>
                  </div>
                  <div className="gh-progress-track">
                    <div
                      className="gh-progress-bar"
                      style={{
                        width: `${Math.max(2, Math.min(100, progress))}%`,
                      }}
                    />
                  </div>
                </div>
              )}
              {error && <div className="gh-error">{error}</div>}
              {success && <div className="gh-success">{success}</div>}
            </div>
          )}
        </div>
      </section>

      {parsedRaces.length > 0 && (
        <div className="gh-results">
          <aside className="gh-list">
            <div className="gh-list-head">
              <div className="gh-panel-label">Parsed Program</div>
              <h3 className="gh-list-title">Detected Races</h3>
              <div className="gh-list-copy">
                {parsedRaces.length} race{parsedRaces.length === 1 ? "" : "s"} found
              </div>
            </div>

            <div className="gh-list-scroll">
              {parsedRaces.map((race, index) => {
                const selected = selectedRaceIndex === index;
                return (
                  <button
                    key={`${race.track}-${race.raceNumber}-${index}`}
                    type="button"
                    onClick={() => setSelectedRaceIndex(index)}
                    className={`gh-race ${selected ? "selected" : ""}`}
                  >
                    <div className="gh-race-top">
                      <span className="gh-race-num">Race {race.raceNumber}</span>
                      {race.raceTime && (
                        <span className="gh-race-time">{race.raceTime}</span>
                      )}
                    </div>
                    <div className="gh-race-track">{race.track}</div>
                    <div className="gh-tags">
                      {race.distance && <span className="gh-tag">{race.distance}</span>}
                      {race.grade && <span className="gh-tag">Grade {race.grade}</span>}
                      <span className="gh-tag">{race.runners.length} runners</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>

          {selectedRace && (
            <section className="gh-detail">
              <header className="gh-detail-head">
                <div className="gh-detail-main">
                  <div>
                    <div className="gh-detail-track">{selectedRace.track}</div>
                    <h2 className="gh-detail-title">
                      Race {selectedRace.raceNumber}
                    </h2>
                    <div className="gh-detail-tags">
                      {selectedRace.raceDate && (
                        <span className="gh-detail-tag">{selectedRace.raceDate}</span>
                      )}
                      {selectedRace.raceTime && (
                        <span className="gh-detail-tag">{selectedRace.raceTime}</span>
                      )}
                      {selectedRace.distance && (
                        <span className="gh-detail-tag">{selectedRace.distance}</span>
                      )}
                      {selectedRace.grade && (
                        <span className="gh-detail-tag">Grade {selectedRace.grade}</span>
                      )}
                      {selectedRace.prizeMoney && (
                        <span className="gh-detail-tag">{selectedRace.prizeMoney}</span>
                      )}
                    </div>
                  </div>

                  <div className="gh-save">
                    <button
                      type="button"
                      onClick={handleDeleteSavedCard}
                      disabled={
                        busy ||
                        !selectedRace.raceDate
                      }
                      className="gh-btn danger"
                      title="Delete the already-saved card so this parsed program can be imported again."
                    >
                      {stage === "deleting"
                        ? "DELETING CARD..."
                        : "DELETE SAVED CARD"}
                    </button>
                    <button
                      type="button"
                      onClick={handleImportSelectedRace}
                      disabled={busy || selectedRace.runners.length === 0}
                      className="gh-btn secondary"
                    >
                      {stage === "importing" ? "SAVING..." : "SAVE SELECTED RACE"}
                    </button>
                    <button
                      type="button"
                      onClick={handleImportAllRaces}
                      disabled={
                        busy ||
                        parsedRaces.length === 0 ||
                        parsedRaces.some((race) => race.runners.length === 0)
                      }
                      className="gh-btn primary"
                    >
                      {stage === "importing"
                        ? "SAVING ALL RACES..."
                        : `SAVE ALL ${parsedRaces.length} RACES`}
                    </button>
                  </div>
                </div>

                {(selectedRace.weather || selectedRace.trackCondition) && (
                  <div className="gh-weather">
                    {selectedRace.weather && (
                      <span>
                        Weather: <strong>{selectedRace.weather}</strong>
                      </span>
                    )}
                    {selectedRace.trackCondition && (
                      <span>
                        Track: <strong>{selectedRace.trackCondition}</strong>
                      </span>
                    )}
                  </div>
                )}
              </header>

              <div className="gh-runners">
                <h3 className="gh-runners-title">
                  Race Field · {selectedRace.runners.length} Runners
                </h3>

                {selectedRace.runners.length === 0 ? (
                  <div className="gh-no-runners">
                    No runners were detected for this race. Check the extracted
                    race-card text before saving.
                  </div>
                ) : (
                  <div className="gh-runner-list">
                    {selectedRace.runners.map((runner) => (
                      <div
                        key={`${selectedRace.raceNumber}-${runner.trapNumber}-${runner.name}`}
                        className="gh-runner"
                      >
                        <div className="gh-trap">{runner.trapNumber ?? "—"}</div>
                        <div className="gh-runner-info">
                          <div className="gh-runner-name">{runner.name}</div>
                          <div className="gh-runner-meta">
                            {runner.trapColor && (
                              <span>
                                Trap: <strong>{runner.trapColor}</strong>
                              </span>
                            )}
                            {runner.trainer && (
                              <span>
                                Trainer: <strong>{runner.trainer}</strong>
                              </span>
                            )}
                            {runner.weight && (
                              <span>
                                Weight: <strong>{runner.weight}</strong>
                              </span>
                            )}
                            {runner.form && (
                              <span>
                                Form: <strong>{runner.form}</strong>
                              </span>
                            )}
                          </div>
                        </div>
                        {runner.odds && <div className="gh-odds">{runner.odds}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}






