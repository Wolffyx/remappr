begin;
create extension if not exists pgtap with schema extensions;
select plan(25);

select vault.create_secret('test-share-secret', 'share_secret')
 where not exists (select 1 from vault.secrets where name = 'share_secret');

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000005a1', 'community-a@test.local'),
  ('00000000-0000-0000-0000-0000000005b2', 'community-b@test.local'),
  ('00000000-0000-0000-0000-0000000005c3', 'community-c@test.local');
update public.users set username = 'alice5' where id = '00000000-0000-0000-0000-0000000005a1';
update public.users set username = 'bob5' where id = '00000000-0000-0000-0000-0000000005b2';

create temp table ids (name text primary key, id uuid, txt text);
grant all on ids to authenticated, anon;

-- As Alice: a config with a release, then a draft on top.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000005a1", "role": "authenticated"}', true);
insert into ids (name, id) values ('cfg', public.create_item(
  '{"type": "config", "name": "Zebra layout", "summary": "a colemak-ish thing", "tags": ["colemak"]}',
  '{"kind": "remappr.keymap", "rev": 1}'));
select public.save_item((select id from ids where name = 'cfg'), 1, '{"document": {"kind": "remappr.keymap", "rev": 2}}');
select is(public.publish_item((select id from ids where name = 'cfg'), 'public', 'CC-BY-4.0', 'first'), 1,
          'publishing stamps release 1');
select public.save_item((select id from ids where name = 'cfg'), 2, '{"document": {"kind": "remappr.keymap", "rev": 3}}');
select is(public.publish_item((select id from ids where name = 'cfg'), 'public', 'CC-BY-4.0', 'again'), 2,
          'publishing an update stamps release 2');
select public.save_item((select id from ids where name = 'cfg'), 3, '{"document": {"kind": "remappr.keymap", "rev": 4}}');

select throws_ok($$ select public.publish_item((select id from ids where name = 'cfg'), 'secret', 'MIT', '') $$,
  '22023', 'invalid_visibility', 'only unlisted or public');

-- Unlisted item + its link.
insert into ids (name, id) values ('hidden', public.create_item('{"type": "config", "name": "Hidden"}', '{"kind": "remappr.keymap"}'));
select public.publish_item((select id from ids where name = 'hidden'), 'unlisted', 'MIT', '');
insert into ids (name, txt) values ('token', public.get_share_token((select id from ids where name = 'hidden')));
select isnt((select txt from ids where name = 'token'), null, 'the owner gets a share token');

-- A public device board, for matching.
insert into ids (name, id) values ('dev', public.create_item(
  '{"type": "device", "name": "Corne", "meta": {"device_kind": "keyboard", "form": "keyboard"},
    "identifiers": ["usb:1d50:615e", "zmk_name:corne", "layout_hash:0123456789abcdef0123456789abcdef"]}',
  '{"kind": "remappr.keymap"}'));
select public.publish_item((select id from ids where name = 'dev'), 'public', 'CC-BY-SA-4.0', '');

select throws_ok(
  $$ select public.create_item('{"type": "device", "name": "x", "meta": {"device_kind": "keyboard", "form": "keyboard",
       "image_path": "00000000-0000-0000-0000-0000000005b2/00000000-0000-0000-0000-000000000000/a.webp"}}',
       '{"kind": "remappr.keymap"}') $$,
  '22023', 'invalid_meta', 'an image path must be in the owner''s folder');

-- As Bob.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000005b2", "role": "authenticated"}', true);
select is((select array_agg(v.document ->> 'rev' order by v.version) from public.library_item_versions v
            where v.item_id = (select id from ids where name = 'cfg')),
          array['2', '3'], 'others read the releases, never the drafts');
select is((select count(*)::int from public.library_items where id = (select id from ids where name = 'hidden')),
          0, 'an unlisted item is not listed');
select is((select name from public.get_shared_item((select txt from ids where name = 'token'))),
          'Hidden', 'the link opens an unlisted item');
select is((select count(*)::int from public.get_shared_item('nope')), 0, 'a wrong token opens nothing');
select is((select count(*)::int from public.search_items('zebra', '{}', 'new', 0) s
            where s.id = (select id from ids where name = 'cfg')), 1, 'search finds by name');
select is((select count(*)::int from public.search_items('colemak', '{"type": "device"}', 'new', 0) s
            where s.id = (select id from ids where name = 'cfg')), 0, 'filters narrow the search');
select is((select count(*)::int from public.search_items('', '{}', 'new', 0) s
            where s.id = (select id from ids where name = 'hidden')), 0, 'search never lists unlisted items');

insert into ids (name, id) values ('fork', public.fork_item((select id from ids where name = 'cfg'), null));
select is((select v.document ->> 'rev' from public.library_item_versions v
            where v.item_id = (select id from ids where name = 'fork')), '3', 'a fork copies the latest release');
select is((select forks_count from public.library_items where id = (select id from ids where name = 'cfg')), 1,
          'the source counts the fork');
select is(public.fork_item((select id from ids where name = 'hidden'), (select txt from ids where name = 'token')) is not null,
          true, 'an unlisted item forks with its token');
select throws_ok(format($$ select public.fork_item(%L, null) $$, (select id from ids where name = 'hidden')),
  'P0002', 'not_found', 'an unlisted item does not fork without its token');

insert into ids (name, id) values ('sa', public.fork_item((select id from ids where name = 'dev'), null));
select throws_ok(format($$ select public.publish_item(%L, 'public', 'MIT', '') $$, (select id from ids where name = 'sa')),
  'P0001', 'license_must_be_share_alike', 'a share-alike fork stays share-alike');

select public.record_download((select id from ids where name = 'cfg'));
select public.record_download((select id from ids where name = 'cfg'));
select is((select downloads_count from public.library_items where id = (select id from ids where name = 'cfg')), 1,
          'one counted download per user per day');

select is((select score from public.match_devices('["usb:1d50:615e", "zmk_name:corne", "layout_hash:0123456789abcdef0123456789abcdef"]')
            where device_id = (select id from ids where name = 'dev')), 70,
          'a ZMK board matches by name + layout, the shared ZMK VID:PID counts for nothing');
select is((select count(*)::int from public.match_devices('["usb:1d50:615e"]')
            where device_id = (select id from ids where name = 'dev')), 0, 'the generic VID:PID alone matches nothing');

-- Alice rotates, then unpublishes: old links die.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000005a1", "role": "authenticated"}', true);
select public.rotate_share_token((select id from ids where name = 'hidden'));
select is((select count(*)::int from public.get_shared_item((select txt from ids where name = 'token'))), 0,
          'rotating the link kills the old one');
select public.unpublish_item((select id from ids where name = 'cfg'));
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000005b2", "role": "authenticated"}', true);
select is((select count(*)::int from public.library_items where id = (select id from ids where name = 'cfg')), 0,
          'an unpublished item disappears for others');

-- Carol has no username.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000005c3", "role": "authenticated"}', true);
insert into ids (name, id) values ('carol', public.create_item('{"type": "config", "name": "C"}', '{"kind": "remappr.keymap"}'));
select throws_ok(format($$ select public.publish_item(%L, 'public', 'MIT', '') $$, (select id from ids where name = 'carol')),
  'P0001', 'username_required', 'publishing needs a username');

-- As anon.
reset role;
set local role anon;
select lives_ok($$ select * from public.search_items('', '{}', 'new', 0) $$, 'anon can search');
select throws_ok($$ select public.publish_item(gen_random_uuid(), 'public', 'MIT', '') $$, '42501', null,
                 'anon cannot publish');

select * from finish();
rollback;
