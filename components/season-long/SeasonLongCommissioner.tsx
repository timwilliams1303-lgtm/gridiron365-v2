"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import Link from "next/link";
import SeasonLongRenewButton from "@/components/season-long/SeasonLongRenewButton";

import {
  useRouter,
} from "next/navigation";


type Tab =
  | "overview"
  | "lineup"
  | "teams"
  | "playoffs"
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
  competition_format:
    | "total_points"
    | "head_to_head";
  regular_season_weeks: number;
  playoffs_enabled: boolean;
  playoff_team_count: number;
  reseed_playoffs: boolean;
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


type H2HStanding = {
  fantasy_team_id: number;
  wins: number;
  losses: number;
  ties: number;
  points_for: number | string | null;
  points_against: number | string | null;
  games_played: number;
  win_percentage: number | string | null;
  current_rank: number | null;
};


type PlayoffTie = {
  id: number;
  week: number;
  playoff_round: number | null;
  playoff_slot: number | null;
  home_fantasy_team_id: number;
  away_fantasy_team_id: number;
  home_points: number | string | null;
  away_points: number | string | null;
  home_seed: number | null;
  away_seed: number | null;
};


type PlayoffControlPayload = {
  success: boolean;
  season: number;
  playoffState: {
    status:
      | "not_started"
      | "active"
      | "complete";
    current_round: number;
    round_count: number;
    playoff_start_week: number;
    champion_fantasy_team_id: number | null;
  } | null;
  unresolvedTies: PlayoffTie[];
  teams: Team[];
};


