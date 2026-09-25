"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import NhlInjuryBadge from "@/components/nhl-traditional/NhlInjuryBadge";

type Props = { leagueId: string; matchupId: number };
type Settings = { season:number; league_format:string|null; competition_format:string|null; lineup_period:string|null; regular_season_weeks:number; playoff_weeks:number; scoring_system:string|null; goalie_minimum_starts:number|null };
type FantasyTeam = { id:number; team_name:string; owner_id:string|null; is_cpu:boolean };
type Standing = { fantasy_team_id:number; wins:number; losses:number; ties:number; points_for:number; points_against:number; rank:number|null };
type Matchup = { id:number; league_id:string; season:number; week:number; home_fantasy_team_id:number; away_fantasy_team_id:number; home_score:number; away_score:number; status:string|null; winner_fantasy_team_id:number|null; is_tie:boolean };
type LineupRow = { fantasy_team_id:number; nhl_player_id:number; nhl_game_id:number|null; lineup_slot:string|null; slot_index:number|null; lineup_date:string|null; game_start_at:string|null };
type RosterRow = { fantasy_team_id:number; nhl_player_id:number; roster_status:string|null };
type Player = { id:number; team_id:number|null; display_name:string; short_name:string|null; jersey_number:string|null; position:string|null; position_group:string|null; injury_status:string|null; injury_detail:string|null; injury_return_date:string|null; injury_source:string|null; headshot_url:string|null };
type NhlTeam = { id:number; abbreviation:string|null; display_name:string|null; logo_url:string|null };
type Game = { id:number; start_time:string|null; away_team_id:number|null; home_team_id:number|null; away_score:number|null; home_score:number|null; status_type:string|null; status_name:string|null; status_detail:string|null; period:number|null; display_clock:string|null; status_completed:boolean|null };
type GameStat = { nhl_game_id:number; nhl_player_id:number; goals:number; assists:number; points:number; plus_minus:number; penalty_minutes:number; power_play_goals:number; power_play_assists:number; power_play_points:number; short_handed_goals:number; short_handed_assists:number; short_handed_points:number; game_winning_goals:number; shots_on_goal:number; hits:number; blocked_shots:number; goalie_started:boolean; goalie_decision:string|null; saves:number; shots_against:number; goals_against:number; save_percentage:number; goalie_minutes_seconds:number; goalie_win:number; goalie_loss:number; goalie_overtime_loss:number; shutout:number; is_final:boolean };
type GameScore = { nhl_game_id:number; nhl_player_id:number; fantasy_points:number; is_live:boolean; is_final:boolean };
type Projection = { nhl_player_id:number; projected_games_played:number; projected_goals:number; projected_assists:number; projected_points:number; projected_plus_minus:number; projected_penalty_minutes:number; projected_power_play_goals:number; projected_power_play_assists:number; projected_power_play_points:number; projected_short_handed_goals:number; projected_short_handed_assists:number; projected_short_handed_points:number; projected_game_winning_goals:number; projected_shots_on_goal:number; projected_hits:number; projected_blocked_shots:number; projected_goalie_starts:number; projected_goalie_wins:number; projected_goalie_losses:number; projected_goalie_ot_losses:number; projected_saves:number; projected_shots_against:number; projected_goals_against:number; projected_shutouts:number; projected_save_percentage:number; projected_goals_against_average:number; projected_goalie_minutes_seconds:number };
type CategoryRule = { stat_key:string; enabled:boolean; direction:string|null };
type CategoryDef = { label:string; field?:keyof GameStat; projectionField?:keyof Projection; ratio?:"save_percentage"|"gaa" };
type CategoryResult = { key:string; label:string; home:number; away:number; direction:"higher"|"lower"; winner:"home"|"away"|"tie" };
type AcquisitionSummary = { leagueId:string; fantasyTeamId:number; season:number; week:number|null; limit:number|null; unlimited:boolean; counted:number; pending:number; usedForLimit:number; remaining:number|null };

const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

const CATEGORIES: Record<string, CategoryDef> = {
  goals:{label:"G",field:"goals",projectionField:"projected_goals"}, goal:{label:"G",field:"goals",projectionField:"projected_goals"},
  assists:{label:"A",field:"assists",projectionField:"projected_assists"}, assist:{label:"A",field:"assists",projectionField:"projected_assists"},
  points:{label:"PTS",field:"points",projectionField:"projected_points"}, plus_minus:{label:"+/-",field:"plus_minus",projectionField:"projected_plus_minus"},
  penalty_minutes:{label:"PIM",field:"penalty_minutes",projectionField:"projected_penalty_minutes"},
  power_play_goals:{label:"PPG",field:"power_play_goals",projectionField:"projected_power_play_goals"}, power_play_assists:{label:"PPA",field:"power_play_assists",projectionField:"projected_power_play_assists"}, power_play_points:{label:"PPP",field:"power_play_points",projectionField:"projected_power_play_points"},
  short_handed_goals:{label:"SHG",field:"short_handed_goals",projectionField:"projected_short_handed_goals"}, short_handed_assists:{label:"SHA",field:"short_handed_assists",projectionField:"projected_short_handed_assists"}, short_handed_points:{label:"SHP",field:"short_handed_points",projectionField:"projected_short_handed_points"},
  game_winning_goals:{label:"GWG",field:"game_winning_goals",projectionField:"projected_game_winning_goals"}, shots_on_goal:{label:"SOG",field:"shots_on_goal",projectionField:"projected_shots_on_goal"}, hits:{label:"HIT",field:"hits",projectionField:"projected_hits"}, blocked_shots:{label:"BLK",field:"blocked_shots",projectionField:"projected_blocked_shots"},
  goalie_starts:{label:"GS",projectionField:"projected_goalie_starts"}, goalie_wins:{label:"W",field:"goalie_win",projectionField:"projected_goalie_wins"}, wins:{label:"W",field:"goalie_win",projectionField:"projected_goalie_wins"}, goalie_losses:{label:"L",field:"goalie_loss",projectionField:"projected_goalie_losses"}, goalie_ot_losses:{label:"OTL",field:"goalie_overtime_loss",projectionField:"projected_goalie_ot_losses"}, saves:{label:"SV",field:"saves",projectionField:"projected_saves"}, shots_against:{label:"SA",field:"shots_against",projectionField:"projected_shots_against"}, goals_against:{label:"GA",field:"goals_against",projectionField:"projected_goals_against"}, shutouts:{label:"SO",field:"shutout",projectionField:"projected_shutouts"},
  save_percentage:{label:"SV%",ratio:"save_percentage"}, goalie_save_percentage:{label:"SV%",ratio:"save_percentage"}, goals_against_average:{label:"GAA",ratio:"gaa"}, goalie_goals_against_average:{label:"GAA",ratio:"gaa"},
};

