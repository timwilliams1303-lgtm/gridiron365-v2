"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";

type Props = {
  status?: string | null;
  detail?: string | null;
  returnDate?: string | null;
  source?: string | null;
  className?: string;
};

function clean(value: string | null | undefined) {
  return String(value ?? "").trim();
}

function normalize(value: string | null | undefined) {
  return clean(value).toLowerCase().replace(/[\s-]+/g, "_");
}

function designation(status: string | null | undefined) {
  const value = normalize(status);

  if (!value) return "";

  if (
    value === "injured_reserve" ||
    value === "injured_reserve_list" ||
    value === "ir"
  ) {
    return "IR";
  }

  if (value === "out" || value === "out_indefinitely") {
    return "OUT";
  }

  if (value === "suspension" || value === "suspended") {
    return "SUS";
  }

  if (
    value === "day_to_day" ||
    value === "daytoday" ||
    value === "day_to_day_injury"
  ) {
    return "DTD";
  }

  if (
    value === "questionable" ||
    value === "game_time_decision" ||
    value === "game_time_decision_gtd" ||
    value === "gtd"
  ) {
    return "GTD";
  }

  if (value === "doubtful") {
    return "DBT";
  }

  return clean(status)
    .replace(/_/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 4);
}

function statusLabel(status: string | null | undefined) {
  const value = normalize(status);

  if (!value) return "";

  if (
    value === "injured_reserve" ||
    value === "injured_reserve_list" ||
    value === "ir"
  ) {
    return "Injured Reserve";
  }

  if (value === "out") {
    return "Out";
  }

  if (value === "out_indefinitely") {
    return "Out Indefinitely";
  }

  if (value === "suspension" || value === "suspended") {
    return "Suspended";
  }

  if (
    value === "day_to_day" ||
    value === "daytoday" ||
    value === "day_to_day_injury"
  ) {
    return "Day-to-Day";
  }

  if (
    value === "questionable" ||
    value === "game_time_decision" ||
    value === "game_time_decision_gtd" ||
    value === "gtd"
  ) {
    return "Game-Time Decision";
  }

  if (value === "doubtful") {
    return "Doubtful";
  }

  return clean(status)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatReturnDate(value: string | null | undefined) {
  const raw = clean(value);

  if (!raw) return "";

  /*
   * Date-only values need to be parsed as local calendar dates.
   * Otherwise YYYY-MM-DD can display one day early because of
   * timezone conversion.
   */
  const dateOnly = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (dateOnly) {
    const [, year, month, day] = dateOnly;

    const date = new Date(
      Number(year),
      Number(month) - 1,
      Number(day)
    );

    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(date);
  }

  const date = new Date(raw);

  if (Number.isNaN(date.getTime())) {
    return raw;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export default function NhlInjuryBadge({
  status,
  detail,
  returnDate,
  source,
  className = "",
}: Props) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLSpanElement | null>(null);

  const badge = designation(status);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;

      if (
        target instanceof Node &&
        wrapperRef.current &&
        !wrapperRef.current.contains(target)
      ) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  if (!badge) {
    return null;
  }

  const label = statusLabel(status);
  const injuryDetail = clean(detail);
  const expectedReturn = formatReturnDate(returnDate);
  const injurySource = clean(source);

  return (
    <span
      ref={wrapperRef}
      className={className}
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        flexShrink: 0,
        verticalAlign: "middle",
        zIndex: open ? 10000 : 1,
      }}
    >
      <button
        type="button"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen((current) => !current);
        }}
        aria-label={`${label} injury information`}
        aria-expanded={open}
        title={label}
        style={styles.badge}
      >
        {badge}
      </button>

      {open ? (
        <span
          role="dialog"
          aria-label="Player injury information"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
          style={styles.panel}
        >
          <span style={styles.panelHeader}>
            <span style={styles.headerCopy}>
              <span style={styles.eyebrow}>
                INJURY STATUS
              </span>

              <span style={styles.status}>
                {label}
              </span>
            </span>

            <button
              type="button"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setOpen(false);
              }}
              aria-label="Close injury information"
              style={styles.closeButton}
            >
              ×
            </button>
          </span>

          {injuryDetail ? (
            <span style={styles.section}>
              <span style={styles.sectionLabel}>
                INJURY
              </span>

              <span style={styles.sectionText}>
                {injuryDetail}
              </span>
            </span>
          ) : null}

          {expectedReturn ? (
            <span style={styles.section}>
              <span style={styles.sectionLabel}>
                EXPECTED RETURN
              </span>

              <span style={styles.returnText}>
                {expectedReturn}
              </span>
            </span>
          ) : null}

          {!injuryDetail && !expectedReturn ? (
            <span style={styles.section}>
              <span style={styles.sectionText}>
                No additional injury information is available.
              </span>
            </span>
          ) : null}

          {injurySource ? (
            <span style={styles.source}>
              Source: {injurySource}
            </span>
          ) : null}
        </span>
      ) : null}
    </span>
  );
}

