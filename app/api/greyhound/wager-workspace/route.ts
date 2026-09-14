import {
  NextResponse,
} from "next/server";

import {
  requireLeagueMember,
} from "@/lib/leagues/requireLeagueMember";

import {
  createSupabaseAdminClient,
} from "@/lib/supabase/admin";


export const dynamic =
  "force-dynamic";


type SettingsRow = {
  league_id: string;
  track_scope: string;
  duration_mode: string | null;
  competition_start_date: string | null;
  competition_end_date: string | null;
  competition_weeks: number | null;
  competition_days: number[] | null;
  starting_bankroll: number | string;
  allow_win: boolean;
  allow_place: boolean;
  allow_show: boolean;
  allow_exacta: boolean;
  allow_perfecta: boolean;
  allow_quinella: boolean;
  allow_trifecta: boolean;
  allow_superfecta: boolean;
};


type TrackRow = {
  id: number;
  code: string;
  name: string | null;
};


type CardRow = {
  id: number;
  track_id: number;
  race_date: string;
  session: string;
  scheduled_first_post: string | null;
  card_status: string;
  lock_at: string | null;
  commissioner_confirmed_at: string | null;
};


type RaceRow = {
  id: number;
  card_id: number;
  race_number: number;
  grade: string | null;
  distance_yards: number | null;
  scheduled_post_time: string | null;
  actual_post_time: string | null;
  race_status: string;
};


type EntryRow = {
  id: number;
  race_id: number;
  dog_id: number | null;
  box_number: number;
  morning_line_odds: string | null;
  morning_line_decimal: number | string | null;
  kennel: string | null;
  trainer: string | null;
  weight: number | string | null;
  entry_status: string;
};


type DogRow = {
  id: number;
  display_name: string;
};


function jsonError(
  error: string,
  status: number
) {
  return NextResponse.json(
    {
      success: false,
      error,
    },
    {
      status,
    }
  );
}


function allowedTrackCodes(
  scopeValue: unknown
) {
  const scope =
    String(
      scopeValue ??
      "wheeling"
    )
      .trim()
      .toLowerCase();

  if (
    [
      "tri_state",
      "tri-state",
      "tri state",
      "tristate",
    ].includes(
      scope
    )
  ) {
    return [
      "GTS",
    ];
  }

  if (
    [
      "all",
      "both",
    ].includes(
      scope
    )
  ) {
    return [
      "GWD",
      "GTS",
    ];
  }

  return [
    "GWD",
  ];
}


function numberValue(
  value: unknown,
  fallback = 0
) {
  const parsed =
    Number(
      value
    );

  return Number.isFinite(
    parsed
  )
    ? parsed
    : fallback;
}


function normalizeCompetitionDays(
  value: unknown
) {
  if (!Array.isArray(value)) {
    return [0, 1, 2, 3, 4, 5, 6];
  }

  const days =
    Array.from(
      new Set(
        value
          .map((day) => Number(day))
          .filter(
            (day) =>
              Number.isInteger(day) &&
              day >= 0 &&
              day <= 6
          )
      )
    ).sort((a, b) => a - b);

  return days.length > 0
    ? days
    : [0, 1, 2, 3, 4, 5, 6];
}


