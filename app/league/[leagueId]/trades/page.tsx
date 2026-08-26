"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  createBrowserClient,
} from "@supabase/ssr";

import {
  useParams,
} from "next/navigation";


type TradeSummary = {
  trade_offer_id: number;

  direction:
    | "sent"
    | "received";

  status:
    | "pending"
    | "accepted"
    | "rejected"
    | "cancelled"
    | "executed"
    | "vetoed"
    | "expired";

  season: number;

  week: number;

  proposing_fantasy_team_id:
    number;

  proposing_team_name:
    string;

  receiving_fantasy_team_id:
    number;

  receiving_team_name:
    string;

  message:
    string |
    null;

  created_at: string;

  accepted_at:
    string |
    null;

  rejected_at:
    string |
    null;

  cancelled_at:
    string |
    null;

  executed_at:
    string |
    null;

  proposing_player_count:
    number;

  receiving_player_count:
    number;
};


type TradePlayer = {
  playerId: number;

  fullName: string;

  position: string;

  team:
    string |
    null;

  headshotUrl:
    string |
    null;
};


type TradeDetail = {
  id: number;

  leagueId: string;

  season: number;

  week: number;

  status: string;

  message:
    string |
    null;

  createdAt: string;

  proposingTeam: {
    id: number;

    name: string;

    players:
      TradePlayer[];
  };

  receivingTeam: {
    id: number;

    name: string;

    players:
      TradePlayer[];
  };
};


type FantasyTeam = {
  id: number;

  team_name: string;

  owner_id:
    string |
    null;
};


type RosterPlayer = {
  fantasy_team_id: number;

  player_id: number;

  nfl_players:
    | {
        full_name: string;

        primary_position: string;

        team_abbreviation:
          string |
          null;

        headshot_url:
          string |
          null;
      }
    | {
        full_name: string;

        primary_position: string;

        team_abbreviation:
          string |
          null;

        headshot_url:
          string |
          null;
      }[]
    | null;
};


type ComposerPlayer = {
  playerId: number;

  fullName: string;

  position: string;

  team:
    string |
    null;

  headshotUrl:
    string |
    null;
};


const supabase =
  createBrowserClient(
    process.env
      .NEXT_PUBLIC_SUPABASE_URL!,
    process.env
      .NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
      process.env
        .NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );


