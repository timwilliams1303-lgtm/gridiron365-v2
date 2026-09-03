"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  createSupabaseBrowserClient,
} from "@/lib/supabase/browser";

type Props = {
  leagueId: string;
};

type League = {
  id: string;
  name: string;
  league_type: string;
  player_selection_mode?: string | null;
  season: number;
  status: string;
};

type Scoring = {
  league_id: string;

  passing_yard_points: number | string;
  rushing_yard_points: number | string;
  receiving_yard_points: number | string;

  passing_yards_per_point?: number | string;
  passing_td_points: number | string;
  passing_interception_points: number | string;
  passing_two_point_points: number | string;
  passing_completion_points: number | string;
  passing_incompletion_points: number | string;

  rushing_yards_per_point?: number | string;
  rushing_td_points: number | string;
  rushing_two_point_points: number | string;
  rushing_attempt_points: number | string;

  receiving_yards_per_point?: number | string;
  receiving_td_points: number | string;
  receiving_two_point_points: number | string;
  reception_points: number | string;
  receiving_target_points: number | string;

  passing_first_down_points: number | string;
  rushing_first_down_points: number | string;
  receiving_first_down_points: number | string;

  fumble_points: number | string;
  fumble_lost_points: number | string;

  extra_point_made_points: number | string;
  extra_point_missed_points: number | string;
  field_goal_missed_points: number | string;

  field_goal_0_19_points: number | string;
  field_goal_20_29_points: number | string;
  field_goal_30_39_points: number | string;
  field_goal_40_49_points: number | string;
  field_goal_50_59_points: number | string;
  field_goal_60_plus_points: number | string;

  dst_sack_points: number | string;
  dst_total_tackle_points: number | string;
  dst_tackle_for_loss_points: number | string;
  dst_interception_points: number | string;
  dst_fumble_recovery_points: number | string;
  dst_touchdown_points: number | string;
  dst_safety_points: number | string;
  dst_blocked_kick_points: number | string;
  dst_return_touchdown_points: number | string;
  dst_extra_point_return_points: number | string;

  dst_points_allowed_0_points: number | string;
  dst_points_allowed_1_6_points: number | string;
  dst_points_allowed_7_13_points: number | string;
  dst_points_allowed_14_20_points: number | string;
  dst_points_allowed_21_27_points: number | string;
  dst_points_allowed_28_34_points: number | string;
  dst_points_allowed_35_plus_points: number | string;

  dst_yards_allowed_0_99_points: number | string;
  dst_yards_allowed_100_199_points: number | string;
  dst_yards_allowed_200_299_points: number | string;
  dst_yards_allowed_300_399_points: number | string;
  dst_yards_allowed_400_449_points: number | string;
  dst_yards_allowed_450_499_points: number | string;
  dst_yards_allowed_500_plus_points: number | string;

  kick_return_yards_per_point: number | string | null;
  punt_return_yards_per_point: number | string | null;
  kick_return_td_points: number | string;
  punt_return_td_points: number | string;
  offensive_fumble_recovery_td_points: number | string;

  fractional_scoring_enabled: boolean;
  decimal_places: number;
};

type ScoringRule = {
  id: number;
  league_id: string;
  category: string;
  rule_type: string;
  stat_key: string;
  min_value: number | string | null;
  max_value: number | string | null;
  points: number | string;
  is_enabled: boolean;
  stacking_mode: string;
  priority: number;
  label: string | null;
};

type LoadResult = {
  success?: boolean;
  league?: League;
  scoring?: Record<string, unknown> | null;
  rules?: ScoringRule[];
};

type ScoringCategoryKey =
  | "passing"
  | "rushing"
  | "receiving"
  | "kicking"
  | "dst"
  | "fumbles"
  | "returns";

type Group = {
  label: string;
  description: string;
  baseFields: Array<[keyof Scoring, string]>;
  bonusStats: Array<[string, string]>;
};

