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

import { createBrowserClient } from "@supabase/ssr";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
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

type LeagueSettings = {
  regular_season_weeks: number;
};

type Team = {
  id: number;
  team_name: string;
  owner_id: string | null;
  active: boolean;
};

type Matchup = {
  id: number;
  week: number;
  home_fantasy_team_id: number;
  away_fantasy_team_id: number;
  is_live: boolean;
  is_final: boolean;
  finalized_at: string | null;
  home_points: number | string | null;
  away_points: number | string | null;
};

type DraftPair = {
  slot: number;
  homeTeamId: number | null;
  awayTeamId: number | null;
};

type Validation = {
  success: boolean;
  season: number;
  regularSeasonWeeks: number;
  teamCount: number;
  expectedMatchupsPerWeek: number;
  totalMatchups: number;
  selfMatchups: number;
  duplicateTeamWeeks: number;
  incompleteWeeks: number;
  minHomeGames: number;
  maxHomeGames: number;
  minAwayGames: number;
  maxAwayGames: number;
  valid: boolean;
};

export default function CommissionerScheduleBuilderPage() {
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
    settings,
    setSettings,
  ] =
    useState<LeagueSettings | null>(
      null
    );

  const [
    teams,
    setTeams,
  ] =
    useState<Team[]>(
      []
    );

  const [
    matchups,
    setMatchups,
  ] =
    useState<Matchup[]>(
      []
    );

  const [
    selectedWeek,
    setSelectedWeek,
  ] =
    useState(1);

  const [
    draftPairs,
    setDraftPairs,
  ] =
    useState<DraftPair[]>(
      []
    );

  const [
    selectedByeTeamId,
    setSelectedByeTeamId,
  ] =
    useState<number | null>(
      null
    );

  const [
    copyFromWeek,
    setCopyFromWeek,
  ] =
    useState(1);

  const [
    validation,
    setValidation,
  ] =
    useState<Validation | null>(
      null
    );

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

        setLoading(
          true
        );

        setMessage("");
        setIsError(false);

        try {
          const {
            data:
              userData,
            error:
              userError,
          } =
            await supabase
              .auth
              .getUser();

          const user =
            userData.user;

          if (
            userError ||
            !user
          ) {
            router.replace(
              "/"
            );
            return;
          }

          const [
            leagueResult,
            membershipResult,
            settingsResult,
            teamsResult,
          ] =
            await Promise.all([
              supabase
                .from(
                  "leagues"
                )
                .select(
                  `
                  id,
                  name,
                  league_type,
                  season
                `
                )
                .eq(
                  "id",
                  leagueId
                )
                .single(),

              supabase
                .from(
                  "league_members"
                )
                .select(
                  "role"
                )
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
                .select(
                  "regular_season_weeks"
                )
                .eq(
                  "league_id",
                  leagueId
                )
                .single(),

              supabase
                .from(
                  "fantasy_teams"
                )
                .select(
                  `
                  id,
                  team_name,
                  owner_id,
                  active
                `
                )
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
                    ascending:
                      true,
                  }
                ),
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
            !membershipResult.data ||
            ![
              "commissioner",
              "co_commissioner",
            ].includes(
              (
                membershipResult.data as
                  Membership
              ).role
            )
          ) {
            throw new Error(
              "Commissioner access is required."
            );
          }

          const loadedLeague =
            leagueResult.data as
              League;

          if (
            loadedLeague
              .league_type !==
            "traditional"
          ) {
            throw new Error(
              "The Schedule Builder is only available for Traditional leagues."
            );
          }

          if (
            settingsResult.error ||
            !settingsResult.data
          ) {
            throw new Error(
              settingsResult.error
                ?.message ??
                "League settings could not be loaded."
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

          const {
            data:
              matchupData,
            error:
              matchupError,
          } =
            await supabase
              .from(
                "traditional_matchups"
              )
              .select(
                `
                id,
                week,
                home_fantasy_team_id,
                away_fantasy_team_id,
                is_live,
                is_final,
                finalized_at,
                home_points,
                away_points
              `
              )
              .eq(
                "league_id",
                leagueId
              )
              .eq(
                "season",
                loadedLeague
                  .season
              )
              .order(
                "week",
                {
                  ascending:
                    true,
                }
              )
              .order(
                "id",
                {
                  ascending:
                    true,
                }
              );

          if (
            matchupError
          ) {
            throw new Error(
              matchupError.message
            );
          }

          const {
            data:
              validationData,
            error:
              validationError,
          } =
            await supabase.rpc(
              "validate_traditional_schedule",
              {
                p_league_id:
                  leagueId,
              }
            );

          if (
            validationError
          ) {
            throw new Error(
              validationError.message
            );
          }

          const loadedSettings =
            settingsResult.data as
              LeagueSettings;

          const loadedTeams =
            (teamsResult.data ??
              []) as
              Team[];

          const loadedMatchups =
            (matchupData ??
              []) as
              Matchup[];

          setLeague(
            loadedLeague
          );

          setSettings(
            loadedSettings
          );

          setTeams(
            loadedTeams
          );

          setMatchups(
            loadedMatchups
          );

          setValidation(
            validationData as
              Validation
          );

          setSelectedWeek(
            (
              current
            ) =>
              Math.min(
                Math.max(
                  1,
                  current
                ),
                Math.max(
                  1,
                  loadedSettings
                    .regular_season_weeks
                )
              )
          );
        } catch (
          error
        ) {
          setIsError(
            true
          );

          setMessage(
            error instanceof
              Error
              ? error.message
              : "Schedule Builder could not be loaded."
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

  useEffect(
    () => {
      void loadPage();
    },
    [
      loadPage,
    ]
  );

  const selectedWeekMatchups =
    useMemo(
      () =>
        matchups.filter(
          (
            matchup
          ) =>
            matchup.week ===
            selectedWeek
        ),
      [
        matchups,
        selectedWeek,
      ]
    );

  const selectedWeekLocked =
    useMemo(
      () =>
        selectedWeekMatchups.some(
          (
            matchup
          ) =>
            matchup.is_live ||
            matchup.is_final ||
            matchup.finalized_at !==
              null
        ),
      [
        selectedWeekMatchups,
      ]
    );

  const fullScheduleLocked =
    useMemo(
      () =>
        matchups.some(
          (
            matchup
          ) =>
            matchup.is_live ||
            matchup.is_final ||
            matchup.finalized_at !==
              null
        ),
      [
        matchups,
      ]
    );

  useEffect(
    () => {
      const requiredPairs =
        Math.floor(
          teams.length /
          2
        );

      const weekRows =
        selectedWeekMatchups;

      const next:
        DraftPair[] =
          Array.from(
            {
              length:
                requiredPairs,
            },
            (
              _,
              index
            ) => {
              const matchup =
                weekRows[
                  index
                ];

              return {
                slot:
                  index +
                  1,

                homeTeamId:
                  matchup
                    ?.home_fantasy_team_id ??
                  null,

                awayTeamId:
                  matchup
                    ?.away_fantasy_team_id ??
                  null,
              };
            }
          );

      // If the week does not exist yet, seed a simple editable
      // pairing layout so the commissioner does not start with
      // empty dropdowns.
      if (
        weekRows.length ===
          0 &&
        teams.length >=
          2
      ) {
        for (
          let index =
            0;
          index <
            requiredPairs;
          index++
        ) {
          next[
            index
          ] = {
            slot:
              index + 1,

            homeTeamId:
              teams[
                index * 2
              ]?.id ??
              null,

            awayTeamId:
              teams[
                index * 2 +
                1
              ]?.id ??
              null,
          };
        }
      }

      setDraftPairs(
        next
      );

      if (
        teams.length %
          2 ===
        1
      ) {
        const scheduledIds =
          new Set<number>();

        for (
          const matchup of
          weekRows
        ) {
          scheduledIds.add(
            matchup.home_fantasy_team_id
          );

          scheduledIds.add(
            matchup.away_fantasy_team_id
          );
        }

        const existingBye =
          teams.find(
            (
              team
            ) =>
              !scheduledIds.has(
                team.id
              )
          )?.id ??
          null;

        setSelectedByeTeamId(
          existingBye
        );
      } else {
        setSelectedByeTeamId(
          null
        );
      }
    },
    [
      selectedWeek,
      selectedWeekMatchups,
      teams,
    ]
  );

  const usedTeamIds =
    useMemo(
      () => {
        const ids =
          new Set<number>();

        for (
          const pair of
          draftPairs
        ) {
          if (
            pair.homeTeamId !==
            null
          ) {
            ids.add(
              pair.homeTeamId
            );
          }

          if (
            pair.awayTeamId !==
            null
          ) {
            ids.add(
              pair.awayTeamId
            );
          }
        }

        return ids;
      },
      [
        draftPairs,
      ]
    );

  const byeTeam =
    useMemo(
      () => {
        if (
          teams.length %
            2 ===
          0
        ) {
          return null;
        }

        if (
          selectedByeTeamId !==
          null
        ) {
          return (
            teams.find(
              (
                team
              ) =>
                team.id ===
                selectedByeTeamId
            ) ??
            null
          );
        }

        return (
          teams.find(
            (
              team
            ) =>
              !usedTeamIds.has(
                team.id
              )
          ) ??
          null
        );
      },
      [
        selectedByeTeamId,
        teams,
        usedTeamIds,
      ]
    );

  const manualValidation =
    useMemo(
      () => {
        const errors:
          string[] = [];

        const seen =
          new Set<number>();

        for (
          const pair of
          draftPairs
        ) {
          if (
            pair.homeTeamId ===
              null ||
            pair.awayTeamId ===
              null
          ) {
            errors.push(
              `Matchup ${pair.slot} needs both teams.`
            );

            continue;
          }

          if (
            pair.homeTeamId ===
            pair.awayTeamId
          ) {
            errors.push(
              `Matchup ${pair.slot} cannot use the same team twice.`
            );
          }

          for (
            const id of [
              pair.homeTeamId,
              pair.awayTeamId,
            ]
          ) {
            if (
              seen.has(
                id
              )
            ) {
              errors.push(
                `${teamName(
                  id,
                  teams
                )} appears more than once in Week ${selectedWeek}.`
              );
            }

            seen.add(
              id
            );
          }
        }

        if (
          teams.length %
            2 ===
            0 &&
          seen.size !==
            teams.length
        ) {
          errors.push(
            "Every active team must appear exactly once."
          );
        }

        if (
          teams.length %
            2 ===
            1
        ) {
          if (
            selectedByeTeamId ===
            null
          ) {
            errors.push(
              "Choose the team receiving the bye."
            );
          }

          if (
            selectedByeTeamId !==
              null &&
            seen.has(
              selectedByeTeamId
            )
          ) {
            errors.push(
              `${teamName(
                selectedByeTeamId,
                teams
              )} is selected for the bye and cannot also appear in a matchup.`
            );
          }

          if (
            seen.size !==
            teams.length -
              1
          ) {
            errors.push(
              "An odd-team league must schedule every team except the selected bye team exactly once."
            );
          }
        }

        return Array.from(
          new Set(
            errors
          )
        );
      },
      [
        draftPairs,
        selectedByeTeamId,
        selectedWeek,
        teams,
      ]
    );

  const teamStats =
    useMemo(
      () => {
        const stats =
          new Map<
            number,
            {
              home: number;
              away: number;
              games: number;
              opponents:
                Map<
                  number,
                  number
                >;
            }
          >();

        for (
          const team of
          teams
        ) {
          stats.set(
            team.id,
            {
              home:
                0,
              away:
                0,
              games:
                0,
              opponents:
                new Map(),
            }
          );
        }

        for (
          const matchup of
          matchups
        ) {
          const home =
            stats.get(
              matchup
                .home_fantasy_team_id
            );

          const away =
            stats.get(
              matchup
                .away_fantasy_team_id
            );

          if (home) {
            home.home++;
            home.games++;

            home.opponents.set(
              matchup
                .away_fantasy_team_id,
              (
                home.opponents.get(
                  matchup
                    .away_fantasy_team_id
                ) ??
                0
              ) +
                1
            );
          }

          if (away) {
            away.away++;
            away.games++;

            away.opponents.set(
              matchup
                .home_fantasy_team_id,
              (
                away.opponents.get(
                  matchup
                    .home_fantasy_team_id
                ) ??
                0
              ) +
                1
            );
          }
        }

        return stats;
      },
      [
        matchups,
        teams,
      ]
    );

  function updatePair(
    slot:
      number,
    side:
      "home" | "away",
    teamId:
      number | null
  ): void {
    setDraftPairs(
      (
        current
      ) =>
        current.map(
          (
            pair
          ) =>
            pair.slot ===
              slot
              ? {
                  ...pair,

                  ...(side ===
                  "home"
                    ? {
                        homeTeamId:
                          teamId,
                      }
                    : {
                        awayTeamId:
                          teamId,
                      }),
                }
              : pair
        )
    );
  }

  function swapPair(
    slot:
      number
  ): void {
    setDraftPairs(
      (
        current
      ) =>
        current.map(
          (
            pair
          ) =>
            pair.slot ===
              slot
              ? {
                  ...pair,

                  homeTeamId:
                    pair
                      .awayTeamId,

                  awayTeamId:
                    pair
                      .homeTeamId,
                }
              : pair
        )
    );
  }

  function clearWeek():
    void {
    setDraftPairs(
      (
        current
      ) =>
        current.map(
          (
            pair
          ) => ({
            ...pair,
            homeTeamId:
              null,
            awayTeamId:
              null,
          })
        )
    );

    if (
      teams.length %
        2 ===
      1
    ) {
      setSelectedByeTeamId(
        null
      );
    }
  }

  function randomizeSelectedWeek():
    void {
    if (
      selectedWeekLocked ||
      working ||
      teams.length <
        2
    ) {
      return;
    }

    const shuffled =
      [...teams]
        .sort(
          () =>
            Math.random() -
            0.5
        );

    let workingTeams =
      shuffled;

    let byeId:
      number | null =
        null;

    if (
      shuffled.length %
        2 ===
      1
    ) {
      byeId =
        shuffled[
          shuffled.length -
            1
        ].id;

      workingTeams =
        shuffled.slice(
          0,
          -1
        );
    }

    const next:
      DraftPair[] =
        [];

    for (
      let index =
        0;
      index <
        workingTeams.length;
      index +=
        2
    ) {
      const first =
        workingTeams[
          index
        ];

      const second =
        workingTeams[
          index + 1
        ];

      const swap =
        Math.random() <
        0.5;

      next.push({
        slot:
          next.length +
          1,

        homeTeamId:
          swap
            ? second.id
            : first.id,

        awayTeamId:
          swap
            ? first.id
            : second.id,
      });
    }

    setDraftPairs(
      next
    );

    setSelectedByeTeamId(
      byeId
    );

    setIsError(
      false
    );

    setMessage(
      `Week ${selectedWeek} randomized in the editor. Click Save Week ${selectedWeek} to make it official.`
    );
  }

  function copyScheduleFromWeek():
    void {
    if (
      selectedWeekLocked ||
      working ||
      copyFromWeek ===
        selectedWeek
    ) {
      return;
    }

    const source =
      matchups.filter(
        (
          matchup
        ) =>
          matchup.week ===
          copyFromWeek
      );

    if (
      source.length ===
      0
    ) {
      setIsError(
        true
      );

      setMessage(
        `Week ${copyFromWeek} does not have a schedule to copy.`
      );

      return;
    }

    const requiredPairs =
      Math.floor(
        teams.length /
        2
      );

    const copied =
      Array.from(
        {
          length:
            requiredPairs,
        },
        (
          _,
          index
        ) => {
          const matchup =
            source[
              index
            ];

          return {
            slot:
              index +
              1,

            homeTeamId:
              matchup
                ?.home_fantasy_team_id ??
              null,

            awayTeamId:
              matchup
                ?.away_fantasy_team_id ??
              null,
          };
        }
      );

    setDraftPairs(
      copied
    );

    if (
      teams.length %
        2 ===
      1
    ) {
      const sourceIds =
        new Set<number>();

      for (
        const matchup of
        source
      ) {
        sourceIds.add(
          matchup.home_fantasy_team_id
        );

        sourceIds.add(
          matchup.away_fantasy_team_id
        );
      }

      setSelectedByeTeamId(
        teams.find(
          (
            team
          ) =>
            !sourceIds.has(
              team.id
            )
        )?.id ??
        null
      );
    }

    setIsError(
      false
    );

    setMessage(
      `Week ${copyFromWeek} copied into the Week ${selectedWeek} editor. Review it, then click Save Week ${selectedWeek}.`
    );
  }

  function setByeTeam(
    teamId:
      number | null
  ): void {
    setSelectedByeTeamId(
      teamId
    );

    if (
      teamId ===
      null
    ) {
      return;
    }

    setDraftPairs(
      (
        current
      ) =>
        current.map(
          (
            pair
          ) => ({
            ...pair,

            homeTeamId:
              pair.homeTeamId ===
              teamId
                ? null
                : pair.homeTeamId,

            awayTeamId:
              pair.awayTeamId ===
              teamId
                ? null
                : pair.awayTeamId,
          })
        )
    );
  }

  async function randomizeSchedule():
    Promise<void> {
    if (
      !league ||
      working
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        "Randomize the entire regular-season schedule? This replaces every scheduled regular-season matchup. It is blocked automatically if any regular-season matchup is already live or final."
      );

    if (!confirmed) {
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
          "randomize_traditional_schedule",
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

      const result =
        (data ??
          {}) as
          Record<
            string,
            unknown
          >;

      setMessage(
        `Randomized balanced schedule created: ${Number(
          result.createdMatchups ??
            0
        )} matchups across ${Number(
          result.regularSeasonWeeks ??
            0
        )} regular-season weeks.`
      );

      await loadPage();
    } catch (
      error
    ) {
      setIsError(
        true
      );

      setMessage(
        error instanceof
          Error
          ? error.message
          : "The schedule could not be randomized."
      );
    } finally {
      setWorking(
        false
      );
    }
  }

  async function resetBalanced():
    Promise<void> {
    if (
      !league ||
      working
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        "Reset the full regular season to the stable balanced round-robin schedule? This is blocked if regular-season results have already started."
      );

    if (!confirmed) {
      return;
    }

    setWorking(
      true
    );

    setMessage("");
    setIsError(false);

    try {
      const {
        error,
      } =
        await supabase.rpc(
          "reset_traditional_balanced_schedule",
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

      setMessage(
        "Balanced round-robin schedule restored."
      );

      await loadPage();
    } catch (
      error
    ) {
      setIsError(
        true
      );

      setMessage(
        error instanceof
          Error
          ? error.message
          : "The balanced schedule could not be restored."
      );
    } finally {
      setWorking(
        false
      );
    }
  }

  async function saveWeek():
    Promise<void> {
    if (
      !league ||
      working ||
      selectedWeekLocked
    ) {
      return;
    }

    if (
      manualValidation.length >
      0
    ) {
      setIsError(
        true
      );

      setMessage(
        manualValidation[0]
      );

      return;
    }

    const payload =
      draftPairs.map(
        (
          pair
        ) => ({
          home_fantasy_team_id:
            pair.homeTeamId,

          away_fantasy_team_id:
            pair.awayTeamId,
        })
      );

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
          "save_traditional_schedule_week",
          {
            p_league_id:
              league.id,

            p_week:
              selectedWeek,

            p_matchups:
              payload,
          }
        );

      if (error) {
        throw new Error(
          error.message
        );
      }

      const result =
        (data ??
          {}) as
          Record<
            string,
            unknown
          >;

      const bye =
        result.byeTeamId
          ? teamName(
              Number(
                result.byeTeamId
              ),
              teams
            )
          : null;

      setMessage(
        bye
          ? `Week ${selectedWeek} saved. ${bye} has the bye.`
          : `Week ${selectedWeek} schedule saved successfully.`
      );

      await loadPage();
    } catch (
      error
    ) {
      setIsError(
        true
      );

      setMessage(
        error instanceof
          Error
          ? error.message
          : "The manual schedule could not be saved."
      );
    } finally {
      setWorking(
        false
      );
    }
  }

  if (loading) {
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
          <div
            style={
              styles.loading
            }
          >
            Loading Schedule Builder...
          </div>
        </section>
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
            styles.container
          }
        >
          <div
            style={
              styles.error
            }
          >
            {message ||
              "Schedule Builder is unavailable."}
          </div>
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
            <p
              style={
                styles.eyebrow
              }
            >
              GRIDIRON365 · COMMISSIONER
            </p>

            <h1
              style={
                styles.title
              }
            >
              Regular-Season Schedule Builder
            </h1>

            <p
              style={
                styles.muted
              }
            >
              {league.name}
              {" · "}
              Traditional
              {" · "}
              Season{" "}
              {league.season}
            </p>
          </div>

          <Link
            href={`/league/${league.id}/matchups`}
            style={
              styles.secondaryLink
            }
          >
            View Matchups
          </Link>
        </header>

        <nav
          style={
            styles.nav
          }
        >
          <Link
            href={`/league/${league.id}`}
            style={
              styles.tab
            }
          >
            League Home
          </Link>

          <Link
            href={`/league/${league.id}/commissioner`}
            style={
              styles.tab
            }
          >
            Commissioner
          </Link>

          <span
            style={
              styles.activeTab
            }
          >
            Schedule Builder
          </span>
        </nav>

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

        <section
          style={
            styles.notice
          }
        >
          <strong>
            Schedule protection
          </strong>

          <span>
            The full schedule can be randomized or reset before results begin. Once any regular-season matchup becomes live/final, historical weeks are protected and only future unlocked weeks can be edited manually.
          </span>
        </section>

        <section
          style={
            styles.summaryGrid
          }
        >
          <Summary
            label="Teams"
            value={
              teams.length
            }
          />

          <Summary
            label="Regular Weeks"
            value={
              settings
                .regular_season_weeks
            }
          />

          <Summary
            label="Matchups"
            value={
              matchups.length
            }
          />

          <Summary
            label="Schedule"
            value={
              validation
                ?.valid
                ? "VALID"
                : "CHECK"
            }
          />
        </section>

        <section
          style={
            styles.card
          }
        >
          <p
            style={
              styles.sectionLabel
            }
          >
            AUTOMATIC SCHEDULE
          </p>

          <h2
            style={
              styles.sectionTitle
            }
          >
            Balanced Schedule Generator
          </h2>

          <p
            style={
              styles.muted
            }
          >
            Randomization shuffles the starting team order, then uses balanced round-robin scheduling. Every opponent is faced before rematches begin whenever the number of regular-season weeks allows it.
          </p>

          <div
            style={
              styles.actions
            }
          >
            <button
              type="button"
              disabled={
                working ||
                fullScheduleLocked
              }
              onClick={() =>
                void randomizeSchedule()
              }
              style={
                styles.primaryButton
              }
            >
              Randomize Full Schedule
            </button>

            <button
              type="button"
              disabled={
                working ||
                fullScheduleLocked
              }
              onClick={() =>
                void resetBalanced()
              }
              style={
                styles.secondaryButton
              }
            >
              Reset to Balanced Round Robin
            </button>

            <button
              type="button"
              disabled={
                working
              }
              onClick={() =>
                void loadPage()
              }
              style={
                styles.secondaryButton
              }
            >
              Reload
            </button>
          </div>

          {fullScheduleLocked ? (
            <div
              style={
                styles.lockedNotice
              }
            >
              Full-schedule randomization is locked because regular-season results have already started. Future unlocked weeks can still be customized below.
            </div>
          ) : null}
        </section>

        <section
          style={
            styles.card
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
                MANUAL CUSTOMIZATION
              </p>

              <h2
                style={
                  styles.sectionTitle
                }
              >
                Edit Any Unlocked Week
              </h2>
            </div>

            <label
              style={
                styles.weekField
              }
            >
              <span>
                Week
              </span>

              <select
                value={
                  selectedWeek
                }
                onChange={(
                  event
                ) =>
                  setSelectedWeek(
                    Number(
                      event.target
                        .value
                    )
                  )
                }
                style={
                  styles.select
                }
              >
                {Array.from(
                  {
                    length:
                      settings
                        .regular_season_weeks,
                  },
                  (
                    _,
                    index
                  ) =>
                    index + 1
                ).map(
                  (
                    week
                  ) => (
                    <option
                      key={
                        week
                      }
                      value={
                        week
                      }
                    >
                      Week{" "}
                      {week}
                    </option>
                  )
                )}
              </select>
            </label>
          </div>

          <div
            style={
              styles.weekTools
            }
          >
            <button
              type="button"
              disabled={
                selectedWeekLocked ||
                working
              }
              onClick={
                randomizeSelectedWeek
              }
              style={
                styles.secondaryButton
              }
            >
              Randomize Week {selectedWeek}
            </button>

            <label
              style={
                styles.copyField
              }
            >
              <span>
                Copy From
              </span>

              <select
                value={
                  copyFromWeek
                }
                disabled={
                  selectedWeekLocked ||
                  working
                }
                onChange={(
                  event
                ) =>
                  setCopyFromWeek(
                    Number(
                      event.target
                        .value
                    )
                  )
                }
                style={
                  styles.select
                }
              >
                {Array.from(
                  {
                    length:
                      settings
                        .regular_season_weeks,
                  },
                  (
                    _,
                    index
                  ) =>
                    index + 1
                )
                  .filter(
                    (
                      week
                    ) =>
                      week !==
                      selectedWeek
                  )
                  .map(
                    (
                      week
                    ) => (
                      <option
                        key={
                          week
                        }
                        value={
                          week
                        }
                      >
                        Week{" "}
                        {week}
                      </option>
                    )
                  )}
              </select>
            </label>

            <button
              type="button"
              disabled={
                selectedWeekLocked ||
                working ||
                copyFromWeek ===
                  selectedWeek
              }
              onClick={
                copyScheduleFromWeek
              }
              style={
                styles.secondaryButton
              }
            >
              Copy Week
            </button>
          </div>

          {selectedWeekLocked ? (
            <div
              style={
                styles.lockedNotice
              }
            >
              Week {selectedWeek} is locked because a matchup is live or final. Historical matchup results cannot be rewritten.
            </div>
          ) : null}

          <div
            style={
              styles.matchupList
            }
          >
            {draftPairs.map(
              (
                pair
              ) => (
                <article
                  key={
                    pair.slot
                  }
                  style={
                    styles.matchupEditor
                  }
                >
                  <div
                    style={
                      styles.matchupNumber
                    }
                  >
                    Matchup{" "}
                    {pair.slot}
                  </div>

                  <TeamSelect
                    label="Home"
                    value={
                      pair.homeTeamId
                    }
                    teams={
                      teams
                    }
                    draftPairs={
                      draftPairs
                    }
                    currentSlot={
                      pair.slot
                    }
                    currentOtherTeamId={
                      pair.awayTeamId
                    }
                    disabled={
                      selectedWeekLocked ||
                      working
                    }
                    onChange={(
                      value
                    ) =>
                      updatePair(
                        pair.slot,
                        "home",
                        value
                      )
                    }
                  />

                  <div
                    style={
                      styles.vs
                    }
                  >
                    VS
                  </div>

                  <TeamSelect
                    label="Away"
                    value={
                      pair.awayTeamId
                    }
                    teams={
                      teams
                    }
                    draftPairs={
                      draftPairs
                    }
                    currentSlot={
                      pair.slot
                    }
                    currentOtherTeamId={
                      pair.homeTeamId
                    }
                    disabled={
                      selectedWeekLocked ||
                      working
                    }
                    onChange={(
                      value
                    ) =>
                      updatePair(
                        pair.slot,
                        "away",
                        value
                      )
                    }
                  />

                  <button
                    type="button"
                    disabled={
                      selectedWeekLocked ||
                      working
                    }
                    onClick={() =>
                      swapPair(
                        pair.slot
                      )
                    }
                    style={
                      styles.swapButton
                    }
                  >
                    Swap Home/Away
                  </button>
                </article>
              )
            )}
          </div>

          {teams.length %
            2 ===
          1 ? (
            <div
              style={
                styles.byeCard
              }
            >
              <label
                style={
                  styles.byeField
                }
              >
                <span>
                  Week {selectedWeek} Bye Team
                </span>

                <select
                  value={
                    selectedByeTeamId ??
                    ""
                  }
                  disabled={
                    selectedWeekLocked ||
                    working
                  }
                  onChange={(
                    event
                  ) =>
                    setByeTeam(
                      event.target
                        .value ===
                        ""
                        ? null
                        : Number(
                            event
                              .target
                              .value
                          )
                    )
                  }
                  style={
                    styles.select
                  }
                >
                  <option value="">
                    Select Bye Team
                  </option>

                  {teams.map(
                    (
                      team
                    ) => (
                      <option
                        key={
                          team.id
                        }
                        value={
                          team.id
                        }
                      >
                        {team.team_name}
                      </option>
                    )
                  )}
                </select>
              </label>

              <span
                style={
                  styles.byeText
                }
              >
                {byeTeam
                  ? `${byeTeam.team_name} will not play in Week ${selectedWeek}.`
                  : "Choose exactly one bye team for this week."}
              </span>
            </div>
          ) : null}

          {manualValidation.length >
          0 ? (
            <div
              style={
                styles.validationError
              }
            >
              <strong>
                Fix before saving:
              </strong>

              <ul>
                {manualValidation.map(
                  (
                    issue
                  ) => (
                    <li
                      key={
                        issue
                      }
                    >
                      {issue}
                    </li>
                  )
                )}
              </ul>
            </div>
          ) : (
            <div
              style={
                styles.validationGood
              }
            >
              ✓ Week {selectedWeek} has a valid matchup structure.
            </div>
          )}

          <div
            style={
              styles.actions
            }
          >
            <button
              type="button"
              disabled={
                working ||
                selectedWeekLocked ||
                manualValidation.length >
                  0
              }
              onClick={() =>
                void saveWeek()
              }
              style={
                styles.primaryButton
              }
            >
              Save Week {selectedWeek}
            </button>

            <button
              type="button"
              disabled={
                working ||
                selectedWeekLocked
              }
              onClick={
                clearWeek
              }
              style={
                styles.secondaryButton
              }
            >
              Clear Week Editor
            </button>
          </div>
        </section>

        <section
          style={
            styles.customizationCard
          }
        >
          <p
            style={
              styles.sectionLabel
            }
          >
            FULL COMMISSIONER CONTROL
          </p>

          <h2
            style={
              styles.sectionTitle
            }
          >
            Customize the Season Your Way
          </h2>

          <div
            style={
              styles.customizationGrid
            }
          >
            <span>
              ✓ Choose every matchup in every regular-season week
            </span>

            <span>
              ✓ Choose which team is home or away
            </span>

            <span>
              ✓ Swap home and away instantly
            </span>

            <span>
              ✓ Randomize only one selected week
            </span>

            <span>
              ✓ Copy another week's matchup layout
            </span>

            <span>
              ✓ Choose the bye team in odd-team leagues
            </span>

            <span>
              ✓ Repeat opponents whenever the commissioner wants
            </span>

            <span>
              ✓ Keep completed/live weeks permanently protected
            </span>
          </div>
        </section>

        <section
          style={
            styles.card
          }
        >
          <p
            style={
              styles.sectionLabel
            }
          >
            SCHEDULE VALIDATION
          </p>

          <h2
            style={
              styles.sectionTitle
            }
          >
            League Schedule Health
          </h2>

          <div
            style={
              styles.healthGrid
            }
          >
            <Health
              label="No self matchups"
              good={
                validation
                  ?.selfMatchups ===
                0
              }
              value={
                validation
                  ?.selfMatchups ??
                0
              }
            />

            <Health
              label="No duplicate team/week"
              good={
                validation
                  ?.duplicateTeamWeeks ===
                0
              }
              value={
                validation
                  ?.duplicateTeamWeeks ??
                0
              }
            />

            <Health
              label="All weeks complete"
              good={
                validation
                  ?.incompleteWeeks ===
                0
              }
              value={
                validation
                  ?.incompleteWeeks ??
                0
              }
            />

            <Health
              label="Overall schedule"
              good={
                Boolean(
                  validation
                    ?.valid
                )
              }
              value={
                validation
                  ?.valid
                  ? "PASS"
                  : "CHECK"
              }
            />
          </div>

          {validation ? (
            <p
              style={
                styles.muted
              }
            >
              Home-game range:{" "}
              {validation.minHomeGames}
              {"–"}
              {validation.maxHomeGames}
              {" · "}
              Away-game range:{" "}
              {validation.minAwayGames}
              {"–"}
              {validation.maxAwayGames}
            </p>
          ) : null}
        </section>

        <section
          style={
            styles.card
          }
        >
          <p
            style={
              styles.sectionLabel
            }
          >
            TEAM BREAKDOWN
          </p>

          <h2
            style={
              styles.sectionTitle
            }
          >
            Schedule Balance
          </h2>

          <div
            style={
              styles.teamTable
            }
          >
            {teams.map(
              (
                team
              ) => {
                const stat =
                  teamStats.get(
                    team.id
                  );

                const rematches =
                  Array.from(
                    stat
                      ?.opponents
                      .values() ??
                      []
                  ).reduce(
                    (
                      total,
                      count
                    ) =>
                      total +
                      Math.max(
                        0,
                        count - 1
                      ),
                    0
                  );

                return (
                  <div
                    key={
                      team.id
                    }
                    style={
                      styles.teamRow
                    }
                  >
                    <strong>
                      {team.team_name}
                    </strong>

                    <span>
                      Games{" "}
                      {stat?.games ??
                        0}
                    </span>

                    <span>
                      Home{" "}
                      {stat?.home ??
                        0}
                    </span>

                    <span>
                      Away{" "}
                      {stat?.away ??
                        0}
                    </span>

                    <span>
                      Unique Opponents{" "}
                      {stat
                        ?.opponents
                        .size ??
                        0}
                    </span>

                    <span>
                      Rematches{" "}
                      {rematches}
                    </span>
                  </div>
                );
              }
            )}
          </div>
        </section>
      </section>
    </main>
  );
}

function TeamSelect({
  label,
  value,
  teams,
  draftPairs,
  currentSlot,
  currentOtherTeamId,
  disabled,
  onChange,
}: {
  label:
    string;
  value:
    number | null;
  teams:
    Team[];
  draftPairs:
    DraftPair[];
  currentSlot:
    number;
  currentOtherTeamId:
    number | null;
  disabled:
    boolean;
  onChange:
    (
      value:
        number | null
    ) => void;
}) {
  const usedElsewhere =
    new Set<number>();

  for (
    const pair of
    draftPairs
  ) {
    if (
      pair.slot ===
      currentSlot
    ) {
      continue;
    }

    if (
      pair.homeTeamId !==
      null
    ) {
      usedElsewhere.add(
        pair.homeTeamId
      );
    }

    if (
      pair.awayTeamId !==
      null
    ) {
      usedElsewhere.add(
        pair.awayTeamId
      );
    }
  }

  return (
    <label
      style={
        styles.teamField
      }
    >
      <span>
        {label}
      </span>

      <select
        value={
          value ??
          ""
        }
        disabled={
          disabled
        }
        onChange={(
          event
        ) =>
          onChange(
            event.target
              .value ===
              ""
              ? null
              : Number(
                  event.target
                    .value
                )
          )
        }
        style={
          styles.select
        }
      >
        <option value="">
          Select Team
        </option>

        {teams.map(
          (
            team
          ) => {
            const unavailable =
              usedElsewhere.has(
                team.id
              ) ||
              team.id ===
                currentOtherTeamId;

            return (
              <option
                key={
                  team.id
                }
                value={
                  team.id
                }
                disabled={
                  unavailable &&
                  team.id !==
                    value
                }
              >
                {team.team_name}
              </option>
            );
          }
        )}
      </select>
    </label>
  );
}

function Summary({
  label,
  value,
}: {
  label:
    string;
  value:
    string | number;
}) {
  return (
    <div
      style={
        styles.summary
      }
    >
      <span>
        {label}
      </span>

      <strong>
        {value}
      </strong>
    </div>
  );
}

function Health({
  label,
  good,
  value,
}: {
  label:
    string;
  good:
    boolean;
  value:
    string | number;
}) {
  return (
    <div
      style={
        good
          ? styles.healthGood
          : styles.healthBad
      }
    >
      <span>
        {good
          ? "✓"
          : "!"}
      </span>

      <strong>
        {label}
      </strong>

      <small>
        {value}
      </small>
    </div>
  );
}

function teamName(
  id:
    number,
  teams:
    Team[]
): string {
  return (
    teams.find(
      (
        team
      ) =>
        team.id ===
        id
    )?.team_name ??
    `Team ${id}`
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
        "28px 18px 70px",
      background:
        "#00140d",
      color:
        "#ffffff",
      fontFamily:
        "Arial, sans-serif",
    },

    container: {
      width:
        "min(1180px, 100%)",
      margin:
        "0 auto",
    },

    loading: {
      marginTop:
        "70px",
      padding:
        "30px",
      border:
        "1px solid #315243",
      borderRadius:
        "14px",
      background:
        "#071a12",
      textAlign:
        "center",
    },

    header: {
      display:
        "flex",
      justifyContent:
        "space-between",
      alignItems:
        "flex-end",
      gap:
        "18px",
      flexWrap:
        "wrap",
      marginBottom:
        "18px",
    },

    eyebrow: {
      margin:
        0,
      color:
        "#98ff3f",
      fontSize:
        "11px",
      fontWeight:
        900,
      letterSpacing:
        "0.1em",
    },

    title: {
      margin:
        "6px 0",
      fontSize:
        "clamp(30px, 4vw, 46px)",
    },

    muted: {
      margin:
        "6px 0 0",
      color:
        "#aebdb5",
      lineHeight:
        1.5,
    },

    secondaryLink: {
      padding:
        "10px 13px",
      border:
        "1px solid #315243",
      borderRadius:
        "8px",
      color:
        "#ffffff",
      textDecoration:
        "none",
      background:
        "#071a12",
      fontWeight:
        800,
    },

    nav: {
      display:
        "flex",
      gap:
        "8px",
      flexWrap:
        "wrap",
      marginBottom:
        "18px",
    },

    tab: {
      padding:
        "10px 13px",
      border:
        "1px solid #315243",
      borderRadius:
        "8px",
      background:
        "#071a12",
      color:
        "#ffffff",
      textDecoration:
        "none",
      fontWeight:
        800,
    },

    activeTab: {
      padding:
        "10px 13px",
      border:
        "1px solid #98ff3f",
      borderRadius:
        "8px",
      background:
        "#17351f",
      color:
        "#d8ffc3",
      fontWeight:
        900,
    },

    notice: {
      display:
        "grid",
      gap:
        "5px",
      marginBottom:
        "16px",
      padding:
        "14px",
      border:
        "1px solid #4c6758",
      borderRadius:
        "11px",
      background:
        "#0b2017",
      color:
        "#d8e8df",
      lineHeight:
        1.45,
    },

    summaryGrid: {
      display:
        "grid",
      gridTemplateColumns:
        "repeat(auto-fit, minmax(150px, 1fr))",
      gap:
        "10px",
      marginBottom:
        "16px",
    },

    summary: {
      display:
        "grid",
      gap:
        "5px",
      padding:
        "14px",
      border:
        "1px solid #315243",
      borderRadius:
        "10px",
      background:
        "#071a12",
      color:
        "#9fb1a7",
      fontSize:
        "12px",
    },

    card: {
      marginBottom:
        "16px",
      padding:
        "18px",
      border:
        "1px solid #315243",
      borderRadius:
        "14px",
      background:
        "#071a12",
    },

    sectionHeader: {
      display:
        "flex",
      justifyContent:
        "space-between",
      alignItems:
        "flex-end",
      gap:
        "14px",
      flexWrap:
        "wrap",
    },

    sectionLabel: {
      margin:
        "0 0 5px",
      color:
        "#98ff3f",
      fontSize:
        "10px",
      fontWeight:
        900,
      letterSpacing:
        "0.1em",
    },

    sectionTitle: {
      margin:
        "0 0 12px",
      fontSize:
        "21px",
    },

    actions: {
      display:
        "flex",
      gap:
        "9px",
      flexWrap:
        "wrap",
      marginTop:
        "15px",
    },

    primaryButton: {
      padding:
        "11px 14px",
      border:
        0,
      borderRadius:
        "8px",
      background:
        "#98ff3f",
      color:
        "#06140d",
      fontWeight:
        900,
      cursor:
        "pointer",
    },

    secondaryButton: {
      padding:
        "11px 14px",
      border:
        "1px solid #315243",
      borderRadius:
        "8px",
      background:
        "#0b2017",
      color:
        "#ffffff",
      fontWeight:
        800,
      cursor:
        "pointer",
    },

    weekTools: {
      display:
        "flex",
      alignItems:
        "end",
      gap:
        "9px",
      flexWrap:
        "wrap",
      marginTop:
        "12px",
      marginBottom:
        "8px",
    },

    copyField: {
      display:
        "grid",
      gap:
        "5px",
      minWidth:
        "150px",
      color:
        "#c7d6ce",
      fontSize:
        "11px",
      fontWeight:
        800,
    },

    lockedNotice: {
      marginTop:
        "14px",
      padding:
        "11px 12px",
      border:
        "1px solid #75573c",
      borderRadius:
        "8px",
      background:
        "#281b0c",
      color:
        "#ffe0aa",
      lineHeight:
        1.45,
    },

    weekField: {
      display:
        "grid",
      gap:
        "5px",
      minWidth:
        "160px",
      color:
        "#c7d6ce",
      fontSize:
        "12px",
      fontWeight:
        800,
    },

    select: {
      width:
        "100%",
      boxSizing:
        "border-box",
      padding:
        "10px 11px",
      border:
        "1px solid #315243",
      borderRadius:
        "8px",
      background:
        "#00140d",
      color:
        "#ffffff",
      fontWeight:
        800,
    },

    matchupList: {
      display:
        "grid",
      gap:
        "10px",
      marginTop:
        "14px",
    },

    matchupEditor: {
      display:
        "grid",
      gridTemplateColumns:
        "100px minmax(180px, 1fr) 40px minmax(180px, 1fr) auto",
      gap:
        "10px",
      alignItems:
        "end",
      padding:
        "12px",
      border:
        "1px solid #294739",
      borderRadius:
        "10px",
      background:
        "#00140d",
    },

    matchupNumber: {
      alignSelf:
        "center",
      color:
        "#98ff3f",
      fontSize:
        "11px",
      fontWeight:
        900,
    },

    teamField: {
      display:
        "grid",
      gap:
        "5px",
      color:
        "#c7d6ce",
      fontSize:
        "11px",
      fontWeight:
        800,
    },

    vs: {
      alignSelf:
        "center",
      justifySelf:
        "center",
      color:
        "#71867b",
      fontWeight:
        900,
    },

    swapButton: {
      padding:
        "10px",
      border:
        "1px solid #315243",
      borderRadius:
        "8px",
      background:
        "#0b2017",
      color:
        "#ffffff",
      fontWeight:
        800,
      cursor:
        "pointer",
    },

    byeCard: {
      display:
        "flex",
      alignItems:
        "end",
      justifyContent:
        "space-between",
      gap:
        "12px",
      flexWrap:
        "wrap",
      marginTop:
        "12px",
      padding:
        "12px",
      border:
        "1px solid #526446",
      borderRadius:
        "8px",
      background:
        "#112116",
      color:
        "#d9eacb",
    },

    byeField: {
      display:
        "grid",
      gap:
        "5px",
      minWidth:
        "230px",
      fontSize:
        "11px",
      fontWeight:
        900,
    },

    byeText: {
      color:
        "#b9ceb9",
      fontSize:
        "12px",
      lineHeight:
        1.4,
    },

    customizationCard: {
      marginBottom:
        "16px",
      padding:
        "18px",
      border:
        "1px solid #4c6758",
      borderRadius:
        "14px",
      background:
        "#0b2017",
    },

    customizationGrid: {
      display:
        "grid",
      gridTemplateColumns:
        "repeat(auto-fit, minmax(260px, 1fr))",
      gap:
        "9px",
      color:
        "#d5e6dc",
      lineHeight:
        1.4,
    },

    validationGood: {
      marginTop:
        "12px",
      padding:
        "11px",
      border:
        "1px solid #4b7d4b",
      borderRadius:
        "8px",
      background:
        "#102918",
      color:
        "#caffb9",
    },

    validationError: {
      marginTop:
        "12px",
      padding:
        "11px",
      border:
        "1px solid #834141",
      borderRadius:
        "8px",
      background:
        "#2b1010",
      color:
        "#ffd2d2",
    },

    healthGrid: {
      display:
        "grid",
      gridTemplateColumns:
        "repeat(auto-fit, minmax(190px, 1fr))",
      gap:
        "9px",
      marginBottom:
        "12px",
    },

    healthGood: {
      display:
        "grid",
      gridTemplateColumns:
        "auto 1fr auto",
      gap:
        "8px",
      alignItems:
        "center",
      padding:
        "10px",
      border:
        "1px solid #4b7d4b",
      borderRadius:
        "8px",
      background:
        "#102918",
      color:
        "#caffb9",
    },

    healthBad: {
      display:
        "grid",
      gridTemplateColumns:
        "auto 1fr auto",
      gap:
        "8px",
      alignItems:
        "center",
      padding:
        "10px",
      border:
        "1px solid #834141",
      borderRadius:
        "8px",
      background:
        "#2b1010",
      color:
        "#ffd2d2",
    },

    teamTable: {
      display:
        "grid",
      gap:
        "7px",
    },

    teamRow: {
      display:
        "grid",
      gridTemplateColumns:
        "minmax(180px, 1.6fr) repeat(5, minmax(90px, 1fr))",
      gap:
        "8px",
      alignItems:
        "center",
      padding:
        "10px 11px",
      border:
        "1px solid #294739",
      borderRadius:
        "8px",
      background:
        "#00140d",
      color:
        "#aebdb5",
      fontSize:
        "12px",
    },

    success: {
      marginBottom:
        "16px",
      padding:
        "12px 14px",
      border:
        "1px solid #4b7d4b",
      borderRadius:
        "9px",
      background:
        "#102918",
      color:
        "#caffb9",
    },

    error: {
      marginBottom:
        "16px",
      padding:
        "12px 14px",
      border:
        "1px solid #834141",
      borderRadius:
        "9px",
      background:
        "#2b1010",
      color:
        "#ffd2d2",
    },
  };

