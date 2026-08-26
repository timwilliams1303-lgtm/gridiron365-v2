"use client";

import Image from "next/image";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import {
  createBrowserClient,
} from "@supabase/ssr";

import type {
  TraditionalRankingPlayer,
} from "@/lib/traditional/rankings.service";


type Props = {
  leagueId: string;
  season: number;
  initialized: boolean;
  initialPlayers:
    TraditionalRankingPlayer[];
  teams: string[];
};


type DraftPlayerProfile = {
  playerId: number;

  lastSeason: number;

  projectionSeason: number;

  projectedPoints:
    number |
    null;

  actual: {
    gamesPlayed: number;

    passingAttempts: number;

    passingCompletions: number;

    passingYards: number;

    passingTouchdowns: number;

    passingInterceptions: number;

    rushingAttempts: number;

    rushingYards: number;

    rushingTouchdowns: number;

    receivingTargets: number;

    receptions: number;

    receivingYards: number;

    receivingTouchdowns: number;

    fumbles: number;

    fumblesLost: number;

    fieldGoalsMade: number;

    fieldGoalsAttempted: number;

    extraPointsMade: number;

    extraPointsAttempted: number;

    dstSacks: number;

    dstInterceptions: number;

    dstFumbleRecoveries: number;

    dstTouchdowns: number;

    dstSafeties: number;

    dstBlockedKicks: number;

    dstPointsAllowed: number;

    dstYardsAllowed: number;
  };

  projected: {
    passingAttempts: number | null;
    passingCompletions: number | null;
    passingYards: number | null;
    passingTouchdowns: number | null;
    passingInterceptions: number | null;
    rushingAttempts: number | null;
    rushingYards: number | null;
    rushingTouchdowns: number | null;
    receivingTargets: number | null;
    receptions: number | null;
    receivingYards: number | null;
    receivingTouchdowns: number | null;
    fumbles: number | null;
    fumblesLost: number | null;
    fieldGoalsMade: number | null;
    fieldGoalsAttempted: number | null;
    extraPointsMade: number | null;
    extraPointsAttempted: number | null;
  };
};


const supabase =
  createBrowserClient(
    process.env
      .NEXT_PUBLIC_SUPABASE_URL!,

    process.env
      .NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
      process.env
        .NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );


const positions = [
  "ALL",
  "QB",
  "RB",
  "WR",
  "TE",
  "K",
  "DST",
];


function getInjuryDisplay(
  status:
    string |
    null
) {
  const value =
    (
      status ??
      ""
    )
      .trim()
      .toUpperCase();


  if (
    !value ||
    value === "ACTIVE" ||
    value === "HEALTHY"
  ) {
    return null;
  }


  if (
    value.includes(
      "QUESTION"
    )
  ) {
    return {
      code: "Q",
      label:
        "Questionable",
    };
  }


  if (
    value.includes(
      "DOUBT"
    )
  ) {
    return {
      code: "D",
      label:
        "Doubtful",
    };
  }


  if (
    value === "O" ||
    value.includes(
      "OUT"
    )
  ) {
    return {
      code: "O",
      label: "Out",
    };
  }


  if (
    value.includes(
      "INJURED RESERVE"
    ) ||
    value === "IR"
  ) {
    return {
      code: "IR",
      label:
        "Injured Reserve",
    };
  }


  if (
    value.includes(
      "PUP"
    ) ||
    value.includes(
      "PHYSICALLY UNABLE"
    )
  ) {
    return {
      code: "PUP",
      label:
        "Physically Unable to Perform",
    };
  }


  if (
    value.includes(
      "SUSPEND"
    ) ||
    value ===
      "SUS"
  ) {
    return {
      code:
        "SUS",

      label:
        "Suspended",
    };
  }


  if (
    value.includes(
      "DAY-TO-DAY"
    ) ||
    value.includes(
      "DAY TO DAY"
    )
  ) {
    return {
      code:
        "DTD",

      label:
        "Day-to-Day",
    };
  }


  return {
    code:
      value.length <= 4
        ? value
        : "INJ",

    label:
      status ??
      "Injury status",
  };
}