type CommissionerPayload = {
  success: boolean;
  league: League;
  settings: Settings | null;
  teams: Team[];
  standings: Standing[];
  h2hStandings: H2HStanding[];
  h2hMatchupCount: number;
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
  const router =
    useRouter();

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


  const [
    playoffControls,
    setPlayoffControls,
  ] =
    useState<PlayoffControlPayload | null>(
      null
    );



  const [teamNames, setTeamNames] =
    useState<Record<number, string>>(
      {}
    );


  const loadPlayoffControls =
    useCallback(
      async () => {
        try {
          const response =
            await fetch(
              `/api/leagues/${leagueId}/season-long/playoffs/commissioner`,
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
              "Unable to load playoff commissioner controls."
            );
          }

          setPlayoffControls(
            payload as PlayoffControlPayload
          );
        } catch (
          playoffError
        ) {
          setPlayoffControls(
            null
          );

          throw playoffError;
        }
      },
      [leagueId]
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

          if (
            typed.settings
              ?.competition_format ===
              "head_to_head" &&
            typed.settings
              ?.playoffs_enabled
          ) {
            try {
              await loadPlayoffControls();
            } catch {
              // Keep the main commissioner page usable if playoff
              // controls are temporarily unavailable.
            }
          } else {
            setPlayoffControls(
              null
            );
          }
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
      [
        leagueId,
        loadPlayoffControls,
      ]
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

      /*
       * Refresh the server-rendered league shell after every
       * successful commissioner mutation so league-dependent
       * navigation and other server components immediately reflect
       * the newly saved configuration.
       *
       * Example:
       *   Total Points -> Head-to-Head
       *   League Teams disappears and Matchups appears immediately.
       */
      router.refresh();
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


  async function resolvePlayoffTie(
    matchupId: number,
    winnerFantasyTeamId: number
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
          `/api/leagues/${leagueId}/season-long/playoffs/commissioner`,
          {
            method:
              "POST",
            headers: {
              "content-type":
                "application/json",
            },
            body:
              JSON.stringify({
                action:
                  "resolve-tie",
                matchupId,
                winnerFantasyTeamId,
                note:
                  "Commissioner playoff tiebreak",
              }),
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
          "Unable to resolve playoff tie."
        );
      }

      setSuccess(
        "Playoff tiebreak resolved. The bracket has been refreshed."
      );

      await load();
      router.refresh();
    } catch (
      actionError
    ) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Unable to resolve playoff tie."
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


  const h2hStandingsMap =
    useMemo(
      () =>
        new Map(
          (
            data?.h2hStandings ??
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
      ["teams", "Teams"],
      ...(settings?.competition_format ===
        "head_to_head" &&
      settings?.playoffs_enabled
        ? [[
            "playoffs",
            "Playoffs",
          ] as [
            Tab,
            string,
          ]]
        : []),
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
                  label="League Format"
                  value={
                    settings?.competition_format ===
                    "head_to_head"
                      ? "Head-to-Head"
                      : "Total Points"
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
                  text={
                    settings?.competition_format ===
                    "head_to_head"
                      ? "Finalized weekly scores settle each matchup and update W-L-T standings, points for and points against."
                      : "Finalized weekly scores feed Season-Long standings. Only finalized weeks count toward season totals."
                  }
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
                styles.formatPanel
              }
            >
              <div
                style={
                  styles.fieldLabel
                }
              >
                LEAGUE FORMAT
              </div>

              <div
                style={
                  styles.choiceGrid
                }
              >
                <button
                  type="button"
                  disabled={saving}
                  onClick={() =>
                    setSettings({
                      ...settings,
                      competition_format:
                        "total_points",
                    })
                  }
                  style={{
                    ...styles.choiceCard,
                    ...(settings.competition_format ===
                    "total_points"
                      ? styles.choiceCardActive
                      : {}),
                  }}
                >
                  <strong>
                    TOTAL POINTS
                  </strong>
                  <span>
                    Existing Season-Long format. Standings rank teams by cumulative finalized fantasy points.
                  </span>
                </button>

                <button
                  type="button"
                  disabled={saving}
                  onClick={() =>
                    setSettings({
                      ...settings,
                      competition_format:
                        "head_to_head",
                    })
                  }
                  style={{
                    ...styles.choiceCard,
                    ...(settings.competition_format ===
                    "head_to_head"
                      ? styles.choiceCardActive
                      : {}),
                  }}
                >
                  <strong>
                    HEAD-TO-HEAD
                  </strong>
                  <span>
                    Teams keep the Season-Long weekly lineup model, but compete in weekly matchups with W-L-T standings.
                  </span>
                </button>
              </div>

              {settings.competition_format ===
              "head_to_head" ? (
                <>
                  <div
                    style={{
                      ...styles.grid,
                      marginTop: 12,
                    }}
                  >
                    <Input
                      label="Regular Season Weeks"
                      value={
                        settings.regular_season_weeks
                      }
                      onChange={(value) =>
                        setSettings({
                          ...settings,
                          regular_season_weeks:
                            Math.min(
                              18,
                              Math.max(
                                1,
                                toNumber(
                                  value,
                                  14
                                )
                              )
                            ),
                        })
                      }
                    />

                    <Input
                      label="Playoff Teams"
                      value={
                        settings.playoff_team_count
                      }
                      onChange={(value) =>
                        setSettings({
                          ...settings,
                          playoff_team_count:
                            Math.min(
                              16,
                              Math.max(
                                2,
                                toNumber(
                                  value,
                                  6
                                )
                              )
                            ),
                        })
                      }
                    />
                  </div>

                  <div
                    style={
                      styles.toggleGrid
                    }
                  >
                    <label
                      style={
                        styles.toggleCard
                      }
                    >
                      <input
                        type="checkbox"
                        checked={
                          settings.playoffs_enabled
                        }
                        onChange={(
                          event
                        ) =>
                          setSettings({
                            ...settings,
                            playoffs_enabled:
                              event.target.checked,
                          })
                        }
                      />
                      <span>
                        Enable Head-to-Head Playoffs
                      </span>
                    </label>

                    <label
                      style={
                        styles.toggleCard
                      }
                    >
                      <input
                        type="checkbox"
                        checked={
                          settings.reseed_playoffs
                        }
                        onChange={(
                          event
                        ) =>
                          setSettings({
                            ...settings,
                            reseed_playoffs:
                              event.target.checked,
                          })
                        }
                      />
                      <span>
                        Reseed Playoffs Each Round
                      </span>
                    </label>
                  </div>

                  <div
                    style={
                      styles.h2hInfo
                    }
                  >
                    <strong>
                      H2H SCHEDULE STATUS
                    </strong>
                    <span>
                      {data.h2hMatchupCount > 0
                        ? `${data.h2hMatchupCount} regular-season matchups currently exist.`
                        : "No Head-to-Head schedule has been built yet."}
                    </span>
                  </div>
                </>
              ) : null}
            </div>

            <div
              style={{
                ...styles.grid,
                marginTop: 14,
              }}
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
                    "Season-Long league and lineup settings saved."
                  )
                }
                style={
                  styles.button
                }
              >
                SAVE LEAGUE & LINEUP SETTINGS
              </button>

              {settings.competition_format ===
              "head_to_head" ? (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() =>
                    void runAction(
                      {
                        action:
                          "build-h2h-schedule",
                      },
                      "Season-Long Head-to-Head schedule built."
                    )
                  }
                  style={
                    styles.secondaryButton
                  }
                >
                  BUILD / REFRESH H2H SCHEDULE
                </button>
              ) : null}
            </div>
          </Section>
        ) : null}


        {tab ===
        "overview" ? (
          <Section
            title="Scoring Settings"
            subtitle="Season-Long uses the same full scoring-rule system as Traditional leagues."
          >
            <div
              style={
                styles.actions
              }
            >
              <Link
                href={`/league/${leagueId}/commissioner/scoring`}
                style={
                  styles.linkButton
                }
              >
                OPEN FULL SCORING SETTINGS
              </Link>
            </div>
          </Section>
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

                  const h2hStanding =
                    h2hStandingsMap.get(
                      team.id
                    );

                  const isHeadToHead =
                    settings?.competition_format ===
                    "head_to_head";

                  const displayRank =
                    isHeadToHead
                      ? h2hStanding?.current_rank
                      : standing?.current_rank;

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
                        {displayRank
                          ? `#${displayRank}`
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
                        {isHeadToHead ? (
                          <>
                            <strong>
                              {h2hStanding
                                ? `${h2hStanding.wins}-${h2hStanding.losses}-${h2hStanding.ties}`
                                : "0-0-0"} record
                            </strong>

                            <span>
                              {toNumber(
                                h2hStanding
                                  ?.points_for
                              ).toFixed(
                                2
                              )} PF • {toNumber(
                                h2hStanding
                                  ?.points_against
                              ).toFixed(
                                2
                              )} PA
                            </span>
                          </>
                        ) : (
                          <>
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
                          </>
                        )}
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
          "playoffs" &&
        settings?.competition_format ===
          "head_to_head" &&
        settings.playoffs_enabled ? (
          <>
            <Section
              title="Head-to-Head Playoff Control"
              subtitle="Normal seeding and advancement are automatic. Commissioner action is only required when a finalized playoff matchup is tied."
            >
              <div
                style={
                  styles.stats
                }
              >
                <Stat
                  label="Playoff Status"
                  value={
                    playoffControls
                      ?.playoffState
                      ?.status
                      ? pretty(
                          playoffControls
                            .playoffState
                            .status
                        )
                      : "Not Started"
                  }
                />

                <Stat
                  label="Current Round"
                  value={
                    playoffControls
                      ?.playoffState
                      ? `${playoffControls.playoffState.current_round} of ${playoffControls.playoffState.round_count}`
                      : "—"
                  }
                />

                <Stat
                  label="Playoff Start"
                  value={
                    playoffControls
                      ?.playoffState
                      ? `Week ${playoffControls.playoffState.playoff_start_week}`
                      : `Week ${
                          settings.regular_season_weeks +
                          1
                        }`
                  }
                />

                <Stat
                  label="Unresolved Ties"
                  value={
                    playoffControls
                      ?.unresolvedTies
                      .length ??
                    0
                  }
                />
              </div>

              <div
                style={
                  styles.actions
                }
              >
                <Link
                  href={`/league/${leagueId}/season-long/playoffs`}
                  style={
                    styles.linkButton
                  }
                >
                  VIEW PLAYOFF BRACKET
                </Link>

                <button
                  type="button"
                  disabled={saving}
                  onClick={() =>
                    void loadPlayoffControls()
                      .catch(
                        (
                          refreshError
                        ) =>
                          setError(
                            refreshError instanceof Error
                              ? refreshError.message
                              : "Unable to refresh playoff controls."
                          )
                      )
                  }
                  style={
                    styles.secondaryButton
                  }
                >
                  REFRESH PLAYOFF STATUS
                </button>
              </div>

              <div
                style={
                  styles.warning
                }
              >
                G365 automatically seeds and advances the bracket after finalized scoring and the Tuesday 6:00 AM ET rollover gate. This control does not bypass weekly finalization or force playoff advancement.
              </div>
            </Section>

            <Section
              title="Playoff Tiebreak Resolution"
              subtitle="This section only appears as actionable when a playoff game finishes with an exact fantasy-point tie."
            >
              {(
                playoffControls
                  ?.unresolvedTies
                  .length ??
                0
              ) === 0 ? (
                <div
                  style={
                    styles.h2hInfo
                  }
                >
                  <strong>
                    NO COMMISSIONER ACTION REQUIRED
                  </strong>

                  <span>
                    There are no unresolved finalized playoff ties.
                  </span>
                </div>
              ) : (
                <div
                  style={
                    styles.list
                  }
                >
                  {playoffControls
                    ?.unresolvedTies
                    .map(
                      (
                        matchup
                      ) => {
                        const homeTeam =
                          playoffControls
                            .teams
                            .find(
                              (
                                team
                              ) =>
                                team.id ===
                                matchup.home_fantasy_team_id
                            );

                        const awayTeam =
                          playoffControls
                            .teams
                            .find(
                              (
                                team
                              ) =>
                                team.id ===
                                matchup.away_fantasy_team_id
                            );

                        return (
                          <div
                            key={
                              matchup.id
                            }
                            style={
                              styles.playoffTieCard
                            }
                          >
                            <div
                              style={
                                styles.playoffTieHeader
                              }
                            >
                              <strong>
                                {matchup.playoff_round
                                  ? `PLAYOFF ROUND ${matchup.playoff_round}`
                                  : "PLAYOFF"}
                              </strong>

                              <span>
                                Week {matchup.week}
                              </span>
                            </div>

                            <div
                              style={
                                styles.playoffTieTeams
                              }
                            >
                              <div
                                style={
                                  styles.playoffTieTeam
                                }
                              >
                                <span>
                                  {matchup.home_seed
                                    ? `#${matchup.home_seed}`
                                    : "—"}
                                </span>

                                <strong>
                                  {homeTeam
                                    ?.team_name ??
                                    `Team ${matchup.home_fantasy_team_id}`}
                                </strong>

                                <b>
                                  {toNumber(
                                    matchup.home_points
                                  ).toFixed(
                                    2
                                  )}
                                </b>

                                <button
                                  type="button"
                                  disabled={saving}
                                  onClick={() => {
                                    const confirmed =
                                      window.confirm(
                                        `Advance ${homeTeam?.team_name ?? `Team ${matchup.home_fantasy_team_id}`} from this tied playoff matchup?`
                                      );

                                    if (
                                      confirmed
                                    ) {
                                      void resolvePlayoffTie(
                                        matchup.id,
                                        matchup.home_fantasy_team_id
                                      );
                                    }
                                  }}
                                  style={
                                    styles.button
                                  }
                                >
                                  ADVANCE THIS TEAM
                                </button>
                              </div>

                              <div
                                style={
                                  styles.playoffTieVs
                                }
                              >
                                TIED
                              </div>

                              <div
                                style={
                                  styles.playoffTieTeam
                                }
                              >
                                <span>
                                  {matchup.away_seed
                                    ? `#${matchup.away_seed}`
                                    : "—"}
                                </span>

                                <strong>
                                  {awayTeam
                                    ?.team_name ??
                                    `Team ${matchup.away_fantasy_team_id}`}
                                </strong>

                                <b>
                                  {toNumber(
                                    matchup.away_points
                                  ).toFixed(
                                    2
                                  )}
                                </b>

                                <button
                                  type="button"
                                  disabled={saving}
                                  onClick={() => {
                                    const confirmed =
                                      window.confirm(
                                        `Advance ${awayTeam?.team_name ?? `Team ${matchup.away_fantasy_team_id}`} from this tied playoff matchup?`
                                      );

                                    if (
                                      confirmed
                                    ) {
                                      void resolvePlayoffTie(
                                        matchup.id,
                                        matchup.away_fantasy_team_id
                                      );
                                    }
                                  }}
                                  style={
                                    styles.button
                                  }
                                >
                                  ADVANCE THIS TEAM
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      }
                    )}
                </div>
              )}
            </Section>
          </>
        ) : null}


        {tab ===
        "season" ? (
          <>
            <Section
              title="Season Controls"
              subtitle={
                settings?.competition_format ===
                "head_to_head"
                  ? "Safe administrative actions for Season-Long scoring, matchups and W-L-T standings."
                  : "Safe administrative actions for Season-Long scoring and standings."
              }
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
                    settings?.competition_format ===
                    "head_to_head"
                      ? data.h2hStandings.length
                      : data.standings.length
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
                      settings?.competition_format ===
                      "head_to_head"
                        ? "Season-Long Head-to-Head standings refreshed from finalized matchups."
                        : "Season-Long standings rebuilt from finalized weekly scores."
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

              <div
                style={{
                  marginTop: 18,
                  padding: 16,
                  border: "1px solid #3a241b",
                  borderRadius: 14,
                  background:
                    "linear-gradient(180deg,rgba(239,95,31,0.08),rgba(255,255,255,0.015))",
                }}
              >
                <div
                  style={{
                    marginBottom: 12,
                  }}
                >
                  <div
                    style={{
                      color: "#ff6422",
                      fontSize: 10,
                      fontWeight: 950,
                      letterSpacing: 0.8,
                      textTransform: "uppercase",
                    }}
                  >
                    NEXT SEASON
                  </div>

                  <h3
                    style={{
                      margin: "5px 0 6px",
                      color: "#fff",
                      fontSize: 18,
                      fontWeight: 950,
                    }}
                  >
                    Renew League for {data.league.season + 1}
                  </h3>

                  <p
                    style={{
                      margin: 0,
                      maxWidth: 760,
                      color: "#aaa",
                      fontSize: 12,
                      lineHeight: 1.55,
                    }}
                  >
                    Creates the next-season league with this league&apos;s current
                    format, scoring, lineup settings, members and team names.
                    Current-season results and Trophy Case history remain preserved.
                    Renewal is accepted only after this Season-Long season is complete.
                  </p>
                </div>

                <SeasonLongRenewButton
                  leagueId={leagueId}
                  nextSeason={data.league.season + 1}
                />
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
                  text={
                    settings?.competition_format ===
                    "head_to_head"
                      ? "Teams submit a new lineup every NFL regular-season week and compete in scheduled weekly matchups. Finalized results update W-L-T standings."
                      : "Teams submit a new lineup every NFL regular-season week. Standings are total points across finalized weeks."
                  }
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

    formatPanel: {
      padding:
        "14px",
      border:
        "1px solid rgba(255,102,45,.18)",
      borderRadius:
        "10px",
      background:
        "rgba(255,92,30,.035)",
    },

    choiceGrid: {
      display:
        "grid",
      gridTemplateColumns:
        "repeat(auto-fit,minmax(220px,1fr))",
      gap:
        "10px",
      marginTop:
        "8px",
    },

    choiceCard: {
      minHeight:
        "92px",
      display:
        "flex",
      flexDirection:
        "column",
      alignItems:
        "flex-start",
      gap:
        "7px",
      padding:
        "13px",
      border:
        "1px solid rgba(255,255,255,.09)",
      borderRadius:
        "9px",
      background:
        "rgba(255,255,255,.025)",
      color:
        "#d8dbe1",
      textAlign:
        "left",
      cursor:
        "pointer",
      fontSize:
        "12px",
      lineHeight:
        1.45,
    },

    choiceCardActive: {
      border:
        "1px solid rgba(255,102,45,.55)",
      background:
        "linear-gradient(135deg,rgba(181,27,24,.22),rgba(239,83,29,.10))",
      color:
        "#fff",
      boxShadow:
        "0 0 0 1px rgba(255,102,45,.08) inset",
    },

    toggleGrid: {
      display:
        "grid",
      gridTemplateColumns:
        "repeat(auto-fit,minmax(220px,1fr))",
      gap:
        "9px",
      marginTop:
        "10px",
    },

    toggleCard: {
      minHeight:
        "42px",
      display:
        "flex",
      alignItems:
        "center",
      gap:
        "9px",
      padding:
        "9px 11px",
      border:
        "1px solid rgba(255,255,255,.08)",
      borderRadius:
        "8px",
      background:
        "rgba(255,255,255,.02)",
      color:
        "#d7dae0",
      fontSize:
        "12px",
      fontWeight:
        800,
    },

    h2hInfo: {
      marginTop:
        "10px",
      display:
        "grid",
      gap:
        "4px",
      padding:
        "10px 11px",
      border:
        "1px solid rgba(255,175,60,.18)",
      borderRadius:
        "8px",
      background:
        "rgba(130,80,10,.08)",
      color:
        "#d9bd8b",
      fontSize:
        "11px",
    },

    secondaryButton: {
      minHeight:
        "38px",
      border:
        "1px solid rgba(255,255,255,.13)",
      borderRadius:
        "7px",
      padding:
        "8px 12px",
      background:
        "rgba(255,255,255,.045)",
      color:
        "#f5f7fa",
      fontSize:
        "12px",
      fontWeight:
        950,
      cursor:
        "pointer",
    },

    playoffTieCard: {
      padding:
        "12px",
      border:
        "1px solid rgba(255,175,60,.24)",
      borderRadius:
        "10px",
      background:
        "rgba(130,80,10,.08)",
    },

    playoffTieHeader: {
      display:
        "flex",
      justifyContent:
        "space-between",
      gap:
        "10px",
      marginBottom:
        "10px",
      color:
        "#e3bd81",
      fontSize:
        "11px",
    },

    playoffTieTeams: {
      display:
        "grid",
      gridTemplateColumns:
        "minmax(0,1fr) 52px minmax(0,1fr)",
      gap:
        "10px",
      alignItems:
        "stretch",
    },

    playoffTieTeam: {
      minWidth:
        0,
      display:
        "grid",
      gap:
        "7px",
      padding:
        "11px",
      border:
        "1px solid rgba(255,255,255,.08)",
      borderRadius:
        "9px",
      background:
        "rgba(255,255,255,.025)",
    },

    playoffTieVs: {
      display:
        "flex",
      alignItems:
        "center",
      justifyContent:
        "center",
      color:
        "#ffb55c",
      fontSize:
        "10px",
      fontWeight:
        950,
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

