"use client";

import {
  type CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  useParams,
  useRouter,
} from "next/navigation";

import G365MarchMadnessBracket from "@/components/playoffs/G365MarchMadnessBracket";

import {
  createBrowserClient,
} from "@supabase/ssr";

const supabase =
  createBrowserClient(
    process.env
      .NEXT_PUBLIC_SUPABASE_URL!,

    process.env
      .NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env
      .NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

type LeagueRow = {
  id: string;
  name: string;
  league_type: string;
  season: number;
};

type MembershipRow = {
  role: string;
};

type SettingsRow = {
  regular_season_weeks: number;
  playoff_team_count: number;
  playoff_start_week: number;
  playoff_weeks: number;
  playoff_reseeding: boolean;
  consolation_bracket_enabled: boolean;
  standings_tiebreaker: string;
};

type ProjectedPlayoffRow = {
  team_id: number;
  team_name: string;
  wins: number;
  losses: number;
  ties: number;
  points_for: number | string;
  games_played: number;
  seed: number;
  playoff_probability:
    | number
    | string;
  projected_playoff_team: boolean;
};

type ProjectedTeam = {
  teamId: number;
  teamName: string;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  gamesPlayed: number;
  seed: number;
  playoffProbability: number;
  projectedPlayoffTeam: boolean;
};

type TraditionalStandingRow = {
  seed: number;
  team_id: number;
  team_name: string;
  wins: number;
  losses: number;
  ties: number;
  games_played: number;
  win_percentage:
    | number
    | string;
  points_for:
    | number
    | string;
  points_against:
    | number
    | string;
  point_differential:
    | number
    | string;
  streak: string;
};

type SeedTieResolutionRow = {
  team_id: number;
  resolved_seed: number;
  reason: string | null;
};

type PlayoffSeedTieGroup = {
  originalSeed: number;
  teams: TraditionalStandingRow[];
  firstAllowedSeed: number;
  lastAllowedSeed: number;
  isResolved: boolean;
};

type LeaguePlayoffRow = {
  id: number;
  league_id: string;
  season: number;
  playoff_team_count: number;
  playoff_start_week: number;
  playoff_weeks: number;
  current_round: number | null;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  champion_team_id: number | null;
  updated_at: string;
};

type PlayoffSeedRow = {
  team_id: number;
  seed: number;
};

type TeamRow = {
  id: number;
  team_name: string | null;
  wins: number;
  losses: number;
  ties: number;
};

type PlayoffMatchupRow = {
  id: number;
  league_id: string;
  season: number;
  week: number;
  home_team_id: number | null;
  away_team_id: number | null;
  home_projected_points:
    | number
    | string;
  away_projected_points:
    | number
    | string;
  home_points:
    | number
    | string;
  away_points:
    | number
    | string;
  winner_team_id: number | null;
  is_tie: boolean;
  matchup_type: string;
  playoff_round: number | null;
  playoff_slot: number | null;
  home_seed: number | null;
  away_seed: number | null;
  status: string;
  finalized_at: string | null;
  updated_at: string;
};

type PlayoffMatchupView = {
  id: number;
  week: number;
  round: number;
  slot: number;
  matchupType:
    | "playoff"
    | "championship"
    | "consolation";
  homeTeam: TeamRow | null;
  awayTeam: TeamRow | null;
  homeSeed: number | null;
  awaySeed: number | null;
  homeProjectedPoints: number;
  awayProjectedPoints: number;
  homePoints: number;
  awayPoints: number;
  winnerTeamId: number | null;
  isTie: boolean;
  status: string;
};

type ProjectedMatchup = {
  key: string;
  round: number;
  label: string;
  home: ProjectedTeam | null;
  away: ProjectedTeam | null;
  byeTeam: ProjectedTeam | null;
};

export default function PlayoffsPage() {
  const params =
    useParams();

  const router =
    useRouter();

  const leagueId =
    typeof params.leagueId ===
    "string"
      ? params.leagueId
      : "";

  const [
    league,
    setLeague,
  ] =
    useState<LeagueRow | null>(
      null
    );

  const [
    settings,
    setSettings,
  ] =
    useState<SettingsRow | null>(
      null
    );

  const [
    projectedTeams,
    setProjectedTeams,
  ] =
    useState<ProjectedTeam[]>(
      []
    );

  const [
    playoffState,
    setPlayoffState,
  ] =
    useState<LeaguePlayoffRow | null>(
      null
    );

  const [
    playoffMatchups,
    setPlayoffMatchups,
  ] =
    useState<PlayoffMatchupView[]>(
      []
    );

  const [
    championTeam,
    setChampionTeam,
  ] =
    useState<TeamRow | null>(
      null
    );

  const [
    currentWeek,
    setCurrentWeek,
  ] =
    useState(1);


  const [
    isCommissioner,
    setIsCommissioner,
  ] =
    useState(false);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    working,
    setWorking,
  ] =
    useState(false);

  const [
    autoRefreshing,
    setAutoRefreshing,
  ] =
    useState(false);

  const [
    resolvingTiebreakMatchupId,
    setResolvingTiebreakMatchupId,
  ] = useState<number | null>(null);

  const [
    finalStandings,
    setFinalStandings,
  ] =
    useState<
      TraditionalStandingRow[]
    >([]);

  const [
    seedTieResolutions,
    setSeedTieResolutions,
  ] =
    useState<
      SeedTieResolutionRow[]
    >([]);

  const [
    resolvingSeedTeamId,
    setResolvingSeedTeamId,
  ] =
    useState<number | null>(
      null
    );

  const [
    message,
    setMessage,
  ] =
    useState("");

  const [
    isError,
    setIsError,
  ] =
    useState(false);

  const loadPage =
    useCallback(
      async () => {
        if (!leagueId) {
          return;
        }

        setLoading(true);
        setMessage("");
        setIsError(false);

        try {
          const {
            data:
              userData,
            error:
              userError,
          } =
            await supabase.auth
              .getUser();

          const user =
            userData.user;

          if (
            userError ||
            !user
          ) {
            router.replace("/");
            return;
          }

          const [
            leagueResult,
            membershipResult,
            settingsResult,
          ] =
            await Promise.all([
              supabase
                .from("leagues")
                .select(`
                  id,
                  name,
                  league_type,
                  season
                `)
                .eq(
                  "id",
                  leagueId
                )
                .single(),

              supabase
                .from(
                  "league_members"
                )
                .select("role")
                .eq(
                  "league_id",
                  leagueId
                )
                .eq(
                  "user_id",
                  user.id
                )
                .maybeSingle(),

              supabase
                .from(
                  "league_settings"
                )
                .select(`
                  regular_season_weeks,
                  playoff_team_count,
                  playoff_start_week,
                  playoff_weeks,
                  playoff_reseeding,
                  consolation_bracket_enabled,
                  standings_tiebreaker
                `)
                .eq(
                  "league_id",
                  leagueId
                )
                .single(),
            ]);

          if (
            leagueResult.error ||
            !leagueResult.data
          ) {
            throw new Error(
              leagueResult.error
                ?.message ??
                "League could not be loaded."
            );
          }

          if (
            membershipResult.error ||
            !membershipResult.data
          ) {
            throw new Error(
              "You must belong to this league."
            );
          }

          if (
            settingsResult.error ||
            !settingsResult.data
          ) {
            throw new Error(
              settingsResult.error
                ?.message ??
                "Playoff settings could not be loaded."
            );
          }

          const loadedLeague =
            leagueResult.data as
              LeagueRow;

          const loadedSettings =
            settingsResult.data as
              SettingsRow;

          if (
            loadedLeague
              .league_type !==
            "traditional"
          ) {
            throw new Error(
              "Playoffs are only available for Traditional leagues."
            );
          }

          const {
            data:
              seasonStateData,

            error:
              seasonStateError,
          } =
            await supabase
              .from(
                "traditional_season_state"
              )
              .select(
                "active_week"
              )
              .eq(
                "league_id",
                loadedLeague.id
              )
              .eq(
                "season",
                loadedLeague.season
              )
              .maybeSingle();

          if (
            seasonStateError
          ) {
            throw new Error(
              seasonStateError.message
            );
          }

          setLeague(
            loadedLeague
          );

          setSettings(
            loadedSettings
          );

          setCurrentWeek(
            Number(
              seasonStateData
                ?.active_week ??
              1
            )
          );

          setIsCommissioner(
            [
              "commissioner",
              "co_commissioner",
            ].includes(
              (
                membershipResult.data as
                  MembershipRow
              ).role
            )
          );

          const loadedActiveWeek =
            Number(
              seasonStateData
                ?.active_week ??
              1
            );

          const beforePlayoffs =
            loadedActiveWeek <
            loadedSettings
              .playoff_start_week;

          if (beforePlayoffs) {
            const {
              data:
                projectionData,
              error:
                projectionError,
            } =
              await supabase.rpc(
                "get_projected_playoff_field",
                {
                  p_league_id:
                    leagueId,
                }
              );

            if (
              projectionError
            ) {
              throw new Error(
                projectionError.message
              );
            }

            setProjectedTeams(
              (
                projectionData ??
                []
              ).map(
                (
                  row:
                    ProjectedPlayoffRow
                ): ProjectedTeam => ({
                  teamId:
                    row.team_id,

                  teamName:
                    row.team_name,

                  wins:
                    row.wins,

                  losses:
                    row.losses,

                  ties:
                    row.ties,

                  pointsFor:
                    Number(
                      row.points_for ??
                        0
                    ),

                  gamesPlayed:
                    row.games_played,

                  seed:
                    row.seed,

                  playoffProbability:
                    Number(
                      row.playoff_probability ??
                        0
                    ),

                  projectedPlayoffTeam:
                    row.projected_playoff_team,
                })
              )
            );

            setPlayoffState(
              null
            );

            setPlayoffMatchups(
              []
            );

            setChampionTeam(
              null
            );

            setFinalStandings(
              []
            );

            setSeedTieResolutions(
              []
            );

            return;
          }

          const {
            data:
              playoffData,
            error:
              playoffError,
          } =
            await supabase
              .from(
                "league_playoffs"
              )
              .select(`
                id,
                league_id,
                season,
                playoff_team_count,
                playoff_start_week,
                playoff_weeks,
                current_round,
                status,
                started_at,
                completed_at,
                champion_team_id,
                updated_at
              `)
              .eq(
                "league_id",
                leagueId
              )
              .eq(
                "season",
                loadedLeague.season
              )
              .maybeSingle();

          if (
            playoffError
          ) {
            throw new Error(
              playoffError.message
            );
          }

          const loadedPlayoff =
            playoffData
              ? playoffData as
                  LeaguePlayoffRow
              : null;

          setPlayoffState(
            loadedPlayoff
          );

          if (
            !loadedPlayoff
          ) {
            const [
              standingsResult,
              resolutionsResult,
            ] =
              await Promise.all([
                supabase.rpc(
                  "get_traditional_standings",
                  {
                    p_league_id:
                      leagueId,
                  }
                ),

                supabase
                  .from(
                    "playoff_seed_tie_resolutions"
                  )
                  .select(`
                    team_id,
                    resolved_seed,
                    reason
                  `)
                  .eq(
                    "league_id",
                    leagueId
                  )
                  .eq(
                    "season",
                    loadedLeague.season
                  ),
              ]);

            if (
              standingsResult.error
            ) {
              throw new Error(
                standingsResult.error
                  .message
              );
            }

            if (
              resolutionsResult.error
            ) {
              throw new Error(
                resolutionsResult.error
                  .message
              );
            }

            setFinalStandings(
              (
                standingsResult.data ??
                []
              ) as
                TraditionalStandingRow[]
            );

            setSeedTieResolutions(
              (
                resolutionsResult.data ??
                []
              ) as
                SeedTieResolutionRow[]
            );

            setPlayoffMatchups(
              []
            );

            setChampionTeam(
              null
            );

            return;
          }

          setFinalStandings(
            []
          );

          setSeedTieResolutions(
            []
          );

          const [
            matchupResult,
            teamsResult,
            seedResult,
          ] =
            await Promise.all([
              supabase
                .from(
                  "fantasy_matchups"
                )
                .select(`
                  id,
                  league_id,
                  season,
                  week,
                  home_team_id,
                  away_team_id,
                  home_projected_points,
                  away_projected_points,
                  home_points,
                  away_points,
                  winner_team_id,
                  is_tie,
                  matchup_type,
                  playoff_round,
                  playoff_slot,
                  home_seed,
                  away_seed,
                  status,
                  finalized_at,
                  updated_at
                `)
                .eq(
                  "league_id",
                  leagueId
                )
                .eq(
                  "season",
                  loadedLeague.season
                )
                .in(
                  "matchup_type",
                  [
                    "playoff",
                    "championship",
                    "consolation",
                  ]
                )
                .order(
                  "playoff_round",
                  {
                    ascending:
                      true,
                  }
                )
                .order(
                  "playoff_slot",
                  {
                    ascending:
                      true,
                  }
                ),

              supabase
                .from(
                  "fantasy_teams"
                )
                .select(`
                  id,
                  team_name,
                  wins,
                  losses,
                  ties
                `)
                .eq(
                  "league_id",
                  leagueId
                )
                .eq(
                  "active",
                  true
                ),

              supabase
                .from(
                  "league_playoff_seeds"
                )
                .select(`
                  team_id,
                  seed
                `)
                .eq(
                  "league_id",
                  leagueId
                )
                .eq(
                  "season",
                  loadedLeague.season
                ),
            ]);

          if (
            matchupResult.error
          ) {
            throw new Error(
              matchupResult.error
                .message
            );
          }

          if (
            teamsResult.error
          ) {
            throw new Error(
              teamsResult.error
                .message
            );
          }

          if (
            seedResult.error
          ) {
            throw new Error(
              seedResult.error
                .message
            );
          }

          const teams =
            (teamsResult.data ??
              []) as
              TeamRow[];

          const teamMap =
            new Map(
              teams.map(
                (team) => [
                  team.id,
                  team,
                ]
              )
            );

          const seedMap =
            new Map<number, number>(
              (
                seedResult.data ??
                []
              ).map(
                (
                  row:
                    PlayoffSeedRow
                ) => [
                  row.team_id,
                  row.seed,
                ]
              )
            );

          const builtMatchups =
            (
              matchupResult.data ??
              []
            ).map(
              (
                row:
                  PlayoffMatchupRow
              ):
                PlayoffMatchupView => ({
                  id:
                    row.id,

                  week:
                    row.week,

                  round:
                    Number(
                      row.playoff_round ??
                        1
                    ),

                  slot:
                    Number(
                      row.playoff_slot ??
                        1
                    ),

                  matchupType:
                    row.matchup_type as
                      | "playoff"
                      | "championship"
                      | "consolation",

                  homeTeam:
                    row.home_team_id
                      ? teamMap.get(
                          row.home_team_id
                        ) ??
                        null
                      : null,

                  awayTeam:
                    row.away_team_id
                      ? teamMap.get(
                          row.away_team_id
                        ) ??
                        null
                      : null,

                  homeSeed:
                    row.home_seed ??
                    (
                      row.home_team_id
                        ? seedMap.get(
                            row.home_team_id
                          ) ??
                          null
                        : null
                    ),

                  awaySeed:
                    row.away_seed ??
                    (
                      row.away_team_id
                        ? seedMap.get(
                            row.away_team_id
                          ) ??
                          null
                        : null
                    ),

                  homeProjectedPoints:
                    Number(
                      row.home_projected_points ??
                        0
                    ),

                  awayProjectedPoints:
                    Number(
                      row.away_projected_points ??
                        0
                    ),

                  homePoints:
                    Number(
                      row.home_points ??
                        0
                    ),

                  awayPoints:
                    Number(
                      row.away_points ??
                        0
                    ),

                  winnerTeamId:
                    row.winner_team_id,

                  isTie:
                    row.is_tie,

                  status:
                    row.status,
                })
            );

          setPlayoffMatchups(
            builtMatchups
          );

          setChampionTeam(
            loadedPlayoff
              .champion_team_id
              ? teamMap.get(
                  loadedPlayoff
                    .champion_team_id
                ) ??
                null
              : null
          );
        } catch (error) {
          setIsError(
            true
          );

          setMessage(
            error instanceof Error
              ? error.message
              : "The playoffs page could not be loaded."
          );
        } finally {
          setLoading(
            false
          );
        }
      },
      [
        leagueId,
        router,
      ]
    );

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  const beforePlayoffs =
    settings !== null &&
    playoffState === null &&
    currentWeek <
      settings.playoff_start_week;

  const projectedField =
    useMemo(
      () => {
        if (!settings) {
          return [];
        }

        const orderedTeams =
          [...projectedTeams].sort(
            (
              first,
              second
            ) => {
              const seedDifference =
                first.seed -
                second.seed;

              if (
                seedDifference !== 0
              ) {
                return seedDifference;
              }

              const probabilityDifference =
                second.playoffProbability -
                first.playoffProbability;

              if (
                probabilityDifference !== 0
              ) {
                return probabilityDifference;
              }

              return first.teamName.localeCompare(
                second.teamName
              );
            }
          );

        const explicitlyProjected =
          orderedTeams.filter(
            (team) =>
              team.projectedPlayoffTeam
          );

        const source =
          explicitlyProjected.length >=
          settings.playoff_team_count
            ? explicitlyProjected
            : orderedTeams;

        return source
          .slice(
            0,
            settings.playoff_team_count
          )
          .map(
            (team, index) => ({
              ...team,
              seed: index + 1,
            })
          );
      },
      [
        projectedTeams,
        settings,
      ]
    );

  const projectedBracket =
    useMemo(
      () =>
        settings
          ? buildProjectedBracket(
              projectedField,
              settings.playoff_team_count
            )
          : [],
      [
        projectedField,
        settings,
      ]
    );

  const playoffSeedTieGroups =
    useMemo<
      PlayoffSeedTieGroup[]
    >(
      () => {
        if (!settings) {
          return [];
        }

        const grouped =
          new Map<
            number,
            TraditionalStandingRow[]
          >();

        for (
          const standing
          of finalStandings
        ) {
          const current =
            grouped.get(
              standing.seed
            ) ??
            [];

          current.push(
            standing
          );

          grouped.set(
            standing.seed,
            current
          );
        }

        return Array.from(
          grouped.entries()
        )
          .filter(
            ([
              originalSeed,
              teams,
            ]) =>
              teams.length > 1 &&
              originalSeed <=
                settings.playoff_team_count
          )
          .map(
            ([
              originalSeed,
              teams,
            ]) => {
              const firstAllowedSeed =
                originalSeed;

              const lastAllowedSeed =
                originalSeed +
                teams.length -
                1;

              const resolutions =
                teams
                  .map(
                    (team) =>
                      seedTieResolutions.find(
                        (resolution) =>
                          resolution.team_id ===
                          team.team_id
                      )
                  )
                  .filter(
                    (resolution):
                      resolution is
                        SeedTieResolutionRow =>
                      resolution !==
                      undefined
                  );

              const assignedSeeds =
                resolutions.map(
                  (resolution) =>
                    resolution.resolved_seed
                );

              const everyTeamResolved =
                resolutions.length ===
                teams.length;

              const seedsUnique =
                new Set(
                  assignedSeeds
                ).size ===
                assignedSeeds.length;

              const seedsInRange =
                assignedSeeds.every(
                  (seed) =>
                    seed >=
                      firstAllowedSeed &&
                    seed <=
                      lastAllowedSeed
                );

              return {
                originalSeed,

                teams:
                  [...teams].sort(
                    (
                      first,
                      second
                    ) =>
                      first.team_name.localeCompare(
                        second.team_name
                      )
                  ),

                firstAllowedSeed,
                lastAllowedSeed,

                isResolved:
                  everyTeamResolved &&
                  seedsUnique &&
                  seedsInRange,
              };
            }
          )
          .sort(
            (
              first,
              second
            ) =>
              first.originalSeed -
              second.originalSeed
          );
      },
      [
        finalStandings,
        seedTieResolutions,
        settings,
      ]
    );

  const hasUnresolvedSeedTies =
    useMemo(
      () =>
        playoffSeedTieGroups.some(
          (group) =>
            !group.isResolved
        ),
      [
        playoffSeedTieGroups,
      ]
    );

  const rounds =
    useMemo(
      () => {
        const grouped =
          new Map<
            number,
            PlayoffMatchupView[]
          >();

        for (
          const matchup
          of playoffMatchups
        ) {
          const existing =
            grouped.get(
              matchup.round
            ) ??
            [];

          existing.push(
            matchup
          );

          grouped.set(
            matchup.round,
            existing
          );
        }

        return Array.from(
          grouped.entries()
        )
          .sort(
            (
              first,
              second
            ) =>
              first[0] -
              second[0]
          )
          .map(
            ([
              round,
              matchups,
            ]) => ({
              round,
              matchups:
                [...matchups].sort(
                  (
                    first,
                    second
                  ) =>
                    first.slot -
                    second.slot
                ),
            })
          );
      },
      [
        playoffMatchups,
      ]
    );

  const hasActivePlayoffMatchups =
    useMemo(
      () =>
        playoffMatchups.some(
          (matchup) =>
            matchup.status ===
              "scheduled" ||
            matchup.status ===
              "live"
        ),
      [
        playoffMatchups,
      ]
    );

  const currentPlayoffWeek =
    useMemo(
      () => {
        const active =
          playoffMatchups.find(
            (matchup) =>
              matchup.status ===
                "live" ||
              matchup.status ===
                "scheduled"
          );

        return active
          ?.week ??
          currentWeek;
      },
      [
        playoffMatchups,
        currentWeek,
      ]
    );

  async function resolveSeedTie(
    teamId: number,
    resolvedSeed: number
  ) {
    if (
      !league ||
      !isCommissioner ||
      resolvingSeedTeamId !==
        null
    ) {
      return;
    }

    setResolvingSeedTeamId(
      teamId
    );

    setMessage(
      ""
    );

    setIsError(
      false
    );

    try {
      const {
        error,
      } =
        await supabase.rpc(
          "resolve_playoff_seed_tie",
          {
            p_league_id:
              league.id,

            p_team_id:
              teamId,

            p_resolved_seed:
              resolvedSeed,

            p_reason:
              "Commissioner playoff seeding tiebreak",
          }
        );

      if (error) {
        throw new Error(
          error.message
        );
      }

      setMessage(
        `Playoff seed ${resolvedSeed} was assigned successfully.`
      );

      await loadPage();
    } catch (error) {
      setIsError(
        true
      );

      setMessage(
        error instanceof Error
          ? error.message
          : "The playoff seed tie could not be resolved."
      );
    } finally {
      setResolvingSeedTeamId(
        null
      );
    }
  }

  async function startPlayoffs() {
    if (
      !league ||
      !isCommissioner
    ) {
      return;
    }

    setWorking(
      true
    );

    setMessage("");
    setIsError(false);

    try {
      const {
        data,
        error,
      } =
        await supabase.rpc(
          "start_traditional_playoffs",
          {
            p_league_id:
              league.id,
          }
        );

      if (error) {
        throw new Error(
          error.message
        );
      }

      const {
        error:
          phaseError,
      } =
        await supabase.rpc(
          "mark_traditional_playoffs_active",
          {
            p_league_id:
              league.id,
          }
        );

      if (phaseError) {
        throw new Error(
          phaseError.message
        );
      }

      setMessage(
        data
          ? "The playoff bracket was created."
          : "The playoff bracket was created."
      );

      await loadPage();
    } catch (error) {
      setIsError(true);

      setMessage(
        error instanceof Error
          ? error.message
          : "The playoff bracket could not be created."
      );
    } finally {
      setWorking(false);
    }
  }

  async function advanceBracket(
    quiet = false
  ) {
    if (!league) {
      return;
    }

    if (!quiet) {
      setWorking(
        true
      );

      setMessage("");
      setIsError(false);
    }

    try {
      const {
        error,
      } =
        await supabase.rpc(
          "advance_traditional_playoffs",
          {
            p_league_id:
              league.id,
          }
        );

      if (error) {
        throw new Error(
          error.message
        );
      }

      if (!quiet) {
        setMessage(
          "The playoff bracket was checked and advanced where possible."
        );
      }

      await loadPage();
    } catch (error) {
      if (!quiet) {
        setIsError(true);

        setMessage(
          error instanceof Error
            ? error.message
            : "The playoff bracket could not be advanced."
        );
      }
    } finally {
      if (!quiet) {
        setWorking(false);
      }
    }
  }

  async function resolvePlayoffTiebreak(
    matchupId: number,
    winnerTeamId: number
  ) {
    if (
      !league ||
      !isCommissioner ||
      resolvingTiebreakMatchupId !== null
    ) {
      return;
    }

    setResolvingTiebreakMatchupId(matchupId);
    setMessage("");
    setIsError(false);

    try {
      const { error } = await supabase.rpc(
        "resolve_playoff_tiebreak",
        {
          p_league_id: league.id,
          p_matchup_id: matchupId,
          p_winner_team_id: winnerTeamId,
        }
      );

      if (error) {
        throw new Error(error.message);
      }

      await syncCurrentPlayoffWeek(true);
      setMessage("Playoff tiebreak resolved and bracket updated.");
      await loadPage();
    } catch (error) {
      setIsError(true);
      setMessage(
        error instanceof Error
          ? error.message
          : "The playoff tiebreak could not be resolved."
      );
    } finally {
      setResolvingTiebreakMatchupId(null);
    }
  }

  async function syncCurrentPlayoffWeek(
    quiet = false
  ) {
    if (
      !league ||
      !playoffState
    ) {
      return;
    }

    if (quiet) {
      setAutoRefreshing(
        true
      );
    } else {
      setWorking(
        true
      );

      setMessage("");
      setIsError(false);
    }

    try {
      const {
        data:
          sessionData,
        error:
          sessionError,
      } =
        await supabase.auth
          .getSession();

      if (
        sessionError
      ) {
        throw new Error(
          sessionError.message
        );
      }

      const token =
        sessionData.session
          ?.access_token;

      if (!token) {
        throw new Error(
          "Your login session has expired."
        );
      }

      const response =
        await fetch(
          `/api/leagues/${league.id}/playoffs/sync-week`,
          {
            method:
              "POST",

            headers: {
              Authorization:
                `Bearer ${token}`,

              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                season:
                  league.season,

                week:
                  currentPlayoffWeek,
              }),
          }
        );

      let result:
        Record<
          string,
          unknown
        > = {};

      try {
        result =
          await response.json();
      } catch {
        result = {};
      }

      if (
        !response.ok
      ) {
        throw new Error(
          typeof result.error ===
            "string"
            ? result.error
            : "Playoff scoring could not be refreshed."
        );
      }

      if (!quiet) {
        setMessage(
          "Playoff scores and bracket refreshed."
        );
      }

      await loadPage();
    } catch (error) {
      if (!quiet) {
        setIsError(true);

        setMessage(
          error instanceof Error
            ? error.message
            : "Playoff scoring could not be refreshed."
        );
      }
    } finally {
      if (quiet) {
        setAutoRefreshing(
          false
        );
      } else {
        setWorking(
          false
        );
      }
    }
  }

  useEffect(() => {
    if (
      beforePlayoffs ||
      !league ||
      !playoffState ||
      playoffState.status ===
        "completed" ||
      !hasActivePlayoffMatchups
    ) {
      return;
    }

    const intervalId =
      window.setInterval(
        () => {
          if (
            working ||
            autoRefreshing
          ) {
            return;
          }

          void syncCurrentPlayoffWeek(
            true
          );
        },
        30000
      );

    return () => {
      window.clearInterval(
        intervalId
      );
    };
  }, [
    beforePlayoffs,
    league,
    playoffState,
    hasActivePlayoffMatchups,
    currentPlayoffWeek,
    working,
    autoRefreshing,
  ]);

  if (loading) {
    return (
      <main
        style={
          styles.page
        }
      >

      <style>{`
        @media (max-width: 760px) {
          .g365-playoffs-container {
            width: 100% !important;
            max-width: 100% !important;
            min-width: 0 !important;
          }

          .g365-playoffs-header {
            align-items: flex-start !important;
            flex-direction: column !important;
            gap: 14px !important;
          }

          .g365-playoffs-header-right {
            width: 100% !important;
            min-width: 0 !important;
            align-items: stretch !important;
          }

          .g365-playoffs-header-stats {
            width: 100% !important;
            display: grid !important;
            grid-template-columns: repeat(3,minmax(0,1fr)) !important;
            gap: 7px !important;
          }

          .g365-playoffs-actions {
            width: 100% !important;
            display: grid !important;
            grid-template-columns: repeat(2,minmax(0,1fr)) !important;
            gap: 8px !important;
          }

          .g365-playoffs-actions > button {
            width: 100% !important;
            min-width: 0 !important;
            min-height: 42px !important;
          }

          .g365-playoffs-bracket-intro {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 12px !important;
          }

          .g365-playoffs-countdown {
            width: 100% !important;
            min-width: 0 !important;
          }

          .g365-playoffs-bracket-scroller {
            width: 100% !important;
            max-width: 100% !important;
            overflow-x: auto !important;
            overflow-y: visible !important;
            -webkit-overflow-scrolling: touch;
            overscroll-behavior-x: contain;
            scrollbar-width: thin;
          }

          .g365-playoffs-seed-header,
          .g365-playoffs-seed-team {
            align-items: flex-start !important;
            flex-direction: column !important;
            gap: 10px !important;
          }

          .g365-playoffs-seed-actions {
            width: 100% !important;
            display: grid !important;
            grid-template-columns: repeat(2,minmax(0,1fr)) !important;
          }

          .g365-playoffs-seed-actions > button {
            width: 100% !important;
            min-height: 40px !important;
          }
        }

        @media (max-width: 430px) {
          .g365-playoffs-header-stats {
            grid-template-columns: minmax(0,1fr) !important;
          }

          .g365-playoffs-actions,
          .g365-playoffs-seed-actions {
            grid-template-columns: minmax(0,1fr) !important;
          }
        }
      `}</style>
        Loading playoffs...
      </main>
    );
  }

  if (
    !league ||
    !settings
  ) {
    return (
      <main
        style={
          styles.page
        }
      >
        <section
          style={
            styles.errorCard
          }
        >
          {message ||
            "Playoffs are unavailable."}
        </section>
      </main>
    );
  }

  return (
    <main
      style={
        styles.page
      }
    >
      <section
        className="g365-playoffs-container"
        style={
          styles.container
        }
      >

        <header
          className="g365-playoffs-header"
          style={
            styles.header
          }
        >
          <div>
            <span
              style={
                styles.eyebrow
              }
            >
              TRADITIONAL PLAYOFFS
            </span>

            <h1
              style={
                styles.title
              }
            >
              Playoffs
            </h1>

            <p
              style={
                styles.subtitle
              }
            >
              {league.name}
              {" · "}
              {beforePlayoffs
                ? "Projected playoff field"
                : playoffState
                  ? formatPlayoffStatus(
                      playoffState.status
                    )
                  : "Ready to create bracket"}
            </p>
          </div>

          <div
            className="g365-playoffs-header-right"
            style={
              styles.headerRight
            }
          >
            <div
              className="g365-playoffs-header-stats"
              style={
                styles.headerStats
              }
            >
              <Stat
                label="PLAYOFF TEAMS"
                value={String(
                  settings.playoff_team_count
                )}
              />

              <Stat
                label="PLAYOFF START"
                value={`Week ${settings.playoff_start_week}`}
              />

              <Stat
                label="PLAYOFF WEEKS"
                value={String(
                  settings.playoff_weeks
                )}
              />
            </div>

            {!beforePlayoffs ? (
              <div
                className="g365-playoffs-actions"
                style={
                  styles.actionRow
                }
              >
                {!playoffState &&
                isCommissioner ? (
                  <button
                    type="button"
                    style={
                      styles.primaryButton
                    }
                    disabled={
                      working ||
                      hasUnresolvedSeedTies
                    }
                    onClick={() =>
                      void startPlayoffs()
                    }
                  >
                    {working
                      ? "Creating..."
                      : "Start Playoffs"}
                  </button>
                ) : null}

                {playoffState &&
                playoffState.status !==
                  "completed" ? (
                  <>
                    <button
                      type="button"
                      style={
                        styles.primaryButton
                      }
                      disabled={
                        working ||
                        autoRefreshing
                      }
                      onClick={() =>
                        void syncCurrentPlayoffWeek()
                      }
                    >
                      {working
                        ? "Refreshing..."
                        : "Refresh Playoffs"}
                    </button>
                  </>
                ) : null}
              </div>
            ) : null}

            {!beforePlayoffs &&
            playoffState &&
            playoffState.status !==
              "completed" ? (
              <span
                style={
                  styles.autoRefreshText
                }
              >
                {autoRefreshing
                  ? "Updating automatically..."
                  : "Auto-update every 30 sec"}
              </span>
            ) : null}
          </div>
        </header>

        {message ? (
          <div
            style={
              isError
                ? styles.error
                : styles.success
            }
          >
            {message}
          </div>
        ) : null}

        {beforePlayoffs ? (
          <G365MarchMadnessBracket
            leagueName={
              league.name
            }
            season={
              league.season
            }
            playoffTeamCount={
              settings.playoff_team_count
            }
            playoffStartWeek={
              settings.playoff_start_week
            }
            seededTeams={
              projectedField.map(
                (
                  team
                ) => ({
                  id:
                    team.teamId,
                  seed:
                    team.seed,
                  name:
                    team.teamName,
                  record:
                    `${team.wins}-${team.losses}-${team.ties}`,
                  statusText:
                    `${team.playoffProbability.toFixed(0)}% playoff chance`,
                })
              )
            }
            matchups={[]}
            championName={
              null
            }
            statusLabel="PROJECTED BRACKET"
          />
        ) : !playoffState ? (
          <>
            {playoffSeedTieGroups
              .length > 0 ? (
              <section
                style={
                  styles.section
                }
              >
                <div
                  style={
                    styles.sectionHeader
                  }
                >
                  <div>
                    <span
                      style={
                        styles.eyebrow
                      }
                    >
                      PLAYOFF SEEDING
                    </span>

                    <h2
                      style={
                        styles.sectionTitle
                      }
                    >
                      Resolve Final Seed Ties
                    </h2>
                  </div>
                </div>

                <p
                  style={
                    styles.bracketHelp
                  }
                >
                  The regular-season tiebreakers could not
                  separate these teams. Assign each team a
                  unique final seed before creating the playoff
                  bracket.
                </p>

                {playoffSeedTieGroups.map(
                  (group) => (
                    <div
                      key={
                        group.originalSeed
                      }
                      className="g365-playoffs-seed-group"
                      style={
                        styles.seedTieGroup
                      }
                    >
                      <div
                        className="g365-playoffs-seed-header"
                        style={
                          styles.seedTieHeader
                        }
                      >
                        <strong>
                          Tie beginning at Seed #{group.originalSeed}
                        </strong>

                        <span>
                          Seeds {group.firstAllowedSeed}
                          {"–"}
                          {group.lastAllowedSeed}
                          {group.isResolved
                            ? " · RESOLVED"
                            : " · ACTION REQUIRED"}
                        </span>
                      </div>

                      {group.teams.map(
                        (team) => {
                          const saved =
                            seedTieResolutions.find(
                              (resolution) =>
                                resolution.team_id ===
                                team.team_id
                            );

                          const allowedSeeds =
                            Array.from(
                              {
                                length:
                                  group.lastAllowedSeed -
                                  group.firstAllowedSeed +
                                  1,
                              },
                              (
                                _,
                                index
                              ) =>
                                group.firstAllowedSeed +
                                index
                            );

                          return (
                            <div
                              key={
                                team.team_id
                              }
                              className="g365-playoffs-seed-team"
                              style={
                                styles.seedTieTeam
                              }
                            >
                              <div>
                                <strong>
                                  {team.team_name}
                                </strong>

                                <div
                                  style={
                                    styles.teamRecord
                                  }
                                >
                                  {team.wins}-
                                  {team.losses}
                                  {team.ties > 0
                                    ? `-${team.ties}`
                                    : ""}
                                  {" · "}
                                  {Number(
                                    team.points_for ??
                                      0
                                  ).toFixed(
                                    2
                                  )}{" "}
                                  PF
                                </div>
                              </div>

                              <div
                                className="g365-playoffs-seed-actions"
                                style={
                                  styles.seedTieActions
                                }
                              >
                                {allowedSeeds.map(
                                  (seed) => {
                                    const usedByAnotherTeam =
                                      seedTieResolutions.some(
                                        (resolution) =>
                                          resolution.resolved_seed ===
                                            seed &&
                                          resolution.team_id !==
                                            team.team_id
                                      );

                                    const selected =
                                      saved
                                        ?.resolved_seed ===
                                      seed;

                                    return (
                                      <button
                                        key={
                                          seed
                                        }
                                        type="button"
                                        disabled={
                                          !isCommissioner ||
                                          resolvingSeedTeamId !==
                                            null ||
                                          usedByAnotherTeam
                                        }
                                        style={{
                                          ...styles.seedButton,

                                          ...(selected
                                            ? styles.seedButtonSelected
                                            : {}),
                                        }}
                                        onClick={() =>
                                          void resolveSeedTie(
                                            team.team_id,
                                            seed
                                          )
                                        }
                                      >
                                        {selected
                                          ? `Seed ${seed} ✓`
                                          : usedByAnotherTeam
                                            ? `Seed ${seed} Taken`
                                            : `Seed ${seed}`}
                                      </button>
                                    );
                                  }
                                )}
                              </div>
                            </div>
                          );
                        }
                      )}
                    </div>
                  )
                )}
              </section>
            ) : null}

            <section
              style={
                styles.section
              }
            >
              <div
                style={
                  styles.empty
                }
              >
                {isCommissioner
                  ? hasUnresolvedSeedTies
                    ? "Resolve every playoff-impacting seed tie above. Start Playoffs will unlock when the final seed assignments are complete."
                    : "The playoff period has begun. Click Start Playoffs to lock the final seeds and create the real bracket."
                  : hasUnresolvedSeedTies
                    ? "The final playoff seeds contain an unresolved tie. The commissioner must resolve it before the bracket can be created."
                    : "The playoff period has begun. The commissioner has not created the real playoff bracket yet."}
              </div>
            </section>
          </>
        ) : (
          <>
            {championTeam ? (
              <section
                style={
                  styles.championCard
                }
              >
                <span
                  style={
                    styles.eyebrow
                  }
                >
                  GRIDIRON365 CHAMPION
                </span>

                <h2
                  style={
                    styles.championTitle
                  }
                >
                  🏆{" "}
                  {championTeam
                    .team_name ??
                    `Team ${championTeam.id}`}
                </h2>
              </section>
            ) : null}

            <section
              style={
                styles.section
              }
            >
              <div
                style={
                  styles.sectionHeader
                }
              >
                <div>
                  <span
                    style={
                      styles.eyebrow
                    }
                  >
                    LIVE BRACKET
                  </span>

                  <h2
                    style={
                      styles.sectionTitle
                    }
                  >
                    Playoff Bracket
                  </h2>
                </div>

                <span
                  style={
                    styles.weekBadge
                  }
                >
                  {playoffState.status ===
                  "completed"
                    ? "Completed"
                    : `Round ${
                        playoffState.current_round ??
                        1
                      }`}
                </span>
              </div>

              {rounds.length ===
              0 ? (
                <div
                  style={
                    styles.empty
                  }
                >
                  No playoff matchup rows exist yet.
                </div>
              ) : (
                <G365MarchMadnessBracket
                  leagueName={
                    league.name
                  }
                  season={
                    league.season
                  }
                  playoffTeamCount={
                    settings.playoff_team_count
                  }
                  playoffStartWeek={
                    settings.playoff_start_week
                  }
                  seededTeams={[]}
                  matchups={
                    playoffMatchups.map(
                      (
                        matchup
                      ) => ({
                        id:
                          matchup.id,
                        round:
                          matchup.round,
                        slot:
                          matchup.slot,
                        week:
                          matchup.week,
                        home:
                          matchup.homeTeam
                            ? {
                                id:
                                  matchup.homeTeam.id,
                                seed:
                                  matchup.homeSeed,
                                name:
                                  matchup.homeTeam.team_name ??
                                  `Team ${matchup.homeTeam.id}`,
                                record:
                                  `${matchup.homeTeam.wins}-${matchup.homeTeam.losses}-${matchup.homeTeam.ties}`,
                                score:
                                  matchup.homePoints,
                                projectedScore:
                                  matchup.homeProjectedPoints,
                                isWinner:
                                  matchup.winnerTeamId ===
                                  matchup.homeTeam.id,
                              }
                            : null,
                        away:
                          matchup.awayTeam
                            ? {
                                id:
                                  matchup.awayTeam.id,
                                seed:
                                  matchup.awaySeed,
                                name:
                                  matchup.awayTeam.team_name ??
                                  `Team ${matchup.awayTeam.id}`,
                                record:
                                  `${matchup.awayTeam.wins}-${matchup.awayTeam.losses}-${matchup.awayTeam.ties}`,
                                score:
                                  matchup.awayPoints,
                                projectedScore:
                                  matchup.awayProjectedPoints,
                                isWinner:
                                  matchup.winnerTeamId ===
                                  matchup.awayTeam.id,
                              }
                            : null,
                        status:
                          matchup.status,
                        isFinal:
                          matchup.status ===
                            "final" ||
                          matchup.status ===
                            "completed",
                        isTie:
                          matchup.isTie,
                        href:
                          matchup.awayTeam
                            ? `/league/${league.id}/matchups/${matchup.id}`
                            : null,
                      })
                    )
                  }
                  championName={
                    championTeam
                      ?.team_name ??
                    null
                  }
                  statusLabel={
                    playoffState.status ===
                    "completed"
                      ? "COMPLETE"
                      : `ROUND ${playoffState.current_round ?? 1}`
                  }
                />
              )}
            </section>
          </>
        )}
      </section>
    </main>
  );
}


