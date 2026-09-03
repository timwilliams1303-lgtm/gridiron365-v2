import Link from "next/link";

import TraditionalSettings from "@/components/traditional/TraditionalSettings";

import {
  createSupabaseAdminClient,
} from "@/lib/supabase/admin";

import {
  requireLeagueMember,
} from "@/lib/leagues/requireLeagueMember";


type PageProps = {
  params:
    Promise<{
      leagueId: string;
    }>;
};


type SettingsRow = {
  competition_format:
    | "total_points"
    | "head_to_head"
    | null;
  weekly_salary_cap:
    number |
    string |
    null;
  starting_qb: number | null;
  starting_rb: number | null;
  starting_wr: number | null;
  starting_te: number | null;
  starting_flex: number | null;
  starting_superflex: number | null;
  starting_k: number | null;
  starting_dst: number | null;
  regular_season_weeks:
    number |
    null;
  playoffs_enabled:
    boolean |
    null;
  playoff_team_count:
    number |
    null;
  reseed_playoffs:
    boolean |
    null;
};


type ScoringRow = {
  passing_yard_points:
    number |
    string |
    null;
  passing_td_points:
    number |
    string |
    null;
  passing_interception_points:
    number |
    string |
    null;
  rushing_yard_points:
    number |
    string |
    null;
  rushing_td_points:
    number |
    string |
    null;
  reception_points:
    number |
    string |
    null;
  receiving_yard_points:
    number |
    string |
    null;
  receiving_td_points:
    number |
    string |
    null;
  extra_point_made_points:
    number |
    string |
    null;
  field_goal_0_19_points:
    number |
    string |
    null;
  field_goal_20_29_points:
    number |
    string |
    null;
  field_goal_30_39_points:
    number |
    string |
    null;
  field_goal_40_49_points:
    number |
    string |
    null;
  field_goal_50_59_points:
    number |
    string |
    null;
  field_goal_60_plus_points:
    number |
    string |
    null;
  dst_sack_points:
    number |
    string |
    null;
  dst_interception_points:
    number |
    string |
    null;
  dst_fumble_recovery_points:
    number |
    string |
    null;
  dst_touchdown_points:
    number |
    string |
    null;
};


function value(
  input:
    | number
    | string
    | null
    | undefined
) {
  if (
    input === null ||
    input === undefined ||
    input === ""
  ) {
    return "â€”";
  }

  return String(
    input
  );
}


function yesNo(
  input:
    | boolean
    | null
    | undefined
) {
  return input
    ? "Yes"
    : "No";
}


function money(
  input:
    | number
    | string
    | null
    | undefined
) {
  const amount =
    Number(
      input ??
      0
    );

  return new Intl.NumberFormat(
    "en-US",
    {
      style:
        "currency",
      currency:
        "USD",
      maximumFractionDigits:
        0,
    }
  ).format(
    Number.isFinite(
      amount
    )
      ? amount
      : 0
  );
}


function Info({
  label,
  value:
    displayValue,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      style={
        styles.info
      }
    >
      <span
        style={
          styles.infoLabel
        }
      >
        {label}
      </span>

      <strong
        style={{
          ...styles.infoValue,
          ...(accent
            ? styles.accent
            : {}),
        }}
      >
        {displayValue}
      </strong>
    </div>
  );
}


function Rule({
  title,
  text,
}: {
  title: string;
  text: string;
}) {
  return (
    <div
      style={
        styles.rule
      }
    >
      <strong>
        {title}
      </strong>
      <span>
        {text}
      </span>
    </div>
  );
}


function ScoringItem({
  label,
  value:
    displayValue,
}: {
  label: string;
  value: string;
}) {
  return (
    <div
      style={
        styles.scoringItem
      }
    >
      <span>
        {label}
      </span>
      <strong>
        {displayValue}
      </strong>
    </div>
  );
}


