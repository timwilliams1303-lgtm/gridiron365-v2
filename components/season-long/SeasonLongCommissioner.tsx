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
  | "matchups"
  | "season";


type League = {
  id: string;
  name: string;
  league_type: string;
  player_selection_mode: string;
  season: number;
  status: string;
  commissioner_user_id?: string | null;
  competition_format?: string | null;
  season_long_competition_format?: string | null;
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
  competition_format?: string | null;
  competition_mode?: string | null;
};



type Team = {
  id: number;
  owner_id: string | null;
  team_name: string;
  active: boolean;
  owner_name?: string | null;
  owner_email?: string | null;
};

type InviteApiResponse = {
  success?: boolean;
  resent?: boolean;
  error?: string;
  message?: string;
};

type PendingInvitation = {
  id: string;
  leagueId: string;
  fantasyTeamId: number | null;
  firstName: string | null;
  lastName: string | null;
  email: string;
  status: string;
  expiresAt: string;
  emailSentAt: string | null;
  createdAt: string;
  updatedAt: string;
  team: {
    id: number;
    teamName: string;
    ownerId: string | null;
    active: boolean;
  } | null;
};

type PendingInviteApiResponse = {
  success?: boolean;
  error?: string;
  pendingCount?: number;
  invitations?: PendingInvitation[];
};


type Standing = {
  fantasy_team_id: number;
  total_points: number | string | null;
  weeks_scored: number | null;
  current_rank: number | null;
};


type SeasonLongMatchup = {
  id?: number | string | null;
  week: number;
  home_team_id: number | null;
  away_team_id: number | null;
};


type ManualMatchup = {
  homeTeamId: number | null;
  awayTeamId: number | null;
};


