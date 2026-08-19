import {
  NextResponse,
} from "next/server";

import {
  createClient,
} from "@supabase/supabase-js";

export const dynamic =
  "force-dynamic";


/* =========================================================
   TYPES
========================================================= */

type NumberMap = {
  [key: string]: number;
};


type NormalizedPlayer = {
  espn_player_id: string;
  player_name: string | null;
  team_abbreviation: string | null;

  passing_attempts: number;
  passing_completions: number;
  passing_yards: number;
  passing_touchdowns: number;
  passing_interceptions: number;
  passing_two_point_conversions: number;

  rushing_attempts: number;
  rushing_yards: number;
  rushing_touchdowns: number;
  rushing_two_point_conversions: number;

  receiving_targets: number;
  receptions: number;
  receiving_yards: number;
  receiving_touchdowns: number;
  receiving_two_point_conversions: number;

  fumbles: number;
  fumbles_lost: number;

  field_goals_made: number;
  field_goals_attempted: number;

  extra_points_made: number;
  extra_points_attempted: number;

  kick_return_yards: number;
  kick_return_touchdowns: number;

  punt_return_yards: number;
  punt_return_touchdowns: number;

  field_goals_made_0_19: number;
  field_goals_made_20_29: number;
  field_goals_made_30_39: number;
  field_goals_made_40_49: number;
  field_goals_made_50_59: number;
  field_goals_made_60_plus: number;

  field_goals_missed_0_19: number;
  field_goals_missed_20_29: number;
  field_goals_missed_30_39: number;
  field_goals_missed_40_49: number;
  field_goals_missed_50_59: number;
  field_goals_missed_60_plus: number;
};


type DstAccumulator = {
  sacks: number;
  interceptions: number;
  fumbleRecoveries: number;

  touchdowns: number;

  safeties: number;
  blockedKicks: number;

  returnTouchdowns: number;

  extraPointReturns: number;

  pointsAllowed: number;
};


/* =========================================================
   SUPABASE
========================================================= */

function createSupabaseAdmin() {
  const supabaseUrl =
    process.env
      .NEXT_PUBLIC_SUPABASE_URL;

  const serviceRoleKey =
    process.env
      .SUPABASE_SERVICE_ROLE_KEY;

  if (
    !supabaseUrl ||
    !serviceRoleKey
  ) {
    throw new Error(
      "Missing Supabase environment variables."
    );
  }

  return createClient(
    supabaseUrl,
    serviceRoleKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  );
}


/* =========================================================
   BASIC HELPERS
========================================================= */

function toNumber(
  value:
    | string
    | number
    | null
    | undefined
) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return 0;
  }

  const parsed =
    Number(value);

  return Number.isFinite(
    parsed
  )
    ? parsed
    : 0;
}


function parseFraction(
  value:
    | string
    | null
    | undefined
) {
  if (!value) {
    return {
      made: 0,
      attempted: 0,
    };
  }

  const [
    made,
    attempted,
  ] =
    value.split("/");

  return {
    made:
      toNumber(made),

    attempted:
      toNumber(attempted),
  };
}


function getStat(
  labels: string[],
  stats: string[],
  wantedLabel: string
) {
  const wanted =
    wantedLabel
      .trim()
      .toUpperCase();

  const index =
    labels.findIndex(
      (label) =>
        label
          .trim()
          .toUpperCase() ===
        wanted
    );

  if (
    index < 0 ||
    index >=
      stats.length
  ) {
    return null;
  }

  return stats[index] ??
    null;
}


/* =========================================================
   PLAYER HELPERS
========================================================= */

function blankPlayer(
  espnPlayerId: string,
  playerName: string | null,
  teamAbbreviation: string | null
): NormalizedPlayer {
  return {
    espn_player_id:
      espnPlayerId,

    player_name:
      playerName,

    team_abbreviation:
      teamAbbreviation,

    passing_attempts: 0,
    passing_completions: 0,
    passing_yards: 0,
    passing_touchdowns: 0,
    passing_interceptions: 0,
    passing_two_point_conversions: 0,

    rushing_attempts: 0,
    rushing_yards: 0,
    rushing_touchdowns: 0,
    rushing_two_point_conversions: 0,

    receiving_targets: 0,
    receptions: 0,
    receiving_yards: 0,
    receiving_touchdowns: 0,
    receiving_two_point_conversions: 0,

    fumbles: 0,
    fumbles_lost: 0,

    field_goals_made: 0,
    field_goals_attempted: 0,

    extra_points_made: 0,
    extra_points_attempted: 0,

    kick_return_yards: 0,
    kick_return_touchdowns: 0,

    punt_return_yards: 0,
    punt_return_touchdowns: 0,

    field_goals_made_0_19: 0,
    field_goals_made_20_29: 0,
    field_goals_made_30_39: 0,
    field_goals_made_40_49: 0,
    field_goals_made_50_59: 0,
    field_goals_made_60_plus: 0,

    field_goals_missed_0_19: 0,
    field_goals_missed_20_29: 0,
    field_goals_missed_30_39: 0,
    field_goals_missed_40_49: 0,
    field_goals_missed_50_59: 0,
    field_goals_missed_60_plus: 0,
  };
}