const BRACKET_CARD_HEIGHT = 150;
const BRACKET_FIRST_GAP = 28;
const BRACKET_COLUMN_WIDTH = 310;
const BRACKET_COLUMN_GAP = 78;

type RealRoundGroup = {
  round: number;
  matchups: PlayoffMatchupView[];
};

function ProjectedPlayoffView({
  teams,
  projectedBracket,
  playoffTeamCount,
  currentWeek,
  playoffStartWeek,
  consolationEnabled,
}: {
  teams: ProjectedTeam[];
  projectedBracket:
    ProjectedMatchup[];
  playoffTeamCount: number;
  currentWeek: number;
  playoffStartWeek: number;
  consolationEnabled: boolean;
}) {
  const bracketSize =
    nextPowerOfTwo(
      Math.max(
        playoffTeamCount,
        2
      )
    );

  const firstRoundCount =
    Math.max(
      bracketSize / 2,
      1
    );

  const roundCount =
    Math.max(
      Math.log2(
        bracketSize
      ),
      1
    );

  const boardHeight =
    firstRoundCount *
      BRACKET_CARD_HEIGHT +
    Math.max(
      firstRoundCount - 1,
      0
    ) *
      BRACKET_FIRST_GAP;

  const centers =
    buildBracketCenters(
      firstRoundCount
    );

  return (
    <section
      style={
        styles.section
      }
    >
      <div
        className="g365-playoffs-bracket-intro"
        style={
          styles.bracketIntro
        }
      >
        <div>
          <span
            style={
              styles.eyebrow
            }
          >
            IF THE SEASON ENDED TODAY
          </span>

          <h2
            style={
              styles.sectionTitle
            }
          >
            Projected Playoff Bracket
          </h2>

          <p
            style={
              styles.bracketHelp
            }
          >
            Round 1 shows the current projected playoff teams and each team&apos;s chance of making the playoffs.
            Later rounds stay open until the real postseason begins, when percentages disappear and the live bracket takes over.
          </p>
        </div>

        <div
          className="g365-playoffs-countdown"
          style={
            styles.playoffCountdown
          }
        >
          <strong>
            Playoffs Start: Week{" "}
            {playoffStartWeek}
          </strong>

          <span>
            {Math.max(
              playoffStartWeek -
                currentWeek,
              0
            )}{" "}
            week
            {Math.max(
              playoffStartWeek -
                currentWeek,
              0
            ) === 1
              ? ""
              : "s"}{" "}
            away
          </span>
        </div>
      </div>

      <div
        className="g365-playoffs-bracket-scroller"
        style={
          styles.bracketScroller
        }
      >
        <div
          style={{
            ...styles.bracketCanvas,
            width:
              roundCount *
                BRACKET_COLUMN_WIDTH +
              Math.max(
                roundCount - 1,
                0
              ) *
                BRACKET_COLUMN_GAP,
            height:
              boardHeight +
              (consolationEnabled
                ? 190
                : 0),
          }}
        >
          {Array.from(
            {
              length:
                roundCount,
            },
            (
              _,
              roundIndex
            ) => {
              const round =
                roundIndex + 1;

              const matchCount =
                Math.max(
                  firstRoundCount /
                    Math.pow(
                      2,
                      roundIndex
                    ),
                  1
                );

              const roundCenters =
                centers[
                  roundIndex
                ] ??
                [];

              const isFinalRound =
                round ===
                roundCount;

              return (
                <div
                  key={
                    round
                  }
                  style={{
                    ...styles.bracketColumn,
                    left:
                      roundIndex *
                      (
                        BRACKET_COLUMN_WIDTH +
                        BRACKET_COLUMN_GAP
                      ),
                    width:
                      BRACKET_COLUMN_WIDTH,
                    height:
                      boardHeight,
                  }}
                >
                  <BracketColumnHeading
                    title={
                      projectedRoundTitle(
                        round,
                        roundCount,
                        matchCount
                      )
                    }
                    week={
                      playoffStartWeek +
                      round -
                      1
                    }
                  />

                  {Array.from(
                    {
                      length:
                        matchCount,
                    },
                    (
                      __,
                      slotIndex
                    ) => {
                      const center =
                        roundCenters[
                          slotIndex
                        ] ??
                        BRACKET_CARD_HEIGHT /
                          2;

                      const top =
                        center -
                        BRACKET_CARD_HEIGHT /
                          2 +
                        54;

                      if (
                        round === 1
                      ) {
                        const matchup =
                          projectedBracket[
                            slotIndex
                          ];

                        return (
                          <div
                            key={
                              `projected-${round}-${slotIndex}`
                            }
                            style={{
                              ...styles.bracketPositionedCard,
                              top,
                            }}
                          >
                            <ProjectedMatchupCard
                              matchup={
                                matchup ??
                                null
                              }
                            />

                            {!isFinalRound ? (
                              <BracketConnector
                                fromCenter={
                                  center
                                }
                                toCenter={
                                  centers[
                                    roundIndex +
                                      1
                                  ]?.[
                                    Math.floor(
                                      slotIndex /
                                        2
                                    )
                                  ] ??
                                  center
                                }
                              />
                            ) : null}
                          </div>
                        );
                      }

                      return (
                        <div
                          key={
                            `projected-${round}-${slotIndex}`
                          }
                          style={{
                            ...styles.bracketPositionedCard,
                            top,
                          }}
                        >
                          <FutureProjectedCard
                            final={
                              isFinalRound
                            }
                          />

                          {!isFinalRound ? (
                            <BracketConnector
                              fromCenter={
                                center
                              }
                              toCenter={
                                centers[
                                  roundIndex +
                                    1
                                ]?.[
                                  Math.floor(
                                    slotIndex /
                                      2
                                  )
                                ] ??
                                center
                              }
                            />
                          ) : null}
                        </div>
                      );
                    }
                  )}

                  {isFinalRound &&
                  consolationEnabled ? (
                    <div
                      style={{
                        ...styles.bracketPositionedCard,
                        top:
                          boardHeight +
                          90,
                      }}
                    >
                      <article
                        style={
                          styles.futureBracketCard
                        }
                      >
                        <span
                          style={
                            styles.futureCardLabel
                          }
                        >
                          Consolation Game
                        </span>

                        <div
                          style={
                            styles.futureTeamSlot
                          }
                        >
                          Loser from semifinal
                        </div>

                        <div
                          style={
                            styles.vs
                          }
                        >
                          VS
                        </div>

                        <div
                          style={
                            styles.futureTeamSlot
                          }
                        >
                          Loser from semifinal
                        </div>
                      </article>
                    </div>
                  ) : null}
                </div>
              );
            }
          )}
        </div>
      </div>
    </section>
  );
}

