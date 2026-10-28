-- Version 13: showing up. On the day, crew members say if they're still coming and tap "I'm here".

ALTER TABLE group_members ADD COLUMN still_coming TEXT NOT NULL DEFAULT '' CHECK (still_coming IN ('', 'yes', 'no'));
ALTER TABLE group_members ADD COLUMN arrived_at INTEGER; -- when they tapped "I'm here"

-- "Still coming?" is asked once per event, on the day.
ALTER TABLE events ADD COLUMN crews_asked INTEGER NOT NULL DEFAULT 0 CHECK (crews_asked IN (0, 1));

-- Who showed up for their crew, kept after the event and its crews are deleted: the show-up score.
-- No link to events on purpose, so the history outlives them.
CREATE TABLE attendance (
  user_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL,
  showed   INTEGER NOT NULL CHECK (showed IN (0, 1)),
  PRIMARY KEY (user_id, event_id)
);
