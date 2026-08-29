import type {
  NextRequest,
} from "next/server";

import {
  updateSession,
} from "@/lib/supabase/proxy";

export async function proxy(
  request: NextRequest
) {
  return updateSession(
    request
  );
}

export const config = {
  matcher: [
    /*
     * Do NOT run Supabase session middleware for:
     *
     * - /api
     *   API routes authenticate themselves.
     *
     * - /auth
     *   Login/signup/callback/reset pages must always
     *   be able to render without waiting for a session
     *   validation request.
     *
     * - /my-leagues
     *   This page already authenticates through
     *   requireUser().
     *
     * - Next.js assets and public images.
     */
    "/((?!api|auth|my-leagues|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};