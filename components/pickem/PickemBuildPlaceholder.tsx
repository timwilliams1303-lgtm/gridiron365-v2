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
      style={{
        padding: "22px 18px 36px",
      }}
    >
      <section
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