type CommissionerPayload = {
  success: boolean;
  league: League;
  settings: Settings | null;
  teams: Team[];
  standings: Standing[];
  activeWeek: number;
  submittedEntries: number;
  regularSeasonWeeks?: number;
  matchups?: SeasonLongMatchup[];
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


  const [scheduleWeek, setScheduleWeek] =
    useState(1);

  const [manualMatchups, setManualMatchups] =
    useState<Record<number, ManualMatchup[]>>(
      {}
    );

  const [scheduleWorking, setScheduleWorking] =
    useState(false);


  const [teamNames, setTeamNames] =
    useState<Record<number, string>>(
      {}
    );

  const [teamInviteEmails, setTeamInviteEmails] =
    useState<Record<number, string>>({});

  const [pendingInvitations, setPendingInvitations] =
    useState<PendingInvitation[]>([]);

  const [invitingTeamId, setInvitingTeamId] =
    useState<number | null>(null);

  const [removingOwnerTeamId, setRemovingOwnerTeamId] =
    useState<number | null>(null);

  const [addingInviteSlots, setAddingInviteSlots] =
    useState(false);
  const loadPendingInvitations =
    useCallback(
      async () => {
        const sessionResult =
          await supabase.auth.getSession();

        if (sessionResult.error) {
          throw new Error(
            sessionResult.error.message
          );
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
              method: "GET",
              headers: {
                Authorization: `Bearer ${token}`,
              },
              cache: "no-store",
            }
          );

        let payload: PendingInviteApiResponse = {};

        try {
          payload =
            (await response.json()) as PendingInviteApiResponse;
        } catch {
          payload = {};
        }

        if (
          !response.ok ||
          payload.success === false
        ) {
          throw new Error(
            payload.error ??
              "Pending invitations could not be loaded."
          );
        }

        setPendingInvitations(
          payload.invitations ?? []
        );
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

          setManualMatchups(
            () => {
              const grouped:
                Record<
                  number,
                  ManualMatchup[]
                > = {};

              for (
                const matchup
                of typed.matchups ?? []
              ) {
                const week =
                  Math.max(
                    1,
                    Number(
                      matchup.week
                    ) || 1
                  );

                if (!grouped[week]) {
                  grouped[week] = [];
                }

                grouped[week].push({
                  homeTeamId:
                    matchup.home_team_id ===
                      null
                      ? null
                      : Number(
                          matchup.home_team_id
                        ),
                  awayTeamId:
                    matchup.away_team_id ===
                      null
                      ? null
                      : Number(
                          matchup.away_team_id
                        ),
                });
              }

              return grouped;
            }
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

      void loadPendingInvitations().catch(
        (inviteLoadError) => {
          setError(
            inviteLoadError instanceof Error
              ? inviteLoadError.message
              : "Pending invitations could not be loaded."
          );
        }
      );

      const timer =
        window.setInterval(
          () => {
            void loadPendingInvitations().catch(
              () => undefined
            );
          },
          20000
        );

      return () => {
        window.clearInterval(timer);
      };
    },
    [load, loadPendingInvitations]
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


  async function sendSeasonLongInvite(
    team: Team,
    resendEmail?: string
  ) {
    if (invitingTeamId !== null) return;

    const email =
      (
        resendEmail ??
        teamInviteEmails[team.id] ??
        ""
      )
        .trim()
        .toLowerCase();

    if (!email || !email.includes("@")) {
      setError(
        `Enter a valid email address for ${team.team_name}.`
      );
      return;
    }

    setInvitingTeamId(team.id);
    setError(null);
    setSuccess(null);

    try {
      const sessionResult =
        await supabase.auth.getSession();

      if (sessionResult.error) {
        throw new Error(
          sessionResult.error.message
        );
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
        result.message ??
          (
            result.resent
              ? `Invitation resent to ${email} for ${team.team_name}.`
              : `Invitation sent to ${email} for ${team.team_name}.`
          )
      );

      await Promise.all([
        load(),
        loadPendingInvitations(),
      ]);
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


  function createDefaultWeekMatchups(
    teams: Team[]
  ): ManualMatchup[] {
    const activeTeams =
      teams.filter(
        (team) =>
          team.active
      );

    const rows:
      ManualMatchup[] = [];

    for (
      let index = 0;
      index <
      activeTeams.length;
      index += 2
    ) {
      rows.push({
        homeTeamId:
          activeTeams[index]
            ?.id ??
          null,
        awayTeamId:
          activeTeams[
            index + 1
          ]?.id ??
          null,
      });
    }

    return rows;
  }


  function getWeekMatchups(
    week: number
  ): ManualMatchup[] {
    const existing =
      manualMatchups[week];

    if (
      existing &&
      existing.length >
        0
    ) {
      return existing;
    }

    return createDefaultWeekMatchups(
      data?.teams ??
        []
    );
  }


  function updateManualMatchup(
    week: number,
    rowIndex: number,
    side:
      "home" |
      "away",
    value: number | null
  ) {
    setManualMatchups(
      (current) => {
        const rows =
          (
            current[week] ??
            createDefaultWeekMatchups(
              data?.teams ??
                []
            )
          ).map(
            (row) => ({
              ...row,
            })
          );

        while (
          rows.length <=
          rowIndex
        ) {
          rows.push({
            homeTeamId:
              null,
            awayTeamId:
              null,
          });
        }

        rows[rowIndex] =
          side ===
          "home"
            ? {
                ...rows[
                  rowIndex
                ],
                homeTeamId:
                  value,
              }
            : {
                ...rows[
                  rowIndex
                ],
                awayTeamId:
                  value,
              };

        return {
          ...current,
          [week]:
            rows,
        };
      }
    );
  }


  async function randomizeHeadToHeadSchedule() {
    if (
      scheduleWorking ||
      saving
    ) {
      return;
    }

    if (
      !window.confirm(
        "Randomize the full Season-Long Head-to-Head regular-season schedule? This will replace the existing matchup schedule."
      )
    ) {
      return;
    }

    setScheduleWorking(
      true
    );
    setError(null);
    setSuccess(null);

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
              JSON.stringify({
                action:
                  "randomize-h2h-schedule",
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
            "The Head-to-Head schedule could not be randomized."
        );
      }

      setSuccess(
        "Head-to-Head schedule randomized."
      );

      await load();
    } catch (
      actionError
    ) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "The Head-to-Head schedule could not be randomized."
      );
    } finally {
      setScheduleWorking(
        false
      );
    }
  }


  async function saveHeadToHeadWeek() {
    if (
      scheduleWorking ||
      saving
    ) {
      return;
    }

    const rows =
      getWeekMatchups(
        scheduleWeek
      );

    const usedTeamIds =
      rows.flatMap(
        (row) => [
          row.homeTeamId,
          row.awayTeamId,
        ]
      )
        .filter(
          (
            teamId
          ): teamId is number =>
            teamId !==
            null
        );

    const duplicateTeam =
      usedTeamIds.find(
        (
          teamId,
          index
        ) =>
          usedTeamIds.indexOf(
            teamId
          ) !==
          index
      );

    if (
      duplicateTeam !==
      undefined
    ) {
      const duplicateName =
        data?.teams.find(
          (team) =>
            team.id ===
            duplicateTeam
        )?.team_name ??
        "A team";

      setError(
        `${duplicateName} is assigned more than once in Week ${scheduleWeek}.`
      );
      return;
    }

    if (
      rows.some(
        (row) =>
          row.homeTeamId !==
            null &&
          row.homeTeamId ===
            row.awayTeamId
      )
    ) {
      setError(
        "A team cannot play itself."
      );
      return;
    }

    setScheduleWorking(
      true
    );
    setError(null);
    setSuccess(null);

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
              JSON.stringify({
                action:
                  "save-h2h-schedule-week",
                week:
                  scheduleWeek,
                matchups:
                  rows.map(
                    (row) => ({
                      homeTeamId:
                        row.homeTeamId,
                      awayTeamId:
                        row.awayTeamId,
                    })
                  ),
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
            `Week ${scheduleWeek} matchups could not be saved.`
        );
      }

      setSuccess(
        `Week ${scheduleWeek} Head-to-Head matchups saved.`
      );

      await load();
    } catch (
      actionError
    ) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : `Week ${scheduleWeek} matchups could not be saved.`
      );
    } finally {
      setScheduleWorking(
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


  const pendingInviteByTeamId =
    useMemo(
      () =>
        new Map(
          pendingInvitations
            .filter(
              (invite) =>
                invite.fantasyTeamId !== null
            )
            .map(
              (invite) => [
                Number(invite.fantasyTeamId),
                invite,
              ] as const
            )
        ),
      [pendingInvitations]
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


  const competitionFormat =
    (
      data.league.competition_format ??
      data.league.season_long_competition_format ??
      settings?.competition_format ??
      settings?.competition_mode ??
      "total_points"
    )
      .trim()
      .toLowerCase();

  const isHeadToHead =
    [
      "head_to_head",
      "head-to-head",
      "head to head",
      "h2h",
    ].includes(
      competitionFormat
    );

  const regularSeasonWeeks =
    Math.max(
      1,
      Number(
        data.regularSeasonWeeks ??
        18
      ) ||
      18
    );


  const tabs:
    Array<[
      Tab,
      string,
    ]> = [
      ["overview", "Overview"],
      ["lineup", "League & Lineup"],
      ["scoring", "Scoring"],
      ["teams", "Teams"],
      ...(isHeadToHead
        ? [[
            "matchups",
            "Matchups",
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
      <style>{`
        .season-long-team-row {
          grid-template-columns: 46px minmax(220px, .9fr) minmax(320px, 1.55fr) auto !important;
        }

        @media (max-width: 1120px) {
          .season-long-team-row {
            grid-template-columns: 44px minmax(210px, .9fr) minmax(260px, 1.2fr) !important;
          }

          .season-long-team-row > :nth-child(4) {
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

          .season-long-team-row > :nth-child(4) {
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
          />
        ) : null}


        {tab ===
        "teams" ? (
          <>
            <Section
              title="Teams & Owners"
              subtitle={`Season-Long leagues use human owners only. Add invitation spots as needed, track pending invites, resend securely, remove owners, and invite replacements into the same historical team. ${pendingInvitations.length} invitation${pendingInvitations.length === 1 ? "" : "s"} pending.`}
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
                    team,
                    teamIndex
                  ) => {
                    const hasOwner =
                      Boolean(
                        team.owner_id
                      );

                    const pendingInvite =
                      pendingInviteByTeamId.get(
                        team.id
                      ) ?? null;

                    const ownerDisplayName =
                      team.owner_name?.trim() ||
                      (
                        hasOwner
                          ? "Human Owner"
                          : pendingInvite
                            ? "Invitation Pending"
                            : "Open Team"
                      );

                    const ownerDisplayEmail =
                      team.owner_email?.trim() ||
                      pendingInvite?.email ||
                      "";

                    return (
                      <div
                        key={
                          team.id
                        }
                        className="season-long-team-row"
                        style={{
                          ...styles.teamRow,
                          ...(hasOwner
                            ? styles.teamRowOwned
                            : pendingInvite
                              ? styles.teamRowPending
                              : styles.teamRowOpen),
                        }}
                      >
                        <div
                          style={
                            styles.teamNumber
                          }
                        >
                          {teamIndex + 1}
                        </div>

                        <div
                          style={
                            styles.teamNameBlock
                          }
                        >
                          <span
                            style={
                              styles.teamNameLabel
                            }
                          >
                            Team Name
                          </span>

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
                              styles.teamNameInput
                            }
                          />
                        </div>

                        <div
                          style={
                            styles.ownerCard
                          }
                        >
                          <div
                            style={{
                              ...styles.ownerAvatar,
                              ...(hasOwner
                                ? styles.ownerAvatarAssigned
                                : styles.ownerAvatarOpen),
                            }}
                          >
                            {hasOwner
                              ? (
                                  ownerDisplayName
                                    .charAt(0)
                                    .toUpperCase() ||
                                  "O"
                                )
                              : "✉"}
                          </div>

                          <div
                            style={
                              styles.ownerDetails
                            }
                          >
                            <span
                              style={
                                styles.ownerLabel
                              }
                            >
                              {hasOwner
                                ? "Owner"
                                : pendingInvite
                                  ? "Pending Invite"
                                  : "Owner"}
                            </span>

                            <strong
                              style={
                                styles.ownerName
                              }
                            >
                              {ownerDisplayName}
                            </strong>

                            <span
                              style={
                                styles.ownerEmail
                              }
                            >
                              {ownerDisplayEmail ||
                                (team.active
                                  ? "Active team"
                                  : "Inactive team")}
                            </span>
                          </div>

                          <span
                            style={{
                              ...styles.ownerBadge,
                              ...(hasOwner
                                ? styles.ownerBadgeAssigned
                                : pendingInvite
                                  ? styles.ownerBadgePending
                                  : styles.ownerBadgeOpen),
                            }}
                          >
                            {hasOwner
                              ? "✓ OWNER ASSIGNED"
                              : pendingInvite
                                ? "INVITE PENDING"
                                : "OPEN TEAM"}
                          </span>
                        </div>

                        <div
                          style={
                            styles.teamActions
                          }
                        >
                          {!hasOwner ? (
                            pendingInvite ? (
                              <button
                                type="button"
                                disabled={
                                  saving ||
                                  invitingTeamId !==
                                    null
                                }
                                onClick={() =>
                                  void sendSeasonLongInvite(
                                    team,
                                    pendingInvite.email
                                  )
                                }
                                style={
                                  styles.button
                                }
                              >
                                {invitingTeamId ===
                                team.id
                                  ? "RESENDING…"
                                  : "↻ RESEND INVITE"}
                              </button>
                            ) : (
                              <>
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
                                          event.target.value,
                                      })
                                    )
                                  }
                                  style={
                                    styles.inviteInput
                                  }
                                />

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
                              </>
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

                          {hasOwner ? (
                            team.owner_id ===
                            data.league.commissioner_user_id ? (
                              <button
                                type="button"
                                disabled
                                title="Transfer primary commissioner ownership before removing this owner."
                                style={{
                                  ...styles.removeOwnerButton,
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
                                  styles.removeOwnerButton
                                }
                              >
                                {removingOwnerTeamId ===
                                team.id
                                  ? "REMOVING…"
                                  : "REMOVE OWNER"}
                              </button>
                            )
                          ) : null}
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
            </Section>
          </>
        ) : null}


        {tab ===
          "matchups" &&
        isHeadToHead ? (
          <>
            <Section
              title="Head-to-Head Matchup Schedule"
              subtitle="Randomize the full regular-season schedule or manually set and edit each week's matchups. This section is available only for Season-Long Head-to-Head leagues."
            >
              <div
                style={
                  styles.scheduleToolbar
                }
              >
                <div
                  style={
                    styles.scheduleControl
                  }
                >
                  <span
                    style={
                      styles.fieldLabel
                    }
                  >
                    Week
                  </span>

                  <select
                    value={
                      scheduleWeek
                    }
                    onChange={(
                      event
                    ) =>
                      setScheduleWeek(
                        Number(
                          event.target.value
                        )
                      )
                    }
                    style={
                      styles.select
                    }
                  >
                    {Array.from(
                      {
                        length:
                          regularSeasonWeeks,
                      },
                      (
                        _,
                        index
                      ) =>
                        index + 1
                    ).map(
                      (week) => (
                        <option
                          key={
                            week
                          }
                          value={
                            week
                          }
                        >
                          Week{" "}
                          {week}
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div
                  style={
                    styles.actions
                  }
                >
                  <button
                    type="button"
                    disabled={
                      saving ||
                      scheduleWorking
                    }
                    onClick={() =>
                      void randomizeHeadToHeadSchedule()
                    }
                    style={
                      styles.button
                    }
                  >
                    {scheduleWorking
                      ? "WORKING…"
                      : "RANDOMIZE FULL SCHEDULE"}
                  </button>
                </div>
              </div>

              <div
                style={
                  styles.warning
                }
              >
                Randomize Full Schedule replaces the current Head-to-Head schedule. Manual edits below save only the selected week.
              </div>

              <div
                style={
                  styles.matchupList
                }
              >
                {getWeekMatchups(
                  scheduleWeek
                ).map(
                  (
                    matchup,
                    index
                  ) => (
                    <div
                      key={`${scheduleWeek}-${index}`}
                      style={
                        styles.matchupRow
                      }
                    >
                      <div
                        style={
                          styles.matchupNumber
                        }
                      >
                        MATCHUP{" "}
                        {index + 1}
                      </div>

                      <select
                        value={
                          matchup.homeTeamId ??
                          ""
                        }
                        onChange={(
                          event
                        ) =>
                          updateManualMatchup(
                            scheduleWeek,
                            index,
                            "home",
                            event.target.value
                              ? Number(
                                  event.target.value
                                )
                              : null
                          )
                        }
                        style={
                          styles.select
                        }
                      >
                        <option value="">
                          BYE / OPEN
                        </option>

                        {data.teams
                          .filter(
                            (team) =>
                              team.active
                          )
                          .map(
                            (team) => (
                              <option
                                key={
                                  team.id
                                }
                                value={
                                  team.id
                                }
                              >
                                {
                                  team.team_name
                                }
                              </option>
                            )
                          )}
                      </select>

                      <div
                        style={
                          styles.versus
                        }
                      >
                        VS
                      </div>

                      <select
                        value={
                          matchup.awayTeamId ??
                          ""
                        }
                        onChange={(
                          event
                        ) =>
                          updateManualMatchup(
                            scheduleWeek,
                            index,
                            "away",
                            event.target.value
                              ? Number(
                                  event.target.value
                                )
                              : null
                          )
                        }
                        style={
                          styles.select
                        }
                      >
                        <option value="">
                          BYE / OPEN
                        </option>

                        {data.teams
                          .filter(
                            (team) =>
                              team.active
                          )
                          .map(
                            (team) => (
                              <option
                                key={
                                  team.id
                                }
                                value={
                                  team.id
                                }
                              >
                                {
                                  team.team_name
                                }
                              </option>
                            )
                          )}
                      </select>
                    </div>
                  )
                )}
              </div>

              <div
                style={
                  styles.actions
                }
              >
                <button
                  type="button"
                  disabled={
                    saving ||
                    scheduleWorking
                  }
                  onClick={() =>
                    void saveHeadToHeadWeek()
                  }
                  style={
                    styles.button
                  }
                >
                  {scheduleWorking
                    ? "SAVING…"
                    : `SAVE WEEK ${scheduleWeek} MATCHUPS`}
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
                  text={
                    isHeadToHead
                      ? "Teams submit a new lineup every NFL regular-season week and compete in commissioner-managed Head-to-Head matchups."
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

    teamNumber: {
      width:
        "28px",
      height:
        "28px",
      display:
        "grid",
      placeItems:
        "center",
      border:
        "1px solid rgba(255,101,37,.30)",
      borderRadius:
        "8px",
      background:
        "rgba(164,55,18,.16)",
      color:
        "#ff7a35",
      fontSize:
        "11px",
      fontWeight:
        950,
    },

    teamRowOwned: {
      border:
        "1px solid rgba(54,191,111,.26)",
      background:
        "linear-gradient(90deg,rgba(28,104,61,.10),rgba(255,255,255,.012))",
    },

    teamRowPending: {
      border:
        "1px solid rgba(255,135,48,.24)",
      background:
        "linear-gradient(90deg,rgba(139,65,17,.10),rgba(255,255,255,.012))",
    },

    teamRowOpen: {
      border:
        "1px solid rgba(255,100,42,.22)",
      background:
        "linear-gradient(90deg,rgba(110,38,18,.08),rgba(255,255,255,.012))",
    },

    teamNameBlock: {
      display:
        "grid",
      gap:
        "6px",
      minWidth:
        0,
    },

    teamNameLabel: {
      color:
        "#aebbd0",
      fontSize:
        "11px",
      fontWeight:
        850,
    },

    teamNameInput: {
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
        "#fff",
      fontSize:
        "13px",
      fontWeight:
        800,
    },

    ownerCard: {
      minWidth:
        0,
      display:
        "flex",
      alignItems:
        "center",
      gap:
        "12px",
      padding:
        "9px 12px",
      border:
        "1px solid rgba(255,255,255,.07)",
      borderRadius:
        "9px",
      background:
        "#090c11",
    },

    ownerAvatar: {
      width:
        "36px",
      height:
        "36px",
      flex:
        "0 0 36px",
      display:
        "grid",
      placeItems:
        "center",
      borderRadius:
        "50%",
      color:
        "#fff",
      fontSize:
        "12px",
      fontWeight:
        950,
    },

    ownerAvatarAssigned: {
      background:
        "linear-gradient(135deg,#d92b19,#ff5f20)",
    },

    ownerAvatarOpen: {
      background:
        "linear-gradient(135deg,#7b2a15,#c84c1d)",
    },

    ownerDetails: {
      minWidth:
        0,
      flex:
        1,
      display:
        "grid",
      gap:
        "2px",
    },

    ownerLabel: {
      color:
        "#91a0b7",
      fontSize:
        "10px",
      fontWeight:
        850,
    },

    ownerName: {
      overflow:
        "hidden",
      textOverflow:
        "ellipsis",
      whiteSpace:
        "nowrap",
      color:
        "#fff",
      fontSize:
        "13px",
      fontWeight:
        900,
    },

    ownerEmail: {
      overflow:
        "hidden",
      textOverflow:
        "ellipsis",
      whiteSpace:
        "nowrap",
      color:
        "#8290a5",
      fontSize:
        "10px",
    },

    ownerBadge: {
      flex:
        "0 0 auto",
      padding:
        "5px 9px",
      borderRadius:
        "999px",
      fontSize:
        "9px",
      fontWeight:
        950,
      whiteSpace:
        "nowrap",
    },

    ownerBadgeAssigned: {
      border:
        "1px solid rgba(47,210,114,.34)",
      background:
        "rgba(21,121,68,.13)",
      color:
        "#5ff09c",
    },

    ownerBadgePending: {
      border:
        "1px solid rgba(255,149,59,.34)",
      background:
        "rgba(146,71,16,.13)",
      color:
        "#ff9b52",
    },

    ownerBadgeOpen: {
      border:
        "1px solid rgba(255,111,54,.26)",
      background:
        "rgba(122,40,15,.12)",
      color:
        "#ff8b55",
    },

    inviteInput: {
      minWidth:
        "190px",
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
        "12px",
    },

    removeOwnerButton: {
      minHeight:
        "38px",
      border:
        "1px solid rgba(255,79,79,.42)",
      borderRadius:
        "7px",
      padding:
        "8px 12px",
      background:
        "rgba(105,19,29,.32)",
      color:
        "#ff8f8f",
      fontSize:
        "11px",
      fontWeight:
        950,
      cursor:
        "pointer",
      whiteSpace:
        "nowrap",
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

    scheduleToolbar: {
      display:
        "flex",
      alignItems:
        "flex-end",
      justifyContent:
        "space-between",
      gap:
        "12px",
      flexWrap:
        "wrap",
    },

    scheduleControl: {
      minWidth:
        "180px",
      display:
        "grid",
      gap:
        "6px",
    },

    select: {
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

    matchupList: {
      display:
        "grid",
      gap:
        "10px",
      marginTop:
        "14px",
    },

    matchupRow: {
      display:
        "grid",
      gridTemplateColumns:
        "90px minmax(180px,1fr) 42px minmax(180px,1fr)",
      alignItems:
        "center",
      gap:
        "10px",
      padding:
        "12px",
      border:
        "1px solid rgba(255,255,255,.07)",
      borderRadius:
        "10px",
      background:
        "rgba(255,255,255,.02)",
    },

    matchupNumber: {
      color:
        "#ff8a25",
      fontSize:
        "10px",
      fontWeight:
        950,
      letterSpacing:
        ".08em",
    },

    versus: {
      textAlign:
        "center",
      color:
        "#8f96a2",
      fontSize:
        "11px",
      fontWeight:
        950,
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
