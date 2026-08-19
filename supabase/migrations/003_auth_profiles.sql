-- ============================================================
-- GRIDIRON365 V2
-- MIGRATION 003
-- AUTHENTICATION / PROFILE FOUNDATION
--
-- Automatically creates a public.profiles row whenever
-- a new Supabase Auth user is created.
-- ============================================================

begin;


-- ============================================================
-- 1. NEW USER PROFILE CREATION
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
    insert into public.profiles (
        user_id,
        first_name,
        last_name,
        display_name
    )
    values (
        new.id,

        nullif(
            trim(
                coalesce(
                    new.raw_user_meta_data
                        ->> 'first_name',
                    ''
                )
            ),
            ''
        ),

        nullif(
            trim(
                coalesce(
                    new.raw_user_meta_data
                        ->> 'last_name',
                    ''
                )
            ),
            ''
        ),

        nullif(
            trim(
                coalesce(
                    new.raw_user_meta_data
                        ->> 'display_name',
                    ''
                )
            ),
            ''
        )
    )
    on conflict (
        user_id
    )
    do nothing;

    return new;
end;
$$;


-- ============================================================
-- 2. AUTH USER TRIGGER
-- ============================================================

drop trigger if exists
    on_auth_user_created
on auth.users;


create trigger
    on_auth_user_created
after insert
on auth.users
for each row
execute function
    public.handle_new_user();


commit;