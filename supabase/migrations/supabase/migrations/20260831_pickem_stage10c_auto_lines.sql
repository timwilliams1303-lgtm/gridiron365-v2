begin;

alter table public.pickem_weeks
  add column if not exists line_sync_started_at timestamptz,
  add column if not exists line_sync_completed_at timestamptz,
  add column if not exists line_sync_provider text;

create index if not exists pickem_weeks_line_sync_due_idx
  on public.pickem_weeks(line_day_at, line_sync_completed_at)
  where status <> 'final';

comment on column public.pickem_weeks.line_sync_started_at is
  'Most recent attempt to capture sportsbook source lines for this G365 Line Day.';

comment on column public.pickem_weeks.line_sync_completed_at is
  'Set when the official G365 Line Day sportsbook snapshot has been processed for the week.';

comment on column public.pickem_weeks.line_sync_provider is
  'Odds feed used for the official G365 Line Day snapshot.';

commit;
