CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE admin_session
  ADD COLUMN IF NOT EXISTS session_token_hash text;

UPDATE admin_session
SET session_token_hash = encode(digest(id::text, 'sha256'), 'hex')
WHERE session_token_hash IS NULL;

ALTER TABLE admin_session
  ALTER COLUMN session_token_hash SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS admin_session_token_hash_unique
  ON admin_session(session_token_hash);
