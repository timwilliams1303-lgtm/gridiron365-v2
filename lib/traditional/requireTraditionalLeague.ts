import "server-only";

import {
  redirect,
} from "next/navigation";

import {
  requireLeagueMember,
} from "@/lib/leagues/requireLeagueMember";


export async function requireTraditionalLeague(
  leagueId: string
) {
  const access =
    await requireLeagueMember(
      leagueId
    );

  if (
    access.league
      .leagueType !==
      "traditional"
  ) {
    redirect(
      `/league/${leagueId}`
    );
  }

  return access;
}