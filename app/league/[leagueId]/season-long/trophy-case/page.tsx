import Link from "next/link";

import {
  createSupabaseServerClient,
} from "@/lib/supabase/server";

import {
  requireLeagueMember,
} from "@/lib/leagues/requireLeagueMember";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  params: Promise<{
    leagueId: string;
  }>;
};

type HistoryAwardRow = {
  season: number;
  league_id: string;
  franchise_id: string;
  fantasy_team_id: number;
  team_name: string;
  award_key: string;
  award_name: string;
  award_category: string;
  award_emoji: string;
  award_count: number | string;
  first_week: number | null;
  last_week: number | null;
  latest_detail: string | null;
};

type HistorySummaryRow = {
  history_id: string;
  first_season: number | null;
  latest_season: number | null;
  season_count: number | string;
  total_badges: number | string;
  total_season_honors: number | string;
};

type TeamRow = {
  id: number;
  team_name: string;
  season_long_franchise_id: string | null;
};

type CareerAward = {
  key: string;
  name: string;
  emoji: string;
  category: string;
  count: number;
  seasons: number[];
  detail: string | null;
};

type FranchiseHistory = {
  franchiseId: string;
  teamName: string;
  totalAwards: number;
  championships: number;
  careerAwards: CareerAward[];
  seasonAwards: Map<number, HistoryAwardRow[]>;
};

function n(
  value:
    number |
    string |
    null |
    undefined
) {
  const parsed =
    Number(
      value ??
      0
    );

  return Number.isFinite(
    parsed
  )
    ? parsed
    : 0;
}

function categoryOrder(
  category:
    string
) {
  if (
    category ===
    "SEASON"
  ) {
    return 0;
  }

  if (
    category ===
    "ACHIEVEMENT"
  ) {
    return 1;
  }

  return 2;
}

