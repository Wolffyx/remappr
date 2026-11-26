begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000009a1', 'pkg-a@test.local');

set local role service_role;
select lives_ok($$ select public.register_builder_package('{"version": "9.9.9", "host_api": "^1",
  "storage_prefix": "builder/9.9.9/", "files": [{"path": "index.mjs", "sha256": "00", "bytes": 1}]}') $$,
  'the service role registers a package');
select lives_ok($$ select public.register_builder_package('{"version": "9.9.9", "host_api": "^1",
  "storage_prefix": "builder/9.9.9/", "files": [], "changelog": "again"}') $$, 're-registering updates it');
select is(public.package_download_allowed('00000000-0000-0000-0000-0000000009a1'), true, 'a fresh user may download');

reset role;
insert into private.audit_log (kind, user_id, data)
select 'package_download', '00000000-0000-0000-0000-0000000009a1', '{}' from generate_series(1, 10);
set local role service_role;
select is(public.package_download_allowed('00000000-0000-0000-0000-0000000009a1'), false, 'ten a day at most');

reset role;
set local role anon;
select is((select changelog from public.builder_packages where version = '9.9.9'), 'again', 'anyone reads package metadata');
select throws_ok($$ select public.register_builder_package('{}') $$, '42501', null, 'clients cannot register packages');

select * from finish();
rollback;
