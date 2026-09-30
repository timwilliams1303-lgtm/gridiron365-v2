import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

type NflPlayer = {
  id: number;
  espn_player_id: string | null;
  full_name: string;
  primary_position: string;
  team_abbreviation: string | null;
};

type ExistingInjury = {
  id: number;
  nfl_player_id: number;
  status: string | null;
  injury_type: string | null;
  injury_location: string | null;
  injury_detail: string | null;
  injury_date: string | null;
  return_date: string | null;
  official_roster_status: string | null;
  official_game_status: string | null;
  official_practice_status: string | null;
  official_injury: string | null;
  official_source: string | null;
  official_transaction_type: string | null;
  official_transaction_date: string | null;
};

type InjuryReportRecord = {
  name: string;
  team: string | null;
  position: string | null;
  injury: string | null;
  practiceStatus: string | null;
  gameStatus: string | null;
};

type TransactionRecord = {
  name: string;
  team: string | null;
  date: string;
  transaction: string;
  rosterStatus: string | null;
  clearsReserve: boolean;
};

type CurrentOfficialState = {
  player: NflPlayer;
  rosterStatus: string | null;
  gameStatus: string | null;
  practiceStatus: string | null;
  injury: string | null;
  transactionType: string | null;
  transactionDate: string | null;
  source: string;
};

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Missing Supabase server environment variables.");
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

function authorizeSync(request: Request) {
  const supplied = request.headers.get("x-gridiron-sync-secret");

  const secrets = [
    process.env.GRIDIRON_SYNC_SECRET,
    process.env.NFL_SYNC_SECRET,
  ].filter((value): value is string => Boolean(value?.trim()));

  if (!secrets.length) {
    return NextResponse.json(
      {
        success: false,
        error: "No Gridiron365 sync secret is configured on the server.",
      },
      { status: 500 }
    );
  }

  if (!supplied || !secrets.includes(supplied)) {
    return NextResponse.json(
      {
        success: false,
        error: "Unauthorized injury sync request.",
      },
      { status: 401 }
    );
  }

  return null;
}

function decodeHtml(value: string) {
  return value
    .replace(/&#x27;|&#39;|&apos;/gi, "'")
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&amp;/gi, "&")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#x2F;/gi, "/")
    .replace(/&#(\d+);/g, (_, code) =>
      String.fromCharCode(Number(code))
    )
    .replace(/&#x([0-9a-f]+);/gi, (_, code) =>
      String.fromCharCode(parseInt(code, 16))
    );
}

