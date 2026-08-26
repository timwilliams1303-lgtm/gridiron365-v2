"use client";

import {
  type CSSProperties,
  useCallback,
  useEffect,
  useState,
} from "react";
import {
  useParams,
  useRouter,
} from "next/navigation";

import {
  createBrowserClient,
} from "@supabase/ssr";


const supabase =
  createBrowserClient(
    process.env
      .NEXT_PUBLIC_SUPABASE_URL!,

    process.env
      .NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
      process.env
        .NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

type LeagueRow = {
  id: string;
  name: string;
  league_type: string;
  season: number;
};

type MemberRow = {
  role: string;
};

type ReadinessRow = {
  ready: boolean;
  current_season: number;
  next_season: number;
  league_type: string;
  is_commissioner: boolean;
  playoffs_exist: boolean;
  playoffs_completed: boolean;
  champion_exists: boolean;
  next_season_matchups_exist: boolean;
  reason: string;
};

type RolloverResult = {
  success?: boolean;
  leagueId?: string;
  previousSeason?: number;
  newSeason?: number;
  championTeamId?: number;
  teamsReset?: number;
  previousSeasonMatchupsPreserved?: number;
  previousSeasonPlayoffRowsPreserved?: number;
  rostersPreservedForStage12D?: boolean;
  draftPreservedForStage12D?: boolean;
  message?: string;
};

type HistoryStatusRow = {
  valid: boolean;
  active_season: number;
  settings_season: number;
  seasons_in_sync: boolean;
  historical_seasons: number;
  historical_matchups: number;
  historical_regular_matchups: number;
  historical_playoff_matchups: number;
  historical_playoff_rows: number;
  historical_seed_rows: number;
  historical_lineups: number;
  historical_transactions: number;
  completed_seasons: number;
  completed_champions: number;
  completed_seasons_missing_champion: number;
  duplicate_playoff_season_rows: number;
  invalid_historical_matchup_team_refs: number;
  invalid_historical_seed_team_refs: number;
  invalid_historical_champion_refs: number;
  future_matchups: number;
  latest_snapshot_id: number | null;
  latest_snapshot_at: string | null;
  reason: string;
};

type SnapshotResult = {
  success?: boolean;
  snapshotId?: number;
  activeSeason?: number;
};

type SnapshotValidationResult = {
  success?: boolean;
  valid?: boolean;
  snapshotId?: number;
  message?: string;
};

type NewSeasonResetReadinessRow = {
  ready: boolean;
  active_season: number;
  previous_season: number;
  is_commissioner: boolean;
  seasons_in_sync: boolean;
  previous_season_completed: boolean;
  previous_champion_exists: boolean;
  history_snapshot_exists: boolean;
  history_snapshot_valid: boolean;
  history_snapshot_id:
    | number
    | null;
  already_prepared: boolean;
  active_roster_rows: number;
  current_season_lineups: number;
  current_season_transactions: number;
  draft_exists: boolean;
  draft_status:
    | string
    | null;
  previous_draft_picks: number;
  reason: string;
};

type NewSeasonPreparationResult = {
  success?: boolean;
  leagueId?: string;
  activeSeason?: number;
  previousSeason?: number;
  historySnapshotId?: number;
  historySnapshotValid?: boolean;
  draftId?:
    | string
    | null;
  draftArchived?: boolean;
  rosterRowsArchived?: number;
  draftPicksCleared?: number;
  draftSlotsCleared?: number;
  preseasonFreeAgentsLocked?: number;
  settingsUnlocked?: boolean;
  message?: string;
};

export default function CommissionerNewSeasonPage() {
  const params = useParams();
  const router = useRouter();

  const leagueId =
    typeof params.leagueId === "string"
      ? params.leagueId
      : "";

  const [league, setLeague] =
    useState<LeagueRow | null>(null);

  const [readiness, setReadiness] =
    useState<ReadinessRow | null>(
      null
    );

  const [
    rolloverResult,
    setRolloverResult,
  ] =
    useState<RolloverResult | null>(
      null
    );

  const [
    historyStatus,
    setHistoryStatus,
  ] =
    useState<HistoryStatusRow | null>(
      null
    );

  const [
    snapshotValidation,
    setSnapshotValidation,
  ] =
    useState<SnapshotValidationResult | null>(
      null
    );

  const [
    resetReadiness,
    setResetReadiness,
  ] =
    useState<NewSeasonResetReadinessRow | null>(
      null
    );

  const [
    preparationResult,
    setPreparationResult,
  ] =
    useState<NewSeasonPreparationResult | null>(
      null
    );

  const [
    preparingSeason,
    setPreparingSeason,
  ] =
    useState(false);

  const [loading, setLoading] =
    useState(true);

  const [working, setWorking] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [isError, setIsError] =
    useState(false);

  const loadPage =
    useCallback(async () => {
      if (!leagueId) {
        setIsError(true);
        setMessage(
          "League ID is missing."
        );
        setLoading(false);
        return;
      }

      setLoading(true);
      setMessage("");
      setIsError(false);

      try {
        const {
          data: userData,
          error: userError,
        } =
          await supabase.auth
            .getUser();

        const user =
          userData.user;

        if (
          userError ||
          !user
        ) {
          router.replace("/");
          return;
        }

        const [
          leagueResponse,
          memberResponse,
        ] =
          await Promise.all([
            supabase
              .from("leagues")
              .select(`
                id,
                name,
                league_type,
                season
              `)
              .eq(
                "id",
                leagueId
              )
              .single(),

            supabase
              .from(
                "league_members"
              )
              .select("role")
              .eq(
                "league_id",
                leagueId
              )
              .eq(
                "user_id",
                user.id
              )
              .maybeSingle(),
          ]);

        if (
          leagueResponse.error ||
          !leagueResponse.data
        ) {
          throw new Error(
            leagueResponse.error
              ?.message ??
              "The league could not be loaded."
          );
        }

        if (
          memberResponse.error ||
          !memberResponse.data
        ) {
          throw new Error(
            "League membership could not be verified."
          );
        }

        const membership =
          memberResponse.data as
            MemberRow;

        if (
          ![
            "commissioner",
            "co_commissioner",
          ].includes(
            membership.role
          )
        ) {
          router.replace(
            `/league/${leagueId}`
          );
          return;
        }

        const loadedLeague =
          leagueResponse.data as
            LeagueRow;

        if (
          loadedLeague.league_type !==
          "traditional"
        ) {
          router.replace(
            `/league/${leagueId}/feature-not-available?feature=New%20Season`
          );
          return;
        }

        setLeague(
          loadedLeague
        );

        const {
          data:
            readinessData,
          error:
            readinessError,
        } =
          await supabase.rpc(
            "get_traditional_rollover_readiness",
            {
              p_league_id:
                leagueId,
            }
          );

        if (
          readinessError
        ) {
          throw new Error(
            readinessError.message
          );
        }

        const readinessRow =
          Array.isArray(
            readinessData
          )
            ? readinessData[0]
            : readinessData;

        setReadiness(
          readinessRow
            ? (readinessRow as
                ReadinessRow)
            : null
        );


        const {
          data:
            historyStatusData,
          error:
            historyStatusError,
        } =
          await supabase.rpc(
            "get_traditional_history_preservation_status",
            {
              p_league_id:
                leagueId,
            }
          );

        if (
          historyStatusError
        ) {
          throw new Error(
            historyStatusError.message
          );
        }

        const historyRow =
          Array.isArray(
            historyStatusData
          )
            ? historyStatusData[0]
            : historyStatusData;

        setHistoryStatus(
          historyRow
            ? (historyRow as
                HistoryStatusRow)
            : null
        );


        const {
          data:
            resetReadinessData,
          error:
            resetReadinessError,
        } =
          await supabase.rpc(
            "get_traditional_new_season_reset_readiness",
            {
              p_league_id:
                leagueId,
            }
          );

        if (
          resetReadinessError
        ) {
          throw new Error(
            resetReadinessError.message
          );
        }

        const resetRow =
          Array.isArray(
            resetReadinessData
          )
            ? resetReadinessData[0]
            : resetReadinessData;

        setResetReadiness(
          resetRow
            ? (resetRow as
                NewSeasonResetReadinessRow)
            : null
        );
      } catch (error) {
        setIsError(true);
        setMessage(
          error instanceof Error
            ? error.message
            : "New-season controls could not be loaded."
        );
      } finally {
        setLoading(false);
      }
    }, [
      leagueId,
      router,
    ]);

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  async function startNextSeason() {
    if (
      !league ||
      !readiness ||
      !readiness.ready ||
      working
    ) {
      return;
    }

    const firstConfirm =
      window.confirm(
        `Start the ${readiness.next_season} season for ${league.name}?\n\nThis advances the active league season and resets current-season team records, playoff seed, elimination status, FAAB, waiver priority, and draft position.\n\nThe completed Season Recap and League History are permanently preserved before rollover.`
      );

    if (!firstConfirm) {
      return;
    }

    const finalConfirm =
      window.confirm(
        `FINAL CONFIRMATION\n\nRoll ${league.name} from ${readiness.current_season} to ${readiness.next_season}?\n\nThe active season will change immediately.`
      );

    if (!finalConfirm) {
      return;
    }

    setWorking(true);
    setMessage("");
    setIsError(false);

    try {
      // --------------------------------------------------------------
      // G365 RECAP/HISTORY SAFETY GATE
      // Before advancing the active league season, make absolutely sure
      // the completed season has been permanently archived through the
      // Season Recap + League History pipeline.
      // --------------------------------------------------------------
      const {
        data: recapData,
        error: recapError,
      } =
        await supabase.rpc(
          "ensure_traditional_season_recap_finalized",
          {
            p_league_id:
              league.id,
            p_season:
              readiness.current_season,
          }
        );

      if (recapError) {
        throw new Error(
          `Season Recap protection failed: ${recapError.message}`
        );
      }

      const recapResult =
        (recapData ?? {}) as {
          success?: boolean;
          generated?: boolean;
          already_existed?: boolean;
          reason?: string;
          readiness?: unknown;
        };

      if (
        recapResult.success === false ||
        recapResult.generated === false
      ) {
        throw new Error(
          recapResult.reason === "season_not_ready"
            ? "The completed season is not fully ready to archive yet. Finish every championship/playoff result before starting the new season."
            : "The completed season could not be permanently archived. New-season rollover was stopped to protect league history."
        );
      }

      const {
        data:
          snapshotData,
        error:
          snapshotError,
      } =
        await supabase.rpc(
          "capture_traditional_history_snapshot",
          {
            p_league_id:
              league.id,
          }
        );

      if (snapshotError) {
        throw new Error(
          `History snapshot failed: ${snapshotError.message}`
        );
      }

      const snapshot =
        (snapshotData ?? {}) as
          SnapshotResult;

      if (!snapshot.snapshotId) {
        throw new Error(
          "History snapshot was created without a snapshot ID."
        );
      }

      const {
        data,
        error,
      } =
        await supabase.rpc(
          "rollover_traditional_league_season",
          {
            p_league_id:
              league.id,
            p_expected_current_season:
              readiness.current_season,
          }
        );

      if (error) {
        throw new Error(
          error.message
        );
      }

      const result =
        (data ?? {}) as
          RolloverResult;

      const {
        data:
          validationData,
        error:
          validationError,
      } =
        await supabase.rpc(
          "validate_traditional_history_snapshot",
          {
            p_snapshot_id:
              snapshot.snapshotId,
          }
        );

      if (validationError) {
        throw new Error(
          `Season advanced, but history validation failed to run: ${validationError.message}`
        );
      }

      const validation =
        (validationData ?? {}) as
          SnapshotValidationResult;

      setSnapshotValidation(
        validation
      );

      setRolloverResult(
        result
      );

      const newSeason =
        Number(
          result.newSeason ??
            readiness.next_season
        );

      setLeague({
        ...league,
        season:
          newSeason,
      });

      setMessage(
        validation.valid
          ? `Season ${newSeason} started successfully. Historical data preservation was verified.`
          : `Season ${newSeason} started, but the historical snapshot did not match. Review History Protection before continuing.`
      );

      setIsError(
        validation.valid ===
          false
      );

      setReadiness(null);
    } catch (error) {
      setIsError(true);
      setMessage(
        error instanceof Error
          ? error.message
          : "The league could not be rolled over."
      );
    } finally {
      setWorking(false);
    }
  }

  async function prepareNewSeasonDraft() {
    if (
      !league ||
      !resetReadiness ||
      !resetReadiness.ready ||
      preparingSeason
    ) {
      return;
    }

    const firstConfirm =
      window.confirm(
        `Prepare ${resetReadiness.active_season} for a new draft?\n\nThis will archive the previous draft, empty all active fantasy rosters, reset the reusable draft, and lock the preseason free-agent pool until the new draft is finalized.`
      );

    if (!firstConfirm) {
      return;
    }

    const finalConfirm =
      window.confirm(
        `FINAL CONFIRMATION\n\nEmpty the active rosters and reset the draft for ${league.name} — ${resetReadiness.active_season}?`
      );

    if (!finalConfirm) {
      return;
    }

    setPreparingSeason(true);
    setMessage("");
    setIsError(false);

    try {
      const {
        data,
        error,
      } =
        await supabase.rpc(
          "prepare_traditional_new_season",
          {
            p_league_id:
              league.id,
            p_expected_active_season:
              resetReadiness.active_season,
          }
        );

      if (error) {
        throw new Error(
          error.message
        );
      }

      const result =
        (data ?? {}) as
          NewSeasonPreparationResult;

      setPreparationResult(
        result
      );

      setMessage(
        result.message ??
          `Season ${resetReadiness.active_season} is ready for its new draft.`
      );

      setResetReadiness({
        ...resetReadiness,
        ready:
          false,
        already_prepared:
          true,
        active_roster_rows:
          0,
        previous_draft_picks:
          0,
        reason:
          "This active season has already been prepared for its new draft.",
      });
    } catch (error) {
      setIsError(true);
      setMessage(
        error instanceof Error
          ? error.message
          : "The new-season draft and roster reset could not be completed."
      );
    } finally {
      setPreparingSeason(false);
    }
  }

  if (loading) {
    return (
      <main
        style={
          styles.page
        }
      >
        <section
          style={
            styles.loadingCard
          }
        >
          Loading new-season controls...
        </section>
      </main>
    );
  }

  if (!league) {
    return (
      <main
        style={
          styles.page
        }
      >
        <section
          style={
            styles.errorCard
          }
        >
          <p>
            {message ||
              "The league could not be loaded."}
          </p>

          <button
            style={
              styles.secondaryButton
            }
            type="button"
            onClick={() =>
              router.push(
                `/league/${leagueId}/commissioner`
              )
            }
          >
            Return to Commissioner Center
          </button>
        </section>
      </main>
    );
  }

  return (
    <main
      style={
        styles.page
      }
    >
      <section
        style={
          styles.container
        }
      >
        <header
          style={
            styles.header
          }
        >
          <div>
            <p
              style={
                styles.eyebrow
              }
            >
              GRIDIRON365
            </p>

            <h1
              style={
                styles.title
              }
            >
              New Season
            </h1>

            <p
              style={
                styles.muted
              }
            >
              {league.name}
              {" · "}
              Traditional
              {" · "}
              Current Season{" "}
              {league.season}
            </p>
          </div>

          <div
            style={
              styles.headerActions
            }
          >
            <button
              style={
                styles.secondaryButton
              }
              type="button"
              onClick={() =>
                router.push(
                  `/league/${league.id}`
                )
              }
            >
              League Home
            </button>

            <button
              style={
                styles.secondaryButton
              }
              type="button"
              onClick={() =>
                router.push(
                  `/league/${league.id}/commissioner`
                )
              }
            >
              Commissioner Center
            </button>
          </div>
        </header>

        {message ? (
          <div
            style={
              isError
                ? styles.errorCard
                : styles.successCard
            }
          >
            {message}
          </div>
        ) : null}

        {rolloverResult ? (
          <section
            style={
              styles.successPanel
            }
          >
            <p
              style={
                styles.sectionLabel
              }
            >
              NEW SEASON STARTED
            </p>

            <h2
              style={
                styles.sectionTitle
              }
            >
              Season{" "}
              {
                rolloverResult.newSeason
              }{" "}
              is now active
            </h2>

            <p
              style={
                styles.muted
              }
            >
              The previous season remains preserved in History. Team IDs and owners were retained.
            </p>

            <div
              style={
                styles.summaryGrid
              }
            >
              <SummaryCard
                label="PREVIOUS SEASON"
                value={String(
                  rolloverResult.previousSeason ??
                    "—"
                )}
              />

              <SummaryCard
                label="NEW SEASON"
                value={String(
                  rolloverResult.newSeason ??
                    league.season
                )}
              />

              <SummaryCard
                label="TEAMS RESET"
                value={String(
                  rolloverResult.teamsReset ??
                    0
                )}
              />

              <SummaryCard
                label="MATCHUPS PRESERVED"
                value={String(
                  rolloverResult.previousSeasonMatchupsPreserved ??
                    0
                )}
              />
            </div>

            <div
              style={
                snapshotValidation?.valid
                  ? styles.historyPassCard
                  : styles.historyFailCard
              }
            >
              <strong>
                History Protection:
              </strong>{" "}
              {snapshotValidation?.valid
                ? "PASS — the post-rollover history matches the pre-rollover snapshot."
                : "CHECK REQUIRED — the post-rollover history did not match the saved snapshot."}
            </div>

            <div
              style={
                styles.nextStepCard
              }
            >
              <strong>
                Next:
              </strong>{" "}
              The completed Season Recap, League History, records, badges and owner legacy are preserved. Next, prepare the active rosters and draft for the new season.
            </div>
          </section>
        ) : (
          <>
            <section
              style={
                styles.heroCard
              }
            >
              <div>
                <p
                  style={
                    styles.sectionLabel
                  }
                >
                  SEASON ROLLOVER
                </p>

                <h2
                  style={
                    styles.sectionTitle
                  }
                >
                  {readiness
                    ? `${readiness.current_season} → ${readiness.next_season}`
                    : "Readiness unavailable"}
                </h2>

                <p
                  style={
                    styles.muted
                  }
                >
                  A Traditional league can only start its next season after the current playoffs are completed and a champion is recorded.
                </p>
              </div>

              <span
                style={
                  readiness?.ready
                    ? styles.readyBadge
                    : styles.notReadyBadge
                }
              >
                {readiness?.ready
                  ? "READY"
                  : "NOT READY"}
              </span>
            </section>

            <section
              style={
                styles.card
              }
            >
              <p
                style={
                  styles.sectionLabel
                }
              >
                ROLLOVER CHECKLIST
              </p>

              <div
                style={
                  styles.checkGrid
                }
              >
                <CheckRow
                  label="Commissioner Access"
                  passed={
                    Boolean(
                      readiness?.is_commissioner
                    )
                  }
                  detail="Only the commissioner or co-commissioner can start a new season."
                />

                <CheckRow
                  label="Playoff Record Exists"
                  passed={
                    Boolean(
                      readiness?.playoffs_exist
                    )
                  }
                  detail="The current season must have a Traditional playoff record."
                />

                <CheckRow
                  label="Playoffs Complete"
                  passed={
                    Boolean(
                      readiness?.playoffs_completed
                    )
                  }
                  detail="All required playoff rounds must be finished."
                />

                <CheckRow
                  label="Champion Recorded"
                  passed={
                    Boolean(
                      readiness?.champion_exists
                    )
                  }
                  detail="The completed season must have a champion."
                />

                <CheckRow
                  label="Next Season Is Empty"
                  passed={
                    !Boolean(
                      readiness?.next_season_matchups_exist
                    )
                  }
                  detail="No matchups may already exist for the next season."
                />
              </div>
            </section>

            <section
              style={
                styles.warningCard
              }
            >
              <p
                style={
                  styles.sectionLabel
                }
              >
                SEASON ROLLOVER DETAILS
              </p>

              <div
                style={
                  styles.twoColumn
                }
              >
                <InfoList
                  title="Reset for the new active season"
                  items={[
                    "Wins, losses, and ties",
                    "Points for and points against",
                    "Playoff seed and elimination status",
                    "FAAB balance",
                    "Waiver priority",
                    "Draft position",
                  ]}
                />

                <InfoList
                  title="Preserved"
                  items={[
                    "Fantasy team IDs and owners",
                    "Completed matchups",
                    "Champions and playoff history",
                    "Season History and Trophy Case source data",
                    "Old weekly lineups and transactions",
                    "Current roster/draft remains untouched until new-season setup",
                  ]}
                />
              </div>
            </section>

            <section
              style={
                styles.card
              }
            >
              <SectionMiniHeader
                label="HISTORY PROTECTION"
                title="Preservation Status"
              />

              <div
                style={
                  styles.summaryGrid
                }
              >
                <SummaryCard
                  label="INTEGRITY"
                  value={
                    historyStatus?.valid
                      ? "PASS"
                      : "CHECK"
                  }
                />

                <SummaryCard
                  label="HISTORICAL SEASONS"
                  value={String(
                    historyStatus?.historical_seasons ??
                      0
                  )}
                />

                <SummaryCard
                  label="HISTORICAL MATCHUPS"
                  value={String(
                    historyStatus?.historical_matchups ??
                      0
                  )}
                />

                <SummaryCard
                  label="CHAMPIONS"
                  value={String(
                    historyStatus?.completed_champions ??
                      0
                  )}
                />
              </div>

              <p
                style={
                  styles.historyReason
                }
              >
                {historyStatus?.reason ??
                  "Historical integrity status is unavailable."}
              </p>

              <div
                style={
                  styles.protectionList
                }
              >
                <ProtectionRow
                  label="League season values match"
                  passed={
                    Boolean(
                      historyStatus?.seasons_in_sync
                    )
                  }
                />

                <ProtectionRow
                  label="No completed season is missing a champion"
                  passed={
                    Number(
                      historyStatus?.completed_seasons_missing_champion ??
                        0
                    ) === 0
                  }
                />

                <ProtectionRow
                  label="No duplicate playoff-season rows"
                  passed={
                    Number(
                      historyStatus?.duplicate_playoff_season_rows ??
                        0
                    ) === 0
                  }
                />

                <ProtectionRow
                  label="Historical team references are valid"
                  passed={
                    Number(
                      historyStatus?.invalid_historical_matchup_team_refs ??
                        0
                    ) === 0 &&
                    Number(
                      historyStatus?.invalid_historical_seed_team_refs ??
                        0
                    ) === 0 &&
                    Number(
                      historyStatus?.invalid_historical_champion_refs ??
                        0
                    ) === 0
                  }
                />

                <ProtectionRow
                  label="No matchup data exists beyond the active season"
                  passed={
                    Number(
                      historyStatus?.future_matchups ??
                        0
                    ) === 0
                  }
                />
              </div>
            </section>

            <section
              style={
                styles.card
              }
            >
              <SectionMiniHeader
                label="NEW SEASON SETUP"
                title="New Draft & Roster Reset"
              />

              <div
                style={
                  styles.summaryGrid
                }
              >
                <SummaryCard
                  label="ACTIVE SEASON"
                  value={String(
                    resetReadiness?.active_season ??
                      league.season
                  )}
                />

                <SummaryCard
                  label="ACTIVE ROSTER ROWS"
                  value={String(
                    resetReadiness?.active_roster_rows ??
                      0
                  )}
                />

                <SummaryCard
                  label="OLD DRAFT PICKS"
                  value={String(
                    resetReadiness?.previous_draft_picks ??
                      0
                  )}
                />

                <SummaryCard
                  label="HISTORY SNAPSHOT"
                  value={
                    resetReadiness?.history_snapshot_valid
                      ? "VALID"
                      : "WAITING"
                  }
                />
              </div>

              <p
                style={
                  styles.historyReason
                }
              >
                {preparationResult?.message ??
                  resetReadiness?.reason ??
                  "New-season draft readiness is unavailable."}
              </p>

              <div
                style={
                  styles.protectionList
                }
              >
                <ProtectionRow
                  label="Previous season completed"
                  passed={
                    Boolean(
                      resetReadiness?.previous_season_completed
                    )
                  }
                />

                <ProtectionRow
                  label="Previous champion preserved"
                  passed={
                    Boolean(
                      resetReadiness?.previous_champion_exists
                    )
                  }
                />

                <ProtectionRow
                  label="Historical data snapshot validated"
                  passed={
                    Boolean(
                      resetReadiness?.history_snapshot_valid
                    )
                  }
                />

                <ProtectionRow
                  label="No new-season lineups or transactions exist yet"
                  passed={
                    Number(
                      resetReadiness?.current_season_lineups ??
                        0
                    ) === 0 &&
                    Number(
                      resetReadiness?.current_season_transactions ??
                        0
                    ) === 0
                  }
                />
              </div>

              {preparationResult ? (
                <div
                  style={
                    styles.preparationResult
                  }
                >
                  <strong>
                    New-season preparation complete.
                  </strong>

                  <span>
                    Rosters archived:{" "}
                    {preparationResult.rosterRowsArchived ??
                      0}
                  </span>

                  <span>
                    Draft picks archived/cleared:{" "}
                    {preparationResult.draftPicksCleared ??
                      0}
                  </span>

                  <span>
                    Draft slots cleared:{" "}
                    {preparationResult.draftSlotsCleared ??
                      0}
                  </span>

                  <span>
                    Locked preseason free agents:{" "}
                    {preparationResult.preseasonFreeAgentsLocked ??
                      0}
                  </span>

                  <button
                    type="button"
                    style={
                      styles.secondaryButton
                    }
                    onClick={() =>
                      router.push(
                        `/league/${league.id}/commissioner/draft`
                      )
                    }
                  >
                    Configure New Draft
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  style={{
                    ...styles.primaryButton,
                    marginTop:
                      "16px",
                    ...(!resetReadiness?.ready ||
                    preparingSeason
                      ? styles.disabledButton
                      : {}),
                  }}
                  disabled={
                    !resetReadiness?.ready ||
                    preparingSeason
                  }
                  onClick={() =>
                    void prepareNewSeasonDraft()
                  }
                >
                  {preparingSeason
                    ? "Preparing New Season..."
                    : resetReadiness?.ready
                      ? `Prepare ${resetReadiness.active_season} Draft & Rosters`
                      : "Draft & Roster Reset Not Ready"}
                </button>
              )}
            </section>

            <section
              style={
                styles.actionCard
              }
            >
              <div>
                <p
                  style={
                    styles.sectionLabel
                  }
                >
                  START NEXT SEASON
                </p>

                <h2
                  style={
                    styles.actionTitle
                  }
                >
                  {readiness
                    ? `Start ${readiness.next_season}`
                    : "Start Next Season"}
                </h2>

                <p
                  style={
                    styles.reason
                  }
                >
                  {readiness?.reason ??
                    "Rollover readiness could not be determined."}
                </p>
              </div>

              <button
                type="button"
                style={{
                  ...styles.primaryButton,
                  ...(!readiness?.ready ||
                  working
                    ? styles.disabledButton
                    : {}),
                }}
                disabled={
                  !readiness?.ready ||
                  working
                }
                onClick={() =>
                  void startNextSeason()
                }
              >
                {working
                  ? "Starting New Season..."
                  : readiness
                    ? `Start ${readiness.next_season} Season`
                    : "Start Next Season"}
              </button>
            </section>
          </>
        )}
      </section>
    </main>
  );
}

function CheckRow({
  label,
  passed,
  detail,
}: {
  label: string;
  passed: boolean;
  detail: string;
}) {
  return (
    <div
      style={
        styles.checkRow
      }
    >
      <span
        style={
          passed
            ? styles.checkPassed
            : styles.checkFailed
        }
      >
        {passed
          ? "✓"
          : "—"}
      </span>

      <div>
        <strong>
          {label}
        </strong>

        <p
          style={
            styles.checkDetail
          }
        >
          {detail}
        </p>
      </div>
    </div>
  );
}

function SectionMiniHeader({
  label,
  title,
}: {
  label: string;
  title: string;
}) {
  return (
    <div
      style={{
        marginBottom:
          "14px",
      }}
    >
      <p
        style={
          styles.sectionLabel
        }
      >
        {label}
      </p>

      <h2
        style={
          styles.sectionTitle
        }
      >
        {title}
      </h2>
    </div>
  );
}

function ProtectionRow({
  label,
  passed,
}: {
  label: string;
  passed: boolean;
}) {
  return (
    <div
      style={
        styles.protectionRow
      }
    >
      <span
        style={
          passed
            ? styles.checkPassed
            : styles.checkFailed
        }
      >
        {passed
          ? "✓"
          : "!"}
      </span>

      <strong>
        {label}
      </strong>
    </div>
  );
}

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <article
      style={
        styles.summaryCard
      }
    >
      <span
        style={
          styles.summaryLabel
        }
      >
        {label}
      </span>

      <strong
        style={
          styles.summaryValue
        }
      >
        {value}
      </strong>
    </article>
  );
}

