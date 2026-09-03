begin;

drop function if exists
  public.get_projected_playoff_field(uuid);

create function public.get_projected_playoff_field(
  p_league_id uuid
)
returns table (
  team_id bigint,
  team_name text,
  wins integer,
  losses integer,
  ties integer,
  points_for numeric,
  games_played integer,
  seed integer,
  playoff_probability numeric,
  projected_playoff_team boolean
)
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_season integer;
  v_playoff_team_count integer := 6;
  v_regular_season_weeks integer := 14;
  v_team_count integer := 0;
begin
  select
    l.season
  into
    v_season
  from public.leagues l
  where l.id = p_league_id
    and l.league_type = 'traditional'
  limit 1;

  if v_season is null then
    raise exception
      'Traditional league could not be found.';
  end if;

  select
    greatest(
      2,
      coalesce(
        ls.playoff_team_count,
        6
      )
    ),
    greatest(
      1,
      coalesce(
        ls.regular_season_weeks,
        14
      )
    )
  into
    v_playoff_team_count,
    v_regular_season_weeks
  from public.league_settings ls
  where ls.league_id = p_league_id
  limit 1;

  select
    count(*)::integer
  into
    v_team_count
  from public.fantasy_teams ft
  where ft.league_id = p_league_id
    and coalesce(ft.active, true) = true;

  v_playoff_team_count :=
    least(
      v_playoff_team_count,
      greatest(
        1,
        v_team_count
      )
    );

  return query
  with base as (
    select
      ft.id::bigint
        as team_id,

      coalesce(
        nullif(
          trim(ft.team_name),
          ''
        ),
        'Team ' ||
        ft.id::text
      )::text
        as team_name,

      coalesce(
        ts.wins,
        0
      )::integer
        as wins,

      coalesce(
        ts.losses,
        0
      )::integer
        as losses,

      coalesce(
        ts.ties,
        0
      )::integer
        as ties,

      coalesce(
        ts.points_for,
        0
      )::numeric
        as points_for,

      coalesce(
        ts.points_against,
        0
      )::numeric
        as points_against,

      coalesce(
        ts.games_played,
        0
      )::integer
        as games_played,

      case
        when coalesce(
          ts.games_played,
          0
        ) > 0
        then (
          coalesce(
            ts.wins,
            0
          )::numeric +
          coalesce(
            ts.ties,
            0
          )::numeric *
          0.5
        ) /
        ts.games_played::numeric

        else 0::numeric
      end
        as win_pct

    from public.fantasy_teams ft

    left join public.traditional_standings ts
      on ts.league_id =
           p_league_id
     and ts.season =
           v_season
     and ts.fantasy_team_id =
           ft.id

    where ft.league_id =
          p_league_id
      and coalesce(
        ft.active,
        true
      ) = true
  ),

  ranked as (
    select
      b.*,

      row_number() over (
        order by
          b.win_pct desc,
          b.points_for desc,
          b.points_against asc,
          b.team_name asc,
          b.team_id asc
      )::integer
        as seed

    from base b
  ),

  league_metrics as (
    select
      percentile_cont(0.5)
        within group (
          order by r.points_for
        )::numeric
        as median_points_for
    from ranked r
  ),

  projected as (
    select
      r.*,

      greatest(
        0::numeric,
        least(
          1::numeric,
          r.games_played::numeric /
          greatest(
            1,
            v_regular_season_weeks
          )::numeric
        )
      )
        as season_progress,

      (
        v_playoff_team_count::numeric /
        greatest(
          1,
          v_team_count
        )::numeric
      ) *
      100::numeric
        as baseline_probability,

      lm.median_points_for

    from ranked r
    cross join league_metrics lm
  ),

  probability as (
    select
      p.*,

      greatest(
        1::numeric,
        least(
          99::numeric,

          (
            p.baseline_probability *
            (
              1::numeric -
              p.season_progress
            )
          )
          +
          (
            greatest(
              1::numeric,
              least(
                99::numeric,

                p.baseline_probability

                +
                (
                  (
                    v_playoff_team_count -
                    p.seed
                  )::numeric *
                  8::numeric
                )

                +
                (
                  (
                    p.win_pct -
                    0.5::numeric
                  ) *
                  80::numeric
                )

                +
                greatest(
                  -15::numeric,
                  least(
                    15::numeric,
                    (
                      p.points_for -
                      coalesce(
                        p.median_points_for,
                        p.points_for
                      )
                    ) /
                    3::numeric
                  )
                )
              )
            )
            *
            p.season_progress
          )
        )
      )
        as playoff_probability

    from projected p
  )

  select
    pr.team_id,
    pr.team_name,
    pr.wins,
    pr.losses,
    pr.ties,
    pr.points_for,
    pr.games_played,
    pr.seed,
    round(
      pr.playoff_probability,
      2
    )::numeric
      as playoff_probability,
    (
      pr.seed <=
      v_playoff_team_count
    )
      as projected_playoff_team

  from probability pr

  order by
    pr.seed;
end;
$function$;


revoke all
on function public.get_projected_playoff_field(uuid)
from public, anon;

grant execute
on function public.get_projected_playoff_field(uuid)
to authenticated;

grant execute
on function public.get_projected_playoff_field(uuid)
to service_role;

commit;


-- ============================================================
-- VERIFICATION
-- ============================================================

select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(
    p.oid
  ) as arguments
from pg_proc p
join pg_namespace n
  on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname =
      'get_projected_playoff_field';

-- Optional direct test:
-- select *
-- from public.get_projected_playoff_field(
--   '984564ec-abcf-41e5-bab2-ac383da512b5'::uuid
-- );
