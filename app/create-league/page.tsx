
"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

import Image from "next/image";
import Link from "next/link";

import {
  useRouter,
} from "next/navigation";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import FormField from "@/components/ui/FormField";
import MessageBox from "@/components/ui/MessageBox";

import {
  createSupabaseBrowserClient,
} from "@/lib/supabase/browser";

import {
  createLeague,
  type LeagueType,
  type PlayerSelectionMode,
} from "@/lib/leagues/league.service";


type LeagueFormat = {
  id:
    | "traditional"
    | "season_long_salary"
    | "season_long_no_salary"
    | "playoffs_salary"
    | "playoffs_no_salary"
    | "pickem"
    | "nhl_traditional"
    | "greyhound";

  title:
    string;

  description:
    string;

  leagueType:
    LeagueType;

  playerSelectionMode:
    PlayerSelectionMode;
};


const leagueFormats:
  LeagueFormat[] = [
    {
      id:
        "traditional",

      title:
        "Traditional Draft",

      description:
        "Season-long head-to-head fantasy football with a live draft, permanent rosters, waivers, trades, weekly matchups, standings, and playoffs.",

      leagueType:
        "traditional",

      playerSelectionMode:
        "draft",
    },

    {
      id:
        "season_long_salary",

      title:
        "Season-Long Salary Cap",

      description:
        "Build a new fantasy lineup every NFL week while staying under the league salary cap. Players can be used by multiple teams.",

      leagueType:
        "season_long",

      playerSelectionMode:
        "salary",
    },

    {
      id:
        "season_long_no_salary",

      title:
        "Season-Long No Salary Cap",

      description:
        "Build a new fantasy lineup every NFL week with no player salary restriction. Players can be used by multiple teams.",

      leagueType:
        "season_long",

      playerSelectionMode:
        "no_salary",
    },

    {
      id:
        "playoffs_salary",

      title:
        "NFL Playoffs Salary Cap",

      description:
        "Build fantasy lineups for the NFL postseason while staying under the league salary cap.",

      leagueType:
        "nfl_playoffs",

      playerSelectionMode:
        "salary",
    },

    {
      id:
        "playoffs_no_salary",

      title:
        "NFL Playoffs No Salary Cap",

      description:
        "Build fantasy lineups throughout the NFL postseason without a player salary restriction.",

      leagueType:
        "nfl_playoffs",

      playerSelectionMode:
        "no_salary",
    },

    {
      id:
        "pickem",

      title:
        "G365 Pick'em",

      description:
        "Create one multi-sport Pick'em league and enable College Football, NFL, NHL, or any combination. Football uses frozen G365 spreads/totals and NHL uses frozen G365 puck lines/totals.",

      leagueType:
        "pickem",

      playerSelectionMode:
        "pickem",
    },

    {
      id:
        "nhl_traditional",

      title:
        "NHL Traditional",

      description:
        "Season-long head-to-head fantasy hockey with a live draft, daily lineup changes, exclusive player ownership, waivers, trades, standings, and playoffs.",

      leagueType:
        "nhl_traditional",

      playerSelectionMode:
        "draft",
    },

    {
      id:
        "greyhound",

      title:
        "G365 Greyhound Racing",

      description:
        "Create a Greyhound Racing league with race-card importing, race management, scratches, results, wagering, standings, and commissioner controls.",

      leagueType:
        "greyhound",

      playerSelectionMode:
        "greyhound",
    },
  ];



type TraditionalCreationStatus = {
  season: number;
  allowed: boolean;
  scheduleReady: boolean;
  firstKickoffAt: string | null;
  cutoffAt: string | null;
  timeZone: string;
  message: string;
};


type NhlTraditionalLeagueFormat =
  | "redraft"
  | "dynasty";

type NhlTraditionalPositionMode =
  | "detailed"
  | "fdg";


type GreyhoundGameFormat =
  | "team_total_winnings"
  | "team_head_to_head"
  | "bankroll"
  | "survivor"
  | "tournament";

type GreyhoundTeamSetupMode = "random" | "manual";
type GreyhoundDurationMode = "single_day" | "date_range" | "weeks" | "rounds";

type GreyhoundRoundDraft = {
  id: string;
  name: string;
  startDate: string;
  days: string;
};

const GREYHOUND_GAME_OPTIONS: Array<{
  id: GreyhoundGameFormat;
  title: string;
  description: string;
}> = [
  {
    id: "team_total_winnings",
    title: "Team Season — Total Winnings",
    description:
      "Teams compete across the selected season window. The team with the highest official total winnings at the end is champion.",
  },
  {
    id: "team_head_to_head",
    title: "Team Season — Head-to-Head",
    description:
      "Teams face scheduled opponents during the season. The commissioner can randomize or manually control the team setup.",
  },
  {
    id: "bankroll",
    title: "Bankroll Challenge",
    description:
      "Every entry starts with the same bankroll and tries to finish the selected contest period with the strongest bankroll result.",
  },
  {
    id: "survivor",
    title: "Survivor",
    description:
      "Build custom rounds with exact start dates and day counts. The lowest total winnings is eliminated at the end of each round.",
  },
  {
    id: "tournament",
    title: "Tournament",
    description:
      "Build a one-day or multi-round tournament and choose the exact start date and number of days for every round.",
  },
];


