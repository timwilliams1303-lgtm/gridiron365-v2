import { NextRequest, NextResponse } from "next/server";

import { requireLeagueMember } from "@/lib/leagues/requireLeagueMember";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type DisplayRow = {
  wager_id: number;
  league_id: string;
  fantasy_team_id: number;
  racing_card_id: number;
  race_id: number;
  race_number: number;
  race_status: string | null;
  wager_type: string;
  wager_structure: string;
  denomination: number | string;
  combination_count: number;
  total_cost: number | string;
  wager_status: string;
  grading_status: string | null;
  official_return: number | string;
  selected_entry_ids: number[] | null;
  selected_dogs: unknown;
  alternate_1: unknown;
  alternate_2: unknown;
  combination_json: unknown;
  refund_reason: string | null;
  graded_at: string | null;
  last_regraded_at: string | null;
  created_at: string;
  updated_at: string;
};

type TeamRow = {
  id: number;
  team_name: string | null;
  active: boolean;
};

type CardRow = {
  id: number;
  track_id: number;
  race_date: string;
  session: string | null;
  card_status: string;
  lock_at: string | null;
  finalized_at: string | null;
};

type TrackRow = {
  id: number;
  code: string;
  name: string | null;
};

type SettingsRow = {
  game_format: string | null;
  wagering_style: string | null;
};

type IdentityRow = Record<string, unknown>;

type RosterIdentity = {
  key: number;
  fantasyTeamIds: number[];
  name: string;
  active: boolean;
};

