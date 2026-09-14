"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import GreyhoundDogProfileModal from "@/components/greyhound/GreyhoundDogProfileModal";
import GreyhoundMyWagers from "@/components/greyhound/wagers/GreyhoundMyWagers";
import GreyhoundDailySurvivorPanel from "@/components/greyhound/wagers/GreyhoundDailySurvivorPanel";
import styles from "./GreyhoundWagerWorkspace.module.css";


type BaseWagerType =
  | "win"
  | "place"
  | "show"
  | "exacta"
  | "quinella"
  | "trifecta"
  | "superfecta";


type WagerType =
  | BaseWagerType
  | "win_place"
  | "win_show"
  | "place_show";


type WagerStructure =
  | "straight"
  | "key"
  | "box";


type Entry = {
  id: number;
  dogId: number | null;
  dogName: string | null;
  boxNumber: number;
  morningLineOdds: string | null;
  morningLineDecimal: number | null;
  kennel: string | null;
  trainer: string | null;
  weight: number | null;
  entryStatus: string;
};


type Race = {
  id: number;
  raceNumber: number;
  grade: string | null;
  distanceYards: number | null;
  scheduledPostTime: string | null;
  actualPostTime: string | null;
  raceStatus: string;
  entries: Entry[];
};


type AvailableCard = {
  id: number;
  raceDate: string;
  session: string;
  cardStatus: string;
  scheduledFirstPost: string | null;
  lockAt: string | null;
  track: {
    id: number;
    code: string;
    name: string | null;
  } | null;
};


type WorkspaceData = {
  success: boolean;
  error?: string;
  message?: string;
  league?: {
    id: string;
    name: string;
  };
  settings?: {
    trackScope: string;
    durationMode?: string;
    competitionStartDate?: string | null;
    competitionEndDate?: string | null;
    competitionWeeks?: number | null;
    competitionDays?: number[];
    startingBankroll: number;
    allowedWagers: Partial<Record<string, boolean>>;
  };
  card?: {
    id: number;
    raceDate: string;
    session: string;
    cardStatus: string;
    scheduledFirstPost: string | null;
    lockAt: string | null;
    track: {
      id: number;
      code: string;
      name: string | null;
    } | null;
  } | null;
  availableCards?: AvailableCard[];
  completedRacingDates?: string[];
  selectedDate?: string | null;
  bankroll?: {
    id: number;
    startingBankroll: number;
    amountAllocated: number;
    amountUnallocated: number;
    officialReturn: number;
    cardStatus: string;
  } | null;
  races?: Race[];
};


type Props = {
  leagueId: string;
};


const WAGER_LABELS: Record<WagerType, string> = {
  win: "Win",
  place: "Place",
  show: "Show",
  win_place: "Win + Place",
  win_show: "Win + Show",
  place_show: "Place + Show",
  exacta: "Exacta",
  quinella: "Quinella",
  trifecta: "Trifecta",
  superfecta: "Superfecta",
};


const LEG_COUNTS: Record<WagerType, number> = {
  win: 1,
  place: 1,
  show: 1,
  win_place: 1,
  win_show: 1,
  place_show: 1,
  exacta: 2,
  quinella: 2,
  trifecta: 3,
  superfecta: 4,
};


const DENOMINATIONS: Record<WagerType, number[]> = {
  win: [2, 5, 10, 20],
  place: [2, 5, 10, 20],
  show: [2, 5, 10, 20],
  win_place: [2, 5, 10, 20],
  win_show: [2, 5, 10, 20],
  place_show: [2, 5, 10, 20],
  exacta: [1, 2, 3, 6, 10, 20],
  quinella: [1, 2, 3, 6, 10, 20],
  trifecta: [0.5, 1, 2, 5, 10],
  superfecta: [0.1, 0.2, 0.5, 1, 2],
};


const MIN_DENOMINATION: Record<WagerType, number> = {
  win: 2,
  place: 2,
  show: 2,
  win_place: 2,
  win_show: 2,
  place_show: 2,
  exacta: 1,
  quinella: 1,
  trifecta: 0.5,
  superfecta: 0.1,
};


const COMBINED_WAGER_PARTS: Partial<Record<WagerType, BaseWagerType[]>> = {
  win_place: ["win", "place"],
  win_show: ["win", "show"],
  place_show: ["place", "show"],
};


const STRAIGHT_WAGERS: WagerType[] = [
  "win",
  "place",
  "show",
  "win_place",
  "win_show",
  "place_show",
];


function isStraightWager(type: WagerType) {
  return STRAIGHT_WAGERS.includes(type);
}


function isWagerAllowed(
  type: WagerType,
  allowed: Partial<Record<string, boolean>> | undefined
) {
  if (!allowed) {
    return false;
  }

  const combined = COMBINED_WAGER_PARTS[type];

  if (combined) {
    return combined.every((part) => Boolean(allowed[part]));
  }

  return Boolean(allowed[type]);
}


function money(
  value:
    number
) {
  return new Intl.NumberFormat(
    "en-US",
    {
      style:
        "currency",
      currency:
        "USD",
      minimumFractionDigits:
        2,
      maximumFractionDigits:
        2,
    }
  ).format(
    value
  );
}


function dateLabel(
  value:
    string | null | undefined
) {
  if (!value) {
    return "TBD";
  }

  const parsed =
    new Date(
      value
    );

  if (
    Number.isNaN(
      parsed.getTime()
    )
  ) {
    return value;
  }

  return parsed.toLocaleString(
    undefined,
    {
      month:
        "short",
      day:
        "numeric",
      hour:
        "numeric",
      minute:
        "2-digit",
    }
  );
}


function dateOnlyLabel(
  value:
    string | null | undefined
) {
  if (!value) {
    return "";
  }

  const parsed =
    new Date(
      `${value}T12:00:00`
    );

  if (
    Number.isNaN(
      parsed.getTime()
    )
  ) {
    return value;
  }

  return parsed.toLocaleDateString(
    undefined,
    {
      weekday:
        "short",
      month:
        "short",
      day:
        "numeric",
      year:
        "numeric",
    }
  );
}


function easternTodayIsoDate() {
  const parts =
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone:
          "America/New_York",
        year:
          "numeric",
        month:
          "2-digit",
        day:
          "2-digit",
      }
    ).formatToParts(
      new Date()
    );

  const year =
    parts.find(
      (part) =>
        part.type === "year"
    )?.value ?? "";

  const month =
    parts.find(
      (part) =>
        part.type === "month"
    )?.value ?? "";

  const day =
    parts.find(
      (part) =>
        part.type === "day"
    )?.value ?? "";

  return year && month && day
    ? `${year}-${month}-${day}`
    : new Date()
        .toISOString()
        .slice(0, 10);
}


function parseCompetitionDate(
  value: string
) {
  const parsed =
    new Date(
      `${value}T12:00:00Z`
    );

  return Number.isNaN(
    parsed.getTime()
  )
    ? null
    : parsed;
}


function normalizedCompetitionDays(
  settings:
    WorkspaceData["settings"]
) {
  const raw =
    settings?.competitionDays;

  if (!Array.isArray(raw)) {
    return [
      0, 1, 2, 3, 4, 5, 6,
    ];
  }

  const days =
    Array.from(
      new Set(
        raw
          .map((day) =>
            Number(day)
          )
          .filter(
            (day) =>
              Number.isInteger(day) &&
              day >= 0 &&
              day <= 6
          )
      )
    ).sort(
      (a, b) =>
        a - b
    );

  return days.length > 0
    ? days
    : [
        0, 1, 2, 3, 4, 5, 6,
      ];
}


function addCompetitionDays(
  value: string,
  days: number
) {
  const parsed =
    parseCompetitionDate(
      value
    );

  if (!parsed) {
    return value;
  }

  parsed.setUTCDate(
    parsed.getUTCDate() +
      days
  );

  return parsed
    .toISOString()
    .slice(0, 10);
}


