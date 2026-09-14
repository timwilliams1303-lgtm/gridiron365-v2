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
const SURVIVOR_MODES = ["round", "daily"] as const;
const DURATION_MODES = ["single_day", "date_range", "weeks", "rounds"] as const;
const VALID_COMPETITION_DAYS = [0, 1, 2, 3, 4, 5, 6] as const;

type GameFormat = (typeof GAME_FORMATS)[number];
type TeamSetupMode = (typeof TEAM_SETUP_MODES)[number];
type SurvivorMode = (typeof SURVIVOR_MODES)[number];
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

function weekdayForDate(dateText: string) {
  const [year, month, day] = dateText.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function normalizeCompetitionDays(value: unknown) {
  if (!Array.isArray(value)) return [];

  return Array.from(
    new Set(
      value
        .map((item) => Number(item))
        .filter(
          (item): item is number =>
            Number.isInteger(item) &&
            VALID_COMPETITION_DAYS.includes(
              item as (typeof VALID_COMPETITION_DAYS)[number],
            ),
        ),
    ),
  ).sort((a, b) => a - b);
}

function asBoolean(value: unknown) {
  return value === true;
}

function asInteger(value: unknown) {
  const number = Number(value);
  return Number.isInteger(number) ? number : null;
}

function normalizeSettingsResponse(
  row: Record<string, unknown>,
  rounds: Array<Record<string, unknown>>,
) {
  return {
    gameFormat: row.game_format,
    teamSetupMode: row.team_setup_mode,
    survivorMode: row.survivor_mode === "daily" ? "daily" : "round",
    durationMode: row.duration_mode,
    competitionStartDate: row.competition_start_date,
    competitionEndDate: row.competition_end_date,
    competitionWeeks: row.competition_weeks,
    competitionDays: normalizeCompetitionDays(row.competition_days).length > 0
      ? normalizeCompetitionDays(row.competition_days)
      : [...VALID_COMPETITION_DAYS],
    startingBankroll: Number(row.starting_bankroll ?? 0),
    trackScope: row.track_scope,
    cardLockMinutesBeforeFirstPost: Number(
      row.card_lock_minutes_before_first_post ?? 0,
    ),
    scratchCheckMinutesBeforeFirstPost: Number(
      row.scratch_check_minutes_before_first_post ?? 0,
    ),
    entryPullTimezone: row.entry_pull_timezone,
    allowWin: Boolean(row.allow_win),
    allowPlace: Boolean(row.allow_place),
    allowShow: Boolean(row.allow_show),
    allowExacta: Boolean(row.allow_exacta),
    allowQuinella: Boolean(row.allow_quinella),
    allowTrifecta: Boolean(row.allow_trifecta),
    allowSuperfecta: Boolean(row.allow_superfecta),
    rounds: rounds.map((round) => ({
      id: Number(round.id),
      roundNumber: Number(round.round_number),
      name: String(round.round_name ?? ""),
      startDate: String(round.start_date ?? ""),
      days: Number(round.number_of_days ?? 0),
      endDate: String(round.end_date ?? ""),
    })),
  };
}

async function requireCommissioner(leagueId: string) {
  const access = await requireLeagueMember(leagueId);

  if (String(access.league.leagueType) !== "greyhound") {
    throw new Error("GREYHOUND_ONLY");
  }

  if (!access.isCommissioner) {
    throw new Error("COMMISSIONER_ONLY");
  }

  return access;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const leagueId = (url.searchParams.get("leagueId") ?? "").trim();

    if (!leagueId) {
      return jsonError("leagueId is required.", 400);
    }

    try {
      await requireCommissioner(leagueId);
    } catch (error) {
      if (error instanceof Error && error.message === "GREYHOUND_ONLY") {
        return jsonError("This endpoint is only available for Greyhound leagues.", 400);
      }

      if (error instanceof Error && error.message === "COMMISSIONER_ONLY") {
        return jsonError("Only the commissioner can manage Greyhound settings.", 403);
      }

      throw error;
    }

    const admin = createSupabaseAdminClient();

    const [{ data: settings, error: settingsError }, { data: rounds, error: roundsError }] =
      await Promise.all([
        admin
          .from("greyhound_league_settings")
          .select(`
            game_format,
            team_setup_mode,
            survivor_mode,
            duration_mode,
            competition_start_date,
            competition_end_date,
            competition_weeks,
            competition_days,
            starting_bankroll,
            track_scope,
            card_lock_minutes_before_first_post,
            scratch_check_minutes_before_first_post,
            entry_pull_timezone,
            allow_win,
            allow_place,
            allow_show,
            allow_exacta,
            allow_quinella,
            allow_trifecta,
            allow_superfecta
          `)
          .eq("league_id", leagueId)
          .maybeSingle(),
        admin
          .from("greyhound_competition_rounds")
          .select(`
            id,
            round_number,
            round_name,
            start_date,
            number_of_days,
            end_date
          `)
          .eq("league_id", leagueId)
          .order("round_number", { ascending: true }),
      ]);

    if (settingsError) {
      return jsonError(settingsError.message, 500);
    }

    if (!settings) {
      return jsonError("Greyhound league settings were not found.", 404);
    }

    if (roundsError) {
      return jsonError(roundsError.message, 500);
    }

    return NextResponse.json(
      {
        success: true,
        settings: normalizeSettingsResponse(
          settings as Record<string, unknown>,
          (rounds ?? []) as Array<Record<string, unknown>>,
        ),
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (error) {
    console.error("Greyhound commissioner settings GET failed:", error);
    return jsonError(
      error instanceof Error
        ? error.message
        : "Unable to load Greyhound commissioner settings.",
      500,
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const url = new URL(request.url);
    const leagueId = (url.searchParams.get("leagueId") ?? "").trim();

    if (!leagueId) {
      return jsonError("leagueId is required.", 400);
    }

    try {
      await requireCommissioner(leagueId);
    } catch (error) {
      if (error instanceof Error && error.message === "GREYHOUND_ONLY") {
        return jsonError("This endpoint is only available for Greyhound leagues.", 400);
      }

      if (error instanceof Error && error.message === "COMMISSIONER_ONLY") {
        return jsonError("Only the commissioner can manage Greyhound settings.", 403);
      }

      throw error;
    }

    const body = await request.json();

    const gameFormat = String(body?.gameFormat ?? "") as GameFormat;
    const teamSetupMode = body?.teamSetupMode
      ? (String(body.teamSetupMode) as TeamSetupMode)
      : null;
    const survivorMode = String(
      body?.survivorMode ?? "round",
    ) as SurvivorMode;
    const requestedDurationMode = String(
      body?.durationMode ?? "",
    ) as DurationMode;

    const startingBankroll = Number(body?.startingBankroll);
    const cardLockMinutes = asInteger(body?.cardLockMinutesBeforeFirstPost);
    const scratchCheckMinutes = asInteger(
      body?.scratchCheckMinutesBeforeFirstPost,
    );
    const entryPullTimezone = String(body?.entryPullTimezone ?? "").trim();

    const competitionStartDate =
      body?.competitionStartDate == null
        ? null
        : String(body.competitionStartDate).trim();

    const competitionEndDate =
      body?.competitionEndDate == null
        ? null
        : String(body.competitionEndDate).trim();

    const competitionWeeks =
      body?.competitionWeeks == null || body?.competitionWeeks === ""
        ? null
        : asInteger(body.competitionWeeks);

    const requestedCompetitionDays = normalizeCompetitionDays(
      body?.competitionDays,
    );

    const rounds = Array.isArray(body?.rounds)
      ? (body.rounds as RoundInput[])
      : [];

    if (!GAME_FORMATS.includes(gameFormat)) {
      return jsonError("Invalid Greyhound game format.", 400);
    }

    if (!DURATION_MODES.includes(requestedDurationMode)) {
      return jsonError("Invalid Greyhound duration mode.", 400);
    }

    if (!Number.isFinite(startingBankroll) || startingBankroll <= 0) {
      return jsonError("Starting bankroll must be greater than $0.", 400);
    }

    if (
      cardLockMinutes == null ||
      cardLockMinutes < 0 ||
      cardLockMinutes > 1440
    ) {
      return jsonError("Card lock must be between 0 and 1,440 minutes.", 400);
    }

    if (
      scratchCheckMinutes == null ||
      scratchCheckMinutes < 0 ||
      scratchCheckMinutes > 1440
    ) {
      return jsonError("Scratch check must be between 0 and 1,440 minutes.", 400);
    }

    if (!entryPullTimezone) {
      return jsonError("Racing time zone is required.", 400);
    }

    const isTeamGame =
      gameFormat === "team_total_winnings" ||
      gameFormat === "team_head_to_head";

    if (
      gameFormat === "survivor" &&
      !SURVIVOR_MODES.includes(survivorMode)
    ) {
      return jsonError("Choose a valid Survivor mode.", 400);
    }

    const isRoundGame =
      gameFormat === "tournament" ||
      (gameFormat === "survivor" && survivorMode === "round");

    if (
      isTeamGame &&
      (!teamSetupMode || !TEAM_SETUP_MODES.includes(teamSetupMode))
    ) {
      return jsonError("Choose random or manual team setup.", 400);
    }

    const normalizedRounds: Array<{
      league_id: string;
      round_number: number;
      round_name: string;
      start_date: string;
      number_of_days: number;
      end_date: string;
      elimination_count: number;
    }> = [];

    let normalizedStartDate: string | null = null;
    let normalizedEndDate: string | null = null;
    let normalizedWeeks: number | null = null;
    let normalizedCompetitionDays = requestedCompetitionDays;
    let durationMode: DurationMode = requestedDurationMode;

    if (isRoundGame) {
      durationMode = "rounds";

      if (rounds.length < 1) {
        return jsonError("Add at least one Greyhound round.", 400);
      }

      let previousEndDate: string | null = null;

      for (let index = 0; index < rounds.length; index += 1) {
        const input = rounds[index] ?? {};
        const roundNumber = index + 1;
        const name = String(input.name ?? "").trim();
        const startDate = String(input.startDate ?? "").trim();
        const days = Number(input.days);

        if (!name) {
          return jsonError(`Round ${roundNumber} needs a name.`, 400);
        }

        if (!isDateString(startDate)) {
          return jsonError(`${name} needs a valid start date.`, 400);
        }

        if (!Number.isInteger(days) || days < 1 || days > 365) {
          return jsonError(`${name} must run for 1 to 365 days.`, 400);
        }

        const endDate = addDays(startDate, days - 1);

        if (previousEndDate && startDate <= previousEndDate) {
          return jsonError(
            `${name} must start after the prior round has ended.`,
            400,
          );
        }

        normalizedRounds.push({
          league_id: leagueId,
          round_number: roundNumber,
          round_name: name,
          start_date: startDate,
          number_of_days: days,
          end_date: endDate,
          elimination_count: gameFormat === "survivor" ? 1 : 0,
        });

        previousEndDate = endDate;
      }

      normalizedStartDate = normalizedRounds[0].start_date;
      normalizedEndDate =
        normalizedRounds[normalizedRounds.length - 1].end_date;
    } else {
      if (durationMode === "rounds") {
        return jsonError(
          "This Greyhound game type does not use round scheduling.",
          400,
        );
      }

      if (!isDateString(competitionStartDate)) {
        return jsonError("Choose a valid competition start date.", 400);
      }

      normalizedStartDate = competitionStartDate;

      if (durationMode === "single_day") {
        normalizedEndDate = competitionStartDate;
        normalizedCompetitionDays = [weekdayForDate(competitionStartDate)];
      } else if (durationMode === "date_range") {
        if (requestedCompetitionDays.length === 0) {
          return jsonError("Choose at least one competition day.", 400);
        }
        if (!isDateString(competitionEndDate)) {
          return jsonError("Choose a valid competition end date.", 400);
        }

        if (competitionEndDate < competitionStartDate) {
          return jsonError(
            "Competition end date cannot be before the start date.",
            400,
          );
        }

        normalizedEndDate = competitionEndDate;
      } else if (durationMode === "weeks") {
        if (requestedCompetitionDays.length === 0) {
          return jsonError("Choose at least one competition day.", 400);
        }

        if (
          competitionWeeks == null ||
          competitionWeeks < 1 ||
          competitionWeeks > 52
        ) {
          return jsonError("Number of weeks must be between 1 and 52.", 400);
        }

        normalizedWeeks = competitionWeeks;
        normalizedEndDate = addDays(
          competitionStartDate,
          competitionWeeks * 7 - 1,
        );
      }
    }

    const settingsPatch = {
      game_format: gameFormat,
      team_setup_mode: isTeamGame ? teamSetupMode : null,
      survivor_mode: gameFormat === "survivor" ? survivorMode : "round",
      duration_mode: durationMode,
      competition_start_date: normalizedStartDate,
      competition_end_date: normalizedEndDate,
      competition_weeks: normalizedWeeks,
      competition_days:
        normalizedCompetitionDays.length > 0
          ? normalizedCompetitionDays
          : [...VALID_COMPETITION_DAYS],
      starting_bankroll: startingBankroll,
      card_lock_minutes_before_first_post: cardLockMinutes,
      scratch_check_minutes_before_first_post: scratchCheckMinutes,
      entry_pull_timezone: entryPullTimezone,
      allow_win: asBoolean(body?.allowWin),
      allow_place: asBoolean(body?.allowPlace),
      allow_show: asBoolean(body?.allowShow),
      allow_exacta: asBoolean(body?.allowExacta),
      allow_perfecta: false,
      allow_quinella: asBoolean(body?.allowQuinella),
      allow_trifecta: asBoolean(body?.allowTrifecta),
      allow_superfecta: asBoolean(body?.allowSuperfecta),
      updated_at: new Date().toISOString(),
    };

    const admin = createSupabaseAdminClient();

    const { data: updatedSettings, error: settingsError } = await admin
      .from("greyhound_league_settings")
      .update(settingsPatch)
      .eq("league_id", leagueId)
      .select(`
        game_format,
        team_setup_mode,
        survivor_mode,
        duration_mode,
        competition_start_date,
        competition_end_date,
        competition_weeks,
        competition_days,
        starting_bankroll,
        track_scope,
        card_lock_minutes_before_first_post,
        scratch_check_minutes_before_first_post,
        entry_pull_timezone,
        allow_win,
        allow_place,
        allow_show,
        allow_exacta,
        allow_quinella,
        allow_trifecta,
        allow_superfecta
      `)
      .maybeSingle();

    if (settingsError) {
      return jsonError(settingsError.message, 500);
    }

    if (!updatedSettings) {
      return jsonError("Greyhound league settings were not found.", 404);
    }

    const { error: deleteRoundsError } = await admin
      .from("greyhound_competition_rounds")
      .delete()
      .eq("league_id", leagueId);

    if (deleteRoundsError) {
      return jsonError(deleteRoundsError.message, 500);
    }

    if (normalizedRounds.length > 0) {
      const { error: insertRoundsError } = await admin
        .from("greyhound_competition_rounds")
        .insert(normalizedRounds);

      if (insertRoundsError) {
        return jsonError(insertRoundsError.message, 500);
      }
    }

    const { data: savedRounds, error: savedRoundsError } = await admin
      .from("greyhound_competition_rounds")
      .select(`
        id,
        round_number,
        round_name,
        start_date,
        number_of_days,
        end_date
      `)
      .eq("league_id", leagueId)
      .order("round_number", { ascending: true });

    if (savedRoundsError) {
      return jsonError(savedRoundsError.message, 500);
    }

    return NextResponse.json(
      {
        success: true,
        settings: normalizeSettingsResponse(
          updatedSettings as Record<string, unknown>,
          (savedRounds ?? []) as Array<Record<string, unknown>>,
        ),
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (error) {
    console.error("Greyhound commissioner settings PATCH failed:", error);

    return jsonError(
      error instanceof Error
        ? error.message
        : "Unable to save Greyhound commissioner settings.",
      500,
    );
  }
}