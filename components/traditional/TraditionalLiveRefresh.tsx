"use client";

import {
  useCallback,
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
  intervalMs = 15000,
}: Props) {
  const pathname =
    usePathname();


  const router =
    useRouter();


  const requestRunningRef =
    useRef(
      false
    );


  const mountedRef =
    useRef(
      true
    );


  const matchupsRoot =
    `/league/${leagueId}/matchups`;


  const shouldRun =
    pathname ===
      matchupsRoot ||
    pathname.startsWith(
      `${matchupsRoot}/`
    );


  const runRefresh =
    useCallback(
      async () => {
        if (
          !shouldRun ||
          requestRunningRef.current ||
          !mountedRef.current
        ) {
          return;
        }


        if (
          typeof document !==
            "undefined" &&
          document.visibilityState ===
            "hidden"
        ) {
          return;
        }


        requestRunningRef.current =
          true;


        try {
          const response =
            await fetch(
              `/api/league/${leagueId}/matchups/live-refresh`,
              {
                method:
                  "POST",

                credentials:
                  "same-origin",

                cache:
                  "no-store",

                headers: {
                  Accept:
                    "application/json",
                },
              }
            );


          const contentType =
            response.headers.get(
              "content-type"
            ) ??
            "";


          let result:
            unknown =
              null;


          if (
            contentType.includes(
              "application/json"
            )
          ) {
            result =
              await response.json();
          } else {
            result =
              await response.text();
          }


          if (
            !response.ok
          ) {
            console.error(
              "Live matchup refresh request failed:",
              {
                status:
                  response.status,

                result,
              }
            );

            return;
          }


          if (
            mountedRef.current
          ) {
            /*
             * Re-render the current server page with the newly
             * synchronized score/game data.
             *
             * This keeps the user on the exact same matchup URL.
             */
            router.refresh();
          }
        } catch (
          error
        ) {
          console.error(
            "Live matchup refresh failed:",
            error
          );
        } finally {
          requestRunningRef.current =
            false;
        }
      },
      [
        leagueId,
        router,
        shouldRun,
      ]
    );


  useEffect(
    () => {
      mountedRef.current =
        true;


      return () => {
        mountedRef.current =
          false;
      };
    },
    []
  );


  useEffect(
    () => {
      if (
        !shouldRun
      ) {
        return;
      }


      /*
       * Don't hit the API immediately while the route is still
       * mounting. Start after a short delay.
       */
      const initialTimer =
        window.setTimeout(
          () => {
            void runRefresh();
          },
          3000
        );


      const interval =
        window.setInterval(
          () => {
            void runRefresh();
          },
          intervalMs
        );


      const handleVisibilityChange =
        () => {
          if (
            document.visibilityState ===
            "visible"
          ) {
            void runRefresh();
          }
        };


      document.addEventListener(
        "visibilitychange",
        handleVisibilityChange
      );


      return () => {
        window.clearTimeout(
          initialTimer
        );


        window.clearInterval(
          interval
        );


        document.removeEventListener(
          "visibilitychange",
          handleVisibilityChange
        );
      };
    },
    [
      intervalMs,
      runRefresh,
      shouldRun,
    ]
  );


  return null;
}