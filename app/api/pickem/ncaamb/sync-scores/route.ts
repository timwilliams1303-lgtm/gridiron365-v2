import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type SyncCandidate = {
  game_id: number;
  provider_event_id: string;
  kickoff_at: string;
  home_team_name: string | null;
  away_team_name: string | null;
  is_started: boolean;
  is_final: boolean;
};

type EspnCompetitor = {
  homeAway?: string;
  score?: string | number | null;
  team?: {
    id?: string | number | null;
    displayName?: string | null;
    shortDisplayName?: string | null;
    abbreviation?: string | null;
  };
};

type SyncTarget = {
  league_id: string;
  league_name: string | null;
  season: number;
};

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is not configured.");
  }

  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function isAuthorized(request: NextRequest) {
  const configuredSecret = process.env.GRIDIRON_SYNC_SECRET;

  if (!configuredSecret) {
    return process.env.NODE_ENV !== "production";
  }

  return (
    request.headers.get("x-gridiron-sync-secret") ===
    configuredSecret
  );
}

function asNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
}

function asNullableString(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const stringValue = String(value).trim();

  return stringValue.length > 0 ? stringValue : null;
}

function parsePositiveInteger(
  value: string | null,
  fallback: number,
  minimum: number,
  maximum: number
) {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(
    minimum,
    Math.min(maximum, Math.trunc(parsed))
  );
}

function getCompetitor(
  competitors: EspnCompetitor[],
  homeAway: "home" | "away"
) {
  return (
    competitors.find(
      (competitor) => competitor?.homeAway === homeAway
    ) ?? null
  );
}

