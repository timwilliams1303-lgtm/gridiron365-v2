"use client";

import Image from "next/image";

import {
  useMemo,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";


type LineupPlayer = {
  playerId: number;
  fullName: string;
  position: string;
  teamAbbreviation:
    string | null;
  headshotUrl:
    string | null;
  lineupSlot:
    string | null;
  slotIndex:
    number | null;
  isLocked: boolean;
  injuryStatus:
    string | null;
  injuryDetail:
    string | null;
};


type RosterSettings = {
  startingQb: number;
  startingRb: number;
  startingWr: number;
  startingTe: number;
  startingFlex: number;
  startingSuperflex: number;
  startingK: number;
  startingDst: number;
  benchSlots: number;
  irSlots: number;
};


type SlotDefinition = {
  slot: string;
  index: number;
};


type TraditionalLineupManagerProps = {
  leagueId: string;
  fantasyTeamId: number;
  season: number;
  week: number;

  players:
    LineupPlayer[];

  rosterSettings:
    RosterSettings;
};


function createSlots(
  settings:
    RosterSettings
) {
  const slots:
    SlotDefinition[] =
      [];


  function add(
    slot: string,
    count: number
  ) {
    for (
      let index = 1;
      index <= count;
      index += 1
    ) {
      slots.push({
        slot,
        index,
      });
    }
  }


  add(
    "QB",
    settings.startingQb
  );

  add(
    "RB",
    settings.startingRb
  );

  add(
    "WR",
    settings.startingWr
  );

  add(
    "TE",
    settings.startingTe
  );

  add(
    "FLEX",
    settings.startingFlex
  );

  add(
    "SUPERFLEX",
    settings.startingSuperflex
  );

  add(
    "K",
    settings.startingK
  );

  add(
    "DST",
    settings.startingDst
  );

  add(
    "BENCH",
    settings.benchSlots
  );

  add(
    "IR",
    settings.irSlots
  );


  return slots;
}


function slotKey(
  slot: string,
  index: number
) {
  return `${slot}:${index}`;
}


function eligibleForSlot(
  player:
    LineupPlayer,
  slot: string
) {
  const position =
    player.position
      .toUpperCase()
      .replace(
        "PK",
        "K"
      );


  if (
    slot === "BENCH"
  ) {
    return true;
  }


  if (
    slot === "IR"
  ) {
    const injury =
      (
        player
          .injuryStatus ??
        ""
      ).toUpperCase();


    return (
      injury.includes(
        "IR"
      ) ||
      injury.includes(
        "OUT"
      ) ||
      injury.includes(
        "PUP"
      ) ||
      injury.includes(
        "NFI"
      )
    );
  }


  if (
    slot === "FLEX"
  ) {
    return [
      "RB",
      "WR",
      "TE",
    ].includes(
      position
    );
  }


  if (
    slot === "SUPERFLEX"
  ) {
    return [
      "QB",
      "RB",
      "WR",
      "TE",
    ].includes(
      position
    );
  }


  return (
    position === slot
  );
}


export default function TraditionalLineupManager({
  leagueId,
  fantasyTeamId,
  season,
  week,
  players,
  rosterSettings,
}: TraditionalLineupManagerProps) {
  const router =
    useRouter();


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
    saving,
    setSaving,
  ] =
    useState(
      false
    );


  const [
    droppingPlayerId,
    setDroppingPlayerId,
  ] =
    useState<
      number |
      null
    >(
      null
    );


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


  const slots =
    useMemo(
      () =>
        createSlots(
          rosterSettings
        ),
      [
        rosterSettings,
      ]
    );


  const playersBySlot =
    useMemo(
      () => {
        const map =
          new Map<
            string,
            LineupPlayer
          >();

        const usedPlayerIds =
          new Set<number>();

        const normalizeSlot =
          (value: string) => {
            const normalized =
              value.toUpperCase();

            if (
              ["BN", "BE", "RESERVE"].includes(
                normalized
              )
            ) {
              return "BENCH";
            }

            return normalized;
          };

        // First honor every player that already has an explicit
        // lineup slot and slot index. This remains the source of
        // truth for starters, BENCH, and IR.
        for (const player of players) {
          if (
            player.lineupSlot &&
            player.slotIndex !== null
          ) {
            const normalizedSlot =
              normalizeSlot(
                player.lineupSlot
              );

            map.set(
              slotKey(
                normalizedSlot,
                player.slotIndex
              ),
              player
            );

            usedPlayerIds.add(
              player.playerId
            );
          }
        }

        // Older roster rows can have BENCH/IR recorded without a
        // slot index. Put those players into the configured reserve
        // slots instead of rendering blank BENCH/IR rows.
        for (const reserveSlot of ["IR", "BENCH"]) {
          const availableDefinitions =
            slots.filter(
              (definition) =>
                definition.slot === reserveSlot &&
                !map.has(
                  slotKey(
                    definition.slot,
                    definition.index
                  )
                )
            );

          const matchingPlayers =
            players.filter((player) => {
              if (
                usedPlayerIds.has(
                  player.playerId
                ) ||
                !player.lineupSlot
              ) {
                return false;
              }

              return (
                normalizeSlot(
                  player.lineupSlot
                ) === reserveSlot
              );
            });

          matchingPlayers.forEach(
            (player, index) => {
              const definition =
                availableDefinitions[index];

              if (!definition) {
                return;
              }

              map.set(
                slotKey(
                  definition.slot,
                  definition.index
                ),
                player
              );

              usedPlayerIds.add(
                player.playerId
              );
            }
          );
        }

        // Any remaining roster player with no lineup slot is a
        // legacy/unassigned reserve. Display that player in the next
        // open BENCH slot so there is only one reserve area on My Team.
        const openBenchSlots =
          slots.filter(
            (definition) =>
              definition.slot === "BENCH" &&
              !map.has(
                slotKey(
                  definition.slot,
                  definition.index
                )
              )
          );

        const unassignedPlayers =
          players.filter(
            (player) =>
              !usedPlayerIds.has(
                player.playerId
              )
          );

        unassignedPlayers.forEach(
          (player, index) => {
            const definition =
              openBenchSlots[index];

            if (!definition) {
              return;
            }

            map.set(
              slotKey(
                definition.slot,
                definition.index
              ),
              player
            );
          }
        );

        return map;
      },
      [
        players,
        slots,
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


  async function movePlayer(
    slot: string,
    index: number
  ) {
    if (
      !selectedPlayer
    ) {
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
      const response =
        await fetch(
          `/api/league/${leagueId}/lineup/move`,
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

                targetSlot:
                  slot,

                targetSlotIndex:
                  index,
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
          "The lineup move failed."
        );
      }


      const action =
        result.result
          ?.action;


      setMessage(
        action ===
          "swap"
          ? "Players swapped successfully."
          : action ===
              "move"
            ? "Player moved successfully."
            : "Lineup is already up to date."
      );


      setSelectedPlayerId(
        null
      );


      router.refresh();
    } catch (
      moveError
    ) {
      setError(
        moveError instanceof Error
          ? moveError.message
          : "The lineup move failed."
      );
    } finally {
      setSaving(
        false
      );
    }
  }


  async function dropPlayer(
    player: LineupPlayer
  ) {
    if (
      player.isLocked
    ) {
      setError(
        "This player is locked and cannot be dropped."
      );

      return;
    }


    const confirmed =
      window.confirm(
        `Drop ${player.fullName}? This player will be removed from your roster and placed on waivers according to the league waiver rules.`
      );


    if (!confirmed) {
      return;
    }


    setDroppingPlayerId(
      player.playerId
    );

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
      const response =
        await fetch(
          `/api/league/${leagueId}/team/drop-player`,
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
                  player.playerId,
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
            waiverUntil?:
              string |
              null;
          };
        };


      try {
        result =
          JSON.parse(
            responseText
          );
      } catch {
        console.error(
          "Drop player API returned non-JSON:",
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
          "The player could not be dropped."
        );
      }


      setSelectedPlayerId(
        null
      );


      setMessage(
        `${player.fullName} was dropped and placed on waivers.`
      );


      router.refresh();
    } catch (
      dropError
    ) {
      setError(
        dropError instanceof Error
          ? dropError.message
          : "The player could not be dropped."
      );
    } finally {
      setDroppingPlayerId(
        null
      );

      setSaving(
        false
      );
    }
  }


  const startingSlots =
    slots.filter(
      (
        slot
      ) =>
        ![
          "BENCH",
          "IR",
        ].includes(
          slot.slot
        )
    );


  const reserveSlots =
    slots.filter(
      (
        slot
      ) =>
        [
          "BENCH",
          "IR",
        ].includes(
          slot.slot
        )
    );


  return (
    <div
className="g365-wrapper g365-lineup-root" style={styles.wrapper}
    >
      <style jsx global>{`
@media (max-width: 760px) {
  .g365-lineup-root { gap: 14px !important; min-width: 0 !important; }
  .g365-lineup-root .g365-instructions { padding: 12px !important; align-items: flex-start !important; }
  .g365-lineup-root .g365-lineupGrid,
  .g365-lineup-root .g365-grid,
  .g365-lineup-root .g365-slotGrid { grid-template-columns: minmax(0,1fr) !important; }
  .g365-lineup-root .g365-slotRow,
  .g365-lineup-root .g365-playerRow { min-width: 0 !important; }
  .g365-lineup-root .g365-playerIdentity { min-width: 0 !important; }
  .g365-lineup-root .g365-actions { flex-wrap: wrap !important; }
  .g365-lineup-root button { min-height: 42px !important; }
}
@media (max-width: 430px) {
  .g365-lineup-root .g365-headshotWrap,
  .g365-lineup-root .g365-headshot,
  .g365-lineup-root .g365-headshotFallback { width: 40px !important; height: 40px !important; }
}
`}</style>
      <div
className="g365-instructions" style={styles.instructions}
      >
        <div>
          <strong
className="g365-instructionsTitle" style={styles.instructionsTitle}
          >
            Edit Week {week} Lineup
          </strong>

          <span
className="g365-instructionsText" style={styles.instructionsText}
          >
            Select a player, then select
            the lineup slot where you
            want that player placed.
          </span>
        </div>


        {selectedPlayer ? (
          <div
className="g365-selectedChip" style={styles.selectedChip}
          >
            <span>
              Selected
            </span>

            <strong>
              {selectedPlayer.fullName}
            </strong>

            <button
              type="button"
              onClick={() =>
                setSelectedPlayerId(
                  null
                )
              }
className="g365-clearButton" style={styles.clearButton}
            >
              Clear
            </button>
          </div>
        ) : null}
      </div>


      {message ? (
        <div
className="g365-successMessage" style={styles.successMessage}
        >
          {message}
        </div>
      ) : null}


      {error ? (
        <div
className="g365-errorMessage" style={styles.errorMessage}
        >
          {error}
        </div>
      ) : null}


      <section>
        <div
className="g365-sectionHeading" style={styles.sectionHeading}
        >
          <strong>
            Starting Lineup
          </strong>

          <span>
            Week {week}
          </span>
        </div>


        <div
className="g365-slotList" style={styles.slotList}
        >
          {startingSlots.map(
            (
              definition
            ) => (
              <LineupSlot
                key={
                  slotKey(
                    definition.slot,
                    definition.index
                  )
                }

                definition={
                  definition
                }

                player={
                  playersBySlot.get(
                    slotKey(
                      definition.slot,
                      definition.index
                    )
                  ) ??
                  null
                }

                selectedPlayer={
                  selectedPlayer
                }

                saving={
                  saving
                }

                onSelectPlayer={
                  setSelectedPlayerId
                }

                onMovePlayer={
                  movePlayer
                }

                droppingPlayerId={
                  droppingPlayerId
                }

                onDropPlayer={
                  dropPlayer
                }
              />
            )
          )}
        </div>
      </section>


      <section>
        <div
className="g365-sectionHeading" style={styles.sectionHeading}
        >
          <strong>
            Bench & IR
          </strong>

          <span>
            Reserve roster
          </span>
        </div>


        <div
className="g365-slotList" style={styles.slotList}
        >
          {reserveSlots.map(
            (
              definition
            ) => (
              <LineupSlot
                key={
                  slotKey(
                    definition.slot,
                    definition.index
                  )
                }

                definition={
                  definition
                }

                player={
                  playersBySlot.get(
                    slotKey(
                      definition.slot,
                      definition.index
                    )
                  ) ??
                  null
                }

                selectedPlayer={
                  selectedPlayer
                }

                saving={
                  saving
                }

                onSelectPlayer={
                  setSelectedPlayerId
                }

                onMovePlayer={
                  movePlayer
                }

                droppingPlayerId={
                  droppingPlayerId
                }

                onDropPlayer={
                  dropPlayer
                }
              />
            )
          )}
        </div>
      </section>
    </div>
  );
}


