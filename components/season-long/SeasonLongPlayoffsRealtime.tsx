"use client";

import {
  useEffect,
  useRef,
} from "react";

import {
  useRouter,
} from "next/navigation";

import {
  createBrowserClient,
} from "@supabase/ssr";


type Props = {
  leagueId: string;
  season: number;
  enabled?: boolean;
  live?: boolean;
};


/*
 * Keeps the Season-Long playoff bracket synchronized with the
 * authoritative database state.
 *
 * Realtime is the primary path:
 *
 *   live NFL scoring
 *     -> refresh_season_long_live_game()
 *     -> season_long_weekly_scores
 *     -> sync_season_long_playoff_week()
 *     -> season_long_matchups UPDATE
 *     -> Supabase Realtime
 *     -> router.refresh()
 *     -> server page re-reads the bracket
 *
 * The component never calls ESPN and never calculates fantasy scores.
 *
 * A visible-page polling fallback is retained so the bracket still
 * catches up if a browser temporarily misses a Realtime event.
 */
export default function SeasonLongPlayoffsRealtime({
  leagueId,
  season,
  enabled = true,
  live = false,
}: Props) {
  const router =
    useRouter();


  const debounceTimerRef =
    useRef<
      number | null
    >(null);


  const cooldownTimerRef =
    useRef<
      number | null
    >(null);


  const refreshBlockedRef =
    useRef(
      false
    );


  const pendingRefreshRef =
    useRef(
      false
    );


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


      if (
        !supabaseUrl ||
        !supabaseKey
      ) {
        console.error(
          "Season-Long Playoffs Realtime could not start because Supabase environment variables are missing."
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


      function performRefresh() {
        if (
          cancelled ||
          document.visibilityState ===
            "hidden"
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
            1200
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
          refreshBlockedRef.current
        ) {
          pendingRefreshRef.current =
            true;

          return;
        }


        if (
          debounceTimerRef.current
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


      const channel =
        supabase
          .channel(
            `season-long-playoffs-${leagueId}-${season}`
          )

          /*
           * Primary live bracket signal.
           *
           * refresh_season_long_live_game() now calls
           * sync_season_long_playoff_week(), which updates this table
           * in the same live-scoring cycle.
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
            (
              payload
            ) => {
              const row =
                (
                  payload.new ??
                  payload.old ??
                  {}
                ) as Record<
                  string,
                  unknown
                >;


              if (
                row.season !==
                  undefined &&
                Number(
                  row.season
                ) !==
                  season
              ) {
                return;
              }


              if (
                row.matchup_type !==
                  undefined &&
                String(
                  row.matchup_type
                ) !==
                  "playoff"
              ) {
                return;
              }


              scheduleRefresh();
            }
          )

          /*
           * Bracket lifecycle state changes:
           * current round, completion, champion, etc.
           */
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table:
                "season_long_playoff_state",
              filter:
                `league_id=eq.${leagueId}`,
            },
            (
              payload
            ) => {
              const row =
                (
                  payload.new ??
                  payload.old ??
                  {}
                ) as Record<
                  string,
                  unknown
                >;


              if (
                row.season !==
                  undefined &&
                Number(
                  row.season
                ) !==
                  season
              ) {
                return;
              }


              scheduleRefresh();
            }
          )

          /*
           * Official playoff seed changes.
           */
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table:
                "season_long_playoff_seeds",
              filter:
                `league_id=eq.${leagueId}`,
            },
            (
              payload
            ) => {
              const row =
                (
                  payload.new ??
                  payload.old ??
                  {}
                ) as Record<
                  string,
                  unknown
                >;


              if (
                row.season !==
                  undefined &&
                Number(
                  row.season
                ) !==
                  season
              ) {
                return;
              }


              scheduleRefresh();
            }
          )

          /*
           * Weekly scores are an additional direct scoring signal.
           * The matchup update should normally arrive in the same
           * backend cycle, but this makes the browser path resilient.
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
            (
              payload
            ) => {
              const row =
                (
                  payload.new ??
                  payload.old ??
                  {}
                ) as Record<
                  string,
                  unknown
                >;


              if (
                row.season !==
                  undefined &&
                Number(
                  row.season
                ) !==
                  season
              ) {
                return;
              }


              scheduleRefresh();
            }
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
                  "Season-Long Playoffs Realtime channel issue:",
                  status,
                  leagueId,
                  season
                );
              }
            }
          );


      /*
       * Realtime is primary.
       *
       * During active playoffs, use a 5-second visible-page fallback.
       * Outside active playoffs, 10 seconds is sufficient for seed,
       * lifecycle, commissioner, and reconnect catch-up.
       */
      const fallbackIntervalMs =
        live
          ? 5000
          : 10000;


      const fallbackTimer =
        window.setInterval(
          () => {
            if (
              document.visibilityState ===
                "visible"
            ) {
              performRefresh();
            }
          },
          fallbackIntervalMs
        );


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


      return () => {
        cancelled =
          true;


        if (
          debounceTimerRef.current
        ) {
          window.clearTimeout(
            debounceTimerRef.current
          );

          debounceTimerRef.current =
            null;
        }


        if (
          cooldownTimerRef.current
        ) {
          window.clearTimeout(
            cooldownTimerRef.current
          );

          cooldownTimerRef.current =
            null;
        }


        window.clearInterval(
          fallbackTimer
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


        void supabase.removeChannel(
          channel
        );
      };
    },
    [
      enabled,
      leagueId,
      live,
      router,
      season,
    ]
  );


  return null;
}