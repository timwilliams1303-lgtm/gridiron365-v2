import Link from "next/link";

import {
  requireLeagueMember,
} from "@/lib/leagues/requireLeagueMember";

import {
  createSupabaseServerClient,
} from "@/lib/supabase/server";

import G365MarchMadnessBracket from "@/components/playoffs/G365MarchMadnessBracket";


type PageProps = {
  params:
    Promise<{
      leagueId: string;
    }>;
};


type SettingsRow = {
  competition_format:
    | "total_points"
    | "head_to_head"
    | null;

  regular_season_weeks:
    number |
    null;

  playoffs_enabled:
    boolean |
    null;

  playoff_team_count:
    number |
    null;

  reseed_playoffs:
    boolean |
    null;
};


type TeamRow = {
  id: number;
  team_name: string;
};


type StandingRow = {
  fantasy_team_id: number;
  wins: number | null;
  losses: number | null;
  ties: number | null;
  points_for:
    number |
    string |
    null;
  points_against:
    number |
    string |
    null;
  current_rank:
    number |
    null;
};


type SeedRow = {
  fantasy_team_id: number;
  seed: number;
  wins: number;
  losses: number;
  ties: number;
  points_for:
    number |
    string |
    null;
};


type PlayoffStateRow = {
  status:
    | "not_started"
    | "active"
    | "complete";
  playoff_team_count: number;
  bracket_size: number;
  round_count: number;
  current_round: number;
  playoff_start_week: number;
  champion_fantasy_team_id:
    number |
    null;
};


type MatchupRow = {
  id: number;
  week: number;
  home_fantasy_team_id: number;
  away_fantasy_team_id:
    number |
    null;
  home_points:
    number |
    string |
    null;
  away_points:
    number |
    string |
    null;
  home_score_final:
    boolean |
    null;
  away_score_final:
    boolean |
    null;
  is_final:
    boolean |
    null;
  winner_fantasy_team_id:
    number |
    null;
  is_tie:
    boolean |
    null;
  playoff_round:
    number |
    null;
  playoff_slot:
    number |
    null;
  home_seed:
    number |
    null;
  away_seed:
    number |
    null;
  resolved_by_commissioner:
    boolean |
    null;
};


