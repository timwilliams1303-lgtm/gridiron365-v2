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

  created_at:
    string;

  updated_at:
    string;
};

function numberValue(
  value:
    | number
    | string
    | null
    | undefined
) {
  if (
    value === null ||
    value === undefined
  ) {
    return 0;
  }

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

function marketLabel(
  value: MarketMode
) {
  if (
    value ===
    "puck_line_only"
  ) {
    return "G365 Puck Line Only";
  }

  if (
    value ===
    "total_only"
  ) {
    return "Game Totals Only";
  }

  return "Puck Line + Game Totals";
}

function scoringLabel(
  value: ScoringMode
) {
  if (
    value ===
    "standard"
  ) {
    return "Standard Points";
  }

  if (
    value ===
    "confidence"
  ) {
    return "Confidence Points";
  }

  return "Record Only";
}

function missingPickLabel(
  value:
    MissingPickPolicy
) {
  if (
    value ===
    "loss"
  ) {
    return "Count Missing Picks as Losses";
  }

  return "Leave Missing Picks Ungraded";
}

function yesNo(
  value: boolean
) {
  return value
    ? "Yes"
    : "No";
}

const CSS = `
  .g365-nhl-settings-page {
    width: 100%;
    min-width: 0;
    box-sizing: border-box;
  }

  .g365-nhl-settings-page * {
    box-sizing: border-box;
  }

  .g365-nhl-settings-grid {
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

  .g365-nhl-settings-detail-grid {
    display: grid;
    grid-template-columns:
      repeat(
        2,
        minmax(
          0,
          1fr
        )
      );
    gap: 10px;
  }

  .g365-nhl-confidence-grid {
    display: grid;
    grid-template-columns:
      repeat(
        auto-fit,
        minmax(
          70px,
          1fr
        )
      );
    gap: 8px;
  }

  @media (max-width: 820px) {
    .g365-nhl-settings-grid {
      grid-template-columns:
        1fr;
    }
  }

  @media (max-width: 760px) {
    .g365-nhl-settings-page {
      padding:
        14px 12px 30px !important;
      gap:
        14px !important;
    }

    .g365-nhl-settings-hero {
      padding:
        16px !important;
    }

    .g365-nhl-settings-page h1 {
      font-size:
        clamp(
          28px,
          8vw,
          36px
        ) !important;
    }
  }

  @media (max-width: 520px) {
    .g365-nhl-settings-detail-grid {
      grid-template-columns:
        1fr;
    }
  }

  @media (max-width: 430px) {
    .g365-nhl-settings-page {
      padding:
        12px 10px 26px !important;
    }
  }
`;

export default function NhlPickemReadOnlySettings({
  leagueId,
  season,
}: Props) {
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
    message,
    setMessage,
  ] =
    useState("");

  const [
    settings,
    setSettings,
  ] =
    useState<
      SettingsRow | null
    >(
      null
    );

  const load =
    useCallback(
      async () => {
        const {
          data,
          error,
        } =
          await supabase
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
                "created_at",
                "updated_at",
              ].join(",")
            )
            .eq(
              "league_id",
              leagueId
            )
            .maybeSingle();

        if (error) {
          throw new Error(
            error.message
          );
        }

        setSettings(
          data as
            | SettingsRow
            | null
        );
      },
      [
        leagueId,
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

      try {
        await load();
      } catch (error) {
        if (
          !active
        ) {
          return;
        }

        setMessage(
          error instanceof Error
            ? error.message
            : "NHL Pick'em settings could not be loaded."
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

  useEffect(() => {
    if (
      loading
    ) {
      return;
    }

    const timer =
      window.setInterval(
        () => {
          void load();
        },
        15_000
      );

    return () => {
      window.clearInterval(
        timer
      );
    };
  }, [
    load,
    loading,
  ]);

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
        settings…
      </main>
    );
  }

  return (
    <main
      className="g365-nhl-settings-page"
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
        className="g365-nhl-settings-hero"
        style={{
          padding:
            20,
          borderRadius:
            18,
          border:
            "1px solid rgba(255,108,33,0.25)",
          background:
            "linear-gradient(135deg,rgba(100,7,13,0.42),rgba(17,17,21,0.98) 58%)",
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
          League Settings
        </h1>

        <p
          style={{
            margin:
              0,
            maxWidth:
              880,
            color:
              "#a6a6ae",
            lineHeight:
              1.6,
          }}
        >
          Review the rules used
          for the {season} NHL
          Pick&apos;em season,
          including required picks,
          eligible markets, scoring,
          line requirements and
          missing-pick handling.
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
              "1px solid rgba(255,80,80,0.40)",
            background:
              "rgba(120,0,0,0.20)",
            color:
              "#ff999c",
          }}
        >
          {message}
        </div>
      ) : null}

      {!settings ? (
        <EmptyState
          text="NHL Pick'em settings have not been configured for this league yet."
        />
      ) : (
        <>
          <section className="g365-nhl-settings-grid">
            <SettingsCard
              eyebrow="PICK REQUIREMENTS"
              title="Period Card"
              description="How many NHL selections each member is expected to make during every contest period."
            >
              <PrimaryValue
                value={
                  settings.picks_per_period
                }
                label={
                  settings.picks_per_period ===
                  1
                    ? "Required Pick"
                    : "Required Picks"
                }
              />

              <div className="g365-nhl-settings-detail-grid">
                <Detail
                  label="Contest Cycle"
                  value="Monday – Sunday"
                />

                <Detail
                  label="Season"
                  value={String(
                    season
                  )}
                />
              </div>
            </SettingsCard>

            <SettingsCard
              eyebrow="MARKETS"
              title="Available Picks"
              description="The official G365 NHL betting markets available for league selections."
            >
              <HighlightValue>
                {marketLabel(
                  settings.market_mode
                )}
              </HighlightValue>

              <div className="g365-nhl-settings-detail-grid">
                <Detail
                  label="Multiple Markets on Same Game"
                  value={yesNo(
                    settings.allow_same_game_multiple_markets
                  )}
                />

                <Detail
                  label="Pick Lock"
                  value="Individual Game Puck Drop"
                />
              </div>
            </SettingsCard>

            <SettingsCard
              eyebrow="G365 LINES"
              title="Official Market Requirements"
              description="Official contest markets are published only after the required sportsbook coverage and G365 consensus process are satisfied."
            >
              <PrimaryValue
                value={
                  settings.minimum_source_books
                }
                label={
                  settings.minimum_source_books ===
                  1
                    ? "Source Book Minimum"
                    : "Source Books Minimum"
                }
              />

              <div className="g365-nhl-settings-detail-grid">
                <Detail
                  label="Line Source"
                  value="G365 Consensus"
                />

                <Detail
                  label="Timezone"
                  value="Eastern Time"
                />
              </div>
            </SettingsCard>

            <SettingsCard
              eyebrow="LINE FREEZE"
              title="Daily Freeze Schedule"
              description="The G365 official line is frozen for the entire NHL calendar day before selections begin."
            >
              <div
                style={{
                  display:
                    "grid",
                  gap:
                    10,
                }}
              >
                <RuleLine
                  title="Early NHL Day"
                  text="If the day's earliest NHL game starts before 3:00 PM ET, the entire day's G365 lines freeze at 5:00 AM ET."
                />

                <RuleLine
                  title="Standard NHL Day"
                  text="If the day's earliest NHL game starts at 3:00 PM ET or later, the entire day's G365 lines freeze at 11:00 AM ET."
                />

                <RuleLine
                  title="Pick Lock"
                  text="Each individual selection remains editable until that selected game's puck drop."
                />
              </div>
            </SettingsCard>

            <SettingsCard
              eyebrow="SCORING"
              title="League Scoring"
              description="How correct picks, pushes and losses affect the NHL Pick'em standings."
            >
              <HighlightValue>
                {scoringLabel(
                  settings.scoring_mode
                )}
              </HighlightValue>

              {settings.scoring_mode ===
              "record_only" ? (
                <InfoBox>
                  Wins, losses and
                  pushes determine
                  the league record.
                  No separate point
                  total is used.
                </InfoBox>
              ) : null}

              {settings.scoring_mode ===
              "standard" ? (
                <div className="g365-nhl-settings-detail-grid">
                  <Detail
                    label="Win"
                    value={`${formatNumber(
                      settings.win_points
                    )} pts`}
                  />

                  <Detail
                    label="Push"
                    value={`${formatNumber(
                      settings.push_points
                    )} pts`}
                  />

                  <Detail
                    label="Loss"
                    value={`${formatNumber(
                      settings.loss_points
                    )} pts`}
                  />
                </div>
              ) : null}

              {settings.scoring_mode ===
              "confidence" ? (
                <>
                  <div>
                    <div
                      style={{
                        marginBottom:
                          7,
                        color:
                          "#777780",
                        fontSize:
                          9,
                        fontWeight:
                          1000,
                        letterSpacing:
                          "0.07em",
                      }}
                    >
                      CONFIDENCE VALUES
                    </div>

                    <div className="g365-nhl-confidence-grid">
                      {(
                        settings.confidence_points ??
                        []
                      ).map(
                        (
                          value,
                          index
                        ) => (
                          <div
                            key={`${value}-${index}`}
                            style={{
                              padding:
                                "10px 8px",
                              borderRadius:
                                10,
                              background:
                                "rgba(255,118,39,0.08)",
                              border:
                                "1px solid rgba(255,118,39,0.12)",
                              color:
                                "#fff",
                              textAlign:
                                "center",
                              fontWeight:
                                1000,
                              fontSize:
                                14,
                              fontVariantNumeric:
                                "tabular-nums",
                            }}
                          >
                            {formatNumber(
                              value
                            )}
                          </div>
                        )
                      )}
                    </div>
                  </div>

                  <Detail
                    label="Push Multiplier"
                    value={`${formatNumber(
                      settings.confidence_push_multiplier
                    )}×`}
                  />
                </>
              ) : null}
            </SettingsCard>

            <SettingsCard
              eyebrow="MISSING PICKS"
              title="Incomplete Cards"
              description="How the league handles any required selection that was not submitted before its opportunity expired."
            >
              <HighlightValue>
                {missingPickLabel(
                  settings.missing_pick_policy
                )}
              </HighlightValue>

              <InfoBox>
                {settings.missing_pick_policy ===
                "loss"
                  ? "Any required pick that is not submitted is counted as a loss when the period is finalized."
                  : "Any required pick that is not submitted remains ungraded and does not add a win, push or graded loss."}
              </InfoBox>
            </SettingsCard>
          </section>

          <section
            style={{
              padding:
                "14px 16px",
              borderRadius:
                14,
              border:
                "1px solid rgba(255,255,255,0.07)",
              background:
                "rgba(255,255,255,0.025)",
            }}
          >
            <div
              style={{
                color:
                  "#ff7627",
                fontSize:
                  9,
                fontWeight:
                  1000,
                letterSpacing:
                  "0.08em",
              }}
            >
              LEAGUE RULES
            </div>

            <div
              style={{
                marginTop:
                  5,
                color:
                  "#d4d4d8",
                fontSize:
                  12,
                lineHeight:
                  1.55,
              }}
            >
              These settings are
              visible to every league
              member. NHL Pick&apos;em
              configuration changes
              are controlled by the
              league commissioner.
            </div>
          </section>
        </>
      )}
    </main>
  );
}

