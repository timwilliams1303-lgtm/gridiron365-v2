"use client";

import {
  FormEvent,
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


type LeagueTypeOption = {
  id:
    LeagueType;

  title:
    string;

  description:
    string;

  participationLabel:
    string;
};


type PlayerSelectionOption = {
  id:
    Extract<
      PlayerSelectionMode,
      "salary" |
      "no_salary"
    >;

  title:
    string;

  description:
    string;
};


const leagueTypeOptions:
  LeagueTypeOption[] = [
    {
      id:
        "traditional",

      title:
        "Traditional",

      description:
        "Season-long head-to-head fantasy football with a live draft, permanent rosters, waivers, trades, weekly matchups, standings, and playoffs.",

      participationLabel:
        "UP TO 12 TEAMS",
    },

    {
      id:
        "season_long",

      title:
        "Season-Long",

      description:
        "Build a completely new fantasy lineup each NFL week and compete on cumulative points across the regular season.",

      participationLabel:
        "LARGE PARTICIPATION",
    },

    {
      id:
        "nfl_playoffs",

      title:
        "NFL Playoffs",

      description:
        "Build fantasy lineups throughout the NFL postseason and compete on cumulative playoff scoring.",

      participationLabel:
        "LARGE PARTICIPATION",
    },
  ];


const playerSelectionOptions:
  PlayerSelectionOption[] = [
    {
      id:
        "salary",

      title:
        "Salary Cap",

      description:
        "Every player has a weekly salary. Build your lineup while staying under the league salary cap.",
    },

    {
      id:
        "no_salary",

      title:
        "No Salary Cap",

      description:
        "Choose any eligible players each week with no salary restriction.",
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
    selectedLeagueType,
    setSelectedLeagueType,
  ] =
    useState<
      LeagueType
    >(
      "traditional"
    );


  const [
    selectedPlayerSelectionMode,
    setSelectedPlayerSelectionMode,
  ] =
    useState<
      PlayerSelectionMode
    >(
      "draft"
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


  const selectedLeagueTypeOption =
    leagueTypeOptions.find(
      (
        option
      ) =>
        option.id ===
        selectedLeagueType
    ) ??
    leagueTypeOptions[0];


  const isTraditional =
    selectedLeagueType ===
    "traditional";


  const isSeasonLong =
    selectedLeagueType ===
    "season_long";


  const isPlayoffs =
    selectedLeagueType ===
    "nfl_playoffs";


  const requiresTeamName =
    isTraditional ||
    isSeasonLong;


  const isSalary =
    selectedPlayerSelectionMode ===
    "salary";


  const selectedFormatTitle =
    isTraditional
      ? "Traditional Draft"
      : isSeasonLong
        ? isSalary
          ? "Season-Long • Salary Cap"
          : "Season-Long • No Salary Cap"
        : isSalary
          ? "NFL Playoffs • Salary Cap"
          : "NFL Playoffs • No Salary Cap";


  function selectLeagueType(
    leagueType:
      LeagueType
  ) {
    setSelectedLeagueType(
      leagueType
    );

    if (
      leagueType ===
      "traditional"
    ) {
      setSelectedPlayerSelectionMode(
        "draft"
      );
    } else {
      /*
       * Salary Cap is the default for
       * Season-Long and NFL Playoffs.
       *
       * The commissioner can immediately
       * switch to No Salary Cap below.
       */
      setSelectedPlayerSelectionMode(
        "salary"
      );
    }

    setMessage("");
    setIsError(false);
  }


  async function handleSubmit(
    event:
      FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (
      working
    ) {
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


      const result =
        await createLeague(
          supabase,
          {
            name:
              leagueName,

            leagueType:
              selectedLeagueType,

            playerSelectionMode:
              selectedPlayerSelectionMode,

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
        !result.success
      ) {
        throw new Error(
          "The league could not be created."
        );
      }


      /*
       * Keep the existing safe post-create
       * behavior for all league types.
       *
       * The league will appear immediately
       * on My Leagues and can be entered from
       * there.
       */
      router.replace(
        "/my-leagues"
      );

      router.refresh();

    } catch (
      error
    ) {
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
            Choose your league type, then choose how players are selected.
          </p>
        </div>


        {/* ==================================================
            LEAGUE TYPE
        =================================================== */}

        <section
          style={
            styles.selectionSection
          }
        >
          <div
            style={
              styles.selectionHeader
            }
          >
            <div>
              <p
                style={
                  styles.sectionEyebrow
                }
              >
                STEP 1
              </p>

              <h2
                style={
                  styles.sectionTitle
                }
              >
                League Type
              </h2>
            </div>

            <span
              style={
                styles.sectionHelper
              }
            >
              Choose the overall competition format.
            </span>
          </div>


          <div
            style={
              styles.formatGrid
            }
          >
            {leagueTypeOptions.map(
              (
                option
              ) => {
                const selected =
                  option.id ===
                  selectedLeagueType;


                return (
                  <button
                    key={
                      option.id
                    }
                    type="button"
                    onClick={
                      () =>
                        selectLeagueType(
                          option.id
                        )
                    }
                    style={{
                      ...styles.formatButton,

                      ...(selected
                        ? styles.formatButtonSelected
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
                      {option.title}
                    </span>

                    <span
                      style={
                        styles.formatDescription
                      }
                    >
                      {option.description}
                    </span>

                    <span
                      style={
                        option.id ===
                        "traditional"
                          ? styles.traditionalBadge
                          : styles.largeLeagueBadge
                      }
                    >
                      {option.participationLabel}
                    </span>
                  </button>
                );
              }
            )}
          </div>
        </section>


        {/* ==================================================
            PLAYER SELECTION
        =================================================== */}

        {!isTraditional ? (
          <section
            style={
              styles.selectionSection
            }
          >
            <div
              style={
                styles.selectionHeader
              }
            >
              <div>
                <p
                  style={
                    styles.sectionEyebrow
                  }
                >
                  STEP 2
                </p>

                <h2
                  style={
                    styles.sectionTitle
                  }
                >
                  Player Selection
                </h2>
              </div>

              <span
                style={
                  styles.sectionHelper
                }
              >
                Choose whether this league uses a weekly salary cap.
              </span>
            </div>


            <div
              style={
                styles.playerSelectionGrid
              }
            >
              {playerSelectionOptions.map(
                (
                  option
                ) => {
                  const selected =
                    option.id ===
                    selectedPlayerSelectionMode;


                  return (
                    <button
                      key={
                        option.id
                      }
                      type="button"
                      onClick={
                        () => {
                          setSelectedPlayerSelectionMode(
                            option.id
                          );

                          setMessage("");
                          setIsError(false);
                        }
                      }
                      style={{
                        ...styles.playerSelectionButton,

                        ...(selected
                          ? styles.playerSelectionButtonSelected
                          : {}),
                      }}
                    >
                      <span
                        style={{
                          ...styles.modeDot,

                          ...(selected
                            ? styles.modeDotSelected
                            : {}),
                        }}
                      />

                      <span
                        style={
                          styles.playerSelectionTitle
                        }
                      >
                        {option.title}
                      </span>

                      <span
                        style={
                          styles.playerSelectionDescription
                        }
                      >
                        {option.description}
                      </span>

                      <span
                        style={
                          styles.selectedModeLabel
                        }
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
          </section>
        ) : (
          <section
            style={
              styles.draftModeSummary
            }
          >
            <div>
              <p
                style={
                  styles.sectionEyebrow
                }
              >
                PLAYER SELECTION
              </p>

              <strong
                style={
                  styles.draftModeTitle
                }
              >
                Live Draft
              </strong>
            </div>

            <span
              style={
                styles.draftModeDescription
              }
            >
              Traditional leagues use a draft with permanent, exclusive rosters.
            </span>
          </section>
        )}


        {/* ==================================================
            LEAGUE DETAILS
        =================================================== */}

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
              {selectedFormatTitle}
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
                  isTraditional
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
                  isTraditional
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


            {isSeasonLong ? (
              <div
                style={
                  styles.contestInfo
                }
              >
                <strong>
                  {isSalary
                    ? "Season-Long • Salary Cap"
                    : "Season-Long • No Salary Cap"}
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


            {isPlayoffs ? (
              <div
                style={
                  styles.contestInfo
                }
              >
                <strong>
                  {isSalary
                    ? "NFL Playoffs • Salary Cap"
                    : "NFL Playoffs • No Salary Cap"}
                </strong>

                <span>
                  This format uses the NFL postseason rather than
                  the regular-season schedule.
                </span>

                {isSalary ? (
                  <span>
                    Owners will build playoff lineups while staying
                    under the league salary cap.
                  </span>
                ) : (
                  <span>
                    Owners will build playoff lineups without a
                    player salary restriction.
                  </span>
                )}
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
                  working
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

  selectionSection: {
    display:
      "grid",

    gap:
      "14px",
  },

  selectionHeader: {
    display:
      "flex",

    alignItems:
      "flex-end",

    justifyContent:
      "space-between",

    gap:
      "18px",

    flexWrap:
      "wrap" as const,
  },

  sectionEyebrow: {
    margin:
      0,

    color:
      "#ff8c00",

    fontSize:
      "9px",

    fontWeight:
      900,

    letterSpacing:
      ".13em",

    textTransform:
      "uppercase" as const,
  },

  sectionTitle: {
    margin:
      "5px 0 0",

    color:
      "#ffffff",

    fontSize:
      "21px",
  },

  sectionHelper: {
    color:
      "#7f8794",

    fontSize:
      "12px",
  },

  formatGrid: {
    display:
      "grid",

    gridTemplateColumns:
      "repeat(auto-fit,minmax(250px,1fr))",

    gap:
      "14px",
  },

  formatButton: {
    position:
      "relative" as const,

    minHeight:
      "210px",

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

    transform:
      "translateY(-1px)",
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
      "17px",

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

  playerSelectionGrid: {
    display:
      "grid",

    gridTemplateColumns:
      "repeat(auto-fit,minmax(260px,1fr))",

    gap:
      "14px",

    maxWidth:
      "820px",
  },

  playerSelectionButton: {
    position:
      "relative" as const,

    minHeight:
      "155px",

    display:
      "grid",

    gridTemplateColumns:
      "18px 1fr",

    gridTemplateRows:
      "auto auto auto",

    columnGap:
      "11px",

    rowGap:
      "7px",

    alignItems:
      "start",

    padding:
      "18px",

    border:
      "1px solid rgba(255,255,255,.09)",

    borderRadius:
      "12px",

    background:
      "rgba(12,12,14,.94)",

    color:
      "#ffffff",

    cursor:
      "pointer",

    textAlign:
      "left" as const,

    transition:
      "border-color .15s ease, box-shadow .15s ease, transform .15s ease",
  },

  playerSelectionButtonSelected: {
    border:
      "1px solid rgba(255,140,0,.65)",

    boxShadow:
      "0 12px 30px rgba(255,69,0,.11)",

    transform:
      "translateY(-1px)",
  },

  modeDot: {
    width:
      "13px",

    height:
      "13px",

    marginTop:
      "3px",

    border:
      "2px solid #555d68",

    borderRadius:
      "50%",

    background:
      "transparent",
  },

  modeDotSelected: {
    border:
      "3px solid #ff8c00",

    background:
      "#ff3b12",

    boxShadow:
      "0 0 0 3px rgba(255,94,0,.12)",
  },

  playerSelectionTitle: {
    color:
      "#ffffff",

    fontSize:
      "15px",

    fontWeight:
      900,
  },

  playerSelectionDescription: {
    gridColumn:
      "2",

    color:
      "#8f96a3",

    fontSize:
      "12px",

    lineHeight:
      1.5,
  },

  selectedModeLabel: {
    gridColumn:
      "2",

    marginTop:
      "7px",

    color:
      "#ff8c00",

    fontSize:
      "8px",

    fontWeight:
      900,

    letterSpacing:
      ".1em",
  },

  draftModeSummary: {
    display:
      "flex",

    alignItems:
      "center",

    justifyContent:
      "space-between",

    gap:
      "18px",

    flexWrap:
      "wrap" as const,

    padding:
      "16px 18px",

    border:
      "1px solid rgba(255,94,0,.17)",

    borderRadius:
      "12px",

    background:
      "rgba(255,69,0,.045)",
  },

  draftModeTitle: {
    display:
      "block",

    marginTop:
      "5px",

    color:
      "#ffffff",

    fontSize:
      "15px",
  },

  draftModeDescription: {
    maxWidth:
      "620px",

    color:
      "#9299a5",

    fontSize:
      "12px",

    lineHeight:
      1.5,
  },

  formCard: {
    width:
      "min(700px,100%)",

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
  }
  };