function MarchMadnessRealBracket({
  rounds,
  playoffTeamCount,
  playoffStartWeek,
  consolationEnabled,
  isCommissioner,
  resolvingTiebreakMatchupId,
  onResolveTiebreak,
  onOpenMatchup,
}: {
  rounds: RealRoundGroup[];
  playoffTeamCount: number;
  playoffStartWeek: number;
  consolationEnabled: boolean;
  isCommissioner: boolean;
  resolvingTiebreakMatchupId:
    number | null;
  onResolveTiebreak: (
    matchupId: number,
    winnerTeamId: number
  ) => Promise<void>;
  onOpenMatchup: (
    matchupId: number
  ) => void;
}) {
  const bracketSize =
    nextPowerOfTwo(
      Math.max(
        playoffTeamCount,
        2
      )
    );

  const firstRoundCount =
    Math.max(
      bracketSize / 2,
      1
    );

  const roundCount =
    Math.max(
      Math.log2(
        bracketSize
      ),
      1
    );

  const boardHeight =
    firstRoundCount *
      BRACKET_CARD_HEIGHT +
    Math.max(
      firstRoundCount - 1,
      0
    ) *
      BRACKET_FIRST_GAP;

  const centers =
    buildBracketCenters(
      firstRoundCount
    );

  const finalRoundGroup =
    rounds.find(
      (item) =>
        item.round ===
        roundCount
    );

  const championshipMatchup =
    finalRoundGroup?.matchups.find(
      (matchup) =>
        matchup.matchupType ===
        "championship"
    ) ??
    finalRoundGroup?.matchups.find(
      (matchup) =>
        matchup.matchupType ===
          "playoff" &&
        matchup.slot === 1
    ) ??
    null;

  const consolationMatchup =
    finalRoundGroup?.matchups.find(
      (matchup) =>
        matchup.matchupType ===
        "consolation"
    ) ??
    null;

  return (
    <div
      className="g365-playoffs-bracket-scroller"
      style={
        styles.bracketScroller
      }
    >
      <div
        style={{
          ...styles.bracketCanvas,
          width:
            roundCount *
              BRACKET_COLUMN_WIDTH +
            Math.max(
              roundCount - 1,
              0
            ) *
              BRACKET_COLUMN_GAP,
          height:
            boardHeight +
            (consolationEnabled
              ? 190
              : 0),
        }}
      >
        {Array.from(
          {
            length:
              roundCount,
          },
          (
            _,
            roundIndex
          ) => {
            const round =
              roundIndex + 1;

            const matchCount =
              Math.max(
                firstRoundCount /
                  Math.pow(
                    2,
                    roundIndex
                  ),
                1
              );

            const group =
              rounds.find(
                (item) =>
                  item.round ===
                  round
              );

            const matchups =
              (
                group?.matchups ??
                []
              ).filter(
                (matchup) =>
                  matchup.matchupType ===
                  "playoff"
              );

            const roundCenters =
              centers[
                roundIndex
              ] ??
              [];

            const isFinalRound =
              round ===
              roundCount;

            return (
              <div
                key={
                  round
                }
                style={{
                  ...styles.bracketColumn,
                  left:
                    roundIndex *
                    (
                      BRACKET_COLUMN_WIDTH +
                      BRACKET_COLUMN_GAP
                    ),
                  width:
                    BRACKET_COLUMN_WIDTH,
                  height:
                    boardHeight,
                }}
              >
                <BracketColumnHeading
                  title={
                    liveRoundTitle(
                      round,
                      roundCount,
                      matchCount
                    )
                  }
                  week={
                    playoffStartWeek +
                    round -
                    1
                  }
                />

                {Array.from(
                  {
                    length:
                      matchCount,
                  },
                  (
                    __,
                    slotIndex
                  ) => {
                    const center =
                      roundCenters[
                        slotIndex
                      ] ??
                      BRACKET_CARD_HEIGHT /
                        2;

                    const top =
                      center -
                      BRACKET_CARD_HEIGHT /
                        2 +
                      54;

                    const matchup =
                      isFinalRound
                        ? championshipMatchup
                        : matchups[
                            slotIndex
                          ] ??
                          null;

                    return (
                      <div
                        key={
                          `real-${round}-${slotIndex}`
                        }
                        style={{
                          ...styles.bracketPositionedCard,
                          top,
                        }}
                      >
                        {matchup ? (
                          <RealMatchupCard
                            matchup={
                              matchup
                            }
                            isCommissioner={
                              isCommissioner
                            }
                            resolving={
                              resolvingTiebreakMatchupId ===
                              matchup.id
                            }
                            onResolveTiebreak={(
                              winnerTeamId
                            ) =>
                              onResolveTiebreak(
                                matchup.id,
                                winnerTeamId
                              )
                            }
                            onOpen={() =>
                              onOpenMatchup(
                                matchup.id
                              )
                            }
                          />
                        ) : (
                          <FutureRealMatchupCard
                            final={
                              isFinalRound
                            }
                          />
                        )}

                        {!isFinalRound ? (
                          <BracketConnector
                            fromCenter={
                              center
                            }
                            toCenter={
                              centers[
                                roundIndex +
                                  1
                              ]?.[
                                Math.floor(
                                  slotIndex /
                                    2
                                )
                              ] ??
                              center
                            }
                          />
                        ) : null}
                      </div>
                    );
                  }
                )}

                {isFinalRound &&
                consolationEnabled ? (
                  <div
                    style={{
                      ...styles.bracketPositionedCard,
                      top:
                        boardHeight +
                        90,
                    }}
                  >
                    {consolationMatchup ? (
                      <RealMatchupCard
                        matchup={
                          consolationMatchup
                        }
                        isCommissioner={
                          isCommissioner
                        }
                        resolving={
                          resolvingTiebreakMatchupId ===
                          consolationMatchup.id
                        }
                        onResolveTiebreak={(
                          winnerTeamId
                        ) =>
                          onResolveTiebreak(
                            consolationMatchup.id,
                            winnerTeamId
                          )
                        }
                        onOpen={() =>
                          onOpenMatchup(
                            consolationMatchup.id
                          )
                        }
                      />
                    ) : (
                      <FutureRealMatchupCard
                        consolation
                      />
                    )}
                  </div>
                ) : null}
              </div>
            );
          }
        )}
      </div>
    </div>
  );
}

