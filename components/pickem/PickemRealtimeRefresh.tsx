"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type Props = {
  leagueId: string;
};

const LEAGUE_TABLES = [
  "pickem_settings",
  "pickem_weeks",
  "pickem_games",
  "pickem_picks",
  "pickem_weekly_results",
  "pickem_badge_awards",
  "nhl_pickem_settings",
  "nhl_pickem_periods",
  "nhl_pickem_games",
  "nhl_pickem_picks",
  "nhl_pickem_period_results",
  "nhl_pickem_standings",
  "nhl_pickem_awards",
  "fantasy_teams",
] as const;

export default function PickemRealtimeRefresh({ leagueId }: Props) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let refreshTimer: number | null = null;

    const refresh = () => {
      if (document.visibilityState === "hidden") return;

      if (refreshTimer !== null) {
        window.clearTimeout(refreshTimer);
      }

      refreshTimer = window.setTimeout(() => {
        refreshTimer = null;
        router.refresh();
        window.dispatchEvent(
          new CustomEvent("g365-pickem-realtime", {
            detail: { leagueId },
          })
        );
      }, 120);
    };

    let channel = supabase
      .channel(`g365-pickem-realtime-${leagueId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "leagues",
          filter: `id=eq.${leagueId}`,
        },
        refresh
      );

    for (const table of LEAGUE_TABLES) {
      channel = channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table,
          filter: `league_id=eq.${leagueId}`,
        },
        refresh
      );
    }

    channel.subscribe((status) => {
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        console.error("G365 Pick'em realtime channel issue:", status, leagueId);
      }
    });

    const fallback = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        router.refresh();
        window.dispatchEvent(
          new CustomEvent("g365-pickem-realtime", {
            detail: { leagueId },
          })
        );
      }
    }, 2_000);

    const onFocus = () => refresh();
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      if (refreshTimer !== null) window.clearTimeout(refreshTimer);
      window.clearInterval(fallback);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
      void supabase.removeChannel(channel);
    };
  }, [leagueId, router]);

  return null;
}
