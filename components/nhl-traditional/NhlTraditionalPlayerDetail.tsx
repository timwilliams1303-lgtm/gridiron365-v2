import type { CSSProperties } from "react";
import Link from "next/link";

import Card from "@/components/ui/Card";
import { requireLeagueMember } from "@/lib/leagues/requireLeagueMember";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Props = {
  leagueId: string;
  playerId: string;
};

type PlayerRow = {
  id: number;
  nhl_player_id: number | null;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  short_name: string | null;
  jersey_number: string | null;
  position: string | null;
  position_group: string | null;
  team_id: number | null;
  active: boolean | null;
  status: string | null;
  injury_status: string | null;
  headshot_url: string | null;
};

type NhlTeamRow = {
  id: number;
  name: string | null;
  display_name: string | null;
  abbreviation: string | null;
};

type FantasyTeamRow = {
  id: number;
  team_name: string | null;
};

type RosterRow = {
  fantasy_team_id: number;
  roster_status: string | null;
};

type GameRow = {
  id: number;
  season: number;
  season_type: string | null;
  game_date: string | null;
  start_time: string | null;
  away_team_id: number | null;
  home_team_id: number | null;
  away_score: number | null;
  home_score: number | null;
  status_type: string | null;
  status_name: string | null;
  status_detail: string | null;
  status_completed: boolean | null;
  is_overtime: boolean | null;
  is_shootout: boolean | null;
};

type GameStatRow = {
  id: number;
  nhl_game_id: number;
  nhl_player_id: number;
  team_id: number | null;
  season: number;
  season_type: string | null;
  position: string | null;
  position_group: string | null;

  goals: number | string | null;
  assists: number | string | null;
  points: number | string | null;
  plus_minus: number | string | null;
  penalty_minutes: number | string | null;

  power_play_goals: number | string | null;
  power_play_assists: number | string | null;
  power_play_points: number | string | null;

  short_handed_goals: number | string | null;
  short_handed_assists: number | string | null;
  short_handed_points: number | string | null;

  game_winning_goals: number | string | null;
  shots_on_goal: number | string | null;
  hits: number | string | null;
  blocked_shots: number | string | null;
  takeaways: number | string | null;
  giveaways: number | string | null;
  faceoff_wins: number | string | null;
  faceoff_losses: number | string | null;
  shifts: number | string | null;
  time_on_ice_seconds: number | null;

  goalie_started: boolean | null;
  goalie_decision: string | null;
  saves: number | string | null;
  shots_against: number | string | null;
  goals_against: number | string | null;
  save_percentage: number | string | null;
  goalie_minutes_seconds: number | null;
  goalie_win: number | string | null;
  goalie_loss: number | string | null;
  goalie_overtime_loss: number | string | null;
  shutout: number | string | null;

  is_final: boolean | null;
};

type FantasyScoreRow = {
  nhl_game_id: number;
  nhl_player_id: number;
  season: number;
  season_type: number | null;
  fantasy_points: number | string | null;
  is_live: boolean | null;
  is_final: boolean | null;
};

type SeasonTotalRow = {
  nhl_player_id: number;
  games_played: number | string | null;
  fantasy_points: number | string | null;
  fantasy_points_per_game: number | string | null;

  goals: number | string | null;
  assists: number | string | null;
  points: number | string | null;
  shots_on_goal: number | string | null;
  hits: number | string | null;
  blocked_shots: number | string | null;
  power_play_points: number | string | null;
  short_handed_points: number | string | null;

  goalie_starts: number | string | null;
  goalie_wins: number | string | null;
  saves: number | string | null;
  shots_against: number | string | null;
  goals_against: number | string | null;
  shutouts: number | string | null;
  goalie_minutes_seconds: number | string | null;

  save_percentage: number | string | null;
  goals_against_average: number | string | null;
};

type HistoryRow = {
  stat: GameStatRow;
  game: GameRow | null;
  fantasyPoints: number;
};

