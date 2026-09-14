import { NextResponse } from "next/server";

import { requireLeagueMember } from "@/lib/leagues/requireLeagueMember";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type GameFormat =
  | "team_total_winnings"
  | "team_head_to_head"
  | "bankroll"
  | "survivor"
  | "tournament";

type TeamSetupMode = "random" | "manual" | null;

type RequestBody = {
  leagueId?: string;
  action?: string;
  participantId?: number;
  teamId?: number;
  teamName?: string | null;
  entryName?: string | null;
  teamCount?: number;
};

type SettingsRow = {
  game_format: GameFormat;
  team_setup_mode: TeamSetupMode;
  duration_mode: string;
  competition_start_date: string | null;
};

type RoundRow = {
  start_date: string;
};

type IdentityRow = {
  participant_id: number;
  league_id: string;
  fantasy_team_id: number;
  user_id: string | null;
  entry_name: string;
  competition_team_id: number | null;
  team_number: number | null;
  team_name: string | null;
  league_role: string | null;
  member_name: string;
};

type TeamRow = {
  id: number;
  team_number: number;
  team_name: string;
  active: boolean;
};

function jsonError(message: string, status: number) {
  return NextResponse.json(
    {
      success: false,
      error: message,
    },
    {
      status,
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    },
  );
}

function isTeamFormat(gameFormat: string) {
  return (
    gameFormat === "team_total_winnings" ||
    gameFormat === "team_head_to_head"
  );
}

function cleanName(
  value: unknown,
  label: string,
  allowNull = false,
) {
  if (value == null && allowNull) {
    return null;
  }

  const cleaned = String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");

  if (!cleaned) {
    if (allowNull) {
      return null;
    }

    throw new Error(`${label} cannot be blank.`);
  }

  if (cleaned.length > 50) {
    throw new Error(`${label} cannot exceed 50 characters.`);
  }

  return cleaned;
}

function easternDateString(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error("Unable to determine the current Eastern date.");
  }

  return `${year}-${month}-${day}`;
}

async function requireGreyhoundCommissioner(leagueId: string) {
  const access = await requireLeagueMember(leagueId);

  if (String(access.league.leagueType) !== "greyhound") {
    throw new Error(
      "This endpoint is only available for Greyhound leagues.",
    );
  }

  if (!access.isCommissioner) {
    throw new Error(
      "Only the league commissioner can manage Greyhound teams and entries.",
    );
  }

  return access;
}

