import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type MatchupRow = {
  id: number;
  league_id: string;
  matchup_number: number;
  start_date: string;
  end_date: string;
  home_competition_team_id: number;
  away_competition_team_id: number | null;
  status: string;
};

type IdentityRow = {
  fantasy_team_id: number;
  competition_team_id: number | null;
};

type CardRow = {
  id: number;
  race_date: string;
};

type RaceRow = {
  id: number;
  card_id: number;
  race_status: string | null;
};

type WagerRow = {
  fantasy_team_id: number;
  racing_card_id: number;
  total_cost: number | string | null;
  official_return: number | string | null;
  wager_status: string | null;
};

type TeamRecordAccumulator = {
  wins: number;
  losses: number;
  ties: number;
  totalReturned: number;
  totalWagered: number;
};

export type GreyhoundH2HRefreshResult = {
  leagueId: string;
  matchupsChecked: number;
  matchupsFinalized: number;
  activeMatchups: number;
  scheduledMatchups: number;
  blockedMatchups: number;
};

function lower(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function numberValue(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function weekdayUtc(isoDate: string) {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

function isFinalRaceStatus(value: unknown) {
  return ["final", "official", "cancelled", "no_contest"].includes(
    lower(value),
  );
}

function isFinalWagerStatus(value: unknown) {
  return ["winner", "loser", "refunded", "void", "no_action"].includes(
    lower(value),
  );
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export async function refreshGreyhoundH2HMatchups(
  leagueId: string,
): Promise<GreyhoundH2HRefreshResult> {
  const admin = createSupabaseAdminClient();

  const [
    settingsResult,
    matchupsResult,
    identityResult,
  ] = await Promise.all([
    admin
      .from("greyhound_league_settings")
      .select("game_format,competition_days")
      .eq("league_id", leagueId)
      .maybeSingle(),
    admin
      .from("greyhound_h2h_matchups")
      .select(
        "id,league_id,matchup_number,start_date,end_date,home_competition_team_id,away_competition_team_id,status",
      )
      .eq("league_id", leagueId)
      .order("matchup_number", { ascending: true })
      .order("id", { ascending: true }),
    admin
      .from("greyhound_participant_identity")
      .select("fantasy_team_id,competition_team_id")
      .eq("league_id", leagueId),
  ]);

  if (settingsResult.error) throw settingsResult.error;
  if (matchupsResult.error) throw matchupsResult.error;
  if (identityResult.error) throw identityResult.error;

  const settings = settingsResult.data as unknown as {
    game_format: string;
    competition_days: number[] | null;
  } | null;

  if (settings?.game_format !== "team_head_to_head") {
    return {
      leagueId,
      matchupsChecked: 0,
      matchupsFinalized: 0,
      activeMatchups: 0,
      scheduledMatchups: 0,
      blockedMatchups: 0,
    };
  }

  const matchups = (matchupsResult.data ?? []) as unknown as MatchupRow[];
  const identityRows = (identityResult.data ?? []) as unknown as IdentityRow[];
  const competitionDays =
    Array.isArray(settings.competition_days) &&
    settings.competition_days.length > 0
      ? settings.competition_days.map(Number)
      : [0, 1, 2, 3, 4, 5, 6];

  const fantasyTeamToCompetitionTeam = new Map<number, number>();
  for (const row of identityRows) {
    if (row.competition_team_id != null) {
      fantasyTeamToCompetitionTeam.set(
        Number(row.fantasy_team_id),
        Number(row.competition_team_id),
      );
    }
  }

  if (matchups.length === 0) {
    await admin
      .from("greyhound_h2h_team_records")
      .delete()
      .eq("league_id", leagueId);

    return {
      leagueId,
      matchupsChecked: 0,
      matchupsFinalized: 0,
      activeMatchups: 0,
      scheduledMatchups: 0,
      blockedMatchups: 0,
    };
  }

  const minStart = matchups.reduce(
    (min, row) => (row.start_date < min ? row.start_date : min),
    matchups[0].start_date,
  );
  const maxEnd = matchups.reduce(
    (max, row) => (row.end_date > max ? row.end_date : max),
    matchups[0].end_date,
  );

  const cardsResult = await admin
    .from("greyhound_cards")
    .select("id,race_date")
    .gte("race_date", minStart)
    .lte("race_date", maxEnd)
    .order("race_date", { ascending: true });

  if (cardsResult.error) throw cardsResult.error;

  const cards = ((cardsResult.data ?? []) as unknown as CardRow[]).filter(
    (card) => competitionDays.includes(weekdayUtc(card.race_date)),
  );

  const cardIds = cards.map((card) => Number(card.id));
  const cardById = new Map(cards.map((card) => [Number(card.id), card] as const));

  let races: RaceRow[] = [];
  let wagers: WagerRow[] = [];

  if (cardIds.length > 0) {
    const [racesResult, wagersResult] = await Promise.all([
      admin
        .from("greyhound_races")
        .select("id,card_id,race_status")
        .in("card_id", cardIds),
      admin
        .from("greyhound_league_wager_display")
        .select(
          "fantasy_team_id,racing_card_id,total_cost,official_return,wager_status",
        )
        .eq("league_id", leagueId)
        .in("racing_card_id", cardIds),
    ]);

    if (racesResult.error) throw racesResult.error;
    if (wagersResult.error) throw wagersResult.error;

    races = (racesResult.data ?? []) as unknown as RaceRow[];
    wagers = (wagersResult.data ?? []) as unknown as WagerRow[];
  }

  const racesByCard = new Map<number, RaceRow[]>();
  for (const race of races) {
    const key = Number(race.card_id);
    const list = racesByCard.get(key) ?? [];
    list.push(race);
    racesByCard.set(key, list);
  }

  const today = todayUtc();
  let matchupsFinalized = 0;
  let activeMatchups = 0;
  let scheduledMatchups = 0;
  let blockedMatchups = 0;

  for (const matchup of matchups) {
    const eligibleCards = cards.filter(
      (card) =>
        card.race_date >= matchup.start_date &&
        card.race_date <= matchup.end_date,
    );
    const eligibleCardIds = new Set(
      eligibleCards.map((card) => Number(card.id)),
    );

    const periodRaces = eligibleCards.flatMap(
      (card) => racesByCard.get(Number(card.id)) ?? [],
    );

    const periodWagers = wagers.filter((wager) =>
      eligibleCardIds.has(Number(wager.racing_card_id)),
    );

    const homeTeamId = Number(matchup.home_competition_team_id);
    const awayTeamId =
      matchup.away_competition_team_id == null
        ? null
        : Number(matchup.away_competition_team_id);

    let homeTotalReturn = 0;
    let awayTotalReturn = 0;

    for (const wager of periodWagers) {
      const competitionTeamId = fantasyTeamToCompetitionTeam.get(
        Number(wager.fantasy_team_id),
      );

      if (competitionTeamId === homeTeamId) {
        homeTotalReturn += numberValue(wager.official_return);
      } else if (
        awayTeamId !== null &&
        competitionTeamId === awayTeamId
      ) {
        awayTotalReturn += numberValue(wager.official_return);
      }
    }

    homeTotalReturn = roundMoney(homeTotalReturn);
    awayTotalReturn = roundMoney(awayTotalReturn);

    const hasEligibleCards = eligibleCards.length > 0;
    const allRacesFinal =
      hasEligibleCards &&
      periodRaces.length > 0 &&
      periodRaces.every((race) => isFinalRaceStatus(race.race_status));
    const allWagersFinal = periodWagers.every((wager) =>
      isFinalWagerStatus(wager.wager_status),
    );
    const periodEnded = today > matchup.end_date;

    let status = "scheduled";
    let winnerTeamId: number | null = null;
    let isTie = false;
    let finalizedAt: string | null = null;

    if (
      periodEnded &&
      hasEligibleCards &&
      allRacesFinal &&
      allWagersFinal
    ) {
      status = "final";
      finalizedAt = new Date().toISOString();

      if (awayTeamId !== null) {
        if (homeTotalReturn > awayTotalReturn) {
          winnerTeamId = homeTeamId;
        } else if (awayTotalReturn > homeTotalReturn) {
          winnerTeamId = awayTeamId;
        } else {
          isTie = true;
        }
      }

      matchupsFinalized += 1;
    } else if (
      today >= matchup.start_date &&
      today <= matchup.end_date
    ) {
      status = "active";
      activeMatchups += 1;
    } else if (today < matchup.start_date) {
      status = "scheduled";
      scheduledMatchups += 1;
    } else {
      // Period ended, but official completion requirements are not met.
      status = "active";
      blockedMatchups += 1;
    }

    const { error: updateError } = await admin
      .from("greyhound_h2h_matchups")
      .update({
        home_total_return: homeTotalReturn,
        away_total_return: awayTotalReturn,
        winner_competition_team_id: winnerTeamId,
        is_tie: isTie,
        status,
        finalized_at:
          status === "final"
            ? matchup.status === "final"
              ? undefined
              : finalizedAt
            : null,
      })
      .eq("league_id", leagueId)
      .eq("id", Number(matchup.id));

    if (updateError) throw updateError;
  }

  /*
   * Rebuild records from the now-refreshed schedule.
   * Matchup scoring is OFFICIAL RETURN / total winnings.
   * BYEs finalize but do not create a win, loss, or tie.
   */
  const refreshedResult = await admin
    .from("greyhound_h2h_matchups")
    .select(
      "home_competition_team_id,away_competition_team_id,home_total_return,away_total_return,winner_competition_team_id,is_tie,status,start_date,end_date",
    )
    .eq("league_id", leagueId);

  if (refreshedResult.error) throw refreshedResult.error;

  const records = new Map<number, TeamRecordAccumulator>();

  function ensureRecord(teamId: number) {
    let record = records.get(teamId);
    if (!record) {
      record = {
        wins: 0,
        losses: 0,
        ties: 0,
        totalReturned: 0,
        totalWagered: 0,
      };
      records.set(teamId, record);
    }
    return record;
  }

  for (const identity of identityRows) {
    if (identity.competition_team_id != null) {
      ensureRecord(Number(identity.competition_team_id));
    }
  }

  for (const row of refreshedResult.data ?? []) {
    if (lower(row.status) !== "final") continue;

    const homeId = Number(row.home_competition_team_id);
    const awayId =
      row.away_competition_team_id == null
        ? null
        : Number(row.away_competition_team_id);

    const homeRecord = ensureRecord(homeId);
    homeRecord.totalReturned += numberValue(row.home_total_return);

    if (awayId === null) continue;

    const awayRecord = ensureRecord(awayId);
    awayRecord.totalReturned += numberValue(row.away_total_return);

    if (row.is_tie) {
      homeRecord.ties += 1;
      awayRecord.ties += 1;
    } else if (Number(row.winner_competition_team_id) === homeId) {
      homeRecord.wins += 1;
      awayRecord.losses += 1;
    } else if (Number(row.winner_competition_team_id) === awayId) {
      awayRecord.wins += 1;
      homeRecord.losses += 1;
    }
  }

  /*
   * Rebuild official wagered totals for finalized matchup windows.
   * Each wager belongs to one competition team through participant identity.
   */
  const finalizedWindows = (refreshedResult.data ?? []).filter(
    (row) => lower(row.status) === "final",
  );

  for (const wager of wagers) {
    const card = cardById.get(Number(wager.racing_card_id));
    if (!card) continue;

    const competitionTeamId = fantasyTeamToCompetitionTeam.get(
      Number(wager.fantasy_team_id),
    );
    if (competitionTeamId == null) continue;

    const isInsideFinalizedWindow = finalizedWindows.some(
      (window) =>
        card.race_date >= String(window.start_date) &&
        card.race_date <= String(window.end_date),
    );
    if (!isInsideFinalizedWindow) continue;

    ensureRecord(competitionTeamId).totalWagered += numberValue(
      wager.total_cost,
    );
  }

  const { error: clearRecordsError } = await admin
    .from("greyhound_h2h_team_records")
    .delete()
    .eq("league_id", leagueId);

  if (clearRecordsError) throw clearRecordsError;

  const recordRows = Array.from(records.entries()).map(
    ([competitionTeamId, record]) => ({
      league_id: leagueId,
      competition_team_id: competitionTeamId,
      wins: record.wins,
      losses: record.losses,
      ties: record.ties,
      total_returned: roundMoney(record.totalReturned),
      total_wagered: roundMoney(record.totalWagered),
      net: roundMoney(record.totalReturned - record.totalWagered),
      updated_at: new Date().toISOString(),
    }),
  );

  if (recordRows.length > 0) {
    const { error: insertRecordsError } = await admin
      .from("greyhound_h2h_team_records")
      .insert(recordRows);

    if (insertRecordsError) throw insertRecordsError;
  }

  return {
    leagueId,
    matchupsChecked: matchups.length,
    matchupsFinalized,
    activeMatchups,
    scheduledMatchups,
    blockedMatchups,
  };
}