export default function TraditionalTradesPage() {
  const params =
    useParams<{
      leagueId: string;
    }>();


  const leagueId =
    params.leagueId;


  const [
    activeTab,
    setActiveTab,
  ] =
    useState<
      | "incoming"
      | "sent"
      | "history"
    >(
      "incoming"
    );


  const [
    loading,
    setLoading,
  ] =
    useState(
      true
    );


  const [
    actionLoading,
    setActionLoading,
  ] =
    useState<
      number |
      null
    >(
      null
    );


  const [
    error,
    setError,
  ] =
    useState<
      string |
      null
    >(
      null
    );


  const [
    season,
    setSeason,
  ] =
    useState(
      new Date()
        .getFullYear()
    );


  const [
    trades,
    setTrades,
  ] =
    useState<
      TradeSummary[]
    >(
      []
    );


  const [
    tradeDetails,
    setTradeDetails,
  ] =
    useState<
      Record<
        number,
        TradeDetail
      >
    >(
      {}
    );


  const [
    teams,
    setTeams,
  ] =
    useState<
      FantasyTeam[]
    >(
      []
    );


  const [
    myTeamId,
    setMyTeamId,
  ] =
    useState<
      number |
      null
    >(
      null
    );


  const [
    composerOpen,
    setComposerOpen,
  ] =
    useState(
      false
    );


  const [
    selectedOpponentId,
    setSelectedOpponentId,
  ] =
    useState<
      number |
      null
    >(
      null
    );


  const [
    myRoster,
    setMyRoster,
  ] =
    useState<
      ComposerPlayer[]
    >(
      []
    );


  const [
    opponentRoster,
    setOpponentRoster,
  ] =
    useState<
      ComposerPlayer[]
    >(
      []
    );


  const [
    mySelected,
    setMySelected,
  ] =
    useState<
      number[]
    >(
      []
    );


  const [
    opponentSelected,
    setOpponentSelected,
  ] =
    useState<
      number[]
    >(
      []
    );


  const [
    tradeMessage,
    setTradeMessage,
  ] =
    useState(
      ""
    );


  const [
    submitLoading,
    setSubmitLoading,
  ] =
    useState(
      false
    );


  const loadTradeDetails =
    useCallback(
      async (
        summaries:
          TradeSummary[]
      ) => {
        const next:
          Record<
            number,
            TradeDetail
          > =
            {};


        for (
          const trade
          of summaries
        ) {
          const {
            data,
            error:
              detailError,
          } =
            await supabase.rpc(
              "get_traditional_trade_offer_detail",
              {
                p_trade_offer_id:
                  trade.trade_offer_id,
              }
            );


          if (
            !detailError &&
            data
          ) {
            next[
              trade.trade_offer_id
            ] =
              data as TradeDetail;
          }
        }


        setTradeDetails(
          next
        );
      },
      []
    );


  const loadData =
    useCallback(
      async () => {
        setLoading(
          true
        );

        setError(
          null
        );


        const {
          data:
            sessionData,
        } =
          await supabase.auth
            .getUser();


        const userId =
          sessionData.user
            ?.id ??
          null;


        if (
          !userId
        ) {
          setError(
            "You must be signed in."
          );

          setLoading(
            false
          );

          return;
        }


        const {
          data:
            leagueData,

          error:
            leagueError,
        } =
          await supabase
            .from(
              "leagues"
            )
            .select(
              "season"
            )
            .eq(
              "id",
              leagueId
            )
            .single();


        if (
          leagueError
        ) {
          setError(
            leagueError.message
          );

          setLoading(
            false
          );

          return;
        }


        const currentSeason =
          Number(
            leagueData.season
          );


        setSeason(
          currentSeason
        );


        const [
          teamResult,
          myTeamResult,
          tradeResult,
        ] =
          await Promise.all([
            supabase
              .from(
                "fantasy_teams"
              )
              .select(
                `
                  id,
                  team_name,
                  owner_id
                `
              )
              .eq(
                "league_id",
                leagueId
              )
              .eq(
                "active",
                true
              )
              .not(
                "owner_id",
                "is",
                null
              )
              .order(
                "team_name"
              ),

            supabase
              .from(
                "fantasy_teams"
              )
              .select(
                "id"
              )
              .eq(
                "league_id",
                leagueId
              )
              .eq(
                "owner_id",
                userId
              )
              .eq(
                "active",
                true
              )
              .maybeSingle(),

            supabase.rpc(
              "get_my_traditional_trades",
              {
                p_league_id:
                  leagueId,

                p_season:
                  currentSeason,
              }
            ),
          ]);


        if (
          teamResult.error
        ) {
          setError(
            teamResult
              .error
              .message
          );

          setLoading(
            false
          );

          return;
        }


        if (
          myTeamResult.error
        ) {
          setError(
            myTeamResult
              .error
              .message
          );

          setLoading(
            false
          );

          return;
        }


        if (
          tradeResult.error
        ) {
          setError(
            tradeResult
              .error
              .message
          );

          setLoading(
            false
          );

          return;
        }


        const loadedTeams =
          (
            teamResult.data ??
            []
          ) as FantasyTeam[];


        const summaries =
          (
            tradeResult.data ??
            []
          ) as TradeSummary[];


        setTeams(
          loadedTeams
        );

        setMyTeamId(
          myTeamResult.data
            ?.id ??
            null
        );

        setTrades(
          summaries
        );


        await loadTradeDetails(
          summaries
        );


        setLoading(
          false
        );
      },
      [
        leagueId,
        loadTradeDetails,
      ]
    );


  useEffect(
    () => {
      void loadData();
    },
    [
      loadData,
    ]
  );


  const incomingTrades =
    useMemo(
      () =>
        trades.filter(
          (
            trade
          ) =>
            trade.direction ===
              "received" &&
            trade.status ===
              "pending"
        ),
      [
        trades,
      ]
    );


  const sentTrades =
    useMemo(
      () =>
        trades.filter(
          (
            trade
          ) =>
            trade.direction ===
              "sent" &&
            trade.status ===
              "pending"
        ),
      [
        trades,
      ]
    );


  const historyTrades =
    useMemo(
      () =>
        trades.filter(
          (
            trade
          ) =>
            trade.status !==
            "pending"
        ),
      [
        trades,
      ]
    );


  const visibleTrades =
    activeTab ===
    "incoming"
      ? incomingTrades
      : activeTab ===
          "sent"
        ? sentTrades
        : historyTrades;


  const tradePartners =
    useMemo(
      () =>
        teams.filter(
          (
            team
          ) =>
            team.id !==
              myTeamId &&
            Boolean(
              team.owner_id
            )
        ),
      [
        teams,
        myTeamId,
      ]
    );


  async function loadRoster(
    fantasyTeamId: number
  ) {
    const {
      data,
      error:
        rosterError,
    } =
      await supabase
        .from(
          "team_rosters"
        )
        .select(`
          fantasy_team_id,
          player_id,
          nfl_players (
            full_name,
            primary_position,
            team_abbreviation,
            headshot_url
          )
        `)
        .eq(
          "league_id",
          leagueId
        )
        .eq(
          "fantasy_team_id",
          fantasyTeamId
        );


    if (
      rosterError
    ) {
      throw new Error(
        rosterError.message
      );
    }


    return (
      (
        data ??
        []
      ) as RosterPlayer[]
    )
      .map(
        (
          row
        ) => {
          const joined =
            Array.isArray(
              row.nfl_players
            )
              ? row
                  .nfl_players[
                    0
                  ]
              : row
                  .nfl_players;


          return {
            playerId:
              row.player_id,

            fullName:
              joined
                ?.full_name ??
              "Unknown Player",

            position:
              joined
                ?.primary_position ??
              "—",

            team:
              joined
                ?.team_abbreviation ??
              null,

            headshotUrl:
              joined
                ?.headshot_url ??
              null,
          };
        }
      )
      .sort(
        (
          a,
          b
        ) => {
          const order =
            [
              "QB",
              "RB",
              "WR",
              "TE",
              "K",
              "DST",
            ];


          const aIndex =
            order.indexOf(
              a.position
            );


          const bIndex =
            order.indexOf(
              b.position
            );


          if (
            aIndex !==
            bIndex
          ) {
            return (
              aIndex -
              bIndex
            );
          }


          return a.fullName.localeCompare(
            b.fullName
          );
        }
      );
  }


  async function openComposer() {
    if (
      !myTeamId
    ) {
      setError(
        "Your fantasy team could not be found."
      );

      return;
    }


    if (
      tradePartners.length ===
      0
    ) {
      setError(
        "There are no other owned teams available to trade with yet."
      );

      return;
    }


    try {
      setError(
        null
      );


      const mine =
        await loadRoster(
          myTeamId
        );


      setMyRoster(
        mine
      );

      setOpponentRoster(
        []
      );

      setSelectedOpponentId(
        null
      );

      setMySelected(
        []
      );

      setOpponentSelected(
        []
      );

      setTradeMessage(
        ""
      );

      setComposerOpen(
        true
      );
    } catch (
      cause
    ) {
      setError(
        cause instanceof
          Error
          ? cause.message
          : "Could not load roster."
      );
    }
  }


  async function chooseOpponent(
    fantasyTeamId: number
  ) {
    try {
      setSelectedOpponentId(
        fantasyTeamId
      );

      setOpponentSelected(
        []
      );


      const roster =
        await loadRoster(
          fantasyTeamId
        );


      setOpponentRoster(
        roster
      );
    } catch (
      cause
    ) {
      setError(
        cause instanceof
          Error
          ? cause.message
          : "Could not load opponent roster."
      );
    }
  }


  function togglePlayer(
    playerId: number,
    side:
      | "mine"
      | "theirs"
  ) {
    if (
      side ===
      "mine"
    ) {
      setMySelected(
        (
          current
        ) =>
          current.includes(
            playerId
          )
            ? current.filter(
                (
                  id
                ) =>
                  id !==
                  playerId
              )
            : [
                ...current,
                playerId,
              ]
      );

      return;
    }


    setOpponentSelected(
      (
        current
      ) =>
        current.includes(
          playerId
        )
          ? current.filter(
              (
                id
              ) =>
                id !==
                playerId
            )
          : [
              ...current,
              playerId,
            ]
    );
  }


  async function submitTrade() {
    if (
      !myTeamId ||
      !selectedOpponentId
    ) {
      setError(
        "Choose a team to trade with."
      );

      return;
    }


    const selectedOpponent =
      teams.find(
        (
          team
        ) =>
          team.id ===
          selectedOpponentId
      );


    if (
      !selectedOpponent ||
      !selectedOpponent.owner_id
    ) {
      setError(
        "Trades can only be sent to teams that currently have an owner."
      );

      return;
    }


    if (
      mySelected.length ===
        0 ||
      opponentSelected.length ===
        0
    ) {
      setError(
        "Select at least one player from each team."
      );

      return;
    }


    setSubmitLoading(
      true
    );

    setError(
      null
    );


    try {
      // =====================================================
      // LOAD CURRENT LEAGUE WEEK
      // =====================================================

      const {
        data:
          stateData,

        error:
          stateError,
      } =
        await supabase
          .from(
            "traditional_season_state"
          )
          .select(
            "active_week"
          )
          .eq(
            "league_id",
            leagueId
          )
          .eq(
            "season",
            season
          )
          .maybeSingle();


      if (
        stateError
      ) {
        throw new Error(
          stateError.message
        );
      }


      if (
        !stateData
      ) {
        throw new Error(
          "Traditional season state could not be found."
        );
      }


      const activeWeek =
        Number(
          stateData
            .active_week
        );


      // =====================================================
      // SUBMIT ENTIRE TRADE ATOMICALLY
      // =====================================================

      const {
        data:
          tradeData,

        error:
          tradeError,
      } =
        await supabase.rpc(
          "submit_traditional_trade_offer",
          {
            p_league_id:
              leagueId,

            p_season:
              season,

            p_week:
              activeWeek,

            p_proposing_fantasy_team_id:
              myTeamId,

            p_receiving_fantasy_team_id:
              selectedOpponentId,

            p_proposing_player_ids:
              mySelected,

            p_receiving_player_ids:
              opponentSelected,

            p_message:
              tradeMessage.trim() ||
              null,
          }
        );


      if (
        tradeError
      ) {
        throw new Error(
          tradeError.message
        );
      }


      if (
        !tradeData?.success
      ) {
        throw new Error(
          "The trade offer could not be created."
        );
      }


      // =====================================================
      // RESET COMPOSER
      // =====================================================

      setComposerOpen(
        false
      );

      setSelectedOpponentId(
        null
      );

      setMySelected(
        []
      );

      setOpponentSelected(
        []
      );

      setTradeMessage(
        ""
      );


      setActiveTab(
        "sent"
      );


      await loadData();

    } catch (
      cause
    ) {
      setError(
        cause instanceof
          Error
          ? cause.message
          : "Could not submit trade."
      );

    } finally {
      setSubmitLoading(
        false
      );
    }
  }


  async function runTradeAction(
    tradeOfferId: number,
    action:
      | "accept"
      | "reject"
      | "cancel"
  ) {
    setActionLoading(
      tradeOfferId
    );

    setError(
      null
    );


    try {
      const functionName =
        action ===
        "accept"
          ? "accept_traditional_trade_offer"
          : action ===
              "reject"
            ? "reject_traditional_trade_offer"
            : "cancel_traditional_trade_offer";


      const {
        error:
          actionError,
      } =
        await supabase.rpc(
          functionName,
          {
            p_trade_offer_id:
              tradeOfferId,
          }
        );


      if (
        actionError
      ) {
        throw new Error(
          actionError.message
        );
      }


      await loadData();
    } catch (
      cause
    ) {
      setError(
        cause instanceof
          Error
          ? cause.message
          : "Trade action failed."
      );
    } finally {
      setActionLoading(
        null
      );
    }
  }


  return (
    <main
      style={
        styles.page
      }
    >
      <div
        style={
          styles.shell
        }
      >
        <header
          style={
            styles.header
          }
        >
          <div>
            <p
              style={
                styles.eyebrow
              }
            >
              TRADITIONAL
            </p>

            <h1
              style={
                styles.title
              }
            >
              Trades
            </h1>

            <p
              style={
                styles.subtitle
              }
            >
              Build offers, review incoming deals, and track trade history.
            </p>
          </div>


          <button
            type="button"
            style={{
              ...styles.primaryButton,

              ...(tradePartners.length ===
              0
                ? styles.disabledButton
                : {}),
            }}
            disabled={
              tradePartners.length ===
              0
            }
            title={
              tradePartners.length ===
              0
                ? "Another team must have an owner before you can send a trade."
                : "Create a new trade offer"
            }
            onClick={
              () => {
                void openComposer();
              }
            }
          >
            {tradePartners.length ===
            0
              ? "NO TRADE PARTNERS"
              : "+ MAKE TRADE"}
          </button>
        </header>


        {error ? (
          <div
            style={
              styles.errorBox
            }
          >
            {error}
          </div>
        ) : null}


        <section
          style={
            styles.summaryGrid
          }
        >
          <SummaryCard
            label="INCOMING"
            value={
              incomingTrades.length
            }
          />

          <SummaryCard
            label="SENT"
            value={
              sentTrades.length
            }
          />

          <SummaryCard
            label="HISTORY"
            value={
              historyTrades.length
            }
          />
        </section>


        <section
          style={
            styles.contentCard
          }
        >
          <div
            style={
              styles.tabs
            }
          >
            <TabButton
              active={
                activeTab ===
                "incoming"
              }
              label="Incoming"
              count={
                incomingTrades.length
              }
              onClick={
                () =>
                  setActiveTab(
                    "incoming"
                  )
              }
            />

            <TabButton
              active={
                activeTab ===
                "sent"
              }
              label="Sent"
              count={
                sentTrades.length
              }
              onClick={
                () =>
                  setActiveTab(
                    "sent"
                  )
              }
            />

            <TabButton
              active={
                activeTab ===
                "history"
              }
              label="History"
              count={
                historyTrades.length
              }
              onClick={
                () =>
                  setActiveTab(
                    "history"
                  )
              }
            />
          </div>


          {loading ? (
            <div
              style={
                styles.emptyState
              }
            >
              Loading trades...
            </div>
          ) : visibleTrades.length ===
          0 ? (
            <div
              style={
                styles.emptyState
              }
            >
              <strong
                style={
                  styles.emptyTitle
                }
              >
                No trades here yet
              </strong>

              <span
                style={
                  styles.emptyText
                }
              >
                {activeTab ===
                "incoming"
                  ? "Incoming offers will appear here."
                  : activeTab ===
                      "sent"
                    ? "Your pending offers will appear here."
                    : "Completed, rejected, cancelled, and expired trades will appear here."}
              </span>
            </div>
          ) : (
            <div
              style={
                styles.tradeList
              }
            >
              {visibleTrades.map(
                (
                  trade
                ) => (
                  <TradeCard
                    key={
                      trade.trade_offer_id
                    }
                    trade={
                      trade
                    }
                    detail={
                      tradeDetails[
                        trade.trade_offer_id
                      ]
                    }
                    loading={
                      actionLoading ===
                      trade.trade_offer_id
                    }
                    onAccept={
                      () => {
                        void runTradeAction(
                          trade.trade_offer_id,
                          "accept"
                        );
                      }
                    }
                    onReject={
                      () => {
                        void runTradeAction(
                          trade.trade_offer_id,
                          "reject"
                        );
                      }
                    }
                    onCancel={
                      () => {
                        void runTradeAction(
                          trade.trade_offer_id,
                          "cancel"
                        );
                      }
                    }
                  />
                )
              )}
            </div>
          )}
        </section>
      </div>


      {composerOpen ? (
        <TradeComposer
          teams={
            tradePartners
          }
          myRoster={
            myRoster
          }
          opponentRoster={
            opponentRoster
          }
          selectedOpponentId={
            selectedOpponentId
          }
          mySelected={
            mySelected
          }
          opponentSelected={
            opponentSelected
          }
          message={
            tradeMessage
          }
          submitting={
            submitLoading
          }
          onClose={
            () =>
              setComposerOpen(
                false
              )
          }
          onChooseOpponent={
            (
              teamId
            ) => {
              void chooseOpponent(
                teamId
              );
            }
          }
          onToggleMine={
            (
              playerId
            ) =>
              togglePlayer(
                playerId,
                "mine"
              )
          }
          onToggleTheirs={
            (
              playerId
            ) =>
              togglePlayer(
                playerId,
                "theirs"
              )
          }
          onMessageChange={
            setTradeMessage
          }
          onSubmit={
            () => {
              void submitTrade();
            }
          }
        />
      ) : null}
    </main>
  );
}