function BracketColumnHeading({
  title,
  week,
}: {
  title: string;
  week: number;
}) {
  return (
    <div
      style={
        styles.bracketColumnHeading
      }
    >
      <strong>
        {title}
      </strong>

      <span>
        Week {week}
      </span>
    </div>
  );
}

function BracketConnector({
  fromCenter,
  toCenter,
}: {
  fromCenter: number;
  toCenter: number;
}) {
  const delta =
    toCenter -
    fromCenter;

  return (
    <>
      <span
        style={{
          ...styles.connectorHorizontalFirst,
          top:
            BRACKET_CARD_HEIGHT /
            2,
        }}
      />

      <span
        style={{
          ...styles.connectorVertical,
          top:
            delta >= 0
              ? BRACKET_CARD_HEIGHT /
                2
              : BRACKET_CARD_HEIGHT /
                  2 +
                delta,
          height:
            Math.max(
              Math.abs(
                delta
              ),
              2
            ),
        }}
      />

      <span
        style={{
          ...styles.connectorHorizontalSecond,
          top:
            BRACKET_CARD_HEIGHT /
              2 +
            delta,
        }}
      />
    </>
  );
}

function FutureProjectedCard({
  final,
}: {
  final: boolean;
}) {
  return (
    <article
      style={
        styles.futureBracketCard
      }
    >
      <span
        style={
          styles.futureCardLabel
        }
      >
        {final
          ? "Projected Championship"
          : "Projected Matchup"}
      </span>

      <div
        style={
          styles.futureTeamSlot
        }
      >
        Winner from prior round
      </div>

      <div
        style={
          styles.vs
        }
      >
        VS
      </div>

      <div
        style={
          styles.futureTeamSlot
        }
      >
        Winner from prior round
      </div>
    </article>
  );
}

