import { NextRequest, NextResponse } from "next/server";

import { requireLeagueMember } from "@/lib/leagues/requireLeagueMember";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type SettingsRow = {
  game_format: string | null;
  starting_bankroll: number | string | null;
};

type FantasyTeamRow = {
  id: number;
  team_name: string | null;
  active: boolean;
};

type IdentityRow = Record<string, unknown>;

type WagerRow = {
  fantasy_team_id: number;
  race_id: number;
  total_cost: number | string;
  official_return: number | string;
  wager_status: string | null;
};

type RosterEntry = {
  key: number;
  name: string;
  fantasyTeamIds: number[];
  active: boolean;
  memberCount: number;
};

type StandingAccumulator = {
  key: number;
  name: string;
  active: boolean;
  memberCount: number;
  fantasyTeamIds: number[];
  tickets: number;
  totalStaked: number;
  totalReturned: number;
  net: number;
  pending: number;
  winners: number;
  losers: number;
  refunded: number;
  racesGraded: Set<number>;
};

function numberValue(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
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
  return -1_000_000_000 - competitionTeamId;
}

function normalizedStatus(value: string | null | undefined) {
  return String(value ?? "").toLowerCase();
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

    const admin = createSupabaseAdminClient();

    const { error: ensureError } = await admin.rpc(
      "ensure_greyhound_participants",
      { p_league_id: leagueId },
    );

    if (ensureError) {
      throw new Error(
        `Unable to prepare Greyhound participants: ${ensureError.message}`,
      );
    }

    const [
      { data: settingsRaw, error: settingsError },
      { data: identityRaw, error: identityError },
      { data: fantasyTeamsRaw, error: fantasyTeamsError },
      { data: wagersRaw, error: wagersError },
    ] = await Promise.all([
      admin
        .from("greyhound_league_settings")
        .select("game_format, starting_bankroll")
        .eq("league_id", leagueId)
        .maybeSingle(),
      admin
        .from("greyhound_participant_identity")
        .select("*")
        .eq("league_id", leagueId),
      admin
        .from("fantasy_teams")
        .select("id, team_name, active")
        .eq("league_id", leagueId),
      admin
        .from("greyhound_league_wager_display")
        .select(
          "fantasy_team_id, race_id, total_cost, official_return, wager_status",
        )
        .eq("league_id", leagueId),
    ]);

    if (settingsError) {
      throw new Error(
        `Unable to load Greyhound settings: ${settingsError.message}`,
      );
    }

    if (identityError) {
      throw new Error(
        `Unable to load Greyhound participant identity: ${identityError.message}`,
      );
    }

    if (fantasyTeamsError) {
      throw new Error(
        `Unable to load Greyhound league members: ${fantasyTeamsError.message}`,
      );
    }

    if (wagersError) {
      throw new Error(
        `Unable to load Greyhound standings wagers: ${wagersError.message}`,
      );
    }

    const settings = (settingsRaw ?? null) as SettingsRow | null;
    const identityRows = (identityRaw ?? []) as IdentityRow[];
    const fantasyTeams = (fantasyTeamsRaw ?? []) as FantasyTeamRow[];
    const wagers = (wagersRaw ?? []) as unknown as WagerRow[];

    const gameFormat = String(settings?.game_format ?? "bankroll");
    const startingBankroll = numberValue(settings?.starting_bankroll ?? 100);

    const sharedTeamFormat =
      gameFormat === "team_total_winnings" ||
      gameFormat === "team_head_to_head";

    const fantasyTeamById = new Map(
      fantasyTeams.map((row) => [Number(row.id), row] as const),
    );

    const rosterByKey = new Map<number, RosterEntry>();
    const rosterKeyByFantasyTeamId = new Map<number, number>();

    for (const row of identityRows) {
      const fantasyTeamId = nullableNumber(row.fantasy_team_id);
      if (fantasyTeamId === null) continue;

      const fantasyTeam = fantasyTeamById.get(fantasyTeamId);
      if (fantasyTeam?.active === false) continue;

      const competitionTeamId = nullableNumber(row.competition_team_id);

      if (sharedTeamFormat && competitionTeamId !== null) {
        const key = teamGroupKey(competitionTeamId);
        const existing = rosterByKey.get(key);

        if (existing) {
          if (!existing.fantasyTeamIds.includes(fantasyTeamId)) {
            existing.fantasyTeamIds.push(fantasyTeamId);
            existing.memberCount += 1;
          }
        } else {
          rosterByKey.set(key, {
            key,
            name: competitionTeamName(row, competitionTeamId),
            fantasyTeamIds: [fantasyTeamId],
            active: true,
            memberCount: 1,
          });
        }

        rosterKeyByFantasyTeamId.set(fantasyTeamId, key);
        continue;
      }

      rosterByKey.set(fantasyTeamId, {
        key: fantasyTeamId,
        name: participantFallbackName(
          row,
          fantasyTeam?.team_name,
          fantasyTeamId,
        ),
        fantasyTeamIds: [fantasyTeamId],
        active: true,
        memberCount: 1,
      });

      rosterKeyByFantasyTeamId.set(fantasyTeamId, fantasyTeamId);
    }

    for (const team of fantasyTeams) {
      const fantasyTeamId = Number(team.id);

      if (!Number.isFinite(fantasyTeamId) || !team.active) continue;
      if (rosterKeyByFantasyTeamId.has(fantasyTeamId)) continue;

      rosterByKey.set(fantasyTeamId, {
        key: fantasyTeamId,
        name: team.team_name?.trim() || `Entry ${fantasyTeamId}`,
        fantasyTeamIds: [fantasyTeamId],
        active: true,
        memberCount: 1,
      });

      rosterKeyByFantasyTeamId.set(fantasyTeamId, fantasyTeamId);
    }

    const grouped = new Map<number, StandingAccumulator>();

    for (const roster of rosterByKey.values()) {
      grouped.set(roster.key, {
        key: roster.key,
        name: roster.name,
        active: roster.active,
        memberCount: roster.memberCount,
        fantasyTeamIds: roster.fantasyTeamIds,
        tickets: 0,
        totalStaked: 0,
        totalReturned: 0,
        net: 0,
        pending: 0,
        winners: 0,
        losers: 0,
        refunded: 0,
        racesGraded: new Set<number>(),
      });
    }

    for (const wager of wagers) {
      const sourceFantasyTeamId = Number(wager.fantasy_team_id);
      const key =
        rosterKeyByFantasyTeamId.get(sourceFantasyTeamId) ??
        sourceFantasyTeamId;

      let standing = grouped.get(key);

      if (!standing) {
        const fallback = fantasyTeamById.get(sourceFantasyTeamId);

        standing = {
          key,
          name:
            fallback?.team_name?.trim() || `Entry ${sourceFantasyTeamId}`,
          active: fallback?.active ?? true,
          memberCount: 1,
          fantasyTeamIds: [sourceFantasyTeamId],
          tickets: 0,
          totalStaked: 0,
          totalReturned: 0,
          net: 0,
          pending: 0,
          winners: 0,
          losers: 0,
          refunded: 0,
          racesGraded: new Set<number>(),
        };

        grouped.set(key, standing);
      }

      const cost = numberValue(wager.total_cost);
      const returned = numberValue(wager.official_return);
      const status = normalizedStatus(wager.wager_status);

      standing.tickets += 1;
      standing.totalStaked += cost;
      standing.totalReturned += returned;
      standing.net += returned - cost;

      if (status === "pending" || status === "locked") {
        standing.pending += 1;
      } else if (status === "winner") {
        standing.winners += 1;
        standing.racesGraded.add(Number(wager.race_id));
      } else if (status === "loser") {
        standing.losers += 1;
        standing.racesGraded.add(Number(wager.race_id));
      } else if (status === "refunded" || status === "no_action") {
        standing.refunded += 1;
        standing.racesGraded.add(Number(wager.race_id));
      }
    }

    const standings = Array.from(grouped.values())
      .map((entry) => {
        const openingBankroll = startingBankroll * entry.memberCount;
        const currentBankroll = openingBankroll + entry.net;

        const primaryValue =
          gameFormat === "team_total_winnings"
            ? entry.totalReturned
            : gameFormat === "bankroll"
              ? currentBankroll
              : entry.net;

        return {
          key: entry.key,
          name: entry.name,
          active: entry.active,
          memberCount: entry.memberCount,
          fantasyTeamIds: entry.fantasyTeamIds,
          tickets: entry.tickets,
          totalStaked: entry.totalStaked,
          totalReturned: entry.totalReturned,
          net: entry.net,
          openingBankroll,
          currentBankroll,
          pending: entry.pending,
          winners: entry.winners,
          losers: entry.losers,
          refunded: entry.refunded,
          racesGraded: entry.racesGraded.size,
          primaryValue,
        };
      })
      .sort((a, b) => {
        if (gameFormat === "team_total_winnings") {
          return (
            b.totalReturned - a.totalReturned ||
            b.net - a.net ||
            a.name.localeCompare(b.name)
          );
        }

        if (gameFormat === "bankroll") {
          return (
            b.currentBankroll - a.currentBankroll ||
            b.net - a.net ||
            a.name.localeCompare(b.name)
          );
        }

        return (
          b.net - a.net ||
          b.totalReturned - a.totalReturned ||
          a.name.localeCompare(b.name)
        );
      })
      .map((entry, index) => ({
        ...entry,
        rank: index + 1,
      }));

    const leader = standings[0] ?? null;

    const primaryLabel =
      gameFormat === "team_total_winnings"
        ? "Total Winnings"
        : gameFormat === "bankroll"
          ? "Current Bankroll"
          : gameFormat === "team_head_to_head"
            ? "Live Net"
            : gameFormat === "survivor"
              ? "Round Net"
              : gameFormat === "tournament"
                ? "Tournament Net"
                : "Net";

    return NextResponse.json(
      {
        success: true,
        league: {
          id: leagueId,
          name: access.league.name,
        },
        competition: {
          gameFormat,
          sharedTeamFormat,
          primaryLabel,
          startingBankroll,
        },
        summary: {
          entries: standings.length,
          totalTickets: standings.reduce(
            (sum, row) => sum + row.tickets,
            0,
          ),
          totalStaked: standings.reduce(
            (sum, row) => sum + row.totalStaked,
            0,
          ),
          totalReturned: standings.reduce(
            (sum, row) => sum + row.totalReturned,
            0,
          ),
          leaderName: leader?.name ?? null,
          leaderValue: leader?.primaryValue ?? 0,
        },
        standings,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      },
    );
  } catch (error) {
    console.error("[greyhound/standings] GET failed", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to load Greyhound standings.",
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      },
    );
  }
}
