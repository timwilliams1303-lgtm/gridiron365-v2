"use client";

import {
  useMemo,
  useState,
} from "react";

import {
  createSupabaseBrowserClient,
} from "@/lib/supabase/browser";


type Props = {
  leagueId: string;

  fantasyTeamId:
    number;

  initialTeamName:
    string;
};


type RenameResponse = {
  success?: boolean;

  error?: string;

  teamName?: string;
};


export default function TraditionalTeamNameEditor({
  leagueId,
  fantasyTeamId,
  initialTeamName,
}: Props) {
  const supabase =
    useMemo(
      () =>
        createSupabaseBrowserClient(),
      []
    );


  const [
    currentName,
    setCurrentName,
  ] =
    useState(
      initialTeamName
    );


  const [
    draftName,
    setDraftName,
  ] =
    useState(
      initialTeamName
    );


  const [
    editing,
    setEditing,
  ] =
    useState(
      false
    );


  const [
    saving,
    setSaving,
  ] =
    useState(
      false
    );


  const [
    message,
    setMessage,
  ] =
    useState<
      string |
      null
    >(
      null
    );


  const [
    isError,
    setIsError,
  ] =
    useState(
      false
    );


  function beginEdit() {
    setDraftName(
      currentName
    );

    setMessage(
      null
    );

    setIsError(
      false
    );

    setEditing(
      true
    );
  }


  function cancelEdit() {
    if (saving) {
      return;
    }

    setDraftName(
      currentName
    );

    setMessage(
      null
    );

    setIsError(
      false
    );

    setEditing(
      false
    );
  }


  async function saveTeamName() {
    if (
      saving
    ) {
      return;
    }

    const cleanName =
      draftName
        .trim()
        .replace(
          /\s+/g,
          " "
        );


    if (!cleanName) {
      setIsError(
        true
      );

      setMessage(
        "Team name cannot be blank."
      );

      return;
    }


    if (
      cleanName.length >
      40
    ) {
      setIsError(
        true
      );

      setMessage(
        "Team name must be 40 characters or fewer."
      );

      return;
    }


    if (
      cleanName ===
      currentName
    ) {
      setEditing(
        false
      );

      return;
    }


    setSaving(
      true
    );

    setMessage(
      null
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
        await supabase
          .auth
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
          `/api/league/${leagueId}/team-name`,
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",

              Authorization:
                `Bearer ${token}`,
            },

            body:
              JSON.stringify({
                fantasyTeamId,
                teamName:
                  cleanName,
              }),
          }
        );


      let result:
        RenameResponse =
        {};


      try {
        result =
          (await response
            .json()) as
            RenameResponse;
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
            "The team name could not be changed."
        );
      }


      const savedName =
        result.teamName ??
        cleanName;


      setCurrentName(
        savedName
      );

      setDraftName(
        savedName
      );

      setEditing(
        false
      );

      setIsError(
        false
      );

      setMessage(
        "Team name updated."
      );


      window.setTimeout(
        () => {
          setMessage(
            null
          );
        },
        2200
      );
    } catch (
      error
    ) {
      setIsError(
        true
      );

      setMessage(
        error instanceof Error
          ? error.message
          : "The team name could not be changed."
      );
    } finally {
      setSaving(
        false
      );
    }
  }


  if (!editing) {
    return (
      <div
        className="g365-team-name-wrap"
        style={
          styles.wrap
        }
      >
        <style>{mobileCss}</style>
        <div
          className="g365-team-name-title-row"
          style={
            styles.titleRow
          }
        >
          <h1
            style={
              styles.title
            }
          >
            {currentName}
          </h1>


          <button
            type="button"
            onClick={
              beginEdit
            }
            style={
              styles.editButton
            }
          >
            EDIT TEAM NAME
          </button>
        </div>


        {message ? (
          <span
            style={
              isError
                ? styles.error
                : styles.success
            }
          >
            {message}
          </span>
        ) : null}
      </div>
    );
  }


  return (
    <div
      style={
        styles.wrap
      }
    >
      <style>{mobileCss}</style>
      <div
        className="g365-team-name-edit-row"
        style={
          styles.editRow
        }
      >
        <input
          type="text"
          value={
            draftName
          }
          maxLength={
            40
          }
          disabled={
            saving
          }
          onChange={(
            event
          ) =>
            setDraftName(
              event.target.value
            )
          }
          onKeyDown={(
            event
          ) => {
            if (
              event.key ===
              "Enter"
            ) {
              event.preventDefault();

              void saveTeamName();
            }

            if (
              event.key ===
              "Escape"
            ) {
              event.preventDefault();

              cancelEdit();
            }
          }}
          autoFocus
          aria-label="Team name"
          className="g365-team-name-input"
          style={
            styles.input
          }
        />


        <button
          type="button"
          onClick={
            () =>
              void saveTeamName()
          }
          disabled={
            saving
          }
          style={{
            ...styles.saveButton,

            ...(saving
              ? styles.disabled
              : {}),
          }}
        >
          {saving
            ? "SAVING..."
            : "SAVE"}
        </button>


        <button
          type="button"
          onClick={
            cancelEdit
          }
          disabled={
            saving
          }
          style={{
            ...styles.cancelButton,

            ...(saving
              ? styles.disabled
              : {}),
          }}
        >
          CANCEL
        </button>
      </div>


      <div
        style={
          styles.helperRow
        }
      >
        <span>
          {draftName.length}/40
        </span>

        {message ? (
          <span
            style={
              isError
                ? styles.error
                : styles.success
            }
          >
            {message}
          </span>
        ) : null}
      </div>
    </div>
  );
}



