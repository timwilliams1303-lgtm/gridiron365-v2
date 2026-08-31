do $$
begin
  if exists (
    select 1
    from cron.job
    where jobname = 'gridiron365-pickem-line-sync'
  ) then
    perform cron.unschedule('gridiron365-pickem-line-sync');
  end if;
end $$;

select cron.schedule(
  'gridiron365-pickem-line-sync',
  '7 * * * *',
  $$
  select net.http_post(
    url := 'https://www.gridiron365fantasy.com/api/pickem/sync-lines',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-gridiron-sync-secret', current_setting('app.settings.nfl_sync_secret', true)
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Verify:
select jobid, jobname, schedule, active
from cron.job
where jobname = 'gridiron365-pickem-line-sync';
