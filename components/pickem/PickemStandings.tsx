"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  createSupabaseBrowserClient,
} from "@/lib/supabase/browser";


type Props = {
  leagueId: string;
  season: number;
  viewerFantasyTeamId:
    number | null;
};


type TeamRow = {
  id: number;
  team_name: string;
};


type WeekRow = {
  id: number;
  week: number;
  status: string;
  finalized_at:
    string | null;
};


type WeeklyResultRow = {
  pickem_week_id: number;
  fantasy_team_id: number;
  wins: number;
  losses: number;
  pushes: number;
  pending: number;
  points:
    number |
    string;
  is_final: boolean;
  weekly_rank:
    number | null;
};


type SeasonStanding = {
  fantasyTeamId: number;
  teamName: string;
  wins: number;
  losses: number;
  pushes: number;
  points: number;
  finalizedWeeks: number;
};


function numericValue(
  value:
    number |
    string
) {
  const parsed =
    Number(value);

  return Number.isFinite(
    parsed
  )
    ? parsed
    : 0;
}


function formatPoints(
  value:
    number
) {
  return value.toFixed(
    1
  );
}


function recordText(
  wins:
    number,
  losses:
    number,
  pushes:
    number
) {
  return pushes >
    0
    ? `${wins}-${losses}-${pushes}`
    : `${wins}-${losses}`;
}


