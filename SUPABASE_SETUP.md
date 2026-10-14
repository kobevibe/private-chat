# Supabase Setup Guide — Our Space

Follow every step in order. Do not skip the RLS or migration steps.

---

## Step 1 — Create the two accounts

1. Go to **Supabase Dashboard → Authentication → Users**.
2. Click **"Add user"** (or **"Create user"**).
3. Create the first user:
   - Email: `ramzhw@yourdomain.com` (use your real email or any valid address)
   - Password: choose a strong password (you will need it to log in)
   - **Auto Confirm User**: toggle ON
4. Create the second user the same way for `blackkity5588`.
5. After both are created, copy each user's **UUID** from the users list (it looks like `a1b2c3d4-...`). You will need them in Step 4.

---

## Step 2 — Run the SQL migration

1. In the Supabase Dashboard, open **SQL Editor**.
2. Click **"New query"**.
3. Paste the entire contents of `supabase/migrations/0001_initial_schema.sql`.
4. Click **"Run"**.
5. You should see `Success. No rows returned`.

This creates three tables (`rooms`, `room_members`, `messages`), enables Row Level Security on all of them, and adds the helper functions and triggers.

---

## Step 3 — Create the room

Still in the **SQL Editor**, run:

```sql
INSERT INTO rooms DEFAULT VALUES RETURNING id;
```

Copy the `id` value that is returned. You will need it in Step 4.

---

## Step 4 — Add the two members

Replace `YOUR_ROOM_ID`, `USER_1_UUID`, and `USER_2_UUID` with your actual values, then run:

```sql
INSERT INTO room_members (room_id, user_id) VALUES
  ('YOUR_ROOM_ID', 'USER_1_UUID'),
  ('YOUR_ROOM_ID', 'USER_2_UUID');
```

A trigger enforces that a room can have at most two members, so this will fail if you try to add a third.

---

## Step 5 — Enable Realtime

In the SQL Editor, run:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
```

If this errors with `table is already member of publication`, that is fine — it means Realtime is already enabled.

---

## Step 6 — Verify the setup

Run this to confirm everything is wired up:

```sql
-- Should return 1 room
SELECT * FROM rooms;

-- Should return 2 members
SELECT * FROM room_members;

-- RLS is enabled on all three tables
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'public' AND tablename IN ('rooms', 'room_members', 'messages');
```

All three tables should show `rowsecurity = true`.

---

## Step 7 — Environment variables

The `.env` file in your project root should contain:

```
VITE_SUPABASE_URL=https://weotolsyzzqehhqslnyg.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_J_3QGcwVKJr6Mx06QGVYRA_nXvCMuEv
```

> **Where to find these values:** Dashboard → **Project Settings → API**
> - **Project URL** → `VITE_SUPABASE_URL`
> - **Publishable key** (or anon key) → `VITE_SUPABASE_ANON_KEY`

`.env` is in `.gitignore` and will not be committed.

---

## Step 8 — Test

1. Run `npm run dev`.
2. Open the app in **two different browsers** (e.g. Chrome and Firefox, or one normal + one incognito window).
3. Log in as `ramzhw` in one and `blackkity5588` in the other.
4. Send a message — it should appear instantly in the other window.
5. Check the check marks:
   - `✓` = message saved
   - `✓✓` = recipient has the chat open and has read it
6. Type in one window — the other should show the typing indicator.
7. Refresh — messages should persist.

---

## RLS Policy Summary

| Table | Operation | Who | Rule |
|---|---|---|---|
| `rooms` | SELECT | authenticated | Must be a member of the room |
| `rooms` | INSERT/UPDATE/DELETE | — | No policy (created manually) |
| `room_members` | SELECT | authenticated | Must be a member of the room |
| `room_members` | INSERT/UPDATE/DELETE | — | No policy (configured manually) |
| `messages` | SELECT | authenticated | Must be a member of the room |
| `messages` | INSERT | authenticated | `sender_id` must equal `auth.uid()` and user must be a room member |
| `messages` | UPDATE | authenticated | Can only update messages **sent by someone else** and only set `read_at` |
| `messages` | DELETE | — | No policy |

**No `USING (true)` policies exist.** Every policy checks room membership via `auth.uid()`.

The `is_room_member()` and `get_my_room_id()` functions use `SECURITY DEFINER` to avoid recursive RLS evaluation.

---

## What is NOT included

- **Image/file upload** — Supabase Storage bucket and policies are not set up yet. The photo message UI is present but file upload is disabled. This is a remaining task for Milestone 2.5.
- **Profile table** — User display names come from the Supabase Auth metadata, not a separate profiles table.
