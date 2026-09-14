"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "./GreyhoundLeagueHome.module.css";

type CardData = {
  id: number;
  raceDate: string;
  session: string | null;
  cardStatus: string;
  scheduledFirstPost: string | null;
  lockAt: string | null;
  track: {
    id: number;
    code: string;
    name: string | null;
  } | null;
};

type WorkspaceData = {
  success: boolean;

  league?: {
    id: string;
    name: string;
  };

  settings?: {
    trackScope?: string;
    startingBankroll?: number | string;
  };

  availableCards?: CardData[];

  completedRacingDates?: string[];

  selectedDate?: string | null;

  card?: CardData | null;

  bankroll?: {
    id: number;
    startingBankroll: number;
    amountAllocated: number;
    amountUnallocated: number;
    officialReturn: number;
    cardStatus: string;
  } | null;

  races?: Array<{
    id: number;
    raceNumber: number;
    scheduledPostTime: string | null;
    raceStatus: string;
  }>;

  message?: string;

  error?: string;
};

type Props = {
  leagueId: string;
};

function money(value: unknown) {
  const numeric = Number(value ?? 0);

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(Number.isFinite(numeric) ? numeric : 0);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not available yet";

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]) - 1;
    const day = Number(match[3]);

    const date = new Date(
      Date.UTC(
        year,
        month,
        day,
        12,
        0,
        0,
      ),
    );

    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "America/New_York",
    }).format(date);
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "America/New_York",
  }).format(date);
}

function formatDateTime(
  value: string | null | undefined,
) {
  if (!value) return "Not posted yet";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  }).format(date);
}

function trackScopeLabel(value: unknown) {
  const scope = String(
    value ?? "wheeling",
  ).toLowerCase();

  if (
    scope === "all" ||
    scope === "both"
  ) {
    return "Wheeling + Tri-State";
  }

  if (
    scope === "tri_state" ||
    scope === "tri-state" ||
    scope === "tri state" ||
    scope === "tristate"
  ) {
    return "Tri-State";
  }

  return "Wheeling Island";
}

/*
 * All Greyhound racing-date decisions use Eastern Time.
 * This prevents UTC/server time from moving the dashboard
 * forward or backward on the wrong calendar date.
 */
function easternTodayIsoDate() {
  const formatter =
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone:
          "America/New_York",
        year:
          "numeric",
        month:
          "2-digit",
        day:
          "2-digit",
      },
    );

  const parts =
    formatter.formatToParts(
      new Date(),
    );

  const year =
    parts.find(
      (part) =>
        part.type === "year",
    )?.value;

  const month =
    parts.find(
      (part) =>
        part.type === "month",
    )?.value;

  const day =
    parts.find(
      (part) =>
        part.type === "day",
    )?.value;

  if (
    !year ||
    !month ||
    !day
  ) {
    return new Date()
      .toISOString()
      .slice(0, 10);
  }

  return `${year}-${month}-${day}`;
}

function parseIsoDate(
  value: string,
) {
  const match =
    /^(\d{4})-(\d{2})-(\d{2})$/.exec(
      value,
    );

  if (!match) {
    return null;
  }

  return new Date(
    Date.UTC(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]),
      12,
      0,
      0,
    ),
  );
}

function isoDateFromDate(
  value: Date,
) {
  return [
    value
      .getUTCFullYear()
      .toString()
      .padStart(4, "0"),
    String(
      value.getUTCMonth() + 1,
    ).padStart(2, "0"),
    String(
      value.getUTCDate(),
    ).padStart(2, "0"),
  ].join("-");
}

function addIsoDays(
  value: string,
  days: number,
) {
  const date =
    parseIsoDate(value);

  if (!date) {
    return value;
  }

  date.setUTCDate(
    date.getUTCDate() +
      days,
  );

  return isoDateFromDate(
    date,
  );
}

function isGreyhoundRacingDate(
  value: string,
) {
  const date =
    parseIsoDate(value);

  if (!date) {
    return false;
  }

  /*
   * Monday is the normal dark day.
   * Sunday = 0
   * Monday = 1
   */
  return (
    date.getUTCDay() !== 1
  );
}

function nextGreyhoundRacingDate(
  value: string,
) {
  let candidate =
    addIsoDays(
      value,
      1,
    );

  for (
    let attempts = 0;
    attempts < 14;
    attempts += 1
  ) {
    if (
      isGreyhoundRacingDate(
        candidate,
      )
    ) {
      return candidate;
    }

    candidate =
      addIsoDays(
        candidate,
        1,
      );
  }

  return candidate;
}