function SummaryCard({
  label,
  value,
}: {
  label: string;

  value: number;
}) {
  return (
    <div
      style={
        styles.summaryCard
      }
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
    </div>
  );
}


function TabButton({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;

  label: string;

  count: number;

  onClick:
    () => void;
}) {
  return (
    <button
      type="button"
      onClick={
        onClick
      }
      style={{
        ...styles.tabButton,

        ...(active
          ? styles.tabButtonActive
          : {}),
      }}
    >
      {label}

      <span
        style={{
          ...styles.tabCount,

          ...(active
            ? styles.tabCountActive
            : {}),
        }}
      >
        {count}
      </span>
    </button>
  );
}


function TradeCard({
  trade,
  detail,
  loading,
  onAccept,
  onReject,
  onCancel,
}: {
  trade:
    TradeSummary;

  detail:
    TradeDetail |
    undefined;

  loading:
    boolean;

  onAccept:
    () => void;

  onReject:
    () => void;

  onCancel:
    () => void;
}) {
  return (
    <article
      style={
        styles.tradeCard
      }
    >
      <div
        style={
          styles.tradeHeader
        }
      >
        <div>
          <div
            style={
              styles.tradeTeams
            }
          >
            <strong>
              {trade.proposing_team_name}
            </strong>

            <span
              style={
                styles.swapArrow
              }
            >
              ⇄
            </span>

            <strong>
              {trade.receiving_team_name}
            </strong>
          </div>

          <span
            style={
              styles.tradeMeta
            }
          >
            Week {trade.week}
            {" • "}
            {new Date(
              trade.created_at
            ).toLocaleDateString()}
          </span>
        </div>


        <StatusBadge
          status={
            trade.status
          }
        />
      </div>


      {detail ? (
        <div
          style={
            styles.packageGrid
          }
        >
          <TradePackage
            title={`${detail.proposingTeam.name} gives`}
            players={
              detail
                .proposingTeam
                .players
            }
          />

          <div
            style={
              styles.packageSwap
            }
          >
            ⇄
          </div>

          <TradePackage
            title={`${detail.receivingTeam.name} gives`}
            players={
              detail
                .receivingTeam
                .players
            }
          />
        </div>
      ) : (
        <div
          style={
            styles.tradeCounts
          }
        >
          {trade.proposing_player_count}
          {" "}
          player(s)
          {" "}
          ⇄
          {" "}
          {trade.receiving_player_count}
          {" "}
          player(s)
        </div>
      )}


      {trade.message ? (
        <div
          style={
            styles.messageBox
          }
        >
          “{trade.message}”
        </div>
      ) : null}


      {trade.status ===
        "pending" ? (
        <div
          style={
            styles.tradeActions
          }
        >
          {trade.direction ===
          "received" ? (
            <>
              <button
                type="button"
                disabled={
                  loading
                }
                onClick={
                  onAccept
                }
                style={
                  styles.acceptButton
                }
              >
                {loading
                  ? "WORKING..."
                  : "ACCEPT"}
              </button>

              <button
                type="button"
                disabled={
                  loading
                }
                onClick={
                  onReject
                }
                style={
                  styles.secondaryButton
                }
              >
                REJECT
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={
                loading
              }
              onClick={
                onCancel
              }
              style={
                styles.secondaryButton
              }
            >
              {loading
                ? "WORKING..."
                : "CANCEL OFFER"}
            </button>
          )}
        </div>
      ) : null}
    </article>
  );
}


