"use client";

import Image from "next/image";

import {
  useMemo,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import type {
  TraditionalPlayerBrowserRow,
} from "@/lib/traditional/players.service";


type OwnershipFilter =
  | "all"
  | "available"
  | "waivers"
  | "rostered"
  | "mine";



type PlayerSeasonWeek = {
  week: number;
  nflGameId: number;
  teamAbbreviation: string | null;
  gameStatus: string | null;
  isLive: boolean;
  isFinal: boolean;
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
  fantasyPoints: number | string;
  fantasyScoreIsLive: boolean;
  fantasyScoreIsFinal: boolean;
};

type PlayerSeasonProfile = {
  season: number;
  player: {
    playerId: number;
    fullName: string;
    position: string;
    teamAbbreviation: string | null;
    headshotUrl: string | null;
    status: string | null;
  };
  injury: {
    status?: string | null;
    type?: string | null;
    location?: string | null;
    detail?: string | null;
    injuryDate?: string | null;
    returnDate?: string | null;
    sourceUpdatedAt?: string | null;
  };
  weeks: PlayerSeasonWeek[];
  seasonTotals: Record<string, number | string | null>;
  seasonFantasyPoints: number | string;
};

type Props = {
  leagueId: string;

  fantasyTeamId:
    number | null;

  season: number;

  week: number;

  waiverType: string;

  players:
    TraditionalPlayerBrowserRow[];

  teams:
    string[];
};


const positions = [
  "ALL",
  "QB",
  "RB",
  "WR",
  "TE",
  "FLEX",
  "K",
  "DST",
];


function matchesPosition(
  player:
    TraditionalPlayerBrowserRow,
  filter: string
) {
  if (
    filter === "ALL"
  ) {
    return true;
  }


  if (
    filter === "FLEX"
  ) {
    return [
      "RB",
      "WR",
      "TE",
    ].includes(
      player.position
    );
  }


  return (
    player.position ===
    filter
  );
}


function getInjuryStyle(
  status:
    string |
    null
) {
  const normalized =
    (
      status ??
      ""
    ).toUpperCase();


  if (
    normalized.includes(
      "IR"
    ) ||
    normalized.includes(
      "OUT"
    )
  ) {
    return styles.injuryDanger;
  }


  return styles.injuryWarning;
}



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
      code:
        "Q",
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
      code:
        "D",
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
      code:
        "O",
      label:
        "Out",
    };
  }

  if (
    value.includes(
      "INJURED RESERVE"
    ) ||
    value === "IR"
  ) {
    return {
      code:
        "IR",
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
      code:
        "PUP",
      label:
        "Physically Unable to Perform",
    };
  }

  if (
    value.includes(
      "SUSPEND"
    ) ||
    value === "SUS"
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
      value.length <=
        4
        ? value
        : "INJ",

    label:
      status ??
      "Injury status",
  };
}


function formatWaiverTime(
  value:
    string |
    null
) {
  if (!value) {
    return null;
  }


  const date =
    new Date(
      value
    );


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return null;
  }


  return date.toLocaleString(
    undefined,
    {
      month:
        "short",

      day:
        "numeric",

      hour:
        "numeric",

      minute:
        "2-digit",
    }
  );
}