export default function PickemStandings({
  leagueId,
  season,
  viewerFantasyTeamId,
}: Props) {
  const supabase =
    useMemo(
      () =>
        createSupabaseBrowserClient(),
      []
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    message,
    setMessage,
  ] =
    useState("");

  const [
    teams,
    setTeams,
  ] =
    useState<
      TeamRow[]
    >([]);

  const [
    weeks,
    setWeeks,
  ] =
    useState<
      WeekRow[]
    >([]);

  const [
    results,
    setResults,
  ] =
    useState<
      WeeklyResultRow[]
    >([]);


  const finalWeekIds =
    useMemo(
      () =>
        new Set(
          weeks
            .filter(
              (week) =>
                week.status ===
                  "final"
            )
            .map(
              (week) =>
                week.id
            )
        ),
      [
        weeks,
      ]
    );


  const activeWeek =
    useMemo(
      () =>
        weeks.find(
          (week) =>
            week.status !==
            "final"
        ) ??
        null,
      [
        weeks,
      ]
    );


  const seasonStandings =
    useMemo<
      SeasonStanding[]
    >(() => {
      const teamMap =
        new Map<
          number,
          SeasonStanding
        >();

      for (
        const team
        of teams
      ) {
        teamMap.set(
          team.id,
          {
            fantasyTeamId:
              team.id,
            teamName:
              team.team_name,
            wins:
              0,
            losses:
              0,
            pushes:
              0,
            points:
              0,
            finalizedWeeks:
              0,
          }
        );
      }

      for (
        const result
        of results
      ) {
        if (
          !result.is_final ||
          !finalWeekIds.has(
            result.pickem_week_id
          )
        ) {
          continue;
        }

        const row =
          teamMap.get(
            result.fantasy_team_id
          );

        if (!row) {
          continue;
        }

        row.wins +=
          result.wins;
        row.losses +=
          result.losses;
        row.pushes +=
          result.pushes;
        row.points +=
          numericValue(
            result.points
          );
        row.finalizedWeeks +=
          1;
      }

      return [
        ...teamMap.values(),
      ].sort(
        (
          a,
          b
        ) =>
          b.points -
            a.points ||
          b.wins -
            a.wins ||
          a.losses -
            b.losses ||
          a.teamName.localeCompare(
            b.teamName
          )
      );
    }, [
      finalWeekIds,
      results,
      teams,
    ]);


  const activeWeekResults =
    useMemo(() => {
      if (
        !activeWeek
      ) {
        return [];
      }

      const teamNameMap =
        new Map(
          teams.map(
            (team) => [
              team.id,
              team.team_name,
            ]
          )
        );

      return results
        .filter(
          (row) =>
            row.pickem_week_id ===
            activeWeek.id
        )
        .map(
          (row) => ({
            ...row,
            teamName:
              teamNameMap.get(
                row.fantasy_team_id
              ) ??
              "Entry",
          })
        )
        .sort(
          (
            a,
            b
          ) =>
            numericValue(
              b.points
            ) -
              numericValue(
                a.points
              ) ||
            b.wins -
              a.wins ||
            a.losses -
              b.losses ||
            a.teamName.localeCompare(
              b.teamName
            )
        );
    }, [
      activeWeek,
      results,
      teams,
    ]);


  const load =
    useCallback(
      async () => {
        const [
          teamResult,
          weekResult,
          resultResult,
        ] =
          await Promise.all([
            supabase
              .from(
                "fantasy_teams"
              )
              .select(
                "id,team_name"
              )
              .eq(
                "league_id",
                leagueId
              )
              .eq(
                "active",
                true
              ),

            supabase
              .from(
                "pickem_weeks"
              )
              .select(
                "id,week,status,finalized_at"
              )
              .eq(
                "league_id",
                leagueId
              )
              .eq(
                "season",
                season
              )
              .order(
                "week",
                {
                  ascending:
                    true,
                }
              ),

            supabase
              .from(
                "pickem_weekly_results"
              )
              .select(
                "pickem_week_id,fantasy_team_id,wins,losses,pushes,pending,points,is_final,weekly_rank"
              )
              .eq(
                "league_id",
                leagueId
              ),
          ]);

        if (
          teamResult.error
        ) {
          throw new Error(
            teamResult
              .error.message
          );
        }

        if (
          weekResult.error
        ) {
          throw new Error(
            weekResult
              .error.message
          );
        }

        if (
          resultResult.error
        ) {
          throw new Error(
            resultResult
              .error.message
          );
        }

        setTeams(
          (
            teamResult.data ??
            []
          ) as TeamRow[]
        );

        setWeeks(
          (
            weekResult.data ??
            []
          ) as WeekRow[]
        );

        setResults(
          (
            resultResult.data ??
            []
          ) as WeeklyResultRow[]
        );
      },
      [
        leagueId,
        season,
        supabase,
      ]
    );


  useEffect(() => {
    let active =
      true;

    async function run() {
      setLoading(
        true
      );
      setMessage(
        ""
      );

      try {
        await load();
      } catch (
        error
      ) {
        if (
          !active
        ) {
          return;
        }

        setMessage(
          error instanceof Error
            ? error.message
            : "Pick'em standings could not be loaded."
        );
      } finally {
        if (
          active
        ) {
          setLoading(
            false
          );
        }
      }
    }

    void run();

    return () => {
      active =
        false;
    };
  }, [
    load,
  ]);


  useEffect(() => {
    if (
      loading
    ) {
      return;
    }

    const timer =
      window.setInterval(
        () => {
          void load();
        },
        15000
      );

    return () => {
      window.clearInterval(
        timer
      );
    };
  }, [
    load,
    loading,
  ]);


  if (
    loading
  ) {
    return (
      <main
        style={{
          padding:
            "22px 18px",
          color:
            "#aaaab2",
        }}
      >
        Loading Pick&apos;em standings…
      </main>
    );
  }


  return (
    <main
      style={{
        display:
          "grid",
        gap:
          18,
        maxWidth:
          1180,
        padding:
          "22px 18px 36px",
      }}
    >
      <section
        style={{
          padding:
            20,
          borderRadius:
            18,
          border:
            "1px solid rgba(255,108,33,0.25)",
          background:
            "linear-gradient(135deg, rgba(100,7,13,0.40), rgba(17,17,21,0.98) 58%)",
        }}
      >
        <div
          style={{
            color:
              "#ff7627",
            fontSize:
              12,
            fontWeight:
              1000,
            letterSpacing:
              "0.12em",
            textTransform:
              "uppercase",
          }}
        >
          G365 Football Pick&apos;em
        </div>

        <h1
          style={{
            margin:
              "7px 0 6px",
            color:
              "#fff",
            fontSize:
              "clamp(28px, 5vw, 42px)",
          }}
        >
          Standings
        </h1>

        <p
          style={{
            margin:
              0,
            maxWidth:
              870,
            color:
              "#a5a5ad",
            lineHeight:
              1.6,
          }}
        >
          Official season standings include finalized weeks only. The active week is shown separately as a live snapshot until every eligible game is final and the weekly finalization gate is reached.
        </p>
      </section>


      {message ? (
        <div
          style={{
            padding:
              "12px 14px",
            borderRadius:
              12,
            border:
              "1px solid rgba(255,80,80,0.40)",
            background:
              "rgba(120,0,0,0.20)",
            color:
              "#ff999c",
          }}
        >
          {message}
        </div>
      ) : null}


      <section
        style={{
          overflow:
            "hidden",
          borderRadius:
            16,
          border:
            "1px solid rgba(255,255,255,0.08)",
          background:
            "#101014",
        }}
      >
        <div
          style={{
            display:
              "flex",
            justifyContent:
              "space-between",
            gap:
              12,
            alignItems:
              "center",
            flexWrap:
              "wrap",
            padding:
              "15px 16px",
            borderBottom:
              "1px solid rgba(255,255,255,0.07)",
            background:
              "rgba(0,0,0,0.22)",
          }}
        >
          <div>
            <h2
              style={{
                margin:
                  0,
                color:
                  "#fff",
                fontSize:
                  20,
              }}
            >
              Official Season Standings
            </h2>

            <div
              style={{
                marginTop:
                  4,
                color:
                  "#85858e",
                fontSize:
                  12,
              }}
            >
              {finalWeekIds.size} finalized week
              {finalWeekIds.size ===
              1
                ? ""
                : "s"}
            </div>
          </div>
        </div>

        {seasonStandings.length ===
        0 ? (
          <EmptyLine>
            No Pick&apos;em entries are available yet.
          </EmptyLine>
        ) : (
          seasonStandings.map(
            (
              row,
              index
            ) => (
              <StandingRow
                key={
                  row.fantasyTeamId
                }
                rank={
                  index +
                  1
                }
                teamName={
                  row.teamName
                }
                record={recordText(
                  row.wins,
                  row.losses,
                  row.pushes
                )}
                points={formatPoints(
                  row.points
                )}
                note={`${row.finalizedWeeks} official week${
                  row.finalizedWeeks ===
                  1
                    ? ""
                    : "s"
                }`}
                isViewer={
                  viewerFantasyTeamId ===
                  row.fantasyTeamId
                }
              />
            )
          )
        )}
      </section>


      <section
        style={{
          overflow:
            "hidden",
          borderRadius:
            16,
          border:
            "1px solid rgba(255,108,33,0.16)",
          background:
            "#101014",
        }}
      >
        <div
          style={{
            padding:
              "15px 16px",
            borderBottom:
              "1px solid rgba(255,255,255,0.07)",
            background:
              "rgba(90,10,12,0.18)",
          }}
        >
          <h2
            style={{
              margin:
                0,
              color:
                "#fff",
              fontSize:
                20,
            }}
          >
            {activeWeek
              ? `Week ${activeWeek.week} Live Standings`
              : "Current Week"}
          </h2>

          <div
            style={{
              marginTop:
                4,
              color:
                "#9898a0",
              fontSize:
                12,
            }}
          >
            {activeWeek
              ? "Unofficial until the week is finalized."
              : "There is no active unfinished week."}
          </div>
        </div>

        {!activeWeek ? (
          <EmptyLine>
            All initialized Pick&apos;em weeks are final.
          </EmptyLine>
        ) : activeWeekResults.length ===
          0 ? (
          <EmptyLine>
            Live results have not been generated for this week yet.
          </EmptyLine>
        ) : (
          activeWeekResults.map(
            (
              row,
              index
            ) => (
              <StandingRow
                key={
                  row.fantasy_team_id
                }
                rank={
                  index +
                  1
                }
                teamName={
                  row.teamName
                }
                record={recordText(
                  row.wins,
                  row.losses,
                  row.pushes
                )}
                points={formatPoints(
                  numericValue(
                    row.points
                  )
                )}
                note={
                  row.pending >
                  0
                    ? `${row.pending} remaining`
                    : "Awaiting weekly finalization"
                }
                isViewer={
                  viewerFantasyTeamId ===
                  row.fantasy_team_id
                }
              />
            )
          )
        )}
      </section>
    </main>
  );
}


