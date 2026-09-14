import { NextRequest, NextResponse } from "next/server";

import { requireLeagueMember } from "@/lib/leagues/requireLeagueMember";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type HistoryRow = {
  id: number;
  competition_number: number;
  game_format: string;
  competition_start_date: string | null;
  competition_end_date: string | null;
  completed_at: string;
  champion_key: number | null;
  champion_name: string;
  runner_up_key: number | null;
  runner_up_name: string | null;
  total_entries: number;
  total_tickets: number;
  total_wagered: number | string;
  total_returned: number | string;
  champion_net: number | string;
  champion_returned: number | string;
  standings_snapshot: unknown;
  awards_snapshot: unknown;
  cards_snapshot: unknown;
};

type AwardRow = {
  id: number;
  competition_history_id: number;
  award_key: string;
  award_title: string;
  recipient_key: number | null;
  recipient_name: string;
  award_value: number | string | null;
  award_detail: string | null;
  created_at: string;
};

function numberValue(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
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

    const [
      { data: historyRaw, error: historyError },
      { data: awardsRaw, error: awardsError },
    ] = await Promise.all([
      admin
        .from("greyhound_competition_history")
        .select(
          [
            "id",
            "competition_number",
            "game_format",
            "competition_start_date",
            "competition_end_date",
            "completed_at",
            "champion_key",
            "champion_name",
            "runner_up_key",
            "runner_up_name",
            "total_entries",
            "total_tickets",
            "total_wagered",
            "total_returned",
            "champion_net",
            "champion_returned",
            "standings_snapshot",
            "awards_snapshot",
            "cards_snapshot",
          ].join(", "),
        )
        .eq("league_id", leagueId)
        .order("competition_number", { ascending: false }),
      admin
        .from("greyhound_trophy_awards")
        .select(
          [
            "id",
            "competition_history_id",
            "award_key",
            "award_title",
            "recipient_key",
            "recipient_name",
            "award_value",
            "award_detail",
            "created_at",
          ].join(", "),
        )
        .eq("league_id", leagueId)
        .order("created_at", { ascending: false }),
    ]);

    if (historyError) {
      throw new Error(
        `Unable to load Greyhound competition history: ${historyError.message}`,
      );
    }

    if (awardsError) {
      throw new Error(
        `Unable to load Greyhound trophy awards: ${awardsError.message}`,
      );
    }

    const history = (historyRaw ?? []) as unknown as HistoryRow[];
    const awards = (awardsRaw ?? []) as unknown as AwardRow[];

    const awardsByHistoryId = new Map<number, AwardRow[]>();

    for (const award of awards) {
      const historyId = Number(award.competition_history_id);
      const list = awardsByHistoryId.get(historyId) ?? [];
      list.push(award);
      awardsByHistoryId.set(historyId, list);
    }

    const championCounts = new Map<
      string,
      {
        name: string;
        championships: number;
        dailySurvivorWins: number;
        legacyWins: number;
        totalChampionNet: number;
        totalChampionReturned: number;
        latestCompetition: number;
      }
    >();

    for (const row of history) {
      const key = String(row.champion_key ?? row.champion_name);
      const isDailySurvivor = row.game_format === "daily_survivor";

      const existing = championCounts.get(key) ?? {
        name: row.champion_name,
        championships: 0,
        dailySurvivorWins: 0,
        legacyWins: 0,
        totalChampionNet: 0,
        totalChampionReturned: 0,
        latestCompetition: 0,
      };

      existing.name = row.champion_name;
      existing.legacyWins += 1;

      if (isDailySurvivor) {
        existing.dailySurvivorWins += 1;
      } else {
        existing.championships += 1;
        existing.totalChampionNet += numberValue(row.champion_net);
        existing.totalChampionReturned += numberValue(row.champion_returned);
      }

      existing.latestCompetition = Math.max(
        existing.latestCompetition,
        Number(row.competition_number),
      );

      championCounts.set(key, existing);
    }

    const dynastyBoard = Array.from(championCounts.values()).sort(
      (a, b) =>
        b.championships - a.championships ||
        b.dailySurvivorWins - a.dailySurvivorWins ||
        b.legacyWins - a.legacyWins ||
        b.latestCompetition - a.latestCompetition ||
        a.name.localeCompare(b.name),
    );

    const competitions = history.map((row) => ({
      id: Number(row.id),
      competitionNumber: Number(row.competition_number),
      gameFormat: row.game_format,
      competitionStartDate: row.competition_start_date,
      competitionEndDate: row.competition_end_date,
      completedAt: row.completed_at,
      championKey: row.champion_key,
      championName: row.champion_name,
      runnerUpKey: row.runner_up_key,
      runnerUpName: row.runner_up_name,
      totalEntries: Number(row.total_entries ?? 0),
      totalTickets: Number(row.total_tickets ?? 0),
      totalWagered: numberValue(row.total_wagered),
      totalReturned: numberValue(row.total_returned),
      championNet: numberValue(row.champion_net),
      championReturned: numberValue(row.champion_returned),
      standingsSnapshot: Array.isArray(row.standings_snapshot)
        ? row.standings_snapshot
        : [],
      awardsSnapshot:
        row.awards_snapshot && typeof row.awards_snapshot === "object"
          ? row.awards_snapshot
          : {},
      cardsSnapshot: Array.isArray(row.cards_snapshot)
        ? row.cards_snapshot
        : [],
      awards: (awardsByHistoryId.get(Number(row.id)) ?? []).map((award) => {
        const badgeMeta: Record<
          string,
          { icon: string; category: string; tone: string }
        > = {
          champion: {
            icon: "👑",
            category: "CHAMPIONSHIP",
            tone: "gold",
          },
          runner_up: {
            icon: "🥈",
            category: "PODIUM",
            tone: "silver",
          },
          best_net: {
            icon: "💰",
            category: "PERFORMANCE",
            tone: "green",
          },
          highest_returned: {
            icon: "💵",
            category: "PERFORMANCE",
            tone: "orange",
          },
          most_winners: {
            icon: "🎯",
            category: "SKILL",
            tone: "red",
          },
          most_active: {
            icon: "🔥",
            category: "ACTION",
            tone: "orange",
          },
          biggest_return: {
            icon: "💥",
            category: "BIG HIT",
            tone: "red",
          },
          ticket_of_competition: {
            icon: "🎟️",
            category: "SIGNATURE TICKET",
            tone: "gold",
          },
          best_roi: {
            icon: "🧠",
            category: "EFFICIENCY",
            tone: "green",
          },
          clean_card: {
            icon: "🧹",
            category: "SPECIAL",
            tone: "purple",
          },
          daily_survivor_winner: {
            icon: "🏁",
            category: "DAILY SURVIVOR",
            tone: "gold",
          },
          daily_survivor_runner_up: {
            icon: "🥈",
            category: "DAILY SURVIVOR",
            tone: "silver",
          },
        };

        const meta = badgeMeta[award.award_key] ?? {
          icon: "🏅",
          category: "AWARD",
          tone: "orange",
        };

        return {
          id: Number(award.id),
          key: award.award_key,
          title: award.award_title,
          recipientKey: award.recipient_key,
          recipientName: award.recipient_name,
          value:
            award.award_value == null
              ? null
              : numberValue(award.award_value),
          detail: award.award_detail,
          icon: meta.icon,
          category: meta.category,
          tone: meta.tone,
        };
      }),
    }));

    return NextResponse.json(
      {
        success: true,
        league: {
          id: leagueId,
          name: access.league.name,
        },
        summary: {
          competitions: competitions.length,
          uniqueChampions: dynastyBoard.length,
          totalAwards: awards.length,
          latestChampion: competitions[0]?.championName ?? null,
        },
        dynastyBoard,
        competitions,
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      },
    );
  } catch (error) {
    console.error("[greyhound/trophy-case] GET failed", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to load Greyhound Trophy Case.",
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
