import { redirect } from "next/navigation";

import GreyhoundCommissionerSettings, {
  type GreyhoundCommissionerSettingsData,
} from "@/components/greyhound/GreyhoundCommissionerSettings";
import { requireLeagueMember } from "@/lib/leagues/requireLeagueMember";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type PageProps = {
  params: Promise<{
    leagueId: string;
  }>;
};

type SettingsRow = {
  game_format: GreyhoundCommissionerSettingsData["gameFormat"];
  team_setup_mode: GreyhoundCommissionerSettingsData["teamSetupMode"];
  survivor_mode: GreyhoundCommissionerSettingsData["survivorMode"];
  duration_mode: GreyhoundCommissionerSettingsData["durationMode"];
  competition_start_date: string | null;
  competition_end_date: string | null;
  competition_weeks: number | null;
  competition_days: number[] | null;
  starting_bankroll: number | string;
  track_scope: GreyhoundCommissionerSettingsData["trackScope"];
  wagering_style: GreyhoundCommissionerSettingsData["wageringStyle"];
  live_race_lock_minutes_before_post: number | null;
  live_mandatory_race_action: boolean | null;
  live_minimum_wager_percent: number | string | null;
  live_auto_wager_enabled: boolean | null;
  card_lock_minutes_before_first_post: number;
  scratch_check_minutes_before_first_post: number;
  entry_pull_timezone: string;
  allow_win: boolean;
  allow_place: boolean;
  allow_show: boolean;
  allow_exacta: boolean;
  allow_quinella: boolean;
  allow_trifecta: boolean;
  allow_superfecta: boolean;
};

type RoundRow = {
  id: number;
  round_number: number;
  round_name: string;
  start_date: string;
  number_of_days: number;
  end_date: string;
};

export default async function GreyhoundCommissionerSettingsPage({
  params,
}: PageProps) {
  const { leagueId } = await params;

  const access = await requireLeagueMember(leagueId);

  if (String(access.league.leagueType) !== "greyhound") {
    redirect(`/league/${leagueId}`);
  }

  if (!access.isCommissioner) {
    redirect(`/league/${leagueId}`);
  }

  const admin = createSupabaseAdminClient();

  const [
    { data: settingsData, error: settingsError },
    { data: roundsData, error: roundsError },
  ] = await Promise.all([
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
        wagering_style,
        live_race_lock_minutes_before_post,
        live_mandatory_race_action,
        live_minimum_wager_percent,
        live_auto_wager_enabled,
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
    throw new Error(settingsError.message);
  }

  if (roundsError) {
    throw new Error(roundsError.message);
  }

  const row = settingsData as SettingsRow | null;
  const rounds = (roundsData ?? []) as RoundRow[];

  const initialSettings: GreyhoundCommissionerSettingsData = {
    gameFormat: row?.game_format ?? "bankroll",
    teamSetupMode: row?.team_setup_mode ?? null,
    survivorMode: row?.survivor_mode === "daily" ? "daily" : "round",
    durationMode: row?.duration_mode ?? "single_day",
    competitionStartDate: row?.competition_start_date ?? null,
    competitionEndDate: row?.competition_end_date ?? null,
    competitionWeeks: row?.competition_weeks ?? null,
    competitionDays: Array.isArray(row?.competition_days)
      ? row.competition_days.filter(
          (day): day is 0 | 1 | 2 | 3 | 4 | 5 | 6 =>
            Number.isInteger(day) && day >= 0 && day <= 6,
        )
      : [0, 1, 2, 3, 4, 5, 6],
    startingBankroll: Number(row?.starting_bankroll ?? 100),
    trackScope: row?.track_scope ?? "wheeling",

    wageringStyle:
      row?.wagering_style === "live_bankroll"
        ? "live_bankroll"
        : "whole_card",
    liveRaceLockMinutesBeforePost:
      row?.live_race_lock_minutes_before_post ?? 5,
    liveMandatoryRaceAction:
      row?.live_mandatory_race_action ?? false,
    liveMinimumWagerPercent:
      Number(row?.live_minimum_wager_percent ?? 10),
    liveAutoWagerEnabled:
      row?.live_auto_wager_enabled ?? true,

    cardLockMinutesBeforeFirstPost:
      row?.card_lock_minutes_before_first_post ?? 5,
    scratchCheckMinutesBeforeFirstPost:
      row?.scratch_check_minutes_before_first_post ?? 60,
    entryPullTimezone: row?.entry_pull_timezone ?? "America/New_York",
    allowWin: row?.allow_win ?? true,
    allowPlace: row?.allow_place ?? true,
    allowShow: row?.allow_show ?? true,
    allowExacta: row?.allow_exacta ?? true,
    allowQuinella: row?.allow_quinella ?? true,
    allowTrifecta: row?.allow_trifecta ?? true,
    allowSuperfecta: row?.allow_superfecta ?? true,
    rounds: rounds.map((round) => ({
      id: round.id,
      roundNumber: round.round_number,
      name: round.round_name,
      startDate: round.start_date,
      days: round.number_of_days,
      endDate: round.end_date,
    })),
  };

  return (
    <GreyhoundCommissionerSettings
      leagueId={leagueId}
      initialSettings={initialSettings}
    />
  );
}
