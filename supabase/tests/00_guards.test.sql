-- Schema-wide guards. They hold for every migration, so a new table or RPC
-- that forgets RLS, a grant lockdown or `search_path` fails CI here.
begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

select is_empty(
  $$ select c.relname
       from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity $$,
  'every public table has RLS enabled'
);

select is_empty(
  $$ select table_name || ':' || privilege_type
       from information_schema.role_table_grants
      where table_schema = 'public' and grantee = 'anon'
        and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE') $$,
  'no public table grants writes to anon'
);

select is_empty(
  $$ select p.proname
       from pg_proc p
       join pg_namespace n on n.oid = p.pronamespace
      where n.nspname in ('public', 'private') and p.prosecdef
        and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) as cfg
                         where cfg like 'search_path=%') $$,
  'every security definer function pins search_path'
);

-- The exact set of public functions anon may call. Grow it on purpose only.
select set_eq(
  $$ select p.proname::text
       from pg_proc p
       join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute') $$,
  array['my_plan']::text[],
  'anon-executable public RPCs match the allowlist'
);

select * from finish();
rollback;
