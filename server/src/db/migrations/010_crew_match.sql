-- Version 10: "Find me a crew". People waiting to be matched into a crew for an event. When enough
-- people with things in common are waiting, Comoonly forms a crew from them (see events.going.ts).
CREATE TABLE crew_match (
  event_id   TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  women_only INTEGER NOT NULL DEFAULT 0 CHECK (women_only IN (0, 1)), -- only matched with other women
  created_at INTEGER NOT NULL,
  PRIMARY KEY (event_id, user_id)
);
