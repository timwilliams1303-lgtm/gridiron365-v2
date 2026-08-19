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

export default function ForgotPasswordPage() {
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

    const cleanEmail =
      email
        .trim()
        .toLowerCase();

    if (!cleanEmail) {
      setIsError(true);

      setMessage(
        "Enter your email address."
      );

      return;
    }

    setWorking(true);

    try {
      const {
        error,
      } =
        await supabase.auth
          .resetPasswordForEmail(
            cleanEmail,
            {
              redirectTo:
                `${window.location.origin}/auth/reset-password`,
            }
          );

      if (error) {
        throw new Error(
          error.message
        );
      }

      setMessage(
        "Password reset email sent. Check your inbox for the reset link."
      );

      setEmail("");
    } catch (error) {
      setIsError(true);

      setMessage(
        error instanceof Error
          ? error.message
          : "The reset email could not be sent."
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
              PASSWORD HELP
            </p>

            <h1
              style={
                styles.title
              }
            >
              Reset Your Password
            </h1>

            <p
              style={
                styles.subtitle
              }
            >
              Enter your email and we&apos;ll send you a secure password reset link.
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
                ? "Sending..."
                : "Send Reset Link"}
            </Button>
          </form>

          <div
            style={
              styles.footerLinks
            }
          >
            <Link
              href="/auth/login"
              style={
                styles.link
              }
            >
              Back to Sign In
            </Link>
          </div>
        </Card>
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

  submitButton: {
    minHeight:
      "50px",

    textTransform:
      "uppercase" as const,

    letterSpacing:
      ".05em",
  },

  footerLinks: {
    marginTop:
      "22px",

    paddingTop:
      "18px",

    borderTop:
      "1px solid rgba(255,255,255,.08)",

    textAlign:
      "center" as const,
  },

  link: {
    color:
      "#ff7a18",

    fontSize:
      "13px",

    fontWeight:
      900,

    textDecoration:
      "none",
  },
};