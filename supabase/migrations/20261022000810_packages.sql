-- Builder package delivery (plan P8c): registering a released package (CI /
-- publish script, service role) and the per-user daily download allowance the
-- get-package function checks before it serves a watermarked copy.

-- p_pkg: {version, host_api, storage_prefix, files: [{path, sha256, bytes}], channel?, changelog?}
create function public.register_builder_package(p_pkg jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.builder_packages (version, host_api, storage_prefix, files, channel, changelog)
  values (p_pkg ->> 'version', p_pkg ->> 'host_api', p_pkg ->> 'storage_prefix', p_pkg -> 'files',
          coalesce(p_pkg ->> 'channel', 'stable'), coalesce(p_pkg ->> 'changelog', ''))
  on conflict (version) do update
    set host_api = excluded.host_api, storage_prefix = excluded.storage_prefix, files = excluded.files,
        channel = excluded.channel, changelog = excluded.changelog, published_at = now();
end;
$$;

-- Whether a user may download another watermarked package today (10 per day).
create function public.package_download_allowed(p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select count(*) < 10
    from private.audit_log a
   where a.kind = 'package_download' and a.user_id = p_user
     and a.at > now() - interval '1 day';
$$;

revoke execute on function public.register_builder_package(jsonb),
  public.package_download_allowed(uuid) from anon, authenticated;
grant execute on function public.register_builder_package(jsonb),
  public.package_download_allowed(uuid) to service_role;
