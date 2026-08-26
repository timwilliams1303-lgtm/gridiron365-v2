"use client";

import {
  FormEvent,
  useMemo,
  useState,
} from "react";

import Image from "next/image";
import Link from "next/link";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import FormField from "@/components/ui/FormField";
import MessageBox from "@/components/ui/MessageBox";

import {
  createSupabaseBrowserClient,
} from "@/lib/supabase/browser";

export default function SignupPage() {
  const supabase =
    useMemo(
      () =>
        createSupabaseBrowserClient(),
      []
    );

  const [
    firstName,
    setFirstName,
  ] =
    useState("");

  const [
    lastName,
    setLastName,
  ] =
    useState("");

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
    confirmPassword,
    setConfirmPassword,
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

    const cleanFirstName =
      firstName.trim();

    const cleanLastName =
      lastName.trim();

    const cleanEmail =
      email
        .trim()
        .toLowerCase();

    if (
      !cleanFirstName ||
      !cleanLastName ||
      !cleanEmail ||
      !password ||
      !confirmPassword
    ) {
      setIsError(true);

      setMessage(
        "Complete all fields before creating your account."
      );

      return;
    }

    if (
      password.length <
      8
    ) {
      setIsError(true);

      setMessage(
        "Your password must be at least 8 characters."
      );

      return;
    }

    if (
      password !==
      confirmPassword
    ) {
      setIsError(true);

      setMessage(
        "Your passwords do not match."
      );

      return;
    }

    setWorking(true);

    try {
      const origin =
        window.location.origin;

      const requestedNext =
        new URLSearchParams(
          window.location.search
        ).get(
          "next"
        );

      const nextPath =
        requestedNext &&
        requestedNext.startsWith("/") &&
        !requestedNext.startsWith("//")
          ? requestedNext
          : "/my-leagues";

      const callbackUrl =
        `${origin}/auth/callback?next=${encodeURIComponent(
          nextPath
        )}`;

      const {
        data,
        error,
      } =
        await supabase.auth.signUp(
          {
            email:
              cleanEmail,

            password,

            options: {
              emailRedirectTo:
                callbackUrl,

              data: {
                first_name:
                  cleanFirstName,

                last_name:
                  cleanLastName,

                display_name:
                  `${cleanFirstName} ${cleanLastName}`,
              },
            },
          }
        );

      if (error) {
        throw new Error(
          error.message
        );
      }

      const loginUrl =
        `/auth/login?next=${encodeURIComponent(
          nextPath
        )}`;

      window.location.replace(
        loginUrl
      );

      return;
    } catch (error) {
      setIsError(true);

      setMessage(
        error instanceof Error
          ? error.message
          : "Your account could not be created."
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
              NEW ACCOUNT
            </p>

            <h1
              style={
                styles.title
              }
            >
              Create Your Account
            </h1>

            <p
              style={
                styles.subtitle
              }
            >
              Sign up to join and manage your Gridiron365 leagues.
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
            <div
              style={
                styles.nameGrid
              }
            >
              <FormField
                label="First Name"
                value={
                  firstName
                }
                onChange={(
                  event
                ) =>
                  setFirstName(
                    event
                      .target
                      .value
                  )
                }
                autoComplete="given-name"
                disabled={
                  working
                }
                required
              />

              <FormField
                label="Last Name"
                value={
                  lastName
                }
                onChange={(
                  event
                ) =>
                  setLastName(
                    event
                      .target
                      .value
                  )
                }
                autoComplete="family-name"
                disabled={
                  working
                }
                required
              />
            </div>

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
              autoComplete="new-password"
              disabled={
                working
              }
              hint="Use at least 8 characters."
              required
            />

            <FormField
              label="Confirm Password"
              type="password"
              value={
                confirmPassword
              }
              onChange={(
                event
              ) =>
                setConfirmPassword(
                  event
                    .target
                    .value
                )
              }
              autoComplete="new-password"
              disabled={
                working
              }
              required
            />

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
                ? "Creating Account..."
                : "Create Account"}
            </Button>
          </form>

          <div
            style={
              styles.signInSection
            }
          >
            <span>
              Already have an account?
            </span>

            <Link
              href="/auth/login"
              style={
                styles.signInLink
              }
            >
              Sign In
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
      "16px",
  },

  nameGrid: {
    display:
      "grid",

    gridTemplateColumns:
      "repeat(auto-fit,minmax(190px,1fr))",

    gap:
      "13px",
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

  signInSection: {
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

  signInLink: {
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
};