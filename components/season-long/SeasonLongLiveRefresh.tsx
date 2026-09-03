"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

type Props = {
  enabled: boolean;
  live: boolean;
};

export default function SeasonLongLiveRefresh({
  enabled,
  live,
}: Props) {
  const router = useRouter();

  useEffect(() => {
    if (!enabled) return;

    const intervalMs =
      live ? 15_000 : 30_000;

    const refresh = () => {
      if (
        document.visibilityState ===
        "visible"
      ) {
        router.refresh();
      }
    };

    const timer =
      window.setInterval(
        refresh,
        intervalMs
      );

    const handleVisibilityChange = () => {
      if (
        document.visibilityState ===
        "visible"
      ) {
        refresh();
      }
    };

    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange
    );

    return () => {
      window.clearInterval(timer);

      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      );
    };
  }, [enabled, live, router]);

  return null;
}
