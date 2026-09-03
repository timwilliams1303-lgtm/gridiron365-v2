import {
  createSupabaseServerClient,
} from "@/lib/supabase/server";


type Props = {
  leagueId: string;
};


function scopeLabel(value: string) {
  if (value === "college_only") return "College Football Only";
  if (value === "nfl_only") return "NFL Only";
  return "College + NFL";
}


export default async function PickemReadOnlySettings({
  leagueId,
}: Props) {
  const supabase =
    await createSupabaseServerClient();

  const { data, error } =
    await supabase
      .from("pickem_settings")
      .select(
        "football_scope,picks_per_week,pick_lock_mode,reveal_mode,minimum_source_books,scoring_mode,win_points,push_points,loss_points,confidence_points,confidence_push_multiplier,missing_pick_policy"
      )
      .eq("league_id", leagueId)
      .single();

  if (error) {
    throw new Error(
      error.message
    );
  }


  const scoringLabel =
    data.scoring_mode === "record_only"
      ? "Record Only — ATS record, no points"
      : data.scoring_mode === "confidence"
        ? `Confidence Points — ${(data.confidence_points ?? []).join(", ")}`
        : data.scoring_mode === "three_one_zero"
          ? "3 / 1 / 0 Points"
          : data.scoring_mode === "custom"
            ? `Custom — ${data.win_points} / ${data.push_points} / ${data.loss_points}`
            : "Standard — 1 / 0.5 / 0";


  const rows = [
    ["Football", scopeLabel(data.football_scope)],
    ["Picks Required Each Week", String(data.picks_per_week)],
    [
      "Pick Lock",
      data.pick_lock_mode === "full_card"
        ? "Full card locks at earliest selected kickoff"
        : "Each pick locks at its own kickoff",
    ],
    ["Pick Reveal", "Each individual pick becomes visible at that game's kickoff"],
    ["G365 Line", `Median consensus; minimum ${data.minimum_source_books} trustworthy sportsbook sources`],
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
      ? [["Confidence Push Credit", `${Number(data.confidence_push_multiplier) * 100}% of confidence value`]]
      : data.scoring_mode === "record_only"
        ? []
        : [["Win / Push / Loss", `${data.win_points} / ${data.push_points} / ${data.loss_points} points`]]),
    ["Week Finalization", "After the final game of the week is complete and the Monday-night finalization gate is satisfied"],
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
        .g365-pickem-settings * {
          box-sizing: border-box;
        }

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
          .g365-pickem-settings {
            padding: 12px 10px 24px !important;
          }
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
          League Rules
        </div>
        <h2
          style={{
            margin: "6px 0 0",
            color: "white",
            fontSize: 32,
          }}
        >
          Pick&apos;em Settings
        </h2>
      </section>

      <section
        style={{
          overflow: "hidden",
          borderRadius: 15,
          border:
            "1px solid rgba(255,255,255,0.09)",
          background: "#111115",
        }}
      >
        {rows.map(([label, value], index) => (
          <div
            className="g365-pickem-settings-row"
            key={label}
            style={{
              borderTop:
                index === 0
                  ? "none"
                  : "1px solid rgba(255,255,255,0.065)",
            }}
          >
            <strong
              style={{
                color: "#f4f4f5",
              }}
            >
              {label}
            </strong>
            <span
              style={{
                color: "#a7a7af",
                lineHeight: 1.5,
              }}
            >
              {value}
            </span>
          </div>
        ))}
      </section>
    </main>
  );
}
