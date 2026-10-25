-- Version 5: going to events together, in crews.

-- Optional, on the profile. Needed for women-only crews (a "verified profile" also needs it).
ALTER TABLE users ADD COLUMN gender TEXT NOT NULL DEFAULT '' CHECK (gender IN ('', 'woman', 'man', 'private'));

-- Who's going to which event, and how: looking for company, happy to meet people there,
-- or with their own friends (those aren't added to the event's group chat).
CREATE TABLE event_going (
  event_id   TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  intent     TEXT NOT NULL CHECK (intent IN ('company', 'meet', 'friends')),
  created_at INTEGER NOT NULL,
  PRIMARY KEY (event_id, user_id)
);
CREATE INDEX event_going_user ON event_going(user_id);

-- Everyone already in an event's group was looking for company.
INSERT INTO event_going (event_id, user_id, intent, created_at)
  SELECT e.id, m.user_id, 'company', m.created_at
  FROM events e JOIN group_members m ON m.group_id = e.group_id AND m.status = 'joined';

-- A crew is a small group (2-5 people) going to one event together. It is a row in `groups`, so it
-- gets join requests (its organizer accepts people), chat and members for free; event_id says which event.
ALTER TABLE groups ADD COLUMN event_id TEXT REFERENCES events(id) ON DELETE CASCADE;
ALTER TABLE groups ADD COLUMN women_only INTEGER NOT NULL DEFAULT 0 CHECK (women_only IN (0, 1));
CREATE INDEX groups_event ON groups(event_id);

-- The database itself keeps women-only crews women-only, even if server code had a bug.
CREATE TRIGGER women_only_crews BEFORE INSERT ON group_members
WHEN (SELECT women_only FROM groups WHERE id = NEW.group_id) = 1
  AND (SELECT gender FROM users WHERE id = NEW.user_id) <> 'woman'
BEGIN
  SELECT RAISE(ABORT, 'Only women can join a women-only crew');
END;

-- "You went with Ayesha and Sana. Connect?" is sent once, after the event.
ALTER TABLE events ADD COLUMN followed_up INTEGER NOT NULL DEFAULT 0 CHECK (followed_up IN (0, 1));
