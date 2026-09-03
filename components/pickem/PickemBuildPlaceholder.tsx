type Props = {
  eyebrow: string;
  title: string;
  description: string;
};


export default function PickemBuildPlaceholder({
  eyebrow,
  title,
  description,
}: Props) {
  return (
    <main
      className="g365-pickem-placeholder"
      style={{
        padding: "22px 18px 36px",
        width: "100%",
        minWidth: 0,
      }}
    >
      <style>{`
        .g365-pickem-placeholder * {
          box-sizing: border-box;
        }

        @media (max-width: 760px) {
          .g365-pickem-placeholder {
            width: 100% !important;
            max-width: 100% !important;
            min-width: 0 !important;
            padding: 14px 12px 28px !important;
            overflow-x: hidden;
          }

          .g365-pickem-placeholder-card {
            width: 100% !important;
            max-width: 100% !important;
            min-width: 0 !important;
            padding: 17px !important;
          }

          .g365-pickem-placeholder h2 {
            font-size: clamp(27px, 8vw, 34px) !important;
            overflow-wrap: anywhere;
          }

          .g365-pickem-placeholder p {
            overflow-wrap: anywhere;
          }
        }

        @media (max-width: 430px) {
          .g365-pickem-placeholder {
            padding: 12px 10px 24px !important;
          }
        }
      `}</style>

      <section
        className="g365-pickem-placeholder-card"
        style={{
          maxWidth: 900,
          padding: 22,
          borderRadius: 16,
          border:
            "1px solid rgba(255,102,0,0.22)",
          background:
            "linear-gradient(135deg, rgba(88,8,12,0.3), #111115 55%)",
        }}
      >
        <div
          style={{
            color: "#ff7627",
            fontSize: 12,
            fontWeight: 1000,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
          }}
        >
          {eyebrow}
        </div>
        <h2
          style={{
            margin: "7px 0 8px",
            color: "white",
            fontSize: 32,
          }}
        >
          {title}
        </h2>
        <p
          style={{
            margin: 0,
            color: "#a6a6ae",
            lineHeight: 1.65,
          }}
        >
          {description}
        </p>
      </section>
    </main>
  );
}
