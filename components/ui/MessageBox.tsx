import type {
  CSSProperties,
} from "react";

type MessageType =
  | "success"
  | "error"
  | "info"
  | "warning";

type MessageBoxProps = {
  message: string;
  type?: MessageType;
};

export default function MessageBox({
  message,
  type = "info",
}: MessageBoxProps) {
  if (!message) {
    return null;
  }

  return (
    <div
      role={
        type === "error"
          ? "alert"
          : "status"
      }
      style={{
        ...styles.base,
        ...typeStyles[type],
      }}
    >
      {message}
    </div>
  );
}

const styles: Record<
  string,
  CSSProperties
> = {
  base: {
    padding:
      "11px 13px",

    borderRadius:
      "9px",

    fontSize:
      "13px",

    fontWeight:
      700,

    lineHeight:
      1.45,
  },
};

const typeStyles: Record<
  MessageType,
  CSSProperties
> = {
  success: {
    color: "#bbf7d0",

    background:
      "rgba(34,197,94,.12)",

    border:
      "1px solid rgba(34,197,94,.28)",
  },

  error: {
    color: "#fecaca",

    background:
      "rgba(239,68,68,.12)",

    border:
      "1px solid rgba(239,68,68,.30)",
  },

  info: {
    color: "#fed7aa",

    background:
      "rgba(255,140,0,.10)",

    border:
      "1px solid rgba(255,140,0,.25)",
  },

  warning: {
    color: "#fde68a",

    background:
      "rgba(250,204,21,.10)",

    border:
      "1px solid rgba(250,204,21,.25)",
  },
};