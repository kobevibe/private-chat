-- Voice messages: widen message_type CHECK + audio bucket
-- Run in Supabase SQL Editor. Idempotent.

alter table public.messages drop constraint if exists messages_message_type_check;
alter table public.messages
  add constraint messages_message_type_check check (message_type in ('text', 'photo', 'voice'));

-- Audio bucket (chat-photos has an image-only MIME allowlist)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat-audio', 'chat-audio', false, 20971520,
  array['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/mpeg', 'audio/wav', 'audio/x-m4a']
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Authenticated users can upload audio" on storage.objects;
create policy "Authenticated users can upload audio"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'chat-audio' and auth.role() = 'authenticated');

drop policy if exists "Room members can read audio" on storage.objects;
create policy "Room members can read audio"
  on storage.objects for select to authenticated
  using (bucket_id = 'chat-audio');
