"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";

import SeasonLongScoring from "@/components/season-long/SeasonLongScoring";
import SeasonLongRenewButton from "@/components/season-long/SeasonLongRenewButton";


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
  commissioner_user_id?: string | null;
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

type InviteApiResponse = {
  success?: boolean;
  error?: string;
  message?: string;
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


const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);


export default function SeasonLongCommissioner({
  leagueId,
}: SeasonLongCommissionerProps) {
  const router = useRouter();
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

  const [teamInviteEmails, setTeamInviteEmails] =
    useState<Record<number, string>>({});
  const [invitingTeamId, setInvitingTeamId] =
    useState<number | null>(null);

  const [removingOwnerTeamId, setRemovingOwnerTeamId] =
    useState<number | null>(null);

  const [addingInviteSlots, setAddingInviteSlots] =
    useState(false);

  const [deleteLeagueName, setDeleteLeagueName] =
    useState("");

  const [deletingLeague, setDeletingLeague] =
    useState(false);


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


  async function addInviteSlots(count = 1) {
    if (addingInviteSlots) return;

    setAddingInviteSlots(true);
    setError(null);
    setSuccess(null);

    try {
      for (let index = 0; index < count; index += 1) {
        const { error: slotError } = await supabase.rpc(
          "commissioner_add_open_team_slot",
          {
            p_league_id: leagueId,
            p_team_name: `Open Entry ${(data?.teams ?? []).length + index + 1}`,
          }
        );

        if (slotError) {
          throw new Error(slotError.message);
        }
      }

      await load();
      setSuccess(
        `${count} human invite slot${count === 1 ? "" : "s"} added.`
      );
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "The invite slot could not be added."
      );
    } finally {
      setAddingInviteSlots(false);
    }
  }


  async function sendSeasonLongInvite(team: Team) {
    if (invitingTeamId !== null) return;

    const email =
      (teamInviteEmails[team.id] ?? "")
        .trim()
        .toLowerCase();

    if (!email || !email.includes("@")) {
      setError(`Enter a valid email address for ${team.team_name}.`);
      return;
    }

    setInvitingTeamId(team.id);
    setError(null);
    setSuccess(null);

    try {
      const sessionResult =
        await supabase.auth.getSession();

      if (sessionResult.error) {
        throw new Error(sessionResult.error.message);
      }

      const token =
        sessionResult.data.session?.access_token;

      if (!token) {
        throw new Error(
          "Your login session is missing. Sign in again and retry."
        );
      }

      const response =
        await fetch(
          `/api/league/${leagueId}/invite`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              email,
              firstName: team.team_name,
              lastName: "Owner",
              fantasyTeamId: team.id,
            }),
          }
        );

      let result: InviteApiResponse = {};

      try {
        result =
          (await response.json()) as InviteApiResponse;
      } catch {
        result = {};
      }

      if (
        !response.ok ||
        result.success === false
      ) {
        throw new Error(
          result.error ??
            result.message ??
            "The invitation could not be sent."
        );
      }

      setTeamInviteEmails(
        (current) => ({
          ...current,
          [team.id]: "",
        })
      );

      setSuccess(
        `Invitation sent to ${email} for ${team.team_name}.`
      );

      await load();
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "The invitation could not be sent."
      );
    } finally {
      setInvitingTeamId(null);
    }
  }


  async function removeSeasonLongOwner(team: Team) {
    if (
      removingOwnerTeamId !== null ||
      !team.owner_id
    ) {
      return;
    }


    if (
      data?.league.commissioner_user_id &&
      team.owner_id ===
        data.league.commissioner_user_id
    ) {
      setError(
        "The primary commissioner cannot be removed from their own league."
      );
      return;
    }


    if (
      !window.confirm(
        `Remove the current owner from ${team.team_name}? The team, lineup history, scores and standings history will stay in the league, and this spot will become available for a replacement invitation.`
      )
    ) {
      return;
    }


    setRemovingOwnerTeamId(
      team.id
    );
    setError(null);
    setSuccess(null);


    try {
      const response =
        await fetch(
          `/api/leagues/${leagueId}/season-long/commissioner`,
          {
            method: "POST",
            headers: {
              "content-type":
                "application/json",
            },
            body:
              JSON.stringify({
                action:
                  "remove-owner",
                fantasyTeamId:
                  team.id,
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
            "The owner could not be removed."
        );
      }


      setSuccess(
        `Owner removed from ${team.team_name}. This team is now vacant and ready for a replacement invitation.`
      );

      await load();
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "The owner could not be removed."
      );
    } finally {
      setRemovingOwnerTeamId(
        null
      );
    }
  }


  async function deleteLeague() {
    if (
      !data?.league ||
      deletingLeague
    ) {
      return;
    }

    if (
      deleteLeagueName.trim() !==
      data.league.name
    ) {
      setError(
        `Type "${data.league.name}" exactly before deleting this league.`
      );
      return;
    }

    if (
      !window.confirm(
        `Permanently delete ${data.league.name}? This cannot be undone.`
      )
    ) {
      return;
    }

    setDeletingLeague(true);
    setError(null);
    setSuccess(null);

    try {
      const {
        error:
          deleteError,
      } =
        await supabase.rpc(
          "commissioner_delete_league",
          {
            p_league_id:
              leagueId,
          }
        );

      if (deleteError) {
        throw new Error(
          deleteError.message
        );
      }

      router.replace(
        "/my-leagues"
      );

      router.refresh();
    } catch (
      actionError
    ) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "The league could not be deleted."
      );

      setDeletingLeague(
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
      className="g365-season-long-mobile"
      style={
        styles.page
      }
    >

      <style>{`
        .g365-season-long-mobile,
        .g365-season-long-mobile * {
          box-sizing: border-box;
        }

        @media (max-width: 760px) {
          .g365-season-long-mobile {
            width: 100% !important;
            max-width: 100% !important;
            min-width: 0 !important;
            padding-left: 12px !important;
            padding-right: 12px !important;
            overflow-x: hidden !important;
          }

          .g365-season-long-mobile section,
          .g365-season-long-mobile article,
          .g365-season-long-mobile header,
          .g365-season-long-mobile form,
          .g365-season-long-mobile div {
            min-width: 0;
            max-width: 100%;
          }

          .g365-season-long-mobile h1 {
            font-size: clamp(27px, 8vw, 36px) !important;
            line-height: 1.08 !important;
            overflow-wrap: anywhere;
          }

          .g365-season-long-mobile h2,
          .g365-season-long-mobile h3,
          .g365-season-long-mobile p,
          .g365-season-long-mobile span,
          .g365-season-long-mobile strong {
            overflow-wrap: anywhere;
          }

          .g365-season-long-mobile input,
          .g365-season-long-mobile select,
          .g365-season-long-mobile textarea {
            width: 100% !important;
            max-width: 100% !important;
            min-width: 0 !important;
            font-size: 16px !important;
          }

          .g365-season-long-mobile button,
          .g365-season-long-mobile a {
            max-width: 100%;
          }

          .g365-season-long-mobile :not(button)[style*="grid-template-columns"] {
            grid-template-columns: minmax(0, 1fr) !important;
          }

          .g365-season-long-mobile [style*="white-space: nowrap"],
          .g365-season-long-mobile [style*="white-space:nowrap"] {
            white-space: normal !important;
          }

          .g365-season-long-mobile [style*="overflow-x: auto"],
          .g365-season-long-mobile [style*="overflowX: auto"] {
            max-width: 100%;
            -webkit-overflow-scrolling: touch;
          }
        }

        @media (max-width: 430px) {
          .g365-season-long-mobile {
            padding-left: 10px !important;
            padding-right: 10px !important;
          }

          .g365-season-long-mobile button {
            min-height: 42px;
          }
        }
      `}</style>

      <style>{`
        .season-long-team-row {
          grid-template-columns: 48px minmax(0, 1.5fr) minmax(130px, .75fr) minmax(190px, 1fr) minmax(190px, .9fr) !important;
        }

        @media (max-width: 1100px) {
          .season-long-team-row {
            grid-template-columns: 44px minmax(0, 1.35fr) minmax(120px, .8fr) minmax(170px, 1fr) !important;
          }

          .season-long-team-row > :nth-child(5) {
            grid-column: 2 / -1;
            justify-content: flex-end;
          }
        }

        @media (max-width: 760px) {
          .season-long-team-row {
            grid-template-columns: 38px minmax(0, 1fr) !important;
          }

          .season-long-team-row > :nth-child(n + 3) {
            grid-column: 2;
          }

          .season-long-team-row > :nth-child(5) {
            justify-content: flex-start;
          }
        }
      `}</style>

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
          <>
            <Section
              title="Teams & Owners"
              subtitle="Season-Long leagues use human owners only. Add as many invitation spots as you need; CPU teams are not available in Salary or No-Salary leagues."
            >
              <div
                style={
                  styles.actions
                }
              >
                <button
                  type="button"
                  disabled={
                    addingInviteSlots ||
                    saving
                  }
                  onClick={() =>
                    void addInviteSlots(
                      1
                    )
                  }
                  style={
                    styles.button
                  }
                >
                  + ADD INVITE SPOT
                </button>

                <button
                  type="button"
                  disabled={
                    addingInviteSlots ||
                    saving
                  }
                  onClick={() =>
                    void addInviteSlots(
                      4
                    )
                  }
                  style={
                    styles.linkButton
                  }
                >
                  + ADD 4 INVITE SPOTS
                </button>
              </div>

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

                    const hasOwner =
                      Boolean(
                        team.owner_id
                      );

                    return (
                      <div
                        key={
                          team.id
                        }
                        className="season-long-team-row"
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
                            {hasOwner
                              ? "OWNER ASSIGNED"
                              : "VACANT / INVITE"}
                          </strong>

                          <span>
                            {team.active
                              ? "Active"
                              : "Inactive"}
                          </span>
                        </div>

                        {!hasOwner ? (
                          <input
                            type="email"
                            placeholder="owner@example.com"
                            value={
                              teamInviteEmails[
                                team.id
                              ] ??
                              ""
                            }
                            onChange={(
                              event
                            ) =>
                              setTeamInviteEmails(
                                (
                                  current
                                ) => ({
                                  ...current,
                                  [team.id]:
                                    event
                                      .target
                                      .value,
                                })
                              )
                            }
                            style={
                              styles.input
                            }
                          />
                        ) : (
                          <div
                            style={
                              styles.teamMeta
                            }
                          >
                            <strong>
                              HUMAN OWNER
                            </strong>

                            <span>
                              No CPU option
                            </span>
                          </div>
                        )}

                        <div
                          style={
                            styles.teamActions
                          }
                        >
                          {!hasOwner ? (
                            <button
                              type="button"
                              disabled={
                                saving ||
                                invitingTeamId !==
                                  null ||
                                !(
                                  teamInviteEmails[
                                    team.id
                                  ] ??
                                  ""
                                ).trim()
                              }
                              onClick={() =>
                                void sendSeasonLongInvite(
                                  team
                                )
                              }
                              style={
                                styles.button
                              }
                            >
                              {invitingTeamId ===
                              team.id
                                ? "SENDING…"
                                : "✉ INVITE"}
                            </button>
                          ) : null}

                          {hasOwner ? (
                            team.owner_id ===
                            data.league.commissioner_user_id ? (
                              <button
                                type="button"
                                disabled
                                title="Transfer primary commissioner ownership before removing this owner."
                                style={{
                                  ...styles.linkButton,
                                  opacity: 0.45,
                                  cursor: "not-allowed",
                                }}
                              >
                                PRIMARY COMMISSIONER
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled={
                                  saving ||
                                  removingOwnerTeamId !==
                                    null
                                }
                                onClick={() =>
                                  void removeSeasonLongOwner(
                                    team
                                  )
                                }
                                style={
                                  styles.linkButton
                                }
                              >
                                {removingOwnerTeamId ===
                                team.id
                                  ? "REMOVING…"
                                  : "REMOVE OWNER"}
                              </button>
                            )
                          ) : null}

                          <button
                            type="button"
                            disabled={
                              saving
                            }
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
                      </div>
                    );
                  }
                )}
              </div>
            </Section>

            <Section
              title="Danger Zone"
              subtitle="Only the primary commissioner can permanently delete the league."
            >
              <div
                style={
                  styles.dangerZone
                }
              >
                <div>
                  <strong>
                    DELETE LEAGUE
                  </strong>

                  <p
                    style={
                      styles.dangerText
                    }
                  >
                    Permanently deletes this league and all league-owned data.
                    This action cannot be undone.
                  </p>
                </div>

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
                    Type {data.league.name} to confirm
                  </span>

                  <input
                    type="text"
                    value={
                      deleteLeagueName
                    }
                    onChange={(
                      event
                    ) =>
                      setDeleteLeagueName(
                        event.target.value
                      )
                    }
                    placeholder={
                      data.league.name
                    }
                    style={
                      styles.input
                    }
                  />
                </label>

                <button
                  type="button"
                  disabled={
                    deletingLeague ||
                    deleteLeagueName.trim() !==
                      data.league.name
                  }
                  onClick={() =>
                    void deleteLeague()
                  }
                  style={{
                    ...styles.button,
                    ...styles.dangerButton,
                  }}
                >
                  {deletingLeague
                    ? "DELETING…"
                    : "PERMANENTLY DELETE LEAGUE"}
                </button>
              </div>
            </Section>
          </>
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
                    Creates the next-season league with this league&apos;s settings,
                    scoring, members and team names. Weekly lineups, scores,
                    standings, salaries and trophies start fresh. Renewal is
                    accepted only after the current Season-Long season is complete.
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
      minWidth:
        0,
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
        "10px",
      width:
        "100%",
      minWidth:
        0,
    },

    teamRow: {
      display:
        "grid",
      gap:
        "12px",
      alignItems:
        "center",
      width:
        "100%",
      minWidth:
        0,
      boxSizing:
        "border-box",
      padding:
        "12px 14px",
      border:
        "1px solid rgba(255,255,255,.07)",
      borderRadius:
        "10px",
      background:
        "rgba(255,255,255,.01)",
    },

    rank: {
      color:
        "#ff8a25",
      fontWeight:
        950,
      textAlign:
        "center",
      minWidth:
        0,
    },

    teamMeta: {
      display:
        "grid",
      gap:
        "3px",
      minWidth:
        0,
      color:
        "#8f96a0",
      fontSize:
        "11px",
    },

    teamActions: {
      display:
        "flex",
      alignItems:
        "center",
      justifyContent:
        "flex-end",
      gap:
        "8px",
      minWidth:
        0,
      width:
        "100%",
      flexWrap:
        "wrap",
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
  
    dangerZone: {
      display: "grid",
      gap: "12px",
      marginTop: "8px",
      padding: "16px",
      border: "1px solid rgba(255,75,75,.32)",
      borderRadius: "12px",
      background: "rgba(135,15,15,.12)",
    },

    dangerText: {
      margin: "6px 0 0",
      color: "#a7adb7",
      fontSize: "12px",
      lineHeight: 1.55,
    },

    dangerButton: {
      border: "1px solid rgba(255,75,75,.5)",
      background: "linear-gradient(135deg,#7d1111,#b51c14)",
      color: "#fff",
    },
};