function TradePackage({
  title,
  players,
}: {
  title: string;

  players:
    TradePlayer[];
}) {
  return (
    <div
      style={
        styles.packageCard
      }
    >
      <span
        style={
          styles.packageTitle
        }
      >
        {title}
      </span>

      <div
        style={
          styles.packagePlayers
        }
      >
        {players.length >
        0 ? (
          players.map(
            (
              player
            ) => (
              <div
                key={
                  player.playerId
                }
                style={
                  styles.packagePlayer
                }
              >
                <PlayerAvatar
                  player={
                    player
                  }
                />

                <div
                  style={
                    styles.playerText
                  }
                >
                  <strong
                    style={
                      styles.playerName
                    }
                  >
                    {player.fullName}
                  </strong>

                  <span
                    style={
                      styles.playerMeta
                    }
                  >
                    {player.position}
                    {player.team
                      ? ` • ${player.team}`
                      : ""}
                  </span>
                </div>
              </div>
            )
          )
        ) : (
          <span
            style={
              styles.noPlayers
            }
          >
            No players
          </span>
        )}
      </div>
    </div>
  );
}


function StatusBadge({
  status,
}: {
  status: string;
}) {
  const badgeStyle =
    status ===
    "executed"
      ? styles.statusExecuted
      : status ===
          "pending"
        ? styles.statusPending
        : status ===
            "rejected" ||
            status ===
              "vetoed"
          ? styles.statusRejected
          : styles.statusNeutral;


  return (
    <span
      style={{
        ...styles.statusBadge,
        ...badgeStyle,
      }}
    >
      {status.toUpperCase()}
    </span>
  );
}


