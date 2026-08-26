"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useState,
} from "react";
import {
  createBrowserClient,
} from "@supabase/ssr";
import {
  useParams,
  useRouter,
} from "next/navigation";

type InvitationResponse = {
  success?: boolean;
  error?: string;

  invitation?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    expiresAt: string;

    league: {
      id: string;
      name: string;
      leagueType: string;
      season: number;
    };

    fantasyTeam: {
      id: number;
      teamName: string;
    } | null;
  };
};

type AcceptResponse = {
  success?: boolean;
  error?: string;
  message?: string;

  league?: {
    id: string;
    name: string;
  };

  fantasyTeam?: {
    id: number;
    teamName: string | null;
  } | null;
};

const supabase =
  createBrowserClient(
    process.env
      .NEXT_PUBLIC_SUPABASE_URL!,

    process.env
      .NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
      process.env
        .NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

export default function InviteAcceptancePage() {
  const params =
    useParams<{
      token: string;
    }>();

  const router =
    useRouter();

  const token =
    params.token;

  const [
    loading,
    setLoading,
  ] =
    useState(
      true
    );

  const [
    accepting,
    setAccepting,
  ] =
    useState(
      false
    );

  const [
    invitation,
    setInvitation,
  ] =
    useState<
      InvitationResponse["invitation"] |
      null
    >(
      null
    );

  const [
    signedInEmail,
    setSignedInEmail,
  ] =
    useState<
      string |
      null
    >(
      null
    );

  const [
    error,
    setError,
  ] =
    useState<
      string |
      null
    >(
      null
    );

  const [
    success,
    setSuccess,
  ] =
    useState<
      string |
      null
    >(
      null
    );


  const load =
    useCallback(
      async () => {
        setLoading(
          true
        );

        setError(
          null
        );

        try {
          const response =
            await fetch(
              `/api/invitations/${encodeURIComponent(
                token
              )}`,
              {
                method:
                  "GET",

                cache:
                  "no-store",
              }
            );

          let result:
            InvitationResponse =
            {};

          try {
            result =
              (await response.json()) as
                InvitationResponse;
          } catch {
            result =
              {};
          }

          if (
            !response.ok ||
            result.success ===
              false ||
            !result.invitation
          ) {
            throw new Error(
              result.error ??
                "This invitation could not be loaded."
            );
          }

          setInvitation(
            result.invitation
          );

          const {
            data:
              sessionData,
          } =
            await supabase
              .auth
              .getSession();

          setSignedInEmail(
            sessionData
              .session
              ?.user
              .email ??
              null
          );
        } catch (
          loadError
        ) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "This invitation could not be loaded."
          );
        } finally {
          setLoading(
            false
          );
        }
      },
      [
        token,
      ]
    );


  useEffect(
    () => {
      void load();

      const {
        data:
          authListener,
      } =
        supabase
          .auth
          .onAuthStateChange(
            (
              _event,
              session
            ) => {
              setSignedInEmail(
                session
                  ?.user
                  .email ??
                  null
              );
            }
          );

      return () => {
        authListener
          .subscription
          .unsubscribe();
      };
    },
    [
      load,
    ]
  );


  async function acceptInvitation() {
    if (
      accepting ||
      !invitation
    ) {
      return;
    }

    setAccepting(
      true
    );

    setError(
      null
    );

    setSuccess(
      null
    );

    try {
      const {
        data:
          sessionData,
        error:
          sessionError,
      } =
        await supabase
          .auth
          .getSession();

      if (
        sessionError
      ) {
        throw new Error(
          sessionError.message
        );
      }

      const accessToken =
        sessionData
          .session
          ?.access_token;

      if (
        !accessToken
      ) {
        throw new Error(
          "Sign in or create an account before accepting this invitation."
        );
      }

      const response =
        await fetch(
          `/api/invitations/${encodeURIComponent(
            token
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
        AcceptResponse =
        {};

      try {
        result =
          (await response.json()) as
            AcceptResponse;
      } catch {
        result =
          {};
      }

      if (
        !response.ok ||
        result.success ===
          false
      ) {
        throw new Error(
          result.error ??
            "The invitation could not be accepted."
        );
      }

      setSuccess(
        result.message ??
          "Invitation accepted."
      );

      const destinationLeagueId =
        result.league
          ?.id ??
        invitation
          .league
          .id;

      window.setTimeout(
        () => {
          router.replace(
            `/league/${destinationLeagueId}`
          );

          router.refresh();
        },
        900
      );
    } catch (
      acceptError
    ) {
      setError(
        acceptError instanceof Error
          ? acceptError.message
          : "The invitation could not be accepted."
      );
    } finally {
      setAccepting(
        false
      );
    }
  }


  if (
    loading
  ) {
    return (
      <main
        style={
          styles.page
        }
      >
        <div
          style={
            styles.centerCard
          }
        >
          <div
            style={
              styles.brand
            }
          >
            G365
          </div>

          <div
            style={
              styles.loadingText
            }
          >
            Loading invitation…
          </div>
        </div>
      </main>
    );
  }


  if (
    error &&
    !invitation
  ) {
    return (
      <main
        style={
          styles.page
        }
      >
        <div
          style={
            styles.centerCard
          }
        >
          <div
            style={
              styles.brand
            }
          >
            G365
          </div>

          <h1
            style={
              styles.title
            }
          >
            Invitation Unavailable
          </h1>

          <p
            style={
              styles.error
            }
          >
            {error}
          </p>

          <Link
            href="/login"
            style={
              styles.secondaryLink
            }
          >
            GO TO LOGIN
          </Link>
        </div>
      </main>
    );
  }


  if (
    !invitation
  ) {
    return null;
  }


  const invitedEmail =
    invitation.email
      .trim()
      .toLowerCase();

  const currentEmail =
    signedInEmail
      ?.trim()
      .toLowerCase() ??
    null;

  const emailMatches =
    Boolean(
      currentEmail &&
      currentEmail ===
        invitedEmail
    );

  const redirectPath =
    `/invite/${encodeURIComponent(
      token
    )}`;

  const loginHref =
    `/login?redirect=${encodeURIComponent(
      redirectPath
    )}`;

  const signupHref =
    `/signup?redirect=${encodeURIComponent(
      redirectPath
    )}`;


  return (
    <main
      style={
        styles.page
      }
    >
      <div
        style={
          styles.shell
        }
      >
        <section
          style={
            styles.card
          }
        >
          <div
            style={
              styles.brand
            }
          >
            G365
          </div>

          <div
            style={
              styles.eyebrow
            }
          >
            GRIDIRON365 LEAGUE INVITATION
          </div>

          <h1
            style={
              styles.title
            }
          >
            You&apos;re Invited
          </h1>

          <p
            style={
              styles.lead
            }
          >
            Join{" "}
            <strong>
              {
                invitation
                  .league
                  .name
              }
            </strong>
            {invitation
              .fantasyTeam
              ? (
                <>
                  {" "}
                  and take ownership of{" "}
                  <strong>
                    {
                      invitation
                        .fantasyTeam
                        .teamName
                    }
                  </strong>
                  .
                </>
              )
              : "."}
          </p>


          <div
            style={
              styles.details
            }
          >
            <Detail
              label="League"
              value={
                invitation
                  .league
                  .name
              }
            />

            <Detail
              label="Season"
              value={
                String(
                  invitation
                    .league
                    .season
                )
              }
            />

            <Detail
              label="League Type"
              value={
                invitation
                  .league
                  .leagueType
                  .replaceAll(
                    "_",
                    " "
                  )
                  .toUpperCase()
              }
            />

            <Detail
              label="Reserved Team"
              value={
                invitation
                  .fantasyTeam
                  ?.teamName ??
                "League Membership"
              }
            />

            <Detail
              label="Invited Email"
              value={
                invitation
                  .email
              }
            />

            <Detail
              label="Expires"
              value={
                new Date(
                  invitation
                    .expiresAt
                )
                  .toLocaleString()
              }
            />
          </div>


          {success ? (
            <div
              style={
                styles.success
              }
            >
              {success}
            </div>
          ) : null}


          {error ? (
            <div
              style={
                styles.errorBox
              }
            >
              {error}
            </div>
          ) : null}


          {!signedInEmail ? (
            <div
              style={
                styles.actionPanel
              }
            >
              <h2
                style={
                  styles.actionTitle
                }
              >
                Sign in to continue
              </h2>

              <p
                style={
                  styles.muted
                }
              >
                Sign in or create a Gridiron365 account using{" "}
                <strong>
                  {
                    invitation
                      .email
                  }
                </strong>
                .
              </p>

              <div
                style={
                  styles.actions
                }
              >
                <Link
                  href={
                    loginHref
                  }
                  style={
                    styles.primaryLink
                  }
                >
                  SIGN IN
                </Link>

                <Link
                  href={
                    signupHref
                  }
                  style={
                    styles.secondaryLink
                  }
                >
                  CREATE ACCOUNT
                </Link>
              </div>
            </div>
          ) : !emailMatches ? (
            <div
              style={
                styles.actionPanel
              }
            >
              <h2
                style={
                  styles.actionTitle
                }
              >
                Different account signed in
              </h2>

              <p
                style={
                  styles.muted
                }
              >
                You&apos;re currently signed in as{" "}
                <strong>
                  {
                    signedInEmail
                  }
                </strong>
                , but this invitation belongs to{" "}
                <strong>
                  {
                    invitation
                      .email
                  }
                </strong>
                .
              </p>

              <button
                type="button"
                style={
                  styles.secondaryButton
                }
                onClick={
                  async () => {
                    await supabase
                      .auth
                      .signOut();

                    setSignedInEmail(
                      null
                    );
                  }
                }
              >
                SIGN OUT
              </button>
            </div>
          ) : (
            <div
              style={
                styles.actionPanel
              }
            >
              <h2
                style={
                  styles.actionTitle
                }
              >
                Ready to join
              </h2>

              <p
                style={
                  styles.muted
                }
              >
                Signed in as{" "}
                <strong>
                  {
                    signedInEmail
                  }
                </strong>
                . Accepting will add you to the league
                {invitation
                  .fantasyTeam
                  ? ` and assign ${invitation.fantasyTeam.teamName} to your account`
                  : ""}
                .
              </p>

              <button
                type="button"
                disabled={
                  accepting ||
                  Boolean(
                    success
                  )
                }
                style={{
                  ...styles.primaryButton,

                  ...(accepting ||
                  success
                    ? styles.disabled
                    : {}),
                }}
                onClick={
                  () =>
                    void acceptInvitation()
                }
              >
                {accepting
                  ? "ACCEPTING…"
                  : success
                    ? "INVITATION ACCEPTED"
                    : "ACCEPT INVITATION"}
              </button>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}


function Detail({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div
      style={
        styles.detail
      }
    >
      <span
        style={
          styles.detailLabel
        }
      >
        {label}
      </span>

      <strong
        style={
          styles.detailValue
        }
      >
        {value}
      </strong>
    </div>
  );
}


const styles:
  Record<
    string,
    React.CSSProperties
  > = {
    page: {
      minHeight:
        "100vh",

      display:
        "grid",

      placeItems:
        "center",

      padding:
        "28px 16px",

      color:
        "#ffffff",

      background:
        "radial-gradient(circle at 50% -10%, rgba(255,96,0,.20), transparent 28%), #070707",

      fontFamily:
        "Inter, system-ui, sans-serif",
    },

    shell: {
      width:
        "min(760px, 100%)",
    },

    card: {
      padding:
        "30px",

      border:
        "1px solid rgba(255,255,255,.09)",

      borderRadius:
        "20px",

      background:
        "linear-gradient(145deg, rgba(102,12,5,.23), rgba(12,12,12,.98) 52%)",

      boxShadow:
        "0 30px 80px rgba(0,0,0,.45)",
    },

    centerCard: {
      width:
        "min(560px, 100%)",

      padding:
        "32px",

      textAlign:
        "center",

      border:
        "1px solid rgba(255,255,255,.09)",

      borderRadius:
        "18px",

      background:
        "#0c0c0c",
    },

    brand: {
      display:
        "inline-block",

      fontSize:
        "34px",

      fontWeight:
        1000,

      letterSpacing:
        "-.06em",

      color:
        "#ff6b22",

      marginBottom:
        "12px",
    },

    eyebrow: {
      color:
        "#ff6b22",

      fontSize:
        "10px",

      fontWeight:
        950,

      letterSpacing:
        ".12em",
    },

    title: {
      margin:
        "7px 0 8px",

      fontSize:
        "clamp(36px, 7vw, 62px)",

      lineHeight:
        .98,

      letterSpacing:
        "-.05em",
    },

    lead: {
      color:
        "#aaaaaa",

      lineHeight:
        1.65,

      fontSize:
        "15px",
    },

    details: {
      display:
        "grid",

      gridTemplateColumns:
        "repeat(auto-fit, minmax(190px, 1fr))",

      gap:
        "8px",

      marginTop:
        "22px",
    },

    detail: {
      padding:
        "13px",

      border:
        "1px solid rgba(255,255,255,.07)",

      borderRadius:
        "10px",

      background:
        "#090909",
    },

    detailLabel: {
      display:
        "block",

      marginBottom:
        "5px",

      color:
        "#727272",

      fontSize:
        "9px",

      fontWeight:
        900,

      letterSpacing:
        ".07em",

      textTransform:
        "uppercase",
    },

    detailValue: {
      fontSize:
        "13px",

      wordBreak:
        "break-word",
    },

    actionPanel: {
      marginTop:
        "18px",

      padding:
        "18px",

      border:
        "1px solid rgba(255,107,34,.18)",

      borderRadius:
        "12px",

      background:
        "rgba(255,107,34,.05)",
    },

    actionTitle: {
      margin:
        "0 0 7px",

      fontSize:
        "19px",
    },

    muted: {
      color:
        "#8e8e8e",

      lineHeight:
        1.55,

      fontSize:
        "13px",
    },

    actions: {
      display:
        "flex",

      gap:
        "8px",

      flexWrap:
        "wrap",

      marginTop:
        "14px",
    },

    primaryButton: {
      width:
        "100%",

      border:
        "0",

      borderRadius:
        "9px",

      padding:
        "13px 17px",

      color:
        "#ffffff",

      background:
        "linear-gradient(90deg, #c81710, #ff7600)",

      fontSize:
        "11px",

      fontWeight:
        950,

      cursor:
        "pointer",
    },

    secondaryButton: {
      border:
        "1px solid rgba(255,255,255,.10)",

      borderRadius:
        "9px",

      padding:
        "11px 15px",

      color:
        "#ffffff",

      background:
        "#111111",

      fontSize:
        "11px",

      fontWeight:
        900,

      cursor:
        "pointer",
    },

    primaryLink: {
      display:
        "inline-block",

      padding:
        "11px 15px",

      borderRadius:
        "9px",

      color:
        "#ffffff",

      background:
        "linear-gradient(90deg, #c81710, #ff7600)",

      textDecoration:
        "none",

      fontSize:
        "11px",

      fontWeight:
        950,
    },

    secondaryLink: {
      display:
        "inline-block",

      padding:
        "11px 15px",

      border:
        "1px solid rgba(255,255,255,.11)",

      borderRadius:
        "9px",

      color:
        "#ffffff",

      background:
        "#111111",

      textDecoration:
        "none",

      fontSize:
        "11px",

      fontWeight:
        900,
    },

    success: {
      marginTop:
        "17px",

      padding:
        "12px",

      border:
        "1px solid rgba(36,190,100,.30)",

      borderRadius:
        "9px",

      color:
        "#72e4a0",

      background:
        "rgba(36,190,100,.08)",

      fontSize:
        "13px",
    },

    errorBox: {
      marginTop:
        "17px",

      padding:
        "12px",

      border:
        "1px solid rgba(255,79,79,.27)",

      borderRadius:
        "9px",

      color:
        "#ff9791",

      background:
        "rgba(255,60,60,.07)",

      fontSize:
        "13px",
    },

    error: {
      color:
        "#ff9791",

      lineHeight:
        1.6,
    },

    disabled: {
      opacity:
        .55,

      cursor:
        "not-allowed",
    },

    loadingText: {
      color:
        "#8b8b8b",
    },
  };
