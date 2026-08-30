"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import Link from "next/link";

import SeasonLongScoring from "@/components/season-long/SeasonLongScoring";


type Tab =
  | "overview"
  | "lineup"
  | "scoring"
  | "teams"
  | "season";


type League = {
  id: string;
  name: string;
  league_type: string;
  player_selection_mode: string;
  season: number;
  status: string;
};


type Settings = {
  league_id: string;
  season: number;
  weekly_salary_cap: number | string | null;
  starting_qb: number;
  starting_rb: number;
  starting_wr: number;
  starting_te: number;
  starting_flex: number;
  starting_superflex: number;
  starting_k: number;
  starting_dst: number;
};



type Team = {
  id: number;
  owner_id: string | null;
  team_name: string;
  active: boolean;
};


type Standing = {
  fantasy_team_id: number;
  total_points: number | string | null;
  weeks_scored: number | null;
  current_rank: number | null;
};


type CommissionerPayload = {
  success: boolean;
  league: League;
  settings: Settings | null;
  teams: Team[];
  standings: Standing[];
  activeWeek: number;
  submittedEntries: number;
};


type SeasonLongCommissionerProps = {
  leagueId: string;
};



function toNumber(
  value:
    | number
    | string
    | null
    | undefined,
  fallback = 0
) {
  const parsed =
    Number(
      value ??
      fallback
    );

  return Number.isFinite(
    parsed
  )
    ? parsed
    : fallback;
}


