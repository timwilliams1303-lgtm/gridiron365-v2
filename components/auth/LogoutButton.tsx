"use client";

import {
  useMemo,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import Button from "@/components/ui/Button";

import {
  clearGridiron365ResumeRoute,
} from "@/components/pwa/Gridiron365ResumeTracker";

import {
  createSupabaseBrowserClient,
} from "@/lib/supabase/browser";

export default function LogoutButton() {
  const router =
    useRouter();

  const supabase =
    useMemo(
      () =>
        createSupabaseBrowserClient(),
      []
    );

  const [
    working,
    setWorking,
  ] =
    useState(false);

  async function handleLogout() {
    if (working) {
      return;
    }

    setWorking(true);

    try {
      const {
        error,
      } =
        await supabase.auth
          .signOut();

      if (error) {
        throw error;
      }

      /*
       * Explicit sign-out starts a new
       * Gridiron365 navigation session.
       */
      clearGridiron365ResumeRoute();

      router.replace(
        "/auth/login"
      );

      router.refresh();
    } catch (
      error
    ) {
      console.error(
        "Gridiron365 sign out failed:",
        error
      );
    } finally {
      setWorking(false);
    }
  }

  return (
    <Button
      type="button"
      variant="secondary"
      disabled={
        working
      }
      onClick={
        handleLogout
      }
    >
      {working
        ? "Signing Out..."
        : "Sign Out"}
    </Button>
  );
}