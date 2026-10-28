-- Version 14: the Idea Graveyard. An unfinished project is a group (so it gets join requests, chat and
-- members for free) with a few extra details: how far it got, why it stopped, and what it needs.

ALTER TABLE groups ADD COLUMN kind TEXT NOT NULL DEFAULT 'community' CHECK (kind IN ('community', 'project'));

CREATE TABLE projects (
  group_id      TEXT PRIMARY KEY REFERENCES groups(id) ON DELETE CASCADE,
  stage         TEXT NOT NULL CHECK (stage IN ('idea', 'sketches', 'prototype', 'almost')),
  stopped       TEXT NOT NULL CHECK (stopped IN ('time', 'skills', 'teammates', 'money', 'other')),
  story         TEXT NOT NULL DEFAULT '' CHECK (length(story) <= 600), -- why it stopped, in their words
  needs         TEXT NOT NULL DEFAULT '[]', -- JSON list, e.g. ["Design", "Code"]
  status        TEXT NOT NULL DEFAULT 'resting' CHECK (status IN ('resting', 'reviving', 'alive')),
  free_to_adopt INTEGER NOT NULL DEFAULT 0 CHECK (free_to_adopt IN (0, 1)),
  -- Whoever first posted it. Stays when someone else adopts it, so the idea keeps its origin.
  started_by    TEXT REFERENCES users(id) ON DELETE SET NULL
);

-- What happened to it: posted, someone joined to help, adopted, back to life.
CREATE TABLE project_history (
  id         TEXT PRIMARY KEY,
  group_id   TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  emoji      TEXT NOT NULL,
  text       TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX project_history_group ON project_history(group_id, created_at);

-- Asking to take a project over; its owner says yes or no.
CREATE TABLE adoption_requests (
  group_id   TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  note       TEXT NOT NULL CHECK (length(note) BETWEEN 1 AND 300),
  created_at INTEGER NOT NULL,
  PRIMARY KEY (group_id, user_id)
);
