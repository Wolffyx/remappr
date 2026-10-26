begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

insert into auth.users (id, email, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-0000000000a1', 'a@test.local',
   '{"full_name": "Alice", "avatar_url": "https://avatars.githubusercontent.com/u/1"}'),
  ('00000000-0000-0000-0000-0000000000b2', 'b@test.local',
   '{"name": "Bob", "avatar_url": "https://evil.example/x.png"}');

select results_eq(
  $$ select display_name, avatar_url from public.users
      where id in ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b2')
      order by display_name $$,
  $$ values ('Alice'::text, 'https://avatars.githubusercontent.com/u/1'::text), ('Bob', null) $$,
  'a new auth user gets a profile; an off-allowlist avatar is dropped'
);

-- As Alice.
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-0000-0000-0000000000a1", "role": "authenticated"}', true);

select lives_ok(
  $$ update public.users set username = 'alice', bio = 'hi'
      where id = '00000000-0000-0000-0000-0000000000a1' $$,
  'a user sets their own username');
select is((select username::text from public.users where id = '00000000-0000-0000-0000-0000000000a1'),
          'alice', 'username saved');

update public.users set bio = 'hacked' where id = '00000000-0000-0000-0000-0000000000b2';
select is((select bio from public.users where id = '00000000-0000-0000-0000-0000000000b2'),
          '', 'another user''s row is not updatable');

select throws_ok(
  $$ update public.users set username = 'Admin'
      where id = '00000000-0000-0000-0000-0000000000a1' $$,
  'P0001', 'username_reserved', 'reserved usernames are refused, any case');
select throws_ok(
  $$ update public.users set username = 'no spaces'
      where id = '00000000-0000-0000-0000-0000000000a1' $$,
  '23514', null, 'username format is checked');
select throws_ok(
  $$ update public.users set created_at = now() - interval '1 year'
      where id = '00000000-0000-0000-0000-0000000000a1' $$,
  '42501', null, 'created_at is not client-writable');
select throws_ok(
  $$ insert into public.users (id) values ('00000000-0000-0000-0000-0000000000c3') $$,
  '42501', null, 'clients cannot insert profiles');

-- As anon.
reset role;
set local role anon;
select is((select count(*)::int from public.users
             where id in ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b2')),
          2, 'anon reads public profiles');
select throws_ok(
  $$ update public.users set bio = 'x' $$,
  '42501', null, 'anon cannot update profiles');

select * from finish();
rollback;
