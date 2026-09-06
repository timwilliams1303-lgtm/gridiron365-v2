import {
  requireLeagueMember,
} from "@/lib/leagues/requireLeagueMember";

import NhlPickemLeagueNav from "@/components/nhl-pickem/NhlPickemLeagueNav";
import NhlPickemCommissioner from "@/components/nhl-pickem/NhlPickemCommissioner";
import NhlPickemParticipantManager from "@/components/nhl-pickem/NhlPickemParticipantManager";

type PageProps = {
  params: Promise<{
    leagueId: string;
  }>;
};

export default async function NhlPickemCommissionerPage({
  params,
}: PageProps) {
  const {
    leagueId,
  } = await params;

  const access =
    await requireLeagueMember(
      leagueId
    );

  if (
    !access.isCommissioner
  ) {
    return (
      <>
        <NhlPickemLeagueNav
          leagueId={leagueId}
          isCommissioner={false}
        />

        <main
          style={{
            maxWidth:
              1180,
            padding:
              "22px 18px 40px",
          }}
        >
          <section
            style={{
              padding:
                20,
              borderRadius:
                16,
              border:
                "1px solid rgba(255,85,85,0.24)",
              background:
                "rgba(120,0,0,0.10)",
            }}
          >
            <div
              style={{
                color:
                  "#ff7627",
                fontSize:
                  10,
                fontWeight:
                  1000,
                letterSpacing:
                  "0.08em",
              }}
            >
              G365 NHL PICK&apos;EM
            </div>

            <h1
              style={{
                margin:
                  "6px 0 5px",
                color:
                  "#fff",
                fontSize:
                  28,
              }}
            >
              Commissioner Access
              Required
            </h1>

            <p
              style={{
                margin:
                  0,
                color:
                  "#9999a2",
                fontSize:
                  12,
                lineHeight:
                  1.6,
              }}
            >
              Only the league
              commissioner can access
              NHL Pick&apos;em
              commissioner controls.
            </p>
          </section>
        </main>
      </>
    );
  }

  const season =
    Number(
      access.league?.season
    );

  if (
    !Number.isFinite(
      season
    )
  ) {
    return (
      <>
        <NhlPickemLeagueNav
          leagueId={leagueId}
          isCommissioner
        />

        <main
          style={{
            padding:
              "22px 18px 40px",
            color:
              "#aaaab2",
          }}
        >
          The NHL Pick&apos;em
          season could not be
          determined.
        </main>
      </>
    );
  }

  const commissionerUserId =
  access.league
    ?.commissionerUserId ??
  null;

  return (
    <>
      <NhlPickemLeagueNav
        leagueId={leagueId}
        isCommissioner
      />

      <NhlPickemCommissioner
        leagueId={leagueId}
        season={season}
      />

      <section
        style={{
          maxWidth:
            1180,
          padding:
            "0 18px 40px",
        }}
      >
        <div
          style={{
            padding:
              16,
            borderRadius:
              16,
            border:
              "1px solid rgba(255,255,255,0.08)",
            background:
              "#101014",
          }}
        >
          <NhlPickemParticipantManager
            leagueId={leagueId}
            season={season}
            commissionerUserId={
              commissionerUserId
            }
          />
        </div>
      </section>
    </>
  );
}