const styles: Record<string, CSSProperties> = {
  /*
   * Compact designation only.
   *
   * OUT / DTD / GTD remain pill-shaped because they contain
   * three letters. IR stays nearly circular.
   */
  badge: {
    appearance: "none",
    WebkitAppearance: "none",

    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",

    minWidth: 19,
    height: 18,

    padding: "0 4px",
    margin: 0,

    borderRadius: 999,

    border: "1px solid rgba(249,115,22,0.72)",

    background:
      "linear-gradient(135deg, #b91c1c 0%, #991b1b 65%, #c2410c 100%)",

    color: "#ffffff",

    fontSize: 8,
    lineHeight: 1,
    fontWeight: 900,

    letterSpacing: "-0.02em",

    cursor: "pointer",

    whiteSpace: "nowrap",
    flexShrink: 0,

    boxSizing: "border-box",

    boxShadow: "0 0 5px rgba(239,68,68,0.20)",
  },

  panel: {
    position: "absolute",

    top: "calc(100% + 7px)",
    left: 0,

    width: 280,
    maxWidth: "calc(100vw - 32px)",

    display: "block",

    padding: 13,

    borderRadius: 11,

    border: "1px solid rgba(239,68,68,0.42)",

    background:
      "linear-gradient(180deg, #18181b 0%, #0c0c0e 100%)",

    color: "#ffffff",

    textAlign: "left",

    boxShadow:
      "0 22px 65px rgba(0,0,0,0.90), 0 0 22px rgba(220,38,38,0.12)",

    zIndex: 999999,

    whiteSpace: "normal",

    fontFamily: "inherit",

    boxSizing: "border-box",
  },

  panelHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",

    gap: 12,
  },

  headerCopy: {
    display: "block",
    minWidth: 0,
  },

  eyebrow: {
    display: "block",

    color: "#fb923c",

    fontSize: 9,
    lineHeight: 1.2,
    fontWeight: 900,

    letterSpacing: "0.16em",
  },

  status: {
    display: "block",

    marginTop: 5,

    color: "#ffffff",

    fontSize: 15,
    lineHeight: 1.2,
    fontWeight: 900,
  },

  closeButton: {
    appearance: "none",
    WebkitAppearance: "none",

    width: 26,
    height: 26,

    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",

    flexShrink: 0,

    padding: 0,

    borderRadius: 999,

    border: "1px solid rgba(255,255,255,0.13)",

    background: "rgba(255,255,255,0.05)",

    color: "rgba(255,255,255,0.78)",

    fontSize: 17,
    lineHeight: 1,
    fontWeight: 800,

    cursor: "pointer",
  },

  section: {
    display: "block",

    marginTop: 12,
  },

  sectionLabel: {
    display: "block",

    color: "rgba(255,255,255,0.45)",

    fontSize: 9,
    lineHeight: 1.2,
    fontWeight: 900,

    letterSpacing: "0.13em",
  },

  sectionText: {
    display: "block",

    marginTop: 5,

    color: "rgba(255,255,255,0.88)",

    fontSize: 12,
    lineHeight: 1.5,
    fontWeight: 600,
  },

  returnText: {
    display: "block",

    marginTop: 5,

    color: "#ffffff",

    fontSize: 12,
    lineHeight: 1.4,
    fontWeight: 800,
  },

  source: {
    display: "block",

    marginTop: 12,
    paddingTop: 8,

    borderTop: "1px solid rgba(255,255,255,0.08)",

    color: "rgba(255,255,255,0.42)",

    fontSize: 9,
    lineHeight: 1.4,
    fontWeight: 600,
  },
};