function numberValue(
  value:
    | number
    | string
    | null
    | undefined
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


function score(
  value:
    | number
    | string
    | null
    | undefined
) {
  return numberValue(
    value
  ).toFixed(
    2
  );
}


function roundLabel(
  round:
    number,
  roundCount:
    number
) {
  if (
    round ===
    roundCount
  ) {
    return "Championship";
  }

  if (
    round ===
    roundCount - 1
  ) {
    return "Semifinals";
  }

  if (
    round === 1
  ) {
    return "Opening Round";
  }

  return `Round ${round}`;
}


export default async function SeasonLongPlayoffsPage({
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
      "This page is only available for Season-Long leagues."
    );
  }

  const supabase =
    await createSupabaseServerClient();

  const season =
    access.league.season;

  const [
    settingsResult,
    teamsResult,
    standingsResult,
    stateResult,
    seedsResult,
    matchupsResult,
  ] =
    await Promise.all([
      supabase
        .from(
          "season_long_settings"
        )
        .select(`
          competition_format,
          regular_season_weeks,
          playoffs_enabled,
          playoff_team_count,
          reseed_playoffs
        `)
        .eq(
          "league_id",
          leagueId
        )
        .maybeSingle(),

      supabase
        .from(
          "fantasy_teams"
        )
        .select(
          "id, team_name"
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
          "season_long_h2h_standings"
        )
        .select(`
          fantasy_team_id,
          wins,
          losses,
          ties,
          points_for,
          points_against,
          current_rank
        `)
        .eq(
          "league_id",
          leagueId
        )
        .eq(
          "season",
          season
        )
        .order(
          "current_rank",
          {
            ascending: true,
          }
        ),

      supabase
        .from(
          "season_long_playoff_state"
        )
        .select(`
          status,
          playoff_team_count,
          bracket_size,
          round_count,
          current_round,
          playoff_start_week,
          champion_fantasy_team_id
        `)
        .eq(
          "league_id",
          leagueId
        )
        .eq(
          "season",
          season
        )
        .maybeSingle(),

      supabase
        .from(
          "season_long_playoff_seeds"
        )
        .select(`
          fantasy_team_id,
          seed,
          wins,
          losses,
          ties,
          points_for
        `)
        .eq(
          "league_id",
          leagueId
        )
        .eq(
          "season",
          season
        )
        .order(
          "seed",
          {
            ascending: true,
          }
        ),

      supabase
        .from(
          "season_long_matchups"
        )
        .select(`
          id,
          week,
          home_fantasy_team_id,
          away_fantasy_team_id,
          home_points,
          away_points,
          home_score_final,
          away_score_final,
          is_final,
          winner_fantasy_team_id,
          is_tie,
          playoff_round,
          playoff_slot,
          home_seed,
          away_seed,
          resolved_by_commissioner
        `)
        .eq(
          "league_id",
          leagueId
        )
        .eq(
          "season",
          season
        )
        .eq(
          "matchup_type",
          "playoff"
        )
        .order(
          "playoff_round",
          {
            ascending: true,
          }
        )
        .order(
          "playoff_slot",
          {
            ascending: true,
          }
        ),
    ]);

  const failed =
    [
      settingsResult,
      teamsResult,
      standingsResult,
      stateResult,
      seedsResult,
      matchupsResult,
    ].find(
      (
        result
      ) =>
        result.error
    );

  if (
    failed?.error
  ) {
    throw new Error(
      `Could not load Season-Long playoffs: ${failed.error.message}`
    );
  }

  const settings =
    settingsResult.data as
      SettingsRow |
      null;

  if (
    settings?.competition_format !==
      "head_to_head" ||
    !settings.playoffs_enabled
  ) {
    return (
      <main
        style={
          styles.page
        }
      >
        <section
          style={
            styles.empty
          }
        >
          <div
            style={
              styles.eyebrow
            }
          >
            SEASON-LONG
          </div>

          <h1
            style={
              styles.title
            }
          >
            Playoffs
          </h1>

          <p
            style={
              styles.subtitle
            }
          >
            This league is not currently configured for Head-to-Head playoffs.
          </p>

          <Link
            href={`/league/${leagueId}/standings`}
            style={
              styles.button
            }
          >
            VIEW STANDINGS
          </Link>
        </section>
      </main>
    );
  }

  const teams =
    (
      teamsResult.data ??
      []
    ) as TeamRow[];

  const standings =
    (
      standingsResult.data ??
      []
    ) as StandingRow[];

  const state =
    stateResult.data as
      PlayoffStateRow |
      null;

  const seeds =
    (
      seedsResult.data ??
      []
    ) as SeedRow[];

  const matchups =
    (
      matchupsResult.data ??
      []
    ) as MatchupRow[];

  const teamMap =
    new Map(
      teams.map(
        (
          team
        ) => [
          team.id,
          team.team_name,
        ]
      )
    );

  const playoffTeamCount =
    Math.max(
      2,
      Number(
        settings.playoff_team_count ??
        6
      )
    );

  const projectedSeeds =
    standings
      .filter(
        (
          standing
        ) =>
          standing.current_rank !==
          null
      )
      .slice(
        0,
        playoffTeamCount
      );

  const roundCount =
    state?.round_count ??
    (
      playoffTeamCount <= 2
        ? 1
        : playoffTeamCount <= 4
          ? 2
          : playoffTeamCount <= 8
            ? 3
            : 4
    );

  const championName =
    state
      ?.champion_fantasy_team_id
      ? teamMap.get(
          state.champion_fantasy_team_id
        ) ??
        "Champion"
      : null;

  const standingsMap =
    new Map(
      standings.map(
        (
          standing
        ) => [
          standing.fantasy_team_id,
          standing,
        ]
      )
    );

  const bracketSeededTeams =
    (
      seeds.length > 0
        ? seeds.map(
            (
              seed
            ) => ({
              id:
                seed.fantasy_team_id,
              seed:
                seed.seed,
              name:
                teamMap.get(
                  seed.fantasy_team_id
                ) ??
                `Team ${seed.fantasy_team_id}`,
              record:
                `${seed.wins}-${seed.losses}-${seed.ties}`,
            })
          )
        : projectedSeeds.map(
            (
              standing,
              index
            ) => ({
              id:
                standing.fantasy_team_id,
              seed:
                index + 1,
              name:
                teamMap.get(
                  standing.fantasy_team_id
                ) ??
                `Team ${standing.fantasy_team_id}`,
              record:
                `${standing.wins ?? 0}-${standing.losses ?? 0}-${standing.ties ?? 0}`,
            })
          )
    );

  const bracketMatchups =
    matchups.map(
      (
        matchup
      ) => {
        const homeStanding =
          standingsMap.get(
            matchup.home_fantasy_team_id
          );

        const awayStanding =
          matchup.away_fantasy_team_id
            ? standingsMap.get(
                matchup.away_fantasy_team_id
              )
            : null;

        const homeId =
          matchup.home_fantasy_team_id;

        const awayId =
          matchup.away_fantasy_team_id;

        return {
          id:
            matchup.id,
          round:
            matchup.playoff_round ??
            1,
          slot:
            matchup.playoff_slot ??
            1,
          week:
            matchup.week,
          home: {
            id:
              homeId,
            seed:
              matchup.home_seed,
            name:
              teamMap.get(
                homeId
              ) ??
              `Team ${homeId}`,
            record:
              homeStanding
                ? `${homeStanding.wins ?? 0}-${homeStanding.losses ?? 0}-${homeStanding.ties ?? 0}`
                : null,
            score:
              numberValue(
                matchup.home_points
              ),
            isWinner:
              matchup.winner_fantasy_team_id ===
              homeId,
          },
          away:
            awayId
              ? {
                  id:
                    awayId,
                  seed:
                    matchup.away_seed,
                  name:
                    teamMap.get(
                      awayId
                    ) ??
                    `Team ${awayId}`,
                  record:
                    awayStanding
                      ? `${awayStanding.wins ?? 0}-${awayStanding.losses ?? 0}-${awayStanding.ties ?? 0}`
                      : null,
                  score:
                    numberValue(
                      matchup.away_points
                    ),
                  isWinner:
                    matchup.winner_fantasy_team_id ===
                    awayId,
                }
              : null,
          status:
            matchup.is_final
              ? "FINAL"
              : matchup.home_score_final ||
                  matchup.away_score_final
                ? "IN PROGRESS"
                : "SCHEDULED",
          isFinal:
            Boolean(
              matchup.is_final
            ),
          isTie:
            Boolean(
              matchup.is_tie
            ),
          href:
            awayId
              ? `/league/${leagueId}/season-long/matchups/${matchup.id}`
              : null,
        };
      }
    );

  return (
    <main
      className="g365-sl-playoffs"
      style={
        styles.page
      }
    >
      <style>{`
        .g365-sl-playoffs,
        .g365-sl-playoffs * {
          box-sizing: border-box;
        }

        @media (max-width: 760px) {
          .g365-sl-playoffs {
            padding: 12px 10px !important;
          }

          .g365-sl-playoffs .playoff-summary {
            grid-template-columns: repeat(2,minmax(0,1fr)) !important;
          }

          .g365-sl-playoffs .seed-grid {
            grid-template-columns: minmax(0,1fr) !important;
          }

          .g365-sl-playoffs .bracket-scroll {
            margin-left: -2px;
            margin-right: -2px;
          }
        }

        @media (max-width: 430px) {
          .g365-sl-playoffs .playoff-summary {
            grid-template-columns: minmax(0,1fr) !important;
          }
        }
      `}</style>

      <div
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
            <div
              style={
                styles.eyebrow
              }
            >
              SEASON-LONG • HEAD-TO-HEAD
            </div>

            <h1
              style={
                styles.title
              }
            >
              Playoffs
            </h1>

            <p
              style={
                styles.subtitle
              }
            >
              {access.league.name}
              {" • "}
              {season}
            </p>
          </div>

          <Link
            href={`/league/${leagueId}/standings`}
            style={
              styles.button
            }
          >
            VIEW STANDINGS
          </Link>
        </header>

        {championName ? (
          <section
            style={
              styles.champion
            }
          >
            <span
              style={
                styles.championLabel
              }
            >
              G365 SEASON CHAMPION
            </span>

            <strong
              style={
                styles.championName
              }
            >
              🏆 {championName}
            </strong>
          </section>
        ) : null}

        <section
          style={
            styles.section
          }
        >
          <div
            className="playoff-summary"
            style={
              styles.summary
            }
          >
            <Stat
              label="Status"
              value={
                state?.status ===
                "complete"
                  ? "Complete"
                  : state?.status ===
                    "active"
                    ? "Active"
                    : "Projected"
              }
            />

            <Stat
              label="Playoff Teams"
              value={
                state
                  ?.playoff_team_count ??
                playoffTeamCount
              }
            />

            <Stat
              label="Format"
              value={
                settings.reseed_playoffs
                  ? "Reseed"
                  : "Fixed Bracket"
              }
            />

            <Stat
              label="Playoff Start"
              value={`Week ${
                state
                  ?.playoff_start_week ??
                (
                  Number(
                    settings.regular_season_weeks ??
                    14
                  ) +
                  1
                )
              }`}
            />

            <Stat
              label="Rounds"
              value={
                roundCount
              }
            />

            <Stat
              label="Current Round"
              value={
                state
                  ? roundLabel(
                      state.current_round,
                      roundCount
                    )
                  : "Not Started"
              }
            />
          </div>
        </section>

        <section
          style={
            styles.section
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
                  styles.sectionEyebrow
                }
              >
                {seeds.length > 0
                  ? "OFFICIAL SEEDS"
                  : "PROJECTED SEEDS"}
              </div>

              <h2
                style={
                  styles.sectionTitle
                }
              >
                Playoff Field
              </h2>
            </div>

            <span
              style={
                styles.sectionMeta
              }
            >
              {seeds.length > 0
                ? "Locked from final regular-season standings"
                : `Top ${playoffTeamCount} based on current H2H standings`}
            </span>
          </div>

          <div
            className="seed-grid"
            style={
              styles.seedGrid
            }
          >
            {seeds.length > 0
              ? seeds.map(
                  (
                    seed
                  ) => (
                    <SeedCard
                      key={
                        seed.seed
                      }
                      seed={
                        seed.seed
                      }
                      teamName={
                        teamMap.get(
                          seed.fantasy_team_id
                        ) ??
                        `Team ${seed.fantasy_team_id}`
                      }
                      record={`${seed.wins}-${seed.losses}-${seed.ties}`}
                      pointsFor={
                        numberValue(
                          seed.points_for
                        )
                      }
                    />
                  )
                )
              : projectedSeeds.map(
                  (
                    standing,
                    index
                  ) => (
                    <SeedCard
                      key={
                        standing.fantasy_team_id
                      }
                      seed={
                        index + 1
                      }
                      teamName={
                        teamMap.get(
                          standing.fantasy_team_id
                        ) ??
                        `Team ${standing.fantasy_team_id}`
                      }
                      record={`${standing.wins ?? 0}-${standing.losses ?? 0}-${standing.ties ?? 0}`}
                      pointsFor={
                        numberValue(
                          standing.points_for
                        )
                      }
                    />
                  )
                )}
          </div>

          {seeds.length === 0 &&
          projectedSeeds.length === 0 ? (
            <div
              style={
                styles.notice
              }
            >
              Official playoff seeds will appear after finalized Head-to-Head regular-season standings are available.
            </div>
          ) : null}
        </section>

        <G365MarchMadnessBracket
          leagueName={
            access.league.name
          }
          season={
            season
          }
          playoffTeamCount={
            playoffTeamCount
          }
          playoffStartWeek={
            state
              ?.playoff_start_week ??
            (
              Number(
                settings.regular_season_weeks ??
                14
              ) +
              1
            )
          }
          seededTeams={
            bracketSeededTeams
          }
          matchups={
            bracketMatchups
          }
          championName={
            championName
          }
          statusLabel={
            state?.status ===
            "complete"
              ? "COMPLETE"
              : state?.status ===
                "active"
                ? "LIVE PLAYOFFS"
                : "PROJECTED BRACKET"
          }
        />

        {matchups.some(
          (
            matchup
          ) =>
            matchup.is_final &&
            matchup.is_tie &&
            !matchup.resolved_by_commissioner
        ) ? (
          <section
            style={
              styles.tieWarning
            }
          >
            <strong>
              PLAYOFF TIE REQUIRES COMMISSIONER RESOLUTION
            </strong>

            <span>
              A finalized playoff matchup is tied. Automatic bracket advancement will remain stopped until the commissioner selects the advancing team.
            </span>
          </section>
        ) : null}
      </div>
    </main>
  );
}


