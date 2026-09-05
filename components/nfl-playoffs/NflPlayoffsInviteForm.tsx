"use client";

import type {
  CSSProperties,
} from "react";

import {
  useMemo,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import {
  createBrowserClient,
} from "@supabase/ssr";


type Props = {
  leagueId:
    string;

  fantasyTeamId?:
    number |
    null;
};


export default function NflPlayoffsInviteForm({
  leagueId,
  fantasyTeamId = null,
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
    working,
    setWorking,
  ] =
    useState(false);


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


  async function sendInvite() {
    if (
      working
    ) {
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
      !cleanEmail
    ) {
      setIsError(
        true
      );

      setMessage(
        "First name, last name and email are required."
      );

      return;
    }


    setWorking(
      true
    );

    setMessage(
      ""
    );

    setIsError(
      false
    );


    try {
      const {
        data:
          sessionData,

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
        sessionData
          .session
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

                fantasyTeamId:
                  fantasyTeamId ??
                  null,
              }),
          }
        );


      const contentType =
        response.headers.get(
          "content-type"
        ) ?? "";


      let result:
        {
          success?: boolean;
          message?: string;
          error?: string;
        } =
        {};


      if (
        contentType.includes(
          "application/json"
        )
      ) {
        try {
          result =
            (await response.json()) as {
              success?: boolean;
              message?: string;
              error?: string;
            };
        } catch {
          result =
            {};
        }
      } else {
        const responseText =
          await response.text();

        throw new Error(
          response.ok
            ? "The invite request returned an invalid response."
            : `Invite request failed with ${response.status} ${response.statusText}${
                responseText
                  ? `: ${responseText
                      .replace(
                        /\s+/g,
                        " "
                      )
                      .slice(
                        0,
                        180
                      )}`
                  : ""
              }`
        );
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


      setMessage(
        result.message ??
        `Invitation sent to ${cleanEmail}.`
      );


      setFirstName(
        ""
      );

      setLastName(
        ""
      );

      setEmail(
        ""
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
          : "The invitation could not be sent."
      );
    } finally {
      setWorking(
        false
      );
    }
  }


  return (
    <section
      style={
        styles.card
      }
    >
      <div>
        <span
          style={
            styles.eyebrow
          }
        >
          INVITE TEAM MEMBER
        </span>

        <h3
          style={
            styles.title
          }
        >
          Send Email Invitation
        </h3>

        <p
          style={
            styles.description
          }
        >
          Send a secure Gridiron365 invitation without leaving the NFL Playoffs commissioner page.
        </p>
      </div>


      <div
        style={
          styles.grid
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

        <div
          style={
            styles.buttonWrap
          }
        >
          <button
            type="button"
            onClick={() =>
              void sendInvite()
            }
            disabled={
              working
            }
            style={{
              ...styles.button,

              ...(working
                ? styles.buttonDisabled
                : {}),
            }}
          >
            {working
              ? "SENDING..."
              : "SEND EMAIL INVITE"}
          </button>
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
    "text" |
    "email";
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

      <input
        type={
          type
        }
        value={
          value
        }
        onChange={
          (
            event
          ) =>
            onChange(
              event
                .target
                .value
            )
        }
        autoComplete={
          type ===
          "email"
            ? "email"
            : "off"
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
    card: {
      padding:
        16,

      border:
        "1px solid #2c2c2c",

      borderRadius:
        12,

      background:
        "#131416",
    },


    eyebrow: {
      color:
        "#df621f",

      fontSize:
        7,

      fontWeight:
        900,

      letterSpacing:
        ".09em",
    },


    title: {
      margin:
        "4px 0",

      fontSize:
        15,
    },


    description: {
      margin:
        0,

      color:
        "#747a83",

      fontSize:
        9,

      lineHeight:
        1.45,
    },


    grid: {
      display:
        "grid",

      gridTemplateColumns:
        "repeat(auto-fit,minmax(180px,1fr))",

      gap:
        10,

      alignItems:
        "end",

      marginTop:
        14,
    },


    field: {
      display:
        "grid",

      gap:
        6,
    },


    label: {
      color:
        "#8a9099",

      fontSize:
        8,

      fontWeight:
        800,
    },


    input: {
      width:
        "100%",

      minHeight:
        42,

      padding:
        "0 11px",

      border:
        "1px solid #343434",

      borderRadius:
        8,

      background:
        "#0d0e10",

      color:
        "#fff",

      outline:
        "none",

      boxSizing:
        "border-box",
    },


    buttonWrap: {
      display:
        "flex",

      alignItems:
        "flex-end",
    },


    button: {
      width:
        "100%",

      minHeight:
        42,

      padding:
        "0 12px",

      border:
        "1px solid #d9571c",

      borderRadius:
        8,

      background:
        "linear-gradient(135deg,#a42414,#ec621c)",

      color:
        "#fff",

      fontSize:
        8,

      fontWeight:
        900,

      cursor:
        "pointer",
    },


    buttonDisabled: {
      opacity:
        0.55,

      cursor:
        "not-allowed",
    },


    message: {
      marginTop:
        12,

      padding:
        10,

      borderRadius:
        8,

      fontSize:
        9,
    },


    success: {
      border:
        "1px solid #2b5939",

      background:
        "#122018",

      color:
        "#7ed99a",
    },


    error: {
      border:
        "1px solid #66312e",

      background:
        "#23110f",

      color:
        "#f18b7f",
    },
  };
