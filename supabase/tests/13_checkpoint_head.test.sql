begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

insert into auth.users (id, email)
values ('00000000-0000-0000-0000-0000000013a1', 'checkpoint-a@test.local');

create temp table ids (name text primary key, id uuid);
grant all on ids to authenticated;

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-0000-0000-0000000013a1", "role": "authenticated"}', true);

insert into ids values ('cfg', public.create_item(
  '{"client_id": "00000000-0000-0000-0000-0000000013c1", "type": "config", "name": "Corne"}',
  '{"kind": "remappr.keymap", "layers": [1]}'));

-- A checkpoint of the head's own document labels the head; no new version.
select is(public.save_item((select id from ids where name = 'cfg'), 1,
  '{"document": {"kind": "remappr.keymap", "layers": [1]}, "kind": "checkpoint", "message": "first layout"}'),
  1, 'a checkpoint of the head''s document makes no new version');
select is((select kind || ':' || message from public.library_item_versions
            where item_id = (select id from ids where name = 'cfg') and version = 1),
  'checkpoint:first layout', 'the autosave head becomes the checkpoint, with its message');

-- An autosave of the same document leaves the label alone.
select is(public.save_item((select id from ids where name = 'cfg'), 1,
  '{"document": {"kind": "remappr.keymap", "layers": [1]}}'), 1, 'an equal autosave is a no-op');
select is((select kind from public.library_item_versions
            where item_id = (select id from ids where name = 'cfg') and version = 1),
  'checkpoint', 'an equal autosave never demotes a checkpoint');

-- A new document as a checkpoint is a new version with its message.
select is(public.save_item((select id from ids where name = 'cfg'), 1,
  '{"document": {"kind": "remappr.keymap", "layers": [2]}, "kind": "checkpoint", "message": "thumbs"}'),
  2, 'a changed document as a checkpoint is a new version');
select is((select kind || ':' || message from public.library_item_versions
            where item_id = (select id from ids where name = 'cfg') and version = 2),
  'checkpoint:thumbs', 'it keeps its kind and message');

-- An empty message keeps the one the head has.
select public.save_item((select id from ids where name = 'cfg'), 2,
  '{"document": {"kind": "remappr.keymap", "layers": [2]}, "kind": "checkpoint"}');
select is((select message from public.library_item_versions
            where item_id = (select id from ids where name = 'cfg') and version = 2),
  'thumbs', 'labelling without a message keeps the head''s');

select * from finish();
rollback;