async function syncScores(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      {
        success: false,
        error: "Unauthorized",
      },
      {
        status: 401,
      }
    );
  }

  try {
    const supabase = getSupabaseAdmin();
    const searchParams = request.nextUrl.searchParams;

    const leagueId =
      searchParams.get("leagueId")?.trim() ?? null;

    const seasonRaw =
      searchParams.get("season")?.trim() ?? null;

    const season = seasonRaw
      ? Number(seasonRaw)
      : new Date().getUTCFullYear();

    if (!Number.isInteger(season)) {
      return NextResponse.json(
        {
          success: false,
          error: "season must be an integer.",
        },
        {
          status: 400,
        }
      );
    }

    const limit = parsePositiveInteger(
      searchParams.get("limit"),
      100,
      1,
      500
    );

    const pastHours = parsePositiveInteger(
      searchParams.get("pastHours"),
      12,
      1,
      168
    );

    const futureHours = parsePositiveInteger(
      searchParams.get("futureHours"),
      8,
      1,
      168
    );

    let targets: SyncTarget[] = [];

    if (leagueId) {
      const { data: leagueRow, error: leagueError } =
        await supabase
          .from("leagues")
          .select("id,name,season")
          .eq("id", leagueId)
          .maybeSingle();

      if (leagueError) {
        throw new Error(
          `Unable to load league: ${leagueError.message}`
        );
      }

      if (!leagueRow) {
        return NextResponse.json(
          {
            success: false,
            error: "League not found.",
          },
          {
            status: 404,
          }
        );
      }

      targets = [
        {
          league_id: String(leagueRow.id),
          league_name:
            leagueRow.name !== null &&
            leagueRow.name !== undefined
              ? String(leagueRow.name)
              : null,
          season,
        },
      ];
    } else {
      const { data: targetRows, error: targetError } =
        await supabase.rpc(
          "get_ncaamb_pickem_sync_targets"
        );

      if (targetError) {
        throw new Error(
          `Unable to load NCAAMB sync targets: ${targetError.message}`
        );
      }

      targets = Array.isArray(targetRows)
        ? targetRows
            .filter(
              (row: any) =>
                Number(row.season) === season
            )
            .map((row: any) => ({
              league_id: String(row.league_id),
              league_name:
                row.league_name !== null &&
                row.league_name !== undefined
                  ? String(row.league_name)
                  : null,
              season: Number(row.season),
            }))
        : [];
    }

    const results: any[] = [];

    let totalCandidates = 0;
    let totalUpdated = 0;
    let totalScheduled = 0;
    let totalLive = 0;
    let totalFinal = 0;
    let totalSkipped = 0;
    let totalErrors = 0;

    for (const target of targets) {
      const {
        data: candidateRows,
        error: candidateError,
      } = await supabase.rpc(
        "get_ncaamb_games_needing_score_sync",
        {
          p_league_id: target.league_id,
          p_season: target.season,
          p_lookback_hours: pastHours,
          p_lookahead_hours: futureHours,
        }
      );

      if (candidateError) {
        results.push({
          leagueId: target.league_id,
          leagueName: target.league_name,
          season: target.season,
          success: false,
          error: candidateError.message,
        });

        totalErrors += 1;
        continue;
      }

      const candidates = Array.isArray(candidateRows)
        ? (candidateRows as SyncCandidate[]).slice(0, limit)
        : [];

      totalCandidates += candidates.length;

      const leagueResult = {
        leagueId: target.league_id,
        leagueName: target.league_name,
        season: target.season,
        success: true,
        candidates: candidates.length,
        updated: 0,
        scheduled: 0,
        live: 0,
        final: 0,
        skipped: 0,
        errors: 0,
        games: [] as any[],
      };

      for (const candidate of candidates) {
        const eventId = String(
          candidate.provider_event_id ?? ""
        ).trim();

        if (!eventId) {
          leagueResult.skipped += 1;
          totalSkipped += 1;

          leagueResult.games.push({
            gameId: candidate.game_id,
            success: false,
            skipped: true,
            reason: "Missing provider_event_id",
          });

          continue;
        }

        try {
          const espnUrl =
            "https://site.api.espn.com/apis/site/v2/sports/" +
            "basketball/mens-college-basketball/summary?event=" +
            encodeURIComponent(eventId);

          const espnResponse = await fetch(espnUrl, {
            cache: "no-store",
            headers: {
              Accept: "application/json",
              "User-Agent":
                "Mozilla/5.0 (compatible; Gridiron365/1.0)",
            },
          });

          if (!espnResponse.ok) {
            leagueResult.errors += 1;
            totalErrors += 1;

            leagueResult.games.push({
              gameId: candidate.game_id,
              eventId,
              success: false,
              error: `ESPN returned ${espnResponse.status}`,
            });

            continue;
          }

          const data = await espnResponse.json();

          const competition =
            data?.header?.competitions?.[0] ?? null;

          if (!competition) {
            leagueResult.skipped += 1;
            totalSkipped += 1;

            leagueResult.games.push({
              gameId: candidate.game_id,
              eventId,
              success: false,
              skipped: true,
              reason:
                "ESPN response missing header.competitions[0]",
            });

            continue;
          }

          const competitors = Array.isArray(
            competition?.competitors
          )
            ? (competition.competitors as EspnCompetitor[])
            : [];

          const awayCompetitor = getCompetitor(
            competitors,
            "away"
          );

          const homeCompetitor = getCompetitor(
            competitors,
            "home"
          );

          if (!awayCompetitor || !homeCompetitor) {
            leagueResult.skipped += 1;
            totalSkipped += 1;

            leagueResult.games.push({
              gameId: candidate.game_id,
              eventId,
              success: false,
              skipped: true,
              reason:
                "ESPN response missing home or away competitor",
            });

            continue;
          }

          const statusType =
            competition?.status?.type ?? {};

          const statusState =
            asNullableString(statusType?.state);

          const statusName =
            asNullableString(statusType?.name);

          const statusDetail =
            asNullableString(statusType?.detail) ??
            asNullableString(statusType?.shortDetail);

          const completed =
            statusType?.completed === true;

          const isLive =
            statusState === "in" ||
            statusName === "STATUS_IN_PROGRESS";

          const isFinal =
            completed ||
            statusState === "post" ||
            statusName === "STATUS_FINAL";

          const isStarted =
            isLive || isFinal;

          const awayScore = asNullableNumber(
            awayCompetitor.score
          );

          const homeScore = asNullableNumber(
            homeCompetitor.score
          );

          const nowIso = new Date().toISOString();

          const updatePayload = {
            away_score: awayScore,
            home_score: homeScore,

            // ESPN calls this "state".
            // GRIDIRON365 stores it in pickem_games.status_type.
            status_type: statusState,
            status_name: statusName,
            status_detail: statusDetail,

            is_started: isStarted,
            is_final: isFinal,

            last_score_sync_at: nowIso,
            updated_at: nowIso,
          };

          const {
            data: updatedGame,
            error: updateError,
          } = await supabase
            .from("pickem_games")
            .update(updatePayload)
            .eq("id", candidate.game_id)
            .eq("league_id", target.league_id)
            .eq("season", target.season)
            .eq("sport", "ncaamb")
            .select(
              `
                id,
                provider_event_id,
                week,
                pickem_week_id,
                kickoff_at,
                away_team_name,
                home_team_name,
                away_score,
                home_score,
                status_type,
                status_name,
                status_detail,
                is_started,
                is_final,
                last_score_sync_at
              `
            )
            .maybeSingle();

          if (updateError) {
            leagueResult.errors += 1;
            totalErrors += 1;

            leagueResult.games.push({
              gameId: candidate.game_id,
              eventId,
              success: false,
              error: updateError.message,
            });

            continue;
          }

          if (!updatedGame) {
            leagueResult.errors += 1;
            totalErrors += 1;

            leagueResult.games.push({
              gameId: candidate.game_id,
              eventId,
              success: false,
              error:
                "Game update matched no NCAAMB row.",
            });

            continue;
          }

          leagueResult.updated += 1;
          totalUpdated += 1;

          if (isFinal) {
            leagueResult.final += 1;
            totalFinal += 1;
          } else if (isLive) {
            leagueResult.live += 1;
            totalLive += 1;
          } else {
            leagueResult.scheduled += 1;
            totalScheduled += 1;
          }

          leagueResult.games.push({
            gameId: candidate.game_id,
            eventId,
            success: true,

            before: {
              kickoffAt: candidate.kickoff_at,
              awayTeamName:
                candidate.away_team_name,
              homeTeamName:
                candidate.home_team_name,
              isStarted:
                candidate.is_started,
              isFinal:
                candidate.is_final,
            },

            espn: {
              statusState,
              statusName,
              statusDetail,
              isStarted,
              isFinal,

              away: {
                espnId:
                  asNullableString(
                    awayCompetitor?.team?.id
                  ),
                name:
                  asNullableString(
                    awayCompetitor?.team?.displayName
                  ) ??
                  asNullableString(
                    awayCompetitor?.team
                      ?.shortDisplayName
                  ),
                abbreviation:
                  asNullableString(
                    awayCompetitor?.team
                      ?.abbreviation
                  ),
                score: awayScore,
              },

              home: {
                espnId:
                  asNullableString(
                    homeCompetitor?.team?.id
                  ),
                name:
                  asNullableString(
                    homeCompetitor?.team?.displayName
                  ) ??
                  asNullableString(
                    homeCompetitor?.team
                      ?.shortDisplayName
                  ),
                abbreviation:
                  asNullableString(
                    homeCompetitor?.team
                      ?.abbreviation
                  ),
                score: homeScore,
              },
            },

            database: updatedGame,
          });
        } catch (error) {
          leagueResult.errors += 1;
          totalErrors += 1;

          leagueResult.games.push({
            gameId: candidate.game_id,
            eventId,
            success: false,
            error:
              error instanceof Error
                ? error.message
                : "Unknown game sync error",
          });
        }
      }

      leagueResult.success =
        leagueResult.errors === 0;

      results.push(leagueResult);
    }

    return NextResponse.json({
      success: totalErrors === 0,
      sport: "ncaamb",
      season,
      leagueId,
      pastHours,
      futureHours,
      limit,

      targetLeagues: targets.length,
      candidates: totalCandidates,
      updated: totalUpdated,
      scheduled: totalScheduled,
      live: totalLive,
      final: totalFinal,
      skipped: totalSkipped,
      errors: totalErrors,

      results,
    });
  } catch (error) {
    console.error(
      "[NCAAMB PICKEM SCORE SYNC ERROR]",
      error
    );

    return NextResponse.json(
      {
        success: false,
        sport: "ncaamb",
        error:
          error instanceof Error
            ? error.message
            : "Unknown NCAAMB score sync error",
      },
      {
        status: 500,
      }
    );
  }
}

export async function GET(request: NextRequest) {
  return syncScores(request);
}

export async function POST(request: NextRequest) {
  return syncScores(request);
}