const scoringGroups: Record<ScoringCategoryKey, Group> = {
  passing: {
    label: "Passing",
    description:
      "Configure points per passing yard and all core passing scoring. Add optional yardage, multi-touchdown, and long-play bonuses below.",
    baseFields: [
      ["passing_yard_points", "Points Per Passing Yard"],
      ["passing_td_points", "Passing TD"],
      ["passing_interception_points", "Passing Interception"],
      ["passing_two_point_points", "Passing 2PT"],
      ["passing_completion_points", "Passing Completion"],
      ["passing_incompletion_points", "Passing Incompletion"],
      ["passing_first_down_points", "Passing First Down"],
    ],
    bonusStats: [
      ["passing_yards", "Passing Yards — yardage milestone"],
      ["passing_touchdowns", "Passing Touchdowns — multi-TD bonus"],
      ["longest_passing_touchdown_yards", "Longest Passing TD — yards"],
      ["longest_pass_completion_yards", "Longest Completion — yards"],
      ["passing_completions", "Passing Completions"],
      ["passing_attempts", "Passing Attempts"],
      ["passing_interceptions", "Interceptions Thrown"],
      ["passing_first_downs", "Passing First Downs"],
      ["passing_two_point_conversions", "Passing 2PT Conversions"],
    ],
  },

  rushing: {
    label: "Rushing",
    description:
      "Configure points per rushing yard and all core rushing scoring. Add optional yardage, multi-touchdown, and long-rush bonuses below.",
    baseFields: [
      ["rushing_yard_points", "Points Per Rushing Yard"],
      ["rushing_td_points", "Rushing TD"],
      ["rushing_two_point_points", "Rushing 2PT"],
      ["rushing_attempt_points", "Rushing Attempt"],
      ["rushing_first_down_points", "Rushing First Down"],
    ],
    bonusStats: [
      ["rushing_yards", "Rushing Yards — yardage milestone"],
      ["rushing_touchdowns", "Rushing Touchdowns — multi-TD bonus"],
      ["longest_rushing_touchdown_yards", "Longest Rushing TD — yards"],
      ["longest_rush_yards", "Longest Rush — yards"],
      ["rushing_attempts", "Rushing Attempts"],
      ["rushing_first_downs", "Rushing First Downs"],
      ["rushing_two_point_conversions", "Rushing 2PT Conversions"],
    ],
  },

  receiving: {
    label: "Receiving",
    description:
      "Configure points per receiving yard, receptions and core receiving scoring. Add optional milestones, multi-TD, and long-catch bonuses below.",
    baseFields: [
      ["receiving_yard_points", "Points Per Receiving Yard"],
      ["receiving_td_points", "Receiving TD"],
      ["receiving_two_point_points", "Receiving 2PT"],
      ["reception_points", "Reception"],
      ["receiving_target_points", "Receiving Target"],
      ["receiving_first_down_points", "Receiving First Down"],
    ],
    bonusStats: [
      ["receiving_yards", "Receiving Yards — yardage milestone"],
      ["receiving_touchdowns", "Receiving Touchdowns — multi-TD bonus"],
      ["longest_receiving_touchdown_yards", "Longest Receiving TD — yards"],
      ["longest_reception_yards", "Longest Reception — yards"],
      ["receptions", "Receptions"],
      ["receiving_targets", "Targets"],
      ["receiving_first_downs", "Receiving First Downs"],
      ["receiving_two_point_conversions", "Receiving 2PT Conversions"],
    ],
  },

  kicking: {
    label: "Kicking",
    description:
      "Use direct made-field-goal scoring by distance, plus extra points and misses. Long-field-goal and other optional kicking bonuses can be added below.",
    baseFields: [
      ["extra_point_made_points", "Extra Point Made"],
      ["extra_point_missed_points", "Extra Point Missed"],
      ["field_goal_missed_points", "Field Goal Missed"],
      ["field_goal_0_19_points", "Field Goal Made — 0–19 Yards"],
      ["field_goal_20_29_points", "Field Goal Made — 20–29 Yards"],
      ["field_goal_30_39_points", "Field Goal Made — 30–39 Yards"],
      ["field_goal_40_49_points", "Field Goal Made — 40–49 Yards"],
      ["field_goal_50_59_points", "Field Goal Made — 50–59 Yards"],
      ["field_goal_60_plus_points", "Field Goal Made — 60+ Yards"],
    ],
    bonusStats: [
      ["field_goals_made", "Field Goals Made — total bonus"],
      ["field_goals_made_0_19", "Made FG 0–19 Yards"],
      ["field_goals_made_20_29", "Made FG 20–29 Yards"],
      ["field_goals_made_30_39", "Made FG 30–39 Yards"],
      ["field_goals_made_40_49", "Made FG 40–49 Yards"],
      ["field_goals_made_50_59", "Made FG 50–59 Yards"],
      ["field_goals_made_60_plus", "Made FG 60+ Yards"],
      ["longest_field_goal_yards", "Longest Field Goal — yards"],
      ["field_goals_missed", "Field Goals Missed"],
      ["extra_points_made", "Extra Points Made"],
      ["extra_points_missed", "Extra Points Missed"],
    ],
  },

  dst: {
    label: "Defense / DST",
    description:
      "Configure base DST events plus points-allowed and yards-allowed tiers. Optional multi-sack, takeaway and defensive-event bonuses can be added below.",
    baseFields: [
      ["dst_sack_points", "DST Sack"],
      ["dst_total_tackle_points", "DST Total Tackle"],
      ["dst_tackle_for_loss_points", "DST Tackle for Loss"],
      ["dst_interception_points", "DST Interception"],
      ["dst_fumble_recovery_points", "DST Fumble Recovery"],
      ["dst_touchdown_points", "DST Touchdown"],
      ["dst_safety_points", "DST Safety"],
      ["dst_blocked_kick_points", "DST Blocked Kick"],
      ["dst_return_touchdown_points", "DST Return TD"],
      ["dst_extra_point_return_points", "DST Extra Point Return"],

      ["dst_points_allowed_0_points", "Points Allowed — 0"],
      ["dst_points_allowed_1_6_points", "Points Allowed — 1–6"],
      ["dst_points_allowed_7_13_points", "Points Allowed — 7–13"],
      ["dst_points_allowed_14_20_points", "Points Allowed — 14–20"],
      ["dst_points_allowed_21_27_points", "Points Allowed — 21–27"],
      ["dst_points_allowed_28_34_points", "Points Allowed — 28–34"],
      ["dst_points_allowed_35_plus_points", "Points Allowed — 35+"],

      ["dst_yards_allowed_0_99_points", "Yards Allowed — 0–99"],
      ["dst_yards_allowed_100_199_points", "Yards Allowed — 100–199"],
      ["dst_yards_allowed_200_299_points", "Yards Allowed — 200–299"],
      ["dst_yards_allowed_300_399_points", "Yards Allowed — 300–399"],
      ["dst_yards_allowed_400_449_points", "Yards Allowed — 400–449"],
      ["dst_yards_allowed_450_499_points", "Yards Allowed — 450–499"],
      ["dst_yards_allowed_500_plus_points", "Yards Allowed — 500+"],
    ],
    bonusStats: [
      ["dst_sacks", "DST Sacks — multi-sack bonus"],
      ["dst_interceptions", "DST Interceptions — multi-INT bonus"],
      ["dst_fumble_recoveries", "DST Fumble Recoveries"],
      ["dst_takeaways", "DST Total Takeaways"],
      ["dst_touchdowns", "DST Defensive Touchdowns"],
      ["dst_return_touchdowns", "DST Return Touchdowns"],
      ["dst_safeties", "DST Safeties"],
      ["dst_blocked_kicks", "DST Blocked Kicks"],
      ["dst_extra_point_returns", "DST Extra Point Returns"],
    ],
  },

  fumbles: {
    label: "Fumbles",
    description:
      "Configure fumble and fumble-lost scoring plus optional turnover or recovery-touchdown bonuses.",
    baseFields: [
      ["fumble_points", "Fumble"],
      ["fumble_lost_points", "Fumble Lost"],
      [
        "offensive_fumble_recovery_td_points",
        "Offensive Fumble Recovery TD",
      ],
    ],
    bonusStats: [
      ["fumbles", "Fumbles"],
      ["fumbles_lost", "Fumbles Lost"],
      [
        "offensive_fumble_recovery_touchdowns",
        "Offensive Fumble Recovery TDs",
      ],
    ],
  },

  returns: {
    label: "Returns",
    description:
      "Configure return-yard and return-touchdown scoring plus optional return milestones and long-return bonuses.",
    baseFields: [
      ["kick_return_yards_per_point", "Kick Return Yards Per Point"],
      ["punt_return_yards_per_point", "Punt Return Yards Per Point"],
      ["kick_return_td_points", "Kick Return TD"],
      ["punt_return_td_points", "Punt Return TD"],
    ],
    bonusStats: [
      ["kick_return_yards", "Kick Return Yards — yardage milestone"],
      ["kick_return_touchdowns", "Kick Return TDs — multi-TD bonus"],
      ["longest_kick_return_yards", "Longest Kick Return — yards"],
      ["punt_return_yards", "Punt Return Yards — yardage milestone"],
      ["punt_return_touchdowns", "Punt Return TDs — multi-TD bonus"],
      ["longest_punt_return_yards", "Longest Punt Return — yards"],
    ],
  },
};

