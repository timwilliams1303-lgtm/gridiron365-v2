"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

type Participant = {
  participantId: number;
  fantasyTeamId: number;
  userId: string | null;
  entryName: string;
  memberName: string;
  leagueRole: string | null;
  competitionTeamId: number | null;
  teamNumber: number | null;
  teamName: string | null;
};

type CompetitionTeam = {
  id: number;
  teamNumber: number;
  teamName: string;
  active: boolean;
};

type WorkspaceData = {
  success: true;
  leagueId: string;
  gameFormat:
    | "team_total_winnings"
    | "team_head_to_head"
    | "bankroll"
    | "survivor"
    | "tournament";
  teamSetupMode: "random" | "manual" | null;
  isTeamGame: boolean;
  competitionStartDate: string | null;
  competitionStarted: boolean;
  participants: Participant[];
  teams: CompetitionTeam[];
};

type ErrorResponse = {
  success?: false;
  error?: string;
};

type ApiResponse = WorkspaceData | ErrorResponse;

type Props = {
  leagueId: string;
};

const FORMAT_LABELS: Record<WorkspaceData["gameFormat"], string> = {
  team_total_winnings: "Team Season · Total Winnings",
  team_head_to_head: "Team Season · Head-to-Head",
  bankroll: "Bankroll Challenge",
  survivor: "Survivor",
  tournament: "Tournament",
};

