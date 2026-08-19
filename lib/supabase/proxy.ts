import {
  createServerClient,
} from "@supabase/ssr";

import {
  NextResponse,
  type NextRequest,
} from "next/server";

export async function updateSession(
  request: NextRequest
) {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const key =
    process.env
      .NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Supabase environment variables are missing."
    );
  }

  let response =
    NextResponse.next({
      request,
    });

  const supabase =
    createServerClient(
      url,
      key,
      {
        cookies: {
          getAll() {
            return request
              .cookies
              .getAll();
          },

          setAll(
            cookiesToSet
          ) {
            cookiesToSet.forEach(
              ({
                name,
                value,
              }) => {
                request.cookies.set(
                  name,
                  value
                );
              }
            );

            response =
              NextResponse.next({
                request,
              });

            cookiesToSet.forEach(
              ({
                name,
                value,
                options,
              }) => {
                response.cookies.set(
                  name,
                  value,
                  options
                );
              }
            );
          },
        },
      }
    );

  /*
   * IMPORTANT:
   * getUser() validates the current auth session
   * with Supabase Auth.
   */
  const {
    data: {
      user,
    },
  } =
    await supabase.auth
      .getUser();

  const pathname =
    request.nextUrl.pathname;

  const isAuthPage =
    pathname.startsWith(
      "/auth/"
    );

  const isProtectedPage =
    pathname.startsWith(
      "/my-leagues"
    ) ||
    pathname.startsWith(
      "/league/"
    );

  /*
   * Not signed in + protected page
   * → Login
   */
  if (
    !user &&
    isProtectedPage
  ) {
    const loginUrl =
      request.nextUrl.clone();

    loginUrl.pathname =
      "/auth/login";

    loginUrl.searchParams.set(
      "next",
      pathname +
        request.nextUrl.search
    );

    return NextResponse.redirect(
      loginUrl
    );
  }

  /*
   * Signed-in users don't need to sit
   * on Login or Signup.
   *
   * We allow callback/reset flows through.
   */
  if (
    user &&
    (
      pathname ===
        "/auth/login" ||
      pathname ===
        "/auth/signup"
    )
  ) {
    const leaguesUrl =
      request.nextUrl.clone();

    leaguesUrl.pathname =
      "/my-leagues";

    leaguesUrl.search =
      "";

    return NextResponse.redirect(
      leaguesUrl
    );
  }

  return response;
}