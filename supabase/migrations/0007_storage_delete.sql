-- Run in Supabase SQL Editor. Idempotent.
-- 1) Either room member can delete any message (2-person app)
-- 2) Authenticated users can delete files from the media buckets

drop policy if exists "Senders can delete own messages" on public.messages;
drop policy if exists "Room members can delete messages" on public.messages;
create policy "Room members can delete messages"
  on public.messages FOR DELETE
  TO authenticated
  USING (is_room_member(room_id));

drop policy if exists "Delete photos" on storage.objects;
create policy "Delete photos"
  on storage.objects for delete to authenticated
  using (bucket_id in ('chat-photos', 'chat-audio'));
