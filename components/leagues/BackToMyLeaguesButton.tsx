import Link from "next/link";

type BackToMyLeaguesButtonProps = {
  label?: string;
  className?: string;
};

export default function BackToMyLeaguesButton({
  label = "Back to My Leagues",
  className,
}: BackToMyLeaguesButtonProps) {
  return (
    <Link
      href="/my-leagues"
      className={className}
      style={
        className
          ? undefined
          : {
              display: "inline-flex",
              minHeight: "42px",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              padding: "0 14px",
              border: "1px solid rgba(255, 103, 29, 0.38)",
              borderRadius: "10px",
              background:
                "linear-gradient(135deg, rgba(128, 24, 17, 0.48), rgba(54, 19, 12, 0.58))",
              color: "#ff9a62",
              textDecoration: "none",
              fontSize: "10px",
              fontWeight: 950,
              letterSpacing: "0.07em",
              textTransform: "uppercase",
              whiteSpace: "nowrap",
            }
      }
    >
      <span aria-hidden="true">←</span>
      <span>{label}</span>
    </Link>
  );
}