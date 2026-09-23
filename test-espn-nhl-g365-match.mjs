import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing Supabase environment variables.");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

const ESPN_URL =
  "https://lm-api-reads.fantasy.espn.com/apis/v3/games/fhl/seasons/2026/players?view=kona_player_info";

const ESPN_HEADERS = {
  "User-Agent": "Mozilla/5.0",
  Accept: "application/json",
  "X-Fantasy-Filter": JSON.stringify({
    filterActive: {
      value: true,
    },
  }),
};

function normalizeName(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.'’\-]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function normalizeTeam(value) {
  const team = String(value ?? "").trim().toUpperCase();

  const aliases = {
    LA: "LAK",
    NJ: "NJD",
    SJ: "SJS",
    TB: "TBL",
    UTAH: "UTA",
  };

  return aliases[team] ?? team;
}

function normalizePosition(value) {
  const position = String(value ?? "").trim().toUpperCase();

  if (position === "F") return "F";

  return position;
}

const ESPN_TEAM_MAP = new Map([
  [1, "BOS"],
  [2, "BUF"],
  [3, "CGY"],
  [4, "CHI"],
  [5, "DET"],
  [6, "EDM"],
  [7, "CAR"],
  [8, "LAK"],
  [9, "DAL"],
  [10, "MTL"],
  [11, "NJD"],
  [12, "NYI"],
  [13, "NYR"],
  [14, "OTT"],
  [15, "PHI"],
  [16, "PIT"],
  [17, "COL"],
  [18, "SJS"],
  [19, "STL"],
  [20, "TBL"],
  [21, "TOR"],
  [22, "VAN"],
  [23, "WSH"],
  [25, "ANA"],
  [26, "FLA"],
  [27, "NSH"],
  [28, "WPG"],
  [29, "CBJ"],
  [30, "MIN"],
  [37, "VGK"],
  [124292, "SEA"],
  [129764, "UTA"],
]);

const ESPN_POSITION_MAP = new Map([
  [1, "C"],
  [2, "LW"],
  [3, "RW"],
  [4, "D"],
  [5, "G"],
]);

async function loadAllDatabasePlayers() {
  const pageSize = 1000;
  let from = 0;
  const rows = [];

  while (true) {
    const { data, error } = await supabase
      .from("nhl_players")
      .select(`
        id,
        nhl_player_id,
        espn_athlete_id,
        espn_fantasy_player_id,
        display_name,
        position,
        team_id,
        active,
        status,
        injury_status,
        nhl_teams:team_id (
          abbreviation
        )
      `)
      .range(from, from + pageSize - 1);

    if (error) {
      throw error;
    }

    rows.push(...(data ?? []));

    if (!data || data.length < pageSize) {
      break;
    }

    from += pageSize;
  }

  return rows.map((row) => {
    const teamRelation = Array.isArray(row.nhl_teams)
      ? row.nhl_teams[0]
      : row.nhl_teams;

    return {
      ...row,
      team_abbreviation: normalizeTeam(
        teamRelation?.abbreviation ?? ""
      ),
    };
  });
}

function buildIndexes(dbPlayers) {
  const byFantasyId = new Map();
  const byName = new Map();

  for (const player of dbPlayers) {
    if (player.espn_fantasy_player_id != null) {
      byFantasyId.set(
        String(player.espn_fantasy_player_id),
        player
      );
    }

    const key = normalizeName(player.display_name);

    if (!byName.has(key)) {
      byName.set(key, []);
    }

    byName.get(key).push(player);
  }

  return {
    byFantasyId,
    byName,
  };
}

function matchPlayer(espnPlayer, indexes) {
  const espnId = String(espnPlayer.id ?? "");

  if (espnId && indexes.byFantasyId.has(espnId)) {
    return {
      type: "existing_espn_id",
      player: indexes.byFantasyId.get(espnId),
    };
  }

  const name = normalizeName(espnPlayer.fullName);
  const candidates = indexes.byName.get(name) ?? [];

  if (candidates.length === 0) {
    return {
      type: "unmatched",
      candidates: [],
    };
  }

  if (candidates.length === 1) {
    return {
      type: "exact_name",
      player: candidates[0],
    };
  }

  const espnPosition =
    ESPN_POSITION_MAP.get(Number(espnPlayer.defaultPositionId)) ?? "";

  const espnTeam =
    ESPN_TEAM_MAP.get(Number(espnPlayer.proTeamId)) ?? "";

  const positionMatches = candidates.filter((candidate) => {
    const dbPosition = normalizePosition(candidate.position);

    if (!espnPosition || !dbPosition) return true;

    if (dbPosition === espnPosition) return true;

    if (
      dbPosition === "F" &&
      ["C", "LW", "RW"].includes(espnPosition)
    ) {
      return true;
    }

    return false;
  });

  if (positionMatches.length === 1) {
    return {
      type: "name_position",
      player: positionMatches[0],
    };
  }

  const teamMatches = positionMatches.filter(
    (candidate) =>
      espnTeam &&
      candidate.team_abbreviation &&
      normalizeTeam(candidate.team_abbreviation) === espnTeam
  );

  if (teamMatches.length === 1) {
    return {
      type: "name_position_team",
      player: teamMatches[0],
    };
  }

  return {
    type: "ambiguous",
    candidates:
      teamMatches.length > 0
        ? teamMatches
        : positionMatches.length > 0
          ? positionMatches
          : candidates,
  };
}