function stripHtml(value: string) {
  return decodeHtml(
    value
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function normalizeName(value: string) {
  return decodeHtml(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’‘`]/g, "'")
    .replace(/\b(jr|sr|ii|iii|iv|v)\.?\b/gi, "")
    .replace(/[^a-z0-9]/gi, "")
    .toLowerCase();
}

function normalizeTeam(value: string | null | undefined) {
  const text = (value ?? "").trim().toUpperCase();

  if (!text) return null;

  const aliases: Record<string, string> = {
    ARIZONA: "ARI",
    CARDINALS: "ARI",
    ATLANTA: "ATL",
    FALCONS: "ATL",
    BALTIMORE: "BAL",
    RAVENS: "BAL",
    BUFFALO: "BUF",
    BILLS: "BUF",
    CAROLINA: "CAR",
    PANTHERS: "CAR",
    CHICAGO: "CHI",
    BEARS: "CHI",
    CINCINNATI: "CIN",
    BENGALS: "CIN",
    CLEVELAND: "CLE",
    BROWNS: "CLE",
    DALLAS: "DAL",
    COWBOYS: "DAL",
    DENVER: "DEN",
    BRONCOS: "DEN",
    DETROIT: "DET",
    LIONS: "DET",
    "GREEN BAY": "GB",
    PACKERS: "GB",
    HOUSTON: "HOU",
    TEXANS: "HOU",
    INDIANAPOLIS: "IND",
    COLTS: "IND",
    JACKSONVILLE: "JAX",
    JAGUARS: "JAX",
    "KANSAS CITY": "KC",
    CHIEFS: "KC",
    "LAS VEGAS": "LV",
    RAIDERS: "LV",
    "LOS ANGELES CHARGERS": "LAC",
    CHARGERS: "LAC",
    "LOS ANGELES RAMS": "LAR",
    RAMS: "LAR",
    MIAMI: "MIA",
    DOLPHINS: "MIA",
    MINNESOTA: "MIN",
    VIKINGS: "MIN",
    "NEW ENGLAND": "NE",
    PATRIOTS: "NE",
    "NEW ORLEANS": "NO",
    SAINTS: "NO",
    "NEW YORK GIANTS": "NYG",
    GIANTS: "NYG",
    "NEW YORK JETS": "NYJ",
    JETS: "NYJ",
    PHILADELPHIA: "PHI",
    EAGLES: "PHI",
    PITTSBURGH: "PIT",
    STEELERS: "PIT",
    "SAN FRANCISCO": "SF",
    "49ERS": "SF",
    SEATTLE: "SEA",
    SEAHAWKS: "SEA",
    "TAMPA BAY": "TB",
    BUCCANEERS: "TB",
    TENNESSEE: "TEN",
    TITANS: "TEN",
    WASHINGTON: "WAS",
    COMMANDERS: "WAS",
  };

  return aliases[text] ?? text;
}

function normalizePosition(value: string | null | undefined) {
  const position = (value ?? "").trim().toUpperCase();

  if (position === "PK") return "K";
  if (position === "FB") return "RB";

  return position || null;
}

function normalizeGameStatus(value: string | null | undefined) {
  const text = (value ?? "").trim().toLowerCase();

  if (text === "out") return "Out";
  if (text === "doubtful") return "Doubtful";
  if (text === "questionable") return "Questionable";

  return null;
}

function normalizePracticeStatus(value: string | null | undefined) {
  const text = (value ?? "").trim();

  if (!text) return null;

  const lower = text.toLowerCase();

  if (lower.includes("did not participate")) return "DNP";
  if (lower.includes("limited participation")) return "Limited";
  if (lower.includes("full participation")) return "Full";

  return text;
}

function normalizeTransactionStatus(transaction: string) {
  const text = transaction.toLowerCase();

  if (
    text.includes("reserve/injured") ||
    text.includes("reserve injured") ||
    text.includes("injured reserve")
  ) {
    return "IR";
  }

  if (
    text.includes("physically unable to perform") ||
    text.includes("reserve/pup") ||
    /\bpup\b/.test(text)
  ) {
    return "PUP";
  }

  if (
    text.includes("non-football injury") ||
    text.includes("non football injury") ||
    text.includes("reserve/nfi") ||
    /\bnfi\b/.test(text)
  ) {
    return "NFI";
  }

  if (text.includes("suspend")) {
    return "Suspended";
  }

  return null;
}

function transactionClearsReserve(transaction: string) {
  const text = transaction.toLowerCase();

  return [
    "activated",
    "activate",
    "returned to active",
    "return to active",
    "removed from reserve",
    "removed from injured reserve",
    "removed from physically unable",
    "removed from non-football",
  ].some((phrase) => text.includes(phrase));
}

function currentStatus(state: CurrentOfficialState) {
  if (state.rosterStatus) return state.rosterStatus;
  if (state.gameStatus) return state.gameStatus;

  return null;
}

function parseTransactionDate(value: string, season: number) {
  const match = value.match(/^(\d{1,2})\/(\d{1,2})$/);

  if (!match) return null;

  const month = Number(match[1]);
  const day = Number(match[2]);

  if (!month || !day) return null;

  return `${season}-${String(month).padStart(2, "0")}-${String(day).padStart(
    2,
    "0"
  )}`;
}

function findPlayer(
  playersByName: Map<string, NflPlayer[]>,
  name: string,
  team?: string | null,
  position?: string | null
) {
  const candidates = playersByName.get(normalizeName(name)) ?? [];

  if (!candidates.length) return null;

  /*
   * An exact normalized name with one database player is enough.
   * This is important for NFL transaction rows where NFL.com may
   * not expose the team cleanly in the parsed table.
   */
  if (candidates.length === 1) {
    return candidates[0];
  }

  const normalizedTeam = normalizeTeam(team);

  if (normalizedTeam) {
    const teamMatches = candidates.filter(
      (player) =>
        normalizeTeam(player.team_abbreviation) === normalizedTeam
    );

    if (teamMatches.length === 1) {
      return teamMatches[0];
    }

    const normalizedPosition = normalizePosition(position);

    if (normalizedPosition) {
      const exact = teamMatches.filter(
        (player) =>
          normalizePosition(player.primary_position) === normalizedPosition
      );

      if (exact.length === 1) {
        return exact[0];
      }
    }
  }

  const normalizedPosition = normalizePosition(position);

  if (normalizedPosition) {
    const positionMatches = candidates.filter(
      (player) =>
        normalizePosition(player.primary_position) === normalizedPosition
    );

    if (positionMatches.length === 1) {
      return positionMatches[0];
    }
  }

  /*
   * Multiple database players still match and we cannot safely
   * disambiguate them. Do not guess.
   */
  return null;
}

function extractRows(html: string) {
  const rows: string[][] = [];

  const trRegex = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  let trMatch: RegExpExecArray | null;

  while ((trMatch = trRegex.exec(html))) {
    const cells: string[] = [];

    const cellRegex = /<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi;
    let cellMatch: RegExpExecArray | null;

    while ((cellMatch = cellRegex.exec(trMatch[1]))) {
      cells.push(stripHtml(cellMatch[1]));
    }

    if (cells.length) {
      rows.push(cells);
    }
  }

  return rows;
}

function parseInjuryReport(html: string): InjuryReportRecord[] {
  const rows = extractRows(html);
  const records: InjuryReportRecord[] = [];

  for (const cells of rows) {
    const cleaned = cells
      .map((cell) => cell.trim())
      .filter(Boolean);

    if (cleaned.length < 3) continue;

    const positionIndex = cleaned.findIndex((cell) =>
      /^(QB|RB|FB|WR|TE|K|PK|C|G|T|OL|DL|DE|DT|LB|CB|S|DB|LS)$/i.test(
        cell
      )
    );

    if (positionIndex <= 0) continue;

    const name = cleaned[positionIndex - 1];
    const position = cleaned[positionIndex];

    if (!name || /player/i.test(name)) continue;

    const after = cleaned.slice(positionIndex + 1);

    const practiceIndex = after.findIndex((cell) =>
      /did not participate|limited participation|full participation/i.test(
        cell
      )
    );

    const gameIndex = after.findIndex((cell) =>
      /^(out|doubtful|questionable)$/i.test(cell)
    );

    const injury =
      after.find(
        (cell, index) =>
          index !== practiceIndex &&
          index !== gameIndex &&
          !/^(out|doubtful|questionable)$/i.test(cell) &&
          !/participation in practice/i.test(cell)
      ) ?? null;

    let team: string | null = null;

    for (let i = 0; i < positionIndex - 1; i++) {
      const candidate = normalizeTeam(cleaned[i]);

      if (candidate && candidate.length <= 3) {
        team = candidate;
        break;
      }
    }

    records.push({
      name,
      team,
      position: normalizePosition(position),
      injury,
      practiceStatus:
        practiceIndex >= 0
          ? normalizePracticeStatus(after[practiceIndex])
          : null,
      gameStatus:
        gameIndex >= 0
          ? normalizeGameStatus(after[gameIndex])
          : null,
    });
  }

  return records;
}

function parseTransactions(
  html: string,
  season: number
): TransactionRecord[] {
  const rows = extractRows(html);
  const records: TransactionRecord[] = [];

  for (const cells of rows) {
    const cleaned = cells
      .map((cell) => cell.trim())
      .filter(Boolean);

    const dateIndex = cleaned.findIndex((cell) =>
      /^\d{1,2}\/\d{1,2}$/.test(cell)
    );

    if (dateIndex < 0 || cleaned.length < dateIndex + 3) {
      continue;
    }

    const date = parseTransactionDate(cleaned[dateIndex], season);

    if (!date) continue;

    const name = cleaned[dateIndex + 1];
    const transaction = cleaned
      .slice(dateIndex + 2)
      .join(" ")
      .trim();

    if (!name || !transaction) continue;

    const rosterStatus =
      normalizeTransactionStatus(transaction);

    const clearsReserve =
      transactionClearsReserve(transaction);

    if (!rosterStatus && !clearsReserve) {
      continue;
    }

    let team: string | null = null;

    for (let i = 0; i < dateIndex; i++) {
      const candidate = normalizeTeam(cleaned[i]);

      if (candidate && candidate.length <= 3) {
        team = candidate;
        break;
      }
    }

    records.push({
      name,
      team,
      date,
      transaction,
      rosterStatus,
      clearsReserve,
    });
  }

  return records;
}

async function fetchHtml(url: string) {
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "User-Agent":
        "Mozilla/5.0 (compatible; Gridiron365/1.0; +https://www.gridiron365fantasy.com)",
    },
  });

  if (!response.ok) {
    throw new Error(
      `NFL.com returned HTTP ${response.status} for ${url}`
    );
  }

  return response.text();
}

/*
 * Determine the current NFL regular-season week from the G365
 * schedule instead of probing NFL.com future-week URLs.
 *
 * We use a window that includes the recently completed games
 * plus the upcoming games. The week represented by the most
 * games in that window is treated as the current fantasy week.
 */
async function getCurrentRegularSeasonWeek(
  supabase: ReturnType<typeof getAdminClient>,
  season: number
) {
  const now = new Date();

  const lookback = new Date(
    now.getTime() - 4 * 24 * 60 * 60 * 1000
  ).toISOString();

  const lookahead = new Date(
    now.getTime() + 7 * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data, error } = await supabase
    .from("nfl_games")
    .select("week, game_date")
    .eq("season", season)
    .gte("game_date", lookback)
    .lte("game_date", lookahead)
    .order("game_date", { ascending: true });

  if (error) {
    throw new Error(
      `Unable to determine current NFL week: ${error.message}`
    );
  }

  const games = data ?? [];

  if (!games.length) {
    throw new Error(
      "No NFL games found near the current date."
    );
  }

  const weekCounts = new Map<number, number>();

  for (const game of games) {
    const week = Number(game.week);

    if (
      !Number.isFinite(week) ||
      week < 1 ||
      week > 18
    ) {
      continue;
    }

    weekCounts.set(
      week,
      (weekCounts.get(week) ?? 0) + 1
    );
  }

  const week = Array.from(weekCounts.entries())
    .sort((a, b) => {
      if (b[1] !== a[1]) {
        return b[1] - a[1];
      }

      return b[0] - a[0];
    })[0]?.[0];

  if (!week) {
    throw new Error(
      "Unable to determine current NFL regular-season week."
    );
  }

  const url =
    `https://www.nfl.com/injuries/league/${season}/reg${week}`;

  const html = await fetchHtml(url);

  const records = parseInjuryReport(html);

  if (!records.length) {
    throw new Error(
      `NFL.com returned no usable injury records for season ${season}, week ${week}.`
    );
  }

  return {
    week,
    url,
    html,
    records,
  };
}

function injuryFingerprint(
  state: CurrentOfficialState
) {
  return JSON.stringify({
    status: currentStatus(state),
    rosterStatus: state.rosterStatus,
    gameStatus: state.gameStatus,
    practiceStatus: state.practiceStatus,
    injury: state.injury,
    transactionType: state.transactionType,
    transactionDate: state.transactionDate,
  });
}

function existingFingerprint(
  row: ExistingInjury
) {
  return JSON.stringify({
    status: row.status,
    rosterStatus: row.official_roster_status,
    gameStatus: row.official_game_status,
    practiceStatus: row.official_practice_status,
    injury: row.official_injury,
    transactionType: row.official_transaction_type,
    transactionDate: row.official_transaction_date,
  });
}

export async function POST(request: Request) {
  const unauthorized = authorizeSync(request);

  if (unauthorized) {
    return unauthorized;
  }

  const startedAt = Date.now();
  const now = new Date().toISOString();
  const season = new Date().getFullYear();
  const supabase = getAdminClient();

  try {
    const {
      data: playerRows,
      error: playerError,
    } = await supabase
      .from("nfl_players")
      .select(
        "id, espn_player_id, full_name, primary_position, team_abbreviation"
      );

    if (playerError) {
      throw new Error(
        `Unable to load NFL players: ${playerError.message}`
      );
    }

    const players: NflPlayer[] = (
      playerRows ?? []
    ).map((row) => ({
      id: Number(row.id),
      espn_player_id: row.espn_player_id
        ? String(row.espn_player_id)
        : null,
      full_name: String(row.full_name ?? ""),
      primary_position: String(
        row.primary_position ?? ""
      ),
      team_abbreviation:
        row.team_abbreviation
          ? String(row.team_abbreviation)
          : null,
    }));

    /*
     * These are the positions whose nfl_players.status field
     * feeds the fantasy interface.
     */
    const fantasyPositions = new Set([
      "QB",
      "RB",
      "WR",
      "TE",
      "K",
    ]);

    const fantasyPlayers = players.filter(
      (player) =>
        fantasyPositions.has(
          normalizePosition(
            player.primary_position
          ) ?? ""
        )
    );

    /*
     * IMPORTANT:
     * Match NFL.com records against ALL NFL players.
     *
     * The previous version indexed fantasyPlayers only.
     * Official NFL transactions should not depend on that
     * filter, and unique normalized names can safely match
     * even when NFL.com does not provide a parsed team.
     */
    const playersByName =
      new Map<string, NflPlayer[]>();

    for (const player of players) {
      const key = normalizeName(
        player.full_name
      );

      if (!key) continue;

      const list =
        playersByName.get(key) ?? [];

      list.push(player);

      playersByName.set(
        key,
        list
      );
    }

    const injuryReport =
      await getCurrentRegularSeasonWeek(
        supabase,
        season
      );

    const transactionUrl =
      `https://www.nfl.com/transactions/league/reserve-list/${season}/${new Date().getMonth() + 1}`;

    const transactionHtml =
      await fetchHtml(transactionUrl);

    const transactions =
      parseTransactions(
        transactionHtml,
        season
      );

    if (!injuryReport.records.length) {
      throw new Error(
        "Official NFL injury report returned no usable records. Database left unchanged."
      );
    }

    const states =
      new Map<
        number,
        CurrentOfficialState
      >();

    const unmatchedInjuries:
      InjuryReportRecord[] = [];

    const unmatchedTransactions:
      TransactionRecord[] = [];

    /*
     * Build weekly injury-report state.
     */
    for (
      const record of
      injuryReport.records
    ) {
      const player = findPlayer(
        playersByName,
        record.name,
        record.team,
        record.position
      );

      if (!player) {
        unmatchedInjuries.push(
          record
        );

        continue;
      }

      if (
        !record.gameStatus &&
        !record.practiceStatus &&
        !record.injury
      ) {
        continue;
      }

      const existing =
        states.get(player.id);

      states.set(player.id, {
        player,
        rosterStatus:
          existing?.rosterStatus ??
          null,
        gameStatus:
          record.gameStatus,
        practiceStatus:
          record.practiceStatus,
        injury:
          record.injury,
        transactionType:
          existing?.transactionType ??
          null,
        transactionDate:
          existing?.transactionDate ??
          null,
        source:
          "NFL.com Official Injury Report",
      });
    }

    /*
     * Match the latest reserve-list transaction for each
     * NFL player.
     */
    const latestTransactionByPlayer =
      new Map<
        number,
        TransactionRecord
      >();

    for (
      const transaction of
      transactions
    ) {
      const player = findPlayer(
        playersByName,
        transaction.name,
        transaction.team
      );

      if (!player) {
        unmatchedTransactions.push(
          transaction
        );

        continue;
      }

      const previous =
        latestTransactionByPlayer.get(
          player.id
        );

      if (
        !previous ||
        transaction.date >
          previous.date
      ) {
        latestTransactionByPlayer.set(
          player.id,
          transaction
        );
      }
    }

    /*
     * Merge official transactions over the weekly report.
     *
     * Use ALL players here rather than fantasyPlayers.
     */
    for (
      const [
        playerId,
        transaction,
      ] of
      latestTransactionByPlayer
    ) {
      const player =
        players.find(
          (item) =>
            item.id === playerId
        );

      if (!player) continue;

      const existing =
        states.get(playerId);

      if (
        transaction.clearsReserve
      ) {
        if (existing) {
          states.set(playerId, {
            ...existing,
            rosterStatus: null,
            transactionType:
              transaction.transaction,
            transactionDate:
              transaction.date,
            source:
              "NFL.com Official Transactions + Official Injury Report",
          });
        }

        continue;
      }

      if (
        !transaction.rosterStatus
      ) {
        continue;
      }

      states.set(playerId, {
        player,
        rosterStatus:
          transaction.rosterStatus,
        gameStatus:
          existing?.gameStatus ??
          null,
        practiceStatus:
          existing?.practiceStatus ??
          null,
        injury:
          existing?.injury ??
          null,
        transactionType:
          transaction.transaction,
        transactionDate:
          transaction.date,
        source: existing
          ? "NFL.com Official Transactions + Official Injury Report"
          : "NFL.com Official Transactions",
      });
    }

    const {
      data: existingRows,
      error: existingError,
    } = await supabase
      .from(
        "nfl_player_injuries"
      )
      .select(`
        id,
        nfl_player_id,
        status,
        injury_type,
        injury_location,
        injury_detail,
        injury_date,
        return_date,
        official_roster_status,
        official_game_status,
        official_practice_status,
        official_injury,
        official_source,
        official_transaction_type,
        official_transaction_date
      `)
      .eq("season", season)
      .eq("is_active", true);

    if (existingError) {
      throw new Error(
        `Unable to load current injuries: ${existingError.message}`
      );
    }

    const existingByPlayer =
      new Map<
        number,
        ExistingInjury
      >();

    for (
      const row of
      existingRows ?? []
    ) {
      existingByPlayer.set(
        Number(
          row.nfl_player_id
        ),
        {
          id: Number(row.id),
          nfl_player_id: Number(
            row.nfl_player_id
          ),
          status: row.status
            ? String(row.status)
            : null,
          injury_type:
            row.injury_type
              ? String(
                  row.injury_type
                )
              : null,
          injury_location:
            row.injury_location
              ? String(
                  row.injury_location
                )
              : null,
          injury_detail:
            row.injury_detail
              ? String(
                  row.injury_detail
                )
              : null,
          injury_date:
            row.injury_date
              ? String(
                  row.injury_date
                )
              : null,
          return_date:
            row.return_date
              ? String(
                  row.return_date
                )
              : null,
          official_roster_status:
            row.official_roster_status
              ? String(
                  row.official_roster_status
                )
              : null,
          official_game_status:
            row.official_game_status
              ? String(
                  row.official_game_status
                )
              : null,
          official_practice_status:
            row.official_practice_status
              ? String(
                  row.official_practice_status
                )
              : null,
          official_injury:
            row.official_injury
              ? String(
                  row.official_injury
                )
              : null,
          official_source:
            row.official_source
              ? String(
                  row.official_source
                )
              : null,
          official_transaction_type:
            row.official_transaction_type
              ? String(
                  row.official_transaction_type
                )
              : null,
          official_transaction_date:
            row.official_transaction_date
              ? String(
                  row.official_transaction_date
                )
              : null,
        }
      );
    }

    let inserted = 0;
    let changed = 0;
    let unchanged = 0;
    let cleared = 0;

    const activeOfficialPlayerIds =
      new Set<number>();

    /*
     * Write current official injury state.
     */
    for (
      const state of
      states.values()
    ) {
      const status =
        currentStatus(state);

      if (!status) continue;

      activeOfficialPlayerIds.add(
        state.player.id
      );

      const existing =
        existingByPlayer.get(
          state.player.id
        );

      const payload = {
        nfl_player_id:
          state.player.id,
        espn_player_id:
          state.player
            .espn_player_id,
        season,
        status,
        injury_type:
          state.injury,
        injury_location:
          state.injury,
        injury_detail:
          state.practiceStatus
            ? `${
                state.injury ??
                "Injury"
              } — ${
                state.practiceStatus
              }`
            : state.injury,
        injury_date:
          state.transactionDate,
        return_date: null,
        source_updated_at:
          now,
        official_roster_status:
          state.rosterStatus,
        official_game_status:
          state.gameStatus,
        official_practice_status:
          state.practiceStatus,
        official_injury:
          state.injury,
        official_source:
          state.source,
        official_transaction_type:
          state.transactionType,
        official_transaction_date:
          state.transactionDate,
        official_last_synced_at:
          now,
      };

      if (!existing) {
        const { error } =
          await supabase
            .from(
              "nfl_player_injuries"
            )
            .insert({
              ...payload,
              is_active: true,
              first_seen_at:
                now,
              last_seen_at:
                now,
              created_at:
                now,
              updated_at:
                now,
            });

        if (error) {
          throw new Error(
            `Unable to insert official injury for ${state.player.full_name}: ${error.message}`
          );
        }

        inserted++;

        continue;
      }

      if (
        existingFingerprint(
          existing
        ) ===
        injuryFingerprint(state)
      ) {
        const { error } =
          await supabase
            .from(
              "nfl_player_injuries"
            )
            .update({
              last_seen_at:
                now,
              source_updated_at:
                now,
              official_last_synced_at:
                now,
              official_source:
                state.source,
              updated_at:
                now,
            })
            .eq(
              "id",
              existing.id
            );

        if (error) {
          throw new Error(
            `Unable to refresh ${state.player.full_name}: ${error.message}`
          );
        }

        unchanged++;

        continue;
      }

      const {
        error: closeError,
      } = await supabase
        .from(
          "nfl_player_injuries"
        )
        .update({
          is_active: false,
          last_seen_at: now,
          updated_at: now,
        })
        .eq(
          "id",
          existing.id
        );

      if (closeError) {
        throw new Error(
          `Unable to close old injury for ${state.player.full_name}: ${closeError.message}`
        );
      }

      const {
        error: insertError,
      } = await supabase
        .from(
          "nfl_player_injuries"
        )
        .insert({
          ...payload,
          is_active: true,
          first_seen_at:
            now,
          last_seen_at:
            now,
          created_at:
            now,
          updated_at:
            now,
        });

      if (insertError) {
        throw new Error(
          `Unable to insert changed injury for ${state.player.full_name}: ${insertError.message}`
        );
      }

      changed++;
    }

    /*
     * Clear ONLY official weekly statuses that disappeared
     * from the current NFL injury report.
     *
     * Reserve-list statuses are NOT cleared simply because
     * they are absent from the weekly injury report.
     */
    for (
      const existing of
      existingByPlayer.values()
    ) {
      if (
        activeOfficialPlayerIds.has(
          existing.nfl_player_id
        )
      ) {
        continue;
      }

      if (
        existing.official_roster_status
      ) {
        continue;
      }

      if (
        !existing.official_game_status &&
        !existing.official_practice_status &&
        !existing.official_source?.startsWith(
          "NFL.com"
        )
      ) {
        continue;
      }

      const { error } =
        await supabase
          .from(
            "nfl_player_injuries"
          )
          .update({
            is_active: false,
            last_seen_at:
              now,
            official_last_synced_at:
              now,
            updated_at:
              now,
          })
          .eq(
            "id",
            existing.id
          );

      if (error) {
        throw new Error(
          `Unable to clear stale official injury ${existing.id}: ${error.message}`
        );
      }

      cleared++;
    }

    /*
     * Update the status consumed by the existing fantasy UI.
     *
     * Keep this restricted to fantasy-relevant positions.
     */
    for (
      const player of
      fantasyPlayers
    ) {
      const state =
        states.get(player.id);

      const status = state
        ? currentStatus(state)
        : null;

      if (!status) continue;

      const { error } =
        await supabase
          .from("nfl_players")
          .update({
            status,
            updated_at: now,
          })
          .eq(
            "id",
            player.id
          );

      if (error) {
        throw new Error(
          `Unable to update player status for ${player.full_name}: ${error.message}`
        );
      }
    }

    return NextResponse.json({
      success: true,
      provider: "NFL.com",
      automatic: true,
      season,
      week:
        injuryReport.week,

      sources: {
        injuryReport:
          injuryReport.url,
        transactions:
          transactionUrl,
      },

      injuryReport: {
        rows:
          injuryReport.records
            .length,
        unmatched:
          unmatchedInjuries
            .length,
        unmatchedSample:
          unmatchedInjuries.slice(
            0,
            20
          ),
      },

      transactions: {
        rows:
          transactions.length,
        matchedPlayers:
          latestTransactionByPlayer
            .size,
        unmatched:
          unmatchedTransactions
            .length,
        unmatchedSample:
          unmatchedTransactions.slice(
            0,
            20
          ),
      },

      database: {
        currentOfficialInjuries:
          activeOfficialPlayerIds
            .size,
        inserted,
        changed,
        unchanged,
        cleared,
      },

      achane:
        Array.from(
          states.values()
        )
          .filter((state) =>
            normalizeName(
              state.player
                .full_name
            ).includes(
              "devonachane"
            )
          )
          .map((state) => ({
            playerId:
              state.player.id,
            name:
              state.player
                .full_name,
            status:
              currentStatus(
                state
              ),
            rosterStatus:
              state.rosterStatus,
            gameStatus:
              state.gameStatus,
            practiceStatus:
              state.practiceStatus,
            injury:
              state.injury,
            transaction:
              state.transactionType,
            transactionDate:
              state.transactionDate,
            source:
              state.source,
          })),

      completedAt:
        new Date().toISOString(),

      durationMs:
        Date.now() -
        startedAt,
    });
  } catch (error) {
    console.error(
      "Official NFL injury sync failed:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        provider: "NFL.com",
        error:
          error instanceof Error
            ? error.message
            : "Official NFL injury sync failed.",
        durationMs:
          Date.now() -
          startedAt,
      },
      {
        status: 500,
      }
    );
  }
}