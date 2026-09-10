"use client";

import {
  type CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import Link from "next/link";

import {
  useParams,
  useRouter,
} from "next/navigation";

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


type League = {
  id: string;
  name: string;
  league_type: string;
  season: number;
};

type Membership = {
  role: string;
};

type Draft = {
  id: string;
  league_id: string;
  status: string;
  updated_at?: string | null;
};

type FantasyTeam = {
  id: number;
  team_name: string;
  owner_id: string | null;
};

type TeamGrade = {
  id: number;
  draft_id: string;
  league_id: string;
  fantasy_team_id: number;
  season: number;

  projected_starter_points: number;
  projected_weekly_average: number;
  projected_weekly_floor: number;
  projected_weekly_ceiling: number;
  projected_weekly_stddev: number;

  projected_strength_rank: number;
  weeks_analyzed: number;

  total_vorp: number;
  average_player_vorp: number;

  elite_position_players: number;
  above_replacement_players: number;

  elite_steals: number;
  major_steals: number;
  good_values: number;
  values_count: number;
  fair_values: number;

  slight_reaches: number;
  reaches: number;
  major_reaches: number;
  extreme_reaches: number;

  average_pick_value_score: number;

  roster_player_count: number;
  qb_count: number;
  rb_count: number;
  wr_count: number;
  te_count: number;
  k_count: number;
  dst_count: number;

  starter_strength_score: number;
  vorp_advantage_score: number;
  draft_capital_score: number;
  positional_quality_score: number;
  roster_construction_score: number;
  consistency_score: number;
  bye_coverage_score: number;

  final_score: number;
  final_grade: string;
  draft_grade_rank: number;
};

type PlayerMetric = {
  id: number;
  fantasy_team_id: number;
  player_id: number;

  position: string;

  actual_pick: number;
  actual_round: number;

  g365_overall_rank: number | null;
  g365_position_rank: number | null;

  projected_season_points: number;
  replacement_rank: number;
  replacement_player_points: number;
  vorp: number;

  positional_tier_gap: number;

  draft_value_spots: number;
  pick_value_score: number;
  pick_value_label: string;
};

type NflPlayer = {
  id: number;
  full_name: string;
  position: string | null;
  team_abbreviation?: string | null;
};

type GradeTeam =
  TeamGrade & {
    team_name: string;
    owner_id: string | null;
  };

type GradePlayer =
  PlayerMetric & {
    full_name: string;
    nfl_position: string | null;
    team_abbreviation:
      | string
      | null;
  };

type GenerateResponse = {
  success?: boolean;
  generatedCount?: number;
  error?: string;
};


const COMPONENTS = [
  {
    key:
      "starter_strength_score",
    label:
      "Starter Strength",
    max: 30,
  },
  {
    key:
      "vorp_advantage_score",
    label:
      "VORP / Positional Advantage",
    max: 20,
  },
  {
    key:
      "draft_capital_score",
    label:
      "Draft Value",
    max: 20,
  },
  {
    key:
      "positional_quality_score",
    label:
      "Positional Quality",
    max: 10,
  },
  {
    key:
      "roster_construction_score",
    label:
      "Roster Construction",
    max: 10,
  },
  {
    key:
      "consistency_score",
    label:
      "Consistency",
    max: 5,
  },
  {
    key:
      "bye_coverage_score",
    label:
      "Bye Coverage",
    max: 5,
  },
] as const;


export default function DraftGradesPage() {
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
    useState<League | null>(
      null
    );

  const [
    membership,
    setMembership,
  ] =
    useState<Membership | null>(
      null
    );

  const [
    draft,
    setDraft,
  ] =
    useState<Draft | null>(
      null
    );

  const [
    currentUserId,
    setCurrentUserId,
  ] =
    useState<string | null>(
      null
    );

  const [
    teamGrades,
    setTeamGrades,
  ] =
    useState<GradeTeam[]>(
      []
    );

  const [
    playerMetrics,
    setPlayerMetrics,
  ] =
    useState<GradePlayer[]>(
      []
    );

  const [
    selectedTeamId,
    setSelectedTeamId,
  ] =
    useState<number | null>(
      null
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    refreshing,
    setRefreshing,
  ] =
    useState(false);

  const [
    generating,
    setGenerating,
  ] =
    useState(false);

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


  const isCommissioner =
    membership?.role ===
      "commissioner" ||
    membership?.role ===
      "co_commissioner";


  const loadPage =
    useCallback(
      async ({
        showLoading = true,
      }: {
        showLoading?: boolean;
      } = {}): Promise<void> => {
        if (!leagueId) {
          setIsError(true);
          setMessage(
            "League ID is missing."
          );
          setLoading(false);
          return;
        }

        if (showLoading) {
          setLoading(true);
        } else {
          setRefreshing(true);
        }

        setIsError(false);

        try {
          const {
            data: userData,
            error: userError,
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

          setCurrentUserId(
            user.id
          );


          const [
            leagueResponse,
            membershipResponse,
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
                .maybeSingle(),

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
            ]);


          if (
            leagueResponse.error ||
            !leagueResponse.data
          ) {
            throw new Error(
              leagueResponse.error
                ?.message ??
              "League could not be loaded."
            );
          }


          if (
            membershipResponse.error ||
            !membershipResponse.data
          ) {
            throw new Error(
              membershipResponse.error
                ?.message ??
              "You are not a member of this league."
            );
          }


          const loadedLeague =
            leagueResponse.data as League;


          if (
            loadedLeague.league_type !==
            "traditional"
          ) {
            throw new Error(
              "Draft Grades are currently available for Traditional leagues."
            );
          }


          setLeague(
            loadedLeague
          );

          setMembership(
            membershipResponse.data as Membership
          );


          const {
            data: draftRows,
            error: draftError,
          } =
            await supabase
              .from(
                "league_drafts"
              )
              .select(`
                id,
                league_id,
                status,
                updated_at
              `)
              .eq(
                "league_id",
                leagueId
              )
              .order(
                "updated_at",
                {
                  ascending: false,
                }
              )
              .limit(1);


          if (draftError) {
            throw new Error(
              draftError.message
            );
          }


          const loadedDraft =
            (
              draftRows ??
              []
            )[0] as
              | Draft
              | undefined;


          if (!loadedDraft) {
            throw new Error(
              "No draft exists for this league."
            );
          }


          setDraft(
            loadedDraft
          );


          const [
            gradeResponse,
            teamsResponse,
          ] =
            await Promise.all([
              supabase
                .from(
                  "traditional_draft_grade_v4_team_metrics"
                )
                .select("*")
                .eq(
                  "draft_id",
                  loadedDraft.id
                )
                .order(
                  "draft_grade_rank",
                  {
                    ascending: true,
                    nullsFirst:
                      false,
                  }
                ),

              supabase
                .from(
                  "fantasy_teams"
                )
                .select(`
                  id,
                  team_name,
                  owner_id
                `)
                .eq(
                  "league_id",
                  leagueId
                ),
            ]);


          if (
            gradeResponse.error
          ) {
            throw new Error(
              gradeResponse.error
                .message
            );
          }


          if (
            teamsResponse.error
          ) {
            throw new Error(
              teamsResponse.error
                .message
            );
          }


          const teams =
            (
              teamsResponse.data ??
              []
            ) as FantasyTeam[];


          const teamMap =
            new Map<
              number,
              FantasyTeam
            >(
              teams.map(
                (
                  team:
                    FantasyTeam
                ) => [
                  Number(
                    team.id
                  ),
                  team,
                ]
              )
            );


          const gradeRows =
            (
              gradeResponse.data ??
              []
            ) as TeamGrade[];


          const loadedGrades =
            gradeRows.map(
              (
                row:
                  TeamGrade
              ): GradeTeam => {
                const team =
                  teamMap.get(
                    Number(
                      row.fantasy_team_id
                    )
                  );


                return {
                  ...row,

                  fantasy_team_id:
                    Number(
                      row.fantasy_team_id
                    ),

                  team_name:
                    team?.team_name ??
                    `Team ${row.fantasy_team_id}`,

                  owner_id:
                    team?.owner_id ??
                    null,
                };
              }
            );


          setTeamGrades(
            loadedGrades
          );


          const {
            data: metricRows,
            error: metricError,
          } =
            await supabase
              .from(
                "traditional_draft_grade_v4_player_metrics"
              )
              .select(`
                id,
                fantasy_team_id,
                player_id,
                position,
                actual_pick,
                actual_round,
                g365_overall_rank,
                g365_position_rank,
                projected_season_points,
                replacement_rank,
                replacement_player_points,
                vorp,
                positional_tier_gap,
                draft_value_spots,
                pick_value_score,
                pick_value_label
              `)
              .eq(
                "draft_id",
                loadedDraft.id
              )
              .order(
                "actual_pick",
                {
                  ascending: true,
                }
              );


          if (metricError) {
            throw new Error(
              metricError.message
            );
          }


          const metrics =
            (
              metricRows ??
              []
            ) as PlayerMetric[];


          const playerIds =
            Array.from(
              new Set(
                metrics.map(
                  (
                    metric:
                      PlayerMetric
                  ) =>
                    Number(
                      metric.player_id
                    )
                )
              )
            );


          let players:
            NflPlayer[] = [];


          if (
            playerIds.length >
            0
          ) {
            const {
              data:
                playerRows,
              error:
                playerError,
            } =
              await supabase
                .from(
                  "nfl_players"
                )
                .select(`
                  id,
                  full_name,
                  position:primary_position,
                  team_abbreviation
                `)
                .in(
                  "id",
                  playerIds
                );


            if (
              playerError
            ) {
              throw new Error(
                playerError.message
              );
            }


            players =
              (
                playerRows ??
                []
              ) as NflPlayer[];
          }


          const playerMap =
            new Map<
              number,
              NflPlayer
            >(
              players.map(
                (
                  player:
                    NflPlayer
                ) => [
                  Number(
                    player.id
                  ),
                  player,
                ]
              )
            );


          const loadedPlayers =
            metrics.map(
              (
                metric:
                  PlayerMetric
              ): GradePlayer => {
                const player =
                  playerMap.get(
                    Number(
                      metric.player_id
                    )
                  );


                return {
                  ...metric,

                  fantasy_team_id:
                    Number(
                      metric.fantasy_team_id
                    ),

                  player_id:
                    Number(
                      metric.player_id
                    ),

                  full_name:
                    player?.full_name ??
                    `Player ${metric.player_id}`,

                  nfl_position:
                    player?.position ??
                    null,

                  team_abbreviation:
                    player
                      ?.team_abbreviation ??
                    null,
                };
              }
            );


          setPlayerMetrics(
            loadedPlayers
          );


          setSelectedTeamId(
            (
              current:
                number | null
            ) => {
              if (
                current &&
                loadedGrades.some(
                  (
                    grade:
                      GradeTeam
                  ) =>
                    grade.fantasy_team_id ===
                    current
                )
              ) {
                return current;
              }


              const myTeam =
                loadedGrades.find(
                  (
                    grade:
                      GradeTeam
                  ) =>
                    grade.owner_id ===
                    user.id
                );


              return (
                myTeam
                  ?.fantasy_team_id ??
                loadedGrades[0]
                  ?.fantasy_team_id ??
                null
              );
            }
          );
        } catch (error) {
          setIsError(true);

          setMessage(
            error instanceof Error
              ? error.message
              : "Draft grades could not be loaded."
          );
        } finally {
          setLoading(false);
          setRefreshing(false);
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


  useEffect(() => {
    if (!draft?.id) {
      return;
    }


    const reload =
      () => {
        void loadPage({
          showLoading: false,
        });
      };


    const channel =
      supabase
        .channel(
          `draft-grade-v4-${draft.id}`
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table:
              "traditional_draft_grade_v4_team_metrics",
            filter:
              `draft_id=eq.${draft.id}`,
          },
          reload
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table:
              "traditional_draft_grade_v4_player_metrics",
            filter:
              `draft_id=eq.${draft.id}`,
          },
          reload
        )
        .subscribe();


    return () => {
      void supabase
        .removeChannel(
          channel
        );
    };
  }, [
    draft?.id,
    loadPage,
  ]);


  const selectedGrade =
    useMemo(
      () =>
        teamGrades.find(
          (
            grade:
              GradeTeam
          ) =>
            grade.fantasy_team_id ===
            selectedTeamId
        ) ?? null,
      [
        teamGrades,
        selectedTeamId,
      ]
    );


  const selectedPlayers =
    useMemo(
      () =>
        playerMetrics.filter(
          (
            player:
              GradePlayer
          ) =>
            player.fantasy_team_id ===
            selectedTeamId
        ),
      [
        playerMetrics,
        selectedTeamId,
      ]
    );


  const bestValue =
    useMemo(
      () =>
        [...selectedPlayers]
          .sort(
            (
              a:
                GradePlayer,
              b:
                GradePlayer
            ) =>
              Number(
                b.pick_value_score
              ) -
              Number(
                a.pick_value_score
              )
          )[0] ?? null,
      [
        selectedPlayers,
      ]
    );


  const biggestReach =
    useMemo(
      () =>
        [...selectedPlayers]
          .sort(
            (
              a:
                GradePlayer,
              b:
                GradePlayer
            ) =>
              Number(
                a.pick_value_score
              ) -
              Number(
                b.pick_value_score
              )
          )[0] ?? null,
      [
        selectedPlayers,
      ]
    );


  async function generateGrades():
    Promise<void> {
    if (
      !draft ||
      !isCommissioner
    ) {
      return;
    }


    if (
      draft.status !==
      "completed"
    ) {
      setIsError(true);

      setMessage(
        "The draft must be completed before grades are generated."
      );

      return;
    }


    const confirmed =
      teamGrades.length ===
      0
        ? true
        : window.confirm(
            "Regenerate Draft Grades for every team?"
          );


    if (
      !confirmed
    ) {
      return;
    }


    setGenerating(true);
    setMessage("");
    setIsError(false);


    try {
      const {
        data:
          sessionData,
        error:
          sessionError,
      } =
        await supabase.auth
          .getSession();


      const token =
        sessionData.session
          ?.access_token;


      if (
        sessionError ||
        !token
      ) {
        throw new Error(
          "Your login session has expired."
        );
      }


      const response =
        await fetch(
          `/api/draft/${draft.id}/grades`,
          {
            method: "POST",

            headers: {
              Authorization:
                `Bearer ${token}`,

              "Content-Type":
                "application/json",
            },
          }
        );


      const result =
        (
          await response.json()
        ) as GenerateResponse;


      if (
        !response.ok
      ) {
        throw new Error(
          result.error ??
          "Draft grades could not be generated."
        );
      }


      setMessage(
        `Draft Grades generated for ${
          result.generatedCount ??
          0
        } teams.`
      );


      await loadPage({
        showLoading: false,
      });
    } catch (error) {
      setIsError(true);

      setMessage(
        error instanceof Error
          ? error.message
          : "Draft grades could not be generated."
      );
    } finally {
      setGenerating(false);
    }
  }


  if (
    loading
  ) {
    return (
      <main className="g365-draft-grades-mobile"
        style={
          styles.page
        }
      >
      <style>{`
        @media (max-width: 760px) {
          .g365-draft-grades-mobile { overflow-x: hidden !important; }
          .g365-draft-grades-table-wrap {
            width: 100% !important;
            max-width: calc(100vw - 20px) !important;
            overflow-x: auto !important;
            overflow-y: hidden !important;
            -webkit-overflow-scrolling: touch;
            touch-action: pan-x pan-y;
            scrollbar-width: thin;
          }
          .g365-draft-grades-table-wrap table { min-width: 1050px !important; width: 1050px !important; }
          .g365-draft-grades-table-wrap th,
          .g365-draft-grades-table-wrap td { white-space: nowrap !important; }
        }
      `}</style>
        <div
          style={
            styles.loading
          }
        >
          Loading Draft Grades...
        </div>
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
        style={
          styles.container
        }
      >

        <header
          style={
            styles.header
          }
        >
          <div>
            <div
              style={
                styles.eyebrow
              }
            >
              GRIDIRON365 • DRAFT INTELLIGENCE
            </div>

            <h1
              style={
                styles.title
              }
            >
              Draft Grades
            </h1>

            <p
              style={
                styles.subtitle
              }
            >
              {league?.name ??
                "League"}{" "}
              • {league?.season}
            </p>
          </div>


          <div
            style={
              styles.actions
            }
          >
            <button
              type="button"
              onClick={() =>
                void loadPage({
                  showLoading: false,
                })
              }
              disabled={
                refreshing
              }
              style={
                styles.secondaryButton
              }
            >
              {refreshing
                ? "Refreshing..."
                : "Refresh"}
            </button>


            <Link
              href={`/league/${leagueId}/draft`}
              style={
                styles.secondaryLink
              }
            >
              Draft Room
            </Link>


            <Link
              href={`/league/${leagueId}`}
              style={
                styles.secondaryLink
              }
            >
              League Home
            </Link>


            {isCommissioner && (
              <button
                type="button"
                onClick={() =>
                  void generateGrades()
                }
                disabled={
                  generating ||
                  draft?.status !==
                    "completed"
                }
                style={{
                  ...styles.primaryButton,

                  opacity:
                    generating ||
                    draft?.status !==
                      "completed"
                      ? 0.55
                      : 1,
                }}
              >
                {generating
                  ? "Generating..."
                  : teamGrades.length >
                      0
                    ? "Generate Grades"
                    : "Generate Grades"}
              </button>
            )}
          </div>
        </header>


        {message && (
          <div
            style={
              isError
                ? styles.error
                : styles.success
            }
          >
            {message}
          </div>
        )}


        {draft?.status !==
          "completed" && (
          <section
            style={
              styles.notice
            }
          >
            Draft Grades becomes
            available after the draft is
            completed.
          </section>
        )}


        {teamGrades.length ===
        0 ? (
          <section
            style={
              styles.empty
            }
          >
            <h2
              style={
                styles.emptyTitle
              }
            >
              No grades yet
            </h2>

            <p
              style={
                styles.subtitle
              }
            >
              The commissioner can
              generate the complete
              100-point Draft Grades
              after the final pick.
            </p>
          </section>
        ) : (
          <>
            <section
              style={
                styles.leaderboard
              }
            >
              <div
                style={
                  styles.sectionHeader
                }
              >
                <div>
                  <div
                    style={
                      styles.eyebrow
                    }
                  >
                    LEAGUE RESULTS
                  </div>

                  <h2
                    style={
                      styles.sectionTitle
                    }
                  >
                    Draft Grade Rankings
                  </h2>
                </div>

                <div
                  style={
                    styles.muted
                  }
                >
                  {teamGrades.length}{" "}
                  teams
                </div>
              </div>


              <div
                style={
                  styles.teamGrid
                }
              >
                {teamGrades.map(
                  (
                    grade:
                      GradeTeam
                  ) => {
                    const selected =
                      grade.fantasy_team_id ===
                      selectedTeamId;

                    const mine =
                      grade.owner_id ===
                      currentUserId;


                    return (
                      <button
                        key={
                          grade.fantasy_team_id
                        }
                        type="button"
                        onClick={() =>
                          setSelectedTeamId(
                            grade.fantasy_team_id
                          )
                        }
                        style={{
                          ...styles.teamCard,

                          ...(selected
                            ? styles.teamCardSelected
                            : {}),
                        }}
                      >
                        <div
                          style={
                            styles.teamRank
                          }
                        >
                          #
                          {
                            grade.draft_grade_rank
                          }
                        </div>


                        <div
                          style={
                            styles.teamCardBody
                          }
                        >
                          <div
                            style={
                              styles.teamName
                            }
                          >
                            {
                              grade.team_name
                            }

                            {mine && (
                              <span
                                style={
                                  styles.you
                                }
                              >
                                YOU
                              </span>
                            )}
                          </div>


                          <div
                            style={
                              styles.teamScoreLine
                            }
                          >
                            <strong
                              style={
                                styles.smallGrade
                              }
                            >
                              {
                                grade.final_grade
                              }
                            </strong>

                            <span>
                              {formatNumber(
                                grade.final_score
                              )}
                              /100
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  }
                )}
              </div>
            </section>


            {selectedGrade && (
              <>
                <section
                  style={
                    styles.hero
                  }
                >
                  <div
                    style={
                      styles.gradePanel
                    }
                  >
                    <div
                      style={
                        styles.eyebrow
                      }
                    >
                      OVERALL DRAFT GRADE
                    </div>

                    <div
                      style={
                        styles.heroGrade
                      }
                    >
                      {
                        selectedGrade.final_grade
                      }
                    </div>

                    <div
                      style={
                        styles.heroScore
                      }
                    >
                      {formatNumber(
                        selectedGrade.final_score
                      )}

                      <span
                        style={
                          styles.heroScoreMax
                        }
                      >
                        /100
                      </span>
                    </div>

                    <div
                      style={
                        styles.rankBadge
                      }
                    >
                      League Rank #
                      {
                        selectedGrade.draft_grade_rank
                      }
                    </div>
                  </div>


                  <div
                    style={
                      styles.heroInfo
                    }
                  >
                    <div
                      style={
                        styles.eyebrow
                      }
                    >
                      TEAM ANALYSIS
                    </div>

                    <h2
                      style={
                        styles.heroTeam
                      }
                    >
                      {
                        selectedGrade.team_name
                      }
                    </h2>

                    <p
                      style={
                        styles.analysis
                      }
                    >
                      {buildAnalysis(
                        selectedGrade,
                        bestValue,
                        biggestReach
                      )}
                    </p>


                    <div
                      style={
                        styles.quickStats
                      }
                    >
                      <QuickStat
                        label="Starter Projection"
                        value={`${formatNumber(
                          selectedGrade
                            .projected_starter_points
                        )} pts`}
                      />

                      <QuickStat
                        label="Weekly Average"
                        value={formatNumber(
                          selectedGrade
                            .projected_weekly_average
                        )}
                      />

                      <QuickStat
                        label="Weekly Floor"
                        value={formatNumber(
                          selectedGrade
                            .projected_weekly_floor
                        )}
                      />

                      <QuickStat
                        label="Weekly Ceiling"
                        value={formatNumber(
                          selectedGrade
                            .projected_weekly_ceiling
                        )}
                      />

                      <QuickStat
                        label="Total VORP"
                        value={formatNumber(
                          selectedGrade
                            .total_vorp
                        )}
                      />

                      <QuickStat
                        label="Elite Positional Players"
                        value={String(
                          selectedGrade
                            .elite_position_players
                        )}
                      />
                    </div>
                  </div>
                </section>


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
                      <div
                        style={
                          styles.eyebrow
                        }
                      >
                        100-POINT MODEL
                      </div>

                      <h2
                        style={
                          styles.sectionTitle
                        }
                      >
                        Grade Breakdown
                      </h2>
                    </div>
                  </div>


                  <div
                    style={
                      styles.componentGrid
                    }
                  >
                    {COMPONENTS.map(
                      (
                        component
                      ) => {
                        const value =
                          Number(
                            selectedGrade[
                              component.key
                            ]
                          );


                        return (
                          <ComponentCard
                            key={
                              component.key
                            }
                            label={
                              component.label
                            }
                            value={
                              value
                            }
                            max={
                              component.max
                            }
                          />
                        );
                      }
                    )}
                  </div>
                </section>


                <section
                  style={
                    styles.twoColumn
                  }
                >
                  <ValueCard
                    title="Best Draft Value"
                    player={
                      bestValue
                    }
                    positive
                  />

                  <ValueCard
                    title="Biggest Reach"
                    player={
                      biggestReach
                    }
                  />
                </section>


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
                      <div
                        style={
                          styles.eyebrow
                        }
                      >
                        PICK-BY-PICK
                      </div>

                      <h2
                        style={
                          styles.sectionTitle
                        }
                      >
                        Draft Evaluation
                      </h2>
                    </div>

                    <div
                      style={
                        styles.muted
                      }
                    >
                      {
                        selectedPlayers.length
                      }{" "}
                      selections
                    </div>
                  </div>


                  <div
                    className="g365-draft-grades-table-wrap"
                    style={
                      styles.tableWrap
                    }
                  >
                    <table
                      style={
                        styles.table
                      }
                    >
                      <thead>
                        <tr>
                          <th
                            style={
                              styles.th
                            }
                          >
                            Pick
                          </th>

                          <th
                            style={
                              styles.th
                            }
                          >
                            Player
                          </th>

                          <th
                            style={
                              styles.th
                            }
                          >
                            Pos
                          </th>

                          <th
                            style={
                              styles.th
                            }
                          >
                            G365 Rank
                          </th>

                          <th
                            style={
                              styles.th
                            }
                          >
                            Pos Rank
                          </th>

                          <th
                            style={
                              styles.th
                            }
                          >
                            Season Proj.
                          </th>

                          <th
                            style={
                              styles.th
                            }
                          >
                            VORP
                          </th>

                          <th
                            style={
                              styles.th
                            }
                          >
                            Value Spots
                          </th>

                          <th
                            style={
                              styles.th
                            }
                          >
                            Value Score
                          </th>

                          <th
                            style={
                              styles.th
                            }
                          >
                            Grade
                          </th>
                        </tr>
                      </thead>


                      <tbody>
                        {selectedPlayers.map(
                          (
                            player:
                              GradePlayer
                          ) => (
                            <tr
                              key={
                                player.id
                              }
                            >
                              <td
                                style={
                                  styles.td
                                }
                              >
                                #
                                {
                                  player.actual_pick
                                }

                                <div
                                  style={
                                    styles.smallMuted
                                  }
                                >
                                  Rd{" "}
                                  {
                                    player.actual_round
                                  }
                                </div>
                              </td>


                              <td
                                style={
                                  styles.td
                                }
                              >
                                <strong>
                                  {
                                    player.full_name
                                  }
                                </strong>

                                <div
                                  style={
                                    styles.smallMuted
                                  }
                                >
                                  {
                                    player.team_abbreviation ??
                                    "NFL"
                                  }
                                </div>
                              </td>


                              <td
                                style={
                                  styles.td
                                }
                              >
                                {
                                  player.position
                                }
                              </td>


                              <td
                                style={
                                  styles.td
                                }
                              >
                                {player.g365_overall_rank ??
                                  "—"}
                              </td>


                              <td
                                style={
                                  styles.td
                                }
                              >
                                {player.g365_position_rank ??
                                  "—"}
                              </td>


                              <td
                                style={
                                  styles.td
                                }
                              >
                                {formatNumber(
                                  player.projected_season_points
                                )}
                              </td>


                              <td
                                style={
                                  styles.td
                                }
                              >
                                {formatNumber(
                                  player.vorp
                                )}
                              </td>


                              <td
                                style={
                                  styles.td
                                }
                              >
                                {formatSigned(
                                  player.draft_value_spots
                                )}
                              </td>


                              <td
                                style={
                                  styles.td
                                }
                              >
                                {formatSigned(
                                  player.pick_value_score
                                )}
                              </td>


                              <td
                                style={
                                  styles.td
                                }
                              >
                                <span
                                  style={
                                    getValueLabelStyle(
                                      player.pick_value_label
                                    )
                                  }
                                >
                                  {
                                    player.pick_value_label
                                  }
                                </span>
                              </td>
                            </tr>
                          )
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              </>
            )}
          </>
        )}
      </section>
    </main>
  );
}


function QuickStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div
      style={
        styles.quickStat
      }
    >
      <div
        style={
          styles.quickLabel
        }
      >
        {label}
      </div>

      <div
        style={
          styles.quickValue
        }
      >
        {value}
      </div>
    </div>
  );
}


function ComponentCard({
  label,
  value,
  max,
}: {
  label: string;
  value: number;
  max: number;
}) {
  const percent =
    max > 0
      ? Math.max(
          0,
          Math.min(
            100,
            (
              value /
              max
            ) *
              100
          )
        )
      : 0;


  return (
    <article
      style={
        styles.componentCard
      }
    >
      <div
        style={
          styles.componentHeader
        }
      >
        <span>
          {label}
        </span>

        <strong>
          {formatNumber(
            value
          )}

          <span
            style={
              styles.componentMax
            }
          >
            /{max}
          </span>
        </strong>
      </div>


      <div
        style={
          styles.progressTrack
        }
      >
        <div
          style={{
            ...styles.progressFill,

            width:
              `${percent}%`,
          }}
        />
      </div>
    </article>
  );
}


function ValueCard({
  title,
  player,
  positive = false,
}: {
  title: string;
  player:
    | GradePlayer
    | null;
  positive?: boolean;
}) {
  return (
    <article
      style={
        styles.valueCard
      }
    >
      <div
        style={
          styles.eyebrow
        }
      >
        {positive
          ? "VALUE CREATED"
          : "DRAFT COST"}
      </div>

      <h3
        style={
          styles.valueTitle
        }
      >
        {title}
      </h3>


      {!player ? (
        <div
          style={
            styles.muted
          }
        >
          No player data.
        </div>
      ) : (
        <>
          <div
            style={
              styles.valuePlayer
            }
          >
            {
              player.full_name
            }
          </div>

          <div
            style={
              styles.valueMeta
            }
          >
            {player.position}
            {" • "}
            Pick #
            {player.actual_pick}
            {" • "}
            G365 #
            {player.g365_overall_rank ??
              "—"}
          </div>

          <div
            style={
              styles.valueBottom
            }
          >
            <span
              style={
                getValueLabelStyle(
                  player.pick_value_label
                )
              }
            >
              {
                player.pick_value_label
              }
            </span>

            <strong>
              {formatSigned(
                player.pick_value_score
              )}
            </strong>
          </div>
        </>
      )}
    </article>
  );
}


function buildAnalysis(
  grade: GradeTeam,
  bestValue:
    | GradePlayer
    | null,
  biggestReach:
    | GradePlayer
    | null
): string {
  const components =
    COMPONENTS.map(
      (
        component
      ) => ({
        label:
          component.label,

        percent:
          Number(
            grade[
              component.key
            ]
          ) /
          component.max,
      })
    ).sort(
      (
        a,
        b
      ) =>
        b.percent -
        a.percent
    );


  const strongest =
    components[0]
      ?.label ??
    "overall roster quality";


  const weakest =
    components[
      components.length - 1
    ]?.label ??
    "draft efficiency";


  const valueText =
    bestValue
      ? `${bestValue.full_name} was the team's strongest value selection (${bestValue.pick_value_label}).`
      : "";


  const reachText =
    biggestReach &&
    Number(
      biggestReach.pick_value_score
    ) < 0
      ? ` The largest draft-cost concern was ${biggestReach.full_name} (${biggestReach.pick_value_label}).`
      : "";


  return (
    `${grade.team_name} earned a ${grade.final_grade} with a ${formatNumber(
      grade.final_score
    )}/100 Draft Grades. ` +
    `The team's strongest grading area was ${strongest}, while ${weakest} was the largest opportunity for improvement. ` +
    `The optimal projected starting lineup averages ${formatNumber(
      grade.projected_weekly_average
    )} points per week with ${formatNumber(
      grade.total_vorp
    )} total VORP. ` +
    valueText +
    reachText
  );
}


function formatNumber(
  value:
    | number
    | string
    | null
    | undefined
): string {
  const number =
    Number(value);


  if (
    !Number.isFinite(
      number
    )
  ) {
    return "0.00";
  }


  return number.toFixed(2);
}


function formatSigned(
  value:
    | number
    | string
    | null
    | undefined
): string {
  const number =
    Number(value);


  if (
    !Number.isFinite(
      number
    )
  ) {
    return "0.00";
  }


  if (
    number >
    0
  ) {
    return `+${number.toFixed(
      2
    )}`;
  }


  return number.toFixed(2);
}


function getValueLabelStyle(
  label: string
): CSSProperties {
  const positive =
    label.includes(
      "STEAL"
    ) ||
    label ===
      "GOOD VALUE" ||
    label ===
      "VALUE";


  const negative =
    label.includes(
      "REACH"
    );


  return {
    display:
      "inline-flex",

    alignItems:
      "center",

    borderRadius:
      "999px",

    padding:
      "5px 9px",

    fontSize:
      "10px",

    fontWeight:
      900,

    letterSpacing:
      "0.04em",

    color:
      positive
        ? "#78f5a5"
        : negative
          ? "#ff8e7f"
          : "#f5c76a",

    background:
      positive
        ? "rgba(34,197,94,.12)"
        : negative
          ? "rgba(239,68,68,.12)"
          : "rgba(245,158,11,.12)",

    border:
      positive
        ? "1px solid rgba(34,197,94,.30)"
        : negative
          ? "1px solid rgba(239,68,68,.30)"
          : "1px solid rgba(245,158,11,.30)",
  };
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
      "clamp(16px, 3vw, 32px)",

    background:
      "radial-gradient(circle at top right, rgba(255,83,0,.12), transparent 28%), radial-gradient(circle at top left, rgba(190,0,0,.10), transparent 25%), #090909",

    color:
      "#f8fafc",
  },


  container: {
    width:
      "min(1500px, 100%)",

    margin:
      "0 auto",

    display:
      "grid",

    gap:
      "20px",
  },


  loading: {
    width:
      "min(900px, 100%)",

    margin:
      "80px auto",

    padding:
      "30px",

    borderRadius:
      "18px",

    border:
      "1px solid #2b2b2b",

    background:
      "#111111",

    textAlign:
      "center",

    fontWeight:
      800,
  },


  header: {
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


  eyebrow: {
    color:
      "#ff6a00",

    fontSize:
      "11px",

    fontWeight:
      900,

    letterSpacing:
      "0.13em",
  },


  title: {
    margin:
      "5px 0 2px",

    fontSize:
      "clamp(30px, 5vw, 52px)",

    lineHeight:
      1,

    letterSpacing:
      "-0.04em",
  },


  subtitle: {
    margin:
      "7px 0 0",

    color:
      "#9ca3af",

    lineHeight:
      1.6,
  },


  actions: {
    display:
      "flex",

    gap:
      "9px",

    flexWrap:
      "wrap",
  },


  primaryButton: {
    minHeight:
      "42px",

    padding:
      "0 16px",

    borderRadius:
      "10px",

    border:
      "1px solid #ff6a00",

    background:
      "linear-gradient(135deg, #b91c1c, #ff6a00)",

    color:
      "#fff",

    fontWeight:
      900,

    cursor:
      "pointer",
  },


  secondaryButton: {
    minHeight:
      "42px",

    padding:
      "0 16px",

    borderRadius:
      "10px",

    border:
      "1px solid #363636",

    background:
      "#151515",

    color:
      "#fff",

    fontWeight:
      800,

    cursor:
      "pointer",
  },


  secondaryLink: {
    minHeight:
      "42px",

    padding:
      "0 16px",

    borderRadius:
      "10px",

    border:
      "1px solid #363636",

    background:
      "#151515",

    color:
      "#fff",

    fontWeight:
      800,

    textDecoration:
      "none",

    display:
      "inline-flex",

    alignItems:
      "center",
  },


  success: {
    padding:
      "12px 14px",

    borderRadius:
      "10px",

    border:
      "1px solid rgba(34,197,94,.35)",

    background:
      "rgba(34,197,94,.10)",

    color:
      "#91f2ae",

    fontWeight:
      700,
  },


  error: {
    padding:
      "12px 14px",

    borderRadius:
      "10px",

    border:
      "1px solid rgba(239,68,68,.35)",

    background:
      "rgba(239,68,68,.10)",

    color:
      "#ff9a90",

    fontWeight:
      700,
  },


  notice: {
    padding:
      "15px",

    borderRadius:
      "12px",

    border:
      "1px solid rgba(245,158,11,.30)",

    background:
      "rgba(245,158,11,.08)",

    color:
      "#ffd995",
  },


  empty: {
    padding:
      "50px 24px",

    borderRadius:
      "18px",

    border:
      "1px solid #2c2c2c",

    background:
      "#111111",

    textAlign:
      "center",
  },


  emptyTitle: {
    margin:
      0,

    fontSize:
      "25px",
  },


  leaderboard: {
    padding:
      "18px",

    borderRadius:
      "18px",

    border:
      "1px solid #292929",

    background:
      "rgba(17,17,17,.92)",
  },


  section: {
    padding:
      "18px",

    borderRadius:
      "18px",

    border:
      "1px solid #292929",

    background:
      "rgba(17,17,17,.92)",
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

    marginBottom:
      "15px",
  },


  sectionTitle: {
    margin:
      "4px 0 0",

    fontSize:
      "23px",
  },


  muted: {
    color:
      "#8b8b8b",
  },


  teamGrid: {
    display:
      "grid",

    gridTemplateColumns:
      "repeat(auto-fit, minmax(210px, 1fr))",

    gap:
      "9px",
  },


  teamCard: {
    appearance:
      "none",

    border:
      "1px solid #303030",

    borderRadius:
      "12px",

    padding:
      "12px",

    background:
      "#151515",

    color:
      "#fff",

    display:
      "flex",

    gap:
      "11px",

    textAlign:
      "left",

    cursor:
      "pointer",
  },


  teamCardSelected: {
    border:
      "1px solid #ff6a00",

    boxShadow:
      "0 0 0 1px rgba(255,106,0,.20)",

    background:
      "linear-gradient(135deg, rgba(185,28,28,.13), rgba(255,106,0,.08))",
  },


  teamRank: {
    width:
      "38px",

    height:
      "38px",

    flex:
      "0 0 38px",

    borderRadius:
      "10px",

    background:
      "#222",

    display:
      "grid",

    placeItems:
      "center",

    fontWeight:
      900,

    color:
      "#ff7a1a",
  },


  teamCardBody: {
    flex:
      1,

    minWidth:
      0,
  },


  teamName: {
    fontWeight:
      900,

    display:
      "flex",

    alignItems:
      "center",

    gap:
      "6px",
  },


  teamScoreLine: {
    marginTop:
      "5px",

    display:
      "flex",

    alignItems:
      "center",

    gap:
      "8px",

    color:
      "#a8a8a8",

    fontSize:
      "12px",
  },


  smallGrade: {
    color:
      "#fff",

    fontSize:
      "17px",
  },


  you: {
    padding:
      "2px 5px",

    borderRadius:
      "5px",

    fontSize:
      "8px",

    background:
      "rgba(255,106,0,.15)",

    border:
      "1px solid rgba(255,106,0,.35)",

    color:
      "#ff8a3d",
  },


  hero: {
    display:
      "grid",

    gridTemplateColumns:
      "minmax(200px, .65fr) minmax(0, 2fr)",

    gap:
      "16px",
  },


  gradePanel: {
    minHeight:
      "270px",

    borderRadius:
      "20px",

    padding:
      "22px",

    border:
      "1px solid rgba(255,106,0,.35)",

    background:
      "linear-gradient(145deg, rgba(120,0,0,.42), rgba(255,84,0,.16), #111)",

    display:
      "flex",

    flexDirection:
      "column",

    alignItems:
      "center",

    justifyContent:
      "center",

    textAlign:
      "center",
  },


  heroGrade: {
    marginTop:
      "8px",

    fontSize:
      "clamp(74px, 10vw, 118px)",

    lineHeight:
      0.9,

    fontWeight:
      1000,

    letterSpacing:
      "-0.07em",

    background:
      "linear-gradient(180deg, #fff 25%, #ff9b54 100%)",

    WebkitBackgroundClip:
      "text",

    color:
      "transparent",
  },


  heroScore: {
    marginTop:
      "13px",

    fontSize:
      "26px",

    fontWeight:
      900,
  },


  heroScoreMax: {
    color:
      "#777",

    fontSize:
      "14px",
  },


  rankBadge: {
    marginTop:
      "12px",

    padding:
      "7px 11px",

    borderRadius:
      "999px",

    background:
      "rgba(255,255,255,.06)",

    border:
      "1px solid #333",

    color:
      "#ccc",

    fontSize:
      "11px",

    fontWeight:
      900,
  },


  heroInfo: {
    borderRadius:
      "20px",

    padding:
      "22px",

    border:
      "1px solid #292929",

    background:
      "#111",
  },


  heroTeam: {
    margin:
      "5px 0 9px",

    fontSize:
      "clamp(27px, 4vw, 40px)",
  },


  analysis: {
    color:
      "#b7b7b7",

    lineHeight:
      1.7,

    margin:
      "0 0 18px",
  },


  quickStats: {
    display:
      "grid",

    gridTemplateColumns:
      "repeat(auto-fit, minmax(145px, 1fr))",

    gap:
      "9px",
  },


  quickStat: {
    padding:
      "12px",

    borderRadius:
      "11px",

    background:
      "#171717",

    border:
      "1px solid #292929",
  },


  quickLabel: {
    color:
      "#7f7f7f",

    fontSize:
      "10px",

    fontWeight:
      800,

    textTransform:
      "uppercase",
  },


  quickValue: {
    marginTop:
      "5px",

    fontWeight:
      900,

    fontSize:
      "17px",
  },


  componentGrid: {
    display:
      "grid",

    gridTemplateColumns:
      "repeat(auto-fit, minmax(250px, 1fr))",

    gap:
      "10px",
  },


  componentCard: {
    padding:
      "14px",

    borderRadius:
      "12px",

    background:
      "#161616",

    border:
      "1px solid #2b2b2b",
  },


  componentHeader: {
    display:
      "flex",

    justifyContent:
      "space-between",

    gap:
      "12px",

    fontSize:
      "13px",

    fontWeight:
      800,
  },


  componentMax: {
    color:
      "#727272",

    fontSize:
      "10px",
  },


  progressTrack: {
    height:
      "7px",

    marginTop:
      "11px",

    borderRadius:
      "999px",

    background:
      "#262626",

    overflow:
      "hidden",
  },


  progressFill: {
    height:
      "100%",

    borderRadius:
      "999px",

    background:
      "linear-gradient(90deg, #b91c1c, #ff6a00)",
  },


  twoColumn: {
    display:
      "grid",

    gridTemplateColumns:
      "repeat(auto-fit, minmax(280px, 1fr))",

    gap:
      "14px",
  },


  valueCard: {
    borderRadius:
      "16px",

    padding:
      "18px",

    border:
      "1px solid #292929",

    background:
      "#111",
  },


  valueTitle: {
    margin:
      "5px 0 15px",

    fontSize:
      "20px",
  },


  valuePlayer: {
    fontSize:
      "23px",

    fontWeight:
      900,
  },


  valueMeta: {
    marginTop:
      "5px",

    color:
      "#8e8e8e",

    fontSize:
      "12px",
  },


  valueBottom: {
    marginTop:
      "16px",

    display:
      "flex",

    justifyContent:
      "space-between",

    alignItems:
      "center",

    gap:
      "10px",
  },


  tableWrap: {
    width: "100%",
    maxWidth: "100%",
    overflowX: "auto",
    WebkitOverflowScrolling: "touch",

    borderRadius:
      "12px",

    border:
      "1px solid #292929",
  },


  table: {
    width:
      "100%",

    minWidth:
      "1000px",

    borderCollapse:
      "collapse",

    background:
      "#111",
  },


  th: {
    textAlign:
      "left",

    padding:
      "11px",

    color:
      "#8d8d8d",

    fontSize:
      "10px",

    textTransform:
      "uppercase",

    letterSpacing:
      ".05em",

    borderBottom:
      "1px solid #2a2a2a",

    background:
      "#161616",
  },


  td: {
    padding:
      "11px",

    borderBottom:
      "1px solid #202020",

    fontSize:
      "12px",

    whiteSpace:
      "nowrap",
  },


  smallMuted: {
    marginTop:
      "3px",

    color:
      "#707070",

    fontSize:
      "9px",
  },
};



