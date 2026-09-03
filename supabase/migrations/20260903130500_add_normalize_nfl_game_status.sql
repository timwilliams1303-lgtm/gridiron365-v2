begin;

create or replace function public.normalize_nfl_game_status(
  p_status text
)
returns text
language sql
immutable
parallel safe
as $function$
  select
    case
      when p_status is null
        or btrim(p_status) = ''
        then 'unknown'

      when lower(p_status) like '%cancel%'
        then 'canceled'

      when lower(p_status) like '%postpon%'
        then 'postponed'

      when lower(p_status) like '%suspend%'
        then 'suspended'

      when lower(p_status) like '%delay%'
        then 'delayed'

      when lower(p_status) like '%final%'
        or lower(p_status) like '%complete%'
        then 'final'

      when lower(p_status) like '%halftime%'
        then 'live'

      when lower(p_status) like '%in progress%'
        or lower(p_status) like '%in_progress%'
        or lower(p_status) like '%inprogress%'
        or lower(p_status) like '%playing%'
        then 'live'

      when lower(p_status) like '%scheduled%'
        or lower(p_status) like '%pre%'
        then 'scheduled'

      else
        lower(
          regexp_replace(
            regexp_replace(
              btrim(p_status),
              '^status_',
              '',
              'i'
            ),
            '[^a-zA-Z0-9]+',
            '_',
            'g'
          )
        )
    end;
$function$;

grant execute
on function public.normalize_nfl_game_status(text)
to authenticated;

commit;

-- Verification
select
  public.normalize_nfl_game_status('STATUS_FINAL') as final_test,
  public.normalize_nfl_game_status('STATUS_CANCELED') as canceled_test,
  public.normalize_nfl_game_status('STATUS_POSTPONED') as postponed_test,
  public.normalize_nfl_game_status('STATUS_IN_PROGRESS') as live_test;