export default async function SeasonLongTrophyCasePage({
  params,
}: PageProps) {
  const {
    leagueId,
  } =
    await params;

  const access =
    await requireLeagueMember(
      leagueId
    );

  if (
    access.league.leagueType !==
    "season_long"
  ) {
    throw new Error(
      "The Trophy Case is only available for Season-Long leagues."
    );
  }

  const supabase =
    await createSupabaseServerClient();

  const [
    historyResult,
    summaryResult,
    currentTeamsResult,
  ] =
    await Promise.all([
      supabase.rpc(
        "get_season_long_history_trophy_case",
        {
          p_league_id:
            leagueId,
        }
      ),

      supabase.rpc(
        "get_season_long_history_summary",
        {
          p_league_id:
            leagueId,
        }
      ),

      supabase
        .from(
          "fantasy_teams"
        )
        .select(
          "id,team_name,season_long_franchise_id"
        )
        .eq(
          "league_id",
          leagueId
        )
        .eq(
          "active",
          true
        ),
    ]);

  if (
    historyResult.error
  ) {
    throw new Error(
      `Could not load continuous Trophy Case: ${historyResult.error.message}`
    );
  }

  if (
    summaryResult.error
  ) {
    throw new Error(
      `Could not load league history summary: ${summaryResult.error.message}`
    );
  }

  if (
    currentTeamsResult.error
  ) {
    throw new Error(
      `Could not load current teams: ${currentTeamsResult.error.message}`
    );
  }

  const awards =
    (
      historyResult.data ??
      []
    ) as HistoryAwardRow[];

  const summary =
    (
      summaryResult.data ??
      []
    )[0] as
      | HistorySummaryRow
      | undefined;

  const currentTeams =
    (
      currentTeamsResult.data ??
      []
    ) as TeamRow[];

  const currentNameByFranchise =
    new Map<
      string,
      string
    >();

  for (
    const team
    of currentTeams
  ) {
    if (
      team.season_long_franchise_id
    ) {
      currentNameByFranchise.set(
        team.season_long_franchise_id,
        team.team_name
      );
    }
  }

  const franchises =
    new Map<
      string,
      FranchiseHistory
    >();

  for (
    const row
    of awards
  ) {
    const franchiseId =
      row.franchise_id;

    if (
      !franchiseId
    ) {
      continue;
    }

    const existing =
      franchises.get(
        franchiseId
      );

    const team =
      existing ??
      {
        franchiseId,
        teamName:
          currentNameByFranchise.get(
            franchiseId
          ) ??
          row.team_name,
        totalAwards:
          0,
        championships:
          0,
        careerAwards:
          [],
        seasonAwards:
          new Map<
            number,
            HistoryAwardRow[]
          >(),
      };

    const count =
      n(
        row.award_count
      );

    team.totalAwards +=
      count;

    if (
      row.award_key ===
      "season_champion"
    ) {
      team.championships +=
        count;
    }

    const seasonRows =
      team.seasonAwards.get(
        row.season
      ) ??
      [];

    seasonRows.push(
      row
    );

    team.seasonAwards.set(
      row.season,
      seasonRows
    );

    const career =
      team.careerAwards.find(
        (
          item
        ) =>
          item.key ===
            row.award_key &&
          item.category ===
            row.award_category
      );

    if (
      career
    ) {
      career.count +=
        count;

      if (
        !career.seasons.includes(
          row.season
        )
      ) {
        career.seasons.push(
          row.season
        );
      }

      if (
        row.latest_detail
      ) {
        career.detail =
          row.latest_detail;
      }
    } else {
      team.careerAwards.push({
        key:
          row.award_key,
        name:
          row.award_name,
        emoji:
          row.award_emoji,
        category:
          row.award_category,
        count,
        seasons: [
          row.season,
        ],
        detail:
          row.latest_detail,
      });
    }

    franchises.set(
      franchiseId,
      team
    );
  }

  // Current teams should still have a Trophy Case card before they
  // have earned their first award.
  for (
    const team
    of currentTeams
  ) {
    const franchiseId =
      team.season_long_franchise_id;

    if (
      !franchiseId ||
      franchises.has(
        franchiseId
      )
    ) {
      continue;
    }

    franchises.set(
      franchiseId,
      {
        franchiseId,
        teamName:
          team.team_name,
        totalAwards:
          0,
        championships:
          0,
        careerAwards:
          [],
        seasonAwards:
          new Map(),
      }
    );
  }

  const franchiseList =
    Array.from(
      franchises.values()
    ).sort(
      (
        a,
        b
      ) =>
        b.championships -
          a.championships ||
        b.totalAwards -
          a.totalAwards ||
        a.teamName.localeCompare(
          b.teamName
        )
    );

  for (
    const team
    of franchiseList
  ) {
    team.careerAwards.sort(
      (
        a,
        b
      ) =>
        categoryOrder(
          a.category
        ) -
          categoryOrder(
            b.category
          ) ||
        b.count -
          a.count ||
        a.name.localeCompare(
          b.name
        )
    );

    for (
      const [
        season,
        rows,
      ]
      of team.seasonAwards
    ) {
      rows.sort(
        (
          a,
          b
        ) =>
          categoryOrder(
            a.award_category
          ) -
            categoryOrder(
              b.award_category
            ) ||
          a.award_name.localeCompare(
            b.award_name
          )
      );

      team.seasonAwards.set(
        season,
        rows
      );
    }
  }

  const firstSeason =
    summary?.first_season ??
    access.league.season;

  const latestSeason =
    summary?.latest_season ??
    access.league.season;

  return (
    <main
      style={
        styles.page
      }
    >
      <section
        style={
          styles.shell
        }
      >
        <header
          style={
            styles.hero
          }
        >
          <div>
            <p
              style={
                styles.eyebrow
              }
            >
              G365 • CONTINUOUS LEAGUE HISTORY
            </p>

            <h1
              style={
                styles.title
              }
            >
              Trophy Case
            </h1>

            <p
              style={
                styles.subtitle
              }
            >
              {access.league.name}
              {" • "}
              {firstSeason ===
              latestSeason
                ? `${latestSeason} Season`
                : `${firstSeason}–${latestSeason}`}
            </p>
          </div>

          <div
            style={
              styles.heroActions
            }
          >
            <Link
              href={`/league/${leagueId}/season-long/recap`}
              style={
                styles.button
              }
            >
              RECAP
            </Link>

            <Link
              href={`/league/${leagueId}`}
              style={
                styles.button
              }
            >
              LEAGUE HOME
            </Link>
          </div>
        </header>

        <section
          style={
            styles.summaryGrid
          }
        >
          <SummaryCard
            label="SEASONS"
            value={String(
              n(
                summary
                  ?.season_count
              )
            )}
            detail={`${firstSeason}–${latestSeason}`}
          />

          <SummaryCard
            label="WEEKLY BADGES"
            value={String(
              n(
                summary
                  ?.total_badges
              )
            )}
            detail="Preserved across renewals"
          />

          <SummaryCard
            label="SEASON HONORS"
            value={String(
              n(
                summary
                  ?.total_season_honors
              )
            )}
            detail="Champions, podiums & records"
          />

          <SummaryCard
            label="FRANCHISES"
            value={String(
              franchiseList.length
            )}
            detail="Continuous team identities"
          />
        </section>

        <section
          style={
            styles.infoCard
          }
        >
          <strong>
            ONE LEAGUE • EVERY SEASON
          </strong>

          <span>
            Renewing the league starts fresh weekly lineups, scores and standings,
            while this Trophy Case keeps the history attached to each franchise.
            Awards are never copied into the new season; they remain tied to the
            season in which they were earned.
          </span>
        </section>

        {franchiseList.length >
        0 ? (
          <div
            style={
              styles.teamGrid
            }
          >
            {franchiseList.map(
              (
                team,
                index
              ) => {
                const seasons =
                  Array.from(
                    team.seasonAwards.keys()
                  ).sort(
                    (
                      a,
                      b
                    ) =>
                      b -
                      a
                  );

                return (
                  <article
                    key={
                      team.franchiseId
                    }
                    style={
                      styles.teamCard
                    }
                  >
                    <div
                      style={
                        styles.teamHeader
                      }
                    >
                      <div>
                        <span
                          style={
                            styles.teamRank
                          }
                        >
                          HISTORY #{index +
                            1}
                        </span>

                        <h2
                          style={
                            styles.teamName
                          }
                        >
                          {
                            team.teamName
                          }
                        </h2>
                      </div>

                      <div
                        style={
                          styles.teamTotals
                        }
                      >
                        <strong>
                          {team.championships} 🏆
                        </strong>

                        <span>
                          {team.totalAwards} total awards
                        </span>
                      </div>
                    </div>

                    <div
                      style={
                        styles.sectionLabel
                      }
                    >
                      CAREER TROPHY SHELF
                    </div>

                    {team
                      .careerAwards
                      .length >
                    0 ? (
                      <div
                        style={
                          styles.awardGrid
                        }
                      >
                        {team.careerAwards.map(
                          (
                            award
                          ) => (
                            <div
                              key={`${award.category}:${award.key}`}
                              style={{
                                ...styles.awardCard,
                                ...(award.category ===
                                "INFAMY"
                                  ? styles.infamyCard
                                  : {}),
                                ...(award.category ===
                                "SEASON"
                                  ? styles.seasonCard
                                  : {}),
                              }}
                            >
                              <span
                                style={
                                  styles.awardEmoji
                                }
                              >
                                {
                                  award.emoji
                                }
                              </span>

                              <div
                                style={
                                  styles.awardText
                                }
                              >
                                <strong>
                                  {
                                    award.name
                                  }
                                </strong>

                                <span>
                                  ×
                                  {
                                    award.count
                                  }
                                  {" • "}
                                  {
                                    [...award.seasons]
                                      .sort(
                                        (
                                          a,
                                          b
                                        ) =>
                                          b -
                                          a
                                      )
                                      .join(
                                        ", "
                                      )
                                  }
                                </span>
                              </div>
                            </div>
                          )
                        )}
                      </div>
                    ) : (
                      <div
                        style={
                          styles.empty
                        }
                      >
                        No awards earned yet.
                      </div>
                    )}

                    {seasons.length >
                    0 ? (
                      <div
                        style={
                          styles.seasonHistory
                        }
                      >
                        <div
                          style={
                            styles.sectionLabel
                          }
                        >
                          SEASON-BY-SEASON
                        </div>

                        {seasons.map(
                          (
                            season
                          ) => {
                            const rows =
                              team.seasonAwards.get(
                                season
                              ) ??
                              [];

                            return (
                              <div
                                key={
                                  season
                                }
                                style={
                                  styles.seasonRow
                                }
                              >
                                <strong
                                  style={
                                    styles.seasonYear
                                  }
                                >
                                  {
                                    season
                                  }
                                </strong>

                                <div
                                  style={
                                    styles.seasonAwards
                                  }
                                >
                                  {rows.map(
                                    (
                                      row
                                    ) => (
                                      <span
                                        key={`${row.award_category}:${row.award_key}:${row.season}`}
                                        title={
                                          row.latest_detail ??
                                          undefined
                                        }
                                        style={{
                                          ...styles.seasonPill,
                                          ...(row.award_category ===
                                          "INFAMY"
                                            ? styles.infamyPill
                                            : {}),
                                          ...(row.award_category ===
                                          "SEASON"
                                            ? styles.seasonHonorPill
                                            : {}),
                                        }}
                                      >
                                        {row.award_emoji}
                                        {" "}
                                        {row.award_name}
                                        {n(
                                          row.award_count
                                        ) >
                                        1
                                          ? ` ×${n(row.award_count)}`
                                          : ""}
                                      </span>
                                    )
                                  )}
                                </div>
                              </div>
                            );
                          }
                        )}
                      </div>
                    ) : null}
                  </article>
                );
              }
            )}
          </div>
        ) : (
          <div
            style={
              styles.empty
            }
          >
            Trophy history will appear after the league earns its first finalized
            Season-Long badge or season honor.
          </div>
        )}
      </section>
    </main>
  );
}

