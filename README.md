# Our Space

A private chat for two. React + Vite + Tailwind v4, backed by Supabase (auth, Postgres, Realtime, Storage).

Live: https://private-chat-swart-pi.vercel.app

## Features

- **Accounts** — exactly two members, enforced by a DB trigger. Email/password login
- **Realtime chat** — messages, edits, deletes, reactions, pins, and wallpaper sync live via Supabase Realtime
- **Presence** — "Active now" / last seen (minutes/hours/days) under the partner's name; heartbeat only while the tab is visible
- **Read receipts** — ✓ sent, ✓✓ read
- **Typing indicator** — broadcast channel, ~400ms throttle
- **Replies** — tap-to-open action picker or swipe a bubble right (mobile)
- **Reactions** — ❤️ 👍 🔥, per-user, shown as chips under the bubble
- **Edit / delete** — own messages only; edits show an "edited" label
- **Photos** — upload up to 5MB (JPG/PNG/GIF/WebP) to a private Storage bucket; shown via signed URLs
- **Shared photo gallery** — every photo ever sent, grid view in the header
- **Pinned message** — one shared pin; tap the bar to scroll to it
- **Shared wallpaper** — one wallpaper for both accounts, crossfades live
- **Unread badge** — count next to the partner's name; auto-clears at the bottom of the chat
- **Link auto-detect** — URLs render as tappable links
- **Copy** — long-press (or right-click) a bubble to copy
- **Pull actions** — tap a bubble on mobile to reveal reactions/edit/delete (no hover needed)
- **Profiles** — display name + avatar, editable from your avatar in the header
- **Reconnect banner** — shown when the realtime channel drops
- **Privacy blur** — chat is covered in the app switcher / when the tab is hidden
- **Wallpaper picker** — four built-in options
- **Chat drafts** — input persists locally across reloads

## Stack

- [React 19](https://react.dev) + [Vite](https://vite.dev) (JavaScript, JSX)
- [Tailwind CSS v4](https://tailwindcss.com) via `@tailwindcss/vite`
- [Supabase JS v2](https://supabase.com/docs/reference/javascript) — Auth, Postgres (RLS), Realtime, Storage

## Getting started

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build → dist/
npm run lint     # eslint
```

### Backend setup

One-time Supabase setup (accounts, migrations, room, realtime, storage bucket) is documented in **[SUPABASE_SETUP.md](./SUPABASE_SETUP.md)**.

### Environment

`.env` (gitignored):

```
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_KEY
```

## Database

| Table | Purpose |
|---|---|
| `rooms` | The single shared room; `pinned_message_id`, `wallpaper_url` |
| `room_members` | Membership (max 2 via trigger) |
| `messages` | Content, reactions, replies, edits, read receipts |
| `profiles` | Name, avatar, `last_seen_at` |
| `storage.chat-photos` | Private photo bucket, signed URLs |

All tables have Row Level Security; every access check goes through `is_room_member()` or row ownership.

## Deploy

Pushed to GitHub → Vercel auto-deploys. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the Vercel project settings.

## Project layout

```
src/
  components/   ChatApp, LoginScreen, ReactionPicker, PhotoGallery, …
  hooks/        useAuth (Supabase session)
  lib/          supabase client
  utils/        dates (last-seen formatting), linkify
supabase/
  migrations/   0001–0004 SQL
```
