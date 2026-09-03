import Link from "next/link";

import {
  createSupabaseAdminClient,
} from "@/lib/supabase/admin";

type Props = {
  leagueId: string;
  leagueName: string;
  season: number;
  isCommissioner: boolean;
};

type AnyRow =
  Record<
    string,
    unknown
  >;

function show(
  value:
    unknown
) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "—";
  }

  if (
    typeof value ===
    "boolean"
  ) {
    return value
      ? "Yes"
      : "No";
  }

  return String(
    value
  )
    .replaceAll(
      "_",
      " "
    )
    .replace(
      /\b\w/g,
      (
        letter
      ) =>
        letter.toUpperCase()
    );
}

function points(
  value:
    unknown
) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "—";
  }

  const number =
    Number(
      value
    );

  return Number.isFinite(
    number
  )
    ? String(
        number
      )
    : show(
        value
      );
}

function Item({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div
      style={
        styles.item
      }
    >
      <span
        style={
          styles.itemLabel
        }
      >
        {label}
      </span>

      <strong
        style={
          styles.itemValue
        }
      >
        {value}
      </strong>
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children:
    React.ReactNode;
}) {
  return (
    <section
      style={
        styles.card
      }
    >
      <div
        style={{
          marginBottom:
            14,
        }}
      >
        <p
          style={
            styles.eyebrow
          }
        >
          TRADITIONAL
        </p>

        <h2
          style={
            styles.sectionTitle
          }
        >
          {title}
        </h2>

        {description ? (
          <p
            style={
              styles.description
            }
          >
            {
              description
            }
          </p>
        ) : null}
      </div>

      <div
        className="g365-traditional-settings-grid"
        style={
          styles.grid
        }
      >
        {children}
      </div>
    </section>
  );
}

