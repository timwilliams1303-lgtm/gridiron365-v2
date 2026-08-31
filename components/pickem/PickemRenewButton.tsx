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


type RenewResponse = {
  success?: boolean;
  alreadyRenewed?: boolean;
  leagueId?: string;
  season?: number;
  error?: string;
};


export default function PickemRenewButton({
  leagueId,
  nextSeason,
}: {
  leagueId: string;
  nextSeason: number;
}) {
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
      working
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        `Renew this G365 Pick'em league for ${nextSeason}? Members, owners, team names, league rules, scoring, and missing-pick policy will carry forward. ${nextSeason} picks, standings, games, and G365 lines will start fresh. Previously earned badges remain permanently visible in the continuous Trophy Case.`
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
        data:
          sessionData,
      } =
        await supabase.auth
          .getSession();

      const token =
        sessionData
          .session
          ?.access_token;

      if (
        !token
      ) {
        throw new Error(
          "Your login session is missing."
        );
      }

      const response =
        await fetch(
          `/api/leagues/${leagueId}/pickem/renew`,
          {
            method:
              "POST",

            headers: {
              Authorization:
                `Bearer ${token}`,
            },
          }
        );

      const result =
        (
          await response.json()
        ) as RenewResponse;

      if (
        !response.ok ||
        !result.success ||
        !result.leagueId
      ) {
        throw new Error(
          result.error ??
            "Pick'em league renewal failed."
        );
      }

      setMessage(
        result.alreadyRenewed
          ? `${nextSeason} already exists. Opening it now...`
          : `${nextSeason} league created. Preparing the new season now...`
      );

      /*
       * Prepare the new season immediately.
       * Failure here does NOT undo renewal because the global Pick'em
       * lifecycle cron will automatically retry.
       */
      try {
        await fetch(
          "/api/pickem/commissioner-sync",
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
                leagueId:
                  result.leagueId,
              }),
          }
        );
      } catch {
        // The automatic lifecycle cron remains the fallback.
      }

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
          : "Pick'em league renewal failed."
      );

      setWorking(
        false
      );
    }
  }


  return (
    <div
      style={{
        display:
          "grid",
        gap:
          9,
      }}
    >
      <button
        type="button"
        onClick={() =>
          void renew()
        }
        disabled={
          working
        }
        style={{
          minHeight:
            46,
          width:
            "fit-content",
          border:
            "1px solid #e85c1b",
          borderRadius:
            12,
          padding:
            "0 18px",
          background:
            working
              ? "#242424"
              : "linear-gradient(90deg,#a61919,#f0631d)",
          color:
            working
              ? "#777"
              : "#fff",
          fontWeight:
            950,
          fontSize:
            11,
          letterSpacing:
            0.5,
          cursor:
            working
              ? "not-allowed"
              : "pointer",
        }}
      >
        {working
          ? "RENEWING..."
          : `RENEW FOR ${nextSeason}`}
      </button>

      {message ? (
        <p
          style={{
            margin:
              0,
            color:
              isError
                ? "#ff999c"
                : "#9ee8b4",
            fontSize:
              11,
            lineHeight:
              1.5,
          }}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
