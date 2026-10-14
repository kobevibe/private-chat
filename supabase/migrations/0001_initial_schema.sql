-- ============================================================
-- Our Space — Milestone 2 migration
-- Creates: rooms, room_members, messages
-- Enables RLS with least-privilege policies
-- Rerunnable: safe to run more than once
-- ============================================================

-- 1. Tables ---------------------------------------------------

CREATE TABLE IF NOT EXISTS rooms (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS room_members (
  room_id   uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (room_id, user_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id      uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  sender_id    uuid NOT NULL REFERENCES auth.users(id),
  content      text,
  message_type text NOT NULL DEFAULT 'text'
               CHECK (message_type IN ('text', 'photo')),
  media_url    text,
  media_metadata jsonb,
  read_at      timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_messages_room_created
  ON messages (room_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_unread
  ON messages (room_id, read_at) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_room_members_user
  ON room_members (user_id);

-- 2. Helper functions (SECURITY DEFINER avoids RLS recursion) --

-- Returns true when the calling user is a member of the given room.
CREATE OR REPLACE FUNCTION is_room_member(_room_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM room_members
    WHERE room_id = _room_id AND user_id = auth.uid()
  );
$$;

-- Returns the id of the room the calling user belongs to (or NULL).
CREATE OR REPLACE FUNCTION get_my_room_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT room_id FROM room_members
  WHERE user_id = auth.uid()
  LIMIT 1;
$$;

-- 3. Row Level Security ---------------------------------------

ALTER TABLE rooms        ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages     ENABLE ROW LEVEL SECURITY;

-- rooms -------------------------------------------------------

DROP POLICY IF EXISTS "Members can read their room" ON rooms;
CREATE POLICY "Members can read their room"
  ON rooms FOR SELECT
  TO authenticated
  USING (is_room_member(id));

-- No INSERT / UPDATE / DELETE policies for rooms:
-- rooms are created manually via the setup guide (service role).

-- room_members ------------------------------------------------

DROP POLICY IF EXISTS "Members can read room membership" ON room_members;
CREATE POLICY "Members can read room membership"
  ON room_members FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR is_room_member(room_id));

-- No INSERT / UPDATE / DELETE policies for room_members:
-- membership is configured once in the setup guide (service role).

-- messages ----------------------------------------------------

-- SELECT: only members of the room can read its messages.
DROP POLICY IF EXISTS "Members can read room messages" ON messages;
CREATE POLICY "Members can read room messages"
  ON messages FOR SELECT
  TO authenticated
  USING (is_room_member(room_id));

-- INSERT: authenticated users may insert only into their own
-- room and only as themselves (sender_id = auth.uid()).
DROP POLICY IF EXISTS "Members can send messages as themselves" ON messages;
CREATE POLICY "Members can send messages as themselves"
  ON messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND is_room_member(room_id)
  );

-- UPDATE: the recipient may mark an incoming message as read.
-- The sender can never update their own messages (read_at is
-- set by the OTHER user).  read_at must be set to a timestamp.
DROP POLICY IF EXISTS "Recipients can mark incoming messages read" ON messages;
CREATE POLICY "Recipients can mark incoming messages read"
  ON messages FOR UPDATE
  TO authenticated
  USING (
    is_room_member(room_id)
    AND sender_id <> auth.uid()
    AND read_at IS NULL
  )
  WITH CHECK (
    is_room_member(room_id)
    AND sender_id <> auth.uid()
    AND read_at IS NOT NULL
  );

-- No DELETE policy: messages are permanent in this milestone.

-- 4. Enforce exactly two members per room ---------------------

CREATE OR REPLACE FUNCTION enforce_two_members()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (SELECT count(*) FROM room_members WHERE room_id = NEW.room_id) >= 2 THEN
    RAISE EXCEPTION 'Room % already has two members — only two accounts are allowed.', NEW.room_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_two_members ON room_members;
CREATE TRIGGER trg_enforce_two_members
  BEFORE INSERT ON room_members
  FOR EACH ROW
  EXECUTE FUNCTION enforce_two_members();

-- 5. Allow enabling Realtime on messages ----------------------

-- (Run this in the SQL editor if replication is not already on)
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
