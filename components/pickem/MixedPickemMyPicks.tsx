"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import PickemMyPicks from "@/components/pickem/PickemMyPicks";
import NhlPickemMyPicks from "@/components/nhl-pickem/NhlPickemMyPicks";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type PickemSport = "cfb" | "nfl" | "nhl";
type SportFilter = "all" | PickemSport;

type Props = {
  leagueId: string;
  season: number;
  fantasyTeamId: number;
  teamName: string;
  enabledSports: Array<"cfb" | "nfl" | "nhl">;
};

type UnifiedStatus = {
  requiredPicks: number;
  footballPicks: number;
  nhlPicks: number;
  selectedPicks: number;
  remainingPicks: number;
  scoringMode: string;
  confidenceAssigned: number;
  missingConfidence: number;
  isComplete: boolean;
};

type WeekRow = {
  id?: number;
  week: number;
  status: string;
  pick_lock_mode?: "per_game" | "full_card";
  reveal_mode?: string | null;
  full_card_lock_at?: string | null;
};

function normalizeStatus(raw: unknown): UnifiedStatus {
  const value =
    raw && typeof raw === "object"
      ? (raw as Record<string, unknown>)
      : {};

  const numberValue = (key: string, fallback = 0) => {
    const n = Number(value[key]);
    return Number.isFinite(n) ? n : fallback;
  };

  return {
    requiredPicks: numberValue("requiredPicks", 5),
    footballPicks: numberValue("footballPicks"),
    nhlPicks: numberValue("nhlPicks"),
    selectedPicks: numberValue("selectedPicks"),
    remainingPicks: numberValue("remainingPicks", 5),
    scoringMode:
      typeof value.scoringMode === "string"
        ? value.scoringMode
        : "record_only",
    confidenceAssigned: numberValue("confidenceAssigned"),
    missingConfidence: numberValue("missingConfidence"),
    isComplete: value.isComplete === true,
  };
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div
      style={{
        padding: "13px 14px",
        borderRadius: 14,
        border: "1px solid rgba(255,255,255,0.09)",
        background: "rgba(255,255,255,0.035)",
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
          marginTop: 5,
          color: accent ?? "#fff",
          fontSize: 20,
          fontWeight: 1000,
        }}
      >
        {value}
      </div>
    </div>
  );
}