async function main() {
  console.log("Loading ESPN Fantasy NHL players...");

  const response = await fetch(ESPN_URL, {
    headers: ESPN_HEADERS,
  });

  console.log("ESPN STATUS:", response.status);

  if (!response.ok) {
    throw new Error(`ESPN HTTP ${response.status}`);
  }

  const espnPlayers = await response.json();

  console.log("ESPN PLAYERS:", espnPlayers.length);

  if (!Array.isArray(espnPlayers) || espnPlayers.length < 1000) {
    throw new Error(
      `ESPN sanity check failed. Expected 1000+ players, received ${
        Array.isArray(espnPlayers) ? espnPlayers.length : "non-array"
      }.`
    );
  }

  console.log("Loading complete G365 NHL player table...");

  const dbPlayers = await loadAllDatabasePlayers();

  console.log("G365 PLAYERS:", dbPlayers.length);

  const indexes = buildIndexes(dbPlayers);

  const counts = {
    existing_espn_id: 0,
    exact_name: 0,
    name_position: 0,
    name_position_team: 0,
    ambiguous: 0,
    unmatched: 0,
  };

  const unmatched = [];
  const ambiguous = [];
  const injuryRows = [];
  const attachableEspnIds = [];

  for (const espnPlayer of espnPlayers) {
    const match = matchPlayer(espnPlayer, indexes);

    counts[match.type]++;

    const espnPosition =
      ESPN_POSITION_MAP.get(Number(espnPlayer.defaultPositionId)) ?? null;

    const espnTeam =
      ESPN_TEAM_MAP.get(Number(espnPlayer.proTeamId)) ?? null;

    const injuryStatus =
      String(espnPlayer.injuryStatus ?? "").trim() || null;

    if (match.player) {
      if (match.player.espn_fantasy_player_id == null) {
        attachableEspnIds.push({
          db_id: match.player.id,
          nhl_player_id: match.player.nhl_player_id,
          g365_name: match.player.display_name,
          espn_id: espnPlayer.id,
          espn_name: espnPlayer.fullName,
          espn_team: espnTeam,
          espn_position: espnPosition,
          match_type: match.type,
        });
      }

      if (
        injuryStatus &&
        injuryStatus !== "ACTIVE"
      ) {
        injuryRows.push({
          db_id: match.player.id,
          nhl_player_id: match.player.nhl_player_id,
          name: match.player.display_name,
          team: espnTeam,
          position: espnPosition,
          espn_id: espnPlayer.id,
          injury_status: injuryStatus,
          injured: espnPlayer.injured ?? null,
          current_db_status: match.player.injury_status,
          match_type: match.type,
        });
      }

      continue;
    }

    if (match.type === "unmatched") {
      unmatched.push({
        espn_id: espnPlayer.id,
        name: espnPlayer.fullName,
        team: espnTeam,
        position: espnPosition,
        injury_status:
          String(espnPlayer.injuryStatus ?? "").trim() || null,
      });

      continue;
    }

    ambiguous.push({
      espn_id: espnPlayer.id,
      name: espnPlayer.fullName,
      team: espnTeam,
      position: espnPosition,
      injury_status:
        String(espnPlayer.injuryStatus ?? "").trim() || null,
      candidates: match.candidates.map((candidate) => ({
        db_id: candidate.id,
        nhl_player_id: candidate.nhl_player_id,
        name: candidate.display_name,
        position: candidate.position,
        team: candidate.team_abbreviation,
        active: candidate.active,
        status: candidate.status,
      })),
    });
  }

  console.log("\n========== MATCH SUMMARY ==========");
  console.table(counts);

  const totalMatched =
    counts.existing_espn_id +
    counts.exact_name +
    counts.name_position +
    counts.name_position_team;

  console.log("TOTAL MATCHED:", totalMatched);
  console.log("UNMATCHED:", unmatched.length);
  console.log("AMBIGUOUS:", ambiguous.length);
  console.log(
    "ESPN IDS READY TO ATTACH:",
    attachableEspnIds.length
  );
  console.log(
    "MATCHED NON-ACTIVE/INJURY STATUS ROWS:",
    injuryRows.length
  );

  console.log("\n========== INJURY / STATUS ROWS ==========");
  console.table(injuryRows);

  console.log("\n========== UNMATCHED ==========");
  console.table(unmatched);

  console.log("\n========== AMBIGUOUS ==========");
  console.dir(ambiguous, {
    depth: null,
    maxArrayLength: null,
  });

  console.log("\nDRY RUN ONLY — NO DATABASE WRITES WERE MADE.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