function num(
  value: number | string | null | undefined
) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function nullableNum(
  value: number | string | null | undefined
) {
  if (value == null || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function playerName(player: PlayerRow) {
  if (player.display_name?.trim()) {
    return player.display_name.trim();
  }

  const name = `${player.first_name ?? ""} ${
    player.last_name ?? ""
  }`.trim();

  return name || `Player #${player.id}`;
}

function seasonLabel(season: number) {
  return `${season}-${String(season + 1).slice(-2)}`;
}

function formatDate(value: string | null) {
  if (!value) {
    return "—";
  }

  const date = new Date(`${value}T12:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatNumber(
  value: number,
  decimals = 0
) {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function formatSigned(value: number) {
  if (value > 0) {
    return `+${formatNumber(value)}`;
  }

  return formatNumber(value);
}

function formatTime(seconds: number | null | undefined) {
  const total = Number(seconds ?? 0);

  if (!Number.isFinite(total) || total <= 0) {
    return "—";
  }

  const minutes = Math.floor(total / 60);
  const remaining = Math.floor(total % 60);

  return `${minutes}:${String(remaining).padStart(2, "0")}`;
}

function normalizePosition(
  position: string | null | undefined
) {
  return String(position ?? "")
    .trim()
    .toUpperCase();
}

function teamDisplayName(team: NhlTeamRow | null) {
  return (
    team?.display_name?.trim() ||
    team?.name?.trim() ||
    team?.abbreviation?.trim() ||
    "NHL Free Agent"
  );
}

function statusLabel(player: PlayerRow) {
  const injury = String(
    player.injury_status ?? ""
  ).trim();

  if (injury) {
    return injury.toUpperCase();
  }

  const status = String(
    player.status ?? ""
  ).trim();

  if (
    status &&
    status.toLowerCase() !== "active" &&
    status.toLowerCase() !== "historical"
  ) {
    return status.toUpperCase();
  }

  return player.active ? "ACTIVE" : "INACTIVE";
}

function gameResult(
  game: GameRow | null,
  playerTeamId: number | null
) {
  if (
    !game ||
    !game.status_completed ||
    playerTeamId == null ||
    game.away_score == null ||
    game.home_score == null
  ) {
    return null;
  }

  const isHome =
    game.home_team_id === playerTeamId;

  const teamScore = isHome
    ? game.home_score
    : game.away_score;

  const opponentScore = isHome
    ? game.away_score
    : game.home_score;

  const result =
    teamScore > opponentScore
      ? "W"
      : teamScore < opponentScore
        ? "L"
        : "T";

  return `${result} ${teamScore}-${opponentScore}`;
}

export default async function NhlTraditionalPlayerDetail({
  leagueId,
  playerId,
}: Props) {
  await requireLeagueMember(leagueId);

  const internalPlayerId = Number(playerId);

  if (
    !Number.isInteger(internalPlayerId) ||
    internalPlayerId <= 0
  ) {
    return (
      <ErrorPage
        leagueId={leagueId}
        message="Invalid NHL player."
      />
    );
  }

  const supabase =
    await createSupabaseServerClient();

  const [
    leagueResult,
    playerResult,
    teamsResult,
    rosterResult,
  ] = await Promise.all([
    supabase
      .from("leagues")
      .select("id, name, season, league_type")
      .eq("id", leagueId)
      .single(),

    supabase
      .from("nhl_players")
      .select(`
        id,
        nhl_player_id,
        first_name,
        last_name,
        display_name,
        short_name,
        jersey_number,
        position,
        position_group,
        team_id,
        active,
        status,
        injury_status,
        headshot_url
      `)
      .eq("id", internalPlayerId)
      .maybeSingle(),

    supabase
      .from("nhl_teams")
      .select(`
        id,
        name,
        display_name,
        abbreviation
      `),

    supabase
      .from("nhl_traditional_rosters")
      .select(`
        fantasy_team_id,
        roster_status
      `)
      .eq("league_id", leagueId)
      .eq("nhl_player_id", internalPlayerId)
      .maybeSingle(),
  ]);

  if (leagueResult.error) {
    return (
      <ErrorPage
        leagueId={leagueId}
        message={`Unable to load league: ${leagueResult.error.message}`}
      />
    );
  }

  if (
    leagueResult.data.league_type !==
    "nhl_traditional"
  ) {
    return (
      <ErrorPage
        leagueId={leagueId}
        message="This page is only available for NHL Traditional leagues."
      />
    );
  }

  if (playerResult.error) {
    return (
      <ErrorPage
        leagueId={leagueId}
        message={`Unable to load NHL player: ${playerResult.error.message}`}
      />
    );
  }

  if (!playerResult.data) {
    return (
      <ErrorPage
        leagueId={leagueId}
        message="NHL player not found."
      />
    );
  }

  if (teamsResult.error) {
    return (
      <ErrorPage
        leagueId={leagueId}
        message={`Unable to load NHL teams: ${teamsResult.error.message}`}
      />
    );
  }

  if (rosterResult.error) {
    return (
      <ErrorPage
        leagueId={leagueId}
        message={`Unable to load fantasy ownership: ${rosterResult.error.message}`}
      />
    );
  }

  const leagueSeason = Number(
    leagueResult.data.season ?? 2026
  );

  const player =
    playerResult.data as PlayerRow;

  const teams =
    (teamsResult.data ?? []) as NhlTeamRow[];

  const teamMap = new Map<number, NhlTeamRow>();

  for (const team of teams) {
    teamMap.set(Number(team.id), team);
  }

  const currentTeam =
    player.team_id == null
      ? null
      : teamMap.get(Number(player.team_id)) ?? null;

  const roster =
    (rosterResult.data ?? null) as RosterRow | null;

  let fantasyTeam: FantasyTeamRow | null = null;

  if (roster?.fantasy_team_id) {
    const fantasyTeamResult = await supabase
      .from("fantasy_teams")
      .select("id, team_name")
      .eq("id", roster.fantasy_team_id)
      .eq("league_id", leagueId)
      .maybeSingle();

    if (fantasyTeamResult.error) {
      return (
        <ErrorPage
          leagueId={leagueId}
          message={`Unable to load fantasy team: ${fantasyTeamResult.error.message}`}
        />
      );
    }

    fantasyTeam =
      fantasyTeamResult.data as FantasyTeamRow | null;
  }

  const [
    totalsResult,
    statsResult,
    scoreResult,
  ] = await Promise.all([
    supabase.rpc(
      "get_nhl_traditional_player_season_totals",
      {
        p_league_id: leagueId,
        p_season: leagueSeason,
        p_season_type: "regular",
      }
    ),

    supabase
      .from("nhl_player_game_stats")
      .select(`
        id,
        nhl_game_id,
        nhl_player_id,
        team_id,
        season,
        season_type,
        position,
        position_group,
        goals,
        assists,
        points,
        plus_minus,
        penalty_minutes,
        power_play_goals,
        power_play_assists,
        power_play_points,
        short_handed_goals,
        short_handed_assists,
        short_handed_points,
        game_winning_goals,
        shots_on_goal,
        hits,
        blocked_shots,
        takeaways,
        giveaways,
        faceoff_wins,
        faceoff_losses,
        shifts,
        time_on_ice_seconds,
        goalie_started,
        goalie_decision,
        saves,
        shots_against,
        goals_against,
        save_percentage,
        goalie_minutes_seconds,
        goalie_win,
        goalie_loss,
        goalie_overtime_loss,
        shutout,
        is_final
      `)
      .eq("nhl_player_id", internalPlayerId)
      .eq("season_type", "regular")
      .order("nhl_game_id", {
        ascending: false,
      }),

    supabase
      .from(
        "nhl_traditional_player_game_scores"
      )
      .select(`
        nhl_game_id,
        nhl_player_id,
        season,
        season_type,
        fantasy_points,
        is_live,
        is_final
      `)
      .eq("league_id", leagueId)
      .eq("nhl_player_id", internalPlayerId),
  ]);

  if (totalsResult.error) {
    return (
      <ErrorPage
        leagueId={leagueId}
        message={`Unable to load season totals: ${totalsResult.error.message}`}
      />
    );
  }

  if (statsResult.error) {
    return (
      <ErrorPage
        leagueId={leagueId}
        message={`Unable to load player game history: ${statsResult.error.message}`}
      />
    );
  }

  if (scoreResult.error) {
    return (
      <ErrorPage
        leagueId={leagueId}
        message={`Unable to load fantasy game scores: ${scoreResult.error.message}`}
      />
    );
  }

  const allTotals =
    (totalsResult.data ?? []) as SeasonTotalRow[];

  const seasonTotal =
    allTotals.find(
      (row) =>
        Number(row.nhl_player_id) ===
        internalPlayerId
    ) ?? null;

  const stats =
    (statsResult.data ?? []) as GameStatRow[];

  const fantasyScores =
    (scoreResult.data ?? []) as FantasyScoreRow[];

  const gameIds = Array.from(
    new Set(
      stats
        .map((row) => Number(row.nhl_game_id))
        .filter(
          (id) =>
            Number.isInteger(id) && id > 0
        )
    )
  );

  let games: GameRow[] = [];

  if (gameIds.length > 0) {
    const gamesResult = await supabase
      .from("nhl_games")
      .select(`
        id,
        season,
        season_type,
        game_date,
        start_time,
        away_team_id,
        home_team_id,
        away_score,
        home_score,
        status_type,
        status_name,
        status_detail,
        status_completed,
        is_overtime,
        is_shootout
      `)
      .in("id", gameIds);

    if (gamesResult.error) {
      return (
        <ErrorPage
          leagueId={leagueId}
          message={`Unable to load NHL games: ${gamesResult.error.message}`}
        />
      );
    }

    games =
      (gamesResult.data ?? []) as GameRow[];
  }

  const gameMap = new Map<number, GameRow>();

  for (const game of games) {
    gameMap.set(Number(game.id), game);
  }

  const scoreMap = new Map<number, number>();

  for (const score of fantasyScores) {
    scoreMap.set(
      Number(score.nhl_game_id),
      num(score.fantasy_points)
    );
  }

  const history: HistoryRow[] = stats
    .map((stat) => ({
      stat,
      game:
        gameMap.get(Number(stat.nhl_game_id)) ??
        null,
      fantasyPoints:
        scoreMap.get(Number(stat.nhl_game_id)) ??
        0,
    }))
    .sort((a, b) => {
      const aDate =
        a.game?.game_date ?? "";
      const bDate =
        b.game?.game_date ?? "";

      if (aDate !== bDate) {
        return bDate.localeCompare(aDate);
      }

      return (
        Number(b.stat.nhl_game_id) -
        Number(a.stat.nhl_game_id)
      );
    });

  const currentSeasonHistory =
    history.filter(
      (row) =>
        Number(row.stat.season) ===
        leagueSeason
    );

  const position =
    normalizePosition(player.position);

  const isGoalie = position === "G";

  const gamesPlayed =
    num(seasonTotal?.games_played);

  const fantasyPoints =
    num(seasonTotal?.fantasy_points);

  const fantasyPointsPerGame =
    num(
      seasonTotal?.fantasy_points_per_game
    );

  const currentTeamName =
    teamDisplayName(currentTeam);

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <div style={styles.backRow}>
          <Link
            href={`/league/${leagueId}/nhl/players`}
            style={styles.backLink}
          >
            ← Back to Players
          </Link>
        </div>

        <section style={styles.hero}>
          <div style={styles.heroGlow} />

          <div style={styles.heroContent}>
            <div style={styles.identity}>
              <div style={styles.headshotWrap}>
                {player.headshot_url ? (
                  <img
                    src={player.headshot_url}
                    alt={playerName(player)}
                    style={styles.headshot}
                  />
                ) : (
                  <div style={styles.headshotFallback}>
                    {playerName(player)
                      .split(" ")
                      .map((part) => part[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase()}
                  </div>
                )}
              </div>

              <div style={styles.identityText}>
                <div style={styles.eyebrow}>
                  G365 NHL PLAYER PROFILE
                </div>

                <h1 style={styles.title}>
                  {playerName(player)}
                </h1>

                <div style={styles.playerLine}>
                  <span style={styles.teamName}>
                    {currentTeamName}
                  </span>

                  {currentTeam?.abbreviation ? (
                    <span style={styles.muted}>
                      {currentTeam.abbreviation}
                    </span>
                  ) : null}

                  {player.jersey_number ? (
                    <span style={styles.muted}>
                      #{player.jersey_number}
                    </span>
                  ) : null}

                  <span style={styles.positionBadge}>
                    {position || "—"}
                  </span>
                </div>

                <div style={styles.statusRow}>
                  <span
                    style={
                      player.active
                        ? styles.activeBadge
                        : styles.inactiveBadge
                    }
                  >
                    {statusLabel(player)}
                  </span>

                  <span style={styles.ownerBadge}>
                    {fantasyTeam?.team_name
                      ? `G365: ${fantasyTeam.team_name}`
                      : "G365 FREE AGENT"}
                  </span>

                  {roster?.roster_status ? (
                    <span style={styles.rosterBadge}>
                      {roster.roster_status.toUpperCase()}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            <div style={styles.heroStats}>
              <HeroStat
                label="SEASON"
                value={seasonLabel(leagueSeason)}
              />

              <HeroStat
                label="GAMES"
                value={formatNumber(gamesPlayed)}
              />

              <HeroStat
                label="FANTASY PTS"
                value={formatNumber(
                  fantasyPoints,
                  1
                )}
                accent
              />

              <HeroStat
                label="FPPG"
                value={formatNumber(
                  fantasyPointsPerGame,
                  2
                )}
              />
            </div>
          </div>
        </section>

        <div style={styles.spacer} />

        <Card>
          <section style={styles.section}>
            <div style={styles.sectionHeader}>
              <div>
                <div style={styles.sectionEyebrow}>
                  CURRENT SEASON
                </div>

                <h2 style={styles.sectionTitle}>
                  {seasonLabel(leagueSeason)} Statistics
                </h2>
              </div>

              <div style={styles.seasonStatus}>
                {currentSeasonHistory.length} game
                {currentSeasonHistory.length === 1
                  ? ""
                  : "s"}{" "}
                recorded
              </div>
            </div>

            {isGoalie ? (
              <div style={styles.statGrid}>
                <StatBox
                  label="Starts"
                  value={formatNumber(
                    num(
                      seasonTotal?.goalie_starts
                    )
                  )}
                />

                <StatBox
                  label="Wins"
                  value={formatNumber(
                    num(
                      seasonTotal?.goalie_wins
                    )
                  )}
                />

                <StatBox
                  label="Saves"
                  value={formatNumber(
                    num(seasonTotal?.saves)
                  )}
                />

                <StatBox
                  label="Shots Against"
                  value={formatNumber(
                    num(
                      seasonTotal?.shots_against
                    )
                  )}
                />

                <StatBox
                  label="Goals Against"
                  value={formatNumber(
                    num(
                      seasonTotal?.goals_against
                    )
                  )}
                />

                <StatBox
                  label="Shutouts"
                  value={formatNumber(
                    num(seasonTotal?.shutouts)
                  )}
                />

                <StatBox
                  label="Save %"
                  value={
                    nullableNum(
                      seasonTotal?.save_percentage
                    ) == null
                      ? "—"
                      : nullableNum(
                            seasonTotal?.save_percentage
                          )!.toFixed(3)
                  }
                />

                <StatBox
                  label="GAA"
                  value={
                    nullableNum(
                      seasonTotal?.goals_against_average
                    ) == null
                      ? "—"
                      : nullableNum(
                            seasonTotal?.goals_against_average
                          )!.toFixed(2)
                  }
                />
              </div>
            ) : (
              <div style={styles.statGrid}>
                <StatBox
                  label="Goals"
                  value={formatNumber(
                    num(seasonTotal?.goals)
                  )}
                />

                <StatBox
                  label="Assists"
                  value={formatNumber(
                    num(seasonTotal?.assists)
                  )}
                />

                <StatBox
                  label="Points"
                  value={formatNumber(
                    num(seasonTotal?.points)
                  )}
                />

                <StatBox
                  label="Shots"
                  value={formatNumber(
                    num(
                      seasonTotal?.shots_on_goal
                    )
                  )}
                />

                <StatBox
                  label="Hits"
                  value={formatNumber(
                    num(seasonTotal?.hits)
                  )}
                />

                <StatBox
                  label="Blocks"
                  value={formatNumber(
                    num(
                      seasonTotal?.blocked_shots
                    )
                  )}
                />

                <StatBox
                  label="PP Points"
                  value={formatNumber(
                    num(
                      seasonTotal?.power_play_points
                    )
                  )}
                />

                <StatBox
                  label="SH Points"
                  value={formatNumber(
                    num(
                      seasonTotal?.short_handed_points
                    )
                  )}
                />
              </div>
            )}
          </section>
        </Card>

        <div style={styles.spacer} />

        <Card>
          <section style={styles.section}>
            <div style={styles.sectionHeader}>
              <div>
                <div style={styles.sectionEyebrow}>
                  GAME LOG
                </div>

                <h2 style={styles.sectionTitle}>
                  Recent & Past Performances
                </h2>
              </div>

              <div style={styles.historyCount}>
                {history.length} recorded games
              </div>
            </div>

            <p style={styles.sectionDescription}>
              Full available NHL game history for{" "}
              {playerName(player)}. Scroll vertically
              for older games and horizontally on
              smaller screens for additional stats.
            </p>

            {history.length === 0 ? (
              <div style={styles.emptyState}>
                No NHL game statistics are currently
                stored for this player.
              </div>
            ) : (
              <div style={styles.historyScroller}>
                <div style={styles.tableScroller}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.leftHead}>
                          Date
                        </th>

                        <th style={styles.centerHead}>
                          Matchup
                        </th>

                        <th style={styles.centerHead}>
                          Result
                        </th>

                        <th style={styles.centerHead}>
                          Season
                        </th>

                        <th style={styles.fantasyHead}>
                          FP
                        </th>

                        {isGoalie ? (
                          <>
                            <th style={styles.numberHead}>
                              GS
                            </th>
                            <th style={styles.numberHead}>
                              DEC
                            </th>
                            <th style={styles.numberHead}>
                              SV
                            </th>
                            <th style={styles.numberHead}>
                              SA
                            </th>
                            <th style={styles.numberHead}>
                              GA
                            </th>
                            <th style={styles.numberHead}>
                              SV%
                            </th>
                            <th style={styles.numberHead}>
                              SO
                            </th>
                            <th style={styles.numberHead}>
                              TOI
                            </th>
                          </>
                        ) : (
                          <>
                            <th style={styles.numberHead}>
                              G
                            </th>
                            <th style={styles.numberHead}>
                              A
                            </th>
                            <th style={styles.numberHead}>
                              PTS
                            </th>
                            <th style={styles.numberHead}>
                              +/-
                            </th>
                            <th style={styles.numberHead}>
                              SOG
                            </th>
                            <th style={styles.numberHead}>
                              HIT
                            </th>
                            <th style={styles.numberHead}>
                              BLK
                            </th>
                            <th style={styles.numberHead}>
                              PPP
                            </th>
                            <th style={styles.numberHead}>
                              SHP
                            </th>
                            <th style={styles.numberHead}>
                              PIM
                            </th>
                            <th style={styles.numberHead}>
                              TOI
                            </th>
                          </>
                        )}
                      </tr>
                    </thead>

                    <tbody>
                      {history.map(
                        ({
                          stat,
                          game,
                          fantasyPoints:
                            gameFantasyPoints,
                        }) => {
                          const statTeam =
                            stat.team_id == null
                              ? currentTeam
                              : teamMap.get(
                                  Number(
                                    stat.team_id
                                  )
                                ) ?? currentTeam;

                          const statTeamId =
                            stat.team_id ??
                            player.team_id;

                          const isHome =
                            game &&
                            statTeamId != null &&
                            Number(
                              game.home_team_id
                            ) ===
                              Number(statTeamId);

                          const opponentId =
                            !game
                              ? null
                              : isHome
                                ? game.away_team_id
                                : game.home_team_id;

                          const opponent =
                            opponentId == null
                              ? null
                              : teamMap.get(
                                  Number(opponentId)
                                ) ?? null;

                          const matchup =
                            opponent
                              ? `${isHome ? "vs" : "@"} ${
                                  opponent.abbreviation ??
                                  teamDisplayName(
                                    opponent
                                  )
                                }`
                              : "—";

                          const result =
                            gameResult(
                              game,
                              statTeamId
                            );

                          const savePct =
                            nullableNum(
                              stat.save_percentage
                            );

                          return (
                            <tr
                              key={stat.id}
                              style={styles.tableRow}
                            >
                              <td
                                style={
                                  styles.dateCell
                                }
                              >
                                {formatDate(
                                  game?.game_date ??
                                    null
                                )}
                              </td>

                              <td
                                style={
                                  styles.matchupCell
                                }
                                title={
                                  opponent
                                    ? teamDisplayName(
                                        opponent
                                      )
                                    : undefined
                                }
                              >
                                <div
                                  style={
                                    styles.matchupMain
                                  }
                                >
                                  {matchup}
                                </div>

                                <div
                                  style={
                                    styles.gameTeam
                                  }
                                >
                                  {statTeam
                                    ?.abbreviation ??
                                    "—"}
                                </div>
                              </td>

                              <td
                                style={
                                  styles.centerCell
                                }
                              >
                                {result ?? (
                                  <span
                                    style={
                                      styles.muted
                                    }
                                  >
                                    {game?.status_detail ??
                                      game?.status_name ??
                                      "—"}
                                  </span>
                                )}
                              </td>

                              <td
                                style={
                                  styles.centerCell
                                }
                              >
                                {seasonLabel(
                                  Number(
                                    stat.season
                                  )
                                )}
                              </td>

                              <td
                                style={
                                  styles.fantasyCell
                                }
                              >
                                {formatNumber(
                                  gameFantasyPoints,
                                  1
                                )}
                              </td>

                              {isGoalie ? (
                                <>
                                  <NumberCell
                                    value={
                                      stat.goalie_started
                                        ? "1"
                                        : "0"
                                    }
                                  />

                                  <NumberCell
                                    value={
                                      stat.goalie_decision?.toUpperCase() ||
                                      "—"
                                    }
                                  />

                                  <NumberCell
                                    value={formatNumber(
                                      num(
                                        stat.saves
                                      )
                                    )}
                                  />

                                  <NumberCell
                                    value={formatNumber(
                                      num(
                                        stat.shots_against
                                      )
                                    )}
                                  />

                                  <NumberCell
                                    value={formatNumber(
                                      num(
                                        stat.goals_against
                                      )
                                    )}
                                  />

                                  <NumberCell
                                    value={
                                      savePct == null
                                        ? "—"
                                        : savePct.toFixed(
                                            3
                                          )
                                    }
                                  />

                                  <NumberCell
                                    value={formatNumber(
                                      num(
                                        stat.shutout
                                      )
                                    )}
                                  />

                                  <NumberCell
                                    value={formatTime(
                                      stat.goalie_minutes_seconds
                                    )}
                                  />
                                </>
                              ) : (
                                <>
                                  <NumberCell
                                    value={formatNumber(
                                      num(stat.goals)
                                    )}
                                  />

                                  <NumberCell
                                    value={formatNumber(
                                      num(
                                        stat.assists
                                      )
                                    )}
                                  />

                                  <NumberCell
                                    value={formatNumber(
                                      num(stat.points)
                                    )}
                                  />

                                  <NumberCell
                                    value={formatSigned(
                                      num(
                                        stat.plus_minus
                                      )
                                    )}
                                  />

                                  <NumberCell
                                    value={formatNumber(
                                      num(
                                        stat.shots_on_goal
                                      )
                                    )}
                                  />

                                  <NumberCell
                                    value={formatNumber(
                                      num(stat.hits)
                                    )}
                                  />

                                  <NumberCell
                                    value={formatNumber(
                                      num(
                                        stat.blocked_shots
                                      )
                                    )}
                                  />

                                  <NumberCell
                                    value={formatNumber(
                                      num(
                                        stat.power_play_points
                                      )
                                    )}
                                  />

                                  <NumberCell
                                    value={formatNumber(
                                      num(
                                        stat.short_handed_points
                                      )
                                    )}
                                  />

                                  <NumberCell
                                    value={formatNumber(
                                      num(
                                        stat.penalty_minutes
                                      )
                                    )}
                                  />

                                  <NumberCell
                                    value={formatTime(
                                      stat.time_on_ice_seconds
                                    )}
                                  />
                                </>
                              )}
                            </tr>
                          );
                        }
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        </Card>

        <div style={styles.spacer} />

        <Card>
          <section style={styles.section}>
            <div style={styles.sectionEyebrow}>
              PLAYER INFORMATION
            </div>

            <h2 style={styles.sectionTitle}>
              Profile
            </h2>

            <div style={styles.infoGrid}>
              <InfoBox
                label="NHL Team"
                value={currentTeamName}
              />

              <InfoBox
                label="Position"
                value={position || "—"}
              />

              <InfoBox
                label="Jersey"
                value={
                  player.jersey_number
                    ? `#${player.jersey_number}`
                    : "—"
                }
              />

              <InfoBox
                label="Fantasy Team"
                value={
                  fantasyTeam?.team_name ??
                  "Free Agent"
                }
              />

              <InfoBox
                label="Roster Status"
                value={
                  roster?.roster_status
                    ?.toUpperCase() ??
                  "AVAILABLE"
                }
              />

              <InfoBox
                label="NHL Player ID"
                value={
                  player.nhl_player_id == null
                    ? "—"
                    : String(
                        player.nhl_player_id
                      )
                }
              />
            </div>
          </section>
        </Card>
      </div>
    </main>
  );
}

function NumberCell({
  value,
}: {
  value: string;
}) {
  return (
    <td style={styles.numberCell}>
      {value}
    </td>
  );
}

function HeroStat({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div style={styles.heroStat}>
      <span style={styles.heroStatLabel}>
        {label}
      </span>

      <strong
        style={
          accent
            ? styles.heroStatValueAccent
            : styles.heroStatValue
        }
      >
        {value}
      </strong>
    </div>
  );
}

function StatBox({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div style={styles.statBox}>
      <span style={styles.statLabel}>
        {label}
      </span>

      <strong style={styles.statValue}>
        {value}
      </strong>
    </div>
  );
}

function InfoBox({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div style={styles.infoBox}>
      <span style={styles.infoLabel}>
        {label}
      </span>

      <strong style={styles.infoValue}>
        {value}
      </strong>
    </div>
  );
}

function ErrorPage({
  leagueId,
  message,
}: {
  leagueId: string;
  message: string;
}) {
  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <div style={styles.backRow}>
          <Link
            href={`/league/${leagueId}/nhl/players`}
            style={styles.backLink}
          >
            ← Back to Players
          </Link>
        </div>

        <Card>
          <div style={styles.errorBox}>
            {message}
          </div>
        </Card>
      </div>
    </main>
  );
}