const defaultScoring: Scoring = {
  league_id: "",

  passing_yard_points: 0.04,
  rushing_yard_points: 0.1,
  receiving_yard_points: 0.1,

  passing_td_points: 4,
  passing_interception_points: -2,
  passing_two_point_points: 2,
  passing_completion_points: 0,
  passing_incompletion_points: 0,

  rushing_td_points: 6,
  rushing_two_point_points: 2,
  rushing_attempt_points: 0,

  receiving_td_points: 6,
  receiving_two_point_points: 2,
  reception_points: 1,
  receiving_target_points: 0,

  passing_first_down_points: 0,
  rushing_first_down_points: 0,
  receiving_first_down_points: 0,

  fumble_points: 0,
  fumble_lost_points: -2,

  extra_point_made_points: 1,
  extra_point_missed_points: 0,
  field_goal_missed_points: 0,

  field_goal_0_19_points: 3,
  field_goal_20_29_points: 3,
  field_goal_30_39_points: 3,
  field_goal_40_49_points: 4,
  field_goal_50_59_points: 5,
  field_goal_60_plus_points: 6,

  dst_sack_points: 1,
  dst_total_tackle_points: 0.1,
  dst_tackle_for_loss_points: 0.5,
  dst_interception_points: 2,
  dst_fumble_recovery_points: 2,
  dst_touchdown_points: 6,
  dst_safety_points: 2,
  dst_blocked_kick_points: 2,
  dst_return_touchdown_points: 6,
  dst_extra_point_return_points: 2,

  dst_points_allowed_0_points: 10,
  dst_points_allowed_1_6_points: 7,
  dst_points_allowed_7_13_points: 4,
  dst_points_allowed_14_20_points: 1,
  dst_points_allowed_21_27_points: 0,
  dst_points_allowed_28_34_points: -1,
  dst_points_allowed_35_plus_points: -4,

  dst_yards_allowed_0_99_points: 10,
  dst_yards_allowed_100_199_points: 7,
  dst_yards_allowed_200_299_points: 4,
  dst_yards_allowed_300_399_points: 1,
  dst_yards_allowed_400_449_points: -1,
  dst_yards_allowed_450_499_points: -3,
  dst_yards_allowed_500_plus_points: -5,

  kick_return_yards_per_point: null,
  punt_return_yards_per_point: null,
  kick_return_td_points: 6,
  punt_return_td_points: 6,
  offensive_fumble_recovery_td_points: 6,

  fractional_scoring_enabled: true,
  decimal_places: 2,
};

function numberValue(
  value: unknown,
  fallback = 0
) {
  const parsed =
    Number(value);

  return Number.isFinite(
    parsed
  )
    ? parsed
    : fallback;
}

function pointsPerYardFromLegacy(
  value: unknown,
  fallback: number
) {
  const yardsPerPoint =
    Number(value);

  if (
    !Number.isFinite(
      yardsPerPoint
    ) ||
    yardsPerPoint === 0
  ) {
    return fallback;
  }

  return Number(
    (
      1 /
      yardsPerPoint
    ).toFixed(6)
  );
}