function FutureRealMatchupCard({
  final = false,
  consolation = false,
}: {
  final?: boolean;
  consolation?: boolean;
}) {
  return (
    <article
      style={
        styles.futureBracketCard
      }
    >
      <div
        style={
          styles.matchupTop
        }
      >
        <span
          style={
            styles.matchupLabel
          }
        >
          {consolation
            ? "Consolation Game"
            : final
              ? "Championship"
              : "Future Round"}
        </span>

        <span
          style={
            styles.statusBadge
          }
        >
          PENDING
        </span>
      </div>

      <div
        style={
          styles.futureTeamSlot
        }
      >
        {consolation
          ? "Loser from semifinal"
          : "Winner from prior round"}
      </div>

      <div
        style={
          styles.vs
        }
      >
        VS
      </div>

      <div
        style={
          styles.futureTeamSlot
        }
      >
        {consolation
          ? "Loser from semifinal"
          : "Winner from prior round"}
      </div>
    </article>
  );
}

function ProjectedMatchupCard({
  matchup,
}: {
  matchup: ProjectedMatchup | null;
}) {
  if (!matchup) {
    return (
      <FutureProjectedCard
        final={false}
      />
    );
  }

  if (
    matchup.byeTeam
  ) {
    return (
      <article
        style={
          styles.projectedBracketCard
        }
      >
        <span
          style={
            styles.futureCardLabel
          }
        >
          First Round
        </span>

        <ProjectedTeamLine
          team={
            matchup.byeTeam
          }
        />

        <div
          style={
            styles.byeBadge
          }
        >
          BYE
        </div>
      </article>
    );
  }

  return (
    <article
      style={
        styles.projectedBracketCard
      }
    >
      <span
        style={
          styles.futureCardLabel
        }
      >
        First Round
      </span>

      <ProjectedTeamLine
        team={
          matchup.home
        }
      />

      <div
        style={
          styles.vs
        }
      >
        VS
      </div>

      <ProjectedTeamLine
        team={
          matchup.away
        }
      />
    </article>
  );
}

