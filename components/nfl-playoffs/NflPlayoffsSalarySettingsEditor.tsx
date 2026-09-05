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


type SalarySettings = {
  minimumSalary: number;
  maximumSalary: number;
  salaryIncrement: number;

  projectionWeight: number;
  recentFormWeight: number;
  usageWeight: number;

  qbMultiplier: number;
  rbMultiplier: number;
  wrMultiplier: number;
  teMultiplier: number;
  kMultiplier: number;
  dstMultiplier: number;

  maximumRoundIncrease: number;
  maximumRoundDecrease: number;

  questionableMultiplier: number;
  doubtfulMultiplier: number;
  outMultiplier: number;
};


type Props = {
  leagueId: string;
  leagueName: string;
  season: number;

  salaryCap: number | null;

  settingsLocked: boolean;

  lockedReason:
    string |
    null;

  initialSettings:
    SalarySettings;
};


type NumericKey =
  keyof SalarySettings;


function money(
  value:
    number |
    null |
    undefined
) {
  const amount =
    Number(
      value ??
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


function decimal(
  value:
    number
) {
  return Number(
    value.toFixed(
      4
    )
  );
}


export default function NflPlayoffsSalarySettingsEditor({
  leagueId,
  leagueName,
  season,
  salaryCap,
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
    useState<SalarySettings>(
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


  const changed =
    JSON.stringify(
      settings
    ) !==
    JSON.stringify(
      initialSettings
    );


  function update(
    key:
      NumericKey,
    rawValue:
      string
  ) {
    if (
      settingsLocked
    ) {
      return;
    }

    const parsed =
      Number(
        rawValue
      );

    setSettings(
      (
        current
      ) => ({
        ...current,

        [key]:
          Number.isFinite(
            parsed
          )
            ? parsed
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

    setIsError(
      false
    );

    setMessage(
      "Unsaved salary-pricing changes discarded."
    );
  }


  function validate() {
    if (
      settings.minimumSalary <
      0
    ) {
      return "Minimum salary cannot be negative.";
    }


    if (
      settings.maximumSalary <=
      settings.minimumSalary
    ) {
      return "Maximum salary must be greater than minimum salary.";
    }


    if (
      settings.maximumSalary >
      1000000
    ) {
      return "Maximum salary cannot exceed $1,000,000.";
    }


    if (
      settings.salaryIncrement <
      1
    ) {
      return "Salary increment must be at least $1.";
    }


    if (
      settings.salaryIncrement >
      settings.maximumSalary
    ) {
      return "Salary increment cannot exceed maximum salary.";
    }


    if (
      settings.projectionWeight <
        0 ||
      settings.projectionWeight >
        3
    ) {
      return "Projection weight must be between 0 and 3.";
    }


    if (
      settings.recentFormWeight <
        0 ||
      settings.recentFormWeight >
        1
    ) {
      return "Recent-form weight must be between 0 and 1.";
    }


    if (
      settings.usageWeight <
        0 ||
      settings.usageWeight >
        1
    ) {
      return "Usage weight must be between 0 and 1.";
    }


    const positionMultipliers = [
      settings.qbMultiplier,
      settings.rbMultiplier,
      settings.wrMultiplier,
      settings.teMultiplier,
      settings.kMultiplier,
      settings.dstMultiplier,
    ];


    if (
      positionMultipliers.some(
        (
          value
        ) =>
          value <
            0 ||
          value >
            3
      )
    ) {
      return "Position multipliers must be between 0 and 3.";
    }


    if (
      settings.maximumRoundIncrease <
        0 ||
      settings.maximumRoundDecrease <
        0
    ) {
      return "Round salary movement limits cannot be negative.";
    }


    if (
      settings.maximumRoundIncrease >
        100000 ||
      settings.maximumRoundDecrease >
        100000
    ) {
      return "Round salary movement limits cannot exceed $100,000.";
    }


    if (
      settings.questionableMultiplier <
        0 ||
      settings.questionableMultiplier >
        1 ||
      settings.doubtfulMultiplier <
        0 ||
      settings.doubtfulMultiplier >
        1 ||
      settings.outMultiplier <
        0 ||
      settings.outMultiplier >
        1
    ) {
      return "Injury multipliers must be between 0 and 1.";
    }


    if (
      settings.doubtfulMultiplier >
      settings.questionableMultiplier
    ) {
      return "Doubtful multiplier cannot be greater than questionable multiplier.";
    }


    if (
      settings.outMultiplier >
      settings.doubtfulMultiplier
    ) {
      return "Out multiplier cannot be greater than doubtful multiplier.";
    }


    return null;
  }


  async function saveSettings() {
    if (
      saving ||
      settingsLocked
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
          "save_nfl_playoff_salary_settings",
          {
            p_league_id:
              leagueId,

            p_minimum_salary:
              settings.minimumSalary,

            p_maximum_salary:
              settings.maximumSalary,

            p_salary_increment:
              settings.salaryIncrement,

            p_projection_weight:
              decimal(
                settings.projectionWeight
              ),

            p_recent_form_weight:
              decimal(
                settings.recentFormWeight
              ),

            p_usage_weight:
              decimal(
                settings.usageWeight
              ),

            p_qb_multiplier:
              decimal(
                settings.qbMultiplier
              ),

            p_rb_multiplier:
              decimal(
                settings.rbMultiplier
              ),

            p_wr_multiplier:
              decimal(
                settings.wrMultiplier
              ),

            p_te_multiplier:
              decimal(
                settings.teMultiplier
              ),

            p_k_multiplier:
              decimal(
                settings.kMultiplier
              ),

            p_dst_multiplier:
              decimal(
                settings.dstMultiplier
              ),

            p_maximum_round_increase:
              settings.maximumRoundIncrease,

            p_maximum_round_decrease:
              settings.maximumRoundDecrease,

            p_questionable_multiplier:
              decimal(
                settings.questionableMultiplier
              ),

            p_doubtful_multiplier:
              decimal(
                settings.doubtfulMultiplier
              ),

            p_out_multiplier:
              decimal(
                settings.outMultiplier
              ),
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
          "NFL Playoffs salary pricing settings could not be saved."
        );
      }


      setIsError(
        false
      );

      setMessage(
        "NFL Playoffs salary pricing settings saved successfully."
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
          : "NFL Playoffs salary pricing settings could not be saved."
      );

    } finally {
      setSaving(
        false
      );
    }
  }


  return (
    <main
      className="g365-nflp-salary-settings"
      style={
        styles.page
      }
    >
      <style>{`
        .g365-nflp-salary-settings,
        .g365-nflp-salary-settings * {
          box-sizing: border-box;
        }

        .g365-nflp-salary-settings input:disabled,
        .g365-nflp-salary-settings button:disabled {
          opacity: .55;
          cursor: not-allowed;
        }

        @media (max-width: 1000px) {
          .g365-nflp-salary-settings .hero {
            flex-direction: column !important;
            align-items: flex-start !important;
          }

          .g365-nflp-salary-settings .summary-grid {
            grid-template-columns: repeat(2,minmax(0,1fr)) !important;
          }

          .g365-nflp-salary-settings .field-grid {
            grid-template-columns: repeat(2,minmax(0,1fr)) !important;
          }

          .g365-nflp-salary-settings .position-grid {
            grid-template-columns: repeat(3,minmax(0,1fr)) !important;
          }

          .g365-nflp-salary-settings .two-col {
            grid-template-columns: 1fr !important;
          }
        }

        @media (max-width: 620px) {
          .g365-nflp-salary-settings {
            padding: 12px 10px !important;
          }

          .g365-nflp-salary-settings .summary-grid,
          .g365-nflp-salary-settings .field-grid,
          .g365-nflp-salary-settings .position-grid {
            grid-template-columns: 1fr !important;
          }

          .g365-nflp-salary-settings .hero-actions,
          .g365-nflp-salary-settings .save-actions {
            width: 100% !important;
          }

          .g365-nflp-salary-settings .hero-actions a,
          .g365-nflp-salary-settings .save-actions button {
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
        {/* =====================================================
            HERO
            ===================================================== */}

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
              Salary & Pricing
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
              Salary Cap
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
              href={`/league/${leagueId}/commissioner/nfl-playoffs/settings`}
              style={
                styles.primaryButton
              }
            >
              LINEUP SETTINGS
            </Link>
          </div>
        </header>


        {/* =====================================================
            LOCK STATE
            ===================================================== */}

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
              🔒 PRICING SETTINGS LOCKED
            </strong>

            <p
              style={
                styles.lockedText
              }
            >
              {lockedReason ??
                "Postseason play has already started. Pricing-engine settings are protected from further changes."}
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
              PRICING SETTINGS OPEN
            </strong>

            <p
              style={
                styles.openText
              }
            >
              Configure how G365 generates NFL postseason player salaries. These controls lock once postseason play begins.
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


        {/* =====================================================
            SUMMARY
            ===================================================== */}

        <section
          className="summary-grid"
          style={
            styles.summaryGrid
          }
        >
          <Summary
            label="LINEUP CAP"
            value={
              money(
                salaryCap
              )
            }
            detail="Configured in lineup settings"
          />

          <Summary
            label="PLAYER RANGE"
            value={`${money(
              settings.minimumSalary
            )} – ${money(
              settings.maximumSalary
            )}`}
            detail="Generated player salaries"
          />

          <Summary
            label="INCREMENT"
            value={
              money(
                settings.salaryIncrement
              )
            }
            detail="Salary denomination"
          />

          <Summary
            label="STATUS"
            value={
              settingsLocked
                ? "Locked"
                : changed
                  ? "Unsaved"
                  : "Saved"
            }
            detail={
              settingsLocked
                ? "Postseason started"
                : changed
                  ? "Changes pending"
                  : "Current pricing model"
            }
          />
        </section>


        {/* =====================================================
            SALARY RANGE
            ===================================================== */}

        <section
          style={
            styles.card
          }
        >
          <SectionHead
            eyebrow="PLAYER SALARY RANGE"
            title="Salary Boundaries"
            badge={`${money(
              settings.minimumSalary
            )} – ${money(
              settings.maximumSalary
            )}`}
          />

          <div
            className="field-grid"
            style={
              styles.fieldGrid
            }
          >
            <NumberField
              label="Minimum Player Salary"
              description="Lowest salary the pricing engine may assign to an available player."
              value={
                settings.minimumSalary
              }
              min={
                0
              }
              max={
                1000000
              }
              step={
                100
              }
              prefix="$"
              disabled={
                settingsLocked ||
                saving
              }
              onChange={(
                value
              ) =>
                update(
                  "minimumSalary",
                  value
                )
              }
            />

            <NumberField
              label="Maximum Player Salary"
              description="Highest salary the pricing engine may assign to an available player."
              value={
                settings.maximumSalary
              }
              min={
                1
              }
              max={
                1000000
              }
              step={
                100
              }
              prefix="$"
              disabled={
                settingsLocked ||
                saving
              }
              onChange={(
                value
              ) =>
                update(
                  "maximumSalary",
                  value
                )
              }
            />

            <NumberField
              label="Salary Increment"
              description="Generated salaries are rounded to this denomination."
              value={
                settings.salaryIncrement
              }
              min={
                1
              }
              max={
                settings.maximumSalary
              }
              step={
                50
              }
              prefix="$"
              disabled={
                settingsLocked ||
                saving
              }
              onChange={(
                value
              ) =>
                update(
                  "salaryIncrement",
                  value
                )
              }
            />
          </div>
        </section>


        {/* =====================================================
            PRICING INPUTS
            ===================================================== */}

        <section
          style={
            styles.card
          }
        >
          <SectionHead
            eyebrow="PRICE CALCULATION"
            title="Pricing Inputs"
          />

          <div
            className="field-grid"
            style={
              styles.fieldGrid
            }
          >
            <NumberField
              label="Projection Weight"
              description="Overall influence of projected fantasy production on a player's generated salary."
              value={
                settings.projectionWeight
              }
              min={
                0
              }
              max={
                3
              }
              step={
                0.05
              }
              disabled={
                settingsLocked ||
                saving
              }
              onChange={(
                value
              ) =>
                update(
                  "projectionWeight",
                  value
                )
              }
            />

            <NumberField
              label="Recent Form Weight"
              description="Influence of recent player production entering the postseason round."
              value={
                settings.recentFormWeight
              }
              min={
                0
              }
              max={
                1
              }
              step={
                0.05
              }
              disabled={
                settingsLocked ||
                saving
              }
              onChange={(
                value
              ) =>
                update(
                  "recentFormWeight",
                  value
                )
              }
            />

            <NumberField
              label="Usage Weight"
              description="Influence of player opportunity and usage when establishing price."
              value={
                settings.usageWeight
              }
              min={
                0
              }
              max={
                1
              }
              step={
                0.05
              }
              disabled={
                settingsLocked ||
                saving
              }
              onChange={(
                value
              ) =>
                update(
                  "usageWeight",
                  value
                )
              }
            />
          </div>

          <div
            style={
              styles.explanation
            }
          >
            Higher values give that input more influence on generated player pricing. These values affect the pricing model; they do not change fantasy scoring.
          </div>
        </section>


        {/* =====================================================
            POSITION MULTIPLIERS
            ===================================================== */}

        <section
          style={
            styles.card
          }
        >
          <SectionHead
            eyebrow="POSITION MARKET"
            title="Position Multipliers"
          />

          <div
            className="position-grid"
            style={
              styles.positionGrid
            }
          >
            <MultiplierField
              position="QB"
              value={
                settings.qbMultiplier
              }
              disabled={
                settingsLocked ||
                saving
              }
              onChange={(
                value
              ) =>
                update(
                  "qbMultiplier",
                  value
                )
              }
            />

            <MultiplierField
              position="RB"
              value={
                settings.rbMultiplier
              }
              disabled={
                settingsLocked ||
                saving
              }
              onChange={(
                value
              ) =>
                update(
                  "rbMultiplier",
                  value
                )
              }
            />

            <MultiplierField
              position="WR"
              value={
                settings.wrMultiplier
              }
              disabled={
                settingsLocked ||
                saving
              }
              onChange={(
                value
              ) =>
                update(
                  "wrMultiplier",
                  value
                )
              }
            />

            <MultiplierField
              position="TE"
              value={
                settings.teMultiplier
              }
              disabled={
                settingsLocked ||
                saving
              }
              onChange={(
                value
              ) =>
                update(
                  "teMultiplier",
                  value
                )
              }
            />

            <MultiplierField
              position="K"
              value={
                settings.kMultiplier
              }
              disabled={
                settingsLocked ||
                saving
              }
              onChange={(
                value
              ) =>
                update(
                  "kMultiplier",
                  value
                )
              }
            />

            <MultiplierField
              position="DST"
              value={
                settings.dstMultiplier
              }
              disabled={
                settingsLocked ||
                saving
              }
              onChange={(
                value
              ) =>
                update(
                  "dstMultiplier",
                  value
                )
              }
            />
          </div>

          <div
            style={
              styles.explanation
            }
          >
            1.00 is neutral. Above 1.00 increases relative pricing for that position; below 1.00 reduces it.
          </div>
        </section>


        {/* =====================================================
            MOVEMENT + INJURY
            ===================================================== */}

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
              eyebrow="ROUND-TO-ROUND"
              title="Salary Movement"
            />

            <div
              style={
                styles.verticalFields
              }
            >
              <NumberField
                label="Maximum Round Increase"
                description="Maximum amount a player's salary may rise from the prior postseason round."
                value={
                  settings.maximumRoundIncrease
                }
                min={
                  0
                }
                max={
                  100000
                }
                step={
                  100
                }
                prefix="$"
                disabled={
                  settingsLocked ||
                  saving
                }
                onChange={(
                  value
                ) =>
                  update(
                    "maximumRoundIncrease",
                    value
                  )
                }
              />

              <NumberField
                label="Maximum Round Decrease"
                description="Maximum amount a player's salary may fall from the prior postseason round."
                value={
                  settings.maximumRoundDecrease
                }
                min={
                  0
                }
                max={
                  100000
                }
                step={
                  100
                }
                prefix="$"
                disabled={
                  settingsLocked ||
                  saving
                }
                onChange={(
                  value
                ) =>
                  update(
                    "maximumRoundDecrease",
                    value
                  )
                }
              />
            </div>
          </article>


          <article
            style={
              styles.card
            }
          >
            <SectionHead
              eyebrow="PLAYER AVAILABILITY"
              title="Injury Adjustments"
            />

            <div
              style={
                styles.verticalFields
              }
            >
              <NumberField
                label="Questionable Multiplier"
                description="Salary adjustment applied to players classified as Questionable."
                value={
                  settings.questionableMultiplier
                }
                min={
                  0
                }
                max={
                  1
                }
                step={
                  0.05
                }
                disabled={
                  settingsLocked ||
                  saving
                }
                onChange={(
                  value
                ) =>
                  update(
                    "questionableMultiplier",
                    value
                  )
                }
              />

              <NumberField
                label="Doubtful Multiplier"
                description="Salary adjustment applied to players classified as Doubtful."
                value={
                  settings.doubtfulMultiplier
                }
                min={
                  0
                }
                max={
                  1
                }
                step={
                  0.05
                }
                disabled={
                  settingsLocked ||
                  saving
                }
                onChange={(
                  value
                ) =>
                  update(
                    "doubtfulMultiplier",
                    value
                  )
                }
              />

              <NumberField
                label="Out Multiplier"
                description="Salary multiplier used for players classified as Out."
                value={
                  settings.outMultiplier
                }
                min={
                  0
                }
                max={
                  1
                }
                step={
                  0.05
                }
                disabled={
                  settingsLocked ||
                  saving
                }
                onChange={(
                  value
                ) =>
                  update(
                    "outMultiplier",
                    value
                  )
                }
              />
            </div>
          </article>
        </section>


        {/* =====================================================
            MODEL SUMMARY
            ===================================================== */}

        <section
          style={
            styles.card
          }
        >
          <SectionHead
            eyebrow="CURRENT MODEL"
            title="Pricing Summary"
          />

          <div
            style={
              styles.summaryList
            }
          >
            <SummaryRow
              label="Player Salary Range"
              value={`${money(
                settings.minimumSalary
              )} – ${money(
                settings.maximumSalary
              )}`}
            />

            <SummaryRow
              label="Salary Increment"
              value={
                money(
                  settings.salaryIncrement
                )
              }
            />

            <SummaryRow
              label="Projection Weight"
              value={
                settings.projectionWeight.toFixed(
                  2
                )
              }
            />

            <SummaryRow
              label="Recent Form Weight"
              value={
                settings.recentFormWeight.toFixed(
                  2
                )
              }
            />

            <SummaryRow
              label="Usage Weight"
              value={
                settings.usageWeight.toFixed(
                  2
                )
              }
            />

            <SummaryRow
              label="Round Increase Limit"
              value={
                money(
                  settings.maximumRoundIncrease
                )
              }
            />

            <SummaryRow
              label="Round Decrease Limit"
              value={
                money(
                  settings.maximumRoundDecrease
                )
              }
            />
          </div>
        </section>


        {/* =====================================================
            SAVE
            ===================================================== */}

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
                ? "Pricing settings are locked"
                : changed
                  ? "You have unsaved changes"
                  : "Pricing settings are up to date"}
            </strong>

            <p
              style={
                styles.saveText
              }
            >
              {settingsLocked
                ? "The postseason has begun, so the pricing model can no longer be changed."
                : "Saving changes the pricing rules used when G365 generates NFL Playoffs player salaries."}
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
                : "SAVE PRICING SETTINGS"}
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


function NumberField({
  label,
  description,
  value,
  min,
  max,
  step,
  prefix,
  disabled,
  onChange,
}: {
  label: string;
  description: string;
  value: number;
  min: number;
  max: number;
  step: number;
  prefix?: string;
  disabled: boolean;

  onChange: (
    value:
      string
  ) => void;
}) {
  return (
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
        {label}
      </span>

      <div
        style={
          styles.inputWrap
        }
      >
        {prefix ? (
          <span
            style={
              styles.prefix
            }
          >
            {prefix}
          </span>
        ) : null}

        <input
          type="number"
          min={
            min
          }
          max={
            max
          }
          step={
            step
          }
          disabled={
            disabled
          }
          value={
            value
          }
          onChange={(
            event
          ) =>
            onChange(
              event.target.value
            )
          }
          style={{
            ...styles.input,

            ...(prefix
              ? styles.inputWithPrefix
              : {}),
          }}
        />
      </div>

      <span
        style={
          styles.help
        }
      >
        {description}
      </span>
    </label>
  );
}


function MultiplierField({
  position,
  value,
  disabled,
  onChange,
}: {
  position: string;
  value: number;
  disabled: boolean;

  onChange: (
    value:
      string
  ) => void;
}) {
  const direction =
    value >
    1
      ? "Premium"
      : value <
          1
        ? "Discount"
        : "Neutral";

  return (
    <article
      style={
        styles.positionCard
      }
    >
      <div
        style={
          styles.positionHeader
        }
      >
        <strong
          style={
            styles.positionName
          }
        >
          {position}
        </strong>

        <span
          style={
            styles.positionState
          }
        >
          {direction}
        </span>
      </div>

      <input
        type="number"
        min={
          0
        }
        max={
          3
        }
        step={
          0.05
        }
        disabled={
          disabled
        }
        value={
          value
        }
        onChange={(
          event
        ) =>
          onChange(
            event.target.value
          )
        }
        style={
          styles.positionInput
        }
      />

      <span
        style={
          styles.positionHint
        }
      >
        {value.toFixed(
          2
        )}×
      </span>
    </article>
  );
}


function SummaryRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div
      style={
        styles.summaryRow
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


const styles:
  Record<
    string,
    CSSProperties
  > = {
  page: {
    minHeight:
      "100vh",

    padding:
      22,

    color:
      "#f5f5f5",

    background:
      "linear-gradient(180deg,#080808,#101010)",
  },

  shell: {
    width:
      "100%",

    maxWidth:
      1320,

    margin:
      "0 auto",
  },

  hero: {
    display:
      "flex",

    justifyContent:
      "space-between",

    alignItems:
      "center",

    gap:
      18,

    marginBottom:
      16,

    padding:
      24,

    border:
      "1px solid #2c2c2c",

    borderRadius:
      20,

    background:
      "linear-gradient(135deg,rgba(139,24,10,.28),rgba(241,94,20,.08),#111)",
  },

  eyebrow: {
    margin:
      0,

    color:
      "#ff671e",

    fontSize:
      9,

    fontWeight:
      900,

    letterSpacing:
      ".13em",
  },

  title: {
    margin:
      "5px 0",

    fontSize:
      32,

    lineHeight:
      1,
  },

  subtitle: {
    margin:
      0,

    color:
      "#808080",

    fontSize:
      11,
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

  primaryButton: {
    padding:
      "10px 14px",

    borderRadius:
      9,

    color:
      "#fff",

    textDecoration:
      "none",

    background:
      "linear-gradient(135deg,#a32412,#ee6517)",

    fontSize:
      8,

    fontWeight:
      900,
  },

  secondaryButton: {
    padding:
      "10px 14px",

    border:
      "1px solid #373737",

    borderRadius:
      9,

    color:
      "#bdbdbd",

    textDecoration:
      "none",

    background:
      "#151515",

    fontSize:
      8,

    fontWeight:
      900,
  },

  openNotice: {
    marginBottom:
      16,

    padding:
      15,

    border:
      "1px solid #34543c",

    borderRadius:
      12,

    background:
      "#101712",
  },

  openTitle: {
    display:
      "block",

    color:
      "#70d38b",

    fontSize:
      9,

    letterSpacing:
      ".06em",
  },

  openText: {
    margin:
      "6px 0 0",

    color:
      "#76907c",

    fontSize:
      9,

    lineHeight:
      1.5,
  },

  lockedNotice: {
    marginBottom:
      16,

    padding:
      15,

    border:
      "1px solid #603135",

    borderRadius:
      12,

    background:
      "#1a1011",
  },

  lockedTitle: {
    display:
      "block",

    color:
      "#f07878",

    fontSize:
      9,

    letterSpacing:
      ".06em",
  },

  lockedText: {
    margin:
      "6px 0 0",

    color:
      "#a77b7d",

    fontSize:
      9,

    lineHeight:
      1.5,
  },

  success: {
    marginBottom:
      16,

    padding:
      12,

    border:
      "1px solid #31513a",

    borderRadius:
      10,

    color:
      "#81dda0",

    background:
      "#101712",

    fontSize:
      9,
  },

  error: {
    marginBottom:
      16,

    padding:
      12,

    border:
      "1px solid #603034",

    borderRadius:
      10,

    color:
      "#ef8989",

    background:
      "#1a1011",

    fontSize:
      9,
  },

  summaryGrid: {
    display:
      "grid",

    gridTemplateColumns:
      "repeat(4,minmax(0,1fr))",

    gap:
      10,

    marginBottom:
      16,
  },

  summary: {
    padding:
      14,

    border:
      "1px solid #292929",

    borderRadius:
      13,

    background:
      "#121212",
  },

  summaryLabel: {
    display:
      "block",

    color:
      "#df5c20",

    fontSize:
      7,

    fontWeight:
      900,

    letterSpacing:
      ".09em",
  },

  summaryValue: {
    display:
      "block",

    margin:
      "4px 0",

    fontSize:
      17,
  },

  summaryDetail: {
    display:
      "block",

    color:
      "#666",

    fontSize:
      8,

    lineHeight:
      1.35,
  },

  card: {
    marginBottom:
      16,

    overflow:
      "hidden",

    border:
      "1px solid #292929",

    borderRadius:
      15,

    background:
      "#111",
  },

  cardHeader: {
    display:
      "flex",

    justifyContent:
      "space-between",

    alignItems:
      "center",

    gap:
      12,

    padding:
      "15px 17px",

    borderBottom:
      "1px solid #242424",
  },

  sectionEyebrow: {
    margin:
      0,

    color:
      "#dc5d21",

    fontSize:
      7,

    fontWeight:
      900,

    letterSpacing:
      ".1em",
  },

  sectionTitle: {
    margin:
      "4px 0 0",

    fontSize:
      18,
  },

  badge: {
    padding:
      "6px 8px",

    border:
      "1px solid #48301f",

    borderRadius:
      999,

    color:
      "#df7939",

    background:
      "#1d140e",

    fontSize:
      7,

    fontWeight:
      900,
  },

  fieldGrid: {
    display:
      "grid",

    gridTemplateColumns:
      "repeat(3,minmax(0,1fr))",

    gap:
      12,

    padding:
      15,
  },

  verticalFields: {
    display:
      "grid",

    gap:
      16,

    padding:
      15,
  },

  field: {
    display:
      "grid",

    alignContent:
      "start",

    gap:
      7,
  },

  label: {
    color:
      "#d7d7d7",

    fontSize:
      9,

    fontWeight:
      800,
  },

  inputWrap: {
    position:
      "relative",
  },

  prefix: {
    position:
      "absolute",

    left:
      12,

    top:
      "50%",

    transform:
      "translateY(-50%)",

    color:
      "#686868",

    fontSize:
      11,

    pointerEvents:
      "none",
  },

  input: {
    width:
      "100%",

    minWidth:
      0,

    padding:
      "11px 12px",

    border:
      "1px solid #373737",

    borderRadius:
      9,

    color:
      "#fff",

    background:
      "#171717",

    fontSize:
      12,

    outline:
      "none",
  },

  inputWithPrefix: {
    paddingLeft:
      26,
  },

  help: {
    color:
      "#666",

    fontSize:
      8,

    lineHeight:
      1.45,
  },

  explanation: {
    margin:
      "0 15px 15px",

    padding:
      11,

    border:
      "1px solid #292929",

    borderRadius:
      9,

    color:
      "#707070",

    background:
      "#141414",

    fontSize:
      8,

    lineHeight:
      1.45,
  },

  positionGrid: {
    display:
      "grid",

    gridTemplateColumns:
      "repeat(6,minmax(0,1fr))",

    gap:
      9,

    padding:
      15,
  },

  positionCard: {
    padding:
      12,

    border:
      "1px solid #303030",

    borderRadius:
      10,

    background:
      "#151515",
  },

  positionHeader: {
    display:
      "flex",

    alignItems:
      "center",

    justifyContent:
      "space-between",

    gap:
      8,

    marginBottom:
      9,
  },

  positionName: {
    color:
      "#fff",

    fontSize:
      11,
  },

  positionState: {
    color:
      "#dc6b30",

    fontSize:
      6,

    fontWeight:
      900,

    textTransform:
      "uppercase",
  },

  positionInput: {
    width:
      "100%",

    padding:
      "9px 8px",

    border:
      "1px solid #363636",

    borderRadius:
      8,

    color:
      "#fff",

    textAlign:
      "center",

    background:
      "#101010",

    fontSize:
      12,
  },

  positionHint: {
    display:
      "block",

    marginTop:
      7,

    color:
      "#666",

    textAlign:
      "center",

    fontSize:
      8,
  },

  twoColumn: {
    display:
      "grid",

    gridTemplateColumns:
      "repeat(2,minmax(0,1fr))",

    gap:
      12,
  },

  summaryList: {
    padding:
      "4px 15px 14px",
  },

  summaryRow: {
    display:
      "flex",

    justifyContent:
      "space-between",

    alignItems:
      "center",

    gap:
      12,

    padding:
      "10px 0",

    borderBottom:
      "1px solid #222",

    color:
      "#777",

    fontSize:
      9,
  },

  saveCard: {
    display:
      "flex",

    justifyContent:
      "space-between",

    alignItems:
      "center",

    gap:
      16,

    flexWrap:
      "wrap",

    padding:
      17,

    border:
      "1px solid #3c2b24",

    borderRadius:
      14,

    background:
      "linear-gradient(135deg,#16100d,#111)",
  },

  saveEyebrow: {
    margin:
      0,

    color:
      "#dc5f22",

    fontSize:
      7,

    fontWeight:
      900,

    letterSpacing:
      ".09em",
  },

  saveTitle: {
    display:
      "block",

    marginTop:
      5,

    fontSize:
      13,
  },

  saveText: {
    maxWidth:
      650,

    margin:
      "5px 0 0",

    color:
      "#6d6d6d",

    fontSize:
      8,

    lineHeight:
      1.45,
  },

  secondaryAction: {
    padding:
      "10px 13px",

    border:
      "1px solid #3a3a3a",

    borderRadius:
      9,

    color:
      "#aaa",

    background:
      "#151515",

    fontSize:
      8,

    fontWeight:
      900,

    cursor:
      "pointer",
  },

  saveButton: {
    padding:
      "11px 15px",

    border:
      0,

    borderRadius:
      9,

    color:
      "#fff",

    background:
      "linear-gradient(135deg,#a42312,#ef6618)",

    fontSize:
      8,

    fontWeight:
      900,

    cursor:
      "pointer",
  },
};