function TradeComposer({
  teams,
  myRoster,
  opponentRoster,
  selectedOpponentId,
  mySelected,
  opponentSelected,
  message,
  submitting,
  onClose,
  onChooseOpponent,
  onToggleMine,
  onToggleTheirs,
  onMessageChange,
  onSubmit,
}: {
  teams:
    FantasyTeam[];

  myRoster:
    ComposerPlayer[];

  opponentRoster:
    ComposerPlayer[];

  selectedOpponentId:
    number |
    null;

  mySelected:
    number[];

  opponentSelected:
    number[];

  message: string;

  submitting:
    boolean;

  onClose:
    () => void;

  onChooseOpponent:
    (
      teamId: number
    ) => void;

  onToggleMine:
    (
      playerId: number
    ) => void;

  onToggleTheirs:
    (
      playerId: number
    ) => void;

  onMessageChange:
    (
      value: string
    ) => void;

  onSubmit:
    () => void;
}) {
  return (
    <div
      style={
        styles.modalBackdrop
      }
    >
      <div
        style={
          styles.modal
        }
      >
        <div
          style={
            styles.modalHeader
          }
        >
          <div>
            <span
              style={
                styles.eyebrow
              }
            >
              NEW OFFER
            </span>

            <h2
              style={
                styles.modalTitle
              }
            >
              Build Trade
            </h2>
          </div>

          <button
            type="button"
            onClick={
              onClose
            }
            style={
              styles.closeButton
            }
          >
            ×
          </button>
        </div>


        <div
          style={
            styles.composerTop
          }
        >
          <label
            style={
              styles.fieldLabel
            }
          >
            TRADE WITH
          </label>

          <select
            value={
              selectedOpponentId ??
              ""
            }
            onChange={
              (
                event
              ) => {
                const value =
                  Number(
                    event.target
                      .value
                  );


                if (
                  value
                ) {
                  onChooseOpponent(
                    value
                  );
                }
              }
            }
            style={
              styles.select
            }
          >
            <option
              value=""
            >
              Choose a team
            </option>

            {teams.map(
              (
                team
              ) => (
                <option
                  key={
                    team.id
                  }
                  value={
                    team.id
                  }
                >
                  {team.team_name}
                </option>
              )
            )}
          </select>
        </div>


        <div
          style={
            styles.composerGrid
          }
        >
          <RosterSelector
            title="YOU GIVE"
            players={
              myRoster
            }
            selected={
              mySelected
            }
            onToggle={
              onToggleMine
            }
          />

          <RosterSelector
            title="YOU RECEIVE"
            players={
              opponentRoster
            }
            selected={
              opponentSelected
            }
            onToggle={
              onToggleTheirs
            }
            emptyText={
              selectedOpponentId
                ? "No rostered players."
                : "Choose a team first."
            }
          />
        </div>


        <div
          style={
            styles.messageField
          }
        >
          <label
            style={
              styles.fieldLabel
            }
          >
            MESSAGE
          </label>

          <textarea
            value={
              message
            }
            onChange={
              (
                event
              ) =>
                onMessageChange(
                  event.target
                    .value
                )
            }
            placeholder="Optional message..."
            style={
              styles.textarea
            }
          />
        </div>


        <div
          style={
            styles.modalFooter
          }
        >
          <div
            style={
              styles.tradeSummaryText
            }
          >
            {mySelected.length}
            {" "}
            outgoing
            {" • "}
            {opponentSelected.length}
            {" "}
            incoming
          </div>

          <div
            style={
              styles.modalActions
            }
          >
            <button
              type="button"
              onClick={
                onClose
              }
              style={
                styles.secondaryButton
              }
            >
              CANCEL
            </button>

            <button
              type="button"
              onClick={
                onSubmit
              }
              disabled={
                submitting
              }
              style={
                styles.primaryButton
              }
            >
              {submitting
                ? "SENDING..."
                : "SEND OFFER"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


function RosterSelector({
  title,
  players,
  selected,
  onToggle,
  emptyText = "No rostered players.",
}: {
  title: string;

  players:
    ComposerPlayer[];

  selected:
    number[];

  onToggle:
    (
      playerId: number
    ) => void;

  emptyText?: string;
}) {
  return (
    <section
      style={
        styles.rosterPanel
      }
    >
      <div
        style={
          styles.rosterHeader
        }
      >
        <strong>
          {title}
        </strong>

        <span
          style={
            styles.selectedCount
          }
        >
          {selected.length}
          {" "}
          SELECTED
        </span>
      </div>

      <div
        style={
          styles.rosterList
        }
      >
        {players.length >
        0 ? (
          players.map(
            (
              player
            ) => {
              const active =
                selected.includes(
                  player.playerId
                );


              return (
                <button
                  type="button"
                  key={
                    player.playerId
                  }
                  onClick={
                    () =>
                      onToggle(
                        player.playerId
                      )
                  }
                  style={{
                    ...styles.rosterPlayerButton,

                    ...(active
                      ? styles.rosterPlayerButtonActive
                      : {}),
                  }}
                >
                  <PlayerAvatar
                    player={
                      player
                    }
                  />

                  <div
                    style={
                      styles.playerText
                    }
                  >
                    <strong
                      style={
                        styles.playerName
                      }
                    >
                      {player.fullName}
                    </strong>

                    <span
                      style={
                        styles.playerMeta
                      }
                    >
                      {player.position}
                      {player.team
                        ? ` • ${player.team}`
                        : ""}
                    </span>
                  </div>

                  <span
                    style={{
                      ...styles.selectIndicator,

                      ...(active
                        ? styles.selectIndicatorActive
                        : {}),
                    }}
                  >
                    {active
                      ? "✓"
                      : "+"}
                  </span>
                </button>
              );
            }
          )
        ) : (
          <div
            style={
              styles.rosterEmpty
            }
          >
            {emptyText}
          </div>
        )}
      </div>
    </section>
  );
}


function PlayerAvatar({
  player,
}: {
  player:
    Pick<
      TradePlayer,
      | "fullName"
      | "headshotUrl"
    >;
}) {
  if (
    player.headshotUrl
  ) {
    return (
      <img
        src={
          player.headshotUrl
        }
        alt=""
        style={
          styles.avatar
        }
      />
    );
  }


  return (
    <div
      style={
        styles.avatarFallback
      }
    >
      {player.fullName
        .slice(
          0,
          1
        )
        .toUpperCase()}
    </div>
  );
}


const styles = {
  page: {
    minHeight:
      "calc(100vh - 90px)",

    padding:
      "18px 16px 36px",

    background:
      "#0c0d0f",

    color:
      "#fff",
  },


  shell: {
    width:
      "min(1380px,100%)",

    margin:
      "0 auto",

    display:
      "grid",

    gap:
      "14px",
  },


  header: {
    display:
      "flex",

    justifyContent:
      "space-between",

    alignItems:
      "flex-end",

    gap:
      "16px",

    flexWrap:
      "wrap" as const,
  },


  eyebrow: {
    margin:
      0,

    color:
      "#ff7f1e",

    fontSize:
      "12px",

    fontWeight:
      950,

    letterSpacing:
      ".14em",
  },


  title: {
    margin:
      "4px 0 0",

    fontSize:
      "32px",

    lineHeight:
      1,
  },


  subtitle: {
    margin:
      "6px 0 0",

    color:
      "#747b84",

    fontSize:
      "14px",
  },


  primaryButton: {
    border:
      0,

    borderRadius:
      "6px",

    padding:
      "9px 13px",

    background:
      "linear-gradient(135deg,#b61d18,#ff6512)",

    color:
      "#fff",

    fontSize:
      "12px",

    fontWeight:
      950,

    cursor:
      "pointer",
  },


  disabledButton: {
    opacity:
      0.48,

    cursor:
      "not-allowed",
  },


  secondaryButton: {
    border:
      "1px solid rgba(255,255,255,.1)",

    borderRadius:
      "6px",

    padding:
      "8px 11px",

    background:
      "#181a1d",

    color:
      "#cfd3d8",

    fontSize:
      "12px",

    fontWeight:
      900,

    cursor:
      "pointer",
  },


  acceptButton: {
    border:
      0,

    borderRadius:
      "6px",

    padding:
      "8px 12px",

    background:
      "linear-gradient(135deg,#0f8f4e,#33d17a)",

    color:
      "#fff",

    fontSize:
      "12px",

    fontWeight:
      950,

    cursor:
      "pointer",
  },


  errorBox: {
    padding:
      "10px 12px",

    border:
      "1px solid rgba(255,85,70,.22)",

    borderRadius:
      "6px",

    background:
      "rgba(255,70,55,.05)",

    color:
      "#ff756c",

    fontSize:
      "12px",
  },


  summaryGrid: {
    display:
      "grid",

    gridTemplateColumns:
      "repeat(3,minmax(0,1fr))",

    gap:
      "8px",
  },


  summaryCard: {
    padding:
      "11px",

    border:
      "1px solid rgba(255,255,255,.07)",

    borderRadius:
      "7px",

    background:
      "#111315",

    display:
      "grid",

    gap:
      "2px",
  },


  summaryLabel: {
    color:
      "#737a84",

    fontSize:
      "11px",

    fontWeight:
      900,
  },


  summaryValue: {
    color:
      "#ff8a27",

    fontSize:
      "20px",
  },


  contentCard: {
    overflow:
      "hidden",

    border:
      "1px solid rgba(255,255,255,.08)",

    borderRadius:
      "8px",

    background:
      "linear-gradient(180deg,#151719,#101113)",
  },


  tabs: {
    display:
      "flex",

    gap:
      "4px",

    padding:
      "8px",

    borderBottom:
      "1px solid rgba(255,255,255,.06)",
  },


  tabButton: {
    display:
      "flex",

    alignItems:
      "center",

    gap:
      "6px",

    border:
      0,

    borderRadius:
      "5px",

    padding:
      "7px 9px",

    background:
      "transparent",

    color:
      "#7a818a",

    fontSize:
      "12px",

    fontWeight:
      900,

    cursor:
      "pointer",
  },


  tabButtonActive: {
    background:
      "rgba(255,110,20,.08)",

    color:
      "#fff",
  },


  tabCount: {
    minWidth:
      "17px",

    padding:
      "2px 4px",

    borderRadius:
      "999px",

    background:
      "#25282c",

    color:
      "#8b929b",

    fontSize:
      "11px",
  },


  tabCountActive: {
    background:
      "rgba(255,120,25,.15)",

    color:
      "#ff8b2b",
  },


  tradeList: {
    display:
      "grid",

    gap:
      "10px",

    padding:
      "10px",
  },


  tradeCard: {
    padding:
      "12px",

    border:
      "1px solid rgba(255,255,255,.07)",

    borderRadius:
      "7px",

    background:
      "#111315",
  },


  tradeHeader: {
    display:
      "flex",

    justifyContent:
      "space-between",

    alignItems:
      "flex-start",

    gap:
      "12px",
  },


  tradeTeams: {
    display:
      "flex",

    alignItems:
      "center",

    gap:
      "7px",

    color:
      "#f2f3f4",

    fontSize:
      "14px",
  },


  swapArrow: {
    color:
      "#ff8425",
  },


  tradeMeta: {
    display:
      "block",

    marginTop:
      "3px",

    color:
      "#727983",

    fontSize:
      "11px",
  },


  statusBadge: {
    padding:
      "4px 7px",

    borderRadius:
      "4px",

    fontSize:
      "11px",

    fontWeight:
      950,
  },


  statusPending: {
    background:
      "rgba(255,135,30,.09)",

    color:
      "#ff8c2a",
  },


  statusExecuted: {
    background:
      "rgba(60,210,125,.09)",

    color:
      "#4ddd89",
  },


  statusRejected: {
    background:
      "rgba(255,80,65,.08)",

    color:
      "#ff6259",
  },


  statusNeutral: {
    background:
      "#24272b",

    color:
      "#858c95",
  },


  packageGrid: {
    marginTop:
      "11px",

    display:
      "grid",

    gridTemplateColumns:
      "minmax(0,1fr) 36px minmax(0,1fr)",

    gap:
      "8px",

    alignItems:
      "stretch",
  },


  packageCard: {
    padding:
      "9px",

    border:
      "1px solid rgba(255,255,255,.055)",

    borderRadius:
      "6px",

    background:
      "#0e1012",
  },


  packageTitle: {
    color:
      "#7a818b",

    fontSize:
      "11px",

    fontWeight:
      950,
  },


  packagePlayers: {
    marginTop:
      "8px",

    display:
      "grid",

    gap:
      "6px",
  },


  packagePlayer: {
    display:
      "flex",

    alignItems:
      "center",

    gap:
      "7px",
  },


  packageSwap: {
    display:
      "flex",

    alignItems:
      "center",

    justifyContent:
      "center",

    color:
      "#ff8425",

    fontSize:
      "16px",
  },


  playerText: {
    minWidth:
      0,

    display:
      "grid",

    gap:
      "2px",
  },


  playerName: {
    overflow:
      "hidden",

    textOverflow:
      "ellipsis",

    whiteSpace:
      "nowrap" as const,

    color:
      "#f0f2f4",

    fontSize:
      "12px",
  },


  playerMeta: {
    color:
      "#6e757e",

    fontSize:
      "11px",
  },


  avatar: {
    width:
      "29px",

    height:
      "29px",

    objectFit:
      "cover" as const,

    borderRadius:
      "50%",

    background:
      "#25282c",
  },


  avatarFallback: {
    width:
      "29px",

    height:
      "29px",

    display:
      "flex",

    alignItems:
      "center",

    justifyContent:
      "center",

    borderRadius:
      "50%",

    background:
      "#272a2e",

    color:
      "#f1f2f3",

    fontSize:
      "12px",

    fontWeight:
      950,
  },


  noPlayers: {
    color:
      "#666d76",

    fontSize:
      "11px",
  },


  tradeCounts: {
    marginTop:
      "10px",

    color:
      "#888f98",

    fontSize:
      "12px",
  },


  messageBox: {
    marginTop:
      "10px",

    padding:
      "8px 9px",

    borderLeft:
      "2px solid #ff7622",

    background:
      "rgba(255,110,20,.035)",

    color:
      "#9ca2aa",

    fontSize:
      "11px",

    fontStyle:
      "italic",
  },


  tradeActions: {
    marginTop:
      "10px",

    display:
      "flex",

    justifyContent:
      "flex-end",

    gap:
      "7px",
  },


  emptyState: {
    padding:
      "36px 20px",

    display:
      "grid",

    justifyItems:
      "center",

    gap:
      "5px",
  },


  emptyTitle: {
    color:
      "#e6e8eb",

    fontSize:
      "14px",
  },


  emptyText: {
    color:
      "#707780",

    fontSize:
      "11px",
  },


  modalBackdrop: {
    position:
      "fixed" as const,

    inset:
      0,

    zIndex:
      1000,

    padding:
      "20px",

    display:
      "flex",

    alignItems:
      "center",

    justifyContent:
      "center",

    background:
      "rgba(0,0,0,.76)",
  },


  modal: {
    width:
      "min(1120px,100%)",

    maxHeight:
      "90vh",

    overflow:
      "auto",

    border:
      "1px solid rgba(255,255,255,.1)",

    borderRadius:
      "10px",

    background:
      "#0f1113",

    boxShadow:
      "0 24px 80px rgba(0,0,0,.45)",
  },


  modalHeader: {
    padding:
      "14px 16px",

    display:
      "flex",

    justifyContent:
      "space-between",

    alignItems:
      "center",

    borderBottom:
      "1px solid rgba(255,255,255,.07)",
  },


  modalTitle: {
    margin:
      "2px 0 0",

    fontSize:
      "22px",
  },


  closeButton: {
    width:
      "30px",

    height:
      "30px",

    border:
      "1px solid rgba(255,255,255,.09)",

    borderRadius:
      "50%",

    background:
      "#17191c",

    color:
      "#aeb3ba",

    fontSize:
      "18px",

    cursor:
      "pointer",
  },


  composerTop: {
    padding:
      "12px 16px",

    display:
      "grid",

    gap:
      "6px",
  },


  fieldLabel: {
    color:
      "#767d86",

    fontSize:
      "11px",

    fontWeight:
      950,
  },


  select: {
    width:
      "100%",

    padding:
      "9px 10px",

    border:
      "1px solid rgba(255,255,255,.09)",

    borderRadius:
      "6px",

    background:
      "#17191c",

    color:
      "#fff",

    fontSize:
      "13px",
  },


  composerGrid: {
    padding:
      "0 16px",

    display:
      "grid",

    gridTemplateColumns:
      "1fr 1fr",

    gap:
      "12px",
  },


  rosterPanel: {
    overflow:
      "hidden",

    border:
      "1px solid rgba(255,255,255,.07)",

    borderRadius:
      "7px",

    background:
      "#111315",
  },


  rosterHeader: {
    padding:
      "9px 10px",

    display:
      "flex",

    justifyContent:
      "space-between",

    alignItems:
      "center",

    borderBottom:
      "1px solid rgba(255,255,255,.055)",

    color:
      "#f0f1f2",

    fontSize:
      "12px",
  },


  selectedCount: {
    color:
      "#ff8427",

    fontSize:
      "11px",
  },


  rosterList: {
    maxHeight:
      "360px",

    overflowY:
      "auto" as const,

    padding:
      "6px",
  },


  rosterPlayerButton: {
    width:
      "100%",

    padding:
      "7px",

    display:
      "grid",

    gridTemplateColumns:
      "29px minmax(0,1fr) 24px",

    alignItems:
      "center",

    gap:
      "7px",

    border:
      "1px solid transparent",

    borderRadius:
      "5px",

    background:
      "transparent",

    textAlign:
      "left" as const,

    cursor:
      "pointer",
  },


  rosterPlayerButtonActive: {
    border:
      "1px solid rgba(255,115,25,.3)",

    background:
      "rgba(255,100,15,.065)",
  },


  selectIndicator: {
    width:
      "21px",

    height:
      "21px",

    display:
      "flex",

    alignItems:
      "center",

    justifyContent:
      "center",

    borderRadius:
      "50%",

    background:
      "#25282c",

    color:
      "#828991",

    fontSize:
      "13px",

    fontWeight:
      950,
  },


  selectIndicatorActive: {
    background:
      "linear-gradient(135deg,#b51d18,#ff6412)",

    color:
      "#fff",
  },


  rosterEmpty: {
    padding:
      "28px 10px",

    textAlign:
      "center" as const,

    color:
      "#6e757e",

    fontSize:
      "11px",
  },


  messageField: {
    padding:
      "12px 16px",

    display:
      "grid",

    gap:
      "6px",
  },


  textarea: {
    minHeight:
      "72px",

    resize:
      "vertical" as const,

    padding:
      "9px 10px",

    border:
      "1px solid rgba(255,255,255,.09)",

    borderRadius:
      "6px",

    background:
      "#17191c",

    color:
      "#fff",

    fontSize:
      "13px",
  },


  modalFooter: {
    padding:
      "12px 16px",

    display:
      "flex",

    justifyContent:
      "space-between",

    alignItems:
      "center",

    gap:
      "12px",

    borderTop:
      "1px solid rgba(255,255,255,.07)",
  },


  tradeSummaryText: {
    color:
      "#747b84",

    fontSize:
      "11px",
  },


  modalActions: {
    display:
      "flex",

    gap:
      "7px",
  },
} as const;