-- ============================================================
-- Full reset — wipe chat history + genericize profiles
-- Run ONCE in the Supabase SQL Editor (Dashboard → SQL Editor).
-- Idempotent: safe to run more than once.
--
-- Effects:
--   • deletes every message (text, photo, GIF, voice, replies,
--     reactions)
--   • deletes the actual media files from storage
--   • clears the pinned message
--   • renames both accounts to "User 1" / "User 2"
--   • resets avatars to the app's built-in default
--   • keeps auth metadata in sync
--
-- Untouched: accounts, logins, rooms, wallpaper, RLS policies.
-- ============================================================

-- 1) Wipe every message --------------------------------------
DELETE FROM public.messages;

-- 2) Delete the actual media files from storage --------------
DELETE FROM storage.objects WHERE bucket_id IN ('chat-photos', 'chat-audio');

-- 3) Clear the dangling pin ----------------------------------
UPDATE public.rooms
SET pinned_message_id = NULL
WHERE pinned_message_id IS NOT NULL;

-- 4) Reset profiles: generic names, default avatar ----------
--    (NULL avatar_url → app falls back to the built-in avatar)
UPDATE public.profiles
SET display_name = CASE user_id
      WHEN 'd15a3600-9f2d-4000-aa5d-16361a3be9d6' THEN 'User 1'
      WHEN '514802d0-262d-4e88-9629-5a2d9db2c347' THEN 'User 2'
    END,
    avatar_url = NULL,
    updated_at = now()
WHERE user_id IN (
  'd15a3600-9f2d-4000-aa5d-16361a3be9d6',
  '514802d0-262d-4e88-9629-5a2d9db2c347'
);

-- 5) Keep auth metadata in sync (the profile editor writes
--    display_name / avatar_url into raw_user_meta_data) -------
UPDATE auth.users
SET raw_user_meta_data =
      COALESCE(raw_user_meta_data, '{}'::jsonb) - 'avatar_url'
      || jsonb_build_object('display_name', CASE id
      WHEN 'd15a3600-9f2d-4000-aa5d-16361a3be9d6' THEN 'User 1'
      WHEN '514802d0-262d-4e88-9629-5a2d9db2c347' THEN 'User 2'
    END)
WHERE id IN (
  'd15a3600-9f2d-4000-aa5d-16361a3be9d6',
  '514802d0-262d-4e88-9629-5a2d9db2c347'
);

-- Verification (optional — run to confirm) -------------------
-- SELECT count(*) AS messages_left FROM public.messages;          -- expect 0
-- SELECT user_id, display_name, avatar_url FROM public.profiles;  -- User 1 / User 2, NULL avatars
