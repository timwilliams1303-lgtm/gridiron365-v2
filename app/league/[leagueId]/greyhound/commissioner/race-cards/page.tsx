import { redirect } from "next/navigation";

import GreyhoundRaceCardImporter from "@/components/greyhound/GreyhoundRaceCardImporter";
import GreyhoundAmtoteSync from "@/components/greyhound/GreyhoundAmtoteSync";
import GreyhoundConfirmCardButton from "@/components/greyhound/GreyhoundConfirmCardButton";

import { requireLeagueMember } from "@/lib/leagues/requireLeagueMember";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type PageProps = {
  params: Promise<{
    leagueId: string;
  }>;
};

type DogRow = {
  id: number;
  display_name: string;
};

type EntryRow = {
  id: number;
  box_number: number;
  morning_line_odds: string | null;
  kennel: string | null;
  trainer: string | null;
  weight: number | string | null;
  entry_status: string;
  greyhound_dogs: DogRow | DogRow[] | null;
};

type RaceRow = {
  id: number;
  race_number: number;
  grade: string | null;
  distance_yards: number | null;
  scheduled_post_time: string | null;
  actual_post_time: string | null;
  race_status: string;
  greyhound_entries: EntryRow[] | null;
};

type TrackRow = {
  id: number;
  code: string;
  name: string;
  timezone: string | null;
};

type CardRow = {
  id: number;
  race_date: string;
  session: string;
  scheduled_first_post: string | null;
  card_status: string;
  import_status: string;
  total_races: number | null;
  automation_enabled: boolean;
  commissioner_confirmed_at: string | null;
  commissioner_confirmed_by: string | null;
  greyhound_tracks: TrackRow | TrackRow[] | null;
  greyhound_races: RaceRow[] | null;
};

type FeedStatusRow = {
  id: number;
  track_id: number;
  race_date: string;
  session: string;
  source: string;
  status: string;
  last_attempt_at: string;
  last_success_at: string | null;
  error_message: string | null;
  greyhound_tracks: TrackRow | TrackRow[] | null;
};

type TrapStyle = {
  label: string;
  background: string;
  color: string;
  borderColor: string;
};

const WHEELING_TRAPS: Record<number, TrapStyle> = {
  1: {
    label: "Red",
    background: "#d71920",
    color: "#ffffff",
    borderColor: "#ff676b",
  },
  2: {
    label: "Blue",
    background: "#1557c0",
    color: "#ffffff",
    borderColor: "#4d8fff",
  },
  3: {
    label: "White",
    background: "#ffffff",
    color: "#111111",
    borderColor: "#d8d8d8",
  },
  4: {
    label: "Green",
    background: "#13833b",
    color: "#ffffff",
    borderColor: "#49c66f",
  },
  5: {
    label: "Black",
    background: "#111111",
    color: "#ffffff",
    borderColor: "#707070",
  },
  6: {
    label: "Yellow",
    background: "#f5c400",
    color: "#111111",
    borderColor: "#ffe36b",
  },
  7: {
    label: "Green / White",
    background:
      "linear-gradient(135deg,#13833b 0%,#13833b 50%,#ffffff 50%,#ffffff 100%)",
    color: "#111111",
    borderColor: "#75c78b",
  },
  8: {
    label: "Yellow / Black",
    background:
      "linear-gradient(135deg,#f5c400 0%,#f5c400 50%,#111111 50%,#111111 100%)",
    color: "#ffffff",
    borderColor: "#e6c348",
  },
};

function firstRelation<T>(
  value: T | T[] | null | undefined,
): T | null {
  if (!value) {
    return null;
  }

  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value;
}

function formatDate(
  value: string | null,
): string {
  if (!value) {
    return "—";
  }

  const parsed = new Date(
    `${value}T12:00:00`,
  );

  if (
    Number.isNaN(
      parsed.getTime(),
    )
  ) {
    return value;
  }

  return new Intl.DateTimeFormat(
    "en-US",
    {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    },
  ).format(parsed);
}

function formatDateTime(
  value: string | null,
): string {
  if (!value) {
    return "Not set";
  }

  const parsed = new Date(
    value,
  );

  if (
    Number.isNaN(
      parsed.getTime(),
    )
  ) {
    return value;
  }

  return new Intl.DateTimeFormat(
    "en-US",
    {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    },
  ).format(parsed);
}

function formatSession(
  value: string,
): string {
  if (!value) {
    return "—";
  }

  return (
    value.charAt(0).toUpperCase() +
    value.slice(1)
  );
}

function statusLabel(
  value: string,
): string {
  return value
    .replace(
      /_/g,
      " ",
    )
    .replace(
      /\b\w/g,
      (letter) =>
        letter.toUpperCase(),
    );
}

