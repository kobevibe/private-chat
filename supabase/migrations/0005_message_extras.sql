-- Run this in Supabase SQL Editor (idempotent — safe if already applied)
-- These columns were added out-of-band during development; recorded here
-- so supabase/migrations/ fully describes the live schema.

alter table public.messages
  add column if not exists reply_to uuid references public.messages(id) on delete set null,
  add column if not exists reactions jsonb,
  add column if not exists edited_at timestamptz;

-- Sender can edit/retract reactions on own messages
drop policy if exists "Senders can update own messages" on public.messages;
create policy "Senders can update own messages"
  on public.messages FOR UPDATE
  TO authenticated
  USING (sender_id = auth.uid())
  WITH CHECK (sender_id = auth.uid());

-- Sender can delete own messages
drop policy if exists "Senders can delete own messages" on public.messages;
create policy "Senders can delete own messages"
  on public.messages FOR DELETE
  TO authenticated
  USING (sender_id = auth.uid());
