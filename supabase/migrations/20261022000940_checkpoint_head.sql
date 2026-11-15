-- P10d: checkpoints reach the cloud. A checkpoint of the document the cloud
-- already holds (the head was pushed as an autosave first) labels that head
-- instead of being a no-op, so the message is not lost.

-- p_changes: {document?, kind? (autosave|checkpoint|github), message?, name?, summary?, description?,
--             tags?, meta?, identifiers?, device_id?}
-- Returns the head version. A document equal to the head makes no new version; saved as a
-- checkpoint (or github) it labels the head instead: an autosave head takes that kind, and a
-- message replaces the head's.
create or replace function public.save_item(p_item uuid, p_base_version integer, p_changes jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_uid  uuid := (select auth.uid());
  v_row  public.library_items;
  v_doc  jsonb := p_changes -> 'document';
  v_ids  text[];
  v_dev  uuid;
  v_next integer;
begin
  select * into v_row from public.library_items i where i.id = p_item for update;
  if not found or not private.can_write_item(p_item) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  v_ids := case when p_changes ? 'identifiers'
                then array(select jsonb_array_elements_text(p_changes -> 'identifiers'))
                else v_row.identifiers end;
  v_dev := case when p_changes ? 'device_id' then (p_changes ->> 'device_id')::uuid else v_row.device_id end;
  perform private.check_meta(v_row.type, coalesce(p_changes -> 'meta', v_row.meta), v_ids, v_dev);
  if v_doc is not null and v_doc is distinct from (
       select v.document from public.library_item_versions v
        where v.item_id = p_item and v.version = v_row.head_version) then
    if v_row.head_version <> p_base_version then
      raise exception 'version_conflict' using errcode = 'P0001';
    end if;
    perform private.check_document(v_row.type, v_doc);
    perform private.check_storage(v_uid, octet_length(v_doc::text));
    v_next := v_row.head_version + 1;
    insert into public.library_item_versions (item_id, version, document, kind, message)
    values (p_item, v_next, v_doc, coalesce(p_changes ->> 'kind', 'autosave'),
            left(coalesce(p_changes ->> 'message', ''), 500));
    delete from public.library_item_versions v
     where v.item_id = p_item and v.release_no is null and v.kind = 'autosave'
       and v.version <= v_next - 1 - private.plan_limit(v_uid, 'revision_history');
  elsif v_doc is not null and coalesce(p_changes ->> 'kind', 'autosave') <> 'autosave' then
    update public.library_item_versions v set
      kind    = case when v.kind = 'autosave' then p_changes ->> 'kind' else v.kind end,
      message = case when coalesce(p_changes ->> 'message', '') <> ''
                     then left(p_changes ->> 'message', 500) else v.message end
     where v.item_id = p_item and v.version = v_row.head_version;
  end if;
  update public.library_items set
    name         = coalesce(p_changes ->> 'name', name),
    summary      = coalesce(p_changes ->> 'summary', summary),
    description  = coalesce(p_changes ->> 'description', description),
    tags         = case when p_changes ? 'tags'
                        then array(select jsonb_array_elements_text(p_changes -> 'tags')) else tags end,
    meta         = coalesce(p_changes -> 'meta', meta),
    identifiers  = v_ids,
    device_id    = v_dev,
    head_version = coalesce(v_next, head_version)
  where id = p_item;
  return coalesce(v_next, v_row.head_version);
end;
$$;
