"use client";

import {
  useMemo,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import MessageBox from "@/components/ui/MessageBox";

import {
  createSupabaseBrowserClient,
} from "@/lib/supabase/browser";


type PlayerSelectionMode =
  "salary" |
  "no_salary" |
  "draft";


type Settings = {
  weeklySalaryCap:
    number;

  startingQb:
    number;

  startingRb:
    number;

  startingWr:
    number;

  startingTe:
    number;

  startingFlex:
    number;

  startingSuperflex:
    number;

  startingK:
    number;

  startingDst:
    number;
};


type Entry = {
  status:
    string | null;

  salaryUsed:
    number | null;

  projectedPoints:
    number;

  submittedAt:
    string | null;
};


type LineupPlayer = {
  playerId:
    number;

  name:
    string;

  position:
    string;

  teamAbbreviation:
    string | null;

  injuryStatus:
    string | null;

  byeWeek:
    number | null;

  lineupSlot:
    string;

  slotIndex:
    number;

  salary:
    number | null;

  projectedPoints:
    number;

  isLocked:
    boolean;

  lockedAt:
    string | null;

  nflGameId:
    number | null;

  gameStartAt:
    string | null;

  opponentAbbreviation:
    string | null;

  homeOrAway:
    string | null;
};


type PoolPlayer = {
  id:
    number;

  name:
    string;

  position:
    string;

  teamAbbreviation:
    string | null;

  injuryStatus:
    string | null;

  byeWeek:
    number | null;

  salary:
    number | null;

  projectedPoints:
    number;

  salaryChange:
    number | null;

  salaryChangePercent:
    number | null;

  isActive:
    boolean;
};


type SlotDefinition = {
  slot:
    string;

  index:
    number;

  label:
    string;
};


type Props = {
  leagueId:
    string;

  leagueName:
    string;

  fantasyTeamId:
    number;

  fantasyTeamName:
    string;

  season:
    number;

  week:
    number;

  playerSelectionMode:
    PlayerSelectionMode;

  settings:
    Settings;

  entry:
    Entry | null;

  initialLineup:
    LineupPlayer[];

  playerPool:
    PoolPlayer[];
};


const POSITION_FILTERS = [
  "ALL",
  "QB",
  "RB",
  "WR",
  "TE",
  "K",
  "DST",
] as const;


function normalizePosition(
  value:
    string
) {
  const upper =
    value.toUpperCase();

  return upper ===
    "PK"
      ? "K"
      : upper;
}


function isEligibleForSlot(
  position:
    string,
  slot:
    string
) {
  const normalizedPosition =
    normalizePosition(
      position
    );

  const normalizedSlot =
    slot.toUpperCase();


  if (
    normalizedSlot ===
    "FLEX"
  ) {
    return [
      "RB",
      "WR",
      "TE",
    ].includes(
      normalizedPosition
    );
  }


  if (
    normalizedSlot ===
    "SUPERFLEX"
  ) {
    return [
      "QB",
      "RB",
      "WR",
      "TE",
    ].includes(
      normalizedPosition
    );
  }


  if (
    normalizedSlot ===
    "DST"
  ) {
    return normalizedPosition ===
      "DST";
  }


  return normalizedPosition ===
    normalizedSlot;
}


function formatMoney(
  value:
    number
) {
  return new Intl.NumberFormat(
    "en-US",
    {
      style:
        "currency",

      currency:
        "USD",

      maximumFractionDigits:
        0,
    }
  ).format(
    value
  );
}


function formatPoints(
  value:
    number
) {
  return Number(
    value ?? 0
  ).toFixed(
    2
  );
}


function formatStatus(
  value:
    string | null
) {
  if (
    !value
  ) {
    return "Not Submitted";
  }


  return value
    .replaceAll(
      "_",
      " "
    )
    .replace(
      /\b\w/g,
      (
        character
      ) =>
        character.toUpperCase()
    );
}


function buildSlots(
  settings:
    Settings
) {
  const definitions:
    Array<{
      slot:
        string;

      label:
        string;

      count:
        number;
    }> = [
      {
        slot:
          "QB",

        label:
          "QB",

        count:
          settings.startingQb,
      },

      {
        slot:
          "RB",

        label:
          "RB",

        count:
          settings.startingRb,
      },

      {
        slot:
          "WR",

        label:
          "WR",

        count:
          settings.startingWr,
      },

      {
        slot:
          "TE",

        label:
          "TE",

        count:
          settings.startingTe,
      },

      {
        slot:
          "FLEX",

        label:
          "FLEX",

        count:
          settings.startingFlex,
      },

      {
        slot:
          "SUPERFLEX",

        label:
          "SUPERFLEX",

        count:
          settings.startingSuperflex,
      },

      {
        slot:
          "K",

        label:
          "K",

        count:
          settings.startingK,
      },

      {
        slot:
          "DST",

        label:
          "DST",

        count:
          settings.startingDst,
      },
    ];


  const slots:
    SlotDefinition[] = [];


  for (
    const definition of
      definitions
  ) {
    for (
      let index = 1;
      index <=
        definition.count;
      index += 1
    ) {
      slots.push({
        slot:
          definition.slot,

        index,

        label:
          definition.count >
          1
            ? `${definition.label} ${index}`
            : definition.label,
      });
    }
  }


  return slots;
}


export default function SeasonLongWeeklyLineup({
  leagueId,
  leagueName,
  fantasyTeamId,
  fantasyTeamName,
  season,
  week,
  playerSelectionMode,
  settings,
  entry,
  initialLineup,
  playerPool,
}: Props) {
  const router =
    useRouter();


  const supabase =
    useMemo(
      () =>
        createSupabaseBrowserClient(),
      []
    );


  const slots =
    useMemo(
      () =>
        buildSlots(
          settings
        ),
      [
        settings,
      ]
    );


  const [
    activeSlot,
    setActiveSlot,
  ] =
    useState<
      SlotDefinition | null
    >(
      null
    );


  const [
    search,
    setSearch,
  ] =
    useState("");


  const [
    positionFilter,
    setPositionFilter,
  ] =
    useState<
      typeof POSITION_FILTERS[number]
    >(
      "ALL"
    );


  const [
    workingKey,
    setWorkingKey,
  ] =
    useState<
      string | null
    >(
      null
    );


  const [
    message,
    setMessage,
  ] =
    useState("");


  const [
    isError,
    setIsError,
  ] =
    useState(false);


  const [
    teamName,
    setTeamName,
  ] =
    useState(
      fantasyTeamName
    );


  const [
    teamNameDraft,
    setTeamNameDraft,
  ] =
    useState(
      fantasyTeamName
    );


  const [
    editingTeamName,
    setEditingTeamName,
  ] =
    useState(false);


  const [
    savingTeamName,
    setSavingTeamName,
  ] =
    useState(false);


  const [
    teamNameMessage,
    setTeamNameMessage,
  ] =
    useState("");


  const [
    teamNameError,
    setTeamNameError,
  ] =
    useState(false);


  const isSalary =
    playerSelectionMode ===
    "salary";


  const selectedPlayerIds =
    new Set(
      initialLineup.map(
        (
          player
        ) =>
          player.playerId
      )
    );


  const lineupBySlot =
    new Map<
      string,
      LineupPlayer
    >(
      initialLineup.map(
        (
          player
        ) => [
          `${player.lineupSlot}:${player.slotIndex}`,
          player,
        ]
      )
    );


  const salaryUsed =
    initialLineup.reduce(
      (
        total,
        player
      ) =>
        total +
        (
          player.salary ??
          0
        ),
      0
    );


  const salaryRemaining =
    settings.weeklySalaryCap -
    salaryUsed;


  const projectedPoints =
    initialLineup.reduce(
      (
        total,
        player
      ) =>
        total +
        player.projectedPoints,
      0
    );


  const filledSlots =
    slots.filter(
      (
        slot
      ) =>
        lineupBySlot.has(
          `${slot.slot}:${slot.index}`
        )
    ).length;


  const lineupComplete =
    filledSlots ===
    slots.length &&
    slots.length >
      0;


  const overSalaryCap =
    isSalary &&
    salaryUsed >
      settings.weeklySalaryCap;


  const filteredPlayers =
    playerPool
      .filter(
        (
          player
        ) => {
          if (
            !player.isActive
          ) {
            return false;
          }


          if (
            selectedPlayerIds.has(
              player.id
            )
          ) {
            return false;
          }


          if (
            activeSlot &&
            !isEligibleForSlot(
              player.position,
              activeSlot.slot
            )
          ) {
            return false;
          }


          const normalizedPosition =
            normalizePosition(
              player.position
            );


          if (
            positionFilter !==
              "ALL" &&
            normalizedPosition !==
              positionFilter
          ) {
            return false;
          }


          const normalizedSearch =
            search
              .trim()
              .toLowerCase();


          if (
            normalizedSearch
          ) {
            const haystack =
              [
                player.name,
                player.teamAbbreviation ??
                  "",
                normalizedPosition,
              ]
                .join(
                  " "
                )
                .toLowerCase();


            if (
              !haystack.includes(
                normalizedSearch
              )
            ) {
              return false;
            }
          }


          if (
            isSalary &&
            activeSlot &&
            (
              player.salary ??
              0
            ) >
              salaryRemaining
          ) {
            return false;
          }


          return true;
        }
      )
      .slice(
        0,
        250
      );


  async function addPlayer(
    player:
      PoolPlayer
  ) {
    if (
      !activeSlot
    ) {
      setIsError(true);
      setMessage(
        "Select a lineup slot first."
      );

      return;
    }


    const key =
      `add:${player.id}`;


    setWorkingKey(
      key
    );

    setMessage("");
    setIsError(false);


    try {
      const {
        data,
        error,
      } =
        await supabase.rpc(
          "set_season_long_lineup_player",
          {
            p_league_id:
              leagueId,

            p_fantasy_team_id:
              fantasyTeamId,

            p_season:
              season,

            p_week:
              week,

            p_player_id:
              player.id,

            p_target_slot:
              activeSlot.slot,

            p_target_slot_index:
              activeSlot.index,
          }
        );


      if (
        error
      ) {
        throw new Error(
          error.message
        );
      }


      const result =
        data as {
          success?:
            boolean;

          error?:
            string;

          message?:
            string;
        } | null;


      if (
        result &&
        result.success ===
          false
      ) {
        throw new Error(
          result.error ??
          result.message ??
          "The player could not be added."
        );
      }


      setActiveSlot(
        null
      );

      setMessage(
        `${player.name} was added to your lineup.`
      );

      router.refresh();

    } catch (
      error
    ) {
      setIsError(true);

      setMessage(
        error instanceof
        Error
          ? error.message
          : "The player could not be added."
      );

    } finally {
      setWorkingKey(
        null
      );
    }
  }


  async function removePlayer(
    player:
      LineupPlayer
  ) {
    if (
      player.isLocked
    ) {
      return;
    }


    const key =
      `remove:${player.playerId}`;


    setWorkingKey(
      key
    );

    setMessage("");
    setIsError(false);


    try {
      const {
        data,
        error,
      } =
        await supabase.rpc(
          "remove_season_long_lineup_player",
          {
            p_league_id:
              leagueId,

            p_fantasy_team_id:
              fantasyTeamId,

            p_season:
              season,

            p_week:
              week,

            p_lineup_slot:
              player.lineupSlot,

            p_slot_index:
              player.slotIndex,
          }
        );


      if (
        error
      ) {
        throw new Error(
          error.message
        );
      }


      const result =
        data as {
          success?:
            boolean;

          error?:
            string;

          message?:
            string;
        } | null;


      if (
        result &&
        result.success ===
          false
      ) {
        throw new Error(
          result.error ??
          result.message ??
          "The player could not be removed."
        );
      }


      setMessage(
        `${player.name} was removed from your lineup.`
      );

      router.refresh();

    } catch (
      error
    ) {
      setIsError(true);

      setMessage(
        error instanceof
        Error
          ? error.message
          : "The player could not be removed."
      );

    } finally {
      setWorkingKey(
        null
      );
    }
  }


  async function submitLineup() {
    setWorkingKey(
      "submit"
    );

    setMessage("");
    setIsError(false);


    try {
      /*
       * Validate first so the owner gets the most useful
       * error list before submission.
       */
      const validationResult =
        await supabase.rpc(
          "validate_season_long_weekly_lineup",
          {
            p_league_id:
              leagueId,

            p_fantasy_team_id:
              fantasyTeamId,

            p_season:
              season,

            p_week:
              week,
          }
        );


      if (
        validationResult.error
      ) {
        throw new Error(
          validationResult
            .error
            .message
        );
      }


      const validation =
        validationResult.data as {
          valid?:
            boolean;

          errors?:
            string[];

          warnings?:
            string[];
        } | null;


      if (
        !validation?.valid
      ) {
        throw new Error(
          validation
            ?.errors
            ?.join(
              " "
            ) ??
          "Your weekly lineup is not valid yet."
        );
      }


      const submitResult =
        await supabase.rpc(
          "submit_season_long_weekly_lineup",
          {
            p_league_id:
              leagueId,

            p_fantasy_team_id:
              fantasyTeamId,

            p_season:
              season,

            p_week:
              week,
          }
        );


      if (
        submitResult.error
      ) {
        throw new Error(
          submitResult
            .error
            .message
        );
      }


      const result =
        submitResult.data as {
          success?:
            boolean;

          submitted?:
            boolean;

          validation?:
            {
              errors?:
                string[];
            };
        } | null;


      if (
        !result?.success ||
        result.submitted ===
          false
      ) {
        throw new Error(
          result
            ?.validation
            ?.errors
            ?.join(
              " "
            ) ??
          "The weekly lineup could not be submitted."
        );
      }


      setMessage(
        `Week ${week} lineup submitted successfully.`
      );

      router.refresh();

    } catch (
      error
    ) {
      setIsError(true);

      setMessage(
        error instanceof
        Error
          ? error.message
          : "The weekly lineup could not be submitted."
      );

    } finally {
      setWorkingKey(
        null
      );
    }
  }


  async function saveTeamName() {
    const nextTeamName =
      teamNameDraft
        .trim()
        .replace(
          /\s+/g,
          " "
        );


    setTeamNameMessage("");
    setTeamNameError(false);


    if (!nextTeamName) {
      setTeamNameError(true);
      setTeamNameMessage(
        "Team name cannot be blank."
      );
      return;
    }


    if (
      nextTeamName.length >
      40
    ) {
      setTeamNameError(true);
      setTeamNameMessage(
        "Team name must be 40 characters or fewer."
      );
      return;
    }


    if (
      nextTeamName ===
      teamName
    ) {
      setEditingTeamName(false);
      return;
    }


    setSavingTeamName(true);


    try {
      const {
        data: sessionData,
        error: sessionError,
      } =
        await supabase.auth.getSession();


      const accessToken =
        sessionData.session
          ?.access_token;


      if (
        sessionError ||
        !accessToken
      ) {
        throw new Error(
          sessionError?.message ??
            "Your login session is missing. Please sign in again."
        );
      }


      const response =
        await fetch(
          `/api/leagues/${leagueId}/team-name`,
          {
            method: "POST",
            headers: {
              "content-type":
                "application/json",
              authorization:
                `Bearer ${accessToken}`,
            },
            body:
              JSON.stringify({
                fantasyTeamId,
                teamName:
                  nextTeamName,
              }),
          }
        );


      const payload =
        (await response.json()) as {
          success?: boolean;
          teamName?: string;
          error?: string;
        };


      if (
        !response.ok ||
        !payload.success
      ) {
        throw new Error(
          payload.error ??
            "The team name could not be changed."
        );
      }


      const savedName =
        payload.teamName ??
        nextTeamName;


      setTeamName(
        savedName
      );
      setTeamNameDraft(
        savedName
      );
      setEditingTeamName(false);
      setTeamNameError(false);
      setTeamNameMessage(
        "Team name updated."
      );


      router.refresh();
    } catch (error) {
      setTeamNameError(true);
      setTeamNameMessage(
        error instanceof Error
          ? error.message
          : "The team name could not be changed."
      );
    } finally {
      setSavingTeamName(false);
    }
  }


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
            styles.pageHeader
          }
        >
          <div>
            <p
              style={
                styles.eyebrow
              }
            >
              SEASON-LONG • WEEK {week}
            </p>

            <h1
              style={
                styles.title
              }
            >
              My Entry
            </h1>

            <div
              style={
                styles.teamNameArea
              }
            >
              <div
                style={
                  styles.teamNameSummary
                }
              >
                <p
                  style={
                    styles.subtitle
                  }
                >
                  <strong
                    style={
                      styles.teamNameText
                    }
                  >
                    {teamName}
                  </strong>
                  {" • "}
                  {leagueName}
                </p>

                {!editingTeamName ? (
                  <button
                    type="button"
                    onClick={() => {
                      setTeamNameDraft(
                        teamName
                      );
                      setTeamNameMessage(
                        ""
                      );
                      setTeamNameError(
                        false
                      );
                      setEditingTeamName(
                        true
                      );
                    }}
                    style={
                      styles.changeTeamNameButton
                    }
                  >
                    CHANGE TEAM NAME
                  </button>
                ) : null}
              </div>

              {editingTeamName ? (
                <div
                  style={
                    styles.teamNameEditor
                  }
                >
                  <input
                    type="text"
                    value={
                      teamNameDraft
                    }
                    maxLength={40}
                    autoFocus
                    onChange={(event) =>
                      setTeamNameDraft(
                        event.target.value
                      )
                    }
                    onKeyDown={(event) => {
                      if (
                        event.key ===
                        "Enter"
                      ) {
                        event.preventDefault();
                        void saveTeamName();
                      }

                      if (
                        event.key ===
                        "Escape"
                      ) {
                        setTeamNameDraft(
                          teamName
                        );
                        setEditingTeamName(
                          false
                        );
                        setTeamNameMessage(
                          ""
                        );
                        setTeamNameError(
                          false
                        );
                      }
                    }}
                    aria-label="Team name"
                    style={
                      styles.teamNameInput
                    }
                  />

                  <button
                    type="button"
                    disabled={
                      savingTeamName
                    }
                    onClick={() =>
                      void saveTeamName()
                    }
                    style={{
                      ...styles.saveTeamNameButton,
                      ...(savingTeamName
                        ? styles.teamNameButtonDisabled
                        : {}),
                    }}
                  >
                    {savingTeamName
                      ? "SAVING…"
                      : "SAVE TEAM NAME"}
                  </button>

                  <button
                    type="button"
                    disabled={
                      savingTeamName
                    }
                    onClick={() => {
                      setTeamNameDraft(
                        teamName
                      );
                      setEditingTeamName(
                        false
                      );
                      setTeamNameMessage(
                        ""
                      );
                      setTeamNameError(
                        false
                      );
                    }}
                    style={
                      styles.cancelTeamNameButton
                    }
                  >
                    CANCEL
                  </button>
                </div>
              ) : null}

              {teamNameMessage ? (
                <div
                  style={{
                    ...styles.teamNameMessage,
                    ...(teamNameError
                      ? styles.teamNameMessageError
                      : styles.teamNameMessageSuccess),
                  }}
                >
                  {teamNameMessage}
                </div>
              ) : null}
            </div>
          </div>


          <div
            style={
              styles.headerBadges
            }
          >
            <span
              style={
                styles.modeBadge
              }
            >
              {isSalary
                ? "SALARY CAP"
                : "NO SALARY CAP"}
            </span>

            <span
              style={
                styles.statusBadge
              }
            >
              {formatStatus(
                entry
                  ?.status ??
                null
              )}
            </span>
          </div>
        </header>


        <section
          style={
            styles.summaryGrid
          }
        >
          <SummaryCard
            label="LINEUP"
            value={`${filledSlots}/${slots.length}`}
            subtitle={
              lineupComplete
                ? "Complete"
                : `${Math.max(
                    slots.length -
                    filledSlots,
                    0
                  )} slots remaining`
            }
          />

          <SummaryCard
            label="PROJECTED"
            value={
              formatPoints(
                projectedPoints
              )
            }
            subtitle="Weekly fantasy points"
          />

          {isSalary ? (
            <>
              <SummaryCard
                label="SALARY USED"
                value={
                  formatMoney(
                    salaryUsed
                  )
                }
                subtitle={
                  `Cap ${formatMoney(
                    settings.weeklySalaryCap
                  )}`
                }
              />

              <SummaryCard
                label="REMAINING"
                value={
                  formatMoney(
                    salaryRemaining
                  )
                }
                subtitle={
                  overSalaryCap
                    ? "Over salary cap"
                    : "Available salary"
                }
                danger={
                  overSalaryCap
                }
              />
            </>
          ) : (
            <SummaryCard
              label="PLAYER ACCESS"
              value="OPEN"
              subtitle="No salary restriction"
            />
          )}
        </section>


        <MessageBox
          message={
            message
          }
          type={
            isError
              ? "error"
              : "success"
          }
        />


        <section
          style={
            styles.workspace
          }
        >
          {/* ==============================================
              WEEKLY LINEUP
          =============================================== */}

          <Card
            style={
              styles.lineupCard
            }
          >
            <div
              style={
                styles.cardHeader
              }
            >
              <div>
                <p
                  style={
                    styles.cardEyebrow
                  }
                >
                  WEEK {week}
                </p>

                <h2
                  style={
                    styles.cardTitle
                  }
                >
                  Weekly Lineup
                </h2>
              </div>

              <span
                style={
                  styles.cardHelper
                }
              >
                Select a slot, then choose a player.
              </span>
            </div>


            <div
              style={
                styles.slotList
              }
            >
              {slots.map(
                (
                  slot
                ) => {
                  const slotKey =
                    `${slot.slot}:${slot.index}`;

                  const player =
                    lineupBySlot.get(
                      slotKey
                    );

                  const selected =
                    activeSlot
                      ?.slot ===
                      slot.slot &&
                    activeSlot
                      ?.index ===
                      slot.index;


                  return (
                    <div
                      key={
                        slotKey
                      }
                      style={{
                        ...styles.slotRow,

                        ...(selected
                          ? styles.slotRowSelected
                          : {}),
                      }}
                    >
                      <div
                        style={
                          styles.slotLabel
                        }
                      >
                        {slot.label}
                      </div>


                      {player ? (
                        <>
                          <div
                            style={
                              styles.playerIdentity
                            }
                          >
                            <strong>
                              {player.name}
                            </strong>

                            <span>
                              {normalizePosition(
                                player.position
                              )}
                              {" • "}
                              {player.teamAbbreviation ??
                                "FA"}

                              {player.opponentAbbreviation
                                ? ` • ${player.homeOrAway ===
                                    "away"
                                      ? "@"
                                      : "vs"} ${player.opponentAbbreviation}`
                                : ""}
                            </span>
                          </div>


                          <div
                            style={
                              styles.playerMeta
                            }
                          >
                            {isSalary ? (
                              <strong>
                                {formatMoney(
                                  player.salary ??
                                  0
                                )}
                              </strong>
                            ) : null}

                            <span>
                              {formatPoints(
                                player.projectedPoints
                              )} proj.
                            </span>
                          </div>


                          <div
                            style={
                              styles.slotAction
                            }
                          >
                            {player.isLocked ? (
                              <span
                                style={
                                  styles.lockedBadge
                                }
                              >
                                LOCKED
                              </span>
                            ) : (
                              <button
                                type="button"
                                disabled={
                                  workingKey !==
                                  null
                                }
                                onClick={
                                  () =>
                                    removePlayer(
                                      player
                                    )
                                }
                                style={
                                  styles.removeButton
                                }
                              >
                                {workingKey ===
                                `remove:${player.playerId}`
                                  ? "Removing..."
                                  : "Remove"}
                              </button>
                            )}
                          </div>
                        </>
                      ) : (
                        <>
                          <div
                            style={
                              styles.emptyPlayer
                            }
                          >
                            Empty
                          </div>

                          <div />

                          <div
                            style={
                              styles.slotAction
                            }
                          >
                            <button
                              type="button"
                              onClick={
                                () =>
                                  setActiveSlot(
                                    slot
                                  )
                              }
                              style={
                                selected
                                  ? styles.selectSlotButtonActive
                                  : styles.selectSlotButton
                              }
                            >
                              {selected
                                ? "Selecting"
                                : "Select Player"}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                }
              )}
            </div>


            <div
              style={
                styles.submitArea
              }
            >
              <div
                style={
                  styles.submitCopy
                }
              >
                <strong>
                  Submit Week {week}
                </strong>

                <span>
                  You can continue changing unlocked players until
                  their individual NFL games begin.
                </span>
              </div>

              <Button
                type="button"
                onClick={
                  submitLineup
                }
                disabled={
                  workingKey !==
                    null ||
                  !lineupComplete ||
                  overSalaryCap
                }
                style={
                  styles.submitButton
                }
              >
                {workingKey ===
                "submit"
                  ? "Submitting..."
                  : entry?.status ===
                      "submitted"
                    ? "Resubmit Lineup"
                    : "Submit Lineup"}
              </Button>
            </div>
          </Card>


          {/* ==============================================
              PLAYER POOL
          =============================================== */}

          <Card
            style={
              styles.poolCard
            }
          >
            <div
              style={
                styles.cardHeader
              }
            >
              <div>
                <p
                  style={
                    styles.cardEyebrow
                  }
                >
                  PLAYER POOL
                </p>

                <h2
                  style={
                    styles.cardTitle
                  }
                >
                  Available Players
                </h2>
              </div>

              {activeSlot ? (
                <span
                  style={
                    styles.activeSlotBadge
                  }
                >
                  SELECTING {activeSlot.label}
                </span>
              ) : (
                <span
                  style={
                    styles.cardHelper
                  }
                >
                  Choose a lineup slot first.
                </span>
              )}
            </div>


            <div
              style={
                styles.poolControls
              }
            >
              <input
                type="search"
                value={
                  search
                }
                onChange={(
                  event
                ) =>
                  setSearch(
                    event
                      .target
                      .value
                  )
                }
                placeholder="Search player, team, or position..."
                style={
                  styles.searchInput
                }
              />

              <div
                style={
                  styles.filterRow
                }
              >
                {POSITION_FILTERS.map(
                  (
                    filter
                  ) => (
                    <button
                      key={
                        filter
                      }
                      type="button"
                      onClick={
                        () =>
                          setPositionFilter(
                            filter
                          )
                      }
                      style={
                        positionFilter ===
                        filter
                          ? styles.filterButtonActive
                          : styles.filterButton
                      }
                    >
                      {filter}
                    </button>
                  )
                )}
              </div>
            </div>


            <div
              style={
                styles.poolHeader
              }
            >
              <span>
                PLAYER
              </span>

              {isSalary ? (
                <span>
                  SALARY
                </span>
              ) : null}

              <span>
                PROJ
              </span>

              <span />
            </div>


            <div
              style={
                styles.playerList
              }
            >
              {filteredPlayers.length ===
              0 ? (
                <div
                  style={
                    styles.emptyPool
                  }
                >
                  {activeSlot
                    ? "No eligible players match the current filters."
                    : "Select a lineup slot to begin building your entry."}
                </div>
              ) : (
                filteredPlayers.map(
                  (
                    player
                  ) => {
                    const disabled =
                      !activeSlot ||
                      workingKey !==
                        null;


                    return (
                      <div
                        key={
                          player.id
                        }
                        style={
                          styles.poolRow
                        }
                      >
                        <div
                          style={
                            styles.poolIdentity
                          }
                        >
                          <strong>
                            {player.name}
                          </strong>

                          <span>
                            {normalizePosition(
                              player.position
                            )}
                            {" • "}
                            {player.teamAbbreviation ??
                              "FA"}

                            {player.injuryStatus
                              ? ` • ${player.injuryStatus}`
                              : ""}
                          </span>
                        </div>


                        {isSalary ? (
                          <div
                            style={
                              styles.poolSalary
                            }
                          >
                            <strong>
                              {formatMoney(
                                player.salary ??
                                0
                              )}
                            </strong>

                            {player.salaryChange !==
                              null &&
                            player.salaryChange !==
                              0 ? (
                              <span>
                                {player.salaryChange >
                                0
                                  ? "+"
                                  : ""}
                                {formatMoney(
                                  player.salaryChange
                                )}
                              </span>
                            ) : null}
                          </div>
                        ) : null}


                        <strong
                          style={
                            styles.poolProjection
                          }
                        >
                          {formatPoints(
                            player.projectedPoints
                          )}
                        </strong>


                        <button
                          type="button"
                          disabled={
                            disabled
                          }
                          onClick={
                            () =>
                              addPlayer(
                                player
                              )
                          }
                          style={{
                            ...styles.addButton,

                            ...(disabled
                              ? styles.addButtonDisabled
                              : {}),
                          }}
                        >
                          {workingKey ===
                          `add:${player.id}`
                            ? "Adding..."
                            : "Add"}
                        </button>
                      </div>
                    );
                  }
                )
              )}
            </div>
          </Card>
        </section>
      </section>
    </main>
  );
}


function SummaryCard({
  label,
  value,
  subtitle,
  danger = false,
}: {
  label:
    string;

  value:
    string;

  subtitle:
    string;

  danger?:
    boolean;
}) {
  return (
    <Card
      style={
        styles.summaryCard
      }
    >
      <span
        style={
          styles.summaryLabel
        }
      >
        {label}
      </span>

      <strong
        style={{
          ...styles.summaryValue,

          ...(danger
            ? styles.summaryValueDanger
            : {}),
        }}
      >
        {value}
      </strong>

      <span
        style={
          styles.summarySubtitle
        }
      >
        {subtitle}
      </span>
    </Card>
  );
}


const styles = {
  page: {
    minHeight:
      "calc(100vh - 140px)",

    padding:
      "30px 18px 60px",

    background:
      "radial-gradient(circle at 50% 0%,rgba(255,69,0,.055),transparent 34%)",
  },

  shell: {
    width:
      "min(1420px,100%)",

    margin:
      "0 auto",

    display:
      "grid",

    gap:
      "22px",
  },

  pageHeader: {
    display:
      "flex",

    alignItems:
      "flex-end",

    justifyContent:
      "space-between",

    gap:
      "20px",

    flexWrap:
      "wrap" as const,
  },

  eyebrow: {
    margin:
      0,

    color:
      "#ff7a18",

    fontSize:
      "10px",

    fontWeight:
      900,

    letterSpacing:
      ".15em",
  },

  title: {
    margin:
      "6px 0 0",

    color:
      "#ffffff",

    fontSize:
      "36px",
  },

  subtitle: {
    margin:
      "8px 0 0",

    color:
      "#8f96a3",

    fontSize:
      "13px",
  },

  teamNameArea: {
    marginTop:
      "8px",

    display:
      "grid",

    gap:
      "9px",
  },

  teamNameSummary: {
    display:
      "flex",

    alignItems:
      "center",

    gap:
      "10px",

    flexWrap:
      "wrap" as const,
  },

  teamNameText: {
    color:
      "#ffffff",
  },

  changeTeamNameButton: {
    minHeight:
      "30px",

    padding:
      "6px 10px",

    border:
      "1px solid rgba(255,112,0,.34)",

    borderRadius:
      "7px",

    background:
      "rgba(255,82,0,.08)",

    color:
      "#ff8a25",

    fontSize:
      "9px",

    fontWeight:
      950,

    letterSpacing:
      ".06em",

    cursor:
      "pointer",
  },

  teamNameEditor: {
    display:
      "flex",

    alignItems:
      "center",

    gap:
      "8px",

    flexWrap:
      "wrap" as const,
  },

  teamNameInput: {
    width:
      "min(360px,100%)",

    minWidth:
      "220px",

    minHeight:
      "38px",

    padding:
      "9px 11px",

    border:
      "1px solid rgba(255,112,0,.38)",

    borderRadius:
      "8px",

    background:
      "#0b0d10",

    color:
      "#ffffff",

    fontSize:
      "13px",

    fontWeight:
      800,

    outline:
      "none",

    boxSizing:
      "border-box" as const,
  },

  saveTeamNameButton: {
    minHeight:
      "38px",

    padding:
      "9px 13px",

    border:
      "1px solid rgba(255,115,35,.45)",

    borderRadius:
      "8px",

    background:
      "linear-gradient(135deg,#c51f16,#ff6a1a)",

    color:
      "#ffffff",

    fontSize:
      "10px",

    fontWeight:
      950,

    letterSpacing:
      ".05em",

    cursor:
      "pointer",
  },

  cancelTeamNameButton: {
    minHeight:
      "38px",

    padding:
      "9px 12px",

    border:
      "1px solid rgba(255,255,255,.11)",

    borderRadius:
      "8px",

    background:
      "rgba(255,255,255,.035)",

    color:
      "#aeb4bd",

    fontSize:
      "10px",

    fontWeight:
      900,

    cursor:
      "pointer",
  },

  teamNameButtonDisabled: {
    opacity:
      0.55,

    cursor:
      "not-allowed",
  },

  teamNameMessage: {
    fontSize:
      "11px",

    fontWeight:
      800,
  },

  teamNameMessageSuccess: {
    color:
      "#70e69f",
  },

  teamNameMessageError: {
    color:
      "#ff8d8d",
  },

  headerBadges: {
    display:
      "flex",

    gap:
      "8px",

    flexWrap:
      "wrap" as const,
  },

  modeBadge: {
    padding:
      "8px 11px",

    border:
      "1px solid rgba(255,112,0,.33)",

    borderRadius:
      "999px",

    background:
      "rgba(255,82,0,.09)",

    color:
      "#ff8c00",

    fontSize:
      "9px",

    fontWeight:
      900,

    letterSpacing:
      ".08em",
  },

  statusBadge: {
    padding:
      "8px 11px",

    border:
      "1px solid rgba(255,255,255,.10)",

    borderRadius:
      "999px",

    background:
      "rgba(255,255,255,.04)",

    color:
      "#c7cbd2",

    fontSize:
      "9px",

    fontWeight:
      900,

    letterSpacing:
      ".06em",
  },

  summaryGrid: {
    display:
      "grid",

    gridTemplateColumns:
      "repeat(auto-fit,minmax(170px,1fr))",

    gap:
      "12px",
  },

  summaryCard: {
    padding:
      "16px",

    display:
      "grid",

    gap:
      "5px",
  },

  summaryLabel: {
    color:
      "#7f8792",

    fontSize:
      "8px",

    fontWeight:
      900,

    letterSpacing:
      ".11em",
  },

  summaryValue: {
    color:
      "#ffffff",

    fontSize:
      "24px",
  },

  summaryValueDanger: {
    color:
      "#ff4d4d",
  },

  summarySubtitle: {
    color:
      "#8d949f",

    fontSize:
      "11px",
  },

  workspace: {
    display:
      "grid",

    gridTemplateColumns:
      "minmax(0,1.02fr) minmax(420px,.98fr)",

    gap:
      "16px",

    alignItems:
      "start",
  },

  lineupCard: {
    padding:
      "20px",
  },

  poolCard: {
    padding:
      "20px",

    position:
      "sticky" as const,

    top:
      "14px",
  },

  cardHeader: {
    display:
      "flex",

    alignItems:
      "flex-end",

    justifyContent:
      "space-between",

    gap:
      "14px",

    flexWrap:
      "wrap" as const,

    marginBottom:
      "16px",
  },

  cardEyebrow: {
    margin:
      0,

    color:
      "#ff7a18",

    fontSize:
      "9px",

    fontWeight:
      900,

    letterSpacing:
      ".12em",
  },

  cardTitle: {
    margin:
      "5px 0 0",

    color:
      "#ffffff",

    fontSize:
      "20px",
  },

  cardHelper: {
    color:
      "#808894",

    fontSize:
      "11px",
  },

  activeSlotBadge: {
    padding:
      "7px 10px",

    border:
      "1px solid rgba(255,123,0,.30)",

    borderRadius:
      "8px",

    background:
      "rgba(255,76,0,.08)",

    color:
      "#ff8c00",

    fontSize:
      "9px",

    fontWeight:
      900,

    letterSpacing:
      ".06em",
  },

  slotList: {
    display:
      "grid",

    gap:
      "8px",
  },

  slotRow: {
    minHeight:
      "72px",

    display:
      "grid",

    gridTemplateColumns:
      "72px minmax(0,1fr) 120px 105px",

    alignItems:
      "center",

    gap:
      "12px",

    padding:
      "10px 12px",

    border:
      "1px solid rgba(255,255,255,.08)",

    borderRadius:
      "10px",

    background:
      "rgba(8,8,10,.72)",
  },

  slotRowSelected: {
    border:
      "1px solid rgba(255,121,0,.58)",

    boxShadow:
      "0 0 0 2px rgba(255,82,0,.06)",
  },

  slotLabel: {
    color:
      "#ff8c00",

    fontSize:
      "10px",

    fontWeight:
      900,

    letterSpacing:
      ".04em",
  },

  playerIdentity: {
    minWidth:
      0,

    display:
      "grid",

    gap:
      "4px",
  },

  playerMeta: {
    display:
      "grid",

    gap:
      "3px",

    textAlign:
      "right" as const,

    color:
      "#ffffff",

    fontSize:
      "11px",
  },

  slotAction: {
    display:
      "flex",

    justifyContent:
      "flex-end",
  },

  emptyPlayer: {
    color:
      "#626a75",

    fontSize:
      "12px",

    fontStyle:
      "italic",
  },

  selectSlotButton: {
    minHeight:
      "34px",

    padding:
      "7px 10px",

    border:
      "1px solid rgba(255,255,255,.12)",

    borderRadius:
      "7px",

    background:
      "#17181b",

    color:
      "#d3d6dc",

    cursor:
      "pointer",

    fontSize:
      "10px",

    fontWeight:
      900,
  },

  selectSlotButtonActive: {
    minHeight:
      "34px",

    padding:
      "7px 10px",

    border:
      "1px solid rgba(255,117,0,.62)",

    borderRadius:
      "7px",

    background:
      "linear-gradient(90deg,#e52818,#ff7a00)",

    color:
      "#ffffff",

    cursor:
      "pointer",

    fontSize:
      "10px",

    fontWeight:
      900,
  },

  removeButton: {
    minHeight:
      "34px",

    padding:
      "7px 10px",

    border:
      "1px solid rgba(255,82,82,.24)",

    borderRadius:
      "7px",

    background:
      "rgba(255,45,45,.07)",

    color:
      "#ff6a6a",

    cursor:
      "pointer",

    fontSize:
      "10px",

    fontWeight:
      900,
  },

  lockedBadge: {
    padding:
      "7px 9px",

    border:
      "1px solid rgba(255,255,255,.10)",

    borderRadius:
      "7px",

    color:
      "#777f8b",

    fontSize:
      "9px",

    fontWeight:
      900,
  },

  submitArea: {
    display:
      "flex",

    alignItems:
      "center",

    justifyContent:
      "space-between",

    gap:
      "18px",

    flexWrap:
      "wrap" as const,

    marginTop:
      "18px",

    paddingTop:
      "18px",

    borderTop:
      "1px solid rgba(255,255,255,.08)",
  },

  submitCopy: {
    display:
      "grid",

    gap:
      "4px",

    color:
      "#ffffff",

    fontSize:
      "12px",
  },

  submitButton: {
    minHeight:
      "44px",

    paddingLeft:
      "20px",

    paddingRight:
      "20px",
  },

  poolControls: {
    display:
      "grid",

    gap:
      "10px",

    marginBottom:
      "12px",
  },

  searchInput: {
    width:
      "100%",

    minHeight:
      "42px",

    padding:
      "9px 12px",

    border:
      "1px solid rgba(255,255,255,.11)",

    borderRadius:
      "9px",

    outline:
      "none",

    background:
      "#0d0e10",

    color:
      "#ffffff",

    fontSize:
      "12px",
  },

  filterRow: {
    display:
      "flex",

    gap:
      "6px",

    flexWrap:
      "wrap" as const,
  },

  filterButton: {
    minHeight:
      "30px",

    padding:
      "5px 9px",

    border:
      "1px solid rgba(255,255,255,.09)",

    borderRadius:
      "999px",

    background:
      "#151619",

    color:
      "#9299a4",

    cursor:
      "pointer",

    fontSize:
      "9px",

    fontWeight:
      900,
  },

  filterButtonActive: {
    minHeight:
      "30px",

    padding:
      "5px 9px",

    border:
      "1px solid rgba(255,116,0,.55)",

    borderRadius:
      "999px",

    background:
      "rgba(255,73,0,.11)",

    color:
      "#ff8c00",

    cursor:
      "pointer",

    fontSize:
      "9px",

    fontWeight:
      900,
  },

  poolHeader: {
    display:
      "grid",

    gridTemplateColumns:
      "minmax(0,1fr) 100px 70px 58px",

    gap:
      "10px",

    padding:
      "8px 10px",

    color:
      "#656d78",

    fontSize:
      "8px",

    fontWeight:
      900,

    letterSpacing:
      ".08em",
  },

  playerList: {
    maxHeight:
      "640px",

    overflowY:
      "auto" as const,

    display:
      "grid",

    gap:
      "5px",

    paddingRight:
      "3px",
  },

  poolRow: {
    minHeight:
      "61px",

    display:
      "grid",

    gridTemplateColumns:
      "minmax(0,1fr) 100px 70px 58px",

    alignItems:
      "center",

    gap:
      "10px",

    padding:
      "8px 10px",

    border:
      "1px solid rgba(255,255,255,.065)",

    borderRadius:
      "8px",

    background:
      "rgba(8,8,10,.64)",
  },

  poolIdentity: {
    minWidth:
      0,

    display:
      "grid",

    gap:
      "3px",

    color:
      "#ffffff",

    fontSize:
      "11px",
  },

  poolSalary: {
    display:
      "grid",

    gap:
      "2px",

    color:
      "#ffffff",

    fontSize:
      "10px",
  },

  poolProjection: {
    color:
      "#f2f3f5",

    fontSize:
      "11px",

    textAlign:
      "right" as const,
  },

  addButton: {
    minHeight:
      "32px",

    padding:
      "6px 8px",

    border:
      "1px solid rgba(255,122,0,.50)",

    borderRadius:
      "7px",

    background:
      "linear-gradient(90deg,#d92518,#ff7600)",

    color:
      "#ffffff",

    cursor:
      "pointer",

    fontSize:
      "9px",

    fontWeight:
      900,
  },

  addButtonDisabled: {
    opacity:
      .35,

    cursor:
      "not-allowed",
  },

  emptyPool: {
    padding:
      "28px 14px",

    textAlign:
      "center" as const,

    color:
      "#777f8a",

    fontSize:
      "12px",
  },
};
