import "server-only";

import {
  redirect,
} from "next/navigation";

import {
  getCurrentUser,
} from "@/lib/auth/getCurrentUser";

export async function requireUser() {
  const user =
    await getCurrentUser();

  if (!user) {
    redirect(
      "/auth/login"
    );
  }

  return user;
}