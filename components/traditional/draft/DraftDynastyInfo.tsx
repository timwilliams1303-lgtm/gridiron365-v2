"use client";

type DraftType =
  | "redraft"
  | "startup"
  | "dynasty";

type Props = {
  draftType: DraftType;
  season: number;
  totalRounds: number;
  teamCount: number;
  protectedPlayers?: number | null;
  futurePickYears?: number | null;
  annualDraftRounds?: number | null;
};

export default function DraftDynastyInfo({
  draftType,
  season,
  totalRounds,
  teamCount,
  protectedPlayers,
  futurePickYears,
  annualDraftRounds,
}: Props) {
  if (draftType === "redraft") {
    return null;
  }

  const startup =
    draftType === "startup";

  return (
    <section
      style={{
        border:
          "1px solid rgba(255,92,35,.28)",
        borderRadius:
          16,
        background:
          "linear-gradient(135deg,rgba(255,72,15,.09),rgba(255,255,255,.025))",
        padding:
          16,
        marginBottom:
          14,
      }}
    >
      <div
        style={{
          display:
            "flex",
          flexWrap:
            "wrap",
          justifyContent:
            "space-between",
          gap:
            12,
          alignItems:
            "flex-start",
        }}
      >
        <div>
          <div
            style={{
              color:
                "#ff6b35",
              fontSize:
                12,
              fontWeight:
                900,
              letterSpacing:
                ".12em",
              textTransform:
                "uppercase",
            }}
          >
            NFL Dynasty
          </div>

          <h2
            style={{
              margin:
                "4px 0 4px",
              color:
                "#fff",
              fontSize:
                20,
              lineHeight:
                1.15,
            }}
          >
            {startup
              ? "Startup Draft"
              : `${season} Annual Dynasty Draft`}
          </h2>

          <div
            style={{
              color:
                "rgba(255,255,255,.62)",
              fontSize:
                13,
              lineHeight:
                1.5,
            }}
          >
            {startup
              ? "Build the league's original permanent Dynasty rosters."
              : "Add players to existing Dynasty rosters using the league's annual draft order and traded draft-pick ownership."}
          </div>
        </div>

        <div
          style={{
            border:
              "1px solid rgba(255,255,255,.10)",
            borderRadius:
              999,
            padding:
              "7px 11px",
            background:
              "rgba(0,0,0,.28)",
            color:
              "#fff",
            fontSize:
              12,
            fontWeight:
              800,
            whiteSpace:
              "nowrap",
          }}
        >
          {startup
            ? "STARTUP"
            : "ANNUAL"}
        </div>
      </div>

      <div
        style={{
          display:
            "grid",
          gridTemplateColumns:
            "repeat(auto-fit,minmax(120px,1fr))",
          gap:
            8,
          marginTop:
            14,
        }}
      >
        <Stat
          label="Season"
          value={season}
        />

        <Stat
          label="Teams"
          value={teamCount}
        />

        <Stat
          label="Draft Rounds"
          value={totalRounds}
        />

        {!startup &&
        protectedPlayers != null ? (
          <Stat
            label="Protected"
            value={`${protectedPlayers}/Team`}
          />
        ) : null}

        {!startup &&
        annualDraftRounds != null ? (
          <Stat
            label="Annual Rounds"
            value={annualDraftRounds}
          />
        ) : null}

        {!startup &&
        futurePickYears != null ? (
          <Stat
            label="Future Picks"
            value={`${futurePickYears} Years`}
          />
        ) : null}
      </div>

      <div
        style={{
          marginTop:
            12,
          padding:
            "10px 12px",
          borderRadius:
            10,
          background:
            "rgba(0,0,0,.24)",
          color:
            "rgba(255,255,255,.72)",
          fontSize:
            12,
          lineHeight:
            1.5,
        }}
      >
        {startup ? (
          <>
            Draft order is established by the
            Dynasty startup draft-order
            workflow. This draft creates the
            initial rosters for the league.
          </>
        ) : (
          <>
            Annual Dynasty picks may change
            ownership through trades. The
            draft board should always show the
            team that currently owns each pick.
          </>
        )}
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div
      style={{
        padding:
          "10px 11px",
        borderRadius:
          11,
        border:
          "1px solid rgba(255,255,255,.08)",
        background:
          "rgba(255,255,255,.035)",
      }}
    >
      <div
        style={{
          color:
            "rgba(255,255,255,.48)",
          fontSize:
            10,
          fontWeight:
            800,
          letterSpacing:
            ".08em",
          textTransform:
            "uppercase",
        }}
      >
        {label}
      </div>

      <div
        style={{
          marginTop:
            3,
          color:
            "#fff",
          fontSize:
            14,
          fontWeight:
            900,
        }}
      >
        {value}
      </div>
    </div>
  );
}