import { NextResponse } from "next/server";

export async function GET() {
  try {
    const url =
      "https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/2026/teams/16/depthcharts?lang=en&region=us";

    const response = await fetch(url, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/151 Safari/537.36",
      },
    });

    const text = await response.text();

    let payload: unknown = null;

    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }

    return NextResponse.json({
      success: response.ok,
      status: response.status,
      statusText: response.statusText,
      contentType: response.headers.get("content-type"),
      payload,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown error",
      },
      {
        status: 500,
      }
    );
  }
}