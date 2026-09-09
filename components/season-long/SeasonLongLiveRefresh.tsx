"use client";

import {
  useEffect,
  useRef,
} from "react";

import {
  useParams,
  useRouter,
} from "next/navigation";

import {
  createBrowserClient,
} from "@supabase/ssr";


type Props = {
  enabled: boolean;
  live: boolean;
};


export default function SeasonLongLiveRefresh({
  enabled,
  live,
}: Props) {
  const router =
    useRouter();

  const params =
    useParams<{
      leagueId?: string;
    }>();

  const leagueId =
    typeof params?.leagueId ===
      "string"
      ? params.leagueId
      : null;


  const debounceTimerRef =
    useRef<
      number | null
    >(null);

  const cooldownTimerRef =
    useRef<
      number | null
    >(null);

  const refreshBlockedRef =
    useRef(false);

  const pendingRefreshRef =
    useRef(false);


  useEffect(
    () => {
      if (!enabled) {
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


      let cancelled =
        false;


      function performRefresh() {
        if (
          cancelled ||
          document.visibilityState !==
            "visible"
        ) {
          return;
        }


        if (
          refreshBlockedRef.current
        ) {
          pendingRefreshRef.current =
            true;

          return;
        }


        refreshBlockedRef.current =
          true;

        pendingRefreshRef.current =
          false;

        router.refresh();


        cooldownTimerRef.current =
          window.setTimeout(
            () => {
              if (cancelled) {
                return;
              }

              refreshBlockedRef.current =
                false;

              cooldownTimerRef.current =
                null;


              if (
                pendingRefreshRef.current
              ) {
                pendingRefreshRef.current =
                  false;

                performRefresh();
              }
            },
            1_200
          );
      }


      function scheduleRefresh() {
        if (
          cancelled ||
          document.visibilityState !==
            "visible"
        ) {
          return;
        }


        if (
          refreshBlockedRef.current
        ) {
          pendingRefreshRef.current =
            true;

          return;
        }


        if (
          debounceTimerRef.current !==
          null
        ) {
          window.clearTimeout(
            debounceTimerRef.current
          );
        }


        debounceTimerRef.current =
          window.setTimeout(
            () => {
              debounceTimerRef.current =
                null;

              performRefresh();
            },
            250
          );
      }


      /*
       * =========================================================
       * SUPABASE REALTIME — PRIMARY UPDATE PATH
       * =========================================================
       *
       * The browser never contacts ESPN here.
       *
       * The centralized live worker writes authoritative DB state.
       * These database changes wake the server component immediately.
       *
       * useParams() supplies leagueId so existing call sites do not
       * need a new prop and older SeasonLongLiveRefresh mounts continue
       * compiling unchanged.
       * =========================================================
       */

      let channel:
        ReturnType<
          ReturnType<
            typeof createBrowserClient
          >["channel"]
        > | null =
        null;


      if (
        supabaseUrl &&
        supabaseKey &&
        leagueId
      ) {
        const supabase =
          createBrowserClient(
            supabaseUrl,
            supabaseKey
          );


        channel =
          supabase
            .channel(
              `season-long-live-refresh-${leagueId}`
            )

            /*
             * Direct weekly team score changes.
             */
            .on(
              "postgres_changes",
              {
                event: "*",
                schema: "public",
                table:
                  "season_long_weekly_scores",
                filter:
                  `league_id=eq.${leagueId}`,
              },
              scheduleRefresh
            )

            /*
             * Total Points live standings.
             */
            .on(
              "postgres_changes",
              {
                event: "*",
                schema: "public",
                table:
                  "season_long_standings",
                filter:
                  `league_id=eq.${leagueId}`,
              },
              scheduleRefresh
            )

            /*
             * Head-to-Head standings changes.
             */
            .on(
              "postgres_changes",
              {
                event: "*",
                schema: "public",
                table:
                  "season_long_h2h_standings",
                filter:
                  `league_id=eq.${leagueId}`,
              },
              scheduleRefresh
            )

            /*
             * Regular-season and playoff matchup score changes.
             */
            .on(
              "postgres_changes",
              {
                event: "*",
                schema: "public",
                table:
                  "season_long_matchups",
                filter:
                  `league_id=eq.${leagueId}`,
              },
              scheduleRefresh
            )

            /*
             * Player kickoff locks / lineup edits.
             */
            .on(
              "postgres_changes",
              {
                event: "*",
                schema: "public",
                table:
                  "season_long_weekly_lineups",
                filter:
                  `league_id=eq.${leagueId}`,
              },
              scheduleRefresh
            )

            /*
             * Entry state changes.
             */
            .on(
              "postgres_changes",
              {
                event: "*",
                schema: "public",
                table:
                  "season_long_weekly_entries",
                filter:
                  `league_id=eq.${leagueId}`,
              },
              scheduleRefresh
            )

            .subscribe(
              (
                status
              ) => {
                if (
                  status ===
                    "CHANNEL_ERROR" ||
                  status ===
                    "TIMED_OUT"
                ) {
                  console.error(
                    "Season-Long live refresh Realtime channel issue:",
                    status,
                    leagueId
                  );
                }
              }
            );


        /*
         * Keep the client around only through the channel cleanup
         * closure below.
         */
        const realtimeClient =
          supabase;


        /*
         * =========================================================
         * FALLBACK POLLING
         * =========================================================
         *
         * Realtime is primary.
         *
         * LIVE:
         *   5 seconds
         *
         * NOT LIVE:
         *   10 seconds
         *
         * This covers missed Realtime events, temporary disconnects,
         * and pages whose server data depends on another table.
         * =========================================================
         */

        const intervalMs =
          live
            ? 5_000
            : 10_000;


        const timer =
          window.setInterval(
            performRefresh,
            intervalMs
          );


        const handleVisibilityChange =
          () => {
            if (
              document.visibilityState ===
                "visible"
            ) {
              scheduleRefresh();
            }
          };


        const handleFocus =
          () => {
            scheduleRefresh();
          };


        const handleOnline =
          () => {
            scheduleRefresh();
          };


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


          if (
            debounceTimerRef.current !==
            null
          ) {
            window.clearTimeout(
              debounceTimerRef.current
            );

            debounceTimerRef.current =
              null;
          }


          if (
            cooldownTimerRef.current !==
            null
          ) {
            window.clearTimeout(
              cooldownTimerRef.current
            );

            cooldownTimerRef.current =
              null;
          }


          window.clearInterval(
            timer
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


          if (channel) {
            void realtimeClient
              .removeChannel(
                channel
              );
          }
        };
      }


      /*
       * Supabase environment variables or leagueId were unavailable.
       * Keep the same fast polling fallback instead of leaving the
       * page stale.
       */
      const intervalMs =
        live
          ? 5_000
          : 10_000;


      const timer =
        window.setInterval(
          performRefresh,
          intervalMs
        );


      const handleVisibilityChange =
        () => {
          if (
            document.visibilityState ===
              "visible"
          ) {
            scheduleRefresh();
          }
        };


      const handleFocus =
        () => {
          scheduleRefresh();
        };


      const handleOnline =
        () => {
          scheduleRefresh();
        };


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


        if (
          debounceTimerRef.current !==
          null
        ) {
          window.clearTimeout(
            debounceTimerRef.current
          );

          debounceTimerRef.current =
            null;
        }


        if (
          cooldownTimerRef.current !==
          null
        ) {
          window.clearTimeout(
            cooldownTimerRef.current
          );

          cooldownTimerRef.current =
            null;
        }


        window.clearInterval(
          timer
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
      enabled,
      leagueId,
      live,
      router,
    ]
  );


  return null;
}