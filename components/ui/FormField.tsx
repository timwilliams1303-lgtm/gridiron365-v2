import type {
  CSSProperties,
  InputHTMLAttributes,
} from "react";

type FormFieldProps =
  InputHTMLAttributes<HTMLInputElement> & {
    label: string;
    hint?: string;
  };

export default function FormField({
  label,
  hint,
  ...props
}: FormFieldProps) {
  return (
    <label
      style={styles.label}
    >
      <span
        style={styles.labelText}
      >
        {label}
      </span>

      <input
        {...props}
        style={{
          ...styles.input,
          ...props.style,
        }}
      />

      {hint ? (
        <span
          style={styles.hint}
        >
          {hint}
        </span>
      ) : null}
    </label>
  );
}

const styles: Record<
  string,
  CSSProperties
> = {
  label: {
    display: "grid",
    gap: "7px",
  },

  labelText: {
    color: "#e5e7eb",

    fontSize: "13px",
    fontWeight: 800,
  },

  input: {
    minHeight: "47px",

    padding:
      "11px 13px",
  },

  hint: {
    color: "#737985",

    fontSize: "11px",
    lineHeight: 1.4,
  },
};