export async function GET(
  request: Request
) {
  try {
    const url =
      new URL(
        request.url
      );

    const leagueId =
      (
        url.searchParams.get(
          "leagueId"
        ) ??
        ""
      ).trim();


    if (!leagueId) {
      return jsonError(
        "leagueId is required.",
        400
      );
    }


    const requestedTrackCodeRaw =
      (url.searchParams.get("track") ?? "").trim().toUpperCase();

    const requestedTrackCode =
      requestedTrackCodeRaw === "GWD" || requestedTrackCodeRaw === "GTS"
        ? requestedTrackCodeRaw
        : null;

    if (requestedTrackCodeRaw && !requestedTrackCode) {
      return jsonError("track must be GWD or GTS.", 400);
    }

    const requestedDateRaw =
      (url.searchParams.get("date") ?? "").trim();

    const requestedDate =
      /^\d{4}-\d{2}-\d{2}$/.test(requestedDateRaw)
        ? requestedDateRaw
        : null;

    if (requestedDateRaw && !requestedDate) {
      return jsonError("date must use YYYY-MM-DD format.", 400);
    }


    const access =
      await requireLeagueMember(
        leagueId
      );


    if (
      String(
        access.league.leagueType
      ) !==
      "greyhound"
    ) {
      return jsonError(
        "This endpoint is only available for Greyhound leagues.",
        400
      );
    }


    const admin =
      createSupabaseAdminClient();


    const {
      data:
        settingsData,
      error:
        settingsError,
    } =
      await admin
        .from(
          "greyhound_league_settings"
        )
        .select(`
          league_id,
          track_scope,
          duration_mode,
          competition_start_date,
          competition_end_date,
          competition_weeks,
          competition_days,
          starting_bankroll,
          allow_win,
          allow_place,
          allow_show,
          allow_exacta,
          allow_perfecta,
          allow_quinella,
          allow_trifecta,
          allow_superfecta
        `)
        .eq(
          "league_id",
          leagueId
        )
        .maybeSingle();


    if (settingsError) {
      return jsonError(
        settingsError.message,
        500
      );
    }


    if (!settingsData) {
      return jsonError(
        "Greyhound league settings were not found.",
        404
      );
    }


    const settings =
      settingsData as SettingsRow;

    const competitionDays =
      normalizeCompetitionDays(
        settings.competition_days
      );

    const settingsPayload = {
      trackScope:
        settings.track_scope,
      durationMode:
        settings.duration_mode ??
        "single_day",
      competitionStartDate:
        settings.competition_start_date,
      competitionEndDate:
        settings.competition_end_date,
      competitionWeeks:
        settings.competition_weeks,
      competitionDays,
      startingBankroll:
        numberValue(
          settings.starting_bankroll,
          100
        ),
      allowedWagers: {
        win: Boolean(settings.allow_win),
        place: Boolean(settings.allow_place),
        show: Boolean(settings.allow_show),
        exacta: Boolean(settings.allow_exacta),
        perfecta: Boolean(settings.allow_perfecta),
        quinella: Boolean(settings.allow_quinella),
        trifecta: Boolean(settings.allow_trifecta),
        superfecta: Boolean(settings.allow_superfecta),
      },
    };

    // Betting-card selection is independent from the legacy league track_scope.
    // Members pick a racing date, then select Wheeling or Tri-State for that date.
    const {
      data:
        tracksData,
      error:
        tracksError,
    } =
      await admin
        .from(
          "greyhound_tracks"
        )
        .select(
          "id, code, name"
        )
        .in(
          "code",
          ["GWD", "GTS"]
        )
        .eq(
          "active",
          true
        );


    if (tracksError) {
      return jsonError(
        tracksError.message,
        500
      );
    }


    const tracks =
      (
        tracksData ??
        []
      ) as TrackRow[];

    const selectableTracks = requestedTrackCode
      ? tracks.filter(
          (track) =>
            String(track.code).toUpperCase() ===
            requestedTrackCode
        )
      : tracks;


    if (
      selectableTracks.length ===
      0
    ) {
      return NextResponse.json({
        success: true,
        league: {
          id:
            leagueId,
          name:
            access.league.name,
        },
        settings: settingsPayload,
        availableCards: [],
        completedRacingDates: [],
        card: null,
        races: [],
        bankroll: null,
        message:
          "No active Greyhound track is available.",
      });
    }


    const trackIds =
      tracks.map(
        (
          track
        ) =>
          Number(
            track.id
          )
      );


    const {
      data:
        cardsData,
      error:
        cardsError,
    } =
      await admin
        .from(
          "greyhound_cards"
        )
        .select(`
          id,
          track_id,
          race_date,
          session,
          scheduled_first_post,
          card_status,
          lock_at,
          commissioner_confirmed_at
        `)
        .in(
          "track_id",
          trackIds
        )
        .not(
          "commissioner_confirmed_at",
          "is",
          null
        )
        .order(
          "race_date",
          {
            ascending:
              false,
          }
        )
        .order(
          "id",
          {
            ascending:
              false,
          }
        )
        .limit(
          120
        );


    if (cardsError) {
      return jsonError(
        cardsError.message,
        500
      );
    }


    const allConfirmedCards =
      (
        cardsData ??
        []
      ) as CardRow[];

    const cardsByDate =
      new Map<string, CardRow[]>();

    for (const card of allConfirmedCards) {
      const bucket =
        cardsByDate.get(card.race_date) ??
        [];

      bucket.push(card);
      cardsByDate.set(card.race_date, bucket);
    }

    const completedRacingDates =
      Array.from(cardsByDate.entries())
        .filter(([, cards]) =>
          cards.length > 0 &&
          cards.every((card) =>
            ["final", "cancelled"].includes(
              String(card.card_status)
            )
          )
        )
        .map(([raceDate]) => raceDate)
        .sort();

    const candidateCards =
      allConfirmedCards.filter(
        (card) =>
          !["final", "cancelled"].includes(
            String(card.card_status)
          )
      );

    const availableCards =
      candidateCards.map(
        (card) => {
          const track =
            tracks.find(
              (item) =>
                Number(item.id) ===
                Number(card.track_id)
            ) ?? null;

          return {
            id:
              Number(card.id),
            raceDate:
              card.race_date,
            session:
              card.session,
            cardStatus:
              card.card_status,
            scheduledFirstPost:
              card.scheduled_first_post,
            lockAt:
              card.lock_at,
            track: track
              ? {
                  id:
                    Number(track.id),
                  code:
                    track.code,
                  name:
                    track.name,
                }
              : null,
          };
        }
      );


    if (
      candidateCards.length ===
      0
    ) {
      return NextResponse.json({
        success: true,
        league: {
          id:
            leagueId,
          name:
            access.league.name,
        },
        settings: settingsPayload,
        availableCards,
        completedRacingDates,
        card: null,
        races: [],
        bankroll: null,
        message:
          "No confirmed active Greyhound race card is available yet.",
      });
    }


    const candidateCardIds =
      candidateCards.map(
        (
          card
        ) =>
          Number(
            card.id
          )
      );


    const {
      data:
        candidateRacesData,
      error:
        candidateRacesError,
    } =
      await admin
        .from(
          "greyhound_races"
        )
        .select(`
          id,
          card_id,
          race_number,
          grade,
          distance_yards,
          scheduled_post_time,
          actual_post_time,
          race_status
        `)
        .in(
          "card_id",
          candidateCardIds
        )
        .order(
          "race_number",
          {
            ascending:
              true,
          }
        );


    if (
      candidateRacesError
    ) {
      return jsonError(
        candidateRacesError.message,
        500
      );
    }


    const candidateRaces =
      (
        candidateRacesData ??
        []
      ) as RaceRow[];


    const eligibleCards =
      candidateCards.filter(
        (card) => {
          if (
            requestedDate &&
            card.race_date !==
              requestedDate
          ) {
            return false;
          }

          if (
            requestedTrackCode
          ) {
            const cardTrack =
              tracks.find(
                (track) =>
                  Number(track.id) ===
                    Number(card.track_id)
              );

            if (
              String(
                cardTrack?.code ??
                  ""
              ).toUpperCase() !==
              requestedTrackCode
            ) {
              return false;
            }
          }

          return true;
        }
      );

    // After a date is chosen, wait for a track choice instead of silently
    // falling back to one track.
    if (
      requestedDate &&
      !requestedTrackCode
    ) {
      return NextResponse.json(
        {
          success:
            true,
          league: {
            id:
              leagueId,
            name:
              access.league.name,
          },
          settings: settingsPayload,
          availableCards,
          completedRacingDates,
          selectedDate:
            requestedDate,
          card:
            null,
          bankroll:
            null,
          races:
            [],
          message:
            eligibleCards.length > 0
              ? "Choose a track for this racing date."
              : "No confirmed active Greyhound card is available for this date.",
        },
        {
          headers: {
            "Cache-Control":
              "no-store, max-age=0",
          },
        }
      );
    }

    if (
      eligibleCards.length ===
      0
    ) {
      return NextResponse.json(
        {
          success:
            true,
          league: {
            id:
              leagueId,
            name:
              access.league.name,
          },
          settings: settingsPayload,
          availableCards,
          completedRacingDates,
          selectedDate:
            requestedDate,
          card:
            null,
          bankroll:
            null,
          races:
            [],
          message:
            "No confirmed active Greyhound card matches that date and track.",
        },
        {
          headers: {
            "Cache-Control":
              "no-store, max-age=0",
          },
        }
      );
    }

    const selectedCard =
      eligibleCards.find(
        (
          card
        ) => {
          const cardRaces =
            candidateRaces.filter(
              (
                race
              ) =>
                Number(
                  race.card_id
                ) ===
                Number(
                  card.id
                )
            );

          /*
           * Delay-safe card selection:
           *
           * Do not reject a race/card because scheduled_post_time is in the
           * past. A delayed live race can legitimately be scheduled/upcoming
           * after its published time.
           *
           * The card-level lock/card status is the wagering authority.
           */
          return cardRaces.some(
            (
              race
            ) =>
              [
                "scheduled",
                "upcoming",
              ].includes(
                String(
                  race.race_status
                )
              )
          );
        }
      ) ??
      eligibleCards[0];


    const selectedTrack =
      tracks.find(
        (
          track
        ) =>
          Number(
            track.id
          ) ===
          Number(
            selectedCard.track_id
          )
      ) ??
      null;


    const races =
      candidateRaces.filter(
        (
          race
        ) =>
          Number(
            race.card_id
          ) ===
          Number(
            selectedCard.id
          )
      );


    const raceIds =
      races.map(
        (
          race
        ) =>
          Number(
            race.id
          )
      );


    let entries:
      EntryRow[] =
        [];


    if (
      raceIds.length >
      0
    ) {
      const {
        data:
          entriesData,
        error:
          entriesError,
      } =
        await admin
          .from(
            "greyhound_entries"
          )
          .select(`
            id,
            race_id,
            dog_id,
            box_number,
            morning_line_odds,
            morning_line_decimal,
            kennel,
            trainer,
            weight,
            entry_status
          `)
          .in(
            "race_id",
            raceIds
          )
          .order(
            "box_number",
            {
              ascending:
                true,
            }
          );


      if (entriesError) {
        return jsonError(
          entriesError.message,
          500
        );
      }


      entries =
        (
          entriesData ??
          []
        ) as EntryRow[];
    }


    const dogIds =
      Array.from(
        new Set(
          entries
            .map(
              (
                entry
              ) =>
                entry.dog_id
            )
            .filter(
              (
                dogId
              ):
                dogId is number =>
                  typeof dogId ===
                    "number" &&
                  dogId >
                    0
            )
        )
      );


    const dogsById =
      new Map<
        number,
        string
      >();


    if (
      dogIds.length >
      0
    ) {
      const {
        data:
          dogsData,
        error:
          dogsError,
      } =
        await admin
          .from(
            "greyhound_dogs"
          )
          .select(
            "id, display_name"
          )
          .in(
            "id",
            dogIds
          );


      if (dogsError) {
        return jsonError(
          dogsError.message,
          500
        );
      }


      for (
        const dog
        of (
          dogsData ??
          []
        ) as DogRow[]
      ) {
        dogsById.set(
          Number(
            dog.id
          ),
          String(
            dog.display_name
          )
        );
      }
    }


    const {
      data:
        bankrollCardId,
      error:
        bankrollInitError,
    } =
      await admin.rpc(
        "ensure_greyhound_bankroll_card",
        {
          p_league_id:
            leagueId,
          p_user_id:
            access.userId,
          p_racing_card_id:
            Number(
              selectedCard.id
            ),
        }
      );


    if (
      bankrollInitError
    ) {
      return jsonError(
        bankrollInitError.message,
        500
      );
    }


    const {
      data:
        bankrollData,
      error:
        bankrollError,
    } =
      await admin
        .from(
          "greyhound_bankroll_cards"
        )
        .select(`
          id,
          starting_bankroll,
          amount_allocated,
          amount_unallocated,
          official_return,
          card_status
        `)
        .eq(
          "id",
          Number(
            bankrollCardId
          )
        )
        .eq(
          "league_id",
          leagueId
        )
        .maybeSingle();


    if (bankrollError) {
      return jsonError(
        bankrollError.message,
        500
      );
    }


    const entriesByRace =
      new Map<
        number,
        EntryRow[]
      >();


    for (
      const entry
      of entries
    ) {
      const raceId =
        Number(
          entry.race_id
        );

      const bucket =
        entriesByRace.get(
          raceId
        ) ??
        [];

      bucket.push(
        entry
      );

      entriesByRace.set(
        raceId,
        bucket
      );
    }


    const racePayload =
      races.map(
        (
          race
        ) => ({
          id:
            Number(
              race.id
            ),
          raceNumber:
            Number(
              race.race_number
            ),
          grade:
            race.grade,
          distanceYards:
            race.distance_yards,
          scheduledPostTime:
            race.scheduled_post_time,
          actualPostTime:
            race.actual_post_time,
          raceStatus:
            String(
              race.race_status
            ),
          entries:
            (
              entriesByRace.get(
                Number(
                  race.id
                )
              ) ??
              []
            ).map(
              (
                entry
              ) => ({
                id:
                  Number(
                    entry.id
                  ),
                dogId:
                  entry.dog_id ===
                  null
                    ? null
                    : Number(
                        entry.dog_id
                      ),
                dogName:
                  entry.dog_id ===
                  null
                    ? null
                    : dogsById.get(
                        Number(
                          entry.dog_id
                        )
                      ) ??
                      null,
                boxNumber:
                  Number(
                    entry.box_number
                  ),
                morningLineOdds:
                  entry.morning_line_odds,
                morningLineDecimal:
                  entry.morning_line_decimal ===
                  null
                    ? null
                    : numberValue(
                        entry.morning_line_decimal,
                        0
                      ),
                kennel:
                  entry.kennel,
                trainer:
                  entry.trainer,
                weight:
                  entry.weight ===
                  null
                    ? null
                    : numberValue(
                        entry.weight,
                        0
                      ),
                entryStatus:
                  String(
                    entry.entry_status
                  ),
              })
            ),
        })
      );


    return NextResponse.json(
      {
        success:
          true,
        league: {
          id:
            leagueId,
          name:
            access.league.name,
        },
        settings: settingsPayload,
        availableCards,
        completedRacingDates,
        selectedDate:
          selectedCard.race_date,
        card: {
          id:
            Number(
              selectedCard.id
            ),
          raceDate:
            selectedCard.race_date,
          session:
            selectedCard.session,
          cardStatus:
            selectedCard.card_status,
          scheduledFirstPost:
            selectedCard.scheduled_first_post,
          lockAt:
            selectedCard.lock_at,
          track: selectedTrack
            ? {
                id:
                  Number(
                    selectedTrack.id
                  ),
                code:
                  selectedTrack.code,
                name:
                  selectedTrack.name,
              }
            : null,
        },
        bankroll:
          bankrollData
            ? {
                id:
                  Number(
                    bankrollData.id
                  ),
                startingBankroll:
                  numberValue(
                    bankrollData.starting_bankroll,
                    0
                  ),
                amountAllocated:
                  numberValue(
                    bankrollData.amount_allocated,
                    0
                  ),
                amountUnallocated:
                  numberValue(
                    bankrollData.amount_unallocated,
                    0
                  ),
                officialReturn:
                  numberValue(
                    bankrollData.official_return,
                    0
                  ),
                cardStatus:
                  String(
                    bankrollData.card_status
                  ),
              }
            : null,
        races:
          racePayload,
      },
      {
        headers: {
          "Cache-Control":
            "no-store, max-age=0",
        },
      }
    );
  } catch (
    error
  ) {
    console.error(
      "Greyhound wager workspace failed:",
      error
    );

    return jsonError(
      error instanceof Error
        ? error.message
        : "Unable to load the Greyhound wager workspace.",
      500
    );
  }
}