"use client";

import {
  FormEvent,
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
  commissionerUserId?:
    | string
    | null;
};

type EntryRow = {
  id: number;
  league_id: string;
  fantasy_team_id: number;
  user_id:
    | string
    | null;
  franchise_id:
    | string
    | null;
  season: number;
  entry_name: string;
  active: boolean;
};

type FantasyTeamRow = {
  id: number;
  league_id: string;
  owner_id:
    | string
    | null;
  team_name: string;
  active: boolean;
  is_cpu:
    | boolean
    | null;
  nhl_pickem_franchise_id:
    | string
    | null;
};

type InvitationRow = {
  id: string;
  league_id: string;
  fantasy_team_id:
    | number
    | null;
  first_name: string;
  last_name: string;
  email: string;
  status: string;
  expires_at: string;
  email_sent_at:
    | string
    | null;
  created_at:
    | string
    | null;
};

type Participant = {
  entryId: number;
  fantasyTeamId: number;
  entryName: string;
  userId:
    | string
    | null;
  franchiseId:
    | string
    | null;
  active: boolean;
  teamName: string;
  ownerId:
    | string
    | null;
  nhlFranchiseId:
    | string
    | null;
};

type InviteFormState = {
  firstName: string;
  lastName: string;
  email: string;
};

type InviteApiResponse = {
  success?: boolean;
  resent?: boolean;
  message?: string;
  error?: string;

  invitation?: {
    id: string;
    leagueId: string;
    fantasyTeamId: number;
    teamName: string;
    email: string;
    token: string;
    expiresAt: string;
  };
};

type RemoveOwnerResult = {
  success?: boolean;
  leagueId?: string;
  season?: number;
  fantasyTeamId?: number;
  entryId?:
    | number
    | null;
  franchiseId?:
    | string
    | null;
  teamName?: string;
  removedUserId?: string;
  membershipRemoved?: boolean;
  historyPreserved?: boolean;
};

const emptyInviteForm =
  (): InviteFormState => ({
    firstName: "",
    lastName: "",
    email: "",
  });

function normalizeEmail(
  value: string
) {
  return value
    .trim()
    .toLowerCase();
}

function isValidEmail(
  value: string
) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    value
  );
}

function formatDate(
  value:
    | string
    | null
    | undefined
) {
  if (!value) {
    return "—";
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
    return value;
  }

  return date.toLocaleString(
    "en-US",
    {
      dateStyle:
        "medium",

      timeStyle:
        "short",
    }
  );
}

