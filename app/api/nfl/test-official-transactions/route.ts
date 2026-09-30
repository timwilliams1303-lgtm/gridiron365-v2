import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 30;

type InjuryRow = {
  player: string;
  position: string | null;
  injury: string | null;
  practiceStatus: string | null;
  gameStatus: string | null;
  raw: string;
};

function decodeHtml(value: string) {
  return value
    .replace(/&#x27;/gi, "'")
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&amp;/gi, "&")
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function cleanText(value: string) {
  return decodeHtml(
    value
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]*>/g, " ")
  )
    .replace(/\s+/g, " ")
    .trim();
}

function parseInjuryRows(html: string): InjuryRow[] {
  const rows: InjuryRow[] = [];

  const trMatches =
    html.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi) ?? [];

  for (const tr of trMatches) {
    const cells = Array.from(
      tr.matchAll(
        /<(?:td|th)\b[^>]*>([\s\S]*?)<\/(?:td|th)>/gi
      )
    ).map((match) => cleanText(match[1] ?? ""));

    if (cells.length < 4) {
      continue;
    }

    const normalized = cells.map((cell) => cell.trim());

    const headerText = normalized
      .join(" ")
      .toLowerCase();

    if (
      headerText.includes("player") &&
      headerText.includes("position") &&
      headerText.includes("practice")
    ) {
      continue;
    }

    const player = normalized[0] ?? "";
    const position = normalized[1] || null;
    const injury = normalized[2] || null;
    const practiceStatus = normalized[3] || null;
    const gameStatus = normalized[4] || null;

    if (!player) {
      continue;
    }

    rows.push({
      player,
      position,
      injury,
      practiceStatus,
      gameStatus,
      raw: normalized.join(" | "),
    });
  }

  return rows;
}

export async function GET(request: Request) {
  const url = new URL(request.url);

  const requestedSeason =
    Number(url.searchParams.get("season")) || 2026;

  const requestedWeek =
    Number(url.searchParams.get("week")) || 3;

  const sourceUrl =
    `https://www.nfl.com/injuries/league/${requestedSeason}/reg${requestedWeek}`;

  try {
    const response = await fetch(sourceUrl, {
      method: "GET",

      headers: {
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",

        "User-Agent":
          "Mozilla/5.0 (compatible; Gridiron365/1.0)",
      },

      cache: "no-store",
      redirect: "follow",
    });

    const html = await response.text();

    const rows = parseInjuryRows(html);

    const fantasyPositions = new Set([
      "QB",
      "RB",
      "FB",
      "WR",
      "TE",
      "K",
    ]);

    const fantasyRows = rows.filter((row) =>
      row.position
        ? fantasyPositions.has(
            row.position.toUpperCase()
          )
        : false
    );

    const designatedRows = rows.filter((row) => {
      const status =
        row.gameStatus?.toLowerCase() ?? "";

      return (
        status.includes("out") ||
        status.includes("doubtful") ||
        status.includes("questionable")
      );
    });

    const achaneRows = rows.filter((row) =>
      row.player
        .toLowerCase()
        .includes("achane")
    );

    return NextResponse.json({
      success: response.ok,

      testOnly: true,
      databaseWrites: false,

      source: "NFL.com Official Injury Report",
      sourceUrl,

      season: requestedSeason,
      week: requestedWeek,

      fetchedAt: new Date().toISOString(),

      http: {
        status: response.status,
        statusText: response.statusText,
        contentType:
          response.headers.get("content-type"),
        finalUrl: response.url,
      },

      page: {
        htmlLength: html.length,

        containsPracticeStatus:
          html
            .toLowerCase()
            .includes("practice status"),

        containsGameStatus:
          html
            .toLowerCase()
            .includes("game status"),

        containsQuestionable:
          html
            .toLowerCase()
            .includes("questionable"),

        containsDoubtful:
          html
            .toLowerCase()
            .includes("doubtful"),

        containsOut:
          html
            .toLowerCase()
            .includes(">out<"),
      },

      parser: {
        rowsFound: rows.length,
        fantasyRowsFound: fantasyRows.length,
        designatedRowsFound:
          designatedRows.length,
      },

      achane: {
        found: achaneRows.length > 0,
        rows: achaneRows,
      },

      sampleDesignatedPlayers:
        designatedRows.slice(0, 20),

      sampleFantasyPlayers:
        fantasyRows.slice(0, 20),

      note: response.ok
        ? "NFL injury report was reachable from the G365 server."
        : "NFL injury report returned a non-success HTTP status.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,

        testOnly: true,
        databaseWrites: false,

        source:
          "NFL.com Official Injury Report",

        sourceUrl,

        error:
          error instanceof Error
            ? error.message
            : "Unknown fetch error.",
      },
      {
        status: 500,
      }
    );
  }
}