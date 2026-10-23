-- Comoonly database, version 1. See docs/DATABASE.md for the diagram and the reasoning behind it.
--
-- Conventions
--   ids          random UUID text (seed data uses readable ids like 'bedroom-musicians')
--   *_at         INTEGER = milliseconds since 1970 (Date.now()), except starts_at/deadline:
--                TEXT ISO dates ('2026-11-02' or '2026-11-02T18:00') as people typed them, in local time
--   status       always a CHECK-limited word, never a free-form string
--   deleting     ON DELETE CASCADE removes things that only make sense with their parent
--                (a group's messages); SET NULL keeps history (an event outlives its suggester)

------------------------------------------------------------------ people

CREATE TABLE users (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE CHECK (email = lower(email) AND email LIKE '%_@_%'),
  password_hash TEXT NOT NULL, -- "salt:scrypt-hash", never the password
  city          TEXT NOT NULL DEFAULT '',
  tagline       TEXT NOT NULL DEFAULT '',
  bio           TEXT NOT NULL DEFAULT '',
  created_at    INTEGER NOT NULL
);

-- One row per interest, so "who likes Hackathons?" is a simple indexed lookup (used for event alerts).
CREATE TABLE user_interests (
  user_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  interest TEXT NOT NULL,
  position INTEGER NOT NULL, -- keeps the order the person picked them in
  PRIMARY KEY (user_id, interest)
);
CREATE INDEX user_interests_interest ON user_interests(interest);

CREATE TABLE sessions (
  token      TEXT PRIMARY KEY, -- random 32 bytes, stored in an HttpOnly cookie
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE INDEX sessions_user ON sessions(user_id);

-- A request from one person to another. Declining deletes the row.
CREATE TABLE connections (
  from_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status     TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted')),
  created_at INTEGER NOT NULL,
  PRIMARY KEY (from_id, to_id),
  CHECK (from_id <> to_id)
);
-- At most one connection per pair, whichever way round it was asked.
CREATE UNIQUE INDEX connections_pair ON connections(min(from_id, to_id), max(from_id, to_id));
CREATE INDEX connections_to ON connections(to_id, status);

------------------------------------------------------------------ groups

CREATE TABLE groups (
  id          TEXT PRIMARY KEY,
  owner_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- the host
  name        TEXT NOT NULL,
  title       TEXT NOT NULL, -- the headline on the invitation card
  description TEXT NOT NULL,
  category    TEXT NOT NULL,
  mode        TEXT NOT NULL CHECK (mode IN ('In person', 'Online', 'Hybrid')),
  location    TEXT NOT NULL, -- a city or area, never an exact address
  capacity    INTEGER NOT NULL CHECK (capacity >= 2), -- open spots = capacity - joined members
  color       TEXT NOT NULL CHECK (color IN ('lilac', 'mint', 'pink')),
  created_at  INTEGER NOT NULL
);
CREATE INDEX groups_owner ON groups(owner_id);
CREATE INDEX groups_feed ON groups(location, category);

-- Membership and join requests in one table: a request is a 'pending' row that the host turns into
-- 'joined' or 'declined'. Declined rows stay, so the same person can't keep asking.
CREATE TABLE group_members (
  group_id   TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status     TEXT NOT NULL DEFAULT 'joined' CHECK (status IN ('pending', 'joined', 'declined')),
  intro      TEXT NOT NULL DEFAULT '', -- the "say a little hello" message sent with a request
  created_at INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)),
  PRIMARY KEY (group_id, user_id)
);
CREATE INDEX group_members_user ON group_members(user_id, status);

CREATE TABLE saved_groups (
  user_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, group_id)
);

-- Plans inside a group ("First jam, zero pressure"), with who's going.
CREATE TABLE activities (
  id         TEXT PRIMARY KEY,
  group_id   TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  starts_at  TEXT NOT NULL,
  place      TEXT NOT NULL,
  plan       TEXT NOT NULL DEFAULT '', -- "the very loose plan", one step per line
  notes      TEXT NOT NULL DEFAULT '', -- "before you go"
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX activities_group ON activities(group_id, starts_at);

CREATE TABLE rsvps (
  activity_id TEXT NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (activity_id, user_id)
);

CREATE TABLE tasks (
  id         TEXT PRIMARY KEY,
  group_id   TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  done       INTEGER NOT NULL DEFAULT 0 CHECK (done IN (0, 1)),
  created_at INTEGER NOT NULL
);
CREATE INDEX tasks_group ON tasks(group_id, created_at);

------------------------------------------------------------------ messages

-- Group chat and private messages share one table: exactly one of group_id / to_id is set.
CREATE TABLE messages (
  id         TEXT PRIMARY KEY,
  group_id   TEXT REFERENCES groups(id) ON DELETE CASCADE,
  to_id      TEXT REFERENCES users(id) ON DELETE CASCADE,
  author_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text       TEXT NOT NULL CHECK (length(text) BETWEEN 1 AND 1000),
  created_at INTEGER NOT NULL,
  CHECK ((group_id IS NULL) <> (to_id IS NULL))
);
CREATE INDEX messages_group ON messages(group_id, created_at);
CREATE INDEX messages_direct ON messages(author_id, to_id, created_at);

-- In-app notices. 'message' ones light up the Messages tab; a busy chat updates one unread notice.
CREATE TABLE notifications (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL CHECK (kind IN ('message', 'update')),
  text       TEXT NOT NULL,
  link       TEXT NOT NULL, -- where tapping it goes, e.g. /groups/abc?tab=Chat
  read       INTEGER NOT NULL DEFAULT 0 CHECK (read IN (0, 1)),
  created_at INTEGER NOT NULL
);
CREATE INDEX notifications_user ON notifications(user_id, read, created_at);

------------------------------------------------------------------ events

-- Found by the event finder or suggested by people. Nothing is public until an admin publishes it.
CREATE TABLE events (
  id           TEXT PRIMARY KEY,
  title        TEXT NOT NULL,
  starts_at    TEXT NOT NULL,
  deadline     TEXT NOT NULL DEFAULT '', -- last day to register, '' if unknown
  city         TEXT NOT NULL DEFAULT '',
  mode         TEXT NOT NULL DEFAULT 'In person' CHECK (mode IN ('In person', 'Online', 'Hybrid')),
  category     TEXT NOT NULL DEFAULT 'Event',
  description  TEXT NOT NULL DEFAULT '',
  register_url TEXT NOT NULL, -- the official registration page
  source_url   TEXT NOT NULL, -- where we found it
  status       TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'rejected')),
  group_id     TEXT REFERENCES groups(id) ON DELETE SET NULL, -- "find people to go with"
  suggested_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at   INTEGER NOT NULL,
  UNIQUE (source_url, title, starts_at)
);
CREATE INDEX events_listing ON events(status, starts_at);
CREATE INDEX events_register ON events(register_url); -- duplicate check: the same event on several pages

-- Instagram posts the reader already looked at, so none is read (or sent to the AI) twice.
CREATE TABLE seen_posts (
  post_id TEXT PRIMARY KEY,
  seen_at INTEGER NOT NULL
);

------------------------------------------------------------------ safety

CREATE TABLE blocks (
  blocker_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);
CREATE INDEX blocks_blocked ON blocks(blocked_id);

-- Read by admins on the dashboard.
CREATE TABLE reports (
  id          TEXT PRIMARY KEY,
  reporter_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reported_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason      TEXT NOT NULL,
  details     TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  created_at  INTEGER NOT NULL,
  CHECK (reporter_id <> reported_id)
);
CREATE INDEX reports_status ON reports(status, created_at);
