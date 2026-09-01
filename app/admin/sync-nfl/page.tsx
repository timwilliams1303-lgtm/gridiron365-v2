"use client";

import {
  useState,
} from "react";

import {
  createSupabaseBrowserClient,
} from "@/lib/supabase/browser";


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
  return createSupabaseBrowserClient();
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


  async function postCookieSessionSync(
    endpoint: string,
    body?: unknown
  ) {
    const response =
      await fetch(
        endpoint,
        {
          method:
            "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          credentials:
            "same-origin",

          cache:
            "no-store",

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
        "completed";

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
        await postCookieSessionSync(
          "/api/nfl/sync-players"
        );

      const count =
        data.playersUpserted ??
        data.playersSynced ??
        data.playersProcessed ??
        data.count ??
        "completed";

      const received =
        data.playersReceived;

      const processed =
        data.teamsProcessed;

      const failed =
        data.teamsFailed;

      const extra =
        [
          received !== undefined
            ? `${String(
                received
              )} received`
            : null,

          processed !== undefined
            ? `${String(
                processed
              )} teams processed`
            : null,

          failed !== undefined
            ? `${String(
                failed
              )} teams failed`
            : null,
        ]
          .filter(
            Boolean
          )
          .join(
            " • "
          );

      setPlayerMessage(
        `Success: ${String(
          count
        )} NFL players synced.${
          extra
            ? ` ${extra}.`
            : ""
        }`
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
        data.count ??
        "completed";

      setScheduleMessage(
        `Success: ${String(
          games
        )} NFL schedule records synced.`
      );
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
      "Syncing NFL injuries..."
    );

    try {
      const data =
        await postAuthenticatedSync(
          "/api/nfl/sync-injuries"
        );

      const count =
        data.fantasyAndDefensiveInjuriesMatched ??
        data.fantasyInjuriesMatched ??
        data.injuriesUpserted ??
        data.injuriesProcessed ??
        data.count ??
        "completed";

      const inserted =
        data.injuriesInserted;

      const changed =
        data.injuriesChanged;

      const cleared =
        data.injuriesCleared;

      const extra =
        [
          inserted !== undefined
            ? `${String(
                inserted
              )} inserted`
            : null,

          changed !== undefined
            ? `${String(
                changed
              )} changed`
            : null,

          cleared !== undefined
            ? `${String(
                cleared
              )} cleared`
            : null,
        ]
          .filter(
            Boolean
          )
          .join(
            " • "
          );

      setInjuryMessage(
        `Success: ${String(
          count
        )} NFL injury records synced.${
          extra
            ? ` ${extra}.`
            : ""
        }`
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


  const cardStyle:
    React.CSSProperties =
  {
    border:
      "1px solid rgba(255,255,255,0.10)",

    borderRadius:
      18,

    padding:
      22,

    background:
      "linear-gradient(180deg, rgba(29,29,32,0.98), rgba(17,17,19,0.98))",

    boxShadow:
      "0 18px 50px rgba(0,0,0,0.24)",
  };


  const buttonStyle:
    React.CSSProperties =
  {
    width:
      "100%",

    minHeight:
      48,

    border:
      0,

    borderRadius:
      12,

    padding:
      "12px 18px",

    fontWeight:
      800,

    fontSize:
      14,

    cursor:
      working
        ? "not-allowed"
        : "pointer",

    color:
      "#fff",

    background:
      working
        ? "#4a4a4f"
        : "linear-gradient(135deg, #d71920 0%, #ff6a00 100%)",

    opacity:
      working
        ? 0.65
        : 1,
  };


  const messageStyle:
    React.CSSProperties =
  {
    minHeight:
      22,

    marginTop:
      12,

    color:
      "#c6c8cd",

    fontSize:
      13,

    lineHeight:
      1.5,

    overflowWrap:
      "anywhere",
  };


  return (
    <main
      style={{
        minHeight:
          "100vh",

        background:
          "#0b0b0d",

        color:
          "#fff",

        padding:
          "32px 18px 48px",
      }}
    >
      <div
        style={{
          width:
            "min(980px, 100%)",

          margin:
            "0 auto",
        }}
      >
        <div
          style={{
            marginBottom:
              24,
          }}
        >
          <div
            style={{
              display:
                "inline-flex",

              alignItems:
                "center",

              gap:
                8,

              padding:
                "6px 10px",

              borderRadius:
                999,

              color:
                "#ff9a4a",

              background:
                "rgba(255,106,0,0.10)",

              border:
                "1px solid rgba(255,106,0,0.22)",

              fontSize:
                12,

              fontWeight:
                800,

              letterSpacing:
                0.6,

              textTransform:
                "uppercase",
            }}
          >
            Gridiron365 Admin
          </div>

          <h1
            style={{
              margin:
                "12px 0 8px",

              fontSize:
                "clamp(28px, 5vw, 42px)",

              lineHeight:
                1.05,
            }}
          >
            NFL Data Sync
          </h1>

          <p
            style={{
              margin:
                0,

              color:
                "#a9adb5",

              lineHeight:
                1.6,
            }}
          >
            Manually refresh ESPN-backed NFL data.
            Run Teams before Players when rebuilding
            the player pool, then Schedule and
            Injuries as needed.
          </p>
        </div>

        <section
          style={{
            display:
              "grid",

            gridTemplateColumns:
              "repeat(auto-fit, minmax(240px, 1fr))",

            gap:
              16,
          }}
        >
          <article
            style={
              cardStyle
            }
          >
            <h2
              style={{
                margin:
                  "0 0 8px",

                fontSize:
                  19,
              }}
            >
              NFL Teams
            </h2>

            <p
              style={{
                margin:
                  "0 0 16px",

                color:
                  "#9da1a9",

                fontSize:
                  13,

                lineHeight:
                  1.5,
              }}
            >
              Refresh the 32 NFL team records.
            </p>

            <button
              type="button"
              disabled={
                working !==
                null
              }
              onClick={
                syncTeams
              }
              style={
                buttonStyle
              }
            >
              {working ===
              "teams"
                ? "Syncing Teams..."
                : "Sync Teams"}
            </button>

            <div
              style={
                messageStyle
              }
            >
              {teamMessage}
            </div>
          </article>

          <article
            style={
              cardStyle
            }
          >
            <h2
              style={{
                margin:
                  "0 0 8px",

                fontSize:
                  19,
              }}
            >
              NFL Players
            </h2>

            <p
              style={{
                margin:
                  "0 0 16px",

                color:
                  "#9da1a9",

                fontSize:
                  13,

                lineHeight:
                  1.5,
              }}
            >
              Refresh offensive, kicking,
              defensive, and synthetic DST
              player records.
            </p>

            <button
              type="button"
              disabled={
                working !==
                null
              }
              onClick={
                syncPlayers
              }
              style={
                buttonStyle
              }
            >
              {working ===
              "players"
                ? "Syncing Players..."
                : "Sync Players"}
            </button>

            <div
              style={
                messageStyle
              }
            >
              {playerMessage}
            </div>
          </article>

          <article
            style={
              cardStyle
            }
          >
            <h2
              style={{
                margin:
                  "0 0 8px",

                fontSize:
                  19,
              }}
            >
              NFL Schedule
            </h2>

            <p
              style={{
                margin:
                  "0 0 16px",

                color:
                  "#9da1a9",

                fontSize:
                  13,

                lineHeight:
                  1.5,
              }}
            >
              Refresh the current NFL schedule
              and bye-week information.
            </p>

            <button
              type="button"
              disabled={
                working !==
                null
              }
              onClick={
                syncSchedule
              }
              style={
                buttonStyle
              }
            >
              {working ===
              "schedule"
                ? "Syncing Schedule..."
                : "Sync Schedule"}
            </button>

            <div
              style={
                messageStyle
              }
            >
              {scheduleMessage}
            </div>
          </article>

          <article
            style={
              cardStyle
            }
          >
            <h2
              style={{
                margin:
                  "0 0 8px",

                fontSize:
                  19,
              }}
            >
              NFL Injuries
            </h2>

            <p
              style={{
                margin:
                  "0 0 16px",

                color:
                  "#9da1a9",

                fontSize:
                  13,

                lineHeight:
                  1.5,
              }}
            >
              Refresh current ESPN offensive
              and defensive injury designations.
            </p>

            <button
              type="button"
              disabled={
                working !==
                null
              }
              onClick={
                syncInjuries
              }
              style={
                buttonStyle
              }
            >
              {working ===
              "injuries"
                ? "Syncing Injuries..."
                : "Sync Injuries"}
            </button>

            <div
              style={
                messageStyle
              }
            >
              {injuryMessage}
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}
