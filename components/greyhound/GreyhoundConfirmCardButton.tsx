"use client";

import {
  useRouter,
} from "next/navigation";

import {
  useState,
} from "react";

type GreyhoundConfirmCardButtonProps = {
  leagueId: string;
  cardId: number;
  confirmed: boolean;
  disabled?: boolean;
};

export default function GreyhoundConfirmCardButton({
  leagueId,
  cardId,
  confirmed,
  disabled = false,
}: GreyhoundConfirmCardButtonProps) {
  const router = useRouter();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const handleConfirm = async () => {
    if (busy || disabled || confirmed) {
      return;
    }

    const shouldContinue = window.confirm(
      "Confirm this Greyhound race card for racing? Once confirmed, it can move into the scratch, lock, and race lifecycle.",
    );

    if (!shouldContinue) {
      return;
    }

    setBusy(true);
    setError("");

    try {
      const response = await fetch(
        `/api/greyhound/cards/${cardId}/confirm`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            leagueId,
          }),
        },
      );

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          result?.error ??
            `Confirmation failed with HTTP ${response.status}.`,
        );
      }

      router.refresh();
    } catch (confirmError) {
      setError(
        confirmError instanceof Error
          ? confirmError.message
          : "Could not confirm Greyhound race card.",
      );
    } finally {
      setBusy(false);
    }
  };

  if (confirmed) {
    return (
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-center text-sm font-black text-emerald-300">
        ✓ Card Confirmed
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        disabled={disabled || busy}
        onClick={handleConfirm}
        className="w-full rounded-xl bg-gradient-to-r from-red-600 to-orange-500 px-5 py-3 text-sm font-black text-white shadow-lg shadow-red-950/30 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {busy
          ? "Confirming..."
          : "Confirm Card for Racing"}
      </button>

      {error && (
        <div className="mt-2 max-w-xs text-xs font-semibold text-red-300">
          {error}
        </div>
      )}
    </div>
  );
}