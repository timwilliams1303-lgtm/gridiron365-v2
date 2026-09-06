"use client";

import {
  FormEvent,
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

type Props = {
  leagueId: string;
  season: number;
};

type MarketMode =
  | "puck_line_only"
  | "total_only"
  | "puck_line_and_total";

type ScoringMode =
  | "record_only"
  | "standard"
  | "confidence";

type MissingPickPolicy =
  | "loss"
  | "ungraded";

type SettingsRow = {
  league_id: string;

  picks_per_period: number;

  market_mode:
    MarketMode;

  allow_same_game_multiple_markets:
    boolean;

  pick_lock_mode:
    string;

  minimum_source_books:
    number;

  scoring_mode:
    ScoringMode;

  win_points:
    number | string;

  push_points:
    number | string;

  loss_points:
    number | string;

  confidence_points:
    Array<
      number | string
    >;

  confidence_push_multiplier:
    number | string;

  missing_pick_policy:
    MissingPickPolicy;

  contest_timezone:
    string;

  updated_at:
    string;
};

type PeriodRow = {
  id: number;

  period_number: number;

  starts_at: string;

  ends_at: string;

  status: string;

  finalized_at:
    | string
    | null;
};

type RenewalResult = {
  success?: boolean;

  oldLeagueId?: string;

  newLeagueId?: string;

  oldSeason?: number;

  newSeason?: number;

  historyId?:
    | string
    | null;

  membersRenewed?: number;
};

function numberValue(
  value:
    | number
    | string
    | null
    | undefined
) {
  const parsed =
    Number(value);

  return Number.isFinite(
    parsed
  )
    ? parsed
    : 0;
}

function formatNumber(
  value:
    | number
    | string
    | null
    | undefined
) {
  return numberValue(
    value
  )
    .toFixed(2)
    .replace(
      /\.00$/,
      ""
    )
    .replace(
      /(\.\d)0$/,
      "$1"
    );
}

function dateInputValue(
  value:
    | string
    | null
    | undefined
) {
  if (!value) {
    return "";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }

  return new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone:
        "America/New_York",

      year:
        "numeric",

      month:
        "2-digit",

      day:
        "2-digit",
    }
  ).format(date);
}

function formatDate(
  value:
    | string
    | null
    | undefined
) {
  if (!value) {
    return "—";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "en-US",
    {
      timeZone:
        "America/New_York",

      month:
        "short",

      day:
        "numeric",

      year:
        "numeric",
    }
  ).format(date);
}

const CSS = `
  .g365-nhl-commissioner {
    width: 100%;
    min-width: 0;
    box-sizing: border-box;
  }

  .g365-nhl-commissioner * {
    box-sizing: border-box;
  }

  .g365-nhl-commissioner-grid {
    display: grid;
    grid-template-columns:
      repeat(
        2,
        minmax(
          0,
          1fr
        )
      );
    gap: 14px;
  }

  .g365-nhl-form-grid {
    display: grid;
    grid-template-columns:
      repeat(
        2,
        minmax(
          0,
          1fr
        )
      );
    gap: 11px;
  }

  .g365-nhl-form-grid-3 {
    display: grid;
    grid-template-columns:
      repeat(
        3,
        minmax(
          0,
          1fr
        )
      );
    gap: 10px;
  }

  .g365-nhl-period-table-wrap {
    width: 100%;
    overflow-x: auto;
  }

  .g365-nhl-period-table {
    width: 100%;
    min-width: 620px;
    border-collapse: collapse;
  }

  .g365-nhl-period-table th,
  .g365-nhl-period-table td {
    padding: 10px 11px;
    border-bottom:
      1px solid
      rgba(
        255,
        255,
        255,
        0.055
      );
    text-align: left;
  }

  .g365-nhl-period-table th {
    color: #777780;
    font-size: 9px;
    font-weight: 1000;
    letter-spacing: 0.07em;
  }

  .g365-nhl-period-table td {
    color: #d8d8dc;
    font-size: 11px;
  }

  @media (max-width: 900px) {
    .g365-nhl-commissioner-grid {
      grid-template-columns:
        1fr;
    }
  }

  @media (max-width: 700px) {
    .g365-nhl-form-grid,
    .g365-nhl-form-grid-3 {
      grid-template-columns:
        1fr;
    }

    .g365-nhl-commissioner {
      padding:
        14px 12px 32px !important;
    }

    .g365-nhl-commissioner-hero {
      padding:
        16px !important;
    }
  }

  @media (max-width: 430px) {
    .g365-nhl-commissioner {
      padding:
        12px 10px 28px !important;
    }
  }
`;