export default function TraditionalPlayersBrowser({
  leagueId,
  fantasyTeamId,
  season,
  week,
  waiverType,
  players,
  teams,
}: Props) {
  const router =
    useRouter();


  const [
    search,
    setSearch,
  ] =
    useState("");


  const [
    position,
    setPosition,
  ] =
    useState("ALL");


  const [
    nflTeam,
    setNflTeam,
  ] =
    useState("ALL");


  const [
    ownership,
    setOwnership,
  ] =
    useState<OwnershipFilter>(
      "all"
    );


  const [
    injuryOnly,
    setInjuryOnly,
  ] =
    useState(false);


  const [
    activeOnly,
    setActiveOnly,
  ] =
    useState(true);


  const [
    selectedPlayerId,
    setSelectedPlayerId,
  ] =
    useState<
      number |
      null
    >(
      null
    );


  const [
    selectedDropPlayerId,
    setSelectedDropPlayerId,
  ] =
    useState<
      number |
      null
    >(
      null
    );


  const [
    faabBid,
    setFaabBid,
  ] =
    useState("0");


  const [
    saving,
    setSaving,
  ] =
    useState(false);


  const [
    message,
    setMessage,
  ] =
    useState<
      string |
      null
    >(
      null
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


  const [
    profilePlayerId,
    setProfilePlayerId,
  ] =
    useState<number | null>(
      null
    );

  const [
    profile,
    setProfile,
  ] =
    useState<PlayerSeasonProfile | null>(
      null
    );

  const [
    profileLoading,
    setProfileLoading,
  ] =
    useState(false);

  const [
    profileError,
    setProfileError,
  ] =
    useState<string | null>(
      null
    );

  const [
    injuryReportOpen,
    setInjuryReportOpen,
  ] =
    useState(false);


  const [
    injuryOnlyMode,
    setInjuryOnlyMode,
  ] =
    useState(false);



  const filteredPlayers =
    useMemo(
      () => {
        const normalizedSearch =
          search
            .trim()
            .toLowerCase();


        return players.filter(
          (
            player
          ) => {
            if (
              normalizedSearch &&
              !player.fullName
                .toLowerCase()
                .includes(
                  normalizedSearch
                )
            ) {
              return false;
            }


            if (
              !matchesPosition(
                player,
                position
              )
            ) {
              return false;
            }


            if (
              nflTeam !==
                "ALL" &&
              player
                .teamAbbreviation !==
                nflTeam
            ) {
              return false;
            }


            if (
              ownership ===
                "available" &&
              (
                player.isRostered ||
                player.isOnWaivers
              )
            ) {
              return false;
            }


            if (
              ownership ===
                "waivers" &&
              (
                player.isRostered ||
                !player.isOnWaivers
              )
            ) {
              return false;
            }


            if (
              ownership ===
                "rostered" &&
              !player.isRostered
            ) {
              return false;
            }


            if (
              ownership ===
                "mine" &&
              !player.isMyPlayer
            ) {
              return false;
            }


            if (
              injuryOnly &&
              !player
                .injuryStatus
            ) {
              return false;
            }


            if (
              activeOnly &&
              !player.isActive
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
        ownership,
        injuryOnly,
        activeOnly,
      ]
    );


  const myPlayers =
    useMemo(
      () =>
        players
          .filter(
            (
              player
            ) =>
              player.isMyPlayer
          )
          .sort(
            (
              a,
              b
            ) =>
              a.fullName
                .localeCompare(
                  b.fullName
                )
          ),
      [
        players,
      ]
    );


  const selectedPlayer =
    players.find(
      (
        player
      ) =>
        player.playerId ===
        selectedPlayerId
    ) ??
    null;


  function openAddPanel(
    playerId: number
  ) {
    setSelectedPlayerId(
      playerId
    );

    setSelectedDropPlayerId(
      null
    );

    setFaabBid(
      "0"
    );

    setMessage(
      null
    );

    setError(
      null
    );
  }


  function closeAddPanel() {
    if (
      saving
    ) {
      return;
    }


    setSelectedPlayerId(
      null
    );

    setSelectedDropPlayerId(
      null
    );

    setError(
      null
    );
  }


  async function openPlayerProfile(
    playerId: number,
    openInjuryReport =
      false
  ) {
    setProfilePlayerId(
      playerId
    );

    setInjuryOnlyMode(
      openInjuryReport
    );

    setProfile(
      null
    );

    setProfileError(
      null
    );

    setInjuryReportOpen(
      false
    );

    setProfileLoading(
      true
    );

    try {
      const response =
        await fetch(
          `/api/league/${leagueId}/players/${playerId}/season-profile?season=${season}`,
          {
            method:
              "GET",

            cache:
              "no-store",
          }
        );

      const body =
        (await response.json()) as {
          success?: boolean;
          profile?: PlayerSeasonProfile;
          error?: string;
        };

      if (
        !response.ok ||
        !body.success ||
        !body.profile
      ) {
        throw new Error(
          body.error ??
          "The player profile could not be loaded."
        );
      }

      setProfile(
        body.profile
      );

      if (
        openInjuryReport &&
        body.profile.injury.status
      ) {
        setInjuryReportOpen(
          true
        );
      }
    } catch (
      profileLoadError
    ) {
      setProfileError(
        profileLoadError instanceof Error
          ? profileLoadError.message
          : "The player profile could not be loaded."
      );
    } finally {
      setProfileLoading(
        false
      );
    }
  }


  function closePlayerProfile() {
    setProfilePlayerId(
      null
    );

    setProfile(
      null
    );

    setProfileError(
      null
    );

    setInjuryReportOpen(
      false
    );

    setInjuryOnlyMode(
      false
    );
  }


  async function submitTransaction() {
    if (
      !selectedPlayer
    ) {
      return;
    }


    if (
      fantasyTeamId ===
      null
    ) {
      setError(
        "You do not have an active fantasy team in this league."
      );

      return;
    }


    setSaving(
      true
    );

    setError(
      null
    );

    setMessage(
      null
    );


    try {
      const parsedFaab =
        waiverType ===
          "faab"
          ? Number(
              faabBid
            )
          : null;


      const response =
        await fetch(
          `/api/league/${leagueId}/players/add-or-claim`,
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                fantasyTeamId,

                season,

                week,

                playerId:
                  selectedPlayer
                    .playerId,

                dropPlayerId:
                  selectedDropPlayerId,

                faabBid:
                  parsedFaab,
              }),
          }
        );


      const responseText =
        await response.text();


      let result:
        {
          success?: boolean;

          error?: string;

          result?: {
            action?: string;

            processAfter?: string;
          };
        };


      try {
        result =
          JSON.parse(
            responseText
          );
      } catch {
        console.error(
          "Add/claim API returned non-JSON:",
          response.status,
          responseText
        );


        throw new Error(
          `The roster API returned an invalid response (${response.status}).`
        );
      }


      if (
        !response.ok ||
        !result.success
      ) {
        throw new Error(
          result.error ??
          "The roster transaction failed."
        );
      }


      const action =
        result.result
          ?.action;


      if (
        action ===
        "added"
      ) {
        setMessage(
          `${selectedPlayer.fullName} was added to your roster.`
        );
      } else if (
        action ===
        "waiver_claim"
      ) {
        setMessage(
          `Claim submitted for ${selectedPlayer.fullName} â€” manage priority in Waivers.`
        );
      } else {
        setMessage(
          "Roster transaction completed."
        );
      }


      setSelectedPlayerId(
        null
      );

      setSelectedDropPlayerId(
        null
      );


      router.refresh();
    } catch (
      transactionError
    ) {
      setError(
        transactionError instanceof Error
          ? transactionError.message
          : "The roster transaction failed."
      );
    } finally {
      setSaving(
        false
      );
    }
  }


  const profileSourcePlayer =
    profilePlayerId ===
      null
      ? null
      : players.find(
          (
            player
          ) =>
            player.playerId ===
            profilePlayerId
        ) ??
        null;


  return (
    <div
      style={
        styles.wrapper
      }
    >
      {message ? (
        <div
          style={
            styles.successMessage
          }
        >
          {message}
        </div>
      ) : null}


      {error && !selectedPlayer ? (
        <div
          style={
            styles.errorMessage
          }
        >
          {error}
        </div>
      ) : null}


      {selectedPlayer ? (
        <div
          style={styles.modalBackdrop}
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeAddPanel();
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="player-transaction-title"
            style={styles.modalCard}
          >
            <div style={styles.modalHeader}>
              <div>
                <span style={styles.actionEyebrow}>
                  {selectedPlayer.isOnWaivers
                    ? "WAIVER CLAIM"
                    : "ADD PLAYER"}
                </span>

                <strong
                  id="player-transaction-title"
                  style={styles.actionTitle}
                >
                  {selectedPlayer.fullName}
                </strong>

                <span style={styles.actionMeta}>
                  {selectedPlayer.position}
                  {selectedPlayer.teamAbbreviation
                    ? ` â€¢ ${selectedPlayer.teamAbbreviation}`
                    : ""}
                </span>

                {selectedPlayer.isOnWaivers ? (
                  <span style={styles.waiverPanelMeta}>
                    Waivers until{" "}
                    {formatWaiverTime(selectedPlayer.waiverUntil) ??
                      "processing"}
                  </span>
                ) : null}
              </div>

              <button
                type="button"
                onClick={closeAddPanel}
                disabled={saving}
                style={styles.modalCloseButton}
                aria-label="Close player transaction"
              >
                Ã—
              </button>
            </div>

            <div style={styles.modalBody}>
              <div style={styles.transactionSummary}>
                <strong style={styles.transactionSummaryTitle}>
                  {selectedPlayer.isOnWaivers
                    ? "Submit a waiver claim"
                    : "Add this player to your roster"}
                </strong>

                <span style={styles.transactionSummaryText}>
                  {selectedPlayer.isOnWaivers
                    ? "Choose a player to drop if your roster is full, then submit the claim."
                    : "If you have an open roster spot, leave Drop Player set to No player. If your roster is full, choose the player you want to drop."}
                </span>
              </div>

              <label style={styles.field}>
                <span style={styles.fieldLabel}>
                  DROP PLAYER
                </span>

                <select
                  value={selectedDropPlayerId ?? ""}
                  onChange={(event) => {
                    const value = event.target.value;

                    setSelectedDropPlayerId(
                      value ? Number(value) : null
                    );
                  }}
                  style={styles.select}
                  disabled={saving}
                >
                  <option value="">
                    No player â€” use open roster spot
                  </option>

                  {myPlayers.map((player) => (
                    <option
                      key={player.playerId}
                      value={player.playerId}
                    >
                      {player.position} - {player.fullName}
                    </option>
                  ))}
                </select>
              </label>

              {waiverType === "faab" ? (
                <label style={styles.field}>
                  <span style={styles.fieldLabel}>
                    FAAB BID
                  </span>

                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={faabBid}
                    onChange={(event) =>
                      setFaabBid(event.target.value)
                    }
                    style={styles.numberInput}
                    disabled={saving}
                  />
                </label>
              ) : null}

              {error ? (
                <div style={styles.modalError}>
                  {error}
                </div>
              ) : null}
            </div>

            <div style={styles.modalFooter}>
              <button
                type="button"
                onClick={closeAddPanel}
                disabled={saving}
                style={styles.secondaryAction}
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={saving || fantasyTeamId === null}
                onClick={() => void submitTransaction()}
                style={styles.primaryAction}
              >
                {saving
                  ? "Processing..."
                  : selectedPlayer.isOnWaivers
                    ? "Submit Waiver Claim"
                    : selectedDropPlayerId
                      ? "Confirm Add & Drop"
                      : "Confirm Add"}
              </button>
            </div>
          </section>
        </div>
      ) : null}


      {profilePlayerId !== null ? (
        <PlayerSeasonProfileModal
          profile={profile}
          sourcePlayer={
            profileSourcePlayer
          }
          canManage={
            fantasyTeamId !==
            null
          }
          loading={profileLoading}
          error={profileError}
          season={season}
          injuryReportOpen={injuryReportOpen}
          injuryOnly={
            injuryOnlyMode
          }
          onOpenInjuryReport={() =>
            setInjuryReportOpen(
              true
            )
          }
          onCloseInjuryReport={() =>
            setInjuryReportOpen(
              false
            )
          }
          onAddPlayer={
            (
              playerId
            ) => {
              closePlayerProfile();

              openAddPanel(
                playerId
              );
            }
          }
          onClose={
            closePlayerProfile
          }
        />
      ) : null}


      <section
        style={
          styles.filters
        }
      >
        <div
          style={
            styles.searchWrap
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
                  event.target
                    .value
                )
            }
            placeholder="Search players..."
            style={
              styles.searchInput
            }
          />
        </div>


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
                onClick={() =>
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
            styles.filterGrid
          }
        >
          <label
            style={
              styles.field
            }
          >
            <span
              style={
                styles.fieldLabel
              }
            >
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
                    event.target
                      .value
                  )
              }
              style={
                styles.select
              }
            >
              <option value="ALL">
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


          <label
            style={
              styles.field
            }
          >
            <span
              style={
                styles.fieldLabel
              }
            >
              AVAILABILITY
            </span>

            <select
              value={
                ownership
              }
              onChange={
                (
                  event
                ) =>
                  setOwnership(
                    event.target
                      .value as
                      OwnershipFilter
                  )
              }
              style={
                styles.select
              }
            >
              <option value="all">
                All Players
              </option>

              <option value="available">
                Free Agents
              </option>

              <option value="waivers">
                On Waivers
              </option>

              <option value="rostered">
                Rostered
              </option>

              <option value="mine">
                My Team
              </option>
            </select>
          </label>


          <label
            style={
              styles.checkboxField
            }
          >
            <input
              type="checkbox"
              checked={
                activeOnly
              }
              onChange={
                (
                  event
                ) =>
                  setActiveOnly(
                    event.target
                      .checked
                  )
              }
            />

            Active players only
          </label>


          <label
            style={
              styles.checkboxField
            }
          >
            <input
              type="checkbox"
              checked={
                injuryOnly
              }
              onChange={
                (
                  event
                ) =>
                  setInjuryOnly(
                    event.target
                      .checked
                  )
              }
            />

            Injury report only
          </label>
        </div>
      </section>


      <div
        style={
          styles.resultBar
        }
      >
        <strong>
          {filteredPlayers.length}
        </strong>

        <span>
          player
          {filteredPlayers.length ===
          1
            ? ""
            : "s"}{" "}
          shown
        </span>
      </div>


      <section
        style={
          styles.playerTable
        }
      >
        <div
          style={
            styles.tableHeader
          }
        >
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
            STATUS
          </span>

          <span>
            FANTASY
          </span>

          <span>
            ACTION
          </span>
        </div>


        {filteredPlayers.length >
        0 ? (
          filteredPlayers.map(
            (
              player
            ) => (
              <PlayerRow
                key={
                  player.playerId
                }

                player={
                  player
                }

                canManage={
                  fantasyTeamId !==
                  null
                }

                onAdd={
                  openAddPanel
                }

                onProfile={
                  openPlayerProfile
                }

                onInjuryReport={
                  (
                    playerId
                  ) =>
                    void openPlayerProfile(
                      playerId,
                      true
                    )
                }
              />
            )
          )
        ) : (
          <div
            style={
              styles.emptyState
            }
          >
            No players match the
            selected filters.
          </div>
        )}
      </section>
    </div>
  );
}


