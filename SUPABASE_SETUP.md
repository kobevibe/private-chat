# Supabase Setup Guide — Our Space

Current state of the database and how to recreate it from scratch.

---

## What exists

| Table | Purpose |
|---|---|
| `rooms` | One shared room. Holds `pinned_message_id` and `wallpaper_url` (shared between both accounts) |
| `room_members` | Two members per room (trigger-enforced max 2) |
| `messages` | Text + photo messages, reactions, replies, edits, read receipts, pins |
| `profiles` | Display name, avatar URL, `last_seen_at` (presence) |
| Storage bucket `chat-photos` | Private bucket for uploaded images, served via signed URLs |

### `messages` columns

`id`, `room_id`, `sender_id`, `content`, `message_type` (`text` | `photo`), `media_url` (storage path for photos), `media_metadata`, `read_at`, `created_at`, plus:

- `reply_to uuid` — quoted parent message
- `reactions jsonb` — `{ user_id: emoji }` map
- `edited_at timestamptz` — set when sender edits
- `pinned_at` — (pin lives on `rooms.pinned_message_id`, not per-message)

### `profiles` columns

`user_id`, `display_name`, `avatar_url`, `updated_at`, `last_seen_at`

### `rooms` columns

`id`, `created_at`, `pinned_message_id` (FK → messages, `on delete set null`), `wallpaper_url`

---

## Recreating from scratch

### 1. Create the two accounts

**Authentication → Users → Add user**, twice. Toggle **Auto Confirm User** ON. Copy each user's UUID.

### 2. Run the migrations, in order

SQL Editor → New query → paste each file → Run:

1. `supabase/migrations/0001_initial_schema.sql` — rooms, room_members, messages, `is_room_member()`, two-member trigger
2. `supabase/migrations/0002_profiles.sql` — profiles table + starter rows
3. `supabase/migrations/0003_last_seen.sql` — `profiles.last_seen_at`
4. `supabase/migrations/0004_rooms_pinned_wallpaper.sql` — room pin/wallpaper columns, rooms UPDATE policy, realtime
5. `supabase/migrations/0005_message_extras.sql` — `reply_to`, `reactions`, `edited_at`, sender update/delete policies

### 3. Run the remaining migrations

5. `supabase/migrations/0005_message_extras.sql` — `reply_to`, `reactions`, `edited_at`, sender update/delete policies

All migration files are idempotent (`if not exists` / `drop policy if exists`) — safe to re-run on the live database.

### 4. Create the room + members

```sql
INSERT INTO rooms DEFAULT VALUES RETURNING id;

INSERT INTO room_members (room_id, user_id) VALUES
  ('ROOM_ID', 'USER_1_UUID'),
  ('ROOM_ID', 'USER_2_UUID');
```

### 5. Realtime

```sql
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.rooms;
```

`already member of publication` errors are fine.

### 6. Storage bucket

Dashboard → **Storage → New bucket**:

- Name: `chat-photos`
- **Private** (not public)
- File size limit: 5 MB, allowed MIME types: `image/jpeg`, `image/png`, `image/gif`, `image/webp`

Policies on the bucket:

```sql
create policy "Authenticated users can upload"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'chat-photos' and auth.role() = 'authenticated');

create policy "Room members can read photos"
  on storage.objects for select to authenticated
  using (bucket_id = 'chat-photos');
```

Photos are displayed via `createSignedUrl(path, 3600)` — no public URLs.

---

## Environment variables

`.env` (gitignored):

```
VITE_SUPABASE_URL=https://weotolsyzzqehhqslnyg.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_J_3QGcwVKJr6Mx06QGVYRA_nXvCMuEv
```

Find them in **Project Settings → API** (Project URL + publishable/anon key).

Vercel: same two variables under **Project → Settings → Environment Variables**.

---

## RLS summary

| Table | Operation | Rule |
|---|---|---|
| `rooms` | SELECT | Must be a member |
| `rooms` | UPDATE | Must be a member (pin + wallpaper) |
| `room_members` | SELECT | Must be a member |
| `messages` | SELECT | Must be a member |
| `messages` | INSERT | `sender_id = auth.uid()` + member |
| `messages` | UPDATE | Sender: own message (reaction/edit). Recipient: incoming, `read_at` only |
| `messages` | DELETE | Sender's own message |
| `profiles` | SELECT | Any authenticated user (names/avatars/presence) |
| `profiles` | INSERT/UPDATE | Own row only |
| `storage.objects` | INSERT/SELECT | Authenticated, bucket `chat-photos` |

`is_room_member()` / `get_my_room_id()` are `SECURITY DEFINER` to avoid recursive RLS.

---

## Verification

```sql
SELECT * FROM rooms;              -- 1 row, wallpaper_url/pinned may be set
SELECT * FROM room_members;       -- 2 rows
SELECT count(*) FROM messages;    -- grows as you chat
SELECT user_id, display_name, last_seen_at FROM profiles;
SELECT tablename, rowsecurity FROM pg_tables
  WHERE schemaname = 'public'
  AND tablename IN ('rooms', 'room_members', 'messages', 'profiles');
```

All four tables should show `rowsecurity = true`.

**App test:** two browsers, both logged in — messages/typing/pins/wallpaper sync live; photos upload and appear in the gallery; header shows "Active now" / last-seen for the partner.
