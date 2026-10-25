-- Version 8: voice messages. The message row says "🎤 Voice message" (so previews and notifications
-- read well); the recording lives here, removed with its message.
CREATE TABLE message_audio (
  message_id TEXT PRIMARY KEY REFERENCES messages(id) ON DELETE CASCADE,
  mime       TEXT NOT NULL CHECK (mime IN ('audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/aac')),
  bytes      BLOB NOT NULL
);
