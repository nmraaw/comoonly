-- Version 7: Instagram and TikTok usernames on profiles, so people can check someone is real.
-- Only the username is kept (letters, digits, . and _): the app builds the link itself, so it can't be a trap.
ALTER TABLE users ADD COLUMN instagram TEXT NOT NULL DEFAULT ''
  CHECK (length(instagram) <= 30 AND instagram NOT GLOB '*[^A-Za-z0-9._]*');
ALTER TABLE users ADD COLUMN tiktok TEXT NOT NULL DEFAULT ''
  CHECK (length(tiktok) <= 30 AND tiktok NOT GLOB '*[^A-Za-z0-9._]*');
