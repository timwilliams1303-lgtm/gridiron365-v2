"use client";

import {
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
};


type TeamRow = {
  id: number;
  owner_id: string | null;
  team_name: string;
  active: boolean;
};


type LeagueRow = {
  commissioner_user_id: string;
};


type InviteResponse = {
  success?: boolean;
  message?: string;
  error?: string;
};



const PICKEM_PARTICIPANTS_MOBILE_CSS = `
  .g365-pickem-participants,
  .g365-pickem-participants * {
    box-sizing: border-box;
  }

  @media (max-width: 760px) {
    .g365-pickem-participants {
      width: 100% !important;
      max-width: 100% !important;
      min-width: 0 !important;
      padding: 15px !important;
      overflow-x: hidden;
    }

    .g365-pickem-participants-header {
      display: grid !important;
      grid-template-columns: minmax(0,1fr) !important;
      gap: 12px !important;
    }

    .g365-pickem-add-entry {
      width: 100% !important;
      min-height: 44px !important;
    }

    .g365-pickem-participant-card {
      grid-template-columns: minmax(0,1fr) !important;
      align-items: stretch !important;
      gap: 10px !important;
      padding: 12px !important;
    }

    .g365-pickem-participant-card strong {
      white-space: normal !important;
      overflow-wrap: anywhere;
    }

    .g365-pickem-invite-row {
      grid-template-columns: minmax(0,1fr) !important;
      gap: 8px !important;
    }

    .g365-pickem-invite-row input,
    .g365-pickem-invite-row button,
    .g365-pickem-participant-card > button {
      width: 100% !important;
      min-width: 0 !important;
      justify-self: stretch !important;
    }

    .g365-pickem-participants input {
      font-size: 16px !important;
    }
  }

  @media (max-width: 430px) {
    .g365-pickem-participants {
      padding: 13px !important;
    }
  }
`;


