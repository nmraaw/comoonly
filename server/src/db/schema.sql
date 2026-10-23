-- Runs on every start; IF NOT EXISTS makes it safe to repeat.
-- Ids are text so seed data can keep the readable ids the frontend already uses.

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  city          TEXT NOT NULL DEFAULT '',
  tagline       TEXT NOT NULL DEFAULT '',
  bio           TEXT NOT NULL DEFAULT '',
  interests     TEXT NOT NULL DEFAULT '[]', -- JSON array of strings
  created_at    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS groups (
  id          TEXT PRIMARY KEY,
  owner_id    TEXT NOT NULL REFERENCES users(id),
  name        TEXT NOT NULL,
  title       TEXT NOT NULL,
  description TEXT NOT NULL,
  category    TEXT NOT NULL,
  mode        TEXT NOT NULL,
  location    TEXT NOT NULL,
  capacity    INTEGER NOT NULL, -- max members; open spots = capacity - joined members
  color       TEXT NOT NULL,
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS groups_category ON groups(category);
CREATE INDEX IF NOT EXISTS groups_location ON groups(location);

-- A join request is a row with status 'pending'; the host turns it into 'joined' or 'declined'.
-- Member counts only include 'joined'.
CREATE TABLE IF NOT EXISTS group_members (
  group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status   TEXT NOT NULL DEFAULT 'joined' CHECK (status IN ('pending', 'joined', 'declined')),
  intro    TEXT NOT NULL DEFAULT '', -- the "say a little hello" message sent with a request
  PRIMARY KEY (group_id, user_id)
);

CREATE TABLE IF NOT EXISTS saved_groups (
  user_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, group_id)
);

-- One row per pair. from_id asked; the other person accepts (row stays) or declines (row is deleted).
CREATE TABLE IF NOT EXISTS connections (
  from_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status     TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted')),
  created_at INTEGER NOT NULL,
  PRIMARY KEY (from_id, to_id)
);

-- Group chat (group_id set) and direct messages (to_id set) share one table.
CREATE TABLE IF NOT EXISTS messages (
  id         TEXT PRIMARY KEY,
  group_id   TEXT REFERENCES groups(id) ON DELETE CASCADE,
  to_id      TEXT REFERENCES users(id) ON DELETE CASCADE,
  author_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text       TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  CHECK ((group_id IS NULL) <> (to_id IS NULL))
);
CREATE INDEX IF NOT EXISTS messages_group ON messages(group_id, created_at);
CREATE INDEX IF NOT EXISTS messages_direct ON messages(author_id, to_id, created_at);

CREATE TABLE IF NOT EXISTS activities (
  id         TEXT PRIMARY KEY,
  group_id   TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  starts_at  TEXT NOT NULL, -- local date-time as typed, e.g. 2026-10-25T16:00 (plan and notes columns: see connection.ts)
  place      TEXT NOT NULL,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS rsvps (
  activity_id TEXT NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (activity_id, user_id)
);

CREATE TABLE IF NOT EXISTS tasks (
  id         TEXT PRIMARY KEY,
  group_id   TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  done       INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

-- Found by the event finder. Nothing is shown publicly until an admin publishes it.
CREATE TABLE IF NOT EXISTS events (
  id           TEXT PRIMARY KEY,
  title        TEXT NOT NULL,
  starts_at    TEXT NOT NULL,
  city         TEXT NOT NULL DEFAULT '',
  mode         TEXT NOT NULL DEFAULT 'In person',
  category     TEXT NOT NULL DEFAULT 'Event',
  description  TEXT NOT NULL DEFAULT '',
  register_url TEXT NOT NULL,
  source_url   TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'rejected')),
  group_id     TEXT REFERENCES groups(id) ON DELETE SET NULL, -- "find people to go with"
  created_at   INTEGER NOT NULL,
  UNIQUE (source_url, title, starts_at)
);

-- One row per person blocked. Either direction stops connecting, private messages and joining their groups.
CREATE TABLE IF NOT EXISTS blocks (
  blocker_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (blocker_id, blocked_id)
);

-- Reports go to the admin dashboard.
CREATE TABLE IF NOT EXISTS reports (
  id          TEXT PRIMARY KEY,
  reporter_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reported_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason      TEXT NOT NULL,
  details     TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  created_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS notifications (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL, -- 'message' or 'update'; message ones light up the Messages tab
  text       TEXT NOT NULL,
  link       TEXT NOT NULL, -- where tapping it goes, e.g. /groups/abc?tab=Chat
  read       INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS notifications_user ON notifications(user_id, read, created_at);
