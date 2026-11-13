begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000012a1', 'desk@test.local');

set local role authenticated;
select throws_ok($$ select public.desktop_handoff_take(repeat('a', 43)) $$,
                 '42501', null, 'a signed-in user cannot take a handoff');
reset role;

set local role service_role;
select ok(public.desktop_handoff_put(repeat('a', 43), '00000000-0000-0000-0000-0000000012a1', 'tok-1'),
          'a login is filed under a state');
select is(public.desktop_handoff_put(repeat('a', 43), '00000000-0000-0000-0000-0000000012a1', 'tok-2'),
          false, 'a state is filed only once');
select is(public.desktop_handoff_take(repeat('b', 43)), null, 'another state takes nothing');
select is(public.desktop_handoff_take(repeat('a', 43)), 'tok-1', 'the state takes its login');
select is(public.desktop_handoff_take(repeat('a', 43)), null, 'and only once');
reset role;

insert into private.desktop_handoffs (state_hash, user_id, token_hash, created_at)
values (repeat('c', 43), '00000000-0000-0000-0000-0000000012a1', 'tok-old', now() - interval '6 minutes');
set local role service_role;
select is(public.desktop_handoff_take(repeat('c', 43)), null, 'a handoff older than 5 minutes is gone');
reset role;

select * from finish();
rollback;