function Stat({
  label,
  value,
}: {
  label: string;
  value:
    string |
    number;
}) {
  return (
    <div
      style={
        styles.stat
      }
    >
      <span>
        {label}
      </span>

      <strong>
        {value}
      </strong>
    </div>
  );
}


function SeedCard({
  seed,
  teamName,
  record,
  pointsFor,
}: {
  seed: number;
  teamName: string;
  record: string;
  pointsFor: number;
}) {
  return (
    <div
      style={
        styles.seedCard
      }
    >
      <span
        style={
          styles.seedNumber
        }
      >
        #{seed}
      </span>

      <div
        style={
          styles.seedInfo
        }
      >
        <strong>
          {teamName}
        </strong>

        <span>
          {record}
          {" • "}
          {pointsFor.toFixed(
            2
          )} PF
        </span>
      </div>
    </div>
  );
}


function MatchupCard({
  matchup,
  teamMap,
}: {
  matchup:
    MatchupRow;
  teamMap:
    Map<
      number,
      string
    >;
}) {
  const homeWinner =
    Boolean(
      matchup.is_final &&
      matchup.winner_fantasy_team_id ===
        matchup.home_fantasy_team_id
    );

  const awayWinner =
    Boolean(
      matchup.is_final &&
      matchup.winner_fantasy_team_id ===
        matchup.away_fantasy_team_id
    );

  const tied =
    Boolean(
      matchup.is_final &&
      matchup.is_tie
    );

  return (
    <article
      style={{
        ...styles.matchup,
        ...(tied
          ? styles.matchupTie
          : {}),
      }}
    >
      <div
        style={
          styles.matchupTop
        }
      >
        <span>
          Week {matchup.week}
        </span>

        <strong>
          {matchup.is_final
            ? tied
              ? "TIE"
              : "FINAL"
            : matchup.home_score_final ||
              matchup.away_score_final
              ? "SCORING"
              : "UPCOMING"}
        </strong>
      </div>

      <TeamScore
        seed={
          matchup.home_seed
        }
        teamName={
          teamMap.get(
            matchup.home_fantasy_team_id
          ) ??
          `Team ${matchup.home_fantasy_team_id}`
        }
        points={
          score(
            matchup.home_points
          )
        }
        winner={
          homeWinner
        }
      />

      <TeamScore
        seed={
          matchup.away_seed
        }
        teamName={
          matchup.away_fantasy_team_id
            ? teamMap.get(
                matchup.away_fantasy_team_id
              ) ??
              `Team ${matchup.away_fantasy_team_id}`
            : "BYE"
        }
        points={
          matchup.away_fantasy_team_id
            ? score(
                matchup.away_points
              )
            : "—"
        }
        winner={
          awayWinner
        }
      />

      {tied &&
      !matchup.resolved_by_commissioner ? (
        <div
          style={
            styles.tieTag
          }
        >
          Commissioner tiebreak required
        </div>
      ) : null}
    </article>
  );
}


