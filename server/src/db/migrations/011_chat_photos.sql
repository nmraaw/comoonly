-- Version 11: photos in chats ("📷 Photo" messages, like voice messages). A crew's photos make its memory card.
CREATE TABLE message_photos (
  message_id TEXT PRIMARY KEY REFERENCES messages(id) ON DELETE CASCADE,
  mime       TEXT NOT NULL CHECK (mime IN ('image/jpeg', 'image/png', 'image/webp')),
  bytes      BLOB NOT NULL
);
