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
  wager_id: number;
  fantasy_team_id: number;
  racing_card_id: number;
  race_id: number;
  race_number: number;
  wager_type: string;
  wager_structure: string;
  total_cost: number | string;
  wager_status: string | null;
  grading_status: string | null;
  official_return: number | string;
  created_at: string;
};

type CardRow = {
  id: number;
  track_id: number;
  race_date: string;
  session: string | null;
  card_status: string | null;
};

type TrackRow = {
  id: number;
  code: string;
};

type RosterEntry = {
  key: number;
  name: string;
  fantasyTeamIds: number[];
  memberCount: number;
};

function numberValue(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function nullableNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function firstText(...values: unknown[]) {
  for (const value of values) {
    const result = text(value);
    if (result) return result;
  }
  return "";
}

function participantName(
  row: IdentityRow,
  fantasyTeamName: string | null | undefined,
  fantasyTeamId: number,
) {
  const fullName = [text(row.first_name), text(row.last_name)]
    .filter(Boolean)
    .join(" ");

  return (
    firstText(
      row.entry_name,
      row.display_name,
      row.member_display_name,
      row.owner_display_name,
      fullName,
      fantasyTeamName,
    ) || `Entry ${fantasyTeamId}`
  );
}

function sharedTeamName(row: IdentityRow, competitionTeamId: number) {
  return (
    firstText(
      row.competition_team_name,
      row.team_name,
      row.greyhound_team_name,
    ) || `Team ${competitionTeamId}`
  );
}

function sharedTeamKey(competitionTeamId: number) {
  return -1_000_000_000 - competitionTeamId;
}

function status(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function trackDisplayName(code: string) {
  if (code === "GWD") return "Wheeling";
  if (code === "GTS") return "Tri-State";
  return code || "Greyhound";
}

function jsonError(error: string, statusCode = 500) {
  return NextResponse.json(
    { success: false, error },
    {
      status: statusCode,
      headers: { "Cache-Control": "no-store, max-age=0" },
    },
  );
}

export async function GET(request: NextRequest) {
  try {
    const leagueId = request.nextUrl.searchParams.get("leagueId")?.trim();

    if (!leagueId) {
      return jsonError("leagueId is required.", 400);
    }

    const access = await requireLeagueMember(leagueId);

    if (String(access.league.leagueType) !== "greyhound") {
      return jsonError(
        "This endpoint is only available for Greyhound leagues.",
        400,
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
      settingsResult,
      identityResult,
      fantasyTeamsResult,
      wagersResult,
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
          [
            "wager_id",
            "fantasy_team_id",
            "racing_card_id",
            "race_id",
            "race_number",
            "wager_type",
            "wager_structure",
            "total_cost",
            "wager_status",
            "grading_status",
            "official_return",
            "created_at",
          ].join(", "),
        )
        .eq("league_id", leagueId)
        .order("created_at", { ascending: false }),
    ]);

    if (settingsResult.error) {
      throw new Error(
        `Unable to load Greyhound settings: ${settingsResult.error.message}`,
      );
    }
    if (identityResult.error) {
      throw new Error(
        `Unable to load Greyhound identity: ${identityResult.error.message}`,
      );
    }
    if (fantasyTeamsResult.error) {
      throw new Error(
        `Unable to load Greyhound participants: ${fantasyTeamsResult.error.message}`,
      );
    }
    if (wagersResult.error) {
      throw new Error(
        `Unable to load Greyhound wagers: ${wagersResult.error.message}`,
      );
    }

    const settings = (settingsResult.data ?? null) as SettingsRow | null;
    const identityRows = (identityResult.data ?? []) as IdentityRow[];
    const fantasyTeams = (fantasyTeamsResult.data ?? []) as FantasyTeamRow[];
    const wagerRows = (wagersResult.data ?? []) as unknown as WagerRow[];

    const gameFormat = String(settings?.game_format ?? "bankroll");
    const startingBankroll = numberValue(settings?.starting_bankroll || 100);

    const sharedTeamFormat =
      gameFormat === "team_total_winnings" ||
      gameFormat === "team_head_to_head";

    const fantasyTeamById = new Map(
      fantasyTeams.map((row) => [Number(row.id), row] as const),
    );

    const rosterByKey = new Map<number, RosterEntry>();
    const keyByFantasyTeamId = new Map<number, number>();

    for (const row of identityRows) {
      const fantasyTeamId = nullableNumber(row.fantasy_team_id);
      if (fantasyTeamId === null) continue;

      const fantasyTeam = fantasyTeamById.get(fantasyTeamId);
      if (fantasyTeam?.active === false) continue;

      const competitionTeamId = nullableNumber(row.competition_team_id);

      if (sharedTeamFormat && competitionTeamId !== null) {
        const key = sharedTeamKey(competitionTeamId);
        const existing = rosterByKey.get(key);

        if (existing) {
          if (!existing.fantasyTeamIds.includes(fantasyTeamId)) {
            existing.fantasyTeamIds.push(fantasyTeamId);
            existing.memberCount += 1;
          }
        } else {
          rosterByKey.set(key, {
            key,
            name: sharedTeamName(row, competitionTeamId),
            fantasyTeamIds: [fantasyTeamId],
            memberCount: 1,
          });
        }

        keyByFantasyTeamId.set(fantasyTeamId, key);
        continue;
      }

      rosterByKey.set(fantasyTeamId, {
        key: fantasyTeamId,
        name: participantName(
          row,
          fantasyTeam?.team_name,
          fantasyTeamId,
        ),
        fantasyTeamIds: [fantasyTeamId],
        memberCount: 1,
      });

      keyByFantasyTeamId.set(fantasyTeamId, fantasyTeamId);
    }

    for (const team of fantasyTeams) {
      const fantasyTeamId = Number(team.id);

      if (!Number.isFinite(fantasyTeamId) || !team.active) continue;
      if (keyByFantasyTeamId.has(fantasyTeamId)) continue;

      rosterByKey.set(fantasyTeamId, {
        key: fantasyTeamId,
        name: team.team_name?.trim() || `Entry ${fantasyTeamId}`,
        fantasyTeamIds: [fantasyTeamId],
        memberCount: 1,
      });

      keyByFantasyTeamId.set(fantasyTeamId, fantasyTeamId);
    }

    const cardIds = Array.from(
      new Set(
        wagerRows
          .map((row) => Number(row.racing_card_id))
          .filter((value) => Number.isFinite(value)),
      ),
    );

    let cards: CardRow[] = [];

    if (cardIds.length > 0) {
      const cardsResult = await admin
        .from("greyhound_cards")
        .select("id, track_id, race_date, session, card_status")
        .in("id", cardIds);

      if (cardsResult.error) {
        throw new Error(
          `Unable to load Greyhound cards: ${cardsResult.error.message}`,
        );
      }

      cards = (cardsResult.data ?? []) as CardRow[];
    }

    const trackIds = Array.from(
      new Set(
        cards
          .map((card) => Number(card.track_id))
          .filter((value) => Number.isFinite(value)),
      ),
    );

    let tracks: TrackRow[] = [];

    if (trackIds.length > 0) {
      const tracksResult = await admin
        .from("greyhound_tracks")
        .select("id, code")
        .in("id", trackIds);

      if (tracksResult.error) {
        throw new Error(
          `Unable to load Greyhound tracks: ${tracksResult.error.message}`,
        );
      }

      tracks = (tracksResult.data ?? []) as TrackRow[];
    }

    const cardById = new Map(
      cards.map((card) => [Number(card.id), card] as const),
    );
    const trackById = new Map(
      tracks.map((track) => [Number(track.id), track] as const),
    );

    type Standing = {
      key: number;
      name: string;
      memberCount: number;
      tickets: number;
      staked: number;
      returned: number;
      net: number;
      wins: number;
      losses: number;
      refunds: number;
      pending: number;
      biggestReturn: number;
      biggestReturnWagerType: string | null;
      biggestReturnRace: number | null;
      bestWinningTicketProfit: number;
    };

    const standingByKey = new Map<number, Standing>();

    for (const roster of rosterByKey.values()) {
      standingByKey.set(roster.key, {
        key: roster.key,
        name: roster.name,
        memberCount: roster.memberCount,
        tickets: 0,
        staked: 0,
        returned: 0,
        net: 0,
        wins: 0,
        losses: 0,
        refunds: 0,
        pending: 0,
        biggestReturn: 0,
        biggestReturnWagerType: null,
        biggestReturnRace: null,
        bestWinningTicketProfit: 0,
      });
    }

    type CardParticipant = {
      key: number;
      name: string;
      tickets: number;
      staked: number;
      returned: number;
      net: number;
      wins: number;
      losses: number;
    };

    type CardAccumulator = {
      cardId: number;
      raceDate: string;
      session: string | null;
      cardStatus: string;
      trackCode: string;
      trackName: string;
      tickets: number;
      staked: number;
      returned: number;
      net: number;
      winners: number;
      losses: number;
      refunds: number;
      gradedTickets: number;
      participants: Map<number, CardParticipant>;
    };

    const cardRecapById = new Map<number, CardAccumulator>();
    const wagerTypeTotals = new Map<
      string,
      {
        tickets: number;
        staked: number;
        returned: number;
        wins: number;
      }
    >();

    let biggestTicket:
      | {
          name: string;
          officialReturn: number;
          profit: number;
          wagerType: string;
          raceNumber: number;
          raceDate: string | null;
          trackCode: string | null;
        }
      | null = null;

    for (const wager of wagerRows) {
      const fantasyTeamId = Number(wager.fantasy_team_id);
      const rosterKey =
        keyByFantasyTeamId.get(fantasyTeamId) ?? fantasyTeamId;

      let standing = standingByKey.get(rosterKey);

      if (!standing) {
        const fallbackName =
          fantasyTeamById.get(fantasyTeamId)?.team_name?.trim() ||
          `Entry ${fantasyTeamId}`;

        standing = {
          key: rosterKey,
          name: fallbackName,
          memberCount: 1,
          tickets: 0,
          staked: 0,
          returned: 0,
          net: 0,
          wins: 0,
          losses: 0,
          refunds: 0,
          pending: 0,
          biggestReturn: 0,
          biggestReturnWagerType: null,
          biggestReturnRace: null,
          bestWinningTicketProfit: 0,
        };

        standingByKey.set(rosterKey, standing);
      }

      const cost = numberValue(wager.total_cost);
      const returned = numberValue(wager.official_return);
      const net = returned - cost;
      const wagerStatus = status(wager.wager_status);
      const gradingStatus = status(wager.grading_status);

      standing.tickets += 1;
      standing.staked += cost;
      standing.returned += returned;
      standing.net += net;

      if (wagerStatus === "winner") standing.wins += 1;
      else if (wagerStatus === "loser") standing.losses += 1;
      else if (
        wagerStatus === "refunded" ||
        wagerStatus === "void" ||
        wagerStatus === "no_action"
      ) {
        standing.refunds += 1;
      } else {
        standing.pending += 1;
      }

      if (returned > standing.biggestReturn) {
        standing.biggestReturn = returned;
        standing.biggestReturnWagerType = wager.wager_type;
        standing.biggestReturnRace = Number(wager.race_number);
      }

      if (
        wagerStatus === "winner" &&
        net > standing.bestWinningTicketProfit
      ) {
        standing.bestWinningTicketProfit = net;
      }

      const wagerType = String(wager.wager_type || "unknown");
      const wagerTypeRow = wagerTypeTotals.get(wagerType) ?? {
        tickets: 0,
        staked: 0,
        returned: 0,
        wins: 0,
      };

      wagerTypeRow.tickets += 1;
      wagerTypeRow.staked += cost;
      wagerTypeRow.returned += returned;
      if (wagerStatus === "winner") wagerTypeRow.wins += 1;
      wagerTypeTotals.set(wagerType, wagerTypeRow);

      const cardId = Number(wager.racing_card_id);
      const card = cardById.get(cardId);

      if (!card) continue;

      const track = trackById.get(Number(card.track_id));
      const trackCode = track?.code ?? "";

      let cardRecap = cardRecapById.get(cardId);

      if (!cardRecap) {
        cardRecap = {
          cardId,
          raceDate: card.race_date,
          session: card.session,
          cardStatus: String(card.card_status ?? ""),
          trackCode,
          trackName: trackDisplayName(trackCode),
          tickets: 0,
          staked: 0,
          returned: 0,
          net: 0,
          winners: 0,
          losses: 0,
          refunds: 0,
          gradedTickets: 0,
          participants: new Map(),
        };

        cardRecapById.set(cardId, cardRecap);
      }

      cardRecap.tickets += 1;
      cardRecap.staked += cost;
      cardRecap.returned += returned;
      cardRecap.net += net;

      if (
        gradingStatus === "graded" ||
        ["winner", "loser", "refunded", "void", "no_action"].includes(
          wagerStatus,
        )
      ) {
        cardRecap.gradedTickets += 1;
      }

      if (wagerStatus === "winner") cardRecap.winners += 1;
      if (wagerStatus === "loser") cardRecap.losses += 1;
      if (
        wagerStatus === "refunded" ||
        wagerStatus === "void" ||
        wagerStatus === "no_action"
      ) {
        cardRecap.refunds += 1;
      }

      const participant = cardRecap.participants.get(rosterKey) ?? {
        key: rosterKey,
        name: standing.name,
        tickets: 0,
        staked: 0,
        returned: 0,
        net: 0,
        wins: 0,
        losses: 0,
      };

      participant.tickets += 1;
      participant.staked += cost;
      participant.returned += returned;
      participant.net += net;
      if (wagerStatus === "winner") participant.wins += 1;
      if (wagerStatus === "loser") participant.losses += 1;

      cardRecap.participants.set(rosterKey, participant);

      if (
        wagerStatus === "winner" &&
        (!biggestTicket ||
          returned > biggestTicket.officialReturn)
      ) {
        biggestTicket = {
          name: standing.name,
          officialReturn: returned,
          profit: net,
          wagerType,
          raceNumber: Number(wager.race_number),
          raceDate: card.race_date,
          trackCode: trackCode || null,
        };
      }
    }

    const leaderboard = Array.from(standingByKey.values())
      .map((row) => ({
        ...row,
        openingBankroll: startingBankroll * row.memberCount,
        currentBankroll:
          startingBankroll * row.memberCount + row.net,
      }))
      .sort((a, b) => {
        if (gameFormat === "team_total_winnings") {
          return (
            b.returned - a.returned ||
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
          b.returned - a.returned ||
          a.name.localeCompare(b.name)
        );
      })
      .map((row, index) => ({
        ...row,
        rank: index + 1,
      }));

    const completedCards = Array.from(cardRecapById.values())
      .filter((card) => {
        const cardStatus = status(card.cardStatus);

        return (
          cardStatus === "final" ||
          (card.tickets > 0 &&
            card.gradedTickets === card.tickets)
        );
      })
      .sort((a, b) => {
        if (a.raceDate !== b.raceDate) {
          return b.raceDate.localeCompare(a.raceDate);
        }
        return b.cardId - a.cardId;
      })
      .map((card) => {
        const topThree = Array.from(card.participants.values())
          .sort(
            (a, b) =>
              b.net - a.net ||
              b.returned - a.returned ||
              a.name.localeCompare(b.name),
          )
          .slice(0, 3);

        return {
          cardId: card.cardId,
          raceDate: card.raceDate,
          session: card.session,
          cardStatus: card.cardStatus,
          finalizedAt: null,
          trackCode: card.trackCode,
          trackName: card.trackName,
          tickets: card.tickets,
          staked: card.staked,
          returned: card.returned,
          net: card.net,
          winners: card.winners,
          losses: card.losses,
          refunds: card.refunds,
          leader: topThree[0] ?? null,
          topThree,
        };
      });

    const bestNet =
      [...leaderboard].sort(
        (a, b) =>
          b.net - a.net || a.name.localeCompare(b.name),
      )[0] ?? null;

    const mostWinners =
      [...leaderboard].sort(
        (a, b) =>
          b.wins - a.wins ||
          b.net - a.net ||
          a.name.localeCompare(b.name),
      )[0] ?? null;

    const mostActive =
      [...leaderboard].sort(
        (a, b) =>
          b.tickets - a.tickets ||
          b.staked - a.staked ||
          a.name.localeCompare(b.name),
      )[0] ?? null;

    const bestReturn =
      [...leaderboard].sort(
        (a, b) =>
          b.biggestReturn - a.biggestReturn ||
          a.name.localeCompare(b.name),
      )[0] ?? null;

    const wagerTypes = Array.from(wagerTypeTotals.entries())
      .map(([wagerType, totals]) => ({
        wagerType,
        ...totals,
        net: totals.returned - totals.staked,
        winRate:
          totals.tickets > 0
            ? (totals.wins / totals.tickets) * 100
            : 0,
      }))
      .sort(
        (a, b) =>
          b.returned - a.returned ||
          b.tickets - a.tickets ||
          a.wagerType.localeCompare(b.wagerType),
      );

    const totalTickets = leaderboard.reduce(
      (sum, row) => sum + row.tickets,
      0,
    );
    const totalStaked = leaderboard.reduce(
      (sum, row) => sum + row.staked,
      0,
    );
    const totalReturned = leaderboard.reduce(
      (sum, row) => sum + row.returned,
      0,
    );
    const totalWinners = leaderboard.reduce(
      (sum, row) => sum + row.wins,
      0,
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
          sharedTeamFormat,
          startingBankroll,
        },
        summary: {
          entries: leaderboard.length,
          completedCards: completedCards.length,
          totalTickets,
          totalStaked,
          totalReturned,
          totalNet: totalReturned - totalStaked,
          totalWinners,
        },
        leaderboard,
        cards: completedCards,
        awards: {
          leader: leaderboard[0] ?? null,
          bestNet,
          mostWinners,
          mostActive,
          bestReturn,
          biggestTicket,
        },
        wagerTypes,
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      },
    );
  } catch (error) {
    console.error("[greyhound/recap] GET failed:", error);

    return jsonError(
      error instanceof Error
        ? error.message
        : "Unable to load Greyhound recap.",
      500,
    );
  }
}
