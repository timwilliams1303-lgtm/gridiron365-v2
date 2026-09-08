import { createSupabaseServerClient } from "@/lib/supabase/server";

type Props = {
  leagueId: string;
};

type PickemSport = "cfb" | "nfl" | "nhl";

function enabledSportsLabel(value: unknown, footballScope: string | null) {
  const normalized = Array.isArray(value)
    ? Array.from(
        new Set(
          value
            .map((sport) => String(sport).trim().toLowerCase())
            .filter(
              (sport): sport is PickemSport =>
                sport === "cfb" || sport === "nfl" || sport === "nhl"
            )
        )
      )
    : [];

  const sports =
    normalized.length > 0
      ? normalized
      : footballScope === "college_only"
        ? ["cfb"]
        : footballScope === "nfl_only"
          ? ["nfl"]
          : ["cfb", "nfl"];

  return sports
    .map((sport) =>
      sport === "cfb" ? "College Football" : sport === "nfl" ? "NFL" : "NHL"
    )
    .join(" + ");
}

function hockeyMarketLabel(value: string | null | undefined) {
  if (value === "puck_line_only") {
    return "G365 puck line — derived from consensus sportsbook moneylines";
  }

  if (value === "total_only") {
    return "Over / Under";
  }

  return "Moneyline-derived G365 puck line + Over / Under";
}

export default async function PickemReadOnlySettings({ leagueId }: Props) {
  const supabase = await createSupabaseServerClient();

  const [{ data, error }, { data: nhlSettings }] = await Promise.all([
    supabase
      .from("pickem_settings")
      .select(
        "football_scope,enabled_sports,picks_per_week,pick_lock_mode,reveal_mode,minimum_source_books,scoring_mode,win_points,push_points,loss_points,confidence_points,confidence_push_multiplier,missing_pick_policy,pick_market_mode,hockey_market_mode"
      )
      .eq("league_id", leagueId)
      .single(),
    supabase
      .from("nhl_pickem_settings")
      .select("pick_lock_mode,minimum_source_books,line_freeze_local_time,timezone")
      .eq("league_id", leagueId)
      .maybeSingle(),
  ]);

  if (error) throw new Error(error.message);

  const enabledSports = Array.isArray(data.enabled_sports)
    ? data.enabled_sports.map((sport) => String(sport).toLowerCase())
    : [];
  const hasFootball =
    enabledSports.length === 0 ||
    enabledSports.includes("cfb") ||
    enabledSports.includes("nfl");
  const hasNhl = enabledSports.includes("nhl");

  const scoringLabel =
    data.scoring_mode === "record_only"
      ? "Record Only — win / push / loss record, no points"
      : data.scoring_mode === "confidence"
        ? `Confidence Points — ${(data.confidence_points ?? []).join(", ")}`
        : data.scoring_mode === "three_one_zero"
          ? "3 / 1 / 0 Points"
          : data.scoring_mode === "custom"
            ? `Custom — ${data.win_points} / ${data.push_points} / ${data.loss_points}`
            : `Standard — ${data.win_points} / ${data.push_points} / ${data.loss_points}`;

  const rows: Array<[string, string]> = [
    ["Enabled Sports", enabledSportsLabel(data.enabled_sports, data.football_scope)],
    ["Picks Required", `${data.picks_per_week} combined picks per contest period`],
    ...(hasFootball
      ? ([
          ["Football Markets", "Spread + Over / Under"],
          [
            "Football G365 Lines",
            `Median sportsbook consensus for both spread and total; minimum ${data.minimum_source_books} trustworthy books`,
          ],
          [
            "Football Lock",
            data.pick_lock_mode === "full_card"
              ? "Full card locks at earliest selected kickoff"
              : "Each football pick locks at its own kickoff",
          ],
        ] as Array<[string, string]>)
      : []),
    ...(hasNhl
      ? ([
          ["NHL Markets", hockeyMarketLabel(data.hockey_market_mode)],
          [
            "NHL Puck Line Method",
            "Consensus home/away moneylines identify the favorite, then G365 converts favorite price to the official puck-line tier; the underdog receives the opposite line.",
          ],
          [
            "NHL Total",
            `Median sportsbook game total, rounded to the nearest 0.5; minimum ${nhlSettings?.minimum_source_books ?? data.minimum_source_books} trustworthy books`,
          ],
          ["NHL Lock", "Each NHL pick locks at that game's start"],
          [
            "NHL Line Freeze",
            nhlSettings?.line_freeze_local_time
              ? `${nhlSettings.line_freeze_local_time} ${nhlSettings.timezone ?? "America/New_York"}`
              : "Scheduled daily G365 line freeze",
          ],
        ] as Array<[string, string]>)
      : []),
    ["Pick Reveal", "Each individual pick becomes visible when that game begins"],
    ["Scoring", scoringLabel],
    [
      "Missing Picks",
      data.missing_pick_policy === "count_as_losses"
        ? "Each missing required pick counts as a loss and earns 0 points"
        : data.missing_pick_policy === "disqualify_week"
          ? "Incomplete cards are disqualified from the official weekly ranking"
          : "No penalty; missing picks remain unplayed and earn 0 points",
    ],
    ...(data.scoring_mode === "confidence"
      ? ([
          [
            "Confidence Push Credit",
            `${Number(data.confidence_push_multiplier) * 100}% of confidence value`,
          ],
        ] as Array<[string, string]>)
      : data.scoring_mode === "record_only"
        ? []
        : ([
            [
              "Win / Push / Loss",
              `${data.win_points} / ${data.push_points} / ${data.loss_points} points`,
            ],
          ] as Array<[string, string]>)),
    [
      "Live Updates",
      "Picks, commissioner settings, line freezes, game state, grading, standings and recap changes update automatically without a manual browser refresh.",
    ],
  ];

  return (
    <main
      className="g365-pickem-settings"
      style={{
        display: "grid",
        gap: 16,
        padding: "22px 18px 36px",
        width: "100%",
        maxWidth: 960,
        minWidth: 0,
      }}
    >
      <style>{`
        .g365-pickem-settings * { box-sizing: border-box; }
        .g365-pickem-settings-row {
          display: grid;
          grid-template-columns: minmax(190px,0.75fr) minmax(0,1.5fr);
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
          .g365-pickem-settings h2 { font-size: clamp(27px, 8vw, 34px) !important; }
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
          Live League Rules
        </div>
        <h2 style={{ margin: "6px 0 0", color: "white", fontSize: 32 }}>
          Pick&apos;em Settings
        </h2>
      </section>

      <section
        style={{
          overflow: "hidden",
          borderRadius: 15,
          border: "1px solid rgba(255,255,255,0.09)",
          background: "#111115",
        }}
      >
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
    </main>
  );
}
