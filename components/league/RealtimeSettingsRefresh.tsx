"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Props = {
  leagueId: string;
  tables: string[];
};

export default function RealtimeSettingsRefresh({
  leagueId,
  tables,
}: Props) {
  const router = useRouter();

  const tableKey = tables.join("|");

  useEffect(() => {
    let refreshTimer: number | null = null;

    const refresh = () => {
      if (refreshTimer !== null) {
        window.clearTimeout(refreshTimer);
      }

      refreshTimer = window.setTimeout(() => {
        router.refresh();
      }, 150);
    };

    let channel = supabase.channel(`league-settings-live-${leagueId}`);

    for (const table of tableKey.split("|").filter(Boolean)) {
      channel = channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table,
          filter:
            table === "leagues"
              ? `id=eq.${leagueId}`
              : `league_id=eq.${leagueId}`,
        },
        refresh
      );
    }

    channel.subscribe();

    // Realtime is the primary update path. This fallback also covers
    // tables that are not currently included in the Supabase realtime
    // publication and browser reconnects.
    const fallbackInterval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        router.refresh();
      }
    }, 5000);

    const onFocus = () => router.refresh();

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        router.refresh();
      }
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      if (refreshTimer !== null) {
        window.clearTimeout(refreshTimer);
      }

      window.clearInterval(fallbackInterval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      void supabase.removeChannel(channel);
    };
  }, [leagueId, router, tableKey]);

  return null;
}
