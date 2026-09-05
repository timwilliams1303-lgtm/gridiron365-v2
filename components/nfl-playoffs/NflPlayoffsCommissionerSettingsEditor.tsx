"use client";

import type {
  CSSProperties,
} from "react";

import {
  useMemo,
  useState,
} from "react";

import Link from "next/link";

import {
  useRouter,
} from "next/navigation";

import {
  createBrowserClient,
} from "@supabase/ssr";


type Settings = {
  weeklySalaryCap:
    number | null;

  startingQb:
    number;

  startingRb:
    number;

  startingWr:
    number;

  startingTe:
    number;

  startingFlex:
    number;

  startingSuperflex:
    number;

  startingK:
    number;

  startingDst:
    number;
};


type Props = {
  leagueId:
    string;

  leagueName:
    string;

  season:
    number;

  isSalary:
    boolean;

  settingsLocked:
    boolean;

  lockedReason:
    string | null;

  initialSettings:
    Settings;
};


type PositionKey =
  | "startingQb"
  | "startingRb"
  | "startingWr"
  | "startingTe"
  | "startingFlex"
  | "startingSuperflex"
  | "startingK"
  | "startingDst";


const POSITION_FIELDS: Array<{
  key: PositionKey;
  label: string;
  shortLabel: string;
  description: string;
  min: number;
  max: number;
}> = [
  {
    key: "startingQb",
    label: "Starting QB",
    shortLabel: "QB",
    description: "Quarterback starters required each postseason round.",
    min: 0,
    max: 4,
  },
  {
    key: "startingRb",
    label: "Starting RB",
    shortLabel: "RB",
    description: "Running back starters required each postseason round.",
    min: 0,
    max: 6,
  },
  {
    key: "startingWr",
    label: "Starting WR",
    shortLabel: "WR",
    description: "Wide receiver starters required each postseason round.",
    min: 0,
    max: 6,
  },
  {
    key: "startingTe",
    label: "Starting TE",
    shortLabel: "TE",
    description: "Tight end starters required each postseason round.",
    min: 0,
    max: 4,
  },
  {
    key: "startingFlex",
    label: "Starting FLEX",
    shortLabel: "FLEX",
    description: "Flexible RB / WR / TE starter positions.",
    min: 0,
    max: 6,
  },
  {
    key: "startingSuperflex",
    label: "Starting SUPERFLEX",
    shortLabel: "SUPERFLEX",
    description: "Flexible QB / RB / WR / TE starter positions.",
    min: 0,
    max: 4,
  },
  {
    key: "startingK",
    label: "Starting K",
    shortLabel: "K",
    description: "Kicker starters required each postseason round.",
    min: 0,
    max: 3,
  },
  {
    key: "startingDst",
    label: "Starting DST",
    shortLabel: "DST",
    description: "Defense / special teams starters required each postseason round.",
    min: 0,
    max: 3,
  },
];


function money(
  value:
    number | null
) {
  return new Intl.NumberFormat(
    "en-US",
    {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }
  ).format(
    value ?? 0
  );
}


