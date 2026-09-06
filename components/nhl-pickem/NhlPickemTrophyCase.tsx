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
};

type TrophyAward = {
  season: number;

  awardType: string;
  awardKey: string;

  title: string;

  description:
    | string
    | null;

  franchiseId:
    | string
    | null;

  franchiseName:
    | string
    | null;

  awardedAt:
    | string
    | null;

  metadata:
    | Record<
        string,
        unknown
      >
    | null;
};

type TrophyPayload = {
  success?: boolean;

  historyId?:
    | string
    | null;

  awards?: TrophyAward[];
};

type FranchiseGroup = {
  franchiseId:
    | string
    | null;

  franchiseName: string;

  awards: TrophyAward[];

  championships: number;
  periodWins: number;

  latestSeason: number;
};

function awardIcon(
  awardType: string
) {
  if (
    awardType ===
    "season_champion"
  ) {
    return "🏆";
  }

  if (
    awardType ===
    "period_winner"
  ) {
    return "🥇";
  }

  return "🏅";
}

function awardTypeLabel(
  awardType: string
) {
  if (
    awardType ===
    "season_champion"
  ) {
    return "SEASON CHAMPION";
  }

  if (
    awardType ===
    "period_winner"
  ) {
    return "PERIOD WINNER";
  }

  return awardType
    .replaceAll(
      "_",
      " "
    )
    .toUpperCase();
}

function formatDate(
  value:
    | string
    | null
    | undefined
) {
  if (!value) {
    return "";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }

  return new Intl.DateTimeFormat(
    "en-US",
    {
      month:
        "short",
      day:
        "numeric",
      year:
        "numeric",
    }
  ).format(date);
}

function numberMetadata(
  metadata:
    | Record<
        string,
        unknown
      >
    | null,
  key: string
) {
  if (!metadata) {
    return null;
  }

  const value =
    metadata[key];

  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  const parsed =
    Number(value);

  return Number.isFinite(
    parsed
  )
    ? parsed
    : null;
}

function metadataRecord(
  metadata:
    | Record<
        string,
        unknown
      >
    | null
) {
  if (!metadata) {
    return null;
  }

  const wins =
    numberMetadata(
      metadata,
      "wins"
    );

  const losses =
    numberMetadata(
      metadata,
      "losses"
    );

  const pushes =
    numberMetadata(
      metadata,
      "pushes"
    );

  if (
    wins === null ||
    losses === null ||
    pushes === null
  ) {
    return null;
  }

  return `${wins}-${losses}-${pushes}`;
}

function metadataPoints(
  metadata:
    | Record<
        string,
        unknown
      >
    | null
) {
  const points =
    numberMetadata(
      metadata,
      "points"
    );

  if (
    points === null
  ) {
    return null;
  }

  return points
    .toFixed(2)
    .replace(
      /\.00$/,
      ""
    )
    .replace(
      /(\.\d)0$/,
      "$1"
    );
}

const CSS = `
  .g365-nhl-trophy-page {
    width: 100%;
    min-width: 0;
    box-sizing: border-box;
  }

  .g365-nhl-trophy-page * {
    box-sizing: border-box;
  }

  .g365-nhl-trophy-summary {
    display: grid;
    grid-template-columns:
      repeat(
        4,
        minmax(
          0,
          1fr
        )
      );
    gap: 12px;
  }

  .g365-nhl-trophy-franchises {
    display: grid;
    grid-template-columns:
      repeat(
        auto-fit,
        minmax(
          300px,
          1fr
        )
      );
    gap: 14px;
  }

  .g365-nhl-trophy-history {
    display: grid;
    grid-template-columns:
      repeat(
        auto-fit,
        minmax(
          250px,
          1fr
        )
      );
    gap: 12px;
  }

  @media (max-width: 900px) {
    .g365-nhl-trophy-summary {
      grid-template-columns:
        repeat(
          2,
          minmax(
            0,
            1fr
          )
        );
    }
  }

  @media (max-width: 760px) {
    .g365-nhl-trophy-page {
      padding:
        14px 12px 30px !important;
      gap:
        14px !important;
    }

    .g365-nhl-trophy-hero {
      padding:
        16px !important;
    }

    .g365-nhl-trophy-page h1 {
      font-size:
        clamp(
          28px,
          8vw,
          36px
        ) !important;
    }

    .g365-nhl-trophy-franchises,
    .g365-nhl-trophy-history {
      grid-template-columns:
        1fr;
    }
  }

  @media (max-width: 430px) {
    .g365-nhl-trophy-page {
      padding:
        12px 10px 26px !important;
    }

    .g365-nhl-trophy-summary {
      grid-template-columns:
        1fr 1fr;
      gap:
        8px;
    }
  }
`;

