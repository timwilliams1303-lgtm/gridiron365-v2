"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";


type RenewalReadiness = {
  success?: boolean;
  ready?: boolean;
  reason?: string;
  leagueId?: string;
  isCommissioner?: boolean;
  currentSeason?: number;
  nextSeason?: number;
  competitionFormat?:
    | "total_points"
    | "head_to_head";
  regularSeasonWeeks?: number;
  playoffsEnabled?: boolean;
  activeTeams?: number;
  seasonComplete?: boolean;
  finalWeekTeams?: number;
  regularSeasonMatchups?: number;
  finalRegularSeasonMatchups?: number;
  playoffStatus?: string | null;
  championFantasyTeamId?: number | null;
  nextSeasonExistingRows?: number;
};


type CommissionerResponse = {
  success?: boolean;
  error?: string;
  renewalReadiness?:
    RenewalReadiness |
    null;
};


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
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    message,
    setMessage,
  ] =
    useState("");

  const [
    readiness,
    setReadiness,
  ] =
    useState<RenewalReadiness | null>(
      null
    );


  const loadReadiness =
    useCallback(
      async () => {
        setLoading(
          true
        );

        try {
          const response =
            await fetch(
              `/api/leagues/${leagueId}/season-long/commissioner`,
              {
                method:
                  "GET",
                cache:
                  "no-store",
              }
            );

          const result =
            (
              await response.json()
            ) as CommissionerResponse;

          if (
            !response.ok ||
            !result.success
          ) {
            throw new Error(
              result.error ??
                "Unable to check season renewal status."
            );
          }

          setReadiness(
            result.renewalReadiness ??
              null
          );

          setMessage(
            ""
          );
        } catch (
          error
        ) {
          setReadiness(
            null
          );

          setMessage(
            error instanceof Error
              ? error.message
              : "Unable to check season renewal status."
          );
        } finally {
          setLoading(
            false
          );
        }
      },
      [leagueId]
    );


  useEffect(
    () => {
      void loadReadiness();
    },
    [loadReadiness]
  );


  async function renew() {
    if (
      working ||
      disabled ||
      loading ||
      readiness?.ready !==
        true
    ) {
      return;
    }


    const currentSeason =
      readiness.currentSeason ??
      nextSeason - 1;

    const resolvedNextSeason =
      readiness.nextSeason ??
      nextSeason;


    const confirmed =
      window.confirm(
        `Renew this league for ${resolvedNextSeason}?\n\n` +
          `This advances the same Season-Long league from ${currentSeason} to ${resolvedNextSeason}. ` +
          `League settings, scoring, teams, owners and franchise identities are preserved.\n\n` +
          `The completed ${currentSeason} weekly results, standings, matchups, playoff results, badges, season honors and Trophy Case history remain preserved under ${currentSeason}.`
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
      const response =
        await fetch(
          `/api/leagues/${leagueId}/season-long/commissioner`,
          {
            method:
              "POST",
            headers: {
              "content-type":
                "application/json",
            },
            body:
              JSON.stringify({
                action:
                  "renew-season",
                expectedCurrentSeason:
                  currentSeason,
              }),
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
        `${resolvedNextSeason} season is ready. Opening the renewed league...`
      );

      /*
       * The summer rollover advances this SAME league record in place.
       * There is no separate next-season league ID to navigate to.
       */
      router.push(
        `/league/${leagueId}`
      );

      router.refresh();
    } catch (
      error
    ) {
      setMessage(
        error instanceof Error
          ? error.message
          : "League renewal failed."
      );

      setWorking(
        false
      );

      /*
       * Re-check readiness after a failed attempt. This catches cases
       * where another tab/session already completed the rollover or a
       * season-completion condition changed between load and submit.
       */
      void loadReadiness();
    }
  }


  const ready =
    readiness?.ready ===
    true;

  const buttonDisabled =
    disabled ||
    working ||
    loading ||
    !ready;

  const displayedNextSeason =
    readiness?.nextSeason ??
    nextSeason;


  return (
    <div
      className="g365-season-long-renew"
    >
      <style>{`
        @media (max-width: 760px) {
          .g365-season-long-renew {
            width: 100%;
            min-width: 0;
          }

          .g365-season-long-renew button {
            width: 100% !important;
          }

          .g365-season-long-renew p {
            overflow-wrap: anywhere;
          }
        }
      `}</style>


      <button
        type="button"
        onClick={() =>
          void renew()
        }
        disabled={
          buttonDisabled
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
            buttonDisabled
              ? "#242424"
              : "linear-gradient(90deg,#a61919,#f0631d)",

          color:
            buttonDisabled
              ? "#777"
              : "#fff",

          fontWeight:
            950,

          fontSize:
            11,

          letterSpacing:
            0.5,

          cursor:
            buttonDisabled
              ? "not-allowed"
              : "pointer",
        }}
      >
        {working
          ? "RENEWING..."
          : loading
            ? "CHECKING RENEWAL..."
            : `RENEW FOR ${displayedNextSeason}`}
      </button>


      {!loading &&
      readiness ? (
        <p
          style={{
            margin:
              "8px 0 0",

            color:
              ready
                ? "#86efac"
                : "#b8b8b8",

            fontSize:
              11,

            lineHeight:
              1.5,
          }}
        >
          {ready
            ? `Season ${readiness.currentSeason ?? displayedNextSeason - 1} is complete. This league is ready to renew for ${displayedNextSeason}.`
            : readiness.reason ??
              "This league is not ready to renew yet."}
        </p>
      ) : null}


      {message ? (
        <p
          style={{
            margin:
              "8px 0 0",

            color:
              "#b8b8b8",

            fontSize:
              11,

            lineHeight:
              1.5,
          }}
        >
          {message}
        </p>
      ) : null}


      <button
        type="button"
        onClick={() =>
          void loadReadiness()
        }
        disabled={
          working ||
          loading
        }
        style={{
          marginTop:
            8,

          border:
            0,

          background:
            "transparent",

          color:
            "#ff8a4c",

          padding:
            0,

          fontSize:
            10,

          fontWeight:
            850,

          cursor:
            working ||
            loading
              ? "default"
              : "pointer",
        }}
      >
        REFRESH RENEWAL STATUS
      </button>
    </div>
  );
}