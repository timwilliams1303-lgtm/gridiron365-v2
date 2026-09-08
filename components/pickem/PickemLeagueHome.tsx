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


type PickemSport =
  | "cfb"
  | "nfl"
  | "nhl";


type PickemSettingsRow = {
  football_scope: string;
  enabled_sports: string[] | null;
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


type NhlPeriodRow = {
  id: number;
  league_id: string;
  season: number;
  period_number: number;
  status: string;
  starts_at: string;
  ends_at: string;
  finalized_at: string | null;
};


type NhlEntryRow = {
  id: number;
  fantasy_team_id: number;
  season: number;
};


type NhlPeriodResultRow = {
  required_picks: number;
  wins: number;
  pushes: number;
  losses: number;
};


function normalizeEnabledSports(
  settings: PickemSettingsRow | null
): PickemSport[] {
  const explicit =
    Array.isArray(
      settings?.enabled_sports
    )
      ? settings!.enabled_sports
          .map((value) =>
            String(value)
              .trim()
              .toLowerCase()
          )
          .filter(
            (
              value
            ): value is PickemSport =>
              value === "cfb" ||
              value === "nfl" ||
              value === "nhl"
          )
      : [];

  if (explicit.length > 0) {
    return Array.from(
      new Set(explicit)
    );
  }

  if (
    settings?.football_scope ===
    "college_only"
  ) {
    return ["cfb"];
  }

  if (
    settings?.football_scope ===
    "nfl_only"
  ) {
    return ["nfl"];
  }

  return ["cfb", "nfl"];
}


function formatEnabledSports(
  sports: PickemSport[]
) {
  const labels: Record<
    PickemSport,
    string
  > = {
    cfb: "College Football",
    nfl: "NFL",
    nhl: "NHL",
  };

  return sports
    .map((sport) => labels[sport])
    .join(" + ");
}


function formatLockMode(value: string) {
  return value === "full_card"
    ? "Full Weekly Card Lock"
    : "Each Pick Locks at Game Start";
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
        [
          "football_scope",
          "enabled_sports",
          "picks_per_week",
          "pick_lock_mode",
          "minimum_source_books",
        ].join(",")
      )
      .eq("league_id", leagueId)
      .maybeSingle();

  const settings =
    settingsData as
      | PickemSettingsRow
      | null;

  const enabledSports =
    normalizeEnabledSports(
      settings
    );

  const nhlOnly =
    enabledSports.length === 1 &&
    enabledSports[0] === "nhl";

  const includesNhl =
    enabledSports.includes("nhl");

  const includesFootball =
    enabledSports.includes("cfb") ||
    enabledSports.includes("nfl");

  const fantasyTeamId =
    access.fantasyTeam?.id ??
    null;

  let currentWeek:
    | WeekRow
    | null = null;

  let currentNhlPeriod:
    | NhlPeriodRow
    | null = null;

  let displayWeekNumber:
    | number
    | null = null;

  let selectedPicks = 0;
  let wins = 0;
  let losses = 0;
  let pushes = 0;

  let requiredPicks =
    settings?.picks_per_week ??
    5;

  if (!nhlOnly) {
    const {
      data: weekData,
    } = await supabase
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

    currentWeek =
      weekData as
        | WeekRow
        | null;

    if (!currentWeek) {
      const {
        data: latestFinal,
      } = await supabase
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
        latestFinal as
          | WeekRow
          | null;
    }

    if (currentWeek) {
      displayWeekNumber =
        currentWeek.week;

      requiredPicks =
        currentWeek.required_picks ??
        requiredPicks;
    }
  }

  if (includesNhl) {
    if (nhlOnly) {
      const {
        data: openPeriodData,
      } = await supabase
        .from(
          "nhl_pickem_periods"
        )
        .select(
          [
            "id",
            "league_id",
            "season",
            "period_number",
            "status",
            "starts_at",
            "ends_at",
            "finalized_at",
          ].join(",")
        )
        .eq(
          "league_id",
          leagueId
        )
        .neq(
          "status",
          "final"
        )
        .order(
          "period_number",
          {
            ascending: true,
          }
        )
        .limit(1)
        .maybeSingle();

      currentNhlPeriod =
        openPeriodData as
          | NhlPeriodRow
          | null;

      if (!currentNhlPeriod) {
        const {
          data: latestFinalData,
        } = await supabase
          .from(
            "nhl_pickem_periods"
          )
          .select(
            [
              "id",
              "league_id",
              "season",
              "period_number",
              "status",
              "starts_at",
              "ends_at",
              "finalized_at",
            ].join(",")
          )
          .eq(
            "league_id",
            leagueId
          )
          .eq(
            "status",
            "final"
          )
          .order(
            "period_number",
            {
              ascending: false,
            }
          )
          .limit(1)
          .maybeSingle();

        currentNhlPeriod =
          latestFinalData as
            | NhlPeriodRow
            | null;
      }

      if (currentNhlPeriod) {
        const {
          count:
            nhlDisplayWeekCount,
        } = await supabase
          .from(
            "nhl_pickem_periods"
          )
          .select(
            "id",
            {
              count: "exact",
              head: true,
            }
          )
          .eq(
            "league_id",
            leagueId
          )
          .eq(
            "season",
            currentNhlPeriod.season
          )
          .lte(
            "period_number",
            currentNhlPeriod.period_number
          );

        displayWeekNumber =
          nhlDisplayWeekCount ??
          1;
      }
    } else if (
      currentWeek
    ) {
      const {
        data: matchingNhlPeriod,
      } = await supabase
        .from(
          "nhl_pickem_periods"
        )
        .select(
          [
            "id",
            "league_id",
            "season",
            "period_number",
            "status",
            "starts_at",
            "ends_at",
            "finalized_at",
          ].join(",")
        )
        .eq(
          "league_id",
          leagueId
        )
        .eq(
          "season",
          currentWeek.season
        )
        .eq(
          "period_number",
          currentWeek.week
        )
        .maybeSingle();

      currentNhlPeriod =
        matchingNhlPeriod as
          | NhlPeriodRow
          | null;
    }
  }

  if (
    !nhlOnly &&
    includesFootball &&
    currentWeek &&
    fantasyTeamId
  ) {
    const {
      count:
        footballPickCount,
    } = await supabase
      .from("pickem_picks")
      .select(
        "id",
        {
          count: "exact",
          head: true,
        }
      )
      .eq(
        "pickem_week_id",
        currentWeek.id
      )
      .eq(
        "fantasy_team_id",
        fantasyTeamId
      )
      .neq(
        "result",
        "void"
      );

    selectedPicks +=
      footballPickCount ?? 0;

    const {
      data:
        footballResultData,
    } = await supabase
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

    if (footballResultData) {
      wins +=
        Number(
          footballResultData.wins
        ) || 0;

      losses +=
        Number(
          footballResultData.losses
        ) || 0;

      pushes +=
        Number(
          footballResultData.pushes
        ) || 0;
    }
  }

  if (
    currentNhlPeriod &&
    fantasyTeamId
  ) {
    const {
      data: nhlEntryData,
    } = await supabase
      .from(
        "nhl_pickem_entries"
      )
      .select(
        "id,fantasy_team_id,season"
      )
      .eq(
        "league_id",
        leagueId
      )
      .eq(
        "fantasy_team_id",
        fantasyTeamId
      )
      .eq(
        "season",
        currentNhlPeriod.season
      )
      .eq(
        "active",
        true
      )
      .limit(1)
      .maybeSingle();

    const nhlEntry =
      nhlEntryData as
        | NhlEntryRow
        | null;

    if (nhlEntry) {
      const {
        count:
          nhlPickCount,
      } = await supabase
        .from(
          "nhl_pickem_picks"
        )
        .select(
          "id",
          {
            count: "exact",
            head: true,
          }
        )
        .eq(
          "league_id",
          leagueId
        )
        .eq(
          "nhl_pickem_period_id",
          currentNhlPeriod.id
        )
        .eq(
          "entry_id",
          nhlEntry.id
        )
        .neq(
          "result",
          "void"
        );

      selectedPicks +=
        nhlPickCount ?? 0;

      const {
        data:
          nhlResultData,
      } = await supabase
        .from(
          "nhl_pickem_period_results"
        )
        .select(
          [
            "required_picks",
            "wins",
            "pushes",
            "losses",
          ].join(",")
        )
        .eq(
          "league_id",
          leagueId
        )
        .eq(
          "nhl_pickem_period_id",
          currentNhlPeriod.id
        )
        .eq(
          "entry_id",
          nhlEntry.id
        )
        .maybeSingle();

      const nhlResult =
        nhlResultData as
          | NhlPeriodResultRow
          | null;

      if (nhlResult) {
        wins +=
          Number(
            nhlResult.wins
          ) || 0;

        losses +=
          Number(
            nhlResult.losses
          ) || 0;

        pushes +=
          Number(
            nhlResult.pushes
          ) || 0;

        if (nhlOnly) {
          requiredPicks =
            Number(
              nhlResult.required_picks
            ) ||
            requiredPicks;
        }
      }
    }
  }

  if (nhlOnly) {
    const {
      data: nhlSettingsData,
    } = await supabase
      .from(
        "nhl_pickem_settings"
      )
      .select(
        "picks_per_period"
      )
      .eq(
        "league_id",
        leagueId
      )
      .maybeSingle();

    requiredPicks =
      Number(
        nhlSettingsData
          ?.picks_per_period
      ) ||
      requiredPicks;
  }

  const weekLabel =
    displayWeekNumber
      ? `Week ${displayWeekNumber}`
      : "Not Open Yet";

  const sportsLabel =
    formatEnabledSports(
      enabledSports
    );

  const heroTitle =
    nhlOnly
      ? "Pick the G365 Hockey Card."
      : includesNhl
        ? "Beat the G365 Lines."
        : "Beat the G365 Spread.";

  const heroDescription =
    nhlOnly
      ? `Make exactly ${requiredPicks} NHL picks this contest week. Choose from the official G365 puck-line and total markets available for the slate.`
      : includesNhl
        ? `Make exactly ${requiredPicks} picks from the enabled G365 sports this contest week. Football uses the G365 spread and NHL uses its official puck-line and total markets.`
        : `Make exactly ${requiredPicks} ATS picks this week. Each selection stays private to the league until that specific game kicks off.`;

  return (
    <main
      className="g365-pickem-home"
      style={{
        display: "grid",
        gap: 18,
        padding: "22px 18px 34px",
        width: "100%",
        minWidth: 0,
      }}
    >
      <style>{`
        .g365-pickem-home * {
          box-sizing: border-box;
        }

        @media (max-width: 760px) {
          .g365-pickem-home {
            width: 100% !important;
            max-width: 100% !important;
            min-width: 0 !important;
            padding: 14px 12px 28px !important;
            gap: 14px !important;
            overflow-x: hidden;
          }

          .g365-pickem-home > section {
            min-width: 0;
            max-width: 100%;
          }

          .g365-pickem-home .g365-pickem-home-hero {
            padding: 17px !important;
            border-radius: 15px !important;
          }

          .g365-pickem-home .g365-pickem-home-stats {
            grid-template-columns: repeat(2, minmax(0,1fr)) !important;
            gap: 9px !important;
          }

          .g365-pickem-home .g365-pickem-home-links {
            grid-template-columns: minmax(0,1fr) !important;
            gap: 9px !important;
          }

          .g365-pickem-home .g365-pickem-home-stat {
            padding: 13px !important;
            min-width: 0;
          }

          .g365-pickem-home .g365-pickem-home-link {
            padding: 15px !important;
            min-width: 0;
          }

          .g365-pickem-home h2 {
            font-size: clamp(29px, 9vw, 38px) !important;
            line-height: 1.03 !important;
          }

          .g365-pickem-home p,
          .g365-pickem-home div,
          .g365-pickem-home strong {
            overflow-wrap: anywhere;
          }
        }

        @media (max-width: 430px) {
          .g365-pickem-home {
            padding: 12px 10px 24px !important;
          }

          .g365-pickem-home .g365-pickem-home-stats {
            grid-template-columns: minmax(0,1fr) !important;
          }
        }
      `}</style>

      <section
        className="g365-pickem-home-hero"
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
          G365 Pick&apos;em
        </div>

        <h2
          style={{
            margin: "7px 0 8px",
            color: "white",
            fontSize: "clamp(28px, 5vw, 46px)",
            lineHeight: 1,
          }}
        >
          {heroTitle}
        </h2>

        <p
          style={{
            margin: 0,
            maxWidth: 760,
            color: "#b9b9bf",
            lineHeight: 1.65,
          }}
        >
          {heroDescription}
        </p>
      </section>

      <section
        className="g365-pickem-home-stats"
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
            weekLabel,
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
            "Enabled Sports",
            sportsLabel,
          ],
        ].map(([label, value]) => (
          <div
            className="g365-pickem-home-stat"
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
        className="g365-pickem-home-links"
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
            `Choose your ${requiredPicks} G365 picks for the week.`,
            `/league/${leagueId}/pickem/my-picks`,
          ],
          [
            "League Picks",
            "See every member's picks as each selected game reaches kickoff.",
            `/league/${leagueId}/pickem/league-picks`,
          ],
          [
            "Live Games",
            "Follow the live games and your current G365 pick position.",
            `/league/${leagueId}/pickem/games`,
          ],
          [
            "Standings",
            "Track weekly and season-long Pick'em records across the enabled sports.",
            `/league/${leagueId}/pickem/standings`,
          ],
        ].map(
          ([title, description, href]) => (
            <Link
              className="g365-pickem-home-link"
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
        )}. Picks are revealed according to the league lock rules. Results remain live until the applicable games in the G365 Pick&apos;em contest week are complete and the period is finalized.
      </section>
    </main>
  );
}