function n(v:unknown){ const x=Number(v??0); return Number.isFinite(x)?x:0; }
function txt(v:unknown,f=""){ return typeof v==="string"&&v.trim()?v.trim():f; }
function norm(v:unknown){ return txt(v).toLowerCase().replace(/[\s-]+/g,"_"); }
function isFinal(v:string|null){ return ["final","complete","completed"].includes(norm(v)); }
function isLive(v:string|null){ return ["live","active","in_progress"].includes(norm(v)); }
function statusLabel(v:string|null){ return isFinal(v)?"FINAL":isLive(v)?"LIVE":norm(v)?norm(v).replace(/_/g," ").toUpperCase():"UPCOMING"; }
function titleCase(v:string|null|undefined){ const x=norm(v); if(!x)return "—"; if(x==="head_to_head"||x==="h2h")return "HEAD-TO-HEAD"; return x.replace(/_/g," ").toUpperCase(); }
function record(s?:Standing){ return s?`${s.wins}-${s.losses}-${s.ties}`:"0-0-0"; }
function direction(r:CategoryRule):"higher"|"lower"{ const x=norm(r.direction); return x.includes("low")||x==="asc"||x==="ascending"?"lower":"higher"; }
function fmtCategory(key:string,v:number){ if(key.includes("save_percentage")) return v>0?v.toFixed(3).replace(/^0/,""):".000"; if(key.includes("goals_against_average")) return v.toFixed(2); return Math.abs(v)>=100?v.toFixed(0):v.toFixed(1); }
function fmtDate(v:string|null){ if(!v)return "TBD"; const d=new Date(v); return Number.isNaN(d.getTime())?"TBD":d.toLocaleString(undefined,{weekday:"short",month:"short",day:"numeric",hour:"numeric",minute:"2-digit"}); }
function errorMessage(e:unknown){ if(e instanceof Error)return e.message; if(e&&typeof e==="object"&&"message" in e)return String((e as {message?:unknown}).message??"Unknown error"); return "Unable to load detailed matchup."; }

function AcquisitionPill({summary}:{summary:AcquisitionSummary|undefined}){
  const used=n(summary?.usedForLimit);
  const pending=n(summary?.pending);
  const limit=summary?.limit==null?"∞":String(summary.limit);
  return <div style={S.acquisitionPill}>
    <strong>{used} / {limit}</strong>
    <span>{pending>0?`${pending} PENDING`:"USED"}</span>
  </div>;
}

