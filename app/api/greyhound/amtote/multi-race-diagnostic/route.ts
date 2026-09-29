import { NextRequest, NextResponse } from "next/server";
import {
  getAmtoteRaceResultDiagnostic,
  type AmtoteRaceResultRow,
  type AmtoteTrackId,
} from "@/lib/greyhound/amtote";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function normalizeTrackId(value: string | null): AmtoteTrackId | null {
  const trackId = (value ?? "WEM").trim().toUpperCase();
  return trackId === "WEM" || trackId === "TSE"
    ? (trackId as AmtoteTrackId)
    : null;
}

function normalizeRaceDate(value: string | null): string | null {
  const raceDate = (value ?? "").trim();
  if (!raceDate) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(raceDate) ? raceDate : null;
}

function normalizeRaceNumber(
  value: string | null,
  fallback: number,
): number | null {
  const raceNumber = Number(value ?? fallback);
  if (!Number.isInteger(raceNumber)) return null;
  if (raceNumber < 1 || raceNumber > 99) return null;
  return raceNumber;
}

function isMultiRaceRow(row: {
  poolCode: string | null;
  template: string | null;
}): boolean {
  const poolCode = (row.poolCode ?? "").trim().toUpperCase();
  const template = (row.template ?? "")
    .trim()
    .toUpperCase()
    .replace(/[\s_-]+/g, "");

  return (
    poolCode === "P4" ||
    poolCode === "P5" ||
    template === "PICK4" ||
    template === "PICK5"
  );
}

function xmlDecode(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

function tagValue(xml: string, tag: string): string | null {
  const expression = new RegExp(
    `<(?:\\w+:)?${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:\\w+:)?${tag}>`,
    "i",
  );
  const match = xml.match(expression);
  if (!match) return null;
  return xmlDecode(match[1]).trim() || null;
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

function rawPayForRow(
  decodedPayload: string,
  row: AmtoteRaceResultRow,
): string | null {
  const blocks = allBlocks(decodedPayload, "raceresultinfo");

  const exact = blocks.find((block) => {
    const sort = Number(tagValue(block, "srt"));
    const poolCode = (tagValue(block, "tps") ?? "").trim().toUpperCase();
    const template = (tagValue(block, "tpl") ?? "")
      .trim()
      .toUpperCase()
      .replace(/[\s_-]+/g, "");
    const text = (tagValue(block, "txt") ?? "").trim();

    const rowPoolCode = (row.poolCode ?? "").trim().toUpperCase();
    const rowTemplate = (row.template ?? "")
      .trim()
      .toUpperCase()
      .replace(/[\s_-]+/g, "");
    const rowText = (row.text ?? "").trim();

    return (
      (row.sort === null || sort === row.sort) &&
      poolCode === rowPoolCode &&
      template === rowTemplate &&
      text === rowText
    );
  });

  if (!exact) return null;
  return tagValue(exact, "pay");
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const trackId = normalizeTrackId(searchParams.get("trackId"));
    const raceDate = normalizeRaceDate(searchParams.get("date"));
    const startRace = normalizeRaceNumber(searchParams.get("startRace"), 1);
    const endRace = normalizeRaceNumber(searchParams.get("endRace"), 17);

    if (!trackId) {
      return NextResponse.json(
        { success: false, error: "trackId must be WEM or TSE." },
        { status: 400 },
      );
    }

    if (!raceDate) {
      return NextResponse.json(
        { success: false, error: "date must be YYYY-MM-DD." },
        { status: 400 },
      );
    }

    if (!startRace || !endRace) {
      return NextResponse.json(
        {
          success: false,
          error: "startRace and endRace must be positive race numbers.",
        },
        { status: 400 },
      );
    }

    if (endRace < startRace) {
      return NextResponse.json(
        {
          success: false,
          error: "endRace must be greater than or equal to startRace.",
        },
        { status: 400 },
      );
    }

    if (endRace - startRace > 30) {
      return NextResponse.json(
        {
          success: false,
          error: "Diagnostic scan is limited to 31 races per request.",
        },
        { status: 400 },
      );
    }

    const raceNumbers = Array.from(
      { length: endRace - startRace + 1 },
      (_, index) => startRace + index,
    );

    const settled = await Promise.allSettled(
      raceNumbers.map((raceNumber) =>
        getAmtoteRaceResultDiagnostic(trackId, raceDate, raceNumber),
      ),
    );

    const races = settled.map((result, index) => {
      const raceNumber = raceNumbers[index];

      if (result.status === "rejected") {
        return {
          raceNumber,
          success: false,
          error:
            result.reason instanceof Error
              ? result.reason.message
              : String(result.reason),
          reportReady: false,
          multiRaceRows: [],
        };
      }

      return {
        raceNumber,
        success: true,
        reportReady: result.value.rows.length > 0,
        multiRaceRows: result.value.rows
          .filter(isMultiRaceRow)
          .map((row) => ({
            sort: row.sort,
            raceNumber: row.raceNumber,
            poolCode: row.poolCode,
            template: row.template,
            baseAmount: row.baseAmount,
            text: row.text,
            payout: row.payout,
            rawPay: rawPayForRow(result.value.decodedPayload, row),
          })),
      };
    });

    const multiRacePools = races.flatMap((race) =>
      race.multiRaceRows.map((row) => ({
        reportedOnRace: race.raceNumber,
        ...row,
      })),
    );

    const pick4Rows = multiRacePools.filter((row) => {
      const poolCode = (row.poolCode ?? "").trim().toUpperCase();
      const template = (row.template ?? "")
        .trim()
        .toUpperCase()
        .replace(/[\s_-]+/g, "");
      return poolCode === "P4" || template === "PICK4";
    });

    const pick5Rows = multiRacePools.filter((row) => {
      const poolCode = (row.poolCode ?? "").trim().toUpperCase();
      const template = (row.template ?? "")
        .trim()
        .toUpperCase()
        .replace(/[\s_-]+/g, "");
      return poolCode === "P5" || template === "PICK5";
    });

    return NextResponse.json({
      success: true,
      trackId,
      raceDate,
      startRace,
      endRace,
      racesChecked: raceNumbers.length,
      multiRacePoolCount: multiRacePools.length,
      pick4Count: pick4Rows.length,
      pick5Count: pick5Rows.length,
      pick4Rows,
      pick5Rows,
      multiRacePools,
      raceErrors: races
        .filter((race) => !race.success)
        .map((race) => ({
          raceNumber: race.raceNumber,
          error:
            "error" in race
              ? race.error
              : "Unknown race diagnostic error.",
        })),
    });
  } catch (error) {
    console.error("AMTote multi-race diagnostic scan failed:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown AMTote diagnostic error.",
      },
      { status: 500 },
    );
  }
}
