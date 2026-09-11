import type {
  CSSProperties,
} from "react";

import Link from "next/link";

type Props = {
  leagueId: string;
};

type ToolCard = {
  eyebrow: string;
  title: string;
  description: string;
  href: string;
  action: string;
  enabled: boolean;
  accent: "red" | "orange" | "neutral";
};

export default function GreyhoundCommissioner({
  leagueId,
}: Props) {
  const base =
    `/league/${leagueId}/greyhound`;

  const tools: ToolCard[] = [
    {
      eyebrow:
        "RACE OPERATIONS",

      title:
        "Race Cards",

      description:
        "Import race programs, review every race and runner, confirm official cards, and prepare the racing slate for wagering.",

      href:
        `${base}/commissioner/race-cards`,

      action:
        "OPEN RACE CARDS",

      enabled:
        true,

      accent:
        "red",
    },

    {
      eyebrow:
        "RACE OPERATIONS",

      title:
        "Scratches & Changes",

      description:
        "Review scratches, withdrawals, vacant boxes, and late race-card changes before wagering locks.",

      href:
        "#",

      action:
        "COMING NEXT",

      enabled:
        false,

      accent:
        "orange",
    },

    {
      eyebrow:
        "RACE OPERATIONS",

      title:
        "Results & Settlements",

      description:
        "Review official results, payouts, wager grading, and settlement status after each race becomes official.",

      href:
        "#",

      action:
        "COMING NEXT",

      enabled:
        false,

      accent:
        "orange",
    },

    {
      eyebrow:
        "LEAGUE SETUP",

      title:
        "Greyhound Settings",

      description:
        "Configure eligible races, wagering rules, locking behavior, contest scoring, and commissioner options.",

      href:
        "#",

      action:
        "COMING SOON",

      enabled:
        false,

      accent:
        "neutral",
    },

    {
      eyebrow:
        "LEAGUE MANAGEMENT",

      title:
        "Members & Entries",

      description:
        "Manage invitations, league participation, member access, and Greyhound contest entries.",

      href:
        "#",

      action:
        "COMING SOON",

      enabled:
        false,

      accent:
        "neutral",
    },

    {
      eyebrow:
        "LEAGUE LIFECYCLE",

      title:
        "Season Control",

      description:
        "Monitor the current Greyhound league lifecycle and manage future racing-season controls.",

      href:
        "#",

      action:
        "COMING SOON",

      enabled:
        false,

      accent:
        "neutral",
    },
  ];

  return (
    <main
      className="g365-greyhound-admin"
      style={
        styles.page
      }
    >
      <style>{`
        .g365-greyhound-admin,
        .g365-greyhound-admin * {
          box-sizing: border-box;
        }

        .g365-greyhound-admin .summary-grid {
          display: grid;
          grid-template-columns: repeat(4,minmax(0,1fr));
          gap: 10px;
        }

        .g365-greyhound-admin .tool-grid {
          display: grid;
          grid-template-columns: repeat(3,minmax(0,1fr));
          gap: 12px;
        }

        .g365-greyhound-admin .hero {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
        }

        .g365-greyhound-admin .tool-card {
          min-width: 0;
        }

        .g365-greyhound-admin .tool-card:hover {
          transform: translateY(-2px);
          border-color: rgba(239,101,24,.45) !important;
        }

        .g365-greyhound-admin .primary-action:hover {
          filter: brightness(1.1);
          transform: translateY(-1px);
        }

        @media (max-width: 1050px) {
          .g365-greyhound-admin .summary-grid {
            grid-template-columns: repeat(2,minmax(0,1fr));
          }

          .g365-greyhound-admin .tool-grid {
            grid-template-columns: repeat(2,minmax(0,1fr));
          }
        }

        @media (max-width: 700px) {
          .g365-greyhound-admin {
            padding: 12px 10px 70px !important;
          }

          .g365-greyhound-admin .hero {
            flex-direction: column;
            align-items: flex-start;
          }

          .g365-greyhound-admin .summary-grid,
          .g365-greyhound-admin .tool-grid {
            grid-template-columns: 1fr;
          }

          .g365-greyhound-admin .hero-badge {
            width: 100%;
          }

          .g365-greyhound-admin .hero-badge > div {
            flex: 1 1 0;
          }

          .g365-greyhound-admin .tool-action {
            width: 100%;
          }
        }
      `}</style>

      <section
        style={
          styles.shell
        }
      >
        {/* ==================================================
            HERO
        =================================================== */}

        <header
          className="hero"
          style={
            styles.hero
          }
        >
          <div
            style={
              styles.heroCopy
            }
          >
            <div
              style={
                styles.eyebrow
              }
            >
              G365 GREYHOUND RACING · COMMISSIONER
            </div>

            <h1
              style={
                styles.title
              }
            >
              League Administration
            </h1>

            <p
              style={
                styles.subtitle
              }
            >
              Manage race cards,
              race-day operations,
              wagering controls,
              results, settlements,
              and league administration
              from one central workspace.
            </p>
          </div>

          <div
            className="hero-badge"
            style={
              styles.heroBadge
            }
          >
            <div
              style={
                styles.heroBadgeItem
              }
            >
              <span
                style={
                  styles.heroBadgeLabel
                }
              >
                LEAGUE
              </span>

              <strong
                style={
                  styles.heroBadgeValue
                }
              >
                GREYHOUND
              </strong>
            </div>

            <div
              style={
                styles.heroBadgeItem
              }
            >
              <span
                style={
                  styles.heroBadgeLabel
                }
              >
                ACCESS
              </span>

              <strong
                style={
                  styles.heroBadgeValue
                }
              >
                COMMISSIONER
              </strong>
            </div>
          </div>
        </header>

        {/* ==================================================
            SUMMARY
        =================================================== */}

        <section
          className="summary-grid"
          style={
            styles.summaryGrid
          }
        >
          <SummaryCard
            label="LEAGUE TYPE"
            value="Greyhound Racing"
            detail="G365 racing contest"
            tone="red"
          />

          <SummaryCard
            label="RACE CARDS"
            value="Active"
            detail="Import & review available"
            tone="orange"
          />

          <SummaryCard
            label="RACE OPERATIONS"
            value="Building"
            detail="Scratches, results & settlement"
            tone="neutral"
          />

          <SummaryCard
            label="COMMISSIONER"
            value="Full Access"
            detail="Administrative controls"
            tone="neutral"
          />
        </section>

        {/* ==================================================
            SECTION HEADER
        =================================================== */}

        <section
          style={
            styles.sectionHeading
          }
        >
          <div>
            <div
              style={
                styles.sectionEyebrow
              }
            >
              COMMISSIONER TOOLS
            </div>

            <h2
              style={
                styles.sectionTitle
              }
            >
              Greyhound Operations
            </h2>

            <p
              style={
                styles.sectionDescription
              }
            >
              Race operations and
              league controls are
              separated into focused
              workspaces so the
              commissioner can get
              where they need quickly.
            </p>
          </div>
        </section>

        {/* ==================================================
            TOOL GRID
        =================================================== */}

        <section
          className="tool-grid"
        >
          {tools.map(
            (
              tool,
            ) => (
              <ToolCard
                key={
                  tool.title
                }
                tool={
                  tool
                }
              />
            ),
          )}
        </section>

        {/* ==================================================
            BOTTOM OPERATIONS STRIP
        =================================================== */}

        <section
          style={
            styles.operationsStrip
          }
        >
          <div>
            <div
              style={
                styles.sectionEyebrow
              }
            >
              CURRENT WORKFLOW
            </div>

            <h3
              style={
                styles.operationsTitle
              }
            >
              Race Cards are the active
              commissioner workspace
            </h3>

            <p
              style={
                styles.operationsText
              }
            >
              Import and review the
              official racing program
              first. Scratches,
              wagering locks, results,
              payouts, and settlement
              controls will build from
              the confirmed card.
            </p>
          </div>

          <Link
            href={
              `${base}/commissioner/race-cards`
            }
            className="primary-action"
            style={
              styles.operationsButton
            }
          >
            MANAGE RACE CARDS
          </Link>
        </section>
      </section>
    </main>
  );
}