export default async function SeasonLongSettingsPage({
  params,
}: PageProps) {
  const {
    leagueId,
  } =
    await params;

  const access =
    await requireLeagueMember(
      leagueId
    );
  if (
    access.league.leagueType ===
    "traditional"
  ) {
    return (
      <TraditionalSettings
        leagueId={leagueId}
        leagueName={access.league.name}
        season={access.league.season}
        isCommissioner={access.isCommissioner}
      />
    );
  }

  if (
    access.league.leagueType !==
    "season_long"
  ) {
    throw new Error(
      "League settings are not available for this league type."
    );
  }

  const supabase =
    createSupabaseAdminClient();

  const [
    settingsResult,
    scoringResult,
    bonusCountResult,
  ] =
    await Promise.all([
      supabase
        .from(
          "season_long_settings"
        )
        .select(`
          competition_format,
          weekly_salary_cap,
          starting_qb,
          starting_rb,
          starting_wr,
          starting_te,
          starting_flex,
          starting_superflex,
          starting_k,
          starting_dst,
          regular_season_weeks,
          playoffs_enabled,
          playoff_team_count,
          reseed_playoffs
        `)
        .eq(
          "league_id",
          leagueId
        )
        .maybeSingle(),

      supabase
        .from(
          "league_scoring_settings"
        )
        .select(`
          passing_yard_points,
          passing_td_points,
          passing_interception_points,
          rushing_yard_points,
          rushing_td_points,
          reception_points,
          receiving_yard_points,
          receiving_td_points,
          extra_point_made_points,
          field_goal_0_19_points,
          field_goal_20_29_points,
          field_goal_30_39_points,
          field_goal_40_49_points,
          field_goal_50_59_points,
          field_goal_60_plus_points,
          dst_sack_points,
          dst_interception_points,
          dst_fumble_recovery_points,
          dst_touchdown_points
        `)
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
    ]);

  if (
    settingsResult.error
  ) {
    throw new Error(
      `Could not load Season-Long settings: ${settingsResult.error.message}`
    );
  }

  if (
    scoringResult.error
  ) {
    throw new Error(
      `Could not load scoring settings: ${scoringResult.error.message}`
    );
  }

  if (
    bonusCountResult.error
  ) {
    throw new Error(
      `Could not load bonus scoring settings: ${bonusCountResult.error.message}`
    );
  }

  const settings =
    settingsResult.data as
      SettingsRow |
      null;

  const scoring =
    scoringResult.data as
      ScoringRow |
      null;

  const isSalary =
    access.league.playerSelectionMode ===
    "salary";

  const isH2H =
    settings?.competition_format ===
    "head_to_head";

  const starterCount =
    [
      settings?.starting_qb,
      settings?.starting_rb,
      settings?.starting_wr,
      settings?.starting_te,
      settings?.starting_flex,
      settings?.starting_superflex,
      settings?.starting_k,
      settings?.starting_dst,
    ].reduce<number>(
      (
        total,
        count
      ) =>
        total +
        Number(
          count ??
          0
        ),
      0
    );

  const lineup = [
    [
      "QB",
      settings?.starting_qb ??
      0,
    ],
    [
      "RB",
      settings?.starting_rb ??
      0,
    ],
    [
      "WR",
      settings?.starting_wr ??
      0,
    ],
    [
      "TE",
      settings?.starting_te ??
      0,
    ],
    [
      "FLEX",
      settings?.starting_flex ??
      0,
    ],
    [
      "SUPERFLEX",
      settings?.starting_superflex ??
      0,
    ],
    [
      "K",
      settings?.starting_k ??
      0,
    ],
    [
      "DST",
      settings?.starting_dst ??
      0,
    ],
  ] as const;

  return (
    <main
      className="g365-sl-settings"
      style={
        styles.page
      }
    >
      <style>{`
        .g365-sl-settings,
        .g365-sl-settings * {
          box-sizing: border-box;
        }

        @media(max-width:760px){
          .g365-sl-settings {
            padding:12px 10px!important;
          }

          .g365-sl-settings .settings-grid,
          .g365-sl-settings .two-col,
          .g365-sl-settings .scoring-grid {
            grid-template-columns:1fr!important;
          }
        }
      `}</style>

      <section
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
            <p
              style={
                styles.eyebrow
              }
            >
              G365 SEASON-LONG • LEAGUE SETTINGS
            </p>

            <h1
              style={
                styles.title
              }
            >
              {access.league.name}
            </h1>

            <p
              style={
                styles.subtitle
              }
            >
              {access.league.season}
              {" • "}
              {isSalary
                ? "Salary"
                : "No Salary"}
              {" • "}
              {isH2H
                ? "Head-to-Head"
                : "Total Points"}
            </p>
          </div>

          <div
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

            {access.isCommissioner ? (
              <Link
                href={`/league/${leagueId}/commissioner`}
                style={
                  styles.primaryButton
                }
              >
                MANAGE SETTINGS
              </Link>
            ) : null}
          </div>
        </header>

        <div
          className="settings-grid"
          style={
            styles.summaryGrid
          }
        >
          <Info
            label="COMPETITION"
            value={
              isH2H
                ? "Head-to-Head"
                : "Total Points"
            }
            accent
          />

          <Info
            label="PLAYER MODE"
            value={
              isSalary
                ? "Salary"
                : "No Salary"
            }
          />

          <Info
            label="STARTERS"
            value={
              String(
                starterCount
              )
            }
          />

          <Info
            label="PLAYOFFS"
            value={
              isH2H
                ? settings?.playoffs_enabled
                  ? "Enabled"
                  : "Disabled"
                : "Not Used"
            }
          />

          {isSalary ? (
            <Info
              label="WEEKLY CAP"
              value={
                money(
                  settings?.weekly_salary_cap
                )
              }
            />
          ) : (
            <Info
              label="WEEKLY CAP"
              value="Not Used"
            />
          )}
        </div>

        <section
          style={
            styles.card
          }
        >
          <div
            style={
              styles.cardHead
            }
          >
            <div>
              <p
                style={
                  styles.sectionEyebrow
                }
              >
                WEEKLY ENTRY
              </p>

              <h2
                style={
                  styles.sectionTitle
                }
              >
                Starting Lineup Requirements
              </h2>
            </div>

            <span
              style={
                styles.countBadge
              }
            >
              {starterCount} STARTERS
            </span>
          </div>

          <div
            className="settings-grid"
            style={
              styles.positionGrid
            }
          >
            {lineup.map(
              ([
                position,
                count,
              ]) => (
                <div
                  key={
                    position
                  }
                  style={
                    styles.positionCard
                  }
                >
                  <span
                    style={
                      styles.position
                    }
                  >
                    {position}
                  </span>

                  <strong
                    style={
                      styles.positionCount
                    }
                  >
                    {count}
                  </strong>

                  <span
                    style={
                      styles.muted
                    }
                  >
                    {count === 1
                      ? "starter"
                      : "starters"}
                  </span>
                </div>
              )
            )}
          </div>
        </section>

        <section
          className="two-col"
          style={
            styles.twoColumn
          }
        >
          <div
            style={
              styles.card
            }
          >
            <p
              style={
                styles.sectionEyebrow
              }
            >
              COMPETITION
            </p>

            <h2
              style={
                styles.sectionTitle
              }
            >
              {isH2H
                ? "Head-to-Head Rules"
                : "Total Points Rules"}
            </h2>

            {isH2H ? (
              <>
                <Rule
                  title="Weekly Matchups"
                  text="Each submitted weekly lineup produces the fantasy score used in that week's head-to-head matchup."
                />

                <Rule
                  title="Standings"
                  text="Finalized matchup results build W-L-T standings with Points For and Points Against."
                />

                <Rule
                  title="Regular Season"
                  text={`${value(settings?.regular_season_weeks)} configured regular-season weeks.`}
                />

                <Rule
                  title="Fantasy Playoffs"
                  text={
                    settings?.playoffs_enabled
                      ? `${value(settings?.playoff_team_count)} teams qualify. Reseeding: ${yesNo(settings?.reseed_playoffs)}.`
                      : "Disabled for this Head-to-Head league."
                  }
                />
              </>
            ) : (
              <>
                <Rule
                  title="Full Season"
                  text="The competition runs straight through the configured NFL season. It does not stop early for fantasy playoffs."
                />

                <Rule
                  title="Champion"
                  text="Final cumulative finalized fantasy points determine the Season-Long Total Points champion."
                />

                <Rule
                  title="Fantasy Playoffs"
                  text="Not used in Total Points leagues."
                />
              </>
            )}
          </div>

          <div
            style={
              styles.card
            }
          >
            <p
              style={
                styles.sectionEyebrow
              }
            >
              PLAYER SELECTION
            </p>

            <h2
              style={
                styles.sectionTitle
              }
            >
              {isSalary
                ? "Salary Rules"
                : "No-Salary Rules"}
            </h2>

            {isSalary ? (
              <>
                <Rule
                  title="Weekly Salary Cap"
                  text={`Every submitted lineup must remain at or below ${money(settings?.weekly_salary_cap)}.`}
                />

                <Rule
                  title="Weekly Lineup"
                  text="A fresh lineup is selected each NFL week using that week's available player salaries."
                />
              </>
            ) : (
              <>
                <Rule
                  title="No Player Salaries"
                  text="Player selection is not constrained by salary or a weekly cap."
                />

                <Rule
                  title="Same H2H / Total Points Engine"
                  text="Lineup slots, scoring, locking, injuries, weekly results and the selected competition format work exactly the same; only salary restrictions are removed."
                />
              </>
            )}

            <Rule
              title="Individual Player Locks"
              text="Each selected player locks when that player's NFL game begins."
            />
          </div>
        </section>

        <section
          style={
            styles.card
          }
        >
          <div
            style={
              styles.cardHead
            }
          >
            <div>
              <p
                style={
                  styles.sectionEyebrow
                }
              >
                SCORING
              </p>

              <h2
                style={
                  styles.sectionTitle
                }
              >
                Current Fantasy Scoring
              </h2>

              <p
                style={
                  styles.muted
                }
              >
                The same scoring configuration applies to Salary and No-Salary Season-Long leagues and to both Total Points and Head-to-Head competition formats.
              </p>
            </div>

            <span
              style={
                styles.countBadge
              }
            >
              {bonusCountResult.count ??
                0} BONUS RULES
            </span>
          </div>

          <div
            className="scoring-grid"
            style={
              styles.scoringGrid
            }
          >
            <div
              style={
                styles.scoringGroup
              }
            >
              <strong>
                PASSING
              </strong>
              <ScoringItem
                label="Per Yard"
                value={
                  value(
                    scoring?.passing_yard_points
                  )
                }
              />
              <ScoringItem
                label="TD"
                value={
                  value(
                    scoring?.passing_td_points
                  )
                }
              />
              <ScoringItem
                label="Interception"
                value={
                  value(
                    scoring?.passing_interception_points
                  )
                }
              />
            </div>

            <div
              style={
                styles.scoringGroup
              }
            >
              <strong>
                RUSHING / RECEIVING
              </strong>
              <ScoringItem
                label="Rush Yard"
                value={
                  value(
                    scoring?.rushing_yard_points
                  )
                }
              />
              <ScoringItem
                label="Rush TD"
                value={
                  value(
                    scoring?.rushing_td_points
                  )
                }
              />
              <ScoringItem
                label="Reception"
                value={
                  value(
                    scoring?.reception_points
                  )
                }
              />
              <ScoringItem
                label="Receiving Yard"
                value={
                  value(
                    scoring?.receiving_yard_points
                  )
                }
              />
              <ScoringItem
                label="Receiving TD"
                value={
                  value(
                    scoring?.receiving_td_points
                  )
                }
              />
            </div>

            <div
              style={
                styles.scoringGroup
              }
            >
              <strong>
                KICKING
              </strong>
              <ScoringItem
                label="FG 0â€“19"
                value={
                  value(
                    scoring?.field_goal_0_19_points
                  )
                }
              />
              <ScoringItem
                label="FG 20â€“29"
                value={
                  value(
                    scoring?.field_goal_20_29_points
                  )
                }
              />
              <ScoringItem
                label="FG 30â€“39"
                value={
                  value(
                    scoring?.field_goal_30_39_points
                  )
                }
              />
              <ScoringItem
                label="FG 40â€“49"
                value={
                  value(
                    scoring?.field_goal_40_49_points
                  )
                }
              />
              <ScoringItem
                label="FG 50â€“59"
                value={
                  value(
                    scoring?.field_goal_50_59_points
                  )
                }
              />
              <ScoringItem
                label="FG 60+"
                value={
                  value(
                    scoring?.field_goal_60_plus_points
                  )
                }
              />
            </div>

            <div
              style={
                styles.scoringGroup
              }
            >
              <strong>
                DEFENSE / SPECIAL TEAMS
              </strong>
              <ScoringItem
                label="Sack"
                value={
                  value(
                    scoring?.dst_sack_points
                  )
                }
              />
              <ScoringItem
                label="Interception"
                value={
                  value(
                    scoring?.dst_interception_points
                  )
                }
              />
              <ScoringItem
                label="Fumble Recovery"
                value={
                  value(
                    scoring?.dst_fumble_recovery_points
                  )
                }
              />
              <ScoringItem
                label="DST TD"
                value={
                  value(
                    scoring?.dst_touchdown_points
                  )
                }
              />
            </div>
          </div>
        </section>
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
        "22px",
      background:
        "linear-gradient(180deg,#07080c,#0b0d12 50%,#07080b)",
      color:
        "#f5f7fa",
    },

    shell: {
      maxWidth:
        "1160px",
      margin:
        "0 auto",
      display:
        "grid",
      gap:
        "14px",
    },

    hero: {
      display:
        "flex",
      alignItems:
        "flex-start",
      justifyContent:
        "space-between",
      gap:
        "16px",
      flexWrap:
        "wrap",
    },

    eyebrow: {
      margin:
        "0 0 4px",
      color:
        "#ff7b25",
      fontWeight:
        950,
      fontSize:
        "11px",
      letterSpacing:
        ".08em",
    },

    title: {
      margin:
        0,
      fontSize:
        "clamp(28px,4vw,42px)",
    },

    subtitle: {
      color:
        "#9ca2ab",
      margin:
        "5px 0 0",
    },

    actions: {
      display:
        "flex",
      gap:
        "8px",
      alignItems:
        "center",
      flexWrap:
        "wrap",
    },

    readOnly: {
      border:
        "1px solid #343a44",
      background:
        "#11151b",
      color:
        "#9aa0a9",
      borderRadius:
        "999px",
      padding:
        "8px 10px",
      fontSize:
        "10px",
      fontWeight:
        950,
      letterSpacing:
        ".07em",
    },

    primaryButton: {
      borderRadius:
        "9px",
      padding:
        "9px 12px",
      color:
        "#fff",
      background:
        "linear-gradient(135deg,#aa1d13,#e9601e)",
      textDecoration:
        "none",
      fontWeight:
        900,
      fontSize:
        "11px",
    },

    summaryGrid: {
      display:
        "grid",
      gridTemplateColumns:
        "repeat(5,minmax(0,1fr))",
      gap:
        "9px",
    },

    info: {
      border:
        "1px solid #272c34",
      borderRadius:
        "12px",
      background:
        "#101319",
      padding:
        "12px",
      display:
        "grid",
      gap:
        "5px",
    },

    infoLabel: {
      color:
        "#818792",
      fontSize:
        "9px",
      fontWeight:
        950,
      letterSpacing:
        ".07em",
    },

    infoValue: {
      fontSize:
        "15px",
    },

    accent: {
      color:
        "#ff8a36",
    },

    card: {
      border:
        "1px solid #272c34",
      borderRadius:
        "14px",
      background:
        "linear-gradient(180deg,#11151b,#0c0f14)",
      padding:
        "15px",
      minWidth:
        0,
    },

    cardHead: {
      display:
        "flex",
      justifyContent:
        "space-between",
      alignItems:
        "flex-start",
      gap:
        "12px",
      marginBottom:
        "12px",
      flexWrap:
        "wrap",
    },

    sectionEyebrow: {
      margin:
        "0 0 3px",
      color:
        "#ff7d28",
      fontSize:
        "10px",
      fontWeight:
        950,
      letterSpacing:
        ".08em",
    },

    sectionTitle: {
      margin:
        "0 0 5px",
      fontSize:
        "18px",
    },

    countBadge: {
      border:
        "1px solid rgba(255,126,41,.4)",
      background:
        "rgba(255,126,41,.09)",
      color:
        "#ff974c",
      borderRadius:
        "999px",
      padding:
        "6px 9px",
      fontSize:
        "9px",
      fontWeight:
        950,
    },

    positionGrid: {
      display:
        "grid",
      gridTemplateColumns:
        "repeat(4,minmax(0,1fr))",
      gap:
        "8px",
    },

    positionCard: {
      border:
        "1px solid #252a32",
      background:
        "#0e1116",
      borderRadius:
        "10px",
      padding:
        "10px",
      display:
        "grid",
      gap:
        "3px",
    },

    position: {
      color:
        "#ff8a35",
      fontWeight:
        950,
      fontSize:
        "11px",
    },

    positionCount: {
      fontSize:
        "20px",
    },

    muted: {
      color:
        "#8c929c",
      fontSize:
        "11px",
      lineHeight:
        1.5,
    },

    twoColumn: {
      display:
        "grid",
      gridTemplateColumns:
        "repeat(2,minmax(0,1fr))",
      gap:
        "14px",
    },

    rule: {
      padding:
        "9px 0",
      display:
        "grid",
      gap:
        "3px",
      borderTop:
        "1px solid #232831",
      color:
        "#dfe1e5",
      fontSize:
        "12px",
    },

    scoringGrid: {
      display:
        "grid",
      gridTemplateColumns:
        "repeat(4,minmax(0,1fr))",
      gap:
        "10px",
    },

    scoringGroup: {
      border:
        "1px solid #252a32",
      background:
        "#0e1116",
      borderRadius:
        "10px",
      padding:
        "10px",
      display:
        "grid",
      gap:
        "7px",
      minWidth:
        0,
    },

    scoringItem: {
      display:
        "flex",
      justifyContent:
        "space-between",
      gap:
        "8px",
      color:
        "#aeb3bb",
      fontSize:
        "11px",
    },
  };