export default function NhlPickemTrophyCase({
  leagueId,
  season,
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
    historyId,
    setHistoryId,
  ] =
    useState<
      string
      | null
    >(
      null
    );

  const [
    awards,
    setAwards,
  ] =
    useState<
      TrophyAward[]
    >([]);

  const [
    selectedSeason,
    setSelectedSeason,
  ] =
    useState<
      number
      | "all"
    >(
      "all"
    );

  const seasons =
    useMemo(
      () =>
        Array.from(
          new Set(
            awards.map(
              (award) =>
                Number(
                  award.season
                )
            )
          )
        )
          .filter(
            (value) =>
              Number.isFinite(
                value
              )
          )
          .sort(
            (
              a,
              b
            ) =>
              b - a
          ),
      [
        awards,
      ]
    );

  const filteredAwards =
    useMemo(
      () => {
        if (
          selectedSeason ===
          "all"
        ) {
          return awards;
        }

        return awards.filter(
          (award) =>
            Number(
              award.season
            ) ===
            selectedSeason
        );
      },
      [
        awards,
        selectedSeason,
      ]
    );

  const franchiseGroups =
    useMemo<
      FranchiseGroup[]
    >(
      () => {
        const map =
          new Map<
            string,
            FranchiseGroup
          >();

        for (
          const award of
          filteredAwards
        ) {
          const key =
            award.franchiseId ??
            award.franchiseName ??
            "unknown";

          const name =
            award.franchiseName ??
            "NHL Pick'em Entry";

          const current =
            map.get(
              key
            ) ?? {
              franchiseId:
                award.franchiseId,

              franchiseName:
                name,

              awards:
                [],

              championships:
                0,

              periodWins:
                0,

              latestSeason:
                Number(
                  award.season
                ),
            };

          current.awards.push(
            award
          );

          current.latestSeason =
            Math.max(
              current.latestSeason,
              Number(
                award.season
              )
            );

          if (
            award.awardType ===
            "season_champion"
          ) {
            current.championships +=
              1;
          }

          if (
            award.awardType ===
            "period_winner"
          ) {
            current.periodWins +=
              1;
          }

          map.set(
            key,
            current
          );
        }

        return Array.from(
          map.values()
        ).sort(
          (
            a,
            b
          ) => {
            if (
              b.championships !==
              a.championships
            ) {
              return (
                b.championships -
                a.championships
              );
            }

            if (
              b.periodWins !==
              a.periodWins
            ) {
              return (
                b.periodWins -
                a.periodWins
              );
            }

            if (
              b.awards.length !==
              a.awards.length
            ) {
              return (
                b.awards.length -
                a.awards.length
              );
            }

            return a.franchiseName.localeCompare(
              b.franchiseName
            );
          }
        );
      },
      [
        filteredAwards,
      ]
    );

  const totalChampionships =
    useMemo(
      () =>
        filteredAwards.filter(
          (award) =>
            award.awardType ===
            "season_champion"
        ).length,
      [
        filteredAwards,
      ]
    );

  const totalPeriodWins =
    useMemo(
      () =>
        filteredAwards.filter(
          (award) =>
            award.awardType ===
            "period_winner"
        ).length,
      [
        filteredAwards,
      ]
    );

  const load =
    useCallback(
      async () => {
        const {
          data,
          error,
        } =
          await supabase.rpc(
            "get_nhl_pickem_trophy_case",
            {
              p_league_id:
                leagueId,
            }
          );

        if (error) {
          throw new Error(
            error.message
          );
        }

        const payload =
          (
            data ??
            {}
          ) as TrophyPayload;

        setHistoryId(
          payload.historyId ??
            null
        );

        setAwards(
          payload.awards ??
            []
        );
      },
      [
        leagueId,
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
      } catch (error) {
        if (
          !active
        ) {
          return;
        }

        setMessage(
          error instanceof Error
            ? error.message
            : "The NHL Pick'em Trophy Case could not be loaded."
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
        30_000
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
        Loading NHL Pick&apos;em
        Trophy Case…
      </main>
    );
  }

  return (
    <main
      className="g365-nhl-trophy-page"
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
      <style>
        {CSS}
      </style>

      <section
        className="g365-nhl-trophy-hero"
        style={{
          padding:
            20,
          borderRadius:
            18,
          border:
            "1px solid rgba(255,108,33,0.25)",
          background:
            "linear-gradient(135deg,rgba(100,7,13,0.42),rgba(17,17,21,0.98) 58%)",
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
          G365 NHL Pick&apos;em
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
          Trophy Case
        </h1>

        <p
          style={{
            margin:
              0,
            maxWidth:
              880,
            color:
              "#a6a6ae",
            lineHeight:
              1.6,
          }}
        >
          Every permanent NHL
          Pick&apos;em achievement
          lives here. Period wins and
          season championships remain
          attached to the league&apos;s
          continuous history when the
          league renews for another
          season.
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
          display:
            "flex",
          justifyContent:
            "space-between",
          alignItems:
            "center",
          gap:
            12,
          flexWrap:
            "wrap",
          padding:
            "14px 16px",
          borderRadius:
            14,
          border:
            "1px solid rgba(255,255,255,0.08)",
          background:
            "#101014",
        }}
      >
        <div>
          <div
            style={{
              color:
                "#ff7627",
              fontSize:
                9,
              fontWeight:
                1000,
              letterSpacing:
                "0.1em",
            }}
          >
            LEAGUE HISTORY
          </div>

          <strong
            style={{
              display:
                "block",
              marginTop:
                4,
              color:
                "#fff",
              fontSize:
                17,
            }}
          >
            Continuous NHL
            Pick&apos;em Awards
          </strong>

          <div
            style={{
              marginTop:
                4,
              color:
                "#85858e",
              fontSize:
                11,
            }}
          >
            Current season:{" "}
            {season}
            {historyId
              ? " · History linked"
              : ""}
          </div>
        </div>

        <label
          style={{
            display:
              "grid",
            gap:
              5,
            color:
              "#8f8f98",
            fontSize:
              9,
            fontWeight:
              900,
          }}
        >
          SEASON

          <select
            value={
              selectedSeason
            }
            onChange={(
              event
            ) => {
              const value =
                event.target
                  .value;

              setSelectedSeason(
                value ===
                "all"
                  ? "all"
                  : Number(
                      value
                    )
              );
            }}
            style={{
              minHeight:
                40,
              minWidth:
                140,
              padding:
                "8px 10px",
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
            <option value="all">
              All Seasons
            </option>

            {seasons.map(
              (
                trophySeason
              ) => (
                <option
                  key={
                    trophySeason
                  }
                  value={
                    trophySeason
                  }
                >
                  {
                    trophySeason
                  }
                </option>
              )
            )}
          </select>
        </label>
      </section>

      <section className="g365-nhl-trophy-summary">
        <SummaryCard
          label="Awards"
          value={
            filteredAwards.length
          }
          note={
            selectedSeason ===
            "all"
              ? "All seasons"
              : `${selectedSeason} season`
          }
        />

        <SummaryCard
          label="Championships"
          value={
            totalChampionships
          }
          note="Season titles"
        />

        <SummaryCard
          label="Period Wins"
          value={
            totalPeriodWins
          }
          note="Official period victories"
        />

        <SummaryCard
          label="Franchises"
          value={
            franchiseGroups.length
          }
          note="Award-winning entries"
        />
      </section>

      {filteredAwards.length ===
      0 ? (
        <EmptyState
          text={
            selectedSeason ===
            "all"
              ? "The NHL Trophy Case will populate after the first permanent award is earned."
              : `No NHL Pick'em trophies were earned during the ${selectedSeason} season.`
          }
        />
      ) : (
        <>
          <section
            style={cardStyle}
          >
            <div
              style={
                sectionHeaderStyle
              }
            >
              <div>
                <div
                  style={
                    eyebrowStyle
                  }
                >
                  TROPHY LEADERS
                </div>

                <h2
                  style={
                    titleStyle
                  }
                >
                  Franchise Trophy Cases
                </h2>
              </div>

              <span
                style={
                  countBadgeStyle
                }
              >
                {
                  franchiseGroups.length
                }{" "}
                ENTRIES
              </span>
            </div>

            <div className="g365-nhl-trophy-franchises">
              {franchiseGroups.map(
                (
                  group
                ) => (
                  <article
                    key={
                      group.franchiseId ??
                      group.franchiseName
                    }
                    style={{
                      padding:
                        16,
                      borderRadius:
                        14,
                      border:
                        "1px solid rgba(255,255,255,0.07)",
                      background:
                        "linear-gradient(180deg,rgba(255,255,255,0.035),rgba(0,0,0,0.13))",
                    }}
                  >
                    <div
                      style={{
                        display:
                          "flex",
                        justifyContent:
                          "space-between",
                        alignItems:
                          "flex-start",
                        gap:
                          12,
                        marginBottom:
                          14,
                      }}
                    >
                      <div
                        style={{
                          minWidth:
                            0,
                        }}
                      >
                        <strong
                          style={{
                            display:
                              "block",
                            color:
                              "#fff",
                            fontSize:
                              17,
                            overflow:
                              "hidden",
                            whiteSpace:
                              "nowrap",
                            textOverflow:
                              "ellipsis",
                          }}
                        >
                          {
                            group.franchiseName
                          }
                        </strong>

                        <div
                          style={{
                            marginTop:
                              4,
                            color:
                              "#7f7f88",
                            fontSize:
                              10,
                          }}
                        >
                          Latest award season{" "}
                          {
                            group.latestSeason
                          }
                        </div>
                      </div>

                      <span
                        style={
                          countBadgeStyle
                        }
                      >
                        {
                          group.awards.length
                        }{" "}
                        TOTAL
                      </span>
                    </div>

                    <div
                      style={{
                        display:
                          "grid",
                        gridTemplateColumns:
                          "1fr 1fr",
                        gap:
                          8,
                        marginBottom:
                          14,
                      }}
                    >
                      <MiniStat
                        label="Titles"
                        value={
                          group.championships
                        }
                      />

                      <MiniStat
                        label="Period Wins"
                        value={
                          group.periodWins
                        }
                      />
                    </div>

                    <div
                      style={{
                        display:
                          "grid",
                        gap:
                          8,
                      }}
                    >
                      {group.awards.map(
                        (
                          award,
                          index
                        ) => (
                          <AwardLine
                            key={`${award.season}-${award.awardKey}-${index}`}
                            award={
                              award
                            }
                          />
                        )
                      )}
                    </div>
                  </article>
                )
              )}
            </div>
          </section>

          <section
            style={cardStyle}
          >
            <div
              style={
                sectionHeaderStyle
              }
            >
              <div>
                <div
                  style={
                    eyebrowStyle
                  }
                >
                  ALL-TIME HISTORY
                </div>

                <h2
                  style={
                    titleStyle
                  }
                >
                  Award Timeline
                </h2>
              </div>

              <span
                style={
                  countBadgeStyle
                }
              >
                {
                  filteredAwards.length
                }{" "}
                TROPHIES
              </span>
            </div>

            <div className="g365-nhl-trophy-history">
              {filteredAwards.map(
                (
                  award,
                  index
                ) => (
                  <AwardCard
                    key={`${award.season}-${award.awardKey}-${award.franchiseId ?? index}`}
                    award={
                      award
                    }
                  />
                )
              )}
            </div>
          </section>
        </>
      )}
    </main>
  );
}

function SummaryCard({
  label,
  value,
  note,
}: {
  label: string;
  value: number;
  note: string;
}) {
  return (
    <div
      style={{
        padding:
          "14px 15px",
        borderRadius:
          14,
        border:
          "1px solid rgba(255,255,255,0.07)",
        background:
          "#101014",
      }}
    >
      <div
        style={{
          color:
            "#7e7e87",
          fontSize:
            9,
          fontWeight:
            1000,
          letterSpacing:
            "0.08em",
        }}
      >
        {label.toUpperCase()}
      </div>

      <div
        style={{
          marginTop:
            4,
          color:
            "#fff",
          fontSize:
            26,
          lineHeight:
            1,
          fontWeight:
            1000,
          fontVariantNumeric:
            "tabular-nums",
        }}
      >
        {value}
      </div>

      <div
        style={{
          marginTop:
            5,
          color:
            "#777780",
          fontSize:
            9,
        }}
      >
        {note}
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div
      style={{
        padding:
          "10px 11px",
        borderRadius:
          10,
        background:
          "rgba(255,255,255,0.035)",
      }}
    >
      <div
        style={{
          color:
            "#777780",
          fontSize:
            8,
          fontWeight:
            1000,
          letterSpacing:
            "0.06em",
        }}
      >
        {label.toUpperCase()}
      </div>

      <div
        style={{
          marginTop:
            3,
          color:
            "#fff",
          fontSize:
            18,
          fontWeight:
            1000,
          fontVariantNumeric:
            "tabular-nums",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function AwardLine({
  award,
}: {
  award: TrophyAward;
}) {
  return (
    <div
      style={{
        display:
          "grid",
        gridTemplateColumns:
          "38px minmax(0,1fr)",
        gap:
          10,
        padding:
          "9px 0",
        borderTop:
          "1px solid rgba(255,255,255,0.045)",
      }}
    >
      <div
        style={{
          width:
            36,
          height:
            36,
          borderRadius:
            10,
          display:
            "grid",
          placeItems:
            "center",
          background:
            "rgba(255,118,39,0.10)",
          fontSize:
            18,
        }}
      >
        {awardIcon(
          award.awardType
        )}
      </div>

      <div
        style={{
          minWidth:
            0,
        }}
      >
        <div
          style={{
            color:
              "#ff8d43",
            fontSize:
              8,
            fontWeight:
              1000,
          }}
        >
          {award.season} ·{" "}
          {awardTypeLabel(
            award.awardType
          )}
        </div>

        <div
          style={{
            marginTop:
              3,
            color:
              "#fff",
            fontSize:
              12,
            fontWeight:
              900,
          }}
        >
          {award.title}
        </div>
      </div>
    </div>
  );
}

function AwardCard({
  award,
}: {
  award: TrophyAward;
}) {
  const record =
    metadataRecord(
      award.metadata
    );

  const points =
    metadataPoints(
      award.metadata
    );

  const rank =
    numberMetadata(
      award.metadata,
      "rank"
    );

  return (
    <article
      style={{
        display:
          "grid",
        gridTemplateColumns:
          "48px minmax(0,1fr)",
        gap:
          12,
        padding:
          15,
        borderRadius:
          14,
        border:
          award.awardType ===
          "season_champion"
            ? "1px solid rgba(255,118,39,0.28)"
            : "1px solid rgba(255,255,255,0.07)",
        background:
          award.awardType ===
          "season_champion"
            ? "linear-gradient(135deg,rgba(120,12,18,0.20),rgba(255,118,39,0.035))"
            : "rgba(255,255,255,0.025)",
      }}
    >
      <div
        style={{
          width:
            46,
          height:
            46,
          borderRadius:
            13,
          display:
            "grid",
          placeItems:
            "center",
          background:
            "rgba(255,118,39,0.10)",
          fontSize:
            23,
        }}
      >
        {awardIcon(
          award.awardType
        )}
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
            justifyContent:
              "space-between",
            alignItems:
              "center",
            gap:
              8,
            flexWrap:
              "wrap",
          }}
        >
          <div
            style={{
              color:
                "#ff8d43",
              fontSize:
                9,
              fontWeight:
                1000,
              letterSpacing:
                "0.06em",
            }}
          >
            {award.season} ·{" "}
            {awardTypeLabel(
              award.awardType
            )}
          </div>

          {award.awardedAt ? (
            <div
              style={{
                color:
                  "#66666f",
                fontSize:
                  8,
              }}
            >
              {formatDate(
                award.awardedAt
              )}
            </div>
          ) : null}
        </div>

        <h3
          style={{
            margin:
              "5px 0 0",
            color:
              "#fff",
            fontSize:
              15,
          }}
        >
          {award.title}
        </h3>

        <strong
          style={{
            display:
              "block",
            marginTop:
              4,
            color:
              "#d2d2d7",
            fontSize:
              11,
          }}
        >
          {award.franchiseName ??
            "NHL Pick'em Entry"}
        </strong>

        {award.description ? (
          <p
            style={{
              margin:
                "7px 0 0",
              color:
                "#909099",
              fontSize:
                10,
              lineHeight:
                1.45,
            }}
          >
            {
              award.description
            }
          </p>
        ) : null}

        {record ||
        points ||
        rank !== null ? (
          <div
            style={{
              display:
                "flex",
              gap:
                7,
              flexWrap:
                "wrap",
              marginTop:
                9,
            }}
          >
            {rank !==
            null ? (
              <MetaPill
                label={`Rank #${rank}`}
              />
            ) : null}

            {record ? (
              <MetaPill
                label={`Record ${record}`}
              />
            ) : null}

            {points ? (
              <MetaPill
                label={`${points} pts`}
              />
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}

function MetaPill({
  label,
}: {
  label: string;
}) {
  return (
    <span
      style={{
        padding:
          "4px 7px",
        borderRadius:
          999,
        background:
          "rgba(255,255,255,0.045)",
        color:
          "#a9a9b0",
        fontSize:
          8,
        fontWeight:
          900,
      }}
    >
      {label}
    </span>
  );
}

function EmptyState({
  text,
}: {
  text: string;
}) {
  return (
    <div
      style={{
        padding:
          "22px 16px",
        borderRadius:
          13,
        border:
          "1px dashed rgba(255,255,255,0.10)",
        background:
          "rgba(255,255,255,0.018)",
        color:
          "#8f8f98",
        fontSize:
          12,
        lineHeight:
          1.5,
      }}
    >
      {text}
    </div>
  );
}

const cardStyle:
  React.CSSProperties = {
    overflow:
      "hidden",
    padding:
      16,
    borderRadius:
      16,
    border:
      "1px solid rgba(255,255,255,0.08)",
    background:
      "#101014",
  };

const sectionHeaderStyle:
  React.CSSProperties = {
    display:
      "flex",
    justifyContent:
      "space-between",
    alignItems:
      "center",
    gap:
      12,
    flexWrap:
      "wrap",
    marginBottom:
      14,
  };

const eyebrowStyle:
  React.CSSProperties = {
    color:
      "#ff7627",
    fontSize:
      9,
    fontWeight:
      1000,
    letterSpacing:
      "0.10em",
  };

const titleStyle:
  React.CSSProperties = {
    margin:
      "3px 0 0",
    color:
      "#fff",
    fontSize:
      20,
  };

const countBadgeStyle:
  React.CSSProperties = {
    padding:
      "6px 9px",
    borderRadius:
      999,
    background:
      "rgba(255,118,39,0.10)",
    color:
      "#ff9b59",
    fontSize:
      9,
    fontWeight:
      1000,
  };