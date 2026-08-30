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

export default function SeasonLongRenewButton({
  leagueId,
  nextSeason,
  disabled = false,
}: {
  leagueId: string;
  nextSeason: number;
  disabled?: boolean;
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

  async function renew() {
    if (
      working ||
      disabled
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        `Renew this league for ${nextSeason}? League settings, scoring, members and team names will carry forward. Weekly scores, lineups, standings, salaries and trophies will start fresh.`
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
          `/api/leagues/${leagueId}/season-long/renew`,
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
        await response.json();

      if (
        !response.ok ||
        !result.success
      ) {
        throw new Error(
          result.error ??
            "League renewal failed."
        );
      }

      setMessage(
        result.alreadyRenewed
          ? `${nextSeason} league already exists. Opening it now...`
          : `${nextSeason} league created. Opening it now...`
      );

      router.push(
        `/league/${result.leagueId}`
      );

      router.refresh();
    } catch (
      error
    ) {
      setMessage(
        error instanceof
          Error
          ? error.message
          : "League renewal failed."
      );

      setWorking(
        false
      );
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() =>
          void renew()
        }
        disabled={
          disabled ||
          working
        }
        style={{
          minHeight:
            46,

          border:
            "1px solid #e85c1b",

          borderRadius:
            12,

          padding:
            "0 18px",

          background:
            disabled
              ? "#242424"
              : "linear-gradient(90deg,#a61919,#f0631d)",

          color:
            disabled
              ? "#777"
              : "#fff",

          fontWeight:
            950,

          fontSize:
            11,

          letterSpacing:
            0.5,

          cursor:
            disabled
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
              "8px 0 0",

            color:
              "#b8b8b8",

            fontSize:
              11,
          }}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
