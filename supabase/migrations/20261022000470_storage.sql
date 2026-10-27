-- Device images (plan P4): a public bucket; owners write under their own folder.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('device-images', 'device-images', true, 2097152, array['image/webp', 'image/png', 'image/jpeg']);

-- Path: {uid}/{item_id}/{file}. Public read (public bucket); owners write their own folder.
-- The image path is stored in the device item's meta.image_path (validated prefix).
create policy device_images_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'device-images'
              and (storage.foldername(name))[1] = (select auth.uid())::text
              and private.owns_item(((storage.foldername(name))[2])::uuid));
create policy device_images_update on storage.objects for update to authenticated
  using (bucket_id = 'device-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy device_images_delete on storage.objects for delete to authenticated
  using (bucket_id = 'device-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
