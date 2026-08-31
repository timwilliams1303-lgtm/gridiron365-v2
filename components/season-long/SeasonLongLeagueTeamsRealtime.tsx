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
  week: number;
  enabled?: boolean;
};


/*
 * Keeps the active Season-Long League Teams page synchronized with
 * lineup submissions from every league member.
 *
 * Realtime is the primary path:
 *   My Entry save/submit
 *     -> season_long_weekly_lineups / entries / scores changes
 *     -> postgres_changes event
 *     -> router.refresh()
 *     -> server components re-read authoritative database state
 *
 * A light polling fallback is also kept so the page still updates
 * automatically if a browser temporarily misses a Realtime event.
 */
export default function SeasonLongLeagueTeamsRealtime({
  leagueId,
  season,
  week,
  enabled = true,
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


      if (
        !supabaseUrl ||
        !supabaseKey
      ) {
        console.error(
          "Season-Long League Teams Realtime could not start because Supabase environment variables are missing."
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
            `season-long-league-teams-${leagueId}-${season}-${week}`
          )
          .on(
            "postgres_changes",
            {
              event:
                "*",

              schema:
                "public",

              table:
                "season_long_weekly_lineups",

              filter:
                `league_id=eq.${leagueId}`,
            },
            (
              payload
            ) => {
              const row =
                (
                  payload.new &&
                  Object.keys(
                    payload.new
                  ).length > 0
                )
                  ? payload.new
                  : payload.old;


              const rowSeason =
                Number(
                  (
                    row as {
                      season?: unknown;
                    }
                  )?.season
                );

              const rowWeek =
                Number(
                  (
                    row as {
                      week?: unknown;
                    }
                  )?.week
                );


              if (
                rowSeason ===
                  season &&
                rowWeek ===
                  week
              ) {
                scheduleRefresh();
              }
            }
          )
          .on(
            "postgres_changes",
            {
              event:
                "*",

              schema:
                "public",

              table:
                "season_long_weekly_entries",

              filter:
                `league_id=eq.${leagueId}`,
            },
            (
              payload
            ) => {
              const row =
                (
                  payload.new &&
                  Object.keys(
                    payload.new
                  ).length > 0
                )
                  ? payload.new
                  : payload.old;


              const rowSeason =
                Number(
                  (
                    row as {
                      season?: unknown;
                    }
                  )?.season
                );

              const rowWeek =
                Number(
                  (
                    row as {
                      week?: unknown;
                    }
                  )?.week
                );


              if (
                rowSeason ===
                  season &&
                rowWeek ===
                  week
              ) {
                scheduleRefresh();
              }
            }
          )
          .on(
            "postgres_changes",
            {
              event:
                "*",

              schema:
                "public",

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
                  payload.new &&
                  Object.keys(
                    payload.new
                  ).length > 0
                )
                  ? payload.new
                  : payload.old;


              const rowSeason =
                Number(
                  (
                    row as {
                      season?: unknown;
                    }
                  )?.season
                );

              const rowWeek =
                Number(
                  (
                    row as {
                      week?: unknown;
                    }
                  )?.week
                );


              if (
                rowSeason ===
                  season &&
                rowWeek ===
                  week
              ) {
                scheduleRefresh();
              }
            }
          )
          .subscribe(
            (
              status
            ) => {
              if (
                status ===
                  "CHANNEL_ERROR"
              ) {
                console.error(
                  "Season-Long League Teams Realtime channel error:",
                  leagueId
                );
              }


              if (
                status ===
                  "TIMED_OUT"
              ) {
                console.error(
                  "Season-Long League Teams Realtime connection timed out:",
                  leagueId
                );
              }
            }
          );


      /*
       * Fallback synchronization.
       *
       * Realtime normally refreshes within a moment of a lineup submission.
       * A one-second visible-page fallback keeps League Teams synchronized even
       * if a browser misses a Realtime event or Realtime publication is delayed.
       */
      const fallbackTimer =
        window.setInterval(
          () => {
            performRefresh();
          },
          1_000
        );


      function handleFocus() {
        performRefresh();
      }


      function handleVisibilityChange() {
        if (
          document.visibilityState ===
            "visible"
        ) {
          performRefresh();
        }
      }


      window.addEventListener(
        "focus",
        handleFocus
      );

      document.addEventListener(
        "visibilitychange",
        handleVisibilityChange
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

        window.removeEventListener(
          "focus",
          handleFocus
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
      router,
      season,
      week,
    ]
  );


  return null;
}
