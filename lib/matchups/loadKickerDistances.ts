import type {
  SupabaseClient,
} from "@supabase/supabase-js";

import type {
  G365KickerDistanceSummary,
} from "@/components/matchups/G365MobileMatchupDetail";


type KickerPlayer = {
  espnPlayerId:
    string |
    null;

  position: string;

  nflGameId:
    number |
    null;
};


type FieldGoalPlayRow = {
  nfl_game_id: number;

  sequence_number:
    number |
    null;

  play_text:
    string |
    null;

  scoring_play:
    boolean |
    null;

  participant_espn_player_ids:
    string[] |
    null;
};


function fieldGoalDistance(
  value:
    string |
    null
) {
  const text =
    String(
      value ??
      ""
    );

  const match =
    text.match(
      /(\d{1,2})\s*-?\s*yard\s+field\s+goal/i
    ) ??
    text.match(
      /field\s+goal\s+from\s+(\d{1,2})/i
    );

  if (!match) {
    return null;
  }

  const yards =
    Number(
      match[1]
    );

  if (
    !Number.isFinite(
      yards
    ) ||
    yards <=
      0
  ) {
    return null;
  }

  return yards;
}


function isMissedFieldGoal(
  value:
    string |
    null
) {
  const text =
    String(
      value ??
      ""
    )
      .toLowerCase();

  return (
    text.includes(
      "no good"
    ) ||
    text.includes(
      "missed"
    ) ||
    text.includes(
      "wide left"
    ) ||
    text.includes(
      "wide right"
    ) ||
    text.includes(
      "blocked"
    ) ||
    text.includes(
      "short"
    )
  );
}


export async function loadKickerDistances(
  supabase:
    SupabaseClient,
  players:
    KickerPlayer[]
): Promise<
  Record<
    string,
    G365KickerDistanceSummary
  >
> {
  const kickers =
    players.filter(
      (
        player
      ) => {
        const position =
          player.position
            .trim()
            .toUpperCase();

        return (
          (
            position ===
              "K" ||
            position ===
              "PK"
          ) &&
          Boolean(
            player
              .espnPlayerId
          ) &&
          player.nflGameId !==
            null
        );
      }
    );

  const espnPlayerIds =
    Array.from(
      new Set(
        kickers
          .map(
            (
              player
            ) =>
              player
                .espnPlayerId
          )
          .filter(
            (
              value
            ): value is string =>
              Boolean(
                value
              )
          )
      )
    );

  const gameIds =
    Array.from(
      new Set(
        kickers
          .map(
            (
              player
            ) =>
              player
                .nflGameId
          )
          .filter(
            (
              value
            ): value is number =>
              value !==
              null
          )
      )
    );

  if (
    espnPlayerIds.length ===
      0 ||
    gameIds.length ===
      0
  ) {
    return {};
  }

  const {
    data,
    error,
  } =
    await supabase
      .from(
        "nfl_game_plays"
      )
      .select(`
        nfl_game_id,
        sequence_number,
        play_text,
        scoring_play,
        participant_espn_player_ids
      `)
      .in(
        "nfl_game_id",
        gameIds
      )
      .overlaps(
        "participant_espn_player_ids",
        espnPlayerIds
      )
      .order(
        "sequence_number",
        {
          ascending:
            true,
        }
      );

  if (error) {
    console.warn(
      "Could not load kicker field-goal distances:",
      error.message
    );

    return {};
  }

  const output:
    Record<
      string,
      G365KickerDistanceSummary
    > =
    {};

  for (
    const raw of
    data ??
    []
  ) {
    const play =
      raw as
        FieldGoalPlayRow;

    const text =
      String(
        play.play_text ??
        ""
      );

    if (
      !/field\s+goal/i.test(
        text
      )
    ) {
      continue;
    }

    const yards =
      fieldGoalDistance(
        text
      );

    if (yards === null) {
      continue;
    }

    const missed =
      isMissedFieldGoal(
        text
      );

    const made =
      !missed &&
      Boolean(
        play.scoring_play
      );

    if (
      !made &&
      !missed
    ) {
      continue;
    }

    for (
      const espnPlayerId of
      play
        .participant_espn_player_ids ??
      []
    ) {
      if (
        !espnPlayerIds.includes(
          espnPlayerId
        )
      ) {
        continue;
      }

      const current =
        output[
          espnPlayerId
        ] ?? {
          made: [],
          missed: [],
        };

      if (made) {
        current.made.push(
          yards
        );
      } else {
        current.missed.push(
          yards
        );
      }

      output[
        espnPlayerId
      ] =
        current;
    }
  }

  return output;
}
