import type {
  ButtonHTMLAttributes,
  CSSProperties,
  ReactNode,
} from "react";

type ButtonVariant =
  | "primary"
  | "secondary"
  | "success"
  | "danger";

type ButtonProps =
  ButtonHTMLAttributes<HTMLButtonElement> & {
    children: ReactNode;
    variant?: ButtonVariant;
    fullWidth?: boolean;
  };

export default function Button({
  children,
  variant = "primary",
  fullWidth = false,
  disabled,
  style,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled}
      style={{
        ...styles.base,
        ...variantStyles[variant],

        ...(fullWidth
          ? styles.fullWidth
          : {}),

        ...(disabled
          ? styles.disabled
          : {}),

        ...style,
      }}
    >
      {children}
    </button>
  );
}

const styles: Record<
  string,
  CSSProperties
> = {
  base: {
    minHeight: "46px",

    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",

    gap: "8px",

    padding: "11px 19px",

    borderRadius: "9px",

    color: "#ffffff",

    fontSize: "14px",
    fontWeight: 900,

    letterSpacing: ".01em",

    cursor: "pointer",

    boxShadow:
      "0 10px 25px rgba(0,0,0,.24)",

    transition:
      "transform .12s ease, opacity .12s ease, filter .12s ease",
  },

  fullWidth: {
    width: "100%",
  },

  disabled: {
    opacity: 0.52,
    cursor: "not-allowed",
  },
};

const variantStyles: Record<
  ButtonVariant,
  CSSProperties
> = {
  primary: {
    background:
      "linear-gradient(135deg,#ff1e1e 0%,#ff4500 48%,#ff8c00 100%)",

    boxShadow:
      "0 10px 28px rgba(255,69,0,.18)",
  },

  secondary: {
    background:
      "linear-gradient(180deg,#222326,#151618)",

    border:
      "1px solid rgba(255,255,255,.12)",
  },

  success: {
    background:
      "linear-gradient(135deg,#22c55e,#15803d)",
  },

  danger: {
    background:
      "linear-gradient(135deg,#ef4444,#b91c1c)",
  },
};