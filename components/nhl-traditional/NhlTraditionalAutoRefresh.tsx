"use client";
import {startTransition,useEffect,useRef} from "react";
import {useRouter} from "next/navigation";
import {createBrowserClient} from "@supabase/ssr";
const supabase=createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY??process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
export default function NhlTraditionalAutoRefresh({leagueId}:{leagueId:string}){
 const router=useRouter();
 const timerRef=useRef<ReturnType<typeof setTimeout>|null>(null);
 const refreshingRef=useRef(false);
 useEffect(()=>{
  let mounted=true;
  const refresh=()=>{
   if(!mounted||document.visibilityState!=="visible")return;
   if(timerRef.current)clearTimeout(timerRef.current);
   timerRef.current=setTimeout(()=>{
    if(!mounted||refreshingRef.current)return;
    refreshingRef.current=true;
    // A transition keeps the current page rendered while Next fetches the
    // new Server Component payload. This avoids the page disappearing/flashing.
    startTransition(()=>{
     router.refresh();
     window.setTimeout(()=>{refreshingRef.current=false;},750);
    });
   },300);
  };
  const channel=supabase.channel(`nhl-traditional-page-${leagueId}-${Math.random().toString(36).slice(2)}`)
   .on("postgres_changes",{event:"*",schema:"public",table:"nhl_traditional_rosters",filter:`league_id=eq.${leagueId}`},refresh)
   .on("postgres_changes",{event:"*",schema:"public",table:"nhl_traditional_weekly_lineups",filter:`league_id=eq.${leagueId}`},refresh)
   .on("postgres_changes",{event:"*",schema:"public",table:"nhl_traditional_matchups",filter:`league_id=eq.${leagueId}`},refresh)
   .on("postgres_changes",{event:"*",schema:"public",table:"nhl_traditional_standings",filter:`league_id=eq.${leagueId}`},refresh)
   .on("postgres_changes",{event:"*",schema:"public",table:"nhl_traditional_transactions",filter:`league_id=eq.${leagueId}`},refresh)
   .on("postgres_changes",{event:"*",schema:"public",table:"nhl_traditional_waiver_claims",filter:`league_id=eq.${leagueId}`},refresh)
   .on("postgres_changes",{event:"*",schema:"public",table:"nhl_traditional_trade_offers",filter:`league_id=eq.${leagueId}`},refresh)
   .subscribe();
  const interval=window.setInterval(refresh,30000);
  const onVisible=()=>{if(document.visibilityState==="visible")refresh();};
  document.addEventListener("visibilitychange",onVisible);
  return()=>{
   mounted=false;
   if(timerRef.current)clearTimeout(timerRef.current);
   window.clearInterval(interval);
   document.removeEventListener("visibilitychange",onVisible);
   void supabase.removeChannel(channel);
  };
 },[leagueId,router]);
 return null;
}
