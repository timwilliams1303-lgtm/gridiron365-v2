"use client";

import {
  FormEvent,
  Suspense,
  useMemo,
  useState,
} from "react";

import Image from "next/image";
import Link from "next/link";

import {
  useRouter,
  useSearchParams,
} from "next/navigation";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import FormField from "@/components/ui/FormField";
import MessageBox from "@/components/ui/MessageBox";

import {
  createSupabaseBrowserClient,
} from "@/lib/supabase/browser";


export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <LoginLoading />
      }
    >
      <LoginContent />
    </Suspense>
  );
}


function LoginContent() {
  const router =
    useRouter();

  const searchParams =
    useSearchParams();

  const supabase =
    useMemo(
      () =>
        createSupabaseBrowserClient(),
      []
    );

  const [
    email,
    setEmail,
  ] =
    useState("");

  const [
    password,
    setPassword,
  ] =
    useState("");

  const [
    working,
    setWorking,
  ] =
    useState(false);

  const [
    message,
    setMessage,
  ] =
    useState("");

  const [
    isError,
    setIsError,
  ] =
    useState(false);


  const confirmationError =
    searchParams.get(
      "error"
    ) ===
    "confirmation_failed";


  const requestedNext =
    searchParams.get(
      "next"
    );


  const nextPath =
    requestedNext &&
    requestedNext.startsWith("/") &&
    !requestedNext.startsWith("//")
      ? requestedNext
      : "/my-leagues";


  async function handleSubmit(
    event:
      FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (working) {
      return;
    }

    setMessage("");
    setIsError(false);

    const cleanEmail =
      email
        .trim()
        .toLowerCase();

    if (
      !cleanEmail ||
      !password
    ) {
      setIsError(true);

      setMessage(
        "Enter your email and password."
      );

      return;
    }

    setWorking(true);

    try {
      const {
        data:
          signInData,
        error,
      } =
        await supabase.auth
          .signInWithPassword({
            email:
              cleanEmail,

            password,
          });

      if (error) {
        throw new Error(
          error.message
        );
      }

      /*
       * ============================================================
       * INVITATION LOGIN
       * ============================================================
       *
       * If this login originated from:
       *
       *   /invite/[token]
       *
       * automatically accept the invitation before sending the user
       * to My Leagues.
       *
       * This guarantees that My Leagues already contains the newly
       * joined league when the page opens.
       */

      const inviteMatch =
        nextPath.match(
          /^\/invite\/([^/?#]+)/
        );

      if (
        inviteMatch
      ) {
        const inviteToken =
          decodeURIComponent(
            inviteMatch[1]
          );

        const accessToken =
          signInData
            .session
            ?.access_token;

        if (!accessToken) {
          throw new Error(
            "You signed in successfully, but your session could not be loaded."
          );
        }

        const response =
          await fetch(
            `/api/invitations/${encodeURIComponent(
              inviteToken
            )}`,
            {
              method:
                "POST",

              headers: {
                Authorization:
                  `Bearer ${accessToken}`,
              },
            }
          );

        let result:
          {
            success?: boolean;
            error?: string;
            message?: string;
          } =
          {};

        try {
          result =
            (await response.json()) as {
              success?: boolean;
              error?: string;
              message?: string;
            };
        } catch {
          result =
            {};
        }

        /*
         * If the same user already accepted the invitation in an
         * earlier attempt, My Leagues is still the correct destination.
         */
        const alreadyAccepted =
          response.status === 409 &&
          (
            result.error
              ?.toLowerCase()
              .includes(
                "already been accepted"
              ) ??
            false
          );

        if (
          (
            !response.ok ||
            result.success ===
              false
          ) &&
          !alreadyAccepted
        ) {
          throw new Error(
            result.error ??
              "You signed in, but the league invitation could not be accepted."
          );
        }

        router.replace(
          "/my-leagues"
        );

        router.refresh();

        return;
      }

      /*
       * Normal non-invitation login.
       */
      router.replace(
        nextPath
      );

      router.refresh();
    } catch (error) {
      setIsError(true);

      setMessage(
        error instanceof Error
          ? error.message
          : "You could not be signed in."
      );
    } finally {
      setWorking(false);
    }
  }


  return (
    <main
      style={
        styles.page
      }
    >
      <div
        aria-hidden="true"
        style={
          styles.topGlow
        }
      />

      <div
        aria-hidden="true"
        style={
          styles.bottomGlow
        }
      />

      <section
        style={
          styles.shell
        }
      >
        <header
          style={
            styles.brandHeader
          }
        >
          <Image
            src="/branding/gridiron365-logo-full.png"
            alt="Gridiron365"
            width={420}
            height={120}
            priority
            style={
              styles.logo
            }
          />
        </header>

        <Card
          style={
            styles.card
          }
        >
          <div
            aria-hidden="true"
            style={
              styles.cardAccent
            }
          />

          <header
            style={
              styles.cardHeader
            }
          >
            <p
              style={
                styles.eyebrow
              }
            >
              WELCOME BACK
            </p>

            <h1
              style={
                styles.title
              }
            >
              Sign In
            </h1>

            <p
              style={
                styles.subtitle
              }
            >
              Sign in to access your Gridiron365 leagues.
            </p>
          </header>

          <form
            onSubmit={
              handleSubmit
            }
            style={
              styles.form
            }
          >
            <FormField
              label="Email"
              type="email"
              value={
                email
              }
              onChange={(
                event
              ) =>
                setEmail(
                  event
                    .target
                    .value
                )
              }
              autoComplete="email"
              disabled={
                working
              }
              required
            />

            <div>
              <FormField
                label="Password"
                type="password"
                value={
                  password
                }
                onChange={(
                  event
                ) =>
                  setPassword(
                    event
                      .target
                      .value
                  )
                }
                autoComplete="current-password"
                disabled={
                  working
                }
                required
              />

              <div
                style={
                  styles.forgotRow
                }
              >
                <Link
                  href="/auth/forgot-password"
                  style={
                    styles.smallLink
                  }
                >
                  Forgot Password?
                </Link>
              </div>
            </div>

            {confirmationError &&
            !message ? (
              <MessageBox
                message="The email confirmation link could not be completed. Try signing in or request a new confirmation email."
                type="error"
              />
            ) : null}

            <MessageBox
              message={
                message
              }
              type={
                isError
                  ? "error"
                  : "success"
              }
            />

            <Button
              type="submit"
              fullWidth
              disabled={
                working
              }
              style={
                styles.submitButton
              }
            >
              {working
                ? "Signing In..."
                : "Sign In"}
            </Button>
          </form>

          <div
            style={
              styles.signupSection
            }
          >
            <span>
              Need an account?
            </span>

            <Link
              href={
                nextPath !==
                "/my-leagues"
                  ? `/auth/signup?next=${encodeURIComponent(
                      nextPath
                    )}`
                  : "/auth/signup"
              }
              style={
                styles.signupLink
              }
            >
              Create Account
            </Link>
          </div>
        </Card>

        <footer
          style={
            styles.footer
          }
        >
          <span>
            GRIDIRON365
          </span>

          <span
            style={
              styles.footerDot
            }
          >
            •
          </span>

          <span>
            Your League. Your Rules.
          </span>
        </footer>
      </section>
    </main>
  );
}


function LoginLoading() {
  return (
    <main
      style={
        styles.page
      }
    >
      <section
        style={
          styles.loadingShell
        }
      >
        <Image
          src="/branding/gridiron365-logo-compact.png"
          alt="Gridiron365"
          width={220}
          height={140}
          priority
          style={
            styles.loadingLogo
          }
        />

        <p
          style={
            styles.loadingText
          }
        >
          Loading...
        </p>
      </section>
    </main>
  );
}


const styles = {
  page: {
    position:
      "relative" as const,

    minHeight:
      "100vh",

    display:
      "grid",

    placeItems:
      "center",

    overflow:
      "hidden",

    padding:
      "32px 18px",
  },

  topGlow: {
    position:
      "absolute" as const,

    top:
      "-240px",

    left:
      "50%",

    width:
      "700px",

    height:
      "500px",

    transform:
      "translateX(-50%)",

    background:
      "radial-gradient(circle,rgba(255,69,0,.16),transparent 67%)",

    filter:
      "blur(8px)",

    pointerEvents:
      "none" as const,
  },

  bottomGlow: {
    position:
      "absolute" as const,

    right:
      "-180px",

    bottom:
      "-220px",

    width:
      "520px",

    height:
      "520px",

    background:
      "radial-gradient(circle,rgba(255,30,30,.10),transparent 68%)",

    pointerEvents:
      "none" as const,
  },

  shell: {
    position:
      "relative" as const,

    zIndex:
      1,

    width:
      "min(540px,100%)",

    display:
      "grid",

    gap:
      "18px",
  },

  brandHeader: {
    display:
      "flex",

    justifyContent:
      "center",

    alignItems:
      "center",

    minHeight:
      "92px",
  },

  logo: {
    width:
      "min(400px,90%)",

    height:
      "auto",

    objectFit:
      "contain" as const,

    filter:
      "drop-shadow(0 12px 30px rgba(255,69,0,.18))",
  },

  card: {
    padding:
      "30px",
  },

  cardAccent: {
    position:
      "absolute" as const,

    top: 0,
    left: 0,
    right: 0,

    height:
      "3px",

    background:
      "linear-gradient(90deg,#ff1e1e,#ff4500,#ff8c00)",
  },

  cardHeader: {
    marginBottom:
      "25px",
  },

  eyebrow: {
    margin: 0,

    color:
      "#ff8c00",

    fontSize:
      "10px",

    fontWeight:
      900,

    letterSpacing:
      ".16em",
  },

  title: {
    margin:
      "8px 0 0",

    color:
      "#ffffff",

    fontSize:
      "30px",

    lineHeight:
      1.12,
  },

  subtitle: {
    margin:
      "9px 0 0",

    color:
      "#a8adb7",

    fontSize:
      "14px",

    lineHeight:
      1.55,
  },

  form: {
    display:
      "grid",

    gap:
      "17px",
  },

  forgotRow: {
    display:
      "flex",

    justifyContent:
      "flex-end",

    marginTop:
      "9px",
  },

  smallLink: {
    color:
      "#ff8c00",

    fontSize:
      "12px",

    fontWeight:
      800,

    textDecoration:
      "none",
  },

  submitButton: {
    marginTop:
      "2px",

    minHeight:
      "50px",

    textTransform:
      "uppercase" as const,

    letterSpacing:
      ".05em",
  },

  signupSection: {
    marginTop:
      "24px",

    paddingTop:
      "21px",

    display:
      "flex",

    justifyContent:
      "center",

    alignItems:
      "center",

    flexWrap:
      "wrap" as const,

    gap:
      "7px",

    borderTop:
      "1px solid rgba(255,255,255,.08)",

    color:
      "#8f96a3",

    fontSize:
      "13px",
  },

  signupLink: {
    color:
      "#ff7a18",

    fontWeight:
      900,

    textDecoration:
      "none",
  },

  footer: {
    display:
      "flex",

    justifyContent:
      "center",

    alignItems:
      "center",

    flexWrap:
      "wrap" as const,

    gap:
      "7px",

    color:
      "#555b65",

    fontSize:
      "10px",

    fontWeight:
      800,

    letterSpacing:
      ".08em",

    textTransform:
      "uppercase" as const,
  },

  footerDot: {
    color:
      "#ff4500",
  },

  loadingShell: {
    display:
      "grid",

    justifyItems:
      "center",

    gap:
      "12px",
  },

  loadingLogo: {
    width:
      "180px",

    height:
      "auto",

    objectFit:
      "contain" as const,
  },

  loadingText: {
    margin: 0,

    color:
      "#8f96a3",

    fontSize:
      "12px",

    fontWeight:
      800,

    letterSpacing:
      ".08em",

    textTransform:
      "uppercase" as const,
  },
};