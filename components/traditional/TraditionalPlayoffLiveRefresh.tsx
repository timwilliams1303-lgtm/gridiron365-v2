"use client";

import {
  useEffect,
} from "react";

import {
  useRouter,
} from "next/navigation";


type Props = {
  enabled:
    boolean;

  intervalMs?:
    number;
};


export default function TraditionalPlayoffLiveRefresh({
  enabled,
  intervalMs = 15000,
}: Props) {
  const router =
    useRouter();


  useEffect(
    () => {
      if (
        !enabled
      ) {
        return;
      }


      const timer =
        window.setInterval(
          () => {
            router.refresh();
          },
          intervalMs
        );


      return () => {
        window.clearInterval(
          timer
        );
      };
    },
    [
      enabled,
      intervalMs,
      router,
    ]
  );


  return null;
}