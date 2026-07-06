-- Storefront: cuentas de cliente + sesiones para la tienda pública

CREATE TABLE IF NOT EXISTS customer_account (
  id uuid PRIMARY KEY,
  customer_id uuid NOT NULL REFERENCES customer(id) ON DELETE CASCADE,
  email text NOT NULL,
  password_hash text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS customer_account_customer_uq ON customer_account(customer_id);
CREATE UNIQUE INDEX IF NOT EXISTS customer_account_email_uq ON customer_account(lower(email));

CREATE TABLE IF NOT EXISTS customer_session (
  id uuid PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES customer_account(id) ON DELETE CASCADE,
  session_token_hash text NOT NULL,
  ip text NOT NULL,
  user_agent text NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS customer_session_token_hash_uq ON customer_session(session_token_hash);
CREATE INDEX IF NOT EXISTS customer_session_account_idx ON customer_session(account_id);
CREATE INDEX IF NOT EXISTS customer_session_expires_idx ON customer_session(expires_at);
