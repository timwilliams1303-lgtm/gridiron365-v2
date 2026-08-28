"use client";

import {
  useEffect,
  useRef,
} from "react";

import {
  usePathname,
  useRouter,
} from "next/navigation";

import {
  createBrowserClient,
} from "@supabase/ssr";


type Props = {
  leagueId: string;
};


/*
 * ============================================================
 * TRADITIONAL LIVE REFRESH
 * ============================================================
 *
 * IMPORTANT:
 *
 * This component NEVER synchronizes ESPN.
 *
 * ESPN synchronization and fantasy scoring are handled by the
 * centralized NFL worker.
 *
 * This component only listens for league-specific fantasy
 * database changes and refreshes the server-rendered page.
 */
export default function TraditionalLiveRefresh({
  leagueId,
}: Props) {
  const pathname =
    usePathname();

  const router =
    useRouter();


  const debounceTimerRef =
    useRef<
      ReturnType<
        typeof setTimeout
      > | null
    >(null);


  const cooldownTimerRef =
    useRef<
      ReturnType<
        typeof setTimeout
      > | null
    >(null);


  const refreshBlockedRef =
    useRef(false);


  const isMatchupsPage =
    pathname ===
      `/league/${leagueId}/matchups` ||
    pathname.startsWith(
      `/league/${leagueId}/matchups/`
    );


  useEffect(
    () => {
      if (
        !isMatchupsPage
      ) {
        return;
      }


      const supabaseUrl =
        process.env
          .NEXT_PUBLIC_SUPABASE_URL;

      const supabaseKey =
        process.env
          .NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
        process.env
          .NEXT_PUBLIC_SUPABASE_ANON_KEY;


      if (
        !supabaseUrl ||
        !supabaseKey
      ) {
        console.error(
          "Traditional Realtime could not start because Supabase environment variables are missing."
        );

        return;
      }


      let cancelled =
        false;


      const supabase =
        createBrowserClient(
          supabaseUrl,
          supabaseKey
        );


      /*
       * ======================================================
       * SAFE REFRESH
       * ======================================================
       *
       * Multiple fantasy rows may update from one scoring play.
       *
       * We debounce the changes and then impose a short
       * cooldown so router.refresh() cannot run continuously.
       */
      function performRefresh() {
        if (
          cancelled ||
          refreshBlockedRef.current ||
          document.visibilityState ===
            "hidden"
        ) {
          return;
        }


        refreshBlockedRef.current =
          true;


        router.refresh();


        cooldownTimerRef.current =
          setTimeout(
            () => {
              refreshBlockedRef.current =
                false;

              cooldownTimerRef.current =
                null;
            },
            1500
          );
      }


      function scheduleRefresh() {
        if (
          cancelled ||
          document.visibilityState ===
            "hidden"
        ) {
          return;
        }


        if (
          debounceTimerRef.current
        ) {
          clearTimeout(
            debounceTimerRef.current
          );
        }


        debounceTimerRef.current =
          setTimeout(
            () => {
              debounceTimerRef.current =
                null;

              performRefresh();
            },
            400
          );
      }


      /*
       * ======================================================
       * LEAGUE-SCOPED REALTIME
       * ======================================================
       *
       * IMPORTANT:
       *
       * We intentionally DO NOT subscribe globally to
       * nfl_game_plays here.
       *
       * That table contains every NFL game on the platform.
       * A global subscription can generate a refresh storm.
       *
       * We will add NFL play updates back later, scoped only
       * to the NFL games relevant to this matchup.
       */


      const channel =
        supabase
          .channel(
            `traditional-live-${leagueId}`
          )


          /*
           * MATCHUP TOTALS
           */
          .on(
            "postgres_changes",
            {
              event:
                "*",

              schema:
                "public",

              table:
                "traditional_matchups",

              filter:
                `league_id=eq.${leagueId}`,
            },
            () => {
              scheduleRefresh();
            }
          )


          /*
           * PLAYER FANTASY POINTS / LINEUP STATE
           */
          .on(
            "postgres_changes",
            {
              event:
                "*",

              schema:
                "public",

              table:
                "weekly_lineups",

              filter:
                `league_id=eq.${leagueId}`,
            },
            () => {
              scheduleRefresh();
            }
          )


          .subscribe(
            (
              status
            ) => {
              if (
                status ===
                  "SUBSCRIBED"
              ) {
                console.log(
                  "Traditional live Realtime connected:",
                  leagueId
                );
              }


              if (
                status ===
                  "CHANNEL_ERROR"
              ) {
                console.error(
                  "Traditional live Realtime channel error:",
                  leagueId
                );
              }


              if (
                status ===
                  "TIMED_OUT"
              ) {
                console.error(
                  "Traditional live Realtime connection timed out:",
                  leagueId
                );
              }


              if (
                status ===
                  "CLOSED"
              ) {
                console.warn(
                  "Traditional live Realtime channel closed:",
                  leagueId
                );
              }
            }
          );


      /*
       * ======================================================
       * CATCH-UP EVENTS
       * ======================================================
       *
       * When the user returns to the browser/tab, refresh once
       * to catch anything that occurred while it was inactive.
       */


      function handleVisibilityChange() {
        if (
          document.visibilityState ===
            "visible"
        ) {
          scheduleRefresh();
        }
      }


      function handleFocus() {
        scheduleRefresh();
      }


      function handleOnline() {
        scheduleRefresh();
      }


      document.addEventListener(
        "visibilitychange",
        handleVisibilityChange
      );

      window.addEventListener(
        "focus",
        handleFocus
      );

      window.addEventListener(
        "online",
        handleOnline
      );


      /*
       * ======================================================
       * CLEANUP
       * ======================================================
       */
      return () => {
        cancelled =
          true;


        if (
          debounceTimerRef.current
        ) {
          clearTimeout(
            debounceTimerRef.current
          );

          debounceTimerRef.current =
            null;
        }


        if (
          cooldownTimerRef.current
        ) {
          clearTimeout(
            cooldownTimerRef.current
          );

          cooldownTimerRef.current =
            null;
        }


        refreshBlockedRef.current =
          false;


        document.removeEventListener(
          "visibilitychange",
          handleVisibilityChange
        );

        window.removeEventListener(
          "focus",
          handleFocus
        );

        window.removeEventListener(
          "online",
          handleOnline
        );


        void supabase.removeChannel(
          channel
        );
      };
    },
    [
      isMatchupsPage,
      leagueId,
      router,
    ]
  );


  return null;
}