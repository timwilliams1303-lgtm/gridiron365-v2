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


type LeagueFormat = {
  id:
    | "traditional"
    | "season_long_salary"
    | "season_long_no_salary"
    | "playoffs_salary"
    | "playoffs_no_salary"
    | "pickem";

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
        "G365 Football Pick'em",

      description:
        "Pick against the frozen G365 Spread each week across College Football, the NFL, or both. Picks stay private until each selected game kicks off.",

      leagueType:
        "pickem",

      playerSelectionMode:
        "pickem",
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
      "traditional"
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


  const selectedFormat =
    leagueFormats.find(
      (
        format
      ) =>
        format.id ===
        selectedFormatId
    ) ??
    leagueFormats[0];


  const isTraditional =
    selectedFormat.leagueType ===
    "traditional";


  const isSeasonLong =
    selectedFormat.leagueType ===
    "season_long";


  const isPlayoffs =
    selectedFormat.leagueType ===
    "nfl_playoffs";


  const isPickem =
    selectedFormat.leagueType ===
    "pickem";


  const requiresTeamName =
    isTraditional ||
    isSeasonLong ||
    isPickem;


  const isSalary =
    selectedFormat.playerSelectionMode ===
    "salary";


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


      const result =
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
        !result.success
      ) {
        throw new Error(
          "The league could not be created."
        );
      }


      /*
       * For now, all newly-created formats
       * return to My Leagues.
       *
       * Once the Season-Long league home
       * page is built, we can send the
       * commissioner directly there.
       */
      router.replace(
        "/my-leagues"
      );

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
            Choose the fantasy football format you want to play.
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


              return (
                <button
                  key={
                    format.id
                  }
                  type="button"
                  onClick={
                    () => {
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
                    <span
                      style={
                        styles.traditionalBadge
                      }
                    >
                      UP TO 12 TEAMS
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
  },
};