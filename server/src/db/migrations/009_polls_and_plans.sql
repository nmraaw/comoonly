-- Version 9: chat activities (polls, a pinned plan) for crews and communities.

-- One short pinned note per group, like "Meet at Gate 2, 5:45, Ali brings the tickets". Any member can edit it.
ALTER TABLE groups ADD COLUMN pinned TEXT NOT NULL DEFAULT '' CHECK (length(pinned) <= 200);

-- A poll is a group chat message ("📊 Where do we meet?") with 2-4 choices, stored as a JSON array of text.
CREATE TABLE polls (
  message_id TEXT PRIMARY KEY REFERENCES messages(id) ON DELETE CASCADE,
  options    TEXT NOT NULL
);

-- One vote per person per poll; voting again changes it.
CREATE TABLE poll_votes (
  message_id TEXT NOT NULL REFERENCES polls(message_id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  choice     INTEGER NOT NULL CHECK (choice BETWEEN 0 AND 3),
  PRIMARY KEY (message_id, user_id)
);