function ProjectedTeamLine({
  team,
}: {
  team: ProjectedTeam | null;
}) {
  if (!team) {
    return (
      <div
        style={
          styles.projectedTeamRow
        }
      >
        <strong>
          TBD
        </strong>
      </div>
    );
  }

  return (
    <div
      style={
        styles.projectedTeamRow
      }
    >
      <strong
        style={
          styles.projectedTeamName
        }
      >
        #{team.seed}{" "}
        {team.teamName}
      </strong>

      <span
        style={
          styles.projectedTeamPercent
        }
      >
        {clampProbability(
          team.playoffProbability
        ).toFixed(
          1
        )}
        %
      </span>
    </div>
  );
}

function buildBracketCenters(
  firstRoundCount: number
): number[][] {
  const first =
    Array.from(
      {
        length:
          firstRoundCount,
      },
      (
        _,
        index
      ) =>
        BRACKET_CARD_HEIGHT /
          2 +
        index *
          (
            BRACKET_CARD_HEIGHT +
            BRACKET_FIRST_GAP
          )
    );

  const rounds:
    number[][] = [
      first,
    ];

  let current =
    first;

  while (
    current.length >
    1
  ) {
    const next:
      number[] = [];

    for (
      let index = 0;
      index <
      current.length;
      index += 2
    ) {
      const firstCenter =
        current[index];

      const secondCenter =
        current[
          index + 1
        ] ??
        firstCenter;

      next.push(
        (
          firstCenter +
          secondCenter
        ) /
          2
      );
    }

    rounds.push(
      next
    );

    current =
      next;
  }

  return rounds;
}

function projectedRoundTitle(
  round: number,
  totalRounds: number,
  matchupCount: number
): string {
  if (
    round ===
    totalRounds
  ) {
    return "Projected Championship";
  }

  if (
    matchupCount ===
    2
  ) {
    return "Projected Semifinal";
  }

  if (
    matchupCount ===
    4
  ) {
    return "Projected Quarterfinals";
  }

  return round === 1
    ? "First Round"
    : `Projected Round ${round}`;
}

function liveRoundTitle(
  round: number,
  totalRounds: number,
  matchupCount: number
): string {
  if (
    round ===
    totalRounds
  ) {
    return "Championship";
  }

  if (
    matchupCount ===
    2
  ) {
    return "Semifinals";
  }

  if (
    matchupCount ===
    4
  ) {
    return "Quarterfinals";
  }

  return round === 1
    ? "First Round"
    : `Round ${round}`;
}

function RealMatchupCard({
  matchup,
  isCommissioner,
  resolving,
  onResolveTiebreak,
  onOpen,
}: {
  matchup: PlayoffMatchupView;
  isCommissioner: boolean;
  resolving: boolean;
  onResolveTiebreak: (winnerTeamId: number) => Promise<void>;
  onOpen: () => void;
}) {
  const clickable =
    matchup.homeTeam !==
      null &&
    matchup.awayTeam !==
      null;

  return (
    <article
      style={{
        ...styles.realMatchupCard,

        ...(clickable
          ? styles.clickableCard
          : {}),
      }}
      role={
        clickable
          ? "button"
          : undefined
      }
      tabIndex={
        clickable
          ? 0
          : -1
      }
      onClick={() => {
        if (clickable) {
          onOpen();
        }
      }}
      onKeyDown={(
        event
      ) => {
        if (
          clickable &&
          (
            event.key ===
              "Enter" ||
            event.key ===
              " "
          )
        ) {
          event.preventDefault();
          onOpen();
        }
      }}
    >
      <div
        style={
          styles.matchupTop
        }
      >
        <span
          style={
            styles.matchupLabel
          }
        >
          Week {matchup.week}
        </span>

        <span
          style={
            styles.statusBadge
          }
        >
          {matchup.status.toUpperCase()}
        </span>
      </div>

      <RealTeamLine
        team={
          matchup.homeTeam
        }
        seed={
          matchup.homeSeed
        }
        points={
          matchup.homePoints
        }
        projected={
          matchup.homeProjectedPoints
        }
        winner={
          matchup.winnerTeamId !==
            null &&
          matchup.homeTeam?.id ===
            matchup.winnerTeamId
        }
      />

      <div
        style={
          styles.vs
        }
      >
        VS
      </div>

      <RealTeamLine
        team={
          matchup.awayTeam
        }
        seed={
          matchup.awaySeed
        }
        points={
          matchup.awayPoints
        }
        projected={
          matchup.awayProjectedPoints
        }
        winner={
          matchup.winnerTeamId !==
            null &&
          matchup.awayTeam?.id ===
            matchup.winnerTeamId
        }
      />

      {matchup.status === "tiebreak_pending" &&
      matchup.homeTeam &&
      matchup.awayTeam ? (
        <div
          style={styles.tiebreakBox}
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          <strong style={styles.tiebreakTitle}>
            PLAYOFF TIE — WINNER REQUIRED
          </strong>

          {isCommissioner ? (
            <>
              <span style={styles.tiebreakHelp}>
                Select the team that advances. This decision is final.
              </span>

              <div style={styles.tiebreakActions}>
                <button
                  type="button"
                  style={styles.tiebreakButton}
                  disabled={resolving}
                  onClick={() =>
                    void onResolveTiebreak(matchup.homeTeam!.id)
                  }
                >
                  {resolving
                    ? "Resolving..."
                    : `Advance ${matchup.homeTeam.team_name ?? `Team ${matchup.homeTeam.id}`}`}
                </button>

                <button
                  type="button"
                  style={styles.tiebreakButton}
                  disabled={resolving}
                  onClick={() =>
                    void onResolveTiebreak(matchup.awayTeam!.id)
                  }
                >
                  {resolving
                    ? "Resolving..."
                    : `Advance ${matchup.awayTeam.team_name ?? `Team ${matchup.awayTeam.id}`}`}
                </button>
              </div>
            </>
          ) : (
            <span style={styles.tiebreakHelp}>
              Waiting for commissioner tiebreak decision.
            </span>
          )}
        </div>
      ) : null}

      {clickable ? (
        <div
          style={
            styles.openRow
          }
        >
          Click for Team vs. Team player detail
        </div>
      ) : (
        <div
          style={
            styles.pendingRow
          }
        >
          Waiting for prior-round winner
        </div>
      )}
    </article>
  );
}

