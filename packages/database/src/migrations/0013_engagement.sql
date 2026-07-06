-- Seguimiento inteligente de clientes: perfiles IA + conversaciones WhatsApp

CREATE TYPE ai_conversation_status AS ENUM ('ACTIVE', 'PAUSED', 'CLOSED');

CREATE TYPE ai_message_direction AS ENUM ('IN', 'OUT');

CREATE TYPE ai_message_status AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'READ', 'FAILED', 'RECEIVED');

CREATE TYPE ai_message_author AS ENUM ('CUSTOMER', 'AI', 'ADMIN');

CREATE TABLE IF NOT EXISTS customer_ai_profile (
  id uuid PRIMARY KEY,
  customer_id uuid NOT NULL REFERENCES customer(id) ON DELETE CASCADE,
  interests jsonb NOT NULL DEFAULT '[]'::jsonb,
  segments jsonb NOT NULL DEFAULT '[]'::jsonb,
  price_sensitivity text NOT NULL DEFAULT 'medium',
  buying_patterns jsonb NOT NULL DEFAULT '[]'::jsonb,
  recommended_categories jsonb NOT NULL DEFAULT '[]'::jsonb,
  next_best_actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  summary text NOT NULL DEFAULT '',
  confidence integer NOT NULL DEFAULT 0,
  model text NOT NULL DEFAULT '',
  last_analyzed_at timestamptz,
  last_order_seen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT customer_ai_profile_confidence CHECK (confidence >= 0 AND confidence <= 100)
);

CREATE UNIQUE INDEX IF NOT EXISTS customer_ai_profile_customer_uq ON customer_ai_profile(customer_id);

CREATE INDEX IF NOT EXISTS customer_ai_profile_analyzed_idx ON customer_ai_profile(last_analyzed_at);

CREATE TABLE IF NOT EXISTS ai_conversation (
  id uuid PRIMARY KEY,
  customer_id uuid NOT NULL REFERENCES customer(id) ON DELETE CASCADE,
  channel text NOT NULL DEFAULT 'whatsapp',
  status ai_conversation_status NOT NULL DEFAULT 'ACTIVE',
  autopilot boolean NOT NULL DEFAULT true,
  needs_human boolean NOT NULL DEFAULT false,
  last_message_at timestamptz,
  last_outreach_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ai_conversation_customer_channel_uq ON ai_conversation(customer_id, channel);

CREATE INDEX IF NOT EXISTS ai_conversation_last_message_idx ON ai_conversation(last_message_at);

CREATE INDEX IF NOT EXISTS ai_conversation_needs_human_idx ON ai_conversation(needs_human, status);

CREATE TABLE IF NOT EXISTS ai_message (
  id uuid PRIMARY KEY,
  conversation_id uuid NOT NULL REFERENCES ai_conversation(id) ON DELETE CASCADE,
  direction ai_message_direction NOT NULL,
  author ai_message_author NOT NULL,
  content text NOT NULL,
  status ai_message_status NOT NULL DEFAULT 'PENDING',
  intent text,
  goal text,
  recommended_product_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  wa_message_id text,
  error_message text,
  sent_by uuid REFERENCES admin_user(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);

CREATE INDEX IF NOT EXISTS ai_message_conversation_created_idx ON ai_message(conversation_id, created_at);

CREATE INDEX IF NOT EXISTS ai_message_status_idx ON ai_message(status, direction);

CREATE INDEX IF NOT EXISTS ai_message_wa_id_idx ON ai_message(wa_message_id);
