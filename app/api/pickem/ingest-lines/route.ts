import {
  NextResponse,
} from "next/server";

import {
  createClient,
} from "@supabase/supabase-js";


export const dynamic =
  "force-dynamic";

export const maxDuration =
  300;


type LineInput = {
  gameId?: number;
  sourceProvider?: string;
  sportsbookKey?: string;
  sportsbookName?: string | null;
  homeSpread?: number;
  awaySpread?: number | null;
  sourceEventId?: string | null;
  sourceMarketKey?: string | null;
  rawAudit?: unknown;
  capturedAt?: string | null;
};


type RequestBody = {
  lines?: LineInput[];
};


type GameRow = {
  id: number;
  kickoff_at: string;
  is_started: boolean;
  is_final: boolean;
  spread_status: string;
};


function createAdminClient() {
  const url =
    process.env
      .NEXT_PUBLIC_SUPABASE_URL;

  const key =
    process.env
      .SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing Supabase server environment variables."
    );
  }

  return createClient(
    url,
    key,
    {
      auth: {
        persistSession:
          false,
        autoRefreshToken:
          false,
        detectSessionInUrl:
          false,
      },
    }
  );
}


function authorized(
  request:
    Request
) {
  const expected =
    process.env
      .NFL_SYNC_SECRET ??
    process.env
      .GRIDIRON_SYNC_SECRET;

  if (!expected) {
    return false;
  }

  const header =
    request.headers.get(
      "x-gridiron-sync-secret"
    );

  const auth =
    request.headers.get(
      "authorization"
    );

  const bearer =
    auth?.startsWith(
      "Bearer "
    )
      ? auth.slice(7)
      : null;

  return (
    header === expected ||
    bearer === expected
  );
}


function cleanText(
  value:
    string |
    null |
    undefined,
  maxLength:
    number
) {
  const clean =
    value?.trim() ??
    "";

  if (
    !clean ||
    clean.length >
      maxLength
  ) {
    return null;
  }

  return clean;
}


export async function POST(
  request:
    Request
) {
  if (
    !authorized(
      request
    )
  ) {
    return NextResponse.json(
      {
        success:
          false,
        error:
          "Unauthorized Pick'em line ingestion request.",
      },
      {
        status:
          401,
      }
    );
  }

  try {
    const body =
      (
        await request.json()
      ) as RequestBody;

    const lines =
      Array.isArray(
        body.lines
      )
        ? body.lines
        : [];

    if (
      lines.length <
        1 ||
      lines.length >
        500
    ) {
      return NextResponse.json(
        {
          success:
            false,
          error:
            "Provide between 1 and 500 normalized line records.",
        },
        {
          status:
            400,
        }
      );
    }

    const supabase =
      createAdminClient();

    const gameIds =
      [
        ...new Set(
          lines.map(
            (line) =>
              Number(
                line.gameId
              )
          )
        ),
      ].filter(
        (
          value
        ) =>
          Number.isInteger(
            value
          ) &&
          value >
            0
      );

    if (
      gameIds.length ===
      0
    ) {
      return NextResponse.json(
        {
          success:
            false,
          error:
            "Every line requires a valid Pick'em gameId.",
        },
        {
          status:
            400,
        }
      );
    }

    const {
      data:
        gameData,
      error:
        gameError,
    } =
      await supabase
        .from(
          "pickem_games"
        )
        .select(
          "id,kickoff_at,is_started,is_final,spread_status"
        )
        .in(
          "id",
          gameIds
        );

    if (
      gameError
    ) {
      throw new Error(
        gameError.message
      );
    }

    const gameMap =
      new Map<
        number,
        GameRow
      >(
        (
          gameData ??
          []
        ).map(
          (row) => [
            row.id,
            row as GameRow,
          ]
        )
      );

    const insertRows:
      Array<
        Record<
          string,
          unknown
        >
      > = [];

    for (
      const input
      of lines
    ) {
      const gameId =
        Number(
          input.gameId
        );

      const game =
        gameMap.get(
          gameId
        );

      if (!game) {
        throw new Error(
          `Pick'em game ${gameId} could not be found.`
        );
      }

      if (
        game.spread_status ===
        "frozen"
      ) {
        throw new Error(
          `Pick'em game ${gameId} already has a frozen G365 Spread.`
        );
      }

      if (
        game.is_started ||
        game.is_final ||
        Date.now() >=
          new Date(
            game.kickoff_at
          ).getTime()
      ) {
        throw new Error(
          `Pick'em game ${gameId} has already reached kickoff.`
        );
      }

      const provider =
        cleanText(
          input.sourceProvider,
          80
        );

      const bookKey =
        cleanText(
          input.sportsbookKey,
          100
        );

      const spread =
        Number(
          input.homeSpread
        );

      if (
        !provider ||
        !bookKey ||
        !Number.isFinite(
          spread
        ) ||
        spread <
          -100 ||
        spread >
          100
      ) {
        throw new Error(
          `Invalid normalized source line for game ${gameId}.`
        );
      }

      const away =
        input.awaySpread ===
          null ||
        input.awaySpread ===
          undefined
          ? null
          : Number(
              input.awaySpread
            );

      if (
        away !==
          null &&
        !Number.isFinite(
          away
        )
      ) {
        throw new Error(
          `Invalid away spread for game ${gameId}.`
        );
      }

      const captured =
        input.capturedAt
          ? new Date(
              input.capturedAt
            )
          : new Date();

      if (
        Number.isNaN(
          captured.getTime()
        )
      ) {
        throw new Error(
          `Invalid capturedAt for game ${gameId}.`
        );
      }

      insertRows.push({
        pickem_game_id:
          gameId,
        captured_at:
          captured.toISOString(),
        source_provider:
          provider,
        sportsbook_key:
          bookKey,
        sportsbook_name:
          cleanText(
            input.sportsbookName,
            120
          ),
        home_spread:
          spread,
        away_spread:
          away,
        source_event_id:
          cleanText(
            input.sourceEventId,
            160
          ),
        source_market_key:
          cleanText(
            input.sourceMarketKey,
            160
          ),
        raw_audit:
          input.rawAudit ??
          null,
      });
    }

    const {
      error:
        insertError,
    } =
      await supabase
        .from(
          "pickem_line_sources"
        )
        .insert(
          insertRows
        );

    if (
      insertError
    ) {
      throw new Error(
        insertError.message
      );
    }

    return NextResponse.json({
      success:
        true,
      providerNeutral:
        true,
      linesIngested:
        insertRows.length,
      gamesTouched:
        new Set(
          insertRows.map(
            (row) =>
              row.pickem_game_id
          )
        ).size,
    });
  } catch (
    error
  ) {
    console.error(
      "Pick'em line ingestion failed:",
      error
    );

    return NextResponse.json(
      {
        success:
          false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown Pick'em line ingestion error.",
      },
      {
        status:
          500,
      }
    );
  }
}