export default function PickemParticipantManager({
  leagueId,
}: Props) {
  const supabase =
    useMemo(
      () =>
        createSupabaseBrowserClient(),
      []
    );

  const [loading, setLoading] =
    useState(true);

  const [teams, setTeams] =
    useState<TeamRow[]>([]);

  const [
    commissionerUserId,
    setCommissionerUserId,
  ] =
    useState<string | null>(null);

  const [
    inviteEmails,
    setInviteEmails,
  ] =
    useState<Record<number, string>>({});

  const [adding, setAdding] =
    useState(false);

  const [
    invitingTeamId,
    setInvitingTeamId,
  ] =
    useState<number | null>(null);

  const [
    removingTeamId,
    setRemovingTeamId,
  ] =
    useState<number | null>(null);

  const [message, setMessage] =
    useState("");

  const [isError, setIsError] =
    useState(false);


  const load =
    useCallback(
      async () => {
        const [
          leagueResult,
          teamResult,
        ] =
          await Promise.all([
            supabase
              .from("leagues")
              .select(
                "commissioner_user_id"
              )
              .eq(
                "id",
                leagueId
              )
              .maybeSingle(),

            supabase
              .from("fantasy_teams")
              .select(
                "id,owner_id,team_name,active"
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
                  ascending: true,
                }
              ),
          ]);

        if (leagueResult.error) {
          throw new Error(
            leagueResult.error.message
          );
        }

        if (teamResult.error) {
          throw new Error(
            teamResult.error.message
          );
        }

        setCommissionerUserId(
          (
            leagueResult.data as
              | LeagueRow
              | null
          )
            ?.commissioner_user_id ??
            null
        );

        setTeams(
          (
            teamResult.data ??
            []
          ) as TeamRow[]
        );
      },
      [
        leagueId,
        supabase,
      ]
    );


  useEffect(() => {
    let active = true;

    async function run() {
      setLoading(true);

      try {
        await load();
      } catch (error) {
        if (!active) {
          return;
        }

        setIsError(true);
        setMessage(
          error instanceof Error
            ? error.message
            : "Pick'em participants could not be loaded."
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void run();

    return () => {
      active = false;
    };
  }, [load]);


  async function addOpenEntry() {
    if (adding) {
      return;
    }

    setAdding(true);
    setMessage("");
    setIsError(false);

    try {
      const { error } =
        await supabase.rpc(
          "commissioner_add_open_team_slot",
          {
            p_league_id:
              leagueId,
            p_team_name:
              `Open Pick'em Entry ${teams.length + 1}`,
          }
        );

      if (error) {
        throw new Error(
          error.message
        );
      }

      await load();

      setMessage(
        "Open Pick'em entry added."
      );
    } catch (error) {
      setIsError(true);
      setMessage(
        error instanceof Error
          ? error.message
          : "The open entry could not be added."
      );
    } finally {
      setAdding(false);
    }
  }


  async function sendInvite(
    team: TeamRow
  ) {
    if (
      team.owner_id ||
      invitingTeamId !== null
    ) {
      return;
    }

    const email =
      (
        inviteEmails[team.id] ??
        ""
      )
        .trim()
        .toLowerCase();

    if (
      !email ||
      !email.includes("@")
    ) {
      setIsError(true);
      setMessage(
        `Enter a valid email address for ${team.team_name}.`
      );
      return;
    }

    setInvitingTeamId(
      team.id
    );
    setMessage("");
    setIsError(false);

    try {
      const sessionResult =
        await supabase.auth.getSession();

      if (sessionResult.error) {
        throw new Error(
          sessionResult.error.message
        );
      }

      const token =
        sessionResult.data.session
          ?.access_token;

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
              "Content-Type":
                "application/json",
              Authorization:
                `Bearer ${token}`,
            },
            body: JSON.stringify({
              email,
              firstName:
                team.team_name,
              lastName:
                "Pick'em",
              fantasyTeamId:
                team.id,
            }),
          }
        );

      let payload:
        InviteResponse = {};

      try {
        payload =
          (await response.json()) as InviteResponse;
      } catch {
        payload = {};
      }

      if (
        !response.ok ||
        payload.success === false
      ) {
        throw new Error(
          payload.error ??
            payload.message ??
            "The invitation could not be sent."
        );
      }

      setInviteEmails(
        (current) => ({
          ...current,
          [team.id]: "",
        })
      );

      setMessage(
        `Invitation sent to ${email} for ${team.team_name}.`
      );

      await load();
    } catch (error) {
      setIsError(true);
      setMessage(
        error instanceof Error
          ? error.message
          : "The invitation could not be sent."
      );
    } finally {
      setInvitingTeamId(null);
    }
  }


  async function removeOwner(
    team: TeamRow
  ) {
    if (
      !team.owner_id ||
      removingTeamId !== null
    ) {
      return;
    }

    if (
      team.owner_id ===
      commissionerUserId
    ) {
      setIsError(true);
      setMessage(
        "The primary commissioner cannot be removed before commissioner ownership is transferred."
      );
      return;
    }

    if (
      !window.confirm(
        `Remove the current owner from ${team.team_name}? Their Pick'em history, picks, results, badges and standings history will remain attached to this entry.`
      )
    ) {
      return;
    }

    setRemovingTeamId(
      team.id
    );
    setMessage("");
    setIsError(false);

    try {
      const { data, error } =
        await supabase.rpc(
          "remove_pickem_entry_owner",
          {
            p_league_id:
              leagueId,
            p_fantasy_team_id:
              team.id,
          }
        );

      if (error) {
        throw new Error(
          error.message
        );
      }

      const response =
        data as {
          success?: boolean;
        };

      if (
        response.success ===
        false
      ) {
        throw new Error(
          "The participant could not be removed."
        );
      }

      await load();

      setMessage(
        `Owner removed from ${team.team_name}. The entry is now vacant and its historical Pick'em results remain preserved.`
      );
    } catch (error) {
      setIsError(true);
      setMessage(
        error instanceof Error
          ? error.message
          : "The participant could not be removed."
      );
    } finally {
      setRemovingTeamId(null);
    }
  }


  if (loading) {
    return (
      <section style={styles.panel}>
        <div
          style={{
            color: "#8f8f98",
          }}
        >
          Loading participants…
        </div>
      </section>
    );
  }


  return (
    <section className="g365-pickem-participants" style={styles.panel}>
      <style>{PICKEM_PARTICIPANTS_MOBILE_CSS}</style>
      <div className="g365-pickem-participants-header" style={styles.header}>
        <div>
          <div style={styles.eyebrow}>
            PARTICIPANTS
          </div>

          <h2 style={styles.title}>
            Entries & Owners
          </h2>

          <p style={styles.description}>
            Add open Pick&apos;em entries, email invitations, or remove an owner while preserving that entry&apos;s historical picks, results, standings and badges.
          </p>
        </div>

        <button
          type="button"
          disabled={adding}
          onClick={() =>
            void addOpenEntry()
          }
          className="g365-pickem-add-entry"
          style={styles.addButton}
        >
          {adding
            ? "ADDING…"
            : "+ ADD OPEN ENTRY"}
        </button>
      </div>


      {message ? (
        <div
          style={{
            padding: "11px 12px",
            marginTop: 14,
            borderRadius: 10,
            border: `1px solid ${
              isError
                ? "rgba(248,113,113,.25)"
                : "rgba(74,222,128,.22)"
            }`,
            background:
              isError
                ? "rgba(127,29,29,.20)"
                : "rgba(20,83,45,.18)",
            color:
              isError
                ? "#fecaca"
                : "#bbf7d0",
            fontSize: 12,
          }}
        >
          {message}
        </div>
      ) : null}


      <div
        style={{
          display: "grid",
          gap: 10,
          marginTop: 14,
        }}
      >
        {teams.map((team) => {
          const isPrimary =
            Boolean(
              team.owner_id &&
              team.owner_id ===
                commissionerUserId
            );

          return (
            <article
              key={team.id}
              className="g365-pickem-participant-card"
              style={styles.teamCard}
            >
              <div
                style={{
                  minWidth: 0,
                }}
              >
                <strong
                  style={{
                    display: "block",
                    overflow: "hidden",
                    textOverflow:
                      "ellipsis",
                    color: "#fff",
                    fontSize: 14,
                    whiteSpace: "nowrap",
                  }}
                >
                  {team.team_name}
                </strong>

                <div
                  style={{
                    marginTop: 4,
                    color:
                      team.owner_id
                        ? "#7ee2a3"
                        : "#a1a1aa",
                    fontSize: 11,
                    fontWeight: 800,
                  }}
                >
                  {isPrimary
                    ? "PRIMARY COMMISSIONER"
                    : team.owner_id
                      ? "OWNER ASSIGNED"
                      : "VACANT ENTRY"}
                </div>
              </div>

              {team.owner_id ? (
                <button
                  type="button"
                  disabled={
                    isPrimary ||
                    removingTeamId ===
                      team.id
                  }
                  onClick={() =>
                    void removeOwner(
                      team
                    )
                  }
                  style={{
                    ...styles.removeButton,
                    opacity:
                      isPrimary
                        ? 0.45
                        : 1,
                    cursor:
                      isPrimary
                        ? "not-allowed"
                        : "pointer",
                  }}
                >
                  {removingTeamId ===
                  team.id
                    ? "REMOVING…"
                    : isPrimary
                      ? "PRIMARY OWNER"
                      : "REMOVE OWNER"}
                </button>
              ) : (
                <div
                  className="g365-pickem-invite-row"
                  style={styles.inviteRow}
                >
                  <input
                    type="email"
                    value={
                      inviteEmails[
                        team.id
                      ] ??
                      ""
                    }
                    onChange={(event) =>
                      setInviteEmails(
                        (current) => ({
                          ...current,
                          [team.id]:
                            event.target
                              .value,
                        })
                      )
                    }
                    placeholder="owner@email.com"
                    style={styles.input}
                  />

                  <button
                    type="button"
                    disabled={
                      invitingTeamId !==
                      null
                    }
                    onClick={() =>
                      void sendInvite(
                        team
                      )
                    }
                    style={styles.inviteButton}
                  >
                    {invitingTeamId ===
                    team.id
                      ? "SENDING…"
                      : "EMAIL INVITE"}
                  </button>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}


const styles:
  Record<
    string,
    React.CSSProperties
  > = {
  panel: {
    padding: 20,
    borderRadius: 16,
    border:
      "1px solid rgba(255,102,0,.22)",
    background: "#111115",
  },

  header: {
    display: "flex",
    justifyContent:
      "space-between",
    gap: 14,
    alignItems:
      "flex-start",
    flexWrap: "wrap",
  },

  eyebrow: {
    color: "#ff7627",
    fontSize: 10,
    fontWeight: 1000,
    letterSpacing: ".10em",
  },

  title: {
    margin: "5px 0 5px",
    color: "#fff",
    fontSize: 21,
  },

  description: {
    margin: 0,
    maxWidth: 720,
    color: "#8f8f98",
    fontSize: 13,
    lineHeight: 1.55,
  },

  addButton: {
    minHeight: 40,
    padding: "8px 11px",
    borderRadius: 9,
    border:
      "1px solid rgba(255,107,31,.42)",
    background:
      "linear-gradient(135deg,rgba(160,14,20,.34),rgba(255,102,0,.25))",
    color: "#fff",
    fontSize: 11,
    fontWeight: 1000,
    cursor: "pointer",
  },

  teamCard: {
    display: "grid",
    gridTemplateColumns:
      "minmax(160px,1fr) minmax(280px,1.4fr)",
    gap: 12,
    alignItems: "center",
    padding: 12,
    borderRadius: 11,
    border:
      "1px solid rgba(255,255,255,.07)",
    background:
      "rgba(255,255,255,.02)",
  },

  inviteRow: {
    display: "grid",
    gridTemplateColumns:
      "minmax(0,1fr) auto",
    gap: 8,
  },

  input: {
    minHeight: 40,
    minWidth: 0,
    padding: "8px 10px",
    borderRadius: 9,
    border:
      "1px solid rgba(255,255,255,.12)",
    background: "#09090b",
    color: "#fff",
    outline: "none",
  },

  inviteButton: {
    minHeight: 40,
    padding: "8px 10px",
    borderRadius: 9,
    border: 0,
    background:
      "linear-gradient(135deg,#a80d18,#ff6500)",
    color: "#fff",
    fontSize: 10,
    fontWeight: 1000,
    cursor: "pointer",
  },

  removeButton: {
    justifySelf: "end",
    minHeight: 40,
    padding: "8px 10px",
    borderRadius: 9,
    border:
      "1px solid rgba(248,113,113,.28)",
    background:
      "rgba(127,29,29,.22)",
    color: "#fecaca",
    fontSize: 10,
    fontWeight: 1000,
  },
};
