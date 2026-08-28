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
     * My Leagues authenticates itself through
     * requireUser(), so do not perform a second
     * Supabase Auth network validation in the proxy.
     *
     * Also skip API routes. Individual API endpoints
     * already handle their own authentication/secrets
     * and should not be delayed by browser-session
     * validation.
     */
    "/((?!api|my-leagues|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};