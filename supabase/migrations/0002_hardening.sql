-- Hardening: storage limits and self-service account deletion.

-- Storage --------------------------------------------------------------------

-- Only the content types the app pins from the allowed extensions
-- (src/lib/domain/files.ts MIME_BY_EXTENSION). hwp/hwpx use their x- types, so
-- application/octet-stream is not needed.
update storage.buckets
set allowed_mime_types = array[
  'application/pdf',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/x-hwp',
  'application/x-hwpx',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'image/png',
  'image/jpeg',
  'application/zip'
]
where id = 'materials';

-- New or moved objects must be exactly {auth.uid()}/{a course the user owns}/{file}.
drop policy materials_insert on storage.objects;
create policy materials_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'materials'
    and array_length(storage.foldername(name), 1) = 2
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (storage.foldername(name))[2] in (
      select id::text from public.courses where user_id = (select auth.uid())
    )
  );

drop policy materials_update on storage.objects;
create policy materials_update on storage.objects
  for update to authenticated
  using (bucket_id = 'materials' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (
    bucket_id = 'materials'
    and array_length(storage.foldername(name), 1) = 2
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (storage.foldername(name))[2] in (
      select id::text from public.courses where user_id = (select auth.uid())
    )
  );

-- Account deletion -------------------------------------------------------------

-- Deletes the calling user; their rows cascade. The app removes their storage objects
-- first, and this refuses while any remain so no file is orphaned.
create function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not signed in';
  end if;
  if exists (
    select 1 from storage.objects
    where bucket_id = 'materials' and (storage.foldername(name))[1] = uid::text
  ) then
    raise exception 'storage objects remain';
  end if;
  delete from auth.users where id = uid;
end;
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