const styles: Record<
  string,
  CSSProperties
> = {
  page: {
    minHeight: "100vh",
    background:
      "radial-gradient(circle at top, rgba(255,75,0,0.08), transparent 32%), #080808",
    color: "#ffffff",
    padding: "14px 8px 48px",
    overflowX: "hidden",
  },

  container: {
    width: "100%",
    maxWidth: 1800,
    margin: "0 auto",
    minWidth: 0,
  },

  backRow: {
    marginBottom: 12,
  },

  backLink: {
    display: "inline-flex",
    alignItems: "center",
    minHeight: 40,
    padding: "0 14px",
    borderRadius: 10,
    border:
      "1px solid rgba(255,90,0,0.35)",
    background: "#111111",
    color: "#ff8a32",
    textDecoration: "none",
    fontSize: 13,
    fontWeight: 900,
  },

  hero: {
    position: "relative",
    overflow: "hidden",
    border:
      "1px solid rgba(255,90,0,0.35)",
    borderRadius: 16,
    background:
      "linear-gradient(135deg, #151515 0%, #0b0b0b 52%, #1b0903 100%)",
    boxShadow:
      "0 18px 55px rgba(0,0,0,0.38)",
  },

  heroGlow: {
    position: "absolute",
    right: -100,
    top: -130,
    width: 380,
    height: 380,
    borderRadius: "50%",
    background:
      "radial-gradient(circle, rgba(255,83,0,0.22), transparent 66%)",
    pointerEvents: "none",
  },

  heroContent: {
    position: "relative",
    zIndex: 1,
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 24,
    padding: 22,
  },

  identity: {
    display: "flex",
    alignItems: "center",
    gap: 18,
    flex: "1 1 520px",
    minWidth: 0,
  },

  headshotWrap: {
    width: 116,
    height: 116,
    flex: "0 0 116px",
    overflow: "hidden",
    borderRadius: 18,
    border:
      "1px solid rgba(255,100,0,0.45)",
    background:
      "linear-gradient(145deg, #252525, #0d0d0d)",
  },

  headshot: {
    display: "block",
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },

  headshotFallback: {
    width: "100%",
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#ff7a1a",
    fontSize: 30,
    fontWeight: 950,
  },

  identityText: {
    minWidth: 0,
  },

  eyebrow: {
    color: "#ff6b16",
    fontSize: 11,
    fontWeight: 950,
    letterSpacing: 1.6,
    marginBottom: 6,
  },

  title: {
    margin: 0,
    fontSize: "clamp(28px, 5vw, 48px)",
    lineHeight: 1,
    fontWeight: 950,
    letterSpacing: -1.2,
  },

  playerLine: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 9,
    marginTop: 12,
  },

  teamName: {
    fontSize: 15,
    fontWeight: 900,
    color: "#ffffff",
  },

  muted: {
    color: "#929292",
  },

  positionBadge: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 34,
    minHeight: 28,
    padding: "0 9px",
    borderRadius: 8,
    background: "#241006",
    border:
      "1px solid rgba(255,102,0,0.35)",
    color: "#ff8a32",
    fontSize: 12,
    fontWeight: 950,
  },

  statusRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },

  activeBadge: {
    padding: "6px 9px",
    borderRadius: 999,
    background: "rgba(30,170,80,0.12)",
    border:
      "1px solid rgba(30,190,80,0.28)",
    color: "#59d77f",
    fontSize: 10,
    fontWeight: 950,
  },

  inactiveBadge: {
    padding: "6px 9px",
    borderRadius: 999,
    background: "rgba(255,80,45,0.12)",
    border:
      "1px solid rgba(255,80,45,0.28)",
    color: "#ff7259",
    fontSize: 10,
    fontWeight: 950,
  },

  ownerBadge: {
    padding: "6px 9px",
    borderRadius: 999,
    background: "#171717",
    border: "1px solid #303030",
    color: "#d7d7d7",
    fontSize: 10,
    fontWeight: 900,
  },

  rosterBadge: {
    padding: "6px 9px",
    borderRadius: 999,
    background: "#171717",
    border: "1px solid #303030",
    color: "#a9a9a9",
    fontSize: 10,
    fontWeight: 900,
  },

  heroStats: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(105px, 1fr))",
    gap: 8,
    flex: "1 1 440px",
    maxWidth: 600,
  },

  heroStat: {
    minWidth: 0,
    padding: "12px 10px",
    borderRadius: 12,
    border: "1px solid #292929",
    background: "rgba(0,0,0,0.28)",
  },

  heroStatLabel: {
    display: "block",
    color: "#858585",
    fontSize: 9,
    fontWeight: 950,
    letterSpacing: 1,
    marginBottom: 5,
  },

  heroStatValue: {
    display: "block",
    fontSize: 19,
    color: "#ffffff",
    fontWeight: 950,
  },

  heroStatValueAccent: {
    display: "block",
    fontSize: 19,
    color: "#ff7b22",
    fontWeight: 950,
  },

  spacer: {
    height: 12,
  },

  section: {
    padding: 2,
    minWidth: 0,
  },

  sectionHeader: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 14,
  },

  sectionEyebrow: {
    color: "#ff6814",
    fontSize: 10,
    fontWeight: 950,
    letterSpacing: 1.4,
    marginBottom: 4,
  },

  sectionTitle: {
    margin: 0,
    fontSize: 22,
    fontWeight: 950,
  },

  sectionDescription: {
    margin: "0 0 14px",
    color: "#9b9b9b",
    fontSize: 13,
    lineHeight: 1.55,
  },

  seasonStatus: {
    color: "#999999",
    fontSize: 12,
    fontWeight: 800,
  },

  historyCount: {
    color: "#999999",
    fontSize: 12,
    fontWeight: 800,
  },

  statGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(125px, 1fr))",
    gap: 8,
  },

  statBox: {
    padding: 13,
    minWidth: 0,
    borderRadius: 11,
    border: "1px solid #282828",
    background:
      "linear-gradient(180deg, #171717, #101010)",
  },

  statLabel: {
    display: "block",
    color: "#888888",
    fontSize: 10,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },

  statValue: {
    display: "block",
    marginTop: 5,
    color: "#ffffff",
    fontSize: 21,
    fontWeight: 950,
  },

  historyScroller: {
    maxHeight: "65vh",
    overflowY: "auto",
    border: "1px solid #242424",
    borderRadius: 12,
    background: "#0d0d0d",
  },

  tableScroller: {
    width: "100%",
    overflowX: "auto",
  },

  table: {
    width: "100%",
    minWidth: 1050,
    borderCollapse: "collapse",
    fontSize: 12,
  },

  leftHead: {
    position: "sticky",
    top: 0,
    zIndex: 2,
    textAlign: "left",
    padding: "11px 10px",
    background: "#171717",
    color: "#999999",
    borderBottom: "1px solid #303030",
    fontSize: 10,
    fontWeight: 950,
    whiteSpace: "nowrap",
  },

  centerHead: {
    position: "sticky",
    top: 0,
    zIndex: 2,
    textAlign: "center",
    padding: "11px 9px",
    background: "#171717",
    color: "#999999",
    borderBottom: "1px solid #303030",
    fontSize: 10,
    fontWeight: 950,
    whiteSpace: "nowrap",
  },

  numberHead: {
    position: "sticky",
    top: 0,
    zIndex: 2,
    textAlign: "right",
    padding: "11px 9px",
    background: "#171717",
    color: "#999999",
    borderBottom: "1px solid #303030",
    fontSize: 10,
    fontWeight: 950,
    whiteSpace: "nowrap",
  },

  fantasyHead: {
    position: "sticky",
    top: 0,
    zIndex: 2,
    textAlign: "right",
    padding: "11px 9px",
    background: "#211006",
    color: "#ff7b22",
    borderBottom:
      "1px solid rgba(255,100,0,0.35)",
    fontSize: 10,
    fontWeight: 950,
    whiteSpace: "nowrap",
  },

  tableRow: {
    borderBottom: "1px solid #202020",
  },

  dateCell: {
    padding: "10px",
    color: "#dddddd",
    fontWeight: 800,
    whiteSpace: "nowrap",
  },

  matchupCell: {
    padding: "9px",
    textAlign: "center",
    whiteSpace: "nowrap",
  },

  matchupMain: {
    color: "#ffffff",
    fontWeight: 950,
  },

  gameTeam: {
    marginTop: 2,
    color: "#777777",
    fontSize: 9,
    fontWeight: 800,
  },

  centerCell: {
    padding: "10px 9px",
    textAlign: "center",
    color: "#cfcfcf",
    whiteSpace: "nowrap",
  },

  numberCell: {
    padding: "10px 9px",
    textAlign: "right",
    color: "#d4d4d4",
    fontVariantNumeric: "tabular-nums",
    whiteSpace: "nowrap",
  },

  fantasyCell: {
    padding: "10px 9px",
    textAlign: "right",
    color: "#ff7b22",
    fontWeight: 950,
    fontVariantNumeric: "tabular-nums",
    whiteSpace: "nowrap",
    background: "rgba(255,92,0,0.035)",
  },

  infoGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(170px, 1fr))",
    gap: 8,
    marginTop: 14,
  },

  infoBox: {
    padding: 12,
    borderRadius: 10,
    border: "1px solid #282828",
    background: "#111111",
    minWidth: 0,
  },

  infoLabel: {
    display: "block",
    color: "#777777",
    fontSize: 9,
    fontWeight: 950,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },

  infoValue: {
    display: "block",
    marginTop: 5,
    color: "#eeeeee",
    fontSize: 13,
    fontWeight: 900,
    overflowWrap: "anywhere",
  },

  emptyState: {
    padding: 24,
    borderRadius: 12,
    border: "1px dashed #343434",
    background: "#0e0e0e",
    color: "#8d8d8d",
    textAlign: "center",
    fontSize: 13,
  },

  errorBox: {
    padding: 20,
    borderRadius: 12,
    border:
      "1px solid rgba(255,80,45,0.35)",
    background: "rgba(255,60,30,0.06)",
    color: "#ff8a70",
    fontWeight: 800,
  },
};