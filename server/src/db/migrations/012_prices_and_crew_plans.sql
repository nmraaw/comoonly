-- Version 12: budgets, and getting there together.

-- The cheapest ticket in rupees: 0 = free, NULL = the post doesn't say.
ALTER TABLE events ADD COLUMN price INTEGER CHECK (price IS NULL OR price >= 0);

-- Where each crew member is coming from (an area, never an address), to ride together.
ALTER TABLE group_members ADD COLUMN area TEXT NOT NULL DEFAULT '' CHECK (length(area) <= 60);

-- Shared costs in a crew (tickets, a ride), split equally between its members, like Splitwise.
CREATE TABLE expenses (
  id         TEXT PRIMARY KEY,
  group_id   TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  payer_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  what       TEXT NOT NULL CHECK (length(what) BETWEEN 1 AND 60),
  amount     INTEGER NOT NULL CHECK (amount BETWEEN 1 AND 1000000), -- rupees
  created_at INTEGER NOT NULL
);
CREATE INDEX expenses_group ON expenses(group_id);
