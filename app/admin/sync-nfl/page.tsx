"use client";

import {
  useState,
} from "react";

import {
  createClient,
} from "@supabase/supabase-js";


type SyncResult = {
  success?: boolean;
  error?: string;

  [key: string]:
    unknown;
};


type WorkingType =
  | "teams"
  | "players"
  | "schedule"
  | "injuries"
  | null;


function getBrowserSupabase() {
  const url =
    process.env
      .NEXT_PUBLIC_SUPABASE_URL;

  const key =
    process.env
      .NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env
      .NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (
    !url ||
    !key
  ) {
    throw new Error(
      "Supabase browser environment variables are missing."
    );
  }

  return createClient(
    url,
    key
  );
}


export default function SyncNflPage() {
  const [
    working,
    setWorking,
  ] =
    useState<WorkingType>(
      null
    );

  const [
    teamMessage,
    setTeamMessage,
  ] =
    useState("");

  const [
    playerMessage,
    setPlayerMessage,
  ] =
    useState("");

  const [
    scheduleMessage,
    setScheduleMessage,
  ] =
    useState("");

  const [
    injuryMessage,
    setInjuryMessage,
  ] =
    useState("");


  async function getAccessToken() {
    const supabase =
      getBrowserSupabase();

    const {
      data: {
        session,
      },
      error,
    } =
      await supabase.auth
        .getSession();

    if (error) {
      throw new Error(
        error.message
      );
    }

    if (
      !session?.access_token
    ) {
      throw new Error(
        "Your login session is missing. Sign in again."
      );
    }

    return session
      .access_token;
  }


  async function postAuthenticatedSync(
    endpoint: string,
    body?: unknown
  ) {
    const accessToken =
      await getAccessToken();

    const response =
      await fetch(
        endpoint,
        {
          method:
            "POST",

          headers: {
            Authorization:
              `Bearer ${accessToken}`,

            "Content-Type":
              "application/json",
          },

          body:
            JSON.stringify(
              body ??
              {}
            ),
        }
      );

    let data:
      SyncResult;

    try {
      data =
        (
          await response.json()
        ) as SyncResult;
    } catch {
      throw new Error(
        `The server returned HTTP ${response.status}, but no readable JSON response was returned.`
      );
    }

    if (
      !response.ok ||
      !data.success
    ) {
      throw new Error(
        typeof data.error ===
          "string"
          ? data.error
          : `Request failed with HTTP ${response.status}.`
      );
    }

    return data;
  }


  async function syncTeams() {
    if (working) {
      return;
    }

    setWorking(
      "teams"
    );

    setTeamMessage(
      "Syncing NFL teams..."
    );

    try {
      const data =
        await postAuthenticatedSync(
          "/api/nfl/sync-teams"
        );

      const count =
        data.teamsUpserted ??
        data.teamsSynced ??
        data.teamsProcessed ??
        data.count ??
        32;

      setTeamMessage(
        `Success: ${String(
          count
        )} NFL teams synced.`
      );
    } catch (error) {
      setTeamMessage(
        error instanceof Error
          ? error.message
          : "NFL team sync failed."
      );
    } finally {
      setWorking(
        null
      );
    }
  }


  async function syncPlayers() {
    if (working) {
      return;
    }

    setWorking(
      "players"
    );

    setPlayerMessage(
      "Syncing NFL players..."
    );

    try {
      const data =
        await postAuthenticatedSync(
          "/api/nfl/sync-players"
        );

      const count =
        data.playersUpserted ??
        data.playersSynced ??
        data.playersProcessed ??
        data.count ??
        "completed";

      setPlayerMessage(
        `Success: ${String(
          count
        )} NFL players synced.`
      );
    } catch (error) {
      setPlayerMessage(
        error instanceof Error
          ? error.message
          : "NFL player sync failed."
      );
    } finally {
      setWorking(
        null
      );
    }
  }


  async function syncSchedule() {
    if (working) {
      return;
    }

    setWorking(
      "schedule"
    );

    setScheduleMessage(
      "Syncing NFL schedule and bye weeks..."
    );

    try {
      const currentSeason =
        new Date()
          .getFullYear();

      const data =
        await postAuthenticatedSync(
          "/api/nfl/sync-schedule",
          {
            season:
              currentSeason,
          }
        );

      const games =
        data.gamesUpserted ??
        data.gamesSynced ??
        data.gamesProcessed ??
        data.games ??
        data.count ??
        "completed";

      const byeWeeks =
        data.byeWeeksUpdated ??
        data.byeWeeks ??
        null;

      if (
        byeWeeks !==
        null
      ) {
        setScheduleMessage(
          `Success: ${String(
            games
          )} games synced. ${String(
            byeWeeks
          )} bye weeks updated.`
        );
      } else {
        setScheduleMessage(
          `Success: NFL schedule sync ${String(
            games
          )}.`
        );
      }
    } catch (error) {
      setScheduleMessage(
        error instanceof Error
          ? error.message
          : "NFL schedule sync failed."
      );
    } finally {
      setWorking(
        null
      );
    }
  }


  async function syncInjuries() {
    if (working) {
      return;
    }

    setWorking(
      "injuries"
    );

    setInjuryMessage(
      "Syncing current NFL injuries..."
    );

    try {
      const response =
        await fetch(
          "/api/nfl/sync-injuries",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify(
                {}
              ),
          }
        );

      let data:
        SyncResult;

      try {
        data =
          (
            await response.json()
          ) as SyncResult;
      } catch {
        throw new Error(
          `The injury sync returned HTTP ${response.status} without readable JSON.`
        );
      }

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          typeof data.error ===
            "string"
            ? data.error
            : `NFL injury sync failed with HTTP ${response.status}.`
        );
      }

      const matched =
        Number(
          data.fantasyInjuriesMatched ??
          0
        );

      const totalEspn =
        Number(
          data.totalEspnRecords ??
          0
        );

      const inserted =
        Number(
          data.injuriesInserted ??
          0
        );

      const changed =
        Number(
          data.injuriesChanged ??
          0
        );

      const unchanged =
        Number(
          data.injuriesUnchanged ??
          0
        );

      const cleared =
        Number(
          data.injuriesCleared ??
          0
        );

      const unmatched =
        Number(
          data.unmatchedCount ??
          0
        );

      setInjuryMessage(
        `Success: ${matched} fantasy injuries matched from ${totalEspn} ESPN records. ${inserted} new, ${changed} changed, ${unchanged} unchanged, ${cleared} cleared, ${unmatched} unmatched.`
      );
    } catch (error) {
      setInjuryMessage(
        error instanceof Error
          ? error.message
          : "NFL injury sync failed."
      );
    } finally {
      setWorking(
        null
      );
    }
  }


  function messageIsError(
    message: string
  ) {
    const lower =
      message.toLowerCase();

    return (
      lower.includes(
        "failed"
      ) ||
      lower.includes(
        "error"
      ) ||
      lower.includes(
        "missing"
      ) ||
      lower.includes(
        "invalid"
      ) ||
      lower.includes(
        "no usable"
      ) ||
      lower.includes(
        "returned http"
      ) ||
      lower.includes(
        "left unchanged"
      ) ||
      lower.includes(
        "unable to"
      )
    );
  }


  function renderMessage(
    message: string
  ) {
    if (!message) {
      return null;
    }

    const isError =
      messageIsError(
        message
      );

    return (
      <div
        style={
          isError
            ? styles.errorMessage
            : styles.successMessage
        }
      >
        {message}
      </div>
    );
  }


  return (
    <main
      style={
        styles.page
      }
    >
      <div
        style={
          styles.container
        }
      >
        <div
          style={
            styles.pageHeader
          }
        >
          <p
            style={
              styles.eyebrow
            }
          >
            GRIDIRON365 ADMIN
          </p>

          <h1
            style={
              styles.pageTitle
            }
          >
            NFL Data Sync
          </h1>

          <p
            style={
              styles.pageDescription
            }
          >
            Manage ESPN NFL data used throughout
            Gridiron365.
          </p>
        </div>


        {/* NFL TEAMS */}

        <section
          style={
            styles.card
          }
        >
          <CardHeader
            eyebrow="ESPN TEAMS"
            title="NFL Teams"
            description="Sync all active NFL teams and team metadata."
          />

          <ActionButton
            disabled={
              working !==
              null
            }
            onClick={
              syncTeams
            }
          >
            {working ===
            "teams"
              ? "Syncing NFL Teams..."
              : "Sync NFL Teams"}
          </ActionButton>

          {renderMessage(
            teamMessage
          )}
        </section>


        {/* NFL PLAYERS */}

        <section
          style={
            styles.card
          }
        >
          <CardHeader
            eyebrow="ESPN PLAYERS"
            title="NFL Players"
            description="Sync fantasy-relevant NFL players, positions, teams, statuses, and headshots."
          />

          <ActionButton
            disabled={
              working !==
              null
            }
            onClick={
              syncPlayers
            }
          >
            {working ===
            "players"
              ? "Syncing NFL Players..."
              : "Sync NFL Players"}
          </ActionButton>

          {renderMessage(
            playerMessage
          )}
        </section>


        {/* NFL SCHEDULE */}

        <section
          style={
            styles.card
          }
        >
          <CardHeader
            eyebrow="ESPN SCHEDULE"
            title="NFL Schedule"
            description="Sync the NFL schedule, game information, and team bye weeks."
          />

          <ActionButton
            disabled={
              working !==
              null
            }
            onClick={
              syncSchedule
            }
          >
            {working ===
            "schedule"
              ? "Syncing NFL Schedule..."
              : "Sync NFL Schedule"}
          </ActionButton>

          {renderMessage(
            scheduleMessage
          )}
        </section>


        {/* NFL INJURIES */}

        <section
          style={
            styles.card
          }
        >
          <CardHeader
            eyebrow="ESPN INJURIES"
            title="NFL Injuries"
            description="Sync current fantasy-relevant NFL player injuries, statuses, injury details, and reported changes."
          />

          <ActionButton
            disabled={
              working !==
              null
            }
            onClick={
              syncInjuries
            }
          >
            {working ===
            "injuries"
              ? "Syncing NFL Injuries..."
              : "Sync NFL Injuries"}
          </ActionButton>

          {renderMessage(
            injuryMessage
          )}
        </section>
      </div>
    </main>
  );
}


function CardHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
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
          {eyebrow}
        </p>

        <h2
          style={
            styles.cardTitle
          }
        >
          {title}
        </h2>

        <p
          style={
            styles.cardDescription
          }
        >
          {description}
        </p>
      </div>

      <span
        style={
          styles.liveBadge
        }
      >
        LIVE DATA
      </span>
    </div>
  );
}


function ActionButton({
  children,
  disabled,
  onClick,
}: {
  children:
    React.ReactNode;

  disabled:
    boolean;

  onClick:
    () => void;
}) {
  return (
    <button
      type="button"
      disabled={
        disabled
      }
      onClick={
        onClick
      }
      style={{
        ...styles.button,

        opacity:
          disabled
            ? 0.6
            : 1,

        cursor:
          disabled
            ? "not-allowed"
            : "pointer",
      }}
    >
      {children}
    </button>
  );
}


const styles:
  Record<
    string,
    React.CSSProperties
  > =
{
  page: {
    minHeight:
      "100vh",

    background:
      "#030303",

    color:
      "#ffffff",

    padding:
      "32px 24px 80px",
  },


  container: {
    width:
      "100%",

    maxWidth:
      "900px",

    margin:
      "0 auto",
  },


  pageHeader: {
    marginBottom:
      "24px",
  },


  eyebrow: {
    margin:
      "0 0 6px",

    color:
      "#ff8a00",

    fontSize:
      "11px",

    fontWeight:
      900,

    letterSpacing:
      "1.4px",
  },


  pageTitle: {
    margin:
      "0",

    fontSize:
      "34px",

    lineHeight:
      1.1,

    fontWeight:
      900,
  },


  pageDescription: {
    margin:
      "10px 0 0",

    color:
      "#9aa7bf",

    fontSize:
      "14px",

    lineHeight:
      1.6,
  },


  card: {
    position:
      "relative",

    marginBottom:
      "20px",

    padding:
      "26px",

    overflow:
      "hidden",

    border:
      "1px solid #292929",

    borderTop:
      "3px solid #ff8a00",

    borderRadius:
      "16px",

    background:
      "linear-gradient(180deg, #121212 0%, #0b0b0b 100%)",

    boxShadow:
      "0 16px 40px rgba(0,0,0,.28)",
  },


  cardHeader: {
    display:
      "flex",

    alignItems:
      "flex-start",

    justifyContent:
      "space-between",

    gap:
      "20px",

    marginBottom:
      "22px",
  },


  cardEyebrow: {
    margin:
      "0 0 5px",

    color:
      "#ff8a00",

    fontSize:
      "10px",

    fontWeight:
      900,

    letterSpacing:
      "1px",
  },


  cardTitle: {
    margin:
      "0",

    fontSize:
      "24px",

    lineHeight:
      1.2,

    fontWeight:
      900,
  },


  cardDescription: {
    margin:
      "8px 0 0",

    maxWidth:
      "660px",

    color:
      "#9aa7bf",

    fontSize:
      "13px",

    lineHeight:
      1.55,
  },


  liveBadge: {
    flexShrink:
      0,

    padding:
      "7px 11px",

    border:
      "1px solid #754000",

    borderRadius:
      "7px",

    background:
      "#211405",

    color:
      "#ff9700",

    fontSize:
      "10px",

    fontWeight:
      900,

    letterSpacing:
      ".5px",
  },


  button: {
    width:
      "100%",

    minHeight:
      "47px",

    padding:
      "12px 18px",

    border:
      "none",

    borderRadius:
      "10px",

    background:
      "linear-gradient(90deg, #ff1010 0%, #ff7a00 100%)",

    color:
      "#ffffff",

    fontSize:
      "14px",

    fontWeight:
      900,
  },


  successMessage: {
    marginTop:
      "14px",

    padding:
      "13px 14px",

    border:
      "1px solid #075f3c",

    borderRadius:
      "9px",

    background:
      "#062b1e",

    color:
      "#7dffd0",

    fontSize:
      "13px",

    fontWeight:
      700,

    lineHeight:
      1.45,
  },


  errorMessage: {
    marginTop:
      "14px",

    padding:
      "13px 14px",

    border:
      "1px solid #8d2424",

    borderRadius:
      "9px",

    background:
      "#351111",

    color:
      "#ffb1b1",

    fontSize:
      "13px",

    fontWeight:
      700,

    lineHeight:
      1.45,
  },
};