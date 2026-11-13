-- Users: the public profile beside auth.users (same id). Email and login stay
-- in auth.users; a username is chosen later and is required to publish.

create table public.users (
  id           uuid primary key references auth.users (id) on delete cascade,
  username     extensions.citext unique
               check (username ~ '^[a-z0-9][a-z0-9_-]{2,31}$'),
  display_name text check (char_length(display_name) <= 64),
  avatar_url   text check (avatar_url ~ '^https://(avatars\.githubusercontent\.com|lh3\.googleusercontent\.com|cdn\.discordapp\.com)/'),
  bio          text not null default '' check (char_length(bio) <= 500),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create function private.users_before_write() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.username is not null
     and private.lookup('reserved_username', lower(new.username::text)) is not null then
    raise exception 'username_reserved' using errcode = 'P0001';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
create trigger users_before_write before insert or update on public.users
  for each row execute function private.users_before_write();

-- Every new auth user gets a public.users row (username chosen later; required to publish).
create function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_avatar text := new.raw_user_meta_data ->> 'avatar_url';
begin
  insert into public.users (id, display_name, avatar_url)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'), 64),
    case when v_avatar ~ '^https://(avatars\.githubusercontent\.com|lh3\.googleusercontent\.com|cdn\.discordapp\.com)/'
         then v_avatar end
  );
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

alter table public.users enable row level security;
revoke all on public.users from anon, authenticated;
grant select on public.users to anon, authenticated;
grant update (username, display_name, avatar_url, bio) on public.users to authenticated;

create policy users_read on public.users
  for select to anon, authenticated using (true);
create policy users_update_own on public.users
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
