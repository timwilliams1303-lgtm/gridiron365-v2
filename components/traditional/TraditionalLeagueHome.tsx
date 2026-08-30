"use client";

import {
  type CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  useRouter,
} from "next/navigation";
import {
  createSupabaseBrowserClient,
} from "@/lib/supabase/browser";

type LeagueType =
  | "traditional"
  | "salary"
  | "nfl_playoffs";

type MemberRole =
  | "commissioner"
  | "co_commissioner"
  | "member";

type League = {
  id: string;
  name: string;
  league_type: LeagueType;
  season: number;
  commissioner_id: string;
  max_teams: number | null;
  salary_cap: number | null;
};

type Membership = {
  role: MemberRole;
  team_name: string;
};

type FantasyTeamSummary = {
  id: number;
  owner_id: string | null;
  team_name: string | null;
  active: boolean;
  is_cpu: boolean;
};

type Announcement = {
  id: string;
  title: string;
  body: string;
  is_pinned: boolean;
  created_at: string;
};

type PollRow = {
  id: string;
  question: string;
  status: "open" | "closed";
  is_pinned: boolean;
  show_results_before_close: boolean;
  closes_at: string | null;
  created_at: string;
};

type PollOptionRow = {
  id: string;
  poll_id: string;
  option_text: string;
  sort_order: number;
};

type PollVoteRow = {
  id: string;
  poll_id: string;
  option_id: string;
};

type PinnedPollOption = {
  id: string;
  optionText: string;
  voteCount: number;
  percentage: number;
};

type PinnedPoll = {
  id: string;
  question: string;
  closesAt: string | null;
  showResults: boolean;
  totalVotes: number;
  options: PinnedPollOption[];
};

type TraditionalLeagueHomeProps = {
  leagueId: string;
};