function isCompetitionDate(
  value: string,
  settings:
    WorkspaceData["settings"]
) {
  const parsed =
    parseCompetitionDate(
      value
    );

  if (!parsed) {
    return false;
  }

  const startDate =
    settings
      ?.competitionStartDate ??
    null;

  const endDate =
    settings
      ?.competitionEndDate ??
    null;

  const durationMode =
    String(
      settings
        ?.durationMode ??
        ""
    ).toLowerCase();

  if (
    durationMode ===
      "single_day" &&
    startDate
  ) {
    return value ===
      startDate;
  }

  if (
    startDate &&
    value < startDate
  ) {
    return false;
  }

  if (
    endDate &&
    value > endDate
  ) {
    return false;
  }

  return normalizedCompetitionDays(
    settings
  ).includes(
    parsed.getUTCDay()
  );
}


function currentOrNextCompetitionDate(
  value: string,
  settings:
    WorkspaceData["settings"]
) {
  const startDate =
    settings
      ?.competitionStartDate ??
    null;

  const durationMode =
    String(
      settings
        ?.durationMode ??
        ""
    ).toLowerCase();

  if (
    durationMode ===
      "single_day" &&
    startDate
  ) {
    return startDate;
  }

  let candidate =
    startDate &&
    value < startDate
      ? startDate
      : value;

  for (
    let offset = 0;
    offset < 370;
    offset += 1
  ) {
    if (
      isCompetitionDate(
        candidate,
        settings
      )
    ) {
      return candidate;
    }

    candidate =
      addCompetitionDays(
        candidate,
        1
      );
  }

  return candidate;
}


function nextCompetitionDate(
  value: string,
  settings:
    WorkspaceData["settings"]
) {
  let candidate =
    addCompetitionDays(
      value,
      1
    );

  for (
    let offset = 0;
    offset < 370;
    offset += 1
  ) {
    if (
      isCompetitionDate(
        candidate,
        settings
      )
    ) {
      return candidate;
    }

    candidate =
      addCompetitionDays(
        candidate,
        1
      );
  }

  return candidate;
}


function displayRaceStatus(
  raceStatus: string,
  cardStatus:
    string |
    null |
    undefined
) {
  if (
    String(
      cardStatus ?? ""
    ).toLowerCase() ===
      "final" &&
    raceStatus.toLowerCase() ===
      "off"
  ) {
    return "official";
  }

  return raceStatus;
}


function permutations(
  values:
    number[],
  length:
    number
): number[][] {
  if (
    length ===
    1
  ) {
    return values.map(
      (
        value
      ) => [
        value,
      ]
    );
  }

  const output:
    number[][] =
      [];

  for (
    let index =
      0;
    index <
    values.length;
    index +=
      1
  ) {
    const first =
      values[
        index
      ];

    const remaining =
      values.filter(
        (
          _value,
          remainingIndex
        ) =>
          remainingIndex !==
          index
      );

    for (
      const tail
      of permutations(
        remaining,
        length -
          1
      )
    ) {
      output.push([
        first,
        ...tail,
      ]);
    }
  }

  return output;
}


function combinations(
  values:
    number[],
  length:
    number
): number[][] {
  const output:
    number[][] =
      [];

  function walk(
    start:
      number,
    chosen:
      number[]
  ) {
    if (
      chosen.length ===
      length
    ) {
      output.push([
        ...chosen,
      ]);
      return;
    }

    for (
      let index =
        start;
      index <
      values.length;
      index +=
        1
    ) {
      chosen.push(
        values[
          index
        ]
      );

      walk(
        index +
          1,
        chosen
      );

      chosen.pop();
    }
  }

  walk(
    0,
    []
  );

  return output;
}


function trapStyle(
  box:
    number
): React.CSSProperties {
  switch (
    box
  ) {
    case 1:
      return {
        background:
          "#d71920",
        color:
          "#fff",
      };

    case 2:
      return {
        background:
          "#1266d6",
        color:
          "#fff",
      };

    case 3:
      return {
        background:
          "#f4f4f5",
        color:
          "#09090b",
      };

    case 4:
      return {
        background:
          "#159447",
        color:
          "#fff",
      };

    case 5:
      return {
        background:
          "#111827",
        color:
          "#fff",
      };

    case 6:
      return {
        background:
          "#f4d318",
        color:
          "#111",
      };

    case 7:
      return {
        background:
          "linear-gradient(135deg,#159447 0 50%,#f4f4f5 50% 100%)",
        color:
          "#111",
        textShadow:
          "0 1px 2px #fff",
      };

    case 8:
      return {
        background:
          "linear-gradient(135deg,#f4d318 0 50%,#111827 50% 100%)",
        color:
          "#fff",
        textShadow:
          "0 1px 2px #000",
      };

    default:
      return {
        background:
          "#3f3f46",
        color:
          "#fff",
      };
  }
}


function isRaceOpen(
  race:
    Race | null,
  cardStatus:
    string | null | undefined,
  lockAt:
    string | null | undefined
) {
  if (!race) {
    return false;
  }

  if (
    ![
      "scheduled",
      "upcoming",
    ].includes(
      race.raceStatus
    )
  ) {
    return false;
  }

  if (
    [
      "locked",
      "final",
      "cancelled",
    ].includes(
      String(
        cardStatus ??
        ""
      )
    )
  ) {
    return false;
  }

  const now =
    Date.now();

  /*
   * WHOLE-CARD WAGER RULE:
   *
   * Do not close an individual race just because its scheduled post time
   * has passed. Greyhound cards can run late and AmTote MTP/live state is
   * responsible for reflecting delays.
   *
   * G365 wagering closes from the CARD lock, not each race's scheduled
   * timestamp. Once the card is locked it stays locked for every race.
   */
  if (
    lockAt &&
    new Date(
      lockAt
    ).getTime() <=
      now
  ) {
    return false;
  }

  return true;
}