function currentOrNextGreyhoundRacingDate() {
  const today =
    easternTodayIsoDate();

  if (
    isGreyhoundRacingDate(
      today,
    )
  ) {
    return today;
  }

  return nextGreyhoundRacingDate(
    today,
  );
}

function advancePastCompletedDates(
  initialDate: string,
  completedDates: string[],
) {
  const completed =
    new Set(
      completedDates,
    );

  let targetDate =
    initialDate;

  /*
   * If an entire racing date has finished,
   * advance to the next valid racing date.
   *
   * This also means:
   * Sunday complete -> Tuesday
   * because Monday is skipped.
   */
  for (
    let attempts = 0;
    attempts < 14;
    attempts += 1
  ) {
    if (
      !completed.has(
        targetDate,
      )
    ) {
      return targetDate;
    }

    targetDate =
      nextGreyhoundRacingDate(
        targetDate,
      );
  }

  return targetDate;
}

function normalizeRaceStatus(
  raceStatus: string,
  cardStatus: string | null | undefined,
) {
  const race =
    String(
      raceStatus ?? "",
    ).toLowerCase();

  const card =
    String(
      cardStatus ?? "",
    ).toLowerCase();

  if (
    card === "final" &&
    race === "off"
  ) {
    return "official";
  }

  return race;
}

function cardSortValue(
  card: CardData,
) {
  if (
    card.scheduledFirstPost
  ) {
    const timestamp =
      new Date(
        card.scheduledFirstPost,
      ).getTime();

    if (
      Number.isFinite(
        timestamp,
      )
    ) {
      return timestamp;
    }
  }

  return Number.MAX_SAFE_INTEGER;
}