export default function CreateLeaguePage() {
  const router =
    useRouter();

  const supabase =
    useMemo(
      () =>
        createSupabaseBrowserClient(),
      []
    );


  const [
    selectedFormatId,
    setSelectedFormatId,
  ] =
    useState<
      LeagueFormat["id"]
    >(
      "season_long_salary"
    );


  const [
    leagueName,
    setLeagueName,
  ] =
    useState("");


  const [
    teamName,
    setTeamName,
  ] =
    useState("");


  const [
    season,
    setSeason,
  ] =
    useState(
      String(
        new Date()
          .getFullYear()
      )
    );


  const [
    nhlLeagueFormat,
    setNhlLeagueFormat,
  ] = useState<NhlTraditionalLeagueFormat>("redraft");

  const [
    nhlPositionMode,
    setNhlPositionMode,
  ] = useState<NhlTraditionalPositionMode>("detailed");


  const [
    greyhoundGameFormat,
    setGreyhoundGameFormat,
  ] = useState<GreyhoundGameFormat>("bankroll");

  const [
    greyhoundTeamSetupMode,
    setGreyhoundTeamSetupMode,
  ] = useState<GreyhoundTeamSetupMode>("random");

  const [
    greyhoundDurationMode,
    setGreyhoundDurationMode,
  ] = useState<GreyhoundDurationMode>("single_day");

  const [
    greyhoundStartDate,
    setGreyhoundStartDate,
  ] = useState("");

  const [
    greyhoundEndDate,
    setGreyhoundEndDate,
  ] = useState("");

  const [
    greyhoundWeeks,
    setGreyhoundWeeks,
  ] = useState("4");

  const [
    greyhoundStartingBankroll,
    setGreyhoundStartingBankroll,
  ] = useState("100");

  const [
    greyhoundRounds,
    setGreyhoundRounds,
  ] = useState<GreyhoundRoundDraft[]>([
    {
      id: "round-1",
      name: "Round 1",
      startDate: "",
      days: "1",
    },
  ]);

  const [
    working,
    setWorking,
  ] =
    useState(false);


  const [
    message,
    setMessage,
  ] =
    useState("");


  const [
    isError,
    setIsError,
  ] =
    useState(false);


  const [
    traditionalCreationStatus,
    setTraditionalCreationStatus,
  ] =
    useState<
      TraditionalCreationStatus | null
    >(null);


  const [
    traditionalStatusLoading,
    setTraditionalStatusLoading,
  ] =
    useState(true);


  const selectedFormat =
    leagueFormats.find(
      (
        format
      ) =>
        format.id ===
        selectedFormatId
    ) ??
    leagueFormats[0];


  const parsedSeasonForAvailability =
    Number(
      season
    );


  useEffect(
    () => {
      let cancelled =
        false;

      async function loadTraditionalCreationStatus() {
        if (
          !Number.isInteger(
            parsedSeasonForAvailability
          ) ||
          parsedSeasonForAvailability <
            2000 ||
          parsedSeasonForAvailability >
            2200
        ) {
          if (!cancelled) {
            setTraditionalCreationStatus(
              null
            );

            setTraditionalStatusLoading(
              false
            );
          }

          return;
        }

        setTraditionalStatusLoading(
          true
        );

        const {
          data,
          error,
        } =
          await supabase.rpc(
            "get_traditional_league_creation_status",
            {
              p_season:
                parsedSeasonForAvailability,
            }
          );

        if (cancelled) {
          return;
        }

        if (
          error ||
          !data ||
          typeof data !==
            "object"
        ) {
          setTraditionalCreationStatus(
            null
          );

          setTraditionalStatusLoading(
            false
          );

          return;
        }

        setTraditionalCreationStatus(
          data as TraditionalCreationStatus
        );

        setTraditionalStatusLoading(
          false
        );
      }

      void loadTraditionalCreationStatus();

      return () => {
        cancelled =
          true;
      };
    },
    [
      parsedSeasonForAvailability,
      supabase,
    ]
  );


  const traditionalCreationClosed =
    traditionalCreationStatus
      ?.allowed ===
    false;


  const isTraditional =
    selectedFormat.leagueType ===
    "traditional";


  const isNhlTraditional =
    selectedFormat.leagueType ===
    "nhl_traditional";


  const isSeasonLong =
    selectedFormat.leagueType ===
    "season_long";


  const isPlayoffs =
    selectedFormat.leagueType ===
    "nfl_playoffs";


  const isPickem =
    selectedFormat.leagueType ===
    "pickem";


  const isGreyhound =
    selectedFormat.leagueType ===
    "greyhound";


  const requiresTeamName =
    isTraditional ||
    isNhlTraditional ||
    isSeasonLong ||
    isPickem;


  const isSalary =
    selectedFormat.playerSelectionMode ===
    "salary";


  const isGreyhoundTeamGame =
    greyhoundGameFormat === "team_total_winnings" ||
    greyhoundGameFormat === "team_head_to_head";

  const isGreyhoundRoundGame =
    greyhoundGameFormat === "survivor" ||
    greyhoundGameFormat === "tournament";

  const addGreyhoundRound = () => {
    setGreyhoundRounds((current) => [
      ...current,
      {
        id: `round-${Date.now()}-${current.length + 1}`,
        name:
          greyhoundGameFormat === "tournament"
            ? `Round ${current.length + 1}`
            : `Round ${current.length + 1}`,
        startDate: "",
        days: "1",
      },
    ]);
  };

  const updateGreyhoundRound = (
    id: string,
    field: "name" | "startDate" | "days",
    value: string
  ) => {
    setGreyhoundRounds((current) =>
      current.map((round) =>
        round.id === id
          ? {
              ...round,
              [field]: value,
            }
          : round
      )
    );
  };

  const removeGreyhoundRound = (id: string) => {
    setGreyhoundRounds((current) =>
      current.length <= 1
        ? current
        : current.filter((round) => round.id !== id)
    );
  };


  async function handleSubmit(
    event:
      FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (working) {
      return;
    }


    setWorking(true);
    setMessage("");
    setIsError(false);


    try {
      const parsedSeason =
        Number(
          season
        );


      if (
        selectedFormat
          .leagueType ===
          "traditional" &&
        traditionalCreationStatus
          ?.allowed ===
          false
      ) {
        throw new Error(
          traditionalCreationStatus
            .message
        );
      }


      if (isGreyhound) {
        const bankroll = Number(greyhoundStartingBankroll);

        if (!Number.isFinite(bankroll) || bankroll <= 0) {
          throw new Error("Starting bankroll must be greater than $0.");
        }

        if (isGreyhoundRoundGame) {
          if (greyhoundRounds.length < 1) {
            throw new Error("Add at least one Greyhound round.");
          }

          for (const round of greyhoundRounds) {
            const days = Number(round.days);

            if (!round.name.trim()) {
              throw new Error("Every Greyhound round needs a name.");
            }

            if (!round.startDate) {
              throw new Error(`Choose a start date for ${round.name.trim()}.`);
            }

            if (!Number.isInteger(days) || days < 1) {
              throw new Error(`${round.name.trim()} must run for at least 1 day.`);
            }
          }
        } else {
          if (!greyhoundStartDate) {
            throw new Error("Choose the Greyhound competition start date.");
          }

          if (greyhoundDurationMode === "date_range" && !greyhoundEndDate) {
            throw new Error("Choose the Greyhound competition end date.");
          }

          if (
            greyhoundDurationMode === "date_range" &&
            greyhoundEndDate < greyhoundStartDate
          ) {
            throw new Error("End date cannot be before the start date.");
          }

          if (greyhoundDurationMode === "weeks") {
            const weeks = Number(greyhoundWeeks);

            if (!Number.isInteger(weeks) || weeks < 1 || weeks > 52) {
              throw new Error("Greyhound competition weeks must be between 1 and 52.");
            }
          }
        }
      }


      let result: {
        success: boolean;
        leagueId: string;
        leagueType: LeagueType;
      };


      if (isNhlTraditional) {
        const {
          data: nhlCreateData,
          error: nhlCreateError,
        } = await supabase.rpc(
          "create_nhl_traditional_league_transaction",
          {
            p_name: leagueName,
            p_season: parsedSeason,
            p_team_name: teamName,
            p_league_format: nhlLeagueFormat,
            p_position_mode: nhlPositionMode,
          }
        );


        if (
          nhlCreateError
        ) {
          throw new Error(
            nhlCreateError.message
          );
        }


        if (
          !nhlCreateData ||
          typeof nhlCreateData !==
            "object" ||
          Array.isArray(
            nhlCreateData
          )
        ) {
          throw new Error(
            "The NHL Traditional league could not be created."
          );
        }


        const nhlResult =
          nhlCreateData as {
            success?: unknown;
            leagueId?: unknown;
            leagueType?: unknown;
          };


        if (
          nhlResult.success !==
            true ||
          typeof nhlResult.leagueId !==
            "string" ||
          nhlResult.leagueType !==
            "nhl_traditional"
        ) {
          throw new Error(
            "The NHL Traditional league could not be created."
          );
        }


        result = {
          success: true,
          leagueId:
            nhlResult.leagueId,
          leagueType:
            "nhl_traditional",
        };
      } else {
        const standardResult =
          await createLeague(
            supabase,
            {
              name:
                leagueName,

              leagueType:
                selectedFormat
                  .leagueType,

              playerSelectionMode:
                selectedFormat
                  .playerSelectionMode,

              season:
                parsedSeason,

              teamName:
                requiresTeamName
                  ? teamName
                  : undefined,

              /*
               * Traditional defaults to
               * 14 regular-season weeks.
               *
               * Commissioners can change
               * this later in league settings.
               */
              regularSeasonWeeks:
                isTraditional
                  ? 14
                  : undefined,
            }
          );


        if (
          !standardResult.success
        ) {
          throw new Error(
            "The league could not be created."
          );
        }


        result = {
          success: true,
          leagueId:
            standardResult.leagueId,
          leagueType:
            standardResult.leagueType,
        };
      }


      if (
        !result.success
      ) {
        throw new Error(
          "The league could not be created."
        );
      }


      if (
        result.leagueType ===
        "greyhound"
      ) {
        const setupResponse = await fetch(
          "/api/greyhound/league-setup",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              leagueId: result.leagueId,
              gameFormat: greyhoundGameFormat,
              teamSetupMode: isGreyhoundTeamGame
                ? greyhoundTeamSetupMode
                : null,
              durationMode: isGreyhoundRoundGame
                ? "rounds"
                : greyhoundDurationMode,
              startDate: isGreyhoundRoundGame
                ? greyhoundRounds[0]?.startDate ?? null
                : greyhoundStartDate || null,
              endDate:
                !isGreyhoundRoundGame && greyhoundDurationMode === "date_range"
                  ? greyhoundEndDate || null
                  : null,
              weeks:
                !isGreyhoundRoundGame && greyhoundDurationMode === "weeks"
                  ? Number(greyhoundWeeks)
                  : null,
              startingBankroll: Number(greyhoundStartingBankroll),
              rounds: isGreyhoundRoundGame
                ? greyhoundRounds.map((round, index) => ({
                    roundNumber: index + 1,
                    name: round.name.trim(),
                    startDate: round.startDate,
                    days: Number(round.days),
                  }))
                : [],
            }),
          }
        );

        const setupPayload = await setupResponse
          .json()
          .catch(() => null);

        if (!setupResponse.ok || !setupPayload?.success) {
          throw new Error(
            setupPayload?.error ??
              "League was created, but the Greyhound game setup could not be saved."
          );
        }

        router.replace(
          `/league/${result.leagueId}/greyhound/commissioner/race-cards`
        );
      } else {
        router.replace("/my-leagues");
      }

      router.refresh();

    } catch (error) {
      setIsError(true);

      setMessage(
        error instanceof
          Error
          ? error.message
          : "The league could not be created."
      );

    } finally {
      setWorking(false);
    }
  }


  return (
    <main
      style={
        styles.page
      }
    >
      <section
        style={
          styles.shell
        }
      >
        <header
          style={
            styles.topBar
          }
        >
          <Image
            src="/branding/gridiron365-logo-full.png"
            alt="Gridiron365"
            width={320}
            height={90}
            priority
            style={
              styles.logo
            }
          />

          <Link
            href="/my-leagues"
            style={
              styles.backLink
            }
          >
            ← My Leagues
          </Link>
        </header>


        <div>
          <p
            style={
              styles.eyebrow
            }
          >
            NEW LEAGUE
          </p>

          <h1
            style={
              styles.title
            }
          >
            Create League
          </h1>

          <p
            style={
              styles.subtitle
            }
          >
            Choose the G365 fantasy or pick'em format you want to play.
          </p>
        </div>


        <section
          style={
            styles.formatGrid
          }
        >
          {leagueFormats.map(
            (
              format
            ) => {
              const selected =
                format.id ===
                selectedFormatId;


              const unavailable =
                format.leagueType ===
                  "traditional" &&
                traditionalCreationClosed;

              return (
                <button
                  key={
                    format.id
                  }
                  type="button"
                  disabled={
                    unavailable
                  }
                  onClick={
                    () => {
                      if (
                        unavailable
                      ) {
                        return;
                      }

                      setSelectedFormatId(
                        format.id
                      );

                      setMessage("");
                      setIsError(false);
                    }
                  }
                  style={{
                    ...styles.formatButton,

                    ...(selected
                      ? styles.formatButtonSelected
                      : {}),

                    ...(unavailable
                      ? styles.formatButtonDisabled
                      : {}),
                  }}
                >
                  <span
                    style={{
                      ...styles.formatIndicator,

                      ...(selected
                        ? styles.formatIndicatorSelected
                        : {}),
                    }}
                  />

                  <span
                    style={
                      styles.formatTitle
                    }
                  >
                    {format.title}
                  </span>

                  <span
                    style={
                      styles.formatDescription
                    }
                  >
                    {format.description}
                  </span>


                  {format.leagueType ===
                  "traditional" ? (
                    <>
                      <span
                        style={
                          unavailable
                            ? styles.closedBadge
                            : styles.traditionalBadge
                        }
                      >
                        {traditionalStatusLoading
                          ? "CHECKING AVAILABILITY"
                          : unavailable
                            ? "CLOSED"
                            : "UP TO 12 TEAMS"}
                      </span>

                      {unavailable &&
                      traditionalCreationStatus ? (
                        <span
                          style={
                            styles.closedMessage
                          }
                        >
                          {traditionalCreationStatus.message}
                        </span>
                      ) : null}
                    </>
                  ) : format.leagueType ===
                    "nhl_traditional" ? (
                    <span
                      style={
                        styles.traditionalBadge
                      }
                    >
                      REDRAFT OR DYNASTY • H2H
                    </span>
                  ) : (
                    <span
                      style={
                        styles.largeLeagueBadge
                      }
                    >
                      LARGE PARTICIPATION
                    </span>
                  )}
                </button>
              );
            }
          )}
        </section>


        <Card
          style={
            styles.formCard
          }
        >
          <div
            aria-hidden="true"
            style={
              styles.cardAccent
            }
          />


          <header
            style={
              styles.formHeader
            }
          >
            <p
              style={
                styles.formEyebrow
              }
            >
              {selectedFormat.title}
            </p>

            <h2
              style={
                styles.formTitle
              }
            >
              League Details
            </h2>
          </header>


          <form
            onSubmit={
              handleSubmit
            }
            style={
              styles.form
            }
          >
            <FormField
              label="League Name"
              value={
                leagueName
              }
              onChange={(
                event
              ) =>
                setLeagueName(
                  event
                    .target
                    .value
                )
              }
              placeholder="Example: Sunday Gridiron League"
              maxLength={100}
              disabled={
                working
              }
              required
            />


            <FormField
              label="Season"
              type="number"
              value={
                season
              }
              onChange={(
                event
              ) =>
                setSeason(
                  event
                    .target
                    .value
                )
              }
              min={2000}
              max={2200}
              disabled={
                working
              }
              required
            />


            {requiresTeamName ? (
              <FormField
                label={
                  isTraditional ||
                  isNhlTraditional
                    ? "My Team Name"
                    : "My Entry Name"
                }
                value={
                  teamName
                }
                onChange={(
                  event
                ) =>
                  setTeamName(
                    event
                      .target
                      .value
                  )
                }
                placeholder={
                  isNhlTraditional
                    ? "Example: Ice Breakers"
                    : isTraditional
                      ? "Example: Gridiron Bisons"
                      : "Example: Sunday Crushers"
                }
                maxLength={100}
                disabled={
                  working
                }
                required
              />
            ) : null}


            {isTraditional ? (
              <div
                style={
                  styles.traditionalInfo
                }
              >
                <strong>
                  Traditional league
                </strong>

                <span>
                  Draft permanent rosters and compete in weekly
                  head-to-head matchups. After creation, the
                  commissioner can configure roster settings,
                  scoring, waivers, trades, playoffs, invitations,
                  and draft settings.
                </span>
              </div>
            ) : null}


            {isNhlTraditional ? (
              <div
                style={
                  styles.nhlSetup
                }
              >
                <div
                  style={
                    styles.nhlSectionHead
                  }
                >
                  <p
                    style={
                      styles.nhlEyebrow
                    }
                  >
                    NHL TRADITIONAL
                  </p>

                  <h3
                    style={
                      styles.nhlTitle
                    }
                  >
                    League Format
                  </h3>

                  <p
                    style={
                      styles.nhlHelp
                    }
                  >
                    Choose whether player ownership resets with a full draft
                    every season or carries forward from season to season.
                  </p>
                </div>

                <div
                  style={
                    styles.nhlChoiceGrid
                  }
                >
                  {([
                    [
                      "redraft",
                      "Redraft",
                      "Draft the full player pool each season. League history and trophies remain, but player ownership resets for the new season.",
                    ],
                    [
                      "dynasty",
                      "Dynasty",
                      "Keep player ownership across seasons and use offseason rookie/eligible-player drafts with persistent future draft-pick assets.",
                    ],
                  ] as const).map(
                    ([
                      value,
                      title,
                      description,
                    ]) => {
                      const selected =
                        nhlLeagueFormat ===
                        value;

                      return (
                        <button
                          key={
                            value
                          }
                          type="button"
                          disabled={
                            working
                          }
                          onClick={
                            () => {
                              setNhlLeagueFormat(
                                value
                              );

                              setMessage(
                                ""
                              );

                              setIsError(
                                false
                              );
                            }
                          }
                          style={{
                            ...styles.nhlChoice,
                            ...(selected
                              ? styles.nhlChoiceSelected
                              : {}),
                          }}
                        >
                          <strong>
                            {title}
                          </strong>

                          <span>
                            {description}
                          </span>

                          <span
                            style={{
                              ...styles.choicePill,
                              ...(selected
                                ? styles.choicePillSelected
                                : {}),
                            }}
                          >
                            {selected
                              ? "SELECTED"
                              : "SELECT"}
                          </span>
                        </button>
                      );
                    }
                  )}
                </div>

                <div
                  style={
                    styles.nhlSubsection
                  }
                >
                  <div>
                    <p
                      style={
                        styles.nhlEyebrow
                      }
                    >
                      POSITION SETUP
                    </p>

                    <h3
                      style={
                        styles.nhlSubTitle
                      }
                    >
                      Roster Positions
                    </h3>

                    <p
                      style={
                        styles.nhlHelp
                      }
                    >
                      This controls fantasy lineup eligibility. Every player's
                      actual NHL position remains stored in the NHL player
                      database.
                    </p>
                  </div>

                  <div
                    style={
                      styles.nhlChoiceGrid
                    }
                  >
                    {([
                      [
                        "detailed",
                        "Detailed Positions",
                        "C / LW / RW / D / G / UTIL. Best for leagues that want actual forward-position eligibility.",
                      ],
                      [
                        "fdg",
                        "Simplified F / D / G",
                        "Centers and wings all qualify as forwards. Lineups use F / D / G.",
                      ],
                    ] as const).map(
                      ([
                        value,
                        title,
                        description,
                      ]) => {
                        const selected =
                          nhlPositionMode ===
                          value;

                        return (
                          <button
                            key={
                              value
                            }
                            type="button"
                            disabled={
                              working
                            }
                            onClick={
                              () => {
                                setNhlPositionMode(
                                  value
                                );

                                setMessage(
                                  ""
                                );

                                setIsError(
                                  false
                                );
                              }
                            }
                            style={{
                              ...styles.nhlChoice,
                              ...(selected
                                ? styles.nhlChoiceSelected
                                : {}),
                            }}
                          >
                            <strong>
                              {title}
                            </strong>

                            <span>
                              {description}
                            </span>

                            <span
                              style={{
                                ...styles.choicePill,
                                ...(selected
                                  ? styles.choicePillSelected
                                  : {}),
                              }}
                            >
                              {selected
                                ? "SELECTED"
                                : "SELECT"}
                            </span>
                          </button>
                        );
                      }
                    )}
                  </div>
                </div>

                <div
                  style={
                    styles.nhlSummary
                  }
                >
                  <strong>
                    {nhlLeagueFormat ===
                    "dynasty"
                      ? "Dynasty"
                      : "Redraft"}
                    {" • "}
                    {nhlPositionMode ===
                    "fdg"
                      ? "F / D / G"
                      : "C / LW / RW / D / G / UTIL"}
                  </strong>

                  <span>
                    Weekly head-to-head matchups with daily lineup changes.
                    Each player locks individually when that player's real NHL
                    game begins.
                  </span>
                </div>
              </div>
            ) : null}


            {isSeasonLong ? (
              <div
                style={
                  styles.contestInfo
                }
              >
                <strong>
                  {isSalary
                    ? "Season-Long Salary Cap"
                    : "Season-Long No Salary Cap"}
                </strong>

                <span>
                  Build a completely new starting lineup each NFL
                  week. There is no draft and players are not
                  exclusive to one fantasy team.
                </span>

                {isSalary ? (
                  <span>
                    This league will begin with a $60,000 weekly
                    salary cap. Weekly player salaries will be
                    generated automatically from projections,
                    position value, matchup context, and injury
                    information.
                  </span>
                ) : (
                  <span>
                    There is no salary restriction. Owners can
                    choose any eligible players when building
                    their weekly lineup.
                  </span>
                )}

                <span>
                  Individual players lock when their NFL games
                  begin. Players in later games remain editable
                  until their own kickoff.
                </span>
              </div>
            ) : null}


            {isPickem ? (
              <div
                style={
                  styles.contestInfo
                }
              >
                <strong>
                  G365 Pick'em
                </strong>

                <span>
                  Choose College Football, NFL, NHL, or any combination in
                  Commissioner Settings. All enabled sports participate in
                  one G365 Pick'em contest.
                </span>

                <span>
                  Football uses frozen G365 spreads and totals. NHL uses frozen
                  G365 puck lines and totals. Required picks, scoring,
                  standings, recap, and trophies are shared across the league.
                </span>
              </div>
            ) : null}


            {isGreyhound ? (
              <div
                style={
                  styles.greyhoundSetup
                }
              >
                <div style={styles.greyhoundSectionHead}>
                  <p style={styles.greyhoundEyebrow}>REQUIRED</p>
                  <h3 style={styles.greyhoundTitle}>Greyhound Game Type</h3>
                  <p style={styles.greyhoundHelp}>
                    Choose how this Greyhound league will determine its champion.
                  </p>
                </div>

                <div style={styles.greyhoundGameGrid}>
                  {GREYHOUND_GAME_OPTIONS.map((option) => {
                    const selected = greyhoundGameFormat === option.id;

                    return (
                      <button
                        key={option.id}
                        type="button"
                        disabled={working}
                        onClick={() => {
                          setGreyhoundGameFormat(option.id);
                          setGreyhoundDurationMode(
                            option.id === "survivor" || option.id === "tournament"
                              ? "rounds"
                              : "single_day"
                          );
                          setMessage("");
                          setIsError(false);
                        }}
                        style={{
                          ...styles.greyhoundChoice,
                          ...(selected ? styles.greyhoundChoiceSelected : {}),
                        }}
                      >
                        <span style={styles.greyhoundChoiceTitle}>
                          {option.title}
                        </span>
                        <span style={styles.greyhoundChoiceText}>
                          {option.description}
                        </span>
                        <span
                          style={{
                            ...styles.choicePill,
                            ...(selected ? styles.choicePillSelected : {}),
                          }}
                        >
                          {selected ? "SELECTED" : "SELECT"}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {isGreyhoundTeamGame ? (
                  <div style={styles.greyhoundSubsection}>
                    <div>
                      <p style={styles.greyhoundEyebrow}>TEAM SETUP</p>
                      <h3 style={styles.greyhoundSubTitle}>Randomize or Manual</h3>
                      <p style={styles.greyhoundHelp}>
                        Save how the commissioner wants team setup handled once the league members are ready.
                      </p>
                    </div>

                    <div style={styles.segmentGrid}>
                      {([
                        ["random", "Randomize Teams", "Automatically randomize the team setup."],
                        ["manual", "Manual Teams", "Commissioner manually controls the team setup."],
                      ] as const).map(([value, title, description]) => (
                        <button
                          key={value}
                          type="button"
                          disabled={working}
                          onClick={() => setGreyhoundTeamSetupMode(value)}
                          style={{
                            ...styles.segmentButton,
                            ...(greyhoundTeamSetupMode === value
                              ? styles.segmentButtonSelected
                              : {}),
                          }}
                        >
                          <strong>{title}</strong>
                          <span>{description}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div style={styles.greyhoundSubsection}>
                  <div>
                    <p style={styles.greyhoundEyebrow}>BANKROLL</p>
                    <h3 style={styles.greyhoundSubTitle}>Starting Bankroll</h3>
                    <p style={styles.greyhoundHelp}>
                      Every entry begins the competition with this same bankroll amount.
                    </p>
                  </div>

                  <label style={styles.inputLabel}>
                    Starting Bankroll ($)
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0.01"
                      step="0.01"
                      value={greyhoundStartingBankroll}
                      onChange={(event) =>
                        setGreyhoundStartingBankroll(event.target.value)
                      }
                      disabled={working}
                      style={styles.textInput}
                      required
                    />
                  </label>
                </div>

                {isGreyhoundRoundGame ? (
                  <div style={styles.greyhoundSubsection}>
                    <div style={styles.roundHeader}>
                      <div>
                        <p style={styles.greyhoundEyebrow}>ROUND BUILDER</p>
                        <h3 style={styles.greyhoundSubTitle}>
                          {greyhoundGameFormat === "survivor"
                            ? "Survivor Rounds"
                            : "Tournament Rounds"}
                        </h3>
                        <p style={styles.greyhoundHelp}>
                          Enter the exact start date and number of days for every round. Each round can use a different length.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={addGreyhoundRound}
                        disabled={working}
                        style={styles.addRoundButton}
                      >
                        + Add Round
                      </button>
                    </div>

                    <div style={styles.roundList}>
                      {greyhoundRounds.map((round, index) => {
                        const parsedDays = Number(round.days);
                        let endDate = "";

                        if (round.startDate && Number.isInteger(parsedDays) && parsedDays > 0) {
                          const start = new Date(`${round.startDate}T12:00:00`);
                          start.setDate(start.getDate() + parsedDays - 1);
                          endDate = start.toISOString().slice(0, 10);
                        }

                        return (
                          <div key={round.id} style={styles.roundCard}>
                            <div style={styles.roundNumber}>Round {index + 1}</div>

                            <div style={styles.roundFields}>
                              <label style={styles.inputLabel}>
                                Round Name
                                <input
                                  type="text"
                                  value={round.name}
                                  onChange={(event) =>
                                    updateGreyhoundRound(
                                      round.id,
                                      "name",
                                      event.target.value
                                    )
                                  }
                                  disabled={working}
                                  style={styles.textInput}
                                  maxLength={80}
                                  required
                                />
                              </label>

                              <label style={styles.inputLabel}>
                                Start Date
                                <input
                                  type="date"
                                  value={round.startDate}
                                  onChange={(event) =>
                                    updateGreyhoundRound(
                                      round.id,
                                      "startDate",
                                      event.target.value
                                    )
                                  }
                                  disabled={working}
                                  style={styles.textInput}
                                  required
                                />
                              </label>

                              <label style={styles.inputLabel}>
                                Number of Days
                                <input
                                  type="number"
                                  min="1"
                                  max="365"
                                  step="1"
                                  value={round.days}
                                  onChange={(event) =>
                                    updateGreyhoundRound(
                                      round.id,
                                      "days",
                                      event.target.value
                                    )
                                  }
                                  disabled={working}
                                  style={styles.textInput}
                                  required
                                />
                              </label>
                            </div>

                            <div style={styles.roundFooter}>
                              <span style={styles.endDateText}>
                                {endDate ? `Ends ${endDate}` : "Choose a start date and day count"}
                              </span>

                              <button
                                type="button"
                                onClick={() => removeGreyhoundRound(round.id)}
                                disabled={working || greyhoundRounds.length <= 1}
                                style={styles.removeRoundButton}
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {greyhoundGameFormat === "survivor" ? (
                      <div style={styles.ruleNote}>
                        <strong>Survivor elimination:</strong> At the end of every configured round, the entry/team with the lowest official total winnings for that round is eliminated.
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div style={styles.greyhoundSubsection}>
                    <div>
                      <p style={styles.greyhoundEyebrow}>COMPETITION DATES</p>
                      <h3 style={styles.greyhoundSubTitle}>Contest Length</h3>
                      <p style={styles.greyhoundHelp}>
                        Use a single day, exact start/end dates, or a start date plus a number of weeks.
                      </p>
                    </div>

                    <div style={styles.durationGrid}>
                      {([
                        ["single_day", "1 Day"],
                        ["date_range", "Date Range"],
                        ["weeks", "Number of Weeks"],
                      ] as const).map(([value, title]) => (
                        <button
                          key={value}
                          type="button"
                          disabled={working}
                          onClick={() => setGreyhoundDurationMode(value)}
                          style={{
                            ...styles.durationButton,
                            ...(greyhoundDurationMode === value
                              ? styles.durationButtonSelected
                              : {}),
                          }}
                        >
                          {title}
                        </button>
                      ))}
                    </div>

                    <div style={styles.dateFields}>
                      <label style={styles.inputLabel}>
                        Start Date
                        <input
                          type="date"
                          value={greyhoundStartDate}
                          onChange={(event) =>
                            setGreyhoundStartDate(event.target.value)
                          }
                          disabled={working}
                          style={styles.textInput}
                          required
                        />
                      </label>

                      {greyhoundDurationMode === "date_range" ? (
                        <label style={styles.inputLabel}>
                          End Date
                          <input
                            type="date"
                            value={greyhoundEndDate}
                            min={greyhoundStartDate || undefined}
                            onChange={(event) =>
                              setGreyhoundEndDate(event.target.value)
                            }
                            disabled={working}
                            style={styles.textInput}
                            required
                          />
                        </label>
                      ) : null}

                      {greyhoundDurationMode === "weeks" ? (
                        <label style={styles.inputLabel}>
                          Number of Weeks
                          <input
                            type="number"
                            min="1"
                            max="52"
                            step="1"
                            value={greyhoundWeeks}
                            onChange={(event) =>
                              setGreyhoundWeeks(event.target.value)
                            }
                            disabled={working}
                            style={styles.textInput}
                            required
                          />
                        </label>
                      ) : null}
                    </div>
                  </div>
                )}
              </div>
            ) : null}


            {isPlayoffs ? (
              <div
                style={
                  styles.contestInfo
                }
              >
                <strong>
                  {isSalary
                    ? "NFL Playoffs Salary Cap"
                    : "NFL Playoffs No Salary Cap"}
                </strong>

                <span>
                  This format will use the NFL postseason rather
                  than the 18-week regular-season schedule.
                </span>

                <span>
                  The league can be created now. We will build its
                  postseason lineup and scoring system after the
                  Season-Long format is completed.
                </span>
              </div>
            ) : null}


            <MessageBox
              message={
                message
              }
              type={
                isError
                  ? "error"
                  : "success"
              }
            />


            <div
              style={
                styles.formActions
              }
            >
              <Link
                href="/my-leagues"
                style={
                  styles.cancelButton
                }
              >
                Cancel
              </Link>

              <Button
                type="submit"
                disabled={
                  working ||
                  (
                    isTraditional &&
                    traditionalCreationClosed
                  )
                }
                style={
                  styles.submitButton
                }
              >
                {working
                  ? "Creating League..."
                  : "Create League"}
              </Button>
            </div>
          </form>
        </Card>
      </section>
    </main>
  );
}


const styles = {
  page: {
    minHeight:
      "100vh",

    padding:
      "24px 18px 60px",
  },

  shell: {
    width:
      "min(1180px,100%)",

    margin:
      "0 auto",

    display:
      "grid",

    gap:
      "30px",
  },

  topBar: {
    display:
      "flex",

    alignItems:
      "center",

    justifyContent:
      "space-between",

    gap:
      "20px",

    flexWrap:
      "wrap" as const,

    paddingBottom:
      "18px",

    borderBottom:
      "1px solid rgba(255,255,255,.08)",
  },

  logo: {
    width:
      "min(300px,75vw)",

    height:
      "auto",

    objectFit:
      "contain" as const,

    filter:
      "drop-shadow(0 10px 28px rgba(255,69,0,.16))",
  },

  backLink: {
    color:
      "#ff8c00",

    fontSize:
      "13px",

    fontWeight:
      900,

    textDecoration:
      "none",
  },

  eyebrow: {
    margin:
      0,

    color:
      "#ff8c00",

    fontSize:
      "10px",

    fontWeight:
      900,

    letterSpacing:
      ".15em",
  },

  title: {
    margin:
      "7px 0 0",

    color:
      "#ffffff",

    fontSize:
      "36px",
  },

  subtitle: {
    margin:
      "8px 0 0",

    color:
      "#8f96a3",

    fontSize:
      "14px",
  },

  formatGrid: {
    display:
      "grid",

    gridTemplateColumns:
      "repeat(auto-fit,minmax(210px,1fr))",

    gap:
      "14px",
  },

  formatButton: {
    position:
      "relative" as const,

    minHeight:
      "215px",

    display:
      "flex",

    flexDirection:
      "column" as const,

    alignItems:
      "flex-start",

    padding:
      "20px",

    border:
      "1px solid rgba(255,255,255,.09)",

    borderRadius:
      "14px",

    background:
      "linear-gradient(145deg,rgba(22,22,22,.98),rgba(7,7,7,.99))",

    color:
      "#ffffff",

    cursor:
      "pointer",

    textAlign:
      "left" as const,

    transition:
      "border-color .15s ease, transform .15s ease, box-shadow .15s ease",
  },

  formatButtonSelected: {
    border:
      "1px solid rgba(255,94,0,.75)",

    boxShadow:
      "0 14px 36px rgba(255,69,0,.13)",
  },

  formatIndicator: {
    width:
      "30px",

    height:
      "4px",

    borderRadius:
      "999px",

    background:
      "#343434",

    marginBottom:
      "15px",
  },

  formatIndicatorSelected: {
    background:
      "linear-gradient(90deg,#ff1e1e,#ff8c00)",
  },

  formatTitle: {
    color:
      "#ffffff",

    fontSize:
      "15px",

    fontWeight:
      900,
  },

  formatDescription: {
    marginTop:
      "9px",

    color:
      "#8f96a3",

    fontSize:
      "12px",

    lineHeight:
      1.5,
  },

  largeLeagueBadge: {
    marginTop:
      "auto",

    paddingTop:
      "17px",

    color:
      "#ff8c00",

    fontSize:
      "8px",

    fontWeight:
      900,

    letterSpacing:
      ".09em",
  },

  formatButtonDisabled: {
    opacity:
      0.58,

    cursor:
      "not-allowed",

    border:
      "1px solid rgba(255,80,80,.30)",

    background:
      "linear-gradient(180deg,rgba(85,16,20,.42),rgba(14,14,18,.96))",
  },

  closedBadge: {
    marginTop:
      "auto",

    paddingTop:
      "17px",

    color:
      "#ff7e84",

    fontSize:
      "8px",

    fontWeight:
      900,

    letterSpacing:
      ".09em",
  },

  closedMessage: {
    marginTop:
      "6px",

    color:
      "#ff9a9e",

    fontSize:
      "10px",

    fontWeight:
      800,

    lineHeight:
      1.4,
  },

  traditionalBadge: {
    marginTop:
      "auto",

    paddingTop:
      "17px",

    color:
      "#c6c9cf",

    fontSize:
      "8px",

    fontWeight:
      900,

    letterSpacing:
      ".09em",
  },

  formCard: {
    width:
      "min(980px,100%)",

    padding:
      "28px",
  },

  cardAccent: {
    position:
      "absolute" as const,

    top:
      0,

    left:
      0,

    right:
      0,

    height:
      "3px",

    background:
      "linear-gradient(90deg,#ff1e1e,#ff4500,#ff8c00)",
  },

  formHeader: {
    marginBottom:
      "23px",
  },

  formEyebrow: {
    margin:
      0,

    color:
      "#ff8c00",

    fontSize:
      "9px",

    fontWeight:
      900,

    letterSpacing:
      ".12em",

    textTransform:
      "uppercase" as const,
  },

  formTitle: {
    margin:
      "7px 0 0",

    color:
      "#ffffff",

    fontSize:
      "24px",
  },

  form: {
    display:
      "grid",

    gap:
      "17px",
  },

  traditionalInfo: {
    display:
      "grid",

    gap:
      "6px",

    padding:
      "14px",

    border:
      "1px solid rgba(255,94,0,.18)",

    borderRadius:
      "10px",

    background:
      "rgba(255,69,0,.055)",

    color:
      "#a8adb7",

    fontSize:
      "12px",

    lineHeight:
      1.5,
  },

  contestInfo: {
    display:
      "grid",

    gap:
      "8px",

    padding:
      "14px",

    border:
      "1px solid rgba(255,140,0,.18)",

    borderRadius:
      "10px",

    background:
      "rgba(255,140,0,.06)",

    color:
      "#a8adb7",

    fontSize:
      "12px",

    lineHeight:
      1.5,
  },

  nhlSetup: {
    display: "grid",
    gap: "18px",
    padding: "16px",
    border: "1px solid rgba(255,94,0,.24)",
    borderRadius: "14px",
    background:
      "linear-gradient(180deg,rgba(255,69,0,.055),rgba(8,8,10,.7))",
  },

  nhlSectionHead: {
    display: "grid",
    gap: "5px",
  },

  nhlEyebrow: {
    margin: 0,
    color: "#ff8c00",
    fontSize: "9px",
    fontWeight: 900,
    letterSpacing: ".12em",
  },

  nhlTitle: {
    margin: 0,
    color: "#fff",
    fontSize: "20px",
  },

  nhlSubTitle: {
    margin: "3px 0 0",
    color: "#fff",
    fontSize: "16px",
  },

  nhlHelp: {
    margin: "4px 0 0",
    color: "#949ba7",
    fontSize: "12px",
    lineHeight: 1.5,
  },

  nhlChoiceGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit,minmax(210px,1fr))",
    gap: "10px",
  },

  nhlChoice: {
    minHeight: "145px",
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "flex-start",
    gap: "8px",
    padding: "14px",
    border: "1px solid rgba(255,255,255,.09)",
    borderRadius: "12px",
    background: "#101114",
    color: "#fff",
    textAlign: "left" as const,
    cursor: "pointer",
    lineHeight: 1.5,
    fontSize: "11px",
  },

  nhlChoiceSelected: {
    border: "1px solid rgba(255,94,0,.78)",
    boxShadow:
      "0 10px 28px rgba(255,69,0,.12)",
    background:
      "linear-gradient(145deg,rgba(76,20,8,.42),#101114)",
  },

  nhlSubsection: {
    display: "grid",
    gap: "12px",
    paddingTop: "16px",
    borderTop:
      "1px solid rgba(255,255,255,.08)",
  },

  nhlSummary: {
    display: "grid",
    gap: "6px",
    padding: "12px",
    border:
      "1px solid rgba(255,140,0,.18)",
    borderRadius: "10px",
    background:
      "rgba(255,140,0,.05)",
    color: "#b8bdc6",
    fontSize: "11px",
    lineHeight: 1.5,
  },


  greyhoundSetup: {
    display: "grid",
    gap: "18px",
    padding: "16px",
    border: "1px solid rgba(255,94,0,.24)",
    borderRadius: "14px",
    background: "linear-gradient(180deg,rgba(255,69,0,.055),rgba(8,8,10,.7))",
  },

  greyhoundSectionHead: {
    display: "grid",
    gap: "5px",
  },

  greyhoundEyebrow: {
    margin: 0,
    color: "#ff8c00",
    fontSize: "9px",
    fontWeight: 900,
    letterSpacing: ".12em",
  },

  greyhoundTitle: {
    margin: 0,
    color: "#fff",
    fontSize: "20px",
  },

  greyhoundSubTitle: {
    margin: "3px 0 0",
    color: "#fff",
    fontSize: "16px",
  },

  greyhoundHelp: {
    margin: "4px 0 0",
    color: "#949ba7",
    fontSize: "12px",
    lineHeight: 1.5,
  },

  greyhoundGameGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))",
    gap: "10px",
  },

  greyhoundChoice: {
    minHeight: "165px",
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "flex-start",
    gap: "8px",
    padding: "14px",
    border: "1px solid rgba(255,255,255,.09)",
    borderRadius: "12px",
    background: "#101114",
    color: "#fff",
    textAlign: "left" as const,
    cursor: "pointer",
  },

  greyhoundChoiceSelected: {
    border: "1px solid rgba(255,94,0,.78)",
    boxShadow: "0 10px 28px rgba(255,69,0,.12)",
    background: "linear-gradient(145deg,rgba(76,20,8,.42),#101114)",
  },

  greyhoundChoiceTitle: {
    fontSize: "14px",
    fontWeight: 900,
    color: "#fff",
  },

  greyhoundChoiceText: {
    color: "#9aa0aa",
    fontSize: "11px",
    lineHeight: 1.5,
  },

  choicePill: {
    marginTop: "auto",
    color: "#747b86",
    fontSize: "8px",
    fontWeight: 900,
    letterSpacing: ".1em",
  },

  choicePillSelected: {
    color: "#ff8c00",
  },

  greyhoundSubsection: {
    display: "grid",
    gap: "12px",
    paddingTop: "16px",
    borderTop: "1px solid rgba(255,255,255,.08)",
  },

  segmentGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))",
    gap: "10px",
  },

  segmentButton: {
    minHeight: "82px",
    display: "grid",
    gap: "5px",
    padding: "12px",
    border: "1px solid rgba(255,255,255,.09)",
    borderRadius: "10px",
    background: "#121316",
    color: "#fff",
    textAlign: "left" as const,
    cursor: "pointer",
  },

  segmentButtonSelected: {
    border: "1px solid rgba(255,140,0,.75)",
    background: "rgba(255,140,0,.08)",
  },

  durationGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))",
    gap: "8px",
  },

  durationButton: {
    minHeight: "44px",
    padding: "9px 12px",
    border: "1px solid rgba(255,255,255,.09)",
    borderRadius: "9px",
    background: "#121316",
    color: "#b4bac4",
    fontWeight: 900,
    cursor: "pointer",
  },

  durationButtonSelected: {
    border: "1px solid rgba(255,94,0,.72)",
    color: "#fff",
    background: "linear-gradient(90deg,rgba(255,30,30,.15),rgba(255,140,0,.12))",
  },

  dateFields: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
    gap: "10px",
  },

  inputLabel: {
    display: "grid",
    gap: "6px",
    color: "#c8ccd4",
    fontSize: "11px",
    fontWeight: 800,
  },

  textInput: {
    width: "100%",
    minHeight: "44px",
    padding: "10px 12px",
    border: "1px solid rgba(255,255,255,.11)",
    borderRadius: "9px",
    background: "#0c0d0f",
    color: "#fff",
    fontSize: "14px",
    outline: "none",
    boxSizing: "border-box" as const,
    colorScheme: "dark" as const,
  },

  roundHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "12px",
    flexWrap: "wrap" as const,
  },

  addRoundButton: {
    minHeight: "42px",
    padding: "9px 13px",
    border: "1px solid rgba(255,140,0,.45)",
    borderRadius: "9px",
    background: "rgba(255,140,0,.08)",
    color: "#ff9d28",
    fontWeight: 900,
    cursor: "pointer",
  },

  roundList: {
    display: "grid",
    gap: "10px",
  },

  roundCard: {
    display: "grid",
    gap: "10px",
    padding: "13px",
    border: "1px solid rgba(255,255,255,.08)",
    borderRadius: "11px",
    background: "rgba(0,0,0,.24)",
  },

  roundNumber: {
    color: "#ff8c00",
    fontSize: "10px",
    fontWeight: 900,
    letterSpacing: ".08em",
    textTransform: "uppercase" as const,
  },

  roundFields: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))",
    gap: "10px",
  },

  roundFooter: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "10px",
    flexWrap: "wrap" as const,
  },

  endDateText: {
    color: "#8f96a3",
    fontSize: "11px",
  },

  removeRoundButton: {
    border: 0,
    background: "transparent",
    color: "#ff7b80",
    fontSize: "11px",
    fontWeight: 900,
    cursor: "pointer",
  },

  ruleNote: {
    padding: "11px 12px",
    border: "1px solid rgba(255,140,0,.18)",
    borderRadius: "9px",
    background: "rgba(255,140,0,.05)",
    color: "#b8bdc6",
    fontSize: "11px",
    lineHeight: 1.5,
  },

  formActions: {
    display:
      "flex",

    alignItems:
      "center",

    justifyContent:
      "flex-end",

    gap:
      "12px",

    flexWrap:
      "wrap" as const,

    marginTop:
      "5px",
  },

  cancelButton: {
    minHeight:
      "46px",

    display:
      "inline-flex",

    alignItems:
      "center",

    justifyContent:
      "center",

    padding:
      "11px 18px",

    border:
      "1px solid rgba(255,255,255,.11)",

    borderRadius:
      "9px",

    background:
      "#17181a",

    color:
      "#c4c8cf",

    fontSize:
      "13px",

    fontWeight:
      800,

    textDecoration:
      "none",
  },

  submitButton: {
    minHeight:
      "46px",

    paddingLeft:
      "24px",

    paddingRight:
      "24px",
  },
}