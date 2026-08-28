"use client";

import {
  useEffect,
  useMemo,
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

  mode?: "league" | "games";

  nflGameIds?: number[];
};


/*
 * ============================================================
 * TRADITIONAL LIVE REFRESH
 * ============================================================
 *
 * ESPN synchronization and fantasy scoring are handled by the
 * centralized NFL worker.
 *
 * This component NEVER calls ESPN and NEVER calculates scores.
 *
 * MODE: league
 * ------------------------------------------------------------
 * Listens for league-specific fantasy changes:
 *
 *   traditional_matchups
 *   weekly_lineups
 *
 * MODE: games
 * ------------------------------------------------------------
 * Listens only for nfl_game_plays belonging to NFL games
 * displayed in the current fantasy matchup.
 */
export default function TraditionalLiveRefresh({
  leagueId,
  mode = "league",
  nflGameIds = [],
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


  const pendingRefreshRef =
    useRef(false);


  /*
   * ============================================================
   * NORMALIZE NFL GAME IDS
   * ============================================================
   */
  const nflGameIdsKey =
    useMemo(
      () => {
        return Array.from(
          new Set(
            nflGameIds
              .map(
                (
                  value
                ) =>
                  Number(
                    value
                  )
              )
              .filter(
                (
                  value
                ) =>
                  Number.isInteger(
                    value
                  ) &&
                  value >
                    0
              )
          )
        )
          .sort(
            (
              a,
              b
            ) =>
              a -
              b
          )
          .join(
            ","
          );
      },
      [
        nflGameIds,
      ]
    );


  /*
   * Rebuild the numeric list from the stable key.
   *
   * This prevents a newly-created array instance from causing
   * unnecessary Realtime reconnections.
   */
  const normalizedNflGameIds =
    useMemo(
      () => {
        if (
          !nflGameIdsKey
        ) {
          return [];
        }


        return nflGameIdsKey
          .split(
            ","
          )
          .map(
            (
              value
            ) =>
              Number(
                value
              )
          )
          .filter(
            (
              value
            ) =>
              Number.isInteger(
                value
              ) &&
              value >
                0
          );
      },
      [
        nflGameIdsKey,
      ]
    );


  /*
   * ============================================================
   * ROUTE CHECK
   * ============================================================
   */
  const isMatchupsPage =
    pathname ===
      `/league/${leagueId}/matchups` ||
    pathname.startsWith(
      `/league/${leagueId}/matchups/`
    );


  useEffect(
    () => {
      /*
       * League mode is intentionally inactive everywhere except
       * the matchup area.
       *
       * Game mode is mounted directly by a matchup-detail page.
       */
      if (
        mode ===
          "league" &&
        !isMatchupsPage
      ) {
        return;
      }


      if (
        mode ===
          "games" &&
        normalizedNflGameIds.length ===
          0
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
       * ========================================================
       * SAFE REFRESH
       * ========================================================
       */
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
          setTimeout(
            () => {
              if (
                cancelled
              ) {
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
          refreshBlockedRef.current
        ) {
          pendingRefreshRef.current =
            true;

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
       * ========================================================
       * LEAGUE MODE
       * ========================================================
       */
      const channels:
        ReturnType<
          typeof supabase.channel
        >[] =
          [];


      if (
        mode ===
          "league"
      ) {
        const leagueChannel =
          supabase
            .channel(
              `traditional-fantasy-${leagueId}`
            )

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
                    "Traditional fantasy Realtime connected:",
                    leagueId
                  );
                }


                if (
                  status ===
                    "CHANNEL_ERROR"
                ) {
                  console.error(
                    "Traditional fantasy Realtime channel error:",
                    leagueId
                  );
                }


                if (
                  status ===
                    "TIMED_OUT"
                ) {
                  console.error(
                    "Traditional fantasy Realtime connection timed out:",
                    leagueId
                  );
                }


                if (
                  status ===
                    "CLOSED"
                ) {
                  console.warn(
                    "Traditional fantasy Realtime channel closed:",
                    leagueId
                  );
                }
              }
            );


        channels.push(
          leagueChannel
        );
      }


      /*
       * ========================================================
       * GAME MODE
       * ========================================================
       *
       * One filtered listener per relevant NFL game.
       *
       * DO NOT replace this with an unfiltered nfl_game_plays
       * subscription.
       */
      if (
        mode ===
          "games"
      ) {
        for (
          const nflGameId
          of normalizedNflGameIds
        ) {
          const gameChannel =
            supabase
              .channel(
                `traditional-game-${leagueId}-${nflGameId}`
              )

              .on(
                "postgres_changes",
                {
                  event:
                    "*",

                  schema:
                    "public",

                  table:
                    "nfl_game_plays",

                  filter:
                    `nfl_game_id=eq.${nflGameId}`,
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
                      "Traditional NFL play Realtime connected:",
                      nflGameId
                    );
                  }


                  if (
                    status ===
                      "CHANNEL_ERROR"
                  ) {
                    console.error(
                      "Traditional NFL play Realtime channel error:",
                      nflGameId
                    );
                  }


                  if (
                    status ===
                      "TIMED_OUT"
                  ) {
                    console.error(
                      "Traditional NFL play Realtime connection timed out:",
                      nflGameId
                    );
                  }


                  if (
                    status ===
                      "CLOSED"
                  ) {
                    console.warn(
                      "Traditional NFL play Realtime channel closed:",
                      nflGameId
                    );
                  }
                }
              );


          channels.push(
            gameChannel
          );
        }
      }


      /*
       * ========================================================
       * CATCH-UP
       * ========================================================
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
       * ========================================================
       * CLEANUP
       * ========================================================
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

        pendingRefreshRef.current =
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


        for (
          const channel
          of channels
        ) {
          void supabase.removeChannel(
            channel
          );
        }
      };
    },
    [
      isMatchupsPage,
      leagueId,
      mode,
      nflGameIdsKey,
      normalizedNflGameIds,
      router,
    ]
  );


  return null;
}