export default function NhlTraditionalDetailedMatchup({leagueId,matchupId}:Props){
  const [settings,setSettings]=useState<Settings|null>(null); const [acquisitions,setAcquisitions]=useState<Map<number,AcquisitionSummary>>(new Map()); const [matchup,setMatchup]=useState<Matchup|null>(null); const [teams,setTeams]=useState<FantasyTeam[]>([]); const [standings,setStandings]=useState<Standing[]>([]); const [lineups,setLineups]=useState<LineupRow[]>([]); const [rosters,setRosters]=useState<RosterRow[]>([]); const [players,setPlayers]=useState<Player[]>([]); const [nhlTeams,setNhlTeams]=useState<NhlTeam[]>([]); const [games,setGames]=useState<Game[]>([]); const [stats,setStats]=useState<GameStat[]>([]); const [scores,setScores]=useState<GameScore[]>([]); const [projections,setProjections]=useState<Projection[]>([]); const [rankings,setRankings]=useState<Map<number,number>>(new Map()); const [categoryRules,setCategoryRules]=useState<CategoryRule[]>([]); const [loading,setLoading]=useState(true); const [error,setError]=useState(""); const [selectedDay,setSelectedDay]=useState<string>("");
  const isCategories=useMemo(()=>norm(settings?.scoring_system).includes("categor"),[settings?.scoring_system]);
  const teamById=useMemo(()=>new Map(teams.map(x=>[x.id,x])),[teams]); const standingByTeam=useMemo(()=>new Map(standings.map(x=>[x.fantasy_team_id,x])),[standings]); const playerById=useMemo(()=>new Map(players.map(x=>[x.id,x])),[players]); const nhlTeamById=useMemo(()=>new Map(nhlTeams.map(x=>[x.id,x])),[nhlTeams]); const gameById=useMemo(()=>new Map(games.map(x=>[x.id,x])),[games]); const projectionByPlayer=useMemo(()=>new Map(projections.map(x=>[x.nhl_player_id,x])),[projections]);
  const savedLineupDays=useMemo(()=>[...new Set(lineups.map(x=>x.lineup_date).filter((x):x is string=>Boolean(x)))].sort(),[lineups]);
  const lineupDays=useMemo(()=>savedLineupDays.length?savedLineupDays:["MON","TUE","WED","THU","FRI","SAT","SUN"],[savedLineupDays]);
  useEffect(()=>{if(!lineupDays.length)return;if(selectedDay&&lineupDays.includes(selectedDay))return;const today=new Date().toISOString().slice(0,10);setSelectedDay(lineupDays.includes(today)?today:lineupDays[0]);},[lineupDays,selectedDay]);


  const load=useCallback(async()=>{ setLoading(true); setError(""); try{
    const matchupResult=await supabase.from("nhl_traditional_matchups").select("id,league_id,season,week,home_fantasy_team_id,away_fantasy_team_id,home_score,away_score,status,winner_fantasy_team_id,is_tie").eq("league_id",leagueId).eq("id",matchupId).single(); if(matchupResult.error)throw matchupResult.error;
    const m={...(matchupResult.data as unknown as Matchup),id:n(matchupResult.data.id),season:n(matchupResult.data.season),week:n(matchupResult.data.week),home_fantasy_team_id:n(matchupResult.data.home_fantasy_team_id),away_fantasy_team_id:n(matchupResult.data.away_fantasy_team_id),home_score:n(matchupResult.data.home_score),away_score:n(matchupResult.data.away_score),winner_fantasy_team_id:matchupResult.data.winner_fantasy_team_id==null?null:n(matchupResult.data.winner_fantasy_team_id),is_tie:Boolean(matchupResult.data.is_tie)}; setMatchup(m);
    const [settingR,teamR,standingR,lineupR,rosterR,catR,projR,nhlTeamR]=await Promise.all([
      supabase.from("nhl_traditional_settings").select("season,league_format,competition_format,lineup_period,regular_season_weeks,playoff_weeks,scoring_system,goalie_minimum_starts").eq("league_id",leagueId).single(),
      supabase.from("fantasy_teams").select("id,team_name,owner_id,is_cpu").eq("league_id",leagueId).in("id",[m.home_fantasy_team_id,m.away_fantasy_team_id]),
      supabase.from("nhl_traditional_standings").select("fantasy_team_id,wins,losses,ties,points_for,points_against,rank").eq("league_id",leagueId).eq("season",m.season).in("fantasy_team_id",[m.home_fantasy_team_id,m.away_fantasy_team_id]),
      supabase.from("nhl_traditional_weekly_lineups").select("fantasy_team_id,nhl_player_id,nhl_game_id,lineup_slot,slot_index,lineup_date,game_start_at").eq("league_id",leagueId).eq("season",m.season).eq("week",m.week).in("fantasy_team_id",[m.home_fantasy_team_id,m.away_fantasy_team_id]),
      supabase.from("nhl_traditional_rosters").select("fantasy_team_id,nhl_player_id,roster_status").eq("league_id",leagueId).eq("season",m.season).in("fantasy_team_id",[m.home_fantasy_team_id,m.away_fantasy_team_id]).is("dropped_at",null),
      supabase.from("nhl_traditional_category_rules").select("stat_key,enabled,direction").eq("league_id",leagueId).eq("enabled",true),
      supabase.from("nhl_player_projections").select("nhl_player_id,projected_games_played,projected_goals,projected_assists,projected_points,projected_plus_minus,projected_penalty_minutes,projected_power_play_goals,projected_power_play_assists,projected_power_play_points,projected_short_handed_goals,projected_short_handed_assists,projected_short_handed_points,projected_game_winning_goals,projected_shots_on_goal,projected_hits,projected_blocked_shots,projected_goalie_starts,projected_goalie_wins,projected_goalie_losses,projected_goalie_ot_losses,projected_saves,projected_shots_against,projected_goals_against,projected_shutouts,projected_save_percentage,projected_goals_against_average,projected_goalie_minutes_seconds").eq("season",m.season),
      supabase.from("nhl_teams").select("id,abbreviation,display_name,logo_url").eq("active",true)
    ]);
    for(const r of [settingR,teamR,standingR,lineupR,rosterR,catR,projR,nhlTeamR]) if(r.error)throw r.error;
    setSettings(settingR.data as Settings);
    const acquisitionResults=await Promise.all(
      [m.home_fantasy_team_id,m.away_fantasy_team_id].map(async(teamId)=>{
        const result=await supabase.rpc("get_nhl_traditional_matchup_acquisition_summary",{
          p_league_id:leagueId,
          p_fantasy_team_id:teamId,
          p_season:m.season,
          p_week:m.week
        });
        if(result.error)throw result.error;
        return [teamId,result.data as AcquisitionSummary] as const;
      })
    );
    setAcquisitions(new Map(acquisitionResults));
    setTeams((teamR.data??[]) as FantasyTeam[]); setStandings((standingR.data??[]).map(x=>({...x,wins:n(x.wins),losses:n(x.losses),ties:n(x.ties),points_for:n(x.points_for),points_against:n(x.points_against),rank:x.rank==null?null:n(x.rank)})) as Standing[]); setCategoryRules((catR.data??[]) as CategoryRule[]); setNhlTeams((nhlTeamR.data??[]) as NhlTeam[]);
    setRosters((rosterR.data??[]).map(x=>({fantasy_team_id:n(x.fantasy_team_id),nhl_player_id:n(x.nhl_player_id),roster_status:x.roster_status})) as RosterRow[]); const l=(lineupR.data??[]).map(x=>({...x,fantasy_team_id:n(x.fantasy_team_id),nhl_player_id:n(x.nhl_player_id),nhl_game_id:x.nhl_game_id==null?null:n(x.nhl_game_id),slot_index:x.slot_index==null?null:n(x.slot_index)})) as LineupRow[]; setLineups(l);
    setProjections((projR.data??[]).map(raw=>{const x={...raw} as unknown as Projection; for(const k of Object.keys(x) as (keyof Projection)[]) x[k]=n(x[k]) as never; return x;}));
    const playerIds=[...new Set([...l.map(x=>x.nhl_player_id),...(rosterR.data??[]).map(x=>n(x.nhl_player_id))])]; const gameIds=[...new Set(l.map(x=>x.nhl_game_id).filter((x):x is number=>x!=null))];
    const playerR=playerIds.length?await supabase.from("nhl_players").select("id,team_id,display_name,short_name,jersey_number,position,position_group,injury_status,injury_detail,injury_return_date,injury_source,headshot_url").in("id",playerIds):{data:[],error:null}; if(playerR.error)throw playerR.error; setPlayers((playerR.data??[]) as Player[]);
    if(gameIds.length){ const [gameR,statR,scoreR]=await Promise.all([
      supabase.from("nhl_games").select("id,start_time,away_team_id,home_team_id,away_score,home_score,status_type,status_name,status_detail,period,display_clock,status_completed").in("id",gameIds),
      supabase.from("nhl_player_game_stats").select("nhl_game_id,nhl_player_id,goals,assists,points,plus_minus,penalty_minutes,power_play_goals,power_play_assists,power_play_points,short_handed_goals,short_handed_assists,short_handed_points,game_winning_goals,shots_on_goal,hits,blocked_shots,goalie_started,goalie_decision,saves,shots_against,goals_against,save_percentage,goalie_minutes_seconds,goalie_win,goalie_loss,goalie_overtime_loss,shutout,is_final").in("nhl_game_id",gameIds).in("nhl_player_id",playerIds),
      supabase.from("nhl_traditional_player_game_scores").select("nhl_game_id,nhl_player_id,fantasy_points,is_live,is_final").eq("league_id",leagueId).in("nhl_game_id",gameIds).in("nhl_player_id",playerIds)
    ]); for(const r of [gameR,statR,scoreR])if(r.error)throw r.error; setGames((gameR.data??[]) as Game[]); setStats((statR.data??[]).map(raw=>{const x={...raw} as unknown as GameStat; for(const k of ["goals","assists","points","plus_minus","penalty_minutes","power_play_goals","power_play_assists","power_play_points","short_handed_goals","short_handed_assists","short_handed_points","game_winning_goals","shots_on_goal","hits","blocked_shots","saves","shots_against","goals_against","save_percentage","goalie_minutes_seconds","goalie_win","goalie_loss","goalie_overtime_loss","shutout"] as (keyof GameStat)[]) x[k]=n(x[k]) as never; return x;}) as GameStat[]); setScores((scoreR.data??[]).map(x=>({...x,nhl_game_id:n(x.nhl_game_id),nhl_player_id:n(x.nhl_player_id),fantasy_points:n(x.fantasy_points)})) as GameScore[]); } else { setGames([]);setStats([]);setScores([]); }
    const rankingR=await supabase.rpc("get_nhl_traditional_draft_rankings",{p_league_id:leagueId,p_season:m.season}); if(!rankingR.error){ const map=new Map<number,number>(); for(const raw of Array.isArray(rankingR.data)?rankingR.data:[]){const x=raw as Record<string,unknown>; map.set(n(x.nhl_player_id??x.player_id),n(x.projected_fantasy_points??x.fantasy_points??x.projected_points));} setRankings(map); }
  }catch(e){console.error(e);setError(errorMessage(e));}finally{setLoading(false);} },[leagueId,matchupId]);
  useEffect(()=>{void load();},[load]);

  function activeRows(teamId:number){return lineups.filter(x=>x.fantasy_team_id===teamId&&!['bench','bn','ir','injured_reserve'].includes(norm(x.lineup_slot)));}
  function displayActiveRows(teamId:number){const hasRealDay=/^\d{4}-\d{2}-\d{2}$/.test(selectedDay);return activeRows(teamId).filter(x=>!hasRealDay||x.lineup_date===selectedDay);}
  function fallbackRosterIds(teamId:number){return [...new Set(rosters.filter(x=>x.fantasy_team_id===teamId&&!["dropped","inactive"].includes(norm(x.roster_status))).map(x=>x.nhl_player_id))];}

  function uniquePlayerIds(teamId:number){return [...new Set(activeRows(teamId).map(x=>x.nhl_player_id))];}
  function gameCount(teamId:number,playerId:number){const rows=activeRows(teamId).filter(x=>x.nhl_player_id===playerId);const ids=new Set(rows.map(x=>x.nhl_game_id).filter((x):x is number=>x!=null));if(ids.size)return ids.size;return new Set(rows.map(x=>x.lineup_date).filter(Boolean)).size;}
  function playerActual(teamId:number,playerId:number){const allowed=new Set(activeRows(teamId).filter(x=>x.nhl_player_id===playerId&&x.nhl_game_id!=null).map(x=>`${x.nhl_game_id}:${playerId}`)); const statRows=stats.filter(x=>x.nhl_player_id===playerId&&allowed.has(`${x.nhl_game_id}:${playerId}`)); const scoreRows=scores.filter(x=>x.nhl_player_id===playerId&&allowed.has(`${x.nhl_game_id}:${playerId}`)); return {fp:scoreRows.reduce((a,x)=>a+x.fantasy_points,0),stats:statRows};}
  function projectedFp(teamId:number,playerId:number){const p=projectionByPlayer.get(playerId);if(!p)return 0;return (rankings.get(playerId)??0)*(gameCount(teamId,playerId)/Math.max(1,p.projected_games_played));}
  function teamActualFp(teamId:number){return uniquePlayerIds(teamId).reduce((a,id)=>a+playerActual(teamId,id).fp,0);}
  function teamProjectedFp(teamId:number){return uniquePlayerIds(teamId).reduce((a,id)=>a+projectedFp(teamId,id),0);}
  function categoryTotals(teamId:number,projected:boolean){const out:Record<string,number>={};let saves=0,shots=0,ga=0,mins=0; for(const pid of uniquePlayerIds(teamId)){ if(projected){const p=projectionByPlayer.get(pid);if(!p)continue;const mult=gameCount(teamId,pid)/Math.max(1,p.projected_games_played);for(const r of categoryRules){const key=norm(r.stat_key),d=CATEGORIES[key];if(d?.projectionField)out[key]=(out[key]??0)+n(p[d.projectionField])*mult;}saves+=p.projected_saves*mult;shots+=p.projected_shots_against*mult;ga+=p.projected_goals_against*mult;mins+=p.projected_goalie_minutes_seconds*mult;}else{const rows=playerActual(teamId,pid).stats;for(const st of rows){for(const r of categoryRules){const key=norm(r.stat_key),d=CATEGORIES[key];if(key==="goalie_starts")out[key]=(out[key]??0)+(st.goalie_started?1:0);else if(d?.field)out[key]=(out[key]??0)+n(st[d.field]);}saves+=st.saves;shots+=st.shots_against;ga+=st.goals_against;mins+=st.goalie_minutes_seconds;}}} for(const r of categoryRules){const key=norm(r.stat_key),d=CATEGORIES[key];if(d?.ratio==="save_percentage")out[key]=shots>0?saves/shots:0;if(d?.ratio==="gaa")out[key]=mins>0?(ga*3600)/mins:0;}return out;}
  function categoryResults(projected:boolean):CategoryResult[]{if(!matchup)return[];const h=categoryTotals(matchup.home_fantasy_team_id,projected),a=categoryTotals(matchup.away_fantasy_team_id,projected);return categoryRules.map(r=>{const key=norm(r.stat_key),d=CATEGORIES[key];if(!d)return null;const hv=h[key]??0,av=a[key]??0,dir=direction(r),tol=d.ratio==="save_percentage"?.0005:d.ratio==="gaa"?.005:.0001;let winner:"home"|"away"|"tie"="tie";if(Math.abs(hv-av)>tol)winner=dir==="lower"?(hv<av?"home":"away"):(hv>av?"home":"away");return{key,label:d.label,home:hv,away:av,direction:dir,winner};}).filter((x):x is CategoryResult=>x!==null);}
  function categoryProbability(rows:CategoryResult[]){if(!rows.length)return{home:50,away:50};const hw=rows.filter(x=>x.winner==="home").length,aw=rows.filter(x=>x.winner==="away").length,t=rows.filter(x=>x.winner==="tie").length,total=Math.max(1,hw+aw+t);const home=((hw+t*.5)/total)*100;return{home,away:100-home};}

  if(loading)return <main style={S.page}><div style={S.loading}>Loading detailed NHL matchup…</div></main>;
  if(error||!matchup)return <main style={S.page}><div style={S.shell}><div style={S.error}><strong>Detailed matchup could not load.</strong><span>{error||"Matchup not found."}</span><button style={S.retry} onClick={()=>void load()}>TRY AGAIN</button></div></div></main>;
  const home=teamById.get(matchup.home_fantasy_team_id),away=teamById.get(matchup.away_fantasy_team_id); const homeName=home?.team_name??"Home Team",awayName=away?.team_name??"Away Team"; const homeActual=teamActualFp(matchup.home_fantasy_team_id),awayActual=teamActualFp(matchup.away_fantasy_team_id),homeProj=teamProjectedFp(matchup.home_fantasy_team_id),awayProj=teamProjectedFp(matchup.away_fantasy_team_id); const actualCats=isCategories?categoryResults(false):[],projCats=isCategories?categoryResults(true):[];
  const probability=isCategories?categoryProbability(projCats):{home:homeProj+awayProj>0?homeProj/(homeProj+awayProj)*100:50,away:homeProj+awayProj>0?awayProj/(homeProj+awayProj)*100:50};
  return <main className="g365-detail" style={S.page}><style>{`.g365-detail,.g365-detail *{box-sizing:border-box}.g365-detail{overflow-x:hidden}.espn-cats{scrollbar-width:thin}.espn-cats::-webkit-scrollbar{height:6px}.espn-cats::-webkit-scrollbar-thumb{background:#3a3d42;border-radius:999px}.lineup-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:1px;background:#2a2c30;border:1px solid #2a2c30}.player-row{display:grid;grid-template-columns:34px minmax(135px,1.15fr) minmax(100px,.8fr) minmax(115px,.9fr) 58px;gap:7px;align-items:center}@media(max-width:900px){.lineup-grid{grid-template-columns:1fr}.player-row{grid-template-columns:32px minmax(120px,1fr) 95px minmax(100px,.8fr) 52px}}@media(max-width:560px){.g365-detail{padding:8px 5px 36px!important}.team-title{font-size:17px!important}.hero-title{font-size:27px!important}.player-row{padding:8px 6px!important}}`}</style><div style={S.shell}>
    <section style={S.hero}><div><div style={S.eyebrow}>GRIDIRON365 • NHL TRADITIONAL</div><h1 className="hero-title" style={S.title}>Matchup</h1><p style={S.sub}>{matchup.week>(settings?.regular_season_weeks??99)?"NHL PLAYOFFS":"REGULAR SEASON"} • WEEK {matchup.week}</p></div><div style={S.badges}><span style={S.badge}>{titleCase(settings?.league_format)}</span><span style={S.badge}>{titleCase(settings?.scoring_system)}</span><span style={S.badge}>{statusLabel(matchup.status)}</span></div></section>
    <Link href={`/league/${leagueId}/nhl/matchups`} style={S.back}>← BACK TO MATCHUPS</Link>

    <section style={S.espnScoreboard}>
      <div className="score-grid" style={S.scoreGrid}><TeamHead name={homeName} standing={standingByTeam.get(matchup.home_fantasy_team_id)} /><div style={S.vs}>VS</div><TeamHead name={awayName} standing={standingByTeam.get(matchup.away_fantasy_team_id)} /></div>
      <div style={S.acquisitionGrid}>
        <AcquisitionPill summary={acquisitions.get(matchup.home_fantasy_team_id)} />
        <span style={S.acquisitionSpacer}>MATCHUP ACQUISITIONS</span>
        <AcquisitionPill summary={acquisitions.get(matchup.away_fantasy_team_id)} />
      </div>
      {!isCategories?<><div style={S.bigScore}><strong>{homeActual.toFixed(1)}</strong><span>—</span><strong>{awayActual.toFixed(1)}</strong></div></>:null}
      {isCategories?<CategoryBoard rows={actualCats} home={homeName} away={awayName} title="LIVE MATCHUP"/>:null}
      <div style={S.probWrap}>
        <div style={S.probHeader}><span>{homeName} <strong>{probability.home.toFixed(0)}%</strong></span><b>G365 MATCHUP PROBABILITY</b><span style={{textAlign:"right"}}><strong>{probability.away.toFixed(0)}%</strong> {awayName}</span></div>
        <div style={S.probTrack}><div style={{...S.probHome,width:`${probability.home}%`}}/><div style={{...S.probAway,width:`${probability.away}%`}}/></div>
        {isCategories?<div style={S.projectedMini}>PROJECTED CATEGORY SCORE • {projCats.filter(x=>x.winner==="home").length} - {projCats.filter(x=>x.winner==="away").length}{projCats.filter(x=>x.winner==="tie").length?` • ${projCats.filter(x=>x.winner==="tie").length} TIE`:""}</div>:<div style={S.projectedMini}>PROJECTED POINTS • {homeProj.toFixed(1)} - {awayProj.toFixed(1)}</div>}
      </div>
    </section>

    <section style={S.rosterSection}>
      <div style={S.rosterTitleBar}><strong>SELECT DAY (LINEUPS)</strong><span>WEEK {matchup.week}</span></div>
      <div className="day-tabs" style={S.dayTabs}>{lineupDays.map(day=>{const real=/^\d{4}-\d{2}-\d{2}$/.test(day);const dt=real?new Date(`${day}T12:00:00`):null;const weekday=dt&&!Number.isNaN(dt.getTime())?dt.toLocaleDateString(undefined,{weekday:"short"}):day;const date=dt&&!Number.isNaN(dt.getTime())?dt.toLocaleDateString(undefined,{month:"short",day:"numeric"}):"LINEUP";return <button key={day} type="button" onClick={()=>setSelectedDay(day)} style={{...S.dayButton,...(selectedDay===day?S.dayButtonActive:{})}}><strong>{weekday}</strong><span>{date}</span></button>})}</div>
      <div className="lineup-grid"><Lineup teamId={matchup.home_fantasy_team_id} teamName={homeName} label="YOUR ROSTER"/><Lineup teamId={matchup.away_fantasy_team_id} teamName={awayName} label="OPPONENT ROSTER"/></div>
    </section>
    {isCategories&&settings?.goalie_minimum_starts?<div style={S.note}>Goalie minimum: {settings.goalie_minimum_starts} starts for the matchup period.</div>:null}
  </div></main>;

  function Lineup({teamId,teamName,label}:{teamId:number;teamName:string;label:string}){const ids=[...new Set(displayActiveRows(teamId).map(x=>x.nhl_player_id))];return <div style={S.lineupCard}><div style={S.lineupHead}><div><small style={S.lineupLabel}>{label} — {teamName}</small></div><span style={S.lineupDay}>{selectedDay?new Date(`${selectedDay}T12:00:00`).toLocaleDateString(undefined,{weekday:"long",month:"short",day:"numeric"}):`${ids.length} ACTIVE`}</span></div><div style={S.columnHead}><span>POS</span><span>PLAYER</span><span>OPP / STATUS</span><span>STATS</span><span style={{textAlign:"right"}}>FP</span></div>{ids.length===0?<div style={S.empty}>No active lineup has been saved for this week.</div>:ids.map(pid=>{const p=playerById.get(pid);const rows=displayActiveRows(teamId).filter(x=>x.nhl_player_id===pid).sort((a,b)=>(a.game_start_at??"").localeCompare(b.game_start_at??""));const slot=rows[0]?.lineup_slot??p?.position??"—";const actual=playerActual(teamId,pid);const firstGame=rows.find(x=>x.nhl_game_id!=null);const game=firstGame?.nhl_game_id?gameById.get(firstGame.nhl_game_id):undefined;const own= p?.team_id?nhlTeamById.get(p.team_id):undefined;const oppId=game?(game.home_team_id===p?.team_id?game.away_team_id:game.home_team_id):null;const opp=oppId?nhlTeamById.get(oppId):undefined;const atHome=game?.home_team_id===p?.team_id;const statSummary=actual.stats.map(st=>p?.position_group?.toUpperCase()==="G"||p?.position?.toUpperCase()==="G"?`${st.saves} SV • ${st.goals_against} GA${st.goalie_started?" • START":""}`:`${st.goals} G • ${st.assists} A • ${st.shots_on_goal} SOG • ${st.hits} HIT`).join(" | ")||"No game stats yet";return <div className="player-row" style={S.playerRow} key={pid}><div style={S.slot}>{txt(slot,"—").toUpperCase()}</div><div style={S.playerCell}>{p?.headshot_url?<img src={p.headshot_url} alt="" style={S.headshot}/>:<div style={S.headshotBlank}/>}<div style={{minWidth:0}}>
  <div style={S.playerNameRow}>
    <strong style={S.playerName}>{p?.display_name??`Player ${pid}`}</strong>
    <NhlInjuryBadge
      status={p?.injury_status}
      detail={p?.injury_detail}
      returnDate={p?.injury_return_date}
      source={p?.injury_source}
    />
  </div>
  <small>{own?.abbreviation??"NHL"} • {p?.position??"—"}</small>
</div></div><div style={S.gameInfo}><small style={S.playerDay}>{rows[0]?.lineup_date?new Date(`${rows[0].lineup_date}T12:00:00`).toLocaleDateString(undefined,{weekday:"short",month:"short",day:"numeric"}):(selectedDay||"—")}</small>{game?<><strong>{atHome?"vs":"@"} {opp?.abbreviation??"TBD"}</strong><small>{game.status_completed?`FINAL ${game.away_score??0}-${game.home_score??0}`:txt(game.status_detail)||fmtDate(game.start_time)}</small></>:<><strong>NO GAME</strong></>}</div><div style={S.statLine}>{statSummary}</div><div style={S.actual}><strong>{actual.fp.toFixed(1)}</strong><small>PROJ {projectedFp(teamId,pid).toFixed(1)}</small></div></div>})}</div>}
}

