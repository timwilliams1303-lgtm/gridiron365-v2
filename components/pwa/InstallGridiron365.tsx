"use client";

import {
  useEffect,
  useState,
} from "react";

type BeforeInstallPromptEvent =
  Event & {
    prompt: () => Promise<void>;

    userChoice: Promise<{
      outcome:
        | "accepted"
        | "dismissed";

      platform:
        string;
    }>;
  };

function isIosDevice() {
  if (
    typeof window ===
    "undefined"
  ) {
    return false;
  }

  return (
    /iphone|ipad|ipod/i.test(
      window.navigator.userAgent
    ) ||
    (
      window.navigator.platform ===
        "MacIntel" &&
      window.navigator.maxTouchPoints >
        1
    )
  );
}

function isStandaloneMode() {
  if (
    typeof window ===
    "undefined"
  ) {
    return false;
  }

  const navigatorWithStandalone =
    window.navigator as Navigator & {
      standalone?: boolean;
    };

  return (
    window.matchMedia(
      "(display-mode: standalone)"
    ).matches ||
    navigatorWithStandalone
      .standalone === true
  );
}

export default function InstallGridiron365() {
  const [
    deferredPrompt,
    setDeferredPrompt,
  ] =
    useState<BeforeInstallPromptEvent | null>(
      null
    );

  const [
    isInstalled,
    setIsInstalled,
  ] =
    useState(false);

  const [
    showIosInstructions,
    setShowIosInstructions,
  ] =
    useState(false);

  const [
    isIos,
    setIsIos,
  ] =
    useState(false);

  useEffect(() => {
    setIsInstalled(
      isStandaloneMode()
    );

    setIsIos(
      isIosDevice()
    );

    const handleBeforeInstallPrompt =
      (
        event:
          Event
      ) => {
        event.preventDefault();

        setDeferredPrompt(
          event as
            BeforeInstallPromptEvent
        );
      };

    const handleAppInstalled =
      () => {
        setIsInstalled(true);

        setDeferredPrompt(
          null
        );

        setShowIosInstructions(
          false
        );
      };

    window.addEventListener(
      "beforeinstallprompt",
      handleBeforeInstallPrompt
    );

    window.addEventListener(
      "appinstalled",
      handleAppInstalled
    );

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt
      );

      window.removeEventListener(
        "appinstalled",
        handleAppInstalled
      );
    };
  }, []);

  async function handleInstall() {
    if (isInstalled) {
      return;
    }

    if (deferredPrompt) {
      await deferredPrompt.prompt();

      const choice =
        await deferredPrompt.userChoice;

      if (
        choice.outcome ===
        "accepted"
      ) {
        setDeferredPrompt(
          null
        );
      }

      return;
    }

    if (isIos) {
      setShowIosInstructions(
        true
      );

      return;
    }

    window.alert(
      "To install Gridiron365, open your browser menu and choose Install app or Add to Home screen."
    );
  }

  if (isInstalled) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={
          handleInstall
        }
        style={
          styles.installButton
        }
      >
        <span
          aria-hidden="true"
          style={
            styles.icon
          }
        >
          ↓
        </span>

        Install G365
      </button>

      {showIosInstructions ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Install Gridiron365"
          style={
            styles.overlay
          }
          onClick={
            () =>
              setShowIosInstructions(
                false
              )
          }
        >
          <div
            style={
              styles.modal
            }
            onClick={
              (
                event
              ) =>
                event.stopPropagation()
            }
          >
            <div
              style={
                styles.logoBox
              }
            >
              G365
            </div>

            <p
              style={
                styles.eyebrow
              }
            >
              GRIDIRON365
            </p>

            <h2
              style={
                styles.title
              }
            >
              Install on iPhone
            </h2>

            <p
              style={
                styles.description
              }
            >
              Add Gridiron365 to
              your Home Screen so
              it opens like an app.
            </p>

            <div
              style={
                styles.steps
              }
            >
              <div
                style={
                  styles.step
                }
              >
                <span
                  style={
                    styles.stepNumber
                  }
                >
                  1
                </span>

                <span>
                  Open this page in
                  Safari.
                </span>
              </div>

              <div
                style={
                  styles.step
                }
              >
                <span
                  style={
                    styles.stepNumber
                  }
                >
                  2
                </span>

                <span>
                  Tap the Safari
                  Share button.
                </span>
              </div>

              <div
                style={
                  styles.step
                }
              >
                <span
                  style={
                    styles.stepNumber
                  }
                >
                  3
                </span>

                <span>
                  Choose{" "}
                  <strong>
                    Add to Home Screen
                  </strong>
                  .
                </span>
              </div>

              <div
                style={
                  styles.step
                }
              >
                <span
                  style={
                    styles.stepNumber
                  }
                >
                  4
                </span>

                <span>
                  Tap{" "}
                  <strong>
                    Add
                  </strong>
                  .
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={
                () =>
                  setShowIosInstructions(
                    false
                  )
              }
              style={
                styles.doneButton
              }
            >
              Got It
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}

