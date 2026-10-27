begin;
create extension if not exists pgtap with schema extensions;
select plan(25);

insert into auth.users (id, email)
values
  ('00000000-0000-0000-0000-0000000004a1', 'library-a@test.local'),
  ('00000000-0000-0000-0000-0000000004b2', 'library-b@test.local');

create temp table ids (name text primary key, id uuid);
grant all on ids to authenticated;

-- As Alice.
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-0000-0000-0000000004a1", "role": "authenticated"}', true);

insert into ids values ('cfg', public.create_item(
  '{"client_id": "00000000-0000-0000-0000-00000000c001", "type": "config", "name": "Corne"}',
  '{"kind": "remappr.keymap", "layers": []}'));
select isnt((select id from ids where name = 'cfg'), null, 'a user creates a config item');
select is(public.create_item(
            '{"client_id": "00000000-0000-0000-0000-00000000c001", "type": "config", "name": "Corne"}',
            '{"kind": "remappr.keymap", "layers": []}'),
          (select id from ids where name = 'cfg'), 're-uploading the same client_id is idempotent');

select throws_ok(
  $$ select public.create_item('{"type": "config", "name": "x"}', '{"kind": "remappr.backup"}') $$,
  '22023', 'document_kind_mismatch', 'the document kind must fit the item type');
select throws_ok(
  $$ select public.create_item('{"type": "config", "name": "x", "identifiers": ["usb:1234:abcd"]}',
                               '{"kind": "remappr.keymap"}') $$,
  '22023', 'invalid_identifier', 'only device items carry identifiers');
select throws_ok(
  $$ insert into public.library_items (owner_id, type, name)
     values ('00000000-0000-0000-0000-0000000004a1', 'config', 'x') $$,
  '42501', null, 'items are written through RPCs only');

-- Versions + conflicts.
select is(public.save_item((select id from ids where name = 'cfg'), 1,
                           '{"document": {"kind": "remappr.keymap", "layers": [1]}}'),
          2, 'a save on the head version adds a version');
select is(public.save_item((select id from ids where name = 'cfg'), 2,
                           '{"document": {"kind": "remappr.keymap", "layers": [1]}}'),
          2, 'saving the same document is a no-op');
select throws_ok(
  format($$ select public.save_item(%L, 1, '{"document": {"kind": "remappr.keymap", "layers": [2]}}') $$,
         (select id from ids where name = 'cfg')),
  'P0001', 'version_conflict', 'a save on a stale base version conflicts');
select is(public.save_item((select id from ids where name = 'cfg'), 1, '{"name": "Corne v2"}'),
          2, 'a metadata-only save needs no fresh base');

-- Device items follow the builder gate.
insert into ids values ('dev', public.create_item(
  '{"type": "device", "name": "Board", "meta": {"device_kind": "keyboard", "form": "keyboard"},
    "identifiers": ["usb:1d50:615e", "layout_hash:0123456789abcdef0123456789abcdef"]}',
  '{"kind": "remappr.keymap"}'));
select isnt((select id from ids where name = 'dev'), null, 'device items allowed while the builder is free');
select throws_ok(
  $$ select public.create_item('{"type": "device", "name": "B", "meta": {"device_kind": "toaster", "form": "keyboard"}}',
                               '{"kind": "remappr.keymap"}') $$,
  '22023', 'invalid_meta', 'device kind must be a known one');

-- Backups: one item per physical unit.
insert into ids values ('bk', public.save_device_backup(jsonb_build_object(
  'device_key', repeat('ab', 32), 'device_name', 'Corne', 'firmware', 'zmk',
  'document', '{"kind": "remappr.backup", "keys": []}'::jsonb)));
select is(public.save_device_backup(jsonb_build_object(
            'device_key', repeat('ab', 32), 'device_name', 'Corne', 'firmware', 'zmk',
            'document', '{"kind": "remappr.backup", "keys": [1]}'::jsonb)),
          (select id from ids where name = 'bk'), 'a second backup of the same unit updates it');
select is((select head_version from public.library_items where id = (select id from ids where name = 'bk')),
          2, 'the backup keeps its history');
select throws_ok(
  $$ select public.save_device_backup('{"device_key": "short", "device_name": "x",
                                        "document": {"kind": "remappr.backup"}}') $$,
  '22023', 'invalid_meta', 'a backup needs a sha-256 device key');

select is((public.my_usage() ->> 'cloud_private_items')::int, 2, 'my_usage counts private items');

-- As Bob.
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-0000-0000-0000000004b2", "role": "authenticated"}', true);
select is((select count(*)::int from public.library_items
            where owner_id = '00000000-0000-0000-0000-0000000004a1'),
          0, 'another user''s private items are invisible');
select is((select count(*)::int from public.library_item_versions
            where item_id = (select id from ids where name = 'cfg')),
          0, 'another user''s versions are invisible');
select throws_ok(
  format($$ select public.save_item(%L, 2, '{"name": "pwned"}') $$, (select id from ids where name = 'cfg')),
  '42501', 'forbidden', 'another user cannot save the item');
select throws_ok(
  format($$ select public.delete_item(%L) $$, (select id from ids where name = 'cfg')),
  'P0002', 'not_found', 'another user cannot delete the item');

-- Quota: the free plan allows 10 private items.
select lives_ok(
  $$ select public.create_item(jsonb_build_object('type', 'config', 'name', 'n' || g),
                               '{"kind": "remappr.keymap"}') from generate_series(1, 10) g $$,
  'ten private items fit the free plan');
select throws_ok(
  $$ select public.create_item('{"type": "config", "name": "eleven"}', '{"kind": "remappr.keymap"}') $$,
  'P0001', 'quota_exceeded', 'the eleventh is refused');

-- Back as Alice: delete → tombstone in the sync feed.
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-0000-0000-0000000004a1", "role": "authenticated"}', true);
select public.delete_item((select id from ids where name = 'cfg'));
select isnt((select deleted_at from public.sync_pull(null) where id = (select id from ids where name = 'cfg')),
            null, 'a deleted item reaches the sync feed as a tombstone');

-- With the free plan no longer granting the builder, device items lock.
reset role;
update public.plans set limits = jsonb_set(limits, '{builder}', '0') where key = 'free';
set local role authenticated;
select throws_ok(
  format($$ select public.save_item(%L, 1, '{"name": "x"}') $$, (select id from ids where name = 'dev')),
  '42501', 'forbidden', 'device items turn read-only without the builder');
select throws_ok(
  $$ select public.create_item('{"type": "device", "name": "B", "meta": {"device_kind": "keyboard", "form": "keyboard"}}',
                               '{"kind": "remappr.keymap"}') $$,
  'P0001', 'feature_required', 'new device items need the builder');

-- As anon.
reset role;
set local role anon;
select throws_ok($$ select public.sync_pull(null) $$, '42501', null, 'anon has no sync feed');

select * from finish();
rollback;
