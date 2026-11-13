-- Account export and deletion (plan P7). Both run only through the
-- export-account / delete-account Edge Functions, as the service role, for the
-- caller's own id.

-- Everything kept about one user, as one JSON document (GDPR export). Billing
-- details (name, address, tax id) live in Stripe, not here.
create function public.account_export(p_user uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'format', 'remappr.account-export',
    'version', 1,
    'exported_at', now(),
    'account', (select jsonb_build_object(
                  'id', u.id, 'email', u.email, 'created_at', u.created_at,
                  'last_sign_in_at', u.last_sign_in_at)
                  from auth.users u where u.id = p_user),
    'profile', (select to_jsonb(p) from public.users p where p.id = p_user),
    'library', coalesce((
      select jsonb_agg((to_jsonb(i) - 'search' - 'share_hash') || jsonb_build_object(
               'versions', coalesce((
                 select jsonb_agg(to_jsonb(v) - 'item_id' order by v.version)
                   from public.library_item_versions v where v.item_id = i.id), '[]'::jsonb))
             order by i.created_at)
        from public.library_items i where i.owner_id = p_user), '[]'::jsonb),
    'stars', coalesce((
      select jsonb_agg(jsonb_build_object('item_id', s.item_id, 'created_at', s.created_at)
             order by s.created_at)
        from public.item_stars s where s.user_id = p_user), '[]'::jsonb),
    'comments', coalesce((
      select jsonb_agg(to_jsonb(c) - 'author_id' order by c.created_at)
        from public.item_comments c where c.author_id = p_user), '[]'::jsonb),
    'reports', coalesce((
      select jsonb_agg(to_jsonb(r) - 'reporter_id' order by r.created_at)
        from public.content_reports r where r.reporter_id = p_user), '[]'::jsonb),
    'purchases', coalesce((
      select jsonb_agg(to_jsonb(b) - 'user_id' order by b.created_at)
        from public.purchases b where b.user_id = p_user), '[]'::jsonb),
    'licensed_devices', coalesce((
      select jsonb_agg(to_jsonb(d) - 'user_id' order by d.activated_at)
        from public.licensed_devices d where d.user_id = p_user), '[]'::jsonb)
  );
$$;

-- The first half of deleting an account: refuse while a subscription still
-- bills (P6 cancels it first), then clear what the auth.users cascade does not
-- reach. Returns the user's storage object names, which the function removes
-- through the Storage API before it deletes the auth user.
create function public.account_prepare_delete(p_user uuid) returns text[]
language plpgsql security definer set search_path = '' as $$
declare
  v_objects text[];
begin
  if not exists (select 1 from auth.users where id = p_user) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.purchases
              where user_id = p_user and type = 'subscription' and status = 'active') then
    raise exception 'active_subscription' using errcode = 'P0001';
  end if;

  -- Comments stay in their threads as "[deleted]", without their text.
  update public.item_comments
     set body = '', deleted_at = coalesce(deleted_at, now())
   where author_id = p_user;
  delete from private.rate_limits where user_id = p_user;
  -- Audit rows stay (download watermarks, moderation history), unlinked.
  update private.audit_log set user_id = null where user_id = p_user;
  insert into private.audit_log (kind, subject) values ('account_deleted', p_user);

  select coalesce(array_agg(o.name), '{}') into v_objects
    from storage.objects o
   where o.bucket_id = 'device-images' and (storage.foldername(o.name))[1] = p_user::text;
  return v_objects;
end;
$$;

revoke all on function public.account_export(uuid), public.account_prepare_delete(uuid)
  from public, anon, authenticated;
grant execute on function public.account_export(uuid), public.account_prepare_delete(uuid)
  to service_role;

-- The health function's database ping (no table grants needed).
create function public.health() returns boolean
language sql stable set search_path = '' as $$ select true $$;
revoke all on function public.health() from public, anon, authenticated;
grant execute on function public.health() to service_role;