const styles = {
  installButton: {
    minHeight:
      "42px",

    padding:
      "9px 14px",

    display:
      "inline-flex",

    alignItems:
      "center",

    justifyContent:
      "center",

    gap:
      "8px",

    border:
      "1px solid rgba(255,140,0,.35)",

    borderRadius:
      "9px",

    background:
      "linear-gradient(135deg,rgba(255,30,30,.14),rgba(255,140,0,.12))",

    color:
      "#ff9c2a",

    fontSize:
      "11px",

    fontWeight:
      900,

    letterSpacing:
      ".04em",

    cursor:
      "pointer",
  },

  icon: {
    fontSize:
      "16px",

    lineHeight:
      1,
  },

  overlay: {
    position:
      "fixed" as const,

    inset:
      0,

    zIndex:
      9999,

    display:
      "grid",

    placeItems:
      "center",

    padding:
      "20px",

    background:
      "rgba(0,0,0,.78)",

    backdropFilter:
      "blur(8px)",
  },

  modal: {
    width:
      "min(420px,100%)",

    padding:
      "28px",

    border:
      "1px solid rgba(255,140,0,.24)",

    borderRadius:
      "18px",

    background:
      "linear-gradient(180deg,#171717,#0d0d0d)",

    boxShadow:
      "0 24px 80px rgba(0,0,0,.6)",

    color:
      "#ffffff",
  },

  logoBox: {
    width:
      "64px",

    height:
      "64px",

    display:
      "grid",

    placeItems:
      "center",

    borderRadius:
      "16px",

    background:
      "linear-gradient(135deg,#ff1e1e,#ff4500 50%,#ff8c00)",

    color:
      "#ffffff",

    fontSize:
      "14px",

    fontWeight:
      900,

    boxShadow:
      "0 12px 30px rgba(255,69,0,.2)",
  },

  eyebrow: {
    margin:
      "22px 0 0",

    color:
      "#ff8c00",

    fontSize:
      "9px",

    fontWeight:
      900,

    letterSpacing:
      ".15em",
  },

  title: {
    margin:
      "7px 0 0",

    fontSize:
      "26px",

    lineHeight:
      1.15,
  },

  description: {
    margin:
      "10px 0 0",

    color:
      "#9ca2ad",

    fontSize:
      "14px",

    lineHeight:
      1.55,
  },

  steps: {
    display:
      "grid",

    gap:
      "12px",

    marginTop:
      "24px",
  },

  step: {
    display:
      "flex",

    alignItems:
      "center",

    gap:
      "12px",

    padding:
      "12px",

    border:
      "1px solid rgba(255,255,255,.07)",

    borderRadius:
      "10px",

    background:
      "rgba(255,255,255,.025)",

    color:
      "#d8dbe0",

    fontSize:
      "13px",

    lineHeight:
      1.4,
  },

  stepNumber: {
    width:
      "28px",

    height:
      "28px",

    flex:
      "0 0 28px",

    display:
      "grid",

    placeItems:
      "center",

    borderRadius:
      "50%",

    background:
      "linear-gradient(135deg,#ff1e1e,#ff8c00)",

    color:
      "#ffffff",

    fontSize:
      "11px",

    fontWeight:
      900,
  },

  doneButton: {
    width:
      "100%",

    minHeight:
      "46px",

    marginTop:
      "24px",

    border:
      0,

    borderRadius:
      "9px",

    background:
      "linear-gradient(135deg,#ff1e1e,#ff4500 50%,#ff8c00)",

    color:
      "#ffffff",

    fontSize:
      "13px",

    fontWeight:
      900,

    cursor:
      "pointer",
  },
};