export default async function TraditionalSettings({
  leagueId,
  leagueName,
  season,
  isCommissioner,
}: Props) {
  const supabase =
    createSupabaseAdminClient();

  const [
    settingsResult,
    scoringResult,
    rulesResult,
    draftResult,
  ] =
    await Promise.all([
      supabase
        .from(
          "league_settings"
        )
        .select(
          "*"
        )
        .eq(
          "league_id",
          leagueId
        )
        .maybeSingle(),

      supabase
        .from(
          "league_scoring_settings"
        )
        .select(
          "*"
        )
        .eq(
          "league_id",
          leagueId
        )
        .maybeSingle(),

      supabase
        .from(
          "league_scoring_rules"
        )
        .select(
          "id",
          {
            count:
              "exact",
            head:
              true,
          }
        )
        .eq(
          "league_id",
          leagueId
        )
        .eq(
          "is_enabled",
          true
        ),

      supabase
        .from(
          "drafts"
        )
        .select(
          "*"
        )
        .eq(
          "league_id",
          leagueId
        )
        .order(
          "created_at",
          {
            ascending:
              false,
          }
        )
        .limit(
          1
        )
        .maybeSingle(),
    ]);

  if (
    settingsResult.error
  ) {
    throw new Error(
      `Could not load Traditional league settings: ${settingsResult.error.message}`
    );
  }

  if (
    scoringResult.error
  ) {
    throw new Error(
      `Could not load Traditional scoring settings: ${scoringResult.error.message}`
    );
  }

  const settings =
    (
      settingsResult.data ??
      {}
    ) as AnyRow;

  const scoring =
    (
      scoringResult.data ??
      {}
    ) as AnyRow;

  const draft =
    (
      draftResult.data ??
      {}
    ) as AnyRow;

  const bonusCount =
    rulesResult.count ??
    0;

  const rosterItems:
    Array<
      [
        string,
        string,
      ]
    > = [
      [
        "QB",
        "starting_qb",
      ],
      [
        "RB",
        "starting_rb",
      ],
      [
        "WR",
        "starting_wr",
      ],
      [
        "TE",
        "starting_te",
      ],
      [
        "FLEX",
        "starting_flex",
      ],
      [
        "SUPERFLEX",
        "starting_superflex",
      ],
      [
        "K",
        "starting_k",
      ],
      [
        "DST",
        "starting_dst",
      ],
      [
        "Bench",
        "bench_slots",
      ],
      [
        "IR",
        "ir_slots",
      ],
    ];

  return (
    <main
      className="g365-traditional-settings"
      style={
        styles.page
      }
    >
      <style>{`
        .g365-traditional-settings,
        .g365-traditional-settings * {
          box-sizing: border-box;
        }

        @media (max-width: 760px) {
          .g365-traditional-settings {
            padding: 12px 10px !important;
          }

          .g365-traditional-settings-header {
            display: grid !important;
            grid-template-columns: 1fr !important;
          }

          .g365-traditional-settings-grid {
            grid-template-columns: 1fr !important;
          }

          .g365-traditional-settings-actions {
            width: 100%;
          }

          .g365-traditional-settings-actions a {
            width: 100%;
            text-align: center;
          }
        }
      `}</style>

      <section
        style={
          styles.shell
        }
      >
        <header
          className="g365-traditional-settings-header"
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
              G365 TRADITIONAL • LEAGUE SETTINGS
            </p>

            <h1
              style={
                styles.title
              }
            >
              {leagueName}
            </h1>

            <p
              style={
                styles.subtitle
              }
            >
              {season}
              {" • "}
              Traditional Fantasy Football
              {" • "}
              Official read-only league rules
            </p>
          </div>

          <div
            className="g365-traditional-settings-actions"
            style={
              styles.actions
            }
          >
            <span
              style={
                styles.readOnly
              }
            >
              READ ONLY
            </span>

            {isCommissioner ? (
              <Link
                href={`/league/${leagueId}/commissioner`}
                style={
                  styles.button
                }
              >
                MANAGE SETTINGS
              </Link>
            ) : null}
          </div>
        </header>

        <Section
          title="League & Season"
          description="Core Traditional league configuration."
        >
          <Item
            label="Season"
            value={
              String(
                season
              )
            }
          />

          <Item
            label="Maximum Teams"
            value={
              show(
                settings[
                  "max_teams"
                ]
              )
            }
          />

          <Item
            label="Regular Season Weeks"
            value={
              show(
                settings[
                  "regular_season_weeks"
                ]
              )
            }
          />

          <Item
            label="Playoff Teams"
            value={
              show(
                settings[
                  "playoff_team_count"
                ] ??
                  settings[
                    "playoff_teams"
                  ]
              )
            }
          />

          <Item
            label="Playoff Start Week"
            value={
              show(
                settings[
                  "playoff_start_week"
                ]
              )
            }
          />

          <Item
            label="Reseeding"
            value={
              show(
                settings[
                  "playoff_reseeding"
                ] ??
                  settings[
                    "reseed_playoffs"
                  ]
              )
            }
          />
        </Section>

        <Section
          title="Roster Settings"
          description="Starting lineup, bench, and reserve requirements."
        >
          {rosterItems.map(
            ([
              label,
              key,
            ]) => (
              <Item
                key={
                  key
                }
                label={
                  label
                }
                value={
                  show(
                    settings[
                      key
                    ]
                  )
                }
              />
            )
          )}
        </Section>

        <Section
          title="Draft Settings"
          description="The current Traditional draft configuration."
        >
          <Item
            label="Draft Type"
            value={
              show(
                draft[
                  "draft_type"
                ] ??
                  draft[
                    "type"
                  ] ??
                  "Snake"
              )
            }
          />

          <Item
            label="Draft Rounds"
            value={
              show(
                draft[
                  "total_rounds"
                ]
              )
            }
          />

          <Item
            label="Human Pick Clock"
            value={
              draft[
                "pick_timer_seconds"
              ] !==
                undefined
                ? `${show(
                    draft[
                      "pick_timer_seconds"
                    ]
                  )} sec`
                : "—"
            }
          />

          <Item
            label="CPU Pick Clock"
            value={
              draft[
                "cpu_pick_seconds"
              ] !==
                undefined
                ? `${show(
                    draft[
                      "cpu_pick_seconds"
                    ]
                  )} sec`
                : "—"
            }
          />

          <Item
            label="Draft Status"
            value={
              show(
                draft[
                  "status"
                ]
              )
            }
          />

          <Item
            label="Draft Order"
            value={
              show(
                draft[
                  "draft_order_mode"
                ] ??
                  draft[
                    "order_mode"
                  ]
              )
            }
          />
        </Section>

        <Section
          title="Scoring"
          description="Current base scoring, including the approved kicking yardage ranges."
        >
          <Item
            label="Passing Yards"
            value={
              points(
                scoring[
                  "passing_yard_points"
                ]
              )
            }
          />

          <Item
            label="Passing TD"
            value={
              points(
                scoring[
                  "passing_td_points"
                ]
              )
            }
          />

          <Item
            label="Interception Thrown"
            value={
              points(
                scoring[
                  "passing_interception_points"
                ]
              )
            }
          />

          <Item
            label="Rushing Yards"
            value={
              points(
                scoring[
                  "rushing_yard_points"
                ]
              )
            }
          />

          <Item
            label="Rushing TD"
            value={
              points(
                scoring[
                  "rushing_td_points"
                ]
              )
            }
          />

          <Item
            label="Reception"
            value={
              points(
                scoring[
                  "reception_points"
                ]
              )
            }
          />

          <Item
            label="Receiving Yards"
            value={
              points(
                scoring[
                  "receiving_yard_points"
                ]
              )
            }
          />

          <Item
            label="Receiving TD"
            value={
              points(
                scoring[
                  "receiving_td_points"
                ]
              )
            }
          />

          <Item
            label="FG 0–19"
            value={
              points(
                scoring[
                  "field_goal_0_19_points"
                ]
              )
            }
          />

          <Item
            label="FG 20–29"
            value={
              points(
                scoring[
                  "field_goal_20_29_points"
                ]
              )
            }
          />

          <Item
            label="FG 30–39"
            value={
              points(
                scoring[
                  "field_goal_30_39_points"
                ]
              )
            }
          />

          <Item
            label="FG 40–49"
            value={
              points(
                scoring[
                  "field_goal_40_49_points"
                ]
              )
            }
          />

          <Item
            label="FG 50–59"
            value={
              points(
                scoring[
                  "field_goal_50_59_points"
                ]
              )
            }
          />

          <Item
            label="FG 60+"
            value={
              points(
                scoring[
                  "field_goal_60_plus_points"
                ]
              )
            }
          />

          <Item
            label="XP Made"
            value={
              points(
                scoring[
                  "extra_point_made_points"
                ]
              )
            }
          />

          <Item
            label="Enabled Bonus Rules"
            value={
              String(
                bonusCount
              )
            }
          />
        </Section>

        <Section
          title="Waivers & Free Agency"
          description="Current claim and free-agent configuration."
        >
          <Item
            label="Waivers Enabled"
            value={
              show(
                settings[
                  "waivers_enabled"
                ]
              )
            }
          />

          <Item
            label="Waiver Type"
            value={
              show(
                settings[
                  "waiver_type"
                ]
              )
            }
          />

          <Item
            label="FAAB Budget"
            value={
              show(
                settings[
                  "faab_budget"
                ]
              )
            }
          />

          <Item
            label="Continuous Waivers"
            value={
              show(
                settings[
                  "continuous_waivers"
                ]
              )
            }
          />

          <Item
            label="Waiver Period"
            value={
              settings[
                "waiver_period_minutes"
              ] !==
                undefined
                ? `${show(
                    settings[
                      "waiver_period_minutes"
                    ]
                  )} min`
                : "—"
            }
          />

          <Item
            label="Processing Interval"
            value={
              settings[
                "waiver_processing_interval_minutes"
              ] !==
                undefined
                ? `${show(
                    settings[
                      "waiver_processing_interval_minutes"
                    ]
                  )} min`
                : "—"
            }
          />
        </Section>

        <Section
          title="Trades"
          description="Current Traditional trade rules."
        >
          <Item
            label="Trades Enabled"
            value={
              show(
                settings[
                  "trades_enabled"
                ]
              )
            }
          />

          <Item
            label="Trade Deadline Week"
            value={
              show(
                settings[
                  "trade_deadline_week"
                ]
              )
            }
          />

          <Item
            label="Trade Review Hours"
            value={
              show(
                settings[
                  "trade_review_hours"
                ]
              )
            }
          />

          <Item
            label="Commissioner Veto"
            value={
              show(
                settings[
                  "commissioner_trade_veto"
                ]
              )
            }
          />

          <Item
            label="League Vote Veto"
            value={
              show(
                settings[
                  "league_vote_trade_veto"
                ]
              )
            }
          />
        </Section>

        <div
          style={
            styles.footerActions
          }
        >
          <Link
            href={`/league/${leagueId}`}
            style={
              styles.secondaryButton
            }
          >
            LEAGUE HOME
          </Link>

          {isCommissioner ? (
            <Link
              href={`/league/${leagueId}/commissioner/new-season`}
              style={
                styles.button
              }
            >
              RENEW FOR {season + 1}
            </Link>
          ) : null}
        </div>
      </section>
    </main>
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
      padding:
        "24px",
      background:
        "#080808",
      color:
        "#fff",
    },

    shell: {
      width:
        "100%",
      maxWidth:
        1180,
      margin:
        "0 auto",
      display:
        "grid",
      gap:
        16,
    },

    header: {
      display:
        "flex",
      justifyContent:
        "space-between",
      gap:
        18,
      alignItems:
        "flex-start",
      padding:
        20,
      border:
        "1px solid #3b2119",
      borderRadius:
        18,
      background:
        "linear-gradient(135deg,#160c09,#0b0b0b)",
    },

    eyebrow: {
      margin:
        "0 0 5px",
      color:
        "#ff6422",
      fontSize:
        10,
      fontWeight:
        950,
      letterSpacing:
        0.9,
    },

    title: {
      margin:
        0,
      fontSize:
        "clamp(26px,4vw,42px)",
      fontWeight:
        950,
    },

    subtitle: {
      margin:
        "7px 0 0",
      color:
        "#aaa",
      fontSize:
        12,
      lineHeight:
        1.5,
    },

    actions: {
      display:
        "flex",
      gap:
        8,
      flexWrap:
        "wrap",
      alignItems:
        "center",
    },

    readOnly: {
      padding:
        "10px 12px",
      borderRadius:
        10,
      background:
        "#151515",
      border:
        "1px solid #333",
      color:
        "#aaa",
      fontSize:
        10,
      fontWeight:
        900,
    },

    button: {
      display:
        "inline-flex",
      minHeight:
        40,
      alignItems:
        "center",
      justifyContent:
        "center",
      padding:
        "0 14px",
      borderRadius:
        10,
      border:
        "1px solid #e85c1b",
      background:
        "linear-gradient(90deg,#a61919,#f0631d)",
      color:
        "#fff",
      textDecoration:
        "none",
      fontSize:
        10,
      fontWeight:
        950,
    },

    secondaryButton: {
      display:
        "inline-flex",
      minHeight:
        40,
      alignItems:
        "center",
      justifyContent:
        "center",
      padding:
        "0 14px",
      borderRadius:
        10,
      border:
        "1px solid #3b3b3b",
      background:
        "#151515",
      color:
        "#fff",
      textDecoration:
        "none",
      fontSize:
        10,
      fontWeight:
        950,
    },

    card: {
      padding:
        18,
      border:
        "1px solid #292929",
      borderRadius:
        16,
      background:
        "#101010",
    },

    sectionTitle: {
      margin:
        0,
      fontSize:
        19,
      fontWeight:
        950,
    },

    description: {
      margin:
        "5px 0 0",
      color:
        "#969696",
      fontSize:
        12,
    },

    grid: {
      display:
        "grid",
      gridTemplateColumns:
        "repeat(auto-fit,minmax(180px,1fr))",
      gap:
        10,
    },

    item: {
      display:
        "grid",
      gap:
        5,
      minWidth:
        0,
      padding:
        12,
      borderRadius:
        12,
      background:
        "#151515",
      border:
        "1px solid #272727",
    },

    itemLabel: {
      color:
        "#898989",
      fontSize:
        9,
      fontWeight:
        900,
      letterSpacing:
        0.6,
      textTransform:
        "uppercase",
    },

    itemValue: {
      color:
        "#fff",
      fontSize:
        13,
      overflowWrap:
        "anywhere",
    },

    footerActions: {
      display:
        "flex",
      gap:
        10,
      flexWrap:
        "wrap",
      paddingBottom:
        20,
    },
  };