function numberValue(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function uniqueNumbers(values: Array<number | null | undefined>) {
  return Array.from(
    new Set(
      values.filter(
        (value): value is number =>
          typeof value === "number" && Number.isFinite(value),
      ),
    ),
  );
}

function stringValue(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim();
}

function nullableNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function firstNonEmpty(...values: unknown[]) {
  for (const value of values) {
    const text = stringValue(value);
    if (text) return text;
  }
  return "";
}

function participantFallbackName(
  row: IdentityRow,
  fantasyTeamName: string | null | undefined,
  fantasyTeamId: number,
) {
  const firstName = stringValue(row.first_name);
  const lastName = stringValue(row.last_name);
  const fullName = [firstName, lastName].filter(Boolean).join(" ");

  return (
    firstNonEmpty(
      row.entry_name,
      row.display_name,
      row.member_display_name,
      row.owner_display_name,
      fullName,
      fantasyTeamName,
    ) || `Entry ${fantasyTeamId}`
  );
}

function competitionTeamName(row: IdentityRow, competitionTeamId: number) {
  return (
    firstNonEmpty(
      row.competition_team_name,
      row.team_name,
      row.greyhound_team_name,
    ) || `Team ${competitionTeamId}`
  );
}

function teamGroupKey(competitionTeamId: number) {
  /*
   * Leaderboard/filter IDs are numbers in the existing client.
   * Use a negative namespace for shared Greyhound competition teams so they
   * never collide with positive fantasy_team ids.
   */
  return -1_000_000_000 - competitionTeamId;
}

export async function GET(request: NextRequest) {
  try {
    const leagueId = request.nextUrl.searchParams.get("leagueId")?.trim();

    if (!leagueId) {
      return NextResponse.json(
        { success: false, error: "leagueId is required." },
        { status: 400 },
      );
    }

    const access = await requireLeagueMember(leagueId);

    if (String(access.league.leagueType) !== "greyhound") {
      return NextResponse.json(
        {
          success: false,
          error: "This endpoint is only available for Greyhound leagues.",
        },
        { status: 400 },
      );
    }

    const supabase = createSupabaseAdminClient();

    const { data: settingsRaw, error: settingsError } = await supabase
      .from("greyhound_league_settings")
      .select("game_format, wagering_style")
      .eq("league_id", leagueId)
      .maybeSingle();

    if (settingsError) {
      throw new Error(
        `Unable to load Greyhound league settings: ${settingsError.message}`,
      );
    }

    const settings = settingsRaw as SettingsRow | null;
    const gameFormat = String(settings?.game_format ?? "bankroll");
    const wageringStyle =
      String(settings?.wagering_style ?? "whole_card").toLowerCase() ===
      "live_bankroll"
        ? "live_bankroll"
        : "whole_card";

    const isSharedTeamFormat =
      gameFormat === "team_total_winnings" ||
      gameFormat === "team_head_to_head";

    /*
     * Keep the Greyhound participant roster synchronized with active league
     * fantasy teams before building League Wagers. This makes the board work
     * like the football pages: members appear before they place a wager.
     */
    const { error: ensureParticipantsError } = await supabase.rpc(
      "ensure_greyhound_participants",
      {
        p_league_id: leagueId,
      },
    );

    if (ensureParticipantsError) {
      throw new Error(
        `Unable to prepare Greyhound participants: ${ensureParticipantsError.message}`,
      );
    }

    const [
      { data: identityRowsRaw, error: identityError },
      { data: allTeamRowsRaw, error: allTeamError },
      { data: wagerRowsRaw, error: wagerError },
    ] = await Promise.all([
      supabase
        .from("greyhound_participant_identity")
        .select("*")
        .eq("league_id", leagueId),
      supabase
        .from("fantasy_teams")
        .select("id, team_name, active")
        .eq("league_id", leagueId),
      supabase
        .from("greyhound_league_wager_display")
        .select(
          [
            "wager_id",
            "league_id",
            "fantasy_team_id",
            "racing_card_id",
            "race_id",
            "race_number",
            "race_status",
            "wager_type",
            "wager_structure",
            "denomination",
            "combination_count",
            "total_cost",
            "wager_status",
            "grading_status",
            "official_return",
            "selected_entry_ids",
            "selected_dogs",
            "alternate_1",
            "alternate_2",
            "combination_json",
            "refund_reason",
            "graded_at",
            "last_regraded_at",
            "created_at",
            "updated_at",
          ].join(", "),
        )
        .eq("league_id", leagueId)
        .order("created_at", { ascending: false }),
    ]);

    if (identityError) {
      throw new Error(
        `Unable to load Greyhound participant identity: ${identityError.message}`,
      );
    }

    if (allTeamError) {
      throw new Error(
        `Unable to load Greyhound league members: ${allTeamError.message}`,
      );
    }

    if (wagerError) {
      throw new Error(
        `Unable to load league wagers: ${wagerError.message}`,
      );
    }

    const identityRows = (identityRowsRaw ?? []) as IdentityRow[];
    const allTeamRows = (allTeamRowsRaw ?? []) as TeamRow[];
    const wagerRows = (wagerRowsRaw ?? []) as unknown as DisplayRow[];

    const teamById = new Map(
      allTeamRows.map((row) => [Number(row.id), row] as const),
    );

    /*
     * Build the display roster first.
     *
     * Individual formats:
     *   one leaderboard card per active participant.
     *
     * Shared-team formats:
     *   one leaderboard card per Greyhound competition team, containing the
     *   wagers of every member assigned to that shared team.
     */
    const rosterByKey = new Map<number, RosterIdentity>();
    const rosterKeyByFantasyTeamId = new Map<number, number>();

    for (const row of identityRows) {
      const fantasyTeamId = nullableNumber(row.fantasy_team_id);
      if (fantasyTeamId === null) continue;

      const fantasyTeam = teamById.get(fantasyTeamId);
      const active = fantasyTeam?.active ?? true;

      if (!active) continue;

      const competitionTeamId = nullableNumber(row.competition_team_id);

      if (isSharedTeamFormat && competitionTeamId !== null) {
        const key = teamGroupKey(competitionTeamId);
        const existing = rosterByKey.get(key);

        if (existing) {
          if (!existing.fantasyTeamIds.includes(fantasyTeamId)) {
            existing.fantasyTeamIds.push(fantasyTeamId);
          }
        } else {
          rosterByKey.set(key, {
            key,
            fantasyTeamIds: [fantasyTeamId],
            name: competitionTeamName(row, competitionTeamId),
            active,
          });
        }

        rosterKeyByFantasyTeamId.set(fantasyTeamId, key);
        continue;
      }

      const key = fantasyTeamId;
      const name = participantFallbackName(
        row,
        fantasyTeam?.team_name,
        fantasyTeamId,
      );

      rosterByKey.set(key, {
        key,
        fantasyTeamIds: [fantasyTeamId],
        name,
        active,
      });

      rosterKeyByFantasyTeamId.set(fantasyTeamId, key);
    }

    /*
     * Safety fallback: if a league has an active fantasy_team that somehow
     * has not appeared in the identity view yet, still show it immediately.
     */
    for (const team of allTeamRows) {
      const fantasyTeamId = Number(team.id);
      if (!Number.isFinite(fantasyTeamId) || !team.active) continue;
      if (rosterKeyByFantasyTeamId.has(fantasyTeamId)) continue;

      rosterByKey.set(fantasyTeamId, {
        key: fantasyTeamId,
        fantasyTeamIds: [fantasyTeamId],
        name: team.team_name?.trim() || `Entry ${fantasyTeamId}`,
        active: true,
      });

      rosterKeyByFantasyTeamId.set(fantasyTeamId, fantasyTeamId);
    }

    const cardIds = uniqueNumbers(
      wagerRows.map((row) => Number(row.racing_card_id)),
    );

    let cardRows: CardRow[] = [];
    if (cardIds.length > 0) {
      const { data, error } = await supabase
        .from("greyhound_cards")
        .select(
          "id, track_id, race_date, session, card_status, lock_at, finalized_at",
        )
        .in("id", cardIds);

      if (error) {
        throw new Error(
          `Unable to load Greyhound cards: ${error.message}`,
        );
      }

      cardRows = (data ?? []) as CardRow[];
    }

    const trackIds = uniqueNumbers(
      cardRows.map((row) => Number(row.track_id)),
    );

    let trackRows: TrackRow[] = [];
    if (trackIds.length > 0) {
      const { data, error } = await supabase
        .from("greyhound_tracks")
        .select("id, code, name")
        .in("id", trackIds);

      if (error) {
        throw new Error(
          `Unable to load Greyhound tracks: ${error.message}`,
        );
      }

      trackRows = (data ?? []) as TrackRow[];
    }

    const cardById = new Map(
      cardRows.map((row) => [Number(row.id), row] as const),
    );
    const trackById = new Map(
      trackRows.map((row) => [Number(row.id), row] as const),
    );

    const nowMs = Date.now();

    function shouldRevealWager(row: DisplayRow, card: CardRow | undefined) {
      if (wageringStyle === "whole_card") {
        if (!card?.lock_at) return false;
        const lockMs = new Date(card.lock_at).getTime();
        return Number.isFinite(lockMs) && lockMs <= nowMs;
      }

      const raceStatus = String(row.race_status ?? "").toLowerCase();
      return [
        "locked",
        "in_progress",
        "live",
        "official",
        "final",
        "completed",
        "cancelled",
      ].includes(raceStatus);
    }

    const wagers = wagerRows.map((row) => {
      const sourceFantasyTeamId = Number(row.fantasy_team_id);
      const rosterKey =
        rosterKeyByFantasyTeamId.get(sourceFantasyTeamId) ??
        sourceFantasyTeamId;

      const rosterIdentity = rosterByKey.get(rosterKey);
      const fallbackTeam = teamById.get(sourceFantasyTeamId);

      const card = cardById.get(Number(row.racing_card_id));
      const track = card
        ? trackById.get(Number(card.track_id))
        : undefined;

      const totalCost = numberValue(row.total_cost);
      const officialReturn = numberValue(row.official_return);
      const picksRevealed = shouldRevealWager(row, card);

      return {
        id: Number(row.wager_id),

        /*
         * The client groups/filter cards by fantasyTeamId. For shared-team
         * formats this is intentionally the shared Greyhound roster key so
         * every member's wagers land under one Team Name.
         */
        fantasyTeamId: rosterKey,
        sourceFantasyTeamId,
        teamName:
          rosterIdentity?.name ??
          fallbackTeam?.team_name ??
          `Entry ${sourceFantasyTeamId}`,
        teamActive: rosterIdentity?.active ?? fallbackTeam?.active ?? true,

        racingCardId: Number(row.racing_card_id),
        card: card
          ? {
              id: Number(card.id),
              raceDate: card.race_date,
              session: card.session,
              status: card.card_status,
              lockAt: card.lock_at,
              finalizedAt: card.finalized_at,
            }
          : null,

        track: track
          ? {
              id: Number(track.id),
              code: track.code,
              name: track.name,
            }
          : null,

        raceId: Number(row.race_id),
        raceNumber: Number(row.race_number),
        raceStatus: row.race_status,

        wagerType: row.wager_type,
        wagerStructure: row.wager_structure,
        denomination: numberValue(row.denomination),
        combinationCount: Number(row.combination_count ?? 0),
        totalCost,

        wagerStatus: row.wager_status,
        gradingStatus: row.grading_status,
        officialReturn,
        bankrollImpact: officialReturn - totalCost,

        picksRevealed,
        selectedEntryIds:
          picksRevealed && Array.isArray(row.selected_entry_ids)
            ? row.selected_entry_ids.map((value) => Number(value))
            : [],
        selectedDogs: picksRevealed ? row.selected_dogs : null,
        alternate1: picksRevealed ? row.alternate_1 : null,
        alternate2: picksRevealed ? row.alternate_2 : null,
        combinationJson: picksRevealed ? row.combination_json : null,

        refundReason: row.refund_reason,
        gradedAt: row.graded_at,
        lastRegradedAt: row.last_regraded_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    });

    const totalStaked = wagers.reduce(
      (sum, wager) => sum + wager.totalCost,
      0,
    );
    const totalReturned = wagers.reduce(
      (sum, wager) => sum + wager.officialReturn,
      0,
    );

    const normalizedStatus = (value: string | null | undefined) =>
      String(value ?? "").toLowerCase();

    const pending = wagers.filter((wager) => {
      const status = normalizedStatus(wager.wagerStatus);
      return status === "pending" || status === "locked";
    }).length;

    const winners = wagers.filter(
      (wager) => normalizedStatus(wager.wagerStatus) === "winner",
    ).length;

    const losers = wagers.filter(
      (wager) => normalizedStatus(wager.wagerStatus) === "loser",
    ).length;

    const refunded = wagers.filter((wager) => {
      const status = normalizedStatus(wager.wagerStatus);
      return status === "refunded" || status === "no_action";
    }).length;

    type GroupedEntry = {
      fantasyTeamId: number;
      teamName: string;
      teamActive: boolean;
      totalWagers: number;
      totalStaked: number;
      totalReturned: number;
      net: number;
      pending: number;
      winners: number;
      losers: number;
      refunded: number;
      racesCompleted: Set<number>;
      wagers: typeof wagers;
    };

    /*
     * IMPORTANT:
     * Seed the leaderboard from the roster BEFORE reading wagers.
     * This is the behavior that makes every participant/team visible at 0.
     */
    const grouped = new Map<number, GroupedEntry>();

    for (const roster of rosterByKey.values()) {
      grouped.set(roster.key, {
        fantasyTeamId: roster.key,
        teamName: roster.name,
        teamActive: roster.active,
        totalWagers: 0,
        totalStaked: 0,
        totalReturned: 0,
        net: 0,
        pending: 0,
        winners: 0,
        losers: 0,
        refunded: 0,
        racesCompleted: new Set<number>(),
        wagers: [],
      });
    }

    for (const wager of wagers) {
      let entry = grouped.get(wager.fantasyTeamId);

      if (!entry) {
        entry = {
          fantasyTeamId: wager.fantasyTeamId,
          teamName: wager.teamName,
          teamActive: wager.teamActive,
          totalWagers: 0,
          totalStaked: 0,
          totalReturned: 0,
          net: 0,
          pending: 0,
          winners: 0,
          losers: 0,
          refunded: 0,
          racesCompleted: new Set<number>(),
          wagers: [],
        };

        grouped.set(wager.fantasyTeamId, entry);
      }

      entry.totalWagers += 1;
      entry.totalStaked += wager.totalCost;
      entry.totalReturned += wager.officialReturn;
      entry.net += wager.bankrollImpact;
      entry.wagers.push(wager);

      const status = normalizedStatus(wager.wagerStatus);

      if (status === "pending" || status === "locked") {
        entry.pending += 1;
      } else if (status === "winner") {
        entry.winners += 1;
      } else if (status === "loser") {
        entry.losers += 1;
      } else if (status === "refunded" || status === "no_action") {
        entry.refunded += 1;
      }

      if (
        status === "winner" ||
        status === "loser" ||
        status === "refunded" ||
        status === "no_action"
      ) {
        entry.racesCompleted.add(wager.raceId);
      }
    }

    const leaderboardMode =
      gameFormat === "team_total_winnings"
        ? "official_return"
        : gameFormat === "team_head_to_head"
          ? "live_matchup_total"
          : gameFormat === "survivor"
            ? "round_total"
            : gameFormat === "tournament"
              ? "tournament_total"
              : "net";

    const leaderboardLabel =
      gameFormat === "team_total_winnings"
        ? "Total Winnings"
        : gameFormat === "team_head_to_head"
          ? "Head-to-Head Live Totals"
          : gameFormat === "survivor"
            ? "Survivor Live Totals"
            : gameFormat === "tournament"
              ? "Tournament Live Totals"
              : "Bankroll Performance";

    const leaderboard = Array.from(grouped.values())
      .sort((a, b) => {
        if (gameFormat === "team_total_winnings") {
          return (
            b.totalReturned - a.totalReturned ||
            b.net - a.net ||
            a.teamName.localeCompare(b.teamName)
          );
        }

        return (
          b.net - a.net ||
          b.totalReturned - a.totalReturned ||
          a.teamName.localeCompare(b.teamName)
        );
      })
      .map((entry, index) => ({
        fantasyTeamId: entry.fantasyTeamId,
        teamName: entry.teamName,
        teamActive: entry.teamActive,
        rank: index + 1,
        totalWagers: entry.totalWagers,
        totalStaked: entry.totalStaked,
        totalReturned: entry.totalReturned,
        net: entry.net,
        pending: entry.pending,
        winners: entry.winners,
        losers: entry.losers,
        refunded: entry.refunded,
        racesCompleted: entry.racesCompleted.size,
        wagers: entry.wagers.sort((a, b) => {
          if (a.raceNumber !== b.raceNumber) {
            return a.raceNumber - b.raceNumber;
          }
          return b.id - a.id;
        }),
      }));

    /*
     * Team/Entry filter is roster-driven too, so names are available before
     * the first wager is placed.
     */
    const teams = leaderboard
      .map((entry) => ({
        id: entry.fantasyTeamId,
        name: entry.teamName,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const tracks = Array.from(
      new Map(
        wagers
          .filter((wager) => wager.track)
          .map((wager) => [
            wager.track!.id,
            wager.track!,
          ]),
      ).values(),
    ).sort((a, b) =>
      (a.name ?? a.code).localeCompare(b.name ?? b.code),
    );

    return NextResponse.json(
      {
        success: true,
        league: {
          id: leagueId,
          name: access.league.name,
        },
        competition: {
          gameFormat,
          leaderboardMode,
          leaderboardLabel,
          wageringStyle,
        },
        summary: {
          totalWagers: wagers.length,
          totalStaked,
          totalReturned,
          net: totalReturned - totalStaked,
          pending,
          winners,
          losers,
          refunded,
        },
        filters: {
          teams,
          tracks,
        },
        leaderboard,
        wagers,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error("[greyhound/league-wagers] GET failed", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to load Greyhound league wagers.",
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }
}