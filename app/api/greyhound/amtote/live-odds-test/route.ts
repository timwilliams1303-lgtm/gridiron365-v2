import { NextResponse } from "next/server";
import {
  getAmtoteGetTracksUSOControlDiagnostic,
  getAmtoteRawRacesDiagnostic,
} from "@/lib/greyhound/amtote";

export const dynamic = "force-dynamic";
export const maxDuration = 90;

function decodeXml(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function tagValue(block: string, tag: string): string | null {
  const match = block.match(
    new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"),
  );
  const value = match?.[1]?.trim();
  return value ? decodeXml(value) : null;
}

function tagBlocks(xml: string, tag: string): string[] {
  return Array.from(
    xml.matchAll(
      new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "gi"),
    ),
    (match) => match[1],
  );
}

function parseRaces(payload: string) {
  return tagBlocks(payload, "raceinfo").map((raceBlock) => {
    const runnerBlocks = tagBlocks(raceBlock, "runnersinfo");

    return {
      raceNumber: Number(tagValue(raceBlock, "rac") ?? 0),
      minutesToPost: tagValue(raceBlock, "mtp"),
      raceOff: tagValue(raceBlock, "rof"),
      result: tagValue(raceBlock, "res"),
      replay: tagValue(raceBlock, "rep"),
      odds: tagValue(raceBlock, "odd"),
      status: tagValue(raceBlock, "sts"),
      stop: tagValue(raceBlock, "stp"),
      signal: tagValue(raceBlock, "sig"),
      runners: runnerBlocks.map((runnerBlock) => ({
        post: tagValue(runnerBlock, "pst"),
        name: tagValue(runnerBlock, "nam"),
        morningLine: tagValue(runnerBlock, "mln"),
        odds: tagValue(runnerBlock, "odd"),
        scratched: tagValue(runnerBlock, "scr"),
      })),
    };
  });
}

function findTrackBlock(payload: string, trackId: string): string | null {
  const normalized = trackId.trim().toUpperCase();

  for (const tag of ["trackinfo", "track", "trkinfo", "trk"]) {
    for (const block of tagBlocks(payload, tag)) {
      const id =
        tagValue(block, "tid") ??
        tagValue(block, "trk") ??
        tagValue(block, "id");

      if (id?.trim().toUpperCase() === normalized) return block;
    }
  }

  const tidPattern = new RegExp(
    `<tid[^>]*>\\s*${normalized}\\s*<\\/tid>`,
    "i",
  );

  const index = payload.search(tidPattern);

  if (index >= 0) {
    const start = Math.max(0, index - 1000);
    const end = Math.min(payload.length, index + 3000);
    return payload.slice(start, end);
  }

  return null;
}

function controlFields(block: string | null) {
  if (!block) return null;

  return {
    tid: tagValue(block, "tid"),
    track: tagValue(block, "trk"),
    sport: tagValue(block, "spt"),
    currentRace: tagValue(block, "crc"),
    sts: tagValue(block, "sts"),
    sig: tagValue(block, "sig"),
    stp: tagValue(block, "stp"),
    ste: tagValue(block, "ste"),
    dun: tagValue(block, "dun"),
    mtp: tagValue(block, "mtp"),
    racesStart: tagValue(block, "rcs"),
    racesEnd: tagValue(block, "rce"),
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const track = (url.searchParams.get("track") ?? "U3Q")
      .trim()
      .toUpperCase();

    if (!/^[A-Z0-9]{2,4}$/.test(track)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid AmTote track id.",
        },
        { status: 400 },
      );
    }

    const samples: unknown[] = [];
    let previousKey = "";

    for (let i = 0; i < 30; i += 1) {
      const [controlDiagnostic, racesDiagnostic] = await Promise.all([
        getAmtoteGetTracksUSOControlDiagnostic(),
        getAmtoteRawRacesDiagnostic(track),
      ]);

      const trackBlock = findTrackBlock(
        controlDiagnostic.decodedPayload,
        track,
      );

      const control = controlFields(trackBlock);
      const races = parseRaces(racesDiagnostic.decodedPayload);

      const controlRaceNumber = Number(control?.currentRace ?? 0);

      const controlRace =
        controlRaceNumber > 0
          ? races.find(
              (race) => race.raceNumber === controlRaceNumber,
            ) ?? null
          : null;

      const oddsRace =
        races.find(
          (race) =>
            race.raceOff === "0" &&
            race.result === "0" &&
            race.odds &&
            race.odds.toLowerCase() !== "n/a",
        ) ?? null;

      const openRace =
        races.find(
          (race) =>
            race.raceOff === "0" &&
            race.result === "0",
        ) ?? null;

      const currentRace =
        controlRace ??
        oddsRace ??
        openRace ??
        null;

      const snapshot = {
        at: new Date().toISOString(),
        control: {
          track: control?.track ?? null,
          sport: control?.sport ?? null,
          crc: control?.currentRace ?? null,
          sts: control?.sts ?? null,
          sig: control?.sig ?? null,
          stp: control?.stp ?? null,
          ste: control?.ste ?? null,
          dun: control?.dun ?? null,
          mtp: control?.mtp ?? null,
        },
        race: currentRace
          ? {
              raceNumber: currentRace.raceNumber,
              mtp: currentRace.minutesToPost,
              rof: currentRace.raceOff,
              res: currentRace.result,
              rep: currentRace.replay,
              sts: currentRace.status,
              stp: currentRace.stop,
              sig: currentRace.signal,
              odds: currentRace.odds,
              runners: currentRace.runners,
            }
          : null,
      };

      const key = JSON.stringify({
        control: snapshot.control,
        race: snapshot.race,
      });

      if (key !== previousKey) {
        samples.push(snapshot);
        previousKey = key;
      }

      if (i < 29) {
        await sleep(2000);
      }
    }

    return NextResponse.json({
      success: true,
      track,
      durationSeconds: 60,
      intervalSeconds: 2,
      sampleCount: samples.length,
      finishedAt: new Date().toISOString(),
      samples,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 },
    );
  }
}