"use client";

import {
  useState,
} from "react";


type Props = {
  leagueId: string;
};


type InviteResponse = {
  success?: boolean;

  error?: string;

  message?: string;
};


export default function NflPlayoffsCommissionerInvites({
  leagueId,
}: Props) {
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
    sending,
    setSending,
  ] =
    useState(false);


  const [
    message,
    setMessage,
  ] =
    useState("");


  const [
    error,
    setError,
  ] =
    useState(false);


  async function sendInvite() {
    if (
      sending
    ) {
      return;
    }


    const cleanEmail =
      email
        .trim()
        .toLowerCase();


    if (
      !cleanEmail ||
      !cleanEmail.includes(
        "@"
      )
    ) {
      setError(
        true
      );

      setMessage(
        "Enter a valid email address."
      );

      return;
    }


    setSending(
      true
    );

    setError(
      false
    );

    setMessage(
      ""
    );


    try {
      const response =
        await fetch(
          `/api/leagues/${leagueId}/invite`,
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                firstName:
                  firstName.trim(),

                lastName:
                  lastName.trim(),

                email:
                  cleanEmail,
              }),
          }
        );


      let result:
        InviteResponse = {};


      try {
        result =
          (
            await response.json()
          ) as InviteResponse;
      } catch {
        result = {};
      }


      if (
        !response.ok ||
        result.success ===
          false
      ) {
        throw new Error(
          result.error ??
          result.message ??
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
        `Invitation sent to ${cleanEmail}.`
      );

    } catch (
      inviteError
    ) {
      setError(
        true
      );

      setMessage(
        inviteError instanceof
          Error
          ? inviteError.message
          : "The invitation could not be sent."
      );

    } finally {
      setSending(
        false
      );
    }
  }


  return (
    <div
      className="g365-nflp-invites"
      style={
        styles.wrap
      }
    >
      <style>{`
        .g365-nflp-invites,
        .g365-nflp-invites * {
          box-sizing: border-box;
        }

        @media (max-width: 700px) {
          .g365-nflp-invite-grid {
            grid-template-columns: 1fr !important;
          }

          .g365-nflp-invite-button {
            width: 100% !important;
          }
        }
      `}</style>


      <div
        style={
          styles.heading
        }
      >
        <strong>
          Invite a League Member
        </strong>

        <span>
          Send an owner a secure invitation to join this NFL Playoffs league.
        </span>
      </div>


      <div
        className="g365-nflp-invite-grid"
        style={
          styles.grid
        }
      >
        <Field
          label="FIRST NAME"
        >
          <input
            value={
              firstName
            }
            onChange={(
              event
            ) =>
              setFirstName(
                event.target
                  .value
              )
            }
            placeholder="First name"
            style={
              styles.input
            }
          />
        </Field>


        <Field
          label="LAST NAME"
        >
          <input
            value={
              lastName
            }
            onChange={(
              event
            ) =>
              setLastName(
                event.target
                  .value
              )
            }
            placeholder="Last name"
            style={
              styles.input
            }
          />
        </Field>


        <Field
          label="EMAIL ADDRESS"
        >
          <input
            type="email"
            value={
              email
            }
            onChange={(
              event
            ) =>
              setEmail(
                event.target
                  .value
              )
            }
            placeholder="owner@email.com"
            style={
              styles.input
            }
          />
        </Field>
      </div>


      <button
        type="button"
        className="g365-nflp-invite-button"
        disabled={
          sending
        }
        onClick={() =>
          void sendInvite()
        }
        style={{
          ...styles.button,

          opacity:
            sending
              ? 0.6
              : 1,

          cursor:
            sending
              ? "wait"
              : "pointer",
        }}
      >
        {sending
          ? "SENDING INVITE..."
          : "SEND EMAIL INVITE"}
      </button>


      {message ? (
        <div
          style={{
            ...styles.message,

            borderColor:
              error
                ? "rgba(248,113,113,.25)"
                : "rgba(74,222,128,.22)",

            background:
              error
                ? "rgba(127,29,29,.18)"
                : "rgba(20,83,45,.18)",

            color:
              error
                ? "#fecaca"
                : "#bbf7d0",
          }}
        >
          {message}
        </div>
      ) : null}
    </div>
  );
}


function Field({
  label,
  children,
}: {
  label: string;

  children:
    React.ReactNode;
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

      {children}
    </label>
  );
}


const styles:
  Record<
    string,
    React.CSSProperties
  > = {
    wrap: {
      display:
        "grid",

      gap:
        14,

      paddingTop:
        16,
    },


    heading: {
      display:
        "grid",

      gap:
        5,

      color:
        "#fff",

      fontSize:
        14,
    },


    grid: {
      display:
        "grid",

      gridTemplateColumns:
        "repeat(3,minmax(0,1fr))",

      gap:
        10,
    },


    field: {
      display:
        "grid",

      gap:
        6,
    },


    label: {
      color:
        "#808896",

      fontSize:
        8,

      fontWeight:
        950,

      letterSpacing:
        ".1em",
    },


    input: {
      width:
        "100%",

      minHeight:
        42,

      padding:
        "0 11px",

      border:
        "1px solid rgba(255,255,255,.12)",

      borderRadius:
        9,

      outline:
        "none",

      background:
        "#090b10",

      color:
        "#fff",

      fontSize:
        12,
    },


    button: {
      width:
        "fit-content",

      minHeight:
        43,

      padding:
        "0 16px",

      border:
        "1px solid #ff6827",

      borderRadius:
        9,

      background:
        "linear-gradient(90deg,#a71919,#f0641f)",

      color:
        "#fff",

      fontSize:
        10,

      fontWeight:
        950,
    },


    message: {
      padding:
        "10px 12px",

      border:
        "1px solid",

      borderRadius:
        9,

      fontSize:
        11,
    },
  };