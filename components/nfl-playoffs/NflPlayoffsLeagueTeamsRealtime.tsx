"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type {
  CSSProperties,
} from "react";

import {
  createBrowserClient,
} from "@supabase/ssr";


type Props = {
  leagueId: string;
  season: number;
  roundNumber: number;
  enabled?: boolean;
};


type LeagueStateRow = {
  active_round:
    number |
    null;

  status:
    string |
    null;
};


type TeamRow = {
  id: number;
  team_name: string;
  owner_id:
    string |
    null;
  active: boolean;
};


type EntryRow = {
  fantasy_team_id: number;

  status:
    string |
    null;

  salary_used:
    number |
    string |
    null;

  projected_points:
    number |
    string |
    null;

  submitted_at:
    string |
    null;
};


type LineupRow = {
  fantasy_team_id: number;
  player_id: number;
  lineup_slot: string;
  slot_index: number;

  salary_at_selection:
    number |
    string |
    null;

  projected_points_at_selection:
    number |
    string |
    null;

  is_locked: boolean;

  locked_at:
    string |
    null;
};


type PlayerRow = {
  id: number;

  full_name:
    string |
    null;

  primary_position:
    string |
    null;

  position:
    string |
    null;

  team_abbreviation:
    string |
    null;

  injury_status:
    string |
    null;
};


type ProjectionRow = {
  nfl_player_id: number;

  team_abbreviation:
    string |
    null;

  position:
    string |
    null;

  opponent_abbreviation:
    string |
    null;

  home_or_away:
    string |
    null;

  kickoff_at:
    string |
    null;

  injury_status:
    string |
    null;

  projected_points:
    number |
    string |
    null;
};


type RoundRow = {
  round_number: number;

  round_name:
    string |
    null;

  nfl_week:
    number |
    null;

  status:
    string |
    null;
};


type ScoreRow = {
  nfl_game_id:
    number |
    null;

  nfl_player_id: number;

  player_game_stat_id:
    number |
    null;

  week:
    number |
    null;

  fantasy_points:
    number |
    string |
    null;

  is_live: boolean;

  is_final: boolean;
};


type StatRow = {
  id: number;

  nfl_game_id:
    number |
    null;

  nfl_player_id: number;

  game_status:
    string |
    null;

  passing_attempts:
    number |
    null;

  passing_completions:
    number |
    null;

  passing_yards:
    number |
    null;

  passing_touchdowns:
    number |
    null;

  passing_interceptions:
    number |
    null;

  rushing_attempts:
    number |
    null;

  rushing_yards:
    number |
    null;

  rushing_touchdowns:
    number |
    null;

  receiving_targets:
    number |
    null;

  receptions:
    number |
    null;

  receiving_yards:
    number |
    null;

  receiving_touchdowns:
    number |
    null;

  fumbles_lost:
    number |
    null;

  field_goals_made:
    number |
    null;

  field_goals_attempted:
    number |
    null;

  extra_points_made:
    number |
    null;

  extra_points_attempted:
    number |
    null;

  dst_sacks:
    number |
    null;

  dst_interceptions:
    number |
    null;

  dst_fumble_recoveries:
    number |
    null;

  dst_touchdowns:
    number |
    null;

  dst_safeties:
    number |
    null;

  dst_blocked_kicks:
    number |
    null;

  dst_points_allowed:
    number |
    null;

  dst_yards_allowed:
    number |
    null;
};


type TeamDisplay = {
  team:
    TeamRow;

  entry:
    EntryRow |
    null;

  lineup:
    LineupRow[];

  fantasyPoints:
    number;

  livePlayers:
    number;

  finalPlayers:
    number;

  scheduledPlayers:
    number;
};


function numberValue(
  value:
    number |
    string |
    null |
    undefined
) {
  const parsed =
    Number(
      value
    );

  return Number.isFinite(
    parsed
  )
    ? parsed
    : 0;
}


function validRound(
  value:
    number |
    null |
    undefined
) {
  const parsed =
    Number(
      value
    );

  if (
    !Number.isInteger(
      parsed
    ) ||
    parsed < 1 ||
    parsed > 4
  ) {
    return 1;
  }

  return parsed;
}


function roundName(
  value: number
) {
  switch (
    value
  ) {
    case 1:
      return "Wild Card";

    case 2:
      return "Divisional";

    case 3:
      return "Conference Championships";

    case 4:
      return "Super Bowl";

    default:
      return `Round ${value}`;
  }
}


function formatStatus(
  value:
    string |
    null |
    undefined
) {
  if (!value) {
    return "Building";
  }

  return value
    .replaceAll(
      "_",
      " "
    )
    .replace(
      /\b\w/g,
      (
        character
      ) =>
        character.toUpperCase()
    );
}


function formatPoints(
  value:
    number |
    string |
    null |
    undefined
) {
  return numberValue(
    value
  ).toFixed(
    2
  );
}


function formatMoney(
  value:
    number |
    string |
    null |
    undefined
) {
  if (
    value ==
    null
  ) {
    return "—";
  }

  return new Intl
    .NumberFormat(
      "en-US",
      {
        style:
          "currency",

        currency:
          "USD",

        maximumFractionDigits:
          0,
      }
    )
    .format(
      numberValue(
        value
      )
    );
}


function kickoffText(
  value:
    string |
    null |
    undefined
) {
  if (!value) {
    return null;
  }

  const date =
    new Date(
      value
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return null;
  }

  return date
    .toLocaleString(
      "en-US",
      {
        weekday:
          "short",

        month:
          "short",

        day:
          "numeric",

        hour:
          "numeric",

        minute:
          "2-digit",
      }
    );
}


function statValue(
  value:
    number |
    null |
    undefined
) {
  return Number(
    value ??
      0
  );
}


function normalizePosition(
  player:
    PlayerRow |
    null,

  projection:
    ProjectionRow |
    null,

  fallback:
    string
) {
  const position =
    player
      ?.primary_position ??
    player
      ?.position ??
    projection
      ?.position ??
    fallback;

  if (
    position
      .toUpperCase() ===
    "PK"
  ) {
    return "K";
  }

  return position
    .toUpperCase();
}