function addFieldGoalBucket(
  player:
    NormalizedPlayer,
  distance:
    number,
  made:
    boolean
) {
  let suffix:
    | "0_19"
    | "20_29"
    | "30_39"
    | "40_49"
    | "50_59"
    | "60_plus";


  if (
    distance <= 19
  ) {
    suffix =
      "0_19";
  }

  else if (
    distance <= 29
  ) {
    suffix =
      "20_29";
  }

  else if (
    distance <= 39
  ) {
    suffix =
      "30_39";
  }

  else if (
    distance <= 49
  ) {
    suffix =
      "40_49";
  }

  else if (
    distance <= 59
  ) {
    suffix =
      "50_59";
  }

  else {
    suffix =
      "60_plus";
  }


  const key =
    `${
      made
        ? "field_goals_made"
        : "field_goals_missed"
    }_${suffix}`;


  const numericPlayer =
    player as unknown as
      NumberMap;


  numericPlayer[key] =
    toNumber(
      numericPlayer[key]
    ) + 1;
}


/* =========================================================
   ESPN REFERENCE HELPERS
========================================================= */

function extractIdFromRef(
  ref:
    | string
    | null
    | undefined
) {
  if (!ref) {
    return null;
  }

  const match =
    ref.match(
      /\/([^/?]+)(?:\?.*)?$/
    );

  return match?.[1] ??
    null;
}


function participantId(
  play: any,
  type: string
) {
  const participant =
    (
      play
        ?.participants ??
      []
    ).find(
      (
        item: any
      ) =>
        item?.type ===
        type
    );

  return extractIdFromRef(
    participant
      ?.athlete
      ?.$ref
  );
}


/* =========================================================
   TEAM HELPERS
========================================================= */

function getTeamAbbreviationFromEspnId(
  teamId:
    string | null,
  homeCompetitor:
    any,
  awayCompetitor:
    any
) {
  if (!teamId) {
    return null;
  }


  if (
    String(
      homeCompetitor
        ?.team
        ?.id ??
      ""
    ) ===
    String(teamId)
  ) {
    return (
      homeCompetitor
        ?.team
        ?.abbreviation ??
      null
    );
  }


  if (
    String(
      awayCompetitor
        ?.team
        ?.id ??
      ""
    ) ===
    String(teamId)
  ) {
    return (
      awayCompetitor
        ?.team
        ?.abbreviation ??
      null
    );
  }


  return null;
}


function getOpponentAbbreviation(
  scoringTeamAbbreviation:
    string | null,
  homeAbbreviation:
    string | null,
  awayAbbreviation:
    string | null
) {
  if (
    !scoringTeamAbbreviation
  ) {
    return null;
  }


  if (
    scoringTeamAbbreviation ===
    homeAbbreviation
  ) {
    return awayAbbreviation;
  }


  if (
    scoringTeamAbbreviation ===
    awayAbbreviation
  ) {
    return homeAbbreviation;
  }


  return null;
}


/* =========================================================
   DST CLASSIFICATION HELPERS
========================================================= */

function isDefensiveReturnTouchdown(
  typeText: string,
  combinedText: string
) {
  const type =
    typeText
      .toLowerCase();

  const text =
    combinedText
      .toLowerCase();


  const interceptionReturn =
    (
      type.includes(
        "interception"
      ) ||
      text.includes(
        "intercepted"
      )
    )
    &&
    (
      type.includes(
        "return"
      ) ||
      text.includes(
        "interception return"
      )
    );


  const fumbleReturn =
    (
      type.includes(
        "fumble recovery"
      ) ||
      text.includes(
        "fumble recovery"
      ) ||
      text.includes(
        "recovered by"
      )
    )
    &&
    (
      type.includes(
        "touchdown"
      ) ||
      text.includes(
        "touchdown"
      )
    );


  return (
    interceptionReturn ||
    fumbleReturn
  );
}


function isSpecialTeamsReturnTouchdown(
  typeText: string,
  combinedText: string
) {
  const type =
    typeText
      .toLowerCase();

  const text =
    combinedText
      .toLowerCase();


  const kickoffReturn =
    type.includes(
      "kickoff return"
    ) ||
    text.includes(
      "kickoff return"
    );


  const puntReturn =
    type.includes(
      "punt return"
    ) ||
    text.includes(
      "punt return"
    );


  return (
    kickoffReturn ||
    puntReturn
  );
}


/*
 * ESPN sometimes includes the PAT / two-point
 * conversion in the TD play text instead of
 * exposing it as a separate scoring play.
 *
 * Examples:
 *
 * "(Evan McPherson Kick)"
 *
 * "(Luke Altmyer Run for Two-Point Conversion)"
 */
function getEmbeddedConversionPoints(
  typeText: string,
  combinedText: string
) {
  const type =
    typeText
      .toLowerCase();

  const text =
    combinedText
      .toLowerCase();


  /*
   * Only look for embedded conversions
   * on TD plays.
   */
  const isTouchdown =
    type.includes(
      "touchdown"
    ) ||
    text.includes(
      "touchdown"
    );


  if (!isTouchdown) {
    return 0;
  }


  /*
   * Successful two-point conversion.
   */
  if (
    text.includes(
      "two-point conversion"
    ) ||
    text.includes(
      "two point conversion"
    )
  ) {
    if (
      text.includes(
        "failed"
      ) ||
      text.includes(
        "no good"
      )
    ) {
      return 0;
    }

    return 2;
  }


  /*
   * Successful PAT kick embedded in TD text.
   *
   * Avoid counting obvious misses.
   */
  if (
    text.includes(
      " kick)"
    ) ||
    text.includes(
      " kick )"
    )
  ) {
    if (
      text.includes(
        "no good"
      ) ||
      text.includes(
        "failed"
      ) ||
      text.includes(
        "blocked"
      )
    ) {
      return 0;
    }

    return 1;
  }


  return 0;
}