function LineupSlot({
  definition,
  player,
  selectedPlayer,
  saving,
  onSelectPlayer,
  onMovePlayer,
  droppingPlayerId,
  onDropPlayer,
}: {
  definition:
    SlotDefinition;

  player:
    LineupPlayer |
    null;

  selectedPlayer:
    LineupPlayer |
    null;

  saving:
    boolean;

  onSelectPlayer:
    (
      playerId:
        number |
        null
    ) => void;

  onMovePlayer:
    (
      slot: string,
      index: number
    ) => void;

  droppingPlayerId:
    number |
    null;

  onDropPlayer:
    (
      player:
        LineupPlayer
    ) => void;
}) {
  const selected =
    player !== null &&
    selectedPlayer
      ?.playerId ===
      player.playerId;


  const canTarget =
    selectedPlayer !==
      null &&
    !selectedPlayer
      .isLocked &&
    eligibleForSlot(
      selectedPlayer,
      definition.slot
    );


  return (
    <article
      style={{
        ...styles.slotRow,

        ...(selected
          ? styles.slotRowSelected
          : {}),

        ...(canTarget
          ? styles.slotRowTarget
          : {}),
      }}
    >
      <div
className="g365-slotLabelColumn" style={styles.slotLabelColumn}
      >
        <strong
className="g365-slotBadge" style={styles.slotBadge}
        >
          {definition.slot}
        </strong>

        <span
className="g365-slotNumber" style={styles.slotNumber}
        >
          #{definition.index}
        </span>
      </div>


      {player ? (
        <button
          type="button"
          disabled={
            saving
          }
          onClick={() => {
            if (
              selectedPlayer &&
              selectedPlayer.playerId !==
                player.playerId &&
              canTarget
            ) {
              void onMovePlayer(
                definition.slot,
                definition.index
              );

              return;
            }


            if (
              player.isLocked
            ) {
              return;
            }


            onSelectPlayer(
              selected
                ? null
                : player.playerId
            );
          }}
className="g365-playerButton" style={styles.playerButton}
        >
          <PlayerIdentity
            player={
              player
            }
          />
        </button>
      ) : (
        <button
          type="button"
          disabled={
            !canTarget ||
            saving
          }
          onClick={() => {
            if (
              canTarget
            ) {
              void onMovePlayer(
                definition.slot,
                definition.index
              );
            }
          }}
          style={{
            ...styles.emptySlot,

            ...(canTarget
              ? styles.emptySlotTarget
              : {}),
          }}
        >
          {canTarget
            ? `Move ${selectedPlayer?.fullName} here`
            : "Empty"}
        </button>
      )}


      <div
className="g365-rowStatus" style={styles.rowStatus}
      >
        {player
          ?.isLocked ? (
          <span
className="g365-lockedBadge" style={styles.lockedBadge}
          >
            LOCKED
          </span>
        ) : (
          <>
            {selected ? (
              <span
className="g365-selectedBadge" style={styles.selectedBadge}
              >
                SELECTED
              </span>
            ) : canTarget ? (
              <button
                type="button"
                disabled={
                  saving
                }
                onClick={() =>
                  void onMovePlayer(
                    definition.slot,
                    definition.index
                  )
                }
className="g365-moveHereButton" style={styles.moveHereButton}
              >
                MOVE HERE
              </button>
            ) : null}


            {player ? (
              <button
                type="button"
                disabled={
                  saving ||
                  droppingPlayerId ===
                    player.playerId
                }
                onClick={() =>
                  void onDropPlayer(
                    player
                  )
                }
className="g365-dropButton" style={styles.dropButton}
              >
                {droppingPlayerId ===
                player.playerId
                  ? "DROPPING..."
                  : "DROP"}
              </button>
            ) : null}
          </>
        )}
      </div>
    </article>
  );
}