function pretty(
  value:
    string |
    null |
    undefined
) {
  if (!value) {
    return "—";
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


export default function SeasonLongCommissioner({
  leagueId,
}: SeasonLongCommissionerProps) {
  const [tab, setTab] =
    useState<Tab>(
      "overview"
    );

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState<string | null>(
      null
    );

  const [success, setSuccess] =
    useState<string | null>(
      null
    );

  const [data, setData] =
    useState<CommissionerPayload | null>(
      null
    );

  const [settings, setSettings] =
    useState<Settings | null>(
      null
    );



  const [teamNames, setTeamNames] =
    useState<Record<number, string>>(
      {}
    );


  const load =
    useCallback(
      async () => {
        setLoading(
          true
        );

        setError(
          null
        );

        try {
          const response =
            await fetch(
              `/api/leagues/${leagueId}/season-long/commissioner`,
              {
                method:
                  "GET",
                cache:
                  "no-store",
              }
            );

          const payload =
            await response.json();

          if (
            !response.ok ||
            !payload.success
          ) {
            throw new Error(
              payload.error ??
              "Unable to load commissioner controls."
            );
          }

          const typed =
            payload as CommissionerPayload;

          setData(
            typed
          );

          setSettings(
            typed.settings
          );

          setTeamNames(
            Object.fromEntries(
              typed.teams.map(
                (
                  team
                ) => [
                  team.id,
                  team.team_name,
                ]
              )
            )
          );
        } catch (
          loadError
        ) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load commissioner controls."
          );
        } finally {
          setLoading(
            false
          );
        }
      },
      [leagueId]
    );


  useEffect(
    () => {
      void load();
    },
    [load]
  );


  async function runAction(
    body:
      Record<
        string,
        unknown
      >,
    message:
      string
  ) {
    setSaving(
      true
    );

    setError(
      null
    );

    setSuccess(
      null
    );

    try {
      const response =
        await fetch(
          `/api/leagues/${leagueId}/season-long/commissioner`,
          {
            method:
              "POST",
            headers: {
              "content-type":
                "application/json",
            },
            body:
              JSON.stringify(
                body
              ),
          }
        );

      const payload =
        await response.json();

      if (
        !response.ok ||
        !payload.success
      ) {
        throw new Error(
          payload.error ??
          "Commissioner action failed."
        );
      }

      setSuccess(
        message
      );

      await load();
    } catch (
      actionError
    ) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Commissioner action failed."
      );
    } finally {
      setSaving(
        false
      );
    }
  }


  const standingsMap =
    useMemo(
      () =>
        new Map(
          (
            data?.standings ??
            []
          ).map(
            (
              standing
            ) => [
              standing.fantasy_team_id,
              standing,
            ]
          )
        ),
      [data]
    );


  if (
    loading
  ) {
    return (
      <main
        style={
          styles.page
        }
      >
        <div
          style={
            styles.center
          }
        >
          Loading Commissioner…
        </div>
      </main>
    );
  }


  if (
    !data
  ) {
    return (
      <main
        style={
          styles.page
        }
      >
        <div
          style={
            styles.denied
          }
        >
          <h1>
            Commissioner Unavailable
          </h1>

          <p>
            {error ??
              "Unable to open these league controls."}
          </p>

          <Link
            href={
              `/league/${leagueId}`
            }
            style={
              styles.linkButton
            }
          >
            BACK TO LEAGUE
          </Link>
        </div>
      </main>
    );
  }


  const isSalary =
    data.league.player_selection_mode ===
    "salary";


  const tabs:
    Array<[
      Tab,
      string,
    ]> = [
      ["overview", "Overview"],
      ["lineup", "League & Lineup"],
      ["scoring", "Scoring"],
      ["teams", "Teams"],
      ["season", "Season Controls"],
    ];


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
              SEASON-LONG • {isSalary
                ? "SALARY"
                : "NO SALARY"} • COMMISSIONER
            </div>

            <h1
              style={
                styles.title
              }
            >
              Commissioner
            </h1>

            <p
              style={
                styles.subtitle
              }
            >
              Manage {data.league.name} from one Season-Long control center.
            </p>
          </div>

          <div
            style={
              styles.row
            }
          >
            <Link
              href={
                `/league/${leagueId}/standings`
              }
              style={
                styles.linkButton
              }
            >
              VIEW STANDINGS
            </Link>

            <button
              type="button"
              onClick={() =>
                void load()
              }
              disabled={saving}
              style={
                styles.button
              }
            >
              REFRESH
            </button>
          </div>
        </header>


        {error ? (
          <div
            style={
              styles.error
            }
          >
            {error}
          </div>
        ) : null}


        {success ? (
          <div
            style={
              styles.success
            }
          >
            {success}
          </div>
        ) : null}


        <div
          style={
            styles.tabs
          }
        >
          {tabs.map(
            ([
              key,
              label,
            ]) => (
              <button
                key={key}
                type="button"
                onClick={() =>
                  setTab(
                    key
                  )
                }
                style={{
                  ...styles.tab,
                  ...(tab === key
                    ? styles.tabActive
                    : {}),
                }}
              >
                {label}
              </button>
            )
          )}
        </div>


        {tab ===
        "overview" ? (
          <>
            <Section
              title="League Control Center"
              subtitle="Season-Long status and weekly-entry activity."
            >
              <div
                style={
                  styles.stats
                }
              >
                <Stat
                  label="Season"
                  value={
                    data.league.season
                  }
                />

                <Stat
                  label="Active Week"
                  value={
                    data.activeWeek
                  }
                />

                <Stat
                  label="Mode"
                  value={
                    isSalary
                      ? "Salary"
                      : "No Salary"
                  }
                />

                <Stat
                  label="League Status"
                  value={
                    pretty(
                      data.league.status
                    )
                  }
                />

                <Stat
                  label="Active Teams"
                  value={
                    data.teams.filter(
                      (
                        team
                      ) =>
                        team.active
                    ).length
                  }
                />

                <Stat
                  label="Submitted Entries"
                  value={
                    data.submittedEntries
                  }
                />
              </div>
            </Section>

            <Section
              title="Season-Long Workflow"
            >
              <div
                style={
                  styles.guides
                }
              >
                <Guide
                  title="Before Week"
                  text="Confirm lineup requirements, scoring, projections and — for Salary leagues — the weekly salary cap."
                />

                <Guide
                  title="Lineup Protection"
                  text="Other teams' selections stay hidden until each player's individual NFL game begins."
                />

                <Guide
                  title="During Games"
                  text="Weekly scores update from the selected lineup only. Each player's selection reveals after that player's kickoff."
                />

                <Guide
                  title="After Week"
                  text="Finalized weekly scores feed Season-Long standings. Only finalized weeks count toward season totals."
                />
              </div>
            </Section>
          </>
        ) : null}


        {tab ===
          "lineup" &&
        settings ? (
          <Section
            title="League & Lineup Requirements"
            subtitle="These starting requirements apply to every weekly Season-Long entry."
          >
            <div
              style={
                styles.grid
              }
            >
              {isSalary ? (
                <Input
                  label="Weekly Salary Cap"
                  value={
                    settings.weekly_salary_cap ??
                    0
                  }
                  onChange={(
                    value
                  ) =>
                    setSettings({
                      ...settings,
                      weekly_salary_cap:
                        toNumber(
                          value
                        ),
                    })
                  }
                />
              ) : null}

              <Input
                label="Starting QB"
                value={settings.starting_qb}
                onChange={(value) =>
                  setSettings({
                    ...settings,
                    starting_qb:
                      toNumber(value),
                  })
                }
              />

              <Input
                label="Starting RB"
                value={settings.starting_rb}
                onChange={(value) =>
                  setSettings({
                    ...settings,
                    starting_rb:
                      toNumber(value),
                  })
                }
              />

              <Input
                label="Starting WR"
                value={settings.starting_wr}
                onChange={(value) =>
                  setSettings({
                    ...settings,
                    starting_wr:
                      toNumber(value),
                  })
                }
              />

              <Input
                label="Starting TE"
                value={settings.starting_te}
                onChange={(value) =>
                  setSettings({
                    ...settings,
                    starting_te:
                      toNumber(value),
                  })
                }
              />

              <Input
                label="Starting FLEX"
                value={settings.starting_flex}
                onChange={(value) =>
                  setSettings({
                    ...settings,
                    starting_flex:
                      toNumber(value),
                  })
                }
              />

              <Input
                label="Starting SUPERFLEX"
                value={settings.starting_superflex}
                onChange={(value) =>
                  setSettings({
                    ...settings,
                    starting_superflex:
                      toNumber(value),
                  })
                }
              />

              <Input
                label="Starting K"
                value={settings.starting_k}
                onChange={(value) =>
                  setSettings({
                    ...settings,
                    starting_k:
                      toNumber(value),
                  })
                }
              />

              <Input
                label="Starting DST"
                value={settings.starting_dst}
                onChange={(value) =>
                  setSettings({
                    ...settings,
                    starting_dst:
                      toNumber(value),
                  })
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
                disabled={saving}
                onClick={() =>
                  void runAction(
                    {
                      action:
                        "save-settings",
                      settings,
                    },
                    "Season-Long lineup settings saved."
                  )
                }
                style={
                  styles.button
                }
              >
                SAVE LEAGUE & LINEUP SETTINGS
              </button>
            </div>
          </Section>
        ) : null}


        {tab ===
        "scoring" ? (
          <SeasonLongScoring
            leagueId={leagueId}
            embedded
          />
        ) : null}


        {tab ===
        "teams" ? (
          <Section
            title="Teams"
            subtitle="Rename active Season-Long teams. Owner invitation controls can be added here next."
          >
            <div
              style={
                styles.list
              }
            >
              {data.teams.map(
                (
                  team
                ) => {
                  const standing =
                    standingsMap.get(
                      team.id
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
                      <div
                        style={
                          styles.rank
                        }
                      >
                        {standing
                          ?.current_rank
                          ? `#${standing.current_rank}`
                          : "—"}
                      </div>

                      <input
                        value={
                          teamNames[
                            team.id
                          ] ??
                          team.team_name
                        }
                        onChange={(
                          event
                        ) =>
                          setTeamNames({
                            ...teamNames,
                            [team.id]:
                              event.target.value,
                          })
                        }
                        style={
                          styles.input
                        }
                      />

                      <div
                        style={
                          styles.teamMeta
                        }
                      >
                        <strong>
                          {toNumber(
                            standing
                              ?.total_points
                          ).toFixed(
                            2
                          )} pts
                        </strong>

                        <span>
                          {standing
                            ?.weeks_scored ??
                            0} weeks scored
                        </span>
                      </div>

                      <div
                        style={
                          styles.teamMeta
                        }
                      >
                        <strong>
                          {team.owner_id
                            ? "OWNER ASSIGNED"
                            : "NO OWNER"}
                        </strong>

                        <span>
                          {team.active
                            ? "Active"
                            : "Inactive"}
                        </span>
                      </div>

                      <button
                        type="button"
                        disabled={saving}
                        onClick={() =>
                          void runAction(
                            {
                              action:
                                "rename-team",
                              fantasyTeamId:
                                team.id,
                              teamName:
                                teamNames[
                                  team.id
                                ] ??
                                team.team_name,
                            },
                            "Team name saved."
                          )
                        }
                        style={
                          styles.button
                        }
                      >
                        SAVE
                      </button>
                    </div>
                  );
                }
              )}
            </div>
          </Section>
        ) : null}


        {tab ===
        "season" ? (
          <>
            <Section
              title="Season Controls"
              subtitle="Safe administrative actions for Season-Long scoring and standings."
            >
              <div
                style={
                  styles.stats
                }
              >
                <Stat
                  label="Season"
                  value={
                    data.league.season
                  }
                />

                <Stat
                  label="Active Week"
                  value={
                    data.activeWeek
                  }
                />

                <Stat
                  label="Submitted Entries"
                  value={
                    data.submittedEntries
                  }
                />

                <Stat
                  label="Standings Teams"
                  value={
                    data.standings.length
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
                  disabled={saving}
                  onClick={() =>
                    void runAction(
                      {
                        action:
                          "rebuild-standings",
                      },
                      "Season-Long standings rebuilt from finalized weekly scores."
                    )
                  }
                  style={
                    styles.button
                  }
                >
                  REBUILD STANDINGS
                </button>
              </div>

              <div
                style={
                  styles.warning
                }
              >
                Week preparation, scoring refresh and finalization continue through the existing Season-Long lifecycle. We are not adding a manual force-finalize button here because it could bypass NFL-week completeness safeguards.
              </div>
            </Section>

            <Section
              title="League Rules Summary"
            >
              <div
                style={
                  styles.guides
                }
              >
                <Guide
                  title="Weekly Competition"
                  text="Teams submit a new lineup every NFL regular-season week. Standings are total points across finalized weeks."
                />

                <Guide
                  title="Lineup Privacy"
                  text="An opponent's selected player stays hidden until that player's NFL game kicks off."
                />

                <Guide
                  title="Salary Mode"
                  text={
                    isSalary
                      ? `Weekly entries must remain within the configured ${toNumber(settings?.weekly_salary_cap).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })} cap.`
                      : "This league does not use player salaries or a weekly salary cap."
                  }
                />

                <Guide
                  title="Scoring"
                  text="Only players selected in the submitted weekly lineup contribute to that team's weekly score."
                />
              </div>
            </Section>
          </>
        ) : null}
      </div>
    </main>
  );
}


