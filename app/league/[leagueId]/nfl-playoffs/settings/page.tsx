import type {
  CSSProperties,
} from "react";

import Link from "next/link";

import {
  redirect,
} from "next/navigation";

import {
  createSupabaseServerClient,
} from "@/lib/supabase/server";

import {
  requireLeagueMember,
} from "@/lib/leagues/requireLeagueMember";


export const dynamic =
  "force-dynamic";

export const revalidate = 0;


type PageProps = {
  params:
    Promise<{
      leagueId: string;
    }>;
};


type SettingsRow = {
  weekly_salary_cap:
    number |
    string |
    null;

  starting_qb:
    number;

  starting_rb:
    number;

  starting_wr:
    number;

  starting_te:
    number;

  starting_flex:
    number;

  starting_superflex:
    number;

  starting_k:
    number;

  starting_dst:
    number;
};


type StateRow = {
  active_round:
    number |
    null;

  status:
    string |
    null;
};


type RoundRow = {
  round_number:
    number;

  round_name:
    string |
    null;

  nfl_week:
    number |
    null;

  status:
    string |
    null;

  first_kickoff_at:
    string |
    null;

  last_scheduled_kickoff_at:
    string |
    null;

  finalized_at:
    string |
    null;
};


function numberValue(
  value:
    number |
    string |
    null |
    undefined
) {
  const parsed =
    Number(
      value ?? 0
    );

  return Number.isFinite(
    parsed
  )
    ? parsed
    : 0;
}


function money(
  value:
    number |
    string |
    null |
    undefined
) {
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
    numberValue(
      value
    )
  );
}


function prettyStatus(
  value:
    string |
    null |
    undefined
) {
  if (
    !value
  ) {
    return "Setup";
  }

  return value
    .replaceAll(
      "_",
      " "
    )
    .replace(
      /\b\w/g,
      (
        character
      ) =>
        character.toUpperCase()
    );
}


function fallbackRoundName(
  roundNumber:
    number
) {
  switch (
    roundNumber
  ) {
    case 1:
      return "Wild Card";

    case 2:
      return "Divisional";

    case 3:
      return "Conference Championships";

    case 4:
      return "Super Bowl";

    default:
      return `Round ${roundNumber}`;
  }
}


function isFinalRound(
  round:
    RoundRow
) {
  if (
    round.finalized_at
  ) {
    return true;
  }

  return [
    "final",
    "finalized",
    "complete",
    "completed",
  ].includes(
    (
      round.status ??
      ""
    )
      .trim()
      .toLowerCase()
  );
}


function formatDate(
  value:
    string |
    null
) {
  if (
    !value
  ) {
    return "TBD";
  }

  const date =
    new Date(
      value
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "TBD";
  }

  return new Intl.DateTimeFormat(
    "en-US",
    {
      month:
        "short",

      day:
        "numeric",

      hour:
        "numeric",

      minute:
        "2-digit",
    }
  ).format(
    date
  );
}


