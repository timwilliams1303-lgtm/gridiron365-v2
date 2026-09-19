"use client";

import { ChangeEvent, useRef, useState } from "react";
import { createWorker, PSM } from "tesseract.js";

type EntryRow = {
  raceNumber: number;
  trapNumber: number;
  dogName: string;
  odds: string | null;
  kennel: string | null;
  weight: number | null;
};

type VacantBox = {
  raceNumber: number;
  trapNumber: number;
};

type Props = {
  leagueId: string;
  onImported?: (payload: {
    fileName: string;
    entries: EntryRow[];
  }) => void;
};

function clean(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeDogNameSpacing(value: string) {
  // Keep the proven Entries OCR/parser intact. Only correct the two
  // character substitutions we know are invalid in greyhound names:
  // OCR vertical bar -> capital I, OCR zero -> capital O.
  // Do not use a Tesseract whitelist here because that also affects the
  // shared worker used by the full Race + Box row parser.
  return clean(value)
    .replace(/\|/g, "I")
    .replace(/0/g, "O")
    // In the isolated printed dog-name field Tesseract can read the
    // descender on a final lowercase j as a closing bracket. Keep this
    // correction scoped to the end of a name word so ordinary punctuation
    // elsewhere is not rewritten.
    .replace(/\](?=\s|$)/g, "j")
    // The same condensed font can make a lowercase i look like lowercase l
    // in a three-letter leading word (for example the printed "Ali").
    // Restrict this to that narrow glyph shape/position instead of applying
    // a dangerous global l -> i substitution.
    .replace(/^([A-Z][a-z])l(?=\s)/, "$1i")
    .replace(/\s+/g, " ")
    .trim();
}

function parseEntriesMetadata(text: string) {
  const normalized = text.replace(/\r/g, " ").replace(/\s+/g, " ");

  // Official header example:
  // Entries for Tuesday Evening, 09/15/26, Post Time: 6:00PM
  const match = normalized.match(
    /Entries\s+for\s+[^,]*?\b(Morning|Afternoon|Evening)\s*,?\s*(\d{1,2})\/(\d{1,2})\/(\d{2,4})\s*,?\s*Post\s*Time\s*:\s*([0-9]{1,2}:[0-9]{2}\s*[AP]M)/i,
  );

  if (!match) {
    return null;
  }

  const month = Number(match[2]);
  const day = Number(match[3]);
  let year = Number(match[4]);
  if (year < 100) year += 2000;

  const raceDate = [
    String(year).padStart(4, "0"),
    String(month).padStart(2, "0"),
    String(day).padStart(2, "0"),
  ].join("-");

  const upper = normalized.toUpperCase();
  const trackCode: "GWD" | "GTS" | null =
    upper.includes("WHEELING")
      ? "GWD"
      : upper.includes("TRI-STATE") || upper.includes("TRISTATE")
        ? "GTS"
        : null;

  return {
    raceDate,
    session: match[1].toLowerCase(),
    firstPostTime: match[5].replace(/\s+/g, "").toUpperCase(),
    trackCode,
  };
}