export default function NhlPickemParticipantManager({
  leagueId,
  season,
  commissionerUserId =
    null,
}: Props) {
  const supabase =
    useMemo(
      () =>
        createSupabaseBrowserClient(),
      []
    );

  const [
    entries,
    setEntries,
  ] =
    useState<
      EntryRow[]
    >(
      []
    );

  const [
    teams,
    setTeams,
  ] =
    useState<
      FantasyTeamRow[]
    >(
      []
    );

  const [
    invitations,
    setInvitations,
  ] =
    useState<
      InvitationRow[]
    >(
      []
    );

  const [
    loading,
    setLoading,
  ] =
    useState(
      true
    );

  const [
    workingKey,
    setWorkingKey,
  ] =
    useState<
      string |
      null
    >(
      null
    );

  const [
    error,
    setError,
  ] =
    useState<
      string |
      null
    >(
      null
    );

  const [
    success,
    setSuccess,
  ] =
    useState<
      string |
      null
    >(
      null
    );

  const [
    newInvite,
    setNewInvite,
  ] =
    useState<
      InviteFormState
    >(
      emptyInviteForm
    );

  const [
    teamInviteForms,
    setTeamInviteForms,
  ] =
    useState<
      Record<
        number,
        InviteFormState
      >
    >(
      {}
    );

  /* ============================================================
     LOAD PARTICIPANTS + PENDING INVITATIONS
  ============================================================ */

  const load =
    useCallback(
      async (
        showLoading =
          false
      ) => {
        if (
          showLoading
        ) {
          setLoading(
            true
          );
        }

        try {
          const [
            entriesResponse,
            teamsResponse,
            invitationsResponse,
          ] =
            await Promise.all([
              supabase
                .from(
                  "nhl_pickem_entries"
                )
                .select(
                  `
                    id,
                    league_id,
                    fantasy_team_id,
                    user_id,
                    franchise_id,
                    season,
                    entry_name,
                    active
                  `
                )
                .eq(
                  "league_id",
                  leagueId
                )
                .eq(
                  "season",
                  season
                )
                .order(
                  "entry_name",
                  {
                    ascending:
                      true,
                  }
                ),

              supabase
                .from(
                  "fantasy_teams"
                )
                .select(
                  `
                    id,
                    league_id,
                    owner_id,
                    team_name,
                    active,
                    is_cpu,
                    nhl_pickem_franchise_id
                  `
                )
                .eq(
                  "league_id",
                  leagueId
                )
                .eq(
                  "active",
                  true
                )
                .order(
                  "team_name",
                  {
                    ascending:
                      true,
                  }
                ),

              supabase
                .from(
                  "league_invitations"
                )
                .select(
                  `
                    id,
                    league_id,
                    fantasy_team_id,
                    first_name,
                    last_name,
                    email,
                    status,
                    expires_at,
                    email_sent_at,
                    created_at
                  `
                )
                .eq(
                  "league_id",
                  leagueId
                )
                .eq(
                  "status",
                  "pending"
                )
                .order(
                  "created_at",
                  {
                    ascending:
                      false,
                  }
                ),
            ]);

          if (
            entriesResponse.error
          ) {
            throw new Error(
              entriesResponse
                .error
                .message
            );
          }

          if (
            teamsResponse.error
          ) {
            throw new Error(
              teamsResponse
                .error
                .message
            );
          }

          /*
           * Participant management itself should still load if
           * league_invitations has more restrictive RLS.
           *
           * The invite send/resend backend remains authoritative.
           */
          if (
            invitationsResponse.error
          ) {
            console.warn(
              "Unable to load pending NHL Pick'em invitations:",
              invitationsResponse
                .error
                .message
            );

            setInvitations(
              []
            );
          } else {
            setInvitations(
              (
                invitationsResponse
                  .data ??
                []
              ) as InvitationRow[]
            );
          }

          setEntries(
            (
              entriesResponse
                .data ??
              []
            ) as EntryRow[]
          );

          setTeams(
            (
              teamsResponse
                .data ??
              []
            ) as FantasyTeamRow[]
          );
        } catch (
          loadError
        ) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "NHL Pick'em participants could not be loaded."
          );
        } finally {
          setLoading(
            false
          );
        }
      },
      [
        leagueId,
        season,
        supabase,
      ]
    );

  useEffect(
    () => {
      void load(
        true
      );

      const interval =
        window.setInterval(
          () => {
            void load(
              false
            );
          },
          20_000
        );

      const channel =
        supabase
          .channel(
            `nhl-pickem-participants-${leagueId}`
          )
          .on(
            "postgres_changes",
            {
              event:
                "*",
              schema:
                "public",
              table:
                "nhl_pickem_entries",
              filter:
                `league_id=eq.${leagueId}`,
            },
            () => {
              void load(
                false
              );
            }
          )
          .on(
            "postgres_changes",
            {
              event:
                "*",
              schema:
                "public",
              table:
                "fantasy_teams",
              filter:
                `league_id=eq.${leagueId}`,
            },
            () => {
              void load(
                false
              );
            }
          )
          .on(
            "postgres_changes",
            {
              event:
                "*",
              schema:
                "public",
              table:
                "league_invitations",
              filter:
                `league_id=eq.${leagueId}`,
            },
            () => {
              void load(
                false
              );
            }
          )
          .subscribe();

      return () => {
        window.clearInterval(
          interval
        );

        void supabase
          .removeChannel(
            channel
          );
      };
    },
    [
      leagueId,
      load,
      supabase,
    ]
  );

  /* ============================================================
     DERIVED PARTICIPANTS
  ============================================================ */

  const participants =
    useMemo(
      () => {
        const teamMap =
          new Map<
            number,
            FantasyTeamRow
          >();

        for (
          const team of
          teams
        ) {
          teamMap.set(
            team.id,
            team
          );
        }

        return entries
          .map(
            (
              entry
            ): Participant => {
              const team =
                teamMap.get(
                  entry
                    .fantasy_team_id
                );

              return {
                entryId:
                  entry.id,

                fantasyTeamId:
                  entry
                    .fantasy_team_id,

                entryName:
                  entry
                    .entry_name,

                userId:
                  entry
                    .user_id,

                franchiseId:
                  entry
                    .franchise_id,

                active:
                  entry.active,

                teamName:
                  team
                    ?.team_name ??
                  entry
                    .entry_name,

                ownerId:
                  team
                    ?.owner_id ??
                  entry
                    .user_id,

                nhlFranchiseId:
                  team
                    ?.nhl_pickem_franchise_id ??
                  entry
                    .franchise_id,
              };
            }
          )
          .sort(
            (
              a,
              b
            ) =>
              a.teamName.localeCompare(
                b.teamName
              )
          );
      },
      [
        entries,
        teams,
      ]
    );

  const activeParticipants =
    useMemo(
      () =>
        participants.filter(
          (
            participant
          ) =>
            participant.active
        ),
      [
        participants,
      ]
    );

  const inactiveParticipants =
    useMemo(
      () =>
        participants.filter(
          (
            participant
          ) =>
            !participant.active
        ),
      [
        participants,
      ]
    );

  const ownedCount =
    useMemo(
      () =>
        activeParticipants.filter(
          (
            participant
          ) =>
            Boolean(
              participant
                .ownerId
            )
        ).length,
      [
        activeParticipants,
      ]
    );

  const vacantCount =
    useMemo(
      () =>
        activeParticipants.filter(
          (
            participant
          ) =>
            !participant
              .ownerId
        ).length,
      [
        activeParticipants,
      ]
    );

  const pendingInvitationsByTeam =
    useMemo(
      () => {
        const map =
          new Map<
            number,
            InvitationRow
          >();

        for (
          const invitation of
          invitations
        ) {
          if (
            invitation
              .fantasy_team_id ===
            null
          ) {
            continue;
          }

          if (
            !map.has(
              invitation
                .fantasy_team_id
            )
          ) {
            map.set(
              invitation
                .fantasy_team_id,
              invitation
            );
          }
        }

        return map;
      },
      [
        invitations,
      ]
    );

  /* ============================================================
     FORM HELPERS
  ============================================================ */

  const getTeamInviteForm =
    useCallback(
      (
        fantasyTeamId:
          number
      ) =>
        teamInviteForms[
          fantasyTeamId
        ] ??
        emptyInviteForm(),
      [
        teamInviteForms,
      ]
    );

  const updateTeamInviteForm =
    useCallback(
      (
        fantasyTeamId:
          number,
        field:
          keyof InviteFormState,
        value:
          string
      ) => {
        setTeamInviteForms(
          (
            current
          ) => ({
            ...current,

            [fantasyTeamId]:
              {
                ...(
                  current[
                    fantasyTeamId
                  ] ??
                  emptyInviteForm()
                ),

                [field]:
                  value,
              },
          })
        );
      },
      []
    );

  /* ============================================================
     SEND / RESEND INVITATION
  ============================================================ */

  const sendInvitation =
    useCallback(
      async ({
        form,
        fantasyTeamId,
      }: {
        form:
          InviteFormState;
        fantasyTeamId?:
          number;
      }) => {
        const firstName =
          form.firstName
            .trim();

        const lastName =
          form.lastName
            .trim();

        const email =
          normalizeEmail(
            form.email
          );

        if (
          !firstName
        ) {
          throw new Error(
            "First name is required."
          );
        }

        if (
          !lastName
        ) {
          throw new Error(
            "Last name is required."
          );
        }

        if (
          !email ||
          !isValidEmail(
            email
          )
        ) {
          throw new Error(
            "Enter a valid email address."
          );
        }

        const {
          data:
            sessionData,

          error:
            sessionError,
        } =
          await supabase
            .auth
            .getSession();

        if (
          sessionError
        ) {
          throw new Error(
            sessionError
              .message
          );
        }

        const accessToken =
          sessionData
            .session
            ?.access_token;

        if (
          !accessToken
        ) {
          throw new Error(
            "Your login session is missing."
          );
        }

        const response =
          await fetch(
            `/api/league/${encodeURIComponent(
              leagueId
            )}/invite`,
            {
              method:
                "POST",

              headers: {
                Authorization:
                  `Bearer ${accessToken}`,

                "Content-Type":
                  "application/json",
              },

              body:
                JSON.stringify({
                  firstName,
                  lastName,
                  email,

                  fantasyTeamId:
                    fantasyTeamId ??
                    null,
                }),
            }
          );

        let result:
          InviteApiResponse =
            {};

        try {
          result =
            (await response.json()) as
              InviteApiResponse;
        } catch {
          result =
            {};
        }

        if (
          !response.ok ||
          result.success ===
            false
        ) {
          throw new Error(
            result.error ??
              "The invitation could not be sent."
          );
        }

        return result;
      },
      [
        leagueId,
        supabase,
      ]
    );

  const handleNewParticipantInvite =
    useCallback(
      async (
        event:
          FormEvent<HTMLFormElement>
      ) => {
        event.preventDefault();

        if (
          workingKey
        ) {
          return;
        }

        const key =
          "new-invite";

        setWorkingKey(
          key
        );

        setError(
          null
        );

        setSuccess(
          null
        );

        try {
          const result =
            await sendInvitation({
              form:
                newInvite,
            });

          setSuccess(
            result.message ??
              `Invitation sent to ${newInvite.email.trim()}.`
          );

          setNewInvite(
            emptyInviteForm()
          );

          await load(
            false
          );
        } catch (
          inviteError
        ) {
          setError(
            inviteError instanceof Error
              ? inviteError.message
              : "The NHL Pick'em invitation could not be sent."
          );
        } finally {
          setWorkingKey(
            null
          );
        }
      },
      [
        load,
        newInvite,
        sendInvitation,
        workingKey,
      ]
    );

  const handleVacantTeamInvite =
    useCallback(
      async (
        fantasyTeamId:
          number
      ) => {
        if (
          workingKey
        ) {
          return;
        }

        const form =
          getTeamInviteForm(
            fantasyTeamId
          );

        const key =
          `invite-${fantasyTeamId}`;

        setWorkingKey(
          key
        );

        setError(
          null
        );

        setSuccess(
          null
        );

        try {
          const result =
            await sendInvitation({
              form,
              fantasyTeamId,
            });

          setSuccess(
            result.message ??
              "Invitation sent."
          );

          setTeamInviteForms(
            (
              current
            ) => {
              const next =
                {
                  ...current,
                };

              delete next[
                fantasyTeamId
              ];

              return next;
            }
          );

          await load(
            false
          );
        } catch (
          inviteError
        ) {
          setError(
            inviteError instanceof Error
              ? inviteError.message
              : "The invitation could not be sent."
          );
        } finally {
          setWorkingKey(
            null
          );
        }
      },
      [
        getTeamInviteForm,
        load,
        sendInvitation,
        workingKey,
      ]
    );

  const handleResendInvitation =
    useCallback(
      async (
        invitation:
          InvitationRow
      ) => {
        if (
          workingKey
        ) {
          return;
        }

        if (
          invitation
            .fantasy_team_id ===
          null
        ) {
          setError(
            "This invitation no longer has a reserved NHL Pick'em team."
          );

          return;
        }

        const key =
          `resend-${invitation.id}`;

        setWorkingKey(
          key
        );

        setError(
          null
        );

        setSuccess(
          null
        );

        try {
          const result =
            await sendInvitation({
              fantasyTeamId:
                invitation
                  .fantasy_team_id,

              form: {
                firstName:
                  invitation
                    .first_name,

                lastName:
                  invitation
                    .last_name,

                email:
                  invitation
                    .email,
              },
            });

          setSuccess(
            result.message ??
              `Invitation resent to ${invitation.email}.`
          );

          await load(
            false
          );
        } catch (
          resendError
        ) {
          setError(
            resendError instanceof Error
              ? resendError.message
              : "The invitation could not be resent."
          );
        } finally {
          setWorkingKey(
            null
          );
        }
      },
      [
        load,
        sendInvitation,
        workingKey,
      ]
    );

  /* ============================================================
     REMOVE OWNER
  ============================================================ */

  const handleRemoveOwner =
    useCallback(
      async (
        participant:
          Participant
      ) => {
        if (
          workingKey ||
          !participant
            .ownerId
        ) {
          return;
        }

        if (
          participant
            .ownerId ===
          commissionerUserId
        ) {
          setError(
            "The primary commissioner cannot be removed from their own league."
          );

          return;
        }

        const confirmed =
          window.confirm(
            [
              `Remove the current owner from ${participant.teamName}?`,
              "",
              "The NHL franchise, picks, standings, awards, and Trophy Case history will stay in the league.",
              "",
              "This entry will become available for a replacement invitation.",
            ].join(
              "\n"
            )
          );

        if (
          !confirmed
        ) {
          return;
        }

        const key =
          `remove-${participant.fantasyTeamId}`;

        setWorkingKey(
          key
        );

        setError(
          null
        );

        setSuccess(
          null
        );

        try {
          const {
            data,
            error:
              removeError,
          } =
            await supabase.rpc(
              "commissioner_remove_nhl_pickem_owner",
              {
                p_league_id:
                  leagueId,

                p_fantasy_team_id:
                  participant
                    .fantasyTeamId,
              }
            );

          if (
            removeError
          ) {
            throw new Error(
              removeError
                .message
            );
          }

          const result =
            data as
              | RemoveOwnerResult
              | null;

          if (
            !result
              ?.success
          ) {
            throw new Error(
              "The NHL Pick'em owner could not be removed."
            );
          }

          setSuccess(
            `${participant.teamName} is now vacant. Its NHL history was preserved and a replacement owner can be invited.`
          );

          await load(
            false
          );
        } catch (
          removeError
        ) {
          setError(
            removeError instanceof Error
              ? removeError.message
              : "The NHL Pick'em owner could not be removed."
          );
        } finally {
          setWorkingKey(
            null
          );
        }
      },
      [
        commissionerUserId,
        leagueId,
        load,
        supabase,
        workingKey,
      ]
    );

  /* ============================================================
     LOADING
  ============================================================ */

  if (
    loading
  ) {
    return (
      <section
        style={
          styles.section
        }
      >
        <div
          style={
            styles.loadingCard
          }
        >
          Loading NHL Pick&apos;em participants…
        </div>
      </section>
    );
  }

  return (
    <section
      style={
        styles.section
      }
    >
      <div
        style={
          styles.header
        }
      >
        <div>
          <div
            style={
              styles.eyebrow
            }
          >
            NHL PICK&apos;EM
          </div>

          <h2
            style={
              styles.title
            }
          >
            Participants &amp; Invitations
          </h2>

          <p
            style={
              styles.subtitle
            }
          >
            Invite new owners, fill vacant NHL entries, resend pending invitations,
            or remove an owner while preserving the franchise&apos;s history.
          </p>
        </div>

        <button
          type="button"
          style={
            styles.refreshButton
          }
          disabled={
            Boolean(
              workingKey
            )
          }
          onClick={() => {
            void load(
              true
            );
          }}
        >
          REFRESH
        </button>
      </div>

      {/* ======================================================
          SUMMARY
      ====================================================== */}

      <div
        style={
          styles.summaryGrid
        }
      >
        <SummaryCard
          label="Active Entries"
          value={
            activeParticipants
              .length
          }
        />

        <SummaryCard
          label="Owners"
          value={
            ownedCount
          }
        />

        <SummaryCard
          label="Vacant"
          value={
            vacantCount
          }
        />

        <SummaryCard
          label="Pending Invites"
          value={
            invitations
              .length
          }
        />
      </div>

      {success ? (
        <div
          style={
            styles.success
          }
        >
          {success}
        </div>
      ) : null}

      {error ? (
        <div
          style={
            styles.error
          }
        >
          {error}
        </div>
      ) : null}

      {/* ======================================================
          INVITE NEW PARTICIPANT
      ====================================================== */}

      <div
        style={
          styles.panel
        }
      >
        <div
          style={
            styles.panelHeader
          }
        >
          <div>
            <div
              style={
                styles.panelEyebrow
              }
            >
              EMAIL INVITATION
            </div>

            <h3
              style={
                styles.panelTitle
              }
            >
              Invite New Participant
            </h3>

            <p
              style={
                styles.panelText
              }
            >
              Gridiron365 will reserve a new NHL Pick&apos;em entry and email the
              recipient a secure invitation link.
            </p>
          </div>
        </div>

        <form
          style={
            styles.formGrid
          }
          onSubmit={
            handleNewParticipantInvite
          }
        >
          <Field
            label="First Name"
            value={
              newInvite
                .firstName
            }
            placeholder="First name"
            onChange={(
              value
            ) => {
              setNewInvite(
                (
                  current
                ) => ({
                  ...current,
                  firstName:
                    value,
                })
              );
            }}
          />

          <Field
            label="Last Name"
            value={
              newInvite
                .lastName
            }
            placeholder="Last name"
            onChange={(
              value
            ) => {
              setNewInvite(
                (
                  current
                ) => ({
                  ...current,
                  lastName:
                    value,
                })
              );
            }}
          />

          <Field
            label="Email"
            value={
              newInvite
                .email
            }
            placeholder="owner@example.com"
            type="email"
            onChange={(
              value
            ) => {
              setNewInvite(
                (
                  current
                ) => ({
                  ...current,
                  email:
                    value,
                })
              );
            }}
          />

          <div
            style={
              styles.formAction
            }
          >
            <button
              type="submit"
              disabled={
                Boolean(
                  workingKey
                )
              }
              style={
                workingKey ===
                "new-invite"
                  ? {
                      ...styles.primaryButton,
                      ...styles.disabled,
                    }
                  : styles.primaryButton
              }
            >
              {workingKey ===
              "new-invite"
                ? "SENDING…"
                : "SEND INVITATION"}
            </button>
          </div>
        </form>
      </div>

      {/* ======================================================
          CURRENT PARTICIPANTS
      ====================================================== */}

      <div
        style={
          styles.panel
        }
      >
        <div
          style={
            styles.panelHeader
          }
        >
          <div>
            <div
              style={
                styles.panelEyebrow
              }
            >
              CURRENT SEASON
            </div>

            <h3
              style={
                styles.panelTitle
              }
            >
              NHL Pick&apos;em Entries
            </h3>
          </div>
        </div>

        {activeParticipants
          .length ===
        0 ? (
          <div
            style={
              styles.empty
            }
          >
            No NHL Pick&apos;em entries have been created yet.
          </div>
        ) : (
          <div
            style={
              styles.cardList
            }
          >
            {activeParticipants.map(
              (
                participant
              ) => {
                const pendingInvite =
                  pendingInvitationsByTeam.get(
                    participant
                      .fantasyTeamId
                  ) ??
                  null;

                const isPrimaryCommissioner =
                  Boolean(
                    commissionerUserId &&
                    participant
                      .ownerId ===
                      commissionerUserId
                  );

                const form =
                  getTeamInviteForm(
                    participant
                      .fantasyTeamId
                  );

                return (
                  <article
                    key={
                      participant
                        .entryId
                    }
                    style={
                      participant
                        .ownerId
                        ? styles.participantCard
                        : styles.vacantCard
                    }
                  >
                    <div
                      style={
                        styles.participantTop
                      }
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          minWidth: 0,
                        }}
                      >
                        <div
                          style={{
                            width: 30,
                            height: 30,
                            flex: "0 0 30px",
                            display: "grid",
                            placeItems: "center",
                            borderRadius: 8,
                            border: "1px solid rgba(255,104,42,.28)",
                            background: "rgba(160,52,18,.16)",
                            color: "#ff7b35",
                            fontSize: 10,
                            fontWeight: 950,
                          }}
                        >
                          {activeParticipants.indexOf(participant) + 1}
                        </div>

                        <div>
                        <div
                          style={
                            styles.entryName
                          }
                        >
                          {
                            participant
                              .teamName
                          }
                        </div>

                        <div
                          style={
                            styles.entryMeta
                          }
                        >
                          Entry #
                          {
                            participant
                              .entryId
                          }
                          {" • "}
                          Team #
                          {
                            participant
                              .fantasyTeamId
                          }
                        </div>
                        </div>
                      </div>

                      <StatusBadge
                        text={
                          participant
                            .ownerId
                            ? isPrimaryCommissioner
                              ? "COMMISSIONER"
                              : "OWNED"
                            : pendingInvite
                              ? "INVITE PENDING"
                              : "VACANT"
                        }
                        tone={
                          participant
                            .ownerId
                            ? isPrimaryCommissioner
                              ? "orange"
                              : "green"
                            : pendingInvite
                              ? "orange"
                              : "red"
                        }
                      />
                    </div>

                    {participant
                      .ownerId ? (
                      <>
                        <div
                          style={
                            styles.infoGrid
                          }
                        >
                          <Info
                            label="Owner User ID"
                            value={
                              participant
                                .ownerId
                            }
                          />

                          <Info
                            label="Franchise"
                            value={
                              participant
                                .nhlFranchiseId ??
                              participant
                                .franchiseId ??
                              "Linked"
                            }
                          />
                        </div>

                        <div
                          style={
                            styles.actionRow
                          }
                        >
                          {isPrimaryCommissioner ? (
                            <div
                              style={
                                styles.protectedText
                              }
                            >
                              Primary commissioner ownership is protected.
                            </div>
                          ) : (
                            <button
                              type="button"
                              disabled={
                                Boolean(
                                  workingKey
                                )
                              }
                              style={
                                workingKey ===
                                `remove-${participant.fantasyTeamId}`
                                  ? {
                                      ...styles.dangerButton,
                                      ...styles.disabled,
                                    }
                                  : styles.dangerButton
                              }
                              onClick={() => {
                                void handleRemoveOwner(
                                  participant
                                );
                              }}
                            >
                              {workingKey ===
                              `remove-${participant.fantasyTeamId}`
                                ? "REMOVING…"
                                : "REMOVE OWNER"}
                            </button>
                          )}
                        </div>
                      </>
                    ) : pendingInvite ? (
                      <div
                        style={
                          styles.pendingPanel
                        }
                      >
                        <div
                          style={
                            styles.pendingTitle
                          }
                        >
                          Invitation Pending
                        </div>

                        <div
                          style={
                            styles.infoGrid
                          }
                        >
                          <Info
                            label="Invitee"
                            value={
                              `${pendingInvite.first_name} ${pendingInvite.last_name}`.trim()
                            }
                          />

                          <Info
                            label="Email"
                            value={
                              pendingInvite
                                .email
                            }
                          />

                          <Info
                            label="Sent"
                            value={
                              formatDate(
                                pendingInvite
                                  .email_sent_at
                              )
                            }
                          />

                          <Info
                            label="Expires"
                            value={
                              formatDate(
                                pendingInvite
                                  .expires_at
                              )
                            }
                          />
                        </div>

                        <div
                          style={
                            styles.actionRow
                          }
                        >
                          <button
                            type="button"
                            disabled={
                              Boolean(
                                workingKey
                              )
                            }
                            style={
                              workingKey ===
                              `resend-${pendingInvite.id}`
                                ? {
                                    ...styles.secondaryButton,
                                    ...styles.disabled,
                                  }
                                : styles.secondaryButton
                            }
                            onClick={() => {
                              void handleResendInvitation(
                                pendingInvite
                              );
                            }}
                          >
                            {workingKey ===
                            `resend-${pendingInvite.id}`
                              ? "RESENDING…"
                              : "RESEND INVITATION"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                        style={
                          styles.vacantInvite
                        }
                      >
                        <div
                          style={
                            styles.vacantTitle
                          }
                        >
                          Invite Replacement Owner
                        </div>

                        <p
                          style={
                            styles.smallMuted
                          }
                        >
                          The entry and its NHL history remain intact. The invited
                          owner will take over this exact franchise slot.
                        </p>

                        <div
                          style={
                            styles.formGrid
                          }
                        >
                          <Field
                            label="First Name"
                            value={
                              form
                                .firstName
                            }
                            placeholder="First name"
                            onChange={(
                              value
                            ) => {
                              updateTeamInviteForm(
                                participant
                                  .fantasyTeamId,
                                "firstName",
                                value
                              );
                            }}
                          />

                          <Field
                            label="Last Name"
                            value={
                              form
                                .lastName
                            }
                            placeholder="Last name"
                            onChange={(
                              value
                            ) => {
                              updateTeamInviteForm(
                                participant
                                  .fantasyTeamId,
                                "lastName",
                                value
                              );
                            }}
                          />

                          <Field
                            label="Email"
                            value={
                              form.email
                            }
                            type="email"
                            placeholder="owner@example.com"
                            onChange={(
                              value
                            ) => {
                              updateTeamInviteForm(
                                participant
                                  .fantasyTeamId,
                                "email",
                                value
                              );
                            }}
                          />

                          <div
                            style={
                              styles.formAction
                            }
                          >
                            <button
                              type="button"
                              disabled={
                                Boolean(
                                  workingKey
                                )
                              }
                              style={
                                workingKey ===
                                `invite-${participant.fantasyTeamId}`
                                  ? {
                                      ...styles.primaryButton,
                                      ...styles.disabled,
                                    }
                                  : styles.primaryButton
                              }
                              onClick={() => {
                                void handleVacantTeamInvite(
                                  participant
                                    .fantasyTeamId
                                );
                              }}
                            >
                              {workingKey ===
                              `invite-${participant.fantasyTeamId}`
                                ? "SENDING…"
                                : "SEND INVITATION"}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </article>
                );
              }
            )}
          </div>
        )}
      </div>

      {/* ======================================================
          INACTIVE HISTORY
      ====================================================== */}

      {inactiveParticipants
        .length >
      0 ? (
        <div
          style={
            styles.panel
          }
        >
          <div
            style={
              styles.panelHeader
            }
          >
            <div>
              <div
                style={
                  styles.panelEyebrow
                }
              >
                HISTORY
              </div>

              <h3
                style={
                  styles.panelTitle
                }
              >
                Inactive Entries
              </h3>

              <p
                style={
                  styles.panelText
                }
              >
                These records remain available for historical continuity.
              </p>
            </div>
          </div>

          <div
            style={
              styles.cardList
            }
          >
            {inactiveParticipants.map(
              (
                participant
              ) => (
                <article
                  key={
                    participant
                      .entryId
                  }
                  style={
                    styles.inactiveCard
                  }
                >
                  <div
                    style={
                      styles.entryName
                    }
                  >
                    {
                      participant
                        .teamName
                    }
                  </div>

                  <div
                    style={
                      styles.entryMeta
                    }
                  >
                    Historical NHL Pick&apos;em entry
                  </div>
                </article>
              )
            )}
          </div>
        </div>
      ) : null}

      <div
        style={
          styles.notice
        }
      >
        Removing an owner does not erase their NHL Pick&apos;em franchise,
        submitted picks, standings, awards, or Trophy Case history. The entry
        stays in the league so a replacement owner can take over the same
        franchise lineage.
      </div>
    </section>
  );
}