function StandingRow({
  rank,
  teamName,
  record,
  points,
  note,
  isViewer,
}: {
  rank:
    number;
  teamName:
    string;
  record:
    string;
  points:
    string;
  note:
    string;
  isViewer:
    boolean;
}) {
  return (
    <div
      style={{
        display:
          "grid",
        gridTemplateColumns:
          "42px minmax(0,1fr) auto auto",
        gap:
          12,
        alignItems:
          "center",
        minHeight:
          66,
        padding:
          "11px 15px",
        borderBottom:
          "1px solid rgba(255,255,255,0.055)",
        background:
          isViewer
            ? "linear-gradient(90deg, rgba(145,15,20,0.19), rgba(255,93,21,0.045))"
            : "transparent",
      }}
    >
      <div
        style={{
          color:
            rank ===
            1
              ? "#ff9d59"
              : "#a0a0a8",
          fontSize:
            16,
          fontWeight:
            1000,
          textAlign:
            "center",
        }}
      >
        #{rank}
      </div>

      <div
        style={{
          minWidth:
            0,
        }}
      >
        <div
          style={{
            display:
              "flex",
            gap:
              7,
            alignItems:
              "center",
            flexWrap:
              "wrap",
          }}
        >
          <strong
            style={{
              overflow:
                "hidden",
              textOverflow:
                "ellipsis",
              color:
                "#fff",
              whiteSpace:
                "nowrap",
            }}
          >
            {teamName}
          </strong>

          {isViewer ? (
            <span
              style={{
                padding:
                  "2px 6px",
                borderRadius:
                  999,
                background:
                  "rgba(255,108,33,0.13)",
                color:
                  "#ff9b59",
                fontSize:
                  9,
                fontWeight:
                  1000,
              }}
            >
              YOU
            </span>
          ) : null}
        </div>

        <div
          style={{
            marginTop:
              4,
            color:
              "#81818a",
            fontSize:
              11,
          }}
        >
          {note}
        </div>
      </div>

      <div
        style={{
          minWidth:
            72,
          textAlign:
            "right",
        }}
      >
        <div
          style={{
            color:
              "#fff",
            fontSize:
              15,
            fontWeight:
              1000,
          }}
        >
          {record}
        </div>

        <div
          style={{
            marginTop:
              3,
            color:
              "#7f7f88",
            fontSize:
              9,
            fontWeight:
              900,
            letterSpacing:
              "0.06em",
          }}
        >
          RECORD
        </div>
      </div>

      <div
        style={{
          minWidth:
            72,
          textAlign:
            "right",
        }}
      >
        <div
          style={{
            color:
              "#ff9b59",
            fontSize:
              17,
            fontWeight:
              1000,
          }}
        >
          {points}
        </div>

        <div
          style={{
            marginTop:
              3,
            color:
              "#7f7f88",
            fontSize:
              9,
            fontWeight:
              900,
            letterSpacing:
              "0.06em",
          }}
        >
          POINTS
        </div>
      </div>
    </div>
  );
}


function EmptyLine({
  children,
}: {
  children:
    React.ReactNode;
}) {
  return (
    <div
      style={{
        padding:
          "18px 16px",
        color:
          "#8e8e97",
        lineHeight:
          1.5,
      }}
    >
      {children}
    </div>
  );
}