function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      style={
        styles.section
      }
    >
      <div
        style={
          styles.sectionHead
        }
      >
        <h2
          style={
            styles.sectionTitle
          }
        >
          {title}
        </h2>

        {subtitle ? (
          <p
            style={
              styles.sectionSub
            }
          >
            {subtitle}
          </p>
        ) : null}
      </div>

      {children}
    </section>
  );
}


function Input({
  label,
  value,
  onChange,
}: {
  label: string;
  value:
    string |
    number;
  onChange:
    (
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
          styles.fieldLabel
        }
      >
        {label}
      </span>

      <input
        type="number"
        value={value}
        onChange={(
          event
        ) =>
          onChange(
            event.target.value
          )
        }
        style={
          styles.input
        }
      />
    </label>
  );
}


function Stat({
  label,
  value,
}: {
  label: string;
  value:
    string |
    number;
}) {
  return (
    <div
      style={
        styles.stat
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


function Guide({
  title,
  text,
}: {
  title: string;
  text: string;
}) {
  return (
    <div
      style={
        styles.guide
      }
    >
      <strong>
        {title}
      </strong>

      <p>
        {text}
      </p>
    </div>
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
        "1550px",
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
        "18px",
      padding:
        "22px",
      marginBottom:
        "16px",
      border:
        "1px solid rgba(255,92,40,.28)",
      borderRadius:
        "16px",
      background:
        "linear-gradient(135deg,rgba(140,14,14,.22),rgba(255,90,30,.08),rgba(255,255,255,.02))",
      flexWrap:
        "wrap",
    },

    eyebrow: {
      color:
        "#ff6b2c",
      fontSize:
        "12px",
      fontWeight:
        900,
      letterSpacing:
        ".14em",
    },

    title: {
      margin:
        "5px 0 0",
      fontSize:
        "34px",
      fontWeight:
        950,
      letterSpacing:
        "-.03em",
    },

    subtitle: {
      margin:
        "7px 0 0",
      color:
        "#a5abb5",
      fontSize:
        "14px",
    },

    row: {
      display:
        "flex",
      gap:
        "8px",
      flexWrap:
        "wrap",
    },

    tabs: {
      display:
        "flex",
      flexWrap:
        "wrap",
      gap:
        "7px",
      padding:
        "9px",
      marginBottom:
        "16px",
      border:
        "1px solid rgba(255,255,255,.07)",
      borderRadius:
        "12px",
      background:
        "rgba(15,17,22,.88)",
    },

    tab: {
      border:
        "1px solid transparent",
      borderRadius:
        "7px",
      padding:
        "9px 12px",
      background:
        "transparent",
      color:
        "#a9aeb8",
      fontSize:
        "12px",
      fontWeight:
        900,
      cursor:
        "pointer",
    },

    tabActive: {
      color:
        "#fff",
      border:
        "1px solid rgba(255,95,40,.32)",
      background:
        "linear-gradient(135deg,rgba(180,24,18,.34),rgba(255,95,30,.15))",
    },

    section: {
      padding:
        "18px",
      marginBottom:
        "16px",
      border:
        "1px solid rgba(255,255,255,.08)",
      borderRadius:
        "13px",
      background:
        "rgba(15,18,24,.9)",
    },

    sectionHead: {
      borderBottom:
        "1px solid rgba(255,255,255,.07)",
      paddingBottom:
        "12px",
      marginBottom:
        "14px",
    },

    sectionTitle: {
      margin:
        0,
      fontSize:
        "20px",
      fontWeight:
        950,
    },

    sectionSub: {
      margin:
        "5px 0 0",
      color:
        "#8f96a2",
      fontSize:
        "12px",
    },

    grid: {
      display:
        "grid",
      gridTemplateColumns:
        "repeat(auto-fit,minmax(190px,1fr))",
      gap:
        "10px",
    },

    field: {
      display:
        "flex",
      flexDirection:
        "column",
      gap:
        "6px",
    },

    fieldLabel: {
      color:
        "#9ba1ab",
      fontSize:
        "11px",
      fontWeight:
        850,
    },

    input: {
      width:
        "100%",
      minHeight:
        "38px",
      boxSizing:
        "border-box",
      border:
        "1px solid rgba(255,255,255,.11)",
      borderRadius:
        "7px",
      padding:
        "8px 10px",
      background:
        "#0b0d12",
      color:
        "#f5f7fa",
      fontSize:
        "13px",
    },

    button: {
      minHeight:
        "38px",
      border:
        "1px solid rgba(255,102,45,.36)",
      borderRadius:
        "7px",
      padding:
        "8px 12px",
      background:
        "linear-gradient(135deg,#b51b18,#ef531d)",
      color:
        "#fff",
      fontSize:
        "12px",
      fontWeight:
        950,
      cursor:
        "pointer",
    },

    linkButton: {
      minHeight:
        "38px",
      display:
        "inline-flex",
      alignItems:
        "center",
      justifyContent:
        "center",
      border:
        "1px solid rgba(255,102,45,.36)",
      borderRadius:
        "7px",
      padding:
        "8px 12px",
      background:
        "linear-gradient(135deg,#b51b18,#ef531d)",
      color:
        "#fff",
      fontSize:
        "12px",
      fontWeight:
        950,
      textDecoration:
        "none",
    },

    actions: {
      display:
        "flex",
      gap:
        "8px",
      flexWrap:
        "wrap",
      marginTop:
        "14px",
    },

    stats: {
      display:
        "grid",
      gridTemplateColumns:
        "repeat(auto-fit,minmax(150px,1fr))",
      gap:
        "9px",
    },

    stat: {
      minHeight:
        "78px",
      padding:
        "11px",
      border:
        "1px solid rgba(255,255,255,.07)",
      borderRadius:
        "9px",
      background:
        "rgba(255,255,255,.025)",
      display:
        "flex",
      flexDirection:
        "column",
      justifyContent:
        "space-between",
      gap:
        "8px",
    },

    guides: {
      display:
        "grid",
      gridTemplateColumns:
        "repeat(auto-fit,minmax(220px,1fr))",
      gap:
        "10px",
    },

    guide: {
      padding:
        "13px",
      border:
        "1px solid rgba(255,255,255,.07)",
      borderRadius:
        "9px",
      background:
        "rgba(255,255,255,.02)",
      fontSize:
        "12px",
      lineHeight:
        1.5,
    },

    list: {
      display:
        "grid",
      gap:
        "8px",
    },

    teamRow: {
      display:
        "grid",
      gridTemplateColumns:
        "54px minmax(180px,1fr) minmax(130px,.7fr) minmax(130px,.7fr) 85px",
      gap:
        "8px",
      alignItems:
        "center",
      padding:
        "9px",
      border:
        "1px solid rgba(255,255,255,.07)",
      borderRadius:
        "9px",
    },

    rank: {
      color:
        "#ff8a25",
      fontWeight:
        950,
      textAlign:
        "center",
    },

    teamMeta: {
      display:
        "grid",
      gap:
        "3px",
      color:
        "#8f96a0",
      fontSize:
        "11px",
    },

    error: {
      marginBottom:
        "12px",
      padding:
        "11px 13px",
      borderRadius:
        "8px",
      border:
        "1px solid rgba(255,70,70,.32)",
      background:
        "rgba(150,20,20,.18)",
      color:
        "#ff9c9c",
      fontSize:
        "13px",
      fontWeight:
        750,
    },

    success: {
      marginBottom:
        "12px",
      padding:
        "11px 13px",
      borderRadius:
        "8px",
      border:
        "1px solid rgba(70,220,130,.28)",
      background:
        "rgba(30,140,80,.14)",
      color:
        "#79e6a6",
      fontSize:
        "13px",
      fontWeight:
        750,
    },

    warning: {
      marginTop:
        "12px",
      padding:
        "10px 12px",
      borderRadius:
        "8px",
      border:
        "1px solid rgba(255,175,60,.20)",
      background:
        "rgba(130,80,10,.10)",
      color:
        "#e3bd81",
      fontSize:
        "11px",
    },

    center: {
      padding:
        "80px 20px",
      textAlign:
        "center",
      color:
        "#c5c9d1",
      fontSize:
        "16px",
    },

    denied: {
      maxWidth:
        "620px",
      margin:
        "100px auto",
      padding:
        "28px",
      textAlign:
        "center",
      border:
        "1px solid rgba(255,80,60,.25)",
      borderRadius:
        "14px",
      background:
        "rgba(20,20,24,.94)",
    },
  };
