-- Version 3: an event's poster (from the Instagram post, a "Suggest an event" screenshot, or an admin).
-- Kept in its own table so listing events never loads the pictures.
CREATE TABLE event_posters (
  event_id TEXT PRIMARY KEY REFERENCES events(id) ON DELETE CASCADE,
  mime     TEXT NOT NULL CHECK (mime IN ('image/jpeg', 'image/png', 'image/webp')),
  bytes    BLOB NOT NULL
);
