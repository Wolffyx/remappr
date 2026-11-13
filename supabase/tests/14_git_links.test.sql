begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000014a1', 'git-a@test.local'),
  ('00000000-0000-0000-0000-0000000014b1', 'git-b@test.local');

create temp table ids (name text primary key, id uuid);
grant all on ids to authenticated;

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-0000-0000-0000000014a1", "role": "authenticated"}', true);

insert into ids values ('cfg', public.create_item(
  '{"client_id": "00000000-0000-0000-0000-0000000014c1", "type": "config", "name": "Corne"}',
  '{"kind": "remappr.keymap", "layers": [1]}'));

select lives_ok($$ select public.set_git_link((select id from ids where name = 'cfg'),
  '{"repo": "wolffyx/zmk-config", "slug": "corne", "target": "zmk"}') $$, 'the owner links an item');
select is((select slug || ' ' || repo || '@' || branch || ':' || folder || ':' || target || ':' || auto_push::text
             from public.item_git_links where item_id = (select id from ids where name = 'cfg')),
  'corne wolffyx/zmk-config@main:remappr:zmk:true', 'defaults fill branch, folder and auto push');

select lives_ok($$ select public.mark_git_synced((select id from ids where name = 'cfg'),
  'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 1) $$, 'a push is recorded');
select is((select git_commit_sha from public.library_item_versions
            where item_id = (select id from ids where name = 'cfg') and version = 1),
  'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'the version carries the commit');

-- Same remote, another setting: the synced commit stays.
select public.set_git_link((select id from ids where name = 'cfg'),
  '{"repo": "wolffyx/zmk-config", "slug": "corne", "auto_push": false}');
select is((select last_synced_sha from public.item_git_links
            where item_id = (select id from ids where name = 'cfg')),
  'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'changing auto push keeps the synced commit');

-- Another branch is another remote: forget it.
select public.set_git_link((select id from ids where name = 'cfg'),
  '{"repo": "wolffyx/zmk-config", "slug": "corne", "branch": "dev"}');
select is((select last_synced_sha from public.item_git_links
            where item_id = (select id from ids where name = 'cfg')),
  null, 'a new branch forgets the synced commit');

select throws_ok($$ select public.set_git_link((select id from ids where name = 'cfg'),
  '{"repo": "wolffyx/zmk-config", "slug": "corne", "folder": "../escape"}') $$, '23514', null,
  'a folder cannot climb out of the repo');
select throws_ok($$ select public.mark_git_synced((select id from ids where name = 'cfg'),
  'not-a-sha') $$, '22023', null, 'only a commit sha is recorded');

-- Another user sees nothing and cannot write.
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-0000-0000-0000000014b1", "role": "authenticated"}', true);
select is((select count(*)::int from public.item_git_links), 0, 'links are owner-only');
select throws_ok($$ select public.set_git_link((select id from ids where name = 'cfg'), null) $$,
  '42501', null, 'another user cannot unlink');
select throws_ok($$ select public.mark_git_synced((select id from ids where name = 'cfg'),
  'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', 1) $$, '42501', null, 'another user cannot mark');

-- Unlinking removes the row.
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-0000-0000-0000000014a1", "role": "authenticated"}', true);
select public.set_git_link((select id from ids where name = 'cfg'), null);
select is((select count(*)::int from public.item_git_links), 0, 'null unlinks');

select * from finish();
rollback;
