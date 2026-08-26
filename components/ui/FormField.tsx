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

    gap: "8px",
  },


  labelText: {
    color: "#e5e7eb",

    fontSize: "15px",

    fontWeight: 800,

    lineHeight: 1.35,
  },


  input: {
    minHeight: "49px",

    padding:
      "12px 14px",

    fontSize: "14px",
  },


  hint: {
    color: "#8b919c",

    fontSize: "13px",

    lineHeight: 1.45,
  },
};