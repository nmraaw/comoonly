-- Version 6: profile photos and group photos; one crew per organizer per event; activities removed.

-- Activities (plans inside a group) are gone from the app: events and crews cover going somewhere together.
DROP TABLE rsvps;
DROP TABLE activities;

-- Someone can organize only one crew for a given event (they can still join others').
CREATE UNIQUE INDEX one_crew_per_organizer ON groups(event_id, owner_id) WHERE event_id IS NOT NULL;

-- Pictures live in their own tables, so listing people or groups never loads them.
CREATE TABLE user_photos (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  mime    TEXT NOT NULL CHECK (mime IN ('image/jpeg', 'image/png', 'image/webp')),
  bytes   BLOB NOT NULL
);
CREATE TABLE group_photos (
  group_id TEXT PRIMARY KEY REFERENCES groups(id) ON DELETE CASCADE,
  mime     TEXT NOT NULL CHECK (mime IN ('image/jpeg', 'image/png', 'image/webp')),
  bytes    BLOB NOT NULL
);
