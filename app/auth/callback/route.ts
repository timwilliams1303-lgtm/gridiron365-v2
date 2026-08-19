import {
  NextResponse,
} from "next/server";

import {
  createSupabaseServerClient,
} from "../../../lib/supabase/server";

export async function GET(
  request: Request
) {
  const requestUrl =
    new URL(
      request.url
    );

  const code =
    requestUrl
      .searchParams
      .get("code");

  const requestedNext =
    requestUrl
      .searchParams
      .get("next");

  const next =
    requestedNext &&
    requestedNext.startsWith("/")
      ? requestedNext
      : "/my-leagues";

  if (!code) {
    return NextResponse.redirect(
      new URL(
        "/auth/login?error=confirmation_failed",
        requestUrl.origin
      )
    );
  }

  const supabase =
    await createSupabaseServerClient();

  const {
    error,
  } =
    await supabase.auth
      .exchangeCodeForSession(
        code
      );

  if (error) {
    return NextResponse.redirect(
      new URL(
        "/auth/login?error=confirmation_failed",
        requestUrl.origin
      )
    );
  }

  return NextResponse.redirect(
    new URL(
      next,
      requestUrl.origin
    )
  );
}