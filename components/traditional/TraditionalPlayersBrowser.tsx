"use client";

import Image from "next/image";

import {
  memo,
  useCallback,
  useDeferredValue,
  useEffect,
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

const INITIAL_PLAYER_COUNT = 50;
const PLAYER_LOAD_INCREMENT = 50;


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
    visiblePlayerCount,
    setVisiblePlayerCount,
  ] =
    useState(
      INITIAL_PLAYER_COUNT
    );


  const deferredSearch =
    useDeferredValue(
      search
    );


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


  const filteredPlayers =
    useMemo(
      () => {
        const normalizedSearch =
          deferredSearch
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
        deferredSearch,
        position,
        nflTeam,
        ownership,
        injuryOnly,
        activeOnly,
      ]
    );


  useEffect(
    () => {
      setVisiblePlayerCount(
        INITIAL_PLAYER_COUNT
      );
    },
    [
      deferredSearch,
      position,
      nflTeam,
      ownership,
      injuryOnly,
      activeOnly,
    ]
  );


  const visiblePlayers =
    useMemo(
      () =>
        filteredPlayers.slice(
          0,
          visiblePlayerCount
        ),
      [
        filteredPlayers,
        visiblePlayerCount,
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


  const openAddPanel =
    useCallback(
      (
        playerId: number
      ) => {
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
      },
      []
    );


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


  return (
    <div
      style={
        styles.wrapper
      }
    >
      <style>{`
        .g365-position-tabs{scrollbar-width:none}
        .g365-position-tabs::-webkit-scrollbar{display:none}
        .g365-players-row{content-visibility:auto;contain-intrinsic-size:76px}
        @media (max-width:760px){
          .g365-position-tabs{display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))!important;overflow:visible!important;gap:8px!important}
          .g365-position-button{width:100%!important;padding:0 8px!important}
          .g365-players-filters{grid-template-columns:minmax(0,1fr)!important;gap:12px!important}
          .g365-checkbox-field{min-height:44px!important;padding:0 2px!important;gap:10px!important;white-space:normal!important}
          .g365-checkbox-field input{width:20px;height:20px;flex:0 0 auto;margin:0}
          .g365-players-table{width:100%!important;max-width:100%!important;overflow:hidden!important}
          .g365-players-table-header{display:none!important}
          .g365-players-row{min-width:0!important;width:100%!important;grid-template-columns:minmax(0,1fr) auto!important;grid-template-areas:"player action" "meta action"!important;gap:7px 12px!important;padding:12px!important;min-height:78px!important}
          .g365-player-identity{grid-area:player!important;min-width:0!important}
          .g365-player-mobile-meta{grid-area:meta!important;display:flex!important;align-items:center!important;gap:8px!important;min-width:0!important;padding-left:58px!important;flex-wrap:wrap!important}
          .g365-player-desktop-cell{display:none!important}
          .g365-player-action{grid-area:action!important;align-self:center!important}
          .g365-player-name{max-width:100%!important}
          .g365-player-headshot{width:46px!important;height:46px!important}
          .g365-load-more{width:100%!important}
          .g365-players-modal{width:calc(100vw - 24px)!important;max-width:calc(100vw - 24px)!important;max-height:calc(100dvh - 24px)!important}
        }
        @media (min-width:761px){
          .g365-player-mobile-meta{display:none!important}
        }
`}</style>
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
          className="g365-position-tabs"
          style={
            styles.positionTabs
          }
        >
          {positions.map(
            (
              item
            ) => (
              <button
                className="g365-position-button"
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


        <div className="g365-players-filters"
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
            className="g365-checkbox-field"
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
            className="g365-checkbox-field"
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
          found · showing {Math.min(
            visiblePlayerCount,
            filteredPlayers.length
          )}
        </span>
      </div>


      <section className="g365-players-table"
        style={
            styles.playerTable
          }
      >
        <div className="g365-players-table-header"
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
          visiblePlayers.map(
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


      {visiblePlayerCount <
      filteredPlayers.length ? (
        <button
          className="g365-load-more"
          type="button"
          onClick={() =>
            setVisiblePlayerCount(
              (current) =>
                Math.min(
                  current +
                    PLAYER_LOAD_INCREMENT,
                  filteredPlayers.length
                )
            )
          }
          style={
            styles.loadMoreButton
          }
        >
          Load More Players
        </button>
      ) : null}
    </div>
  );
}


const PlayerRow = memo(function PlayerRow({
  player,
  canManage,
  onAdd,
}: {
  player:
    TraditionalPlayerBrowserRow;

  canManage:
    boolean;

  onAdd:
    (
      playerId: number
    ) => void;
}) {
  const waiverTime =
    formatWaiverTime(
      player.waiverUntil
    );


  return (
    <article className="g365-players-row"
      style={
            styles.playerRow
          }
    >
      <div
        className="g365-player-identity"
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
              className="g365-player-headshot"
              src={
                player.headshotUrl
              }
              alt={
                player.fullName
              }
              width={50}
              height={50}
              loading="lazy"
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


        <div
          style={
            styles.playerText
          }
        >
          <strong
            className="g365-player-name"
            style={
              styles.playerName
            }
          >
            {player.fullName}
          </strong>

          {player.injuryStatus ? (
            <span
              title={
                player.injuryDetail ??
                player.injuryStatus
              }
              style={{
                ...styles.injuryBadge,
                ...getInjuryStyle(
                  player.injuryStatus
                ),
              }}
            >
              {player.injuryStatus}
            </span>
          ) : null}
        </div>
      </div>


      <strong
        className="g365-player-desktop-cell"
        style={
          styles.position
        }
      >
        {player.position}
      </strong>


      <span
        className="g365-player-desktop-cell"
        style={
          styles.nflTeam
        }
      >
        {player
          .teamAbbreviation ??
          "FA"}
      </span>


      <span className="g365-player-desktop-cell">
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
        className="g365-player-desktop-cell"
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


      <div className="g365-player-mobile-meta">
        <strong style={styles.position}>
          {player.position}
        </strong>
        <span style={styles.nflTeam}>
          {player.teamAbbreviation ?? "FA"}
        </span>
        {player.isActive ? (
          <span style={styles.activeBadge}>ACTIVE</span>
        ) : (
          <span style={styles.inactiveBadge}>INACTIVE</span>
        )}
        {player.isMyPlayer ? (
          <span style={styles.myTeamBadge}>MY TEAM</span>
        ) : player.isRostered ? (
          <span style={styles.rosteredBadge}>ROSTERED</span>
        ) : player.isOnWaivers ? (
          <span style={styles.waiverBadge}>WAIVERS</span>
        ) : (
          <span style={styles.freeAgentBadge}>FREE AGENT</span>
        )}
      </div>


      <div
        className="g365-player-action"
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
});


const styles = {
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


  playerName: {
    overflow:
      "hidden",

    textOverflow:
      "ellipsis",

    whiteSpace:
      "nowrap" as const,

    color:
      "#ffffff",

    fontSize:
      "14px",
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


  loadMoreButton: {
    minHeight: "44px",
    padding: "0 18px",
    justifySelf: "center",
    border: "1px solid rgba(255,100,15,.30)",
    borderRadius: "13px",
    background: "linear-gradient(135deg,rgba(190,20,20,.20),rgba(255,80,0,.12))",
    color: "#ffffff",
    fontSize: "14px",
    fontWeight: 900,
    cursor: "pointer",
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

