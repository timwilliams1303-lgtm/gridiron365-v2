export type TraditionalDraftType =
  | "redraft"
  | "startup"
  | "dynasty";

export function isDynastyDraft(
  draftType: TraditionalDraftType
) {
  return (
    draftType === "startup" ||
    draftType === "dynasty"
  );
}

export function isStartupDraft(
  draftType: TraditionalDraftType
) {
  return draftType === "startup";
}

export function isAnnualDynastyDraft(
  draftType: TraditionalDraftType
) {
  return draftType === "dynasty";
}

export function isLinearDraft(
  draftType: TraditionalDraftType
) {
  return isDynastyDraft(draftType);
}

export function getDraftFormatLabel(
  draftType: TraditionalDraftType
) {
  return isLinearDraft(draftType)
    ? "Linear Draft"
    : "Snake Draft";
}

export function getDraftTitle(
  draftType: TraditionalDraftType,
  season: number
) {
  if (draftType === "startup") {
    return "NFL DYNASTY • STARTUP DRAFT";
  }

  if (draftType === "dynasty") {
    return `NFL DYNASTY • ${season} ANNUAL DRAFT`;
  }

  return "NFL REDRAFT • LIVE DRAFT";
}

export function getCompletedDraftTitle(
  draftType: TraditionalDraftType,
  season: number
) {
  if (draftType === "startup") {
    return "DYNASTY STARTUP DRAFT COMPLETE";
  }

  if (draftType === "dynasty") {
    return `${season} DYNASTY DRAFT COMPLETE`;
  }

  return "DRAFT COMPLETE";
}

export function getDraftSlotForPick({
  draftType,
  round,
  pickInRound,
  teamCount,
}: {
  draftType: TraditionalDraftType;
  round: number;
  pickInRound: number;
  teamCount: number;
}) {
  if (isLinearDraft(draftType)) {
    return pickInRound;
  }

  return round % 2 === 1
    ? pickInRound
    : teamCount - pickInRound + 1;
}

export function getPickInRoundForSlot({
  draftType,
  round,
  draftSlot,
  teamCount,
}: {
  draftType: TraditionalDraftType;
  round: number;
  draftSlot: number;
  teamCount: number;
}) {
  if (isLinearDraft(draftType)) {
    return draftSlot;
  }

  return round % 2 === 1
    ? draftSlot
    : teamCount - draftSlot + 1;
}

export function getRoundDirection(
  draftType: TraditionalDraftType,
  round: number
) {
  if (isLinearDraft(draftType)) {
    return "→";
  }

  return round % 2 === 1
    ? "→"
    : "←";
}