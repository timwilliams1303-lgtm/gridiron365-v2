"use client";

import Image from "next/image";

import {
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import type {
  TraditionalWaiverClaimRow,
} from "@/lib/traditional/waivers.service";


type Props = {
  leagueId: string;

  claims:
    TraditionalWaiverClaimRow[];
};


function formatDateTime(
  value:
    string |
    null
) {
  if (!value) {
    return "—";
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
    return "—";
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


export default function TraditionalWaiverClaims({
  leagueId,
  claims,
}: Props) {
  const router =
    useRouter();


  const [
    cancellingClaimId,
    setCancellingClaimId,
  ] =
    useState<
      number |
      null
    >(
      null
    );


  const [
    movingClaimId,
    setMovingClaimId,
  ] =
    useState<
      number |
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
    message,
    setMessage,
  ] =
    useState<
      string |
      null
    >(
      null
    );


  async function reorderClaim(
    claimId: number,
    direction:
      "up" |
      "down"
  ) {
    setMovingClaimId(
      claimId
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
          `/api/league/${leagueId}/waivers/reorder`,
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                claimId,
                direction,
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
            changed?: boolean;

            reason?: string;
          };
        };


      try {
        result =
          JSON.parse(
            responseText
          );
      } catch {
        throw new Error(
          `The waiver API returned an invalid response (${response.status}).`
        );
      }


      if (
        !response.ok ||
        !result.success
      ) {
        throw new Error(
          result.error ??
          "The waiver claim order could not be updated."
        );
      }


      if (
        result.result
          ?.changed ===
        false
      ) {
        setMessage(
          result.result.reason ===
          "already_first"
            ? "That claim is already your highest priority."
            : "That claim is already your lowest priority."
        );
      } else {
        setMessage(
          "Waiver claim priority updated."
        );
      }


      router.refresh();
    } catch (
      reorderError
    ) {
      setError(
        reorderError instanceof Error
          ? reorderError.message
          : "The waiver claim order could not be updated."
      );
    } finally {
      setMovingClaimId(
        null
      );
    }
  }


  async function cancelClaim(
    claimId: number
  ) {
    setCancellingClaimId(
      claimId
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
          `/api/league/${leagueId}/waivers/cancel`,
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                claimId,
              }),
          }
        );


      const responseText =
        await response.text();


      let result:
        {
          success?: boolean;

          error?: string;
        };


      try {
        result =
          JSON.parse(
            responseText
          );
      } catch {
        throw new Error(
          `The waiver API returned an invalid response (${response.status}).`
        );
      }


      if (
        !response.ok ||
        !result.success
      ) {
        throw new Error(
          result.error ??
          "The waiver claim could not be cancelled."
        );
      }


      setMessage(
        "Waiver claim cancelled."
      );


      router.refresh();
    } catch (
      cancelError
    ) {
      setError(
        cancelError instanceof Error
          ? cancelError.message
          : "The waiver claim could not be cancelled."
      );
    } finally {
      setCancellingClaimId(
        null
      );
    }
  }


  return (
    <div
className="g365-wrapper g365-waivers-root" style={styles.wrapper}
    >
      <style jsx global>{`
@media (max-width: 760px) {
  .g365-waivers-root { gap: 8px !important; min-width: 0 !important; }
  .g365-waivers-root .g365-claimRow {
    grid-template-columns: 58px minmax(0,1fr) !important;
    gap: 10px !important; padding: 12px 10px !important; min-height: 0 !important;
    align-items: start !important;
  }
  .g365-waivers-root .g365-rankColumn { grid-row: 1 / span 3 !important; }
  .g365-waivers-root .g365-playerIdentity { min-width: 0 !important; }
  .g365-waivers-root .g365-claimInfo,
  .g365-waivers-root .g365-actionCell { grid-column: 2 !important; width: 100% !important; min-width: 0 !important; }
  .g365-waivers-root button { min-height: 40px !important; }
}
@media (max-height: 500px) and (orientation: landscape) and (max-width: 950px) {
  .g365-waivers-root { width: 100% !important; max-width: 100% !important; min-width: 0 !important; }
  .g365-waivers-root .g365-claimRow { grid-template-columns: 58px minmax(0,1fr) !important; gap: 10px !important; padding: 12px 10px !important; }
  .g365-waivers-root .g365-rankColumn { grid-row: 1 / span 3 !important; }
  .g365-waivers-root .g365-claimInfo, .g365-waivers-root .g365-actionCell { grid-column: 2 !important; width: 100% !important; min-width: 0 !important; }
}
@media (max-width: 430px) {
  .g365-waivers-root .g365-headshotWrap { width: 40px !important; height: 40px !important; }
  .g365-waivers-root .g365-headshot, .g365-waivers-root .g365-headshotFallback { width: 40px !important; height: 40px !important; }
}
`}</style>
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


      {claims.length >
      0 ? (
        <div
className="g365-claimList" style={styles.claimList}
        >
          {claims.map(
            (
              claim,
              index
            ) => {
              const isFirst =
                index === 0;

              const isLast =
                index ===
                claims.length -
                  1;


              return (
                <article
                  key={
                    claim.claimId
                  }
className="g365-claimRow" style={styles.claimRow}
                >
                  <div
className="g365-rankColumn" style={styles.rankColumn}
                  >
                    <span
className="g365-rankLabel" style={styles.rankLabel}
                    >
                      CLAIM
                    </span>

                    <strong
className="g365-rankValue" style={styles.rankValue}
                    >
                      #
                      {claim.claimRank ??
                        index +
                          1}
                    </strong>


                    <div
className="g365-rankButtons" style={styles.rankButtons}
                    >
                      <button
                        type="button"
                        disabled={
                          isFirst ||
                          movingClaimId !==
                            null
                        }
                        onClick={() =>
                          void reorderClaim(
                            claim.claimId,
                            "up"
                          )
                        }
                        style={{
                          ...styles.rankButton,

                          ...(isFirst
                            ? styles.rankButtonDisabled
                            : {}),
                        }}
                        title="Move claim up"
                      >
                        ↑
                      </button>


                      <button
                        type="button"
                        disabled={
                          isLast ||
                          movingClaimId !==
                            null
                        }
                        onClick={() =>
                          void reorderClaim(
                            claim.claimId,
                            "down"
                          )
                        }
                        style={{
                          ...styles.rankButton,

                          ...(isLast
                            ? styles.rankButtonDisabled
                            : {}),
                        }}
                        title="Move claim down"
                      >
                        ↓
                      </button>
                    </div>
                  </div>


                  <div
className="g365-playerIdentity" style={styles.playerIdentity}
                  >
                    <div
className="g365-headshotWrap" style={styles.headshotWrap}
                    >
                      {claim
                        .playerHeadshotUrl ? (
                        <Image
                          src={
                            claim
                              .playerHeadshotUrl
                          }
                          alt={
                            claim
                              .playerName
                          }
                          width={48}
                          height={48}
className="g365-headshot" style={styles.headshot}
                        />
                      ) : (
                        <div
className="g365-headshotFallback" style={styles.headshotFallback}
                        >
                          {claim
                            .playerPosition}
                        </div>
                      )}
                    </div>


                    <div
className="g365-playerText" style={styles.playerText}
                    >
                      <strong
className="g365-playerName" style={styles.playerName}
                      >
                        {claim
                          .playerName}
                      </strong>

                      <span
className="g365-playerMeta" style={styles.playerMeta}
                      >
                        {claim
                          .playerPosition}

                        {claim
                          .playerTeamAbbreviation
                          ? ` • ${claim.playerTeamAbbreviation}`
                          : ""}
                      </span>

                      {claim
                        .dropPlayerName ? (
                        <span
className="g365-dropText" style={styles.dropText}
                        >
                          Drop:{" "}
                          {claim
                            .dropPlayerName}
                        </span>
                      ) : null}
                    </div>
                  </div>


                  <div
className="g365-claimInfo" style={styles.claimInfo}
                  >
                    <span
className="g365-infoLabel" style={styles.infoLabel}
                    >
                      PROCESS
                    </span>

                    <strong
className="g365-infoValue" style={styles.infoValue}
                    >
                      {formatDateTime(
                        claim
                          .processAfter
                      )}
                    </strong>
                  </div>


                  <div
className="g365-actionCell" style={styles.actionCell}
                  >
                    <button
                      type="button"
                      disabled={
                        cancellingClaimId ===
                          claim.claimId ||
                        movingClaimId !==
                          null
                      }
                      onClick={() =>
                        void cancelClaim(
                          claim.claimId
                        )
                      }
className="g365-cancelButton" style={styles.cancelButton}
                    >
                      {cancellingClaimId ===
                      claim.claimId
                        ? "Cancelling..."
                        : "Cancel"}
                    </button>
                  </div>
                </article>
              );
            }
          )}
        </div>
      ) : (
        <div
className="g365-emptyState" style={styles.emptyState}
        >
          <strong>
            No pending waiver claims
          </strong>

          <span>
            Submit claims from the Players
            page. Once you have multiple
            claims, use the arrows to rank
            them in the order you want them
            processed.
          </span>
        </div>
      )}
    </div>
  );
}


