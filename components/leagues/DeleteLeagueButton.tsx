"use client";

import {
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";


type DeleteLeagueButtonProps = {
  leagueId: string;
  leagueName: string;
};


export default function DeleteLeagueButton({
  leagueId,
  leagueName,
}: DeleteLeagueButtonProps) {
  const router =
    useRouter();

  const [
    deleting,
    setDeleting,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState("");


  async function handleDelete() {
    if (deleting) {
      return;
    }


    const confirmed =
      window.confirm(
        `Delete "${leagueName}" permanently?\n\nThis will delete the league and its league data. This cannot be undone.`
      );


    if (!confirmed) {
      return;
    }


    setDeleting(true);
    setError("");


    try {
      const response =
        await fetch(
          `/api/leagues/${encodeURIComponent(
            leagueId
          )}`,
          {
            method:
              "DELETE",
          }
        );


      let result: {
        success?: boolean;
        error?: string;
      } = {};


      try {
        result =
          (await response.json()) as {
            success?: boolean;
            error?: string;
          };
      } catch {
        result =
          {};
      }


      if (
        !response.ok ||
        result.success !==
          true
      ) {
        throw new Error(
          result.error ??
            "The league could not be deleted."
        );
      }


      router.refresh();
    } catch (deleteError) {
      setError(
        deleteError instanceof
          Error
          ? deleteError.message
          : "The league could not be deleted."
      );

      setDeleting(false);
    }
  }


  return (
    <div
      style={
        styles.wrap
      }
    >
      <button
        type="button"
        disabled={
          deleting
        }
        onClick={
          () =>
            void handleDelete()
        }
        style={{
          ...styles.button,
          opacity:
            deleting
              ? 0.65
              : 1,
          cursor:
            deleting
              ? "not-allowed"
              : "pointer",
        }}
      >
        {deleting
          ? "Deleting..."
          : "Delete League"}
      </button>


      {error ? (
        <span
          role="alert"
          style={
            styles.error
          }
        >
          {error}
        </span>
      ) : null}
    </div>
  );
}


const styles = {
  wrap: {
    display:
      "flex",

    flexDirection:
      "column" as const,

    alignItems:
      "flex-end",

    gap:
      "8px",
  },


  button: {
    appearance:
      "none" as const,

    border:
      "1px solid rgba(248,113,113,.55)",

    borderRadius:
      "10px",

    background:
      "rgba(127,29,29,.18)",

    color:
      "#fca5a5",

    padding:
      "9px 13px",

    fontSize:
      "12px",

    fontWeight:
      800,

    letterSpacing:
      ".04em",

    transition:
      "background .15s ease, border-color .15s ease, opacity .15s ease",
  },


  error: {
    maxWidth:
      "320px",

    color:
      "#fca5a5",

    fontSize:
      "12px",

    lineHeight:
      1.4,

    textAlign:
      "right" as const,
  },
};