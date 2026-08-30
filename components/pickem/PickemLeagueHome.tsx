import Link from "next/link";

import {
  createSupabaseServerClient,
} from "@/lib/supabase/server";

import {
  requireLeagueMember,
} from "@/lib/leagues/requireLeagueMember";


type Props = {
  leagueId: string;
};


type PickemSettingsRow = {
  football_scope: string;
  picks_per_week: number;
  pick_lock_mode: string;
  minimum_source_books: number;
};


type WeekRow = {
  id: number;
  season: number;
  week: number;
  status: string;
  required_picks: number;
  finalized_at: string | null;
};


function formatScope(value: string) {
  if (value === "college_only") return "College Football Only";
  if (value === "nfl_only") return "NFL Only";
  return "College + NFL";
}


function formatLockMode(value: string) {
  return value === "full_card"
    ? "Full Weekly Card Lock"
    : "Each Pick Locks at Kickoff";
}


export default async function PickemLeagueHome({
  leagueId,
}: Props) {
  const access =
    await requireLeagueMember(
      leagueId
    );

  const supabase =
    await createSupabaseServerClient();

  const { data: settingsData } =
    await supabase
      .from("pickem_settings")
      .select(
        "football_scope,picks_per_week,pick_lock_mode,minimum_source_books"
      )
      .eq("league_id", leagueId)
      .maybeSingle();

  const settings =
    settingsData as PickemSettingsRow | null;

  const { data: weekData } =
    await supabase
      .from("pickem_weeks")
      .select(
        "id,season,week,status,required_picks,finalized_at"
      )
      .eq("league_id", leagueId)
      .neq("status", "final")
      .order("week", {
        ascending: true,
      })
      .limit(1)
      .maybeSingle();

  let currentWeek =
    weekData as WeekRow | null;

  if (!currentWeek) {
    const { data: latestFinal } =
      await supabase
        .from("pickem_weeks")
        .select(
          "id,season,week,status,required_picks,finalized_at"
        )
        .eq("league_id", leagueId)
        .eq("status", "final")
        .order("week", {
          ascending: false,
        })
        .limit(1)
        .maybeSingle();

    currentWeek =
      latestFinal as WeekRow | null;
  }

  const fantasyTeamId =
    access.fantasyTeam?.id ??
    null;

  let selectedPicks = 0;
  let wins = 0;
  let losses = 0;
  let pushes = 0;

  if (
    currentWeek &&
    fantasyTeamId
  ) {
    const { count } =
      await supabase
        .from("pickem_picks")
        .select("id", {
          count: "exact",
          head: true,
        })
        .eq(
          "pickem_week_id",
          currentWeek.id
        )
        .eq(
          "fantasy_team_id",
          fantasyTeamId
        )
        .neq("result", "void");

    selectedPicks =
      count ?? 0;

    const { data: resultData } =
      await supabase
        .from(
          "pickem_weekly_results"
        )
        .select(
          "wins,losses,pushes"
        )
        .eq(
          "pickem_week_id",
          currentWeek.id
        )
        .eq(
          "fantasy_team_id",
          fantasyTeamId
        )
        .maybeSingle();

    if (resultData) {
      wins =
        Number(resultData.wins) || 0;
      losses =
        Number(resultData.losses) || 0;
      pushes =
        Number(resultData.pushes) || 0;
    }
  }

  const requiredPicks =
    currentWeek?.required_picks ??
    settings?.picks_per_week ??
    5;

  return (
    <main
      style={{
        display: "grid",
        gap: 18,
        padding: "22px 18px 34px",
      }}
    >
      <section
        style={{
          padding: 22,
          borderRadius: 18,
          border:
            "1px solid rgba(255,102,0,0.28)",
          background:
            "linear-gradient(135deg, rgba(105,7,12,0.42), rgba(20,20,24,0.96) 48%, rgba(132,48,0,0.28))",
          boxShadow:
            "0 20px 50px rgba(0,0,0,0.28)",
        }}
      >
        <div
          style={{
            color: "#ff7627",
            fontSize: 12,
            fontWeight: 1000,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
          }}
        >
          G365 Football Pick&apos;em
        </div>

        <h2
          style={{
            margin: "7px 0 8px",
            color: "white",
            fontSize: "clamp(28px, 5vw, 46px)",
            lineHeight: 1,
          }}
        >
          Beat the G365 Spread.
        </h2>

        <p
          style={{
            margin: 0,
            maxWidth: 760,
            color: "#b9b9bf",
            lineHeight: 1.65,
          }}
        >
          Make exactly {requiredPicks} ATS picks this week. Each selection stays private to the league until that specific game kicks off.
        </p>
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit,minmax(180px,1fr))",
          gap: 12,
        }}
      >
        {[
          [
            "Current Week",
            currentWeek
              ? `Week ${currentWeek.week}`
              : "Not Open Yet",
          ],
          [
            "Your Picks",
            `${selectedPicks} / ${requiredPicks}`,
          ],
          [
            "Live Record",
            `${wins}-${losses}${pushes ? `-${pushes}` : ""}`,
          ],
          [
            "Eligible Football",
            formatScope(
              settings?.football_scope ??
                "college_nfl"
            ),
          ],
        ].map(([label, value]) => (
          <div
            key={label}
            style={{
              padding: 16,
              borderRadius: 14,
              border:
                "1px solid rgba(255,255,255,0.08)",
              background: "#111115",
            }}
          >
            <div
              style={{
                color: "#8f8f98",
                fontSize: 11,
                fontWeight: 900,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              {label}
            </div>
            <div
              style={{
                marginTop: 7,
                color: "#fff",
                fontSize: 20,
                fontWeight: 950,
              }}
            >
              {value}
            </div>
          </div>
        ))}
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit,minmax(220px,1fr))",
          gap: 12,
        }}
      >
        {[
          [
            "My Picks",
            `Choose your ${requiredPicks} ATS games for the week.`,
            `/league/${leagueId}/pickem/my-picks`,
          ],
          [
            "League Picks",
            "See every member's picks as each selected game reaches kickoff.",
            `/league/${leagueId}/pickem/league-picks`,
          ],
          [
            "Live Games",
            "Follow scores, quarter, clock and live ATS position.",
            `/league/${leagueId}/pickem/games`,
          ],
          [
            "Standings",
            "Track weekly and season-long Pick'em records.",
            `/league/${leagueId}/pickem/standings`,
          ],
        ].map(
          ([title, description, href]) => (
            <Link
              key={href}
              href={href}
              style={{
                display: "block",
                padding: 18,
                borderRadius: 14,
                border:
                  "1px solid rgba(255,255,255,0.09)",
                background:
                  "linear-gradient(180deg,#151519,#0e0e11)",
                color: "inherit",
                textDecoration: "none",
              }}
            >
              <div
                style={{
                  color: "#fff",
                  fontSize: 18,
                  fontWeight: 950,
                }}
              >
                {title}
              </div>
              <div
                style={{
                  marginTop: 7,
                  color: "#9f9fa7",
                  lineHeight: 1.5,
                }}
              >
                {description}
              </div>
            </Link>
          )
        )}
      </section>

      <section
        style={{
          padding: 16,
          borderRadius: 14,
          border:
            "1px solid rgba(255,255,255,0.08)",
          background: "#0f0f12",
          color: "#aaaab2",
          lineHeight: 1.6,
        }}
      >
        <strong style={{ color: "white" }}>
          League rule:
        </strong>{" "}
        {formatLockMode(
          settings?.pick_lock_mode ??
            "per_game"
        )}. Picks are always revealed one-by-one only when their own game kicks off. Weekly results remain live until the final game of the Pick&apos;em week is complete and the Monday-night finalization gate is satisfied.
      </section>
    </main>
  );
}
