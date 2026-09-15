"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

type ConfirmedCard = {
  id: number;
  trackId: number;
  trackCode: string | null;
  trackName: string | null;
  raceDate: string;
  session: string;
  scheduledFirstPost: string | null;
  lockAt: string | null;
  cardStatus: string | null;
  source: string | null;
  importStatus: string | null;
  totalRaces: number;
  raceCount: number;
  entryCount: number;
  commissionerConfirmedAt: string | null;
  commissionerConfirmedBy: string | null;
};

type Props = {
  leagueId: string;
};

function titleCase(value: string | null | undefined) {
  if (!value) return "Unknown";

  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase()
    );
}

function formatRaceDate(value: string) {
  const date =
    new Date(`${value}T12:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(
    "en-US",
    {
      month: "short",
      day: "numeric",
      year: "numeric",
    }
  ).format(date);
}

function formatEasternTime(value: string | null) {
  if (!value) return "TBD";

  const date =
    new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "TBD";
  }

  return new Intl.DateTimeFormat(
    "en-US",
    {
      hour: "numeric",
      minute: "2-digit",
      timeZone: "America/New_York",
      timeZoneName: "short",
    }
  ).format(date);
}

export default function GreyhoundConfirmedRaceCards({
  leagueId,
}: Props) {
  const [cards, setCards] =
    useState<ConfirmedCard[]>([]);
  const [loading, setLoading] =
    useState(true);
  const [error, setError] =
    useState("");
  const [deletingCardId, setDeletingCardId] =
    useState<number | null>(null);
  const [minimized, setMinimized] =
    useState(true);

  const loadCards =
    useCallback(async () => {
      try {
        setLoading(true);
        setError("");

        const response =
          await fetch(
            `/api/greyhound/races/import?leagueId=${encodeURIComponent(
              leagueId
            )}`,
            {
              method: "GET",
              cache: "no-store",
            }
          );

        const payload =
          (await response.json()) as {
            success?: boolean;
            cards?: ConfirmedCard[];
            error?: string;
            message?: string;
          };

        if (
          !response.ok ||
          payload.success !== true
        ) {
          throw new Error(
            payload.error ??
              payload.message ??
              `Confirmed cards request failed with HTTP ${response.status}.`
          );
        }

        setCards(
          Array.isArray(payload.cards)
            ? payload.cards
            : []
        );
      } catch (unknownError) {
        setError(
          unknownError instanceof Error
            ? unknownError.message
            : "Confirmed race cards could not be loaded."
        );
      } finally {
        setLoading(false);
      }
    }, [leagueId]);

  useEffect(() => {
    void loadCards();
  }, [loadCards]);

  const deleteCard =
    async (card: ConfirmedCard) => {
      const label =
        `${card.trackName ?? card.trackCode ?? "Greyhound"} ` +
        `${formatRaceDate(card.raceDate)} (${titleCase(card.session)})`;

      if (
        !window.confirm(
          `Delete ${label}?\n\n` +
            "This is only for correcting/re-importing a card. " +
            "Deletion will be refused if the card already has wagers, results, payouts, Survivor picks, scratches, or dog results."
        )
      ) {
        return;
      }

      try {
        setDeletingCardId(card.id);
        setError("");

        const response =
          await fetch(
            "/api/greyhound/races/import",
            {
              method: "DELETE",
              headers: {
                "Content-Type":
                  "application/json",
              },
              body: JSON.stringify({
                leagueId,
                cardId:
                  card.id,
              }),
            }
          );

        const payload =
          (await response.json()) as {
            success?: boolean;
            error?: string;
            message?: string;
          };

        if (
          !response.ok ||
          payload.success !== true
        ) {
          throw new Error(
            payload.error ??
              payload.message ??
              `Delete failed with HTTP ${response.status}.`
          );
        }

        await loadCards();
      } catch (unknownError) {
        setError(
          unknownError instanceof Error
            ? unknownError.message
            : "The saved race card could not be deleted."
        );
      } finally {
        setDeletingCardId(null);
      }
    };

  return (
    <section className="confirmed-wrap">
      <div className="confirmed-heading">
        <div>
          <div className="eyebrow">
            COMMISSIONER
          </div>
          <h2>
            Current Confirmed Race Cards
          </h2>
          <p>
            Official cards that have been saved,
            commissioner-confirmed, and published
            to the wagering workspace.
          </p>
        </div>

        <div className="heading-actions">
          {!minimized && (
            <button
              type="button"
              className="refresh-button"
              onClick={() =>
                void loadCards()
              }
              disabled={loading}
            >
              {loading
                ? "REFRESHING..."
                : "REFRESH CARDS"}
            </button>
          )}

          <button
            type="button"
            className="minimize-button"
            onClick={() =>
              setMinimized((current) => !current)
            }
            aria-expanded={!minimized}
          >
            {minimized
              ? "EXPAND"
              : "MINIMIZE"}
          </button>
        </div>
      </div>

      {!minimized && error && (
        <div className="error-box">
          {error}
        </div>
      )}

      {!minimized && (
        <>
          {loading && cards.length === 0 ? (
            <div className="empty-box">
              Loading confirmed race cards...
            </div>
          ) : cards.length === 0 ? (
            <div className="empty-box">
              No commissioner-confirmed race cards
              are currently saved.
            </div>
          ) : (
            <div className="card-grid">
          {cards.map((card) => {
            const isComplete =
              card.raceCount > 0 &&
              card.entryCount ===
                card.raceCount * 8;

            return (
              <article
                key={card.id}
                className="race-card"
              >
                <div className="card-top">
                  <div>
                    <div className="track-code">
                      {card.trackCode ??
                        "GREYHOUND"}
                    </div>
                    <h3>
                      {card.trackName ??
                        card.trackCode ??
                        "Greyhound"}
                    </h3>
                    <div className="date-line">
                      {formatRaceDate(
                        card.raceDate
                      )}{" "}
                      ·{" "}
                      {titleCase(
                        card.session
                      )}
                    </div>
                  </div>

                  <span className="confirmed-badge">
                    CONFIRMED
                  </span>
                </div>

                <div className="stat-grid">
                  <div className="stat">
                    <span>Races</span>
                    <strong>
                      {card.raceCount}
                    </strong>
                  </div>
                  <div className="stat">
                    <span>Entries</span>
                    <strong>
                      {card.entryCount}
                    </strong>
                  </div>
                  <div className="stat">
                    <span>Status</span>
                    <strong>
                      {titleCase(
                        card.cardStatus
                      )}
                    </strong>
                  </div>
                  <div className="stat">
                    <span>Database</span>
                    <strong>
                      {isComplete
                        ? "Complete"
                        : "Check Card"}
                    </strong>
                  </div>
                </div>

                <div className="timing">
                  <div>
                    <span>
                      FIRST POST
                    </span>
                    <strong>
                      {formatEasternTime(
                        card.scheduledFirstPost
                      )}
                    </strong>
                  </div>
                  <div>
                    <span>
                      CARD LOCK
                    </span>
                    <strong>
                      {formatEasternTime(
                        card.lockAt
                      )}
                    </strong>
                  </div>
                </div>

                <div className="meta">
                  <span>
                    Source:{" "}
                    <strong>
                      {titleCase(
                        card.source
                      )}
                    </strong>
                  </span>
                  <span>
                    Import:{" "}
                    <strong>
                      {titleCase(
                        card.importStatus
                      )}
                    </strong>
                  </span>
                </div>

                <button
                  type="button"
                  className="delete-button"
                  disabled={
                    deletingCardId ===
                    card.id
                  }
                  onClick={() =>
                    void deleteCard(card)
                  }
                >
                  {deletingCardId ===
                  card.id
                    ? "DELETING CARD..."
                    : "DELETE CARD"}
                </button>
              </article>
            );
          })}
            </div>
          )}
        </>
      )}

      <style jsx>{`
        .confirmed-wrap {
          display: grid;
          gap: 16px;
          padding: 18px;
          border: 1px solid rgba(255, 91, 31, 0.35);
          border-radius: 18px;
          background:
            radial-gradient(
              circle at top right,
              rgba(255, 76, 0, 0.12),
              transparent 34%
            ),
            #0d0d0f;
          color: #fff;
        }

        .confirmed-heading {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
        }

        .eyebrow {
          margin-bottom: 5px;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.18em;
          color: #ff6a21;
        }

        h2,
        h3,
        p {
          margin: 0;
        }

        h2 {
          font-size: clamp(20px, 4vw, 28px);
          line-height: 1.05;
        }

        .confirmed-heading p {
          max-width: 720px;
          margin-top: 7px;
          color: #aaaab0;
          font-size: 13px;
          line-height: 1.5;
        }

        .refresh-button,
        .minimize-button,
        .delete-button {
          min-height: 44px;
          border-radius: 10px;
          padding: 0 14px;
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 0.04em;
          cursor: pointer;
        }

        .heading-actions {
          display: flex;
          flex: 0 0 auto;
          gap: 8px;
        }

        .refresh-button {
          flex: 0 0 auto;
          border: 1px solid #ff5b1f;
          background: #1a1a1e;
          color: #fff;
        }

        .minimize-button {
          flex: 0 0 auto;
          border: 1px solid #3b3b42;
          background: #101012;
          color: #d8d8dd;
        }

        .refresh-button:disabled,
        .minimize-button:disabled,
        .delete-button:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .card-grid {
          display: grid;
          grid-template-columns:
            repeat(
              auto-fit,
              minmax(min(100%, 330px), 1fr)
            );
          gap: 14px;
        }

        .race-card {
          display: grid;
          gap: 14px;
          padding: 16px;
          border: 1px solid #2d2d32;
          border-radius: 15px;
          background: #151518;
          box-shadow:
            0 12px 30px rgba(0, 0, 0, 0.18);
        }

        .card-top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
        }

        .track-code {
          margin-bottom: 3px;
          color: #ff6a21;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.14em;
        }

        h3 {
          font-size: 20px;
          line-height: 1.1;
        }

        .date-line {
          margin-top: 5px;
          color: #c5c5ca;
          font-size: 13px;
          font-weight: 700;
        }

        .confirmed-badge {
          flex: 0 0 auto;
          border: 1px solid rgba(46, 204, 113, 0.55);
          border-radius: 999px;
          padding: 6px 9px;
          background: rgba(46, 204, 113, 0.1);
          color: #65dc94;
          font-size: 10px;
          font-weight: 950;
          letter-spacing: 0.08em;
        }

        .stat-grid {
          display: grid;
          grid-template-columns:
            repeat(4, minmax(0, 1fr));
          gap: 8px;
        }

        .stat {
          min-width: 0;
          padding: 10px;
          border: 1px solid #29292e;
          border-radius: 10px;
          background: #101012;
        }

        .stat span,
        .timing span {
          display: block;
          margin-bottom: 4px;
          color: #85858d;
          font-size: 9px;
          font-weight: 900;
          letter-spacing: 0.08em;
        }

        .stat strong {
          display: block;
          overflow: hidden;
          color: #fff;
          font-size: 13px;
          text-overflow: ellipsis;
        }

        .timing {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }

        .timing > div {
          padding: 11px;
          border-radius: 10px;
          background:
            linear-gradient(
              135deg,
              rgba(255, 77, 0, 0.12),
              rgba(255, 145, 0, 0.04)
            );
        }

        .timing strong {
          font-size: 14px;
        }

        .meta {
          display: flex;
          flex-wrap: wrap;
          gap: 8px 16px;
          color: #96969e;
          font-size: 11px;
        }

        .meta strong {
          color: #d9d9dd;
        }

        .delete-button {
          width: 100%;
          border: 1px solid rgba(235, 69, 69, 0.6);
          background: rgba(145, 26, 26, 0.16);
          color: #ff7777;
        }

        .error-box,
        .empty-box {
          padding: 14px;
          border-radius: 11px;
          font-size: 13px;
          line-height: 1.45;
        }

        .error-box {
          border: 1px solid rgba(235, 69, 69, 0.5);
          background: rgba(145, 26, 26, 0.14);
          color: #ff9696;
        }

        .empty-box {
          border: 1px dashed #36363c;
          color: #a9a9af;
          text-align: center;
        }

        @media (max-width: 640px) {
          .confirmed-wrap {
            padding: 14px;
          }

          .confirmed-heading {
            display: grid;
          }

          .heading-actions {
            width: 100%;
          }

          .refresh-button,
          .minimize-button {
            flex: 1 1 0;
          }

          .stat-grid {
            grid-template-columns:
              repeat(2, minmax(0, 1fr));
          }

          .timing {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </section>
  );
}
