import type {
  G365LeagueType,
  SeasonLongCompetitionFormat,
} from "./leagueCapabilities";


type LeagueDisplayLabelsArgs = {
  leagueType: G365LeagueType;
  playerSelectionMode: string;
  seasonLongCompetitionFormat?: SeasonLongCompetitionFormat;
};


export type LeagueDisplayLabels = {
  leagueTypeLabel: string;
  mobileLeagueTypeLabel: string;
  selectionModeLabel: string | null;
  mobileSelectionModeLabel: string | null;
};


export function getLeagueDisplayLabels({
  leagueType,
  playerSelectionMode,
  seasonLongCompetitionFormat = "total_points",
}: LeagueDisplayLabelsArgs): LeagueDisplayLabels {
  let leagueTypeLabel = "GRIDIRON365";
  let mobileLeagueTypeLabel = "G365";

  switch (leagueType) {
    case "traditional":
      leagueTypeLabel =
        "TRADITIONAL";
      mobileLeagueTypeLabel =
        "TRAD";
      break;

    case "season_long":
      leagueTypeLabel =
        "SEASON-LONG";
      mobileLeagueTypeLabel =
        seasonLongCompetitionFormat ===
        "head_to_head"
          ? "SL-H2H"
          : "SL-TP";
      break;

    case "nfl_playoffs":
      leagueTypeLabel =
        "NFL PLAYOFFS";
      mobileLeagueTypeLabel =
        "NFLP";
      break;

    case "pickem":
      leagueTypeLabel =
        "G365 PICK'EM";
      mobileLeagueTypeLabel =
        "PICK'EM";
      break;

    case "greyhound":
      leagueTypeLabel =
        "G365 GREYHOUND";
      mobileLeagueTypeLabel =
        "GREY";
      break;

    default: {
      const exhaustiveCheck:
        never =
          leagueType;

      return exhaustiveCheck;
    }
  }

  let selectionModeLabel:
    string | null =
      null;

  let mobileSelectionModeLabel:
    string | null =
      null;

  /*
   * Salary / no-salary labels only apply to the league
   * types that actually use player-selection modes.
   */
  if (
    leagueType === "season_long" ||
    leagueType === "nfl_playoffs"
  ) {
    if (
      playerSelectionMode ===
      "salary"
    ) {
      selectionModeLabel =
        "SALARY CAP";
      mobileSelectionModeLabel =
        "SAL";
    } else if (
      playerSelectionMode ===
      "no_salary"
    ) {
      selectionModeLabel =
        "NO SALARY CAP";
      mobileSelectionModeLabel =
        "NO SAL";
    }
  }

  return {
    leagueTypeLabel,
    mobileLeagueTypeLabel,
    selectionModeLabel,
    mobileSelectionModeLabel,
  };
}