export default async function NflPlayoffsSettingsPage({
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
    access.league
      .leagueType !==
    "nfl_playoffs"
  ) {
    redirect(
      `/league/${leagueId}`
    );
  }

  const supabase =
    await createSupabaseServerClient();

  const season =
    access.league
      .season;

  const rawMode =
    access.league
      .playerSelectionMode;

  if (
    rawMode !==
      "salary" &&
    rawMode !==
      "no_salary"
  ) {
    throw new Error(
      "NFL Playoffs leagues must use Salary or No-Salary player selection."
    );
  }

  const isSalary =
    rawMode ===
    "salary";

  const [
    settingsResult,
    stateResult,
    roundsResult,
  ] =
    await Promise.all([
      supabase
        .from(
          "nfl_playoff_settings"
        )
        .select(`
          weekly_salary_cap,
          starting_qb,
          starting_rb,
          starting_wr,
          starting_te,
          starting_flex,
          starting_superflex,
          starting_k,
          starting_dst
        `)
        .eq(
          "league_id",
          leagueId
        )
        .eq(
          "season",
          season
        )
        .maybeSingle(),

      supabase
        .from(
          "nfl_playoff_league_state"
        )
        .select(`
          active_round,
          status
        `)
        .eq(
          "league_id",
          leagueId
        )
        .eq(
          "season",
          season
        )
        .maybeSingle(),

      supabase
        .from(
          "nfl_playoff_rounds"
        )
        .select(`
          round_number,
          round_name,
          nfl_week,
          status,
          first_kickoff_at,
          last_scheduled_kickoff_at,
          finalized_at
        `)
        .eq(
          "league_id",
          leagueId
        )
        .eq(
          "season",
          season
        )
        .order(
          "round_number",
          {
            ascending:
              true,
          }
        ),
    ]);

  if (
    settingsResult.error
  ) {
    throw new Error(
      `Could not load NFL Playoffs settings: ${settingsResult.error.message}`
    );
  }

  if (
    stateResult.error
  ) {
    throw new Error(
      `Could not load NFL Playoffs state: ${stateResult.error.message}`
    );
  }

  if (
    roundsResult.error
  ) {
    throw new Error(
      `Could not load NFL Playoffs rounds: ${roundsResult.error.message}`
    );
  }

  if (
    !settingsResult.data
  ) {
    throw new Error(
      "NFL Playoffs settings have not been initialized for this league."
    );
  }

  const settings =
    settingsResult.data as
      SettingsRow;

  const state =
    stateResult.data as
      StateRow |
      null;

  const rounds =
    (
      roundsResult.data ??
      []
    ) as RoundRow[];

  const activeRound =
    Number.isInteger(
      Number(
        state
          ?.active_round
      )
    ) &&
    Number(
      state
        ?.active_round
    ) >= 1 &&
    Number(
      state
        ?.active_round
    ) <= 4
      ? Number(
          state
            ?.active_round
        )
      : 1;

  const starterCount =
    settings.starting_qb +
    settings.starting_rb +
    settings.starting_wr +
    settings.starting_te +
    settings.starting_flex +
    settings.starting_superflex +
    settings.starting_k +
    settings.starting_dst;

  const lineup = [
    [
      "QB",
      settings.starting_qb,
    ],
    [
      "RB",
      settings.starting_rb,
    ],
    [
      "WR",
      settings.starting_wr,
    ],
    [
      "TE",
      settings.starting_te,
    ],
    [
      "FLEX",
      settings.starting_flex,
    ],
    [
      "SUPERFLEX",
      settings.starting_superflex,
    ],
    [
      "K",
      settings.starting_k,
    ],
    [
      "DST",
      settings.starting_dst,
    ],
  ] as const;

  const finalizedRounds =
    rounds.filter(
      isFinalRound
    ).length;

  const leagueComplete =
    finalizedRounds >=
      4 ||
    [
      "complete",
      "completed",
      "final",
      "finalized",
    ].includes(
      (
        state
          ?.status ??
        ""
      )
        .trim()
        .toLowerCase()
    );

  return (
    <main
      className="g365-nflp-settings"
      style={
        styles.page
      }
    >
      <style>{`
        .g365-nflp-settings,
        .g365-nflp-settings * {
          box-sizing: border-box;
        }

        @media (max-width: 900px) {
          .g365-nflp-settings .settings-hero {
            flex-direction: column !important;
            align-items: flex-start !important;
          }

          .g365-nflp-settings .summary-grid {
            grid-template-columns: repeat(2,minmax(0,1fr)) !important;
          }

          .g365-nflp-settings .two-col {
            grid-template-columns: 1fr !important;
          }
        }

        @media (max-width: 600px) {
          .g365-nflp-settings {
            padding: 12px 10px !important;
          }

          .g365-nflp-settings .summary-grid,
          .g365-nflp-settings .lineup-grid,
          .g365-nflp-settings .round-grid {
            grid-template-columns: 1fr !important;
          }

          .g365-nflp-settings .hero-actions {
            width: 100% !important;
          }

          .g365-nflp-settings .hero-actions a {
            flex: 1 1 auto !important;
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
          className="settings-hero"
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
              G365 NFL PLAYOFFS · LEAGUE SETTINGS
            </p>

            <h1
              style={
                styles.title
              }
            >
              {
                access.league
                  .name
              }
            </h1>

            <p
              style={
                styles.subtitle
              }
            >
              {
                season
              }
              {" · "}
              {isSalary
                ? "Salary Cap"
                : "No Salary Cap"}
              {" · "}
              Four-Round NFL Postseason
            </p>
          </div>

          <div
            className="hero-actions"
            style={
              styles.actions
            }
          >
            <span
              style={
                styles.readOnlyBadge
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
                MANAGE LEAGUE
              </Link>
            ) : null}
          </div>
        </header>

        {/* =====================================================
            SUMMARY
            ===================================================== */}

        <section
          className="summary-grid"
          style={
            styles.summaryGrid
          }
        >
          <SummaryCard
            label="MODE"
            value={
              isSalary
                ? "Salary"
                : "No Salary"
            }
            detail="Player selection format"
          />

          <SummaryCard
            label="STARTERS"
            value={
              String(
                starterCount
              )
            }
            detail="Required lineup spots each round"
          />

          <SummaryCard
            label="ACTIVE ROUND"
            value={
              leagueComplete
                ? "Complete"
                : String(
                    activeRound
                  )
            }
            detail={
              leagueComplete
                ? "NFL postseason finished"
                : fallbackRoundName(
                    activeRound
                  )
            }
          />

          <SummaryCard
            label="ROUNDS FINAL"
            value={`${finalizedRounds} / 4`}
            detail="Official completed rounds"
          />
        </section>

        {/* =====================================================
            COMPETITION FORMAT
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
            <SectionHeader
              eyebrow="COMPETITION"
              title="NFL Playoffs Format"
            />

            <div
              style={
                styles.ruleList
              }
            >
              <Rule
                title="Competition Type"
                text="Total cumulative fantasy points across all four NFL postseason rounds determine the league champion."
              />

              <Rule
                title="Wild Card"
                text="Round 1 of the G365 NFL Playoffs competition."
              />

              <Rule
                title="Divisional"
                text="Round 2 of the G365 NFL Playoffs competition."
              />

              <Rule
                title="Conference Championships"
                text="Round 3 of the G365 NFL Playoffs competition."
              />

              <Rule
                title="Super Bowl"
                text="Round 4 and the final scoring period. Final cumulative points determine the champion."
              />

              <Rule
                title="No Fantasy H2H Bracket"
                text="NFL Playoffs leagues use cumulative scoring. Members are not eliminated through fantasy head-to-head matchups."
              />
            </div>
          </article>

          <article
            style={
              styles.card
            }
          >
            <SectionHeader
              eyebrow="PLAYER SELECTION"
              title={
                isSalary
                  ? "Salary Rules"
                  : "No-Salary Rules"
              }
            />

            <div
              style={
                styles.ruleList
              }
            >
              {isSalary ? (
                <>
                  <Rule
                    title="Round Salary Cap"
                    text={`Each submitted postseason lineup must remain at or below ${money(
                      settings.weekly_salary_cap
                    )}.`}
                  />

                  <Rule
                    title="Round Salaries"
                    text="Player salaries and projections are stored at selection so finalized results and Trophy Case awards retain the correct historical values."
                  />
                </>
              ) : (
                <>
                  <Rule
                    title="No Salary Restriction"
                    text="Player selection is not constrained by salary or a round salary cap."
                  />

                  <Rule
                    title="Same Competition Engine"
                    text="No-Salary leagues use the same four postseason rounds, lineup structure, scoring, locking, standings, recap, and Trophy Case."
                  />
                </>
              )}

              <Rule
                title="Fresh Lineup Each Round"
                text="Members select a new lineup for each NFL postseason round."
              />

              <Rule
                title="Individual Player Locks"
                text="A selected player locks when that player's actual NFL postseason game begins."
              />

              <Rule
                title="Finalized Results"
                text="Standings and permanent Trophy Case awards use finalized postseason scoring."
              />
            </div>
          </article>
        </section>

        {/* =====================================================
            LINEUP
            ===================================================== */}

        <section
          style={
            styles.card
          }
        >
          <SectionHeader
            eyebrow="ROSTER REQUIREMENTS"
            title="Starting Lineup"
            badge={`${starterCount} STARTERS`}
          />

          <div
            className="lineup-grid"
            style={
              styles.lineupGrid
            }
          >
            {lineup.map(
              (
                [
                  position,
                  count,
                ]
              ) => (
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
                      styles.positionLabel
                    }
                  >
                    {
                      position
                    }
                  </span>

                  <strong
                    style={
                      styles.positionCount
                    }
                  >
                    {
                      count
                    }
                  </strong>

                  <span
                    style={
                      styles.positionWord
                    }
                  >
                    {count ===
                    1
                      ? "STARTER"
                      : "STARTERS"}
                  </span>
                </div>
              )
            )}
          </div>
        </section>

        {/* =====================================================
            ROUND STATUS
            ===================================================== */}

        <section
          style={
            styles.card
          }
        >
          <SectionHeader
            eyebrow="POSTSEASON SCHEDULE"
            title="Four-Round Lifecycle"
            badge={
              prettyStatus(
                state
                  ?.status
              ).toUpperCase()
            }
          />

          <div
            className="round-grid"
            style={
              styles.roundGrid
            }
          >
            {[
              1,
              2,
              3,
              4,
            ].map(
              (
                roundNumber
              ) => {
                const round =
                  rounds.find(
                    (
                      row
                    ) =>
                      row.round_number ===
                      roundNumber
                  ) ??
                  null;

                const final =
                  round
                    ? isFinalRound(
                        round
                      )
                    : false;

                const active =
                  !final &&
                  !leagueComplete &&
                  activeRound ===
                    roundNumber;

                return (
                  <article
                    key={
                      roundNumber
                    }
                    style={{
                      ...styles.roundCard,

                      ...(final
                        ? styles.finalRoundCard
                        : {}),

                      ...(active
                        ? styles.activeRoundCard
                        : {}),
                    }}
                  >
                    <div
                      style={
                        styles.roundHeader
                      }
                    >
                      <div>
                        <span
                          style={
                            styles.roundNumber
                          }
                        >
                          ROUND {
                            roundNumber
                          }
                        </span>

                        <h3
                          style={
                            styles.roundTitle
                          }
                        >
                          {
                            round
                              ?.round_name ??
                            fallbackRoundName(
                              roundNumber
                            )
                          }
                        </h3>
                      </div>

                      <span
                        style={{
                          ...styles.statusBadge,

                          ...(final
                            ? styles.finalStatus
                            : {}),

                          ...(active
                            ? styles.activeStatus
                            : {}),
                        }}
                      >
                        {final
                          ? "FINAL"
                          : active
                            ? "ACTIVE"
                            : "UPCOMING"}
                      </span>
                    </div>

                    <div
                      style={
                        styles.roundDetails
                      }
                    >
                      <Detail
                        label="NFL WEEK"
                        value={
                          round
                            ?.nfl_week
                            ? String(
                                round.nfl_week
                              )
                            : "TBD"
                        }
                      />

                      <Detail
                        label="FIRST KICKOFF"
                        value={
                          formatDate(
                            round
                              ?.first_kickoff_at ??
                            null
                          )
                        }
                      />

                      <Detail
                        label="LAST SCHEDULED GAME"
                        value={
                          formatDate(
                            round
                              ?.last_scheduled_kickoff_at ??
                            null
                          )
                        }
                      />
                    </div>
                  </article>
                );
              }
            )}
          </div>
        </section>

        {/* =====================================================
            SCORING / BEHAVIOR
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
            <SectionHeader
              eyebrow="SCORING"
              title="Fantasy Scoring"
            />

            <div
              style={
                styles.ruleList
              }
            >
              <Rule
                title="League Scoring"
                text="NFL Playoffs player scores use this league's configured G365 fantasy scoring rules."
              />

              <Rule
                title="Cumulative Standings"
                text="Every finalized round contributes to the team's postseason total."
              />

              <Rule
                title="Round Metrics"
                text="Standings track rounds scored, high round, low round, average round, and cumulative points."
              />

              <Rule
                title="Champion"
                text="After the Super Bowl round is finalized, the highest cumulative postseason score is the NFL Playoffs champion."
              />
            </div>
          </article>

          <article
            style={
              styles.card
            }
          >
            <SectionHeader
              eyebrow="VISIBILITY & HISTORY"
              title="League Records"
            />

            <div
              style={
                styles.ruleList
              }
            >
              <Rule
                title="League Teams"
                text="Members can review postseason lineups, fantasy points, projections, and completed round results."
              />

              <Rule
                title="Recap"
                text="Each round receives a recap after results develop, with official honors locked after finalization."
              />

              <Rule
                title="Trophy Case"
                text="Finalized postseason accomplishments are stored permanently rather than recalculated only when the page opens."
              />

              <Rule
                title="Commissioner Controls"
                text="Only commissioner-authorized league management controls are exposed through the Commissioner area."
              />
            </div>
          </article>
        </section>

        <div
          style={
            styles.footerNote
          }
        >
          These are the official
          member-visible NFL Playoffs
          league settings. Changes are
          managed through commissioner
          controls and should propagate
          through the league after they
          are saved.
        </div>
      </section>
    </main>
  );
}


function SummaryCard({
  label,
  value,
  detail,
}: {
  label:
    string;

  value:
    string;

  detail:
    string;
}) {
  return (
    <article
      style={
        styles.summaryCard
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


function SectionHeader({
  eyebrow,
  title,
  badge,
}: {
  eyebrow:
    string;

  title:
    string;

  badge?:
    string;
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
            styles.countBadge
          }
        >
          {badge}
        </span>
      ) : null}
    </div>
  );
}


function Rule({
  title,
  text,
}: {
  title:
    string;

  text:
    string;
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


function Detail({
  label,
  value,
}: {
  label:
    string;

  value:
    string;
}) {
  return (
    <div
      style={
        styles.detail
      }
    >
      <span
        style={
          styles.detailLabel
        }
      >
        {label}
      </span>

      <strong
        style={
          styles.detailValue
        }
      >
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
      "#f4f4f4",

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

    alignItems:
      "center",

    justifyContent:
      "space-between",

    gap:
      18,

    marginBottom:
      16,

    padding:
      24,

    border:
      "1px solid #292929",

    borderRadius:
      20,

    background:
      "linear-gradient(135deg,rgba(130,22,12,.25),rgba(239,93,18,.08),#111)",
  },

  eyebrow: {
    margin:
      0,

    color:
      "#ff681e",

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
      31,

    lineHeight:
      1.05,
  },

  subtitle: {
    margin:
      0,

    color:
      "#858585",

    fontSize:
      11,
  },

  actions: {
    display:
      "flex",

    alignItems:
      "center",

    gap:
      8,

    flexWrap:
      "wrap",
  },

  readOnlyBadge: {
    padding:
      "8px 10px",

    border:
      "1px solid #343434",

    borderRadius:
      999,

    color:
      "#8b8b8b",

    background:
      "#151515",

    fontSize:
      7,

    fontWeight:
      900,

    letterSpacing:
      ".08em",
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
      "linear-gradient(135deg,#a52312,#ef6618)",

    fontSize:
      8,

    fontWeight:
      900,
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

  summaryCard: {
    padding:
      15,

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
      "#db5c20",

    fontSize:
      7,

    fontWeight:
      900,

    letterSpacing:
      ".1em",
  },

  summaryValue: {
    display:
      "block",

    margin:
      "4px 0",

    fontSize:
      18,
  },

  summaryDetail: {
    display:
      "block",

    color:
      "#666",

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

    marginBottom:
      16,
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

    alignItems:
      "center",

    justifyContent:
      "space-between",

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
      "#dc5c1e",

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
      17,
  },

  countBadge: {
    padding:
      "6px 8px",

    border:
      "1px solid #48301f",

    borderRadius:
      999,

    color:
      "#de7837",

    background:
      "#1d140e",

    fontSize:
      7,

    fontWeight:
      900,
  },

  ruleList: {
    padding:
      "4px 15px 14px",
  },

  rule: {
    padding:
      "11px 0",

    borderBottom:
      "1px solid #202020",
  },

  ruleTitle: {
    display:
      "block",

    marginBottom:
      4,

    fontSize:
      10,
  },

  ruleText: {
    margin:
      0,

    color:
      "#767676",

    fontSize:
      9,

    lineHeight:
      1.5,
  },

  lineupGrid: {
    display:
      "grid",

    gridTemplateColumns:
      "repeat(4,minmax(0,1fr))",

    gap:
      9,

    padding:
      14,
  },

  positionCard: {
    padding:
      13,

    border:
      "1px solid #2b2b2b",

    borderRadius:
      10,

    background:
      "#151515",
  },

  positionLabel: {
    display:
      "block",

    color:
      "#e16324",

    fontSize:
      8,

    fontWeight:
      900,
  },

  positionCount: {
    display:
      "block",

    margin:
      "4px 0",

    fontSize:
      22,
  },

  positionWord: {
    color:
      "#606060",

    fontSize:
      7,

    fontWeight:
      800,
  },

  roundGrid: {
    display:
      "grid",

    gridTemplateColumns:
      "repeat(4,minmax(0,1fr))",

    gap:
      9,

    padding:
      14,
  },

  roundCard: {
    padding:
      13,

    border:
      "1px solid #2b2b2b",

    borderRadius:
      11,

    background:
      "#141414",
  },

  finalRoundCard: {
    border:
      "1px solid #334b39",

    background:
      "#111813",
  },

  activeRoundCard: {
    border:
      "1px solid #90401b",

    background:
      "linear-gradient(135deg,#21130d,#151311)",
  },

  roundHeader: {
    display:
      "flex",

    alignItems:
      "flex-start",

    justifyContent:
      "space-between",

    gap:
      8,

    marginBottom:
      12,
  },

  roundNumber: {
    color:
      "#d75b21",

    fontSize:
      6,

    fontWeight:
      900,

    letterSpacing:
      ".09em",
  },

  roundTitle: {
    margin:
      "4px 0 0",

    fontSize:
      12,
  },

  statusBadge: {
    padding:
      "4px 6px",

    borderRadius:
      999,

    color:
      "#707070",

    background:
      "#222",

    fontSize:
      6,

    fontWeight:
      900,
  },

  finalStatus: {
    color:
      "#73d790",

    background:
      "#142018",
  },

  activeStatus: {
    color:
      "#ff8c46",

    background:
      "#2c180f",
  },

  roundDetails: {
    display:
      "grid",

    gap:
      7,
  },

  detail: {
    display:
      "flex",

    alignItems:
      "center",

    justifyContent:
      "space-between",

    gap:
      8,
  },

  detailLabel: {
    color:
      "#5f5f5f",

    fontSize:
      6,

    fontWeight:
      900,
  },

  detailValue: {
    color:
      "#999",

    textAlign:
      "right",

    fontSize:
      7,
  },

  footerNote: {
    padding:
      13,

    border:
      "1px solid #292929",

    borderRadius:
      11,

    color:
      "#666",

    background:
      "#101010",

    fontSize:
      8,

    lineHeight:
      1.5,
  },
};