export default function TraditionalRankingsManager({
  leagueId,
  season,
  initialized,
  initialPlayers,
  teams,
}: Props) {
  const router =
    useRouter();


  const [
    profilePlayerId,
    setProfilePlayerId,
  ] =
    useState<
      number |
      null
    >(
      null
    );


  const [
    playerProfile,
    setPlayerProfile,
  ] =
    useState<
      DraftPlayerProfile |
      null
    >(
      null
    );


  const [
    profileLoading,
    setProfileLoading,
  ] =
    useState(
      false
    );


  const [
    players,
    setPlayers,
  ] =
    useState(
      initialPlayers
    );


  const [
    search,
    setSearch,
  ] =
    useState(
      ""
    );


  const [
    position,
    setPosition,
  ] =
    useState(
      "ALL"
    );


  const [
    nflTeam,
    setNflTeam,
  ] =
    useState(
      "ALL"
    );


  const [
    savingPlayerId,
    setSavingPlayerId,
  ] =
    useState<
      number |
      null
    >(
      null
    );


  const [
    initializing,
    setInitializing,
  ] =
    useState(
      !initialized
    );


  const [
    resetting,
    setResetting,
  ] =
    useState(
      false
    );


  const [
    error,
    setError,
  ] =
    useState<
      string |
      null
    >(
      null
    );


  useEffect(
    () => {
      setPlayers(
        initialPlayers
      );
    },
    [
      initialPlayers,
    ]
  );


  /*
   * First visit:
   * create the user's personal
   * rankings from the default
   * ESPN ranking set.
   */
  useEffect(
    () => {
      if (
        initialized
      ) {
        setInitializing(
          false
        );

        return;
      }


      let cancelled =
        false;


      async function initialize() {
        try {
          const response =
            await fetch(
              `/api/league/${leagueId}/rankings/initialize`,
              {
                method:
                  "POST",

                headers: {
                  "Content-Type":
                    "application/json",
                },

                body:
                  JSON.stringify({
                    season,
                  }),
              }
            );


          const result =
            await response.json();


          if (
            !response.ok ||
            !result.success
          ) {
            throw new Error(
              result.error ??
              "Unable to initialize My Rankings."
            );
          }


          if (
            !cancelled
          ) {
            router.refresh();
          }
        } catch (
          initError
        ) {
          if (
            !cancelled
          ) {
            setError(
              initError instanceof Error
                ? initError.message
                : "Unable to initialize My Rankings."
            );

            setInitializing(
              false
            );
          }
        }
      }


      void initialize();


      return () => {
        cancelled =
          true;
      };
    },
    [
      initialized,
      leagueId,
      season,
      router,
    ]
  );


  const filteredPlayers =
    useMemo(
      () => {
        const needle =
          search
            .trim()
            .toLowerCase();


        return players.filter(
          (
            player
          ) => {
            if (
              needle &&
              !player.fullName
                .toLowerCase()
                .includes(
                  needle
                )
            ) {
              return false;
            }


            if (
              position !==
                "ALL" &&
              player.position !==
                position
            ) {
              return false;
            }


            if (
              nflTeam !==
                "ALL" &&
              player.teamAbbreviation !==
                nflTeam
            ) {
              return false;
            }


            return true;
          }
        );
      },
      [
        players,
        search,
        position,
        nflTeam,
      ]
    );


  const profilePlayer =
    useMemo(
      () =>
        players.find(
          (
            player
          ) =>
            player.playerId ===
            profilePlayerId
        ) ??
        null,
      [
        players,
        profilePlayerId,
      ]
    );


  async function openPlayerProfile(
    playerId: number
  ) {
    setProfilePlayerId(
      playerId
    );

    setPlayerProfile(
      null
    );

    setProfileLoading(
      true
    );

    setError(
      null
    );


    const {
      data,
      error:
        profileError,
    } =
      await supabase.rpc(
        "get_traditional_draft_player_profile",
        {
          p_player_id:
            playerId,

          p_projection_season:
            season,
        }
      );


    if (
      profileError
    ) {
      setError(
        profileError.message
      );
    } else {
      setPlayerProfile(
        data as DraftPlayerProfile
      );
    }


    setProfileLoading(
      false
    );
  }


  async function movePlayer(
    playerId: number,
    newRank: number
  ) {
    const current =
      players.find(
        (
          player
        ) =>
          player.playerId ===
          playerId
      );


    if (
      !current
    ) {
      return;
    }


    const safeRank =
      Math.max(
        1,
        Math.min(
          players.length,
          newRank
        )
      );


    if (
      safeRank ===
      current.myRank
    ) {
      return;
    }


    setSavingPlayerId(
      playerId
    );

    setError(
      null
    );


    try {
      const response =
        await fetch(
          `/api/league/${leagueId}/rankings/move`,
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                season,
                playerId,
                newRank:
                  safeRank,
              }),
          }
        );


      const result =
        await response.json();


      if (
        !response.ok ||
        !result.success
      ) {
        throw new Error(
          result.error ??
          "Unable to move player."
        );
      }


      /*
       * Mirror the database move
       * immediately in local state.
       */
      setPlayers(
        (
          existing
        ) =>
          existing
            .map(
              (
                player
              ) => {
                if (
                  player.playerId ===
                  playerId
                ) {
                  return {
                    ...player,

                    myRank:
                      safeRank,
                  };
                }


                if (
                  safeRank <
                    current.myRank &&
                  player.myRank >=
                    safeRank &&
                  player.myRank <
                    current.myRank
                ) {
                  return {
                    ...player,

                    myRank:
                      player.myRank +
                      1,
                  };
                }


                if (
                  safeRank >
                    current.myRank &&
                  player.myRank >
                    current.myRank &&
                  player.myRank <=
                    safeRank
                ) {
                  return {
                    ...player,

                    myRank:
                      player.myRank -
                      1,
                  };
                }


                return player;
              }
            )
            .sort(
              (
                a,
                b
              ) =>
                a.myRank -
                b.myRank
            )
      );
    } catch (
      moveError
    ) {
      setError(
        moveError instanceof Error
          ? moveError.message
          : "Unable to move player."
      );
    } finally {
      setSavingPlayerId(
        null
      );
    }
  }


  async function resetRankings() {
    if (
      resetting
    ) {
      return;
    }


    const confirmed =
      window.confirm(
        "Reset My Rankings back to the ESPN default order?"
      );


    if (
      !confirmed
    ) {
      return;
    }


    setResetting(
      true
    );

    setError(
      null
    );


    try {
      const response =
        await fetch(
          `/api/league/${leagueId}/rankings/reset`,
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                season,
              }),
          }
        );


      const result =
        await response.json();


      if (
        !response.ok ||
        !result.success
      ) {
        throw new Error(
          result.error ??
          "Unable to reset rankings."
        );
      }


      router.refresh();
    } catch (
      resetError
    ) {
      setError(
        resetError instanceof Error
          ? resetError.message
          : "Unable to reset rankings."
      );
    } finally {
      setResetting(
        false
      );
    }
  }


  if (
    initializing
  ) {
    return (
      <section
        style={
          styles.loadingCard
        }
      >
        <strong
          style={
            styles.loadingTitle
          }
        >
          Creating My Rankings...
        </strong>

        <span
          style={
            styles.loadingText
          }
        >
          Copying the current
          ESPN PPR draft order
          into your personal
          rankings.
        </span>
      </section>
    );
  }


  return (
    <div
      style={
        styles.wrapper
      }
    >
      {error ? (
        <div
          style={
            styles.error
          }
        >
          {error}
        </div>
      ) : null}


      {profilePlayerId ? (
        <PlayerProfileModal
          player={
            profilePlayer
          }
          profile={
            playerProfile
          }
          loading={
            profileLoading
          }
          onClose={
            () => {
              setProfilePlayerId(
                null
              );

              setPlayerProfile(
                null
              );
            }
          }
        />
      ) : null}


      {/* ============================
          FILTERS
      ============================ */}

      <section
        style={
          styles.toolbar
        }
      >
        <input
          type="search"
          value={
            search
          }
          onChange={
            (
              event
            ) =>
              setSearch(
                event.target.value
              )
          }
          placeholder="Search players..."
          style={
            styles.search
          }
        />


        <div
          style={
            styles.positionTabs
          }
        >
          {positions.map(
            (
              item
            ) => (
              <button
                key={
                  item
                }
                type="button"
                onClick={
                  () =>
                    setPosition(
                      item
                    )
                }
                style={{
                  ...styles.positionButton,

                  ...(position ===
                  item
                    ? styles.positionButtonActive
                    : {}),
                }}
              >
                {item}
              </button>
            )
          )}
        </div>


        <div
          style={
            styles.toolbarBottom
          }
        >
          <label
            style={
              styles.teamFilter
            }
          >
            <span>
              NFL TEAM
            </span>

            <select
              value={
                nflTeam
              }
              onChange={
                (
                  event
                ) =>
                  setNflTeam(
                    event.target.value
                  )
              }
              style={
                styles.select
              }
            >
              <option
                value="ALL"
              >
                All Teams
              </option>

              {teams.map(
                (
                  team
                ) => (
                  <option
                    key={
                      team
                    }
                    value={
                      team
                    }
                  >
                    {team}
                  </option>
                )
              )}
            </select>
          </label>


          <button
            type="button"
            onClick={
              () =>
                void resetRankings()
            }
            disabled={
              resetting
            }
            style={{
              ...styles.resetButton,

              ...(resetting
                ? styles.disabledButton
                : {}),
            }}
          >
            {resetting
              ? "RESETTING..."
              : "RESET TO ESPN DEFAULTS"}
          </button>
        </div>
      </section>


      <div
        style={
          styles.resultBar
        }
      >
        <strong
          style={
            styles.resultNumber
          }
        >
          {filteredPlayers.length}
        </strong>

        <span>
          players shown
        </span>

        <span>
          •
        </span>

        <span>
          Changes save automatically
        </span>
      </div>


      {/* ============================
          RANKINGS
      ============================ */}

      <section
        style={
          styles.tableShell
        }
      >
        <div
          style={
            styles.tableScroll
          }
        >
          <div
            style={
              styles.table
            }
          >
            <div
              style={
                styles.tableHeader
              }
            >
              <span>
                MY
              </span>

              <span>
                ESPN
              </span>

              <span>
                PLAYER
              </span>

              <span>
                POS
              </span>

              <span>
                NFL
              </span>

              <span>
                BYE
              </span>

              <span>
                INJ
              </span>

              <span>
                PROJ
              </span>

              <span
                style={
                  styles.moveHeader
                }
              >
                MOVE
              </span>
            </div>


            {filteredPlayers.map(
              (
                player
              ) => (
                <RankingRow
                  key={
                    player.playerId
                  }
                  player={
                    player
                  }
                  totalPlayers={
                    players.length
                  }
                  saving={
                    savingPlayerId ===
                    player.playerId
                  }
                  onMove={
                    (
                      rank
                    ) =>
                      void movePlayer(
                        player.playerId,
                        rank
                      )
                  }

                  onOpenProfile={
                    (
                      playerId
                    ) =>
                      void openPlayerProfile(
                        playerId
                      )
                  }
                />
              )
            )}


            {filteredPlayers.length ===
            0 ? (
              <div
                style={
                  styles.empty
                }
              >
                No players match
                your current filters.
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}


function PlayerProfileModal({
  player,
  profile,
  loading,
  onClose,
}: {
  player:
    TraditionalRankingPlayer |
    null;

  profile:
    DraftPlayerProfile |
    null;

  loading:
    boolean;

  onClose:
    () => void;
}) {
  if (
    !player
  ) {
    return null;
  }


  const actual =
    profile
      ?.actual ??
    null;


  const projected =
    profile
      ?.projected ??
    null;


  const [
    injuryReportOpen,
    setInjuryReportOpen,
  ] =
    useState(
      false
    );


  const position =
    player.position;


  const statRows:
    Array<[
      string,
      string |
      number
    ]> =
      [];


  if (
    actual
  ) {
    if (
      position ===
        "QB"
    ) {
      statRows.push(
        [
          "Games",
          actual.gamesPlayed,
        ],
        [
          "Comp / Att",
          `${actual.passingCompletions} / ${actual.passingAttempts}`,
        ],
        [
          "Pass Yards",
          actual.passingYards,
        ],
        [
          "Pass TD",
          actual.passingTouchdowns,
        ],
        [
          "INT",
          actual.passingInterceptions,
        ],
        [
          "Rush Att",
          actual.rushingAttempts,
        ],
        [
          "Rush Yards",
          actual.rushingYards,
        ],
        [
          "Rush TD",
          actual.rushingTouchdowns,
        ]
      );
    } else if (
      [
        "RB",
        "WR",
        "TE",
      ].includes(
        position
      )
    ) {
      statRows.push(
        [
          "Games",
          actual.gamesPlayed,
        ],
        [
          "Carries",
          actual.rushingAttempts,
        ],
        [
          "Rush Yards",
          actual.rushingYards,
        ],
        [
          "Rush TD",
          actual.rushingTouchdowns,
        ],
        [
          "Targets",
          actual.receivingTargets,
        ],
        [
          "Receptions",
          actual.receptions,
        ],
        [
          "Rec Yards",
          actual.receivingYards,
        ],
        [
          "Rec TD",
          actual.receivingTouchdowns,
        ]
      );
    } else if (
      position ===
        "K"
    ) {
      statRows.push(
        [
          "Games",
          actual.gamesPlayed,
        ],
        [
          "FG Made",
          actual.fieldGoalsMade,
        ],
        [
          "FG Att",
          actual.fieldGoalsAttempted,
        ],
        [
          "XP Made",
          actual.extraPointsMade,
        ],
        [
          "XP Att",
          actual.extraPointsAttempted,
        ]
      );
    } else if (
      position ===
        "DST"
    ) {
      statRows.push(
        [
          "Games",
          actual.gamesPlayed,
        ],
        [
          "Sacks",
          actual.dstSacks,
        ],
        [
          "INT",
          actual.dstInterceptions,
        ],
        [
          "Fumble Rec",
          actual.dstFumbleRecoveries,
        ],
        [
          "TD",
          actual.dstTouchdowns,
        ],
        [
          "Safeties",
          actual.dstSafeties,
        ],
        [
          "Blocked Kicks",
          actual.dstBlockedKicks,
        ],
        [
          "Pts Allowed",
          actual.dstPointsAllowed,
        ]
      );
    }
  }


  const projectedStatRows:
    Array<[
      string,
      string |
      number
    ]> =
      [];


  const formatProjection = (
    value: number | null | undefined,
    decimals = 1
  ) => {
    if (
      value === null ||
      value === undefined ||
      !Number.isFinite(Number(value))
    ) {
      return "—";
    }

    return Number(value).toFixed(decimals);
  };


  if (
    projected
  ) {
    if (
      position === "QB"
    ) {
      projectedStatRows.push(
        [
          "Comp / Att",
          `${formatProjection(projected.passingCompletions)} / ${formatProjection(projected.passingAttempts)}`,
        ],
        [
          "Pass Yards",
          formatProjection(projected.passingYards),
        ],
        [
          "Pass TD",
          formatProjection(projected.passingTouchdowns),
        ],
        [
          "INT",
          formatProjection(projected.passingInterceptions),
        ],
        [
          "Rush Att",
          formatProjection(projected.rushingAttempts),
        ],
        [
          "Rush Yards",
          formatProjection(projected.rushingYards),
        ],
        [
          "Rush TD",
          formatProjection(projected.rushingTouchdowns),
        ]
      );
    } else if (
      [
        "RB",
        "WR",
        "TE",
      ].includes(
        position
      )
    ) {
      projectedStatRows.push(
        [
          "Carries",
          formatProjection(projected.rushingAttempts),
        ],
        [
          "Rush Yards",
          formatProjection(projected.rushingYards),
        ],
        [
          "Rush TD",
          formatProjection(projected.rushingTouchdowns),
        ],
        [
          "Targets",
          formatProjection(projected.receivingTargets),
        ],
        [
          "Receptions",
          formatProjection(projected.receptions),
        ],
        [
          "Rec Yards",
          formatProjection(projected.receivingYards),
        ],
        [
          "Rec TD",
          formatProjection(projected.receivingTouchdowns),
        ]
      );
    } else if (
      position === "K"
    ) {
      projectedStatRows.push(
        [
          "FG Made",
          formatProjection(projected.fieldGoalsMade),
        ],
        [
          "FG Att",
          formatProjection(projected.fieldGoalsAttempted),
        ],
        [
          "XP Made",
          formatProjection(projected.extraPointsMade),
        ],
        [
          "XP Att",
          formatProjection(projected.extraPointsAttempted),
        ]
      );
    }
  }


  const injury =
    getInjuryDisplay(
      player.injuryStatus
    );


  return (
    <div
      style={
        styles.profileOverlay
      }
      onMouseDown={
        onClose
      }
    >
      <div
        style={
          styles.profileModal
        }
        onMouseDown={
          (
            event
          ) =>
            event.stopPropagation()
        }
      >
        <div
          style={
            styles.profileHeader
          }
        >
          <div
            style={
              styles.profileIdentity
            }
          >
            <div
              style={
                styles.profileAvatar
              }
            >
              {player.headshotUrl ? (
                <Image
                  src={
                    player.headshotUrl
                  }
                  alt={
                    player.fullName
                  }
                  width={
                    58
                  }
                  height={
                    58
                  }
                  style={
                    styles.profileAvatarImage
                  }
                />
              ) : (
                <div
                  style={
                    styles.profileAvatarFallback
                  }
                >
                  {player.position}
                </div>
              )}
            </div>


            <div>
              <strong
                style={
                  styles.profileName
                }
              >
                {player.fullName}
              </strong>


              <div
                style={
                  styles.profileMeta
                }
              >
                {player.position}
                {" • "}
                {player.teamAbbreviation ??
                  "FA"}
                {" • "}
                BYE {player.byeWeek ?? "—"}
              </div>


              <div
                style={
                  styles.profileInjuryLine
                }
              >
                <span>
                  Injury:
                </span>

                {injury ? (
                  <>
                    <button
                      type="button"
                      title={`View ${injury.label} injury report`}
                      style={{
                        ...styles.injuryBadge,
                        ...styles.injuryBadgeButton,
                      }}
                      onClick={
                        () =>
                          setInjuryReportOpen(
                            true
                          )
                      }
                    >
                      {injury.code}
                    </button>

                    <span
                      style={
                        styles.profileInjuryLabel
                      }
                    >
                      {injury.label}
                    </span>
                  </>
                ) : (
                  <span
                    style={
                      styles.injuryHealthy
                    }
                    title="No injury designation"
                  >
                    Healthy
                  </span>
                )}
              </div>

              {injuryReportOpen ? (
                <InjuryReportModal
                  player={
                    player
                  }
                  onClose={
                    () =>
                      setInjuryReportOpen(
                        false
                      )
                  }
                />
              ) : null}
            </div>
          </div>


          <button
            type="button"
            onClick={
              onClose
            }
            style={
              styles.profileClose
            }
            aria-label="Close player profile"
          >
            ×
          </button>
        </div>


        {loading ? (
          <div
            style={
              styles.profileLoading
            }
          >
            Loading player stats…
          </div>
        ) : (
          <div
            style={
              styles.profileContent
            }
          >
            <section
              style={
                styles.profileSection
              }
            >
              <div
                style={
                  styles.profileSectionHeader
                }
              >
                {profile?.lastSeason ?? "LAST"} ACTUAL STATS
              </div>


              <div
                style={
                  styles.profileStatsGrid
                }
              >
                {statRows.length >
                0 ? (
                  statRows.map(
                    (
                      [
                        label,
                        value,
                      ]
                    ) => (
                      <div
                        key={
                          label
                        }
                        style={
                          styles.profileStatCard
                        }
                      >
                        <span
                          style={
                            styles.profileStatLabel
                          }
                        >
                          {label}
                        </span>

                        <strong
                          style={
                            styles.profileStatValue
                          }
                        >
                          {value}
                        </strong>
                      </div>
                    )
                  )
                ) : (
                  <div
                    style={
                      styles.profileNoStats
                    }
                  >
                    No completed regular-season stats are stored for this player.
                  </div>
                )}
              </div>
            </section>


            <section
              style={
                styles.profileSection
              }
            >
              <div
                style={
                  styles.profileSectionHeader
                }
              >
                {profile?.projectionSeason ?? "CURRENT"} PROJECTED STATS
              </div>


              <div
                style={
                  styles.profileStatsGrid
                }
              >
                {projectedStatRows.length > 0 ? (
                  projectedStatRows.map(
                    ([label, value]) => (
                      <div
                        key={`projected-${label}`}
                        style={
                          styles.profileStatCard
                        }
                      >
                        <span
                          style={
                            styles.profileStatLabel
                          }
                        >
                          {label}
                        </span>

                        <strong
                          style={
                            styles.profileStatValue
                          }
                        >
                          {value}
                        </strong>
                      </div>
                    )
                  )
                ) : (
                  <div
                    style={
                      styles.profileNoStats
                    }
                  >
                    No detailed season projection is currently available for this player.
                  </div>
                )}
              </div>


              <div
                style={
                  styles.projectionHero
                }
              >
                <span
                  style={
                    styles.projectionHeroLabel
                  }
                >
                  PROJECTED FANTASY POINTS
                </span>

                <strong
                  style={
                    styles.projectionHeroValue
                  }
                >
                  {(profile?.projectedPoints ??
                    player.projectedPoints) !== null &&
                  (profile?.projectedPoints ??
                    player.projectedPoints) !== undefined
                    ? Number(
                        profile?.projectedPoints ??
                        player.projectedPoints
                      ).toFixed(1)
                    : "—"}
                </strong>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}


function InjuryReportModal({
  player,
  onClose,
}: {
  player:
    TraditionalRankingPlayer;

  onClose:
    () => void;
}) {
  const injury =
    getInjuryDisplay(
      player.injuryStatus
    );


  if (
    !injury
  ) {
    return null;
  }


  return (
    <div
      style={
        styles.injuryReportOverlay
      }
      onMouseDown={
        onClose
      }
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={`${player.fullName} injury report`}
        style={
          styles.injuryReportModal
        }
        onMouseDown={
          (
            event
          ) =>
            event.stopPropagation()
        }
      >
        <div
          style={
            styles.injuryReportHeader
          }
        >
          <div>
            <span
              style={
                styles.injuryReportEyebrow
              }
            >
              INJURY REPORT
            </span>

            <strong
              style={
                styles.injuryReportName
              }
            >
              {player.fullName}
            </strong>

            <span
              style={
                styles.injuryReportMeta
              }
            >
              {player.position}
              {" • "}
              {player.teamAbbreviation ??
                "FA"}
            </span>
          </div>

          <button
            type="button"
            onClick={
              onClose
            }
            style={
              styles.injuryReportClose
            }
            aria-label="Close injury report"
          >
            ×
          </button>
        </div>


        <div
          style={
            styles.injuryReportBody
          }
        >
          <div
            style={
              styles.injuryReportStatusRow
            }
          >
            <button
              type="button"
              title={
                injury.label
              }
              style={{
                ...styles.injuryBadge,
                ...styles.injuryBadgeButton,
              }}
            >
              {injury.code}
            </button>

            <div
              style={
                styles.injuryReportStatusText
              }
            >
              <strong>
                {injury.label}
              </strong>

              <span>
                Current designation
              </span>
            </div>
          </div>


          <div
            style={
              styles.injuryReportGrid
            }
          >
            <div
              style={
                styles.injuryReportCard
              }
            >
              <span>
                INJURY
              </span>

              <strong>
                {player.injuryType ??
                  "Not specified"}
              </strong>
            </div>

            <div
              style={
                styles.injuryReportCard
              }
            >
              <span>
                LOCATION
              </span>

              <strong>
                {player.injuryLocation ??
                  "Not specified"}
              </strong>
            </div>

            <div
              style={
                styles.injuryReportCard
              }
            >
              <span>
                INJURY DATE
              </span>

              <strong>
                {player.injuryDate
                  ? new Date(
                      `${player.injuryDate}T00:00:00`
                    ).toLocaleDateString()
                  : "Not available"}
              </strong>
            </div>

            <div
              style={
                styles.injuryReportCard
              }
            >
              <span>
                EXPECTED RETURN
              </span>

              <strong>
                {player.injuryReturnDate
                  ? new Date(
                      `${player.injuryReturnDate}T00:00:00`
                    ).toLocaleDateString()
                  : "Not available"}
              </strong>
            </div>
          </div>


          <div
            style={
              styles.injuryReportDetailCard
            }
          >
            <span
              style={
                styles.injuryReportDetailLabel
              }
            >
              FULL REPORT
            </span>

            <p
              style={
                styles.injuryReportDetailText
              }
            >
              {player.injuryDetail ??
                "No additional injury report is currently available."}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}


function RankingRow({
  player,
  totalPlayers,
  saving,
  onMove,
  onOpenProfile,
}: {
  player:
    TraditionalRankingPlayer;

  totalPlayers:
    number;

  saving:
    boolean;

  onMove:
    (
      rank: number
    ) => void;

  onOpenProfile:
    (
      playerId: number
    ) => void;
}) {
  const [
    rankInput,
    setRankInput,
  ] =
    useState(
      String(
        player.myRank
      )
    );


  useEffect(
    () => {
      setRankInput(
        String(
          player.myRank
        )
      );
    },
    [
      player.myRank,
    ]
  );


  const injury =
    getInjuryDisplay(
      player.injuryStatus
    );


  const [
    injuryReportOpen,
    setInjuryReportOpen,
  ] =
    useState(
      false
    );


  function submitRank() {
    const parsed =
      Number(
        rankInput
      );


    if (
      !Number.isInteger(
        parsed
      )
    ) {
      setRankInput(
        String(
          player.myRank
        )
      );

      return;
    }


    const safeRank =
      Math.max(
        1,
        Math.min(
          totalPlayers,
          parsed
        )
      );


    setRankInput(
      String(
        safeRank
      )
    );


    onMove(
      safeRank
    );
  }


  return (
    <article
      style={
        styles.row
      }
    >
      {injuryReportOpen ? (
        <InjuryReportModal
          player={
            player
          }
          onClose={
            () =>
              setInjuryReportOpen(
                false
              )
          }
        />
      ) : null}


      <strong
        style={
          styles.myRank
        }
      >
        {player.myRank}
      </strong>


      <span
        style={
          styles.defaultRank
        }
      >
        {player.defaultRank}
      </span>


      <div
        style={
          styles.playerIdentity
        }
      >
        <div
          style={
            styles.headshotWrap
          }
        >
          {player.headshotUrl ? (
            <Image
              src={
                player.headshotUrl
              }
              alt={
                player.fullName
              }
              width={
                46
              }
              height={
                46
              }
              style={
                styles.headshot
              }
            />
          ) : (
            <div
              style={
                styles.headshotFallback
              }
            >
              {player.position}
            </div>
          )}
        </div>


        <button
          type="button"
          onClick={
            () =>
              onOpenProfile(
                player.playerId
              )
          }
          style={
            styles.playerNameButton
          }
          title={`View ${player.fullName} stats`}
        >
          {player.fullName}
        </button>
      </div>


      <strong
        style={
          styles.position
        }
      >
        {player.position}
      </strong>


      <span
        style={
          styles.dataText
        }
      >
        {player.teamAbbreviation ??
          "FA"}
      </span>


      <span
        style={
          styles.dataText
        }
      >
        {player.byeWeek ??
          "—"}
      </span>


      <div
        style={
          styles.injuryCell
        }
      >
        {injury ? (
          <button
            type="button"
            title={`View ${injury.label} injury report`}
            style={{
              ...styles.injuryBadge,
              ...styles.injuryBadgeButton,
            }}
            onClick={
              () =>
                setInjuryReportOpen(
                  true
                )
            }
            aria-label={`View ${player.fullName} injury report`}
          >
            {injury.code}
          </button>
        ) : (
          <span
            style={
              styles.muted
            }
          >
            —
          </span>
        )}
      </div>


      <span
        style={
          styles.dataText
        }
      >
        {player.projectedPoints !==
        null
          ? player.projectedPoints.toFixed(
              1
            )
          : "—"}
      </span>


      <div
        style={
          styles.moveControls
        }
      >
        <button
          type="button"
          disabled={
            saving ||
            player.myRank <=
              1
          }
          onClick={
            () =>
              onMove(
                player.myRank -
                  1
              )
          }
          style={{
            ...styles.moveButton,

            ...(saving ||
            player.myRank <=
              1
              ? styles.disabledButton
              : {}),
          }}
          title="Move up one rank"
          aria-label={`Move ${player.fullName} up one rank`}
        >
          ↑
        </button>


        <button
          type="button"
          disabled={
            saving ||
            player.myRank >=
              totalPlayers
          }
          onClick={
            () =>
              onMove(
                player.myRank +
                  1
              )
          }
          style={{
            ...styles.moveButton,

            ...(saving ||
            player.myRank >=
              totalPlayers
              ? styles.disabledButton
              : {}),
          }}
          title="Move down one rank"
          aria-label={`Move ${player.fullName} down one rank`}
        >
          ↓
        </button>


        <input
          type="number"
          min={
            1
          }
          max={
            totalPlayers
          }
          value={
            rankInput
          }
          onChange={
            (
              event
            ) =>
              setRankInput(
                event.target.value
              )
          }
          onKeyDown={
            (
              event
            ) => {
              if (
                event.key ===
                "Enter"
              ) {
                submitRank();
              }
            }
          }
          style={
            styles.rankInput
          }
          aria-label={`New rank for ${player.fullName}`}
        />


        <button
          type="button"
          disabled={
            saving
          }
          onClick={
            submitRank
          }
          style={{
            ...styles.goButton,

            ...(saving
              ? styles.disabledButton
              : {}),
          }}
        >
          {saving
            ? "..."
            : "GO"}
        </button>
      </div>
    </article>
  );
}


const styles = {
  wrapper: {
    display:
      "grid",

    gap:
      "14px",
  },


  loadingCard: {
    minHeight:
      "190px",

    padding:
      "24px",

    display:
      "grid",

    placeContent:
      "center",

    gap:
      "8px",

    border:
      "1px solid rgba(255,115,20,.14)",

    borderRadius:
      "11px",

    background:
      "linear-gradient(145deg,#141415,#09090a)",

    textAlign:
      "center" as const,
  },


  loadingTitle: {
    color:
      "#ffffff",

    fontSize:
      "20px",
  },


  loadingText: {
    color:
      "#858c96",

    fontSize:
      "14px",
  },


  error: {
    padding:
      "12px 14px",

    border:
      "1px solid rgba(255,75,75,.22)",

    borderRadius:
      "8px",

    background:
      "rgba(200,25,25,.08)",

    color:
      "#ff7272",

    fontSize:
      "14px",
  },


  toolbar: {
    padding:
      "16px",

    display:
      "grid",

    gap:
      "13px",

    border:
      "1px solid rgba(255,255,255,.075)",

    borderRadius:
      "11px",

    background:
      "linear-gradient(145deg,#141415,#09090a)",
  },


  search: {
    width:
      "100%",

    minHeight:
      "44px",

    padding:
      "0 13px",

    border:
      "1px solid rgba(255,255,255,.09)",

    borderRadius:
      "8px",

    outline:
      "none",

    background:
      "#080809",

    color:
      "#ffffff",

    fontSize:
      "14px",
  },


  positionTabs: {
    display:
      "flex",

    gap:
      "6px",

    overflowX:
      "auto" as const,
  },


  positionButton: {
    minWidth:
      "48px",

    minHeight:
      "34px",

    padding:
      "0 11px",

    border:
      "1px solid rgba(255,255,255,.08)",

    borderRadius:
      "7px",

    background:
      "rgba(255,255,255,.025)",

    color:
      "#878e98",

    fontSize:
      "12px",

    fontWeight:
      900,

    cursor:
      "pointer",
  },


  positionButtonActive: {
    border:
      "1px solid rgba(255,95,20,.32)",

    background:
      "linear-gradient(135deg,rgba(190,20,20,.20),rgba(255,80,0,.12))",

    color:
      "#ffffff",
  },


  toolbarBottom: {
    display:
      "flex",

    alignItems:
      "end",

    justifyContent:
      "space-between",

    gap:
      "12px",

    flexWrap:
      "wrap" as const,
  },


  teamFilter: {
    minWidth:
      "180px",

    display:
      "grid",

    gap:
      "5px",

    color:
      "#6f7680",

    fontSize:
      "11px",

    fontWeight:
      900,

    letterSpacing:
      ".08em",
  },


  select: {
    minHeight:
      "38px",

    padding:
      "0 10px",

    border:
      "1px solid rgba(255,255,255,.08)",

    borderRadius:
      "7px",

    outline:
      "none",

    background:
      "#0a0a0b",

    color:
      "#d4d7db",

    fontSize:
      "13px",
  },


  resetButton: {
    minHeight:
      "38px",

    padding:
      "0 14px",

    border:
      "1px solid rgba(255,95,20,.25)",

    borderRadius:
      "7px",

    background:
      "rgba(255,70,0,.06)",

    color:
      "#ff8a2c",

    fontSize:
      "12px",

    fontWeight:
      900,

    cursor:
      "pointer",
  },


  resultBar: {
    display:
      "flex",

    alignItems:
      "center",

    gap:
      "5px",

    color:
      "#747b85",

    fontSize:
      "13px",
  },


  resultNumber: {
    color:
      "#ffffff",
  },


  tableShell: {
    overflow:
      "hidden",

    border:
      "1px solid rgba(255,255,255,.075)",

    borderRadius:
      "11px",

    background:
      "linear-gradient(145deg,#141415,#09090a)",
  },


  tableScroll: {
    width:
      "100%",

    overflowX:
      "auto" as const,
  },


  table: {
    minWidth:
      "1100px",
  },


  tableHeader: {
    minHeight:
      "42px",

    padding:
      "0 12px",

    display:
      "grid",

    gridTemplateColumns:
      "50px 50px minmax(240px,2fr) 55px 55px 50px 70px 80px 190px",

    alignItems:
      "center",

    gap:
      "9px",

    borderBottom:
      "1px solid rgba(255,255,255,.07)",

    background:
      "rgba(0,0,0,.18)",

    color:
      "#646b75",

    fontSize:
      "11px",

    fontWeight:
      900,

    letterSpacing:
      ".06em",
  },


  row: {
    minHeight:
      "66px",

    padding:
      "8px 12px",

    display:
      "grid",

    gridTemplateColumns:
      "50px 50px minmax(240px,2fr) 55px 55px 50px 70px 80px 190px",

    alignItems:
      "center",

    gap:
      "9px",

    borderBottom:
      "1px solid rgba(255,255,255,.05)",

    color:
      "#a7adb5",

    fontSize:
      "13px",
  },


  myRank: {
    color:
      "#ff7d20",

    fontSize:
      "16px",
  },


  defaultRank: {
    color:
      "#777e87",

    fontWeight:
      800,
  },


  playerIdentity: {
    minWidth:
      0,

    display:
      "flex",

    alignItems:
      "center",

    gap:
      "10px",
  },


  headshotWrap: {
    width:
      "46px",

    height:
      "46px",

    flex:
      "0 0 auto",

    overflow:
      "hidden",

    border:
      "1px solid rgba(255,255,255,.06)",

    borderRadius:
      "50%",

    background:
      "#18181a",
  },


  headshot: {
    width:
      "46px",

    height:
      "46px",

    objectFit:
      "cover" as const,
  },


  headshotFallback: {
    width:
      "100%",

    height:
      "100%",

    display:
      "grid",

    placeItems:
      "center",

    color:
      "#717883",

    fontSize:
      "11px",

    fontWeight:
      900,
  },


  playerNameButton: {
    width:
      "fit-content",

    maxWidth:
      "100%",

    padding:
      0,

    overflow:
      "hidden",

    border:
      0,

    background:
      "transparent",

    color:
      "#ffffff",

    font:
      "inherit",

    fontSize:
      "14px",

    fontWeight:
      900,

    textAlign:
      "left" as const,

    textOverflow:
      "ellipsis",

    whiteSpace:
      "nowrap" as const,

    cursor:
      "pointer",

    textDecoration:
      "underline",

    textDecorationColor:
      "rgba(255,120,35,.45)",

    textUnderlineOffset:
      "2px",
  },


  moveHeader: {
    width:
      "190px",

    textAlign:
      "left" as const,
  },


  profileOverlay: {
    position:
      "fixed" as const,

    inset:
      0,

    zIndex:
      1000,

    padding:
      "28px",

    display:
      "flex",

    alignItems:
      "center",

    justifyContent:
      "center",

    background:
      "rgba(0,0,0,.74)",

    backdropFilter:
      "blur(3px)",
  },


  profileModal: {
    width:
      "min(760px,96vw)",

    maxHeight:
      "88vh",

    overflowY:
      "auto" as const,

    border:
      "1px solid rgba(255,110,25,.18)",

    borderRadius:
      "10px",

    background:
      "linear-gradient(180deg,#17191c,#0f1113)",

    boxShadow:
      "0 24px 80px rgba(0,0,0,.5)",
  },


  profileHeader: {
    padding:
      "14px",

    display:
      "flex",

    alignItems:
      "center",

    justifyContent:
      "space-between",

    gap:
      "14px",

    borderBottom:
      "1px solid rgba(255,255,255,.06)",
  },


  profileIdentity: {
    display:
      "flex",

    alignItems:
      "center",

    gap:
      "12px",
  },


  profileAvatar: {
    width:
      "58px",

    height:
      "58px",

    flex:
      "0 0 auto",

    overflow:
      "hidden",

    borderRadius:
      "50%",

    background:
      "#18181a",
  },


  profileAvatarImage: {
    width:
      "58px",

    height:
      "58px",

    objectFit:
      "cover" as const,
  },


  profileAvatarFallback: {
    width:
      "100%",

    height:
      "100%",

    display:
      "grid",

    placeItems:
      "center",

    color:
      "#777f88",

    fontSize:
      "12px",

    fontWeight:
      900,
  },


  profileName: {
    color:
      "#f5f6f7",

    fontSize:
      "24px",

    fontWeight:
      1000,
  },


  profileMeta: {
    marginTop:
      "4px",

    color:
      "#9ba2aa",

    fontSize:
      "14px",
  },


  profileInjuryLine: {
    marginTop:
      "7px",

    display:
      "flex",

    alignItems:
      "center",

    gap:
      "7px",

    color:
      "#7d858e",

    fontSize:
      "13px",
  },


  injuryHealthy: {
    color:
      "#565c65",

    fontSize:
      "12px",
  },


  profileClose: {
    width:
      "34px",

    height:
      "34px",

    border:
      "1px solid rgba(255,255,255,.07)",

    borderRadius:
      "6px",

    background:
      "#1b1d20",

    color:
      "#c6cbd1",

    fontSize:
      "20px",

    cursor:
      "pointer",
  },


  profileLoading: {
    padding:
      "40px",

    color:
      "#8d949d",

    fontSize:
      "15px",

    textAlign:
      "center" as const,
  },


  profileContent: {
    padding:
      "12px",

    display:
      "grid",

    gap:
      "12px",
  },


  profileSection: {
    overflow:
      "hidden",

    border:
      "1px solid rgba(255,255,255,.055)",

    borderRadius:
      "7px",

    background:
      "#111315",
  },


  profileSectionHeader: {
    padding:
      "9px 10px",

    borderBottom:
      "1px solid rgba(255,255,255,.05)",

    color:
      "#ff7b22",

    fontSize:
      "14px",

    fontWeight:
      1000,
  },


  profileStatsGrid: {
    padding:
      "12px",

    display:
      "grid",

    gridTemplateColumns:
      "repeat(4,minmax(0,1fr))",

    gap:
      "7px",
  },


  profileStatCard: {
    minHeight:
      "92px",

    padding:
      "14px",

    display:
      "grid",

    alignContent:
      "center",

    justifyItems:
      "center",

    gap:
      "7px",

    border:
      "1px solid rgba(255,255,255,.05)",

    borderRadius:
      "6px",

    background:
      "#0d0f11",

    textAlign:
      "center" as const,
  },


  profileStatLabel: {
    color:
      "#8f969f",

    fontSize:
      "12px",

    fontWeight:
      850,

    lineHeight:
      1.2,

    textTransform:
      "uppercase" as const,

    letterSpacing:
      ".03em",
  },


  profileStatValue: {
    color:
      "#ffffff",

    fontSize:
      "24px",

    fontWeight:
      1000,

    lineHeight:
      1.05,
  },


  profileNoStats: {
    gridColumn:
      "1 / -1",

    padding:
      "25px",

    color:
      "#767e87",

    fontSize:
      "13px",

    textAlign:
      "center" as const,
  },


  projectionHero: {
    margin:
      "12px",

    padding:
      "20px",

    display:
      "grid",

    gap:
      "8px",

    border:
      "1px solid rgba(255,108,20,.13)",

    borderRadius:
      "7px",

    background:
      "linear-gradient(135deg,rgba(183,28,23,.12),rgba(255,102,12,.04))",

    textAlign:
      "center" as const,
  },


  projectionHeroLabel: {
    color:
      "#9ca3ab",

    fontSize:
      "12px",

    fontWeight:
      900,

    letterSpacing:
      ".04em",
  },


  projectionHeroValue: {
    color:
      "#ffffff",

    fontSize:
      "32px",

    fontWeight:
      1000,

    lineHeight:
      1,
  },


  profileProjectionNote: {
    padding:
      "0 12px 14px",

    color:
      "#737b84",

    fontSize:
      "12px",

    lineHeight:
      1.5,
  },


  playerName: {
    overflow:
      "hidden",

    color:
      "#ffffff",

    fontSize:
      "14px",

    textOverflow:
      "ellipsis",

    whiteSpace:
      "nowrap" as const,
  },


  position: {
    color:
      "#ff8423",
  },


  dataText: {
    color:
      "#a7adb5",
  },


  muted: {
    color:
      "#565c65",
  },


  injuryBadgeButton: {
    border:
      0,

    font:
      "inherit",

    lineHeight:
      1,

    cursor:
      "pointer",
  },


  injuryReportOverlay: {
    position:
      "fixed" as const,

    inset:
      0,

    zIndex:
      1300,

    padding:
      "24px",

    display:
      "flex",

    alignItems:
      "center",

    justifyContent:
      "center",

    background:
      "rgba(0,0,0,.82)",

    backdropFilter:
      "blur(5px)",
  },


  injuryReportModal: {
    width:
      "min(680px,96vw)",

    maxHeight:
      "86vh",

    overflowY:
      "auto" as const,

    border:
      "1px solid rgba(255,125,25,.22)",

    borderRadius:
      "12px",

    background:
      "linear-gradient(180deg,#17191c,#0d0f11)",

    boxShadow:
      "0 26px 90px rgba(0,0,0,.62)",
  },


  injuryReportHeader: {
    padding:
      "18px",

    display:
      "flex",

    alignItems:
      "flex-start",

    justifyContent:
      "space-between",

    gap:
      "16px",

    borderBottom:
      "1px solid rgba(255,255,255,.07)",
  },


  injuryReportEyebrow: {
    display:
      "block",

    marginBottom:
      "5px",

    color:
      "#ff8526",

    fontSize:
      "12px",

    fontWeight:
      1000,

    letterSpacing:
      ".08em",
  },


  injuryReportName: {
    display:
      "block",

    color:
      "#ffffff",

    fontSize:
      "24px",

    fontWeight:
      1000,
  },


  injuryReportMeta: {
    display:
      "block",

    marginTop:
      "5px",

    color:
      "#9ca3ad",

    fontSize:
      "14px",
  },


  injuryReportClose: {
    width:
      "38px",

    height:
      "38px",

    flex:
      "0 0 auto",

    border:
      "1px solid rgba(255,255,255,.08)",

    borderRadius:
      "7px",

    background:
      "#1a1c1f",

    color:
      "#d0d4da",

    fontSize:
      "22px",

    cursor:
      "pointer",
  },


  injuryReportBody: {
    padding:
      "18px",

    display:
      "grid",

    gap:
      "14px",
  },


  injuryReportStatusRow: {
    display:
      "flex",

    alignItems:
      "center",

    gap:
      "12px",
  },


  injuryReportStatusText: {
    display:
      "grid",

    gap:
      "2px",

    color:
      "#9aa1aa",

    fontSize:
      "13px",
  },


  injuryReportGrid: {
    display:
      "grid",

    gridTemplateColumns:
      "repeat(2,minmax(0,1fr))",

    gap:
      "9px",
  },


  injuryReportCard: {
    minHeight:
      "84px",

    padding:
      "12px",

    display:
      "grid",

    alignContent:
      "center",

    gap:
      "6px",

    border:
      "1px solid rgba(255,255,255,.055)",

    borderRadius:
      "7px",

    background:
      "#0d0f11",

    color:
      "#7e8690",

    fontSize:
      "11px",
  },


  injuryReportDetailCard: {
    padding:
      "15px",

    border:
      "1px solid rgba(255,125,25,.12)",

    borderRadius:
      "8px",

    background:
      "rgba(255,105,20,.04)",
  },


  injuryReportDetailLabel: {
    display:
      "block",

    marginBottom:
      "7px",

    color:
      "#ff8e2d",

    fontSize:
      "12px",

    fontWeight:
      1000,

    letterSpacing:
      ".06em",
  },


  injuryReportDetailText: {
    margin:
      0,

    color:
      "#e5e7eb",

    fontSize:
      "15px",

    lineHeight:
      1.55,
  },


  injuryCell: {
    minWidth:
      0,

    display:
      "flex",

    alignItems:
      "center",

    gap:
      "8px",

    overflow:
      "hidden",
  },


  injuryNews: {
    minWidth:
      0,

    overflow:
      "hidden",

    color:
      "#b5bbc3",

    fontSize:
      "12px",

    lineHeight:
      1.35,

    textOverflow:
      "ellipsis",

    whiteSpace:
      "nowrap" as const,
  },


  profileInjuryLabel: {
    color:
      "#d3d7dc",

    fontSize:
      "13px",

    fontWeight:
      800,
  },


  profileInjuryNews: {
    marginTop:
      "10px",

    maxWidth:
      "560px",

    padding:
      "11px 12px",

    display:
      "grid",

    gap:
      "5px",

    border:
      "1px solid rgba(255,145,35,.12)",

    borderRadius:
      "7px",

    background:
      "rgba(255,120,20,.045)",

    color:
      "#aeb4bd",

    fontSize:
      "13px",

    lineHeight:
      1.45,
  },


  profileInjuryNewsTitle: {
    color:
      "#ff932f",

    fontSize:
      "12px",

    fontWeight:
      1000,

    letterSpacing:
      ".04em",

    textTransform:
      "uppercase" as const,
  },


  profileInjuryDetail: {
    color:
      "#e1e4e8",

    fontSize:
      "14px",

    lineHeight:
      1.45,
  },


  profileInjuryReturn: {
    color:
      "#9097a1",

    fontSize:
      "12px",
  },


  injuryBadge: {
    minWidth:
      "25px",

    padding:
      "3px 5px",

    display:
      "inline-flex",

    justifyContent:
      "center",

    border:
      "1px solid rgba(255,150,30,.14)",

    borderRadius:
      "4px",

    background:
      "rgba(255,130,0,.08)",

    color:
      "#ff992b",

    fontSize:
      "11px",

    fontWeight:
      900,

    cursor:
      "help",
  },


  moveControls: {
    display:
      "grid",

    gridTemplateColumns:
      "32px 32px 66px 44px",

    gap:
      "5px",

    justifyContent:
      "start",
  },


  moveButton: {
    height:
      "32px",

    border:
      "1px solid rgba(255,255,255,.08)",

    borderRadius:
      "5px",

    background:
      "#191a1d",

    color:
      "#d6d9dd",

    fontSize:
      "16px",

    fontWeight:
      900,

    cursor:
      "pointer",
  },


  rankInput: {
    width:
      "66px",

    minHeight:
      "32px",

    padding:
      "0 6px",

    border:
      "1px solid rgba(255,255,255,.08)",

    borderRadius:
      "5px",

    outline:
      "none",

    background:
      "#09090a",

    color:
      "#ffffff",

    fontSize:
      "13px",

    textAlign:
      "center" as const,
  },


  goButton: {
    minHeight:
      "32px",

    border:
      "1px solid rgba(255,95,20,.25)",

    borderRadius:
      "5px",

    background:
      "linear-gradient(135deg,#b81818,#ef4e00)",

    color:
      "#ffffff",

    fontSize:
      "11px",

    fontWeight:
      900,

    cursor:
      "pointer",
  },


  disabledButton: {
    opacity:
      0.45,

    cursor:
      "not-allowed",
  },


  empty: {
    padding:
      "40px 20px",

    color:
      "#777e87",

    fontSize:
      "14px",

    textAlign:
      "center" as const,
  },
};