/* =========================================================
   ESPN FETCH
========================================================= */

async function fetchJson(
  url: string
) {
  const response =
    await fetch(
      url,
      {
        headers: {
          Accept:
            "application/json",

          "User-Agent":
            "Mozilla/5.0 Gridiron365/1.0",
        },

        cache:
          "no-store",
      }
    );


  const text =
    await response.text();


  if (
    !response.ok
  ) {
    throw new Error(
      `ESPN returned HTTP ${response.status}: ${text.slice(
        0,
        500
      )}`
    );
  }


  return JSON.parse(
    text
  );
}


/* =========================================================
   POST
========================================================= */

export async function POST(
  request: Request
) {
  try {

    const requestUrl =
      new URL(
        request.url
      );


    /* =====================================================
       AUTH
    ===================================================== */

    if (
      process.env.NODE_ENV ===
      "production"
    ) {
      const expectedSecret =
        process.env
          .NFL_SYNC_SECRET;


      const providedSecret =
        request.headers.get(
          "x-gridiron-sync-secret"
        );


      if (
        expectedSecret &&
        providedSecret !==
          expectedSecret
      ) {
        return NextResponse.json(
          {
            success: false,

            error:
              "Unauthorized sync request.",
          },
          {
            status: 401,
          }
        );
      }
    }


    /* =====================================================
       EVENT ID
    ===================================================== */

    let eventId =
      requestUrl
        .searchParams
        .get(
          "eventId"
        );


    if (!eventId) {
      try {
        const body =
          await request.json();

        eventId =
          body?.eventId ??
          null;
      } catch {
        /*
         * Body is optional.
         */
      }
    }


    if (
      !eventId ||
      !/^\d+$/.test(
        eventId
      )
    ) {
      return NextResponse.json(
        {
          success: false,

          error:
            "A valid numeric ESPN eventId is required.",
        },
        {
          status: 400,
        }
      );
    }


    const supabase =
      createSupabaseAdmin();


    /* =====================================================
       INTERNAL NFL GAME
    ===================================================== */

    const {
      data:
        nflGame,

      error:
        nflGameError,
    } =
      await supabase
        .from(
          "nfl_games"
        )
        .select(
          `
            id,
            espn_event_id,
            season,
            season_type,
            week,
            home_team_id,
            away_team_id
          `
        )
        .eq(
          "espn_event_id",
          eventId
        )
        .maybeSingle();


    if (
      nflGameError
    ) {
      throw new Error(
        `Unable to load NFL game: ${nflGameError.message}`
      );
    }


    if (!nflGame) {
      return NextResponse.json(
        {
          success: false,

          eventId,

          error:
            "This ESPN event is not stored in nfl_games.",
        },
        {
          status: 404,
        }
      );
    }


    /* =====================================================
       ESPN SUMMARY / BOX SCORE
    ===================================================== */

    const summaryUrl =
      `https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=${eventId}`;


    const summary =
      await fetchJson(
        summaryUrl
      );


    const competition =
      summary
        ?.header
        ?.competitions
        ?.[0];


    if (!competition) {
      throw new Error(
        "ESPN summary did not contain a competition."
      );
    }


    const statusState =
      competition
        ?.status
        ?.type
        ?.state ??
      null;


    const statusName =
      competition
        ?.status
        ?.type
        ?.name ??
      null;


    const statusDetail =
      competition
        ?.status
        ?.type
        ?.detail ??
      null;


    const completed =
      competition
        ?.status
        ?.type
        ?.completed ===
      true;


    const isLive =
      statusState ===
      "in";


    const competitors =
      competition
        ?.competitors ??
      [];


    const homeCompetitor =
      competitors.find(
        (
          item: any
        ) =>
          item?.homeAway ===
          "home"
      );


    const awayCompetitor =
      competitors.find(
        (
          item: any
        ) =>
          item?.homeAway ===
          "away"
      );


    const homeAbbreviation =
      homeCompetitor
        ?.team
        ?.abbreviation ??
      null;


    const awayAbbreviation =
      awayCompetitor
        ?.team
        ?.abbreviation ??
      null;


    const homeScore =
      toNumber(
        homeCompetitor
          ?.score
      );


    const awayScore =
      toNumber(
        awayCompetitor
          ?.score
      );


    /* =====================================================
       PLAYER + DST ACCUMULATORS
    ===================================================== */

    const playersByEspnId =
      new Map<
        string,
        NormalizedPlayer
      >();


    const dstByTeam =
      new Map<
        string,
        DstAccumulator
      >();


    const boxscorePlayerTeams =
      summary
        ?.boxscore
        ?.players ??
      [];


    /* =====================================================
       NORMALIZE BOX SCORE
    ===================================================== */

    for (
      const teamGroup
      of boxscorePlayerTeams
    ) {

      const teamAbbreviation =
        teamGroup
          ?.team
          ?.abbreviation ??
        null;


      if (
        teamAbbreviation
      ) {
        dstByTeam.set(
          teamAbbreviation,
          {
            sacks: 0,

            interceptions: 0,

            fumbleRecoveries: 0,

            touchdowns: 0,

            safeties: 0,

            blockedKicks: 0,

            returnTouchdowns: 0,

            extraPointReturns: 0,

            pointsAllowed: 0,
          }
        );
      }


      for (
        const category
        of teamGroup
          ?.statistics ??
        []
      ) {

        const categoryName =
          category?.name ??
          "";


        const labels =
          category?.labels ??
          [];


        for (
          const row
          of category
            ?.athletes ??
          []
        ) {

          const athleteId =
            row
              ?.athlete
              ?.id;


          if (!athleteId) {
            continue;
          }


          const athleteKey =
            String(
              athleteId
            );


          let player =
            playersByEspnId.get(
              athleteKey
            );


          if (!player) {
            player =
              blankPlayer(
                athleteKey,

                row
                  ?.athlete
                  ?.displayName ??
                row
                  ?.athlete
                  ?.fullName ??
                null,

                teamAbbreviation
              );


            playersByEspnId.set(
              athleteKey,
              player
            );
          }


          const stats =
            row?.stats ??
            [];


          /* ===============================================
             PASSING
          =============================================== */

          if (
            categoryName ===
            "passing"
          ) {

            const completionAttempt =
              getStat(
                labels,
                stats,
                "C/ATT"
              );


            if (
              completionAttempt
            ) {
              const [
                completions,
                attempts,
              ] =
                completionAttempt
                  .split("/");


              player
                .passing_completions =
                toNumber(
                  completions
                );


              player
                .passing_attempts =
                toNumber(
                  attempts
                );
            }


            player
              .passing_yards =
              toNumber(
                getStat(
                  labels,
                  stats,
                  "YDS"
                )
              );


            player
              .passing_touchdowns =
              toNumber(
                getStat(
                  labels,
                  stats,
                  "TD"
                )
              );


            player
              .passing_interceptions =
              toNumber(
                getStat(
                  labels,
                  stats,
                  "INT"
                )
              );
          }


          /* ===============================================
             RUSHING
          =============================================== */

          else if (
            categoryName ===
            "rushing"
          ) {

            player
              .rushing_attempts =
              toNumber(
                getStat(
                  labels,
                  stats,
                  "CAR"
                )
              );


            player
              .rushing_yards =
              toNumber(
                getStat(
                  labels,
                  stats,
                  "YDS"
                )
              );


            player
              .rushing_touchdowns =
              toNumber(
                getStat(
                  labels,
                  stats,
                  "TD"
                )
              );
          }


          /* ===============================================
             RECEIVING
          =============================================== */

          else if (
            categoryName ===
            "receiving"
          ) {

            player
              .receptions =
              toNumber(
                getStat(
                  labels,
                  stats,
                  "REC"
                )
              );


            player
              .receiving_yards =
              toNumber(
                getStat(
                  labels,
                  stats,
                  "YDS"
                )
              );


            player
              .receiving_touchdowns =
              toNumber(
                getStat(
                  labels,
                  stats,
                  "TD"
                )
              );


            player
              .receiving_targets =
              toNumber(
                getStat(
                  labels,
                  stats,
                  "TGTS"
                )
              );
          }


          /* ===============================================
             FUMBLES
          =============================================== */

          else if (
            categoryName ===
            "fumbles"
          ) {

            player
              .fumbles =
              toNumber(
                getStat(
                  labels,
                  stats,
                  "FUM"
                )
              );


            player
              .fumbles_lost =
              toNumber(
                getStat(
                  labels,
                  stats,
                  "LOST"
                )
              );
          }


          /* ===============================================
             KICK RETURNS
          =============================================== */

          else if (
            categoryName ===
            "kickReturns"
          ) {

            player
              .kick_return_yards =
              toNumber(
                getStat(
                  labels,
                  stats,
                  "YDS"
                )
              );


            player
              .kick_return_touchdowns =
              toNumber(
                getStat(
                  labels,
                  stats,
                  "TD"
                )
              );
          }


          /* ===============================================
             PUNT RETURNS
          =============================================== */

          else if (
            categoryName ===
            "puntReturns"
          ) {

            player
              .punt_return_yards =
              toNumber(
                getStat(
                  labels,
                  stats,
                  "YDS"
                )
              );


            player
              .punt_return_touchdowns =
              toNumber(
                getStat(
                  labels,
                  stats,
                  "TD"
                )
              );
          }


          /* ===============================================
             KICKING
          =============================================== */

          else if (
            categoryName ===
            "kicking"
          ) {

            const fg =
              parseFraction(
                getStat(
                  labels,
                  stats,
                  "FG"
                )
              );


            player
              .field_goals_made =
              fg.made;


            player
              .field_goals_attempted =
              fg.attempted;


            const xp =
              parseFraction(
                getStat(
                  labels,
                  stats,
                  "XP"
                )
              );


            player
              .extra_points_made =
              xp.made;


            player
              .extra_points_attempted =
              xp.attempted;
          }


          /* ===============================================
             DST SACKS
          =============================================== */

          else if (
            categoryName ===
              "defensive" &&
            teamAbbreviation
          ) {

            const dst =
              dstByTeam.get(
                teamAbbreviation
              );


            if (dst) {
              dst.sacks +=
                toNumber(
                  getStat(
                    labels,
                    stats,
                    "SACKS"
                  )
                );
            }
          }


          /* ===============================================
             DST INTERCEPTIONS
          =============================================== */

          else if (
            categoryName ===
              "interceptions" &&
            teamAbbreviation
          ) {

            const dst =
              dstByTeam.get(
                teamAbbreviation
              );


            if (dst) {
              dst.interceptions +=
                toNumber(
                  getStat(
                    labels,
                    stats,
                    "INT"
                  )
                );
            }
          }
        }
      }
    }


    /* =====================================================
       ESPN CORE PLAY-BY-PLAY
    ===================================================== */

    const playsUrl =
      `https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/events/${eventId}/competitions/${eventId}/plays?limit=500`;


    const playsResponse =
      await fetchJson(
        playsUrl
      );


    const plays =
      Array.isArray(
        playsResponse
          ?.items
      )
        ? playsResponse.items
        : [];


    /*
     * Rebuild DST points allowed from
     * actual scoring events.
     */
    for (
      const dst
      of dstByTeam.values()
    ) {
      dst.pointsAllowed =
        0;
    }


    for (
      const play
      of plays
    ) {

      const text =
        String(
          play?.text ??
          ""
        );


      const shortText =
        String(
          play?.shortText ??
          ""
        );


      const combinedText =
        `${text} ${shortText}`
          .toLowerCase();


      const typeText =
        String(
          play
            ?.type
            ?.text ??
          ""
        );


      const lowerType =
        typeText
          .toLowerCase();


      const teamId =
        extractIdFromRef(
          play
            ?.team
            ?.$ref
        );


      const scoringPlay =
        play
          ?.scoringPlay ===
        true;


      const scoreValue =
        toNumber(
          play
            ?.scoreValue
        );


      const scoringTeamAbbreviation =
        getTeamAbbreviationFromEspnId(
          teamId,
          homeCompetitor,
          awayCompetitor
        );


      const opponentAbbreviation =
        getOpponentAbbreviation(
          scoringTeamAbbreviation,
          homeAbbreviation,
          awayAbbreviation
        );


      const defensiveReturnTd =
        scoringPlay &&
        isDefensiveReturnTouchdown(
          typeText,
          combinedText
        );


      const specialTeamsReturnTd =
        scoringPlay &&
        isSpecialTeamsReturnTouchdown(
          typeText,
          combinedText
        );


      /* ===============================================
         FIELD GOAL DISTANCE BUCKETS
      =============================================== */

      const isNullified =
        combinedText.includes(
          "nullified"
        ) ||
        combinedText.includes(
          "no play"
        );


      const isFieldGoal =
        lowerType.includes(
          "field goal"
        ) ||
        combinedText.includes(
          "field goal"
        );


      if (
        isFieldGoal &&
        !isNullified
      ) {

        const kickerId =
          participantId(
            play,
            "kicker"
          );


        const distance =
          toNumber(
            play
              ?.statYardage
          );


        if (
          kickerId &&
          distance > 0
        ) {

          const kicker =
            playersByEspnId.get(
              kickerId
            );


          if (kicker) {

            const made =
              scoringPlay &&
              (
                lowerType.includes(
                  "good"
                ) ||
                combinedText.includes(
                  "field goal is good"
                ) ||
                combinedText.includes(
                  "yd field goal"
                )
              );


            addFieldGoalBucket(
              kicker,
              distance,
              made
            );
          }
        }
      }


      /* ===============================================
         TWO-POINT CONVERSIONS
      =============================================== */

      if (
        combinedText.includes(
          "two-point conversion"
        ) ||
        combinedText.includes(
          "two point conversion"
        )
      ) {

        const conversionFailed =
          combinedText.includes(
            "failed"
          ) ||
          combinedText.includes(
            "no good"
          );


        if (
          !conversionFailed
        ) {

          const patRusher =
            participantId(
              play,
              "patRusher"
            );


          const patPasser =
            participantId(
              play,
              "patPasser"
            );


          const patReceiver =
            participantId(
              play,
              "patReceiver"
            );


          if (
            patRusher
          ) {
            const player =
              playersByEspnId.get(
                patRusher
              );


            if (player) {
              player
                .rushing_two_point_conversions +=
                1;
            }
          }


          if (
            patPasser
          ) {
            const player =
              playersByEspnId.get(
                patPasser
              );


            if (player) {
              player
                .passing_two_point_conversions +=
                1;
            }
          }


          if (
            patReceiver
          ) {
            const player =
              playersByEspnId.get(
                patReceiver
              );


            if (player) {
              player
                .receiving_two_point_conversions +=
                1;
            }
          }
        }
      }


      /* ===============================================
         DST FUMBLE RECOVERIES
      =============================================== */

      if (
        lowerType ===
          "fumble recovery (opponent)"
      ) {

        if (
          scoringTeamAbbreviation
        ) {
          const dst =
            dstByTeam.get(
              scoringTeamAbbreviation
            );


          if (dst) {
            dst
              .fumbleRecoveries +=
              1;
          }
        }
      }


      /* ===============================================
         DST DEFENSIVE TOUCHDOWNS
      =============================================== */

      if (
        defensiveReturnTd &&
        scoringTeamAbbreviation
      ) {

        const dst =
          dstByTeam.get(
            scoringTeamAbbreviation
          );


        if (dst) {
          dst.touchdowns +=
            1;
        }
      }


      /* ===============================================
         DST RETURN TOUCHDOWNS
      =============================================== */

      if (
        specialTeamsReturnTd &&
        scoringTeamAbbreviation
      ) {

        const dst =
          dstByTeam.get(
            scoringTeamAbbreviation
          );


        if (dst) {
          dst
            .returnTouchdowns +=
            1;
        }
      }


      /* ===============================================
         DST SAFETIES
      =============================================== */

      if (
        scoringPlay &&
        scoringTeamAbbreviation &&
        (
          lowerType.includes(
            "safety"
          ) ||
          combinedText.includes(
            "safety"
          )
        )
      ) {

        const dst =
          dstByTeam.get(
            scoringTeamAbbreviation
          );


        if (dst) {
          dst.safeties +=
            1;
        }
      }


      /* ===============================================
         BLOCKED KICKS
      =============================================== */

      const blockedKick =
        (
          lowerType.includes(
            "blocked"
          ) &&
          (
            lowerType.includes(
              "field goal"
            ) ||
            lowerType.includes(
              "punt"
            ) ||
            lowerType.includes(
              "extra point"
            )
          )
        )
        ||
        (
          combinedText.includes(
            "blocked"
          ) &&
          (
            combinedText.includes(
              "field goal"
            ) ||
            combinedText.includes(
              "punt"
            ) ||
            combinedText.includes(
              "extra point"
            )
          )
        );


      if (
        blockedKick
      ) {

        /*
         * Usually play.team identifies
         * the kicking team.
         *
         * Credit the block to its opponent.
         */
        const blockingTeam =
          getOpponentAbbreviation(
            scoringTeamAbbreviation,
            homeAbbreviation,
            awayAbbreviation
          );


        if (
          blockingTeam
        ) {

          const dst =
            dstByTeam.get(
              blockingTeam
            );


          if (dst) {
            dst
              .blockedKicks +=
              1;
          }
        }
      }


      /* ===============================================
         DST POINTS ALLOWED
      =============================================== */

      if (
        scoringPlay &&
        opponentAbbreviation &&
        scoreValue > 0
      ) {

        const opponentDst =
          dstByTeam.get(
            opponentAbbreviation
          );


        /*
         * Pick-sixes and opponent fumble
         * return TDs are not charged to
         * the defense.
         */
        if (
          opponentDst &&
          !defensiveReturnTd
        ) {

          opponentDst
            .pointsAllowed +=
            scoreValue;


          /*
           * ESPN can embed the successful
           * PAT / 2-point conversion inside
           * the touchdown play.
           */
          opponentDst
            .pointsAllowed +=
            getEmbeddedConversionPoints(
              typeText,
              combinedText
            );
        }
      }
    }


    /* =====================================================
       MATCH ESPN PLAYERS TO INTERNAL PLAYERS
    ===================================================== */

    const normalizedPlayers =
      Array.from(
        playersByEspnId
          .values()
      );


    const espnPlayerIds =
      normalizedPlayers
        .map(
          (player) =>
            player
              .espn_player_id
        );


    const {
      data:
        internalPlayers,

      error:
        playerLookupError,
    } =
      await supabase
        .from(
          "nfl_players"
        )
        .select(
          `
            id,
            espn_player_id,
            full_name,
            primary_position,
            team_abbreviation
          `
        )
        .in(
          "espn_player_id",
          espnPlayerIds
        );


    if (
      playerLookupError
    ) {
      throw new Error(
        `Unable to match ESPN players: ${playerLookupError.message}`
      );
    }


    const internalByEspnId =
      new Map<
        string,
        any
      >();


    for (
      const player
      of internalPlayers ??
      []
    ) {
      internalByEspnId.set(
        String(
          player
            .espn_player_id
        ),
        player
      );
    }


    /* =====================================================
       UPSERT PLAYER STATS
    ===================================================== */

    let matchedPlayers =
      0;


    let unmatchedPlayers =
      0;


    let statsUpserted =
      0;


    const affectedInternalPlayerIds:
      number[] =
      [];


    const unmatched:
      Array<{
        espnPlayerId:
          string;

        name:
          string | null;

        team:
          string | null;
      }> =
      [];


    const now =
      new Date()
        .toISOString();


    for (
      const normalized
      of normalizedPlayers
    ) {

      const internal =
        internalByEspnId.get(
          normalized
            .espn_player_id
        );


      if (!internal) {

        unmatchedPlayers +=
          1;


        unmatched.push({
          espnPlayerId:
            normalized
              .espn_player_id,

          name:
            normalized
              .player_name,

          team:
            normalized
              .team_abbreviation,
        });


        continue;
      }


      matchedPlayers +=
        1;


      const payload = {

        nfl_game_id:
          nflGame.id,

        nfl_player_id:
          internal.id,

        season:
          nflGame.season,

        season_type:
          nflGame
            .season_type,

        week:
          nflGame.week,

        team_abbreviation:
          normalized
            .team_abbreviation,

        game_status:
          statusName,

        is_live:
          isLive,

        is_final:
          completed,


        /* PASSING */

        passing_attempts:
          normalized
            .passing_attempts,

        passing_completions:
          normalized
            .passing_completions,

        passing_yards:
          normalized
            .passing_yards,

        passing_touchdowns:
          normalized
            .passing_touchdowns,

        passing_interceptions:
          normalized
            .passing_interceptions,

        passing_two_point_conversions:
          normalized
            .passing_two_point_conversions,


        /* RUSHING */

        rushing_attempts:
          normalized
            .rushing_attempts,

        rushing_yards:
          normalized
            .rushing_yards,

        rushing_touchdowns:
          normalized
            .rushing_touchdowns,

        rushing_two_point_conversions:
          normalized
            .rushing_two_point_conversions,


        /* RECEIVING */

        receiving_targets:
          normalized
            .receiving_targets,

        receptions:
          normalized
            .receptions,

        receiving_yards:
          normalized
            .receiving_yards,

        receiving_touchdowns:
          normalized
            .receiving_touchdowns,

        receiving_two_point_conversions:
          normalized
            .receiving_two_point_conversions,


        /* FUMBLES */

        fumbles:
          normalized
            .fumbles,

        fumbles_lost:
          normalized
            .fumbles_lost,


        /* KICKING */

        field_goals_made:
          normalized
            .field_goals_made,

        field_goals_attempted:
          normalized
            .field_goals_attempted,

        extra_points_made:
          normalized
            .extra_points_made,

        extra_points_attempted:
          normalized
            .extra_points_attempted,


        /* RETURNS */

        kick_return_yards:
          normalized
            .kick_return_yards,

        kick_return_touchdowns:
          normalized
            .kick_return_touchdowns,

        punt_return_yards:
          normalized
            .punt_return_yards,

        punt_return_touchdowns:
          normalized
            .punt_return_touchdowns,


        /* FG DISTANCE BUCKETS */

        field_goals_made_0_19:
          normalized
            .field_goals_made_0_19,

        field_goals_made_20_29:
          normalized
            .field_goals_made_20_29,

        field_goals_made_30_39:
          normalized
            .field_goals_made_30_39,

        field_goals_made_40_49:
          normalized
            .field_goals_made_40_49,

        field_goals_made_50_59:
          normalized
            .field_goals_made_50_59,

        field_goals_made_60_plus:
          normalized
            .field_goals_made_60_plus,


        field_goals_missed_0_19:
          normalized
            .field_goals_missed_0_19,

        field_goals_missed_20_29:
          normalized
            .field_goals_missed_20_29,

        field_goals_missed_30_39:
          normalized
            .field_goals_missed_30_39,

        field_goals_missed_40_49:
          normalized
            .field_goals_missed_40_49,

        field_goals_missed_50_59:
          normalized
            .field_goals_missed_50_59,

        field_goals_missed_60_plus:
          normalized
            .field_goals_missed_60_plus,


        provider:
          "espn",

        provider_player_id:
          normalized
            .espn_player_id,

        provider_game_id:
          eventId,

        source_updated_at:
          now,

        last_synced_at:
          now,

        updated_at:
          now,
      };


      const {
        error:
          upsertError,
      } =
        await supabase
          .from(
            "nfl_player_game_stats"
          )
          .upsert(
            payload,
            {
              onConflict:
                "nfl_game_id,nfl_player_id",
            }
          );


      if (
        upsertError
      ) {
        throw new Error(
          `Unable to upsert ${
            normalized
              .player_name ??
            normalized
              .espn_player_id
          }: ${
            upsertError
              .message
          }`
        );
      }


      statsUpserted +=
        1;


      affectedInternalPlayerIds
        .push(
          internal.id
        );
    }


    /* =====================================================
       DST ROWS
    ===================================================== */

    const teamAbbreviations =
      Array.from(
        dstByTeam.keys()
      );


    const {
      data:
        dstPlayers,

      error:
        dstPlayerError,
    } =
      await supabase
        .from(
          "nfl_players"
        )
        .select(
          `
            id,
            full_name,
            team_abbreviation,
            primary_position
          `
        )
        .eq(
          "primary_position",
          "DST"
        )
        .in(
          "team_abbreviation",
          teamAbbreviations
        );


    if (
      dstPlayerError
    ) {
      throw new Error(
        `Unable to load DST players: ${dstPlayerError.message}`
      );
    }


    let dstRowsUpserted =
      0;


    for (
      const dstPlayer
      of dstPlayers ??
      []
    ) {

      const abbreviation =
        dstPlayer
          .team_abbreviation;


      const dst =
        dstByTeam.get(
          abbreviation
        );


      if (!dst) {
        continue;
      }


      const {
        error:
          dstUpsertError,
      } =
        await supabase
          .from(
            "nfl_player_game_stats"
          )
          .upsert(
            {
              nfl_game_id:
                nflGame.id,

              nfl_player_id:
                dstPlayer.id,

              season:
                nflGame.season,

              season_type:
                nflGame
                  .season_type,

              week:
                nflGame.week,

              team_abbreviation:
                abbreviation,

              game_status:
                statusName,

              is_live:
                isLive,

              is_final:
                completed,


              dst_sacks:
                dst.sacks,

              dst_interceptions:
                dst
                  .interceptions,

              dst_fumble_recoveries:
                dst
                  .fumbleRecoveries,

              dst_touchdowns:
                dst
                  .touchdowns,

              dst_safeties:
                dst
                  .safeties,

              dst_blocked_kicks:
                dst
                  .blockedKicks,

              dst_return_touchdowns:
                dst
                  .returnTouchdowns,

              dst_extra_point_returns:
                dst
                  .extraPointReturns,

              dst_points_allowed:
                dst
                  .pointsAllowed,


              provider:
                "espn",

              provider_game_id:
                eventId,

              source_updated_at:
                now,

              last_synced_at:
                now,

              updated_at:
                now,
            },
            {
              onConflict:
                "nfl_game_id,nfl_player_id",
            }
          );


      if (
        dstUpsertError
      ) {
        throw new Error(
          `Unable to upsert ${abbreviation} DST: ${dstUpsertError.message}`
        );
      }


      dstRowsUpserted +=
        1;


      affectedInternalPlayerIds
        .push(
          dstPlayer.id
        );
    }


    /* =====================================================
       UPDATE NFL GAME
    ===================================================== */

    const {
      error:
        gameUpdateError,
    } =
      await supabase
        .from(
          "nfl_games"
        )
        .update({
          home_score:
            homeScore,

          away_score:
            awayScore,

          status_name:
            statusName,

          status_detail:
            statusDetail,

          status_completed:
            completed,

          updated_at:
            now,
        })
        .eq(
          "id",
          nflGame.id
        );


    if (
      gameUpdateError
    ) {
      throw new Error(
        `Unable to update NFL game status: ${gameUpdateError.message}`
      );
    }


    /* =====================================================
       FIND AFFECTED WEEKLY LINEUPS
    ===================================================== */

    const uniquePlayerIds =
      Array.from(
        new Set(
          affectedInternalPlayerIds
        )
      );


    let fantasyScoresRefreshed =
      0;


    let matchupWeeksRefreshed =
      0;


    const affectedLeagueIds =
      new Set<string>();


    if (
      uniquePlayerIds.length >
      0
    ) {

      const {
        data:
          affectedLineups,

        error:
          lineupError,
      } =
        await supabase
          .from(
            "weekly_lineups"
          )
          .select(
            `
              league_id,
              player_id
            `
          )
          .eq(
            "season",
            nflGame.season
          )
          .eq(
            "week",
            nflGame.week
          )
          .in(
            "player_id",
            uniquePlayerIds
          );


      if (
        lineupError
      ) {
        throw new Error(
          `Unable to find affected lineups: ${lineupError.message}`
        );
      }


      const refreshedPairs =
        new Set<string>();


      for (
        const lineup
        of affectedLineups ??
        []
      ) {

        affectedLeagueIds
          .add(
            lineup.league_id
          );


        const pairKey =
          `${lineup.league_id}:${lineup.player_id}`;


        if (
          refreshedPairs.has(
            pairKey
          )
        ) {
          continue;
        }


        refreshedPairs.add(
          pairKey
        );


        const {
          data:
            statRow,

          error:
            statLookupError,
        } =
          await supabase
            .from(
              "nfl_player_game_stats"
            )
            .select(
              "id"
            )
            .eq(
              "nfl_game_id",
              nflGame.id
            )
            .eq(
              "nfl_player_id",
              lineup.player_id
            )
            .maybeSingle();


        if (
          statLookupError
        ) {
          throw new Error(
            `Unable to load player stat row: ${statLookupError.message}`
          );
        }


        if (!statRow) {
          continue;
        }


        const {
          error:
            scoringError,
        } =
          await supabase.rpc(
            "refresh_fantasy_player_game_score",
            {
              p_league_id:
                lineup
                  .league_id,

              p_player_game_stat_id:
                statRow.id,
            }
          );


        if (
          scoringError
        ) {
          throw new Error(
            `Unable to refresh fantasy score: ${scoringError.message}`
          );
        }


        fantasyScoresRefreshed +=
          1;
      }
    }


    /* =====================================================
       REFRESH AFFECTED MATCHUPS
    ===================================================== */

    for (
      const leagueId
      of affectedLeagueIds
    ) {

      const {
        error:
          matchupError,
      } =
        await supabase.rpc(
          "refresh_traditional_week_matchups",
          {
            p_league_id:
              leagueId,

            p_season:
              nflGame.season,

            p_week:
              nflGame.week,
          }
        );


      if (
        matchupError
      ) {
        throw new Error(
          `Unable to refresh league matchups: ${matchupError.message}`
        );
      }


      matchupWeeksRefreshed +=
        1;
    }


    /* =====================================================
       RESPONSE
    ===================================================== */

    return NextResponse.json({
      success: true,

      source:
        "ESPN",

      eventId,

      nflGameId:
        nflGame.id,

      season:
        nflGame.season,

      seasonType:
        nflGame
          .season_type,

      week:
        nflGame.week,


      game: {
        status:
          statusName,

        state:
          statusState,

        completed,

        isLive,

        homeScore,

        awayScore,
      },


      boxscore: {
        normalizedPlayers:
          normalizedPlayers
            .length,

        matchedPlayers,

        unmatchedPlayers,

        statsUpserted,

        dstRowsUpserted,
      },


      dst: {
        home:
          homeAbbreviation
            ? {
                team:
                  homeAbbreviation,

                ...dstByTeam.get(
                  homeAbbreviation
                ),
              }
            : null,

        away:
          awayAbbreviation
            ? {
                team:
                  awayAbbreviation,

                ...dstByTeam.get(
                  awayAbbreviation
                ),
              }
            : null,
      },


      fantasy: {
        fantasyScoresRefreshed,

        affectedLeagues:
          affectedLeagueIds
            .size,

        matchupWeeksRefreshed,
      },


      unmatchedPlayers:
        unmatched.slice(
          0,
          50
        ),
    });

  } catch (
    error
  ) {

    console.error(
      "ESPN live box score sync failed:",
      error
    );


    return NextResponse.json(
      {
        success: false,

        error:
          error instanceof Error
            ? error.message
            : "Unknown ESPN live scoring error.",
      },
      {
        status: 500,
      }
    );
  }
}