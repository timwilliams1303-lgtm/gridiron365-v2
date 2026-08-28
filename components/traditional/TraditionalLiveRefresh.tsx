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
 * IMPORTANT ARCHITECTURE:
 *
 * ESPN synchronization is NOT performed here.
 *
 * Central NFL Worker
 *      ↓
 * ESPN boxscore + play-by-play
 *      ↓
 * Supabase
 *      ↓
 * Traditional scoring
 *      ↓
 * Supabase Realtime
 *      ↓
 * This component
 *      ↓
 * router.refresh()
 *
 * The browser therefore reads authoritative data instead of
 * independently synchronizing ESPN.
 */
export default function TraditionalLiveRefresh({
  leagueId,
}: Props) {
  const pathname =
    usePathname();

  const router =
    useRouter();


  /*
   * Multiple database rows can change almost simultaneously
   * after one NFL play.
   *
   * Example:
   *
   * nfl_game_plays
   * weekly_lineups
   * traditional_matchups
   *
   * We do not want three immediate router.refresh() calls.
   * Instead, changes are grouped into one refresh.
   */
  const refreshTimerRef =
    useRef<
      ReturnType<
        typeof setTimeout
      > | null
    >(null);


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
       * REFRESH DEBOUNCE
       * ======================================================
       *
       * A single NFL play can cause several database writes.
       * Wait briefly and combine them into one server refresh.
       */
      function scheduleRefresh() {
        if (
          cancelled ||
          document.visibilityState ===
            "hidden"
        ) {
          return;
        }


        if (
          refreshTimerRef.current
        ) {
          clearTimeout(
            refreshTimerRef.current
          );
        }


        refreshTimerRef.current =
          setTimeout(
            () => {
              if (
                cancelled
              ) {
                return;
              }


              router.refresh();


              refreshTimerRef.current =
                null;
            },
            300
          );
      }


      /*
       * ======================================================
       * REALTIME CHANNEL
       * ======================================================
       */
      const channel =
        supabase
          .channel(
            `traditional-live-${leagueId}`
          )


          /*
           * --------------------------------------------------
           * MATCHUP SCORE CHANGES
           * --------------------------------------------------
           *
           * This is league-scoped so a change in another
           * Traditional league does not refresh this browser.
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
           * --------------------------------------------------
           * PLAYER / LINEUP SCORE CHANGES
           * --------------------------------------------------
           *
           * Fantasy points and player score state are stored
           * in weekly_lineups.
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


          /*
           * --------------------------------------------------
           * NFL PLAY-BY-PLAY CHANGES
           * --------------------------------------------------
           *
           * nfl_game_plays is global NFL data and does not
           * contain league_id.
           *
           * A new play can change:
           *
           * - possession
           * - quarter
           * - clock
           * - down/distance
           * - red zone
           * - ON FIELD / OFF FIELD
           * - last scoring play
           * - recent scoring plays
           *
           * The server matchup page decides which NFL games
           * are actually relevant to this matchup.
           */
          .on(
            "postgres_changes",
            {
              event:
                "*",

              schema:
                "public",

              table:
                "nfl_game_plays",
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
            }
          );


      /*
       * ======================================================
       * TAB / WINDOW CATCH-UP
       * ======================================================
       *
       * We intentionally do not refresh hidden tabs for every
       * NFL event.
       *
       * When the user comes back, immediately read the latest
       * authoritative state.
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
       * One initial refresh makes sure the page catches any
       * database change that occurred between the original
       * server render and Realtime subscription establishment.
       */
      scheduleRefresh();


      return () => {
        cancelled =
          true;


        if (
          refreshTimerRef.current
        ) {
          clearTimeout(
            refreshTimerRef.current
          );

          refreshTimerRef.current =
            null;
        }


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