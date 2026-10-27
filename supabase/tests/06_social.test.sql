begin;
create extension if not exists pgtap with schema extensions;
select plan(25);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000006a1', 'social-a@test.local'),
  ('00000000-0000-0000-0000-0000000006b2', 'social-b@test.local'),
  ('00000000-0000-0000-0000-0000000006c3', 'social-c@test.local'),
  ('00000000-0000-0000-0000-0000000006d4', 'social-d@test.local');
update public.users set username = 'alice6' where id = '00000000-0000-0000-0000-0000000006a1';
update public.users set username = 'bob6'   where id = '00000000-0000-0000-0000-0000000006b2';
update public.users set username = 'dave6'  where id = '00000000-0000-0000-0000-0000000006d4';

create temp table ids (name text primary key, id uuid);
grant all on ids to authenticated, anon;

create function pg_temp.as_user(p_id text, p_extra jsonb default '{}') returns void language sql as $$
  select set_config('request.jwt.claims',
    (jsonb_build_object('sub', p_id, 'role', 'authenticated') || p_extra)::text, true);
$$;
grant execute on function pg_temp.as_user(text, jsonb) to authenticated, anon;

-- Alice: one public item, one private.
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000006a1');
insert into ids values ('pub', public.create_item('{"type": "config", "name": "Social pub"}', '{"kind": "remappr.keymap"}'));
select public.publish_item((select id from ids where name = 'pub'), 'public', 'MIT', '');
insert into ids values ('priv', public.create_item('{"type": "config", "name": "Social priv"}', '{"kind": "remappr.keymap"}'));

-- Bob: stars and comments.
select pg_temp.as_user('00000000-0000-0000-0000-0000000006b2');
insert into public.item_stars (item_id) values ((select id from ids where name = 'pub'));
select is((select stars_count from public.library_items where id = (select id from ids where name = 'pub')), 1, 'a star counts');
delete from public.item_stars where item_id = (select id from ids where name = 'pub');
select is((select stars_count from public.library_items where id = (select id from ids where name = 'pub')), 0, 'unstarring uncounts');
select throws_ok(format($$ insert into public.item_stars (item_id) values (%L) $$, (select id from ids where name = 'priv')),
  '42501', null, 'a private item cannot be starred by others');

insert into public.item_comments (item_id, body) values ((select id from ids where name = 'pub'), 'nice layout');
insert into ids values ('c1', (select id from public.item_comments where body = 'nice layout'));
select is((select comments_count from public.library_items where id = (select id from ids where name = 'pub')), 1, 'a comment counts');
select throws_ok(format($$ insert into public.item_comments (item_id, body) values (%L, 'x') $$, (select id from ids where name = 'priv')),
  '42501', null, 'commenting on a private item is rejected');
insert into public.item_comments (item_id, parent_id, body) values ((select id from ids where name = 'pub'), (select id from ids where name = 'c1'), 'reply');
insert into ids values ('reply', (select id from public.item_comments where body = 'reply'));
select throws_ok(format($$ insert into public.item_comments (item_id, parent_id, body) values (%L, %L, 'deep') $$,
  (select id from ids where name = 'pub'), (select id from ids where name = 'reply')),
  '22023', 'invalid_parent', 'replies are one level deep');
select throws_ok(format($$ update public.item_comments set author_id = null where id = %L $$, (select id from ids where name = 'c1')),
  '42501', null, 'only the body is editable');
select lives_ok(format($$ update public.item_comments set body = 'nicer layout' where id = %L $$, (select id from ids where name = 'c1')),
  'the author edits their comment');

-- Carol has no username.
select pg_temp.as_user('00000000-0000-0000-0000-0000000006c3');
select throws_ok(format($$ insert into public.item_comments (item_id, body) values (%L, 'hi') $$, (select id from ids where name = 'pub')),
  '42501', null, 'commenting needs a username');
select throws_ok(format($$ select public.delete_comment(%L) $$, (select id from ids where name = 'c1')),
  'P0002', 'not_found', 'only the author deletes a comment');