function SettingsCard({
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
    <article
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
              19,
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
    </article>
  );
}

function PrimaryValue({
  value,
  label,
}: {
  value:
    | number
    | string;
  label: string;
}) {
  return (
    <div
      style={{
        padding:
          "14px 15px",
        borderRadius:
          13,
        background:
          "linear-gradient(135deg,rgba(139,15,19,0.18),rgba(255,118,39,0.055))",
        border:
          "1px solid rgba(255,118,39,0.16)",
      }}
    >
      <div
        style={{
          color:
            "#fff",
          fontSize:
            29,
          lineHeight:
            1,
          fontWeight:
            1000,
          fontVariantNumeric:
            "tabular-nums",
        }}
      >
        {value}
      </div>

      <div
        style={{
          marginTop:
            6,
          color:
            "#ff9b59",
          fontSize:
            9,
          fontWeight:
            1000,
          letterSpacing:
            "0.07em",
        }}
      >
        {label.toUpperCase()}
      </div>
    </div>
  );
}

function HighlightValue({
  children,
}: {
  children:
    React.ReactNode;
}) {
  return (
    <div
      style={{
        padding:
          "12px 13px",
        borderRadius:
          12,
        border:
          "1px solid rgba(255,118,39,0.16)",
        background:
          "rgba(255,118,39,0.07)",
        color:
          "#fff",
        fontSize:
          14,
        fontWeight:
          1000,
      }}
    >
      {children}
    </div>
  );
}