function TeamHead({name,standing}:{name:string;standing?:Standing}){return <div style={S.teamHead}><div className="team-title" style={S.teamTitle}>{name}</div><span>{record(standing)}{standing?.rank?` • #${standing.rank}`:""}</span><small>PF {(standing?.points_for??0).toFixed(1)}</small></div>}
function CategoryBoard({rows,home,away,title}:{rows:CategoryResult[];home:string;away:string;title:string}){const hw=rows.filter(x=>x.winner==="home").length,aw=rows.filter(x=>x.winner==="away").length,t=rows.filter(x=>x.winner==="tie").length;return <div style={S.catBoard}><div className="espn-cats" style={S.categoryTableScroll}><div style={{...S.categoryTableGrid,gridTemplateColumns:`150px repeat(${rows.length}, minmax(66px, 1fr))`}}><div style={{...S.categoryTableCell,...S.categoryTeamHeader}}>TEAM</div>{rows.map(r=><div key={`h-${r.key}`} style={{...S.categoryTableCell,...S.categoryStatHeader}}>{r.label}{r.direction==="lower"?<small>LOW</small>:null}</div>)}<div style={{...S.categoryTableCell,...S.categoryTeamCell}}><strong>{home}</strong></div>{rows.map(r=><div key={`home-${r.key}`} style={{...S.categoryTableCell,...S.categoryStatCell,...(r.winner==="home"?S.categoryWinnerCell:{})}}>{fmtCategory(r.key,r.home)}</div>)}<div style={{...S.categoryTableCell,...S.categoryTeamCell}}><strong>{away}</strong></div>{rows.map(r=><div key={`away-${r.key}`} style={{...S.categoryTableCell,...S.categoryStatCell,...(r.winner==="away"?S.categoryWinnerCell:{})}}>{fmtCategory(r.key,r.away)}</div>)}</div></div><div style={S.catSummary}><span>{home}</span><strong>{hw} - {aw}{t?` (${t}T)`:""}</strong><span style={{textAlign:"right"}}>{away}</span></div></div>}