const styles = {
  wrapper: {
    display:
      "grid",

    gap:
      "10px",
  },


  successMessage: {
    margin:
      "12px 12px 0",

    padding:
      "10px 12px",

    border:
      "1px solid rgba(60,215,130,.18)",

    borderRadius:
      "7px",

    background:
      "rgba(45,190,105,.07)",

    color:
      "#48dc89",

    fontSize:
      "10px",

    fontWeight:
      800,
  },


  errorMessage: {
    margin:
      "12px 12px 0",

    padding:
      "10px 12px",

    border:
      "1px solid rgba(255,70,70,.20)",

    borderRadius:
      "7px",

    background:
      "rgba(210,25,25,.08)",

    color:
      "#ff7373",

    fontSize:
      "10px",

    fontWeight:
      800,
  },


  claimList: {
    display:
      "grid",
  },


  claimRow: {
    minHeight:
      "92px",

    padding:
      "12px 15px",

    display:
      "grid",

    gridTemplateColumns:
      "90px minmax(260px,1fr) minmax(130px,170px) 90px",

    alignItems:
      "center",

    gap:
      "14px",

    borderBottom:
      "1px solid rgba(255,255,255,.055)",
  },


  rankColumn: {
    display:
      "grid",

    justifyItems:
      "center",

    gap:
      "5px",
  },


  rankLabel: {
    color:
      "#686f78",

    fontSize:
      "7px",

    fontWeight:
      900,

    letterSpacing:
      ".08em",
  },


  rankValue: {
    color:
      "#ff8a24",

    fontSize:
      "15px",
  },


  rankButtons: {
    display:
      "flex",

    gap:
      "4px",
  },


  rankButton: {
    width:
      "27px",

    height:
      "25px",

    display:
      "inline-flex",

    alignItems:
      "center",

    justifyContent:
      "center",

    border:
      "1px solid rgba(255,105,20,.24)",

    borderRadius:
      "5px",

    background:
      "rgba(255,80,15,.07)",

    color:
      "#ff8b27",

    fontSize:
      "13px",

    fontWeight:
      950,

    cursor:
      "pointer",
  },


  rankButtonDisabled: {
    opacity:
      0.25,

    cursor:
      "default",
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
    color:
      "#ffffff",

    fontSize:
      "12px",
  },


  playerMeta: {
    color:
      "#7d848e",

    fontSize:
      "9px",
  },


  dropText: {
    color:
      "#ff9560",

    fontSize:
      "8px",
  },


  claimInfo: {
    minWidth:
      0,

    display:
      "grid",

    gap:
      "3px",
  },


  infoLabel: {
    color:
      "#626974",

    fontSize:
      "7px",

    fontWeight:
      900,
  },


  infoValue: {
    color:
      "#d8dbe0",

    fontSize:
      "9px",
  },


  actionCell: {
    display:
      "flex",

    justifyContent:
      "flex-end",
  },


  cancelButton: {
    minHeight:
      "30px",

    padding:
      "0 10px",

    border:
      "1px solid rgba(255,90,70,.25)",

    borderRadius:
      "6px",

    background:
      "rgba(205,35,25,.10)",

    color:
      "#ff7c6f",

    fontSize:
      "8px",

    fontWeight:
      950,

    cursor:
      "pointer",
  },


  emptyState: {
    minHeight:
      "150px",

    padding:
      "24px",

    display:
      "grid",

    alignContent:
      "center",

    gap:
      "6px",

    color:
      "#ffffff",
  },
};