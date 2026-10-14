-- Run this in Supabase SQL Editor

-- Pinned message (one per room)
alter table public.rooms
  add column if not exists pinned_message_id uuid references public.messages(id) on delete set null;

-- Shared wallpaper
alter table public.rooms
  add column if not exists wallpaper_url text;

-- Members can update their own room (pin + wallpaper)
drop policy if exists "Members can update room" on public.rooms;
create policy "Members can update room"
  on public.rooms FOR UPDATE
  TO authenticated
  USING (public.is_room_member(id))
  WITH CHECK (public.is_room_member(id));

-- Realtime for room updates (pin/wallpaper sync)
-- If this errors with "already member of publication", that's fine
alter publication supabase_realtime add table public.rooms;