function buildStatLine(
  player:
    PlayerRow |
    null,

  stats:
    StatRow |
    null
) {
  if (!stats) {
    return "Stats will appear when the game begins.";
  }

  const position =
    (
      player
        ?.primary_position ??
      player
        ?.position ??
      ""
    )
      .toUpperCase();

  if (
    position ===
    "QB"
  ) {
    const parts:
      string[] =
        [];

    if (
      statValue(
        stats
          .passing_attempts
      ) > 0 ||
      statValue(
        stats
          .passing_completions
      ) > 0
    ) {
      parts.push(
        `${statValue(
          stats
            .passing_completions
        )}/${statValue(
          stats
            .passing_attempts
        )} passing`
      );
    }

    if (
      statValue(
        stats
          .passing_yards
      ) !== 0
    ) {
      parts.push(
        `${statValue(
          stats
            .passing_yards
        )} pass yds`
      );
    }

    if (
      statValue(
        stats
          .passing_touchdowns
      ) !== 0
    ) {
      parts.push(
        `${statValue(
          stats
            .passing_touchdowns
        )} pass TD`
      );
    }

    if (
      statValue(
        stats
          .passing_interceptions
      ) !== 0
    ) {
      parts.push(
        `${statValue(
          stats
            .passing_interceptions
        )} INT`
      );
    }

    if (
      statValue(
        stats
          .rushing_attempts
      ) !== 0
    ) {
      parts.push(
        `${statValue(
          stats
            .rushing_attempts
        )} car`
      );
    }

    if (
      statValue(
        stats
          .rushing_yards
      ) !== 0
    ) {
      parts.push(
        `${statValue(
          stats
            .rushing_yards
        )} rush yds`
      );
    }

    if (
      statValue(
        stats
          .rushing_touchdowns
      ) !== 0
    ) {
      parts.push(
        `${statValue(
          stats
            .rushing_touchdowns
        )} rush TD`
      );
    }

    return (
      parts.join(
        " • "
      ) ||
      "No recorded stats yet."
    );
  }

  if (
    position ===
      "RB" ||
    position ===
      "WR" ||
    position ===
      "TE"
  ) {
    const parts:
      string[] =
        [];

    if (
      statValue(
        stats
          .rushing_attempts
      ) > 0
    ) {
      parts.push(
        `${statValue(
          stats
            .rushing_attempts
        )} car`
      );
    }

    if (
      statValue(
        stats
          .rushing_yards
      ) !== 0
    ) {
      parts.push(
        `${statValue(
          stats
            .rushing_yards
        )} rush yds`
      );
    }

    if (
      statValue(
        stats
          .rushing_touchdowns
      ) !== 0
    ) {
      parts.push(
        `${statValue(
          stats
            .rushing_touchdowns
        )} rush TD`
      );
    }

    if (
      statValue(
        stats
          .receiving_targets
      ) > 0 ||
      statValue(
        stats
          .receptions
      ) > 0
    ) {
      parts.push(
        `${statValue(
          stats
            .receptions
        )}/${statValue(
          stats
            .receiving_targets
        )} rec`
      );
    }

    if (
      statValue(
        stats
          .receiving_yards
      ) !== 0
    ) {
      parts.push(
        `${statValue(
          stats
            .receiving_yards
        )} rec yds`
      );
    }

    if (
      statValue(
        stats
          .receiving_touchdowns
      ) !== 0
    ) {
      parts.push(
        `${statValue(
          stats
            .receiving_touchdowns
        )} rec TD`
      );
    }

    if (
      statValue(
        stats
          .fumbles_lost
      ) !== 0
    ) {
      parts.push(
        `${statValue(
          stats
            .fumbles_lost
        )} FL`
      );
    }

    return (
      parts.join(
        " • "
      ) ||
      "No recorded stats yet."
    );
  }

  if (
    position ===
      "K" ||
    position ===
      "PK"
  ) {
    return [
      `${statValue(
        stats
          .field_goals_made
      )}/${statValue(
        stats
          .field_goals_attempted
      )} FG`,

      `${statValue(
        stats
          .extra_points_made
      )}/${statValue(
        stats
          .extra_points_attempted
      )} XP`,
    ].join(
      " • "
    );
  }

  if (
    position ===
    "DST"
  ) {
    const parts:
      string[] =
        [];

    parts.push(
      `${statValue(
        stats
          .dst_sacks
      )} sacks`
    );

    parts.push(
      `${statValue(
        stats
          .dst_interceptions
      )} INT`
    );

    parts.push(
      `${statValue(
        stats
          .dst_fumble_recoveries
      )} FR`
    );

    if (
      statValue(
        stats
          .dst_touchdowns
      ) > 0
    ) {
      parts.push(
        `${statValue(
          stats
            .dst_touchdowns
        )} TD`
      );
    }

    if (
      statValue(
        stats
          .dst_safeties
      ) > 0
    ) {
      parts.push(
        `${statValue(
          stats
            .dst_safeties
        )} safety`
      );
    }

    if (
      statValue(
        stats
          .dst_blocked_kicks
      ) > 0
    ) {
      parts.push(
        `${statValue(
          stats
            .dst_blocked_kicks
        )} blocked`
      );
    }

    parts.push(
      `${statValue(
        stats
          .dst_points_allowed
      )} PA`
    );

    return parts.join(
      " • "
    );
  }

  return "Live game stats";
}


function slotOrder(
  slot: string
) {
  switch (
    slot
      .toUpperCase()
  ) {
    case "QB":
      return 10;

    case "RB":
      return 20;

    case "WR":
      return 30;

    case "TE":
      return 40;

    case "FLEX":
      return 50;

    case "SUPERFLEX":
      return 60;

    case "K":
      return 70;

    case "DST":
      return 80;

    default:
      return 999;
  }
}