function InfoList({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  return (
    <div>
      <h3
        style={
          styles.infoTitle
        }
      >
        {title}
      </h3>

      <ul
        style={
          styles.infoList
        }
      >
        {items.map(
          (item) => (
            <li
              key={
                item
              }
            >
              {item}
            </li>
          )
        )}
      </ul>
    </div>
  );
}

const styles: Record<
  string,
  CSSProperties
> = {
  page: {
    minHeight: "100vh",
    padding: "28px",
    background: "#00140d",
    color: "#ffffff",
    fontFamily: "Arial, sans-serif",
  },

  container: {
    width: "100%",
    maxWidth: "1180px",
    margin: "0 auto",
    display: "grid",
    gap: "18px",
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "18px",
    flexWrap: "wrap",
  },

  headerActions: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
  },

  eyebrow: {
    margin: 0,
    color: "#98ff3f",
    fontWeight: 900,
    letterSpacing: "0.08em",
    fontSize: "11px",
  },

  title: {
    margin: "7px 0",
    fontSize: "38px",
  },

  muted: {
    margin: 0,
    color: "#9eb0a6",
    lineHeight: 1.6,
  },

  heroCard: {
    padding: "22px",
    border: "1px solid #315243",
    borderRadius: "14px",
    background:
      "linear-gradient(135deg, #0b2117 0%, #07130d 100%)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "18px",
    flexWrap: "wrap",
  },

  card: {
    padding: "20px",
    border: "1px solid #29483a",
    borderRadius: "14px",
    background: "#06110c",
  },

  warningCard: {
    padding: "20px",
    border: "1px solid #5d5126",
    borderRadius: "14px",
    background: "#191608",
  },

  actionCard: {
    padding: "22px",
    border: "1px solid #315243",
    borderRadius: "14px",
    background: "#07150f",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "20px",
    flexWrap: "wrap",
  },

  successPanel: {
    padding: "24px",
    border: "1px solid #4e7e55",
    borderRadius: "14px",
    background: "#0b2414",
    display: "grid",
    gap: "18px",
  },

  loadingCard: {
    width: "min(700px, 100%)",
    margin: "80px auto",
    padding: "22px",
    border: "1px solid #29483a",
    borderRadius: "14px",
    background: "#07150f",
  },

  errorCard: {
    padding: "14px 16px",
    border: "1px solid #7b3030",
    borderRadius: "10px",
    background: "#2a1010",
    color: "#ffd9d9",
  },

  successCard: {
    padding: "14px 16px",
    border: "1px solid #42734c",
    borderRadius: "10px",
    background: "#102b17",
    color: "#caffb6",
  },

  sectionLabel: {
    margin: 0,
    color: "#98ff3f",
    fontSize: "10px",
    fontWeight: 900,
    letterSpacing: "0.08em",
  },

  sectionTitle: {
    margin: "7px 0",
    fontSize: "27px",
  },

  actionTitle: {
    margin: "6px 0",
    fontSize: "25px",
  },

  readyBadge: {
    padding: "8px 12px",
    border: "1px solid #98ff3f",
    borderRadius: "999px",
    color: "#98ff3f",
    fontWeight: 900,
    fontSize: "11px",
  },

  notReadyBadge: {
    padding: "8px 12px",
    border: "1px solid #7d6250",
    borderRadius: "999px",
    color: "#e5b38e",
    fontWeight: 900,
    fontSize: "11px",
  },

  checkGrid: {
    marginTop: "14px",
    display: "grid",
    gap: "10px",
  },

  checkRow: {
    display: "grid",
    gridTemplateColumns: "34px 1fr",
    gap: "10px",
    alignItems: "start",
    padding: "12px",
    border: "1px solid #203b30",
    borderRadius: "10px",
    background: "#07150f",
  },

  checkPassed: {
    width: "28px",
    height: "28px",
    display: "grid",
    placeItems: "center",
    borderRadius: "999px",
    background: "#173d22",
    color: "#98ff3f",
    fontWeight: 900,
  },

  checkFailed: {
    width: "28px",
    height: "28px",
    display: "grid",
    placeItems: "center",
    borderRadius: "999px",
    background: "#322019",
    color: "#dca37b",
    fontWeight: 900,
  },

  checkDetail: {
    margin: "4px 0 0",
    color: "#93a79c",
    fontSize: "12px",
    lineHeight: 1.5,
  },

  twoColumn: {
    marginTop: "14px",
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(260px, 1fr))",
    gap: "18px",
  },

  infoTitle: {
    margin: "0 0 8px",
    fontSize: "16px",
  },

  infoList: {
    margin: 0,
    paddingLeft: "20px",
    color: "#c1cec7",
    lineHeight: 1.8,
  },

  reason: {
    margin: 0,
    color: "#b9c6bf",
    maxWidth: "720px",
  },

  primaryButton: {
    padding: "13px 18px",
    border: "1px solid #98ff3f",
    borderRadius: "9px",
    background: "#98ff3f",
    color: "#07130d",
    fontWeight: 900,
    cursor: "pointer",
  },

  secondaryButton: {
    padding: "10px 14px",
    border: "1px solid #315243",
    borderRadius: "8px",
    background: "#123522",
    color: "#98ff3f",
    fontWeight: 900,
    cursor: "pointer",
  },

  disabledButton: {
    opacity: 0.45,
    cursor: "not-allowed",
  },

  summaryGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(160px, 1fr))",
    gap: "10px",
  },

  summaryCard: {
    padding: "14px",
    border: "1px solid #315243",
    borderRadius: "10px",
    background: "#07150f",
    display: "grid",
    gap: "7px",
  },

  summaryLabel: {
    color: "#93a79c",
    fontSize: "10px",
    fontWeight: 900,
    letterSpacing: "0.05em",
  },

  summaryValue: {
    fontSize: "23px",
  },

  historyReason: {
    margin:
      "14px 0",
    color:
      "#b9c6bf",
    lineHeight:
      1.6,
  },

  protectionList: {
    display:
      "grid",
    gap:
      "8px",
  },

  protectionRow: {
    display:
      "grid",
    gridTemplateColumns:
      "34px 1fr",
    gap:
      "10px",
    alignItems:
      "center",
    padding:
      "10px",
    border:
      "1px solid #203b30",
    borderRadius:
      "9px",
    background:
      "#07150f",
  },

  historyPassCard: {
    padding:
      "13px",
    border:
      "1px solid #4e7e55",
    borderRadius:
      "10px",
    background:
      "#102b17",
    color:
      "#caffb6",
    lineHeight:
      1.5,
  },

  historyFailCard: {
    padding:
      "13px",
    border:
      "1px solid #7b3030",
    borderRadius:
      "10px",
    background:
      "#2a1010",
    color:
      "#ffd9d9",
    lineHeight:
      1.5,
  },

  preparationResult: {
    marginTop:
      "16px",
    padding:
      "14px",
    border:
      "1px solid #4e7e55",
    borderRadius:
      "10px",
    background:
      "#102b17",
    display:
      "grid",
    gap:
      "8px",
    color:
      "#caffb6",
  },

  nextStepCard: {
    padding: "13px",
    border: "1px solid #315243",
    borderRadius: "10px",
    background: "#07150f",
    color: "#c6d2cb",
    lineHeight: 1.5,
  },
};