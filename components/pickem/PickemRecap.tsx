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


type ScoringMode =
  | "record_only"
  | "standard"
  | "three_one_zero"
  | "custom"
  | "confidence";


type WeekRow = {
  id: number;
  week: number;
  status: string;
  finalized_at:
    string | null;
  scoring_mode: ScoringMode;
};


type ResultRow = {
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
  missing_picks: number;
  is_disqualified: boolean;
};


type BadgeRow = {
  id: number;
  fantasy_team_id: number;
  season: number;
  week: number;
  badge_key: string;
  badge_name: string;
  badge_category:
    | "ACHIEVEMENT"
    | "INFAMY"
    | "WEEKLY";
  details:
    Record<
      string,
      unknown
    > |
    null;
  created_at: string;
};


function n(
  value:
    number |
    string |
    null |
    undefined
) {
  const parsed =
    Number(value);

  return Number.isFinite(
    parsed
  )
    ? parsed
    : 0;
}


function points(
  value:
    number |
    string
) {
  return n(
    value
  ).toFixed(
    1
  );
}


function record(
  row:
    ResultRow
) {
  return row.pushes >
    0
    ? `${row.wins}-${row.losses}-${row.pushes}`
    : `${row.wins}-${row.losses}`;
}


function badgeEmoji(
  badge:
    BadgeRow
) {
  const emoji =
    badge.details?.emoji;

  return typeof emoji ===
    "string"
    ? emoji
    : badge.badge_category ===
        "INFAMY"
      ? "⚠️"
      : badge.badge_category ===
          "WEEKLY"
        ? "🏆"
        : "⭐";
}


function badgeDetail(
  badge:
    BadgeRow
) {
  const detail =
    badge.details?.detail;

  return typeof detail ===
    "string"
    ? detail
    : "Earned in G365 Football Pick'em.";
}


function categoryColor(
  category:
    BadgeRow["badge_category"]
) {
  if (
    category ===
    "INFAMY"
  ) {
    return "#ff7478";
  }

  if (
    category ===
    "WEEKLY"
  ) {
    return "#ffbd5f";
  }

  return "#62df92";
}