function cleanName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export default function GreyhoundTeamsEntries({
  leagueId,
}: Props) {
  const [data, setData] = useState<WorkspaceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [entryNames, setEntryNames] = useState<Record<number, string>>({});
  const [teamNames, setTeamNames] = useState<Record<number, string>>({});
  const [newTeamName, setNewTeamName] = useState("");
  const [randomTeamCount, setRandomTeamCount] = useState(1);

  const load = useCallback(async () => {
    setError(null);

    try {
      const response = await fetch(
        `/api/greyhound/commissioner/teams-entries?leagueId=${encodeURIComponent(
          leagueId,
        )}`,
        {
          method: "GET",
          cache: "no-store",
        },
      );

      const payload = (await response.json()) as ApiResponse;

      if (!response.ok || !("success" in payload) || !payload.success) {
        throw new Error(
          "error" in payload && payload.error
            ? payload.error
            : "Unable to load Greyhound teams and entries.",
        );
      }

      setData(payload);

      setEntryNames(
        Object.fromEntries(
          payload.participants.map((participant) => [
            participant.participantId,
            participant.entryName,
          ]),
        ),
      );

      setTeamNames(
        Object.fromEntries(
          payload.teams.map((team) => [
            team.id,
            team.teamName,
          ]),
        ),
      );

      setRandomTeamCount((current) => {
        const participantCount = payload.participants.length;

        if (participantCount <= 0) {
          return 1;
        }

        if (payload.teams.length > 0) {
          return Math.min(
            Math.max(payload.teams.length, 1),
            participantCount,
          );
        }

        return Math.min(
          Math.max(current, 1),
          participantCount,
        );
      });
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load Greyhound teams and entries.",
      );
    } finally {
      setLoading(false);
    }
  }, [leagueId]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = useCallback(
    async (
      action: string,
      body: Record<string, unknown>,
      workingKey: string,
      successMessage: string,
    ) => {
      setWorking(workingKey);
      setError(null);
      setSuccess(null);

      try {
        const response = await fetch(
          "/api/greyhound/commissioner/teams-entries",
          {
            method: "POST",
            headers: {
              "content-type": "application/json",
            },
            body: JSON.stringify({
              leagueId,
              action,
              ...body,
            }),
          },
        );

        const payload = (await response.json()) as {
          success?: boolean;
          error?: string;
        };

        if (!response.ok || !payload.success) {
          throw new Error(
            payload.error ??
              "Unable to update Greyhound teams and entries.",
          );
        }

        setSuccess(successMessage);
        await load();
      } catch (actionError) {
        setError(
          actionError instanceof Error
            ? actionError.message
            : "Unable to update Greyhound teams and entries.",
        );
      } finally {
        setWorking(null);
      }
    },
    [leagueId, load],
  );

  const membersByTeam = useMemo(() => {
    const map = new Map<number, Participant[]>();

    for (const participant of data?.participants ?? []) {
      if (participant.competitionTeamId == null) {
        continue;
      }

      const members = map.get(participant.competitionTeamId) ?? [];
      members.push(participant);
      map.set(participant.competitionTeamId, members);
    }

    return map;
  }, [data?.participants]);

  const unassignedCount = useMemo(
    () =>
      (data?.participants ?? []).filter(
        (participant) => participant.competitionTeamId == null,
      ).length,
    [data?.participants],
  );

  async function saveEntryName(participant: Participant) {
    const name = cleanName(
      entryNames[participant.participantId] ?? "",
    );

    if (!name) {
      setError("Entry Name cannot be blank.");
      return;
    }

    await act(
      "save_entry_name",
      {
        participantId: participant.participantId,
        entryName: name,
      },
      `entry-${participant.participantId}`,
      `Entry Name saved for ${participant.memberName}.`,
    );
  }

  async function createTeam() {
    const name = cleanName(newTeamName);

    await act(
      "create_team",
      {
        teamName: name || null,
      },
      "create-team",
      "Team created.",
    );

    setNewTeamName("");
  }

  async function renameTeam(team: CompetitionTeam) {
    const name = cleanName(teamNames[team.id] ?? "");

    if (!name) {
      setError("Team Name cannot be blank.");
      return;
    }

    await act(
      "rename_team",
      {
        teamId: team.id,
        teamName: name,
      },
      `rename-team-${team.id}`,
      "Team Name saved.",
    );
  }

  async function deleteTeam(team: CompetitionTeam) {
    const confirmed = window.confirm(
      `Delete ${team.teamName}? Its members will become unassigned.`,
    );

    if (!confirmed) {
      return;
    }

    await act(
      "delete_team",
      {
        teamId: team.id,
      },
      `delete-team-${team.id}`,
      `${team.teamName} deleted.`,
    );
  }

  async function assignMember(
    participant: Participant,
    teamId: number | null,
  ) {
    if (teamId == null) {
      await act(
        "unassign_member",
        {
          participantId: participant.participantId,
        },
        `assign-${participant.participantId}`,
        `${participant.memberName} is now unassigned.`,
      );

      return;
    }

    await act(
      "assign_member",
      {
        participantId: participant.participantId,
        teamId,
      },
      `assign-${participant.participantId}`,
      `${participant.memberName} assigned.`,
    );
  }

  async function randomizeTeams() {
    if (!data) {
      return;
    }

    if (data.participants.length < 1) {
      setError("At least 1 active Greyhound participant is required.");
      return;
    }

    if (
      randomTeamCount < 1 ||
      randomTeamCount > data.participants.length
    ) {
      setError(
        `Choose between 1 and ${data.participants.length} team${
          data.participants.length === 1 ? "" : "s"
        }.`,
      );
      return;
    }

    const confirmed = window.confirm(
      "Randomizing replaces all current Greyhound team assignments and temporary team names. Continue?",
    );

    if (!confirmed) {
      return;
    }

    await act(
      "randomize_teams",
      {
        teamCount: randomTeamCount,
      },
      "randomize",
      "Teams randomized and members assigned.",
    );
  }

  if (loading && !data) {
    return (
      <main className="gte-page">
        <style>{pageStyles}</style>
        <div className="gte-shell">
          <div className="gte-loading">
            Loading Greyhound teams and entries…
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="gte-page">
      <style>{pageStyles}</style>

      <div className="gte-shell">
        <section className="gte-hero">
          <div className="gte-hero-inner">
            <div>
              <div className="gte-kicker">
                G365 Greyhound Racing · Commissioner
              </div>

              <h1>Teams &amp; Entries</h1>

              <p>
                Manage each member&apos;s personal Entry Name and, for team
                formats, build the shared competition teams used across League
                Wagers, Standings, Recap, and Trophy Case.
              </p>
            </div>

            <button
              type="button"
              className="gte-secondary-button"
              onClick={() => void load()}
              disabled={working != null}
            >
              Refresh
            </button>
          </div>

          <div className="gte-hero-accent" />
        </section>

        {error ? (
          <div className="gte-alert error">{error}</div>
        ) : null}

        {success ? (
          <div className="gte-alert success">{success}</div>
        ) : null}

        {data ? (
          <>
            <section className="gte-summary-grid">
              <article className="gte-summary-card">
                <span>GAME FORMAT</span>
                <strong>{FORMAT_LABELS[data.gameFormat]}</strong>
                <small>
                  {data.isTeamGame
                    ? "Shared Team Names are active"
                    : "Individual Entry Names are active"}
                </small>
              </article>

              <article className="gte-summary-card">
                <span>SETUP MODE</span>
                <strong>
                  {data.isTeamGame
                    ? data.teamSetupMode === "random"
                      ? "Random Teams"
                      : "Manual Teams"
                    : "Individual"}
                </strong>
                <small>
                  {data.isTeamGame
                    ? "Configured in Greyhound Settings"
                    : "No shared team assignment required"}
                </small>
              </article>

              <article className="gte-summary-card">
                <span>PARTICIPANTS</span>
                <strong>{data.participants.length}</strong>
                <small>Active Greyhound entries</small>
              </article>

              <article className="gte-summary-card">
                <span>COMPETITION STATUS</span>
                <strong>
                  {data.competitionStarted ? "Started" : "Pre-Competition"}
                </strong>
                <small>
                  {data.competitionStartDate
                    ? `Start: ${data.competitionStartDate}`
                    : "Start date not set"}
                </small>
              </article>
            </section>

            {data.isTeamGame ? (
              <section className="gte-panel">
                <div className="gte-panel-head">
                  <div>
                    <span className="gte-panel-kicker">
                      SHARED TEAM MANAGEMENT
                    </span>
                    <h2>
                      {data.teamSetupMode === "random"
                        ? "Random Team Setup"
                        : "Manual Team Setup"}
                    </h2>
                    <p>
                      One shared Team Name represents every assigned member in
                      team competition views.
                    </p>
                  </div>

                  <div
                    className={`gte-status-pill${
                      data.competitionStarted ? " locked" : ""
                    }`}
                  >
                    {data.competitionStarted
                      ? "ASSIGNMENTS LOCKED"
                      : "ASSIGNMENTS OPEN"}
                  </div>
                </div>

                {data.teamSetupMode === "random" ? (
                  <div className="gte-random-box">
                    <div>
                      <strong>Randomize Team Assignments</strong>
                      <p>
                        G365 creates balanced teams and assigns members randomly.
                        Initial names are Team 1, Team 2, and so on.
                      </p>
                    </div>

                    <div className="gte-random-actions">
                      <label>
                        <span>NUMBER OF TEAMS</span>
                        <input
                          type="number"
                          min={1}
                          max={Math.max(1, data.participants.length)}
                          value={randomTeamCount}
                          disabled={
                            data.competitionStarted ||
                            data.participants.length < 1 ||
                            working != null
                          }
                          onChange={(event) =>
                            setRandomTeamCount(
                              Number(event.target.value),
                            )
                          }
                        />
                      </label>

                      <button
                        type="button"
                        className="gte-primary-button"
                        disabled={
                          data.competitionStarted ||
                          data.participants.length < 1 ||
                          randomTeamCount < 1 ||
                          randomTeamCount > data.participants.length ||
                          working != null
                        }
                        onClick={() => void randomizeTeams()}
                      >
                        {working === "randomize"
                          ? "Randomizing…"
                          : data.teams.length > 0
                            ? "Randomize Again"
                            : "Create Random Teams"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="gte-create-row">
                    <label>
                      <span>NEW TEAM NAME</span>
                      <input
                        type="text"
                        maxLength={50}
                        value={newTeamName}
                        disabled={data.competitionStarted || working != null}
                        placeholder={`Team ${data.teams.length + 1}`}
                        onChange={(event) =>
                          setNewTeamName(event.target.value)
                        }
                      />
                    </label>

                    <button
                      type="button"
                      className="gte-primary-button"
                      disabled={data.competitionStarted || working != null}
                      onClick={() => void createTeam()}
                    >
                      {working === "create-team"
                        ? "Creating…"
                        : "Create Team"}
                    </button>
                  </div>
                )}

                {data.competitionStarted ? (
                  <div className="gte-lock-note">
                    Competition has started. Team creation, deletion,
                    randomization, and member reassignment are locked.
                    Commissioner Team Name corrections remain available.
                  </div>
                ) : null}

                <div className="gte-team-grid">
                  {data.teams.length === 0 ? (
                    <div className="gte-empty">
                      <strong>No shared teams created yet.</strong>
                      <span>
                        {data.teamSetupMode === "random"
                          ? "Choose the number of teams and run Randomize."
                          : "Create the first team, then assign members below."}
                      </span>
                    </div>
                  ) : (
                    data.teams.map((team) => {
                      const members = membersByTeam.get(team.id) ?? [];

                      return (
                        <article
                          key={team.id}
                          className="gte-team-card"
                        >
                          <div className="gte-team-number">
                            TEAM {team.teamNumber}
                          </div>

                          <div className="gte-team-name-row">
                            <input
                              type="text"
                              maxLength={50}
                              value={teamNames[team.id] ?? ""}
                              disabled={working != null}
                              onChange={(event) =>
                                setTeamNames((current) => ({
                                  ...current,
                                  [team.id]: event.target.value,
                                }))
                              }
                            />

                            <button
                              type="button"
                              className="gte-small-button"
                              disabled={working != null}
                              onClick={() => void renameTeam(team)}
                            >
                              {working === `rename-team-${team.id}`
                                ? "Saving…"
                                : "Save Name"}
                            </button>
                          </div>

                          <div className="gte-member-count">
                            {members.length}{" "}
                            {members.length === 1 ? "member" : "members"}
                          </div>

                          <div className="gte-member-chips">
                            {members.length === 0 ? (
                              <span className="gte-muted">
                                No members assigned
                              </span>
                            ) : (
                              members.map((member) => (
                                <span
                                  key={member.participantId}
                                  className="gte-member-chip"
                                >
                                  {member.memberName}
                                </span>
                              ))
                            )}
                          </div>

                          {data.teamSetupMode === "manual" ? (
                            <button
                              type="button"
                              className="gte-danger-button"
                              disabled={
                                data.competitionStarted || working != null
                              }
                              onClick={() => void deleteTeam(team)}
                            >
                              {working === `delete-team-${team.id}`
                                ? "Deleting…"
                                : "Delete Team"}
                            </button>
                          ) : null}
                        </article>
                      );
                    })
                  )}
                </div>
              </section>
            ) : null}

            <section className="gte-panel">
              <div className="gte-panel-head">
                <div>
                  <span className="gte-panel-kicker">
                    PARTICIPANT IDENTITY
                  </span>
                  <h2>
                    {data.isTeamGame
                      ? "Members & Entry Names"
                      : "Entry Names"}
                  </h2>
                  <p>
                    Entry Name remains the member&apos;s personal Greyhound
                    identity even when that member is assigned to a shared team.
                  </p>
                </div>

                {data.isTeamGame ? (
                  <div className="gte-unassigned">
                    {unassignedCount} UNASSIGNED
                  </div>
                ) : null}
              </div>

              <div className="gte-participant-list">
                {data.participants.length === 0 ? (
                  <div className="gte-empty">
                    <strong>No active participants found.</strong>
                    <span>
                      Active league members with Fantasy Team records will
                      appear here automatically.
                    </span>
                  </div>
                ) : (
                  data.participants.map((participant) => (
                    <article
                      key={participant.participantId}
                      className="gte-participant-row"
                    >
                      <div className="gte-person">
                        <div className="gte-avatar">
                          {participant.memberName
                            .slice(0, 2)
                            .toUpperCase()}
                        </div>

                        <div>
                          <strong>{participant.memberName}</strong>
                          <span>
                            {participant.leagueRole === "commissioner"
                              ? "Commissioner"
                              : "Member"}
                            {participant.teamName
                              ? ` · ${participant.teamName}`
                              : ""}
                          </span>
                        </div>
                      </div>

                      <label className="gte-entry-field">
                        <span>ENTRY NAME</span>
                        <div className="gte-inline-field">
                          <input
                            type="text"
                            maxLength={50}
                            value={
                              entryNames[participant.participantId] ?? ""
                            }
                            disabled={working != null}
                            onChange={(event) =>
                              setEntryNames((current) => ({
                                ...current,
                                [participant.participantId]:
                                  event.target.value,
                              }))
                            }
                          />

                          <button
                            type="button"
                            className="gte-small-button"
                            disabled={working != null}
                            onClick={() =>
                              void saveEntryName(participant)
                            }
                          >
                            {working ===
                            `entry-${participant.participantId}`
                              ? "Saving…"
                              : "Save"}
                          </button>
                        </div>
                      </label>

                      {data.isTeamGame ? (
                        <label className="gte-team-field">
                          <span>SHARED TEAM</span>

                          {data.teamSetupMode === "manual" ? (
                            <select
                              value={
                                participant.competitionTeamId ?? ""
                              }
                              disabled={
                                data.competitionStarted ||
                                working != null ||
                                data.teams.length === 0
                              }
                              onChange={(event) =>
                                void assignMember(
                                  participant,
                                  event.target.value
                                    ? Number(event.target.value)
                                    : null,
                                )
                              }
                            >
                              <option value="">Unassigned</option>

                              {data.teams.map((team) => (
                                <option
                                  key={team.id}
                                  value={team.id}
                                >
                                  {team.teamName}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <div className="gte-assignment-display">
                              {participant.teamName ?? "Unassigned"}
                            </div>
                          )}
                        </label>
                      ) : null}
                    </article>
                  ))
                )}
              </div>
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}

const pageStyles = `
  .gte-page,
  .gte-page * {
    box-sizing: border-box;
  }

  .gte-page {
    min-height: 100vh;
    padding: 20px 18px 72px;
    background:
      radial-gradient(circle at 12% -5%, rgba(153, 29, 22, .24), transparent 31%),
      radial-gradient(circle at 89% 7%, rgba(242, 107, 34, .10), transparent 24%),
      linear-gradient(180deg, #07080a 0%, #0b0c0f 46%, #07080a 100%);
    color: #fff;
  }

  .gte-shell {
    width: min(1500px, 100%);
    margin: 0 auto;
  }

  .gte-loading,
  .gte-empty {
    border: 1px solid #2b2d31;
    border-radius: 16px;
    background: #101113;
    color: #a3a7ad;
    padding: 24px;
  }

  .gte-empty {
    grid-column: 1 / -1;
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .gte-empty strong {
    color: #fff;
    font-size: 14px;
  }

  .gte-empty span {
    font-size: 11px;
  }

  .gte-hero {
    overflow: hidden;
    border: 1px solid rgba(255, 107, 34, .30);
    border-radius: 20px;
    background:
      linear-gradient(125deg, rgba(125, 19, 14, .60), rgba(70, 18, 12, .46) 34%, rgba(255, 107, 34, .07) 66%, #101114);
    box-shadow: 0 22px 60px rgba(0, 0, 0, .36);
  }

  .gte-hero-inner {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 20px;
    padding: 27px 28px 25px;
  }

  .gte-kicker,
  .gte-panel-kicker,
  .gte-summary-card > span,
  .gte-entry-field > span,
  .gte-team-field > span,
  .gte-create-row label > span,
  .gte-random-actions label > span {
    color: #e76227;
    font-size: 9px;
    font-weight: 950;
    letter-spacing: .14em;
    text-transform: uppercase;
  }

  .gte-hero h1 {
    margin: 7px 0 8px;
    font-size: clamp(30px, 4vw, 46px);
    line-height: 1;
    font-weight: 950;
    letter-spacing: -.04em;
  }

  .gte-hero p {
    max-width: 900px;
    margin: 0;
    color: #a8abb1;
    font-size: 12px;
    line-height: 1.7;
    font-weight: 650;
  }

  .gte-hero-accent {
    height: 4px;
    background: linear-gradient(90deg, #8f1713, #cb341a 45%, #f26b22 78%, #ff8a3d);
  }

  .gte-primary-button,
  .gte-secondary-button,
  .gte-small-button,
  .gte-danger-button {
    min-height: 42px;
    border-radius: 10px;
    font: inherit;
    font-size: 9px;
    font-weight: 950;
    letter-spacing: .07em;
    text-transform: uppercase;
    cursor: pointer;
  }

  .gte-primary-button {
    border: 1px solid rgba(255, 119, 42, .38);
    background: linear-gradient(90deg, #991d16, #cb341a 52%, #ee641e);
    color: #fff;
    padding: 0 16px;
  }

  .gte-secondary-button {
    flex: 0 0 auto;
    border: 1px solid #3a3d42;
    background: #17181b;
    color: #e4e5e7;
    padding: 0 15px;
  }

  .gte-small-button {
    min-height: 38px;
    border: 1px solid rgba(240, 102, 37, .34);
    background: #2a1712;
    color: #ffb084;
    padding: 0 12px;
    white-space: nowrap;
  }

  .gte-danger-button {
    width: 100%;
    margin-top: 13px;
    border: 1px solid rgba(190, 45, 34, .38);
    background: rgba(109, 22, 17, .22);
    color: #ef8b82;
  }

  button:disabled,
  select:disabled,
  input:disabled {
    cursor: not-allowed !important;
    opacity: .48;
  }

  .gte-alert {
    margin-top: 12px;
    padding: 12px 14px;
    border-radius: 11px;
    font-size: 11px;
    font-weight: 750;
  }

  .gte-alert.error {
    border: 1px solid rgba(210, 55, 43, .42);
    background: rgba(112, 24, 19, .30);
    color: #ffb0a8;
  }

  .gte-alert.success {
    border: 1px solid rgba(47, 157, 90, .38);
    background: rgba(20, 89, 50, .25);
    color: #99e7b9;
  }

  .gte-summary-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 10px;
    margin: 14px 0;
  }

  .gte-summary-card {
    min-height: 112px;
    padding: 15px 16px;
    border: 1px solid #2b2d31;
    border-radius: 15px;
    background:
      linear-gradient(145deg, rgba(75, 20, 12, .24), transparent 58%),
      #101114;
  }

  .gte-summary-card strong {
    display: block;
    margin-top: 8px;
    color: #fff;
    font-size: 17px;
    line-height: 1.15;
    font-weight: 950;
  }

  .gte-summary-card small {
    display: block;
    margin-top: 6px;
    color: #777c84;
    font-size: 9px;
    line-height: 1.45;
    font-weight: 650;
  }

  .gte-panel {
    margin-top: 14px;
    padding: 18px;
    border: 1px solid #2b2d31;
    border-radius: 18px;
    background:
      linear-gradient(145deg, rgba(82, 20, 12, .18), transparent 40%),
      #101113;
    box-shadow: 0 16px 36px rgba(0,0,0,.24);
  }

  .gte-panel-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 15px;
  }

  .gte-panel-head h2 {
    margin: 5px 0 0;
    font-size: 23px;
    font-weight: 950;
    letter-spacing: -.025em;
  }

  .gte-panel-head p {
    max-width: 820px;
    margin: 5px 0 0;
    color: #858a92;
    font-size: 10px;
    line-height: 1.6;
  }

  .gte-status-pill,
  .gte-unassigned {
    flex: 0 0 auto;
    padding: 8px 10px;
    border: 1px solid rgba(54, 163, 96, .35);
    border-radius: 999px;
    background: rgba(20, 94, 52, .22);
    color: #91e3b3;
    font-size: 8px;
    font-weight: 950;
    letter-spacing: .08em;
  }

  .gte-status-pill.locked,
  .gte-unassigned {
    border-color: rgba(230, 96, 35, .35);
    background: rgba(99, 35, 13, .25);
    color: #ffad79;
  }

  .gte-random-box {
    display: flex;
    align-items: end;
    justify-content: space-between;
    gap: 18px;
    margin-bottom: 15px;
    padding: 15px;
    border: 1px solid #303237;
    border-radius: 13px;
    background: #151619;
  }

  .gte-random-box strong {
    font-size: 13px;
  }

  .gte-random-box p {
    max-width: 700px;
    margin: 5px 0 0;
    color: #7f848b;
    font-size: 10px;
    line-height: 1.55;
  }

  .gte-random-actions,
  .gte-create-row {
    display: flex;
    align-items: end;
    gap: 10px;
  }

  .gte-random-actions label,
  .gte-create-row label {
    display: grid;
    gap: 6px;
  }

  .gte-random-actions input {
    width: 105px;
  }

  .gte-create-row {
    margin-bottom: 15px;
  }

  .gte-create-row label {
    flex: 1;
    max-width: 480px;
  }

  .gte-page input,
  .gte-page select,
  .gte-assignment-display {
    width: 100%;
    min-height: 40px;
    border: 1px solid #383b40;
    border-radius: 9px;
    outline: none;
    background: #0d0e10;
    color: #fff;
    padding: 0 11px;
    font: inherit;
    font-size: 11px;
    font-weight: 700;
  }

  .gte-page input:focus,
  .gte-page select:focus {
    border-color: #e25a24;
    box-shadow: 0 0 0 3px rgba(226, 90, 36, .10);
  }

  .gte-lock-note {
    margin-bottom: 14px;
    padding: 10px 12px;
    border: 1px solid rgba(228, 95, 35, .28);
    border-radius: 10px;
    background: rgba(81, 29, 12, .22);
    color: #dca17f;
    font-size: 9px;
    line-height: 1.5;
    font-weight: 700;
  }

  .gte-team-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 11px;
  }

  .gte-team-card {
    min-width: 0;
    padding: 14px;
    border: 1px solid #303237;
    border-radius: 14px;
    background: #151619;
  }

  .gte-team-number {
    color: #e76227;
    font-size: 8px;
    font-weight: 950;
    letter-spacing: .13em;
  }

  .gte-team-name-row,
  .gte-inline-field {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .gte-team-name-row {
    margin-top: 8px;
  }

  .gte-team-name-row input,
  .gte-inline-field input {
    min-width: 0;
    flex: 1;
  }

  .gte-member-count {
    margin-top: 13px;
    color: #777c83;
    font-size: 9px;
    font-weight: 850;
    text-transform: uppercase;
    letter-spacing: .06em;
  }

  .gte-member-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 8px;
  }

  .gte-member-chip {
    display: inline-flex;
    min-height: 28px;
    align-items: center;
    padding: 0 9px;
    border: 1px solid #36383d;
    border-radius: 999px;
    background: #0e0f11;
    color: #d9dade;
    font-size: 9px;
    font-weight: 750;
  }

  .gte-muted {
    color: #666b73;
    font-size: 9px;
  }

  .gte-participant-list {
    display: grid;
    gap: 8px;
  }

  .gte-participant-row {
    display: grid;
    grid-template-columns: minmax(220px, .9fr) minmax(280px, 1.2fr) minmax(190px, .7fr);
    gap: 12px;
    align-items: end;
    padding: 12px;
    border: 1px solid #2d2f34;
    border-radius: 12px;
    background: #141518;
  }

  .gte-person {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 40px;
  }

  .gte-avatar {
    display: flex;
    width: 38px;
    height: 38px;
    flex: 0 0 auto;
    align-items: center;
    justify-content: center;
    border: 1px solid rgba(235, 99, 35, .36);
    border-radius: 10px;
    background: linear-gradient(145deg, #761b14, #3e1911);
    color: #ffc09b;
    font-size: 10px;
    font-weight: 950;
  }

  .gte-person strong {
    display: block;
    font-size: 11px;
  }

  .gte-person span {
    display: block;
    margin-top: 3px;
    color: #737880;
    font-size: 8px;
    font-weight: 700;
  }

  .gte-entry-field,
  .gte-team-field {
    display: grid;
    gap: 6px;
  }

  .gte-assignment-display {
    display: flex;
    align-items: center;
    color: #b7bac0;
  }

  @media (max-width: 1050px) {
    .gte-summary-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .gte-team-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .gte-participant-row {
      grid-template-columns: 1fr 1fr;
    }

    .gte-person {
      grid-column: 1 / -1;
    }
  }

  @media (max-width: 700px) {
    .gte-page {
      padding: 12px 10px 70px;
    }

    .gte-hero-inner,
    .gte-panel-head,
    .gte-random-box {
      flex-direction: column;
    }

    .gte-hero-inner {
      padding: 19px 16px;
    }

    .gte-secondary-button,
    .gte-status-pill,
    .gte-unassigned {
      width: 100%;
      text-align: center;
      justify-content: center;
    }

    .gte-summary-grid,
    .gte-team-grid,
    .gte-participant-row {
      grid-template-columns: 1fr;
    }

    .gte-panel {
      padding: 14px 12px;
    }

    .gte-random-actions,
    .gte-create-row,
    .gte-team-name-row,
    .gte-inline-field {
      width: 100%;
    }

    .gte-random-actions,
    .gte-create-row {
      align-items: stretch;
      flex-direction: column;
    }

    .gte-random-actions input {
      width: 100%;
    }

    .gte-create-row label {
      max-width: none;
    }

    .gte-team-name-row,
    .gte-inline-field {
      align-items: stretch;
      flex-direction: column;
    }

    .gte-small-button,
    .gte-primary-button {
      width: 100%;
    }

    .gte-person {
      grid-column: auto;
    }
  }

  @media (max-width: 430px) {
    .gte-summary-grid {
      grid-template-columns: 1fr;
    }
  }
`;
