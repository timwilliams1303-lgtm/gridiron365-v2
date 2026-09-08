"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type Props = {
  leagueId: string;
  season: number;
};

type PeriodRow = {
  id: number;
  period_number: number;
  starts_at: string;
  ends_at: string;
  status: string;
  finalized_at: string | null;
};

type PeriodGameRow = {
  nhl_pickem_period_id: number;
};

function formatDate(value: string | null | undefined) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function statusColor(status: string) {
  const normalized = status.toLowerCase();

  if (normalized === "final") return "#8ce5a7";
  if (normalized === "in_progress" || normalized === "active") return "#ffb15c";
  if (normalized === "locked") return "#ffd277";
  return "#b9bbc4";
}

export default function PickemNhlCommissionerPanel({
  leagueId,
  season,
}: Props) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [periods, setPeriods] = useState<PeriodRow[]>([]);
  const [gamesByPeriod, setGamesByPeriod] = useState<Record<number, number>>({});

  const load = useCallback(async () => {
    setLoading(true);

    try {
      const [periodResponse, gameResponse] = await Promise.all([
        supabase
          .from("nhl_pickem_periods")
          .select("id,period_number,starts_at,ends_at,status,finalized_at")
          .eq("league_id", leagueId)
          .eq("season", season)
          .order("period_number", { ascending: true }),
        supabase
          .from("nhl_pickem_games")
          .select("nhl_pickem_period_id")
          .eq("league_id", leagueId),
      ]);

      if (periodResponse.error) {
        throw new Error(periodResponse.error.message);
      }

      if (gameResponse.error) {
        throw new Error(gameResponse.error.message);
      }

      const loadedPeriods = (periodResponse.data ?? []) as PeriodRow[];
      const loadedGames = (gameResponse.data ?? []) as PeriodGameRow[];
      const counts: Record<number, number> = {};

      for (const game of loadedGames) {
        counts[game.nhl_pickem_period_id] =
          (counts[game.nhl_pickem_period_id] ?? 0) + 1;
      }

      setPeriods(loadedPeriods);
      setGamesByPeriod(counts);
    } catch (error) {
      setIsError(true);
      setMessage(
        error instanceof Error
          ? error.message
          : "NHL contest status could not be loaded."
      );
    } finally {
      setLoading(false);
    }
  }, [leagueId, season, supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  async function runUnifiedSync() {
    if (syncing) return;

    setSyncing(true);
    setMessage("");
    setIsError(false);

    try {
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      if (sessionError) {
        throw new Error(sessionError.message);
      }

      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        throw new Error("Your login session could not be verified.");
      }

      const response = await fetch("/api/pickem/commissioner-sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ leagueId }),
      });

      const bodyText = await response.text();
      let body: unknown = bodyText;

      try {
        body = JSON.parse(bodyText);
      } catch {
        // Keep plain text response for the error below.
      }

      if (!response.ok) {
        const errorMessage =
          typeof body === "object" && body !== null && "error" in body
            ? String((body as { error?: unknown }).error ?? "")
            : bodyText;

        throw new Error(
          errorMessage || `Unified Pick'em sync failed with HTTP ${response.status}.`
        );
      }

      await load();
      setMessage(
        "Unified Pick'em sync completed. Football games and eligible NHL contest periods were refreshed from the master Pick'em calendar."
      );
    } catch (error) {
      setIsError(true);
      setMessage(
        error instanceof Error
          ? error.message
          : "Unified Pick'em sync could not be completed."
      );
    } finally {
      setSyncing(false);
    }
  }

  return (
    <section
      style={{
        display: "grid",
        gap: 14,
        padding: 16,
        borderRadius: 14,
        border: "1px solid rgba(255,112,35,0.22)",
        background:
          "linear-gradient(135deg,rgba(112,10,16,0.17),rgba(17,17,21,0.97) 58%)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 14,
          flexWrap: "wrap",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              color: "#ff7627",
              fontSize: 11,
              fontWeight: 1000,
              letterSpacing: "0.11em",
              textTransform: "uppercase",
            }}
          >
            NHL ENGINE
          </div>
          <h3
            style={{
              margin: "5px 0 0",
              color: "#fff",
              fontSize: 21,
              lineHeight: 1.2,
            }}
          >
            NHL Contest Operations
          </h3>
          <p
            style={{
              margin: "7px 0 0",
              color: "#a1a1aa",
              lineHeight: 1.55,
              maxWidth: 760,
            }}
          >
            NHL now follows the same G365 Pick&apos;em master contest calendar. Only master weeks that actually contain NHL games receive an NHL period; empty preseason football weeks are not mirrored into the NHL engine.
          </p>
        </div>

        <button
          type="button"
          disabled={syncing}
          onClick={() => void runUnifiedSync()}
          style={{
            minHeight: 42,
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid rgba(255,122,45,0.55)",
            background:
              "linear-gradient(135deg,rgba(163,18,22,0.92),rgba(239,91,22,0.94))",
            color: "#fff",
            fontSize: 12,
            fontWeight: 1000,
            letterSpacing: "0.05em",
            cursor: syncing ? "not-allowed" : "pointer",
            opacity: syncing ? 0.65 : 1,
          }}
        >
          {syncing ? "SYNCING..." : "RUN UNIFIED PICK'EM SYNC"}
        </button>
      </div>

      {message ? (
        <div
          style={{
            padding: 11,
            borderRadius: 10,
            border: `1px solid ${
              isError
                ? "rgba(248,113,113,0.30)"
                : "rgba(74,222,128,0.24)"
            }`,
            background: isError
              ? "rgba(127,29,29,0.24)"
              : "rgba(20,83,45,0.22)",
            color: isError ? "#fecaca" : "#bbf7d0",
            fontSize: 12,
            lineHeight: 1.5,
          }}
        >
          {message}
        </div>
      ) : null}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))",
          gap: 10,
        }}
      >
        <RuleCard
          label="PERIOD SOURCE"
          value="MASTER PICK'EM WEEK"
          detail="No separate NHL calendar numbering in mixed leagues."
        />
        <RuleCard
          label="NHL PICK LOCK"
          value="GAME / PUCK DROP"
          detail="The mature NHL engine keeps individual game locking."
        />
        <RuleCard
          label="OFFICIAL NHL LINE"
          value="11:00 AM ET"
          detail="Platform line-freeze timing remains an NHL engine rule."
        />
        <RuleCard
          label="SEASON"
          value={String(season)}
          detail={`${periods.length} NHL contest period${periods.length === 1 ? "" : "s"} currently mirrored.`}
        />
      </div>

      <div
        style={{
          overflowX: "auto",
          borderRadius: 12,
          border: "1px solid rgba(255,255,255,0.08)",
          background: "rgba(0,0,0,0.16)",
        }}
      >
        {loading ? (
          <div style={{ padding: 16, color: "#a1a1aa" }}>
            Loading NHL contest periods…
          </div>
        ) : periods.length === 0 ? (
          <div style={{ padding: 16, color: "#a1a1aa", lineHeight: 1.55 }}>
            No NHL periods are mirrored yet. Run the unified sync after the NHL schedule exists in <code>nhl_games</code>. Weeks without NHL games will intentionally remain empty.
          </div>
        ) : (
          <table
            style={{
              width: "100%",
              minWidth: 680,
              borderCollapse: "collapse",
              fontSize: 12,
            }}
          >
            <thead>
              <tr>
                {[
                  "MASTER WEEK",
                  "START",
                  "END",
                  "NHL GAMES",
                  "STATUS",
                  "FINALIZED",
                ].map((label) => (
                  <th
                    key={label}
                    style={{
                      padding: "10px 12px",
                      textAlign: "left",
                      color: "#8f9098",
                      fontSize: 10,
                      letterSpacing: "0.08em",
                      borderBottom: "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {periods.map((period) => (
                <tr key={period.id}>
                  <td style={cellStyleStrong}>{period.period_number}</td>
                  <td style={cellStyle}>{formatDate(period.starts_at)}</td>
                  <td style={cellStyle}>{formatDate(period.ends_at)}</td>
                  <td style={cellStyle}>{gamesByPeriod[period.id] ?? 0}</td>
                  <td
                    style={{
                      ...cellStyle,
                      color: statusColor(period.status),
                      fontWeight: 900,
                      textTransform: "uppercase",
                    }}
                  >
                    {period.status.replaceAll("_", " ")}
                  </td>
                  <td style={cellStyle}>
                    {period.finalized_at ? formatDate(period.finalized_at) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

function RuleCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div
      style={{
        minWidth: 0,
        padding: 12,
        borderRadius: 11,
        border: "1px solid rgba(255,255,255,0.07)",
        background: "rgba(255,255,255,0.025)",
      }}
    >
      <div
        style={{
          color: "#85868e",
          fontSize: 9,
          fontWeight: 1000,
          letterSpacing: "0.08em",
        }}
      >
        {label}
      </div>
      <div
        style={{
          marginTop: 5,
          color: "#fff",
          fontSize: 13,
          fontWeight: 1000,
        }}
      >
        {value}
      </div>
      <div
        style={{
          marginTop: 5,
          color: "#8f9098",
          fontSize: 10,
          lineHeight: 1.45,
        }}
      >
        {detail}
      </div>
    </div>
  );
}

const cellStyle: React.CSSProperties = {
  padding: "11px 12px",
  color: "#b8b9c0",
  borderTop: "1px solid rgba(255,255,255,0.055)",
  whiteSpace: "nowrap",
};

const cellStyleStrong: React.CSSProperties = {
  ...cellStyle,
  color: "#fff",
  fontWeight: 1000,
};
