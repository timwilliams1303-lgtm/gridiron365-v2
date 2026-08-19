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
      await supabase.auth
        .signOut();

      router.replace(
        "/auth/login"
      );

      router.refresh();
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