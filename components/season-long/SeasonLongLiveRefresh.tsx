"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

type Props = {
  enabled: boolean;
  live: boolean;
};

export default function SeasonLongLiveRefresh({ enabled, live }: Props) {
  const router = useRouter();

  useEffect(() => {
    if (!enabled) return;

    // Poll faster while a game is live. Before kickoff we still refresh so
    // UPCOMING can flip to LIVE without the user reloading the page.
    const intervalMs = live ? 15_000 : 30_000;

    const refresh = () => {
      if (document.visibilityState === "visible") {
        router.refresh();
      }
    };

    const timer = window.setInterval(refresh, intervalMs);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [enabled, live, router]);

  return null;
}
