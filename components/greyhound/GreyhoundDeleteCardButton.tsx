"use client";

import {
  useState,
} from "react";
import {
  useRouter,
} from "next/navigation";

type GreyhoundDeleteCardButtonProps = {
  leagueId: string;
  cardId: number;
  trackName: string;
  raceDate: string;
  session: string;
  disabled?: boolean;
};

type DeleteResponse = {
  success?: boolean;
  error?: string;
  message?: string;
  racesDeleted?: number;
  activity?: Record<string, number>;
};

function formatSession(
  value: string,
): string {
  if (!value) {
    return "Unknown";
  }

  return (
    value.charAt(0).toUpperCase() +
    value.slice(1)
  );
}

export default function GreyhoundDeleteCardButton({
  leagueId,
  cardId,
  trackName,
  raceDate,
  session,
  disabled = false,
}: GreyhoundDeleteCardButtonProps) {
  const router = useRouter();

  const [
    deleting,
    setDeleting,
  ] = useState(false);

  const handleDelete = async () => {
    if (
      deleting ||
      disabled
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        `Delete ${trackName} · ${raceDate} · ${formatSession(session)} card?\n\n` +
          "This will remove the saved card so the commissioner can re-import it. " +
          "The server will refuse the delete if wagers, race results, payouts, " +
          "Survivor picks, scratch replacements, or dog results already exist.",
      );

    if (!confirmed) {
      return;
    }

    try {
      setDeleting(true);

      const response =
        await fetch(
          "/api/greyhound/races/import",
          {
            method: "DELETE",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              leagueId,
              cardId,
            }),
          },
        );

      const payload =
        (await response
          .json()
          .catch(() => ({}))) as
          DeleteResponse;

      if (
        !response.ok ||
        payload.success !== true
      ) {
        let activityDetail = "";

        if (payload.activity) {
          const existingActivity =
            Object.entries(
              payload.activity,
            )
              .filter(
                ([, count]) =>
                  Number(count) > 0,
              )
              .map(
                ([label, count]) =>
                  `${label}: ${count}`,
              );

          if (
            existingActivity.length > 0
          ) {
            activityDetail =
              `\n\nExisting activity: ${existingActivity.join(", ")}`;
          }
        }

        throw new Error(
          `${
            payload.error ??
            payload.message ??
            `Delete failed with HTTP ${response.status}.`
          }${activityDetail}`,
        );
      }

      window.alert(
        payload.message ??
          `Card deleted successfully. ${payload.racesDeleted ?? 0} races were removed.`,
      );

      router.refresh();
    } catch (error) {
      console.error(
        "Greyhound card delete failed:",
        error,
      );

      window.alert(
        error instanceof Error
          ? error.message
          : "The Greyhound card could not be deleted.",
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <button
      type="button"
      className="gh-delete-card-button"
      onClick={handleDelete}
      disabled={
        disabled ||
        deleting
      }
      title={
        disabled
          ? "This card cannot be deleted in its current status."
          : "Delete this saved card so it can be imported again."
      }
    >
      {deleting
        ? "DELETING CARD..."
        : "DELETE CARD"}
    </button>
  );
}