function PlayerIdentity({
  player,
}: {
  player:
    LineupPlayer;
}) {
  return (
    <div
className="g365-playerIdentity" style={styles.playerIdentity}
    >
      <div
className="g365-headshotWrap" style={styles.headshotWrap}
      >
        {player.headshotUrl ? (
          <Image
            src={
              player.headshotUrl
            }
            alt={
              player.fullName
            }
            width={48}
            height={48}
className="g365-headshot" style={styles.headshot}
          />
        ) : (
          <div
className="g365-headshotFallback" style={styles.headshotFallback}
          >
            {player.position}
          </div>
        )}
      </div>


      <div
className="g365-playerText" style={styles.playerText}
      >
        <strong
className="g365-playerName" style={styles.playerName}
        >
          {player.fullName}
        </strong>

        <span
className="g365-playerMeta" style={styles.playerMeta}
        >
          {player.position}

          {player
            .teamAbbreviation
            ? ` • ${player.teamAbbreviation}`
            : ""}
        </span>

        {player.injuryStatus ? (
          <span
            title={
              player.injuryDetail ??
              player.injuryStatus
            }
className="g365-injuryText" style={styles.injuryText}
          >
            {player.injuryStatus}
          </span>
        ) : null}
      </div>
    </div>
  );
}


const styles = {
  wrapper: {
    display:
      "grid",

    gap:
      "26px",
  },


  instructions: {
    padding:
      "16px 18px",

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

    border:
      "1px solid rgba(255,105,20,.14)",

    borderRadius:
      "10px",

    background:
      "linear-gradient(135deg,rgba(180,20,20,.08),rgba(255,85,0,.045))",
  },


  instructionsTitle: {
    display:
      "block",

    color:
      "#ffffff",

    fontSize:
      "13px",
  },


  instructionsText: {
    display:
      "block",

    marginTop:
      "4px",

    color:
      "#858c96",

    fontSize:
      "10px",
  },


  selectedChip: {
    display:
      "flex",

    alignItems:
      "center",

    gap:
      "8px",

    color:
      "#ffffff",

    fontSize:
      "10px",
  },


  clearButton: {
    padding:
      "5px 8px",

    border:
      "1px solid rgba(255,255,255,.10)",

    borderRadius:
      "6px",

    background:
      "rgba(255,255,255,.04)",

    color:
      "#aeb3bb",

    cursor:
      "pointer",
  },


  successMessage: {
    padding:
      "11px 13px",

    border:
      "1px solid rgba(55,210,120,.18)",

    borderRadius:
      "8px",

    background:
      "rgba(45,190,105,.07)",

    color:
      "#48dc89",

    fontSize:
      "11px",

    fontWeight:
      800,
  },


  errorMessage: {
    padding:
      "11px 13px",

    border:
      "1px solid rgba(255,70,70,.20)",

    borderRadius:
      "8px",

    background:
      "rgba(210,25,25,.08)",

    color:
      "#ff7373",

    fontSize:
      "11px",

    fontWeight:
      800,
  },


  sectionHeading: {
    marginBottom:
      "10px",

    display:
      "flex",

    alignItems:
      "center",

    justifyContent:
      "space-between",

    color:
      "#ffffff",

    fontSize:
      "13px",
  },


  slotList: {
    overflow:
      "hidden",

    border:
      "1px solid rgba(255,255,255,.075)",

    borderRadius:
      "11px",

    background:
      "linear-gradient(145deg,#141415,#09090a)",
  },


  slotRow: {
    minHeight:
      "72px",

    padding:
      "9px 13px",

    display:
      "grid",

    gridTemplateColumns:
      "65px minmax(0,1fr) 95px",

    alignItems:
      "center",

    gap:
      "12px",

    borderBottom:
      "1px solid rgba(255,255,255,.055)",
  },


  slotRowSelected: {
    background:
      "rgba(255,75,15,.08)",
  },


  slotRowTarget: {
    boxShadow:
      "inset 3px 0 0 rgba(255,105,20,.60)",
  },


  slotLabelColumn: {
    display:
      "grid",

    justifyItems:
      "center",

    gap:
      "3px",
  },


  slotBadge: {
    minWidth:
      "43px",

    padding:
      "6px 6px",

    border:
      "1px solid rgba(255,105,20,.18)",

    borderRadius:
      "6px",

    background:
      "rgba(255,82,15,.06)",

    color:
      "#ff8523",

    fontSize:
      "8px",

    fontWeight:
      950,

    textAlign:
      "center" as const,
  },


  slotNumber: {
    color:
      "#5f6670",

    fontSize:
      "7px",
  },


  playerButton: {
    width:
      "100%",

    padding:
      0,

    border:
      0,

    background:
      "transparent",

    textAlign:
      "left" as const,

    cursor:
      "pointer",
  },


  playerIdentity: {
    minWidth:
      0,

    display:
      "flex",

    alignItems:
      "center",

    gap:
      "11px",
  },


  headshotWrap: {
    width:
      "48px",

    height:
      "48px",

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
      "48px",

    height:
      "48px",

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
      "#737a84",

    fontSize:
      "8px",

    fontWeight:
      900,
  },


  playerText: {
    minWidth:
      0,

    display:
      "grid",

    gap:
      "3px",
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
      "12px",
  },


  playerMeta: {
    color:
      "#7c838d",

    fontSize:
      "9px",

    fontWeight:
      700,
  },


  injuryText: {
    color:
      "#ff952d",

    fontSize:
      "8px",

    fontWeight:
      850,
  },


  emptySlot: {
    minHeight:
      "48px",

    width:
      "100%",

    border:
      "1px dashed rgba(255,255,255,.08)",

    borderRadius:
      "7px",

    background:
      "rgba(255,255,255,.018)",

    color:
      "#5f6670",

    cursor:
      "default",
  },


  emptySlotTarget: {
    border:
      "1px dashed rgba(255,110,20,.35)",

    background:
      "rgba(255,80,15,.055)",

    color:
      "#ff8a25",

    cursor:
      "pointer",
  },


  rowStatus: {
    display:
      "flex",

    alignItems:
      "center",

    justifyContent:
      "flex-end",

    gap:
      "7px",

    flexWrap:
      "wrap" as const,
  },


  lockedBadge: {
    padding:
      "5px 7px",

    borderRadius:
      "5px",

    background:
      "rgba(255,255,255,.05)",

    color:
      "#747b85",

    fontSize:
      "7px",

    fontWeight:
      900,
  },


  selectedBadge: {
    padding:
      "5px 7px",

    borderRadius:
      "5px",

    background:
      "rgba(255,75,15,.10)",

    color:
      "#ff8425",

    fontSize:
      "7px",

    fontWeight:
      950,
  },


  dropButton: {
    minHeight:
      "31px",

    padding:
      "0 9px",

    border:
      "1px solid rgba(255,80,70,.26)",

    borderRadius:
      "6px",

    background:
      "rgba(190,30,25,.10)",

    color:
      "#ff7c70",

    fontSize:
      "7px",

    fontWeight:
      950,

    cursor:
      "pointer",
  },


  moveHereButton: {
    minHeight:
      "31px",

    padding:
      "0 9px",

    border:
      "1px solid rgba(255,102,20,.30)",

    borderRadius:
      "6px",

    background:
      "linear-gradient(135deg,#bc1717,#f25000)",

    color:
      "#ffffff",

    fontSize:
      "7px",

    fontWeight:
      950,

    cursor:
      "pointer",
  },
};