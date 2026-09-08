import { createSupabaseServerClient } from "@/lib/supabase/server";

type Props = {
  leagueId: string;
};

type PickemSport = "cfb" | "nfl" | "nhl";

type PickemSettingsRow = {
  football_scope: string;
  enabled_sports: PickemSport[] | null;
  picks_per_week: number;
  pick_lock_mode: string;
  minimum_source_books: number;
  scoring_mode: string;
  win_points: number | string;
  push_points: number | string;
  loss_points: number | string;
  confidence_points: number[] | null;
  confidence_push_multiplier: number | string;
  missing_pick_policy: string;
  pick_market_mode: string;
  hockey_market_mode: string;
};

type NhlSettingsRow = {
  picks_per_period: number;
  market_mode: string;
  allow_same_game_multiple_markets: boolean;
  pick_lock_mode: string;
  minimum_source_books: number;
  scoring_mode: string;
  win_points: number | string;
  push_points: number | string;
  loss_points: number | string;
  confidence_points: Array<number | string> | null;
  confidence_push_multiplier: number | string;
  missing_pick_policy: string;
  contest_timezone: string;
  line_freeze_local_time: string | null;
};

function sportLabel(sport: PickemSport) {
  if (sport === "cfb") return "College Football";
  if (sport === "nfl") return "NFL";
  return "NHL";
}

function footballMarketLabel(value: string) {
  if (value === "total_only") return "Over / Under only";
  if (value === "spread_total") return "Spread + Over / Under";
  return "Spread only";
}

function hockeyMarketLabel(value: string) {
  if (value === "total_only") return "Over / Under only";
  if (value === "puck_line_and_total") return "Puck Line + Over / Under";
  return "Puck Line only";
}

function scoringLabel(data: PickemSettingsRow) {
  if (data.scoring_mode === "record_only") {
    return "Record Only — wins, pushes and losses; no scoring points";
  }

  if (data.scoring_mode === "confidence") {
    return `Confidence Points — ${(data.confidence_points ?? []).join(", ")}`;
  }

  if (data.scoring_mode === "three_one_zero") {
    return "3 / 1 / 0 Points";
  }

  if (data.scoring_mode === "custom") {
    return `Custom — ${data.win_points} / ${data.push_points} / ${data.loss_points}`;
  }

  return "Standard — 1 / 0.5 / 0";
}

function missingPickLabel(value: string) {
  if (value === "count_as_losses") {
    return "Each missing required pick counts as a loss and earns 0 points";
  }

  if (value === "disqualify_week") {
    return "Incomplete cards are disqualified from the official contest-period ranking";
  }

  return "No penalty; missing picks remain unplayed and earn 0 points";
}

