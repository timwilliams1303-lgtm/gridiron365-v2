import type {
  CSSProperties,
  ReactNode,
} from "react";

type CardProps = {
  children: ReactNode;
  style?: CSSProperties;
};

export default function Card({
  children,
  style,
}: CardProps) {
  return (
    <section
      style={{
        ...styles.card,
        ...style,
      }}
    >
      {children}
    </section>
  );
}

const styles: Record<
  string,
  CSSProperties
> = {
  card: {
    position: "relative",

    border:
      "1px solid rgba(255,255,255,.10)",

    borderRadius: "16px",

    background:
      "linear-gradient(145deg,rgba(24,24,24,.98),rgba(8,8,8,.99))",

    boxShadow:
      "0 20px 55px rgba(0,0,0,.48)",

    overflow: "hidden",
  },
};