export default function PickemRecap({
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
      ResultRow[]
    >([]);

  const [
    badges,
    setBadges,
  ] =
    useState<
      BadgeRow[]
    >([]);

  const [
    selectedWeekId,
    setSelectedWeekId,
  ] =
    useState<
      number |
      null
    >(null);


  const teamMap =
    useMemo(
      () =>
        new Map(
          teams.map(
            (
              team
            ) => [
              team.id,
              team.team_name,
            ]
          )
        ),
      [
        teams,
      ]
    );


  const finalWeeks =
    useMemo(
      () =>
        weeks.filter(
          (
            week
          ) =>
            week.status ===
            "final"
        ),
      [
        weeks,
      ]
    );


  const selectedWeek =
    useMemo(
      () =>
        finalWeeks.find(
          (
            week
          ) =>
            week.id ===
            selectedWeekId
        ) ??
        null,
      [
        finalWeeks,
        selectedWeekId,
      ]
    );


  const selectedResults =
    useMemo(
      () =>
        selectedWeek
          ? results
              .filter(
                (
                  row
                ) =>
                  row.pickem_week_id ===
                    selectedWeek.id &&
                  row.is_final
              )
              .sort(
                (
                  a,
                  b
                ) =>
                  Number(a.is_disqualified) -
                    Number(b.is_disqualified) ||
                  n(
                    a.weekly_rank ?? Number.MAX_SAFE_INTEGER
                  ) -
                    n(
                      b.weekly_rank ?? Number.MAX_SAFE_INTEGER
                    ) ||
                  n(
                    b.points
                  ) -
                    n(
                      a.points
                    )
              )
          : [],
      [
        results,
        selectedWeek,
      ]
    );


  const selectedBadges =
    useMemo(
      () =>
        selectedWeek
          ? badges.filter(
              (
                badge
              ) =>
                badge.week ===
                selectedWeek.week
            )
          : [],
      [
        badges,
        selectedWeek,
      ]
    );


  const trophyTeams =
    useMemo(
      () =>
        teams
          .map(
            (
              team
            ) => {
              const earned =
                badges.filter(
                  (
                    badge
                  ) =>
                    badge.fantasy_team_id ===
                    team.id
                );

              return {
                team,
                badges:
                  earned,
              };
            }
          )
          .filter(
            (
              row
            ) =>
              row.badges.length >
              0
          )
          .sort(
            (
              a,
              b
            ) =>
              b.badges.length -
                a.badges.length ||
              a.team.team_name.localeCompare(
                b.team.team_name
              )
          ),
      [
        badges,
        teams,
      ]
    );


  const load =
    useCallback(
      async () => {
        const [
          teamResult,
          weekResult,
          resultResult,
          badgeResult,
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
              ),

            supabase
              .from(
                "pickem_weeks"
              )
              .select(
                "id,week,status,finalized_at,scoring_mode"
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
                "pickem_week_id,fantasy_team_id,wins,losses,pushes,pending,points,is_final,weekly_rank,missing_picks,is_disqualified"
              )
              .eq(
                "league_id",
                leagueId
              ),

            supabase
              .from(
                "pickem_badge_awards"
              )
              .select(
                "id,fantasy_team_id,season,week,badge_key,badge_name,badge_category,details,created_at"
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
                    false,
                }
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

        if (
          badgeResult.error
        ) {
          throw new Error(
            badgeResult
              .error.message
          );
        }

        const nextWeeks =
          (
            weekResult.data ??
            []
          ) as WeekRow[];

        setTeams(
          (
            teamResult.data ??
            []
          ) as TeamRow[]
        );

        setWeeks(
          nextWeeks
        );

        setResults(
          (
            resultResult.data ??
            []
          ) as ResultRow[]
        );

        setBadges(
          (
            badgeResult.data ??
            []
          ) as BadgeRow[]
        );

        const finals =
          nextWeeks.filter(
            (
              week
            ) =>
              week.status ===
              "final"
          );

        setSelectedWeekId(
          (
            current
          ) =>
            current &&
            finals.some(
              (
                week
              ) =>
                week.id ===
                current
            )
              ? current
              : finals.at(-1)
                  ?.id ??
                null
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
            : "Pick'em recap could not be loaded."
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
        Loading Pick&apos;em recap…
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
          "22px 18px 40px",
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
            "linear-gradient(135deg, rgba(100,7,13,0.42), rgba(17,17,21,0.98) 58%)",
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
              "clamp(30px,5vw,44px)",
          }}
        >
          Recap & Trophy Room
        </h1>

        <p
          style={{
            margin:
              0,
            color:
              "#a6a6ae",
            lineHeight:
              1.6,
            maxWidth:
              850,
          }}
        >
          Official weekly winners, ATS records, permanent badges, achievements, weekly honors, and the infamous side of the Pick&apos;em season.
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
              "1px solid rgba(255,80,80,0.4)",
            background:
              "rgba(120,0,0,0.2)",
            color:
              "#ff999c",
          }}
        >
          {message}
        </div>
      ) : null}


      {finalWeeks.length ===
      0 ? (
        <EmptyState
          text="Recaps unlock after the first Pick'em week is officially finalized."
        />
      ) : (
        <>
          <section
            style={
              styles.card
            }
          >
            <div
              style={
                styles.sectionHead
              }
            >
              <div>
                <div
                  style={
                    styles.eyebrow
                  }
                >
                  WEEKLY RECAP
                </div>

                <h2
                  style={
                    styles.title
                  }
                >
                  Official Results
                </h2>
              </div>

              <select
                value={
                  selectedWeekId ??
                  ""
                }
                onChange={(
                  event
                ) =>
                  setSelectedWeekId(
                    Number(
                      event.target
                        .value
                    )
                  )
                }
                style={{
                  minHeight:
                    42,
                  padding:
                    "8px 11px",
                  borderRadius:
                    9,
                  border:
                    "1px solid rgba(255,118,39,0.35)",
                  background:
                    "#09090c",
                  color:
                    "#fff",
                  fontWeight:
                    900,
                }}
              >
                {finalWeeks.map(
                  (
                    week
                  ) => (
                    <option
                      key={
                        week.id
                      }
                      value={
                        week.id
                      }
                    >
                      Week{" "}
                      {
                        week.week
                      }
                    </option>
                  )
                )}
              </select>
            </div>

            {selectedResults.map(
              (
                row,
                index
              ) => {
                const isViewer =
                  viewerFantasyTeamId ===
                  row.fantasy_team_id;

                return (
                  <div
                    key={
                      row.fantasy_team_id
                    }
                    style={{
                      display:
                        "grid",
                      gridTemplateColumns:
                        "46px minmax(0,1fr) auto auto",
                      gap:
                        12,
                      alignItems:
                        "center",
                      minHeight:
                        68,
                      padding:
                        "11px 13px",
                      borderTop:
                        "1px solid rgba(255,255,255,0.06)",
                      background:
                        isViewer
                          ? "rgba(255,90,20,0.055)"
                          : "transparent",
                    }}
                  >
                    <div
                      style={{
                        color:
                          index ===
                          0
                            ? "#ffac55"
                            : "#9999a2",
                        fontSize:
                          17,
                        fontWeight:
                          1000,
                        textAlign:
                          "center",
                      }}
                    >
                      {row.is_disqualified
                        ? "DQ"
                        : `#${row.weekly_rank ?? index + 1}`}
                    </div>

                    <div
                      style={{
                        minWidth:
                          0,
                      }}
                    >
                      <strong
                        style={{
                          color:
                            "#fff",
                        }}
                      >
                        {teamMap.get(
                          row.fantasy_team_id
                        ) ??
                          "Entry"}
                      </strong>

                      {isViewer ? (
                        <span
                          style={{
                            marginLeft:
                              7,
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

                      {row.missing_picks > 0 ? (
                        <div style={{ marginTop: 4, color: row.is_disqualified ? "#ff7478" : "#a7a7af", fontSize: 10, fontWeight: 800 }}>
                          {row.is_disqualified ? "INCOMPLETE CARD — DISQUALIFIED" : `${row.missing_picks} MISSING PICK${row.missing_picks === 1 ? "" : "S"}`}
                        </div>
                      ) : null}
                    </div>

                    <div
                      style={{
                        textAlign:
                          "right",
                      }}
                    >
                      <strong
                        style={{
                          color:
                            "#fff",
                        }}
                      >
                        {record(
                          row
                        )}
                      </strong>

                      <div
                        style={
                          styles.meta
                        }
                      >
                        RECORD
                      </div>
                    </div>

                    <div
                      style={{
                        minWidth:
                          64,
                        textAlign:
                          "right",
                      }}
                    >
                      <strong
                        style={{
                          color:
                            "#ff9b59",
                          fontSize:
                            17,
                        }}
                      >
                        {points(
                          row.points
                        )}
                      </strong>

                      <div
                        style={
                          styles.meta
                        }
                      >
                        PTS
                      </div>
                    </div>
                  </div>
                );
              }
            )}
          </section>


          <section
            style={
              styles.card
            }
          >
            <div
              style={
                styles.sectionHead
              }
            >
              <div>
                <div
                  style={
                    styles.eyebrow
                  }
                >
                  WEEK{" "}
                  {selectedWeek?.week ??
                    "—"}
                </div>

                <h2
                  style={
                    styles.title
                  }
                >
                  Badges Earned
                </h2>
              </div>

              <div
                style={
                  styles.countBadge
                }
              >
                {
                  selectedBadges.length
                }{" "}
                AWARDS
              </div>
            </div>

            {selectedBadges.length >
            0 ? (
              <div
                style={
                  styles.badgeGrid
                }
              >
                {selectedBadges.map(
                  (
                    badge
                  ) => (
                    <article
                      key={
                        badge.id
                      }
                      style={
                        styles.badgeCard
                      }
                    >
                      <div
                        style={
                          styles.emoji
                        }
                      >
                        {badgeEmoji(
                          badge
                        )}
                      </div>

                      <div>
                        <div
                          style={{
                            color:
                              categoryColor(
                                badge.badge_category
                              ),
                            fontSize:
                              10,
                            fontWeight:
                              1000,
                            letterSpacing:
                              "0.08em",
                          }}
                        >
                          {
                            badge.badge_category
                          }
                        </div>

                        <h3
                          style={{
                            margin:
                              "4px 0",
                            color:
                              "#fff",
                            fontSize:
                              16,
                          }}
                        >
                          {
                            badge.badge_name
                          }
                        </h3>

                        <strong
                          style={{
                            color:
                              "#d0d0d6",
                            fontSize:
                              12,
                          }}
                        >
                          {teamMap.get(
                            badge.fantasy_team_id
                          ) ??
                            "Entry"}
                        </strong>

                        <p
                          style={{
                            margin:
                              "6px 0 0",
                            color:
                              "#909099",
                            fontSize:
                              12,
                            lineHeight:
                              1.45,
                          }}
                        >
                          {badgeDetail(
                            badge
                          )}
                        </p>
                      </div>
                    </article>
                  )
                )}
              </div>
            ) : (
              <EmptyState
                text="No badges were earned for this finalized week."
              />
            )}
          </section>


          <section
            style={
              styles.card
            }
          >
            <div
              style={
                styles.sectionHead
              }
            >
              <div>
                <div
                  style={
                    styles.eyebrow
                  }
                >
                  SEASON TROPHY CASE
                </div>

                <h2
                  style={
                    styles.title
                  }
                >
                  Earned Badges
                </h2>
              </div>

              <div
                style={
                  styles.countBadge
                }
              >
                {
                  badges.length
                }{" "}
                TOTAL AWARDS
              </div>
            </div>

            {trophyTeams.length >
            0 ? (
              <div
                style={
                  styles.trophyGrid
                }
              >
                {trophyTeams.map(
                  (
                    row
                  ) => {
                    const achievements =
                      row.badges.filter(
                        (
                          badge
                        ) =>
                          badge.badge_category ===
                          "ACHIEVEMENT"
                      );

                    const weekly =
                      row.badges.filter(
                        (
                          badge
                        ) =>
                          badge.badge_category ===
                          "WEEKLY"
                      );

                    const infamy =
                      row.badges.filter(
                        (
                          badge
                        ) =>
                          badge.badge_category ===
                          "INFAMY"
                      );

                    return (
                      <article
                        key={
                          row.team.id
                        }
                        style={
                          styles.trophyCard
                        }
                      >
                        <div
                          style={{
                            display:
                              "flex",
                            justifyContent:
                              "space-between",
                            gap:
                              10,
                            alignItems:
                              "center",
                            marginBottom:
                              12,
                          }}
                        >
                          <strong
                            style={{
                              color:
                                "#fff",
                              fontSize:
                                17,
                            }}
                          >
                            {
                              row.team.team_name
                            }
                          </strong>

                          <span
                            style={
                              styles.countBadge
                            }
                          >
                            {
                              row.badges.length
                            }{" "}
                            AWARDS
                          </span>
                        </div>

                        <TrophyGroup
                          title="ACHIEVEMENTS"
                          badges={
                            achievements
                          }
                        />

                        <TrophyGroup
                          title="WEEKLY"
                          badges={
                            weekly
                          }
                        />

                        <TrophyGroup
                          title="INFAMY"
                          badges={
                            infamy
                          }
                          infamy
                        />
                      </article>
                    );
                  }
                )}
              </div>
            ) : (
              <EmptyState
                text="Trophy cases will appear after permanent Pick'em badges are earned."
              />
            )}
          </section>
        </>
      )}
    </main>
  );
}


function TrophyGroup({
  title,
  badges,
  infamy = false,
}: {
  title:
    string;
  badges:
    BadgeRow[];
  infamy?:
    boolean;
}) {
  return (
    <div
      style={{
        marginTop:
          10,
      }}
    >
      <div
        style={{
          marginBottom:
            6,
          color:
            infamy
              ? "#ff7478"
              : "#ff9b59",
          fontSize:
            10,
          fontWeight:
            1000,
          letterSpacing:
            "0.09em",
        }}
      >
        {title}
      </div>

      {badges.length ===
      0 ? (
        <div
          style={{
            color:
              "#74747d",
            fontSize:
              12,
          }}
        >
          None yet.
        </div>
      ) : (
        <div
          style={{
            display:
              "grid",
            gap:
              6,
          }}
        >
          {badges.map(
            (
              badge
            ) => (
              <div
                key={
                  badge.id
                }
                style={{
                  display:
                    "grid",
                  gridTemplateColumns:
                    "28px minmax(0,1fr) auto",
                  gap:
                    8,
                  alignItems:
                    "center",
                  padding:
                    "8px 9px",
                  borderRadius:
                    9,
                  background:
                    "rgba(255,255,255,0.025)",
                }}
              >
                <span>
                  {badgeEmoji(
                    badge
                  )}
                </span>

                <span
                  style={{
                    color:
                      "#d5d5da",
                    fontSize:
                      12,
                    fontWeight:
                      800,
                  }}
                >
                  {
                    badge.badge_name
                  }
                </span>

                <span
                  style={{
                    color:
                      "#777780",
                    fontSize:
                      10,
                  }}
                >
                  W
                  {
                    badge.week
                  }
                </span>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}


function EmptyState({
  text,
}: {
  text:
    string;
}) {
  return (
    <div
      style={{
        padding:
          18,
        borderRadius:
          12,
        border:
          "1px solid rgba(255,255,255,0.06)",
        background:
          "rgba(255,255,255,0.02)",
        color:
          "#8c8c95",
        lineHeight:
          1.55,
      }}
    >
      {text}
    </div>
  );
}


const styles:
  Record<
    string,
    React.CSSProperties
  > = {
  card: {
    padding:
      18,
    borderRadius:
      16,
    border:
      "1px solid rgba(255,255,255,0.08)",
    background:
      "#101014",
  },

  sectionHead: {
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
    marginBottom:
      12,
  },

  eyebrow: {
    color:
      "#ff7627",
    fontSize:
      10,
    fontWeight:
      1000,
    letterSpacing:
      "0.10em",
  },

  title: {
    margin:
      "4px 0 0",
    color:
      "#fff",
    fontSize:
      22,
  },

  countBadge: {
    display:
      "inline-flex",
    padding:
      "5px 8px",
    borderRadius:
      999,
    border:
      "1px solid rgba(255,118,39,0.25)",
    background:
      "rgba(255,92,20,0.07)",
    color:
      "#ff9b59",
    fontSize:
      10,
    fontWeight:
      1000,
  },

  meta: {
    marginTop:
      3,
    color:
      "#777780",
    fontSize:
      9,
    fontWeight:
      900,
    letterSpacing:
      "0.06em",
  },

  badgeGrid: {
    display:
      "grid",
    gridTemplateColumns:
      "repeat(auto-fit,minmax(250px,1fr))",
    gap:
      10,
  },

  badgeCard: {
    display:
      "grid",
    gridTemplateColumns:
      "44px minmax(0,1fr)",
    gap:
      11,
    padding:
      13,
    borderRadius:
      12,
    border:
      "1px solid rgba(255,255,255,0.07)",
    background:
      "rgba(255,255,255,0.022)",
  },

  emoji: {
    display:
      "grid",
    placeItems:
      "center",
    width:
      42,
    height:
      42,
    borderRadius:
      12,
    background:
      "linear-gradient(135deg,rgba(157,17,25,0.45),rgba(242,103,34,0.22))",
    fontSize:
      23,
  },

  trophyGrid: {
    display:
      "grid",
    gridTemplateColumns:
      "repeat(auto-fit,minmax(280px,1fr))",
    gap:
      12,
  },

  trophyCard: {
    padding:
      14,
    borderRadius:
      13,
    border:
      "1px solid rgba(255,108,33,0.12)",
    background:
      "linear-gradient(145deg,rgba(90,8,12,0.16),rgba(255,255,255,0.018))",
  },
};
