"use client";

import {
  useEffect,
  useRef,
} from "react";

import {
  usePathname,
  useRouter,
} from "next/navigation";


type Props = {
  leagueId: string;

  intervalMs?: number;
};


export default function TraditionalLiveRefresh({
  leagueId,

  /*
   * Live NFL data is checked every 5 seconds.
   *
   * This keeps:
   * - box scores
   * - fantasy scores
   * - play-by-play
   * - possession
   * - quarter / clock
   * - red zone
   * - recent scoring plays
   *
   * moving automatically without requiring the
   * user to manually refresh the browser.
   */
  intervalMs = 5000,
}: Props) {
  const pathname =
    usePathname();

  const router =
    useRouter();

  /*
   * Prevent overlapping refresh requests.
   *
   * If one ESPN/database synchronization takes
   * longer than 5 seconds, we do not start another
   * copy while the first one is still running.
   */
  const runningRef =
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


      let cancelled =
        false;


      async function refreshLiveData() {
        if (
          cancelled ||
          runningRef.current ||
          document.visibilityState ===
            "hidden"
        ) {
          return;
        }


        runningRef.current =
          true;


        try {
          /*
           * This server route is responsible for:
           *
           * 1. Finding current NFL games.
           * 2. Synchronizing ESPN boxscores.
           * 3. Synchronizing ESPN play-by-play.
           * 4. Refreshing fantasy scoring.
           * 5. Refreshing Traditional matchup totals.
           */
          const response =
            await fetch(
              `/api/league/${leagueId}/matchups/live-refresh`,
              {
                method:
                  "POST",

                cache:
                  "no-store",

                headers: {
                  "Content-Type":
                    "application/json",
                },
              }
            );


          if (
            cancelled
          ) {
            return;
          }


          if (
            !response.ok
          ) {
            const text =
              await response.text();

            console.error(
              "Traditional live matchup refresh failed:",
              response.status,
              text
            );

            return;
          }


          /*
           * The server has now written the newest ESPN
           * state into Supabase.
           *
           * router.refresh() re-renders the server
           * matchup page using the newest database rows.
           *
           * This is NOT a full browser reload.
           */
          router.refresh();
        } catch (
          error
        ) {
          if (
            !cancelled
          ) {
            console.error(
              "Traditional live matchup refresh failed:",
              error
            );
          }
        } finally {
          runningRef.current =
            false;
        }
      }


      /*
       * =====================================================
       * IMMEDIATE FIRST REFRESH
       * =====================================================
       *
       * Do not wait 15 seconds or require the user to
       * press Refresh.
       */
      void refreshLiveData();


      /*
       * =====================================================
       * AUTOMATIC LIVE LOOP
       * =====================================================
       */
      const interval =
        window.setInterval(
          () => {
            void refreshLiveData();
          },
          intervalMs
        );


      /*
       * Immediately catch up whenever the user returns
       * to the tab.
       */
      function handleVisibilityChange() {
        if (
          document.visibilityState ===
            "visible"
        ) {
          void refreshLiveData();
        }
      }


      /*
       * Also catch up immediately when the browser window
       * receives focus.
       */
      function handleFocus() {
        void refreshLiveData();
      }


      /*
       * If internet connectivity temporarily drops,
       * immediately synchronize when connectivity returns.
       */
      function handleOnline() {
        void refreshLiveData();
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


      return () => {
        cancelled =
          true;


        window.clearInterval(
          interval
        );


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
      };
    },
    [
      intervalMs,
      isMatchupsPage,
      leagueId,
      router,
    ]
  );


  return null;
}