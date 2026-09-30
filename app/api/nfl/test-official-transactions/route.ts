import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 30;

type TransactionRow = {
  date: string | null;
  name: string | null;
  transaction: string | null;
  raw: string;
};

function cleanText(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractRows(html: string): TransactionRow[] {
  const rows: TransactionRow[] = [];

  const trMatches =
    html.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi) ?? [];

  for (const tr of trMatches) {
    const cells = Array.from(
      tr.matchAll(
        /<(?:td|th)\b[^>]*>([\s\S]*?)<\/(?:td|th)>/gi
      )
    ).map((match) => cleanText(match[1] ?? ""));

    if (cells.length < 2) {
      continue;
    }

    const raw = cells.join(" | ");

    const date =
      cells.find((value) =>
        /^\d{1,2}\/\d{1,2}$/.test(value)
      ) ?? null;

    const transaction =
      cells.find((value) =>
        /reserve\/|injured|pup|nfi|suspend|activate/i.test(
          value
        )
      ) ?? null;

    let name: string | null = null;

    if (date) {
      const dateIndex = cells.indexOf(date);

      for (
        let index = dateIndex + 1;
        index < cells.length;
        index += 1
      ) {
        const candidate = cells[index];

        if (
          !candidate ||
          candidate === transaction ||
          /^\d{1,2}\/\d{1,2}$/.test(candidate)
        ) {
          continue;
        }

        if (
          /reserve\/|injured|pup|nfi|suspend|activate/i.test(
            candidate
          )
        ) {
          continue;
        }

        name = candidate;
        break;
      }
    }

    if (
      date ||
      transaction ||
      /achane/i.test(raw)
    ) {
      rows.push({
        date,
        name,
        transaction,
        raw,
      });
    }
  }

  return rows;
}

export async function GET() {
  const now = new Date();

  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;

  const sourceUrl =
    `https://www.nfl.com/transactions/league/reserve-list/${year}/${month}`;

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

    const rows = extractRows(html);

    const achaneRows = rows.filter((row) =>
      row.raw
        .toLowerCase()
        .includes("achane")
    );

    const reserveInjuredRows =
      rows.filter((row) =>
        row.raw
          .toLowerCase()
          .includes("reserve/injured")
      );

    const containsAchaneAnywhere =
      html
        .toLowerCase()
        .includes("achane");

    const containsReserveInjured =
      html
        .toLowerCase()
        .includes("reserve/injured");

    return NextResponse.json({
      success: response.ok,

      testOnly: true,

      databaseWrites: false,

      source: "NFL.com",

      sourceUrl,

      fetchedAt:
        new Date().toISOString(),

      http: {
        status: response.status,
        statusText:
          response.statusText,
        contentType:
          response.headers.get(
            "content-type"
          ),
        finalUrl: response.url,
      },

      page: {
        htmlLength: html.length,
        containsReserveInjured,
        containsAchaneAnywhere,
      },

      parser: {
        rowsFound: rows.length,
        reserveInjuredRowsFound:
          reserveInjuredRows.length,
      },

      achane: {
        found:
          achaneRows.length > 0 ||
          containsAchaneAnywhere,

        rows: achaneRows,
      },

      sampleTransactions:
        reserveInjuredRows.slice(
          0,
          15
        ),

      note:
        response.ok
          ? "NFL page was reachable from the G365 server."
          : "NFL page returned a non-success HTTP status.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,

        testOnly: true,

        databaseWrites: false,

        source: "NFL.com",

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