export default function NflPlayoffsCommissionerSettingsEditor({
  leagueId,
  leagueName,
  season,
  isSalary,
  settingsLocked,
  lockedReason,
  initialSettings,
}: Props) {
  const router =
    useRouter();

  const supabase =
    useMemo(
      () =>
        createBrowserClient(
          process.env
            .NEXT_PUBLIC_SUPABASE_URL!,

          process.env
            .NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
            process.env
              .NEXT_PUBLIC_SUPABASE_ANON_KEY!
        ),
      []
    );

  const [
    settings,
    setSettings,
  ] =
    useState<Settings>(
      initialSettings
    );

  const [
    saving,
    setSaving,
  ] =
    useState(
      false
    );

  const [
    message,
    setMessage,
  ] =
    useState(
      ""
    );

  const [
    isError,
    setIsError,
  ] =
    useState(
      false
    );


  const starterCount =
    settings.startingQb +
    settings.startingRb +
    settings.startingWr +
    settings.startingTe +
    settings.startingFlex +
    settings.startingSuperflex +
    settings.startingK +
    settings.startingDst;


  const changed =
    JSON.stringify(
      settings
    ) !==
    JSON.stringify(
      initialSettings
    );


  function updatePosition(
    key:
      PositionKey,
    value:
      number
  ) {
    if (
      settingsLocked
    ) {
      return;
    }

    setSettings(
      (
        current
      ) => ({
        ...current,
        [key]:
          value,
      })
    );

    setMessage(
      ""
    );

    setIsError(
      false
    );
  }


  function changeSalaryCap(
    value:
      string
  ) {
    if (
      settingsLocked
    ) {
      return;
    }

    const next =
      Number(
        value
      );

    setSettings(
      (
        current
      ) => ({
        ...current,
        weeklySalaryCap:
          Number.isFinite(
            next
          )
            ? next
            : 0,
      })
    );

    setMessage(
      ""
    );

    setIsError(
      false
    );
  }


  function resetChanges() {
    setSettings(
      initialSettings
    );

    setMessage(
      "Unsaved changes discarded."
    );

    setIsError(
      false
    );
  }


  function validate() {
    if (
      starterCount <
      1
    ) {
      return "At least one starting lineup position is required.";
    }

    if (
      starterCount >
      20
    ) {
      return "NFL Playoffs lineups cannot exceed 20 starters.";
    }

    for (
      const field
      of POSITION_FIELDS
    ) {
      const value =
        settings[
          field.key
        ];

      if (
        !Number.isInteger(
          value
        ) ||
        value <
          field.min ||
        value >
          field.max
      ) {
        return `${field.label} must be between ${field.min} and ${field.max}.`;
      }
    }

    if (
      isSalary
    ) {
      const salaryCap =
        settings
          .weeklySalaryCap;

      if (
        salaryCap ===
          null ||
        !Number.isFinite(
          salaryCap
        ) ||
        salaryCap <
          1000 ||
        salaryCap >
          1000000
      ) {
        return "Salary cap must be between $1,000 and $1,000,000.";
      }
    }

    return null;
  }


  async function saveSettings() {
    if (
      settingsLocked ||
      saving
    ) {
      return;
    }

    setMessage(
      ""
    );

    setIsError(
      false
    );

    const validationError =
      validate();

    if (
      validationError
    ) {
      setIsError(
        true
      );

      setMessage(
        validationError
      );

      return;
    }

    setSaving(
      true
    );

    try {
      const {
        data,
        error,
      } =
        await supabase.rpc(
          "save_nfl_playoff_lineup_settings",
          {
            p_league_id:
              leagueId,

            p_season:
              season,

            p_weekly_salary_cap:
              isSalary
                ? settings.weeklySalaryCap
                : null,

            p_starting_qb:
              settings.startingQb,

            p_starting_rb:
              settings.startingRb,

            p_starting_wr:
              settings.startingWr,

            p_starting_te:
              settings.startingTe,

            p_starting_flex:
              settings.startingFlex,

            p_starting_superflex:
              settings.startingSuperflex,

            p_starting_k:
              settings.startingK,

            p_starting_dst:
              settings.startingDst,
          }
        );

      if (
        error
      ) {
        throw new Error(
          error.message
        );
      }

      const result =
        data as {
          success?:
            boolean;
        } | null;

      if (
        !result?.success
      ) {
        throw new Error(
          "NFL Playoffs lineup settings could not be saved."
        );
      }

      setMessage(
        "NFL Playoffs lineup settings saved successfully."
      );

      setIsError(
        false
      );

      router.refresh();

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
          : "NFL Playoffs lineup settings could not be saved."
      );

    } finally {
      setSaving(
        false
      );
    }
  }


  return (
    <main
      className="g365-nflp-commissioner-settings"
      style={
        styles.page
      }
    >
      <style>{`
        .g365-nflp-commissioner-settings,
        .g365-nflp-commissioner-settings * {
          box-sizing: border-box;
        }

        .g365-nflp-commissioner-settings input:disabled,
        .g365-nflp-commissioner-settings button:disabled {
          opacity: .55;
          cursor: not-allowed;
        }

        @media (max-width: 900px) {
          .g365-nflp-commissioner-settings .hero {
            flex-direction: column !important;
            align-items: flex-start !important;
          }

          .g365-nflp-commissioner-settings .summary-grid {
            grid-template-columns: repeat(2,minmax(0,1fr)) !important;
          }

          .g365-nflp-commissioner-settings .position-grid {
            grid-template-columns: repeat(2,minmax(0,1fr)) !important;
          }

          .g365-nflp-commissioner-settings .two-col {
            grid-template-columns: 1fr !important;
          }
        }

        @media (max-width: 600px) {
          .g365-nflp-commissioner-settings {
            padding: 12px 10px !important;
          }

          .g365-nflp-commissioner-settings .summary-grid,
          .g365-nflp-commissioner-settings .position-grid {
            grid-template-columns: 1fr !important;
          }

          .g365-nflp-commissioner-settings .hero-actions,
          .g365-nflp-commissioner-settings .save-actions {
            width: 100% !important;
          }

          .g365-nflp-commissioner-settings .hero-actions a,
          .g365-nflp-commissioner-settings .save-actions button {
            flex: 1 1 100% !important;
            text-align: center !important;
          }
        }
      `}</style>

      <section
        style={
          styles.shell
        }
      >
        <header
          className="hero"
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
              G365 NFL PLAYOFFS · COMMISSIONER
            </p>

            <h1
              style={
                styles.title
              }
            >
              League & Lineup Settings
            </h1>

            <p
              style={
                styles.subtitle
              }
            >
              {leagueName}
              {" · "}
              {season}
              {" · "}
              {isSalary
                ? "Salary Cap"
                : "No Salary Cap"}
            </p>
          </div>

          <div
            className="hero-actions"
            style={
              styles.actions
            }
          >
            <Link
              href={`/league/${leagueId}/commissioner/nfl-playoffs`}
              style={
                styles.secondaryButton
              }
            >
              COMMISSIONER CENTER
            </Link>

            <Link
              href={`/league/${leagueId}/nfl-playoffs/settings`}
              style={
                styles.primaryButton
              }
            >
              VIEW LEAGUE SETTINGS
            </Link>
          </div>
        </header>


        {settingsLocked ? (
          <section
            style={
              styles.lockedNotice
            }
          >
            <strong
              style={
                styles.lockedTitle
              }
            >
              🔒 LINEUP SETTINGS LOCKED
            </strong>

            <p
              style={
                styles.lockedText
              }
            >
              {lockedReason ??
                "The NFL postseason has already started. Global lineup settings can no longer be changed because doing so could invalidate submitted lineups and finalized results."}
            </p>
          </section>
        ) : (
          <section
            style={
              styles.openNotice
            }
          >
            <strong
              style={
                styles.openTitle
              }
            >
              SETTINGS OPEN
            </strong>

            <p
              style={
                styles.openText
              }
            >
              These values apply to all four NFL postseason rounds. They will lock automatically once the first postseason game begins.
            </p>
          </section>
        )}


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
          className="summary-grid"
          style={
            styles.summaryGrid
          }
        >
          <Summary
            label="MODE"
            value={
              isSalary
                ? "Salary"
                : "No Salary"
            }
            detail="Player selection format"
          />

          <Summary
            label="STARTERS"
            value={
              String(
                starterCount
              )
            }
            detail="Required each round"
          />

          <Summary
            label="ROUNDS"
            value="4"
            detail="Wild Card through Super Bowl"
          />

          <Summary
            label="SETTINGS"
            value={
              settingsLocked
                ? "Locked"
                : changed
                  ? "Unsaved"
                  : "Saved"
            }
            detail={
              settingsLocked
                ? "Postseason has started"
                : changed
                  ? "Changes waiting to save"
                  : "Current configuration"
            }
          />
        </section>


        {isSalary ? (
          <section
            style={
              styles.card
            }
          >
            <SectionHead
              eyebrow="SALARY MODE"
              title="Round Salary Cap"
              badge={
                money(
                  settings.weeklySalaryCap
                )
              }
            />

            <div
              style={
                styles.cardBody
              }
            >
              <label
                style={
                  styles.field
                }
              >
                <span
                  style={
                    styles.label
                  }
                >
                  SALARY CAP
                </span>

                <input
                  type="number"
                  min={
                    1000
                  }
                  max={
                    1000000
                  }
                  step={
                    100
                  }
                  disabled={
                    settingsLocked ||
                    saving
                  }
                  value={
                    settings.weeklySalaryCap ??
                    0
                  }
                  onChange={(
                    event
                  ) =>
                    changeSalaryCap(
                      event.target.value
                    )
                  }
                  style={
                    styles.input
                  }
                />

                <span
                  style={
                    styles.help
                  }
                >
                  Maximum salary allowed for each team&apos;s lineup in each postseason round.
                </span>
              </label>
            </div>
          </section>
        ) : null}


        <section
          style={
            styles.card
          }
        >
          <SectionHead
            eyebrow="ROSTER CONSTRUCTION"
            title="Starting Lineup"
            badge={`${starterCount} STARTERS`}
          />

          <div
            className="position-grid"
            style={
              styles.positionGrid
            }
          >
            {POSITION_FIELDS.map(
              (
                field
              ) => (
                <PositionEditor
                  key={
                    field.key
                  }
                  label={
                    field.label
                  }
                  shortLabel={
                    field.shortLabel
                  }
                  description={
                    field.description
                  }
                  value={
                    settings[
                      field.key
                    ]
                  }
                  min={
                    field.min
                  }
                  max={
                    field.max
                  }
                  disabled={
                    settingsLocked ||
                    saving
                  }
                  onChange={(
                    value
                  ) =>
                    updatePosition(
                      field.key,
                      value
                    )
                  }
                />
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
          <article
            style={
              styles.card
            }
          >
            <SectionHead
              eyebrow="LINEUP SUMMARY"
              title="Current Configuration"
            />

            <div
              style={
                styles.summaryList
              }
            >
              {POSITION_FIELDS.map(
                (
                  field
                ) => (
                  <SummaryRow
                    key={
                      field.key
                    }
                    label={
                      field.shortLabel
                    }
                    value={
                      String(
                        settings[
                          field.key
                        ]
                      )
                    }
                  />
                )
              )}

              <SummaryRow
                label="TOTAL STARTERS"
                value={
                  String(
                    starterCount
                  )
                }
                emphasis
              />

              {isSalary ? (
                <SummaryRow
                  label="SALARY CAP"
                  value={
                    money(
                      settings.weeklySalaryCap
                    )
                  }
                  emphasis
                />
              ) : null}
            </div>
          </article>


          <article
            style={
              styles.card
            }
          >
            <SectionHead
              eyebrow="HOW THIS WORKS"
              title="NFL Playoffs Rules"
            />

            <div
              style={
                styles.ruleList
              }
            >
              <Rule
                title="One Structure for All Four Rounds"
                text="Wild Card, Divisional, Conference Championships, and Super Bowl use this same required lineup construction."
              />

              <Rule
                title="Fresh Lineup Every Round"
                text="Members still select a new lineup each postseason round; these settings define the required slots."
              />

              <Rule
                title="Player-Level Kickoff Locks"
                text="Individual selected players lock when their actual NFL postseason games begin."
              />

              <Rule
                title="Historical Protection"
                text="Once postseason play begins, these global settings lock so prior submissions, standings, recap results, and Trophy Case awards cannot be invalidated."
              />

              {isSalary ? (
                <Rule
                  title="Salary Pricing"
                  text="The lineup salary cap is configured here. Player-pricing engine settings are managed separately."
                />
              ) : (
                <Rule
                  title="No Salary Mode"
                  text="No salary cap or player salary restriction applies. Only the required lineup construction is enforced."
                />
              )}
            </div>
          </article>
        </section>


        <section
          style={
            styles.saveCard
          }
        >
          <div>
            <p
              style={
                styles.saveEyebrow
              }
            >
              COMMISSIONER SAVE
            </p>

            <strong
              style={
                styles.saveTitle
              }
            >
              {settingsLocked
                ? "Settings are locked"
                : changed
                  ? "You have unsaved changes"
                  : "Settings are up to date"}
            </strong>

            <p
              style={
                styles.saveText
              }
            >
              {settingsLocked
                ? "No changes can be saved after the postseason has started."
                : "Saving updates the authoritative NFL Playoffs lineup settings used by lineup validation and submission."}
            </p>
          </div>

          <div
            className="save-actions"
            style={
              styles.actions
            }
          >
            <button
              type="button"
              disabled={
                settingsLocked ||
                saving ||
                !changed
              }
              onClick={
                resetChanges
              }
              style={
                styles.secondaryAction
              }
            >
              DISCARD CHANGES
            </button>

            <button
              type="button"
              disabled={
                settingsLocked ||
                saving ||
                !changed
              }
              onClick={() =>
                void saveSettings()
              }
              style={
                styles.saveButton
              }
            >
              {saving
                ? "SAVING..."
                : "SAVE LINEUP SETTINGS"}
            </button>
          </div>
        </section>
      </section>
    </main>
  );
}


function Summary({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article
      style={
        styles.summary
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
        style={
          styles.summaryValue
        }
      >
        {value}
      </strong>

      <span
        style={
          styles.summaryDetail
        }
      >
        {detail}
      </span>
    </article>
  );
}


function SectionHead({
  eyebrow,
  title,
  badge,
}: {
  eyebrow: string;
  title: string;
  badge?: string;
}) {
  return (
    <div
      style={
        styles.cardHeader
      }
    >
      <div>
        <p
          style={
            styles.sectionEyebrow
          }
        >
          {eyebrow}
        </p>

        <h2
          style={
            styles.sectionTitle
          }
        >
          {title}
        </h2>
      </div>

      {badge ? (
        <span
          style={
            styles.badge
          }
        >
          {badge}
        </span>
      ) : null}
    </div>
  );
}


function PositionEditor({
  label,
  shortLabel,
  description,
  value,
  min,
  max,
  disabled,
  onChange,
}: {
  label: string;
  shortLabel: string;
  description: string;
  value: number;
  min: number;
  max: number;
  disabled: boolean;
  onChange: (
    value: number
  ) => void;
}) {
  return (
    <article
      style={
        styles.positionCard
      }
    >
      <div
        style={
          styles.positionTop
        }
      >
        <div>
          <span
            style={
              styles.positionCode
            }
          >
            {shortLabel}
          </span>

          <strong
            style={
              styles.positionLabel
            }
          >
            {label}
          </strong>
        </div>

        <strong
          style={
            styles.positionValue
          }
        >
          {value}
        </strong>
      </div>

      <p
        style={
          styles.positionDescription
        }
      >
        {description}
      </p>

      <div
        style={
          styles.counter
        }
      >
        <button
          type="button"
          disabled={
            disabled ||
            value <= min
          }
          onClick={() =>
            onChange(
              Math.max(
                min,
                value - 1
              )
            )
          }
          style={
            styles.counterButton
          }
        >
          −
        </button>

        <input
          type="number"
          min={
            min
          }
          max={
            max
          }
          disabled={
            disabled
          }
          value={
            value
          }
          onChange={(
            event
          ) => {
            const next =
              Number(
                event.target.value
              );

            if (
              Number.isFinite(
                next
              )
            ) {
              onChange(
                Math.max(
                  min,
                  Math.min(
                    max,
                    Math.trunc(
                      next
                    )
                  )
                )
              );
            }
          }}
          style={
            styles.counterInput
          }
        />

        <button
          type="button"
          disabled={
            disabled ||
            value >= max
          }
          onClick={() =>
            onChange(
              Math.min(
                max,
                value + 1
              )
            )
          }
          style={
            styles.counterButton
          }
        >
          +
        </button>
      </div>

      <span
        style={
          styles.range
        }
      >
        Allowed: {min}–{max}
      </span>
    </article>
  );
}


function SummaryRow({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div
      style={{
        ...styles.summaryRow,
        ...(emphasis
          ? styles.summaryRowEmphasis
          : {}),
      }}
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
      <strong
        style={
          styles.ruleTitle
        }
      >
        {title}
      </strong>

      <p
        style={
          styles.ruleText
        }
      >
        {text}
      </p>
    </div>
  );
}


const styles:
  Record<
    string,
    CSSProperties
  > = {
  page: {
    minHeight: "100vh",
    padding: 22,
    color: "#f5f5f5",
    background:
      "linear-gradient(180deg,#080808,#101010)",
  },

  shell: {
    width: "100%",
    maxWidth: 1320,
    margin: "0 auto",
  },

  hero: {
    display: "flex",
    alignItems: "center",
    justifyContent:
      "space-between",
    gap: 18,
    marginBottom: 16,
    padding: 24,
    border:
      "1px solid #2c2c2c",
    borderRadius: 20,
    background:
      "linear-gradient(135deg,rgba(139,24,10,.28),rgba(241,94,20,.08),#111)",
  },

  eyebrow: {
    margin: 0,
    color: "#ff671e",
    fontSize: 9,
    fontWeight: 900,
    letterSpacing: ".13em",
  },

  title: {
    margin: "5px 0",
    fontSize: 32,
    lineHeight: 1,
  },

  subtitle: {
    margin: 0,
    color: "#808080",
    fontSize: 11,
  },

  actions: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },

  primaryButton: {
    padding: "10px 14px",
    borderRadius: 9,
    color: "#fff",
    textDecoration: "none",
    background:
      "linear-gradient(135deg,#a32412,#ee6517)",
    fontSize: 8,
    fontWeight: 900,
  },

  secondaryButton: {
    padding: "10px 14px",
    border:
      "1px solid #373737",
    borderRadius: 9,
    color: "#bdbdbd",
    textDecoration: "none",
    background: "#151515",
    fontSize: 8,
    fontWeight: 900,
  },

  lockedNotice: {
    marginBottom: 16,
    padding: 15,
    border:
      "1px solid #603135",
    borderRadius: 12,
    background:
      "#1a1011",
  },

  lockedTitle: {
    display: "block",
    color: "#f07878",
    fontSize: 9,
    letterSpacing: ".06em",
  },

  lockedText: {
    margin:
      "6px 0 0",
    color: "#a77b7d",
    fontSize: 9,
    lineHeight: 1.5,
  },

  openNotice: {
    marginBottom: 16,
    padding: 15,
    border:
      "1px solid #34543c",
    borderRadius: 12,
    background:
      "#101712",
  },

  openTitle: {
    display: "block",
    color: "#70d38b",
    fontSize: 9,
    letterSpacing: ".06em",
  },

  openText: {
    margin:
      "6px 0 0",
    color: "#76907c",
    fontSize: 9,
    lineHeight: 1.5,
  },

  success: {
    marginBottom: 16,
    padding: 12,
    border:
      "1px solid #31513a",
    borderRadius: 10,
    color: "#81dda0",
    background: "#101712",
    fontSize: 9,
  },

  error: {
    marginBottom: 16,
    padding: 12,
    border:
      "1px solid #603034",
    borderRadius: 10,
    color: "#ef8989",
    background: "#1a1011",
    fontSize: 9,
  },

  summaryGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(4,minmax(0,1fr))",
    gap: 10,
    marginBottom: 16,
  },

  summary: {
    padding: 14,
    border:
      "1px solid #292929",
    borderRadius: 13,
    background: "#121212",
  },

  summaryLabel: {
    display: "block",
    color: "#df5c20",
    fontSize: 7,
    fontWeight: 900,
    letterSpacing: ".09em",
  },

  summaryValue: {
    display: "block",
    margin: "4px 0",
    fontSize: 18,
  },

  summaryDetail: {
    display: "block",
    color: "#666",
    fontSize: 8,
  },

  card: {
    marginBottom: 16,
    overflow: "hidden",
    border:
      "1px solid #292929",
    borderRadius: 15,
    background: "#111",
  },

  cardHeader: {
    display: "flex",
    justifyContent:
      "space-between",
    alignItems: "center",
    gap: 12,
    padding: "15px 17px",
    borderBottom:
      "1px solid #242424",
  },

  sectionEyebrow: {
    margin: 0,
    color: "#dc5d21",
    fontSize: 7,
    fontWeight: 900,
    letterSpacing: ".1em",
  },

  sectionTitle: {
    margin: "4px 0 0",
    fontSize: 18,
  },

  badge: {
    padding: "6px 8px",
    border:
      "1px solid #48301f",
    borderRadius: 999,
    color: "#df7939",
    background: "#1d140e",
    fontSize: 7,
    fontWeight: 900,
  },

  cardBody: {
    padding: 15,
  },

  field: {
    display: "grid",
    gap: 7,
  },

  label: {
    color: "#dc6125",
    fontSize: 8,
    fontWeight: 900,
  },

  input: {
    width: "100%",
    maxWidth: 350,
    padding: "12px 13px",
    border:
      "1px solid #373737",
    borderRadius: 9,
    color: "#fff",
    background: "#171717",
    fontSize: 14,
    outline: "none",
  },

  help: {
    color: "#686868",
    fontSize: 8,
    lineHeight: 1.4,
  },

  positionGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(4,minmax(0,1fr))",
    gap: 10,
    padding: 14,
  },

  positionCard: {
    padding: 13,
    border:
      "1px solid #2d2d2d",
    borderRadius: 11,
    background: "#151515",
  },

  positionTop: {
    display: "flex",
    justifyContent:
      "space-between",
    gap: 10,
  },

  positionCode: {
    display: "block",
    color: "#e46628",
    fontSize: 7,
    fontWeight: 900,
  },

  positionLabel: {
    display: "block",
    marginTop: 3,
    fontSize: 11,
  },

  positionValue: {
    fontSize: 23,
  },

  positionDescription: {
    minHeight: 38,
    margin: "9px 0",
    color: "#6f6f6f",
    fontSize: 8,
    lineHeight: 1.4,
  },

  counter: {
    display: "grid",
    gridTemplateColumns:
      "38px minmax(0,1fr) 38px",
    gap: 6,
  },

  counterButton: {
    border:
      "1px solid #3a3a3a",
    borderRadius: 8,
    color: "#fff",
    background: "#1e1e1e",
    fontSize: 18,
    cursor: "pointer",
  },

  counterInput: {
    width: "100%",
    minWidth: 0,
    padding: "9px 6px",
    border:
      "1px solid #373737",
    borderRadius: 8,
    color: "#fff",
    textAlign: "center",
    background: "#101010",
    fontSize: 13,
  },

  range: {
    display: "block",
    marginTop: 7,
    color: "#555",
    fontSize: 7,
  },

  twoColumn: {
    display: "grid",
    gridTemplateColumns:
      "repeat(2,minmax(0,1fr))",
    gap: 12,
    marginBottom: 16,
  },

  summaryList: {
    padding: "4px 15px 14px",
  },

  summaryRow: {
    display: "flex",
    justifyContent:
      "space-between",
    alignItems: "center",
    gap: 12,
    padding: "10px 0",
    borderBottom:
      "1px solid #222",
    color: "#777",
    fontSize: 9,
  },

  summaryRowEmphasis: {
    color: "#f2f2f2",
    fontWeight: 800,
  },

  ruleList: {
    padding: "4px 15px 14px",
  },

  rule: {
    padding: "10px 0",
    borderBottom:
      "1px solid #222",
  },

  ruleTitle: {
    display: "block",
    fontSize: 9,
  },

  ruleText: {
    margin: "4px 0 0",
    color: "#717171",
    fontSize: 8,
    lineHeight: 1.45,
  },

  saveCard: {
    display: "flex",
    justifyContent:
      "space-between",
    alignItems: "center",
    gap: 16,
    flexWrap: "wrap",
    padding: 17,
    border:
      "1px solid #3c2b24",
    borderRadius: 14,
    background:
      "linear-gradient(135deg,#16100d,#111)",
  },

  saveEyebrow: {
    margin: 0,
    color: "#dc5f22",
    fontSize: 7,
    fontWeight: 900,
    letterSpacing: ".09em",
  },

  saveTitle: {
    display: "block",
    marginTop: 5,
    fontSize: 13,
  },

  saveText: {
    maxWidth: 620,
    margin:
      "5px 0 0",
    color: "#6d6d6d",
    fontSize: 8,
    lineHeight: 1.45,
  },

  secondaryAction: {
    padding: "10px 13px",
    border:
      "1px solid #3a3a3a",
    borderRadius: 9,
    color: "#aaa",
    background: "#151515",
    fontSize: 8,
    fontWeight: 900,
    cursor: "pointer",
  },

  saveButton: {
    padding: "11px 15px",
    border: 0,
    borderRadius: 9,
    color: "#fff",
    background:
      "linear-gradient(135deg,#a42312,#ef6618)",
    fontSize: 8,
    fontWeight: 900,
    cursor: "pointer",
  },
};