/* ============================================================
   SMALL COMPONENTS
============================================================ */

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div
      style={
        styles.summaryCard
      }
    >
      <div
        style={
          styles.summaryLabel
        }
      >
        {label}
      </div>

      <div
        style={
          styles.summaryValue
        }
      >
        {value}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  placeholder,
  type =
    "text",
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  type?: string;
  onChange: (
    value: string
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
        type={
          type
        }
        value={
          value
        }
        placeholder={
          placeholder
        }
        style={
          styles.input
        }
        onChange={(
          event
        ) => {
          onChange(
            event.target
              .value
          );
        }}
      />
    </label>
  );
}

function Info({
  label,
  value,
}: {
  label: string;
  value: string;
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
        style={
          styles.infoValue
        }
      >
        {value}
      </strong>
    </div>
  );
}

function StatusBadge({
  text,
  tone,
}: {
  text: string;
  tone:
    | "green"
    | "orange"
    | "red";
}) {
  const toneStyle =
    tone ===
    "green"
      ? styles.badgeGreen
      : tone ===
          "orange"
        ? styles.badgeOrange
        : styles.badgeRed;

  return (
    <span
      style={{
        ...styles.badge,
        ...toneStyle,
      }}
    >
      {text}
    </span>
  );
}

/* ============================================================
   STYLES
============================================================ */

