import { NextResponse } from "next/server";
import { requireLeagueMember } from "@/lib/leagues/requireLeagueMember";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const GAME_FORMATS = [
  "team_total_winnings",
  "team_head_to_head",
  "bankroll",
  "survivor",
  "tournament",
] as const;

const TEAM_SETUP_MODES = ["random", "manual"] as const;
const DURATION_MODES = ["single_day", "date_range", "weeks", "rounds"] as const;

type GameFormat = (typeof GAME_FORMATS)[number];
type TeamSetupMode = (typeof TEAM_SETUP_MODES)[number];
type DurationMode = (typeof DURATION_MODES)[number];

type RoundInput = {
  roundNumber?: unknown;
  name?: unknown;
  startDate?: unknown;
  days?: unknown;
};

function jsonError(error: string, status: number) {
  return NextResponse.json(
    { success: false, error },
    { status, headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}

function isDateString(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function addDays(dateText: string, daysToAdd: number) {
  const [year, month, day] = dateText.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + daysToAdd);
  return date.toISOString().slice(0, 10);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const leagueId = String(body?.leagueId ?? "").trim();
    const gameFormat = String(body?.gameFormat ?? "").trim() as GameFormat;
    const durationMode = String(body?.durationMode ?? "").trim() as DurationMode;
    const teamSetupMode = body?.teamSetupMode
      ? (String(body.teamSetupMode).trim() as TeamSetupMode)
      : null;
    const startingBankroll = Number(body?.startingBankroll);
    const weeks = body?.weeks == null ? null : Number(body.weeks);
    const startDate = body?.startDate == null ? null : String(body.startDate).trim();
    const endDate = body?.endDate == null ? null : String(body.endDate).trim();
    const rounds = Array.isArray(body?.rounds) ? (body.rounds as RoundInput[]) : [];

    if (!leagueId) {
      return jsonError("leagueId is required.", 400);
    }

    if (!GAME_FORMATS.includes(gameFormat)) {
      return jsonError("Invalid Greyhound game format.", 400);
    }

    if (!DURATION_MODES.includes(durationMode)) {
      return jsonError("Invalid Greyhound duration mode.", 400);
    }

    if (!Number.isFinite(startingBankroll) || startingBankroll <= 0) {
      return jsonError("Starting bankroll must be greater than $0.", 400);
    }

    const isTeamGame =
      gameFormat === "team_total_winnings" || gameFormat === "team_head_to_head";
    const isRoundGame = gameFormat === "survivor" || gameFormat === "tournament";

    if (isTeamGame && (!teamSetupMode || !TEAM_SETUP_MODES.includes(teamSetupMode))) {
      return jsonError("Choose random or manual team setup.", 400);
    }

    if (isRoundGame && durationMode !== "rounds") {
      return jsonError("Survivor and Tournament must use round scheduling.", 400);
    }

    if (!isRoundGame && durationMode === "rounds") {
      return jsonError("This Greyhound game type does not use round scheduling.", 400);
    }

    const access = await requireLeagueMember(leagueId);

    if (String(access.league.leagueType) !== "greyhound") {
      return jsonError("This endpoint is only available for Greyhound leagues.", 400);
    }

    if (!access.isCommissioner) {
      return jsonError("Only the league commissioner can save Greyhound game setup.", 403);
    }

    let normalizedStartDate: string | null = null;
    let normalizedEndDate: string | null = null;
    let normalizedWeeks: number | null = null;

    const normalizedRounds: Array<{
      league_id: string;
      round_number: number;
      round_name: string;
      start_date: string;
      number_of_days: number;
      end_date: string;
      elimination_count: number;
    }> = [];

    if (isRoundGame) {
      if (rounds.length < 1) {
        return jsonError("Add at least one Greyhound round.", 400);
      }

      let previousEndDate: string | null = null;

      for (let index = 0; index < rounds.length; index += 1) {
        const round = rounds[index] ?? {};
        const roundNumber = Number(round.roundNumber ?? index + 1);
        const name = String(round.name ?? "").trim();
        const roundStartDate = String(round.startDate ?? "").trim();
        const days = Number(round.days);

        if (!Number.isInteger(roundNumber) || roundNumber !== index + 1) {
          return jsonError("Greyhound round numbers must be sequential.", 400);
        }

        if (!name) {
          return jsonError(`Round ${index + 1} needs a name.`, 400);
        }

        if (!isDateString(roundStartDate)) {
          return jsonError(`${name} needs a valid start date.`, 400);
        }

        if (!Number.isInteger(days) || days < 1 || days > 365) {
          return jsonError(`${name} must run for 1 to 365 days.`, 400);
        }

        const roundEndDate = addDays(roundStartDate, days - 1);

        if (previousEndDate && roundStartDate <= previousEndDate) {
          return jsonError(
            `${name} must start after the prior round has ended.`,
            400,
          );
        }

        normalizedRounds.push({
          league_id: leagueId,
          round_number: roundNumber,
          round_name: name,
          start_date: roundStartDate,
          number_of_days: days,
          end_date: roundEndDate,
          elimination_count: gameFormat === "survivor" ? 1 : 0,
        });

        previousEndDate = roundEndDate;
      }

      normalizedStartDate = normalizedRounds[0].start_date;
      normalizedEndDate = normalizedRounds[normalizedRounds.length - 1].end_date;
    } else {
      if (!isDateString(startDate)) {
        return jsonError("Choose a valid Greyhound competition start date.", 400);
      }

      normalizedStartDate = startDate;

      if (durationMode === "single_day") {
        normalizedEndDate = startDate;
      } else if (durationMode === "date_range") {
        if (!isDateString(endDate)) {
          return jsonError("Choose a valid Greyhound competition end date.", 400);
        }

        if (endDate < startDate) {
          return jsonError("End date cannot be before the start date.", 400);
        }

        normalizedEndDate = endDate;
      } else if (durationMode === "weeks") {
        if (!Number.isInteger(weeks) || Number(weeks) < 1 || Number(weeks) > 52) {
          return jsonError("Greyhound competition weeks must be between 1 and 52.", 400);
        }

        normalizedWeeks = Number(weeks);
        normalizedEndDate = addDays(startDate, normalizedWeeks * 7 - 1);
      }
    }

    const admin = createSupabaseAdminClient();

    const settingsPatch = {
      game_format: gameFormat,
      team_setup_mode: isTeamGame ? teamSetupMode : null,
      duration_mode: isRoundGame ? "rounds" : durationMode,
      competition_start_date: normalizedStartDate,
      competition_end_date: normalizedEndDate,
      competition_weeks: normalizedWeeks,
      starting_bankroll: startingBankroll,
      updated_at: new Date().toISOString(),
    };

    const { data: updatedSettings, error: updateError } = await admin
      .from("greyhound_league_settings")
      .update(settingsPatch)
      .eq("league_id", leagueId)
      .select("league_id")
      .maybeSingle();

    if (updateError) {
      return jsonError(updateError.message, 500);
    }

    if (!updatedSettings) {
      const { error: insertError } = await admin
        .from("greyhound_league_settings")
        .insert({
          league_id: leagueId,
          ...settingsPatch,
        });

      if (insertError) {
        return jsonError(insertError.message, 500);
      }
    }

    const { error: deleteRoundsError } = await admin
      .from("greyhound_competition_rounds")
      .delete()
      .eq("league_id", leagueId);

    if (deleteRoundsError) {
      return jsonError(deleteRoundsError.message, 500);
    }

    if (normalizedRounds.length > 0) {
      const { error: roundsError } = await admin
        .from("greyhound_competition_rounds")
        .insert(normalizedRounds);

      if (roundsError) {
        return jsonError(roundsError.message, 500);
      }
    }

    return NextResponse.json(
      {
        success: true,
        leagueId,
        gameFormat,
        teamSetupMode: isTeamGame ? teamSetupMode : null,
        durationMode: isRoundGame ? "rounds" : durationMode,
        competitionStartDate: normalizedStartDate,
        competitionEndDate: normalizedEndDate,
        competitionWeeks: normalizedWeeks,
        startingBankroll,
        rounds: normalizedRounds.map((round) => ({
          roundNumber: round.round_number,
          name: round.round_name,
          startDate: round.start_date,
          days: round.number_of_days,
          endDate: round.end_date,
          eliminationCount: round.elimination_count,
        })),
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (error) {
    console.error("Greyhound league setup failed:", error);

    return jsonError(
      error instanceof Error ? error.message : "Unable to save Greyhound game setup.",
      500,
    );
  }
}