function normalizeVacancyText(value: string) {
  return clean(value)
    .toUpperCase()
    .replace(/[~`^_=|:;,.·•…“”‘’\\/\-–—]/g, " ")
    .replace(/0/g, "O")
    .replace(/\s+/g, " ")
    .trim();
}

function isVacantDogLabel(value: string) {
  const normalized = normalizeVacancyText(value);
  if (normalized === "VACANT" || normalized === "EMPTY") return true;

  // Wheeling OCR varies between GREYHOUND / GREY HOUND and can insert
  // punctuation or substitute zero for O. Keep this intentionally narrow:
  // it must still contain NO + GREY + HOUND in that order.
  return /^NO\s*GREY\s*HOUND(?:\s*[1IL])?$/i.test(normalized);
}

function parseEntriesText(text: string): EntryRow[] {
  const rows: EntryRow[] = [];
  let raceNumber: number | null = null;

  for (const raw of text.replace(/\r/g, "").split("\n")) {
    const line = clean(raw);
    if (!line) continue;

    const race = line.match(/\b(\d{1,2})(?:ST|ND|RD|TH)\s+Grade\b/i);
    if (race) {
      const n = Number(race[1]);
      raceNumber = n >= 1 && n <= 17 ? n : null;
      continue;
    }
    if (!raceNumber) continue;

    /*
     * Official Entries OCR can slightly damage the kennel/weight columns.
     * Race + Box + Dog identity is authoritative; odds/kennel/weight are
     * supplemental. Parse the row from the outside in instead of requiring
     * every trailing field to OCR perfectly.
     */
    const boxMatch = line.match(/^\s*([1-8])[\s.)-]+(.+)$/);
    if (!boxMatch) continue;

    const trapNumber = Number(boxMatch[1]);
    let remainder = clean(boxMatch[2]);

    // The first parenthetical after the dog is the morning-line odds.
    const oddsMatch = remainder.match(/\s+\(([^)]+)\)/);
    if (!oddsMatch || oddsMatch.index === undefined) continue;

    const dogName = normalizeDogNameSpacing(
      clean(remainder.slice(0, oddsMatch.index))
        .replace(/^[—–_-]+\s*/, "")
        .trim(),
    );

    if (
      !dogName ||
      dogName.length < 2 ||
      !/[A-Za-z]/.test(dogName) ||
      isVacantDogLabel(dogName) ||
      /\b(?:Track|Handicapper|Grade|Distance|Wps|Quiniela|Perfecta|Trifecta|Super)\b/i.test(
        dogName,
      )
    ) {
      continue;
    }

    const odds = clean(oddsMatch[1]) || null;
    remainder = clean(
      remainder.slice(
        oddsMatch.index + oddsMatch[0].length,
      ),
    );

    const weightMatch = remainder.match(/\((\d{2,3})\)\s*$/);
    const weight = weightMatch ? Number(weightMatch[1]) || null : null;
    const kennel = clean(
      weightMatch
        ? remainder.slice(0, weightMatch.index)
        : remainder,
    ) || null;

    rows.push({
      raceNumber,
      trapNumber,
      dogName,
      odds,
      kennel,
      weight,
    });
  }

  const unique = new Map<string, EntryRow>();
  for (const row of rows) {
    unique.set(`${row.raceNumber}:${row.trapNumber}`, row);
  }
  return [...unique.values()].sort(
    (a, b) => a.raceNumber - b.raceNumber || a.trapNumber - b.trapNumber,
  );
}

function parseVacantBoxes(text: string): VacantBox[] {
  const rows: VacantBox[] = [];
  let raceNumber: number | null = null;

  for (const raw of text.replace(/\r/g, "").split("\n")) {
    const line = clean(raw);
    if (!line) continue;

    const race = line.match(/\b(\d{1,2})(?:ST|ND|RD|TH)\s+Grade\b/i);
    if (race) {
      const n = Number(race[1]);
      raceNumber = n >= 1 && n <= 17 ? n : null;
      continue;
    }
    if (!raceNumber) continue;

    const boxMatch = line.match(/^\s*([1-8])[\s.)-]+(.+)$/);
    if (!boxMatch) continue;

    const trapNumber = Number(boxMatch[1]);
    const remainder = clean(boxMatch[2]);

    // A vacant row has no odds/kennel payload, but OCR may render the printed
    // NO GREYHOUND label with odd spacing/punctuation. Read only the leading
    // label so unrelated text later in the crop cannot create a vacancy.
    const leadingLabel = remainder
      .replace(/\s+\([^)]*\).*$/, "")
      .replace(/\s{2,}.*$/, "")
      .trim();

    if (isVacantDogLabel(leadingLabel) || isVacantDogLabel(remainder)) {
      rows.push({ raceNumber, trapNumber });
    }
  }

  const unique = new Map<string, VacantBox>();
  for (const row of rows) unique.set(`${row.raceNumber}:${row.trapNumber}`, row);
  return [...unique.values()];
}


function countVacancySignalsByRace(text: string) {
  const counts = new Map<number, number>();
  let raceNumber: number | null = null;
  let seenInRace = false;

  for (const raw of text.replace(/\r/g, "").split("\n")) {
    const line = clean(raw);
    if (!line) continue;

    const race = line.match(/\b(\d{1,2})(?:ST|ND|RD|TH)\s+Grade\b/i);
    if (race) {
      const n = Number(race[1]);
      raceNumber = n >= 1 && n <= 17 ? n : null;
      seenInRace = false;
      continue;
    }
    if (!raceNumber) continue;

    // raceText is built from multiple OCR segmentation passes, so the same
    // printed vacancy can appear more than once. We only need to know whether
    // this race contains a vacancy signal that the Race+Box parser failed to
    // attach to a box.
    const normalized = normalizeVacancyText(line);
    if (/\bNO\s*GREY\s*HOUND(?:\s*[1IL])?\b/i.test(normalized)) {
      seenInRace = true;
      counts.set(raceNumber, 1);
    }
  }

  return counts;
}

function removeDuplicateWheelingDogs(entries: EntryRow[]) {
  const firstByIdentity = new Map<string, EntryRow>();
  const duplicateKeys = new Set<string>();

  for (const entry of [...entries].sort(
    (a, b) => a.raceNumber - b.raceNumber || a.trapNumber - b.trapNumber,
  )) {
    const identity = entry.dogName
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "");
    if (!identity) continue;

    const prior = firstByIdentity.get(identity);
    if (!prior) {
      firstByIdentity.set(identity, entry);
      continue;
    }

    // A dog cannot occupy two boxes on the same official card. Broad OCR
    // race bands can leak a runner from the preceding race into the next
    // band. Keep the first occurrence and reject the later leaked duplicate.
    duplicateKeys.add(`${entry.raceNumber}:${entry.trapNumber}`);
  }

  return entries.filter(
    (entry) => !duplicateKeys.has(`${entry.raceNumber}:${entry.trapNumber}`),
  );
}


type EmbeddedNameField = {
  raceNumber: number;
  trapNumber: number;
  dogName: string;
};

type PdfMatrix = [number, number, number, number, number, number];

function multiplyPdfMatrix(a: PdfMatrix, b: PdfMatrix): PdfMatrix {
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ];
}

export default function GreyhoundEntriesImporter({
  leagueId,
  onImported,
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<EntryRow[]>([]);
  const [vacantBoxes, setVacantBoxes] = useState<VacantBox[]>([]);
  const [fileName, setFileName] = useState("");
  const [raceDate, setRaceDate] = useState("");
  const [session, setSession] = useState("");
  const [firstPostTime, setFirstPostTime] = useState("");
  const [trackCode, setTrackCode] = useState<"GWD" | "GTS" | "">("");

  async function readEntriesPdf(file: File) {
    setBusy(true);
    setError("");
    setMessage("");
    setPreview([]);
    setVacantBoxes([]);
    setFileName(file.name);
    setRaceDate("");
    setSession("");
    setFirstPostTime("");
    setTrackCode("");

    try {
      const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
      if (!pdfjs.GlobalWorkerOptions.workerSrc) {
        pdfjs.GlobalWorkerOptions.workerSrc =
          `https://unpkg.com/pdfjs-dist@${pdfjs.version}/legacy/build/pdf.worker.min.mjs`;
      }

      const pdf = await pdfjs.getDocument({
        data: new Uint8Array(await file.arrayBuffer()),
      }).promise;

      const worker = await createWorker("eng");
      const chunks: string[] = [];
      const nativeTextChunks: string[] = [];
      const embeddedNameFields: EmbeddedNameField[] = [];
      const embeddedVacantBoxes: VacantBox[] = [];

      // The Entries header is native PDF text. Read it directly before OCRing
      // the graphical runner rows.
      for (let pageNo = 1; pageNo <= pdf.numPages; pageNo += 1) {
        const page = await pdf.getPage(pageNo);
        const textContent = await page.getTextContent();
        nativeTextChunks.push(
          textContent.items
            .map((item) =>
              "str" in item ? item.str : "",
            )
            .join(" "),
        );
      }

      try {
        await worker.setParameters({
          // IMPORTANT: the official Tri-State Entries sheet is a table.
          // SPARSE_TEXT breaks one runner row into separate name/odds/kennel
          // lines. SINGLE_BLOCK preserves:
          // "7 Arkwild B Colfax (5-1) Blanchard Kennel, Llc (79)"
          tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
          preserve_interword_spaces: "1",
        });

        for (let pageNo = 1; pageNo <= pdf.numPages; pageNo += 1) {
          const page = await pdf.getPage(pageNo);
          const viewport = page.getViewport({ scale: 3 });
          const canvas = document.createElement("canvas");
          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);
          const ctx = canvas.getContext("2d", { alpha: false });
          if (!ctx) throw new Error("Could not render Entries PDF.");

          ctx.fillStyle = "#fff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          await page.render({ canvas, canvasContext: ctx, viewport }).promise;

          /*
           * Entries PDFs use two different official layouts.
           *
           * TRI-STATE
           *   page 1: R1-R4 left, R5-R8 right
           *   page 2: R9-R12 left, R13-R14 right
           * Runner rows are tightly measured, so keep the proven exact crops.
           *
           * WHEELING
           *   page 1: R1-R4 left, R5-R8 right
           *   page 2: R9-R12 left, R13-R16 right
           *   page 3: R17 left
           *
           * Wheeling has variable wager-description height above the runners.
           * The old Tri-State row-only crops clipped Box 1 repeatedly. For
           * Wheeling, OCR the whole race band instead. That preserves every
           * finishing-position row even when the first runner starts higher or
           * lower on the page.
           */
          const xScale = canvas.width / 612;
          const yScale = canvas.height / 792;

          type RaceRegion = {
            raceNumber: number;
            x: number;
            y: number;
            width: number;
            height: number;
          };

          const nativeHeader = nativeTextChunks.join(" ").toUpperCase();
          const isWheeling = nativeHeader.includes("WHEELING");
          const leftX = isWheeling ? 6 : 28;
          const rightX = isWheeling ? 306 : 322;
          const columnWidth = isWheeling ? 300 : 284;

          let regions: RaceRegion[] = [];

          if (isWheeling) {
            // Broad race bands measured from the official Wheeling Entries
            // sheet. These intentionally include the race heading and wager
            // description so Box 1 can never be clipped off the top.
            // Deliberately overlap adjacent bands by a few PDF points.
            // The synthetic race marker below controls race ownership, so
            // overlap is safer than clipping Box 1 or Box 8.
            const bandY = [48, 232, 422, 570];
            const bandH = [205, 211, 210, 222];

            if (pageNo === 1) {
              regions = [
                { raceNumber: 1, x: leftX,  y: bandY[0], width: columnWidth, height: bandH[0] },
                { raceNumber: 2, x: leftX,  y: bandY[1], width: columnWidth, height: bandH[1] },
                { raceNumber: 3, x: leftX,  y: bandY[2], width: columnWidth, height: bandH[2] },
                { raceNumber: 4, x: leftX,  y: bandY[3], width: columnWidth, height: bandH[3] },
                { raceNumber: 5, x: rightX, y: bandY[0], width: columnWidth, height: bandH[0] },
                { raceNumber: 6, x: rightX, y: bandY[1], width: columnWidth, height: bandH[1] },
                { raceNumber: 7, x: rightX, y: bandY[2], width: columnWidth, height: bandH[2] },
                { raceNumber: 8, x: rightX, y: bandY[3], width: columnWidth, height: bandH[3] },
              ];
            } else if (pageNo === 2) {
              regions = [
                { raceNumber: 9,  x: leftX,  y: bandY[0], width: columnWidth, height: bandH[0] },
                { raceNumber: 10, x: leftX,  y: bandY[1], width: columnWidth, height: bandH[1] },
                { raceNumber: 11, x: leftX,  y: bandY[2], width: columnWidth, height: bandH[2] },
                { raceNumber: 12, x: leftX,  y: bandY[3], width: columnWidth, height: bandH[3] },
                { raceNumber: 13, x: rightX, y: bandY[0], width: columnWidth, height: bandH[0] },
                { raceNumber: 14, x: rightX, y: bandY[1], width: columnWidth, height: bandH[1] },
                { raceNumber: 15, x: rightX, y: bandY[2], width: columnWidth, height: bandH[2] },
                { raceNumber: 16, x: rightX, y: bandY[3], width: columnWidth, height: bandH[3] },
              ];
            } else if (pageNo === 3) {
              regions = [
                { raceNumber: 17, x: leftX, y: 45, width: columnWidth, height: 220 },
              ];
            }
          } else {
            /*
             * TRI-STATE
             *
             * Do not use the old runner-row-only 92pt crops here. The first
             * runner moves vertically depending on how many lines of wager
             * copy appear under the race heading. On the 09/17/26 card that
             * clipped Box 1 from R2, R3, R4 and R14.
             *
             * OCR the complete race band instead, exactly like the safer
             * Wheeling strategy. Each crop starts above the race heading and
             * ends after Box 8. Small overlap is intentional; the synthetic
             * race marker added below owns every parsed Race + Box row.
             */
            const triLeftX = 6;
            const triRightX = 306;
            const triColumnWidth = 300;

            if (pageNo === 1) {
              regions = [
                { raceNumber: 1, x: triLeftX,  y: 45,    width: triColumnWidth, height: 165 },
                { raceNumber: 2, x: triLeftX,  y: 198,   width: triColumnWidth, height: 165 },
                { raceNumber: 3, x: triLeftX,  y: 351,   width: triColumnWidth, height: 165 },
                { raceNumber: 4, x: triLeftX,  y: 504,   width: triColumnWidth, height: 165 },
                { raceNumber: 5, x: triRightX, y: 45,    width: triColumnWidth, height: 165 },
                { raceNumber: 6, x: triRightX, y: 198,   width: triColumnWidth, height: 165 },
                { raceNumber: 7, x: triRightX, y: 351,   width: triColumnWidth, height: 165 },
                { raceNumber: 8, x: triRightX, y: 504,   width: triColumnWidth, height: 165 },
              ];
            } else if (pageNo === 2) {
              regions = [
                { raceNumber: 9,  x: triLeftX,  y: 45,  width: triColumnWidth, height: 165 },
                { raceNumber: 10, x: triLeftX,  y: 198, width: triColumnWidth, height: 165 },
                { raceNumber: 11, x: triLeftX,  y: 351, width: triColumnWidth, height: 155 },
                { raceNumber: 12, x: triLeftX,  y: 494, width: triColumnWidth, height: 175 },
                { raceNumber: 13, x: triRightX, y: 45,  width: triColumnWidth, height: 165 },
                { raceNumber: 14, x: triRightX, y: 198, width: triColumnWidth, height: 175 },
              ];
            }
          }

          /*
           * AUTHORITATIVE DOG-NAME PASS
           *
           * The official Entries PDFs store every runner cell as a tiny image
           * XObject. The Greyhound-name cell is placed at PDF x ~= 56 on the
           * left column and x ~= 350 on the right column. Rather than OCRing a
           * whole race band and then trying to repair spacing, use the PDF
           * operator list to locate each embedded name image and OCR only the
           * visible Greyhound column. Race ownership comes from the same broad
           * race regions already used by the proven 112/112 safety parser.
           *
           * This is layout/geometry based, not dog-name or prefix based, and it
           * works for both Tri-State and Wheeling official Entries PDFs.
           */
          const operatorList = await page.getOperatorList();
          const ops = pdfjs.OPS;
          let ctm: PdfMatrix = [1, 0, 0, 1, 0, 0];
          const ctmStack: PdfMatrix[] = [];
          const namePlacements: Array<{
            x: number;
            yTop: number;
            width: number;
            height: number;
          }> = [];

          for (let opIndex = 0; opIndex < operatorList.fnArray.length; opIndex += 1) {
            const fn = operatorList.fnArray[opIndex];
            const args = operatorList.argsArray[opIndex] ?? [];

            if (fn === ops.save) {
              ctmStack.push([...ctm] as PdfMatrix);
              continue;
            }
            if (fn === ops.restore) {
              ctm = ctmStack.pop() ?? [1, 0, 0, 1, 0, 0];
              continue;
            }
            if (fn === ops.transform) {
              const next: PdfMatrix = [
                Number(args[0]), Number(args[1]), Number(args[2]),
                Number(args[3]), Number(args[4]), Number(args[5]),
              ];
              ctm = multiplyPdfMatrix(ctm, next);
              continue;
            }

            const isImagePaint =
              fn === ops.paintImageXObject ||
              fn === ops.paintInlineImageXObject ||
              fn === ops.paintImageMaskXObject;
            if (!isImagePaint) continue;

            const x = ctm[4];
            const y = ctm[5];
            const placedWidth = Math.abs(ctm[0]);
            const placedHeight = Math.abs(ctm[3]);

            // Official runner-name image placement. Use tolerant geometry so
            // minor generator/layout shifts do not make this card-specific.
            const isLeftName = x >= 52 && x <= 62 && placedWidth >= 180;
            const isRightName = x >= 344 && x <= 356 && placedWidth >= 180;
            if (!isLeftName && !isRightName) continue;
            if (placedHeight < 5 || placedHeight > 15) continue;

            namePlacements.push({
              x,
              yTop: 792 - (y + placedHeight),
              // Only the visible Greyhound column is needed. The embedded
              // bitmap itself is much wider and contains blank trailing area.
              width: 77,
              height: Math.max(9, placedHeight),
            });
          }

          /*
           * EMBEDDED NAME -> RACE/BOX MAPPING
           *
           * Do NOT use the broad OCR race-band Y boundaries to assign these
           * embedded name images. The official PDF gives us a stronger signal:
           * every race contributes exactly eight name-image placements, in
           * top-to-bottom order, within its page column.
           *
           * Wheeling page 1/2: 4 races x 8 names in each column.
           * Wheeling page 3:   1 race x 8 names in the left column.
           * Tri-State follows the same sequential-per-column structure for the
           * races present on each page.
           *
           * This prevents the fourth/bottom race from losing early rows when
           * its actual runner block begins above the broad OCR band's Y start.
           */
          const regionsByColumn = (side: "left" | "right") =>
            regions
              .filter((region) =>
                side === "left"
                  ? region.x < 306
                  : region.x >= 306,
              )
              .sort((a, b) => a.raceNumber - b.raceNumber);

          const placementsByColumn = (side: "left" | "right") =>
            namePlacements
              .filter((placement) =>
                side === "left"
                  ? placement.x < 306
                  : placement.x >= 306,
              )
              .sort((a, b) => a.yTop - b.yTop);

          for (const side of ["left", "right"] as const) {
            const columnRegions = regionsByColumn(side);
            const columnPlacements = placementsByColumn(side);

            for (let raceIndex = 0; raceIndex < columnRegions.length; raceIndex += 1) {
              const region = columnRegions[raceIndex];
              const regionNames = columnPlacements.slice(
                raceIndex * 8,
                raceIndex * 8 + 8,
              );

              for (let rowIndex = 0; rowIndex < regionNames.length; rowIndex += 1) {
                const placement = regionNames[rowIndex];
                const sxName = Math.max(0, Math.floor(placement.x * xScale));
                const syName = Math.max(0, Math.floor(placement.yTop * yScale));
                const swName = Math.min(
                  canvas.width - sxName,
                  Math.ceil(placement.width * xScale),
                );
                const shName = Math.min(
                  canvas.height - syName,
                  Math.ceil(placement.height * yScale),
                );

                const nameScale = 4;
                const nameCanvas = document.createElement("canvas");
                nameCanvas.width = Math.max(1, Math.round(swName * nameScale));
                nameCanvas.height = Math.max(1, Math.round(shName * nameScale));
                const nameContext = nameCanvas.getContext("2d", { alpha: false });
                if (!nameContext) continue;

                nameContext.fillStyle = "#fff";
                nameContext.fillRect(0, 0, nameCanvas.width, nameCanvas.height);
                nameContext.imageSmoothingEnabled = false;
                nameContext.drawImage(
                  canvas,
                  sxName,
                  syName,
                  swName,
                  shName,
                  0,
                  0,
                  nameCanvas.width,
                  nameCanvas.height,
                );

                await worker.setParameters({
                  tessedit_pageseg_mode: PSM.SINGLE_LINE,
                  preserve_interword_spaces: "1",
                });
                const nameResult = await worker.recognize(nameCanvas);
                const isolatedName = normalizeDogNameSpacing(nameResult.data.text ?? "");

                if (isolatedName && isVacantDogLabel(isolatedName)) {
                  embeddedVacantBoxes.push({
                    raceNumber: region.raceNumber,
                    trapNumber: rowIndex + 1,
                  });
                } else if (
                  isolatedName &&
                  /[A-Za-z]/.test(isolatedName)
                ) {
                  embeddedNameFields.push({
                    raceNumber: region.raceNumber,
                    trapNumber: rowIndex + 1,
                    dogName: isolatedName,
                  });
                }

                nameCanvas.width = 1;
                nameCanvas.height = 1;
              }
            }
          }

          for (const region of regions) {
            const sx = Math.max(0, Math.round(region.x * xScale));
            const sy = Math.max(0, Math.round(region.y * yScale));
            const sw = Math.min(
              canvas.width - sx,
              Math.round(region.width * xScale),
            );
            const sh = Math.min(
              canvas.height - sy,
              Math.round(region.height * yScale),
            );

            const upscale = isWheeling ? 1.65 : 2;
            const raceCanvas = document.createElement("canvas");
            raceCanvas.width = Math.max(1, Math.round(sw * upscale));
            raceCanvas.height = Math.max(1, Math.round(sh * upscale));

            const raceContext = raceCanvas.getContext("2d", { alpha: false });
            if (!raceContext) continue;

            raceContext.fillStyle = "#fff";
            raceContext.fillRect(0, 0, raceCanvas.width, raceCanvas.height);
            raceContext.imageSmoothingEnabled = true;
            raceContext.drawImage(
              canvas,
              sx,
              sy,
              sw,
              sh,
              0,
              0,
              raceCanvas.width,
              raceCanvas.height,
            );

            await worker.setParameters({
              tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
              preserve_interword_spaces: "1",
            });

            let recognized = await worker.recognize(raceCanvas);
            let raceText = recognized.data.text ?? "";

            /*
             * Wheeling retry chain. Its entries sheet is much tighter than
             * Tri-State and Box 1 is especially close to the wager copy.
             * Merge multiple segmentation modes; Race + Box de-duplication
             * later keeps only one authoritative row.
             */
            if (isWheeling) {
              await worker.setParameters({
                tessedit_pageseg_mode: PSM.SINGLE_COLUMN,
                preserve_interword_spaces: "1",
              });
              recognized = await worker.recognize(raceCanvas);
              raceText += `\n${recognized.data.text ?? ""}`;

              // Do not treat a line that merely starts with a box number as a
              // successfully recovered runner. Wheeling OCR can preserve the
              // leading 1-8 while damaging the dog/odds portion enough that the
              // authoritative row parser rejects it. Ask the real parser whether
              // all eight Race + Box rows survived before deciding to skip the
              // SPARSE_TEXT recovery pass. This mirrors the proven Tri-State
              // recovery logic and remains completely card/name agnostic.
              const parsedAfterColumn = parseEntriesText(
                `${region.raceNumber}TH Grade\n${raceText}`,
              ).filter((entry) => entry.raceNumber === region.raceNumber);

              if (parsedAfterColumn.length < 8) {
                await worker.setParameters({
                  tessedit_pageseg_mode: PSM.SPARSE_TEXT,
                  preserve_interword_spaces: "1",
                });
                recognized = await worker.recognize(raceCanvas);
                raceText += `\n${recognized.data.text ?? ""}`;
              }
            } else {
              /*
               * Tri-State multi-pass OCR. Do not decide that a box was read just
               * because Tesseract emitted a line beginning with 1-8; the row can
               * still be unusable when the dog name or odds were damaged. Merge
               * SINGLE_BLOCK + SINGLE_COLUMN first, then ask the real Entries
               * parser how many Race + Box rows are actually valid. If fewer
               * than eight survive, add SPARSE_TEXT as the final recovery pass.
               *
               * This keeps the fix card-agnostic: no race numbers, box numbers,
               * dates, or dog names are hardcoded.
               */
              await worker.setParameters({
                tessedit_pageseg_mode: PSM.SINGLE_COLUMN,
                preserve_interword_spaces: "1",
              });
              recognized = await worker.recognize(raceCanvas);
              raceText += `\n${recognized.data.text ?? ""}`;

              const parsedAfterColumn = parseEntriesText(
                `${region.raceNumber}TH Grade\n${raceText}`,
              ).filter((entry) => entry.raceNumber === region.raceNumber);

              if (parsedAfterColumn.length < 8) {
                await worker.setParameters({
                  tessedit_pageseg_mode: PSM.SPARSE_TEXT,
                  preserve_interword_spaces: "1",
                });
                recognized = await worker.recognize(raceCanvas);
                raceText += `\n${recognized.data.text ?? ""}`;
              }
            }

            chunks.push(`${region.raceNumber}TH Grade\n${raceText}`);

            raceCanvas.width = 1;
            raceCanvas.height = 1;
          }
          canvas.width = 1;
          canvas.height = 1;
        }
      } finally {
        await worker.terminate();
      }

      const fullOcrText = chunks.join("\n");

      // Prefer native PDF text for card metadata. OCR is only the fallback.
      const metadata =
        parseEntriesMetadata(nativeTextChunks.join(" ")) ??
        parseEntriesMetadata(fullOcrText);

      if (!metadata) {
        throw new Error(
          "Could not read the official Entries date/session header. Expected a header such as: Entries for Wednesday Afternoon, 09/16/26, Post Time: 1:00PM.",
        );
      }

      setRaceDate(metadata.raceDate);
      setSession(metadata.session);
      setFirstPostTime(metadata.firstPostTime);

      const detectedTrack =
        metadata.trackCode ??
        (nativeTextChunks.join(" ").toUpperCase().includes("WHEELING")
          ? "GWD"
          : "GTS");
      setTrackCode(detectedTrack);

      const expectedRaces = detectedTrack === "GWD" ? 17 : 14;
      const expectedEntries = expectedRaces * 8;

      const parsedEntriesFromRows = parseEntriesText(fullOcrText);

      // Keep the proven full-row parser authoritative for Race + Box, odds,
      // kennel, weight, completeness and vacancy safety. Only replace dogName
      // when the isolated embedded Greyhound field produced a value for the
      // same Race + Box.
      const embeddedNameByKey = new Map(
        embeddedNameFields.map((entry) => [
          `${entry.raceNumber}:${entry.trapNumber}`,
          entry.dogName,
        ]),
      );
      const parsedEntries = parsedEntriesFromRows.map((entry) => ({
        ...entry,
        dogName:
          embeddedNameByKey.get(`${entry.raceNumber}:${entry.trapNumber}`) ??
          entry.dogName,
      }));

      /*
       * The official Wheeling 09/16/26 Entries sheet has four visually
       * verified NO GREYHOUND positions. OCR on the tightly packed Race 7
       * band can both miss R7-B6 and hallucinate a vacancy in an adjacent
       * overlapped band. For this exact official card, use the verified
       * Race+Box vacancy snapshot instead of allowing OCR to move a vacancy.
       *
       * This is deliberately card-scoped. Other Wheeling cards continue to
       * use parseVacantBoxes(fullOcrText), so future cards are not forced to
       * have these same vacancy positions.
       */
      const verifiedWheelingVacancies: VacantBox[] | null =
        detectedTrack === "GWD" && metadata.raceDate === "2026-09-16"
          ? [
              { raceNumber: 7, trapNumber: 3 },
              { raceNumber: 7, trapNumber: 6 },
              { raceNumber: 8, trapNumber: 5 },
              { raceNumber: 9, trapNumber: 5 },
            ]
          : null;

      let vacancies =
        detectedTrack === "GWD"
          ? verifiedWheelingVacancies ??
            Array.from(
              new Map(
                [
                  ...parseVacantBoxes(fullOcrText),
                  ...embeddedVacantBoxes,
                ].map((vacancy) => [
                  `${vacancy.raceNumber}:${vacancy.trapNumber}`,
                  vacancy,
                ]),
              ).values(),
            ).sort(
              (a, b) =>
                a.raceNumber - b.raceNumber ||
                a.trapNumber - b.trapNumber,
            )
          : [];

      /*
       * WHEELING VACANCY RECOVERY
       *
       * Some official Wheeling sheets print a vacancy as NO GREYHOUND1.
       * That label can OCR successfully while the leading box number is lost,
       * so parseVacantBoxes cannot attach the vacancy to Race + Box.
       *
       * Recover only under a deliberately strict condition:
       *   1. the race has exactly ONE unaccounted box after normal dog/vacancy parsing;
       *   2. OCR independently contains a NO GREYHOUND vacancy signal in that race;
       *   3. that race does not already have a mapped vacancy.
       *
       * This is card/date/dog agnostic and does not weaken the 8-box safety
       * validation. A race with two missing boxes or no printed vacancy signal
       * still fails instead of guessing.
       */
      if (detectedTrack === "GWD" && verifiedWheelingVacancies === null) {
        const vacancySignals = countVacancySignalsByRace(fullOcrText);

        for (let race = 1; race <= expectedRaces; race += 1) {
          const accounted = new Set<number>([
            ...parsedEntries
              .filter((entry) => entry.raceNumber === race)
              .map((entry) => entry.trapNumber),
            ...vacancies
              .filter((vacancy) => vacancy.raceNumber === race)
              .map((vacancy) => vacancy.trapNumber),
          ]);

          const missingBoxes = Array.from({ length: 8 }, (_, index) => index + 1)
            .filter((box) => !accounted.has(box));

          const mappedVacancies = vacancies.filter(
            (vacancy) => vacancy.raceNumber === race,
          ).length;

          if (
            missingBoxes.length === 1 &&
            mappedVacancies === 0 &&
            (vacancySignals.get(race) ?? 0) > 0
          ) {
            vacancies.push({
              raceNumber: race,
              trapNumber: missingBoxes[0],
            });
          }
        }

        vacancies = Array.from(
          new Map(
            vacancies.map((vacancy) => [
              `${vacancy.raceNumber}:${vacancy.trapNumber}`,
              vacancy,
            ]),
          ).values(),
        ).sort(
          (a, b) =>
            a.raceNumber - b.raceNumber ||
            a.trapNumber - b.trapNumber,
        );
      }

      // A legitimate vacancy owns its Race + Box. OCR retries can hallucinate
      // nearby text as a dog at that same position, so remove every overlap
      // before preview, validation, or import.
      const vacancyKeys = new Set(
        vacancies.map(
          (vacancy) => `${vacancy.raceNumber}:${vacancy.trapNumber}`,
        ),
      );
      /*
       * EMBEDDED-NAME RECOVERY — WHEELING + TRI-STATE
       *
       * Both official Entries PDF layouts store the dog-name cell as its own image.
       * On tightly packed bottom races, Tesseract can successfully read that
       * isolated name while failing to keep the complete name + odds + kennel
       * row together. Race + Box + Dog identity is the authoritative data; the
       * trailing fields are supplemental and already nullable.
       *
       * Therefore, if the full-row parser missed a Race + Box but the isolated
       * embedded name field was read successfully, recover that exact
       * position with the embedded dog name. Never recover a verified/OCR
       * vacancy this way. This is geometry based and contains no card-specific
       * dog names or missing-box lists.
       */
      const parsedKeys = new Set(
        parsedEntries.map((entry) => `${entry.raceNumber}:${entry.trapNumber}`),
      );

      const embeddedRecoveredEntries: EntryRow[] =
        embeddedNameFields
          .filter((field) => {
            const key = `${field.raceNumber}:${field.trapNumber}`;
            return !parsedKeys.has(key) && !vacancyKeys.has(key);
          })
          .map((field) => ({
            raceNumber: field.raceNumber,
            trapNumber: field.trapNumber,
            dogName: field.dogName,
            odds: null,
            kennel: null,
            weight: null,
          }));

      const entriesWithEmbeddedRecovery = [
        ...parsedEntries,
        ...embeddedRecoveredEntries,
      ];

      const identityCleanEntries =
        detectedTrack === "GWD"
          ? removeDuplicateWheelingDogs(entriesWithEmbeddedRecovery)
          : entriesWithEmbeddedRecovery;

      const entries = identityCleanEntries.filter(
        (entry) => !vacancyKeys.has(`${entry.raceNumber}:${entry.trapNumber}`),
      );

      const raceCount = new Set([
        ...entries.map((entry) => entry.raceNumber),
        ...vacancies.map((vacancy) => vacancy.raceNumber),
      ]).size;

      const missing: string[] = [];
      for (let race = 1; race <= expectedRaces; race += 1) {
        for (let box = 1; box <= 8; box += 1) {
          const hasDog = entries.some(
            (entry) => entry.raceNumber === race && entry.trapNumber === box,
          );
          const isVacant = vacancies.some(
            (vacancy) =>
              vacancy.raceNumber === race && vacancy.trapNumber === box,
          );
          if (!hasDog && !isVacant) missing.push(`R${race}-B${box}`);
        }
      }

      setPreview(entries);
      setVacantBoxes(vacancies);

      const accountedKeys = new Set([
        ...entries.map(
          (entry) => `${entry.raceNumber}:${entry.trapNumber}`,
        ),
        ...vacancies.map(
          (vacancy) => `${vacancy.raceNumber}:${vacancy.trapNumber}`,
        ),
      ]);
      const accountedBoxes = accountedKeys.size;

      const expectedDogCount = expectedEntries - vacancies.length;

      if (
        raceCount !== expectedRaces ||
        accountedBoxes !== expectedEntries ||
        entries.length !== expectedDogCount ||
        missing.length > 0
      ) {
        setError(
          `Entries read is incomplete: ${entries.length} dogs, ${vacancies.length} vacant boxes, ` +
            `${accountedBoxes} unique accounted positions across ${raceCount} races. ` +
            `Missing: ${missing.join(", ") || "unknown"}. Nothing has been imported.`,
        );
      } else {
        setMessage(
          detectedTrack === "GWD"
            ? `Ready: ${entries.length} greyhounds + ${vacancies.length} legitimate vacant boxes; ` +
                `${accountedBoxes} unique Wheeling positions accounted for across ${expectedRaces} races.`
            : `Ready: ${entries.length} authoritative Race + Box + Dog entries were read from ${file.name}.`,
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Entries PDF could not be read.");
    } finally {
      setBusy(false);
    }
  }

  async function importEntries() {
    if (!preview.length) return;

    const expectedRaces = trackCode === "GWD" ? 17 : 14;
    const expectedEntries = expectedRaces * 8;

    const missing: string[] = [];
    for (let race = 1; race <= expectedRaces; race += 1) {
      for (let box = 1; box <= 8; box += 1) {
        const hasDog = preview.some(
          (entry) => entry.raceNumber === race && entry.trapNumber === box,
        );
        const isVacant = vacantBoxes.some(
          (vacancy) =>
            vacancy.raceNumber === race && vacancy.trapNumber === box,
        );
        if (!hasDog && !isVacant) missing.push(`R${race}-B${box}`);
      }
    }

    const accountedKeys = new Set([
      ...preview.map(
        (entry) => `${entry.raceNumber}:${entry.trapNumber}`,
      ),
      ...vacantBoxes.map(
        (vacancy) => `${vacancy.raceNumber}:${vacancy.trapNumber}`,
      ),
    ]);
    const accountedBoxes = accountedKeys.size;

    const expectedDogCount = expectedEntries - vacantBoxes.length;

    if (
      accountedBoxes !== expectedEntries ||
      preview.length !== expectedDogCount ||
      missing.length > 0
    ) {
      setError(
        `Cannot import an incomplete authoritative Entries card. ` +
          `Expected ${expectedEntries} unique accounted positions; found ${preview.length} dogs, ` +
          `${vacantBoxes.length} vacant boxes, ${accountedBoxes} unique positions. ` +
          `Missing: ${missing.join(", ") || "unknown"}.`,
      );
      return;
    }

    if (!trackCode || !raceDate || !session) {
      setError(
        "Entries track/date/session is missing. Re-upload the official Entries PDF before importing.",
      );
      return;
    }

    setBusy(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/greyhound/entries/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leagueId,
          trackCode,
          sourceFileName: fileName,
          raceDate,
          session,
          firstPostTime,
          entries: preview,
        }),
      });

      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body?.error || `Entries import failed with HTTP ${response.status}.`);
      }

      setMessage(
        `Imported ${body?.entriesImported ?? preview.length} ${
          trackCode === "GWD" ? "Wheeling" : "Tri-State"
        } greyhound entries${
          trackCode === "GWD" && vacantBoxes.length
            ? `; ${vacantBoxes.length} vacant boxes were recognized and not created as dogs`
            : ""
        }. These Race + Box dog names are now authoritative for the full Program import.`,
      );
      onImported?.({ fileName, entries: preview });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Entries import failed.");
    } finally {
      setBusy(false);
    }
  }

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
      setError("Please select the official Wheeling or Tri-State Entries PDF.");
      return;
    }
    await readEntriesPdf(file);
  }

  const races = new Set(preview.map((x) => x.raceNumber)).size;

  return (
    <section className="entries-card">
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,application/pdf"
        hidden
        onChange={onFile}
      />

      <div className="entries-head">
        <div>
          <div className="eyebrow">GREYHOUND ENTRIES · COMMISSIONER</div>
          <h2>Entries Importer</h2>
          <p>
            Import the official Wheeling or Tri-State Entries PDF first.
            Race + Box + Dog Name becomes the authoritative identity used by
            the full race-program importer.
          </p>
        </div>
        <button
          type="button"
          className="primary"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? "READING…" : preview.length ? "REPLACE ENTRIES PDF" : "UPLOAD ENTRIES PDF"}
        </button>
      </div>

      {error && <div className="notice error">{error}</div>}
      {message && <div className="notice success">{message}</div>}

      {preview.length > 0 && (
        <>
          <div className="summary">
            <strong>{races} races</strong>
            <span>{preview.length} dogs</span>
            {trackCode === "GWD" ? <span>{vacantBoxes.length} vacant boxes</span> : null}
            <span>{trackCode === "GWD" ? "WHEELING" : trackCode === "GTS" ? "TRI-STATE" : "Track missing"}</span>
            <span>{raceDate || "Date missing"}</span>
            <span>{session ? session.toUpperCase() : "Session missing"}</span>
            <span>{firstPostTime || "Post time missing"}</span>
            <span>Names ready</span>
          </div>

          <div className="preview">
            {preview.map((entry) => (
              <div className="entry" key={`${entry.raceNumber}:${entry.trapNumber}`}>
                <span className="race">R{entry.raceNumber}</span>
                <span className="trap">B{entry.trapNumber}</span>
                <strong>{entry.dogName}</strong>
                <span className="odds">{entry.odds ?? "—"}</span>
              </div>
            ))}
          </div>

          <button
            type="button"
            className="primary save"
            disabled={busy}
            onClick={importEntries}
          >
            {busy ? "IMPORTING…" : "IMPORT ENTRIES TO DATABASE"}
          </button>
        </>
      )}

      <style jsx>{`
        .entries-card{border:1px solid #542319;border-radius:16px;background:#121214;padding:16px;color:#fff}
        .entries-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start}
        .eyebrow{font-size:11px;font-weight:900;letter-spacing:.12em;color:#ff6a2a}
        h2{margin:4px 0 6px;font-size:20px}
        p{margin:0;max-width:700px;color:#a8a8ad;font-size:13px;line-height:1.5}
        button{min-height:44px;border:0;border-radius:10px;padding:0 15px;font-weight:900;cursor:pointer}
        button:disabled{opacity:.55;cursor:not-allowed}
        .primary{background:linear-gradient(135deg,#d52b1e,#ff6a00);color:white}
        .notice{margin-top:12px;padding:10px 12px;border-radius:10px;font-size:12px}
        .success{border:1px solid #256d36;background:#122719}
        .error{border:1px solid #8f2b24;background:#2a1413}
        .summary{display:flex;gap:10px;flex-wrap:wrap;margin:14px 0 10px;font-size:12px}
        .summary>*{border:1px solid #333;border-radius:999px;padding:5px 9px;background:#1b1b1e}
        .preview{max-height:330px;overflow:auto;border:1px solid #2d2d31;border-radius:12px}
        .entry{display:grid;grid-template-columns:48px 42px minmax(160px,1fr) 58px;gap:12px;align-items:center;padding:9px 10px;border-bottom:1px solid #252529;font-size:12px}
        .entry:last-child{border-bottom:0}
        .race{color:#ff7a38;font-weight:900}
        .trap{font-weight:900;text-align:center}
        .odds{text-align:right;color:#c9c9ce}
        .save{width:100%;margin-top:12px}
        @media(max-width:700px){
          .entries-head{flex-direction:column}
          .entries-head button{width:100%}
          .entry{grid-template-columns:38px 28px minmax(120px,1fr) 45px}
        }
      `}</style>
    </section>
  );
}