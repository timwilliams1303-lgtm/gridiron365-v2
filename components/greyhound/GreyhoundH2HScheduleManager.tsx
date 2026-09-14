"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Team = {
  id: number;
  team_number: number;
  team_name: string;
  active: boolean;
};

type Matchup = {
  id: number;
  matchupNumber: number;
  startDate: string;
  endDate: string;
  homeTeamId: number;
  awayTeamId: number | null;
  homeTeamName: string;
  awayTeamName: string;
  homeTotalReturn: number;
  awayTotalReturn: number;
  winnerTeamId: number | null;
  isTie: boolean;
  status: string;
  finalizedAt: string | null;
};

type Period = {
  matchupNumber: number;
  startDate: string;
  endDate: string;
};

type H2HRecord = {
  competitionTeamId: number;
  teamName: string;
  wins: number;
  losses: number;
  ties: number;
  totalReturned: number;
  totalWagered: number;
  net: number;
};

type ApiResponse = {
  success: boolean;
  error?: string;
  gameFormat?: string;
  competitionStartDate?: string | null;
  competitionEndDate?: string | null;
  periods?: Period[];
  teams?: Team[];
  matchups?: Matchup[];
  records?: H2HRecord[];
};

type Props = {
  leagueId: string;
};

export default function GreyhoundH2HScheduleManager({ leagueId }: Props) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [manualPeriod, setManualPeriod] = useState("1");
  const [manualHome, setManualHome] = useState("");
  const [manualAway, setManualAway] = useState("");

  const load = useCallback(async () => {
    setError(null);

    try {
      const response = await fetch(
        `/api/greyhound/commissioner/h2h-schedule?leagueId=${encodeURIComponent(
          leagueId,
        )}`,
        { cache: "no-store" },
      );

      const payload = (await response.json()) as ApiResponse;

      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? "Unable to load H2H schedule.");
      }

      setData(payload);

      if ((payload.periods ?? []).length > 0) {
        setManualPeriod(String(payload.periods?.[0]?.matchupNumber ?? 1));
      }

      if ((payload.teams ?? []).length > 0) {
        setManualHome(String(payload.teams?.[0]?.id ?? ""));
        setManualAway(String(payload.teams?.[1]?.id ?? ""));
      }
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load H2H schedule.",
      );
    } finally {
      setLoading(false);
    }
  }, [leagueId]);

  useEffect(() => {
    void load();
  }, [load]);

  const grouped = useMemo(() => {
    const map = new Map<number, Matchup[]>();

    for (const matchup of data?.matchups ?? []) {
      const rows = map.get(matchup.matchupNumber) ?? [];
      rows.push(matchup);
      map.set(matchup.matchupNumber, rows);
    }

    return map;
  }, [data?.matchups]);

  async function act(
    action: string,
    body: Record<string, unknown>,
    workingKey: string,
    successMessage: string,
  ) {
    setWorking(workingKey);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(
        "/api/greyhound/commissioner/h2h-schedule",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            leagueId,
            action,
            ...body,
          }),
        },
      );

      const payload = (await response.json()) as {
        success?: boolean;
        error?: string;
      };

      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? "Unable to update H2H schedule.");
      }

      setMessage(successMessage);
      await load();
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Unable to update H2H schedule.",
      );
    } finally {
      setWorking(null);
    }
  }

  async function generate(randomize: boolean) {
    const existingCount = data?.matchups?.length ?? 0;

    if (
      existingCount > 0 &&
      !window.confirm(
        "This replaces the current Greyhound Head-to-Head schedule. Continue?",
      )
    ) {
      return;
    }

    await act(
      "generate_schedule",
      { randomize },
      randomize ? "generate-random" : "generate-ordered",
      randomize
        ? "Randomized Head-to-Head schedule generated."
        : "Head-to-Head schedule generated in current team order.",
    );
  }

  async function addManualMatchup() {
    if (!manualHome) {
      setError("Choose a home team.");
      return;
    }

    await act(
      "save_matchup",
      {
        matchupNumber: Number(manualPeriod),
        homeTeamId: Number(manualHome),
        awayTeamId: manualAway ? Number(manualAway) : null,
      },
      "manual-add",
      "Manual matchup added.",
    );
  }

  if (loading) {
    return <div className="gh2h-empty">Loading Head-to-Head scheduling…</div>;
  }

  if (data?.gameFormat !== "team_head_to_head") {
    return null;
  }

  return (
    <section className="gh2h-wrap">
      <style>{styles}</style>

      <div className="gh2h-head">
        <div>
          <div className="gh2h-kicker">HEAD-TO-HEAD SCHEDULING</div>
          <h2>Matchup Schedule</h2>
          <p>
            Build weekly Greyhound team matchups across the configured
            competition window. Generate a round-robin schedule or manually
            create and edit each matchup.
          </p>
        </div>

        <div className="gh2h-actions">
          <button
            type="button"
            disabled={working != null}
            onClick={() =>
              void act(
                "refresh_official_scores",
                {},
                "refresh-scores",
                "Official Head-to-Head scores and records refreshed.",
              )
            }
          >
            Refresh Official Scores
          </button>

          <button
            type="button"
            disabled={working != null}
            onClick={() => void generate(true)}
          >
            Randomize Schedule
          </button>

          <button
            type="button"
            className="secondary"
            disabled={working != null}
            onClick={() => void generate(false)}
          >
            Generate in Team Order
          </button>
        </div>
      </div>

      {error ? <div className="gh2h-alert error">{error}</div> : null}
      {message ? <div className="gh2h-alert success">{message}</div> : null}

      <div className="gh2h-summary">
        <article>
          <span>TEAMS</span>
          <strong>{data?.teams?.length ?? 0}</strong>
        </article>
        <article>
          <span>WEEKLY PERIODS</span>
          <strong>{data?.periods?.length ?? 0}</strong>
        </article>
        <article>
          <span>MATCHUPS</span>
          <strong>{data?.matchups?.length ?? 0}</strong>
        </article>
        <article>
          <span>WINDOW</span>
          <strong>
            {data?.competitionStartDate ?? "—"} →{" "}
            {data?.competitionEndDate ?? "—"}
          </strong>
        </article>
      </div>

      <div className="gh2h-records">
        <div className="gh2h-record-head">
          <div>
            <span>OFFICIAL H2H RECORDS</span>
            <strong>Team Standings</strong>
          </div>
          <small>Scored by official total return</small>
        </div>

        {(data?.records?.length ?? 0) === 0 ? (
          <div className="gh2h-none">
            No finalized Head-to-Head records yet.
          </div>
        ) : (
          <div className="gh2h-record-list">
            {(data?.records ?? []).map((record, index) => (
              <div
                key={record.competitionTeamId}
                className="gh2h-record-row"
              >
                <b>#{index + 1}</b>
                <strong>{record.teamName}</strong>
                <span>
                  {record.wins}-{record.losses}-{record.ties}
                </span>
                <span>
                  ${record.totalReturned.toFixed(2)} returned
                </span>
                <span className={record.net >= 0 ? "positive" : "negative"}>
                  {record.net >= 0 ? "+" : ""}
                  ${record.net.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="gh2h-manual">
        <div>
          <span>MANUAL MATCHUP</span>
          <strong>Add a matchup or bye</strong>
        </div>

        <select
          value={manualPeriod}
          onChange={(event) => setManualPeriod(event.target.value)}
        >
          {(data?.periods ?? []).map((period) => (
            <option key={period.matchupNumber} value={period.matchupNumber}>
              Week {period.matchupNumber} · {period.startDate} to{" "}
              {period.endDate}
            </option>
          ))}
        </select>

        <select
          value={manualHome}
          onChange={(event) => setManualHome(event.target.value)}
        >
          {(data?.teams ?? []).map((team) => (
            <option key={team.id} value={team.id}>
              {team.team_name}
            </option>
          ))}
        </select>

        <select
          value={manualAway}
          onChange={(event) => setManualAway(event.target.value)}
        >
          <option value="">BYE</option>
          {(data?.teams ?? []).map((team) => (
            <option key={team.id} value={team.id}>
              {team.team_name}
            </option>
          ))}
        </select>

        <button
          type="button"
          disabled={working != null}
          onClick={() => void addManualMatchup()}
        >
          Add Matchup
        </button>
      </div>

      {(data?.periods ?? []).length === 0 ? (
        <div className="gh2h-empty">
          Set the competition start and end dates in Greyhound Settings first.
        </div>
      ) : (
        <div className="gh2h-weeks">
          {(data?.periods ?? []).map((period) => {
            const rows = grouped.get(period.matchupNumber) ?? [];

            return (
              <article key={period.matchupNumber} className="gh2h-week">
                <div className="gh2h-week-head">
                  <div>
                    <span>WEEK {period.matchupNumber}</span>
                    <strong>
                      {period.startDate} → {period.endDate}
                    </strong>
                  </div>

                  <small>
                    {rows.length} matchup{rows.length === 1 ? "" : "s"}
                  </small>
                </div>

                {rows.length === 0 ? (
                  <div className="gh2h-none">No matchups scheduled.</div>
                ) : (
                  <div className="gh2h-list">
                    {rows.map((matchup) => (
                      <div key={matchup.id} className="gh2h-matchup">
                        <div className="gh2h-team home">
                          <span>HOME</span>
                          <strong>{matchup.homeTeamName}</strong>
                        </div>

                        <div className="gh2h-vs">
                          {matchup.awayTeamId == null
                            ? "BYE"
                            : matchup.status === "final"
                              ? `${matchup.homeTotalReturn.toFixed(2)} - ${matchup.awayTotalReturn.toFixed(2)}`
                              : "VS"}
                        </div>

                        <div className="gh2h-team">
                          <span>AWAY</span>
                          <strong>{matchup.awayTeamName}</strong>
                        </div>

                        <div className="gh2h-match-status">
                          {matchup.status.toUpperCase()}
                        </div>

                        <button
                          type="button"
                          className="danger"
                          disabled={working != null}
                          onClick={() => {
                            if (
                              window.confirm(
                                "Remove this Head-to-Head matchup?",
                              )
                            ) {
                              void act(
                                "delete_matchup",
                                { matchupId: matchup.id },
                                `delete-${matchup.id}`,
                                "Matchup removed.",
                              );
                            }
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {(data?.matchups?.length ?? 0) > 0 ? (
        <div className="gh2h-clear">
          <button
            type="button"
            disabled={working != null}
            onClick={() => {
              if (
                window.confirm(
                  "Clear the entire Greyhound Head-to-Head schedule?",
                )
              ) {
                void act(
                  "clear_schedule",
                  {},
                  "clear",
                  "Head-to-Head schedule cleared.",
                );
              }
            }}
          >
            Clear Entire Schedule
          </button>
        </div>
      ) : null}
    </section>
  );
}

const styles = `
.gh2h-wrap{margin-top:14px;padding:16px;border:1px solid #2d2f33;border-radius:15px;background:#101113;color:#fff}
.gh2h-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px}
.gh2h-kicker{color:#ff6b22;font-size:8px;font-weight:950;letter-spacing:.14em}
.gh2h-head h2{margin:5px 0;font-size:22px;font-weight:950}
.gh2h-head p{max-width:760px;margin:0;color:#858a91;font-size:10px;line-height:1.55}
.gh2h-actions{display:flex;gap:7px;flex-wrap:wrap}
.gh2h-actions button,.gh2h-manual button{min-height:39px;padding:0 12px;border:0;border-radius:9px;background:linear-gradient(90deg,#9b2017,#ef681f);color:#fff;font-size:8px;font-weight:950;cursor:pointer}
.gh2h-actions button.secondary{border:1px solid #34373b;background:#16171a}
.gh2h-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-top:12px}
.gh2h-summary article{padding:11px;border:1px solid #2b2d31;border-radius:11px;background:#0c0d0f}
.gh2h-summary span{display:block;color:#777d84;font-size:7px;font-weight:950}
.gh2h-summary strong{display:block;margin-top:4px;font-size:11px}
.gh2h-alert{margin-top:10px;padding:10px;border-radius:9px;font-size:9px}
.gh2h-alert.error{border:1px solid rgba(204,49,37,.46);background:rgba(92,17,12,.22);color:#ffaaa2}
.gh2h-alert.success{border:1px solid rgba(53,167,93,.38);background:rgba(22,86,48,.18);color:#96e5b7}
.gh2h-records{margin-top:12px;overflow:hidden;border:1px solid #2d2f33;border-radius:11px;background:#0c0d0f}
.gh2h-record-head{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:10px 12px;border-bottom:1px solid #25272b;background:#111216}
.gh2h-record-head span{display:block;color:#ff6b22;font-size:7px;font-weight:950;letter-spacing:.10em}
.gh2h-record-head strong{display:block;margin-top:3px;font-size:11px}
.gh2h-record-head small{color:#747a82;font-size:8px}
.gh2h-record-list{display:grid}
.gh2h-record-row{display:grid;grid-template-columns:42px minmax(150px,1fr) 80px 130px 90px;gap:8px;align-items:center;padding:9px 12px;border-top:1px solid #222428;font-size:9px}
.gh2h-record-row:first-child{border-top:0}
.gh2h-record-row b{color:#ff6b22}
.gh2h-record-row span{color:#8b9097}
.gh2h-record-row .positive{color:#86dda9;font-weight:900}
.gh2h-record-row .negative{color:#ff8d83;font-weight:900}
.gh2h-manual{display:grid;grid-template-columns:1.15fr 1.4fr 1fr 1fr auto;gap:7px;align-items:end;margin-top:12px;padding:11px;border:1px solid #303237;border-radius:11px;background:#0d0e10}
.gh2h-manual span{display:block;color:#ff6b22;font-size:7px;font-weight:950}
.gh2h-manual strong{display:block;margin-top:3px;font-size:10px}
.gh2h-manual select{min-height:39px;border:1px solid #393c41;border-radius:8px;background:#090a0c;color:#fff;padding:0 9px;font-size:9px}
.gh2h-weeks{display:grid;gap:9px;margin-top:12px}
.gh2h-week{overflow:hidden;border:1px solid #2c2e32;border-radius:12px;background:#0c0d0f}
.gh2h-week-head{display:flex;justify-content:space-between;gap:12px;padding:10px 12px;border-bottom:1px solid #25272b;background:#111216}
.gh2h-week-head span{display:block;color:#ff6b22;font-size:7px;font-weight:950}
.gh2h-week-head strong{display:block;margin-top:3px;font-size:10px}
.gh2h-week-head small{color:#757a82;font-size:8px}
.gh2h-list{display:grid}
.gh2h-matchup{display:grid;grid-template-columns:minmax(0,1fr) 50px minmax(0,1fr) 90px auto;gap:8px;align-items:center;padding:10px 12px;border-top:1px solid #222428}
.gh2h-matchup:first-child{border-top:0}
.gh2h-team span{display:block;color:#6e747c;font-size:7px;font-weight:950}
.gh2h-team strong{display:block;margin-top:3px;font-size:11px}
.gh2h-vs{text-align:center;color:#e76026;font-size:8px;font-weight:950}
.gh2h-match-status{color:#888e95;font-size:7px;font-weight:950;text-align:center}
.gh2h-matchup button.danger,.gh2h-clear button{min-height:34px;padding:0 10px;border:1px solid rgba(190,47,35,.38);border-radius:8px;background:#1a1010;color:#ff9f96;font-size:7px;font-weight:950;cursor:pointer}
.gh2h-none,.gh2h-empty{padding:14px;color:#7d8289;font-size:9px}
.gh2h-clear{margin-top:10px;text-align:right}
@media(max-width:950px){.gh2h-record-row{grid-template-columns:35px 1fr 70px}.gh2h-record-row span:nth-of-type(2),.gh2h-record-row span:nth-of-type(3){grid-column:auto}.gh2h-head{flex-direction:column}.gh2h-summary{grid-template-columns:repeat(2,minmax(0,1fr))}.gh2h-manual{grid-template-columns:1fr 1fr}.gh2h-manual>div:first-child,.gh2h-manual button{grid-column:1/-1}.gh2h-matchup{grid-template-columns:1fr 40px 1fr}.gh2h-match-status,.gh2h-matchup button.danger{grid-column:auto}}
@media(max-width:600px){.gh2h-record-head{align-items:flex-start;flex-direction:column}.gh2h-record-row{grid-template-columns:32px 1fr}.gh2h-record-row span{grid-column:2}.gh2h-summary{grid-template-columns:1fr}.gh2h-manual{grid-template-columns:1fr}.gh2h-manual>div:first-child,.gh2h-manual button{grid-column:auto}.gh2h-matchup{grid-template-columns:1fr}.gh2h-vs{text-align:left}.gh2h-match-status{text-align:left}}
`;