export default function GreyhoundWagerWorkspace({
  leagueId,
}: Props) {
  const [
    data,
    setData,
  ] =
    useState<
      WorkspaceData |
      null
    >(
      null
    );

  const [
    loading,
    setLoading,
  ] =
    useState(
      true
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
    success,
    setSuccess,
  ] =
    useState<
      string |
      null
    >(
      null
    );

  const [
    selectedRaceId,
    setSelectedRaceId,
  ] =
    useState<
      number |
      null
    >(
      null
    );

  const [
    wagerType,
    setWagerType,
  ] =
    useState<
      WagerType
    >(
      "win"
    );

  const [
    structure,
    setStructure,
  ] =
    useState<
      WagerStructure
    >(
      "straight"
    );

  const [
    denomination,
    setDenomination,
  ] =
    useState(
      2
    );

  const [
    selectedEntryIds,
    setSelectedEntryIds,
  ] =
    useState<
      number[]
    >(
      []
    );

  const [
    keyEntryId,
    setKeyEntryId,
  ] =
    useState<
      number |
      null
    >(
      null
    );


  const [
    alternate1EntryId,
    setAlternate1EntryId,
  ] =
    useState<
      number |
      null
    >(
      null
    );


  const [
    alternate2EntryId,
    setAlternate2EntryId,
  ] =
    useState<
      number |
      null
    >(
      null
    );


  const [
    placing,
    setPlacing,
  ] =
    useState(
      false
    );


  const [
    activeView,
    setActiveView,
  ] = useState<
    "betting" | "my_wagers"
  >("betting");


  const [selectedTrackCode, setSelectedTrackCode] =
    useState<"GWD" | "GTS" | null>(null);

  const [selectedDate, setSelectedDate] =
    useState<string>("");


  const load =
    useCallback(
      async (
        preserveRace =
          true
      ) => {
        setLoading(
          true
        );

        setError(
          null
        );

        try {
          const query =
            new URLSearchParams({
              leagueId,
            });

          if (selectedDate) {
            query.set(
              "date",
              selectedDate
            );
          }

          if (selectedTrackCode) {
            query.set(
              "track",
              selectedTrackCode
            );
          }

          const response =
            await fetch(
              `/api/greyhound/wager-workspace?${query.toString()}`,
              {
                method:
                  "GET",
                cache:
                  "no-store",
              }
            );

          const payload =
            (
              await response.json()
            ) as WorkspaceData;

          if (
            !response.ok ||
            !payload.success
          ) {
            throw new Error(
              payload.error ??
              "Unable to load Greyhound race card."
            );
          }

          const completedDates =
            new Set(
              payload.completedRacingDates ??
              []
            );

          const easternToday =
            easternTodayIsoDate();

          const currentCompetitionDate =
            currentOrNextCompetitionDate(
              easternToday,
              payload.settings
            );

          let targetDate =
            selectedDate ||
            currentCompetitionDate;

          /*
           * Never leave My Wagers parked on a completed or
           * commissioner-excluded competition day.
           *
           * The league's saved Competition Days are authoritative.
           * This means a league using Tue/Thu/Sat, for example,
           * advances directly to the next Tue/Thu/Sat instead of
           * following a hard-coded Greyhound calendar.
           */
          let advanceGuard = 0;

          while (
            targetDate &&
            (
              targetDate <
                currentCompetitionDate ||
              completedDates.has(
                targetDate
              ) ||
              !isCompetitionDate(
                targetDate,
                payload.settings
              )
            ) &&
            advanceGuard < 370
          ) {
            const nextDate =
              nextCompetitionDate(
                targetDate,
                payload.settings
              );

            if (
              nextDate === targetDate
            ) {
              break;
            }

            targetDate =
              nextDate;

            advanceGuard += 1;
          }

          if (
            targetDate &&
            targetDate !== selectedDate
          ) {
            setSelectedDate(
              targetDate
            );

            setSelectedTrackCode(
              null
            );

            setSelectedRaceId(
              null
            );

            setSelectedEntryIds(
              []
            );

            setKeyEntryId(
              null
            );

            setAlternate1EntryId(
              null
            );

            setAlternate2EntryId(
              null
            );

            setData({
              ...payload,
              selectedDate:
                targetDate,
              card:
                null,
              bankroll:
                null,
              races:
                [],
            });

            return;
          }

          // A racing date never auto-opens a track. The API may discover and
          // publish Wheeling/Tri-State cards automatically, but members must
          // click the track button before races, runners, bankroll, or Bet Pad
          // content is loaded for that card.
          if (!selectedTrackCode) {
            setData({
              ...payload,
              selectedDate:
                targetDate ||
                payload.selectedDate ||
                null,
              card: null,
              bankroll: null,
              races: [],
            });

            setSelectedRaceId(
              null
            );

            return;
          }

          setData(
            payload
          );

          const races =
            payload.races ??
            [];

          setSelectedRaceId(
            (
              current
            ) => {
              if (
                preserveRace &&
                current &&
                races.some(
                  (
                    race
                  ) =>
                    race.id ===
                    current
                )
              ) {
                return current;
              }

              const firstOpen =
                races.find(
                  (
                    race
                  ) =>
                    isRaceOpen(
                      race,
                      payload.card
                        ?.cardStatus,
                      payload.card
                        ?.lockAt
                    )
                );

              return (
                firstOpen?.id ??
                races[0]
                  ?.id ??
                null
              );
            }
          );
        } catch (
          loadError
        ) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load Greyhound race card."
          );
        } finally {
          setLoading(
            false
          );
        }
      },
      [
        leagueId,
        selectedDate,
        selectedTrackCode,
      ]
    );


  useEffect(
    () => {
      void load(
        false
      );
    },
    [
      load,
    ]
  );


  useEffect(
    () => {
      const interval =
        window.setInterval(
          () => {
            void load(
              true
            );
          },
          60000
        );

      return () =>
        window.clearInterval(
          interval
        );
    },
    [
      load,
    ]
  );


  const races =
    data?.races ??
    [];


  const availableCards =
    data?.availableCards ??
    [];

  const cardsForSelectedDate =
    useMemo(
      () =>
        selectedDate
          ? availableCards
              .filter(
                (card) =>
                  card.raceDate ===
                  selectedDate
              )
              .sort((a, b) => {
                const trackOrder = (card: AvailableCard) =>
                  card.track?.code === "GWD"
                    ? 0
                    : card.track?.code === "GTS"
                      ? 1
                      : 2;

                return trackOrder(a) - trackOrder(b);
              })
          : [],
      [
        availableCards,
        selectedDate,
      ]
    );

  const availableDates =
    useMemo(
      () =>
        Array.from(
          new Set(
            availableCards.map(
              (card) =>
                card.raceDate
            )
          )
        ).sort(),
      [availableCards]
    );


  const selectedRace =
    useMemo(
      () =>
        races.find(
          (
            race
          ) =>
            race.id ===
            selectedRaceId
        ) ??
        null,
      [
        races,
        selectedRaceId,
      ]
    );


  const allowedWagers =
    data?.settings
      ?.allowedWagers;


  useEffect(
    () => {
      if (
        !allowedWagers
      ) {
        return;
      }

      if (
        isWagerAllowed(
          wagerType,
          allowedWagers
        )
      ) {
        return;
      }

      const firstAllowed =
        (
          Object.keys(
            WAGER_LABELS
          ) as WagerType[]
        ).find(
          (type) =>
            isWagerAllowed(
              type,
              allowedWagers
            )
        );

      if (
        firstAllowed
      ) {
        setWagerType(
          firstAllowed
        );
      }
    },
    [
      allowedWagers,
      wagerType,
    ]
  );


  useEffect(
    () => {
      setSelectedEntryIds(
        []
      );
      setKeyEntryId(
        null
      );
      setAlternate1EntryId(
        null
      );
      setAlternate2EntryId(
        null
      );
      setDenomination(
        DENOMINATIONS[wagerType][0]
      );

      if (
        isStraightWager(
          wagerType
        )
      ) {
        setStructure(
          "straight"
        );
      }
    },
    [
      selectedRaceId,
      wagerType,
    ]
  );


  const requiredLegs =
    LEG_COUNTS[
      wagerType
    ];


  const combinationJson =
    useMemo(
      () => {
        if (
          isStraightWager(
            wagerType
          )
        ) {
          return selectedEntryIds.length === 1
            ? [[selectedEntryIds[0]]]
            : [];
        }

        if (
          structure ===
          "key"
        ) {
          if (
            !keyEntryId ||
            selectedEntryIds.length <
              requiredLegs - 1
          ) {
            return [];
          }

          if (
            wagerType ===
            "quinella"
          ) {
            return selectedEntryIds.map(
              (entryId) => [
                keyEntryId,
                entryId,
              ]
            );
          }

          return permutations(
            selectedEntryIds,
            requiredLegs - 1
          ).map(
            (rest) => [
              keyEntryId,
              ...rest,
            ]
          );
        }

        if (
          selectedEntryIds.length ===
          0
        ) {
          return [];
        }

        if (
          structure ===
          "straight"
        ) {
          return selectedEntryIds.length ===
            requiredLegs
            ? [[...selectedEntryIds]]
            : [];
        }

        if (
          selectedEntryIds.length <
          requiredLegs
        ) {
          return [];
        }

        if (
          wagerType ===
          "quinella"
        ) {
          return combinations(
            selectedEntryIds,
            2
          );
        }

        return permutations(
          selectedEntryIds,
          requiredLegs
        );
      },
      [
        keyEntryId,
        requiredLegs,
        selectedEntryIds,
        structure,
        wagerType,
      ]
    );


  const wagerPartCount =
    COMBINED_WAGER_PARTS[
      wagerType
    ]?.length ?? 1;


  const totalCost =
    combinationJson.length *
    denomination *
    wagerPartCount;


  const raceOpen =
    isRaceOpen(
      selectedRace,
      data?.card
        ?.cardStatus,
      data?.card
        ?.lockAt
    );


  const primaryEntryIds =
    useMemo(
      () =>
        Array.from(
          new Set([
            ...selectedEntryIds,
            ...(keyEntryId !== null
              ? [keyEntryId]
              : []),
          ])
        ),
      [
        selectedEntryIds,
        keyEntryId,
      ]
    );


  const eligibleAlternateEntries =
    useMemo(
      () => {
        if (!selectedRace) {
          return [];
        }

        const primaryIds =
          new Set(
            primaryEntryIds
          );

        return selectedRace.entries
          .filter(
            (entry) =>
              entry.entryStatus === "active" &&
              !primaryIds.has(entry.id)
          )
          .sort(
            (a, b) =>
              a.boxNumber -
              b.boxNumber
          );
      },
      [
        selectedRace,
        primaryEntryIds,
      ]
    );


  useEffect(
    () => {
      const eligibleIds =
        new Set(
          eligibleAlternateEntries.map(
            (entry) =>
              entry.id
          )
        );

      setAlternate1EntryId(
        (current) =>
          current !== null &&
          eligibleIds.has(current)
            ? current
            : null
      );

      setAlternate2EntryId(
        (current) =>
          current !== null &&
          eligibleIds.has(current)
            ? current
            : null
      );
    },
    [
      eligibleAlternateEntries,
    ]
  );


  function selectEntryForColumn(
    entry: Entry,
    columnIndex: number
  ) {
    if (
      entry.entryStatus !== "active" ||
      !raceOpen
    ) {
      return;
    }

    setError(null);
    setSuccess(null);

    if (isStraightWager(wagerType)) {
      setKeyEntryId(null);
      setSelectedEntryIds([entry.id]);
      return;
    }

    if (structure === "key") {
      if (columnIndex === 0) {
        setSelectedEntryIds((current) =>
          current.filter((id) => id !== entry.id)
        );
        setKeyEntryId((current) =>
          current === entry.id ? null : entry.id
        );
        return;
      }

      if (keyEntryId === entry.id) {
        return;
      }

      setSelectedEntryIds((current) =>
        current.includes(entry.id)
          ? current.filter((id) => id !== entry.id)
          : [...current, entry.id]
      );
      return;
    }

    if (structure === "box") {
      setKeyEntryId(null);
      setSelectedEntryIds((current) =>
        current.includes(entry.id)
          ? current.filter((id) => id !== entry.id)
          : [...current, entry.id]
      );
      return;
    }

    // Straight exotic: each finishing-position column owns one runner.
    setKeyEntryId(null);
    setSelectedEntryIds((current) => {
      const next: Array<number | null> = Array.from(
        { length: requiredLegs },
        (_, index) => current[index] ?? null
      );

      // A greyhound cannot occupy two finishing positions in one ticket.
      for (let index = 0; index < next.length; index += 1) {
        if (index !== columnIndex && next[index] === entry.id) {
          next[index] = null;
        }
      }

      next[columnIndex] =
        next[columnIndex] === entry.id ? null : entry.id;

      return next.filter((id): id is number => id !== null);
    });
  }


  function openTrack(trackCode: "GWD" | "GTS") {
    const matchingCard =
      cardsForSelectedDate.find(
        (card) =>
          card.track?.code ===
          trackCode
      );

    if (!matchingCard) {
      setError(
        `No confirmed ${trackCode === "GTS" ? "Tri-State" : "Wheeling"} card is available for ${selectedDate || "the selected date"}.`
      );
      return;
    }

    setSelectedTrackCode(trackCode);
    setActiveView("betting");
    setSelectedRaceId(null);
    setSelectedEntryIds([]);
    setKeyEntryId(null);
    setAlternate1EntryId(null);
    setAlternate2EntryId(null);
    setError(null);
    setSuccess(null);
  }


  function chooseDate(nextDate: string) {
    setSelectedDate(nextDate);
    setSelectedTrackCode(null);
    setActiveView("betting");
    setSelectedRaceId(null);
    setSelectedEntryIds([]);
    setKeyEntryId(null);
    setAlternate1EntryId(null);
    setAlternate2EntryId(null);
    setError(null);
    setSuccess(null);
  }


  async function placeWager() {
    if (
      !selectedRace
    ) {
      setError(
        "Select a race first."
      );
      return;
    }

    if (
      !raceOpen
    ) {
      setError(
        "This race is no longer open for wagering."
      );
      return;
    }

    if (
      combinationJson.length ===
      0
    ) {
      setError(
        structure ===
        "box"
          ? `Select at least ${requiredLegs} active dogs for this ${WAGER_LABELS[
              wagerType
            ]} box.`
          : structure ===
            "key"
          ? `Select one key dog and at least ${requiredLegs - 1} additional active dog${
              requiredLegs - 1 === 1 ? "" : "s"
            }.`
          : `Select exactly ${requiredLegs} dog${
              requiredLegs ===
              1
                ? ""
                : "s"
            } in finishing order.`
      );
      return;
    }

    if (
      !Number.isFinite(denomination) ||
      denomination <
        MIN_DENOMINATION[wagerType]
    ) {
      setError(
        `Minimum amount for ${WAGER_LABELS[wagerType]} is ${money(
          MIN_DENOMINATION[wagerType]
        )}.`
      );
      return;
    }

    if (
      !data?.bankroll ||
      totalCost >
        data.bankroll.amountUnallocated
    ) {
      setError(
        "This wager costs more than your remaining bankroll."
      );
      return;
    }

    setPlacing(
      true
    );

    setError(
      null
    );

    setSuccess(
      null
    );

    try {
      const wagerParts =
        COMBINED_WAGER_PARTS[
          wagerType
        ] ?? [wagerType as BaseWagerType];

      for (
        const wagerPart of
        wagerParts
      ) {
        const response =
          await fetch(
            "/api/greyhound/wagers",
            {
              method:
                "POST",
              headers: {
                "content-type":
                  "application/json",
              },
              body:
                JSON.stringify({
                  leagueId,
                  raceId:
                    selectedRace.id,
                  wagerType:
                    wagerPart,
                  wagerStructure:
                    structure ===
                    "key"
                      ? "straight"
                      : structure,
                  denomination,
                  combinationJson,
                  alternate1EntryId,
                  alternate2EntryId,
                }),
            }
          );

        const payload =
          await response.json();

        if (
          !response.ok ||
          !payload.success
        ) {
          throw new Error(
            payload.error ??
            "Unable to place wager."
          );
        }
      }

      const postTimeMessage = selectedRace.scheduledPostTime
        ? `Race ${selectedRace.raceNumber} post time: ${dateLabel(selectedRace.scheduledPostTime)}.`
        : "Race post time has not been established yet.";

      setSuccess(
        `Bet Confirmed — ${WAGER_LABELS[wagerType]} wager placed for ${money(totalCost)}. ${postTimeMessage}`
      );

      setKeyEntryId(
        null
      );

      setSelectedEntryIds(
        []
      );

      setAlternate1EntryId(
        null
      );

      setAlternate2EntryId(
        null
      );

      await load(
        true
      );
    } catch (
      placeError
    ) {
      setError(
        placeError instanceof Error
          ? placeError.message
          : "Unable to place wager."
      );
    } finally {
      setPlacing(
        false
      );
    }
  }


  const selectedEntryLabels =
    selectedEntryIds.map(
      (
        entryId
      ) => {
        const entry =
          selectedRace?.entries.find(
            (
              item
            ) =>
              item.id ===
              entryId
          );

        return entry
          ? `${entry.boxNumber} ${entry.dogName ?? "Runner"}`
          : String(
              entryId
            );
      }
    );


  if (
    loading &&
    !data
  ) {
    return (
      <div className={styles.loadingCard}>
        Loading Greyhound race card…
      </div>
    );
  }


  const availableBankroll =
    data?.bankroll?.amountUnallocated ??
    0;

  const afterWager =
    Math.max(
      0,
      availableBankroll -
        totalCost
    );


  return (
    <section className={styles.workspace}>
      <style jsx global>{`
        .g365-greyhound-wager-workspace .gdp-name-button,
        .g365-greyhound-wager-workspace button.gdp-name-button {
          appearance: none !important;
          -webkit-appearance: none !important;
          display: inline !important;
          width: auto !important;
          min-width: 0 !important;
          min-height: 0 !important;
          margin: 0 !important;
          padding: 0 !important;
          border: 0 !important;
          border-radius: 0 !important;
          background: transparent !important;
          box-shadow: none !important;
          color: #ffffff !important;
          font: inherit !important;
          font-weight: 900 !important;
          text-align: left !important;
          cursor: pointer !important;
        }

        .g365-greyhound-wager-workspace .gdp-name-button:hover,
        .g365-greyhound-wager-workspace button.gdp-name-button:hover {
          color: #ff8c00 !important;
          text-decoration: underline !important;
          text-underline-offset: 3px;
        }
      `}</style>

      <div className="g365-greyhound-wager-workspace">
        <header className={styles.header}>
          <div className={styles.headerMain}>
            <div>
              <div className={styles.eyebrow}>
                G365 Greyhound Racing
              </div>

              <h1 className={styles.title}>
                {data?.league?.name ??
                  "Greyhound Racing"}
              </h1>

              {data?.card ? (
                <div className={styles.cardMeta}>
                  <span>
                    {data.card.track?.name ??
                      data.card.track?.code ??
                      "Track"}
                  </span>

                  <span>
                    {dateOnlyLabel(
                      data.card.raceDate
                    )}
                  </span>

                  <span>
                    {data.card.session}
                  </span>

                  <span className={styles.cardStatus}>
                    {data.card.cardStatus.replaceAll(
                      "_",
                      " "
                    )}
                  </span>
                </div>
              ) : (
                <div className={styles.cardMeta}>
                  <span>
                    {selectedDate
                      ? `Waiting for ${dateOnlyLabel(
                          selectedDate
                        )} card`
                      : "Waiting for the next league competition card"}
                  </span>
                </div>
              )}
            </div>

            <div className={styles.bankrollBar}>
              <div className={styles.bankrollCell}>
                <span>Starting</span>
                <strong>
                  {money(
                    data?.bankroll
                      ?.startingBankroll ??
                      data?.settings
                        ?.startingBankroll ??
                      0
                  )}
                </strong>
              </div>

              <div className={styles.bankrollCell}>
                <span>Wagered</span>
                <strong>
                  {money(
                    data?.bankroll
                      ?.amountAllocated ??
                      0
                  )}
                </strong>
              </div>

              <div
                className={`${styles.bankrollCell} ${styles.bankrollAvailable}`}
              >
                <span>Available</span>
                <strong>
                  {money(
                    availableBankroll
                  )}
                </strong>
              </div>
            </div>
          </div>
        </header>

        <div
          className={styles.trackSwitcher}
          style={{
            alignItems: "stretch",
            gap: 14,
          }}
        >
          <div
            className={styles.trackSwitcherCopy}
            style={{
              minWidth: 0,
              flex: "1 1 260px",
            }}
          >
            <span className={styles.sectionLabel}>Racing Date</span>
            <strong>Choose the date, then choose the track</strong>
            <div
              style={{
                marginTop: 10,
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                alignItems: "center",
              }}
            >
              <input
                type="date"
                value={selectedDate}
                onChange={(event) =>
                  chooseDate(event.target.value)
                }
                className={styles.racingDatePicker}
              />

              {availableDates.length > 0 ? (
                <span
                  style={{
                    color: "#8f949b",
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  {availableDates.length} available racing date{availableDates.length === 1 ? "" : "s"}
                </span>
              ) : null}
            </div>
          </div>

          <div
            style={{
              flex: "2 1 360px",
              minWidth: 0,
            }}
          >
            <span className={styles.sectionLabel}>Available Cards</span>
            <div
              className={styles.trackSwitcherButtons}
              style={{
                marginTop: 8,
                flexWrap: "wrap",
              }}
            >
              {cardsForSelectedDate.length > 0 ? (
                cardsForSelectedDate.map((card) => {
                  const code =
                    card.track?.code === "GTS"
                      ? "GTS"
                      : "GWD";

                  const active =
                    data?.card?.id === card.id;

                  return (
                    <button
                      key={card.id}
                      type="button"
                      className={`${styles.trackButton} ${active ? styles.trackButtonActive : ""}`}
                      onClick={() => openTrack(code)}
                    >
                      {code === "GTS" ? "Tri-State" : "Wheeling"}
                      {card.session ? ` · ${card.session}` : ""}
                    </button>
                  );
                })
              ) : selectedDate ? (
                <div
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    border: "1px solid rgba(255,255,255,.09)",
                    borderRadius: 10,
                    background: "rgba(255,255,255,.025)",
                    color: "#9a9da2",
                    fontSize: 13,
                    fontWeight: 800,
                  }}
                >
                  {`Waiting for confirmed Wheeling or Tri-State cards for ${dateOnlyLabel(
                    selectedDate
                  )}.`}
                </div>
              ) : (
                <div
                  style={{
                    color: "#9a9da2",
                    fontSize: 13,
                    fontWeight: 800,
                  }}
                >
                  Choose a date to see available cards.
                </div>
              )}
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 8,
            margin: "14px 0 16px",
            padding: 4,
            border: "1px solid rgba(255,255,255,.09)",
            borderRadius: 12,
            background: "#0d0d0d",
            overflowX: "auto",
          }}
        >
          <button
            type="button"
            onClick={() => setActiveView("betting")}
            style={{
              flex: "0 0 auto",
              minHeight: 40,
              padding: "0 18px",
              border: activeView === "betting"
                ? "1px solid rgba(255,122,26,.72)"
                : "1px solid transparent",
              borderRadius: 9,
              background: activeView === "betting"
                ? "linear-gradient(135deg,#981417,#e35d15)"
                : "transparent",
              color: activeView === "betting" ? "#fff" : "#aaa",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            Betting
          </button>

          <button
            type="button"
            onClick={() => setActiveView("my_wagers")}
            style={{
              flex: "0 0 auto",
              minHeight: 40,
              padding: "0 18px",
              border: activeView === "my_wagers"
                ? "1px solid rgba(255,122,26,.72)"
                : "1px solid transparent",
              borderRadius: 9,
              background: activeView === "my_wagers"
                ? "linear-gradient(135deg,#981417,#e35d15)"
                : "transparent",
              color: activeView === "my_wagers" ? "#fff" : "#aaa",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            My Wagers
          </button>
        </div>

        {activeView === "betting" ? (
          <>
        {data?.card ? (
          <GreyhoundDailySurvivorPanel
            leagueId={leagueId}
            cardId={data.card.id}
          />
        ) : null}

        {error ? (
          <div className={styles.errorBar}>
            {error}
          </div>
        ) : null}

        {success ? (
          <div className={styles.successBar}>
            {success}
          </div>
        ) : null}

        {!data?.card && cardsForSelectedDate.length === 0 ? (
          <div className={styles.waitingBanner}>
            <strong>
              Waiting for the next race card
            </strong>

            <span>
              G365 will add Wheeling or Tri-State above automatically as soon
              as the official card is published.
            </span>
          </div>
        ) : null}

        {!data?.card && cardsForSelectedDate.length > 0 ? (
          <div className={styles.waitingBanner}>
            <strong>
              Choose Wheeling or Tri-State
            </strong>

            <span>
              Select an available track above to open its races and runners.
            </span>
          </div>
        ) : null}

        {data?.card ? (
          <>
        <div className={styles.raceNav}>
          {races.length >
            0 ? (
            races.map(
              (
                race
              ) => {
                const active =
                  race.id ===
                  selectedRaceId;

                const open =
                  isRaceOpen(
                    race,
                    data.card
                      ?.cardStatus,
                    data.card
                      ?.lockAt
                  );

                return (
                  <button
                    key={race.id}
                    type="button"
                    onClick={() =>
                      setSelectedRaceId(
                        race.id
                      )
                    }
                    className={`${styles.raceNavButton} ${
                      active
                        ? styles.raceNavButtonActive
                        : ""
                    }`}
                  >
                    <strong>
                      Race {race.raceNumber}
                    </strong>

                    <span
                      className={
                        open
                          ? styles.openText
                          : styles.mutedText
                      }
                    >
                      {open
                        ? dateLabel(
                            race.scheduledPostTime
                          )
                        : displayRaceStatus(
                            race.raceStatus,
                            data?.card?.cardStatus
                          ).replaceAll(
                            "_",
                            " "
                          )}
                    </span>
                  </button>
                );
              }
            )
          ) : (
            Array.from(
              {
                length:
                  8,
              },
              (
                _,
                index
              ) => (
                <div
                  key={
                    index
                  }
                  className={`${styles.raceNavButton} ${styles.raceNavPlaceholder}`}
                >
                  <strong>
                    Race {index + 1}
                  </strong>
                  <span>
                    Waiting
                  </span>
                </div>
              )
            )
          )}
        </div>

        <div className={styles.mainGrid}>
          <div className={styles.raceCardPanel}>
            {selectedRace ? (
              <>
                <div className={styles.raceHeader}>
                  <div>
                    <div className={styles.sectionLabel}>
                      Race Card
                    </div>

                    <div className={styles.raceTitleRow}>
                      <h2>
                        Race {selectedRace.raceNumber}
                      </h2>

                      <span>
                        {selectedRace.grade ??
                          "Grade —"}
                      </span>

                      <span>
                        {selectedRace.distanceYards
                          ? `${selectedRace.distanceYards} Yards`
                          : "Distance —"}
                      </span>
                    </div>
                  </div>

                  <div
                    className={
                      raceOpen
                        ? styles.raceOpenBadge
                        : styles.raceClosedBadge
                    }
                  >
                    {raceOpen
                      ? `Open • ${dateLabel(
                          selectedRace.scheduledPostTime
                        )}`
                      : `Closed • ${displayRaceStatus(
                          selectedRace.raceStatus,
                          data?.card?.cardStatus
                        ).replaceAll(
                          "_",
                          " "
                        )}`}
                  </div>
                </div>

                <div className={styles.runnersScroller}>
                  <div
                    className={styles.runnersTable}
                    style={{
                      minWidth: `${500 + requiredLegs * 50}px`,
                    }}
                  >
                    <div
                      className={styles.runnersHead}
                      style={{
                        gridTemplateColumns: `56px minmax(170px, 1fr) 68px 72px 84px repeat(${requiredLegs}, 48px)`,
                      }}
                    >
                      <div>Trap</div>
                      <div>Greyhound</div>
                      <div>Odds</div>
                      <div>Weight</div>
                      <div>Status</div>

                      {Array.from({ length: requiredLegs }).map((_, columnIndex) => (
                        <div
                          key={`race-card-head-${columnIndex}`}
                          style={{ textAlign: "center" }}
                        >
                          {isStraightWager(wagerType)
                            ? "Pick"
                            : structure === "key" && columnIndex === 0
                              ? "Key"
                              : ["1st", "2nd", "3rd", "4th"][columnIndex]}
                        </div>
                      ))}
                    </div>

                    {selectedRace.entries.map((entry) => {
                      const selected =
                        selectedEntryIds.includes(entry.id) ||
                        keyEntryId === entry.id;

                      const active = entry.entryStatus === "active";

                      return (
                        <div
                          key={entry.id}
                          className={`${styles.runnerRow} ${
                            selected ? styles.runnerSelected : ""
                          } ${!active ? styles.runnerInactive : ""}`}
                          style={{
                            gridTemplateColumns: `56px minmax(170px, 1fr) 68px 72px 84px repeat(${requiredLegs}, 48px)`,
                          }}
                        >
                          <div
                            className={styles.trapButton}
                            style={{
                              ...trapStyle(entry.boxNumber),
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              cursor: "default",
                            }}
                            aria-label={`Trap ${entry.boxNumber}`}
                          >
                            {entry.boxNumber}
                          </div>

                          <div className={styles.runnerInfo}>
                            {entry.dogId && entry.dogName ? (
                              <GreyhoundDogProfileModal
                                leagueId={leagueId}
                                dogId={entry.dogId}
                                dogName={entry.dogName}
                                className="gdp-name-button"
                              />
                            ) : (
                              <strong>{entry.dogName ?? "Vacant"}</strong>
                            )}

                            <small>
                              {entry.trainer
                                ? `Trainer: ${entry.trainer}`
                                : entry.kennel
                                  ? `Kennel: ${entry.kennel}`
                                  : "Click the dog name for G365 stats"}
                            </small>
                          </div>

                          <div className={styles.runnerOdds}>
                            {entry.morningLineOdds ?? "—"}
                          </div>

                          <div className={styles.runnerMeta}>
                            {entry.weight !== null ? entry.weight.toFixed(1) : "—"}
                          </div>

                          <div
                            className={`${styles.entryStatus} ${
                              active ? styles.entryActive : ""
                            }`}
                          >
                            {entry.entryStatus.replaceAll("_", " ")}
                          </div>

                          {Array.from({ length: requiredLegs }).map((_, columnIndex) => {
                            let checked = false;

                            if (isStraightWager(wagerType)) {
                              checked = selectedEntryIds[0] === entry.id;
                            } else if (structure === "key") {
                              checked =
                                columnIndex === 0
                                  ? keyEntryId === entry.id
                                  : selectedEntryIds.includes(entry.id);
                            } else if (structure === "box") {
                              checked = selectedEntryIds.includes(entry.id);
                            } else {
                              checked = selectedEntryIds[columnIndex] === entry.id;
                            }

                            return (
                              <div
                                key={`${entry.id}-race-card-${columnIndex}`}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                }}
                              >
                                <button
                                  type="button"
                                  disabled={!active || !raceOpen}
                                  onClick={() => selectEntryForColumn(entry, columnIndex)}
                                  aria-label={`Select trap ${entry.boxNumber} for ${
                                    isStraightWager(wagerType)
                                      ? WAGER_LABELS[wagerType]
                                      : ["1st", "2nd", "3rd", "4th"][columnIndex]
                                  }`}
                                  aria-pressed={checked}
                                  style={{
                                    width: 30,
                                    height: 30,
                                    padding: 0,
                                    borderRadius: "999px",
                                    border: checked
                                      ? "3px solid #ff8c00"
                                      : "2px solid rgba(255,255,255,.30)",
                                    background: checked
                                      ? "linear-gradient(135deg, #b31317, #ff7a1a)"
                                      : "rgba(255,255,255,.04)",
                                    boxShadow: checked
                                      ? "0 0 0 2px rgba(255,122,26,.16)"
                                      : "none",
                                    cursor: active && raceOpen ? "pointer" : "not-allowed",
                                    opacity: active && raceOpen ? 1 : 0.35,
                                  }}
                                />
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            ) : (
              <div className={styles.waitingRaceCard}>
                <div className={styles.sectionLabel}>
                  Race Card
                </div>

                <h2>
                  Today&apos;s runners will appear here
                </h2>

                <p>
                  Trap numbers, dog names, odds, trainers,
                  weights, and race status will populate
                  automatically from the live card.
                </p>

                <div className={styles.placeholderTable}>
                  {Array.from(
                    {
                      length:
                        8,
                    },
                    (
                      _,
                      index
                    ) => (
                      <div
                        key={
                          index
                        }
                        className={styles.placeholderRunner}
                        style={{
                          gridTemplateColumns: `56px minmax(170px, 1fr) 68px 72px 84px repeat(${requiredLegs}, 48px)`,
                          minWidth: `${500 + requiredLegs * 50}px`,
                        }}
                      >
                        <div
                          className={styles.placeholderTrap}
                          style={trapStyle(
                            index +
                              1
                          )}
                        >
                          {index +
                            1}
                        </div>

                        <strong>
                          Waiting for runner
                        </strong>

                        <span>
                          —
                        </span>

                        <span>
                          —
                        </span>

                        <span>
                          Pending
                        </span>

                        {Array.from({ length: requiredLegs }).map((_, columnIndex) => (
                          <span
                            key={`placeholder-pick-${index}-${columnIndex}`}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <span
                              style={{
                                width: 28,
                                height: 28,
                                borderRadius: "999px",
                                border: "2px solid rgba(255,255,255,.18)",
                                background: "rgba(255,255,255,.025)",
                              }}
                            />
                          </span>
                        ))}
                      </div>
                    )
                  )}
                </div>
              </div>
            )}
          </div>

          <aside className={styles.betPad}>
            <div className={styles.betPadHeader}>
              <div>
                <div className={styles.sectionLabel}>
                  G365 Bet Pad
                </div>

                <h2>
                  Build Your Wager
                </h2>
              </div>

              <div className={styles.betPadRace}>
                {selectedRace
                  ? `Race ${selectedRace.raceNumber}`
                  : "Waiting"}
              </div>
            </div>

            <div className={styles.betPadBody}>
              <div>
                <div className={styles.fieldLabel}>
                  Wager Type
                </div>

                <div className={styles.wagerTypeGrid}>
                  {(
                    Object.keys(
                      WAGER_LABELS
                    ) as WagerType[]
                  ).map(
                    (
                      type
                    ) => {
                      const allowed =
                        isWagerAllowed(
                          type,
                          allowedWagers
                        );

                      return (
                        <button
                          key={
                            type
                          }
                          type="button"
                          disabled={
                            !allowed ||
                            !data?.card
                          }
                          onClick={() =>
                            setWagerType(
                              type
                            )
                          }
                          className={`${styles.choiceButton} ${
                            wagerType ===
                            type
                              ? styles.choiceButtonActive
                              : ""
                          }`}
                        >
                          {
                            WAGER_LABELS[
                              type
                            ]
                          }
                        </button>
                      );
                    }
                  )}
                </div>
              </div>

              {!isStraightWager(
                wagerType
              ) ? (
                <div>
                  <div className={styles.fieldLabel}>
                    Structure
                  </div>

                  <div className={styles.twoColumn}>
                    {(
                      [
                        "straight",
                        "key",
                        "box",
                      ] as WagerStructure[]
                    ).map(
                      (
                        option
                      ) => (
                        <button
                          key={
                            option
                          }
                          type="button"
                          disabled={
                            !data?.card
                          }
                          onClick={() => {
                            setStructure(
                              option
                            );
                            setSelectedEntryIds(
                              []
                            );
                            setKeyEntryId(
                              null
                            );
                            setAlternate1EntryId(
                              null
                            );
                            setAlternate2EntryId(
                              null
                            );
                          }}
                          className={`${styles.choiceButton} ${
                            structure ===
                            option
                              ? styles.choiceButtonActive
                              : ""
                          }`}
                        >
                          {option}
                        </button>
                      )
                    )}
                  </div>
                </div>
              ) : null}

              <div>
                <div className={styles.fieldLabel}>
                  Amount Per Combination
                </div>

                <div className={styles.denominationGrid}>
                  {DENOMINATIONS[wagerType].map(
                    (amount) => (
                      <button
                        key={amount}
                        type="button"
                        disabled={!data?.card}
                        onClick={() =>
                          setDenomination(amount)
                        }
                        className={`${styles.choiceButton} ${
                          denomination === amount
                            ? styles.choiceButtonActive
                            : ""
                        }`}
                      >
                        {money(amount)}
                      </button>
                    )
                  )}

                  <label
                    style={{
                      display: "flex",
                      gridColumn: "span 2",
                      width: "100%",
                      maxWidth: "100%",
                      boxSizing: "border-box",
                      minWidth: 0,
                      overflow: "hidden",
                      alignItems: "center",
                      gap: 8,
                      border: "1px solid rgba(255,255,255,.14)",
                      borderRadius: 10,
                      padding: "8px 10px",
                      background: "rgba(255,255,255,.035)",
                    }}
                  >
                    <span
                      style={{
                        flex: "0 0 auto",
                        whiteSpace: "nowrap",
                        fontSize: 11,
                        fontWeight: 900,
                        textTransform: "uppercase",
                        letterSpacing: ".06em",
                        color: "#c9c9c9",
                      }}
                    >
                      Custom
                    </span>
                    <span style={{ color: "#fff", fontWeight: 900 }}>$</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      min={MIN_DENOMINATION[wagerType]}
                      step={
                        wagerType === "superfecta"
                          ? 0.1
                          : wagerType === "trifecta"
                          ? 0.5
                          : 1
                      }
                      value={
                        DENOMINATIONS[wagerType].includes(denomination)
                          ? ""
                          : denomination
                      }
                      placeholder={String(MIN_DENOMINATION[wagerType])}
                      disabled={!data?.card}
                      onChange={(event) => {
                        const next = Number(event.target.value);
                        if (Number.isFinite(next) && next > 0) {
                          setDenomination(next);
                        }
                      }}
                      style={{
                        flex: "1 1 54px",
                        width: "54px",
                        maxWidth: "100%",
                        minWidth: 0,
                        border: 0,
                        outline: 0,
                        background: "transparent",
                        color: "#fff",
                        font: "inherit",
                        fontWeight: 900,
                      }}
                    />
                  </label>
                </div>

              </div>

              <div className={styles.selectionsBox}>
                <div className={styles.selectionsHeader}>
                  <span>
                    Your Selections
                  </span>

                  {selectedEntryIds.length >
                    0 ||
                  keyEntryId ? (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedEntryIds(
                          []
                        );
                        setKeyEntryId(
                          null
                        );
                        setAlternate1EntryId(
                          null
                        );
                        setAlternate2EntryId(
                          null
                        );
                      }}
                    >
                      Clear
                    </button>
                  ) : null}
                </div>

                {selectedEntryLabels.length ===
                0 ? (
                  <div className={styles.noSelections}>
                    {data?.card
                      ? "Select runners from the race card."
                      : "Waiting for the race card."}
                  </div>
                ) : (
                  <div className={styles.selectionList}>
                    {selectedEntryLabels.map(
                      (
                        label,
                        index
                      ) => (
                        <div
                          key={`${label}-${index}`}
                          className={styles.selectionItem}
                        >
                          <span>
                            {index +
                              1}
                          </span>

                          <strong>
                            {label}
                          </strong>
                        </div>
                      )
                    )}
                  </div>
                )}

                <div
                  style={{
                    marginTop: 12,
                    padding: 12,
                    border: "1px solid rgba(242,107,34,.28)",
                    borderRadius: 12,
                    background:
                      "linear-gradient(180deg,rgba(153,29,22,.12),rgba(255,255,255,.025))",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      gap: 10,
                      marginBottom: 10,
                    }}
                  >
                    <div>
                      <div
                        style={{
                          color: "#ff6b22",
                          fontSize: 9,
                          fontWeight: 950,
                          letterSpacing: ".10em",
                          textTransform: "uppercase",
                        }}
                      >
                        Scratch Protection
                      </div>

                      <div
                        style={{
                          marginTop: 3,
                          color: "#fff",
                          fontSize: 12,
                          fontWeight: 900,
                        }}
                      >
                        Optional Alternate Picks
                      </div>

                      <div
                        style={{
                          marginTop: 4,
                          color: "#858b93",
                          fontSize: 10,
                          lineHeight: 1.45,
                        }}
                      >
                        Alternate 1 is used first if one of your selected
                        Greyhounds scratches. Alternate 2 is the backup if
                        Alternate 1 cannot be used.
                      </div>
                    </div>

                    <span
                      style={{
                        flex: "0 0 auto",
                        padding: "4px 7px",
                        border: "1px solid rgba(255,122,26,.30)",
                        borderRadius: 999,
                        background: "rgba(255,107,34,.08)",
                        color: "#ff9a68",
                        fontSize: 8,
                        fontWeight: 950,
                        letterSpacing: ".06em",
                      }}
                    >
                      OPTIONAL
                    </span>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(2,minmax(0,1fr))",
                      gap: 9,
                    }}
                  >
                    <label
                      style={{
                        display: "grid",
                        gap: 5,
                        minWidth: 0,
                      }}
                    >
                      <span
                        style={{
                          color: "#a4a8ae",
                          fontSize: 9,
                          fontWeight: 900,
                          textTransform: "uppercase",
                        }}
                      >
                        Alternate 1
                      </span>

                      <select
                        value={
                          alternate1EntryId ??
                          ""
                        }
                        disabled={
                          !data?.card ||
                          !selectedRace ||
                          !raceOpen ||
                          combinationJson.length === 0 ||
                          eligibleAlternateEntries.length === 0
                        }
                        onChange={(event) => {
                          const value =
                            event.target.value
                              ? Number(
                                  event.target.value
                                )
                              : null;

                          setAlternate1EntryId(
                            value
                          );

                          if (
                            value !== null &&
                            value ===
                              alternate2EntryId
                          ) {
                            setAlternate2EntryId(
                              null
                            );
                          }
                        }}
                        style={{
                          width: "100%",
                          minWidth: 0,
                          minHeight: 40,
                          padding: "0 9px",
                          border:
                            "1px solid rgba(255,255,255,.14)",
                          borderRadius: 9,
                          background: "#101113",
                          color: "#fff",
                          fontSize: 11,
                          fontWeight: 850,
                          colorScheme: "dark",
                        }}
                      >
                        <option value="">
                          No Alternate 1
                        </option>

                        {eligibleAlternateEntries
                          .filter(
                            (entry) =>
                              entry.id !==
                              alternate2EntryId
                          )
                          .map(
                            (entry) => (
                              <option
                                key={`alternate-1-${entry.id}`}
                                value={
                                  entry.id
                                }
                              >
                                {`#${entry.boxNumber} ${entry.dogName ?? "Runner"}`}
                              </option>
                            )
                          )}
                      </select>
                    </label>

                    <label
                      style={{
                        display: "grid",
                        gap: 5,
                        minWidth: 0,
                      }}
                    >
                      <span
                        style={{
                          color: "#a4a8ae",
                          fontSize: 9,
                          fontWeight: 900,
                          textTransform: "uppercase",
                        }}
                      >
                        Alternate 2
                      </span>

                      <select
                        value={
                          alternate2EntryId ??
                          ""
                        }
                        disabled={
                          !data?.card ||
                          !selectedRace ||
                          !raceOpen ||
                          combinationJson.length === 0 ||
                          eligibleAlternateEntries.length === 0
                        }
                        onChange={(event) => {
                          const value =
                            event.target.value
                              ? Number(
                                  event.target.value
                                )
                              : null;

                          setAlternate2EntryId(
                            value
                          );

                          if (
                            value !== null &&
                            value ===
                              alternate1EntryId
                          ) {
                            setAlternate1EntryId(
                              null
                            );
                          }
                        }}
                        style={{
                          width: "100%",
                          minWidth: 0,
                          minHeight: 40,
                          padding: "0 9px",
                          border:
                            "1px solid rgba(255,255,255,.14)",
                          borderRadius: 9,
                          background: "#101113",
                          color: "#fff",
                          fontSize: 11,
                          fontWeight: 850,
                          colorScheme: "dark",
                        }}
                      >
                        <option value="">
                          No Alternate 2
                        </option>

                        {eligibleAlternateEntries
                          .filter(
                            (entry) =>
                              entry.id !==
                              alternate1EntryId
                          )
                          .map(
                            (entry) => (
                              <option
                                key={`alternate-2-${entry.id}`}
                                value={
                                  entry.id
                                }
                              >
                                {`#${entry.boxNumber} ${entry.dogName ?? "Runner"}`}
                              </option>
                            )
                          )}
                      </select>
                    </label>
                  </div>

                  {combinationJson.length ===
                  0 ? (
                    <div
                      style={{
                        marginTop: 8,
                        color: "#777d85",
                        fontSize: 9,
                        fontWeight: 700,
                      }}
                    >
                      Finish your wager selections first, then choose
                      optional scratch alternates.
                    </div>
                  ) : eligibleAlternateEntries.length ===
                    0 ? (
                    <div
                      style={{
                        marginTop: 8,
                        color: "#777d85",
                        fontSize: 9,
                        fontWeight: 700,
                      }}
                    >
                      No additional active Greyhounds are available as
                      alternates for this ticket.
                    </div>
                  ) : null}
                </div>

                <div className={styles.costGrid}>
                  <div>
                    <span>
                      Combinations
                    </span>

                    <strong>
                      {combinationJson.length}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Total Cost
                    </span>

                    <strong className={styles.costValue}>
                      {money(
                        totalCost
                      )}
                    </strong>
                  </div>
                </div>
              </div>

              <div className={styles.bankrollSummary}>
                <div>
                  <span>
                    Available Bankroll
                  </span>

                  <strong>
                    {money(
                      availableBankroll
                    )}
                  </strong>
                </div>

                <div>
                  <span>
                    After This Wager
                  </span>

                  <strong
                    className={
                      totalCost >
                      availableBankroll
                        ? styles.negativeValue
                        : styles.positiveValue
                    }
                  >
                    {money(
                      afterWager
                    )}
                  </strong>
                </div>
              </div>

              <button
                type="button"
                disabled={
                  placing ||
                  !data?.card ||
                  !raceOpen ||
                  combinationJson.length ===
                    0 ||
                  totalCost <=
                    0 ||
                  totalCost >
                    availableBankroll
                }
                onClick={() =>
                  void placeWager()
                }
                className={styles.placeWagerButton}
              >
                {placing
                  ? "Placing Wager…"
                  : !data?.card
                    ? "Waiting for Race Card"
                    : raceOpen
                      ? `Place ${WAGER_LABELS[wagerType]} • ${money(
                          totalCost
                        )}`
                      : "Wagering Closed"}
              </button>

              <p className={styles.betNote}>
                Straight wagers use the finishing-position columns shown.
                Key wagers hold the key dog in first and rotate the selected
                partners through the remaining positions. Box wagers create
                every valid finishing-order combination automatically.
                Scratch alternates are optional and are attempted in Alternate
                1 then Alternate 2 order. The server validates the wager again
                before bankroll is committed.
              </p>
            </div>
          </aside>
        </div>
          </>
        ) : null}
          </>
        ) : (
          <GreyhoundMyWagers
            leagueId={leagueId}
            embedded
            onSelectTrack={openTrack}
          />
        )}
      </div>
    </section>
  );
}
