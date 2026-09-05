"use client";

import {
  useMemo,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import {
  createSupabaseBrowserClient,
} from "@/lib/supabase/browser";


type Props = {
  leagueId:
    string;

  leagueName:
    string;
};


export default function NflPlayoffsDeleteLeague({
  leagueId,
  leagueName,
}: Props) {
  const router =
    useRouter();

  const supabase =
    useMemo(
      () =>
        createSupabaseBrowserClient(),
      []
    );

  const [
    confirmationName,
    setConfirmationName,
  ] =
    useState("");

  const [
    deleting,
    setDeleting,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null
    );


  const confirmed =
    confirmationName.trim() ===
    leagueName;


  async function deleteLeague() {
    if (
      deleting
    ) {
      return;
    }


    if (
      !confirmed
    ) {
      setError(
        `Type "${leagueName}" exactly before deleting this league.`
      );

      return;
    }


    if (
      !window.confirm(
        `Permanently delete ${leagueName}? This cannot be undone.`
      )
    ) {
      return;
    }


    setDeleting(
      true
    );

    setError(
      null
    );


    try {
      const {
        data,
        error:
          deleteError,
      } =
        await supabase.rpc(
          "delete_nfl_playoff_league",
          {
            p_league_id:
              leagueId,

            p_confirmation_name:
              confirmationName.trim(),
          }
        );


      if (
        deleteError
      ) {
        throw new Error(
          deleteError.message
        );
      }


      const result =
        data as {
          success?:
            boolean;

          deletedLeagueId?:
            string;

          deletedLeagueName?:
            string;
        } | null;


      if (
        result &&
        result.success ===
          false
      ) {
        throw new Error(
          "The league could not be deleted."
        );
      }


      router.replace(
        "/my-leagues"
      );

      router.refresh();

    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
        Error
          ? caughtError.message
          : "The league could not be deleted."
      );

      setDeleting(
        false
      );
    }
  }


  return (
    <section
      style={
        styles.dangerZone
      }
    >
      <div>
        <span
          style={
            styles.eyebrow
          }
        >
          DANGER ZONE
        </span>

        <h3
          style={
            styles.title
          }
        >
          Delete League
        </h3>

        <p
          style={
            styles.copy
          }
        >
          Permanently deletes this NFL Playoffs league and its league-owned
          data. This action cannot be undone. Only the primary commissioner
          can complete this action.
        </p>
      </div>


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
          Type {leagueName} to confirm
        </span>

        <input
          type="text"
          value={
            confirmationName
          }
          onChange={(
            event
          ) =>
            setConfirmationName(
              event.target.value
            )
          }
          placeholder={
            leagueName
          }
          disabled={
            deleting
          }
          autoComplete="off"
          style={
            styles.input
          }
        />
      </label>


      {error ? (
        <div
          role="alert"
          style={
            styles.error
          }
        >
          {error}
        </div>
      ) : null}


      <button
        type="button"
        disabled={
          deleting ||
          !confirmed
        }
        onClick={
          () =>
            void deleteLeague()
        }
        style={{
          ...styles.button,

          ...(
            deleting ||
            !confirmed
              ? styles.buttonDisabled
              : {}
          ),
        }}
      >
        {deleting
          ? "DELETING…"
          : "PERMANENTLY DELETE LEAGUE"}
      </button>
    </section>
  );
}


const styles:
  Record<
    string,
    React.CSSProperties
  > = {
    dangerZone: {
      marginTop:
        18,

      padding:
        16,

      display:
        "grid",

      gap:
        14,

      border:
        "1px solid rgba(210,45,34,.42)",

      borderRadius:
        11,

      background:
        "linear-gradient(135deg,rgba(119,14,12,.22),rgba(43,12,10,.35))",
    },

    eyebrow: {
      display:
        "block",

      color:
        "#ef5a45",

      fontSize:
        7,

      fontWeight:
        900,

      letterSpacing:
        ".11em",
    },

    title: {
      margin:
        "5px 0",

      color:
        "#ffffff",

      fontSize:
        15,
    },

    copy: {
      margin:
        0,

      maxWidth:
        820,

      color:
        "#9a7974",

      fontSize:
        9,

      lineHeight:
        1.55,
    },

    field: {
      display:
        "grid",

      gap:
        6,

      maxWidth:
        520,
    },

    label: {
      color:
        "#c7a29c",

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
        "9px 11px",

      border:
        "1px solid rgba(214,80,60,.32)",

      borderRadius:
        8,

      outline:
        "none",

      background:
        "#120d0c",

      color:
        "#ffffff",

      fontSize:
        13,
    },

    error: {
      padding:
        "9px 11px",

      border:
        "1px solid rgba(255,80,70,.25)",

      borderRadius:
        8,

      background:
        "rgba(130,20,18,.20)",

      color:
        "#ff8e82",

      fontSize:
        10,
    },

    button: {
      width:
        "fit-content",

      minHeight:
        42,

      padding:
        "10px 15px",

      border:
        "1px solid #a53629",

      borderRadius:
        8,

      background:
        "linear-gradient(135deg,#8e2118,#d84231)",

      color:
        "#ffffff",

      cursor:
        "pointer",

      fontSize:
        8,

      fontWeight:
        950,

      letterSpacing:
        ".04em",
    },

    buttonDisabled: {
      opacity:
        0.45,

      cursor:
        "not-allowed",
    },
  };