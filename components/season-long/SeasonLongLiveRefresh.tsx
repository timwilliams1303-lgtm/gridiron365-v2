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

type RealtimeSubscribeStatus =
  | "SUBSCRIBED"
  | "TIMED_OUT"
  | "CLOSED"
  | "CHANNEL_ERROR";

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
    useRef<number | null>(
      null
    );

  const cooldownTimerRef =
    useRef<number | null>(
      null
    );

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

      /*
       * =========================================================
       * REFRESH CONTROL
       * =========================================================
       *
       * router.refresh() causes the server components for the
       * current route to re-render and pull the newest
       * authoritative database state.
       *
       * The cooldown prevents a burst of database changes from
       * causing a large number of simultaneous refreshes.
       * =========================================================
       */

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

      /*
       * =========================================================
       * DEBOUNCED REFRESH
       * =========================================================
       *
       * Multiple Realtime changes can arrive together.
       *
       * Wait briefly so one scoring update that touches several
       * tables results in one router refresh instead of several.
       * =========================================================
       */

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
       * FALLBACK POLLING
       * =========================================================
       *
       * Supabase Realtime is the preferred immediate update path.
       *
       * Polling remains active as a safety net.
       *
       * LIVE:
       *   Refresh every 5 seconds.
       *
       * NOT LIVE:
       *   Refresh every 10 seconds.
       *
       * This means Season-Long pages continue updating even if:
       *
       * - Supabase Realtime temporarily disconnects
       * - the channel times out
       * - a table is not currently in the Realtime publication
       * - the browser sleeps and wakes
       * - the network connection changes
       * - server-rendered data depends on another table
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

      /*
       * Refresh immediately when the user returns to the page.
       */

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

      /*
       * =========================================================
       * SUPABASE REALTIME
       * =========================================================
       *
       * The browser does NOT contact ESPN from this component.
       *
       * The centralized Season-Long live worker updates the
       * authoritative database state.
       *
       * Realtime notifications tell this component that something
       * changed and the server-rendered route should refresh.
       *
       * IMPORTANT:
       *
       * CHANNEL_ERROR and TIMED_OUT are recoverable conditions.
       *
       * They must NOT be sent through console.error().
       *
       * Next.js development mode displays console.error() calls in
       * its development error overlay, which was the red screen
       * we were seeing.
       *
       * Polling remains active even if Realtime is unavailable.
       * =========================================================
       */

      let realtimeClient:
        ReturnType<
          typeof createBrowserClient
        > | null =
        null;

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
        realtimeClient =
          createBrowserClient(
            supabaseUrl,
            supabaseKey
          );

        channel =
          realtimeClient
            .channel(
              `season-long-live-refresh-${leagueId}`
            )

            /*
             * =====================================================
             * WEEKLY TEAM SCORES
             * =====================================================
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
             * =====================================================
             * TOTAL POINTS STANDINGS
             * =====================================================
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
             * =====================================================
             * HEAD-TO-HEAD STANDINGS
             * =====================================================
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
             * =====================================================
             * MATCHUPS
             * =====================================================
             *
             * Includes regular-season and playoff matchup score
             * changes.
             * =====================================================
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
             * =====================================================
             * WEEKLY LINEUPS
             * =====================================================
             *
             * Covers lineup edits and player kickoff lock changes.
             * =====================================================
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
             * =====================================================
             * WEEKLY ENTRIES
             * =====================================================
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

            /*
             * =====================================================
             * SUBSCRIPTION STATUS
             * =====================================================
             *
             * Explicitly typing status fixes:
             *
             * TS7006
             * Parameter 'status' implicitly has an 'any' type.
             * =====================================================
             */

            .subscribe(
              (
                status:
                  RealtimeSubscribeStatus
              ) => {
                if (cancelled) {
                  return;
                }

                switch (status) {
                  case "SUBSCRIBED": {
                    /*
                     * Realtime is connected.
                     *
                     * Refresh once in case database state changed
                     * while the socket/channel was connecting.
                     */
                    scheduleRefresh();

                    break;
                  }

                  case "CHANNEL_ERROR": {
                    /*
                     * Realtime is temporarily unavailable.
                     *
                     * This is NOT fatal because fallback polling
                     * remains active.
                     *
                     * Do not use console.error() here.
                     */
                    if (
                      process.env.NODE_ENV ===
                      "development"
                    ) {
                      console.warn(
                        "Season-Long Realtime channel unavailable; polling fallback remains active.",
                        leagueId
                      );
                    }

                    break;
                  }

                  case "TIMED_OUT": {
                    /*
                     * Subscription timed out.
                     *
                     * Keep polling and allow Supabase Realtime to
                     * handle its normal reconnection behavior.
                     */
                    if (
                      process.env.NODE_ENV ===
                      "development"
                    ) {
                      console.warn(
                        "Season-Long Realtime subscription timed out; polling fallback remains active.",
                        leagueId
                      );
                    }

                    break;
                  }

                  case "CLOSED": {
                    /*
                     * CLOSED is not treated as an application
                     * failure.
                     *
                     * It can occur during:
                     *
                     * - route navigation
                     * - hot module replacement
                     * - component cleanup
                     * - socket reconnects
                     */
                    break;
                  }

                  default: {
                    break;
                  }
                }
              }
            );
      }

      /*
       * =========================================================
       * CLEANUP
       * =========================================================
       *
       * Remove timers, browser listeners and the Supabase channel
       * whenever this effect is destroyed.
       * =========================================================
       */

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

        refreshBlockedRef.current =
          false;

        pendingRefreshRef.current =
          false;

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

        if (
          realtimeClient &&
          channel
        ) {
          void realtimeClient
            .removeChannel(
              channel
            );
        }
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