function statusTone(
  value: string,
): string {
  const normalized =
    value.toLowerCase();

  if (
    normalized === "official" ||
    normalized === "final" ||
    normalized === "imported" ||
    normalized === "updated" ||
    normalized === "active"
  ) {
    return "good";
  }

  if (
    normalized === "scratched" ||
    normalized === "withdrawn" ||
    normalized === "cancelled" ||
    normalized === "failed"
  ) {
    return "bad";
  }

  if (
    normalized === "locked" ||
    normalized === "off" ||
    normalized === "in_progress"
  ) {
    return "warn";
  }

  return "neutral";
}

function trapStyle(
  boxNumber: number,
) {
  const trap =
    WHEELING_TRAPS[
      boxNumber
    ];

  return {
    background:
      trap?.background ??
      "#171717",

    color:
      trap?.color ??
      "#ffffff",

    borderColor:
      trap?.borderColor ??
      "#555555",
  };
}

export default async function GreyhoundRaceCardsPage({
  params,
}: PageProps) {
  const {
    leagueId,
  } = await params;

  const access =
    await requireLeagueMember(
      leagueId,
    );

  if (
    String(
      access.league.leagueType,
    ) !== "greyhound"
  ) {
    redirect(
      `/league/${leagueId}`,
    );
  }

  if (
    !access.isCommissioner
  ) {
    redirect(
      `/league/${leagueId}`,
    );
  }

  const supabase =
    createSupabaseAdminClient();

  const {
    data,
    error,
  } =
    await supabase
      .from(
        "greyhound_cards",
      )
      .select(`
        id,
        race_date,
        session,
        scheduled_first_post,
        card_status,
        import_status,
        total_races,
        automation_enabled,
        commissioner_confirmed_at,
        commissioner_confirmed_by,
        greyhound_tracks!inner (
          id,
          code,
          name,
          timezone
        ),
        greyhound_races (
          id,
          race_number,
          grade,
          distance_yards,
          scheduled_post_time,
          actual_post_time,
          race_status,
          greyhound_entries (
            id,
            box_number,
            morning_line_odds,
            kennel,
            trainer,
            weight,
            entry_status,
            greyhound_dogs (
              id,
              display_name
            )
          )
        )
      `)
      .order(
        "race_date",
        {
          ascending:
            false,
        },
      )
      .limit(12);

  const cards =
    (data ?? []) as unknown as CardRow[];

  const { data: feedStatusData, error: feedStatusError } = await supabase
    .from("greyhound_feed_sync_status")
    .select(`
      id,
      track_id,
      race_date,
      session,
      source,
      status,
      last_attempt_at,
      last_success_at,
      error_message,
      greyhound_tracks!inner (
        id,
        code,
        name,
        timezone
      )
    `)
    .eq("source", "amtote")
    .order("race_date", { ascending: false })
    .order("last_attempt_at", { ascending: false })
    .limit(24);

  const feedStatuses =
    (feedStatusData ?? []) as unknown as FeedStatusRow[];

  const orphanFailures = feedStatuses.filter((feedStatus) => {
    if (feedStatus.status !== "failed") return false;

    return !cards.some((card) => {
      const track = firstRelation(card.greyhound_tracks);
      return (
        track?.id === feedStatus.track_id &&
        card.race_date === feedStatus.race_date &&
        card.session === feedStatus.session
      );
    });
  });

  return (
    <main className="gh-page">
      <style>{`
        .gh-page,
        .gh-page * {
          box-sizing: border-box;
        }

        .gh-page {
          min-height: 100vh;
          padding: 20px 20px 70px;
          background:
            radial-gradient(circle at top left,rgba(132,18,13,.16),transparent 28%),
            linear-gradient(180deg,#07080b,#0c0c0f 48%,#07080a);
          color: #f7f7f7;
        }

        .gh-page-shell {
          width: min(1500px,100%);
          margin: 0 auto;
        }

        .gh-page-hero {
          overflow: hidden;
          margin-bottom: 14px;
          border: 1px solid rgba(255,91,29,.28);
          border-radius: 18px;
          background:
            linear-gradient(135deg,rgba(126,16,13,.38),rgba(255,94,24,.09) 46%,#101113 100%);
          box-shadow: 0 22px 60px rgba(0,0,0,.30);
        }

        .gh-page-hero-inner {
          padding: 24px;
        }

        .gh-page-kicker {
          color: #ff6b22;
          font-size: 10px;
          font-weight: 950;
          letter-spacing: .15em;
          text-transform: uppercase;
        }

        .gh-page-title {
          margin: 7px 0 8px;
          font-size: clamp(28px,4vw,42px);
          line-height: 1;
          font-weight: 950;
          letter-spacing: -.035em;
        }

        .gh-page-copy {
          max-width: 800px;
          margin: 0;
          color: #a2a7ae;
          font-size: 13px;
          line-height: 1.65;
          font-weight: 600;
        }

        .gh-page-accent {
          height: 4px;
          background: linear-gradient(90deg,#981e17,#d73c1c,#f27525);
        }

        .gh-import-wrap {
          margin-bottom: 20px;
        }

        .gh-section-head {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 16px;
          margin: 18px 0 10px;
        }

        .gh-section-kicker {
          color: #e45f24;
          font-size: 8px;
          font-weight: 950;
          letter-spacing: .12em;
          text-transform: uppercase;
        }

        .gh-section-title {
          margin: 4px 0 0;
          color: #fff;
          font-size: 24px;
          font-weight: 950;
          letter-spacing: -.02em;
        }

        .gh-section-copy {
          margin: 6px 0 0;
          color: #777d85;
          font-size: 10px;
          line-height: 1.55;
        }

        .gh-count {
          padding: 9px 12px;
          border: 1px solid rgba(225,91,32,.34);
          border-radius: 10px;
          background: rgba(84,29,11,.26);
          color: #ffb185;
          font-size: 9px;
          font-weight: 950;
          white-space: nowrap;
        }

        .gh-card-stack {
          display: grid;
          gap: 14px;
        }

        .gh-card {
          overflow: hidden;
          border: 1px solid #2d2e31;
          border-radius: 16px;
          background: #101113;
          box-shadow: 0 18px 45px rgba(0,0,0,.24);
        }

        .gh-card > summary { list-style:none; cursor:pointer; user-select:none; -webkit-tap-highlight-color:transparent; }
        .gh-card > summary::-webkit-details-marker { display:none; }
        .gh-card-toggle { display:inline-flex; min-height:42px; align-items:center; justify-content:center; padding:0 14px; border:1px solid rgba(226,91,32,.45); border-radius:10px; background:rgba(91,31,11,.28); color:#ff9b64; font-size:9px; font-weight:950; letter-spacing:.08em; white-space:nowrap; text-transform:uppercase; }
        .gh-card-toggle::after { content:"Expand"; }
        .gh-card[open] .gh-card-toggle::after, .gh-orphan-card[open] .gh-card-toggle::after { content:"Minimize"; }
        .gh-card-body { border-top:1px solid #292a2d; }
        .gh-card-actions { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:12px 14px; border-bottom:1px solid #292a2d; background:#0c0d0f; }
        .gh-feed-failure { margin:12px; padding:13px; border:1px solid rgba(198,51,43,.55); border-radius:12px; background:rgba(79,15,13,.30); }
        .gh-feed-failure-title { color:#ffaaa5; font-size:10px; font-weight:950; letter-spacing:.06em; text-transform:uppercase; }
        .gh-feed-failure-copy { margin-top:5px; color:#c8a29f; font-size:10px; line-height:1.55; }
        .gh-backup-wrap { padding:0 12px 12px; }
        .gh-orphan-stack { display:grid; gap:10px; margin:0 0 18px; }
        .gh-orphan-card { overflow:hidden; border:1px solid rgba(190,44,36,.50); border-radius:14px; background:#101113; }
        .gh-orphan-card > summary { display:flex; min-height:64px; list-style:none; cursor:pointer; align-items:center; justify-content:space-between; gap:12px; padding:13px 15px; }
        .gh-orphan-card > summary::-webkit-details-marker { display:none; }
        .gh-orphan-title { margin-top:8px; color:#fff; font-size:13px; font-weight:950; }
        .gh-orphan-meta { margin-top:4px; color:#a16f6b; font-size:9px; }

        .gh-card-head {
          padding: 18px;
          border-bottom: 1px solid #292a2d;
          background:
            linear-gradient(115deg,rgba(90,17,13,.45),rgba(190,65,16,.08) 48%,#111214);
        }

        .gh-card-head-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
        }

        .gh-badges {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .gh-code,
        .gh-status {
          display: inline-flex;
          align-items: center;
          min-height: 27px;
          padding: 5px 9px;
          border-radius: 999px;
          font-size: 8px;
          font-weight: 950;
          letter-spacing: .05em;
          text-transform: uppercase;
        }

        .gh-code {
          border: 1px solid #d85d24;
          border-radius: 7px;
          background: linear-gradient(135deg,#9f2416,#ed661c);
          color: #fff;
        }

        .gh-status.good {
          border: 1px solid rgba(46,156,93,.38);
          background: rgba(16,88,49,.30);
          color: #9ce8bc;
        }

        .gh-status.bad {
          border: 1px solid rgba(190,44,36,.45);
          background: rgba(89,14,13,.34);
          color: #ffaaa5;
        }

        .gh-status.warn {
          border: 1px solid rgba(217,98,29,.44);
          background: rgba(91,38,12,.34);
          color: #ffc092;
        }

        .gh-status.neutral {
          border: 1px solid #3a3c40;
          background: #1a1b1e;
          color: #a9adb3;
        }

        .gh-card-title {
          margin: 11px 0 0;
          color: #fff;
          font-size: 24px;
          font-weight: 950;
          letter-spacing: -.025em;
        }

        .gh-card-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 6px 18px;
          margin-top: 8px;
          color: #999da4;
          font-size: 10px;
          font-weight: 650;
        }

        .gh-card-side {
          display: flex;
          align-items: center;
          gap: 10px;
          flex: 0 0 auto;
        }

        .gh-stats {
          display: grid;
          grid-template-columns: repeat(3,minmax(86px,1fr));
          gap: 6px;
        }

        .gh-stat {
          padding: 9px 10px;
          border: 1px solid #333438;
          border-radius: 10px;
          background: rgba(0,0,0,.25);
          text-align: center;
        }

        .gh-stat strong {
          display: block;
          color: #fff;
          font-size: 18px;
          font-weight: 950;
        }

        .gh-stat span {
          display: block;
          margin-top: 2px;
          color: #7a7f86;
          font-size: 7px;
          font-weight: 950;
          letter-spacing: .1em;
          text-transform: uppercase;
        }

        .gh-races {
          display: grid;
          gap: 7px;
          padding: 10px;
        }

        .gh-race {
          overflow: hidden;
          border: 1px solid #292a2d;
          border-radius: 11px;
          background: #0d0e10;
        }

        .gh-race > summary {
          list-style: none;
          cursor: pointer;
        }

        .gh-race > summary::-webkit-details-marker {
          display: none;
        }

        .gh-race-summary {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          padding: 12px 13px;
          transition: background .15s ease;
        }

        .gh-race-summary:hover {
          background: #151618;
        }

        .gh-race-left {
          display: flex;
          min-width: 0;
          align-items: center;
          gap: 12px;
        }

        .gh-race-number {
          display: flex;
          width: 44px;
          height: 44px;
          flex: 0 0 auto;
          align-items: center;
          justify-content: center;
          border: 1px solid #de6124;
          border-radius: 10px;
          background: linear-gradient(135deg,#a72617,#ed681d);
          color: #fff;
          font-size: 16px;
          font-weight: 950;
        }

        .gh-race-name {
          color: #fff;
          font-size: 14px;
          font-weight: 950;
        }

        .gh-race-info {
          display: flex;
          flex-wrap: wrap;
          gap: 4px 12px;
          margin-top: 4px;
          color: #7e838a;
          font-size: 9px;
        }

        .gh-grade {
          display: inline-flex;
          padding: 4px 6px;
          border: 1px solid rgba(222,96,35,.32);
          border-radius: 6px;
          background: rgba(84,29,11,.28);
          color: #ffa06b;
          font-size: 8px;
          font-weight: 950;
        }

        .gh-race-right {
          display: flex;
          align-items: center;
          gap: 8px;
          flex: 0 0 auto;
        }

        .gh-chevron {
          display: flex;
          width: 32px;
          height: 32px;
          align-items: center;
          justify-content: center;
          border: 1px solid #35373a;
          border-radius: 999px;
          background: #090a0b;
          color: #e86a2d;
          font-size: 16px;
          font-weight: 950;
        }

        .gh-table-wrap {
          overflow-x: auto;
          border-top: 1px solid #292a2d;
          scrollbar-width: thin;
          scrollbar-color: #b7481b #161719;
        }

        .gh-table {
          width: 100%;
          min-width: 900px;
          border-collapse: collapse;
        }

        .gh-table th {
          padding: 10px 12px;
          border-bottom: 1px solid #292a2d;
          background: linear-gradient(90deg,#21100c,#171313,#111);
          color: #ef783c;
          font-size: 8px;
          font-weight: 950;
          letter-spacing: .1em;
          text-align: left;
          text-transform: uppercase;
        }

        .gh-table td {
          padding: 10px 12px;
          border-bottom: 1px solid #202124;
          color: #c7c9cd;
          font-size: 10px;
        }

        .gh-box {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .gh-trap {
          display: flex;
          width: 34px;
          height: 34px;
          flex: 0 0 auto;
          align-items: center;
          justify-content: center;
          border: 2px solid;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 950;
        }

        .gh-dog {
          color: #fff;
          font-size: 11px;
          font-weight: 950;
        }

        .gh-odds {
          display: inline-flex;
          min-width: 48px;
          justify-content: center;
          padding: 6px 7px;
          border: 1px solid #754021;
          border-radius: 7px;
          background: rgba(83,34,13,.35);
          color: #ff9b5f;
          font-size: 10px;
          font-weight: 950;
        }

        .gh-empty,
        .gh-error {
          padding: 18px;
          border-radius: 13px;
          font-size: 11px;
          line-height: 1.55;
        }

        .gh-empty {
          border: 1px dashed #3a3c40;
          background: #101113;
          color: #878c93;
          text-align: center;
        }

        .gh-error {
          border: 1px solid rgba(188,38,30,.5);
          background: rgba(90,12,12,.32);
          color: #ffb6b2;
        }

        .gh-mobile-runners {
          display: none;
        }

        @media (max-width: 900px) {
          .gh-card-head-row {
            align-items: flex-start;
            flex-direction: column;
          }

          .gh-card-side {
            width: 100%;
            align-items: stretch;
            flex-direction: column;
          }

          .gh-stats {
            width: 100%;
          }

          .gh-card-toggle { width:100%; }
          .gh-card-actions { align-items:stretch; flex-direction:column; }
          .gh-card-actions > * { width:100%; }
        }

        @media (max-width: 700px) {
          .gh-page {
            padding: 12px 10px 70px;
          }

          .gh-page-hero-inner {
            padding: 16px;
          }

          .gh-page-title {
            font-size: 28px;
          }

          .gh-page-copy {
            font-size: 11px;
          }

          .gh-section-head {
            align-items: flex-start;
            flex-direction: column;
          }

          .gh-card-head {
            padding: 14px;
          }

          .gh-card-title {
            font-size: 21px;
          }

          .gh-card-meta {
            display: grid;
            gap: 4px;
          }

          .gh-race-summary {
            padding: 10px;
          }

          .gh-race-number {
            width: 40px;
            height: 40px;
            font-size: 14px;
          }

          .gh-race-name {
            font-size: 12px;
          }

          .gh-race-info {
            font-size: 8px;
          }

          .gh-table-wrap {
            display: none;
          }

          .gh-mobile-runners {
            display: grid;
            gap: 6px;
            padding: 8px;
            border-top: 1px solid #292a2d;
          }

          .gh-mobile-runner {
            display: grid;
            grid-template-columns: 40px minmax(0,1fr) auto;
            gap: 9px;
            align-items: center;
            padding: 9px;
            border: 1px solid #26282b;
            border-radius: 9px;
            background: #121315;
          }

          .gh-mobile-runner .gh-trap {
            width: 38px;
            height: 38px;
          }

          .gh-mobile-name {
            min-width: 0;
          }

          .gh-mobile-name strong {
            display: block;
            color: #fff;
            font-size: 11px;
            line-height: 1.3;
            overflow-wrap: anywhere;
          }

          .gh-mobile-name span {
            display: block;
            margin-top: 3px;
            color: #767b82;
            font-size: 8px;
            line-height: 1.4;
          }
          .gh-stats { grid-template-columns:repeat(3,minmax(0,1fr)); }
          .gh-stat { padding:8px 5px; }
          .gh-stat strong { font-size:16px; }
          .gh-orphan-card > summary { align-items:stretch; flex-direction:column; }
          .gh-orphan-card .gh-card-toggle { width:100%; }
        }

        @media (max-width: 420px) {
          .gh-page { padding-left:8px; padding-right:8px; }
          .gh-card-head { padding:12px; }
          .gh-card-title { font-size:19px; }
          .gh-badges { gap:4px; }
          .gh-code,.gh-status { min-height:25px; padding:4px 7px; font-size:7px; }
          .gh-card-meta { font-size:9px; }
        }
      `}</style>

      <div className="gh-page-shell">
        <section className="gh-page-hero">
          <div className="gh-page-hero-inner">
            <div className="gh-page-kicker">
              G365 Greyhound Racing · Commissioner
            </div>

            <h1 className="gh-page-title">
              Race Card Management
            </h1>

            <p className="gh-page-copy">
              Official Wheeling and Tri-State race cards now sync directly from
              AmTote. Review every race and runner, verify the card, and monitor
              the racing slate through the Gridiron365 Greyhound lifecycle.
            </p>
          </div>

          <div className="gh-page-accent" />
        </section>

        <GreyhoundAmtoteSync leagueId={leagueId} />

        {feedStatusError ? (
          <div className="gh-error" style={{ marginBottom: 16 }}>
            Could not load official-feed status: {feedStatusError.message}
          </div>
        ) : null}

        {orphanFailures.length > 0 ? (
          <div className="gh-orphan-stack">
            {orphanFailures.map((feedStatus) => {
              const failedTrack = firstRelation(feedStatus.greyhound_tracks);
              const trackCode = failedTrack?.code === "GTS" ? "GTS" : "GWD";

              return (
                <details key={feedStatus.id} className="gh-orphan-card">
                  <summary>
                    <div>
                      <div className="gh-badges">
                        <span className="gh-code">{trackCode}</span>
                        <span className="gh-status bad">Official Feed Failed</span>
                      </div>
                      <div className="gh-orphan-title">
                        {failedTrack?.name ?? "Greyhound Track"}
                      </div>
                      <div className="gh-orphan-meta">
                        {formatDate(feedStatus.race_date)} · {formatSession(feedStatus.session)} Session
                      </div>
                    </div>
                    <span className="gh-card-toggle" />
                  </summary>

                  <div className="gh-feed-failure">
                    <div className="gh-feed-failure-title">Day-Specific Backup Available</div>
                    <div className="gh-feed-failure-copy">
                      {feedStatus.error_message ?? "The official AmTote feed failed for this track and racing day."}
                    </div>
                  </div>

                  <div className="gh-backup-wrap">
                    <GreyhoundRaceCardImporter
                      leagueId={leagueId}
                      backupOnly
                      expectedTrackCode={trackCode}
                      expectedTrackName={failedTrack?.name ?? trackCode}
                      expectedRaceDate={feedStatus.race_date}
                      expectedSession={feedStatus.session}
                      importEndpoint="/api/greyhound/races/import-backup"
                    />
                  </div>
                </details>
              );
            })}
          </div>
        ) : null}

        <div className="gh-section-head">
          <div>
            <div className="gh-section-kicker">
              Race Management
            </div>

            <h2 className="gh-section-title">
              Race Cards
            </h2>

            <p className="gh-section-copy">
              Every card starts minimized. Expand only the track and date you want to review.
            </p>
          </div>

          <div className="gh-count">
            {cards.length}{" "}
            {cards.length === 1
              ? "CARD"
              : "CARDS"}
          </div>
        </div>

        {error ? (
          <div className="gh-error">
            Could not load Greyhound race cards:{" "}
            {error.message}
          </div>
        ) : cards.length === 0 ? (
          <div className="gh-empty">
            No Greyhound race cards have been saved yet. Use Sync Official Entries
            Now above, or wait for the automatic AmTote sync.
          </div>
        ) : (
          <div className="gh-card-stack">
            {cards.map(
              (
                card,
              ) => {
                const track =
                  firstRelation(
                    card.greyhound_tracks,
                  );

                const races = [
                  ...(
                    card.greyhound_races ??
                    []
                  ),
                ].sort(
                  (
                    first,
                    second,
                  ) =>
                    first.race_number -
                    second.race_number,
                );

                const confirmed =
                  Boolean(
                    card.commissioner_confirmed_at,
                  );

                const totalEntries =
                  races.reduce(
                    (
                      total,
                      race,
                    ) =>
                      total +
                      (
                        race
                          .greyhound_entries
                          ?.length ??
                        0
                      ),
                    0,
                  );

                const feedStatus = feedStatuses.find(
                  (status) =>
                    status.track_id === track?.id &&
                    status.race_date === card.race_date &&
                    status.session === card.session,
                );
                const feedFailed = feedStatus?.status === "failed";
                const trackCode = track?.code === "GTS" ? "GTS" : "GWD";

                return (
                  <details key={card.id} className="gh-card">
                    <summary className="gh-card-head">
                      <div className="gh-card-head-row">
                        <div>
                          <div className="gh-badges">
                            <span className="gh-code">
                              {track
                                ?.code ??
                                "G365"}
                            </span>

                            <span
                              className={`gh-status ${statusTone(
                                card.card_status,
                              )}`}
                            >
                              {statusLabel(
                                card.card_status,
                              )}
                            </span>

                            <span
                              className={`gh-status ${statusTone(
                                card.import_status,
                              )}`}
                            >
                              Import{" "}
                              {statusLabel(
                                card.import_status,
                              )}
                            </span>

                            {confirmed && (
                              <span className="gh-status good">
                                Confirmed
                              </span>
                            )}

                            {feedStatus ? (
                              <span className={`gh-status ${feedFailed ? "bad" : feedStatus.status === "success" ? "good" : "warn"}`}>
                                {feedFailed ? "Official Feed Failed" : feedStatus.status === "success" ? "Official Feed OK" : "Official Feed Skipped"}
                              </span>
                            ) : null}
                          </div>

                          <h3 className="gh-card-title">
                            {track
                              ?.name ??
                              "Greyhound Track"}
                          </h3>

                          <div className="gh-card-meta">
                            <span>
                              {formatDate(
                                card.race_date,
                              )}
                            </span>

                            <span>
                              {formatSession(
                                card.session,
                              )}{" "}
                              Session
                            </span>

                          </div>
                        </div>

                        <div className="gh-card-side">
                          <div className="gh-stats">
                            <div className="gh-stat">
                              <strong>
                                {
                                  races.length
                                }
                              </strong>
                              <span>
                                Races
                              </span>
                            </div>

                            <div className="gh-stat">
                              <strong>
                                {
                                  totalEntries
                                }
                              </strong>
                              <span>
                                Entries
                              </span>
                            </div>

                            <div className="gh-stat">
                              <strong>
                                {card.total_races ??
                                  races.length}
                              </strong>
                              <span>
                                Expected
                              </span>
                            </div>
                          </div>

                          <span className="gh-card-toggle" />
                        </div>
                      </div>
                    </summary>

                    <div className="gh-card-body">
                      <div className="gh-card-actions">
                        <div>
                          <div className="gh-section-kicker">Commissioner</div>
                          <div className="gh-section-copy" style={{ marginTop: 3 }}>
                            Confirm the official card after reviewing its runners.
                          </div>
                        </div>

                        <GreyhoundConfirmCardButton
                          leagueId={leagueId}
                          cardId={card.id}
                          confirmed={confirmed}
                          disabled={
                            races.length === 0 ||
                            card.card_status === "locked" ||
                            card.card_status === "in_progress" ||
                            card.card_status === "final" ||
                            card.card_status === "cancelled"
                          }
                        />
                      </div>

                      {feedFailed ? (
                        <>
                          <div className="gh-feed-failure">
                            <div className="gh-feed-failure-title">
                              Official Feed Failed · Manual Backup Enabled
                            </div>
                            <div className="gh-feed-failure-copy">
                              {feedStatus?.error_message ?? "The official AmTote feed failed for this exact track and racing day."}{" "}
                              The importer below is locked to this card&apos;s track, date, and session.
                            </div>
                          </div>

                          <div className="gh-backup-wrap">
                            <GreyhoundRaceCardImporter
                              leagueId={leagueId}
                              backupOnly
                              expectedTrackCode={trackCode}
                              expectedTrackName={track?.name ?? trackCode}
                              expectedRaceDate={card.race_date}
                              expectedSession={card.session}
                              importEndpoint="/api/greyhound/races/import-backup"
                            />
                          </div>
                        </>
                      ) : null}

                    <div className="gh-races">
                      {races.map(
                        (
                          race,
                        ) => {
                          const entryByBox =
                            new Map<
                              number,
                              EntryRow
                            >();

                          for (
                            const entry of
                            race.greyhound_entries ??
                            []
                          ) {
                            entryByBox.set(
                              entry.box_number,
                              entry,
                            );
                          }

                          return (
                            <details
                              key={
                                race.id
                              }
                              className="gh-race"
                            >
                              <summary>
                                <div className="gh-race-summary">
                                  <div className="gh-race-left">
                                    <div className="gh-race-number">
                                      {
                                        race.race_number
                                      }
                                    </div>

                                    <div>
                                      <div className="gh-race-name">
                                        Race{" "}
                                        {
                                          race.race_number
                                        }{" "}
                                        {race.grade && (
                                          <span className="gh-grade">
                                            Grade{" "}
                                            {
                                              race.grade
                                            }
                                          </span>
                                        )}
                                      </div>

                                      <div className="gh-race-info">
                                        <span>
                                          {race.distance_yards
                                            ? `${race.distance_yards} Yards`
                                            : "Distance unavailable"}
                                        </span>


                                        <span>
                                          {race
                                            .greyhound_entries
                                            ?.length ??
                                            0}{" "}
                                          runners
                                        </span>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="gh-race-right">
                                    <span
                                      className={`gh-status ${statusTone(
                                        race.race_status,
                                      )}`}
                                    >
                                      {statusLabel(
                                        race.race_status,
                                      )}
                                    </span>

                                    <div className="gh-chevron">
                                      ▾
                                    </div>
                                  </div>
                                </div>
                              </summary>

                              <div className="gh-table-wrap">
                                <table className="gh-table">
                                  <thead>
                                    <tr>
                                      <th>
                                        Box
                                      </th>
                                      <th>
                                        Greyhound
                                      </th>
                                      <th>
                                        Odds
                                      </th>
                                      <th>
                                        Trainer
                                      </th>
                                      <th>
                                        Kennel
                                      </th>
                                      <th>
                                        Weight
                                      </th>
                                      <th>
                                        Status
                                      </th>
                                    </tr>
                                  </thead>

                                  <tbody>
                                    {Array.from(
                                      {
                                        length:
                                          8,
                                      },
                                      (
                                        _,
                                        index,
                                      ) =>
                                        index +
                                        1,
                                    ).map(
                                      (
                                        boxNumber,
                                      ) => {
                                        const trap =
                                          WHEELING_TRAPS[
                                            boxNumber
                                          ];

                                        const entry =
                                          entryByBox.get(
                                            boxNumber,
                                          );

                                        if (
                                          !entry
                                        ) {
                                          return (
                                            <tr
                                              key={
                                                boxNumber
                                              }
                                            >
                                              <td>
                                                <div className="gh-box">
                                                  <div
                                                    className="gh-trap"
                                                    style={
                                                      trapStyle(
                                                        boxNumber,
                                                      )
                                                    }
                                                  >
                                                    {
                                                      boxNumber
                                                    }
                                                  </div>

                                                  <span>
                                                    {
                                                      trap
                                                        ?.label
                                                    }
                                                  </span>
                                                </div>
                                              </td>

                                              <td>
                                                <span className="gh-dog">
                                                  Vacant
                                                </span>
                                              </td>

                                              <td>
                                                —
                                              </td>
                                              <td>
                                                —
                                              </td>
                                              <td>
                                                —
                                              </td>
                                              <td>
                                                —
                                              </td>
                                              <td>
                                                <span className="gh-status neutral">
                                                  Vacant
                                                </span>
                                              </td>
                                            </tr>
                                          );
                                        }

                                        const dog =
                                          firstRelation(
                                            entry.greyhound_dogs,
                                          );

                                        return (
                                          <tr
                                            key={
                                              entry.id
                                            }
                                          >
                                            <td>
                                              <div className="gh-box">
                                                <div
                                                  className="gh-trap"
                                                  style={
                                                    trapStyle(
                                                      entry.box_number,
                                                    )
                                                  }
                                                >
                                                  {
                                                    entry.box_number
                                                  }
                                                </div>

                                                <span>
                                                  {
                                                    trap
                                                      ?.label
                                                  }
                                                </span>
                                              </div>
                                            </td>

                                            <td>
                                              <span className="gh-dog">
                                                {dog?.display_name ??
                                                  "Unknown Greyhound"}
                                              </span>
                                            </td>

                                            <td>
                                              <span className="gh-odds">
                                                {entry.morning_line_odds ??
                                                  "—"}
                                              </span>
                                            </td>

                                            <td>
                                              {entry.trainer ??
                                                "—"}
                                            </td>

                                            <td>
                                              {entry.kennel ??
                                                "—"}
                                            </td>

                                            <td>
                                              {entry.weight ??
                                                "—"}
                                            </td>

                                            <td>
                                              <span
                                                className={`gh-status ${statusTone(
                                                  entry.entry_status,
                                                )}`}
                                              >
                                                {statusLabel(
                                                  entry.entry_status,
                                                )}
                                              </span>
                                            </td>
                                          </tr>
                                        );
                                      },
                                    )}
                                  </tbody>
                                </table>
                              </div>

                              <div className="gh-mobile-runners">
                                {Array.from(
                                  {
                                    length:
                                      8,
                                  },
                                  (
                                    _,
                                    index,
                                  ) =>
                                    index +
                                    1,
                                ).map(
                                  (
                                    boxNumber,
                                  ) => {
                                    const trap =
                                      WHEELING_TRAPS[
                                        boxNumber
                                      ];

                                    const entry =
                                      entryByBox.get(
                                        boxNumber,
                                      );

                                    const dog =
                                      entry
                                        ? firstRelation(
                                            entry.greyhound_dogs,
                                          )
                                        : null;

                                    return (
                                      <div
                                        key={
                                          entry
                                            ?.id ??
                                          boxNumber
                                        }
                                        className="gh-mobile-runner"
                                      >
                                        <div
                                          className="gh-trap"
                                          style={
                                            trapStyle(
                                              boxNumber,
                                            )
                                          }
                                        >
                                          {
                                            boxNumber
                                          }
                                        </div>

                                        <div className="gh-mobile-name">
                                          <strong>
                                            {entry
                                              ? dog?.display_name ??
                                                "Unknown Greyhound"
                                              : "Vacant"}
                                          </strong>

                                          <span>
                                            {trap
                                              ?.label ??
                                              ""}
                                            {entry?.trainer
                                              ? ` · ${entry.trainer}`
                                              : ""}
                                            {entry?.weight
                                              ? ` · ${entry.weight}`
                                              : ""}
                                          </span>
                                        </div>

                                        {entry ? (
                                          <span className="gh-odds">
                                            {entry.morning_line_odds ??
                                              "—"}
                                          </span>
                                        ) : (
                                          <span className="gh-status neutral">
                                            Vacant
                                          </span>
                                        )}
                                      </div>
                                    );
                                  },
                                )}
                              </div>
                            </details>
                          );
                        },
                      )}
                    </div>
                    </div>
                  </details>
                );
              },
            )}
          </div>
        )}
      </div>
    </main>
  );
}