function RealTeamLine({
  team,
  seed,
  points,
  projected,
  winner,
}: {
  team: TeamRow | null;
  seed: number | null;
  points: number;
  projected: number;
  winner: boolean;
}) {
  if (!team) {
    return (
      <div
        style={
          styles.realTeamLine
        }
      >
        <strong>
          TBD
        </strong>
      </div>
    );
  }

  return (
    <div
      style={{
        ...styles.realTeamLine,

        ...(winner
          ? styles.winnerLine
          : {}),
      }}
    >
      <div>
        <strong>
          {seed
            ? `#${seed} `
            : ""}
          {team.team_name ??
            `Team ${team.id}`}
        </strong>

        <div
          style={
            styles.teamRecord
          }
        >
          {team.wins}-
          {team.losses}
          {team.ties > 0
            ? `-${team.ties}`
            : ""}
        </div>
      </div>

      <div
        style={
          styles.scoreBlock
        }
      >
        <strong>
          {points.toFixed(
            2
          )}
        </strong>

        <span>
          Proj{" "}
          {projected.toFixed(
            2
          )}
        </span>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div
      style={
        styles.stat
      }
    >
      <span
        style={
          styles.statLabel
        }
      >
        {label}
      </span>

      <strong>
        {value}
      </strong>
    </div>
  );
}

function buildProjectedBracket(
  projectedTeams: ProjectedTeam[],
  playoffTeamCount: number
): ProjectedMatchup[] {
  const field =
    projectedTeams
      .slice(
        0,
        playoffTeamCount
      )
      .sort(
        (
          first,
          second
        ) =>
          first.seed -
          second.seed
      );

  if (
    playoffTeamCount < 2
  ) {
    return [];
  }

  const bracketSize =
    nextPowerOfTwo(
      Math.max(
        playoffTeamCount,
        2
      )
    );

  const seedOrder =
    buildPlayoffSeedOrder(
      bracketSize
    );

  const teamBySeed =
    new Map(
      field.map(
        (team) => [
          team.seed,
          team,
        ]
      )
    );

  const matchups:
    ProjectedMatchup[] = [];

  for (
    let index = 0;
    index < seedOrder.length;
    index += 2
  ) {
    const homeSeed =
      seedOrder[index];

    const awaySeed =
      seedOrder[
        index + 1
      ];

    const homeTeam =
      homeSeed
        ? teamBySeed.get(
            homeSeed
          ) ??
          null
        : null;

    const awayTeam =
      awaySeed
        ? teamBySeed.get(
            awaySeed
          ) ??
          null
        : null;

    const homeSeedIsBye =
      homeSeed > playoffTeamCount;

    const awaySeedIsBye =
      awaySeed > playoffTeamCount;

    const byeTeam =
      !homeSeedIsBye &&
      awaySeedIsBye
        ? homeTeam
        : !awaySeedIsBye &&
            homeSeedIsBye
          ? awayTeam
          : null;

    matchups.push({
      key:
        homeSeedIsBye ||
        awaySeedIsBye
          ? `bye-seed-${homeSeedIsBye ? awaySeed : homeSeed}`
          : `game-seed-${homeSeed}-${awaySeed}`,

      round: 1,

      label:
        "First Round",

      home:
        byeTeam
          ? null
          : homeTeam,

      away:
        byeTeam
          ? null
          : awayTeam,

      byeTeam,
    });
  }

  return matchups;
}

function buildPlayoffSeedOrder(
  bracketSize: number
): number[] {
  if (
    bracketSize < 2
  ) {
    return [];
  }

  let order = [
    1,
    2,
  ];

  let size = 2;

  while (
    size < bracketSize
  ) {
    size *= 2;

    const nextOrder:
      number[] = [];

    for (
      const seed
      of order
    ) {
      nextOrder.push(
        seed
      );

      nextOrder.push(
        size + 1 - seed
      );
    }

    order =
      nextOrder;
  }

  return order;
}

function nextPowerOfTwo(
  value: number
): number {
  let result = 1;

  while (
    result < value
  ) {
    result *= 2;
  }

  return result;
}

function clampProbability(
  value: number
): number {
  return Math.max(
    0,
    Math.min(
      100,
      value
    )
  );
}

function formatRoundLabel(
  round: number,
  matchupCount: number
): string {
  if (
    matchupCount === 1
  ) {
    return "Championship";
  }

  if (
    matchupCount === 2
  ) {
    return "Semifinals";
  }

  if (
    matchupCount === 4
  ) {
    return "Quarterfinals";
  }

  return `Round ${round}`;
}

function formatPlayoffStatus(
  status: string
): string {
  if (
    status ===
    "completed"
  ) {
    return "Playoffs Complete";
  }

  if (
    status === "live"
  ) {
    return "Live Playoffs";
  }

  if (
    status ===
    "scheduled"
  ) {
    return "Playoff Bracket";
  }

  return status;
}

const styles: Record<
  string,
  CSSProperties
