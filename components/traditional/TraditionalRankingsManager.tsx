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
    null,
  injuryType?:
    string |
    null,
  injuryLocation?:
    string |
    null,
  injuryDetail?:
    string |
    null
) {
  const value =
    (status ?? "")
      .trim()
      .toUpperCase();

  if (
    !value ||
    ["ACTIVE", "HEALTHY", "NORMAL"].includes(value)
  ) {
    return null;
  }

  let code = value;
  let label = status ?? "Injury status";

  if (value === "Q" || value.includes("QUESTION")) {
    code = "Q";
    label = "Questionable";
  } else if (value === "D" || value.includes("DOUBT")) {
    code = "D";
    label = "Doubtful";
  } else if (value === "O" || value.includes("OUT")) {
    code = "OUT";
    label = "Out";
  } else if (value === "IR" || value.includes("INJURED RESERVE")) {
    code = "IR";
    label = "Injured Reserve";
  } else if (value === "PUP" || value.includes("PHYSICALLY UNABLE")) {
    code = "PUP";
    label = "Physically Unable to Perform";
  } else if (value === "NFI" || value.includes("NON-FOOTBALL")) {
    code = "NFI";
    label = "Non-Football Injury";
  } else if (
    value === "SUS" ||
    value === "SUSP" ||
    value.includes("SUSPEND")
  ) {
    code = "SUSP";
    label = "Suspended";
  } else if (
    value === "DTD" ||
    value.includes("DAY-TO-DAY") ||
    value.includes("DAY TO DAY")
  ) {
    code = "DTD";
    label = "Day-to-Day";
  } else if (value.length > 6) {
    code = "INJ";
  }

  const extras = [injuryType, injuryLocation, injuryDetail]
    .map((item) => item?.trim() ?? "")
    .filter((item, index, values) => item && values.indexOf(item) === index);

  const detailText = extras.length > 0
    ? `${label} · ${extras.join(" · ")}`
    : label;

  return {
    code,
    label,
    detailText,
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

              <span>
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


function RankingRow({
  player,
  totalPlayers,
  saving,
  onMove,
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


  const [
    showInjuryDetail,
    setShowInjuryDetail,
  ] = useState(false);


  const injury =
    getInjuryDisplay(
      player.injuryStatus,
      player.injuryType,
      player.injuryLocation,
      player.injuryDetail
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


        <strong
          style={
            styles.playerName
          }
        >
          {player.fullName}
        </strong>
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


      <span
        style={
          styles.injuryCell
        }
      >
        {injury ? (
          <>
            <button
              type="button"
              aria-expanded={showInjuryDetail}
              aria-label={`${injury.label}. Tap for injury details.`}
              title={injury.detailText}
              onClick={() =>
                setShowInjuryDetail(
                  (current) => !current
                )
              }
              style={{
                ...styles.injuryBadge,
                ...styles.injuryButton,
              }}
            >
              {injury.code}
            </button>

            {showInjuryDetail ? (
              <span
                style={
                  styles.injuryExpandedDetail
                }
              >
                {injury.detailText}
              </span>
            ) : null}
          </>
        ) : (
          <span
            style={
              styles.muted
            }
          >
            —
          </span>
        )}
      </span>


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
      "17px",
  },


  loadingText: {
    color:
      "#858c96",

    fontSize:
      "11px",
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
      "11px",
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
      "12px",
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
      "9px",

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
      "8px",

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
      "10px",
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
      "9px",

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
      "10px",
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
      "1050px",
  },


  tableHeader: {
    minHeight:
      "42px",

    padding:
      "0 12px",

    display:
      "grid",

    gridTemplateColumns:
      "50px 50px minmax(240px,2fr) 55px 55px 50px 50px 70px minmax(190px,1fr)",

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
      "8px",

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
      "50px 50px minmax(240px,2fr) 55px 55px 50px 50px 70px minmax(190px,1fr)",

    alignItems:
      "center",

    gap:
      "9px",

    borderBottom:
      "1px solid rgba(255,255,255,.05)",

    color:
      "#a7adb5",

    fontSize:
      "10px",
  },


  myRank: {
    color:
      "#ff7d20",

    fontSize:
      "14px",
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
      "8px",

    fontWeight:
      900,
  },


  playerName: {
    overflow:
      "hidden",

    color:
      "#ffffff",

    fontSize:
      "11px",

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


  injuryCell: {
    minWidth:
      0,

    display:
      "flex",

    alignItems:
      "center",

    gap:
      "5px",

    flexWrap:
      "wrap" as const,
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
      "8px",

    fontWeight:
      900,

    cursor:
      "pointer",
  },


  injuryButton: {
    appearance:
      "none" as const,

    fontFamily:
      "inherit",

    lineHeight:
      1,
  },


  injuryExpandedDetail: {
    width:
      "100%",

    color:
      "#ffd3a1",

    fontSize:
      "9px",

    fontWeight:
      800,

    lineHeight:
      1.3,
  },


  moveControls: {
    display:
      "grid",

    gridTemplateColumns:
      "32px 32px 66px 44px",

    gap:
      "5px",

    justifyContent:
      "end",
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
      "14px",

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
      "10px",

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
      "8px",

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
      "11px",

    textAlign:
      "center" as const,
  },
};