select throws_ok(format($$ select public.hide_comment(%L) $$, (select id from ids where name = 'c1')),
  '42501', 'forbidden', 'others cannot hide a comment');

-- Alice hides the reply on her item.
select pg_temp.as_user('00000000-0000-0000-0000-0000000006a1');
select lives_ok(format($$ select public.hide_comment(%L) $$, (select id from ids where name = 'reply')),
  'the item owner hides a comment');
reset role;
set local role anon;
select is((select count(*)::int from public.item_comments where item_id = (select id from ids where name = 'pub')), 1,
  'anon reads visible comments only');
reset role;
set local role authenticated;

-- Reports: three open reports flag the item.
select pg_temp.as_user('00000000-0000-0000-0000-0000000006b2');
insert into public.content_reports (item_id, reason) values ((select id from ids where name = 'pub'), 'spam');
select throws_ok(format($$ insert into public.content_reports (item_id, reason) values (%L, 'spam') $$, (select id from ids where name = 'pub')),
  '23505', null, 'one report per user per item');
select pg_temp.as_user('00000000-0000-0000-0000-0000000006c3');
insert into public.content_reports (item_id, reason, note) values ((select id from ids where name = 'pub'), 'malicious_macro', 'runs powershell');
select is((select moderation from public.library_items where id = (select id from ids where name = 'pub')), 'ok', 'two reports do not flag');
select pg_temp.as_user('00000000-0000-0000-0000-0000000006d4');
insert into public.content_reports (comment_id, reason) values ((select id from ids where name = 'c1'), 'inappropriate');
insert into public.content_reports (item_id, reason) values ((select id from ids where name = 'pub'), 'broken');
reset role;
select is((select moderation from public.library_items where id = (select id from ids where name = 'pub')), 'flagged', 'three open reports flag the item');
set local role authenticated;
select is((select count(*)::int from public.search_items('social pub', '{}', 'new', 0)), 0, 'a flagged item leaves search');
select is((select count(*)::int from public.content_reports), 2, 'reporters see only their own reports');

-- Moderation: admins with MFA only.
select throws_ok($$ select * from public.moderation_queue() $$, '42501', 'forbidden', 'non-admins have no queue');
select pg_temp.as_user('00000000-0000-0000-0000-0000000006d4', '{"app_metadata": {"role": "admin"}, "aal": "aal1"}');
select throws_ok($$ select * from public.moderation_queue() $$, '42501', 'forbidden', 'an admin without MFA has no queue');
select pg_temp.as_user('00000000-0000-0000-0000-0000000006d4', '{"app_metadata": {"role": "admin"}, "aal": "aal2"}');
select is((select reports::int from public.moderation_queue() where id = (select id from ids where name = 'pub')), 3,
  'the queue groups an item''s reports');
select public.moderate('item', (select id from ids where name = 'pub'), 'ok');
select public.dismiss_reports('comment', (select id from ids where name = 'c1'));
select is((select count(*)::int from public.moderation_queue() where id in (select id from ids)), 0, 'acting closes the reports');
select is((select moderation from public.library_items where id = (select id from ids where name = 'pub')), 'ok', 'moderate restores the item');

-- Collections: members the caller cannot read drop out.
select pg_temp.as_user('00000000-0000-0000-0000-0000000006a1');
insert into ids values ('col', public.create_item('{"type": "collection", "name": "Faves"}',
  jsonb_build_object('kind', 'remappr.collection', 'items', jsonb_build_array(
    jsonb_build_object('id', (select id from ids where name = 'pub'), 'note', 'great'),
    jsonb_build_object('id', (select id from ids where name = 'priv'), 'note', 'mine')))));
select is((select count(*)::int from public.collection_members((select id from ids where name = 'col'))), 2,
  'the owner sees every member');
select public.publish_item((select id from ids where name = 'col'), 'public', 'CC0-1.0', '');
select pg_temp.as_user('00000000-0000-0000-0000-0000000006b2');
select is((select array_agg(name) from public.collection_members((select id from ids where name = 'col'))),
  array['Social pub'], 'a collection never leaks private members');

select * from finish();
rollback;
