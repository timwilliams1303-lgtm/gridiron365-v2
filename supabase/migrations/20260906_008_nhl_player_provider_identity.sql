begin;

alter table public.nhl_players
  add column if not exists nhl_player_id bigint;

comment on column public.nhl_players.nhl_player_id is
  'Official NHL player ID from api-web.nhle.com. This is the authoritative player provider identity for G365 NHL.';

create unique index if not exists nhl_players_nhl_player_id_uidx
  on public.nhl_players (nhl_player_id)
  where nhl_player_id is not null;

create index if not exists nhl_players_espn_athlete_id_idx
  on public.nhl_players (espn_athlete_id)
  where espn_athlete_id is not null;

commit;