function formatTime(value: string | null | undefined) {
  if (!value) return "11:00 AM Eastern";

  const parts = value.split(":");
  const hour = Number(parts[0]);
  const minute = Number(parts[1] ?? 0);

  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return value;
  }

  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${String(minute).padStart(2, "0")} ${suffix} Eastern`;
}

export default async function PickemReadOnlySettings({ leagueId }: Props) {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("pickem_settings")
    .select(
      "football_scope,enabled_sports,picks_per_week,pick_lock_mode,minimum_source_books,scoring_mode,win_points,push_points,loss_points,confidence_points,confidence_push_multiplier,missing_pick_policy,pick_market_mode,hockey_market_mode"
    )
    .eq("league_id", leagueId)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const settings = data as PickemSettingsRow;
  const enabledSports =
    settings.enabled_sports && settings.enabled_sports.length > 0
      ? settings.enabled_sports
      : settings.football_scope === "college_only"
        ? (["cfb"] as PickemSport[])
        : settings.football_scope === "nfl_only"
          ? (["nfl"] as PickemSport[])
          : (["cfb", "nfl"] as PickemSport[]);

  const footballEnabled =
    enabledSports.includes("cfb") || enabledSports.includes("nfl");
  const nhlEnabled = enabledSports.includes("nhl");

  let nhlSettings: NhlSettingsRow | null = null;

  if (nhlEnabled) {
    const { data: nhlData, error: nhlError } = await supabase
      .from("nhl_pickem_settings")
      .select(
        "picks_per_period,market_mode,allow_same_game_multiple_markets,pick_lock_mode,minimum_source_books,scoring_mode,win_points,push_points,loss_points,confidence_points,confidence_push_multiplier,missing_pick_policy,contest_timezone,line_freeze_local_time"
      )
      .eq("league_id", leagueId)
      .maybeSingle();

    if (nhlError) {
      throw new Error(nhlError.message);
    }

    nhlSettings = (nhlData as NhlSettingsRow | null) ?? null;
  }

  const sharedRows: Array<[string, string]> = [
    ["Enabled Sports", enabledSports.map(sportLabel).join(" + ")],
    ["Required Picks Per Contest Period", String(settings.picks_per_week)],
    ["Scoring", scoringLabel(settings)],
    ["Missing Picks", missingPickLabel(settings.missing_pick_policy)],
    [
      "Minimum Sportsbook Sources",
      `${settings.minimum_source_books} trustworthy sources required before an official G365 market can freeze`,
    ],
    ...(settings.scoring_mode === "confidence"
      ? ([
          [
            "Confidence Push Credit",
            `${Number(settings.confidence_push_multiplier) * 100}% of confidence value`,
          ],
        ] as Array<[string, string]>)
      : settings.scoring_mode === "record_only"
        ? []
        : ([
            [
              "Win / Push / Loss",
              `${settings.win_points} / ${settings.push_points} / ${settings.loss_points} points`,
            ],
          ] as Array<[string, string]>)),
  ];

  const footballRows: Array<[string, string]> = footballEnabled
    ? [
        [
          "Football Sports",
          enabledSports
            .filter((sport) => sport === "cfb" || sport === "nfl")
            .map(sportLabel)
            .join(" + "),
        ],
        ["Football Pick Markets", footballMarketLabel(settings.pick_market_mode)],
        [
          "Football Pick Lock",
          settings.pick_lock_mode === "full_card"
            ? "Full card locks at the earliest selected football kickoff"
            : "Each football pick locks at its own kickoff",
        ],
        [
          "Football Pick Reveal",
          "Each football pick becomes visible when that game's lock condition is reached",
        ],
      ]
    : [];

  const nhlRows: Array<[string, string]> = nhlEnabled
    ? [
        ["NHL Pick Markets", hockeyMarketLabel(settings.hockey_market_mode)],
        [
          "NHL Pick Lock",
          "Each NHL pick locks at that game's puck drop",
        ],
        [
          "NHL Official Line Freeze",
          formatTime(nhlSettings?.line_freeze_local_time),
        ],
        [
          "NHL Contest Time Zone",
          nhlSettings?.contest_timezone ?? "America/New_York",
        ],
        [
          "Same NHL Game, Multiple Markets",
          nhlSettings?.allow_same_game_multiple_markets ? "Allowed" : "Not allowed",
        ],
        [
          "NHL Engine Mapping",
          nhlSettings
            ? `${nhlSettings.picks_per_period} picks • ${nhlSettings.missing_pick_policy === "loss" ? "missing picks count as losses" : "missing picks ungraded"}`
            : "NHL engine settings will be provisioned automatically from the unified league settings",
        ],
      ]
    : [];

  return (
    <main
      className="g365-pickem-settings"
      style={{
        display: "grid",
        gap: 16,
        padding: "22px 18px 36px",
        width: "100%",
        maxWidth: 1000,
        minWidth: 0,
      }}
    >
      <style>{`
        .g365-pickem-settings * { box-sizing: border-box; }
        .g365-pickem-settings-row {
          display: grid;
          grid-template-columns: minmax(210px,0.78fr) minmax(0,1.5fr);
          gap: 14px;
          padding: 15px;
        }
        @media (max-width: 760px) {
          .g365-pickem-settings {
            max-width: 100% !important;
            padding: 14px 12px 28px !important;
            gap: 14px !important;
            overflow-x: hidden;
          }
          .g365-pickem-settings h2 {
            font-size: clamp(27px, 8vw, 34px) !important;
          }
          .g365-pickem-settings-row {
            grid-template-columns: minmax(0,1fr);
            gap: 5px;
            padding: 13px 14px;
          }
          .g365-pickem-settings-row strong,
          .g365-pickem-settings-row span {
            min-width: 0;
            overflow-wrap: anywhere;
          }
        }
        @media (max-width: 430px) {
          .g365-pickem-settings { padding: 12px 10px 24px !important; }
        }
      `}</style>

      <section>
        <div
          style={{
            color: "#ff7627",
            fontSize: 12,
            fontWeight: 1000,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
          }}
        >
          G365 PICK&apos;EM • LEAGUE RULES
        </div>
        <h2 style={{ margin: "6px 0 0", color: "white", fontSize: 32 }}>
          Unified Pick&apos;em Settings
        </h2>
        <p style={{ margin: "8px 0 0", color: "#9b9ca4", lineHeight: 1.55 }}>
          One rules page for College Football, NFL and NHL. Sport-specific rules only appear when that sport is enabled.
        </p>
      </section>

      <SettingsSection title="Shared Contest Rules" rows={sharedRows} />
      {footballRows.length > 0 ? (
        <SettingsSection title="Football Rules" rows={footballRows} />
      ) : null}
      {nhlRows.length > 0 ? (
        <SettingsSection title="NHL Rules" rows={nhlRows} />
      ) : null}

      <section
        style={{
          padding: 14,
          borderRadius: 12,
          border: "1px solid rgba(255,112,35,0.18)",
          background: "rgba(255,96,20,0.04)",
          color: "#92939b",
          fontSize: 11,
          lineHeight: 1.6,
        }}
      >
        Mixed leagues use the master G365 Pick&apos;em contest period as the official week. The NHL engine mirrors only master periods that contain NHL games, while NHL game locking and NHL line rules remain handled by the mature NHL subsystem.
      </section>
    </main>
  );
}

function SettingsSection({
  title,
  rows,
}: {
  title: string;
  rows: Array<[string, string]>;
}) {
  return (
    <section
      style={{
        overflow: "hidden",
        borderRadius: 15,
        border: "1px solid rgba(255,255,255,0.09)",
        background: "#111115",
      }}
    >
      <div
        style={{
          padding: "12px 15px",
          color: "#ff7627",
          fontSize: 11,
          fontWeight: 1000,
          letterSpacing: "0.08em",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
          background: "rgba(255,90,20,0.035)",
        }}
      >
        {title.toUpperCase()}
      </div>

      {rows.map(([label, value], index) => (
        <div
          className="g365-pickem-settings-row"
          key={label}
          style={{
            borderTop:
              index === 0 ? "none" : "1px solid rgba(255,255,255,0.065)",
          }}
        >
          <strong style={{ color: "#f4f4f5" }}>{label}</strong>
          <span style={{ color: "#a7a7af", lineHeight: 1.5 }}>{value}</span>
        </div>
      ))}
    </section>
  );
}