function Detail({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div
      style={{
        padding:
          "11px 12px",
        borderRadius:
          10,
        background:
          "rgba(255,255,255,0.035)",
      }}
    >
      <div
        style={{
          color:
            "#74747d",
          fontSize:
            8,
          fontWeight:
            1000,
          letterSpacing:
            "0.06em",
          textTransform:
            "uppercase",
        }}
      >
        {label}
      </div>

      <div
        style={{
          marginTop:
            4,
          color:
            "#e9e9ec",
          fontSize:
            11,
          fontWeight:
            900,
          lineHeight:
            1.4,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function RuleLine({
  title,
  text,
}: {
  title: string;
  text: string;
}) {
  return (
    <div
      style={{
        display:
          "grid",
        gridTemplateColumns:
          "8px minmax(0,1fr)",
        gap:
          10,
        alignItems:
          "start",
        padding:
          "10px 11px",
        borderRadius:
          10,
        background:
          "rgba(255,255,255,0.03)",
      }}
    >
      <div
        style={{
          width:
            8,
          height:
            8,
          marginTop:
            4,
          borderRadius:
            999,
          background:
            "linear-gradient(135deg,#b91618,#ff7627)",
        }}
      />

      <div>
        <div
          style={{
            color:
              "#fff",
            fontSize:
              11,
            fontWeight:
              1000,
          }}
        >
          {title}
        </div>

        <div
          style={{
            marginTop:
              4,
            color:
              "#85858e",
            fontSize:
              10,
            lineHeight:
              1.45,
          }}
        >
          {text}
        </div>
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

function EmptyState({
  text,
}: {
  text: string;
}) {
  return (
    <div
      style={{
        padding:
          "22px 16px",
        borderRadius:
          13,
        border:
          "1px dashed rgba(255,255,255,0.10)",
        background:
          "rgba(255,255,255,0.018)",
        color:
          "#8f8f98",
        fontSize:
          12,
        lineHeight:
          1.5,
      }}
    >
      {text}
    </div>
  );
}