function SummaryCard({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  tone:
    | "red"
    | "orange"
    | "neutral";
}) {
  const toneStyle =
    tone === "red"
      ? styles.summaryRed
      : tone === "orange"
        ? styles.summaryOrange
        : styles.summaryNeutral;

  return (
    <article
      style={{
        ...styles.summaryCard,
        ...toneStyle,
      }}
    >
      <span
        style={
          styles.summaryLabel
        }
      >
        {label}
      </span>

      <strong
        style={
          styles.summaryValue
        }
      >
        {value}
      </strong>

      <span
        style={
          styles.summaryDetail
        }
      >
        {detail}
      </span>
    </article>
  );
}

function ToolCard({
  tool,
}: {
  tool: ToolCard;
}) {
  const accent =
    tool.accent === "red"
      ? styles.toolAccentRed
      : tool.accent === "orange"
        ? styles.toolAccentOrange
        : styles.toolAccentNeutral;

  return (
    <article
      className="tool-card"
      style={{
        ...styles.toolCard,
        ...accent,
      }}
    >
      <div
        style={
          styles.toolTop
        }
      >
        <div
          style={
            styles.toolEyebrow
          }
        >
          {tool.eyebrow}
        </div>

        <div
          style={
            styles.toolIcon
          }
        >
          {tool.title ===
          "Race Cards"
            ? "RC"
            : tool.title ===
                "Scratches & Changes"
              ? "SC"
              : tool.title ===
                  "Results & Settlements"
                ? "RS"
                : tool.title ===
                    "Greyhound Settings"
                  ? "GS"
                  : tool.title ===
                      "Members & Entries"
                    ? "ME"
                    : "SE"}
        </div>
      </div>

      <h3
        style={
          styles.toolTitle
        }
      >
        {tool.title}
      </h3>

      <p
        style={
          styles.toolDescription
        }
      >
        {tool.description}
      </p>

      <div
        style={
          styles.toolFooter
        }
      >
        {tool.enabled ? (
          <Link
            href={
              tool.href
            }
            className="tool-action primary-action"
            style={
              styles.primaryButton
            }
          >
            {tool.action}
          </Link>
        ) : (
          <div
            className="tool-action"
            style={
              styles.disabledButton
            }
          >
            {tool.action}
          </div>
        )}
      </div>
    </article>
  );
}

