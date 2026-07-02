CREATE TYPE admin_role AS ENUM ('OWNER', 'ADMIN', 'CATALOG_MANAGER', 'FINANCE', 'SUPPORT');

CREATE TABLE admin_user (
  id uuid PRIMARY KEY,
  email text NOT NULL,
  password_hash text NOT NULL,
  full_name text NOT NULL,
  role admin_role NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  mfa_enabled boolean NOT NULL DEFAULT false,
  mfa_secret_enc text,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX admin_user_email_unique ON admin_user (lower(email));
CREATE INDEX admin_user_role_idx ON admin_user (role);

CREATE TABLE admin_session (
  id uuid PRIMARY KEY,
  admin_user_id uuid NOT NULL REFERENCES admin_user(id) ON DELETE CASCADE,
  refresh_token_hash text NOT NULL,
  previous_refresh_token_hash text,
  family_id uuid NOT NULL,
  device_label text NOT NULL,
  device_fingerprint_hash text,
  ip text NOT NULL,
  user_agent text NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX admin_session_refresh_hash_unique ON admin_session (refresh_token_hash);
CREATE INDEX admin_session_previous_refresh_hash_idx ON admin_session (previous_refresh_token_hash);
CREATE INDEX admin_session_user_idx ON admin_session (admin_user_id);
CREATE INDEX admin_session_family_idx ON admin_session (family_id);

CREATE TABLE permission_grant (
  id uuid PRIMARY KEY,
  role admin_role NOT NULL,
  resource text NOT NULL,
  action text NOT NULL
);

CREATE UNIQUE INDEX permission_grant_unique ON permission_grant (role, resource, action);

CREATE TABLE access_log (
  id uuid PRIMARY KEY,
  actor_id uuid REFERENCES admin_user(id) ON DELETE SET NULL,
  resource_type text NOT NULL,
  resource_id text,
  action text NOT NULL,
  reason text,
  ip text NOT NULL,
  user_agent text NOT NULL,
  request_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX access_log_actor_created_idx ON access_log (actor_id, created_at);
CREATE INDEX access_log_resource_idx ON access_log (resource_type, resource_id);

CREATE TABLE admin_password_reset_token (
  id uuid PRIMARY KEY,
  admin_user_id uuid NOT NULL REFERENCES admin_user(id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  ip text NOT NULL,
  user_agent text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX admin_password_reset_token_hash_unique ON admin_password_reset_token (token_hash);
CREATE INDEX admin_password_reset_user_idx ON admin_password_reset_token (admin_user_id);
