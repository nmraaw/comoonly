-- Version 2: people prove they own their email before their account can be used.
-- Without this, anyone could sign up as an admin's email and get the admin page.

-- Everyone who signed up before verification existed counts as verified.
ALTER TABLE users ADD COLUMN verified INTEGER NOT NULL DEFAULT 0 CHECK (verified IN (0, 1));
UPDATE users SET verified = 1;

-- The 6-digit code emailed at sign-up. One live code per person; asking again replaces it.
CREATE TABLE email_codes (
  user_id    TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  code_hash  TEXT NOT NULL, -- sha256 of the code, never the code itself
  tries      INTEGER NOT NULL DEFAULT 0, -- wrong guesses; after 5 the code stops working
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