export default function GreyhoundLeagueHome({
  leagueId,
}: Props) {
  const [
    data,
    setData,
  ] =
    useState<WorkspaceData | null>(
      null,
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    error,
    setError,
  ] =
    useState("");

  const [
    displayDate,
    setDisplayDate,
  ] =
    useState<string>(
      currentOrNextGreyhoundRacingDate(),
    );

  const fetchWorkspace =
    useCallback(
      async (
        raceDate: string,
        trackCode?: string | null,
      ) => {
        const params =
          new URLSearchParams();

        params.set(
          "leagueId",
          leagueId,
        );

        params.set(
          "date",
          raceDate,
        );

        if (trackCode) {
          params.set(
            "track",
            trackCode,
          );
        }

        const response =
          await fetch(
            `/api/greyhound/wager-workspace?${params.toString()}`,
            {
              cache:
                "no-store",
            },
          );

        const payload =
          (await response.json()) as WorkspaceData;

        if (
          !response.ok ||
          payload.success ===
            false
        ) {
          throw new Error(
            payload.error ??
              "Unable to load Greyhound league overview.",
          );
        }

        return payload;
      },
      [leagueId],
    );

  const load =
    useCallback(
      async (
        silent = false,
      ) => {
        if (!silent) {
          setLoading(true);
        }

        try {
          /*
           * Always recalculate "today" during every refresh.
           * This is important if the browser stays open overnight.
           */
          const currentDate =
            currentOrNextGreyhoundRacingDate();

          /*
           * First request is date-only.
           *
           * The updated wager-workspace API intentionally does
           * not auto-open a track for a date-only request.
           *
           * We use this request to get:
           * - availableCards
           * - completedRacingDates
           * - league/settings information
           */
          let overview =
            await fetchWorkspace(
              currentDate,
            );

          let targetDate =
            advancePastCompletedDates(
              currentDate,
              overview.completedRacingDates ??
                [],
            );

          /*
           * If today's entire racing date has completed,
           * load metadata for the next racing date instead.
           */
          if (
            targetDate !==
            currentDate
          ) {
            overview =
              await fetchWorkspace(
                targetDate,
              );

            targetDate =
              advancePastCompletedDates(
                targetDate,
                overview.completedRacingDates ??
                  [],
              );

            /*
             * Extremely defensive:
             * if another completed date was skipped,
             * get the final target-date overview too.
             */
            if (
              overview.selectedDate !==
              targetDate
            ) {
              overview =
                await fetchWorkspace(
                  targetDate,
                );
            }
          }

          setDisplayDate(
            targetDate,
          );

          const availableCards =
            (
              overview.availableCards ??
              []
            )
              .filter(
                (card) =>
                  card.raceDate ===
                    targetDate &&
                  ![
                    "final",
                    "cancelled",
                  ].includes(
                    String(
                      card.cardStatus,
                    ).toLowerCase(),
                  ),
              )
              .sort(
                (
                  a,
                  b,
                ) =>
                  cardSortValue(a) -
                  cardSortValue(b),
              );

          /*
           * No card for the current/next racing date:
           * show Waiting.
           *
           * Do NOT fall back to an older card.
           */
          if (
            availableCards.length ===
            0
          ) {
            setData({
              ...overview,
              selectedDate:
                targetDate,
              card:
                null,
              bankroll:
                null,
              races:
                [],
            });

            setError("");

            return;
          }

          /*
           * The home dashboard is an overview, so if one or
           * more cards exist for the correct date we may
           * automatically display the earliest card.
           *
           * My Wagers still requires the member to click
           * Wheeling or Tri-State before opening the card.
           */
          const selectedCard =
            availableCards[0];

          const trackCode =
            selectedCard.track?.code ??
            null;

          if (!trackCode) {
            setData({
              ...overview,
              selectedDate:
                targetDate,
              card:
                selectedCard,
              bankroll:
                null,
              races:
                [],
            });

            setError("");

            return;
          }

          const detail =
            await fetchWorkspace(
              targetDate,
              trackCode,
            );

          /*
           * Final safety check:
           * never show a card from another date under
           * Today's Racing.
           */
          if (
            detail.card &&
            detail.card.raceDate !==
              targetDate
          ) {
            setData({
              ...overview,
              selectedDate:
                targetDate,
              card:
                null,
              bankroll:
                null,
              races:
                [],
            });

            setError("");

            return;
          }

          setData(
            detail,
          );

          setError("");
        } catch (
          loadError
        ) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load Greyhound league overview.",
          );
        } finally {
          if (!silent) {
            setLoading(false);
          }
        }
      },
      [
        fetchWorkspace,
      ],
    );

  useEffect(() => {
    void load(false);
  }, [load]);

  useEffect(() => {
    const interval =
      window.setInterval(
        () => {
          void load(true);
        },
        60000,
      );

    return () =>
      window.clearInterval(
        interval,
      );
  }, [load]);

  /*
   * If the browser tab stays open across midnight,
   * the one-minute refresh above recalculates the
   * Eastern racing date automatically.
   */

  const races =
    data?.races ?? [];

  const nextRace =
    useMemo(() => {
      const now =
        Date.now();

      return (
        races.find(
          (race) => {
            if (
              !race.scheduledPostTime
            ) {
              return false;
            }

            const post =
              new Date(
                race.scheduledPostTime,
              ).getTime();

            const status =
              normalizeRaceStatus(
                race.raceStatus,
                data?.card?.cardStatus,
              );

            return (
              Number.isFinite(
                post,
              ) &&
              post > now &&
              [
                "scheduled",
                "upcoming",
              ].includes(
                status,
              )
            );
          },
        ) ?? null
      );
    }, [
      races,
      data?.card?.cardStatus,
    ]);

  const startingBankroll =
    data?.bankroll
      ?.startingBankroll ??
    Number(
      data?.settings
        ?.startingBankroll ??
        0,
    );

  const availableBankroll =
    data?.bankroll
      ?.amountUnallocated ??
    startingBankroll;

  const displayedCardDate =
    data?.card?.raceDate ??
    displayDate;

  return (
    <main
      className={
        styles.page
      }
    >
      <div
        className={
          styles.shell
        }
      >
        <div
          style={{
            display:
              "flex",
            alignItems:
              "center",
            marginBottom:
              "12px",
          }}
        >
          <Link
            href="/my-leagues"
            style={{
              display:
                "inline-flex",
              minHeight:
                "42px",
              alignItems:
                "center",
              justifyContent:
                "center",
              gap:
                "8px",
              padding:
                "0 14px",
              border:
                "1px solid rgba(255, 103, 29, 0.38)",
              borderRadius:
                "10px",
              background:
                "linear-gradient(135deg, rgba(128, 24, 17, 0.48), rgba(54, 19, 12, 0.58))",
              color:
                "#ff9a62",
              textDecoration:
                "none",
              fontSize:
                "10px",
              fontWeight:
                950,
              letterSpacing:
                "0.07em",
              textTransform:
                "uppercase",
            }}
          >
            <span
              aria-hidden="true"
            >
              ←
            </span>

            <span>
              Back to My Leagues
            </span>
          </Link>
        </div>

        <section
          className={
            styles.hero
          }
        >
          <div
            className={
              styles.heroTop
            }
          >
            <div>
              <div
                className={
                  styles.eyebrow
                }
              >
                G365 Greyhound Racing
              </div>

              <h1
                className={
                  styles.title
                }
              >
                {data?.league
                  ?.name ??
                  "Greyhound League"}
              </h1>

              <p
                className={
                  styles.subtitle
                }
              >
                League overview,
                bankroll status,
                race-card availability,
                standings access,
                and quick links to
                the betting terminal.
              </p>
            </div>

            <Link
              href={`/league/${leagueId}/greyhound/wagers`}
              className={
                styles.primaryButton
              }
            >
              Open My Wagers
            </Link>
          </div>

          <div
            className={
              styles.statGrid
            }
          >
            <div
              className={
                styles.statCard
              }
            >
              <span>
                Available Bankroll
              </span>

              <strong>
                {money(
                  availableBankroll,
                )}
              </strong>

              <small>
                Starting bankroll{" "}
                {money(
                  startingBankroll,
                )}
              </small>
            </div>

            <div
              className={
                styles.statCard
              }
            >
              <span>
                Wagered This Card
              </span>

              <strong>
                {money(
                  data?.bankroll
                    ?.amountAllocated ??
                    0,
                )}
              </strong>

              <small>
                Official return{" "}
                {money(
                  data?.bankroll
                    ?.officialReturn ??
                    0,
                )}
              </small>
            </div>

            <div
              className={
                styles.statCard
              }
            >
              <span>
                Track
              </span>

              <strong
                className={
                  styles.statText
                }
              >
                {data?.card
                  ?.track?.name ??
                  trackScopeLabel(
                    data?.settings
                      ?.trackScope,
                  )}
              </strong>

              <small>
                {data?.card
                  ?.track?.code ??
                  "Waiting for card"}
              </small>
            </div>

            <div
              className={
                styles.statCard
              }
            >
              <span>
                Card Status
              </span>

              <strong
                className={
                  styles.statText
                }
              >
                {data?.card
                  ?.cardStatus
                  ?.replaceAll(
                    "_",
                    " ",
                  ) ??
                  "Waiting"}
              </strong>

              <small>
                {data?.card
                  ? formatDate(
                      data.card
                        .raceDate,
                    )
                  : `Waiting for ${formatDate(
                      displayDate,
                    )}`}
              </small>
            </div>
          </div>
        </section>

        {error ? (
          <div
            className={
              styles.error
            }
          >
            {error}
          </div>
        ) : null}

        <div
          className={
            styles.mainGrid
          }
        >
          <section
            className={
              styles.panel
            }
          >
            <div
              className={
                styles.panelHeader
              }
            >
              <div>
                <div
                  className={
                    styles.eyebrow
                  }
                >
                  Today&apos;s Racing
                </div>

                <h2>
                  Race Card Overview
                </h2>
              </div>

              <span
                className={
                  data?.card
                    ? styles.statusLive
                    : styles.statusWaiting
                }
              >
                {data?.card
                  ? "Card Available"
                  : "Waiting"}
              </span>
            </div>

            {loading &&
            !data ? (
              <div
                className={
                  styles.emptyState
                }
              >
                Loading league
                overview...
              </div>
            ) : data?.card ? (
              <div
                className={
                  styles.panelBody
                }
              >
                <div
                  className={
                    styles.infoGrid
                  }
                >
                  <div
                    className={
                      styles.infoBox
                    }
                  >
                    <span>
                      Race Date
                    </span>

                    <strong>
                      {formatDate(
                        data.card
                          .raceDate,
                      )}
                    </strong>
                  </div>

                  <div
                    className={
                      styles.infoBox
                    }
                  >
                    <span>
                      First Post
                    </span>

                    <strong>
                      {formatDateTime(
                        data.card
                          .scheduledFirstPost,
                      )}
                    </strong>
                  </div>

                  <div
                    className={
                      styles.infoBox
                    }
                  >
                    <span>
                      Next Race
                    </span>

                    <strong>
                      {nextRace
                        ? `Race ${nextRace.raceNumber}`
                        : "None"}
                    </strong>
                  </div>

                  <div
                    className={
                      styles.infoBox
                    }
                  >
                    <span>
                      Races Loaded
                    </span>

                    <strong>
                      {
                        races.length
                      }
                    </strong>
                  </div>
                </div>

                <div
                  className={
                    styles.raceStrip
                  }
                >
                  {races.map(
                    (
                      race,
                    ) => {
                      const status =
                        normalizeRaceStatus(
                          race.raceStatus,
                          data.card
                            ?.cardStatus,
                        );

                      return (
                        <div
                          key={
                            race.id
                          }
                          className={
                            styles.raceChip
                          }
                        >
                          <strong>
                            Race{" "}
                            {
                              race.raceNumber
                            }
                          </strong>

                          <span>
                            {status.replaceAll(
                              "_",
                              " ",
                            )}
                          </span>
                        </div>
                      );
                    },
                  )}
                </div>
              </div>
            ) : (
              <div
                className={
                  styles.panelBody
                }
              >
                <div
                  className={
                    styles.waitingBox
                  }
                >
                  <h3>
                    Waiting for the
                    next active race
                    card
                  </h3>

                  <p>
                    G365 is checking
                    the Greyhound feed
                    automatically for{" "}
                    {formatDate(
                      displayedCardDate,
                    )}
                    . When the card is
                    published, it will
                    appear here
                    automatically.
                  </p>
                </div>

                <div
                  className={
                    styles.placeholderRaces
                  }
                >
                  {Array.from(
                    {
                      length:
                        8,
                    },
                    (
                      _,
                      index,
                    ) =>
                      index +
                      1,
                  ).map(
                    (
                      raceNumber,
                    ) => (
                      <div
                        key={
                          raceNumber
                        }
                        className={
                          styles.placeholderRace
                        }
                      >
                        <strong>
                          Race{" "}
                          {
                            raceNumber
                          }
                        </strong>

                        <span>
                          Waiting
                        </span>
                      </div>
                    ),
                  )}
                </div>
              </div>
            )}
          </section>

          <aside
            className={
              styles.panel
            }
          >
            <div
              className={
                styles.panelHeader
              }
            >
              <div>
                <div
                  className={
                    styles.eyebrow
                  }
                >
                  League Hub
                </div>

                <h2>
                  Quick Access
                </h2>
              </div>
            </div>

            <div
              className={
                styles.quickLinks
              }
            >
              <Link
                href={`/league/${leagueId}/greyhound/wagers`}
                className={
                  styles.quickPrimary
                }
              >
                <strong>
                  My Wagers
                </strong>

                <span>
                  Open the race card,
                  select dogs, build
                  wagers, and manage
                  your bankroll.
                </span>
              </Link>

              <Link
                href={`/league/${leagueId}/greyhound/league-wagers`}
                className={
                  styles.quickLink
                }
              >
                <strong>
                  League Wagers
                </strong>

                <span>
                  View league wagering
                  activity and results.
                </span>
              </Link>

              <Link
                href={`/league/${leagueId}/greyhound/standings`}
                className={
                  styles.quickLink
                }
              >
                <strong>
                  Standings
                </strong>

                <span>
                  Follow bankroll
                  performance and league
                  position.
                </span>
              </Link>

              <Link
                href={`/league/${leagueId}/greyhound/recap`}
                className={
                  styles.quickLink
                }
              >
                <strong>
                  Recap
                </strong>

                <span>
                  Review completed
                  cards, returns, and
                  highlights.
                </span>
              </Link>
            </div>
          </aside>
        </div>

        <div
          className={
            styles.bottomGrid
          }
        >
          <div
            className={
              styles.bottomCard
            }
          >
            <span>
              Next Race
            </span>

            <strong>
              {nextRace
                ? `Race ${nextRace.raceNumber}`
                : "Waiting for card"}
            </strong>

            <small>
              {nextRace
                ? formatDateTime(
                    nextRace
                      .scheduledPostTime,
                  )
                : `Waiting for ${formatDate(
                    displayDate,
                  )}.`}
            </small>
          </div>

          <div
            className={
              styles.bottomCard
            }
          >
            <span>
              Card Lock
            </span>

            <strong>
              {data?.card
                ?.lockAt
                ? formatDateTime(
                    data.card
                      .lockAt,
                  )
                : "Not posted yet"}
            </strong>

            <small>
              Whole-card wagering
              locks five minutes before
              the first scheduled post.
            </small>
          </div>

          <div
            className={
              styles.bottomCard
            }
          >
            <span>
              Feed Status
            </span>

            <strong
              className={
                styles.green
              }
            >
              Automatic
            </strong>

            <small>
              This dashboard checks for
              new cards every minute.
            </small>
          </div>
        </div>
      </div>
    </main>
  );
}