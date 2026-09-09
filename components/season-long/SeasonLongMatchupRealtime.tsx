"use client";

import {
  useCallback,
  useEffect,
  useRef,
} from "react";

import {
  useRouter,
} from "next/navigation";

import {
  createSupabaseBrowserClient,
} from "@/lib/supabase/browser";

type Props = {
  leagueId: string;
  matchupId: number;
  season: number;
  week: number;
  enabled?: boolean;
  live?: boolean;
};

export default function SeasonLongMatchupRealtime({
  leagueId,
  matchupId,
  season,
  week,
  enabled = true,
  live = false,
}: Props) {
  const router =
    useRouter();

  const refreshTimerRef =
    useRef<number | null>(
      null
    );

  const lastRefreshAtRef =
    useRef<number>(
      0
    );

  const mountedRef =
    useRef<boolean>(
      false
    );

  const refreshPage =
    useCallback(
      (
        immediate = false
      ) => {
        if (
          !mountedRef.current ||
          document.visibilityState !==
            "visible"
        ) {
          return;
        }

        if (
          refreshTimerRef.current !==
          null
        ) {
          window.clearTimeout(
            refreshTimerRef.current
          );

          refreshTimerRef.current =
            null;
        }

        const runRefresh =
          () => {
            if (
              !mountedRef.current ||
              document.visibilityState !==
                "visible"
            ) {
              return;
            }

            const now =
              Date.now();

            /*
             * Prevent a burst of related database updates from
             * producing several server-component refreshes.
             *
             * One ESPN scoring cycle can update:
             *
             * fantasy_player_game_scores
             * season_long_weekly_scores
             * season_long_matchups
             *
             * almost simultaneously.
             */
            if (
              !immediate &&
              now -
                lastRefreshAtRef.current <
                750
            ) {
              refreshTimerRef.current =
                window.setTimeout(
                  () => {
                    if (
                      !mountedRef.current
                    ) {
                      return;
                    }

                    lastRefreshAtRef.current =
                      Date.now();

                    router.refresh();
                  },
                  750
                );

              return;
            }

            lastRefreshAtRef.current =
              now;

            router.refresh();
          };

        if (immediate) {
          runRefresh();

          return;
        }

        /*
         * Small debounce so lineup + score + matchup writes from
         * the same transaction/cycle collapse into one refresh.
         */
        refreshTimerRef.current =
          window.setTimeout(
            runRefresh,
            250
          );
      },
      [
        router,
      ]
    );

  useEffect(
    () => {
      if (!enabled) {
        return;
      }

      mountedRef.current =
        true;

      const supabase =
        createSupabaseBrowserClient();

      /*
       * =========================================================
       * SEASON-LONG H2H REALTIME
       * =========================================================
       *
       * The matchup page is a server component.
       *
       * Realtime is only responsible for telling Next.js that
       * authoritative server data changed.
       *
       * The server-side matchup-detail service remains responsible
       * for opponent privacy.
       *
       * Therefore:
       *
       * - opponent may add/remove future players
       * - this listener receives the DB change
       * - router.refresh() reloads the matchup
       * - server privacy still hides unlocked opponent players
       *
       * Once that player's game locks/kicks off:
       *
       * - lineup row changes
       * - refresh occurs
       * - server now permits that player to be shown
       * =========================================================
       */

      const channel =
        supabase
          .channel(
            `season-long-matchup-${leagueId}-${matchupId}-${season}-${week}`
          )

          /*
           * Lineup movement / player lock changes.
           *
           * We intentionally filter only by league_id here.
           * Supabase Realtime filters cannot conveniently combine
           * league + season + week in one postgres_changes filter.
           *
           * The refresh itself reloads only this matchup.
           */
          .on(
            "postgres_changes",
            {
              event: "*",
              schema:
                "public",
              table:
                "season_long_weekly_lineups",
              filter:
                `league_id=eq.${leagueId}`,
            },
            () => {
              refreshPage();
            }
          )

          /*
           * Team/week fantasy score changes.
           */
          .on(
            "postgres_changes",
            {
              event: "*",
              schema:
                "public",
              table:
                "season_long_weekly_scores",
              filter:
                `league_id=eq.${leagueId}`,
            },
            () => {
              refreshPage();
            }
          )

          /*
           * Authoritative H2H matchup score/status changes.
           */
          .on(
            "postgres_changes",
            {
              event: "*",
              schema:
                "public",
              table:
                "season_long_matchups",
              filter:
                `league_id=eq.${leagueId}`,
            },
            () => {
              refreshPage();
            }
          )

          /*
           * Individual fantasy score changes are useful because
           * the matchup page displays each player's fantasy points
           * and live statistical line.
           *
           * This table does not need a matchup filter. League ID
           * is enough to restrict the subscription.
           */
          .on(
            "postgres_changes",
            {
              event: "*",
              schema:
                "public",
              table:
                "fantasy_player_game_scores",
              filter:
                `league_id=eq.${leagueId}`,
            },
            () => {
              refreshPage();
            }
          )

          .subscribe();

      /*
       * =========================================================
       * FALLBACK POLLING
       * =========================================================
       *
       * Realtime should normally win.
       *
       * During a live matchup use a five-second fallback so a
       * missed websocket event cannot leave the display stale.
       *
       * Before/after live play, 15 seconds is sufficient for
       * lineup-lock/movement fallback because Realtime remains
       * active continuously.
       * =========================================================
       */

      const fallbackIntervalMs =
        live
          ? 5_000
          : 15_000;

      const fallbackTimer =
        window.setInterval(
          () => {
            if (
              document.visibilityState ===
                "visible"
            ) {
              refreshPage();
            }
          },
          fallbackIntervalMs
        );

      /*
       * Immediately catch up when the user returns to the tab.
       */
      const handleVisibilityChange =
        () => {
          if (
            document.visibilityState ===
              "visible"
          ) {
            refreshPage(
              true
            );
          }
        };

      document.addEventListener(
        "visibilitychange",
        handleVisibilityChange
      );

      return () => {
        mountedRef.current =
          false;

        if (
          refreshTimerRef.current !==
          null
        ) {
          window.clearTimeout(
            refreshTimerRef.current
          );

          refreshTimerRef.current =
            null;
        }

        window.clearInterval(
          fallbackTimer
        );

        document.removeEventListener(
          "visibilitychange",
          handleVisibilityChange
        );

        void supabase.removeChannel(
          channel
        );
      };
    },
    [
      enabled,
      leagueId,
      matchupId,
      season,
      week,
      live,
      refreshPage,
    ]
  );

  return null;
}