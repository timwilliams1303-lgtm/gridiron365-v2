"use client";

import { FormEvent, useRef, useState, useTransition } from "react";

type RenameResult = {
  success: boolean;
  teamName: string;
};

type Props = {
  leagueId: string;
  fantasyTeamId: number;
  currentTeamName: string;
  renameAction: (formData: FormData) => Promise<RenameResult>;
};

export default function NhlTraditionalTeamNameEditor({
  leagueId,
  fantasyTeamId,
  currentTeamName,
  renameAction,
}: Props) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    const form = event.currentTarget;
    const formData = new FormData(form);

    startTransition(async () => {
      try {
        const result = await renameAction(formData);

        if (!result?.success) {
          setMessage("Unable to save team name.");
          return;
        }

        if (detailsRef.current) {
          detailsRef.current.open = false;
        }

        setMessage("Team name saved successfully.");
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : "Unable to save team name."
        );
      }
    });
  }

  return (
    <div>
      <details ref={detailsRef} className="g365-nhl-team-name-editor">
        <summary>Edit Team Name</summary>

        <form onSubmit={handleSubmit}>
          <input type="hidden" name="leagueId" value={leagueId} />
          <input type="hidden" name="fantasyTeamId" value={fantasyTeamId} />

          <input
            type="text"
            name="teamName"
            defaultValue={currentTeamName}
            maxLength={40}
            required
            aria-label="Team name"
            disabled={isPending}
          />

          <button type="submit" disabled={isPending}>
            {isPending ? "SAVING..." : "SAVE"}
          </button>
        </form>
      </details>

      {message ? (
        <p
          role="status"
          style={{
            margin: "8px 0 0",
            fontSize: "0.82rem",
            fontWeight: 800,
          }}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