export default function TraditionalLeagueHome({
  leagueId,
}: TraditionalLeagueHomeProps) {
  const router = useRouter();

  const supabase = useMemo(
    () => createSupabaseBrowserClient(),
    []
  );

  const [league, setLeague] =
    useState<League | null>(null);

  const [membership, setMembership] =
    useState<Membership | null>(null);

  const [leagueTeams, setLeagueTeams] =
    useState<FantasyTeamSummary[]>([]);

  const [announcements, setAnnouncements] =
    useState<Announcement[]>([]);

  const [pinnedPoll, setPinnedPoll] =
    useState<PinnedPoll | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [message, setMessage] =
    useState("");

  const loadPinnedPoll = useCallback(
    async () => {
      const {
        data: pollData,
        error: pollError,
      } = await supabase
        .from("league_polls")
        .select(`
          id,
          question,
          status,
          is_pinned,
          show_results_before_close,
          closes_at,
          created_at
        `)
        .eq("league_id", leagueId)
        .eq("status", "open")
        .eq("is_pinned", true)
        .order("created_at", {
          ascending: false,
        })
        .limit(1)
        .maybeSingle();

      if (pollError) {
        throw new Error(
          pollError.message
        );
      }

      if (!pollData) {
        setPinnedPoll(null);
        return;
      }

      const poll =
        pollData as PollRow;

      if (
        poll.closes_at &&
        new Date(
          poll.closes_at
        ).getTime() <= Date.now()
      ) {
        setPinnedPoll(null);
        return;
      }

      const {
        data: optionData,
        error: optionError,
      } = await supabase
        .from("league_poll_options")
        .select(`
          id,
          poll_id,
          option_text,
          sort_order
        `)
        .eq("poll_id", poll.id)
        .order("sort_order", {
          ascending: true,
        });

      if (optionError) {
        throw new Error(
          optionError.message
        );
      }

      const {
        data: voteData,
        error: voteError,
      } = await supabase
        .from("league_poll_votes")
        .select(`
          id,
          poll_id,
          option_id
        `)
        .eq("poll_id", poll.id);

      if (voteError) {
        throw new Error(
          voteError.message
        );
      }

      const options =
        (optionData as
          | PollOptionRow[]
          | null) ?? [];

      const votes =
        (voteData as
          | PollVoteRow[]
          | null) ?? [];

      const resultsVisible =
        poll.show_results_before_close;

      const totalVotes =
        resultsVisible
          ? votes.length
          : 0;

      const normalizedOptions:
        PinnedPollOption[] =
        options.map((option) => {
          const voteCount =
            resultsVisible
              ? votes.filter(
                  (vote) =>
                    vote.option_id ===
                    option.id
                ).length
              : 0;

          const percentage =
            totalVotes > 0
              ? Math.round(
                  (voteCount /
                    totalVotes) *
                    100
                )
              : 0;

          return {
            id: option.id,
            optionText:
              option.option_text,
            voteCount,
            percentage,
          };
        });

      setPinnedPoll({
        id: poll.id,
        question: poll.question,
        closesAt: poll.closes_at,
        showResults:
          resultsVisible,
        totalVotes,
        options:
          normalizedOptions,
      });
    },
    [leagueId]
  );

  const loadLeague = useCallback(
    async () => {
      setLoading(true);
      setMessage("");

      try {
        const {
          data: { user },
          error: userError,
        } =
          await supabase.auth.getUser();

        if (
          userError ||
          !user
        ) {
          router.replace("/");
          return;
        }

        const {
          data: membershipData,
          error: membershipError,
        } = await supabase
          .from("league_members")
          .select(
            "role, team_name"
          )
          .eq(
            "league_id",
            leagueId
          )
          .eq(
            "user_id",
            user.id
          )
          .maybeSingle();

        if (membershipError) {
          throw new Error(
            membershipError.message
          );
        }

        /*
         * A user must be an actual member of this league
         * before the League Home page can be opened.
         *
         * If someone manually enters /league/[id] for a
         * league they do not belong to, send them back to
         * My Leagues instead of leaving them on an error
         * page.
         */
        if (!membershipData) {
          router.replace("/dashboard");
          return;
        }

        const {
          data: leagueData,
          error: leagueError,
        } = await supabase
          .from("leagues")
          .select(`
            id,
            name,
            league_type,
            season,
            commissioner_id,
            max_teams,
            salary_cap
          `)
          .eq("id", leagueId)
          .maybeSingle();

        if (
          leagueError ||
          !leagueData
        ) {
          throw new Error(
            leagueError?.message ??
              "The league could not be loaded."
          );
        }

        const {
          data: teamData,
          error: teamError,
        } = await supabase
          .from("fantasy_teams")
          .select(`
            id,
            owner_id,
            team_name,
            active,
            is_cpu
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
            "id",
            {
              ascending: true,
            }
          );

        if (teamError) {
          throw new Error(
            teamError.message
          );
        }

        const {
          data:
            announcementData,
          error:
            announcementError,
        } = await supabase
          .from(
            "league_announcements"
          )
          .select(`
            id,
            title,
            body,
            is_pinned,
            created_at
          `)
          .eq(
            "league_id",
            leagueId
          )
          .order(
            "is_pinned",
            {
              ascending: false,
            }
          )
          .order(
            "created_at",
            {
              ascending: false,
            }
          )
          .limit(5);

        if (
          announcementError
        ) {
          throw new Error(
            announcementError.message
          );
        }

        setMembership(
          membershipData as Membership
        );

        setLeague(
          leagueData as League
        );

        setLeagueTeams(
          (teamData as
            | FantasyTeamSummary[]
            | null) ?? []
        );

        setAnnouncements(
          (announcementData as
            | Announcement[]
            | null) ?? []
        );

        await loadPinnedPoll();
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : "The league could not be loaded."
        );
      } finally {
        setLoading(false);
      }
    },
    [
      leagueId,
      loadPinnedPoll,
      router,
    ]
  );

  useEffect(() => {
    if (!leagueId) {
      setMessage(
        "The league ID is missing."
      );
      setLoading(false);
      return;
    }

    void loadLeague();
  }, [
    leagueId,
    loadLeague,
  ]);

  useEffect(() => {
    if (!leagueId) {
      return;
    }

    const channel = supabase
      .channel(
        `league-home-${leagueId}`
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table:
            "league_announcements",
          filter:
            `league_id=eq.${leagueId}`,
        },
        () => {
          void loadLeague();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "league_polls",
          filter:
            `league_id=eq.${leagueId}`,
        },
        () => {
          void loadPinnedPoll();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table:
            "league_poll_options",
        },
        () => {
          void loadPinnedPoll();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table:
            "league_poll_votes",
        },
        () => {
          void loadPinnedPoll();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table:
            "fantasy_teams",
          filter:
            `league_id=eq.${leagueId}`,
        },
        () => {
          void loadLeague();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table:
            "league_members",
          filter:
            `league_id=eq.${leagueId}`,
        },
        () => {
          void loadLeague();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(
        channel
      );
    };
  }, [
    leagueId,
    loadLeague,
    loadPinnedPoll,
  ]);

  if (loading) {
    return (
      <main style={styles.page}>
        <section
          style={
            styles.loadingCard
          }
        >
          Loading league...
        </section>
      </main>
    );
  }

  if (
    !league ||
    !membership
  ) {
    return (
      <main style={styles.page}>
        <section
          style={styles.errorCard}
        >
          <p style={styles.error}>
            {message ||
              "The league could not be loaded."}
          </p>

          <button
            style={
              styles.secondaryButton
            }
            type="button"
            onClick={() =>
              router.push(
                "/dashboard"
              )
            }
          >
            Back to My Leagues
          </button>
        </section>
      </main>
    );
  }

  const isCommissioner =
    membership.role ===
      "commissioner" ||
    membership.role ===
      "co_commissioner";

  const humanTeams =
    leagueTeams.filter(
      (team) =>
        team.active &&
        Boolean(team.owner_id) &&
        team.is_cpu !== true
    ).length;

  const cpuTeams =
    leagueTeams.filter(
      (team) =>
        team.active &&
        team.is_cpu === true
    ).length;

  // Configured placeholder rows are not joined teams.
  // A Traditional spot is occupied only by a real owner or an actual CPU team.
  const teamsJoined =
    humanTeams + cpuTeams;

  const teamsRemaining =
    typeof league.max_teams ===
      "number"
      ? Math.max(
          league.max_teams -
            teamsJoined,
          0
        )
      : null;

  const leagueCapacityPercent =
    typeof league.max_teams ===
      "number" &&
    league.max_teams > 0
      ? Math.min(
          Math.max(
            (teamsJoined /
              league.max_teams) *
              100,
            0
          ),
          100
        )
      : 0;

  const leagueIsFull =
    typeof league.max_teams ===
      "number" &&
    league.max_teams > 0 &&
    teamsJoined >=
      league.max_teams;

  return (
    <main style={styles.page}>
      <section
        style={styles.container}
      >
        <header style={styles.header}>
          <p style={styles.eyebrow}>
            GRIDIRON365
          </p>

          <h1 style={styles.title}>
            {league.name}
          </h1>

          <p style={styles.muted}>
            {formatLeagueType(
              league.league_type
            )}
            {" · "}
            Season {league.season}
          </p>

          <div style={styles.badgeRow}>
            <span
              style={styles.teamBadge}
            >
              {membership.team_name}
            </span>

            {isCommissioner && (
              <span
                style={
                  styles.commissionerBadge
                }
              >
                Commissioner
              </span>
            )}
          </div>
        </header>

        <nav style={styles.tabs}>
          <button
            style={styles.tab}
            type="button"
            onClick={() =>
              router.back()
            }
          >
            ← Back
          </button>

          <button
            style={styles.tab}
            type="button"
            onClick={() =>
              router.push(
                "/dashboard"
              )
            }
          >
            My Leagues
          </button>

          <button
            style={styles.tab}
            type="button"
            onClick={() =>
              router.push(
                "/"
              )
            }
          >
            Account / Log Out
          </button>

          <button
            style={
              styles.activeTab
            }
            type="button"
          >
            Home
          </button>

          <button
            style={styles.tab}
            type="button"
            onClick={() =>
              router.push(
                `/league/${league.id}/chat`
              )
            }
          >
            Chat
          </button>

          <button
            style={styles.tab}
            type="button"
            onClick={() =>
              router.push(
                `/league/${league.id}/polls`
              )
            }
          >
            Polls
          </button>

          <button
            style={styles.tab}
            type="button"
            onClick={() =>
              router.push(
                `/league/${league.id}/team`
              )
            }
          >
            My Team
          </button>

          {league.league_type ===
            "traditional" && (
            <>
              <button
                style={styles.tab}
                type="button"
                onClick={() =>
                  router.push(
                    `/league/${league.id}/matchups`
                  )
                }
              >
                Matchups
              </button>

              <button
                style={styles.tab}
                type="button"
                onClick={() =>
                  router.push(
                    `/league/${league.id}/draft`
                  )
                }
              >
                Live Draft
              </button>

              <button
                style={styles.tab}
                type="button"
                onClick={() =>
                  router.push(
                    `/league/${league.id}/rankings`
                  )
                }
              >
                My Rankings
              </button>

              <button
                style={styles.tab}
                type="button"
                onClick={() =>
                  router.push(
                    `/league/${league.id}/waivers`
                  )
                }
              >
                Waivers
              </button>

              <button
                style={styles.tab}
                type="button"
                onClick={() =>
                  router.push(
                    `/league/${league.id}/trades`
                  )
                }
              >
                Trades
              </button>

              <button
                style={styles.tab}
                type="button"
                onClick={() =>
                  router.push(
                    `/league/${league.id}/playoffs`
                  )
                }
              >
                Playoffs
              </button>
            </>
          )}

          {league.league_type !==
            "traditional" && (
            <button
              style={styles.tab}
              type="button"
              onClick={() =>
                router.push(
                  `/league/${league.id}/player-picker`
                )
              }
            >
              Player Picker
            </button>
          )}

          <button
            style={styles.tab}
            type="button"
            onClick={() =>
              router.push(
                `/league/${league.id}/standings`
              )
            }
          >
            Standings
          </button>

          <button
            style={styles.tab}
            type="button"
            onClick={() =>
              router.push(
                `/league/${league.id}/settings`
              )
            }
          >
            League Settings
          </button>

          {isCommissioner && (
            <button
              style={styles.tab}
              type="button"
              onClick={() =>
                router.push(
                  `/league/${league.id}/commissioner`
                )
              }
            >
              Commissioner
            </button>
          )}
        </nav>

        {league.league_type ===
        "traditional" ? (
          <section
            style={
              styles.leagueOverviewCard
            }
          >
            <div
              style={
                styles.leagueOverviewHeader
              }
            >
              <div>
                <p
                  style={
                    styles.leagueOverviewEyebrow
                  }
                >
                  LEAGUE OVERVIEW
                </p>

                <h2
                  style={
                    styles.leagueOverviewTitle
                  }
                >
                  {formatLeagueType(
                    league.league_type
                  )}
                </h2>
              </div>

              <div
                style={{
                  ...styles.leagueStatusBadge,
                  ...(leagueIsFull
                    ? styles.leagueStatusBadgeFull
                    : {}),
                }}
              >
                <span
                  style={{
                    ...styles.leagueStatusDot,
                    ...(leagueIsFull
                      ? styles.leagueStatusDotFull
                      : {}),
                  }}
                />

                {leagueIsFull
                  ? "LEAGUE FULL"
                  : "OPEN"}
              </div>
            </div>

            <div
              style={
                styles.leagueYourTeam
              }
            >
              <p
                style={
                  styles.leagueSectionLabel
                }
              >
                YOUR TEAM
              </p>

              <div
                style={
                  styles.leagueTeamName
                }
              >
                {membership.team_name}
              </div>
            </div>

            <div
              style={
                styles.leagueStatsGrid
              }
            >
              <article
                style={
                  styles.leagueStatCard
                }
              >
                <p
                  style={
                    styles.leagueStatLabel
                  }
                >
                  MAX TEAMS
                </p>

                <div
                  style={
                    styles.leagueStatValue
                  }
                >
                  {league.max_teams ??
                    "Custom"}
                </div>
              </article>

              <article
                style={
                  styles.leagueStatCard
                }
              >
                <p
                  style={
                    styles.leagueStatLabel
                  }
                >
                  TEAMS JOINED
                </p>

                <div
                  style={
                    styles.leagueStatValueRow
                  }
                >
                  <span
                    style={
                      styles.leagueStatValue
                    }
                  >
                    {teamsJoined}
                  </span>

                  {league.max_teams !==
                  null ? (
                    <span
                      style={
                        styles.leagueStatTotal
                      }
                    >
                      / {league.max_teams}
                    </span>
                  ) : null}
                </div>

                <div
                  style={
                    styles.leagueTeamBreakdown
                  }
                >
                  <span>
                    {humanTeams}{" "}
                    {humanTeams === 1
                      ? "Human"
                      : "Humans"}
                  </span>

                  {cpuTeams > 0 ? (
                    <>
                      <span
                        style={
                          styles.leagueBreakdownDot
                        }
                      >
                        •
                      </span>

                      <span>
                        {cpuTeams} CPU/AI
                      </span>
                    </>
                  ) : null}
                </div>
              </article>

              <article
                style={
                  styles.leagueStatCard
                }
              >
                <p
                  style={
                    styles.leagueStatLabel
                  }
                >
                  OPEN TEAM SPOTS
                </p>

                <div
                  style={
                    styles.leagueStatValue
                  }
                >
                  {teamsRemaining ??
                    "—"}
                </div>
              </article>
            </div>

            {league.max_teams !==
            null ? (
              <div
                style={
                  styles.leagueCapacitySection
                }
              >
                <div
                  style={
                    styles.leagueCapacityHeader
                  }
                >
                  <span>
                    LEAGUE CAPACITY
                  </span>

                  <span
                    style={
                      styles.leagueCapacityCount
                    }
                  >
                    {teamsJoined} of{" "}
                    {league.max_teams}
                  </span>
                </div>

                <div
                  style={
                    styles.leagueCapacityTrack
                  }
                >
                  <div
                    style={{
                      ...styles.leagueCapacityFill,
                      width:
                        `${leagueCapacityPercent}%`,
                    }}
                  />
                </div>

                <div
                  style={
                    styles.leagueCapacityFooter
                  }
                >
                  <span>
                    {humanTeams} Human
                  </span>

                  <span>
                    {cpuTeams} CPU/AI
                  </span>

                  <span>
                    {teamsRemaining ?? 0} Open
                  </span>
                </div>
              </div>
            ) : null}
          </section>
        ) : (
          <section
            style={styles.grid}
          >
            <SummaryCard
              label="LEAGUE FORMAT"
              value={formatLeagueType(
                league.league_type
              )}
            />

            <SummaryCard
              label="YOUR TEAM"
              value={
                membership.team_name
              }
            />

            <SummaryCard
              label="MAXIMUM TEAMS"
              value={
                league.max_teams !==
                null
                  ? String(
                      league.max_teams
                    )
                  : "Custom"
              }
            />

            <SummaryCard
              label="TEAMS JOINED"
              value={
                league.max_teams !==
                null
                  ? `${teamsJoined} of ${league.max_teams}`
                  : String(
                      teamsJoined
                    )
              }
            />

            {teamsRemaining !==
              null && (
              <SummaryCard
                label="OPEN TEAM SPOTS"
                value={String(
                  teamsRemaining
                )}
              />
            )}

            <SummaryCard
              label="STARTING SALARY"
              value={`$${(
                league.salary_cap ??
                0
              ).toLocaleString()}`}
            />
          </section>
        )}

        {pinnedPoll && (
          <section
            style={
              styles.pinnedPollSection
            }
          >
            <div
              style={
                styles.sectionHeader
              }
            >
              <div>
                <p
                  style={
                    styles.sectionLabel
                  }
                >
                  ACTIVE LEAGUE POLL
                </p>

                <h2
                  style={
                    styles.sectionTitle
                  }
                >
                  Pinned Poll
                </h2>
              </div>

              <span
                style={
                  styles.openPollBadge
                }
              >
                OPEN
              </span>
            </div>

            <article
              style={
                styles.pinnedPollCard
              }
            >
              <h3
                style={
                  styles.pollQuestion
                }
              >
                {
                  pinnedPoll.question
                }
              </h3>

              {pinnedPoll.closesAt && (
                <p
                  style={
                    styles.pollCloseText
                  }
                >
                  Closes{" "}
                  {formatDateTime(
                    pinnedPoll.closesAt
                  )}
                </p>
              )}

              <div
                style={
                  styles.pollOptionList
                }
              >
                {pinnedPoll.options.map(
                  (option) => (
                    <div
                      key={option.id}
                      style={
                        styles.pollOption
                      }
                    >
                      <div
                        style={
                          styles.pollOptionTop
                        }
                      >
                        <span>
                          {
                            option.optionText
                          }
                        </span>

                        {pinnedPoll.showResults && (
                          <strong>
                            {
                              option.voteCount
                            }
                            {" · "}
                            {
                              option.percentage
                            }
                            %
                          </strong>
                        )}
                      </div>

                      {pinnedPoll.showResults && (
                        <div
                          style={
                            styles.progressTrack
                          }
                        >
                          <div
                            style={{
                              ...styles.progressFill,
                              width:
                                `${option.percentage}%`,
                            }}
                          />
                        </div>
                      )}
                    </div>
                  )
                )}
              </div>

              {pinnedPoll.showResults ? (
                <p
                  style={
                    styles.pollTotalText
                  }
                >
                  {
                    pinnedPoll.totalVotes
                  }{" "}
                  {pinnedPoll.totalVotes ===
                  1
                    ? "vote"
                    : "votes"}
                </p>
              ) : (
                <p
                  style={
                    styles.pollHiddenText
                  }
                >
                  Results are hidden
                  until the poll closes.
                </p>
              )}

              <button
                style={
                  styles.primaryButton
                }
                type="button"
                onClick={() =>
                  router.push(
                    `/league/${league.id}/polls`
                  )
                }
              >
                View Poll and Vote
              </button>
            </article>
          </section>
        )}

        <section
          style={
            styles.quickActionsSection
          }
        >
          <p
            style={
              styles.sectionLabel
            }
          >
            LEAGUE ACTIVITY
          </p>

          <h2
            style={
              styles.sectionTitle
            }
          >
            Quick Access
          </h2>

          <div
            style={
              styles.quickActionsGrid
            }
          >
            <button
              style={
                styles.quickActionCard
              }
              type="button"
              onClick={() =>
                router.push(
                  `/league/${league.id}/chat`
                )
              }
            >
              <span
                style={
                  styles.quickActionTitle
                }
              >
                League Chat
              </span>

              <span
                style={
                  styles.quickActionText
                }
              >
                Talk with league
                members.
              </span>
            </button>

            <button
              style={
                styles.quickActionCard
              }
              type="button"
              onClick={() =>
                router.push(
                  `/league/${league.id}/polls`
                )
              }
            >
              <span
                style={
                  styles.quickActionTitle
                }
              >
                League Polls
              </span>

              <span
                style={
                  styles.quickActionText
                }
              >
                Vote on league
                decisions.
              </span>
            </button>

            <button
              style={
                styles.quickActionCard
              }
              type="button"
              onClick={() =>
                router.push(
                  `/league/${league.id}/standings`
                )
              }
            >
              <span
                style={
                  styles.quickActionTitle
                }
              >
                Standings
              </span>

              <span
                style={
                  styles.quickActionText
                }
              >
                View league rankings
                and results.
              </span>
            </button>

            {isCommissioner && (
              <button
                style={
                  styles.quickActionCard
                }
                type="button"
                onClick={() =>
                  router.push(
                    `/league/${league.id}/commissioner`
                  )
                }
              >
                <span
                  style={
                    styles.quickActionTitle
                  }
                >
                  Commissioner Tools
                </span>

                <span
                  style={
                    styles.quickActionText
                  }
                >
                  Manage league
                  settings and members.
                </span>
              </button>
            )}
          </div>
        </section>

        <section
          style={
            styles.announcementsSection
          }
        >
          <div
            style={
              styles.sectionHeader
            }
          >
            <div>
              <p
                style={
                  styles.sectionLabel
                }
              >
                LEAGUE UPDATES
              </p>

              <h2
                style={
                  styles.sectionTitle
                }
              >
                Announcements
              </h2>
            </div>

            {isCommissioner && (
              <button
                style={
                  styles.manageButton
                }
                type="button"
                onClick={() =>
                  router.push(
                    `/league/${league.id}/commissioner/announcements`
                  )
                }
              >
                Manage Announcements
              </button>
            )}
          </div>

          {announcements.length ===
          0 ? (
            <article
              style={
                styles.emptyAnnouncementCard
              }
            >
              <p style={styles.muted}>
                No league announcements
                have been posted yet.
              </p>
            </article>
          ) : (
            <div
              style={
                styles.announcementList
              }
            >
              {announcements.map(
                (announcement) => (
                  <article
                    key={
                      announcement.id
                    }
                    style={
                      announcement.is_pinned
                        ? styles.pinnedAnnouncement
                        : styles.announcement
                    }
                  >
                    <div
                      style={
                        styles.announcementMeta
                      }
                    >
                      {announcement.is_pinned && (
                        <span
                          style={
                            styles.pinnedBadge
                          }
                        >
                          PINNED
                        </span>
                      )}

                      <span
                        style={
                          styles.dateBadge
                        }
                      >
                        {formatDate(
                          announcement.created_at
                        )}
                      </span>
                    </div>

                    <h3
                      style={
                        styles.announcementTitle
                      }
                    >
                      {
                        announcement.title
                      }
                    </h3>

                    <p
                      style={
                        styles.announcementBody
                      }
                    >
                      {
                        announcement.body
                      }
                    </p>
                  </article>
                )
              )}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <article style={styles.card}>
      <p style={styles.label}>
        {label}
      </p>

      <h2 style={styles.cardValue}>
        {value}
      </h2>
    </article>
  );
}

function formatLeagueType(
  type: LeagueType
) {
  if (type === "traditional") {
    return "Traditional Draft";
  }

  if (type === "salary") {
    return "Season-Long Salary Cap";
  }

  return "NFL Fantasy Playoffs";
}

function formatDate(
  value: string
) {
  const date = new Date(value);

  if (
    Number.isNaN(date.getTime())
  ) {
    return "Unknown date";
  }

  return date.toLocaleDateString(
    undefined,
    {
      year: "numeric",
      month: "short",
      day: "numeric",
    }
  );
}

function formatDateTime(
  value: string
) {
  const date = new Date(value);

  if (
    Number.isNaN(date.getTime())
  ) {
    return "Unknown date";
  }

  return date.toLocaleString(
    undefined,
    {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    padding: "28px",
    background: "transparent",
    color: "#ffffff",
    fontFamily: "Arial, sans-serif",
  },

  container: {
    width: "100%",
    maxWidth: "1180px",
    margin: "0 auto",
  },

  header: {
    marginBottom: "24px",
  },

  eyebrow: {
    margin: 0,
    color: "#e2e8f0",
    fontWeight: 900,
    letterSpacing: "0.08em",
    textShadow: "0 2px 5px rgba(0,0,0,0.9)",
  },

  title: {
    margin: "8px 0",
    color: "#ffffff",
    textShadow: "0 2px 7px rgba(0,0,0,0.95)",
  },

  muted: {
    margin: 0,
    color: "#cbd5e1",
    lineHeight: 1.6,
  },

  badgeRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
    marginTop: "12px",
  },

  teamBadge: {
    padding: "7px 11px",
    borderRadius: "999px",
    border: "1px solid rgba(148,163,184,0.35)",
    background: "rgba(30,41,59,0.94)",
    color: "#ffffff",
    fontSize: "12px",
    fontWeight: 800,
  },

  commissionerBadge: {
    padding: "7px 11px",
    borderRadius: "999px",
    border: "1px solid rgba(250,204,21,0.42)",
    background: "rgba(69,49,10,0.90)",
    color: "#fde68a",
    fontSize: "12px",
    fontWeight: 900,
  },

  /* =========================================================
     NAVIGATION
     ========================================================= */

  tabs: {
    display: "flex",
    gap: "8px",
    overflowX: "auto",
    padding: "10px",
    marginBottom: "24px",

    border: "1px solid rgba(148,163,184,0.24)",
    borderRadius: "12px",

    background: "rgba(5,9,13,0.94)",

    boxShadow: "0 12px 30px rgba(0,0,0,0.32)",
  },

  tab: {
    flexShrink: 0,

    padding: "11px 15px",

    borderRadius: "9px",

    border: "1px solid rgba(148,163,184,0.34)",

    background:
      "linear-gradient(180deg, #222b34 0%, #12181e 100%)",

    color: "#f1f5f9",

    fontWeight: 800,

    cursor: "pointer",

    whiteSpace: "nowrap",

    boxShadow:
      "inset 0 1px 0 rgba(255,255,255,0.035)",
  },

  /*
   * THIS IS THE IMPORTANT FIX.
   *
   * The active tab is NO LONGER filled bright green.
   *
   * Graphite background
   * White wording
   * Thin green outline
   */
  activeTab: {
    flexShrink: 0,

    padding: "11px 15px",

    borderRadius: "9px",

    border: "2px solid #65ff64",

    background:
      "linear-gradient(180deg, #343f49 0%, #1a2229 100%)",

    color: "#ffffff",

    fontWeight: 900,

    whiteSpace: "nowrap",

    cursor: "default",

    boxShadow:
      "0 0 0 1px rgba(101,255,100,0.10), 0 0 14px rgba(101,255,100,0.20), inset 0 1px 0 rgba(255,255,255,0.08)",

    textShadow:
      "0 1px 3px rgba(0,0,0,0.95)",
  },

  /* =========================================================
     SUMMARY CARDS
     ========================================================= */

  grid: {
    display: "grid",

    gridTemplateColumns:
      "repeat(auto-fit, minmax(210px, 1fr))",

    gap: "16px",
  },

  card: {
    padding: "24px",

    borderRadius: "14px",

    border:
      "1px solid rgba(148,163,184,0.30)",

    background:
      "linear-gradient(145deg, rgba(25,32,40,0.95), rgba(8,12,16,0.97))",

    boxShadow:
      "0 12px 30px rgba(0,0,0,0.34)",

    backdropFilter: "blur(12px)",
  },

  label: {
    margin: 0,

    color: "#d7dee5",

    fontSize: "12px",

    fontWeight: 900,

    letterSpacing: "0.04em",
  },

  cardValue: {
    margin: "8px 0 0",

    color: "#ffffff",

    fontSize: "20px",

    textShadow:
      "0 2px 5px rgba(0,0,0,0.75)",
  },

  /* =========================================================
     LEAGUE OVERVIEW
     ========================================================= */

  leagueOverviewCard: {
    width: "100%",
    boxSizing: "border-box",
    padding: "24px",
    borderRadius: "20px",
    border:
      "1px solid rgba(34,197,94,0.28)",
    background:
      "linear-gradient(145deg, rgba(3,22,17,0.94) 0%, rgba(3,13,17,0.94) 100%)",
    boxShadow:
      "0 20px 50px rgba(0,0,0,0.30)",
    backdropFilter: "blur(10px)",
    overflow: "hidden",
  },

  leagueOverviewHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent:
      "space-between",
    flexWrap: "wrap",
    gap: "18px",
    paddingBottom: "20px",
    borderBottom:
      "1px solid rgba(255,255,255,0.08)",
  },

  leagueOverviewEyebrow: {
    margin: "0 0 7px",
    color: "#22d3ee",
    fontSize: "11px",
    fontWeight: 900,
    letterSpacing: "1.5px",
  },

  leagueOverviewTitle: {
    margin: 0,
    color: "#ffffff",
    fontSize:
      "clamp(23px, 4vw, 29px)",
    fontWeight: 900,
    lineHeight: 1.15,
  },

  leagueStatusBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: "7px",
    padding: "7px 11px",
    border:
      "1px solid rgba(34,197,94,0.34)",
    borderRadius: "999px",
    background:
      "rgba(34,197,94,0.10)",
    color: "#86efac",
    fontSize: "10px",
    fontWeight: 900,
    letterSpacing: "0.9px",
    whiteSpace: "nowrap",
  },

  leagueStatusBadgeFull: {
    border:
      "1px solid rgba(34,211,238,0.34)",
    background:
      "rgba(34,211,238,0.10)",
    color: "#67e8f9",
  },

  leagueStatusDot: {
    width: "7px",
    height: "7px",
    borderRadius: "50%",
    background: "#22c55e",
    boxShadow:
      "0 0 10px rgba(34,197,94,0.75)",
  },

  leagueStatusDotFull: {
    background: "#22d3ee",
    boxShadow:
      "0 0 10px rgba(34,211,238,0.75)",
  },

  leagueYourTeam: {
    paddingTop: "20px",
    paddingBottom: "20px",
  },

  leagueSectionLabel: {
    margin: "0 0 7px",
    color:
      "rgba(255,255,255,0.50)",
    fontSize: "11px",
    fontWeight: 800,
    letterSpacing: "1.2px",
  },

  leagueTeamName: {
    color: "#ffffff",
    fontSize:
      "clamp(20px, 3.5vw, 24px)",
    fontWeight: 900,
    lineHeight: 1.2,
  },

  leagueStatsGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "12px",
  },

  leagueStatCard: {
    minWidth: 0,
    minHeight: "112px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    padding: "17px",
    border:
      "1px solid rgba(34,197,94,0.18)",
    borderRadius: "15px",
    background:
      "linear-gradient(145deg, rgba(0,0,0,0.27), rgba(5,30,24,0.22))",
    boxShadow:
      "inset 0 1px 0 rgba(255,255,255,0.025)",
  },

  leagueStatLabel: {
    margin: "0 0 9px",
    color:
      "rgba(255,255,255,0.48)",
    fontSize: "10px",
    fontWeight: 900,
    letterSpacing: "1px",
  },

  leagueStatValueRow: {
    display: "flex",
    alignItems: "baseline",
    gap: "5px",
  },

  leagueStatValue: {
    color: "#ffffff",
    fontSize: "30px",
    fontWeight: 900,
    lineHeight: 1,
  },

  leagueStatTotal: {
    color:
      "rgba(255,255,255,0.42)",
    fontSize: "16px",
    fontWeight: 800,
  },

  leagueTeamBreakdown: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "6px",
    marginTop: "10px",
    color:
      "rgba(255,255,255,0.48)",
    fontSize: "10px",
    fontWeight: 700,
  },

  leagueBreakdownDot: {
    color:
      "rgba(34,211,238,0.75)",
  },

  leagueCapacitySection: {
    marginTop: "20px",
    paddingTop: "18px",
    borderTop:
      "1px solid rgba(255,255,255,0.08)",
  },

  leagueCapacityHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent:
      "space-between",
    gap: "16px",
    marginBottom: "10px",
    color:
      "rgba(255,255,255,0.52)",
    fontSize: "10px",
    fontWeight: 900,
    letterSpacing: "1px",
  },

  leagueCapacityCount: {
    color:
      "rgba(255,255,255,0.72)",
    letterSpacing: "0",
  },

  leagueCapacityTrack: {
    width: "100%",
    height: "9px",
    overflow: "hidden",
    borderRadius: "999px",
    background:
      "rgba(255,255,255,0.08)",
    boxShadow:
      "inset 0 1px 3px rgba(0,0,0,0.35)",
  },

  leagueCapacityFill: {
    height: "100%",
    minWidth: "0",
    borderRadius: "999px",
    background:
      "linear-gradient(90deg, #22c55e 0%, #22d3ee 100%)",
    boxShadow:
      "0 0 12px rgba(34,211,238,0.30)",
    transition:
      "width 250ms ease",
  },

  leagueCapacityFooter: {
    display: "flex",
    alignItems: "center",
    justifyContent:
      "space-between",
    flexWrap: "wrap",
    gap: "12px",
    marginTop: "9px",
    color:
      "rgba(255,255,255,0.42)",
    fontSize: "10px",
    fontWeight: 700,
  },

  /* =========================================================
     PINNED POLL
     ========================================================= */

  pinnedPollSection: {
    marginTop: "32px",
  },

  sectionHeader: {
    display: "flex",

    justifyContent: "space-between",

    alignItems: "center",

    gap: "16px",

    marginBottom: "14px",

    flexWrap: "wrap",
  },

  sectionLabel: {
    margin: 0,

    color: "#dce3e8",

    fontSize: "12px",

    fontWeight: 900,

    letterSpacing: "0.08em",

    textShadow:
      "0 2px 4px rgba(0,0,0,0.8)",
  },

  sectionTitle: {
    margin: "7px 0 0",

    color: "#ffffff",
  },

  openPollBadge: {
    padding: "6px 10px",

    borderRadius: "999px",

    border:
      "1px solid rgba(250,204,21,0.48)",

    background:
      "rgba(69,49,10,0.88)",

    color: "#fde68a",

    fontSize: "11px",

    fontWeight: 900,
  },

  pinnedPollCard: {
    padding: "24px",

    borderRadius: "14px",

    border:
      "1px solid rgba(148,163,184,0.34)",

    background:
      "linear-gradient(145deg, rgba(30,41,59,0.96), rgba(10,15,22,0.97))",

    boxShadow:
      "0 14px 34px rgba(0,0,0,0.36)",

    backdropFilter: "blur(12px)",
  },

  pollQuestion: {
    margin: 0,

    color: "#ffffff",

    fontSize: "23px",

    lineHeight: 1.35,
  },

  pollCloseText: {
    margin: "9px 0 0",

    color: "#aeb8c0",

    fontSize: "12px",
  },

  pollOptionList: {
    display: "grid",

    gap: "10px",

    marginTop: "20px",
  },

  pollOption: {
    display: "grid",

    gap: "8px",

    padding: "13px",

    borderRadius: "10px",

    border:
      "1px solid rgba(148,163,184,0.30)",

    background:
      "rgba(8,12,17,0.94)",
  },

  pollOptionTop: {
    display: "flex",

    justifyContent: "space-between",

    alignItems: "center",

    gap: "12px",
  },

  progressTrack: {
    height: "8px",

    overflow: "hidden",

    borderRadius: "999px",

    background: "#28323c",
  },

  progressFill: {
    height: "100%",

    borderRadius: "999px",

    background:
      "linear-gradient(90deg, #60a5fa, #93c5fd)",
  },

  pollTotalText: {
    margin: "15px 0 0",

    color: "#cbd5e1",

    fontSize: "13px",
  },

  pollHiddenText: {
    margin: "15px 0 0",

    color: "#fde68a",

    fontSize: "13px",
  },

  primaryButton: {
    width: "100%",

    marginTop: "18px",

    padding: "14px",

    border:
      "1px solid rgba(96,165,250,0.65)",

    borderRadius: "10px",

    background:
      "linear-gradient(180deg, #2563a6 0%, #1e4778 100%)",

    color: "#ffffff",

    fontSize: "16px",

    fontWeight: 900,

    cursor: "pointer",

    boxShadow:
      "0 8px 20px rgba(0,0,0,0.26)",
  },

  /* =========================================================
     QUICK ACCESS
     ========================================================= */

  quickActionsSection: {
    marginTop: "32px",
  },

  quickActionsGrid: {
    display: "grid",

    gridTemplateColumns:
      "repeat(auto-fit, minmax(230px, 1fr))",

    gap: "14px",

    marginTop: "14px",
  },

  quickActionCard: {
    display: "grid",

    gap: "8px",

    padding: "20px",

    borderRadius: "14px",

    border:
      "1px solid rgba(148,163,184,0.30)",

    background:
      "linear-gradient(145deg, rgba(26,33,42,0.95), rgba(8,12,17,0.97))",

    color: "#ffffff",

    textAlign: "left",

    cursor: "pointer",

    boxShadow:
      "0 12px 28px rgba(0,0,0,0.32)",

    backdropFilter: "blur(12px)",
  },

  quickActionTitle: {
    color: "#ffffff",

    fontSize: "17px",

    fontWeight: 900,
  },

  quickActionText: {
    color: "#cbd5e1",

    lineHeight: 1.5,
  },

  /* =========================================================
     ANNOUNCEMENTS
     ========================================================= */

  announcementsSection: {
    marginTop: "32px",
  },

  manageButton: {
    padding: "11px 14px",

    borderRadius: "9px",

    border:
      "1px solid rgba(148,163,184,0.34)",

    background:
      "linear-gradient(180deg, #252f39, #12181e)",

    color: "#ffffff",

    fontWeight: 800,

    cursor: "pointer",
  },

  announcementList: {
    display: "grid",

    gap: "14px",
  },

  announcement: {
    padding: "22px",

    borderRadius: "14px",

    border:
      "1px solid rgba(148,163,184,0.30)",

    background:
      "linear-gradient(145deg, rgba(26,33,42,0.95), rgba(8,12,17,0.97))",

    boxShadow:
      "0 12px 28px rgba(0,0,0,0.30)",
  },

  pinnedAnnouncement: {
    padding: "22px",

    borderRadius: "14px",

    border:
      "1px solid rgba(250,204,21,0.40)",

    background:
      "linear-gradient(145deg, rgba(50,42,16,0.95), rgba(15,15,13,0.97))",

    boxShadow:
      "0 12px 28px rgba(0,0,0,0.30)",
  },

  announcementMeta: {
    display: "flex",

    flexWrap: "wrap",

    gap: "7px",
  },

  pinnedBadge: {
    padding: "5px 8px",

    borderRadius: "999px",

    background:
      "rgba(250,204,21,0.15)",

    border:
      "1px solid rgba(250,204,21,0.30)",

    color: "#fde68a",

    fontSize: "11px",

    fontWeight: 900,
  },

  dateBadge: {
    padding: "5px 8px",

    borderRadius: "999px",

    background: "#26313b",

    color: "#dce3e8",

    fontSize: "11px",

    fontWeight: 800,
  },

  announcementTitle: {
    margin: "13px 0 8px",

    color: "#ffffff",
  },

  announcementBody: {
    margin: 0,

    color: "#d7dee5",

    lineHeight: 1.7,

    whiteSpace: "pre-wrap",

    overflowWrap: "anywhere",
  },

  emptyAnnouncementCard: {
    padding: "22px",

    borderRadius: "14px",

    border:
      "1px solid rgba(148,163,184,0.30)",

    background:
      "linear-gradient(145deg, rgba(26,33,42,0.95), rgba(8,12,17,0.97))",
  },

  /* =========================================================
     LOADING / ERROR
     ========================================================= */

  loadingCard: {
    maxWidth: "600px",

    margin: "100px auto",

    padding: "30px",

    borderRadius: "14px",

    border:
      "1px solid rgba(148,163,184,0.30)",

    background:
      "rgba(15,23,42,0.96)",

    color: "#ffffff",
  },

  errorCard: {
    maxWidth: "600px",

    margin: "100px auto",

    padding: "30px",

    borderRadius: "14px",

    border:
      "1px solid rgba(248,113,113,0.48)",

    background:
      "rgba(42,17,22,0.95)",
  },

  secondaryButton: {
    marginTop: "18px",

    padding: "12px 16px",

    borderRadius: "9px",

    border:
      "1px solid rgba(148,163,184,0.34)",

    background:
      "linear-gradient(180deg, #252f39, #12181e)",

    color: "#ffffff",

    fontWeight: 800,

    cursor: "pointer",
  },

  error: {
    margin: 0,

    color: "#fca5a5",
  },
};