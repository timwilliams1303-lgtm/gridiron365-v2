-- ============================================================
-- GRIDIRON365
-- NFL INJURY CRON — YEAR-TO-YEAR SAFE
--
-- PURPOSE
--   * Remove calendar-year season injection from the cron job.
--   * Let /api/nfl/sync-injuries resolve the authoritative NFL
--     season from ESPN's response, with its own rollover-safe fallback.
--   * Prevent January-June from being mislabeled as the new NFL season.
--
-- SAFE TO RE-RUN.
-- ============================================================

begin;

select cron.unschedule(jobid)
from cron.job
where jobname = 'gridiron365-nfl-injuries';

select cron.schedule(
  'gridiron365-nfl-injuries',
  '5-59/10 * * * *',
  $cron$
    select net.http_post(
      url :=
        'https://www.gridiron365fantasy.com/api/nfl/sync-injuries',

      headers :=
        jsonb_build_object(
          'Content-Type',
          'application/json',

          'x-gridiron-sync-secret',
          (
            select decrypted_secret
            from vault.decrypted_secrets
            where name = 'nfl_sync_secret'
            order by updated_at desc
            limit 1
          )
        ),

      body := '{}'::jsonb,

      timeout_milliseconds :=
        20000
    );
  $cron$
);

commit;

-- Verification
select
  jobid,
  jobname,
  schedule,
  active,
  command
from cron.job
where jobname = 'gridiron365-nfl-injuries';