async function loadSettings(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  leagueId: string,
) {
  const { data: settingsData, error: settingsError } = await admin
    .from("greyhound_league_settings")
    .select(`
      game_format,
      team_setup_mode,
      duration_mode,
      competition_start_date
    `)
    .eq("league_id", leagueId)
    .maybeSingle();

  if (settingsError) {
    throw settingsError;
  }

  if (!settingsData) {
    throw new Error("Greyhound league settings were not found.");
  }

  const settings = settingsData as SettingsRow;

  let competitionStartDate = settings.competition_start_date;

  if (settings.duration_mode === "rounds") {
    const { data: roundData, error: roundError } = await admin
      .from("greyhound_competition_rounds")
      .select("start_date")
      .eq("league_id", leagueId)
      .order("round_number", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (roundError) {
      throw roundError;
    }

    competitionStartDate =
      (roundData as RoundRow | null)?.start_date ??
      competitionStartDate;
  }

  const today = easternDateString();
  const competitionStarted = Boolean(
    competitionStartDate &&
      today >= competitionStartDate,
  );

  return {
    settings,
    competitionStartDate,
    competitionStarted,
  };
}

async function ensureParticipants(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  leagueId: string,
) {
  const { error } = await admin.rpc(
    "ensure_greyhound_participants",
    {
      p_league_id: leagueId,
    },
  );

  if (error) {
    throw error;
  }
}

async function loadWorkspace(leagueId: string) {
  const admin = createSupabaseAdminClient();

  await ensureParticipants(admin, leagueId);

  const {
    settings,
    competitionStartDate,
    competitionStarted,
  } = await loadSettings(admin, leagueId);

  const [
    { data: identityData, error: identityError },
    { data: teamsData, error: teamsError },
  ] = await Promise.all([
    admin
      .from("greyhound_participant_identity")
      .select(`
        participant_id,
        league_id,
        fantasy_team_id,
        user_id,
        entry_name,
        competition_team_id,
        team_number,
        team_name,
        league_role,
        member_name
      `)
      .eq("league_id", leagueId)
      .order("member_name", { ascending: true }),
    admin
      .from("greyhound_competition_teams")
      .select(`
        id,
        team_number,
        team_name,
        active
      `)
      .eq("league_id", leagueId)
      .eq("active", true)
      .order("team_number", { ascending: true }),
  ]);

  if (identityError) {
    throw identityError;
  }

  if (teamsError) {
    throw teamsError;
  }

  const participants = ((identityData ?? []) as IdentityRow[]).map(
    (row) => ({
      participantId: Number(row.participant_id),
      fantasyTeamId: Number(row.fantasy_team_id),
      userId: row.user_id,
      entryName: row.entry_name,
      memberName: row.member_name,
      leagueRole: row.league_role,
      competitionTeamId:
        row.competition_team_id == null
          ? null
          : Number(row.competition_team_id),
      teamNumber:
        row.team_number == null
          ? null
          : Number(row.team_number),
      teamName: row.team_name,
    }),
  );

  const teams = ((teamsData ?? []) as TeamRow[]).map((row) => ({
    id: Number(row.id),
    teamNumber: Number(row.team_number),
    teamName: row.team_name,
    active: Boolean(row.active),
  }));

  return {
    success: true as const,
    leagueId,
    gameFormat: settings.game_format,
    teamSetupMode: settings.team_setup_mode,
    isTeamGame: isTeamFormat(settings.game_format),
    competitionStartDate,
    competitionStarted,
    participants,
    teams,
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const leagueId = (url.searchParams.get("leagueId") ?? "").trim();

  if (!leagueId) {
    return jsonError("leagueId is required.", 400);
  }

  try {
    await requireGreyhoundCommissioner(leagueId);

    const workspace = await loadWorkspace(leagueId);

    return NextResponse.json(workspace, {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    console.error(
      "Greyhound commissioner teams/entries GET failed:",
      error,
    );

    const message =
      error instanceof Error
        ? error.message
        : "Unable to load Greyhound teams and entries.";

    const status =
      message.includes("Only the league commissioner")
        ? 403
        : message.includes("only available")
          ? 400
          : 500;

    return jsonError(message, status);
  }
}

export async function POST(request: Request) {
  const body = (await request
    .json()
    .catch(() => null)) as RequestBody | null;

  const leagueId =
    typeof body?.leagueId === "string"
      ? body.leagueId.trim()
      : "";

  const action =
    typeof body?.action === "string"
      ? body.action.trim()
      : "";

  if (!leagueId) {
    return jsonError("leagueId is required.", 400);
  }

  if (!action) {
    return jsonError("action is required.", 400);
  }

  try {
    await requireGreyhoundCommissioner(leagueId);

    const admin = createSupabaseAdminClient();

    await ensureParticipants(admin, leagueId);

    const {
      settings,
      competitionStarted,
    } = await loadSettings(admin, leagueId);

    const teamGame = isTeamFormat(settings.game_format);

    if (action === "save_entry_name") {
      const participantId = Number(body?.participantId);

      if (!Number.isInteger(participantId) || participantId <= 0) {
        return jsonError("A valid participantId is required.", 400);
      }

      const entryName = cleanName(body?.entryName, "Entry Name");

      const { data, error } = await admin
        .from("greyhound_participants")
        .update({
          entry_name: entryName,
          updated_at: new Date().toISOString(),
        })
        .eq("league_id", leagueId)
        .eq("id", participantId)
        .select("id")
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (!data) {
        return jsonError("Greyhound participant was not found.", 404);
      }
    } else if (action === "rename_team") {
      if (!teamGame) {
        return jsonError(
          "Shared teams are not used by this Greyhound game format.",
          400,
        );
      }

      const teamId = Number(body?.teamId);

      if (!Number.isInteger(teamId) || teamId <= 0) {
        return jsonError("A valid teamId is required.", 400);
      }

      const teamName = cleanName(body?.teamName, "Team Name");

      const { data, error } = await admin
        .from("greyhound_competition_teams")
        .update({
          team_name: teamName,
          updated_at: new Date().toISOString(),
        })
        .eq("league_id", leagueId)
        .eq("id", teamId)
        .select("id")
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (!data) {
        return jsonError("Greyhound competition team was not found.", 404);
      }
    } else if (action === "create_team") {
      if (!teamGame) {
        return jsonError(
          "Shared teams are not used by this Greyhound game format.",
          400,
        );
      }

      if (settings.team_setup_mode !== "manual") {
        return jsonError(
          "Create Team is only available when Team Setup is Manual.",
          400,
        );
      }

      if (competitionStarted) {
        return jsonError(
          "Team structure is locked because the competition has started.",
          409,
        );
      }

      const { data: lastTeam, error: lastTeamError } = await admin
        .from("greyhound_competition_teams")
        .select("team_number")
        .eq("league_id", leagueId)
        .order("team_number", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastTeamError) {
        throw lastTeamError;
      }

      const nextTeamNumber =
        Number(lastTeam?.team_number ?? 0) + 1;

      const teamName =
        cleanName(body?.teamName, "Team Name", true) ??
        `Team ${nextTeamNumber}`;

      const { error } = await admin
        .from("greyhound_competition_teams")
        .insert({
          league_id: leagueId,
          team_number: nextTeamNumber,
          team_name: teamName,
          active: true,
        });

      if (error) {
        throw error;
      }
    } else if (action === "delete_team") {
      if (!teamGame) {
        return jsonError(
          "Shared teams are not used by this Greyhound game format.",
          400,
        );
      }

      if (settings.team_setup_mode !== "manual") {
        return jsonError(
          "Delete Team is only available when Team Setup is Manual.",
          400,
        );
      }

      if (competitionStarted) {
        return jsonError(
          "Team structure is locked because the competition has started.",
          409,
        );
      }

      const teamId = Number(body?.teamId);

      if (!Number.isInteger(teamId) || teamId <= 0) {
        return jsonError("A valid teamId is required.", 400);
      }

      const { error } = await admin
        .from("greyhound_competition_teams")
        .delete()
        .eq("league_id", leagueId)
        .eq("id", teamId);

      if (error) {
        throw error;
      }
    } else if (action === "assign_member") {
      if (!teamGame) {
        return jsonError(
          "Shared teams are not used by this Greyhound game format.",
          400,
        );
      }

      if (settings.team_setup_mode !== "manual") {
        return jsonError(
          "Manual member assignment is only available when Team Setup is Manual.",
          400,
        );
      }

      if (competitionStarted) {
        return jsonError(
          "Team assignments are locked because the competition has started.",
          409,
        );
      }

      const participantId = Number(body?.participantId);
      const teamId = Number(body?.teamId);

      if (!Number.isInteger(participantId) || participantId <= 0) {
        return jsonError("A valid participantId is required.", 400);
      }

      if (!Number.isInteger(teamId) || teamId <= 0) {
        return jsonError("A valid teamId is required.", 400);
      }

      const [
        { data: participant, error: participantError },
        { data: team, error: teamError },
      ] = await Promise.all([
        admin
          .from("greyhound_participants")
          .select("id")
          .eq("league_id", leagueId)
          .eq("id", participantId)
          .maybeSingle(),
        admin
          .from("greyhound_competition_teams")
          .select("id")
          .eq("league_id", leagueId)
          .eq("id", teamId)
          .eq("active", true)
          .maybeSingle(),
      ]);

      if (participantError) {
        throw participantError;
      }

      if (teamError) {
        throw teamError;
      }

      if (!participant) {
        return jsonError("Greyhound participant was not found.", 404);
      }

      if (!team) {
        return jsonError("Greyhound competition team was not found.", 404);
      }

      const { error } = await admin
        .from("greyhound_competition_team_members")
        .upsert(
          {
            league_id: leagueId,
            competition_team_id: teamId,
            participant_id: participantId,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "league_id,participant_id",
          },
        );

      if (error) {
        throw error;
      }
    } else if (action === "unassign_member") {
      if (!teamGame) {
        return jsonError(
          "Shared teams are not used by this Greyhound game format.",
          400,
        );
      }

      if (settings.team_setup_mode !== "manual") {
        return jsonError(
          "Manual member assignment is only available when Team Setup is Manual.",
          400,
        );
      }

      if (competitionStarted) {
        return jsonError(
          "Team assignments are locked because the competition has started.",
          409,
        );
      }

      const participantId = Number(body?.participantId);

      if (!Number.isInteger(participantId) || participantId <= 0) {
        return jsonError("A valid participantId is required.", 400);
      }

      const { error } = await admin
        .from("greyhound_competition_team_members")
        .delete()
        .eq("league_id", leagueId)
        .eq("participant_id", participantId);

      if (error) {
        throw error;
      }
    } else if (action === "randomize_teams") {
      if (!teamGame) {
        return jsonError(
          "Shared teams are not used by this Greyhound game format.",
          400,
        );
      }

      if (settings.team_setup_mode !== "random") {
        return jsonError(
          "Randomize Teams is only available when Team Setup is Random.",
          400,
        );
      }

      if (competitionStarted) {
        return jsonError(
          "Team assignments are locked because the competition has started.",
          409,
        );
      }

      const teamCount = Number(body?.teamCount);

      const {
        data: participantRows,
        error: participantRowsError,
      } = await admin
        .from("greyhound_participants")
        .select("id")
        .eq("league_id", leagueId)
        .order("id", { ascending: true });

      if (participantRowsError) {
        throw participantRowsError;
      }

      const participantIds = (participantRows ?? []).map((row) =>
        Number(row.id),
      );
      const participantCount = participantIds.length;

      if (participantCount < 1) {
        return jsonError(
          "At least 1 active Greyhound participant is required.",
          400,
        );
      }

      if (
        !Number.isInteger(teamCount) ||
        teamCount < 1 ||
        teamCount > participantCount
      ) {
        return jsonError(
          `Choose between 1 and ${participantCount} team${
            participantCount === 1 ? "" : "s"
          }.`,
          400,
        );
      }

      if (teamCount === 1) {
        const { error: membershipDeleteError } = await admin
          .from("greyhound_competition_team_members")
          .delete()
          .eq("league_id", leagueId);

        if (membershipDeleteError) {
          throw membershipDeleteError;
        }

        const { error: teamDeleteError } = await admin
          .from("greyhound_competition_teams")
          .delete()
          .eq("league_id", leagueId);

        if (teamDeleteError) {
          throw teamDeleteError;
        }

        const {
          data: createdTeam,
          error: createTeamError,
        } = await admin
          .from("greyhound_competition_teams")
          .insert({
            league_id: leagueId,
            team_number: 1,
            team_name: "Team 1",
            active: true,
            updated_at: new Date().toISOString(),
          })
          .select("id")
          .single();

        if (createTeamError) {
          throw createTeamError;
        }

        const competitionTeamId = Number(createdTeam.id);

        const memberRows = participantIds.map((participantId) => ({
          league_id: leagueId,
          competition_team_id: competitionTeamId,
          participant_id: participantId,
          updated_at: new Date().toISOString(),
        }));

        const { error: memberInsertError } = await admin
          .from("greyhound_competition_team_members")
          .insert(memberRows);

        if (memberInsertError) {
          throw memberInsertError;
        }
      } else {
        const { error } = await admin.rpc(
          "randomize_greyhound_competition_teams",
          {
            p_league_id: leagueId,
            p_team_count: teamCount,
          },
        );

        if (error) {
          throw error;
        }
      }
    } else {
      return jsonError("Unsupported teams/entries action.", 400);
    }

    const workspace = await loadWorkspace(leagueId);

    return NextResponse.json(workspace, {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    console.error(
      "Greyhound commissioner teams/entries POST failed:",
      error,
    );

    const message =
      error instanceof Error
        ? error.message
        : "Unable to update Greyhound teams and entries.";

    const status =
      message.includes("Only the league commissioner")
        ? 403
        : message.includes("only available")
          ? 400
          : 500;

    return jsonError(message, status);
  }
}
