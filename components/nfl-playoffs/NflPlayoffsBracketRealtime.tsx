"use client";

import {
  useEffect,
  useMemo,
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
  nflGameIds: number[];
};


export default function NflPlayoffsBracketRealtime({
  leagueId,
  nflGameIds,
}: Props) {
  const router =
    useRouter();

  const refreshTimerRef =
    useRef<
      ReturnType<
        typeof setTimeout
      > |
      null
    >(null);

  const gameIdsKey =
    useMemo(
      () =>
        [...nflGameIds]
          .sort(
            (
              a,
              b
            ) =>
              a - b
          )
          .join(","),
      [
        nflGameIds,
      ]
    );

  useEffect(
    () => {
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
          "[NFL PLAYOFF BRACKET REALTIME] Missing Supabase browser environment variables."
        );

        return;
      }


      const supabase =
        createBrowserClient(
          supabaseUrl,
          supabaseKey
        );


      const currentGameIds =
        new Set(
          nflGameIds
        );


      function scheduleRefresh() {
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
              router.refresh();
            },
            300
          );
      }


      /*
       * nfl_games is the authoritative changing
       * source for:
       *
       * - home score
       * - away score
       * - game status
       * - quarter / clock detail
       * - final status
       *
       * We intentionally subscribe without a database
       * filter because the bracket can contain several
       * game IDs. We then ignore updates for games that
       * do not belong to the current bracket.
       */
      const channel =
        supabase
          .channel(
            `nfl-playoff-bracket-${leagueId}`
          )
          .on(
            "postgres_changes",
            {
              event:
                "*",
              schema:
                "public",
              table:
                "nfl_games",
            },
            (
              payload
            ) => {
              const newRow =
                (
                  payload.new ??
                  {}
                ) as {
                  id?: number;
                };

              const oldRow =
                (
                  payload.old ??
                  {}
                ) as {
                  id?: number;
                };

              const changedGameId =
                Number(
                  newRow.id ??
                  oldRow.id ??
                  0
                );

              if (
                !changedGameId
              ) {
                return;
              }

              if (
                !currentGameIds.has(
                  changedGameId
                )
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
                "SUBSCRIBED"
              ) {
                console.log(
                  "[NFL PLAYOFF BRACKET REALTIME] Connected."
                );
              }

              if (
                status ===
                  "CHANNEL_ERROR" ||
                status ===
                  "TIMED_OUT"
              ) {
                console.warn(
                  `[NFL PLAYOFF BRACKET REALTIME] Subscription status: ${status}`
                );
              }
            }
          );


      /*
       * Polling fallback.
       *
       * This serves two purposes:
       *
       * 1. The bracket still refreshes if a realtime
       *    event is missed.
       *
       * 2. Future playoff games can appear automatically
       *    when the lifecycle maps the next round, even
       *    though those game IDs were not known when this
       *    component first mounted.
       */
      const pollInterval =
        setInterval(
          () => {
            if (
              document.visibilityState !==
                "visible"
            ) {
              return;
            }

            router.refresh();
          },
          30000
        );


      function handleVisibilityChange() {
        if (
          document.visibilityState ===
            "visible"
        ) {
          router.refresh();
        }
      }


      document.addEventListener(
        "visibilitychange",
        handleVisibilityChange
      );


      return () => {
        if (
          refreshTimerRef.current
        ) {
          clearTimeout(
            refreshTimerRef.current
          );

          refreshTimerRef.current =
            null;
        }

        clearInterval(
          pollInterval
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
      leagueId,
      gameIdsKey,
      nflGameIds,
      router,
    ]
  );


  return null;
}