> = {
  page: {
    minHeight:
      "100vh",
    padding:
      "24px",
    background:
      "transparent",
    color:
      "#ffffff",
  },

  container: {
    width: "min(1600px, 100%)",
    margin: "0 auto",
    display: "grid",
    gap: "16px",
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "18px",
    flexWrap: "wrap",
    padding: "20px",
    border: "1px solid rgba(120,140,160,0.34)",
    borderRadius: "10px",
    background: "linear-gradient(135deg, rgba(18,25,32,0.97), rgba(8,13,19,0.98))",
    boxShadow: "0 16px 36px rgba(0,0,0,0.38)",
    backdropFilter: "blur(14px)",
  },

  headerRight: {
    display:
      "grid",
    gap:
      "9px",
    justifyItems:
      "end",
  },

  headerStats: {
    display: "grid",
    gridTemplateColumns: "repeat(3,minmax(115px,1fr))",
    gap: "0",
    overflow: "hidden",
    border: "1px solid rgba(120,140,160,0.34)",
    borderRadius: "8px",
    background: "#0f172a",
  },

  actionRow: {
    display:
      "flex",
    gap:
      "9px",
    flexWrap:
      "wrap",
    justifyContent:
      "flex-end",
  },

  autoRefreshText: {
    color:
      "#9fb0a7",
    fontSize:
      "9px",
  },

  primaryButton: {
    padding:
      "10px 14px",
    border:
      0,
    borderRadius:
      "8px",
    background:
      "#60a5fa",
    color:
      "#04130c",
    fontWeight:
      900,
    cursor:
      "pointer",
  },

  secondaryButton: {
    padding:
      "10px 14px",
    border:
      "1px solid #475569",
    borderRadius:
      "8px",
    background:
      "#123522",
    color:
      "#60a5fa",
    fontWeight:
      900,
    cursor:
      "pointer",
  },

  eyebrow: {
    color:
      "#60a5fa",
    fontSize:
      "10px",
    fontWeight:
      900,
    letterSpacing:
      "0.08em",
  },

  title: {
    margin:
      "6px 0",
    fontSize:
      "34px",
  },

  subtitle: {
    margin:
      0,
    color:
      "#9fb0a7",
  },

  stat: {
    minWidth:
      "110px",
    padding:
      "11px",
    border:
      "1px dashed #475569",
    borderRadius:
      "9px",
    background:
      "#071a12",
    display:
      "grid",
    gap:
      "5px",
  },

  statLabel: {
    color:
      "#7f9187",
    fontSize:
      "9px",
    fontWeight:
      900,
  },

  section: {
    display: "grid",
    gap: "14px",
    padding: "16px",
    border: "1px solid rgba(120,140,160,0.34)",
    borderRadius: "10px",
    background: "linear-gradient(145deg,rgba(18,25,32,0.97),rgba(8,13,19,0.98))",
    boxShadow: "0 14px 32px rgba(0,0,0,0.30)",
  },

  sectionHeader: {
    display:
      "flex",
    justifyContent:
      "space-between",
    alignItems:
      "center",
    gap:
      "12px",
  },

  sectionTitle: {
    margin:
      "5px 0 0",
    fontSize:
      "22px",
  },

  weekBadge: {
    padding:
      "7px 10px",
    borderRadius:
      "999px",
    background:
      "#123522",
    color:
      "#60a5fa",
    fontSize:
      "10px",
    fontWeight:
      900,
  },

  tableWrap: {
    overflowX:
      "auto",
    border:
      "1px solid #244a3a",
    borderRadius:
      "12px",
    background:
      "#071a12",
  },

  table: {
    width:
      "100%",
    borderCollapse:
      "collapse",
    minWidth:
      "800px",
  },

  th: {
    padding:
      "11px",
    textAlign:
      "left",
    color:
      "#9fb0a7",
    fontSize:
      "10px",
    borderBottom:
      "1px solid #244a3a",
  },

  td: {
    padding:
      "11px",
    borderBottom:
      "1px solid #17382b",
    fontSize:
      "12px",
  },

  tdStrong: {
    padding:
      "11px",
    borderBottom:
      "1px solid #17382b",
    fontSize:
      "12px",
    fontWeight:
      900,
  },

  oddsCell: {
    display:
      "grid",
    gridTemplateColumns:
      "minmax(120px, 1fr) 58px",
    alignItems:
      "center",
    gap:
      "9px",
  },

  oddsTrack: {
    height:
      "9px",
    overflow:
      "hidden",
    borderRadius:
      "999px",
    background:
      "#1b2b23",
  },

  oddsFill: {
    height:
      "100%",
    background:
      "#60a5fa",
  },

  inBadge: {
    display:
      "inline-block",
    padding:
      "4px 7px",
    borderRadius:
      "999px",
    background:
      "#123522",
    color:
      "#60a5fa",
    fontSize:
      "9px",
    fontWeight:
      900,
  },

  outBadge: {
    display:
      "inline-block",
    padding:
      "4px 7px",
    borderRadius:
      "999px",
    background:
      "#321818",
    color:
      "#ffb3b3",
    fontSize:
      "9px",
    fontWeight:
      900,
  },

  projectedBracket: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))",
    gap: "12px",
  },

  realBracket: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))",
    gap: "14px",
    alignItems: "start",
  },

  roundColumn: {
    minWidth:
      "340px",
    display:
      "grid",
    gap:
      "12px",
  },

  roundTitle: {
    margin:
      0,
    color:
      "#60a5fa",
    fontSize:
      "15px",
  },

  roundMatchups: {
    display:
      "grid",
    gap:
      "14px",
  },

  realMatchupCard: {
    display:
      "grid",
    gap:
      "9px",
    padding:
      "14px",
    border:
      "1px solid #244a3a",
    borderRadius:
      "12px",
    background:
      "#071a12",
  },

  clickableCard: {
    cursor:
      "pointer",
  },

  matchupTop: {
    display:
      "flex",
    justifyContent:
      "space-between",
    gap:
      "8px",
  },

  statusBadge: {
    padding:
      "3px 6px",
    borderRadius:
      "999px",
    background:
      "#123522",
    color:
      "#60a5fa",
    fontSize:
      "8px",
    fontWeight:
      900,
  },

  realTeamLine: {
    display:
      "flex",
    justifyContent:
      "space-between",
    alignItems:
      "center",
    gap:
      "10px",
    padding:
      "10px",
    borderRadius:
      "8px",
    background:
  "#0f172a",
  },

  winnerLine: {
  border:
    "1px solid #4ade80",

  background:
    "rgba(20,83,45,0.30)",
},

  teamRecord: {
    marginTop:
      "2px",
    color:
      "#9fb0a7",
    fontSize:
      "9px",
  },

  scoreBlock: {
    display:
      "grid",
    justifyItems:
      "end",
    gap:
      "2px",
    fontSize:
      "11px",
  },

  tiebreakBox: {
    display: "grid",
    gap: "8px",
    padding: "10px",
    border: "1px solid #8a6d2f",
    borderRadius: "8px",
    background: "#211b0c",
  },

  tiebreakTitle: {
    color: "#ffd76a",
    fontSize: "10px",
    fontWeight: 900,
    textAlign: "center",
  },

  tiebreakHelp: {
    color: "#d6c99d",
    fontSize: "9px",
    textAlign: "center",
  },

  tiebreakActions: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
    justifyContent: "center",
  },

  tiebreakButton: {
    padding: "8px 10px",
    border: "1px solid #ffd76a",
    borderRadius: "7px",
    background: "#33290f",
    color: "#ffd76a",
    fontSize: "9px",
    fontWeight: 900,
    cursor: "pointer",
  },

  openRow: {
    color:
      "#60a5fa",
    fontSize:
      "9px",
    fontWeight:
      900,
    textAlign:
      "center",
  },

  pendingRow: {
    color:
      "#7f9187",
    fontSize:
      "9px",
    textAlign:
      "center",
  },

  championCard: {
  padding:
    "22px",

  border:
    "1px solid #4ade80",

  borderRadius:
    "14px",

  background:
    "rgba(20,83,45,0.30)",

  textAlign:
    "center",
  },

  championTitle: {
    margin:
      "7px 0 0",
    fontSize:
      "30px",
  },

  matchupCard: {
    display:
      "grid",
    gap:
      "10px",
    padding:
      "14px",
    border:
      "1px solid #244a3a",
    borderRadius:
      "12px",
    background:
      "#071a12",
  },

  matchupLabel: {
    color:
      "#60a5fa",
    fontSize:
      "9px",
    fontWeight:
      900,
  },

  teamLine: {
    display:
      "flex",
    justifyContent:
      "space-between",
    alignItems:
      "center",
    gap:
      "10px",
    padding:
      "10px",
    borderRadius:
      "8px",
    background:
      "#06170f",
  },

  teamOdds: {
    color:
      "#9fb0a7",
    fontSize:
      "9px",
  },

  vs: {
    textAlign:
      "center",
    color:
      "#60a5fa",
    fontWeight:
      900,
    fontSize:
      "10px",
  },

  byeRow: {
    display:
      "flex",
    justifyContent:
      "space-between",
    alignItems:
      "center",
    gap:
      "10px",
    padding:
      "10px",
    borderRadius:
      "8px",
    background:
      "#06170f",
  },

  byeBadge: {
    padding:
      "4px 7px",
    borderRadius:
      "999px",
    background:
      "#123522",
    color:
      "#60a5fa",
    fontSize:
      "9px",
    fontWeight:
      900,
  },

  empty: {
    padding:
      "18px",
    border:
  "1px dashed #475569",
    borderRadius:
      "10px",
    background:
      "#071a12",
    color:
      "#9fb0a7",
    textAlign:
      "center",
  },

  success: {
    padding:
      "12px",
    borderRadius:
      "8px",
    background:
      "#123522",
    color:
      "#b8ff99",
  },

  error: {
    padding:
      "12px",
    borderRadius:
      "8px",
    background:
      "#321818",
    color:
      "#ffb3b3",
  },

  errorCard: {
    width:
      "min(680px, 100%)",
    margin:
      "80px auto 0",
    padding:
      "18px",
    border:
      "1px solid #5a3636",
    borderRadius:
      "12px",
    background:
      "#321818",
  },

  bracketIntro: {
    display:
      "flex",
    justifyContent:
      "space-between",
    alignItems:
      "flex-start",
    gap:
      "18px",
    flexWrap:
      "wrap",
  },

  bracketHelp: {
    margin:
      "6px 0 0",
    color:
      "#aab4af",
    fontSize:
      "11px",
    lineHeight:
      1.5,
  },

  playoffCountdown: {
    display:
      "grid",
    gap:
      "4px",
    minWidth:
      "245px",
    padding:
      "12px 16px",
    border:
      "1px solid rgba(120,140,160,0.34)",
    borderRadius:
      "9px",
    background:
      "rgba(7,18,14,0.88)",
  },

  bracketScroller: {
    width:
      "100%",
    overflowX:
      "auto",
    overflowY:
      "visible",
    padding:
      "10px 0 24px",
  },

  bracketCanvas: {
    position:
      "relative",
    minWidth:
      "100%",
    margin:
      "0 auto",
  },

  bracketColumn: {
    position:
      "absolute",
    top:
      0,
  },

  bracketColumnHeading: {
    position:
      "absolute",
    top:
      0,
    left:
      0,
    right:
      0,
    display:
      "grid",
    justifyItems:
      "center",
    gap:
      "3px",
    color:
      "#22aaff",
    fontSize:
      "13px",
    fontWeight:
      900,
  },

  bracketPositionedCard: {
    position:
      "absolute",
    left:
      0,
    width:
      "100%",
    height:
      `${BRACKET_CARD_HEIGHT}px`,
  },

  projectedBracketCard: {
    position:
      "relative",
    boxSizing:
      "border-box",
    height:
      "100%",
    display:
      "grid",
    gap:
      "8px",
    padding:
      "12px",
    border:
      "1px solid #137647",
    borderRadius:
      "11px",
    background:
      "rgba(0,35,22,0.70)",
    boxShadow:
      "0 10px 24px rgba(0,0,0,0.22)",
  },

  projectedTeamRow: {
    minHeight:
      "43px",
    display:
      "flex",
    alignItems:
      "center",
    justifyContent:
      "space-between",
    gap:
      "12px",
    padding:
      "7px 9px",
    borderRadius:
      "7px",
    background:
      "rgba(0,20,13,0.38)",
  },

  projectedTeamName: {
    fontSize:
      "13px",
  },

  projectedTeamPercent: {
    color:
      "#b7c7bf",
    fontSize:
      "10px",
    whiteSpace:
      "nowrap",
  },

  futureBracketCard: {
    position:
      "relative",
    boxSizing:
      "border-box",
    height:
      "100%",
    display:
      "grid",
    gap:
      "8px",
    padding:
      "12px",
    border:
      "1px solid #137647",
    borderRadius:
      "11px",
    background:
      "rgba(0,35,22,0.62)",
    boxShadow:
      "0 10px 24px rgba(0,0,0,0.20)",
  },

  futureCardLabel: {
    color:
      "#22aaff",
    fontSize:
      "9px",
    fontWeight:
      900,
    textTransform:
      "uppercase",
    letterSpacing:
      "0.04em",
  },

  futureTeamSlot: {
    minHeight:
      "42px",
    display:
      "flex",
    alignItems:
      "center",
    justifyContent:
      "center",
    padding:
      "7px",
    border:
      "1px dashed #18734b",
    borderRadius:
      "7px",
    color:
      "#90a79c",
    background:
      "rgba(0,20,13,0.22)",
    fontSize:
      "9px",
    fontWeight:
      800,
  },

  connectorHorizontalFirst: {
    position:
      "absolute",
    left:
      `calc(100% + 1px)`,
    width:
      `${BRACKET_COLUMN_GAP / 2}px`,
    height:
      "2px",
    background:
      "#48d883",
    zIndex:
      5,
    pointerEvents:
      "none",
  },

  connectorVertical: {
    position:
      "absolute",
    left:
      `calc(100% + ${BRACKET_COLUMN_GAP / 2}px)`,
    width:
      "2px",
    background:
      "#48d883",
    zIndex:
      5,
    pointerEvents:
      "none",
  },

  connectorHorizontalSecond: {
    position:
      "absolute",
    left:
      `calc(100% + ${BRACKET_COLUMN_GAP / 2}px)`,
    width:
      `${BRACKET_COLUMN_GAP / 2}px`,
    height:
      "2px",
    background:
      "#48d883",
    zIndex:
      5,
    pointerEvents:
      "none",
  },

  seedTieGroup: {
    marginTop:
      "18px",
    padding:
      "18px",
    border:
      "1px solid rgba(255,255,255,0.10)",
    borderRadius:
      "14px",
    background:
      "rgba(255,255,255,0.025)",
  },

  seedTieHeader: {
    display:
      "flex",
    justifyContent:
      "space-between",
    alignItems:
      "center",
    gap:
      "12px",
    flexWrap:
      "wrap",
    marginBottom:
      "12px",
  },

  seedTieTeam: {
    display:
      "flex",
    justifyContent:
      "space-between",
    alignItems:
      "center",
    gap:
      "16px",
    padding:
      "12px 0",
    borderTop:
      "1px solid rgba(255,255,255,0.08)",
    flexWrap:
      "wrap",
  },

  seedTieActions: {
    display:
      "flex",
    gap:
      "8px",
    flexWrap:
      "wrap",
  },

  seedButton: {
    border:
      "1px solid rgba(255,255,255,0.18)",
    borderRadius:
      "9px",
    padding:
      "8px 11px",
    background:
      "rgba(255,255,255,0.05)",
    color:
      "#ffffff",
    fontWeight:
      800,
    cursor:
      "pointer",
  },

  seedButtonSelected: {
    border:
      "1px solid #22c55e",
    background:
      "rgba(34,197,94,0.16)",
  },

};