function normalizeScoring(
  raw:
    Record<string, unknown> |
    null |
    undefined,
  leagueId:
    string
): Scoring {
  if (!raw) {
    return {
      ...defaultScoring,
      league_id:
        leagueId,
    };
  }

  const merged = {
    ...defaultScoring,
    ...raw,
    league_id:
      leagueId,
  } as Scoring;

  if (
    raw.passing_yard_points ===
      undefined ||
    raw.passing_yard_points ===
      null
  ) {
    merged.passing_yard_points =
      pointsPerYardFromLegacy(
        raw.passing_yards_per_point,
        0.04
      );
  }

  if (
    raw.rushing_yard_points ===
      undefined ||
    raw.rushing_yard_points ===
      null
  ) {
    merged.rushing_yard_points =
      pointsPerYardFromLegacy(
        raw.rushing_yards_per_point,
        0.1
      );
  }

  if (
    raw.receiving_yard_points ===
      undefined ||
    raw.receiving_yard_points ===
      null
  ) {
    merged.receiving_yard_points =
      pointsPerYardFromLegacy(
        raw.receiving_yards_per_point,
        0.1
      );
  }

  return merged;
}

function inputValue(
  value:
    number |
    string |
    null |
    undefined
) {
  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  return String(value);
}

function makeComponent(
  displayName:
    string,
  eyebrow:
    string,
  modeDescription:
    string
) {
  return function SeasonLongScoring({
    leagueId,
  }: Props) {
    const supabase =
      useMemo(
        () =>
          createSupabaseBrowserClient(),
        []
      );

    const [
      league,
      setLeague,
    ] =
      useState<League | null>(
        null
      );

    const [
      scoring,
      setScoring,
    ] =
      useState<Scoring>({
        ...defaultScoring,
        league_id:
          leagueId,
      });

    const [
      scoringRules,
      setScoringRules,
    ] =
      useState<ScoringRule[]>(
        []
      );

    const [
      scoringCategory,
      setScoringCategory,
    ] =
      useState<ScoringCategoryKey>(
        "passing"
      );

    const [
      loading,
      setLoading,
    ] =
      useState(true);

    const [
      saving,
      setSaving,
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

    const load =
      useCallback(
        async () => {
          setLoading(true);
          setMessage("");
          setIsError(false);

          try {
            const {
              data,
              error,
            } =
              await supabase.rpc(
                "get_commissioner_scoring",
                {
                  p_league_id:
                    leagueId,
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
                LoadResult;

            if (
              !result.league
            ) {
              throw new Error(
                "League scoring settings could not be loaded."
              );
            }

            setLeague(
              result.league
            );

            setScoring(
              normalizeScoring(
                result.scoring ??
                  null,
                leagueId
              )
            );

            setScoringRules(
              Array.isArray(
                result.rules
              )
                ? result.rules
                : []
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
                : "Scoring settings could not be loaded."
            );
          } finally {
            setLoading(
              false
            );
          }
        },
        [
          leagueId,
          supabase,
        ]
      );

    useEffect(
      () => {
        void load();
      },
      [
        load,
      ]
    );

    async function saveBaseScoring() {
      if (saving) {
        return;
      }

      setSaving(true);
      setMessage("");
      setIsError(false);

      try {
        const payload:
          Record<
            string,
            number |
            boolean |
            null
          > = {};

        for (
          const group
          of Object.values(
            scoringGroups
          )
        ) {
          for (
            const [
              key,
            ]
            of group.baseFields
          ) {
            const value =
              scoring[
                key
              ];

            payload[
              String(
                key
              )
            ] =
              value ===
                null ||
              value ===
                ""
                ? null
                : numberValue(
                    value
                  );
          }
        }

        payload.fractional_scoring_enabled =
          Boolean(
            scoring.fractional_scoring_enabled
          );

        payload.decimal_places =
          Math.max(
            0,
            Math.min(
              6,
              Math.trunc(
                numberValue(
                  scoring.decimal_places,
                  2
                )
              )
            )
          );

        const {
          error,
        } =
          await supabase.rpc(
            "save_commissioner_base_scoring",
            {
              p_league_id:
                leagueId,
              p_settings:
                payload,
            }
          );

        if (error) {
          throw new Error(
            error.message
          );
        }

        setMessage(
          "Base scoring settings saved."
        );

        await load();
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
            : "Base scoring settings could not be saved."
        );
      } finally {
        setSaving(
          false
        );
      }
    }

    async function saveBonusRule(
      rule:
        ScoringRule
    ) {
      if (saving) {
        return;
      }

      if (
        !rule.stat_key
      ) {
        setIsError(
          true
        );

        setMessage(
          "Choose a statistic for the bonus rule."
        );

        return;
      }

      if (
        rule.min_value ===
          null &&
        rule.max_value ===
          null
      ) {
        setIsError(
          true
        );

        setMessage(
          "A bonus rule needs a minimum or maximum threshold."
        );

        return;
      }

      setSaving(
        true
      );
      setMessage("");
      setIsError(false);

      try {
        const {
          error,
        } =
          await supabase.rpc(
            "upsert_commissioner_scoring_rule",
            {
              p_league_id:
                leagueId,
              p_rule_id:
                rule.id >
                0
                  ? rule.id
                  : null,
              p_category:
                rule.category,
              p_rule_type:
                rule.rule_type ||
                "threshold",
              p_stat_key:
                rule.stat_key,
              p_min_value:
                rule.min_value ===
                  "" ||
                rule.min_value ===
                  null
                  ? null
                  : numberValue(
                      rule.min_value
                    ),
              p_max_value:
                rule.max_value ===
                  "" ||
                rule.max_value ===
                  null
                  ? null
                  : numberValue(
                      rule.max_value
                    ),
              p_points:
                numberValue(
                  rule.points
                ),
              p_is_enabled:
                Boolean(
                  rule.is_enabled
                ),
              p_priority:
                Math.trunc(
                  numberValue(
                    rule.priority
                  )
                ),
              p_label:
                rule.label,
            }
          );

        if (error) {
          throw new Error(
            error.message
          );
        }

        setMessage(
          "Bonus rule saved."
        );

        await load();
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
            : "Bonus rule could not be saved."
        );
      } finally {
        setSaving(
          false
        );
      }
    }

    async function deleteBonusRule(
      ruleId:
        number
    ) {
      if (
        ruleId <=
        0
      ) {
        setScoringRules(
          (
            current
          ) =>
            current.filter(
              (
                rule
              ) =>
                rule.id !==
                ruleId
            )
        );

        return;
      }

      if (saving) {
        return;
      }

      const confirmed =
        window.confirm(
          "Delete this scoring bonus rule?"
        );

      if (
        !confirmed
      ) {
        return;
      }

      setSaving(
        true
      );
      setMessage("");
      setIsError(false);

      try {
        const {
          error,
        } =
          await supabase.rpc(
            "delete_commissioner_scoring_rule",
            {
              p_league_id:
                leagueId,
              p_rule_id:
                ruleId,
            }
          );

        if (error) {
          throw new Error(
            error.message
          );
        }

        setMessage(
          "Bonus rule deleted."
        );

        await load();
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
            : "Bonus rule could not be deleted."
        );
      } finally {
        setSaving(
          false
        );
      }
    }

    function addBonusRule() {
      const group =
        scoringGroups[
          scoringCategory
        ];

      const tempId =
        -Date.now();

      setScoringRules(
        (
          current
        ) => [
          ...current,
          {
            id:
              tempId,
            league_id:
              leagueId,
            category:
              group.label,
            rule_type:
              "threshold",
            stat_key:
              group
                .bonusStats[
                0
              ]?.[
                0
              ] ??
              "",
            min_value:
              0,
            max_value:
              null,
            points:
              0,
            is_enabled:
              true,
            stacking_mode:
              "highest_only",
            priority:
              current.length +
              1,
            label:
              `${group.label} Bonus`,
          },
        ]
      );
    }

    const group =
      scoringGroups[
        scoringCategory
      ];

    const visibleRules =
      scoringRules.filter(
        (
          rule
        ) =>
          rule.category
            .trim()
            .toLowerCase() ===
          group.label
            .trim()
            .toLowerCase()
      );

    if (loading) {
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
            <div
              style={
                styles.loading
              }
            >
              Loading scoring settings…
            </div>
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
        <div
          style={
            styles.shell
          }
        >
          <header
            style={
              styles.hero
            }
          >
            <div>
              <div
                style={
                  styles.eyebrow
                }
              >
                {eyebrow}
              </div>

              <h1
                style={
                  styles.title
                }
              >
                Scoring Settings
              </h1>

              <p
                style={
                  styles.subtitle
                }
              >
                {league?.name ??
                  "Gridiron365 League"}
                {" · "}
                Season{" "}
                {league?.season ??
                  "—"}
              </p>
            </div>

            <div
              style={
                styles.modeBadge
              }
            >
              {displayName}
            </div>
          </header>

          <section
            style={
              styles.notice
            }
          >
            <strong>
              SAME SCORING SYSTEM
            </strong>

            <span>
              {modeDescription}
              {" "}
              Passing, rushing and receiving use points-per-yard controls. Kicking includes field-goal distance ranges. Bonus families use highest-only non-stacking logic.
            </span>
          </section>

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
                    styles.smallLabel
                  }
                >
                  SCORING CATEGORY
                </div>

                <h2
                  style={
                    styles.sectionTitle
                  }
                >
                  Choose a Category
                </h2>
              </div>
            </div>

            <div
              style={
                styles.tabs
              }
            >
              {(
                Object.keys(
                  scoringGroups
                ) as
                  ScoringCategoryKey[]
              ).map(
                (
                  key
                ) => (
                  <button
                    key={
                      key
                    }
                    type="button"
                    onClick={() =>
                      setScoringCategory(
                        key
                      )
                    }
                    style={{
                      ...styles.tab,
                      ...(scoringCategory ===
                      key
                        ? styles.tabActive
                        : {}),
                    }}
                  >
                    {
                      scoringGroups[
                        key
                      ].label
                    }
                  </button>
                )
              )}
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
                    styles.smallLabel
                  }
                >
                  {group.label.toUpperCase()}
                  {" "}
                  BASE SCORING
                </div>

                <h2
                  style={
                    styles.sectionTitle
                  }
                >
                  Core Points
                </h2>

                <p
                  style={
                    styles.sectionSub
                  }
                >
                  {
                    group.description
                  }
                </p>
              </div>
            </div>

            <div
              style={
                styles.grid
              }
            >
              {group.baseFields.map(
                ([
                  key,
                  label,
                ]) => (
                  <Field
                    key={
                      String(
                        key
                      )
                    }
                    label={
                      label
                    }
                    value={
                      inputValue(
                        scoring[
                          key
                        ] as
                          number |
                          string |
                          null |
                          undefined
                      )
                    }
                    onChange={(
                      value
                    ) =>
                      setScoring(
                        (
                          current
                        ) => ({
                          ...current,
                          [
                            key
                          ]:
                            value ===
                            ""
                              ? null
                              : value,
                        })
                      )
                    }
                  />
                )
              )}
            </div>

            <div
              style={
                styles.advanced
              }
            >
              <label
                style={
                  styles.field
                }
              >
                <span
                  style={
                    styles.fieldLabel
                  }
                >
                  Fractional Scoring
                </span>

                <select
                  value={
                    scoring
                      .fractional_scoring_enabled
                      ? "true"
                      : "false"
                  }
                  onChange={(
                    event
                  ) =>
                    setScoring(
                      (
                        current
                      ) => ({
                        ...current,
                        fractional_scoring_enabled:
                          event
                            .target
                            .value ===
                          "true",
                      })
                    )
                  }
                  style={
                    styles.input
                  }
                >
                  <option value="true">
                    Enabled
                  </option>

                  <option value="false">
                    Disabled
                  </option>
                </select>
              </label>

              <Field
                label="Decimal Places"
                value={
                  inputValue(
                    scoring.decimal_places
                  )
                }
                onChange={(
                  value
                ) =>
                  setScoring(
                    (
                      current
                    ) => ({
                      ...current,
                      decimal_places:
                        numberValue(
                          value,
                          2
                        ),
                    })
                  )
                }
              />
            </div>

            <div
              style={
                styles.actions
              }
            >
              <button
                type="button"
                disabled={
                  saving
                }
                onClick={() =>
                  void saveBaseScoring()
                }
                style={
                  styles.primaryButton
                }
              >
                {saving
                  ? "SAVING…"
                  : "SAVE BASE SCORING"}
              </button>
            </div>
          </section>

          <section
            style={
              styles.section
            }
          >
            <div
              style={
                styles.bonusHeader
              }
            >
              <div>
                <div
                  style={
                    styles.smallLabel
                  }
                >
                  {group.label.toUpperCase()}
                  {" "}
                  BONUS RULES
                </div>

                <h2
                  style={
                    styles.sectionTitle
                  }
                >
                  Milestones & Bonuses
                </h2>

                <p
                  style={
                    styles.sectionSub
                  }
                >
                  Add yardage milestones, multiple-touchdown bonuses, long-play or long-TD bonuses, kicking bonuses, or other thresholds. Minimum and Maximum define the qualifying range.
                </p>

                <div
                  style={
                    styles.ruleNotice
                  }
                >
                  <strong>
                    Non-stacking:
                  </strong>
                  {" "}
                  when multiple enabled thresholds in the same bonus family qualify, only the highest qualifying bonus is awarded.
                </div>
              </div>

              <button
                type="button"
                onClick={
                  addBonusRule
                }
                style={
                  styles.secondaryButton
                }
              >
                + ADD BONUS RULE
              </button>
            </div>

            <div
              style={
                styles.ruleList
              }
            >
              {visibleRules.map(
                (
                  rule
                ) => (
                  <div
                    key={
                      rule.id
                    }
                    style={
                      styles.ruleCard
                    }
                  >
                    <Field
                      label="Rule Name"
                      value={
                        rule.label ??
                        ""
                      }
                      text
                      onChange={(
                        value
                      ) =>
                        setScoringRules(
                          (
                            current
                          ) =>
                            current.map(
                              (
                                row
                              ) =>
                                row.id ===
                                rule.id
                                  ? {
                                      ...row,
                                      label:
                                        value,
                                    }
                                  : row
                            )
                        )
                      }
                    />

                    <label
                      style={
                        styles.field
                      }
                    >
                      <span
                        style={
                          styles.fieldLabel
                        }
                      >
                        Statistic
                      </span>

                      <select
                        value={
                          rule.stat_key
                        }
                        onChange={(
                          event
                        ) =>
                          setScoringRules(
                            (
                              current
                            ) =>
                              current.map(
                                (
                                  row
                                ) =>
                                  row.id ===
                                  rule.id
                                    ? {
                                        ...row,
                                        stat_key:
                                          event
                                            .target
                                            .value,
                                      }
                                    : row
                              )
                          )
                        }
                        style={
                          styles.input
                        }
                      >
                        {group.bonusStats.map(
                          ([
                            key,
                            label,
                          ]) => (
                            <option
                              key={
                                key
                              }
                              value={
                                key
                              }
                            >
                              {
                                label
                              }
                            </option>
                          )
                        )}
                      </select>
                    </label>

                    <Field
                      label="Minimum"
                      value={
                        inputValue(
                          rule.min_value
                        )
                      }
                      onChange={(
                        value
                      ) =>
                        setScoringRules(
                          (
                            current
                          ) =>
                            current.map(
                              (
                                row
                              ) =>
                                row.id ===
                                rule.id
                                  ? {
                                      ...row,
                                      min_value:
                                        value ===
                                        ""
                                          ? null
                                          : value,
                                    }
                                  : row
                            )
                        )
                      }
                    />

                    <Field
                      label="Maximum (optional)"
                      value={
                        inputValue(
                          rule.max_value
                        )
                      }
                      onChange={(
                        value
                      ) =>
                        setScoringRules(
                          (
                            current
                          ) =>
                            current.map(
                              (
                                row
                              ) =>
                                row.id ===
                                rule.id
                                  ? {
                                      ...row,
                                      max_value:
                                        value ===
                                        ""
                                          ? null
                                          : value,
                                    }
                                  : row
                            )
                        )
                      }
                    />

                    <Field
                      label="Bonus Points"
                      value={
                        inputValue(
                          rule.points
                        )
                      }
                      onChange={(
                        value
                      ) =>
                        setScoringRules(
                          (
                            current
                          ) =>
                            current.map(
                              (
                                row
                              ) =>
                                row.id ===
                                rule.id
                                  ? {
                                      ...row,
                                      points:
                                        value,
                                    }
                                  : row
                            )
                        )
                      }
                    />

                    <label
                      style={
                        styles.checkboxField
                      }
                    >
                      <input
                        type="checkbox"
                        checked={
                          rule.is_enabled
                        }
                        onChange={(
                          event
                        ) =>
                          setScoringRules(
                            (
                              current
                            ) =>
                              current.map(
                                (
                                  row
                                ) =>
                                  row.id ===
                                  rule.id
                                    ? {
                                        ...row,
                                        is_enabled:
                                          event
                                            .target
                                            .checked,
                                      }
                                    : row
                              )
                          )
                        }
                      />

                      <span>
                        Enabled
                      </span>
                    </label>

                    <div
                      style={
                        styles.ruleActions
                      }
                    >
                      <button
                        type="button"
                        disabled={
                          saving
                        }
                        onClick={() =>
                          void saveBonusRule(
                            rule
                          )
                        }
                        style={
                          styles.primaryButton
                        }
                      >
                        SAVE
                      </button>

                      <button
                        type="button"
                        disabled={
                          saving
                        }
                        onClick={() =>
                          void deleteBonusRule(
                            rule.id
                          )
                        }
                        style={
                          styles.dangerButton
                        }
                      >
                        DELETE
                      </button>
                    </div>
                  </div>
                )
              )}

              {visibleRules.length ===
              0 ? (
                <div
                  style={
                    styles.empty
                  }
                >
                  No{" "}
                  {group.label.toLowerCase()}
                  {" "}
                  bonus rules yet. Use
                  {" "}
                  <strong>
                    + ADD BONUS RULE
                  </strong>
                  {" "}
                  to create one.
                </div>
              ) : null}
            </div>
          </section>
        </div>
      </main>
    );
  };
}

