do $$
begin
  if exists (
    select 1
    from cron.job
    where jobname = 'gridiron365-pickem-line-sync'
  ) then
    perform cron.unschedule(
      'gridiron365-pickem-line-sync'
    );
  end if;
end
$$;

select cron.schedule(
  'gridiron365-pickem-line-sync',
  '*/15 * * * *',
  $cron$
    select net.http_post(
      url :=
        'https://www.gridiron365fantasy.com/api/pickem/sync-lines',

      headers :=
        jsonb_build_object(
          'Content-Type',
          'application/json',
          'x-gridiron-sync-secret',
          (
            select decrypted_secret
            from vault.decrypted_secrets
            where name in (
              'GRIDIRON_SYNC_SECRET',
              'NFL_SYNC_SECRET',
              'gridiron_sync_secret'
            )
            order by
              case name
                when 'GRIDIRON_SYNC_SECRET' then 1
                when 'NFL_SYNC_SECRET' then 2
                else 3
              end
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

select
  jobid,
  jobname,
  schedule,
  active
from cron.job
where jobname in (
  'gridiron365-pickem-lifecycle-prepare',
  'gridiron365-pickem-game-sync',
  'gridiron365-pickem-line-sync',
  'gridiron365-pickem-week-finalize'
)
order by jobname;
