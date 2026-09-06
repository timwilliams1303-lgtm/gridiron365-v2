-- ============================================================
-- 20260906_013_nhl_pickem_runtime_hardening.sql
--
-- Purpose:
-- 1. Preserve/normalize league constraints for NHL Pick'em
-- 2. Ensure NHL Pick'em uses player_selection_mode = 'standard'
-- 3. Recreate NHL Pick'em lifecycle cron idempotently
-- 4. Recreate NHL Pick'em line-sync cron using nhl_sync_secret
--
-- IMPORTANT:
-- - Does not modify any NFL cron job.
-- - Does not change the NHL live orchestrator yet.
-- ============================================================


-- ============================================================
-- 1. LEAGUE CONSTRAINTS
-- ============================================================

alter table public.leagues
drop constraint if exists leagues_league_type_g365_check;

alter table public.leagues
add constraint leagues_league_type_g365_check
check (
  league_type = any (
    array[
      'traditional'::text,
      'season_long'::text,
      'nfl_playoffs'::text,
      'pickem'::text,
      'nhl_pickem'::text
    ]
  )
);


alter table public.leagues
drop constraint if exists leagues_player_selection_mode_g365_check;

alter table public.leagues
add constraint leagues_player_selection_mode_g365_check
check (
  player_selection_mode = any (
    array[
      'draft'::text,
      'salary'::text,
      'no_salary'::text,
      'pickem'::text,
      'standard'::text
    ]
  )
);


alter table public.leagues
drop constraint if exists leagues_type_mode_g365_check;

alter table public.leagues
add constraint leagues_type_mode_g365_check
check (
  (
    league_type = 'traditional'
    and player_selection_mode = 'draft'
  )
  or
  (
    league_type = any (
      array[
        'season_long'::text,
        'nfl_playoffs'::text
      ]
    )
    and player_selection_mode = any (
      array[
        'salary'::text,
        'no_salary'::text
      ]
    )
  )
  or
  (
    league_type = 'pickem'
    and player_selection_mode = 'pickem'
  )
  or
  (
    league_type = 'nhl_pickem'
    and player_selection_mode = 'standard'
  )
);


-- ============================================================
-- 2. NHL PICK'EM LIFECYCLE CRON
-- ============================================================

do $$
begin
  if exists (
    select 1
    from cron.job
    where jobname = 'gridiron365-nhl-pickem-lifecycle'
  ) then
    perform cron.unschedule(
      'gridiron365-nhl-pickem-lifecycle'
    );
  end if;
end
$$;


select cron.schedule(
  'gridiron365-nhl-pickem-lifecycle',
  '*/15 * * * *',
  $cron$
    select
      public.prepare_active_nhl_pickem_games(14);

    select
      public.lock_due_nhl_pickem_picks();

    select
      public.grade_final_nhl_pickem_games(100);

    select
      public.advance_nhl_pickem_period_lifecycle();
  $cron$
);


-- ============================================================
-- 3. NHL PICK'EM LINE-SYNC CRON
--
-- Uses NHL-specific Supabase Vault secret:
--   nhl_sync_secret
--
-- Does not use nfl_sync_secret.
-- ============================================================

do $$
begin
  if exists (
    select 1
    from cron.job
    where jobname = 'gridiron365-nhl-pickem-line-sync'
  ) then
    perform cron.unschedule(
      'gridiron365-nhl-pickem-line-sync'
    );
  end if;
end
$$;


select cron.schedule(
  'gridiron365-nhl-pickem-line-sync',
  '12 * * * *',
  $cron$
    select net.http_post(
      url :=
        'https://www.gridiron365fantasy.com/api/nhl/sync-pickem-lines',

      headers :=
        jsonb_build_object(
          'Content-Type',
          'application/json',
          'x-gridiron-sync-secret',
          (
            select decrypted_secret
            from vault.decrypted_secrets
            where name = 'nhl_sync_secret'
            order by updated_at desc
            limit 1
          )
        ),

      body :=
        '{}'::jsonb,

      timeout_milliseconds :=
        25000
    );
  $cron$
);


-- ============================================================
-- 4. SAFETY CHECK
--
-- Fail migration if NHL Vault secret does not exist.
-- This prevents silently installing a cron that will always 401.
-- ============================================================

do $$
begin
  if not exists (
    select 1
    from vault.decrypted_secrets
    where name = 'nhl_sync_secret'
  ) then
    raise exception
      'Required Supabase Vault secret nhl_sync_secret does not exist.';
  end if;
end
$$;
-- ============================================================
-- NHL LIVE ORCHESTRATOR CRON
-- ============================================================

do $$
begin
  if exists (
    select 1
    from cron.job
    where jobname =
      'gridiron365-nhl-live-orchestrator'
  ) then
    perform cron.unschedule(
      'gridiron365-nhl-live-orchestrator'
    );
  end if;
end
$$;

select cron.schedule(
  'gridiron365-nhl-live-orchestrator',
  '* * * * *',
  $cron$
    select net.http_post(
      url :=
        'https://www.gridiron365fantasy.com/api/nhl/orchestrate-live',

      headers :=
        jsonb_build_object(
          'Content-Type',
          'application/json',
          'x-gridiron-sync-secret',
          (
            select decrypted_secret
            from vault.decrypted_secrets
            where name =
              'nhl_sync_secret'
            order by updated_at desc
            limit 1
          )
        ),

      body :=
        '{}'::jsonb,

      timeout_milliseconds :=
        120000
    );
  $cron$
);