function SummaryCard({
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
      style={
        styles.summaryCard
      }
    >
      <span
        style={
          styles.summaryLabel
        }
      >
        {
          label
        }
      </span>

      <strong
        style={
          styles.summaryValue
        }
      >
        {
          value
        }
      </strong>

      <span
        style={
          styles.summaryDetail
        }
      >
        {
          detail
        }
      </span>
    </div>
  );
}

const styles = {
  page: {
    minHeight:
      "calc(100vh - 90px)",
    padding:
      "20px 16px 42px",
    background:
      "#0b0c0e",
    color:
      "#fff",
  },

  shell: {
    width:
      "min(1480px,100%)",
    margin:
      "0 auto",
    display:
      "grid",
    gap:
      "16px",
  },

  hero: {
    display:
      "flex",
    alignItems:
      "flex-end",
    justifyContent:
      "space-between",
    gap:
      "18px",
    flexWrap:
      "wrap" as const,
    padding:
      "20px",
    border:
      "1px solid rgba(255,105,25,.18)",
    borderRadius:
      "12px",
    background:
      "linear-gradient(135deg,rgba(116,8,10,.42),rgba(255,86,18,.12) 55%,rgba(15,16,18,.96))",
  },

  eyebrow: {
    margin:
      0,
    color:
      "#ff7a1a",
    fontSize:
      "12px",
    fontWeight:
      950,
    letterSpacing:
      ".13em",
  },

  title: {
    margin:
      "5px 0 0",
    fontSize:
      "36px",
    lineHeight:
      1,
  },

  subtitle: {
    margin:
      "8px 0 0",
    color:
      "#a0a5ad",
    fontSize:
      "15px",
  },

  heroActions: {
    display:
      "flex",
    gap:
      "8px",
    flexWrap:
      "wrap" as const,
  },

  button: {
    minHeight:
      "38px",
    display:
      "inline-flex",
    alignItems:
      "center",
    justifyContent:
      "center",
    padding:
      "0 14px",
    border:
      "1px solid rgba(255,120,30,.3)",
    borderRadius:
      "7px",
    background:
      "rgba(255,95,20,.07)",
    color:
      "#ff9a45",
    fontSize:
      "12px",
    fontWeight:
      950,
    textDecoration:
      "none",
  },

  summaryGrid: {
    display:
      "grid",
    gridTemplateColumns:
      "repeat(auto-fit,minmax(180px,1fr))",
    gap:
      "10px",
  },

  summaryCard: {
    padding:
      "14px 16px",
    display:
      "grid",
    gap:
      "3px",
    border:
      "1px solid rgba(255,255,255,.08)",
    borderRadius:
      "10px",
    background:
      "linear-gradient(180deg,#151719,#101113)",
  },

  summaryLabel: {
    color:
      "#7d838c",
    fontSize:
      "11px",
    fontWeight:
      950,
    letterSpacing:
      ".08em",
  },

  summaryValue: {
    color:
      "#fff",
    fontSize:
      "25px",
  },

  summaryDetail: {
    color:
      "#8a9199",
    fontSize:
      "12px",
  },

  infoCard: {
    padding:
      "13px 15px",
    display:
      "grid",
    gap:
      "5px",
    border:
      "1px solid rgba(255,112,20,.14)",
    borderRadius:
      "9px",
    background:
      "rgba(255,90,15,.035)",
    color:
      "#9da3ab",
    fontSize:
      "13px",
    lineHeight:
      1.5,
  },

  teamGrid: {
    display:
      "grid",
    gap:
      "14px",
  },

  teamCard: {
    padding:
      "17px",
    display:
      "grid",
    gap:
      "14px",
    border:
      "1px solid rgba(255,255,255,.09)",
    borderRadius:
      "11px",
    background:
      "linear-gradient(180deg,#151719,#0e0f11)",
  },

  teamHeader: {
    display:
      "flex",
    justifyContent:
      "space-between",
    alignItems:
      "center",
    gap:
      "14px",
    flexWrap:
      "wrap" as const,
  },

  teamRank: {
    color:
      "#ff7e20",
    fontSize:
      "10px",
    fontWeight:
      950,
    letterSpacing:
      ".1em",
  },

  teamName: {
    margin:
      "4px 0 0",
    fontSize:
      "23px",
  },

  teamTotals: {
    display:
      "grid",
    justifyItems:
      "end",
    gap:
      "2px",
    color:
      "#8e959e",
    fontSize:
      "12px",
  },

  sectionLabel: {
    color:
      "#777e87",
    fontSize:
      "11px",
    fontWeight:
      950,
    letterSpacing:
      ".1em",
  },

  awardGrid: {
    display:
      "grid",
    gridTemplateColumns:
      "repeat(auto-fit,minmax(190px,1fr))",
    gap:
      "8px",
  },

  awardCard: {
    minHeight:
      "64px",
    padding:
      "10px",
    display:
      "flex",
    alignItems:
      "center",
    gap:
      "10px",
    border:
      "1px solid rgba(255,130,35,.16)",
    borderRadius:
      "8px",
    background:
      "rgba(255,104,20,.035)",
  },

  seasonCard: {
    border:
      "1px solid rgba(255,190,60,.25)",
    background:
      "linear-gradient(135deg,rgba(255,155,20,.10),rgba(110,10,8,.16))",
  },

  infamyCard: {
    border:
      "1px solid rgba(110,135,165,.18)",
    background:
      "rgba(90,110,135,.04)",
  },

  awardEmoji: {
    fontSize:
      "26px",
  },

  awardText: {
    minWidth:
      0,
    display:
      "grid",
    gap:
      "2px",
    color:
      "#e9eaec",
    fontSize:
      "13px",
  },

  seasonHistory: {
    display:
      "grid",
    gap:
      "8px",
  },

  seasonRow: {
    display:
      "grid",
    gridTemplateColumns:
      "70px minmax(0,1fr)",
    alignItems:
      "start",
    gap:
      "10px",
    padding:
      "9px 0",
    borderTop:
      "1px solid rgba(255,255,255,.055)",
  },

  seasonYear: {
    color:
      "#ff8b2a",
    fontSize:
      "16px",
  },

  seasonAwards: {
    display:
      "flex",
    gap:
      "6px",
    flexWrap:
      "wrap" as const,
  },

  seasonPill: {
    padding:
      "5px 8px",
    border:
      "1px solid rgba(255,120,25,.15)",
    borderRadius:
      "999px",
    background:
      "rgba(255,105,20,.04)",
    color:
      "#c9cdd2",
    fontSize:
      "11px",
    fontWeight:
      850,
  },

  seasonHonorPill: {
    border:
      "1px solid rgba(255,190,60,.25)",
    color:
      "#ffd38a",
  },

  infamyPill: {
    border:
      "1px solid rgba(130,150,175,.16)",
    color:
      "#9caaba",
  },

  empty: {
    padding:
      "22px",
    border:
      "1px dashed rgba(255,255,255,.08)",
    borderRadius:
      "9px",
    color:
      "#737b84",
    textAlign:
      "center" as const,
    fontSize:
      "13px",
  },
} as const;
