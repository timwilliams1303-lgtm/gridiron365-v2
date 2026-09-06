export type ParticipantSlotMode =
  | "existing_slot"
  | "auto_create_slot";

export type AcceptanceInitializer =
  | "none"
  | "nhl_pickem";

export type LeagueParticipantPolicy = {
  leagueType: string;

  /*
   * existing_slot:
   * Commissioner must invite into an already-created
   * fantasy_team slot.
   *
   * auto_create_slot:
   * A brand-new invitation may automatically reserve
   * a new fantasy_team row.
   */
  slotMode: ParticipantSlotMode;

  /*
   * League-specific setup that must succeed after the
   * reserved fantasy team is claimed but BEFORE the
   * invitation is marked accepted.
   */
  acceptanceInitializer:
    AcceptanceInitializer;

  /*
   * Where a user should land after accepting.
   *
   * Most leagues use /league/[leagueId].
   * A league can override this when it has its own
   * separate route tree.
   */
  getHomePath: (
    leagueId: string
  ) => string;
};


/*
 * ============================================================
 * GRIDIRON365 PARTICIPANT STANDARD
 * ============================================================
 *
 * EVERY NEW LEAGUE TYPE MUST BE ADDED HERE.
 *
 * Required participant lifecycle:
 *
 * Invite by Email
 * → Pending
 * → Resend
 * → Accept
 * → Remove Owner
 * → Replacement Invite
 * → Preserve Same Historical Slot
 *
 * Every league must define:
 *
 * 1. Whether invitations use an existing slot or automatically
 *    create a reserved fantasy-team slot.
 *
 * 2. Whether acceptance requires league-specific initialization.
 *
 * 3. The correct league destination after acceptance.
 *
 * The league-specific remove-owner implementation must:
 *
 * - protect the primary commissioner
 * - clear ownership without deleting the historical slot
 * - preserve scoring/history/results/awards/trophies
 * - cancel pending reservations for that slot when appropriate
 * - allow a replacement owner to claim the SAME slot
 *
 * ============================================================
 */


const PARTICIPANT_POLICIES:
  Record<
    string,
    LeagueParticipantPolicy
  > = {
    traditional: {
      leagueType:
        "traditional",

      slotMode:
        "existing_slot",

      acceptanceInitializer:
        "none",

      getHomePath: (
        leagueId
      ) =>
        `/league/${leagueId}`,
    },

    season_long: {
      leagueType:
        "season_long",

      slotMode:
        "existing_slot",

      acceptanceInitializer:
        "none",

      getHomePath: (
        leagueId
      ) =>
        `/league/${leagueId}`,
    },

    pickem: {
      leagueType:
        "pickem",

      slotMode:
        "existing_slot",

      acceptanceInitializer:
        "none",

      getHomePath: (
        leagueId
      ) =>
        `/league/${leagueId}`,
    },

    nfl_playoffs: {
      leagueType:
        "nfl_playoffs",

      slotMode:
        "auto_create_slot",

      acceptanceInitializer:
        "none",

      getHomePath: (
        leagueId
      ) =>
        `/league/${leagueId}`,
    },

    nhl_pickem: {
      leagueType:
        "nhl_pickem",

      slotMode:
        "auto_create_slot",

      acceptanceInitializer:
        "nhl_pickem",

      getHomePath: (
        leagueId
      ) =>
        `/league/${leagueId}/nhl-pickem`,
    },
  };


export function getLeagueParticipantPolicy(
  leagueType:
    string
): LeagueParticipantPolicy | null {
  return (
    PARTICIPANT_POLICIES[
      leagueType
    ] ??
    null
  );
}


export function leagueAllowsAutomaticParticipantSlot(
  leagueType:
    string
) {
  return (
    getLeagueParticipantPolicy(
      leagueType
    )?.slotMode ===
    "auto_create_slot"
  );
}


export function getLeagueAcceptanceInitializer(
  leagueType:
    string
): AcceptanceInitializer {
  return (
    getLeagueParticipantPolicy(
      leagueType
    )
      ?.acceptanceInitializer ??
    "none"
  );
}


export function getLeagueParticipantHomePath(
  leagueType:
    string,
  leagueId:
    string
) {
  return (
    getLeagueParticipantPolicy(
      leagueType
    )?.getHomePath(
      leagueId
    ) ??
    `/league/${leagueId}`
  );
}