function Field({
  label,
  value,
  onChange,
  text = false,
}: {
  label: string;
  value: string;
  onChange: (
    value:
      string
  ) => void;
  text?: boolean;
}) {
  return (
    <label
      style={
        styles.field
      }
    >
      <span
        style={
          styles.fieldLabel
        }
      >
        {label}
      </span>

      <input
        type={
          text
            ? "text"
            : "number"
        }
        step={
          text
            ? undefined
            : "any"
        }
        value={
          value
        }
        onChange={(
          event
        ) =>
          onChange(
            event.target
              .value
          )
        }
        style={
          styles.input
        }
      />
    </label>
  );
}

const styles:
  Record<
    string,
    React.CSSProperties
  > = {
  page: {
    minHeight:
      "100vh",
    background:
      "linear-gradient(180deg, #080808 0%, #101010 100%)",
    color:
      "#fff",
    padding:
      "28px 18px 60px",
  },

  shell: {
    width:
      "min(1480px, 100%)",
    margin:
      "0 auto",
  },

  loading: {
    padding:
      "48px",
    border:
      "1px solid #292929",
    borderRadius:
      "18px",
    background:
      "#111",
    color:
      "#d0d0d0",
    textAlign:
      "center",
  },

  hero: {
    display:
      "flex",
    justifyContent:
      "space-between",
    alignItems:
      "flex-start",
    gap:
      "20px",
    padding:
      "26px",
    marginBottom:
      "16px",
    border:
      "1px solid #342019",
    borderRadius:
      "20px",
    background:
      "linear-gradient(135deg, rgba(125,14,14,.26), rgba(255,92,0,.10) 55%, rgba(0,0,0,.4))",
  },

  eyebrow: {
    fontSize:
      "12px",
    fontWeight:
      900,
    letterSpacing:
      "1.4px",
    color:
      "#ff7440",
    marginBottom:
      "8px",
  },

  title: {
    margin:
      0,
    fontSize:
      "clamp(30px, 4vw, 48px)",
    lineHeight:
      1,
    letterSpacing:
      "-1px",
  },

  subtitle: {
    margin:
      "10px 0 0",
    color:
      "#b7b7b7",
    fontSize:
      "15px",
  },

  modeBadge: {
    whiteSpace:
      "nowrap",
    border:
      "1px solid #6b2a13",
    background:
      "linear-gradient(135deg, #7e1212, #e44b09)",
    borderRadius:
      "999px",
    padding:
      "9px 13px",
    fontSize:
      "12px",
    fontWeight:
      900,
    letterSpacing:
      ".6px",
  },

  notice: {
    display:
      "grid",
    gap:
      "6px",
    marginBottom:
      "16px",
    padding:
      "16px 18px",
    borderRadius:
      "14px",
    border:
      "1px solid #5a3514",
    background:
      "rgba(255,122,0,.07)",
    color:
      "#dedede",
    fontSize:
      "14px",
    lineHeight:
      1.55,
  },

  success: {
    marginBottom:
      "16px",
    padding:
      "14px 16px",
    border:
      "1px solid #215c35",
    borderRadius:
      "12px",
    background:
      "rgba(39,155,82,.10)",
    color:
      "#8ee2aa",
    fontWeight:
      800,
  },

  error: {
    marginBottom:
      "16px",
    padding:
      "14px 16px",
    border:
      "1px solid #7a2929",
    borderRadius:
      "12px",
    background:
      "rgba(170,30,30,.12)",
    color:
      "#ff9b9b",
    fontWeight:
      800,
  },

  section: {
    marginTop:
      "16px",
    padding:
      "22px",
    border:
      "1px solid #272727",
    borderRadius:
      "18px",
    background:
      "#111",
    boxShadow:
      "0 16px 40px rgba(0,0,0,.22)",
  },

  sectionHeader: {
    display:
      "flex",
    justifyContent:
      "space-between",
    alignItems:
      "flex-start",
    gap:
      "16px",
    marginBottom:
      "18px",
  },

  smallLabel: {
    marginBottom:
      "6px",
    fontSize:
      "11px",
    fontWeight:
      900,
    letterSpacing:
      "1.2px",
    color:
      "#ff6630",
  },

  sectionTitle: {
    margin:
      0,
    fontSize:
      "23px",
    lineHeight:
      1.15,
  },

  sectionSub: {
    margin:
      "8px 0 0",
    maxWidth:
      "980px",
    color:
      "#9e9e9e",
    lineHeight:
      1.55,
    fontSize:
      "14px",
  },

  tabs: {
    display:
      "flex",
    flexWrap:
      "wrap",
    gap:
      "8px",
  },

  tab: {
    border:
      "1px solid #333",
    background:
      "#171717",
    color:
      "#d2d2d2",
    borderRadius:
      "999px",
    padding:
      "9px 13px",
    cursor:
      "pointer",
    fontWeight:
      800,
    fontSize:
      "13px",
  },

  tabActive: {
    border:
      "1px solid #b53b10",
    background:
      "linear-gradient(135deg, #8e1616, #e14b0b)",
    color:
      "#fff",
  },

  grid: {
    display:
      "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(230px, 1fr))",
    gap:
      "12px",
  },

  field: {
    display:
      "grid",
    gap:
      "7px",
    alignContent:
      "start",
  },

  fieldLabel: {
    color:
      "#bdbdbd",
    fontSize:
      "12px",
    fontWeight:
      800,
    letterSpacing:
      ".25px",
  },

  input: {
    width:
      "100%",
    minHeight:
      "43px",
    boxSizing:
      "border-box",
    border:
      "1px solid #343434",
    borderRadius:
      "10px",
    background:
      "#0b0b0b",
    color:
      "#fff",
    padding:
      "10px 11px",
    outline:
      "none",
  },

  advanced: {
    display:
      "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(220px, 1fr))",
    gap:
      "12px",
    marginTop:
      "16px",
    paddingTop:
      "16px",
    borderTop:
      "1px solid #272727",
  },

  actions: {
    display:
      "flex",
    justifyContent:
      "flex-end",
    gap:
      "10px",
    marginTop:
      "18px",
  },

  primaryButton: {
    border:
      "1px solid #d14a13",
    background:
      "linear-gradient(135deg, #a61616, #ee590c)",
    color:
      "#fff",
    borderRadius:
      "10px",
    padding:
      "10px 14px",
    cursor:
      "pointer",
    fontWeight:
      900,
    letterSpacing:
      ".3px",
  },

  secondaryButton: {
    border:
      "1px solid #5f311d",
    background:
      "#1a120e",
    color:
      "#ff8b55",
    borderRadius:
      "10px",
    padding:
      "10px 14px",
    cursor:
      "pointer",
    fontWeight:
      900,
  },

  dangerButton: {
    border:
      "1px solid #6e2626",
    background:
      "#231010",
    color:
      "#ff8181",
    borderRadius:
      "10px",
    padding:
      "10px 14px",
    cursor:
      "pointer",
    fontWeight:
      900,
  },

  bonusHeader: {
    display:
      "flex",
    justifyContent:
      "space-between",
    alignItems:
      "flex-start",
    gap:
      "18px",
    marginBottom:
      "16px",
  },

  ruleNotice: {
    marginTop:
      "12px",
    padding:
      "11px 13px",
    border:
      "1px solid #4b341c",
    borderRadius:
      "10px",
    background:
      "rgba(255,145,0,.06)",
    color:
      "#d0c3b6",
    lineHeight:
      1.45,
    fontSize:
      "13px",
  },

  ruleList: {
    display:
      "grid",
    gap:
      "12px",
  },

  ruleCard: {
    display:
      "grid",
    gridTemplateColumns:
      "minmax(200px, 1.3fr) minmax(230px, 1.5fr) minmax(120px, .7fr) minmax(150px, .8fr) minmax(120px, .7fr) auto",
    gap:
      "10px",
    alignItems:
      "end",
    padding:
      "14px",
    border:
      "1px solid #2b2b2b",
    borderRadius:
      "14px",
    background:
      "#0d0d0d",
  },

  checkboxField: {
    minHeight:
      "43px",
    display:
      "flex",
    alignItems:
      "center",
    gap:
      "8px",
    color:
      "#ddd",
    fontSize:
      "12px",
    fontWeight:
      900,
  },

  ruleActions: {
    display:
      "flex",
    alignItems:
      "center",
    gap:
      "8px",
    flexWrap:
      "wrap",
  },

  empty: {
    padding:
      "22px",
    border:
      "1px dashed #333",
    borderRadius:
      "12px",
    color:
      "#929292",
    textAlign:
      "center",
  },
};

const SeasonLongScoring =
  makeComponent(
    "SEASON-LONG",
    "GRIDIRON365 · SEASON-LONG · COMMISSIONER",
    "Salary and No-Salary Season-Long leagues use this exact same scoring configuration."
  );

export default SeasonLongScoring;
