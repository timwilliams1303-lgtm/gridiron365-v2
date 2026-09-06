"use client";

import type {
  CSSProperties,
} from "react";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  createBrowserClient,
} from "@supabase/ssr";


type Props = {
  leagueId: string;
};


type LeagueRow = {
  id: string;
  commissioner_user_id: string | null;
};


type TeamRow = {
  id: number;
  team_name: string;
  owner_id: string | null;
  active: boolean;
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


type PendingInviteResponse = {
  success?: boolean;
  error?: string;
  pendingCount?: number;
  invitations?: PendingInvitation[];
};


type InviteResponse = {
  success?: boolean;
  resent?: boolean;
  error?: string;
  message?: string;
  fantasyTeamId?: number;
};


type RemoveOwnerResponse = {
  success?: boolean;
  removed?: boolean;
  historyPreserved?: boolean;
  cancelledInvitations?: number;
};


export default function NflPlayoffsParticipantManager({
  leagueId,
}: Props) {
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
    league,
    setLeague,
  ] =
    useState<LeagueRow | null>(
      null
    );

  const [
    teams,
    setTeams,
  ] =
    useState<TeamRow[]>(
      []
    );

  const [
    pendingInvitations,
    setPendingInvitations,
  ] =
    useState<
      PendingInvitation[]
    >(
      []
    );

  const [
    inviteEmails,
    setInviteEmails,
  ] =
    useState<
      Record<
        number,
        string
      >
    >(
      {}
    );

  const [
    firstName,
    setFirstName,
  ] =
    useState("");

  const [
    lastName,
    setLastName,
  ] =
    useState("");

  const [
    email,
    setEmail,
  ] =
    useState("");

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    working,
    setWorking,
  ] =
    useState(false);

  const [
    workingTeamId,
    setWorkingTeamId,
  ] =
    useState<
      number |
      null
    >(
      null
    );

  const [
    message,
    setMessage,
  ] =
    useState("");

  const [
    isError,
    setIsError,
  ] =
    useState(false);


  const getAccessToken =
    useCallback(
      async () => {
        const {
          data,
          error:
            sessionError,
        } =
          await supabase.auth
            .getSession();

        if (
          sessionError
        ) {
          throw new Error(
            sessionError.message
          );
        }

        const token =
          data.session
            ?.access_token;

        if (!token) {
          throw new Error(
            "Your login session is missing. Sign in again and retry."
          );
        }

        return token;
      },
      [supabase]
    );


  const load =
    useCallback(
      async (
        quiet =
          false
      ) => {
        if (!quiet) {
          setLoading(
            true
          );
        }

        try {
          const token =
            await getAccessToken();

          const [
            leagueResult,
            teamResult,
            inviteResponse,
          ] =
            await Promise.all([
              supabase
                .from(
                  "leagues"
                )
                .select(
                  "id,commissioner_user_id"
                )
                .eq(
                  "id",
                  leagueId
                )
                .single(),

              supabase
                .from(
                  "fantasy_teams"
                )
                .select(
                  "id,team_name,owner_id,active"
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
                  "id",
                  {
                    ascending:
                      true,
                  }
                ),

              fetch(
                `/api/league/${leagueId}/invite`,
                {
                  method:
                    "GET",

                  headers: {
                    Authorization:
                      `Bearer ${token}`,
                  },

                  cache:
                    "no-store",
                }
              ),
            ]);

          if (
            leagueResult
              .error
          ) {
            throw new Error(
              leagueResult
                .error
                .message
            );
          }

          if (
            teamResult
              .error
          ) {
            throw new Error(
              teamResult
                .error
                .message
            );
          }

          let invitePayload:
            PendingInviteResponse =
            {};

          try {
            invitePayload =
              (
                await inviteResponse
                  .json()
              ) as PendingInviteResponse;
          } catch {
            invitePayload =
              {};
          }

          if (
            !inviteResponse.ok ||
            invitePayload.success ===
              false
          ) {
            throw new Error(
              invitePayload.error ??
              "Pending invitations could not be loaded."
            );
          }

          setLeague(
            leagueResult.data as LeagueRow
          );

          setTeams(
            (
              teamResult.data ??
              []
            ) as TeamRow[]
          );

          setPendingInvitations(
            invitePayload.invitations ??
            []
          );
        } catch (
          loadError
        ) {
          setIsError(
            true
          );

          setMessage(
            loadError instanceof
              Error
              ? loadError.message
              : "NFL Playoffs participants could not be loaded."
          );
        } finally {
          if (!quiet) {
            setLoading(
              false
            );
          }
        }
      },
      [
        getAccessToken,
        leagueId,
        supabase,
      ]
    );


  useEffect(
    () => {
      void load();

      const timer =
        window.setInterval(
          () => {
            void load(
              true
            );
          },
          20000
        );

      const channel =
        supabase
          .channel(
            `nfl-playoffs-participants-${leagueId}`
          )
          .on(
            "postgres_changes",
            {
              event: "*",
              schema:
                "public",
              table:
                "fantasy_teams",
              filter:
                `league_id=eq.${leagueId}`,
            },
            () => {
              void load(
                true
              );
            }
          )
          .on(
            "postgres_changes",
            {
              event: "*",
              schema:
                "public",
              table:
                "league_invitations",
              filter:
                `league_id=eq.${leagueId}`,
            },
            () => {
              void load(
                true
              );
            }
          )
          .subscribe();

      return () => {
        window.clearInterval(
          timer
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


  const pendingByTeamId =
    useMemo(
      () =>
        new Map(
          pendingInvitations
            .filter(
              (
                invitation
              ) =>
                invitation
                  .fantasyTeamId !==
                null
            )
            .map(
              (
                invitation
              ) => [
                Number(
                  invitation
                    .fantasyTeamId
                ),
                invitation,
              ] as const
            )
        ),
      [
        pendingInvitations,
      ]
    );


  async function sendNewInvite() {
    if (working) {
      return;
    }

    const cleanFirstName =
      firstName.trim();

    const cleanLastName =
      lastName.trim();

    const cleanEmail =
      email
        .trim()
        .toLowerCase();

    if (
      !cleanFirstName ||
      !cleanLastName ||
      !cleanEmail ||
      !cleanEmail.includes(
        "@"
      )
    ) {
      setIsError(
        true
      );

      setMessage(
        "First name, last name and a valid email address are required."
      );

      return;
    }

    setWorking(
      true
    );

    setIsError(
      false
    );

    setMessage(
      ""
    );

    try {
      const token =
        await getAccessToken();

      const response =
        await fetch(
          `/api/league/${leagueId}/invite`,
          {
            method:
              "POST",

            headers: {
              Authorization:
                `Bearer ${token}`,

              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                firstName:
                  cleanFirstName,

                lastName:
                  cleanLastName,

                email:
                  cleanEmail,
              }),
          }
        );

      let payload:
        InviteResponse =
        {};

      try {
        payload =
          (
            await response
              .json()
          ) as InviteResponse;
      } catch {
        payload =
          {};
      }

      if (
        !response.ok ||
        payload.success ===
          false
      ) {
        throw new Error(
          payload.error ??
          payload.message ??
          "The invitation could not be sent."
        );
      }

      setFirstName(
        ""
      );

      setLastName(
        ""
      );

      setEmail(
        ""
      );

      setMessage(
        payload.message ??
        (
          payload.resent
            ? `Invitation resent to ${cleanEmail}.`
            : `Invitation sent to ${cleanEmail}.`
        )
      );

      await load(
        true
      );
    } catch (
      inviteError
    ) {
      setIsError(
        true
      );

      setMessage(
        inviteError instanceof
          Error
          ? inviteError.message
          : "The invitation could not be sent."
      );
    } finally {
      setWorking(
        false
      );
    }
  }


  async function sendTeamInvite(
    team:
      TeamRow,
    resendEmail?:
      string
  ) {
    if (
      workingTeamId !==
      null
    ) {
      return;
    }

    const cleanEmail =
      (
        resendEmail ??
        inviteEmails[
          team.id
        ] ??
        ""
      )
        .trim()
        .toLowerCase();

    if (
      !cleanEmail ||
      !cleanEmail.includes(
        "@"
      )
    ) {
      setIsError(
        true
      );

      setMessage(
        `Enter a valid email address for ${team.team_name}.`
      );

      return;
    }

    setWorkingTeamId(
      team.id
    );

    setIsError(
      false
    );

    setMessage(
      ""
    );

    try {
      const token =
        await getAccessToken();

      const response =
        await fetch(
          `/api/league/${leagueId}/invite`,
          {
            method:
              "POST",

            headers: {
              Authorization:
                `Bearer ${token}`,

              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                firstName:
                  team.team_name,

                lastName:
                  "Owner",

                email:
                  cleanEmail,

                fantasyTeamId:
                  team.id,
              }),
          }
        );

      let payload:
        InviteResponse =
        {};

      try {
        payload =
          (
            await response
              .json()
          ) as InviteResponse;
      } catch {
        payload =
          {};
      }

      if (
        !response.ok ||
        payload.success ===
          false
      ) {
        throw new Error(
          payload.error ??
          payload.message ??
          "The invitation could not be sent."
        );
      }

      setInviteEmails(
        (
          current
        ) => ({
          ...current,
          [team.id]:
            "",
        })
      );

      setMessage(
        payload.message ??
        (
          payload.resent
            ? `Invitation resent to ${cleanEmail} for ${team.team_name}.`
            : `Invitation sent to ${cleanEmail} for ${team.team_name}.`
        )
      );

      await load(
        true
      );
    } catch (
      inviteError
    ) {
      setIsError(
        true
      );

      setMessage(
        inviteError instanceof
          Error
          ? inviteError.message
          : "The invitation could not be sent."
      );
    } finally {
      setWorkingTeamId(
        null
      );
    }
  }


  async function removeOwner(
    team:
      TeamRow
  ) {
    if (
      !team.owner_id ||
      workingTeamId !==
        null
    ) {
      return;
    }

    if (
      league
        ?.commissioner_user_id &&
      team.owner_id ===
        league
          .commissioner_user_id
    ) {
      setIsError(
        true
      );

      setMessage(
        "The primary commissioner cannot be removed before commissioner ownership is transferred."
      );

      return;
    }

    if (
      !window.confirm(
        `Remove the current owner from ${team.team_name}? The playoff entry, round lineups, scores, standings, awards, trophies and postseason history will remain attached to this same team for a replacement owner.`
      )
    ) {
      return;
    }

    setWorkingTeamId(
      team.id
    );

    setIsError(
      false
    );

    setMessage(
      ""
    );

    try {
      const {
        data,
        error:
          removeError,
      } =
        await supabase.rpc(
          "remove_nfl_playoffs_entry_owner",
          {
            p_league_id:
              leagueId,

            p_fantasy_team_id:
              team.id,
          }
        );

      if (
        removeError
      ) {
        throw new Error(
          removeError.message
        );
      }

      const payload =
        data as RemoveOwnerResponse;

      if (
        payload
          ?.success ===
        false
      ) {
        throw new Error(
          "The participant could not be removed."
        );
      }

      setMessage(
        `Owner removed from ${team.team_name}. The playoff entry is vacant and all historical postseason results remain preserved.`
      );

      await load(
        true
      );
    } catch (
      removeActionError
    ) {
      setIsError(
        true
      );

      setMessage(
        removeActionError instanceof
          Error
          ? removeActionError.message
          : "The participant could not be removed."
      );
    } finally {
      setWorkingTeamId(
        null
      );
    }
  }


  if (loading) {
    return (
      <section
        style={
          styles.panel
        }
      >
        Loading NFL Playoffs participants…
      </section>
    );
  }


  return (
    <section
      style={
        styles.panel
      }
    >
      <div
        style={
          styles.header
        }
      >
        <div>
          <span
            style={
              styles.eyebrow
            }
          >
            PARTICIPANT MANAGEMENT
          </span>

          <h3
            style={
              styles.title
            }
          >
            NFL Playoffs Entries & Owners
          </h3>

          <p
            style={
              styles.description
            }
          >
            Invite new entries, track pending invitations, resend securely, remove an owner, and place a replacement owner into the same historical postseason entry.
          </p>
        </div>

        <div
          style={
            styles.pendingCount
          }
        >
          {
            pendingInvitations.length
          }{" "}
          PENDING
        </div>
      </div>


      {message ? (
        <div
          style={{
            ...styles.message,

            ...(isError
              ? styles.error
              : styles.success),
          }}
        >
          {message}
        </div>
      ) : null}


      <div
        style={
          styles.newInvite
        }
      >
        <div
          style={
            styles.newInviteTitle
          }
        >
          Invite New Playoff Entry
        </div>

        <div
          style={
            styles.formGrid
          }
        >
          <Field
            label="First Name"
            value={
              firstName
            }
            onChange={
              setFirstName
            }
          />

          <Field
            label="Last Name"
            value={
              lastName
            }
            onChange={
              setLastName
            }
          />

          <Field
            label="Email Address"
            value={
              email
            }
            onChange={
              setEmail
            }
            type="email"
          />

          <button
            type="button"
            disabled={
              working
            }
            onClick={() =>
              void sendNewInvite()
            }
            style={{
              ...styles.primaryButton,

              ...(working
                ? styles.disabled
                : {}),
            }}
          >
            {working
              ? "SENDING…"
              : "SEND EMAIL INVITE"}
          </button>
        </div>

        <div
          style={
            styles.help
          }
        >
          A new NFL Playoffs invitation automatically reserves its own playoff entry. Replacement invitations below reuse the exact same historical entry.
        </div>
      </div>


      <div
        style={
          styles.grid
        }
      >
        {teams.map(
          (
            team
          ) => {
            const pending =
              pendingByTeamId.get(
                team.id
              ) ??
              null;

            const hasOwner =
              Boolean(
                team.owner_id
              );

            return (
              <article
                key={
                  team.id
                }
                style={
                  styles.card
                }
              >
                <div
                  style={
                    styles.cardTop
                  }
                >
                  <span
                    style={
                      styles.teamId
                    }
                  >
                    ENTRY #{team.id}
                  </span>

                  <span
                    style={{
                      ...styles.status,

                      ...(hasOwner
                        ? styles.owned
                        : pending
                          ? styles.pending
                          : styles.vacant),
                    }}
                  >
                    {hasOwner
                      ? "OWNER ASSIGNED"
                      : pending
                        ? "INVITE PENDING"
                        : "VACANT"}
                  </span>
                </div>

                <strong
                  style={
                    styles.teamName
                  }
                >
                  {
                    team.team_name
                  }
                </strong>

                {hasOwner ? (
                  <>
                    <div
                      style={
                        styles.ownerInfo
                      }
                    >
                      <span>
                        Current owner
                      </span>

                      <code>
                        {
                          team.owner_id
                        }
                      </code>
                    </div>

                    <button
                      type="button"
                      disabled={
                        workingTeamId !==
                        null
                      }
                      onClick={() =>
                        void removeOwner(
                          team
                        )
                      }
                      style={{
                        ...styles.dangerButton,

                        ...(workingTeamId !==
                        null
                          ? styles.disabled
                          : {}),
                      }}
                    >
                      {workingTeamId ===
                      team.id
                        ? "REMOVING…"
                        : "REMOVE OWNER"}
                    </button>
                  </>
                ) : pending ? (
                  <>
                    <div
                      style={
                        styles.pendingInfo
                      }
                    >
                      <strong>
                        {
                          pending.email
                        }
                      </strong>

                      <span>
                        Sent{" "}
                        {
                          pending.emailSentAt
                            ? new Date(
                                pending.emailSentAt
                              ).toLocaleString()
                            : "—"
                        }
                      </span>

                      <span>
                        Expires{" "}
                        {new Date(
                          pending.expiresAt
                        ).toLocaleString()}
                      </span>
                    </div>

                    <button
                      type="button"
                      disabled={
                        workingTeamId !==
                        null
                      }
                      onClick={() =>
                        void sendTeamInvite(
                          team,
                          pending.email
                        )
                      }
                      style={{
                        ...styles.secondaryButton,

                        ...(workingTeamId !==
                        null
                          ? styles.disabled
                          : {}),
                      }}
                    >
                      {workingTeamId ===
                      team.id
                        ? "RESENDING…"
                        : "RESEND INVITE"}
                    </button>
                  </>
                ) : (
                  <>
                    <Field
                      label="Replacement Owner Email"
                      value={
                        inviteEmails[
                          team.id
                        ] ??
                        ""
                      }
                      onChange={(
                        value
                      ) =>
                        setInviteEmails(
                          (
                            current
                          ) => ({
                            ...current,
                            [team.id]:
                              value,
                          })
                        )
                      }
                      type="email"
                    />

                    <button
                      type="button"
                      disabled={
                        workingTeamId !==
                          null ||
                        !(
                          inviteEmails[
                            team.id
                          ] ??
                          ""
                        ).trim()
                      }
                      onClick={() =>
                        void sendTeamInvite(
                          team
                        )
                      }
                      style={{
                        ...styles.primaryButton,

                        ...(
                          workingTeamId !==
                            null ||
                          !(
                            inviteEmails[
                              team.id
                            ] ??
                            ""
                          ).trim()
                            ? styles.disabled
                            : {}
                        ),
                      }}
                    >
                      {workingTeamId ===
                      team.id
                        ? "SENDING…"
                        : "INVITE REPLACEMENT"}
                    </button>
                  </>
                )}
              </article>
            );
          }
        )}
      </div>


      <div
        style={
          styles.historyNotice
        }
      >
        Removing an owner never deletes the NFL Playoffs entry. Round lineups, fantasy points, standings, recap data, awards and Trophy Case history stay attached to the same fantasy team ID.
      </div>
    </section>
  );
}


function Field({
  label,
  value,
  onChange,
  type =
    "text",
}: {
  label:
    string;

  value:
    string;

  onChange:
    (
      value:
        string
    ) =>
      void;

  type?:
    string;
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
        onChange={(
          event
        ) =>
          onChange(
            event.target
              .value
          )
        }
        style={
          styles.input
        }
      />
    </label>
  );
}


const styles:
  Record<
    string,
    CSSProperties
  > = {
  panel: {
    border:
      "1px solid rgba(255,255,255,.09)",
    borderRadius:
      18,
    background:
      "rgba(10,10,10,.76)",
    padding:
      18,
    color:
      "#fff",
  },

  header: {
    display:
      "flex",
    justifyContent:
      "space-between",
    alignItems:
      "flex-start",
    gap:
      16,
    flexWrap:
      "wrap",
  },

  eyebrow: {
    display:
      "block",
    color:
      "#ff6a2a",
    fontSize:
      11,
    fontWeight:
      950,
    letterSpacing:
      ".09em",
    marginBottom:
      6,
  },

  title: {
    margin:
      0,
    fontSize:
      20,
  },

  description: {
    margin:
      "7px 0 0",
    maxWidth:
      760,
    color:
      "#aaa",
    lineHeight:
      1.55,
    fontSize:
      13,
  },

  pendingCount: {
    padding:
      "8px 11px",
    borderRadius:
      999,
    border:
      "1px solid rgba(251,146,60,.28)",
    background:
      "rgba(154,52,18,.15)",
    color:
      "#fdba74",
    fontWeight:
      950,
    fontSize:
      11,
  },

  message: {
    marginTop:
      14,
    padding:
      "11px 12px",
    borderRadius:
      10,
    fontSize:
      12,
  },

  success: {
    color:
      "#bbf7d0",
    border:
      "1px solid rgba(74,222,128,.22)",
    background:
      "rgba(20,83,45,.18)",
  },

  error: {
    color:
      "#fecaca",
    border:
      "1px solid rgba(248,113,113,.25)",
    background:
      "rgba(127,29,29,.2)",
  },

  newInvite: {
    marginTop:
      18,
    padding:
      14,
    borderRadius:
      14,
    border:
      "1px solid rgba(255,106,42,.18)",
    background:
      "rgba(255,85,0,.045)",
  },

  newInviteTitle: {
    fontSize:
      13,
    fontWeight:
      950,
    marginBottom:
      10,
  },

  formGrid: {
    display:
      "grid",
    gridTemplateColumns:
      "repeat(auto-fit,minmax(180px,1fr))",
    gap:
      10,
    alignItems:
      "end",
  },

  field: {
    display:
      "grid",
    gap:
      6,
  },

  fieldLabel: {
    color:
      "#9a9aa2",
    fontSize:
      10,
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
    borderRadius:
      10,
    border:
      "1px solid rgba(255,255,255,.11)",
    background:
      "#111",
    color:
      "#fff",
    padding:
      "10px 11px",
    outline:
      "none",
  },

  help: {
    marginTop:
      9,
    color:
      "#8d8d95",
    fontSize:
      11,
    lineHeight:
      1.45,
  },

  grid: {
    marginTop:
      18,
    display:
      "grid",
    gridTemplateColumns:
      "repeat(auto-fit,minmax(270px,1fr))",
    gap:
      12,
  },

  card: {
    border:
      "1px solid rgba(255,255,255,.08)",
    borderRadius:
      14,
    padding:
      14,
    background:
      "rgba(255,255,255,.025)",
    display:
      "grid",
    gap:
      11,
  },

  cardTop: {
    display:
      "flex",
    justifyContent:
      "space-between",
    gap:
      10,
    alignItems:
      "center",
  },

  teamId: {
    color:
      "#777",
    fontWeight:
      900,
    fontSize:
      10,
    letterSpacing:
      ".06em",
  },

  status: {
    padding:
      "5px 8px",
    borderRadius:
      999,
    fontWeight:
      950,
    fontSize:
      9,
  },

  owned: {
    color:
      "#86efac",
    background:
      "rgba(22,101,52,.22)",
    border:
      "1px solid rgba(74,222,128,.2)",
  },

  pending: {
    color:
      "#fdba74",
    background:
      "rgba(154,52,18,.18)",
    border:
      "1px solid rgba(251,146,60,.22)",
  },

  vacant: {
    color:
      "#fca5a5",
    background:
      "rgba(127,29,29,.16)",
    border:
      "1px solid rgba(248,113,113,.18)",
  },

  teamName: {
    fontSize:
      16,
  },

  ownerInfo: {
    display:
      "grid",
    gap:
      4,
    color:
      "#999",
    fontSize:
      11,
  },

  pendingInfo: {
    display:
      "grid",
    gap:
      4,
    color:
      "#999",
    fontSize:
      11,
  },

  primaryButton: {
    border:
      0,
    borderRadius:
      10,
    padding:
      "10px 12px",
    fontWeight:
      950,
    cursor:
      "pointer",
    color:
      "#fff",
    background:
      "linear-gradient(90deg,#b91c1c,#f97316)",
  },

  secondaryButton: {
    borderRadius:
      10,
    padding:
      "10px 12px",
    fontWeight:
      950,
    cursor:
      "pointer",
    color:
      "#fff",
    border:
      "1px solid rgba(255,255,255,.12)",
    background:
      "#191919",
  },

  dangerButton: {
    borderRadius:
      10,
    padding:
      "10px 12px",
    fontWeight:
      950,
    cursor:
      "pointer",
    color:
      "#fecaca",
    border:
      "1px solid rgba(248,113,113,.25)",
    background:
      "rgba(127,29,29,.22)",
  },

  disabled: {
    opacity:
      .5,
    cursor:
      "not-allowed",
  },

  historyNotice: {
    marginTop:
      16,
    padding:
      12,
    borderRadius:
      12,
    background:
      "rgba(255,255,255,.025)",
    border:
      "1px solid rgba(255,255,255,.07)",
    color:
      "#92929a",
    fontSize:
      11,
    lineHeight:
      1.5,
  },
};