const mobileCss = `
@media (max-width: 620px) {
  .g365-team-name-wrap {
    min-width: 0 !important;
    width: 100% !important;
  }

  .g365-team-name-title-row {
    align-items: flex-start !important;
  }

  .g365-team-name-title-row h1 {
    max-width: 100% !important;
    overflow-wrap: anywhere !important;
    font-size: 30px !important;
  }

  .g365-team-name-edit-row {
    display: grid !important;
    grid-template-columns: 1fr 1fr !important;
    width: 100% !important;
  }

  .g365-team-name-input {
    grid-column: 1 / -1 !important;
    min-width: 0 !important;
    width: 100% !important;
    max-width: none !important;
    font-size: 16px !important;
  }

  .g365-team-name-edit-row button {
    width: 100% !important;
    min-height: 44px !important;
  }
}

@media (max-width: 390px) {
  .g365-team-name-edit-row {
    grid-template-columns: 1fr !important;
  }

  .g365-team-name-input {
    grid-column: auto !important;
  }
}
`;

const styles:
  Record<
    string,
    React.CSSProperties
  > = {
    wrap: {
      marginTop:
        "7px",

      display:
        "grid",

      gap:
        "7px",
    },


    titleRow: {
      display:
        "flex",

      alignItems:
        "center",

      gap:
        "10px",

      flexWrap:
        "wrap",
    },


    title: {
      margin:
        0,

      color:
        "#ffffff",

      fontSize:
        "36px",

      lineHeight:
        1.08,
    },


    editButton: {
      minHeight:
        "31px",

      padding:
        "0 10px",

      border:
        "1px solid rgba(255,122,24,.32)",

      borderRadius:
        "7px",

      background:
        "rgba(255,100,20,.07)",

      color:
        "#ff8120",

      fontSize:
        "8px",

      fontWeight:
        950,

      letterSpacing:
        ".05em",

      cursor:
        "pointer",
    },


    editRow: {
      display:
        "flex",

      alignItems:
        "center",

      gap:
        "8px",

      flexWrap:
        "wrap",
    },


    input: {
      minWidth:
        "260px",

      maxWidth:
        "520px",

      minHeight:
        "44px",

      padding:
        "0 13px",

      border:
        "1px solid rgba(255,122,24,.38)",

      borderRadius:
        "8px",

      outline:
        "none",

      background:
        "#0d0d0f",

      color:
        "#ffffff",

      fontSize:
        "20px",

      fontWeight:
        900,
    },


    saveButton: {
      minHeight:
        "42px",

      padding:
        "0 15px",

      border:
        "1px solid rgba(255,100,15,.45)",

      borderRadius:
        "8px",

      background:
        "linear-gradient(135deg,#cf1616,#ff5100,#ff8500)",

      color:
        "#ffffff",

      fontSize:
        "9px",

      fontWeight:
        950,

      cursor:
        "pointer",
    },


    cancelButton: {
      minHeight:
        "42px",

      padding:
        "0 15px",

      border:
        "1px solid rgba(255,255,255,.09)",

      borderRadius:
        "8px",

      background:
        "rgba(255,255,255,.035)",

      color:
        "#abb0b8",

      fontSize:
        "9px",

      fontWeight:
        950,

      cursor:
        "pointer",
    },


    helperRow: {
      display:
        "flex",

      alignItems:
        "center",

      gap:
        "12px",

      color:
        "#6f7680",

      fontSize:
        "9px",
    },


    success: {
      color:
        "#42d982",

      fontSize:
        "10px",

      fontWeight:
        800,
    },


    error: {
      color:
        "#ff6868",

      fontSize:
        "10px",

      fontWeight:
        800,
    },


    disabled: {
      opacity:
        .55,

      cursor:
        "not-allowed",
    },
  };