export default function MixedPickemMyPicks({
  leagueId,
  season,
  fantasyTeamId,
  teamName,
  enabledSports,
}: Props) {
  const supabase = useMemo(
    () => createSupabaseBrowserClient(),
    []
  );

  const [week, setWeek] = useState<number | null>(null);
  const [weeks, setWeeks] = useState<WeekRow[]>([]);
  const [sportFilter, setSportFilter] = useState<SportFilter>("all");
  const [status, setStatus] = useState<UnifiedStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [statusError, setStatusError] = useState("");

  const includesFootball =
    enabledSports.includes("cfb") ||
    enabledSports.includes("nfl");

  const includesNhl = enabledSports.includes("nhl");

  const loadUnifiedStatus = useCallback(async () => {
    setLoadingStatus(true);
    setStatusError("");

    try {
      let targetWeek = week;

      if (targetWeek === null) {
        const { data, error } = await supabase
          .from("pickem_weeks")
          .select("week,status,pick_lock_mode,reveal_mode,full_card_lock_at")
          .eq("league_id", leagueId)
          .eq("season", season)
          .order("week", { ascending: true });

        if (error) throw new Error(error.message);

        const rows = (data ?? []) as WeekRow[];
        setWeeks(rows);
        const active =
          rows.find((row) => row.status !== "final") ??
          rows.at(-1) ??
          null;

        targetWeek = active?.week ?? null;
        setWeek(targetWeek);
      }

      if (targetWeek === null) {
        setStatus(null);
        return;
      }

      const { data, error } = await supabase.rpc(
        "get_pickem_unified_card_status",
        {
          p_league_id: leagueId,
          p_season: season,
          p_week: targetWeek,
        }
      );

      if (error) throw new Error(error.message);

      setStatus(normalizeStatus(data));
    } catch (error) {
      setStatusError(
        error instanceof Error
          ? error.message
          : "The combined Pick'em card status could not be loaded."
      );
    } finally {
      setLoadingStatus(false);
    }
  }, [leagueId, season, supabase, week]);

  useEffect(() => {
    // My Picks is private to this member. Load the combined status when the
    // component/week changes, but do not subscribe, poll, or force refreshes.
    void loadUnifiedStatus();
  }, [loadUnifiedStatus]);

  useEffect(() => {
    function handleCardChange(event: Event) {
      const detail = (event as CustomEvent<{ leagueId?: string; week?: number }>).detail;
      if (detail?.leagueId !== leagueId) return;
      if (week !== null && detail.week !== undefined && detail.week !== week) return;
      void loadUnifiedStatus();
    }

    window.addEventListener("g365-pickem-card-change", handleCardChange);
    return () => window.removeEventListener("g365-pickem-card-change", handleCardChange);
  }, [leagueId, loadUnifiedStatus, week]);

  const selectedWeekRow = weeks.find((row) => row.week === week) ?? null;

  const fullCardDeadline =
    selectedWeekRow?.pick_lock_mode === "full_card" && selectedWeekRow.full_card_lock_at
      ? new Date(selectedWeekRow.full_card_lock_at).toLocaleString(undefined, {
          weekday: "short",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
          timeZone: "America/New_York",
          timeZoneName: "short",
        })
      : null;

  const sportLabel = [
    enabledSports.includes("cfb") ? "College Football" : null,
    enabledSports.includes("nfl") ? "NFL" : null,
    enabledSports.includes("nhl") ? "NHL" : null,
  ]
    .filter(Boolean)
    .join(" + ");

  return (
    <main
      style={{
        display: "grid",
        gap: 18,
        padding: "22px 18px 36px",
        maxWidth: 1220,
        margin: "0 auto",
      }}
    >
      <section
        style={{
          display: "grid",
          gap: 14,
          padding: 20,
          borderRadius: 18,
          border: "1px solid rgba(255,108,33,0.28)",
          background:
            "linear-gradient(135deg, rgba(100,7,13,0.42), rgba(17,17,21,0.98) 58%)",
        }}
      >
        <div>
          <div
            style={{
              color: "#ff7627",
              fontSize: 12,
              fontWeight: 1000,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
            }}
          >
            G365 Pick&apos;em · Mixed Sports
          </div>

          <h1
            style={{
              margin: "7px 0 5px",
              color: "#fff",
              fontSize: "clamp(28px,5vw,42px)",
            }}
          >
            My Picks
          </h1>

          <div style={{ color: "#aaaab2", lineHeight: 1.5 }}>
            {teamName} · {season}
            {week !== null ? ` · Week ${week}` : ""}
            {sportLabel ? ` · ${sportLabel}` : ""}
          </div>
        </div>

        {statusError ? (
          <div
            style={{
              color: "#ff9d9d",
              fontWeight: 800,
            }}
          >
            {statusError}
          </div>
        ) : null}

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit,minmax(145px,1fr))",
            gap: 10,
          }}
        >
          <Stat
            label="Selected"
            value={
              loadingStatus || !status
                ? "—"
                : `${status.selectedPicks} / ${status.requiredPicks}`
            }
            accent={
              status?.isComplete ? "#3fd47a" : "#ff7627"
            }
          />
          <Stat
            label="Football"
            value={
              loadingStatus || !status
                ? "—"
                : String(status.footballPicks)
            }
          />
          <Stat
            label="NHL"
            value={
              loadingStatus || !status
                ? "—"
                : String(status.nhlPicks)
            }
          />
          <Stat
            label="Remaining"
            value={
              loadingStatus || !status
                ? "—"
                : String(status.remainingPicks)
            }
          />
          <Stat
            label="Card Status"
            value={
              loadingStatus || !status
                ? "LOADING"
                : status.isComplete
                  ? "COMPLETE"
                  : "INCOMPLETE"
            }
            accent={
              status?.isComplete ? "#3fd47a" : "#ffb84a"
            }
          />
          {status?.scoringMode === "confidence" ? (
            <>
              <Stat
                label="Confidence Assigned"
                value={loadingStatus ? "—" : `${status.confidenceAssigned} / ${status.selectedPicks}`}
                accent={status.missingConfidence === 0 ? "#3fd47a" : "#ffb84a"}
              />
              <Stat
                label="Missing Confidence"
                value={loadingStatus ? "—" : String(status.missingConfidence)}
                accent={status.missingConfidence === 0 ? "#3fd47a" : "#ff6b6f"}
              />
            </>
          ) : null}
        </div>

        <div
          style={{
            color: "#b8b8c0",
            fontSize: 13,
            lineHeight: 1.55,
          }}
        >
          The required-pick number is one combined G365 card.
          Football and NHL selections count toward the same total.
        </div>

        <div style={{ padding: "11px 13px", borderRadius: 12, border: "1px solid rgba(255,118,39,0.18)", background: "rgba(255,118,39,0.06)", color: "#c6c6cd", fontSize: 12, lineHeight: 1.55 }}>
          {selectedWeekRow?.pick_lock_mode === "full_card"
            ? `Full Card mode: the combined CFB/NFL/NHL card locks and reveals at ${fullCardDeadline ?? "the commissioner deadline"}. Any game that starts earlier still locks and reveals at its own start.`
            : "Per-Game mode: each CFB, NFL and NHL pick remains editable and private until that game's authoritative start, then locks and reveals individually."}
        </div>
      </section>

      <section
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
          padding: "14px 16px",
          borderRadius: 14,
          border: "1px solid rgba(255,255,255,0.08)",
          background: "#111115",
        }}
      >
        <label
          htmlFor="g365-mixed-week"
          style={{
            color: "#b9b9c0",
            fontSize: 13,
            fontWeight: 900,
          }}
        >
          Week
        </label>

        <select
          id="g365-mixed-week"
          value={week ?? ""}
          onChange={(event) => {
            const next = Number(event.target.value);
            setWeek(Number.isFinite(next) ? next : null);
          }}
          disabled={weeks.length === 0}
          style={{
            minWidth: 150,
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid rgba(255,118,39,0.35)",
            background: "#09090c",
            color: "#fff",
            fontWeight: 900,
          }}
        >
          {weeks.length === 0 ? (
            <option value="">No week ready</option>
          ) : (
            weeks.map((row) => (
              <option key={row.week} value={row.week}>
                Week {row.week} · {row.status.replaceAll("_", " ").toUpperCase()}
              </option>
            ))
          )}
        </select>

        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            marginLeft: "auto",
          }}
        >
          {(
            [
              ["all", "ALL"],
              ...(enabledSports.includes("cfb") ? [["cfb", "CFB"]] : []),
              ...(enabledSports.includes("nfl") ? [["nfl", "NFL"]] : []),
              ...(enabledSports.includes("nhl") ? [["nhl", "NHL"]] : []),
            ] as Array<[SportFilter, string]>
          ).map(([value, label]) => {
            const active = sportFilter === value;

            return (
              <button
                key={value}
                type="button"
                onClick={() => setSportFilter(value)}
                style={{
                  padding: "9px 13px",
                  borderRadius: 999,
                  border: active
                    ? "1px solid rgba(255,118,39,0.85)"
                    : "1px solid rgba(255,255,255,0.10)",
                  background: active
                    ? "linear-gradient(135deg,#8d1018,#f05a1b)"
                    : "#0b0b0f",
                  color: active ? "#fff" : "#aaaab2",
                  fontSize: 12,
                  fontWeight: 1000,
                  cursor: "pointer",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </section>

      {includesFootball && sportFilter !== "nhl" ? (
        <section
          style={{
            borderRadius: 18,
            border: "1px solid rgba(255,108,33,0.16)",
            overflow: "hidden",
          }}
        >
          <PickemMyPicks
            leagueId={leagueId}
            season={season}
            fantasyTeamId={fantasyTeamId}
            teamName={teamName}
            embedded
            forcedWeek={week}
            visibleSports={
              sportFilter === "cfb"
                ? ["cfb"]
                : sportFilter === "nfl"
                  ? ["nfl"]
                  : enabledSports.filter(
                      (sport): sport is "cfb" | "nfl" =>
                        sport === "cfb" || sport === "nfl"
                    )
            }
          />
        </section>
      ) : null}

      {includesNhl &&
      (sportFilter === "all" || sportFilter === "nhl") ? (
        <section
          style={{
            borderRadius: 18,
            border: "1px solid rgba(255,108,33,0.16)",
            overflow: "hidden",
          }}
        >
          <NhlPickemMyPicks
            leagueId={leagueId}
            season={season}
            fantasyTeamId={fantasyTeamId}
            teamName={teamName}
            embedded
            forcedPeriodNumber={week}
          />
        </section>
      ) : null}
    </main>
  );
}