const styles:
  Record<
    string,
    CSSProperties
  > = {
    page: {
      minHeight:
        "100vh",

      padding:
        "20px 20px 70px",

      background:
        "radial-gradient(circle at top left,rgba(132,18,13,.18),transparent 30%),linear-gradient(180deg,#07080b,#0c0c0f 45%,#07080a)",

      color:
        "#f7f7f7",
    },

    shell: {
      width:
        "min(1500px,100%)",

      margin:
        "0 auto",
    },

    hero: {
      padding:
        24,

      marginBottom:
        14,

      border:
        "1px solid rgba(255,91,29,.28)",

      borderRadius:
        18,

      background:
        "linear-gradient(135deg,rgba(126,16,13,.38),rgba(255,94,24,.09) 46%,#101113 100%)",

      boxShadow:
        "0 22px 60px rgba(0,0,0,.30)",
    },

    heroCopy: {
      maxWidth:
        800,
    },

    eyebrow: {
      color:
        "#ff6b22",

      fontSize:
        10,

      fontWeight:
        950,

      letterSpacing:
        ".15em",
    },

    title: {
      margin:
        "7px 0 8px",

      fontSize:
        "clamp(28px,4vw,42px)",

      lineHeight:
        1,

      fontWeight:
        950,

      letterSpacing:
        "-.035em",
    },

    subtitle: {
      maxWidth:
        760,

      margin:
        0,

      color:
        "#a2a7ae",

      fontSize:
        13,

      lineHeight:
        1.65,

      fontWeight:
        600,
    },

    heroBadge: {
      display:
        "flex",

      gap:
        8,

      flexWrap:
        "wrap",
    },

    heroBadgeItem: {
      minWidth:
        125,

      padding:
        "12px 14px",

      border:
        "1px solid #3a2a23",

      borderRadius:
        11,

      background:
        "rgba(12,12,14,.72)",
    },

    heroBadgeLabel: {
      display:
        "block",

      marginBottom:
        5,

      color:
        "#7e7772",

      fontSize:
        7,

      fontWeight:
        900,

      letterSpacing:
        ".12em",
    },

    heroBadgeValue: {
      color:
        "#f6f6f6",

      fontSize:
        11,

      fontWeight:
        950,
    },

    summaryGrid: {
      marginBottom:
        14,
    },

    summaryCard: {
      minHeight:
        120,

      padding:
        16,

      borderRadius:
        14,

      boxShadow:
        "0 12px 28px rgba(0,0,0,.18)",
    },

    summaryRed: {
      border:
        "1px solid rgba(185,42,24,.34)",

      background:
        "linear-gradient(145deg,rgba(100,18,15,.30),#111214 65%)",
    },

    summaryOrange: {
      border:
        "1px solid rgba(230,100,25,.34)",

      background:
        "linear-gradient(145deg,rgba(105,49,15,.28),#111214 65%)",
    },

    summaryNeutral: {
      border:
        "1px solid #292a2d",

      background:
        "linear-gradient(145deg,#151619,#101113)",
    },

    summaryLabel: {
      display:
        "block",

      color:
        "#e1662b",

      fontSize:
        8,

      fontWeight:
        950,

      letterSpacing:
        ".11em",
    },

    summaryValue: {
      display:
        "block",

      margin:
        "9px 0 5px",

      color:
        "#ffffff",

      fontSize:
        19,

      lineHeight:
        1.15,

      fontWeight:
        950,
    },

    summaryDetail: {
      display:
        "block",

      color:
        "#757b84",

      fontSize:
        9,

      lineHeight:
        1.5,

      fontWeight:
        600,
    },

    sectionHeading: {
      display:
        "flex",

      justifyContent:
        "space-between",

      alignItems:
        "flex-end",

      gap:
        16,

      marginBottom:
        12,

      padding:
        "8px 2px",
    },

    sectionEyebrow: {
      color:
        "#e45f24",

      fontSize:
        8,

      fontWeight:
        950,

      letterSpacing:
        ".12em",
    },

    sectionTitle: {
      margin:
        "5px 0 0",

      color:
        "#ffffff",

      fontSize:
        24,

      fontWeight:
        950,

      letterSpacing:
        "-.02em",
    },

    sectionDescription: {
      maxWidth:
        750,

      margin:
        "7px 0 0",

      color:
        "#777d85",

      fontSize:
        10,

      lineHeight:
        1.55,

      fontWeight:
        600,
    },

    toolCard: {
      display:
        "flex",

      flexDirection:
        "column",

      minHeight:
        255,

      padding:
        0,

      overflow:
        "hidden",

      borderRadius:
        15,

      background:
        "#111214",

      boxShadow:
        "0 16px 36px rgba(0,0,0,.22)",

      transition:
        "transform .16s ease,border-color .16s ease",
    },

    toolAccentRed: {
      border:
        "1px solid rgba(171,42,25,.38)",

      background:
        "linear-gradient(145deg,rgba(94,18,14,.28),#111214 48%,#101113)",
    },

    toolAccentOrange: {
      border:
        "1px solid rgba(179,82,25,.30)",

      background:
        "linear-gradient(145deg,rgba(90,43,16,.22),#111214 48%,#101113)",
    },

    toolAccentNeutral: {
      border:
        "1px solid #292a2d",

      background:
        "linear-gradient(145deg,#141518,#101113)",
    },

    toolTop: {
      display:
        "flex",

      justifyContent:
        "space-between",

      alignItems:
        "center",

      gap:
        12,

      padding:
        "17px 17px 0",
    },

    toolEyebrow: {
      color:
        "#df642b",

      fontSize:
        8,

      fontWeight:
        950,

      letterSpacing:
        ".11em",
    },

    toolIcon: {
      display:
        "flex",

      alignItems:
        "center",

      justifyContent:
        "center",

      width:
        37,

      height:
        37,

      flex:
        "0 0 auto",

      border:
        "1px solid #4a2f22",

      borderRadius:
        10,

      background:
        "linear-gradient(135deg,#3c160f,#1a1110)",

      color:
        "#ff7a31",

      fontSize:
        9,

      fontWeight:
        950,
    },

    toolTitle: {
      margin:
        "14px 17px 0",

      color:
        "#ffffff",

      fontSize:
        20,

      lineHeight:
        1.15,

      fontWeight:
        950,
    },

    toolDescription: {
      flex:
        1,

      margin:
        "9px 17px 16px",

      color:
        "#91969e",

      fontSize:
        11,

      lineHeight:
        1.6,

      fontWeight:
        600,
    },

    toolFooter: {
      padding:
        12,

      borderTop:
        "1px solid #242527",

      background:
        "rgba(6,6,7,.30)",
    },

    primaryButton: {
      display:
        "flex",

      minHeight:
        43,

      alignItems:
        "center",

      justifyContent:
        "center",

      padding:
        "10px 14px",

      border:
        "1px solid #dc5a22",

      borderRadius:
        9,

      background:
        "linear-gradient(135deg,#a42516,#ef6519)",

      color:
        "#ffffff",

      textDecoration:
        "none",

      fontSize:
        9,

      fontWeight:
        950,

      letterSpacing:
        ".04em",

      transition:
        "filter .16s ease,transform .16s ease",
    },

    disabledButton: {
      display:
        "flex",

      minHeight:
        43,

      alignItems:
        "center",

      justifyContent:
        "center",

      padding:
        "10px 14px",

      border:
        "1px solid #333539",

      borderRadius:
        9,

      background:
        "#18191b",

      color:
        "#666b72",

      fontSize:
        9,

      fontWeight:
        950,

      letterSpacing:
        ".04em",
    },

    operationsStrip: {
      display:
        "flex",

      justifyContent:
        "space-between",

      alignItems:
        "center",

      gap:
        20,

      flexWrap:
        "wrap",

      marginTop:
        14,

      padding:
        18,

      border:
        "1px solid #342922",

      borderRadius:
        14,

      background:
        "linear-gradient(90deg,rgba(82,23,14,.28),rgba(17,17,19,.96))",
    },

    operationsTitle: {
      margin:
        "5px 0",

      color:
        "#ffffff",

      fontSize:
        16,

      fontWeight:
        950,
    },

    operationsText: {
      maxWidth:
        800,

      margin:
        0,

      color:
        "#827b77",

      fontSize:
        10,

      lineHeight:
        1.55,
    },

    operationsButton: {
      display:
        "flex",

      minHeight:
        44,

      alignItems:
        "center",

      justifyContent:
        "center",

      padding:
        "11px 16px",

      border:
        "1px solid #dd5a22",

      borderRadius:
        9,

      background:
        "linear-gradient(135deg,#a42516,#ef6519)",

      color:
        "#ffffff",

      textDecoration:
        "none",

      fontSize:
        9,

      fontWeight:
        950,

      letterSpacing:
        ".04em",

      transition:
        "filter .16s ease,transform .16s ease",
    },
  };