export default function NhlPickemCommissioner({
  leagueId,
  season,
}: Props) {
  const router =
    useRouter();

  const supabase =
    useMemo(
      () =>
        createSupabaseBrowserClient(),
      []
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
    periodWorking,
    setPeriodWorking,
  ] =
    useState(false);

  const [
    renewing,
    setRenewing,
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

  const [
    settings,
    setSettings,
  ] =
    useState<
      SettingsRow | null
    >(
      null
    );

  const [
    periods,
    setPeriods,
  ] =
    useState<
      PeriodRow[]
    >([]);

  const [
    picksPerPeriod,
    setPicksPerPeriod,
  ] =
    useState(5);

  const [
    marketMode,
    setMarketMode,
  ] =
    useState<
      MarketMode
    >(
      "puck_line_and_total"
    );

  const [
    allowSameGameMultipleMarkets,
    setAllowSameGameMultipleMarkets,
  ] =
    useState(false);

  const [
    minimumSourceBooks,
    setMinimumSourceBooks,
  ] =
    useState(2);

  const [
    scoringMode,
    setScoringMode,
  ] =
    useState<
      ScoringMode
    >(
      "record_only"
    );

  const [
    winPoints,
    setWinPoints,
  ] =
    useState(1);

  const [
    pushPoints,
    setPushPoints,
  ] =
    useState(0.5);

  const [
    lossPoints,
    setLossPoints,
  ] =
    useState(0);

  const [
    confidencePointsText,
    setConfidencePointsText,
  ] =
    useState(
      "50,40,30,20,10"
    );

  const [
    confidencePushMultiplier,
    setConfidencePushMultiplier,
  ] =
    useState(0.5);

  const [
    missingPickPolicy,
    setMissingPickPolicy,
  ] =
    useState<
      MissingPickPolicy
    >(
      "ungraded"
    );

  const [
    anchorDate,
    setAnchorDate,
  ] =
    useState("");

  const [
    periodCount,
    setPeriodCount,
  ] =
    useState(30);

  const [
    renewalSeason,
    setRenewalSeason,
  ] =
    useState(
      season + 1
    );

  const load =
    useCallback(
      async () => {
        const [
          settingsResponse,
          periodsResponse,
        ] =
          await Promise.all([
            supabase
              .from(
                "nhl_pickem_settings"
              )
              .select(
                [
                  "league_id",
                  "picks_per_period",
                  "market_mode",
                  "allow_same_game_multiple_markets",
                  "pick_lock_mode",
                  "minimum_source_books",
                  "scoring_mode",
                  "win_points",
                  "push_points",
                  "loss_points",
                  "confidence_points",
                  "confidence_push_multiplier",
                  "missing_pick_policy",
                  "contest_timezone",
                  "updated_at",
                ].join(",")
              )
              .eq(
                "league_id",
                leagueId
              )
              .maybeSingle(),

            supabase
              .from(
                "nhl_pickem_periods"
              )
              .select(
                [
                  "id",
                  "period_number",
                  "starts_at",
                  "ends_at",
                  "status",
                  "finalized_at",
                ].join(",")
              )
              .eq(
                "league_id",
                leagueId
              )
              .eq(
                "season",
                season
              )
              .order(
                "period_number",
                {
                  ascending:
                    true,
                }
              ),
          ]);

        if (
          settingsResponse.error
        ) {
          throw new Error(
            settingsResponse.error.message
          );
        }

        if (
          periodsResponse.error
        ) {
          throw new Error(
            periodsResponse.error.message
          );
        }

        const nextSettings =
          settingsResponse.data as
            | SettingsRow
            | null;

        const nextPeriods =
          (
            periodsResponse.data ??
            []
          ) as unknown as PeriodRow[];

        setSettings(
          nextSettings
        );

        setPeriods(
          nextPeriods
        );

        if (
          nextSettings
        ) {
          setPicksPerPeriod(
            Number(
              nextSettings.picks_per_period
            )
          );

          setMarketMode(
            nextSettings.market_mode
          );

          setAllowSameGameMultipleMarkets(
            Boolean(
              nextSettings.allow_same_game_multiple_markets
            )
          );

          setMinimumSourceBooks(
            Number(
              nextSettings.minimum_source_books
            )
          );

          setScoringMode(
            nextSettings.scoring_mode
          );

          setWinPoints(
            numberValue(
              nextSettings.win_points
            )
          );

          setPushPoints(
            numberValue(
              nextSettings.push_points
            )
          );

          setLossPoints(
            numberValue(
              nextSettings.loss_points
            )
          );

          setConfidencePointsText(
            (
              nextSettings.confidence_points ??
              []
            )
              .map(
                (
                  value
                ) =>
                  formatNumber(
                    value
                  )
              )
              .join(",")
          );

          setConfidencePushMultiplier(
            numberValue(
              nextSettings.confidence_push_multiplier
            )
          );

          setMissingPickPolicy(
            nextSettings.missing_pick_policy
          );
        }

        if (
          nextPeriods.length >
          0
        ) {
          setAnchorDate(
            dateInputValue(
              nextPeriods[0]
                .starts_at
            )
          );

          setPeriodCount(
            nextPeriods.length
          );
        }
      },
      [
        leagueId,
        season,
        supabase,
      ]
    );

  useEffect(() => {
    let active =
      true;

    async function run() {
      setLoading(
        true
      );

      setMessage(
        ""
      );

      setIsError(
        false
      );

      try {
        await load();
      } catch (error) {
        if (
          !active
        ) {
          return;
        }

        setIsError(
          true
        );

        setMessage(
          error instanceof Error
            ? error.message
            : "NHL Pick'em commissioner controls could not be loaded."
        );
      } finally {
        if (
          active
        ) {
          setLoading(
            false
          );
        }
      }
    }

    void run();

    return () => {
      active =
        false;
    };
  }, [
    load,
  ]);

  function parseConfidencePoints() {
    const raw =
      confidencePointsText
        .split(",")
        .map(
          (
            value
          ) =>
            value.trim()
        )
        .filter(
          Boolean
        );

    const values =
      raw.map(
        (
          value
        ) =>
          Number(
            value
          )
      );

    if (
      values.some(
        (
          value
        ) =>
          !Number.isFinite(
            value
          )
      )
    ) {
      throw new Error(
        "Confidence values must contain only numbers separated by commas."
      );
    }

    if (
      values.some(
        (
          value
        ) =>
          value < 0
      )
    ) {
      throw new Error(
        "Confidence values cannot be negative."
      );
    }

    return values;
  }

  async function saveSettings(
    event:
      FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setSaving(
      true
    );

    setMessage(
      ""
    );

    setIsError(
      false
    );

    try {
      if (
        !Number.isInteger(
          picksPerPeriod
        ) ||
        picksPerPeriod <
          1 ||
        picksPerPeriod >
          50
      ) {
        throw new Error(
          "Required picks per period must be between 1 and 50."
        );
      }

      if (
        !Number.isInteger(
          minimumSourceBooks
        ) ||
        minimumSourceBooks <
          1 ||
        minimumSourceBooks >
          50
      ) {
        throw new Error(
          "Minimum source books must be between 1 and 50."
        );
      }

      if (
        confidencePushMultiplier <
        0
      ) {
        throw new Error(
          "Confidence push multiplier cannot be negative."
        );
      }

      const confidencePoints =
        parseConfidencePoints();

      if (
        scoringMode ===
          "confidence" &&
        confidencePoints.length !==
          picksPerPeriod
      ) {
        throw new Error(
          `Confidence scoring requires exactly ${picksPerPeriod} confidence values — one for each required pick.`
        );
      }

      if (
        scoringMode ===
          "confidence" &&
        new Set(
          confidencePoints
        ).size !==
          confidencePoints.length
      ) {
        throw new Error(
          "Each confidence value must be unique."
        );
      }

      const {
        error,
      } =
        await supabase.rpc(
          "save_nhl_pickem_settings",
          {
            p_league_id:
              leagueId,

            p_picks_per_period:
              picksPerPeriod,

            p_market_mode:
              marketMode,

            p_allow_same_game_multiple_markets:
              allowSameGameMultipleMarkets,

            p_minimum_source_books:
              minimumSourceBooks,

            p_scoring_mode:
              scoringMode,

            p_win_points:
              winPoints,

            p_push_points:
              pushPoints,

            p_loss_points:
              lossPoints,

            p_confidence_points:
              confidencePoints,

            p_confidence_push_multiplier:
              confidencePushMultiplier,

            p_missing_pick_policy:
              missingPickPolicy,
          }
        );

      if (error) {
        throw new Error(
          error.message
        );
      }

      await load();

      setMessage(
        "NHL Pick'em settings saved successfully. Member-facing pages will use the updated league configuration."
      );
    } catch (error) {
      setIsError(
        true
      );

      setMessage(
        error instanceof Error
          ? error.message
          : "NHL Pick'em settings could not be saved."
      );
    } finally {
      setSaving(
        false
      );
    }
  }

  async function generatePeriods(
    event:
      FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setPeriodWorking(
      true
    );

    setMessage(
      ""
    );

    setIsError(
      false
    );

    try {
      if (
        !anchorDate
      ) {
        throw new Error(
          "Choose an NHL season anchor date."
        );
      }

      if (
        !Number.isInteger(
          periodCount
        ) ||
        periodCount <
          1 ||
        periodCount >
          60
      ) {
        throw new Error(
          "Period count must be between 1 and 60."
        );
      }

      const {
        data,
        error,
      } =
        await supabase.rpc(
          "ensure_nhl_pickem_season_periods",
          {
            p_league_id:
              leagueId,

            p_season:
              season,

            p_anchor_date:
              anchorDate,

            p_period_count:
              periodCount,
          }
        );

      if (error) {
        throw new Error(
          error.message
        );
      }

      await load();

      setMessage(
        `NHL Pick'em contest periods are ready. ${Number(
          data ?? periodCount
        )} period rows were processed.`
      );
    } catch (error) {
      setIsError(
        true
      );

      setMessage(
        error instanceof Error
          ? error.message
          : "NHL Pick'em periods could not be generated."
      );
    } finally {
      setPeriodWorking(
        false
      );
    }
  }

  async function renewLeague() {
    setRenewing(
      true
    );

    setMessage(
      ""
    );

    setIsError(
      false
    );

    try {
      if (
        !Number.isInteger(
          renewalSeason
        ) ||
        renewalSeason <=
          season
      ) {
        throw new Error(
          `Renewal season must be later than ${season}.`
        );
      }

      const {
        data,
        error,
      } =
        await supabase.rpc(
          "renew_nhl_pickem_league",
          {
            p_league_id:
              leagueId,

            p_new_season:
              renewalSeason,
          }
        );

      if (error) {
        throw new Error(
          error.message
        );
      }

      const result =
        (
          data ??
          {}
        ) as RenewalResult;

      if (
        !result.success ||
        !result.newLeagueId
      ) {
        throw new Error(
          "NHL Pick'em renewal did not return the new league."
        );
      }

      setMessage(
        `${result.newSeason ?? renewalSeason} NHL Pick'em league created. ${result.membersRenewed ?? 0} active members were carried forward.`
      );

      router.push(
        `/league/${result.newLeagueId}/nhl-pickem`
      );

      router.refresh();
    } catch (error) {
      setIsError(
        true
      );

      setMessage(
        error instanceof Error
          ? error.message
          : "NHL Pick'em league renewal failed."
      );

      setRenewing(
        false
      );
    }
  }

  if (
    loading
  ) {
    return (
      <main
        style={{
          padding:
            "22px 18px",
          color:
            "#aaaab2",
        }}
      >
        Loading NHL Pick&apos;em
        commissioner controls…
      </main>
    );
  }

  return (
    <main
      className="g365-nhl-commissioner"
      style={{
        display:
          "grid",
        gap:
          18,
        maxWidth:
          1180,
        padding:
          "22px 18px 40px",
      }}
    >
      <style>
        {CSS}
      </style>

      <section
        className="g365-nhl-commissioner-hero"
        style={{
          padding:
            20,
          borderRadius:
            18,
          border:
            "1px solid rgba(255,108,33,0.28)",
          background:
            "linear-gradient(135deg,rgba(100,7,13,0.48),rgba(17,17,21,0.98) 58%)",
        }}
      >
        <div
          style={{
            color:
              "#ff7627",
            fontSize:
              12,
            fontWeight:
              1000,
            letterSpacing:
              "0.12em",
            textTransform:
              "uppercase",
          }}
        >
          G365 NHL Pick&apos;em
        </div>

        <h1
          style={{
            margin:
              "7px 0 6px",
            color:
              "#fff",
            fontSize:
              "clamp(30px,5vw,44px)",
          }}
        >
          Commissioner
        </h1>

        <p
          style={{
            margin:
              0,
            maxWidth:
              900,
            color:
              "#a6a6ae",
            lineHeight:
              1.6,
          }}
        >
          Configure the {season}
          NHL Pick&apos;em league,
          prepare contest periods and
          manage season renewal.
          Platform-controlled G365
          line timing and individual
          puck-drop locks remain
          automatic.
        </p>
      </section>

      {message ? (
        <div
          style={{
            padding:
              "12px 14px",
            borderRadius:
              12,
            border:
              isError
                ? "1px solid rgba(255,80,80,0.40)"
                : "1px solid rgba(82,210,130,0.30)",
            background:
              isError
                ? "rgba(120,0,0,0.20)"
                : "rgba(30,120,65,0.15)",
            color:
              isError
                ? "#ff999c"
                : "#9ee8b4",
            fontSize:
              11,
            lineHeight:
              1.5,
          }}
        >
          {message}
        </div>
      ) : null}

      <form
        onSubmit={
          saveSettings
        }
        style={{
          display:
            "grid",
          gap:
            14,
        }}
      >
        <SectionCard
          eyebrow="LEAGUE RULES"
          title="NHL Pick'em Configuration"
          description="These settings control every member's active NHL Pick'em experience."
        >
          <div className="g365-nhl-form-grid">
            <Field
              label="Required Picks per Period"
              help="1–50 selections."
            >
              <input
                type="number"
                min={1}
                max={50}
                step={1}
                value={
                  picksPerPeriod
                }
                onChange={(
                  event
                ) =>
                  setPicksPerPeriod(
                    Number(
                      event.target
                        .value
                    )
                  )
                }
                style={
                  inputStyle
                }
              />
            </Field>

            <Field
              label="Pick Markets"
              help="Choose which G365 NHL markets members may select."
            >
              <select
                value={
                  marketMode
                }
                onChange={(
                  event
                ) =>
                  setMarketMode(
                    event.target
                      .value as MarketMode
                  )
                }
                style={
                  inputStyle
                }
              >
                <option value="puck_line_only">
                  G365 Puck Line
                  Only
                </option>

                <option value="total_only">
                  Game Totals
                  Only
                </option>

                <option value="puck_line_and_total">
                  Puck Line +
                  Game Totals
                </option>
              </select>
            </Field>

            <Field
              label="Minimum Source Books"
              help="Minimum sportsbook coverage required before an official G365 market can freeze."
            >
              <input
                type="number"
                min={1}
                max={50}
                step={1}
                value={
                  minimumSourceBooks
                }
                onChange={(
                  event
                ) =>
                  setMinimumSourceBooks(
                    Number(
                      event.target
                        .value
                    )
                  )
                }
                style={
                  inputStyle
                }
              />
            </Field>

            <Field
              label="Same Game, Multiple Markets"
              help="Allow a member to take both the puck line and total from the same NHL game."
            >
              <select
                value={
                  allowSameGameMultipleMarkets
                    ? "yes"
                    : "no"
                }
                onChange={(
                  event
                ) =>
                  setAllowSameGameMultipleMarkets(
                    event.target
                      .value ===
                      "yes"
                  )
                }
                style={
                  inputStyle
                }
              >
                <option value="no">
                  No
                </option>

                <option value="yes">
                  Yes
                </option>
              </select>
            </Field>
          </div>

          <LockedRuleBox
            title="Pick Lock"
            text="Individual picks lock automatically at that NHL game's puck drop. This is a G365 NHL Pick'em platform rule and is not commissioner-editable."
          />

          <LockedRuleBox
            title="Official G365 Daily Line Freeze"
            text="If the day's earliest NHL game starts before 3:00 PM ET, that day's board freezes at 5:00 AM ET. Otherwise it freezes at 11:00 AM ET."
          />
        </SectionCard>

        <SectionCard
          eyebrow="SCORING"
          title="Scoring System"
          description="Choose how period and season results are measured."
        >
          <Field
            label="Scoring Mode"
          >
            <select
              value={
                scoringMode
              }
              onChange={(
                event
              ) =>
                setScoringMode(
                  event.target
                    .value as ScoringMode
                )
              }
              style={
                inputStyle
              }
            >
              <option value="record_only">
                Record Only
              </option>

              <option value="standard">
                Standard Points
              </option>

              <option value="confidence">
                Confidence
                Points
              </option>
            </select>
          </Field>

          {scoringMode ===
          "record_only" ? (
            <InfoBox>
              Standings use wins,
              losses and pushes.
              Separate scoring points
              are not used.
            </InfoBox>
          ) : null}

          {scoringMode ===
          "standard" ? (
            <div className="g365-nhl-form-grid-3">
              <Field label="Win Points">
                <input
                  type="number"
                  step="0.1"
                  value={
                    winPoints
                  }
                  onChange={(
                    event
                  ) =>
                    setWinPoints(
                      Number(
                        event.target
                          .value
                      )
                    )
                  }
                  style={
                    inputStyle
                  }
                />
              </Field>

              <Field label="Push Points">
                <input
                  type="number"
                  step="0.1"
                  value={
                    pushPoints
                  }
                  onChange={(
                    event
                  ) =>
                    setPushPoints(
                      Number(
                        event.target
                          .value
                      )
                    )
                  }
                  style={
                    inputStyle
                  }
                />
              </Field>

              <Field label="Loss Points">
                <input
                  type="number"
                  step="0.1"
                  value={
                    lossPoints
                  }
                  onChange={(
                    event
                  ) =>
                    setLossPoints(
                      Number(
                        event.target
                          .value
                      )
                    )
                  }
                  style={
                    inputStyle
                  }
                />
              </Field>
            </div>
          ) : null}

          {scoringMode ===
          "confidence" ? (
            <div
              style={{
                display:
                  "grid",
                gap:
                  11,
              }}
            >
              <Field
                label="Confidence Point Values"
                help={`Enter exactly ${picksPerPeriod} unique values separated by commas.`}
              >
                <input
                  type="text"
                  value={
                    confidencePointsText
                  }
                  onChange={(
                    event
                  ) =>
                    setConfidencePointsText(
                      event.target
                        .value
                    )
                  }
                  placeholder="50,40,30,20,10"
                  style={
                    inputStyle
                  }
                />
              </Field>

              <Field
                label="Confidence Push Multiplier"
                help="Example: 0.5 awards half of the selected confidence value for a push."
              >
                <input
                  type="number"
                  min={0}
                  step="0.1"
                  value={
                    confidencePushMultiplier
                  }
                  onChange={(
                    event
                  ) =>
                    setConfidencePushMultiplier(
                      Number(
                        event.target
                          .value
                      )
                    )
                  }
                  style={
                    inputStyle
                  }
                />
              </Field>
            </div>
          ) : null}

          <Field
            label="Missing Pick Policy"
            help="Controls how required picks that were never submitted are handled at finalization."
          >
            <select
              value={
                missingPickPolicy
              }
              onChange={(
                event
              ) =>
                setMissingPickPolicy(
                  event.target
                    .value as MissingPickPolicy
                )
              }
              style={
                inputStyle
              }
            >
              <option value="ungraded">
                Leave Missing
                Picks Ungraded
              </option>

              <option value="loss">
                Count Missing
                Picks as Losses
              </option>
            </select>
          </Field>
        </SectionCard>

        <div>
          <button
            type="submit"
            disabled={
              saving
            }
            style={{
              ...primaryButtonStyle,

              opacity:
                saving
                  ? 0.6
                  : 1,

              cursor:
                saving
                  ? "not-allowed"
                  : "pointer",
            }}
          >
            {saving
              ? "SAVING..."
              : "SAVE NHL PICK'EM SETTINGS"}
          </button>
        </div>
      </form>

      <section className="g365-nhl-commissioner-grid">
        <SectionCard
          eyebrow="SEASON CONTROL"
          title="Contest Periods"
          description="Generate the Monday–Sunday Eastern contest periods used for the NHL season."
        >
          <form
            onSubmit={
              generatePeriods
            }
            style={{
              display:
                "grid",
              gap:
                11,
            }}
          >
            <Field
              label="NHL Season Anchor Date"
              help="Choose any date during the first desired contest period. The database automatically normalizes it back to Monday."
            >
              <input
                type="date"
                value={
                  anchorDate
                }
                onChange={(
                  event
                ) =>
                  setAnchorDate(
                    event.target
                      .value
                  )
                }
                style={
                  inputStyle
                }
              />
            </Field>

            <Field
              label="Number of Contest Periods"
              help="1–60 weekly Monday–Sunday periods."
            >
              <input
                type="number"
                min={1}
                max={60}
                step={1}
                value={
                  periodCount
                }
                onChange={(
                  event
                ) =>
                  setPeriodCount(
                    Number(
                      event.target
                        .value
                    )
                  )
                }
                style={
                  inputStyle
                }
              />
            </Field>

            <button
              type="submit"
              disabled={
                periodWorking
              }
              style={{
                ...secondaryButtonStyle,

                opacity:
                  periodWorking
                    ? 0.6
                    : 1,
              }}
            >
              {periodWorking
                ? "PREPARING..."
                : "PREPARE CONTEST PERIODS"}
            </button>
          </form>
        </SectionCard>

        <SectionCard
          eyebrow="RENEWAL"
          title="Renew NHL Pick'em"
          description="Create a new season while keeping the league's continuous history and active franchise identities."
        >
          <Field
            label="New Season"
            help={`Must be later than ${season}.`}
          >
            <input
              type="number"
              min={
                season + 1
              }
              max={2100}
              step={1}
              value={
                renewalSeason
              }
              onChange={(
                event
              ) =>
                setRenewalSeason(
                  Number(
                    event.target
                      .value
                  )
                )
              }
              style={
                inputStyle
              }
            />
          </Field>

          <InfoBox>
            Renewal carries forward
            the NHL Pick&apos;em
            settings, commissioner,
            active owners, entries,
            fantasy teams and
            persistent franchise
            history. New contest
            periods are generated
            separately after renewal.
          </InfoBox>

          <button
            type="button"
            disabled={
              renewing
            }
            onClick={() =>
              void renewLeague()
            }
            style={{
              ...dangerButtonStyle,

              opacity:
                renewing
                  ? 0.6
                  : 1,

              cursor:
                renewing
                  ? "not-allowed"
                  : "pointer",
            }}
          >
            {renewing
              ? "RENEWING..."
              : `RENEW FOR ${renewalSeason}`}
          </button>
        </SectionCard>
      </section>

      <SectionCard
        eyebrow="PERIOD STATUS"
        title={`${season} Contest Calendar`}
        description="Current contest periods generated for this league."
      >
        {periods.length ===
        0 ? (
          <InfoBox>
            No NHL Pick&apos;em
            periods have been
            generated yet.
          </InfoBox>
        ) : (
          <div className="g365-nhl-period-table-wrap">
            <table className="g365-nhl-period-table">
              <thead>
                <tr>
                  <th>
                    PERIOD
                  </th>

                  <th>
                    START
                  </th>

                  <th>
                    END
                  </th>

                  <th>
                    STATUS
                  </th>

                  <th>
                    FINALIZED
                  </th>
                </tr>
              </thead>

              <tbody>
                {periods.map(
                  (
                    period
                  ) => (
                    <tr
                      key={
                        period.id
                      }
                    >
                      <td
                        style={{
                          color:
                            "#fff",
                          fontWeight:
                            1000,
                        }}
                      >
                        {
                          period.period_number
                        }
                      </td>

                      <td>
                        {formatDate(
                          period.starts_at
                        )}
                      </td>

                      <td>
                        {formatDate(
                          period.ends_at
                        )}
                      </td>

                      <td>
                        <StatusBadge
                          value={
                            period.status
                          }
                        />
                      </td>

                      <td>
                        {period.finalized_at
                          ? formatDate(
                              period.finalized_at
                            )
                          : "—"}
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {settings?.updated_at ? (
        <div
          style={{
            color:
              "#676770",
            fontSize:
              9,
          }}
        >
          Commissioner settings last
          saved{" "}
          {formatDate(
            settings.updated_at
          )}
          .
        </div>
      ) : null}
    </main>
  );
}

function SectionCard({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children:
    React.ReactNode;
}) {
  return (
    <section
      style={{
        display:
          "grid",
        alignContent:
          "start",
        gap:
          14,
        padding:
          16,
        borderRadius:
          16,
        border:
          "1px solid rgba(255,255,255,0.08)",
        background:
          "#101014",
      }}
    >
      <div>
        <div
          style={{
            color:
              "#ff7627",
            fontSize:
              9,
            fontWeight:
              1000,
            letterSpacing:
              "0.09em",
          }}
        >
          {eyebrow}
        </div>

        <h2
          style={{
            margin:
              "4px 0 0",
            color:
              "#fff",
            fontSize:
              20,
          }}
        >
          {title}
        </h2>

        <p
          style={{
            margin:
              "6px 0 0",
            color:
              "#85858e",
            fontSize:
              11,
            lineHeight:
              1.5,
          }}
        >
          {description}
        </p>
      </div>

      {children}
    </section>
  );
}

function Field({
  label,
  help,
  children,
}: {
  label: string;
  help?: string;
  children:
    React.ReactNode;
}) {
  return (
    <label
      style={{
        display:
          "grid",
        gap:
          6,
      }}
    >
      <span
        style={{
          color:
            "#d8d8dd",
          fontSize:
            10,
          fontWeight:
            1000,
        }}
      >
        {label}
      </span>

      {children}

      {help ? (
        <span
          style={{
            color:
              "#73737c",
            fontSize:
              9,
            lineHeight:
              1.4,
          }}
        >
          {help}
        </span>
      ) : null}
    </label>
  );
}

function LockedRuleBox({
  title,
  text,
}: {
  title: string;
  text: string;
}) {
  return (
    <div
      style={{
        padding:
          "11px 12px",
        borderRadius:
          11,
        border:
          "1px solid rgba(255,118,39,0.13)",
        background:
          "rgba(255,118,39,0.055)",
      }}
    >
      <div
        style={{
          color:
            "#ff9b59",
          fontSize:
            9,
          fontWeight:
            1000,
          letterSpacing:
            "0.05em",
        }}
      >
        {title.toUpperCase()}
      </div>

      <div
        style={{
          marginTop:
            5,
          color:
            "#96969f",
          fontSize:
            10,
          lineHeight:
            1.5,
        }}
      >
        {text}
      </div>
    </div>
  );
}

function InfoBox({
  children,
}: {
  children:
    React.ReactNode;
}) {
  return (
    <div
      style={{
        padding:
          "11px 12px",
        borderRadius:
          10,
        background:
          "rgba(255,255,255,0.025)",
        border:
          "1px solid rgba(255,255,255,0.055)",
        color:
          "#91919a",
        fontSize:
          10,
        lineHeight:
          1.5,
      }}
    >
      {children}
    </div>
  );
}

function StatusBadge({
  value,
}: {
  value: string;
}) {
  const normalized =
    value.toLowerCase();

  let color =
    "#aaaab2";

  let background =
    "rgba(255,255,255,0.06)";

  if (
    normalized ===
    "open"
  ) {
    color =
      "#9ee8b4";

    background =
      "rgba(50,160,90,0.12)";
  } else if (
    normalized ===
    "final"
  ) {
    color =
      "#ff9b59";

    background =
      "rgba(255,118,39,0.10)";
  } else if (
    normalized ===
    "locked"
  ) {
    color =
      "#ffb4b4";

    background =
      "rgba(180,40,40,0.12)";
  }

  return (
    <span
      style={{
        display:
          "inline-flex",
        padding:
          "4px 7px",
        borderRadius:
          999,
        background,
        color,
        fontSize:
          8,
        fontWeight:
          1000,
        letterSpacing:
          "0.05em",
        textTransform:
          "uppercase",
      }}
    >
      {value}
    </span>
  );
}

const inputStyle:
  React.CSSProperties = {
    width:
      "100%",
    minHeight:
      42,
    padding:
      "9px 11px",
    borderRadius:
      10,
    border:
      "1px solid rgba(255,255,255,0.10)",
    outline:
      "none",
    background:
      "#09090c",
    color:
      "#fff",
    fontSize:
      12,
    fontWeight:
      800,
  };

const primaryButtonStyle:
  React.CSSProperties = {
    minHeight:
      46,
    padding:
      "0 18px",
    borderRadius:
      12,
    border:
      "1px solid rgba(255,118,39,0.60)",
    background:
      "linear-gradient(90deg,#a61919,#f0631d)",
    color:
      "#fff",
    fontSize:
      11,
    fontWeight:
      1000,
    letterSpacing:
      "0.05em",
  };

const secondaryButtonStyle:
  React.CSSProperties = {
    minHeight:
      44,
    padding:
      "0 16px",
    borderRadius:
      11,
    border:
      "1px solid rgba(255,118,39,0.35)",
    background:
      "rgba(255,118,39,0.08)",
    color:
      "#ff9b59",
    fontSize:
      10,
    fontWeight:
      1000,
    letterSpacing:
      "0.04em",
    cursor:
      "pointer",
  };

const dangerButtonStyle:
  React.CSSProperties = {
    minHeight:
      46,
    padding:
      "0 18px",
    borderRadius:
      12,
    border:
      "1px solid rgba(255,85,85,0.42)",
    background:
      "linear-gradient(90deg,rgba(130,13,17,0.95),rgba(192,44,22,0.95))",
    color:
      "#fff",
    fontSize:
      10,
    fontWeight:
      1000,
    letterSpacing:
      "0.05em",
  };