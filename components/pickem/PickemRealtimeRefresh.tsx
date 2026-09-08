"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type Props = {
  leagueId: string;
};

const LIVE_DATA_TABLES = [
  "pickem_weeks",
  "pickem_games",
  "pickem_picks",
  "pickem_weekly_results",
  "pickem_badge_awards",
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
    let hardRefreshTimer: number | null = null;
    let softRefreshTimer: number | null = null;

    const dispatchRefresh = () => {
      window.dispatchEvent(
        new CustomEvent("g365-pickem-realtime", {
          detail: { leagueId },
        })
      );
    };

    // Data changes should refresh the client components without remounting
    // the whole server page. This prevents flicker/spazzing while picks change.
    const softRefresh = () => {
      if (document.visibilityState === "hidden") return;

      if (softRefreshTimer !== null) {
        window.clearTimeout(softRefreshTimer);
      }

      softRefreshTimer = window.setTimeout(() => {
        softRefreshTimer = null;
        dispatchRefresh();
      }, 100);
    };

    // League/settings changes can alter which component tree is rendered,
    // so those changes also refresh the server route.
    const hardRefresh = () => {
      if (document.visibilityState === "hidden") return;

      if (hardRefreshTimer !== null) {
        window.clearTimeout(hardRefreshTimer);
      }

      hardRefreshTimer = window.setTimeout(() => {
        hardRefreshTimer = null;
        dispatchRefresh();
        router.refresh();
      }, 180);
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
        hardRefresh
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "pickem_settings",
          filter: `league_id=eq.${leagueId}`,
        },
        hardRefresh
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "nhl_pickem_settings",
          filter: `league_id=eq.${leagueId}`,
        },
        hardRefresh
      );

    for (const table of LIVE_DATA_TABLES) {
      channel = channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table,
          filter: `league_id=eq.${leagueId}`,
        },
        softRefresh
      );
    }

    channel.subscribe((status) => {
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        console.error("G365 Pick'em realtime channel issue:", status, leagueId);
      }
    });

    const onFocus = () => {
      dispatchRefresh();
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        dispatchRefresh();
      }
    };

    // Low-frequency safety fallback only. Realtime remains the primary path.
    const fallback = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        dispatchRefresh();
      }
    }, 30_000);

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      if (hardRefreshTimer !== null) window.clearTimeout(hardRefreshTimer);
      if (softRefreshTimer !== null) window.clearTimeout(softRefreshTimer);
      window.clearInterval(fallback);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
      void supabase.removeChannel(channel);
    };
  }, [leagueId, router]);

  return null;
}
