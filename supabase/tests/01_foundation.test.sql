begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

-- private stays out of the Data API.
select ok(not has_schema_privilege('anon', 'private', 'create'), 'anon cannot create in private');
select ok(not has_table_privilege('anon', 'private.rate_limits', 'select'), 'anon cannot read rate_limits');
select ok(not has_table_privilege('authenticated', 'private.audit_log', 'select'),
          'authenticated cannot read audit_log');
select ok(not has_function_privilege('authenticated', 'private.hit_rate_limit(text, integer, interval)', 'execute'),
          'clients cannot call hit_rate_limit directly');

select ok(exists (select 1 from public.lookups where category = 'reserved_username' and key = 'admin'),
          'reserved usernames are seeded');

-- Rate limiter, as a signed-in user.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-000000000001"}', true);
select lives_ok($$ select private.hit_rate_limit('test', 2, interval '1 hour') $$, 'first hit passes');
select lives_ok($$ select private.hit_rate_limit('test', 2, interval '1 hour') $$, 'second hit passes');
select throws_ok($$ select private.hit_rate_limit('test', 2, interval '1 hour') $$,
                 'P0001', 'rate_limited', 'third hit is rate limited');

select results_eq(
  $$ select private.first_in_window('dl', interval '1 day')
     union all
     select private.first_in_window('dl', interval '1 day') $$,
  $$ values (true), (false) $$,
  'first_in_window dedupes within the window'
);

select * from finish();
rollback;
