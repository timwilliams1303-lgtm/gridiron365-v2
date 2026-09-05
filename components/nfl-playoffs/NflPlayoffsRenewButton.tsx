"use client";

import {
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import {
  createSupabaseBrowserClient,
} from "@/lib/supabase/browser";


type Props = {
  leagueId: string;

  nextSeason: number;

  disabled?: boolean;
};


type RenewalResult = {
  success?:
    boolean;

  alreadyRenewed?:
    boolean;

  leagueId?:
    string;

  season?:
    number;
};


export default function NflPlayoffsRenewButton({
  leagueId,
  nextSeason,
  disabled = false,
}: Props) {
  const router =
    useRouter();


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


  async function renew() {
    if (
      working ||
      disabled
    ) {
      return;
    }


    const confirmed =
      window.confirm(
        `Renew this NFL Playoffs league for ${nextSeason}? Members, team names, owners, lineup settings, salary settings and scoring will carry forward. The new postseason will start with fresh rounds, lineups, salaries, scores and standings.`
      );


    if (
      !confirmed
    ) {
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
      const supabase =
        createSupabaseBrowserClient();


      const {
        data,
        error,
      } =
        await supabase.rpc(
          "renew_nfl_playoff_league",
          {
            p_league_id:
              leagueId,
          }
        );


      if (
        error
      ) {
        throw new Error(
          error.message
        );
      }


      const result =
        data as
          RenewalResult |
          null;


      if (
        !result?.success ||
        !result.leagueId
      ) {
        throw new Error(
          "NFL Playoffs league renewal did not return a new league."
        );
      }


      setMessage(
        result.alreadyRenewed
          ? `${nextSeason} league already exists. Opening it now...`
          : `${nextSeason} NFL Playoffs league created. Opening it now...`
      );


      router.push(
        `/league/${result.leagueId}`
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
          : "NFL Playoffs league renewal failed."
      );


      setWorking(
        false
      );
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
          disabled ||
          working
        }
        onClick={() =>
          void renew()
        }
        style={{
          ...styles.button,

          ...(disabled ||
          working
            ? styles.disabled
            : {}),
        }}
      >
        {working
          ? "RENEWING..."
          : `RENEW FOR ${nextSeason}`}
      </button>


      {disabled ? (
        <p
          style={
            styles.help
          }
        >
          Renewal unlocks after the Super Bowl round and the current NFL Playoffs league are officially finalized.
        </p>
      ) : null}


      {message ? (
        <p
          style={{
            ...styles.message,

            color:
              isError
                ? "#ff9b9f"
                : "#9ee8b4",
          }}
        >
          {message}
        </p>
      ) : null}
    </div>
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
        8,
    },


    button: {
      width:
        "fit-content",

      minHeight:
        46,

      padding:
        "0 18px",

      border:
        "1px solid #ff6c28",

      borderRadius:
        11,

      background:
        "linear-gradient(90deg,#a71919,#f0641f)",

      color:
        "#fff",

      cursor:
        "pointer",

      fontSize:
        11,

      fontWeight:
        950,

      letterSpacing:
        ".04em",
    },


    disabled: {
      border:
        "1px solid #333",

      background:
        "#222",

      color:
        "#6f6f74",

      cursor:
        "not-allowed",
    },


    help: {
      margin:
        0,

      maxWidth:
        600,

      color:
        "#858b97",

      fontSize:
        11,

      lineHeight:
        1.5,
    },


    message: {
      margin:
        0,

      fontSize:
        11,

      lineHeight:
        1.5,
    },
  };