-- Desktop sign-in through the browser. The app keeps a random nonce and
-- opens the site with state = base64url(sha256(nonce)). Signed in there, the
-- browser asks desktop-handoff to file a one-time login (a magic-link token
-- hash) under that state; the app then claims it with the nonce through
-- desktop-handoff-claim and signs in. The state alone, which travels in URLs,
-- claims nothing. Entries are single-use and live 5 minutes.

create table private.desktop_handoffs (
  state_hash text primary key check (state_hash ~ '^[A-Za-z0-9_-]{43}$'),
  user_id    uuid not null references auth.users (id) on delete cascade,
  token_hash text not null,
  created_at timestamptz not null default now()
);

-- File a login under a state (service role: desktop-handoff). A state is used
-- once; a second filing for it is refused.
create function public.desktop_handoff_put(p_state text, p_user uuid, p_token_hash text)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  delete from private.desktop_handoffs where created_at < now() - interval '5 minutes';
  insert into private.desktop_handoffs (state_hash, user_id, token_hash)
  values (p_state, p_user, p_token_hash)
  on conflict (state_hash) do nothing;
  return found;
end;
$$;

-- Whether a state already has a login (checked before a new link is minted:
-- minting one replaces the user's previous link, which would void the filed
-- login).
create function public.desktop_handoff_known(p_state text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from private.desktop_handoffs
                  where state_hash = p_state and created_at >= now() - interval '5 minutes');
$$;

-- Take the login filed under a state, once (service role: desktop-handoff-claim).
create function public.desktop_handoff_take(p_state text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_token text;
begin
  delete from private.desktop_handoffs
   where state_hash = p_state and created_at >= now() - interval '5 minutes'
  returning token_hash into v_token;
  return v_token;
end;
$$;

revoke all on function public.desktop_handoff_put(text, uuid, text), public.desktop_handoff_take(text),
  public.desktop_handoff_known(text) from public, anon, authenticated;
grant execute on function public.desktop_handoff_put(text, uuid, text), public.desktop_handoff_take(text),
  public.desktop_handoff_known(text) to service_role;