const styles:
  Record<
    string,
    React.CSSProperties
  > = {
    section: {
      display:
        "grid",

      gap:
        "18px",

      marginTop:
        "20px",

      color:
        "#ffffff",
    },

    header: {
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
      color:
        "#ff6b22",

      fontSize:
        "10px",

      fontWeight:
        950,

      letterSpacing:
        ".14em",
    },

    title: {
      margin:
        "5px 0 6px",

      fontSize:
        "clamp(27px, 4vw, 40px)",

      lineHeight:
        1,

      letterSpacing:
        "-.04em",
    },

    subtitle: {
      maxWidth:
        "760px",

      margin:
        0,

      color:
        "#939393",

      fontSize:
        "13px",

      lineHeight:
        1.6,
    },

    refreshButton: {
      border:
        "1px solid rgba(255,255,255,.10)",

      borderRadius:
        "9px",

      padding:
        "10px 14px",

      color:
        "#ffffff",

      background:
        "#111111",

      fontSize:
        "10px",

      fontWeight:
        900,

      cursor:
        "pointer",
    },

    summaryGrid: {
      display:
        "grid",

      gridTemplateColumns:
        "repeat(auto-fit, minmax(140px, 1fr))",

      gap:
        "10px",
    },

    summaryCard: {
      padding:
        "16px",

      border:
        "1px solid rgba(255,255,255,.08)",

      borderRadius:
        "13px",

      background:
        "linear-gradient(145deg, rgba(110,14,7,.16), #0d0d0d 58%)",
    },

    summaryLabel: {
      color:
        "#777777",

      fontSize:
        "9px",

      fontWeight:
        900,

      letterSpacing:
        ".08em",

      textTransform:
        "uppercase",
    },

    summaryValue: {
      marginTop:
        "7px",

      fontSize:
        "28px",

      fontWeight:
        1000,
    },

    panel: {
      padding:
        "18px",

      border:
        "1px solid rgba(255,255,255,.08)",

      borderRadius:
        "16px",

      background:
        "#0b0b0b",
    },

    panelHeader: {
      display:
        "flex",

      justifyContent:
        "space-between",

      gap:
        "12px",

      marginBottom:
        "15px",
    },

    panelEyebrow: {
      color:
        "#ff5d19",

      fontSize:
        "9px",

      fontWeight:
        950,

      letterSpacing:
        ".12em",
    },

    panelTitle: {
      margin:
        "4px 0",

      fontSize:
        "20px",

      letterSpacing:
        "-.025em",
    },

    panelText: {
      margin:
        0,

      color:
        "#858585",

      fontSize:
        "12px",

      lineHeight:
        1.55,
    },

    formGrid: {
      display:
        "grid",

      gridTemplateColumns:
        "repeat(auto-fit, minmax(170px, 1fr))",

      gap:
        "10px",

      alignItems:
        "end",
    },

    field: {
      display:
        "grid",

      gap:
        "6px",
    },

    fieldLabel: {
      color:
        "#878787",

      fontSize:
        "9px",

      fontWeight:
        900,

      letterSpacing:
        ".06em",

      textTransform:
        "uppercase",
    },

    input: {
      width:
        "100%",

      boxSizing:
        "border-box",

      border:
        "1px solid rgba(255,255,255,.09)",

      borderRadius:
        "9px",

      padding:
        "11px 12px",

      outline:
        "none",

      color:
        "#ffffff",

      background:
        "#080808",

      fontSize:
        "13px",
    },

    formAction: {
      display:
        "flex",

      alignItems:
        "flex-end",
    },

    primaryButton: {
      width:
        "100%",

      minHeight:
        "40px",

      border:
        0,

      borderRadius:
        "9px",

      padding:
        "11px 15px",

      color:
        "#ffffff",

      background:
        "linear-gradient(90deg, #c81710, #ff7600)",

      fontSize:
        "10px",

      fontWeight:
        950,

      cursor:
        "pointer",
    },

    secondaryButton: {
      border:
        "1px solid rgba(255,107,34,.30)",

      borderRadius:
        "9px",

      padding:
        "10px 14px",

      color:
        "#ff9a5b",

      background:
        "rgba(255,107,34,.07)",

      fontSize:
        "10px",

      fontWeight:
        950,

      cursor:
        "pointer",
    },

    dangerButton: {
      border:
        "1px solid rgba(255,70,70,.30)",

      borderRadius:
        "9px",

      padding:
        "10px 14px",

      color:
        "#ff8d87",

      background:
        "rgba(255,50,50,.07)",

      fontSize:
        "10px",

      fontWeight:
        950,

      cursor:
        "pointer",
    },

    disabled: {
      opacity:
        0.55,

      cursor:
        "not-allowed",
    },

    success: {
      padding:
        "12px 14px",

      border:
        "1px solid rgba(51,210,118,.28)",

      borderRadius:
        "10px",

      color:
        "#7be7a6",

      background:
        "rgba(39,170,95,.07)",

      fontSize:
        "12px",
    },

    error: {
      padding:
        "12px 14px",

      border:
        "1px solid rgba(255,75,75,.27)",

      borderRadius:
        "10px",

      color:
        "#ff9690",

      background:
        "rgba(255,55,55,.07)",

      fontSize:
        "12px",
    },

    cardList: {
      display:
        "grid",

      gap:
        "10px",
    },

    participantCard: {
      padding:
        "14px",

      border:
        "1px solid rgba(58,207,113,.23)",

      borderRadius:
        "12px",

      background:
        "linear-gradient(90deg,rgba(28,104,61,.09),rgba(255,255,255,.012))",
    },

    vacantCard: {
      padding:
        "14px",

      border:
        "1px solid rgba(255,107,34,.20)",

      borderRadius:
        "12px",

      background:
        "linear-gradient(90deg,rgba(123,45,12,.11),rgba(255,255,255,.012))",
    },

    inactiveCard: {
      padding:
        "14px",

      border:
        "1px solid rgba(255,255,255,.06)",

      borderRadius:
        "11px",

      opacity:
        0.62,

      background:
        "#080808",
    },

    participantTop: {
      display:
        "flex",

      alignItems:
        "flex-start",

      justifyContent:
        "space-between",

      gap:
        "12px",

      flexWrap:
        "wrap",
    },

    entryName: {
      minWidth:
        0,

      padding:
        "9px 11px",

      border:
        "1px solid rgba(255,255,255,.09)",

      borderRadius:
        "8px",

      background:
        "#0b0d12",

      color:
        "#ffffff",

      fontSize:
        "14px",

      fontWeight:
        950,

      letterSpacing:
        "-.01em",
    },

    entryMeta: {
      marginTop:
        "4px",

      color:
        "#727272",

      fontSize:
        "10px",
    },

    badge: {
      display:
        "inline-flex",

      alignItems:
        "center",

      borderRadius:
        "999px",

      padding:
        "6px 9px",

      fontSize:
        "8px",

      fontWeight:
        950,

      letterSpacing:
        ".07em",
    },

    badgeGreen: {
      border:
        "1px solid rgba(52,211,120,.25)",

      color:
        "#7ae6a5",

      background:
        "rgba(52,211,120,.07)",
    },

    badgeOrange: {
      border:
        "1px solid rgba(255,120,20,.28)",

      color:
        "#ffa15c",

      background:
        "rgba(255,120,20,.08)",
    },

    badgeRed: {
      border:
        "1px solid rgba(255,69,69,.28)",

      color:
        "#ff918b",

      background:
        "rgba(255,69,69,.07)",
    },

    infoGrid: {
      display:
        "grid",

      gridTemplateColumns:
        "repeat(auto-fit, minmax(170px, 1fr))",

      gap:
        "8px",

      marginTop:
        "13px",

      padding:
        "10px",

      border:
        "1px solid rgba(255,255,255,.07)",

      borderRadius:
        "9px",

      background:
        "#090c11",
    },

    info: {
      padding:
        "10px",

      border:
        "1px solid rgba(255,255,255,.05)",

      borderRadius:
        "8px",

      background:
        "#070707",
    },

    infoLabel: {
      display:
        "block",

      marginBottom:
        "4px",

      color:
        "#696969",

      fontSize:
        "8px",

      fontWeight:
        900,

      textTransform:
        "uppercase",

      letterSpacing:
        ".06em",
    },

    infoValue: {
      display:
        "block",

      color:
        "#d7d7d7",

      fontSize:
        "11px",

      wordBreak:
        "break-word",
    },

    actionRow: {
      display:
        "flex",

      alignItems:
        "center",

      gap:
        "8px",

      flexWrap:
        "wrap",

      marginTop:
        "13px",
    },

    protectedText: {
      color:
        "#777777",

      fontSize:
        "11px",
    },

    pendingPanel: {
      marginTop:
        "13px",

      padding:
        "13px",

      border:
        "1px solid rgba(255,120,20,.17)",

      borderRadius:
        "10px",

      background:
        "rgba(255,100,20,.04)",
    },

    pendingTitle: {
      color:
        "#ff9956",

      fontSize:
        "12px",

      fontWeight:
        950,
    },

    vacantInvite: {
      marginTop:
        "13px",

      paddingTop:
        "13px",

      borderTop:
        "1px solid rgba(255,255,255,.06)",
    },

    vacantTitle: {
      fontSize:
        "13px",

      fontWeight:
        950,
    },

    smallMuted: {
      margin:
        "4px 0 12px",

      color:
        "#767676",

      fontSize:
        "11px",

      lineHeight:
        1.5,
    },

    empty: {
      padding:
        "18px",

      border:
        "1px dashed rgba(255,255,255,.08)",

      borderRadius:
        "10px",

      color:
        "#777777",

      textAlign:
        "center",

      fontSize:
        "12px",
    },

    notice: {
      padding:
        "14px",

      border:
        "1px solid rgba(255,107,34,.12)",

      borderRadius:
        "11px",

      color:
        "#8f8f8f",

      background:
        "rgba(255,107,34,.035)",

      fontSize:
        "11px",

      lineHeight:
        1.6,
    },

    loadingCard: {
      padding:
        "22px",

      border:
        "1px solid rgba(255,255,255,.07)",

      borderRadius:
        "13px",

      color:
        "#888888",

      background:
        "#0b0b0b",
    },
  };