function PlayerRow({
  player,
  canManage,
  onAdd,
  onProfile,
  onInjuryReport,
}: {
  player:
    TraditionalPlayerBrowserRow;

  canManage:
    boolean;

  onAdd:
    (
      playerId: number
    ) => void;

  onProfile:
    (
      playerId: number
    ) => void;

  onInjuryReport:
    (
      playerId: number
    ) => void;
}) {
  const waiverTime =
    formatWaiverTime(
      player.waiverUntil
    );

  const injury =
    getInjuryDisplay(
      player.injuryStatus
    );


  return (
    <article
      style={
        styles.playerRow
      }
    >
      <div
        style={
          styles.playerIdentity
        }
      >
        <button
          type="button"
          onClick={() =>
            onProfile(
              player.playerId
            )
          }
          style={
            styles.headshotButton
          }
          title={`View ${player.fullName} stats`}
          aria-label={`View ${player.fullName} stats`}
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
                width={50}
                height={50}
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
        </button>


        <div
          style={
            styles.playerText
          }
        >
          <div
            style={
              styles.playerNameLine
            }
          >
            <button
              type="button"
              onClick={() =>
                onProfile(
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

            {injury ? (
              <button
                type="button"
                title={`View ${injury.label} injury report`}
                aria-label={`View ${player.fullName} injury report`}
                onClick={() =>
                  onInjuryReport(
                    player.playerId
                  )
                }
                style={{
                  ...styles.injuryBadge,
                  ...styles.injuryBadgeButton,
                  ...getInjuryStyle(
                    player.injuryStatus
                  ),
                }}
              >
                {injury.code}
              </button>
            ) : null}
          </div>
        </div>
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
          styles.nflTeam
        }
      >
        {player
          .teamAbbreviation ??
          "FA"}
      </span>


      <span>
        {player.isActive ? (
          <span
            style={
              styles.activeBadge
            }
          >
            ACTIVE
          </span>
        ) : (
          <span
            style={
              styles.inactiveBadge
            }
          >
            INACTIVE
          </span>
        )}
      </span>


      <div
        style={
          styles.fantasyStatus
        }
      >
        {player.isMyPlayer ? (
          <span
            style={
              styles.myTeamBadge
            }
          >
            MY TEAM
          </span>
        ) : player.isRostered ? (
          <>
            <span
              style={
                styles.rosteredBadge
              }
            >
              ROSTERED
            </span>

            <small
              style={
                styles.ownerName
              }
            >
              {player
                .fantasyTeamName}
            </small>
          </>
        ) : player.isOnWaivers ? (
          <>
            <span
              style={
                styles.waiverBadge
              }
            >
              WAIVERS
            </span>

            {waiverTime ? (
              <small
                style={
                  styles.waiverTime
                }
              >
                Until {waiverTime}
              </small>
            ) : null}
          </>
        ) : (
          <span
            style={
              styles.freeAgentBadge
            }
          >
            FREE AGENT
          </span>
        )}
      </div>


      <div
        style={
          styles.actionCell
        }
      >
        {!player.isRostered ? (
          <button
            type="button"
            disabled={
              !canManage
            }
            onClick={() =>
              onAdd(
                player.playerId
              )
            }
            style={{
              ...styles.addButton,

              ...(player
                .isOnWaivers
                ? styles.claimButton
                : {}),
            }}
          >
            {player
              .isOnWaivers
              ? "Claim"
              : "Add"}
          </button>
        ) : (
          <span
            style={
              styles.unavailableLabel
            }
          >
            â€”
          </span>
        )}
      </div>
    </article>
  );
}


function toStatNumber(
  value:
    number |
    string |
    null |
    undefined
) {
  const parsed =
    Number(
      value ?? 0
    );

  return Number.isFinite(
    parsed
  )
    ? parsed
    : 0;
}


function formatFantasyPoints(
  value:
    number |
    string |
    null |
    undefined
) {
  return toStatNumber(
    value
  ).toFixed(
    2
  );
}


function getWeekStats(
  position: string,
  week: PlayerSeasonWeek
) {
  if (
    position === "QB"
  ) {
    return [
      ["CMP", `${week.passingCompletions}/${week.passingAttempts}`],
      ["PASS YDS", week.passingYards],
      ["PASS TD", week.passingTouchdowns],
      ["INT", week.passingInterceptions],
      ["RUSH YDS", week.rushingYards],
      ["RUSH TD", week.rushingTouchdowns],
    ];
  }

  if (
    position === "RB"
  ) {
    return [
      ["ATT", week.rushingAttempts],
      ["RUSH YDS", week.rushingYards],
      ["RUSH TD", week.rushingTouchdowns],
      ["REC", week.receptions],
      ["REC YDS", week.receivingYards],
      ["REC TD", week.receivingTouchdowns],
    ];
  }

  if (
    position === "WR" ||
    position === "TE"
  ) {
    return [
      ["TGT", week.receivingTargets],
      ["REC", week.receptions],
      ["REC YDS", week.receivingYards],
      ["REC TD", week.receivingTouchdowns],
      ["RUSH YDS", week.rushingYards],
      ["RUSH TD", week.rushingTouchdowns],
    ];
  }

  if (
    position === "K"
  ) {
    return [
      ["FG", `${week.fieldGoalsMade}/${week.fieldGoalsAttempted}`],
      ["XP", `${week.extraPointsMade}/${week.extraPointsAttempted}`],
    ];
  }

  if (
    position === "DST"
  ) {
    return [
      ["SACK", week.dstSacks],
      ["INT", week.dstInterceptions],
      ["FR", week.dstFumbleRecoveries],
      ["TD", week.dstTouchdowns],
      ["PA", week.dstPointsAllowed],
      ["YA", week.dstYardsAllowed],
    ];
  }

  return [];
}


function getSeasonStats(
  position: string,
  totals: Record<string, number | string | null>
) {
  const v =
    (
      key: string
    ) =>
      toStatNumber(
        totals[
          key
        ]
      );

  if (
    position === "QB"
  ) {
    return [
      ["G", v("games")],
      ["PASS YDS", v("passingYards")],
      ["PASS TD", v("passingTouchdowns")],
      ["INT", v("passingInterceptions")],
      ["RUSH YDS", v("rushingYards")],
      ["RUSH TD", v("rushingTouchdowns")],
    ];
  }

  if (
    position === "RB"
  ) {
    return [
      ["G", v("games")],
      ["RUSH YDS", v("rushingYards")],
      ["RUSH TD", v("rushingTouchdowns")],
      ["REC", v("receptions")],
      ["REC YDS", v("receivingYards")],
      ["REC TD", v("receivingTouchdowns")],
    ];
  }

  if (
    position === "WR" ||
    position === "TE"
  ) {
    return [
      ["G", v("games")],
      ["TGT", v("receivingTargets")],
      ["REC", v("receptions")],
      ["REC YDS", v("receivingYards")],
      ["REC TD", v("receivingTouchdowns")],
      ["RUSH YDS", v("rushingYards")],
    ];
  }

  if (
    position === "K"
  ) {
    return [
      ["G", v("games")],
      ["FGM", v("fieldGoalsMade")],
      ["FGA", v("fieldGoalsAttempted")],
      ["XPM", v("extraPointsMade")],
      ["XPA", v("extraPointsAttempted")],
    ];
  }

  return [
    ["G", v("games")],
    ["SACK", v("dstSacks")],
    ["INT", v("dstInterceptions")],
    ["FR", v("dstFumbleRecoveries")],
    ["TD", v("dstTouchdowns")],
    ["PA", v("dstPointsAllowed")],
  ];
}


function PlayerSeasonProfileModal({
  profile,
  sourcePlayer,
  canManage,
  loading,
  error,
  season,
  injuryReportOpen,
  injuryOnly,
  onOpenInjuryReport,
  onCloseInjuryReport,
  onAddPlayer,
  onClose,
}: {
  profile:
    PlayerSeasonProfile |
    null;

  sourcePlayer:
    TraditionalPlayerBrowserRow |
    null;

  canManage:
    boolean;

  loading:
    boolean;

  error:
    string |
    null;

  season:
    number;

  injuryReportOpen:
    boolean;

  injuryOnly:
    boolean;

  onOpenInjuryReport:
    () => void;

  onCloseInjuryReport:
    () => void;

  onAddPlayer:
    (
      playerId: number
    ) => void;

  onClose:
    () => void;
}) {
  const position =
    profile
      ?.player
      .position ??
    "";

  const weeks =
    profile
      ?.weeks ??
    [];

  const seasonStats =
    profile
      ? getSeasonStats(
          position,
          profile.seasonTotals
        )
      : [];

  if (
    injuryOnly
  ) {
    return (
      <div
        style={
          styles.injuryOnlyBackdrop
        }
        onMouseDown={
          onClose
        }
      >
        <section
          role="dialog"
          aria-modal="true"
          aria-label="Injury report"
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
                  styles.profileEyebrow
                }
              >
                INJURY REPORT
              </span>

              <strong
                style={
                  styles.injuryReportName
                }
              >
                {profile
                  ?.player
                  .fullName ??
                  "Player"}
              </strong>

              {profile ? (
                <span
                  style={
                    styles.profileMeta
                  }
                >
                  {profile.player.position}
                  {" • "}
                  {profile.player.teamAbbreviation ?? "FA"}
                </span>
              ) : null}
            </div>

            <button
              type="button"
              onClick={
                onClose
              }
              style={
                styles.profileClose
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
            {loading ? (
              <div
                style={
                  styles.profileLoading
                }
              >
                Loading injury report...
              </div>
            ) : error ? (
              <div
                style={
                  styles.modalError
                }
              >
                {error}
              </div>
            ) : profile?.injury.status ? (
              <>
                <strong
                  style={{
                    ...styles.injuryReportDesignation,
                    ...getInjuryStyle(
                      profile.injury.status
                    ),
                  }}
                >
                  {profile.injury.status}
                  {profile.injury.location
                    ? ` • ${profile.injury.location}`
                    : ""}
                </strong>

                <div
                  style={
                    styles.injuryInfoGrid
                  }
                >
                  <div
                    style={
                      styles.injuryInfoCard
                    }
                  >
                    <span>
                      INJURY
                    </span>

                    <strong>
                      {profile.injury.type ??
                        "Not specified"}
                    </strong>
                  </div>

                  <div
                    style={
                      styles.injuryInfoCard
                    }
                  >
                    <span>
                      LOCATION
                    </span>

                    <strong>
                      {profile.injury.location ??
                        "Not specified"}
                    </strong>
                  </div>

                  <div
                    style={
                      styles.injuryInfoCard
                    }
                  >
                    <span>
                      INJURY DATE
                    </span>

                    <strong>
                      {profile.injury.injuryDate ??
                        "Not available"}
                    </strong>
                  </div>

                  <div
                    style={
                      styles.injuryInfoCard
                    }
                  >
                    <span>
                      EXPECTED RETURN
                    </span>

                    <strong>
                      {profile.injury.returnDate ??
                        "Not available"}
                    </strong>
                  </div>
                </div>

                <div
                  style={
                    styles.injuryDetailCard
                  }
                >
                  <span
                    style={
                      styles.injuryDetailLabel
                    }
                  >
                    FULL REPORT
                  </span>

                  <p
                    style={
                      styles.injuryReportDetail
                    }
                  >
                    {profile.injury.detail ??
                      "No additional injury report is currently available."}
                  </p>
                </div>
              </>
            ) : (
              <div
                style={
                  styles.profileEmpty
                }
              >
                No current injury report is available for this player.
              </div>
            )}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div
      style={
        styles.profileBackdrop
      }
      onMouseDown={
        (
          event
        ) => {
          if (
            event.target ===
            event.currentTarget
          ) {
            onClose();
          }
        }
      }
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Player season profile"
        style={
          styles.profileModal
        }
      >
        <div
          style={
            styles.profileHeader
          }
        >
          <div
            style={
              styles.profileHeaderIdentity
            }
          >
            {profile?.player.headshotUrl ? (
              <Image
                src={
                  profile.player.headshotUrl
                }
                alt={
                  profile.player.fullName
                }
                width={76}
                height={76}
                style={
                  styles.profileHeadshot
                }
              />
            ) : null}

            <div>
              <span
                style={
                  styles.profileEyebrow
                }
              >
                {season} PLAYER PROFILE
              </span>

              <strong
                style={
                  styles.profileName
                }
              >
                {profile
                  ?.player
                  .fullName ??
                  "Player"}
              </strong>

              {profile ? (
                <span
                  style={
                    styles.profileMeta
                  }
                >
                  {profile.player.position}
                  {" • "}
                  {profile.player.teamAbbreviation ?? "FA"}
                </span>
              ) : null}
            </div>
          </div>

          <div
            style={
              styles.profileHeaderActions
            }
          >
            {sourcePlayer &&
            !sourcePlayer.isRostered ? (
              <button
                type="button"
                disabled={
                  !canManage
                }
                onClick={
                  () =>
                    onAddPlayer(
                      sourcePlayer.playerId
                    )
                }
                style={{
                  ...styles.profileAddButton,

                  ...(sourcePlayer.isOnWaivers
                    ? styles.profileClaimButton
                    : {}),

                  ...(!canManage
                    ? styles.profileActionDisabled
                    : {}),
                }}
              >
                {sourcePlayer.isOnWaivers
                  ? "CLAIM"
                  : "ADD PLAYER"}
              </button>
            ) : sourcePlayer?.isMyPlayer ? (
              <span
                style={
                  styles.profileRosteredLabel
                }
              >
                ON MY TEAM
              </span>
            ) : sourcePlayer?.isRostered ? (
              <span
                style={
                  styles.profileRosteredLabel
                }
              >
                ROSTERED
              </span>
            ) : null}

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
        </div>

        <div
          style={
            styles.profileBody
          }
        >
          {loading ? (
            <div
              style={
                styles.profileLoading
              }
            >
              Loading player stats...
            </div>
          ) : error ? (
            <div
              style={
                styles.modalError
              }
            >
              {error}
            </div>
          ) : profile ? (
            <>
              {profile.injury.status ? (
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
                    CURRENT INJURY
                  </div>

                  <button
                    type="button"
                    onClick={
                      onOpenInjuryReport
                    }
                    style={{
                      ...styles.profileInjuryButton,
                      ...getInjuryStyle(
                        profile.injury.status
                      ),
                    }}
                  >
                    {profile.injury.status}
                    {profile.injury.location
                      ? ` • ${profile.injury.location}`
                      : ""}
                    {" — View full report"}
                  </button>
                </section>
              ) : null}

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
                  {season} WEEK-BY-WEEK STATS
                </div>

                {weeks.length === 0 ? (
                  <div
                    style={
                      styles.profileEmpty
                    }
                  >
                    No {season} regular-season games have been recorded yet. Weekly stats and fantasy points will appear here as games are synced.
                  </div>
                ) : (
                  <div
                    style={
                      styles.weekList
                    }
                  >
                    {weeks.map(
                      (
                        week
                      ) => (
                        <article
                          key={`${week.week}-${week.nflGameId}`}
                          style={
                            styles.weekCard
                          }
                        >
                          <div
                            style={
                              styles.weekTop
                            }
                          >
                            <div>
                              <strong
                                style={
                                  styles.weekTitle
                                }
                              >
                                WEEK {week.week}
                              </strong>

                              <span
                                style={
                                  styles.weekStatus
                                }
                              >
                                {week.fantasyScoreIsLive
                                  ? "LIVE"
                                  : week.fantasyScoreIsFinal
                                    ? "FINAL"
                                    : week.gameStatus ?? "SCHEDULED"}
                              </span>
                            </div>

                            <div
                              style={
                                styles.weekFantasy
                              }
                            >
                              <span>
                                FANTASY PTS
                              </span>

                              <strong>
                                {formatFantasyPoints(
                                  week.fantasyPoints
                                )}
                              </strong>
                            </div>
                          </div>

                          <div
                            style={
                              styles.weekStatsGrid
                            }
                          >
                            {getWeekStats(
                              position,
                              week
                            ).map(
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
                                    styles.statCard
                                  }
                                >
                                  <span
                                    style={
                                      styles.statLabel
                                    }
                                  >
                                    {label}
                                  </span>

                                  <strong
                                    style={
                                      styles.statValue
                                    }
                                  >
                                    {value}
                                  </strong>
                                </div>
                              )
                            )}
                          </div>
                        </article>
                      )
                    )}
                  </div>
                )}
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
                  {season} SEASON TOTALS
                </div>

                <div
                  style={
                    styles.seasonTotalsGrid
                  }
                >
                  {seasonStats.map(
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
                          styles.statCard
                        }
                      >
                        <span
                          style={
                            styles.statLabel
                          }
                        >
                          {label}
                        </span>

                        <strong
                          style={
                            styles.statValue
                          }
                        >
                          {value}
                        </strong>
                      </div>
                    )
                  )}
                </div>

                <div
                  style={
                    styles.seasonFantasyHero
                  }
                >
                  <span>
                    {season} FANTASY POINTS
                  </span>

                  <strong>
                    {formatFantasyPoints(
                      profile.seasonFantasyPoints
                    )}
                  </strong>
                </div>
              </section>
            </>
          ) : null}
        </div>
      </section>

      {injuryReportOpen &&
      profile?.injury.status ? (
        <div
          style={
            styles.injuryReportBackdrop
          }
          onMouseDown={
            onCloseInjuryReport
          }
        >
          <section
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
                    styles.profileEyebrow
                  }
                >
                  INJURY REPORT
                </span>

                <strong
                  style={
                    styles.injuryReportName
                  }
                >
                  {profile.player.fullName}
                </strong>
              </div>

              <button
                type="button"
                onClick={
                  onCloseInjuryReport
                }
                style={
                  styles.profileClose
                }
              >
                ×
              </button>
            </div>

            <div
              style={
                styles.injuryReportBody
              }
            >
              <strong
                style={{
                  ...styles.injuryReportDesignation,
                  ...getInjuryStyle(
                    profile.injury.status
                  ),
                }}
              >
                {profile.injury.status}
                {profile.injury.location
                  ? ` • ${profile.injury.location}`
                  : ""}
              </strong>

              <p
                style={
                  styles.injuryReportDetail
                }
              >
                {profile.injury.detail ??
                  "No additional injury report is currently available."}
              </p>

              {profile.injury.injuryDate ? (
                <span
                  style={
                    styles.injuryReportDate
                  }
                >
                  Injury date: {profile.injury.injuryDate}
                </span>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}


const styles = {

  headshotButton: {
    flex:
      "0 0 auto",
    padding:
      0,
    border:
      0,
    borderRadius:
      "50%",
    background:
      "transparent",
    cursor:
      "pointer",
  },

  profileBackdrop: {
    position:
      "fixed" as const,
    inset:
      0,
    zIndex:
      1000,
    display:
      "grid",
    placeItems:
      "center",
    padding:
      "22px",
    background:
      "rgba(0,0,0,.78)",
    backdropFilter:
      "blur(6px)",
  },

  profileModal: {
    width:
      "min(1120px, 96vw)",
    maxHeight:
      "92vh",
    overflow:
      "hidden",
    display:
      "grid",
    gridTemplateRows:
      "auto minmax(0,1fr)",
    border:
      "1px solid rgba(255,100,20,.28)",
    borderRadius:
      "18px",
    background:
      "linear-gradient(145deg,#17191c,#090a0c)",
    boxShadow:
      "0 28px 90px rgba(0,0,0,.72)",
  },

  profileHeader: {
    display:
      "flex",
    alignItems:
      "center",
    justifyContent:
      "space-between",
    gap:
      "18px",
    padding:
      "18px 20px",
    borderBottom:
      "1px solid rgba(255,255,255,.08)",
  },

  profileHeaderIdentity: {
    display:
      "flex",
    alignItems:
      "center",
    gap:
      "14px",
  },

  profileHeaderActions: {
    display:
      "flex",
    alignItems:
      "center",
    gap:
      "10px",
  },

  profileAddButton: {
    minHeight:
      "40px",
    padding:
      "0 15px",
    border:
      "1px solid rgba(255,102,20,.34)",
    borderRadius:
      "9px",
    background:
      "linear-gradient(135deg,#b81818,#ef4e00,#ff7d00)",
    color:
      "#ffffff",
    fontSize:
      "14px",
    fontWeight:
      950,
    cursor:
      "pointer",
  },

  profileClaimButton: {
    border:
      "1px solid rgba(255,170,50,.35)",
    background:
      "linear-gradient(135deg,#9d4f00,#df7600)",
  },

  profileActionDisabled: {
    opacity:
      0.5,
    cursor:
      "not-allowed",
  },

  profileRosteredLabel: {
    color:
      "#8e959f",
    fontSize:
      "14px",
    fontWeight:
      950,
  },

  profileHeadshot: {
    width:
      "76px",
    height:
      "76px",
    objectFit:
      "cover" as const,
    borderRadius:
      "14px",
    background:
      "#0b0c0e",
  },

  profileEyebrow: {
    display:
      "block",
    marginBottom:
      "4px",
    color:
      "#ff8423",
    fontSize:
      "14px",
    fontWeight:
      950,
    letterSpacing:
      ".08em",
  },

  profileName: {
    display:
      "block",
    color:
      "#ffffff",
    fontSize:
      "26px",
    fontWeight:
      950,
  },

  profileMeta: {
    display:
      "block",
    marginTop:
      "3px",
    color:
      "#a0a6af",
    fontSize:
      "16px",
    fontWeight:
      800,
  },

  profileClose: {
    width:
      "40px",
    height:
      "40px",
    borderRadius:
      "10px",
    border:
      "1px solid rgba(255,255,255,.10)",
    background:
      "#15171a",
    color:
      "#ffffff",
    fontSize:
      "25px",
    cursor:
      "pointer",
  },

  profileBody: {
    minHeight:
      0,
    overflowY:
      "auto" as const,
    padding:
      "20px",
    display:
      "grid",
    gap:
      "18px",
  },

  profileLoading: {
    minHeight:
      "220px",
    display:
      "grid",
    placeItems:
      "center",
    color:
      "#a7adb6",
    fontSize:
      "17px",
    fontWeight:
      800,
  },

  profileSection: {
    display:
      "grid",
    gap:
      "12px",
  },

  profileSectionHeader: {
    color:
      "#ff8423",
    fontSize:
      "15px",
    fontWeight:
      950,
    letterSpacing:
      ".07em",
  },

  profileInjuryButton: {
    width:
      "fit-content",
    padding:
      "9px 12px",
    border:
      "1px solid rgba(255,145,40,.20)",
    borderRadius:
      "8px",
    fontSize:
      "15px",
    fontWeight:
      950,
    cursor:
      "pointer",
  },

  profileEmpty: {
    padding:
      "18px",
    border:
      "1px solid rgba(255,255,255,.08)",
    borderRadius:
      "12px",
    background:
      "rgba(255,255,255,.025)",
    color:
      "#9da3ac",
    fontSize:
      "15px",
    lineHeight:
      1.55,
  },

  weekList: {
    display:
      "grid",
    gap:
      "12px",
  },

  weekCard: {
    padding:
      "15px",
    border:
      "1px solid rgba(255,255,255,.08)",
    borderRadius:
      "13px",
    background:
      "rgba(255,255,255,.025)",
  },

  weekTop: {
    display:
      "flex",
    alignItems:
      "center",
    justifyContent:
      "space-between",
    gap:
      "14px",
    marginBottom:
      "12px",
  },

  weekTitle: {
    display:
      "block",
    color:
      "#ffffff",
    fontSize:
      "18px",
    fontWeight:
      950,
  },

  weekStatus: {
    display:
      "block",
    marginTop:
      "3px",
    color:
      "#858c96",
    fontSize:
      "13px",
    fontWeight:
      900,
  },

  weekFantasy: {
    display:
      "grid",
    justifyItems:
      "end",
    gap:
      "2px",
    color:
      "#9da3ac",
    fontSize:
      "12px",
    fontWeight:
      900,
  },

  weekStatsGrid: {
    display:
      "grid",
    gridTemplateColumns:
      "repeat(auto-fit,minmax(105px,1fr))",
    gap:
      "9px",
  },

  seasonTotalsGrid: {
    display:
      "grid",
    gridTemplateColumns:
      "repeat(auto-fit,minmax(120px,1fr))",
    gap:
      "9px",
  },

  statCard: {
    minHeight:
      "76px",
    padding:
      "10px",
    display:
      "grid",
    alignContent:
      "center",
    gap:
      "5px",
    border:
      "1px solid rgba(255,255,255,.07)",
    borderRadius:
      "10px",
    background:
      "#0c0e10",
  },

  statLabel: {
    color:
      "#858c96",
    fontSize:
      "12px",
    fontWeight:
      900,
  },

  statValue: {
    color:
      "#ffffff",
    fontSize:
      "24px",
    lineHeight:
      1,
    fontWeight:
      950,
  },

  seasonFantasyHero: {
    marginTop:
      "4px",
    padding:
      "16px",
    display:
      "flex",
    alignItems:
      "center",
    justifyContent:
      "space-between",
    gap:
      "16px",
    border:
      "1px solid rgba(255,105,20,.22)",
    borderRadius:
      "12px",
    background:
      "linear-gradient(135deg,rgba(190,30,20,.16),rgba(255,115,0,.10))",
    color:
      "#ff9a38",
    fontSize:
      "15px",
    fontWeight:
      950,
  },

  injuryOnlyBackdrop: {
    position:
      "fixed" as const,
    inset:
      0,
    zIndex:
      1020,
    display:
      "grid",
    placeItems:
      "center",
    padding:
      "24px",
    background:
      "rgba(0,0,0,.82)",
    backdropFilter:
      "blur(6px)",
  },

  injuryInfoGrid: {
    display:
      "grid",
    gridTemplateColumns:
      "repeat(auto-fit,minmax(150px,1fr))",
    gap:
      "10px",
  },

  injuryInfoCard: {
    padding:
      "12px",
    display:
      "grid",
    gap:
      "5px",
    border:
      "1px solid rgba(255,255,255,.08)",
    borderRadius:
      "10px",
    background:
      "#0c0e10",
    color:
      "#8f969f",
    fontSize:
      "12px",
    fontWeight:
      900,
  },

  injuryDetailCard: {
    padding:
      "14px",
    border:
      "1px solid rgba(255,120,25,.12)",
    borderRadius:
      "10px",
    background:
      "rgba(255,90,10,.045)",
  },

  injuryDetailLabel: {
    display:
      "block",
    marginBottom:
      "7px",
    color:
      "#ff8423",
    fontSize:
      "13px",
    fontWeight:
      950,
    letterSpacing:
      ".07em",
  },


  injuryReportBackdrop: {
    position:
      "fixed" as const,
    inset:
      0,
    zIndex:
      1010,
    display:
      "grid",
    placeItems:
      "center",
    padding:
      "24px",
    background:
      "rgba(0,0,0,.78)",
  },

  injuryReportModal: {
    width:
      "min(720px,94vw)",
    border:
      "1px solid rgba(255,120,25,.25)",
    borderRadius:
      "16px",
    background:
      "#111315",
    boxShadow:
      "0 25px 80px rgba(0,0,0,.65)",
  },

  injuryReportHeader: {
    display:
      "flex",
    alignItems:
      "center",
    justifyContent:
      "space-between",
    gap:
      "16px",
    padding:
      "17px 18px",
    borderBottom:
      "1px solid rgba(255,255,255,.08)",
  },

  injuryReportName: {
    display:
      "block",
    color:
      "#ffffff",
    fontSize:
      "22px",
    fontWeight:
      950,
  },

  injuryReportBody: {
    padding:
      "18px",
    display:
      "grid",
    gap:
      "14px",
  },

  injuryReportDesignation: {
    width:
      "fit-content",
    padding:
      "7px 10px",
    borderRadius:
      "7px",
    fontSize:
      "15px",
    fontWeight:
      950,
  },

  injuryReportDetail: {
    margin:
      0,
    color:
      "#d7dbe0",
    fontSize:
      "16px",
    lineHeight:
      1.65,
  },

  injuryReportDate: {
    color:
      "#858c96",
    fontSize:
      "14px",
    fontWeight:
      800,
  },

  wrapper: {
    display:
      "grid",

    gap:
      "16px",
  },


  successMessage: {
    padding:
      "12px 14px",

    border:
      "1px solid rgba(60,215,130,.18)",

    borderRadius:
      "14px",

    background:
      "rgba(45,190,105,.07)",

    color:
      "#48dc89",

    fontSize:
      "14px",

    fontWeight:
      800,
  },


  errorMessage: {
    padding:
      "12px 14px",

    border:
      "1px solid rgba(255,70,70,.20)",

    borderRadius:
      "14px",

    background:
      "rgba(210,25,25,.08)",

    color:
      "#ff7373",

    fontSize:
      "14px",

    fontWeight:
      800,
  },


  actionPanel: {
    padding:
      "17px",

    display:
      "grid",

    gap:
      "14px",

    border:
      "1px solid rgba(255,95,20,.22)",

    borderRadius:
      "14px",

    background:
      "linear-gradient(135deg,rgba(185,22,22,.11),rgba(255,78,0,.055))",
  },


  actionHeading: {
    display:
      "flex",

    alignItems:
      "flex-start",

    justifyContent:
      "space-between",

    gap:
      "16px",
  },


  actionEyebrow: {
    display:
      "block",

    color:
      "#ff7d20",

    fontSize:
      "14px",

    fontWeight:
      900,

    letterSpacing:
      ".10em",
  },


  actionTitle: {
    display:
      "block",

    marginTop:
      "4px",

    color:
      "#ffffff",

    fontSize:
      "16px",
  },


  actionMeta: {
    display:
      "block",

    marginTop:
      "3px",

    color:
      "#828993",

    fontSize:
      "14px",
  },


  waiverPanelMeta: {
    display:
      "block",

    marginTop:
      "13px",

    color:
      "#ffad43",

    fontSize:
      "14px",

    fontWeight:
      800,
  },


  closeButton: {
    minHeight:
      "32px",

    padding:
      "0 10px",

    border:
      "1px solid rgba(255,255,255,.09)",

    borderRadius:
      "13px",

    background:
      "rgba(255,255,255,.035)",

    color:
      "#a6abb3",

    fontSize:
      "14px",

    fontWeight:
      850,

    cursor:
      "pointer",
  },


  actionGrid: {
    display:
      "grid",

    gridTemplateColumns:
      "minmax(180px,1fr) minmax(120px,.4fr) auto",

    gap:
      "13px",

    alignItems:
      "end",
  },


  actionSubmitWrap: {
    display:
      "flex",

    alignItems:
      "end",
  },


  primaryAction: {
    minHeight:
      "39px",

    padding:
      "0 14px",

    border:
      "1px solid rgba(255,100,15,.42)",

    borderRadius:
      "13px",

    background:
      "linear-gradient(135deg,#c71919,#f04800,#ff7d00)",

    color:
      "#ffffff",

    fontSize:
      "14px",

    fontWeight:
      950,

    cursor:
      "pointer",
  },


  actionNote: {
    margin:
      0,

    color:
      "#777e88",

    fontSize:
      "14px",

    lineHeight:
      1.45,
  },


  modalBackdrop: {
    position: "fixed" as const,
    inset: 0,
    zIndex: 1000,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "20px",
    background: "rgba(0,0,0,.78)",
    backdropFilter: "blur(5px)",
  },


  modalCard: {
    width: "min(560px,100%)",
    maxHeight: "calc(100vh - 40px)",
    overflowY: "auto" as const,
    border: "1px solid rgba(255,95,20,.25)",
    borderRadius: "14px",
    background: "linear-gradient(145deg,#151516,#09090a)",
    boxShadow: "0 24px 80px rgba(0,0,0,.58)",
  },


  modalHeader: {
    padding: "18px 18px 15px",
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "16px",
    borderBottom: "1px solid rgba(255,255,255,.07)",
  },


  modalCloseButton: {
    width: "34px",
    height: "34px",
    flex: "0 0 auto",
    border: "1px solid rgba(255,255,255,.09)",
    borderRadius: "14px",
    background: "rgba(255,255,255,.035)",
    color: "#a6abb3",
    fontSize: "20px",
    lineHeight: 1,
    cursor: "pointer",
  },


  modalBody: {
    padding: "18px",
    display: "grid",
    gap: "14px",
  },


  transactionSummary: {
    padding: "12px 13px",
    display: "grid",
    gap: "5px",
    border: "1px solid rgba(255,120,25,.12)",
    borderRadius: "14px",
    background: "rgba(255,85,10,.045)",
  },


  transactionSummaryTitle: {
    color: "#ffffff",
    fontSize: "14px",
  },


  transactionSummaryText: {
    color: "#858c96",
    fontSize: "14px",
    lineHeight: 1.5,
  },


  modalError: {
    padding: "10px 12px",
    border: "1px solid rgba(255,70,70,.20)",
    borderRadius: "13px",
    background: "rgba(210,25,25,.08)",
    color: "#ff7373",
    fontSize: "13px",
    fontWeight: 800,
  },


  modalFooter: {
    padding: "14px 18px 18px",
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: "14px",
    borderTop: "1px solid rgba(255,255,255,.07)",
  },


  secondaryAction: {
    minHeight: "39px",
    padding: "0 14px",
    border: "1px solid rgba(255,255,255,.09)",
    borderRadius: "13px",
    background: "rgba(255,255,255,.035)",
    color: "#a6abb3",
    fontSize: "14px",
    fontWeight: 850,
    cursor: "pointer",
  },


  filters: {
    padding:
      "17px",

    display:
      "grid",

    gap:
      "14px",

    border:
      "1px solid rgba(255,255,255,.075)",

    borderRadius:
      "14px",

    background:
      "linear-gradient(145deg,#141415,#09090a)",
  },


  searchWrap: {
    width:
      "100%",
  },


  searchInput: {
    width:
      "100%",

    minHeight:
      "44px",

    padding:
      "0 14px",

    border:
      "1px solid rgba(255,255,255,.09)",

    borderRadius:
      "14px",

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
    minHeight:
      "34px",

    padding:
      "0 11px",

    border:
      "1px solid rgba(255,255,255,.08)",

    borderRadius:
      "13px",

    background:
      "rgba(255,255,255,.025)",

    color:
      "#878e98",

    fontSize:
      "14px",

    fontWeight:
      900,

    cursor:
      "pointer",

    whiteSpace:
      "nowrap" as const,
  },


  positionButtonActive: {
    border:
      "1px solid rgba(255,95,20,.32)",

    background:
      "linear-gradient(135deg,rgba(190,20,20,.20),rgba(255,80,0,.12))",

    color:
      "#ffffff",
  },


  filterGrid: {
    display:
      "grid",

    gridTemplateColumns:
      "repeat(auto-fit,minmax(170px,1fr))",

    gap:
      "13px",

    alignItems:
      "end",
  },


  field: {
    display:
      "grid",

    gap:
      "5px",
  },


  fieldLabel: {
    color:
      "#6f7680",

    fontSize:
      "14px",

    fontWeight:
      900,

    letterSpacing:
      ".09em",
  },


  select: {
    minHeight:
      "39px",

    padding:
      "0 10px",

    border:
      "1px solid rgba(255,255,255,.08)",

    borderRadius:
      "13px",

    background:
      "#0a0a0b",

    color:
      "#d4d7db",

    fontSize:
      "13px",
  },


  numberInput: {
    minHeight:
      "39px",

    padding:
      "0 10px",

    border:
      "1px solid rgba(255,255,255,.08)",

    borderRadius:
      "13px",

    background:
      "#0a0a0b",

    color:
      "#ffffff",

    fontSize:
      "13px",
  },


  checkboxField: {
    minHeight:
      "39px",

    display:
      "flex",

    alignItems:
      "center",

    gap:
      "14px",

    color:
      "#949aa3",

    fontSize:
      "13px",

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


  playerTable: {
    overflow:
      "hidden",

    border:
      "1px solid rgba(255,255,255,.075)",

    borderRadius:
      "14px",

    background:
      "linear-gradient(145deg,#141415,#09090a)",
  },


  tableHeader: {
    minHeight:
      "39px",

    padding:
      "0 15px",

    display:
      "grid",

    gridTemplateColumns:
      "minmax(260px,2fr) 60px 60px 90px minmax(120px,1fr) 70px",

    alignItems:
      "center",

    gap:
      "14px",

    borderBottom:
      "1px solid rgba(255,255,255,.07)",

    background:
      "rgba(255,255,255,.02)",

    color:
      "#646b75",

    fontSize:
      "14px",

    fontWeight:
      900,

    letterSpacing:
      ".08em",
  },


  playerRow: {
    minHeight:
      "72px",

    padding:
      "10px 15px",

    display:
      "grid",

    gridTemplateColumns:
      "minmax(260px,2fr) 60px 60px 90px minmax(120px,1fr) 70px",

    alignItems:
      "center",

    gap:
      "14px",

    borderBottom:
      "1px solid rgba(255,255,255,.055)",
  },


  playerIdentity: {
    minWidth:
      0,

    display:
      "flex",

    alignItems:
      "center",

    gap:
      "14px",
  },


  headshotWrap: {
    width:
      "50px",

    height:
      "50px",

    flex:
      "0 0 auto",

    overflow:
      "hidden",

    borderRadius:
      "50%",

    background:
      "#18181a",
  },


  headshot: {
    width:
      "50px",

    height:
      "50px",

    objectFit:
      "cover" as const,
  },


  headshotFallback: {
    width:
      "100%",

    height:
      "100%",

    display:
      "flex",

    alignItems:
      "center",

    justifyContent:
      "center",

    color:
      "#717883",

    fontSize:
      "14px",

    fontWeight:
      900,
  },


  playerText: {
    minWidth:
      0,

    display:
      "grid",

    justifyItems:
      "start",

    gap:
      "4px",
  },


  playerNameLine: {
    display:
      "flex",

    alignItems:
      "center",

    gap:
      "8px",

    minWidth:
      0,
  },


  playerNameButton: {
    minWidth:
      0,

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
      "rgba(255,120,35,.48)",

    textUnderlineOffset:
      "3px",
  },


  position: {
    color:
      "#ff8423",

    fontSize:
      "13px",
  },


  nflTeam: {
    color:
      "#9ca2aa",

    fontSize:
      "13px",

    fontWeight:
      800,
  },


  activeBadge: {
    color:
      "#42d982",

    fontSize:
      "14px",

    fontWeight:
      900,
  },


  inactiveBadge: {
    color:
      "#707780",

    fontSize:
      "14px",

    fontWeight:
      900,
  },


  injuryBadge: {
    maxWidth:
      "125px",

    padding:
      "3px 6px",

    overflow:
      "hidden",

    textOverflow:
      "ellipsis",

    whiteSpace:
      "nowrap" as const,

    borderRadius:
      "4px",

    fontSize:
      "13px",

    fontWeight:
      900,
  },


  injuryBadgeButton: {
    border:
      "1px solid rgba(255,255,255,.08)",

    cursor:
      "pointer",

    flex:
      "0 0 auto",
  },


  injuryDanger: {
    background:
      "rgba(210,25,25,.10)",

    color:
      "#ff6a6a",
  },


  injuryWarning: {
    background:
      "rgba(255,130,0,.08)",

    color:
      "#ff992b",
  },


  fantasyStatus: {
    minWidth:
      0,

    display:
      "grid",

    justifyItems:
      "start",

    gap:
      "3px",
  },


  freeAgentBadge: {
    color:
      "#42d982",

    fontSize:
      "14px",

    fontWeight:
      950,
  },


  waiverBadge: {
    color:
      "#ffad43",

    fontSize:
      "14px",

    fontWeight:
      950,
  },


  waiverTime: {
    color:
      "#777e88",

    fontSize:
      "13px",
  },


  rosteredBadge: {
    color:
      "#777e88",

    fontSize:
      "14px",

    fontWeight:
      950,
  },


  myTeamBadge: {
    color:
      "#ff8423",

    fontSize:
      "14px",

    fontWeight:
      950,
  },


  ownerName: {
    maxWidth:
      "100%",

    overflow:
      "hidden",

    textOverflow:
      "ellipsis",

    whiteSpace:
      "nowrap" as const,

    color:
      "#707781",

    fontSize:
      "14px",
  },


  actionCell: {
    display:
      "flex",

    justifyContent:
      "flex-end",
  },


  addButton: {
    minHeight:
      "30px",

    padding:
      "0 10px",

    border:
      "1px solid rgba(255,102,20,.28)",

    borderRadius:
      "6px",

    background:
      "linear-gradient(135deg,#b81818,#ef4e00)",

    color:
      "#ffffff",

    fontSize:
      "14px",

    fontWeight:
      950,

    cursor:
      "pointer",
  },


  claimButton: {
    border:
      "1px solid rgba(255,170,50,.32)",

    background:
      "linear-gradient(135deg,#9d4f00,#df7600)",
  },


  unavailableLabel: {
    color:
      "#5f6670",

    fontSize:
      "13px",
  },


  emptyState: {
    minHeight:
      "170px",

    display:
      "flex",

    alignItems:
      "center",

    justifyContent:
      "center",

    color:
      "#737a84",

    fontSize:
      "14px",
  },
};
