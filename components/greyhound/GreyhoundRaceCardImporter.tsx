"use client";

import {
  ChangeEvent,
  DragEvent,
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";

type GreyhoundRunner = {
  trapNumber: number | null;
  trapColor: string | null;
  name: string;
  trainer: string | null;
  weight: string | null;
  form: string | null;
  odds: string | null;
  rawText?: string;
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
};

type ImportResult = {
  success?: boolean;
  race?: unknown;
  raceId?: string | number;
  races?: unknown[];
  message?: string;
  [key: string]: unknown;
};

type GreyhoundRaceCardImporterProps = {
  leagueId: string;
  onImportSuccess?: (result: ImportResult) => void;
};

type ProcessingStage =
  | "idle"
  | "reading"
  | "pdf"
  | "extracting"
  | "ocr"
  | "parsing"
  | "importing";

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

function normalizeProgramGreyhoundName(value: string): string {
  return cleanLine(value)
    .replace(/^[^A-Z0-9'’]+/i, "")
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
    const sectionEnd = Math.min(nextLineIndex, lineIndex + 10);
    const sectionText = lines.slice(sectionStart, sectionEnd).join(" ");

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
      rawText: sectionText,
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

function parseWheelingProgramRunners(
  ocrBlock: string,
  nativeBlock = "",
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

  const explicitPostTime = metadataText.match(
    /\bPost\s*Time\s*:\s*(\d{1,2}):(\d{2})\s*(AM|PM)\b/i,
  );

  return {
    track: "Wheeling",
    raceNumber,
    raceDate: parseDate(metadataText),
    raceTime: explicitPostTime
      ? normalizeClockTime(
          explicitPostTime[1],
          explicitPostTime[2],
          explicitPostTime[3],
        )
      : null,
    grade: headerMatch?.[2]?.toUpperCase() ?? parseGrade(metadataText),
    distance: headerMatch?.[1]
      ? `${headerMatch[1]} Yards`
      : parseDistance(metadataText),
    prizeMoney: parsePrizeMoney(metadataText),
    weather: parseWeather(metadataText),
    trackCondition: parseTrackCondition(metadataText),
    runners: parseWheelingProgramRunners(ocr, native),
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
    /\bWHEELING\s+(?:FIRST|SECOND|THIRD|FOURTH|FIFTH|SIXTH|SEVENTH|EIGHTH|NINTH|TENTH|ELEVENTH|TWELFTH|THIRTEENTH|FOURTEENTH|FIFTEENTH|SIXTEENTH|SEVENTEENTH)\s+RACE(?:\s+WHEELING)?\b/gi;

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
    /\bWHEELING\s+(FIRST|SECOND|THIRD|FOURTH|FIFTH|SIXTH|SEVENTH|EIGHTH|NINTH|TENTH|ELEVENTH|TWELFTH|THIRTEENTH|FOURTEENTH|FIFTEENTH|SIXTEENTH|SEVENTEENTH)\s+RACE\b/i,
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
    : "";
  const globalDate = parseDate(normalized);
  const wheelingFirstPost = /\bWHEELING\b/i.test(normalized)
    ? parseRaceTime(normalized)
    : null;

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
      raceTime:
        /\bWHEELING\b/i.test(normalized)
          ? raceNumber === 1
            ? wheelingFirstPost
            : null
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
    default:
      return "";
  }
}

export default function GreyhoundRaceCardImporter({
  leagueId,
  onImportSuccess,
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

  const parseAndSetText = useCallback((text: string) => {
    setStage("parsing");
    setProgress(95);

    const cleaned = normalizeWhitespace(text);
    const races = parseRaceCardText(cleaned);

    setRawText(cleaned);
    setParsedRaces(races);
    setSelectedRaceIndex(races.length > 0 ? 0 : null);

    if (races.length === 0) {
      throw new Error(
        "No races could be detected in the race card. Check the extracted text below or try OCR.",
      );
    }

    setProgress(100);

    setSuccess(
      `Parsed ${races.length} race${
        races.length === 1 ? "" : "s"
      } successfully.`,
    );
  }, []);

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
      const isWheelingEntriesCard =
        isWheelingCard && !isWheelingProgram;

      const needsOcr =
        isWheelingCard ||
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

      const { createWorker } = await import("tesseract.js");

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

      const ocrPageTexts: string[] = [];
      const ocrPageTextByPage = new Map<number, string>();

      try {
        const pagesToOcr =
          isWheelingCard ||
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

      const mergedRaces = isWheelingProgram
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
        : mergeParsedRaces(
            nativeRaces,
            parseRaceCardText(ocrText),
          );

      const combinedText = normalizeWhitespace(
        [
          nativeText,
          ocrText
            ? `\n\n===== OCR EXTRACTED TEXT =====\n\n${ocrText}`
            : "",
        ].join(""),
      );

      setRawText(combinedText);
      setParsedRaces(mergedRaces);
      setSelectedRaceIndex(
        mergedRaces.length > 0 ? 0 : null,
      );

      if (mergedRaces.length === 0) {
        throw new Error(
          "PDF text extraction and OCR completed, but no races could be identified. Review the extracted text below.",
        );
      }

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
    [parseAndSetText],
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

    try {
      setStage("importing");
      setProgress(20);

      const response = await fetch(
        "/api/greyhound/races/import",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            leagueId,
            race: {
              track: selectedRace.track,
              raceNumber:
                selectedRace.raceNumber,
              raceDate: selectedRace.raceDate,
              raceTime: selectedRace.raceTime,
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

      setProgress(100);

      setSuccess(
        `${selectedRace.track} Race ${selectedRace.raceNumber} imported successfully.`,
      );

      onImportSuccess?.(result);
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

  const handleImportAllRaces = async () => {
    resetMessages();

    if (parsedRaces.length === 0) {
      setError("There are no parsed races to import.");
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
          "/api/greyhound/races/import",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              leagueId,
              race: {
                track: race.track,
                raceNumber: race.raceNumber,
                raceDate: race.raceDate,
                raceTime: race.raceTime,
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

        results.push(result);
        setProgress(Math.round((current / total) * 100));
      }

      setProgress(100);
      setImportProgressLabel(
        `${total} of ${total} races saved successfully.`,
      );
      setSuccess(
        `${total} of ${total} races imported successfully.`,
      );

      const lastResult = results[results.length - 1];
      if (lastResult) {
        onImportSuccess?.(lastResult);
      }
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
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl">
        <div className="border-b border-zinc-800 bg-gradient-to-r from-red-950 via-zinc-950 to-orange-950 px-5 py-5 sm:px-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-black tracking-tight text-white">
                Greyhound Race Card Importer
              </h1>

              <p className="mt-1 text-sm text-zinc-400">
                Upload a PDF or TXT card,
                paste race-card text, or load a
                direct URL.
              </p>
            </div>

            {(fileName ||
              pageCount > 0) && (
              <div className="flex flex-wrap gap-2 text-xs">
                {fileName && (
                  <span className="rounded-full border border-zinc-700 bg-black/40 px-3 py-1 text-zinc-300">
                    {fileName}
                  </span>
                )}

                {pageCount > 0 && (
                  <span className="rounded-full border border-zinc-700 bg-black/40 px-3 py-1 text-zinc-300">
                    {pageCount} page
                    {pageCount === 1
                      ? ""
                      : "s"}
                  </span>
                )}

                {usedOcr && (
                  <span className="rounded-full border border-orange-800 bg-orange-950/60 px-3 py-1 font-semibold text-orange-300">
                    OCR used
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6 p-5 sm:p-6">
          <div
            onDragOver={(event) =>
              event.preventDefault()
            }
            onDrop={handleDrop}
            className="rounded-2xl border-2 border-dashed border-zinc-700 bg-zinc-900/60 p-8 text-center transition hover:border-orange-700 hover:bg-zinc-900"
          >
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,.txt,application/pdf,text/plain"
              className="hidden"
              onChange={handleFileChange}
              disabled={busy}
            />

            <div className="text-4xl">
              📄
            </div>

            <h2 className="mt-3 text-lg font-bold text-white">
              Upload Greyhound Race Card
            </h2>

            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-zinc-400">
              Drag and drop a PDF here.
              Text-based PDFs are read
              directly. Scanned pages
              automatically fall back to OCR.
            </p>

            <button
              type="button"
              disabled={busy}
              onClick={() =>
                inputRef.current?.click()
              }
              className="mt-5 rounded-xl bg-gradient-to-r from-red-600 to-orange-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg transition hover:from-red-500 hover:to-orange-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Choose File
            </button>
          </div>

          <div className="flex items-center gap-4">
            <div className="h-px flex-1 bg-zinc-800" />

            <span className="text-xs font-bold uppercase tracking-widest text-zinc-600">
              or
            </span>

            <div className="h-px flex-1 bg-zinc-800" />
          </div>

          <div>
            <label className="mb-2 block text-sm font-bold text-zinc-300">
              Race Card URL
            </label>

            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                value={url}
                onChange={(event) =>
                  setUrl(event.target.value)
                }
                disabled={busy}
                placeholder="https://..."
                className="min-w-0 flex-1 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-orange-600"
              />

              <button
                type="button"
                onClick={handleLoadUrl}
                disabled={
                  busy || !url.trim()
                }
                className="rounded-xl border border-orange-700 bg-orange-950/50 px-5 py-3 text-sm font-bold text-orange-200 transition hover:bg-orange-900/60 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Load URL
              </button>
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between gap-4">
              <label className="text-sm font-bold text-zinc-300">
                Race Card Text
              </label>

              {rawText && (
                <span className="text-xs text-zinc-500">
                  {rawText.length.toLocaleString()}{" "}
                  characters
                </span>
              )}
            </div>

            <textarea
              value={rawText}
              onChange={(event) =>
                setRawText(
                  event.target.value,
                )
              }
              disabled={busy}
              placeholder="Paste race-card text here, or upload a PDF above..."
              className="min-h-[220px] w-full resize-y rounded-xl border border-zinc-700 bg-zinc-900 p-4 font-mono text-xs leading-5 text-zinc-200 outline-none transition placeholder:text-zinc-600 focus:border-orange-600"
            />

            <div className="mt-3 flex flex-wrap gap-3">
              <button
                type="button"
                disabled={
                  busy ||
                  !rawText.trim()
                }
                onClick={
                  handleParsePastedText
                }
                className="rounded-xl bg-gradient-to-r from-red-600 to-orange-500 px-5 py-2.5 text-sm font-bold text-white transition hover:from-red-500 hover:to-orange-400 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Parse Race Card
              </button>

              <button
                type="button"
                disabled={busy}
                onClick={clearImporter}
                className="rounded-xl border border-zinc-700 bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-zinc-300 transition hover:border-zinc-600 hover:bg-zinc-800 disabled:opacity-40"
              >
                Clear
              </button>
            </div>
          </div>

          {busy && (
            <div className="rounded-xl border border-orange-900/60 bg-orange-950/20 p-4">
              <div className="mb-2 flex items-center justify-between gap-4">
                <span className="text-sm font-bold text-orange-200">
                  {stage === "importing" && importProgressLabel
                    ? importProgressLabel
                    : formatStage(stage)}
                </span>

                <span className="text-xs font-bold text-orange-300">
                  {Math.round(progress)}%
                </span>
              </div>

              <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-red-600 to-orange-400 transition-all duration-300"
                  style={{
                    width: `${Math.max(
                      2,
                      Math.min(
                        100,
                        progress,
                      ),
                    )}%`,
                  }}
                />
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-red-800 bg-red-950/40 p-4 text-sm font-medium text-red-200">
              {error}
            </div>
          )}

          {success && (
            <div className="rounded-xl border border-emerald-800 bg-emerald-950/30 p-4 text-sm font-medium text-emerald-200">
              {success}
            </div>
          )}
        </div>
      </div>

      {parsedRaces.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950">
            <div className="border-b border-zinc-800 px-4 py-4">
              <h2 className="font-black text-white">
                Detected Races
              </h2>

              <p className="mt-1 text-xs text-zinc-500">
                {parsedRaces.length} race
                {parsedRaces.length === 1
                  ? ""
                  : "s"}{" "}
                found
              </p>
            </div>

            <div className="max-h-[700px] overflow-y-auto p-2">
              {parsedRaces.map(
                (race, index) => {
                  const selected =
                    selectedRaceIndex ===
                    index;

                  return (
                    <button
                      key={`${race.track}-${race.raceNumber}-${index}`}
                      type="button"
                      onClick={() =>
                        setSelectedRaceIndex(
                          index,
                        )
                      }
                      className={`mb-2 w-full rounded-xl border p-4 text-left transition ${
                        selected
                          ? "border-orange-600 bg-orange-950/30"
                          : "border-zinc-800 bg-zinc-900/60 hover:border-zinc-700"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-black text-white">
                          Race{" "}
                          {
                            race.raceNumber
                          }
                        </span>

                        {race.raceTime && (
                          <span className="text-xs font-bold text-orange-300">
                            {
                              race.raceTime
                            }
                          </span>
                        )}
                      </div>

                      <div className="mt-1 truncate text-sm font-semibold text-zinc-300">
                        {race.track}
                      </div>

                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {race.distance && (
                          <span className="rounded bg-zinc-800 px-2 py-1 text-[11px] text-zinc-400">
                            {
                              race.distance
                            }
                          </span>
                        )}

                        {race.grade && (
                          <span className="rounded bg-zinc-800 px-2 py-1 text-[11px] text-zinc-400">
                            {race.grade}
                          </span>
                        )}

                        <span className="rounded bg-zinc-800 px-2 py-1 text-[11px] text-zinc-400">
                          {
                            race.runners
                              .length
                          }{" "}
                          runners
                        </span>
                      </div>
                    </button>
                  );
                },
              )}
            </div>
          </aside>

          {selectedRace && (
            <section className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950">
              <div className="border-b border-zinc-800 bg-gradient-to-r from-red-950/60 to-orange-950/30 p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="text-sm font-bold uppercase tracking-wider text-orange-400">
                      {
                        selectedRace.track
                      }
                    </div>

                    <h2 className="mt-1 text-3xl font-black text-white">
                      Race{" "}
                      {
                        selectedRace.raceNumber
                      }
                    </h2>

                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      {selectedRace.raceDate && (
                        <span className="rounded-lg border border-zinc-700 bg-black/30 px-2.5 py-1.5 text-zinc-300">
                          {
                            selectedRace.raceDate
                          }
                        </span>
                      )}

                      {selectedRace.raceTime && (
                        <span className="rounded-lg border border-zinc-700 bg-black/30 px-2.5 py-1.5 text-zinc-300">
                          {
                            selectedRace.raceTime
                          }
                        </span>
                      )}

                      {selectedRace.distance && (
                        <span className="rounded-lg border border-zinc-700 bg-black/30 px-2.5 py-1.5 text-zinc-300">
                          {
                            selectedRace.distance
                          }
                        </span>
                      )}

                      {selectedRace.grade && (
                        <span className="rounded-lg border border-zinc-700 bg-black/30 px-2.5 py-1.5 text-zinc-300">
                          {
                            selectedRace.grade
                          }
                        </span>
                      )}

                      {selectedRace.prizeMoney && (
                        <span className="rounded-lg border border-zinc-700 bg-black/30 px-2.5 py-1.5 text-zinc-300">
                          {
                            selectedRace.prizeMoney
                          }
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-col gap-2 sm:items-end">
                    <button
                      type="button"
                      onClick={handleImportSelectedRace}
                      disabled={
                        busy ||
                        selectedRace.runners.length === 0
                      }
                      className="w-full rounded-xl border border-orange-700/70 bg-zinc-900 px-5 py-3 text-sm font-black text-orange-200 shadow-lg transition hover:border-orange-500 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
                    >
                      {stage === "importing"
                        ? "Saving..."
                        : "Save Selected Race to Database"}
                    </button>

                    <button
                      type="button"
                      onClick={handleImportAllRaces}
                      disabled={
                        busy ||
                        parsedRaces.length === 0 ||
                        parsedRaces.some(
                          (race) => race.runners.length === 0,
                        )
                      }
                      className="w-full rounded-xl bg-gradient-to-r from-red-600 to-orange-500 px-5 py-3 text-sm font-black text-white shadow-lg transition hover:from-red-500 hover:to-orange-400 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
                    >
                      {stage === "importing"
                        ? "Saving All Races..."
                        : `Save All ${parsedRaces.length} Races to Database`}
                    </button>
                  </div>
                </div>

                {(selectedRace.weather ||
                  selectedRace.trackCondition) && (
                  <div className="mt-4 flex flex-wrap gap-4 border-t border-zinc-800/80 pt-4 text-xs text-zinc-400">
                    {selectedRace.weather && (
                      <div>
                        Weather:{" "}
                        <span className="font-semibold text-zinc-200">
                          {
                            selectedRace.weather
                          }
                        </span>
                      </div>
                    )}

                    {selectedRace.trackCondition && (
                      <div>
                        Track:{" "}
                        <span className="font-semibold text-zinc-200">
                          {
                            selectedRace.trackCondition
                          }
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="p-5">
                <h3 className="mb-4 text-sm font-black uppercase tracking-wider text-zinc-400">
                  Runners
                </h3>

                {selectedRace.runners
                  .length === 0 ? (
                  <div className="rounded-xl border border-yellow-800/60 bg-yellow-950/20 p-5 text-sm text-yellow-200">
                    No runners were detected
                    for this race. Check the
                    extracted text before
                    saving.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {selectedRace.runners.map(
                      (runner) => (
                        <div
                          key={`${selectedRace.raceNumber}-${runner.trapNumber}-${runner.name}`}
                          className="grid gap-3 rounded-xl border border-zinc-800 bg-zinc-900/70 p-4 sm:grid-cols-[70px_minmax(0,1fr)_auto]"
                        >
                          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-zinc-700 bg-black text-xl font-black text-white">
                            {runner.trapNumber ??
                              "—"}
                          </div>

                          <div className="min-w-0">
                            <div className="truncate text-base font-black text-white">
                              {
                                runner.name
                              }
                            </div>

                            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-400">
                              {runner.trapColor && (
                                <span>
                                  Trap:{" "}
                                  <span className="text-zinc-200">
                                    {
                                      runner.trapColor
                                    }
                                  </span>
                                </span>
                              )}

                              {runner.trainer && (
                                <span>
                                  Trainer:{" "}
                                  <span className="text-zinc-200">
                                    {
                                      runner.trainer
                                    }
                                  </span>
                                </span>
                              )}

                              {runner.weight && (
                                <span>
                                  Weight:{" "}
                                  <span className="text-zinc-200">
                                    {
                                      runner.weight
                                    }
                                  </span>
                                </span>
                              )}

                              {runner.form && (
                                <span>
                                  Form:{" "}
                                  <span className="text-zinc-200">
                                    {
                                      runner.form
                                    }
                                  </span>
                                </span>
                              )}
                            </div>
                          </div>

                          {runner.odds && (
                            <div className="self-center rounded-lg border border-orange-900 bg-orange-950/30 px-3 py-2 text-sm font-black text-orange-300">
                              {
                                runner.odds
                              }
                            </div>
                          )}
                        </div>
                      ),
                    )}
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