export default function NflPlayoffsLeagueTeamsRealtime({
  leagueId,
  season,
  roundNumber,
  enabled = true,
}: Props) {
  const [
    loading,
    setLoading,
  ] =
    useState(
      true
    );

  const [
    error,
    setError,
  ] =
    useState<
      string |
      null
    >(
      null
    );

  const [
    activeRoundNumber,
    setActiveRoundNumber,
  ] =
    useState(
      validRound(
        roundNumber
      )
    );

  const [
    leagueStatus,
    setLeagueStatus,
  ] =
    useState<
      string |
      null
    >(
      null
    );

  const [
    teams,
    setTeams,
  ] =
    useState<
      TeamRow[]
    >(
      []
    );

  const [
    entries,
    setEntries,
  ] =
    useState<
      EntryRow[]
    >(
      []
    );

  const [
    lineups,
    setLineups,
  ] =
    useState<
      LineupRow[]
    >(
      []
    );

  const [
    players,
    setPlayers,
  ] =
    useState<
      PlayerRow[]
    >(
      []
    );

  const [
    projections,
    setProjections,
  ] =
    useState<
      ProjectionRow[]
    >(
      []
    );

  const [
    scores,
    setScores,
  ] =
    useState<
      ScoreRow[]
    >(
      []
    );

  const [
    stats,
    setStats,
  ] =
    useState<
      StatRow[]
    >(
      []
    );

  const [
    currentRound,
    setCurrentRound,
  ] =
    useState<
      RoundRow |
      null
    >(
      null
    );

  const [
    expandedTeams,
    setExpandedTeams,
  ] =
    useState<
      Set<number>
    >(
      new Set()
    );

  const requestRef =
    useRef(
      0
    );

  const refreshTimerRef =
    useRef<
      ReturnType<
        typeof setTimeout
      > |
      null
    >(
      null
    );

  const supabase =
    useMemo(
      () => {
        const supabaseUrl =
          process.env
            .NEXT_PUBLIC_SUPABASE_URL;

        const supabaseKey =
          process.env
            .NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
          process.env
            .NEXT_PUBLIC_SUPABASE_ANON_KEY;

        if (
          !supabaseUrl ||
          !supabaseKey
        ) {
          return null;
        }

        return createBrowserClient(
          supabaseUrl,
          supabaseKey
        );
      },
      []
    );

  const loadData =
    useCallback(
      async (
        quiet =
          false
      ) => {
        if (
          !enabled ||
          !supabase
        ) {
          return;
        }

        const requestId =
          ++requestRef.current;

        if (!quiet) {
          setLoading(
            true
          );
        }

        try {
          setError(
            null
          );

          const {
            data:
              stateData,

            error:
              stateError,
          } =
            await supabase
              .from(
                "nfl_playoff_league_state"
              )
              .select(`
                active_round,
                status
              `)
              .eq(
                "league_id",
                leagueId
              )
              .eq(
                "season",
                season
              )
              .maybeSingle();

          if (
            stateError
          ) {
            throw new Error(
              `Could not load NFL Playoffs state: ${stateError.message}`
            );
          }

          const state =
            stateData as
              LeagueStateRow |
              null;

          const resolvedRound =
            validRound(
              state
                ?.active_round ??
              roundNumber
            );

          setActiveRoundNumber(
            (
              previousRound
            ) => {
              if (
                previousRound !==
                resolvedRound
              ) {
                setExpandedTeams(
                  new Set()
                );
              }

              return resolvedRound;
            }
          );

          setLeagueStatus(
            state
              ?.status ??
            null
          );

          const [
            teamsResult,
            entriesResult,
            lineupsResult,
            roundResult,
          ] =
            await Promise.all(
              [
                supabase
                  .from(
                    "fantasy_teams"
                  )
                  .select(`
                    id,
                    team_name,
                    owner_id,
                    active
                  `)
                  .eq(
                    "league_id",
                    leagueId
                  )
                  .eq(
                    "active",
                    true
                  )
                  .order(
                    "team_name",
                    {
                      ascending:
                        true,
                    }
                  ),

                supabase
                  .from(
                    "nfl_playoff_round_entries"
                  )
                  .select(`
                    fantasy_team_id,
                    status,
                    salary_used,
                    projected_points,
                    submitted_at
                  `)
                  .eq(
                    "league_id",
                    leagueId
                  )
                  .eq(
                    "season",
                    season
                  )
                  .eq(
                    "round_number",
                    resolvedRound
                  ),

                supabase
                  .from(
                    "nfl_playoff_round_lineups"
                  )
                  .select(`
                    fantasy_team_id,
                    player_id,
                    lineup_slot,
                    slot_index,
                    salary_at_selection,
                    projected_points_at_selection,
                    is_locked,
                    locked_at
                  `)
                  .eq(
                    "league_id",
                    leagueId
                  )
                  .eq(
                    "season",
                    season
                  )
                  .eq(
                    "round_number",
                    resolvedRound
                  )
                  .order(
                    "lineup_slot",
                    {
                      ascending:
                        true,
                    }
                  )
                  .order(
                    "slot_index",
                    {
                      ascending:
                        true,
                    }
                  ),

                supabase
                  .from(
                    "nfl_playoff_rounds"
                  )
                  .select(`
                    round_number,
                    round_name,
                    nfl_week,
                    status
                  `)
                  .eq(
                    "league_id",
                    leagueId
                  )
                  .eq(
                    "season",
                    season
                  )
                  .eq(
                    "round_number",
                    resolvedRound
                  )
                  .maybeSingle(),
              ]
            );

          if (
            teamsResult.error
          ) {
            throw new Error(
              `Could not load league teams: ${teamsResult.error.message}`
            );
          }

          if (
            entriesResult.error
          ) {
            throw new Error(
              `Could not load playoff entries: ${entriesResult.error.message}`
            );
          }

          if (
            lineupsResult.error
          ) {
            throw new Error(
              `Could not load playoff lineups: ${lineupsResult.error.message}`
            );
          }

          if (
            roundResult.error
          ) {
            throw new Error(
              `Could not load playoff round: ${roundResult.error.message}`
            );
          }

          const nextTeams =
            (
              teamsResult.data ??
              []
            ) as TeamRow[];

          const nextEntries =
            (
              entriesResult.data ??
              []
            ) as EntryRow[];

          const nextLineups =
            (
              lineupsResult.data ??
              []
            ) as LineupRow[];

          const nextRound =
            roundResult.data as
              RoundRow |
              null;

          const playerIds =
            Array.from(
              new Set(
                nextLineups
                  .map(
                    (
                      row
                    ) =>
                      Number(
                        row
                          .player_id
                      )
                  )
                  .filter(
                    (
                      playerId
                    ) =>
                      Number
                        .isInteger(
                          playerId
                        ) &&
                      playerId > 0
                  )
              )
            );

          let nextPlayers:
            PlayerRow[] =
              [];

          let nextProjections:
            ProjectionRow[] =
              [];

          let nextScores:
            ScoreRow[] =
              [];

          let nextStats:
            StatRow[] =
              [];

          if (
            playerIds.length >
            0
          ) {
            const [
              playersResult,
              projectionsResult,
            ] =
              await Promise.all(
                [
                  supabase
                    .from(
                      "nfl_players"
                    )
                    .select(`
                      id,
                      full_name,
                      primary_position,
                      position,
                      team_abbreviation,
                      injury_status
                    `)
                    .in(
                      "id",
                      playerIds
                    ),

                  supabase
                    .from(
                      "nfl_playoff_player_projections"
                    )
                    .select(`
                      nfl_player_id,
                      team_abbreviation,
                      position,
                      opponent_abbreviation,
                      home_or_away,
                      kickoff_at,
                      injury_status,
                      projected_points
                    `)
                    .eq(
                      "league_id",
                      leagueId
                    )
                    .eq(
                      "season",
                      season
                    )
                    .eq(
                      "round_number",
                      resolvedRound
                    )
                    .in(
                      "nfl_player_id",
                      playerIds
                    ),
                ]
              );

            if (
              playersResult.error
            ) {
              throw new Error(
                `Could not load NFL players: ${playersResult.error.message}`
              );
            }

            if (
              projectionsResult.error
            ) {
              throw new Error(
                `Could not load playoff player projections: ${projectionsResult.error.message}`
              );
            }

            nextPlayers =
              (
                playersResult.data ??
                []
              ) as PlayerRow[];

            nextProjections =
              (
                projectionsResult.data ??
                []
              ) as ProjectionRow[];

            let scoreQuery =
              supabase
                .from(
                  "fantasy_player_game_scores"
                )
                .select(`
                  nfl_game_id,
                  nfl_player_id,
                  player_game_stat_id,
                  week,
                  fantasy_points,
                  is_live,
                  is_final
                `)
                .eq(
                  "league_id",
                  leagueId
                )
                .eq(
                  "season",
                  season
                )
                .eq(
                  "season_type",
                  3
                )
                .in(
                  "nfl_player_id",
                  playerIds
                );

            if (
              nextRound
                ?.nfl_week !=
              null
            ) {
              scoreQuery =
                scoreQuery
                  .eq(
                    "week",
                    nextRound
                      .nfl_week
                  );
            }

            const scoreResult =
              await scoreQuery;

            if (
              scoreResult.error
            ) {
              throw new Error(
                `Could not load live fantasy scores: ${scoreResult.error.message}`
              );
            }

            nextScores =
              (
                scoreResult.data ??
                []
              ) as ScoreRow[];

            const statIds =
              Array.from(
                new Set(
                  nextScores
                    .map(
                      (
                        score
                      ) =>
                        Number(
                          score
                            .player_game_stat_id
                        )
                    )
                    .filter(
                      (
                        statId
                      ) =>
                        Number
                          .isInteger(
                            statId
                          ) &&
                        statId > 0
                    )
                )
              );

            if (
              statIds.length >
              0
            ) {
              const statsResult =
                await supabase
                  .from(
                    "nfl_player_game_stats"
                  )
                  .select(`
                    id,
                    nfl_game_id,
                    nfl_player_id,
                    game_status,

                    passing_attempts,
                    passing_completions,
                    passing_yards,
                    passing_touchdowns,
                    passing_interceptions,

                    rushing_attempts,
                    rushing_yards,
                    rushing_touchdowns,

                    receiving_targets,
                    receptions,
                    receiving_yards,
                    receiving_touchdowns,

                    fumbles_lost,

                    field_goals_made,
                    field_goals_attempted,
                    extra_points_made,
                    extra_points_attempted,

                    dst_sacks,
                    dst_interceptions,
                    dst_fumble_recoveries,
                    dst_touchdowns,
                    dst_safeties,
                    dst_blocked_kicks,
                    dst_points_allowed,
                    dst_yards_allowed
                  `)
                  .in(
                    "id",
                    statIds
                  );

              if (
                statsResult.error
              ) {
                throw new Error(
                  `Could not load live NFL stats: ${statsResult.error.message}`
                );
              }

              nextStats =
                (
                  statsResult.data ??
                  []
                ) as StatRow[];
            }
          }

          if (
            requestId !==
            requestRef.current
          ) {
            return;
          }

          setTeams(
            nextTeams
          );

          setEntries(
            nextEntries
          );

          setLineups(
            nextLineups
          );

          setPlayers(
            nextPlayers
          );

          setProjections(
            nextProjections
          );

          setScores(
            nextScores
          );

          setStats(
            nextStats
          );

          setCurrentRound(
            nextRound
          );
        } catch (
          loadError
        ) {
          console.error(
            loadError
          );

          if (
            requestId ===
            requestRef.current
          ) {
            setError(
              loadError instanceof
                Error
                ? loadError
                    .message
                : "League Teams could not be loaded."
            );
          }
        } finally {
          if (
            requestId ===
            requestRef.current
          ) {
            setLoading(
              false
            );
          }
        }
      },
      [
        enabled,
        leagueId,
        roundNumber,
        season,
        supabase,
      ]
    );

  useEffect(
    () => {
      void loadData(
        false
      );
    },
    [
      loadData,
    ]
  );

  useEffect(
    () => {
      if (
        !enabled ||
        !supabase
      ) {
        return;
      }

      let cancelled =
        false;

      function scheduleRefresh() {
        if (
          cancelled ||
          document
            .visibilityState ===
            "hidden"
        ) {
          return;
        }

        if (
          refreshTimerRef
            .current
        ) {
          clearTimeout(
            refreshTimerRef
              .current
          );
        }

        refreshTimerRef.current =
          setTimeout(
            () => {
              refreshTimerRef.current =
                null;

              void loadData(
                true
              );
            },
            300
          );
      }

      const channel =
        supabase
          .channel(
            `nfl-playoffs-league-teams-${leagueId}-${season}`
          )

          .on(
            "postgres_changes",
            {
              event:
                "*",

              schema:
                "public",

              table:
                "fantasy_teams",

              filter:
                `league_id=eq.${leagueId}`,
            },
            scheduleRefresh
          )

          .on(
            "postgres_changes",
            {
              event:
                "*",

              schema:
                "public",

              table:
                "nfl_playoff_round_entries",

              filter:
                `league_id=eq.${leagueId}`,
            },
            scheduleRefresh
          )

          .on(
            "postgres_changes",
            {
              event:
                "*",

              schema:
                "public",

              table:
                "nfl_playoff_round_lineups",

              filter:
                `league_id=eq.${leagueId}`,
            },
            scheduleRefresh
          )

          .on(
            "postgres_changes",
            {
              event:
                "*",

              schema:
                "public",

              table:
                "fantasy_player_game_scores",

              filter:
                `league_id=eq.${leagueId}`,
            },
            scheduleRefresh
          )

          .on(
            "postgres_changes",
            {
              event:
                "*",

              schema:
                "public",

              table:
                "nfl_player_game_stats",
            },
            scheduleRefresh
          )

          .on(
            "postgres_changes",
            {
              event:
                "*",

              schema:
                "public",

              table:
                "nfl_playoff_rounds",

              filter:
                `league_id=eq.${leagueId}`,
            },
            scheduleRefresh
          )

          .on(
            "postgres_changes",
            {
              event:
                "*",

              schema:
                "public",

              table:
                "nfl_playoff_league_state",

              filter:
                `league_id=eq.${leagueId}`,
            },
            scheduleRefresh
          )

          .subscribe();

      const poll =
        setInterval(
          () => {
            if (
              document
                .visibilityState ===
              "visible"
            ) {
              void loadData(
                true
              );
            }
          },
          15000
        );

      function handleVisibility() {
        if (
          document
            .visibilityState ===
          "visible"
        ) {
          scheduleRefresh();
        }
      }

      document
        .addEventListener(
          "visibilitychange",
          handleVisibility
        );

      return () => {
        cancelled =
          true;

        if (
          refreshTimerRef
            .current
        ) {
          clearTimeout(
            refreshTimerRef
              .current
          );

          refreshTimerRef.current =
            null;
        }

        clearInterval(
          poll
        );

        document
          .removeEventListener(
            "visibilitychange",
            handleVisibility
          );

        void supabase
          .removeChannel(
            channel
          );
      };
    },
    [
      enabled,
      leagueId,
      loadData,
      season,
      supabase,
    ]
  );

  const playerMap =
    useMemo(
      () =>
        new Map(
          players.map(
            (
              player
            ) => [
              player.id,
              player,
            ]
          )
        ),
      [
        players,
      ]
    );

  const projectionMap =
    useMemo(
      () =>
        new Map(
          projections.map(
            (
              projection
            ) => [
              projection
                .nfl_player_id,
              projection,
            ]
          )
        ),
      [
        projections,
      ]
    );

  const scoreMap =
    useMemo(
      () => {
        const map =
          new Map<
            number,
            ScoreRow
          >();

        for (
          const score
          of scores
        ) {
          const current =
            map.get(
              score
                .nfl_player_id
            );

          if (
            !current ||
            (
              score.is_live &&
              !current
                .is_live
            ) ||
            (
              score.is_final &&
              !current
                .is_live &&
              !current
                .is_final
            )
          ) {
            map.set(
              score
                .nfl_player_id,
              score
            );
          }
        }

        return map;
      },
      [
        scores,
      ]
    );

  const statMap =
    useMemo(
      () =>
        new Map(
          stats.map(
            (
              stat
            ) => [
              stat.id,
              stat,
            ]
          )
        ),
      [
        stats,
      ]
    );

  const entryMap =
    useMemo(
      () =>
        new Map(
          entries.map(
            (
              entry
            ) => [
              entry
                .fantasy_team_id,
              entry,
            ]
          )
        ),
      [
        entries,
      ]
    );

  const teamDisplays =
    useMemo(
      () => {
        const result:
          TeamDisplay[] =
            teams.map(
              (
                team
              ) => {
                const teamLineup =
                  lineups
                    .filter(
                      (
                        row
                      ) =>
                        row
                          .fantasy_team_id ===
                        team.id
                    )
                    .sort(
                      (
                        a,
                        b
                      ) =>
                        slotOrder(
                          a
                            .lineup_slot
                        ) -
                          slotOrder(
                            b
                              .lineup_slot
                          ) ||
                        a
                          .slot_index -
                          b
                            .slot_index
                    );

                let fantasyPoints =
                  0;

                let livePlayers =
                  0;

                let finalPlayers =
                  0;

                let scheduledPlayers =
                  0;

                for (
                  const lineup
                  of teamLineup
                ) {
                  const score =
                    scoreMap.get(
                      lineup
                        .player_id
                    );

                  fantasyPoints +=
                    numberValue(
                      score
                        ?.fantasy_points
                    );

                  if (
                    score
                      ?.is_live
                  ) {
                    livePlayers +=
                      1;
                  } else if (
                    score
                      ?.is_final
                  ) {
                    finalPlayers +=
                      1;
                  } else {
                    scheduledPlayers +=
                      1;
                  }
                }

                return {
                  team,

                  entry:
                    entryMap.get(
                      team.id
                    ) ??
                    null,

                  lineup:
                    teamLineup,

                  fantasyPoints,

                  livePlayers,

                  finalPlayers,

                  scheduledPlayers,
                };
              }
            );

        result.sort(
          (
            a,
            b
          ) =>
            a.team
              .team_name
              .localeCompare(
                b.team
                  .team_name
              )
        );

        return result;
      },
      [
        entryMap,
        lineups,
        scoreMap,
        teams,
      ]
    );

  function toggleTeam(
    teamId: number
  ) {
    setExpandedTeams(
      (
        current
      ) => {
        const next =
          new Set(
            current
          );

        if (
          next.has(
            teamId
          )
        ) {
          next.delete(
            teamId
          );
        } else {
          next.add(
            teamId
          );
        }

        return next;
      }
    );
  }

  function collapseAll() {
    setExpandedTeams(
      new Set()
    );
  }

  function expandAll() {
    setExpandedTeams(
      new Set(
        teamDisplays.map(
          (
            display
          ) =>
            display
              .team.id
        )
      )
    );
  }

  const visibleRoundName =
    currentRound
      ?.round_name ??
    roundName(
      activeRoundNumber
    );

  if (
    loading
  ) {
    return (
      <main
        style={
          styles.page
        }
      >
        <div
          style={
            styles.shell
          }
        >
          <section
            style={
              styles.hero
            }
          >
            <div>
              <p
                style={
                  styles.eyebrow
                }
              >
                NFL PLAYOFFS
              </p>

              <h1
                style={
                  styles.title
                }
              >
                League Teams
              </h1>

              <p
                style={
                  styles.muted
                }
              >
                Loading league teams…
              </p>
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main
      className="g365-nfl-playoff-teams"
      style={
        styles.page
      }
    >
      <style>{`
        .g365-nfl-playoff-teams,
        .g365-nfl-playoff-teams * {
          box-sizing: border-box;
        }

        .g365-team-card-button:hover {
          background:
            rgba(255,83,18,.07) !important;
        }

        .g365-player-row:last-child {
          border-bottom:
            0 !important;
        }

        .g365-action-button:hover {
          border-color:
            rgba(255,99,30,.75) !important;

          color:
            #ff7a38 !important;
        }

        @media (max-width: 820px) {
          .g365-playoff-team-summary {
            grid-template-columns:
              minmax(0,1fr) auto !important;
          }

          .g365-playoff-team-summary-stats {
            grid-column:
              1 / -1;

            grid-template-columns:
              repeat(4,minmax(0,1fr)) !important;
          }

          .g365-team-chevron {
            grid-column:
              2;

            grid-row:
              1;
          }

          .g365-player-row {
            grid-template-columns:
              52px minmax(0,1fr) 72px !important;
          }

          .g365-player-game {
            grid-column:
              2 / -1;
          }

          .g365-player-stats {
            grid-column:
              2 / -1 !important;
          }
        }

        @media (max-width: 760px) {
          .g365-nfl-playoff-teams {
            padding:
              12px 10px 54px !important;
          }

          .g365-playoff-team-summary-stats {
            grid-template-columns:
              repeat(2,minmax(0,1fr)) !important;
          }

          .g365-team-controls {
            width:
              100%;
          }

          .g365-team-controls button {
            flex:
              1 1 0;
          }
        }

        @media (max-width: 430px) {
          .g365-player-row {
            padding:
              12px 10px !important;
          }

          .g365-entry-bar {
            gap:
              8px !important;
          }
        }
      `}</style>

      <div
        style={
          styles.shell
        }
      >
        <section
          style={
            styles.hero
          }
        >
          <div>
            <p
              style={
                styles.eyebrow
              }
            >
              NFL PLAYOFFS • ROUND {activeRoundNumber}
            </p>

            <h1
              style={
                styles.title
              }
            >
              League Teams
            </h1>

            <p
              style={
                styles.subtitle
              }
            >
              {visibleRoundName}
            </p>
          </div>

          <div
            style={
              styles.liveBox
            }
          >
            <span
              style={
                styles.liveDot
              }
            />

            <span>
              LIVE SCORING
            </span>
          </div>
        </section>

        <section
          style={
            styles.roundProgress
          }
        >
          {[
            1,
            2,
            3,
            4,
          ].map(
            (
              value
            ) => {
              const active =
                value ===
                activeRoundNumber;

              const completed =
                value <
                activeRoundNumber;

              return (
                <div
                  key={
                    value
                  }
                  style={{
                    ...styles
                      .roundProgressItem,

                    ...(active
                      ? styles
                          .roundProgressActive
                      : {}),

                    ...(completed
                      ? styles
                          .roundProgressComplete
                      : {}),
                  }}
                >
                  <span
                    style={
                      styles.roundSmall
                    }
                  >
                    ROUND {value}
                  </span>

                  <strong>
                    {roundName(
                      value
                    )}
                  </strong>
                </div>
              );
            }
          )}
        </section>

        <section
          style={
            styles.introRow
          }
        >
          <p
            style={
              styles.description
            }
          >
            Every active league team appears below. Team cards
            start collapsed. Open any team to follow that team&apos;s
            current playoff lineup, live NFL statistics and fantasy
            points.
          </p>

          <div
            className="g365-team-controls"
            style={
              styles.controls
            }
          >
            <button
              type="button"
              className="g365-action-button"
              onClick={
                collapseAll
              }
              style={
                styles.controlButton
              }
            >
              Collapse All
            </button>

            <button
              type="button"
              className="g365-action-button"
              onClick={
                expandAll
              }
              style={
                styles.controlButton
              }
            >
              Expand All
            </button>
          </div>
        </section>

        {leagueStatus ? (
          <div
            style={
              styles.leagueStatus
            }
          >
            League status:{" "}
            <strong>
              {formatStatus(
                leagueStatus
              )}
            </strong>
          </div>
        ) : null}

        {error ? (
          <div
            style={
              styles.error
            }
          >
            {error}
          </div>
        ) : null}

        {teamDisplays.length ===
        0 ? (
          <section
            style={
              styles.emptyCard
            }
          >
            <h2
              style={
                styles.emptyTitle
              }
            >
              No active league teams found
            </h2>

            <p
              style={
                styles.muted
              }
            >
              Active fantasy teams will automatically appear here
              as members join the league.
            </p>
          </section>
        ) : (
          <section
            style={
              styles.teamList
            }
          >
            {teamDisplays.map(
              (
                display
              ) => {
                const expanded =
                  expandedTeams.has(
                    display
                      .team.id
                  );

                return (
                  <article
                    key={
                      display
                        .team.id
                    }
                    style={
                      styles.teamCard
                    }
                  >
                    <button
                      type="button"
                      className="g365-team-card-button"
                      onClick={() =>
                        toggleTeam(
                          display
                            .team.id
                        )
                      }
                      aria-expanded={
                        expanded
                      }
                      style={
                        styles.teamButton
                      }
                    >
                      {expanded ? (
                        <div
                          className="g365-playoff-team-summary"
                          style={
                            styles.teamSummary
                          }
                        >
                          <div
                            style={
                              styles.teamIdentity
                            }
                          >
                            <div
                              style={
                                styles.teamIcon
                              }
                            >
                              G365
                            </div>

                            <div
                              style={{
                                minWidth:
                                  0,
                              }}
                            >
                              <div
                                style={
                                  styles.teamName
                                }
                              >
                                {
                                  display
                                    .team
                                    .team_name
                                }
                              </div>

                              <div
                                style={
                                  styles.teamMeta
                                }
                              >
                                {formatStatus(
                                  display
                                    .entry
                                    ?.status
                                )}

                                {" • "}

                                {
                                  display
                                    .lineup
                                    .length
                                }{" "}
                                lineup players
                              </div>
                            </div>
                          </div>

                          <div
                            className="g365-playoff-team-summary-stats"
                            style={
                              styles.summaryStats
                            }
                          >
                            <SummaryValue
                              label="ROUND POINTS"
                              value={formatPoints(
                                display
                                  .fantasyPoints
                              )}
                              emphasize
                            />

                            <SummaryValue
                              label="PROJECTED"
                              value={formatPoints(
                                display
                                  .entry
                                  ?.projected_points
                              )}
                            />

                            <SummaryValue
                              label="LIVE"
                              value={String(
                                display
                                  .livePlayers
                              )}
                            />

                            <SummaryValue
                              label="FINAL"
                              value={`${display.finalPlayers}/${display.lineup.length}`}
                            />
                          </div>

                          <div
                            className="g365-team-chevron"
                            style={
                              styles.chevron
                            }
                          >
                            ▲
                          </div>
                        </div>
                      ) : (
                        <div
                          style={
                            styles.collapsedTeamRow
                          }
                        >
                          <div
                            style={
                              styles.collapsedIdentity
                            }
                          >
                            <div
                              style={
                                styles.collapsedTeamIcon
                              }
                            >
                              G365
                            </div>

                            <div
                              style={{
                                minWidth:
                                  0,
                              }}
                            >
                              <div
                                style={
                                  styles.collapsedTeamName
                                }
                              >
                                {
                                  display
                                    .team
                                    .team_name
                                }
                              </div>

                              <div
                                style={
                                  styles.collapsedMeta
                                }
                              >
                                {
                                  visibleRoundName
                                }

                                {" • "}

                                {formatStatus(
                                  display
                                    .entry
                                    ?.status
                                )}
                              </div>
                            </div>
                          </div>

                          <div
                            style={
                              styles.collapsedPoints
                            }
                          >
                            <strong>
                              {formatPoints(
                                display
                                  .fantasyPoints
                              )}
                            </strong>

                            <span
                              style={
                                styles.collapsedPointsLabel
                              }
                            >
                              PTS
                            </span>
                          </div>

                          <div
                            style={
                              styles.chevron
                            }
                          >
                            ▼
                          </div>
                        </div>
                      )}
                    </button>

                    {expanded ? (
                      <div
                        style={
                          styles.expanded
                        }
                      >
                        <div
                          className="g365-entry-bar"
                          style={
                            styles.entryBar
                          }
                        >
                          <span>
                            <strong>
                              Round:
                            </strong>{" "}
                            {
                              visibleRoundName
                            }
                          </span>

                          <span>
                            <strong>
                              Status:
                            </strong>{" "}
                            {formatStatus(
                              display
                                .entry
                                ?.status
                            )}
                          </span>

                          <span>
                            <strong>
                              Points:
                            </strong>{" "}
                            {formatPoints(
                              display
                                .fantasyPoints
                            )}
                          </span>

                          <span>
                            <strong>
                              Projected:
                            </strong>{" "}
                            {formatPoints(
                              display
                                .entry
                                ?.projected_points
                            )}
                          </span>

                          {display
                            .entry
                            ?.salary_used !=
                          null ? (
                            <span>
                              <strong>
                                Salary:
                              </strong>{" "}
                              {formatMoney(
                                display
                                  .entry
                                  ?.salary_used
                              )}
                            </span>
                          ) : null}

                          <span>
                            <strong>
                              Live:
                            </strong>{" "}
                            {
                              display
                                .livePlayers
                            }
                          </span>

                          <span>
                            <strong>
                              Remaining:
                            </strong>{" "}
                            {
                              display
                                .scheduledPlayers
                            }
                          </span>
                        </div>

                        {display
                          .lineup
                          .length ===
                        0 ? (
                          <div
                            style={
                              styles.noLineup
                            }
                          >
                            This team has not selected a lineup for{" "}
                            {visibleRoundName} yet.
                          </div>
                        ) : (
                          <div>
                            {display
                              .lineup
                              .map(
                                (
                                  lineup
                                ) => {
                                  const player =
                                    playerMap.get(
                                      lineup
                                        .player_id
                                    ) ??
                                    null;

                                  const projection =
                                    projectionMap.get(
                                      lineup
                                        .player_id
                                    ) ??
                                    null;

                                  const score =
                                    scoreMap.get(
                                      lineup
                                        .player_id
                                    ) ??
                                    null;

                                  const playerStats =
                                    score
                                      ?.player_game_stat_id !=
                                    null
                                      ? statMap.get(
                                          Number(
                                            score
                                              .player_game_stat_id
                                          )
                                        ) ??
                                        null
                                      : null;

                                  const position =
                                    normalizePosition(
                                      player,
                                      projection,
                                      lineup
                                        .lineup_slot
                                    );

                                  const nflTeam =
                                    player
                                      ?.team_abbreviation ??
                                    projection
                                      ?.team_abbreviation ??
                                    "—";

                                  const opponent =
                                    projection
                                      ?.opponent_abbreviation ??
                                    null;

                                  const homeOrAway =
                                    (
                                      projection
                                        ?.home_or_away ??
                                      ""
                                    )
                                      .toLowerCase();

                                  const gameLabel =
                                    opponent
                                      ? `${
                                          homeOrAway ===
                                          "away"
                                            ? "@"
                                            : "vs"
                                        } ${opponent}`
                                      : null;

                                  const kickoff =
                                    kickoffText(
                                      projection
                                        ?.kickoff_at
                                    );

                                  const statusText =
                                    score
                                      ?.is_live
                                      ? "LIVE"
                                      : score
                                          ?.is_final
                                        ? "FINAL"
                                        : playerStats
                                            ?.game_status
                                          ? formatStatus(
                                              playerStats
                                                .game_status
                                            )
                                          : "SCHEDULED";

                                  return (
                                    <div
                                      key={`${display.team.id}-${lineup.lineup_slot}-${lineup.slot_index}`}
                                      className="g365-player-row"
                                      style={
                                        styles.playerRow
                                      }
                                    >
                                      <div
                                        style={
                                          styles.slotBadge
                                        }
                                      >
                                        {
                                          lineup
                                            .lineup_slot
                                        }
                                      </div>

                                      <div
                                        style={{
                                          minWidth:
                                            0,
                                        }}
                                      >
                                        <div
                                          style={
                                            styles.playerName
                                          }
                                        >
                                          {player
                                            ?.full_name ??
                                            `Player #${lineup.player_id}`}
                                        </div>

                                        <div
                                          style={
                                            styles.playerMeta
                                          }
                                        >
                                          {
                                            position
                                          }{" "}
                                          •{" "}
                                          {
                                            nflTeam
                                          }

                                          {lineup
                                            .is_locked
                                            ? " • LOCKED"
                                            : ""}
                                        </div>
                                      </div>

                                      <div
                                        style={
                                          styles.playerPoints
                                        }
                                      >
                                        <strong>
                                          {formatPoints(
                                            score
                                              ?.fantasy_points
                                          )}
                                        </strong>

                                        <span
                                          style={
                                            styles.pointsLabel
                                          }
                                        >
                                          FPTS
                                        </span>
                                      </div>

                                      <div
                                        className="g365-player-game"
                                        style={
                                          styles.playerGame
                                        }
                                      >
                                        <span
                                          style={{
                                            ...styles
                                              .gameStatus,

                                            ...(score
                                              ?.is_live
                                              ? styles
                                                  .statusLive
                                              : score
                                                  ?.is_final
                                                ? styles
                                                    .statusFinal
                                                : {}),
                                          }}
                                        >
                                          {
                                            statusText
                                          }
                                        </span>

                                        {gameLabel ? (
                                          <span>
                                            {
                                              gameLabel
                                            }
                                          </span>
                                        ) : null}

                                        {kickoff ? (
                                          <span>
                                            {
                                              kickoff
                                            }
                                          </span>
                                        ) : null}
                                      </div>

                                      <div
                                        className="g365-player-stats"
                                        style={
                                          styles.playerStats
                                        }
                                      >
                                        {buildStatLine(
                                          player,
                                          playerStats
                                        )}
                                      </div>
                                    </div>
                                  );
                                }
                              )}
                          </div>
                        )}
                      </div>
                    ) : null}
                  </article>
                );
              }
            )}
          </section>
        )}

        <div
          style={
            styles.footerNote
          }
        >
          League Teams automatically refreshes NFL statistics,
          fantasy points, team round totals, lineup locks, team
          membership and playoff-round advancement. Official
          cumulative postseason rankings remain on the Standings
          page.
        </div>
      </div>
    </main>
  );
}


function SummaryValue({
  label,
  value,
  emphasize = false,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div
      style={
        styles.summaryValue
      }
    >
      <span
        style={
          styles.summaryLabel
        }
      >
        {label}
      </span>

      <strong
        style={{
          ...styles.summaryNumber,

          ...(emphasize
            ? styles
                .summaryNumberEmphasized
            : {}),
        }}
      >
        {value}
      </strong>
    </div>
  );
}


const styles:
  Record<
    string,
    CSSProperties
  > = {
  page: {
    minHeight:
      "100vh",

    padding:
      "24px 16px 64px",

    background:
      "#090909",

    color:
      "#ffffff",
  },


  shell: {
    width:
      "100%",

    maxWidth:
      1180,

    margin:
      "0 auto",
  },


  hero: {
    display:
      "flex",

    alignItems:
      "flex-end",

    justifyContent:
      "space-between",

    gap:
      18,

    flexWrap:
      "wrap",

    padding:
      "24px 0 18px",

    borderBottom:
      "1px solid rgba(255,255,255,0.10)",
  },


  eyebrow: {
    margin:
      "0 0 7px",

    color:
      "#ff5a19",

    fontSize:
      12,

    fontWeight:
      900,

    letterSpacing:
      "0.14em",
  },


  title: {
    margin:
      0,

    fontSize:
      "clamp(30px,5vw,48px)",

    lineHeight:
      1,

    letterSpacing:
      "-0.04em",
  },


  subtitle: {
    margin:
      "8px 0 0",

    color:
      "#b9b9b9",

    fontWeight:
      800,
  },


  muted: {
    color:
      "#9d9d9d",
  },


  liveBox: {
    display:
      "inline-flex",

    alignItems:
      "center",

    gap:
      8,

    padding:
      "9px 12px",

    borderRadius:
      999,

    border:
      "1px solid rgba(255,88,25,0.45)",

    background:
      "rgba(255,75,15,0.08)",

    color:
      "#ff7a35",

    fontSize:
      12,

    fontWeight:
      900,

    letterSpacing:
      "0.08em",
  },


  liveDot: {
    width:
      8,

    height:
      8,

    borderRadius:
      "50%",

    background:
      "#ff4c16",

    boxShadow:
      "0 0 12px rgba(255,76,22,0.85)",
  },


  roundProgress: {
    display:
      "grid",

    gridTemplateColumns:
      "repeat(4,minmax(0,1fr))",

    gap:
      8,

    marginTop:
      18,

    overflowX:
      "auto",
  },


  roundProgressItem: {
    minWidth:
      145,

    display:
      "grid",

    gap:
      4,

    padding:
      "12px 13px",

    border:
      "1px solid rgba(255,255,255,0.08)",

    borderRadius:
      12,

    background:
      "#101010",

    color:
      "#6f6f6f",

    fontSize:
      12,
  },


  roundProgressActive: {
    border:
      "1px solid rgba(255,91,24,0.65)",

    background:
      "linear-gradient(135deg,rgba(176,21,21,0.18),rgba(255,91,24,0.12))",

    color:
      "#ffffff",
  },


  roundProgressComplete: {
    border:
      "1px solid rgba(51,170,88,0.28)",

    color:
      "#8ac99a",
  },


  roundSmall: {
    color:
      "#777",

    fontSize:
      8,

    fontWeight:
      900,

    letterSpacing:
      "0.09em",
  },


  introRow: {
    display:
      "flex",

    alignItems:
      "center",

    justifyContent:
      "space-between",

    gap:
      14,

    flexWrap:
      "wrap",

    margin:
      "18px 0",
  },


  description: {
    margin:
      0,

    color:
      "#a5a5a5",

    lineHeight:
      1.6,

    maxWidth:
      760,
  },


  controls: {
    display:
      "flex",

    gap:
      8,
  },


  controlButton: {
    padding:
      "9px 12px",

    borderRadius:
      10,

    border:
      "1px solid rgba(255,255,255,0.12)",

    background:
      "#121212",

    color:
      "#bdbdbd",

    fontWeight:
      800,

    fontSize:
      11,

    cursor:
      "pointer",
  },


  leagueStatus: {
    margin:
      "0 0 14px",

    color:
      "#777",

    fontSize:
      11,
  },


  error: {
    margin:
      "0 0 16px",

    padding:
      14,

    borderRadius:
      12,

    border:
      "1px solid rgba(255,70,70,0.40)",

    background:
      "rgba(150,0,0,0.16)",

    color:
      "#ffb4b4",
  },


  teamList: {
    display:
      "grid",

    gap:
      10,
  },


  teamCard: {
    overflow:
      "hidden",

    border:
      "1px solid rgba(255,255,255,0.11)",

    borderRadius:
      14,

    background:
      "#111111",

    boxShadow:
      "0 12px 34px rgba(0,0,0,0.22)",
  },


  teamButton: {
    width:
      "100%",

    display:
      "block",

    padding:
      0,

    border:
      0,

    background:
      "transparent",

    color:
      "inherit",

    cursor:
      "pointer",

    textAlign:
      "left",
  },


  collapsedTeamRow: {
    display:
      "grid",

    gridTemplateColumns:
      "minmax(0,1fr) auto 24px",

    alignItems:
      "center",

    gap:
      14,

    minHeight:
      62,

    padding:
      "10px 16px",
  },


  collapsedIdentity: {
    display:
      "flex",

    alignItems:
      "center",

    gap:
      11,

    minWidth:
      0,
  },


  collapsedTeamIcon: {
    flex:
      "0 0 auto",

    width:
      34,

    height:
      34,

    borderRadius:
      9,

    display:
      "grid",

    placeItems:
      "center",

    background:
      "linear-gradient(135deg,#9e1111,#ff641a)",

    color:
      "#ffffff",

    fontWeight:
      950,

    fontSize:
      8,
  },


  collapsedTeamName: {
    overflow:
      "hidden",

    textOverflow:
      "ellipsis",

    whiteSpace:
      "nowrap",

    color:
      "#ffffff",

    fontSize:
      15,

    fontWeight:
      900,
  },


  collapsedMeta: {
    marginTop:
      3,

    color:
      "#777",

    fontSize:
      10,

    fontWeight:
      700,
  },


  collapsedPoints: {
    display:
      "flex",

    alignItems:
      "baseline",

    justifyContent:
      "flex-end",

    gap:
      5,

    color:
      "#ff6720",

    fontSize:
      17,
  },


  collapsedPointsLabel: {
    color:
      "#777",

    fontSize:
      8,

    fontWeight:
      900,

    letterSpacing:
      "0.08em",
  },


  teamSummary: {
    display:
      "grid",

    gridTemplateColumns:
      "minmax(220px,1fr) minmax(330px,auto) 30px",

    alignItems:
      "center",

    gap:
      18,

    padding:
      "18px 20px",
  },


  teamIdentity: {
    display:
      "flex",

    alignItems:
      "center",

    gap:
      13,

    minWidth:
      0,
  },


  teamIcon: {
    flex:
      "0 0 auto",

    width:
      42,

    height:
      42,

    borderRadius:
      11,

    display:
      "grid",

    placeItems:
      "center",

    background:
      "linear-gradient(135deg,#9e1111,#ff641a)",

    color:
      "#ffffff",

    fontWeight:
      950,

    fontSize:
      10,

    letterSpacing:
      "-0.03em",
  },


  teamName: {
    overflow:
      "hidden",

    textOverflow:
      "ellipsis",

    whiteSpace:
      "nowrap",

    fontSize:
      19,

    fontWeight:
      950,
  },


  teamMeta: {
    marginTop:
      5,

    color:
      "#969696",

    fontSize:
      12,

    fontWeight:
      700,
  },


  summaryStats: {
    display:
      "grid",

    gridTemplateColumns:
      "repeat(4,minmax(68px,1fr))",

    gap:
      12,
  },


  summaryValue: {
    display:
      "grid",

    gap:
      3,
  },


  summaryLabel: {
    color:
      "#777",

    fontSize:
      9,

    fontWeight:
      900,

    letterSpacing:
      "0.08em",
  },


  summaryNumber: {
    color:
      "#e7e7e7",

    fontSize:
      16,
  },


  summaryNumberEmphasized: {
    color:
      "#ff6720",

    fontSize:
      20,
  },


  chevron: {
    color:
      "#ff6420",

    fontWeight:
      900,

    textAlign:
      "right",
  },


  expanded: {
    borderTop:
      "1px solid rgba(255,255,255,0.09)",

    background:
      "#0c0c0c",
  },


  entryBar: {
    display:
      "flex",

    alignItems:
      "center",

    gap:
      18,

    flexWrap:
      "wrap",

    padding:
      "12px 18px",

    borderBottom:
      "1px solid rgba(255,255,255,0.08)",

    color:
      "#999",

    fontSize:
      12,
  },


  playerRow: {
    display:
      "grid",

    gridTemplateColumns:
      "58px minmax(190px,1fr) 80px minmax(185px,0.75fr)",

    alignItems:
      "center",

    gap:
      12,

    padding:
      "14px 18px",

    borderBottom:
      "1px solid rgba(255,255,255,0.07)",
  },


  slotBadge: {
    display:
      "inline-flex",

    alignItems:
      "center",

    justifyContent:
      "center",

    minHeight:
      30,

    padding:
      "4px 6px",

    borderRadius:
      8,

    background:
      "rgba(255,90,20,0.13)",

    border:
      "1px solid rgba(255,90,20,0.24)",

    color:
      "#ff7838",

    fontSize:
      10,

    fontWeight:
      950,
  },


  playerName: {
    fontWeight:
      900,

    fontSize:
      15,
  },


  playerMeta: {
    marginTop:
      4,

    color:
      "#858585",

    fontSize:
      11,

    fontWeight:
      700,
  },


  playerPoints: {
    display:
      "grid",

    justifyItems:
      "end",

    color:
      "#ffffff",

    fontSize:
      19,
  },


  pointsLabel: {
    marginTop:
      2,

    color:
      "#666",

    fontSize:
      8,

    fontWeight:
      900,

    letterSpacing:
      "0.08em",
  },


  playerGame: {
    display:
      "flex",

    flexDirection:
      "column",

    gap:
      3,

    color:
      "#999",

    fontSize:
      10,

    fontWeight:
      700,
  },


  gameStatus: {
    width:
      "fit-content",

    padding:
      "3px 6px",

    borderRadius:
      999,

    background:
      "#202020",

    color:
      "#a5a5a5",

    fontSize:
      9,

    fontWeight:
      950,

    letterSpacing:
      "0.05em",
  },


  statusLive: {
    background:
      "rgba(255,71,18,0.16)",

    color:
      "#ff6724",
  },


  statusFinal: {
    background:
      "rgba(61,185,94,0.12)",

    color:
      "#70d28a",
  },


  playerStats: {
    gridColumn:
      "2 / -1",

    marginTop:
      -3,

    color:
      "#b7b7b7",

    fontSize:
      11,

    lineHeight:
      1.5,
  },


  noLineup: {
    padding:
      "24px 18px",

    color:
      "#8f8f8f",

    textAlign:
      "center",
  },


  emptyCard: {
    padding:
      32,

    border:
      "1px solid rgba(255,255,255,0.10)",

    borderRadius:
      16,

    background:
      "#111",
  },


  emptyTitle: {
    margin:
      "0 0 8px",

    fontSize:
      20,
  },


  footerNote: {
    marginTop:
      20,

    padding:
      "14px 4px",

    color:
      "#707070",

    fontSize:
      11,

    lineHeight:
      1.5,
  },
};