const S:Record<string,React.CSSProperties>={
  page:{minHeight:"100vh",background:"#090a0c",color:"#f4f5f6",padding:"14px 10px 50px"},
  shell:{width:"min(1180px,100%)",margin:"0 auto",display:"grid",gap:12},
  loading:{padding:50,textAlign:"center",color:"#9a9da3"},
  hero:{display:"flex",justifyContent:"space-between",alignItems:"center",gap:14,flexWrap:"wrap",padding:"16px 18px",border:"1px solid #25272b",borderRadius:8,background:"#111214"},
  eyebrow:{color:"#ff6a00",fontSize:9,fontWeight:1000,letterSpacing:1.2},
  title:{margin:"3px 0",fontSize:"clamp(27px,4vw,38px)",lineHeight:1,fontWeight:1000},
  sub:{margin:"6px 0 0",color:"#9a9da3",fontSize:12},
  badges:{display:"flex",gap:6,flexWrap:"wrap"},
  badge:{padding:"5px 8px",border:"1px solid #3b2a22",borderRadius:4,background:"#19120f",color:"#ff8745",fontSize:9,fontWeight:900},
  back:{justifySelf:"start",color:"#ff7b31",textDecoration:"none",fontSize:10,fontWeight:950},
  espnScoreboard:{border:"1px solid #2a2c30",borderRadius:8,overflow:"hidden",background:"#111214"},
  scoreGrid:{width:"min(560px,100%)",margin:"0 auto",padding:"10px 12px",background:"#151619",display:"grid",gridTemplateColumns:"1fr auto 1fr",alignItems:"center",gap:24},
  teamHead:{display:"flex",flexDirection:"column",gap:2,minWidth:0,justifyContent:"center",alignItems:"center",textAlign:"center"},
  teamTitle:{fontSize:15,fontWeight:1000,overflowWrap:"anywhere"},
  vs:{display:"flex",alignItems:"center",justifyContent:"center",textAlign:"center",color:"#858990",fontWeight:1000,fontSize:10},
  bigScore:{display:"flex",justifyContent:"center",alignItems:"center",gap:18,padding:"12px",borderTop:"1px solid #2a2c30",fontSize:"clamp(28px,5vw,46px)",fontWeight:1000},
  catBoard:{borderTop:"1px solid #2a2c30",background:"#0f1012"},
  categoryTableScroll:{width:"100%",overflowX:"auto",overflowY:"hidden",WebkitOverflowScrolling:"touch",scrollbarWidth:"thin"},
  categoryTableGrid:{display:"grid",minWidth:"max-content"},
  categoryTableCell:{minHeight:44,padding:"8px 9px",display:"flex",alignItems:"center",justifyContent:"center",borderRight:"1px solid #292b2f",borderBottom:"1px solid #292b2f"},
  categoryTeamHeader:{position:"sticky",left:0,zIndex:3,justifyContent:"flex-start",background:"#0d0e10",color:"#8e9298",fontSize:9,fontWeight:1000},
  categoryStatHeader:{flexDirection:"column",gap:1,background:"#0d0e10",color:"#c7c9cd",fontSize:10,fontWeight:1000},
  categoryTeamCell:{position:"sticky",left:0,zIndex:2,justifyContent:"flex-start",background:"#141518",color:"#f4f5f6",fontSize:11,fontWeight:1000},
  categoryStatCell:{background:"#111214",color:"#d7d9dc",fontSize:14,fontWeight:800},
  categoryWinnerCell:{color:"#ff6a00",fontWeight:1000,background:"#1a120e"},
  catSummary:{display:"grid",gridTemplateColumns:"1fr auto 1fr",gap:10,padding:"8px 10px",fontSize:10,color:"#a7aab0"},
  winValue:{color:"#ff7b31"},
  probWrap:{padding:"11px 12px 12px",borderTop:"1px solid #2a2c30",background:"#151619"},
  probHeader:{display:"grid",gridTemplateColumns:"1fr auto 1fr",gap:8,alignItems:"end",marginBottom:7,fontSize:9,color:"#a4a7ad"},
  probTrack:{height:10,display:"flex",overflow:"hidden",borderRadius:2,background:"#2a2c30"},
  probHome:{height:"100%",background:"linear-gradient(90deg,#ff3d19,#ff6a00)"},
  probAway:{height:"100%",background:"#5a5e65"},
  projectedMini:{marginTop:6,textAlign:"center",color:"#858990",fontSize:9,fontWeight:900,letterSpacing:.4},
  rosterSection:{border:"1px solid #2a2c30",borderRadius:8,overflow:"hidden",background:"#111214"},
  rosterTitleBar:{display:"flex",justifyContent:"space-between",padding:"9px 12px",background:"#0d0e10",borderBottom:"1px solid #2a2c30",fontSize:10,color:"#a7aab0"},
  dayTabs:{display:"flex",gap:7,padding:"10px 12px",overflowX:"auto",borderBottom:"1px solid #2a2c30",background:"#0d0e10",WebkitOverflowScrolling:"touch"},
  dayButton:{flex:"1 0 104px",minHeight:54,padding:"7px 13px",border:"1px solid #3a3d42",borderRadius:10,background:"#141518",color:"#d8dade",fontSize:11,fontWeight:900,cursor:"pointer",display:"grid",gap:2,justifyItems:"center",alignContent:"center"},
  dayButtonActive:{border:"2px solid #ff3d19",background:"#1d100d",color:"#fff",boxShadow:"0 0 10px rgba(255,61,25,.22)"},

  lineupCard:{minWidth:0,background:"#111214"},
  lineupHead:{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,padding:"11px 10px",borderBottom:"1px solid #2a2c30",background:"#17181b",color:"#fff"},
  lineupLabel:{display:"block",marginBottom:2,color:"#ff6a00",fontSize:9,fontWeight:1000,letterSpacing:1},lineupDay:{color:"#f1f2f4",fontSize:10,fontWeight:900},
  columnHead:{display:"grid",gridTemplateColumns:"34px minmax(135px,1.15fr) minmax(100px,.8fr) minmax(115px,.9fr) 58px",gap:7,padding:"6px 8px",borderBottom:"1px solid #292b2f",background:"#0d0e10",color:"#a7aab0",fontSize:8,fontWeight:1000},
  playerRow:{padding:"8px",borderBottom:"1px solid #232529",minWidth:0,background:"#121315"},
  slot:{display:"flex",alignItems:"center",justifyContent:"center",minHeight:27,borderRadius:3,background:"#222429",color:"#f2f3f4",fontSize:9,fontWeight:1000},
  playerCell:{display:"flex",alignItems:"center",gap:7,minWidth:0},
  playerNameRow:{display:"flex",alignItems:"center",gap:4,minWidth:0},
  playerName:{display:"block",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontSize:11},
  headshot:{width:31,height:31,borderRadius:"50%",objectFit:"cover",background:"#1d1f22"},
  headshotBlank:{width:31,height:31,borderRadius:"50%",background:"#1d1f22",flex:"0 0 auto"},
  gameInfo:{display:"grid",gap:1,fontSize:9,color:"#d0d2d5"},playerDay:{color:"#ff8745",fontSize:8,fontWeight:1000,textTransform:"uppercase"},statLine:{fontSize:9,color:"#c6c9ce",lineHeight:1.25,overflow:"hidden",textOverflow:"ellipsis"},
  actual:{display:"grid",gap:2,textAlign:"right",fontSize:10,overflow:"hidden"},
  note:{padding:"9px 11px",border:"1px solid #3a2a22",borderRadius:5,background:"#17110e",color:"#aaa",fontSize:10,lineHeight:1.4},
  empty:{padding:22,textAlign:"center",color:"#777"},
  error:{padding:16,border:"1px solid #7d2d27",borderRadius:8,background:"#2b1110",color:"#ffd1cc",display:"grid",gap:8},
  retry:{justifySelf:"start",border:0,borderRadius:5,padding:"8px 12px",background:"#ff4b20",color:"#fff",fontWeight:900,cursor:"pointer"},

  acquisitionGrid:{display:"grid",gridTemplateColumns:"minmax(0,1fr) auto minmax(0,1fr)",alignItems:"center",gap:6,padding:"0 8px 7px"},
  acquisitionPill:{justifySelf:"center",minWidth:78,padding:"5px 8px",border:"1px solid rgba(255,116,20,.24)",borderRadius:8,background:"rgba(255,92,0,.055)",display:"flex",alignItems:"baseline",justifyContent:"center",gap:4,fontSize:11},
  acquisitionSpacer:{color:"#777e89",fontSize:7,fontWeight:900,letterSpacing:".07em",textAlign:"center"},
};