function TeamScore({
  seed,
  teamName,
  points,
  winner,
}: {
  seed:
    number |
    null;
  teamName: string;
  points: string;
  winner: boolean;
}) {
  return (
    <div
      style={{
        ...styles.teamScore,
        ...(winner
          ? styles.teamScoreWinner
          : {}),
      }}
    >
      <div
        style={
          styles.teamName
        }
      >
        <span
          style={
            styles.miniSeed
          }
        >
          {seed
            ? `#${seed}`
            : "—"}
        </span>

        <strong>
          {teamName}
        </strong>
      </div>

      <strong
        style={
          styles.score
        }
      >
        {points}
      </strong>
    </div>
  );
}


const styles:
  Record<
    string,
    React.CSSProperties
  > = {
    page: {
      minHeight:
        "100vh",
      padding:
        "20px",
      background:
        "linear-gradient(180deg,#07080c,#0b0d12 50%,#07080b)",
      color:
        "#f5f7fa",
    },

    shell: {
      width:
        "min(1500px,100%)",
      margin:
        "0 auto",
    },

    hero: {
      display:
        "flex",
      alignItems:
        "center",
      justifyContent:
        "space-between",
      gap:
        "16px",
      flexWrap:
        "wrap",
      padding:
        "20px",
      marginBottom:
        "14px",
      border:
        "1px solid rgba(255,88,28,.28)",
      borderRadius:
        "16px",
      background:
        "linear-gradient(135deg,rgba(147,15,15,.24),rgba(255,91,27,.09),rgba(255,255,255,.02))",
    },

    eyebrow: {
      color:
        "#ff6a2b",
      fontSize:
        "11px",
      fontWeight:
        950,
      letterSpacing:
        ".14em",
    },

    title: {
      margin:
        "5px 0 0",
      fontSize:
        "34px",
      fontWeight:
        950,
      letterSpacing:
        "-.03em",
    },

    subtitle: {
      margin:
        "7px 0 0",
      color:
        "#969da8",
      fontSize:
        "13px",
    },

    button: {
      display:
        "inline-flex",
      alignItems:
        "center",
      justifyContent:
        "center",
      minHeight:
        "40px",
      padding:
        "9px 13px",
      border:
        "1px solid rgba(255,100,40,.35)",
      borderRadius:
        "8px",
      background:
        "linear-gradient(135deg,#b51b18,#ef531d)",
      color:
        "#fff",
      fontSize:
        "11px",
      fontWeight:
        900,
      textDecoration:
        "none",
    },

    section: {
      padding:
        "17px",
      marginBottom:
        "14px",
      border:
        "1px solid rgba(255,255,255,.08)",
      borderRadius:
        "14px",
      background:
        "rgba(14,17,23,.92)",
    },

    sectionHead: {
      display:
        "flex",
      justifyContent:
        "space-between",
      gap:
        "14px",
      alignItems:
        "flex-end",
      flexWrap:
        "wrap",
      marginBottom:
        "14px",
    },

    sectionEyebrow: {
      color:
        "#ff6a2b",
      fontSize:
        "10px",
      fontWeight:
        900,
      letterSpacing:
        ".12em",
    },

    sectionTitle: {
      margin:
        "3px 0 0",
      fontSize:
        "21px",
      fontWeight:
        950,
    },

    sectionMeta: {
      color:
        "#858d99",
      fontSize:
        "11px",
      maxWidth:
        "520px",
    },

    summary: {
      display:
        "grid",
      gridTemplateColumns:
        "repeat(6,minmax(0,1fr))",
      gap:
        "8px",
    },

    stat: {
      minWidth:
        0,
      padding:
        "12px",
      border:
        "1px solid rgba(255,255,255,.07)",
      borderRadius:
        "10px",
      background:
        "#0a0d12",
      display:
        "flex",
      flexDirection:
        "column",
      gap:
        "4px",
    },

    seedGrid: {
      display:
        "grid",
      gridTemplateColumns:
        "repeat(auto-fit,minmax(230px,1fr))",
      gap:
        "8px",
    },

    seedCard: {
      display:
        "flex",
      alignItems:
        "center",
      gap:
        "10px",
      minWidth:
        0,
      padding:
        "11px",
      border:
        "1px solid rgba(255,255,255,.08)",
      borderRadius:
        "10px",
      background:
        "#0a0d12",
    },

    seedNumber: {
      flex:
        "0 0 auto",
      minWidth:
        "35px",
      color:
        "#ff6a2b",
      fontSize:
        "15px",
      fontWeight:
        950,
    },

    seedInfo: {
      minWidth:
        0,
      display:
        "flex",
      flexDirection:
        "column",
      gap:
        "3px",
    },

    notice: {
      padding:
        "15px",
      border:
        "1px dashed rgba(255,255,255,.12)",
      borderRadius:
        "10px",
      color:
        "#969da8",
      background:
        "#090b10",
      fontSize:
        "12px",
      lineHeight:
        1.55,
    },

    bracketViewport: {
      width:
        "100%",
      overflowX:
        "auto",
      paddingBottom:
        "8px",
    },

    bracket: {
      minWidth:
        "760px",
      display:
        "grid",
      gap:
        "13px",
      alignItems:
        "stretch",
    },

    round: {
      minWidth:
        0,
      border:
        "1px solid rgba(255,255,255,.07)",
      borderRadius:
        "12px",
      background:
        "#090c11",
      overflow:
        "hidden",
    },

    roundHead: {
      minHeight:
        "48px",
      display:
        "flex",
      alignItems:
        "center",
      justifyContent:
        "space-between",
      gap:
        "8px",
      padding:
        "10px 12px",
      borderBottom:
        "1px solid rgba(255,255,255,.07)",
      background:
        "linear-gradient(135deg,rgba(142,18,18,.28),rgba(255,92,28,.08))",
      fontWeight:
        900,
    },

    roundBody: {
      display:
        "flex",
      flexDirection:
        "column",
      justifyContent:
        "space-around",
      gap:
        "12px",
      height:
        "100%",
      padding:
        "12px",
    },

    placeholder: {
      minHeight:
        "118px",
      display:
        "flex",
      alignItems:
        "center",
      justifyContent:
        "center",
      padding:
        "12px",
      border:
        "1px dashed rgba(255,255,255,.10)",
      borderRadius:
        "9px",
      color:
        "#737b87",
      fontSize:
        "11px",
      textAlign:
        "center",
    },

    matchup: {
      overflow:
        "hidden",
      border:
        "1px solid rgba(255,255,255,.10)",
      borderRadius:
        "10px",
      background:
        "#0d1016",
    },

    matchupTie: {
      border:
        "1px solid rgba(255,166,0,.42)",
    },

    matchupTop: {
      display:
        "flex",
      justifyContent:
        "space-between",
      gap:
        "8px",
      padding:
        "7px 9px",
      borderBottom:
        "1px solid rgba(255,255,255,.06)",
      color:
        "#858d98",
      fontSize:
        "9px",
      fontWeight:
        900,
      letterSpacing:
        ".07em",
    },

    teamScore: {
      display:
        "flex",
      alignItems:
        "center",
      justifyContent:
        "space-between",
      gap:
        "10px",
      padding:
        "11px 10px",
      borderBottom:
        "1px solid rgba(255,255,255,.05)",
    },

    teamScoreWinner: {
      background:
        "rgba(31,132,77,.14)",
    },

    teamName: {
      minWidth:
        0,
      display:
        "flex",
      alignItems:
        "center",
      gap:
        "7px",
    },

    miniSeed: {
      flex:
        "0 0 auto",
      color:
        "#ff7b31",
      fontSize:
        "10px",
      fontWeight:
        900,
    },

    score: {
      flex:
        "0 0 auto",
      fontVariantNumeric:
        "tabular-nums",
    },

    tieTag: {
      padding:
        "7px 9px",
      color:
        "#ffc75b",
      background:
        "rgba(255,165,0,.08)",
      fontSize:
        "9px",
      fontWeight:
        900,
      textAlign:
        "center",
    },

    tieWarning: {
      display:
        "flex",
      flexDirection:
        "column",
      gap:
        "5px",
      padding:
        "14px",
      marginBottom:
        "14px",
      border:
        "1px solid rgba(255,167,36,.30)",
      borderRadius:
        "11px",
      background:
        "rgba(130,76,0,.14)",
      color:
        "#ffd17b",
      fontSize:
        "11px",
    },

    champion: {
      display:
        "flex",
      flexDirection:
        "column",
      alignItems:
        "center",
      justifyContent:
        "center",
      gap:
        "5px",
      padding:
        "18px",
      marginBottom:
        "14px",
      border:
        "1px solid rgba(65,199,111,.28)",
      borderRadius:
        "14px",
      background:
        "linear-gradient(135deg,rgba(24,113,61,.24),rgba(15,20,17,.96))",
      textAlign:
        "center",
    },

    championLabel: {
      color:
        "#72d89a",
      fontSize:
        "10px",
      fontWeight:
        900,
      letterSpacing:
        ".12em",
    },

    championName: {
      fontSize:
        "24px",
      fontWeight:
        950,
    },

    empty: {
      width:
        "min(760px,100%)",
      margin:
        "40px auto",
      padding:
        "22px",
      border:
        "1px solid rgba(255,255,255,.09)",
      borderRadius:
        "14px",
      background:
        "#101319",
    },
  };